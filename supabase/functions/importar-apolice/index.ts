// ============================================================================
//  Edge Function: importar-apolice  (Supabase / Deno)  -- motor: GOOGLE GEMINI
//  Le o DEMONSTRATIVO DE PAGAMENTOS de UMA apolice da Prudential (PDF) e devolve
//  estruturado: cliente + apolice + coberturas (codigo, capital, premio, termino).
//  Alimenta o modulo REVISAO DE APOLICES da Visao LP (tabelas rev_*).
//
//  Mesmo motor/key/seguranca da importar-relatorio-lp (GEMINI_API_KEY ja existe):
//   1. Key do Gemini so no servidor (secret).  2. verify_jwt = ON.
//   3. CORS travado nos dominios do app.       4. Limites de tamanho no corpo.
//
//  Deploy: supabase functions deploy importar-apolice
// ============================================================================

const MODEL = "gemini-2.5-flash-lite";
// 1 apolice = poucas dezenas de linhas -> saida pequena; 16k da folga enorme.
const MAX_OUTPUT_TOKENS = 16384;

const ALLOWED_ORIGINS = new Set([
  "https://juca-alt.github.io",
  "http://localhost:8758",
  "http://127.0.0.1:8758",
  "http://localhost:8781",
  "http://127.0.0.1:8781",
]);
const MAX_PDF_B64 = 14_000_000;
const MAX_TEXT = 120_000;

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

const SYSTEM = [
  "Voce extrai dados do DEMONSTRATIVO DE PAGAMENTOS de uma apolice de seguro de vida da Prudential do Brasil.",
  "O documento tem: dados do segurado (nome, data de nascimento), dados da apolice (numero, proposta,",
  "status, data de emissao, idade na emissao, tipo de contestacao Medica/Nao Medica, premio liquido, IOF,",
  "premio total, periodicidade Mensal/Anual, forma de pagamento, dia de pagamento, pago ate, dias em atraso,",
  "proximo vencimento), uma TABELA DE COBERTURAS (codigo tipo TP10G/WL65G/DDMRG, descricao, importancia",
  "segurada, premio, classe de ajuste, data de termino da cobertura, status tipo Premium Paying) e o",
  "HISTORICO DE COBRANCAS (varias linhas de pagamentos mensais).",
  "",
  "Responda SOMENTE com JSON neste formato exato:",
  "{",
  '  "cliente": { "nome": "NOME COMPLETO DO SEGURADO", "nascimento": "YYYY-MM-DD ou null" },',
  '  "apolice": {',
  '    "numero": "so digitos, ex 001520815", "proposta": "ex 000092712E ou null",',
  '    "status": "Ativa|Cancelada|Substituída|Rejeitada|Anulada|Sinistrada",',
  '    "data_emissao": "YYYY-MM-DD ou null", "idade_emissao": numero ou null,',
  '    "tipo_contestacao": "Médica|Não Médica|null",',
  '    "premio_liquido": numero, "iof": numero, "premio_total": numero,',
  '    "periodicidade": "Mensal|Anual|null", "forma_pagamento": "texto curto ou null",',
  '    "cartao_expiracao": "YYYY-MM-DD ou null", "dia_pagamento": numero ou null,',
  '    "pago_ate": "YYYY-MM-DD ou null", "dias_atraso": numero ou null,',
  '    "proximo_venc": "YYYY-MM-DD ou null",',
  '    "total_pago": numero ou null,   // SOMA de todos os pagamentos do historico de cobrancas',
  '    "num_pagamentos": numero ou null // quantidade de linhas pagas do historico',
  "  },",
  '  "coberturas": [ { "codigo": "TP10G", "nome": "descricao da cobertura", "valor_segurado": numero,',
  '    "premio_liquido": numero, "iof": numero ou null, "classe_ajuste": "Standard|Preferencial|Super Preferencial|null",',
  '    "termino": "YYYY-MM-DD ou null", "status_cobertura": "Premium Paying|Surrendered|Lapsed|null" } ],',
  '  "confianca": "alta|media|baixa"',
  "}",
  "",
  "Regras: valores monetarios em NUMERO com ponto decimal (1.121,84 -> 1121.84). Datas SEMPRE YYYY-MM-DD.",
  "NAO invente cobertura nem some linhas — uma entrada por linha da tabela de coberturas, com o CODIGO exato.",
  "Se o campo nao existir no documento, use null. Se o documento nao for um demonstrativo de apolice,",
  'responda {"erro":"nao_e_demonstrativo"}.',
].join("\n");

