// ===== PAINEL — card do lead ao lado da conversa aberta =====
// UI em Shadow DOM (isolada do CSS/React do WhatsApp). Toda rede via SW
// (chrome.runtime.sendMessage). Estados: deslogado → sem-chat → buscando →
// match / sem-match(criar) / multiplos(escolher) / grupo. Busca manual sempre
// disponível (fallback quando o DOM do WhatsApp mudar).

(async()=>{
if(window.__waCrmPanelLoaded) return; window.__waCrmPanelLoaded=true;

// ---------- bridge com o service worker ----------
// Contexto morto (extensão recarregada com a aba aberta) vira code:'ctx' com
// mensagem acionável — nunca mais "Extension context invalidated" cru na cara.
const CTX_MSG='A extensão foi atualizada. Recarregue esta página do WhatsApp pra reconectar.';
function ctxMorto(m){ return /context invalidated|receiving end does not exist|message port closed/i.test(m||''); }
function ctxErr(m){ return ctxMorto(m)?{ok:false,code:'ctx',error:CTX_MSG}:{ok:false,error:m}; }
function send(type,payload){
  return new Promise(res=>{
    let vivo=true; try{ vivo=!!(chrome.runtime&&chrome.runtime.id); }catch(_){ vivo=false; }
    if(!vivo){ res({ok:false,code:'ctx',error:CTX_MSG}); return; }
    try{
      chrome.runtime.sendMessage(Object.assign({type},payload||{}),r=>{
        if(chrome.runtime.lastError) res(ctxErr(chrome.runtime.lastError.message));
        else res(r||{ok:false,error:'sem resposta do service worker'});
      });
    }catch(e){ res(ctxErr(String(e))); }
  });
}

// ---------- shadow DOM ----------
// Reinjeção pós-reload da extensão (sw.js onInstalled): a UI da injeção anterior
// ficou órfã no DOM — remove antes de criar a nova (senão empilha 2 botões CRM).
document.querySelectorAll('#wa-crm-host').forEach(e=>e.remove());
const host=document.createElement('div');
host.id='wa-crm-host';
document.documentElement.appendChild(host);
const root=host.attachShadow({mode:'closed'});
try{
  const css=await (await fetch(chrome.runtime.getURL('content/panel.css'))).text();
  const st=document.createElement('style'); st.textContent=css; root.appendChild(st);
}catch(_){ /* sem css o painel ainda funciona */ }

const fab=document.createElement('button');
fab.className='fab'; fab.title='Card do lead — CRM Captação';
fab.innerHTML='CRM<span class="dot off" id="fab-dot"></span>';
root.appendChild(fab);

const panel=document.createElement('div');
panel.className='panel hidden';
root.appendChild(panel);

// aba na borda do painel: encolhe com 1 clique; o botão CRM (fab) volta pra expandir
const handle=document.createElement('button');
handle.className='handle hidden';
handle.title='Recolher painel';
handle.textContent='❯';
root.appendChild(handle);

function setOpen(open){
  OPEN=open;
  panel.classList.toggle('hidden',!open);
  handle.classList.toggle('hidden',!open);
  fab.classList.toggle('hidden',open); // aberto = fab some (a aba assume); recolhido = fab volta
}

const $=(sel)=>panel.querySelector(sel);

// ---------- estado ----------
let AUTH={logged:false,email:'',usuario:''};
let FUNIL=buildFunnel(null);        // fallback; substituído pelo funil_cfg do banco
let CHAT=null;                      // conversa aberta (wa-dom)
let LEAD=null;                      // lead em exibição
let OPEN=false;
let BUSY=false;
let LPCFG={funil:null,listas:[]};   // v2.0: Funil & Etapas + listas de TA do app (lpcfg.get)
let VIEW='lp';                      // 2.1: Captação saiu (palavra dele: "não faço mais nada de Captação")
/* 2.8.0: os modos "🗂 Card completo" × "⚡ Rápido" saíram — um painel só, com as abas 👤 Perfil e 💼 Negócios */
let DOB={};                         // blocos dobráveis: aberto/fechado lembrado (nascem FECHADOS)
// 2.2 — card rápido com SALVAR explícito (palavra dele: mudou etapa/status/lista, saiu da conversa, voltou e não
// tinha salvo). Cada mudança vira RASCUNHO por contato (id → {etapa,status,listas,nota,tel,notas,nome}); só o botão
// 💾 Salvar grava, com "Salvando…" → "✓ Salvo às HH:MM" conferido contra o que o banco devolveu, ou erro que FICA
// na tela. Trocar de conversa com rascunho não perde nada: ele fica guardado e um aviso mostra onde salvar.
let DRAFTS={};                      // rascunhos por id de contato (sobrevivem à troca de conversa)
let SAVE_ST={};                     // id → {st:'salvando'|'ok'|'erro', msg, at}
let CUR=null;                       // id do contato na tela agora (null = outra tela)
let CUR_ROW=null, CUR_CART=null;    // linha exibida (base do rascunho) e o hit da Carteira
let LOOKSEQ=0;                      // cada troca de conversa vira uma "geração": resposta velha não pinta por cima
function saveView(){ try{ chrome.storage.local.set({wa_crm_view:VIEW}); }catch(_){} }

function toast(msg){
  const t=$('#wa-toast'); if(!t) return;
  t.textContent=msg; t.classList.add('on');
  clearTimeout(toast._tm); toast._tm=setTimeout(()=>t.classList.remove('on'),2600);
}

// ---------- blocos de UI ----------
/* 2.8.0 PERFIL-NEGOCIOS: cabeçalho escuro com a PESSOA (nome, idade, telefone mascarado, LP dona, chips de Cliente e
   alertas). "↗ CRM" abre o app inteiro numa aba nova — o card completo embutido (iframe, até 25 s) saiu. */
const CRM_APP_URL='https://juca-alt.github.io/crm-captacao/vendas.html';
function headerHTML(p){ p=p||{};
  return `<div class="ph"><div class="ph-l1"><span class="ph-t">VISÃO LP · CRM</span><span class="sub">${esc(EXT_VERSION)}</span><span class="sp"></span>
      ${AUTH.logged?`<button class="ph-b" id="wa-busca-tg" title="Buscar outra pessoa no CRM">🔍</button>`:''}
      <a class="ph-b" id="wa-crm" href="${CRM_APP_URL}" target="_blank" rel="noopener" title="Abrir o CRM completo numa aba nova">↗ CRM</a>
      ${AUTH.logged?`<button class="ph-b" id="wa-logout" title="Sair da conta do CRM">sair</button>`:''}
      <button class="x" id="wa-close" title="Fechar">×</button></div>
    ${p.nome?`<div class="ph-nome">${esc(p.nome)}</div>`:''}
    ${p.sub?`<div class="ph-sub">${p.sub}</div>`:''}
    ${p.chips&&p.chips.length?`<div class="ph-chips">${p.chips.join('')}</div>`:''}
    ${p.extra||''}</div>`;
}
function searchHTML(){
  return `<div class="search"><input id="wa-q" placeholder="Buscar no CRM por nome…" enterkeyhint="search">
    <button class="btn" id="wa-q-go" style="width:auto" title="Buscar">🔍</button><button class="btn" id="wa-novo" style="width:auto" title="Criar contato novo no CRM (outra pessoa)">＋ Novo</button></div>`;
}
/* ---- 2.8.0: utilidades do cabeçalho / Perfil (puras, sem rede) ---- */
let ABA='perfil';                   // aba do card: 'perfil' | 'neg' (lembrada neste Chrome)
let MSG_ON=false, BUSCA_ON=false;   // caixa de mensagem pronta / busca aberta no card
const PERF={};                      // ref da Carteira → perfil (família) já lido; null = não tem
function soDig(s){ return String(s||'').replace(/\D/g,''); }
function telMascara(t){ const d=soDig(t); return d.length>=4?'••••-'+d.slice(-4):''; }   /* só os 4 últimos dígitos */
function isoDe(s){ s=String(s||'').trim(); let m=/^(\d{4})-(\d{2})-(\d{2})/.exec(s); if(m) return m[1]+'-'+m[2]+'-'+m[3];
  m=/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s); return m?m[3]+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0'):''; }
function dataBR(iso){ const i=isoDe(iso); return i?i.split('-').reverse().join('/'):''; }
function idadeDe(nasc){ const i=isoDe(nasc); if(!i) return null; const [y,m,d]=i.split('-').map(Number), h=new Date();
  let a=h.getFullYear()-y; if(h.getMonth()+1<m||(h.getMonth()+1===m&&h.getDate()<d)) a--; return a>=0&&a<130?a:null; }
function niverEm(nasc){ const i=isoDe(nasc); if(!i) return null; const [,m,d]=i.split('-').map(Number); const h=new Date(); h.setHours(0,0,0,0);
  let n=new Date(h.getFullYear(),m-1,d); if(n<h) n=new Date(h.getFullYear()+1,m-1,d); return Math.round((n-h)/864e5); }
function diasEntre(isoA,isoB){ const a=isoDe(isoA), b=isoDe(isoB); if(!a||!b) return null; return Math.round((new Date(b+'T12:00')-new Date(a+'T12:00'))/864e5); }
function diaCurto(iso){ const n=diasEntre(lpcHojeISO(),iso); if(n==null) return ''; return n===0?'hoje':n===1?'amanhã':n===-1?'ontem':dataBR(iso).slice(0,5); }
function brl(n){ n=Number(n)||0; return 'R$ '+n.toLocaleString('pt-BR',{maximumFractionDigits:n%1?2:0,minimumFractionDigits:n%1?2:0}); }
function brlCurto(n){ n=Number(n)||0; if(n>=1e6) return 'R$ '+(n/1e6).toLocaleString('pt-BR',{maximumFractionDigits:1})+' mi'; if(n>=1e3) return 'R$ '+Math.round(n/1e3)+' mil'; return brl(n); }
function cap1(s){ s=String(s||''); return s.charAt(0).toUpperCase()+s.slice(1); }
function porCurto(p){ return String(p||'').split('@')[0]; }   /* e-mail do operador nunca aparece inteiro */
function valido(v){ return v!=null&&v!==''&&v!=='—'; }
function chatPessoa(){ const r=recDoNome(CHAT&&CHAT.name); return (r&&r.nome)||(CHAT&&CHAT.name)||''; }
function hdrChat(extra){ const m=telMascara(CHAT&&CHAT.phoneRaw);
  return {nome:chatPessoa()||'', sub:[m?'📱 '+m:'', CHAT&&CHAT.name?'nome do WhatsApp':''].filter(Boolean).join(' · '), extra:extra||''}; }
/* tarefas do negócio (formato do vendas.html: {id,tipo,tit,quando:'AAAA-MM-DD',hora,feito:ISO|null}) — mesma régua do proxTarefa do app */
const TAR_TIPO={ligar:['📞','Ligar'],whats:['💬','WhatsApp'],reuniao:['🤝','Reunião'],proposta:['📄','Enviar proposta'],follow:['🔁','Follow-up'],outro:['✳️','Outro']};
function proxTarefa(c){ const l=(Array.isArray(c&&c.tarefas)?c.tarefas:[]).filter(t=>t&&!t.feito);
  const k=t=>(t.quando||'9999-12-31')+' '+(t.hora||'99:99'); return l.sort((a,b)=>k(a).localeCompare(k(b)))[0]||null; }
function apAlerta(a){ return !/ativ|vigen|em dia|normal|adimpl/i.test(String(a&&a.status||'Ativa')); }
/* alertas baratos (tudo do que já veio na consulta): atividade atrasada, aniversário perto, apólice fora de "Ativa" */
function alertasDe(c,cart){ const chips=[], linhas=[]; const hoje=lpcHojeISO();
  const t=proxTarefa(c); if(t&&t.quando&&t.quando<hoje){ const d=-diasEntre(hoje,t.quando); chips.push(`<span class="hc al">⏰ atividade atrasada ${d}d</span>`);
    linhas.push(['v',`⏰ ${(TAR_TIPO[t.tipo]||TAR_TIPO.outro)[0]} ${esc(t.tit||(TAR_TIPO[t.tipo]||TAR_TIPO.outro)[1])} — atrasada desde ${esc(dataBR(t.quando))}`]); }
  const nasc=(c&&c.nascimento)||(cart&&cart.nascimento); const n=niverEm(nasc);
  if(n!=null&&n<=30){ chips.push(`<span class="hc at">🎂 ${n===0?'hoje':'em '+n+'d'}</span>`); if(n<=7) linhas.push(['a',`🎂 Aniversário ${n===0?'é hoje':n===1?'amanhã':'em '+n+' dias'} (${esc(dataBR(nasc).slice(0,5))})`]); }
  ((cart&&cart.aps)||[]).filter(apAlerta).forEach(a=>{ chips.push(`<span class="hc al">⚠ ${esc(a.status)}</span>`); linhas.push(['v',`⚠ Apólice ${esc(a.num)}: ${esc(a.status)}`]); });
  return {chips,linhas}; }
function badgeHTML(l){
  const c=FUNIL.ETAPA_COLOR[FUNIL.STATUS_ETAPA[l.status]]||'#64748b';
  return `<span class="badge" style="background:${c}"><span class="dot"></span>${esc(l.status||'—')}</span>`;
}
// seletor dependente Etapa × Status — espelho de etapaStatusHTML/wireEtapaStatus (L987-995)
function etapaStatusHTML(idp,status){
  const et=FUNIL.STATUS_ETAPA[status]||FUNIL.ETAPAS[0];
  return `<div class="es-pair"><select id="${idp}-et">${FUNIL.ETAPAS.map(e=>`<option value="${esc(e)}" ${e===et?'selected':''}>${esc(FUNIL.ETAPA_LABEL[e])}</option>`).join('')}</select>`+
    `<select id="${idp}-st">${(FUNIL.STATUS_BY_ETAPA[et]||[]).map(s=>`<option ${s===status?'selected':''}>${esc(s)}</option>`).join('')}</select></div>`;
}
function wireEtapaStatus(idp){
  const et=$('#'+idp+'-et'), st=$('#'+idp+'-st'); if(!et||!st) return;
  et.onchange=()=>{ st.innerHTML=(FUNIL.STATUS_BY_ETAPA[et.value]||[]).map(s=>`<option>${esc(s)}</option>`).join(''); };
}
// comVazio: card de lead existente ganha a opção "— sem origem —" selecionada quando o
// lead não tem origem — sem isso o select caía em "WhatsApp" e gravava origem sem pedir
function origemSelectHTML(id,val,comVazio){
  const vazio=comVazio?`<option value="" ${!val?'selected':''}>— sem origem —</option>`:'';
  // origem legada fora da lista do app (Evento/Outro/Mercado X…): entra como opção
  // extra selecionada — o card mostra a verdade e não sobrescreve sem querer
  const extra=(val&&!ORIGEM_OPTS.includes(val))?`<option selected>${esc(val)}</option>`:'';
  return `<select id="${id}">${vazio}${extra}${ORIGEM_OPTS.map(o=>`<option ${o===(val||(comVazio?'':'WhatsApp'))?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
}
function fieldHTML(id,label,val,ph){
  return `<div class="field"><label>${esc(label)}</label><input id="${id}" value="${esc(val||'')}" placeholder="${esc(ph||'')}"></div>`;
}

// ---------- modelos de mensagem (mesmos do CRM; gerenciáveis; escreve no campo) ----------
// Espelha a extensão do LinkedIn: modelos editáveis + preenchimento com dados do
// lead. Fonte única = app_settings.msg_templates (sincroniza com o CRM). "Escrever
// no campo" insere no compositor do WhatsApp; ENVIAR é sempre manual (anti-ban).
let MSGS=MSG_TPL_DEFAULT.slice();
let _meEdit=null; // índice em edição no editor (null = novo)
async function loadMsgs(){ const r=await send('msg.templates'); if(r&&r.ok&&Array.isArray(r.data)&&r.data.length) MSGS=r.data; }
async function persistMsgs(){ const r=await send('msg.save',{templates:MSGS}); return !!(r&&r.ok); }

function msgCardHTML(){
  return `<div class="card">
    <div style="display:flex;align-items:center;gap:8px"><b style="font-size:12px;color:var(--muted);flex:1">MENSAGENS PRONTAS</b>
      <button class="btn ghost" id="wa-msg-mng" style="font-size:11px">⚙︎ gerenciar</button></div>
    <div class="field" style="margin-top:6px"><select id="wa-msg-sel">${MSGS.map((t,i)=>`<option value="${i}">${esc(t.nome)}</option>`).join('')||'<option>— nenhum modelo —</option>'}</select></div>
    <div style="display:flex;gap:6px">
      <button class="btn primary" id="wa-msg-fill" style="flex:1">✍️ Escrever no campo</button>
      <button class="btn" id="wa-msg-copy" style="width:auto" title="Copiar">📋</button>
    </div>
    <div id="wa-msg-editor"></div>
    <p class="muted" style="margin-top:6px;font-size:11px">Preenche com os dados do lead. Você revisa e envia (Enter).</p></div>`;
}
function msgEditorHTML(){
  return `<div style="margin-top:8px;border-top:1px dashed var(--line);padding-top:8px">
    <div id="wa-msg-list">${MSGS.map((t,i)=>`<div style="display:flex;gap:6px;align-items:center;margin-bottom:4px">
      <span style="flex:1;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.nome)}</span>
      <button class="btn ghost" data-medit="${i}" style="padding:2px 6px;font-size:11px">editar</button>
      <button class="btn ghost" data-mdel="${i}" style="padding:2px 6px;font-size:11px;color:var(--red)">apagar</button></div>`).join('')||'<span class="muted" style="font-size:12px">nenhum modelo ainda</span>'}</div>
    <div class="field" style="margin-top:8px"><label>Nome do modelo</label><input id="wa-me-nome" placeholder="ex.: Primeiro contato"></div>
    <div class="field"><label>Texto <span class="muted">— use {{primeiro_nome}} {{nome}} {{recomendante}}</span></label><textarea id="wa-me-texto" placeholder="Olá {{primeiro_nome}}, tudo bem?"></textarea></div>
    <div style="display:flex;gap:6px">
      <button class="btn primary" id="wa-me-save" style="flex:1">${_meEdit==null?'＋ Adicionar modelo':'💾 Salvar edição'}</button>
      <button class="btn" id="wa-me-cancel" style="width:auto">limpar</button></div>`;
}
function selectedMsg(){ const s=$('#wa-msg-sel'); const i=s?+s.value:0; return MSGS[i]; }
function wireMsgCard(l){
  const fill=$('#wa-msg-fill'); if(!fill) return;
  fill.onclick=()=>{
    const t=selectedMsg(); if(!t){ toast('Nenhum modelo.'); return; }
    const ok=WA_DOM.fillComposer(fillTpl(t.texto,l));
    toast(ok?'✓ Escrito no campo — revise e envie (Enter)':'Abra uma conversa pra escrever no campo.');
  };
  $('#wa-msg-copy').onclick=async()=>{
    const t=selectedMsg(); if(!t) return;
    try{ await navigator.clipboard.writeText(fillTpl(t.texto,l)); toast('✓ Copiada — '+(firstName(l.nome)||'')); }
    catch(_){ toast('Não consegui copiar.'); }
  };
  $('#wa-msg-mng').onclick=()=>{
    const box=$('#wa-msg-editor');
    if(box.innerHTML){ box.innerHTML=''; return; }
    _meEdit=null; box.innerHTML=msgEditorHTML(); wireMsgEditor(l);
  };
}
function refreshMsgSelect(){
  const s=$('#wa-msg-sel'); if(s) s.innerHTML=MSGS.map((t,i)=>`<option value="${i}">${esc(t.nome)}</option>`).join('')||'<option>— nenhum modelo —</option>';
}
function wireMsgEditor(l){
  panel.querySelectorAll('[data-medit]').forEach(b=>b.onclick=()=>{
    _meEdit=+b.dataset.medit; const t=MSGS[_meEdit];
    $('#wa-msg-editor').innerHTML=msgEditorHTML(); wireMsgEditor(l);
    $('#wa-me-nome').value=t.nome||''; $('#wa-me-texto').value=t.texto||'';
  });
  panel.querySelectorAll('[data-mdel]').forEach(b=>b.onclick=async()=>{
    const i=+b.dataset.mdel;
    if(!confirm('Apagar o modelo "'+(MSGS[i].nome||'')+'"?')) return;
    MSGS.splice(i,1); _meEdit=null;
    const ok=await persistMsgs(); refreshMsgSelect();
    $('#wa-msg-editor').innerHTML=msgEditorHTML(); wireMsgEditor(l);
    toast(ok?'✓ Modelo apagado':'Apagado localmente (não salvou no CRM)');
  });
  const cancel=$('#wa-me-cancel'); if(cancel) cancel.onclick=()=>{ _meEdit=null; $('#wa-me-nome').value=''; $('#wa-me-texto').value=''; $('#wa-msg-editor').innerHTML=msgEditorHTML(); wireMsgEditor(l); };
  const save=$('#wa-me-save'); if(save) save.onclick=async()=>{
    const nome=$('#wa-me-nome').value.trim(), texto=$('#wa-me-texto').value.trim();
    if(!nome||!texto){ toast('Preencha nome e texto.'); return; }
    if(_meEdit==null) MSGS.push({nome,texto}); else MSGS[_meEdit]={nome,texto};
    _meEdit=null;
    save.disabled=true;
    const ok=await persistMsgs();
    refreshMsgSelect();
    $('#wa-msg-editor').innerHTML=msgEditorHTML(); wireMsgEditor(l);
    toast(ok?'✓ Modelo salvo no CRM':'Salvo localmente (CRM indisponível)');
  };
}

// ---------- estados ----------
function renderLogin(note){
  panel.innerHTML=headerHTML()+`<div class="pb">
    ${note?`<div class="warn">${esc(note)}</div>`:''}
    <div class="card">
      <h2 style="margin-bottom:8px">Entrar no CRM</h2>
      <p class="muted" style="margin-bottom:10px">Mesma conta do CRM Captação (é a mesma senha que você usa pra conectar a extensão).</p>
      ${fieldHTML('wa-email','E-mail','','voce@exemplo.com')}
      <div class="field"><label>Senha</label><input id="wa-pass" type="password"></div>
      <button class="btn primary" id="wa-login">Entrar</button>
      <div class="err" id="wa-login-err" style="display:none;margin-top:8px"></div>
    </div>
    <div class="toast" id="wa-toast"></div></div>`;
  wireHeader();
  $('#wa-login').onclick=async()=>{
    const email=$('#wa-email').value.trim(), pass=$('#wa-pass').value;
    if(!email||!pass) return;
    $('#wa-login').disabled=true;
    const r=await send('auth.login',{email,password:pass});
    $('#wa-login').disabled=false;
    if(r.code==='ctx'){ renderCtxLost(); return; }
    if(!r.ok){ const e=$('#wa-login-err'); e.textContent=r.error||'Falha no login'; e.style.display='block'; return; }
    AUTH={logged:true,email:r.data.email,usuario:r.data.usuario};
    await loadFunil(); loadMsgs();
    refreshFab();
    lookup();
  };
  $('#wa-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#wa-login').click(); });
}

// extensão recarregada com a aba aberta: 1 botão resolve (recarrega a página)
function renderCtxLost(){
  panel.innerHTML=headerHTML()+`<div class="pb">
    <div class="warn">🔌 ${esc(CTX_MSG)}</div>
    <div class="card" style="margin-top:10px">
      <button class="btn primary" id="wa-reload">🔄 Recarregar página agora</button>
      <p class="muted" style="margin-top:8px;font-size:11px">Seu login e a conversa aberta continuam — só reconecta a extensão.</p>
    </div>
    <div class="toast" id="wa-toast"></div></div>`;
  const x=panel.querySelector('#wa-close'); if(x) x.onclick=()=>setOpen(false);
  $('#wa-reload').onclick=()=>location.reload();
}

/* hdr = dados do cabeçalho (headerHTML); opts.busca=false esconde a busca (no card da pessoa ela abre pelo 🔍) */
function renderShell(innerHTML,curId,hdr,opts){
  opts=opts||{};
  CUR=curId!=null?String(curId):null;   /* só o card de um contato "é" o CUR; qualquer outra tela zera */
  const busca=opts.busca!==false||BUSCA_ON;
  panel.innerHTML=headerHTML(hdr||hdrChat())+`<div class="pb"><div id="wa-pend"></div><div id="wa-busca-box">${busca?searchHTML():''}</div>${innerHTML}<div class="toast" id="wa-toast"></div></div>`;
  wireHeader(); wireSearch(); pintaPend();
}

function renderNoChat(){
  renderShell(`<div class="empty"><div class="big">💬</div>Abra uma conversa no WhatsApp<br>para ver quem é a pessoa no CRM.</div>`,null,{});
}
function renderLoading(){
  renderShell(`<div class="empty"><div class="big">⏳</div>Buscando no CRM…</div>`,null,hdrChat(),{busca:false});
}
function renderGroup(){
  renderShell(`<div class="empty"><div class="big">👥</div>Conversa de <b>grupo</b> — o painel é por contato individual.</div>`,null,{nome:(CHAT&&CHAT.name)||'Grupo',sub:'grupo do WhatsApp'});
}

function renderPicker(list,titulo){
  renderShell(`<div class="note">${esc(titulo||'Mais de um lead parecido — escolha:')}</div>`+
    list.map((l,i)=>`<div class="pick" data-i="${i}"><b>${esc(l.nome||'—')}</b> <span class="pi">${esc(l.codigo||'')}</span><br>
      <span class="muted">${esc(l.telefone||'sem telefone')} · ${esc(l.status||'—')}${l.empresa?' · '+esc(l.empresa):''}</span></div>`).join(''));
  panel.querySelectorAll('.pick').forEach(el=>{
    el.onclick=()=>{ LEAD=list[+el.dataset.i]; renderLead(); };
  });
}

function renderLead(sugestoes){
  const l=LEAD;
  const chatPhone=CHAT&&CHAT.phoneRaw?normPhone(CHAT.phoneRaw):null;
  const semTel=!l.telefone_e164&&chatPhone&&chatPhone.e164;
  renderShell(`
    <div class="card">
      <h2>${esc(l.nome||'—')}</h2>
      <div><span class="pi">${esc(l.codigo||'#'+l.id)}</span> <span class="muted">· ${esc(l.cargo||'')}${l.empresa?' · '+esc(l.empresa):''}</span></div>
      ${badgeHTML(l)}
      <div class="muted">${esc(l.telefone||'sem telefone no CRM')}${l.responsavel?' · resp.: '+esc(l.responsavel):''}</div>
      ${semTel?`<button class="btn" id="wa-fill-tel" style="margin-top:8px">📱 Gravar telefone deste chat (${esc(chatPhone.telefone)})</button>`:''}
    </div>
    <div class="card">
      <div class="field"><label>Etapa × Status</label>${etapaStatusHTML('wa-es',l.status)}</div>
      <div class="row2">${fieldHTML('wa-cargo','Cargo',l.cargo)}${fieldHTML('wa-empresa','Empresa',l.empresa)}</div>
      <div class="row2">${fieldHTML('wa-cidade','Cidade',l.cidade)}${fieldHTML('wa-email','E-mail',l.email)}</div>
      <div class="row2">
        <div class="field"><label>Origem</label>${origemSelectHTML('wa-origem',l.origem,true)}</div>
        ${fieldHTML('wa-rec','Recomendante',l.recomendante)}
      </div>
      <div class="field"><label>Observações</label><textarea id="wa-obs">${esc(l.observacoes||'')}</textarea></div>
      <button class="btn primary" id="wa-save">💾 Salvar no CRM</button>
    </div>
    ${msgCardHTML()}
    <div class="card">
      <div class="field"><label>Próxima ação (follow-up)</label><input id="wa-task-date" type="date" value="${esc((l.data_proxima_acao||'').slice(0,10))}"></div>
      <div class="field"><label>Descrição da tarefa</label><input id="wa-task-txt" placeholder="ex.: retornar ligação"></div>
      <button class="btn" id="wa-task-save">📅 Agendar</button>
    </div>
    ${sugestoes&&sugestoes.length?`<div class="note">Outros parecidos: ${sugestoes.map(s=>esc(s.nome+' ('+(s.codigo||'#'+s.id)+')')).join(' · ')}</div>`:''}
  `);
  wireEtapaStatus('wa-es'); wireMsgCard(l);
  if(semTel) $('#wa-fill-tel').onclick=()=>saveLead({telefone:chatPhone.telefone});
  $('#wa-save').onclick=()=>{
    const patch={};
    const stSel=$('#wa-es-st'); const st=stSel?stSel.value:null;
    if(st&&st!==l.status) patch.status=st;
    const map={cargo:'wa-cargo',empresa:'wa-empresa',cidade:'wa-cidade',email:'wa-email',recomendante:'wa-rec',observacoes:'wa-obs'};
    for(const k in map){ const v=$('#'+map[k]).value.trim(); if(v!==String(l[k]??'').trim()) patch[k]=v||null; }
    const org=$('#wa-origem').value; if(org && org!==(l.origem||'')) patch.origem=org; // vazio = manter como está
    if(!Object.keys(patch).length){ toast('Nada mudou.'); return; }
    saveLead(patch);
  };
  $('#wa-task-save').onclick=async()=>{
    const d=$('#wa-task-date').value, tx=$('#wa-task-txt').value.trim();
    if(!d){ toast('Escolha a data do follow-up.'); return; }
    if(BUSY) return; BUSY=true; $('#wa-task-save').disabled=true;
    const r=await send('task.set',{id:l.id,dateISO:d,texto:tx,before:l});
    BUSY=false;
    if(!handleAuthFail(r)) return;
    if(r.ok&&r.data.status==='updated'){ LEAD=r.data.lead; renderLead(); toast('✓ Follow-up agendado'); }
    else { $('#wa-task-save').disabled=false; toast('Erro: '+((r.data&&r.data.message)||r.error||'falha ao agendar')); }
  };
}

async function saveLead(patch){
  if(BUSY) return; BUSY=true;
  const btn=$('#wa-save'); if(btn) btn.disabled=true;
  const r=await send('leads.update',{id:LEAD.id,patch,before:LEAD});
  BUSY=false; if(btn) btn.disabled=false;
  if(!handleAuthFail(r)) return;
  if(r.ok&&r.data.status==='updated'){ LEAD=r.data.lead; renderLead(); toast('✓ Salvo no CRM'); }
  else toast('Erro: '+((r.data&&r.data.message)||r.error||'falha ao salvar'));
}

function renderCreate(sugestoes){
  const chatPhone=CHAT&&CHAT.phoneRaw?normPhone(CHAT.phoneRaw):null;
  const isVictor=(AUTH.usuario||'').includes('victor');
  renderShell(`
    ${sugestoes&&sugestoes.length?`<div class="note"><b>Parecidos no CRM</b> (nome nunca trava — confira antes de criar):</div>`+
      sugestoes.map((l,i)=>`<div class="pick" data-i="${i}"><b>${esc(l.nome||'—')}</b> <span class="pi">${esc(l.codigo||'')}</span><br>
        <span class="muted">${esc(l.telefone||'sem telefone')} · ${esc(l.status||'—')}</span></div>`).join(''):''}
    <div class="card">
      <h2 style="margin-bottom:8px">+ Criar lead</h2>
      ${fieldHTML('wa-n-nome','Nome',CHAT&&CHAT.name||'')}
      ${fieldHTML('wa-n-tel','Telefone',chatPhone?chatPhone.telefone:'')}
      <div class="field"><label>Status inicial</label><select id="wa-n-status">${FUNIL.ALL_STATUS.map(s=>`<option ${s==='Com Telefone'?'selected':''}>${esc(s)}</option>`).join('')}</select></div>
      <div class="row2">
        <div class="field"><label>Origem</label>${origemSelectHTML('wa-n-origem','WhatsApp')}</div>
        <div class="field"><label>Responsável</label><select id="wa-n-resp"><option ${isVictor?'selected':''}>Victor</option><option ${!isVictor?'selected':''}>Gustavo</option></select></div>
      </div>
      <div id="wa-n-rec-wrap" style="display:none">${fieldHTML('wa-n-rec','Recomendante','','quem indicou')}</div>
      <div class="row2">${fieldHTML('wa-n-cargo','Cargo','')}${fieldHTML('wa-n-empresa','Empresa','')}</div>
      <div class="row2">${fieldHTML('wa-n-cidade','Cidade','')}${fieldHTML('wa-n-email','E-mail','')}</div>
      <div class="field"><label>Observações</label><textarea id="wa-n-obs"></textarea></div>
      <button class="btn primary" id="wa-n-save">＋ Criar no CRM</button>
    </div>
  `);
  (panel.querySelectorAll('.pick')||[]).forEach(el=>{
    el.onclick=()=>{ LEAD=sugestoes[+el.dataset.i]; renderLead(); };
  });
  const orgSel=$('#wa-n-origem');
  const recWrap=$('#wa-n-rec-wrap');
  const syncRec=()=>{ recWrap.style.display=REC_ORIGENS.includes(orgSel.value)?'':'none'; };
  orgSel.onchange=syncRec; syncRec();
  $('#wa-n-save').onclick=async()=>{
    const nome=$('#wa-n-nome').value.trim();
    if(!nome){ toast('Nome é obrigatório.'); return; }
    if(BUSY) return; BUSY=true; $('#wa-n-save').disabled=true;
    const rec={
      nome,
      telefone:$('#wa-n-tel').value.trim()||null,
      status:$('#wa-n-status').value,
      origem:orgSel.value,
      responsavel:$('#wa-n-resp').value,
      recomendante:REC_ORIGENS.includes(orgSel.value)?($('#wa-n-rec').value.trim()||null):null,
      cargo:$('#wa-n-cargo').value.trim()||null,
      empresa:$('#wa-n-empresa').value.trim()||null,
      cidade:$('#wa-n-cidade').value.trim()||null,
      email:$('#wa-n-email').value.trim()||null,
      observacoes:$('#wa-n-obs').value.trim()||null
    };
    const r=await send('leads.create',{rec});
    BUSY=false;
    if(!handleAuthFail(r)) return;
    if(r.ok&&r.data.status==='created'){ LEAD=r.data.lead; renderLead(); toast('✓ Lead criado — '+(LEAD.codigo||'')); }
    else if(r.ok&&r.data.status==='duplicate'){
      const ex=r.data.existing;
      if(ex){ LEAD=ex; renderLead(); } else $('#wa-n-save').disabled=false;
      toast('Já existe por '+r.data.key+(ex&&ex.codigo?' — '+ex.codigo:''));
    }
    else { $('#wa-n-save').disabled=false; toast('Erro: '+((r.data&&r.data.message)||r.error||'falha ao criar')); }
  };
}

// ---------- 2.8.0: blocos da aba 👤 Perfil (Carteira + cadastro) ----------
/* Todo bloco nasce FECHADO (regra permanente) e o cabeçalho leva o resumo; aberto só por escolha dele, lembrado
   neste Chrome (DOB, chave 'v28.*' — as escolhas da 2.7 não valem aqui). O atributo open nunca vai fixo no HTML. */
function dobAberto(k){ return DOB[k]===true; }
function blocoHTML(k,titulo,resumo,corpo,cls){
  return `<details class="bl dob${cls?' '+cls:''}" data-k="${esc(k)}" ${dobAberto(k)?'open':''}><summary><span class="car">▶</span><span class="bt">${titulo}</span><span class="br">${resumo||''}</span></summary><div class="bc">${corpo}</div></details>`;
}
function dobBtsHTML(){ return `<div class="dob-bts"><button class="dob-b" data-dobtudo="1" title="Abrir todos os blocos desta aba">⊕ abrir tudo</button><button class="dob-b" data-dobtudo="0" title="Recolher todos os blocos desta aba">⊖ recolher tudo</button></div>`; }
function wireDob(scope){ (scope||panel).querySelectorAll('details.dob').forEach(d=>{ if(d._wDob) return; d._wDob=true;
  d.addEventListener('toggle',()=>{ DOB[d.dataset.k]=d.open; try{ chrome.storage.local.set({wa_crm_dob:DOB}); }catch(_){} }); });
  (scope||panel).querySelectorAll('[data-dobtudo]').forEach(b=>b.onclick=()=>{ const box=b.closest('.aba')||panel, ab=b.dataset.dobtudo==='1';
    box.querySelectorAll('details.dob').forEach(d=>{ d.open=ab; }); }); }
function linhasHTML(arr){ return arr.filter(x=>x&&valido(x[1])).map(([l,v,cls])=>`<div class="lin${cls?' '+cls:''}"><span>${esc(l)}</span><span>${esc(v)}</span></div>`).join(''); }
/* 👤 Quem é — o que existir no cadastro do negócio (ou da Carteira); campo vazio não vira linha */
function quemBlocoHTML(c,cart){ c=c||{}; const cd=(cart&&cart.dados)||{};
  const nasc=c.nascimento||(cart&&cart.nascimento)||'', idade=idadeDe(nasc)!=null?idadeDe(nasc):(valido(c.idade)?c.idade:(cart&&cart.idade));
  const filhos=c.filhos===true||c.filhos==='sim'?'sim':c.filhos===false||c.filhos==='nao'?'não':'';
  const l=[['Nascimento',dataBR(nasc)],['Idade',valido(idade)?idade+' anos':''],['Sexo',c.sexo],['Profissão',c.profissao||cd.profissao],
    ['Empresa',[c.empresa,c.cargo].filter(valido).join(' · ')],['Cidade',c.cidade||cd.cidade],['Renda estimada',Number(c.renda_estimada)>0?brl(c.renda_estimada):''],
    ['Estado civil',c.estado_civil],['Filhos',filhos],['E-mail',c.email||cd.email],['Instagram',c.instagram],['Origem',c.origem],['Recomendante',c.recomendante]];
  const corpo=linhasHTML(l)||'<div class="mut">Nada cadastrado ainda — complete no CRM (↗ CRM).</div>';
  const res=[valido(idade)?idade+' anos':'',valido(c.profissao)?c.profissao:'',c.cidade||''].filter(Boolean).join(' · ')||'sem dados';
  return blocoHTML('v28.p-quem','👤 Quem é',esc(res),corpo); }
/* 👨‍👩‍👧 Família — carteira_perfil do app (cônjuge, filhos, outros); só quando há algo */
function famBlocoHTML(p){ if(!p) return '';
  const filhos=Array.isArray(p.filhos)?p.filhos.filter(f=>f&&f.nome):[], outros=Array.isArray(p.outros)?p.outros.filter(f=>f&&f.nome):[];
  if(!p.conjuge&&!filhos.length&&!outros.length) return '';
  const id=x=>x.idade!=null&&x.idade!==''?', '+x.idade:'';
  const l=[['Cônjuge',p.conjuge?p.conjuge+(p.conjugeIdade!=null&&p.conjugeIdade!==''?', '+p.conjugeIdade:''):'']]
    .concat(filhos.map((f,i)=>[i?'':'Filhos',f.nome+id(f)])).concat(outros.map(o=>[o.parentesco||'Outro',o.nome+id(o)]));
  const corpo=l.filter(x=>valido(x[1])).map(([a,b])=>`<div class="lin"><span>${esc(a)}</span><span>${esc(b)}</span></div>`).join('');
  const res=[p.conjuge?'cônjuge':'',filhos.length?filhos.length+(filhos.length>1?' filhos':' filho'):'',outros.length?outros.length+' outro(s)':''].filter(Boolean).join(' + ');
  return blocoHTML('v28.p-fam','👨‍👩‍👧 Família',esc(res),corpo); }
/* 🛡️ Apólices — número MASCARADO (vem assim do service worker), prêmio, periodicidade, status */
function apolBlocoHTML(cart){ if(!cart) return '';
  const aps=Array.isArray(cart.aps)?cart.aps:[], at=aps.filter(a=>!apAlerta(a)).length, pm=cart.cob&&cart.cob.pm;
  const corpo=aps.length?aps.map(a=>`<div class="ap"><div class="ap-h"><b>${esc(a.num||'—')}</b><span class="st${apAlerta(a)?' al':''}" title="${a.statusPresumido?'a carga da Carteira não traz status — presumido Ativa':''}">${esc(a.status)}${a.statusPresumido?'*':''}</span></div>
      <div class="mut">${[a.produto,a.premio?brl(a.premio):'',a.periodicidade,a.forma].filter(valido).map(esc).join(' · ')||'sem prêmio na carga'}</div></div>`).join('')
    :'<div class="mut">Cliente na Carteira, mas nenhuma apólice ligada a ele.</div>';
  const res=aps.length?`${at} ativa${at===1?'':'s'}${aps.length>at?' · '+(aps.length-at)+' c/ alerta':''}${pm?' · '+brl(pm)+'/mês':''}`:'nenhuma';
  return blocoHTML('v28.p-apol','🛡️ Apólices',esc(res),corpo); }
/* 🧭 Coberturas — resumo da Carteira; sem detalhe por cobertura na carga (cockpit) = só capital e prêmio, dito em voz alta */
const COB_ROT=[['cs','Capital segurado'],['morteAcid','Morte acidental'],['ddr','Doenças graves (DDR)'],['pd','Invalidez (PD)'],['hc','Diária hospitalar (HC)'],['funeral','Assist. funeral'],['renda','Renda'],['pm','Prêmio mensal'],['pa','Prêmio anual']];
function cobBlocoHTML(cart){ const cob=cart&&cart.cob; if(!cob||!(Number(cob.cs)||Number(cob.pm))) return '';
  const det=!!cart.cobDetalhe;
  const l=COB_ROT.filter(([k])=>Number(cob[k])>0).map(([k,r])=>[r,brl(cob[k])]);
  if(det&&!(Number(cob.renda)>0)) l.push(['🔴 Renda','não contratado','al']);
  const corpo=linhasHTML(l)+(det?'':'<div class="mut" style="margin-top:6px">A carga da Carteira não trouxe o detalhe por cobertura — só capital e prêmio.</div>');
  const res=[Number(cob.cs)>0?'CS '+brlCurto(cob.cs).replace('R$ ',''):'',det&&!(Number(cob.renda)>0)?'sem renda':''].filter(Boolean).join(' · ');
  return blocoHTML('v28.p-cob','🧭 Coberturas',esc(res),corpo); }
/* família vem de 1 GET pequeno (carteira_perfil) — lido 1 vez por cliente; o redesenho do card usa o que já veio */
function pintaFamilia(cart){ if(!cart) return; const ref=String((cart.dados&&cart.dados.ref)||cart.ref||''); if(!ref) return;
  const pinta=()=>{ const w=$('#p-fam-wrap'); if(!w) return; w.innerHTML=famBlocoHTML(PERF[ref]); wireDob(w); };
  if(ref in PERF){ pinta(); return; }
  send('cart.perfil',{ref}).then(r=>{ PERF[ref]=(r&&r.ok&&r.data)||null; pinta(); }); }

// ---------- Visão LP · Carteira (cliente sem negócio no funil) ----------
function renderLpCliente(cli){
  const d=cli.dados||{}, nome=d.nome||cli.ref||'—', al=alertasDe({nascimento:cli.nascimento},cli);
  const n=(cli.aps||cli.apolices||[]).length, idade=idadeDe(cli.nascimento)!=null?idadeDe(cli.nascimento):cli.idade;
  const hdr={nome, sub:[valido(idade)?idade+' anos':'', telMascara(d.celular||d.cel||d.telefone||(CHAT&&CHAT.phoneRaw))?'📱 '+telMascara(d.celular||d.cel||d.telefone||(CHAT&&CHAT.phoneRaw)):'', 'Carteira LP'].filter(Boolean).join(' · '),
    chips:[`<span class="hc ok">Cliente · ${n} apólice${n===1?'':'s'}</span>`,...al.chips]};
  renderShell(`<div class="lp2">
    ${al.linhas.map(([k,t])=>`<div class="alerta ${k}">${t}</div>`).join('')}
    <div class="note">Cliente da <b>Carteira</b> sem negócio aberto no funil.</div>
    <div class="aba">${dobBtsHTML()}
      ${quemBlocoHTML({nascimento:cli.nascimento,email:d.email},cli)}<div id="p-fam-wrap"></div>${apolBlocoHTML(cli)}${cobBlocoHTML(cli)}</div>
    <div class="acoes2"><button class="btn primary" id="cli-nn">＋ Novo negócio</button><button class="btn" id="cli-bc">＋ Negócio na Base</button></div>
  </div>`,null,hdr,{busca:false});
  wireDob(); pintaFamilia(cli);
  $('#cli-nn').onclick=()=>{ LOOKSEQ++; renderLpCreate([],null,'nn'); };
  $('#cli-bc').onclick=()=>{ LOOKSEQ++; renderLpCreate([],null,'bc'); };
}
function renderLpPicker(list){
  renderShell(`<div class="note">${list.length} clientes parecidos na Carteira — escolha:</div>`+
    list.map((c,i)=>`<div class="pick" data-i="${i}"><b>${esc((c.dados&&c.dados.nome)||c.ref||'—')}</b><br>
      <span class="muted">${c.apolices&&c.apolices.length?c.apolices.length+' apólice(s)':'sem apólices vinculadas'}</span></div>`).join(''));
  panel.querySelectorAll('.pick').forEach(el=>{ el.onclick=()=>renderLpCliente(list[+el.dataset.i]); });
}
/* 2.8.0: ninguém com esse telefone — busca por nome (sugestões fortes/parecidas do CRM) + criar */
function renderNaoAchou(sugestoes){
  const temTel=!!(CHAT&&soDig(CHAT.phoneRaw).length>=8), q0=chatPessoa();
  renderShell(`<div class="vazio">
      <h3>${temTel?'Ninguém com esse telefone':'Ninguém com essa conversa no CRM'}</h3>
      <div class="mut">Pode ser alguém que já está no CRM com outro número.</div>
      <div class="busca-l"><input id="nf-q" class="busca" placeholder="Buscar por nome…" value="${esc(q0)}" enterkeyhint="search"><button class="btn" id="nf-go" title="Buscar">🔍</button></div>
      <div id="nf-res">${resHTML((sugestoes||[]).map(r=>({tipo:'c',r})))}</div>
      <div class="acoes2"><button class="btn primary" id="nf-nn">＋ Novo negócio</button><button class="btn" id="nf-bc">＋ Negócio na Base</button></div>
    </div>
    <div class="mut" style="padding:4px 2px">"É ele · ligar" liga esta conversa ao negócio dele — da próxima vez abre direto.</div>`,null,hdrChat(),{busca:false});
  let RES=(sugestoes||[]).map(r=>({tipo:'c',r}));
  const wireRes=()=>{ panel.querySelectorAll('[data-nfi]').forEach(b=>b.onclick=()=>{ const x=RES[+b.dataset.nfi]; if(!x) return;
    if(x.tipo==='c'){ renderLpContato(x.r); vincular(x.r); } else renderLpCliente(x.r); }); };
  wireRes();
  const go=async()=>{ const q=$('#nf-q').value.trim(); if(!q) return; const seq=++LOOKSEQ; $('#nf-res').innerHTML='<div class="mut">Buscando…</div>';
    const r=await send('lp.search',{q}); if(seq!==LOOKSEQ) return; if(!handleAuthFail(r)) return;
    const d=(r.ok&&r.data)||{}; RES=[...(d.contatos||[]).map(x=>({tipo:'c',r:x})),...(d.carteira||[]).map(x=>({tipo:'k',r:x}))];
    const box=$('#nf-res'); if(box){ box.innerHTML=RES.length?resHTML(RES):`<div class="mut" style="padding:8px 0">Nada para “${esc(q)}”.</div>`; wireRes(); } };
  $('#nf-go').onclick=go; $('#nf-q').addEventListener('keydown',e=>{ if(e.key==='Enter') go(); });
  $('#nf-nn').onclick=()=>{ LOOKSEQ++; renderLpCreate([],null,'nn'); };
  $('#nf-bc').onclick=()=>{ LOOKSEQ++; renderLpCreate([],null,'bc'); };
}
function resHTML(lista){ return lista.map((x,i)=>{ const c=x.r.dados||{};
  const sub=x.tipo==='c'?[(NEG_PIPE[c.funil||'nn']||['',c.funil])[1],(lpcEtapaDe(LPCFG.funil,c)||{}).label||c.etapa,c.recomendante?'rec. '+c.recomendante:''].filter(Boolean).join(' · ')
    :'Carteira · '+((x.r.aps||x.r.apolices||[]).length)+' apólice(s)';
  return `<div class="res"><span><b>${esc(c.nome||x.r.ref||'—')}</b><br><span class="mut">${esc(sub)}</span></span><button class="btn" data-nfi="${i}">${x.tipo==='c'?'É ele · ligar':'Ver'}</button></div>`; }).join(''); }

/* 2.4: chaves desta conversa pro vínculo com o negócio (tel · lid fixo do WhatsApp · nome do chat) */
function chatKeys(c){ if(!c||c.isGroup) return [];
  const nn=String(c.name||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const dg=String(c.phoneRaw||'').replace(/\D/g,'');
  return [dg.length>=10?'tel:'+dg.slice(-11):'', c.lid?'lid:'+c.lid:'', nn?'nome:'+nn:''].filter(Boolean); }
let VINC=false;   /* o card na tela veio do vínculo gravado */
let PELO_NOME=null;   /* 2.7.0: id do negócio achado SÓ pelo nome da conversa (pode ser a pessoa errada) */
function vincular(row){ if(!row||!CHAT) return; const k=chatKeys(CHAT); if(!k.length) return;
  send('wa.vincular',{keys:k,id:row.id,nome:(row.dados&&row.dados.nome)||''}).then(r=>{ if(r&&!r.ok) toast('Não gravou o vínculo: '+(r.error||'falha')); if(r&&r.ok){ VINC=true; toast('📌 Conversa ligada a '+((row.dados&&row.dados.nome)||'este negócio')+' — gravado no CRM, vale em qualquer aparelho'); if(CUR===String(row.id)) renderLpContato(CUR_ROW,CUR_CART); } }); }
function desvincular(){ if(!CHAT) return; send('wa.desvincular',{keys:chatKeys(CHAT),id:CUR}).then(()=>{ VINC=false; toast('Vínculo desfeito'); lookup(); }); }

// ---------- Visão LP · contato do FUNIL — v2.0 (28/09/2026) ----------
// O MESMO cadastro do app (Funil & Etapas, status por etapa, motivos de perda, listas de TA). Cada toque vira uma
// AÇÃO que o SW aplica sobre a versão fresca do banco (lpc.patch) — nunca uma cópia velha inteira por cima.
const LPC_COR={cinza:'#5b6770',azul:'#2563eb',amarelo:'#d97706',roxo:'#7c3aed',verde:'#16a34a',verm:'#dc2626'};
async function loadLpCfg(force){ const r=await send('lpcfg.get',{force:!!force}); if(r&&r.ok&&r.data) LPCFG=r.data; return r; }
/* ---- rascunho do card rápido (2.2) ---- */
const RASC_K=['etapa','status','listas','nota','tel','notas'];
function sujo(d){ return !!d&&RASC_K.some(k=>k in d); }
function nMud(d){ return d?RASC_K.filter(k=>k in d).length:0; }
function acoesDe(d){ const a=[];
  if('etapa' in d) a.push({tipo:'etapa',para:d.etapa});
  if('status' in d) a.push({tipo:'status',v:d.status});
  if('listas' in d) a.push({tipo:'listas',para:d.listas});
  if('nota' in d) a.push({tipo:'nota',texto:d.nota});
  const set={}; if('tel' in d) set.telefone=d.tel.trim(); if('notas' in d) set.notas=d.notas; if(Object.keys(set).length) a.push({tipo:'campos',set});
  return a; }
/* a PRÉVIA é o mesmo lpcAplicar que o service worker roda no banco — o que a tela mostra é o que vai ser gravado */
function previa(c,d,sem){ let v=c; if(!d) return v; for(const a of acoesDe(d)){ if(sem&&a.tipo===sem) continue; v=lpcAplicar(LPCFG.funil,v,a,'').dados; } return v; }
function mesmoSet(a,b){ a=a||[]; b=b||[]; return a.length===b.length&&a.every(x=>b.includes(x)); }
/* o que o banco devolveu bate com o que ele pediu? (nada de "✓ salvo" otimista) */
function conferir(d,dd){ const f=[];
  if('etapa' in d&&dd.etapa!==d.etapa) f.push('etapa');
  if('status' in d&&lpcStatusDe(LPCFG.funil,dd)!==d.status) f.push('status');
  if('listas' in d&&!mesmoSet(Array.isArray(dd.listas)?dd.listas:[],d.listas)) f.push('listas');
  if('nota' in d&&!lpcUltimos(dd,20).some(x=>String(x.l||'')===d.nota.trim())) f.push('nota');
  if('tel' in d&&String(dd.telefone||'')!==d.tel.trim()) f.push('telefone');
  if('notas' in d&&String(dd.notas||'')!==String(d.notas||'')) f.push('observação');
  return f; }
function hhmm(t){ const d=new Date(t); return String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0'); }
async function salvarRascunho(id){
  const d=DRAFTS[id]; if(!sujo(d)||(SAVE_ST[id]&&SAVE_ST[id].st==='salvando')) return;
  const nome=d.nome||'contato';
  SAVE_ST[id]={st:'salvando'}; if(CUR===id) pintaBarra(); pintaPend();
  const r=await send('lpc.patch',{id,acoes:acoesDe(d)});
  if(!r.ok){
    SAVE_ST[id]={st:'erro',msg:r.error||'falha ao salvar'};
    if(r.code==='ctx'||r.code==='auth'){ handleAuthFail(r); return; }   /* rascunho fica guardado */
    if(CUR===id) pintaBarra(); else toast('✖ Não salvou '+nome+': '+(r.error||'erro'));
    pintaPend(); return;
  }
  const dd=(r.data&&r.data.dados)||{}, falta=conferir(d,dd);
  if(falta.length){ SAVE_ST[id]={st:'erro',msg:'o CRM não aceitou: '+falta.join(', ')+' (confira no Funil & Etapas)'}; }
  else { delete DRAFTS[id]; SAVE_ST[id]={st:'ok',at:Date.now(),igual:!!(r.data&&r.data.semMudanca)}; }
  if(CUR===id){ loadLpCfg().then(()=>{ if(CUR===id) renderLpContato(r.data,CUR_CART); }); renderLpContato(r.data,CUR_CART); }
  else toast(falta.length?'✖ '+nome+': '+SAVE_ST[id].msg:'✓ Salvo no CRM: '+nome);
  pintaPend();
}
function descartar(id){ delete DRAFTS[id]; delete SAVE_ST[id]; }
/* aviso de rascunho de OUTRA conversa: salva dali mesmo, sem precisar voltar */
function pintaPend(){
  const box=$('#wa-pend'); if(!box) return;
  const ids=Object.keys(DRAFTS).filter(id=>id!==CUR&&sujo(DRAFTS[id]));
  box.innerHTML=ids.map(id=>{ const st=SAVE_ST[id]||{}, sv=st.st==='salvando';
    return `<div class="warn pend">⚠ <b>${esc(DRAFTS[id].nome||'Contato')}</b>: ${nMud(DRAFTS[id])} alteração(ões) <b>não salvas</b>${st.st==='erro'?` — ${esc(st.msg||'')}`:''}
      <div class="pend-b"><button class="btn primary" data-pend-salva="${esc(id)}" ${sv?'disabled':''}>${sv?'Salvando…':'💾 Salvar agora'}</button>
      <button class="btn" data-pend-desc="${esc(id)}" ${sv?'disabled':''}>Descartar</button></div></div>`; }).join('');
  box.querySelectorAll('[data-pend-salva]').forEach(b=>b.onclick=()=>salvarRascunho(b.dataset.pendSalva));
  box.querySelectorAll('[data-pend-desc]').forEach(b=>b.onclick=()=>{ const id=b.dataset.pendDesc; if(!confirm('Descartar as alterações não salvas de '+(DRAFTS[id]&&DRAFTS[id].nome||'este contato')+'?')) return; descartar(id); pintaPend(); });
}
/* barra fixa do card: estado do rascunho + Salvar/Descartar */
function pintaBarra(){
  const bar=$('#lp2-barra'); if(!bar||CUR==null) return;
  const d=DRAFTS[CUR], st=SAVE_ST[CUR]||{}, n=nMud(d), sv=st.st==='salvando';
  let txt, cls;
  if(sv){ txt='⏳ Salvando no CRM…'; cls='sv'; }
  else if(st.st==='erro'&&n){ txt='✖ Não salvou — '+esc(st.msg||'erro')+'. Suas alterações continuam aqui.'; cls='er'; }
  else if(n){ txt='● '+n+' alteração(ões) não salvas'; cls='su'; }
  else if(st.st==='ok'){ txt=st.igual?'✓ Já estava assim no CRM':'✓ Salvo no CRM às '+hhmm(st.at); cls='ok'; }
  else { txt='Sem alterações'; cls=''; }
  bar.className='salvabar '+cls; bar.hidden=!cls;   /* 2.8.0: sem nada pra salvar, a barra some */
  bar.innerHTML=`<span class="sb-t">${txt}</span>${n?`<button class="btn" id="lp2-desc" ${sv?'disabled':''}>Descartar</button><button class="btn primary" id="lp2-salvar" ${sv?'disabled':''}>${sv?'Salvando…':st.st==='erro'?'↻ Tentar de novo':'💾 Salvar'}</button>`:''}`;
  const b=$('#lp2-salvar'); if(b) b.onclick=()=>salvarRascunho(CUR);
  const x=$('#lp2-desc'); if(x) x.onclick=()=>{ descartar(CUR); renderLpContato(CUR_ROW,CUR_CART); };
  panel.querySelectorAll('.lp2 .edit').forEach(e=>{ e.disabled=sv; });
}
/* 2.6.0 MULTI-NEG → 2.8.0: os OUTROS negócios desta pessoa viram blocos dobráveis na aba 💼 Negócios — toque troca o card */
const NEG_PIPE={nn:['📈','Vida Individual'],bc:['📈','Vida Individual · Base'],vg:['👥','Vida em Grupo'],'vg-bc':['👥','Vida em Grupo · Base'],prud:['🧩','Prud. Demais'],'prud-bc':['🧩','Prud. Demais · Base'],mfo:['🏦','MFO'],'mfo-bc':['🏦','MFO · Base']};
const NEG_ORD=['nn','bc','vg','vg-bc','prud','prud-bc','mfo','mfo-bc'];
const NEG_PAPEL={decisor:'Decisor',rh:'RH',fin:'Financeiro',socio:'Sócio',outro:'Contato'};
let NEGS_CACHE=null;   /* {id,seq,l}: a lista de negócios da pessoa, lida 1 vez por conversa (o card redesenha a cada toque) */
/* trilho de etapas (só as de fluxo; encerramento não conta) */
function trilhoHTML(fluxo,iF){ return fluxo.length?`<div class="trilho" aria-hidden="true">${fluxo.map((e,i)=>`<i class="${i<=iF?'ok':''}" title="${esc(e.label)}"></i>`).join('')}</div>`:''; }
function etapaPos(cfg,c){ const et=lpcEtapasDe(cfg,c), fluxo=et.filter(e=>!e.enc), atual=lpcEtapaDe(cfg,c);
  return {fluxo,atual,iF:fluxo.findIndex(e=>e.id===(c&&c.etapa)),ehEnc:!!(atual&&atual.enc)}; }
async function pintaNegocios(id){ const box=$('#lp2-negs'); if(!box) return; const seq=LOOKSEQ;
  let l;
  if(NEGS_CACHE&&NEGS_CACHE.id===String(id)&&NEGS_CACHE.seq===seq) l=NEGS_CACHE.l;
  else { const r=await send('lp.negocios',{id}); if(seq!==LOOKSEQ||!$('#lp2-negs')||String(CUR_ROW&&CUR_ROW.id)!==String(id)) return;
    l=(r&&r.ok&&Array.isArray(r.data))?r.data.slice().sort((a,b)=>NEG_ORD.indexOf(a.funil)-NEG_ORD.indexOf(b.funil)):[];
    NEGS_CACHE={id:String(id),seq,l}; }
  const bx=$('#lp2-negs'); if(!bx) return;
  const ehEmpresa=/^vg(-bc)?$/.test(String(CUR_ROW&&CUR_ROW.dados&&CUR_ROW.dados.funil||''))&&Array.isArray(CUR_ROW.dados.pjContatos);   /* 2.6.1 (AUDIT B8) */
  const nTab=$('#aba-neg-n'); if(nTab) nTab.textContent=String(Math.max(1,l.length));
  /* 2.7.0: ＋ Novo negócio da MESMA pessoa (na ficha da empresa não: lá o negócio é a empresa) */
  const novo=ehEmpresa?'':`<button class="btn tracej" id="lp2-negnovo" title="Outro negócio da MESMA pessoa (outro pipe/funil)">＋ Novo negócio pra esta pessoa</button>`;
  const outros=l.filter(n=>n.id!==String(id));
  bx.innerHTML=(outros.length?`<div class="sec-t" style="margin:4px 2px 0">${ehEmpresa?'🏢 Empresa e negócios dos contatos':'Outros negócios desta pessoa'}</div>`:'')+outros.map(n=>{ const p=NEG_PIPE[n.funil]||['📈',n.funil];
    const pos=etapaPos(LPCFG.funil,{funil:n.funil,etapa:n.etapa}), lab=(pos.atual&&pos.atual.label)||n.etapa||'—';
    const tit=`${p[0]} ${esc(p[1])}${n.papel?` · 🏢 ${esc(n.nome)} (${esc(NEG_PAPEL[n.papel]||'Contato')})`:''}${n.pessoa?` · 👤 ${esc(n.pessoa)}`:''}`;
    const res=pos.ehEnc?'encerrado · '+esc(lab):(pos.iF>=0?`etapa ${pos.iF+1} de ${pos.fluxo.length} · `:'')+esc(lab);
    return blocoHTML('v28.neg.'+n.id,tit,res,`${trilhoHTML(pos.fluxo,pos.iF)}<button class="btn" data-neg="${esc(n.id)}" style="margin-top:8px">Abrir este negócio</button>`); }).join('')
    +(!outros.length?`<div class="mut" style="padding:2px">${ehEmpresa?'🏢 nenhum contato desta empresa com negócio no CRM':'💼 só este negócio desta pessoa'}</div>`:'')+novo;   /* AUDIT G6 */
  wireDob(bx);
  const b=$('#lp2-negnovo'); if(b) b.onclick=()=>{ const row=CUR_ROW; if(!row) return;
    if(sujo(DRAFTS[String(row.id)])&&!window.confirm('Tem mudança não salva neste negócio. Continuar? (o rascunho fica guardado)')) return;
    LOOKSEQ++; renderLpCreate([],row); };
  bx.querySelectorAll('[data-neg]').forEach(b=>b.onclick=async()=>{ if(sujo(DRAFTS[String(id)])&&!window.confirm('Tem mudança não salva neste negócio. Trocar mesmo assim? (o rascunho fica guardado)')) return;
    b.disabled=true; const seq2=LOOKSEQ; const rr=await send('lpc.um',{id:b.dataset.neg}); if(seq2!==LOOKSEQ) return;
    if(rr&&rr.ok&&rr.data){ const ks=chatKeys(CHAT), wc=rr.data.dados&&rr.data.dados.wa_chats; VINC=Array.isArray(wc)&&wc.some(k=>ks.includes(String(k)));   /* AUDIT E1: o 📌 é DESTE negócio, não do anterior */
      NEGS_CACHE=null;   /* a lista é relida pro outro negócio (ficha de empresa do VG tem outra lista) */
      renderLpContato(rr.data,CUR_CART); } else { b.disabled=false; toast('Não consegui abrir esse negócio'); } }); }
/* há quanto tempo está nesta etapa: último registro "Etapa: A → esta" do histórico (ou a data de criação) */
function desdeEtapa(c){ const l=(Array.isArray(c.interacoes)?c.interacoes:[]).filter(x=>x&&x.k==='etapa'&&x.para===c.etapa).sort((a,b)=>String(b.ts||b.dia||'').localeCompare(String(a.ts||a.dia||'')));
  const dia=(l[0]&&(String(l[0].ts||'').slice(0,10)||l[0].dia))||c.criadoEm; const n=diasEntre(dia,lpcHojeISO());
  return n==null?'':n<=0?'desde hoje':n===1?'há 1 dia':'há '+n+' dias'; }
/* ===== 2.8.0 PERFIL-NEGOCIOS: o card da pessoa — cabeçalho + abas 👤 Perfil e 💼 Negócios =====
   Mesma consulta rápida de antes (lp.lookup → lp_contatos + Carteira). Edição continua por RASCUNHO + 💾 Salvar
   (2.2: nada grava sozinho); ◀ voltar / Avançar etapa ▶ e a nota rápida entram no mesmo rascunho. */
function renderLpContato(row,cartHit){
  const id=String(row.id);
  CUR_ROW=row; CUR_CART=cartHit||null;
  const c0=row.dados||{}, cfg=LPCFG.funil;
  const D=DRAFTS[id]||(DRAFTS[id]={nome:c0.nome||''});
  const c=previa(c0,D);                                  /* o que a tela mostra = banco + rascunho */
  const etapas=lpcEtapasDe(cfg,c), atual=lpcEtapaDe(cfg,c);
  const fluxo=etapas.filter(e=>!e.enc), enc=etapas.filter(e=>e.enc), ehEnc=!!(atual&&atual.enc);
  const st=lpcStatusDe(cfg,c), opts=lpcStatusOpts(cfg,c), orf=(!st&&c.status&&(!c.status_etapa||c.status_etapa===c.etapa))?String(c.status):'';
  const listas=Array.isArray(c.listas)?c.listas:[], cat=[...listas,...LPCFG.listas.filter(n=>!listas.includes(n))];
  const funNome={nn:'Novos Negócios',bc:'Base de Clientes',vg:'Vida em Grupo',prud:'Prud. Demais',mfo:'MFO','vg-bc':'Vida em Grupo · Base','prud-bc':'Prud. Demais · Base','mfo-bc':'MFO · Base'}[c.funil||'nn']||String(c.funil||'Funil');
  const pipe=NEG_PIPE[c.funil||'nn']||['📈',funNome];
  const ult=lpcUltimos(c0,5);
  const mud=k=>(k in D)?' mud':'';
  const iF=fluxo.findIndex(e=>e.id===c.etapa), ant=iF>0?fluxo[iF-1]:null, prox=ehEnc?null:(iF<0?fluxo[0]||null:fluxo[iF+1]||null);
  const lab=(atual&&atual.label)||c.etapa||'—';
  const t=proxTarefa(c0), hoje=lpcHojeISO(), atr=!!(t&&t.quando&&t.quando<hoje), tt=t?(TAR_TIPO[t.tipo]||TAR_TIPO.outro):null;
  const nasc=c0.nascimento||(cartHit&&cartHit.nascimento), idade=idadeDe(nasc)!=null?idadeDe(nasc):(valido(c0.idade)?c0.idade:(cartHit&&cartHit.idade));
  const al=alertasDe(c0,cartHit), nAp=cartHit?(cartHit.aps||cartHit.apolices||[]).length:0;
  const mask=telMascara(c0.telefone||(CHAT&&CHAT.phoneRaw));
  const hdr={ nome:c.nome||'—',
    sub:[valido(idade)?idade+' anos':'', mask?'📱 '+mask:'', c0.lp?'LP '+cap1(c0.lp):''].filter(Boolean).map(esc).join(' · '),
    chips:[cartHit?`<span class="hc ok">Cliente · ${nAp} apólice${nAp===1?'':'s'}</span>`:'', `<span class="hc">${pipe[0]} ${esc(lab)}</span>`, ehEnc?'<span class="hc al">✖ encerrado</span>':'', ...al.chips].filter(Boolean),
    extra:`<div class="ph-acts"><button class="ph-act${MSG_ON?' on':''}" id="wa-msg-tg">💬 Mensagem pronta</button></div>
      <div class="ph-vinc">${VINC?`📌 ligado a esta conversa · <a href="#" id="lp2-desv">não é esta pessoa</a>`:`<a href="#" id="lp2-vinc">📌 ligar esta conversa a este negócio</a>`} · <a href="#" id="lp2-outro">＋ é outra pessoa</a></div>` };
  const sumEt=[esc(lab),st?esc(st):'',listas.length?'📋 '+listas.length:'',(('etapa' in D)||('status' in D)||('listas' in D))?'<b class="mud-t">● não salvo</b>':''].filter(Boolean).join(' · ');
  const etapaCorpo=`<div class="chips${mud('etapa')}">${fluxo.map(e=>`<button class="chip edit${e.id===c.etapa?' on':''}" data-etapa="${esc(e.id)}" style="${e.id===c.etapa?'background:'+(LPC_COR[e.cor]||'#2563eb')+';border-color:'+(LPC_COR[e.cor]||'#2563eb'):''}">${esc(e.label)}</button>`).join('')}</div>
      ${enc.length?`<div class="enc-l">Encerrar: ${enc.map(e=>`<button class="chip enc edit${e.id===c.etapa?' on':''}" data-etapa="${esc(e.id)}">${esc(e.label)}</button>`).join('')}</div>`:''}
      <div class="field${mud('status')}" style="margin-top:8px"><label>${ehEnc?'✖ Motivo da perda':'⚑ Status nesta etapa'}</label>
        ${opts.length?`<select id="lp2-status" class="edit ${ehEnc&&!st?'destaque':''}">${orf?`<option value="" selected>⚠ ${esc(orf)} (saiu da lista)</option>`:''}<option value="">${ehEnc?'— escolha o motivo —':'— sem status —'}</option>${opts.map(o=>`<option ${o===st?'selected':''}>${esc(o)}</option>`).join('')}</select>`
          :`<div class="muted">${ehEnc?'nenhum motivo cadastrado':'esta etapa não tem status'} — cadastre em Funil &amp; Etapas no CRM</div>`}</div>
      <div class="field${mud('listas')}"><label>📋 Listas de TA</label>
        <div class="chips">${listas.map(n=>`<span class="lchip">${esc(n)}<button class="lx edit" data-tira="${esc(n)}" title="Tirar desta lista">✕</button></span>`).join('')||'<span class="muted">sem lista</span>'}</div>
        <select id="lp2-lista" class="edit" style="margin-top:6px"><option value="">＋ pôr numa lista…</option>${cat.filter(n=>!listas.includes(n)).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}${listas.length?`<optgroup label="Mover (sai das outras)">${cat.filter(n=>!listas.includes(n)).map(n=>`<option value="mv:${esc(n)}">↪ só em ${esc(n)}</option>`).join('')}</optgroup>`:''}<option value="__nova">＋ Nova lista…</option></select></div>`;
  const editCorpo=`<div class="field${mud('tel')}"><label>Telefone</label><input id="lp2-tel" class="edit" inputmode="tel" value="${esc(('tel' in D)?D.tel:(c0.telefone||''))}"></div>
      <div class="field${mud('notas')}"><label>Observação fixa (campo Notas)</label><textarea id="lp2-notas" class="edit">${esc(('notas' in D)?D.notas:(c0.notas||''))}</textarea></div>`;
  const perfil=`${al.linhas.map(([k,tx])=>`<div class="alerta ${k}">${tx}</div>`).join('')}${dobBtsHTML()}
      ${quemBlocoHTML(c0,cartHit)}<div id="p-fam-wrap">${cartHit?famBlocoHTML(PERF[String((cartHit.dados&&cartHit.dados.ref)||cartHit.ref||'')]):''}</div>
      ${apolBlocoHTML(cartHit)}${cobBlocoHTML(cartHit)}
      ${blocoHTML('v28.p-edit','✏️ Telefone e observação',(('tel' in D)||('notas' in D))?'<b class="mud-t">● não salvo</b>':esc(mask||'sem telefone'),editCorpo)}
      ${cartHit?'':'<div class="mut" style="padding:2px 2px 0">📁 Não está na Carteira (nenhuma apólice importada).</div>'}`;
  const neg=`${dobBtsHTML()}
      <div class="neg sel">
        <div class="neg-h"><b>${pipe[0]} ${esc(pipe[1])}</b><span class="f">${esc(funNome)}</span></div>
        ${trilhoHTML(fluxo,ehEnc?-1:iF)}
        <div class="etapa"><span>${ehEnc?`encerrado · <b>${esc(lab)}</b>`:iF>=0?`etapa <b>${iF+1} de ${fluxo.length} · ${esc(lab)}</b>`:`<b>${esc(lab)}</b>`}${st?` · ⚑ ${esc(st)}`:''}</span><span>${esc(desdeEtapa(c0))}</span></div>
        ${('etapa' in D)?`<div class="mud-t" style="margin-top:4px">● etapa mudada — toque em 💾 Salvar</div>`:''}
        <div class="row-bt"><button class="btn edit" id="n-volta" ${ant?'':'disabled'} title="${ant?'Voltar pra '+esc(ant.label):'Primeira etapa'}">◀ voltar</button><button class="btn primary edit" id="n-avanca" ${prox?'':'disabled'} title="${prox?'Avançar pra '+esc(prox.label):ehEnc?'Negócio encerrado — reabra em Etapa · status':'Última etapa'}">Avançar etapa ▶</button></div>
        ${t?`<div class="prox${atr?' atr':''}"><b>➡️ Próxima: ${tt[0]} ${esc(t.tit||tt[1])}</b>${[t.quando?diaCurto(t.quando):'sem data',t.hora||'',atr?'atrasada':''].filter(Boolean).map(esc).join(' · ')}</div>`
          :`<div class="prox vaz"><b>Sem próxima atividade</b>marque a próxima no CRM (↗ CRM) — negócio sem atividade fica parado</div>`}
        <div class="nota"><input id="lp2-nota" class="edit${mud('nota')}" placeholder="registrar o que aconteceu…" value="${esc(D.nota||'')}" enterkeyhint="done"><button class="btn primary edit" id="lp2-nota-ok">Salvar</button></div>
        ${blocoHTML('v28.n-etapa','⚑ Etapa · status · listas',sumEt,etapaCorpo,'in')}
      </div>
      ${blocoHTML('v28.n-int','🕓 Últimas interações',ult.length?`${ult.length} · última ${esc(diaCurto(ult[0].dia||String(ult[0].ts||'').slice(0,10))||'—')}`:'nenhuma',
        ult.length?ult.map(x=>`<div class="int">${esc(x.l||'')}<div class="q">${esc(dataBR(x.dia||String(x.ts||'').slice(0,10)))}${x.por?' · '+esc(porCurto(x.por)):''}</div></div>`).join(''):'<div class="mut">Nenhum registro ainda.</div>')}
      <div id="lp2-negs" class="negs"><div class="mut" style="padding:2px">💼 outros negócios desta pessoa…</div></div>`;
  renderShell(`<div class="lp2">
    ${!VINC&&PELO_NOME===id?`<div class="warn">Achado só pelo <b>nome</b> da conversa — confira. Se for outra pessoa: <button class="btn primary" id="lp2-outro2" style="width:auto;margin-top:6px">＋ Criar contato novo</button></div>`:''}
    <div id="wa-msg-box">${MSG_ON?msgCardHTML():''}</div>
    <div class="abas" role="tablist"><button class="aba-t${ABA==='perfil'?' on':''}" data-aba="perfil" role="tab">👤 Perfil</button><button class="aba-t${ABA==='neg'?' on':''}" data-aba="neg" role="tab">💼 Negócios<span class="n" id="aba-neg-n">${NEGS_CACHE&&NEGS_CACHE.seq===LOOKSEQ&&NEGS_CACHE.l.length?NEGS_CACHE.l.length:1}</span></button></div>
    <div class="aba" data-aba-c="perfil" ${ABA==='perfil'?'':'hidden'}>${perfil}</div>
    <div class="aba" data-aba-c="neg" ${ABA==='neg'?'':'hidden'}>${neg}</div>
    <div class="salvabar" id="lp2-barra" hidden></div>
  </div>`,id,hdr,{busca:false});
  if(MSG_ON) wireMsgCard(c);
  wireDob(); pintaBarra(); pintaNegocios(id); if(cartHit&&!(String((cartHit.dados&&cartHit.dados.ref)||cartHit.ref||'') in PERF)) pintaFamilia(cartHit);
  panel.querySelectorAll('[data-aba]').forEach(b=>b.onclick=()=>{ ABA=b.dataset.aba; try{ chrome.storage.local.set({wa_crm_aba:ABA}); }catch(_){}
    panel.querySelectorAll('[data-aba]').forEach(x=>x.classList.toggle('on',x.dataset.aba===ABA));
    panel.querySelectorAll('[data-aba-c]').forEach(x=>{ x.hidden=x.dataset.abaC!==ABA; }); });
  { const m=$('#wa-msg-tg'); if(m) m.onclick=()=>{ MSG_ON=!MSG_ON; m.classList.toggle('on',MSG_ON); const box=$('#wa-msg-box'); if(!box) return; box.innerHTML=MSG_ON?msgCardHTML():''; if(MSG_ON) wireMsgCard(c); }; }
  { const a=$('#lp2-vinc'); if(a) a.onclick=e=>{ e.preventDefault(); vincular(row); };
    const b=$('#lp2-desv'); if(b) b.onclick=e=>{ e.preventDefault(); desvincular(); };
    const outro=e=>{ if(e) e.preventDefault(); LOOKSEQ++; renderLpCreate([]); };
    const o1=$('#lp2-outro'); if(o1) o1.onclick=outro; const o2=$('#lp2-outro2'); if(o2) o2.onclick=()=>outro(); }
  const redesenha=()=>{ if(SAVE_ST[id]&&SAVE_ST[id].st!=='salvando') delete SAVE_ST[id]; renderLpContato(CUR_ROW,CUR_CART); };
  const limpaIgual=()=>{ /* voltou ao que está no banco? então não é mudança */
    if('etapa' in D&&D.etapa===c0.etapa){ delete D.etapa; }
    if('status' in D&&lpcStatusDe(cfg,previa(c0,D,'status'))===D.status) delete D.status;
    if('listas' in D&&mesmoSet(D.listas,Array.isArray(previa(c0,D,'listas').listas)?previa(c0,D,'listas').listas:[])) delete D.listas; };
  const mudaEtapa=para=>{ if(!para||para===c.etapa) return; const e=etapas.find(x=>x.id===para);
    D.etapa=para; delete D.status;                            /* mudar etapa limpa o status (regra do app) */
    if(e&&e.enc){ D.listas=[]; D._encL=true; } else if(D._encL){ delete D.listas; delete D._encL; }
    limpaIgual(); redesenha(); };
  panel.querySelectorAll('[data-etapa]').forEach(b=>b.onclick=()=>mudaEtapa(b.dataset.etapa));
  { const v=$('#n-volta'); if(v&&ant) v.onclick=()=>mudaEtapa(ant.id); const a=$('#n-avanca'); if(a&&prox) a.onclick=()=>mudaEtapa(prox.id); }
  const ss=$('#lp2-status'); if(ss) ss.onchange=()=>{ D.status=ss.value; limpaIgual(); redesenha(); };
  panel.querySelectorAll('[data-tira]').forEach(b=>b.onclick=()=>{ const n=b.dataset.tira; D.listas=listas.filter(x=>x!==n); delete D._encL; limpaIgual(); redesenha(); });
  const sl=$('#lp2-lista'); if(sl) sl.onchange=()=>{ let v=sl.value; if(!v) return;
    if(v==='__nova'){ const n=(window.prompt('Nome da nova lista de TA:')||'').trim(); if(!n){ sl.value=''; return; } v=n; }
    D.listas=v.startsWith('mv:')?[v.slice(3)]:[...listas,v]; delete D._encL; limpaIgual(); redesenha(); };
  const tx=(sel,k,base)=>{ const el=$(sel); if(!el) return; el.addEventListener('input',()=>{ const v=el.value;
    if(k==='nota'?!v.trim():v===base) delete D[k]; else D[k]=v;
    el.closest('.field')?.classList.toggle('mud',k in D); if(k==='nota') el.classList.toggle('mud',k in D);
    if(SAVE_ST[id]&&SAVE_ST[id].st!=='salvando') delete SAVE_ST[id]; pintaBarra(); }); };
  tx('#lp2-nota','nota',''); tx('#lp2-tel','tel',String(c0.telefone||'')); tx('#lp2-notas','notas',String(c0.notas||''));
  /* nota rápida: "Salvar" grava o rascunho inteiro deste negócio (nota + o que mais tiver mudado), conferido contra o banco */
  { const ok=$('#lp2-nota-ok'), inp=$('#lp2-nota');
    const vai=()=>{ if(!sujo(D)){ toast('Escreva o que aconteceu primeiro.'); try{ inp.focus(); }catch(_){} return; } salvarRascunho(id); };
    if(ok) ok.onclick=vai; if(inp) inp.addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); vai(); } }); }
  if(ehEnc&&ss&&!st&&ABA==='neg') try{ ss.focus(); }catch(_){}
}
// Estoque (funil 'bn'): nome ainda não é negócio — card enxuto: listas de TA + nota (vai pras notas do Estoque)
function renderLpEstoque(row){
  const c=row.dados||{}, listas=Array.isArray(c.listas)?c.listas:[], cat=[...listas,...LPCFG.listas.filter(n=>!listas.includes(n))];
  const mask=telMascara(c.telefone||(CHAT&&CHAT.phoneRaw));
  const hdr={nome:c.nome||'—', sub:[mask?'📱 '+mask:'', c.recomendante?'rec. '+c.recomendante:'', c.lp?'LP '+cap1(c.lp):''].filter(Boolean).map(esc).join(' · '),
    chips:['<span class="hc">📦 Estoque de Nomes</span>'],
    extra:`<div class="ph-acts"><button class="ph-act${MSG_ON?' on':''}" id="wa-msg-tg">💬 Mensagem pronta</button></div>`};
  renderShell(`<div class="lp2">
    <div id="wa-msg-box">${MSG_ON?msgCardHTML():''}</div>
    <div class="card"><div class="field"><label>📋 Listas de TA</label>
      <div class="chips">${listas.map(n=>`<span class="lchip">${esc(n)}<button class="lx" data-tira="${esc(n)}">✕</button></span>`).join('')||'<span class="muted">sem lista</span>'}</div>
      <select id="lp2-lista" style="margin-top:6px"><option value="">＋ pôr numa lista…</option>${cat.filter(n=>!listas.includes(n)).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></div>
      <textarea id="lp2-nota" placeholder="nota (vai pras notas do nome no Estoque)"></textarea>
      <button class="btn primary" id="lp2-nota-ok" style="margin-top:6px">Registrar nota</button></div>
    <div class="note">Nome do <b>Estoque</b>: pra virar negócio, use "levar pro funil" no CRM (Painel TA / Estoque).</div></div>`,null,hdr,{busca:false});
  if(MSG_ON) wireMsgCard(c);
  { const m=$('#wa-msg-tg'); if(m) m.onclick=()=>{ MSG_ON=!MSG_ON; m.classList.toggle('on',MSG_ON); const box=$('#wa-msg-box'); if(!box) return; box.innerHTML=MSG_ON?msgCardHTML():''; if(MSG_ON) wireMsgCard(c); }; }
  panel.querySelectorAll('[data-tira]').forEach(b=>b.onclick=()=>{ const n=b.dataset.tira; lpcAcaoBn(row,[{tipo:'listas',para:listas.filter(x=>x!==n)}],`✓ Saiu de “${n}”`); });
  const sl=$('#lp2-lista'); if(sl) sl.onchange=()=>{ const v=sl.value; if(v) lpcAcaoBn(row,[{tipo:'listas',para:[...listas,v]}],`✓ Em “${v}”`); };
  $('#lp2-nota-ok').onclick=()=>{ const t=$('#lp2-nota').value.trim(); if(!t){ toast('Escreva a nota primeiro.'); return; } lpcAcaoBn(row,[{tipo:'nota',texto:t}],'✓ Nota registrada'); };
}
async function lpcAcaoBn(row,acoes,okMsg){ if(BUSY) return; BUSY=true; const seq=LOOKSEQ; const r=await send('lpc.patch',{id:row.id,acoes}); BUSY=false;
  if(!handleAuthFail(r)) return;
  if(seq!==LOOKSEQ){ toast(r.ok?'✓ Salvo: '+((row.dados&&row.dados.nome)||'nome do Estoque'):'✖ Não salvou: '+(r.error||'erro')); return; }   /* trocou de conversa: não pinta o card velho por cima */
  if(r.ok){ renderLpEstoque(r.data); toast(okMsg); } else toast('Erro: '+(r.error||'falha ao salvar')); }
