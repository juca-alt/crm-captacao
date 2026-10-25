/* ═══ FUNIL-UNICO-V1 · T3 (24/10/2026) — o quadro dos 2 funis novos: 🎯 Vida Individual e 🏢 MFO ═══════════════════════
   Desenho aprovado por ele na demo (design/funil-unico-demo.html): filtros em gaveta (modelo A), colunas da Funil & Etapas
   (FUNIL_CFG.fu_vi / fu_mfo), Kanban e Tabela, desempenho por mercado, encerrar pede motivo.
   Mora num arquivo próprio pra não brigar com a sessão paralela no vendas.html (o vendas.html só carrega, roteia e põe no menu).
   Usa os helpers do app (S, BN, FUNIL_CFG, ET_LABEL, PROB_ETAPA, ETAPAS_MAP, mapearEtapa, esc, jsq, toast, salvar…) só na hora
   de desenhar — nada aqui roda no carregamento.

   TRANSIÇÃO (as telas antigas convivem por 2 semanas):
   • a etapa do quadro novo é DERIVADA da etapa antiga pelo mapa (kb_etapa_mapa), a não ser que ele tenha movido pra uma
     etapa que não existe no funil antigo daquele card (etapa_id_fonte='manual');
   • mover aqui grava a etapa antiga equivalente (mesmo logEtapa/ordem das telas de hoje) → Painel TA, KPIs e as telas do
     Victor continuam batendo; quando não há equivalente, grava só a nova e registra no histórico;
   • mexer na tela antiga chama fuSincLegado (gancho no logEtapa) → o quadro novo acompanha. */
(function(){
'use strict';
const W=window;
const FK={vi:'fu_vi',mfo:'fu_mfo'};
const CLIENTE_COL={vi:'emitida',mfo:'m_ativo'};
const ORIGEM={recomendacao:'Recomendação',lead:'Lead',estoque:'Estoque',parceiro:'Parceiro',carteira:'Carteira',importacao:'Importação'};
const LINHA={prud:'Vida Individual',vg:'VG',prud_demais:'Prud. Demais',mo:'Multi Office'};
const RAPIDOS=['semprox','ta','quente','nunca'];
const GRUPOS=[['Ação',['semprox','nunca','ta','delay','esfriando']],['Perfil',['quente','alta','niver','cliente','revisar']],['Origem',['o_rec','o_lead','o_parc','o_cart']],['Mercado',['mx','my','mz','msem']]];
const SO_VI=['quente','ta'];   /* ANCE e TA não existem no MFO */
const MOTIVOS_SUGESTAO=['Sem interesse','Já é cliente de outro LP','Sem renda / momento financeiro','Não atende mais','Saúde (não passa na análise)'];
const FU={fid:'vi',modo:'kanban',ordem:'livre',q:'',f:{},origem:'',dono:'',linha:'',enc:{},tab:{},cong:false,motivo:null};
let _qT=null;
W.FU_STATE=FU;

/* ── etapas (fonte única: Funil & Etapas) ── */
const cfg=fid=>((typeof FUNIL_CFG!=='undefined'&&FUNIL_CFG&&FUNIL_CFG[FK[fid]])||[]);
const etapa=(fid,id)=>cfg(fid).find(e=>e&&e.id===id);
const ehEnc=(fid,id)=>{ const e=etapa(fid,id); return !!(e&&e.enc); };
const lbl=id=>(typeof ET_LABEL!=='undefined'&&ET_LABEL[id])||id;
const prob=id=>{ const v=(typeof PROB_ETAPA!=='undefined')?PROB_ETAPA[id]:null; return v==null?10:v; };
const COR={cinza:'#5b6770',azul:'var(--azul)',amarelo:'var(--amarelo)',roxo:'var(--roxo)',verde:'var(--verde)',verm:'var(--verm)'};
const corDe=(fid,id)=>{ const e=etapa(fid,id); return COR[(e&&e.cor)||'cinza']||COR.cinza; };

/* ── onde o card mora no funil novo ── */
function fuDestino(c){
  if(!c) return {funil_id:'vi',etapa_id:'novo',revisao:true};
  if(c.etapa_id_fonte==='manual'&&c.etapa_id&&c.funil_id&&etapa(c.funil_id,c.etapa_id)) return {funil_id:c.funil_id,etapa_id:c.etapa_id,revisao:false};
  const f=c.funil||'nn';
  if(f==='bn'&&!c.etapa) return {funil_id:'vi',etapa_id:'novo',revisao:false};   /* Estoque que já foi pra lista de TA */
  const m=mapearEtapa(f,c.etapa);
  if(!etapa(m.funil_id,m.etapa_id)){ const p=cfg(m.funil_id).find(e=>!e.enc); return {funil_id:m.funil_id,etapa_id:p?p.id:m.etapa_id,revisao:true}; }   /* etapa excluída em Funil & Etapas */
  return {funil_id:m.funil_id,etapa_id:m.etapa_id,revisao:!!m.precisa_revisao||c.etapa_revisao===true};
}
/* gancho do logEtapa: mexeu na tela antiga → o quadro novo acompanha (deixa de ser 'manual') */
function fuSincLegado(c){ if(!c||c.funil==='bn') return; const m=mapearEtapa(c.funil||'nn',c.etapa);
  c.funil_id=m.funil_id; c.etapa_id=m.etapa_id; c.etapa_id_fonte='mapa'; }
/* etapa antiga equivalente no funil de origem do card (a 1ª, na ordem de Funil & Etapas) */
function fuVoltaLegado(c,X){ const f=(c&&c.funil)||'nn'; if(f==='bn') return null;
  if(c.etapa&&mapearEtapa(f,c.etapa).etapa_id===X) return c.etapa;
  const ids=((typeof ETAPAS_MAP!=='undefined'&&ETAPAS_MAP[f])||{}).ids||[];
  return ids.find(id=>{ const m=mapearEtapa(f,id); return m.etapa_id===X&&!m.precisa_revisao; })||null; }

/* ── quem aparece ── */
function fuAcha(id){ id=String(id); return (S.contatos||[]).find(x=>x&&String(x.id)===id)||((typeof BN!=='undefined'&&BN.contatos)||[]).find(x=>x&&String(x.id)===id)||null; }
function fuPopulacao(fid){ const out=[], noFunil=new Set((S.contatos||[]).map(x=>x&&String(x.id)));
  (S.contatos||[]).forEach(c=>{ if(!c||c.merged_into||!escVisivel(c)) return; if(fuDestino(c).funil_id===fid) out.push(c); });
  if(fid==='vi'&&typeof BN!=='undefined') (BN.contatos||[]).forEach(b=>{ if(!b||b.merged_into||!escVisivel(b)) return;
    if(b.funil_contato_id&&noFunil.has(String(b.funil_contato_id))) return;   /* já virou contato do funil: o card é o do funil */
    if(b.estagio==='descartado'||b.estagio==='fundido') return;
    if(!(b.etapa||(b.ta_dia&&b.ta_dia!=='null'))) return; out.push(b); });
  return out; }

/* ── o que o card mostra (vivo, a partir do que já existe no app) ── */
const ABERTA=t=>t&&!t.feito;
function fuProx(c){ const l=(Array.isArray(c.tarefas)?c.tarefas:[]).filter(ABERTA).sort((a,b)=>String(a.quando||'9').localeCompare(String(b.quando||'9'))||String(a.hora||'').localeCompare(String(b.hora||'')));
  return l[0]?{tipo:l[0].tipo,quando:l[0].quando||'',hora:l[0].hora||'',tit:l[0].tit||''}:null; }
const K_CONTATO={wa:'WhatsApp',whatsapp:'WhatsApp',whats_respondeu:'WhatsApp respondeu',lig_atendida:'Ligação atendida',lig_nao_atendida:'Ligação não atendida',reuniao:'Reunião',agendou_oi:'Agendou OI',caixa_postal:'Caixa postal',sem_interesse:'Sem interesse'};
function fuUltimo(c){ let best=null; (Array.isArray(c.interacoes)?c.interacoes:[]).forEach(i=>{ if(!i||!K_CONTATO[i.k]) return; const q=i.ts||i.dia||''; if(q&&(!best||q>best.quando)) best={tipo:i.k,quando:q}; });
  (Array.isArray(c.tarefas)?c.tarefas:[]).forEach(t=>{ if(t&&typeof t.feito==='string'&&['reuniao','ligar','whats','follow'].includes(t.tipo)&&(!best||t.feito>best.quando)) best={tipo:t.tipo==='reuniao'?'reuniao':t.tipo==='whats'?'wa':'tarefa',quando:t.feito}; });
  const st=c.ultimo_contato; if(st&&st.quando&&(!best||String(st.quando)>best.quando)) best={tipo:st.tipo,quando:String(st.quando)};
  return best; }
const ULT_LBL=t=>K_CONTATO[t]||({ligacao_atendida:'Ligação atendida',ligacao_nao_atendida:'Ligação não atendida',ligacao:'Ligação',tarefa:'Tarefa feita',follow:'Follow-up',telefone_incorreto:'Telefone incorreto'}[t])||t;
/* ANCE (decisão 3C): a nota DELE manda; sem nota, os critérios A·N·C·E que ele marca na ficha; sem nada, o automático.
   A nota das estrelas (T4) carrega ance_manual_em — é isso que a separa do ance_manual que a migração (T2) copiou. */
const numOk=v=>v!=null&&v!==''&&v!=='null'&&isFinite(+v);
function fuAnce(c){ const m=c.ance_manual;
  if(c.ance_manual_em&&numOk(m)) return {n:+m,manual:true,fonte:'nota'};
  let s=null; try{ s=anceScore(c); }catch(_){}
  if(s) return {n:s,manual:true,fonte:'criterios'};
  if(numOk(m)&&+m>0) return {n:+m,manual:true,fonte:'nota'};
  if(numOk(c.ance_auto)) return {n:+c.ance_auto,manual:false,fonte:'auto'};
  return {n:0,manual:false,fonte:'auto'}; }
const diasDesde=iso=>{ if(!iso) return null; const t=new Date(String(iso).slice(0,10)+'T12:00:00').getTime(); return isFinite(t)?Math.round((Date.now()-t)/864e5):null; };
function fuEhCliente(c){ if(c.cliente_ativo!=null) return c.cliente_ativo===true;   /* gravado pela migração (T2); só o card novo, sem o campo, consulta a carteira */
  try{ const r=drwCarteira(c); return !!(r&&r.aps&&r.aps.length); }catch(_){ return false; } }
function fuInfo(c,fid){ const d=fuDestino(c), enc=ehEnc(fid,d.etapa_id), cli=CLIENTE_COL[fid];
  const prox=fuProx(c), ult=fuUltimo(c), a=fuAnce(c);
  const cong=(typeof congEh==='function')&&congEh(c);
  const delay=(typeof negDelayAtivo==='function')&&negDelayAtivo(c);
  const ta=d.etapa_id==='novo'&&(c.ta_dia===hojeISO()||(Array.isArray(c.listas)&&c.listas.length>0));
  const quente=a.n>=4||c.temperatura==='quente';
  const ds=ult?diasDesde(ult.quando):null;
  return {d,enc,prox,ult,ance:a,cong,delay,ta,quente,
    semProx:!enc&&!cong&&d.etapa_id!==cli&&!prox,
    esfriando:!enc&&d.etapa_id!==cli&&ds!=null&&ds>30,
    alta:c.alta_renda===true,
    niver:(()=>{ const n=String(c.nascimento||''); const m=/^\d{4}-(\d{2})/.exec(n)||/^\d{2}\/(\d{2})/.exec(n); return !!m&&+m[1]===(new Date().getMonth()+1); })()}; }

/* ── filtros (faceta: o número diz quantos sobram somando com os ligados) ── */
const FILTROS={   /* chave: [rótulo, teste, tom do chip, ícone] */
  semprox:['Sem próximo passo',(c,i)=>i.semProx,'lj','⚠'], nunca:['Nunca conversei',(c,i)=>!i.ult,'verde','✆'], ta:['Fazer TA',(c,i)=>i.ta,'azul','☏'], delay:['Delay',(c,i)=>i.delay,'verm','⏳'], esfriando:['Esfriando (30d+)',(c,i)=>i.esfriando,'azul','❄'],
  quente:['Quentes',(c,i)=>i.quente,'amar','☆'], alta:['Alta Renda',(c,i)=>i.alta,'cinza','✦'], niver:['Aniversariantes do mês',(c,i)=>i.niver,'rosa','🎂'], cliente:['Já é cliente',c=>fuEhCliente(c),'verde','🛡'], revisar:['Pra revisar (mapa)',(c,i)=>i.d.revisao,'amar','?'],
  mx:['Mercado X',c=>c.mercado==='X','verde',''], my:['Mercado Y',c=>c.mercado==='Y','amar',''], mz:['Mercado Z',c=>c.mercado==='Z','cinza',''], msem:['Sem mercado',c=>!c.mercado,'cinza',''],
  o_rec:['Recomendação',c=>c.origem_tipo==='recomendacao','roxo','🙌'], o_lead:['Lead',c=>c.origem_tipo==='lead','azul','✦'], o_parc:['Parceiro',c=>c.origem_tipo==='parceiro','lj','🤝'], o_cart:['Carteira',c=>c.origem_tipo==='carteira','verde','🛡']};
function fuBate(c,q){ if(!q) return true; try{ if(funBuscaBate(c,q)) return true; }catch(_){}
  const n=normKey(q); return [lbl(fuDestino(c).etapa_id),c.cidade,c.renda,c.renda_estimada,c.tags,c.mercado?'mercado '+c.mercado:'',ORIGEM[c.origem_tipo]].some(x=>x!=null&&normKey(String(x)).includes(n)); }
function fuPassa(c,i,ignora){ if(!fuBate(c,FU.q)) return false;
  for(const k of Object.keys(FU.f)){ if(!FU.f[k]||k===ignora||!FILTROS[k]) continue; if(!FILTROS[k][1](c,i)) return false; }
  if(FU.origem&&c.origem_tipo!==FU.origem) return false;
  if(FU.dono&&(c._dono||'')!==FU.dono) return false;
  if(FU.linha&&c.linha!==FU.linha) return false;
  if(!FU.cong&&i.cong) return false;
  if(FU.cong&&!i.cong) return false;
  return true; }
function fuLista(fid){ return fuPopulacao(fid).map(c=>({c,i:fuInfo(c,fid)})); }
const ativos=()=>Object.keys(FU.f).filter(k=>FU.f[k]&&FILTROS[k]).map(k=>[k,FILTROS[k][0]]).concat(FU.origem?[['@origem','Origem: '+(ORIGEM[FU.origem]||FU.origem)]]:[]).concat(FU.dono?[['@dono','Dono: '+donoNome(FU.dono)]]:[]).concat(FU.linha?[['@linha','Linha: '+LINHA[FU.linha]]]:[]);
const donoNome=e=>{ const s=String(e||''); return s? (s.split('@')[0].replace(/^./,x=>x.toUpperCase())) : '—'; };

/* ── colunas por usuário (ordem + ocultas) — sobe junto com as prefs do menu (lp_user_prefs) ── */
const COLS_CHAVE='crmlp_fu_cols_v1';
let COLS=null;
function colsLer(){ if(COLS) return COLS; try{ COLS=JSON.parse(localStorage.getItem(COLS_CHAVE)||'null')||{}; }catch(_){ COLS={}; } return COLS; }
function colsDe(fid){ const todas=cfg(fid).map(e=>e.id), p=colsLer()[fid]||{};
  const ordem=(Array.isArray(p.ordem)?p.ordem.filter(id=>todas.includes(id)):[]).concat(todas.filter(id=>!(p.ordem||[]).includes(id)));
  return {ordem,ocultas:(p.ocultas||[]).filter(id=>todas.includes(id))}; }
function colsGravar(fid,v){ const all=colsLer(); all[fid]=v; try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(all)); }catch(_){} try{ if(typeof navPrefsSubir==='function') navPrefsSubir(); }catch(_){} }
function fuPrefsSubir(){ return colsLer(); }
/* filtros salvos (por usuário, junto das colunas → lp_user_prefs). Nascem com 4 de exemplo; ele apaga/cria na gaveta. */
const SALVOS_PADRAO=[{n:'🔥 Quentes sem próximo passo',f:{quente:true,semprox:true}},{n:'☏ Fazer TA',f:{ta:true}},{n:'⚠ Sem próximo passo',f:{semprox:true}},{n:'⏳ Delay',f:{delay:true}}];
function salvos(){ const a=colsLer(); if(!Array.isArray(a._salvos)) a._salvos=SALVOS_PADRAO.map(x=>({n:x.n,f:Object.assign({},x.f)})); return a._salvos; }
function salvosGravar(){ try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(colsLer())); }catch(_){} try{ if(typeof navPrefsSubir==='function') navPrefsSubir(); }catch(_){} }
const fAtivos=()=>Object.keys(FU.f).filter(k=>FU.f[k]&&FILTROS[k]);
const fChaves=f=>Object.keys(f||{}).filter(k=>f[k]&&FILTROS[k]);
function fIgual(f){ const a=fAtivos().sort().join(), b=fChaves(f).sort().join(); return !!a&&a===b; }
function contaSalvo(lista,f){ const ks=fChaves(f).filter(k=>FU.fid==='vi'||!SO_VI.includes(k)); return lista.filter(x=>fuBate(x.c,FU.q)&&(FU.cong?x.i.cong:!x.i.cong)&&ks.every(k=>FILTROS[k][1](x.c,x.i))).length; }
function fuPrefsAplicar(p){ if(p&&typeof p==='object'){ COLS=p; try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(p)); }catch(_){} } }

/* ── ordenar ── */
const ORDENS=[['livre','Ordem manual (arrastar)'],['rec','Mais recentes'],['ag','Data do próximo passo'],['prob','Prob. negócio'],['nome','Nome']];
function fuOrdenar(l){ const o=FU.ordem, ent=c=>{ try{ return (entradaFunil(c).iso)||''; }catch(_){ return ''; } };
  const ord=c=>(c.fu_ord!=null&&isFinite(+c.fu_ord))?+c.fu_ord:1e9;
  return l.slice().sort((A,B)=> o==='livre'?(ord(A.c)-ord(B.c))||String(ent(B.c)).localeCompare(String(ent(A.c)))
    : o==='nome'?String(A.c.nome||'').localeCompare(String(B.c.nome||''),'pt-BR')
    : o==='prob'?(prob(B.i.d.etapa_id)-prob(A.i.d.etapa_id))||String(A.c.nome||'').localeCompare(String(B.c.nome||''),'pt-BR')
    : o==='ag'?String((A.i.prox&&A.i.prox.quando)||'9').localeCompare(String((B.i.prox&&B.i.prox.quando)||'9'))
    : String(ent(B.c)).localeCompare(String(ent(A.c)))); }

