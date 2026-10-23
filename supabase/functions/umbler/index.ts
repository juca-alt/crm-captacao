// ============================================================================
//  Edge Function: umbler  (Supabase / Deno) — UMBLER-V1 · LEITURA
//  O CRM LÊ TODAS as conversas do Umbler Talk e guarda em umbler_chats / umbler_mensagens.
//
//  NUNCA ENVIA. Esta função só faz GET na API do Talk. Resposta ao cliente é sempre humana
//  (Gustavo/Victor aprovam e mandam). Não existe POST /v1/messages aqui — um teste confere isso.
//
//  Três entradas (verify_jwt OFF; cada uma tem a sua trava):
//   1. pg_cron a cada 10 min → header x-cron-chave (Vault 'umbler_cron_chave').
//   2. webhook do Talk → POST ?k=<chave> (Vault 'umbler_webhook_chave'). Guarda o evento cru e já lê o chat.
//   3. botão "sincronizar agora" no app → Authorization: Bearer <JWT> do dono ou de um delegado dele.
//
//  Secret: UMBLER_TOKEN (Talk → Configurações → API / Tokens). Sem ele a função responde "sem_token".
//  Opcional: UMBLER_ORG_ID (senão lê de /v1/members/me/).
//  Limite da API: 100 req / 5 s → espaçamos 60 ms e, no 429, esperamos 5 s.
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { chatUltimoEvento, coletarMembros, extrairDoWebhook, itens, mapChat, mapMensagem, orgDoMe, type Obj } from "./nucleo.ts";

const API = "https://app-utalk.umbler.com/api";
const DONO = "juca@segurocomjuca.com";          // dono da conta Umbler (RLS por dono; Victor lê como delegado)
const ORIGENS = new Set(["https://juca-alt.github.io", "http://localhost:8758", "http://127.0.0.1:8758"]);
const TAKE_CHATS = 50, TAKE_MSGS = 250;
const PAGINAS_HIST_POR_CHAT = 4;                 // histórico antigo: até 1.000 msgs por chat por rodada
const ORCAMENTO_MS = 100_000;                    // a rodada para sozinha e continua na próxima

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { persistSession: false },
});

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ORIGENS.has(o) ? o : "https://juca-alt.github.io",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
    "Vary": "Origin",
  };
}
const json = (req: Request, body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });

function token(): string | null {
  const t = Deno.env.get("UMBLER_TOKEN");
  if (t && t.trim()) return t.trim();
  for (const [k, v] of Object.entries(Deno.env.toObject())) {
    if (/umbler/i.test(k) && !/org/i.test(k) && v && v.trim().length > 20) return v.trim();
  }
  return null;
}

// ---------- cliente da API (só GET) ----------
let ultimaReq = 0, totalReq = 0;
async function apiGet(caminho: string, params: Record<string, string | number | undefined>, tk: string): Promise<unknown> {
  const u = new URL(API + caminho);
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") u.searchParams.set(k, String(v));
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    const espera = 60 - (Date.now() - ultimaReq);
    if (espera > 0) await new Promise((r) => setTimeout(r, espera));
    ultimaReq = Date.now(); totalReq++;
    const r = await fetch(u, { method: "GET", headers: { Authorization: `Bearer ${tk}`, Accept: "application/json" } });
    if (r.status === 429) { await new Promise((ok) => setTimeout(ok, 5000)); continue; }
    if (!r.ok) {
      const txt = (await r.text()).slice(0, 300);
      throw new Error(`Umbler ${r.status} em ${caminho}: ${txt}`);
    }
    return await r.json();
  }
  throw new Error(`Umbler 429 persistente em ${caminho}`);
}

// ---------- estado ----------
type Estado = { dono: string; org_id: string | null; org_nome: string | null; lista_completa: boolean; lista_skip: number; ultimo_sync: string | null; stats: Obj };
async function lerEstado(): Promise<Estado> {
  const { data } = await db.from("umbler_estado").select("*").eq("dono", DONO).maybeSingle();
  return (data as Estado) ?? { dono: DONO, org_id: null, org_nome: null, lista_completa: false, lista_skip: 0, ultimo_sync: null, stats: {} };
}
async function gravarEstado(p: Partial<Estado> & Obj) {
  await db.from("umbler_estado").upsert({ dono: DONO, ...p, atualizado_em: new Date().toISOString() });
}

