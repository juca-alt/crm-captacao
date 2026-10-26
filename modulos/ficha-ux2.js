/* ═══ FICHA-UX2-V1 (25/10/2026) — a ficha de sempre reorganizada (Versão A · abas, aprovada na demo design/ficha-ux2-demo.html) ═══
   Palavra dele: "reorganiza a estrutura e tópicos do card… revê e reorganiza botões… usa o Global como inspiração · UX 2.0".
   Decisões: A (abas Negócio · Pessoa · Histórico) · sem abrir/recolher tudo · "Funil e etapa" é tópico recolhível como os outros ·
   Tarefas logo abaixo dele · botões de ação pequenos (pílulas).
   Roda POR CIMA da gaveta que o renderDrawer já desenhou (mesmo desenho do "organizar tópicos"): nenhum campo é reescrito — os
   tópicos de hoje só mudam de lugar, ganham o resumo no cabeçalho fechado e vão pra aba deles. Só na base dele: novoOn('ficha-ux2').
   O vendas.html só carrega este arquivo e chama fichaUx2Aplicar(c) no fim do renderDrawer. */
(function(){
'use strict';
const W=window;
let TAB='neg', ULT_ID=null, MENU=null;

/* ── em que aba mora cada tópico (pela chave do tópico, a mesma do "organizar"); o que não casar fica em Negócio ── */
const REGRAS=[
  ['neg','etapa',/etapa de comercial/],['neg','tarefas',/^tarefas/],['neg','mfo2',/ficha do negocio/],['neg','mfo',/^@mfo$/],['neg','valor',/valor do negocio/],['neg','planos',/planos|simulac/],
  ['neg','sitplan',/sitplan/],['neg','solic',/solicitac/],['neg','drive',/drive/],
  ['pes','negs',/^@negs$/],['pes','quem',/quem e a pessoa/],['pes','dados',/dados da pessoa|^@pj$/],['pes','ance',/qualificacao/],['pes','recdata',/^@recdata$/],
  ['pes','recs',/^recomendac/],['pes','info',/infoclient/],['pes','cart',/^@cart$/],
  ['his','registrar',/registrar contato/],['his','jornada',/jornada/],['his','notas',/^notas/],['his','conv',/^@conv$|whatsapp|conversa/],
  ['mais','excluir',/excluir/],['mais','org',/^@org$/]];
const ORDEM={}; REGRAS.forEach(([t,n],i)=>{ ORDEM[n]=i; });
function chaveDe(el){
  if(el.classList.contains('mn-faixa')) return '@negs';
  if(el.classList.contains('mfo-bl')||el.dataset.ini==='mfo-ficha') return '@mfo';
  if(el.id==='recDataBox') return '@recdata';
  if(el.classList.contains('cli-card')) return '@cart';
  if(el.querySelector&&el.querySelector('#drw-org')&&!el.querySelector('h3')) return '@org';
  if(el.dataset&&el.dataset.sec) return el.dataset.sec;
  const h=el.querySelector&&el.querySelector('h3,summary'); return h?(typeof normKey==='function'?normKey(h.textContent||''):String(h.textContent||'').toLowerCase()):''; }
function lugarDe(el){ const k=chaveDe(el); for(const [t,n,re] of REGRAS) if(re.test(k)) return {t,n,k}; return {t:'neg',n:'',k}; }

/* ── resumos (fechado nunca apaga o número) ── */
const tx=f=>{ try{ return f(); }catch(_){ return ''; } };
const vazio=v=>v==null||!String(v).trim()||/^[—\-\s]+$/.test(String(v));
function ddmm(iso){ const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso||'')); return m?m[3]+'/'+m[2]:''; }
function etapaInfo(c){ let lbl=(typeof ET_LABEL!=='undefined'&&ET_LABEL[c.etapa])||c.etapa||'—', fid=null, id=null;
  if(typeof fuDestino==='function'&&typeof novoOn==='function'&&novoOn('funil-unico')){ const d=tx(()=>fuDestino(c)); if(d&&d.etapa_id){ fid=d.funil_id; id=d.etapa_id; lbl=(ET_LABEL&&ET_LABEL[id])||id; } }
  return {lbl,fid,id}; }