/* ── estilo (escopo .fu) ── */
function fuCss(){ if(document.getElementById('fu-css')) return; const s=document.createElement('style'); s.id='fu-css'; s.textContent=`
.fu-seg{display:flex;gap:6px;flex-wrap:wrap;margin:0 0 12px}
.fu-seg button{border:1px solid var(--linha);background:#fff;border-radius:10px;padding:9px 14px;min-height:44px;font-size:14px;font-weight:600;color:#334155;display:inline-flex;gap:8px;align-items:center}
.fu-seg button.on{background:var(--navy,#0f172a);border-color:var(--navy,#0f172a);color:#fff}
.fu-seg .n{font-size:12px;font-weight:500;opacity:.75}
.fu-tb{display:flex;flex-direction:column;gap:8px;margin-bottom:10px}
.fu-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fu-busca{flex:1 1 220px;min-width:0;display:flex;align-items:center;gap:6px;background:#fff;border:1px solid var(--linha);border-radius:9px;padding:0 10px;min-height:40px}
.fu-busca input{border:0;outline:0;flex:1;min-width:0;background:transparent;padding:8px 0;font-size:14px}
.fu-vt{display:inline-flex;border:1px solid var(--linha);border-radius:9px;overflow:hidden;background:#fff;flex:0 0 auto}
.fu-vt button{min-width:44px;min-height:40px;border:0;background:#fff;color:#334155;font-size:15px;cursor:pointer}.fu-vt button.on{background:var(--primary);color:#fff}
.fu-row{flex-wrap:nowrap}.fu-row .btn{white-space:nowrap}.fu-mais{flex:0 0 auto}
.fu-cnt{background:var(--primary);color:#fff;border-radius:999px;font-size:11px;padding:1px 7px}
.fu-q{display:flex;gap:6px;overflow-x:auto;flex-wrap:nowrap;margin-bottom:10px;scrollbar-width:none;align-items:center}
.fu-q::-webkit-scrollbar{display:none}
.fu-fc{display:inline-flex;align-items:center;gap:6px;flex:0 0 auto;border:1px solid var(--linha);background:#fff;border-radius:999px;padding:4px 5px 4px 11px;font-size:12.5px;color:#334155;min-height:32px;white-space:nowrap;cursor:pointer}
.fu-fc .cn{background:var(--fundo,#f1f5f9);color:var(--muted);border-radius:999px;padding:1px 7px;font-size:11px}
.fu-fc.on{background:var(--azul-claro,#eff6ff);border-color:var(--azul-borda,#bfdbfe);color:#1d4ed8;font-weight:600}
.fu-fc.on .cn{background:#fff;color:#1d4ed8}
.fu-fc.zero{opacity:.45}
.fu-fc.ativo{background:var(--navy,#0f172a);border-color:var(--navy,#0f172a);color:#fff;padding-right:11px}
.fu-fc.enc{border-style:dashed;background:transparent}
.fu-fc.txt{border:0;background:transparent;color:var(--muted);padding-left:2px}
.fu-sep{width:1px;height:20px;background:#cbd5e1;flex:0 0 auto}
.fu-board{display:flex;gap:12px;overflow-x:auto;padding-bottom:12px;align-items:flex-start}
.fu-col{flex:0 0 284px;background:#e9eef4;border-radius:12px;padding:8px;display:flex;flex-direction:column;gap:8px;min-height:120px}
.fu-col.enc{background:#f8eaea}
.fu-col.drop{outline:2px dashed var(--primary);outline-offset:-2px;background:var(--azul-claro,#eff6ff)}
.fu-col-h{display:flex;align-items:center;gap:8px;padding:4px 4px 0}.fu-col-h b{font-size:13.5px}.fu-col-h .qt{margin-left:auto;font-size:12px;color:var(--muted)}
.fu-col-s{font-size:11.5px;color:var(--muted);padding:0 4px 2px;display:flex;flex-direction:column;gap:2px}
.fu-col-s .pa{color:#15803d;font-weight:600}
.fu-vazio{font-size:12px;color:var(--muted);text-align:center;padding:14px 6px;border:1px dashed #cbd5e1;border-radius:10px}
.fu-card{background:#fff;border:1px solid var(--linha);border-radius:11px;padding:10px 10px 0;display:flex;flex-direction:column;gap:5px;cursor:pointer}
.fu-card:hover{border-color:#cbd5e1}.fu-card.semprox{background:#fff7ed;border-color:#fdba74}.fu-card.dragging{opacity:.5}
.fu-nome{font-weight:650;font-size:14px;line-height:1.25}
.fu-stars{font-size:13px;letter-spacing:1px;color:#cbd5e1}.fu-stars b{color:#f59e0b;font-weight:400}.fu-stars.man b{color:var(--verde)}
.fu-meta{font-size:12px;color:var(--muted);display:flex;flex-wrap:wrap;gap:2px 8px}
.fu-bds{display:flex;flex-wrap:wrap;gap:4px}
.fu-bd{font-size:11px;border-radius:6px;padding:2px 6px;background:#f1f5f9;color:#5b6770;white-space:nowrap}
.fu-bd.v{background:var(--verde-bg,#dcfce7);color:#15803d}.fu-bd.a{background:var(--amarelo-bg,#fef3c7);color:var(--amarelo)}.fu-bd.r{background:var(--roxo-bg,#ede9fe);color:var(--roxo)}
.fu-bd.b{background:var(--azul-claro,#eff6ff);color:#1d4ed8}.fu-bd.vm{background:var(--verm-bg,#fee2e2);color:#b91c1c}.fu-bd.lj{background:#ffedd5;color:#c2410c}
.fu-av{font-size:12px;color:#c2410c;font-weight:600}
.fu-st{font-size:11.5px;color:#334155;background:#f1f5f9;border-radius:6px;padding:2px 7px;align-self:flex-start}
.fu-px{font-size:12px;color:#334155}
.fu-qa{display:grid;grid-template-columns:repeat(4,1fr);border-top:1px solid var(--linha);margin:3px -10px 0}
.fu-qa button{min-height:36px;font-size:12px;color:#334155;display:flex;align-items:center;justify-content:center;gap:3px;background:none;border:0;cursor:pointer}
.fu-qa button+button{border-left:1px solid var(--linha)}.fu-qa button:hover{background:var(--fundo,#f1f5f9)}
.fu-tabs{display:none;gap:6px;overflow-x:auto;padding-bottom:8px}
.fu-tabs button{flex:0 0 auto;border:1px solid var(--linha);background:#fff;border-radius:999px;padding:8px 12px;min-height:44px;font-size:13px;white-space:nowrap}
.fu-tabs button.on{background:var(--primary);border-color:var(--primary);color:#fff}
.fu-tw{overflow-x:auto;background:#fff;border:1px solid var(--linha);border-radius:12px}
.fu-tw table{border-collapse:collapse;width:100%;font-size:13px;min-width:1150px}
.fu-tw th,.fu-tw td{padding:8px 10px;border-bottom:1px solid var(--linha);text-align:left;vertical-align:top}
.fu-tw th{font-size:11.5px;letter-spacing:.04em;text-transform:uppercase;color:var(--muted);background:#f8fafc;white-space:nowrap}
.fu-tw td.num{text-align:right;font-variant-numeric:tabular-nums}.fu-tw tr:hover td{background:#f8fafc}
.fu-ov{position:fixed;inset:0;background:rgba(15,23,42,.42);display:flex;align-items:center;justify-content:center;z-index:200;padding:16px}
.fu-md{background:#fff;border-radius:14px;max-width:620px;width:100%;max-height:calc(100vh - 32px);overflow:auto;padding:18px;display:flex;flex-direction:column;gap:12px}
.fu-md h2{margin:0;font-size:18px}.fu-md .acts{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}
.fu-grp{display:flex;flex-direction:column;gap:8px}.fu-grp h3{font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);margin:0}
.fu-grid{display:flex;flex-wrap:wrap;gap:6px}
.fu-sel{border:1px solid var(--linha);border-radius:999px;background:#fff;padding:4px 10px;min-height:32px;font-size:12.5px;color:#334155}
.fu-md select,.fu-md input[type=text]{border:1px solid var(--linha);border-radius:8px;padding:8px 10px;min-height:40px;font-size:14px;width:100%}
.fu-colrow{display:flex;gap:8px;align-items:center;border:1px solid var(--linha);border-radius:8px;padding:6px 8px}
.fu-colrow label{display:flex;gap:8px;align-items:center;flex:1;min-height:32px}
.fu-menu{position:fixed;z-index:210;background:#fff;border:1px solid var(--linha);border-radius:10px;box-shadow:0 10px 30px rgba(15,23,42,.18);padding:6px;display:flex;flex-direction:column;min-width:230px;max-width:calc(100vw - 32px)}
.fu-menu .mh{font-size:11.5px;color:var(--muted);padding:6px 8px;font-weight:600}
.fu-menu button,.fu-menu a{text-align:left;padding:8px 10px;border-radius:7px;font-size:13px;min-height:36px;background:none;border:0;cursor:pointer;color:inherit;text-decoration:none;display:block}
.fu-menu button:hover,.fu-menu a:hover{background:var(--fundo,#f1f5f9)}
.fu-menu .tel{font-size:15px;font-weight:650;padding:4px 10px;user-select:all}
.fu-nota{font-size:12.5px;color:#334155;background:var(--amarelo-bg,#fef3c7);border-radius:8px;padding:8px 10px}
.fu-stars{display:inline-flex;align-items:center;flex-wrap:wrap;border-radius:8px;align-self:flex-start}
.fu-stars button{background:none;border:0;padding:0 1px;font-size:15px;line-height:1;color:#cbd5e1;cursor:pointer;min-width:22px;min-height:24px}
.fu-stars button.on{color:#f59e0b}.fu-stars.man button.on{color:var(--verde,#16a34a)}
.fu-stars.un{background:#fffbeb;outline:1px dashed #f59e0b;outline-offset:1px}.fu-stars.un button.on{color:#f59e0b}
.fu-un{font-size:11px;color:#b45309;margin:0 6px 0 4px}
.fu-nl{display:flex;align-items:flex-start;gap:4px}.fu-nl .fu-nome{flex:1;min-width:0}
.fu-i{background:none;border:0;color:var(--muted);font-size:15px;min-width:28px;min-height:26px;cursor:pointer;border-radius:6px;line-height:1}.fu-i:hover{background:var(--fundo,#f1f5f9)}
.fu-ipop{padding:2px 10px 8px;font-size:13px;line-height:1.6}
.fu-g2{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.fu-fld{display:flex;flex-direction:column;gap:4px;min-width:0}.fu-fld.full{grid-column:1/-1}
.fu-fld label,.fu-lb,.fu-l{font-size:11.5px;color:var(--muted);font-weight:600}
.fu-fld input,.fu-fld select,.fu-fld textarea,.fu-add input,.fu-tnova input,.fu-tnova select,.fu-cov input,.fu-cov select,.fu-lac input,.fu-lac select,.fu-ap input{border:1px solid var(--linha);border-radius:8px;padding:7px 9px;min-height:38px;font-size:14px;width:100%;min-width:0;background:#fff;font-family:inherit;color:inherit}
.fu-pgbd{position:fixed;inset:0;background:rgba(15,23,42,.35);z-index:77}.fu-pgbd[hidden]{display:none}
.fu-pg{position:fixed;top:0;right:0;bottom:0;width:min(760px,94vw);z-index:78;background:var(--fundo,#f1f5f9);overflow:auto;overscroll-behavior:contain;box-shadow:-12px 0 36px rgba(15,23,42,.22);transform:translateX(105%);visibility:hidden;transition:transform .2s ease,visibility 0s linear .2s;padding:0 16px max(40px,env(safe-area-inset-bottom))}
.fu-pg.on{transform:none;visibility:visible;transition:transform .2s ease}
.fu-pg.cheia{left:0;width:auto;box-shadow:none}
.fu-pg-in{max-width:1180px;margin:0 auto;display:flex;flex-direction:column;gap:12px}
.fu-pg-bar{position:sticky;top:0;z-index:2;display:flex;align-items:center;gap:10px;background:var(--fundo,#f1f5f9);padding:max(10px,env(safe-area-inset-top)) 0 10px;border-bottom:1px solid var(--linha)}
.fu-voltar{font-weight:650;min-height:42px}
.fu-pg-nm{flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:15px}
.fu-salvo{font-size:12px;color:var(--verde,#16a34a);white-space:nowrap}
.fu-pg .mut{font-size:12.5px;color:var(--muted)}
.fu-pc0{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:14px 16px;display:flex;flex-direction:column;gap:12px}
.fu-pc0 h2{margin:0;font-size:20px;overflow-wrap:anywhere}
.fu-pc-l{display:flex;flex-direction:column;gap:6px;min-width:0}
.fu-res{font-size:13.5px;color:#334155}.fu-ct{font-size:13px;color:#334155;overflow-wrap:anywhere}
.fu-pc-a{display:flex;gap:8px;flex-wrap:wrap}.fu-pc-a .btn{min-height:38px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
.fu-pg-cols{display:flex;flex-direction:column;gap:12px}
.fu-pg-main{display:flex;flex-direction:column;gap:12px;min-width:0}
.fu-pg-side{display:grid;grid-template-columns:1fr 1fr;gap:12px;align-items:start;min-width:0}
.fu-pg.cheia .fu-pg-cols{flex-direction:row;align-items:flex-start}.fu-pg.cheia .fu-pg-main{flex:2 1 0}.fu-pg.cheia .fu-pg-side{flex:1 1 0;display:flex;flex-direction:column;align-items:stretch}
.fu-pc{background:#fff;border:1px solid var(--linha);border-radius:12px;padding:12px 14px;display:flex;flex-direction:column;gap:8px;font-size:13px;min-width:0}
.fu-pch{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;font-size:14.5px}
.fu-neg{display:flex;justify-content:space-between;gap:8px;flex-wrap:wrap;width:100%;padding:9px 10px;border:1px solid var(--linha);border-radius:9px;background:#fff;text-align:left;font-size:13px;min-height:44px;cursor:pointer;color:inherit}
.fu-neg.on{border-color:var(--primary);background:var(--azul-claro,#eff6ff)}.fu-neg:hover{background:#f8fafc}
.fu-negr{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fu-calc{min-height:38px;display:flex;align-items:center;gap:6px;font-weight:650;flex-wrap:wrap}
.fu-tiles{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.fu-tiles div{background:#f8fafc;border-radius:10px;padding:9px;display:flex;flex-direction:column;gap:2px;min-width:0}.fu-tiles span{font-size:11.5px;color:var(--muted)}.fu-tiles b{overflow-wrap:anywhere}
.fu-row2{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.fu-chips{display:flex;gap:6px;flex-wrap:wrap}
.fu-chip{border:1px solid var(--linha);background:#fff;border-radius:999px;padding:5px 11px;min-height:34px;font-size:12.5px;color:#334155;cursor:pointer}
.fu-chip.on{background:var(--azul-claro,#eff6ff);border-color:var(--azul-borda,#bfdbfe);color:#1d4ed8;font-weight:600}
.fu-dob{border:1px solid var(--linha);border-radius:10px;background:#fff}
.fu-dob summary{cursor:pointer;display:flex;gap:8px;align-items:center;padding:10px 12px;min-height:44px;list-style:none;flex-wrap:wrap}
.fu-dob summary::-webkit-details-marker{display:none}
.fu-dob summary::before{content:'▸';color:var(--muted);font-size:12px}.fu-dob[open] summary::before{content:'▾'}
.fu-dob summary .t{font-weight:650;font-size:13.5px}.fu-dob summary .res{font-size:12px;color:var(--muted);margin-left:auto;text-align:right}
.fu-db{padding:4px 12px 12px;display:flex;flex-direction:column;gap:10px}
.fu-sub{font-size:12px;font-weight:700;color:#334155;margin-top:4px}
.fu-cov{display:flex;flex-wrap:wrap;gap:6px;align-items:flex-end;padding-bottom:8px;border-bottom:1px dashed var(--linha)}
.fu-cov label{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--muted);font-weight:600;min-width:0;flex:1 1 110px}
.fu-x{min-height:36px;color:var(--verm,#dc2626)}
.fu-lac{display:grid;grid-template-columns:1fr 110px auto;gap:6px;align-items:center}
.fu-add{display:flex;gap:6px;align-items:center}.fu-add input{flex:1}
.fu-tar{display:flex;gap:8px;align-items:center;min-height:36px;font-size:13px}.fu-tar input{width:18px;height:18px;accent-color:var(--primary);flex:0 0 auto}.fu-tar small{margin-left:auto;color:var(--muted);white-space:nowrap}
.fu-atr{color:#b91c1c!important;font-weight:600}.fu-risc{text-decoration:line-through;color:var(--muted)}
.fu-tnova{display:flex;gap:6px;flex-wrap:wrap}.fu-tnova input[type=text]{flex:1 1 140px}.fu-tnova select{flex:0 1 150px;width:auto}.fu-tnova input[type=date],.fu-tnova input[type=time]{flex:0 1 140px;width:auto}
.fu-hfs{display:flex;gap:6px;flex-wrap:wrap}
.fu-hist{display:flex;flex-direction:column;max-height:420px;overflow:auto}
.fu-hist>div{display:flex;justify-content:space-between;gap:10px;padding:7px 0;border-bottom:1px solid var(--linha)}.fu-hist small{color:var(--muted);white-space:nowrap}
.fu-cot{display:flex;justify-content:space-between;gap:8px;align-items:center;flex-wrap:wrap}
.fu-ap{display:flex;justify-content:space-between;gap:10px;align-items:flex-end;flex-wrap:wrap}.fu-ap label{display:flex;flex-direction:column;gap:2px;font-size:11px;color:var(--muted);font-weight:600}
.fu-cart{overflow-x:auto}.fu-dacts{display:flex;gap:6px;flex-wrap:wrap}
.fu-pg .fu-av{font-size:12.5px}
@media (max-width:760px){
  .fu-stars button{min-width:40px;min-height:44px;font-size:21px}.fu-i{min-width:44px;min-height:44px}
  .fu-pg,.fu-pg.cheia{left:0;right:0;top:auto;bottom:0;width:100%;height:92vh;height:92dvh;border-radius:16px 16px 0 0;transform:translateY(105%);box-shadow:0 -10px 30px rgba(15,23,42,.25);padding:0 14px max(30px,env(safe-area-inset-bottom))}
  .fu-pg.on{transform:none}
  .fu-pg-bar{padding-top:10px}.fu-pg-bar::before{content:'';position:absolute;top:3px;left:50%;width:44px;height:4px;margin-left:-22px;border-radius:3px;background:#cbd5e1}
  .fu-pg .fu-pg-cols{flex-direction:column}.fu-pg-side,.fu-pg.cheia .fu-pg-side{display:flex;flex-direction:column}
  .fu-pc-a{display:grid;grid-template-columns:1fr 1fr}.fu-pc-a .btn,.fu-voltar,.fu-pg .btn-mini,.fu-chip,.fu-tar,.fu-x{min-height:44px}
  .fu-hide-m{display:none}.fu-tiles{grid-template-columns:1fr 1fr}.fu-g2{grid-template-columns:1fr}
  .fu-fld input,.fu-fld select,.fu-fld textarea,.fu-add input,.fu-tnova input,.fu-tnova select,.fu-cov input,.fu-cov select,.fu-lac input,.fu-lac select,.fu-ap input{font-size:16px;min-height:44px}
  .fu-lac{grid-template-columns:1fr 104px auto}.fu-hist{max-height:none}
}
.fu-acts{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 8px}
.fu-b{min-height:34px;padding:0 11px;border-radius:9px;border:1px solid var(--linha);background:#fff;font-weight:600;font-size:13px;color:#334155;display:inline-flex;align-items:center;gap:6px;white-space:nowrap;cursor:pointer}
.fu-b:hover{border-color:#cbd5e1}.fu-b.p{background:var(--primary);border-color:var(--primary);color:#fff}.fu-b .cn{font-weight:500;color:var(--muted)}
.fu-acts .fu-vt button{min-height:32px}
.fu-fb{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:0 0 10px}
.fu-fb-l{font-size:11px;color:var(--muted);font-weight:700;letter-spacing:.06em;text-transform:uppercase;margin-left:4px}
.fu-sv{display:inline-flex;align-items:center;gap:5px;min-height:30px;padding:0 10px;border-radius:999px;border:1px solid var(--linha);background:#fff;font-size:12.5px;font-weight:600;color:#334155;white-space:nowrap;cursor:pointer}
.fu-sv .q{font-weight:500;color:var(--muted);font-variant-numeric:tabular-nums}.fu-sv.on{background:var(--navy,#0f172a);border-color:var(--navy,#0f172a);color:#fff}.fu-sv.on .q{color:#cbd5e1}
.fu-fc.t-verde{background:#dcfce7;border-color:#dcfce7;color:#15803d}.fu-fc.t-amar{background:#fef3c7;border-color:#fef3c7;color:#b45309}.fu-fc.t-verm{background:#fee2e2;border-color:#fee2e2;color:#b91c1c}
.fu-fc.t-roxo{background:#ede9fe;border-color:#ede9fe;color:#6d28d9}.fu-fc.t-azul{background:#dbeafe;border-color:#dbeafe;color:#1d4ed8}.fu-fc.t-lj{background:#ffedd5;border-color:#ffedd5;color:#c2410c}
.fu-fc.t-rosa{background:#fce7f3;border-color:#fce7f3;color:#be185d}.fu-fc.t-cinza{background:#e2e8f0;border-color:#e2e8f0;color:#475569}
.fu-fc[class*=" t-"] .cn{background:rgba(255,255,255,.6);color:inherit}.fu-fc[class*=" t-"].on{box-shadow:inset 0 0 0 2px currentColor;font-weight:700}
.fu-bd.t-verde{background:#dcfce7;color:#15803d}.fu-bd.t-amar{background:#fef3c7;color:#b45309}.fu-bd.t-cinza{background:#e2e8f0;color:#475569}
.fu-qd{background:#fff;border:1px solid var(--linha);border-radius:14px;overflow:hidden}
.fu-bq{display:flex;gap:10px;align-items:center;padding:10px 12px;border-bottom:1px solid var(--linha);flex-wrap:wrap}
.fu-bq .fu-busca{flex:1 1 260px;max-width:520px;min-height:36px}.fu-res{margin-left:auto;font-size:12.5px;color:var(--muted);font-variant-numeric:tabular-nums}
.fu-qd .fu-board{padding:12px}.fu-qd .fu-tabs{padding:10px 12px 0}.fu-qd .fu-tw{border:0;border-radius:0}
.fu-col{background:#f8fafc;border:1px solid var(--linha);padding:0;gap:0}.fu-col.enc{background:#fdf6f6}.fu-col.dragging{opacity:.4}
.fu-col-h{padding:9px 8px 9px 6px;border-bottom:1px solid var(--linha);gap:7px}
.fu-col-s{padding:6px 10px 0;flex-direction:row;justify-content:space-between;gap:8px}
.fu-cards{display:flex;flex-direction:column;gap:8px;padding:8px}
.fu-colx{min-width:28px;min-height:28px;border-radius:7px;border:0;background:none;color:var(--muted);font-size:15px;cursor:pointer;line-height:1}.fu-colx:hover{background:#e2e8f0}
.fu-col-h .qt{margin-left:auto}
.fu-alca{cursor:grab;color:#cbd5e1;font-size:14px;line-height:1;user-select:none;padding:1px 1px 0}.fu-alca:active{cursor:grabbing}
.fu-nova-col{flex:0 0 200px;min-height:110px;border:2px dashed #cbd5e1;border-radius:12px;background:transparent;color:var(--primary);font-weight:600;cursor:pointer}.fu-nova-col:hover{background:#fff}
.fu-drop{height:3px;background:var(--primary);border-radius:2px;margin:-4px 0}
.fu-card{padding:9px 10px 0;gap:4px}
.fu-l1{display:flex;align-items:flex-start;gap:5px}
.fu-l1 .fu-nome{flex:1;min-width:0;display:flex;align-items:center;gap:3px}.fu-l1 .nm{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.fu-l1 .fu-i{min-height:22px;min-width:22px;font-size:13px}
.fu-avc{font-size:11px;color:#9a3412;font-weight:600;white-space:nowrap;flex:0 0 auto;margin-top:2px}
.fu-card .fu-stars,.fu-card .fu-meta2,.fu-card .fu-bds,.fu-card .fu-st{margin-left:18px}
.fu-meta2{font-size:12.5px;color:#334155;display:flex;flex-direction:column;gap:1px}.fu-meta2 .r{display:flex;justify-content:space-between;gap:8px}.fu-meta2 .val{font-weight:600;font-variant-numeric:tabular-nums}.fu-meta2 .pa{color:#15803d;font-weight:600;font-size:12px}
.fu-cf{display:flex;align-items:center;gap:2px;border-top:1px solid var(--linha);margin:4px -10px 0;padding:3px 6px 3px 10px}
.fu-cf .lb{font-size:11.5px;color:var(--muted);margin-right:auto;white-space:nowrap}
.fu-cf button{min-width:28px;min-height:30px;border-radius:7px;border:0;background:none;font-size:14px;color:#334155;cursor:pointer}.fu-cf button:hover{background:var(--fundo,#f1f5f9)}
.fu-svrow{display:flex;align-items:center;gap:6px;border:1px solid var(--linha);border-radius:9px;padding:3px 6px 3px 10px;font-size:13px}.fu-svrow span{flex:1}
.fu-svnovo{display:flex;gap:6px}.fu-svnovo input{flex:1;min-width:0;border:1px solid var(--linha);border-radius:8px;padding:0 10px;min-height:38px;font-size:14px}
.fu-cores{display:flex;gap:8px;flex-wrap:wrap}.fu-cores button{width:32px;height:32px;border-radius:50%;border:3px solid transparent;cursor:pointer}.fu-cores button.on{border-color:var(--navy,#0f172a)}
.fu-md .fu-fld input,.fu-md .fu-fld select{border:1px solid var(--linha);border-radius:8px;padding:7px 9px;min-height:40px;font-size:14px;width:100%}
@media (max-width:760px){
  .fu-board{display:block}.fu-board .fu-col{display:none;width:100%}.fu-board .fu-col.vis{display:flex}
  .fu-tabs{display:flex}.fu-fc,.fu-sel,.fu-qa button,.fu-vt button,.fu-row .btn{min-height:44px}.fu-busca{min-height:44px;flex:1 1 0}
  .fu-busca input,.fu-md select,.fu-md input[type=text],.fu-sel{font-size:16px}
  .fu-ov.fu-sheet{align-items:flex-end;padding:0}.fu-ov.fu-sheet .fu-md{border-radius:16px 16px 0 0;max-height:88vh}
  .fu-row .fu-nova{flex:1}
  .fu-acts,.fu-fb{flex-wrap:nowrap;overflow-x:auto;scrollbar-width:none}.fu-acts::-webkit-scrollbar,.fu-fb::-webkit-scrollbar{display:none}.fu-acts>*,.fu-fb>*{flex:0 0 auto}
  .fu-b .tx{display:none}.fu-b.p .tx{display:inline}.fu-b,.fu-sv,.fu-acts .fu-vt button{min-height:44px}.fu-b{padding:0 12px}
  .fu-alca,.fu-nova-col{display:none}.fu-card .fu-stars,.fu-card .fu-meta2,.fu-card .fu-bds,.fu-card .fu-st{margin-left:0}
  .fu-cf button,.fu-colx,.fu-l1 .fu-i{min-width:44px;min-height:44px}.fu-cf .lb{display:none}.fu-cf{justify-content:space-around}
  .fu-svnovo input,.fu-md .fu-fld input,.fu-md .fu-fld select,.fu-bq .fu-busca input{font-size:16px;min-height:44px}.fu-cores button{width:44px;height:44px}
  .fu-qd .fu-board{padding:10px}
}`; document.head.appendChild(s); }

