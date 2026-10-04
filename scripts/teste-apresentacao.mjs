/* Testes de aceite · Apresentação de Planos + Busca/Histórico na Revisão (02/10/2026)
   Roda os 12 testes do PROMPT_CODE contra a fixture INVENTADA (Fulano — sem dado real; repo público).
   Supabase e pasta do Drive são SIMULADOS: nada aqui toca o banco.

   Requisitos: node 18+ e playwright (ou playwright-core) + um Chromium.
     python3 -m http.server 4717        # na raiz do repo, em outro terminal
     git show origin/main:revisao-protecao.html > _main_tmp.html   # base do teste 12 (sem regressão)
     CHROME=/caminho/do/chrome node scripts/teste-apresentacao.mjs
   Sai com código 1 se algum teste falhar. */
let chromium; try{ ({chromium} = await import('playwright')); }catch(_){ ({chromium} = await import('playwright-core')); }
import fs from 'fs'; import zlib from 'zlib';
const RAIZ = new URL('..', import.meta.url).pathname, SP = process.env.SAIDA || '/tmp', URL0 = process.env.URL0 || 'http://localhost:4717/';
const fixture = JSON.parse(fs.readFileSync(RAIZ+'scripts/fixtures/revisao_fulano_plano-cards.json','utf8'));
const res = []; const ok=(n,c,det)=>{ res.push([n,!!c,det||'']); };
const b = await chromium.launch(process.env.CHROME ? {executablePath:process.env.CHROME} : {});
const ignora = (t,loc) => /ERR_CERT_AUTHORITY_INVALID|fonts\.g/.test(t) || /favicon\.ico/.test(loc||"");
async function pagina(opts={}){
  const ctx = await b.newContext({viewport:opts.vp||{width:1280,height:900}, acceptDownloads:true});
  const pg = await ctx.newPage(); pg.erros=[];
  pg.on('pageerror',e=>pg.erros.push('PAGEERR '+e.message)); pg.on('console',m=>{ if(m.type()==='error' && !ignora(m.text(), (m.location()||{}).url)) pg.erros.push('CONSOLE '+m.text()); });
  pg.on('response', r=>{ if(r.status()===404) pg.erros.push('404 '+r.url()); });
  if (opts.init) await pg.addInitScript(opts.init);
  return pg;
}
const abrirApz = async pg => { await pg.click('#btPlanos'); await pg.waitForTimeout(200); };
const cardsInfo = pg => pg.evaluate(()=>[...document.querySelectorAll('#apzBox .cards .card')].map(c=>({id:c.querySelector('.name').firstChild.textContent.trim(), preco:c.querySelector('.price').firstChild.textContent, rec:c.classList.contains('rec'), badge:(c.querySelector('.badge')||{}).textContent||'',
  itens:[...c.querySelectorAll('ul.cov li')].map(li=>({up:li.classList.contains('up'), i:li.querySelector('.i').textContent, t:li.children[1].textContent, v:li.querySelector('.v').textContent})),
  resg:[...c.querySelectorAll('.rs-g b')].map(x=>x.textContent)})));
const vNum = s => { s=s.replace('R$ ',''); const m=/([\d.,]+)\s*(mil|mi)?/.exec(s); let v=parseFloat(m[1].replace(/\./g,'').replace(',','.')); if(m[2]==='mi') v*=1e6; else if(m[2]==='mil') v*=1e3; return v; };

