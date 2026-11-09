/* ═══ FORMS-NEG-V1 (07/11/2026) — 📝 Formulários ligados aos negócios ══════════════════════════════════════════════════════
   Palavra dele: "criação de formulários ligados aos negócios" → decisão dele no chat: "B) Interno, na ficha" (preenchido por
   ele/Victor dentro da ficha do negócio; cliente por link fica pra depois).
   • MODELOS: lista de campos (checklist, sim/não, texto, número, valor, data, escolha, título de seção). Ficam em
     app_settings.lp_form_modelos (o banco só deixa o admin gravar — o Victor usa, não edita). Sem login: só neste aparelho.
     Sem nada salvo: 3 modelos padrão (Checklist de emissão · Roteiro da OI · Dados pra proposta), editáveis.
   • RESPOSTAS: dentro do negócio, em c.forms = [{id, mod, nome, ico, campos (cópia do modelo no dia), resp, criado, atualizado,
     por, fim, fimPor}]. Vai no jsonb do contato → sincroniza entre aparelhos e o merge junta por id, campo a campo.
     Editar o modelo depois NÃO mexe no que já foi preenchido (a cópia dos campos fica no formulário).
   • ONDE: bloco "📝 Formulários" na ficha (nasce fechado, resumo no cabeçalho), selo 📝 no card, Concluir vira linha
     do histórico (k:'form'). No PC o formulário abre em janela; no celular, em folha de baixo.
   • Só na base dele por enquanto: novoOn('forms-neg') (NOVO_SO_MEU). O vendas.html só carrega, chama frmNegBloco(c) na ficha e
     frmSeloHtml(c) nos cards. */
(function(){
'use strict';
const W=window;
const CH_LOCAL='crmlp_form_modelos_v1', CHAVE_DB='lp_form_modelos';
const TIPOS=[['check','☐ Item de checklist'],['sn','Sim / Não'],['texto','Texto curto'],['longo','Texto longo'],['num','Número'],['moeda','Valor (R$)'],['data','Data'],['esc','Escolha (lista)'],['secao','— Título de seção —']];
const TIPO_OK=new Set(TIPOS.map(t=>t[0]));
const cp=(id,t,r,ex)=>Object.assign({id,t,r},ex||{});
const PADRAO=[
  {id:'m_emissao',ico:'✅',nome:'Checklist de emissão',desc:'O que precisa estar pronto pra proposta virar apólice.',campos:[
    cp('a1','secao','Documentos'),cp('a2','check','Proposta assinada',{ob:true}),cp('a3','check','DPS preenchida e assinada',{ob:true}),cp('a4','check','Documento com foto (RG/CNH)'),cp('a5','check','Comprovante de residência'),
    cp('a6','secao','Pagamento'),cp('a7','esc','Forma de pagamento',{op:['Cartão de crédito','Boleto','Débito em conta'],ob:true}),cp('a8','sn','1ª parcela paga?'),
    cp('a9','secao','Análise'),cp('a10','sn','Exames médicos solicitados?'),cp('a11','longo','Beneficiários e %'),cp('a12','longo','Observações')]},
  {id:'m_oi',ico:'🧭',nome:'Roteiro da OI',desc:'Fact-find rápido na primeira reunião.',campos:[
    cp('b1','esc','Objetivo principal',{op:['Proteger a família','Sucessão / patrimônio','Aposentadoria','Saúde / doenças graves','Outro']}),cp('b2','moeda','Renda mensal'),cp('b3','texto','Dependentes (quem e idades)'),
    cp('b4','moeda','Dívidas / financiamentos'),cp('b5','longo','Seguro ou previdência que já tem'),cp('b6','longo','O que mais preocupa hoje'),cp('b7','texto','Próximo passo combinado',{ob:true})]},
  {id:'m_proposta',ico:'📄',nome:'Dados pra proposta',desc:'O que a proposta pede, juntado num lugar só.',campos:[
    cp('c1','texto','Profissão / atividade'),cp('c2','moeda','Renda mensal'),cp('c3','num','Altura (m)'),cp('c4','num','Peso (kg)'),cp('c5','sn','Fumante?'),
    cp('c6','sn','Pratica esporte de risco?'),cp('c7','longo','Doenças / cirurgias / remédios'),cp('c8','moeda','Capital desejado'),cp('c9','longo','Beneficiários e %')]}
];
const M={lista:null,em:0,carregando:false,fonte:'padrão'};
let ED=null, _sT=null;
const tx=f=>{ try{ return f(); }catch(_){ return ''; } };
const clone=o=>JSON.parse(JSON.stringify(o));
const rid=p=>(p||'f')+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
const E=s=>(typeof esc==='function'?esc(s):String(s==null?'':s));
const J=s=>(typeof jsq==='function'?jsq(s):String(s));
function on(){ try{ return typeof novoOn!=='function'||novoOn('forms-neg'); }catch(_){ return false; } }
function logadoOk(){ try{ return typeof logado==='function'&&logado(); }catch(_){ return false; } }
function podeEditar(){ try{ return !logadoOk()||(typeof souAdm==='function'&&souAdm()); }catch(_){ return false; } }
function quem(){ try{ return typeof quemFez==='function'?quemFez():''; }catch(_){ return ''; } }
const curto=e=>String(e||'').split('@')[0];
function ddmm(iso){ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||'')); return m?m[3]+'/'+m[2]:''; }

