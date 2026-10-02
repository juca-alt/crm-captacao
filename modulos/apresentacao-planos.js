/* ============================================================================
   MÓDULO · APRESENTAÇÃO DE PLANOS  (formato "plano-cards-v1")
   ----------------------------------------------------------------------------
   A tela que ele aprovou em 02/10/2026 (caso-modelo montado no Claude): cards
   de plano recolhíveis, comparação Temporário × Vida e Saúde 360, card Hoje.
   Pensada pra reunião de 5–10 min com cliente visual, no iPad.

   Peça independente — não lê nada global da Revisão. Quem usa passa os dados:

     ApresentacaoPlanos.prepararApresentacao(estado, tarifador)
         → objeto plano-cards-v1 COMPLETO (cada cenário com seus grupos).
           Se o estado traz `apresentacao` (montada pelo Claude), parte dela;
           se não traz, gera tudo dos cenários (gerarApresentacao).
     ApresentacaoPlanos.gerarApresentacao(estado, tarifador)
         → plano-cards-v1 gerado só do estado (cen[].linhas, hoje, cliente).
     ApresentacaoPlanos.renderApresentacao(container, dados)
         → desenha no container (e liga abrir/fechar, teclado incluso).
     ApresentacaoPlanos.exportarHTML(dados)
         → string de um .html standalone (abre offline, sem login).

   O `tarifador` é um adaptador fino que o app hospedeiro entrega:
     cenItens(cen)  → [{pid, fam, grupo, resgatavel, divisor, prazo, cap, pre}]
     cenTotal(cen)  → prêmio mensal do cenário (com IOF)
     hojeItens()    → [{grupo (chave SIN), cod, cap, pre}] das apólices de hoje
     hojeTotal()    → prêmio mensal de hoje (com IOF)
     hojeRotulo()   → "3 apólices"
     ficaItens()    → itens das apólices que FICAM (somam no plano), ou []
     premio(pid, prazo, capital, idade, sexo, classe) → prêmio mensal | null
     resgate(fam, prazo, sexo, idadeEmissao, capital) → {10:v,20:v,30:v} | null
   Qualquer função ausente só tira o pedaço que dependia dela.

   Regras de tela (spec 02/10): ▲ só quando o capital é MAIOR que o de hoje;
   nunca seta pra baixo; texto mínimo; ordem dos cards por prêmio decrescente;
   o recomendado leva ⭐ e borda; tudo abre aberto (apresentação pro cliente).
   ========================================================================= */