/* ── desenho ── */
function fuCount(lista,k){ const fn=FILTROS[k][1]; return lista.filter(x=>fuPassa(x.c,x.i,k)&&fn(x.c,x.i)).length; }
function fcHtml(lista,k){ const n=fuCount(lista,k), on=!!FU.f[k], F=FILTROS[k];
  return `<button type="button" class="fu-fc t-${F[2]}${on?' on':''}${!n&&!on?' zero':''}" onclick="fuFiltro('${k}')" aria-pressed="${on}">${F[3]?F[3]+' ':''}${esc(F[0])} <span class="cn">${n}</span></button>`; }
function cardHtml(x,fid){ const c=x.c,i=x.i, j=esc(jsq(c.id)), bn=c.funil==='bn';
  const st=i.delay?'⏳ Delay':i.ta?'📋 Fazer TA':i.ult?ULT_LBL(i.ult.tipo):'';
  const bds=[fuEhCliente(c)?'<span class="fu-bd v">Cliente</span>':'', c.mercado?`<span class="fu-bd t-${({X:'verde',Y:'amar',Z:'cinza'})[c.mercado]||'cinza'}">Mercado ${esc(c.mercado)}</span>`:'',
    fid==='mfo'&&c.linha?`<span class="fu-bd r">${esc(LINHA[c.linha]||c.linha)}</span>`:'', c.origem_tipo&&c.origem_tipo!=='recomendacao'?`<span class="fu-bd">${esc(ORIGEM[c.origem_tipo]||c.origem_tipo)}</span>`:'',
    bn?'<span class="fu-bd">Estoque</span>':'', i.alta?'<span class="fu-bd a">Alta renda</span>':'', i.esfriando?'<span class="fu-bd lj">❄ esfriando</span>':'', i.quente&&!i.enc?'<span class="fu-bd vm">🔥 quente</span>':'',
    i.d.revisao?'<span class="fu-bd a">revisar etapa</span>':'', i.cong?'<span class="fu-bd b">❄️ congelado</span>':''].join('');
  const renda=c.renda||c.renda_estimada, rv=renda?Math.round((+String(renda).replace(/\D/g,'')||0)/1000):0, pa=(typeof paDe==='function')?paDe(c):0;
  return `<article class="fu-card${i.semProx?' semprox':''}" draggable="true" data-id="${esc(c.id)}" onclick="fuAbrir('${j}')">
    <div class="fu-l1"><span class="fu-alca" aria-hidden="true" title="Arraste pra mover ou reordenar">⠿</span><div class="fu-nome"><span class="nm">${esc(c.nome||'—')}</span><button type="button" class="fu-i" onclick="event.stopPropagation();fuInfoPop(event,'${j}')" aria-label="Resumo de ${esc(c.nome||'')}">ⓘ</button></div>${i.semProx?'<span class="fu-avc" title="Sem próximo passo">⚠ Sem próx. passo</span>':''}</div>
    ${fid==='vi'?starsHtml(c,i.ance):''}
    <div class="fu-meta2">${fid==='mfo'&&c.produto?`<b>${esc(c.produto)}</b>`:''}${c.profissao?`<span>${esc(c.profissao)}</span>`:''}${c.cidade||rv?`<span class="r"><span>${esc(c.cidade||'')}</span>${rv?`<span class="val">R$ ${rv} mil</span>`:''}</span>`:''}${i.prox?`<span>📅 ${esc(dataBR(i.prox.quando))}${i.prox.hora?' '+esc(i.prox.hora):''}${i.prox.tit?' · '+esc(i.prox.tit):''}</span>`:''}${pa?`<span class="pa">PA ${esc(brlCurto(pa))}</span>`:''}</div>
    ${st?`<span class="fu-st">${esc(st)}</span>`:''}${i.enc&&(c.motivo_perda||c.status)?`<span class="fu-st">✖ ${esc(c.motivo_perda||c.status)}</span>`:''}
    ${bds?`<div class="fu-bds">${bds}</div>`:''}
    <div class="fu-cf" onclick="event.stopPropagation()"><span class="lb">Contato rápido</span>${i.prox?`<button type="button" onclick="fuFeito('${j}')" title="Feito (conclui o próximo passo)" aria-label="Feito">✓</button>`:''}<button type="button" onclick="fuDelay('${j}')" title="Delay (remarcou)" aria-label="Delay">✕</button><button type="button" onclick="fuLigar(event,'${j}')" title="Ligar" aria-label="Ligar">☏</button><button type="button" onclick="fuZap(event,'${j}')" title="WhatsApp" aria-label="WhatsApp">💬</button><button type="button" onclick="fuMoverMenu(event,'${j}')" title="Mover de etapa" aria-label="Mover de etapa">⇄</button></div>
  </article>`; }
function colHtml(fid,id,itens){ const enc=ehEnc(fid,id), cs=itens.map(x=>x.c);
  const sp=itens.filter(x=>x.i.semProx).length, pa=(typeof somaPA==='function')?somaPA(cs):0, pos=id==='entrega', j=esc(jsq(id));
  return `<section class="fu-col${enc?' enc':''}${(FU.tab[fid]||colsVis(fid)[0])===id?' vis':''}" data-etapa="${esc(id)}" aria-label="${esc(lbl(id))}">
    <div class="fu-col-h"><span class="fu-alca fu-alca-col" draggable="true" data-alca="${esc(id)}" title="Arraste pra mudar a ordem das colunas" aria-hidden="true">⠿</span><span style="width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:${corDe(fid,id)}"></span><b>${esc(lbl(id))}</b><span class="qt">${itens.length}</span><button type="button" class="fu-colx" onclick="fuColMenu(event,'${j}')" aria-label="Organizar a etapa ${esc(lbl(id))}" title="Organizar esta etapa">⋯</button></div>
    <div class="fu-col-s">${enc?'<span>encerramento · fora do funil</span>':pos?'<span>📦 pós-venda · não soma no funil</span>':`<span>prob. ${prob(id)}%${sp?` · ⚠ ${sp}`:''}</span>${pa?`<span class="pa">PA ${esc(brlCurto(pa))}</span>`:''}`}</div>
    <div class="fu-cards">${itens.length?itens.map(x=>cardHtml(x,fid)).join(''):`<div class="fu-vazio">${ativos().length||FU.q?'Nenhum card com estes filtros':'Solte um card aqui'}</div>`}</div>
  </section>`; }
function colsVis(fid){ const c=colsDe(fid); return c.ordem.filter(id=>!c.ocultas.includes(id)); }
function topoHtml(){ const nVi=fuPopulacao('vi').length, nMf=fuPopulacao('mfo').length;
  return `<div class="fu-seg" role="tablist" aria-label="Funil"><button type="button" class="${FU.fid==='vi'?'on':''}" onclick="fuFunil('vi')">🎯 Vida Individual <span class="n">${nVi}</span></button><button type="button" class="${FU.fid==='mfo'?'on':''}" onclick="fuFunil('mfo')">🏢 MFO <span class="n">${nMf}</span></button></div>`; }
function barraHtml(){ const c=colsDe(FU.fid), nv=c.ordem.length-c.ocultas.length, ol=(ORDENS.find(o=>o[0]===FU.ordem)||ORDENS[0])[1];
  return `<div class="fu-acts"><button type="button" class="fu-b" onclick="irPara('sitplan')" title="SitPlan do dia">📅 <span class="tx">SitPlans</span></button><button type="button" class="fu-b" onclick="irPara('bn-recs')" title="Recomendações">🌳 <span class="tx">Recomendações</span></button>
    <button type="button" class="fu-b p" onclick="openNovoContato()">＋ <span class="tx">Novo negócio</span></button>${FU.fid==='vi'&&typeof fuNovaRec==='function'?'<button type="button" class="fu-b" onclick="fuNovaRec()" title="Cole texto, foto, PDF ou contato: a IA lê e você revisa">✨ <span class="tx">Nova recomendação</span></button>':''}
    <button type="button" class="fu-b" onclick="fuOrdemMenu(event)" title="Ordenar">⇅ <span class="tx">${esc(ol)}</span> ▾</button>
    <span class="fu-vt" role="group" aria-label="Vista"><button type="button" class="${FU.modo==='kanban'?'on':''}" onclick="fuModo('kanban')" title="Kanban" aria-label="Kanban">▦</button><button type="button" class="${FU.modo==='tabela'?'on':''}" onclick="fuModo('tabela')" title="Tabela" aria-label="Tabela">☰</button></span>
    <button type="button" class="fu-b" onclick="fuColunas()" title="Colunas">▥ <span class="tx">Colunas</span> <span class="cn">(${nv}/${c.ordem.length})</span></button>
    <button type="button" class="fu-b" onclick="fuMais(event)" aria-label="Mais opções">⋯</button></div>`; }
function filtroBarHtml(lista){ const at=ativos(), S2=salvos(), algum=S2.some(x=>fIgual(x.f));
  return `<div class="fu-fb" aria-label="Filtros"><button type="button" class="fu-b" onclick="fuFiltrosAbrir()">⚙ Filtros${at.length?` <span class="fu-cnt">${at.length}</span>`:''}</button>
    ${S2.length?'<span class="fu-fb-l">Salvos</span>':''}${S2.map((x,k)=>`<button type="button" class="fu-sv${fIgual(x.f)?' on':''}" onclick="fuSalvoAplicar(${k})">${esc(x.n)} <span class="q">${contaSalvo(lista,x.f)}</span></button>`).join('')}
    ${at.length&&!algum?'<span class="fu-sep"></span>'+at.map(([k,l])=>`<button type="button" class="fu-fc ativo" onclick="fuTirar('${esc(k)}')">${esc(l)} ✕</button>`).join(''):''}${FU.cong?'<button type="button" class="fu-fc ativo" onclick="fuCong()">❄️ Congelados ✕</button>':''}${at.length?'<button type="button" class="fu-fc txt" onclick="fuLimpar()">limpar</button>':''}</div>`; }
function tabelaHtml(fid,vis){ const l=fuOrdenar(vis);
  return `<div class="fu-tw"><table><thead><tr><th><button type="button" class="btn-ghost" onclick="fuOrdem('nome')">Nome</button></th><th>Criado em</th><th><button type="button" class="btn-ghost" onclick="fuOrdem('prob')">Prob. ↓</button></th><th>Etapa</th><th>Recomendante</th><th>Profissão</th><th>Renda</th><th>Cidade</th><th>SitPlan</th><th>Tags</th><th>Observação</th><th>Mercado</th><th>Ações</th></tr></thead><tbody>
  ${l.map(({c,i})=>{ const j=esc(jsq(c.id)); let ent=''; try{ ent=entradaFunil(c).iso||''; }catch(_){}
    return `<tr><td><button type="button" class="btn-ghost" style="font-weight:600;text-align:left" onclick="fuAbrir('${j}')">${esc(c.nome||'—')}</button></td><td>${esc(dataBR(ent))}</td><td class="num">${prob(i.d.etapa_id)}%</td><td><span class="fu-bd" style="color:${corDe(fid,i.d.etapa_id)}">● ${esc(lbl(i.d.etapa_id))}</span></td><td>${esc(c.recomendante||'—')}</td><td>${esc(c.profissao||'—')}</td><td class="num">${esc(c.renda||c.renda_estimada||'—')}</td><td>${esc(c.cidade||'—')}</td><td>${esc(c.sitplan?dataBR(String(c.sitplan).slice(0,10)):'—')}</td><td>${esc(c.tags||'—')}</td><td>${esc(String(c.notas||'').slice(0,60)||'—')}</td><td>${esc(c.mercado||'—')}</td><td><button type="button" class="btn btn-ghost btn-mini" onclick="fuLigar(event,'${j}')">☏</button> <button type="button" class="btn btn-ghost btn-mini" onclick="fuZap(event,'${j}')">💬</button></td></tr>`; }).join('')}
  </tbody></table></div><div class="sub" style="margin-top:8px">${l.length} card(s) · mesmos filtros do Kanban · ⋯ exporta a planilha</div>`; }

function viewFunilNovo(fid){ fuCss(); if(fid) FU.fid=fid; fid=FU.fid;
  const lista=fuLista(fid), vis=lista.filter(x=>fuPassa(x.c,x.i)), cols=colsVis(fid), adm=podeEditarEtapa();
  if(!cols.includes(FU.tab[fid])) FU.tab[fid]=cols[0];
  const busca=`<div class="fu-bq"><label class="fu-busca" for="fu-q">🔎 <input id="fu-q" type="search" placeholder="Buscar em qualquer coluna (nome, cidade, profissão, etapa…)" autocomplete="off" value="${esc(FU.q)}" oninput="fuBusca(this.value)"></label><span class="fu-res">${vis.length} de ${lista.filter(x=>FU.cong?x.i.cong:!x.i.cong).length} resultados</span></div>`;
  let body;
  if(FU.modo==='tabela') body=tabelaHtml(fid,vis);
  else body=`<div class="fu-tabs">${cols.map(id=>`<button type="button" class="${FU.tab[fid]===id?'on':''}" onclick="fuTab('${esc(jsq(id))}')">${esc(lbl(id))} · ${vis.filter(x=>x.i.d.etapa_id===id).length}</button>`).join('')}</div>
    <div class="fu-board" id="fu-board">${cols.map(id=>colHtml(fid,id,fuOrdenar(vis.filter(x=>x.i.d.etapa_id===id)))).join('')}${adm?'<button type="button" class="fu-nova-col" onclick="fuEtapaNova()">＋ Nova etapa</button>':''}</div>`;
  $('#main').innerHTML=`<div class="fu">${topoHtml()}${barraHtml()}${filtroBarHtml(lista)}<div class="fu-qd">${busca}${body}</div></div>`;
  if(FU.modo==='kanban') fuWire(); }

