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
  'janela.open': (m,sender)=>abrirJanela(sender),   // 2.2.2: card completo numa JANELA do CRM ao lado (não depende do painel lateral)
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
  await chrome.storage.session.set({wa_janela:{win:w.id,tab:w.tabs[0].id}});
  return true;
}
async function janelaAvisa(u){
  const j=await janelaViva(); if(!j||!u) return;
  const tel=u.grupo?'':String(u.tel||''), nome=u.grupo?'':String(u.nome||'');
  try{ await chrome.scripting.executeScript({target:{tabId:j.tab},world:'MAIN',args:[tel,nome],
    func:(t,n)=>{ if(typeof waAbrir==='function') waAbrir({tipo:'wa-abrir',tel:t,nome:n}); }}); }catch(_){}
}

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
