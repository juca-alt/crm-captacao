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
// v2.4 (11/09/2026): ROTINAS por local — definir_locais aceita rotinas:[{dias,turno,ini,fim,obs}] ("sexta de manhã");
//   local que já existe recebe as rotinas novas (merge, sem duplicar).
// v2.5 (11/09/2026, auditoria): definir_locais geocodifica PRIMEIRO (teto 25 sem coordenada por chamada, pra não
//   estourar o tempo da função), relê `dados` logo antes de gravar (sem sobrescrever edição feita no app no meio
//   do caminho), grava só o campo locais, e limita tamanhos (nome/end/obs 120, 10 rotinas/local, 20 locais/contato,
//   lat/lng em faixa, hora HH:MM).
// v3.0 (23/10/2026): LEITURA pra decisão — conversas do WhatsApp (Umbler Talk: conversas_listar, conversa_ler,
//   conversas_buscar, conversas_status), ponte CRM↔WhatsApp (contato_conversa, casando telefone pelos 8 últimos
//   dígitos + DDD), funil (funil_resumo, negocios_listar: PA = pm×12, sem próxima atividade, congelados, tarefas
//   atrasadas, dias na etapa) e UW/Emissão (emissao_pendencias). TUDO SÓ LEITURA, com o token do dono (RLS confina);
//   umbler_* nem tem escrita pro authenticated. Nenhuma ferramenta envia mensagem: responder cliente é sempre humano
//   (Gustavo ou Victor). Nunca devolve a coluna `bruto`; respostas v3 saem em JSON compacto, sem campos vazios.

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PUB = "sb_publishable_B1yApF8NUHh0BRpKzoIWIQ_ukZFs9kR";
const SERVER = { name: "crm-seguros-lp", version: "3.0.0" };
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
const LOC_DIAS = ["seg", "ter", "qua", "qui", "sex", "sab", "dom"];
const LOC_TURNOS = new Set(["manha", "tarde", "noite"]);
const S120 = (v) => String(v || "").trim().slice(0, 120);
const HORA = (v) => (/^\d{2}:\d{2}$/.test(String(v || "").trim()) ? String(v).trim() : "");
function rotNorm(r) {
  if (!r) return null;
  const dias = [...new Set((Array.isArray(r.dias) ? r.dias : String(r.dias || "").split(/[,\s\/]+/)).map((x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").slice(0, 3)).filter((x) => LOC_DIAS.includes(x)))];
  const turno = LOC_TURNOS.has(String(r.turno || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")) ? String(r.turno).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "") : "";
  const ini = HORA(r.ini), fim = HORA(r.fim), obs = S120(r.obs);
  if (!dias.length && !turno && !ini && !obs) return null;
  return { dias, turno, ini, fim, obs };
}
const rotTxt = (r) => [r.dias.join("/"), r.turno, [r.ini, r.fim].filter(Boolean).join("-"), r.obs].filter(Boolean).join("|");
function rotMerge(existentes, novas) {
  const arr = Array.isArray(existentes) ? existentes.slice() : []; let mudou = false;
  (Array.isArray(novas) ? novas : []).slice(0, 10).map(rotNorm).filter(Boolean).forEach((r) => { if (arr.length >= 10) return; if (!arr.some((x) => rotTxt(rotNorm(x) || { dias: [], turno: "", ini: "", fim: "", obs: "" }) === rotTxt(r))) { arr.push(r); mudou = true; } });
  return { arr, mudou };
}
function locAdd(dados, l) {
  const arr = Array.isArray(dados.locais) ? dados.locais.slice() : [];
  const k = locChave(l); const ix = arr.findIndex((x) => locChave(x) === k);
  if (ix >= 0) { const m = rotMerge(arr[ix].rotinas, l.rotinas); if (!m.mudou) return arr; arr[ix] = { ...arr[ix], rotinas: m.arr }; return arr; }
  if (arr.length >= 20) return arr;   // teto de locais por contato
  const okLat = l.lat != null && isFinite(+l.lat) && Math.abs(+l.lat) <= 90, okLng = l.lng != null && isFinite(+l.lng) && Math.abs(+l.lng) <= 180;
  const novo = { tipo: LOC_TIPOS.has(l.tipo) ? l.tipo : "trabalho", nome: S120(l.nome), end: S120(l.end), lat: okLat ? +l.lat : null, lng: okLng ? +l.lng : null, src: l.src || "mcp" };
  const m = rotMerge([], l.rotinas); if (m.arr.length) novo.rotinas = m.arr;
  arr.push(novo); return arr;
}

async function audit(access, dono, ferramenta, acao, alvo, detalhe, ok = true) {
  try {
    await rest(`lp_mcp_audit`, access, { method: "POST", body: JSON.stringify({ dono, ferramenta, acao, alvo, detalhe, ok }) });
  } catch {}
}

// ═══ v3.0 · LEITURA (Umbler + funil + emissão) ══════════════════════════════════════════════════
// Funções puras exportadas (testadas em ferramentas_test.ts). Nada aqui escreve no banco.

// conta pelo cabeçalho content-range (Prefer count=exact), sem trazer linhas
async function restCount(path, access) {
  const sep = path.includes("?") ? "&" : "?";
  const r = await fetch(`${SUPABASE_URL}/rest/v1/${path}${sep}limit=1`, {
    method: "HEAD",
    headers: { apikey: PUB, Authorization: `Bearer ${access}`, Prefer: "count=exact" },
  });
  if (!r.ok) throw new Error(`db ${r.status} (contagem)`);
  const m = /\/(\d+)$/.exec(r.headers.get("content-range") || "");
  return m ? Number(m[1]) : null;
}

export const LIM = (v, def, max) => { const n = Math.floor(Number(v)); return Math.min(isFinite(n) && n > 0 ? n : def, max); };
export const soDigitos = (v) => String(v ?? "").replace(/\D/g, "");
export function hojeRecife(agora = Date.now()) { return new Date(agora - 3 * 3600e3).toISOString().slice(0, 10); } // UTC-3 fixo

// 'desde': AAAA-MM-DD (meia-noite de Recife) ou ISO completo → ISO UTC. Inválido → erro claro.
export function isoArg(v, campo = "desde") {
  if (v == null || String(v).trim() === "") return null;
  const s = String(v).trim();
  const t = /^\d{4}-\d{2}-\d{2}$/.test(s) ? Date.parse(s + "T00:00:00-03:00") : Date.parse(s);
  if (!isFinite(t)) throw new Error(`data inválida em '${campo}' (use AAAA-MM-DD)`);
  return new Date(t).toISOString();
}

// remove null/undefined/""/[] (resposta enxuta); false e 0 ficam
export function enxuto(o) {
  const out = {};
  for (const [k, v] of Object.entries(o || {})) {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    out[k] = v;
  }
  return out;
}

// valor pra ilike do PostgREST: tira * , ( ) (reservados) e escapa os curingas do LIKE (\ % _)
export function likeSeguro(v) {
  return String(v ?? "").replace(/[*,()]/g, " ").replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_").replace(/\s+/g, " ").trim();
}
export const inLista = (ids) => ids.map((x) => `"${encodeURIComponent(String(x).replace(/["\\]/g, ""))}"`).join(",");

// Telefone BR → {ddd, ult8}. Tolera 55, DDD e o 9º dígito (compara pelos 8 últimos).
export function telChave(v) {
  let d = soDigitos(v);
  if (d.length >= 12 && d.startsWith("55")) d = d.slice(2);
  if (d.length < 8) return null;
  const ddd = (d.length === 11 && d[2] === "9") || d.length === 10 ? d.slice(0, 2) : "";
  return { ddd, ult8: d.slice(-8) };
}
// 2 = mesmos 8 dígitos e mesmo DDD · 1 = mesmos 8 dígitos, DDD desconhecido de um lado · 0 = outro número
export function telScore(a, b) {
  const x = telChave(a), y = telChave(b);
  if (!x || !y || x.ult8 !== y.ult8) return 0;
  if (x.ddd && y.ddd) return x.ddd === y.ddd ? 2 : 0;
  return 1;
}

// minúscula sem acento preservando o comprimento UTF-16 (o índice do achado vale no texto original)
function dobra(s) { return Array.from(String(s), (ch) => { const f = ch.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); return f.length === ch.length ? f : ch; }).join(""); }
// trecho de ~tam caracteres em volta do termo
export function trecho(texto, termo, tam = 300) {
  const t = String(texto ?? "");
  if (t.length <= tam) return t;
  const i = dobra(t).indexOf(dobra(termo));
  const ini = i < 0 ? 0 : Math.max(0, Math.min(i - Math.floor((tam - String(termo).length) / 2), t.length - tam));
  return (ini > 0 ? "…" : "") + t.slice(ini, ini + tam) + (ini + tam < t.length ? "…" : "");
}
export const corta = (s, n) => { const t = String(s ?? ""); return t.length > n ? t.slice(0, n) + "…" : t; };
export function horasDesde(iso, agora = Date.now()) { const t = Date.parse(iso); return isFinite(t) ? Math.round(((agora - t) / 36e5) * 10) / 10 : null; }
function diasEntre(dia, hoje) {
  const a = Date.parse(String(dia || "").slice(0, 10) + "T00:00:00Z"), b = Date.parse(hoje + "T00:00:00Z");
  return isFinite(a) && isFinite(b) ? Math.max(0, Math.round((b - a) / 864e5)) : null;
}

// ── Umbler ──
const CHAT_COLS = "id,dono,contato_nome,contato_tel,contato_tel_norm,canal,setor,atendente,etiquetas,aberto,aguardando_desde,nao_lidas,ultima_msg_em,ultima_msg_de,ultima_msg_previa,criado_em,fechado_em,historico_completo,msgs_desde,sincronizado_em";
function chatLinha(c, completo = false, dono = null) {
  const base = {
    id: c.id, contato_nome: c.contato_nome, contato_tel: c.contato_tel, canal: c.canal, atendente: c.atendente,
    aberto: c.aberto, ultima_msg_em: c.ultima_msg_em, ultima_msg_de: c.ultima_msg_de,
    ultima_msg_previa: corta(c.ultima_msg_previa, 200), nao_lidas: c.nao_lidas || undefined, etiquetas: c.etiquetas,
    horas_sem_resposta: c.ultima_msg_de === "cliente" ? horasDesde(c.ultima_msg_em) : undefined,
    dono: dono && c.dono && c.dono !== dono ? c.dono : undefined,
  };
  if (completo) Object.assign(base, { setor: c.setor, aguardando_desde: c.aguardando_desde, criado_em: c.criado_em, fechado_em: c.fechado_em, historico_completo: c.historico_completo, msgs_desde: c.msgs_desde, sincronizado_em: c.sincronizado_em, ultima_msg_previa: undefined });
  return enxuto(base);
}
const msgLinha = (m) => enxuto({ em: m.enviada_em, de: m.de, autor: m.autor, tipo: m.tipo && m.tipo !== "Text" ? m.tipo : undefined, texto: corta(m.texto, 2000), arquivo_nome: m.arquivo_nome, privada: m.privada ? true : undefined });

// chats de um ou mais telefones (8 últimos dígitos no banco; DDD conferido aqui), mais recente primeiro
async function chatsDoTelefone(ctx, tels) {
  const chaves: string[] = [...new Set<string>((tels || []).map(telChave).filter(Boolean).map((k) => k.ult8))].slice(0, 4);
  const achados = new Map();
  for (const u8 of chaves) {
    const rows = await rest(`umbler_chats?select=${CHAT_COLS}&contato_tel_norm=ilike.*${encodeURIComponent(u8)}&order=ultima_msg_em.desc.nullslast&limit=10`, ctx.access);
    for (const c of rows || []) {
      const s = Math.max(...tels.map((t) => telScore(t, c.contato_tel_norm || c.contato_tel)));
      if (s > 0 && !achados.has(c.id)) achados.set(c.id, { c, s });
    }
  }
  return [...achados.values()].sort((a, b) => b.s - a.s || String(b.c.ultima_msg_em || "").localeCompare(String(a.c.ultima_msg_em || ""))).map((x) => x.c);
}
async function lerMensagens(ctx, chatId, limite, desde) {
  let q = `umbler_mensagens?select=enviada_em,de,autor,tipo,texto,arquivo_nome,privada&chat_id=eq.${encodeURIComponent(chatId)}&order=enviada_em.desc&limit=${limite}`;
  if (desde) q += `&enviada_em=gte.${encodeURIComponent(desde)}`;
  const rows = (await rest(q, ctx.access)) || [];
  return { mensagens: rows.reverse().map(msgLinha), mais_antigas_omitidas: rows.length === limite || undefined };
}

// ── Funil (espelho das regras do vendas.html: funilDe, cfg em app_settings.lp_funil_cfg, pm×12) ──
const ET = (fluxo, enc) => ({ ordem: [...fluxo, ...enc], enc: new Set(enc), label: {} });
const BASE_PIPE = ["Clientes Ativos", "Contato/Revisita", "Revisita agendada", "Proposta", "Fechamento"];
const NEG_PIPE = ["Oportunidade", "Em contato", "Proposta", "Fechamento"];
export function funilCfgPadrao() {
  return {
    lp: ET(["SitPlan", "TA", "OI/FF", "P/C", "C2", "N", "FA", "EMISSÃO", "DELIVERY"], ["Não", "Prop. Cancelada", "Apól. Cancelada"]),
    bc: ET(["Clientes Ativos", "Contato Agenda/Revisita", "Agendada Revisita", "Novo Negócio/Resolução pós Revisita", "N/Emissão", "Emissão Final", "Venda ganha", "Delivery"], ["Venda perdida"]),
    vg: ET(NEG_PIPE, ["Ganho", "Perdido"]), prud: ET(NEG_PIPE, ["Ganho", "Perdido"]),
    mfo: ET(["Oportunidade", "Em contato", "Análise", "Proposta", "Fechamento"], ["Ganho", "Perdido"]),
    "vg-bc": ET(BASE_PIPE, ["Ganho", "Perdido"]), "prud-bc": ET(BASE_PIPE, ["Ganho", "Perdido"]), "mfo-bc": ET(BASE_PIPE, ["Ganho", "Perdido"]),
  };
}
// cfg salva pelo admin no app ({funil:[{id,label,enc}]}) por cima do padrão
export function funilCfgDe(valor) {
  const cfg = funilCfgPadrao();
  if (valor && typeof valor === "object") for (const [f, arr] of Object.entries(valor)) {
    if (!Array.isArray(arr) || !arr.length) continue;
    const ok = arr.filter((e) => e && e.id);
    cfg[f] = { ordem: ok.map((e) => String(e.id)), enc: new Set(ok.filter((e) => e.enc).map((e) => String(e.id))), label: Object.fromEntries(ok.filter((e) => e.label && e.label !== e.id).map((e) => [String(e.id), String(e.label).trim()])) };
  }
  return cfg;
}
export const FUNIL_NOME = { nn: "Vida Individual · Novos Negócios", bc: "Vida Individual · Negócios na Base", vg: "Vida em Grupo · Novos Negócios", prud: "Prud. Demais · Novos Negócios", mfo: "MFO · Novos Negócios", "vg-bc": "Vida em Grupo · Negócios na Base", "prud-bc": "Prud. Demais · Negócios na Base", "mfo-bc": "MFO · Negócios na Base" };
const cfgKey = (fid) => (fid === "nn" ? "lp" : fid);
// igual ao funilDe do app: funil desconhecido (ex.: 'bn' base de nomes, 'prospects') com etapa cai em Novos Negócios
export function funilDe(f, cfg) { return f && f !== "nn" && f !== "lp" && cfg[f] ? f : f === "bc" ? "bc" : "nn"; }
const ehBase = (fid) => fid === "bc" || /-bc$/.test(fid);
// 'aberto' | 'encerrado' | 'carteira' (1ª coluna dos Negócios na Base = cliente parado, fora do fluxo)
export function classeEtapa(fid, etapa, cfg) {
  if (ehBase(fid) && etapa === "Clientes Ativos") return "carteira";
  return cfg[cfgKey(fid)]?.enc.has(etapa) ? "encerrado" : "aberto";
}
const num = (v) => { const n = Number(v); return isFinite(n) && n > 0 ? n : 0; };
function anceScore(a) { return a && typeof a === "object" ? ["a", "n", "c", "e", "avisado"].filter((k) => a[k]).length : null; }

// linha de lp_contatos (select com caminhos jsonb) → negócio normalizado; null se não é negócio
export function negocioDe(r, cfg, hoje) {
  const etapa = String(r?.etapa ?? "").trim();
  if (!etapa || r.merged_into) return null;
  const fid = funilDe(r.funil, cfg);
  const pm = num(r.pm) || num(r.premio_mes);
  const pend = (Array.isArray(r.tarefas) ? r.tarefas : []).filter((t) => t && typeof t === "object" && !t.feito);
  const prox = pend.filter((t) => t.quando).sort((a, b) => `${a.quando} ${a.hora || ""}`.localeCompare(`${b.quando} ${b.hora || ""}`))[0] || pend[0] || null;
  const atrasadas = pend.filter((t) => t.quando && String(t.quando).slice(0, 10) < hoje).length;
  let dia = null;
  for (const i of Array.isArray(r.interacoes) ? r.interacoes : []) {
    if (i && i.k === "etapa" && i.para === etapa) { const d = String(i.dia || i.ts || "").slice(0, 10); if (d && (!dia || d > dia)) dia = d; }
  }
  const cg = r.congelado && typeof r.congelado === "object" && r.congelado.em ? enxuto({ em: r.congelado.em, ate: r.congelado.ate, motivo: corta(r.congelado.motivo, 200) }) : null;
  const est = anceScore(r.ance);
  return {
    id: r.id, dono: r.dono, nome: r.nome, funil: fid, etapa, classe: classeEtapa(fid, etapa, cfg),
    etapa_label: cfg[cfgKey(fid)]?.label?.[etapa], status: r.status, temperatura: r.temperatura,
    estrelas: est != null ? est : num(r.estrelas) || undefined,
    pm: pm || null, pa: pm ? Math.round(pm * 12 * 100) / 100 : null,
    receita_estimada: num(r.receita_estimada) || undefined,   // MFO: o app soma receita estimada, não PA
    dias_na_etapa: diasEntre(dia || r.criadoEm, hoje), dias_desde: dia ? "mudança de etapa" : (r.criadoEm ? "criação" : undefined),
    proxima_atividade: prox ? enxuto({ quando: prox.quando, hora: prox.hora, tipo: prox.tipo, tit: corta(prox.tit, 160) }) : null,
    tarefas_pendentes: pend.length, tarefas_atrasadas: atrasadas,
    telefone: r.telefone, congelado: cg,
  };
}

const r2 = (n) => Math.round(n * 100) / 100;
const novoAcc = () => ({ quantidade: 0, pa_total: 0, sem_valor: 0, sem_proxima_atividade: 0, congelados: 0, tarefas_atrasadas: 0 });
function soma(acc, n) {
  acc.quantidade++; if (n.pa) acc.pa_total = r2(acc.pa_total + n.pa); else acc.sem_valor++;
  if (!n.proxima_atividade) acc.sem_proxima_atividade++; if (n.congelado) acc.congelados++; acc.tarefas_atrasadas += n.tarefas_atrasadas;
  if (n.receita_estimada) acc.receita_estimada_total = r2((acc.receita_estimada_total || 0) + n.receita_estimada);
}
// agrega por funil → etapa (ordem da cfg; etapas fora da cfg no fim). Encerrados e carteira à parte.
export function resumirFunil(negocios, cfg, filtroFunil = null) {
  const porF = new Map();
  for (const n of negocios) {
    if (filtroFunil && n.funil !== filtroFunil) continue;
    if (!porF.has(n.funil)) porF.set(n.funil, []);
    porF.get(n.funil).push(n);
  }
  const ordemF = Object.keys(FUNIL_NOME);
  const pos = (f) => { const i = ordemF.indexOf(f); return i < 0 ? 99 : i; };
  const funis = [...porF.keys()].sort((a, b) => pos(a) - pos(b) || a.localeCompare(b)).map((fid) => {
    const lista = porF.get(fid), c = cfg[cfgKey(fid)] || { ordem: [], label: {} };
    const etapas = [...new Set([...c.ordem, ...lista.map((n) => n.etapa)])];
    const abertos = novoAcc(), porEtapa = [], encerrados = [];
    let carteira = 0;
    for (const e of etapas) {
      const ns = lista.filter((n) => n.etapa === e);
      if (!ns.length) continue;
      const cls = ns[0].classe, lbl = c.label?.[e];
      if (cls === "carteira") { carteira += ns.length; continue; }
      if (cls === "encerrado") { encerrados.push(enxuto({ etapa: e, label: lbl, quantidade: ns.length, pa_total: r2(ns.reduce((s, n) => s + (n.pa || 0), 0)) || undefined })); continue; }
      const acc = novoAcc(); ns.forEach((n) => { soma(acc, n); soma(abertos, n); });
      porEtapa.push(enxuto({ etapa: e, label: lbl, fora_da_cfg: c.ordem.includes(e) ? undefined : true, ...acc }));
    }
    return enxuto({ funil: fid, nome: FUNIL_NOME[fid] || fid, abertos, etapas: porEtapa, encerrados, carteira_clientes_ativos: carteira || undefined });
  });
  const total = novoAcc();
  negocios.filter((n) => n.classe === "aberto" && (!filtroFunil || n.funil === filtroFunil)).forEach((n) => soma(total, n));
  return { total_abertos: total, funis };
}

const NEG_SEL = "id,dono,nome:dados->>nome,funil:dados->>funil,etapa:dados->>etapa,status:dados->>status,temperatura:dados->>temperatura,estrelas:dados->estrelas,ance:dados->ance,pm:dados->pm,premio_mes:dados->premio_mes,receita_estimada:dados->receita_estimada,telefone:dados->>telefone,telefones_alt:dados->telefones_alt,tarefas:dados->tarefas,interacoes:dados->interacoes,congelado:dados->congelado,criadoEm:dados->>criadoEm,merged_into:dados->>merged_into";
async function lerCfgFunil(ctx) {
  try { const r = await rest(`app_settings?chave=eq.lp_funil_cfg&select=valor`, ctx.access); return funilCfgDe(r?.[0]?.valor); }
  catch { return funilCfgDe(null); }
}
// O RLS também mostra bases que outros donos delegaram a este e-mail. Pra número de decisão não misturar pipelines:
// base 'minha' (padrão) = só o dono do conector · 'todas' = tudo que o RLS mostra · um e-mail = só aquela base.
export function filtroBase(base, dono, col) {
  const b = String(base ?? "").trim().toLowerCase();
  if (b === "todas") return "";
  return `&${col}=eq.${encodeURIComponent(b && b !== "minha" && b.includes("@") ? b : dono)}`;
}
const BASE_ARG = { type: "string", description: "'minha' (padrão: só a sua base) | 'todas' (inclui bases delegadas a você) | e-mail de uma base delegada" };
// só as linhas COM etapa (a base de nomes, ~6 mil sem etapa, nem sai do banco); só os caminhos jsonb usados
async function carregarNegocios(ctx, base) {
  const cfg = await lerCfgFunil(ctx), hoje = hojeRecife(), negocios = [];
  for (let off = 0, i = 0; i < 20; i++) {
    const page = (await rest(`lp_contatos?select=${NEG_SEL}&dados->>etapa=not.is.null${filtroBase(base, ctx.dono, "dono")}&order=id.asc&limit=1000&offset=${off}`, ctx.access)) || [];
    for (const r of page) { const n = negocioDe(r, cfg, hoje); if (n) negocios.push(n); }
    if (!page.length || page.length < 1000) break;
    off += page.length;
  }
  return { cfg, hoje, negocios };
}
const negLinha = (n, dono) => enxuto({ ...n, classe: n.classe === "aberto" ? undefined : n.classe, tarefas_pendentes: undefined, dono: n.dono !== dono ? n.dono : undefined });

const LEITURA = " SOMENTE LEITURA: este conector não envia mensagem nem altera nada — responder ao cliente é sempre feito por um humano (Gustavo ou Victor) no WhatsApp/Umbler.";
const COMPACTO = new Set(["conversas_listar", "conversa_ler", "conversas_buscar", "conversas_status", "contato_conversa", "funil_resumo", "negocios_listar", "emissao_pendencias"]);

const TOOLS = [
  { name: "quem_sou_eu", description: "Diz de qual conta (e-mail) este conector fala. Prova o isolamento.", inputSchema: { type: "object", properties: {} } },
  { name: "listar_contatos", description: "Lista os SEUS contatos/nomes (base LP). 'busca' filtra pelo nome. Só a sua base.", inputSchema: { type: "object", properties: { busca: { type: "string" }, limite: { type: "number" } } } },
  { name: "criar_contato", description: "Cria um novo contato na SUA base. Campos em 'dados' (nome, telefone, recomendante, etapa, obs).", inputSchema: { type: "object", properties: { dados: { type: "object" } }, required: ["dados"] } },
  { name: "atualizar_contato", description: "Atualiza um contato SEU pelo id. Só os campos de 'dados' que mudam (merge).", inputSchema: { type: "object", properties: { id: { type: "string" }, dados: { type: "object" } }, required: ["id", "dados"] } },
  { name: "criar_contatos_lote", description: "Cria/atualiza VÁRIOS contatos de uma vez (até 200), num único INSERT. Idempotente por 'ref_base' (único por conta): reenviar o mesmo lote ATUALIZA em vez de duplicar. Resposta ENXUTA {criados, erros} — NÃO devolve os registros criados (isso pouparia token).", inputSchema: { type: "object", properties: { contatos: { type: "array", items: { type: "object", properties: { ref_base: { type: "string" }, dados: { type: "object" } } } } }, required: ["contatos"] } },
  { name: "atualizar_contatos_lote", description: "Atualiza VÁRIOS contatos SEUS de uma vez (até 200), por id, fazendo merge dos campos de 'dados'. Resposta ENXUTA {atualizados, erros} — não devolve os registros.", inputSchema: { type: "object", properties: { atualizacoes: { type: "array", items: { type: "object", properties: { id: { type: "string" }, dados: { type: "object" } }, required: ["id", "dados"] } } }, required: ["atualizacoes"] } },
  { name: "buscar_local", description: "Acha hospital, clínica, empresa ou endereço (OpenStreetMap, Brasil) e devolve nome, endereço e coordenadas — pra confirmar antes de gravar em definir_locais.", inputSchema: { type: "object", properties: { q: { type: "string" }, limite: { type: "number" } }, required: ["q"] } },
  { name: "definir_locais", description: "Grava LOCAIS (trabalho/casa/outro) em contatos SEUS, por id (até 100). Cada item: {id, tipo:'trabalho'|'casa'|'outro', nome, end?, lat?, lng?, rotinas?:[{dias:['seg'..'dom'], turno:'manha'|'tarde'|'noite', ini:'08:00', fim:'12:00', obs}]}. Rotina = quando a pessoa está nesse local ('sexta de manhã'). Sem lat/lng, geocodifica 'nome + end' sozinho (OpenStreetMap; no máximo 25 sem coordenada por chamada). Faz merge: não duplica local igual; local existente recebe as rotinas novas. É o que aparece na ficha, vai pro evento da Agenda e pro Mapa de locais. Resposta ENXUTA {atualizados, sem_coordenada, erros}.", inputSchema: { type: "object", properties: { locais: { type: "array", items: { type: "object", properties: { id: { type: "string" }, tipo: { type: "string" }, nome: { type: "string" }, end: { type: "string" }, lat: { type: "number" }, lng: { type: "number" }, rotinas: { type: "array", items: { type: "object", properties: { dias: { type: "array", items: { type: "string" } }, turno: { type: "string" }, ini: { type: "string" }, fim: { type: "string" }, obs: { type: "string" } } } } }, required: ["id", "nome"] } } }, required: ["locais"] } },
  { name: "listar_substituicoes", description: "Lista as SUAS apólices em Substituição (clientes + apólices). Só a sua base.", inputSchema: { type: "object", properties: { limite: { type: "number" } } } },
  { name: "listar_atrasos", description: "Lista a SUA Lista de Atraso (apólices vencidas em tratativa). Só a sua base.", inputSchema: { type: "object", properties: { limite: { type: "number" } } } },
  { name: "atualizar_atraso", description: "Atualiza a tratativa/próximo contato de um item SEU da Lista de Atraso, pelo id.", inputSchema: { type: "object", properties: { id: { type: "number" }, tratativa: { type: "string" }, prox_contato: { type: "string" } }, required: ["id"] } },
  { name: "revogar_conector", description: "DESTRUTIVA: revoga ESTE conector (a URL para de funcionar). Exige confirmar:true.", inputSchema: { type: "object", properties: { confirmar: { type: "boolean" } } } },
  // ── v3.0 · leitura ──
  { name: "conversas_listar", description: "Lista as conversas de WhatsApp (Umbler Talk) da SUA conta, mais recente primeiro: contato, telefone, canal, atendente, aberta/fechada, última mensagem (quem mandou, quando, prévia), não lidas, etiquetas. 'horas_sem_resposta' aparece quando a última mensagem é do cliente. Filtros: busca (nome ou telefone — telefone casa pelos dígitos), aguardando_resposta:true (só onde o cliente falou por último), desde (AAAA-MM-DD, última mensagem a partir dessa data), canal, abertas:true. Use pra achar quem está esperando retorno." + LEITURA, inputSchema: { type: "object", properties: { busca: { type: "string" }, aguardando_resposta: { type: "boolean" }, desde: { type: "string", description: "AAAA-MM-DD" }, canal: { type: "string" }, abertas: { type: "boolean" }, limite: { type: "number", description: "padrão 30, máx 100" } } } },
  { name: "conversa_ler", description: "Lê UMA conversa de WhatsApp (Umbler): cabeçalho do chat + as últimas mensagens em ordem cronológica (em, de: cliente|nos|bot|externo, autor, tipo quando não é texto, texto até 2000 caracteres, arquivo_nome, privada = nota interna). Informe chat_id (de conversas_listar) OU telefone (casa pelos 8 últimos dígitos + DDD; havendo vários chats, lê o mais recente e lista os outros em outras_conversas). 'desde' (AAAA-MM-DD) corta mensagens antigas." + LEITURA, inputSchema: { type: "object", properties: { chat_id: { type: "string" }, telefone: { type: "string" }, limite: { type: "number", description: "padrão 60, máx 300" }, desde: { type: "string", description: "AAAA-MM-DD" } } } },
  { name: "conversas_buscar", description: "Procura um termo no TEXTO das mensagens de WhatsApp (Umbler) da SUA conta (ex.: 'proposta', 'boleto', 'cancelar'). Mínimo 3 letras; não diferencia maiúscula, mas diferencia acento (na dúvida busque as duas grafias: 'apolice' e 'apólice'). Devolve chat_id, data, quem mandou, um trecho (~300 caracteres em volta do termo) e o nome/telefone do contato. Filtros: desde (AAAA-MM-DD), de ('cliente' ou 'nos'). Depois use conversa_ler com o chat_id pra ver o contexto." + LEITURA, inputSchema: { type: "object", properties: { termo: { type: "string" }, desde: { type: "string", description: "AAAA-MM-DD" }, de: { type: "string", enum: ["cliente", "nos"] }, limite: { type: "number", description: "padrão 30, máx 100" } }, required: ["termo"] } },
  { name: "conversas_status", description: "Saúde da sincronização do WhatsApp (Umbler → CRM): último sync ok, último erro, estatísticas da varredura, total de conversas/mensagens, conversas abertas, quantas estão AGUARDANDO RESPOSTA (cliente falou por último e o chat está aberto) e quantas ainda sem histórico completo. Chame antes de concluir que 'não há mensagem' — o dado pode estar atrasado." + LEITURA, inputSchema: { type: "object", properties: {} } },
  { name: "contato_conversa", description: "Ponte CRM ↔ WhatsApp: pega um contato do SEU CRM (contato_id de lp_contatos, ou busca pelo nome) e devolve o resumo do negócio (funil, etapa, status, temperatura, prêmio mensal pm e PA = pm×12, próxima atividade, tarefas atrasadas, congelado, dias na etapa) + as últimas 30 mensagens da conversa de WhatsApp dele (casada pelo telefone: 8 últimos dígitos + DDD, tolera 55 e 9º dígito). Se a busca achar vários contatos, usa o que tem negócio aberto e lista os outros em candidatos." + LEITURA, inputSchema: { type: "object", properties: { contato_id: { type: "string" }, busca: { type: "string" }, limite: { type: "number", description: "mensagens, padrão 30, máx 100" } } } },
  { name: "funil_resumo", description: "Foto do funil pra decisão, da SUA base: por funil → por etapa, quantidade, pa_total (soma de pm×12 só dos que têm prêmio informado), sem_valor (sem prêmio informado), sem_proxima_atividade (nenhuma tarefa pendente), congelados, tarefas_atrasadas. Encerrados (perdido/cancelado/ganho, conforme o funil configurado no app) e 'Clientes Ativos' dos Negócios na Base (carteira parada, fora do fluxo) vêm à parte. Funis: nn = Vida Individual · Novos Negócios, bc = Vida Individual · Negócios na Base, vg/prud/mfo e seus '-bc'. A base de nomes (contatos sem etapa) só é contada. 'funil' filtra; 'base' escolhe de quem (padrão: só a sua)." + LEITURA, inputSchema: { type: "object", properties: { funil: { type: "string", description: "nn | bc | vg | prud | mfo | vg-bc | prud-bc | mfo-bc" }, base: BASE_ARG } } },
  { name: "negocios_listar", description: "Lista negócios ABERTOS da SUA base pra decidir o próximo passo: id, nome, funil, etapa, status, temperatura, estrelas, pm e pa (pm×12), dias_na_etapa (desde a última mudança pra etapa atual; senão desde a criação), proxima_atividade {quando, hora, tipo, tit}, tarefas_atrasadas, telefone (pra cruzar com conversas_listar/conversa_ler) e congelado {em, ate, motivo}. Filtros: funil, etapa (id ou rótulo; pode ser uma encerrada), sem_atividade:true (sem tarefa pendente), congelados:true (SÓ os congelados — por padrão eles ficam de fora). ordenar: 'pa' (maior PA primeiro, padrão) ou 'parado' (mais dias na etapa primeiro). 'base': padrão só a sua." + LEITURA, inputSchema: { type: "object", properties: { funil: { type: "string" }, etapa: { type: "string" }, sem_atividade: { type: "boolean" }, congelados: { type: "boolean" }, ordenar: { type: "string", enum: ["pa", "parado"] }, base: BASE_ARG, limite: { type: "number", description: "padrão 30, máx 100" } } } },
  { name: "emissao_pendencias", description: "UW & Emissão da SUA base (relatórios da Prudential importados no app): pendências de emissão EM ABERTO (sem desfecho e tratativa ≠ resolvido) com proposta, segurado, dias pendentes, PA sem IOF, descrição da pendência, com quem está a bola, status da tratativa, próxima ação e prazo; e apólices EMITIDAS nos últimos 'dias' (padrão 30) com emissão, PA, AFYC projetado, 2ª parcela e entrega. 'base': padrão só a sua ('todas' inclui as bases delegadas a você)." + LEITURA, inputSchema: { type: "object", properties: { base: BASE_ARG, dias: { type: "number", description: "janela das emitidas, padrão 30, máx 180" }, limite: { type: "number", description: "padrão 50, máx 200 (cada lista)" } } } },
];

export async function callTool(name, args, ctx) {
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
      const lerDados = async () => new Map(((ids.length ? await rest(`lp_contatos?id=in.(${inList})&select=id,dados`, ctx.access) : []) || []).map((r) => [String(r.id), r.dados || {}]));
      const existe = await lerDados();
      const erros = []; const semCoord = []; const cacheGeo = new Map(); const prontos = []; let geocodificados = 0;
      // 1) validar + geocodificar PRIMEIRO (teto 25 sem coordenada por chamada: 1,1 s cada, pra não estourar o tempo da função)
      for (const a of arr) {
        const id = (a && a.id != null) ? String(a.id) : null;
        if (!id || !existe.has(id)) { erros.push({ id: (a && a.id) ?? null, motivo: "não encontrado (RLS)" }); continue; }
        const l = { tipo: a.tipo, nome: S120(a.nome), end: S120(a.end), lat: a.lat, lng: a.lng, src: "mcp", rotinas: a.rotinas };
        if (!l.nome) { erros.push({ id, motivo: "sem nome do local" }); continue; }
        if (l.lat == null || l.lng == null) {
          const q = [l.nome, l.end].filter(Boolean).join(", ");
          let hit = cacheGeo.get(q);
          if (hit === undefined) {
            if (geocodificados >= 25) { erros.push({ id, motivo: "teto de 25 locais sem coordenada por chamada — mande o resto em outra chamada ou use buscar_local antes" }); continue; }
            geocodificados++; try { hit = (await geoBuscar(q, 1))[0] || null; } catch { hit = null; } cacheGeo.set(q, hit); await new Promise((r) => setTimeout(r, 1100));
          }
          if (hit) { l.lat = hit.lat; l.lng = hit.lng; if (!l.end) l.end = hit.end; l.src = "osm"; } else semCoord.push({ id, nome: l.nome });
        }
        prontos.push({ id, l });
      }
      // 2) reler AGORA (o app pode ter editado o contato enquanto geocodificávamos) e mesclar só o campo locais
      const byId = await lerDados(); const tocados = new Map();
      for (const { id, l } of prontos) {
        const dados = tocados.get(id) || byId.get(id); if (!dados) continue;
        const novo = locAdd(dados, l);
        if (JSON.stringify(novo) !== JSON.stringify(Array.isArray(dados.locais) ? dados.locais : [])) tocados.set(id, { ...dados, locais: novo });
      }
      const rows = [...tocados].map(([id, dados]) => ({ dono: ctx.dono, id, dados }));
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
    // ── v3.0 · leitura (nenhum case abaixo escreve; leitura não vai pro lp_mcp_audit, como listar_atrasos) ──
    case "conversas_listar": {
      const n = LIM(args?.limite, 30, 100);
      let q = `umbler_chats?select=${CHAT_COLS}&order=ultima_msg_em.desc.nullslast&limit=${n}`;
      const b = String(args?.busca ?? "").trim();
      let telBusca = null;
      if (b) {
        const d = soDigitos(b);
        if (d.length >= 4 && /^[\d\s()+\-.]+$/.test(b)) {   // telefone: casa pelos dígitos (8 últimos quando veio completo)
          const alvo = d.length >= 10 ? telChave(d)?.ult8 || d : d;
          if (d.length >= 10) telBusca = d;
          q += `&contato_tel_norm=ilike.*${encodeURIComponent(alvo)}*`;
        } else { const s = likeSeguro(b); if (s) q += `&contato_nome=ilike.*${encodeURIComponent(s)}*`; }
      }
      if (args?.aguardando_resposta === true) q += `&ultima_msg_de=eq.cliente`;
      const desde = isoArg(args?.desde); if (desde) q += `&ultima_msg_em=gte.${encodeURIComponent(desde)}`;
      if (args?.canal) { const s = likeSeguro(args.canal); if (s) q += `&canal=ilike.*${encodeURIComponent(s)}*`; }
      if (args?.abertas === true) q += `&aberto=eq.true`;
      let rows = (await rest(q, ctx.access)) || [];
      if (telBusca) rows = rows.filter((c) => telScore(telBusca, c.contato_tel_norm || c.contato_tel) > 0);   // confere o DDD
      return enxuto({ total: rows.length, conversas: rows.map((c) => chatLinha(c, false, ctx.dono)), aviso: rows.length >= n ? `mostrando ${n} — pode haver mais (aumente 'limite' ou filtre)` : undefined });
    }
    case "conversa_ler": {
      const n = LIM(args?.limite, 60, 300), desde = isoArg(args?.desde);
      let chat = null, outras = [];
      if (args?.chat_id) {
        chat = ((await rest(`umbler_chats?select=${CHAT_COLS}&id=eq.${encodeURIComponent(String(args.chat_id))}&limit=1`, ctx.access)) || [])[0] || null;
      } else if (args?.telefone) {
        if (!telChave(args.telefone)) return { aviso: "telefone precisa ter pelo menos 8 dígitos" };
        const cs = await chatsDoTelefone(ctx, [String(args.telefone)]);
        chat = cs[0] || null;
        outras = cs.slice(1).map((c) => enxuto({ id: c.id, contato_nome: c.contato_nome, ultima_msg_em: c.ultima_msg_em }));
      } else return { aviso: "informe chat_id ou telefone" };
      if (!chat) return { aviso: "nenhuma conversa SUA encontrada (id inexistente ou telefone sem chat no Umbler)" };
      const m = await lerMensagens(ctx, chat.id, n, desde);
      return enxuto({ conversa: chatLinha(chat, true, ctx.dono), ...m, outras_conversas: outras, aviso: chat.historico_completo === false ? "histórico desta conversa ainda não foi sincronizado por completo — mensagens antes de msgs_desde podem faltar" : undefined });
    }
    case "conversas_buscar": {
      const bruto = String(args?.termo ?? "").replace(/[*,()]/g, " ").replace(/\s+/g, " ").trim();
      if (bruto.length < 3) return { aviso: "termo precisa de pelo menos 3 caracteres" };
      const n = LIM(args?.limite, 30, 100);
      let q = `umbler_mensagens?select=chat_id,enviada_em,de,tipo,texto,privada&texto=ilike.*${encodeURIComponent(likeSeguro(bruto))}*&order=enviada_em.desc&limit=${n}`;
      const desde = isoArg(args?.desde); if (desde) q += `&enviada_em=gte.${encodeURIComponent(desde)}`;
      if (args?.de != null && args.de !== "") {
        if (!["cliente", "nos"].includes(String(args.de))) return { aviso: "'de' aceita só 'cliente' ou 'nos'" };
        q += `&de=eq.${encodeURIComponent(String(args.de))}`;
      }
      const rows = (await rest(q, ctx.access)) || [];
      const ids = [...new Set(rows.map((m) => m.chat_id).filter(Boolean))];
      const chats = ids.length ? (await rest(`umbler_chats?select=id,contato_nome,contato_tel&id=in.(${inLista(ids)})`, ctx.access)) || [] : [];
      // deno-lint-ignore no-explicit-any
      const porId = new Map<string, any>(chats.map((c) => [c.id, c]));
      return enxuto({
        total: rows.length,
        resultados: rows.map((m) => enxuto({ chat_id: m.chat_id, em: m.enviada_em, de: m.de, contato_nome: porId.get(m.chat_id)?.contato_nome, contato_tel: porId.get(m.chat_id)?.contato_tel, tipo: m.tipo && m.tipo !== "Text" ? m.tipo : undefined, privada: m.privada ? true : undefined, trecho: trecho(m.texto, bruto) })),
        aviso: rows.length >= n ? `mostrando as ${n} mais recentes — refine com 'desde' ou 'de'` : undefined,
      });
    }
    case "conversas_status": {
      const est = (await rest(`umbler_estado?select=dono,org_nome,ultimo_sync,ultimo_ok,ultimo_erro,lista_completa,stats,atualizado_em`, ctx.access)) || [];
      const contas = est.map((e) => {
        const { membros: _m, ...stats } = e.stats && typeof e.stats === "object" ? e.stats : {};
        const h = horasDesde(e.ultimo_ok);
        return enxuto({ dono: e.dono !== ctx.dono ? e.dono : undefined, org_nome: e.org_nome, ultimo_sync: e.ultimo_sync, ultimo_ok: e.ultimo_ok, minutos_desde_ultimo_ok: h == null ? undefined : Math.round(h * 60), ultimo_erro: e.ultimo_erro, lista_completa: e.lista_completa, stats });
      });
      const [conversas, abertas, aguardando, sem_historico_completo, mensagens] = await Promise.all([
        restCount(`umbler_chats?select=id`, ctx.access),
        restCount(`umbler_chats?select=id&aberto=eq.true`, ctx.access),
        restCount(`umbler_chats?select=id&aberto=eq.true&ultima_msg_de=eq.cliente`, ctx.access),
        restCount(`umbler_chats?select=id&historico_completo=is.false`, ctx.access),
        restCount(`umbler_mensagens?select=id`, ctx.access),
      ]);
      return enxuto({ contas, aviso: contas.length ? undefined : "nenhuma conta Umbler sincronizada pra este e-mail", totais: { conversas, abertas, aguardando_resposta: aguardando, sem_historico_completo, mensagens } });
    }
    case "contato_conversa": {
      const n = LIM(args?.limite, 30, 100);
      let rows;
      if (args?.contato_id) rows = await rest(`lp_contatos?select=${NEG_SEL}&id=eq.${encodeURIComponent(String(args.contato_id))}&limit=1`, ctx.access);
      else if (args?.busca) {
        const s = likeSeguro(args.busca);
        if (s.length < 2) return { aviso: "busca precisa de pelo menos 2 letras" };
        rows = await rest(`lp_contatos?select=${NEG_SEL}&dados->>nome=ilike.*${encodeURIComponent(s)}*&order=atualizado.desc&limit=10`, ctx.access);
      } else return { aviso: "informe contato_id ou busca" };
      rows = (rows || []).filter((r) => !r.merged_into);
      if (!rows.length) return { aviso: "nenhum contato SEU encontrado" };
      const cfg = await lerCfgFunil(ctx), hoje = hojeRecife();
      const rank = (x) => (x.n ? (x.n.classe === "aberto" ? 0 : 1) : 2);
      const cands = rows.map((r) => ({ r, n: negocioDe(r, cfg, hoje) })).sort((a, b) => rank(a) - rank(b));
      const { r, n: neg } = cands[0];
      const contato = neg ? negLinha(neg, ctx.dono) : enxuto({ id: r.id, nome: r.nome, telefone: r.telefone, nota: "sem etapa — contato da base de nomes, não é negócio aberto" });
      const out = { contato, candidatos: cands.slice(1).map((x) => enxuto({ id: x.r.id, nome: x.r.nome, etapa: x.r.etapa })) };
      const tels = [r.telefone, ...(Array.isArray(r.telefones_alt) ? r.telefones_alt : [])].filter((t) => typeof t === "string" && telChave(t));
      if (!tels.length) return enxuto({ ...out, aviso: "contato sem telefone válido no CRM — não dá pra casar com o WhatsApp" });
      const chats = await chatsDoTelefone(ctx, tels);
      if (!chats.length) return enxuto({ ...out, aviso: "nenhuma conversa no Umbler com o telefone deste contato" });
      const m = await lerMensagens(ctx, chats[0].id, n, null);
      return enxuto({ ...out, conversa: chatLinha(chats[0], true, ctx.dono), ...m, outras_conversas: chats.slice(1).map((c) => c.id) });
    }
    case "funil_resumo": {
      let f = args?.funil ? String(args.funil).trim().toLowerCase() : null;
      if (f === "lp") f = "nn";
      const { cfg, hoje, negocios } = await carregarNegocios(ctx, args?.base);
      if (f && !FUNIL_NOME[f] && !cfg[f]) return { aviso: `funil desconhecido: ${f}`, funis_validos: Object.keys(FUNIL_NOME) };
      let semEtapa = null;
      try { semEtapa = await restCount(`lp_contatos?select=id&dados->>etapa=is.null${filtroBase(args?.base, ctx.dono, "dono")}`, ctx.access); } catch { /* contagem é só informativa */ }
      return enxuto({ hoje, ...resumirFunil(negocios, cfg, f), base_de_nomes_sem_etapa: semEtapa, nota: "pa = pm×12 só de quem tem prêmio informado (o padrão R$ 250/mês do app NÃO é aplicado aqui — veja sem_valor). Encerrados e Clientes Ativos não entram em total_abertos." });
    }
    case "negocios_listar": {
      const n = LIM(args?.limite, 30, 100);
      let f = args?.funil ? String(args.funil).trim().toLowerCase() : null;
      if (f === "lp") f = "nn";
      const { hoje, negocios } = await carregarNegocios(ctx, args?.base);
      let L = f ? negocios.filter((x) => x.funil === f) : negocios;
      const et = args?.etapa ? dobra(String(args.etapa).trim()) : null;
      L = et ? L.filter((x) => dobra(x.etapa) === et || (x.etapa_label && dobra(x.etapa_label) === et)) : L.filter((x) => x.classe === "aberto");
      L = args?.congelados === true ? L.filter((x) => x.congelado) : L.filter((x) => !x.congelado);
      if (args?.sem_atividade === true) L = L.filter((x) => !x.proxima_atividade);
      const ord = args?.ordenar === "parado" ? "parado" : "pa";
      const dd = (x) => (x.dias_na_etapa == null ? -1 : x.dias_na_etapa);
      L.sort(ord === "parado" ? (a, b) => dd(b) - dd(a) || (b.pa || 0) - (a.pa || 0) : (a, b) => (b.pa || 0) - (a.pa || 0) || dd(b) - dd(a));
      return { hoje, total: L.length, ordenado_por: ord, negocios: L.slice(0, n).map((x) => negLinha(x, ctx.dono)) };
    }
    case "emissao_pendencias": {
      const n = LIM(args?.limite, 50, 200), dias = LIM(args?.dias, 30, 180);
      const desde = new Date(Date.parse(hojeRecife() + "T00:00:00Z") - dias * 864e5).toISOString().slice(0, 10);
      const [pend, emit] = await Promise.all([
        rest(`emissao_pendencias?select=id,lp_email,proposta,apolice,segurado,status_apolice,contestacao,dias_pendentes,dt_assinatura,pa_sem_iof,afyc_projetado,lp,pendencia_descricao,bola_com,status_tratativa,ultima_acao,ultima_acao_em,proxima_acao,proxima_acao_prazo,protocolo,observacao,saiu_do_relatorio_em,nao_conta,origem_relatorio&desfecho=is.null&or=(status_tratativa.is.null,status_tratativa.neq.resolvido)${filtroBase(args?.base, ctx.dono, "lp_email")}&order=dias_pendentes.desc.nullslast&limit=${n}`, ctx.access),
        rest(`emissao_emitidas?select=id,lp_email,proposta,apolice,segurado,status_apolice,emissao,dt_assinatura,pa_sem_iof,afyc_projetado,lp,segunda_parcela_em,entrega_status,entrega_em,desfecho,nao_conta,saiu_do_relatorio_em,origem_relatorio&emissao=gte.${desde}${filtroBase(args?.base, ctx.dono, "lp_email")}&order=emissao.desc&limit=${n}`, ctx.access),
      ]);
      const limpa = (x) => enxuto({ ...x, lp_email: x.lp_email !== ctx.dono ? x.lp_email : undefined, nao_conta: x.nao_conta ? true : undefined, observacao: x.observacao ? corta(x.observacao, 400) : undefined, pendencia_descricao: x.pendencia_descricao ? corta(x.pendencia_descricao, 400) : undefined });
      const somaC = (arr, k) => r2((arr || []).reduce((s, x) => s + (Number(x[k]) || 0), 0));
      const maxRel = (arr) => (arr || []).map((x) => x.origem_relatorio).filter(Boolean).sort().pop();
      return {
        pendencias_abertas: enxuto({ total: (pend || []).length, pa_sem_iof_total: somaC(pend, "pa_sem_iof"), relatorio_mais_recente: maxRel(pend), itens: (pend || []).map((x) => limpa({ ...x, origem_relatorio: undefined })) }),
        emitidas: enxuto({ desde, total: (emit || []).length, pa_sem_iof_total: somaC(emit, "pa_sem_iof"), afyc_projetado_total: somaC(emit, "afyc_projetado"), relatorio_mais_recente: maxRel(emit), itens: (emit || []).map((x) => limpa({ ...x, origem_relatorio: undefined })) }),
      };
    }
    default:
      throw new Error(`ferramenta desconhecida: ${name}`);
  }
}

// CRM_MCP_TESTE=1 só no `deno test` (importa as funções puras sem subir o servidor); em produção a variável não existe.
if (!Deno.env.get("CRM_MCP_TESTE")) Deno.serve(async (req) => {
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
        return reply({ content: [{ type: "text", text: COMPACTO.has(msg.params?.name) ? JSON.stringify(out) : JSON.stringify(out, null, 2) }] });
      } catch (e) {
        return reply({ content: [{ type: "text", text: "erro: " + String(e) }], isError: true });
      }
    }
    return fail(-32601, "metodo nao suportado: " + msg.method);
  }
  return j({ ok: true, server: SERVER, hint: "MCP endpoint. Use POST /crm-mcp/<token>." });
});