/* ── arrastar (desktop) ── */
function fuWire(){ const b=document.getElementById('fu-board'); if(!b) return; let dragId=null, dragCol=null;
  const limpa=()=>b.querySelectorAll('.fu-drop').forEach(x=>x.remove());
  b.querySelectorAll('.fu-card').forEach(card=>{ card.addEventListener('dragstart',e=>{ if(dragCol) return; dragId=card.dataset.id; card.classList.add('dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',dragId); }catch(_){} });
    card.addEventListener('dragend',()=>{ dragId=null; card.classList.remove('dragging'); limpa(); b.querySelectorAll('.fu-col.drop').forEach(x=>x.classList.remove('drop')); }); });
  b.querySelectorAll('[data-alca]').forEach(a=>{ a.addEventListener('dragstart',e=>{ e.stopPropagation(); dragCol=a.dataset.alca; const c=a.closest('.fu-col'); if(c) c.classList.add('dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','col:'+dragCol); }catch(_){} });
    a.addEventListener('dragend',()=>{ dragCol=null; b.querySelectorAll('.fu-col').forEach(x=>x.classList.remove('dragging','drop')); }); });
  b.querySelectorAll('.fu-col').forEach(col=>{
    col.addEventListener('dragover',e=>{ if(!dragId&&!dragCol) return; e.preventDefault(); col.classList.add('drop'); if(dragCol) return;
      const box=col.querySelector('.fu-cards'); limpa(); const depois=[...box.querySelectorAll('.fu-card:not(.dragging)')].find(x=>e.clientY<x.getBoundingClientRect().top+x.offsetHeight/2);
      const m=document.createElement('div'); m.className='fu-drop'; box.insertBefore(m,depois||null); });
    col.addEventListener('dragleave',e=>{ if(!col.contains(e.relatedTarget)){ col.classList.remove('drop'); limpa(); } });
    col.addEventListener('drop',e=>{ e.preventDefault(); col.classList.remove('drop');
      if(dragCol){ const de=dragCol; dragCol=null; fuColPara(de,col.dataset.etapa); return; }
      const id=dragId; dragId=null; if(!id) return; const mk=col.querySelector('.fu-drop'), nx=mk&&mk.nextElementSibling, antes=nx&&nx.dataset?nx.dataset.id:null; limpa();
      fuSoltar(id,col.dataset.etapa,antes); }); }); }
/* soltar o card: muda de etapa (mesma regra do ⇄) e guarda a posição na coluna (ordem manual, por card: c.fu_ord) */
function fuSoltar(id,X,antes){ const c=fuAcha(id); if(!c) return; const fid=fuDestino(c).funil_id, era=fuDestino(c).etapa_id;
  if(era!==X){ fuMover(id,X); if(ehEnc(fid,X)||c.funil==='bn') return; }
  const c2=fuAcha(id); if(!c2||c2.funil==='bn'||fuDestino(c2).etapa_id!==X) return;
  fuOrdInserir(fid,X,c2,antes); FU.ordem='livre'; salvar(); fuRepinta(); if(era===X) toast(`${pn(c2)} mudou de posição na coluna`,true); }
function fuOrdInserir(fid,X,c,antes){ const pop=fuOrdenar(fuLista(fid).filter(x=>x.i.d.etapa_id===X&&x.c!==c&&x.c.funil!=='bn')).map(x=>x.c);
  let k=antes?pop.findIndex(x=>String(x.id)===String(antes)):-1; if(k<0) k=pop.length; pop.splice(k,0,c); pop.forEach((x,n)=>{ x.fu_ord=n; }); }

/* ── mover (com sincronia pro funil antigo) ── */
function fuMover(id,X,motivo){ const c=fuAcha(id); if(!c) return; const fid=fuDestino(c).funil_id; if(!etapa(fid,X)) return;   /* o funil é o do card (a ficha em painel abre negócio do outro funil) */
  const antes=fuDestino(c).etapa_id; if(antes===X) return;
  if(ehEnc(fid,X)&&!motivo){ fuMotivoAbrir(id,X); return; }
  const nome=String(c.nome||'').split(' ')[0]||'Card';
  if(c.funil==='bn'){   /* Estoque: vira contato do funil (mesmo caminho do "Agendou no TA") */
    const leg=fuVoltaLegado({funil:'nn'},X); const nc=(typeof bnLevarProFunil==='function')?bnLevarProFunil(c,leg||'TA'):null; if(!nc) return;
    if(!leg){ nc.funil_id=fid; nc.etapa_id=X; nc.etapa_id_fonte='manual'; }
    if(motivo) nc.motivo_perda=motivo; if(FU.pan&&FU.pan.id===String(id)) FU.pan.id=String(nc.id); salvar(); fuRepinta(); toast(`${nome} saiu do Estoque → ${lbl(X)}`,true); return; }
  const leg=fuVoltaLegado(c,X);
  if(leg&&leg!==c.etapa){ const de=c.etapa; c.etapa=leg; try{ funOrdemInserir(c,leg,null); }catch(_){} try{ logEtapa(c,de,leg); }catch(_){} }
  c.funil_id=fid; c.etapa_id=X; c.etapa_id_fonte=leg?'mapa':'manual';
  if(!leg) interacoesDe(c).push({id:uid(),k:'etapa_fu',l:`Etapa: ${lbl(antes)} → ${lbl(X)}`,de:antes,para:X,dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()});
  if(motivo){ c.motivo_perda=motivo; try{ if(leg&&etStatusOpts(c).includes(motivo)){ c.status=motivo; c.status_etapa=c.etapa; } }catch(_){} }
  if(X===CLIENTE_COL[fid]&&!fuEhCliente(c)) toast(`${nome}: não achei apólice ativa na carteira — vai como emitida manual`,false);
  else toast(`${nome}: ${lbl(antes)} → ${lbl(X)}${leg?'':' (só no funil novo: o antigo não tem essa etapa)'}`,true);
  salvar(); fuRepinta(); }
/* redesenha o quadro e, se a ficha em painel estiver aberta, ela também */
function fuRepinta(){ try{ render(); }catch(_){} if(FU.pan) fuPainelRender();
  try{ const d=document.getElementById('drawer'); if(d&&d.classList.contains('aberto')&&typeof CONTATO!=='undefined'&&CONTATO&&typeof renderDrawer==='function') renderDrawer(); }catch(_){} }   /* a ficha de sempre (aberta por cima) acompanha */
function fuMotivoAbrir(id,X){ const c=fuAcha(id); if(!c) return; FU.motivo={id,X};
  const e=etapa(fuDestino(c).funil_id,X)||{}, opts=[...new Set([...(Array.isArray(e.status)?e.status:[]),...(()=>{ try{ const l=fuVoltaLegado(c,X); return l?((FUNIL_CFG[etCfgKey(c.funil)]||[]).find(y=>y.id===l)||{}).status||[]:[]; }catch(_){ return []; } })(),...MOTIVOS_SUGESTAO])];
  fuModal(`<h2>Encerrar ${esc(String(c.nome||'').split(' ')[0])} em “${esc(lbl(X))}”</h2><div class="sub" style="margin:0">Sem motivo não encerra. A lista vem de Funil & Etapas (motivos da perda) + sugestões.</div>
    <div><label for="fu-mot" style="font-size:12px;color:var(--muted);font-weight:600">Motivo</label><select id="fu-mot" onchange="document.getElementById('fu-mot-out').hidden=this.value!=='__outro'"><option value="">— escolha o motivo —</option>${opts.map(m=>`<option>${esc(m)}</option>`).join('')}<option value="__outro">Outro…</option></select></div>
    <div id="fu-mot-out" hidden><input type="text" id="fu-mot-txt" placeholder="Escreva o motivo" maxlength="120" oninput="this.dataset.v=this.value"></div>
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuMotivoOk()">Encerrar</button></div>`); }
function fuMotivoOk(){ const m=FU.motivo; if(!m) return; const s=document.getElementById('fu-mot'); let v=s?s.value:'';
  if(v==='__outro') v=((document.getElementById('fu-mot-txt')||{}).value||'').trim();
  if(!v){ toast('Escolha o motivo pra encerrar',false); return; } fuFechar(); FU.motivo=null; fuMover(m.id,m.X,v); }
function fuMoverMenu(ev,id){ const c=fuAcha(id); if(!c) return; const d=fuDestino(c), at=d.etapa_id, j=esc(jsq(id));
  fuMenu(ev,`<div class="mh">Mover ${esc(String(c.nome||'').split(' ')[0])} para…</div>${cfg(d.funil_id).map(e=>`<button type="button" onclick="fuFecharMenu();fuMover('${j}','${esc(jsq(e.id))}')"${e.id===at?' disabled style="opacity:.5"':''}>${e.id===at?'✓ ':''}${esc(lbl(e.id))}${e.enc?' ✖':''}</button>`).join('')}`); }

/* ═══ T4 · contato rápido no vocabulário ÚNICO do SitPlan / Painel TA (RESULTADOS): o mesmo resultado conta nos mesmos
   KPIs, move a etapa antiga do mesmo jeito e o "Agendou X" vira reunião na Agenda (tarCriar → Google Agenda com hora). ═══ */
const pn=c=>String((c&&c.nome)||'').split(' ')[0]||'Card';
function fuTel(c){ try{ const t=(typeof pTels==='function'?pTels(c):[c.telefone])[0]; return String(t||c.telefone||''); }catch(_){ return String(c.telefone||''); } }
const RES_ICO={lig_atendida:'☎',lig_nao_atendida:'📵',caixa_postal:'📭',ocupado:'⏳',pediu_retornar:'↩',agendou_oi:'📅',agendou_pc:'📅',agendou_c2:'📅',agendou_reuniao:'📅',sem_interesse:'🚫',whatsapp:'💬',whats_respondeu:'✅',whats_sem_resposta:'💤'};
const RES_L=k=>k==='agendou_reuniao'?'Agendou reunião':((typeof RES_BY_K!=='undefined'&&RES_BY_K[k])||{}).l||k;
/* no MFO não existe OI/PC/C2: o agendamento é "reunião" (só Agenda, a etapa ele move) */
function fuResOpts(c,wa){ const R=(typeof RESULTADOS!=='undefined'?RESULTADOS:[]), mfo=fuDestino(c).funil_id==='mfo';
  let l=wa?R.filter(r=>r.wa).concat(R.filter(r=>r.agenda||r.k==='sem_interesse')):R.filter(r=>!r.wa);
  if(mfo){ l=l.filter(r=>!r.agenda); l.splice(l.findIndex(r=>r.k==='sem_interesse'),0,{k:'agendou_reuniao'}); }
  return l.map(r=>r.k); }
function resBtns(c,wa){ const j=esc(jsq(c.id)); return fuResOpts(c,wa).map(k=>`<button type="button" onclick="fuRegistrar('${j}','${k}')">${RES_ICO[k]||'•'} ${esc(RES_L(k))}${k==='sem_interesse'?' (encerra)':''}</button>`).join(''); }
function fuLigar(ev,id){ const c=fuAcha(id); if(!c) return; const t=fuTel(c), d=t.replace(/\D/g,'');
  if(!d){ toast('Sem telefone nesta ficha',false); return; }
  fuMenu(ev,`<div class="mh">☏ ${esc(pn(c))}</div><a href="tel:+${d.length<=11?'55'+d:d}">📞 Ligar agora</a><div class="tel">${esc(t)}</div><div class="mh">Como foi?</div>${resBtns(c,false)}`); }
function fuZap(ev,id){ const c=fuAcha(id); if(!c) return; const d=fuTel(c).replace(/\D/g,'');
  if(!d){ toast('Sem telefone nesta ficha',false); return; } const n=d.length<=11?'55'+d:d;
  fuMenu(ev,`<div class="mh">💬 ${esc(pn(c))} · nada é enviado sozinho</div><a href="https://wa.me/${n}" target="_blank" rel="noopener">Abrir conversa no WhatsApp</a><div class="mh">Registrar</div>${resBtns(c,true)}`); }
/* Estoque não tem RESULTADOS: cai no vocabulário dele (BN_RES) — o que não existe lá fica só no histórico do nome */
const BN_DE={lig_atendida:'atendeu',pediu_retornar:'atendeu',lig_nao_atendida:'nao_atendeu',caixa_postal:'nao_atendeu',ocupado:'nao_atendeu',sem_interesse:'sem_interesse'};
function fuRegistrar(id,k){ fuFecharMenu(); const c=fuAcha(id); if(!c) return;
  if(/^agendou_/.test(k)){ fuAgendarModal(id,k); return; }
  if(c.funil==='bn'){
    if(BN_DE[k]&&typeof bnResultado==='function'){ Promise.resolve(bnResultado(c.id,BN_DE[k])).then(()=>fuRepinta()); }
    else { (c.hist=c.hist||[]).push({tipo:'wa',res:k,dia:hojeISO(),ts:new Date().toISOString()}); try{ bnSalvar(); }catch(_){} fuRepinta(); }
    toast(`${pn(c)}: ${RES_L(k)} registrado`,true); return; }
  if(typeof RES_BY_K!=='undefined'&&RES_BY_K[k]) registrarResultado(c.id,k);   /* loga, conta no KPI, mexe etapa/status antigos */
  else { interacoesDe(c).push({id:uid(),k,l:RES_L(k),dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()}); salvar(); }
  if(k==='sem_interesse'){ const d=fuDestino(c); if(!ehEnc(d.funil_id,d.etapa_id)){ const fim=cfg(d.funil_id).find(e=>e.enc); if(fim){ fuMover(c.id,fim.id,'Sem interesse'); return; } } c.motivo_perda=c.motivo_perda||'Sem interesse'; salvar(); }
  fuRepinta(); }
function fuAgendarModal(id,k){ const c=fuAcha(id); if(!c) return; FU.ag={id:String(id),k};
  const r=(typeof RES_BY_K!=='undefined'&&RES_BY_K[k])||null, alvo=r&&r.etapa?r.etapa:'';
  const vai=alvo?(()=>{ try{ return lbl(mapearEtapa(c.funil==='bn'?'nn':(c.funil||'nn'),alvo).etapa_id); }catch(_){ return alvo; } })():'';
  fuModal(`<h2>📅 ${esc(pn(c))} · ${esc(RES_L(k))}</h2>
    <div class="fu-g2"><div class="fu-fld"><label for="fu-ag-d">Dia</label><input type="date" id="fu-ag-d" value="${esc(isoAddDias(hojeISO(),2))}" onchange="this.dataset.v=this.value"></div><div class="fu-fld"><label for="fu-ag-h">Hora</label><input type="time" id="fu-ag-h" value="10:00" onchange="this.dataset.v=this.value"></div></div>
    <div class="fu-fld"><label for="fu-ag-l">Lembrete pro cliente</label><select id="fu-ag-l" onchange="this.dataset.v=this.value"><option value="nao">Sem lembrete</option><option value="vespera">Na véspera (mensagem pronta no WhatsApp)</option><option value="dia">No dia</option></select></div>
    <div class="sub" style="margin:0">Vira reunião na Agenda (mesmo caminho do SitPlan; com hora, vai pro Google Agenda)${vai?` e o card anda pra <b>${esc(vai)}</b>`:''}. Nada é enviado ao cliente sozinho.</div>
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuAgendarOk()">Agendar</button></div>`); }
async function fuAgendarOk(){ const a=FU.ag; if(!a) return; const d=(document.getElementById('fu-ag-d')||{}).value, h=(document.getElementById('fu-ag-h')||{}).value||'', lem=(document.getElementById('fu-ag-l')||{}).value||'nao';
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(d||''))){ toast('Escolha o dia da reunião',false); return; }
  fuFechar(); FU.ag=null; let c=fuAcha(a.id); if(!c) return;
  if(c.funil==='bn'){ await Promise.resolve(typeof bnResultado==='function'?bnResultado(c.id,'agendou'):null);   /* vira contato do funil em OI/FF */
    const nc=c.funil_contato_id?(S.contatos||[]).find(x=>String(x.id)===String(c.funil_contato_id)):null; if(!nc){ toast('Não consegui trazer pro funil',false); return; }
    if(FU.pan&&FU.pan.id===String(c.id)) FU.pan.id=String(nc.id); c=nc;
    if(a.k!=='agendou_oi'&&RES_BY_K[a.k]) registrarResultado(c.id,a.k); }
  else if(typeof RES_BY_K!=='undefined'&&RES_BY_K[a.k]) registrarResultado(c.id,a.k);
  else interacoesDe(c).push({id:uid(),k:'agendou_reuniao',l:'Agendou reunião',dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()});
  try{ fuSincLegado(c); }catch(_){}
  const r=RES_BY_K[a.k], tit='Reunião '+(r&&r.etapa?r.etapa:'')+' · '+pn(c);
  if(typeof tarCriar==='function') tarCriar(c.id,'reuniao',tit.replace('  ',' '),d,h,'',60);
  if(lem!=='nao'&&typeof tarAgendarLembrete==='function'){ tarAgendarLembrete(c.id,d,h,lem); salvar(); }
  fuRepinta(); }
function fuDelay(id){ const c=fuAcha(id); if(!c||typeof negDelayMarcar!=='function') return;
  if(c.funil==='bn'){ toast('Nome do Estoque: traga pro funil antes de marcar delay',false); return; }
  if(negDelayAtivo(c)){ negDelayLimpar(c); salvar(); fuRepinta(); toast('Delay tirado',true); return; }
  const ate=negDelayMarcar(c,null,''); salvar(); fuRepinta(); toast(`⏳ Delay até ${dataBR(ate)} (o card some do "sem próximo passo" só se tiver tarefa)`,true); }

/* ── T4 · estrelas do ANCE: 1º toque libera, 2º grava a nota dele (verde) ── */
function starsHtml(c,a){ a=a||fuAnce(c); const un=FU.unlock===String(c.id), j=esc(jsq(c.id)); let h='';
  for(let k=1;k<=5;k++) h+=`<button type="button" class="${k<=a.n?'on':''}" onclick="event.stopPropagation();fuEstrela('${j}',${k})" aria-label="ANCE ${k} de 5">★</button>`;
  return `<div class="fu-stars${a.manual?' man':''}${un?' un':''}" title="ANCE ${a.n}/5 · ${a.fonte==='nota'?'sua nota':a.fonte==='criterios'?'pelos critérios A·N·C·E que você marcou':'automático pelas regras'} — 1º toque libera, 2º grava" onclick="event.stopPropagation()">${h}${un?'<span class="fu-un">toque a nota</span>':''}</div>`; }
function fuEstrela(id,n){ const c=fuAcha(id); if(!c) return;
  if(FU.unlock!==String(id)){ FU.unlock=String(id); fuRepinta(); toast('Estrelas liberadas — toque de novo pra gravar a nota',true); return; }
  FU.unlock=null; const antes=fuAnce(c).n; c.ance_manual=n; c.ance_manual_em=new Date().toISOString();
  if(c.funil==='bn'){ try{ bnSalvar(); }catch(_){} }
  else { interacoesDe(c).push({id:uid(),k:'nota',l:`⭐ ANCE: sua nota ${n}/5 (antes ${antes}/5)`,dia:hojeISO(),ts:c.ance_manual_em,por:quemFez()}); salvar(); }
  fuRepinta(); toast(`ANCE ${n}/5 gravado (verde = nota sua)`,true); }
function fuAnceVoltar(id){ const c=fuAcha(id); if(!c) return; c.ance_manual=null; c.ance_manual_em=null;
  if(c.funil==='bn'){ try{ bnSalvar(); }catch(_){} } else salvar(); fuRepinta(); toast('ANCE de volta aos critérios / automático',true); }