function renderLpContatoPicker(list,cart){
  renderShell(`<div class="note">${list.length} contatos parecidos no funil LP — escolha:</div>`+
    list.map((r,i)=>{ const c=r.dados||{}; const e=lpcEtapaDe(LPCFG.funil,c);
      return `<div class="pick" data-i="${i}"><b>${esc(c.nome||'—')}</b><br>
      <span class="muted">${esc((e&&e.label)||c.etapa||'—')} · ${esc(c.telefone||'sem telefone')}</span></div>`; }).join(''));
  panel.querySelectorAll('.pick').forEach(el=>{ el.onclick=()=>{ const x=list[+el.dataset.i]; renderLpContato(x,cart||null); vincular(x); }; });
}
/* 2.7.0 CRIAR-NOVO (pedido dele 01/10: indicado com "Rec <quem indicou>" no nome da conversa): criar direto da extensão, em 2 sabores —
   · CONTATO NOVO (outra pessoa): nome e recomendante saem do nome da conversa ("Fulano Rec Beltrana" → Fulano · rec. Beltrana),
     telefone do chat, escolhe o pipe/funil; a conversa fica ligada ao negócio novo.
   · NOVO NEGÓCIO da MESMA pessoa (irmao = negócio aberto): outro pipe/funil, nasce com o mesmo pessoaId (MULTI-NEG do app);
     se o negócio de origem ainda não tinha pessoaId, ganha um antes (ação 'pessoa', nunca troca um existente).
   2.7.1 (pedido dele 01/10: "não achei funil do vida em grupo"): no Vida em Grupo o negócio é a EMPRESA (VG-EMPRESA do app,
   espelho de pjSalvarNovaEmpresa) — o formulário pede a empresa e o papel; a pessoa entra como contato ⭐ (com ct quando já é
   negócio no CRM). Empresa NUNCA leva pessoaId (regra do app). */
