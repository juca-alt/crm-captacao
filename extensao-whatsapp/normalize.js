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
function lpcFunilDe(c){ return (c&&c.funil==='bc')?'bc':'nn'; }

// Tokens de nome p/ casar apelidos operacionais do WhatsApp ("OT Andre Jr Due
// Rec LP Daniel") com o nome limpo do CRM: quebra em palavras ≥3 letras.
function nameTokens(s){ return fuzzyNameKey(s||'').split(' ').filter(w=>w.length>=3); }
// Match FORTE por nome: primeiro+último nome do candidato contidos nos tokens do
// apelido do chat. Continua sendo nome (nunca 100%), mas com essa régua o único
// candidato forte pode abrir o card direto — com aviso pra conferir.
function nameStrongMatch(chatName,candName){
  const set=new Set(nameTokens(chatName));
  const fl=firstLastKey(candName||'');
  return !!(fl&&fl.split(' ').every(t=>set.has(t)));
}