function resumo(n,c){ const t=tx(()=>proxTarefa(c));
  switch(n){
    case 'etapa': { const st=tx(()=>etStatusDe(c)); let ci=''; try{ const k=fuCiclo(c,fuInfo(c,fuDestino(c).funil_id)); if(k) ci=' · ⏱️ '+k.d+'d'; }catch(_){} return `● ${etapaInfo(c).lbl}${st?' · '+st:''}${ci}${t&&t.quando?' · próx. '+ddmm(t.quando):''}`; }
    case 'tarefas': { const n2=tx(()=>tarAbertas(c).length)||0; return n2?`${n2} aberta${n2>1?'s':''}${t&&t.quando?' · '+ddmm(t.quando):''}`:'⚠ sem próxima atividade'; }
    case 'valor': { const pm=tx(()=>pmDe(c)), pr=tx(()=>probDe(c)); return pm?`${brl(pm)}/mês · PA ${brl(tx(()=>totalDe(c))||tx(()=>paDe(c))||0)}${pr!==''?' · '+pr+'%':''}`:'sem prêmio'; }
    case 'planos': { const l=Array.isArray(c.planos)?c.planos:[]; return l.length?`${l.length}${l.some(p=>p&&p.status==='Ativado')?' · 1 ativada':''}`:'nenhuma'; }
    case 'sitplan': return c.sitplan?'na lista de '+ddmm(c.sitplan):'fora da lista';
    case 'ance': { const e=tx(()=>estrelasDe(c))||0; return `${e}/5${e>=4?' · 🔥 quente':''}${c.mercado?' · Mercado '+c.mercado:''}`; }
    case 'quem': return '';
    case 'mfo2': { const ramos=(c.ramos||[]).map(k=>tx(()=>mfoRamoRot(k,true))||k).join(', '); const o=c.mfo_ficha||{}; return [ramos||'sem ramo',c.fecha_por?'fecha por '+c.fecha_por:'',o.premio_total?'prêmio '+o.premio_total:'',(o.pendencias||[]).filter(x=>!x.ok).length?(o.pendencias||[]).filter(x=>!x.ok).length+' pendência(s)':''].filter(Boolean).join(' · '); }
    case 'notas': { const s=String(c.notas||'').trim(); return s?s.slice(0,32)+(s.length>32?'…':''):'vazio'; }
    case 'registrar': { const l=(Array.isArray(c.interacoes)?c.interacoes:[]).filter(i=>i&&typeof RES_BY_K!=='undefined'&&RES_BY_K[i.k]); const u=l[l.length-1]; return u?`último: ${u.l} · ${ddmm(u.dia)}`:'nunca registrado'; }
    default: return ''; } }

/* FICHA-CARD-NOVO-V1 (26/10, palavra dele: "ainda tá esses funis.. já mudamos isso e detalhes do card também"): a ficha
   traz os detalhes do card novo — ⏱️ tempo na etapa + dias no funil e a bolinha de quem toca no cabeçalho — e a troca de
   funil mostra os funis NOVOS (🎯 Vida Individual · 🏢 MFO por linha) no lugar dos 8 funis antigos. */
function cicloChip(c){ try{ if(typeof fuCiclo!=='function'||typeof fuInfo!=='function'||typeof fuDestino!=='function') return ''; const d=fuDestino(c), i=fuInfo(c,d.funil_id), k=fuCiclo(c,i); if(!k) return '';
  return `<span class="u2-chip${k.d>=30?' al':''}" title="Na etapa desde ${esc(tx(()=>dataBR(k.desde))||k.desde)}">⏱️ ${k.d===0?'entrou hoje':k.d+'d'} na etapa${k.tot!=null&&k.tot>k.d?' · '+k.tot+'d no funil':''}</span>`; }catch(_){ return ''; } }
const novoFunilDe=c=>{ try{ return fuDestino(c).funil_id==='mfo'?'mfo':'vi'; }catch(_){ return 'vi'; } };
function u2TrocaFunil(id,v){ const c=(S.contatos||[]).find(x=>String(x.id)===String(id)); if(!c||typeof drwPedirFunil!=='function') return;
  if(v===novoFunilDe(c)) return; drwPedirFunil(v==='vi'?'nn':'mfo'); }
/* OUTROS-NEGOCIOS-V1 (26/10, print dele: "a Sheyla tá no Multi Office e não aparece"): a ficha aberta (no CRM ou no painel do
   WhatsApp, que acha a pessoa pelo telefone) mostra no topo os OUTROS negócios da mesma pessoa — ligados como a mesma pessoa
   OU com o mesmo telefone — e abre qualquer um num toque. */
const dig8=t=>{ const d=String(t||'').replace(/\D/g,''); return d.length>=8?d.slice(-8):''; };
function outrosNegocios(c){ const vis=x=>{ try{ return !x.merged_into&&(typeof escVisivel!=='function'||escVisivel(x)); }catch(_){ return true; } };
  const a=tx(()=>pessoaIrmaos(c))||[], t=dig8(c.telefone), b=t?(S.contatos||[]).filter(x=>x&&x!==c&&String(x.id)!==String(c.id)&&dig8(x.telefone)===t):[];
  const out=[]; a.concat(b).forEach(x=>{ if(x&&vis(x)&&!out.includes(x)) out.push(x); }); return out; }
const LINHA_U2={vg:'VG',prud_demais:'Prud. Demais',mo:'Multi Office'};
function negChip(x){ let fid='vi', lb=''; try{ const d=fuDestino(x); fid=d.funil_id; lb=(typeof ET_LABEL!=='undefined'&&ET_LABEL[d.etapa_id])||d.etapa_id; }catch(_){ lb=x.etapa||''; }
  const lin=fid==='mfo'&&x.linha&&LINHA_U2[x.linha]?' · '+LINHA_U2[x.linha]:'';
  return `<button type="button" class="u2-chip neg" onclick="abrirContato('${esc(jsq(x.id))}')" title="Abrir este negócio">${fid==='mfo'?'🏢 MFO':'🎯 Vida'}${esc(lin)} · ${esc(lb)}</button>`; }
