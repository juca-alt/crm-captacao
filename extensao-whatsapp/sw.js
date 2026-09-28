// ===== SERVICE WORKER — todo tráfego de rede da extensão passa aqui =====
// Content script só mexe em DOM/UI; fetch fica no SW (host_permissions isenta de
// CORS e do CSP do WhatsApp; tokens nunca tocam o contexto da página).
importScripts('config.js','normalize.js','crm-api.js');

const HANDLERS={
  'auth.status': async ()=>{ const s=await getSession(); return s?{logged:true,email:s.user_email,usuario:s.usuario}:{logged:false}; },
  'auth.login':  (m)=>login(m.email,m.password),
  'auth.logout': ()=>logout(),
  'funil.get':   ()=>getFunilCfg(),
  'msg.templates':()=>getMsgTemplates(),
  'msg.save':    (m)=>saveMsgTemplates(m.templates),
  'leads.findByPhone': (m)=>findByPhone(m.phone),
  'leads.findByName':  (m)=>findByName(m.name),
  'leads.searchByName':(m)=>searchByName(m.q),
  'leads.create':(m)=>waInsertLead(m.rec),
  'leads.update':(m)=>waUpdateLead(m.id,m.patch,m.before),
  'task.set':    (m)=>setTask(m.id,m.dateISO,m.texto,m.before),
  'lp.lookup':  (m)=>lpLookup(m.phone,m.name),
  'lp.search':  (m)=>lpSearchAll(m.q),
  'lpc.save':   (m)=>lpcSave(m.id,m.dados),
  'lpcfg.get':  (m)=>lpCfgGet(!!m.force),          // v2.0: Funil & Etapas + listas do app
  'lpc.patch':  (m)=>lpcPatch(m.id,m.acoes),        // v2.0: relê fresco, aplica a ação, grava só a linha
  // 2.2: card completo no PAINEL LATERAL do Chrome (fora da página do WhatsApp — ver content/embed.js)
  'sidepanel.open': (m,sender)=>abrirLateral(sender),
  'janela.open': (m,sender)=>abrirJanela(sender),
  // 2.3: o frame do CRM dentro do painel pede a ficha da conversa atual (no load e a cada troca)
  'wa.frame':    async (m,sender)=>{ const o=await chrome.storage.session.get('wa_chat_ult');
                   if(sender&&sender.tab) await injetaCrm({tabId:sender.tab.id,allFrames:true},(o&&o.wa_chat_ult)||null); return true; },   // 2.2.2: card completo numa JANELA do CRM ao lado (não depende do painel lateral)
  'wa.chat':    (m)=>{ const u={tel:String(m.tel||''),nome:String(m.nome||''),grupo:!!m.grupo,ts:Date.now()};
                       return chrome.storage.session.set({wa_chat_ult:u}).then(()=>janelaAvisa(u)).then(()=>true); },
};

/* ===== 2.2.2: CARD COMPLETO NUMA JANELA DO CRM =====
   O painel lateral dependia do "gesto" atravessar content script → SW, e o iframe dentro dele é terceiro (login à parte).
   A janela é o próprio vendas.html?wa=1 como página de verdade: nada a barrar, o login do CRM no Chrome já vale, e
   trocar de conversa chama waAbrir() direto na página (executeScript no mundo da página), sem recarregar. */
const CRM_WA='https://juca-alt.github.io/crm-captacao/vendas.html?wa=1';
async function janelaViva(){
  const o=await chrome.storage.session.get('wa_janela'); const j=o&&o.wa_janela; if(!j) return null;
  try{ const t=await chrome.tabs.get(j.tab); if(t&&t.windowId===j.win) return j; }catch(_){}
  await chrome.storage.session.remove('wa_janela'); return null;
}
async function abrirJanela(sender){
  const o=await chrome.storage.session.get('wa_chat_ult'); const u=(o&&o.wa_chat_ult)||{};
  const viva=await janelaViva();
  if(viva){ await chrome.windows.update(viva.win,{focused:true}); await janelaAvisa(u); return true; }
  let left, top, height=900; const W=480;
  try{ const w=sender&&sender.tab?await chrome.windows.get(sender.tab.windowId):null;
       if(w){ left=Math.max(0,w.left+w.width-W); top=w.top; height=w.height; } }catch(_){}
  const hash=(u.tel||u.nome)&&!u.grupo?'#tel='+encodeURIComponent(u.tel||'')+'&nome='+encodeURIComponent(u.nome||''):'';
  const w=await chrome.windows.create({url:CRM_WA+hash,type:'popup',width:W,height,left,top,focused:true});
  const tabId=w.tabs[0].id;
  await chrome.storage.session.set({wa_janela:{win:w.id,tab:tabId}});
  /* espera a página carregar e manda o negócio já achado pela extensão (telefone OU nome com as etiquetas do WhatsApp) */
  await new Promise(res=>{ const fim=setTimeout(()=>{ chrome.tabs.onUpdated.removeListener(ou); res(); },20000);
    function ou(id,info){ if(id===tabId&&info.status==='complete'){ clearTimeout(fim); chrome.tabs.onUpdated.removeListener(ou); res(); } }
    chrome.tabs.onUpdated.addListener(ou); });
  await janelaAvisa(u);
  return true;
}
/* 2.2.3: quem ACHA o negócio é a extensão (mesma busca do card rápido: telefone → nome tolerante às etiquetas
   "Fulano Rec Ciclano Med…"). O CRM só abre a ficha pelo id — antes ele procurava só pelo telefone e, com o nome
   cheio de etiquetas, dizia "nenhum negócio" pra cliente que está no CRM. */
