/* DRIVE-CLIENTE-V1 (09/10/2026) — a pasta do cliente no Google Drive, fora do vendas.html.
   Decisão dele (1A): a Revisão de Proteção usa o MESMO Drive dos anexos do CRM, pela API — funciona no iPad
   (a pasta local do File System Access só existia no Chrome do desktop).
   Raiz = Pipe X / CRM Life Planner / Histórico de Clientes. Pasta do cliente = filha da raiz achada pela CHAVE
   (sem acento, minúscula, só letras/números): "José", "Jose" e "JOSÉ" são a mesma pasta. Abreviação ("G" × "Gomes")
   só casa com o mesmo nº de palavras. Pasta nova nasce em Title Case. Mesma regra do vendas.html (DRIVE-PASTA-V1).
   Token: dentro do app (iframe) pede ao vendas.html; sozinho, reaproveita a conexão Google salva pelo app
   (crmlp_gcal_tok) ou conecta aqui com o mesmo cliente OAuth e devolve o token pro app usar também. */
(function () {
  'use strict';
  var RAIZ = '1n3tbK5JoVPeWyOz5-ToUe6Yg1v3537eu';
  var CLIENT_ID = '63708753663-92us3rgem9s1j6rapi86b8uerc5440fr.apps.googleusercontent.com';
  var SCOPE = 'https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/tasks https://www.googleapis.com/auth/drive';
  var TOK_K = 'crmlp_gcal_tok';
  var API = 'https://www.googleapis.com/drive/v3/files';
  var PART = {de: 1, da: 1, do: 1, das: 1, dos: 1, e: 1, di: 1, du: 1};

  function chave(n) { return String(n || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function slug(n) { return String(n || 'Cliente').replace(/\s+/g, ' ').trim().replace(/[\/\\:*?"<>|]/g, '-') || 'Cliente'; }
  function nomePasta(n) {
    return slug(String(n || '').toLowerCase().replace(/\s+/g, ' ').trim().split(' ')
      .map(function (w, i) { return i && PART[w] ? w : w.charAt(0).toUpperCase() + w.slice(1); }).join(' '));
  }
  function casa(idx, nome) {
    var k = chave(nome); if (!k) return null; if (idx.has(k)) return idx.get(k);
    var t = k.split(' '); if (t.length < 2) return null; var achou = null;
    idx.forEach(function (v, kk) {
      if (achou === false) return;
      var u = kk.split(' '); if (u.length !== t.length || u[0] !== t[0] || u[u.length - 1] !== t[t.length - 1]) return;
      var ok = t.every(function (w, i) { return w === u[i] || (w.length === 1 && u[i][0] === w) || (u[i].length === 1 && w[0] === u[i]); });
      if (ok) achou = achou ? false : v;
    });
    return achou || null;
  }

  /* ── token ── */
  var mem = null;
  function lerSalvo() {
    try { var o = JSON.parse(localStorage.getItem(TOK_K) || 'null');
      if (o && o.tok && o.exp && Date.now() < o.exp - 60000 && /auth\/drive(\s|$)/.test(String(o.escopos || ''))) return o; } catch (_) {}
    return null;
  }
  function temToken() { return !!((mem && Date.now() < mem.exp - 60000) || lerSalvo()); }
  function gis(cb) {
    if (window.google && google.accounts && google.accounts.oauth2) return cb();
    var ex = document.getElementById('gis-sdk'); if (ex) { ex.addEventListener('load', cb); return; }
    var s = document.createElement('script'); s.id = 'gis-sdk'; s.src = 'https://accounts.google.com/gsi/client'; s.async = true; s.onload = cb; document.head.appendChild(s);
  }
  var _tc = null, _pend = null;
  function token(interativo) {
    if (mem && Date.now() < mem.exp - 60000) return Promise.resolve(mem.tok);
    var sv = lerSalvo(); if (sv) { mem = sv; return Promise.resolve(sv.tok); }
    if (!interativo) return Promise.reject(new Error('sem conexão com o Google'));   /* sem pop-up fora de um clique */
    try { if (window.parent && window.parent !== window && typeof window.parent.drvToken === 'function') return window.parent.drvToken(); } catch (_) {}
    return new Promise(function (res, rej) {
      gis(function () {
        try {
          if (!_tc) _tc = google.accounts.oauth2.initTokenClient({client_id: CLIENT_ID, scope: SCOPE,
            callback: function (r) {
              var p = _pend; _pend = null; if (!p) return;
              if (r && r.access_token) {
                mem = {tok: r.access_token, exp: Date.now() + Number(r.expires_in || 3600) * 1000, escopos: String(r.scope || '')};
                try { var o = JSON.parse(localStorage.getItem(TOK_K) || '{}') || {}; o.tok = mem.tok; o.exp = mem.exp; o.escopos = mem.escopos; localStorage.setItem(TOK_K, JSON.stringify(o)); } catch (_) {}
                p.res(mem.tok);
              } else p.rej(new Error('sem token do Google'));
            },
            error_callback: function (e) { var p = _pend; _pend = null; if (p) p.rej(e && e.message ? e : new Error('conexão Google cancelada')); }});
          _pend = {res: res, rej: rej};
          var o = {prompt: ''}; try { var h = (JSON.parse(localStorage.getItem(TOK_K) || '{}') || {}).hint; if (h) { o.hint = h; o.login_hint = h; } } catch (_) {}
          _tc.requestAccessToken(o);
        } catch (e) { rej(e); }
      });
    });
  }
  function api(method, url, body, H, interativo) {
    return token(interativo !== false).then(function (tok) {
      return fetch(url, {method: method, headers: Object.assign({Authorization: 'Bearer ' + tok}, H || {}), body: body});
    }).then(function (r) {
      if (r.ok) return r;
      if (r.status === 401) { mem = null; }
      return r.json().catch(function () { return {}; }).then(function (j) { throw new Error((j.error && j.error.message) || 'Drive respondeu ' + r.status); });
    });
  }
  function apiJson(m, u, b, H, i) { return api(m, u, b, H, i).then(function (r) { return r.json(); }); }

  /* ── pastas ── */
  var idx = null, idxTs = 0;
  function indice(forcar, interativo) {
    if (idx && !forcar && Date.now() - idxTs < 10 * 60e3) return Promise.resolve(idx);
    var m = new Map(), q = encodeURIComponent("'" + RAIZ + "' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false");
    function pag(pt) {
      return apiJson('GET', API + '?q=' + q + '&fields=nextPageToken,files(id,name)&pageSize=1000' + (pt ? '&pageToken=' + encodeURIComponent(pt) : ''), null, null, interativo)
        .then(function (j) { (j.files || []).forEach(function (f) { var k = chave(f.name); if (k && !m.has(k)) m.set(k, {id: f.id, name: f.name}); });
          return j.nextPageToken ? pag(j.nextPageToken) : m; });
    }
    return pag('').then(function (mm) { idx = mm; idxTs = Date.now(); return mm; });
  }
  function pasta(nome, criar, interativo) {
    return indice(false, interativo).then(function (ix) {
      var v = casa(ix, nome); if (v || !criar) return v || null;
      var nm = nomePasta(nome || 'Sem nome');
      return apiJson('POST', API + '?fields=id,name', JSON.stringify({name: nm, mimeType: 'application/vnd.google-apps.folder', parents: [RAIZ]}), {'Content-Type': 'application/json'})
        .then(function (c) { var o = {id: c.id, name: c.name || nm}; ix.set(chave(o.name), o); return o; });
    });
  }
  function pastas(termo, interativo) {   /* pastas cujo nome tem todas as palavras digitadas (prefixo) */
    var t = chave(termo).split(' ').filter(Boolean);
    return indice(false, interativo).then(function (ix) { var out = [];
      ix.forEach(function (v, k) { var p = k.split(' '); if (t.length && t.every(function (x) { return p.some(function (y) { return y.indexOf(x) === 0; }); })) out.push(v); });
      return out.slice(0, 8); });
  }
  function listar(pastaId, interativo) {
    var q = encodeURIComponent("'" + pastaId + "' in parents and trashed = false");
    return apiJson('GET', API + '?q=' + q + '&orderBy=modifiedTime desc&pageSize=100&fields=files(id,name,webViewLink,mimeType,modifiedTime)', null, null, interativo).then(function (j) { return j.files || []; });
  }
  function baixarTexto(id) { return api('GET', API + '/' + encodeURIComponent(id) + '?alt=media').then(function (r) { return r.text(); }); }
  /* sobe na pasta do cliente (cria se não houver). nome = nome final do arquivo no Drive. */
  function upload(blob, nome, cliente) {
    return pasta(cliente, true).then(function (p) {
      var fd = new FormData();
      fd.append('metadata', new Blob([JSON.stringify({name: nome, parents: [p.id]})], {type: 'application/json'}));
      fd.append('file', blob, nome);
      return apiJson('POST', 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink,mimeType', fd)
        .then(function (j) { return {id: j.id, name: j.name, url: j.webViewLink, pasta: p}; });
    });
  }

  window.DriveCliente = {RAIZ: RAIZ, chave: chave, nomePasta: nomePasta, casa: casa, temToken: temToken, token: token,
    indice: indice, pasta: pasta, pastas: pastas, listar: listar, baixarTexto: baixarTexto, upload: upload};
})();
