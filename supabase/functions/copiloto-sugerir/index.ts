// ============================================================================
//  Edge Function: copiloto-sugerir  (Supabase / Deno) — COPILOTO-V1 (23/10/2026)
//  Copiloto de resposta da extensão WhatsApp/Umbler (2.10.0): HUMANO + IA.
//  A IA sugere categoria, rascunho e ação no CRM; o humano revisa, envia e aplica.
//  A IA NUNCA envia nada ao cliente e NUNCA fala de plano/produto/preço/cobertura/saúde.
//
//  Entrada (POST, JSON): { contato_id?: string, mensagens: [{de:'cliente'|'nos', texto, hora?}] }
//  Saída:  { ok:true, id, sugestao:{categoria, precisa_gustavo, motivo, rascunho, acao_crm}, latencia_ms, modelo }
//          { ok:false, codigo:'sem_chave'|'sem_mensagens'|'timeout'|'ia_indisponivel'|'resposta_invalida'|..., mensagem }
//
//  Quem pode: usuário logado do CRM (JWT dele no Authorization — o mesmo que a extensão já usa no Supabase).
//  Contexto do CRM lido COM o JWT dele (RLS): só primeiro nome, etapa e responsável. Nada de CPF, renda, apólice, saúde.
//  A chave da Anthropic fica SÓ aqui (secret ANTHROPIC_API_KEY). Modelo: secret COPILOTO_MODELO (padrão claude-haiku-5-5).
//  Log em copiloto_sugestoes (sem o texto da conversa).
//  verify_jwt = OFF porque a função faz a própria checagem (padrão da emb-acesso).
// ============================================================================
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import {
  montarSystem, montarUsuario, normalizarMensagens, primeiroNome, TOOL, travaDura, validar,
} from "./nucleo.ts";

const MODELO = Deno.env.get("COPILOTO_MODELO") || "claude-haiku-5-5";
const CORS = {
  "Access-Control-Allow-Origin": "*",            // a extensão chama do service worker; o JWT é a barreira
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });
const falha = (status: number, codigo: string, mensagem: string, detalhe?: string) =>
  json(status, detalhe ? { ok: false, codigo, mensagem, detalhe } : { ok: false, codigo, mensagem });
// COPILOTO-DIAG (24/10): o erro da Anthropic volta no campo `detalhe` (status + tipo + mensagem da API).
// Nunca tem a chave: a API não ecoa credencial. Sem isso o "IA indisponível" escondia o motivo real.
function detalheAnthropic(e: any): string {
  const tipo = e?.error?.error?.type || e?.error?.type || "";
  const msg = e?.error?.error?.message || e?.error?.message || e?.message || "";
  return `${e?.status ?? "?"} ${tipo}: ${String(msg).slice(0, 240)}`.trim();
}

// Claude Haiku 5.5 aceita tool_choice forçado; Opus 5.5 / Sonnet 5.5 / Fable 5.1 recusam (400).
// Se trocarem o COPILOTO_MODELO pra um desses, cai pra "auto" + a instrução no prompt.
function escolhaDaFerramenta(modelo: string) {
  return /haiku|opus-5$|opus-4|sonnet-5$|sonnet-4/.test(modelo)
    ? { type: "tool" as const, name: TOOL.name }
    : { type: "auto" as const };
}

