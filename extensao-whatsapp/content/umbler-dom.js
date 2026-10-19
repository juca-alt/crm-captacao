// ===== 2.9.0 · DETECÇÃO DA CONVERSA ABERTA NO UMBLER TALK (somente LEITURA do DOM) =====
// Mesma interface do wa-dom.js: {getOpenChat, observe, fillComposer}. O panel.js escolhe o adaptador pelo host.
// Postura de sempre: nada de clique, nada de envio, nada de automação — só ler o que o usuário já está vendo.
// Nenhuma requisição ao Umbler: só DOM. DOM inspecionado em 17/10/2026 (Blazor WebAssembly, classes Bootstrap, sem shadow DOM):
//   conversa aberta ............ .conversation-pane
//   título ..................... .conversation-pane .contact-header-info .contact-header-name
//                                (nome do contato salvo OU o telefone formatado "+55 81 99974-2150" se não salvo)
//   telefone do contato salvo .. só no painel "Detalhes do contato": .offcanvas.offcanvas-end.show .offcanvas-header h6
//   lista lateral .............. a.chat-card span.name-ellipsis-chat → NUNCA ler telefone daqui (é de outra conversa)
//   caixa de mensagem .......... textarea.compose-input
//   URL /chats/<id> ............ o id MUDA entre a lista e a conversa aberta → não serve de chave de vínculo
// O Umbler tem 2 canais (2 números): o painel não depende do canal — busca pelo telefone/nome do CONTATO.
// Grupo: não há marcador confiável conhecido no DOM do Umbler (17/10). Heurística conservadora: título com "Grupo"/ícone de
// grupo no cabeçalho → {isGroup:true}; senão é tratado como contato pelo NOME (o card mostra só sugestões; nunca cria sozinho).
const UMBLER_DOM=(()=>{
  const TEL_RE=/^\+?[\d\s().-]{8,}$/;
  function txt(el){ return el?String(el.textContent||'').replace(/ /g,' ').replace(/\s+/g,' ').trim():''; }
  function digitos(t){ return (String(t||'').match(/\d/g)||[]).length; }
  function pane(){ return document.querySelector('.conversation-pane'); }
  function titulo(p){ return txt(p&&p.querySelector('.contact-header-info .contact-header-name')); }
  /* Camada 2 — painel "Detalhes do contato" aberto: o telefone do contato salvo fica no h6 do cabeçalho do offcanvas */
  function telDoPainel(){
    const h=document.querySelector('.offcanvas.offcanvas-end.show .offcanvas-header h6');
    const t=txt(h); return TEL_RE.test(t)&&digitos(t)>=10?t:null; }
  function ehGrupo(p,nome){
    const hd=p&&p.querySelector('.contact-header-info'); if(!hd) return false;
    if(hd.querySelector('[class*="group" i], [data-icon*="group" i], [title*="grupo" i]')) return true;
    return /^grupo\b/i.test(nome||'');
  }
  // -> {isGroup,phoneRaw,name,source:'header'|'painel'|'nome'} | null (nenhuma conversa aberta)
  function getOpenChat(){
    const p=pane(); if(!p) return null;
    const t=titulo(p); if(!t) return null;
    if(TEL_RE.test(t)&&digitos(t)>=10) return {isGroup:false,phoneRaw:t,name:null,source:'header'};   // 1) não salvo: título = telefone
    if(ehGrupo(p,t)) return {isGroup:true,name:t,phoneRaw:null,source:'nome'};
    const det=telDoPainel();
    if(det) return {isGroup:false,phoneRaw:det,name:t,source:'painel'};                             // 2) Detalhes aberto
    return {isGroup:false,phoneRaw:null,name:t,source:'nome'};                                       // 3) só o nome
  }
  // Troca de conversa: MutationObserver + debounce 300 ms; só notifica quando a assinatura (telefone|nome) muda.
  function observe(cb){
    let last='__init__', timer=null;
    const check=()=>{ timer=null; const c=getOpenChat();
      const sig=c?`${c.isGroup?'g':'c'}|${c.phoneRaw||''}|${c.name||''}`:'';
      if(sig!==last){ last=sig; try{ cb(c); }catch(_){} } };
    const mo=new MutationObserver(()=>{ if(!timer) timer=setTimeout(check,300); });
    mo.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['class']});
    check();
    return mo;
  }
  // Escreve na caixa do Umbler (textarea Blazor): value + 'input' e 'change' com bubbles (o Blazor escuta os dois).
  // NÃO envia — ele revisa e aperta Enter.
  function fillComposer(text){
    const box=document.querySelector('.conversation-pane textarea.compose-input')||document.querySelector('textarea.compose-input');
    if(!box) return false;
    try{
      const set=Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set;   /* setter nativo: frameworks que embrulham o value também enxergam */
      box.focus(); set.call(box,String(text||''));
      box.dispatchEvent(new Event('input',{bubbles:true}));
      box.dispatchEvent(new Event('change',{bubbles:true}));
      return box.value===String(text||'');
    }catch(_){ return false; }
  }
  return {getOpenChat,observe,fillComposer};
})();