/* ── modelos ── */
function normModelo(m){ if(!m||typeof m!=='object') return null;
  const campos=(Array.isArray(m.campos)?m.campos:[]).filter(c=>c&&TIPO_OK.has(c.t)&&String(c.r||'').trim()).map(c=>{ const o={id:String(c.id||rid('c')),t:c.t,r:String(c.r).trim()};
    if(c.t==='esc') o.op=(Array.isArray(c.op)?c.op:String(c.op||'').split(',')).map(x=>String(x).trim()).filter(Boolean); if(c.ob&&c.t!=='secao') o.ob=true; return o; });
  return {id:String(m.id||rid('m_')),ico:String(m.ico||'📝').slice(0,4),nome:String(m.nome||'Formulário').trim()||'Formulário',desc:String(m.desc||''),campos}; }
function modelos(){ if(!M.lista){ try{ const l=JSON.parse(localStorage.getItem(CH_LOCAL)||'null'); if(Array.isArray(l)&&l.length){ M.lista=l.map(normModelo).filter(Boolean); M.fonte='aparelho'; } }catch(_){}
    if(!M.lista||!M.lista.length){ M.lista=clone(PADRAO); M.fonte='padrão'; } } return M.lista; }
function localSet(){ try{ localStorage.setItem(CH_LOCAL,JSON.stringify(M.lista)); }catch(_){} }
async function frmModelosCarregar(forca){ if(typeof sb==='undefined'||!sb||!logadoOk()||M.carregando) return; if(!forca&&Date.now()-M.em<10*60e3) return;
  M.carregando=true; M.em=Date.now();
  try{ const {data,error}=await sb.from('app_settings').select('valor').eq('chave',CHAVE_DB).maybeSingle();
    const l=!error&&data&&data.valor&&Array.isArray(data.valor.modelos)?data.valor.modelos.map(normModelo).filter(Boolean):null;
    if(l&&l.length){ const mudou=JSON.stringify(l)!==JSON.stringify(modelos()); M.lista=l; M.fonte='servidor'; localSet(); if(mudou) repintarFicha(); } }catch(_){ } finally{ M.carregando=false; } }
async function gravarModelos(){ localSet();
  if(typeof sb!=='undefined'&&sb&&logadoOk()&&typeof souAdm==='function'&&souAdm()){
    try{ const {error}=await sb.from('app_settings').upsert({chave:CHAVE_DB,valor:{modelos:M.lista},atualizado_em:new Date().toISOString()},{onConflict:'chave'}); if(error) throw error;
      M.fonte='servidor'; toast('Modelos salvos — valem pra toda a equipe',true); return; }
    catch(e){ toast('Salvo só neste aparelho — o servidor recusou: '+((e&&e.message)||e)); return; } }
  toast('Modelos salvos neste aparelho',true); }

/* ── respostas (no negócio) ── */
const acha=id=>(typeof S!=='undefined'&&S.contatos||[]).find(x=>x&&String(x.id)===String(id));
function formsDe(c){ return Array.isArray(c&&c.forms)?c.forms.filter(f=>f&&f.id):[]; }
const contaveis=f=>(f.campos||[]).filter(x=>x.t!=='secao');
function respondido(x,v){ return x.t==='check'?v===true:(v!=null&&String(v).trim()!==''); }
function conta(f){ const cs=contaveis(f), r=f.resp||{}; return {f:cs.filter(x=>respondido(x,r[x.id])).length,t:cs.length}; }
function faltam(f){ const r=f.resp||{}; return contaveis(f).filter(x=>x.ob&&!respondido(x,r[x.id])); }
function frmResumo(c){ const l=formsDe(c); if(!l.length) return 'nenhum'; const ab=l.filter(f=>!f.fim).length;
  return `${l.length} formulário${l.length>1?'s':''}${ab?' · '+ab+' em andamento':' · todos concluídos'}`; }
function frmSeloHtml(c){ if(!on()||!c) return ''; const l=formsDe(c); if(!l.length) return '';
  const ab=l.filter(f=>!f.fim).sort((a,b)=>String(b.atualizado||'').localeCompare(String(a.atualizado||'')))[0];
  if(ab){ const k=conta(ab); return `<span class="frm-selo" title="${E(ab.nome)}: ${k.f} de ${k.t} preenchidos">📝 ${k.f}/${k.t}</span>`; }
  return `<span class="frm-selo ok" title="${l.length} formulário${l.length>1?'s':''} concluído${l.length>1?'s':''}">📝 ${l.length} ✓</span>`; }
function linhaHtml(c,f){ const k=conta(f), pct=k.t?Math.round(k.f*100/k.t):0, cid=E(J(c.id)), fid=E(J(f.id));
  const st=f.fim?`✓ concluído ${ddmm(f.fim)}${f.fimPor?' · '+E(curto(f.fimPor)):''}`:`em andamento · ${ddmm(f.atualizado||f.criado)}${f.por?' · '+E(curto(f.por)):''}`;
  return `<button type="button" class="frm-li${f.fim?' ok':''}" onclick="frmAbrir('${cid}','${fid}')"><span class="frm-li-n">${E(f.ico||'📝')} ${E(f.nome)}</span><span class="frm-li-s">${st}</span>
    <span class="frm-li-p"><span class="frm-bar"><i style="width:${pct}%"></i></span><b>${k.f}/${k.t}</b></span></button>`; }
