# 📌 ESTADO — VISÃO LP (vendas.html) · CRM Island
**Última atualização:** 12/07/2026 (sessão Frentes B+D) · **Foco desta visão:** SÓ `vendas.html` (LP/Vendas). Captação (`index.html`) tem sessão própria — **não tocar**.
> Modelo de trabalho: **uma sessão por visão** (LP ↔ MFB em paralelo). Regras de paralelismo no fim deste doc.

---

## ▶️ PROMPT PRA COLAR NA PRÓXIMA SESSÃO DE LP
```
Retoma a VISÃO LP do CRM Island (vendas.html). Lê primeiro o
~/Documents/crm-lp-build/ESTADO_VISAO_LP.md. Trabalha SÓ na visão LP,
worktree ~/Documents/crm-lp-build. Não toca em index.html.
PRIMEIRO: checa a fila de merges do Gustavo (ordem):
 1. PR #16 Daniel v1 (inclui #12) — github.com/juca-alt/crm-captacao/pull/16
 2. PR #17 Frente 2 completa (parser PDF, independente) — pull/17
 3. PR #18 Carteira→Supabase (EMPILHADO no #16, mergear depois) — pull/18
 4. Migration carteira.sql: ficou COLADA no SQL editor do Supabase — Run.
Se mergeado tudo: validar logado (reimportar .xls → toast "☁️ salvo na
nuvem"; upload do PDF gustavo → 140 reg c/ DAVI/MARCUS inteiros) e colher
feedback meu + do Daniel da 1ª semana.
BACKLOG (decidir ordem comigo):
 A) Ajustes do feedback Daniel v1 (SitPlan/ANCE/metas).
 B) Onda 2 do estudo Global-CRM: mensagens por MOTIVO (catálogo dos 9,
    captura 12 do estudo), X218630 na Carteira, R$ nos Atrasos, fila do dia.
 C) IA "de graça" via plano/Workspace (fallback do import, sem pagar Gemini).
 D) Persistência Supabase de contatos/interações (sync entre aparelhos;
    molde novo = carteira.sql com RLS por dono).
 E) Onda 3: Google Agenda/Meet no agendamento (know-how Painel Central),
    MCP do CRM Island.
```

## ⏱ SESSÃO 12/07 — FRENTES B+D EXECUTADAS (2 PRs novos)
- **✅ FRENTE B (Frente 2 do parser) COMPLETA → PR #17 ABERTO** (`feat/lp-frente2`, `5c862b7`, base main,
  **independente** dos outros PRs): cherry-pick limpo do `10042aa` + **fix do nome longo em 2 linhas**
  (`lpMergeWrap` no `lpPdfText`: funde linha-fragmento na linha-âncora por alinhamento de coluna/x, com
  3 travas — título de seção nunca funde; só linha de DADOS recebe (1ª célula com dígito); célula
  receptora name-like). **Verificado nos 2 PDFs reais: gustavo 140 reg = baseline exato (26/34/42/1/37)
  com os 3 nomes inteiros (1524162 DAVI…ALBUQUERQUE; 1636859+1620607 MARCUS…CUNHA; 1677224 preservou
  segurado≠pagador real); daniel 54 exato. 0 erro console. Colar-texto intacto (mudança só no lpPdfText).**
  ⚠️ Lições novas: regex de MÊS no discriminador casava "MAR" de MARCUS (1º bug); merge ingênuo engolia
  TÍTULOS de seção (seções sumiam do parse) — daí as 3 travas.
- **✅ FRENTE D (Carteira→Supabase, fase 2) PRONTA → PR #18 ABERTO** (`feat/carteira-supabase`, `25e33cc`,
  **EMPILHADO no #16**, base `feat/daniel-v1` — GitHub reaponta pra main quando #16 mergear): tabelas
  `carteira_clientes`/`carteira_apolices` (`dados` jsonb = shape CART intacto), **`dono`=e-mail logado via
  DEFAULT no banco + RLS POR DONO** (Gustavo≠Daniel; mais estrito que lp_relatorio_itens de propósito;
  adianta parte do antigo item E), import = **snapshot substitutivo** (delete do dono+insert), localStorage
  = cache/fallback, toast informa ☁️/⚠️. Boot: `Promise.all([lpCarregar(),cartCarregar()]).then(render)`.
  **Verificado deslogado c/ .xls reais: 120/196, PM 81.178, CS 81,76mi, 31 seg≠pag, round-trip local, 0 erro.**
