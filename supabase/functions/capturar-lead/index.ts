// ============================================================================
//  Edge Function: capturar-lead  (Supabase / Deno)  -- motor: CLAUDE (Anthropic) desde 26/10/2026 (antes: Gemini)
//  Captura inteligente de leads: recebe IMAGEM (print/foto de papel/cartao),
//  PDF e/ou TEXTO solto, manda pro Claude (visao + PDF + ferramenta com schema) e devolve
//  UM OU VARIOS leads prontos pra revisao no CRM.
//
//  SEGURANCA (camadas):
//   1. A chave da Anthropic vive AQUI, no servidor (secret ANTHROPIC_API_KEY). Nunca no navegador.
//   2. verify_jwt = ON (padrao do Supabase): so usuario LOGADO consegue chamar.
//   3. CORS travado nos dominios do app (nao em "*").
//   4. Limites de tamanho no corpo (anti-abuso / anti-estouro).
//   Obs.: a protecao dos DADOS (tabela leads) e via RLS no banco.
//
//  Deploy: cole no editor de Edge Functions do Supabase (funcao "capturar-lead").
//  Secret: ANTHROPIC_API_KEY (mesmo do copiloto-sugerir). Opcional: CAPTURA_MODELO.
//  Saida IGUAL a da versao Gemini: { ok, dados:{leads,confianca,campos_faltando}, modelo } — o app nao muda.
// ============================================================================

// Motor: CLAUDE (troca decidida pelo Gustavo em 26/10/2026 — "IA A": um provedor só, a chave da Anthropic já está nos secrets).
// Modelo: secret CAPTURA_MODELO (padrão claude-opus-5-5 — melhor leitura de foto/PDF; ~US$ 0,03 por leitura).
// Pra baratear, troque o secret pra claude-haiku-5-5 (~US$ 0,002).
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
const MODEL = Deno.env.get("CAPTURA_MODELO") || "claude-opus-5-5";
const MAX_OUTPUT_TOKENS = 8000; // pode vir uma lista grande de leads

// Origens autorizadas a chamar do navegador (defesa extra alem do verify_jwt).
const ALLOWED_ORIGINS = new Set([
  "https://juca-alt.github.io",
  "http://localhost:8758",
  "http://127.0.0.1:8758",
]);
const MAX_IMG_B64 = 7_500_000; // imagem ~5,5 MB (frontend ja reduz p/ 1600px)
const MAX_PDF_B64 = 14_000_000; // PDF ~10 MB inline
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

// O formato vem da ferramenta entregar_leads (strict). O texto abaixo descreve as regras de extracao.
const SYSTEM = [
  "Voce e um assistente de CRM que extrai dados de LEADS (potenciais clientes de",
  "planejamento financeiro / seguro de vida, no Brasil) a partir de prints de tela,",
  "fotos de papel ou cartao de visita, PDFs, ou blocos de texto soltos.",
  "Regras:",
  "- O conteudo pode ter UM ou VARIOS leads (lista de indicacoes, varios cartoes,",
  "  print de grupo de WhatsApp, planilha, PDF). Extraia TODOS - cada pessoa vira um item.",
  "- Extraia SO o que estiver explicito ou claramente inferivel. Nao invente nada.",
  "- Telefone: devolva apenas os digitos (com DDD se houver).",
  "- Contexto util (interesse, como se conheceram, melhor horario) vai em observacoes.",
  "- Se nao houver ninguem identificavel, devolva leads vazio.",
  "",
  "Entregue o resultado chamando a ferramenta entregar_leads exatamente uma vez.",
  "Campo nao encontrado = texto vazio (\"\") ou 0 na renda_estimada. Nunca invente.",
  "origem deve ser exatamente um de: LinkedIn, Rec LP, Rec OT, Rec Cliente, Rec Familiar, Instagram, Facebook, Abordagem Direta (apenas se inferir com clareza).",
  "Dicas de origem: 'Rec LP' = indicado por um Life Planner; 'Rec OT' = indicado por cliente/OT; 'Rec Cliente' = indicado por um cliente; 'Rec Familiar' = indicado por familiar; 'Instagram'/'Facebook' = veio dessas redes. Em qualquer 'Rec ...' preencha 'recomendante' com quem indicou.",
  "confianca: alta, media ou baixa (o quao legivel/completo estava o conteudo).",
  "campos_faltando: lista de campos importantes que faltaram no geral.",
].join("\n");


const CAMPOS = ["nome", "cargo", "empresa", "telefone", "email", "cidade", "bairro", "linkedin_url", "origem", "recomendante", "observacoes"] as const;
const ORIGENS = ["", "LinkedIn", "Rec LP", "Rec OT", "Rec Cliente", "Rec Familiar", "Instagram", "Facebook", "Abordagem Direta"];
const TOOL = {
  name: "entregar_leads",
  description: "Entrega os leads extraidos do conteudo. Chame exatamente uma vez, mesmo se a lista vier vazia.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["leads", "confianca", "campos_faltando"],
    properties: {
      leads: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: [...CAMPOS, "renda_estimada"],
          properties: {
            ...Object.fromEntries(CAMPOS.map((k) => [k, k === "origem" ? { type: "string", enum: ORIGENS } : { type: "string" }])),
            renda_estimada: { type: "number" },
          },
        },
      },
      confianca: { type: "string", enum: ["alta", "media", "baixa"] },
      campos_faltando: { type: "array", items: { type: "string" } },
    },
  },
} as const;

