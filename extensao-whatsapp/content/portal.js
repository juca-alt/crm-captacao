// ===== 2.10.0 · PAINEL "📥 Relatórios do portal" =====
// Injetado (chrome.scripting) só na aba onde ele clicou no ícone da extensão, e só depois de o Chrome dar permissão pra
// aquele site. Só UI: lista as receitas DESTE site, liga/desliga a gravação, manda puxar. Toda a lógica e a rede ficam no
// service worker (portal-sw.js). Shadow DOM: o CSS do portal não mexe no painel e o painel não mexe no portal.
(()=>{
const vivo=()=>{ try{ return !!(chrome.runtime&&chrome.runtime.id); }catch(_){ return false; } };
if(window.__crmPortal&&window.__crmPortal.vivo()){ window.__crmPortal.alternar(); return; }
document.querySelectorAll('#crm-portal-host').forEach(e=>e.remove());   // painel órfão (extensão recarregada)

const CTX='A extensão foi atualizada. Recarregue esta página (F5) e clique no ícone de novo.';
function send(type,payload){
  return new Promise(res=>{
    if(!vivo()){ res({ok:false,error:CTX}); return; }
    try{ chrome.runtime.sendMessage(Object.assign({type},payload||{}),r=>{
      if(chrome.runtime.lastError) res({ok:false,error:/context invalidated|receiving end/i.test(chrome.runtime.lastError.message||'')?CTX:chrome.runtime.lastError.message});
      else res(r||{ok:false,error:'sem resposta da extensão'}); }); }
    catch(e){ res({ok:false,error:CTX}); }
  });
}
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quando=iso=>{ try{ const d=new Date(iso), h=new Date(); const p=n=>String(n).padStart(2,'0');
  const dia=d.toDateString()===h.toDateString()?'hoje':`${p(d.getDate())}/${p(d.getMonth()+1)}`; return `${dia} ${p(d.getHours())}:${p(d.getMinutes())}`; }catch(_){ return ''; } };
const mmss=ms=>{ const s=Math.max(0,Math.round(ms/1000)); return Math.floor(s/60)+':'+String(s%60).padStart(2,'0'); };

let E=null, ABERTO=true, MIN=false, AVISO='', AVISO_ERRO=false, root=null, host=null, _tick=null, _rel=null;

async function montar(){
  const r=await send('portal.estado');
  if(!r.ok){ console.warn('[CRM · relatórios]',r.error); return; }
  E=r.data; MIN=!!E.min;
  host=document.createElement('div'); host.id='crm-portal-host';
  document.documentElement.appendChild(host);
  root=host.attachShadow({mode:E.teste?'open':'closed'});     // aberto só no teste local (Playwright precisa clicar)
  const st=document.createElement('style'); const css=await send('portal.css'); st.textContent=css.ok?css.data:''; root.appendChild(st);
  const box=document.createElement('div'); box.className='wrap'; root.appendChild(box);
  box.addEventListener('click',clique); box.addEventListener('change',mudou); box.addEventListener('keydown',tecla);
  box.addEventListener('focusout',()=>{ if(_pendente) setTimeout(desenhar,0); });
  desenhar();
  _tick=setInterval(()=>{ if(E&&E.gravando){ const t=root.querySelector('.rec-t'); const falta=E.gravando.ate-Date.now();
    if(falta<=0) recarregar(); else if(t) t.textContent=mmss(falta); } },1000);
}

function itemHTML(x){
  const rod=E.rodando, aqui=rod&&rod.id===x.id, fila=rod&&(rod.fila||[]).includes(x.id);
  let meta;
  if(aqui) meta=`<span class="st run">⏳ ${rod.fase==='entregando'?'Entregando ao CRM…':'Buscando no portal…'}</span>`;
  else if(fila) meta='<span class="st run">Na fila…</span>';
  else if(x.ultimo) meta=`<span class="st ${x.ultimo.ok?'ok':'erro'}">${x.ultimo.ok?'✓':'✕'} ${esc(quando(x.ultimo.em))} · ${esc(x.ultimo.msg||(x.ultimo.ok?'Entregue ao CRM.':'Não deu certo.'))}</span>`;
  else meta=`<span class="st">Gravado ${esc(quando(x.gravadoEm))} · ainda não puxado</span>`;
  const datas=x.nDatas?`<span class="dt" title="As datas do filtro andam junto com o dia de hoje">📅 datas atualizam sozinhas</span>`:'';
  return `<li class="rc" data-id="${esc(x.id)}">
    <input class="nome" value="${esc(x.nome)}" maxlength="80" aria-label="Nome do relatório" title="Clique pra mudar o nome">
    <div class="meta">${meta}${datas}</div>
    <div class="acoes"><button class="b puxar" data-a="puxar" ${rod?'disabled':''}>↻ Puxar</button>
      <button class="b lixo" data-a="apagar" title="Apagar este relatório memorizado" ${aqui?'disabled':''}>🗑</button></div></li>`;
}
let _pendente=false;
function desenhar(){
  if(!root||!E) return;
  const box=root.querySelector('.wrap');
  const foco=root.activeElement;
  if(foco&&foco.classList&&foco.classList.contains('nome')&&ABERTO&&!MIN){ _pendente=true; return; }   // não apaga o que ele está digitando
  _pendente=false;
  host.style.display=ABERTO?'':'none';
  if(MIN){ box.innerHTML=`<button class="pilula" data-a="restaurar" title="Abrir o painel de relatórios">📥 Relatórios${E.gravando?' <span class="pt"></span>':''}</button>`; return; }
  const g=E.gravando, lista=E.receitas||[], rod=E.rodando;
  const grav=g
    ?`<div class="rec on"><div class="rec-l"><span class="pt"></span><b>Gravando</b> · <span class="rec-t">${mmss(g.ate-Date.now())}</span>
        <button class="b parar" data-a="parar">■ Parar</button></div>
        <p>Baixe cada relatório normalmente — eu memorizo como foi.</p>
        <p class="sub">${g.n?`${g.n} memorizado${g.n>1?'s':''} nesta gravação.`:'Nenhum memorizado ainda.'} Para sozinha em 15 minutos.</p></div>`
    :`<div class="rec"><button class="b gravar" data-a="gravar">● Gravar</button>
        <p class="sub">Clique em Gravar e baixe cada relatório uma vez, do jeito de sempre. Depois é só <b>Puxar</b>.</p></div>`;
  const itens=lista.length?`<ul class="lista">${lista.map(itemHTML).join('')}</ul>`
    :`<p class="vazio">Nenhum relatório memorizado neste site ainda.</p>`;
  box.innerHTML=`<section class="painel" role="dialog" aria-label="Relatórios do portal">
    <header><div class="tt"><b>📥 Relatórios do portal</b><span class="org">${esc(E.origem)}</span></div>
      <button class="ic" data-a="min" title="Encolher">–</button><button class="ic" data-a="fechar" title="Fechar">✕</button></header>
    ${grav}
    <div class="corpo">${itens}</div>
    <footer>${lista.length?`<button class="b todos" data-a="todos" ${rod?'disabled':''}>⇣ Puxar todos (${lista.length})</button>`:''}
      <div class="aviso ${AVISO_ERRO?'erro':''}" role="status">${esc(AVISO)}</div>
      <div class="rod">Os arquivos vão para a Central de Importações do CRM · ${esc(E.versao||'')}</div></footer></section>`;
}

async function recarregar(){
  clearTimeout(_rel);
  _rel=setTimeout(async()=>{ const r=await send('portal.estado');
    if(!r.ok){ aviso(r.error,true); return; }
    E=r.data;
    if(!E.rodando&&/^Puxando/.test(AVISO)){ AVISO='Terminei — o resultado de cada um está na lista acima.'; AVISO_ERRO=false; }   // acabou a rodada
    desenhar(); },60);
}
function aviso(t,erro){ AVISO=t||''; AVISO_ERRO=!!erro; const a=root&&root.querySelector('.aviso'); if(a){ a.textContent=AVISO; a.classList.toggle('erro',AVISO_ERRO); } }
async function acao(type,payload,okMsg){
  const r=await send(type,payload);
  if(!r.ok){ aviso(r.error||'Não deu certo.',true); return null; }
  if(okMsg!=null) aviso(okMsg,false);
  await recarregar(); return r.data;
}
async function clique(ev){
  const b=ev.target.closest('[data-a]'); if(!b||b.disabled) return;
  const a=b.dataset.a, li=b.closest('.rc'), id=li&&li.dataset.id;
  if(a==='gravar') return acao('portal.gravar',{on:true},'Gravando. Baixe os relatórios do jeito de sempre.');
  if(a==='parar') return acao('portal.gravar',{on:false},'Gravação parada.');
  if(a==='puxar') return acao('portal.puxar',{id},'Puxando…');
  if(a==='todos') return acao('portal.puxarTodos',{},'Puxando um de cada vez…');
  if(a==='apagar'){ const n=li.querySelector('.nome').value;
    if(!confirm(`Apagar o relatório "${n}"?\nPra ter ele de volta é só gravar de novo.`)) return;
    return acao('portal.apagar',{id},'Apagado.'); }
  if(a==='min'){ MIN=true; desenhar(); send('portal.min',{min:true}); return; }
  if(a==='restaurar'){ MIN=false; desenhar(); send('portal.min',{min:false}); recarregar(); return; }
  if(a==='fechar'){ fechar(); }
}
function mudou(ev){ const i=ev.target; if(!i.classList.contains('nome')) return;
  const id=i.closest('.rc').dataset.id; acao('portal.renomear',{id,nome:i.value},'Nome salvo.'); }
function tecla(ev){ if(ev.key==='Enter'&&ev.target.classList.contains('nome')) ev.target.blur(); }
function fechar(){ ABERTO=false; desenhar(); send('portal.fechar'); }

window.__crmPortal={vivo,alternar:()=>{
  if(!ABERTO||MIN){ ABERTO=true; MIN=false; desenhar(); send('portal.min',{min:false}); recarregar(); }
  else fechar();
}};
try{ chrome.runtime.onMessage.addListener(m=>{ if(m&&m.type==='portal.mudou'){ if(m.aviso) aviso(m.aviso,/^🔒|não achei|terminou/.test(m.aviso)); recarregar(); } }); }catch(_){}
try{ chrome.storage.onChanged.addListener((ch,area)=>{ if(area==='local'&&ch.portal_receitas&&ABERTO) recarregar(); }); }catch(_){}
montar();
})();
