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
const GRUPOS=[['Quem toca',['toca_eu','toca_outro','toca_sem']],['Ação',['semprox','nunca','ta','delay','esfriando']],['Perfil',['quente','alta','niver','cliente','revisar']],['Origem',['o_rec','o_lead','o_parc','o_cart']],['Mercado',['mx','my','mz','msem']]];
const SO_VI=['quente','ta'];   /* ANCE e TA não existem no MFO */
const MOTIVOS_SUGESTAO=['Sem interesse','Já é cliente de outro LP','Sem renda / momento financeiro','Não atende mais','Saúde (não passa na análise)'];
const FU={fid:'vi',modo:'kanban',ordem:'livre',q:'',f:{},origem:'',dono:'',toca:'',linha:'',enc:{},tab:{},cong:false,motivo:null,et:{},ts:null,sel:{},dup:false,unir:null};
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
  if(c.funil==='fx') return {funil_id:'vi',etapa_id:(c._fx&&c._fx.etapa_id)||'emitida',revisao:false};   /* T3b: card fantasma (cliente da carteira sem ficha) */
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
function fuAcha(id){ id=String(id); return (S.contatos||[]).find(x=>x&&String(x.id)===id)||((typeof BN!=='undefined'&&BN.contatos)||[]).find(x=>x&&String(x.id)===id)||FX.cards.find(x=>String(x.id)===id)||null; }
function fuPopulacao(fid){ const out=[], noFunil=new Set((S.contatos||[]).map(x=>x&&String(x.id)));
  (S.contatos||[]).forEach(c=>{ if(!c||c.merged_into||!escVisivel(c)) return; if(fuDestino(c).funil_id===fid) out.push(c); });
  if(fid==='vi'&&typeof BN!=='undefined') (BN.contatos||[]).forEach(b=>{ if(!b||b.merged_into||!escVisivel(b)) return;
    if(b.funil_contato_id&&noFunil.has(String(b.funil_contato_id))) return;   /* já virou contato do funil: o card é o do funil */
    if(b.estagio==='descartado'||b.estagio==='fundido') return;
    if(!(b.etapa||(b.ta_dia&&b.ta_dia!=='null'))) return; out.push(b); });
  if(fid==='vi') FX.cards.forEach(x=>{ if(fxVisivel(x)) out.push(x); });   /* T3b */
  return out; }
/* ═══ T3b · CARDS FANTASMA (26/10, decisão dele "T3b A"): cliente da carteira com apólice viva e SEM ficha aparece na
   coluna Apólice Emitida, só leitura, com "＋ Criar ficha" (cartNovoNegocio → Base de Clientes). Vem da view
   vw_funil_cards (security_invoker: RLS de quem consulta). Sem login, ou view ainda não criada: não aparece nada. ── */
const FX={cards:[],em:0,carregando:false,erro:'',chave:''};
function fxVisivel(x){ try{ return !logado()||escRegOk({_dono:x._dono,lp:x.lp}); }catch(_){ return true; } }
function fxDeLinha(r){ const cc=((typeof CART!=='undefined'&&CART.clientes)||[]).find(k=>String(k.ref)===String(r.ref_id)&&(!k._dono||k._dono===r.dono));
  return {id:'fx:'+r.ref_id, funil:'fx', _fx:r, _dono:r.dono, lp:cc&&cc.lp, nome:r.nome||'—', telefone:r.telefone||'', email:r.email||'', idade:(r.extra&&r.extra.idade)||null,
    origem_tipo:'carteira', cliente_ativo:true, tarefas:[], interacoes:[]}; }
async function fxCarregar(forca){ if(typeof sb==='undefined'||!sb||typeof logado!=='function'||!logado()||FX.carregando) return;
  const k=(typeof escEu==='function'?escEu():'')+'|'+((typeof delegAtivo==='function'&&delegAtivo())||'');
  if(!forca&&FX.chave===k&&Date.now()-FX.em<10*60e3) return;
  FX.carregando=true;
  try{ const {data,error}=await sb.from('vw_funil_cards').select('fonte,ref_id,dono,nome,telefone,email,funil_id,etapa_id,origem_tipo,extra,criado_em').eq('fonte','carteira').limit(2000);
    if(error) throw error; FX.cards=(data||[]).map(fxDeLinha); FX.erro=''; }
  catch(e){ FX.cards=[]; FX.erro=String((e&&e.message)||e); }   /* view ainda não criada (o SQL é ele que roda) → quadro segue sem fantasmas */
  FX.em=Date.now(); FX.chave=k; FX.carregando=false;
  try{ if(typeof VIEW!=='undefined'&&VIEW==='fu-vi') render(); }catch(_){} }
function fxCriarFicha(id){ fuFecharMenu(); fuFechar(); const x=FX.cards.find(k=>k.id===String(id)); if(!x) return;
  const ref=x._fx.ref_id; let n=null;
  if(typeof cartNovoNegocio==='function'&&((typeof CART!=='undefined'&&CART.clientes)||[]).some(k=>String(k.ref)===String(ref))) n=cartNovoNegocio(ref,'bc');
  if(!n){ n={id:uid(),lp:(typeof escLpNovo==='function'?escLpNovo():undefined),nome:x.nome,sexo:'—',idade:x.idade,profissao:'—',telefone:x.telefone,email:x.email,estrelas:0,ance:null,
    etapa:'Clientes Ativos',funil:'bc',origem:'carteira',criadoEm:hojeISO(),taStatus:'—',taTentativas:0,notas:'',infoclient:{pessoais:false,familiar:false,financeiro:false,saude:false},recs:[],eventos:[],planos:[],interacoes:[],sitplan:null,pessoaId:ref};
    S.contatos.push(n); }
  n.origem_tipo='carteira'; n.cliente_ativo=true; try{ fuSincLegado(n); }catch(_){}
  FX.cards=FX.cards.filter(k=>k!==x); salvar(); toast(`${pn(n)}: ficha criada na Base de Clientes`,true); fuRepinta(); fuAbrir(n.id); }
function fxInfo(id){ const x=FX.cards.find(k=>k.id===String(id)); if(!x) return; const e=x._fx.extra||{}, j=esc(jsq(x.id));
  fuModal(`<h2>🛡 ${esc(x.nome)}</h2><div class="sub" style="margin:0 0 8px">Cliente da carteira <b>sem ficha</b> no CRM. Aparece aqui pra você não esquecer dele; vira negócio de verdade quando você criar a ficha.</div>
    <div class="fu-tw"><table style="min-width:0"><tbody>
      <tr><td>Apólices vivas</td><td class="num">${esc(e.n_apolices||'—')}</td></tr>
      <tr><td>Prêmio mensal</td><td class="num">${e.premio_mensal?esc(brlCurto(+e.premio_mensal)):'—'}${e.apolices_sem_premio?` <span class="sub">(${esc(e.apolices_sem_premio)} sem prêmio no relatório)</span>`:''}</td></tr>
      ${e.produtos?`<tr><td>Produtos</td><td>${esc(e.produtos)}</td></tr>`:''}
      ${x.telefone?`<tr><td>Telefone</td><td>${esc(tx(()=>telBR(x.telefone))||x.telefone)}</td></tr>`:''}
      ${x.idade?`<tr><td>Idade</td><td>${esc(x.idade)}</td></tr>`:''}
    </tbody></table></div>
    <div class="acts"><button type="button" class="btn btn-s" onclick="fuFechar()">Fechar</button><button type="button" class="btn btn-p" onclick="fxCriarFicha('${j}')">＋ Criar ficha</button></div>`); }

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
  toca_eu:['Comigo',c=>tocaLista(c).includes(eqEu()),'azul','👤'], toca_outro:['Com outra pessoa',c=>{ const l=tocaLista(c); return !!l.length&&!l.includes(eqEu()); },'roxo','👥'], toca_sem:['Ninguém marcado',c=>!tocaLista(c).length&&c.funil!=='bn'&&c.funil!=='fx','cinza','○'],
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
  if(FU.toca&&(FU.toca==='@sem'?!!tocaLista(c).length:!tocaLista(c).includes(FU.toca))) return false;
  if(FU.linha&&c.linha!==FU.linha) return false;
  if(!FU.cong&&i.cong) return false;
  if(FU.cong&&!i.cong) return false;
  return true; }
function fuLista(fid){ return fuPopulacao(fid).map(c=>({c,i:fuInfo(c,fid)})); }
const ativos=()=>Object.keys(FU.f).filter(k=>FU.f[k]&&FILTROS[k]).map(k=>[k,FILTROS[k][0]]).concat(FU.origem?[['@origem','Origem: '+(ORIGEM[FU.origem]||FU.origem)]]:[]).concat(FU.dono?[['@dono','Dono: '+donoNome(FU.dono)]]:[]).concat(FU.toca?[['@toca','Quem toca: '+(FU.toca==='@sem'?'ninguém':eqNome(FU.toca))]]:[]).concat(FU.linha?[['@linha','Linha: '+LINHA[FU.linha]]]:[]);
const donoNome=e=>{ const s=String(e||''); return s? (s.split('@')[0].replace(/^./,x=>x.toUpperCase())) : '—'; };

/* ── colunas por usuário (ordem + ocultas) — sobe junto com as prefs do menu (lp_user_prefs) ── */
const COLS_CHAVE='crmlp_fu_cols_v1';
let COLS=null;
function colsLer(){ if(COLS) return COLS; try{ COLS=JSON.parse(localStorage.getItem(COLS_CHAVE)||'null')||{}; }catch(_){ COLS={}; } return COLS; }
/* COLS-SEGUE-CFG-V1 (15/11, print dele: "UW EMISSAO é após o N — já mudei nas configurações e tentei arrastar, não muda").
   A ordem pessoal gravada ganhava SEMPRE da ordem do Funil & Etapas: ele arrumava lá e o quadro seguia na ordem velha.
   Agora a ordem pessoal guarda a "base" (a ordem do Funil & Etapas de quando foi feita). Mudou a ordem lá → o quadro passa a
   seguir a de lá (as ocultas continuam). Ordem pessoal antiga, sem base, também cede. Etapa nova entra no lugar dela no
   funil (depois da vizinha), não no fim. */
function colsDe(fid){ const todas=cfg(fid).map(e=>e.id), p=colsLer()[fid]||{}, b=Array.isArray(p.base)?p.base:null;
  const segue=!b||b.filter(id=>todas.includes(id)).join()!==todas.filter(id=>b.includes(id)).join();
  const ordem=segue?[]:(Array.isArray(p.ordem)?p.ordem.filter(id=>todas.includes(id)):[]);
  todas.forEach((id,k)=>{ if(ordem.includes(id)) return; let q=-1; for(let j=k-1;j>=0&&q<0;j--) q=ordem.indexOf(todas[j]); ordem.splice(q+1,0,id); });
  return {ordem,ocultas:(p.ocultas||[]).filter(id=>todas.includes(id))}; }
function colsGravar(fid,v){ const all=colsLer(); v.base=cfg(fid).map(e=>e.id); all[fid]=v; all._ts=Date.now(); try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(all)); }catch(_){} try{ if(typeof navPrefsSubir==='function') navPrefsSubir(); }catch(_){} }
function fuPrefsSubir(){ return colsLer(); }
/* filtros salvos (por usuário, junto das colunas → lp_user_prefs). Nascem com 4 de exemplo; ele apaga/cria na gaveta. */
const SALVOS_PADRAO=[{n:'🔥 Quentes sem próximo passo',f:{quente:true,semprox:true}},{n:'☏ Fazer TA',f:{ta:true}},{n:'⚠ Sem próximo passo',f:{semprox:true}},{n:'⏳ Delay',f:{delay:true}}];
function salvos(){ const a=colsLer(); if(!Array.isArray(a._salvos)) a._salvos=SALVOS_PADRAO.map(x=>({n:x.n,f:Object.assign({},x.f)})); return a._salvos; }
function salvosGravar(){ colsLer()._ts=Date.now(); try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(colsLer())); }catch(_){} try{ if(typeof navPrefsSubir==='function') navPrefsSubir(); }catch(_){} }
const fAtivos=()=>Object.keys(FU.f).filter(k=>FU.f[k]&&FILTROS[k]);
const fChaves=f=>Object.keys(f||{}).filter(k=>f[k]&&FILTROS[k]);
function fIgual(f){ const a=fAtivos().sort().join(), b=fChaves(f).sort().join(); return !!a&&a===b; }
function contaSalvo(lista,f){ const ks=fChaves(f).filter(k=>FU.fid==='vi'||!SO_VI.includes(k)); return lista.filter(x=>fuBate(x.c,FU.q)&&(FU.cong?x.i.cong:!x.i.cong)&&ks.every(k=>FILTROS[k][1](x.c,x.i))).length; }
/* o aparelho mexeu DEPOIS da cópia do servidor (subida que falhou, offline) → vale o aparelho, e sobe de novo; antes a
   cópia velha do servidor voltava por cima a cada abertura */
