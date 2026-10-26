// ============================================================================
//  Edge Function: importar-relatorio-lp  (Supabase / Deno)  -- motor: CLAUDE (Anthropic) desde 26/10/2026 (antes: Gemini)
//  Le o RELATORIO SEMANAL da Prudential (PDF) de um ou varios Life Planners e
//  devolve, estruturado, as 5 secoes (Atrasos, Pendencias de Emissao, Apolices
//  Emitidas/Status T, Aniversariantes, Aniversarios de Apolice) -- cada uma com
//  o LP dono e suas linhas mapeadas em campos. E o "parser" do nucleo P0.
//  O app tenta PRIMEIRO ler o texto sozinho (lpParseTexto); a IA so entra quando ele nao reconhece.
//
//  Troca decidida pelo Gustavo em 26/10/2026 ("IA A": um provedor so). O GEMINI_API_KEY nao existia
//  nos secrets, entao a versao Gemini estava parada.
//
//  SEGURANCA (mesmas camadas da capturar-lead):
//   1. A chave da Anthropic vive AQUI, no servidor (secret ANTHROPIC_API_KEY). Nunca no navegador.
//   2. verify_jwt = ON: so usuario LOGADO chama.
//   3. CORS travado nos dominios do app.
//   4. Limites de tamanho no corpo.
//
//  Saida IGUAL a da versao Gemini: { ok, dados:{secoes,confianca,avisos}, modelo } e, no erro, { ok:false, erro, motivo }.
// ============================================================================
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";

// Modelo: secret RELATORIO_MODELO. Padrao claude-haiku-5-5: um relatorio de 3 LPs gera ~10k tokens de JSON e a
// Edge Function tem limite de tempo — o Haiku termina bem antes. Pra mais capricho: RELATORIO_MODELO=claude-opus-5-5.
const MODEL = Deno.env.get("RELATORIO_MODELO") || "claude-haiku-5-5";
const MAX_OUTPUT_TOKENS = 32000;

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

