// Guard do choke point de criação de leads.
// Regra: TODO `from('leads').insert` do app precisa estar dentro de
// insertLead()/insertLeadsBatch() no index.html — qualquer origem nova que
// insira lead por fora fura a rastreabilidade (id + código PI + dedupe).
// Roda no CI (guard-choke-point.yml) e falha o push/PR que violar.
import { readFileSync } from 'node:fs';

const RE = /from\(\s*['"]leads['"]\s*\)\s*\.\s*insert/g;
const lineOf = (src, i) => src.slice(0, i).split('\n').length;
let falhas = 0;

// index.html: inserts só entre a definição de insertLead e o fim de insertLeadsBatch
const idx = readFileSync('index.html', 'utf8');
const ini = idx.indexOf('async function insertLead(');
const fim = idx.indexOf('// ===== FILTERING');
if (ini < 0 || fim < 0 || fim < ini) {
  console.error('guard: marcadores do choke point não encontrados no index.html — se as funções foram movidas/renomeadas, atualize este guard junto.');
  process.exit(1);
}
const hits = [...idx.matchAll(RE)];
for (const m of hits) {
  if (m.index < ini || m.index > fim) {
    console.error(`guard: insert em leads FORA do choke point — index.html:${lineOf(idx, m.index)}. Use insertLead()/insertLeadsBatch().`);
    falhas++;
  }
}

// vendas.html (visão LP): não pode inserir em leads de jeito nenhum
try {
  const lp = readFileSync('vendas.html', 'utf8');
  for (const m of lp.matchAll(RE)) {
    console.error(`guard: vendas.html:${lineOf(lp, m.index)} insere em leads — a LP usa tabelas próprias; criação de lead é só pelo choke point do index.html.`);
    falhas++;
  }
} catch { /* vendas.html pode não existir em branches antigas */ }

if (falhas) process.exit(1);
console.log(`guard ok: ${hits.length} insert(s) em leads, todos dentro de insertLead/insertLeadsBatch.`);
