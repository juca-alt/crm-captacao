// Testes das funções puras do crm-mcp v3.0 (leitura). Fixture INVENTADA (Fulano/Beltrano/Ciclano) — repo público.
// Rodar: CRM_MCP_TESTE=1 deno test --allow-env supabase/functions/crm-mcp/ferramentas_test.ts
Deno.env.set("CRM_MCP_TESTE", "1");
// deno-lint-ignore no-explicit-any
const m: any = await import("./index.ts");

function eq(a, b, msg = "") {
  const x = JSON.stringify(a), y = JSON.stringify(b);
  if (x !== y) throw new Error(`${msg}\n  esperado: ${y}\n  veio:     ${x}`);
}

Deno.test("telChave tolera 55, DDD e 9º dígito", () => {
  eq(m.telChave("+55 (81) 99999-1234"), { ddd: "81", ult8: "99991234" });
  eq(m.telChave("5581999991234"), { ddd: "81", ult8: "99991234" });
  eq(m.telChave("558199991234"), { ddd: "81", ult8: "99991234" });   // sem o 9
  eq(m.telChave("99991234"), { ddd: "", ult8: "99991234" });
  eq(m.telChave("1234"), null);
});

Deno.test("telScore: mesmo número com/sem 9 casa; DDD diferente não", () => {
  eq(m.telScore("(81) 9 9999-1234", "558199991234"), 2);
  eq(m.telScore("99991234", "5581999991234"), 1);
  eq(m.telScore("(11) 99999-1234", "5581999991234"), 0);
  eq(m.telScore("(81) 99999-0000", "5581999991234"), 0);
});

Deno.test("likeSeguro tira reservados do PostgREST e escapa curingas", () => {
  eq(m.likeSeguro("a*b,(c)"), "a b c");
  eq(m.likeSeguro("100%_ok"), "100\\%\\_ok");
});

Deno.test("trecho centra no termo, sem acento e sem caixa", () => {
  const t = "x".repeat(500) + " Apólice emitida " + "y".repeat(500);
  const s = m.trecho(t, "apolice", 100);
  if (!s.includes("Apólice")) throw new Error("termo fora do trecho: " + s);
  if (!s.startsWith("…") || !s.endsWith("…")) throw new Error("reticências");
  eq(m.trecho("curto", "zzz", 300), "curto");
});

Deno.test("isoArg aceita AAAA-MM-DD (meia-noite de Recife) e recusa lixo", () => {
  eq(m.isoArg("2026-10-01"), "2026-10-01T03:00:00.000Z");
  eq(m.isoArg(""), null);
  let erro = false; try { m.isoArg("ontem"); } catch { erro = true; }
  eq(erro, true);
});

Deno.test("enxuto tira vazios e mantém false/0", () => {
  eq(m.enxuto({ a: null, b: "", c: [], d: false, e: 0, f: "x" }), { d: false, e: 0, f: "x" });
});

Deno.test("LIM: padrão, teto e lixo", () => {
  eq(m.LIM(undefined, 30, 100), 30);
  eq(m.LIM(500, 30, 100), 100);
  eq(m.LIM("abc", 30, 100), 30);
  eq(m.LIM(-5, 30, 100), 30);
});

Deno.test("funilDe espelha o app: funil desconhecido com etapa vira nn", () => {
  const cfg = m.funilCfgDe(null);
  eq(m.funilDe("bn", cfg), "nn");
  eq(m.funilDe(undefined, cfg), "nn");
  eq(m.funilDe("bc", cfg), "bc");
  eq(m.funilDe("mfo-bc", cfg), "mfo-bc");
  eq(m.classeEtapa("nn", "Prop. Cancelada", cfg), "encerrado");
  eq(m.classeEtapa("bc", "Clientes Ativos", cfg), "carteira");
  eq(m.classeEtapa("vg", "Proposta", cfg), "aberto");
});