/* ---------- 1–6 · caso-modelo (4 cenários) ---------- */
{ const pg = await pagina(); await pg.goto(URL0+'revisao-protecao.html'); await pg.waitForTimeout(600);
  await pg.evaluate(o=>importar(o), fixture); await abrirApz(pg);
  const cs = await cardsInfo(pg);
  ok('1 · ordem D A C B + preços', cs.map(c=>c.id+' '+c.preco).join(' | ')==='D R$ 3.021 | A R$ 2.580 | C R$ 2.480 | B R$ 2.448', cs.map(c=>c.id+' '+c.preco).join(' | '));
  ok('1 · só B com ⭐ Recomendado', cs.filter(c=>c.rec).map(c=>c.id).join()==='B' && /Recomendado/.test(cs.find(c=>c.id==='B').badge));
  const vs = id => (cs.find(c=>c.id===id).itens.find(i=>i.t.startsWith('Vida e Saúde'))||{}).v;
  ok('2 · D V&S 500 mil; A/B/C 250 mil', vs('D')==='500 mil' && ['A','B','C'].every(x=>vs(x)==='250 mil'), ['D','A','B','C'].map(vs).join(' / '));
  ok('2 · D resgate 222/267/292 mil', cs.find(c=>c.id==='D').resg.join(' ')==='R$ 222 mil R$ 267 mil R$ 292 mil', cs.find(c=>c.id==='D').resg.join(' '));
  const lim = cs.every(c=>c.itens.filter(i=>/^(Quebra de ossos|Cirurgia ampliada)/.test(i.t)).every(i=>vNum(i.v)<=300000));
  ok('3 · Quebra de ossos e Cirurgia ampliada ≤ 300 mil', lim);
  ok('3 · diária R$ 2.000 em todos', cs.every(c=>(c.itens.find(i=>i.t==='Diária internado')||{}).v==='R$ 2.000'));
  const txt = await pg.evaluate(()=>document.getElementById('apzBox').innerText + getComputedStyle(document.querySelector('#apzBox ul.cov li.up .v'),'::before').content);
  ok('4 · nenhuma seta ▼ na tela', !/[▼▽⬇↓]/.test(txt.replace(/▾/g,'')));
  const hoje = await pg.evaluate(()=>Object.fromEntries([...document.querySelectorAll('#apzBox .card.hoje ul.cov li')].map(li=>[li.children[1].textContent, li.querySelector('.v').textContent])));
  const eq = {'Vida e Saúde 360':'Vida Inteira','Temporário 10 anos':'Morte, total'};
  let ruins=[]; cs.forEach(c=>c.itens.forEach(i=>{ const base=i.t.replace(/ \(\d+ anos\)$/,'').replace(/ \(já tem\)$/,''); const ref=hoje[eq[base]||base]; const hv=ref?vNum(ref):0;
    if (i.up && !(vNum(i.v)>hv)) ruins.push(c.id+':'+i.t+' ▲ sem ser maior'); if(!i.up && !/já tem/.test(i.t) && vNum(i.v)>hv*1.01 && !['Cirurgia','Assistência funeral'].includes(base)) ruins.push(c.id+':'+i.t+' maior sem ▲'); }));
  ok('4 · ▲ só onde capital > Hoje', !ruins.length, ruins.join('; ')||'ok');
  const cmp = await pg.evaluate(()=>[...document.querySelectorAll('#apzBox .cmp .seg')].map(s=>s.innerText.replace(/\n/g,' ')).join(' | '));
  ok('5 · Temporário 283→421 / 999→1.484 / 3.277→4.869 / acaba aos 68', /38–48 R\$ 283 → 421/.test(cmp)&&/48–58 R\$ 999 → 1\.484/.test(cmp)&&/58–68 R\$ 3\.277 → 4\.869/.test(cmp)&&/68\+ acaba/.test(cmp), cmp.split(' | ').slice(0,4).join(' | '));
  ok('5 · V&S 1.912→2.841 / quitado / vida toda', /R\$ 1\.912 → 2\.841/.test(cmp)&&/R\$ 0 quitado/.test(cmp)&&/68\+ vida toda/.test(cmp), cmp.split(' | ').slice(4).join(' | '));
  // 6
  await pg.click('[data-apz="fechar"]');
  const nCards = await pg.evaluate(()=>document.querySelectorAll('#apzBox .card').length);
  const fechados = await pg.evaluate(()=>document.querySelectorAll('#apzBox .card.closed').length);
  await pg.click('#apzBox .cards .card[data-cen="B"] > .head');
  const aposClick = await pg.evaluate(()=>[...document.querySelectorAll('#apzBox .card')].filter(c=>!c.classList.contains('closed')).map(c=>c.dataset.cen||c.className).join());
  await pg.focus('#apzBox .cards .card[data-cen="A"] > .head'); await pg.keyboard.press('Enter');
  const aposEnter = await pg.evaluate(()=>!document.querySelector('#apzBox .card[data-cen="A"]').classList.contains('closed'));
  await pg.keyboard.press(' ');
  const aposEspaco = await pg.evaluate(()=>document.querySelector('#apzBox .card[data-cen="A"]').classList.contains('closed'));
  ok('6 · Fechar tudo recolhe todos', fechados===nCards && nCards>=7, fechados+'/'+nCards);
  ok('6 · clique reabre só aquele', aposClick==='B', aposClick);
  ok('6 · Enter abre e Espaço fecha via teclado', aposEnter && aposEspaco);
    // abre/fecha sem perder estado + Esc + voltar do navegador
  const antes = await pg.evaluate(()=>JSON.stringify(state));
  await pg.keyboard.press('Escape'); await pg.waitForTimeout(150);
  const fechouEsc = await pg.evaluate(()=>document.getElementById('apzOv').hidden);
  await abrirApz(pg); await pg.goBack(); await pg.waitForTimeout(250);
  const fechouBack = await pg.evaluate(()=>document.getElementById('apzOv').hidden && location.pathname.endsWith('revisao-protecao.html'));
  const depois = await pg.evaluate(()=>JSON.stringify(state));
  ok('T4 · abre/fecha (Voltar, Esc, botão voltar) sem perder estado', fechouEsc && fechouBack && antes===depois);
  ok('1–6 · console limpo', !pg.erros.length, pg.erros.join(' / '));
  // 11 · exportar
  await abrirApz(pg);
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('#apzExport')]);
  const arq = SP+'/'+dl.suggestedFilename(); await dl.saveAs(arq);
  ok('11 · Exportar HTML baixa arquivo', /^Plano_Fulano_de_v\d{4}-\d{2}-\d{2}\.html$/.test(dl.suggestedFilename()), dl.suggestedFilename());
  await pg.close();
  const off = await pagina({vp:{width:768,height:1024}});
  await off.context().route('**/*', r => r.request().url().startsWith('file:') ? r.continue() : r.abort());
  await off.goto('file://'+arq); await off.waitForTimeout(300);
  const offInfo = await off.evaluate(()=>({cards:document.querySelectorAll('.cards .card').length, sc:document.documentElement.scrollWidth}));
  await off.click('[data-apz="fechar"]'); const offF = await off.evaluate(()=>document.querySelectorAll('.card.closed').length===document.querySelectorAll('.card').length);
  await off.click('[data-apz="abrir"]');
  ok('11 · arquivo abre offline com o mesmo visual e recolhe', offInfo.cards===4 && offF && offInfo.sc<=768 && !off.erros.filter(e=>!/ERR_FAILED|net::/.test(e)).length, JSON.stringify(offInfo));
  await off.close();
}