(function (root) {
  'use strict';

  /* ---------- catálogo: chave → ícone, rótulo, grupo ---------- */
  var ITENS = {
    INV:   { i: '🦽', t: 'Invalidez acidental' },
    PA:    { i: '🤝', t: 'Perda de autonomia' },
    DG:    { i: '🩺', t: 'Doenças graves' },
    FRA:   { i: '🦴', t: 'Quebra de ossos' },
    CIA:   { i: '🏥', t: 'Cirurgia ampliada' },
    CIB:   { i: '🩹', t: 'Cirurgia' },
    HC:    { i: '🛏️', t: 'Diária internado', reais: true },
    VS:    { i: '👴', t: 'Vida e Saúde 360' },
    VI:    { i: '♾️', t: 'Vida Inteira' },
    TEMP:  { i: '⏳', t: 'Temporário' },
    MORTE: { i: '🕊️', t: 'Morte, total' },
    MA:    { i: '⚡', t: 'Morte acidental' },
    RENDA: { i: '💸', t: 'Renda para a família', reais: true, suf: '/mês' },
    AF:    { i: '⚱️', t: 'Assistência funeral' }
  };
  var GRUPOS_PLANO = [
    ['Se você parar', ['INV', 'PA', 'DG']],
    ['Dia a dia', ['FRA', 'CIA', 'CIB', 'HC']],
    ['Para a velhice', ['VS', 'VI']],
    ['Se você faltar', ['TEMP', 'MORTE', 'MA', 'RENDA', 'AF']]
  ];
  var GRUPOS_HOJE = [
    ['Se você parar', ['INV', 'PA', 'DG']],
    ['Dia a dia', ['FRA', 'CIA', 'CIB', 'HC']],
    ['Velhice e morte', ['VS', 'VI', 'MORTE', 'MA', 'RENDA', 'AF']]
  ];
  /* com o que cada item se compara no card Hoje (pro ▲) */
  var EQUIV_HOJE = { VS: 'VI', TEMP: 'MORTE' };
  /* as que entram no "Morte, total" */
  var MORTE_DE = ['VS', 'VI', 'TEMP'];

  /* ---------- números ---------- */
  function nBR(v, dec) {
    return Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: dec || 0 });
  }
  /* 5,7 mi · 6,25 mi · 851 mil · 13,7 mil · 80 mil */
  function fmtCap(v) {
    v = +v || 0;
    var a = Math.abs(v);
    if (a >= 1e6) {
      var x = v / 1e6, d2 = Math.round(x * 100) / 100;
      return nBR(Math.abs(d2 - x) < 1e-9 ? d2 : Math.round(x * 10) / 10, 2) + ' mi';
    }
    if (a >= 1000) {
      var m = v / 1000;
      if (Math.abs(m) >= 20) return nBR(Math.round(m)) + ' mil';
      return nBR(Math.round(m * 10) / 10, 1) + ' mil';
    }
    return 'R$ ' + nBR(Math.round(v));
  }
  function fmtReais(v) { return 'R$ ' + nBR(Math.round(+v || 0)); }
  function fmtValorItem(k, v) {
    var c = ITENS[k] || {};
    return c.reais ? fmtReais(v) + (c.suf || '') : fmtCap(v);
  }
  /* "5,7 mi" → 5700000 · "300 mil" → 300000 · "R$ 2.000" → 2000 · "13,7k" → 13700 */
  function parseValor(s) {
    if (typeof s === 'number') return s;
    var t = String(s || '').toLowerCase().replace(/r\$\s*/g, '').trim();
    var m = /^([\d.,]+)\s*(mi|milh[oõ]es|mil|k)?/.exec(t);
    if (!m) return 0;
    var num = m[1];
    if (m[2]) num = num.replace(/\./g, '').replace(',', '.');
    else num = num.replace(/\./g, '').replace(',', '.');
    var v = parseFloat(num) || 0;
    if (m[2] === 'mi' || (m[2] && m[2].indexOf('milh') === 0)) v *= 1e6;
    else if (m[2] === 'mil' || m[2] === 'k') v *= 1000;
    return v;
  }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  }
  function primNome(n) {
    var p = String(n || '').trim().split(/\s+/).filter(Boolean);
    if (p.length <= 2) return p.join(' ');
    var lig = { da: 1, de: 1, do: 1, das: 1, dos: 1, e: 1 };
    return lig[p[1].toLowerCase()] ? p[0] + ' ' + p[2] : p[0] + ' ' + p[1];
  }

  /* ---------- classificação ---------- */
  function chaveProduto(it) {
    var f = String(it.fam || it.pid || '').toUpperCase(), g = it.grupo;
    if (f === 'WV') return 'VS';
    if (g === 'MQC') {
      if (it.divisor === 10 || f === 'FI' || f === 'FR') return 'RENDA';
      return it.resgatavel ? 'VI' : 'TEMP';
    }
    if (g === 'INV') return 'INV';
    if (g === 'DG') return 'DG';
    if (g === 'PA') return 'PA';
    if (g === 'FRA') return 'FRA';
    if (g === 'CIR') return f === 'CIA' ? 'CIA' : 'CIB';
    if (g === 'INT') return 'HC';
    if (g === 'FUN') return 'AF';
    if (g === 'MA') return 'MA';
    return null;
  }
  function chaveHoje(it) {
    var c = String(it.cod || '').toUpperCase(), g = it.grupo;
    if (g === 'MQC_VIT') return /^WV/.test(c) ? 'VS' : 'VI';
    if (g === 'MQC_TEMP' || g === 'MQC') return 'TEMP';
    if (g === 'INVT' || g === 'INV') return 'INV';
    if (g === 'CIR') return /^CIA/.test(c) ? 'CIA' : 'CIB';
    if (g === 'INT') return 'HC';
    if (g === 'FUN') return 'AF';
    if (g === 'RENDA') return 'RENDA';
    if (ITENS[g]) return g;
    return null;
  }
  /* "WL20G 80k" / "DDP5G 171k" → chave + valor (a apólice antiga que fica) */
  function chaveDeCodigo(cod) {
    var c = String(cod || '').toUpperCase();
    if (/^WV/.test(c)) return 'VS';
    if (/^(WL|MO|VI)/.test(c)) return 'VI';
    if (/^(TP|TM|TF|TR|DT)/.test(c)) return 'TEMP';
    if (/^AF/.test(c)) return 'AF';
    if (/^(DD|DIM|DR\d)/.test(c)) return 'DG';
    if (/^PA/.test(c)) return 'PA';
    if (/^PI/.test(c)) return 'INV';
    if (/^CIA/.test(c)) return 'CIA';
    if (/^CI/.test(c)) return 'CIB';
    if (/^BRB/.test(c)) return 'FRA';
    if (/^HC/.test(c)) return 'HC';
    if (/^AB/.test(c)) return 'MA';
    return null;
  }
  function chaveDeRotulo(t) {
    var s = norm(t);
    if (/^invalidez/.test(s)) return 'INV';
    if (/^perda de autonomia/.test(s)) return 'PA';
    if (/^doencas graves/.test(s)) return 'DG';
    if (/^(quebra|fratura)/.test(s)) return 'FRA';
    if (/^cirurgia ampliada/.test(s)) return 'CIA';
    if (/^cirurgia/.test(s)) return 'CIB';
    if (/^(diaria|internac)/.test(s)) return 'HC';
    if (/^vida e saude/.test(s)) return 'VS';
    if (/^vida inteira/.test(s)) return 'VI';
    if (/^temporario/.test(s)) return 'TEMP';
    if (/^morte,? total/.test(s)) return 'MORTE';
    if (/^morte acidental/.test(s)) return 'MA';
    if (/funeral/.test(s)) return 'AF';
    if (/^renda/.test(s)) return 'RENDA';
    return null;
  }

  /* ---------- montagem de grupos a partir de um mapa {chave: {v, prazo, mantida}} ---------- */
  function rotuloItem(k, info) {
    var t = (ITENS[k] || {}).t || k;
    if (k === 'TEMP' && info.prazo) t = 'Temporário ' + info.prazo + ' anos';
    if (k === 'DG' && info.prazo) t = 'Doenças graves (' + info.prazo + ' anos)';
    if (info.mantida && (k === 'VI' || k === 'VS')) t += ' (já tem)';
    return t;
  }
  function gruposDeMapa(mapa, layout) {
    return (layout || GRUPOS_PLANO).map(function (g) {
      var itens = g[1].filter(function (k) { return mapa[k] && mapa[k].v > 0; }).map(function (k) {
        var info = mapa[k];
        var o = { k: k, i: (ITENS[k] || {}).i || '•', t: info.t || rotuloItem(k, info), v: info.v };
        if (info.mantida) o.mantida = true;
        return o;
      });
      return { nome: g[0], itens: itens };
    }).filter(function (g) { return g.itens.length; });
  }
  function somaNoMapa(mapa, k, v, extra) {
    if (!k || !(v > 0)) return;
    var cur = mapa[k] || (mapa[k] = { v: 0, novo: 0, fica: 0 });
    cur.v += v;
    if (extra && extra.fica) cur.fica += v; else cur.novo += v;
    if (extra && extra.prazo && !cur.prazo) cur.prazo = extra.prazo;
  }
  function fecharMapa(mapa) {
    Object.keys(mapa).forEach(function (k) {
      var m = mapa[k];
      if (m.fica > 0 && !(m.novo > 0)) m.mantida = true;
    });
    var morte = MORTE_DE.reduce(function (s, k) { return s + (mapa[k] ? mapa[k].v : 0); }, 0);
    if (morte > 0 && !(mapa.MORTE && mapa.MORTE.v > 0)) mapa.MORTE = { v: morte };
    return mapa;
  }

  /* ---------- id / nome / ⭐ a partir do nome do cenário ---------- */
  function partesNome(nome, idx) {
    var s = String(nome || '').trim(), rec = /⭐|★/.test(s);
    s = s.replace(/\s*[⭐★]\s*/g, ' ').trim();
    var m = /^([A-Z])\s*[·\-–:|]\s*(.+)$/.exec(s);
    if (m) return { id: m[1], nome: m[2].trim(), rec: rec };
    var m2 = /^plano\s+([A-Z])$/i.exec(s);
    if (m2) return { id: m2[1].toUpperCase(), nome: '', rec: rec };
    return { id: String.fromCharCode(65 + (idx || 0)), nome: s, rec: rec };
  }

  /* ---------- comparação Temporário × V&S 360 ---------- */
  function gerarComparacao(estado, tf, cenarios) {
    var cli = (estado && estado.cliente) || {};
    var idade = cli.idade, sexo = cli.sexo || 'M';
    if (!idade || !tf || typeof tf.premio !== 'function') return null;
    /* capital: o maior V&S montado nos cenários (é dele que se fala na mesa) */
    var alvo = null;
    cenarios.forEach(function (c) {
      (c._linhas || []).forEach(function (l) {
        if (String(l.fam || l.pid).toUpperCase() === 'WV' && l.cap > 0 && (!alvo || l.cap > alvo.cap)) alvo = l;
      });
    });
    if (!alvo) return null;
    var capital = alvo.cap, anos = 30, ipca = 0.045, passos = 3;
    var fat9 = Math.pow(1 + ipca, 9);
    var soma10 = 0; for (var y = 0; y < 10; y++) soma10 += Math.pow(1 + ipca, y);
    /* temporário: TM10 abaixo do mínimo do TP (1 mi), TP10 a partir dele; capital corrigido pelo IPCA a cada renovação */
    var temp = [], total = 0;
    for (var k = 0; k < passos; k++) {
      var id = idade + 10 * k, capK = capital * Math.pow(1 + ipca, 10 * k);
      var pid = capK >= 1e6 ? 'TP' : 'TM';
      var de = tf.premio(pid, 10, capK, id, sexo, 'ST');
      if (!(de > 0)) break;
      temp.push({ faixa: id + '–' + (id + 10), de: Math.round(de), ate: Math.round(de * fat9) });
      total += de * 12 * soma10;
    }
    if (!temp.length) return null;
    var prazoVS = alvo.prazo || 10;
    var deVS = alvo.pre;
    var vsPago = 0, vsFaixa = { faixa: idade + '–' + (idade + 10), de: Math.round(deVS), ate: Math.round(deVS * fat9) };
    for (var a = 0; a < prazoVS; a++) vsPago += deVS * 12 * Math.pow(1 + ipca, a);
    var resg = typeof tf.resgate === 'function' ? tf.resgate('WV', prazoVS, sexo, idade, capital) : null;
    var resgFinal = resg && resg[anos] ? resg[anos] * Math.pow(1 + ipca, anos) : 0;
    return {
      capital: capital, anos: anos, ipca: ipca, idade: idade, sexo: sexo,
      temp: temp, temp_prazo: 10, temp_total: Math.round(total), temp_volta: 0,
      vs: { de: vsFaixa.de, ate: vsFaixa.ate, prazo: prazoVS, total: Math.round(vsPago),
            resgate_final: Math.round(resgFinal), resgate_idade: idade + anos }
    };
  }

  /* ---------- GERAR do estado ---------- */
  function gerarApresentacao(estado, tf) {
    estado = estado || {}; tf = tf || {};
    var cli = estado.cliente || {};
    var idade = cli.idade || null, sexo = cli.sexo || 'M';

    /* Hoje */
    var hoje = null;
    var hItens = typeof tf.hojeItens === 'function' ? (tf.hojeItens() || []) : [];
    if (hItens.length) {
      var hm = {};
      hItens.forEach(function (it) { somaNoMapa(hm, chaveHoje(it), +it.cap || 0); });
      fecharMapa(hm);
      Object.keys(hm).forEach(function (k) { hm[k] = { v: hm[k].v }; });   /* hoje não leva prazo/“já tem” */
      hoje = {
        total: typeof tf.hojeTotal === 'function' ? tf.hojeTotal() : 0,
        rotulo: typeof tf.hojeRotulo === 'function' ? tf.hojeRotulo() : '',
        grupos: gruposDeMapa(hm, GRUPOS_HOJE)
      };
    }

    /* o que fica das apólices de hoje (modo "somar") */
    var fica = typeof tf.ficaItens === 'function' ? (tf.ficaItens() || []) : [];

    var cens = (estado.cen || []).filter(function (c) { return (c.linhas || []).length; });
    var cenarios = cens.map(function (cen, i) {
      var pn = partesNome(cen.nome, i);
      var linhas = typeof tf.cenItens === 'function' ? (tf.cenItens(cen) || []) : [];
      var mapa = {};
      linhas.forEach(function (l) { somaNoMapa(mapa, chaveProduto(l), +l.cap || 0, { prazo: l.prazo }); });
      fica.forEach(function (it) { somaNoMapa(mapa, chaveHoje(it), +it.cap || 0, { fica: true }); });
      fecharMapa(mapa);
      var resg = null;
      if (typeof tf.resgate === 'function' && idade) {
        var acc = {};
        linhas.forEach(function (l) {
          if (String(l.fam || l.pid).toUpperCase() !== 'WV') return;
          var r = tf.resgate('WV', l.prazo || 10, sexo, idade, l.cap);
          if (r) [10, 20, 30].forEach(function (a) { if (r[a]) acc[a] = (acc[a] || 0) + r[a]; });
        });
        var ks = [10, 20, 30].filter(function (a) { return acc[a] > 0; });
        if (ks.length) resg = ks.map(function (a) { return [idade + a, Math.round(acc[a])]; });
      }
      var total = typeof tf.cenTotal === 'function' ? tf.cenTotal(cen) : linhas.reduce(function (s, l) { return s + (l.pre || 0); }, 0);
      var c = {
        id: pn.id, nome: pn.nome || ('Plano ' + pn.id), total: Math.round(total * 100) / 100,
        rec: pn.rec, grupos: gruposDeMapa(mapa), resgate: resg, pontos: []
      };
      if (mapa.VS && !mapa.TEMP) c.selo = '👴 Só Vida e Saúde';
      Object.defineProperty(c, '_linhas', { value: linhas, enumerable: false });
      return c;
    });

    var cmp = gerarComparacao(estado, tf, cenarios);
    var vsPrazo = null;
    cenarios.forEach(function (c) { (c._linhas || []).forEach(function (l) { if (!vsPrazo && String(l.fam || l.pid).toUpperCase() === 'WV') vsPrazo = l.prazo || 10; }); });

    return {
      formato: 'plano-cards-v1',
      origem: 'auto',
      gerado_em: new Date().toISOString().slice(0, 10),
      titulo: 'Plano de proteção · ' + (primNome(cli.nome) || 'Cliente'),
      chips: [],
      comparacao: cmp,
      vs_prazo: vsPrazo,
      hoje: hoje,
      cenarios: cenarios
    };
  }

  /* ---------- PREPARAR: do JSON do Claude (ou de qualquer variante) pro formato completo ---------- */
  function normChips(ch) {
    return (ch || []).slice(0, 3).map(function (c) {
      if (Array.isArray(c)) return { e: c[0] || '', t: c[1] || '', s: c[2] || '' };
      return { e: c.e || '', t: c.t || '', s: c.s || '' };
    }).filter(function (c) { return c.t; });
  }
  function normHoje(h) {
    if (!h) return null;
    var grupos;
    if (Array.isArray(h.grupos)) {
      grupos = h.grupos.map(function (g) {
        return { nome: g.nome, itens: (g.itens || []).map(function (it) {
          var t = it.t || it[1], v = parseValor(it.v != null ? it.v : it[2]);
          return { k: it.k || chaveDeRotulo(t), i: it.i || it[0] || '', t: t, v: v };
        }) };
      });
    } else if (h.grupos && typeof h.grupos === 'object') {
      grupos = Object.keys(h.grupos).map(function (nome) {
        return { nome: nome, itens: (h.grupos[nome] || []).map(function (a) {
          return { k: chaveDeRotulo(a[1]), i: a[0], t: a[1], v: parseValor(a[2]) };
        }) };
      });
    } else grupos = [];
    var total = h.total != null ? +h.total : (h.premio != null ? +h.premio : 0);
    return { total: total, rotulo: h.rotulo || '', grupos: grupos };
  }
  function normComparacao(c) {
    if (!c) return null;
    if (c.temp && c.vs) return c;   /* já no formato de dentro */
    var t = c.temporario, v = c.vida_saude;
    if (!t || !v) return null;
    var faixas = (t.faixas || []).map(function (f) { return Array.isArray(f) ? { faixa: f[0], de: f[1], ate: f[2] } : f; });
    var idade = c.idade || parseInt(String((faixas[0] || {}).faixa || ''), 10) || null;
    var vf = (v.faixas || []).map(function (f) { return Array.isArray(f) ? { faixa: f[0], de: f[1], ate: f[2] } : f; });
    var pagando = vf.filter(function (f) { return f.de > 0; });
    var rk = Object.keys(v.resgate || {}).map(Number).sort(function (a, b) { return a - b; });
    var rIdade = rk.length ? rk[rk.length - 1] : (idade ? idade + (c.anos || 30) : null);
    return {
      capital: c.capital, anos: c.anos || 30, ipca: c.ipca, idade: idade, sexo: c.sexo,
      temp: faixas, temp_prazo: 10, temp_total: t.pago, temp_volta: t.volta || 0,
      vs: { de: (vf[0] || {}).de, ate: (vf[0] || {}).ate, prazo: Math.max(pagando.length, 1) * 10,
            total: v.pago, resgate_final: rk.length ? v.resgate[rIdade] : 0, resgate_idade: rIdade }
    };
  }
  function resgateArr(r) {
    if (!r) return null;
    if (Array.isArray(r)) return r.length ? r : null;
    var ks = Object.keys(r).map(Number).filter(function (x) { return x > 0; }).sort(function (a, b) { return a - b; });
    return ks.length ? ks.map(function (k) { return [k, r[k]]; }) : null;
  }
  /* cenário "condensado" do Claude (vs/tp/inv/pa/dg/morte) + linhas do estado + apólice antiga mantida */
  function expandirCenario(c, gerado, antiga) {
    var base = null;
    if (gerado) gerado.cenarios.forEach(function (g) { if (!base && g.id === c.id) base = g; });
    var mapa = {};
    if (base) base.grupos.forEach(function (g) { g.itens.forEach(function (it) {
      mapa[it.k] = { v: it.v, mantida: it.mantida };
      if (it.k === 'TEMP' || it.k === 'DG') { var m = /(\d+)\s*anos/.exec(it.t); if (m) mapa[it.k].prazo = +m[1]; }
    }); });
    var over = { inv: 'INV', pa: 'PA', dg: 'DG', vs: 'VS', tp: 'TEMP', morte: 'MORTE' };
    Object.keys(over).forEach(function (f) {
      if (c[f] == null) return;
      var k = over[f], v = +c[f] || 0;
      if (v > 0) mapa[k] = { v: v, prazo: mapa[k] && mapa[k].prazo };
      else delete mapa[k];
    });
    if (mapa.DG && !mapa.DG.prazo) mapa.DG.prazo = 5;
    if (mapa.TEMP && !mapa.TEMP.prazo) mapa.TEMP.prazo = 10;
    (antiga || []).forEach(function (s) {
      var m = /^(\S+)\s+(.+)$/.exec(String(s || '').trim()); if (!m) return;
      var k = chaveDeCodigo(m[1]); if (!k || mapa[k]) return;   /* já está no plano (ou já somado no total do Claude) */
      mapa[k] = { v: parseValor(m[2]), mantida: true };
    });
    return {
      id: c.id, nome: c.nome || (base && base.nome) || ('Plano ' + c.id),
      total: c.total != null ? +c.total : (base ? base.total : 0),
      rec: !!(c.rec || c.recomendado || (base && base.rec && c.rec == null && c.recomendado == null)),
      selo: c.selo || (mapa.VS && !mapa.TEMP ? '👴 Só Vida e Saúde' : null),
      grupos: gruposDeMapa(mapa),
      resgate: resgateArr(c.resgate) || (base && base.resgate) || null,
      pontos: c.pontos || []
    };
  }
  function prepararApresentacao(estado, tf) {
    var gerado = gerarApresentacao(estado, tf);
    var ap = estado && estado.apresentacao;
    if (!ap || typeof ap !== 'object') return gerado;
    var antiga = ap.antiga_mantida ? (ap.antiga_mantida.coberturas || ap.antiga_mantida.itens || []) : [];
    var cens = (ap.cenarios || []).map(function (c) {
      if (Array.isArray(c.grupos) && c.grupos.length) {
        return {
          id: c.id, nome: c.nome, total: +c.total || 0, rec: !!(c.rec || c.recomendado), selo: c.selo || null,
          grupos: c.grupos.map(function (g) { return { nome: g.nome, itens: (g.itens || []).map(function (it) {
            return { k: it.k || chaveDeRotulo(it.t), i: it.i, t: it.t, v: parseValor(it.v), mantida: !!it.mantida };
          }) }; }),
          resgate: resgateArr(c.resgate), pontos: c.pontos || []
        };
      }
      return expandirCenario(c, gerado, antiga);
    });
    var cli = (estado && estado.cliente) || {};
    return {
      formato: 'plano-cards-v1',
      origem: 'claude',
      gerado_em: ap.gerado_em || gerado.gerado_em,
      titulo: ap.titulo || gerado.titulo || ('Plano de proteção · ' + primNome(cli.nome)),
      chips: normChips(ap.chips),
      comparacao: normComparacao(ap.comparacao) || gerado.comparacao,
      vs_prazo: ap.vs_prazo || gerado.vs_prazo || ((normComparacao(ap.comparacao) || {}).vs || {}).prazo || null,
      hoje: normHoje(ap.hoje) || gerado.hoje,
      cenarios: cens.length ? cens : gerado.cenarios
    };
  }

  /* ---------- HTML ---------- */
  function hojeMapa(hoje) {
    var m = {};
    if (hoje) (hoje.grupos || []).forEach(function (g) { (g.itens || []).forEach(function (it) {
      var k = it.k || chaveDeRotulo(it.t); if (k) m[k] = (m[k] || 0) + (parseValor(it.v) || 0);
    }); });
    return m;
  }
  function liHTML(it, up) {
    return '<li' + (up ? ' class="up"' : '') + '><span class="i">' + esc(it.i || (ITENS[it.k] || {}).i || '•') +
      '</span><span>' + esc(it.t) + '</span><span class="v">' + esc(fmtValorItem(it.k, it.v)) + '</span></li>';
  }
  function cardCenarioHTML(c, hm, temHoje, hojeTotal) {
    var delta = '';
    if (temHoje && hojeTotal > 0) {
      var d = Math.round(c.total - hojeTotal);
      delta = d > 0 ? '+ ' + fmtReais(d) + ' vs hoje' : (d < 0 ? fmtReais(-d) + ' a menos que hoje' : 'mesmo valor de hoje');
    }
    var badge = c.rec ? '<span class="badge">⭐ Recomendado</span>'
      : (c.selo ? '<span class="badge gold">' + esc(c.selo) + '</span>' : '');
    var h = '<div class="card' + (c.rec ? ' rec' : '') + '" data-cen="' + esc(c.id) + '">' +
      '<div class="head"><div class="name">' + esc(c.id) + '<small>' + esc(c.nome) + '</small></div>' + badge + '</div>' +
      '<div class="cbody"><div><div class="price">' + fmtReais(c.total) + '<small>/mês</small></div>' +
      (delta ? '<div class="delta">' + esc(delta) + '</div>' : '') + '</div>';
    (c.grupos || []).forEach(function (g) {
      if (!(g.itens || []).length) return;
      h += '<div class="grp">' + esc(g.nome) + '</div><ul class="cov">' + g.itens.map(function (it) {
        var ref = hm[EQUIV_HOJE[it.k] || it.k] || 0;
        var up = temHoje && !it.mantida && it.k !== 'MORTE' && (+it.v || 0) > ref + 0.5;
        if (it.k === 'MORTE') up = temHoje && (+it.v || 0) > (hm.MORTE || 0) + 0.5;
        return liHTML(it, up);
      }).join('') + '</ul>';
    });
    if (c.resgate && c.resgate.length) {
      h += '<div class="rs"><div class="rs-h">💰 Resgate</div><div class="rs-g">' + c.resgate.slice(0, 3).map(function (r) {
        return '<div><b>R$ ' + esc(fmtCap(r[1])) + '</b><span>aos ' + esc(r[0]) + ' anos</span></div>';
      }).join('') + '</div></div>';
    }
    if ((c.pontos || []).length) h += '<ul class="pts">' + c.pontos.map(function (p) { return '<li>' + esc(p) + '</li>'; }).join('') + '</ul>';
    return h + '</div></div>';
  }
  function comparacaoHTML(c) {
    if (!c || !c.temp || !c.temp.length || !c.vs) return '';
    var fim = (c.idade || 0) + (c.anos || 30);
    var n = c.temp.length;
    var mult = c.temp[0].de > 0 ? Math.floor(c.temp[n - 1].de / c.temp[0].de) : 0;
    var segT = c.temp.map(function (f, i) {
      var sm = '/mês' + (i === 0 ? '' : (i === n - 1 && n > 2 && mult > 1 ? ' · ' + mult + '×' : ' · renovou'));
      return '<div class="seg t' + (i + 1) + '"><span class="age">' + esc(f.faixa) + '</span><b>R$ ' + nBR(f.de) + ' → ' + nBR(f.ate) + '</b><small>' + sm + '</small></div>';
    }).join('');
    var vsPrazo = c.vs.prazo || 10;
    var segV = c.temp.map(function (f, i) {
      if (i * 10 < vsPrazo) {
        var de = i === 0 ? c.vs.de : Math.round(c.vs.de * Math.pow(1 + (c.ipca || 0.045), 10 * i));
        var ate = i === 0 ? c.vs.ate : Math.round(c.vs.ate * Math.pow(1 + (c.ipca || 0.045), 10 * i));
        return '<div class="seg v' + (i + 1) + '"><span class="age">' + esc(f.faixa) + '</span><b>R$ ' + nBR(de) + ' → ' + nBR(ate) + '</b><small>/mês · ' + vsPrazo + ' anos</small></div>';
      }
      return '<div class="seg v' + (i + 1) + '"><span class="age">' + esc(f.faixa) + '</span><b>R$ 0</b><small>quitado</small></div>';
    }).join('');
    var rIdade = c.vs.resgate_idade || fim;
    return '<section class="card cmp"><div class="head"><div class="name">Temporário × Vida e Saúde 360<small>R$ ' +
      esc(fmtCap(c.capital)) + ' · ' + esc(c.anos || 30) + ' anos</small></div></div><div class="cbody">' +
      '<div class="tl-lane"><div class="tl-lab">⏳ <b>Temporário ' + esc(c.temp_prazo || 10) + ' anos</b></div><div class="tl-row">' + segT +
      '<div class="seg end bad"><span class="age">' + fim + '+</span><b>acaba</b><small>sem renovação</small></div></div>' +
      '<div class="tl-kpi"><span>💸 Paga <b>R$ ' + esc(fmtCap(c.temp_total)) + '</b></span><span>💰 Volta <b>R$ ' + esc(c.temp_volta ? fmtCap(c.temp_volta) : '0') + '</b></span></div></div>' +
      '<div class="tl-lane"><div class="tl-lab">👴 <b>Vida e Saúde 360 · paga em ' + esc(vsPrazo) + ' anos</b></div><div class="tl-row">' + segV +
      '<div class="seg end ok"><span class="age">' + fim + '+</span><b>vida toda</b><small>+ Alzheimer</small></div></div>' +
      '<div class="tl-kpi"><span>💸 Paga <b>R$ ' + esc(fmtCap(c.vs.total)) + '</b></span>' +
      (c.vs.resgate_final ? '<span>💰 Resgate aos ' + esc(rIdade) + ' <b>R$ ' + esc(fmtCap(c.vs.resgate_final)) + '</b></span>' : '') + '</div></div>' +
      '<ul class="pts"><li>⏳ <b>Temporário = aluguel.</b> Acaba e não devolve.</li><li>👴 <b>Vida e Saúde = patrimônio.</b> Quitado e protege na velhice.</li></ul>' +
      '</div></section>';
  }
  function vsCardHTML(prazo) {
    return '<section class="card vs"><div class="head"><div class="name">👴 Vida e Saúde 360<small>para a velhice</small></div></div>' +
      '<div class="cbody"><div class="vs-g">' +
      '<div class="hl"><span class="e">🧠</span><b>20 doenças graves + Alzheimer</b><span>Recebe em vida, até na velhice</span></div>' +
      '<div><span class="e">♾️</span><b>Vida toda</b><span>Não vence</span></div>' +
      '<div><span class="e">📅</span><b>Paga ' + esc(prazo || 10) + ' anos</b><span>Depois, quitado</span></div>' +
      '<div><span class="e">💰</span><b>Resgate</b><span>Vira reserva</span></div>' +
      '<div><span class="e">🔒</span><b>Preço de hoje</b><span>Não sobe com a idade</span></div>' +
      '</div></div></section>';
  }
  function hojeHTML(h) {
    if (!h || !(h.grupos || []).some(function (g) { return (g.itens || []).length; })) return '';
    var rot = h.rotulo || '';
    return '<div class="card hoje"><div class="head"><div class="name">Hoje<small>' + esc(rot ? 'suas ' + rot : 'o que você tem') + '</small></div></div>' +
      '<div class="cbody"><div class="full"><div class="price">' + fmtReais(h.total) + '<small>/mês</small></div>' +
      (rot ? '<div class="delta">' + esc(rot) + '</div>' : '') + '</div>' +
      h.grupos.map(function (g) {
        return '<div class="col"><div class="grp">' + esc(g.nome) + '</div><ul class="cov">' +
          (g.itens || []).map(function (it) { return liHTML(it, false); }).join('') + '</ul></div>';
      }).join('') +
      '<ul class="pts full"><li>🔁 Tudo isso passa para o plano novo, ampliado</li></ul></div></div>';
  }
  function corpoHTML(dados) {
    var d = dados || {};
    var hm = hojeMapa(d.hoje), temHoje = Object.keys(hm).length > 0, hojeTotal = d.hoje ? +d.hoje.total || 0 : 0;
    var cens = (d.cenarios || []).slice().sort(function (a, b) { return (+b.total || 0) - (+a.total || 0); });
    var temVS = cens.some(function (c) { return (c.grupos || []).some(function (g) { return (g.itens || []).some(function (it) { return it.k === 'VS' && !it.mantida; }); }); });
    var chips = (d.chips || []).slice(0, 3);
    var h = '<div class="wrap">' +
      '<div class="top"><div class="eyebrow">🛡️ ' + esc(d.titulo || 'Plano de proteção') + '</div>' +
      '<div class="tbar"><button type="button" data-apz="abrir">➕ Abrir tudo</button><button type="button" data-apz="fechar">➖ Fechar tudo</button></div></div>';
    if (chips.length) h += '<div class="why">' + chips.map(function (c) {
      return '<div class="chip"><span class="e">' + esc(c.e) + '</span><div><b>' + esc(c.t) + '</b><span>' + esc(c.s) + '</span></div></div>';
    }).join('') + '</div>';
    h += comparacaoHTML(d.comparacao);
    if (temVS) h += vsCardHTML(d.vs_prazo || (d.comparacao && d.comparacao.vs && d.comparacao.vs.prazo));
    h += hojeHTML(d.hoje);
    if (cens.length) h += '<div class="cards">' + cens.map(function (c) { return cardCenarioHTML(c, hm, temHoje, hojeTotal); }).join('') + '</div>';
    else h += '<div class="card"><div class="cbody"><div class="delta">Monte ao menos um cenário com coberturas para apresentar.</div></div></div>';
    return h + '</div>';
  }

  /* ---------- CSS (cópia do visual aprovado, escopada em .apz) ----------
     .top/.card/.wrap também existem no CSS da Revisão: os resets abaixo (background, position, margin)
     isolam a peça quando ela abre por cima do console. */
  var TOK_CLARO = '--bg:#F2F4F7;--paper:#FFFFFF;--ink:#131A24;--muted:#5E6776;--line:#DCE1E8;--accent:#1F5E5B;--accent-soft:#E2EFEE;--gold:#96773A;--up:#1C7A4B;--up-soft:#E3F3EA;--down:#A2452F;color-scheme:light';
  var TOK_ESCURO = '--bg:#0F1319;--paper:#171D26;--ink:#E9EDF3;--muted:#9BA4B3;--line:#2A3342;--accent:#6FC2BC;--accent-soft:#1B2F31;--gold:#D4B373;--up:#6CCB98;--up-soft:#18302A;--down:#E58E76;color-scheme:dark';
  function css(opts) {
    var auto = !!(opts && opts.autoDark);
    var r = '.apz{' + TOK_CLARO + ';--display:"Instrument Serif",Georgia,serif;--body:"Figtree",system-ui,sans-serif;background:var(--bg);color:var(--ink);font-family:var(--body);font-size:15px;line-height:1.45}\n' +
      ':root[data-theme="dark"] .apz{' + TOK_ESCURO + '}\n' +
      (auto ? '@media (prefers-color-scheme: dark){:root:not([data-theme="light"]) .apz{' + TOK_ESCURO + '}}\n' : '') +
      '.apz *{box-sizing:border-box}\n' +
      '.apz .wrap{max-width:1180px;margin:0 auto;padding-inline:16px;padding-block:24px 40px;display:flex;flex-direction:column;gap:22px}\n' +
      '.apz .top{display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:10px;background:none;color:inherit;position:static;box-shadow:none;z-index:auto}\n' +
      '.apz .eyebrow{font-size:14px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:700}\n' +
      '.apz .why{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}\n' +
      '@media (max-width:760px){.apz .why{grid-template-columns:1fr}}\n' +
      '.apz .chip{display:flex;gap:12px;align-items:center;background:var(--paper);border:1px solid var(--line);border-radius:14px;padding:14px 16px}\n' +
      '.apz .chip .e{font-size:30px;line-height:1}\n.apz .chip b{display:block;font-size:16px}\n.apz .chip span{color:var(--muted);font-size:13px}\n' +
      '.apz .cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,280px),1fr));gap:14px;align-items:start}\n' +
      '.apz .card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:18px;display:flex;flex-direction:column;gap:14px;min-width:0;margin:0}\n' +
      '.apz .card.rec{border:2px solid var(--accent);box-shadow:0 8px 24px -14px var(--accent)}\n' +
      '.apz .head{display:flex;justify-content:space-between;align-items:flex-start;gap:8px}\n' +
      '.apz .name{font-family:var(--display);font-size:28px;line-height:1}\n' +
      '.apz .name small{display:block;font-family:var(--body);font-size:13px;color:var(--muted);margin-top:4px}\n' +
      '.apz .badge{font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;background:var(--accent);color:var(--paper);padding:4px 9px;border-radius:99px;white-space:nowrap}\n' +
      '.apz .badge.gold{background:var(--gold)}\n' +
      '.apz .price{font-size:30px;font-weight:800;font-variant-numeric:tabular-nums;line-height:1}\n' +
      '.apz .price small{font-size:14px;font-weight:600;color:var(--muted)}\n' +
      '.apz .delta{font-size:13px;font-weight:700;color:var(--muted)}\n' +
      '.apz .grp{font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:-6px}\n' +
      '.apz ul.cov{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}\n' +
      '.apz ul.cov li{display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;gap:8px;padding:5px 8px;border-radius:9px}\n' +
      '.apz ul.cov li .i{font-size:18px;text-align:center}\n' +
      '.apz ul.cov li .v{font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}\n' +
      '.apz ul.cov li.up{background:var(--up-soft)}\n.apz ul.cov li.up .v{color:var(--up)}\n' +
      '.apz ul.cov li.up .v::before{content:"▲ ";font-size:10px}\n' +
      '.apz ul.pts{list-style:none;margin:0;padding:12px 0 0;border-top:1px dashed var(--line);display:flex;flex-direction:column;gap:6px;font-size:14px}\n' +
      '.apz .vs{border:2px solid var(--accent)}\n' +
      '.apz .vs-g{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}\n' +
      '@media (max-width:860px){.apz .vs-g{grid-template-columns:repeat(2,minmax(0,1fr))}}\n' +
      '.apz .vs-g div{background:var(--accent-soft);border-radius:12px;padding:12px;display:flex;flex-direction:column;gap:2px}\n' +
      '.apz .vs-g .e{font-size:26px}\n.apz .vs-g b{font-size:16px}\n.apz .vs-g span:not(.e){font-size:13px;color:var(--muted)}\n' +
      '.apz .vs .hl{grid-column:span 2;background:var(--accent);color:var(--paper)}\n' +
      '.apz .vs .hl span:not(.e){color:var(--paper)!important;opacity:.9}\n' +
      '@media (max-width:860px){.apz .vs .hl{grid-column:1/-1}}\n' +
      '.apz .rs{background:var(--accent-soft);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}\n' +
      '.apz .rs-h{font-size:13px;font-weight:700}\n' +
      '.apz .rs-g{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:6px}\n' +
      '.apz .rs-g div{display:flex;flex-direction:column}\n' +
      '.apz .rs-g b{font-size:15px;font-variant-numeric:tabular-nums;color:var(--accent)}\n' +
      '.apz .rs-g span{font-size:11px;color:var(--muted)}\n' +
      '.apz .tg{cursor:pointer;user-select:none;-webkit-user-select:none}\n' +
      '.apz .tg:focus-visible{outline:2px solid var(--accent);outline-offset:4px;border-radius:8px}\n' +
      '.apz .tg .name::after{content:"▾";font-family:var(--body);font-size:16px;color:var(--muted);margin-left:10px;display:inline-block;transition:transform .15s}\n' +
      '.apz .closed .tg .name::after{transform:rotate(-90deg)}\n' +
      '.apz .closed>.cbody{display:none!important}\n' +
      '.apz .cbody{display:flex;flex-direction:column;gap:14px}\n' +
      '.apz .tbar{display:flex;gap:8px;flex-wrap:wrap}\n' +
      '.apz .tbar button{font:inherit;font-size:12px;font-weight:700;border:1px solid var(--line);background:var(--paper);color:var(--ink);border-radius:99px;padding:6px 12px;cursor:pointer}\n' +
      '.apz .card.hoje .cbody{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 22px;align-items:start}\n' +
      '.apz .card.hoje .cbody>.full{grid-column:1/-1}\n' +
      '.apz .card.hoje .col{display:flex;flex-direction:column;gap:8px;min-width:0}\n' +
      '@media (max-width:760px){.apz .card.hoje .cbody{grid-template-columns:1fr}}\n' +
      '.apz .cmp{border:2px solid var(--gold)}\n' +
      '.apz .tl-lane{display:flex;flex-direction:column;gap:6px}\n.apz .tl-lab{font-size:14px}\n' +
      '.apz .tl-row{display:grid;grid-template-columns:1fr 1fr 1fr .8fr;gap:4px}\n' +
      '@media (max-width:620px){.apz .tl-row{grid-template-columns:1fr 1fr}}\n' +
      '.apz .seg{border-radius:10px;padding:8px 10px;display:flex;flex-direction:column;font-size:13px;min-width:0}\n' +
      '.apz .seg .age{font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--gold);font-weight:700}\n' +
      '.apz .seg b{font-size:15px;font-variant-numeric:tabular-nums}\n.apz .seg small{color:var(--muted);font-size:11.5px}\n' +
      '.apz .seg.t1{background:var(--line)}\n.apz .seg.t2,.apz .seg.t3{background:var(--line);box-shadow:inset 0 -4px 0 var(--down)}\n' +
      '.apz .seg.v1{background:var(--accent-soft)}\n.apz .seg.v2,.apz .seg.v3{background:var(--up-soft)}\n' +
      '.apz .seg.end.bad{border:1.5px dashed var(--down);color:var(--down)}\n.apz .seg.end.ok{border:1.5px solid var(--up);color:var(--up)}\n' +
      '.apz .tl-kpi{display:flex;flex-wrap:wrap;gap:6px 16px;font-size:13px;color:var(--muted)}\n' +
      '.apz .tl-kpi b{color:var(--ink);font-variant-numeric:tabular-nums}\n' +
      /* dedo: alvo de toque ≥44px no celular/iPad, sem mexer no desktop */
      '@media (pointer:coarse),(max-width:1024px){.apz .tbar button{min-height:44px;padding:10px 16px;font-size:14px}.apz .head.tg{min-height:44px}}\n' +
      '@media print{.apz .tbar{display:none}.apz .closed>.cbody{display:flex!important}.apz .card{break-inside:avoid}}\n';
    return r;
  }

  /* ---------- interação (a mesma no app e no arquivo exportado) ---------- */
  function ligar(raiz) {
    raiz.querySelectorAll('.card>.head').forEach(function (h) {
      h.classList.add('tg'); h.tabIndex = 0; h.setAttribute('role', 'button');
      h.setAttribute('aria-expanded', h.parentNode.classList.contains('closed') ? 'false' : 'true');
    });
    function alt(h, fechar) {
      var c = h.closest('.card'); if (!c) return;
      var v = fechar == null ? !c.classList.contains('closed') : fechar;
      c.classList.toggle('closed', v); h.setAttribute('aria-expanded', v ? 'false' : 'true');
    }
    function todos(fechar) { raiz.querySelectorAll('.card>.head.tg').forEach(function (h) { alt(h, fechar); }); }
    raiz.addEventListener('click', function (e) {
      var b = e.target.closest('[data-apz]');
      if (b) { todos(b.getAttribute('data-apz') === 'fechar'); return; }
      var h = e.target.closest('.tg'); if (h && raiz.contains(h) && !e.target.closest('button')) alt(h);
    });
    raiz.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter' && e.key !== ' ' && e.key !== 'Spacebar') return;
      var h = e.target.closest && e.target.closest('.tg'); if (!h || !raiz.contains(h)) return;
      e.preventDefault(); alt(h);
    });
  }

  function renderApresentacao(container, dados) {
    if (!container) return;
    container.classList.add('apz');
    if (!document.getElementById('apz-css')) {
      var st = document.createElement('style'); st.id = 'apz-css'; st.textContent = css({ autoDark: false });
      document.head.appendChild(st);
    }
    container.innerHTML = corpoHTML(dados);
    if (!container.__apzLigado) { ligar(container); container.__apzLigado = true; }
    else container.querySelectorAll('.card>.head').forEach(function (h) { h.classList.add('tg'); h.tabIndex = 0; h.setAttribute('role', 'button'); h.setAttribute('aria-expanded', 'true'); });
  }

  function exportarHTML(dados) {
    var titulo = (dados && dados.titulo) || 'Plano de proteção';
    var js = '(' + ligar.toString() + ')(document.querySelector(".apz"));';
    return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      '<title>' + esc(titulo.replace(/^Plano de proteção · /, 'Plano ')) + '</title>' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">' +
      '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Instrument+Serif&family=Figtree:wght@400;500;600;700;800&display=swap">' +
      '<style>html,body{margin:0;background:#F2F4F7}@media (prefers-color-scheme: dark){html,body{background:#0F1319}}body .apz{min-height:100vh}\n' + css({ autoDark: true }) + '</style></head>' +
      '<body><div class="apz">' + corpoHTML(dados) + '</div><script>' + js + '<\/script></body></html>';
  }

  var API = {
    gerarApresentacao: gerarApresentacao,
    prepararApresentacao: prepararApresentacao,
    renderApresentacao: renderApresentacao,
    exportarHTML: exportarHTML,
    /* utilitários expostos pro self-test do app hospedeiro */
    _fmtCap: fmtCap, _parseValor: parseValor, _corpoHTML: corpoHTML, _css: css
  };
  root.ApresentacaoPlanos = API;
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