async function garantirOrg(est: Estado, tk: string): Promise<string> {
  const env = Deno.env.get("UMBLER_ORG_ID");
  if (env) return env;
  if (est.org_id) return est.org_id;
  const me = await apiGet("/v1/members/me/", {}, tk);
  const o = orgDoMe(me);
  if (!o.id) throw new Error("não achei a organização em /v1/members/me/");
  est.org_id = o.id; est.org_nome = o.nome;
  await gravarEstado({ org_id: o.id, org_nome: o.nome });
  return o.id;
}

// ---------- nomes da equipe (a API manda o atendente só com id) ----------
let MEMBROS: Record<string, string> = {};
async function carregarMembros(org: string, tk: string, est: Estado) {
  MEMBROS = { ...((est.stats?.membros as Record<string, string>) ?? {}) };
  for (const c of ["/v1/members/me/", `/v1/organizations/${encodeURIComponent(org)}/`, `/v1/organizations/${encodeURIComponent(org)}/details/`]) {
    try { Object.assign(MEMBROS, coletarMembros(await apiGet(c, {}, tk))); } catch (_) { /* rota pode não existir no plano: segue sem nome */ }
  }
}

// ---------- mensagens de um chat ----------
type ChatRow = { id: string; msgs_ate: string | null; msgs_desde: string | null; historico_completo: boolean };
let msgsGravadas = 0;

async function gravarMsgs(lista: unknown[], chatId: string): Promise<{ min: string | null; max: string | null; n: number }> {
  const rows = lista.map((m) => mapMensagem(m, chatId, DONO)).filter(Boolean) as Obj[];
  let min: string | null = null, max: string | null = null;
  for (const r of rows) {
    const t = r.enviada_em as string | null;
    if (!t) continue;
    if (!min || t < min) min = t;
    if (!max || t > max) max = t;
  }
  if (rows.length) {
    const { error } = await db.from("umbler_mensagens").upsert(rows, { onConflict: "id" });
    if (error) throw new Error("gravar mensagens: " + error.message);
    msgsGravadas += rows.length;
  }
  return { min, max, n: lista.length };
}

async function lerPagina(chatId: string, org: string, de: string, dir: "TakeBefore" | "TakeAfter", tk: string) {
  const r = await apiGet(`/v1/chats/${encodeURIComponent(chatId)}/relative-messages/`,
    { organizationId: org, FromEventUTC: de, Take: TAKE_MSGS, Direction: dir }, tk);
  return itens(r);
}

/** traz o que falta de um chat: o novo (depois de msgs_ate) e, com folga de tempo, o histórico antigo */
async function sincChat(chatId: string, org: string, tk: string, atual: ChatRow | null, prazo: number, comHistorico: boolean) {
  let ate = atual?.msgs_ate ?? null, desde = atual?.msgs_desde ?? null, completo = atual?.historico_completo ?? false;
  if (!ate) {
    const pg = await gravarMsgs(await lerPagina(chatId, org, new Date(Date.now() + 60_000).toISOString(), "TakeBefore", tk), chatId);
    ate = pg.max; desde = pg.min;
    if (pg.n < TAKE_MSGS) completo = true;
  } else {
    for (let i = 0; i < 20 && Date.now() < prazo; i++) {
      const antes: string = ate;
      const pg = await gravarMsgs(await lerPagina(chatId, org, antes, "TakeAfter", tk), chatId);
      if (pg.max && pg.max > antes) ate = pg.max;
      if (pg.n < TAKE_MSGS || !pg.max || pg.max <= antes) break; // página curta ou sem avanço = em dia
    }
  }
  if (comHistorico && !completo && desde) {
    for (let i = 0; i < PAGINAS_HIST_POR_CHAT && Date.now() < prazo; i++) {
      const pg = await gravarMsgs(await lerPagina(chatId, org, desde, "TakeBefore", tk), chatId);
      if (pg.n < TAKE_MSGS || !pg.min || pg.min >= desde) { completo = true; if (pg.min && pg.min < desde) desde = pg.min; break; }
      desde = pg.min;
    }
  }
  await db.from("umbler_chats").update({ msgs_ate: ate, msgs_desde: desde, historico_completo: completo }).eq("id", chatId);
}

async function linhasAtuais(ids: string[]): Promise<Map<string, ChatRow>> {
  const m = new Map<string, ChatRow>();
  if (!ids.length) return m;
  const { data } = await db.from("umbler_chats").select("id,msgs_ate,msgs_desde,historico_completo").in("id", ids);
  for (const r of (data ?? []) as ChatRow[]) m.set(r.id, r);
  return m;
}

