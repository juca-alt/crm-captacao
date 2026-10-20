// ===== 2.9.0 · CARD DO CRM dentro do painel (WhatsApp Web e Umbler Talk) =====
// Pedido dele (19/10): "tem que abrir um card como é no CRM, igual — aí atualizo tudo lá como se tivesse no CRM; e se mudo
// algo no CRM fica mais fácil pra extensão também". Esta página da extensão segura UM iframe do vendas.html?wa=1 (o modo
// leve do card, CARD-WA-LEVE-V1 no app) e só troca a pessoa por mensagem — o CRM nunca recarrega ao trocar de conversa.
// Por que uma página da extensão no meio: o CRM só aceita ordens vindas de chrome-extension:// (nenhum script do WhatsApp ou
// do Umbler fala com ele). O COEP do WhatsApp é tratado pela regra do rules.json (declarativeNetRequest).
// Mensagens:
//   painel (content script) → aqui:  window.postMessage {tipo:'crm-chat',chat:{tel,nome,id,keys,grupo}} — direto, POR ABA
//                                     (WhatsApp e Umbler abertos juntos não se misturam). Só do WhatsApp Web / Umbler Talk.
//   aqui → CRM:                       {tipo:'wa-abrir',tel,nome,id}
//   CRM → aqui:                       {tipo:'wa-pronto'} · {tipo:'wa-ligar',id,nome} · {tipo:'wa-texto',texto}
//   aqui → painel:                    window.parent.postMessage({tipo:'crm-texto',texto}) (o painel põe na caixa, sem enviar)
const CRM_ORIGIN='https://juca-alt.github.io';
const CRM_URL=CRM_ORIGIN+'/crm-captacao/vendas.html?wa=1';
const LIMITE_MS=20000;

const fr=document.getElementById('crm');
const $=id=>document.getElementById(id);
let pronto=false, ultima=null, entregue='', _limite=null;

function mostra(qual){ $('carregando').hidden=qual!=='carregando'; $('falhou').hidden=qual!=='falhou'; }
function rotulo(){ return ultima&&!ultima.grupo&&(ultima.nome||ultima.tel)?'· '+(ultima.nome||ultima.tel):''; }
function carregar(novo){
  pronto=false; entregue=''; mostra('carregando'); $('carregando-q').textContent=rotulo();
  clearTimeout(_limite);
  _limite=setTimeout(()=>{ if(pronto) return; mostra('falhou');
    $('falhou-q').textContent=navigator.onLine?'Pode ser a internet lenta ou o site fora do ar.':'Parece que você está sem internet.'; },LIMITE_MS);
  const u=ultima&&!ultima.grupo?ultima:null;
  /* a 1ª pessoa já vai no endereço: o CRM abre direto, sem esperar mensagem */
  const h=u?'#'+new URLSearchParams({tel:u.tel||'',nome:u.nome||'',id:u.id||''}).toString():'';
  fr.src=CRM_URL+(novo?'&_='+Date.now().toString(36):'')+h;
  if(u) entregue=(u.tel||'')+'|'+(u.nome||'')+'|'+(u.id||'');
}
function entrega(forca){
  if(!pronto||!fr.contentWindow) return;
  const u=ultima||{}, m=u.grupo?{tipo:'wa-abrir',tel:'',nome:'',id:''}:{tipo:'wa-abrir',tel:String(u.tel||''),nome:String(u.nome||''),id:String(u.id||'')};
  const k=m.tel+'|'+m.nome+'|'+m.id;
  if(k===entregue&&!forca) return;          // mesma conversa e mesma pessoa: não reabre à toa
  entregue=k; fr.contentWindow.postMessage(m,CRM_ORIGIN);
}
fr.addEventListener('load',()=>{ if(!fr.src||fr.src==='about:blank') return; pronto=true; clearTimeout(_limite); mostra(null); entrega(); });

const HOSTS=['https://web.whatsapp.com','https://app-utalk.umbler.com'];
window.addEventListener('message',e=>{
  if(e.source===window.parent&&HOSTS.includes(e.origin)){ const d=e.data||{};
    if(d.tipo==='crm-chat'){ const c=d.chat||null; ultima=c?{tel:String(c.tel||''),nome:String(c.nome||''),id:String(c.id||''),grupo:!!c.grupo,keys:Array.isArray(c.keys)?c.keys.map(String):[]}:null;
      if(!fr.src||fr.src==='about:blank'){ carregar(false); return; }
      if(!pronto) $('carregando-q').textContent=rotulo(); entrega(); }
    if(d.tipo==='crm-recarregar') carregar(true);
    return; }
  if(e.origin!==CRM_ORIGIN||e.source!==fr.contentWindow) return;   // só o CRM deste iframe
  const d=e.data||{};
  if(d.tipo==='wa-pronto'){ pronto=true; clearTimeout(_limite); mostra(null); entrega(); return; }
  if(d.tipo==='wa-ligar'&&d.id&&ultima&&!ultima.grupo&&Array.isArray(ultima.keys)&&ultima.keys.length){
    try{ chrome.runtime.sendMessage({type:'wa.vincular',keys:ultima.keys,id:String(d.id),nome:String(d.nome||'')},()=>void chrome.runtime.lastError); }catch(_){}
    return; }
  /* 2.9.1: o card pediu login pelo Google → o Chrome abre a janelinha do Google (fora do iframe) e a sessão nova volta pro card */
  if(d.tipo==='wa-google'){ try{ chrome.runtime.sendMessage({type:'auth.google.card'},r=>{ void chrome.runtime.lastError;
      if(r&&r.ok&&r.data&&r.data.access_token) fr.contentWindow.postMessage({tipo:'wa-sessao',access_token:r.data.access_token,refresh_token:r.data.refresh_token},CRM_ORIGIN);
      else fr.contentWindow.postMessage({tipo:'wa-sessao-erro',erro:String((r&&r.error)||'não deu certo')},CRM_ORIGIN); }); }catch(_){}
    return; }
  if(d.tipo==='wa-texto'&&d.texto){ try{ const o=(location.ancestorOrigins&&location.ancestorOrigins[0])||'*'; window.parent.postMessage({tipo:'crm-texto',texto:String(d.texto)},o); }catch(_){} }
});

/* pede a conversa atual ao painel; se ele não responder logo, abre o CRM vazio (mostra "abra uma conversa") */
try{ const o=(location.ancestorOrigins&&location.ancestorOrigins[0])||'*'; window.parent.postMessage({tipo:'embed-pronto'},o); }catch(_){}
setTimeout(()=>{ if(!fr.src||fr.src==='about:blank') carregar(false); },400);
$('tentar').onclick=()=>carregar(true);
$('abrir-aba').href=CRM_ORIGIN+'/crm-captacao/vendas.html';
window.crmRecarregar=()=>carregar(true);
