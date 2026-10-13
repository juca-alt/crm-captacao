// ===== NORMALIZAÇÃO / FUNIL — ports FIÉIS do index.html (não "melhorar" aqui:
// qualquer divergência quebra o dedupe e a consistência com o CRM).
// Fonte: index.html — normPhone L1281, firstName L1282, normEmail L1284,
// normName L2069, fuzzyNameKey L1298, firstLastKey L1308, FN_CFG_DEFAULT L945,
// rebuildFunnel L962, fnNormalize L975.
// Funções puras; carregado no SW e nos content scripts.

function normPhone(raw){if(!raw)return{telefone:null,e164:null};let d=raw.replace(/\D/g,'');if(d.startsWith('55')&&d.length>11)d=d.slice(2);if(d.length===11)return{telefone:`(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`,e164:`+55${d}`};if(d.length===10)return{telefone:`(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`,e164:`+55${d}`};return{telefone:raw,e164:null};}
function firstName(n){return (n||'').trim().split(' ')[0]||'';}
function normEmail(e){ e=(e||'').trim().toLowerCase(); return /@/.test(e)?e:null; }
function normName(s){return (s||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/\s+/g,' ').trim();}
function fuzzyNameKey(s){
  let n=normName(s);
  n=n.split(/[|·,(]/)[0];
  n=n.replace(/\p{Extended_Pictographic}/gu,'')
     .replace(/[^a-z0-9 ]/g,' ')
     .replace(/^(dr|dra|prof|eng|adv|sr|sra)\s+/,'')
     .replace(/\s+/g,' ').trim();
  return n;
}
function firstLastKey(s){ const p=fuzzyNameKey(s).split(' ').filter(Boolean); return p.length>=2?(p[0]+' '+p[p.length-1]):null; }

// Variantes e164 para busca por telefone vindo do WhatsApp: JIDs antigos vêm SEM
// o 9º dígito (10 dígitos locais) enquanto o CRM guarda 11 — consultar as duas
// formas, senão matches reais falham silenciosamente. Número não-BR → e164 cru.
function phoneE164Variants(raw){
  let d=String(raw||'').replace(/\D/g,'');
  if(!d) return [];
  if(d.startsWith('55')&&d.length>11) d=d.slice(2);
  const out=new Set();
  if(d.length===11){ out.add('+55'+d); if(d[2]==='9') out.add('+55'+d.slice(0,2)+d.slice(3)); }
  else if(d.length===10){ out.add('+55'+d); out.add('+55'+d.slice(0,2)+'9'+d.slice(2)); }
  else out.add('+'+String(raw).replace(/\D/g,''));
  return [...out];
}

// ===== FUNIL — cópia do FN_CFG_DEFAULT (fallback quando app_settings.funil_cfg
// estiver inacessível) + build dos derivados (espelho de rebuildFunnel).
const FN_CFG_DEFAULT = { etapas: [
  {key:'Qualificacao', label:'Qualificação', color:'#f59e0b', sys:true, status:['Aguardando Qualificacao','Qualificado']},
  {key:'Conexao',      label:'Conexão',      color:'#2563eb', sys:true, status:['A Enviar Convite','Convite Enviado','Convite Aceito (s/ telefone)','Convite Aceito (c/ telefone)','Convite Nao Aceito']},
  {key:'SitPlan',      color:'#a855f7', status:['Com Telefone','Priorizado']},
  {key:'TA',           label:'T.A.', color:'#8b5cf6', status:['1a Abordagem','Em Tentativa','Nao Atendeu','Follow up','TA Agendada','Retornar em outro momento','Delay OT']},
  {key:'OT',           color:'#16a34a', status:['OT Agendada','Confirmacao de OT','OT Realizada','TA Reagendar OT','Nao Compareceu']},
  {key:'FIP 1',        color:'#0d9488', status:['FIP Agendado','Confirmacao de FIP','FIP Realizado']},
  {key:'FIP 2',        color:'#0e7490', status:[]},
  {key:'Pré-TS',       color:'#0891b2', status:['Onboarding']},
  {key:'TS1',          color:'#10b981', status:[]},
  {key:'TS2',          color:'#047857', status:['Convertido']},
  {key:'Dormente',     color:'#6b7280', sys:true, status:['Dormente']},
  {key:'Descartado',   color:'#ef4444', sys:true, status:['Sem Perfil','Sem Interesse','Momento Ruim','Area de Seguros','Fora de Regiao','Sumiu']}
]};
function fnNormalize(cfg){
  if(!cfg||!Array.isArray(cfg.etapas)||!cfg.etapas.length) return JSON.parse(JSON.stringify(FN_CFG_DEFAULT));
  const have=new Set(cfg.etapas.map(e=>e.key)), front=[], back=[];
  FN_CFG_DEFAULT.etapas.forEach(d=>{ if(d.sys && !have.has(d.key)){ (d.key==='Qualificacao'||d.key==='Conexao'?front:back).push(JSON.parse(JSON.stringify(d))); } });
  cfg.etapas=[...front, ...cfg.etapas, ...back];
  cfg.etapas.forEach(e=>{ const d=FN_CFG_DEFAULT.etapas.find(x=>x.key===e.key); if(d&&d.sys){ e.sys=true; if(!e.label)e.label=d.label; if(!(e.status&&e.status.length))e.status=d.status.slice(); } });
  return cfg;
}
function buildFunnel(cfg){
  cfg=fnNormalize(cfg?JSON.parse(JSON.stringify(cfg)):null);
  const F={ETAPAS:[],ETAPA_LABEL:{},STATUS_BY_ETAPA:{},ETAPA_COLOR:{},STATUS_ETAPA:{},ALL_STATUS:[]};
  F.ETAPAS=cfg.etapas.map(e=>e.key);
  cfg.etapas.forEach(e=>{
    F.ETAPA_LABEL[e.key]=e.label||e.key;
    F.ETAPA_COLOR[e.key]=e.color||'#64748b';
    F.STATUS_BY_ETAPA[e.key]=(e.status||[]).slice();
    (e.status||[]).forEach(s=>{ if(F.STATUS_ETAPA[s]==null) F.STATUS_ETAPA[s]=e.key; });
  });
  F.ALL_STATUS=F.ETAPAS.flatMap(e=>F.STATUS_BY_ETAPA[e]||[]);
  return F;
}

// Origens aceitas pelo app (openNovo L3592) + WhatsApp (novo canal desta extensão)
const ORIGEM_OPTS=['WhatsApp','LinkedIn','Rec LP','Rec OT','Rec Cliente','Rec Familiar','Instagram','Facebook','Abordagem Direta'];
const REC_ORIGENS=['Rec LP','Rec OT','Rec Cliente','Rec Familiar'];

function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

// Funis da Visão LP — port fiel do vendas.html (ETAPAS L433 / ETAPAS_BC L441, v0.4.x).
// Contato LP tem funil:'nn' (Novos Negócios, ausente = nn) ou 'bc' (Base de Clientes).
const LPC_FUNIS={
  nn:{label:'Novos Negócios', cor:'#8b5cf6', etapas:['SitPlan','TA','OI/FF','P/C','C2','N','FA','EMISSÃO','DELIVERY','Não','Prop. Cancelada','Apól. Cancelada']},
  bc:{label:'Base de Clientes', cor:'#0d9488', etapas:['Clientes Ativos','Pendência/Atraso','Contato Agenda/Revisita','Agendada Revisita','Novo Negócio/Resolução pós Revisita','N/Emissão','Emissão Final','Delivery','Venda ganha','Venda perdida']}
};
/* 2.7.0: 1ª etapa de cada funil (FUNIL_FAB do vendas.html) — fallback quando o Funil & Etapas não trouxer o funil */
const LPC_ETAPA0={nn:'SitPlan',bc:'Clientes Ativos',vg:'Oportunidade',prud:'Oportunidade',mfo:'Oportunidade','vg-bc':'Clientes Ativos','prud-bc':'Clientes Ativos','mfo-bc':'Clientes Ativos'};
function lpcFunilDe(c){ return (c&&c.funil==='bc')?'bc':'nn'; }   /* só p/ rótulo/cor legados — NUNCA pra gravar (v2.0) */
/* v2.0: o funil GRAVADO é preservado como veio (vg, prud, mfo, *-bc, prospects…). Antes o normalizador forçava 'nn' e editar
   um contato de VG pela extensão o jogava pra Novos Negócios. Só vazio vira 'nn'; 'bn' (Estoque) nunca passa pelo card do funil. */
function lpcFunilGravar(c){ const f=c&&typeof c.funil==='string'&&c.funil.trim(); return f||'nn'; }

// ===== SHAPE CANÔNICO DO CONTATO LP — port fiel de salvarNovoContato
// (vendas.html L1593-1606, v0.9.4). O contato tem que NASCER completo aqui:
// até a v0.6.1 a extensão gravava um subconjunto em lp_contatos.dados e o
// drawer do app estourava em `c.infoclient.pessoais` — com a base real 100%
// vinda daqui, NENHUM contato abria (fix #38). O vendas.html segue com o
// `normContato()` (L680) como rede de segurança pros registros antigos; campo
// novo no shape do app entra aqui junto.
function lpcHojeISO(){ const d=new Date(); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }

// Completa o que faltar SEM sobrescrever o que já veio (espelho do normContato
// do app + os campos que só o salvarNovoContato cria: ance/idade/sitplan/criadoEm).
function lpcNormContato(c){
  c=(c&&typeof c==='object')?c:{};
  if(!c.infoclient||typeof c.infoclient!=='object') c.infoclient={pessoais:false,familiar:false,financeiro:false,saude:false};
  ['recs','eventos','planos','interacoes'].forEach(k=>{ if(!Array.isArray(c[k])) c[k]=[]; });
  ['sexo','profissao','origem','taStatus'].forEach(k=>{ if(c[k]==null||c[k]==='') c[k]='—'; });
  if(typeof c.taTentativas!=='number') c.taTentativas=Number(c.taTentativas)||0;
  if(typeof c.estrelas!=='number') c.estrelas=Number(c.estrelas)||0;
  if(c.notas==null) c.notas='';
  if(c.ance===undefined) c.ance=null;        // null = ANCE não preenchido (anceScore do app trata)
  if(c.idade===undefined) c.idade=null;
  if(c.sitplan===undefined) c.sitplan=null;  // fora da lista de discagem (a extensão não agenda SitPlan)
  if(c.telefone===undefined) c.telefone=null;
  // espelho canônico do prêmio (regra_premio do normContato, v0.9.1): `pm` é o
  // campo do funil; `premio_mes` é o canônico da ficha. Só ESPELHA, nunca inventa.
  if(c.pm!=null&&c.premio_mes==null){ const n=Number(c.pm); if(isFinite(n)&&n>0) c.premio_mes=n; }
  c.funil=lpcFunilGravar(c);                 // v2.0: preserva vg/prud/mfo/prospects; ausente ⇒ 'nn'
  if(!c.etapa&&LPC_ETAPA0[c.funil]) c.etapa=LPC_ETAPA0[c.funil];  // nn → SitPlan, bc → Clientes Ativos, pipes → 1ª etapa (2.7.0)
  if(!c.criadoEm) c.criadoEm=lpcHojeISO();   // data LOCAL (hojeISO do app), não UTC
  return c;
}

// Contato novo no shape completo: `campos` = o que a UI coletou (nome, telefone,
// funil, notas…); o resto nasce aqui no padrão do app.
function lpcNovoContato(campos){
  const c=Object.assign({},campos||{});
  if(!c.id) c.id='wa'+Date.now();
  if(!c.lp) c.lp='gustavo';                  // a extensão não tem seletor de LP dono (no app: S.activeUser)
  if(!c.origemCadastro) c.origemCadastro='whatsapp-ext';
  return lpcNormContato(c);
}

// ===== Modelos de mensagem — MESMOS do CRM (app_settings 'msg_templates';
// default = MSG_TPL_DEFAULT do index.html L1339; fillTpl = port fiel L1345).
// A extensão só COPIA a mensagem preenchida — enviar é manual (anti-ban).
const MSG_TPL_DEFAULT=[
  {nome:'Recomendação (WhatsApp)',texto:'Me chamo Gustavo Jucá. Não nos conhecemos ainda. Quem me passou seu telefone foi {{recomendante}}. Ela me recomendou seu nome a respeito de uma oportunidade profissional. Posso retornar para passar mais detalhes?'},
  {nome:'Conexão LinkedIn',texto:'Olá {{primeiro_nome}}, tudo bem contigo? Encontrei seu perfil por meio de colegas que temos em comum. Acredito que pode haver sinergia em um projeto pelo qual sou responsável. Espero poder me conectar e evoluir essa conversa caso faça sentido para ambos.'}
];
function fillTpl(txt,l){ l=l||{}; return (txt||'').replace(/\{\{\s*primeiro_nome\s*\}\}/gi,firstName(l.nome)).replace(/\{\{\s*recomendante\s*\}\}/gi,l.recomendante||'').replace(/\{\{\s*nome\s*\}\}/gi,l.nome||''); }

// Tokens de nome p/ casar apelidos operacionais do WhatsApp ("OT Fulano Jr Due
// Rec LP Daniel") com o nome limpo do CRM: quebra em palavras ≥3 letras.
function nameTokens(s){ return fuzzyNameKey(s||'').split(' ').filter(w=>w.length>=3); }
/* 2.7.0 REC-DO-NOME — port FIEL do recDoNome do vendas.html (REC-DO-NOME-V1). O nome da conversa carrega quem
   indicou: "Fulano Rec Beltrana Silva" → pessoa Fulano · recomendante Beltrana Silva. Antes a busca por nome usava
   TODAS as palavras e casava a conversa do indicado com a recomendante — caso real de 01/10. */
function recDoNome(nome){
  let s=String(nome||'').replace(/\s+/g,' ').trim(); if(!s) return null;
  const RE=/(^|[\s\-–—(])rec\.?\s*:?\s+(?=\S)/i;
  if(!RE.test(s)) return null;
  let ehRec=false;
  if(/^rec\.?\s*:?\s+/i.test(s)){ ehRec=true; s=s.replace(/^rec\.?\s*:?\s+/i,''); }
  const m=s.match(/\s*[\-–—(]?\s*\brec\.?\s*:?\s+(.+)$/i);
  let pessoa=s, quem='';
  if(m){ pessoa=s.slice(0,m.index); quem=m[1]; }
  pessoa=pessoa.replace(/[\s\-–—(]+$/,'').trim();
  quem=quem.replace(/[)\s]+$/,'').replace(/\s+(cliente|novo|nova)\s*$/i,'').trim();
  if(!pessoa||!quem) return null;
  return { nome:pessoa, recomendante:quem, ehRec, original:String(nome).trim() };
}
/* a parte do nome da conversa que é a PESSOA (sem o "Rec Fulano") — é só ela que a busca por nome compara */
function nomePessoaDoChat(s){ const r=recDoNome(s); return r?r.nome:String(s||''); }
// Match FORTE por nome: primeiro+último nome do candidato contidos nos tokens do
// apelido do chat. Continua sendo nome (nunca 100%), mas com essa régua o único
// candidato forte pode abrir o card direto — com aviso pra conferir.
function nameStrongMatch(chatName,candName){
  const set=new Set(nameTokens(nomePessoaDoChat(chatName)));   /* 2.7.0: a recomendante não é a pessoa */
  const fl=firstLastKey(candName||'');
  return !!(fl&&fl.split(' ').every(t=>set.has(t)));
}


// ===== EXTENSÃO 2.0 (28/09/2026) — Visão LP no WhatsApp com o MESMO cadastro do app =====
// Funil & Etapas (app_settings.lp_funil_cfg), status por etapa, motivos de perda (status da etapa de
// encerramento), listas de TA (lp_listas_ta + em uso) e registros no histórico no formato do vendas.html
// (interacoes: {id,k,l,dia,ts,por}). Tudo PURO aqui (roda no SW e no painel) — espelho das regras:
//   etCfgKey/etStatusOpts/etStatusDe/logEtapa/etSetStatusDe/taListaDefinir/jornadaAddNota do app.
function lpcUid(){ return 'i'+Date.now().toString(36)+Math.random().toString(36).slice(2,6); }
function lpcCfgKey(c){ const f=c&&c.funil; return (!f||f==='nn')?'lp':f; }
function lpcEtapasDe(cfg,c){ const arr=(cfg&&cfg[lpcCfgKey(c)])||null;
  if(Array.isArray(arr)&&arr.length) return arr.filter(e=>e&&e.id).map(e=>({id:e.id,label:String(e.label||e.id).trim()||e.id,cor:e.cor||'cinza',enc:!!e.enc,status:Array.isArray(e.status)?e.status.map(x=>String(x||'').trim()).filter(Boolean):[]}));
  const fab=LPC_FAB_EXTRA[lpcCfgKey(c)];   /* 2.8.1: VG/Prud/MFO (+Base) sem Funil & Etapas no banco → esqueleto de fábrica do app */
  if(fab) return fab.map(([id,cor,enc])=>({id,label:id,cor,enc:!!enc,status:[]}));
  const f=LPC_FUNIS[lpcFunilDe(c)]; return f.etapas.map((id,i)=>({id,label:id,cor:'cinza',enc:/^(N[aã]o|Prop\. Cancelada|Ap[oó]l\. Cancelada|Venda perdida)$/.test(id),status:[]})); }
/* 2.8.1: FUNIL_FAB do vendas.html (FUNIS-EXTRA-V1 / PIPES-V1) — só os funis extras; nn/bc seguem no LPC_FUNIS de sempre */
const _FAB_PIPE=[['Oportunidade','cinza'],['Em contato','azul'],['Proposta','roxo'],['Fechamento','amarelo'],['Ganho','verde',1],['Perdido','verm',1]];
const _FAB_PIPE_BC=[['Clientes Ativos','verde'],['Contato/Revisita','amarelo'],['Revisita agendada','azul'],['Proposta','roxo'],['Fechamento','amarelo'],['Ganho','verde',1],['Perdido','verm',1]];
const LPC_FAB_EXTRA={vg:_FAB_PIPE,prud:_FAB_PIPE,mfo:_FAB_PIPE,'vg-bc':_FAB_PIPE_BC,'prud-bc':_FAB_PIPE_BC,'mfo-bc':_FAB_PIPE_BC};
/* 2.8.1: os funis que a ficha do app oferece no select "Funil: …" (FUNIS do vendas.html, mesma ordem e rótulos) */
const LPC_FUNIS_APP=[['nn','Novos Negócios'],['bc','Negócios Base de Clientes'],['vg','Vida em Grupo'],['prud','Prud. Demais'],['mfo','MFO'],
  ['vg-bc','Vida em Grupo · Base'],['prud-bc','Prud. Demais · Base'],['mfo-bc','MFO · Base']];
function lpcFunilApp(c){ const f=c&&c.funil; return (f&&f!=='nn'&&LPC_FAB_EXTRA[f])?f:(f==='bc'?'bc':'nn'); }   /* funilDe do app */
function lpcFunilNome(f){ const x=LPC_FUNIS_APP.find(y=>y[0]===f); return x?x[1]:f; }   /* funilNome do app */
/* 1ª etapa de fluxo do funil (a que o negócio recebe ao trocar de funil) */
function lpcEtapa0De(cfg,f){ const et=lpcEtapasDe(cfg,{funil:f}); const e=et.find(x=>!x.enc)||et[0]; return e?e.id:''; }

/* ===== 2.8.1 ATIVIDADES — port fiel do vendas.html (TAR_TIPOS, tarCriar, tarConcluir, tarAdiar/tarNovaData, tarGcalUrl) =====
   A tarefa vive em dados.tarefas do contato: {id, tipo, tit, quando:'AAAA-MM-DD', hora:'HH:MM'|'', dur, feito:ISO|null,
   notas, criadoEm:ISO, por}. Criar e concluir também registram no histórico (interacoes, k:'tarefa'), igual ao app. */
const LPC_TAR_TIPOS=[['ligar','\u{1F4DE}','Ligar'],['whats','\u{1F4AC}','WhatsApp'],['reuniao','\u{1F91D}','Reunião'],
  ['proposta','\u{1F4C4}','Enviar proposta'],['follow','\u{1F501}','Follow-up'],['outro','✳️','Outro']];
function lpcTarTipo(k){ return LPC_TAR_TIPOS.find(t=>t[0]===k)||LPC_TAR_TIPOS[LPC_TAR_TIPOS.length-1]; }
function lpcIsoAddDias(iso,n){ const p=String(iso).split('-').map(Number); const dt=new Date(p[0],p[1]-1,p[2]+n); return dt.getFullYear()+'-'+String(dt.getMonth()+1).padStart(2,'0')+'-'+String(dt.getDate()).padStart(2,'0'); }
/* tarCriar: tipo padrão follow, título vazio = nome do tipo, dia padrão hoje, duração padrão 60 */
function lpcTarNova(tipo,tit,quando,hora,dur,por){
  return {id:lpcUid(), tipo:tipo||'follow', tit:String(tit||'').trim()||lpcTarTipo(tipo)[2],
    quando:quando||lpcHojeISO(), hora:hora||'', dur:Number(dur)||60, feito:null, notas:'',
    criadoEm:new Date().toISOString(), por:por||''}; }
/* tarNovaData: remarcar parte de HOJE quando a data já passou (empurrar data vencida só acumula atraso) */
function lpcTarNovaData(t,dias){ const h=lpcHojeISO(); const base=(t&&t.quando&&t.quando>h)?t.quando:h; return lpcIsoAddDias(base,dias); }
/* tarGcalUrl: link do Google Agenda com o evento pré-preenchido (sem OAuth; ele cria com 1 clique) */
function lpcTarGcalUrl(c,t){
  if(!t||!t.quando) return '';
  const p2=x=>String(x).padStart(2,'0');
  const dia=t.quando.replace(/-/g,''), hh=(t.hora||'09:00').split(':');
  const ini=dia+'T'+p2(hh[0])+p2(hh[1]||'00')+'00';
  const totMin=Number(hh[0])*60+Number(hh[1]||0)+(Number(t.dur)||60), fimMin=totMin%(24*60);
  const diaFim=(totMin>=1440?lpcIsoAddDias(t.quando,1):t.quando).replace(/-/g,'');
  const fim=diaFim+'T'+p2(Math.floor(fimMin/60))+p2(fimMin%60)+'00';
  const tit=lpcTarTipo(t.tipo)[2]+' · '+(c?c.nome||'':'');
  const det=[t.tit||'', c&&c.telefone?('Telefone: '+c.telefone):'', c&&c.etapa?('Etapa: '+c.etapa):'', t.notas||'', 'CRM Life Planner'].filter(Boolean).join('\n');
  const ls=(c&&Array.isArray(c.locais))?c.locais.filter(l=>l&&(l.nome||l.end)):[], lp=ls.find(l=>l.tipo==='trabalho')||ls[0]||null;
  const loc=lp?[lp.nome,lp.end].filter(Boolean).join(', '):'';
  return 'https://calendar.google.com/calendar/render?action=TEMPLATE&text='+encodeURIComponent(tit)+
    '&dates='+ini+'/'+fim+'&details='+encodeURIComponent(det)+(loc?'&location='+encodeURIComponent(loc):''); }
/* ===== 2.8.1 VALOR DO NEGÓCIO — port do drwSalvarPM/parsePM: só o prêmio MENSAL é gravado (pm, espelhado em premio_mes);
   o PA é derivado (pm × 12). premio_total acompanha, salvo quando foi ajustado à mão no app (premio_total_manual). */
const LPC_PA_MESES=12;
function lpcParsePM(txt){ const s=String(txt==null?'':txt).replace(/[^\d,.-]/g,'').replace(/\.(?=\d{3}(\D|$))/g,'').replace(',','.');
  const n=parseFloat(s); return isFinite(n)&&n>0?Math.round(n*100)/100:0; }
function lpcPmInformado(c){ const n=Number(c&&c.pm); return isFinite(n)&&n>0?n:0; }
function lpcEhMfo(c){ return /^mfo/.test(String(c&&c.funil||'')); }
function lpcEtapaDe(cfg,c){ return lpcEtapasDe(cfg,c).find(e=>e.id===(c&&c.etapa))||null; }
function lpcStatusOpts(cfg,c){ const e=lpcEtapaDe(cfg,c); return e?e.status:[]; }
function lpcStatusDe(cfg,c){ const s=c&&String(c.status||'').trim(); if(!s) return ''; if(c.status_etapa&&c.status_etapa!==c.etapa) return ''; return lpcStatusOpts(cfg,c).includes(s)?s:''; }
function lpcEhEnc(cfg,c){ const e=lpcEtapaDe(cfg,c); return !!(e&&e.enc); }
function lpcInteracao(k,l,por,extra){ return Object.assign({id:lpcUid(),k,l,dia:lpcHojeISO(),ts:new Date().toISOString(),por:por||''},extra||{}); }
/* Aplica UMA ação a uma cópia de `dados` e devolve {dados, mudou}. O SW chama sobre a versão FRESCA do banco
   (relida na hora), então nada que o app mudou nesse meio-tempo é desfeito. Ações:
   {tipo:'etapa',para} · {tipo:'status',v} · {tipo:'listas',para:[…]} · {tipo:'nota',texto} · {tipo:'campos',set:{telefone,notas}} */
function lpcAplicar(cfg,dados,acao,por){
  const c=JSON.parse(JSON.stringify(dados||{})); const bn=c.funil==='bn'; if(!Array.isArray(c.interacoes)) c.interacoes=[];
  const t=acao&&acao.tipo;
  if(t==='etapa'){ if(bn) return {dados,mudou:false}; const para=String(acao.para||''); if(!para||para===c.etapa||!lpcEtapasDe(cfg,c).some(e=>e.id===para)) return {dados,mudou:false};
    const de=c.etapa; c.etapa=para; delete c.status; delete c.status_etapa;           /* logEtapa: mudar etapa limpa o status */
    c.interacoes.push(lpcInteracao('etapa',`Etapa: ${de} → ${para}`,por,{de,para})); return {dados:c,mudou:true}; }
  if(t==='status'){ if(bn) return {dados,mudou:false}; const v=String(acao.v||'').trim(); if(v&&!lpcStatusOpts(cfg,c).includes(v)) return {dados,mudou:false};
    const antes=lpcStatusDe(cfg,c)||(c.status_etapa===c.etapa?String(c.status||''):''); if(antes===v) return {dados,mudou:false};
    const rot=lpcEhEnc(cfg,c)?'Motivo da perda':'Status';
    if(v){ c.status=v; c.status_etapa=c.etapa; } else { delete c.status; delete c.status_etapa; }
    c.interacoes.push(lpcInteracao('etstatus',v?`${rot}: ${v}`:`${rot} removido${antes?' ('+antes+')':''}`,por)); return {dados:c,mudou:true}; }
  if(t==='listas'){ const antes=Array.isArray(c.listas)?c.listas.slice():[]; const dep=[...new Set((acao.para||[]).map(x=>String(x||'').trim()).filter(Boolean))];
    if(antes.length===dep.length&&antes.every(x=>dep.includes(x))) return {dados,mudou:false}; c.listas=dep;
    if(!bn) c.interacoes.push(lpcInteracao('lista',`Lista TA: ${antes.join(', ')||'—'} → ${dep.join(', ')||'—'}`,por,{de:antes,para:dep})); return {dados:c,mudou:true}; }
  if(t==='nota'){ const txt=String(acao.texto||'').trim(); if(!txt) return {dados,mudou:false};
    if(bn){ c.notas=(c.notas?String(c.notas)+'\n':'')+lpcHojeISO().split('-').reverse().join('/')+' · '+txt; return {dados:c,mudou:true}; }   /* Estoque não tem histórico: vai pras notas */
    c.interacoes.push(lpcInteracao('nota',txt,por,{via:'whatsapp'})); return {dados:c,mudou:true}; }
  /* 2.5: vínculo conversa do WhatsApp ↔ negócio, no próprio cadastro (vale em qualquer aparelho) */
  if(t==='wa_vinc'){ const antes=Array.isArray(c.wa_chats)?c.wa_chats.map(String):[]; const add=(acao.add||[]).map(String).filter(Boolean);
    const dep=[...new Set([...antes,...add])]; if(dep.length===antes.length) return {dados,mudou:false};
    c.wa_chats=dep; if(!bn&&!antes.length) c.interacoes.push(lpcInteracao('wa','📌 Conversa do WhatsApp ligada a este negócio',por)); return {dados:c,mudou:true}; }
  if(t==='wa_desv'){ const antes=Array.isArray(c.wa_chats)?c.wa_chats.map(String):[]; const tira=new Set((acao.keys||[]).map(String));
    const dep=antes.filter(k=>!tira.has(k)); if(dep.length===antes.length) return {dados,mudou:false};
    if(dep.length) c.wa_chats=dep; else delete c.wa_chats; return {dados:c,mudou:true}; }
  /* 2.7.0: liga este negócio à mesma PESSOA de outro (pessoaId, MULTI-NEG do app). Só preenche quando está vazio:
     nunca troca a pessoa de um negócio que já tem outra (silêncio é melhor que palpite, mesma régua do app). */
  if(t==='pessoa'){ const pid=String(acao.id||'').trim(); if(!pid||c.pessoaId) return {dados,mudou:false};
    c.pessoaId=pid; return {dados:c,mudou:true}; }
  /* 2.8.1: trocar de FUNIL (drwMoverFunil do app): funil + etapa de destino (padrão = 1ª etapa do funil novo) + registro
     "Funil: A → B (etapa x → y)". O status sai junto (é por etapa de cada funil — mesma regra do "mudar etapa limpa o status"). */
  if(t==='funil'){ if(bn) return {dados,mudou:false}; const dest=String(acao.para||''); if(!LPC_FUNIS_APP.some(f=>f[0]===dest)) return {dados,mudou:false};
    const deF=lpcFunilApp(c); if(deF===dest) return {dados,mudou:false};
    const et=lpcEtapasDe(cfg,{funil:dest}); const nova=et.some(e=>e.id===acao.etapa)?acao.etapa:lpcEtapa0De(cfg,dest); if(!nova) return {dados,mudou:false};
    const deE=c.etapa; c.funil=dest; c.etapa=nova; delete c.status; delete c.status_etapa;
    c.interacoes.push(lpcInteracao('funil',`Funil: ${lpcFunilNome(deF)} → ${lpcFunilNome(dest)} (etapa ${deE} → ${nova})`,por,{de:deE,para:nova})); return {dados:c,mudou:true}; }
  /* 2.8.1: ATIVIDADES (dados.tarefas) — tarCriar / tarConcluir / tarAdiar do app */
  if(t==='tarefa_nova'){ if(bn) return {dados,mudou:false}; const n=acao.t; if(!n||n.id==null) return {dados,mudou:false};
    if(!Array.isArray(c.tarefas)) c.tarefas=[]; if(c.tarefas.some(x=>x&&String(x.id)===String(n.id))) return {dados,mudou:false};
    const tt=Object.assign({},n,{por:n.por||por||''}); c.tarefas.push(tt);
    c.interacoes.push(Object.assign(lpcInteracao('tarefa','Tarefa criada: '+tt.tit,por),{ts:tt.criadoEm})); return {dados:c,mudou:true}; }
  if(t==='tarefa_feita'){ const l=Array.isArray(c.tarefas)?c.tarefas:[]; const x=l.find(y=>y&&String(y.id)===String(acao.id)); if(!x||x.feito) return {dados,mudou:false};
    x.feito=acao.em||new Date().toISOString();
    c.interacoes.push(Object.assign(lpcInteracao('tarefa','Tarefa concluída: '+x.tit,por),{ts:x.feito})); return {dados:c,mudou:true}; }
  if(t==='tarefa_data'){ const l=Array.isArray(c.tarefas)?c.tarefas:[]; const x=l.find(y=>y&&String(y.id)===String(acao.id)); const q=String(acao.quando||'');
    if(!x||!/^\d{4}-\d{2}-\d{2}$/.test(q)||x.quando===q) return {dados,mudou:false}; x.quando=q; return {dados:c,mudou:true}; }
  /* 2.8.1: VALOR — prêmio mensal (drwSalvarPM) · MFO: receita estimada */
  if(t==='pm'){ const v=Number(acao.v)>0?Math.round(Number(acao.v)*100)/100:0; if(v===lpcPmInformado(c)) return {dados,mudou:false};
    c.pm=v||null; c.premio_mes=c.pm;
    if(c.pm) c.premio_total=c.premio_total_manual?c.premio_total:Math.round(c.pm*LPC_PA_MESES*100)/100;
    else { c.premio_total=null; c.premio_total_manual=false; }
    return {dados:c,mudou:true}; }
  if(t==='receita'){ const v=Number(acao.v)>0?Math.round(Number(acao.v)*100)/100:0; const a=Number(c.receita_estimada)>0?Number(c.receita_estimada):0; if(v===a) return {dados,mudou:false};
    c.receita_estimada=v||null; return {dados:c,mudou:true}; }
  if(t==='campos'){ const set=acao.set||{}; let m=false; ['telefone','notas'].forEach(k=>{ if(k in set){ const v=set[k]==null?'':String(set[k]); if(String(c[k]==null?'':c[k])!==v){ c[k]=v||(k==='telefone'?null:''); m=true; } } }); return {dados:c,mudou:m}; }
  return {dados,mudou:false};
}
function lpcListasCatalogo(oficiais,rows){ const set=new Set((oficiais||[]).map(x=>String(x||'').trim()).filter(Boolean));
  (rows||[]).forEach(r=>{ const l=r&&r.dados&&r.dados.listas; if(Array.isArray(l)) l.forEach(n=>{ n=String(n||'').trim(); if(n) set.add(n); }); });
  return [...set].sort((a,b)=>a.localeCompare(b,'pt-BR')); }
function lpcUltimos(c,n){ return (Array.isArray(c&&c.interacoes)?c.interacoes:[]).slice().sort((a,b)=>String(b.ts||b.dia||'').localeCompare(String(a.ts||a.dia||''))).slice(0,n||5); }
