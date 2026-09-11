// crm-mcp — conector MCP isolado por perfil LP (Path A, compatível com ES256).
// Segurança: NÃO coleta nem guarda refresh_token/sessão pessoal do dono.
// A cada chamada (cache ~55s), a service_role (segredo do BACKEND, nunca exposto ao
// cliente nem na URL) pede ao GoTrue um access token CURTO escopado como o dono
// (admin generate_link + verify, sem enviar e-mail). Toda query de NEGÓCIO roda com
// esse token do dono (role:authenticated) -> o RLS (dono/lp_email = jwt.email) confina.
// service_role só resolve o token do conector e emite o token efêmero; NUNCA toca dado.
// v2.1 (08/09/2026): busca em listar_contatos filtra por dados->>nome (jsonb não aceita ilike direto).
// v2.2 (09/09/2026): importação em LOTE — criar_contatos_lote (até 200, um único INSERT, upsert idempotente
//   por (dono,ref_base)) e atualizar_contatos_lote (merge por id). Resposta ENXUTA {criados/atualizados,erros}
//   com Prefer return=minimal — NÃO ecoa os registros (o eco é o que estourava o limite de token do cliente).
// v2.3 (11/09/2026): MAPA & LOCAIS — buscar_local (geocoder OpenStreetMap, server-side) e definir_locais
//   (grava dados.locais=[{tipo,nome,end,lat,lng}] no contato, geocodificando o que vier sem coordenada;
//   mesmo formato que o app lê na ficha, no evento da Agenda e no Mapa de locais).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUB = "sb_publishable_B1yApF8NUHh0BRpKzoIWIQ_ukZFs9kR";
const SERVER = { name: "crm-seguros-lp", version: "2.3.0" };
const PROTOCOL = "2024-11-05";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type, mcp-protocol-version",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};
const j = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...CORS } });

async function rest(path, access, init = {}) {
  const m = (init.method || "GET").toUpperCase();
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: PUB,
      Authorization: `Bearer ${access}`,
      "Content-Type": "application/json",
      Prefer: m === "POST" || m === "PATCH" || m === "DELETE" ? "return=representation" : "",
      ...(init.headers || {}),
    },
  });
  const text = await r.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`db ${r.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

async function resolveDono(token) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/mcp_session_resolve`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_token: token }),
  });
  if (!r.ok) throw new Error("token de conector invalido");
  const rows = await r.json();
  if (!Array.isArray(rows) || rows.length === 0 || !rows[0]?.dono) throw new Error("token de conector invalido");
  return rows[0].dono;
}

const cache = new Map();
async function ephemeralAccessFor(dono) {
  const now = Date.now();
  const hit = cache.get(dono);
  if (hit && hit.exp - now > 5000) return hit.access;

  const gl = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, "Content-Type": "application/json" },
    body: JSON.stringify({ type: "magiclink", email: dono }),
  });
  if (!gl.ok) throw new Error(`generate_link ${gl.status}: ${await gl.text()}`);
  const g = await gl.json();
  const props = g.properties ?? g;
  const emailOtp = props.email_otp;
  const hashedToken = props.hashed_token;

  let vr = null;
  if (emailOtp) {
    vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", email: dono, token: emailOtp }),
    });
  }
  if ((!vr || !vr.ok) && hashedToken) {
    vr = await fetch(`${SUPABASE_URL}/auth/v1/verify`, {
      method: "POST", headers: { apikey: PUB, "Content-Type": "application/json" },
      body: JSON.stringify({ type: "email", token_hash: hashedToken }),
    });
  }
  if (!vr || !vr.ok) throw new Error(`verify ${vr ? vr.status : "?"}: ${vr ? await vr.text() : "sem otp"}`);
  const s = await vr.json();
  const access = s.access_token;
  if (!access) throw new Error("verify sem access_token");

  let exp = now + 55000;
  try { const p = JSON.parse(atob(access.split(".")[1])); if (p.exp) exp = Math.min(p.exp * 1000, now + 55000); } catch {}
  cache.set(dono, { access, exp });
  return access;
}

async function ctxFor(token) {
  const dono = await resolveDono(token);
  const access = await ephemeralAccessFor(dono);
  return { dono, access };
}