/* ── cabeçalho ── */
function cabecalho(c){ const j=esc(jsq(c.id));
  const quem=[tx(()=>pProfissao(c))||c.profissao,(tx(()=>pIdade(c))||c.idade)?(tx(()=>pIdade(c))||c.idade)+' anos':'',tx(()=>pCidade(c))||c.cidade,c.telefone?tx(()=>telBR(c.telefone))||c.telefone:''].filter(x=>!vazio(x)&&!/^[—\-\s]+ anos$/.test(String(x)));
  const st=tx(()=>etStatusDe(c)), r=tx(()=>recomendanteDe(c)), et=etapaInfo(c);
  const chips=[`<span class="u2-chip et">● ${esc(et.lbl)}</span>`, st?`<span class="u2-chip">${esc(st)}</span>`:'', tx(()=>isQuente(c))?'<span class="u2-chip">🔥 quente</span>':'',
    tx(()=>congEh(c))?'<span class="u2-chip">❄️ congelado</span>':'', tx(()=>negDelayAtivo(c))?'<span class="u2-chip">⏳ delay</span>':'', (typeof isMaster==='function'&&isMaster()&&c.lp)?`<span class="u2-chip">LP: ${esc(tx(()=>lpNome(c.lp)))}</span>`:'', cicloChip(c), tx(()=>fuTocaHtml(c))].join('');
  return `<button class="fechar" onclick="fecharDrawer()" aria-label="Fechar ficha">✕</button>
    <div class="nome">${tx(()=>ehEmpresa(c))?'🏢 ':''}${esc(c.nome||'—')}</div>
    ${quem.length?`<div class="u2-quem">${quem.map(x=>esc(String(x))).join(' · ')}</div>`:''}
    <div class="u2-l3">${ehMfo(c)?'':(typeof fuStarsHtml==='function'?tx(()=>fuStarsHtml(c)):tx(()=>estrelasHtml(estrelasDe(c))))}${chips}</div>
    ${(()=>{ const o=outrosNegocios(c); return o.length?`<div class="u2-negs"><span>Também:</span>${o.slice(0,4).map(negChip).join('')}${o.length>4?`<span>+${o.length-4}</span>`:''}</div>`:''; })()}
    ${r&&r.nome?`<div class="u2-rec">🙌 Recomendado por <b>${esc(r.nome)}</b>${r.cliente?' · <span class="cli">cliente</span>':''}</div>`:''}
    <div class="u2-acoes"><button type="button" class="p" onclick="u2Menu(event,'zap','${j}')">💬 WhatsApp</button><button type="button" onclick="u2Menu(event,'lig','${j}')">☏ Ligar</button><button type="button" onclick="u2Agendar('${j}')">📅 Agendar</button><button type="button" onclick="u2Menu(event,'mais','${j}')">⋯ Mais</button></div>`; }

/* ── trilha de etapas (funil novo quando ligado; senão a esteira de sempre), compacta ── */
function trilha(c){ const j=esc(jsq(c.id)), et=etapaInfo(c);
  if(et.fid&&typeof FUNIL_CFG!=='undefined'&&FUNIL_CFG[et.fid==='mfo'?'fu_mfo':'fu_vi']){
    const L=FUNIL_CFG[et.fid==='mfo'?'fu_mfo':'fu_vi'], fl=L.filter(e=>!e.enc), i=fl.findIndex(e=>e.id===et.id);
    return `<div class="u2-tri" role="group" aria-label="Etapas do funil">${fl.map((e,k)=>`<button type="button" class="u2-st ${k<i?'feita':k===i?'atual':''}" onclick="u2Mover('${j}','${esc(jsq(e.id))}')">${k<i?'✓ ':''}${esc((ET_LABEL&&ET_LABEL[e.id])||e.id)}</button>`).join('')}<button type="button" class="u2-st enc" onclick="u2Menu(event,'enc','${j}')">✖ Encerrar…</button></div>
      <div class="u2-mut">Funil ${et.fid==='mfo'?'MFO':'Vida Individual'} · mexer aqui também atualiza a etapa antiga</div>`; }
  const todas=tx(()=>etapasDe(c))||[], enc=c.funil==='bc'?(typeof ETAPAS_BC_ENCERR!=='undefined'?ETAPAS_BC_ENCERR:[]):(typeof ETAPAS_ENCERR!=='undefined'?ETAPAS_ENCERR:[]);
  const fl=todas.filter(e=>!enc.includes(e)), i=fl.indexOf(c.etapa);
  return `<div class="u2-tri" role="group" aria-label="Etapas">${fl.map((e,k)=>`<button type="button" class="u2-st ${k<i?'feita':k===i?'atual':''}" onclick="mudarEtapa('${esc(jsq(e))}')">${k<i?'✓ ':''}${esc((ET_LABEL&&ET_LABEL[e])||e)}</button>`).join('')}${todas.filter(e=>enc.includes(e)).length?`<button type="button" class="u2-st enc" onclick="u2Menu(event,'enc','${j}')">✖ Encerrar…</button>`:''}</div>`; }