/* bloco nativo da gaveta: a dobra (fechado ao abrir), a ordem e a aba da ficha nova cuidam dele pelo título */
function frmNegBloco(c){ if(!on()||!c||c.funil==='bn'||c.funil==='fx') return ''; frmCss(); frmModelosCarregar(); const l=formsDe(c), cid=E(J(c.id));
  return `<div class="sec frm-sec"><h3><span>📝 Formulários</span><span class="frm-res" style="text-transform:none;letter-spacing:0">${E(frmResumo(c))}</span></h3>
    ${l.length?`<div class="frm-l">${l.slice().sort((a,b)=>(a.fim?1:0)-(b.fim?1:0)||String(b.atualizado||b.criado||'').localeCompare(String(a.atualizado||a.criado||''))).map(f=>linhaHtml(c,f)).join('')}</div>`:'<div class="frm-vz">Nenhum formulário neste negócio ainda. Use um modelo (checklist de emissão, roteiro da OI…) e ele fica guardado aqui, com o histórico.</div>'}
    <div class="frm-acts"><button type="button" class="btn btn-s btn-mini" onclick="frmNovo('${cid}')">＋ Preencher formulário</button>${podeEditar()?'<button type="button" class="btn btn-ghost btn-mini" onclick="frmModelosAbrir()">⚙️ Modelos</button>':''}</div></div>`; }
function repintarFicha(){ try{ const d=document.getElementById('drawer'); if(d&&d.classList.contains('aberto')&&typeof renderDrawer==='function'){ const b=d.querySelector('.drawer-body'), st=b?b.scrollTop:0; renderDrawer(); const b2=d.querySelector('.drawer-body'); if(b2) b2.scrollTop=st; } }catch(_){ } }
function salvarJa(){ clearTimeout(_sT); _sT=null; try{ salvar(); }catch(_){ } }
function salvarDepois(){ clearTimeout(_sT); _sT=setTimeout(salvarJa,700); }
function modal(html){ if(typeof atModal!=='function') return null; const ov=atModal(html); const card=ov&&ov.querySelector('.lp-modal-card'); if(card) card.classList.add('frm-card'); ov.classList.add('frm-ov');
  if(ov) ov.onclick=()=>{ frmFechar(); }; return ov; }
function frmFechar(){ if(_sT) salvarJa(); try{ atClose(); }catch(_){ } repintarFicha(); try{ render(); }catch(_){ } }

/* escolher o modelo */
function frmNovo(cid){ const c=acha(cid); if(!c) return; const ms=modelos(), j=E(J(cid));
  modal(`<div class="frm-hd"><div><h2>＋ Preencher formulário</h2><div class="frm-sub">${E(c.nome||'')} · escolha o modelo</div></div><button type="button" class="frm-x" onclick="frmFechar()" aria-label="Fechar">✕</button></div>
    <div class="frm-ms">${ms.map(m=>{ const ab=formsDe(c).find(f=>f.mod===m.id&&!f.fim); return `<button type="button" class="frm-m" onclick="frmCriar('${j}','${E(J(m.id))}')"><span class="frm-m-n">${E(m.ico)} ${E(m.nome)}</span><span class="frm-m-d">${E(m.desc||'')}${m.desc?' · ':''}${contaveis(m).length} campos${ab?' · <b>continuar o que está em andamento</b>':''}</span></button>`; }).join('')||'<div class="frm-vz">Nenhum modelo. Crie um em ⚙️ Modelos.</div>'}</div>
    ${podeEditar()?'<div class="frm-ft"><button type="button" class="btn btn-ghost btn-mini" onclick="frmModelosAbrir()">⚙️ Criar ou editar modelos</button></div>':''}`); }
function frmCriar(cid,mid){ const c=acha(cid), m=modelos().find(x=>x.id===mid); if(!c||!m) return;
  const ab=formsDe(c).find(f=>f.mod===m.id&&!f.fim); if(ab){ frmAbrir(cid,ab.id); return; }
  const agora=new Date().toISOString(), f={id:rid('f'),mod:m.id,nome:m.nome,ico:m.ico,campos:clone(m.campos),resp:{},criado:agora,atualizado:agora,por:quem(),fim:null};
  if(!Array.isArray(c.forms)) c.forms=[]; c.forms.push(f); salvarJa(); frmAbrir(cid,f.id); }