async function listarChats(org: string, skip: number, tk: string) {
  return itens(await apiGet("/v1/chats/", {
    organizationId: org, ChatState: "All", ChatOrderBy: "LastMessage", Order: "Desc",
    Skip: skip, Take: TAKE_CHATS, Behavior: "GetSliceOnly",
  }, tk));
}

/** grava a página de chats e lê as mensagens dos que mudaram. Devolve quantos já estavam em dia. */
async function processarPagina(lista: unknown[], org: string, tk: string, prazo: number): Promise<number> {
  const rows = lista.map((c) => mapChat(c, DONO, org, MEMBROS)).filter(Boolean) as Obj[];
  const atuais = await linhasAtuais(rows.map((r) => r.id as string));
  if (rows.length) {
    const { error } = await db.from("umbler_chats").upsert(rows, { onConflict: "id" });
    if (error) throw new Error("gravar chats: " + error.message);
  }
  let emDia = 0;
  for (const c of lista) {
    if (Date.now() > prazo) break;
    const r = mapChat(c, DONO, org, MEMBROS); if (!r) continue;
    const at = atuais.get(r.id as string) ?? null;
    const ult = chatUltimoEvento(c);
    if (at?.msgs_ate && (!ult || ult <= at.msgs_ate)) { emDia++; continue; }
    await sincChat(r.id as string, org, tk, at, prazo, false);
  }
  return emDia;
}

async function sincronizar(origem: string) {
  const t0 = Date.now(), prazo = t0 + ORCAMENTO_MS;
  const tk = token();
  if (!tk) { await gravarEstado({ ultimo_sync: new Date().toISOString(), ultimo_erro: "sem_token" }); return { ok: false, motivo: "sem_token" }; }
  const est = await lerEstado();
  const passos: Obj = {};
  try {
    const org = await garantirOrg(est, tk);
    await carregarMembros(org, tk, est);
    const vistos = new Set<string>();
    const novosNa = (lista: unknown[]) => { let n = 0; for (const c of lista) { const id = String((c as Obj)?.id ?? ""); if (id && !vistos.has(id)) { vistos.add(id); n++; } } return n; };
    // 1) cabeça: chats com mensagem nova (lista vem do mais recente pro mais antigo)
    let skip = 0, paginas = 0;
    while (Date.now() < prazo && paginas < 20) {
      const lista = await listarChats(org, skip, tk);
      const novos = novosNa(lista);
      const emDia = await processarPagina(lista, org, tk, prazo);
      paginas++; skip += TAKE_CHATS;
      if (lista.length < TAKE_CHATS || emDia === lista.length || !novos) break; // !novos = página repetida
    }
    passos.cabeca_paginas = paginas;
    // 2) varredura completa (1ª vez): todos os chats, inclusive fechados. Cursor sobrevive entre rodadas.
    if (!est.lista_completa) {
      let s = Math.max(0, (est.lista_skip ?? 0) - 10), completa = false; let anterior = "";
      while (Date.now() < prazo) {
        const lista = await listarChats(org, s, tk);
        const assin = lista.map((c) => String((c as Obj)?.id ?? "")).join(",");
        const repetida = !!assin && assin === anterior; // a API devolveu a mesma página de novo: para, não gira em falso
        anterior = assin;
        await processarPagina(lista, org, tk, prazo);
        if (lista.length < TAKE_CHATS || repetida) { completa = true; break; }
        s += TAKE_CHATS;
        await gravarEstado({ lista_skip: s }); // se a rodada cair no meio, a próxima continua daqui
      }
      await gravarEstado({ lista_skip: s, lista_completa: completa });
      passos.varredura = { skip: s, completa };
    }
    // 3) histórico antigo de quem ainda não está completo (mais recentes primeiro)
    let hist = 0;
    while (Date.now() < prazo) {
      const { data } = await db.from("umbler_chats").select("id,msgs_ate,msgs_desde,historico_completo")
        .eq("dono", DONO).eq("historico_completo", false).not("msgs_desde", "is", null)
        .order("ultima_msg_em", { ascending: false, nullsFirst: false }).limit(10);
      const fila = (data ?? []) as ChatRow[];
      if (!fila.length) break;
      for (const c of fila) { if (Date.now() > prazo) break; await sincChat(c.id, org, tk, c, prazo, true); hist++; }
    }
    passos.historico_chats = hist;
    const { count: nChats } = await db.from("umbler_chats").select("id", { count: "exact", head: true }).eq("dono", DONO);
    const { count: nMsgs } = await db.from("umbler_mensagens").select("id", { count: "exact", head: true }).eq("dono", DONO);
    const stats = { origem, ms: Date.now() - t0, req: totalReq, msgs_gravadas: msgsGravadas, chats: nChats, mensagens: nMsgs, ...passos, membros: MEMBROS };
    const agora = new Date().toISOString();
    await gravarEstado({ ultimo_sync: agora, ultimo_ok: agora, ultimo_erro: null, stats });
    return { ok: true, ...stats };
  } catch (e) {
    const msg = String((e as Error)?.message ?? e).slice(0, 500);
    await gravarEstado({ ultimo_sync: new Date().toISOString(), ultimo_erro: msg, stats: { origem, ms: Date.now() - t0, req: totalReq, ...passos, membros: MEMBROS } });
    return { ok: false, motivo: msg };
  }
}

