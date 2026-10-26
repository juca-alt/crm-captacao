// ===== 2.10.0 · RELATÓRIOS DO PORTAL — gravar uma vez, puxar sempre =====
// Roda SÓ no service worker (importScripts do sw.js). Nada aqui fala com o banco: o arquivo vai pro CRM aberto numa aba
// (window.portalReceber no vendas.html), que decide o que fazer com ele (Central de Importações).
//
// Como funciona:
//  1. GRAVAR (por aba + origem, 15 min no máximo): o webRequest só OBSERVA os pedidos daquela aba (método, url, campos do
//     formulário) e guarda os últimos 30 — já LIMPOS (sem senha/token, sem __VIEWSTATE). Quando começa um download vindo
//     daquele site, o pedido que o gerou vira uma RECEITA (chrome.storage.local `portal_receitas`).
//  2. PUXAR: dentro da aba do portal (mesma origem → o portal reconhece a sessão pelos cookies do próprio navegador) a
//     extensão abre a página de novo pra pegar o __VIEWSTATE FRESCO, junta com os campos da receita (datas recalculadas
//     a partir de hoje) e reenvia o formulário. O arquivo volta como base64 e vai pro CRM.
//
// Regras de segurança (duras): nunca guarda cookie, cabeçalho nem senha. Campo com nome de senha/código/captcha → o
// pedido é tratado como LOGIN e nunca vira receita; campo com "token" é descartado (o fresco vem da página na hora).

const PORTAL_KEY='portal_receitas';
const PORTAL_GRAV_MS=15*60*1000;          // gravação desliga sozinha em 15 min
const PORTAL_BUF_MAX=30;                  // últimos 30 pedidos por aba gravando
const PORTAL_RE_LOGIN=/senha|password|passwd|pwd|otp|captcha|codigo.?sms|2fa/i;          // cara de login → nunca vira receita
const PORTAL_RE_SEGREDO=/senha|password|passwd|pwd|token|otp|captcha|codigo.?sms|2fa/i;  // nunca é guardado
const PORTAL_RE_ESTADO=/^(__VIEWSTATE\d*|__VIEWSTATEGENERATOR|__VIEWSTATEFIELDCOUNT|__VIEWSTATEENCRYPTED|__EVENTVALIDATION|__PREVIOUSPAGE|__REQUESTDIGEST)$/i;
const PORTAL_VAL_MAX=4000;                // valor de campo maior que isso não é filtro de relatório (estado/blob) → fora

// ---------- utilidades ----------
function portalOrigem(u){ try{ const x=new URL(u); return /^https?:$/.test(x.protocol)?x.origin:null; }catch(_){ return null; } }
function portalUid(){ return Date.now().toString(36)+Math.random().toString(36).slice(2,8); }
function portalHoje(){ const d=new Date(); d.setHours(0,0,0,0); return d; }
const p2=n=>String(n).padStart(2,'0');

// fila única: gravações no storage em ordem (o webRequest dispara muitos eventos seguidos)
let _portalFila=Promise.resolve();
function portalFila(fn){ const p=_portalFila.then(fn,fn); _portalFila=p.catch(()=>{}); return p; }

// ---------- limpeza do formulário (o coração da segurança) ----------
/* recebe {nome:[valores]} e devolve {form, login}. login=true → o pedido inteiro é descartado (form=null). */
function portalLimparForm(fd){
  const form={}; let login=false;
  for(const [k,vs] of Object.entries(fd||{})){
    const nome=String(k);
    if(PORTAL_RE_LOGIN.test(nome)){ login=true; continue; }
    if(PORTAL_RE_SEGREDO.test(nome)) continue;
    if(PORTAL_RE_ESTADO.test(nome)) continue;
    const arr=(Array.isArray(vs)?vs:[vs]).map(v=>String(v==null?'':v));
    if(arr.some(v=>v.length>PORTAL_VAL_MAX)) continue;
    form[nome]=arr.slice(0,50);
  }
  return login?{form:null,login:true}:{form,login:false};
}
/* url sem parâmetros sensíveis (token/senha na query também não ficam guardados) */
function portalLimparUrl(u){
  try{ const x=new URL(u); x.hash='';
    const q={}; for(const [k,v] of x.searchParams){ (q[k]=q[k]||[]).push(v); }
    const {form,login}=portalLimparForm(q);
    const s=new URLSearchParams(); if(form) for(const [k,vs] of Object.entries(form)) for(const v of vs) s.append(k,v);
    x.search=s.toString(); return {url:x.toString(),login,query:form||{}};
  }catch(_){ return {url:'',login:false,query:{}}; }
}
function portalReqLimpa(d){
  const u=portalLimparUrl(d.url);
  const fd=d.requestBody&&d.requestBody.formData;
  const f=fd?portalLimparForm(fd):{form:null,login:false};
  const login=u.login||f.login;
  return {rid:String(d.requestId||''),method:String(d.method||'GET').toUpperCase(),url:u.url,form:login?null:f.form,login,em:Date.now(),tipo:d.type||''};
}

