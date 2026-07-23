// ===== CRM API — CHOKE POINT DA EXTENSÃO =====
// ÚNICO arquivo que fala com /rest/v1/leads (o guard-choke-point.mjs verifica isso).
// Espelha os choke points do app: insertLead (index.html L1455), updateLead (L1413),
// logEdit (L3371), setLeadTask (L1408). Roda SOMENTE no service worker.
// Regra de fidelidade: derivados recalculados aqui, codigo VAZIO (trigger do banco
// numera o PI), etapa NUNCA gravada (derivada do status, só em memória no app).

const SESSION_KEY='wa_crm_session';

// ---------- sessão / auth (GoTrue via REST) ----------
async function getSession(){
  const o=await chrome.storage.local.get(SESSION_KEY);
  return o[SESSION_KEY]||null;
}
async function setSession(s){ await chrome.storage.local.set({[SESSION_KEY]:s}); }
async function clearSession(){ await chrome.storage.local.remove(SESSION_KEY); }

function sessionFromTokenResponse(data){
  const u=data.user||{};
  return {
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    expires_at:data.expires_at||(Math.floor(Date.now()/1000)+(data.expires_in||3600)),
    user_email:u.email||'',
    // mesma régua do app (index.html L4555): ME = nome do metadata ou email, minúsculo
    usuario:((u.user_metadata&&u.user_metadata.nome)||u.email||'').toLowerCase()
  };
}

async function login(email,password){
  const r=await fetch(`${SB_URL}/auth/v1/token?grant_type=password`,{
    method:'POST',
    headers:{apikey:SB_KEY,'Content-Type':'application/json'},
    body:JSON.stringify({email,password})
  });
  const data=await r.json().catch(()=>({}));
  if(!r.ok) throw {code:'auth',message:data.error_description||data.msg||'E-mail ou senha inválidos.'};
  const s=sessionFromTokenResponse(data);
  await setSession(s);
  return {email:s.user_email,usuario:s.usuario};
}

async function logout(){
  const s=await getSession();
  if(s){ try{ await fetch(`${SB_URL}/auth/v1/logout`,{method:'POST',headers:{apikey:SB_KEY,Authorization:`Bearer ${s.access_token}`}}); }catch(_){} }
  await clearSession();
}

// refresh com promise única em voo — evita corrida de 2 abas do WhatsApp rotacionando
// o refresh token duas vezes (GoTrue invalida o antigo a cada uso)
let _refreshing=null;
async function refreshSession(s){
  if(_refreshing) return _refreshing;
  _refreshing=(async()=>{
    try{
      const r=await fetch(`${SB_URL}/auth/v1/token?grant_type=refresh_token`,{
        method:'POST',
        headers:{apikey:SB_KEY,'Content-Type':'application/json'},
        body:JSON.stringify({refresh_token:s.refresh_token})
      });
      const data=await r.json().catch(()=>({}));
      if(!r.ok){ await clearSession(); throw {code:'auth',message:'Sessão expirou — entre de novo.'}; }
      const ns=sessionFromTokenResponse(data);
      await setSession(ns);
      return ns;
    } finally { _refreshing=null; }
  })();
  return _refreshing;
}

async function freshSession(){
  let s=await getSession();
  if(!s) throw {code:'auth',message:'Não conectado ao CRM.'};
  if((s.expires_at||0)-60 < Math.floor(Date.now()/1000)) s=await refreshSession(s);
  return s;
}

// fetch autenticado no Supabase; 401 → tenta refresh uma vez e repete
async function sbFetch(path,opts){
  opts=opts||{};
  let s=await freshSession();
  const doFetch=(tok)=>fetch(`${SB_URL}${path}`,{
    method:opts.method||'GET',
    headers:Object.assign({apikey:SB_KEY,Authorization:`Bearer ${tok}`,'Content-Type':'application/json'},opts.headers||{}),
    body:opts.body!=null?JSON.stringify(opts.body):undefined
  });
  let r=await doFetch(s.access_token);
  if(r.status===401){ s=await refreshSession(s); r=await doFetch(s.access_token); }
  return r;
}