// ---------- webhook ----------
async function webhook(body: unknown) {
  const x = extrairDoWebhook(body);
  const { data: ev } = await db.from("umbler_eventos")
    .insert({ dono: DONO, tipo: x.tipo, chat_id: x.chatId, bruto: body as Obj }).select("id").single();
  const evId = (ev as { id: number } | null)?.id;
  try {
    const est = await lerEstado();
    if (x.chat) { const r = mapChat(x.chat, DONO, est.org_id, (est.stats?.membros as Record<string, string>) ?? {}); if (r) await db.from("umbler_chats").upsert(r, { onConflict: "id" }); }
    if (x.mensagem && x.chatId) {
      const r = mapMensagem(x.mensagem, x.chatId, DONO);
      if (r) {
        // o chat pode não existir ainda: cria o mínimo pra mensagem não ficar órfã
        await db.from("umbler_chats").upsert({ id: x.chatId, dono: DONO, ultima_msg_em: r.enviada_em, ultima_msg_de: r.de }, { onConflict: "id", ignoreDuplicates: true });
        await db.from("umbler_mensagens").upsert(r, { onConflict: "id" });
      }
    }
    // e confirma pela API (pega o que o payload não trouxe)
    const tk = token();
    if (tk && x.chatId) {
      const org = await garantirOrg(est, tk);
      const at = (await linhasAtuais([x.chatId])).get(x.chatId) ?? null;
      await sincChat(x.chatId, org, tk, at, Date.now() + 20_000, false);
    }
    if (evId) await db.from("umbler_eventos").update({ processado: true }).eq("id", evId);
  } catch (e) {
    if (evId) await db.from("umbler_eventos").update({ erro: String((e as Error)?.message ?? e).slice(0, 500) }).eq("id", evId);
  }
}

// ---------- quem pode chamar ----------
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
const emSegundoPlano = (p: Promise<unknown>) => {
  if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) EdgeRuntime.waitUntil(p); else p.catch(() => {});
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  const url = new URL(req.url);

  // 2) webhook: responde rápido, processa em segundo plano
  const k = url.searchParams.get("k");
  if (k !== null) {
    if (!(await chaveOk("umbler_webhook_chave", k))) return json(req, { ok: false }, 401);
    if (req.method !== "POST") return json(req, { ok: true, vivo: true });
    const txt = await req.text();
    if (txt.length > 2_000_000) return json(req, { ok: false, motivo: "grande_demais" }, 413);
    let body: unknown = null;
    try { body = JSON.parse(txt); } catch { body = { _texto: txt.slice(0, 50_000) }; }
    emSegundoPlano(webhook(body));
    return json(req, { ok: true });
  }

  // 1) cron
  if (await chaveOk("umbler_cron_chave", req.headers.get("x-cron-chave"))) {
    emSegundoPlano(sincronizar("cron"));
    return json(req, { ok: true, iniciado: true });
  }

  // 3) botão no app: dono ou delegado. ?status=1 só devolve o estado.
  if (await usuarioPode(req)) {
    if (url.searchParams.get("status")) return json(req, { ok: true, estado: await lerEstado(), tem_token: !!token() });
    return json(req, await sincronizar("manual"));
  }
  return json(req, { ok: false, motivo: "sem_permissao" }, 401);
});