// ---------- datas: delta em dias (dd/mm/aaaa, aaaa-mm-dd) ou meses (mm/aaaa) contra o dia da gravação ----------
function portalDatasDe(form){
  const out={}, hoje=portalHoje();
  for(const [k,vs] of Object.entries(form||{})){
    const v=String((vs||[])[0]||'').trim(); let m;
    if((m=v.match(/^(\d{2})\/(\d{2})\/(\d{4})$/))){
      const d=new Date(+m[3],+m[2]-1,+m[1]); if(d.getMonth()!==+m[2]-1) continue;
      out[k]={tipo:'dia',delta:Math.round((d-hoje)/86400000)};
    }else if((m=v.match(/^(\d{4})-(\d{2})-(\d{2})$/))){
      const d=new Date(+m[1],+m[2]-1,+m[3]); if(d.getMonth()!==+m[2]-1) continue;
      out[k]={tipo:'dia',delta:Math.round((d-hoje)/86400000),fmt:'iso'};
    }else if((m=v.match(/^(\d{2})\/(\d{4})$/))&&+m[1]>=1&&+m[1]<=12){
      out[k]={tipo:'mes',delta:(+m[2]-hoje.getFullYear())*12+(+m[1]-1-hoje.getMonth())};
    }
  }
  return out;
}
function portalDatasHoje(datas){
  const out={}, hoje=portalHoje();
  for(const [k,x] of Object.entries(datas||{})){
    if(!x||!isFinite(x.delta)) continue;
    if(x.tipo==='dia'){ const d=new Date(hoje); d.setDate(d.getDate()+x.delta);
      out[k]=x.fmt==='iso'?`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`:`${p2(d.getDate())}/${p2(d.getMonth()+1)}/${d.getFullYear()}`; }
    else if(x.tipo==='mes'){ const d=new Date(hoje.getFullYear(),hoje.getMonth()+x.delta,1); out[k]=`${p2(d.getMonth()+1)}/${d.getFullYear()}`; }
  }
  return out;
}

// ---------- receitas ----------
async function portalReceitas(){ try{ const o=await chrome.storage.local.get(PORTAL_KEY); return Array.isArray(o[PORTAL_KEY])?o[PORTAL_KEY]:[]; }catch(_){ return []; } }
async function portalSalvarReceitas(l){ await chrome.storage.local.set({[PORTAL_KEY]:l}); }
/* toda mudança na lista passa pela fila (gravação, nome, resultado, apagar não se atropelam) */
function portalMudar(fn){ return portalFila(async()=>{ const l=await portalReceitas(); const r=await fn(l); if(r!==false) await portalSalvarReceitas(r&&r.lista||l); return r; }); }
function portalNomeDoArquivo(arq){
  let n=String(arq||'').split(/[\\/]/).pop()||'';
  n=n.replace(/\.[a-z0-9]{1,5}$/i,'').replace(/\s*\(\d+\)$/,'')
     .replace(/^(relat[oó]rio|relatorio|rel|pag|export(acao|ação)?|download)[\s_\-]*/i,'')
     .replace(/[_\-]+\d{6,}.*$/,'').replace(/[_\-]+/g,' ').trim();
  return n?n.charAt(0).toUpperCase()+n.slice(1):'';
}
function portalAssinatura(r){
  const f=Object.keys(r.form||{}).filter(k=>!(r.datas&&r.datas[k])).sort().map(k=>k+'='+(r.form[k]||[]).join(','));
  return [r.origem,r.method,r.url.split('?')[0],f.join('&')].join('|');
}

