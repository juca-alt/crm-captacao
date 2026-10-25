/* ═══ NOVA-REC-IA-V1 · T6 do Funil Único (25/10/2026) — "＋ Nova recomendação" no quadro novo ═══════════════════════════════
   Desenho aprovado na demo do funil: "Cole texto, foto, PDF, planilha ou contato (vCard). A IA lê, você revisa, e só grava quando
   tocar em Cadastrar."
   • IA = a Edge Function capturar-lead que JÁ está no ar (Gemini; a chave mora no secret do Supabase, nunca no navegador;
     verify_jwt ligado → só quem está logado chama). Nada novo a publicar no servidor.
   • Sem login / sem rede / IA fora: o texto e o vCard são lidos aqui mesmo (leitor simples) — ele revisa do mesmo jeito.
   • Revisão antes de gravar: cada pessoa vira uma linha editável; quem já existe (funil ou Estoque, por telefone ou nome
     completo) vem DESMARCADO com o aviso de onde está.
   • Gravar = o mesmo contato que o "＋ Novo negócio" cria (funil Novos Negócios, etapa SitPlan → "Novo" no funil novo),
     com recomendante + data da rec (recCarimbar) e a recomendação também entra na lista de quem indicou.
   Só aparece no quadro novo (novoOn('funil-unico')). */
