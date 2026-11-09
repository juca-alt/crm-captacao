/* ═══ VER-COMO-V3 (08/11/2026) — ticket D do PROMPT_CODE_EQUIPE_ACESSOS ═══════════════════════════════════════
   Palavra dele: "quero ver como vai ser a visão deles na prática".
   O "👁️ Ver o que ele enxerga" de Acessos & Módulos só listava os menus num modal. Aqui o admin USA o app inteiro
   com o perfil da pessoa (papel + modulos + regra do novoOn), só nesta aba:
   - não troca a sessão e não lê a conta da pessoa: o dado na tela é o do dono (o que um delegado lê pela RLS);
   - NADA é gravado enquanto o modo está ligado:
       · localStorage vira um rascunho em memória (a tela funciona; o aparelho não muda);
       · toda requisição de escrita (POST/PATCH/PUT/DELETE) ao Supabase, às Edge Functions e ao Google é barrada
         ANTES de sair do navegador, com o aviso "modo ver como: só leitura". Leitura (GET) e as 4 RPCs de leitura passam;
   - sair = recarregar a página: descarta tudo o que mudou só na memória.
   Este arquivo carrega ANTES do script principal de propósito: o cliente do Supabase guarda a função de rede no
   momento em que é criado, então o filtro de rede precisa estar instalado antes disso.
   ════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function(){
  const VC={on:false,email:'',nome:'',p:null,donos:[],escAntes:null,_aviso:0};
  window.VC=VC;

  /* ── 1) armazenamento do aparelho: rascunho em memória enquanto o modo está ligado ── */
  let LS=null; try{ LS=window.localStorage; }catch(_){}
  const OV=new Map();                       /* chave → valor (null = removida no rascunho) */
  try{
    const P=Storage.prototype, _set=P.setItem, _get=P.getItem, _rem=P.removeItem, _clr=P.clear;
    P.setItem=function(k,v){ if(VC.on&&this===LS){ OV.set(String(k),String(v)); return; } return _set.call(this,k,v); };
    P.getItem=function(k){ if(VC.on&&this===LS&&OV.has(String(k))) return OV.get(String(k)); return _get.call(this,k); };
    P.removeItem=function(k){ if(VC.on&&this===LS){ OV.set(String(k),null); return; } return _rem.call(this,k); };
    P.clear=function(){ if(VC.on&&this===LS) return; return _clr.call(this); };
    VC._lerDeVerdade=k=>{ try{ return _get.call(LS,k); }catch(_){ return null; } };
  }catch(_){}

  /* ── 2) rede: escrita barrada antes de sair do navegador ── */
  const RPC_LEITURA=new Set(['emb_eu','emb_leads','emb_leads_notas','emb_jornada_lead']);
  /* PURA: esta requisição grava algo? (true = barrar no modo ver como) */
  function vcBloqueia(url,metodo){
    const m=String(metodo||'GET').toUpperCase(); if(m==='GET'||m==='HEAD'||m==='OPTIONS') return false;
    const u=String(url||'');
    if(/\/auth\/v1\//.test(u)) return false;                       /* renovar o login não grava dado */
    const r=u.match(/\/rest\/v1\/rpc\/([a-z0-9_]+)/i); if(r) return !RPC_LEITURA.has(r[1]);
    return true;                                                     /* tabela, Edge Function, Storage, Google… */
  }
  VC.bloqueia=vcBloqueia;
  function vcAvisa(){ const t=Date.now(); if(t-VC._aviso<3500) return; VC._aviso=t;
    try{ if(typeof toast==='function') toast('👁️ Modo ver como: só leitura — nada foi gravado',false); }catch(_){} }
  const _fetch=window.fetch;
  if(typeof _fetch==='function') window.fetch=function(input,init){
    if(VC.on){
      const url=typeof input==='string'?input:((input&&input.url)||String(input));
      const met=(init&&init.method)||(input&&typeof input==='object'&&input.method)||'GET';
      if(vcBloqueia(url,met)){ vcAvisa();
        return Promise.resolve(new Response(JSON.stringify({message:'modo ver como: só leitura',code:'VER_COMO',details:null,hint:null}),
          {status:403,headers:{'Content-Type':'application/json'}})); }
    }
    return _fetch.apply(this,arguments);
  };

  /* ── 3) visual: faixa fixa (computador: embaixo; celular: acima da barra inferior), sem cobrir conteúdo ── */
  const css=document.createElement('style'); css.textContent=`
    #vc-faixa{position:fixed;left:0;right:0;bottom:0;z-index:190;display:flex;align-items:center;gap:10px;flex-wrap:wrap;
      background:#1e1b4b;color:#fff;padding:8px 16px;box-shadow:0 -6px 20px rgba(16,30,54,.18);font-size:13.5px;line-height:1.35}
    #vc-faixa .vc-t{font-weight:700}
    #vc-faixa .vc-s{color:#c7d2fe;font-size:12px;flex:1 1 220px}
    #vc-faixa .btn{min-height:36px;background:#fff;color:#1e1b4b;border:0;font-weight:700;padding:6px 14px;border-radius:9px;cursor:pointer}
    body.vc-on .content{padding-bottom:84px}
    body.vc-on #toasts{bottom:76px}
    @media(max-width:980px){
      #vc-faixa{bottom:calc(64px + env(safe-area-inset-bottom));padding:8px 12px;gap:6px 10px}
      #vc-faixa .vc-s{flex-basis:100%;order:3}
      #vc-faixa .btn{min-height:44px;margin-left:auto}
      body.vc-on .content{padding-bottom:calc(176px + env(safe-area-inset-bottom))}
      body.vc-on #toasts{bottom:calc(176px + env(safe-area-inset-bottom))}
      body.vc-on .ver-nova{bottom:calc(176px + env(safe-area-inset-bottom))}
    }
    @media print{ #vc-faixa{display:none} }`;
  (document.head||document.documentElement).appendChild(css);

  const escH=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function vcFaixaHtml(){
    const n=(VC.p&&VC.p.modulos)?Object.values(VC.p.modulos).filter(v=>v===true).length:0;
    return `<span class="vc-t">👁️ Vendo como ${escH(VC.nome)} · só leitura</span>`+
      `<span class="vc-s">${VC.p&&VC.p.papel==='admin'?'perfil admin':n+' módulos ligados'} · dados da sua base; o que depende do banco (RLS) pode diferir · nada é gravado</span>`+
      `<button class="btn" type="button" onclick="vcSair()">Sair do modo</button>`;
  }
  function vcFaixa(){ let d=document.getElementById('vc-faixa');
    if(!VC.on){ if(d) d.remove(); return; }
    if(!d){ d=document.createElement('div'); d.id='vc-faixa'; d.setAttribute('role','status'); document.body.appendChild(d); }
    d.innerHTML=vcFaixaHtml(); }

  /* ── 4) entrar / sair ── */
  function vcEntrar(p,donos,opts){
    opts=opts||{};
    if(!opts.teste && !(typeof souAdm==='function'&&souAdm())) return false;     /* só o admin */
    if(!p||!p.email) return false;
    VC.on=true; VC.email=String(p.email); VC.nome=p.nome||String(p.email).split('@')[0].replace(/[._-]+/g,' ').replace(/\b\w/g,m=>m.toUpperCase());
    VC.p={papel:p.papel||'lp',modulos:p.modulos||{}}; VC.donos=(donos||[]).slice(); OV.clear();
    try{ VC.escAntes=ESC.sel;
      const sel=String(ESC.sel||'');
      if(sel==='todos'||(sel.startsWith('dono:')&&!VC.donos.includes(sel.slice(5)))) ESC.sel='meu';   /* a base do Daniel não é dela */
      _escMemo=null; }catch(_){}
    document.body.classList.add('vc-on'); vcFaixa();
    if(!opts.quieto){
      try{ if(typeof atClose==='function') atClose(); }catch(_){}
      try{ if(typeof aplicarGates==='function') aplicarGates(); }catch(_){}
      try{ if(typeof irPara==='function') irPara('inicio'); else if(typeof render==='function') render(); }catch(_){}
      try{ if(typeof toast==='function') toast('👁️ Vendo o app como '+VC.nome+' — só leitura',true); }catch(_){}
    }
    return true;
  }
  function vcSair(recarregar){
    const voltar=VC.escAntes;
    VC.on=false; VC.p=null; VC.email=''; VC.nome=''; VC.donos=[]; OV.clear();
    try{ ESC.sel=voltar; _escMemo=null; }catch(_){}
    document.body.classList.remove('vc-on'); vcFaixa();
    if(recarregar!==false){ try{ location.reload(); }catch(_){} }   /* descarta o que mudou só na memória */
  }
  /* nome da pessoa: o da equipe (app_settings.equipe, "Rebeca", "Victor Figueiredo"), senão o do e-mail */
  function vcNomeDe(p){ const e=p&&p.email; let n='';
    try{ if(typeof EQ!=='undefined'&&EQ&&EQ.m&&EQ.m[e]&&EQ.m[e].nome) n=EQ.m[e].nome; }catch(_){}
    if(!n&&typeof admNome==='function') n=admNome(p); return n||String(e||''); }
  window.vcNomeCurto=p=>String(vcNomeDe(p)).trim().split(/\s+/)[0];
  /* botão do Painel Master · Acessos */
  function vcEntrarPorEmail(email){
    if(typeof ADM==='undefined'||!ADM.lista) return;
    const p=ADM.lista.find(x=>x.email===email); if(!p) return;
    const donos=(typeof admDonosDe==='function'?admDonosDe(email):[]).map(d=>d.dono_email);
    const nome=vcNomeDe(p);
    vcEntrar({email:p.email,papel:p.papel,modulos:p.modulos,nome},donos);
  }
  /* PURA pro modOn/novoOn/souAdm: o módulo k está ligado pro perfil vigiado? */
  function vcModOn(k){ const p=VC.p; if(!p) return true; if(p.papel==='admin') return true;
    const m=p.modulos; if(m&&k in m) return !!m[k]; return (typeof MODS!=='undefined'&&MODS[k])?MODS[k].def:true; }
  VC.modOn=vcModOn;
  /* PURA pro escOpcoes: no modo, o seletor de base só oferece os donos da pessoa vigiada */
  function escOpcoesVc(donos){ donos=donos||[]; return VC.on? donos.filter(d=>VC.donos.includes(d)) : donos; }
  window.escOpcoesVc=escOpcoesVc;
  window.vcEntrar=vcEntrar; window.vcSair=vcSair; window.vcEntrarPorEmail=vcEntrarPorEmail; window.vcFaixa=vcFaixa;

  /* ── 5) autotestes VER-COMO-V1 (o portão roda) ── */
  window.vcSelfTests=function(ok){
    const _P=(typeof PERFIL!=='undefined')?PERFIL:null, _sel=(typeof ESC!=='undefined')?ESC.sel:null;
    try{
      PERFIL={email:'adm@x.invalid',papel:'admin',modulos:{}};
      ok('VER-COMO-V1: sem o modo, admin continua admin e vê tudo', souAdm()===true && modOn('parceiros')===true && VC.on===false);
      const prf={email:'zz@x.invalid',papel:'lp',nome:'Fulana Zz',modulos:{carteira:true,conversas:false,parceiros:false}};
      const entrou=vcEntrar(prf,['adm@x.invalid'],{quieto:true,teste:true});
      ok('VER-COMO-V1: entra no modo e mostra a faixa com o nome e o botão Sair',
        entrou && VC.on && document.body.classList.contains('vc-on') && /Vendo como Fulana Zz/.test((document.getElementById('vc-faixa')||{}).textContent||'')
        && !!document.querySelector('#vc-faixa button[onclick="vcSair()"]'));
      ok('VER-COMO-V1: no modo, a pessoa não é admin (painel some)', souAdm()===false && (typeof isMaster!=='function'||isMaster()===false));
      ok('VER-COMO-V1: módulos batem com o mapa da pessoa (admMods)', Object.keys(MODS).every(k=>modOn(k)===(typeof admModOn==='function'?admModOn(prf,k):vcModOn(k)))
        && modOn('carteira')===true && modOn('conversas')===false);
      const kN='zz-vc-teste', _n=NOVO_SO_MEU[kN]; NOVO_SO_MEU[kN]={o:'teste',desde:'2026-11-08'};
      const novoOff=novoOn(kN)===false; if(_n===undefined) delete NOVO_SO_MEU[kN]; else NOVO_SO_MEU[kN]=_n;
      ok('VER-COMO-V1: novidade "só na base dele" (NOVO_SO_MEU) fica escondida no modo', novoOff);
      const ops=(typeof escOpcoesVc==='function')?escOpcoesVc(['adm@x.invalid','daniel@x.invalid']):null;
      ok('VER-COMO-V1: o seletor de base só oferece os donos da pessoa (a base do Daniel some)', !ops || (ops.includes('adm@x.invalid') && !ops.includes('daniel@x.invalid')));
      const kS='crmlp_vc_teste_zz'; localStorage.setItem(kS,'1');
      ok('VER-COMO-V1: gravar no aparelho fica só em memória (o aparelho não muda)', localStorage.getItem(kS)==='1' && (VC._lerDeVerdade?VC._lerDeVerdade(kS)===null:true));
      ok('VER-COMO-V1: rede — escrita barrada, leitura passa',
        vcBloqueia('https://x.supabase.co/rest/v1/lp_contatos','POST') && vcBloqueia('https://x.supabase.co/rest/v1/lp_contatos?id=eq.1','PATCH')
        && vcBloqueia('https://x.supabase.co/rest/v1/lp_contatos?id=eq.1','DELETE') && vcBloqueia('https://x.supabase.co/functions/v1/umbler','POST')
        && vcBloqueia('https://www.googleapis.com/calendar/v3/calendars/primary/events','POST') && vcBloqueia('https://x.supabase.co/rest/v1/rpc/lp_varredura_diaria','POST')
        && !vcBloqueia('https://x.supabase.co/rest/v1/lp_contatos?select=*','GET') && !vcBloqueia('https://x.supabase.co/rest/v1/rpc/emb_eu','POST')
        && !vcBloqueia('https://x.supabase.co/auth/v1/token?grant_type=refresh_token','POST'));
      { _escMemo=null; const cur=escAtual();
        ok('BASE-INTEIRA-V1: no modo, a base é a do dono inteira (todos os rótulos, inclusive o antigo da Rebeca) e a do Daniel fica fora',
          cur.id==='vc' && cur.toda===true && escRegOkDe(cur,{_dono:escEu(),lp:'Rebeca'}) && escRegOkDe(cur,{_dono:escEu(),lp:'Gustavo'}) && !escRegOkDe(cur,{_dono:'daniel@x.invalid',lp:'Daniel'})); }
      { const pr={email:'zz@x.invalid',papel:'lp',modulos:{bn:true,recs:false}}; VC.p={papel:'lp',modulos:pr.modulos};
        ok('EQUIPE-REBECA: Recomendações é módulo próprio (depende do Base de Nomes) e desliga por pessoa', MODS.recs&&MODS.recs.requer==='bn'&&!MODS.bn.views.includes('bn-recs')&&MODS.recs.views.includes('bn-recs')&&modOn('bn')===true&&modOn('recs')===false); }
      vcSair(false);
      ok('VER-COMO-V1: sair restaura (admin de novo, faixa some, rascunho descartado)',
        VC.on===false && souAdm()===true && !document.getElementById('vc-faixa') && !document.body.classList.contains('vc-on') && localStorage.getItem(kS)===null);
      { const ops=escOpcoesDe('reb@x.invalid',['juca@x.invalid'],[{rotulo:'gustavo',dono_email:'juca@x.invalid'},{rotulo:'rebeca',dono_email:'juca@x.invalid'}],null), od=ops.find(o=>o.id==='dono:juca@x.invalid');
        const opA=escOpcoesDe('juca@x.invalid',[],[{rotulo:'gustavo',dono_email:'juca@x.invalid'},{rotulo:'rebeca',dono_email:'juca@x.invalid'}],'Gustavo');
        ok('BASE-INTEIRA-V1: assistente vê TODOS os clientes e oportunidades da base do dono (qualquer rótulo), nunca os de outro dono',
          !!od && escRegOkDe(od,{_dono:'juca@x.invalid',lp:'Rebeca'}) && escRegOkDe(od,{_dono:'juca@x.invalid',lp:'Gustavo'}) && escRegOkDe(od,{_dono:'juca@x.invalid'}) && !escRegOkDe(od,{_dono:'daniel@x.invalid',lp:'Daniel'}));
        ok('EQUIPE-REBECA: o rótulo antigo aparece como "Rebeca (base antiga)" no seletor (o filtro continua pelo rótulo)', (opA.find(o=>o.id==='lp:rebeca')||{}).nome==='Rebeca (base antiga)' && (opA.find(o=>o.id==='lp:rebeca')||{}).lp==='Rebeca'); }
      { const _d=DELEG.donos; try{ DELEG.donos=['dono-zz@x.invalid'];
          ok('AGENDA-DONO-LIGADA-V1: a agenda do dono (compartilhada com a assistente) já nasce visível; outra agenda compartilhada segue desligada', gcalCalModo('dono-zz@x.invalid')==='auto' && gcalCalModo('outra-zz@x.invalid')==='off'); }
        finally{ DELEG.donos=_d; } }
      const h=(typeof admHtml==='function')?String(admHtml):'';
      ok('VER-COMO-V1: botão "Usar o app como" no Painel Master · Acessos', /vcEntrarPorEmail\(/.test(h));
    }catch(e){ ok('VER-COMO-V1: autoteste rodou sem exceção ('+(e&&e.message||e)+')',false); }
    finally{ if(VC.on) vcSair(false); PERFIL=_P; try{ ESC.sel=_sel; _escMemo=null; }catch(_){} }
  };
})();