/* ── aplica tudo por cima da gaveta pronta ── */
const ehMfo=c=>{ try{ return typeof fuDestino==='function'&&fuDestino(c).funil_id==='mfo'; }catch(_){ return false; } };
function fichaUx2Aplicar(c){ const dr=document.getElementById('drawer'); if(!dr||!c) return;
  if(ULT_ID!==String(c.id)){ ULT_ID=String(c.id); TAB='neg'; }
  dr.classList.add('ux2'); css(); try{ if(typeof fuCss==='function') fuCss(); }catch(_){}
  /* MFO: os blocos da ficha do negócio (Cliente, Este negócio, Prêmio, Coberturas, Campos do ramo, Cotações, Análise, Pendências)
     viram UM tópico da aba Negócio; a "Ficha MFO" antiga (ramos/fecha por/receita/apólices) já está dentro deles e sai daqui. */
  { const b0=dr.querySelector('.drawer-body');
    if(b0&&ehMfo(c)&&typeof fuMfoBlocosHtml==='function'&&!b0.querySelector('#u2-mfo2')){ let h=''; try{ h=fuMfoBlocosHtml(c); }catch(e){ console.warn('ficha-ux2 mfo',e); }
      if(h){ const sec=document.createElement('div'); sec.className='sec'; sec.id='u2-mfo2'; sec.innerHTML=`<h3>Ficha do negócio (MFO)</h3><div class="fu-pg u2-mfo">${h}</div>`;
        const ant=b0.querySelector('.mfo-bl'); if(ant) ant.replaceWith(sec); else b0.appendChild(sec);
        try{ if(typeof drwSecsWire==='function') drwSecsWire(); }catch(_){} } } }
  const head=dr.querySelector('.drawer-head'); if(head) head.innerHTML=cabecalho(c);
  const body=dr.querySelector('.drawer-body'); if(!body) return;
  const org=typeof DRW_ORG!=='undefined'&&DRW_ORG;
  /* etapa: título novo, a esteira sai do título pro corpo, trilha compacta no lugar dos botões grandes */
  body.querySelectorAll(':scope > .sec[data-sec]').forEach(sec=>{ if(!/etapa de comercial/.test(sec.dataset.sec)) return; const h=sec.querySelector('h3'); if(!h) return;
    const sel=h.querySelector('select'), box=sec.querySelector('#drwFunilBox');
    [...h.childNodes].forEach(n=>{ if(n.nodeType===3&&n.textContent.trim()) n.textContent=''; if(n.nodeType===1&&n.tagName==='SPAN'&&!n.classList.contains('sec-caret')&&!n.classList.contains('u2-res')&&!n.querySelector('select')) n.remove(); });
    if(!h.querySelector('.u2-t')){ const t=document.createElement('span'); t.className='u2-t'; t.textContent='🎯 Funil e etapa'; const car=h.querySelector('.sec-caret'); h.insertBefore(t,car?car.nextSibling:h.firstChild); }
    if(sel){ const w=document.createElement('div'); w.className='u2-esteira';
      const fuOn=typeof novoOn==='function'&&novoOn('funil-unico');
      if(fuOn){   /* FICHA-CARD-NOVO-V1: só os funis novos; o motor da troca segue o de sempre (drwPedirFunil: histórico e valor vão junto) */
        const ops=[['vi','🎯 Vida Individual']].concat((typeof fuMfoOn==='function'&&fuMfoOn())?[['mfo','🏢 MFO']]:[]), cur=novoFunilDe(c), j=esc(jsq(c.id));   /* FUNIL-2-V1 (26/10, "ainda aparece múltiplos funis do MFO"): MFO é UM funil; a linha (VG/Prud/MO) é detalhe do negócio */
        sel.hidden=true;
        w.innerHTML=ops.length>1?`<label for="u2Funil">Funil</label><select id="u2Funil" class="drw-funil-sel" onchange="u2TrocaFunil('${j}',this.value)">${ops.map(([k,t])=>`<option value="${k}" ${k===cur?'selected':''}>${t}</option>`).join('')}</select>`
          :`<span>Funil</span><b style="color:var(--texto,#0f172a)">${esc((ops.find(o=>o[0]===cur)||ops[0])[1])}</b>`;
        w.appendChild(sel); }
      else { w.innerHTML='<label for="drwFunil">Esteira</label>'; w.appendChild(sel); }
      sel.style.maxWidth=''; sel.style.marginLeft=''; (box||h).parentNode.insertBefore(w,box||h.nextSibling); }
    sec.querySelectorAll('.stepper').forEach((s,i)=>{ if(i===0){ const d=document.createElement('div'); d.innerHTML=trilha(c); s.replaceWith(...d.childNodes); } else s.remove(); });
    [...sec.children].forEach(el=>{ if(el.tagName!=='H3'&&el.textContent&&/Toque pra mover/.test(el.textContent)&&!el.querySelector('select,button')) el.remove(); });
    const fech=sec.classList.contains('sec-fechada'); [...sec.children].forEach(el=>{ if(el.tagName!=='H3') el.hidden=fech; }); });
  /* tarefas: o aviso "sem próxima atividade" do título vira o resumo */
  /* distribui nas abas + ordem da aba (a ordem que ele salvou no "organizar" ganha) */
  const kids=[...body.children].filter(el=>!el.classList.contains('pord-hd')&&!el.classList.contains('pord-esc'));
  const temOrdem=tx(()=>drwOrdLer().ordem.length)>0;
  const comLugar=kids.map((el,i)=>({el,i,l:lugarDe(el)}));
  if(!temOrdem&&!org){ const ancora=null; comLugar.slice().sort((a,b)=>{ const oa=a.l.n in ORDEM?ORDEM[a.l.n]:500+a.i, ob=b.l.n in ORDEM?ORDEM[b.l.n]:500+b.i; return oa-ob; }).forEach(x=>body.insertBefore(x.el,ancora)); }
  comLugar.forEach(({el,l})=>{ el.dataset.u2tab=l.t; el.classList.toggle('u2-fora',!org&&l.t!==TAB);
    const h=el.matches('.sec')?el.querySelector(':scope > h3'):null;
    if(h){ h.querySelectorAll(':scope > span').forEach(sp=>{ if(/sem próxima atividade/.test(sp.textContent)) sp.remove(); });
      const r=resumo(l.n,c); let rs=h.querySelector(':scope > .u2-res'); if(r){ if(!rs){ rs=document.createElement('span'); rs.className='u2-res'; h.appendChild(rs); } rs.textContent=r; rs.classList.toggle('al',/^⚠/.test(r)); } } });
  /* abas */
  dr.querySelectorAll(':scope > .u2-tabs').forEach(x=>x.remove());
  if(!org){ const nH=(Array.isArray(c.interacoes)?c.interacoes.length:0);
    const nav=document.createElement('nav'); nav.className='u2-tabs'; nav.setAttribute('role','tablist');
    nav.innerHTML=[['neg','Negócio',''],['pes','Pessoa',''],['his','Histórico',nH||'']].map(([k,t,n])=>`<button type="button" role="tab" aria-selected="${TAB===k}" class="${TAB===k?'on':''}" onclick="u2Tab('${k}')">${t}${n!==''?`<span class="n">${n}</span>`:''}</button>`).join('');
    body.parentNode.insertBefore(nav,body); } }

