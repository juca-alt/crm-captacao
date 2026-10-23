// Testes do núcleo do copiloto (sem rede). Rodar:
//   node --test --experimental-strip-types supabase/functions/copiloto-sugerir/nucleo_test.ts
// Dados inventados (Fulano) — nada de cliente real.
import { test } from "node:test";
import assert from "node:assert/strict";
import { redact, REMOVIDO, montarUsuario, normalizarMensagens, validar, travaDura, RX_PROIBIDAS, mensagemEspera, TOOL } from "./nucleo.ts";

test("redact: CPF com e sem máscara", () => {
  assert.equal(redact("meu cpf é 123.456.789-09"), `meu cpf é ${REMOVIDO}`);
  assert.equal(redact("cpf 12345678909 ok"), `cpf ${REMOVIDO} ok`);
});
test("redact: cartão de 16 dígitos (junto, com espaço e com traço)", () => {
  for (const c of ["4111111111111111", "4111 1111 1111 1111", "4111-1111-1111-1111"]) assert.equal(redact(`cartao ${c}.`), `cartao ${REMOVIDO}.`);
});
test("redact: e-mail e CEP", () => {
  assert.equal(redact("email joao@x.com"), `email ${REMOVIDO}`);
  assert.equal(redact("cep 50010-000 e 50010000"), `cep ${REMOVIDO} e ${REMOVIDO}`);
});
test("redact: não mexe em horário nem em texto comum", () => {
  assert.equal(redact("pode ser terça às 10:30? dia 25"), "pode ser terça às 10:30? dia 25");
});
test("aceite 4: o que vai pra Anthropic não tem CPF nem e-mail", () => {
  const msgs = normalizarMensagens([{ de: "cliente", texto: "meu cpf é 123.456.789-09 e o email joao@x.com" }]);
  const u = montarUsuario(msgs, { nome: "Fulano", etapa: "OI", dono: "Gustavo" });
  assert.ok(!u.includes("123.456.789-09") && !u.includes("12345678909") && !u.includes("joao@x.com"));
  assert.ok(u.includes(REMOVIDO));
});
test("entrada: no máx. 20 mensagens, vazias fora, autor desconhecido vira cliente", () => {
  const m = normalizarMensagens(Array.from({ length: 30 }, (_, i) => ({ de: i % 2 ? "nos" : "x", texto: i === 29 ? " " : "oi " + i })));
  assert.equal(m.length, 19); assert.equal(m[0].de, "cliente");
});
test("validar: JSON inválido vira null; ação desconhecida vira nenhuma", () => {
  assert.equal(validar(null), null);
  assert.equal(validar({ categoria: "xx", precisa_gustavo: false, rascunho: "oi" }), null);
  const v = validar({ categoria: "outro", precisa_gustavo: false, motivo: "m", rascunho: "oi", acao_crm: { tipo: "apagar_tudo" } });
  assert.equal(v?.acao_crm.tipo, "nenhuma");
});
test("trava: assunto do Gustavo com número/produto vira só espera", () => {
  const s = validar({ categoria: "assunto_gustavo", precisa_gustavo: true, motivo: "m", rascunho: "O seguro com cobertura de doença grave fica R$ 200", acao_crm: { tipo: "nenhuma", etapa_nova: "", obs: "" } })!;
  const t = travaDura(s, "Fulano", "");
  assert.equal(t.rascunho, mensagemEspera("Fulano"));
  assert.ok(!/\d/.test(t.rascunho) && !RX_PROIBIDAS.test(t.rascunho));
});
test("trava: rascunho comum que fala de preço é rebaixado pra assunto_gustavo", () => {
  const s = validar({ categoria: "followup", precisa_gustavo: false, motivo: "m", rascunho: "O preço do plano é ótimo!", acao_crm: { tipo: "nenhuma", etapa_nova: "", obs: "" } })!;
  const t = travaDura(s, "Fulano", "");
  assert.equal(t.categoria, "assunto_gustavo"); assert.equal(t.precisa_gustavo, true);
});
test("trava: agendamento sem janela não pode inventar horário", () => {
  const s = validar({ categoria: "agendamento", precisa_gustavo: false, motivo: "m", rascunho: "Pode ser amanhã às 10h?", acao_crm: { tipo: "nenhuma", etapa_nova: "", obs: "" } })!;
  assert.ok(!/\d/.test(travaDura(s, "Fulano", "").rascunho));
  assert.equal(travaDura(s, "Fulano", "seg a sex, 9h às 18h").rascunho, "Pode ser amanhã às 10h?");
});
test("tool: schema estrito (additionalProperties false em todos os objetos)", () => {
  assert.equal(TOOL.input_schema.additionalProperties, false);
  assert.equal(TOOL.input_schema.properties.acao_crm.additionalProperties, false);
});
