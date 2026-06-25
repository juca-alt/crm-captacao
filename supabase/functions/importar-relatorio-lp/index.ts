// ============================================================================
//  Edge Function: importar-relatorio-lp  (Supabase / Deno)  -- motor: GOOGLE GEMINI
//  Le o RELATORIO SEMANAL da Prudential (PDF) de um ou varios Life Planners e
//  devolve, estruturado, as 5 secoes (Atrasos, Pendencias de Emissao, Apolices
//  Emitidas/Status T, Aniversariantes, Aniversarios de Apolice) -- cada uma com
//  o LP dono e suas linhas mapeadas em campos. E o "parser" do nucleo P0.
//
//  Usa o MESMO motor e a MESMA key da capturar-lead (Gemini, free tier) -> nao
//  precisa de secret novo: o GEMINI_API_KEY ja existe no projeto.
//
//  SEGURANCA (mesmas camadas da capturar-lead):
//   1. A chave do Gemini vive AQUI, no servidor (secret). Nunca no navegador.
//   2. verify_jwt = ON: so usuario LOGADO chama.
//   3. CORS travado nos dominios do app.
//   4. Limites de tamanho no corpo.
//
//  Deploy: supabase functions deploy importar-relatorio-lp
//  Secret: GEMINI_API_KEY (ja configurado p/ a capturar-lead)
// ============================================================================

// Modelo free tier (sem cartao), com PDF/visao. Pra trocar e so esta linha:
//   "gemini-2.5-flash-lite" -> mais barato/rapido   |   "gemini-3.5-flash" -> mais novo/capaz
const MODEL = "gemini-2.5-flash";
const MAX_OUTPUT_TOKENS = 8192; // o relatorio pode ter dezenas de linhas por secao

const ALLOWED_ORIGINS = new Set([
  "https://juca-alt.github.io",
  "http://localhost:8758",
  "http://127.0.0.1:8758",
]);
const MAX_PDF_B64 = 14_000_000; // PDF ~10 MB inline
const MAX_TEXT = 60_000;        // fallback: texto colado do relatorio

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

