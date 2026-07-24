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
let VIEW='captacao';                // 'captacao' (leads) | 'lp' (Carteira) — persiste no chrome.storage
function saveView(){ try{ chrome.storage.local.set({wa_crm_view:VIEW}); }catch(_){} }

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
  const ph=VIEW==='lp'?'Buscar cliente da Carteira por nome…':'Buscar lead por nome ou telefone…';
  return `<div class="search"><input id="wa-q" placeholder="${ph}">
    <button class="btn" id="wa-q-go" style="width:auto">🔍</button></div>`;
}
function tabsHTML(){
  return `<div class="tabs">
    <button class="tab ${VIEW==='captacao'?'on':''}" data-view="captacao">Captação</button>
    <button class="tab lp ${VIEW==='lp'?'on':''}" data-view="lp">Visão LP</button></div>`;
}
function wireTabs(){
  panel.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{
    if(VIEW===b.dataset.view) return;
    VIEW=b.dataset.view; saveView(); LEAD=null; lookup();
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

// ---------- modelos de mensagem (mesmos do CRM; copiar → colar → enviar manual) ----------
let MSGS=MSG_TPL_DEFAULT;
async function loadMsgs(){ const r=await send('msg.templates'); if(r&&r.ok&&Array.isArray(r.data)&&r.data.length) MSGS=r.data; }
function msgCardHTML(){
  if(!MSGS.length) return '';
  return `<div class="card"><b style="font-size:12px;color:var(--muted)">MENSAGENS PRONTAS</b>
    <div class="field" style="margin-top:6px"><select id="wa-msg-sel">${MSGS.map((t,i)=>`<option value="${i}">${esc(t.nome)}</option>`).join('')}</select></div>
    <button class="btn" id="wa-msg-copy">📋 Copiar preenchida</button>
    <p class="muted" style="margin-top:6px;font-size:11px">Copia com os dados do lead — colar e enviar é com você (anti-ban).</p></div>`;
}
function wireMsgCard(l){
  const btn=$('#wa-msg-copy'); if(!btn) return;
  btn.onclick=async()=>{
    const t=MSGS[+($('#wa-msg-sel')&&$('#wa-msg-sel').value||0)]; if(!t) return;
    const txt=fillTpl(t.texto,l);
    try{ await navigator.clipboard.writeText(txt); toast('✓ Mensagem copiada — '+(firstName(l.nome)||'')); }
    catch(_){ toast('Não consegui copiar — clique na conversa e tente de novo.'); }
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
    if(!r.ok){ const e=$('#wa-login-err'); e.textContent=r.error||'Falha no login'; e.style.display='block'; return; }
    AUTH={logged:true,email:r.data.email,usuario:r.data.usuario};
    await loadFunil(); loadMsgs();
    refreshFab();
    lookup();
  };
  $('#wa-pass').addEventListener('keydown',e=>{ if(e.key==='Enter') $('#wa-login').click(); });
}

function renderShell(innerHTML){
  panel.innerHTML=headerHTML()+`<div class="pb">${tabsHTML()}${searchHTML()}${innerHTML}<div class="toast" id="wa-toast"></div></div>`;
  wireHeader(); wireSearch(); wireTabs();
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

// ---------- Visão LP · contato do FUNIL (lp_contatos, sync do vendas.html) ----------
function renderLpContato(row,cartHit){
  const c=row.dados||{};
  const fk=lpcFunilDe(c), fun=LPC_FUNIS[fk];
  renderShell(`
    <div class="card">
      <h2>${esc(c.nome||'—')}</h2>
      <span class="badge" style="background:${fun.cor}"><span class="dot"></span>${esc(fun.label)}</span>
      <div class="muted">${esc(c.telefone||'sem telefone')}${c.lp?' · LP: '+esc(c.lp):''}${c.taStatus&&c.taStatus!=='—'?' · TA: '+esc(c.taStatus):''}</div>
      ${cartHit?`<div class="muted" style="margin-top:4px">📁 também na Carteira${cartHit.apolices&&cartHit.apolices.length?' · '+cartHit.apolices.length+' apólice(s)':''}</div>`:''}
    </div>
    <div class="card">
      <div class="field"><label>Etapa (${esc(fun.label)})</label>
        <select id="wa-lpc-etapa">${fun.etapas.map(e=>`<option ${e===c.etapa?'selected':''}>${esc(e)}</option>`).join('')}</select></div>
      ${fieldHTML('wa-lpc-tel','Telefone',c.telefone)}
      <div class="field"><label>Notas</label><textarea id="wa-lpc-notas">${esc(c.notas||'')}</textarea></div>
      <button class="btn primary" id="wa-lpc-save">💾 Salvar na Visão LP</button>
    </div>
    ${msgCardHTML()}
    <div class="note">Sincroniza com o funil do vendas.html (tabela lp_contatos) — o app pega as mudanças ao recarregar.</div>
  `);
  wireMsgCard(c);
  $('#wa-lpc-save').onclick=async()=>{
    if(BUSY) return;
    const novo=Object.assign({},c,{
      etapa:$('#wa-lpc-etapa').value,
      telefone:$('#wa-lpc-tel').value.trim()||null,
      notas:$('#wa-lpc-notas').value
    });
    if(JSON.stringify(novo)===JSON.stringify(c)){ toast('Nada mudou.'); return; }
    BUSY=true; $('#wa-lpc-save').disabled=true;
    const r=await send('lpc.save',{id:row.id,dados:novo});
    BUSY=false;
    if(!handleAuthFail(r)) return;
    if(r.ok){ renderLpContato(r.data,cartHit); toast('✓ Salvo na Visão LP'); }
    else { $('#wa-lpc-save').disabled=false; toast('Erro: '+(r.error||'falha ao salvar')); }
  };
}
function renderLpContatoPicker(list){
  renderShell(`<div class="note">${list.length} contatos parecidos no funil LP — escolha:</div>`+
    list.map((r,i)=>{ const c=r.dados||{}; const fun=LPC_FUNIS[lpcFunilDe(c)];
      return `<div class="pick" data-i="${i}"><b>${esc(c.nome||'—')}</b><br>
      <span class="muted">${esc(fun.label)} · ${esc(c.etapa||'—')} · ${esc(c.telefone||'sem telefone')}</span></div>`; }).join(''));
  panel.querySelectorAll('.pick').forEach(el=>{ el.onclick=()=>renderLpContato(list[+el.dataset.i]); });
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
  panel.querySelectorAll('[data-lpsug]').forEach(el=>{ el.onclick=()=>renderLpContato(sugestoes[+el.dataset.lpsug]); });
  $('#wa-lp-to-cap').onclick=()=>{ VIEW='captacao'; saveView(); LEAD=null; lookup(); };
  $('#wa-lpn-save').onclick=async()=>{
    const nome=$('#wa-lpn-nome').value.trim();
    if(!nome){ toast('Nome é obrigatório.'); return; }
    if(BUSY) return; BUSY=true; $('#wa-lpn-save').disabled=true;
    const fk=$('#wa-lpn-funil').value, now=new Date().toISOString();
    const id='wa'+Date.now();
    const dados={ id, lp:'gustavo', nome, telefone:$('#wa-lpn-tel').value.trim()||null,
      etapa:fk==='bc'?'Clientes Ativos':'SitPlan', funil:fk, notas:$('#wa-lpn-notas').value,
      taStatus:'—', taTentativas:0, estrelas:0, ance:{}, recs:[], eventos:[], planos:[], interacoes:[],
      criadoEm:now, origemCadastro:'whatsapp-ext' };
    const r=await send('lpc.save',{id,dados});
    BUSY=false;
    if(!handleAuthFail(r)) return;
    if(r.ok){ renderLpContato(r.data); toast('✓ Contato criado na Visão LP'); }
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
    renderLoading();
    const r=await send(VIEW==='lp'?'lp.search':'leads.searchByName',{q});
    if(!handleAuthFail(r)) return;
    if(VIEW==='lp'){
      const d=(r.ok&&r.data)||{}, cs=d.contatos||[], ct=d.carteira||[];
      if(cs.length===1) renderLpContato(cs[0],ct[0]||null);
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
  if(VIEW==='lp'){ // Visão LP: contato do funil (telefone → nome forte) → Carteira → criar
    let contatos=[],carteira=[],byName=null;
    const r=await send('lp.lookup',{phone:c.phoneRaw||'',name:c.name||''});
    if(!handleAuthFail(r)) return;
    if(r.ok&&r.data){ contatos=r.data.contatos||[]; carteira=r.data.carteira||[]; byName=r.data.byName; }
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
    if(!handleAuthFail(r)) return;
    const d=(r.ok&&r.data)||{};
    if(d.strong){ LEAD=d.strong; renderLead(); toast('Casado pelo NOME do contato — confira se é a pessoa certa'); return; }
    sugestoes=d.sugestoes||[];
  }
  renderCreate(sugestoes);
}

fab.onclick=()=>{ setOpen(true); lookup(); };
handle.onclick=()=>setOpen(false);

// boot
try{ const o=await chrome.storage.local.get('wa_crm_view'); if(o&&o.wa_crm_view==='lp') VIEW='lp'; }catch(_){}
const st=await send('auth.status');
if(st.ok&&st.data.logged){ AUTH={logged:true,email:st.data.email,usuario:st.data.usuario}; loadFunil(); loadMsgs(); }
refreshFab();
WA_DOM.observe(c=>{ CHAT=c; LEAD=null; lookup(); });
})();