(function(){
'use strict';
const W=window;
const NR={itens:[],rec:'',ia:false,lendo:false,msg:''};
const tx=f=>{ try{ return f(); }catch(_){ return ''; } };
const dig=v=>String(v||'').replace(/\D/g,'');
const k8=v=>{ const d=dig(v); return d.length>=8?d.slice(-8):''; };

/* ── leitor local (sem IA): vCard e texto solto ── */
function lerVcf(t){ const out=[]; String(t||'').split(/BEGIN:VCARD/i).slice(1).forEach(b=>{ const g=re=>{ const m=re.exec(b); return m?m[1].trim():''; };
    let nome=g(/\nFN[^:\n]*:(.+)/i); if(!nome){ const n=g(/\nN[^:\n]*:(.+)/i); if(n){ const p=n.split(';'); nome=[p[1],p[0]].filter(Boolean).join(' ').trim(); } }
    const it={nome:nome.replace(/\\,/g,','),telefone:dig(g(/\nTEL[^:\n]*:(.+)/i)),email:g(/\nEMAIL[^:\n]*:(.+)/i),profissao:g(/\nTITLE[^:\n]*:(.+)/i),empresa:g(/\nORG[^:\n]*:(.+)/i).replace(/;+$/,'')};
    if(it.nome||it.telefone) out.push(it); }); return out; }
const FONE=/(\+?55\s?)?\(?\b\d{2}\)?[\s.-]?9?\d{4}[\s.-]?\d{4}\b/;
function lerTexto(t){ const out=[], vistos=new Set();
  String(t||'').split(/\r?\n/).map(l=>l.replace(/^\s*(\[[^\]]*\]\s*)?([^:]{1,30}:\s)?/,'').trim()).forEach(l=>{ if(!l) return;   /* tira "[12:30] Fulano: " do WhatsApp */
    const m=FONE.exec(l), tel=m?dig(m[0]):'';
    let nome=(m?l.replace(m[0],' '):l).replace(/[-–—:;,|•*_()]+/g,' ').replace(/\s+/g,' ').trim();
    if(/^(ola|olá|oi|bom dia|boa tarde|boa noite|segue|seguem|indica|indicação|contato|contatos)\b/i.test(nome)&&!tel) return;
    const palavras=nome.split(' ').filter(p=>/^[A-Za-zÀ-ÿ'.]+$/.test(p));
    if(!tel&&(palavras.length<2||palavras.length>6||!/^[A-ZÀ-Ý]/.test(nome))) return;
    if(tel&&!palavras.length) nome='';
    const chave=k8(tel)||(typeof normKey==='function'?normKey(nome):nome.toLowerCase()); if(!chave||vistos.has(chave)) return; vistos.add(chave);
    out.push({nome:palavras.slice(0,6).join(' '),telefone:tel}); });
  return out; }

/* ── quem já existe ── */
function jaExiste(it){ const t=k8(it.telefone), n=typeof normKey==='function'?normKey(it.nome||''):String(it.nome||'').toLowerCase();
  const casa=x=>x&&((t&&k8(x.telefone)===t)||(n&&n.indexOf(' ')>0&&(typeof normKey==='function'?normKey(x.nome||''):'')===n));
  const f=(S.contatos||[]).find(x=>!x.merged_into&&casa(x)); if(f) return {onde:'funil',nome:f.nome,etapa:tx(()=>ET_LABEL[f.etapa])||f.etapa};
  const b=((typeof BN!=='undefined'&&BN.contatos)||[]).find(x=>!x.merged_into&&casa(x)); if(b) return {onde:'Estoque',nome:b.nome};
  return null; }

/* ── modal ── */
function nomesRecomendantes(){ const s=new Set(); (S.contatos||[]).forEach(c=>{ if(c&&c.nome&&!c.merged_into) s.add(c.nome); }); return [...s].sort((a,b)=>a.localeCompare(b,'pt-BR')).slice(0,600); }
function htmlEntrada(){ return `<h2>✨ Nova recomendação</h2>
  <div class="sub" style="margin:0">Cole a lista ou a conversa, ou mande foto, print, PDF ou contato do celular (vCard). A IA lê, você revisa, e <b>só grava quando tocar em Cadastrar</b>.</div>
  <div class="fu-fld"><label for="nr-rec">Quem indicou</label><input type="text" id="nr-rec" list="nr-rec-l" maxlength="80" placeholder="nome de quem passou as recomendações" value="${esc(NR.rec)}" oninput="NOVA_REC.rec=this.value"><datalist id="nr-rec-l">${nomesRecomendantes().map(n=>`<option value="${esc(n)}">`).join('')}</datalist></div>
  <div class="fu-fld"><label for="nr-txt">Texto (lista, conversa do WhatsApp, contatos)</label><textarea id="nr-txt" rows="6" maxlength="20000" placeholder="Ex.:&#10;Maria Souza 81 90000-0000 dentista&#10;João Lima - (81) 90000-1111"></textarea></div>
  <div class="fu-fld"><label for="nr-arq">📎 Foto, print, PDF ou contato (.vcf)</label><input type="file" id="nr-arq" accept="image/*,application/pdf,.vcf,text/vcard,text/x-vcard"></div>
  ${NR.msg?`<div class="fu-nota">${esc(NR.msg)}</div>`:''}
  <div class="acts"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar (nada foi gravado)</button><button type="button" class="btn btn-p" id="nr-ler" ${NR.lendo?'disabled':''} onclick="nrLer()">${NR.lendo?'Lendo…':'✨ Ler'}</button></div>`; }
function htmlRevisao(){ const n=NR.itens.filter(x=>x.ok).length;
  return `<h2>Revisar ${NR.itens.length} recomendaç${NR.itens.length===1?'ão':'ões'}</h2>
  <div class="sub" style="margin:0">${NR.ia?'Lido pela IA.':'Lido aqui mesmo (sem IA).'} Confira e corrija. ${NR.rec?`Indicadas por <b>${esc(NR.rec)}</b>.`:'<b>Sem recomendante</b>: volte e preencha se souber.'} Quem já existe vem desmarcado.</div>
  ${NR.msg?`<div class="fu-nota">${esc(NR.msg)}</div>`:''}
  <div class="nr-lista">${NR.itens.map((x,k)=>`<div class="nr-it${x.ok?'':' off'}">
    <label class="nr-ck" for="nr-ok-${k}"><input type="checkbox" id="nr-ok-${k}" ${x.ok?'checked':''} onchange="nrCampo(${k},'ok',this.checked)"> ${x.dup?`<span class="fu-bd a">já existe no ${esc(x.dup.onde)}${x.dup.etapa?' · '+esc(x.dup.etapa):''}</span>`:'<span class="fu-bd v">nova</span>'}</label>
    <div class="fu-g2"><div class="fu-fld"><label for="nr-n-${k}">Nome</label><input type="text" id="nr-n-${k}" value="${esc(x.nome||'')}" onchange="nrCampo(${k},'nome',this.value)"></div><div class="fu-fld"><label for="nr-t-${k}">Celular</label><input type="text" id="nr-t-${k}" inputmode="tel" value="${esc(x.telefone||'')}" onchange="nrCampo(${k},'telefone',this.value)"></div>
    <div class="fu-fld"><label for="nr-p-${k}">Profissão</label><input type="text" id="nr-p-${k}" value="${esc(x.profissao||x.cargo||'')}" onchange="nrCampo(${k},'profissao',this.value)"></div><div class="fu-fld"><label for="nr-c-${k}">Cidade</label><input type="text" id="nr-c-${k}" value="${esc(x.cidade||'')}" onchange="nrCampo(${k},'cidade',this.value)"></div></div>
    ${x.observacoes||x.empresa?`<div class="sub" style="margin:0">${esc([x.empresa,x.observacoes].filter(Boolean).join(' · '))}</div>`:''}</div>`).join('')||'<div class="fu-vazio">Não achei ninguém nesse conteúdo. Volte e tente com o texto ou outra foto.</div>'}</div>
  <div class="acts" style="justify-content:space-between"><button type="button" class="btn btn-ghost" onclick="nrVoltar()">← Voltar</button><span style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn btn-ghost" onclick="fuFechar()">Cancelar (nada foi gravado)</button><button type="button" class="btn btn-p" ${n?'':'disabled'} onclick="nrCadastrar()">Cadastrar ${n}</button></span></div>`; }
function css(){ if(document.getElementById('nr-css')) return; const s=document.createElement('style'); s.id='nr-css'; s.textContent=`
.nr-lista{display:flex;flex-direction:column;gap:10px;max-height:52vh;overflow:auto}
.nr-it{border:1px solid var(--linha);border-radius:10px;padding:10px;display:flex;flex-direction:column;gap:8px}.nr-it.off{opacity:.6;background:#f8fafc}
.nr-ck{display:flex;align-items:center;gap:8px;font-size:13px;min-height:32px}.nr-ck input{width:18px;height:18px}
.fu-md textarea{border:1px solid var(--linha);border-radius:8px;padding:8px 10px;font-size:14px;width:100%;font-family:inherit;resize:vertical}
.fu-md input[type=file]{font-size:13px}
@media (max-width:760px){.nr-ck{min-height:44px}.fu-md textarea{font-size:16px}.nr-lista{max-height:none}}`; document.head.appendChild(s); }
function pinta(h){ const md=document.querySelector('#fu-ov .fu-md'); if(md) md.innerHTML=h; else if(typeof fuModal==='function') fuModal(h,true); }
function fuNovaRec(){ css(); NR.itens=[]; NR.msg=''; NR.ia=false; NR.lendo=false; if(typeof fuModal==='function') fuModal(htmlEntrada(),true); setTimeout(()=>{ const r=document.getElementById(NR.rec?'nr-txt':'nr-rec'); if(r) r.focus(); },40); }
function nrVoltar(){ NR.msg=''; pinta(htmlEntrada()); }
function nrCampo(k,f,v){ const x=NR.itens[k]; if(!x) return; if(f==='ok') x.ok=!!v; else x[f]=String(v||'').trim(); if(f==='ok'){ const it=document.getElementById('nr-ok-'+k); if(it) it.closest('.nr-it').classList.toggle('off',!v); const b=document.querySelector('#fu-ov .acts .btn-p'); if(b){ const n=NR.itens.filter(y=>y.ok).length; b.textContent='Cadastrar '+n; b.disabled=!n; } } }

/* imagem → JPEG de até 1600px (o que a função espera) */
function imgB64(file){ return new Promise((ok,erro)=>{ const fr=new FileReader(); fr.onerror=()=>erro(new Error('não consegui ler a imagem'));
  fr.onload=()=>{ const im=new Image(); im.onload=()=>{ const m=1600, r=Math.min(1,m/Math.max(im.width,im.height)), cv=document.createElement('canvas'); cv.width=Math.round(im.width*r); cv.height=Math.round(im.height*r);
      cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height); ok(cv.toDataURL('image/jpeg',0.85).split(',')[1]); }; im.onerror=()=>erro(new Error('formato de imagem não suportado')); im.src=fr.result; };
  fr.readAsDataURL(file); }); }
const fileB64=file=>new Promise((ok,erro)=>{ const fr=new FileReader(); fr.onerror=()=>erro(new Error('não consegui ler o arquivo')); fr.onload=()=>ok(String(fr.result).split(',')[1]||''); fr.readAsDataURL(file); });
const fileTxt=file=>new Promise((ok,erro)=>{ const fr=new FileReader(); fr.onerror=()=>erro(new Error('não consegui ler o arquivo')); fr.onload=()=>ok(String(fr.result||'')); fr.readAsText(file); });
const podeIA=()=>{ try{ return typeof sb!=='undefined'&&sb&&sb.functions&&typeof logado==='function'&&logado(); }catch(_){ return false; } };

async function nrLer(){ const t=String((document.getElementById('nr-txt')||{}).value||'').trim(), inp=document.getElementById('nr-arq'), f=inp&&inp.files&&inp.files[0];
  NR.rec=String((document.getElementById('nr-rec')||{}).value||'').trim();
  if(!t&&!f){ toast('Cole um texto ou escolha um arquivo',false); return; }
  NR.lendo=true; NR.msg=''; const b=document.getElementById('nr-ler'); if(b){ b.disabled=true; b.textContent='Lendo…'; }
  let itens=[], ia=false, aviso='';
  try{
    const vcf=f&&(/\.vcf$/i.test(f.name)||/vcard/i.test(f.type));
    if(vcf){ itens=lerVcf(await fileTxt(f)); }
    else if(podeIA()){
      const body={}; if(t) body.texto=t;
      if(f){ if(/^image\//.test(f.type)){ body.imagem_base64=await imgB64(f); body.media_type='image/jpeg'; } else if(f.type==='application/pdf'||/\.pdf$/i.test(f.name)){ body.pdf_base64=await fileB64(f); } else { body.texto=[t,await fileTxt(f)].filter(Boolean).join('\n'); } }
      const r=await sb.functions.invoke('capturar-lead',{body}); const d=r&&r.data;
      if(r&&r.error) throw r.error; if(!d||!d.ok) throw new Error((d&&d.erro)||'a IA não respondeu');
      itens=((d.dados&&d.dados.leads)||[]).map(x=>({nome:x.nome||'',telefone:dig(x.telefone),email:x.email||'',profissao:x.cargo||'',empresa:x.empresa||'',cidade:x.cidade||'',observacoes:x.observacoes||'',recomendante:x.recomendante||''}));
      ia=true; if(!NR.rec){ const r1=itens.map(x=>x.recomendante).find(Boolean); if(r1) NR.rec=r1; }
    } else { if(f&&!/^text\//.test(f.type)){ aviso='Foto e PDF precisam da IA, que só funciona logado. Li só o texto.'; } itens=lerTexto([t,f&&/^text\//.test(f.type)?await fileTxt(f):''].filter(Boolean).join('\n')); if(!aviso) aviso='Sem login a IA não roda: li o texto aqui mesmo. Confira com atenção.'; }
  }catch(e){ console.warn('nova rec: IA',e); itens=lerTexto(t); aviso='A IA não conseguiu agora ('+String(e&&e.message||e).slice(0,80)+'). '+(itens.length?'Li o texto aqui mesmo: confira com atenção.':'Tente de novo em instantes.'); }
  NR.lendo=false; NR.ia=ia; NR.msg=aviso;
  NR.itens=itens.filter(x=>x.nome||x.telefone).slice(0,60).map(x=>{ const dup=jaExiste(x); return Object.assign(x,{dup,ok:!dup}); });
  pinta(htmlRevisao()); }

function nrCadastrar(){ const sel=NR.itens.filter(x=>x.ok&&(x.nome||'').trim()); if(!sel.length){ toast('Marque pelo menos uma pessoa com nome',false); return; }
  const rec=String(NR.rec||'').trim(), recC=tx(()=>pesCanon(rec))||rec, hoje=hojeISO(), quem=tx(()=>quemFez());
  const dono=rec?(S.contatos||[]).find(c=>c&&!c.merged_into&&typeof normKey==='function'&&normKey(c.nome||'')===normKey(rec)):null;
  const criados=sel.map(x=>{ if(!x.profissao&&x.cargo) x.profissao=x.cargo; const c={ id:uid(), lp:tx(()=>escLpNovo())||S.activeUser, nome:x.nome.trim(), sexo:'—', idade:null, profissao:x.profissao||'—', telefone:tx(()=>telLimpa(x.telefone))||x.telefone||'',
      estrelas:0, ance:null, etapa:'SitPlan', funil:'nn', origem:recC||'—', trilha:'seguro', criadoEm:hoje, taStatus:'—', taTentativas:0, notas:x.observacoes||'',
      infoclient:{pessoais:false,familiar:false,financeiro:false,saude:false}, recs:[], eventos:[], planos:[], interacoes:[], sitplan:null,
      recomendante:recC||'', origem_tipo:'recomendacao' };
    if(x.cidade) c.cidade=x.cidade; if(x.email) c.email=x.email;
    S.contatos.push(c); tx(()=>normContato(c)); tx(()=>recCarimbar(c)); tx(()=>fuSincLegado(c));
    c.interacoes.push({id:uid(),k:'nota',l:'Entrou pela Nova recomendação'+(NR.ia?' (lida pela IA)':'')+(recC?' · indicado por '+recC:''),dia:hoje,ts:new Date().toISOString(),por:quem});
    if(dono&&Array.isArray(dono.recs)) dono.recs.push({nome:c.nome,tel:c.telefone||'',idade:null,perfil:c.profissao!=='—'?c.profissao:''});
    return c; });
  salvar(); if(typeof fuFechar==='function') fuFechar(); NR.itens=[]; render();
  toast(`${criados.length} recomendaç${criados.length===1?'ão cadastrada':'ões cadastradas'} em Novo${recC?' · de '+recC.split(' ')[0]:''}`,true); }

function nrSelfTests(ok){
  const v=lerVcf('BEGIN:VCARD\nVERSION:3.0\nFN:Fulano de Tal\nTEL;TYPE=CELL:+55 81 90000-1234\nEND:VCARD\nBEGIN:VCARD\nN:Silva;Beltrano;;;\nTEL:81900005678\nEND:VCARD');
  ok('NOVA-REC: vCard vira pessoas (FN ou N, telefone só dígitos)', v.length===2&&v[0].nome==='Fulano de Tal'&&v[0].telefone==='5581900001234'&&v[1].nome==='Beltrano Silva');
  const t=lerTexto('Seguem as indicações:\nMaria Exemplo 81 90000-0001 dentista\n[10:02] Ana: João Teste - (81) 90000-0002\nCarla Modelo Nunes\nok');
  ok('NOVA-REC: texto solto vira pessoas (nome + celular; tira a moldura do WhatsApp e as frases)', t.length===3&&t[0].telefone==='81900000001'&&/Maria Exemplo/.test(t[0].nome)&&t[1].nome==='João Teste'&&t[2].nome==='Carla Modelo Nunes');
  const bak=S.contatos; S.contatos=[{id:'nr1',nome:'Fulano Exemplo',telefone:'(81) 90000-7777',etapa:'TA',funil:'nn'}];
  ok('NOVA-REC: quem já existe (mesmo celular ou nome completo) vem marcado', !!jaExiste({nome:'Outro',telefone:'81900007777'})&&!!jaExiste({nome:'fulano exemplo'})&&!jaExiste({nome:'Ciclano',telefone:'81911112222'}));
  S.contatos=bak;
}
W.NOVA_REC=NR;
Object.assign(W,{fuNovaRec,nrLer,nrVoltar,nrCampo,nrCadastrar,nrSelfTests,nrLerTexto:lerTexto,nrLerVcf:lerVcf});
})();