// Sem responseSchema (ambiguo entre versoes do Gemini): descrevo o JSON no prompt
// e forco JSON com responseMimeType. Mesma estrategia da capturar-lead.
const SYSTEM = [
  "Voce extrai dados do RELATORIO SEMANAL da Prudential, organizado por Life Planner (LP).",
  "O relatorio tem secoes; cada secao pertence a UM LP e e de UM dos 5 tipos abaixo,",
  "identificado pelo TITULO da secao (padrao '{TIPO} - {NOME DO LP}', ex.: 'ATRASOS - DANIEL CRUZ'):",
  "- 'ATRASOS' (lista de atraso) -> tipo ATRASOS",
  "- 'PENDENCIAS DE EMISSAO' -> tipo PENDENCIAS",
  "- 'APOLICES EMITIDAS' (status T) -> tipo STATUS_T",
  "- 'ANIVERSARIANTES DO MES' -> tipo ANIVERSARIO",
  "- 'ANIVERSARIOS DE APOLICE' (datas importantes) -> tipo DATAS_IMPORTANTES",
  "Regras:",
  "- Extraia TODAS as secoes de TODOS os LPs do arquivo. Um mesmo arquivo pode ter varios LPs.",
  "- Para cada secao, extraia TODAS as linhas e mapeie cada coluna no campo certo.",
  "- 'lp' e o nome do LP do cabecalho da secao (sem o tipo). Mantenha como esta escrito.",
  "- Celulas multi-linha: junte as quebras num valor so (ex.: um nome que quebrou em 2 linhas).",
  "- Pule linhas totalmente vazias. Se a secao so tiver cabecalho, devolva 'linhas' vazio (mas devolva a secao).",
  "- Datas: devolva no formato YYYY-MM-DD. Em aniversario sem ano, use MM-DD.",
  "- Valores (premio) e dias: devolva so os numeros, sem 'R$' nem '%'.",
  "- Nao invente. Se um campo nao existe na linha, omita a chave. Anote em 'avisos' o que ficou ambiguo.",
  "",
  "Campos por tipo (inclua so os que existirem na linha):",
  "- ATRASOS: dias_atraso(num), apolice, pagador, segurado, telefone, forma_pag, premio(num), motivo",
  "- PENDENCIAS: proposta, apolice, cliente, assinatura_ccb, pendencia",
  "- STATUS_T: mes, proposta, apolice, segurado, pagador, data_emissao, data_30dias, data_2o_premio",
  "- ANIVERSARIO: cliente, data_nasc, telefone",
  "- DATAS_IMPORTANTES: mes, apolice, data_emissao, cliente, telefone",
  "",
  "Responda SOMENTE com um JSON valido neste formato, sem nenhum texto fora dele:",
  '{"secoes":[{"tipo":"ATRASOS","lp":"NOME DO LP","linhas":[{"dias_atraso":0,"apolice":"","segurado":"","pagador":"","telefone":"","forma_pag":"","premio":0,"motivo":""}]}],"confianca":"alta","avisos":[]}',
  "tipo deve ser exatamente um de: ATRASOS, PENDENCIAS, STATUS_T, ANIVERSARIO, DATAS_IMPORTANTES.",
  "confianca: alta, media ou baixa (o quao legivel/integro estava o PDF).",
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

  // Aceita variacoes comuns do nome do secret (mesma key da capturar-lead).
  const KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("Gemini API Key") ||
    Deno.env.get("GEMINI_KEY") || Deno.env.get("GOOGLE_API_KEY") ||
    Deno.env.get("GOOGLE_GEMINI_API_KEY") || Deno.env.get("GEMINI");
  if (!KEY) return json(req, { ok: false, erro: "Nenhuma key do Gemini encontrada nos secrets (esperado: GEMINI_API_KEY)" }, 500);

  let payload: { pdf_base64?: string; texto?: string; imagem_base64?: string; media_type?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, erro: "Corpo da requisicao nao e JSON valido" }, 400);
  }

  const pdf = typeof payload?.pdf_base64 === "string" ? payload.pdf_base64 : "";
  const imagem = typeof payload?.imagem_base64 === "string" ? payload.imagem_base64 : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!pdf && !imagem && !texto) {
    return json(req, { ok: false, erro: "Envie um PDF (pdf_base64), uma imagem ou um texto" }, 400);
  }
  if (pdf.length > MAX_PDF_B64) {
    return json(req, { ok: false, erro: "PDF muito grande (max ~10 MB). Divida o relatorio." }, 413);
  }
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  const mt = payload?.media_type || "image/jpeg";
  const mediaType = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"].includes(mt) ? mt : "image/jpeg";

  // Monta as parts: PDF + imagem (opcional) + texto + instrucao final.
  const parts: unknown[] = [];
  if (pdf) parts.push({ inline_data: { mime_type: "application/pdf", data: pdf } });
  if (imagem) parts.push({ inline_data: { mime_type: mediaType, data: imagem } });
  if (texto) parts.push({ text: "Texto do relatorio:\n" + texto });
  parts.push({ text: "Extraia TODAS as secoes de TODOS os LPs do relatorio acima e responda SOMENTE com o JSON pedido." });

  const GURL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const geminiBody = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS },
  });

  // Tenta ate 3x: o free tier do Gemini as vezes responde 503 "high demand" (transiente).
  let resp: Response | null = null;
  for (let i = 0; i < 3; i++) {
    try {
      resp = await fetch(GURL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEY },
        body: geminiBody,
      });
    } catch (e) {
      console.error("gemini fetch falhou:", e);
      if (i === 2) return json(req, { ok: false, erro: "Falha de rede ao chamar a IA. Tente de novo." }, 502);
      await new Promise((r) => setTimeout(r, 700 * (i + 1)));
      continue;
    }
    if (resp.ok || (resp.status !== 503 && resp.status !== 429 && resp.status !== 500)) break;
    if (i < 2) await new Promise((r) => setTimeout(r, 700 * (i + 1)));
  }
  if (!resp) return json(req, { ok: false, erro: "Falha ao chamar a IA. Tente de novo." }, 502);

  const data = await resp.json().catch(() => null);
  if (!resp.ok) {
    console.error("gemini erro:", resp.status, JSON.stringify(data?.error || data));
    const code = (resp.status === 429 || resp.status === 503)
      ? "A IA esta com alta demanda agora. Tente de novo em instantes."
      : "A IA nao conseguiu processar agora.";
    return json(req, { ok: false, erro: code }, 502);
  }

  const blocked = data?.promptFeedback?.blockReason;
  const cand = data?.candidates?.[0];
  if (blocked || !cand) {
    console.error("gemini sem candidato:", JSON.stringify(data?.promptFeedback || data).slice(0, 400));
    return json(req, { ok: false, erro: "A IA nao retornou resultado pra esse arquivo." });
  }

  const txt = (cand?.content?.parts || []).map((p: { text?: string }) => p?.text || "").join("").trim();
  const dados = extractJson(txt);
  if (!dados) {
    console.error("gemini json invalido. finishReason:", cand?.finishReason, "| txt:", (txt || "").slice(0, 300));
    return json(req, { ok: false, erro: "A IA nao devolveu um JSON valido." });
  }

  return json(req, { ok: true, dados, modelo: MODEL });
});