// ---------- gravação (estado em chrome.storage.session, com espelho em memória pro webRequest ser barato) ----------
let _gravCache=null;
const _gravPronto=chrome.storage.session.get('portal_grav').then(o=>{ _gravCache=(o&&o.portal_grav)||{}; }).catch(()=>{ _gravCache={}; });
async function portalGrav(){ await _gravPronto; return _gravCache; }
async function portalGravSalvar(){ await chrome.storage.session.set({portal_grav:_gravCache}); }
async function portalGravAtiva(tabId){
  const g=await portalGrav(), x=g[tabId]; if(!x) return null;
  if(Date.now()>x.ate){ delete g[tabId]; await portalGravSalvar(); await chrome.storage.session.remove('portal_buf_'+tabId); portalAvisar(x.origem,'⏱ A gravação terminou (15 min).'); return null; }
  return x;
}
async function portalGravar(tabId,origem,on){
  const g=await portalGrav();
  if(on) g[tabId]={origem,ate:Date.now()+PORTAL_GRAV_MS,desde:Date.now(),n:0};
  else delete g[tabId];
  await portalGravSalvar();
  if(!on) await chrome.storage.session.remove('portal_buf_'+tabId);
}

function portalOnRequest(d){
  if(d.tabId<0) return;
  if(_gravCache&&!_gravCache[d.tabId]) return;            // caminho rápido: esta aba não está gravando
  portalFila(async()=>{
    const g=await portalGravAtiva(d.tabId); if(!g) return;
    if(portalOrigem(d.url)!==g.origem) return;
    const e=portalReqLimpa(d), k='portal_buf_'+d.tabId;
    const o=await chrome.storage.session.get(k), buf=Array.isArray(o[k])?o[k]:[];
    buf.push(e); while(buf.length>PORTAL_BUF_MAX) buf.shift();
    await chrome.storage.session.set({[k]:buf});
  });
}

/* resposta de um pedido gravado: só o NOME do arquivo (Content-Disposition) é lido — nenhum outro cabeçalho, nada de cookie */
function portalArquivoDoCd(cd){
  const m1=/filename\*\s*=\s*(?:UTF-8|ISO-8859-1)?''([^;]+)/i.exec(cd||''), m2=/filename\s*=\s*"?([^";]+)"?/i.exec(cd||'');
  try{ return m1?decodeURIComponent(m1[1].trim()):(m2?m2[1].trim():''); }catch(_){ return m2?m2[1].trim():''; }
}
function portalOnHeaders(d){
  if(d.tabId<0||!_gravCache||!_gravCache[d.tabId]) return;
  const h=(d.responseHeaders||[]).find(x=>/^content-disposition$/i.test(x.name));
  const arq=h&&portalArquivoDoCd(h.value); if(!arq) return;
  portalFila(async()=>{
    const k='portal_buf_'+d.tabId, o=await chrome.storage.session.get(k), buf=Array.isArray(o[k])?o[k]:[];
    const e=buf.find(x=>x.rid===String(d.requestId)); if(!e) return;
    e.arq=arq.slice(0,200); await chrome.storage.session.set({[k]:buf});
  });
}