/* ── ações ── */
function contato(id){ return (S.contatos||[]).find(x=>String(x.id)===String(id))||null; }
function redesenha(){ try{ if(typeof CONTATO!=='undefined'&&CONTATO&&document.getElementById('drawer').classList.contains('aberto')) renderDrawer(); }catch(_){} }
function u2Tab(k){ TAB=k; const dr=document.getElementById('drawer'); if(!dr) return;
  dr.querySelectorAll('.drawer-body > [data-u2tab]').forEach(el=>el.classList.toggle('u2-fora',el.dataset.u2tab!==k));
  dr.querySelectorAll('.u2-tabs button').forEach((b,i)=>{ const on=['neg','pes','his'][i]===k; b.classList.toggle('on',on); b.setAttribute('aria-selected',on); });
  const b=dr.querySelector('.drawer-body'); if(b) b.scrollTop=0; }
function u2Mover(id,X){ if(typeof fuMover!=='function') return; fuMover(id,X); setTimeout(redesenha,0); }
function u2Agendar(id){ const c=contato(id); if(!c) return;
  if(typeof fuAgendarModal==='function'){ fuAgendarModal(id,'agendou_reuniao'); return; }
  if(typeof abrirContatoTarefa==='function') abrirContatoTarefa(id); }
function u2Res(id,k){ fechaMenu(); const c=contato(id); if(!c) return;
  if(/^agendou_/.test(k)&&typeof fuAgendarModal==='function'){ fuAgendarModal(id,k); return; }
  if(typeof registrarResultado==='function') registrarResultado(id,k); setTimeout(redesenha,0); }
function u2Delay(id){ fechaMenu(); const c=contato(id); if(!c) return;
  if(negDelayAtivo(c)){ negDelayLimpar(c); toast('Delay tirado',true); } else { const ate=negDelayMarcar(c,null,''); toast('⏳ Delay até '+dataBR(ate),true); }
  salvar(); redesenha(); }
