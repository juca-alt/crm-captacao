// ===== PAINEL — card do lead ao lado da conversa aberta =====
// UI em Shadow DOM (isolada do CSS/React do WhatsApp). Toda rede via SW
// (chrome.runtime.sendMessage). Estados: deslogado → sem-chat → buscando →
// match / sem-match(criar) / multiplos(escolher) / grupo. Busca manual sempre
// disponível (fallback quando o DOM do WhatsApp mudar).

(async()=>{
if(window.__waCrmPanelLoaded) return; window.__waCrmPanelLoaded=true;

// ---------- bridge com o service worker ----------
function send(type,payload){
  return new Promise(res=>{
    try{
      chrome.runtime.sendMessage(Object.assign({type},payload||{}),r=>{
        if(chrome.runtime.lastError) res({ok:false,error:chrome.runtime.lastError.message});
        else res(r||{ok:false,error:'sem resposta do service worker'});
      });
    }catch(e){ res({ok:false,error:String(e)}); }
  });
}

// ---------- shadow DOM ----------
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

const $=(sel)=>panel.querySelector(sel);

// ---------- estado ----------
let AUTH={logged:false,email:'',usuario:''};
let FUNIL=buildFunnel(null);        // fallback; substituído pelo funil_cfg do banco
let CHAT=null;                      // conversa aberta (wa-dom)
let LEAD=null;                      // lead em exibição
let OPEN=false;
let BUSY=false;

function toast(msg){
  const t=$('#wa-toast'); if(!t) return;
  t.textContent=msg; t.classList.add('on');
  clearTimeout(toast._tm); toast._tm=setTimeout(()=>t.classList.remove('on'),2600);
}

// ---------- blocos de UI ----------
function headerHTML(){
  return `<div class="ph"><b>Captação · CRM</b><span class="sub">${esc(EXT_VERSION)}</span>
    ${AUTH.logged?`<button class="btn ghost" id="wa-logout" style="color:#cbd5e1">sair</button>`:''}
    <button class="x" id="wa-close" title="Fechar">×</button></div>`;
}
function searchHTML(){
  return `<div class="search"><input id="wa-q" placeholder="Buscar lead por nome ou telefone…">
    <button class="btn" id="wa-q-go" style="width:auto">🔍</button></div>`;
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
  return `<select id="${id}">${vazio}${ORIGEM_OPTS.map(o=>`<option ${o===(val||(comVazio?'':'WhatsApp'))?'selected':''}>${esc(o)}</option>`).join('')}</select>`;
}
function fieldHTML(id,label,val,ph){
  return `<div class="field"><label>${esc(label)}</label><input id="${id}" value="${esc(val||'')}" placeholder="${esc(ph||'')}"></div>`;
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
    if(!r.ok){ const e=$('#wa-login-err'); e.textContent=r.error||'Falha no login'; e.style.display='block'; return; }
    AUTH={logged:true,email:r.data.email,usuario:r.data.usuario};
    await loadFunil();
    refreshFab();
    lookup();
  };
  $('#wa-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#wa-login').click(); });
}

function renderShell(innerHTML){
  panel.innerHTML=headerHTML()+`<div class="pb">${searchHTML()}${innerHTML}<div class="toast" id="wa-toast"></div></div>`;
  wireHeader(); wireSearch();
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
    <div class="card">
      <div class="field"><label>Próxima ação (follow-up)</label><input id="wa-task-date" type="date" value="${esc((l.data_proxima_acao||'').slice(0,10))}"></div>
      <div class="field"><label>Descrição da tarefa</label><input id="wa-task-txt" placeholder="ex.: retornar ligação"></div>
      <button class="btn" id="wa-task-save">📅 Agendar</button>
    </div>
    ${sugestoes&&sugestoes.length?`<div class="note">Outros parecidos: ${sugestoes.map(s=>esc(s.nome+' ('+(s.codigo||'#'+s.id)+')')).join(' · ')}</div>`:''}
  `);
  wireEtapaStatus('wa-es');
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

// ---------- wiring comum ----------
function wireHeader(){
  $('#wa-close').onclick=()=>{ OPEN=false; panel.classList.add('hidden'); };
  const lg=$('#wa-logout');
  if(lg) lg.onclick=async()=>{ await send('auth.logout'); AUTH={logged:false,email:'',usuario:''}; refreshFab(); renderLogin(); };
}
function wireSearch(){
  const go=async()=>{
    const q=$('#wa-q').value.trim(); if(!q) return;
    renderLoading();
    const r=await send('leads.searchByName',{q});
    if(!handleAuthFail(r)) return;
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
  if(!AUTH.logged){ renderLogin(); return; }
  const c=CHAT;
  if(!c){ renderNoChat(); return; }
  if(c.isGroup){ renderGroup(); return; }
  renderLoading();
  let matches=[];
  if(c.phoneRaw){
    const r=await send('leads.findByPhone',{phone:c.phoneRaw});
    if(!handleAuthFail(r)) return;
    matches=(r.ok&&r.data)||[];
  }
  if(matches.length===1){ LEAD=matches[0]; renderLead(); return; }
  if(matches.length>1){ renderPicker(matches,'Mais de um lead com esse telefone — escolha (e unifique em Duplicatas no CRM):'); return; }
  // sem match por telefone → sugestões por nome (nunca confidente, igual findLeadMatch)
  let sugestoes=[];
  if(c.name){
    const r=await send('leads.searchByName',{q:c.name});
    if(!handleAuthFail(r)) return;
    sugestoes=((r.ok&&r.data)||[]).slice(0,5); // sugestão apenas — nome nunca trava criação
  }
  renderCreate(sugestoes);
}

fab.onclick=()=>{
  OPEN=!OPEN;
  panel.classList.toggle('hidden',!OPEN);
  if(OPEN) lookup();
};

// boot
const st=await send('auth.status');
if(st.ok&&st.data.logged){ AUTH={logged:true,email:st.data.email,usuario:st.data.usuario}; loadFunil(); }
refreshFab();
WA_DOM.observe(c=>{ CHAT=c; LEAD=null; lookup(); });
})();
