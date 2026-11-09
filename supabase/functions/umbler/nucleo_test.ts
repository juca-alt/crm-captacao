// deno test supabase/functions/umbler/nucleo_test.ts --allow-read
import { assert, assertEquals } from "jsr:@std/assert@1";
import { cmpData, coletarMembros, cpfOk, luhnOk, mascararObj, mascararSensivel, emDia, extrairDoWebhook, itens, mapChat, mapMensagem, orgDoMe, pick, quemEnviou, soDigitos, tData } from "./nucleo.ts";

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

// ---------- UMBLER-T3 (07/11): autor pelo mapa de membros ----------
Deno.test("T3: autor vem do mapa de membros quando a API manda só o id", () => {
  const membros = { "mbr-zz-1": "Fulano Atendente", "mbr-zz-2": "Beltrana Atendente" };
  const soId = mapMensagem({ id: "m1", source: "Member", sentByOrganizationMember: { id: "mbr-zz-2" }, eventAtUTC: "2026-11-07T12:00:00Z" }, "c1", DONO, membros)!;
  assertEquals(soId.autor, "Beltrana Atendente");
  const comNome = mapMensagem({ id: "m2", source: "Member", sentByOrganizationMember: { id: "mbr-zz-1", displayName: "Nome Do Payload" } }, "c1", DONO, membros)!;
  assertEquals(comNome.autor, "Nome Do Payload"); // nome no payload vence
  const desconhecido = mapMensagem({ id: "m3", source: "Member", sentByOrganizationMember: { id: "mbr-fora" } }, "c1", DONO, membros)!;
  assertEquals(desconhecido.autor, null);
  const celular = mapMensagem({ id: "m4", source: "External" }, "c1", DONO, membros)!;
  assertEquals(celular.autor, "pelo celular");
  const cliente = mapMensagem({ id: "m5", source: "Contact" }, "c1", DONO, membros)!;
  assertEquals(cliente.autor, null);
  assertEquals(mapMensagem({ id: "m6", source: "Member", sentByOrganizationMember: { id: "mbr-zz-1" } }, "c1", DONO)!.autor, null); // sem mapa: como antes
});

// ---------- UMBLER-T4 (07/11): datas comparadas por número ----------
Deno.test("T4: 'Z' e '+00:00' do mesmo instante são iguais (antes, como texto, Z > +)", () => {
  const js = "2026-11-07T22:19:52.815Z", pg = "2026-11-07T22:19:52.815+00:00";
  assert(js > pg); // o bug: comparação de texto achava o JS "mais novo"
  assertEquals(cmpData(js, pg), 0);
  assert(emDia(js, pg));
  assert(emDia("2026-11-07T22:00:00Z", pg));
  assert(!emDia("2026-11-07T22:30:00Z", pg));
  assertEquals(cmpData("2026-11-07T22:30:00Z", pg), 1);
  assertEquals(cmpData("2026-11-07T19:19:52-03:00", pg), -1);
});
Deno.test("T4: sem msgs_ate nunca está em dia; sem última do chat está; data ilegível não decide", () => {
  assert(!emDia("2026-11-07T22:00:00Z", null));
  assert(emDia(null, "2026-11-07T22:00:00+00:00"));
  assertEquals(cmpData("lixo", "2026-11-07T22:00:00Z"), null);
  assert(!emDia("lixo", "2026-11-07T22:00:00+00:00"));
  assertEquals(tData(null), NaN);
});

// ── SENSIVEL-V1 (09/11/2026): cartão e CPF mascarados na entrada (números de teste públicos, nenhum dado real) ──
Deno.test("SENSIVEL-V1: cartão válido vira •••• + 4 últimos; com espaço, traço ou colado", () => {
  assertEquals(mascararSensivel("meu cartão 4111 1111 1111 1111 ok"), "meu cartão •••• 1111 ok");
  assertEquals(mascararSensivel("5555-5555-5555-4444"), "•••• 4444");
  assertEquals(mascararSensivel("cartao:4111111111111111."), "cartao:•••• 1111.");
});
Deno.test("SENSIVEL-V1: número que não é cartão fica intacto (Luhn falha, começa com 1/2/7–9, pedaço de boleto, telefone)", () => {
  assertEquals(mascararSensivel("4111 1111 1111 1112"), "4111 1111 1111 1112");            // Luhn falha
  assertEquals(mascararSensivel("apólice 1234567890123452"), "apólice 1234567890123452");   // começa com 1
  const boleto = "34191.79001 01043.510047 91020.150008 1 98170000010000";
  assertEquals(mascararSensivel(boleto), boleto);                                             // sequência maior que 19 dígitos
  assertEquals(mascararSensivel("+55 81 99999-0000"), "+55 81 99999-0000");
  assertEquals(mascararSensivel("+55 81 99000-0006"), "+55 81 99000-0006");                // telefone com DDI que passaria no Luhn (inventado)
});
Deno.test("SENSIVEL-V1: CPF formatado ou solto com dígitos verificadores certos vira ***", () => {
  assertEquals(mascararSensivel("cpf 111.444.777-35"), "cpf ***.***.***-**");
  assertEquals(mascararSensivel("11144477735"), "***.***.***-**");
  assertEquals(mascararSensivel("111.444.777-36"), "111.444.777-36");                        // dígito errado
  assertEquals(mascararSensivel("11111111111"), "11111111111");                              // repetido não é CPF
  assert(cpfOk("11144477735") && !cpfOk("11144477736") && luhnOk("4111111111111111") && !luhnOk("4111111111111112"));
});
Deno.test("SENSIVEL-V1: mapMensagem e mapChat gravam texto, prévia e bruto já mascarados; telefone e id intactos", () => {
  const m = { id: "m9", source: "Contact", messageType: "Text", content: "segue 4111 1111 1111 1111 e cpf 111.444.777-35", file: { caption: "cpf 11144477735" }, chat: { id: "c9" } };
  const r = mapMensagem(m, "c9", DONO)!;
  assertEquals(r.texto, "segue •••• 1111 e cpf ***.***.***-**");
  assertEquals((r.bruto as any).content, "segue •••• 1111 e cpf ***.***.***-**");
  assertEquals((r.bruto as any).file.caption, "cpf ***.***.***-**");
  assertEquals(m.content, "segue 4111 1111 1111 1111 e cpf 111.444.777-35");   // não altera o objeto original
  const c = { id: "c9", contact: { phoneNumber: "5581999990000" }, lastMessage: { id: "m9", content: "cartão 5555555555554444" } };
  const rc = mapChat(c, DONO, "org")!;
  assertEquals(rc.ultima_msg_previa, "cartão •••• 4444");
  assertEquals((rc.bruto as any).lastMessage.content, "cartão •••• 4444");
  assertEquals((rc.bruto as any).contact.phoneNumber, "5581999990000");
  assertEquals(mascararObj({ _texto: "11144477735", n: 4111111111111111 }), { _texto: "***.***.***-**", n: 4111111111111111 });
});