/* os mesmos critérios da ficha de sempre (toggleAnce): a fonte é uma só */
function fuAnceCrit(id,k){ const c=fuAcha(id); if(!c||c.funil==='bn') return; if(!c.ance||typeof c.ance!=='object') c.ance={a:false,n:false,c:false,e:false,avisado:false}; c.ance[k]=!c.ance[k]; salvar(); fuRepinta(); }
/* ── T4 · ⓘ resumo rápido sem abrir a ficha ── */
function fuInfoPop(ev,id){ const c=fuAcha(id); if(!c) return; const fid=fuDestino(c).funil_id, i=fuInfo(c,fid), j=esc(jsq(id)), t=fuTel(c);
  const linhas=[`Etapa: <b>${esc(lbl(i.d.etapa_id))}</b>`,[c.profissao,c.cidade].filter(Boolean).map(esc).join(' · '),fid==='vi'?`ANCE ${i.ance.n}/5 ${i.ance.manual?'(sua)':'(automático)'}`:'',t?esc(t):'',c.recomendante?'Recomendado por: '+esc(c.recomendante):'',
    'Próximo: '+(i.prox?esc(dataBR(i.prox.quando)+(i.prox.hora?' '+i.prox.hora:'')+(i.prox.tit?' · '+i.prox.tit:'')):'<span style="color:#c2410c">nenhum</span>'),'Último contato: '+(i.ult?esc(ULT_LBL(i.ult.tipo)+' · '+dataBR(String(i.ult.quando).slice(0,10))):'nunca')].filter(Boolean);
  fuMenu(ev,`<div class="mh">${esc(c.nome||'—')}</div><div class="fu-ipop">${linhas.join('<br>')}</div><button type="button" onclick="fuFecharMenu();fuAbrir('${j}')">Abrir a ficha →</button>`); }

/* ── abrir a ficha: T5 = ficha em painel (Versão 3 aprovada) — Estoque sem ficha pergunta antes ── */
function fuAbrir(id){ let c=fuAcha(id); if(!c) return;
  if(c.funil==='bn'){
    if(c.funil_contato_id&&(S.contatos||[]).some(x=>String(x.id)===String(c.funil_contato_id))){ c=fuAcha(c.funil_contato_id); }
    else { const j=esc(jsq(id));
      fuModal(`<h2>${esc(c.nome||'—')}</h2><div class="sub" style="margin:0">Este nome ainda mora no <b>Estoque</b> (está na lista de TA). Pra abrir a ficha completa ele vira contato do funil.</div>
        <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar();irPara('bn-estoque')">Ver no Estoque</button><button type="button" class="btn btn-p" onclick="fuFechar();bnPromover('${j}')">Trazer pro funil e abrir</button></div>`); return; } }
  const novo=!FU.pan; FU.pan={id:String(c.id),cheia:FU.pan?FU.pan.cheia:panPref().cheia===true}; FU.histN=30; fuPainelRender(novo); }

/* ═══ T5 · FICHA EM PAINEL (Versão 3 aprovada na demo) ════════════════════════════════════════════════════════════
   PC: painel que desliza da direita (⤢ vira tela cheia). Celular: folha que sobe de baixo. "← Voltar" sempre à mão,
   o voltar do Android fecha (entra na pilha de camadas do app). A ficha de sempre continua: "✎ Ficha completa" abre
   ela POR CIMA do painel (todos os campos de hoje, sem duplicar formulário); ao fechar, o painel se redesenha.
   Vida Individual: qualificação ANCE + fact-find + histórico. MFO: os blocos tirados do histórico real (Cliente,
   Este negócio, Prêmio e remuneração, Coberturas, Campos do ramo, Cotações, Análise, Pendências) — dobráveis, nascem
   fechados, lembrados por aparelho (sem abrir/recolher tudo desde 25/10). Os campos MFO novos moram em c.mfo_ficha; os que
   já existiam (ramos, fecha_por, parceiro, origem_mfo, receita_estimada, drive_pasta) continuam nas chaves de sempre. */
const PAN_CHAVE='crmlp_fu_painel_v1';
function panPref(){ try{ return JSON.parse(localStorage.getItem(PAN_CHAVE)||'{}')||{}; }catch(_){ return {}; } }
function panGravar(o){ try{ localStorage.setItem(PAN_CHAVE,JSON.stringify(Object.assign(panPref(),o))); }catch(_){} }
const dobraSt=()=>panPref().dobra||{};
const ab=k=>(typeof dobraAberta==='function'?dobraAberta(k,dobraSt()):!!dobraSt()[k])?'open':'';
function fuDobra(k,el){ const d=dobraSt(); d[k]=el.open?1:0; panGravar({dobra:d}); }
function fuDobraTodas(on){ const d=dobraSt(); document.querySelectorAll('#fu-pg details[data-dobra]').forEach(x=>{ x.open=!!on; d[x.dataset.dobra]=on?1:0; }); panGravar({dobra:d}); }
const mfoF=c=>{ if(!c.mfo_ficha||typeof c.mfo_ficha!=='object') c.mfo_ficha={}; return c.mfo_ficha; };
const val=(c,k,top)=>{ const o=top?c:(c.mfo_ficha||{}); const v=o[k]; return v==null?'':v; };
function salvoFlash(){ const s=document.getElementById('fu-salvo'); if(s){ s.textContent='Salvo ✓'; s.classList.remove('ing'); } }
const tx=f=>{ try{ return f(); }catch(_){ return ''; } };

/* ── vocabulário MFO (do histórico: fichas do Drive, análises, formulário de VG, Mesa de Soluções) ── */
const SITUACAO={terceiro:'Apólice de terceiro (revisar/migrar)',nova:'Oportunidade nova',nossa:'Cliente nosso'};
const RAMO_CAMPOS={
  vida_grupo:[['Estipulante','vg_estip'],['Tipo de negociação','vg_neg',['Venda','Indicação (só agenciamento)']],['Modalidade de capital','vg_mod',['Uniforme','Escalonado','Múltiplo salarial']],['Capital global','vg_capg'],['Capital por vida (sócio × funcionário)','vg_capv'],['Vidas','vg_vidas','number'],['Custeio','vg_cust',['Não contributário','Contributário']],['Adesão','vg_ades',['Compulsória (GFIP)','Opcional']],['Afastados (com CID)','vg_afast'],['Vem de outra seguradora? Qual','vg_renov'],['Sinistralidade dos últimos 3 anos','vg_sin'],['Relação de vidas (arquivo)','vg_rel'],['Endosso de movimentação de vidas','vg_endo',['Sem pendência','Pendente']]],
  patrimonial:[['Local do risco (unidade)','pt_local'],['Imóvel','pt_imovel',['Próprio','Alugado']],['Valor em risco (imóvel + conteúdo + estoque)','pt_valor'],['Equipamentos de terceiros','pt_terc'],['Proteções (alarme, câmeras, AVCB)','pt_prot'],['Assistências','pt_assist'],['Restituição da apólice antiga','pt_rest'],['Quem fecha é habilitado em Danos?','pt_hab',['Sim','Não','Via assessoria/parceiro']]],
  vida_outra:[['Capitais por cobertura','ve_cap'],['Beneficiário','ve_benef'],['Sobrepõe a apólice Prudential?','ve_sobre',['Não','Sim','Verificar']]],
  previdencia_invest:[['Tipo','pv_tipo',['PGBL','VGBL','Investimento']],['Instituição / assessor','pv_inst']],
  credito:[['Produto','cr_prod',['Portabilidade / refinanciamento','Financiamento imobiliário','Recuperação de passivo','Seguro embutido (prestamista)']],['Banco credor','cr_banco'],['Saldo / valor do contrato','cr_saldo'],['CET / taxa','cr_cet'],['% do seguro habitacional','cr_hab'],['Gap apurado (R$)','cr_gap'],['Proposta concorrente','cr_conc'],['Comissão recorrente mensal','cr_rec']],
  juridico:[['Tipo de serviço','jr_tipo'],['Honorário por êxito (% do recuperado)','jr_hon'],['Valor pleiteado','jr_pleit'],['Valor recuperado','jr_recup']]};
const COT_STATUS=['Em análise','Enviada ao cliente','Aprovada','Recusada'], COT_VERSAO=['V1 espelho','V2 completa'], GRAV=['alta','média','baixa'];
const numBR=v=>{ const n=parseFloat(String(v||'').replace(/[^\d,.-]/g,'').replace(/\./g,'').replace(',','.')); return isNaN(n)?0:n; };

/* ── campos (gravam no change; texto não redesenha pra não roubar o foco do próximo campo) ── */
function fld(c,lab,k,tipo,o){ o=o||{}; const v=val(c,k,o.top), id='fu-m-'+k, j=esc(jsq(c.id)), re=o.re||Array.isArray(tipo)?1:0;
  const on=`onchange="fuMfoSet('${j}','${esc(jsq(k))}',this.value,${o.top?1:0},${re})"`;
  const cls=o.full?' full':'';
  if(Array.isArray(tipo)) return `<div class="fu-fld${cls}"><label for="${id}">${esc(lab)}</label><select id="${id}" ${on}><option value="">—</option>${tipo.map(x=>{ const [k2,t2]=Array.isArray(x)?x:[x,x]; return `<option value="${esc(k2)}" ${String(k2)===String(v)?'selected':''}>${esc(t2)}</option>`; }).join('')}</select></div>`;
  if(tipo==='area') return `<div class="fu-fld${cls}"><label for="${id}">${esc(lab)}</label><textarea id="${id}" rows="3" ${on}>${esc(v)}</textarea></div>`;
  return `<div class="fu-fld${cls}"><label for="${id}">${esc(lab)}</label><input id="${id}" ${tipo==='number'?'type="number" inputmode="numeric"':tipo==='date'?'type="date"':'type="text"'} value="${esc(v)}" ${on}></div>`; }
function fuMfoSet(id,k,v,top,re){ const c=fuAcha(id); if(!c) return; v=String(v==null?'':v).trim();
  if(top){ c[k]=v||null; } else { const o=mfoF(c); if(v) o[k]=v; else delete o[k]; }
  if(c.funil==='bn'){ try{ bnSalvar(); }catch(_){} } else salvar(); salvoFlash(); if(re) fuPainelRender(); else try{ render(); }catch(_){} }
function fuMfoArr(id,arr,i,f,v){ const c=fuAcha(id); if(!c) return; const o=mfoF(c), l=Array.isArray(o[arr])?o[arr]:(o[arr]=[]); if(!l[i]) return;
  if(f==='ok') l[i].ok=!!v; else { v=String(v==null?'':v).trim(); if(v) l[i][f]=v; else delete l[i][f]; }
  salvar(); salvoFlash(); if(f==='ok'||f==='status'||f==='grav') fuPainelRender(); }
function fuMfoAdd(id,arr){ const c=fuAcha(id); if(!c) return; const o=mfoF(c), l=Array.isArray(o[arr])?o[arr]:(o[arr]=[]);
  const el=document.getElementById('fu-add-'+arr), t=el?String(el.value||'').trim():'';
  if(arr==='pendencias'){ if(!t){ if(el) el.focus(); return; } l.push({t,ok:false}); }
  else if(arr==='lacunas'){ if(!t){ if(el) el.focus(); return; } l.push({t,grav:'média'}); }
  else if(arr==='cotacoes') l.push({data:hojeISO(),status:'Em análise'});
  else l.push({});
  const d=dobraSt(); d['m-'+arr]=1; panGravar({dobra:d}); salvar(); fuPainelRender(); }
function fuMfoDel(id,arr,i){ const c=fuAcha(id); if(!c) return; const l=mfoF(c)[arr]; if(!Array.isArray(l)||!l[i]) return; l.splice(i,1); salvar(); fuPainelRender(); }
function fuMfoRamo(id,k){ if(typeof mfoRamo==='function') mfoRamo(id,k); fuRepinta(); }
function fuMfoFecha(id,k){ const c=fuAcha(id); if(!c||typeof mfoSet!=='function') return; mfoSet(id,'fecha_por',c.fecha_por===k?'':k); fuRepinta(); }
function fuMfoReceita(id,v){ if(typeof mfoSetReceita==='function') mfoSetReceita(id,v); salvoFlash(); fuRepinta(); }
function fuMfoVenc(id,i,v){ if(typeof mfoVenc==='function') mfoVenc(id,i,v); salvoFlash(); }

function dobra(k,tit,res,corpo){ return `<details class="fu-dob" data-dobra="${esc(k)}" ${ab(k)} ontoggle="fuDobra('${esc(jsq(k))}',this)"><summary><span class="t">${tit}</span><span class="res">${res}</span></summary><div class="fu-db">${corpo}</div></details>`; }
function mfoBlocos(c){ const o=c.mfo_ficha||{}, j=esc(jsq(c.id)), pj=o.tipo&&o.tipo!=='PF';
  const ramos=c.ramos||[], RAM=(typeof MFO_RAMOS!=='undefined'?MFO_RAMOS:[]), FEC=(typeof MFO_FECHA!=='undefined'?MFO_FECHA:[]).map(x=>x[0]);
  const cov=o.coberturas||[], cot=o.cotacoes||[], lac=o.lacunas||[], pend=o.pendencias||[], aps=c.apolices_externas||[];
  const anual=o.premio_total?(o.periodicidade==='Mensal'?numBR(o.premio_total)*12:numBR(o.premio_total)):0;
  const rec=(typeof mfoReceita==='function')?mfoReceita(c):0;
  const ramoRot=k=>(typeof mfoRamoRot==='function')?mfoRamoRot(k):k;
  const camposRamo=ramos.length?ramos.map(k=>{ const cs=RAMO_CAMPOS[k]; return `<div class="fu-sub">${esc(ramoRot(k))}</div>`+(cs?`<div class="fu-g2">${cs.map(([l,kk,t])=>fld(c,l,kk,t)).join('')}</div>`:`<div class="fu-nota">Ainda não há caso de ${esc(ramoRot(k))} no seu histórico. Os campos próprios entram quando o primeiro caso chegar.</div>`); }).join(''):'<div class="mut">Marque o ramo em “Este negócio” e os campos dele aparecem aqui.</div>';
  return [
  dobra('m-cli','Cliente',`${esc(o.tipo||'PF')}${pj&&o.emp_razao?' · '+esc(o.emp_razao):''}${o.vinculo_lp?' · cliente Prudential':''}`,
    `<div class="fu-g2">${fld(c,'Tipo','tipo',['PF','PJ','PF com empresa'],{re:1})}${fld(c,'Origem','origem_mfo',['Base própria','Carteira','Parceria','Indicação'],{top:1})}
     ${fld(c,'Quem indicou / parceria','recomendante','text',{top:1})}${fld(c,'Vínculo Prudential (código do cliente LP)','vinculo_lp')}
     ${pj?fld(c,'Razão social','emp_razao')+fld(c,'CNPJ','emp_cnpj')+fld(c,'Atividade / CNAE','emp_ativ')+fld(c,'Nº de funcionários','emp_func','number')+fld(c,'Unidades / endereços de risco','emp_unid')+fld(c,'Quadro de sócios','emp_socios'):''}
     ${fld(c,'Pasta no Drive (link)','drive_pasta','text',{top:1,re:1})}${fld(c,'Doc de análise (link)','analise_doc')}</div>
     ${pj?'<div class="mut">Contatos da empresa (decisor, RH, financeiro, sócio): use “✎ Ficha completa”, um por papel.</div>':''}`),
  dobra('m-neg','Este negócio',`${esc(ramos.map(k=>(typeof mfoRamoRot==='function'?mfoRamoRot(k,true):k)).join(', ')||'sem ramo')} · ${esc(SITUACAO[o.situacao]||'situação?')} · fecha por ${esc(c.fecha_por||'?')}`,
    `<div class="fu-l">Ramos</div><div class="fu-chips">${RAM.map(([k,r])=>`<button type="button" class="fu-chip${ramos.includes(k)?' on':''}" aria-pressed="${ramos.includes(k)}" onclick="fuMfoRamo('${j}','${k}')">${esc(r)}</button>`).join('')}</div>
     <div class="fu-l">Fecha por</div><div class="fu-chips">${FEC.map(k=>`<button type="button" class="fu-chip${c.fecha_por===k?' on':''}" aria-pressed="${c.fecha_por===k}" onclick="fuMfoFecha('${j}','${esc(jsq(k))}')">${esc(k)}</button>`).join('')}</div>
     <div class="fu-g2">${c.fecha_por==='Parceiro'?fld(c,'Parceiro','parceiro','text',{top:1}):''}${fld(c,'Situação','situacao',Object.entries(SITUACAO),{re:1})}
     ${fld(c,'Seguradora / operadora','seguradora')}${fld(c,'Corretora atual (de quem é hoje)','corretora_atual')}${fld(c,'Produto / plano','plano')}${fld(c,'Nº proposta / apólice','num_apolice')}
     ${fld(c,'Início da vigência','vig_ini','date')}${fld(c,'Fim / renovação','renovacao','date')}${fld(c,'Prazo','prazo',['1 ano','5 anos','Renovação automática','Vitalício'])}</div>`),
  dobra('m-pr','Prêmio e remuneração',`${o.premio_total?esc(o.premio_total)+(o.periodicidade?' '+esc(String(o.periodicidade).toLowerCase()):''):'sem prêmio'}${rec?' · receita '+esc(brl(rec)):''}`,
    `<div class="fu-g2">${fld(c,'Prêmio líquido','premio_liq')}${fld(c,'IOF','iof')}${fld(c,'Prêmio total','premio_total','text',{re:1})}${fld(c,'Periodicidade','periodicidade',['Mensal','Anual','Única'])}
     <div class="fu-fld"><span class="fu-lb">Prêmio anual equivalente</span><div class="fu-calc">${anual?esc(brl(anual)):'—'} <small class="mut">calculado</small></div></div>${fld(c,'Forma de pagamento / parcelas','forma_pgto')}
     ${fld(c,'Comissão do concorrente (%) · referência','com_conc')}${fld(c,'Nossa comissão / agenciamento (%)','com_nossa')}${fld(c,'Repasse ao parceiro (%)','repasse')}
     <div class="fu-fld"><label for="fu-m-rec">Receita estimada (R$)</label><input id="fu-m-rec" type="text" inputmode="decimal" value="${rec?esc(String(rec).replace('.',',')):''}" onchange="fuMfoReceita('${j}',this.value)"></div></div>`),
  dobra('m-coberturas','Coberturas',`${cov.length} cobertura${cov.length===1?'':'s'}`,
    `${cov.map((x,i)=>`<div class="fu-cov">${[['nome','Cobertura'],['limite','Limite'],['franquia','Franquia'],['premio','Prêmio']].map(([f,l])=>`<label>${l}<input type="text" value="${esc(x[f]||'')}" onchange="fuMfoArr('${j}','coberturas',${i},'${f}',this.value)"></label>`).join('')}<button type="button" class="btn btn-ghost btn-mini fu-x" onclick="fuMfoDel('${j}','coberturas',${i})" aria-label="Tirar cobertura">✕</button></div>`).join('')}
     <button type="button" class="btn btn-ghost btn-mini" onclick="fuMfoAdd('${j}','coberturas')">＋ Cobertura</button>`),
  dobra('m-ramo','Campos do ramo',esc(ramos.map(ramoRot).join(', ')||'—'),camposRamo),
  dobra('m-cotacoes','Cotações',`${cot.length}${cot.length?' · '+esc(cot[cot.length-1].status||''):''}`,
    `${cot.map((q,i)=>`<div class="fu-cov">${[['parceiro','Parceiro / seguradora'],['num','Nº']].map(([f,l])=>`<label>${l}<input type="text" value="${esc(q[f]||'')}" onchange="fuMfoArr('${j}','cotacoes',${i},'${f}',this.value)"></label>`).join('')}<label>Data<input type="date" value="${esc(q.data||'')}" onchange="fuMfoArr('${j}','cotacoes',${i},'data',this.value)"></label><label>Status<select onchange="fuMfoArr('${j}','cotacoes',${i},'status',this.value)">${COT_STATUS.map(x=>`<option ${x===q.status?'selected':''}>${x}</option>`).join('')}</select></label><label>Versão<select onchange="fuMfoArr('${j}','cotacoes',${i},'versao',this.value)"><option value="">—</option>${COT_VERSAO.map(x=>`<option ${x===q.versao?'selected':''}>${x}</option>`).join('')}</select></label><button type="button" class="btn btn-ghost btn-mini fu-x" onclick="fuMfoDel('${j}','cotacoes',${i})" aria-label="Tirar cotação">✕</button></div>`).join('')||'<div class="mut">Nenhuma cotação.</div>'}
     <button type="button" class="btn btn-ghost btn-mini" onclick="fuMfoAdd('${j}','cotacoes')">＋ Cotação</button>`),
  dobra('m-lacunas','Análise',`${lac.length} lacuna${lac.length===1?'':'s'}${lac.some(x=>x.grav==='alta')?' · ⚠ alta':''}`,
    `${lac.map((x,i)=>`<div class="fu-lac"><input type="text" aria-label="Lacuna" value="${esc(x.t||'')}" onchange="fuMfoArr('${j}','lacunas',${i},'t',this.value)"><select aria-label="Gravidade" onchange="fuMfoArr('${j}','lacunas',${i},'grav',this.value)">${GRAV.map(g=>`<option ${g===x.grav?'selected':''}>${g}</option>`).join('')}</select><button type="button" class="btn btn-ghost btn-mini fu-x" onclick="fuMfoDel('${j}','lacunas',${i})" aria-label="Tirar lacuna">✕</button></div>`).join('')||'<div class="mut">Sem lacunas registradas.</div>'}
     <div class="fu-add"><input type="text" id="fu-add-lacunas" placeholder="Nova lacuna (ex.: sem lucros cessantes)" aria-label="Nova lacuna" onkeydown="if(event.key==='Enter')fuMfoAdd('${j}','lacunas')"><button type="button" class="btn btn-ghost btn-mini" onclick="fuMfoAdd('${j}','lacunas')">＋</button></div>
     <div class="fu-g2">${fld(c,'Estratégia','estrategia','area',{full:1})}${fld(c,'Seguradoras a cotar','seg_cotar')}${fld(c,'Pontos de atenção','atencao')}</div>`),
  dobra('m-pendencias','Pendências do cliente',`${pend.filter(x=>!x.ok).length} aberta${pend.filter(x=>!x.ok).length===1?'':'s'}`,
    `${pend.map((x,i)=>`<label class="fu-tar"><input type="checkbox" ${x.ok?'checked':''} onchange="fuMfoArr('${j}','pendencias',${i},'ok',this.checked)"> <span class="${x.ok?'fu-risc':''}">${esc(x.t||'')}</span><button type="button" class="btn btn-ghost btn-mini fu-x" onclick="event.preventDefault();fuMfoDel('${j}','pendencias',${i})" aria-label="Tirar pendência">✕</button></label>`).join('')||'<div class="mut">Nada pendente.</div>'}
     <div class="fu-add"><input type="text" id="fu-add-pendencias" placeholder="Nova pendência (ex.: apólice atual em PDF)" aria-label="Nova pendência" onkeydown="if(event.key==='Enter')fuMfoAdd('${j}','pendencias')"><button type="button" class="btn btn-ghost btn-mini" onclick="fuMfoAdd('${j}','pendencias')">＋</button></div>`),
  aps.length?dobra('m-aps','Apólices externas',`${aps.length}`,aps.map((a,i)=>{ const pr=(typeof mfoPremioAp==='function')?mfoPremioAp(a):null; return `<div class="fu-ap"><div><b>${esc(a.seguradora||'Seguradora ?')}</b><div class="mut">${esc(a.tipo||'')}${pr?' · '+esc(brl(pr.v)):''}</div></div><label>Vencimento<input type="date" value="${esc(a.vencimento||'')}" onchange="fuMfoVenc('${j}',${i},this.value)"></label></div>`; }).join('')):''
  ].join(''); }

