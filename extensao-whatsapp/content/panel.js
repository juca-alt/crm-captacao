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
let MODO='rapido';   /* 2.2.1: o botão CRM SEMPRE abre algo na página (card rápido); o completo vai pela aba 🗂 / ícone da barra */                // 'completo' (ficha do CRM no PAINEL LATERAL do Chrome) | 'rapido' (card nativo)
let DOB={};                         // tópicos do card rápido: aberto/fechado lembrado
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
function headerHTML(){
  return `<div class="ph"><b>Visão LP · CRM</b><span class="sub">${esc(EXT_VERSION)}</span>
    ${AUTH.logged?`<button class="btn ghost" id="wa-logout" style="color:#cbd5e1">sair</button>`:''}
    <button class="x" id="wa-close" title="Fechar">×</button></div>`;
}
function searchHTML(){
  const ph=VIEW==='lp'?'Buscar cliente da Carteira por nome…':'Buscar lead por nome ou telefone…';
  return `<div class="search"><input id="wa-q" placeholder="${ph}">
    <button class="btn" id="wa-q-go" style="width:auto">🔍</button></div>`;
}
function tabsHTML(){   /* 2.1: as abas agora são o MODO do card (a aba Captação saiu) */
  return `<div class="tabs">
    <button class="tab lp ${MODO==='completo'?'on':''}" data-modo="completo" title="A mesma ficha do negócio que você abre no CRM">🗂 Card completo</button>
    <button class="tab lp ${MODO==='rapido'?'on':''}" data-modo="rapido" title="Card enxuto: etapa, status, listas e nota">⚡ Rápido</button></div>`;
}
function wireTabs(){
  panel.querySelectorAll('.tab[data-modo]').forEach(b=>b.onclick=()=>{
    if(MODO===b.dataset.modo) return;
    MODO=b.dataset.modo; try{ chrome.storage.local.set({wa_crm_modo:MODO}); }catch(_){}
    if(MODO==='completo'){ renderCompleto(); avisaConversa(CHAT); return; }   /* 2.3: dentro do painel */
    sairCompleto(); lookup();
  });
}
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

function renderShell(innerHTML,curId){
  CUR=curId!=null?String(curId):null;   /* só o card rápido de um contato "é" o CUR; qualquer outra tela zera */
  panel.innerHTML=headerHTML()+`<div class="pb">${tabsHTML()}<div id="wa-pend"></div>${searchHTML()}${innerHTML}<div class="toast" id="wa-toast"></div></div>`;
  wireHeader(); wireSearch(); wireTabs(); pintaPend();
}