function fechaMenu(){ if(MENU){ MENU.remove(); MENU=null; } }
function u2Menu(ev,q,id){ ev.stopPropagation(); fechaMenu(); const c=contato(id); if(!c) return; const j=esc(jsq(c.id));
  const R=typeof RESULTADOS!=='undefined'?RESULTADOS:[], tel=c.telefone||'', th=tx(()=>telHref(tel)), wa=tx(()=>waHref(tel));
  const res=l=>l.map(r=>`<button type="button" onclick="u2Res('${j}','${r.k}')">${esc(r.l)}</button>`).join('');
  let h='';
  if(q==='lig') h=tel?`<div class="mh">${esc(tx(()=>telBR(tel))||tel)}</div>${th?`<a href="${esc(th)}">📞 Ligar agora</a>`:''}<div class="mh">Como foi?</div>${res(R.filter(r=>!r.wa))}`:'<div class="mh">Sem telefone nesta ficha</div>';
  else if(q==='zap') h=`<div class="mh">WhatsApp · nada é enviado sozinho</div>${wa?`<a href="${esc(wa)}" target="_blank" rel="noopener">Abrir conversa</a>`:''}<button type="button" onclick="u2Fecha();msgProntaContato('${j}','abordagem')">Mensagem pronta</button><div class="mh">Registrar</div>${res(R.filter(r=>r.wa))}`;
  else if(q==='mais') h=`<div class="mh">Este negócio</div>${tx(()=>congEh(c))?`<button type="button" onclick="u2Fecha();congDescongelar('${j}')">☀️ Descongelar</button>`:(tx(()=>etEhEnc(c))?'':`<button type="button" onclick="u2Fecha();congAbrir('${j}')">❄️ Congelar oportunidade</button>`)}
     <button type="button" onclick="u2Delay('${j}')">⏳ ${tx(()=>negDelayAtivo(c))?'Tirar o delay':'Delay (remarcou)'}</button><button type="button" onclick="u2Fecha();drwOrgModo(true)">⋮⋮ Organizar tópicos</button><button type="button" class="perigo" onclick="u2Fecha();negExcluir('${j}')">🗑 Excluir oportunidade</button>`;
  else if(q==='enc'){ const et=etapaInfo(c);
    if(et.fid){ const L=(FUNIL_CFG[et.fid==='mfo'?'fu_mfo':'fu_vi']||[]).filter(e=>e.enc); h=`<div class="mh">Encerrar · pede o motivo</div>${L.map(e=>`<button type="button" onclick="u2Fecha();u2Mover('${j}','${esc(jsq(e.id))}')">${esc((ET_LABEL&&ET_LABEL[e.id])||e.id)}</button>`).join('')}`; }
    else { const enc=c.funil==='bc'?(typeof ETAPAS_BC_ENCERR!=='undefined'?ETAPAS_BC_ENCERR:[]):(typeof ETAPAS_ENCERR!=='undefined'?ETAPAS_ENCERR:[]); h=`<div class="mh">Encerrar</div>${(tx(()=>etapasDe(c))||[]).filter(e=>enc.includes(e)).map(e=>`<button type="button" onclick="u2Fecha();mudarEtapa('${esc(jsq(e))}')">${esc((ET_LABEL&&ET_LABEL[e])||e)}</button>`).join('')}`; } }
  const m=document.createElement('div'); m.className='u2-menu'; m.setAttribute('role','menu'); m.innerHTML=h; document.body.appendChild(m); MENU=m;
  const r=ev.currentTarget.getBoundingClientRect(), w=m.offsetWidth, hh=m.offsetHeight;
  let x=Math.min(r.left,innerWidth-w-12), y=r.bottom+6; if(y+hh>innerHeight-10) y=Math.max(10,r.top-hh-6); m.style.left=Math.max(12,x)+'px'; m.style.top=y+'px'; }
function u2Fecha(){ fechaMenu(); }
document.addEventListener('click',e=>{ if(MENU&&!MENU.contains(e.target)) fechaMenu(); });
document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&MENU){ fechaMenu(); e.stopPropagation(); } },true);

