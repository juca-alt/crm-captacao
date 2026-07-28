/* ============================================================================
   RevisaoService — regras de negócio da REVISÃO DE APÓLICES (Visão LP)
   JS PURO: sem DOM, sem Supabase, sem Date.now() implícito — recebe dados e
   data de referência, devolve o DTO completo da revisão. É o único lugar com
   regra de seguro; a UI (vendas.html) só formata. Testes: scripts/test-revisao*.
   Carregado no navegador via <script src> (global RevisaoService) e no Node/jsc
   dos testes via require/load — por isso o guard de export no fim.

   Convenções de dados (espelham as tabelas rev_* da migration revisao_apolices.sql):
   - apolice:   {numero, status, premio_liquido, iof, premio_total, periodicidade,
                 data_emissao, idade_emissao, total_pago, valor_resgate, ...}
   - cobertura: {apolice_numero, codigo, nome, valor_segurado, premio_liquido,
                 termino, status_cobertura, classe_ajuste}
   - catalogo:  [{codigo, sinistro, natureza, eh_diaria, descricao_cliente}]
                sinistro null = pendente → cobertura cai em NAO_CLASSIFICADO.
   ============================================================================ */
(function (root) {
  'use strict';

  var SINISTROS = ['MORTE_QUALQUER_CAUSA', 'MORTE_ACIDENTAL', 'DOENCA_TERMINAL', 'INVALIDEZ_TOTAL',
    'INVALIDEZ_PARCIAL', 'DOENCAS_GRAVES', 'INTERNACAO', 'CIRURGIAS', 'FRATURAS',
    'PERDA_AUTONOMIA', 'FUNERAL'];

  var ROTULOS = {
    MORTE_QUALQUER_CAUSA: 'Morte Qualquer Causa', MORTE_ACIDENTAL: 'Morte Acidental',
    DOENCA_TERMINAL: 'Doença Terminal', INVALIDEZ_TOTAL: 'Invalidez Total',
    INVALIDEZ_PARCIAL: 'Invalidez Parcial', DOENCAS_GRAVES: 'Doenças Graves',
    INTERNACAO: 'Internação (diária)', CIRURGIAS: 'Cirurgias', FRATURAS: 'Fraturas',
    PERDA_AUTONOMIA: 'Perda de Autonomia', FUNERAL: 'Funeral', NAO_CLASSIFICADO: 'Não classificado'
  };

  // Defaults = mesmos valores do seed de rev_parametros (a tabela do banco manda;
  // isto aqui é fallback pra preview/deslogado e pros testes).
  var PARAMS_DEFAULT = {
    emergenciais_meses: 3, restabelecimento_meses: 6, inventario_pct: 0.15,
    invalidez_mult: 2, dg_meses: 24, dg_teto: 2000000, dg_arredondamento: 5000,
    fraturas_meses: 3, fraturas_teto: 100000, diaria_teto: 3000, diaria_arredondamento: 50,
    educacao_anos_default: 20, dividas_anos_default: 5,
    limite_mensal_pct: 0.05, limite_anual_pct: 0.08, uti_mult: 2
  };

  function r2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }

  // idade completa em `dataISO` de quem nasceu em `nascISO` (aniversário conta no dia)
  function idadeEm(nascISO, dataISO) {
    if (!nascISO || !dataISO) return null;
    var a = +dataISO.slice(0, 4) - +nascISO.slice(0, 4);
    if (dataISO.slice(5) < nascISO.slice(5)) a--;
    return a;
  }
  // distância aproximada em meses/anos entre duas datas ISO (p/ rótulo "em X meses/anos")
  function tempoAte(deISO, ateISO) {
    var meses = (+ateISO.slice(0, 4) - +deISO.slice(0, 4)) * 12 + (+ateISO.slice(5, 7) - +deISO.slice(5, 7));
    if (+ateISO.slice(8, 10) < +deISO.slice(8, 10)) meses--;
    if (meses < 0) meses = 0;
    return meses < 12 ? { n: meses, unidade: 'meses' } : { n: Math.round(meses / 12), unidade: 'anos' };
  }

  function montarRevisao(entrada) {
    var dataRef = entrada.dataReferencia;
    if (!dataRef) throw new Error('dataReferencia obrigatória (YYYY-MM-DD)');
    var cliente = entrada.cliente || {};
    var params = Object.assign({}, PARAMS_DEFAULT, entrada.parametros || {});
    var catalogo = {};
    (entrada.catalogo || []).forEach(function (c) { if (c && c.codigo) catalogo[c.codigo] = c; });

    // ── apólices ativas ──
    var apolices = (entrada.apolices || []).filter(function (a) { return a && a.status === 'Ativa'; });
    var numsAtivos = {};
    apolices.forEach(function (a) { numsAtivos[a.numero] = true; });

    // ── coberturas consideradas: de apólice ativa, não encerradas, não vencidas ──
    // Decisão registrada: Surrendered/Lapsed e término < dataRef saem da consolidação
    // (não protegem mais), mas são CONTADAS pra tela não esconder nada.
    var descartadas = { inativas: [], vencidas: [] };
    var cobs = [];
    (entrada.coberturas || []).forEach(function (c) {
      if (!c || !numsAtivos[c.apolice_numero]) return;
      if (c.status_cobertura && c.status_cobertura !== 'Premium Paying') { descartadas.inativas.push(c); return; }
      if (c.termino && c.termino < dataRef) { descartadas.vencidas.push(c); return; }
      var cat = catalogo[c.codigo];
      cobs.push({
        apolice: c.apolice_numero, codigo: c.codigo, nome: c.nome || '',
        capital: num(c.valor_segurado), premio: num(c.premio_liquido),
        termino: c.termino || null, classe: c.classe_ajuste || null,
        sinistro: (cat && cat.sinistro) ? cat.sinistro : 'NAO_CLASSIFICADO',
        natureza: (cat && cat.natureza) ? cat.natureza : 'temporario',
        ehDiaria: !!(cat && cat.eh_diaria),
        descricao: (cat && cat.descricao_cliente) || null
      });
    });

    var naoClassificados = cobs.filter(function (c) { return c.sinistro === 'NAO_CLASSIFICADO'; })
      .map(function (c) { return { codigo: c.codigo, apolice: c.apolice, nome: c.nome, capital: c.capital, premio: c.premio }; });

    function doSinistro(s) { return cobs.filter(function (c) { return c.sinistro === s; }); }
    function somaCap(l) { return r2(l.reduce(function (a, c) { return a + c.capital; }, 0)); }
    function somaPre(l) { return r2(l.reduce(function (a, c) { return a + c.premio; }, 0)); }

    // ── prêmio mensal total = soma de premio_total das apólices ativas (inclui IOF);
    //    Anual entra mensalizado (÷12), mantendo o anual disponível ──
    var premioMensalTotal = 0, premioAnualContratado = 0, iofTotal = 0;
    apolices.forEach(function (a) {
      var p = num(a.premio_total);
      if (a.periodicidade === 'Anual') { premioMensalTotal += p / 12; premioAnualContratado += p; }
      else premioMensalTotal += p;
      iofTotal += num(a.iof);
    });
    premioMensalTotal = r2(premioMensalTotal);
    iofTotal = r2(iofTotal);

    // ── consolidação por sinistro ──
    var morteCobs = doSinistro('MORTE_QUALQUER_CAUSA');
    var morteVit = morteCobs.filter(function (c) { return c.natureza === 'vitalicio'; });
    var morteTemp = morteCobs.filter(function (c) { return c.natureza !== 'vitalicio'; });
    var capMorte = somaCap(morteCobs), capVit = somaCap(morteVit), capTemp = somaCap(morteTemp);

    var intern = doSinistro('INTERNACAO');
    var diaria = somaCap(intern);
    var utiDiaria = r2(diaria * params.uti_mult);

    // Invalidez Total / Doença Terminal = antecipações da básica (capital = morte,
    // prêmio "incluso"). Se houver cobertura PRÓPRIA (ex.: PI05G), ela SOMA ao
    // capital e o prêmio dela aparece. (Decisão registrada; golden não tem PI.)
    var piCobs = doSinistro('INVALIDEZ_TOTAL');

    function linha(s, extras) {
      var l = doSinistro(s);
      return Object.assign({
        sinistro: s, rotulo: ROTULOS[s], capital: somaCap(l),
        premio: l.length ? somaPre(l) : 0, ehDiaria: false, sub: false,
        naoContratado: !l.length, incluso: false,
        coberturas: l.map(function (c) { return c.codigo; }),
        descricao: l.length ? (l[0].descricao || null) : null
      }, extras || {});
    }

    var consolidacao = [
      Object.assign(linha('MORTE_QUALQUER_CAUSA'), { destaque: true, naoContratado: !morteCobs.length }),
      { sinistro: 'MORTE_QUALQUER_CAUSA', rotulo: 'Vitalício / Resgatável', capital: capVit, premio: somaPre(morteVit), natureza: 'vitalicio', ehDiaria: false, sub: true, naoContratado: false, incluso: false, coberturas: morteVit.map(function (c) { return c.codigo; }), descricao: morteVit.length ? morteVit[0].descricao : null },
      { sinistro: 'MORTE_QUALQUER_CAUSA', rotulo: 'Temporário', capital: capTemp, premio: somaPre(morteTemp), natureza: 'temporario', ehDiaria: false, sub: true, naoContratado: false, incluso: false, coberturas: morteTemp.map(function (c) { return c.codigo; }), descricao: morteTemp.length ? morteTemp[0].descricao : null },
      linha('MORTE_ACIDENTAL'),
      { sinistro: 'DOENCA_TERMINAL', rotulo: ROTULOS.DOENCA_TERMINAL, capital: capMorte, premio: null, ehDiaria: false, sub: false, naoContratado: false, incluso: true, coberturas: [], descricao: 'Em caso de doença terminal com expectativa de vida máxima de 6 meses, você pode optar por receber antecipadamente uma parte ou todo o valor do benefício da cobertura básica.' },
      { sinistro: 'INVALIDEZ_TOTAL', rotulo: ROTULOS.INVALIDEZ_TOTAL, capital: r2(capMorte + somaCap(piCobs)), premio: piCobs.length ? somaPre(piCobs) : null, ehDiaria: false, sub: false, naoContratado: false, incluso: !piCobs.length, coberturas: piCobs.map(function (c) { return c.codigo; }), descricao: piCobs.length ? piCobs[0].descricao : 'Se sofrer alguma das lesões irreversíveis previstas nas condições gerais, em consequência exclusiva de acidente coberto, você pode receber integralmente o valor do benefício, e o seguro será encerrado.' },
      linha('INVALIDEZ_PARCIAL'),
      linha('DOENCAS_GRAVES'),
      Object.assign(linha('INTERNACAO'), { ehDiaria: true }),
      { sinistro: 'INTERNACAO', rotulo: 'U.T.I. (dobro da diária)', capital: utiDiaria, premio: null, ehDiaria: true, sub: true, naoContratado: !intern.length, incluso: intern.length > 0, coberturas: [], descricao: null },
      linha('CIRURGIAS'),
      linha('FRATURAS'),
      linha('PERDA_AUTONOMIA'),
      linha('FUNERAL')
    ];
    if (naoClassificados.length) {
      var nc = cobs.filter(function (c) { return c.sinistro === 'NAO_CLASSIFICADO'; });
      consolidacao.push({ sinistro: 'NAO_CLASSIFICADO', rotulo: ROTULOS.NAO_CLASSIFICADO, capital: somaCap(nc), premio: somaPre(nc), ehDiaria: false, sub: false, naoContratado: false, incluso: false, coberturas: nc.map(function (c) { return c.codigo; }), descricao: null });
    }

    var naoContratados = SINISTROS.filter(function (s) {
      if (s === 'MORTE_QUALQUER_CAUSA') return !morteCobs.length;
      if (s === 'DOENCA_TERMINAL' || s === 'INVALIDEZ_TOTAL') return false; // antecipações da básica
      return !doSinistro(s).length;
    });

    // ── linha do tempo de vencimentos ──
    var comPrazo = cobs.filter(function (c) { return c.natureza !== 'vitalicio' && c.termino; });
    var semPrazo = cobs.filter(function (c) { return c.natureza === 'vitalicio' || !c.termino; });
    var porTermino = {};
    comPrazo.forEach(function (c) { (porTermino[c.termino] = porTermino[c.termino] || []).push(c); });
    var capMorteHoje = capMorte;
    var destaqueDado = false;
    var marcos = Object.keys(porTermino).sort().map(function (data) {
      var grupo = porTermino[data];
      var capPerdido = somaCap(grupo.filter(function (c) { return !c.ehDiaria; }));
      var diariasPerdidas = grupo.filter(function (c) { return c.ehDiaria; })
        .map(function (c) { return { codigo: c.codigo, diaria: c.capital }; });
      // morte remanescente DEPOIS da data: vitalícias + temporárias com término > data
      var restaMorte = r2(somaCap(morteVit) + somaCap(morteTemp.filter(function (c) { return c.termino && c.termino > data; })));
      var pct = capMorteHoje > 0 ? r2(100 * restaMorte / capMorteHoje) : null;
      var destaque = false;
      if (!destaqueDado && pct !== null && pct < 50) { destaque = true; destaqueDado = true; }
      return {
        data: data,
        idade: idadeEm(cliente.nascimento, data),
        tempoAte: tempoAte(dataRef, data),
        coberturas: grupo.map(function (c) { return { codigo: c.codigo, sinistro: c.sinistro, rotulo: ROTULOS[c.sinistro], capital: c.capital, ehDiaria: c.ehDiaria, apolice: c.apolice }; }),
        premioLiberado: somaPre(grupo),
        capitalPerdido: capPerdido,
        diariasPerdidas: diariasPerdidas,
        morteRemanescente: restaMorte,
        pctMorteRemanescente: pct,
        quedaMorte: grupo.some(function (c) { return c.sinistro === 'MORTE_QUALQUER_CAUSA'; }),
        destaqueMeiaProtecao: destaque
      };
    });

    // ── calculadora de necessidade ──
    var inputs = entrada.inputs || {};
    var fix = num(inputs.despesas_fixas_mensais), edu = num(inputs.despesas_educacao_mensais),
      eduAnos = inputs.anos_educacao != null ? num(inputs.anos_educacao) : params.educacao_anos_default,
      div = num(inputs.dividas_parcela_mensal),
      divAnos = inputs.anos_dividas != null ? num(inputs.anos_dividas) : params.dividas_anos_default,
      pat = num(inputs.patrimonio_total), renda = num(inputs.renda_mensal_media);
    var preenchida = !!(fix || edu || div || pat || renda);

    var despesasTotais = fix + edu + div;
    var emergenciais = r2(fix * params.emergenciais_meses);
    var restabelecimento = r2(fix * params.restabelecimento_meses);
    var custoInventario = r2(pat * params.inventario_pct);
    var capitalVitalicio = r2(emergenciais + restabelecimento + custoInventario);
    var educacaoTotal = r2(edu * eduAnos * 12);
    var dividasTotal = r2(div * 12 * divAnos);
    var capitalTemporario = r2(educacaoTotal + dividasTotal);
    var necessidadeMorte = r2(capitalVitalicio + capitalTemporario);
    var necessidadeInvalidez = r2(capitalVitalicio * params.invalidez_mult);
    var necessidadeDG = Math.floor(Math.min(despesasTotais * params.dg_meses, params.dg_teto) / params.dg_arredondamento) * params.dg_arredondamento;
    var necessidadeFraturas = r2(Math.min(despesasTotais * params.fraturas_meses, params.fraturas_teto));
    var necessidadeDiaria = Math.floor(Math.min(despesasTotais / 30, params.diaria_teto) / params.diaria_arredondamento) * params.diaria_arredondamento;
    var comprometimento = renda > 0 ? r2(100 * (premioMensalTotal * 12) / (renda * 12)) : null;
    var limiteMensal = r2(renda * params.limite_mensal_pct);
    var limiteAnual = r2(renda * params.limite_anual_pct * 12);
    var margemDisponivel = renda > 0 ? r2(Math.max(limiteMensal - premioMensalTotal, 0)) : null;

    var linhasCalc = [
      { chave: 'morte_total', rotulo: 'Morte — total', contratado: capMorte, necessario: necessidadeMorte, ehDiaria: false, sub: false },
      { chave: 'morte_vitalicio', rotulo: 'vitalício', contratado: capVit, necessario: capitalVitalicio, ehDiaria: false, sub: true },
      { chave: 'morte_temporario', rotulo: 'temporário', contratado: capTemp, necessario: capitalTemporario, ehDiaria: false, sub: true },
      { chave: 'invalidez_total', rotulo: ROTULOS.INVALIDEZ_TOTAL, contratado: r2(capMorte + somaCap(piCobs)), necessario: necessidadeInvalidez, ehDiaria: false, sub: false },
      { chave: 'invalidez_parcial', rotulo: ROTULOS.INVALIDEZ_PARCIAL, contratado: somaCap(doSinistro('INVALIDEZ_PARCIAL')), necessario: necessidadeInvalidez, ehDiaria: false, sub: false },
      { chave: 'doencas_graves', rotulo: ROTULOS.DOENCAS_GRAVES, contratado: somaCap(doSinistro('DOENCAS_GRAVES')), necessario: necessidadeDG, ehDiaria: false, sub: false },
      { chave: 'fraturas', rotulo: ROTULOS.FRATURAS, contratado: somaCap(doSinistro('FRATURAS')), necessario: necessidadeFraturas, ehDiaria: false, sub: false },
      { chave: 'internacao', rotulo: ROTULOS.INTERNACAO, contratado: diaria, necessario: necessidadeDiaria, ehDiaria: true, sub: false }
    ].map(function (l) { l.gap = r2(l.contratado - l.necessario); return l; });

    // ── reserva técnica (vitalícias; valor de resgate = ENTRADA MANUAL) ──
    // fatorResgateProvider: plug futuro — function(apolice) → valor estimado ou null.
    var provider = entrada.fatorResgateProvider || null;
    var reserva = apolices.filter(function (a) {
      return cobs.some(function (c) { return c.apolice === a.numero && c.natureza === 'vitalicio'; });
    }).map(function (a) {
      var resgate = a.valor_resgate != null ? num(a.valor_resgate)
        : (provider ? provider(a) : null);
      var pago = a.total_pago != null ? num(a.total_pago) : null;
      return {
        apolice: a.numero,
        valorResgate: resgate, valorResgateData: a.valor_resgate_data || null,
        totalPago: pago,
        pctRecuperavel: (resgate != null && pago > 0) ? r2(100 * resgate / pago) : null,
        origem: a.valor_resgate != null ? 'manual' : (provider && resgate != null ? 'calculado' : null)
      };
    });

    // ── por apólice (seção 3 da tela) ──
    var porApolice = apolices.map(function (a) {
      return {
        numero: a.numero, proposta: a.proposta || null, emissao: a.data_emissao || null,
        idadeEmissao: a.idade_emissao != null ? a.idade_emissao : idadeEm(cliente.nascimento, a.data_emissao),
        contestacao: a.tipo_contestacao || null, totalPago: a.total_pago != null ? num(a.total_pago) : null,
        premioTotal: num(a.premio_total), premioLiquido: num(a.premio_liquido), iof: num(a.iof),
        periodicidade: a.periodicidade || null, forma: a.forma_pagamento || null,
        cartaoExpiracao: a.cartao_expiracao || null, diaPagamento: a.dia_pagamento != null ? a.dia_pagamento : null,
        pagoAte: a.pago_ate || null, diasAtraso: a.dias_atraso != null ? a.dias_atraso : null,
        coberturas: cobs.filter(function (c) { return c.apolice === a.numero; })
      };
    });

    return {
      referencia: dataRef,
      cliente: {
        nome: cliente.nome || null, nascimento: cliente.nascimento || null,
        idade: idadeEm(cliente.nascimento, dataRef),
        profissao: cliente.profissao || null, cidade: cliente.cidade || null,
        beneficiario: cliente.beneficiario || null, clienteDesde: cliente.clienteDesde || null
      },
      apolicesAtivas: apolices.length,
      coberturasAtivas: cobs.length,
      descartadas: { inativas: descartadas.inativas.length, vencidas: descartadas.vencidas.length },
      premioMensalTotal: premioMensalTotal,
      premioAnualContratado: r2(premioAnualContratado),
      iofTotal: iofTotal,
      morte: {
        total: capMorte, vitalicio: capVit, temporario: capTemp,
        pctVitalicio: capMorte > 0 ? r2(100 * capVit / capMorte) : null,
        pctTemporario: capMorte > 0 ? r2(100 * capTemp / capMorte) : null
      },
      internacao: { diaria: diaria, uti: utiDiaria },
      consolidacao: consolidacao,
      naoContratados: naoContratados,
      naoClassificados: naoClassificados,
      porApolice: porApolice,
      timeline: { marcos: marcos, vitalicio: { capital: capVit, coberturas: semPrazo.map(function (c) { return c.codigo; }) } },
      calculadora: {
        preenchida: preenchida,
        inputs: { despesas_fixas_mensais: fix, despesas_educacao_mensais: edu, anos_educacao: eduAnos, dividas_parcela_mensal: div, anos_dividas: divAnos, patrimonio_total: pat, renda_mensal_media: renda },
        despesasTotais: r2(despesasTotais),
        emergenciais: emergenciais, restabelecimento: restabelecimento, custoInventario: custoInventario,
        capitalVitalicio: capitalVitalicio,
        educacaoTotal: educacaoTotal, dividasTotal: dividasTotal, capitalTemporario: capitalTemporario,
        necessidadeMorte: necessidadeMorte,
        necessidadeInvalidez: necessidadeInvalidez,
        necessidadeDoencasGraves: necessidadeDG,
        necessidadeFraturas: necessidadeFraturas,
        necessidadeDiariaInternacao: necessidadeDiaria,
        comprometimentoRenda: comprometimento,
        limiteMensalRecomendado: renda > 0 ? limiteMensal : null,
        limiteAnualRecomendado: renda > 0 ? limiteAnual : null,
        margemDisponivel: margemDisponivel,
        linhas: linhasCalc
      },
      reserva: reserva,
      parametros: params
    };
  }

  var RevisaoService = {
    montarRevisao: montarRevisao,
    idadeEm: idadeEm,
    tempoAte: tempoAte,
    SINISTROS: SINISTROS,
    ROTULOS: ROTULOS,
    PARAMS_DEFAULT: PARAMS_DEFAULT
  };

  root.RevisaoService = RevisaoService;
  if (typeof module !== 'undefined' && module.exports) module.exports = RevisaoService;
})(typeof globalThis !== 'undefined' ? globalThis : this);