async function sbJson(path,opts){
  const r=await sbFetch(path,opts);
  const text=await r.text();
  let data=null; try{ data=text?JSON.parse(text):null; }catch(_){ data=null; }
  if(!r.ok) throw {code:(data&&data.code)||String(r.status),message:(data&&(data.message||data.msg))||`HTTP ${r.status}`,details:(data&&data.details)||'',status:r.status};
  return data;
}

// ---------- leitura ----------
const LEAD_COLS='id,codigo,nome,primeiro_nome,cargo,empresa,segmento,cidade,bairro,renda_estimada,faixa_idade,sexo,telefone,telefone_e164,email,linkedin_url,instagram_handle,observacoes,recomendante,origem,responsavel,score,prioridade,status,etapa,data_proxima_acao,data_status_atual,atualizado_em';

async function findByPhone(rawPhone){
  const vars=phoneE164Variants(rawPhone);
  if(!vars.length) return [];
  const list=vars.map(v=>`"${v}"`).join(',');
  return await sbJson(`/rest/v1/leads?select=${LEAD_COLS}&telefone_e164=in.(${encodeURIComponent(list)})&limit=5`);
}

async function searchByName(q){
  q=String(q||'').trim();
  if(!q) return [];
  // busca por telefone se o texto parecer número; senão ilike no nome
  if(/^[+\d][\d\s().-]{5,}$/.test(q)){
    const byTel=await findByPhone(q);
    if(byTel.length) return byTel;
  }
  const pat=encodeURIComponent('*'+q.replace(/[%*]/g,'')+'*');
  return await sbJson(`/rest/v1/leads?select=${LEAD_COLS}&nome=ilike.${pat}&order=atualizado_em.desc.nullslast&limit=10`);
}

// Busca por nome tolerante às tags do WhatsApp ("OT Fulano Rec LP Daniel"):
// consulta por CADA token (or=ilike) e ranqueia; strong = único candidato cujo
// primeiro+último nome estão contidos no apelido do chat.
async function findByName(nameRaw){
  const toks=nameTokens(nameRaw).slice(0,6);
  if(!toks.length) return {strong:null,sugestoes:[]};
  const ors=toks.map(t=>`nome.ilike.*${t.replace(/[%*,()"]/g,'')}*`).join(',');
  let rows=[];
  try{ rows=await sbJson(`/rest/v1/leads?select=${LEAD_COLS}&or=${encodeURIComponent('('+ors+')')}&limit=15`); }
  catch(e){ if(e.code==='auth') throw e; rows=[]; }
  const set=new Set(toks);
  const scored=rows.map(l=>{
    const lt=nameTokens(l.nome||''); const hit=lt.filter(t=>set.has(t)).length;
    return {l,cov:lt.length?hit/lt.length:0,strong:nameStrongMatch(nameRaw,l.nome)};
  }).filter(x=>x.cov>0).sort((a,b)=>(b.strong-a.strong)||(b.cov-a.cov));
  const strongs=scored.filter(x=>x.strong);
  return {strong:strongs.length===1?strongs[0].l:null, sugestoes:scored.slice(0,5).map(x=>x.l)};
}

async function findByEmail(email){
  const e=normEmail(email);
  if(!e) return [];
  return await sbJson(`/rest/v1/leads?select=${LEAD_COLS}&email=ilike.${encodeURIComponent(e)}&limit=2`);
}

async function getFunilCfg(){
  try{
    const rows=await sbJson(`/rest/v1/app_settings?select=valor&chave=eq.funil_cfg&limit=1`);
    if(rows&&rows[0]&&rows[0].valor){ const c=JSON.parse(rows[0].valor); if(c&&Array.isArray(c.etapas)&&c.etapas.length) return c; }
  }catch(_){ /* sem acesso/tabela → default */ }
  return null;
}