const NOVO_FUNIS=[['nn','📈 Vida Individual · Novos Negócios'],['bc','📈 Vida Individual · Base de Clientes'],['vg','👥 Vida em Grupo · Novos Negócios (empresa)'],['vg-bc','👥 Vida em Grupo · Base (empresa)'],['prud','🧩 Prud. Demais · Novos Negócios'],['prud-bc','🧩 Prud. Demais · Base'],['mfo','🏦 MFO · Novos Negócios'],['mfo-bc','🏦 MFO · Base']];
const PJ_PAPEIS=[['decisor','Decisor'],['rh','RH'],['fin','Financeiro'],['socio','Sócio'],['outro','Outro']];   /* mesma lista do app */
const ehVG=f=>f==='vg'||f==='vg-bc';
function etapa0(funil){ const arr=LPCFG.funil&&LPCFG.funil[lpcCfgKey({funil})];
  const e=Array.isArray(arr)?arr.find(x=>x&&x.id&&!x.enc):null; return (e&&e.id)||LPC_ETAPA0[funil]||'SitPlan'; }
/* 2.8.0: funilIni = pipe já escolhido ("＋ Novo negócio" → nn · "＋ Negócio na Base" → bc) */
function renderLpCreate(sugestoes,irmao,funilIni){
  const chatPhone=CHAT&&CHAT.phoneRaw?normPhone(CHAT.phoneRaw):null;
  const d0=irmao?(irmao.dados||{}):null;
  const doChat=recDoNome(CHAT&&CHAT.name)||{nome:(CHAT&&CHAT.name)||'',recomendante:''};
  const nome0=d0?(d0.nome||''):doChat.nome, tel0=d0?(d0.telefone||''):(chatPhone?chatPhone.telefone:''), rec0=d0?(d0.recomendante||''):doChat.recomendante;
  const funAtual=d0&&(d0.funil||'nn');
  const fun0=funilIni||(d0?((NOVO_FUNIS.find(x=>x[0]!==funAtual)||['nn'])[0]):'nn');   /* novo negócio: já sugere um funil diferente do atual */
  renderShell(`
    ${sugestoes&&sugestoes.length?`<div class="note"><b>Parecidos no funil LP</b> — confira antes de criar:</div>`+
      sugestoes.map((r,i)=>{ const cc=r.dados||{}; return `<div class="pick" data-lpsug="${i}"><b>${esc(cc.nome||'—')}</b><br>
        <span class="muted">${esc(LPC_FUNIS[lpcFunilDe(cc)].label)} · ${esc(cc.etapa||'—')} · ${esc(cc.telefone||'sem telefone')}</span></div>`; }).join(''):''}
    <div class="card">
      <h2 style="margin-bottom:8px">${d0?'＋ Novo negócio de '+esc(firstName(nome0)||'—'):'＋ Novo contato na Visão LP'}</h2>
      ${d0?`<p class="muted" id="wa-lpn-irm" style="margin-bottom:8px">Mesma pessoa, outro pipe — o negócio novo fica ligado a ${esc(nome0)} (aparece em 💼 Negócios desta pessoa).</p>`:''}
      ${fieldHTML('wa-lpn-nome','Nome',nome0)}
      ${fieldHTML('wa-lpn-tel','Telefone',tel0)}
      ${fieldHTML('wa-lpn-rec','Recomendante (quem indicou)',rec0,'opcional')}
      <div class="field"><label>Pipe · funil</label><select id="wa-lpn-funil">${NOVO_FUNIS.map(([f,l])=>`<option value="${f}" ${f===fun0?'selected':''}>${esc(l)}${f===funAtual?' (já é este)':''}</option>`).join('')}</select></div>
      <div id="wa-lpn-vg" style="display:none">
        <div class="note" style="margin:0 0 8px">🏢 No Vida em Grupo o negócio é a <b>empresa</b> — <span id="wa-lpn-vgquem">${esc(firstName(nome0)||'a pessoa')}</span> entra como contato ⭐ dela.</div>
        ${fieldHTML('wa-lpn-emp','Nome da empresa *','','ex.: Padaria Silva')}
        <div class="row2">${fieldHTML('wa-lpn-cnpj','CNPJ','','opcional')}<div class="field"><label>Nº de vidas</label><input id="wa-lpn-vidas" type="number" min="0" inputmode="numeric" placeholder="opcional"></div></div>
        <div class="field"><label>Papel na empresa</label><select id="wa-lpn-papel">${PJ_PAPEIS.map(([k,l])=>`<option value="${k}" ${k==='decisor'?'selected':''}>${esc(l)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label>Notas</label><textarea id="wa-lpn-notas"></textarea></div>
      <button class="btn primary" id="wa-lpn-save">＋ Criar no CRM</button>
    </div>
    <button class="btn" id="wa-lpn-volta">← ${d0?'voltar pro card de '+esc(firstName(nome0)):'voltar'}</button>
  `,null,d0?{nome:nome0,sub:'novo negócio da mesma pessoa'}:hdrChat(),{busca:false});
  panel.querySelectorAll('[data-lpsug]').forEach(el=>{ el.onclick=()=>{ const x=sugestoes[+el.dataset.lpsug]; renderLpContato(x); vincular(x); }; });
  const volta=$('#wa-lpn-volta'); if(volta) volta.onclick=()=>{ if(irmao) renderLpContato(irmao,CUR_CART); else lookup(); };
  const fsel=$('#wa-lpn-funil'), vgBox=$('#wa-lpn-vg');
  const syncVG=()=>{ const vg=ehVG(fsel.value); vgBox.style.display=vg?'':'none';
    const lb=$('#wa-lpn-nome').closest('.field').querySelector('label'); if(lb) lb.textContent=vg?'Contato (quem fala pela empresa)':'Nome';
    const irm=$('#wa-lpn-irm'); if(irm) irm.style.display=vg?'none':'';
    $('#wa-lpn-save').textContent=vg?'🏢 Criar empresa no CRM':'＋ Criar no CRM'; if(vg){ const e=$('#wa-lpn-emp'); if(e&&!e.value) e.focus(); } };
  fsel.onchange=syncVG; syncVG();
  $('#wa-lpn-nome').addEventListener('input',()=>{ const q=$('#wa-lpn-vgquem'); if(q) q.textContent=firstName($('#wa-lpn-nome').value)||'a pessoa'; });
  $('#wa-lpn-save').onclick=async()=>{
    const nome=$('#wa-lpn-nome').value.trim(), funil=$('#wa-lpn-funil').value, rec=$('#wa-lpn-rec').value.trim();
    if(!nome){ toast('Nome é obrigatório.'); return; }
    const vg=ehVG(funil), empNome=vg?$('#wa-lpn-emp').value.trim():'';
    if(vg&&!empNome){ toast('Falta o nome da empresa.'); $('#wa-lpn-emp').focus(); return; }
    if(BUSY) return; BUSY=true; $('#wa-lpn-save').disabled=true;
    const seq=LOOKSEQ;
    const fim=(msg)=>{ BUSY=false; const b=$('#wa-lpn-save'); if(b) b.disabled=false; if(msg) toast(msg); };
    let pid=null;
    if(d0&&!vg){ pid=d0.pessoaId||('p-'+lpcUid().slice(1));
      if(!d0.pessoaId){ const rp=await send('lpc.patch',{id:irmao.id,acoes:[{tipo:'pessoa',id:pid}]});
        if(!handleAuthFail(rp)){ BUSY=false; return; }
        if(!rp.ok){ fim('Erro ao ligar à pessoa: '+(rp.error||'falha')); return; }
        pid=(rp.data&&rp.data.dados&&rp.data.dados.pessoaId)||pid; } }
    // shape completo do vendas.html vem do lpcNovoContato (normalize.js) — aqui só o que a UI coletou.
    const tel=$('#wa-lpn-tel').value.trim();
    const campos={ nome, telefone:tel||null, funil, etapa:etapa0(funil), notas:$('#wa-lpn-notas').value };
    if(rec){ campos.recomendante=rec; if(!d0||rec!==String(d0.recomendante||'')) campos.rec_recebida_em=lpcHojeISO(); }   /* REC-TIMING do app: rec nova ganha a data de hoje */
    if(vg){ /* espelho de pjSalvarNovaEmpresa + pjNormalizar: o telefone da empresa é o do contato ⭐ (pjTelDe) */
      const pj={}; const cnpj=$('#wa-lpn-cnpj').value.trim(), vidas=$('#wa-lpn-vidas').value.trim();
      if(cnpj) pj.cnpj=cnpj; if(vidas) pj.vidas=Math.max(0,parseInt(vidas,10)||0);
      const kid='pj'+lpcUid().slice(1);
      Object.assign(campos,{ nome:empNome, telefone:tel||'', pj, pjContatos:[{id:kid,nome,tel,papel:$('#wa-lpn-papel').value||'decisor',principal:true,ct:d0?String(irmao.id):null}] });
      if(tel) campos.pjTelDe=kid; }
    else if(d0){ campos.pessoaId=pid; ['email','nascimento','sexo','idade','profissao','instagram'].forEach(k=>{ const v=d0[k]; if(v!=null&&v!==''&&v!=='—') campos[k]=v; }); }
    const dados=lpcNovoContato(campos);
    const r=await send('lpc.save',{id:dados.id,dados});
    BUSY=false;
    if(!handleAuthFail(r)) return;
    if(!r.ok){ fim('Erro: '+(r.error||'falha ao criar')); return; }
    if(seq!==LOOKSEQ){ toast('✓ Criado no CRM: '+(vg?empNome:nome)); return; }   /* trocou de conversa no meio: não pinta por cima */
    PELO_NOME=null;
    renderLpContato(r.data);
    if(vg){ if(!d0) vincular(r.data); toast('🏢 '+empNome+' criada no Vida em Grupo — '+firstName(nome)+' é o contato ⭐'); }
    else if(d0) toast('✓ Novo negócio de '+firstName(nome)+' — ligado aos outros dele');
    else { vincular(r.data); toast('✓ '+firstName(nome)+' criado na Visão LP'); }
  };
}

// ---------- wiring comum ----------
function wireHeader(){
  $('#wa-close').onclick=()=>setOpen(false);
  const lg=$('#wa-logout');
  if(lg) lg.onclick=async()=>{ await send('auth.logout'); AUTH={logged:false,email:'',usuario:''}; refreshFab(); renderLogin(); };
  /* 2.8.0: no card da pessoa a busca fica escondida — o 🔍 do cabeçalho abre/fecha */
  const bt=$('#wa-busca-tg'); if(bt) bt.onclick=()=>{ const box=$('#wa-busca-box'); if(!box) return;
    if(box.innerHTML){ BUSCA_ON=false; box.innerHTML=''; return; }
    BUSCA_ON=true; box.innerHTML=searchHTML(); wireSearch(); const q=$('#wa-q'); if(q) try{ q.focus(); }catch(_){} };
}
function wireSearch(){
  const go=async()=>{
    const q=$('#wa-q').value.trim(); if(!q) return;
    const seq=++LOOKSEQ;
    renderLoading();
    const r=await send(VIEW==='lp'?'lp.search':'leads.searchByName',{q});
    if(seq!==LOOKSEQ) return;
    if(!handleAuthFail(r)) return;
    if(VIEW==='lp'){
      const d=(r.ok&&r.data)||{}, cs=d.contatos||[], ct=d.carteira||[];
      if(cs.length===1){ renderLpContato(cs[0],ct[0]||null); vincular(cs[0]); }
      else if(cs.length>1) renderLpContatoPicker(cs);
      else if(ct.length===1) renderLpCliente(ct[0]);
      else if(ct.length>1) renderLpPicker(ct);
      else renderShell(`<div class="empty"><div class="big">🔎</div>Nada na Visão LP para “${esc(q)}”.</div>`);
      return;
    }
    const list=(r.ok&&r.data)||[];
    if(!list.length){ renderShell(`<div class="empty"><div class="big">🔎</div>Nenhum lead para “${esc(q)}”.</div>`); }
    else if(list.length===1){ LEAD=list[0]; renderLead(); }
    else renderPicker(list,`${list.length} leads para “${q}” — escolha:`);
  };
  const btn=$('#wa-q-go'), inp=$('#wa-q');
  if(btn) btn.onclick=go;
  const nv=$('#wa-novo'); if(nv) nv.onclick=()=>{ LOOKSEQ++; renderLpCreate([]); };   /* 2.7.0: criar sempre à mão, de qualquer tela */
  if(inp) inp.addEventListener('keydown',e=>{ if(e.key==='Enter') go(); });
}
function handleAuthFail(r){
  if(r&&!r.ok&&r.code==='ctx'){ renderCtxLost(); return false; }
  if(r&&!r.ok&&r.code==='auth'){ AUTH.logged=false; refreshFab(); renderLogin('Sessão expirou — entre de novo.'); return false; }
  return true;
}
function refreshFab(){
  const d=root.querySelector('#fab-dot');
  if(d) d.className='dot '+(AUTH.logged?'on':'off');
}

// ---------- fluxo principal ----------
async function loadFunil(){
  const r=await send('funil.get');
  if(r.ok&&r.data) FUNIL=buildFunnel(r.data);
}

async function lookup(){
  if(!OPEN) return;
  const c=CHAT, seq=++LOOKSEQ;
  if(!AUTH.logged){ renderLogin(); return; }
  if(!c){ renderNoChat(); return; }
  if(c.isGroup){ renderGroup(); return; }
  renderLoading();
  if(VIEW==='lp'){ // Visão LP: contato do funil (telefone → nome forte) → Estoque → Carteira → criar
    let contatos=[],carteira=[],byName=null,estoque=[]; PELO_NOME=null;
    const [r]=await Promise.all([send('lp.lookup',{phone:c.phoneRaw||'',name:c.name||'',keys:chatKeys(c)}),loadLpCfg()]);
    VINC=!!(r&&r.ok&&r.data&&r.data.vinculo);
    if(seq!==LOOKSEQ) return;                    /* já trocou de conversa: esta resposta é de outra pessoa */
    if(!handleAuthFail(r)) return;
    if(r.ok&&r.data){ contatos=r.data.contatos||[]; carteira=r.data.carteira||[]; byName=r.data.byName; estoque=r.data.estoque||[]; }
    if(!contatos.length&&!(byName&&byName.strong)&&estoque.length===1){ renderLpEstoque(estoque[0]); return; }
    if(contatos.length===1) renderLpContato(contatos[0],carteira[0]||null);
    else if(contatos.length>1) renderLpContatoPicker(contatos,carteira[0]||null);
    else if(byName&&byName.strong){ PELO_NOME=String(byName.strong.id); renderLpContato(byName.strong,carteira[0]||null); }
    else if(carteira.length===1) renderLpCliente(carteira[0]);
    else if(carteira.length>1) renderLpPicker(carteira);
    else renderNaoAchou((byName&&byName.sugestoes)||[]);   /* 2.8.0: ninguém com esse telefone → busca por nome + criar */
    return;
  }
  let matches=[];
  if(c.phoneRaw){
    const r=await send('leads.findByPhone',{phone:c.phoneRaw});
    if(seq!==LOOKSEQ) return;
    if(!handleAuthFail(r)) return;
    matches=(r.ok&&r.data)||[];
  }
  if(matches.length===1){ LEAD=matches[0]; renderLead(); return; }
  if(matches.length>1){ renderPicker(matches,'Mais de um lead com esse telefone — escolha (e unifique em Duplicatas no CRM):'); return; }
  // sem match por telefone → nome, tolerante às tags do WhatsApp ("OT Fulano Rec LP…"):
  // único candidato com primeiro+último nome contidos no apelido abre o card direto
  // (com aviso); os demais viram sugestão — nome nunca trava criação.
  let sugestoes=[];
  if(c.name){
    const r=await send('leads.findByName',{name:c.name});
    if(seq!==LOOKSEQ) return;
    if(!handleAuthFail(r)) return;
    const d=(r.ok&&r.data)||{};
    if(d.strong){ LEAD=d.strong; renderLead(); toast('Casado pelo NOME do contato — confira se é a pessoa certa'); return; }
    sugestoes=d.sugestoes||[];
  }
  renderCreate(sugestoes);
}

fab.onclick=()=>{ setOpen(true); lookup(); };
/* 2.8.0: ícone da extensão na barra do Chrome (sw.js) → abre o painel nesta aba */
try{ chrome.runtime.onMessage.addListener(m=>{ if(m&&m.type==='wa.abrir'&&!OPEN){ setOpen(true); lookup(); } }); }catch(_){}
handle.onclick=()=>setOpen(false);

// boot
try{ const o=await chrome.storage.local.get(['wa_crm_aba','wa_crm_dob']); if(o&&(o.wa_crm_aba==='perfil'||o.wa_crm_aba==='neg')) ABA=o.wa_crm_aba; if(o&&o.wa_crm_dob&&typeof o.wa_crm_dob==='object') DOB=o.wa_crm_dob; }catch(_){}
const st=await send('auth.status');
if(st.ok&&st.data.logged){ AUTH={logged:true,email:st.data.email,usuario:st.data.usuario}; loadFunil(); loadMsgs(); loadLpCfg(); }
refreshFab();
WA_DOM.observe(c=>{ CHAT=c; LEAD=null; BUSCA_ON=false; NEGS_CACHE=null; lookup(); });
})();
