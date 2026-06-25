// ============================================================================
//  Edge Function: capturar-lead  (Supabase / Deno)
//  Captura inteligente de leads: recebe uma IMAGEM (print, foto de papel/cartão)
//  e/ou um TEXTO solto, manda pro Claude com visão + saída estruturada (JSON)
//  e devolve UM OU VÁRIOS leads prontos pra revisão no CRM.
//
//  SEGURANÇA (camadas):
//   1. A chave da Anthropic vive AQUI, no servidor (secret). Nunca no navegador.
//   2. verify_jwt = ON (padrão do Supabase): só usuário LOGADO (Gustavo/Victor)
//      consegue chamar — visitante anônimo é barrado antes de rodar esta função.
//   3. CORS travado nos domínios do app (não em "*").
//   4. Limites de tamanho no corpo (anti-abuso / anti-estouro de custo).
//   Obs.: a proteção dos DADOS (tabela leads) é via RLS no banco — ver checklist.
//
//  Deploy:   supabase functions deploy capturar-lead
//  Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// ============================================================================

// Modelo: bom em foto/print + custo baixo. Pra trocar é só esta linha:
//   "claude-haiku-4-5"  -> mais barato/rápido (ótimo p/ prints limpos)
//   "claude-opus-4-8"   -> máxima precisão (manuscrito difícil, papel amassado)
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 4096; // pode vir uma lista grande de leads

// Origens autorizadas a chamar do navegador (defesa extra além do verify_jwt).
const ALLOWED_ORIGINS = new Set([
  "https://juca-alt.github.io",
  "http://localhost:8758",
  "http://127.0.0.1:8758",
]);
const MAX_IMG_B64 = 7_500_000; // ~5,5 MB de imagem real (frontend já reduz p/ 1600px)
const MAX_TEXT = 20_000;

function corsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") || "";
  const allow = ALLOWED_ORIGINS.has(origin) ? origin : "https://juca-alt.github.io";
  return {
    "Access-Control-Allow-Origin": allow,
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "content-type": "application/json" },
  });

// Os campos de UM lead. Espelha as colunas do CRM.
const LEAD_PROPS = {
  nome: { type: "string", description: "Nome completo da pessoa" },
  cargo: { type: "string", description: "Cargo, profissão ou headline" },
  empresa: { type: "string", description: "Empresa onde trabalha" },
  telefone: { type: "string", description: "Só os dígitos, com DDD se houver (ex.: 81999998888)" },
  email: { type: "string" },
  cidade: { type: "string" },
  bairro: { type: "string", description: "Bairro e/ou CEP" },
  linkedin_url: { type: "string" },
  renda_estimada: { type: "number", description: "Renda mensal em reais, só se estiver mencionada" },
  origem: {
    type: "string",
    enum: ["LinkedIn", "Rec LP", "Rec OT", "Abordagem Direta"],
    description: "De onde veio o lead, só se der pra inferir com clareza",
  },
  recomendante: { type: "string", description: "Quem indicou, se for uma recomendação" },
  observacoes: {
    type: "string",
    description: "Contexto útil em uma frase: interesse, como se conheceram, melhor horário, etc.",
  },
};

// Saída: SEMPRE uma lista de leads (1 ou vários) + meta.
const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    leads: {
      type: "array",
      description: "Um item por pessoa. Pode ter 1 ou vários. Vazio se não houver ninguém identificável.",
      items: { type: "object", additionalProperties: false, properties: LEAD_PROPS, required: [] },
    },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
    campos_faltando: {
      type: "array",
      items: { type: "string" },
      description: "Campos importantes que ficaram faltando no geral",
    },
  },
  required: ["leads", "confianca", "campos_faltando"],
};

const SYSTEM = [
  "Você é um assistente de CRM que extrai dados de LEADS (potenciais clientes de",
  "planejamento financeiro / seguro de vida, no Brasil) a partir de prints de tela,",
  "fotos de papel ou cartão de visita, ou blocos de texto soltos.",
  "Regras:",
  "- O conteúdo pode ter UM ou VÁRIOS leads (uma lista de indicações, vários cartões,",
  "  um print de grupo de WhatsApp, uma planilha). Extraia TODOS — cada pessoa vira",
  "  um item em 'leads'. Se houver só uma pessoa, devolva 'leads' com um único item.",
  "  Se não houver ninguém identificável, devolva 'leads' vazio.",
  "- Extraia SÓ o que estiver explícito ou claramente inferível. Não invente nada.",
  "- Telefone: devolva apenas os dígitos (com DDD se houver).",
  "- Coloque contexto útil (interesse, como se conheceram, melhor horário) em 'observacoes'.",
  "- Se um campo não aparecer, deixe-o de fora. Cite no 'campos_faltando' o que faltou no geral.",
  "- 'confianca' reflete o quão legível/completo estava o conteúdo (alta/media/baixa).",
].join(" ");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, erro: "Use POST" }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return json(req, { ok: false, erro: "ANTHROPIC_API_KEY não configurada no Supabase" }, 500);

  let payload: { imagem_base64?: string; media_type?: string; texto?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, erro: "Corpo da requisição não é JSON válido" }, 400);
  }

  const imagem = typeof payload?.imagem_base64 === "string" ? payload.imagem_base64 : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!imagem && !texto) {
    return json(req, { ok: false, erro: "Envie uma imagem (imagem_base64) ou um texto" }, 400);
  }
  if (imagem.length > MAX_IMG_B64) {
    return json(req, { ok: false, erro: "Imagem muito grande. Tente uma foto menor." }, 413);
  }
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  // Só aceita media_type de imagem conhecido (não confia cegamente no cliente).
  const mt = payload?.media_type || "image/jpeg";
  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mt) ? mt : "image/jpeg";

  // Monta o conteúdo: imagem (visão) + texto + instrução final.
  const content: unknown[] = [];
  if (imagem) {
    content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imagem } });
  }
  if (texto) content.push({ type: "text", text: "Texto fornecido:\n" + texto });
  content.push({
    type: "text",
    text: "Extraia TODOS os leads do conteúdo acima (um item por pessoa) e responda no formato pedido.",
  });

  let resp: Response;
  try {
    resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        thinking: { type: "disabled" }, // extração simples: mais rápido e barato
        system: SYSTEM,
        messages: [{ role: "user", content }],
        output_config: { format: { type: "json_schema", schema: SCHEMA } },
      }),
    });
  } catch (e) {
    console.error("anthropic fetch falhou:", e);
    return json(req, { ok: false, erro: "Falha de rede ao chamar a IA. Tente de novo." }, 502);
  }

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    // Loga o detalhe no servidor, devolve mensagem enxuta pro cliente (não vaza interno).
    console.error("anthropic erro:", resp.status, data?.error);
    const code = resp.status === 429 ? "Limite de uso atingido. Tente em instantes." : "A IA não conseguiu processar agora.";
    return json(req, { ok: false, erro: code }, 502);
  }
  if (data?.stop_reason === "refusal") {
    return json(req, { ok: false, erro: "A IA recusou a extração desse conteúdo." });
  }

  // Com output_config.format, o 1º bloco de texto é um JSON válido garantido.
  const txt = (data?.content || []).find((b: { type: string }) => b.type === "text")?.text;
  let dados: unknown;
  try {
    dados = JSON.parse(txt);
  } catch {
    return json(req, { ok: false, erro: "A IA não devolveu um JSON válido." });
  }

  return json(req, { ok: true, dados, modelo: MODEL });
});
