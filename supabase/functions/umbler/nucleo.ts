// UMBLER-V1 · núcleo puro (sem rede, sem banco) — testável com `deno test`.
// Converte o que a API/webhook do Umbler Talk devolve nas linhas de umbler_chats / umbler_mensagens.
// O webhook do Talk não tem formato documentado: tudo aqui lê na defensiva (chave em qualquer caixa).

export type Obj = Record<string, unknown>;

/** lê obj[nome] sem ligar pra caixa (id / Id / ID). Aceita vários nomes; o primeiro presente vence. */
export function pick(o: unknown, ...nomes: string[]): unknown {
  if (!o || typeof o !== "object") return undefined;
  const r = o as Obj;
  for (const n of nomes) {
    if (n in r && r[n] != null) return r[n];
    const k = Object.keys(r).find((x) => x.toLowerCase() === n.toLowerCase());
    if (k && r[k] != null) return r[k];
  }
  return undefined;
}
export function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  return null;
}
export function bool(v: unknown): boolean | null {
  return typeof v === "boolean" ? v : null;
}
export function quando(v: unknown): string | null {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) || d.getUTCFullYear() < 2000 ? null : d.toISOString();
}
export function soDigitos(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 8 ? d : null;
}
function nome(v: unknown): string | null {
  return str(v) ?? str(pick(v, "name", "displayName", "title"));
}

/** Contact | Member | Bot | External → cliente | nos | bot.
 *  External = mandada direto pelo WhatsApp do celular, fora do Talk (conferido nos dados reais em 23/10) → é NOSSA. */
export function quemEnviou(m: unknown): "cliente" | "nos" | "bot" | "externo" {
  const s = String(str(pick(m, "source")) ?? "").toLowerCase();
  if (s === "contact") return "cliente";
  if (s === "member" || s === "external") return "nos";
  if (s === "bot") return "bot";
  if (pick(m, "fromContact") === true) return "cliente";
  if (pick(m, "sentByOrganizationMember")) return "nos";
  return "externo";
}

export function msgQuando(m: unknown): string | null {
  return quando(pick(m, "eventAtUTC")) ?? quando(pick(m, "createdAtUTC"));
}

export function mapMensagem(m: unknown, chatId: string, dono: string): Obj | null {
  const id = str(pick(m, "id"));
  if (!id) return null;
  const arq = pick(m, "file");
  const texto = str(pick(m, "content")) ?? str(pick(m, "headerContent")) ?? str(pick(arq, "caption"));
  return {
    id,
    chat_id: str(pick(pick(m, "chat"), "id")) ?? chatId,
    dono,
    de: quemEnviou(m),
    tipo: str(pick(m, "messageType")),
    texto: texto ? texto.slice(0, 20000) : null,
    arquivo_nome: str(pick(arq, "originalName", "name", "fileName")),
    arquivo_url: str(pick(arq, "url", "publicUrl", "downloadUrl")),
    autor: nome(pick(m, "sentByOrganizationMember")) ??
      (String(str(pick(m, "source")) ?? "").toLowerCase() === "external" ? "pelo celular" : null),
    enviada_em: msgQuando(m),
    estado: str(pick(m, "messageState")),
    privada: pick(m, "isPrivate") === true,
    bruto: m as Obj,
  };
}

export function chatUltimoEvento(c: unknown): string | null {
  const lm = pick(c, "lastMessage", "message");
  return msgQuando(lm) ?? quando(pick(c, "eventAtUTC")) ?? quando(pick(c, "createdAtUTC"));
}

