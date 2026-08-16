/* ═══════════════════════════════════════════════════════════════════════════
   Service worker do CRM · escopo /crm-captacao/

   DESENHO EM UMA FRASE: online você recebe sempre a versão nova; offline
   você recebe a última que funcionou.

   Isso é deliberado. Um service worker mal desenhado é a única peça capaz de
   prender alguém numa versão antiga do app sem que ele perceba — e este CRM
   é ferramenta de trabalho diário. Por isso:

     · NAVEGAÇÃO E HTML → network-first. A rede é sempre tentada primeiro. O
       cache só entra quando a rede falha de verdade (avião, elevador, 3G que
       morreu). Nunca existe o caso "estou online e vendo código velho".
     · index.html (visão CAPTAÇÃO) → passa direto, sem interceptação. As duas
       visões do CRM são projetos separados por regra do repositório, e um
       service worker registrado por um lado não deve mudar o comportamento
       do outro.
     · CDN do supabase-js → cache-first com revalidação. É a única
       dependência externa, é versionada na URL e é justamente ela que trava
       o boot quando a rede está ruim.
     · Cache nomeado por VERSÃO. Trocar VERSAO invalida tudo; o activate
       apaga os caches antigos e assume o controle na hora.
   ═══════════════════════════════════════════════════════════════════════ */

const VERSAO = 'crmlp-v1';
const CACHE = VERSAO;

/* Nada é pré-cacheado na instalação de propósito: o app tem 550 KB e baixar
   isso no exato momento em que a pessoa abriu a página para trabalhar é
   competir com o que ela veio fazer. O cache se forma sozinho, com o que ela
   de fato usa. */
self.addEventListener('install', e => { self.skipWaiting(); });

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const nomes = await caches.keys();
    await Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

/* O botão "⬆︎ Atualizar app" fala com o worker por aqui. */
self.addEventListener('message', e => {
  if (e.data === 'limpar') {
    e.waitUntil(caches.keys().then(ns => Promise.all(ns.map(n => caches.delete(n)))));
  }
});

const ehSupabaseJs = u => u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('supabase-js');

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;

  let u;
  try { u = new URL(req.url); } catch (_) { return; }

  /* a visão Captação fica fora: não é desta sessão e não deve mudar */
  if (u.pathname.endsWith('/index.html') || u.pathname.endsWith('/index-dev.html')) return;

  /* dados nunca são cacheados — Supabase é a fonte da verdade */
  if (u.hostname.endsWith('.supabase.co')) return;

  if (ehSupabaseJs(u)) {
    /* cache-first: a URL é versionada, então o conteúdo não muda debaixo dos pés */
    e.respondWith((async () => {
      const c = await caches.open(CACHE);
      const guardado = await c.match(req);
      const rede = fetch(req).then(r => { if (r && r.ok) c.put(req, r.clone()); return r; }).catch(() => null);
      return guardado || (await rede) || Response.error();
    })());
    return;
  }

  if (u.origin !== self.location.origin) return;

  const ehPagina = req.mode === 'navigate' ||
                   (req.headers.get('accept') || '').includes('text/html') ||
                   u.pathname.endsWith('.html');
  if (!ehPagina) return;

  /* network-first: é isto que garante que ninguém fica preso numa versão */
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    try {
      const r = await fetch(req);
      if (r && r.ok) c.put(req, r.clone());
      return r;
    } catch (_) {
      const guardado = await c.match(req) || await c.match(u.pathname);
      if (guardado) return guardado;
      return new Response(
        '<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<div style="font:16px/1.6 -apple-system,system-ui,sans-serif;padding:40px 22px;max-width:34em;margin:0 auto;color:#0f172a">' +
        '<h1 style="font-size:20px;margin:0 0 10px">Sem conexão</h1>' +
        '<p style="color:#475569;margin:0">Esta tela ainda não tinha sido aberta neste aparelho, então não há cópia guardada. ' +
        'Assim que a conexão voltar, ela carrega normalmente.</p></div>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    }
  })());
});