/* preencher */
function campoHtml(cid,f,x){ const v=(f.resp||{})[x.id], a=`'${E(J(cid))}','${E(J(f.id))}','${E(J(x.id))}'`, id='frm-'+E(x.id), ob=x.ob?' <i class="frm-ob" title="obrigatório">*</i>':'', dis=f.fim?' disabled':'';
  switch(x.t){
    case 'secao': return `<div class="frm-secao">${E(x.r)}</div>`;
    case 'check': return `<label class="frm-ck" data-c="${E(x.id)}"><input type="checkbox"${v===true?' checked':''}${dis} onchange="frmSet(${a},this.checked)"><span>${E(x.r)}${ob}</span></label>`;
    case 'sn': return `<div class="frm-f" data-c="${E(x.id)}"><span class="frm-l">${E(x.r)}${ob}</span><div class="frm-sn">${['sim','nao'].map(o=>`<button type="button" class="${v===o?'on':''}"${dis} aria-pressed="${v===o}" onclick="frmSn(${a},'${o}',this)">${o==='sim'?'Sim':'Não'}</button>`).join('')}</div></div>`;
    case 'longo': return `<div class="frm-f" data-c="${E(x.id)}"><label class="frm-l" for="${id}">${E(x.r)}${ob}</label><textarea id="${id}" rows="3"${dis} oninput="frmSet(${a},this.value)">${E(v||'')}</textarea></div>`;
    case 'esc': return `<div class="frm-f" data-c="${E(x.id)}"><label class="frm-l" for="${id}">${E(x.r)}${ob}</label><select id="${id}"${dis} onchange="frmSet(${a},this.value)"><option value="">— escolha —</option>${(x.op||[]).map(o=>`<option${o===v?' selected':''}>${E(o)}</option>`).join('')}${v&&!(x.op||[]).includes(v)?`<option selected>${E(v)}</option>`:''}</select></div>`;
    case 'data': return `<div class="frm-f" data-c="${E(x.id)}"><label class="frm-l" for="${id}">${E(x.r)}${ob}</label><input id="${id}" type="date" value="${E(v||'')}"${dis} onchange="frmSet(${a},this.value)"></div>`;
    case 'num': case 'moeda': return `<div class="frm-f" data-c="${E(x.id)}"><label class="frm-l" for="${id}">${E(x.r)}${ob}</label><div class="frm-in">${x.t==='moeda'?'<span>R$</span>':''}<input id="${id}" type="text" inputmode="decimal" value="${E(v||'')}"${dis} oninput="frmSet(${a},this.value)"></div></div>`;
    default: return `<div class="frm-f" data-c="${E(x.id)}"><label class="frm-l" for="${id}">${E(x.r)}${ob}</label><input id="${id}" type="text" value="${E(v||'')}"${dis} oninput="frmSet(${a},this.value)"></div>`; } }
function frmAbrir(cid,fid){ const c=acha(cid), f=c&&formsDe(c).find(x=>x.id===fid); if(!c||!f) return; const k=conta(f), j=E(J(cid)), jf=E(J(fid));
  modal(`<div class="frm-hd"><div><h2>${E(f.ico||'📝')} ${E(f.nome)}</h2><div class="frm-sub">${E(c.nome||'')} · <b id="frm-pg">${k.f}/${k.t}</b> preenchidos${f.fim?` · ✓ concluído em ${E(tx(()=>dataBR(String(f.fim).slice(0,10)))||ddmm(f.fim))}`:' · salva sozinho'}</div></div><button type="button" class="frm-x" onclick="frmFechar()" aria-label="Fechar">✕</button></div>
    <div class="frm-bar big"><i id="frm-bar" style="width:${k.t?Math.round(k.f*100/k.t):0}%"></i></div>
    <div class="frm-cs">${(f.campos||[]).map(x=>campoHtml(cid,f,x)).join('')}</div>
    <div class="frm-ft"><button type="button" class="btn btn-ghost btn-mini frm-del" onclick="frmExcluir('${j}','${jf}')">🗑 Excluir</button><span style="flex:1"></span>
      ${f.fim?`<button type="button" class="btn btn-s btn-mini" onclick="frmReabrir('${j}','${jf}')">↩ Reabrir pra editar</button>`:`<button type="button" class="btn btn-ghost btn-mini" onclick="frmFechar()">Fechar</button><button type="button" class="btn btn-p btn-mini" onclick="frmConcluir('${j}','${jf}')">✓ Concluir</button>`}</div>`); }
/* Sim/Não: tocar no que já está marcado desmarca */
function frmSn(cid,fid,campo,o,btn){ const v=btn&&btn.classList.contains('on')?'':o; frmSet(cid,fid,campo,v,btn); }
function frmSet(cid,fid,campo,val,btn){ const c=acha(cid), f=c&&formsDe(c).find(x=>x.id===fid); if(!c||!f||f.fim) return;
  if(btn&&btn.parentNode){ btn.parentNode.querySelectorAll('button').forEach(b=>{ const on=b===btn&&!!val; b.classList.toggle('on',on); b.setAttribute('aria-pressed',String(on)); }); }
  if(!f.resp||typeof f.resp!=='object') f.resp={};
  if(val===''||val==null||val===false) delete f.resp[campo]; else f.resp[campo]=val;
  f.atualizado=new Date().toISOString(); f.por=quem();
  const k=conta(f), pg=document.getElementById('frm-pg'), bar=document.getElementById('frm-bar'); if(pg) pg.textContent=k.f+'/'+k.t; if(bar) bar.style.width=(k.t?Math.round(k.f*100/k.t):0)+'%';
  const el=document.querySelector(`.frm-card [data-c="${CSS&&CSS.escape?CSS.escape(campo):campo}"]`); if(el) el.classList.remove('frm-falta');
  salvarDepois(); }