/* ── Vida Individual: qualificação (ANCE) + fact-find ── */
function viBlocos(c){ const j=esc(jsq(c.id)), a=fuAnce(c), D=(typeof ANCE_DEFS!=='undefined'?ANCE_DEFS:[]), an=c.ance||{};
  const renda=tx(()=>pRendaPessoal(c))||c.renda||c.renda_estimada||'', idade=tx(()=>pIdade(c))||c.idade||'', fil=tx(()=>pFilhos(c)), civ=tx(()=>pEstadoCivil(c));
  const ic=c.infoclient||{}, icp=['pessoais','familiar','financeiro','saude'].filter(k=>ic[k]).length*25;
  return `<section class="fu-pc"><div class="fu-pch"><b>Qualificação</b><span class="mut">ANCE ${a.n}/5 · ${a.fonte==='nota'?'sua nota':a.fonte==='criterios'?'pelos critérios':'automático'}</span></div>
    <div class="fu-row2">${starsHtml(c,a)}${a.fonte==='nota'&&c.ance_manual_em?`<button type="button" class="btn btn-ghost btn-mini" onclick="fuAnceVoltar('${j}')">voltar aos critérios</button>`:''}</div>
    <div class="mut">Sua nota manda: toque nas estrelas (1º toque libera, 2º grava, fica verde). Sem nota, valem os critérios abaixo — os mesmos da ficha de sempre.</div>
    ${c.funil==='bn'?'':`<div class="fu-chips">${D.map(([k,l,dsc])=>`<button type="button" class="fu-chip${an[k]?' on':''}" aria-pressed="${!!an[k]}" title="${esc(dsc)}" onclick="fuAnceCrit('${j}','${k}')">${an[k]?'✓ ':''}${esc(l)}</button>`).join('')}</div>`}
    <div class="fu-g2">${fld(c,'Mercado','mercado',[['X','Mercado X'],['Y','Mercado Y'],['Z','Mercado Z']],{top:1,re:1})}<div class="fu-fld"><span class="fu-lb">Recomendante</span><div class="fu-calc" style="font-weight:500">${esc(c.recomendante||'—')}</div></div></div></section>
   <section class="fu-pc"><div class="fu-pch"><b>Fact-find</b><span class="mut">InfoClient ${icp}% preenchido</span></div>
    <div class="fu-tiles"><div><span>Renda mensal</span><b>${renda?esc(String(renda)):'—'}</b></div><div><span>Idade</span><b>${idade?esc(String(idade))+' anos':'—'}</b></div><div><span>Estado civil</span><b>${civ?esc(String(civ)):'—'}</b></div><div><span>Filhos</span><b>${fil===''||fil==null?'—':esc(String(fil))}</b></div></div>
    <div class="mut">Renda, família, saúde e o InfoClient completo ficam na ficha completa.</div></section>`; }

/* ── negócios desta pessoa (os dois funis), histórico, tarefas, rede, carteira ── */
function negociosDe(c){ let l=[c]; try{ l=l.concat(pessoaIrmaos(c)); }catch(_){}
  const k=normKey(c.nome||''); if(k&&k.indexOf(' ')>0) (S.contatos||[]).forEach(x=>{ if(x&&!l.includes(x)&&!x.merged_into&&normKey(x.nome||'')===k) l.push(x); });
  return l; }
function negRow(x,atual){ const d=fuDestino(x), mfo=d.funil_id==='mfo', j=esc(jsq(x.id)), pr=fuProx(x);
  const nome=mfo?((x.ramos||[]).map(k=>(typeof mfoRamoRot==='function'?mfoRamoRot(k):k)).join(', ')||LINHA[x.linha]||'Negócio MFO'):(tx(()=>negTitulo(x))||'Vida individual');
  const v=mfo?((typeof mfoReceita==='function'&&mfoReceita(x))?'receita '+brl(mfoReceita(x)):''):((typeof paDe==='function'&&paDe(x))?'PA '+brlCurto(paDe(x)):'');
  return `<button type="button" class="fu-neg${atual?' on':''}" onclick="fuAbrir('${j}')" ${atual?'aria-current="true"':''}><span><b>${esc(nome)}</b> · ${mfo?'MFO':'Prudential'}</span><span class="fu-negr"><span class="fu-bd" style="color:${corDe(d.funil_id,d.etapa_id)}">● ${esc(lbl(d.etapa_id))}</span>${pr?`<span class="mut">próx.: ${esc(dataBR(pr.quando))}</span>`:''}${v?`<span class="mut">${esc(v)}</span>`:''}</span></button>`; }
const HF=[['tudo','Tudo'],['lig','Ligações'],['wa','WhatsApp'],['reu','Reuniões'],['nota','Notas']];
function histTipo(i){ const r=(typeof RES_BY_K!=='undefined'&&RES_BY_K[i.k])||{}; if(r.agenda||/reuni|agendou/.test(i.k)) return 'reu'; if(r.wa||/^wa|whats/.test(i.k)) return 'wa'; if(r.lig) return 'lig'; if(i.k==='nota') return 'nota'; return 'outro'; }
function histHtml(c){ const f=FU.hf||'tudo', all=(Array.isArray(c.interacoes)?c.interacoes:[]).filter(Boolean).slice().sort((a,b)=>String(b.ts||b.dia||'').localeCompare(String(a.ts||a.dia||'')));
  const l=all.filter(i=>f==='tudo'||histTipo(i)===f), n=FU.histN||30, j=esc(jsq(c.id));
  return `<section class="fu-pc"><div class="fu-pch"><b>Histórico</b><span class="fu-hfs">${HF.map(([k,t])=>`<button type="button" class="fu-fc${f===k?' ativo':''}" onclick="fuHist('${k}')">${t}</button>`).join('')}</span></div>
    ${c.funil==='bn'?'':`<div class="fu-add"><input type="text" id="fu-nota" placeholder="Registrar nota (o que conversaram, combinado…)" aria-label="Nova nota" onkeydown="if(event.key==='Enter')fuNota('${j}')"><button type="button" class="btn btn-ghost btn-mini" onclick="fuNota('${j}')">Registrar</button></div>`}
    <div class="fu-hist">${l.slice(0,n).map(i=>`<div><span>${esc(i.l||RES_L(i.k)||i.k)}</span><small>${esc(dataBR(String(i.dia||i.ts||'').slice(0,10)))}${i.por&&typeof i.por==='string'&&i.por.includes('@')?' · '+esc(i.por.split('@')[0]):''}</small></div>`).join('')||'<div class="mut">Nada nesse filtro.</div>'}</div>
    ${l.length>n?`<button type="button" class="btn btn-ghost btn-mini" onclick="FU_STATE.histN+=50;fuPainelRender()">ver mais ${l.length-n}</button>`:''}</section>`; }
function tarHtml(c){ const j=esc(jsq(c.id)), ab2=(typeof tarAbertas==='function')?tarAbertas(c):(c.tarefas||[]).filter(t=>t&&!t.feito), TT=(typeof TAR_TIPOS!=='undefined'?TAR_TIPOS:[['follow','🔁','Follow-up']]);
  return `<section class="fu-pc"><div class="fu-pch"><b>Tarefas</b><span class="mut">${ab2.length} aberta${ab2.length===1?'':'s'}</span></div>
    ${ab2.map(t=>`<label class="fu-tar"><input type="checkbox" onchange="fuTarFeita('${j}','${esc(jsq(t.id))}')"> <span>${esc((typeof tarIco==='function'?tarIco(t.tipo)+' ':'')+(t.tit||''))}</span><small class="${typeof tarSituacao==='function'&&tarSituacao(t)==='atrasada'?'fu-atr':''}">${esc(typeof tarQuandoTxt==='function'?tarQuandoTxt(t):dataBR(t.quando||''))}</small></label>`).join('')||'<div class="fu-av">⚠ Sem próximo passo: agende ou crie uma tarefa.</div>'}
    ${c.funil==='bn'?'':`<div class="fu-tnova"><select id="fu-t-tipo" aria-label="Tipo da tarefa">${TT.map(t=>`<option value="${t[0]}">${t[1]} ${esc(t[2])}</option>`).join('')}</select><input type="text" id="fu-t-tit" placeholder="O quê" aria-label="Título da tarefa" onkeydown="if(event.key==='Enter')fuTarNova('${j}')"><input type="date" id="fu-t-d" value="${esc(isoAddDias(hojeISO(),1))}" aria-label="Quando"><input type="time" id="fu-t-h" aria-label="Hora (opcional)"><button type="button" class="btn btn-ghost btn-mini" onclick="fuTarNova('${j}')">＋ Criar</button></div>`}</section>`; }
function redeHtml(c){ const r=tx(()=>recomendanteDe(c))||null, k=normKey(c.nome||'');
  const ind=k?(S.contatos||[]).concat((typeof BN!=='undefined'&&BN.contatos)||[]).filter(x=>x&&x!==c&&!x.merged_into&&normKey(x.recomendante||'')===k):[];
  const recs=Array.isArray(c.recs)?c.recs.length:0, n=Math.max(ind.length,recs);
  return `<section class="fu-pc"><b>Rede de recomendação</b><div>${r?`Indicada por <b>${esc(r.nome)}</b>${r.cliente?' (cliente)':''}`:'Sem recomendante'}</div>
    <div>Indicou <b>${n}</b>${ind.length?': '+ind.slice(0,4).map(x=>esc(x.nome||'—')+(x.funil==='bn'?' (Estoque)':' ('+esc(lbl(fuDestino(x).etapa_id))+')')).join(', ')+(ind.length>4?'…':''):''}</div></section>`; }
function cartHtml(c){ let h=''; try{ h=drwCarteiraHtml(c)||''; }catch(_){}
  return `<section class="fu-pc"><b>Carteira</b>${h?`<div class="fu-cart">${h}</div>`:'<div class="mut">Ainda não é cliente. Quando a apólice emitir, ela aparece aqui.</div>'}</section>`; }
function planosHtml(c){ const l=Array.isArray(c.planos)?c.planos:[];
  return `<section class="fu-pc"><b>Cotações e planejamentos</b>${l.map(p=>`<div class="fu-cot"><span>📄 ${esc(p.base||p.nome||'Plano')}</span><span class="fu-bd ${p.status==='Ativado'?'v':'b'}">${esc(p.status||'')}</span></div>`).join('')||'<div class="mut">Nenhuma ainda.</div>'}<div class="mut">Criar e abrir simulações: “✎ Ficha completa”.</div></section>`; }

function painelHtml(c){ const d=fuDestino(c), fid=d.funil_id, mfo=fid==='mfo', i=fuInfo(c,fid), j=esc(jsq(c.id)), bn=c.funil==='bn', p=FU.pan||{};
  const tels=tx(()=>pTels(c))||[], tel=Array.isArray(tels)?tels.filter(Boolean):[], email=tx(()=>pEmail(c))||c.email||'';
  const resumo=[tx(()=>pProfissao(c))||c.profissao,(tx(()=>pIdade(c))||c.idade)?(tx(()=>pIdade(c))||c.idade)+' anos':'',tx(()=>pCidade(c))||c.cidade].filter(x=>x&&!/^[—\-\s]+$/.test(String(x))&&!/^[—\-\s]+ anos$/.test(String(x))).map(x=>esc(String(x))).join(' · ');
  const r=tx(()=>recomendanteDe(c));
  const bds=[`<span class="fu-bd" style="color:${corDe(fid,d.etapa_id)}">● ${esc(lbl(d.etapa_id))}</span>`,fuEhCliente(c)?'<span class="fu-bd v">Cliente · apólice ativa</span>':'',mfo&&c.linha?`<span class="fu-bd r">${esc(LINHA[c.linha]||c.linha)}</span>`:'',
    c.mercado?`<span class="fu-bd b">Mercado ${esc(c.mercado)}</span>`:'',i.alta?'<span class="fu-bd a">Alta renda</span>':'',r?`<span class="fu-bd">Rec. de ${esc(r.nome)}${r.cliente?' (cliente)':''}</span>`:'',bn?'<span class="fu-bd">Estoque</span>':'',i.cong?'<span class="fu-bd b">❄️ congelado</span>':'',i.delay?'<span class="fu-bd lj">⏳ Delay</span>':''].join('');
  const negs=negociosDe(c), drive=c.drive_pasta&&typeof urlSegura==='function'&&urlSegura(c.drive_pasta)!=='#'?urlSegura(c.drive_pasta):'';
  const opts=cfg(fid).map(e=>`<option value="${esc(e.id)}" ${e.id===d.etapa_id?'selected':''}>${esc(lbl(e.id))}${e.enc?' ✖':''}</option>`).join('');
  return `<div class="fu-pg-in">
   <div class="fu-pg-bar"><button type="button" class="btn btn-ghost fu-voltar" onclick="fuPainelFechar()" aria-label="Voltar ao funil">← Voltar</button><b class="fu-pg-nm">${esc(c.nome||'—')}</b><span class="fu-salvo" id="fu-salvo">Salvo ✓</span><button type="button" class="btn btn-ghost btn-mini fu-hide-m" onclick="fuPainelCheia()">${p.cheia?'⤡ Painel':'⤢ Tela cheia'}</button></div>
   <section class="fu-pc0"><div class="fu-pc-l"><h2>${esc(c.nome||'—')}</h2>${resumo?`<div class="fu-res">${resumo}</div>`:''}${tel.length||email?`<div class="fu-ct">${tel.map(t=>esc(typeof telBR==='function'?telBR(t):String(t))).join(' · ')}${tel.length&&email?' · ':''}${esc(email)}</div>`:''}
     ${fid==='vi'?starsHtml(c,i.ance):''}<div class="fu-bds">${bds}</div></div>
     <div class="fu-pc-a"><button type="button" class="btn btn-p" onclick="fuZap(event,'${j}')">💬 WhatsApp</button><button type="button" class="btn btn-ghost" onclick="fuLigar(event,'${j}')">☏ Ligar</button><button type="button" class="btn btn-ghost" onclick="fuAgendarModal('${j}','${mfo?'agendou_reuniao':'agendou_oi'}')">📅 Agendar</button>${drive?`<a class="btn btn-ghost" href="${esc(drive)}" target="_blank" rel="noopener">📁 Drive</a>`:''}<button type="button" class="btn btn-ghost" onclick="fuFichaCompleta('${j}')">✎ Ficha completa</button></div></section>
   <section class="fu-pc fu-et"><div class="fu-g2"><div class="fu-fld"><label for="fu-p-et">Etapa (${mfo?'MFO':'Vida Individual'})</label><select id="fu-p-et" onchange="fuMover('${j}',this.value)">${opts}</select></div>
     <div class="fu-fld"><span class="fu-lb">Próximo passo</span><div class="fu-calc" style="font-weight:500">${i.prox?`📅 ${esc(i.prox.tit||'Tarefa')} · ${esc(dataBR(i.prox.quando))}${i.prox.hora?' '+esc(i.prox.hora):''}`:i.enc||d.etapa_id===CLIENTE_COL[fid]?'—':'<span class="fu-av">⚠ nenhum</span>'}</div></div></div>
     <div class="mut">Último contato: ${i.ult?esc(ULT_LBL(i.ult.tipo)+' · '+dataBR(String(i.ult.quando).slice(0,10))):'nunca conversei'}${i.enc&&(c.motivo_perda||c.status)?' · encerrado: '+esc(c.motivo_perda||c.status):''}</div></section>
   <div class="fu-pg-cols"><div class="fu-pg-main">
     <section class="fu-pc fu-negs"><div class="fu-pch"><b>Negócios desta pessoa</b><span class="mut">${negs.length}</span></div>${negs.map(x=>negRow(x,x===c)).join('')}${negs.length===1?`<div class="mut" style="padding:0 2px">Só este por enquanto. Seguro auto, saúde, VG da empresa ou crédito entram como novo negócio no MFO.</div>`:''}</section>
     ${mfo?`<section class="fu-pc"><div class="fu-pch"><b>Ficha do negócio (MFO)</b></div>${mfoBlocos(c)}</section>`:viBlocos(c)}
     ${histHtml(c)}
   </div><aside class="fu-pg-side">${tarHtml(c)}${redeHtml(c)}${cartHtml(c)}${mfo?'':planosHtml(c)}</aside></div></div>`; }