- **⚙️ MIGRATION `supabase/migrations/carteira.sql`: NÃO RODADA** — classifier barrou DDL em produção.
  **Ficou COLADA no SQL editor do Supabase (aba aberta, projeto kbiinfpjfmuidyzsfegp) — falta só Run.**
  Sem ela o app funciona normal no fallback local (warn no console quando logado).
- **Topologia de branches HOJE:** main = só Carteira base (#11). #16 (daniel-v1) ⊃ #12 (carteira-evolucao).
  #17 independente. #18 empilhado no #16. `feat/lp-supabase` antiga pode ser APOSENTADA depois do merge
  do #17 (conteúdo 100% coberto por #17 + #11).
- **E2E logado pendente (Gustavo, pós-merges):** reimportar os 2 .xls → toast "☁️ salvo na nuvem" →
  reload lê do banco; upload do PDF gustavo → 140 reg com DAVI/MARCUS inteiros.

## ⏱ ESTADO EM 30 SEGUNDOS (atualizado 10/07 — sessão DANIEL V1)
- **🚀 PR #16 ABERTO — "Daniel v1" (v0.3), AGUARDANDO MERGE do Gustavo:** branch `feat/daniel-v1`
  (`0b59a81`, em cima da `feat/carteira-evolucao` → **inclui o conteúdo do PR #12**; mergear o #16
  fecha o #12 automático). https://github.com/juca-alt/crm-captacao/pull/16
- **O que o #16 entrega** (Onda 1 do estudo Global-CRM + decisões do Gustavo 10/07):
  1. **Funil 12 etapas** (processo completo Prudential): SitPlan·TA·OI/FF·P/C·C2·N·**FA**·EMISSÃO·DELIVERY
     + **Não·Prop. Cancelada·Apól. Cancelada** em grupo Encerramentos RECOLHÍVEL no kanban. Zero migração.
     (N=Proposta/análise de saúde; FA=Formulário de Avaliação, rota paralela ao N; ordem P/C→C2→N.)
  2. **Resultado de contato (10 valores)** — `registrarResultado()`: loga na jornada, alimenta KPIs,
     "Agendou OI/FF|P/C|C2" e "Sem interesse" MOVEM a etapa sozinhos (funil por ação). Tentativas contam só.
  3. **📞 SitPlan & TA** (`viewSitplan`): sessão por DATA (default HOJE — TA diário; terça/sexta atalhos),
     5 KPIs ao vivo, abas Todos/Sem/Com resultado, 💡 Sugestão pra Hoje (coaching por KPI), Quentes no topo,
     reagendar ⏭ter/⏭sex, "Adicionar à lista", badge de pendentes na sidebar.
  4. **⭐ ANCE** (A/N/C/E + Avisado, definição real do Gustavo): 5 checks no drawer → estrelas automáticas,
     🔥 Quente 4+, fallback pras estrelas manuais antigas (`estrelasDe()`).
  5. **🎯 Metas** (`viewMetas`): 4 anéis (Recs novas·Ligações·OI/FF·N) semana/mês, realizado AUTOMÁTICO,
     meta inline por perfil (`S.metas`).
  6. **Jornada** (timeline) no drawer c/ autor+hora; **➕ Novo contato** (modal — não existia!);
     banner homologação; botão WhatsApp; "Começar do zero" p/ uso real (`zerarContatos`).
- **Verificado no preview (lp-static:8781):** 16 views 0 erro de console, E2E completo nos 2 perfis
  (criar contato→lista de hoje→Agendou OI/FF→etapa move→KPIs/metas→jornada; Sem interesse→Não; ANCE; reagendar).
- **Arquitetura mantida:** tudo client-side/localStorage (isolamento natural por aparelho); Supabase só
  no LPDB como antes. Sync de contatos entre aparelhos = backlog D.
- **Decisões do Gustavo registradas (10/07):** funil 12 c/ recolher; TA diário+ter/sex; comissionamento
  no CRM (Onda 2, separado da Central Financeira); "avisado" no score; persistência mantém lógica;
  página pública não-prioridade; templates matriz+override aprovado (Onda 2).

### 🗄 Histórico da sessão 03/07 (Oportunidades — conteúdo agora dentro do #16)
- **PR #12 ABERTO, NÃO MERGEADO** (classifier bloqueia merge de PR próprio sem revisão humana): branch `feat/carteira-evolucao` (`bad1c35`, criada a partir da main). **Frente A da Carteira PRONTA e verificada com os 2 .xls reais**: contato WhatsApp/e-mail, radar do relatório no drawer/lista, submódulo 💡 Oportunidades. **Gustavo precisa: (1) mergear https://github.com/juca-alt/crm-captacao/pull/12 → Pages publica; (2) validar logado.**
- **NO AR NA MAIN:** módulo **Carteira de Clientes** base (PR #11, `24c0b6e`).
- **PARADO na branch `feat/lp-supabase`:** **Frente 2** (commit `10042aa`, separa segurado≠pagador no PDF) — falta só nome longo em 2 linhas; precisa **rebase** (main andou).
- **Worktree:** `~/Documents/crm-lp-build`, atualmente na branch `feat/carteira-evolucao`.

### ✅ O QUE ENTROU NA SESSÃO 03/07 (frente A — PR #12, `bad1c35`)
- **Contato:** `cartTel/cartWaUrl/cartBtnsContato` — WhatsApp `wa.me` (DDI 55 automático) + `mailto` no drawer e em todas as listas; aniversário abre com "Feliz aniversário, {nome}! 🎉" editável.
- **Radar:** `cartRadar(ref)` cruza carteira ↔ LPDB (`lpAtivos`, só não-resolvidos) por `normKey` em segurado/pagador/cliente. No drawer = seção "📡 No relatório da semana" (badge faixa/dias + botão que abre o módulo); na lista de Clientes = ícones ⏰⏳📋🎂.
- **💡 Oportunidades** (novo submódulo na sidebar, view `cart-oportunidades`, contador `cnt-cart-op`): 4 KPIs + aniversários 30d (nascimento REAL do .xls, `cartNiverProx`) + radar da semana (`cartRadarLista`) + gaps de cobertura clicáveis (`CART_COBS`/`cartGaps`, estado `CART_GAP`, maiores CS primeiro). Chips de gap também no drawer ("💡 Sem: …").
- **Verificado no preview com os .xls reais:** 120/196 (PM 81.178 / CS 81,76mi batendo), 11 aniversários 30d, gaps Funeral 69 · HC 30 · PD 24 · DDR 2 (Renda/MorteAcid = 0, todo mundo tem), radar 3/3 com registros LPDB injetados usando nomes reais, wa.me com número real, 0 erro de console.
- **Lições de ambiente:** (1) preview não serve `~/Documents` (sandbox) → servir de `/tmp/lp-preview` (copiar `vendas.html` + .xls); o launch.json que vale é o de `~/Teste Claude Code/.claude/` (config `lp-static`, autoPort). (2) `grep` no terminal ENGOLE linhas do `vendas.html` (encoding) → buscar com `python3`. (3) `gh pr merge` de PR próprio é bloqueado pelo classifier → Gustavo merga.

### 📇 MÓDULO CARTEIRA DE CLIENTES (NO AR — base pra várias evoluções)
- **Fonte:** 2 relatórios da Prudential exportados como `.xls` = **tabelas HTML (Latin-1)**, não Excel binário. Lidos **localmente via DOMParser, sem IA** (mesmo espírito do parser LP). Import com 2 slots (`openCarteiraImport`).
- **Modelo** (`CART` em localStorage `crmlp_carteira_v1`, shape pronto pro Supabase fase 2): `clientes[]` {nome, ref=normKey(nome), nascimento, idade, contatos, cob{cs,morteAcid,pd,ddr,hc,funeral,pa,pm,renda}, produtos, familias, motivos, numApolices, csCanc, _raw} + `apolices[]` {proposta, apolice, segurado, ref, respPagto, contatos, status, premio, periodicidade, forma}.
- **JOIN cliente↔apólice = por SEGURADO** (nome normalizado) — validado **120/120** (todo cliente casa). Apólices cujo segurado não é titular (dependentes) = 33; ficam ligadas mas o titular não existe na lista.
- **Normalização de dinheiro do export:** `"1.121,84"`→1121.84; `"35372"`→353.72 (o export às vezes tira o separador → dígitos puros = /100). **PA=prêmio anual, PM=prêmio mensal** (PA/12=PM confirmado).
- **UI:** sidebar módulo 👥 → **Visão da Carteira** (5 KPIs: 120 clientes · 196 apólices · prêmio mensal R$ 81.178 · CS R$ 81,76 mi · 31 seg≠pagador) + **Clientes** (lista buscável) + **drawer** (coberturas + apólices, selo "pago por X" quando pagador≠segurado). Funções: `cartParseTabela/cartClienteDe/cartApoliceDe/cartIngest/cartResumo/viewCartVisao/viewCartClientes/cartAbrir/openCarteiraImport`.
- **Verificado no browser** (arquivos reais `~/Downloads/carteira clientes lp juca.xls` + `apolice juca carteira lp.xls`): 120/196, join 120/120, 34 multi-apólice, 0 erro de console.

### ⚙️ FRENTE 2 (PARADA — não deployada, `feat/lp-supabase` commit `10042aa`)
- **Feito e verificado:** `lpPdfText` preserva fronteira de coluna (gap >4pt → `\x1f`; calibrado nos PDFs reais: palavra ~1-2pt vs coluna ≥7pt). `parseStatusT`/`parseAtrasos` usam o marcador → separam segurado≠pagador **sem IA**; colar-texto cai no fallback `_revisar` (honesto). Também consertou bug pré-existente de **segmentação** (parser nasceu pro texto colado c/ título ABAIXO; lpPdfText põe título ACIMA → cada seção pegava corpo da anterior). Detecção de layout + absorção do rótulo de MÊS inline. **gustavo 13→140 reg, daniel 1→54 (=paridade colado), regressão ZERO no fixture colado (54/0/36).**
- **Falta (bloqueio p/ deploy):** 3 registros de **nome longo que quebra em 2 linhas físicas** (ex "DAVI MAGALHAES CARNEIRO DE / ALBUQUERQUE") → nome truncado. Problema separado (célula multi-linha, geometria às vezes assimétrica). Antes era pior (tudo quebrado).

### 🗺 BACKLOG CONSOLIDADO (pra próxima sessão)
0. ~~Evoluir Carteira (frente A)~~ ✅ FEITO 03/07 (PR #12) — falta só Gustavo mergear + validar logado.
1. **Frente 2**: resolver nome-quebrado (merge de linha-continuação coluna-a-coluna) e então deployar. Precisa rebase da `feat/lp-supabase` (main andou: #11 + #12).
2. **IA "de graça"** via plano/Workspace (fallback do import, sem pagar Gemini).
3. **Persistência Supabase da Carteira** (fase 2 — shape do `CART` já pronto, molde do LP).
4. (Opcional) Isolamento por-LP no RLS quando entrar identidade real.

---
## 🗄 HISTÓRICO ANTERIOR

## ⏱ ESTADO EM 30 SEGUNDOS (sessão anterior)
- **Worktree:** `~/Documents/crm-lp-build`. Branches usadas: `feat/lp-evolucao` (#6), `feat/lp-supabase` (#7). **main = `9a85dfa`**.
- **PR #6 MERGEADO** (`7f89c8f`): fix do teto de tokens do parser (`792bfe1`) + módulo Novos Negócios (`39f608a`). Edge Function DEPLOYADA + E2E confirmado.
- **PR #7 MERGEADO** (`9a85dfa`): **persistência LPDB localStorage → Supabase** (tabela `lp_relatorio_itens`), dando **sync entre LPs**. Migration RODADA no Supabase. **E2E completo confirmado no app deployado** (ingest→upsert→reload→lê do banco). Só `vendas.html`; `index.html` intacto.
- **App agora usa Supabase quando logado** (`LP_REMOTE`), com fallback localStorage p/ preview/deslogado.
- **Preview:** server `lpvendas` (porta 8760, dir `/tmp/lp-preview`) — copiar `vendas.html` pra lá e recarregar (o caminho remoto só testa logado no github.io).

## ✅ O QUE ENTROU NESTA SESSÃO (commit b048a1e)
Redesign da **estrutura** espelhando a Captação: módulo **Novos Negócios** no topo da sidebar (colapsável) → submódulo **Funil Novos Negócios** + lista **Etapas Novos Negócios** (contagem ao vivo).
- **Etapas = fonte única** (`const ETAPAS`): **SitPlan · TA · OI/FF · P/C · C2 · N · EMISSÃO · DELIVERY**. (**N = quando entram com a proposta** — definição do Gustavo.) Atualiza junto Início (funil+KPIs), filtro de Contatos e stepper do drawer.
- **Funil** = Kanban (8 colunas) + toggle Lista; **arrastar avança a etapa** (persiste+toast); clicar etapa na sidebar foca a coluna.
- Verificado no preview: sem erro de console; contagens, drag, foco, colapso e Lista OK.

## ✅ BUG DO UPLOAD — RESOLVIDO, DEPLOYADO e CONFIRMADO E2E no PDF real (01/07)
**Causa:** o gargalo era a **SAÍDA**, não a entrada. PDF real (`~/Downloads/OUTLIERS - GUSTAVO JUCA.pdf`, 11 págs, 3 LPs) = **15.782 chars / ~3.945 tokens de ENTRADA (folgado)**, mas a saída (JSON de ~141 linhas, muitas ATRASOS com `motivo`/nomes longos) dá **~6.6k–9.9k tokens** e **estourava `MAX_OUTPUT_TOKENS=8192`** → `finishReason:MAX_TOKENS` → array não fecha → `extractJson()` null → "A IA não devolveu um JSON válido". Passava na amostra, quebrava no doc real.

**Fix (`supabase/functions/importar-relatorio-lp/index.ts`, commit `792bfe1` → mergeado na `main` via PR #6):**
1. `MAX_OUTPUT_TOKENS` **8192 → 32768** (flash-lite aceita até 64k).
2. Guarda: se estourar 32k, checa `finishReason==="MAX_TOKENS"` e devolve erro claro ("relatório grande demais, divida") em vez de "JSON inválido".

**DEPLOYADO** via dashboard Supabase (Chrome MCP: editor Monaco `setValue` com código do GitHub raw → Deploy updates). Timestamp confirmou "a few seconds ago".

**✅ CONFIRMADO E2E** — chamada real à função deployada com o texto do PDF real (sessão logada `juca@segurocomjuca.com`) retornou `ok:true`: **141 registros em 10 quadros**, confiança **alta**, 0 avisos. Por tipo: ATRASOS 34 · STATUS_T 37 · ANIVERSARIO 26 · DATAS_IMPORTANTES 42 · PENDENCIAS 2. 3 LPs (GUSTAVO JUCA 75 · DANIEL CRUZ 56 · REBECA FERRAZ 10). Campos certos: `premio` número, acentos OK, datas `YYYY-MM-DD`. **141 linhas saíram inteiras** = prova de que o corte em 8192 morreu. ⚠️ Gemini free tier deu vários **502 "alta demanda"** transitórios antes de passar (documentado; reseta por minuto) — NÃO confundir com bug.

## ✅ FRENTE 2 — LPDB → Supabase (PR #7 mergeado, 01/07) — CONCLUÍDA
Persistência trocada de localStorage → tabela `lp_relatorio_itens`. Merge-snapshot (preserva status por chave) segue client-side em `lpIngest`; mudou só onde grava.
- **Supabase = fonte da verdade quando logado** (`LP_REMOTE`); localStorage = fallback (preview/deslogado). `lpCarregar` async lê do banco e re-renderiza.
- `lpPersistRemoto` faz upsert **só dos grupos `(entidade,lp)` tocados** pelo upload → não sobrescreve outro LP. `lpSetStatus` faz update remoto por `(entidade,lp,chave)`. "Carregar exemplo" zera `LP_TOUCHED` (nunca vai pro banco).
- **Migration RODADA** no Supabase (SQL editor, role postgres: "Success. No rows returned"). **E2E completo no app deployado:** ingest→upsert→reload→lê do banco→reconstrói rec; linha de teste limpa depois. Verificado tb local (round-trip, preservação de status no re-ingest).
- ⚠️ RLS = authenticated-full (todo logado vê tudo; isolamento por-LP fica pra fase de identidade `lp_email` — policy já comentada na migration). Ver [[crm-captacao-rls-pendente]].

## ✅ COWORK §4 — FECHADO (01/07, decisões do Gustavo)
Front dos 3 levers resolvida. Só o §4.2 exigiu mudança de código; o resto ele confirmou os stubs como finais.
- **§4.2 (data da faixa) — REESCRITO.** Regra real do Gustavo: a janela pra alterar a apólice fecha no **PRIMEIRO** de dois marcos — (a) cobrança do **2º prêmio** ou (b) **30 dias corridos DA EMISSÃO**. O que vier antes encerra o prazo (2º prêmio cobrado já perdeu, mesmo sem 30 dias). Trocado o stub `FAIXA_CAMPO='data_2o_premio'` (com fallback) por `statusTPrazoDias(rec) = min(data_2o_premio, data_emissao+30d)`; `data_30dias` vira só fallback quando não há emissão. `lpFaixa` passou a usar esse mínimo. Subtitle do Status T atualizado. Cortes mantidos: Excedido <0 · Crítico ≤7 · Alerta ≤15 · Atenção ≤30.
- **§4.1 (motivo→script) — MANTIDO.** Os 6 provisórios (`MOTIVO_REGRAS`+`LP_ACOES`) ficam como estão.
- **§4.3 (janela aniversários) — MANTIDO.** `JANELA_DIAS=15`.
- **Verificado no preview (lpvendas:8760):** 0 erro de console; 7 casos unitários do `lpFaixa` batem (inclui "2º prêmio cobrado→excedido mesmo sem 30d" e "prêmio longe→30d-da-emissão manda"); view Status T renderiza 5 apólices ordenadas por urgência com o novo subtitle. Screenshot confirmou (ex.: Paula Rios "em 29d" puxada pelo marco de 30 dias, não pelo 2º prêmio 22/08).
- ✅ **DEPLOYADO (01/07):** commit `8ab9077` na `feat/lp-supabase` → **PR #8 mergeado na `main` (`7845f13`)**. Client-only (`vendas.html`, sem Edge Function), GitHub Pages serve de `main`. Base do branch (PR#7) já estava em main; diff limpo, só §4.2 do `vendas.html`. Falta só o Gustavo validar na prática (logado ou "Ver com dados de exemplo" → módulo Status T).

## ✅ IMPORT ROBUSTO — parser local (sem IA) + 2 caminhos + Edge Function resiliente (01/07)
**Contexto:** upload do PDF real dava "A IA está com alta demanda". Diagnóstico (workflow + verificação adversarial): **NÃO é bug de build nem do PDF** — é o Gemini free tier devolvendo **429 (cota) / 503 (sobrecarga)**; a msg juntava os dois e "tente em instantes" mente quando é cota **diária** (RPD, só reseta meia-noite PT). Reclicar piora.
- **Decisão do Gustavo:** NÃO pagar Gemini por uso. Manter **lógica de texto (parser determinístico, sem IA)** como caminho principal agora; depois aprofundar como usar **IA inclusa no plano/Workspace** (não pay-per-use). Evoluir a IA depois.
- **PR #9 (main `7bce59a`) — parser + 2 caminhos + endurecimento (client, `vendas.html`):**
  - `lpParseTexto`: parser determinístico do relatório Prudential. Segmenta por título `{TIPO} - {LP}` (título vem ABAIXO da tabela, tolera data na frente), âncoras fortes (proposta `/^T?\d{8,9}E$/` aceita apólices "T...", apólice, telefone, prêmio, datas, keywords Ativa/Mensal). Datas→ISO, prêmio→número. **Nunca perde linha em silêncio** (avisos+confiança). Nomes iguais separa; `segurado≠pagador` colados → marca `_revisar` + aviso (limite honesto do texto sem coluna). **Validado no browser contra o relatório real (DANIEL CRUZ): 36 STATUS_T (T-prefix incl.) · 9 ATRASOS · 8 ANIVERSARIO · 1 PENDÊNCIA · 0 perdidas.**
  - Modal com **2 abas** (📄 Subir PDF · 📋 Colar texto), fim do `<details>` escondido. Fluxo: texto (colado ou pdf.js) → parser **local**; se ok, ingere SEM IA; senão cai pra Edge Function.
  - Endurecimento: cooldown 45s no botão após 429/503 (para de queimar cota), guard de texto-vazio, mensagens honestas por `motivo`.
- **PR #10 (main `fbf6e2d`) — Edge Function resiliente (`importar-relatorio-lp/index.ts`) + DEPLOYADA no Supabase:** backoff exponencial+jitter (4 tentativas, teto 8s), honra Retry-After/RetryInfo, classifica corpo do erro (429-RPD **não** retenta → `motivo:cota_diaria`; RPM/TPM/503 → `sobrecarga`), AbortController 30s. Devolve `motivo` pro cliente. **Deploy via dashboard Supabase (Chrome MCP: Monaco setValue com raw do GitHub main → Deploy updates → confirmado "a few seconds ago", badge M limpo).** Projeto ref `kbiinfpjfmuidyzsfegp`.
- **Limitação honesta:** texto colado perde a fronteira de coluna → `segurado≠pagador` (poucas linhas) não separa sozinho; ficam marcadas `_revisar`. Melhoria futura: preservar gaps de coluna no `lpPdfText` (pdf.js) → separaria nomes no caminho PDF.

## 🗺 O QUE FALTA NA LP
1. **IA "de graça" via plano/Workspace** (frente futura pedida pelo Gustavo): integrar leitura por IA usando o que já é incluso no plano/contexto do Workspace, em vez de Gemini pay-per-use — pro fallback e pra resolver os `_revisar`. Só quando formos aprofundar.
2. (Opcional) Preservar colunas no `lpPdfText` (gap de x no pdf.js) pra separar `segurado≠pagador` no caminho PDF.
3. (Opcional) Isolamento por-LP no RLS quando entrar identidade real (`lp_membros`/`lp_email`).

## ⚠️ PARALELISMO (LP ↔ Captação) — não dar conflito
- Branch própria por sessão; `git fetch` antes de deployar.
- LP = `vendas.html` + tabelas `vendas_*`/`lp_*`. Captação = `index.html` + `leads`/`lead_events`/`mining_sessions`/`app_users`. **Nunca editar `index.html`.**
- `app_settings` é o único ponto compartilhado: se usar, chaves prefixadas `lp_`, sem mexer nas existentes.
- Cuidado com docs compartilhados (`ESTADO_DO_PROJETO.md`, `CLAUDE.md`) — por isso o estado da LP mora AQUI, separado.
- Memórias: [[crm-captacao-visao-lp]] (detalhe), [[crm-captacao-uma-sessao-por-visao]] (regra).
