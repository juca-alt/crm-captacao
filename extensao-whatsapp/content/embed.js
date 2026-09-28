// ===== CARD COMPLETO no PAINEL LATERAL do Chrome (extensão 2.2) =====
// POR QUE AQUI e não num iframe dentro do WhatsApp (como na 2.1): o web.whatsapp.com responde com
// `Cross-Origin-Embedder-Policy: require-corp`. Página de extensão embutida nele HERDA essa política, e aí o
// vendas.html (GitHub Pages, que não manda cabeçalho COEP/CORP) é barrado pelo Chrome → ícone cinza de página
// quebrada, a cada load e a cada vez que o iframe era remontado. O painel lateral é uma página da extensão que
// NÃO fica debaixo do WhatsApp: sem COEP herdado, o CRM carrega normal, o login dele fica guardado e o iframe
// fica vivo — trocar de conversa só manda {tipo:'wa-abrir',tel,nome} por postMessage (não recarrega o CRM).
// A conversa aberta chega pelo chrome.storage.session (o content script avisa o service worker a cada troca).
const CRM_ORIGIN='https://juca-alt.github.io';
const CRM_URL=CRM_ORIGIN+'/crm-captacao/vendas.html?wa=1';
const LIMITE_MS=25000;                       // sem load nesse tempo = mostra "não respondeu" com Tentar de novo

const fr=document.getElementById('crm');
const $=id=>document.getElementById(id);
let pronto=false, ultima=null, entregue='', _limite=null;

function mostra(qual){ $('carregando').hidden=qual!=='carregando'; $('falhou').hidden=qual!=='falhou'; }
function rotulo(){ return ultima&&!ultima.grupo&&(ultima.nome||ultima.tel)?'· '+(ultima.nome||ultima.tel):''; }
function carregar(){
  pronto=false; entregue=''; mostra('carregando'); $('carregando-q').textContent=rotulo();
  clearTimeout(_limite);
  _limite=setTimeout(()=>{ if(pronto) return; mostra('falhou');
    $('falhou-q').textContent=navigator.onLine?'Pode ser a internet lenta ou o site fora do ar.':'Parece que você está sem internet.'; },LIMITE_MS);
  fr.src=CRM_URL+'&_='+Date.now().toString(36);   // cache-buster só no ↻/tentar: o load normal é 1 vez por painel
}
function msgDe(u){ return (!u||u.grupo)?{tipo:'wa-abrir',tel:'',nome:''}:{tipo:'wa-abrir',tel:String(u.tel||''),nome:String(u.nome||'')}; }
function entrega(){
  if(!pronto||!fr.contentWindow) return;
  const m=msgDe(ultima), k=m.tel+'|'+m.nome+'|'+((ultima&&ultima.ts)||'');   /* 2.4: ts entra — ligar a conversa reenvia a mesma */
  if(k===entregue) return;                  // mesma conversa: não reabre a ficha à toa
  entregue=k;
  /* 2.3: quem acha o negócio é a extensão (telefone → nome com as etiquetas do WhatsApp) e abre a ficha pelo id;
     o postMessage só com tel/nome dizia "nenhum negócio" pra cliente que está no CRM */
  try{ chrome.runtime.sendMessage({type:'wa.frame'},()=>void chrome.runtime.lastError); }
  catch(_){ fr.contentWindow.postMessage(m,CRM_ORIGIN); }
}
fr.addEventListener('load',()=>{
  if(!fr.src||fr.src==='about:blank') return;
  pronto=true; clearTimeout(_limite); mostra(null);
  entrega();
});

chrome.storage.session.get('wa_chat_ult').then(o=>{ ultima=(o&&o.wa_chat_ult)||null; $('carregando-q').textContent=rotulo(); entrega(); }).catch(()=>{});
chrome.storage.onChanged.addListener((ch,area)=>{
  if(area!=='session'||!ch.wa_chat_ult) return;
  ultima=ch.wa_chat_ult.newValue||null;
  if(!pronto) $('carregando-q').textContent=rotulo();
  entrega();
});

$('recarregar').onclick=carregar;
$('tentar').onclick=carregar;
$('abrir-aba').href=CRM_ORIGIN+'/crm-captacao/vendas.html';
$('rapido').onclick=async()=>{
  try{
    const [tab]=await chrome.tabs.query({active:true,currentWindow:true});
    await chrome.tabs.sendMessage(tab.id,{type:'wa.modo',modo:'rapido'});
    if(window.top===window) window.close();   /* 2.3: dentro do painel do WhatsApp não fecha nada */
  }catch(_){ alert('Abra a aba do WhatsApp Web pra usar o card rápido.'); }
};

// 1º load: sem cache-buster (o Chrome reaproveita o vendas.html do cache HTTP, max-age 10 min do Pages)
mostra('carregando');
_limite=setTimeout(()=>{ if(!pronto){ mostra('falhou'); $('falhou-q').textContent=navigator.onLine?'Pode ser a internet lenta ou o site fora do ar.':'Parece que você está sem internet.'; } },LIMITE_MS);
fr.src=CRM_URL+'&_='+Date.now().toString(36);   /* 2.3: sem reaproveitar cópia do cache que veio sem o cabeçalho do rules.json */