Deno.test("negocioDe + resumirFunil sobre fixture inventada", () => {
  const cfg = m.funilCfgDe({ bc: [{ id: "Clientes Ativos" }, { id: "Contato Agenda/Revisita", label: "TA/RC" }, { id: "Venda perdida", enc: true }] });
  const hoje = "2026-10-23";
  const rows = [
    { id: "1", dono: "eu", nome: "Fulano", funil: "nn", etapa: "TA", pm: 300, criadoEm: "2026-10-01",
      tarefas: [{ tit: "ligar", quando: "2026-10-20", feito: null }, { tit: "antiga", quando: "2026-09-01", feito: "2026-09-01" }],
      interacoes: [{ k: "etapa", de: "SitPlan", para: "TA", dia: "2026-10-13" }] },
    { id: "2", dono: "eu", nome: "Beltrano", funil: "bn", etapa: "TA", criadoEm: "2026-10-03", congelado: { em: "2026-10-22", ate: "2026-11-30", motivo: "viagem" } },
    { id: "3", dono: "eu", nome: "Ciclano", funil: "nn", etapa: "Não", pm: 100 },
    { id: "4", dono: "eu", nome: "Fulana", funil: "bc", etapa: "Clientes Ativos" },
    { id: "5", dono: "eu", nome: "Beltrana", funil: "bc", etapa: "Contato Agenda/Revisita", pm: 250, tarefas: [{ tit: "revisita", quando: "2026-10-30", hora: "10:00", feito: null }] },
    { id: "6", dono: "eu", nome: "Sem etapa", funil: "bn" },
    { id: "7", dono: "eu", nome: "Mesclado", funil: "nn", etapa: "TA", merged_into: "1" },
  ];
  const negs = rows.map((r) => m.negocioDe(r, cfg, hoje)).filter(Boolean);
  eq(negs.length, 5, "sem etapa e mesclado ficam de fora");
  const f = negs.find((n) => n.id === "1");
  eq([f.pa, f.dias_na_etapa, f.tarefas_atrasadas, f.proxima_atividade.tit], [3600, 10, 1, "ligar"]);
  const b = negs.find((n) => n.id === "2");
  eq([b.funil, b.congelado.motivo, b.dias_na_etapa, b.pa], ["nn", "viagem", 20, null]);
  eq(negs.find((n) => n.id === "5").etapa_label, "TA/RC");

  const r = m.resumirFunil(negs, cfg);
  eq(r.total_abertos, { quantidade: 3, pa_total: 6600, sem_valor: 1, sem_proxima_atividade: 1, congelados: 1, tarefas_atrasadas: 1 });
  const nn = r.funis.find((x) => x.funil === "nn");
  eq(nn.etapas.map((e) => [e.etapa, e.quantidade, e.pa_total]), [["TA", 2, 3600]]);
  eq(nn.encerrados, [{ etapa: "Não", quantidade: 1, pa_total: 1200 }]);
  const bc = r.funis.find((x) => x.funil === "bc");
  eq([bc.carteira_clientes_ativos, bc.abertos.quantidade], [1, 1]);
  eq(m.resumirFunil(negs, cfg, "bc").funis.length, 1, "filtro de funil");
});

Deno.test("filtroBase: padrão só a minha, 'todas' sem filtro, e-mail escolhe a base", () => {
  eq(m.filtroBase(undefined, "eu@x.com", "dono"), "&dono=eq.eu%40x.com");
  eq(m.filtroBase("minha", "eu@x.com", "dono"), "&dono=eq.eu%40x.com");
  eq(m.filtroBase("TODAS", "eu@x.com", "dono"), "");
  eq(m.filtroBase("outro@x.com", "eu@x.com", "lp_email"), "&lp_email=eq.outro%40x.com");
});

// ── despacho das 8 ferramentas v3 com fetch falso (dados inventados): monta as URLs certas e não quebra ──
function fetchFalso(log) {
  const chat = { id: "chatA1", dono: "eu@x.com", contato_nome: "Fulano", contato_tel: "+55 81 99999-1234", contato_tel_norm: "5581999991234", canal: "Comercial", aberto: true, ultima_msg_em: new Date(Date.now() - 5 * 36e5).toISOString(), ultima_msg_de: "cliente", ultima_msg_previa: "oi", historico_completo: false, etiquetas: [] };
  const outro = { ...chat, id: "chatB2", contato_tel_norm: "5511999991234" };   // mesmo final, DDD diferente
  const contato = { id: "c1", dono: "eu@x.com", nome: "Fulano", funil: "nn", etapa: "TA", pm: 200, telefone: "(81) 99999-1234", criadoEm: "2026-10-01", tarefas: [] };
  return (url, init = {}) => {
    const u = decodeURIComponent(String(url)); log.push((init.method || "GET") + " " + u);
    let body = [];
    if (u.includes("/umbler_mensagens?")) body = [{ chat_id: "chatA1", enviada_em: "2026-10-22T12:00:00Z", de: "cliente", tipo: "Text", texto: "quero a proposta amanhã" }, { chat_id: "chatA1", enviada_em: "2026-10-21T12:00:00Z", de: "nos", tipo: "Image", texto: "", privada: true }];
    else if (u.includes("/umbler_chats?")) body = [chat, outro];
    else if (u.includes("/umbler_estado?")) body = [{ dono: "eu@x.com", ultimo_ok: new Date().toISOString(), stats: { chats: 2, membros: { a: 1 } } }];
    else if (u.includes("/app_settings?")) body = [];
    else if (u.includes("/lp_contatos?")) body = [contato, { ...contato, id: "c2", nome: "Beltrano", etapa: "Não" }];
    else if (u.includes("/emissao_pendencias?")) body = [{ id: "p1", lp_email: "eu@x.com", segurado: "Ciclano", pa_sem_iof: 1000, origem_relatorio: "2026-10-20", nao_conta: false }];
    else if (u.includes("/emissao_emitidas?")) body = [{ id: "e1", lp_email: "outro@x.com", segurado: "Fulana", pa_sem_iof: 500, afyc_projetado: 300 }];
    const h = new Headers({ "content-range": "0-0/42" });
    return Promise.resolve(new Response(init.method === "HEAD" ? null : JSON.stringify(body), { status: 200, headers: h }));
  };
}