function frmConcluir(cid,fid){ const c=acha(cid), f=c&&formsDe(c).find(x=>x.id===fid); if(!c||!f) return; const fl=faltam(f);
  if(fl.length){ document.querySelectorAll('.frm-card [data-c]').forEach(e=>e.classList.toggle('frm-falta',fl.some(x=>x.id===e.dataset.c)));
    const p=document.querySelector(`.frm-card [data-c="${fl[0].id}"]`); if(p) try{ p.scrollIntoView({block:'center',behavior:'smooth'}); }catch(_){ }
    toast(`Falta${fl.length>1?'m':''} ${fl.length} obrigatório${fl.length>1?'s':''}: ${fl.map(x=>x.r).slice(0,3).join(', ')}${fl.length>3?'…':''}`); return; }
  const k=conta(f), agora=new Date().toISOString(); f.fim=agora; f.fimPor=quem(); f.atualizado=agora;
  try{ interacoesDe(c).push({id:uid(),k:'form',l:`📝 Formulário concluído: ${f.nome} (${k.f}/${k.t})`,form_id:f.id,dia:hojeISO(),ts:agora,por:quem()}); }catch(_){ }
  salvarJa(); frmFechar(); toast(`${f.nome}: concluído e registrado no histórico`,true); }
function frmReabrir(cid,fid){ const c=acha(cid), f=c&&formsDe(c).find(x=>x.id===fid); if(!c||!f) return; f.fim=null; f.fimPor=null; f.atualizado=new Date().toISOString(); salvarJa(); frmAbrir(cid,fid); }
function frmExcluir(cid,fid){ const c=acha(cid); if(!c||!Array.isArray(c.forms)) return; const i=c.forms.findIndex(x=>x&&x.id===fid); if(i<0) return; const f=c.forms[i];
  c.forms.splice(i,1); salvarJa(); frmFechar();
  const volta=()=>{ const c2=acha(cid); if(!c2) return; if(!Array.isArray(c2.forms)) c2.forms=[]; if(!c2.forms.some(x=>x&&x.id===f.id)) c2.forms.splice(Math.min(i,c2.forms.length),0,f); salvarJa(); repintarFicha(); try{ render(); }catch(_){ } };
  if(typeof toastDesfazer==='function') toastDesfazer(`Formulário "${f.nome}" excluído`,volta); else toast('Formulário excluído',true); }

/* ── editor de modelos (admin; sem login = este aparelho) ── */
function frmModelosAbrir(){ if(!podeEditar()){ toast('Só o administrador edita os modelos'); return; } ED=null; const ms=modelos();
  modal(`<div class="frm-hd"><div><h2>⚙️ Modelos de formulário</h2><div class="frm-sub">${M.fonte==='servidor'?'valem pra toda a equipe':logadoOk()?'ainda não salvos no servidor':'salvos neste aparelho'} · mudar um modelo não mexe no que já foi preenchido</div></div><button type="button" class="frm-x" onclick="frmFechar()" aria-label="Fechar">✕</button></div>
    <div class="frm-ms">${ms.map((m,i)=>`<div class="frm-mr"><span class="frm-m-n">${E(m.ico)} ${E(m.nome)} <small>${contaveis(m).length} campos</small></span><span class="frm-mr-a">
      <button type="button" class="btn btn-s btn-mini" onclick="frmModeloEditar(${i})">✎ Editar</button><button type="button" class="btn btn-ghost btn-mini" onclick="frmModeloDuplicar(${i})" title="Duplicar">⧉</button><button type="button" class="btn btn-ghost btn-mini frm-del" onclick="frmModeloExcluir(${i})" title="Excluir modelo" aria-label="Excluir modelo ${E(m.nome)}">🗑</button></span></div>`).join('')}</div>
    <div class="frm-ft"><button type="button" class="btn btn-p btn-mini" onclick="frmModeloEditar(-1)">＋ Novo modelo</button><span style="flex:1"></span><button type="button" class="btn btn-ghost btn-mini" onclick="frmFechar()">Fechar</button></div>`); }