/* ── estilo (escopo #drawer.ux2) ── */
function css(){ if(document.getElementById('u2-css')) return; const s=document.createElement('style'); s.id='u2-css'; s.textContent=`
#drawer.ux2 .drawer-head{display:flex;flex-direction:column;gap:7px;padding-bottom:12px}
#drawer.ux2 .drawer-head .nome{padding-right:48px;font-size:19px;line-height:1.25}
.u2-quem{font-size:13px;opacity:.85}
.u2-l3{display:flex;align-items:center;gap:7px;flex-wrap:wrap}
.u2-chip{display:inline-flex;align-items:center;border-radius:999px;padding:2px 9px;font-size:11.5px;font-weight:600;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.18);white-space:nowrap}
.u2-chip.et{background:var(--primary,#2563eb);border-color:var(--primary,#2563eb)}
.u2-chip.al{background:rgba(220,38,38,.22);border-color:rgba(248,113,113,.55)}
.u2-negs{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;opacity:.95}
.u2-chip.neg{cursor:pointer;background:rgba(167,139,250,.22);border-color:rgba(196,181,253,.55);color:#fff;font-family:inherit}
.u2-chip.neg:hover{background:rgba(167,139,250,.38)}
@media (max-width:760px){.u2-chip.neg{min-height:44px}}
.u2-l3 .fu-toca{margin-left:auto}
.u2-rec{font-size:12.5px;opacity:.85}.u2-rec .cli{color:#86efac;font-weight:600}
.u2-acoes{display:flex;gap:6px;flex-wrap:wrap;margin-top:2px}
.u2-acoes button{min-height:34px;padding:0 12px;border-radius:999px;background:rgba(255,255,255,.1);color:#fff;font-weight:600;font-size:12.5px;display:inline-flex;align-items:center;gap:5px;border:1px solid rgba(255,255,255,.2);white-space:nowrap;cursor:pointer}
.u2-acoes button.p{background:var(--primary,#2563eb);border-color:var(--primary,#2563eb)}
.u2-acoes button:hover{background:rgba(255,255,255,.18)}.u2-acoes button.p:hover{filter:brightness(1.08)}
#drawer.ux2 .u2-tabs{display:flex;gap:2px;background:var(--card,#fff);border-bottom:1px solid var(--linha);padding:0 8px;flex:0 0 auto;overflow-x:auto}
.u2-tabs button{padding:0 14px;min-height:44px;font-weight:600;font-size:14px;color:var(--muted);border:0;border-bottom:2px solid transparent;background:none;white-space:nowrap;cursor:pointer}
.u2-tabs button.on{color:var(--primary,#2563eb);border-bottom-color:var(--primary,#2563eb)}
.u2-tabs .n{font-weight:500;font-size:12px;color:var(--muted);margin-left:4px}
#drawer.ux2 .drawer-body > .u2-fora{display:none!important}
#drawer.ux2 .fu-pg.u2-mfo{position:static;transform:none;visibility:visible;width:auto;box-shadow:none;background:transparent;padding:0;overflow:visible;display:flex;flex-direction:column;gap:8px;height:auto;border-radius:0;transition:none;z-index:auto}
#drawer.ux2 .fu-pg.u2-mfo::before{display:none}
#drawer.ux2 .sec > h3.sec-h{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
#drawer.ux2 .sec.sec-fechada > :not(h3){display:none!important}
#drawer.ux2 .sec > h3{text-transform:none;letter-spacing:0;font-size:14px;font-weight:700;color:var(--texto,#0f172a);margin:0;min-height:28px}
#drawer.ux2 .sec.sec-fechada{padding-top:12px;padding-bottom:12px}
#drawer.ux2 .sec > details > summary{font-size:14px!important;font-weight:700;list-style:none;display:flex;align-items:center;gap:8px;flex-wrap:wrap;min-height:28px}
#drawer.ux2 .sec > details > summary::-webkit-details-marker{display:none}
#drawer.ux2 .sec > details > summary::before{content:'▸';color:var(--muted);font-size:12px}#drawer.ux2 .sec > details[open] > summary::before{content:'▾'}
#drawer.ux2 .sec > details > summary > span{margin-left:auto;font-size:12px!important;text-align:right}
.u2-res{margin-left:auto;font-size:12px;font-weight:500;color:var(--muted);text-transform:none;letter-spacing:0;text-align:right;max-width:60%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.u2-res.al{color:#c2410c;font-weight:600}
.u2-esteira{display:flex;align-items:center;gap:8px;margin:2px 0 8px;font-size:12px;color:var(--muted)}.u2-esteira select{flex:1;min-width:0}
.u2-tri{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;padding:2px 0 4px}.u2-tri::-webkit-scrollbar{display:none}
.u2-st{flex:0 0 auto;min-height:36px;padding:0 11px;border-radius:9px;font-size:13px;font-weight:600;background:var(--fundo,#f1f5f9);color:#334155;border:1px solid var(--linha);cursor:pointer}
.u2-st.feita{background:#eff6ff;color:#1d4ed8;border-color:#bfdbfe}
.u2-st.atual{background:var(--primary,#2563eb);color:#fff;border-color:var(--primary,#2563eb)}
.u2-st.enc{color:var(--verm,#dc2626);background:var(--card,#fff);border-style:dashed}
.u2-mut{font-size:11.5px;color:var(--muted);margin:-2px 0 6px}
.u2-menu{position:fixed;z-index:120;background:var(--card,#fff);border:1px solid var(--linha);border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.2);padding:6px;min-width:230px;max-width:calc(100vw - 24px);display:flex;flex-direction:column;color:var(--texto,#0f172a)}
.u2-menu .mh{font-size:11px;color:var(--muted);font-weight:700;padding:6px 10px;letter-spacing:.04em;text-transform:uppercase}
.u2-menu button,.u2-menu a{text-align:left;padding:0 10px;min-height:40px;border-radius:8px;font-size:13.5px;background:none;border:0;cursor:pointer;color:inherit;text-decoration:none;display:flex;align-items:center}
.u2-menu button:hover,.u2-menu a:hover{background:var(--fundo,#f1f5f9)}.u2-menu .perigo{color:var(--verm,#dc2626)}
@media (max-width:760px){
  .u2-acoes{display:grid;grid-template-columns:repeat(4,1fr)}.u2-acoes button{min-height:44px;justify-content:center;padding:0 4px;font-size:12px}
  .u2-st,.u2-menu button,.u2-menu a{min-height:44px}.u2-tabs button{flex:1}
  .u2-res{max-width:52%}
}
/* FICHA-WA-V1 (26/10, print dele no WhatsApp: "reorganiza a extensão pro formato novo"): o painel da extensão tem ~440px mas
   roda no COMPUTADOR, com mouse — então usa densidade de desktop (sem os 44px/16px do celular) e nada corta pela direita:
   as etapas quebram linha. Só vale dentro da extensão (html.modo-wa). */
html.modo-wa #drawer.ux2 .drawer-head{padding:12px 14px 10px!important;gap:5px}
html.modo-wa #drawer.ux2 .drawer-head .nome{font-size:16px;padding-right:40px}
html.modo-wa #drawer.ux2 .drawer-head .fechar{width:32px;height:32px;min-height:32px;top:8px;right:8px}
html.modo-wa .u2-quem,html.modo-wa .u2-rec{font-size:12px}
html.modo-wa .u2-chip{font-size:11px;padding:1px 8px}
html.modo-wa .u2-chip.neg{min-height:26px!important}
html.modo-wa .u2-acoes{display:flex!important;gap:5px}
html.modo-wa .u2-acoes button{min-height:30px!important;padding:0 10px!important;font-size:12px!important;flex:1 1 auto;justify-content:center}
html.modo-wa .u2-tabs button{min-height:36px!important;font-size:13px;flex:1;padding:0 8px}
html.modo-wa .u2-tri{flex-wrap:wrap;overflow:visible}
html.modo-wa .u2-st{min-height:28px!important;padding:0 8px;font-size:12px;border-radius:7px}
html.modo-wa .u2-l3 .fu-toca{width:26px!important;height:26px!important;font-size:10.5px!important}
html.modo-wa #drawer .drawer-body{padding:8px 10px!important}
html.modo-wa #drawer .drawer-body > .sec{padding:9px 11px!important;margin-bottom:7px!important;border-radius:10px}
html.modo-wa #drawer.ux2 .sec > h3,html.modo-wa #drawer.ux2 .sec > details > summary{font-size:13px!important;min-height:24px}
html.modo-wa .u2-res{font-size:11.5px}
html.modo-wa #drawer :is(input:not([type=checkbox]):not([type=radio]),select,textarea){font-size:13.5px!important;min-height:32px!important;padding-top:4px!important;padding-bottom:4px!important}
html.modo-wa #drawer :is(.btn,.btn-mini,.nc-pill,.tarchip){min-height:30px!important;font-size:12.5px!important}
html.modo-wa #drawer .btn{padding:0 10px!important}
html.modo-wa .u2-esteira{flex-wrap:wrap}
html.modo-wa .u2-menu button,html.modo-wa .u2-menu a{min-height:34px!important}`; document.head.appendChild(s); }