Deno.test("despacho v3 com fetch falso", async () => {
  const log = [], orig = globalThis.fetch;
  globalThis.fetch = fetchFalso(log);
  const ctx = { dono: "eu@x.com", access: "tok" };
  try {
    const l = await m.callTool("conversas_listar", { busca: "(81) 99999-1234", aguardando_resposta: true, desde: "2026-10-01", limite: 500 }, ctx);
    eq(l.conversas.map((c) => c.id), ["chatA1"], "DDD 11 sai pelo telScore");
    if (!(l.conversas[0].horas_sem_resposta >= 4.9)) throw new Error("horas_sem_resposta");
    if (!log.some((x) => x.includes("contato_tel_norm=ilike.*99991234*") && x.includes("limit=100") && x.includes("ultima_msg_de=eq.cliente"))) throw new Error("url listar: " + log.at(-1));
    const r = await m.callTool("conversa_ler", { telefone: "81999991234" }, ctx);
    eq([r.conversa.id, r.mensagens.length, r.mensagens[0].tipo, r.mensagens[1].texto, r.outras_conversas], ["chatA1", 2, "Image", "quero a proposta amanhã", undefined]);
    if (!r.aviso) throw new Error("aviso de histórico incompleto");
    const b = await m.callTool("conversas_buscar", { termo: "proposta", de: "cliente" }, ctx);
    eq([b.total, b.resultados[0].contato_nome], [2, "Fulano"]);
    eq((await m.callTool("conversas_buscar", { termo: "ab" }, ctx)).aviso != null, true);
    eq((await m.callTool("conversas_buscar", { termo: "abc", de: "bot" }, ctx)).aviso != null, true);
    const s = await m.callTool("conversas_status", {}, ctx);
    eq([s.totais.conversas, s.contas[0].stats.membros, s.contas[0].stats.chats], [42, undefined, 2]);
    const cc = await m.callTool("contato_conversa", { busca: "Fulano" }, ctx);
    eq([cc.contato.id, cc.contato.pa, cc.conversa.id, cc.candidatos.length], ["c1", 2400, "chatA1", 1]);
    const fr = await m.callTool("funil_resumo", {}, ctx);
    eq([fr.total_abertos.quantidade, fr.base_de_nomes_sem_etapa], [1, 42]);
    if (!log.some((x) => x.includes("lp_contatos?select=") && x.includes("dados->>etapa=not.is.null&dono=eq.eu@x.com"))) throw new Error("filtro de base no funil");
    const nl = await m.callTool("negocios_listar", { ordenar: "parado", base: "todas" }, ctx);
    eq([nl.total, nl.negocios[0].id, nl.negocios[0].telefone], [1, "c1", "(81) 99999-1234"]);
    const ep = await m.callTool("emissao_pendencias", {}, ctx);
    eq([ep.pendencias_abertas.total, ep.pendencias_abertas.itens[0].lp_email, ep.pendencias_abertas.itens[0].nao_conta, ep.emitidas.itens[0].lp_email, ep.emitidas.afyc_projetado_total], [1, undefined, undefined, "outro@x.com", 300]);
    if (log.some((x) => /bruto/.test(x))) throw new Error("nunca pedir a coluna bruto");
    if (log.some((x) => !x.startsWith("GET ") && !x.startsWith("HEAD "))) throw new Error("ferramenta v3 tentou escrever: " + log.find((x) => !x.startsWith("GET ")));
  } finally { globalThis.fetch = orig; }
});