function extractJson(txt: string): unknown {
  if (!txt) return null;
  try { return JSON.parse(txt); } catch { /* tenta recorte */ }
  const a = txt.indexOf("{");
  const b = txt.lastIndexOf("}");
  if (a >= 0 && b > a) { try { return JSON.parse(txt.slice(a, b + 1)); } catch { /* desiste */ } }
  return null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function backoffMs(attempt: number): number {
  const base = 800, cap = 8000;
  const ceil = Math.min(cap, base * Math.pow(2, attempt));
  return Math.round(ceil / 2 + Math.random() * (ceil / 2));
}
function classifyGemini(status: number, body: any): { classe: string; retryDelayMs: number | null } {
  const details = body?.error?.details || [];
  let retryDelayMs: number | null = null, isDaily = false;
  for (const d of details) {
    const t = String(d?.["@type"] || "");
    if (t.includes("RetryInfo") && d?.retryDelay) {
      const m = String(d.retryDelay).match(/([\d.]+)s/);
      if (m) retryDelayMs = Math.round(parseFloat(m[1]) * 1000);
    }
    if (t.includes("QuotaFailure")) {
      for (const v of (d?.violations || [])) {
        const q = String(v?.quotaId || "") + " " + String(v?.quotaMetric || "");
        if (/PerDay/i.test(q)) isDaily = true;
      }
    }
  }
  if (status === 429 && isDaily) return { classe: "cota_diaria", retryDelayMs };
  if (status === 429) return { classe: "cota_minuto", retryDelayMs };
  if (status === 503 || status === 500) return { classe: "sobrecarga", retryDelayMs };
  return { classe: "outro", retryDelayMs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { ok: false, erro: "Use POST" }, 405);

  const KEY = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("Gemini API Key") ||
    Deno.env.get("GEMINI_KEY") || Deno.env.get("GOOGLE_API_KEY") ||
    Deno.env.get("GOOGLE_GEMINI_API_KEY") || Deno.env.get("GEMINI");
  if (!KEY) return json(req, { ok: false, erro: "Nenhuma key do Gemini encontrada nos secrets (esperado: GEMINI_API_KEY)" }, 500);

  let payload: { pdf_base64?: string; texto?: string };
  try { payload = await req.json(); }
  catch { return json(req, { ok: false, erro: "Corpo da requisicao nao e JSON valido" }, 400); }

  const pdf = typeof payload?.pdf_base64 === "string" ? payload.pdf_base64 : "";
  let texto = (typeof payload?.texto === "string" ? payload.texto : "").trim();
  if (!pdf && !texto) return json(req, { ok: false, erro: "Envie um PDF (pdf_base64) ou o texto do demonstrativo" }, 400);
  if (pdf.length > MAX_PDF_B64) return json(req, { ok: false, erro: "PDF muito grande (max ~10 MB)." }, 413);
  if (texto.length > MAX_TEXT) texto = texto.slice(0, MAX_TEXT);

  const parts: unknown[] = [];
  if (pdf) parts.push({ inline_data: { mime_type: "application/pdf", data: pdf } });
  if (texto) parts.push({ text: "Texto do demonstrativo:\n" + texto });
  parts.push({ text: "Extraia os dados do demonstrativo acima e responda SOMENTE com o JSON pedido." });

  const GURL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;
  const geminiBody = JSON.stringify({
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: "user", parts }],
    generationConfig: { responseMimeType: "application/json", temperature: 0, maxOutputTokens: MAX_OUTPUT_TOKENS },
  });

  const MAX_ATTEMPTS = 4;
  let resp: Response | null = null;
  let lastBody: any = null, lastClasse = "";
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const ctrl = new AbortController();
    const to = setTimeout(() => ctrl.abort(), 30_000);
    try {
      resp = await fetch(GURL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-goog-api-key": KEY },
        body: geminiBody,
        signal: ctrl.signal,
      });
    } catch (e) {
      clearTimeout(to);
      console.error("gemini fetch falhou:", e);
      if (i === MAX_ATTEMPTS - 1) return json(req, { ok: false, erro: "Falha de rede ao chamar a IA. Tente de novo.", motivo: "rede" }, 502);
      await sleep(backoffMs(i));
      continue;
    }
    clearTimeout(to);
    if (resp.ok) break;
    lastBody = await resp.clone().json().catch(() => null);
    const cls = classifyGemini(resp.status, lastBody);
    lastClasse = cls.classe;
    if (cls.classe === "cota_diaria") break;
    if (resp.status !== 429 && resp.status !== 503 && resp.status !== 500) break;
    if (i === MAX_ATTEMPTS - 1) break;
    const ra = Number(resp.headers.get("retry-after")) * 1000 || 0;
    const wait = Math.min(20_000, Math.max(backoffMs(i), cls.retryDelayMs || 0, ra));
    await sleep(wait);
  }
  if (!resp) return json(req, { ok: false, erro: "Falha ao chamar a IA. Tente de novo.", motivo: "rede" }, 502);

  if (!resp.ok) {
    const body = lastBody || await resp.json().catch(() => null);
    console.error("gemini erro:", resp.status, lastClasse, JSON.stringify(body?.error || body).slice(0, 300));
    if (lastClasse === "cota_diaria")
      return json(req, { ok: false, erro: "Cota diaria da IA (free tier) esgotada — so reseta amanha. Use o cadastro manual por enquanto.", motivo: "cota_diaria" }, 429);
    if (lastClasse === "sobrecarga" || resp.status === 503 || resp.status === 500 || resp.status === 429)
      return json(req, { ok: false, erro: "A IA esta congestionada agora. Tente de novo em ~1 min.", motivo: "sobrecarga" }, 503);
    return json(req, { ok: false, erro: "A IA nao conseguiu processar agora.", motivo: "outro" }, 502);
  }

  const data = await resp.json().catch(() => null);
  const blocked = data?.promptFeedback?.blockReason;
  const cand = data?.candidates?.[0];
  if (blocked || !cand) {
    console.error("gemini sem candidato:", JSON.stringify(data?.promptFeedback || data).slice(0, 400));
    return json(req, { ok: false, erro: "A IA nao retornou resultado pra esse arquivo." });
  }

  const txt = (cand?.content?.parts || []).map((p: { text?: string }) => p?.text || "").join("").trim();
  const dados: any = extractJson(txt);
  if (!dados) {
    if (cand?.finishReason === "MAX_TOKENS") {
      console.error("gemini cortou por MAX_TOKENS. tam txt:", (txt || "").length);
      return json(req, { ok: false, erro: "Documento grande demais pra ler de uma vez. Envie um PDF por apolice." });
    }
    console.error("gemini json invalido. finishReason:", cand?.finishReason, "| txt:", (txt || "").slice(0, 300));
    return json(req, { ok: false, erro: "A IA nao devolveu um JSON valido." });
  }
  if (dados?.erro === "nao_e_demonstrativo")
    return json(req, { ok: false, erro: "Esse arquivo nao parece um demonstrativo de apolice da Prudential." });
  if (!dados?.apolice?.numero || !Array.isArray(dados?.coberturas) || !dados.coberturas.length)
    return json(req, { ok: false, erro: "Nao identifiquei apolice + coberturas nesse arquivo. Confira o PDF." });

  return json(req, { ok: true, dados, modelo: MODEL });
});