function frmModeloEditar(i){ const ms=modelos(); ED={i,m:i>=0&&ms[i]?clone(ms[i]):{id:rid('m_'),ico:'📝',nome:'',desc:'',campos:[cp(rid('c'),'check','')]}}; edPintar(); }
function edPintar(foco){ if(!ED) return; const m=ED.m;
  modal(`<div class="frm-hd"><div><h2>${ED.i>=0?'✎ Editar modelo':'＋ Novo modelo'}</h2><div class="frm-sub">os campos aparecem nesta ordem no formulário</div></div><button type="button" class="frm-x" onclick="frmModelosAbrir()" aria-label="Voltar">←</button></div>
    <div class="frm-ed-top"><div class="frm-f frm-ico"><label class="frm-l" for="frm-ed-ico">Ícone</label><input id="frm-ed-ico" type="text" maxlength="4" value="${E(m.ico)}" oninput="frmEd('ico',this.value)"></div>
      <div class="frm-f" style="flex:1"><label class="frm-l" for="frm-ed-nome">Nome</label><input id="frm-ed-nome" type="text" placeholder="ex.: Checklist de entrega" value="${E(m.nome)}" oninput="frmEd('nome',this.value)"></div></div>
    <div class="frm-f"><label class="frm-l" for="frm-ed-desc">Pra que serve (opcional)</label><input id="frm-ed-desc" type="text" value="${E(m.desc||'')}" oninput="frmEd('desc',this.value)"></div>
    <div class="frm-eds">${m.campos.map((x,k)=>`<div class="frm-edc">
      <select aria-label="Tipo do campo ${k+1}" onchange="frmEdCampo(${k},'t',this.value,true)">${TIPOS.map(([t,l])=>`<option value="${t}"${t===x.t?' selected':''}>${l}</option>`).join('')}</select>
      <input id="frm-edr-${k}" type="text" aria-label="Pergunta do campo ${k+1}" placeholder="${x.t==='secao'?'Título da seção':'Pergunta / item'}" value="${E(x.r)}" oninput="frmEdCampo(${k},'r',this.value)">
      ${x.t==='esc'?`<input type="text" aria-label="Opções do campo ${k+1}" class="frm-edop" placeholder="Opções separadas por vírgula" value="${E((x.op||[]).join(', '))}" oninput="frmEdCampo(${k},'op',this.value)">`:''}
      <span class="frm-edb">${x.t!=='secao'?`<label class="frm-edob"><input type="checkbox"${x.ob?' checked':''} onchange="frmEdCampo(${k},'ob',this.checked)"> obrigatório</label>`:''}
        <button type="button" class="btn btn-ghost btn-mini" ${k===0?'disabled':''} onclick="frmEdMover(${k},-1)" aria-label="Subir">↑</button><button type="button" class="btn btn-ghost btn-mini" ${k===m.campos.length-1?'disabled':''} onclick="frmEdMover(${k},1)" aria-label="Descer">↓</button><button type="button" class="btn btn-ghost btn-mini frm-del" onclick="frmEdTirar(${k})" aria-label="Tirar campo">🗑</button></span></div>`).join('')}</div>
    <div class="frm-ft"><button type="button" class="btn btn-s btn-mini" onclick="frmEdNovo()">＋ Campo</button><span style="flex:1"></span><button type="button" class="btn btn-ghost btn-mini" onclick="frmModelosAbrir()">Cancelar</button><button type="button" class="btn btn-p btn-mini" onclick="frmEdSalvar()">Salvar modelo</button></div>`);
  if(foco){ const e=document.getElementById(foco); if(e) try{ e.focus(); }catch(_){ } } }
function frmEd(k,v){ if(ED) ED.m[k]=v; }
function frmEdCampo(k,q,v,repinta){ if(!ED||!ED.m.campos[k]) return; const x=ED.m.campos[k];
  if(q==='op') x.op=String(v).split(',').map(s=>s.trim()).filter(Boolean); else if(q==='ob') x.ob=!!v; else x[q]=v;
  if(q==='t'){ if(v!=='esc') delete x.op; else if(!x.op) x.op=[]; if(v==='secao') delete x.ob; }
  if(repinta) edPintar(); }
function frmEdMover(k,d){ if(!ED) return; const a=ED.m.campos, j=k+d; if(j<0||j>=a.length) return; [a[k],a[j]]=[a[j],a[k]]; edPintar(); }
function frmEdTirar(k){ if(!ED) return; ED.m.campos.splice(k,1); edPintar(); }
function frmEdNovo(){ if(!ED) return; ED.m.campos.push(cp(rid('c'),'check','')); edPintar('frm-edr-'+(ED.m.campos.length-1)); }
function frmEdSalvar(){ if(!ED) return; const m=normModelo(ED.m);
  if(!m.nome||!String(ED.m.nome||'').trim()){ toast('Dê um nome ao modelo'); return; }
  if(!contaveis(m).length){ toast('Ponha ao menos um campo com pergunta'); return; }
  const semOp=m.campos.find(x=>x.t==='esc'&&!(x.op||[]).length); if(semOp){ toast(`"${semOp.r}": escreva as opções da lista`); return; }
  const ms=modelos(); if(ED.i>=0&&ms[ED.i]) ms[ED.i]=m; else ms.push(m); ED=null; gravarModelos(); frmModelosAbrir(); }
function frmModeloDuplicar(i){ const ms=modelos(), m=ms[i]; if(!m) return; const n=clone(m); n.id=rid('m_'); n.nome=m.nome+' (cópia)'; n.campos.forEach(x=>{ x.id=rid('c'); }); ms.splice(i+1,0,n); gravarModelos(); frmModelosAbrir(); }
function frmModeloExcluir(i){ const ms=modelos(), m=ms[i]; if(!m) return; ms.splice(i,1); gravarModelos(); frmModelosAbrir();
  if(typeof toastDesfazer==='function') toastDesfazer(`Modelo "${m.nome}" excluído (o que já foi preenchido continua nas fichas)`,()=>{ const l=modelos(); if(!l.some(x=>x.id===m.id)) l.splice(Math.min(i,l.length),0,m); gravarModelos(); if(document.querySelector('.frm-card')) frmModelosAbrir(); }); }

