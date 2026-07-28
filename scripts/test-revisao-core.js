/* ============================================================================
   Testes do RevisaoService — NÚCLEO portável (roda em Node E em JavaScriptCore,
   já que a máquina do Gustavo não tem Node; o CI usa scripts/test-revisao.mjs).
   Pré-condição: globalThis.RevisaoService carregado (via require ou jsc multi-file).
   Golden test = caso real Catarina (2 apólices, referência 2026-07-26) — os
   valores esperados são a METODOLOGIA OFICIAL; se um teste quebrar, o erro está
   no código, não no teste. Não "ajustar" o esperado sem conferir com o Gustavo.
   ============================================================================ */
(function (root) {
  'use strict';
  var RS = root.RevisaoService;
  var LOG = (typeof console !== 'undefined' && console.log) ? console.log.bind(console) : print;
  var FAILS = 0, PASSES = 0, ATUAL = '';

  function t(nome) { ATUAL = nome; }
  function eq(rotulo, obtido, esperado) {
    var ok = (typeof esperado === 'number' && typeof obtido === 'number')
      ? Math.abs(obtido - esperado) < 0.005
      : (JSON.stringify(obtido) === JSON.stringify(esperado));
    if (ok) { PASSES++; }
    else { FAILS++; LOG('  ✗ [' + ATUAL + '] ' + rotulo + ' — esperado ' + JSON.stringify(esperado) + ', obtido ' + JSON.stringify(obtido)); }
  }

  /* ── fixtures: catálogo mínimo (mesma classificação do seed da migration) ── */
  var CATALOGO = [
    { codigo: 'TP10G', sinistro: 'MORTE_QUALQUER_CAUSA', natureza: 'temporario', eh_diaria: false },
    { codigo: 'WL65G', sinistro: 'MORTE_QUALQUER_CAUSA', natureza: 'vitalicio', eh_diaria: false },
    { codigo: 'DDMRG', sinistro: 'DOENCAS_GRAVES', natureza: 'temporario', eh_diaria: false },
    { codigo: 'PD05G', sinistro: 'INVALIDEZ_PARCIAL', natureza: 'temporario', eh_diaria: false },
    { codigo: 'PA10G', sinistro: 'PERDA_AUTONOMIA', natureza: 'temporario', eh_diaria: false },
    { codigo: 'PA05G', sinistro: 'PERDA_AUTONOMIA', natureza: 'temporario', eh_diaria: false },
    { codigo: 'HC05G', sinistro: 'INTERNACAO', natureza: 'temporario', eh_diaria: true },
    { codigo: 'AF05G', sinistro: 'FUNERAL', natureza: 'temporario', eh_diaria: false },
    { codigo: 'AB05G', sinistro: 'MORTE_ACIDENTAL', natureza: 'temporario', eh_diaria: false },
    { codigo: 'PI05G', sinistro: 'INVALIDEZ_TOTAL', natureza: 'temporario', eh_diaria: false }
  ];

  var CATARINA = {
    cliente: { nome: 'CATARINA PAIVA', nascimento: '1988-04-15' },
    apolices: [
      { numero: '001520815', status: 'Ativa', data_emissao: '2023-06-12', idade_emissao: 35, premio_liquido: 225.62, iof: 0.85, premio_total: 226.47, periodicidade: 'Mensal', total_pago: 7927.25 },
      { numero: '001524343', status: 'Ativa', data_emissao: '2023-06-12', idade_emissao: 35, premio_liquido: 258.41, iof: 0.99, premio_total: 259.40, periodicidade: 'Mensal', total_pago: 9079.49 }
    ],
    coberturas: [
      { apolice_numero: '001520815', codigo: 'TP10G', valor_segurado: 1141485.31, premio_liquido: 114.43, termino: '2033-06-12' },
      { apolice_numero: '001520815', codigo: 'DDMRG', valor_segurado: 125563.38, premio_liquido: 77.06, termino: '2028-06-12' },
      { apolice_numero: '001520815', codigo: 'PD05G', valor_segurado: 513668.39, premio_liquido: 23.12, termino: '2028-06-12' },
      { apolice_numero: '001520815', codigo: 'PA10G', valor_segurado: 125563.38, premio_liquido: 11.01, termino: '2033-06-12' },
      { apolice_numero: '001524343', codigo: 'WL65G', valor_segurado: 74196.55, premio_liquido: 154.58, termino: '2088-06-12' },
      { apolice_numero: '001524343', codigo: 'DDMRG', valor_segurado: 102733.68, premio_liquido: 63.05, termino: '2028-06-12' },
      { apolice_numero: '001524343', codigo: 'HC05G', valor_segurado: 228.30, premio_liquido: 14.90, termino: '2028-06-12' },
      { apolice_numero: '001524343', codigo: 'PD05G', valor_segurado: 102733.68, premio_liquido: 4.62, termino: '2028-06-12' },
      { apolice_numero: '001524343', codigo: 'PA05G', valor_segurado: 102733.68, premio_liquido: 5.25, termino: '2028-06-12' },
      { apolice_numero: '001524343', codigo: 'AF05G', valor_segurado: 13697.82, premio_liquido: 16.01, termino: '2028-06-12' }
    ],
    catalogo: CATALOGO,
    dataReferencia: '2026-07-26'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function linhaC(dto, sinistro, sub) {
    return dto.consolidacao.filter(function (l) { return l.sinistro === sinistro && !!l.sub === !!sub; })[0];
  }

  /* ═══════════ GOLDEN — consolidação ═══════════ */
  t('golden/consolidação');
  var g = RS.montarRevisao(clone(CATARINA));
  eq('capital morte total', g.morte.total, 1215681.86);
  eq('morte vitalício', g.morte.vitalicio, 74196.55);
  eq('morte temporário', g.morte.temporario, 1141485.31);
  eq('% vitalício', g.morte.pctVitalicio, 6.1);
  eq('% temporário', g.morte.pctTemporario, 93.9);
  eq('doenças graves', linhaC(g, 'DOENCAS_GRAVES').capital, 228297.06);
  eq('invalidez parcial', linhaC(g, 'INVALIDEZ_PARCIAL').capital, 616402.07);
  eq('perda autonomia', linhaC(g, 'PERDA_AUTONOMIA').capital, 228297.06);
  eq('funeral', linhaC(g, 'FUNERAL').capital, 13697.82);
  eq('internação diária', g.internacao.diaria, 228.30);
  eq('UTI = diária ×2', g.internacao.uti, 456.60);
  eq('morte acidental não contratada', linhaC(g, 'MORTE_ACIDENTAL').naoContratado, true);
  eq('cirurgias não contratada', linhaC(g, 'CIRURGIAS').naoContratado, true);
  eq('fraturas não contratada', linhaC(g, 'FRATURAS').naoContratado, true);
  eq('não contratados (lista)', g.naoContratados, ['MORTE_ACIDENTAL', 'CIRURGIAS', 'FRATURAS']);
  eq('invalidez total = capital morte', linhaC(g, 'INVALIDEZ_TOTAL').capital, 1215681.86);
  eq('invalidez total prêmio incluso', linhaC(g, 'INVALIDEZ_TOTAL').premio, null);
  eq('doença terminal = capital morte', linhaC(g, 'DOENCA_TERMINAL').capital, 1215681.86);
  eq('doença terminal prêmio incluso', linhaC(g, 'DOENCA_TERMINAL').premio, null);
  eq('sublinha vitalício', linhaC(g, 'MORTE_QUALQUER_CAUSA', true).capital, 74196.55);
  eq('soma sublinhas = linha-mãe', g.consolidacao[1].capital + g.consolidacao[2].capital, g.morte.total);
  eq('prêmio mensal total', g.premioMensalTotal, 485.87);
  eq('idade na referência', g.cliente.idade, 38);
  eq('nenhum não classificado', g.naoClassificados.length, 0);

  /* ═══════════ GOLDEN — linha do tempo ═══════════ */
  t('golden/timeline');
  eq('nº de marcos', g.timeline.marcos.length, 2);
  var m28 = g.timeline.marcos[0], m33 = g.timeline.marcos[1];
  eq('marco 1 data', m28.data, '2028-06-12');
  eq('marco 1: 7 coberturas', m28.coberturas.length, 7);
  eq('marco 1: prêmio liberado', m28.premioLiberado, 204.01);
  eq('marco 1: idade', m28.idade, 40);
  eq('marco 1: morte remanescente inalterada', m28.morteRemanescente, 1215681.86);
  eq('marco 1: sem queda de morte', m28.quedaMorte, false);
  eq('marco 1: diária listada à parte', m28.diariasPerdidas, [{ codigo: 'HC05G', diaria: 228.30 }]);
  eq('marco 1: capital perdido exclui diária', m28.capitalPerdido, 961130.63);
  eq('marco 2 data', m33.data, '2033-06-12');
  eq('marco 2: 2 coberturas', m33.coberturas.length, 2);
  eq('marco 2: prêmio liberado', m33.premioLiberado, 125.44);
  eq('marco 2: idade', m33.idade, 45);
  eq('marco 2: morte remanescente', m33.morteRemanescente, 74196.55);
  eq('marco 2: % remanescente 6,1%', m33.pctMorteRemanescente, 6.1);
  eq('marco 2: destaque <50%', m33.destaqueMeiaProtecao, true);
  eq('marco 1: sem destaque', m28.destaqueMeiaProtecao, false);
  eq('marco vitalício', g.timeline.vitalicio.capital, 74196.55);
  eq('tempo até marco 1 em anos', m28.tempoAte.unidade, 'anos');

  /* ═══════════ GOLDEN — calculadora ═══════════ */
  t('golden/calculadora');
  var e = clone(CATARINA);
  e.inputs = { despesas_fixas_mensais: 12000, despesas_educacao_mensais: 2500, anos_educacao: 20, dividas_parcela_mensal: 3500, anos_dividas: 5, patrimonio_total: 900000, renda_mensal_media: 22000 };
  var c = RS.montarRevisao(e).calculadora;
  eq('preenchida', c.preenchida, true);
  eq('emergenciais', c.emergenciais, 36000);
  eq('restabelecimento', c.restabelecimento, 72000);
  eq('inventário 15%', c.custoInventario, 135000);
  eq('capital vitalício', c.capitalVitalicio, 243000);
  eq('educação total', c.educacaoTotal, 600000);
  eq('dívidas total', c.dividasTotal, 210000);
  eq('capital temporário', c.capitalTemporario, 810000);
  eq('necessidade morte', c.necessidadeMorte, 1053000);
  eq('gap morte (sobra)', c.linhas[0].gap, 162681.86);
  eq('necessidade invalidez', c.necessidadeInvalidez, 486000);
  eq('necessidade DG (floor 5000)', c.necessidadeDoencasGraves, 430000);
  eq('gap DG (falta)', c.linhas.filter(function (l) { return l.chave === 'doencas_graves'; })[0].gap, -201702.94);
  eq('necessidade fraturas', c.necessidadeFraturas, 54000);
  eq('gap fraturas', c.linhas.filter(function (l) { return l.chave === 'fraturas'; })[0].gap, -54000);
  eq('diária internação (floor 50)', c.necessidadeDiariaInternacao, 600);
  eq('gap diária', c.linhas.filter(function (l) { return l.chave === 'internacao'; })[0].gap, -371.70);
  eq('comprometimento de renda', c.comprometimentoRenda, 2.21);
  eq('limite mensal 5%', c.limiteMensalRecomendado, 1100);
  eq('limite anual 8%×12', c.limiteAnualRecomendado, 21120);
  eq('margem disponível', c.margemDisponivel, 614.13);

  t('calculadora/vazia');
  var v = RS.montarRevisao(clone(CATARINA)).calculadora;
  eq('não preenchida sem inputs', v.preenchida, false);
  eq('comprometimento null sem renda', v.comprometimentoRenda, null);

  /* ═══════════ reserva técnica ═══════════ */
  t('reserva');
  var er = clone(CATARINA);
  er.apolices[1].valor_resgate = 1200; er.apolices[1].valor_resgate_data = '2026-07-01';
  var dr = RS.montarRevisao(er);
  eq('só a apólice vitalícia acumula', dr.reserva.length, 1);
  eq('apólice certa', dr.reserva[0].apolice, '001524343');
  eq('% recuperável = resgate/pago', dr.reserva[0].pctRecuperavel, 13.22);
  eq('origem manual', dr.reserva[0].origem, 'manual');
  var ep = clone(CATARINA);
  ep.fatorResgateProvider = function (a) { return a.numero === '001524343' ? 999 : null; };
  eq('provider futuro plugável', RS.montarRevisao(ep).reserva[0].valorResgate, 999);
  eq('sem valor → null (nunca estimar)', RS.montarRevisao(clone(CATARINA)).reserva[0].valorResgate, null);

  /* ═══════════ 1 apólice ═══════════ */
  t('uma apólice');
  var u = clone(CATARINA);
  u.apolices = [u.apolices[0]];
  u.coberturas = u.coberturas.filter(function (cb) { return cb.apolice_numero === '001520815'; });
  var du = RS.montarRevisao(u);
  eq('morte só temporária', du.morte.total, 1141485.31);
  eq('% vitalício 0', du.morte.pctVitalicio, 0);
  eq('prêmio de 1 apólice', du.premioMensalTotal, 226.47);
  eq('internação vira não contratada', du.consolidacao.filter(function (l) { return l.sinistro === 'INTERNACAO' && !l.sub; })[0].naoContratado, true);
  eq('sem vitalícia → sem reserva', du.reserva.length, 0);

  /* ═══════════ 5+ apólices ═══════════ */
  t('cinco apólices');
  var q = clone(CATARINA);
  for (var i = 0; i < 3; i++) {
    q.apolices.push({ numero: 'X' + i, status: 'Ativa', premio_total: 100, periodicidade: 'Mensal' });
    q.coberturas.push({ apolice_numero: 'X' + i, codigo: 'TP10G', valor_segurado: 100000, premio_liquido: 50, termino: '2030-01-01' });
  }
  var dq = RS.montarRevisao(q);
  eq('5 apólices ativas', dq.apolicesAtivas, 5);
  eq('morte soma as 5', dq.morte.total, 1515681.86);
  eq('prêmio soma as 5', dq.premioMensalTotal, 785.87);
  eq('marco novo em 2030', dq.timeline.marcos.length, 3);
  eq('remanescente pós-2030', dq.timeline.marcos[1].morteRemanescente, 1215681.86);

  /* ═══════════ código fora do catálogo — NUNCA quebrar, NUNCA silenciar ═══════════ */
  t('não classificado');
  var n = clone(CATARINA);
  n.coberturas.push({ apolice_numero: '001520815', codigo: 'ZZ99X', nome: 'Cobertura Misteriosa', valor_segurado: 50000, premio_liquido: 9.99, termino: '2030-06-12' });
  var dn = RS.montarRevisao(n);
  eq('aparece em naoClassificados', dn.naoClassificados.length, 1);
  eq('código preservado', dn.naoClassificados[0].codigo, 'ZZ99X');
  eq('linha própria na consolidação', dn.consolidacao.filter(function (l) { return l.sinistro === 'NAO_CLASSIFICADO'; }).length, 1);
  eq('NÃO contamina o capital de morte', dn.morte.total, 1215681.86);
  eq('entra na timeline mesmo sem classe', dn.timeline.marcos.filter(function (m) { return m.data === '2030-06-12'; }).length, 1);

  /* ═══════════ sem apólice ativa ═══════════ */
  t('sem apólice ativa');
  var z = clone(CATARINA);
  z.apolices.forEach(function (a) { a.status = 'Cancelada'; });
  var dz = RS.montarRevisao(z);
  eq('0 ativas', dz.apolicesAtivas, 0);
  eq('capital morte 0', dz.morte.total, 0);
  eq('prêmio 0', dz.premioMensalTotal, 0);
  eq('timeline vazia', dz.timeline.marcos.length, 0);
  eq('tudo não contratado', dz.naoContratados.length, 9);
  eq('consolidação continua renderizável', dz.consolidacao.length >= 14, true);

  /* ═══════════ status/vigência da cobertura ═══════════ */
  t('cobertura inativa/vencida');
  var s = clone(CATARINA);
  s.coberturas[1].status_cobertura = 'Lapsed';                        // DDMRG da ap.1
  s.coberturas.push({ apolice_numero: '001520815', codigo: 'AB05G', valor_segurado: 99999, premio_liquido: 5, termino: '2025-01-01' }); // já vencida
  var ds = RS.montarRevisao(s);
  eq('Lapsed sai da consolidação', linhaC(ds, 'DOENCAS_GRAVES').capital, 102733.68);
  eq('vencida não vira "contratada"', linhaC(ds, 'MORTE_ACIDENTAL').naoContratado, true);
  eq('descartadas contadas (não silenciadas)', ds.descartadas.inativas + ds.descartadas.vencidas, 2);

  /* ═══════════ periodicidade anual mensalizada ═══════════ */
  t('periodicidade anual');
  var pa = clone(CATARINA);
  pa.apolices.push({ numero: 'AN1', status: 'Ativa', premio_total: 1200, periodicidade: 'Anual' });
  var dpa = RS.montarRevisao(pa);
  eq('anual entra ÷12', dpa.premioMensalTotal, 585.87);
  eq('valor anual preservado', dpa.premioAnualContratado, 1200);

  /* ═══════════ parâmetros editáveis (nada hardcoded) ═══════════ */
  t('parâmetros');
  var pp = clone(CATARINA);
  pp.inputs = { despesas_fixas_mensais: 10000 };
  pp.parametros = { emergenciais_meses: 4, inventario_pct: 0.2 };
  var dpp = RS.montarRevisao(pp).calculadora;
  eq('emergenciais respeita parâmetro', dpp.emergenciais, 40000);
  eq('restabelecimento mantém default', dpp.restabelecimento, 60000);

  LOG((FAILS ? '✗ ' : '✓ ') + PASSES + ' asserts ok, ' + FAILS + ' falha(s)');
  root.__TEST_FAILS = FAILS;
  root.__TEST_PASSES = PASSES;
})(typeof globalThis !== 'undefined' ? globalThis : this);
