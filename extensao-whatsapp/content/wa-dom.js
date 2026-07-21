// ===== DETECÇÃO DA CONVERSA ABERTA (somente LEITURA do DOM) =====
// Postura anti-ban: nada de clique, nada de envio, nada de automação — só ler o
// que o usuário já está vendo. O DOM do WhatsApp não tem contrato: tudo aqui é
// best-effort em camadas, com null-check em tudo; se falhar, o painel degrada
// para a busca manual (camada 4, no panel.js) — nunca quebra o WhatsApp.

const WA_DOM=(()=>{

  // Camada 1 — JID no data-id das mensagens ("false_5581...@c.us_HEX").
  // É o dado mais estável: independe de layout, funciona p/ contato salvo ou não.
  // "@g.us" = grupo; "@lid" = privacidade de número (sem telefone visível) → cai
  // pras camadas seguintes.
  function jidFromMessages(main){
    const nodes=main.querySelectorAll('[data-id*="@c.us"],[data-id*="@g.us"]');
    for(let i=nodes.length-1;i>=0;i--){
      const m=/(?:true|false)_(\d+)@(c\.us|g\.us)/.exec(nodes[i].getAttribute('data-id')||'');
      if(m) return {digits:m[1],isGroup:m[2]==='g.us'};
    }
    return null;
  }

  // Camada 2/3 — header do chat: título é o nome do contato salvo, ou o próprio
  // número formatado ("+55 81 9...") quando não salvo.
  function headerInfo(main){
    const header=main.querySelector('header');
    if(!header) return {name:null,phoneFromTitle:null};
    const el=header.querySelector('span[title]')||header.querySelector('span[dir="auto"]');
    const t=(el&&(el.getAttribute('title')||el.textContent)||'').trim();
    if(!t) return {name:null,phoneFromTitle:null};
    if(/^\+?[\d\s().-]{8,}$/.test(t)) return {name:null,phoneFromTitle:t};
    return {name:t,phoneFromTitle:null};
  }

  // -> {isGroup,phoneRaw,name,source:'jid'|'header'|'nome'} | null (nenhum chat aberto)
  function getOpenChat(){
    const main=document.querySelector('#main');
    if(!main) return null;
    const {name,phoneFromTitle}=headerInfo(main);
    const jid=jidFromMessages(main);
    if(jid&&jid.isGroup) return {isGroup:true,name:name||'Grupo',phoneRaw:null,source:'jid'};
    if(jid) return {isGroup:false,phoneRaw:jid.digits,name,source:'jid'};
    if(phoneFromTitle) return {isGroup:false,phoneRaw:phoneFromTitle,name:null,source:'header'};
    if(name) return {isGroup:false,phoneRaw:null,name,source:'nome'};
    return null;
  }

  // Observa troca de conversa: MutationObserver amplo + debounce; só notifica
  // quando a "assinatura" (telefone|nome) do chat aberto muda de fato.
  function observe(cb){
    let last='__init__', timer=null;
    const check=()=>{
      timer=null;
      const c=getOpenChat();
      const sig=c?`${c.isGroup?'g':'c'}|${c.phoneRaw||''}|${c.name||''}`:'';
      if(sig!==last){ last=sig; try{ cb(c); }catch(_){} }
    };
    const mo=new MutationObserver(()=>{ if(!timer) timer=setTimeout(check,300); });
    mo.observe(document.body,{childList:true,subtree:true});
    check();
    return mo;
  }

  return {getOpenChat,observe};
})();
