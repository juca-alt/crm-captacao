// Entrada Node (CI) dos testes do RevisaoService. Localmente (Mac sem Node) o
// equivalente é:  jsc revisao-service.js scripts/test-revisao-core.js
// — o núcleo dos testes é portável e vive em test-revisao-core.js.
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
require('../revisao-service.js');      // registra globalThis.RevisaoService
require('./test-revisao-core.js');     // roda os asserts e seta __TEST_FAILS
if (globalThis.__TEST_FAILS > 0) {
  console.error(`test-revisao: ${globalThis.__TEST_FAILS} falha(s)`);
  process.exit(1);
}
console.log(`test-revisao: ${globalThis.__TEST_PASSES} asserts verdes`);
