/* ═══ AGENDA-GLOBAL-V1 (26/10/2026) — Agenda & Tarefas no padrão do Global CRM ══════════════════════════════════
   Desenho aprovado por ele na demo (design/agenda-tarefas-demo.html — "agenda ok"). Padrões que ele confirmou:
   abre em SEMANA; no celular a Semana = 3 dias + a tira dos 7 dias; lembrete padrão pro cliente: reunião → pedir
   confirmação na véspera, entrega de apólice → só lembrar na véspera, ligação → sem lembrete; grade das 7h às 21h,
   semana começa na segunda. O link público pro cliente marcar sozinho fica "em breve" (desligado — fase B).

   Mora num arquivo próprio pra não brigar com a sessão paralela no vendas.html: o vendas.html só carrega, roteia
   (VIEW 'ag-global') e põe no menu atrás de novoOn('agenda-global'). A Agenda de hoje (viewAgenda) fica intacta.

   DADOS — nenhuma tabela nova. Tudo vive na atividade do contato (c.tarefas → jsonb de lp_contatos, a mesma
   persistência de sempre), em campos EXTRAS que a atividade antiga não tem e lê com padrão:
     t.st     'pendente' | 'andamento'          (t.feito ⇒ Concluída; sem campo ⇒ Pendente)
     t.prio   'alta' | 'media' | 'baixa'        (sem campo ⇒ média)
     t.check  [{t:'texto', ok:false}]           checklist curto
     t.resp   'eu' | 'victor'                   (sem campo ⇒ quem marcou: marcado pelo delegado ⇒ Victor; senão eu)
     t.lemb   {modo:'lembrar'|'confirmar', quando:'vespera'|'dia', estado:null|'aguardando'|'confirmou'|'remarcar'|'enviado', tid}
              tid = a atividade-lembrete do GC-25 (tarAgendarLembrete), que leva o lembrete pro Google Tarefas e pra
              Agenda antiga; ela ganha t.lembDe (id da reunião) e some das listas daqui (o selo na reunião a representa).
   Criar · editar · concluir · reabrir · remarcar · remover passam pelas funções do app (tarCriar, tarEditar,
   tarConcluir, tarReabrir, tarRemover, gsyncMudou, reunFinalizar, gcalMoverEvento…) → a fila do Google
   (GCAL-BIDIRECIONAL) e o delegado (AGENDA-DELEGADO-V1/V2) seguem valendo sem nada novo aqui.
   O CRM NUNCA manda WhatsApp sozinho: prepara o texto, ele toca e o WhatsApp abre.
   Tarefa SEM cliente = Tarefa do Google avulsa (agAvulsas/gtCriarAvulsa) — prioridade/checklist só em tarefa ligada
   a um contato (não há onde guardar sem tabela nova). */