// O formato JSON e descrito no prompt (campo ausente = chave omitida, por isso sem schema estrito).
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
  "- Nomes que quebram em 2 linhas (ex.: 'FULANO DE TAL EXEMPLO\\nSOBRENOME'): junte num valor so.",
  "- Datas: SEMPRE no formato YYYY-MM-DD (o relatorio usa DD/MM/YYYY -> converta, ex.: 30/06/1970 -> 1970-06-30).",
  "- premio: numero com ponto decimal (o relatorio usa virgula, ex.: '272,54' -> 272.54). Sem 'R$'.",
  "- dias_atraso: numero inteiro.",
  "- Se uma secao so tiver cabecalho (sem linhas), devolva a secao com 'linhas' vazio.",
  "- Nao invente. Campo ausente -> omita a chave. Coisa ambigua -> anote em 'avisos'.",
  "",
  "Responda SOMENTE com um JSON valido neste formato, sem nenhum texto fora dele:",
  '{"secoes":[{"tipo":"ATRASOS","lp":"GUSTAVO JUCA","linhas":[{"dias_atraso":49,"apolice":"0000001","pagador":"FULANO DE TAL EXEMPLO","segurado":"FULANO DE TAL EXEMPLO","telefone":"(81) 90000-0000","forma_pag":"MASTERCARD","motivo":"DADOS DO CARTAO EXPIRADOS/BLOQUEADOS - CONTATE O BANCO EMISSOR","premio":272.54}]}],"confianca":"alta","avisos":[]}',
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

  const KEY = String(Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  if (!KEY) return json(req, { ok: false, erro: "Chave da Anthropic nao encontrada nos secrets (esperado: ANTHROPIC_API_KEY)", motivo: "outro" }, 500);

  let payload: { pdf_base64?: string; texto?: string; imagem_base64?: string; media_type?: string };
  try {
    payload = await req.json();
  } catch {
    return json(req, { ok: false, erro: "Corpo da requisicao nao e JSON valido" }, 400);
  }

  const pdf = typeof payload?.pdf_base64 === "string" ? payload.pdf_base64.replace(/\s/g, "") : "";
  const imagem = typeof payload?.imagem_base64 === "string" ? payload.imagem_base64.replace(/\s/g, "") : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!pdf && !imagem && !texto) {
    return json(req, { ok: false, erro: "Envie um PDF (pdf_base64), uma imagem ou um texto" }, 400);
  }
  if (pdf.length > MAX_PDF_B64) {
    return json(req, { ok: false, erro: "PDF muito grande (max ~10 MB). Divida o relatorio." }, 413);
  }
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  const mt = payload?.media_type || "image/jpeg";
  const mediaType = (["image/jpeg", "image/png", "image/gif", "image/webp"].includes(mt) ? mt : "image/jpeg") as "image/jpeg";

  const content: any[] = [];
  if (pdf) content.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: pdf } });
  if (imagem) content.push({ type: "image", source: { type: "base64", media_type: mediaType, data: imagem } });
  if (texto) content.push({ type: "text", text: "Texto do relatorio:\n" + texto });
  content.push({ type: "text", text: "Extraia TODAS as secoes de TODOS os LPs do relatorio acima e responda SOMENTE com o JSON pedido." });

  // Saida longa (ate ~10k tokens): streaming evita o limite de tempo da requisicao HTTP do SDK.
  const client = new Anthropic({ apiKey: KEY, timeout: 140_000, maxRetries: 1 });
  let r: any;
  try {
    r = await client.messages.stream({
      model: MODEL,
      max_tokens: MAX_OUTPUT_TOKENS,
      system: SYSTEM,
      output_config: { effort: "low" },
      messages: [{ role: "user", content }],
    } as any).finalMessage();
  } catch (e: any) {
    if (e instanceof Anthropic.AuthenticationError) return json(req, { ok: false, erro: "Chave da Anthropic invalida — confira o ANTHROPIC_API_KEY.", motivo: "outro" }, 500);
    if (e instanceof Anthropic.RateLimitError || e instanceof Anthropic.InternalServerError || (e instanceof Anthropic.APIError && (e.status === 529 || e.status === 503)))
      return json(req, { ok: false, erro: "A IA esta congestionada agora. Tente de novo em ~1 min, ou cole o texto pra ler SEM IA.", motivo: "sobrecarga" }, 503);
    if (e instanceof Anthropic.APIConnectionTimeoutError) return json(req, { ok: false, erro: "A IA demorou demais. Divida o relatorio em menos LPs, ou cole o texto pra ler SEM IA.", motivo: "sobrecarga" }, 504);
    if (e instanceof Anthropic.APIError) { console.error("anthropic", e.status, e.message); return json(req, { ok: false, erro: "A IA nao conseguiu processar agora.", motivo: "outro", detalhe: `${e.status ?? "?"} ${String(e.message || "").slice(0, 200)}` }, 502); }
    console.error("relatorio", e); return json(req, { ok: false, erro: "Falha ao chamar a IA. Tente de novo.", motivo: "rede" }, 502);
  }
  if (r.stop_reason === "refusal") return json(req, { ok: false, erro: "A IA nao retornou resultado pra esse arquivo." });

  const txt = (r.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
  const dados = extractJson(txt);
  if (!dados) {
    if (r.stop_reason === "max_tokens") {
      console.error("relatorio cortado por max_tokens. tam txt:", (txt || "").length);
      return json(req, { ok: false, erro: "O relatorio e grande demais pra ler de uma vez. Divida em menos LPs por arquivo e tente de novo." });
    }
    console.error("relatorio json invalido. stop:", r.stop_reason, "| txt:", (txt || "").slice(0, 300));
    return json(req, { ok: false, erro: "A IA nao devolveu um JSON valido." });
  }

  return json(req, { ok: true, dados, modelo: MODEL });
});
