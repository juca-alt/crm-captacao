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
const GRUPOS=[['Ação',['semprox','ta','delay','nunca']],['Perfil',['quente','alta','niver','revisar']],['Mercado',['mx','my','mz','msem']],['Origem',['o_rec','o_lead','o_parc','o_cart']]];
const MOTIVOS_SUGESTAO=['Sem interesse','Já é cliente de outro LP','Sem renda / momento financeiro','Não atende mais','Saúde (não passa na análise)'];
const FU={fid:'vi',modo:'kanban',ordem:'rec',q:'',f:{},origem:'',dono:'',linha:'',enc:{},tab:{},cong:false,motivo:null};
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
function fuAnce(c){ const m=c.ance_manual; if(m!=null&&m!=='null'&&isFinite(+m)) return {n:+m,manual:true}; const a=c.ance_auto; if(a!=null&&isFinite(+a)) return {n:+a,manual:false};
  try{ const s=anceScore(c); if(s!=null) return {n:s,manual:true}; }catch(_){} return {n:0,manual:false}; }
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
const FILTROS={
  semprox:['⚠ Sem próximo passo',(c,i)=>i.semProx], ta:['Fazer TA',(c,i)=>i.ta], delay:['Delay',(c,i)=>i.delay], nunca:['Nunca conversei',(c,i)=>!i.ult],
  quente:['Quentes',(c,i)=>i.quente], alta:['Alta Renda',(c,i)=>i.alta], niver:['Aniversariantes do mês',(c,i)=>i.niver], revisar:['Pra revisar (mapa)',(c,i)=>i.d.revisao],
  mx:['X',c=>c.mercado==='X'], my:['Y',c=>c.mercado==='Y'], mz:['Z',c=>c.mercado==='Z'], msem:['sem mercado',c=>!c.mercado],
  o_rec:['Recomendação',c=>c.origem_tipo==='recomendacao'], o_lead:['Lead',c=>c.origem_tipo==='lead'], o_parc:['Parceiro',c=>c.origem_tipo==='parceiro'], o_cart:['Carteira',c=>c.origem_tipo==='carteira']};
function fuBate(c,q){ if(!q) return true; try{ if(funBuscaBate(c,q)) return true; }catch(_){}
  const n=normKey(q); return [lbl(fuDestino(c).etapa_id),c.cidade,c.renda,c.renda_estimada,c.tags,c.mercado?'mercado '+c.mercado:'',ORIGEM[c.origem_tipo]].some(x=>x!=null&&normKey(String(x)).includes(n)); }
function fuPassa(c,i,ignora){ if(!fuBate(c,FU.q)) return false;
  for(const k of Object.keys(FU.f)){ if(!FU.f[k]||k===ignora) continue; if(!FILTROS[k][1](c,i)) return false; }
  if(FU.origem&&c.origem_tipo!==FU.origem) return false;
  if(FU.dono&&(c._dono||'')!==FU.dono) return false;
  if(FU.linha&&c.linha!==FU.linha) return false;
  if(!FU.cong&&i.cong) return false;
  if(FU.cong&&!i.cong) return false;
  return true; }
function fuLista(fid){ return fuPopulacao(fid).map(c=>({c,i:fuInfo(c,fid)})); }
const ativos=()=>Object.keys(FU.f).filter(k=>FU.f[k]).map(k=>[k,FILTROS[k][0].replace(/^(X|Y|Z)$/,'Mercado $1')]).concat(FU.origem?[['@origem','Origem: '+(ORIGEM[FU.origem]||FU.origem)]]:[]).concat(FU.dono?[['@dono','Dono: '+donoNome(FU.dono)]]:[]).concat(FU.linha?[['@linha','Linha: '+LINHA[FU.linha]]]:[]);
const donoNome=e=>{ const s=String(e||''); return s? (s.split('@')[0].replace(/^./,x=>x.toUpperCase())) : '—'; };

/* ── colunas por usuário (ordem + ocultas) — sobe junto com as prefs do menu (lp_user_prefs) ── */
const COLS_CHAVE='crmlp_fu_cols_v1';
let COLS=null;
function colsLer(){ if(COLS) return COLS; try{ COLS=JSON.parse(localStorage.getItem(COLS_CHAVE)||'null')||{}; }catch(_){ COLS={}; } return COLS; }
function colsDe(fid){ const fluxo=cfg(fid).filter(e=>!e.enc).map(e=>e.id), p=colsLer()[fid]||{};
  const ordem=(Array.isArray(p.ordem)?p.ordem.filter(id=>fluxo.includes(id)):[]).concat(fluxo.filter(id=>!(p.ordem||[]).includes(id)));
  return {ordem,ocultas:(p.ocultas||[]).filter(id=>fluxo.includes(id))}; }