function fichaUx2SelfTests(ok){
  { const _c=S.contatos; try{ const a={id:'u2n-a',nome:'Fulano A',funil:'nn',etapa:'TA',telefone:'(81) 90000-7777'}, b={id:'u2n-b',nome:'Fulano B',funil:'mfo',etapa:'Proposta',linha:'mo',telefone:'81900007777'}, z={id:'u2n-z',nome:'Outro',funil:'nn',etapa:'TA',telefone:'81900001111'};
      S.contatos=[a,b,z]; const o=outrosNegocios(a);
      ok('OUTROS-NEGOCIOS-V1: a ficha acha o outro negócio da mesma pessoa pelo telefone (Vida → MFO · Multi Office) e não pega quem tem outro número', o.length===1&&o[0].id==='u2n-b'&&/MFO · Multi Office/.test(negChip(b))); } finally{ S.contatos=_c; } }
  ok('FICHA-CARD-NOVO-V1: a troca de funil da ficha mostra os funis novos (Vida Individual; MFO por linha VG/Prud/Multi Office) e o painel da extensão quebra as etapas em vez de cortar', novoFunilDe({funil:'nn',etapa:'TA'})==='vi'&&novoFunilDe({funil:'bc',etapa:'Clientes Ativos'})==='vi'&&typeof u2TrocaFunil==='function'&&/html\.modo-wa \.u2-tri\{flex-wrap:wrap/.test(document.getElementById('u2-css')?document.getElementById('u2-css').textContent:(css(),document.getElementById('u2-css').textContent)));
  ok('FICHA-UX2: cada tópico de hoje tem aba (Funil e etapa → Tarefas no topo de Negócio; ANCE em Pessoa; Jornada em Histórico; Excluir vai pro ⋯ Mais)',
    ['etapa de comercializacao','tarefas & atividades','valor do negocio','planos & simulacoes','sitplan / lista de discagem','quem e a pessoa','qualificacao ance','recomendacoes','infoclient (fact finding)','registrar contato','jornada','notas','excluir esta oportunidade']
      .map(k=>{ const d=document.createElement('div'); d.className='sec'; d.dataset.sec=k; return lugarDe(d).t; }).join()==='neg,neg,neg,neg,neg,pes,pes,pes,pes,his,his,his,mais'
    && ORDEM.etapa<ORDEM.tarefas&&ORDEM.tarefas<ORDEM.valor);
  const r=resumo('tarefas',{tarefas:[]}), r2=resumo('ance',{ance:{a:true,n:true,c:true,e:true},mercado:'X'});
  ok('FICHA-UX2: tópico fechado leva o resumo (sem tarefa = ⚠; ANCE com estrelas, quente e mercado)', /^⚠/.test(r)&&/4\/5/.test(r2)&&/quente/.test(r2)&&/Mercado X/.test(r2));
  const h=cabecalho({id:'u2t',nome:'Fulano de Tal',telefone:'81900001111',etapa:'C2',funil:'nn',tarefas:[],interacoes:[]});
  ok('FICHA-UX2: cabeçalho = identidade + 4 ações iguais (WhatsApp, Ligar, Agendar, ⋯ Mais), sem abrir/recolher tudo', /💬 WhatsApp/.test(h)&&/☏ Ligar/.test(h)&&/📅 Agendar/.test(h)&&/⋯ Mais/.test(h)&&!/Expandir tudo|Recolher tudo/.test(h));
}

Object.assign(W,{u2TrocaFunil,fichaUx2Aplicar,fichaUx2SelfTests,u2Tab,u2Mover,u2Agendar,u2Res,u2Delay,u2Menu,u2Fecha});
})();