// ---------- log de atividade (espelho de logEdit L3370-3381) ----------
const EDIT_LABELS={nome:'Nome',cargo:'Cargo',empresa:'Empresa',segmento:'Segmento',bairro:'Bairro',renda_estimada:'Renda',faixa_idade:'Idade',telefone:'Telefone',sexo:'Sexo',status:'Status',data_proxima_acao:'Follow-up',agendamento:'Agendamento',linkedin_url:'LinkedIn',instagram_handle:'Instagram',observacoes:'Observações',prioridade:'Prioridade',acompanhar_victor:'Acomp. Victor'};
async function logEdit(id,before,patch,usuario){
  before=before||{};
  const changed=[];
  for(const k in patch){ if(!(k in EDIT_LABELS))continue; const a=before[k]==null?'':String(before[k]), b=patch[k]==null?'':String(patch[k]); if(a!==b)changed.push(EDIT_LABELS[k]); }
  if(!changed.length)return;
  const stChg = patch.status!=null && String(before.status||'')!==String(patch.status);
  const row={lead_id:id,tipo:stChg?'status':'edicao',texto:'✏️ Editou: '+changed.join(', '),usuario:usuario||''};
  if(stChg) row.para_status=patch.status;
  try{ await sbJson('/rest/v1/lead_events',{method:'POST',body:row,headers:{Prefer:'return=minimal'}}); }catch(_){ /* fire-and-forget, igual ao app */ }
}

// ---------- escrita ----------
// tradução do 23505 (UNIQUE) — mesma régua do insertLead L1473-1483
function dupKeyFrom23505(details){
  const d=String(details||'');
  if(/codigo/i.test(d)&&!/linkedin|instagram|telefone|e164|email/i.test(d)) return null; // colisão de PI, não é lead duplicado
  return /instagram/i.test(d)?'instagram':/linkedin/i.test(d)?'linkedin':/telefone|e164/i.test(d)?'telefone':/email/i.test(d)?'email':'telefone';
}

// espelho de updateLead (L1413-1444): derivados + carimbos + log; NUNCA grava etapa
async function waUpdateLead(id,patch,before){
  before=before||{};
  patch=Object.assign({},patch);
  delete patch.etapa;
  if('nome' in patch && patch.nome) patch.primeiro_nome=firstName(patch.nome);
  if('telefone' in patch && !('telefone_e164' in patch)){ const p=normPhone(patch.telefone||''); patch.telefone=p.telefone; patch.telefone_e164=p.e164; }
  if('email' in patch && patch.email) patch.email=patch.email.trim()||null;
  if(patch.status==='Convite Enviado' && !before.convite_enviado_em && !('convite_enviado_em' in patch)) patch.convite_enviado_em=new Date().toISOString();
  if('status' in patch && patch.status!==before.status && !('data_status_atual' in patch)) patch.data_status_atual=new Date().toISOString();
  patch.atualizado_em=new Date().toISOString();
  let rows;
  try{
    rows=await sbJson(`/rest/v1/leads?id=eq.${encodeURIComponent(id)}&select=${LEAD_COLS}`,{method:'PATCH',body:patch,headers:{Prefer:'return=representation'}});
  }catch(e){
    if(e.code==='23505'){
      const key=dupKeyFrom23505(e.details||e.message);
      if(key===null) return {status:'error',message:'Colisão de código PI — recarregue o CRM e tente de novo.'};
      return {status:'error',message:'Esse telefone/e-mail já pertence a outro lead — verifique em Duplicatas no CRM.'};
    }
    if(e.code==='auth') throw e;
    if(/enum origem_t/i.test(e.message||'')) return {status:'error',message:'Origem "WhatsApp" ainda não habilitada no banco — rode supabase/migrations/origem_whatsapp.sql no SQL Editor.'};
    return {status:'error',message:e.message||'falha ao salvar'};
  }
  const lead=rows&&rows[0];
  if(!lead) return {status:'error',message:'Lead não encontrado (pode ter sido removido).'};
  const s=await getSession();
  await logEdit(id,before,patch,s&&s.usuario);
  return {status:'updated',lead};
}

