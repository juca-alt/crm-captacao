// ===== SERVICE WORKER — todo tráfego de rede da extensão passa aqui =====
// Content script só mexe em DOM/UI; fetch fica no SW (host_permissions isenta de
// CORS e do CSP do WhatsApp; tokens nunca tocam o contexto da página).
importScripts('config.js','normalize.js','crm-api.js','portal-sw.js');   // 2.10.0: portal-sw.js = relatórios do portal

const HANDLERS={
  'auth.status': async ()=>{ const s=await getSession(); return s?{logged:true,email:s.user_email,usuario:s.usuario}:{logged:false}; },
  'auth.login':  (m)=>login(m.email,m.password),
  'auth.google': ()=>loginGoogle(),                   // 2.9.1: login da extensão pelo Google
  'auth.google.card': async ()=>{ const t=await googleTokens(); return {access_token:t.access_token,refresh_token:t.refresh_token}; },   // 2.9.1: sessão NOVA pro card do CRM (embed.js)
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
Object.assign(HANDLERS,PORTAL_HANDLERS);           // 2.10.0: painel 📥 Relatórios do portal (content/portal.js)

/* 2.9.0: o painel volta a mostrar o CARD DO CRM (iframe content/embed.html → vendas.html?wa=1, modo leve) — e roda também
   no Umbler Talk (content/umbler-dom.js). A rede da extensão continua toda aqui; o card fala com o banco pelo próprio app. */
/* ícone da extensão na barra do Chrome: no WhatsApp Web ou no Umbler abre o painel do CRM (como sempre).
   2.10.0: em qualquer OUTRO site (ex.: o portal da Prudential) abre o painel 📥 Relatórios do portal — antes pede ao Chrome
   permissão SÓ para aquele site (a janelinha "Permitir"). Página interna do Chrome / o próprio CRM: abre o WhatsApp Web. */
const SITES_RE=/^https:\/\/(web\.whatsapp\.com|app-utalk\.umbler\.com)\//;
const NAO_PORTAL_RE=/^https:\/\/(juca-alt\.github\.io|chromewebstore\.google\.com|chrome\.google\.com)\//;
try{ chrome.action.onClicked.addListener(tab=>{
  const url=String((tab&&tab.url)||'');
  if(tab&&SITES_RE.test(url)){ chrome.tabs.sendMessage(tab.id,{type:'wa.abrir'}).catch(()=>{}); return; }
  const origem=!NAO_PORTAL_RE.test(url)?portalOrigem(url):null;
  if(origem){
    // o pedido de permissão sai JÁ (sem await antes): o Chrome só mostra a janelinha durante o clique
    let pr; try{ pr=chrome.permissions.request({origins:[origem+'/*']}); }catch(e){ pr=Promise.reject(e); }
    pr.then(ok=>{
      if(ok){ chrome.action.setBadgeText({tabId:tab.id,text:''}).catch(()=>{}); return portalAbrirNaAba(tab.id,origem); }
      chrome.action.setBadgeText({tabId:tab.id,text:'!'}).catch(()=>{});
      chrome.action.setTitle({tabId:tab.id,title:'Sem permissão neste site — clique de novo e escolha "Permitir" pra usar os relatórios do portal.'}).catch(()=>{});
    }).catch(()=>{
      chrome.action.setBadgeText({tabId:tab.id,text:'!'}).catch(()=>{});
      chrome.action.setTitle({tabId:tab.id,title:'Os relatórios do portal só funcionam em sites https.'}).catch(()=>{});
    });
    return;
  }
  chrome.tabs.create({url:'https://web.whatsapp.com/'}).catch(()=>{});
}); }catch(_){}

// Extensão recarregada/atualizada → reinjeta o painel nas abas do WhatsApp já
// abertas. Sem isso o content script antigo fica órfão ("Extension context
// invalidated") até o usuário dar F5 na página. O panel.js novo remove a UI
// órfã no boot, então reinjetar é idempotente.
chrome.runtime.onInstalled.addListener(async()=>{
  try{
    const tabs=await chrome.tabs.query({url:['https://web.whatsapp.com/*','https://app-utalk.umbler.com/*']});
    for(const t of tabs){
      try{
        const umbler=/app-utalk\.umbler\.com/.test(t.url||'');
        await chrome.scripting.executeScript({target:{tabId:t.id},
          files:['config.js','normalize.js',umbler?'content/umbler-dom.js':'content/wa-dom.js','content/panel.js']});
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