// A chave: secret ANTHROPIC_API_KEY. Se cadastraram com outro nome ("Anthropic API Key", CLAUDE_API_KEY…), acha pelo formato sk-ant-.
function chaveAnthropic(): string | undefined {
  const limpa = (v?: string) => String(v ?? "").trim().replace(/^["']|["']$/g, "");
  const k = limpa(Deno.env.get("ANTHROPIC_API_KEY"));
  if (k.startsWith("sk-ant-")) return k;
  for (const [n, v] of Object.entries(Deno.env.toObject())) {
    if (/anthrop|claude/i.test(n) && limpa(v).startsWith("sk-ant-")) return limpa(v);
  }
  return k || undefined;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return falha(405, "metodo", "Use POST.");
  const t0 = Date.now();

  // ── quem é ──
  const URL_ = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const auth = req.headers.get("authorization") || "";
  const jwt = auth.replace(/^Bearer\s+/i, "");
  if (!jwt) return falha(401, "sem_login", "Entre no CRM pela extensão.");
  const sb = createClient(URL_, ANON, { global: { headers: { Authorization: `Bearer ${jwt}` } }, auth: { persistSession: false } });
  const { data: u, error: ue } = await sb.auth.getUser(jwt);
  const email = String(u?.user?.email || "").toLowerCase();
  if (ue || !email) return falha(401, "sem_login", "Sessão vencida. Entre de novo na extensão.");

  // ── entrada ──
  let body: any = {};
  try { body = await req.json(); } catch { return falha(400, "entrada", "Pedido inválido."); }
  const msgs = normalizarMensagens(body?.mensagens);
  if (!msgs.length) return falha(400, "sem_mensagens", "Não achei mensagens de texto nesta conversa.");
  const contatoId = body?.contato_id ? String(body.contato_id).slice(0, 80) : null;

  // ── chave (antes de qualquer custo) ──
  const KEY = chaveAnthropic();
  if (!KEY) {
    const nomes = Object.keys(Deno.env.toObject()).filter((n) => /anthrop|claude/i.test(n));   /* só NOMES, nunca valores */
    return falha(503, "sem_chave", "Copiloto sem chave configurada." + (nomes.length ? ` Secrets parecidos: ${nomes.join(", ")} — o valor precisa começar com sk-ant-.` : ""));
  }

  // ── contexto mínimo do CRM (RLS do próprio usuário) ──
  let nome = "", etapa = "", dono = email;
  if (contatoId) {
    const { data: c } = await sb.from("lp_contatos")
      .select("dono, nome:dados->>nome, etapa:dados->>etapa, estagio:dados->>estagio")
      .eq("id", contatoId).limit(1).maybeSingle();
    if (c) { nome = primeiroNome(c.nome); etapa = String(c.etapa || c.estagio || ""); dono = String(c.dono || email); }
  }
  const [{ data: cfg }, { data: kb }] = await Promise.all([
    sb.from("app_settings").select("valor").eq("chave", "copiloto_config").maybeSingle(),
    sb.from("kb_scripts_captacao").select("script, canal").eq("ativo", true).ilike("canal", "%whats%").order("ordem").limit(8),
  ]);
  const janelas = String(cfg?.valor?.janelas_agenda || "");
  const scripts = (kb || []).map((k: any) => String(k.script || "").slice(0, 500)).filter(Boolean);
  const donoRotulo = primeiroNome(dono.split("@")[0].split(/[._-]/)[0]);

  // ── IA ──
  const client = new Anthropic({ apiKey: KEY, timeout: 10_000, maxRetries: 0 });
  let sug = null;
  try {
    const r = await client.messages.create({
      model: MODELO,
      max_tokens: 600,
      system: montarSystem(scripts, janelas),
      tools: [TOOL as any],
      tool_choice: escolhaDaFerramenta(MODELO),
      output_config: { effort: "low" },
      messages: [{ role: "user", content: montarUsuario(msgs, { nome, etapa, dono: donoRotulo }) }],
    } as any);
    if (r.stop_reason === "refusal") return falha(200, "recusou", "A IA não quis sugerir nesta conversa. Responda manualmente.");
    const bloco = r.content.find((b: any) => b.type === "tool_use" && b.name === TOOL.name) as any;
    sug = validar(bloco?.input);
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return falha(503, "sem_chave", "Copiloto sem chave válida — confira o ANTHROPIC_API_KEY.");
    if (e instanceof Anthropic.APIConnectionTimeoutError) return falha(504, "timeout", "A IA demorou demais. Tente de novo.");
    if (e instanceof Anthropic.RateLimitError) return falha(429, "limite", "Muitas sugestões seguidas. Espere um pouco.");
    if (e instanceof Anthropic.APIError) { console.error("anthropic", e.status, e.message); return falha(502, "ia_indisponivel", "A IA está indisponível agora.", detalheAnthropic(e)); }
    console.error("copiloto", e); return falha(502, "ia_indisponivel", "A IA está indisponível agora.", String((e as any)?.message ?? e).slice(0, 240));
  }
  if (!sug) return falha(502, "resposta_invalida", "A IA respondeu fora do formato. Tente de novo.");
  sug = travaDura(sug, nome, janelas);
  const latencia = Date.now() - t0;

  // ── log (sem a conversa) ──
  const { data: lg, error: le } = await sb.from("copiloto_sugestoes").insert({
    dono, contato_id: contatoId, categoria: sug.categoria, precisa_gustavo: sug.precisa_gustavo,
    rascunho: sug.rascunho, acao_crm: sug.acao_crm, latencia_ms: latencia, modelo: MODELO,
  }).select("id").single();
  if (le) console.error("log copiloto", le.message);

  return json(200, { ok: true, id: lg?.id || null, sugestao: sug, latencia_ms: latencia, modelo: MODELO });
});
