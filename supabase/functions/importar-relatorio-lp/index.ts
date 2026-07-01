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
const MODEL = "gemini-2.5-flash-lite";
// Um relatorio real (3 LPs, ~147 linhas) gera ~6.6k-9.9k tokens de JSON de SAIDA e
// estourava o antigo teto de 8192 -> Gemini cortava em finishReason:MAX_TOKENS -> JSON
// nao fechava -> "JSON invalido". 32768 da ~3-4x de folga (o flash-lite aceita ate 64k
// de saida) e cobre relatorios com mais LPs. Se um dia estourar isso tambem, a checagem
// de finishReason abaixo devolve erro claro (dai o caminho e chunk por LP/secao).
const MAX_OUTPUT_TOKENS = 32768;

const ALLOWED_ORIGINS = new Set([
  "https://juca-alt.github.io",
  "http://localhost:8758",
  "http://127.0.0.1:8758",
]);
const MAX_PDF_B64 = 14_000_000; // PDF ~10 MB inline
const MAX_TEXT = 250_000;       // texto extraido do PDF (pdf.js no cliente) pode ser grande c/ varios LPs

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
  "O texto vem de um PDF de varias paginas com VARIAS TABELAS por LP. Um arquivo tem VARIOS LPs",
  "(ex.: GUSTAVO JUCA, REBECA FERRAZ, DANIEL CRUZ). Cada tabela tem um TITULO no padrao",
  "'{TIPO} - {NOME DO LP}' que costuma aparecer ABAIXO da tabela e pode ter uma data na frente",
  "(ex.: '22/06/2026  ATRASOS - GUSTAVO JUCA'). 'lp' = so o nome do LP (sem a data e sem o tipo).",
  "",
  "Identifique o TIPO de cada tabela pelo titulo E pelas COLUNAS do cabecalho (acima das linhas):",
  "- ATRASOS  (titulo 'ATRASOS' OU 'APOLICES EMITIDAS' - ambos usam as MESMAS colunas de cobranca):",
  "    cabecalho 'DIAS | APOLICE | RESPONSAVEL PELO PAGAMENTO | SEGURADO | NUMERO(telefone) |",
  "    PERIODICIDADE | FORMA PAG | MES/ANO | RETORNO COBRANCA | PREMIO'.",
  "    -> campos: dias_atraso, apolice, pagador(=responsavel pelo pagamento), segurado, telefone,",
  "       forma_pag, motivo(=retorno cobranca), premio.  (As duas tabelas viram tipo ATRASOS.)",
  "- PENDENCIAS  (titulo 'PENDENCIAS DE EMISSAO'): cabecalho 'PROPOSTA | APOLICE | CLIENTE |",
  "    ASSINATURA CCB | PENDENCIAS'. -> campos: proposta, apolice, cliente, assinatura_ccb, pendencia.",
  "- STATUS_T  (tabela com cabecalho 'MES | PROPOSTA | APOLICE | SEGURADO | RESP. PELO PAGAMENTO |",
  "    STATUS | DATA DE EMISSAO | 30 DIAS | SEGUNDO PREMIO' - apolices emitidas no prazo de status T):",
  "    -> campos: mes, proposta, apolice, segurado, pagador(=resp pelo pagamento), status,",
  "       data_emissao, data_30dias(=coluna '30 DIAS'), data_2o_premio(=coluna 'SEGUNDO PREMIO').",
  "- ANIVERSARIO  (titulo 'ANIVERSARIANTES DO MES'): cabecalho 'DATA DE NASCIMENTO | CLIENTE |",
  "    TELEFONE'. -> campos: data_nasc, cliente, telefone.",
  "- DATAS_IMPORTANTES  (titulo 'ANIVERSARIOS DE APOLICE'): cabecalho 'MES | APOLICE | DATA EMISSAO |",
  "    CLIENTE | TELEFONE'. -> campos: mes, apolice, data_emissao, cliente, telefone.",
  "",
  "Regras:",
  "- Extraia TODAS as tabelas de TODOS os LPs. Cada (LP, tipo) vira uma entrada em 'secoes'.",
  "- Mapeie cada coluna no campo certo pela ORDEM/cabecalho. Pule linhas de cabecalho e legendas",
  "  (ex.: 'PRAZOS P/ STATUS T', '30 dias', 'JUNHO', 'JULHO') - nao sao registros.",
  "- Nomes que quebram em 2 linhas (ex.: 'MARCUS TULIO JOSE DO PRADO\\nCUNHA'): junte num valor so.",
  "- Datas: SEMPRE no formato YYYY-MM-DD (o relatorio usa DD/MM/YYYY -> converta, ex.: 30/06/1970 -> 1970-06-30).",
  "- premio: numero com ponto decimal (o relatorio usa virgula, ex.: '272,54' -> 272.54). Sem 'R$'.",
  "- dias_atraso: numero inteiro.",
  "- Se uma secao so tiver cabecalho (sem linhas), devolva a secao com 'linhas' vazio.",
  "- Nao invente. Campo ausente -> omita a chave. Coisa ambigua -> anote em 'avisos'.",
  "",
  "Responda SOMENTE com um JSON valido neste formato, sem nenhum texto fora dele:",
  '{"secoes":[{"tipo":"ATRASOS","lp":"GUSTAVO JUCA","linhas":[{"dias_atraso":49,"apolice":"1685046","pagador":"FELIPE LEONARDO LUIZ DA SILVA","segurado":"FELIPE LEONARDO LUIZ DA SILVA","telefone":"(81) 98175-2675","forma_pag":"MASTERCARD","motivo":"DADOS DO CARTAO EXPIRADOS/BLOQUEADOS - CONTATE O BANCO EMISSOR","premio":272.54}]}],"confianca":"alta","avisos":[]}',
  "tipo deve ser exatamente um de: ATRASOS, PENDENCIAS, STATUS_T, ANIVERSARIO, DATAS_IMPORTANTES.",
  "confianca: alta, media ou baixa (o quao legivel/integro estava o relatorio).",
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
    // finishReason MAX_TOKENS = a SAIDA estourou o teto e o JSON veio cortado (nao fecha).
    // Falha alto e claro em vez de mascarar como "JSON invalido" generico, e diz o caminho.
    if (cand?.finishReason === "MAX_TOKENS") {
      console.error("gemini cortou por MAX_TOKENS (subir MAX_OUTPUT_TOKENS ou dividir o relatorio). tam txt:", (txt || "").length);
      return json(req, { ok: false, erro: "O relatorio e grande demais pra ler de uma vez. Divida em menos LPs por arquivo e tente de novo." });
    }
    console.error("gemini json invalido. finishReason:", cand?.finishReason, "| txt:", (txt || "").slice(0, 300));
    return json(req, { ok: false, erro: "A IA nao devolveu um JSON valido." });
  }

  return json(req, { ok: true, dados, modelo: MODEL });
});
