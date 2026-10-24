// deno test supabase/functions/umbler/nucleo_test.ts --allow-read
import { assert, assertEquals } from "jsr:@std/assert@1";
import { coletarMembros, extrairDoWebhook, itens, mapChat, mapMensagem, orgDoMe, pick, quemEnviou, soDigitos } from "./nucleo.ts";

const DONO = "dono@teste";

Deno.test("pick ignora caixa", () => {
  assertEquals(pick({ Id: "a" }, "id"), "a");
  assertEquals(pick({ lastMessage: 1 }, "LastMessage"), 1);
  assertEquals(pick(null, "id"), undefined);
});

Deno.test("quem enviou: Contact/Member/Bot/External", () => {
  assertEquals(quemEnviou({ source: "Contact" }), "cliente");
  assertEquals(quemEnviou({ Source: "Member" }), "nos");
  assertEquals(quemEnviou({ source: "Bot" }), "bot");
  assertEquals(quemEnviou({ source: "External" }), "nos"); // mandada pelo WhatsApp do celular, fora do Talk
  assertEquals(quemEnviou({ fromContact: true }), "cliente");
});

Deno.test("mapChat (formato da API, camelCase)", () => {
  const c = {
    id: "ch1", createdAtUTC: "2026-10-01T10:00:00Z", open: true, waiting: true, totalUnread: 2,
    contact: { id: "ct1", name: "Fulano de Tal", phoneNumber: "+55 81 99999-0000" },
    channel: { name: "WhatsApp" }, sector: { name: "Vendas" }, organizationMember: { displayName: "Victor" },
    tags: [{ name: "lead" }], lastMessage: { id: "m9", content: "oi", source: "Contact", eventAtUTC: "2026-10-20T12:00:00Z" },
  };
  const r = mapChat(c, DONO, "org1")!;
  assertEquals(r.id, "ch1");
  assertEquals(r.contato_nome, "Fulano de Tal");
  assertEquals(r.contato_tel_norm, "5581999990000");
  assertEquals(r.canal, "WhatsApp");
  assertEquals(r.atendente, "Victor");
  assertEquals(r.etiquetas, ["lead"]);
  assertEquals(r.ultima_msg_de, "cliente");
  assertEquals(r.ultima_msg_em, "2026-10-20T12:00:00.000Z");
  assertEquals(r.org_id, "org1");
  assertEquals(mapChat({}, DONO, null), null);
});

Deno.test("mapMensagem: texto, arquivo, nota interna, autor", () => {
  const m = mapMensagem({
    id: "m1", content: "Bom dia", messageType: "Text", source: "Member", isPrivate: true,
    sentByOrganizationMember: { name: "Gustavo" }, eventAtUTC: "2026-10-20T12:00:00Z", messageState: "Read",
  }, "ch1", DONO)!;
  assertEquals(m.de, "nos");
  assertEquals(m.privada, true);
  assertEquals(m.autor, "Gustavo");
  assertEquals(m.chat_id, "ch1");
  const a = mapMensagem({ id: "m2", messageType: "File", source: "Contact", file: { originalName: "rg.pdf", url: "https://x/rg.pdf" } }, "ch1", DONO)!;
  assertEquals(a.arquivo_nome, "rg.pdf");
  assertEquals(a.de, "cliente");
  assertEquals(mapMensagem({ content: "sem id" }, "ch1", DONO), null);
});

Deno.test("webhook PascalCase aninhado (Payload.Content) → chat + última mensagem", () => {
  const body = {
    Type: "Message", EventDate: "2026-10-20T12:00:00Z",
    Payload: { Type: "Chat", Content: {
      Id: "chW", Contact: { Name: "Beltrano", PhoneNumber: "5581988887777" },
      LastMessage: { Id: "mW", Content: "quero falar com o Gustavo", MessageType: "Text", Source: "Contact", EventAtUTC: "2026-10-20T12:00:00Z" },
    } },
  };
  const x = extrairDoWebhook(body);
  assertEquals(x.tipo, "Message");
  assertEquals(x.chatId, "chW");
  assert(x.mensagem);
  assertEquals(mapMensagem(x.mensagem, x.chatId!, DONO)!.de, "cliente");
  assertEquals(mapChat(x.chat, DONO, null)!.contato_tel_norm, "5581988887777");
});

Deno.test("webhook só com mensagem (chat dentro da mensagem)", () => {
  const x = extrairDoWebhook({ event: "Message", data: { id: "m5", messageType: "Text", source: "Member", content: "ok", chat: { id: "ch5" } } });
  assertEquals(x.chatId, "ch5");
  assertEquals(x.mensagem && (x.mensagem as Record<string, unknown>).id, "m5");
});

Deno.test("webhook desconhecido não quebra", () => {
  const x = extrairDoWebhook({ qualquer: [1, 2, { coisa: true }] });
  assertEquals(x.chatId, null);
  assertEquals(x.mensagem, null);
});

Deno.test("mensagem pelo celular (External) = nossa, autor 'pelo celular'", () => {
  const m = mapMensagem({ id: "e1", source: "External", messageType: "Text", content: "oi", sentByOrganizationMember: null }, "c", DONO)!;
  assertEquals(m.de, "nos");
  assertEquals(m.autor, "pelo celular");
});

Deno.test("atendente: id → nome pelo mapa de membros", () => {
  const mem = coletarMembros({ id: "m1", displayName: "Gustavo", organizations: [{ id: "o1", name: "Org" }] }, { members: [{ member: { id: "m2", displayName: "Victor" } }] });
  assertEquals(mem, { m1: "Gustavo", m2: "Victor" });
  assertEquals(mapChat({ id: "c1", organizationMember: { id: "m2", muted: false } }, DONO, null, mem)!.atendente, "Victor");
  assertEquals(mapChat({ id: "c2", organizationMember: { id: "zz" } }, DONO, null, mem)!.atendente, null);
});

Deno.test("itens / org / dígitos", () => {
  assertEquals(itens({ page: {}, items: [1] }), [1]);
  assertEquals(itens({ messages: [2] }), [2]);
  assertEquals(itens([3]), [3]);
  assertEquals(itens(null), []);
  assertEquals(orgDoMe({ organizations: [{ id: "o1", name: "Org" }] }), { id: "o1", nome: "Org" });
  assertEquals(orgDoMe({ organizations: [{ organization: { id: "o2", name: "X" } }] }).id, "o2");
  assertEquals(soDigitos("12"), null);
});

Deno.test("TRAVA: a função nunca envia mensagem (só GET na API do Talk)", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  const codigo = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert(!/\/v1\/messages/i.test(codigo), "não pode existir rota /v1/messages");
  assert(!/method:\s*["'](POST|PUT|PATCH|DELETE)["']/i.test(codigo), "fetch à API só com GET");
  assertEquals((codigo.match(/await fetch\(/g) || []).length, 1, "um único fetch, o do apiGet");
});