// espelho de insertLead (L1455-1493): derivados + dedupe pré-insert (server-side,
// por telefone/email — chaves fortes do canal WhatsApp) + codigo vazio (trigger PI)
async function waInsertLead(rec){
  rec=Object.assign({},rec);
  delete rec.etapa; delete rec.codigo;
  if(rec.nome) rec.primeiro_nome=firstName(rec.nome);
  if('telefone' in rec && !('telefone_e164' in rec)){ const p=normPhone(rec.telefone||''); rec.telefone=p.telefone; rec.telefone_e164=p.e164; }
  if(rec.email) rec.email=rec.email.trim()||null;
  if(rec.status==='Convite Enviado' && !rec.convite_enviado_em) rec.convite_enviado_em=new Date().toISOString();
  // dedupe ANTES do insert (só chaves fortes bloqueiam; nome nunca — igual ao app)
  if(rec.telefone_e164){
    const hit=await findByPhone(rec.telefone_e164);
    if(hit.length) return {status:'duplicate',key:'telefone',existing:hit[0]};
  }
  if(rec.email){
    const hit=await findByEmail(rec.email);
    if(hit.length) return {status:'duplicate',key:'email',existing:hit[0]};
  }
  let rows;
  try{
    rows=await sbJson(`/rest/v1/leads?select=${LEAD_COLS}`,{method:'POST',body:rec,headers:{Prefer:'return=representation'}});
  }catch(e){
    if(e.code==='23505'){
      const key=dupKeyFrom23505(e.details||e.message);
      if(key===null) return {status:'error',message:'colisão de código PI — recarregue e tente de novo',code:e.code};
      let existing=null;
      try{
        if(key==='telefone'&&rec.telefone_e164) existing=(await findByPhone(rec.telefone_e164))[0]||null;
        else if(key==='email'&&rec.email) existing=(await findByEmail(rec.email))[0]||null;
      }catch(_){}
      return {status:'duplicate',key,existing};
    }
    if(e.code==='auth') throw e;
    if(/enum origem_t/i.test(e.message||'')) return {status:'error',message:'Origem "WhatsApp" ainda não habilitada no banco — rode supabase/migrations/origem_whatsapp.sql no SQL Editor.',code:e.code};
    return {status:'error',message:e.message||'falha ao criar lead',code:e.code};
  }
  const lead=rows&&rows[0];
  if(!lead) return {status:'error',message:'insert sem retorno — confira RLS/permissões no Supabase'};
  return {status:'created',lead};
}

// ---------- Visão LP · Carteira (leitura) ----------
// Contatos/funil da LP vivem no localStorage do vendas.html (fora do alcance);
// o que existe no Supabase é a CARTEIRA (carteira_clientes/carteira_apolices,
// jsonb, RLS por dono=email). Telefone fica solto dentro do jsonb → o match é
// client-side: extrai números do dados e compara nas variantes e164.
let _cartCache=null, _cartAt=0;
async function carteiraAll(force){
  if(!force && _cartCache && Date.now()-_cartAt<5*60*1000) return _cartCache;
  const clientes=await sbJson('/rest/v1/carteira_clientes?select=ref,dados,atualizado');
  let apolices=[];
  try{ apolices=await sbJson('/rest/v1/carteira_apolices?select=chave,dados'); }catch(_){}
  _cartCache={clientes:clientes||[],apolices:apolices||[]}; _cartAt=Date.now();
  return _cartCache;
}
function phonesFromJson(obj){
  const out=new Set();
  const txt=JSON.stringify(obj||{});
  for(const m of txt.matchAll(/\+?\d[\d\s().\/-]{7,}\d/g)){
    const e=normPhone(m[0]).e164; if(e) out.add(e);
  }
  return out;
}
function apolicesDoCliente(cart,cli){
  const nome=normName((cli.dados&&cli.dados.nome)||cli.ref||'');
  if(!nome) return [];
  return cart.apolices.filter(a=>normName(JSON.stringify(a.dados||{})).includes(nome)).map(a=>a.chave);
}
async function lpFindByPhone(rawPhone){
  const vars=new Set(phoneE164Variants(rawPhone));
  if(!vars.size) return [];
  const cart=await carteiraAll();
  return cart.clientes
    .filter(c=>{ const ph=phonesFromJson(c.dados); return [...vars].some(v=>ph.has(v)); })
    .map(c=>({ref:c.ref,dados:c.dados,atualizado:c.atualizado,apolices:apolicesDoCliente(cart,c)}))
    .slice(0,5);
}
async function lpSearch(q){
  q=normName(q||''); if(!q) return [];
  const cart=await carteiraAll();
  return cart.clientes
    .filter(c=>normName((c.dados&&c.dados.nome)||c.ref||'').includes(q))
    .map(c=>({ref:c.ref,dados:c.dados,atualizado:c.atualizado,apolices:apolicesDoCliente(cart,c)}))
    .slice(0,10);
}