/* ---------- 7 · revisão nova sem `apresentacao` ---------- */
{ const pg = await pagina(); await pg.goto(URL0+'revisao-protecao.html'); await pg.waitForTimeout(600);
  await pg.evaluate(()=>{ const s=VAZIO(); s.cliente.nome='Fulano de Tal'; s.cliente.idade=40; s.cliente.sexo='M';
    s.cen=[{id:'c1',nome:'Plano A',linhas:[
      {id:'a',pid:'WV',prazo:10,classe:'ST',fumante:false,capital:250000,manual:false,premioManual:0},
      {id:'b',pid:'TP',prazo:10,classe:'ST',fumante:false,capital:1000000,manual:false,premioManual:0},
      {id:'c',pid:'PI',prazo:5,classe:'ST',fumante:false,capital:500000,manual:false,premioManual:0},
      {id:'d',pid:'HC',prazo:5,classe:'ST',fumante:false,capital:300,manual:false,premioManual:0}]}];
    importar(s); });
  await abrirApz(pg);
  const cs = await cardsInfo(pg);
  const g = await pg.evaluate(()=>[...document.querySelectorAll('#apzBox .cards .card .grp')].map(x=>x.textContent));
  const it = cs[0].itens.map(i=>i.i+' '+i.t+' '+i.v);
  const esperado = ['🦽 Invalidez acidental','🛏️ Diária internado','👴 Vida e Saúde 360','⏳ Temporário 10 anos','🕊️ Morte, total'];
  ok('7 · grupos certos (parar/dia/velhice/faltar)', g.join('|')==='Se você parar|Dia a dia|Para a velhice|Se você faltar', g.join('|'));
  ok('7 · ícones/rótulos do mapa 3.2', esperado.every((e,k)=>it[k] && it[k].startsWith(e)) && /1,25 mi$/.test(it[4]), it.join(' · '));
  const extra = await pg.evaluate(()=>({tot:document.querySelector('#apzBox .cards .price').firstChild.textContent, tc:'R$ '+Math.round(totalCen(state.cen[0])).toLocaleString('pt-BR'), cmp:!!document.querySelector('#apzBox .cmp'), vs:!!document.querySelector('#apzBox .vs'), fonte:document.getElementById('apzFonte').textContent, resg:[...document.querySelectorAll('#apzBox .rs-g b')].length}));
  ok('7 · preço = total do tarifador; comparação, V&S e resgate gerados', extra.tot===extra.tc && extra.cmp && extra.vs && extra.resg===3, JSON.stringify(extra));
  ok('7 · console limpo', !pg.erros.length, pg.erros.join(' / '));
  await pg.close();
}