/* acha o negócio (telefone → nome tolerante às etiquetas), mesma busca do card rápido */
async function alvoDe(tel,nome){
  if(!tel&&!nome) return null;
  try{ const r=await lpLookup(tel,nome);
    const c=(r.contatos&&r.contatos[0])||(r.byName&&r.byName.strong)||null;
    if(c) return {tipo:'fun',ids:[String(c.id),String((c.dados&&c.dados.id)||'')]};
    if(r.estoque&&r.estoque.length===1){ const b=r.estoque[0]; return {tipo:'bn',ids:[String(b.id),String((b.dados&&b.dados.id)||'')]}; }
  }catch(_){}
  return null;
}
/* roda DENTRO do vendas.html (mundo da página): abre a ficha pelo id; sem alvo, cai no waAbrir do próprio CRM */
function ABRIR_NO_CRM(t,n,a){
  if(location.hostname!=='juca-alt.github.io') return;   /* allFrames: só o frame do CRM */
  const cai=()=>{ if(typeof waAbrir==='function') waAbrir({tipo:'wa-abrir',tel:t,nome:n}); };
  let k=0;
  const vai=()=>{
    if(typeof abrirContato!=='function'){ if(k++<40) setTimeout(vai,500); return; }   /* app ainda subindo */
    if(!a){ cai(); return; }
    try{ clearTimeout(_waTimer); _waTent=0; }catch(_){}
    let lista=[]; try{ lista=a.tipo==='bn'?((typeof bnVivos==='function')?bnVivos():[]):(S.contatos||[]); }catch(_){}
    const achou=lista.find(c=>a.ids.includes(String(c.id)));
    if(achou){ try{ WA_ULT={tel:t,nome:n}; }catch(_){}
      if(a.tipo==='bn'){ try{ fecharDrawerSo(); }catch(_){} taFichaAbrir(achou.id); }
      else { const ta=document.getElementById('ta-ficha'); if(ta) ta.remove(); abrirContato(achou.id); }
      return; }
    if(k++<25) setTimeout(vai,700); else cai();   /* base ainda chegando do servidor */
  };
  vai();
}
async function injetaCrm(target,u){
  const tel=(!u||u.grupo)?'':String(u.tel||''), nome=(!u||u.grupo)?'':String(u.nome||'');
  const a=await alvoDe(tel,nome);
  try{ await chrome.scripting.executeScript({target,world:'MAIN',args:[tel,nome,a],func:ABRIR_NO_CRM}); }catch(_){}
}
async function janelaAvisa(u){ const j=await janelaViva(); if(!j||!u) return; await injetaCrm({tabId:j.tab},u); }

/* sidePanel.open() só vale DENTRO do gesto do usuário: é a 1ª coisa chamada, sem await antes (o clique no botão do
   painel do WhatsApp chega aqui pelo sendMessage e o gesto vem junto). */
function abrirLateral(sender){
  const tab=sender&&sender.tab;
  if(!tab||!chrome.sidePanel||!chrome.sidePanel.open) return Promise.reject(new Error('Este Chrome não tem painel lateral (precisa do Chrome 116+).'));
  const p=chrome.sidePanel.open({windowId:tab.windowId});
  return p.then(()=>true);
}
// ícone da extensão na barra do Chrome também abre o card completo
try{ chrome.sidePanel.setPanelBehavior({openPanelOnActionClick:true}).catch(()=>{}); }catch(_){}

// Extensão recarregada/atualizada → reinjeta o painel nas abas do WhatsApp já
// abertas. Sem isso o content script antigo fica órfão ("Extension context
// invalidated") até o usuário dar F5 na página. O panel.js novo remove a UI
// órfã no boot, então reinjetar é idempotente.
chrome.runtime.onInstalled.addListener(async()=>{
  try{
    const tabs=await chrome.tabs.query({url:'https://web.whatsapp.com/*'});
    for(const t of tabs){
      try{
        await chrome.scripting.executeScript({target:{tabId:t.id},
          files:['config.js','normalize.js','content/wa-dom.js','content/panel.js']});
      }catch(_){/* aba descarregada/suspensa — o F5 manual resolve essa */}
    }
  }catch(_){}
});

chrome.runtime.onMessage.addListener((msg,_sender,sendResponse)=>{
  const h=HANDLERS[msg&&msg.type];
  if(!h){ sendResponse({ok:false,error:'mensagem desconhecida: '+(msg&&msg.type)}); return; }
  let pr; try{ pr=h(msg,_sender); }catch(e){ pr=Promise.reject(e); }
  Promise.resolve(pr)
    .then(data=>sendResponse({ok:true,data}))
    .catch(e=>sendResponse({ok:false,code:e&&e.code,error:(e&&e.message)||String(e)}));
  return true; // resposta assíncrona
});