/* um download começou: se veio de um site que está gravando, o pedido que o gerou vira receita */
async function portalOnDownload(item){
  if(!item||item.byExtensionId) return;
  const g=await portalGrav(); if(!Object.keys(g).length) return;
  const origem=portalOrigem(item.finalUrl||item.url)||portalOrigem(String(item.url||'').replace(/^blob:/,''))||portalOrigem(item.referrer);
  if(!origem) return;
  const abas=[];
  for(const tid of Object.keys(g)){ const x=await portalGravAtiva(+tid); if(x&&x.origem===origem) abas.push(+tid); }
  if(!abas.length) return;
  await new Promise(r=>setTimeout(r,250));                 // deixa o onBeforeRequest do mesmo pedido entrar na fila antes
  await _portalFila;
  const agora=Date.now(), urls=new Set([item.url,item.finalUrl].filter(Boolean).map(u=>portalLimparUrl(u).url));
  let achou=null, aba=null;
  for(const tid of abas){
    const o=await chrome.storage.session.get('portal_buf_'+tid), buf=(o['portal_buf_'+tid]||[]).slice().reverse();
    const e=buf.find(x=>urls.has(x.url)&&agora-x.em<60000)
          ||buf.find(x=>x.method==='POST'&&agora-x.em<15000);
    if(e&&(!achou||e.em>achou.em)){ achou=e; aba=tid; }
  }
  if(!achou){ portalAvisar(origem,'Vi um download, mas não achei o pedido que o gerou. Tente baixar de novo.'); return; }
  if(achou.login){ portalAvisar(origem,'🔒 Esse pedido tinha campo de senha/código — por segurança não memorizei.'); return; }

  let pagina='';
  if(portalOrigem(item.referrer)===origem) pagina=portalLimparUrl(item.referrer).url;
  if(!pagina){ try{ const t=await chrome.tabs.get(aba); if(portalOrigem(t.url)===origem) pagina=portalLimparUrl(t.url).url; }catch(_){} }
  let url=achou.url, form=achou.form||{};
  if(achou.method==='GET'){ form=portalLimparUrl(achou.url).query; url=achou.url.split('?')[0]; }
  if(!pagina) pagina=achou.url;
  let arq=achou.arq||item.filename||'';
  if(!arq){ try{ const [it]=await chrome.downloads.search({id:item.id}); arq=(it&&it.filename)||''; }catch(_){} }
  const nomeArq=portalNomeDoArquivo(arq)||portalNomeDoArquivo(new URL(url).pathname);
  const rec={id:portalUid(),origem,nome:nomeArq||'Relatório',nomeAuto:!arq,method:achou.method==='GET'?'GET':'POST',url,form,pagina,
    gravadoEm:new Date().toISOString(),datas:portalDatasDe(form),ultimo:null};
  const alvo=await portalFila(async()=>{
    const lista=await portalReceitas(), sig=portalAssinatura(rec), ja=lista.find(r=>portalAssinatura(r)===sig);
    if(ja) Object.assign(ja,{form:rec.form,datas:rec.datas,pagina:rec.pagina,gravadoEm:rec.gravadoEm});
    else lista.push(rec);
    await portalSalvarReceitas(lista);
    const g2=await portalGrav(); if(g2[aba]){ g2[aba].n=(g2[aba].n||0)+1; await portalGravSalvar(); }
    return {r:ja||rec,novo:!ja};
  });
  _portalDl[item.id]=alvo.r.id;
  portalAvisar(origem,(alvo.novo?'✓ Memorizei: ':'✓ Atualizei: ')+alvo.r.nome);
}
const _portalDl={};
/* o nome final do arquivo só aparece depois (onChanged) — se o nome ainda é o automático, troca */
async function portalOnDownloadNome(delta){
  const id=_portalDl[delta.id]; if(!id||!delta.filename||!delta.filename.current) return;
  const n=portalNomeDoArquivo(delta.filename.current); if(!n) return;
  const l=await portalReceitas(), r=l.find(x=>x.id===id); if(!r||!r.nomeAuto) return;
  r.nomeAuto=false; r.nome=n; await portalSalvarReceitas(l); portalAvisar(r.origem,'');
}

// ---------- painel: em quais abas está aberto (reaparece sozinho quando a página do portal recarrega) ----------
async function portalPaineis(){ const o=await chrome.storage.session.get('portal_painel'); return (o&&o.portal_painel)||{}; }
async function portalPainelMarcar(tabId,info){ const p=await portalPaineis(); if(info) p[tabId]=info; else delete p[tabId]; await chrome.storage.session.set({portal_painel:p}); }
async function portalAbrirNaAba(tabId,origem){
  const p=await portalPaineis(); p[tabId]=Object.assign({},p[tabId]||{},{origem,min:false}); await chrome.storage.session.set({portal_painel:p});
  await chrome.scripting.executeScript({target:{tabId},files:['content/portal.js']});
}
async function portalAvisar(origem,aviso){
  const p=await portalPaineis();
  for(const [tid,x] of Object.entries(p)){ if(x&&x.origem===origem){ try{ await chrome.tabs.sendMessage(+tid,{type:'portal.mudou',aviso:aviso||''}); }catch(_){} } }
}
try{ chrome.tabs.onUpdated.addListener(async(tabId,info,tab)=>{
  if(info.status!=='complete') return;
  const p=await portalPaineis(), x=p[tabId]; if(!x) return;
  if(portalOrigem(tab&&tab.url)!==x.origem){ await portalPainelMarcar(tabId,null); return; }   // saiu do portal: painel não volta
  try{ await chrome.scripting.executeScript({target:{tabId},files:['content/portal.js']}); }catch(_){}
}); }catch(_){}
try{ chrome.tabs.onRemoved.addListener(async tabId=>{
  try{ await portalPainelMarcar(tabId,null); const g=await portalGrav(); if(g[tabId]){ delete g[tabId]; await portalGravSalvar(); }
    await chrome.storage.session.remove('portal_buf_'+tabId); }catch(_){}
}); }catch(_){}