/* ---------- 8, 9, 10 · busca + histórico (Supabase e Drive simulados) ---------- */
const gz = o => zlib.gzipSync(Buffer.from(JSON.stringify(o))).toString('base64');
const CARD = {id:'card-teste-1', dono:'gustavo@teste', dados:{id:'card-teste-1', nome:'Fulano de Tal', etapa:'reuniao', cidade:'Recife', telefone:'+55 81 90000-1234', nascimento:'1988-01-01', sexo:'M', profissao:'Profissional autônomo', renda_estimada:12000,
  revisoes:[{arquivo:'revisao_2026-10-02_0015.json', salvo_em:'2026-10-02T00:15:00-03:00', origem:'claude', n_cen:4, tem_ap:true, snapshot_gz:gz(fixture)}]}};
const sessao = `localStorage.setItem('lp_sess', JSON.stringify({access_token:'tk', refresh_token:'rt', expires_at: Math.floor(Date.now()/1000)+3600, user:{email:'gustavo@teste'}}));`;
async function comMock(pg, log){
  await pg.route('**/rest/v1/lp_contatos**', async r => {
    const u = decodeURIComponent(r.request().url()), m = r.request().method(); log.push(m+' '+u.replace(/^.*\/rest\/v1\//,''));
    if (m==='PATCH'){ const body = JSON.parse(r.request().postData()); CARD.dados = body.dados; return r.fulfill({status:204, body:''}); }
    if (/select=revisoes/.test(u)) return r.fulfill({json:[{revisoes:CARD.dados.revisoes}]});
    if (/select=dados&/.test(u)) return r.fulfill({json:[{dados:JSON.parse(JSON.stringify(CARD.dados))}]});
    if (/ilike\.\*fulano\*/i.test(u)) { const d=CARD.dados; return r.fulfill({json:[{id:CARD.id, dono:CARD.dono, nome:d.nome, etapa:d.etapa, cidade:d.cidade, telefone:d.telefone, nascimento:d.nascimento, sexo:d.sexo, profissao:d.profissao, renda_estimada:String(d.renda_estimada)}]}); }
    return r.fulfill({json:[]});
  });
}
for (const modo of ['desktop','ipad']) {
  const log=[];
  const semFSA = `delete window.showDirectoryPicker; try{ Object.defineProperty(window,'showDirectoryPicker',{value:undefined}); }catch(_){}`;
  const fakeDrive = `window.__fakeDrive = true;`;
  const pg = await pagina({vp: modo==='ipad'?{width:768,height:1024}:{width:1280,height:900}, init: sessao + (modo==='ipad'?semFSA:fakeDrive)});
  await comMock(pg, log);
  await pg.goto(URL0+'revisao-protecao.html'); await pg.waitForTimeout(600);
  if (modo==='desktop') await pg.evaluate(o=>{ // pasta do Drive simulada: Histórico de Clientes/<cliente>/revisao_...json
    const arquivo = {kind:'file', name:'revisao_2026-10-02_0015.json', getFile: async()=>({lastModified:Date.now(), text: async()=>JSON.stringify(o)})};
    const sub = {kind:'directory', name:'Fulano de Tal Silva', values: async function*(){ yield arquivo; }};
    const outro = {kind:'directory', name:'Fulano Beltrano', values: async function*(){}};
    const dir = {queryPermission: async()=>'granted', requestPermission: async()=>'granted', values: async function*(){ yield outro; yield sub; }};
    window.revFsa.get = async()=>dir; }, fixture);
  await pg.evaluate(()=>{ state=VAZIO(); save(); render(); });
  await pg.click('#btBusca'); await pg.fill('#rvBuscaTxt','fulano'); await pg.waitForTimeout(700);
  const lista = await pg.evaluate(()=>document.getElementById('rvBuscaOut').innerText);
  ok(`8 · [${modo}] busca "fulano" acha o card do CRM`, /Fulano de Tal/.test(lista) && /•••• 1234/.test(lista) && !/90000/.test(lista), lista.split('\n').slice(0,3).join(' | '));
  await pg.click('#rvBuscaOut li[data-card="0"]'); await pg.waitForTimeout(700);
  const cli = await pg.evaluate(()=>({crm:state.crm, c:state.cliente}));
  ok(`T5 · [${modo}] escolher preenche cliente + vínculo do card`, cli.crm && cli.crm.id==='card-teste-1' && cli.c.nome==='Fulano de Tal' && cli.c.nasc==='1988-01-01' && cli.c.idade>=37 && cli.c.cidade==='Recife' && cli.c.renda===12000, JSON.stringify({crm:cli.crm, idade:cli.c.idade, renda:cli.c.renda}));
  const hist = await pg.evaluate(()=>document.getElementById('rvHistOut').innerText);
  const nLinhas = await pg.evaluate(()=>document.querySelectorAll('#rvHistOut li').length);
  ok(`8 · [${modo}] histórico revisao_2026-10-02_0015.json (origem Claude)` + (modo==='desktop'?' — CRM + Drive sem duplicar':''), /revisao_2026-10-02_0015\.json/.test(hist) && /Claude/.test(hist) && nLinhas===1 && (modo!=='desktop' || /📁 ☁️|☁️ 📁/.test(hist)), hist.replace(/\n/g,' | '));
  await pg.click('#rvHistOut [data-abrir="0"]'); await pg.waitForTimeout(500);
  const ab = await pg.evaluate(()=>({n:(state.cen||[]).length, nomes:state.cen.map(c=>c.nome.split(' ')[0]).join(''), crm:state.crm&&state.crm.id, ap:!!state.apresentacao, sujo:revSujo()}));
  ok(`8 · [${modo}] Abrir carrega os 4 cenários`, ab.n===4 && ab.nomes==='DACB' && ab.crm==='card-teste-1' && ab.ap && !ab.sujo, JSON.stringify(ab));
  // modal de não salvo: mexe e tenta abrir de novo
  await pg.evaluate(()=>{ state.cliente.prof='mudou'; save(); });
  await pg.click('#btBusca'); await pg.waitForTimeout(700);
  await pg.click('#rvHistOut [data-abrir="0"]'); await pg.waitForTimeout(200);
  const modal = await pg.evaluate(()=>!document.getElementById('rvModal').hidden && /não foi salvo/.test(document.getElementById('rvModal').innerText));
  await pg.click('#rvModal [data-i="0"]'); await pg.waitForTimeout(150);
  const cancelou = await pg.evaluate(()=>state.cliente.prof==='mudou');
  ok(`8 · [${modo}] estado não salvo pede confirmação no modal do app (sem confirm nativo)`, modal && cancelou);
  await pg.click('#rvBuscaFechar');
  // 9 · salvar → dados.revisoes
  const antes = CARD.dados.revisoes.length;
  const [dl] = await Promise.all([pg.waitForEvent('download',{timeout:5000}).catch(()=>null), pg.click('#btExport')]);
  await pg.waitForTimeout(800);
  const rv = CARD.dados.revisoes;
  ok(`9 · [${modo}] Salvar grava novo item em dados.revisoes (máx. 10) e o arquivo`, rv.length===antes+1 && rv.length<=10 && /^revisao_\d{4}-\d{2}-\d{2}_\d{4}\.json$/.test(rv[0].arquivo) && rv[0].origem==='claude' && (rv[0].snapshot_gz||rv[0].snapshot) && !!dl && Array.isArray(CARD.dados._hist),
     `itens=${rv.length} 1º=${rv[0].arquivo} arquivo=${dl&&dl.suggestedFilename()}`);
  // teto de 10
  for (let k=0;k<12;k++){ await pg.evaluate(k=>revHistRegistrar(JSON.stringify(Object.assign({tipo:'revisao-prudential'},state)), 'revisao_2030-01-'+String(k+1).padStart(2,'0')+'_0000.json'), k); }
  ok(`9 · [${modo}] teto de 10 no card`, CARD.dados.revisoes.length===10 && CARD.dados.revisoes[0].arquivo==='revisao_2030-01-12_0000.json', 'n='+CARD.dados.revisoes.length);
  if (modo==='ipad') ok('10 · iPad sem File System Access: busca + histórico via CRM, console limpo', !pg.erros.length && log.some(l=>/select=revisoes/.test(l)), pg.erros.join(' / ')||'sem erros');
  else ok('8–9 · desktop console limpo', !pg.erros.length, pg.erros.join(' / '));
  CARD.dados.revisoes = CARD.dados.revisoes.slice(-1).map(x=>x); // reset p/ próximo modo
  CARD.dados.revisoes = [{arquivo:'revisao_2026-10-02_0015.json', salvo_em:'2026-10-02T00:15:00-03:00', origem:'claude', n_cen:4, tem_ap:true, snapshot_gz:gz(fixture)}];
  await pg.close();
}

/* ---------- 12 · sem regressão (main × branch) ---------- */
{ const medir = async arq => { const pg = await pagina(); await pg.goto(URL0+arq); await pg.waitForTimeout(700);
    const r = await pg.evaluate(o=>{ const out={};
      const st=selfTest(); out.self = JSON.stringify(st && (st.falhas||st.fail||st)).length; out.selfOk = JSON.stringify(st).slice(0,200);
      importar(JSON.parse(JSON.stringify(o)));
      out.totais = state.cen.map(c=>totalCen(c).toFixed(2)); out.hoje = totalHoje().toFixed(2);
      const exp = JSON.parse(JSON.stringify(Object.assign({tipo:'revisao-prudential'}, state)));
      delete exp._salvo; delete exp._origem; out.cen = JSON.stringify(exp.cen); out.cliente = JSON.stringify(exp.cliente);
      // tarifador puro: cotação de referência
      out.tar = [['WV',10,250000],['TP',10,1000000],['TM',10,500000],['PI',5,500000],['HC',5,300]].map(([pid,prazo,cap])=>{ const r=calcLinha({pid,prazo,classe:'ST',fumante:false,capital:cap,manual:false},{idade:40,sexo:'M'}); return r&&r.ok?r.mensal.toFixed(4):'x'; });
      return out; }, fixture);
    r.erros = pg.erros; await pg.close(); return r; };
  const a = await medir('_main_tmp.html'), bb = await medir('revisao-protecao.html');
  ok('12 · totais dos cenários idênticos (main × branch)', JSON.stringify(a.totais)===JSON.stringify(bb.totais) && a.hoje===bb.hoje, bb.totais.join(' / '));
  ok('12 · tarifador idêntico (5 cotações de referência)', JSON.stringify(a.tar)===JSON.stringify(bb.tar), bb.tar.join(' / '));
  ok('12 · importar/salvar: cenários e cliente idênticos', a.cen===bb.cen && a.cliente===bb.cliente);
  ok('12 · selfTest da Revisão igual ao da main', a.selfOk===bb.selfOk, bb.selfOk.slice(0,120));
}
await b.close();
let falhas=0; for (const [n,c,d] of res){ if(!c) falhas++; console.log((c?'✅':'❌')+' '+n+(d?'  — '+d:'')); }
console.log(`\n${res.length-falhas}/${res.length} ok`);
process.exit(falhas ? 1 : 0);