function fuPrefsAplicar(p){ if(!p||typeof p!=='object') return;
  if((+colsLer()._ts||0)>(+p._ts||0)){ try{ if(typeof navPrefsSubir==='function') navPrefsSubir(); }catch(_){} return; }
  COLS=p; try{ localStorage.setItem(COLS_CHAVE,JSON.stringify(p)); }catch(_){} }

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
.fu-col-h.pega{cursor:grab}.fu-col-h.pega:active{cursor:grabbing}.fu-col-h.pega .fu-alca{color:#94a3b8}
.fu-col.cai-e{box-shadow:-5px 0 0 -1px var(--primary)}.fu-col.cai-d{box-shadow:5px 0 0 -1px var(--primary)}
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
}
/* CARD-COMPLETO-V1 (26/10): as peças do card antigo dentro do card novo */
.fu-oq{font-size:12px;font-weight:600;color:#1e3a8a;margin-left:18px}
.fu-pills,.fu-cr,.fu-prev,.fu-cli,.fu-ft,.fu-card .bc-rev{margin-left:18px}
.fu-pills .nc-pills{display:flex;flex-wrap:wrap;gap:4px}.fu-pills .nc-pill{margin:0}
.fu-cr{display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center}
.fu-cr .rec-selo{margin-top:0}
.fu-ciclo{font-size:11px;font-weight:600}.fu-ciclo .tot{font-weight:400;color:var(--muted)}
.fu-val .vneg{margin:0}.fu-pa{color:#15803d;font-weight:600;font-size:12px}
.fu-prev{font-size:11px}
.fu-meta2 .tel{color:var(--muted);font-variant-numeric:tabular-nums}
.fu-ft{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
.fu-irm{font-size:11px;color:var(--muted)}
.fu-av{margin-left:auto;border:1px dashed #93c5fd;background:#eff6ff;color:#1d4ed8;border-radius:8px;font-size:12px;font-weight:600;padding:3px 9px;cursor:pointer;min-height:28px}
.fu-av:hover{border-style:solid}
.fu-taxa{font-weight:700;font-size:11.5px}
.fu-col-s .pd{font-weight:500;color:#5b6770}
@media (min-width:761px){.fu-board>.fu-col{flex:0 0 284px;width:284px;min-width:0;max-width:284px}}   /* COL-LARGURA-V1 (26/10, print dele: "uns cards largos, outros estreitos… mantém padrão"): toda coluna com a mesma largura */
.fu-card{min-width:0;max-width:100%;overflow-wrap:anywhere}
.fu-card .vneg,.fu-card .tarchip,.fu-card .nc-pill,.fu-card .rec-selo,.fu-card .fu-ciclo,.fu-card .badge,.fu-card .fu-bd,.fu-card .nnrec{white-space:normal;max-width:100%}
.fu-card .nc-pills,.fu-card .fu-cr,.fu-card .fu-ft{min-width:0;max-width:100%}
.fu-card .fu-l1{flex-wrap:wrap}.fu-card .fu-l1 .fu-nome{flex:1 1 150px}.fu-card .fu-l1 .nm{white-space:normal;overflow:visible}
.fu-card .fu-l1 .fu-avc{margin-left:auto}
.fu-toca{width:26px;height:26px;border-radius:50%;border:0;color:#fff;font-size:10.5px;font-weight:700;letter-spacing:.02em;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;cursor:pointer;padding:0}
.fu-toca.vazio{background:#fff;color:#94a3b8;border:1.5px dashed #cbd5e1;font-size:13px}
.fu-toca.mini{width:22px;height:22px;font-size:9.5px;margin-right:8px;vertical-align:middle;cursor:inherit}
.fu-toca{position:relative}   /* QUEM-TOCA-V2 (09/11): selo +N quando mais de uma pessoa toca */
.fu-toca-mais{position:absolute;right:-7px;bottom:-6px;min-width:16px;height:16px;padding:0 3px;border-radius:8px;background:#fff;color:#1e293b;border:1px solid #cbd5e1;font-size:9.5px;font-weight:800;line-height:14px;text-align:center;pointer-events:none}
.fu-toca.sug{background:#fff;color:var(--tc,#64748b);border:1.5px dashed var(--tc,#cbd5e1);opacity:.85}
.fu-card{position:relative}.fu-card:has(.fu-l1 .fu-toca) .fu-l1{padding-right:34px}
.fu-card .fu-l1 .fu-toca{position:absolute;top:8px;right:8px}   /* QUEM-TOCA-V2 (26/10, print dele "cadê a bolinha"): sempre no canto, como no Umbler */
@media (max-width:760px){.fu-card .fu-l1 .fu-toca{width:44px;height:44px;font-size:13px;top:4px;right:4px}.fu-card:has(.fu-l1 .fu-toca) .fu-l1{padding-right:50px}}
.fu-fx{border-style:dashed;background:#fbfdfb}.fu-fx .fu-meta2,.fu-fx .fu-cr,.fu-fx .fu-ft{margin-left:0}
.fu-col-s{flex-wrap:wrap;row-gap:1px}.fu-col-s>span:first-child{white-space:nowrap}.fu-col-s .fu-taxa{flex-basis:100%}
@media (max-width:760px){
  .fu-oq,.fu-pills,.fu-cr,.fu-prev,.fu-cli,.fu-ft,.fu-card .bc-rev{margin-left:0}
  .fu-card .nc-pill,.fu-card .tarchip,.fu-card .vneg[onclick],.fu-card .fu-ft .badge,.fu-av{min-height:44px;display:inline-flex;align-items:center}
  .fu-av{flex:1 0 100%;justify-content:center;font-size:14px}
}
/* QUADRO-ALTURA-V1 (03/11, print dele: coluna cortada no meio, títulos das colunas sumindo ao rolar, branco onde a coluna
   é curta e a barra de rolar de lado lá no fim da coluna mais comprida). Só no PC: o quadro ocupa a altura da tela, cada
   coluna rola sozinha com o título parado, a barra de lado fica sempre à vista e a rolagem de lado encaixa no começo de uma
   coluna. No celular nada muda (lá é uma coluna por vez, pelas abas). */
@media (min-width:761px){
  .fu-board.alt{overflow-x:auto;overflow-y:hidden;scroll-snap-type:x proximity;scroll-padding-left:12px}
  .fu-board.alt>.fu-col{max-height:100%;scroll-snap-align:start}
  .fu-board.alt>.fu-nova-col{scroll-snap-align:start}
  .fu-board.alt .fu-col-h,.fu-board.alt .fu-col-s{flex:0 0 auto}
  .fu-board.alt .fu-cards{overflow-y:auto;min-height:0;flex:1 1 auto;scrollbar-width:thin}
}
/* CF-ALINHA-V1 (03/11): sem próximo passo o ✓ some, mas o lugar dele fica — os ícones do Contato rápido não pulam de card pra card */
.fu-cf .fu-cf-v{display:inline-block;min-width:28px;min-height:30px}
@media (max-width:760px){.fu-cf .fu-cf-v{min-width:44px;min-height:44px}}
/* FOTO-WA-V1 */
.fu-foto{position:relative;display:inline-flex;align-items:center;justify-content:center;flex:0 0 auto;width:38px;height:38px;border-radius:50%;color:#fff;font-size:13px;font-weight:600;letter-spacing:.02em;overflow:hidden;user-select:none}
.fu-foto img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:50%;background:#e2e8f0}
.fu-foto.p{width:26px;height:26px;font-size:10px}.fu-foto.g{width:56px;height:56px;font-size:19px}
.fu-pc-id{display:flex;align-items:center;gap:12px;min-width:0}.fu-pc-id h2{min-width:0}
/* LISTA-GLOBAL-V1 */
.fu-lg{display:grid;grid-template-columns:216px minmax(0,1fr);gap:14px;padding:12px;align-items:start}
.fu-rail{display:flex;flex-direction:column;gap:2px;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:6px;position:sticky;top:calc(var(--fu-tb,0px) + 8px);max-height:calc(100vh - var(--fu-tb,0px) - 90px);overflow-y:auto}
.fu-rail button{display:flex;align-items:center;gap:8px;width:100%;min-height:38px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:#0f172a;font-size:14px;text-align:left;cursor:pointer}
.fu-rail button:hover{background:#f1f5f9}.fu-rail button.on{background:#e2e8f0;font-weight:600}
.fu-rail button.z{color:#94a3b8}.fu-rail .dot{width:8px;height:8px;border-radius:50%;flex:0 0 auto}.fu-rail button.z .dot{opacity:.45}
.fu-rail .nm{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.fu-rail .q{font-variant-numeric:tabular-nums;color:#64748b;font-size:13px}
.fu-lg-m{min-width:0}.fu-lg-ord{display:none}.fu-lg-pe{margin-top:8px}
.fu-lt table{min-width:980px}.fu-lt td{vertical-align:middle}.fu-lt tbody tr{cursor:pointer}
.fu-th{display:inline-flex;align-items:center;gap:4px;border:0;background:none;padding:2px 0;font:inherit;letter-spacing:inherit;text-transform:inherit;color:inherit;cursor:pointer;white-space:nowrap}
.fu-th span{color:#cbd5e1}.fu-th:hover,.fu-th.on{color:#0f172a}.fu-th.on span{color:var(--primary)}
.fu-pes{display:flex;align-items:center;gap:10px;min-width:210px}.fu-pes .tx{display:flex;flex-direction:column;min-width:0}
.fu-pes .nm{border:0;background:none;padding:0;font:inherit;font-weight:600;font-size:14px;color:#0f172a;text-align:left;cursor:pointer;overflow-wrap:anywhere}.fu-pes .nm:hover{text-decoration:underline}
.fu-pes .tel{font-size:12.5px;color:#475569;font-variant-numeric:tabular-nums}.fu-pes .tel i{color:#94a3b8}
.fu-stl{color:#cbd5e1;letter-spacing:1px;font-size:14px;white-space:nowrap}.fu-stl b{color:#f59e0b;font-weight:400}
.fu-lt .c-prob{white-space:nowrap}.fu-lt .c-prob .pc{margin-left:8px;font-size:12px;color:#64748b;font-variant-numeric:tabular-nums}
.fu-lt .c-et{white-space:nowrap}.fu-lt .c-et .fu-bd{display:block;width:max-content;margin:2px 0}
.fu-lt .c-px{min-width:150px;font-size:12.5px}.fu-lt .obs{min-width:160px;color:#475569}
.fu-lt .c-ac{white-space:nowrap}.fu-lt .c-ac button{min-width:32px;min-height:32px;border:1px solid var(--linha);border-radius:8px;background:#fff;cursor:pointer;margin-right:4px;font-size:14px}
.fu-lt .c-ac button:hover{background:#f1f5f9}.fu-lt tr.vz td{text-align:center;color:var(--muted);padding:28px 12px;cursor:default}
.fu-lg-tb{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:10px}
.fu-dupc{border:1px solid #f59e0b;background:#fffbeb;color:#92400e;border-radius:999px;min-height:36px;padding:0 14px;font-size:13px;font-weight:600;cursor:pointer}.fu-dupc.on{background:#fff;border-color:var(--linha);color:#0f172a}
.fu-selb{display:flex;flex-wrap:wrap;gap:8px;align-items:center;background:#0f172a;color:#fff;border-radius:12px;padding:6px 8px 6px 14px;font-size:13px;box-shadow:0 10px 28px rgba(15,23,42,.32);position:fixed;left:50%;transform:translateX(-50%);bottom:calc(var(--fu-bn,0px) + 16px);z-index:60;max-width:calc(100vw - 24px)}
.fu-lg.tem-sel{padding-bottom:76px}
.fu-selb button{min-height:34px;padding:0 12px;border-radius:8px;border:1px solid rgba(255,255,255,.28);background:transparent;color:#fff;font-size:13px;cursor:pointer}.fu-selb button.p{background:#fff;color:#0f172a;border-color:#fff;font-weight:600}.fu-selb button:disabled{opacity:.45;cursor:not-allowed}
.fu-lt .c-ck{width:36px;padding-right:0}.fu-ck{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;cursor:pointer}.fu-ck input{width:17px;height:17px;cursor:pointer;accent-color:#2563eb}
.fu-lt tr.sel td{background:#eff6ff}.fu-lt .c-ac .m{display:none}
.fu-tgs{display:flex;flex-wrap:wrap;gap:4px;margin-top:4px}
.fu-tg{display:inline-flex;align-items:center;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:999px;padding:1px 8px;font-size:11.5px;line-height:1.5;white-space:nowrap}
button.fu-tg{cursor:pointer;font-family:inherit}.fu-tg.add{border-style:dashed;border-color:#cbd5e1;background:transparent;color:#64748b;opacity:.6}.fu-lt tr:hover .fu-tg.add,.fu-tg.add:focus-visible{opacity:1;border-color:#64748b;color:#0f172a}
.fu-lt tr.grp td{background:#fffbeb;border-top:2px solid #fde68a;font-size:12.5px;color:#92400e;font-weight:600;cursor:default;padding:8px 12px}.fu-lt tr.grp td>span{margin-right:12px}
.fu-lt tr.grp .bt{display:inline-flex;flex-wrap:wrap;gap:6px}.fu-lt tr.grp button{min-height:32px;padding:0 10px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#0f172a;font-size:12.5px;cursor:pointer}.fu-lt tr.grp button.p{background:#0f172a;border-color:#0f172a;color:#fff}
.fu-menu.fu-tgm{width:290px;gap:2px}.fu-tgm-l{display:flex;flex-wrap:wrap;gap:6px;padding:4px 8px 8px}.fu-menu.fu-tgm .fu-tgm-l button{display:inline-flex;min-height:32px;padding:2px 10px;border:1px solid #c7d2fe;background:#eef2ff;color:#3730a3;border-radius:999px;font-size:12.5px}
.fu-menu.fu-tgm .fu-tgm-l button.on{background:#3730a3;border-color:#3730a3;color:#fff}.fu-tgm-v{padding:2px 10px 8px;font-size:12.5px;color:#94a3b8}
.fu-tgm-f{display:flex;gap:6px;padding:4px 8px 8px}.fu-tgm-f input{flex:1;min-width:0;min-height:36px;border:1px solid var(--linha);border-radius:8px;padding:0 10px;font-size:14px}
.fu-menu.fu-tgm .fu-tgm-f button{min-height:36px;border:1px solid var(--linha);border-radius:8px;padding:0 12px;font-weight:600}.fu-menu.fu-tgm .fu-tgm-ok{text-align:center;font-weight:600;border-top:1px solid var(--linha);border-radius:0 0 7px 7px;margin-top:2px}
.fu-unl{list-style:none;margin:12px 0;padding:0;display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow:auto}.fu-unl li{display:flex;gap:10px;align-items:center;border:1px solid var(--linha);border-radius:10px;padding:8px 10px}.fu-unl li.b{border-color:#93c5fd;background:#eff6ff}
.fu-unl .tx{display:flex;flex-direction:column;min-width:0;font-size:12.5px;color:#475569}.fu-unl .tx b{font-size:14px;color:#0f172a;overflow-wrap:anywhere}.fu-unl em{font-style:normal;color:#1d4ed8;font-weight:600}
.fu-unet{display:flex;align-items:center;gap:10px;font-size:13px;color:#334155}.fu-unet select{flex:1;min-width:0;min-height:38px;border:1px solid var(--linha);border-radius:8px;padding:0 10px;font-size:14px;background:#fff}
@media (max-width:760px){
  .fu-lg{display:block;padding:10px 12px 12px}
  .fu-rail{flex-direction:row;position:static;max-height:none;overflow-x:auto;overflow-y:hidden;padding:4px;margin-bottom:10px;-webkit-overflow-scrolling:touch;scrollbar-width:none}
  .fu-rail::-webkit-scrollbar{display:none}
  .fu-rail button{width:auto;flex:0 0 auto;min-height:44px;padding:0 12px;white-space:nowrap}.fu-rail .nm{overflow:visible}
  .fu-lg-ord{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:#475569}
  .fu-lg-ord select{flex:1;min-width:0;min-height:44px;font-size:16px;border:1px solid var(--linha);border-radius:10px;background:#fff;padding:0 10px}
  .fu-qd .fu-lt,.fu-lt{border:0;background:transparent;overflow:visible}
  .fu-lt table{min-width:0;width:100%;display:block}.fu-lt thead{display:none}.fu-lt tbody{display:flex;flex-direction:column;gap:8px}
  .fu-lt tbody tr{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 10px;align-items:center;background:#fff;border:1px solid var(--linha);border-radius:12px;padding:10px 12px}
  .fu-lt td{display:block;padding:0;border:0}.fu-lt td.x{display:none}.fu-lt tr:hover td{background:transparent}
  .fu-lt .c-nome{grid-column:1/-1;grid-row:1}.fu-pes{min-width:0}.fu-pes .nm{font-size:15px;min-height:44px;display:flex;align-items:center}.fu-pes .tel{margin-top:-8px}.fu-lt .fu-foto{width:44px;height:44px}
  .fu-lt .c-et{grid-column:1;grid-row:2;white-space:normal}.fu-lt .c-et .fu-bd{display:inline-block;margin:0 4px 2px 0}
  .fu-lt .c-prob{grid-column:2;grid-row:2;text-align:right}
  .fu-lt .c-px{grid-column:1/-1;grid-row:3;min-width:0}
  .fu-lt .c-ac{grid-column:1/-1;grid-row:4;display:flex;gap:8px;border-top:1px solid var(--linha);padding-top:8px;margin-top:2px}
  .fu-lt .c-ac button{flex:1;min-width:44px;min-height:44px;margin:0;font-size:17px}
  .fu-lt tr.vz{display:block}.fu-lt tr.vz td{padding:24px 8px}
  .fu-dupc{min-height:44px}.fu-selb{left:12px;right:12px;transform:none;bottom:calc(var(--fu-bn,0px) + 10px);padding:6px 8px}.fu-lg.tem-sel{padding-bottom:130px}.fu-selb b{flex:1 0 100%;padding:2px 4px}.fu-selb button{min-height:44px;flex:1}
  .fu-lt .c-nome{grid-column:1;grid-row:1}.fu-lt .c-ck{grid-column:2;grid-row:1;width:auto;align-self:start}.fu-ck{width:44px;height:44px}.fu-ck input{width:22px;height:22px}
  .fu-lt tbody tr.sel{border-color:#60a5fa;background:#eff6ff}.fu-lt tr.sel td{background:transparent}
  .fu-tg.add{display:none}.fu-lt .c-ac .m{display:block}.fu-tgs{margin-top:2px}
  .fu-lt tbody tr.grp{display:block;background:#fffbeb;border-color:#fde68a;margin-top:6px}.fu-lt tr.grp td{background:transparent;border:0;padding:0}.fu-lt tr.grp td>span{display:block;margin:0 0 8px}
  .fu-lt tr.grp .bt{display:flex}.fu-lt tr.grp button{min-height:44px;flex:1 1 auto;font-size:13px}
  .fu-menu.fu-tgm{width:calc(100vw - 32px);max-width:360px}.fu-menu.fu-tgm .fu-tgm-l button,.fu-menu.fu-tgm .fu-tgm-f button,.fu-menu.fu-tgm .fu-tgm-ok{min-height:44px}.fu-tgm-f input{min-height:44px;font-size:16px}
  .fu-unet select{min-height:44px;font-size:16px}
  .fu-foto.g{width:48px;height:48px;font-size:17px}
}
`; document.head.appendChild(s); }

/* ── desenho ── */
function fuCount(lista,k){ const fn=FILTROS[k][1]; return lista.filter(x=>fuPassa(x.c,x.i,k)&&fn(x.c,x.i)).length; }
function fcHtml(lista,k){ const n=fuCount(lista,k), on=!!FU.f[k], F=FILTROS[k];
  return `<button type="button" class="fu-fc t-${F[2]}${on?' on':''}${!n&&!on?' zero':''}" onclick="fuFiltro('${k}')" aria-pressed="${on}">${F[3]?F[3]+' ':''}${esc(F[0])} <span class="cn">${n}</span></button>`; }
/* ═══ CARD-COMPLETO-V1 (26/10) — pedido dele com o print do card antigo: "vê os cards do funil que tá separado… ciclo de tempo
   da oportunidade e outras informações, não deixa perder as informações, add ao formato novo… melhor unificar logo".
   O card novo passa a carregar TUDO que o card antigo (nnCard) mostrava, usando as MESMAS peças do app (mesmo clique, mesma
   regra): o que se vende, profissão · idade, telefone, status da etapa e lista de TA, selo da rec, ⏱️ tempo na etapa + idade
   da oportunidade, prêmio/mês · PA (padrão), probabilidade, previsão de fechamento/emissão, próxima atividade com atraso,
   apólices do cliente, "1 de N desta pessoa", temperatura, recs pedidas/colhidas e "→ próxima etapa" com desfazer.
   Nome do Estoque (ainda não é contato) fica com o card enxuto: as peças do funil antigo não valem pra ele. ── */
const diasEntre=(de,ate)=>{ const a=new Date(String(de).slice(0,10)+'T12:00:00').getTime(), b=new Date(String(ate||hojeISO()).slice(0,10)+'T12:00:00').getTime(); return isFinite(a)&&isFinite(b)?Math.max(0,Math.round((b-a)/864e5)):null; };
/* etapa do funil NOVO que um registro de histórico representa (k:'etapa_fu' já vem no id novo; o resto vem do funil antigo) */
function fuParaNovo(c,x){ if(!x||!x.para) return null; if(x.k==='etapa_fu') return x.para; try{ return mapearEtapa(c.funil||'nn',x.para).etapa_id; }catch(_){ return null; } }
/* ⏱️ tempo na etapa NOVA: a corrida mais recente de registros que caem nesta etapa (TA→SitPlan, que viram "Novo", não zeram o relógio) */
function fuCiclo(c,i){ if(!c||c.funil==='bn'||!i||i.enc) return null; const X=i.d.etapa_id;
  const mv=(Array.isArray(c.interacoes)?c.interacoes:[]).filter(x=>x&&x.dia&&x.para).slice().sort((a,b)=>String(a.dia+(a.ts||'')).localeCompare(String(b.dia+(b.ts||''))));
  let desde=null; for(let k=mv.length-1;k>=0;k--){ if(fuParaNovo(c,mv[k])===X) desde=mv[k].dia; else break; }
  let ent=null; try{ ent=entradaFunil(c).iso||null; }catch(_){}
  if(!desde) desde=mv.length?(tx(()=>cicloEntradaEtapa(c).iso)||mv[mv.length-1].dia):ent;
  if(!desde) return null;
  let pausa=0; try{ pausa=congDiasPausa(c,desde)||0; }catch(_){}
  const d=Math.max(0,(diasEntre(desde)||0)-pausa), tot=ent?diasEntre(ent):null;
  return {d,desde,tot:tot!=null&&tot>=d?tot:null}; }
function cicloHtml(c,i){ const k=fuCiclo(c,i); if(!k) return ''; const cor=k.d>=30?'var(--verm,#dc2626)':k.d>=14?'#b45309':'var(--muted)';
  return `<span class="fu-ciclo" style="color:${cor}" title="Na etapa ${esc(lbl(i.d.etapa_id))} desde ${esc(dataBR(k.desde))}${k.tot!=null?' · no funil há '+k.tot+' dia(s)':''}">⏱️ ${k.d===0?'entrou hoje':k.d+'d'} em ${esc(lbl(i.d.etapa_id))}${k.tot!=null&&k.tot>k.d?` · <span class="tot">${k.tot}d no funil</span>`:''}</span>`; }
/* "→ próxima etapa": a seguinte no Funil & Etapas (pula encerramentos e a Revisita, que é opcional) */
function fuProxCol(fid,X){ const fl=cfg(fid).filter(e=>!e.enc&&!/revisita/i.test(e.id)).map(e=>e.id), k=fl.indexOf(X); return k>=0&&k<fl.length-1?fl[k+1]:null; }
function fuAvancar(id,ev){ if(ev){ ev.stopPropagation(); ev.preventDefault(); } const c=fuAcha(id); if(!c) return; const d=fuDestino(c), px=fuProxCol(d.funil_id,d.etapa_id); if(!px) return;
  if(c.funil==='bn'){ fuMover(id,px); return; }
  if(!Array.isArray(c.interacoes)) c.interacoes=[];
  const snap={etapa:c.etapa,funil_id:c.funil_id,etapa_id:c.etapa_id,fonte:c.etapa_id_fonte,status:c.status,status_etapa:c.status_etapa,ord:c.ord,n:c.interacoes.length};
  fuMover(id,px,null,true);
  const msg=`${pn(c)}: ${lbl(d.etapa_id)} → ${lbl(px)}`;
  if(typeof toastDesfazer!=='function'){ toast(msg,true); return; }
  toastDesfazer(msg,()=>{ const v=fuAcha(id); if(!v) return;
    v.etapa=snap.etapa; v.funil_id=snap.funil_id; v.etapa_id=snap.etapa_id; v.etapa_id_fonte=snap.fonte;
    if(snap.status!=null) v.status=snap.status; if(snap.status_etapa!=null) v.status_etapa=snap.status_etapa; if(snap.ord!=null) v.ord=snap.ord;
    /* apaga o registro em vez de empilhar a volta: a % que passa lê o histórico — toque errado não é história do negócio */
    if(Array.isArray(v.interacoes)) v.interacoes.splice(snap.n);
    salvar(); fuRepinta(); toast('Desfeito',true); }); }
function cardHtml(x,fid){ const c=x.c,i=x.i, j=esc(jsq(c.id)), bn=c.funil==='bn', fx=c.funil==='fx', leg=!bn&&!fx;
  if(fx) return fxCardHtml(c,i);
  const pj=leg&&!!tx(()=>ehEmpresa(c)), mfo=leg&&!!tx(()=>mfoEh(c));
  const st=i.delay?'⏳ Delay':i.ta?'📋 Fazer TA':i.ult?ULT_LBL(i.ult.tipo)+(i.ult.quando?' · '+(diasEntre(i.ult.quando)===0?'hoje':diasEntre(i.ult.quando)+'d'):''):'';
  const cli=leg&&!pj?tx(()=>cliChipsHtml(clienteDe(c,{semNegocios:true}))):'';
  const temp=leg?tx(()=>tempChipHtml(c,true)):'';
  const bds=[fuEhCliente(c)&&!cli?'<span class="fu-bd v">Cliente</span>':'', c.mercado?`<span class="fu-bd t-${({X:'verde',Y:'amar',Z:'cinza'})[c.mercado]||'cinza'}">Mercado ${esc(c.mercado)}</span>`:'',
    fid==='mfo'&&c.linha?`<span class="fu-bd r">${esc(LINHA[c.linha]||c.linha)}</span>`:'', c.origem_tipo&&c.origem_tipo!=='recomendacao'?`<span class="fu-bd">${esc(ORIGEM[c.origem_tipo]||c.origem_tipo)}</span>`:'',
    bn?'<span class="fu-bd">Estoque</span>':'', i.alta?'<span class="fu-bd a">Alta renda</span>':'', i.esfriando?'<span class="fu-bd lj">❄ esfriando</span>':'', i.quente&&!i.enc&&c.temperatura!=='quente'?'<span class="fu-bd vm">🔥 quente</span>':'',
    i.d.revisao?'<span class="fu-bd a">revisar etapa</span>':'', i.cong?'<span class="fu-bd b">❄️ congelado</span>':''].join('');
  const renda=c.renda||c.renda_estimada, rv=renda?Math.round((+String(renda).replace(/\D/g,'')||0)/1000):0, pa=(typeof paDe==='function')?paDe(c):0;
  const oq=leg?tx(()=>negTitulo(c)):'', sub=[c.profissao&&c.profissao!=='—'?esc(c.profissao):'', c.idade?esc(c.idade)+'a':''].filter(Boolean).join(' · '), tel=fuTel(c);
  /* valor: o mesmo do card antigo (prêmio/mês · PA, "padrão" clicável, ou "definir prêmio"); MFO usa o valor do pipe MFO */
  const valor=!leg?(pa?`<span class="fu-pa">PA ${esc(brlCurto(pa))}</span>`:''):mfo?tx(()=>mfoCardValor(c)):(tx(()=>valorTag(c))||(i.enc?'':`<span class="vneg" style="opacity:.6;cursor:pointer" onclick="event.stopPropagation();abrirContatoPM('${j}')" title="Informar o prêmio mensal deste negócio">R$ definir prêmio</span>`));
  const prob=leg&&!mfo&&!i.enc?tx(()=>pmDe(c)?`<span class="vneg fu-prob" style="background:transparent;border:1px solid var(--linha);color:${probCor(probDe(c))}" title="Probabilidade de virar apólice${probManual(c)==null?' (padrão da etapa)':' (definida por você)'}">${probDe(c)}%${probManual(c)==null?'':' ✓'}</span>`:''):'';
  const prev=leg?tx(()=>{ const f=prevDe(c,'fech'), e=prevDe(c,'emis'); return f||e?`<div class="fu-prev" style="color:${prevVencida(f)?'var(--verm)':'var(--muted)'}" title="Previsão de fechamento · emissão">${f?'🎯 '+dataBR(f):''}${f&&e?' · ':''}${e?'📄 '+dataBR(e):''}</div>`:''; }):'';
  const tar=leg?tx(()=>{ const t=tarChipCard(c); return mfo?mfoCardTar(c,t):t; }):(i.prox?`<span class="fu-prox">📅 ${esc(dataBR(i.prox.quando))}${i.prox.hora?' '+esc(i.prox.hora):''}${i.prox.tit?' · '+esc(i.prox.tit):''}</span>`:'');
  const pills=leg&&!i.enc?tx(()=>novoOn('card-ta-status')?cardEtapaInfoHtml(c):etStatusChip(c)):(leg&&i.enc&&(c.motivo_perda||c.status)?`<span class="fu-st">✖ ${esc(c.motivo_perda||c.status)}</span>`:'');
  const irm=leg?tx(()=>{ const n=pessoaIrmaos(c).length; return n?`<span class="fu-irm" title="Esta pessoa tem ${n+1} oportunidades nos funis">👤 1 de ${n+1} desta pessoa</span>`:''; }):'';
  const recs=leg?tx(()=>{ const rp=recsPedidas(c), rc=(c.recs||[]).length; return rp||rc?`<span class="nnrec" title="Recomendações pedidas / coletadas">🤝 ${rc}/${rp||rc}</span>`:''; }):'';
  const px=!i.enc?fuProxCol(fid,i.d.etapa_id):null;
  return `<article class="fu-card${i.semProx?' semprox':''}" draggable="true" data-id="${esc(c.id)}" onclick="fuAbrir('${j}')">
    <div class="fu-l1"><span class="fu-alca" aria-hidden="true" title="Arraste pra mover ou reordenar">⠿</span><div class="fu-nome">${avatarHtml(c,'p',true)}<span class="nm">${pj?'🏢 ':''}${esc(c.nome||'—')}</span><button type="button" class="fu-i" onclick="event.stopPropagation();fuInfoPop(event,'${j}')" aria-label="Resumo de ${esc(c.nome||'')}">ⓘ</button></div>${i.semProx?'<span class="fu-avc" title="Sem próximo passo">⚠ Sem próx. passo</span>':''}${leg?tocaHtml(c):''}</div>
    ${oq?`<div class="fu-oq" title="O que se vende neste negócio">${esc(oq)}</div>`:''}
    ${fid==='vi'?starsHtml(c,i.ance):''}
    <div class="fu-meta2">${fid==='mfo'&&c.produto?`<b>${esc(c.produto)}</b>`:''}${sub?`<span>${sub}</span>`:''}${c.cidade||rv?`<span class="r"><span>${esc(c.cidade||'')}</span>${rv?`<span class="val" title="Renda">R$ ${rv} mil</span>`:''}</span>`:''}${tel?`<span class="tel">${esc(tx(()=>telBR(tel))||tel)}</span>`:''}</div>
    ${pills?`<div class="fu-pills">${pills}</div>`:''}
    ${leg?`<div class="fu-cr">${tx(()=>recSeloHtml(c,true))}${cicloHtml(c,i)}${tx(()=>typeof anxSeloHtml==='function'?anxSeloHtml(c):'')}${tx(()=>typeof frmSeloHtml==='function'?frmSeloHtml(c):'')}</div>`:''}
    ${valor||prob?`<div class="fu-cr fu-val">${valor}${prob}</div>`:''}
    ${prev}${leg?tx(()=>bcRevisitaHtml(c)):''}
    ${tar?`<div class="fu-cr fu-tar">${tar}</div>`:''}
    ${cli?`<div class="fu-cli">${cli}</div>`:''}
    ${st?`<span class="fu-st">${esc(st)}</span>`:''}
    ${bds?`<div class="fu-bds">${bds}</div>`:''}
    ${temp||recs||irm||px?`<div class="fu-ft" onclick="event.stopPropagation()">${temp}${recs}${irm}${px?`<button type="button" class="fu-av" onclick="fuAvancar('${j}',event)" title="Avançar para ${esc(lbl(px))} — dá pra desfazer">→ ${esc(lbl(px))}</button>`:''}</div>`:''}
    <div class="fu-cf" onclick="event.stopPropagation()"><span class="lb">Contato rápido</span>${i.prox?`<button type="button" onclick="fuFeito('${j}')" title="Feito (conclui o próximo passo)" aria-label="Feito">✓</button>`:'<span class="fu-cf-v" aria-hidden="true"></span>'}<button type="button" onclick="fuDelay('${j}')" title="Delay (remarcou)" aria-label="Delay">✕</button><button type="button" onclick="fuLigar(event,'${j}')" title="Ligar" aria-label="Ligar">☏</button><button type="button" onclick="fuZap(event,'${j}')" title="WhatsApp" aria-label="WhatsApp">💬</button><button type="button" onclick="fuMoverMenu(event,'${j}')" title="Mover de etapa" aria-label="Mover de etapa">⇄</button></div>
  </article>`; }
function fxCardHtml(c,i){ const j=esc(jsq(c.id)), e=c._fx.extra||{}, tel=fuTel(c);
  return `<article class="fu-card fu-fx" data-id="${esc(c.id)}" onclick="fuAbrir('${j}')">
    <div class="fu-l1"><div class="fu-nome"><span class="nm">${esc(c.nome)}</span></div></div>
    <div class="fu-meta2">${c.idade?`<span>${esc(c.idade)}a</span>`:''}${tel?`<span class="tel">${esc(tx(()=>telBR(tel))||tel)}</span>`:''}</div>
    <div class="fu-cr"><span class="fu-bd v">🛡 ${esc(e.n_apolices||1)} apólice${+e.n_apolices>1?'s':''}${e.premio_mensal?' · '+esc(brlCurto(+e.premio_mensal))+'/mês':''}</span><span class="fu-bd lj">sem ficha no CRM</span></div>
    <div class="fu-ft" onclick="event.stopPropagation()"><button type="button" class="fu-av" onclick="fxCriarFicha('${j}')" title="Cria a ficha na Base de Clientes (cliente ativo)">＋ Criar ficha</button></div>
    <div class="fu-cf" onclick="event.stopPropagation()"><span class="lb">Contato rápido</span>${tel?`<button type="button" onclick="fuLigar(event,'${j}')" title="Ligar" aria-label="Ligar">☏</button><button type="button" onclick="fuZap(event,'${j}')" title="WhatsApp" aria-label="WhatsApp">💬</button>`:''}</div>
  </article>`; }
/* ═══ QUEM-TOCA-V1 (26/10) — pedido dele com o print do Umbler Talk: "nos cards deixa um campo pra eu marcar as que o
   Victor vai andar ou eu assumo". Bolinha com a sigla (GJ · VF) no card; tocar escolhe quem toca (c.toca = e-mail) e grava
   no histórico. A equipe (nome, sigla, cor e quem trabalha em cada base) mora em app_settings.equipe — só o admin edita,
   todos leem. Sem a configuração, a sigla sai do nome do perfil/e-mail. ── */
const EQ={m:{},times:{},em:0};
const eqEu=()=>{ try{ return (typeof escEu==='function'&&escEu())||''; }catch(_){ return ''; } };
async function eqCarregar(){ if(EQ.em||typeof sb==='undefined'||!sb||typeof logado!=='function'||!logado()) return; EQ.em=Date.now();
  try{ const {data}=await sb.from('app_settings').select('valor').eq('chave','equipe').maybeSingle(); const v=(data&&data.valor)||{}; EQ.m=v.membros||{}; EQ.times=v.times||{};
    if(typeof VIEW!=='undefined'&&(VIEW==='fu-vi'||VIEW==='fu-mfo')) render(); }catch(_){} }
function eqNome(e){ const m=EQ.m[e]; if(m&&m.nome) return m.nome; try{ if(PERFIL&&PERFIL.email===e&&PERFIL.nome) return PERFIL.nome; }catch(_){}
  const s=String(e||''); return s.includes('@')?s.split('@')[0]:s.replace(/(^|\s)\S/g,x=>x.toUpperCase()); }   /* parceiro de fora (joint) é guardado pelo nome */
/* TOCA-PESSOAS-V1 (15/11, pedido dele: "add nos filtros o Rodrigo nos casos de joint… deixa o nome dos outros usuários ou
   parceiros envolvidos e vou filtrando"). Parceiro de fora da equipe (não tem conta) entra pelo NOME em "quem toca"; quem já
   foi marcado em algum card aparece no menu de todos os cards e vira chip no filtro. */
function tocaFora(){ const s=new Set(); (S.contatos||[]).forEach(c=>tocaLista(c).forEach(e=>{ if(!e.includes('@')) s.add(e); })); return [...s].sort(); }
function tocaPessoas(lista){ const eu=eqEu(), m=new Map(); lista.forEach(x=>tocaLista(x.c).forEach(e=>{ if(e!==eu) m.set(e,0); }));
  (EQ.times[eu]||[]).concat(tocaFora()).forEach(e=>{ e=String(e||'').toLowerCase(); if(e&&e!==eu&&!m.has(e)) m.set(e,0); });
  if(FU.toca&&FU.toca!=='@sem'&&!m.has(FU.toca)) m.set(FU.toca,0);
  const t=FU.toca; FU.toca=''; try{ lista.forEach(x=>{ if(fuPassa(x.c,x.i)) tocaLista(x.c).forEach(e=>{ if(m.has(e)) m.set(e,m.get(e)+1); }); }); }finally{ FU.toca=t; }
  return [...m].sort((a,b)=>b[1]-a[1]||eqNome(a[0]).localeCompare(eqNome(b[0]))); }
function tocaChips(lista){ return tocaPessoas(lista).map(([e,n])=>{ const on=FU.toca===e;
  return `<button type="button" class="fu-fc t-roxo${on?' on':''}${!n&&!on?' zero':''}" onclick="fuTocaF('${on?'':esc(jsq(e))}')" aria-pressed="${on}" title="Só o que ${esc(eqNome(e))} toca"><span class="fu-toca mini" style="background:${eqCor(e)};margin-right:0">${esc(eqSigla(e))}</span>${esc(eqNome(e))} <span class="cn">${n}</span></button>`; }).join(''); }
function fuTocaOutro(id){ const j=esc(jsq(id));
  fuModal(`<h2>＋ Parceiro de fora da equipe</h2><div class="fu-fld"><label for="fu-tp-n">Nome</label><input type="text" id="fu-tp-n" maxlength="40" placeholder="ex.: Rodrigo" autocomplete="off" onkeydown="if(event.key==='Enter')fuTocaOutroOk('${j}')"></div>
    <div class="sub" style="margin:0">Pra quem toca o negócio junto e não tem conta aqui (joint). Depois de marcado uma vez, o nome aparece no menu dos outros cards e nos Filtros.</div>
    <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuTocaOutroOk('${j}')">Marcar</button></div>`);
  setTimeout(()=>{ const n=document.getElementById('fu-tp-n'); if(n) n.focus(); },30); }
function fuTocaOutroOk(id){ const v=String((document.getElementById('fu-tp-n')||{}).value||'').replace(/[@,]/g,' ').replace(/\s+/g,' ').trim().toLowerCase(); if(!v){ toast('Escreva o nome',false); return; }
  const c=fuAcha(id); fuFechar(); if(!c) return; const ja=Object.keys(EQ.m).find(e=>normKey(eqNome(e))===normKey(v))||v;   /* digitou o nome de alguém da equipe → marca a pessoa da equipe */
  if(tocaLista(c).includes(ja)){ toast(`${eqNome(ja)} já está marcado`,true); return; } fuToca(id,ja); }
function eqSigla(e){ const m=EQ.m[e]; if(m&&m.sigla) return m.sigla; const p=String(eqNome(e)).replace(/[._-]+/g,' ').trim().split(/\s+/); return (((p[0]||'?')[0]||'?')+((p[1]||'')[0]||'')).toUpperCase(); }
function eqCor(e){ const m=EQ.m[e]; if(m&&m.cor) return m.cor; const pal=['#2563eb','#7c3aed','#0d9488','#c2410c','#be185d']; let h=0; for(const ch of String(e)) h=(h*31+ch.charCodeAt(0))>>>0; return pal[h%pal.length]; }
/* QUEM-TOCA-V2 (09/11/2026): palavra dele "deixa eu marcar mais de um usuário — ela e o Victor, ou ela e alguém".
   c.tocas = lista completa (e-mails, na ordem em que foram marcados); c.toca continua = o 1º da lista (compatível com
   tudo que já lia c.toca). Card antigo sem c.tocas vale [c.toca]. */
function tocaLista(c){ if(!c) return []; const l=Array.isArray(c.tocas)?c.tocas:(c.toca?[c.toca]:[]); return [...new Set(l.map(x=>String(x||'').toLowerCase()).filter(Boolean))]; }
function eqTime(c){ const dono=(c&&c._dono)||eqEu(); return [...new Set([dono].concat(EQ.times[dono]||[]).concat([eqEu()]).concat(tocaLista(c)).concat(tocaFora()).filter(Boolean))]; }
function tocaHtml(c){ if(!c||c.funil==='fx'||c.funil==='bn') return ''; const j=esc(jsq(c.id)), l=tocaLista(c), e=l[0], nomes=l.map(eqNome).join(' + ');
  return e?`<button type="button" class="fu-toca" style="background:${eqCor(e)}" onclick="event.stopPropagation();fuTocaMenu(event,'${j}')" title="Quem toca: ${esc(nomes)} — toque pra mudar" aria-label="Quem toca: ${esc(nomes)}">${esc(eqSigla(e))}${l.length>1?`<span class="fu-toca-mais">+${l.length-1}</span>`:''}</button>`
    :(()=>{ const d=(c&&c._dono)||eqEu(); return d?`<button type="button" class="fu-toca sug" style="--tc:${eqCor(d)}" onclick="event.stopPropagation();fuTocaMenu(event,'${j}')" title="Ninguém marcado ainda (a base é de ${esc(eqNome(d))}) — toque pra dizer quem toca" aria-label="Marcar quem toca">${esc(eqSigla(d))}</button>`
      :`<button type="button" class="fu-toca vazio" onclick="event.stopPropagation();fuTocaMenu(event,'${j}')" title="Ninguém marcado — toque pra dizer quem toca este negócio" aria-label="Marcar quem toca">＋</button>`; })(); }
function fuTocaMenu(ev,id){ const c=fuAcha(id); if(!c) return; const j=esc(jsq(id)), at=tocaLista(c), t=eqTime(c);
  fuMenu(ev,`<div class="mh">Quem toca ${esc(pn(c))}<small style="display:block;font-weight:400;color:var(--muted)">toque pra marcar ou desmarcar — pode ser mais de um</small></div>${t.length?t.map(e=>`<button type="button" onclick="fuToca('${j}','${esc(jsq(e))}')"><span class="fu-toca mini" style="background:${eqCor(e)}">${esc(eqSigla(e))}</span>${esc(eqNome(e))}${at.includes(e)?' ✓':''}</button>`).join(''):'<div style="padding:6px 10px;font-size:12px;color:var(--muted)">Entre com a sua conta pra marcar.</div>'}<button type="button" onclick="fuFecharMenu();fuTocaOutro('${j}')">＋ Parceiro de fora (joint)…</button>${at.length?`<button type="button" onclick="fuToca('${j}','')">✕ Ninguém</button>`:''}`); }
/* fuToca(id,e): e vazio = ninguém; e já marcado = desmarca; e novo = soma à lista (não tira os outros) */
function fuToca(id,e){ fuFecharMenu(); const c=fuAcha(id); if(!c||c.funil==='bn'||c.funil==='fx') return; e=String(e||'').toLowerCase();
  const antes=tocaLista(c), depois=!e?[]:(antes.includes(e)?antes.filter(x=>x!==e):antes.concat([e]));
  if(depois.join()===antes.join()) return;
  if(depois.length){ c.tocas=depois; c.toca=depois[0]; } else { delete c.tocas; delete c.toca; } c.toca_em=new Date().toISOString();
  const nomes=depois.map(eqNome).join(' + ');
  try{ interacoesDe(c).push({id:uid(),k:'toca',l:depois.length?`Quem toca: ${nomes}`:'Quem toca: ninguém',toca_de:antes.join(','),toca_para:depois.join(','),dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()}); }catch(_){}
  salvar(); fuRepinta(); toast(depois.length?`${pn(c)}: quem toca é ${nomes}`:`${pn(c)}: sem ninguém marcado`,true); }
/* % que passa de uma etapa pra seguinte no funil NOVO: quem alcançou (etapa atual + histórico) — mesma conta do quadro antigo
   (nnTaxas), no mesmo recorte de período (FUNP). Estoque fica fora (não entrou no funil ainda). */
function fuTaxas(fid,lista){ const fl=cfg(fid).filter(e=>!e.enc&&!/revisita/i.test(e.id)).map(e=>e.id), out={};
  let cs=lista.map(x=>x.c).filter(c=>c&&c.funil!=='bn'&&c.funil!=='fx'); try{ if(typeof funRecorte==='function') cs=funRecorte(cs).lista; }catch(_){}
  const maxI=c=>{ let m=fl.indexOf(fuDestino(c).etapa_id); (Array.isArray(c.interacoes)?c.interacoes:[]).forEach(x=>{ const k=fl.indexOf(fuParaNovo(c,x)); if(k>m) m=k; }); return m; };
  const mx=cs.map(maxI), alc=fl.map((e,k)=>mx.filter(m=>m>=k).length);
  fl.slice(0,-1).forEach((e,k)=>{ if(alc[k]) out[e]={de:e,para:fl[k+1],n1:alc[k],n2:alc[k+1],pct:Math.round(alc[k+1]/alc[k]*100)}; });
  return out; }
function taxaHtml(t){ if(!t||t.pct==null) return ''; const cor=t.pct<40?'var(--verm)':t.pct<70?'#b45309':'#15803d';
  return `<span class="fu-taxa" style="color:${cor}" title="${t.n1} alcançaram ${esc(lbl(t.de))} · ${t.n2} chegaram em ${esc(lbl(t.para))} (posição atual + histórico)">${t.pct}% passam →</span>`; }
function colHtml(fid,id,itens){ const enc=ehEnc(fid,id), cs=itens.map(x=>x.c);
  const sp=itens.filter(x=>x.i.semProx).length, pa=(typeof somaPA==='function')?somaPA(cs):0, pd=(typeof paPonderado==='function')?Math.round(paPonderado(cs.filter(c=>c.funil!=='bn'&&c.funil!=='fx'))):0, pos=id==='entrega', j=esc(jsq(id));
  return `<section class="fu-col${enc?' enc':''}${(FU.tab[fid]||colsVis(fid)[0])===id?' vis':''}" data-etapa="${esc(id)}" aria-label="${esc(lbl(id))}">
    <div class="fu-col-h"><span class="fu-alca fu-alca-col" title="Arraste pra mudar a ordem das colunas" aria-hidden="true">⠿</span><span style="width:9px;height:9px;border-radius:50%;flex:0 0 auto;background:${corDe(fid,id)}"></span><b>${esc(lbl(id))}</b><span class="qt">${itens.length}</span><button type="button" class="fu-colx" onclick="fuColMenu(event,'${j}')" aria-label="Organizar a etapa ${esc(lbl(id))}" title="Organizar esta etapa">⋯</button></div>
    <div class="fu-col-s">${enc?'<span>encerramento · fora do funil</span>':pos?'<span>📦 pós-venda · não soma no funil</span>':`<span>prob. ${prob(id)}%${sp?` · ⚠ ${sp}`:''}</span>${pa?`<span class="pa">PA ${esc(brlCurto(pa))}${pd?` <span class="pd">· pond. ${esc(brlCurto(pd))}</span>`:''}</span>`:''}${taxaHtml((FU._tx||{})[id])}`}</div>
    <div class="fu-cards">${itens.length?itens.map(x=>cardHtml(x,fid)).join(''):`<div class="fu-vazio">${ativos().length||FU.q?'Nenhum card com estes filtros':'Solte um card aqui'}</div>`}</div>
  </section>`; }
function colsVis(fid){ const c=colsDe(fid); return c.ordem.filter(id=>!c.ocultas.includes(id)); }
function topoHtml(){ const nVi=fuPopulacao('vi').length, nMf=fuPopulacao('mfo').length;
  return `<div class="fu-seg" role="tablist" aria-label="Funil"><button type="button" class="${FU.fid==='vi'?'on':''}" onclick="fuFunil('vi')">🎯 Vida Individual <span class="n">${nVi}</span></button>${mfoOk()?`<button type="button" class="${FU.fid==='mfo'?'on':''}" onclick="fuFunil('mfo')">🏢 MFO <span class="n">${nMf}</span></button>`:''}</div>`; }
const mfoOk=()=>{ try{ return typeof fuMfoOn==='function'?fuMfoOn():true; }catch(_){ return true; } };   /* LIBERA-FUNIL-NOVO-V1: Daniel só Vida Individual */
function barraHtml(){ const c=colsDe(FU.fid), nv=c.ordem.length-c.ocultas.length, ol=(ORDENS.find(o=>o[0]===FU.ordem)||ORDENS[0])[1];
  return `<div class="fu-acts"><button type="button" class="fu-b" onclick="irPara('sitplan')" title="SitPlan do dia">📅 <span class="tx">SitPlans</span></button><button type="button" class="fu-b" onclick="irPara('bn-recs')" title="Recomendações">🌳 <span class="tx">Recomendações</span></button>
    <button type="button" class="fu-b p" onclick="openNovoContato()">＋ <span class="tx">Novo negócio</span></button>${FU.fid==='vi'&&typeof fuNovaRec==='function'?'<button type="button" class="fu-b" onclick="fuNovaRec()" title="Cole texto, foto, PDF ou contato: a IA lê e você revisa">✨ <span class="tx">Nova recomendação</span></button>':''}
    <button type="button" class="fu-b" onclick="fuOrdemMenu(event)" title="Ordenar">⇅ <span class="tx">${esc(ol)}</span> ▾</button>
    <span class="fu-vt" role="group" aria-label="Vista"><button type="button" class="${FU.modo==='kanban'?'on':''}" onclick="fuModo('kanban')" title="Quadro (Kanban)" aria-label="Quadro (Kanban)">▦</button><button type="button" class="${FU.modo==='tabela'?'on':''}" onclick="fuModo('tabela')" title="Lista por etapa" aria-label="Lista por etapa">☰</button></span>
    <button type="button" class="fu-b" onclick="fuColunas()" title="Colunas">▥ <span class="tx">Colunas</span> <span class="cn">(${nv}/${c.ordem.length})</span></button>
    <button type="button" class="fu-b" onclick="fuMais(event)" aria-label="Mais opções">⋯</button></div>`; }
function filtroBarHtml(lista){ const at=ativos(), S2=salvos(), algum=S2.some(x=>fIgual(x.f));
  return `<div class="fu-fb" aria-label="Filtros"><button type="button" class="fu-b" onclick="fuFiltrosAbrir()">⚙ Filtros${at.length?` <span class="fu-cnt">${at.length}</span>`:''}</button>
    ${S2.length?'<span class="fu-fb-l">Salvos</span>':''}${S2.map((x,k)=>`<button type="button" class="fu-sv${fIgual(x.f)?' on':''}" onclick="fuSalvoAplicar(${k})">${esc(x.n)} <span class="q">${contaSalvo(lista,x.f)}</span></button>`).join('')}
    ${at.length&&!algum?'<span class="fu-sep"></span>'+at.map(([k,l])=>`<button type="button" class="fu-fc ativo" onclick="fuTirar('${esc(k)}')">${esc(l)} ✕</button>`).join(''):''}${FU.cong?'<button type="button" class="fu-fc ativo" onclick="fuCong()">❄️ Congelados ✕</button>':''}${at.length?'<button type="button" class="fu-fc txt" onclick="fuLimpar()">limpar</button>':''}</div>`; }
/* ═══ FOTO-WA-V1 (23/11/2026, pedido dele: "ele traz fotos dos contatos… quero isso também; a Umbler ajuda nisso") ═══
   A foto de perfil do WhatsApp já vem no sync da Umbler (umbler_chats.bruto.contact.profilePictureUrl, link fixo).
   Só LEITURA: nada é pedido à Umbler. Casa com o contato pelo telefone (DDD + 8 últimos dígitos, pra não errar o 9º dígito).
   Sem conversa na Umbler ou foto que não carrega → ficam as iniciais. Nasce só na base dele: novoOn('foto-wa'). */
const FOTO={m:{},em:0,lido:false,carregando:false};
const FOTO_CHAVE='crmlp_fu_fotos_v1', FOTO_TTL=6*3600e3;
const fotoOn=()=>{ try{ return typeof novoOn==='function'&&!!novoOn('foto-wa'); }catch(_){ return false; } };
function telChave(t){ let d=String(t==null?'':t).replace(/\D/g,''); if(d.length>=12&&d.slice(0,2)==='55') d=d.slice(2);
  if(d.length<10) return ''; if(d.length>11) return d; return d.slice(0,2)+d.slice(-8); }
function fotoUrlOk(u){ return typeof u==='string'&&u.length<600&&/^https:\/\/[a-z0-9.-]+\.amazonaws\.com\/[^\s"'<>\\]+$/i.test(u); }
function fotoMapa(rows){ const m={}; (rows||[]).forEach(r=>{ const k=telChave(r&&r.contato_tel_norm), u=r&&r.foto; if(k&&fotoUrlOk(u)) m[k]=u; }); return m; }
function fotoCacheLer(){ if(FOTO.lido) return; FOTO.lido=true;
  try{ const o=JSON.parse(localStorage.getItem(FOTO_CHAVE)||'null'); if(o&&o.m&&typeof o.m==='object'){ const m={}; Object.keys(o.m).forEach(k=>{ if(fotoUrlOk(o.m[k])) m[k]=o.m[k]; }); FOTO.m=m; FOTO.em=+o.em||0; } }catch(_){} }
async function fotoCarregar(){ if(!fotoOn()) return; fotoCacheLer();
  if(FOTO.carregando||Date.now()-FOTO.em<FOTO_TTL) return;
  if(typeof sb==='undefined'||!sb||typeof logado!=='function'||!logado()) return;
  FOTO.carregando=true;
  try{ const r=await sb.from('umbler_chats').select('contato_tel_norm,foto:bruto->contact->>profilePictureUrl').not('bruto->contact->>profilePictureUrl','is',null).order('ultima_msg_em',{ascending:true}).limit(3000);
    if(r&&!r.error&&Array.isArray(r.data)){ const antes=Object.keys(FOTO.m).length, m=fotoMapa(r.data); FOTO.m=m; FOTO.em=Date.now();
      try{ localStorage.setItem(FOTO_CHAVE,JSON.stringify({em:FOTO.em,m})); }catch(_){}
      const ae=document.activeElement, digitando=ae&&/^(INPUT|TEXTAREA|SELECT)$/.test(ae.tagName);
      if(Object.keys(m).length!==antes&&!digitando&&document.querySelector('#main .fu')&&!document.querySelector('.fu-ov')) fuRepinta(); }
    else FOTO.em=Date.now()-FOTO_TTL+10*60e3;   /* falhou: tenta de novo em 10 min, sem martelar */
  }catch(_){ FOTO.em=Date.now()-FOTO_TTL+10*60e3; } finally{ FOTO.carregando=false; } }
function fotoDe(c){ if(!c||!fotoOn()) return ''; fotoCacheLer(); let ts=[]; try{ ts=(typeof pTels==='function'?pTels(c):[])||[]; }catch(_){}
  ts=[].concat(ts,[c.telefone,c.celular,c.tel]).filter(Boolean);
  for(const t of ts){ const u=FOTO.m[telChave(t)]; if(u) return u; } return ''; }
function iniciaisDe(n){ const p=String(n||'').replace(/[^\p{L}\s]/gu,' ').trim().split(/\s+/).filter(Boolean); if(!p.length) return '?';
  return (p[0][0]+(p.length>1?p[p.length-1][0]:'')).toUpperCase(); }
/* avatar: iniciais coloridas sempre; a foto entra por cima e, se não carregar, some e ficam as iniciais */
function avatarHtml(c,cls,soFoto){ const n=String((c&&c.nome)||''), u=fotoDe(c); if(soFoto&&!u) return '';
  let h=0; for(let k=0;k<n.length;k++) h=(h*31+n.charCodeAt(k))>>>0;
  return `<span class="fu-foto${cls?' '+cls:''}" style="background:hsl(${h%360} 42% 46%)" aria-hidden="true">${esc(iniciaisDe(n))}${u?`<img src="${esc(u)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.remove()">`:''}</span>`; }

/* ═══ LISTA-GLOBAL-V1 (23/11/2026, pedido dele com print do Global: "além do meu formato kanban, add esse formato visual") ═══
   A vista ☰ deixa de ser a tabela crua: trilho de etapas com contagem à esquerda (Todos + cada etapa do Funil & Etapas),
   linha com foto/iniciais + nome + telefone, estrelas + probabilidade, etapa + "Cliente · apólice ativa", e cabeçalho que
   ordena (1º clique sobe, 2º desce, 3º volta à ordem do quadro). Mesmos filtros e mesma busca do Kanban.
   No celular a tabela vira lista de cartões (sem rolar de lado) e as etapas viram trilho horizontal. */
const TCOLS=[['nome','Nome'],['criado','Criado em'],['prob','Prob. negócio'],['etapa','Etapa'],['rec','Recomendante'],['prox','Próximo passo'],['prof','Profissão'],['renda','Renda'],['cidade','Cidade'],['toca','Quem toca']];
const entIso=c=>{ try{ return (entradaFunil(c).iso)||''; }catch(_){ return ''; } };
function tabValor(x,k,fid,ids){ const c=x.c,i=x.i;
  if(k==='nome') return String(c.nome||'').toLowerCase();
  if(k==='criado') return entIso(c);
  if(k==='prob') return ((fid==='vi'&&i.ance&&+i.ance.n)||0)*1000+prob(i.d.etapa_id);
  if(k==='etapa'){ const n=ids.indexOf(i.d.etapa_id); return n<0?999:n; }
  if(k==='rec') return String(c.recomendante||'').toLowerCase();
  if(k==='prox') return (i.prox&&String(i.prox.quando||''))||'';
  if(k==='prof') return String(c.profissao||'').replace(/^[—\-\s]+$/,'').toLowerCase();
  if(k==='renda') return +String(c.renda||c.renda_estimada||'').replace(/\D/g,'')||'';
  if(k==='cidade') return String(c.cidade||'').toLowerCase();
  if(k==='toca') return tocaLista(c).map(eqNome).join(' ').toLowerCase();
  return ''; }
function tabOrdenar(l,fid){ const s=FU.ts; if(!s||!TCOLS.some(t=>t[0]===s.k)) return fuOrdenar(l);
  const ids=cfg(fid).map(e=>e.id), d=s.d<0?-1:1;
  return l.map(x=>[x,tabValor(x,s.k,fid,ids)]).sort((A,B)=>{ const a=A[1], b=B[1], va=a===''||a==null, vb=b===''||b==null;
    if(va||vb) return va&&vb?0:va?1:-1;   /* vazio sempre no fim, subindo ou descendo */
    return (typeof a==='number'&&typeof b==='number'?a-b:String(a).localeCompare(String(b),'pt-BR'))*d; }).map(p=>p[0]); }
function fuTabOrd(k){ const s=FU.ts; FU.ts=!k?null:(!s||s.k!==k)?{k,d:1}:s.d>0?{k,d:-1}:null; render(); }
function fuTabOrdSel(v){ const m=/^([a-z]+):(-?1)$/.exec(String(v||'')); FU.ts=m?{k:m[1],d:+m[2]}:null; render(); }
function fuEtapaSel(id){ FU.et[FU.fid]=id||''; render(); }
function estrelasLe(n){ n=Math.max(0,Math.min(5,+n||0)); return `<span class="fu-stl" title="${n} de 5 estrelas" aria-label="${n} de 5 estrelas"><b>${'★'.repeat(n)}</b>${'★'.repeat(5-n)}</span>`; }
function railHtml(fid,vis){ const sel=FU.et[fid]||'';
  return `<nav class="fu-rail" aria-label="Etapas"><button type="button" class="${sel?'':'on'}" onclick="fuEtapaSel('')"><span class="nm">Todos</span><span class="q">${vis.length}</span></button>${cfg(fid).map(e=>{ const n=vis.filter(x=>x.i.d.etapa_id===e.id).length;
    return `<button type="button" class="${sel===e.id?'on':''}${n?'':' z'}" onclick="fuEtapaSel('${esc(jsq(e.id))}')" ${sel===e.id?'aria-current="true"':''}><span class="dot" style="background:${corDe(fid,e.id)}" aria-hidden="true"></span><span class="nm">${esc(lbl(e.id))}</span><span class="q">${n}</span></button>`; }).join('')}</nav>`; }
/* ═══ TAGS-LISTA-V1 · UNIR-LISTA-V1 · DUP-LISTA-V1 (23/11/2026, pedido dele olhando a lista nova: "já nessa tela é bom eu poder
   add e editar tags" + "selecionar negócios pra unir e ver duplicados, ajuda a limpeza") ═══
   Tags: texto livre gravado em c.tags ("a, b" — o mesmo campo que a busca e a planilha já liam); ＋ na linha abre o editor.
   Unir: caixinha por linha (só ficha do funil; Estoque e cliente sem ficha ficam de fora) → confirma mostrando quem fica de base
   (o mais antigo, regra do dupFundir) e deixa ESCOLHER a etapa que fica. Nada funde sozinho; dá pra desfazer.
   Duplicados: o mesmo motor do funil antigo (dupGrupos: mesmo telefone ou mesmo nome, dentro do mesmo funil de origem). */
const tagLimpa=t=>String(t==null?'':t).replace(/[,;<>"'`\\]/g,' ').replace(/\s+/g,' ').trim().slice(0,24);
function tagsDe(c){ const v=c&&c.tags, l=Array.isArray(v)?v:String(v==null?'':v).split(/[,;]/), vistos=new Set(), out=[];
  l.forEach(t=>{ t=tagLimpa(t); const k=normKey(t); if(!t||/^[—\-\s]+$/.test(t)||vistos.has(k)) return; vistos.add(k); out.push(t); }); return out; }
const tagPode=c=>!!c&&c.funil!=='fx';
const selPode=c=>!!c&&c.funil!=='bn'&&c.funil!=='fx'&&(S.contatos||[]).includes(c);
function selIds(){ const s=FU.sel||(FU.sel={}); Object.keys(s).forEach(id=>{ if(!selPode(fuAcha(id))) delete s[id]; }); return Object.keys(s); }
function tagsUsadas(){ const m=new Map(); fuPopulacao(FU.fid).forEach(c=>tagsDe(c).forEach(t=>{ const k=normKey(t), a=m.get(k); if(a) a.n++; else m.set(k,{t,n:1}); }));
  return [...m.values()].sort((a,b)=>b.n-a.n||a.t.localeCompare(b.t,'pt-BR')); }
function tagAlvos(id){ return (id==='*'?selIds().map(fuAcha):[fuAcha(id)]).filter(tagPode); }
function fuTagPor(id,t,tirar){ t=tagLimpa(t); if(!t) return; const k=normKey(t), al=tagAlvos(id); let leg=0, bn=0;
  al.forEach(c=>{ const l=tagsDe(c), tem=l.some(x=>normKey(x)===k); if(tirar?!tem:tem) return;
    c.tags=(tirar?l.filter(x=>normKey(x)!==k):l.concat([t])).join(', '); if(c.funil==='bn') bn++; else leg++; });
  if(leg) salvar(); if(bn){ try{ bnSalvar(); }catch(_){} }
  if(leg||bn){ try{ render(); }catch(_){} if(id==='*') toast(`Tag "${t}" em ${leg+bn} ${leg+bn===1?'negócio':'negócios'}`,true); }
  if(_menu&&_menu.classList.contains('fu-tgm')) _menu.innerHTML=tagMenuHtml(id); }
function fuTagNova(id){ const el=document.getElementById('fu-tg-in'), t=tagLimpa(el&&el.value); if(!t){ if(el) el.focus(); return; } fuTagPor(id,t); const e2=document.getElementById('fu-tg-in'); if(e2) try{ e2.focus(); }catch(_){} }
function tagMenuHtml(id){ const al=tagAlvos(id), j=esc(jsq(id)), um=id!=='*'?al[0]:null, at=um?tagsDe(um):[], tem=new Set(at.map(normKey)), sug=tagsUsadas().filter(x=>!tem.has(normKey(x.t))).slice(0,14);
  return `<div class="mh">${um?'Tags de '+esc(String(um.nome||'').trim().split(/\s+/)[0]||'—'):'Pôr tag em '+al.length+(al.length===1?' selecionado':' selecionados')}</div>
  ${at.length?`<div class="fu-tgm-l">${at.map(t=>`<button type="button" class="fu-tg on" onclick="fuTagPor('${j}','${esc(jsq(t))}',1)" title="Tirar a tag ${esc(t)}">${esc(t)} ✕</button>`).join('')}</div>`:(um?'<div class="fu-tgm-v">Sem tag ainda.</div>':'')}
  <form class="fu-tgm-f" onsubmit="event.preventDefault();fuTagNova('${j}')"><input id="fu-tg-in" type="text" maxlength="24" placeholder="Nova tag" autocomplete="off" aria-label="Nova tag"><button type="submit">Adicionar</button></form>
  ${sug.length?`<div class="mh">Já usadas</div><div class="fu-tgm-l">${sug.map(x=>`<button type="button" class="fu-tg" onclick="fuTagPor('${j}','${esc(jsq(x.t))}')">${esc(x.t)}</button>`).join('')}</div>`:''}
  <button type="button" class="fu-tgm-ok" onclick="fuFecharMenu()">Pronto</button>`; }
function fuTagMenu(ev,id){ if(!tagAlvos(id).length) return; fuMenu(ev,tagMenuHtml(id),'fu-tgm'); if(innerWidth>760){ const e=document.getElementById('fu-tg-in'); if(e) try{ e.focus(); }catch(_){} } }
/* seleção */
function fuSel(id,on){ if(on) FU.sel[String(id)]=1; else delete FU.sel[String(id)]; render(); }
function fuSelTodos(on){ (FU._selVis||[]).forEach(id=>{ if(on) FU.sel[id]=1; else delete FU.sel[id]; }); render(); }
function fuSelLimpar(){ FU.sel={}; render(); }
function selBarHtml(){ const n=selIds().length; if(!n) return '';
  return `<div class="fu-selb" role="region" aria-label="Negócios selecionados"><b>${n} ${n===1?'selecionado':'selecionados'}</b><button type="button" class="p" onclick="fuUnirAbrir()" ${n<2?'disabled title="Marque pelo menos dois pra unir"':''}>🔗 Unir${n>1?' os '+n:''}</button><button type="button" onclick="fuTagMenu(event,'*')">🏷 Tag</button><button type="button" onclick="fuSelLimpar()">✕ Limpar</button></div>`; }
/* fusão pura: a do app (dupFundir: base = o mais antigo, listas unidas, conflito vira nota) + campo vazio preenchido pelo outro + tags somadas */
function fuFundir(a,b){ const r=dupFundir(a,b), base=String(r.id)===String(a.id)?a:b, outro=base===a?b:a, vz=v=>v==null||v===''||v==='—'||(Array.isArray(v)&&!v.length);
  Object.keys(outro).forEach(k=>{ if(k==='id'||k==='tags'||k[0]==='_') return; if(vz(r[k])&&!vz(outro[k])) r[k]=outro[k]; });
  const tg=tagsDe({tags:tagsDe(base).concat(tagsDe(outro))}); if(tg.length) r.tags=tg.join(', ');
  return r; }
const LUGAR=['funil','etapa','funil_id','etapa_id','etapa_id_fonte','etapa_revisao','status'];
function fuUnirAbrir(gi){ const g=gi!=null?(FU._dupG||[])[gi]:null, l=(g||selIds().map(fuAcha)).filter(selPode);
  if(l.length<2){ toast('Marque pelo menos dois negócios pra unir',false); return; }
  const fid=fuDestino(l[0]).funil_id; if(l.some(c=>fuDestino(c).funil_id!==fid)){ toast('Só dá pra unir negócios do mesmo funil',false); return; }
  FU.unir=l.map(c=>String(c.id));
  const base=l.slice().sort((a,b)=>String(a.criadoEm||'9999').localeCompare(String(b.criadoEm||'9999')))[0], ids=cfg(fid).map(e=>e.id);
  const ets=[...new Set(l.map(c=>fuDestino(c).etapa_id))].sort((a,b)=>ids.indexOf(a)-ids.indexOf(b)), vivas=ets.filter(e=>!ehEnc(fid,e)), pad=vivas.length?vivas[vivas.length-1]:fuDestino(base).etapa_id;
  const card=c=>{ const tel=fuTel(c); return `<li class="${c===base?'b':''}">${avatarHtml(c)}<div class="tx"><b>${esc(c.nome||'—')}</b><span>${tel?'☏ '+esc(tx(()=>telBR(tel))||tel):'Sem telefone'} · ${esc(lbl(fuDestino(c).etapa_id))}</span><span>entrou ${esc(dataBR(entIso(c)))||'—'} · ${(c.interacoes||[]).length} no histórico · ${(c.tarefas||[]).length} ${(c.tarefas||[]).length===1?'tarefa':'tarefas'}</span>${c===base?'<em>fica de base (o mais antigo)</em>':''}</div></li>`; };
  fuModal(`<h2>Unir ${l.length} negócios em 1</h2>
    <div class="sub">Fica um card só, com o histórico, as tarefas, as recomendações e as tags de todos. Campo vazio num é preenchido pelo outro; valor diferente dos dois lados vira nota. Dá pra desfazer logo em seguida.</div>
    <ul class="fu-unl">${l.map(card).join('')}</ul>
    <label class="fu-unet">Etapa que fica <select id="fu-un-et" aria-label="Etapa que fica">${ets.map(e=>`<option value="${esc(e)}" ${e===pad?'selected':''}>${esc(lbl(e))}</option>`).join('')}</select></label>
    <div class="fu-row" style="display:flex;gap:8px;justify-content:flex-end;margin-top:14px"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar</button><button type="button" class="btn btn-p" onclick="fuUnirOk()">🔗 Unir em 1</button></div>`); }
function fuUnirOk(){ const ids=FU.unir||[], l=ids.map(fuAcha).filter(selPode); if(l.length<2){ fuFechar(); return; }
  const et=String((document.getElementById('fu-un-et')||{}).value||''), snap=JSON.parse(JSON.stringify(S.contatos));
  let acc=l[0]; for(let k=1;k<l.length;k++) acc=fuFundir(acc,l[k]);
  const dono=l.find(c=>fuDestino(c).etapa_id===et); if(dono) LUGAR.forEach(k=>{ if(dono[k]===undefined) delete acc[k]; else acc[k]=dono[k]; });
  (acc.interacoes=Array.isArray(acc.interacoes)?acc.interacoes:[]).push({id:uid(),k:'nota',l:`🔗 Unido: ${l.length} cards viraram 1`,dia:hojeISO(),ts:new Date().toISOString(),por:quemFez()});
  const fora=new Set(ids); S.contatos=S.contatos.filter(x=>!fora.has(String(x.id))); S.contatos.push(normContato(acc));
  FU.sel={}; FU.unir=null; salvar(); fuFechar(); render();
  toastDesfazer(`${String(acc.nome||'').trim().split(/\s+/)[0]||'Negócio'}: ${l.length} cards viraram 1`,()=>{ S.contatos=snap; salvar(); render(); toast('Desfeito',true); }); }
/* duplicados */
function dupG(fid){ try{ return dupGrupos(fuPopulacao(fid).filter(selPode)); }catch(_){ return []; } }
function fuDupVer(on){ FU.dup=!!on; render(); }
function fuDupAcao(gi,k){ const g=(FU._dupG||[])[gi]; if(!g||g.length<2) return; if(k==='unir') return fuUnirAbrir(gi);
  const snap=JSON.parse(JSON.stringify(S.contatos)), des=()=>{ S.contatos=snap; salvar(); render(); toast('Desfeito',true); };
  if(k==='pessoa') pessoaVincular(g); dupSilenciar(g); salvar(); render();
  toastDesfazer(k==='pessoa'?`${String(g[0].nome||'').trim().split(/\s+/)[0]}: ${g.length} negócios ligados à mesma pessoa`:'Não aviso mais sobre este par',des); }
function tabelaHtml(fid,vis){ if(FU.et[fid]&&!etapa(fid,FU.et[fid])) FU.et[fid]='';
  const G=dupG(fid); FU._dupG=G; if(!G.length) FU.dup=false; const dup=FU.dup, marc=new Set(selIds());
  const sel=FU.et[fid]||'', l=dup?[]:tabOrdenar(sel?vis.filter(x=>x.i.d.etapa_id===sel):vis,fid), s=FU.ts, vz=v=>v&&!/^[—\-\s]+$/.test(String(v))?esc(String(v)):'—';
  const th=(k,r,x)=>{ const on=s&&s.k===k; return `<th${x?' class="x"':''}${on?` aria-sort="${s.d>0?'ascending':'descending'}"`:''}><button type="button" class="fu-th${on?' on':''}" onclick="fuTabOrd('${k}')" title="Ordenar por ${esc(r)}">${esc(r)} <span aria-hidden="true">${on?(s.d>0?'↑':'↓'):'↕'}</span></button></th>`; };
  const lin=({c,i})=>{ const j=esc(jsq(c.id)), tel=fuTel(c), fx=c.funil==='fx', pj=!fx&&c.funil!=='bn'&&!!tx(()=>ehEmpresa(c)), on=marc.has(String(c.id)), tg=tagsDe(c), tp=tagPode(c);
    const px=i.prox?`📅 ${esc(dataBR(i.prox.quando))}${i.prox.hora?' '+esc(i.prox.hora):''}${i.prox.tit?' · '+esc(i.prox.tit):''}`:(i.semProx?'<span class="fu-avc">⚠ Sem próx. passo</span>':'—');
    const tgH=(tg.length||tp)?`<span class="fu-tgs" onclick="event.stopPropagation()">${tg.map(t=>`<span class="fu-tg">${esc(t)}</span>`).join('')}${tp?`<button type="button" class="fu-tg add" onclick="fuTagMenu(event,'${j}')" title="Adicionar ou editar tags" aria-label="Tags de ${esc(c.nome||'')}">${tg.length?'✎':'＋ tag'}</button>`:''}</span>`:'';
    return `<tr onclick="fuAbrir('${j}')"${on?' class="sel"':''}>
      <td class="c-ck" onclick="event.stopPropagation()">${selPode(c)?`<label class="fu-ck"><input type="checkbox" ${on?'checked':''} onchange="fuSel('${j}',this.checked)" aria-label="Selecionar ${esc(c.nome||'')}"></label>`:''}</td>
      <td class="c-nome"><div class="fu-pes">${avatarHtml(c)}<div class="tx"><button type="button" class="nm" onclick="event.stopPropagation();fuAbrir('${j}')">${pj?'🏢 ':''}${esc(c.nome||'—')}</button><span class="tel">${tel?'☏ '+esc(tx(()=>telBR(tel))||tel):'<i>Sem telefone</i>'}</span>${tgH}</div></div></td>
      <td class="x">${esc(dataBR(entIso(c)))||'—'}</td>
      <td class="c-prob">${fid==='vi'?estrelasLe(i.ance&&i.ance.n):''}<span class="pc">${prob(i.d.etapa_id)}%</span></td>
      <td class="c-et"><span class="fu-bd" style="color:${corDe(fid,i.d.etapa_id)}">● ${esc(lbl(i.d.etapa_id))}</span>${fuEhCliente(c)?'<span class="fu-bd v">Cliente · apólice ativa</span>':''}${i.cong?'<span class="fu-bd b">❄️ congelado</span>':''}</td>
      <td class="x">${vz(c.recomendante)}</td>
      <td class="c-px">${px}</td>
      <td class="x">${vz(c.profissao)}</td><td class="x num">${vz(c.renda||c.renda_estimada)}</td><td class="x">${vz(c.cidade)}</td>
      <td class="x">${c.toca||c.tocas?esc(tocaLista(c).map(eqNome).join(' + '))||'—':'—'}</td>
      <td class="x">${c.mercado?esc(c.mercado):'—'}</td><td class="x">${c.sitplan?esc(dataBR(String(c.sitplan).slice(0,10))):'—'}</td><td class="x obs">${vz(String(c.notas||'').slice(0,60))}</td>
      <td class="c-ac" onclick="event.stopPropagation()"><button type="button" onclick="fuLigar(event,'${j}')" title="Ligar" aria-label="Ligar para ${esc(c.nome||'')}">☏</button><button type="button" onclick="fuZap(event,'${j}')" title="WhatsApp" aria-label="WhatsApp de ${esc(c.nome||'')}">💬</button>${fx?'':`<button type="button" onclick="fuMoverMenu(event,'${j}')" title="Mover de etapa" aria-label="Mover ${esc(c.nome||'')} de etapa">⇄</button>`}${tp?`<button type="button" class="m" onclick="fuTagMenu(event,'${j}')" title="Tags" aria-label="Tags de ${esc(c.nome||'')}">🏷</button>`:''}</td></tr>`; };
  const grp=(g,gi)=>`<tr class="grp"><td colspan="15"><span>${g.length} cards com ${tx(()=>telKey(g[0].telefone))?'o mesmo telefone':'o mesmo nome'}</span><span class="bt"><button type="button" class="p" onclick="fuDupAcao(${gi},'unir')" title="É o mesmo negócio cadastrado mais de uma vez">🔗 Unir</button><button type="button" onclick="fuDupAcao(${gi},'pessoa')" title="Mesma pessoa, negócios diferentes: passam a viver ligados">👤 Mesma pessoa, negócios diferentes</button><button type="button" onclick="fuDupAcao(${gi},'nao')" title="Xará ou telefone compartilhado: não avisar mais">Não é a mesma pessoa</button></span></td></tr>`+g.map(c=>lin({c,i:fuInfo(c,fid)})).join('');
  const linhas=dup?G.map(grp).join(''):l.map(lin).join('');
  const eleg=(dup?[].concat(...G):l.map(x=>x.c)).filter(selPode).map(c=>String(c.id)); FU._selVis=eleg; const todos=eleg.length>0&&eleg.every(id=>marc.has(id));
  const nDup=G.reduce((a,g)=>a+g.length,0);
  const dupChip=G.length?`<button type="button" class="fu-dupc${dup?' on':''}" aria-pressed="${dup}" onclick="fuDupVer(${dup?0:1})" title="Mesmo telefone ou mesmo nome em mais de um card">${dup?'← Voltar pra lista':`⚠ Possíveis duplicados · ${G.length} ${G.length===1?'grupo':'grupos'}`}</button>`:'';
  const ordSel=dup?'':`<label class="fu-lg-ord"><span>Ordenar</span><select onchange="fuTabOrdSel(this.value)" aria-label="Ordenar a lista"><option value="">Ordem do quadro</option>${TCOLS.map(([k,r])=>`<option value="${k}:1" ${s&&s.k===k&&s.d>0?'selected':''}>${esc(r)} ↑</option><option value="${k}:-1" ${s&&s.k===k&&s.d<0?'selected':''}>${esc(r)} ↓</option>`).join('')}</select></label>`;
  const pe=dup?`${nDup} cards em ${G.length} ${G.length===1?'grupo':'grupos'} · todas as etapas, sem os filtros · nada se une sozinho, você decide`:`${l.length} ${l.length===1?'pessoa':'pessoas'}${sel?' em '+esc(lbl(sel)):''} · mesmos filtros do Kanban · ⋯ exporta a planilha`;
  const topo=tx(()=>document.querySelector('#topbar,.topbar').offsetHeight)||0, bn=tx(()=>document.querySelector('#bnav,.bnav').offsetHeight)||0;   /* barra do app fixa no topo e, no celular, a de baixo: a barra de selecionados flutua ACIMA dela */
  return `<div class="fu-lg${marc.size?' tem-sel':''}" style="--fu-tb:${topo}px;--fu-bn:${bn}px">${railHtml(fid,vis)}<div class="fu-lg-m">${dupChip||selBarHtml()?`<div class="fu-lg-tb">${dupChip}${selBarHtml()}</div>`:''}${ordSel}<div class="fu-tw fu-lt"><table class="fu-lt-t"><thead><tr><th class="c-ck">${eleg.length?`<label class="fu-ck"><input type="checkbox" ${todos?'checked':''} onchange="fuSelTodos(this.checked)" aria-label="Selecionar todos da lista"></label>`:''}</th>${th('nome','Nome')}${th('criado','Criado em',1)}${th('prob','Prob. negócio')}${th('etapa','Etapa')}${th('rec','Recomendante',1)}${th('prox','Próximo passo')}${th('prof','Profissão',1)}${th('renda','Renda',1)}${th('cidade','Cidade',1)}${th('toca','Quem toca',1)}<th class="x">Mercado</th><th class="x">SitPlan</th><th class="x">Observação</th><th class="c-ac">Ações</th></tr></thead><tbody>
  ${linhas||`<tr class="vz"><td colspan="15">Ninguém ${sel?'nesta etapa':'aqui'} com os filtros de agora.</td></tr>`}
  </tbody></table></div><div class="sub fu-lg-pe">${pe}</div></div></div>`; }

function viewFunilNovo(fid){ fuCss(); if(fid) FU.fid=fid; fid=FU.fid;
  if(!FU._modoLido){ FU._modoLido=true; if(panPref().modo==='tabela') FU.modo='tabela'; }   /* a vista escolhida (▦ quadro / ☰ lista) fica lembrada no aparelho */
  fotoCarregar();
  const lista=fuLista(fid), vis=lista.filter(x=>fuPassa(x.c,x.i)), cols=colsVis(fid), adm=podeEditarEtapa();
  FU._tx=tx(()=>fuTaxas(fid,lista))||{};
  if(fid==='vi') fxCarregar();
  eqCarregar();
  if(!cols.includes(FU.tab[fid])) FU.tab[fid]=cols[0];
  const busca=`<div class="fu-bq"><label class="fu-busca" for="fu-q">🔎 <input id="fu-q" type="search" placeholder="Buscar em qualquer coluna (nome, cidade, profissão, etapa…)" autocomplete="off" value="${esc(FU.q)}" oninput="fuBusca(this.value)"></label><span class="fu-res">${vis.length} de ${lista.filter(x=>FU.cong?x.i.cong:!x.i.cong).length} resultados</span></div>`;
  let body;
  if(FU.modo==='tabela') body=tabelaHtml(fid,vis);
  else body=`<div class="fu-tabs">${cols.map(id=>`<button type="button" class="${FU.tab[fid]===id?'on':''}" onclick="fuTab('${esc(jsq(id))}')">${esc(lbl(id))} · ${vis.filter(x=>x.i.d.etapa_id===id).length}</button>`).join('')}</div>
    <div class="fu-board" id="fu-board">${cols.map(id=>colHtml(fid,id,fuOrdenar(vis.filter(x=>x.i.d.etapa_id===id)))).join('')}${adm?'<button type="button" class="fu-nova-col" onclick="fuEtapaNova()">＋ Nova etapa</button>':''}</div>`;
  const rol=fuRolGuardar(fid);
  $('#main').innerHTML=`<div class="fu">${topoHtml()}${barraHtml()}${filtroBarHtml(lista)}<div class="fu-qd">${busca}${body}</div></div>`;
  if(FU.modo==='kanban'){ fuWire(); fuAltura(); fuRolRepor(rol); } }
/* QUADRO-ALTURA-V1: altura do quadro = o que sobra da tela entre a barra do topo (fixa) e o rodapé. Mínimo 420 px. */
function fuAltura(){ const b=document.getElementById('fu-board'); if(!b) return;
  if(!(W.matchMedia&&W.matchMedia('(min-width:761px)').matches)){ b.classList.remove('alt'); b.style.height=''; return; }
  const tb=document.querySelector('.topbar'), topo=tb?tb.getBoundingClientRect().height:0;
  /* o que vem abaixo do quadro (borda do bloco + rodapé) também precisa caber: rolando a página até o fim, o título das
     colunas para logo abaixo da barra do topo, nunca escondido atrás dela */
  const abaixo=Math.max(0,document.documentElement.scrollHeight-(b.getBoundingClientRect().bottom+W.scrollY));
  b.style.height=Math.max(420,Math.round(W.innerHeight-topo-abaixo-8))+'px'; b.classList.add('alt'); }
let _altT=null; W.addEventListener('resize',()=>{ clearTimeout(_altT); _altT=setTimeout(fuAltura,120); });
/* repintar (mover, ✓, delay, filtro) não joga o quadro pro começo nem a coluna pro topo */
function fuRolGuardar(fid){ const b=document.getElementById('fu-board'); if(!b||b.dataset.fid!==fid) return null;
  const col={}; b.querySelectorAll('.fu-col').forEach(c=>{ const k=c.querySelector('.fu-cards'); if(k&&k.scrollTop) col[c.dataset.etapa]=k.scrollTop; });
  return {x:b.scrollLeft,col}; }
function fuRolRepor(r){ const b=document.getElementById('fu-board'); if(!b) return; b.dataset.fid=FU.fid; if(!r) return;
  const por=()=>{ const bb=document.getElementById('fu-board'); if(!bb) return; bb.scrollLeft=r.x;
    bb.querySelectorAll('.fu-col').forEach(c=>{ const v=r.col[c.dataset.etapa], k=c.querySelector('.fu-cards'); if(v&&k) k.scrollTop=v; }); };
  por(); setTimeout(por,0); }

/* ── arrastar (desktop) ── */
function fuWire(){ const b=document.getElementById('fu-board'); if(!b) return; let dragId=null, dragCol=null;
  const limpa=()=>b.querySelectorAll('.fu-drop').forEach(x=>x.remove());
  b.querySelectorAll('.fu-card').forEach(card=>{ card.addEventListener('dragstart',e=>{ if(dragCol) return; dragId=card.dataset.id; card.classList.add('dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain',dragId); }catch(_){} });
    card.addEventListener('dragend',()=>{ dragId=null; card.classList.remove('dragging'); limpa(); b.querySelectorAll('.fu-col.drop').forEach(x=>x.classList.remove('drop')); }); });
  /* COL-ARRASTO-V2 (15/11): pega a coluna pelo CABEÇALHO inteiro (antes só a alça ⠿ de 14px pegava — segurar no nome não
     fazia nada), mostra de que lado ela vai cair e aceita soltar no vão entre colunas. Só no PC (no celular é ⋯ / ▥ Colunas). */
  const pc=!!(W.matchMedia&&W.matchMedia('(min-width:761px)').matches), limpaCol=()=>b.querySelectorAll('.fu-col').forEach(x=>x.classList.remove('drop','cai-e','cai-d'));
  const ladoDe=(col,e)=>{ const r=col.getBoundingClientRect(); return e.clientX<r.left+r.width/2?'antes':'depois'; };
  const soltaCol=(col,e)=>{ const de=dragCol; dragCol=null; limpaCol(); if(de&&col&&col.dataset.etapa!==de) fuColPara(de,col.dataset.etapa,ladoDe(col,e)); };
  if(pc) b.querySelectorAll('.fu-col-h').forEach(a=>{ const c=a.closest('.fu-col'); if(!c) return; a.draggable=true; a.classList.add('pega');
    a.addEventListener('dragstart',e=>{ e.stopPropagation(); dragCol=c.dataset.etapa; c.classList.add('dragging'); try{ e.dataTransfer.effectAllowed='move'; e.dataTransfer.setData('text/plain','col:'+dragCol); }catch(_){} });
    a.addEventListener('dragend',()=>{ dragCol=null; b.querySelectorAll('.fu-col').forEach(x=>x.classList.remove('dragging')); limpaCol(); }); });
  b.addEventListener('dragover',e=>{ if(dragCol) e.preventDefault(); });
  b.addEventListener('drop',e=>{ if(!dragCol) return; e.preventDefault(); const cs=[...b.querySelectorAll('.fu-col')]; if(!cs.length) return;
    soltaCol(cs.reduce((m,c)=>{ const r=c.getBoundingClientRect(), d=Math.abs(e.clientX-(r.left+r.width/2)); return !m||d<m.d?{c,d}:m; },null).c,e); });
  b.querySelectorAll('.fu-col').forEach(col=>{
    col.addEventListener('dragover',e=>{ if(!dragId&&!dragCol) return; e.preventDefault(); if(dragCol){ limpaCol(); if(col.dataset.etapa!==dragCol) col.classList.add(ladoDe(col,e)==='antes'?'cai-e':'cai-d'); return; } col.classList.add('drop');
      const box=col.querySelector('.fu-cards'); limpa(); const depois=[...box.querySelectorAll('.fu-card:not(.dragging)')].find(x=>e.clientY<x.getBoundingClientRect().top+x.offsetHeight/2);
      const m=document.createElement('div'); m.className='fu-drop'; box.insertBefore(m,depois||null); });
    col.addEventListener('dragleave',e=>{ if(!col.contains(e.relatedTarget)){ col.classList.remove('drop'); limpa(); } });
    col.addEventListener('drop',e=>{ e.preventDefault(); col.classList.remove('drop');
      if(dragCol){ e.stopPropagation(); soltaCol(col,e); return; }
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
function fuMover(id,X,motivo,quieto){ const c=fuAcha(id); if(!c) return; if(c.funil==='fx'){ toast('Crie a ficha primeiro (＋ Criar ficha no card)',false); return; } const fid=fuDestino(c).funil_id; if(!etapa(fid,X)) return;   /* o funil é o do card (a ficha em painel abre negócio do outro funil) */
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
  if(quieto){}
  else if(X===CLIENTE_COL[fid]&&!fuEhCliente(c)) toast(`${nome}: não achei apólice ativa na carteira — vai como emitida manual`,false);
  else toast(`${nome}: ${lbl(antes)} → ${lbl(X)}${leg?'':' (só no funil novo: o antigo não tem essa etapa)'}`,true);
  salvar(); fuRepinta(); }
/* redesenha o quadro e, se a ficha em painel estiver aberta, ela também */
function fuRepinta(){ try{ render(); }catch(_){} if(FU.pan) fuPainelRender();
  try{ const d=document.getElementById('drawer'); if(d&&d.classList.contains('aberto')&&typeof CONTATO!=='undefined'&&CONTATO&&typeof renderDrawer==='function'){
    const b=d.querySelector('.drawer-body'), st=b?b.scrollTop:0, foco=document.activeElement&&d.contains(document.activeElement)?document.activeElement.id:''; renderDrawer();
    const b2=d.querySelector('.drawer-body'); if(b2) b2.scrollTop=st; if(foco){ const f=document.getElementById(foco); if(f&&f.tagName!=='SELECT') try{ f.focus({preventScroll:true}); }catch(_){} } } }catch(_){} }   /* a ficha de sempre acompanha, sem pular pro topo */   /* a ficha de sempre (aberta por cima) acompanha */
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
  if(c.funil==='fx'){ fxInfo(id); return; }
  if(c.funil==='bn'){
    if(c.funil_contato_id&&(S.contatos||[]).some(x=>String(x.id)===String(c.funil_contato_id))){ c=fuAcha(c.funil_contato_id); }
    else { const j=esc(jsq(id));
      fuModal(`<h2>${esc(c.nome||'—')}</h2><div class="sub" style="margin:0">Este nome ainda mora no <b>Estoque</b> (está na lista de TA). Pra abrir a ficha completa ele vira contato do funil.</div>
        <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar();irPara('bn-estoque')">Ver no Estoque</button><button type="button" class="btn btn-p" onclick="fuFechar();bnPromover('${j}')">Trazer pro funil e abrir</button></div>`); return; } }
  /* FICHA-UMA-V1 (25/10): "achei que toda ficha tava completa no novo formato" — com a Ficha UX 2.0 ligada, o card abre ELA direto
     (estrelas clicáveis e os blocos MFO vão junto); o painel só fica pra quem ainda não tem a ficha nova. */
  if(typeof novoOn==='function'&&novoOn('ficha-ux2')&&typeof abrirContato==='function'){ if(FU.pan) fuPainelFechar(); abrirContato(c.id); return; }
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
  if(c.funil==='bn'){ try{ bnSalvar(); }catch(_){} } else salvar(); salvoFlash(); if(re) fuRepinta(); else try{ render(); }catch(_){} }
function fuMfoArr(id,arr,i,f,v){ const c=fuAcha(id); if(!c) return; const o=mfoF(c), l=Array.isArray(o[arr])?o[arr]:(o[arr]=[]); if(!l[i]) return;
  if(f==='ok') l[i].ok=!!v; else { v=String(v==null?'':v).trim(); if(v) l[i][f]=v; else delete l[i][f]; }
  salvar(); salvoFlash(); if(f==='ok'||f==='status'||f==='grav') fuRepinta(); }
function fuMfoAdd(id,arr){ const c=fuAcha(id); if(!c) return; const o=mfoF(c), l=Array.isArray(o[arr])?o[arr]:(o[arr]=[]);
  const el=document.getElementById('fu-add-'+arr), t=el?String(el.value||'').trim():'';
  if(arr==='pendencias'){ if(!t){ if(el) el.focus(); return; } l.push({t,ok:false}); }
  else if(arr==='lacunas'){ if(!t){ if(el) el.focus(); return; } l.push({t,grav:'média'}); }
  else if(arr==='cotacoes') l.push({data:hojeISO(),status:'Em análise'});
  else l.push({});
  const d=dobraSt(); d['m-'+arr]=1; panGravar({dobra:d}); salvar(); fuRepinta(); }
function fuMfoDel(id,arr,i){ const c=fuAcha(id); if(!c) return; const l=mfoF(c)[arr]; if(!Array.isArray(l)||!l[i]) return; l.splice(i,1); salvar(); fuRepinta(); }
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
   <section class="fu-pc0"><div class="fu-pc-l"><div class="fu-pc-id">${avatarHtml(c,'g')}<h2>${esc(c.nome||'—')}</h2></div>${resumo?`<div class="fu-res">${resumo}</div>`:''}${tel.length||email?`<div class="fu-ct">${tel.map(t=>esc(typeof telBR==='function'?telBR(t):String(t))).join(' · ')}${tel.length&&email?' · ':''}${esc(email)}</div>`:''}
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
  return `<h2>⚙ Filtros</h2>${GRUPOS.map(([g,ks])=>`<div class="fu-grp"><h3>${g}</h3><div class="fu-grid">${ks.filter(k=>FU.fid==='vi'||!SO_VI.includes(k)).map(k=>fcHtml(lista,k)).join('')}${g==='Quem toca'?tocaChips(lista):''}</div></div>`).join('')}
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
function fuColPara(de,para,lado){ const fid=FU.fid, c=colsDe(fid), a=c.ordem.indexOf(de), b=c.ordem.indexOf(para); if(a<0||b<0||a===b) return; c.ordem.splice(a,1);
  if(lado){ const k=c.ordem.indexOf(para)+(lado==='depois'?1:0); if(k===a){ c.ordem.splice(a,0,de); return; } c.ordem.splice(k,0,de); } else c.ordem.splice(b,0,de);
  colsGravar(fid,c); render(); toast(`${lbl(de)} mudou de lugar (só pra você)`,true); }
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
function fuMenu(ev,html,cls){ if(ev&&ev.stopPropagation) ev.stopPropagation(); fuFecharMenu(); const m=document.createElement('div'); m.className='fu-menu'+(cls?' '+cls:''); m.innerHTML=html; document.body.appendChild(m); _menu=m;
  const r=(ev&&ev.target&&ev.target.getBoundingClientRect)?ev.target.getBoundingClientRect():{left:20,bottom:80,top:80}, w=m.offsetWidth, h=m.offsetHeight;
  let x=Math.min(r.left,innerWidth-w-16), y=r.bottom+6; if(y+h>innerHeight-10) y=Math.max(10,r.top-h-6); m.style.left=Math.max(16,x)+'px'; m.style.top=y+'px';
  setTimeout(()=>document.addEventListener('click',function fora(e){ if(_menu&&!_menu.contains(e.target)){ fuFecharMenu(); } document.removeEventListener('click',fora); }),0); }
document.addEventListener('keydown',e=>{ if(e.key!=='Escape') return; if(_menu) fuFecharMenu(); else if(document.getElementById('fu-ov')) fuFechar(); else if(FU.pan&&!document.querySelector('#drawer.aberto')) fuPainelFechar(); });

/* ── ações da barra ── */
function fuFunil(fid){ if(FU.fid===fid) return; FU.f={}; FU.linha=''; FU.origem=''; FU.cong=false; FU.fid=fid; irPara(fid==='mfo'?'fu-mfo':'fu-vi'); }
function fuFiltro(k){ FU.f[k]=!FU.f[k]; render(); fuRefiltros(); }
function fuTirar(k){ if(k==='@toca') FU.toca=''; else if(k==='@origem') FU.origem=''; else if(k==='@dono') FU.dono=''; else if(k==='@linha') FU.linha=''; else FU.f[k]=false; render(); }
function fuLimpar(){ FU.f={}; FU.origem=''; FU.dono=''; FU.toca=''; FU.linha=''; render(); fuRefiltros(); }
function fuOrigem(v){ FU.origem=v; render(); fuRefiltros(); }
function fuDono(v){ FU.dono=v; render(); fuRefiltros(); }
function fuTocaF(v){ FU.toca=v; render(); fuRefiltros(); }
function fuLinha(v){ FU.linha=v; render(); fuRefiltros(); }
function fuCong(){ FU.cong=!FU.cong; render(); }
function fuModo(m){ FU.modo=m==='tabela'?'tabela':'kanban'; FU._modoLido=true; panGravar({modo:FU.modo}); render(); }
function fuOrdem(o){ FU.ordem=o; render(); }
function fuEnc(id){ const k=FU.fid+':'+id; FU.enc[k]=!FU.enc[k]; if(FU.enc[k]) FU.tab[FU.fid]=id; render(); }
function fuTab(id){ FU.tab[FU.fid]=id; render(); }
function fuBusca(v){ FU.q=v; clearTimeout(_qT); _qT=setTimeout(()=>{ render(); const el=document.getElementById('fu-q'); if(el){ el.focus(); try{ el.setSelectionRange(el.value.length,el.value.length); }catch(_){} } },220); }

/* ── autotestes (rodam no lpSelfCheck do portão) ── */
function fuSelfTests(ok){
  { const _C=COLS, ids=cfg('vi').map(e=>e.id), inv=ids.slice().reverse(); let a='',b2='',c3='',d4='';
    try{ COLS={vi:{ordem:inv,ocultas:[ids[1]]}}; a=colsDe('vi').ordem.join()+'|'+colsDe('vi').ocultas.join();                       /* antiga, sem base → cede */
      COLS={vi:{ordem:inv,ocultas:[],base:ids.slice()}}; b2=colsDe('vi').ordem.join();                                               /* base = funil de hoje → vale a pessoal */
      COLS={vi:{ordem:inv,ocultas:[],base:[ids[1],ids[0]].concat(ids.slice(2))}}; c3=colsDe('vi').ordem.join();                      /* mexeram no Funil & Etapas depois → cede */
      COLS={vi:{ordem:inv.filter(x=>x!==ids[2]),ocultas:[],base:ids.filter(x=>x!==ids[2])}}; d4=colsDe('vi').ordem.join(); }catch(e){ a='erro '+e; }
    COLS=_C;
    ok('COLS-SEGUE-CFG-V1: ordem pessoal antiga (sem base) e ordem feita antes de mexerem no Funil & Etapas cedem pra ordem de lá; ocultas ficam', a===ids.join()+'|'+ids[1]&&c3===ids.join());
    ok('COLS-SEGUE-CFG-V1: ordem pessoal feita em cima do funil de hoje continua valendo; etapa nova entra depois da vizinha dela (não no fim)', b2===inv.join()&&d4.split(',').indexOf(ids[2])===d4.split(',').indexOf(ids[1])+1&&d4.split(',').length===ids.length);
    ok('COL-ARRASTO-V2: a coluna é pega pelo cabeçalho inteiro e cai do lado em que foi solta', /\.fu-col-h'\)\.forEach/.test(String(fuWire))&&/ladoDe\(col,e\)/.test(String(fuWire))&&/lado==='depois'/.test(String(fuColPara)));
    const _t=FU.toca, _f=FU.f, _q=FU.q; FU.toca=''; FU.f={}; FU.q='';
    const Lp=[{c:{id:'p1',tocas:['rodrigo']},i:{d:{}}},{c:{id:'p2',tocas:['rodrigo','v@exemplo.invalid']},i:{d:{}}},{c:{id:'p3'},i:{d:{}}}], P=tocaPessoas(Lp); FU.toca='rodrigo'; const nR=Lp.filter(x=>fuPassa(x.c,x.i)).length, hc=tocaChips(Lp);
    FU.toca=_t; FU.f=_f; FU.q=_q;
    ok('TOCA-PESSOAS-V1: cada pessoa marcada vira chip com a contagem (parceiro de fora pelo nome) e filtra só os cards dela', P.length>=2&&P[0][0]==='rodrigo'&&P[0][1]===2&&nR===2&&eqNome('rodrigo')==='Rodrigo'&&/aria-pressed="true"/.test(hc)&&!/fu-ftoca/.test(String(filtrosHtml)));
  }
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
  ok('FUNIL-GLOBAL: quadro tem ⋯ por coluna, alça ⠿ e Contato rápido no card (sem abrir/recolher tudo)', (()=>{ try{ const h=colHtml('vi','novo',[{c:{id:'zz1',nome:'Fulano',funil:'nn',etapa:'TA',tarefas:[],interacoes:[]},i:fuInfo({id:'zz1',nome:'Fulano',funil:'nn',etapa:'TA',tarefas:[],interacoes:[]},'vi')}]); return /fuColMenu/.test(h)&&/fu-alca-col/.test(h)&&/Contato rápido/.test(h)&&!/Abrir tudo|Recolher tudo/.test(h); }catch(e){ return false; } })());
  /* CARD-COMPLETO-V1 (26/10): o card novo carrega o que o card antigo mostrava */
  { const hj=hojeISO(), d10=isoAddDias(hj,-10), d40=isoAddDias(hj,-40);
    const cc={id:'fu-cc',nome:'Fulano Exemplo',funil:'nn',etapa:'TA',profissao:'Médico',idade:30,telefone:'81900000000',pm:400,criado:d40,tarefas:[],
      interacoes:[{id:'e1',k:'etapa',de:'SitPlan',para:'SitPlan',dia:d40},{id:'e2',k:'etapa',de:'SitPlan',para:'TA',dia:d10}]};
    const ic=fuInfo(cc,'vi'); let h='', er=''; try{ h=cardHtml({c:cc,i:ic},'vi'); }catch(e){ er=String(e&&e.message||e); }
    const k=fuCiclo(cc,ic);
    ok('CARD-COMPLETO-V1: card novo traz profissão · idade, telefone, status/lista, ⏱️ tempo na etapa, prêmio · PA, próxima atividade e → próxima etapa'+(er?' — '+er:''), !er&&/Médico · 30a/.test(h)&&/fu-ciclo/.test(h)&&/PA /.test(h)&&/tarchip/.test(h)&&/fuAvancar\(/.test(h)&&/tel/.test(h));
    ok('CARD-COMPLETO-V1: TA → SitPlan (os dois viram "Novo") não zera o relógio da etapa nova', !!k&&k.d>=39);
    ok('CF-ALINHA-V1: card sem próximo passo guarda o lugar do ✓ (ícones do Contato rápido não pulam)', (()=>{ const sem=Object.assign({},ic,{prox:null}); let hh=''; try{ hh=cardHtml({c:cc,i:sem},'vi'); }catch(_){ } return hh.indexOf('fu-cf-v')>0&&hh.indexOf('aria-label="Feito"')<0; })());
    ok('QUADRO-ALTURA-V1: no PC o quadro tem altura da tela e a coluna rola sozinha; no celular fica como era', (()=>{ const css=[...document.querySelectorAll('style')].map(x=>x.textContent).join(''); return css.indexOf('.fu-board.alt .fu-cards{overflow-y:auto')>=0&&typeof fuAltura==='function'&&/\(min-width:761px\)\{\s*\.fu-board\.alt\{/.test(css); })());
    ok('CARD-COMPLETO-V1: → próxima etapa pula a Revisita (opcional) e não existe depois do fim', fuProxCol('vi','oi')==='pc'&&fuProxCol('vi',cfg('vi').filter(e=>!e.enc).slice(-1)[0].id)===null);
    const tt=fuTaxas('vi',[{c:{id:'t1',funil:'nn',etapa:'OI/FF',interacoes:[]}},{c:{id:'t2',funil:'nn',etapa:'TA',interacoes:[]}},{c:{id:'t3',funil:'bn'}}]);
    ok('CARD-COMPLETO-V1: % que passa conta quem alcançou (Novo → OI = 1 de 2; Estoque fora)', !!tt.novo&&tt.novo.n1===2&&tt.novo.n2===1&&tt.novo.pct===50); }
  /* T3b (26/10): cliente da carteira sem ficha = card fantasma em Apólice Emitida, só leitura */
  { const g=fxDeLinha({fonte:'carteira',ref_id:'r-teste',dono:'x@exemplo.invalid',nome:'Beltrano Carteira',telefone:'81900000009',etapa_id:'emitida',extra:{n_apolices:2,premio_mensal:300}});
    let h=''; try{ h=cardHtml({c:g,i:fuInfo(g,'vi')},'vi'); }catch(e){ h='ERRO '+e.message; }
    ok('T3b: fantasma da carteira mora em Apólice Emitida, sem ⚠, com "＋ Criar ficha" e sem arrastar/mover', fuDestino(g).etapa_id==='emitida'&&fuInfo(g,'vi').semProx===false&&/fxCriarFicha/.test(h)&&!/draggable="true"/.test(h)&&!/fuMoverMenu/.test(h));
    ok('T3b: fantasma não entra na % que passa', Object.keys(fuTaxas('vi',[{c:g}])).length===0); }
  /* QUEM-TOCA-V1 */
  { const cc={id:'fu-tq',nome:'Fulano Toca',funil:'nn',etapa:'TA',tarefas:[],interacoes:[],_dono:'d@exemplo.invalid'}; const _m=EQ.m, _t=EQ.times;
    EQ.m={'d@exemplo.invalid':{nome:'Dono Exemplo',sigla:'DE',cor:'#123456'},'v@exemplo.invalid':{nome:'Victor Exemplo'}}; EQ.times={'d@exemplo.invalid':['v@exemplo.invalid']};
    const h0=tocaHtml(cc); cc.toca='v@exemplo.invalid'; const h1=tocaHtml(cc), t=eqTime(cc);
    ok('QUEM-TOCA-V1: card sem marcação mostra a sigla do dono em contorno (DE); marcado mostra a sigla (VE) cheia; o time da base = dono + quem trabalha nela', /fu-toca sug/.test(h0)&&/>DE</.test(h0)&&/>VE</.test(h1)&&t[0]==='d@exemplo.invalid'&&t.includes('v@exemplo.invalid')&&eqSigla('d@exemplo.invalid')==='DE');
    ok('QUEM-TOCA-V1: filtros "Comigo / Com outra pessoa / Ninguém marcado" existem e Estoque não conta como "ninguém"', !!FILTROS.toca_eu&&!!FILTROS.toca_outro&&FILTROS.toca_sem[1]({funil:'nn'})===true&&FILTROS.toca_sem[1]({funil:'bn'})===false&&FILTROS.toca_outro[1](cc)===(cc.toca!==eqEu()));
    /* QUEM-TOCA-V2: mais de uma pessoa */
    const cm={id:'fu-tq2',nome:'Beltrano Toca',funil:'nn',etapa:'TA',tarefas:[],interacoes:[],_dono:'d@exemplo.invalid',toca:'v@exemplo.invalid'};
    let lm, hm, ok3; const _s=window.salvar; S.contatos=S.contatos||[]; S.contatos.push(cm); window.salvar=()=>{};   /* card de teste na lista real; nada é gravado */
    try{ fuToca('fu-tq2','r@exemplo.invalid'); lm=tocaLista(cm).join(); hm=tocaHtml(cm); fuToca('fu-tq2','v@exemplo.invalid'); ok3=tocaLista(cm).join()==='r@exemplo.invalid'&&cm.toca==='r@exemplo.invalid'; fuToca('fu-tq2',''); }
    finally{ window.salvar=_s; const ix=S.contatos.indexOf(cm); if(ix>=0) S.contatos.splice(ix,1); }
    ok('QUEM-TOCA-V2: marca mais de uma pessoa (soma sem tirar), card mostra +1, desmarcar tira só aquela, "ninguém" limpa; c.toca segue = 1º da lista',
      lm==='v@exemplo.invalid,r@exemplo.invalid'&&/fu-toca-mais">\+1</.test(hm)&&ok3&&!cm.toca&&!cm.tocas&&tocaLista({toca:'X@a.b'}).join()==='x@a.b'
      &&FILTROS.toca_eu[1]({tocas:['zz@a.b',String(eqEu()||'eu@x').toLowerCase()]})===!!eqEu());
    EQ.m=_m; EQ.times=_t; }
  /* LISTA-GLOBAL-V1 + FOTO-WA-V1 (23/11) */
  { const _ts=FU.ts, _et=FU.et, _fm=FOTO.m, _fl=FOTO.lido, _nv=W.novoOn; let h='', hv='', ord='', av='', av0='', erro='';
    const mk=(id,nome,et,tel,extra)=>({c:Object.assign({id,nome,funil:'nn',etapa:et,telefone:tel,tarefas:[],interacoes:[]},extra||{}),i:null});
    const L=[mk('fu-lg1','Fulano de Tal','TA','(81) 99999-0001',{recomendante:'Sicrano'}),mk('fu-lg2','Beltrano Souza','P/C','',{}),mk('fu-lg3','Abel Zeta','TA','81988880003',{renda:'20000'})];
    try{ L.forEach(x=>x.i=fuInfo(x.c,'vi')); FU.et={}; FU.ts=null; h=tabelaHtml('vi',L);
      FU.ts={k:'nome',d:1}; ord=tabOrdenar(L,'vi').map(x=>x.c.id).join(); FU.ts={k:'renda',d:-1}; ord+='|'+tabOrdenar(L,'vi')[0].c.id+'|'+tabOrdenar(L,'vi').length;
      FU.et={vi:L[1].i.d.etapa_id}; FU.ts=null; hv=tabelaHtml('vi',L);
      W.novoOn=k=>k==='foto-wa'?true:(_nv?_nv(k):false); FOTO.lido=true; FOTO.m=fotoMapa([{contato_tel_norm:'5581999990001',foto:'https://exemplo-wamedia.s3.amazonaws.com/a/b/media.jpg'},{contato_tel_norm:'5581988880003',foto:'javascript:alert(1)'},{contato_tel_norm:'5581977770009',foto:'https://exemplo.s3.amazonaws.com/x" onerror="y'}]);
      av=avatarHtml(L[0].c); av0=avatarHtml(L[2].c)+'|'+avatarHtml(L[2].c,'p',true)+'|'+Object.keys(FOTO.m).length;
    }catch(e){ erro=String(e&&e.message||e); } finally{ FU.ts=_ts; FU.et=_et; FOTO.m=_fm; FOTO.lido=_fl; W.novoOn=_nv; }
    ok('LISTA-GLOBAL-V1: a vista ☰ traz o trilho de etapas com contagem (Todos + cada etapa), linha com iniciais, nome, telefone e "Sem telefone", e cabeçalho que ordena'+(erro?' — '+erro:''),
      !erro&&/class="fu-rail"/.test(h)&&/<table class="fu-lt-t">/.test(h)&&(typeof T_CARTOES_PULAR==='undefined'||T_CARTOES_PULAR.includes('fu-lt-t'))&&/<span class="nm">Todos<\/span><span class="q">3<\/span>/.test(h)&&(h.match(/fuEtapaSel\(/g)||[]).length===cfg('vi').length+1&&/class="fu-foto"[^>]*>FT</.test(h)&&/Sem telefone/.test(h)&&/fuTabOrd\('nome'\)/.test(h)&&/fu-lg-ord/.test(h)&&(h.match(/<tr onclick/g)||[]).length===3);
    ok('LISTA-GLOBAL-V1: escolher uma etapa no trilho mostra só quem está nela; ordenar por nome sobe em ordem alfabética e o vazio fica sempre no fim',
      !erro&&(hv.match(/<tr onclick/g)||[]).length===1&&/Beltrano Souza/.test(hv)&&!/Fulano de Tal<\/button>/.test(hv)&&ord==='fu-lg3,fu-lg2,fu-lg1|fu-lg3|3');
    ok('FOTO-WA-V1: a foto casa pelo telefone (com ou sem 55 e 9º dígito), só link https da Amazon entra, e sem foto ficam as iniciais (no card do quadro, nada)',
      !erro&&telChave('+55 (81) 99999-0001')==='8199990001'&&telChave('8199990001')==='8199990001'&&telChave('123')===''&&/<img src="https:\/\/exemplo-wamedia\.s3\.amazonaws\.com\/a\/b\/media\.jpg"/.test(av)&&/onerror="this\.remove\(\)"/.test(av)&&/^<span class="fu-foto"[^>]*>AZ<\/span>\|\|1$/.test(av0)&&!fotoUrlOk('http://x.s3.amazonaws.com/a')&&!fotoUrlOk('https://evil.example/a.jpg'));
    ok('FOTO-WA-V1: nasce só na base dele (novoOn foto-wa) — sem a chave, nenhuma foto é buscada nem desenhada', /fotoOn\(\)/.test(String(fotoCarregar).slice(0,80))&&/fotoOn\(\)/.test(String(fotoDe).slice(0,60))); }
  { /* TAGS-LISTA-V1 · UNIR-LISTA-V1 · DUP-LISTA-V1 */
    let erro='', r=null, ht='', hb='', hd='', hm='', tg=[]; const _sel=FU.sel, _dup=FU.dup, _sc=S.contatos, _fid=FU.fid, lp=S.activeUser;
    try{ tg=tagsDe({tags:' VIP, médico ;vip,, — ,a"b'});
      const mk=(id,et,cr,o)=>Object.assign({id,nome:'Fulano de Tal',funil:'nn',etapa:et,telefone:'81999990001',criadoEm:cr,lp,interacoes:[],tarefas:[],recs:[],eventos:[],planos:[]},o);
      const a=mk('fu-u1','TA','2026-01-10',{tags:'VIP',cidade:'',interacoes:[{id:'i1',k:'nota',l:'a'}]}), b=mk('fu-u2','P/C','2026-03-02',{tags:'médico, vip',cidade:'Recife',email:'f@exemplo.invalid',interacoes:[{id:'i1',k:'nota',l:'a'},{id:'i2',k:'nota',l:'b'}]});
      r=fuFundir(b,a); S.contatos=[a,b]; FU.fid='vi'; FU.sel={'fu-u1':1}; FU.dup=false;
      const L=[a,b].map(c=>({c,i:fuInfo(c,'vi')})); ht=tabelaHtml('vi',L); hb=selBarHtml(); hm=tagMenuHtml('fu-u1'); FU.dup=true; hd=tabelaHtml('vi',L);
    }catch(e){ erro=String(e&&e.message||e); } finally{ S.contatos=_sc; FU.fid=_fid; FU.sel=_sel; FU.dup=_dup; FU._dupG=[]; FU._selVis=[]; FU.unir=null; }
    ok('TAGS-LISTA-V1: tags são texto livre em c.tags (sem repetir, sem vazio, sem aspas), aparecem na linha com ＋ pra editar e o editor oferece tirar, criar e as já usadas'+(erro?' — '+erro:''),
      !erro&&tg.join('|')==='VIP|médico|a b'&&/<span class="fu-tg">VIP<\/span>/.test(ht)&&(ht.match(/class="fu-tg add"/g)||[]).length===2&&/fuTagPor\('fu-u1','VIP',1\)/.test(hm)&&/id="fu-tg-in"/.test(hm)&&/fuTagPor\('fu-u1','médico'\)/.test(hm));
    ok('UNIR-LISTA-V1: caixinha por linha + barra de selecionados (Unir só com 2 ou mais); a fusão mantém o card mais antigo, soma histórico e tags e preenche o vazio com o outro',
      !erro&&(ht.match(/onchange="fuSel\(/g)||[]).length===2&&/class="sel"/.test(ht)&&/fuSelTodos/.test(ht)&&/1 selecionado</.test(hb)&&/fuUnirAbrir\(\)" disabled/.test(hb)&&r&&r.id==='fu-u1'&&r.cidade==='Recife'&&r.email==='f@exemplo.invalid'&&r.tags==='VIP, médico'&&r.interacoes.length===2);
    ok('DUP-LISTA-V1: mesmo telefone em dois cards acende "Possíveis duplicados"; a vista agrupa e cada grupo traz Unir / Mesma pessoa / Não é a mesma pessoa (nada se une sozinho)',
      !erro&&/Possíveis duplicados · 1 grupo/.test(ht)&&(hd.match(/<tr class="grp">/g)||[]).length===1&&/o mesmo telefone/.test(hd)&&/fuDupAcao\(0,'unir'\)/.test(hd)&&/fuDupAcao\(0,'pessoa'\)/.test(hd)&&/fuDupAcao\(0,'nao'\)/.test(hd)&&(hd.match(/<tr onclick/g)||[]).length===2&&/Voltar pra lista/.test(hd)); }
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
Object.assign(W,{fuStarsHtml:starsHtml,fuMfoBlocosHtml:mfoBlocos,fuCss,fuModal,fuColsDe:colsDe,fuColMenu,fuColLado,fuColPara,fuTocaOutro,fuTocaOutroOk,fuColEsconder,fuEtapaNova,fuEtapaCriar,fuEtapaRenomear,fuEtapaRenOk,fuEtapaCor,fuEtapaCorOk,fuSalvoAplicar,fuSalvoApagar,fuSalvoSalvar,fuFeito,fuOrdemMenu,fuSoltar});
Object.assign(W,{fuTocaHtml:tocaHtml,fuCicloHtml:cicloHtml,fuInfo,fuTocaMenu,fuToca,fuTocaF,fxCriarFicha,fxCarregar,FX_STATE:FX,fuAvancar,fuCiclo,fuTaxas,viewFunilNovo,fuSincLegado,fuSelfTests,fuPrefsSubir,fuPrefsAplicar,fuDestino,fuVoltaLegado,fuPopulacao,
  fuAbrir,fuMover,fuMotivoOk,fuMoverMenu,fuLigar,fuZap,fuRegistrar,fuDelay,fuFiltrosAbrir,fuColunas,fuColVer,fuColMover,fuColPadrao,fuMais,fuDesempenho,fuExportar,
  fuFechar,fuFecharMenu,fuFunil,fuFiltro,fuTirar,fuLimpar,fuOrigem,fuDono,fuLinha,fuCong,fuModo,fuOrdem,fuEnc,fuTab,fuBusca,fuTabOrd,fuTabOrdSel,fuEtapaSel,fuTagMenu,fuTagPor,fuTagNova,fuSel,fuSelTodos,fuSelLimpar,fuUnirAbrir,fuUnirOk,fuDupVer,fuDupAcao,fuFundir,fuTagsDe:tagsDe,fuAvatarHtml:avatarHtml,fuFotoCarregar:fotoCarregar,FU_FOTO:FOTO});
})();
