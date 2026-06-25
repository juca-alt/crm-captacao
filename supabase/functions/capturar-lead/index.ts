// ============================================================================
//  Edge Function: capturar-lead  (Supabase / Deno)  -- motor: GOOGLE GEMINI
//  Captura inteligente de leads: recebe IMAGEM (print/foto de papel/cartao),
//  PDF e/ou TEXTO solto, manda pro Gemini com visao + JSON, e devolve
//  UM OU VARIOS leads prontos pra revisao no CRM.
//
//  SEGURANCA (camadas):
//   1. A chave do Gemini vive AQUI, no servidor (secret GEMINI_API_KEY). Nunca no navegador.
//   2. verify_jwt = ON (padrao do Supabase): so usuario LOGADO consegue chamar.
//   3. CORS travado nos dominios do app (nao em "*").
//   4. Limites de tamanho no corpo (anti-abuso / anti-estouro).
//   Obs.: a protecao dos DADOS (tabela leads) e via RLS no banco.
//
//  Deploy: cole no editor de Edge Functions do Supabase (funcao "capturar-lead").
//  Secret: GEMINI_API_KEY = sua key do Google AI Studio (https://aistudio.google.com/apikey)
//          -- o free tier nao exige cartao.
// ============================================================================

// Modelo: free tier (sem cartao), com visao + PDF. Pra trocar e so esta linha:
//   "gemini-2.5-flash-lite" -> mais barato/rapido    |   "gemini-3.5-flash" -> mais novo/capaz
const MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 4096; // pode vir uma lista grande de leads

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

// Sem responseSchema (formato de tipo e ambiguo entre versoes): descrevo o JSON
// no prompt e forco JSON com responseMimeType. Mais robusto sem poder testar.
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
  "Responda SOMENTE com um JSON valido neste formato, sem nenhum texto fora dele:",
  '{"leads":[{"nome":"","cargo":"","empresa":"","telefone":"","email":"","cidade":"","bairro":"","linkedin_url":"","renda_estimada":0,"origem":"LinkedIn","recomendante":"","observacoes":""}],"confianca":"alta","campos_faltando":[]}',
  "Em cada lead inclua SO os campos encontrados (omita as chaves dos demais).",
  "origem deve ser exatamente um de: LinkedIn, Rec LP, Rec OT, Abordagem Direta (apenas se inferir com clareza).",
  "confianca: alta, media ou baixa (o quao legivel/completo estava o conteudo).",
  "campos_faltando: lista de campos importantes que faltaram no geral.",
].join("\n");

// Parser tolerante: tenta JSON puro; senao, recorta do primeiro { ao ultimo }.
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

  const KEY = Deno.env.get("GEMINI_API_KEY");
  if (!KEY) return json(req, { ok: false, erro: "GEMINI_API_KEY nao configurada no Supabase" }, 500);

  let payload: { imagem_base64?: string; media_type?: string; texto?: string; pdf_base64?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, erro: "Corpo da requisicao nao e JSON valido" }, 400);
  }

  const imagem = typeof payload?.imagem_base64 === "string" ? payload.imagem_base64 : "";
  const pdf = typeof payload?.pdf_base64 === "string" ? payload.pdf_base64 : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!imagem && !pdf && !texto) {
    return json(req, { ok: false, erro: "Envie uma imagem, um PDF ou um texto" }, 400);
  }
  if (imagem.length > MAX_IMG_B64) return json(req, { ok: false, erro: "Imagem muito grande. Tente uma foto menor." }, 413);
  if (pdf.length > MAX_PDF_B64) return json(req, { ok: false, erro: "PDF muito grande (max ~10 MB)." }, 413);
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  const mt = payload?.media_type || "image/jpeg";
  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(mt) ? mt : "image/jpeg";

  // Monta as parts: imagem (visao) + PDF + texto + instrucao final.
  const parts: unknown[] = [];
  if (imagem) parts.push({ inline_data: { mime_type: mediaType, data: imagem } });
  if (pdf) parts.push({ inline_data: { mime_type: "application/pdf", data: pdf } });
  if (texto) parts.push({ text: "Texto fornecido:\n" + texto });
  parts.push({ text: "Extraia TODOS os leads do conteudo acima (um item por pessoa) e responda SOMENTE com o JSON pedido." });

  let resp: Response;
  try {
    resp = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": KEY },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{ role: "user", parts }],
        generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS },
      }),
    });
  } catch (e) {
    console.error("gemini fetch falhou:", e);
    return json(req, { ok: false, erro: "Falha de rede ao chamar a IA. Tente de novo." }, 502);
  }

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    console.error("gemini erro:", resp.status, JSON.stringify(data?.error || data));
    const code = resp.status === 429 ? "Limite de uso atingido. Tente em instantes." : "A IA nao conseguiu processar agora.";
    return json(req, { ok: false, erro: code }, 502);
  }

  // Bloqueio de seguranca / sem candidato
  const blocked = data?.promptFeedback?.blockReason;
  const cand = data?.candidates?.[0];
  if (blocked || !cand) {
    console.error("gemini sem candidato:", JSON.stringify(data?.promptFeedback || data).slice(0, 400));
    return json(req, { ok: false, erro: "A IA nao retornou resultado pra esse conteudo." });
  }

  const txt = (cand?.content?.parts || []).map((p: { text?: string }) => p?.text || "").join("").trim();
  const dados = extractJson(txt);
  if (!dados) {
    console.error("gemini json invalido. finishReason:", cand?.finishReason, "| txt:", (txt || "").slice(0, 300));
    return json(req, { ok: false, erro: "A IA nao devolveu um JSON valido." });
  }

  return json(req, { ok: true, dados, modelo: MODEL });
});