// ---------- Visão LP · Contatos/Funil (lp_contatos — sync do vendas.html v0.4.1+) ----------
// 1 linha por contato (dados jsonb = contato inteiro), RLS por dono. O vendas.html
// faz merge por `_upd` (maior vence) — toda escrita daqui carimba dados._upd.
let _lpcCache=null, _lpcAt=0;
async function lpcAll(force){
  if(!force && _lpcCache && Date.now()-_lpcAt<2*60*1000) return _lpcCache;
  try{ _lpcCache=await sbJson('/rest/v1/lp_contatos?select=id,dados,atualizado'); }
  catch(e){ if(e.code==='auth') throw e; _lpcCache=[]; /* tabela ainda não criada → trata como vazia */ }
  _lpcAt=Date.now();
  return _lpcCache;
}
function _lpcOut(r){ return {id:r.id,dados:r.dados,atualizado:r.atualizado}; }
async function lpcFindByPhone(rawPhone){
  const vars=new Set(phoneE164Variants(rawPhone));
  if(!vars.size) return [];
  const rows=await lpcAll();
  return rows.filter(r=>{ const ph=phonesFromJson(r.dados&&r.dados.telefone||''); return [...vars].some(v=>ph.has(v)); }).map(_lpcOut).slice(0,5);
}
async function lpcSearch(q){
  q=normName(q||''); if(!q) return [];
  const rows=await lpcAll();
  return rows.filter(r=>normName((r.dados&&r.dados.nome)||'').includes(q)).map(_lpcOut).slice(0,10);
}
async function lpcSave(id,dados){
  dados=Object.assign({},dados,{_upd:new Date().toISOString()});
  const rows=await sbJson(`/rest/v1/lp_contatos?on_conflict=dono,id&select=id,dados,atualizado`,
    {method:'POST',body:{id:String(id),dados},headers:{Prefer:'resolution=merge-duplicates,return=representation'}});
  _lpcCache=null;
  return rows&&rows[0]?_lpcOut(rows[0]):{id:String(id),dados};
}
async function lpcFindByName(nameRaw){
  const toks=nameTokens(nameRaw);
  if(!toks.length) return {strong:null,sugestoes:[]};
  const set=new Set(toks);
  const rows=await lpcAll();
  const scored=rows.map(r=>{
    const n=(r.dados&&r.dados.nome)||'';
    const lt=nameTokens(n); const hit=lt.filter(t=>set.has(t)).length;
    return {r,cov:lt.length?hit/lt.length:0,strong:nameStrongMatch(nameRaw,n)};
  }).filter(x=>x.cov>0).sort((a,b)=>(b.strong-a.strong)||(b.cov-a.cov));
  const strongs=scored.filter(x=>x.strong);
  return {strong:strongs.length===1?_lpcOut(strongs[0].r):null, sugestoes:scored.slice(0,5).map(x=>_lpcOut(x.r))};
}

// visão combinada da LP: contatos do funil (prioridade) + Carteira; sem telefone
// (ou sem match por telefone), tenta o match forte por nome nos contatos
async function lpLookup(rawPhone,chatName){
  const [contatos,carteira]=await Promise.all([lpcFindByPhone(rawPhone),lpFindByPhone(rawPhone)]);
  let byName=null;
  if(!contatos.length&&chatName){ byName=await lpcFindByName(chatName); }
  return {contatos,carteira,byName};
}
async function lpSearchAll(q){
  const [contatos,carteira]=await Promise.all([lpcSearch(q),lpSearch(q)]);
  return {contatos,carteira};
}

// espelho de setLeadTask (L1408-1412): data no lead + descrição na timeline (best-effort)
async function setTask(id,dateISO,texto,before){
  const r=await waUpdateLead(id,{data_proxima_acao:dateISO},before);
  if(r.status==='updated' && texto){
    const s=await getSession();
    try{ await sbJson('/rest/v1/lead_events',{method:'POST',body:{lead_id:id,tipo:'tarefa',texto,usuario:(s&&s.usuario)||''},headers:{Prefer:'return=minimal'}}); }catch(_){}
  }
  return r;
}