function renderNoChat(){
  renderShell(`<div class="empty"><div class="big">💬</div>Abra uma conversa no WhatsApp<br>para ver o card do lead.</div>`);
}
function renderLoading(){
  renderShell(`<div class="empty"><div class="big">⏳</div>Buscando lead…</div>`);
}
function renderGroup(){
  renderShell(`<div class="empty"><div class="big">👥</div>Conversa de <b>grupo</b> — captura de lead é por contato individual.</div>`);
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

// ---------- Visão LP · Carteira (leitura) ----------
function lpFieldRows(d){
  const rows=[];
  for(const k in (d||{})){
    if(/^_/.test(k)||k==='raw'||k==='nome') continue;
    const v=d[k];
    if(v==null||v==='') continue;
    if(typeof v==='object'){ if(Array.isArray(v)&&v.every(x=>typeof x!=='object')&&v.length) rows.push([k,v.join(', ')]); continue; }
    rows.push([k,String(v)]);
    if(rows.length>=10) break;
  }
  return rows;
}
function renderLpCliente(cli){
  const d=cli.dados||{};
  renderShell(`
    <div class="card">
      <h2>${esc(d.nome||cli.ref||'—')}</h2>
      <span class="badge" style="background:var(--teal)"><span class="dot"></span>Cliente · Carteira LP</span>
      ${lpFieldRows(d).map(([k,v])=>`<div class="muted" style="margin-top:3px"><b style="color:var(--txt);text-transform:capitalize">${esc(k)}:</b> ${esc(v)}</div>`).join('')||'<div class="muted">sem detalhes no snapshot importado</div>'}
    </div>
    ${cli.apolices&&cli.apolices.length?`<div class="card"><b style="font-size:12px;color:var(--muted)">APÓLICES (${cli.apolices.length})</b>${cli.apolices.map(a=>`<div style="margin-top:4px">📄 ${esc(String(a).split('|')[0])}</div>`).join('')}</div>`:''}
    <div class="note">Card da <b>Carteira</b> (leitura). O funil e as notas da Visão LP ainda vivem no vendas.html deste aparelho — a frente "sync contatos LP → Supabase" habilita edição aqui.</div>
  `);
}
function renderLpPicker(list){
  renderShell(`<div class="note">${list.length} clientes parecidos na Carteira — escolha:</div>`+
    list.map((c,i)=>`<div class="pick" data-i="${i}"><b>${esc((c.dados&&c.dados.nome)||c.ref||'—')}</b><br>
      <span class="muted">${c.apolices&&c.apolices.length?c.apolices.length+' apólice(s)':'sem apólices vinculadas'}</span></div>`).join(''));
  panel.querySelectorAll('.pick').forEach(el=>{ el.onclick=()=>renderLpCliente(list[+el.dataset.i]); });
}

// ---------- 2.2: CARD COMPLETO no PAINEL LATERAL do Chrome (content/embed.html → vendas.html?wa=1) ----------
// Na 2.1 o CRM ia num iframe DENTRO do WhatsApp e o Chrome o barrava (ícone cinza): o web.whatsapp.com manda
// `Cross-Origin-Embedder-Policy: require-corp`, o iframe da extensão herda, e o vendas.html do GitHub Pages não
// tem cabeçalho COEP/CORP. O painel lateral é da extensão, fora da árvore do WhatsApp — ver content/embed.js.
// sidePanel.open() exige o gesto do usuário: abrirLateral() é chamada DIRETO no clique, sem await antes.
function abrirLateral(){   /* 2.2.2: abre a JANELA do CRM ao lado (o painel lateral fica só no ícone da barra) */
  return send('janela.open').then(r=>{
    if(r.ok) return true;
    if(r.code==='ctx'){ setOpen(true); renderCtxLost(); return false; }
    setOpen(true); renderCompleto(r.error); return false;
  });
}
function avisaConversa(c){ send('wa.chat',{tel:(c&&c.phoneRaw)||'',nome:(c&&c.name)||'',grupo:!!(c&&c.isGroup),keys:chatKeys(c)}); }
/* 2.4: chaves desta conversa pro vínculo com o negócio (tel · lid fixo do WhatsApp · nome do chat) */
function chatKeys(c){ if(!c||c.isGroup) return [];
  const nn=String(c.name||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
  const dg=String(c.phoneRaw||'').replace(/\D/g,'');
  return [dg.length>=10?'tel:'+dg.slice(-11):'', c.lid?'lid:'+c.lid:'', nn?'nome:'+nn:''].filter(Boolean); }
let VINC=false;   /* o card na tela veio do vínculo gravado */
function vincular(row){ if(!row||!CHAT) return; const k=chatKeys(CHAT); if(!k.length) return;
  send('wa.vincular',{keys:k,id:row.id,nome:(row.dados&&row.dados.nome)||''}).then(r=>{ if(r&&!r.ok) toast('Não gravou o vínculo: '+(r.error||'falha')); if(r&&r.ok){ VINC=true; toast('📌 Conversa ligada a '+((row.dados&&row.dados.nome)||'este negócio')+' — gravado no CRM, vale em qualquer aparelho'); avisaConversa(CHAT); if(CUR===String(row.id)) renderLpContato(CUR_ROW,CUR_CART); } }); }
function desvincular(){ if(!CHAT) return; send('wa.desvincular',{keys:chatKeys(CHAT),id:CUR}).then(()=>{ VINC=false; toast('Vínculo desfeito'); avisaConversa(CHAT); lookup(); }); }
/* 2.3.0: o card completo volta pra DENTRO do painel. O que barrava (ícone cinza) era o COEP require-corp do
   WhatsApp: o vendas.html do GitHub Pages não tem COEP/CORP. Agora a regra do declarativeNetRequest (rules.json)
   põe COEP: credentialless + CORP: cross-origin só na resposta do CRM quando ele é carregado como FRAME — o Chrome
   deixa embutir. O iframe é criado UMA vez e nunca muda de lugar no DOM (mover iframe = recarregar o CRM): trocar
   de conversa só avisa o embed.js pelo storage.session, que manda {tipo:'wa-abrir'} pro CRM. */
let FRAME=null;
function renderCompleto(erro){
  CUR=null;
  panel.classList.add('largo'); handle.classList.add('largo');
  if(!FRAME){ FRAME=document.createElement('iframe'); FRAME.className='full-frame'; FRAME.title='Ficha do negócio no CRM';
    FRAME.setAttribute('allow','clipboard-write'); FRAME.src=chrome.runtime.getURL('content/embed.html'); }
  if(!panel.querySelector('.full-wrap')||FRAME.parentNode!==panel.querySelector('.full-wrap')){
    panel.innerHTML=headerHTML()+`<div class="pb pb-full">${tabsHTML()}<div id="wa-pend"></div>
      ${erro?`<div class="warn">${esc(erro)}</div>`:''}
      <div class="full-wrap"></div>
      <div style="text-align:right;margin-top:4px"><button class="btn ghost" id="wa-janela" style="width:auto;font-size:11px">↗ abrir em janela separada</button></div>
      <div class="toast" id="wa-toast"></div></div>`;
    panel.querySelector('.full-wrap').appendChild(FRAME); wireHeader(); wireTabs(); pintaPend();
    $('#wa-janela').onclick=()=>{ send('janela.open'); };
  }
}
function sairCompleto(){ panel.classList.remove('largo'); handle.classList.remove('largo'); }

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
  bar.className='salvabar '+cls;
  bar.innerHTML=`<span class="sb-t">${txt}</span>${n?`<button class="btn" id="lp2-desc" ${sv?'disabled':''}>Descartar</button><button class="btn primary" id="lp2-salvar" ${sv?'disabled':''}>${sv?'Salvando…':st.st==='erro'?'↻ Tentar de novo':'💾 Salvar'}</button>`:''}`;
  const b=$('#lp2-salvar'); if(b) b.onclick=()=>salvarRascunho(CUR);
  const x=$('#lp2-desc'); if(x) x.onclick=()=>{ descartar(CUR); renderLpContato(CUR_ROW,CUR_CART); };
  panel.querySelectorAll('.lp2 .edit').forEach(e=>{ e.disabled=sv; });
}
/* 2.1: cada tópico do card rápido encolhe/estende (palavra dele); a escolha fica lembrada neste Chrome */
function dobAberto(k){ return DOB[k]!==false; }
function wireDob(){ panel.querySelectorAll('details.dob').forEach(d=>d.addEventListener('toggle',()=>{ DOB[d.dataset.k]=d.open; try{ chrome.storage.local.set({wa_crm_dob:DOB}); }catch(_){} })); }
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
  const ult=lpcUltimos(c0,5);
  const mud=k=>(k in D)?' mud':'';
  renderShell(`<div class="lp2">
    <div class="card">
      <h2>${esc(c.nome||'—')}</h2>
      <span class="badge" style="background:${LPC_COR[(atual&&atual.cor)||'cinza']||'#5b6770'}"><span class="dot"></span>${esc(funNome)} · ${esc((atual&&atual.label)||c.etapa||'—')}</span>
      <div class="muted">${esc(c0.telefone||'sem telefone')}${c.recomendante?' · rec. '+esc(c.recomendante):''}</div>
      <div class="muted" style="margin-top:4px">${VINC?`📌 ligado a esta conversa · <a href="#" id="lp2-desv">não é esta pessoa</a>`:`<a href="#" id="lp2-vinc">📌 ligar esta conversa a este negócio</a>`}</div>
      ${cartHit?`<div class="muted" style="margin-top:4px">📁 também na Carteira${cartHit.apolices&&cartHit.apolices.length?' · '+cartHit.apolices.length+' apólice(s)':''}</div>`:''}
    </div>
    <details class="card dob" data-k="etapa" ${dobAberto('etapa')?'open':''}>
      <summary class="sec-t">Etapa · status · listas <span class="dob-r">${esc((atual&&atual.label)||c.etapa||'')}${st?' · '+esc(st):''}${listas.length?' · 📋 '+listas.length:''}</span></summary>
      <div class="chips${mud('etapa')}">${fluxo.map(e=>`<button class="chip edit${e.id===c.etapa?' on':''}" data-etapa="${esc(e.id)}" style="${e.id===c.etapa?'background:'+(LPC_COR[e.cor]||'#2563eb')+';border-color:'+(LPC_COR[e.cor]||'#2563eb'):''}">${esc(e.label)}</button>`).join('')}</div>
      ${enc.length?`<div class="enc-l">Encerrar: ${enc.map(e=>`<button class="chip enc edit${e.id===c.etapa?' on':''}" data-etapa="${esc(e.id)}">${esc(e.label)}</button>`).join('')}</div>`:''}
      <div class="field${mud('status')}" style="margin-top:8px"><label>${ehEnc?'✖ Motivo da perda':'⚑ Status nesta etapa'}</label>
        ${opts.length?`<select id="lp2-status" class="edit ${ehEnc&&!st?'destaque':''}">${orf?`<option value="" selected>⚠ ${esc(orf)} (saiu da lista)</option>`:''}<option value="">${ehEnc?'— escolha o motivo —':'— sem status —'}</option>${opts.map(o=>`<option ${o===st?'selected':''}>${esc(o)}</option>`).join('')}</select>`
          :`<div class="muted">${ehEnc?'nenhum motivo cadastrado':'esta etapa não tem status'} — cadastre em Funil &amp; Etapas no CRM</div>`}</div>
      <div class="field${mud('listas')}"><label>📋 Listas de TA</label>
        <div class="chips">${listas.map(n=>`<span class="lchip">${esc(n)}<button class="lx edit" data-tira="${esc(n)}" title="Tirar desta lista">✕</button></span>`).join('')||'<span class="muted">sem lista</span>'}</div>
        <select id="lp2-lista" class="edit" style="margin-top:6px"><option value="">＋ pôr numa lista…</option>${cat.filter(n=>!listas.includes(n)).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}${listas.length?`<optgroup label="Mover (sai das outras)">${cat.filter(n=>!listas.includes(n)).map(n=>`<option value="mv:${esc(n)}">↪ só em ${esc(n)}</option>`).join('')}</optgroup>`:''}<option value="__nova">＋ Nova lista…</option></select></div>
    </details>
    <details class="card dob" data-k="nota" ${dobAberto('nota')||('nota' in D)?'open':''}>
      <summary class="sec-t">📝 Registrar na oportunidade <span class="dob-r">${('nota' in D)?'nota não salva':ult.length?ult.length+' registros':''}</span></summary>
      <textarea id="lp2-nota" class="edit${mud('nota')}" placeholder="o que rolou nesta conversa (vai pro histórico da oportunidade quando você Salvar)">${esc(D.nota||'')}</textarea>
      ${ult.length?`<div class="hist">${ult.map(x=>`<div class="hi"><span class="hd">${esc(String(x.dia||'').split('-').reverse().join('/'))}</span> ${esc(x.l||'')}</div>`).join('')}</div>`:''}
    </details>
    <details class="card dob" data-k="campos" ${DOB.campos===true||('tel' in D)||('notas' in D)?'open':''}><summary class="sec-t">Telefone e observação fixa</summary>
      <div class="field${mud('tel')}"><label>Telefone</label><input id="lp2-tel" class="edit" value="${esc(('tel' in D)?D.tel:(c0.telefone||''))}"></div>
      <div class="field${mud('notas')}"><label>Observação fixa (campo Notas)</label><textarea id="lp2-notas" class="edit">${esc(('notas' in D)?D.notas:(c0.notas||''))}</textarea></div>
    </details>
    ${msgCardHTML()}
    <div class="note">Mesmo cadastro do CRM (Funil &amp; Etapas, listas de TA). Mude o que precisar e toque em <b>💾 Salvar</b> — nada vai pro CRM antes disso.</div>
    <div class="salvabar" id="lp2-barra"></div>
  </div>`,id);
  wireMsgCard(c); wireDob(); pintaBarra();
  { const a=$('#lp2-vinc'); if(a) a.onclick=e=>{ e.preventDefault(); vincular(row); };
    const b=$('#lp2-desv'); if(b) b.onclick=e=>{ e.preventDefault(); desvincular(); }; }
  const redesenha=()=>{ if(SAVE_ST[id]&&SAVE_ST[id].st!=='salvando') delete SAVE_ST[id]; renderLpContato(CUR_ROW,CUR_CART); };
  const limpaIgual=()=>{ /* voltou ao que está no banco? então não é mudança */
    if('etapa' in D&&D.etapa===c0.etapa){ delete D.etapa; }
    if('status' in D&&lpcStatusDe(cfg,previa(c0,D,'status'))===D.status) delete D.status;
    if('listas' in D&&mesmoSet(D.listas,Array.isArray(previa(c0,D,'listas').listas)?previa(c0,D,'listas').listas:[])) delete D.listas; };
  panel.querySelectorAll('[data-etapa]').forEach(b=>b.onclick=()=>{ const para=b.dataset.etapa; if(para===c.etapa) return; const e=etapas.find(x=>x.id===para);
    D.etapa=para; delete D.status;                            /* mudar etapa limpa o status (regra do app) */
    if(e&&e.enc){ D.listas=[]; D._encL=true; } else if(D._encL){ delete D.listas; delete D._encL; }
    limpaIgual(); redesenha(); });
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
  if(ehEnc&&ss&&!st) try{ ss.focus(); }catch(_){}
}
// Estoque (funil 'bn'): nome ainda não é negócio — card enxuto: listas de TA + nota (vai pras notas do Estoque)
function renderLpEstoque(row){
  const c=row.dados||{}, listas=Array.isArray(c.listas)?c.listas:[], cat=[...listas,...LPCFG.listas.filter(n=>!listas.includes(n))];
  renderShell(`<div class="lp2">
    <div class="card"><h2>${esc(c.nome||'—')}</h2><span class="badge" style="background:#64748b"><span class="dot"></span>📦 Estoque de Nomes</span>
      <div class="muted">${esc(c.telefone||'sem telefone')}${c.recomendante?' · rec. '+esc(c.recomendante):''}</div></div>
    <div class="card"><div class="field"><label>📋 Listas de TA</label>
      <div class="chips">${listas.map(n=>`<span class="lchip">${esc(n)}<button class="lx" data-tira="${esc(n)}">✕</button></span>`).join('')||'<span class="muted">sem lista</span>'}</div>
      <select id="lp2-lista" style="margin-top:6px"><option value="">＋ pôr numa lista…</option>${cat.filter(n=>!listas.includes(n)).map(n=>`<option value="${esc(n)}">${esc(n)}</option>`).join('')}</select></div>
      <textarea id="lp2-nota" placeholder="nota (vai pras notas do nome no Estoque)"></textarea>
      <button class="btn primary" id="lp2-nota-ok" style="margin-top:6px">Registrar nota</button></div>
    <div class="note">Nome do <b>Estoque</b>: pra virar negócio, use "levar pro funil" no CRM (Painel TA / Estoque).</div>
    ${msgCardHTML()}</div>`);
  wireMsgCard(c);
  panel.querySelectorAll('[data-tira]').forEach(b=>b.onclick=()=>{ const n=b.dataset.tira; lpcAcaoBn(row,[{tipo:'listas',para:listas.filter(x=>x!==n)}],`✓ Saiu de “${n}”`); });
  const sl=$('#lp2-lista'); if(sl) sl.onchange=()=>{ const v=sl.value; if(v) lpcAcaoBn(row,[{tipo:'listas',para:[...listas,v]}],`✓ Em “${v}”`); };
  $('#lp2-nota-ok').onclick=()=>{ const t=$('#lp2-nota').value.trim(); if(!t){ toast('Escreva a nota primeiro.'); return; } lpcAcaoBn(row,[{tipo:'nota',texto:t}],'✓ Nota registrada'); };
}
async function lpcAcaoBn(row,acoes,okMsg){ if(BUSY) return; BUSY=true; const seq=LOOKSEQ; const r=await send('lpc.patch',{id:row.id,acoes}); BUSY=false;
  if(!handleAuthFail(r)) return;
  if(seq!==LOOKSEQ){ toast(r.ok?'✓ Salvo: '+((row.dados&&row.dados.nome)||'nome do Estoque'):'✖ Não salvou: '+(r.error||'erro')); return; }   /* trocou de conversa: não pinta o card velho por cima */
  if(r.ok){ renderLpEstoque(r.data); toast(okMsg); } else toast('Erro: '+(r.error||'falha ao salvar')); }