(function(){
'use strict';
const W=window;
const H0=7, H1=21, MOB='(max-width:760px)';
const DS=['dom','seg','ter','qua','qui','sex','sáb'], DSL=['domingo','segunda','terça','quarta','quinta','sexta','sábado'];
const MES=['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'];
const MESL=['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const pz=n=>String(n).padStart(2,'0');
const dt=i=>{ const p=String(i).split('-').map(Number); return new Date(p[0],p[1]-1,p[2]); };
const isoD=D=>D.getFullYear()+'-'+pz(D.getMonth()+1)+'-'+pz(D.getDate());
const add=(i,n)=>{ const D=dt(i); D.setDate(D.getDate()+n); return isoD(D); };
const dow=i=>dt(i).getDay();
const segDa=i=>add(i,-((dow(i)+6)%7));            /* a semana começa na SEGUNDA */
const br=i=>{ const p=String(i).split('-'); return p[2]+'/'+p[1]; };
const entre=(a,b)=>Math.round((dt(b)-dt(a))/864e5);
const m2=h=>{ const p=String(h||'0:0').split(':').map(Number); return (p[0]||0)*60+(p[1]||0); };
const hm=m=>pz(Math.floor(m/60))+':'+pz(m%60);
const durTxt=d=>d<60?d+' min':(d%60?Math.floor(d/60)+'h'+pz(d%60):d/60+'h');
const M=()=>{ try{ return W.matchMedia(MOB).matches; }catch(_){ return false; } };
const tx=fn=>{ try{ return fn(); }catch(_){ return null; } };
const J=s=>esc(jsq(String(s==null?'':s)));
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const HJ=()=>hojeISO();
const pnome=c=>String((c&&c.nome)||'').trim().split(' ')[0];

/* ── categorias (a cor segue a etiqueta que ele já usa no Google: OI/FF, P/C, C2, DELIVERY, TA) ── */
const CAT={
  oi:     {l:'Reunião OI',ico:'🤝',cor:'#2563eb',bg:'#dbeafe'},
  pc:     {l:'Reunião PC',ico:'🤝',cor:'#7c3aed',bg:'#ede9fe'},
  c2:     {l:'Reunião C2',ico:'🤝',cor:'#0d9488',bg:'#ccfbf1'},
  entrega:{l:'Entrega de apólice',ico:'🛡️',cor:'#16a34a',bg:'#dcfce7'},
  reun:   {l:'Reunião',ico:'🤝',cor:'#0369a1',bg:'#e0f2fe'},
  ligar:  {l:'Ligação',ico:'📞',cor:'#d97706',bg:'#fef3c7'},
  outro:  {l:'Outras atividades',ico:'✳️',cor:'#c2410c',bg:'#fff7ed'},
  google: {l:'Google (sem cliente)',ico:'🔒',cor:'#64748b',bg:'#f1f5f9'}
};
const CAT_ORD=['oi','pc','c2','entrega','reun','ligar','outro','google'];
const sty=k=>{ const t=CAT[k]||CAT.outro; return `--c:${t.cor};--bg:${t.bg}`; };
/* reunião: a categoria vem da ETAPA do negócio (o mesmo mapa canônico do título no Google — reuniaoPrefixoDe) */
function aggCat(c,t){ if(!t) return 'outro'; if(t.tipo==='ligar'||t.tipo==='ligacao') return 'ligar'; if(t.tipo!=='reuniao') return 'outro';
  if(c&&c.etapa==='C2') return 'c2';
  const p=tx(()=>reuniaoPrefixoDe(c)); if(!p) return 'reun';
  if(p.pfx==='[DELIVERY]') return 'entrega'; if(p.pfx==='[OI/FF]'||p.pfx==='[RCP/FF]') return 'oi'; return 'pc'; }
const TST=[['pendente','Pendente','#94a3b8'],['andamento','Em andamento','#2563eb'],['concluida','Concluída','#16a34a']];
const PRIO={alta:['Alta','#dc2626'],media:['Média','#d97706'],baixa:['Baixa','#94a3b8']};
const DUR_PAD={reuniao:60,ligar:15,whats:15,proposta:30,follow:15,outro:30};

/* ── estado da tela (memória) + preferências por aparelho ── */
const PREF='crmlp_agg_prefs_v1', DOBRA='crmlp_agg_dobras_v1';
const AGG={aba:'agenda',modo:'semana',cur:'',ocultos:new Set(),tarModo:'lista',tarResp:'todas',ktab:'pendente',ckAb:{},
  pilha:[],shk:'',F:{},TF:{},RG:{},MSG:{},D:null,G:[],IDX:{},gPedido:'',viu:false};
W.AGG_STATE=AGG;
(function(){ try{ const o=JSON.parse(localStorage.getItem(PREF)||'null'); if(o){ if(Array.isArray(o.ocultos)) AGG.ocultos=new Set(o.ocultos.map(String));
  if(o.tarModo==='quadro') AGG.tarModo='quadro'; if(['todas','minhas','victor'].includes(o.tarResp)) AGG.tarResp=o.tarResp; } }catch(_){} })();
function prefGravar(){ try{ localStorage.setItem(PREF,JSON.stringify({ocultos:[...AGG.ocultos],tarModo:AGG.tarModo,tarResp:AGG.tarResp})); }catch(_){} }
function dobraSt(){ try{ return JSON.parse(localStorage.getItem(DOBRA)||'{}')||{}; }catch(_){ return {}; } }
/* BLOCO DOBRÁVEL NASCE FECHADO: a fonte única é dobraAberta() do app; aqui só se guarda a escolha dele por aparelho */
function aberta(k){ try{ return dobraAberta(k,dobraSt()); }catch(_){ return false; } }

/* ═══════════ regras (puras — o autoteste afirma estas) ═══════════ */
function aggStatus(t){ if(!t) return 'pendente'; if(t.feito) return 'concluida'; return t.st==='andamento'?'andamento':'pendente'; }
function aggStatusPlano(t,para){ const de=aggStatus(t);
  if(!TST.some(s=>s[0]===para)||de===para) return {de,para:de,concluir:false,reabrir:false,nada:true};
  return {de,para,concluir:para==='concluida',reabrir:de==='concluida',nada:false}; }
function aggPrio(t){ return (t&&PRIO[t.prio])?t.prio:'media'; }
function aggResp(c,t){ if(t&&(t.resp==='eu'||t.resp==='victor')) return t.resp;
  const por=String((t&&t.por)||'').toLowerCase(), dono=String((c&&c._dono)||'').toLowerCase();
  return (por.includes('@')&&dono&&por!==dono)?'victor':'eu'; }
function aggCheck(t){ return Array.isArray(t&&t.check)?t.check.filter(x=>x&&typeof x.t==='string'):[]; }
function aggLembPadrao(tipo,cat){ if(tipo!=='reuniao') return 'nao'; return cat==='entrega'?'lembrar':'confirmar'; }
function aggLembDia(t){ const L=t&&t.lemb; if(!L||!t.quando) return ''; return L.quando==='dia'?t.quando:add(t.quando,-1); }
/* agendado → (no dia) pronto → mandou: aguardando (pedir confirmação) | enviado (só lembrar) → confirmou | remarcar */
function aggLembEstado(c,t,hoje){ hoje=hoje||HJ(); const L=t&&t.lemb; if(!L||!L.modo||t.feito) return '';
  if(L.estado) return L.estado;
  const lt=(L.tid&&c)?tx(()=>tarDe(c,L.tid)):null; if(lt&&lt.feito) return L.modo==='confirmar'?'aguardando':'enviado';
  if(!t.quando||t.quando<hoje) return '';
  return aggLembDia(t)<=hoje?'pronto':'agendado'; }
const LB={agendado:['agg-lb-ag','🕒 lembrete'],pronto:['agg-lb-pr','📨 lembrete pra mandar hoje'],aguardando:['agg-lb-aw','⏳ aguardando confirmação'],
  confirmou:['agg-lb-ok','✅ confirmou'],remarcar:['agg-lb-rm','🔁 pediu pra remarcar'],enviado:['agg-lb-env','✓ lembrete enviado']};
const LB_ICO={pronto:'📨',aguardando:'⏳',confirmou:'✅',remarcar:'🔁',enviado:'✓'};
function chipLemb(c,t){ const s=aggLembEstado(c,t); if(!s) return ''; const m=LB[s]; const ld=aggLembDia(t), hoje=AGG.D?AGG.D.hoje:HJ();
  const txt=s==='agendado'?m[1]+' '+(ld===add(hoje,1)?'amanhã':br(ld)):m[1]; return `<span class="agg-lb ${m[0]}">${txt}</span>`; }

/* ═══════════ dados da tela (montados uma vez por pintura) ═══════════ */
function coletar(){ const hoje=HJ(), cs=tx(()=>contatosDoLp())||[], lig=new Set();
  cs.forEach(c=>(Array.isArray(c&&c.tarefas)?c.tarefas:[]).forEach(t=>{ if(t&&t.lemb&&t.lemb.tid) lig.add(String(t.lemb.tid)); }));
  const it=[]; cs.forEach(c=>(Array.isArray(c&&c.tarefas)?c.tarefas:[]).forEach(t=>{ if(!t||t.id==null||lig.has(String(t.id))) return;
    it.push({c,t,k:'c:'+c.id+':'+t.id,cat:aggCat(c,t)}); }));
  return {hoje,cs,it,lig}; }
const gOn=()=>typeof GCAL!=='undefined'&&!!GCAL&&!!GCAL.conectado;
/* eventos do Google que NÃO são espelho de atividade do CRM (esses o CRM já mostra) */
function gColetar(D){ if(!gOn()) return []; const crm=new Set(), vis=new Set(), out=[];
  D.cs.forEach(c=>(Array.isArray(c&&c.tarefas)?c.tarefas:[]).forEach(t=>{ if(t&&t.gcalId) crm.add(String(t.gcalId)); if(t&&t.gcalEvId) crm.add(String(t.gcalEvId)); }));
  [...(GCAL.eventos||[]),...((GCAL.mes&&GCAL.mes.itens)||[])].forEach(e=>{ if(!e||!e.id||vis.has(e.id)||e.status==='cancelled') return; vis.add(e.id);
    const p=tx(()=>gcalPriv(e))||{}; if(p.crmTarefa||crm.has(String(e.id))) return; out.push(e); });
  return out; }
function gModelo(e){ const s=e.start||{}, f=e.end||{}; let d=String(s.date||'').slice(0,10), h='', dur=60;
  if(s.dateTime){ const sd=new Date(s.dateTime), ed=f.dateTime?new Date(f.dateTime):new Date(sd.getTime()+36e5); d=isoD(sd); h=hm(sd.getHours()*60+sd.getMinutes());
    dur=Math.max(15,Math.round((ed-sd)/6e4)); if(isoD(ed)!==d) dur=Math.min(dur,24*60-m2(h)); }
  return {k:'g:'+e.id,kind:'g',e,d,h,dur,cat:'google',feito:false,afin:false,tit:e.summary||'(sem título)',pess:tx(()=>gcalClasse(e))==='pessoal'}; }
function cModelo(x){ const t=x.t; return {k:x.k,kind:'c',c:x.c,t,d:t.quando||'',h:t.hora||'',dur:Number(t.dur)||60,cat:x.cat,feito:!!t.feito,
  afin:!!tx(()=>reunPendente(t)),tit:x.c.nome||'—'}; }
function indexar(){ AGG.IDX={}; AGG.D.it.forEach(x=>{ AGG.IDX[x.k]=cModelo(x); }); AGG.G.forEach(e=>{ const m=gModelo(e); AGG.IDX[m.k]=m; }); }
const visCat=k=>!AGG.ocultos.has(k);
function doDia(d){ const out={timed:[],allday:[],tar:[],aniv:[]};
  Object.values(AGG.IDX).forEach(m=>{ if(m.d!==d) return;
    if(m.kind==='c'&&!m.h){ if(visCat('tarefa')&&!m.feito) out.tar.push(m); return; }
    if(m.kind==='g'&&!m.h){ if(visCat('google')) out.allday.push(m); return; }
    if(visCat(m.cat)) out.timed.push(m); });
  out.timed.sort((a,b)=>m2(a.h)-m2(b.h)); out.aniv=anivDoDia(d); return out; }
function anivLista(){ return (tx(()=>agAnivLista())||[]).map(x=>({r:x.r,d:x.d,dia:add(AGG.D?AGG.D.hoje:HJ(),x.d)})); }
function anivDoDia(d){ return (AGG._aniv||[]).filter(a=>a.dia===d); }
function conflito(d,h,dur,ignora){ if(!d||!h) return null; const s=m2(h), f=s+(+dur||60);
  return Object.values(AGG.IDX).find(m=>m.k!==ignora&&m.d===d&&m.h&&!m.feito&&m2(m.h)<f&&m2(m.h)+m.dur>s)||null; }
const nomeM=m=>m.kind==='g'?m.tit:m.tit;
function quandoTxt(d,h){ const hoje=AGG.D?AGG.D.hoje:HJ(), hh=h?' '+h:''; if(!d) return 'sem data'; if(d===hoje) return 'hoje'+hh; if(d===add(hoje,1)) return 'amanhã'+hh;
  if(d===add(hoje,-1)) return 'ontem'+hh; return DS[dow(d)]+' '+br(d)+hh; }
function semProx(){ return (AGG.D?AGG.D.cs:[]).filter(c=>!tx(()=>ETAPAS_ENCERR.includes(c.etapa))&&!tx(()=>ETAPAS_BC_ENCERR.includes(c.etapa))&&tx(()=>semProxAtividade(c))); }
function lembsHoje(){ return AGG.D.it.filter(x=>aggLembEstado(x.c,x.t)==='pronto'); }
function lembsAguard(){ return AGG.D.it.filter(x=>['aguardando','remarcar'].includes(aggLembEstado(x.c,x.t))); }

/* ═══════════ mensagens (o CRM prepara; quem manda é ele) ═══════════ */
function assin(){ const u=tx(()=>user()); return u&&u.nome?String(u.nome).trim().split(' ')[0]:''; }
function fraseTipo(c,t){ const k=aggCat(c,t); return k==='entrega'?'a entrega da sua apólice':t.tipo==='reuniao'?'nossa reunião':(t.tipo==='ligar'||t.tipo==='ligacao')?'nossa ligação':'nosso compromisso'; }
function quandoMsg(t){ const h=HJ(); const rel=t.quando===add(h,1)?'amanhã, ':t.quando===h?'hoje, ':''; return rel+(tx(()=>diaSemanaBR(t.quando))||DSL[dow(t.quando)])+', '+br(t.quando)+(t.hora?', às '+t.hora:''); }
function ondeMsg(c,t){ if(t.tipo==='ligar'||t.tipo==='ligacao') return ' — eu te ligo'; const l=tx(()=>locTexto(locPrincipal(c))); return l?' · 📍 '+l:''; }
function msgLembrete(c,t,modo){ modo=modo||(t.lemb&&t.lemb.modo)||'lembrar'; const a=assin();
  let s=`Oi, ${pnome(c)}! Passando pra lembrar ${fraseTipo(c,t)}: ${quandoMsg(t)}${ondeMsg(c,t)}.`;
  s+=modo==='confirmar'?'\n\nConsegue me confirmar se segue de pé? É só responder 👍. Se precisar mudar, me diga o melhor horário.':'\n\nQualquer imprevisto, me avisa por aqui.';
  return s+'\n\nAté lá!'+(a?' — '+a:''); }
function msgReagendar(c,t){ const a=assin(); return `Oi, ${pnome(c)}! Remarquei ${fraseTipo(c,t)} pra ${quandoMsg(t)}${ondeMsg(c,t)}.\n\nFica bom pra você? Se não, me diga o melhor horário.`+(a?'\n\n— '+a:''); }
function msgCompromisso(c,t){ return tx(()=>tarWaMsg(c,t))||msgLembrete(c,t,'confirmar'); }   /* COMPROMISSO-WA-V1 + CONVITE-CLIENTE-V1 do app */

/* ═══════════ pintura ═══════════ */
const MODO_INICIAL='semana';   /* decisão dele (26/10): a tela abre em Semana */
function entrar(){ AGG.aba='agenda'; AGG.modo=MODO_INICIAL; AGG.cur=HJ(); AGG.viu=true; }
function viewAgendaGlobal(){ aggCss(); arrInstalar(); obsInstalar();
  const main=document.getElementById('main'); if(!main) return;
  /* ENTRAR na tela (vindo de outra) = Semana · hoje · aba Agenda; repintar dentro dela (ação, Google chegando) mantém onde ele está */
  if(!AGG.viu||!main.querySelector(':scope > .agg')) entrar();
  if(!AGG.cur) AGG.cur=HJ();
  gcalGarantir();
  AGG.D=coletar(); AGG.G=gColetar(AGG.D); AGG._aniv=anivLista(); indexar();
  main.innerHTML=`<div class="agg">${topoHTML()}${AGG.aba==='agenda'?agendaHTML():tarefasHTML()}</div>`;
  if(AGG.pilha.length) pintarSheet(false); }
function topoHTML(){ const c=tx(()=>agendaContagem())||{atrasadas:0,aFinalizar:0}, nT=tarItens().filter(x=>!x.t.feito).length+tx(()=>agAvulsas().length)||0;
  const al=(c.atrasadas||0)+(c.aFinalizar||0);
  return `<h1 class="pg">Agenda &amp; Tarefas</h1>
    <div class="sub">Sua agenda do Google + o que está combinado com cada pessoa nos dois funis. Tudo num lugar só.</div>
    ${gstHTML()}
    <div class="agg-abas" role="tablist">
      <button type="button" role="tab" aria-selected="${AGG.aba==='agenda'}" class="${AGG.aba==='agenda'?'on':''}" onclick="aggAba('agenda')">📅 Agenda${al?` <span class="n r">${al}</span>`:''}</button>
      <button type="button" role="tab" aria-selected="${AGG.aba==='tarefas'}" class="${AGG.aba==='tarefas'?'on':''}" onclick="aggAba('tarefas')">☑️ Tarefas <span class="n">${nT}</span></button>
    </div>`; }
function gstHTML(){ const con=gOn();
  return `<div class="agg-gst"><span class="agg-gdot${con?'':' off'}"></span>${con?'<b>Google Agenda conectado</b><span class="agg-mut">o que você marca aqui vai pra lá</span>'
      :'<b>Google Agenda não conectado</b><span class="agg-mut">os compromissos do CRM aparecem; os do Google, depois de conectar</span><button type="button" class="agg-btn" onclick="aggConectar()">🔗 Conectar</button>'}
    <span class="agg-sp"></span><button type="button" class="agg-btn agg-eb" disabled title="Fase B — fica pra depois">🔗 Link pro cliente marcar sozinho <span class="agg-embreve">em breve</span></button></div>${tx(()=>gsyncAvisoHTML())||''}`; }
function kpisHTML(){ const c=tx(()=>agendaContagem())||{atrasadas:0,hoje:0,aFinalizar:0}, ab=(tx(()=>agendaItens())||[]).length;
  return `<div class="agg-kpis">
    <div class="agg-kpi${c.atrasadas?' al':''}"><div class="lbl">Atrasadas</div><div class="num">${c.atrasadas||0}</div><div class="ks">venceram e seguem abertas</div></div>
    <div class="agg-kpi"><div class="lbl">Hoje</div><div class="num">${c.hoje||0}</div><div class="ks">combinado para hoje</div></div>
    <div class="agg-kpi"><div class="lbl">Em aberto</div><div class="num">${ab}</div><div class="ks">no total${c.aFinalizar?' · '+c.aFinalizar+' a finalizar':''}</div></div></div>`; }
function alertasHTML(){ const fin=(tx(()=>reunPendentes())||[]).length, lh=lembsHoje().length, la=lembsAguard().length, sp=semProx().length, an=(AGG._aniv||[]).filter(a=>a.d<=7).length, ch=[];
  if(fin) ch.push(`<button type="button" class="agg-chip r" onclick="aggAbrir('fin')">🤝 <b>${fin}</b> reuni${fin===1?'ão':'ões'} a finalizar</button>`);
  if(lh||la) ch.push(`<button type="button" class="agg-chip a" onclick="aggAbrir('lembretes')">📨 <b>${lh}</b> lembrete${lh===1?'':'s'} pra mandar hoje${la?' · ⏳ '+la+' sem resposta':''}</button>`);
  if(sp) ch.push(`<button type="button" class="agg-chip l" onclick="aggAbrir('semprox')">💤 <b>${sp}</b> sem próxima atividade</button>`);
  if(an) ch.push(`<button type="button" class="agg-chip" onclick="aggAbrir('aniv')">🎂 <b>${an}</b> aniversário${an===1?'':'s'} na semana</button>`);
  return ch.length?`<div class="agg-alertas">${ch.join('')}</div>`:''; }

/* ═══════════ AGENDA ═══════════ */
function agendaHTML(){ const m=M(), modos=[['lista','Lista'],['dia','Dia'],['semana','Semana'],['mes','Mês']];
  const tb=`<div class="agg-tb">
    <div class="agg-seg agg-modos" role="group" aria-label="Modo">${modos.map(x=>`<button type="button" aria-pressed="${AGG.modo===x[0]}" class="${AGG.modo===x[0]?'on':''}" onclick="aggModo('${x[0]}')">${x[1]}</button>`).join('')}</div>
    ${AGG.modo!=='lista'?`<div class="agg-nav"><button type="button" class="agg-btn ico" onclick="aggNavegar(-1)" aria-label="Anterior">‹</button><button type="button" class="agg-btn" onclick="aggHoje()">Hoje</button><button type="button" class="agg-btn ico" onclick="aggNavegar(1)" aria-label="Próximo">›</button><span class="agg-per">${periodoTxt()}</span></div>`:''}
    <span class="agg-sp"></span>
    <button type="button" class="agg-btn p agg-novo" onclick="aggNovo()">＋ Novo compromisso</button></div>`;
  const leg=AGG.modo==='lista'?'':`<div class="agg-leg" role="group" aria-label="Mostrar tipos">${CAT_ORD.filter(k=>k!=='google'||gOn()).map(k=>`<button type="button" class="agg-lg${visCat(k)?'':' off'}" aria-pressed="${visCat(k)}" style="${sty(k)}" onclick="aggTipo('${k}')"><span class="sw"></span>${CAT[k].l}</button>`).join('')}<button type="button" class="agg-lg${visCat('tarefa')?'':' off'}" aria-pressed="${visCat('tarefa')}" style="--c:#c2410c" onclick="aggTipo('tarefa')"><span class="sw"></span>☑️ Sem hora</button></div>`;
  let v=''; const c=AGG.cur;
  if(AGG.modo==='lista') v=listaHTML();
  else if(AGG.modo==='dia') v=m?stripHTML(1)+gradeHTML([c]):`<div class="agg-diaw">${gradeHTML([c])}${ladoHTML(c)}</div>`;
  else if(AGG.modo==='semana') v=m?stripHTML(3)+gradeHTML([0,1,2].map(i=>add(c,i))):gradeHTML([0,1,2,3,4,5,6].map(i=>add(segDa(c),i)));
  else v=m?mesMobHTML():mesHTML();
  return kpisHTML()+alertasHTML()+tb+leg+v; }
function periodoTxt(){ const m=M(), c=AGG.cur, hoje=AGG.D.hoje;
  if(AGG.modo==='dia') return (c===hoje?'Hoje · ':'')+DS[dow(c)]+', '+br(c);
  if(AGG.modo==='semana'){ const a=m?c:segDa(c), b=add(a,m?2:6), da=dt(a), db=dt(b);
    return da.getMonth()===db.getMonth()?`${da.getDate()} – ${db.getDate()} ${MES[db.getMonth()]}`:`${da.getDate()} ${MES[da.getMonth()]} – ${db.getDate()} ${MES[db.getMonth()]}`; }
  const D=dt(c); return MESL[D.getMonth()]+' '+D.getFullYear(); }

/* tira dos 7 dias (celular, Dia e Semana) */
function stripHTML(n){ const s=segDa(AGG.cur), fim=add(AGG.cur,n-1), hoje=AGG.D.hoje;
  return `<div class="agg-strip" role="group" aria-label="Dias da semana">${[0,1,2,3,4,5,6].map(i=>{ const d=add(s,i), x=doDia(d), evs=x.timed, sel=d===AGG.cur, fx=n>1&&d>AGG.cur&&d<=fim;
    return `<button type="button" class="${d===hoje?'hoje ':''}${sel?'sel ':''}${fx?'faixa':''}" onclick="aggDia('${d}')" aria-label="${DSL[dow(d)]} ${br(d)}, ${evs.length} compromissos"><span>${DS[dow(d)]}</span><b>${dt(d).getDate()}</b><span class="dots">${evs.slice(0,4).map(e=>`<i style="--c:${CAT[e.cat].cor}"></i>`).join('')}</span></button>`; }).join('')}</div>`; }

/* grade de horas: Dia = 1 coluna; Semana = 7 no computador / 3 no celular */
function lanes(evs){ const out=[]; let grupo=[], fimG=-1;
  const fecha=()=>{ const ls=[]; grupo.forEach(x=>{ let i=ls.findIndex(f=>f<=x.s); if(i<0){ i=ls.length; ls.push(0); } ls[i]=x.f; x.lane=i; }); grupo.forEach(x=>{ x.nl=ls.length; out.push(x); }); grupo=[]; };
  evs.map(e=>{ const s=Math.max(H0*60,Math.min(H1*60-15,m2(e.h))); return {e,s,f:Math.max(s+15,Math.min(H1*60,m2(e.h)+e.dur))}; })
    .sort((a,b)=>a.s-b.s||b.f-a.f).forEach(x=>{ if(grupo.length&&x.s>=fimG) fecha(); grupo.push(x); fimG=Math.max(fimG,x.f); });
  if(grupo.length) fecha(); return out; }
function evTitulo(m,mob){ if(m.kind==='g') return esc(m.tit); const ico=CAT[m.cat].ico; return ico+' '+esc(mob?pnome(m.c):m.tit); }
function evSub(m){ if(m.kind==='g') return m.pess?'Google · ocupado':'Google'; const t=m.t, K=CAT[m.cat];
  const sub=t.tit&&String(t.tit).trim()!==tx(()=>tarNomeTipo(t.tipo))?t.tit:K.l; const por=porOutro(m.c,t);
  return esc(sub)+(por?' · pelo '+esc(por):''); }
function porOutro(c,t){ const p=String((t&&t.por)||'').toLowerCase(), d=String((c&&c._dono)||tx(()=>escEu())||'').toLowerCase();
  return (p.includes('@')&&d&&p!==d)?(tx(()=>lpNome(t.por))||p.split('@')[0]):''; }
function lembIco(m){ return m.kind==='c'?(LB_ICO[aggLembEstado(m.c,m.t)]||''):''; }
function gradeHTML(dias){ const mob=M(), hpx=mob?60:48, nh=H1-H0, hoje=AGG.D.hoje, now=new Date(), agMin=now.getHours()*60+now.getMinutes();
  const hd=dias.map(d=>`<button type="button" class="agg-dh${d===hoje?' hoje':''}" onclick="aggIrDia('${d}')" aria-label="Ver ${DSL[dow(d)]} ${br(d)}"><span>${DS[dow(d)]}</span><b>${dt(d).getDate()}</b></button>`).join('');
  const ad=dias.map(d=>{ const x=doDia(d), ts=x.tar, an=x.aniv, gd=x.allday;
    if(mob){ const n=ts.length+an.length+gd.length; return `<div class="agg-adc">${n?`<button type="button" class="agg-adb${ts.some(m=>m.d<hoje)?' tar at':ts.length?' tar':an.length?' aniv':''}" onclick="aggAbrir('dia','${d}')" aria-label="Dia todo: ${n} item(ns)">${ts.length?'☑️'+ts.length:''}${an.length?' 🎂'+an.length:''}${gd.length?' 📆'+gd.length:''}</button>`:''}</div>`; }
    const chips=[...an.map(a=>`<button type="button" class="agg-adb aniv" onclick="aggAbrir('aniv')" title="Aniversário">🎂 ${esc(pnome({nome:a.r.cliente}))}</button>`),
      ...gd.map(m=>`<button type="button" class="agg-adb" onclick="aggClickEv(event,'${J(m.k)}')" title="${esc(m.tit)}">📆 ${esc(m.tit)}</button>`),
      ...ts.map(m=>`<button type="button" class="agg-adb tar${m.d<hoje?' at':''}" onclick="aggClickEv(event,'${J(m.k)}')" title="${esc(m.tit+' · '+(m.t.tit||''))}">${tx(()=>tarIco(m.t.tipo))||'☑️'} ${esc(pnome(m.c))}</button>`)];
    return `<div class="agg-adc">${chips.slice(0,3).join('')}${chips.length>3?`<button type="button" class="agg-adb tar" onclick="aggAbrir('dia','${d}')">+${chips.length-3}</button>`:''}</div>`; }).join('');
  const eixo=Array.from({length:nh},(_,i)=>i?`<span class="agg-hr" style="top:${i*hpx}px">${pz(H0+i)}:00</span>`:'').join('');
  const cols=dias.map(d=>{ const ls=lanes(doDia(d).timed);
    const evs=ls.map(x=>{ const e=x.e, top=(x.s-H0*60)/60*hpx, h=Math.max((x.f-x.s)/60*hpx-2,mob?44:18), w=100/x.nl, curto=!mob&&(x.f-x.s)<=30;
      const drag=!mob&&!e.feito&&(e.kind==='c'||gOn());
      const li=lembIco(e);
      const cls=['agg-ev',e.feito?'feito':'',e.afin?'afin':'',e.kind==='g'?'google':'',curto?'curto':'',li?'temlb':''].join(' ').replace(/\s+/g,' ');
      return `<button type="button" class="${cls}" data-k="${esc(e.k)}" data-d="${d}" data-min="${m2(e.h)}" data-dur="${e.dur}"${drag?' data-drag="1"':''} style="${sty(e.cat)};top:${top}px;height:${h}px;left:calc(${x.lane*w}% + 2px);width:calc(${w}% - 4px)" onclick="aggClickEv(event,'${J(e.k)}')" aria-label="${esc(CAT[e.cat].l)} · ${esc(nomeM(e))} · ${e.h}">
        <span class="eh">${e.h}${!curto&&!mob?'–'+hm(Math.min(24*60-1,m2(e.h)+e.dur)):''}</span><b>${evTitulo(e,mob)}</b>${curto?'':`<span class="et">${evSub(e)}</span>`}${li?`<span class="elb">${li}</span>`:''}</button>`; }).join('');
    const agora=d===hoje&&agMin>=H0*60&&agMin<=H1*60?`<div class="agg-agora" style="top:${(agMin-H0*60)/60*hpx}px"></div>`:'';
    return `<div class="agg-col${d===hoje?' hoje':''}${[0,6].includes(dow(d))?' fds':''}" data-d="${d}" onclick="aggSlot(event,'${d}')" onmousemove="aggFantasma(event)" onmouseleave="aggFantasmaSai(this)" role="button" tabindex="-1" aria-label="Toque num horário vazio de ${DSL[dow(d)]} ${br(d)} pra marcar">${evs}${agora}<div class="agg-ghost"></div></div>`; }).join('');
  return `<div class="agg-grade" data-h0="${H0}" data-h1="${H1}" style="--n:${dias.length};--nh:${nh};--hpx:${hpx}px">
    <div class="agg-ghd"><div class="agg-ax"></div>${hd}</div>
    <div class="agg-gad"><div class="agg-ax">dia<br>todo</div>${ad}</div>
    <div class="agg-gbody"><div class="agg-ax">${eixo}</div>${cols}</div></div>`; }
function ladoHTML(d){ const hoje=AGG.D.hoje, ts=tarItens().filter(x=>!x.t.feito&&(x.t.quando===d||(d===hoje&&x.t.quando&&x.t.quando<hoje))), fin=d===hoje?(tx(()=>reunPendentes())||[]):[];
  const evs=AGG.D.it.filter(x=>x.t.quando===d&&x.t.hora&&!x.t.feito);
  return `<aside class="agg-lado">
    <div class="agg-cx"><h3>☑️ Tarefas ${d===hoje?'de hoje e atrasadas':'do dia'} <span class="agg-mut">${ts.length}</span></h3>${ts.length?ts.map(tarMini).join(''):'<div class="agg-vz">Nenhuma tarefa vence neste dia.</div>'}
      <button type="button" class="agg-btn" onclick="aggTarNova('${d}')">＋ tarefa neste dia</button></div>
    ${fin.length?`<div class="agg-cx"><h3>🤝 A finalizar <span class="agg-mut">${fin.length}</span></h3>${fin.map(x=>`<div class="agg-srow"><div class="t"><b>${esc(x.c.nome)}</b><span class="agg-mut">${esc(x.t.tit||'Reunião')} · ${quandoTxt(x.t.quando,x.t.hora)}</span></div><button type="button" class="agg-btn p" onclick="aggFinalizar('${J(x.c.id)}','${J(x.t.id)}')">Finalizar</button></div>`).join('')}</div>`:''}
    <div class="agg-cx"><h3>Resumo do dia</h3><div class="agg-mut">${evs.filter(x=>x.t.tipo==='reuniao').length} reunião(ões) · ${evs.filter(x=>x.cat==='ligar').length} ligação(ões) · ${evs.filter(x=>x.cat==='entrega').length} entrega(s)</div>
      <div class="agg-mut">${evs.filter(x=>aggLembEstado(x.c,x.t)==='confirmou').length} confirmada(s) · ${evs.filter(x=>aggLembEstado(x.c,x.t)==='aguardando').length} aguardando resposta</div></div></aside>`; }
function tarMini(x){ const {c,t}=x, at=t.quando&&t.quando<AGG.D.hoje;
  return `<div class="agg-srow"><button type="button" class="agg-ckb${t.feito?' on':''}" role="checkbox" aria-checked="${!!t.feito}" aria-label="Concluir: ${esc(t.tit||'')}" onclick="aggTarFeita('${J(c.id)}','${J(t.id)}')">✓</button><div class="t"><button type="button" class="agg-tnome" onclick="aggTarAbrir('${J(c.id)}','${J(t.id)}')">${esc(t.tit||tx(()=>tarNomeTipo(t.tipo))||'Tarefa')}</button><div class="agg-tmeta">👤 ${esc(c.nome||'')} · <span class="agg-tvenc${at?' at':''}">${vencTxt(t)}</span></div></div></div>`; }

/* mês */
function mesCelulas(){ const D=dt(AGG.cur), pri=isoD(new Date(D.getFullYear(),D.getMonth(),1)), ini=segDa(pri), out=[];
  for(let i=0;i<42;i++){ const d=add(ini,i); if(i>=35&&dt(d).getMonth()!==D.getMonth()) break; out.push({d,fora:dt(d).getMonth()!==D.getMonth()}); } return out; }
function mesHTML(){ const cs=mesCelulas(), hoje=AGG.D.hoje;
  return `<div class="agg-mes"><div class="agg-mes-hd">${['seg','ter','qua','qui','sex','sáb','dom'].map(x=>`<span>${x}</span>`).join('')}</div><div class="agg-mes-g">${cs.map(({d,fora})=>{ const x=doDia(d), evs=x.timed.concat(x.allday);
    return `<div class="agg-mc${fora?' fora':''}${d===hoje?' hoje':''}" onclick="aggCliqueMes(event,'${d}')" title="Toque no vazio pra marcar neste dia"><button type="button" class="mn" onclick="event.stopPropagation();aggIrDia('${d}')" aria-label="Abrir ${br(d)}">${dt(d).getDate()}</button>
      ${x.aniv.map(a=>`<span class="agg-mch" style="--c:#db2777;--bg:#fdf2f8">🎂 ${esc(pnome({nome:a.r.cliente}))}</span>`).join('')}
      ${evs.slice(0,3).map(e=>`<button type="button" class="agg-mch${e.feito?' feito':''}" style="${sty(e.cat)}" onclick="event.stopPropagation();aggClickEv(event,'${J(e.k)}')"><span class="h">${e.h||'dia'}</span> ${esc(e.kind==='g'?e.tit:pnome(e.c))}${lembIco(e)?' '+lembIco(e):''}</button>`).join('')}
      ${x.tar.length?`<span class="agg-mch" style="--c:#c2410c;--bg:#fff7ed">☑️ ${x.tar.length} sem hora</span>`:''}
      ${evs.length>3?`<button type="button" class="agg-mais" onclick="event.stopPropagation();aggIrDia('${d}')">+${evs.length-3} mais</button>`:''}</div>`; }).join('')}</div></div>`; }
function mesMobHTML(){ const cs=mesCelulas(), d0=AGG.cur, x0=doDia(d0), hoje=AGG.D.hoje, evs=x0.timed.concat(x0.allday);
  return `<div class="agg-mm">${['S','T','Q','Q','S','S','D'].map(x=>`<span class="wd">${x}</span>`).join('')}${cs.map(({d,fora})=>{ const e=doDia(d).timed;
    return `<button type="button" class="${fora?'fora ':''}${d===hoje?'hoje ':''}${d===d0?'sel':''}" onclick="aggDia('${d}')" aria-label="${br(d)}, ${e.length} compromissos">${dt(d).getDate()}<span class="dots">${e.slice(0,4).map(m=>`<i style="--c:${CAT[m.cat].cor}"></i>`).join('')}</span></button>`; }).join('')}</div>
  <div class="agg-dl"><h3>${d0===hoje?'Hoje · ':''}${DSL[dow(d0)]}, ${br(d0)}</h3>
    ${evs.map(e=>`<button type="button" class="agg-dlr${e.feito?' feito':''}" style="${sty(e.cat)}" onclick="aggClickEv(event,'${J(e.k)}')"><span class="h">${e.h||'dia'}</span><span class="t"><b>${evTitulo(e,false)}</b><span>${esc(CAT[e.cat].l)}${e.h?' · '+durTxt(e.dur):''}</span></span>${lembIco(e)}</button>`).join('')}
    ${x0.tar.map(m=>`<button type="button" class="agg-dlr" style="--c:#c2410c" onclick="aggClickEv(event,'${J(m.k)}')"><span class="h">☑️</span><span class="t"><b>${esc(m.t.tit||tx(()=>tarNomeTipo(m.t.tipo))||'')}</b><span>${esc(m.c.nome||'')}</span></span></button>`).join('')}
    ${!evs.length&&!x0.tar.length?'<div class="agg-vz">Nada marcado neste dia.</div>':''}
    <div class="agg-row2"><button type="button" class="agg-btn p" onclick="aggNovo('${d0}','09:00')">＋ Marcar neste dia</button><button type="button" class="agg-btn" onclick="aggIrDia('${d0}')">Ver o dia na grade</button></div></div>`; }

/* lista (o modo de hoje, mantido: faixas Atrasadas · Hoje · Amanhã · Próxima semana…, com 📅 Eventos e ☑️ Tarefas) */
function bloco(k,tit,res,corpo,novoDia){ const ab=aberta(k);   /* nasce FECHADO; o cabeçalho leva o resumo */
  return `<div class="agg-bl${ab?'':' fechado'}" data-agg="${esc(k)}"><div class="agg-blhw"><button type="button" class="agg-blh" aria-expanded="${ab}" onclick="aggDobra('${J(k)}')"><span class="car">${ab?'▾':'▸'}</span><span class="tt">${tit}</span><span class="rs">${res}</span></button>${novoDia!=null?`<button type="button" class="agg-btn p agg-blnovo" onclick="aggNovo('${add(AGG.D.hoje,novoDia)}','09:00')" title="Novo já neste dia">＋ Novo</button>`:''}</div><div class="agg-blb">${corpo}</div></div>`; }
const nomes3=l=>{ const t=l.filter(Boolean).slice(0,3).join(' · '); return t?' · '+esc(t)+(l.length>3?' …':''):''; };
function listaHTML(){ const D=AGG.D, ab=D.it.filter(x=>!x.t.feito), out=[], NOVO=(typeof AG_NOVO_DIA!=='undefined'?AG_NOVO_DIA:{hoje:0,amanha:1,semana:7,semanas:14});
  const FX=(typeof AG_FAIXAS!=='undefined'?AG_FAIXAS:[['atrasada','⚠️ Atrasadas'],['hoje','📌 Hoje'],['amanha','→ Amanhã'],['semana','🗓️ Próxima semana'],['semanas','📆 Próximas semanas'],['sem-data','• Sem data']]);
  const fx=iso=>tx(()=>agFaixa(iso))||'sem-data', ord=(a,b)=>String(a.t.quando||'9999').localeCompare(String(b.t.quando||'9999'))||String(a.t.hora||'99:99').localeCompare(String(b.t.hora||'99:99'));
  { const ps=tx(()=>agSolicBloco()); if(ps&&ps[1]) out.push(ps[1]); }   /* SOLIC-TAREFAS-V1 (o bloco do app, como está) */
  const avs=tx(()=>agAvulsas())||[];
  FX.forEach(([k,tit])=>{ const li=ab.filter(x=>fx(x.t.quando)===k).sort(ord);
    const ev=li.filter(x=>tx(()=>gtDestino(x.t))!=='tarefa'), ta=li.filter(x=>tx(()=>gtDestino(x.t))==='tarefa'), av=avs.filter(g=>fx(tx(()=>gtDataDaTarefa(g))||'')===k);
    const fin=ev.filter(x=>tx(()=>reunPendente(x.t))).length, nT=ta.length+av.length, nd=(k in NOVO)?NOVO[k]:null;
    if(!ev.length&&!nT&&nd==null) return;
    const subE=bloco(k+'-evt','📅 Eventos',`<b>${ev.length}</b>${fin?` · <span class="vm">${fin} a finalizar</span>`:''}${nomes3(ev.map(x=>pnome(x.c)))}`,ev.length?ev.map(linhaEv).join(''):'<div class="agg-vz">Nada marcado.</div>');
    const subT=bloco(k+'-tar','☑️ Tarefas',`<b>${nT}</b>${nomes3(ta.map(x=>pnome(x.c)).concat(av.map(g=>String(g.title||'').split(' ')[0])))}`,nT?ta.map(x=>tarLinha(x,true)).join('')+av.map(avLinha).join(''):'<div class="agg-vz">Nada marcado.</div>');
    out.push(bloco(k,tit,`<b>${ev.length+nT}</b> · 📅 ${ev.length} · ☑️ ${nT}${fin?` · <span class="vm">🤝 ${fin} a finalizar</span>`:''}`,subE+subT,nd));
    if(k==='semana'){ const pa=tx(()=>agAnivBloco()); if(pa&&pa[1]) out.push(pa[1]); } });   /* AGENDA-ANIV-V1 (o bloco do app, como está) */
  const sp=semProx();
  if(sp.length) out.push(bloco('semativ','💤 Sem próxima atividade',`<b>${sp.length}</b> · negócio parado é o que mais custa`,sp.slice(0,40).map(semLinha).join('')+(sp.length>40?`<div class="agg-vz">…e mais ${sp.length-40}.</div>`:'')));
  return out.join(''); }
function linhaEv(x){ const {c,t}=x, K=CAT[x.cat], afin=!!tx(()=>reunPendente(t)), at=!afin&&t.quando&&t.quando<AGG.D.hoje, est=aggLembEstado(c,t), por=porOutro(c,t);
  const q=afin?br(t.quando)+' · '+entre(t.quando,AGG.D.hoje)+'d sem desfecho':(tx(()=>tarQuandoTxt(t))||quandoTxt(t.quando,t.hora));
  return `<div class="agg-lin${afin?' afin':''}"><span class="agg-lic" style="${sty(x.cat)}" title="${esc(K.l)}">${K.ico}</span>
    <div class="agg-lm"><button type="button" class="agg-ln" onclick="aggEvAbrir('${J(c.id)}','${J(t.id)}')">${esc(c.nome||'—')}</button>
      <div class="agg-ls"><span class="agg-bd tp" style="${sty(x.cat)}">${esc(t.tit&&String(t.tit).trim()!==tx(()=>tarNomeTipo(t.tipo))?t.tit:K.l)}</span>${tx(()=>badgeEtapa(c.etapa))||''}${chipLemb(c,t)}${por?`<span class="agg-bd vt">marcado pelo ${esc(por)}</span>`:''}${tx(()=>gsyncBadgeHTML(c,t))||''}</div></div>
    <span class="agg-lq ${afin||at?'at':t.quando===AGG.D.hoje?'hj':''}">${esc(q)}</span>
    <div class="agg-la">${afin?`<button type="button" class="agg-btn p" onclick="aggFinalizar('${J(c.id)}','${J(t.id)}')">Finalizar</button>`:''}
      <button type="button" class="agg-btn ico" onclick="aggMandarAbrir('${J(c.id)}','${J(t.id)}','${est==='pronto'?'lembrete':'compromisso'}')" title="WhatsApp com o texto pronto" aria-label="WhatsApp">💬</button>
      ${tx(()=>agAcaoSel(c,t,afin))||''}
      <button type="button" class="agg-btn ico" onclick="aggEditar('${J(c.id)}','${J(t.id)}')" title="Editar" aria-label="Editar">✏️</button></div></div>`; }
function semLinha(c){ return `<div class="agg-lin"><span class="agg-lic">💤</span><div class="agg-lm"><button type="button" class="agg-ln" onclick="aggFicha('${J(c.id)}')">${esc(c.nome||'—')}</button><div class="agg-ls">${tx(()=>badgeEtapa(c.etapa))||''}</div></div><span class="agg-lq"></span>
  <div class="agg-la"><button type="button" class="agg-btn p" onclick="aggProxima('${J(c.id)}')">＋ próxima atividade</button></div></div>`; }
function avLinha(g){ const d=tx(()=>gtDataDaTarefa(g))||'', at=d&&d<AGG.D.hoje;
  return `<div class="agg-trow g${at?' at':''}" style="--pc:#94a3b8"><button type="button" class="agg-ckb" role="checkbox" aria-checked="false" aria-label="Concluir no Google: ${esc(g.title||'')}" onclick="aggAvulsaFeita('${J(g.id)}')">✓</button>
    <div class="agg-tm"><span class="agg-tnome sem">${esc(g.title||'(sem título)')}</span><div class="agg-tmeta"><span class="agg-tvenc${at?' at':''}">${d?(d===AGG.D.hoje?'vence hoje':(at?br(d)+' · atrasada':'vence '+quandoTxt(d))):'sem vencimento'}</span><span class="agg-bd">só no Google</span></div></div><div class="agg-tact"></div></div>`; }

/* ═══════════ TAREFAS ═══════════ */
function tarItens(){ const D=AGG.D; if(!D) return []; const lim=add(D.hoje,-30);
  return D.it.filter(x=>tx(()=>gtDestino(x.t))==='tarefa'&&(!x.t.feito||String(x.t.feito).slice(0,10)>=lim)); }
function tarVis(){ const r=AGG.tarResp; return tarItens().filter(x=>r==='todas'||aggResp(x.c,x.t)===(r==='minhas'?'eu':'victor')); }
const tarAt=t=>!t.feito&&!!t.quando&&t.quando<AGG.D.hoje;
function vencTxt(t){ if(!t.quando) return 'sem vencimento'; if(tarAt(t)) return br(t.quando)+' · atrasada '+entre(t.quando,AGG.D.hoje)+'d'; return 'vence '+quandoTxt(t.quando); }
function tarOrd(a,b){ const pa={alta:0,media:1,baixa:2}; return (tarAt(b.t)-tarAt(a.t))||String(a.t.quando||'9999').localeCompare(String(b.t.quando||'9999'))||(pa[aggPrio(a.t)]-pa[aggPrio(b.t)]); }
function tarefasHTML(){ const vis=tarVis(), ab=vis.filter(x=>!x.t.feito), at=ab.filter(x=>tarAt(x.t)).length, hj=ab.filter(x=>x.t.quando===AGG.D.hoje).length;
  const k=`<div class="agg-kpis"><div class="agg-kpi${at?' al':''}"><div class="lbl">Atrasadas</div><div class="num">${at}</div><div class="ks">venceram e seguem abertas</div></div>
    <div class="agg-kpi"><div class="lbl">Vencem hoje</div><div class="num">${hj}</div><div class="ks">pra resolver hoje</div></div>
    <div class="agg-kpi"><div class="lbl">Abertas</div><div class="num">${ab.length}</div><div class="ks">${ab.filter(x=>aggStatus(x.t)==='andamento').length} em andamento</div></div></div>`;
  const tb=`<div class="agg-tb">
    <div class="agg-seg" role="group" aria-label="De quem">${[['todas','Todas'],['minhas','Minhas'],['victor','Do Victor']].map(x=>`<button type="button" aria-pressed="${AGG.tarResp===x[0]}" class="${AGG.tarResp===x[0]?'on':''}" onclick="aggTarResp('${x[0]}')">${x[1]}</button>`).join('')}</div>
    <div class="agg-seg" role="group" aria-label="Como ver">${[['lista','☰ Lista'],['quadro','▦ Quadro']].map(x=>`<button type="button" aria-pressed="${AGG.tarModo===x[0]}" class="${AGG.tarModo===x[0]?'on':''}" onclick="aggTarModo('${x[0]}')">${x[1]}</button>`).join('')}</div>
    <span class="agg-sp"></span><button type="button" class="agg-btn p agg-novo" onclick="aggTarNova()">＋ Nova tarefa</button></div>`;
  return k+tb+(AGG.tarModo==='lista'?tarListaHTML(vis):tarQuadroHTML(vis)); }
function tarLinha(x,naAgenda){ const {c,t}=x, st=aggStatus(t), pr=aggPrio(t), ck=aggCheck(t), n=ck.length, ok=ck.filter(i=>i.ok).length, at=tarAt(t), resp=aggResp(c,t), ab=!!AGG.ckAb[x.k];
  const wa=t.lembrarReuniao?tx(()=>tarWaHref(c,t)):'';
  return `<div class="agg-trow${at?' at':''}${t.feito?' feita':''}" style="--pc:${PRIO[pr][1]}">
    <button type="button" class="agg-ckb${t.feito?' on':''}" role="checkbox" aria-checked="${!!t.feito}" aria-label="Concluir: ${esc(t.tit||'')}" onclick="aggTarFeita('${J(c.id)}','${J(t.id)}')">✓</button>
    <div class="agg-tm"><button type="button" class="agg-tnome" onclick="aggTarAbrir('${J(c.id)}','${J(t.id)}')">${tx(()=>tarIco(t.tipo))||''} ${esc(t.tit||tx(()=>tarNomeTipo(t.tipo))||'Tarefa')}</button>
      <div class="agg-tmeta"><span class="agg-pr ${pr}">${PRIO[pr][0]}</span><span class="agg-tvenc${at?' at':t.quando===AGG.D.hoje?' hj':''}">${vencTxt(t)}</span><button type="button" class="agg-lnk" onclick="aggFicha('${J(c.id)}')">👤 ${esc(c.nome||'')}</button><span class="agg-av${resp==='victor'?' v':''}" title="${resp==='victor'?'Victor':'Você'}">${resp==='victor'?'V':(esc(assin().charAt(0))||'G')}</span>${naAgenda?'':`<span>${TST.find(s=>s[0]===st)[1]}</span>`}</div></div>
    <div class="agg-tact">${wa?`<a class="agg-btn ico" href="${esc(wa)}" target="_blank" rel="noopener" title="Lembrete pro cliente no WhatsApp (texto pronto)" aria-label="WhatsApp">💬</a>`:''}${n?`<button type="button" class="agg-btn" aria-expanded="${ab}" onclick="aggCkAb('${J(x.k)}')" title="Checklist"><span class="agg-prog" style="--p:${Math.round(ok/n*100)}%">☑ ${ok}/${n} <i></i></span></button>`:''}</div>
    ${n&&ab?`<div class="agg-ckl">${ck.map((i,j)=>`<button type="button" class="agg-cki${i.ok?' ok':''}" role="checkbox" aria-checked="${!!i.ok}" onclick="aggCkTg('${J(c.id)}','${J(t.id)}',${j})"><span class="bx">${i.ok?'✓':''}</span><span>${esc(i.t)}</span></button>`).join('')}</div>`:''}</div>`; }
function tarListaHTML(vis){ const ab=vis.filter(x=>!x.t.feito).sort(tarOrd), fe=vis.filter(x=>x.t.feito).sort((a,b)=>String(b.t.feito).localeCompare(String(a.t.feito)));
  const avs=AGG.tarResp==='victor'?[]:(tx(()=>agAvulsas())||[]);
  return (ab.length||avs.length?ab.map(x=>tarLinha(x)).join('')+avs.map(avLinha).join(''):'<div class="agg-vz">Nenhuma tarefa aberta. 🎉</div>')
    +bloco('tar-feitas','✓ Concluídas (30 dias)',`<b>${fe.length}</b>${nomes3(fe.map(x=>String(x.t.tit||'').split(' ')[0]))}`,fe.length?fe.map(x=>tarLinha(x)).join(''):'<div class="agg-vz">Nenhuma ainda.</div>'); }
function tarQuadroHTML(vis){ const mob=M(), drag=!mob, avs=AGG.tarResp==='victor'?[]:(tx(()=>agAvulsas())||[]);
  const tabs=`<div class="agg-ktabs" role="tablist">${TST.map(s=>`<button type="button" role="tab" aria-selected="${AGG.ktab===s[0]}" class="${AGG.ktab===s[0]?'on':''}" onclick="aggKtab('${s[0]}')">${s[0]==='andamento'?'Andamento':s[1]} · ${vis.filter(x=>aggStatus(x.t)===s[0]).length+(s[0]==='pendente'?avs.length:0)}</button>`).join('')}</div>`;
  return tabs+`<div class="agg-kb">${TST.map(([k,l,cor])=>{ const ts=vis.filter(x=>aggStatus(x.t)===k).sort(tarOrd);
    const cards=ts.map(x=>{ const {c,t}=x, ck=aggCheck(t), n=ck.length, ok=ck.filter(i=>i.ok).length, pr=aggPrio(t), resp=aggResp(c,t);
      return `<div class="agg-kcard${tarAt(t)?' at':''}" style="--pc:${PRIO[pr][1]}"${drag?` draggable="true" ondragstart="aggKStart(event,'${J(x.k)}')" ondragend="aggKEnd(this)"`:''}>
        <button type="button" class="kt" onclick="aggTarAbrir('${J(c.id)}','${J(t.id)}')">${esc(t.tit||tx(()=>tarNomeTipo(t.tipo))||'Tarefa')}</button>
        <div class="kf"><span>👤 ${esc(c.nome||'')}</span></div>
        <div class="kf"><span class="agg-pr ${pr}">${PRIO[pr][0]}</span><span class="agg-tvenc${tarAt(t)?' at':t.quando===AGG.D.hoje?' hj':''}">${vencTxt(t)}</span></div>
        <div class="kf"><span class="agg-av${resp==='victor'?' v':''}" title="${resp==='victor'?'Victor':'Você'}">${resp==='victor'?'V':(esc(assin().charAt(0))||'G')}</span>${n?`<span class="agg-prog" style="--p:${Math.round(ok/n*100)}%">☑ ${ok}/${n} <i></i></span>`:''}<span class="agg-sp"></span><button type="button" class="agg-btn" onclick="aggAbrir('mover','${J(c.id)}','${J(t.id)}')" title="Mover pra outra coluna">Mover ▸</button></div></div>`; }).join('')
      +(k==='pendente'?avs.map(g=>`<div class="agg-kcard g" style="--pc:#94a3b8"><span class="kt">${esc(g.title||'(sem título)')}</span><div class="kf"><span class="agg-bd">só no Google</span><span class="agg-sp"></span><button type="button" class="agg-btn" onclick="aggAvulsaFeita('${J(g.id)}')">✓ feita</button></div></div>`).join(''):'');
    return `<div class="agg-kc${AGG.ktab===k?' vis':''}" data-st="${k}" ondragover="aggKOver(event,this)" ondragleave="aggKLeave(this)" ondrop="aggKDrop(event,'${k}')">
      <div class="agg-kch"><span class="dot" style="background:${cor}"></span><b>${l}</b><span class="q">${ts.length+(k==='pendente'?avs.length:0)}</span></div>
      ${cards||'<div class="agg-kvz">Nada aqui.'+(drag?' Arraste um cartão pra cá.':'')+'</div>'}
      ${k==='pendente'?'<button type="button" class="agg-btn" onclick="aggTarNova()">＋ tarefa</button>':''}</div>`; }).join('')}</div>
    ${drag?'<div class="agg-mut" style="margin-top:8px">No computador: arraste o cartão entre as colunas. No celular: botão "Mover ▸".</div>':''}`; }

/* ═══════════ ações (tela) ═══════════ */
const repinta=()=>{ try{ if(typeof VIEW!=='undefined'&&VIEW==='ag-global') render(); }catch(_){} };
function aggAba(a){ AGG.aba=a==='tarefas'?'tarefas':'agenda'; repinta(); }
function aggModo(m){ AGG.modo=['lista','dia','semana','mes'].includes(m)?m:'semana'; repinta(); }
function aggDia(d){ AGG.cur=d; repinta(); }
function aggIrDia(d){ AGG.cur=d; AGG.modo='dia'; AGG.aba='agenda'; fecharTudo(); repinta(); try{ const tb=document.querySelector('.agg-tb'); if(tb) W.scrollTo({top:Math.max(0,tb.getBoundingClientRect().top+W.scrollY-8)}); }catch(_){} }
function aggHoje(){ AGG.cur=HJ(); repinta(); }
function aggNavegar(n){ if(AGG.modo==='dia') AGG.cur=add(AGG.cur,n); else if(AGG.modo==='semana') AGG.cur=add(AGG.cur,n*(M()?3:7));
  else { const D=dt(AGG.cur); AGG.cur=isoD(new Date(D.getFullYear(),D.getMonth()+n,1)); } repinta(); }
function aggTipo(k){ AGG.ocultos.has(k)?AGG.ocultos.delete(k):AGG.ocultos.add(k); prefGravar(); repinta(); }
function aggDobra(k){ const st=dobraSt(), novo=!aberta(k); st[k]=novo?1:0; try{ localStorage.setItem(DOBRA,JSON.stringify(st)); }catch(_){}
  const bl=document.querySelector('.agg-bl[data-agg="'+String(k).replace(/"/g,'')+'"]'); if(!bl){ repinta(); return; }
  bl.classList.toggle('fechado',!novo); const h=bl.querySelector('.agg-blh'); if(h) h.setAttribute('aria-expanded',novo?'true':'false'); const car=bl.querySelector('.car'); if(car) car.textContent=novo?'▾':'▸'; }
function aggTarResp(r){ AGG.tarResp=r; prefGravar(); repinta(); }
function aggTarModo(m){ AGG.tarModo=m==='quadro'?'quadro':'lista'; prefGravar(); repinta(); }
function aggKtab(k){ AGG.ktab=k; repinta(); }
function aggCkAb(k){ AGG.ckAb[k]=!AGG.ckAb[k]; repinta(); }
function aggNovo(d,h){ const hoje=HJ(); abrir(()=>shNovo({d:d||(AGG.cur>=hoje?AGG.cur:hoje),h:h||'09:00'})); }
function aggTarNova(d){ abrir(()=>shTarefa(null,null,{venc:d||HJ()})); }
function aggProxima(cid){ const c=tx(()=>tarContato(cid)); if(!c) return; trocarOuAbrir(()=>shNovo({cid:String(c.id),d:add(HJ(),1),h:'10:00',tipo:'ligar',banner:'Próxima atividade de '+pnome(c)})); }
function aggFicha(cid){ fecharTudo(); tx(()=>abrirContato(cid)); }
function aggEditar(cid,tid){ fecharTudo(); tx(()=>tarEditar(cid,tid)); }
function aggFinalizar(cid,tid){ fecharTudo(); tx(()=>reunFinalizar(cid,tid)); }
function aggEvAbrir(cid,tid){ abrir(()=>shEvento(cid,tid)); }
function aggTarAbrir(cid,tid){ abrir(()=>shTarefa(cid,tid)); }
function aggMandarAbrir(cid,tid,kind){ abrir(()=>shMandar(cid,tid,kind)); }
function aggConectar(){ try{ Promise.resolve(gcalCarregar(true)).then(repinta,repinta); }catch(_){} }
function aggAvulsaFeita(id){ try{ Promise.resolve(gtAvulsaConcluir(id)).then(repinta,repinta); }catch(_){} }
function aggClickEv(ev,k){ if(ev&&ev.stopPropagation) ev.stopPropagation(); if(Date.now()-ARR_FIM<300) return; const m=AGG.IDX[k]; if(!m) return;
  if(m.kind==='g'){ fecharTudo(); const id=m.e.id; if(tx(()=>gcalClasseOn())) tx(()=>gcalMais(id)); else tx(()=>gcalEditar(id)); return; }
  if(!m.h&&tx(()=>gtDestino(m.t))==='tarefa') abrir(()=>shTarefa(String(m.c.id),String(m.t.id))); else abrir(()=>shEvento(String(m.c.id),String(m.t.id))); }
function aggSlot(ev,d){ if(ev.target.closest&&ev.target.closest('.agg-ev')) return; const col=ev.currentTarget, r=col.getBoundingClientRect(), hpx=r.height/(H1-H0);
  let min=H0*60+Math.floor((ev.clientY-r.top)/hpx*2)*30; min=Math.max(H0*60,Math.min(H1*60-30,min)); abrir(()=>shNovo({d,h:hm(min)})); }
function aggFantasma(ev){ if(M()||ARR) return; const col=ev.currentTarget, g=col.querySelector('.agg-ghost'); if(!g) return; if(ev.target.closest&&ev.target.closest('.agg-ev')){ g.style.display='none'; return; }
  const r=col.getBoundingClientRect(), hpx=r.height/(H1-H0), slot=Math.floor((ev.clientY-r.top)/hpx*2); g.style.display='block'; g.style.top=(slot*hpx/2)+'px'; g.textContent='＋ '+hm(H0*60+slot*30); }
function aggFantasmaSai(col){ const g=col.querySelector('.agg-ghost'); if(g) g.style.display='none'; }
function aggCliqueMes(ev,d){ if(ev.target.closest&&ev.target.closest('button')) return; abrir(()=>shNovo({d,h:'09:00'})); }

/* tarefa: situação, checklist, quadro */
function aggTarSt(cid,tid,para){ const c=tx(()=>tarContato(cid)), t=c&&tx(()=>tarDe(c,tid)); if(!t) return; const p=aggStatusPlano(t,para); if(p.nada) return;
  if(p.concluir){ t.st='concluida'; tarConcluir(cid,tid); return; }       /* tarConcluir: feito + histórico + Google + salvar/render */
  if(p.reabrir) tarReabrir(cid,tid);
  t.st=p.para; salvar(); repinta(); toast('“'+(t.tit||'Tarefa')+'” → '+TST.find(s=>s[0]===p.para)[1],true); }
function aggTarFeita(cid,tid){ const c=tx(()=>tarContato(cid)), t=c&&tx(()=>tarDe(c,tid)); if(!t) return; aggTarSt(cid,tid,t.feito?'pendente':'concluida'); repintarSheet(); }
function aggCkTg(cid,tid,i){ const c=tx(()=>tarContato(cid)), t=c&&tx(()=>tarDe(c,tid)); if(!t||!Array.isArray(t.check)||!t.check[i]) return; t.check[i].ok=!t.check[i].ok; salvar(); repinta(); }
let KDRAG=null;
function aggKStart(ev,k){ KDRAG=k; try{ ev.dataTransfer.effectAllowed='move'; ev.dataTransfer.setData('text/plain',k); }catch(_){} ev.currentTarget.classList.add('arr'); }
function aggKEnd(el){ el.classList.remove('arr'); }
function aggKOver(ev,el){ if(!KDRAG) return; ev.preventDefault(); el.classList.add('drop'); }
function aggKLeave(el){ el.classList.remove('drop'); }
function aggKDrop(ev,st){ ev.preventDefault(); const k=KDRAG||tx(()=>ev.dataTransfer.getData('text/plain')); KDRAG=null; const m=k&&AGG.IDX[k]; if(m&&m.kind==='c') aggTarSt(String(m.c.id),String(m.t.id),st); else repinta(); }

/* ═══════════ compromisso: lembrete, remarcar, mandar ═══════════ */
function parDe(cid,tid){ const c=tx(()=>tarContato(cid)), t=c&&tx(()=>tarDe(c,tid)); return t?{c,t}:null; }
function log(c,l){ tx(()=>interacoesDe(c).push({id:uid(),k:'tarefa',l,dia:HJ(),ts:new Date().toISOString(),por:quemFez()})); }
/* GC-25: a atividade-lembrete (WhatsApp na véspera/no dia) leva o lembrete pro Google e pra Agenda antiga */
function lembLigar(c,t){ if(!t.lemb||t.tipo!=='reuniao'||!t.quando) return null;
  const lt=tx(()=>tarAgendarLembrete(c.id,t.quando,t.hora||'',t.lemb.quando==='dia'?'dia':'vespera')); if(!lt) return null;
  lt.lembDe=String(t.id); t.lemb.tid=lt.id;
  if(t.gcalSync||t.gcalId){ tx(()=>gtDestinoAplicar(lt,'tarefa')); lt.gcalSync=true; tx(()=>gsyncEnfileirar(c.id,lt.id,'upsert')); tx(()=>gsyncAgendar(400)); }   /* mesma fila do tarCriar */
  return lt; }
function lembMover(c,t){ if(!t.lemb) return; const lt=t.lemb.tid?tx(()=>tarDe(c,t.lemb.tid)):null;
  if(!lt||lt.feito){ lembLigar(c,t); return; }
  let rem=aggLembDia(t); if(rem<HJ()) rem=HJ();
  lt.quando=rem; lt.lembrarReuniao={quando:t.quando,hora:t.hora||''}; lt.tit='Lembrete da reunião '+tx(()=>dataBR(t.quando));
  tx(()=>gsyncMudou(c,lt)); }
function aggLembSet(cid,tid,modo){ const p=parDe(cid,tid); if(!p) return; const {c,t}=p;
  if(modo){ t.lemb={modo,quando:'vespera',estado:null}; lembLigar(c,t); salvar(); toast('Lembrete marcado — o CRM prepara a mensagem no dia certo',true); }
  else { const lt=t.lemb&&t.lemb.tid?tx(()=>tarDe(c,t.lemb.tid)):null;
    if(lt&&!lt.feito){ tarRemover(cid,lt.id); if(tx(()=>tarDe(c,lt.id))) return; }   /* ele cancelou a confirmação: o lembrete fica */
    t.lemb=null; salvar(); toast('Lembrete tirado',true); }
  repinta(); repintarSheet(); }
function aggLembModo(cid,tid,k,v){ const p=parDe(cid,tid); if(!p||!p.t.lemb) return; const {c,t}=p;
  if(k==='modo') t.lemb.modo=v==='confirmar'?'confirmar':'lembrar';
  if(k==='quando'){ t.lemb.quando=v==='dia'?'dia':'vespera'; if(!['aguardando','confirmou','remarcar','enviado'].includes(t.lemb.estado)){ t.lemb.estado=null; lembMover(c,t); } }
  salvar(); repinta(); repintarSheet(); }
function aggLembResp(cid,tid,st){ const p=parDe(cid,tid); if(!p||!p.t.lemb) return; const {c,t}=p; t.lemb.estado=st==='remarcar'?'remarcar':'confirmou';
  log(c,(st==='remarcar'?'🔁 Pediu pra remarcar: ':'✅ Confirmou: ')+(t.tit||'Reunião')+' · '+tx(()=>dataBR(t.quando))+(t.hora?' '+t.hora:''));
  salvar(); toast(st==='remarcar'?'🔁 '+pnome(c)+' pediu pra remarcar':'✅ '+pnome(c)+' confirmou',true); repinta();
  if(st==='remarcar') trocarOuAbrir(()=>shReagendar(cid,tid)); else repintarSheet(); }
/* remarcar (sheet, arrasto): dia + hora numa tacada; a fila do Google leva junto (gsyncMudou), o delegado segue a regra do app */
function moverCrm(c,t,d,h){ const antes=(t.quando||'')+'|'+(t.hora||''); t.quando=d; t.hora=h||''; if(antes===d+'|'+(h||'')) return false;
  if(t.hora&&!tx(()=>gsyncEspelha(t))) t.gcalSync=true;   /* ganhou hora: passa a valer "compromisso com hora nasce espelhado" (tarSalvarEdicao) */
  log(c,'Remarcado: '+(t.tit||tx(()=>tarNomeTipo(t.tipo))||'')+' → '+tx(()=>dataBR(d))+(h?' '+h:''));
  if(t.gcalSync&&!t.gcalId&&!t.gtaskId){ tx(()=>gsyncEnfileirar(c.id,t.id,'upsert')); tx(()=>gsyncAgendar(400)); } else tx(()=>gsyncMudou(c,t));
  const tinha=t.lemb&&['aguardando','confirmou','enviado','remarcar'].includes(aggLembEstado(c,t));
  if(t.lemb){ t.lemb.estado=null; lembMover(c,t); }
  salvar(); return tinha; }
function aggSoltar(a){ const m=AGG.IDX[a.k]; if(!m) return repinta(); if(a.d===m.d&&a.min===m2(m.h)) return repinta();
  if(m.kind==='g'){ try{ Promise.resolve(gcalMoverEvento(m.e.id,{dia:a.d,ini:a.min,fim:a.min+m.dur})).then(repinta,repinta); }catch(_){ repinta(); } return; }
  const c=m.c, t=m.t, tinha=moverCrm(c,t,a.d,hm(a.min)); repinta();
  if(tinha&&c.telefone) abrir(()=>shMandar(String(c.id),String(t.id),'reagendar',`Você mudou pra ${quandoTxt(t.quando,t.hora)}. ${pnome(c)} já tinha recebido o horário antigo — avise do novo:`));
  else toast('Remarcado: '+(c.nome||'')+' → '+quandoTxt(t.quando,t.hora)+(t.gcalSync||t.gcalId?' · indo pro Google':''),true); }
function aggReagSalvar(){ const R=AGG.RG, p=parDe(R.cid,R.tid); if(!p) return; if(!R.d||!R.h){ toast('Escolha dia e hora',false); return; }
  const {c,t}=p; if(t.feito) tx(()=>tarReabrir(c.id,t.id)); moverCrm(c,t,R.d,R.h); const av=R.avisar&&c.telefone; AGG.RG={}; repinta();
  if(av) trocar(()=>shMandar(String(c.id),String(t.id),'reagendar')); else { toast('Remarcado: '+quandoTxt(t.quando,t.hora),true); fechar(); } }
function aggCopiar(){ const el=document.getElementById('agg-msg'), v=el?el.value:(AGG.MSG.txt||''); try{ navigator.clipboard.writeText(v).then(()=>toast('Texto copiado',true),()=>toast('Não consegui copiar',false)); }catch(_){ toast('Não consegui copiar',false); } }
/* o CRM NÃO manda nada: abre a conversa com o texto; ele aperta enviar */
function aggMandou(cid,tid,kind){ const p=parDe(cid,tid); if(!p) return; const {c,t}=p, el=document.getElementById('agg-msg'), txt=el?el.value:(AGG.MSG.txt||'');
  const u=tx(()=>cartWaUrl(c.telefone,txt))||''; if(!u){ toast('Esse contato não tem telefone com DDD',false); return; }
  try{ W.open(u,'_blank','noopener'); }catch(_){}
  if(t.lemb&&(kind==='lembrete'||kind==='reagendar')){ t.lemb.estado=t.lemb.modo==='confirmar'?'aguardando':'enviado';
    const lt=t.lemb.tid?tx(()=>tarDe(c,t.lemb.tid)):null; if(lt&&!lt.feito) tx(()=>tarConcluir(c.id,lt.id));
    log(c,'💬 '+(kind==='reagendar'?'Aviso do novo horário':'Lembrete')+' aberto no WhatsApp pra '+pnome(c)); salvar(); }
  AGG.MSG={}; fechar(); repinta();
  if(t.lemb&&t.lemb.estado==='aguardando') toast('WhatsApp aberto — selo: ⏳ aguardando confirmação',true); }

/* ═══════════ salvar: novo compromisso · tarefa ═══════════ */
function aggNovoSalvar(){ const F=AGG.F; const c=F.cid?tx(()=>tarContato(F.cid)):null;
  if(!c){ toast('Escolha o cliente (ou use "compromisso sem cliente")',false); const i=document.getElementById('agg-bq'); if(i) i.focus(); return; }
  if(!F.d){ toast('Escolha o dia',false); return; }
  const t=tarCriar(c.id,F.tipo,String(F.tit||'').trim(),F.d,F.h||'','',F.dur); if(!t) return;   /* tarCriar: histórico + Google (com hora) + delegado */
  if(F.tipo==='reuniao'&&F.lemb!=='nao'){ t.lemb={modo:F.lemb,quando:F.qd==='dia'?'dia':'vespera',estado:null}; lembLigar(c,t); }
  salvar(); if(AGG.modo!=='lista') AGG.cur=F.d; AGG.F={}; fecharTudo(); repinta(); }
function aggSemCliente(){ const F=AGG.F; if(!gOn()){ toast('Conecte a Agenda Google pra marcar compromisso sem cliente',false); return; }
  const d=F.d||HJ(), h=F.h||'09:00', dur=+F.dur||60; fecharTudo(); try{ _GCAL_NEG=null; }catch(_){}
  tx(()=>gcalModalEvento({novo:true,summary:String(F.tit||''),description:'',dia:d,ini:h,fim:hm(Math.min(24*60-1,m2(h)+dur)),local:'',convidado:'',meet:false})); }
function aggTarSalvar(){ const T=AGG.TF, tit=String(T.tit||'').trim(); if(!tit){ toast('Dê um nome à tarefa',false); const i=document.getElementById('agg-ttit'); if(i) i.focus(); return; }
  const ck=(T.ck||[]).filter(x=>x&&String(x.t||'').trim()).map(x=>({t:String(x.t).trim(),ok:!!x.ok}));
  if(T.tid){ const p=parDe(T.cid,T.tid); if(!p) return; const {c,t}=p, antes=(t.tit||'')+'|'+(t.quando||'');
    t.tit=tit; t.quando=T.venc||t.quando||''; t.prio=T.prio; t.resp=T.resp; t.check=ck;
    if(antes!==t.tit+'|'+t.quando){ log(c,'Tarefa editada: '+t.tit+(t.quando?' · '+tx(()=>dataBR(t.quando)):'')); tx(()=>gsyncMudou(c,t)); }
    const pl=aggStatusPlano(t,T.st); AGG.TF={}; fecharTudo();
    if(pl.concluir){ t.st='concluida'; tarConcluir(c.id,t.id); return; }
    if(pl.reabrir) tarReabrir(c.id,t.id);
    if(!pl.nada) t.st=pl.para; salvar(); repinta(); toast('Tarefa atualizada: '+t.tit,true); return; }
  const c=T.cid?tx(()=>tarContato(T.cid)):null;
  if(!c){ const venc=T.venc||HJ(); AGG.TF={}; fecharTudo();   /* sem cliente = Tarefa do Google avulsa (o caminho que já existe) */
    if(T.prio!=='media'||ck.length||T.resp!=='eu') toast('Sem cliente, vai pras Tarefas do Google — prioridade, responsável e checklist só em tarefa ligada a um contato',false);
    try{ Promise.resolve(gtCriarAvulsa(tit,'',venc)).then(repinta,repinta); }catch(_){} return; }
  const t=tarCriar(c.id,T.tipo||'follow',tit,T.venc||HJ(),'','',30); if(!t) return;
  tx(()=>gtDestinoAplicar(t,'tarefa')); t.prio=T.prio; t.resp=T.resp; if(ck.length) t.check=ck;
  AGG.TF={}; fecharTudo();
  if(T.st==='concluida'){ t.st='concluida'; tarConcluir(c.id,t.id); return; }
  t.st=T.st==='andamento'?'andamento':'pendente'; salvar(); repinta(); }
function aggTarExcluir(){ const T=AGG.TF; AGG.TF={}; fecharTudo(); if(T.cid&&T.tid) tx(()=>tarRemover(T.cid,T.tid)); }

/* ═══════════ folhas (modal no computador, folha de baixo no celular) ═══════════ */
let SEQ=0;
function abrir(fn){ AGG.pilha.push({fn,k:'s'+(++SEQ)}); pintarSheet(true); }
function trocar(fn){ if(!AGG.pilha.length) return abrir(fn); AGG.pilha[AGG.pilha.length-1]={fn,k:'s'+(++SEQ)}; pintarSheet(true); }
function trocarOuAbrir(fn){ AGG.pilha.length?trocar(fn):abrir(fn); }
function fechar(){ if(!AGG.pilha.length) return; AGG.pilha.pop(); pintarSheet(true); }
function fecharTudo(){ if(!AGG.pilha.length&&!document.getElementById('agg-ov')) return; AGG.pilha=[]; pintarSheet(); }
function repintarSheet(){ if(AGG.pilha.length) pintarSheet(false); }
function pintarSheet(novo){ let ov=document.getElementById('agg-ov');
  if(!AGG.pilha.length){ if(ov){ ov.remove(); document.body.classList.remove('agg-trava'); camTirar(); camSinc(); } return; }
  if(!ov){ ov=document.createElement('div'); ov.id='agg-ov'; ov.className='agg-ov'; ov.addEventListener('click',e=>{ if(e.target===ov) fechar(); }); document.body.appendChild(ov); document.body.classList.add('agg-trava'); camRegistrar(); }
  const b0=ov.querySelector('.agg-shb'), sc=b0&&!novo?b0.scrollTop:0, top=AGG.pilha[AGG.pilha.length-1]; AGG.shk=top.k;
  let r; try{ r=top.fn()||{}; }catch(e){ console.warn('[agenda-global] folha',e); r={tit:'Ops',corpo:'<div class="agg-vz">Não consegui abrir isto — atualize a tela.</div>'}; }
  ov.innerHTML=`<section class="agg-sh" role="dialog" aria-modal="true" aria-labelledby="agg-sh-tit"><div class="agg-shh"><span class="alca" aria-hidden="true"></span>${AGG.pilha.length>1?'<button type="button" class="vol" onclick="aggFechar()">‹ voltar</button>':''}<h2 id="agg-sh-tit">${r.tit||''}</h2><button type="button" class="x" onclick="aggFecharTudo()" aria-label="Fechar">✕</button></div>
    <div class="agg-shb">${r.corpo||''}</div>${r.rod?`<div class="agg-shf">${r.rod}</div>`:''}</section>`;
  const b=ov.querySelector('.agg-shb'); if(b) b.scrollTop=sc;
  if(novo){ const x=ov.querySelector('.x'); if(x) try{ x.focus({preventScroll:true}); }catch(_){} }
  camSinc(); }
function aggAbrir(qual,a,b){ const f={fin:shFinLista,lembretes:shLembretes,semprox:shSemProx,aniv:shAniv,dia:()=>shDiaTudo(a),mover:()=>shMover(a,b)}[qual]; if(f) abrir(f); }

/* ── compromisso (atividade do CRM) ── */
function shEvento(cid,tid){ const p=parDe(cid,tid); if(!p) return {tit:'Atividade',corpo:'<div class="agg-vz">Essa atividade não existe mais.</div>'};
  const {c,t}=p, cat=aggCat(c,t), K=CAT[cat], afin=!!tx(()=>reunPendente(t)), est=aggLembEstado(c,t), j=`'${J(c.id)}','${J(t.id)}'`, por=porOutro(c,t);
  const loc=tx(()=>locTexto(locPrincipal(c)))||'', dur=Number(t.dur)||60;
  let corpo=`<div class="agg-ecab" style="${sty(cat)}"><div class="big">${esc(c.nome||'—')}</div>
    <div class="ln">${K.ico} ${esc(t.tit&&String(t.tit).trim()!==tx(()=>tarNomeTipo(t.tipo))?t.tit+' · '+K.l:K.l)} ${tx(()=>badgeEtapa(c.etapa))||''}</div>
    <div class="ln">🗓️ ${t.quando?DSL[dow(t.quando)]+', '+br(t.quando):'sem data'}${t.hora?' · '+t.hora+'–'+hm(Math.min(24*60-1,m2(t.hora)+dur))+' ('+durTxt(dur)+')':' · dia todo'}</div>
    ${loc?`<div class="ln">📍 ${esc(loc)}</div>`:''}
    <div class="ln agg-mut">${por?'📆 marcado pelo '+esc(por)+' · ':''}${tx(()=>gsyncBadgeHTML(c,t))||''}${t.feito?' · ✓ feito':''}</div></div>`;
  if(afin) corpo+=`<div class="agg-aviso vm">A data passou e ninguém disse o que houve. Finalize pra o funil andar.</div>`;
  if(t.tipo==='reuniao'&&!t.feito&&!afin){ const L=t.lemb;
    if(!L||!L.modo) corpo+=`<div class="agg-box"><h3>🔔 Lembrete pro cliente</h3><div class="agg-dica">Sem lembrete. Quer que o CRM deixe uma mensagem pronta pra você mandar?</div>
      <div class="agg-row"><button type="button" class="agg-btn" onclick="aggLembSet(${j},'lembrar')">Só lembrar</button><button type="button" class="agg-btn p" onclick="aggLembSet(${j},'confirmar')">Pedir confirmação</button></div></div>`;
    else { const ld=aggLembDia(t);
      const exp={agendado:`Fica pronto pra você mandar ${L.quando==='dia'?'no dia':'na véspera'} (${quandoTxt(ld)}). Se quiser, mande agora.`,pronto:'Está pronto. Toque pra abrir o WhatsApp com o texto — você só aperta enviar.',
        aguardando:`Você mandou o pedido de confirmação. ${esc(pnome(c))} respondeu?`,confirmou:`${esc(pnome(c))} confirmou. 👍`,remarcar:`${esc(pnome(c))} pediu pra mudar o horário. Escolha o novo e o CRM prepara a mensagem.`,enviado:'Lembrete enviado. Nada mais a fazer.'}[est]||'';
      const bt={agendado:`<button type="button" class="agg-btn" onclick="aggMandarAbrir(${j},'lembrete')">💬 Mandar agora</button>`,pronto:`<button type="button" class="agg-btn v" onclick="aggMandarAbrir(${j},'lembrete')">💬 Mandar lembrete</button>`,
        aguardando:`<button type="button" class="agg-btn" onclick="aggLembResp(${j},'confirmou')">✅ Confirmou</button><button type="button" class="agg-btn" onclick="aggLembResp(${j},'remarcar')">🔁 Pediu pra remarcar</button><button type="button" class="agg-btn" onclick="aggMandarAbrir(${j},'lembrete')">💬 Perguntar de novo</button>`,
        remarcar:`<button type="button" class="agg-btn p" onclick="aggReagendarAbrir(${j})">🔁 Reagendar e avisar</button>`}[est]||'';
      corpo+=`<div class="agg-box"><h3>🔔 Lembrete pro cliente ${chipLemb(c,t)}</h3><div class="agg-dica">${exp}</div>${bt?`<div class="agg-row">${bt}</div>`:''}
        <div class="agg-g2"><div class="agg-fld"><span class="fl">Tipo</span><div class="agg-seg f">${[['lembrar','Só lembrar'],['confirmar','Pedir confirmação']].map(x=>`<button type="button" class="${L.modo===x[0]?'on':''}" aria-pressed="${L.modo===x[0]}" onclick="aggLembModo(${j},'modo','${x[0]}')">${x[1]}</button>`).join('')}</div></div>
          <div class="agg-fld"><span class="fl">Quando</span><div class="agg-seg f">${[['vespera','Na véspera'],['dia','No dia']].map(x=>`<button type="button" class="${(L.quando||'vespera')===x[0]?'on':''}" aria-pressed="${(L.quando||'vespera')===x[0]}" onclick="aggLembModo(${j},'quando','${x[0]}')">${x[1]}</button>`).join('')}</div></div></div>
        <button type="button" class="agg-btn perigo" style="align-self:flex-start" onclick="aggLembSet(${j},null)">Tirar o lembrete</button></div>`; } }
  const a=[];
  if(afin||(t.tipo==='reuniao'&&!t.feito&&t.quando&&t.quando<=AGG.D.hoje)) a.push(`<button type="button" class="agg-btn p" onclick="aggFinalizar(${j})">Finalizar</button>`);
  else if(!t.feito) a.push(`<button type="button" class="agg-btn" onclick="aggFeita(${j})">✓ Feita</button>`);
  if(c.telefone) a.push(`<button type="button" class="agg-btn" onclick="aggMandarAbrir(${j},'compromisso')">💬 WhatsApp</button>`);
  if(!t.feito) a.push(`<button type="button" class="agg-btn" onclick="aggReagendarAbrir(${j})">🔁 Reagendar</button>`);
  if(!t.feito&&t.hora) a.push(`<button type="button" class="agg-btn" onclick="aggConvite(${j})">✉️ Convite</button>`);
  a.push(`<button type="button" class="agg-btn" onclick="aggEditar(${j})">✏️ Editar</button>`);
  a.push(`<button type="button" class="agg-btn" onclick="aggFicha('${J(c.id)}')">👤 Abrir a ficha</button>`);
  a.push(`<button type="button" class="agg-btn perigo" onclick="aggRemover(${j})">🗑 Remover</button>`);
  corpo+=`<div class="agg-acts">${a.join('')}</div>`;
  if(t.quando&&!t.feito) corpo+=`<div class="agg-gpar"><span class="agg-mut">Na sua agenda do Google:</span> ${tx(()=>tarGoogleParHTML(c,t))||''}</div>`;
  return {tit:`${K.ico} ${esc(K.l)}`,corpo}; }
function aggFeita(cid,tid){ fecharTudo(); tx(()=>tarConcluir(cid,tid)); repinta(); }
function aggRemover(cid,tid){ const p=parDe(cid,tid); fecharTudo(); if(!p) return;
  const lt=p.t.lemb&&p.t.lemb.tid?tx(()=>tarDe(p.c,p.t.lemb.tid)):null;
  tarRemover(cid,tid); if(!tx(()=>tarDe(p.c,tid))&&lt&&!lt.feito){ p.c.tarefas=(p.c.tarefas||[]).filter(x=>x!==lt); if(lt.gtaskId||lt.gcalId) tx(()=>gsyncEnfileirar(p.c.id,lt.id,'apagar',{gcalId:lt.gcalId,gtaskId:lt.gtaskId,titulo:lt.tit||''})); salvar(); }   /* o lembrete vai junto com a reunião */
  repinta(); }
function aggConvite(cid,tid){ fecharTudo(); try{ Promise.resolve(tarConvidarCliente(cid,tid)).then(repinta,repinta); }catch(_){} }
function aggReagendarAbrir(cid,tid){ trocarOuAbrir(()=>shReagendar(cid,tid)); }

/* ── mandar mensagem (o CRM só prepara) ── */
function shMandar(cid,tid,kind,intro){ const p=parDe(cid,tid); if(!p) return {tit:'Mensagem',corpo:'<div class="agg-vz">Atividade não encontrada.</div>'}; const {c,t}=p;
  if(AGG.MSG.k!==AGG.shk) AGG.MSG={k:AGG.shk,txt:kind==='lembrete'?msgLembrete(c,t):kind==='reagendar'?msgReagendar(c,t):msgCompromisso(c,t)};
  const tit={lembrete:'💬 Lembrete pro '+esc(pnome(c)),reagendar:'🔁 Avisar '+esc(pnome(c))+' do novo horário',compromisso:'💬 Mensagem pro '+esc(pnome(c))}[kind]||'💬 Mensagem';
  const tel=tx(()=>telBR(c.telefone))||c.telefone||'';
  return {tit,corpo:`${intro?`<div class="agg-aviso az">${esc(intro)}</div>`:''}<div class="agg-mut">Para: <b>${esc(c.nome||'')}</b>${tel?' · '+esc(tel):' · <span style="color:var(--verm)">sem telefone</span>'}</div>
    <div class="agg-fld"><label for="agg-msg">Mensagem (dá pra ajustar)</label><textarea id="agg-msg" rows="8" oninput="aggMsgTxt(this.value)">${esc(AGG.MSG.txt)}</textarea></div>
    <div class="agg-dica">🔒 O CRM <b>não manda nada sozinho</b>. Ao tocar em "Abrir WhatsApp", a conversa abre com esse texto e você aperta enviar.</div>`,
    rod:`<button type="button" class="agg-btn" onclick="aggCopiar()">📋 Copiar</button><button type="button" class="agg-btn v" onclick="aggMandou('${J(c.id)}','${J(t.id)}','${kind}')"${c.telefone?'':' disabled'}>💬 Abrir WhatsApp</button>`}; }
function aggMsgTxt(v){ AGG.MSG.txt=v; }

/* ── reagendar ── */
function shReagendar(cid,tid){ const p=parDe(cid,tid); if(!p) return {tit:'Reagendar',corpo:'<div class="agg-vz">Atividade não encontrada.</div>'}; const {c,t}=p, hoje=AGG.D.hoje;
  if(AGG.RG._k!==AGG.shk) AGG.RG={_k:AGG.shk,cid:String(c.id),tid:String(t.id),d:(!t.quando||t.quando<hoje)?add(hoje,1):t.quando,h:t.hora||'09:00',avisar:!!c.telefone};
  const R=AGG.RG, base=(t.quando&&t.quando>hoje)?t.quando:hoje, conf=conflito(R.d,R.h,Number(t.dur)||60,'c:'+c.id+':'+t.id);
  return {tit:'🔁 Reagendar · '+esc(c.nome||''),corpo:`<div class="agg-mut">Hoje está em: <b>${quandoTxt(t.quando,t.hora)}</b></div>
    <div class="agg-g2"><div class="agg-fld"><label for="agg-rgd">Novo dia</label><input id="agg-rgd" type="date" value="${esc(R.d)}" onchange="aggRg('d',this.value)"></div><div class="agg-fld"><label for="agg-rgh">Hora</label><input id="agg-rgh" type="time" step="900" value="${esc(R.h)}" onchange="aggRg('h',this.value)"></div></div>
    <div class="agg-pills">${[['Amanhã',add(hoje,1)],['+2 dias',add(base,2)],['+7 dias',add(base,7)]].map(x=>`<button type="button" class="agg-pill${R.d===x[1]?' on':''}" onclick="aggRg('d','${x[1]}')">${x[0]}</button>`).join('')}</div>
    ${conf?`<div class="agg-aviso">⚠️ Choca com ${esc(CAT[conf.cat].l)} · ${esc(nomeM(conf))} às ${conf.h}.</div>`:''}
    ${c.telefone?`<div class="agg-fld"><span class="fl">Avisar ${esc(pnome(c))}?</span><div class="agg-seg f"><button type="button" class="${R.avisar?'on':''}" aria-pressed="${!!R.avisar}" onclick="aggRg('avisar',1)">Sim, preparar mensagem</button><button type="button" class="${!R.avisar?'on':''}" aria-pressed="${!R.avisar}" onclick="aggRg('avisar',0)">Não avisar</button></div></div>`:''}`,
    rod:`<button type="button" class="agg-btn" onclick="aggFechar()">Cancelar</button><button type="button" class="agg-btn p" onclick="aggReagSalvar()">Salvar novo horário</button>`}; }
function aggRg(k,v){ if(k==='avisar') AGG.RG.avisar=!!+v; else AGG.RG[k]=v; repintarSheet(); }

/* ── novo compromisso ── */
function shNovo(pre){ pre=pre||{};
  if(AGG.F._k!==AGG.shk){ const tipo=pre.tipo||'reuniao', c0=pre.cid?tx(()=>tarContato(pre.cid)):null;
    AGG.F={_k:AGG.shk,cid:c0?String(c0.id):'',tipo,tit:'',d:pre.d||HJ(),h:pre.h||'09:00',dur:DUR_PAD[tipo]||60,lemb:aggLembPadrao(tipo,c0?aggCat(c0,{tipo}):'reun'),qd:'vespera',banner:pre.banner||'',durMexeu:false,lembMexeu:false}; }
  const F=AGG.F, c=F.cid?tx(()=>tarContato(F.cid)):null, cat=c?aggCat(c,{tipo:F.tipo}):(F.tipo==='reuniao'?'reun':aggCat(null,{tipo:F.tipo}));
  const conf=F.d&&F.h?conflito(F.d,F.h,F.dur,''):null, tipos=(typeof TAR_TIPOS!=='undefined'?TAR_TIPOS:[['reuniao','🤝','Reunião']]);
  const fake=c&&F.d?{tipo:F.tipo,quando:F.d,hora:F.h,lemb:{modo:F.lemb}}:null;
  const corpo=`${F.banner?`<div class="agg-aviso az">${esc(F.banner)}</div>`:''}
    <div class="agg-fld"><span class="fl">Cliente</span>${c?`<div class="agg-csel"><b>${esc(c.nome||'')}</b>${tx(()=>badgeEtapa(c.etapa))||''}<button type="button" class="agg-btn" onclick="aggNovoCli('')">trocar</button></div>`:
      `<input id="agg-bq" type="search" placeholder="Buscar pelo nome ou telefone…" autocomplete="off" oninput="aggBusca(this.value,'F')" aria-label="Buscar cliente"><div id="agg-br" class="agg-bcr"></div>
      <button type="button" class="agg-lnk2" onclick="aggSemCliente()">🔒 Compromisso sem cliente (vai só pro seu Google)</button>`}</div>
    <div class="agg-fld"><span class="fl">O que é</span><div class="agg-pills">${tipos.map(x=>`<button type="button" class="agg-pill${F.tipo===x[0]?' on':''}" aria-pressed="${F.tipo===x[0]}" onclick="aggNovoTipo('${x[0]}')">${x[1]} ${esc(x[2])}</button>`).join('')}</div>
      ${F.tipo==='reuniao'&&c?`<div class="agg-dica"><span class="agg-bd tp" style="${sty(cat)}">${CAT[cat].ico} ${CAT[cat].l}</span> pela etapa do negócio — a cor e o título no Google seguem a etapa.</div>`:''}</div>
    <div class="agg-fld"><label for="agg-ftit">Título <span class="agg-mut">(opcional)</span></label><input id="agg-ftit" value="${esc(F.tit)}" placeholder="${esc(tx(()=>tarNomeTipo(F.tipo))||'')}" oninput="aggF('tit',this.value)"></div>
    <div class="agg-g2"><div class="agg-fld"><label for="agg-fd">Dia</label><input id="agg-fd" type="date" value="${esc(F.d)}" onchange="aggF('d',this.value,1)"></div><div class="agg-fld"><label for="agg-fh">Hora <span class="agg-mut">(vazio = dia todo)</span></label><input id="agg-fh" type="time" step="900" value="${esc(F.h)}" onchange="aggF('h',this.value,1)"></div></div>
    <div class="agg-fld"><span class="fl">Duração</span><div class="agg-pills">${[15,30,45,60,90,120].map(d=>`<button type="button" class="agg-pill${F.dur===d?' on':''}" aria-pressed="${F.dur===d}" onclick="aggNovoDur(${d})">${durTxt(d)}</button>`).join('')}</div></div>
    ${conf?`<div class="agg-aviso">⚠️ Choca com ${esc(CAT[conf.cat].l)} · ${esc(nomeM(conf))} (${conf.h}–${hm(Math.min(24*60-1,m2(conf.h)+conf.dur))}).</div>`:''}
    ${F.tipo==='reuniao'?`<div class="agg-box"><h3>🔔 Lembrete pro cliente</h3>
      <div class="agg-seg f">${[['nao','Não lembrar'],['lembrar','Só lembrar'],['confirmar','Pedir confirmação']].map(x=>`<button type="button" class="${F.lemb===x[0]?'on':''}" aria-pressed="${F.lemb===x[0]}" onclick="aggNovoLemb('lemb','${x[0]}')">${x[1]}</button>`).join('')}</div>
      ${F.lemb!=='nao'?`<div class="agg-seg f">${[['vespera','Na véspera'],['dia','No dia, de manhã']].map(x=>`<button type="button" class="${F.qd===x[0]?'on':''}" aria-pressed="${F.qd===x[0]}" onclick="aggNovoLemb('qd','${x[0]}')">${x[1]}</button>`).join('')}</div>
        <div class="agg-dica">No dia certo ele aparece em <b>📨 lembretes pra mandar</b> (e nas suas Tarefas do Google, se a reunião for pra lá). Você toca, o WhatsApp abre com o texto e você aperta enviar. O CRM não manda sozinho.</div>
        ${fake?`<div class="fl">Prévia da mensagem</div><div class="agg-msgv">${esc(msgLembrete(c,fake,F.lemb))}</div>`:'<div class="agg-dica">Escolha o cliente pra ver a prévia.</div>'}`:''}</div>`:''}`;
  return {tit:'＋ Novo compromisso',corpo,rod:`<span class="nota">${F.h?'📆 Com hora, vai pro seu Google Agenda':'☑️ Sem hora, fica como tarefa do dia'}</span><button type="button" class="agg-btn" onclick="aggFechar()">Cancelar</button><button type="button" class="agg-btn p" onclick="aggNovoSalvar()">Salvar</button>`}; }
function aggF(k,v,rep){ AGG.F[k]=v; if(rep) repintarSheet(); }
function aggNovoTipo(k){ const F=AGG.F; F.tipo=k; if(!F.durMexeu) F.dur=DUR_PAD[k]||60; if(!F.lembMexeu){ const c=F.cid?tx(()=>tarContato(F.cid)):null; F.lemb=aggLembPadrao(k,c?aggCat(c,{tipo:k}):'reun'); } repintarSheet(); }
function aggNovoDur(d){ AGG.F.dur=d; AGG.F.durMexeu=true; repintarSheet(); }
function aggNovoLemb(k,v){ AGG.F[k]=v; AGG.F.lembMexeu=true; repintarSheet(); }
function aggNovoCli(cid){ const F=AGG.F; F.cid=cid||''; const c=cid?tx(()=>tarContato(cid)):null; if(c&&!F.lembMexeu) F.lemb=aggLembPadrao(F.tipo,aggCat(c,{tipo:F.tipo})); repintarSheet();
  if(!cid) setTimeout(()=>{ const i=document.getElementById('agg-bq'); if(i) i.focus(); },30); }
/* busca de cliente: a base dos dois funis (contatosDoLp, o mesmo escopo da Agenda) — nome ou telefone */
function aggBusca(q,alvo){ const r=document.getElementById(alvo==='T'?'agg-tbr':'agg-br'); if(!r) return; const n=norm(q).trim(), dg=String(q||'').replace(/\D/g,'');
  if(!n){ r.innerHTML=''; return; }
  const l=(tx(()=>contatosDoLp())||[]).filter(c=>c&&c.nome&&(norm(c.nome).includes(n)||(dg.length>=4&&String(c.telefone||'').replace(/\D/g,'').includes(dg)))).slice(0,6);
  r.innerHTML=l.map(c=>`<button type="button" onclick="${alvo==='T'?'aggTarCli':'aggNovoCli'}('${J(c.id)}')"><b>${esc(c.nome)}</b>${tx(()=>badgeEtapa(c.etapa))||''}</button>`).join('')
    ||'<div class="agg-vz">Ninguém com esse nome nos funis. Cadastre o negócio primeiro (➕ no menu).</div>'; }

/* ── tarefa ── */
function shTarefa(cid,tid,pre){ const p=cid&&tid?parDe(cid,tid):null;
  if(AGG.TF._k!==AGG.shk){ AGG.TF=p?{_k:AGG.shk,cid:String(p.c.id),tid:String(p.t.id),tipo:p.t.tipo,tit:p.t.tit||'',venc:p.t.quando||'',prio:aggPrio(p.t),st:aggStatus(p.t),resp:aggResp(p.c,p.t),ck:aggCheck(p.t).map(x=>({t:x.t,ok:!!x.ok})),novo:''}
      :{_k:AGG.shk,cid:'',tid:'',tipo:'follow',tit:'',venc:(pre&&pre.venc)||HJ(),prio:'media',st:'pendente',resp:'eu',ck:[],novo:''}; }
  const T=AGG.TF, c=T.cid?tx(()=>tarContato(T.cid)):null, tipos=(typeof TAR_TIPOS!=='undefined'?TAR_TIPOS:[['follow','🔁','Follow-up']]);
  const corpo=`<div class="agg-fld"><label for="agg-ttit">Tarefa</label><input id="agg-ttit" value="${esc(T.tit)}" placeholder="Ex.: Enviar proposta revisada" oninput="aggT('tit',this.value)"></div>
    <div class="agg-fld"><span class="fl">Ligada a</span>${c?`<div class="agg-csel"><b>${esc(c.nome||'')}</b>${tx(()=>badgeEtapa(c.etapa))||''}<button type="button" class="agg-btn" onclick="aggFicha('${J(c.id)}')">ficha</button>${T.tid?'':`<button type="button" class="agg-btn" onclick="aggTarCli('')">trocar</button>`}</div>`:
      `<input id="agg-tbq" type="search" placeholder="Buscar lead ou cliente…" autocomplete="off" oninput="aggBusca(this.value,'T')" aria-label="Buscar lead ou cliente"><div id="agg-tbr" class="agg-bcr"></div><div class="agg-dica">Sem contato, a tarefa vai pras suas Tarefas do Google (sem prioridade nem checklist).</div>`}</div>
    ${T.tid?'':`<div class="agg-fld"><label for="agg-ttipo">Tipo</label><select id="agg-ttipo" onchange="aggT('tipo',this.value)">${tipos.map(x=>`<option value="${x[0]}"${T.tipo===x[0]?' selected':''}>${x[1]} ${esc(x[2])}</option>`).join('')}</select></div>`}
    <div class="agg-g2"><div class="agg-fld"><label for="agg-tven">Vencimento</label><input id="agg-tven" type="date" value="${esc(T.venc)}" onchange="aggT('venc',this.value)"></div>
      <div class="agg-fld"><span class="fl">Responsável</span><div class="agg-seg f">${[['eu','Eu'],['victor','Victor']].map(x=>`<button type="button" class="${T.resp===x[0]?'on':''}" aria-pressed="${T.resp===x[0]}" onclick="aggT('resp','${x[0]}',1)">${x[1]}</button>`).join('')}</div></div></div>
    <div class="agg-fld"><span class="fl">Prioridade</span><div class="agg-seg f">${Object.keys(PRIO).map(k=>`<button type="button" class="${T.prio===k?'on':''}" aria-pressed="${T.prio===k}" onclick="aggT('prio','${k}',1)">${PRIO[k][0]}</button>`).join('')}</div></div>
    <div class="agg-fld"><span class="fl">Situação</span><div class="agg-seg f">${TST.map(s=>`<button type="button" class="${T.st===s[0]?'on':''}" aria-pressed="${T.st===s[0]}" onclick="aggT('st','${s[0]}',1)">${s[1]}</button>`).join('')}</div></div>
    <div class="agg-box"><h3>☑ Checklist <span class="agg-mut">${T.ck.filter(x=>x.ok).length}/${T.ck.length}</span></h3>
      ${T.ck.map((x,i)=>`<div class="agg-ckle"><button type="button" class="agg-cki${x.ok?' ok':''}" style="flex:1" role="checkbox" aria-checked="${!!x.ok}" onclick="aggTck(${i})"><span class="bx">${x.ok?'✓':''}</span><span>${esc(x.t)}</span></button><button type="button" class="agg-btn ico" aria-label="Tirar item" onclick="aggTckDel(${i})">✕</button></div>`).join('')}
      <div class="agg-ckle"><input id="agg-tck" value="${esc(T.novo)}" placeholder="Novo item (curto)" oninput="aggT('novo',this.value)" onkeydown="if(event.key==='Enter'){event.preventDefault();aggTckAdd()}" aria-label="Novo item do checklist"><button type="button" class="agg-btn ico" onclick="aggTckAdd()" aria-label="Pôr item">＋</button></div></div>
    ${p&&p.t.quando?`<div class="agg-gpar"><span class="agg-mut">No seu Google:</span> ${tx(()=>tarGoogleParHTML(p.c,p.t))||''}</div>`:''}`;
  return {tit:T.tid?'✏️ Tarefa':'＋ Nova tarefa',corpo,rod:`${T.tid?'<button type="button" class="agg-btn perigo" onclick="aggTarExcluir()">Excluir</button>':''}<span class="agg-sp"></span><button type="button" class="agg-btn" onclick="aggFechar()">Cancelar</button><button type="button" class="agg-btn p" onclick="aggTarSalvar()">Salvar</button>`}; }
function aggT(k,v,rep){ AGG.TF[k]=v; if(rep) repintarSheet(); }
function aggTarCli(cid){ AGG.TF.cid=cid||''; repintarSheet(); if(!cid) setTimeout(()=>{ const i=document.getElementById('agg-tbq'); if(i) i.focus(); },30); }
function aggTck(i){ const x=AGG.TF.ck[i]; if(x){ x.ok=!x.ok; repintarSheet(); } }
function aggTckDel(i){ AGG.TF.ck.splice(i,1); repintarSheet(); }
function aggTckAdd(){ const v=String(AGG.TF.novo||'').trim(); if(!v) return; AGG.TF.ck.push({t:v.slice(0,80),ok:false}); AGG.TF.novo=''; repintarSheet(); const i=document.getElementById('agg-tck'); if(i) i.focus(); }
function shMover(cid,tid){ const p=parDe(cid,tid); if(!p) return {tit:'Mover',corpo:'<div class="agg-vz">Tarefa não encontrada.</div>'}; const st=aggStatus(p.t);
  return {tit:'Mover · '+esc(p.t.tit||'Tarefa'),corpo:TST.map(([k,l,cor])=>`<button type="button" class="agg-opt" ${st===k?'disabled':''} onclick="aggMoverPara('${J(cid)}','${J(tid)}','${k}')"><span class="oi" style="color:${cor}">●</span><span><b>${l}</b>${st===k?'<span class="agg-dica">está aqui agora</span>':''}</span></button>`).join('')}; }
function aggMoverPara(cid,tid,k){ fecharTudo(); aggTarSt(cid,tid,k); }

/* ── listas dos alertas ── */
function shFinLista(){ const l=tx(()=>reunPendentes())||[];
  return {tit:'🤝 Reuniões a finalizar',corpo:`<div class="agg-dica">A data passou e ninguém disse o que houve. Finalizar gera o próximo passo — o funil anda.</div>`+(l.map(x=>`<div class="agg-srow"><div class="t"><b>${esc(x.c.nome||'')}</b><span class="agg-mut">${esc(x.t.tit||'Reunião')} · ${quandoTxt(x.t.quando,x.t.hora)} · ${tx(()=>reunDiasParada(x.t))||0}d sem desfecho</span></div><button type="button" class="agg-btn p" onclick="aggFinalizar('${J(x.c.id)}','${J(x.t.id)}')">Finalizar</button></div>`).join('')||'<div class="agg-vz">Nada a finalizar. 🎉</div>')}; }
function shLembretes(){ const ph=lembsHoje(), aw=lembsAguard();
  const lin=(x,bt)=>`<div class="agg-srow"><div class="t"><b>${esc(x.c.nome||'')}</b><span class="agg-mut">${esc(CAT[x.cat].l)} · ${quandoTxt(x.t.quando,x.t.hora)} · ${x.t.lemb.modo==='confirmar'?'pedir confirmação':'só lembrar'}</span></div>${bt}</div>`, j=x=>`'${J(x.c.id)}','${J(x.t.id)}'`;
  return {tit:'📨 Lembretes pro cliente',corpo:`<div class="agg-dica">O CRM deixa a mensagem pronta no dia certo. Você toca, o WhatsApp abre com o texto e você aperta enviar.</div>
    <div class="agg-sect">Pra mandar hoje · ${ph.length}</div><div>${ph.map(x=>lin(x,`<button type="button" class="agg-btn v" onclick="aggMandarAbrir(${j(x)},'lembrete')">💬 Mandar</button>`)).join('')||'<div class="agg-vz">Nenhum pra hoje.</div>'}</div>
    <div class="agg-sect">Esperando resposta · ${aw.length}</div><div>${aw.map(x=>lin(x,aggLembEstado(x.c,x.t)==='remarcar'?`${chipLemb(x.c,x.t)}<button type="button" class="agg-btn p" onclick="aggReagendarAbrir(${j(x)})">🔁 Reagendar</button>`:`<button type="button" class="agg-btn" onclick="aggLembResp(${j(x)},'confirmou')">✅ Confirmou</button><button type="button" class="agg-btn" onclick="aggLembResp(${j(x)},'remarcar')">🔁 Remarcar</button>`)).join('')||'<div class="agg-vz">Ninguém pendente.</div>'}</div>`}; }
function shSemProx(){ const l=semProx(); return {tit:'💤 Sem próxima atividade',corpo:`<div class="agg-dica">Negócio aberto sem nada marcado é negócio parado. Marque o próximo passo.</div>`
  +l.slice(0,60).map(c=>`<div class="agg-srow"><div class="t"><b>${esc(c.nome||'')}</b><span class="agg-mut">etapa ${esc(tx(()=>ET_LABEL[c.etapa])||c.etapa||'—')}</span></div><button type="button" class="agg-btn p" onclick="aggProxima('${J(c.id)}')">＋ próxima</button></div>`).join('')+(l.length>60?`<div class="agg-vz">…e mais ${l.length-60}.</div>`:'')}; }
function anivWa(r){ const w=tx(()=>waHref(r.telefone)); if(!w) return ''; const pn=String(r.cliente||'').split(' ')[0]; const nome=pn.charAt(0).toUpperCase()+pn.slice(1).toLowerCase();
  return `<a class="agg-btn v" href="${esc(w+'?text='+encodeURIComponent('Feliz aniversário, '+nome+'! 🎉'))}" target="_blank" rel="noopener" title="Parabenizar no WhatsApp (texto pronto)">💬 parabéns</a>`; }
function shAniv(){ const l=(AGG._aniv||[]).filter(a=>a.d<=7);
  return {tit:'🎂 Aniversariantes da semana',corpo:(l.map(a=>`<div class="agg-srow"><div class="t"><b>${esc(a.r.cliente||'—')}</b><span class="agg-mut">${a.d===0?'hoje 🎉':a.d===1?'amanhã':'em '+a.d+' dias'} · ${br(a.dia)}</span></div>${anivWa(a.r)}</div>`).join('')||'<div class="agg-vz">Ninguém nos próximos 7 dias.</div>')
    +'<div class="agg-row"><button type="button" class="agg-btn" onclick="aggIrPara(\'lp-aniversario\')">ver todos os aniversariantes</button></div>'}; }
function aggIrPara(v){ fecharTudo(); tx(()=>irPara(v)); }
function shDiaTudo(d){ const x=doDia(d);
  return {tit:`☑️ ${DSL[dow(d)]}, ${br(d)}`,corpo:(x.aniv.length?`<div class="agg-sect">Aniversário</div>${x.aniv.map(a=>`<div class="agg-srow"><div class="t"><b>🎂 ${esc(a.r.cliente||'')}</b></div>${anivWa(a.r)}</div>`).join('')}`:'')
    +(x.allday.length?`<div class="agg-sect">Dia todo no Google</div>${x.allday.map(m=>`<div class="agg-srow"><div class="t"><b>📆 ${esc(m.tit)}</b></div><button type="button" class="agg-btn" onclick="aggClickEv(event,'${J(m.k)}')">abrir</button></div>`).join('')}`:'')
    +`<div class="agg-sect">Sem hora · ${x.tar.length}</div><div>${x.tar.map(m=>tarMini({c:m.c,t:m.t})).join('')||'<div class="agg-vz">Nenhuma.</div>'}</div>`,
    rod:`<button type="button" class="agg-btn p" onclick="aggTrocarTarNova('${d}')">＋ tarefa neste dia</button>`}; }
function aggTrocarTarNova(d){ trocar(()=>shTarefa(null,null,{venc:d})); }

/* ═══════════ infraestrutura ═══════════ */
/* Google: tenta a sessão já autorizada (como a Agenda de hoje) e carrega o mês que a tela mostra */
function gcalGarantir(){ if(typeof GCAL==='undefined'||!GCAL) return;
  try{ if(!GCAL.tentouSilencioso&&typeof sb!=='undefined'&&sb&&typeof logado==='function'&&logado()){ GCAL.tentouSilencioso=true;
      const go=()=>{ try{ Promise.resolve(gcalCarregar(false)).then(repinta,repinta); }catch(_){} };
      if(GCAL.tok&&Date.now()<GCAL.exp-60000) go(); else tx(()=>gcalGisReady(go)); } }catch(_){}
  if(!GCAL.conectado||GCAL.mesCarregando) return;
  const ym=(AGG.modo==='semana'&&!M()?segDa(AGG.cur):AGG.cur).slice(0,7);
  if(GCAL.mes&&GCAL.mes.ym===ym) return; if(AGG.gPedido===ym) return; AGG.gPedido=ym;
  try{ Promise.resolve(gcalCarregarMes(ym)).then(()=>{ AGG.gPedido=''; repinta(); },()=>{ AGG.gPedido=''; }); }catch(_){ AGG.gPedido=''; } }
/* camada do "voltar" do Android: a folha daqui fecha antes da ficha/modal (mesmo jeito do funil-unico). Só fica na lista
   ENQUANTO há folha aberta — fechou a última, sai (o invariante "ordem das camadas" do app segue valendo com a tela parada). */
function camRegistrar(){ try{ if(typeof CAM_ORDEM==='undefined'||CAM_ORDEM.some(x=>x.n==='agg-folha')) return;
  const i=CAM_ORDEM.findIndex(x=>x.n==='modal'); CAM_ORDEM.splice(i<0?0:i,0,{n:'agg-folha',aberta:()=>!!document.getElementById('agg-ov'),fechar:()=>fechar()}); }catch(_){} }
function camTirar(){ try{ if(typeof CAM_ORDEM==='undefined') return; const i=CAM_ORDEM.findIndex(x=>x.n==='agg-folha'); if(i>=0) CAM_ORDEM.splice(i,1); }catch(_){} }
function camSinc(){ try{ if(typeof camSincronizar==='function') camSincronizar(); }catch(_){} }
/* arrastar o bloco pra mudar dia/hora — só mouse (no toque, toque abre; remarcar é pela folha) */
let ARR=null, ARR_FIM=0;
function arrInstalar(){ if(W.__aggArr) return; W.__aggArr=1;
  document.addEventListener('pointerdown',pe=>{ if(pe.pointerType!=='mouse'||pe.button!==0) return; const el=pe.target&&pe.target.closest&&pe.target.closest('.agg-ev[data-drag="1"]'); if(!el) return;
    const r=el.getBoundingClientRect(); ARR={el,k:el.dataset.k,x0:pe.clientX,y0:pe.clientY,dy:pe.clientY-r.top,mov:false,d:el.dataset.d,min:+el.dataset.min,dur:+el.dataset.dur||60}; });
  document.addEventListener('pointermove',pe=>{ const a=ARR; if(!a) return; if(!a.mov&&Math.hypot(pe.clientX-a.x0,pe.clientY-a.y0)<5) return;
    if(!a.mov){ a.mov=true; a.el.classList.add('arr'); document.body.classList.add('agg-arrastando'); }
    const col=document.elementsFromPoint(pe.clientX,pe.clientY).find(n=>n.classList&&n.classList.contains('agg-col')); if(!col) return;
    const r=col.getBoundingClientRect(), hpx=r.height/(H1-H0); let min=H0*60+Math.round((pe.clientY-a.dy-r.top)/hpx*4)*15; min=Math.max(H0*60,Math.min(H1*60-15,min));
    if(a.el.parentNode!==col) col.appendChild(a.el); a.el.style.top=((min-H0*60)/60*hpx)+'px'; a.el.style.left='2px'; a.el.style.width='calc(100% - 4px)';
    a.d=col.dataset.d; a.min=min; const eh=a.el.querySelector('.eh'); if(eh) eh.textContent=hm(min)+'–'+hm(Math.min(24*60-1,min+a.dur)); });
  document.addEventListener('pointerup',()=>{ const a=ARR; ARR=null; document.body.classList.remove('agg-arrastando'); if(!a||!a.mov) return; ARR_FIM=Date.now(); aggSoltar(a); });
  document.addEventListener('keydown',e=>{ if(e.key==='Escape'&&AGG.pilha.length&&!document.getElementById('at-ov')){ e.preventDefault(); fechar(); } }); }
/* os modais do Google (⋯ ação / editar evento) são do app e repintam só a Agenda antiga — aqui, repinta quando fecham */
function obsInstalar(){ if(W.__aggObs||typeof MutationObserver==='undefined'||!document.body) return; W.__aggObs=1;
  let mm=null; try{ mm=W.matchMedia(MOB); }catch(_){}
  if(mm&&mm.addEventListener) mm.addEventListener('change',()=>{ repinta(); repintarSheet(); });
  new MutationObserver(ms=>{ if(typeof VIEW==='undefined'||VIEW!=='ag-global') return;
    for(const m of ms) for(const n of m.removedNodes) if(n&&n.id&&/^(ev-ov|gcal-mais-bd)$/.test(n.id)){ setTimeout(repinta,0); setTimeout(repinta,1500); return; } }).observe(document.body,{childList:true}); }

/* ═══════════ estilo (escopo .agg / .agg-ov) ═══════════ */
function aggCss(){ if(document.getElementById('agg-css')) return; const s=document.createElement('style'); s.id='agg-css'; s.textContent=`
.agg{--hpx:48px;--eixo:52px;--ink2:#334155;--cinza-bg:#f1f5f9;--laranja:#c2410c;--laranja-bg:#fff7ed}
.agg .agg-mut,.agg-ov .agg-mut{color:var(--muted);font-size:12.5px}
.agg .agg-sp,.agg-ov .agg-sp{flex:1}
.agg-btn{display:inline-flex;align-items:center;justify-content:center;gap:6px;border:1px solid var(--linha);background:#fff;border-radius:9px;padding:6px 12px;min-height:38px;font-size:13px;color:#334155;white-space:nowrap;font-weight:600;text-decoration:none;cursor:pointer;font-family:inherit}
.agg-btn:hover:not(:disabled){border-color:var(--primary);color:var(--ink)}
.agg-btn.p{background:var(--primary);border-color:var(--primary);color:#fff}.agg-btn.p:hover:not(:disabled){filter:brightness(.93);color:#fff}
.agg-btn.v{background:#16a34a;border-color:#16a34a;color:#fff}.agg-btn.v:hover:not(:disabled){filter:brightness(.93);color:#fff}
.agg-btn.perigo{color:var(--verm);border-color:#fecaca}
.agg-btn.ico{min-width:38px;padding:6px 8px}
.agg-btn:disabled{opacity:.55;cursor:not-allowed}
.agg-seg{display:inline-flex;border:1px solid var(--linha);border-radius:9px;overflow:hidden;background:#fff;flex:0 0 auto}
.agg-seg button{padding:6px 12px;min-height:38px;font-size:13px;color:#334155;font-weight:600;white-space:nowrap;text-align:center}
.agg-seg button+button{border-left:1px solid var(--linha)}
.agg-seg button.on{background:var(--primary);color:#fff}
.agg-gst{display:flex;align-items:center;gap:6px 10px;flex-wrap:wrap;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:8px 12px;margin:10px 0;font-size:13px}
.agg-gdot{width:9px;height:9px;border-radius:50%;background:var(--verde);box-shadow:0 0 0 3px var(--verde-bg);flex:0 0 auto}
.agg-gdot.off{background:#94a3b8;box-shadow:0 0 0 3px #e2e8f0}
.agg-embreve{font-size:11px;font-weight:700;background:#f1f5f9;color:#5b6770;border-radius:6px;padding:1px 6px;margin-left:4px}
.agg-abas{display:flex;gap:4px;border-bottom:1px solid #cbd5e1;margin:4px 0 12px}
.agg-abas button{padding:0 16px;min-height:46px;font-weight:650;font-size:15px;color:var(--muted);border-bottom:3px solid transparent;margin-bottom:-1px;display:inline-flex;align-items:center;gap:6px}
.agg-abas button.on{color:#1d4ed8;border-bottom-color:var(--primary)}
.agg-abas .n{font-size:12px;font-weight:600;background:var(--azul-claro);color:#1d4ed8;border-radius:999px;padding:1px 7px}
.agg-abas .n.r{background:var(--verm-bg);color:#991b1b}
.agg-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,170px));gap:8px;margin-bottom:10px}
.agg-kpi{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:8px 12px}
.agg-kpi.al{border:1.5px solid #f3c9c9}
.agg-kpi .lbl{font-size:11.5px;color:var(--muted);font-weight:600}
.agg-kpi .num{font-size:19px;font-weight:700;font-variant-numeric:tabular-nums}
.agg-kpi .ks{font-size:11px;color:var(--muted)}
.agg-alertas{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.agg-chip{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--linha);background:#fff;border-radius:999px;padding:5px 12px;min-height:36px;font-size:13px;color:#334155;font-weight:600}
.agg-chip.r{background:var(--verm-bg);border-color:#fecaca;color:#991b1b}
.agg-chip.a{background:var(--amarelo-bg);border-color:#fde68a;color:var(--amarelo)}
.agg-chip.l{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
.agg-tb{display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px}
.agg-nav{display:inline-flex;align-items:center;gap:6px}
.agg-per{font-weight:700;font-size:15px;white-space:nowrap;margin-left:4px}
.agg-leg{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:10px}
.agg-lg{display:inline-flex;align-items:center;gap:6px;border:1px solid var(--linha);background:#fff;border-radius:999px;padding:4px 11px;min-height:32px;font-size:12.5px;color:#334155}
.agg-lg .sw{width:10px;height:10px;border-radius:3px;background:var(--c)}
.agg-lg.off{opacity:.45;text-decoration:line-through}
.agg-strip{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:4px;margin-bottom:8px}
.agg-strip button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;min-height:54px;border-radius:10px;background:#fff;border:1px solid var(--linha);font-size:11px;color:var(--muted);text-align:center}
.agg-strip button b{font-size:16px;color:var(--ink)}
.agg-strip .dots,.agg-mm .dots{display:flex;gap:2px;height:6px}
.agg-strip .dots i,.agg-mm .dots i{width:5px;height:5px;border-radius:50%;background:var(--c)}
.agg-strip button.hoje b{color:var(--primary)}
.agg-strip button.sel{background:var(--primary);border-color:var(--primary);color:#dbeafe}
.agg-strip button.sel b{color:#fff}.agg-strip button.sel .dots i{background:#fff!important}
.agg-strip button.faixa{background:var(--azul-claro);border-color:var(--azul-borda)}
.agg-grade{background:#fff;border:1px solid var(--linha);border-radius:12px;overflow:clip}
.agg-ghd,.agg-gad,.agg-gbody{display:grid;grid-template-columns:var(--eixo) repeat(var(--n),minmax(0,1fr))}
.agg-ghd{position:sticky;top:0;z-index:6;background:#fff;border-bottom:1px solid var(--linha)}
.agg-dh{display:flex;align-items:baseline;justify-content:center;gap:6px;padding:8px 4px;min-height:44px;border-left:1px solid var(--linha);font-size:12px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.agg-dh b{font-size:18px;color:var(--ink);letter-spacing:0}
.agg-dh.hoje b{background:var(--primary);color:#fff;border-radius:999px;min-width:30px;display:inline-block;text-align:center;padding:0 6px}
.agg-dh:hover{background:var(--fundo)}
.agg-gad{border-bottom:1px solid var(--linha);background:#fbfcfe}
.agg-gad>.agg-ax{font-size:10.5px;color:var(--muted);display:flex;align-items:center;justify-content:center;text-align:center;line-height:1.1}
.agg-adc{border-left:1px solid var(--linha);padding:4px;display:flex;flex-wrap:wrap;gap:4px;min-height:34px;align-content:flex-start;min-width:0}
.agg-adb{display:inline-flex;align-items:center;gap:4px;border-radius:6px;padding:2px 7px;font-size:11.5px;background:#f1f5f9;color:#334155;border:1px solid var(--linha);max-width:100%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:24px}
.agg-adb.tar{background:#fff7ed;border-color:#fed7aa;color:#c2410c}
.agg-adb.tar.at{background:var(--verm-bg);border-color:#fecaca;color:#991b1b}
.agg-adb.aniv{background:#fdf2f8;border-color:#fbcfe8;color:#9d174d}
.agg-ax{position:relative}
.agg-gbody .agg-ax{height:calc(var(--hpx) * var(--nh))}
.agg-hr{position:absolute;right:6px;font-size:11px;color:var(--muted);transform:translateY(-50%);font-variant-numeric:tabular-nums}
.agg-col{position:relative;border-left:1px solid var(--linha);height:calc(var(--hpx) * var(--nh));cursor:cell;min-width:0;
  background-image:linear-gradient(to bottom,var(--linha) 1px,transparent 1px),linear-gradient(to bottom,#f1f5f9 1px,transparent 1px);
  background-size:100% var(--hpx),100% calc(var(--hpx) / 2);background-position:0 0,0 calc(var(--hpx) / 2)}
.agg-col.hoje{background-color:#f8fbff}.agg-col.fds{background-color:#fafafa}
.agg-ev{position:absolute;z-index:2;border-radius:7px;border-left:4px solid var(--c);background:var(--bg);color:var(--ink);padding:2px 6px;font-size:12px;line-height:1.25;overflow:hidden;text-align:left;box-shadow:0 1px 2px rgba(15,23,42,.10);display:flex;flex-direction:column;align-items:flex-start;justify-content:flex-start;cursor:pointer;touch-action:manipulation;user-select:none;-webkit-user-select:none}
.agg-ev:hover{box-shadow:0 3px 10px rgba(15,23,42,.18);z-index:3}
.agg-ev[data-drag="1"]{cursor:grab}
.agg-ev .eh{font-size:11px;font-variant-numeric:tabular-nums;opacity:.85;white-space:nowrap}
.agg-ev b{font-weight:650;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;color:var(--ink)}
.agg-ev .et{font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;color:#334155}
.agg-ev .elb{position:absolute;top:2px;right:4px;font-size:12px}
.agg-ev.temlb .eh{padding-right:15px;max-width:100%;overflow:hidden;text-overflow:ellipsis}
.agg-ev.curto{flex-direction:row;gap:5px;align-items:center}
.agg-ev.feito{opacity:.5}.agg-ev.feito b{text-decoration:line-through}
.agg-ev.afin{outline:2px dashed var(--verm);outline-offset:-2px}
.agg-ev.google{background:repeating-linear-gradient(135deg,#f8fafc 0 6px,#eef2f6 6px 12px)}
.agg-ev.arr{opacity:.85;box-shadow:0 8px 24px rgba(15,23,42,.3);z-index:9;cursor:grabbing}
body.agg-arrastando{user-select:none;-webkit-user-select:none;cursor:grabbing}
.agg-agora{position:absolute;left:0;right:0;height:2px;background:#ef4444;z-index:4;pointer-events:none}
.agg-agora::before{content:"";position:absolute;left:-5px;top:-4px;width:10px;height:10px;border-radius:50%;background:#ef4444}
.agg-ghost{position:absolute;left:3px;right:3px;height:calc(var(--hpx) / 2);border:1.5px dashed var(--primary);border-radius:7px;background:rgba(37,99,235,.07);color:#1d4ed8;font-size:12px;font-weight:600;padding:2px 6px;pointer-events:none;display:none;z-index:1}
.agg-diaw{display:flex;gap:12px;align-items:flex-start}
.agg-diaw .agg-grade{flex:1;min-width:0}
.agg-lado{flex:0 0 300px;display:flex;flex-direction:column;gap:10px;position:sticky;top:8px}
.agg-cx{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.agg-cx h3{margin:0;font-size:14px}
.agg-vz{font-size:12.5px;color:var(--muted);padding:8px 0}
.agg-mes{background:#fff;border:1px solid var(--linha);border-radius:12px;overflow:hidden}
.agg-mes-hd{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));border-bottom:1px solid var(--linha);font-size:11.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-weight:600}
.agg-mes-hd span{padding:8px;text-align:center}
.agg-mes-g{display:grid;grid-template-columns:repeat(7,minmax(0,1fr))}
.agg-mc{min-height:118px;border-right:1px solid var(--linha);border-bottom:1px solid var(--linha);padding:4px;display:flex;flex-direction:column;gap:3px;cursor:cell;position:relative;min-width:0}
.agg-mc:nth-child(7n){border-right:0}
.agg-mc.fora{background:#fafbfc}.agg-mc.fora .mn{color:#94a3b8}
.agg-mc:hover{background:#f8fbff}
.agg-mc .mn{align-self:flex-start;font-weight:700;font-size:13px;min-width:28px;min-height:26px;border-radius:999px;padding:0 6px;color:var(--ink)}
.agg-mc .mn:hover{background:var(--azul-claro)}
.agg-mc.hoje .mn{background:var(--primary);color:#fff}
.agg-mch{display:flex;align-items:center;gap:4px;border-radius:5px;padding:1px 5px;font-size:11.5px;background:var(--bg);color:var(--ink);border-left:3px solid var(--c);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;min-height:20px;text-align:left;max-width:100%}
.agg-mch.feito{opacity:.5;text-decoration:line-through}
.agg-mch .h{font-variant-numeric:tabular-nums;color:#334155;font-size:11px}
.agg-mais{font-size:11.5px;color:#1d4ed8;font-weight:600;align-self:flex-start;padding:0 4px;min-height:20px}
.agg-mm{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:2px;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:6px}
.agg-mm .wd{font-size:11px;color:var(--muted);text-align:center;padding:4px 0;font-weight:600}
.agg-mm button{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;min-height:48px;border-radius:10px;font-weight:650;font-size:14px;color:var(--ink)}
.agg-mm button.fora{color:#94a3b8;font-weight:500}.agg-mm button.hoje{color:var(--primary)}
.agg-mm button.sel{background:var(--primary);color:#fff}.agg-mm button.sel .dots i{background:#fff!important}
.agg-dl{margin-top:10px;display:flex;flex-direction:column;gap:6px}
.agg-dl h3{margin:4px 2px;font-size:14px}
.agg-dlr{display:flex;align-items:center;gap:10px;background:#fff;border:1px solid var(--linha);border-left:4px solid var(--c);border-radius:10px;padding:8px 12px;min-height:52px;width:100%;text-align:left}
.agg-dlr .h{font-variant-numeric:tabular-nums;font-weight:700;min-width:44px}
.agg-dlr .t{flex:1;min-width:0;display:flex;flex-direction:column}
.agg-dlr .t b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agg-dlr .t span{font-size:12px;color:var(--muted)}
.agg-dlr.feito{opacity:.55}
.agg-row2{display:flex;gap:8px}.agg-row2 .agg-btn{flex:1}
.agg-bl{background:#fff;border:1px solid var(--linha);border-radius:12px;margin-bottom:8px}
.agg-bl.fechado>.agg-blb{display:none}
.agg-blhw{display:flex;align-items:stretch}
.agg-blh{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:0 14px;min-height:50px;text-align:left}
.agg-blh .car{color:var(--muted);font-size:12px;width:12px}
.agg-blh .tt{font-weight:650;white-space:nowrap}
.agg-blh .rs{margin-left:auto;font-size:12.5px;color:var(--muted);text-align:right;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.agg-blh .rs .vm,.agg-blh .rs .vm{color:var(--verm);font-weight:600}
.agg-blnovo{margin:6px 8px 6px 0;align-self:center}
.agg-blb{border-top:1px solid var(--linha);padding:6px 12px 10px}
.agg-bl .agg-bl{margin:8px 0 0;background:#fbfcfe}
.agg-lin{display:grid;grid-template-columns:28px minmax(0,1fr) auto auto;gap:4px 10px;align-items:center;padding:8px 0;border-bottom:1px solid var(--linha)}
.agg-lin:last-child{border-bottom:0}
.agg-lic{width:28px;height:28px;border-radius:8px;background:var(--bg,#f1f5f9);display:inline-flex;align-items:center;justify-content:center;font-size:14px}
.agg-lm{min-width:0}
.agg-ln{font-weight:650;text-decoration:underline dotted;text-underline-offset:3px;min-height:28px;text-align:left}
.agg-ls{display:flex;flex-wrap:wrap;gap:4px;align-items:center;margin-top:2px}
.agg-lq{font-size:12.5px;color:#334155;white-space:nowrap;font-variant-numeric:tabular-nums}
.agg-lq.at{color:var(--verm);font-weight:600}.agg-lq.hj{color:#1d4ed8;font-weight:600}
.agg-la{display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
.agg-la select{border:1px solid var(--linha);border-radius:9px;padding:6px 8px;min-height:38px;background:#fff;font-size:13px;color:#334155;max-width:180px}
.agg-lin.afin{background:linear-gradient(90deg,#fff5f5,transparent)}
.agg-bd{display:inline-flex;align-items:center;gap:4px;font-size:11px;border-radius:6px;padding:2px 6px;background:#f1f5f9;color:#5b6770;white-space:nowrap;font-weight:600}
.agg-bd.tp{background:var(--bg);color:var(--ink);border-left:3px solid var(--c)}
.agg-bd.vt{background:var(--roxo-bg);color:var(--roxo)}
.agg-lb{display:inline-flex;align-items:center;gap:4px;font-size:11.5px;border-radius:999px;padding:2px 8px;font-weight:600;white-space:nowrap}
.agg-lb-ag{background:#f1f5f9;color:#475569}.agg-lb-pr{background:#e0f2fe;color:#075985}.agg-lb-aw{background:var(--amarelo-bg);color:var(--amarelo)}
.agg-lb-ok{background:var(--verde-bg);color:#15803d}.agg-lb-rm{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa}.agg-lb-env{background:#f1f5f9;color:#15803d}
.agg-trow{display:grid;grid-template-columns:auto minmax(0,1fr) auto;gap:6px 10px;align-items:center;background:#fff;border:1px solid var(--linha);border-left:4px solid var(--pc);border-radius:10px;padding:8px 12px;margin-bottom:6px}
.agg-trow.at{background:#fff8f8;border-color:#fecaca;border-left-color:var(--verm)}
.agg-ckb{width:30px;height:30px;border-radius:8px;border:2px solid #cbd5e1;display:inline-flex;align-items:center;justify-content:center;color:transparent;font-weight:800;background:#fff;flex:0 0 auto}
.agg-ckb:hover{border-color:var(--verde);color:#bbf7d0}
.agg-ckb.on{background:var(--verde);border-color:var(--verde);color:#fff}
.agg-tm{min-width:0}
.agg-tnome{font-weight:650;font-size:14px;text-align:left;min-height:28px}
.agg-tnome:not(.sem):hover{color:#1d4ed8;text-decoration:underline}
.agg-trow.feita .agg-tnome{text-decoration:line-through;color:var(--muted)}
.agg-tmeta{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;font-size:12px;color:var(--muted);margin-top:2px}
.agg-lnk{font-size:12px;color:var(--muted);min-height:24px;text-align:left}.agg-lnk:hover{color:#1d4ed8;text-decoration:underline}
.agg-lnk2{font-size:12.5px;color:#1d4ed8;font-weight:600;min-height:36px;text-align:left;align-self:flex-start}
.agg-tvenc{font-weight:600;color:#334155}.agg-tvenc.at{color:var(--verm)}.agg-tvenc.hj{color:#1d4ed8}
.agg-pr{font-size:11px;border-radius:6px;padding:1px 7px;font-weight:700}
.agg-pr.alta{background:var(--verm-bg);color:#991b1b}.agg-pr.media{background:var(--amarelo-bg);color:var(--amarelo)}.agg-pr.baixa{background:#f1f5f9;color:#5b6770}
.agg-av{display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;font-size:11px;font-weight:800;color:#fff;background:var(--primary);flex:0 0 auto}
.agg-av.v{background:var(--roxo)}
.agg-tact{display:flex;gap:6px;align-items:center}
.agg-ckl{grid-column:2/-1;display:flex;flex-direction:column;gap:2px;padding:4px 0 2px}
.agg-cki{display:flex;align-items:center;gap:8px;min-height:32px;text-align:left;font-size:13px;border-radius:8px;padding:0 6px}
.agg-cki:hover{background:var(--fundo)}
.agg-cki .bx{width:18px;height:18px;border-radius:5px;border:2px solid #cbd5e1;display:inline-flex;align-items:center;justify-content:center;font-size:11px;color:#fff;flex:0 0 auto}
.agg-cki.ok .bx{background:var(--verde);border-color:var(--verde)}
.agg-cki.ok span:last-child{text-decoration:line-through;color:var(--muted)}
.agg-kb{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;align-items:start}
.agg-kc{background:#e9eef4;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:220px;transition:background .15s}
.agg-kc.drop{outline:2px dashed var(--primary);outline-offset:-2px;background:var(--azul-claro)}
.agg-kch{display:flex;align-items:center;gap:8px;padding:4px 4px 2px}
.agg-kch .dot{width:9px;height:9px;border-radius:50%}.agg-kch b{font-size:13.5px}
.agg-kch .q{margin-left:auto;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}
.agg-kcard{background:#fff;border:1px solid var(--linha);border-left:4px solid var(--pc);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:6px;box-shadow:0 1px 2px rgba(15,23,42,.05)}
.agg-kcard[draggable=true]{cursor:grab}
.agg-kcard.at{border-color:#fecaca;border-left-color:var(--verm);background:#fff8f8}
.agg-kcard.arr{opacity:.4}
.agg-kcard .kt{font-weight:650;text-align:left}
.agg-kcard button.kt:hover{color:#1d4ed8}
.agg-kcard .kf{display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;color:var(--muted)}
.agg-kvz{font-size:12px;color:var(--muted);text-align:center;padding:14px 6px;border:1px dashed #cbd5e1;border-radius:10px}
.agg-ktabs{display:none;gap:6px;margin-bottom:8px}
.agg-ktabs button{flex:1;border:1px solid var(--linha);background:#fff;border-radius:999px;min-height:44px;font-size:13px;font-weight:600;color:#334155;white-space:nowrap;padding:0 8px;text-align:center;min-width:0;overflow:hidden;text-overflow:ellipsis}
.agg-ktabs button.on{background:var(--primary);border-color:var(--primary);color:#fff}
.agg-prog{display:inline-flex;align-items:center;gap:4px;font-size:12px;color:#334155;font-weight:600}
.agg-prog i{display:inline-block;width:34px;height:5px;border-radius:3px;background:var(--linha);overflow:hidden;position:relative}
.agg-prog i::after{content:"";position:absolute;inset:0 auto 0 0;width:var(--p);background:var(--verde)}
.agg-srow{display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--linha);padding:8px 0;flex-wrap:wrap}
.agg-srow:last-child{border-bottom:0}
.agg-srow .t{flex:1;min-width:160px}.agg-srow .t b{display:block}
.agg-srow .t .agg-tnome{display:block}
/* folha / modal */
body.agg-trava{overflow:hidden}
.agg-ov{position:fixed;inset:0;background:rgba(15,23,42,.42);z-index:94}
.agg-sh{position:fixed;z-index:95;background:#fff;display:flex;flex-direction:column;top:50%;left:50%;transform:translate(-50%,-50%);width:min(600px,calc(100vw - 32px));max-height:min(88vh,860px);border-radius:16px;box-shadow:0 24px 60px rgba(15,23,42,.35);color:var(--ink);font-size:14px}
.agg-shh{display:flex;align-items:center;gap:10px;padding:12px 12px 10px 18px;border-bottom:1px solid var(--linha);flex:0 0 auto}
.agg-shh h2{margin:0;font-size:17px;flex:1;min-width:0}
.agg-shh .x{width:40px;height:40px;border-radius:50%;font-size:18px;color:var(--muted);flex:0 0 auto;display:inline-flex;align-items:center;justify-content:center}
.agg-shh .x:hover{background:var(--fundo)}
.agg-shh .vol{min-height:40px;padding:0 8px;border-radius:8px;color:#1d4ed8;font-weight:600}
.agg-shh .alca{display:none}
.agg-shb{flex:1;overflow:auto;padding:14px 18px;display:flex;flex-direction:column;gap:14px;overscroll-behavior:contain}
.agg-shf{flex:0 0 auto;display:flex;gap:8px;align-items:center;justify-content:flex-end;flex-wrap:wrap;padding:10px 18px;border-top:1px solid var(--linha);padding-bottom:max(10px,env(safe-area-inset-bottom,0px))}
.agg-shf .nota{margin-right:auto;font-size:12px;color:var(--muted)}
.agg-fld{display:flex;flex-direction:column;gap:5px;min-width:0}
.agg-fld>label,.agg-ov .fl{font-size:12px;color:var(--muted);font-weight:650;letter-spacing:.01em}
.agg-fld input,.agg-fld select,.agg-fld textarea,.agg-ckle input{border:1px solid #cbd5e1;border-radius:9px;padding:8px 10px;min-height:40px;background:#fff;width:100%;min-width:0;font-size:14px;color:var(--ink);font-family:inherit}
.agg-fld textarea{min-height:120px;resize:vertical;line-height:1.45}
.agg-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.agg-pills{display:flex;gap:6px;flex-wrap:wrap}
.agg-pill{min-height:38px;padding:0 12px;border-radius:999px;border:1px solid var(--linha);background:#fff;font-size:13px;color:#334155;font-weight:600;display:inline-flex;align-items:center;gap:6px}
.agg-pill.on{background:var(--azul-claro);border-color:var(--primary);color:#1d4ed8}
.agg-seg.f{display:flex;width:100%}.agg-seg.f button{flex:1}
.agg-csel{display:flex;align-items:center;gap:8px;border:1px solid var(--azul-borda);background:var(--azul-claro);border-radius:9px;padding:6px 6px 6px 12px;min-height:44px;flex-wrap:wrap}
.agg-csel b{flex:1;min-width:0}
.agg-bcr{display:flex;flex-direction:column;border:1px solid var(--linha);border-radius:9px;overflow:hidden;margin-top:4px}
.agg-bcr:empty{display:none}
.agg-bcr button{display:flex;align-items:center;gap:8px;padding:0 12px;min-height:42px;text-align:left;border-bottom:1px solid var(--linha);font-size:13.5px}
.agg-bcr button:last-child{border-bottom:0}.agg-bcr button:hover{background:var(--fundo)}
.agg-bcr .agg-vz{padding:8px 12px}
.agg-msgv{background:#dcf8c6;border-radius:12px 12px 12px 4px;padding:10px 12px;font-size:13px;line-height:1.45;white-space:pre-wrap;color:#111827;border:1px solid #c5ecab}
.agg-dica{font-size:12.5px;color:var(--muted);line-height:1.45}
.agg-aviso{background:#fff7ed;color:#c2410c;border:1px solid #fed7aa;border-radius:10px;padding:8px 12px;font-size:13px;font-weight:600}
.agg-aviso.vm{background:var(--verm-bg);color:#991b1b;border-color:#fecaca}
.agg-aviso.az{background:var(--azul-claro);color:#1d4ed8;border-color:var(--azul-borda)}
.agg-ecab{border-left:5px solid var(--c);background:var(--bg);border-radius:10px;padding:12px 14px;display:flex;flex-direction:column;gap:4px}
.agg-ecab .big{font-size:18px;font-weight:700}.agg-ecab .ln{font-size:13.5px;color:#334155}
.agg-box{border:1px solid var(--linha);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.agg-box h3{margin:0;font-size:14px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.agg-row{display:flex;gap:8px;flex-wrap:wrap}
.agg-acts{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}.agg-acts .agg-btn{min-height:44px}
.agg-gpar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.agg-opt{display:flex;align-items:flex-start;gap:10px;text-align:left;border:1px solid var(--linha);border-radius:12px;padding:10px 12px;min-height:52px;width:100%}
.agg-opt:hover:not(:disabled){border-color:var(--primary);background:#f8fbff}.agg-opt:disabled{opacity:.5}
.agg-opt .oi{font-size:18px;line-height:1.2}.agg-opt b{display:block}
.agg-sect{font-size:12px;color:var(--muted);font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin:4px 0 -6px}
.agg-ckle{display:flex;align-items:center;gap:6px}.agg-ckle input{flex:1}
.agg .so-m{display:none}
/* ═════════ celular ═════════ */
@media (max-width:760px){
  .agg{--hpx:60px;--eixo:40px}
  .agg-btn,.agg-seg button,.agg-pill,.agg-chip,.agg-lg,.agg-ln,.agg-tnome,.agg-kcard .kt,.agg-cki,.agg-mais,.agg-blnovo,.agg-lnk,.agg-lnk2,.agg-mc .mn,.agg-la select{min-height:44px}
  .agg-btn,.agg-pill,.agg-btn.ico{min-width:44px}
  .agg-shh .x{width:44px;height:44px}.agg-shh .vol{min-height:44px}
  .agg-ckb{width:44px;height:44px}
  .agg input,.agg select,.agg textarea,.agg-ov input,.agg-ov select,.agg-ov textarea{font-size:16px!important;min-height:44px}
  .agg-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}
  .agg-kpi{padding:8px 10px}.agg-kpi .ks{display:none}
  .agg-gst{font-size:12.5px}.agg-gst .agg-sp,.agg-gst>.agg-mut{display:none}.agg-gst .agg-eb{white-space:normal;text-align:left;justify-content:flex-start}
  .agg-alertas{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-12px;padding-inline:12px}
  .agg-alertas::-webkit-scrollbar{display:none}.agg-chip{flex:0 0 auto}
  .agg-tb .agg-modos{display:grid;grid-template-columns:repeat(4,1fr);width:100%}
  .agg-tb .agg-modos button{padding:0 4px}
  .agg-nav{width:100%}.agg-nav .agg-per{margin-left:auto;font-size:14px}
  .agg-tb>.agg-sp{display:none}
  .agg-tb .agg-novo{width:100%}
  .agg-tb>.agg-seg:not(.agg-modos){flex:1 1 auto}.agg-tb>.agg-seg:not(.agg-modos) button{flex:1}
  .agg-leg{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none;margin-inline:-12px;padding-inline:12px}
  .agg-leg::-webkit-scrollbar{display:none}.agg-lg{flex:0 0 auto}
  .agg-dh{flex-direction:column;align-items:center;gap:0;padding:4px 2px;font-size:10.5px}
  .agg-dh b{font-size:16px}
  .agg-adc{padding:3px}
  .agg-adb{min-height:44px;width:100%;justify-content:center;font-size:12px}
  .agg-ev{min-height:44px;font-size:11.5px;padding:2px 4px}
  .agg-ev .et{display:none}
  .agg-lado{display:none}
  .agg-mc{min-height:0}
  .agg-lin{grid-template-columns:28px minmax(0,1fr) auto}
  .agg-la{grid-column:1/-1;justify-content:flex-start;flex-wrap:nowrap}
  .agg-la select{flex:1 1 0;min-width:0;width:0;max-width:none}
  .agg-lq{grid-column:3;grid-row:1}
  .agg-blh{min-height:52px;padding:0 12px}
  .agg-blh .rs{max-width:55%}
  .agg-blb{padding:6px 10px 10px}
  .agg-ckl{grid-column:1/-1}
  .agg-kb{grid-template-columns:1fr}
  .agg-kc{min-height:0;background:transparent;padding:0}
  .agg-kch{display:none}
  .agg-kc:not(.vis){display:none}
  .agg-ktabs{display:flex}
  .agg-kcard .kf .agg-btn{min-height:44px}
  .agg-abas button{flex:1;justify-content:center}
  .agg-acts{grid-template-columns:1fr 1fr}
  .agg-seg.f button{padding:0 6px;white-space:normal;line-height:1.15;font-size:13px}
  .agg-sh{top:auto;left:0;right:0;bottom:0;transform:none;width:100%;max-height:92vh;max-height:92dvh;border-radius:18px 18px 0 0}
  .agg-shh .alca{display:block;position:absolute;top:6px;left:50%;transform:translateX(-50%);width:44px;height:5px;border-radius:3px;background:#cbd5e1}
  .agg-shh{position:relative;padding:16px 8px 8px 16px}
  .agg-shb{padding:12px 16px}
  .agg-shf{padding:10px 16px max(12px,env(safe-area-inset-bottom,0px))}
  .agg-shf .agg-btn{flex:1}
  .agg-shf .nota{width:100%;flex:none}
  .agg-bcr button{min-height:44px}
  .agg-trow{grid-template-columns:auto minmax(0,1fr) auto}
  .agg-srow .t{min-width:0;flex-basis:100%}
}
@media (prefers-reduced-motion:reduce){.agg *,.agg-ov *{transition:none!important;animation:none!important}}
`; document.head.appendChild(s); }

/* ═══════════ autotestes (rodam no lpSelfCheck do portão) ═══════════ */
function agendaGlobalSelfTests(ok){
  ok('AGENDA-GLOBAL: situação padrão — feito ⇒ Concluída; sem campo ⇒ Pendente; t.st andamento vale; "concluida" sem feito volta a Pendente',
    aggStatus({feito:'2026-10-01T10:00:00Z'})==='concluida'&&aggStatus({})==='pendente'&&aggStatus({st:'andamento'})==='andamento'&&aggStatus({st:'concluida',feito:null})==='pendente'&&aggStatus({feito:'x',st:'andamento'})==='concluida');
  ok('AGENDA-GLOBAL: a semana começa na SEGUNDA (qua 28/10 → seg 26/10; dom 01/11 → seg 26/10; seg fica seg)',
    segDa('2026-10-28')==='2026-10-26'&&segDa('2026-11-01')==='2026-10-26'&&segDa('2026-10-26')==='2026-10-26'&&segDa('2026-11-02')==='2026-11-02');
  ok('AGENDA-GLOBAL: lembrete padrão por tipo — reunião pede confirmação; entrega de apólice só lembra; ligação/outros sem lembrete',
    aggLembPadrao('reuniao','oi')==='confirmar'&&aggLembPadrao('reuniao','pc')==='confirmar'&&aggLembPadrao('reuniao','entrega')==='lembrar'&&aggLembPadrao('ligar','ligar')==='nao'&&aggLembPadrao('follow','outro')==='nao');
  ok('AGENDA-GLOBAL: categoria da reunião vem da etapa (OI/FF → OI; C2 → C2; P/C → PC; DELIVERY → entrega; ligar → ligação)',
    aggCat({funil:'nn',etapa:'OI/FF'},{tipo:'reuniao'})==='oi'&&aggCat({funil:'nn',etapa:'C2'},{tipo:'reuniao'})==='c2'&&aggCat({funil:'nn',etapa:'P/C'},{tipo:'reuniao'})==='pc'&&aggCat({funil:'nn',etapa:'DELIVERY'},{tipo:'reuniao'})==='entrega'&&aggCat({},{tipo:'ligar'})==='ligar'&&aggCat({},{tipo:'follow'})==='outro');
  { const a=aggStatusPlano({},'concluida'), b=aggStatusPlano({feito:'x'},'andamento'), c=aggStatusPlano({},'andamento'), d=aggStatusPlano({st:'andamento'},'andamento'), e=aggStatusPlano({},'inventado');
    ok('AGENDA-GLOBAL: transições — Pendente→Concluída conclui (tarConcluir); Concluída→Em andamento reabre (tarReabrir); Pendente→Em andamento só troca o campo; igual/inválido não faz nada',
      a.concluir&&!a.reabrir&&b.reabrir&&!b.concluir&&b.para==='andamento'&&!c.concluir&&!c.reabrir&&!c.nada&&c.para==='andamento'&&d.nada&&e.nada); }
  ok('AGENDA-GLOBAL: atividade antiga sem os campos novos lê com padrão (prioridade média, responsável = quem marcou, checklist vazio)',
    aggPrio({})==='media'&&aggPrio({prio:'alta'})==='alta'&&aggPrio({prio:'x'})==='media'&&aggResp({_dono:'g@x.invalid'},{por:'v@x.invalid'})==='victor'&&aggResp({_dono:'g@x.invalid'},{por:'g@x.invalid'})==='eu'&&aggResp({},{})==='eu'&&aggResp({},{resp:'victor'})==='victor'&&aggCheck({}).length===0&&aggCheck({check:[{t:'a',ok:true},null,{x:1}]}).length===1);
  { const H='2026-10-26', c={id:'agg-t',tarefas:[]};
    const e1=aggLembEstado(c,{quando:'2026-10-28',lemb:{modo:'confirmar',quando:'vespera'}},H), e2=aggLembEstado(c,{quando:'2026-10-27',lemb:{modo:'confirmar',quando:'vespera'}},H),
          e3=aggLembEstado(c,{quando:'2026-10-27',lemb:{modo:'lembrar',quando:'dia'}},H), e4=aggLembEstado(c,{quando:'2026-10-27',lemb:{modo:'confirmar',estado:'confirmou'}},H),
          e5=aggLembEstado(c,{quando:'2026-10-27',feito:'x',lemb:{modo:'confirmar'}},H), e6=aggLembEstado(c,{quando:'2026-10-20',lemb:{modo:'confirmar'}},H);
    const cL={id:'agg-t2',tarefas:[{id:'L1',feito:'2026-10-26T09:00:00Z'}]}, e7=aggLembEstado(cL,{quando:'2026-10-27',lemb:{modo:'confirmar',quando:'vespera',tid:'L1'}},H), e8=aggLembEstado(cL,{quando:'2026-10-27',lemb:{modo:'lembrar',quando:'vespera',tid:'L1'}},H);
    ok('AGENDA-GLOBAL: lembrete — agendado antes do dia, pronto na véspera/no dia, estado gravado manda, feito/passado some; lembrete do GC-25 concluído lá vira aguardando/enviado',
      e1==='agendado'&&e2==='pronto'&&e3==='agendado'&&e4==='confirmou'&&e5===''&&e6===''&&e7==='aguardando'&&e8==='enviado'); }
  /* pinta as 3 telas com dados inventados (sem tocar a base) e varre o HTML */
  const bak={D:AGG.D,G:AGG.G,IDX:AGG.IDX,aniv:AGG._aniv,modo:AGG.modo,cur:AGG.cur,aba:AGG.aba,tarModo:AGG.tarModo};
  let hs='', hl='', ht='', hq='', hm2='', er='';
  try{ const hoje=HJ(), cF={id:'agg-f1',nome:'Fulano de Tal',funil:'nn',etapa:'OI/FF',telefone:'81900000000',tarefas:[]}, cB={id:'agg-f2',nome:'Beltrano Souza',funil:'nn',etapa:'P/C',tarefas:[]};
    const t1={id:'t1',tipo:'reuniao',tit:'Reunião',quando:hoje,hora:'10:00',dur:60,feito:null,lemb:{modo:'confirmar',quando:'vespera'}}, t2={id:'t2',tipo:'follow',tit:'Mandar proposta',quando:hoje,hora:'',feito:null,destino:'tarefa',prio:'alta',check:[{t:'PDF',ok:false}]},
          t3={id:'t3',tipo:'ligar',tit:'Ligar',quando:add(hoje,1),hora:'07:30',dur:15,feito:null};
    cF.tarefas=[t1,t3]; cB.tarefas=[t2];
    AGG.D={hoje,cs:[cF,cB],it:[{c:cF,t:t1,k:'c:agg-f1:t1',cat:aggCat(cF,t1)},{c:cF,t:t3,k:'c:agg-f1:t3',cat:aggCat(cF,t3)},{c:cB,t:t2,k:'c:agg-f2:t2',cat:aggCat(cB,t2)}],lig:new Set()};
    AGG.G=[]; AGG._aniv=[]; indexar(); AGG.cur=hoje; AGG.aba='agenda';
    AGG.modo='semana'; hs=agendaHTML(); AGG.modo='lista'; hl=agendaHTML(); AGG.modo='mes'; hm2=agendaHTML();
    AGG.tarModo='lista'; ht=tarefasHTML(); AGG.tarModo='quadro'; hq=tarefasHTML(); }catch(e){ er=String((e&&e.message)||e); }
  finally{ AGG.D=bak.D; AGG.G=bak.G; AGG.IDX=bak.IDX; AGG._aniv=bak.aniv; AGG.modo=bak.modo; AGG.cur=bak.cur; AGG.aba=bak.aba; AGG.tarModo=bak.tarModo; }
  const tudo=hs+hl+ht+hq+hm2;
  ok('AGENDA-GLOBAL: Semana, Lista, Mês, Tarefas (lista e quadro) desenham sem erro'+(er?' — '+er:''), !er&&!!hs&&!!hl&&!!ht&&!!hq&&!!hm2);
  ok('AGENDA-GLOBAL: grade das 7h às 21h (eixo 08:00…20:00, sem 06:00 nem 21:00 no eixo) e o bloco das 10h está na grade', /data-h0="7" data-h1="21"/.test(hs)&&/>08:00</.test(hs)&&/>20:00</.test(hs)&&!/>06:00</.test(hs)&&!/>21:00</.test(hs)&&/data-k="c:agg-f1:t1"/.test(hs));
  ok('AGENDA-GLOBAL: ao entrar na tela o modo é Semana, no dia de hoje, aba Agenda', (()=>{ const b={aba:AGG.aba,modo:AGG.modo,cur:AGG.cur,viu:AGG.viu}; try{ AGG.aba='tarefas'; AGG.modo='mes'; AGG.cur='2020-01-01'; entrar(); return MODO_INICIAL==='semana'&&AGG.modo==='semana'&&AGG.cur===HJ()&&AGG.aba==='agenda'; } finally{ Object.assign(AGG,b); } })());
  ok('AGENDA-GLOBAL: bloco dobrável nasce fechado (sem escolha gravada) e a Lista não traz details aberto', aberta('agg-sem-escolha-gravada')===false&&/class="agg-bl fechado"/.test(hl)&&!/<details[^>]*\sopen[\s>]/.test(tudo));
  ok('AGENDA-GLOBAL: sem "abrir tudo / recolher tudo" (SEM-TUDO-V1)', !/Abrir tudo|Recolher tudo|Expandir tudo/i.test(tudo));
  ok('AGENDA-GLOBAL: o link público pro cliente marcar fica "em breve" e desligado', /disabled title="Fase B[^"]*">🔗 Link pro cliente marcar sozinho/.test(gstHTML()));
  ok('AGENDA-GLOBAL: tarefa mostra prioridade, checklist e situação; quadro tem as 3 colunas', /agg-pr alta/.test(ht)&&/☑ 0\/1/.test(ht)&&['pendente','andamento','concluida'].every(k=>hq.includes(`data-st="${k}"`)));
  ok('AGENDA-GLOBAL: mensagem do lembrete é preparada (nunca enviada) e pede confirmação quando o modo é confirmar', /me confirmar/.test(msgLembrete({nome:'Fulano de Tal'},{tipo:'reuniao',quando:'2026-10-27',hora:'10:00'},'confirmar'))&&!/me confirmar/.test(msgLembrete({nome:'Fulano'},{tipo:'reuniao',quando:'2026-10-27'},'lembrar')));
  ok('AGENDA-GLOBAL: toda função chamada nos botões da tela existe no window', (()=>{ const re=/on(?:click|change|input|keydown|dragstart|dragend|dragover|dragleave|drop|mousemove|mouseleave)="(?:[^"]*?;)?\s*(?:event\.[a-zA-Z]+\(\);\s*)*([A-Za-z_$][\w$]*)\(/g; let m, falt=[];
    while((m=re.exec(tudo))){ const f=m[1]; if(['if','return','this','event'].includes(f)) continue; if(typeof W[f]!=='function') falt.push(f); } W.__aggHandlersFaltando=falt; return falt.length===0; })());
}

Object.assign(W,{viewAgendaGlobal,agendaGlobalSelfTests,aggCss,
  aggAba,aggModo,aggDia,aggIrDia,aggHoje,aggNavegar,aggTipo,aggDobra,aggTarResp,aggTarModo,aggKtab,aggCkAb,aggNovo,aggTarNova,aggProxima,aggFicha,aggEditar,aggFinalizar,
  aggEvAbrir,aggTarAbrir,aggMandarAbrir,aggConectar,aggAvulsaFeita,aggClickEv,aggSlot,aggFantasma,aggFantasmaSai,aggCliqueMes,
  aggTarSt,aggTarFeita,aggCkTg,aggKStart,aggKEnd,aggKOver,aggKLeave,aggKDrop,
  aggLembSet,aggLembModo,aggLembResp,aggReagSalvar,aggCopiar,aggMandou,aggNovoSalvar,aggSemCliente,aggTarSalvar,aggTarExcluir,
  aggAbrir,aggFechar:fechar,aggFecharTudo:fecharTudo,aggFeita,aggRemover,aggConvite,aggReagendarAbrir,aggMsgTxt,aggRg,
  aggF,aggNovoTipo,aggNovoDur,aggNovoLemb,aggNovoCli,aggBusca,aggT,aggTarCli,aggTck,aggTckDel,aggTckAdd,aggMoverPara,aggIrPara,aggTrocarTarNova,
  aggStatus,aggStatusPlano,aggPrio,aggResp,aggLembEstado,aggLembPadrao,aggCat});
})();
