// deno test supabase/functions/triagem/nucleo_test.ts --allow-read   (conversas INVENTADAS, nenhum dado real)
import { assert, assertEquals } from "jsr:@std/assert@1";
import { montarConversa, precisa, redact, soCortesia, ultimasDoCliente, validar } from "./nucleo.ts";

Deno.test("TRIAGEM-V1: cortesia do cliente vira sem_acao sem chamar IA", () => {
  assert(soCortesia([{ de: "nos", texto: "segue o boleto" }, { de: "cliente", texto: "Obrigado!! 🙏" }]));
  assert(soCortesia([{ de: "cliente", texto: "ok" }, { de: "cliente", texto: "👍" }]));
  assert(soCortesia([{ de: "cliente", tipo: "Sticker", texto: null }]));
  assert(!soCortesia([{ de: "cliente", texto: "ok, e quanto fica o plano?" }]));
  assert(!soCortesia([{ de: "nos", texto: "obrigado" }]));            // a última foi nossa: nada esperando
});
Deno.test("TRIAGEM-V1: só conta o que o cliente mandou depois da nossa última resposta", () => {
  assertEquals(ultimasDoCliente([{ de: "cliente", texto: "a" }, { de: "nos", texto: "b" }, { de: "cliente", texto: "c" }]).map((m) => m.texto), ["c"]);
});
Deno.test("TRIAGEM-V1: conversa que vai pra IA sai sem dado sensível e com mídia rotulada", () => {
  const t = montarConversa([{ de: "cliente", texto: "meu cpf 111.444.777-35 e email fulano@x.com" }, { de: "cliente", tipo: "Audio", texto: null }]);
  assert(!/111\.444/.test(t) && !/fulano@/.test(t) && /\[áudio\]/.test(t) && /^\[cliente\]/.test(t));
  assertEquals(redact("cep 50000-000"), "cep [dado removido]");
});
Deno.test("TRIAGEM-V1: validar aceita só os 4 destinos e limpa o motivo", () => {
  assertEquals(validar({ destino: "rebeca", motivo: "pede segunda via do boleto", urgencia: 2 }), { destino: "rebeca", motivo: "pede segunda via do boleto", urgencia: 2 });
  assertEquals(validar({ destino: "qualquer", motivo: "x", urgencia: 2 }), null);
  assertEquals(validar({ destino: "gustavo", motivo: "quer cotação de R$ 500", urgencia: 3 })!.motivo, "");   // valor não fica gravado
  assertEquals(validar({ destino: "vitor", motivo: "vg da empresa", urgencia: 9 })!.urgencia, 2);
});
Deno.test("TRIAGEM-V1: reclassifica só quando chega mensagem nova (datas por número)", () => {
  assert(precisa("2026-11-09T10:00:00Z", null));
  assert(!precisa("2026-11-09T10:00:00Z", "2026-11-09T10:00:00+00:00"));
  assert(precisa("2026-11-09T10:05:00Z", "2026-11-09T10:00:00+00:00"));
});
Deno.test("TRIAGEM-V1: a função nunca chama a Umbler nem envia mensagem", async () => {
  const src = await Deno.readTextFile(new URL("./index.ts", import.meta.url));
  assert(!/umbler\.com/i.test(src) && !/\/v1\/messages/.test(src.replace(/messages\.create/g, "")));
  assert(!/\.(insert|update|upsert|delete)\(/.test(src.replace(/from\("copiloto_fila_cache"\)\.upsert\(/g, "")));   // só grava no cache
});