function fuPainelRender(primeira){ const p=FU.pan; let pg=document.getElementById('fu-pg'), bd=document.getElementById('fu-pgbd');
  if(!p){ if(pg){ pg.classList.remove('on'); } if(bd) bd.hidden=true; return; }
  const c=fuAcha(p.id); if(!c){ fuPainelFechar(); return; }
  fuCss(); camRegistrar();
  if(!pg){ bd=document.createElement('div'); bd.id='fu-pgbd'; bd.className='fu-pgbd'; bd.hidden=true; bd.addEventListener('click',fuPainelFechar); document.body.appendChild(bd);
    pg=document.createElement('div'); pg.id='fu-pg'; pg.className='fu-pg'; pg.setAttribute('role','dialog'); pg.setAttribute('aria-modal','true'); pg.setAttribute('aria-label','Ficha'); document.body.appendChild(pg); }
  const st=primeira?0:pg.scrollTop, foco=document.activeElement&&pg.contains(document.activeElement)?document.activeElement.id:'';
  pg.innerHTML=painelHtml(c); pg.classList.toggle('cheia',!!p.cheia); bd.hidden=!!p.cheia&&!(window.matchMedia&&matchMedia('(max-width:760px)').matches);
  if(primeira){ pg.scrollTop=0; void pg.offsetWidth; pg.classList.add('on'); const v=pg.querySelector('.fu-voltar'); if(v) try{ v.focus({preventScroll:true}); }catch(_){} }
  else { pg.scrollTop=st; if(foco){ const f=document.getElementById(foco); if(f&&f.tagName!=='SELECT') try{ f.focus({preventScroll:true}); }catch(_){} } }
  pg.classList.add('on'); fichaObservar(); camSinc(); }
function fuPainelFechar(){ FU.pan=null; FU.unlock=null; const pg=document.getElementById('fu-pg'), bd=document.getElementById('fu-pgbd'); if(pg) pg.classList.remove('on'); if(bd) bd.hidden=true; camSinc(); }
function fuPainelCheia(){ if(!FU.pan) return; FU.pan.cheia=!FU.pan.cheia; panGravar({cheia:FU.pan.cheia}); fuPainelRender(); const pg=document.getElementById('fu-pg'); if(pg) pg.scrollTop=0; }
function fuHist(k){ FU.hf=k; FU.histN=30; fuPainelRender(); }
function fuNota(id){ const c=fuAcha(id), el=document.getElementById('fu-nota'), t=el?String(el.value||'').trim():''; if(!c) return; if(!t){ if(el) el.focus(); return; }
  interacoesDe(c).push({id:uid(),k:'nota',l:t,dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()}); salvar(); fuRepinta(); toast('Nota registrada no histórico',true); }
function fuTarFeita(cid,tid){ if(typeof window.tarConcluir==='function') window.tarConcluir(cid,tid); fuRepinta(); }
function fuTarNova(id){ const g=k=>(document.getElementById(k)||{}).value||''; const tipo=g('fu-t-tipo')||'follow', tit=g('fu-t-tit').trim(), d=g('fu-t-d')||hojeISO(), h=g('fu-t-h');
  if(typeof window.tarCriar!=='function') return; window.tarCriar(id,tipo,tit,d,h,'',60); fuRepinta(); }
/* a ficha de sempre abre por cima; quando ela fecha, o painel se redesenha com o que mudou */
function fuFichaCompleta(id){ if(typeof abrirContato==='function') abrirContato(id); }
let _obs=null;
function fichaObservar(){ if(_obs) return; const d=document.getElementById('drawer'); if(!d||typeof MutationObserver==='undefined') return;
  let estava=d.classList.contains('aberto');
  _obs=new MutationObserver(()=>{ const agora=d.classList.contains('aberto'); if(estava&&!agora&&FU.pan) setTimeout(()=>fuRepinta(),0); estava=agora; });
  _obs.observe(d,{attributes:true,attributeFilter:['class']}); }
/* voltar do Android: o painel e o modal do funil entram na pilha de camadas do app (FLUIDEZ-V1:VOLTAR) */
function camRegistrar(){ try{ if(typeof CAM_ORDEM==='undefined'||CAM_ORDEM.some(x=>x.n==='fu-painel')) return;
  const i=CAM_ORDEM.findIndex(x=>x.n==='ficha');
  CAM_ORDEM.splice(i<0?CAM_ORDEM.length:i+1,0,{n:'fu-painel',aberta:()=>!!FU.pan,fechar:()=>fuPainelFechar()});
  CAM_ORDEM.splice(i<0?0:i,0,{n:'fu-modal',aberta:()=>!!document.getElementById('fu-ov'),fechar:()=>fuFechar()}); }catch(_){} }
function camSinc(){ try{ if(typeof camSincronizar==='function') camSincronizar(); }catch(_){} }

/* ── gaveta de filtros, colunas, mais ── */
function filtrosHtml(){ const lista=fuLista(FU.fid), v=lista.filter(x=>fuPassa(x.c,x.i)).length, at=fAtivos().length;
  const donos=[...new Set(lista.map(x=>x.c._dono).filter(Boolean))], nCong=lista.filter(x=>x.i.cong).length;
  const sel=(id,lab,opts,val,fn)=>`<select class="fu-sel" id="${id}" aria-label="${lab}" onchange="${fn}(this.value)"><option value="">${lab}: todas</option>${opts.map(([k,t])=>`<option value="${esc(k)}" ${k===val?'selected':''}>${lab}: ${esc(t)}</option>`).join('')}</select>`;
  return `<h2>⚙ Filtros</h2>${GRUPOS.map(([g,ks])=>`<div class="fu-grp"><h3>${g}</h3><div class="fu-grid">${ks.filter(k=>FU.fid==='vi'||!SO_VI.includes(k)).map(k=>fcHtml(lista,k)).join('')}</div></div>`).join('')}
    <div class="fu-grp"><h3>Mais</h3><div class="fu-grid">${FU.fid==='mfo'?sel('fu-flin','Linha',['vg','prud_demais','mo'].map(k=>[k,LINHA[k]]),FU.linha,'fuLinha'):''}${sel('fu-forig','Origem',Object.entries(ORIGEM),FU.origem,'fuOrigem')}${donos.length>1?sel('fu-fdono','Dono',donos.map(d=>[d,donoNome(d)]),FU.dono,'fuDono'):''}${nCong||FU.cong?`<button type="button" class="fu-fc t-azul${FU.cong?' on':''}" onclick="fuCong();fuRefiltros()">❄️ Só congelados <span class="cn">${nCong}</span></button>`:''}</div></div>
    <div class="fu-grp"><h3>Filtros salvos</h3>${salvos().map((x,k)=>`<div class="fu-svrow"><span>${esc(x.n)}</span><button type="button" class="btn btn-ghost btn-mini" onclick="fuSalvoAplicar(${k})" aria-label="Aplicar ${esc(x.n)}">▶</button><button type="button" class="btn btn-ghost btn-mini" onclick="fuSalvoApagar(${k})" aria-label="Apagar ${esc(x.n)}">🗑</button></div>`).join('')||'<div class="sub" style="margin:0">Nenhum ainda.</div>'}
      <div class="fu-svnovo"><input type="text" id="fu-sv-n" maxlength="40" placeholder="${at?'Nome pro filtro atual (ex.: Quentes de Recife)':'Marque filtros acima pra salvar'}" ${at?'':'disabled'} aria-label="Nome do filtro salvo" onkeydown="if(event.key==='Enter')fuSalvoSalvar()"><button type="button" class="btn btn-ghost" ${at?'':'disabled'} onclick="fuSalvoSalvar()">💾 Salvar</button></div></div>
    <div class="acts" style="justify-content:space-between"><button type="button" class="btn btn-ghost" onclick="fuLimpar()">Limpar</button><button type="button" class="btn btn-p" onclick="fuFechar()">Ver ${v} card${v===1?'':'s'}</button></div>`; }
function fuFiltrosAbrir(){ fuModal(filtrosHtml(),true); }
function fuRefiltros(){ const md=document.querySelector('.fu-ov.fu-sheet .fu-md'); if(md) md.innerHTML=filtrosHtml(); }
function colsHtml(){ const fid=FU.fid, c=colsDe(fid);
  return `<h2>▥ Colunas (${c.ordem.length-c.ocultas.length}/${c.ordem.length})</h2><div class="sub" style="margin:0">Só pra você: cada usuário tem a sua ordem e esconde o que não usa. No PC também dá pra arrastar a alça ⠿ da coluna no quadro.</div>
    ${c.ordem.map((id,i)=>`<div class="fu-colrow"><label for="fu-cv-${esc(id)}"><input type="checkbox" id="fu-cv-${esc(id)}" ${c.ocultas.includes(id)?'':'checked'} onchange="fuColVer('${esc(jsq(id))}',this.checked)"> ${esc(lbl(id))}</label><button type="button" class="btn btn-ghost btn-mini" ${i?'':'disabled'} onclick="fuColMover(${i},-1)" aria-label="Subir">▲</button><button type="button" class="btn btn-ghost btn-mini" ${i===c.ordem.length-1?'disabled':''} onclick="fuColMover(${i},1)" aria-label="Descer">▼</button></div>`).join('')}
    <div class="acts" style="justify-content:space-between"><span style="display:flex;gap:8px;flex-wrap:wrap">${podeEditarEtapa()?'<button type="button" class="btn btn-ghost" onclick="fuEtapaNova()">＋ Nova etapa</button>':''}<button type="button" class="btn btn-ghost" onclick="fuColPadrao()">Restaurar padrão</button></span><button type="button" class="btn btn-p" onclick="fuFechar()">Pronto</button></div>`; }
function fuColunas(){ fuModal(colsHtml()); }
/* ── organizar a etapa no próprio quadro (sem ir em Configuração) ──
   ordem e esconder = de cada usuário (colunas); nome, cor, probabilidade e etapa nova = do funil (FUNIL_CFG, mesmo caminho do
   Funil & Etapas: funApply → app_settings.lp_funil_cfg; só quem administra grava, como lá). */
const podeEditarEtapa=()=>{ try{ return typeof souAdm==='function'?!!souAdm():true; }catch(_){ return false; } };
const COR_NOMES=[['cinza','Cinza'],['azul','Azul'],['amarelo','Amarelo'],['roxo','Roxo'],['verde','Verde'],['verm','Vermelho']];
function fuColMenu(ev,id){ const fid=FU.fid, c=colsDe(fid), k=c.ordem.indexOf(id), j=esc(jsq(id)), adm=podeEditarEtapa();
  fuMenu(ev,`<div class="mh">${esc(lbl(id))}</div>${adm?`<button type="button" onclick="fuFecharMenu();fuEtapaRenomear('${j}')">✎ Renomear</button><button type="button" onclick="fuFecharMenu();fuEtapaCor('${j}')">🎨 Cor e probabilidade</button>`:''}
    <button type="button" ${k>0?'':'disabled style="opacity:.5"'} onclick="fuFecharMenu();fuColLado('${j}',-1)">← Mover pra esquerda</button><button type="button" ${k<c.ordem.length-1?'':'disabled style="opacity:.5"'} onclick="fuFecharMenu();fuColLado('${j}',1)">Mover pra direita →</button>
    ${adm&&!ehEnc(fid,id)?`<button type="button" onclick="fuFecharMenu();fuEtapaNova('${j}')">＋ Nova etapa depois desta</button>`:''}<button type="button" onclick="fuFecharMenu();fuColEsconder('${j}')">🙈 Esconder (volta em Colunas)</button>`); }
function fuColLado(id,d){ const fid=FU.fid, c=colsDe(fid), k=c.ordem.indexOf(id), q=k+d; if(k<0||q<0||q>=c.ordem.length) return; [c.ordem[k],c.ordem[q]]=[c.ordem[q],c.ordem[k]]; colsGravar(fid,c); render(); }
function fuColPara(de,para){ const fid=FU.fid, c=colsDe(fid), a=c.ordem.indexOf(de), b=c.ordem.indexOf(para); if(a<0||b<0||a===b) return; c.ordem.splice(a,1); c.ordem.splice(b,0,de); colsGravar(fid,c); render(); toast(`${lbl(de)} mudou de lugar (só pra você)`,true); }
function fuColEsconder(id){ const fid=FU.fid, c=colsDe(fid); if(c.ordem.length-c.ocultas.length<=1){ toast('Fica pelo menos uma coluna',false); return; } if(!c.ocultas.includes(id)) c.ocultas.push(id); colsGravar(fid,c); render(); toast(`${lbl(id)} escondida · volta em ▥ Colunas`,true); }
const cfgArr=()=>{ const k=FK[FU.fid]; if(!Array.isArray(FUNIL_CFG[k])) FUNIL_CFG[k]=[]; return FUNIL_CFG[k]; };
function corBtns(atual){ return `<div class="fu-cores" role="radiogroup" aria-label="Cor">${COR_NOMES.map(([k,t])=>`<button type="button" role="radio" aria-checked="${k===atual}" aria-label="${t}" class="${k===atual?'on':''}" style="background:${COR[k]}" onclick="FU_STATE.cor='${k}';this.parentNode.querySelectorAll('button').forEach(b=>{b.classList.toggle('on',b===this);b.setAttribute('aria-checked',b===this);})"></button>`).join('')}</div>`; }
function fuEtapaNova(depois){ if(!podeEditarEtapa()) return; FU.cor='azul'; const fl=cfg(FU.fid).filter(e=>!e.enc), ult=fl.length?fl[fl.length-1].id:'';
  fuModal(`<h2>＋ Nova etapa · ${FU.fid==='mfo'?'MFO':'Vida Individual'}</h2>
    <div class="fu-fld"><label for="fu-ne-n">Nome da etapa</label><input type="text" id="fu-ne-n" maxlength="40" placeholder="ex.: Aguardando exame médico" onkeydown="if(event.key==='Enter')fuEtapaCriar()"></div>
    <div class="fu-g2"><div class="fu-fld"><label for="fu-ne-d">Depois de qual etapa</label><select id="fu-ne-d">${fl.map(e=>`<option value="${esc(e.id)}" ${e.id===(depois||ult)?'selected':''}>${esc(lbl(e.id))}</option>`).join('')}</select></div><div class="fu-fld"><label for="fu-ne-p">Probabilidade de virar apólice (%)</label><input type="number" id="fu-ne-p" inputmode="numeric" min="0" max="100" value="40"></div></div>
    <div class="fu-fld"><label for="fu-ne-t">Tipo</label><select id="fu-ne-t"><option value="fluxo">Etapa do caminho (entra no PA)</option><option value="enc">Encerramento (pede motivo, sai do PA)</option></select></div>
    <div class="fu-fld"><span class="fu-lb">Cor</span>${corBtns('azul')}</div>
    <div class="sub" style="margin:0">Entra direto no funil (a mesma lista do quadro, da Tabela, dos KPIs e da ficha) — sem ir em Configuração. Se um dia não servir mais, tira em Funil & Etapas, que move os cards antes.</div>
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuEtapaCriar()">Criar etapa</button></div>`);
  setTimeout(()=>{ const n=document.getElementById('fu-ne-n'); if(n) n.focus(); },30); }
function fuEtapaCriar(){ const g=k=>document.getElementById(k), nome=String((g('fu-ne-n')||{}).value||'').trim(); if(!nome){ toast('Dê um nome pra etapa',false); return; }
  const arr=cfgArr(); if(arr.some(e=>normKey(lbl(e.id))===normKey(nome))){ toast('Já existe uma etapa com esse nome',false); return; }
  let s=0; Object.keys(FUNIL_CFG).forEach(f=>(FUNIL_CFG[f]||[]).forEach(e=>{ const m=/^cst_(\d+)$/.exec(e&&e.id); if(m) s=Math.max(s,+m[1]); }));   /* código único em TODOS os funis (como o funAdd) */
  const enc=(g('fu-ne-t')||{}).value==='enc', nova={id:'cst_'+(s+1),label:nome,cor:FU.cor||'azul',prob:enc?0:Math.max(0,Math.min(100,+((g('fu-ne-p')||{}).value)||0)),enc};
  const dep=(g('fu-ne-d')||{}).value, k=arr.findIndex(e=>e.id===dep), kEnc=arr.findIndex(e=>e.enc);
  if(enc) arr.push(nova); else arr.splice(k>=0?k+1:(kEnc<0?arr.length:kEnc),0,nova);
  const c=colsDe(FU.fid), q=c.ordem.indexOf(dep); c.ordem=c.ordem.filter(x=>x!==nova.id); if(enc) c.ordem.push(nova.id); else c.ordem.splice(q>=0?q+1:c.ordem.length,0,nova.id); colsGravar(FU.fid,c);
  try{ funApply(); }catch(_){} fuFechar(); render(); toast(`Etapa “${nome}” criada`,true); }
function fuEtapaRenomear(id){ if(!podeEditarEtapa()) return; const j=esc(jsq(id));
  fuModal(`<h2>✎ Renomear etapa</h2><div class="fu-fld"><label for="fu-rn">Nome</label><input type="text" id="fu-rn" maxlength="40" value="${esc(lbl(id))}" onkeydown="if(event.key==='Enter')fuEtapaRenOk('${j}')"></div>
    <div class="sub" style="margin:0">Muda o nome no quadro, na Tabela, nos KPIs e na ficha. Os cards ficam onde estão.</div><div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuEtapaRenOk('${j}')">Salvar</button></div>`);
  setTimeout(()=>{ const n=document.getElementById('fu-rn'); if(n){ n.focus(); n.select(); } },30); }
function fuEtapaRenOk(id){ const v=String((document.getElementById('fu-rn')||{}).value||'').trim(); if(!v){ toast('Nome vazio não vale',false); return; }
  const e=cfgArr().find(x=>x.id===id); if(!e) return; if(cfgArr().some(x=>x!==e&&normKey(lbl(x.id))===normKey(v))){ toast('Já existe uma etapa com esse nome',false); return; }
  e.label=v; try{ funApply(); }catch(_){} fuFechar(); render(); toast('Etapa renomeada',true); }
function fuEtapaCor(id){ if(!podeEditarEtapa()) return; const e=cfgArr().find(x=>x.id===id)||{}, j=esc(jsq(id)); FU.cor=e.cor||'cinza';
  fuModal(`<h2>🎨 ${esc(lbl(id))}</h2><div class="fu-fld"><span class="fu-lb">Cor</span>${corBtns(FU.cor)}</div>${e.enc?'':`<div class="fu-fld"><label for="fu-cp">Probabilidade de virar apólice (%)</label><input type="number" id="fu-cp" inputmode="numeric" min="0" max="100" value="${esc(String(e.prob==null?10:e.prob))}"></div>`}
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuEtapaCorOk('${j}')">Salvar</button></div>`); }
function fuEtapaCorOk(id){ const e=cfgArr().find(x=>x.id===id); if(!e) return; e.cor=FU.cor||e.cor; const p=document.getElementById('fu-cp'); if(p&&!e.enc) e.prob=Math.max(0,Math.min(100,+p.value||0));
  try{ funApply(); }catch(_){} fuFechar(); render(); toast('Etapa atualizada',true); }
/* filtros salvos */
function fuSalvoAplicar(k){ const x=salvos()[k]; if(!x) return; FU.f=fIgual(x.f)?{}:Object.assign({},x.f); render(); fuRefiltros(); }
function fuSalvoApagar(k){ const x=salvos()[k]; if(!x) return; salvos().splice(k,1); salvosGravar(); render(); fuRefiltros(); toast(`Filtro “${x.n}” apagado`,true); }
function fuSalvoSalvar(){ const el=document.getElementById('fu-sv-n'), n=String(el&&el.value||'').trim(); if(!fAtivos().length){ toast('Marque algum filtro antes de salvar',false); return; }
  if(!n){ toast('Dê um nome pro filtro',false); if(el) el.focus(); return; } const f={}; fAtivos().forEach(k=>{ f[k]=true; }); salvos().push({n,f}); salvosGravar(); render(); fuRefiltros(); toast(`Filtro “${n}” salvo · aparece no topo`,true); }
/* ✓ do card: conclui o próximo passo (a tarefa aberta mais próxima) */
function fuFeito(id){ const c=fuAcha(id); if(!c) return; const t=(typeof proxTarefa==='function')?proxTarefa(c):null; if(!t||typeof window.tarConcluir!=='function'){ toast('Sem próximo passo pra concluir',false); return; }
  window.tarConcluir(c.id,t.id); fuRepinta(); }

function fuColVer(id,on){ const fid=FU.fid, c=colsDe(fid); if(on) c.ocultas=c.ocultas.filter(x=>x!==id); else if(c.ordem.length-c.ocultas.length>1) c.ocultas.push(id); else { toast('Fica pelo menos uma coluna',false); }
  colsGravar(fid,c); render(); const md=document.querySelector('.fu-ov .fu-md'); if(md) md.innerHTML=colsHtml(); }