/* ── estilo (PC: janela; celular: folha de baixo, campo ≥16px, toque ≥44px) ── */
function frmCss(){ if(document.getElementById('frm-css')) return; const s=document.createElement('style'); s.id='frm-css'; s.textContent=`
.frm-sec .frm-l{display:flex;flex-direction:column;gap:6px}
.frm-li{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:2px 10px;width:100%;text-align:left;background:#fff;border:1px solid var(--linha);border-radius:10px;padding:8px 10px;cursor:pointer;color:inherit;font:inherit}
.frm-li:hover{border-color:#cbd5e1;background:#f8fafc}.frm-li.ok{background:#f6fdf8}
.frm-li-n{font-weight:650;font-size:13.5px;min-width:0;overflow-wrap:anywhere}.frm-li-s{grid-column:1;font-size:12px;color:var(--muted)}
.frm-li-p{grid-row:1/3;grid-column:2;display:flex;align-items:center;gap:6px;font-size:12px;font-variant-numeric:tabular-nums}
.frm-bar{display:inline-block;width:60px;height:6px;border-radius:3px;background:#e2e8f0;overflow:hidden;vertical-align:middle}.frm-bar i{display:block;height:100%;background:var(--verde,#16a34a);border-radius:3px}
.frm-bar.big{display:block;width:auto;height:5px;margin:10px 0 4px}
.frm-vz{font-size:12.5px;color:var(--muted);padding:2px 0 4px}
.frm-acts{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}
.frm-selo{font-size:11px;font-weight:600;border-radius:6px;padding:1px 6px;background:#eef2ff;color:#3730a3;white-space:nowrap}.frm-selo.ok{background:#dcfce7;color:#15803d}
.frm-card{width:min(640px,94vw)!important;padding:18px 20px!important;display:flex;flex-direction:column;gap:10px}
.frm-hd{display:flex;align-items:flex-start;gap:10px;justify-content:space-between}.frm-hd h2{margin:0;font-size:18px}
.frm-sub{font-size:12.5px;color:var(--muted);margin-top:2px}
.frm-x{border:0;background:#f1f5f9;border-radius:9px;min-width:36px;min-height:36px;font-size:16px;cursor:pointer;flex:0 0 auto}
.frm-cs{display:flex;flex-direction:column;gap:10px}
.frm-secao{font-size:11.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-top:6px;padding-bottom:3px;border-bottom:1px solid var(--linha)}
.frm-f{display:flex;flex-direction:column;gap:4px;min-width:0}
.frm-l{font-size:12.5px;font-weight:600;color:#334155}.frm-ob{color:var(--verm,#dc2626);font-style:normal}
.frm-f input,.frm-f select,.frm-f textarea,.frm-edc input,.frm-edc select{border:1px solid var(--linha);border-radius:8px;padding:7px 10px;min-height:38px;font-size:14px;width:100%;min-width:0;background:#fff;font-family:inherit;color:inherit}
.frm-f textarea{min-height:70px;resize:vertical}
.frm-in{display:flex;align-items:center;gap:6px}.frm-in span{font-size:13px;color:var(--muted)}
.frm-ck{display:flex;align-items:center;gap:10px;min-height:36px;font-size:14px;cursor:pointer;border-radius:8px;padding:2px 4px}
.frm-ck input{width:20px;height:20px;accent-color:var(--verde,#16a34a);flex:0 0 auto}.frm-ck:hover{background:#f8fafc}
.frm-sn{display:inline-flex;gap:6px}.frm-sn button{min-width:70px;min-height:36px;border:1px solid var(--linha);background:#fff;border-radius:999px;font-size:13.5px;cursor:pointer}
.frm-sn button.on{background:var(--primary);border-color:var(--primary);color:#fff}
.frm-falta{outline:2px solid #fca5a5;outline-offset:3px;border-radius:8px;background:#fef2f2}
.frm-ft{display:flex;gap:8px;align-items:center;flex-wrap:wrap;border-top:1px solid var(--linha);padding:10px 0 2px;margin-top:4px;position:sticky;bottom:-18px;background:#fff;z-index:1}   /* Concluir sempre à vista */
.ux2 .frm-sec .frm-res{display:none}   /* a ficha nova já escreve o resumo no cabeçalho (fichaUx2 · case 'forms') */
.frm-del{color:var(--verm,#dc2626)}
.frm-ms{display:flex;flex-direction:column;gap:8px}
.frm-m{display:flex;flex-direction:column;gap:2px;text-align:left;border:1px solid var(--linha);border-radius:10px;background:#fff;padding:10px 12px;cursor:pointer;font:inherit;color:inherit}.frm-m:hover{border-color:var(--primary);background:#f8fafc}
.frm-m-n{font-weight:650;font-size:14px}.frm-m-n small{font-weight:400;color:var(--muted);margin-left:4px}.frm-m-d{font-size:12.5px;color:var(--muted)}
.frm-mr{display:flex;align-items:center;gap:8px;justify-content:space-between;border:1px solid var(--linha);border-radius:10px;padding:8px 10px;flex-wrap:wrap}.frm-mr-a{display:flex;gap:4px}
.frm-ed-top{display:flex;gap:10px}.frm-ico{flex:0 0 70px}
.frm-eds{display:flex;flex-direction:column;gap:8px}
.frm-edc{display:grid;grid-template-columns:170px minmax(0,1fr);gap:6px;align-items:center;border:1px solid var(--linha);border-radius:10px;padding:8px;background:#f8fafc}
.frm-edc .frm-edop{grid-column:2}.frm-edb{grid-column:1/-1;display:flex;gap:4px;align-items:center;justify-content:flex-end}
.frm-edob{display:flex;align-items:center;gap:5px;font-size:12.5px;color:var(--muted);margin-right:auto;cursor:pointer}
@media (max-width:760px){
  #at-ov.frm-ov{align-items:flex-end!important}
  .frm-card{width:100%!important;max-width:100%!important;max-height:92vh;max-height:92dvh;border-radius:16px 16px 0 0!important;padding:14px 14px max(18px,env(safe-area-inset-bottom))!important}
  .frm-f input,.frm-f select,.frm-f textarea,.frm-edc input,.frm-edc select{font-size:16px;min-height:44px}
  .frm-ck{min-height:44px}.frm-ck input{width:24px;height:24px}
  .frm-sn button,.frm-x,.frm-ft .btn,.frm-acts .btn,.frm-mr-a .btn,.frm-edb .btn,.frm-li,.frm-m{min-height:44px}
  .frm-sn{display:flex}.frm-sn button{flex:1}
  .frm-ft{position:sticky;bottom:calc(-1 * max(18px,env(safe-area-inset-bottom)));background:#fff;padding-bottom:6px}
  .frm-ft .btn{flex:1 1 auto}
  .frm-edc{grid-template-columns:1fr}.frm-edc .frm-edop{grid-column:1}
  .frm-edob{min-height:44px}
}`; document.head.appendChild(s); }