// ---------- PUXAR (repetir a receita dentro da aba do portal) ----------
/* Injetada na aba do portal (mundo ISOLADO da extensão; o fetch sai como a própria página → mesma origem, cookies do
   navegador, nenhum cookie passa pela extensão). Precisa ser autocontida (vai como texto). */
async function portalReplayNaPagina(rec,datasHoje){
  const ESTADO=/^(__VIEWSTATE\d*|__VIEWSTATEGENERATOR|__VIEWSTATEFIELDCOUNT|__VIEWSTATEENCRYPTED|__EVENTVALIDATION|__PREVIOUSPAGE|__REQUESTDIGEST)$/i;
  const EXPIROU='Sessão do portal expirou — entre de novo no portal e tente.';
  const temLogin=doc=>!!doc.querySelector('input[type=password]');
  try{
    if(new URL(rec.url).origin!==location.origin) return {ok:false,msg:'Esta aba não é do portal da receita.'};
    const form={}; for(const [k,vs] of Object.entries(rec.form||{})) form[k]=(vs||[]).slice();
    for(const [k,v] of Object.entries(datasHoje||{})) if(form[k]) form[k][0]=v;
    let url=rec.url, init={credentials:'include',cache:'no-store',redirect:'follow'};
    const corpo=new URLSearchParams();
    if(rec.method==='GET'){
      for(const [k,vs] of Object.entries(form)) for(const v of vs) corpo.append(k,v);
      const q=corpo.toString(); if(q) url+=(url.includes('?')?'&':'?')+q;
      init.method='GET';
    }else{
      const r1=await fetch(rec.pagina||rec.url,{credentials:'include',cache:'no-store',redirect:'follow'});
      const doc=new DOMParser().parseFromString(await r1.text(),'text/html');
      if(temLogin(doc)) return {ok:false,code:'sessao',msg:EXPIROU};
      const alvo=new URL(rec.url).pathname.split('/').pop().toLowerCase();
      const fs=[...doc.forms];
      const f=fs.find(x=>x.querySelector('input[name="__VIEWSTATE"]'))
        ||fs.find(x=>String(x.getAttribute('action')||'').toLowerCase().split('?')[0].split('/').pop()===alvo)||fs[0]||doc;
      const frescos={};
      for(const i of f.querySelectorAll('input[type=hidden][name]')) (frescos[i.name]=frescos[i.name]||[]).push(i.value||'');
      const final=Object.assign({},frescos);
      for(const [k,vs] of Object.entries(form)) if(!ESTADO.test(k)) final[k]=vs;
      for(const [k,vs] of Object.entries(final)) for(const v of vs) corpo.append(k,v);
      init.method='POST'; init.body=corpo.toString(); init.headers={'Content-Type':'application/x-www-form-urlencoded'};
    }
    const r=await fetch(url,init);
    const ct=r.headers.get('content-type')||'', cd=r.headers.get('content-disposition')||'';
    const buf=await r.arrayBuffer();
    if(!r.ok) return {ok:false,msg:`O portal respondeu com erro (${r.status}). Tente de novo; se continuar, grave esse relatório de novo.`};
    const anexo=/attachment|filename/i.test(cd);
    if(!anexo&&/text\/html/i.test(ct)){
      const d=new DOMParser().parseFromString(new TextDecoder().decode(buf.slice(0,3e6)),'text/html');
      if(temLogin(d)) return {ok:false,code:'sessao',msg:EXPIROU};
      if(!d.querySelector('table')) return {ok:false,code:'pagina',msg:'O portal devolveu uma página em vez do relatório. A sessão pode ter expirado: entre de novo no portal e tente. Se continuar, grave esse relatório de novo.'};
    }
    let nome='';
    const m1=cd.match(/filename\*\s*=\s*(?:UTF-8|ISO-8859-1)?''([^;]+)/i), m2=cd.match(/filename\s*=\s*"?([^";]+)"?/i);
    try{ nome=m1?decodeURIComponent(m1[1].trim()):(m2?m2[1].trim():''); }catch(_){ nome=m2?m2[1].trim():''; }
    const mime=(ct.split(';')[0]||'').trim()||'application/octet-stream';
    if(!nome){ const ext=/sheet/.test(mime)?'.xlsx':/excel|html/.test(mime)?'.xls':/csv/.test(mime)?'.csv':/pdf/.test(mime)?'.pdf':''; nome=(rec.nome||'relatorio')+ext; }
    // base64 em pedaços (múltiplos de 3 bytes → cada pedaço é base64 válido sozinho; arquivo de 10–15 MB não estoura a pilha)
    const u8=new Uint8Array(buf), PED=3*0x8000, partes=[];
    for(let i=0;i<u8.length;i+=PED){ const s=u8.subarray(i,i+PED); let bin=''; for(let j=0;j<s.length;j+=0x2000) bin+=String.fromCharCode.apply(null,s.subarray(j,j+0x2000)); partes.push(btoa(bin)); }
    return {ok:true,nome,mime,b64:partes.join(''),bytes:u8.length};
  }catch(e){ return {ok:false,msg:'Não consegui falar com o portal: '+((e&&e.message)||e)}; }
}