function renderLpContatoPicker(list){
  renderShell(`<div class="note">${list.length} contatos parecidos no funil LP — escolha:</div>`+
    list.map((r,i)=>{ const c=r.dados||{}; const e=lpcEtapaDe(LPCFG.funil,c);
      return `<div class="pick" data-i="${i}"><b>${esc(c.nome||'—')}</b><br>
      <span class="muted">${esc((e&&e.label)||c.etapa||'—')} · ${esc(c.telefone||'sem telefone')}</span></div>`; }).join(''));
  panel.querySelectorAll('.pick').forEach(el=>{ el.onclick=()=>{ const x=list[+el.dataset.i]; renderLpContato(x); vincular(x); }; });
}
function renderLpCreate(sugestoes){
  const chatPhone=CHAT&&CHAT.phoneRaw?normPhone(CHAT.phoneRaw):null;
  renderShell(`
    ${sugestoes&&sugestoes.length?`<div class="note"><b>Parecidos no funil LP</b> — confira antes de criar:</div>`+
      sugestoes.map((r,i)=>{ const cc=r.dados||{}; return `<div class="pick" data-lpsug="${i}"><b>${esc(cc.nome||'—')}</b><br>
        <span class="muted">${esc(LPC_FUNIS[lpcFunilDe(cc)].label)} · ${esc(cc.etapa||'—')} · ${esc(cc.telefone||'sem telefone')}</span></div>`; }).join(''):''}
    <div class="card">
      <h2 style="margin-bottom:8px">+ Novo contato na Visão LP</h2>
      ${fieldHTML('wa-lpn-nome','Nome',CHAT&&CHAT.name||'')}
      ${fieldHTML('wa-lpn-tel','Telefone',chatPhone?chatPhone.telefone:'')}
      <div class="field"><label>Funil</label><select id="wa-lpn-funil">
        <option value="nn">Novos Negócios (nasce em SitPlan)</option>
        <option value="bc">Base de Clientes (nasce em Clientes Ativos)</option></select></div>
      <div class="field"><label>Notas</label><textarea id="wa-lpn-notas"></textarea></div>
      <button class="btn primary" id="wa-lpn-save">＋ Criar na Visão LP</button>
    </div>
    <div class="note">Ou, se for recrutamento (candidato a LP):</div>
    <button class="btn" id="wa-lp-to-cap">➕ Criar como lead de Captação</button>
  `);
  panel.querySelectorAll('[data-lpsug]').forEach(el=>{ el.onclick=()=>{ const x=sugestoes[+el.dataset.lpsug]; renderLpContato(x); vincular(x); }; });
  $('#wa-lp-to-cap').onclick=()=>{ VIEW='captacao'; saveView(); LEAD=null; lookup(); };
  $('#wa-lpn-save').onclick=async()=>{
    const nome=$('#wa-lpn-nome').value.trim();
    if(!nome){ toast('Nome é obrigatório.'); return; }
    if(BUSY) return; BUSY=true; $('#wa-lpn-save').disabled=true;
    // shape completo do vendas.html vem do lpcNovoContato (normalize.js) — aqui
    // só o que a UI coletou; nada de subconjunto (era o que quebrava o drawer).
    const dados=lpcNovoContato({ nome, telefone:$('#wa-lpn-tel').value.trim()||null,
      funil:$('#wa-lpn-funil').value, notas:$('#wa-lpn-notas').value });
    const r=await send('lpc.save',{id:dados.id,dados});
    BUSY=false;
    if(!handleAuthFail(r)) return;
    if(r.ok){ renderLpContato(r.data); vincular(r.data); toast('✓ Contato criado na Visão LP'); }
    else { $('#wa-lpn-save').disabled=false; toast('Erro: '+(r.error||'falha ao criar')); }
  };
}

