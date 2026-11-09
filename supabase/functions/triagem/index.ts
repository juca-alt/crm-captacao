// ============================================================================
//  Edge Function: triagem  (Supabase / Deno) — TRIAGEM-V1 (ticket I, parte 2 · 09/11/2026)
//  Para cada conversa em que o CLIENTE falou por último (7 dias), decide o destino:
//    gustavo 🔴 · rebeca 🟡 · sem_acao ⚪ (C': sem Victor)  → grava em copiloto_fila_cache (só destino + motivo curto).
//  Só LÊ umbler_chats/umbler_mensagens; NUNCA escreve na Umbler nem envia mensagem (não há chamada à Umbler aqui).
//  Reclassifica só quando chega mensagem nova (cache por ultima_msg_em). Cortesia ("ok", "obrigado") = sem IA.
//  Entradas (verify_jwt OFF; cada uma com trava própria):
//   1. pg_cron 'triagem-sync' a cada 10 min → header x-cron-chave (Vault 'umbler_cron_chave', mesma do sync)
//   2. botão no app → Authorization: Bearer <JWT> do dono ou de um delegado dele
//  IA: Claude Haiku (secret TRIAGEM_MODELO, padrão claude-haiku-5-5), chave em ANTHROPIC_API_KEY (a do copiloto).
// ============================================================================
import Anthropic from "npm:@anthropic-ai/sdk@0.133.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { montarConversa, precisa, soCortesia, SYSTEM, TOOL, validar, type Msg } from "./nucleo.ts";

const DONO = "juca@segurocomjuca.com";
const MODELO = Deno.env.get("TRIAGEM_MODELO") || "claude-haiku-5-5";
const MAX_POR_RODADA = 25, JANELA_DIAS = 7, ORCAMENTO_MS = 90_000;
const ORIGENS = new Set(["https://juca-alt.github.io", "http://localhost:8758", "http://127.0.0.1:8758"]);
const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return { "Access-Control-Allow-Origin": ORIGENS.has(o) ? o : "https://juca-alt.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

function chaveAnthropic(): string | undefined {
  const limpa = (v?: string) => String(v ?? "").trim().replace(/^["']|["']$/g, "");
  const k = limpa(Deno.env.get("ANTHROPIC_API_KEY"));
  if (k.startsWith("sk-ant-")) return k;
  for (const [n, v] of Object.entries(Deno.env.toObject())) if (/anthrop|claude/i.test(n) && limpa(v).startsWith("sk-ant-")) return limpa(v);
  return undefined;
}

async function triar(origem: string) {
  const t0 = Date.now(), prazo = t0 + ORCAMENTO_MS;
  const st = { origem, lidos: 0, pendentes: 0, ia: 0, regra: 0, erros: 0, ms: 0, ultimo_erro: "" };
  const desde = new Date(Date.now() - JANELA_DIAS * 864e5).toISOString();
  const { data: chats, error } = await db.from("umbler_chats").select("id,dono,ultima_msg_em")
    .eq("dono", DONO).eq("ultima_msg_de", "cliente").gte("ultima_msg_em", desde)
    .order("ultima_msg_em", { ascending: false }).limit(200);
  if (error) throw new Error("ler chats: " + error.message);
  const lista = (chats ?? []) as { id: string; dono: string; ultima_msg_em: string }[];
  st.lidos = lista.length;
  if (!lista.length) return st;
  const { data: cache } = await db.from("copiloto_fila_cache").select("chat_id,ultima_msg_em").in("chat_id", lista.map((c) => c.id));
  const lida = new Map(((cache ?? []) as { chat_id: string; ultima_msg_em: string }[]).map((r) => [r.chat_id, r.ultima_msg_em]));
  const fila = lista.filter((c) => precisa(c.ultima_msg_em, lida.get(c.id)));
  st.pendentes = fila.length;
  const key = chaveAnthropic();
  const ia = key ? new Anthropic({ apiKey: key, timeout: 15_000, maxRetries: 1 }) : null;
  for (const ch of fila.slice(0, MAX_POR_RODADA)) {
    if (Date.now() > prazo) break;
    try {
      const { data: ms } = await db.from("umbler_mensagens").select("de,tipo,texto")
        .eq("chat_id", ch.id).eq("privada", false).order("enviada_em", { ascending: false }).limit(12);
      const msgs = ((ms ?? []) as Msg[]).reverse();
      let destino: string, motivo: string, urgencia: number, modelo: string;
      if (soCortesia(msgs)) { destino = "sem_acao"; motivo = "só agradeceu ou confirmou"; urgencia = 1; modelo = "regra"; st.regra++; }
      else {
        if (!ia) throw new Error("sem chave da Anthropic");
        const r = await ia.messages.create({
          model: MODELO, max_tokens: 200, system: SYSTEM, tools: [TOOL as any],
          tool_choice: { type: "tool", name: TOOL.name },
          messages: [{ role: "user", content: `<conversa>\n${montarConversa(msgs)}\n</conversa>` }],
        } as any);
        const b = r.content.find((x: any) => x.type === "tool_use") as any;
        const c = validar(b?.input);
        if (!c) throw new Error("resposta fora do formato");
        ({ destino, motivo, urgencia } = c); modelo = MODELO; st.ia++;
      }
      const { error: ue } = await db.from("copiloto_fila_cache").upsert({ chat_id: ch.id, dono: ch.dono, ultima_msg_em: ch.ultima_msg_em,
        destino, motivo, urgencia, modelo, classificado_em: new Date().toISOString() }, { onConflict: "chat_id" });
      if (ue) throw new Error("gravar: " + ue.message);
    } catch (e) { st.erros++; st.ultimo_erro = String((e as Error)?.message ?? e).slice(0, 200); }   // erro numa conversa não para as outras
  }
  st.ms = Date.now() - t0;
  return st;
}

async function chaveOk(nome: string, chave: string | null): Promise<boolean> {
  if (!chave) return false;
  const { data, error } = await db.rpc("umbler_chave_ok", { p_nome: nome, p_chave: chave });
  return !error && data === true;
}
async function usuarioPode(req: Request): Promise<boolean> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt || jwt.split(".").length !== 3) return false;
  const { data } = await db.auth.getUser(jwt);
  const email = (data?.user?.email || "").toLowerCase();
  if (!email) return false;
  if (email === DONO) return true;
  const { data: d } = await db.from("lp_delegacoes").select("dono_email").eq("dono_email", DONO).eq("delegado_email", email).maybeSingle();
  return !!d;
}
declare const EdgeRuntime: { waitUntil(p: Promise<unknown>): void } | undefined;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (await chaveOk("umbler_cron_chave", req.headers.get("x-cron-chave"))) {
    const p = triar("cron").catch(() => {});
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p);
    return json(req, { ok: true, iniciado: true });
  }
  if (await usuarioPode(req)) {
    try { return json(req, { ok: true, ...(await triar("manual")) }); }
    catch (e) { return json(req, { ok: false, motivo: String((e as Error)?.message ?? e).slice(0, 200) }, 500); }
  }
  return json(req, { ok: false, motivo: "sem_permissao" }, 401);
});