/* Injetada no CRM (mundo da PÁGINA, onde mora window.portalReceber). Autocontida. */
async function portalEntregarNoCrm(payload){
  if(typeof window.portalReceber!=='function') return {ok:false,code:'sem-funcao'};
  try{
    const r=await Promise.race([Promise.resolve(window.portalReceber(payload)),
      new Promise(res=>setTimeout(()=>res({ok:false,msg:'O CRM demorou demais pra responder (2 min).'}),120000))]);
    if(!r||typeof r!=='object') return {ok:false,msg:'O CRM não devolveu resposta.'};
    return {ok:!!r.ok,tipo:String(r.tipo||''),msg:String(r.msg||'')};
  }catch(e){ return {ok:false,msg:'O CRM deu erro ao receber: '+((e&&e.message)||e)}; }
}

/* CRM de destino: o real; teste local (127.0.0.1/localhost) só se `crm_url_teste` estiver no storage da extensão */
async function portalCrmUrl(){
  try{ const o=await chrome.storage.local.get('crm_url_teste'), t=String((o&&o.crm_url_teste)||'');
    if(/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(t)) return {url:t,teste:true}; }catch(_){}
  return {url:CRM_RELATORIOS_URL,teste:false};
}
function portalEsperarAba(tabId,ms){
  return new Promise(res=>{ let fim=false;
    const acabar=()=>{ if(fim) return; fim=true; clearTimeout(t); try{ chrome.tabs.onUpdated.removeListener(l); }catch(_){} res(); };
    const l=(id,info)=>{ if(id===tabId&&info.status==='complete') acabar(); };
    chrome.tabs.onUpdated.addListener(l); const t=setTimeout(acabar,ms);
    chrome.tabs.get(tabId).then(x=>{ if(x&&x.status==='complete') acabar(); }).catch(acabar); });
}
async function portalAbaCrm(){
  const {url}=await portalCrmUrl(), base=url.split(/[?#]/)[0];
  const tabs=await chrome.tabs.query({});
  const t=tabs.find(x=>String(x.url||'').split(/[?#]/)[0]===base&&!/[?&]wa=1(&|#|$)/.test(String(x.url||'')));
  if(t){ if(t.status!=='complete') await portalEsperarAba(t.id,30000); return t.id; }
  const n=await chrome.tabs.create({url:base,active:false});
  await portalEsperarAba(n.id,30000); await new Promise(r=>setTimeout(r,2000));
  return n.id;
}
async function portalEntregar(payload){
  let tabId;
  try{ tabId=await portalAbaCrm(); }catch(e){ return {ok:false,msg:'Não consegui abrir o CRM: '+((e&&e.message)||e)}; }
  // o app pode demorar a montar: espera a função aparecer (até ~15 s)
  for(let i=0;i<15;i++){
    let tem=false;
    try{ const [x]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:()=>typeof window.portalReceber==='function'}); tem=!!(x&&x.result); }catch(_){}
    if(tem) break; if(i===14) return {ok:false,msg:'Atualize o CRM (⬆ Atualizar app) — esta versão ainda não recebe relatórios da extensão.'};
    await new Promise(r=>setTimeout(r,1000));
  }
  try{
    const [x]=await chrome.scripting.executeScript({target:{tabId},world:'MAIN',func:portalEntregarNoCrm,args:[payload]});
    const r=(x&&x.result)||{ok:false,msg:'O CRM não devolveu resposta.'};
    if(r.code==='sem-funcao') return {ok:false,msg:'Atualize o CRM (⬆ Atualizar app) — esta versão ainda não recebe relatórios da extensão.'};
    return r;
  }catch(e){ return {ok:false,msg:'Não consegui entregar ao CRM: '+((e&&e.message)||e)}; }
}

let PORTAL_RODANDO=null;   // {origem, id, fase, fila:[ids]}
async function portalAbaDoPortal(origem,preferida){
  if(preferida!=null){ try{ const t=await chrome.tabs.get(preferida); if(portalOrigem(t.url)===origem) return t.id; }catch(_){} }
  const tabs=(await chrome.tabs.query({})).filter(t=>portalOrigem(t.url)===origem);
  return tabs.length?(tabs.find(t=>t.active)||tabs[0]).id:null;
}
function portalUltimo(id,ultimo){ return portalMudar(l=>{ const r=l.find(x=>x.id===id); if(!r) return false; r.ultimo=ultimo; }); }
async function portalPuxarUma(id,abaPreferida){
  const rec=(await portalReceitas()).find(x=>x.id===id); if(!rec) return;
  const fase=f=>{ if(PORTAL_RODANDO){ PORTAL_RODANDO.id=id; PORTAL_RODANDO.fase=f; } portalAvisar(rec.origem,''); };
  const fim=async(ok,msg,extra)=>{ await portalUltimo(id,Object.assign({em:new Date().toISOString(),ok:!!ok,msg:String(msg||'')},extra||{})); portalAvisar(rec.origem,''); };
  const tabId=await portalAbaDoPortal(rec.origem,abaPreferida);
  if(tabId==null) return fim(false,'Abra o portal neste Chrome e entre (login). Depois clique em Puxar de novo.');
  fase('buscando');
  let r;
  try{ const [x]=await chrome.scripting.executeScript({target:{tabId},func:portalReplayNaPagina,args:[rec,portalDatasHoje(rec.datas)]}); r=x&&x.result; }
  catch(e){ r={ok:false,msg:'Não consegui rodar na aba do portal: '+((e&&e.message)||e)}; }
  if(!r||!r.ok) return fim(false,(r&&r.msg)||'O portal não devolveu o arquivo.');
  fase('entregando');
  const e=await portalEntregar({nome:r.nome,mime:r.mime,b64:r.b64,origem:'extensao',receita:rec.nome});
  return fim(e.ok,e.msg||(e.ok?'Entregue ao CRM.':'O CRM não aceitou o arquivo.'),{tipo:e.tipo||'',arquivo:r.nome,bytes:r.bytes});
}
async function portalPuxar(origem,ids,abaPreferida){
  if(PORTAL_RODANDO) throw {message:'Já estou puxando um relatório — espere terminar.'};
  PORTAL_RODANDO={origem,id:null,fase:'',fila:ids.slice()};
  const vivo=setInterval(()=>{ try{ chrome.runtime.getPlatformInfo(()=>void chrome.runtime.lastError); }catch(_){} },20000);  // SW não dorme no meio
  (async()=>{
    try{ for(const id of ids){ PORTAL_RODANDO.fila=PORTAL_RODANDO.fila.filter(x=>x!==id); await portalPuxarUma(id,abaPreferida); } }
    catch(_){}
    finally{ clearInterval(vivo); PORTAL_RODANDO=null; portalAvisar(origem,''); }
  })();
  return {iniciado:true,n:ids.length};
}

// ---------- mensagens do painel (content/portal.js). A origem vem do REMETENTE, nunca do que a página diz. ----------
function portalOrigemDoRemetente(sender){ return portalOrigem((sender&&sender.tab&&sender.tab.url)||(sender&&sender.url)); }
async function portalDaOrigem(sender,id){
  const origem=portalOrigemDoRemetente(sender); if(!origem) throw {message:'Abra pelo ícone da extensão numa aba do portal.'};
  const l=await portalReceitas(), r=id!=null?l.find(x=>x.id===id&&x.origem===origem):null;
  return {origem,lista:l,rec:r};
}
let _portalCss=null;
const PORTAL_HANDLERS={
  'portal.css': async()=>{ if(_portalCss==null) _portalCss=await (await fetch(chrome.runtime.getURL('content/portal.css'))).text(); return _portalCss; },
  'portal.estado': async(m,sender)=>{
    const {origem,lista}=await portalDaOrigem(sender), tabId=sender.tab&&sender.tab.id;
    const g=tabId!=null?await portalGravAtiva(tabId):null, p=(await portalPaineis())[tabId]||{};
    const rod=PORTAL_RODANDO&&PORTAL_RODANDO.origem===origem?{id:PORTAL_RODANDO.id,fase:PORTAL_RODANDO.fase,fila:PORTAL_RODANDO.fila}:null;
    return {origem,versao:EXT_VERSION,teste:(await portalCrmUrl()).teste,min:!!p.min,
      gravando:g?{ate:g.ate,n:g.n||0}:null,rodando:rod,
      receitas:lista.filter(r=>r.origem===origem).map(r=>({id:r.id,nome:r.nome,gravadoEm:r.gravadoEm,ultimo:r.ultimo||null,
        nDatas:Object.keys(r.datas||{}).length}))};
  },
  'portal.gravar': async(m,sender)=>{ const {origem}=await portalDaOrigem(sender); await portalGravar(sender.tab.id,origem,!!m.on); return true; },
  'portal.renomear': async(m,sender)=>{ const {origem}=await portalDaOrigem(sender);
    const n=String(m.nome||'').trim().slice(0,80); if(!n) throw {message:'Dê um nome ao relatório.'};
    await portalMudar(l=>{ const r=l.find(x=>x.id===m.id&&x.origem===origem); if(!r) return false; r.nome=n; r.nomeAuto=false; }); return true; },
  'portal.apagar': async(m,sender)=>{ const {origem}=await portalDaOrigem(sender);
    await portalMudar(l=>{ const i=l.findIndex(x=>x.id===m.id&&x.origem===origem); if(i<0) return false; l.splice(i,1); }); return true; },
  'portal.puxar': async(m,sender)=>{ const {origem,rec}=await portalDaOrigem(sender,m.id); if(!rec) throw {message:'Relatório não encontrado.'};
    return portalPuxar(origem,[rec.id],sender.tab.id); },
  'portal.puxarTodos': async(m,sender)=>{ const {origem,lista}=await portalDaOrigem(sender);
    const ids=lista.filter(r=>r.origem===origem).map(r=>r.id); if(!ids.length) throw {message:'Nenhum relatório memorizado neste portal.'};
    return portalPuxar(origem,ids,sender.tab.id); },
  'portal.fechar': async(m,sender)=>{ await portalPainelMarcar(sender.tab.id,null); return true; },
  'portal.min': async(m,sender)=>{ const p=await portalPaineis(), x=p[sender.tab.id]; if(x){ x.min=!!m.min; await chrome.storage.session.set({portal_painel:p}); } return true; },
};

// ---------- ouvintes (no topo: o SW acorda por eles) ----------
try{ chrome.webRequest.onBeforeRequest.addListener(portalOnRequest,
  {urls:['http://*/*','https://*/*'],types:['main_frame','sub_frame','xmlhttprequest','other']},['requestBody']); }catch(_){}
try{ chrome.webRequest.onHeadersReceived.addListener(portalOnHeaders,
  {urls:['http://*/*','https://*/*'],types:['main_frame','sub_frame','xmlhttprequest','other']},['responseHeaders']); }catch(_){}
try{ chrome.downloads.onCreated.addListener(item=>{ portalOnDownload(item).catch(()=>{}); }); }catch(_){}
try{ chrome.downloads.onChanged.addListener(d=>{ if(d&&d.filename) portalFila(()=>portalOnDownloadNome(d)); }); }catch(_){}