function fuColMover(i,d){ const fid=FU.fid, c=colsDe(fid), j=i+d; if(j<0||j>=c.ordem.length) return; [c.ordem[i],c.ordem[j]]=[c.ordem[j],c.ordem[i]]; colsGravar(fid,c); render(); const md=document.querySelector('.fu-ov .fu-md'); if(md) md.innerHTML=colsHtml(); }
function fuColPadrao(){ const all=colsLer(); delete all[FU.fid]; colsGravar(FU.fid,{ordem:cfg(FU.fid).map(e=>e.id),ocultas:[]}); render(); const md=document.querySelector('.fu-ov .fu-md'); if(md) md.innerHTML=colsHtml(); }
function fuOrdemMenu(ev){ fuMenu(ev,`<div class="mh">Ordenar por</div>${ORDENS.map(([k,t])=>`<button type="button" onclick="fuFecharMenu();fuOrdem('${k}')">${FU.ordem===k?'✓ ':'　'}${t}</button>`).join('')}`); }
function fuMais(ev){ fuMenu(ev,`<div class="mh">Mais</div><button type="button" onclick="fuFecharMenu();fuColunas()">▥ Colunas</button><button type="button" onclick="fuFecharMenu();fuDesempenho()">📈 Desempenho por mercado</button><button type="button" onclick="fuFecharMenu();fuExportar()">⤓ Exportar planilha (.csv)</button><button type="button" onclick="fuFecharMenu();irPara('sitplan')">📋 SitPlan do dia</button><button type="button" onclick="fuFecharMenu();irPara('bn-recs')">🌳 Recomendações</button>`); }
function fuDesempenho(){ const fid=FU.fid, ordem=cfg(fid).map(e=>e.id), iOI=ordem.indexOf(fid==='vi'?'oi':'m_contato');
  const l=fuLista(fid).filter(x=>['recomendacao','lead','parceiro'].includes(x.c.origem_tipo));
  const grp=m=>{ const g=l.filter(x=>(x.c.mercado||null)===m), oi=g.filter(x=>{ const k=ordem.indexOf(x.i.d.etapa_id); return k>=iOI&&!x.i.enc||(Array.isArray(x.c.interacoes)&&x.c.interacoes.some(y=>y&&y.k==='etapa')); }).length, ap=g.filter(x=>fuEhCliente(x.c)||[CLIENTE_COL[fid],'entrega','apol_cancelada'].includes(x.i.d.etapa_id)).length; return [g.length,oi,ap]; };
  const pct=(a,b)=>b?Math.round(100*a/b)+'%':'—';
  fuModal(`<h2>📈 Desempenho por mercado</h2><div class="fu-tw"><table style="min-width:0"><thead><tr><th>Mercado</th><th>Recs</th><th>% fizeram OI</th><th>% viraram apólice</th></tr></thead><tbody>${[['X','Mercado X'],['Y','Mercado Y'],['Z','Mercado Z'],[null,'Sem classificar ⚠']].map(([m,t])=>{ const [n,oi,ap]=grp(m); return `<tr><td>${t}</td><td class="num">${n}</td><td class="num">${pct(oi,n)}</td><td class="num">${pct(ap,n)}</td></tr>`; }).join('')}</tbody></table></div>
    <div class="sub" style="margin:0">Conta recomendações, leads e parceiros deste funil. Quem ainda não tem mercado aparece em "Sem classificar".</div><div class="acts"><button type="button" class="btn btn-p" onclick="fuFechar()">Fechar</button></div>`); }
function fuExportar(){ const fid=FU.fid, l=fuOrdenar(fuLista(fid).filter(x=>fuPassa(x.c,x.i)));
  const q=v=>{ const s=String(v==null?'':v); const t=/^[=+\-@]/.test(s)?"'"+s:s; return /[;"\n\r]/.test(t)?'"'+t.replace(/"/g,'""')+'"':t; };
  const cab=['Nome','Etapa','Prob.','Recomendante','Profissão','Renda','Cidade','Tags','Mercado','Origem','Próximo passo'];
  const linhas=l.map(({c,i})=>[c.nome,lbl(i.d.etapa_id),prob(i.d.etapa_id)+'%',c.recomendante,c.profissao,c.renda||c.renda_estimada,c.cidade,c.tags,c.mercado,ORIGEM[c.origem_tipo]||'',i.prox?dataBR(i.prox.quando):''].map(q).join(';'));
  const blob=new Blob(['﻿'+[cab.join(';')].concat(linhas).join('\r\n')],{type:'text/csv;charset=utf-8'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`funil-${fid==='vi'?'vida-individual':'mfo'}-${hojeISO()}.csv`; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },500); }

/* ── modal e menu ── */
function fuModal(html,sheet){ fuFechar(); camRegistrar(); const ov=document.createElement('div'); ov.className='fu-ov'+(sheet?' fu-sheet':''); ov.id='fu-ov'; ov.innerHTML=`<div class="fu-md" role="dialog" aria-modal="true">${html}</div>`;
  ov.addEventListener('click',e=>{ if(e.target===ov) fuFechar(); }); document.body.appendChild(ov); const f=ov.querySelector('select,input,button'); if(f) try{ f.focus(); }catch(_){} camSinc(); }
function fuFechar(){ const o=document.getElementById('fu-ov'); if(o){ o.remove(); camSinc(); } }
let _menu=null;
function fuFecharMenu(){ if(_menu){ _menu.remove(); _menu=null; } }
function fuMenu(ev,html){ if(ev&&ev.stopPropagation) ev.stopPropagation(); fuFecharMenu(); const m=document.createElement('div'); m.className='fu-menu'; m.innerHTML=html; document.body.appendChild(m); _menu=m;
  const r=(ev&&ev.target&&ev.target.getBoundingClientRect)?ev.target.getBoundingClientRect():{left:20,bottom:80,top:80}, w=m.offsetWidth, h=m.offsetHeight;
  let x=Math.min(r.left,innerWidth-w-16), y=r.bottom+6; if(y+h>innerHeight-10) y=Math.max(10,r.top-h-6); m.style.left=Math.max(16,x)+'px'; m.style.top=y+'px';
  setTimeout(()=>document.addEventListener('click',function fora(e){ if(_menu&&!_menu.contains(e.target)){ fuFecharMenu(); } document.removeEventListener('click',fora); }),0); }
document.addEventListener('keydown',e=>{ if(e.key!=='Escape') return; if(_menu) fuFecharMenu(); else if(document.getElementById('fu-ov')) fuFechar(); else if(FU.pan&&!document.querySelector('#drawer.aberto')) fuPainelFechar(); });

/* ── ações da barra ── */
function fuFunil(fid){ if(FU.fid===fid) return; FU.f={}; FU.linha=''; FU.origem=''; FU.cong=false; FU.fid=fid; irPara(fid==='mfo'?'fu-mfo':'fu-vi'); }
function fuFiltro(k){ FU.f[k]=!FU.f[k]; render(); fuRefiltros(); }
function fuTirar(k){ if(k==='@origem') FU.origem=''; else if(k==='@dono') FU.dono=''; else if(k==='@linha') FU.linha=''; else FU.f[k]=false; render(); }
function fuLimpar(){ FU.f={}; FU.origem=''; FU.dono=''; FU.linha=''; render(); fuRefiltros(); }
function fuOrigem(v){ FU.origem=v; render(); fuRefiltros(); }
function fuDono(v){ FU.dono=v; render(); fuRefiltros(); }
function fuLinha(v){ FU.linha=v; render(); fuRefiltros(); }
function fuCong(){ FU.cong=!FU.cong; render(); }
function fuModo(m){ FU.modo=m; render(); }
function fuOrdem(o){ FU.ordem=o; render(); }
function fuEnc(id){ const k=FU.fid+':'+id; FU.enc[k]=!FU.enc[k]; if(FU.enc[k]) FU.tab[FU.fid]=id; render(); }
function fuTab(id){ FU.tab[FU.fid]=id; render(); }
function fuBusca(v){ FU.q=v; clearTimeout(_qT); _qT=setTimeout(()=>{ render(); const el=document.getElementById('fu-q'); if(el){ el.focus(); try{ el.setSelectionRange(el.value.length,el.value.length); }catch(_){} } },220); }

/* ── autotestes (rodam no lpSelfCheck do portão) ── */
function fuSelfTests(ok){
  const st=c=>fuDestino(c);
  ok('FUNIL-UNICO T3: o card do Funil LP mora na etapa do mapa (OI/FF → OI; Base: Clientes Ativos → Apólice Emitida; pipe MFO → MFO)', st({funil:'nn',etapa:'OI/FF'}).etapa_id==='oi'&&st({funil:'bc',etapa:'Clientes Ativos'}).etapa_id==='emitida'&&st({funil:'mfo',etapa:'Proposta'}).funil_id==='mfo');
  ok('FUNIL-UNICO T3: etapa movida à mão (sem equivalente no funil antigo) vale sobre o mapa', st({funil:'nn',etapa:'OI/FF',etapa_id:'revisita',funil_id:'vi',etapa_id_fonte:'manual'}).etapa_id==='revisita');
  ok('FUNIL-UNICO T3: nome do Estoque com TA cai em Novo', st({funil:'bn',ta_dia:'2026-10-01'}).etapa_id==='novo');
  ok('FUNIL-UNICO T3: volta pro funil antigo pela 1ª etapa equivalente (OI → OI/FF no LP; Revisita → TA/RC na Base; LP não tem Revisita)', fuVoltaLegado({funil:'nn',etapa:'TA'},'oi')==='OI/FF'&&fuVoltaLegado({funil:'bc',etapa:'Clientes Ativos'},'revisita')==='Contato Agenda/Revisita'&&fuVoltaLegado({funil:'nn',etapa:'TA'},'revisita')===null);
  ok('FUNIL-UNICO T3: quem já está numa etapa equivalente não é mexido (SitPlan continua SitPlan ao "mover" pra Novo)', fuVoltaLegado({funil:'nn',etapa:'SitPlan'},'novo')==='SitPlan');
  const c0={id:'fu-t',funil:'nn',etapa:'TA'}; fuSincLegado(c0);
  ok('FUNIL-UNICO T3: mexer na tela antiga atualiza o funil novo (gancho do logEtapa)', c0.etapa_id==='novo'&&c0.funil_id==='vi'&&c0.etapa_id_fonte==='mapa');
  const i=fuInfo({id:'x',funil:'nn',etapa:'P/C',tarefas:[],interacoes:[]},'vi'), i2=fuInfo({id:'y',funil:'nn',etapa:'P/C',tarefas:[{id:'t',tipo:'reuniao',quando:'2099-01-01',feito:null}]},'vi');
  ok('FUNIL-UNICO T3: sem tarefa aberta = ⚠ sem próximo passo; com tarefa = some o ⚠', i.semProx===true&&i2.semProx===false&&!!i2.prox);
  ok('FUNIL-UNICO T3: cliente ativo (Apólice Emitida) não fica laranja', fuInfo({id:'z',funil:'bc',etapa:'Clientes Ativos'},'vi').semProx===false);
  const _f=FU.f; FU.f={}; const L=[{c:{id:'a',mercado:'X',alta_renda:true},i:{d:{},ult:null}},{c:{id:'b',mercado:'X'},i:{d:{},ult:{tipo:'wa'}}},{c:{id:'c',mercado:'Y',alta_renda:true},i:{d:{},ult:null}}];
  L.forEach(x=>{ x.i.alta=x.c.alta_renda===true; x.i.cong=false; });
  FU.f.mx=true; const n=fuCount(L,'alta'); FU.f=_f;
  ok('FUNIL-UNICO T3: filtro conta a interseção (Mercado X + Alta Renda = 1)', n===1);
  ok('FUNIL-UNICO T3: colunas = TODAS as etapas de Funil & Etapas (fluxo de fábrica 9 na vida, 7 no MFO; encerramentos entram como coluna no fim)', (FUNIL_FAB.fu_vi||[]).filter(x=>!x[3]).length===9&&(FUNIL_FAB.fu_mfo||[]).filter(x=>!x[3]).length===7&&colsDe('vi').ordem.length===cfg('vi').length&&cfg('vi').filter(e=>e.enc).every(e=>colsDe('vi').ordem.includes(e.id)));
  /* GLOBAL-V1 (25/10): cara do Global — filtros na gaveta + salvos, organizar etapa no quadro, arrastar reordena */
  ok('FUNIL-GLOBAL: todo filtro tem rótulo, teste, tom e o grupo existe', Object.values(FILTROS).every(f=>f[0]&&typeof f[1]==='function'&&f[2])&&GRUPOS.every(([g,ks])=>ks.every(k=>FILTROS[k])));
  const _ff=FU.f, _fid=FU.fid; FU.fid='vi'; FU.f={quente:true,semprox:true,delay:false};
  const Lt=[{c:{id:'q1'},i:{quente:true,semProx:true,cong:false,d:{}}},{c:{id:'q2'},i:{quente:true,semProx:false,cong:false,d:{}}}];
  ok('FUNIL-GLOBAL: filtro salvo casa com o que está ligado (ignora os desligados) e conta certo', fIgual({semprox:true,quente:true})&&!fIgual({quente:true})&&contaSalvo(Lt,{quente:true,semprox:true})===1&&contaSalvo(Lt,{quente:true})===2&&salvos().length>=0);
  FU.f=_ff; FU.fid=_fid;
  const _o=FU.ordem; FU.ordem='livre'; const Lo=fuOrdenar([{c:{id:'a',fu_ord:2},i:{d:{}}},{c:{id:'b',fu_ord:0},i:{d:{}}},{c:{id:'c'},i:{d:{}}}]).map(x=>x.c.id).join(''); FU.ordem=_o;
  ok('FUNIL-GLOBAL: ordem manual (arrastar) respeita a posição gravada; sem posição vai pro fim', Lo==='bac');
  ok('FUNIL-GLOBAL: quadro tem ⋯ por coluna, alça ⠿ e Contato rápido no card (sem abrir/recolher tudo)', (()=>{ try{ const h=colHtml('vi','novo',[{c:{id:'zz1',nome:'Fulano',funil:'nn',etapa:'TA',tarefas:[],interacoes:[]},i:fuInfo({id:'zz1',nome:'Fulano',funil:'nn',etapa:'TA',tarefas:[],interacoes:[]},'vi')}]); return /fuColMenu/.test(h)&&/data-alca=/.test(h)&&/Contato rápido/.test(h)&&!/Abrir tudo|Recolher tudo/.test(h); }catch(e){ return false; } })());
  /* T4 */
  const A=x=>fuAnce(x);
  ok('FUNIL-UNICO T4: ANCE — nota das estrelas > critérios A·N·C·E > nota copiada na migração > automático', A({ance_manual:2,ance_manual_em:'2026-10-24T10:00:00Z',ance:{a:true,n:true,c:true}}).n===2&&A({ance:{a:true,n:true,c:true},ance_manual:1}).n===3&&A({ance_manual:4,ance_auto:1}).n===4&&A({ance_auto:3}).n===3&&A({ance_auto:3}).manual===false&&A({}).n===0);
  ok('FUNIL-UNICO T4: a nota das estrelas vale nas telas antigas (estrelasDe/isQuente) e "voltar aos critérios" a solta', typeof estrelasDe!=='function'||(estrelasDe({ance_manual:5,ance_manual_em:'x',ance:{a:true}})===5&&estrelasDe({ance_manual:null,ance_manual_em:null,ance:{a:true}})===1));
  const rv=fuResOpts({funil:'nn',etapa:'TA'},false), rm=fuResOpts({funil:'mfo',etapa:'Proposta'},false), rw=fuResOpts({funil:'nn',etapa:'TA'},true);
  ok('FUNIL-UNICO T4: ☏/💬 usam o vocabulário único do SitPlan (RESULTADOS); no MFO o agendamento é "reunião", sem OI/PC/C2', typeof RES_BY_K==='undefined'||(rv.every(k=>RES_BY_K[k])&&['agendou_oi','agendou_pc','agendou_c2','sem_interesse'].every(k=>rv.includes(k))&&!rv.some(k=>RES_BY_K[k].wa)&&rw.includes('whats_respondeu')&&rm.includes('agendou_reuniao')&&!rm.some(k=>/agendou_(oi|pc|c2)/.test(k))));
  /* T5 */
  let hv='', hm='', erro='';
  try{ hv=painelHtml({id:'fu-tv',nome:'Fulano de Tal',funil:'nn',etapa:'P/C',tarefas:[],interacoes:[{id:'i1',k:'lig_atendida',l:'Ligação atendida',dia:'2026-10-20'}],ance:{a:true}});
       hm=painelHtml({id:'fu-tm',nome:'Beltrano Silva',funil:'mfo',etapa:'Proposta',ramos:['credito','auto'],fecha_por:'Parceiro',tarefas:[],interacoes:[],mfo_ficha:{tipo:'PJ',coberturas:[{nome:'Incêndio'}],pendencias:[{t:'PDF',ok:false}]}}); }catch(e){ erro=String(e&&e.message||e); }
  ok('FUNIL-UNICO T5: ficha em painel desenha VI e MFO sem erro, com ← Voltar e ⤢ Tela cheia'+(erro?' — '+erro:''), !erro&&/← Voltar/.test(hv)&&/Tela cheia|⤡ Painel/.test(hv)&&/Qualificação/.test(hv)&&/Fact-find/.test(hv)&&/Ligação atendida/.test(hv)&&/Ficha do negócio \(MFO\)/.test(hm));
  ok('FUNIL-UNICO T5: MFO traz os blocos do histórico (Cliente, Este negócio, Prêmio, Coberturas, Campos do ramo, Cotações, Análise, Pendências); crédito tem campos próprios; ramo sem caso avisa', ['Cliente','Este negócio','Prêmio e remuneração','Coberturas','Campos do ramo','Cotações','Análise','Pendências do cliente'].every(t=>hm.includes('<span class="t">'+t+'</span>'))&&/Banco credor/.test(hm)&&/Ainda não há caso de Auto/.test(hm)&&/Razão social/.test(hm));
  ok('FUNIL-UNICO T5: bloco dobrável nasce fechado (sem escolha gravada não sai aberto) e sem abrir/recolher tudo (SEM-TUDO-V1)', ab('m-sem-escolha-gravada')===''&&!/Abrir tudo|Recolher tudo/.test(hm)&&/ontoggle="fuDobra/.test(hm));
}

Object.assign(W,{fuEstrela,fuAnceVoltar,fuAnceCrit,fuInfoPop,fuAgendarModal,fuAgendarOk,fuPainelRender,fuPainelFechar,fuPainelCheia,fuHist,fuNota,fuTarFeita,fuTarNova,fuFichaCompleta,
  fuMfoSet,fuMfoArr,fuMfoAdd,fuMfoDel,fuMfoRamo,fuMfoFecha,fuMfoReceita,fuMfoVenc,fuDobra,fuDobraTodas,fuAnce,fuRepinta});
Object.assign(W,{fuModal,fuColsDe:colsDe,fuColMenu,fuColLado,fuColPara,fuColEsconder,fuEtapaNova,fuEtapaCriar,fuEtapaRenomear,fuEtapaRenOk,fuEtapaCor,fuEtapaCorOk,fuSalvoAplicar,fuSalvoApagar,fuSalvoSalvar,fuFeito,fuOrdemMenu,fuSoltar});
Object.assign(W,{viewFunilNovo,fuSincLegado,fuSelfTests,fuPrefsSubir,fuPrefsAplicar,fuDestino,fuVoltaLegado,fuPopulacao,
  fuAbrir,fuMover,fuMotivoOk,fuMoverMenu,fuLigar,fuZap,fuRegistrar,fuDelay,fuFiltrosAbrir,fuColunas,fuColVer,fuColMover,fuColPadrao,fuMais,fuDesempenho,fuExportar,
  fuFechar,fuFecharMenu,fuFunil,fuFiltro,fuTirar,fuLimpar,fuOrigem,fuDono,fuLinha,fuCong,fuModo,fuOrdem,fuEnc,fuTab,fuBusca});
})();