// Saida igual a da versao Gemini: em cada lead so os campos encontrados (vazio/0 sai fora).
function limpar(d: any) {
  const leads = (Array.isArray(d?.leads) ? d.leads : []).map((l: any) => {
    const o: Record<string, unknown> = {};
    for (const k of CAMPOS) { const v = String(l?.[k] ?? "").trim(); if (v) o[k] = k === "telefone" ? v.replace(/\D/g, "") : v; }
    const r = Number(l?.renda_estimada); if (isFinite(r) && r > 0) o.renda_estimada = r;
    return o;
  }).filter((o: Record<string, unknown>) => Object.keys(o).length);
  return { leads, confianca: ["alta", "media", "baixa"].includes(d?.confianca) ? d.confianca : "media", campos_faltando: Array.isArray(d?.campos_faltando) ? d.campos_faltando.map(String).slice(0, 20) : [] };
}

// Parser tolerante (reserva: se o modelo responder em texto em vez da ferramenta): tenta JSON puro; senao, recorta do primeiro { ao ultimo }.
function extractJson(txt: string): unknown {
  if (!txt) return null;
  try {
    return JSON.parse(txt);
  } catch { /* tenta recorte */ }
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a >= 0 && b > a) {
    try {
      return JSON.parse(txt.slice(a, b + 1));
    } catch { /* desiste */ }
  }
  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, erro: "Use POST" }, 405);

  const KEY = String(Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!KEY) return json(req, { ok: false, erro: "Chave da Anthropic nao encontrada nos secrets (esperado: ANTHROPIC_API_KEY)" }, 500);

  let payload: { imagem_base64?: string; media_type?: string; texto?: string; pdf_base64?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, erro: "Corpo da requisicao nao e JSON valido" }, 400);
  }

  const imagem = typeof payload?.imagem_base64 === "string" ? payload.imagem_base64.replace(/\s/g, "") : "";
  const pdf = typeof payload?.pdf_base64 === "string" ? payload.pdf_base64.replace(/\s/g, "") : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!imagem && !pdf && !texto) {
    return json(req, { ok: false, erro: "Envie uma imagem, um PDF ou um texto" }, 400);
  }
  if (imagem.length > MAX_IMG_B64) return json(req, { ok: false, erro: "Imagem muito grande. Tente uma foto menor." }, 413);
  if (pdf.length > MAX_PDF_B64) return json(req, { ok: false, erro: "PDF muito grande (max ~10 MB)." }, 413);
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  // O Claude le jpeg/png/gif/webp. O app ja manda jpeg (reduz pra 1600px); outro tipo cai em jpeg como antes.
  const mt = payload?.media_type || "image/jpeg";
  const mediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mt) ? mt : "image/jpeg") as "image/jpeg";

  const content: any[] = [];
  if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  if (imagem) content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imagem } });
  if (texto) content.push({ type: "text", text: "Texto fornecido:\n" + texto });
  content.push({ type: "text", text: "Extraia TODOS os leads do conteudo acima (um item por pessoa) e chame entregar_leads." });

  const client = new Anthropic({ apiKey: KEY, timeout: 90_000, maxRetries: 1 });
  let r: any;
  try {
    r = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM,
      tools: [TOOL as any],
      tool_choice: { type: "auto" },          // Opus 5.5 recusa tool_choice forcado; strict garante o formato
      output_config: { effort: "low" },
      messages: [{ role: "user", content }],
    } as any);
  } catch (e: any) {
    if (e instanceof Anthropic.AuthenticationError) return json(req, { ok: false, erro: "Chave da Anthropic invalida — confira o ANTHROPIC_API_KEY." }, 500);
    if (e instanceof Anthropic.RateLimitError) return json(req, { ok: false, erro: "Muitas leituras seguidas. Tente de novo em instantes." }, 429);
    if (e instanceof Anthropic.APIConnectionTimeoutError) return json(req, { ok: false, erro: "A IA demorou demais. Tente de novo." }, 504);
    if (e instanceof Anthropic.APIError) { console.error("anthropic", e.status, e.message); return json(req, { ok: false, erro: "A IA nao conseguiu processar agora.", detalhe: `${e.status ?? "?"} ${String(e.message || "").slice(0, 200)}` }, 502); }
    console.error("captura", e); return json(req, { ok: false, erro: "Falha ao chamar a IA. Tente de novo." }, 502);
  }
  if (r.stop_reason === "refusal") return json(req, { ok: false, erro: "A IA nao retornou resultado pra esse conteudo." });
  if (r.stop_reason === "max_tokens") return json(req, { ok: false, erro: "Lista grande demais pra uma leitura so. Divida em partes." });

  const bloco = (r.content || []).find((b: any) => b.type === "tool_use" && b.name === TOOL.name);
  let bruto: unknown = bloco?.input;
  if (!bruto) {
    const txt = (r.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    bruto = extractJson(txt);
  }
  if (!bruto) {
    console.error("captura sem resultado. stop:", r.stop_reason);
    return json(req, { ok: false, erro: "A IA nao devolveu um JSON valido." });
  }
  return json(req, { ok: true, dados: limpar(bruto), modelo: MODEL });
});
