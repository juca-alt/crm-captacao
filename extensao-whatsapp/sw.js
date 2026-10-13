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
  'lp.lookup':  (m)=>lpLookup(m.phone,m.name,m.keys),
  'lp.negocios':(m)=>lpNegocios(m.id),                // 2.6.0: negócios da mesma pessoa (+ empresas do VG)
  'lpc.um':     (m)=>lpcUm(m.id),
  'wa.vincular':(m)=>vincGravar(m.keys,m.id,m.nome),     // 2.4: conversa ↔ negócio
  'wa.desvincular':(m)=>vincTirar(m.keys,m.id),
  'lp.search':  (m)=>lpSearchAll(m.q),
  'lpc.save':   (m)=>lpcSave(m.id,m.dados),
  'lpcfg.get':  (m)=>lpCfgGet(!!m.force),          // v2.0: Funil & Etapas + listas do app
  'lpc.patch':  (m)=>lpcPatch(m.id,m.acoes),        // v2.0: relê fresco, aplica a ação, grava só a linha
  'cart.perfil':(m)=>cartPerfilGet(m.ref),          // 2.8.0: Família (carteira_perfil) na aba 👤 Perfil
};

/* 2.8.0: o card completo (iframe do vendas.html no painel / janela ao lado / painel lateral do Chrome) SAIU — o painel
   rápido ganhou as abas 👤 Perfil e 💼 Negócios, e o app inteiro fica a um clique ("↗ CRM" = link pra aba nova, no panel.js). */
/* ícone da extensão na barra do Chrome: no WhatsApp Web abre o painel; fora dele, abre o WhatsApp Web */
try{ chrome.action.onClicked.addListener(async tab=>{
  if(tab&&/^https:\/\/web\.whatsapp\.com\//.test(tab.url||'')){ try{ await chrome.tabs.sendMessage(tab.id,{type:'wa.abrir'}); }catch(_){} return; }
  try{ await chrome.tabs.create({url:'https://web.whatsapp.com/'}); }catch(_){}
}); }catch(_){}

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