// ── geocoder (OpenStreetMap/Nominatim; sem chave; 1 req/s por política) ──
const GEO_UA = "crm-segurocomjuca/2.3 (contato: juca@segurocomjuca.com)";
function geoNorm(x) {
  const a = x.address || {};
  const nome = (x.namedetails && x.namedetails.name) || x.name || String(x.display_name || "").split(",")[0];
  const end = [a.road ? (a.road + (a.house_number ? ", " + a.house_number : "")) : "", a.suburb || a.neighbourhood || "", a.city || a.town || a.municipality || a.village || "", a.state || ""].filter(Boolean).join(" · ");
  return { nome: String(nome || "").trim(), end, lat: +x.lat, lng: +x.lon, src: "osm" };
}
async function geoBuscar(q, limite = 6) {
  const u = `https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&namedetails=1&countrycodes=br&limit=${limite}&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
  const r = await fetch(u, { headers: { "User-Agent": GEO_UA, Accept: "application/json" } });
  if (!r.ok) throw new Error("OpenStreetMap " + r.status);
  const jx = await r.json();
  return (Array.isArray(jx) ? jx : []).map(geoNorm).filter((x) => x.nome);
}
const LOC_TIPOS = new Set(["trabalho", "casa", "outro"]);
function locChave(l) { if (l.lat != null && l.lng != null && isFinite(+l.lat) && isFinite(+l.lng)) return (+l.lat).toFixed(4) + "," + (+l.lng).toFixed(4); return String(l.nome || l.end || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim(); }
function locAdd(dados, l) {
  const arr = Array.isArray(dados.locais) ? dados.locais.slice() : [];
  const k = locChave(l); if (arr.some((x) => locChave(x) === k)) return arr;
  arr.push({ tipo: LOC_TIPOS.has(l.tipo) ? l.tipo : "trabalho", nome: String(l.nome || "").trim(), end: String(l.end || "").trim(), lat: (l.lat != null && isFinite(+l.lat)) ? +l.lat : null, lng: (l.lng != null && isFinite(+l.lng)) ? +l.lng : null, src: l.src || "mcp" });
  return arr;
}

async function audit(access, dono, ferramenta, acao, alvo, detalhe, ok = true) {
  try {
    await rest(`lp_mcp_audit`, access, { method: "POST", body: JSON.stringify({ dono, ferramenta, acao, alvo, detalhe, ok }) });
  } catch {}
}

const TOOLS = [
  { name: "quem_sou_eu", description: "Diz de qual conta (e-mail) este conector fala. Prova o isolamento.", inputSchema: { type: "object", properties: {} } },
  { name: "listar_contatos", description: "Lista os SEUS contatos/nomes (base LP). 'busca' filtra pelo nome. Só a sua base.", inputSchema: { type: "object", properties: { busca: { type: "string" }, limite: { type: "number" } } } },
  { name: "criar_contato", description: "Cria um novo contato na SUA base. Campos em 'dados' (nome, telefone, recomendante, etapa, obs).", inputSchema: { type: "object", properties: { dados: { type: "object" } }, required: ["dados"] } },
  { name: "atualizar_contato", description: "Atualiza um contato SEU pelo id. Só os campos de 'dados' que mudam (merge).", inputSchema: { type: "object", properties: { id: { type: "string" }, dados: { type: "object" } }, required: ["id", "dados"] } },
  { name: "criar_contatos_lote", description: "Cria/atualiza VÁRIOS contatos de uma vez (até 200), num único INSERT. Idempotente por 'ref_base' (único por conta): reenviar o mesmo lote ATUALIZA em vez de duplicar. Resposta ENXUTA {criados, erros} — NÃO devolve os registros criados (isso pouparia token).", inputSchema: { type: "object", properties: { contatos: { type: "array", items: { type: "object", properties: { ref_base: { type: "string" }, dados: { type: "object" } } } } }, required: ["contatos"] } },
  { name: "atualizar_contatos_lote", description: "Atualiza VÁRIOS contatos SEUS de uma vez (até 200), por id, fazendo merge dos campos de 'dados'. Resposta ENXUTA {atualizados, erros} — não devolve os registros.", inputSchema: { type: "object", properties: { atualizacoes: { type: "array", items: { type: "object", properties: { id: { type: "string" }, dados: { type: "object" } }, required: ["id", "dados"] } } }, required: ["atualizacoes"] } },
  { name: "buscar_local", description: "Acha hospital, clínica, empresa ou endereço (OpenStreetMap, Brasil) e devolve nome, endereço e coordenadas — pra confirmar antes de gravar em definir_locais.", inputSchema: { type: "object", properties: { q: { type: "string" }, limite: { type: "number" } }, required: ["q"] } },
  { name: "definir_locais", description: "Grava LOCAIS (trabalho/casa/outro) em contatos SEUS, por id (até 100). Cada item: {id, tipo:'trabalho'|'casa'|'outro', nome, end?, lat?, lng?}. Sem lat/lng, geocodifica 'nome + end' sozinho (OpenStreetMap). Faz merge: não duplica local igual. É o que aparece na ficha, vai pro evento da Agenda e pro Mapa de locais. Resposta ENXUTA {atualizados, sem_coordenada, erros}.", inputSchema: { type: "object", properties: { locais: { type: "array", items: { type: "object", properties: { id: { type: "string" }, tipo: { type: "string" }, nome: { type: "string" }, end: { type: "string" }, lat: { type: "number" }, lng: { type: "number" } }, required: ["id", "nome"] } } }, required: ["locais"] } },
  { name: "listar_substituicoes", description: "Lista as SUAS apólices em Substituição (clientes + apólices). Só a sua base.", inputSchema: { type: "object", properties: { limite: { type: "number" } } } },
  { name: "listar_atrasos", description: "Lista a SUA Lista de Atraso (apólices vencidas em tratativa). Só a sua base.", inputSchema: { type: "object", properties: { limite: { type: "number" } } } },
  { name: "atualizar_atraso", description: "Atualiza a tratativa/próximo contato de um item SEU da Lista de Atraso, pelo id.", inputSchema: { type: "object", properties: { id: { type: "number" }, tratativa: { type: "string" }, prox_contato: { type: "string" } }, required: ["id"] } },
  { name: "revogar_conector", description: "DESTRUTIVA: revoga ESTE conector (a URL para de funcionar). Exige confirmar:true.", inputSchema: { type: "object", properties: { confirmar: { type: "boolean" } } } },
];

async function callTool(name, args, ctx) {
  const lim = Math.min(Number(args?.limite) || 25, 200);
  switch (name) {
    case "quem_sou_eu":
      return { dono: ctx.dono, nota: "toda leitura/escrita é confinada a este e-mail pelo RLS do banco." };
    case "listar_contatos": {
      let q = `lp_contatos?select=id,dados,atualizado&order=atualizado.desc&limit=${lim}`;
      if (args?.busca) {
        const b = String(args.busca).replace(/[,.*()]/g, " ").trim();
        if (b) q += `&dados->>nome=ilike.*${encodeURIComponent(b)}*`;
      }
      return await rest(q, ctx.access);
    }
    case "criar_contato": {
      const out = await rest(`lp_contatos`, ctx.access, { method: "POST", body: JSON.stringify({ dono: ctx.dono, dados: args.dados ?? {} }) });
      const id = Array.isArray(out) ? out[0]?.id : undefined;
      await audit(ctx.access, ctx.dono, "criar_contato", "escrita", `lp_contatos:${id ?? "?"}`, { dados: args.dados });
      return out;
    }
    case "atualizar_contato": {
      const cur = await rest(`lp_contatos?id=eq.${encodeURIComponent(args.id)}&select=dados`, ctx.access);
      if (!cur?.length) return { aviso: "nenhum contato SEU com esse id (o RLS não devolveu linha)." };
      const merged = { ...(cur[0]?.dados ?? {}), ...(args.dados ?? {}) };
      const out = await rest(`lp_contatos?id=eq.${encodeURIComponent(args.id)}`, ctx.access, { method: "PATCH", body: JSON.stringify({ dados: merged }) });
      await audit(ctx.access, ctx.dono, "atualizar_contato", "escrita", `lp_contatos:${args.id}`, { dados: args.dados });
      return out;
    }
    case "criar_contatos_lote": {
      const arr = Array.isArray(args?.contatos) ? args.contatos : [];
      if (!arr.length) return { criados: 0, erros: ["contatos vazio"] };
      if (arr.length > 200) return { criados: 0, erros: ["máximo 200 por chamada"] };
      const rows = arr.map((c) => {
        const o = c || {};
        const dados = (o.dados && typeof o.dados === "object") ? o.dados : (() => { const { ref_base, ...rest } = o; return rest; })();
        return { dono: ctx.dono, ref_base: (o.ref_base != null && o.ref_base !== "") ? String(o.ref_base) : null, dados };
      });
      // um único INSERT ... ON CONFLICT (dono,ref_base) — resposta minimal (não ecoa os registros).
      await rest(`lp_contatos?on_conflict=dono,ref_base`, ctx.access, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      await audit(ctx.access, ctx.dono, "criar_contatos_lote", "escrita", "lp_contatos:lote", { n: rows.length });
      return { criados: rows.length, erros: [] };
    }
    case "atualizar_contatos_lote": {
      const arr = Array.isArray(args?.atualizacoes) ? args.atualizacoes : [];
      if (!arr.length) return { atualizados: 0, erros: ["atualizacoes vazio"] };
      if (arr.length > 200) return { atualizados: 0, erros: ["máximo 200 por chamada"] };
      const ids = [...new Set(arr.map((a) => a && a.id).filter((x) => x != null).map(String))];
      const inList = ids.map((x) => `"${x.replace(/["\\]/g, "")}"`).join(",");
      const cur = ids.length ? await rest(`lp_contatos?id=in.(${inList})&select=id,dados`, ctx.access) : [];
      const byId = new Map((cur || []).map((r) => [String(r.id), r.dados || {}]));
      const rows = []; const erros = [];
      for (const a of arr) {
        const id = (a && a.id != null) ? String(a.id) : null;
        if (!id || !byId.has(id)) { erros.push({ id: (a && a.id) ?? null, motivo: "não encontrado (RLS)" }); continue; }
        rows.push({ dono: ctx.dono, id, dados: { ...byId.get(id), ...((a.dados && typeof a.dados === "object") ? a.dados : {}) } });
      }
      // um único upsert por (dono,id) com os dados já mesclados — resposta minimal.
      if (rows.length) await rest(`lp_contatos?on_conflict=dono,id`, ctx.access, {
        method: "POST",
        headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
        body: JSON.stringify(rows),
      });
      await audit(ctx.access, ctx.dono, "atualizar_contatos_lote", "escrita", "lp_contatos:lote", { n: rows.length, erros: erros.length });
      return { atualizados: rows.length, erros };
    }
    case "buscar_local": {
      const q = String(args?.q || "").trim(); if (q.length < 3) return { resultados: [], aviso: "digite pelo menos 3 letras" };
      return { resultados: await geoBuscar(q, Math.min(Number(args?.limite) || 6, 10)) };
    }
    case "definir_locais": {
      const arr = Array.isArray(args?.locais) ? args.locais : [];
      if (!arr.length) return { atualizados: 0, erros: ["locais vazio"] };
      if (arr.length > 100) return { atualizados: 0, erros: ["máximo 100 por chamada"] };
      const ids = [...new Set(arr.map((a) => a && a.id).filter((x) => x != null).map(String))];
      const inList = ids.map((x) => `"${x.replace(/["\\]/g, "")}"`).join(",");
      const cur = ids.length ? await rest(`lp_contatos?id=in.(${inList})&select=id,dados`, ctx.access) : [];
      const byId = new Map((cur || []).map((r) => [String(r.id), r.dados || {}]));
      const erros = []; const semCoord = []; const tocados = new Set(); const cacheGeo = new Map();
      for (const a of arr) {
        const id = (a && a.id != null) ? String(a.id) : null;
        if (!id || !byId.has(id)) { erros.push({ id: (a && a.id) ?? null, motivo: "não encontrado (RLS)" }); continue; }
        const l = { tipo: a.tipo, nome: String(a.nome || "").trim(), end: String(a.end || "").trim(), lat: a.lat, lng: a.lng, src: "mcp" };
        if (!l.nome) { erros.push({ id, motivo: "sem nome do local" }); continue; }
        if (l.lat == null || l.lng == null) {
          const q = [l.nome, l.end].filter(Boolean).join(", ");
          let hit = cacheGeo.get(q);
          if (hit === undefined) { try { hit = (await geoBuscar(q, 1))[0] || null; } catch { hit = null; } cacheGeo.set(q, hit); await new Promise((r) => setTimeout(r, 1100)); }
          if (hit) { l.lat = hit.lat; l.lng = hit.lng; if (!l.end) l.end = hit.end; l.src = "osm"; } else semCoord.push({ id, nome: l.nome });
        }
        const dados = byId.get(id); const novo = locAdd(dados, l);
        if (novo.length !== (Array.isArray(dados.locais) ? dados.locais.length : 0)) { byId.set(id, { ...dados, locais: novo }); tocados.add(id); }
      }
      const rows = [...tocados].map((id) => ({ dono: ctx.dono, id, dados: byId.get(id) }));
      if (rows.length) await rest(`lp_contatos?on_conflict=dono,id`, ctx.access, { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows) });
      await audit(ctx.access, ctx.dono, "definir_locais", "escrita", "lp_contatos:locais", { n: rows.length, sem_coordenada: semCoord.length, erros: erros.length });
      return { atualizados: rows.length, sem_coordenada: semCoord, erros };
    }
    case "listar_substituicoes": {
      const clientes = await rest(`subst_clientes?select=*&limit=${lim}`, ctx.access);
      const apolices = await rest(`subst_apolices?select=*&order=atualizado.desc&limit=${lim}`, ctx.access);
      return { clientes, apolices };
    }
    case "listar_atrasos":
      return await rest(`vendas_atrasos?select=*&resolvido_em=is.null&order=vencido_em.asc&limit=${lim}`, ctx.access);
    case "atualizar_atraso": {
      const patch = {};
      if (args.tratativa !== undefined) patch.tratativa = args.tratativa;
      if (args.prox_contato !== undefined) patch.prox_contato = args.prox_contato;
      const out = await rest(`vendas_atrasos?id=eq.${Number(args.id)}`, ctx.access, { method: "PATCH", body: JSON.stringify(patch) });
      if (!Array.isArray(out) || out.length === 0) return { aviso: "nenhum item SEU com esse id (o RLS não devolveu linha)." };
      await audit(ctx.access, ctx.dono, "atualizar_atraso", "escrita", `vendas_atrasos:${args.id}`, patch);
      return out;
    }
    case "revogar_conector": {
      if (args?.confirmar !== true)
        return { aviso: "operação DESTRUTIVA: revoga este conector e a URL para de funcionar. Chame de novo com confirmar:true." };
      const out = await rest(`lp_mcp_sessions?dono=eq.${encodeURIComponent(ctx.dono)}`, ctx.access, { method: "DELETE" });
      await audit(ctx.access, ctx.dono, "revogar_conector", "destrutiva", "lp_mcp_sessions", { revogados: Array.isArray(out) ? out.length : null });
      return { revogado: true, aviso: "conector revogado — esta URL não funciona mais. Gere outra com o admin." };
    }
    default:
      throw new Error(`ferramenta desconhecida: ${name}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const url = new URL(req.url);
  const seg = url.pathname.split("/").filter(Boolean).pop() || "";

  if (req.method === "POST" && seg && seg !== "crm-mcp") {
    let msg;
    try { msg = await req.json(); } catch { return j({ jsonrpc: "2.0", id: null, error: { code: -32700, message: "parse error" } }); }
    const reply = (result) => j({ jsonrpc: "2.0", id: msg.id, result });
    const fail = (code, message) => j({ jsonrpc: "2.0", id: msg.id, error: { code, message } });

    if (msg.method === "initialize") return reply({ protocolVersion: PROTOCOL, capabilities: { tools: {} }, serverInfo: SERVER });
    if (msg.method === "ping") return reply({});
    if (typeof msg.method === "string" && msg.method.startsWith("notifications/")) return new Response(null, { status: 202, headers: CORS });
    if (msg.method === "tools/list") return reply({ tools: TOOLS });
    if (msg.method === "tools/call") {
      try {
        const ctx = await ctxFor(seg);
        const out = await callTool(msg.params?.name, msg.params?.arguments ?? {}, ctx);
        return reply({ content: [{ type: "text", text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return reply({ content: [{ type: "text", text: "erro: " + String(e) }], isError: true });
      }
    }
    return fail(-32601, "metodo nao suportado: " + msg.method);
  }
  return j({ ok: true, server: SERVER, hint: "MCP endpoint. Use POST /crm-mcp/<token>." });
});