/* ── autotestes (rodam no lpSelfCheck / portão) ── */
function frmSelfTests(ok){
  ok('FORMS-NEG-V1: 3 modelos padrão válidos (checklist de emissão, roteiro da OI, dados pra proposta), sem campo inválido', PADRAO.length===3&&PADRAO.every(m=>{ const n=normModelo(m); return n.campos.length===m.campos.length&&n.campos.every(x=>TIPO_OK.has(x.t)); }));
  const f={id:'fz',nome:'T',campos:[cp('s','secao','Sec'),cp('a','check','A',{ob:true}),cp('b','sn','B'),cp('c','texto','C',{ob:true}),cp('d','esc','D',{op:['x','y']})],resp:{a:true,b:'nao',c:'  '}};
  const k=conta(f), fl=faltam(f);
  ok('FORMS-NEG-V1: progresso conta só campos (seção fora), checklist só vale marcado, texto em branco não conta; obrigatório vazio barra o Concluir', k.t===4&&k.f===2&&fl.length===1&&fl[0].id==='c');
  const c={id:'fz-c',nome:'Fulano Exemplo',forms:[f,{id:'fy',nome:'U',campos:[cp('a','check','A')],resp:{a:true},fim:'2026-11-07T10:00:00Z'}]};
  ok('FORMS-NEG-V1: resumo e selo do card (em andamento mostra x/y; tudo concluído mostra ✓)', frmResumo(c)==='2 formulários · 1 em andamento'&&/📝 2\/4/.test(frmSeloHtml(c))&&/📝 1 ✓/.test(frmSeloHtml({forms:[c.forms[1]]}))&&frmSeloHtml({})===''&&frmResumo({})==='nenhum');
  const n=normModelo({nome:' X ',campos:[{t:'esc',r:'Q',op:'a, b,,c'},{t:'zz',r:'mal'},{t:'texto',r:'  '},{t:'secao',r:'S',ob:true}]});
  ok('FORMS-NEG-V1: modelo salvo é limpo (tipo desconhecido e pergunta vazia saem; opções por vírgula; seção não é obrigatória)', n.nome==='X'&&n.campos.length===2&&n.campos[0].op.join('|')==='a|b|c'&&!n.campos[1].ob);
  let h=''; try{ h=frmNegBloco({id:'fz-c',nome:'Fulano Exemplo',funil:'nn',forms:c.forms}); }catch(e){ h='ERRO '+e.message; }
  ok('FORMS-NEG-V1: bloco da ficha tem título "Formulários" (dobra/ordem/aba nova acham pelo título), lista e ＋ Preencher; sem <details open>', !on()||(/<h3><span>📝 Formulários<\/span>/.test(h)&&/frmAbrir\(/.test(h)&&/frmNovo\(/.test(h)&&!/<details[^>]*\sopen/.test(h)));
}

Object.assign(W,{frmNegBloco,frmSeloHtml,frmResumo,frmNovo,frmCriar,frmAbrir,frmSet,frmSn,frmConcluir,frmReabrir,frmExcluir,frmFechar,frmModelosAbrir,frmModeloEditar,frmModeloDuplicar,frmModeloExcluir,
  frmEd,frmEdCampo,frmEdMover,frmEdTirar,frmEdNovo,frmEdSalvar,frmModelosCarregar,frmSelfTests,FRM_MODELOS:()=>modelos()});
})();