// ---------- wiring comum ----------
function wireHeader(){
  $('#wa-close').onclick=()=>setOpen(false);
  const lg=$('#wa-logout');
  if(lg) lg.onclick=async()=>{ await send('auth.logout'); AUTH={logged:false,email:'',usuario:''}; refreshFab(); renderLogin(); };
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
  if(MODO==='completo'){ if(!panel.querySelector('.full-wrap')) renderCompleto(); return; }   /* 2.3: iframe vivo; a troca de conversa vai pelo wa.chat */
  if(!AUTH.logged){ renderLogin(); return; }
  if(!c){ renderNoChat(); return; }
  if(c.isGroup){ renderGroup(); return; }
  renderLoading();
  if(VIEW==='lp'){ // Visão LP: contato do funil (telefone → nome forte) → Estoque → Carteira → criar
    let contatos=[],carteira=[],byName=null,estoque=[];
    const [r]=await Promise.all([send('lp.lookup',{phone:c.phoneRaw||'',name:c.name||'',keys:chatKeys(c)}),loadLpCfg()]);
    VINC=!!(r&&r.ok&&r.data&&r.data.vinculo);
    if(seq!==LOOKSEQ) return;                    /* já trocou de conversa: esta resposta é de outra pessoa */
    if(!handleAuthFail(r)) return;
    if(r.ok&&r.data){ contatos=r.data.contatos||[]; carteira=r.data.carteira||[]; byName=r.data.byName; estoque=r.data.estoque||[]; }
    if(!contatos.length&&!(byName&&byName.strong)&&estoque.length===1){ renderLpEstoque(estoque[0]); return; }
    if(contatos.length===1) renderLpContato(contatos[0],carteira[0]||null);
    else if(contatos.length>1) renderLpContatoPicker(contatos);
    else if(byName&&byName.strong){ renderLpContato(byName.strong,carteira[0]||null); toast('Casado pelo NOME do contato — confira se é a pessoa certa'); }
    else if(carteira.length===1) renderLpCliente(carteira[0]);
    else if(carteira.length>1) renderLpPicker(carteira);
    else renderLpCreate((byName&&byName.sugestoes)||[]);
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

fab.onclick=()=>{
  if(MODO==='completo'){ setOpen(true); renderCompleto(); avisaConversa(CHAT); return; }   /* 2.3: dentro do painel */
  setOpen(true); lookup(); };
// painel lateral → "⚡ Rápido": volta pro card dentro do WhatsApp
try{ chrome.runtime.onMessage.addListener(m=>{ if(m&&m.type==='wa.modo'&&m.modo==='rapido'){ MODO='rapido'; sairCompleto(); try{ chrome.storage.local.set({wa_crm_modo:MODO}); }catch(_){} setOpen(true); lookup(); } }); }catch(_){}
handle.onclick=()=>setOpen(false);

// boot
try{ const o=await chrome.storage.local.get(['wa_crm_modo','wa_crm_dob']); if(o&&o.wa_crm_modo==='completo') MODO='completo';   /* 2.3: o completo abre dentro do painel, sem depender de gesto */ if(o&&o.wa_crm_dob&&typeof o.wa_crm_dob==='object') DOB=o.wa_crm_dob; }catch(_){}
const st=await send('auth.status');
if(st.ok&&st.data.logged){ AUTH={logged:true,email:st.data.email,usuario:st.data.usuario}; loadFunil(); loadMsgs(); loadLpCfg(); }
refreshFab();
WA_DOM.observe(c=>{ CHAT=c; LEAD=null; avisaConversa(c); lookup(); });   /* avisa o painel lateral e o card rápido */
})();
