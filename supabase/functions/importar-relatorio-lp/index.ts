// ============================================================================
//  Edge Function: importar-relatorio-lp  (Supabase / Deno)
//  Lê o RELATÓRIO SEMANAL da Prudential (PDF) de um ou vários Life Planners e
//  devolve, estruturado, as 5 seções do relatório (Atrasos, Pendências de
//  Emissão, Apólices Emitidas/Status T, Aniversariantes, Aniversários de
//  Apólice) — cada uma com o LP dono e suas linhas já mapeadas em campos.
//
//  É o "parser" do núcleo P0: PDF -> JSON normalizado. A mecânica de upsert
//  (preservar status por chave, snapshot por LP) fica no app (vendas.html).
//
//  SEGURANÇA (mesmas camadas da capturar-lead):
//   1. A chave da Anthropic vive AQUI, no servidor (secret). Nunca no navegador.
//   2. verify_jwt = ON: só usuário LOGADO chama (visitante anônimo barrado).
//   3. CORS travado nos domínios do app.
//   4. Limite de tamanho no corpo (anti-abuso / anti-estouro de custo).
//
//  Deploy:   supabase functions deploy importar-relatorio-lp
//  Secret:   supabase secrets set ANTHROPIC_API_KEY=sk-ant-...   (já existe se
//            a capturar-lead foi publicada — o secret é compartilhado)
// ============================================================================

// Relatório com tabelas densas: Sonnet equilibra precisão/custo. Pra trocar:
//   "claude-haiku-4-5"  -> mais barato/rápido (relatórios limpos e bem tabulados)
//   "claude-opus-4-8"   -> máxima precisão (PDF escaneado/ruidoso, muitas páginas)
const MODEL = "claude-sonnet-4-6";
const MAX_TOKENS = 8192; // o relatório pode ter dezenas de linhas por seção

const ALLOWED_ORIGINS = new Set([
  "https://juca-alt.github.io",
  "http://localhost:8758",
  "http://127.0.0.1:8758",
]);
const MAX_PDF_B64 = 26_000_000; // ~19 MB de PDF real (limite Anthropic é 32 MB)
const MAX_TEXT = 200_000;       // fallback: texto colado de um relatório

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

// União de TODOS os campos possíveis de uma linha (todos opcionais). O modelo
// preenche só os que existem para o tipo da seção — ver §Schemas do brief.
// Chaves de upsert: apolice (BackOffice) · cliente (Aniversário/Datas).
const LINHA_PROPS = {
  // — Atrasos —
  dias_atraso: { type: "number", description: "Dias em atraso (só ATRASOS). Número inteiro." },
  pagador: { type: "string", description: "Nome do pagador" },
  segurado: { type: "string", description: "Nome do segurado" },
  forma_pag: { type: "string", description: "Forma de pagamento (Cartão, Boleto, Débito, etc.)" },
  premio: { type: "number", description: "Prêmio em reais, só os números (ex.: 312.50)" },
  motivo: { type: "string", description: "Motivo do atraso / RETORNO COBRANÇA, texto literal do PDF" },
  // — Pendências —
  proposta: { type: "string", description: "Número da proposta" },
  assinatura_ccb: { type: "string", description: "Status/data da assinatura da CCB" },
  pendencia: { type: "string", description: "O que está pendente, texto literal" },
  // — comuns Pendências / Status T / Datas —
  apolice: { type: "string", description: "Número da apólice (chave de upsert no BackOffice)" },
  cliente: { type: "string", description: "Nome do cliente (chave de upsert em Aniversário/Datas)" },
  // — Status T (apólices emitidas) —
  mes: { type: "string", description: "Mês de referência" },
  data_emissao: { type: "string", description: "Data de emissão, formato YYYY-MM-DD" },
  data_30dias: { type: "string", description: "Data dos 30 dias, formato YYYY-MM-DD" },
  data_2o_premio: { type: "string", description: "Data do 2º prêmio, formato YYYY-MM-DD" },
  // — Aniversariantes / Datas importantes —
  data_nasc: { type: "string", description: "Data de nascimento. YYYY-MM-DD se houver ano, senão MM-DD" },
  telefone: { type: "string", description: "Telefone, só os dígitos com DDD" },
};

const SECAO_TIPOS = ["ATRASOS", "PENDENCIAS", "STATUS_T", "ANIVERSARIO", "DATAS_IMPORTANTES"];

const SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    secoes: {
      type: "array",
      description: "Uma entrada por seção encontrada no relatório (por LP e por tipo).",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          tipo: { type: "string", enum: SECAO_TIPOS, description: "Tipo da seção pelo título" },
          lp: { type: "string", description: "Nome do Life Planner dono da seção (do cabeçalho)" },
          linhas: {
            type: "array",
            description: "Uma linha por registro. Vazio se a seção só tiver cabeçalho.",
            items: { type: "object", additionalProperties: false, properties: LINHA_PROPS, required: [] },
          },
        },
        required: ["tipo", "lp", "linhas"],
      },
    },
    confianca: { type: "string", enum: ["alta", "media", "baixa"] },
    avisos: { type: "array", items: { type: "string" }, description: "Problemas de leitura (página borrada, coluna ambígua, etc.)" },
  },
  required: ["secoes", "confianca", "avisos"],
};

const SYSTEM = [
  "Você extrai dados do RELATÓRIO SEMANAL da Prudential, organizado por Life Planner (LP).",
  "O relatório tem seções; cada seção pertence a UM LP e é de UM dos 5 tipos abaixo,",
  "identificado pelo TÍTULO da seção (padrão '{TIPO} — {NOME DO LP}', ex.: 'ATRASOS — DANIEL CRUZ'):",
  "- 'ATRASOS' (lista de atraso) -> tipo ATRASOS",
  "- 'PENDÊNCIAS DE EMISSÃO' -> tipo PENDENCIAS",
  "- 'APÓLICES EMITIDAS' (status T) -> tipo STATUS_T",
  "- 'ANIVERSARIANTES DO MÊS' -> tipo ANIVERSARIO",
  "- 'ANIVERSÁRIOS DE APÓLICE' (datas importantes) -> tipo DATAS_IMPORTANTES",
  "Regras:",
  "- Extraia TODAS as seções de TODOS os LPs do arquivo. Um mesmo arquivo pode ter vários LPs.",
  "- Para cada seção, extraia TODAS as linhas e mapeie cada coluna no campo certo da linha.",
  "- 'lp' é o nome do LP do cabeçalho da seção (sem o tipo). Mantenha o nome como está escrito.",
  "- Células multi-linha: junte as quebras num valor só (ex.: um nome que quebrou em 2 linhas).",
  "- Pule linhas totalmente vazias. Se a seção só tiver o cabeçalho, devolva 'linhas' vazio (mas devolva a seção).",
  "- Datas: devolva no formato YYYY-MM-DD. Em aniversário sem ano, use MM-DD.",
  "- Valores (prêmio) e dias: devolva só os números, sem 'R$', sem '%'.",
  "- Não invente. Se um campo não existe na linha, deixe de fora. Anote em 'avisos' o que ficou ambíguo.",
  "- 'confianca' reflete a legibilidade/integridade do PDF (alta/media/baixa).",
].join(" ");

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, erro: "Use POST" }, 405);

  const KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!KEY) return json(req, { ok: false, erro: "ANTHROPIC_API_KEY não configurada no Supabase" }, 500);

  let payload: { pdf_base64?: string; texto?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, erro: "Corpo da requisição não é JSON válido" }, 400);
  }

  const pdf = typeof payload?.pdf_base64 === "string" ? payload.pdf_base64 : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!pdf && !texto) {
    return json(req, { ok: false, erro: "Envie um PDF (pdf_base64) ou um texto" }, 400);
  }
  if (pdf.length > MAX_PDF_B64) {
    return json(req, { ok: false, erro: "PDF muito grande. Tente um arquivo menor ou divida o relatório." }, 413);
  }
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  const content: unknown[] = [];
  if (pdf) {
    content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  }
  if (texto) content.push({ type: "text", text: "Texto do relatório:\n" + texto });
  content.push({
    type: "text",
    text: "Extraia TODAS as seções de TODOS os LPs do relatório acima e responda no formato pedido.",
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
        thinking: { type: "disabled" },
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
    console.error("anthropic erro:", resp.status, data?.error);
    const code = resp.status === 429 ? "Limite de uso atingido. Tente em instantes." : "A IA não conseguiu processar agora.";
    return json(req, { ok: false, erro: code }, 502);
  }
  if (data?.stop_reason === "refusal") {
    return json(req, { ok: false, erro: "A IA recusou a leitura desse arquivo." });
  }

  const txt = (data?.content || []).find((b: { type: string }) => b.type === "text")?.text;
  let dados: unknown;
  try {
    dados = JSON.parse(txt);
  } catch {
    return json(req, { ok: false, erro: "A IA não devolveu um JSON válido." });
  }

  return json(req, { ok: true, dados, modelo: MODEL });
});
