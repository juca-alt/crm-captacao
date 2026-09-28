// ===== PONTE do card completo (extensão 2.1) =====
// O WhatsApp Web bloqueia iframe de outros sites (CSP frame-src); página da PRÓPRIA extensão pode ser embutida.
// Esta página embute o CRM em modo WhatsApp (vendas.html?wa=1 — só a ficha do negócio) e repassa a conversa aberta
// ({tipo:'wa-abrir',tel,nome}) que o painel manda. Só aceita mensagem vinda do WhatsApp Web e só entrega pro CRM.
const CRM_ORIGIN='https://juca-alt.github.io';
const CRM_URL=CRM_ORIGIN+'/crm-captacao/vendas.html?wa=1';
const fr=document.getElementById('crm');
let ultima=null, pronto=false;
fr.src=CRM_URL+(location.hash||'');
function entrega(){ if(ultima&&fr.contentWindow) fr.contentWindow.postMessage(ultima,CRM_ORIGIN); }
fr.addEventListener('load',()=>{ pronto=true; setTimeout(entrega,400); setTimeout(entrega,2500); });   // CRM ainda subindo: reentrega
window.addEventListener('message',e=>{
  if(e.origin!=='https://web.whatsapp.com') return;
  const d=e.data||{}; if(d.tipo!=='wa-abrir') return;
  ultima={tipo:'wa-abrir',tel:String(d.tel||''),nome:String(d.nome||'')};
  if(pronto) entrega();
});