/** a API manda o atendente só com o id: o nome vem deste mapa (id → nome), montado por coletarMembros */
export function mapChat(c: unknown, dono: string, orgId: string | null, membros: Record<string, string> = {}): Obj | null {
  const id = str(pick(c, "id"));
  if (!id) return null;
  const ct = pick(c, "contact");
  const tels = pick(ct, "phoneNumbers");
  const tel = str(pick(ct, "phoneNumber")) ??
    (Array.isArray(tels) ? str(tels[0]) ?? str(pick(tels[0], "number", "phoneNumber")) : null);
  const lm = pick(c, "lastMessage", "message");
  const tags = pick(c, "tags");
  const previa = str(pick(lm, "content"));
  return {
    id,
    dono,
    org_id: str(pick(pick(c, "organization"), "id")) ?? orgId,
    contato_id: str(pick(ct, "id")),
    contato_nome: str(pick(ct, "name")),
    contato_tel: tel,
    contato_tel_norm: soDigitos(tel),
    canal: nome(pick(c, "channel")),
    setor: nome(pick(c, "sector")),
    atendente: nome(pick(c, "organizationMember")) ?? membros[str(pick(pick(c, "organizationMember"), "id")) ?? ""] ?? null,
    etiquetas: Array.isArray(tags) ? tags.map((t) => nome(t)).filter(Boolean) as string[] : [],
    aberto: bool(pick(c, "open")),
    aguardando: bool(pick(c, "waiting")),
    aguardando_desde: quando(pick(c, "waitingSinceUTC")),
    nao_lidas: typeof pick(c, "totalUnread") === "number" ? pick(c, "totalUnread") : null,
    ultima_msg_em: chatUltimoEvento(c),
    ultima_msg_de: lm ? quemEnviou(lm) : null,
    ultima_msg_previa: previa ? previa.slice(0, 280) : null,
    criado_em: quando(pick(c, "createdAtUTC")),
    fechado_em: quando(pick(c, "closedAtUTC")),
    sincronizado_em: new Date().toISOString(),
    bruto: c as Obj,
  };
}

/** acha, em qualquer profundidade, o objeto que parece um chat (tem id + contact/lastMessage) e/ou uma mensagem */
export function extrairDoWebhook(body: unknown): { tipo: string | null; chat: Obj | null; chatId: string | null; mensagem: Obj | null } {
  const tipo = str(pick(body, "type", "eventType", "event"));
  let chat: Obj | null = null, mensagem: Obj | null = null;
  const visto = new Set<unknown>();
  const anda = (o: unknown, prof: number) => {
    if (!o || typeof o !== "object" || prof > 6 || visto.has(o)) return;
    visto.add(o);
    if (Array.isArray(o)) { o.forEach((x) => anda(x, prof + 1)); return; }
    const temId = !!str(pick(o, "id"));
    if (!chat && temId && (pick(o, "contact") || pick(o, "lastMessage"))) chat = o as Obj;
    if (!mensagem && temId && pick(o, "messageType") && (pick(o, "source") || pick(o, "content") != null)) mensagem = o as Obj;
    for (const v of Object.values(o as Obj)) anda(v, prof + 1);
  };
  anda(body, 0);
  const chatId = str(pick(chat, "id")) ?? str(pick(pick(mensagem, "chat"), "id")) ?? str(pick(body, "chatId"));
  if (!mensagem && chat) {
    const lm = pick(chat, "lastMessage");
    if (lm && str(pick(lm, "id"))) mensagem = lm as Obj;
  }
  return { tipo, chat, chatId, mensagem };
}

/** a API do Umbler devolve a lista em {items:[...]} (PaginationOf…) ou, às vezes, direto como array */
export function itens(r: unknown): unknown[] {
  if (Array.isArray(r)) return r;
  const it = pick(r, "items", "messages", "data");
  return Array.isArray(it) ? it : [];
}

/** junta, em qualquer profundidade, objetos {id, displayName} que pareçam membro da equipe → mapa id → nome */
export function coletarMembros(...fontes: unknown[]): Record<string, string> {
  const out: Record<string, string> = {};
  const visto = new Set<unknown>();
  const anda = (o: unknown, prof: number) => {
    if (!o || typeof o !== "object" || prof > 6 || visto.has(o)) return;
    visto.add(o);
    if (Array.isArray(o)) { o.forEach((x) => anda(x, prof + 1)); return; }
    const id = str(pick(o, "id")), dn = str(pick(o, "displayName"));
    if (id && dn) out[id] = dn;
    for (const v of Object.values(o as Obj)) anda(v, prof + 1);
  };
  fontes.forEach((f) => anda(f, 0));
  return out;
}

/** primeira organização do /v1/members/me/ */
export function orgDoMe(me: unknown): { id: string | null; nome: string | null } {
  const orgs = pick(me, "organizations");
  const o = Array.isArray(orgs) ? orgs[0] : null;
  const ref = pick(o, "organization") ?? o;
  return { id: str(pick(ref, "id")) ?? str(pick(o, "organizationId")), nome: nome(ref) };
}