function colsGravar(fid,v){ const all=colsLer(); all[fid]=v; try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(all)); }catch(_){} try{ if(typeof navPrefsSubir==='function') navPrefsSubir(); }catch(_){} }
function fuPrefsSubir(){ return colsLer(); }
function fuPrefsAplicar(p){ if(p&&typeof p==='object'){ COLS=p; try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(p)); }catch(_){} } }

/* ── ordenar ── */
const ORDENS=[['rec','Mais recentes'],['ag','Data do próximo passo'],['prob','Prob. negócio'],['nome','Nome']];
function fuOrdenar(l){ const o=FU.ordem, ent=c=>{ try{ return (entradaFunil(c).iso)||''; }catch(_){ return ''; } };
  return l.slice().sort((A,B)=> o==='nome'?String(A.c.nome||'').localeCompare(String(B.c.nome||''),'pt-BR')
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
@media (max-width:760px){
  .fu-board{display:block}.fu-board .fu-col{display:none;width:100%}.fu-board .fu-col.vis{display:flex}
  .fu-tabs{display:flex}.fu-fc,.fu-sel,.fu-qa button,.fu-vt button,.fu-row .btn{min-height:44px}.fu-busca{min-height:44px;flex:1 1 0}
  .fu-busca input,.fu-md select,.fu-md input[type=text],.fu-sel{font-size:16px}
  .fu-ov.sheet{align-items:flex-end;padding:0}.fu-ov.sheet .fu-md{border-radius:16px 16px 0 0;max-height:88vh}
  .fu-row .fu-nova{flex:1}
}`; document.head.appendChild(s); }

/* ── desenho ── */
function fuCount(lista,k){ const fn=FILTROS[k][1]; return lista.filter(x=>fuPassa(x.c,x.i,k)&&fn(x.c,x.i)).length; }
function fcHtml(lista,k,curto){ const n=fuCount(lista,k), on=!!FU.f[k], t=FILTROS[k][0];
  return `<button type="button" class="fu-fc${on?' on':''}${!n&&!on?' zero':''}" onclick="fuFiltro('${k}')" aria-pressed="${on}">${esc(curto&&/^(X|Y|Z)$/.test(t)?t:(/^(X|Y|Z)$/.test(t)?'Mercado '+t:t))} <span class="cn">${n}</span></button>`; }
function cardHtml(x,fid){ const c=x.c,i=x.i, j=esc(jsq(c.id)), bn=c.funil==='bn';
  const st=i.delay?'⏳ Delay':i.ta?'📋 Fazer TA':i.ult?ULT_LBL(i.ult.tipo):'';
  let stars=''; for(let k=1;k<=5;k++) stars+=k<=i.ance.n?'<b>★</b>':'★';
  const bds=[fuEhCliente(c)?'<span class="fu-bd v">Cliente · apólice ativa</span>':'', c.mercado?`<span class="fu-bd b">Mercado ${esc(c.mercado)}</span>`:'',
    fid==='mfo'&&c.linha?`<span class="fu-bd r">${esc(LINHA[c.linha]||c.linha)}</span>`:'', c.origem_tipo?`<span class="fu-bd">${esc(ORIGEM[c.origem_tipo]||c.origem_tipo)}</span>`:'',
    bn?'<span class="fu-bd">Estoque</span>':'', i.alta?'<span class="fu-bd a">Alta renda</span>':'', i.esfriando?'<span class="fu-bd lj">❄ esfriando</span>':'', i.quente&&!i.enc?'<span class="fu-bd vm">🔥 quente</span>':'',
    i.d.revisao?'<span class="fu-bd a">revisar etapa</span>':'', i.cong?'<span class="fu-bd b">❄️ congelado</span>':''].join('');
  const px=i.prox?`<div class="fu-px">📅 ${esc(i.prox.tit||({reuniao:'Reunião',ligar:'Ligar',whats:'WhatsApp'}[i.prox.tipo]||'Tarefa'))} · ${esc(dataBR(i.prox.quando))}${i.prox.hora?' '+esc(i.prox.hora):''}</div>`:'';
  const renda=c.renda||c.renda_estimada; const pa=(typeof paDe==='function')?paDe(c):0;
  return `<article class="fu-card${i.semProx?' semprox':''}" draggable="true" data-id="${esc(c.id)}" onclick="fuAbrir('${j}')">
    <div class="fu-nome">${esc(c.nome||'—')}</div>
    ${fid==='vi'?`<div class="fu-stars${i.ance.manual?' man':''}" title="ANCE ${i.ance.n}/5 ${i.ance.manual?'(sua nota)':'(automático)'}">${stars}</div>`:''}
    <div class="fu-meta">${fid==='mfo'&&c.produto?`<span><b style="color:#334155">${esc(c.produto)}</b></span>`:''}${c.profissao?`<span>${esc(c.profissao)}</span>`:''}${c.cidade?`<span>${esc(c.cidade)}</span>`:''}${renda?`<span>R$ ${esc(String(Math.round((+String(renda).replace(/\D/g,'')||0)/1000)))} mil</span>`:''}${pa?`<span>PA ${esc(brlCurto(pa))}</span>`:''}</div>
    ${px}${st?`<span class="fu-st">${esc(st)}</span>`:''}${i.enc&&(c.motivo_perda||c.status)?`<span class="fu-st">✖ ${esc(c.motivo_perda||c.status)}</span>`:''}
    <div class="fu-bds">${bds}</div>
    ${i.semProx?'<div class="fu-av">⚠ Sem próximo passo</div>':''}
    <div class="fu-qa" onclick="event.stopPropagation()"><button type="button" onclick="fuLigar(event,'${j}')" title="Ligar">☏ Ligar</button><button type="button" onclick="fuZap(event,'${j}')" title="WhatsApp">💬 Zap</button><button type="button" onclick="fuDelay('${j}')" title="Delay (remarcou)">✕ Delay</button><button type="button" onclick="fuMoverMenu(event,'${j}')" title="Mover de etapa">⇄ Mover</button></div>
  </article>`; }
function colHtml(fid,id,itens){ const enc=ehEnc(fid,id), e=etapa(fid,id)||{}, cs=itens.map(x=>x.c);
  const sp=itens.filter(x=>x.i.semProx).length, pa=(typeof somaPA==='function')?somaPA(cs):0;
  const pos=id==='entrega';
  return `<section class="fu-col${enc?' enc':''}${(FU.tab[fid]||colsVis(fid)[0])===id?' vis':''}" data-etapa="${esc(id)}" aria-label="${esc(lbl(id))}">
    <div class="fu-col-h"><span style="width:9px;height:9px;border-radius:50%;background:${corDe(fid,id)}"></span><b>${esc(lbl(id))}</b><span class="qt">${itens.length}</span></div>
    <div class="fu-col-s">${enc?'<span>encerramento · fora do funil</span>':pos?'<span>📦 pós-venda · não soma no funil</span>':`<span>prob. ${prob(id)}%${sp?` · ⚠ ${sp} sem próximo passo`:''}</span>${pa?`<span class="pa">PA ${esc(brlCurto(pa))}</span>`:''}`}</div>
    ${itens.length?itens.map(x=>cardHtml(x,fid)).join(''):`<div class="fu-vazio">Nenhum card aqui${ativos().length||FU.q?' com estes filtros':''}</div>`}
  </section>`; }
function colsVis(fid){ const c=colsDe(fid); return c.ordem.filter(id=>!c.ocultas.includes(id)).concat(cfg(fid).filter(e=>e.enc&&FU.enc[fid+':'+e.id]).map(e=>e.id)); }
function topoHtml(){ const nVi=fuPopulacao('vi').length, nMf=fuPopulacao('mfo').length;
  return `<div class="fu-seg" role="tablist" aria-label="Funil"><button type="button" class="${FU.fid==='vi'?'on':''}" onclick="fuFunil('vi')">🎯 Vida Individual <span class="n">${nVi}</span></button><button type="button" class="${FU.fid==='mfo'?'on':''}" onclick="fuFunil('mfo')">🏢 MFO <span class="n">${nMf}</span></button></div>`; }
function barraHtml(){ const n=ativos().length;
  return `<div class="fu-tb"><div class="fu-row"><label class="fu-busca" for="fu-q">🔎 <input id="fu-q" type="search" placeholder="Buscar nome, cidade, profissão, etapa…" autocomplete="off" value="${esc(FU.q)}" oninput="fuBusca(this.value)"></label><button type="button" class="btn btn-ghost" onclick="fuFiltrosAbrir()">⚙ Filtros${n?` <span class="fu-cnt">${n}</span>`:''}</button></div>
    <div class="fu-row"><button type="button" class="btn btn-p fu-nova" onclick="openNovoContato()">＋ Novo negócio</button><span class="fu-vt" role="group" aria-label="Vista"><button type="button" class="${FU.modo==='kanban'?'on':''}" onclick="fuModo('kanban')" title="Kanban" aria-label="Kanban">▦</button><button type="button" class="${FU.modo==='tabela'?'on':''}" onclick="fuModo('tabela')" title="Tabela" aria-label="Tabela">☰</button></span><button type="button" class="btn btn-ghost fu-mais" onclick="fuMais(event)" aria-label="Mais opções">⋯</button></div></div>`; }
function rapidosHtml(lista){ const extra=ativos().filter(([k])=>!RAPIDOS.includes(k)), nCong=lista.filter(x=>x.i.cong).length;
  return `<div class="fu-q">${RAPIDOS.map(k=>fcHtml(lista,k)).join('')}${nCong||FU.cong?`<button type="button" class="fu-fc${FU.cong?' on':''}" onclick="fuCong()">❄️ Congelados <span class="cn">${nCong}</span></button>`:''}${extra.length?'<span class="fu-sep"></span>'+extra.map(([k,l])=>`<button type="button" class="fu-fc ativo" onclick="fuTirar('${esc(k)}')">${esc(l)} ✕</button>`).join(''):''}${ativos().length?`<button type="button" class="fu-fc txt" onclick="fuLimpar()">limpar</button>`:''}</div>`; }
function encHtml(fid,vis){ const enc=cfg(fid).filter(e=>e.enc); if(!enc.length) return '';
  return `<div class="fu-q"><span class="fu-fc txt">Encerrados:</span>${enc.map(e=>`<button type="button" class="fu-fc enc${FU.enc[fid+':'+e.id]?' on':''}" onclick="fuEnc('${esc(jsq(e.id))}')">${esc(lbl(e.id))} <span class="cn">${vis.filter(x=>x.i.d.etapa_id===e.id).length}</span></button>`).join('')}</div>`; }
function tabelaHtml(fid,vis){ const l=fuOrdenar(vis);
  return `<div class="fu-tw"><table><thead><tr><th><button type="button" class="btn-ghost" onclick="fuOrdem('nome')">Nome</button></th><th>Criado em</th><th><button type="button" class="btn-ghost" onclick="fuOrdem('prob')">Prob. ↓</button></th><th>Etapa</th><th>Recomendante</th><th>Profissão</th><th>Renda</th><th>Cidade</th><th>SitPlan</th><th>Tags</th><th>Observação</th><th>Mercado</th><th>Ações</th></tr></thead><tbody>
  ${l.map(({c,i})=>{ const j=esc(jsq(c.id)); let ent=''; try{ ent=entradaFunil(c).iso||''; }catch(_){}
    return `<tr><td><button type="button" class="btn-ghost" style="font-weight:600;text-align:left" onclick="fuAbrir('${j}')">${esc(c.nome||'—')}</button></td><td>${esc(dataBR(ent))}</td><td class="num">${prob(i.d.etapa_id)}%</td><td><span class="fu-bd" style="color:${corDe(fid,i.d.etapa_id)}">● ${esc(lbl(i.d.etapa_id))}</span></td><td>${esc(c.recomendante||'—')}</td><td>${esc(c.profissao||'—')}</td><td class="num">${esc(c.renda||c.renda_estimada||'—')}</td><td>${esc(c.cidade||'—')}</td><td>${esc(c.sitplan?dataBR(String(c.sitplan).slice(0,10)):'—')}</td><td>${esc(c.tags||'—')}</td><td>${esc(String(c.notas||'').slice(0,60)||'—')}</td><td>${esc(c.mercado||'—')}</td><td><button type="button" class="btn btn-ghost btn-mini" onclick="fuLigar(event,'${j}')">☏</button> <button type="button" class="btn btn-ghost btn-mini" onclick="fuZap(event,'${j}')">💬</button></td></tr>`; }).join('')}
  </tbody></table></div><div class="sub" style="margin-top:8px">${l.length} card(s) · mesmos filtros do Kanban · ⋯ exporta a planilha</div>`; }

function viewFunilNovo(fid){ fuCss(); if(fid) FU.fid=fid; fid=FU.fid;
  const lista=fuLista(fid), vis=lista.filter(x=>fuPassa(x.c,x.i)), cols=colsVis(fid);
  if(!cols.includes(FU.tab[fid])) FU.tab[fid]=cols[0];
  let body;
  if(FU.modo==='tabela') body=tabelaHtml(fid,vis);
  else body=`<div class="fu-tabs">${cols.map(id=>`<button type="button" class="${FU.tab[fid]===id?'on':''}" onclick="fuTab('${esc(jsq(id))}')">${esc(lbl(id))} · ${vis.filter(x=>x.i.d.etapa_id===id).length}</button>`).join('')}</div>
    <div class="fu-board" id="fu-board">${cols.map(id=>colHtml(fid,id,fuOrdenar(vis.filter(x=>x.i.d.etapa_id===id)))).join('')}</div>`;
  $('#main').innerHTML=`<div class="fu">${topoHtml()}${barraHtml()}${rapidosHtml(lista)}${encHtml(fid,lista.filter(x=>fuPassa(x.c,x.i)))}${body}</div>`;
  if(FU.modo==='kanban') fuWire(); }

/* ── arrastar (desktop) ── */
function fuWire(){ const b=document.getElementById('fu-board'); if(!b) return; let dragId=null;
  b.querySelectorAll('.fu-card').forEach(card=>{ card.addEventListener('dragstart',e=>{ dragId=card.dataset.id; card.classList.add('dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',dragId); }catch(_){} });
    card.addEventListener('dragend',()=>{ dragId=null; card.classList.remove('dragging'); b.querySelectorAll('.fu-col.drop').forEach(x=>x.classList.remove('drop')); }); });
  b.querySelectorAll('.fu-col').forEach(col=>{ col.addEventListener('dragover',e=>{ if(!dragId) return; e.preventDefault(); col.classList.add('drop'); });
    col.addEventListener('dragleave',e=>{ if(!col.contains(e.relatedTarget)) col.classList.remove('drop'); });
    col.addEventListener('drop',e=>{ e.preventDefault(); col.classList.remove('drop'); const id=dragId; dragId=null; if(id) fuMover(id,col.dataset.etapa); }); }); }

/* ── mover (com sincronia pro funil antigo) ── */
function fuMover(id,X,motivo){ const c=fuAcha(id), fid=FU.fid; if(!c||!etapa(fid,X)) return;
  const antes=fuDestino(c).etapa_id; if(antes===X) return;
  if(ehEnc(fid,X)&&!motivo){ fuMotivoAbrir(id,X); return; }
  const nome=String(c.nome||'').split(' ')[0]||'Card';
  if(c.funil==='bn'){   /* Estoque: vira contato do funil (mesmo caminho do "Agendou no TA") */
    const leg=fuVoltaLegado({funil:'nn'},X); const nc=(typeof bnLevarProFunil==='function')?bnLevarProFunil(c,leg||'TA'):null; if(!nc) return;
    if(!leg){ nc.funil_id=fid; nc.etapa_id=X; nc.etapa_id_fonte='manual'; }
    if(motivo) nc.motivo_perda=motivo; salvar(); render(); toast(`${nome} saiu do Estoque → ${lbl(X)}`,true); return; }
  const leg=fuVoltaLegado(c,X);
  if(leg&&leg!==c.etapa){ const de=c.etapa; c.etapa=leg; try{ funOrdemInserir(c,leg,null); }catch(_){} try{ logEtapa(c,de,leg); }catch(_){} }
  c.funil_id=fid; c.etapa_id=X; c.etapa_id_fonte=leg?'mapa':'manual';
  if(!leg) interacoesDe(c).push({id:uid(),k:'etapa_fu',l:`Etapa: ${lbl(antes)} → ${lbl(X)}`,de:antes,para:X,dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()});
  if(motivo){ c.motivo_perda=motivo; try{ if(leg&&etStatusOpts(c).includes(motivo)){ c.status=motivo; c.status_etapa=c.etapa; } }catch(_){} }
  if(X===CLIENTE_COL[fid]&&!fuEhCliente(c)) toast(`${nome}: não achei apólice ativa na carteira — vai como emitida manual`,false);
  else toast(`${nome}: ${lbl(antes)} → ${lbl(X)}${leg?'':' (só no funil novo: o antigo não tem essa etapa)'}`,true);
  salvar(); render(); }
function fuMotivoAbrir(id,X){ const c=fuAcha(id); if(!c) return; FU.motivo={id,X};
  const e=etapa(FU.fid,X)||{}, opts=[...new Set([...(Array.isArray(e.status)?e.status:[]),...(()=>{ try{ const l=fuVoltaLegado(c,X); return l?((FUNIL_CFG[etCfgKey(c.funil)]||[]).find(y=>y.id===l)||{}).status||[]:[]; }catch(_){ return []; } })(),...MOTIVOS_SUGESTAO])];
  fuModal(`<h2>Encerrar ${esc(String(c.nome||'').split(' ')[0])} em “${esc(lbl(X))}”</h2><div class="sub" style="margin:0">Sem motivo não encerra. A lista vem de Funil & Etapas (motivos da perda) + sugestões.</div>
    <div><label for="fu-mot" style="font-size:12px;color:var(--muted);font-weight:600">Motivo</label><select id="fu-mot" onchange="document.getElementById('fu-mot-out').hidden=this.value!=='__outro'"><option value="">— escolha o motivo —</option>${opts.map(m=>`<option>${esc(m)}</option>`).join('')}<option value="__outro">Outro…</option></select></div>
    <div id="fu-mot-out" hidden><input type="text" id="fu-mot-txt" placeholder="Escreva o motivo" maxlength="120" oninput="this.dataset.v=this.value"></div>
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuMotivoOk()">Encerrar</button></div>`); }
function fuMotivoOk(){ const m=FU.motivo; if(!m) return; const s=document.getElementById('fu-mot'); let v=s?s.value:'';
  if(v==='__outro') v=((document.getElementById('fu-mot-txt')||{}).value||'').trim();
  if(!v){ toast('Escolha o motivo pra encerrar',false); return; } fuFechar(); FU.motivo=null; fuMover(m.id,m.X,v); }
function fuMoverMenu(ev,id){ const c=fuAcha(id); if(!c) return; const at=fuDestino(c).etapa_id, j=esc(jsq(id));
  fuMenu(ev,`<div class="mh">Mover ${esc(String(c.nome||'').split(' ')[0])} para…</div>${cfg(FU.fid).map(e=>`<button type="button" onclick="fuFecharMenu();fuMover('${j}','${esc(jsq(e.id))}')"${e.id===at?' disabled style="opacity:.5"':''}>${e.id===at?'✓ ':''}${esc(lbl(e.id))}${e.enc?' ✖':''}</button>`).join('')}`); }

/* ── contato rápido (registra no histórico do card: o Painel TA e os KPIs leem dali) ── */
function fuTel(c){ try{ const t=(typeof pTels==='function'?pTels(c):[c.telefone])[0]; return String(t||c.telefone||''); }catch(_){ return String(c.telefone||''); } }
function fuLigar(ev,id){ const c=fuAcha(id); if(!c) return; const t=fuTel(c), d=t.replace(/\D/g,''), j=esc(jsq(id));
  if(!d){ toast('Sem telefone nesta ficha',false); return; }
  fuMenu(ev,`<div class="mh">☏ ${esc(String(c.nome||'').split(' ')[0])}</div><a href="tel:+${d.length<=11?'55'+d:d}">📞 Ligar agora</a><div class="tel">${esc(t)}</div><div class="mh">Como foi?</div>
    ${[['lig_atendida','☎ Atendeu'],['lig_nao_atendida','☎ Não atendeu'],['caixa_postal','📭 Caixa postal'],['sem_interesse','🚫 Sem interesse (encerra)']].map(([k,l])=>`<button type="button" onclick="fuRegistrar('${j}','${k}')">${l}</button>`).join('')}`); }
function fuZap(ev,id){ const c=fuAcha(id); if(!c) return; const d=fuTel(c).replace(/\D/g,''), j=esc(jsq(id));
  if(!d){ toast('Sem telefone nesta ficha',false); return; } const n=d.length<=11?'55'+d:d;
  fuMenu(ev,`<div class="mh">💬 ${esc(String(c.nome||'').split(' ')[0])} · nada é enviado sozinho</div><a href="https://wa.me/${n}" target="_blank" rel="noopener" onclick="fuRegistrar('${j}','wa',true)">Abrir conversa no WhatsApp</a>`); }
function fuRegistrar(id,k,silencioso){ fuFecharMenu(); const c=fuAcha(id); if(!c) return;
  if(k==='sem_interesse'){ const fim=cfg(FU.fid).find(e=>e.enc); interacoesDe(c).push({id:uid(),k,l:'🚫 Sem interesse',dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()}); if(fim) fuMover(id,fim.id,'Sem interesse'); return; }
  interacoesDe(c).push({id:uid(),k,l:K_CONTATO[k]||k,dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()});
  if(c.funil==='bn'){ try{ bnSalvar(); }catch(_){} } else salvar();
  if(!silencioso) toast(`${String(c.nome||'').split(' ')[0]}: ${K_CONTATO[k]||k} registrado`,true); render(); }
function fuDelay(id){ const c=fuAcha(id); if(!c||typeof negDelayMarcar!=='function') return;
  if(c.funil==='bn'){ toast('Nome do Estoque: traga pro funil antes de marcar delay',false); return; }
  if(negDelayAtivo(c)){ negDelayLimpar(c); salvar(); render(); toast('Delay tirado',true); return; }
  const ate=negDelayMarcar(c,null,''); salvar(); render(); toast(`⏳ Delay até ${dataBR(ate)} (o card some do "sem próximo passo" só se tiver tarefa)`,true); }

/* ── abrir a ficha (por enquanto a ficha de sempre; o painel novo é o T5) ── */
function fuAbrir(id){ const c=fuAcha(id); if(!c) return;
  if(c.funil!=='bn'){ abrirContato(c.id); return; }
  if(c.funil_contato_id&&(S.contatos||[]).some(x=>String(x.id)===String(c.funil_contato_id))){ abrirContato(c.funil_contato_id); return; }
  const j=esc(jsq(id));
  fuModal(`<h2>${esc(c.nome||'—')}</h2><div class="sub" style="margin:0">Este nome ainda mora no <b>Estoque</b> (está na lista de TA). Pra abrir a ficha completa ele vira contato do funil.</div>
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar();irPara('bn-estoque')">Ver no Estoque</button><button type="button" class="btn btn-p" onclick="fuFechar();bnPromover('${j}')">Trazer pro funil e abrir</button></div>`); }

/* ── gaveta de filtros, colunas, mais ── */
function filtrosHtml(){ const lista=fuLista(FU.fid), v=lista.filter(x=>fuPassa(x.c,x.i)).length;
  const donos=[...new Set(lista.map(x=>x.c._dono).filter(Boolean))];
  const sel=(id,lab,opts,val,fn)=>`<select class="fu-sel" id="${id}" aria-label="${lab}" onchange="${fn}(this.value)"><option value="">${lab}: todas</option>${opts.map(([k,t])=>`<option value="${esc(k)}" ${k===val?'selected':''}>${lab}: ${esc(t)}</option>`).join('')}</select>`;
  return `<h2>⚙ Filtros</h2>${GRUPOS.map(([g,ks])=>`<div class="fu-grp"><h3>${g}</h3><div class="fu-grid">${ks.map(k=>fcHtml(lista,k,g==='Mercado')).join('')}</div></div>`).join('')}
    <div class="fu-grp"><h3>Mais</h3><div class="fu-grid">${FU.fid==='mfo'?sel('fu-flin','Linha',['vg','prud_demais','mo'].map(k=>[k,LINHA[k]]),FU.linha,'fuLinha'):''}${sel('fu-forig','Origem',Object.entries(ORIGEM),FU.origem,'fuOrigem')}${donos.length>1?sel('fu-fdono','Dono',donos.map(d=>[d,donoNome(d)]),FU.dono,'fuDono'):''}</div></div>
    <div class="acts" style="justify-content:space-between"><button type="button" class="btn btn-ghost" onclick="fuLimpar()">Limpar</button><button type="button" class="btn btn-p" onclick="fuFechar()">Ver ${v} card${v===1?'':'s'}</button></div>`; }
function fuFiltrosAbrir(){ fuModal(filtrosHtml(),true); }
function fuRefiltros(){ const md=document.querySelector('.fu-ov.sheet .fu-md'); if(md) md.innerHTML=filtrosHtml(); }
function colsHtml(){ const fid=FU.fid, c=colsDe(fid);
  return `<h2>▥ Colunas (${c.ordem.length-c.ocultas.length}/${c.ordem.length})</h2><div class="sub" style="margin:0">Só pra você: cada usuário tem a sua ordem. Encerramentos ficam na linha "Encerrados".</div>
    ${c.ordem.map((id,i)=>`<div class="fu-colrow"><label for="fu-cv-${esc(id)}"><input type="checkbox" id="fu-cv-${esc(id)}" ${c.ocultas.includes(id)?'':'checked'} onchange="fuColVer('${esc(jsq(id))}',this.checked)"> ${esc(lbl(id))}</label><button type="button" class="btn btn-ghost btn-mini" ${i?'':'disabled'} onclick="fuColMover(${i},-1)" aria-label="Subir">▲</button><button type="button" class="btn btn-ghost btn-mini" ${i===c.ordem.length-1?'disabled':''} onclick="fuColMover(${i},1)" aria-label="Descer">▼</button></div>`).join('')}
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuColPadrao()">Restaurar padrão</button><button type="button" class="btn btn-p" onclick="fuFechar()">Pronto</button></div>`; }
function fuColunas(){ fuModal(colsHtml()); }
function fuColVer(id,on){ const fid=FU.fid, c=colsDe(fid); if(on) c.ocultas=c.ocultas.filter(x=>x!==id); else if(c.ordem.length-c.ocultas.length>1) c.ocultas.push(id); else { toast('Fica pelo menos uma coluna',false); }
  colsGravar(fid,c); render(); const md=document.querySelector('.fu-ov .fu-md'); if(md) md.innerHTML=colsHtml(); }
function fuColMover(i,d){ const fid=FU.fid, c=colsDe(fid), j=i+d; if(j<0||j>=c.ordem.length) return; [c.ordem[i],c.ordem[j]]=[c.ordem[j],c.ordem[i]]; colsGravar(fid,c); render(); const md=document.querySelector('.fu-ov .fu-md'); if(md) md.innerHTML=colsHtml(); }
function fuColPadrao(){ const all=colsLer(); delete all[FU.fid]; colsGravar(FU.fid,{ordem:cfg(FU.fid).filter(e=>!e.enc).map(e=>e.id),ocultas:[]}); render(); const md=document.querySelector('.fu-ov .fu-md'); if(md) md.innerHTML=colsHtml(); }
function fuMais(ev){ fuMenu(ev,`<div class="mh">Ordenar por</div>${ORDENS.map(([k,t])=>`<button type="button" onclick="fuFecharMenu();fuOrdem('${k}')">${FU.ordem===k?'✓ ':'　'}${t}</button>`).join('')}
  <div class="mh">Mais</div><button type="button" onclick="fuFecharMenu();fuColunas()">▥ Colunas</button><button type="button" onclick="fuFecharMenu();fuDesempenho()">📈 Desempenho por mercado</button><button type="button" onclick="fuFecharMenu();fuExportar()">⤓ Exportar planilha (.csv)</button><button type="button" onclick="fuFecharMenu();irPara('sitplan')">📋 SitPlan do dia</button><button type="button" onclick="fuFecharMenu();irPara('bn-recs')">🌳 Recomendações</button>`); }
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
function fuModal(html,sheet){ fuFechar(); const ov=document.createElement('div'); ov.className='fu-ov'+(sheet?' sheet':''); ov.id='fu-ov'; ov.innerHTML=`<div class="fu-md" role="dialog" aria-modal="true">${html}</div>`;
  ov.addEventListener('click',e=>{ if(e.target===ov) fuFechar(); }); document.body.appendChild(ov); const f=ov.querySelector('select,input,button'); if(f) try{ f.focus(); }catch(_){} }
function fuFechar(){ const o=document.getElementById('fu-ov'); if(o) o.remove(); }
let _menu=null;
function fuFecharMenu(){ if(_menu){ _menu.remove(); _menu=null; } }
function fuMenu(ev,html){ if(ev&&ev.stopPropagation) ev.stopPropagation(); fuFecharMenu(); const m=document.createElement('div'); m.className='fu-menu'; m.innerHTML=html; document.body.appendChild(m); _menu=m;
  const r=(ev&&ev.target&&ev.target.getBoundingClientRect)?ev.target.getBoundingClientRect():{left:20,bottom:80,top:80}, w=m.offsetWidth, h=m.offsetHeight;
  let x=Math.min(r.left,innerWidth-w-16), y=r.bottom+6; if(y+h>innerHeight-10) y=Math.max(10,r.top-h-6); m.style.left=Math.max(16,x)+'px'; m.style.top=y+'px';
  setTimeout(()=>document.addEventListener('click',function fora(e){ if(_menu&&!_menu.contains(e.target)){ fuFecharMenu(); } document.removeEventListener('click',fora); }),0); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape'){ if(_menu) fuFecharMenu(); else fuFechar(); } });

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
  ok('FUNIL-UNICO T3: colunas padrão = fluxo de Funil & Etapas (9 na vida, 7 no MFO)', cfg('vi').filter(e=>!e.enc).length===9&&cfg('mfo').filter(e=>!e.enc).length===7&&colsDe('vi').ordem.length===9);
}

Object.assign(W,{viewFunilNovo,fuSincLegado,fuSelfTests,fuPrefsSubir,fuPrefsAplicar,fuDestino,fuVoltaLegado,fuPopulacao,
  fuAbrir,fuMover,fuMotivoOk,fuMoverMenu,fuLigar,fuZap,fuRegistrar,fuDelay,fuFiltrosAbrir,fuColunas,fuColVer,fuColMover,fuColPadrao,fuMais,fuDesempenho,fuExportar,
  fuFechar,fuFecharMenu,fuFunil,fuFiltro,fuTirar,fuLimpar,fuOrigem,fuDono,fuLinha,fuCong,fuModo,fuOrdem,fuEnc,fuTab,fuBusca});
})();
