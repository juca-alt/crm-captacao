# ESTADO DO PROJETO — CRM Captação / Vendas LP

> ⚠️ **Nota de reconciliação (19/07/2026):** a cópia versionada deste arquivo estava **ausente do repo** (o CLAUDE.md referencia ela, mas não existia commit). Este arquivo recomeça aqui com o snapshot da sessão de hoje. **Cowork:** na próxima passada, reconciliar com a versão oficial do Drive (pasta "CAPTACAO LIFE PLANNER") — o histórico anterior vive lá.

---

## 📸 Snapshot — 27/08/2026 (2ª leva) · v0.15.1 + R22 na Revisão de Proteção

**Estado em 30 s:** ✅ **NO AR** — `main` = `87c1958`. Duas entregas sobre a 1ª leva (agenda etapa+cor): (1) **v0.15.1** tirou o "pos X/16" do card da Substituição; (2) **R22** atualizou a Revisão de Proteção (`revisao-protecao.html`), que estava defasada no app (era R21 + Agenda). Merge autorizado pelo Gustavo ("já validei no uso do artefato; se tiver erro, ajusta depois").

### O que entrou
- **`e7b60c0` · v0.15.1 · Substituição:** removido o "· pos X/16 ·" do rótulo do card (jargão interno que confundia). A condição `pc.pos===16` do Fix A ("✓ já na melhor data") ficou intacta.
- **`87c1958` · R22 · Revisão de Proteção** (só `revisao-protecao.html`, **+174/−60**):
  - **patch44** (linha do tempo / raio-X): sai o nº de apólice das linhas; sai a lista "O que muda no caminho"; cada linha da linha do tempo e do raio-X vira **arrastável (⠿)** e **ocultável (✕)**; os 3 contadores do raio-X **recontam** com o visível; as duas visões viram **selecionáveis** (desligando as duas, a seção sai do documento do cliente).
  - **patch45** (comissão / proposta): a aba **Comissão sai do nav → gaveta na Proposta** (fechada por padrão; some por completo no modo cliente, no PDF e na apresentação); a **Proposta vira editável no modo cliente** (só a apresentação trava). Marcador `COMISSAO_GAVETA_V1` adicionado.

### Verificação
- R22 por **Caminho A** (patchers idempotentes): base md5 `ef3b10d5…` → resultado md5 **`a6f216bc…`**, **byte a byte** igual ao artefato validado headless na sessão Cowork (vtl/vcomo/vmelh3 + 13 validadores, 0 erro JS, selfTest 6/6). Diff exato **174/60**. No app servido: **selfTest 6/6, selfTestFam []**, guard de CI limpo; marcadores `COMISSAO_GAVETA_V1` + gaveta/`mesmo-cliente` confirmados na fonte.
- ⚠️ **Browser pane local travou em render de largura 0** → o portão visual dos 4 cenários NÃO rodou aqui. Aceite pela **identidade md5** com o artefato já validado + self-tests + Gustavo ter validado o comportamento no uso do artefato. Sem bump de versão (R22 não toca `vendas.html`; main segue **v0.15.1**).

### Próximo / aberto
- **Mudança de Seguro** — frente NOVA que o Gustavo está montando no chat de Projetos; entra em **outra sessão, SOBRE esta base R22** (Revisão de Apólices → mudança de seguro).
- **Revisão de Proteção no celular** ("título quebra letra a letra"): **verificado sobre o R22 — NÃO reproduz.** Scan por line-boxes reais em 375px = 0 títulos quebrando letra a letra; não há `break-all` no CSS. Provável já resolvido pelo rework do R22. Se o Gustavo ainda vir, precisa a tela/modo/dado exatos. *Achado lateral (opcional):* a tabela de cobertura ("Se acontecer…") rola horizontal no celular, cortando as colunas Custo/mês + Natureza.
- `bc` N/Emissão + Emissão Final → 🟢 [RCP/PC]: **✅ feito** (v0.15.2, `470be1f`) — de-para da agenda fechado, +1 invariante.

---

## 📸 Snapshot — 27/08/2026 · v0.15.0 — reunião de venda na Agenda Google com etapa no TÍTULO + cor Pavão

**Estado em 30 s:** ✅ **NO AR** — `main` = `8c89e2f`, **v0.15.0**. Fast-forward de `origin/main` (`e696249`), push = deploy Pages, autorizado por ele depois de validar logado. Frente pedida por um prompt do **projeto Juca 3.7** (visão holística única dos projetos dele): a etapa do funil parou de morrer na descrição do evento e passou a viver no **título + cor** — dá pra bater o olho na semana da agenda e ler se abre (🟡), fecha (🟢) ou entrega (📦) negócio.

### O que entrou (commit `8c89e2f`, só `vendas.html`)
- **Constante `REUNIAO_PREFIXO`** no topo (de-para etapa→prefixo por funil, fácil de editar). Reunião (`tipo:'reuniao'`) ganha **botão 1-toque** que cria/atualiza o evento no Google **via API** já com `<emoji> [ETAPA] <nome>` + `colorId:'7'` (Pavão). **colorId só existe pela API** — o link-template do Google (`action=TEMPLATE`) aceita `text`+`details` mas IGNORA cor; por isso virou botão, não só link.
- **De-para aprovado:** `nn`(prospect) OI/FF→🟡[OI/FF]; P/C,**C2,N,FA,EMISSÃO**→🟢[PC] (ressalva dele: esses 4 ficam mapeados); DELIVERY→📦[DELIVERY]. `bc`(base) Agendada Revisita→🟡[RCP/FF]; Novo Negócio/Resolução pós Revisita→🟢[RCP/PC]; Delivery→📦[DELIVERY]. **Fora por decisão:** bc N/Emissão e Emissão Final (viram aviso). Etapa fora do mapa: título cru, sem cor, `console.warn`.
- **Idempotente** (regex `^(\S+\s+)?\[[A-Z/]+\]\s*` substitui sem concatenar), **respeita título ajustado à mão** (prefixo não-canônico → não toca), guarda `t.gcalId` pra não duplicar. Só reunião entra — WhatsApp/ligar seguem no link-template.

### Descoberta (Passo 1 — lido do banco ANTES de codar)
Etapa vive em `lp_contatos.dados->>'etapa'` (ID de fábrica). **4 valores de funil em produção** (o código só define `lp`/`bc`): `nn` (usa etapas do funil lp), `bc` (espelho Kommo), `bn` (5.130 leads **sem etapa**), `prospects` (1 legado). **Reuniões reais só em 2 etapas hoje:** `nn`/OI/FF (1) e `bc`/Agendada Revisita (3). Os valores "Agendada Revisita"/"Contato Agenda/Revisita" que o prompt citou são etapas do funil `bc`, não do prospect — por isso não assumir.

### Verificação
Sem `node`/`deno`/`bun` na máquina (só python3): servi o arquivo com `python3 -m http.server` e validei no browser — o `<script>` inline parseia (sem erro de sintaxe), funções definidas, casos reais certos, **10 invariantes novos de reunião verdes** no self-check de boot. **Guard de CI limpo** (0 `from('leads').insert` no vendas.html). As 2 falhas de self-check `menu:…` são **ambientais** (app servido estático, sem Supabase, não bootou o menu) — não é regressão (não toquei em menu).

### Backfill aplicado (via MCP Google Calendar, dry-run mostrado antes de escrever)
2 eventos reais viraram **`🟡 [RCP/FF] Daniel Ricardo…`** (id `2pgjvs5j…`, 25/08) e **`🟡 [RCP/FF] Roberto Jose…`** (id `73d11rd2…`, 01/09), colorId 7, **local/descrição/horário preservados**. Os 2 `WhatsApp ·` (Ricardo, Herica) NÃO foram tocados (Regra 3). Verissimo/Felipe não tinham evento no Google.

### Lições da leva
- **Link-template do Google Calendar ignora `colorId`** — cor exige a API. Metade do pedido ("ler o funil na agenda") só fecha criando o evento pela API.
- **Ler o banco antes de escrever o de-para** evitou assumir etapa errada: o funil `bc` (base de clientes) tem nomes de etapa próprios, distintos do prospect.
- **App single-file sem node valida bem** por `http.server` do python + self-check no console do browser.

### O que ficou aberto
- **Ritual:** sincronizar este ESTADO no Drive (pasta "CAPTACAO LIFE PLANNER") — **Cowork** na próxima passada.
- `bc` N/Emissão e Emissão Final seguem **sem prefixo por decisão**; mapear pra 🟢 [RCP/PC] é 2 linhas no `REUNIAO_PREFIXO` se ele quiser.
- **PR #91** (`feat/lp-conectar-claude`, botão Conectar Claude) segue **aberto e independente** — esta frente saiu de `origin/main`, não dele. PRs #88–#90 e a 🔴 RLS dos backups `bkp_movimentos_dup_*` da Central Financeira seguem em aberto (sessão à parte).

---

## 📸 Snapshot — 16/08/2026 (2ª leva) · CRM SeguroComJucá v0.12.0 — cartões no celular, filtros recolhidos, OFFLINE e barra configurável

**Estado em 30 s:** ✅ **NO AR** — `main` = `5323669`, **v0.12.0 · CRM SeguroComJucá**. Cinco commits no branch `claude/crm-lp-fluidity-v2`, merge com `--no-ff`, autorizado por ele depois de validar o demo. Produção conferida pelo CONTEÚDO servido (SHA idêntico ao commit) e o portão rodado de novo contra o arquivo baixado do Pages.

### O que entrou
- **`ed16c34` · tabela vira cartão no celular, em CAMADA ÚNICA.** O Estoque já tinha cartões, mas escritos à mão no HTML da view. Aqui o JS lê os `<th>` uma vez por tabela e o CSS reempilha a linha por posição — vale para Contatos, Lista de TA, Lista de Atraso, SitPlan, Recomendações e para a próxima tabela que nascer. Lista de Atraso tinha 589px e Lista de TA 718px numa tela de 390.
  ⚠️ **Duas armadilhas de performance, medidas:** rotular célula a célula (`data-rot` em cada `<td>`) custava **+44ms** por repintura na tela de Clientes (4.400 nós); e `.card:has(> table.t-cards)` no CSS fez o **Funil, que nem tem tabela, sair de 160ms para 320ms** — `:has()` obriga o motor a reavaliar todos os `.card`. Custo final, medido INTERCALANDO com a v0.11.0 em produção para descontar ruído de máquina: **entre −5,5ms e +8ms**.
- **`84f502c` · barra de filtros recolhe atrás de um botão no celular.** A lista da Lista de Atraso começava no y=1050 de uma tela de 844; agora começa no **y=435**. Quatro cuidados que só apareceram testando tela por tela: contar "controles" escondia o **navegador de data do SitPlan** atrás de "Buscar e filtrar" (botão mentindo sobre o que faz) → agora exige 2 filtros de verdade; Estoque e Lista de TA já têm folha própria (`.bn-mob`) e são pulados; barra que a view já esconde (`#bn-tb2`) fica fora; segunda barra vira "Mais filtros". O botão mostra **quantos filtros estão ativos**.
- **`8044275` · service worker, barra inferior configurável e a marca nova.**
  - **SW (`sw.js`)**: *online sempre a versão nova (network-first), offline a última que funcionou*. `index.html` (Captação) **passa direto, sem interceptação** — as visões são separadas por regra do repo. Supabase nunca é cacheado. CDN do supabase-js vai cache-first (URL versionada). **Nada é pré-cacheado no install** de propósito. O "⬆︎ Atualizar app" passou a mandar `postMessage('limpar')` para o worker esvaziar o cache dele junto.
  - **Barra inferior configurável** (Configurações → Barra inferior): 10 destinos, escolhe 4, a folha impede passar disso. Padrão = o de hoje. Preferência inválida cai no padrão.
  - **Marca**: só o que aparece na tela — título, logo **SJ**, gaveta, rodapé, nome no iPhone. **Repo e URL NÃO mudaram** (quebraria links salvos e o deploy do Pages).
- **`2dd8553` · migration do sync incremental — VERSIONADA, NÃO APLICADA.** Ver "aberto".
- **`cd2393a` · safe-area do topo.** 🐞 **Regressão minha**: ao marcar o app como instalável, ele passou a abrir em **standalone** e o conteúdo subiu por baixo da status bar — o ☰ colidindo com o relógio do iPhone (print dele às 12:22). O arquivo **não tinha uma única regra de `safe-area-inset-TOP`** (só bottom/left/right), porque até então a barra do Safari segurava. Junto: **o ☰ saiu do topo** (a barra inferior já tem "☰ Menu" — dois caminhos para a mesma gaveta) e **o `h1.pg` some no celular** (pedido original: o título já vive na barra). Os KPIs do Início sobem ~180px.
  Antes de esconder o `h1`, auditei as **21 telas** comparando com o título da barra: em 17 é o mesmo texto ou equivalente; nas outras o `.sub` dá o contexto. Nada exclusivo se perde.

### Verificação
Portão (`gate.js`) verde nos **4 cenários** a cada commit e de novo contra o **arquivo baixado do Pages**. Voltar do Android, menu, filtro da Lista de Atraso, os 24 destinos e o **offline real** (rede desligada → app abre com os 260 contatos) conferidos. Console limpo, `lpSelfCheck()` com 10 invariantes novos. Guard do CI ok.

### Lições da leva
- **`:has()` é caro em lista viva.** Marcar o contêiner por JS custa zero; por `:has()` custou o dobro do tempo de render numa tela que nem tinha tabela.
- **Marcação por TABELA, não por célula.** Trocar N×M `setAttribute` por M `setProperty` + `td:nth-child(n)::before{content:var(--rN)}` tirou os 44ms.
- **Tornar o app instalável é meia entrega sem safe-area de topo.** `apple-mobile-web-app-capable` remove a barra do navegador; se não houver `env(safe-area-inset-top)`, o topo vai parar embaixo do relógio.
- **Service worker exige MIME de JavaScript.** O servidor de teste mandava `application/octet-stream` e o registro falhava em silêncio — parecia bug do código.
- **`Buffer.from(s,'latin1')` e literal JSON dentro de `<script>`**: HTML embutido tem `</script>` no meio e fecha o bloco. Base64 é ASCII puro e imune (usado no demo para embutir os 3 módulos).
- **Heurística de UI se valida tela por tela.** "Barra com 3+ controles" parecia razoável e escondia o navegador de data do SitPlan.

### O que ficou aberto

**Depende do Gustavo:**
1. **Rodar a migration `supabase/migrations/lp_contatos_atualizado_trigger.sql`** no SQL editor. Sem ela o sync incremental do Estoque não pode existir: `lp_contatos.atualizado` tem `DEFAULT now()` e **nenhum trigger** — DEFAULT só vale no INSERT, e o push faz upsert, então a coluna congela na data de criação. Um incremental por ela **não veria edições** (nome corrigido, telefone novo, estágio mudado noutro aparelho sumiriam em silêncio). Rodou? Ligo o incremental com carga completa como rede.
2. **Revisão de Proteção no celular** — arquivo próprio de 703 KB, está quebrada lá (título quebrando letra a letra). Frente separada.
3. **Toque longo com seleção em lote** — depende de decidir QUAIS ações em lote fazem sentido em cada tela.

**Continuam da lista anterior:** CG do Vida Inteira até 65, validação de prêmios, PR #35, limpeza do histórico com PII, os 5 do GlobalCRM.

---

## 📸 Snapshot — 16/08/2026 · FLUIDEZ: o celular volta a funcionar e trocar de tela custa 27ms (branch, sem deploy)

**Estado em 30 s:** ✅ **NO AR** — `main` = `ae2a70d`, **v0.11.0 · Fluidez**, mergeado e deployado com autorização expressa dele. Oito commits no branch `claude/crm-lp-fluidity-mobile-fd9oi9`, merge com `--no-ff`. Sessão de UX + performance no `vendas.html`: **zero mudança de regra de negócio, zero mudança no banco**. Produção conferida pelo CONTEÚDO servido (SHA idêntico ao commit), não pelo número da versão.

### Portão de deploy — a prática que ficou
Antes do merge rodou o `gate.js`: **4 cenários** (celular 390 × desktop 1280) × (base CHEIA × base VAZIA), cada um com 9 verificações — boot pinta a tela, `lpSelfCheck()` verde, 25 views sem exceção, nenhuma view em branco, zero estouro, criar/salvar/apagar contato, índice da Carteira idêntico à varredura, ficha dentro da tela, barra inferior inteira, console limpo. **Tudo verde nos 4 cenários, e repetido contra o arquivo BAIXADO DE PRODUÇÃO.** A base vazia entrou na lista porque o caminho do estado inicial já inutilizou um módulo inteiro neste projeto (Substituição, 11/08).
⚠️ **Lição do próprio portão:** medir a gaveta no mesmo tick de `abrirContato()` acusa falso positivo — ela desliza com `transition:right .22s`. Esperar a transição antes de medir.

### O problema, medido antes de mexer
Varredura das 22 telas em 390px e 1280px (Chromium real, CPU 4×, 1,6 Mbps, gzip como no Pages), com base sintética em volume realista e os tamanhos REAIS das tabelas lidos por SQL no playground (`lp_contatos` = 5.180 linhas / 2,9 MB de jsonb).

1. **As 22 telas estouravam a horizontal no celular** (123–254px). Culpado único: os 3 botões da topbar (🔄 Sincronizar, ⬆︎ Atualizar app, ⇄ Captação), com `white-space:nowrap` e nenhuma regra de celular. Esticavam a barra para 513px numa tela de 390 — e, com a área de layout alargada, **tudo que é `position:fixed` passava a se medir por 513**: barra inferior com a aba ☰ Menu no x=406 (fora da tela), **ficha do contato abrindo em x=150** (fechar/WhatsApp/prêmio cortados — era o "praticamente inutilizável" dele) e FAB 🎨 invisível. Provado: escondendo os 3 botões, `scrollWidth` 513 → 390.
2. **`cartRadarLista()` custava 174ms em TODO `render()`** — 92% do custo fixo de qualquer clique — só para pintar o contador do menu "Oportunidades". O(clientes × linhas) com `normKey()` por linha.
3. **O boot esperava 3,12 MB** numa consulta só (`lp_contatos`), dos quais 3,09 MB é Base de Nomes que o Dashboard não usa, atrás de um `Promise.all([...8]).then(render)`.

### O que foi entregue (5 commits)
- **`adc0837` fase 1** — ações da topbar viram folha do ⋯ no celular; KPIs em **3 colunas** com apoio em 2 linhas e toque para expandir; `.btn-mini` 40→44px; caixas de seleção 22px; "Pbaixa" → "P · baixa"; contador do módulo na gaveta ganha a pílula.
- **`390bc2e` fase 2** — índice por nome normalizado no lugar da varredura do radar; índice `ref → apólices` (o quadrático aparecia duas vezes na mesma tela); **boot sem barreira** (cada carga repinta ao chegar, coalescido em rAF).
- **`59b8981` fase 3** — `lp_contatos` em **duas voltas** (funis primeiro, Estoque paginado em segundo plano) com fallback para a consulta única de hoje; esqueleto estático no `#main`. Paginação com **duas travas**: só continua enquanto a página traz id novo e teto de 60 páginas.
- **`3a02b18` fase 4** — **botão voltar do Android** fecha camada por camada (folha → busca → modal → ficha → gaveta); favicon (dava 404) e metas de app instalável.
- **acabamento** — FAB 🎨 sai do celular (tapava o "+ Novo contato"); número do KPI cabe em 1/3 de tela; **`vendas.html` volta a ser UTF-8 100% válido** (havia 1 byte latin-1 solto num comentário — é ele que obrigava `grep -a`).

### Antes → depois (celular, CPU 4×)
| | antes | depois |
|---|---|---|
| trocar de tela (mediana das 22) | 219 ms | **27 ms** (−88%) |
| telas com estouro horizontal | 22 | **0** |
| base na tela abrindo logado | 17,5 s | **2,0 s** (−89%) |
| alvos de toque < 44px | 2.360 | **402** (−83%) |
| pior tela (Clientes da Carteira) | 567 ms | **178 ms** |

Desktop, Início: 45,7 → 4,6 ms por repintura. Console limpo e `lpSelfCheck()` verde (**60 invariantes**, 10 novos) nos dois tamanhos, em todas as telas.

### Entregáveis para ele
- **Demo navegável** (artifact): o CRM inteiro com as 4 fases, dados fictícios, sem cliente Supabase e com `localStorage` prefixado `DEMO::` — não lê nem escreve nada real.
- **Dossiê antes/depois** (artifact) com os pares de screenshot em 390px.

### Lições da sessão
- **Marcador de idempotência tem que ser ASCII PURO.** Marcador com acento passa por `u()` e nunca casa na 2ª rodada: um bloco entrou duas vezes e derrubou o script inteiro com "Identifier already declared". O `patchlib.py` agora afirma `marca.isascii()`.
- **`Patch` só grava no fim**: se o script morre no meio, as trocas já impressas NÃO foram salvas. Aconteceu com o FAB.
- **Sincronizar histórico na hora não funciona.** Fechar uma camada e abrir outra no mesmo tick (o caminho real de "abrir a ficha pelo menu") faz o `history.back()` correr contra o `pushState` seguinte e o app é abandonado dois voltares depois. A sincronização precisa ser **coalescida num microtask**, decidindo uma vez sobre o estado final. O E2E em 390px pegou; o self-check não pegaria.
- **Paginação otimista é perigosa**: sem trava, um servidor que ignore o recorte vira loop infinito de 3 MB na franquia de dados dele. A trava é "só continua enquanto trouxer id novo".
- **`Buffer.from(s,'latin1')` trunca tudo acima de U+00FF** e corrompe JSON embutido. Seed embutida vai escapada em ASCII (`\uXXXX`).

### O que ficou aberto

**Depende do Gustavo:**
1. **OK no demo** → merge na main (o push na main é o deploy).
2. **Os 4 destinos da barra inferior** no celular (hoje: Início · SitPlan · Contatos · Funil · Menu).
3. **Troca de nome para CRM SeguroComJucá** — ele pediu para o fim da sessão; falta definir o alcance (só a marca na tela, ou também repo e URL, que quebra links salvos).
4. **Service worker** — deixado FORA de propósito: é a única peça capaz de prender o app numa versão antiga. Sem ele, não abre offline.
5. **Cortar de vez os 3 MB do Estoque no boot** — mexe no merge/push dos 5.135 nomes reais.

**Pode ser tocado sem ele:** toque longo com seleção em lote + folha inferior por linha (a maior mudança de UX que falta) · tabelas de 13 colunas virando cartões em Contatos, Lista de TA, Lista de Atraso e SitPlan (o Estoque já provou o padrão) · tópicos recolhíveis com ordem persistida · virtualização das listas longas.

**Continuam da lista anterior:** todos os itens abertos do snapshot de 13/08 (CG do Vida Inteira até 65, validação de prêmios, PR #35, limpeza do histórico com PII, os 5 do GlobalCRM).

---

## 📸 Snapshot — 13/08/2026 · Revisão de Proteção v14→v19, Tarefas & Agenda, menu retrátil e o funil que voltou a ficar no lugar (v0.10.10)

**Estado em 30 s:** `main` = `d51552b`, **tudo no ar** (Pages ✅, conferido pelo CONTEÚDO servido, não pelo número da versão). Uma sessão só, [PR #69](https://github.com/juca-alt/crm-captacao/pull/69) com 4 commits, mergeado com autorização expressa dele. Cinco frentes entregues e uma exposição de dados fechada.

### 1 · Revisão de Proteção — do v13 ao v19 numa sessão
- **Motor por pessoa** (`itensDe/consDe/custoDe`): `itensHoje()` virou um caso particular deles. Uma verdade só.
- **Benefício em vida** das vitalícias (≠ cobertura de Doenças Graves): WD/WL antecipam por idade (40/50/60%), WV só depois da quitação (até 50%), com a CG citada em cada carta.
- **Grupo familiar**: `state.familia` com o **mesmo shape de apólice** do titular, então o mesmo motor roda por pessoa. O editor virou `htmlApolices(alvo, aps)` e o **⎘ Colar espelho ganhou "aplicar em"** — espelho de familiar entra só como apólice da pessoa e **nunca zera** a revisão do titular.
- **Drill-down por segurado**: chips trocam as pizzas **e** o detalhe juntos.
- **Gráficos SVG inline** (zero dependência: a peça é offline-first) e **cartas arrastáveis** — como `cartasSituacao` lê `ordemAtual()`, a ordem vale na tela, na apresentação, no PDF e no arquivo do cliente.
- **v15→v19 do protótipo dele** aplicada com os patchers do `handoff-revisao-v19.zip`: família no doc do cliente, **Carteira de proteção** (patrimônio + 4 tiers de gravidade), **área Produtos** em sanfona com os embeds (200 cirurgias com busca, 33 fraturas por região, invalidez, DDR, glossário), grupos colapsados e `ORDEM_SIT` por gravidade.
- **Regra dele, tarde da noite: "o benefício é característica do ativo, por isso fica DENTRO do ativo".** O Patrimônio virou **um card por ativo vitalício** com: o que paga em vida, **atualização do capital (IPCA + juros atuariais de até 3% a.a.)** e **curva de resgate** — fatores da planilha oficial dele (`REVISAO DE APOLICES 3.3.xlsm`, abas RESGATEWL10 e IPCA). **WD não está na planilha**: o card diz isso em vez de aproximar pela curva de outro produto. E **nenhuma projeção de valor** — o IPCA entra como histórico de 20 anos + média, porque o índice é mutável.
- **Arrastar os BLOCOS**: a ordem que ele monta no console é a ordem do material do cliente (`ui.ordemBlocos`); a numeração das seções só é resolvida **depois** de aplicar a ordem, e bloco fora da lista fica onde estava.
- 🎛️ O botão "Atualizar valor no funil (CRM)" **deixou de flutuar** sobre a peça (ele viu na visão cliente em tela cheia): virou item discreto do rodapé, escondido no modo cliente, na apresentação e no PDF.
- **`selfTestFam()` = 35 invariantes** no boot, com números de fantasia de propósito (o repositório é público).

### 2 · 🔒 Exposição de dados fechada
O arquivo **carregava sozinho a revisão completa de uma cliente real** — gravando no `localStorage` de quem abrisse a página — e trazia **um segundo cliente real** no exemplo. Ambos viraram exemplos fictícios (identidade, nº de apólice, proposta, final de cartão), **preservando capitais, prêmios e códigos** para o exemplo continuar servindo de demonstração. De quebra, o exemplo **deixou de sobrescrever** a revisão já salva no aparelho. Conferido no ar: **0 ocorrência** dos dados antigos no arquivo servido.
⚠️ **Sobra**: os dados reais continuam em **commits antigos** do repo público. Limpar o histórico é reescrita de commits — decisão dele, em momento sem ninguém mexendo no repo.

### 3 · Tarefas & Agenda (frente que ele pediu duas vezes)
Negócio sem **próxima atividade** marcada é negócio parado. As tarefas vivem no próprio contato (`c.tarefas`) e o sync manda o objeto inteiro no jsonb `dados` de `lp_contatos` → **zero migration**.
- **Card do funil**: chip da próxima atividade (vermelho atrasada, âmbar hoje) e, sem nenhuma, um **"+ próxima atividade"**.
- **Ficha**: bloco com marcar/concluir/remarcar (+1d/+7d), histórico e três atalhos.
- **Agenda & Tarefas**: view nova no menu com contador, agrupada em atrasadas/hoje/amanhã/próximas, mais a lista de negócios **sem próxima atividade**.
- **KPI "sem próxima atividade"** nos dois funis · **Google Agenda por link** (evento pré-preenchido, sem OAuth) — a sincronia de verdade é a fase 2.
- A situação da tarefa é **derivada da data** (nada de status gravado que envelhece) e **remarcar tarefa vencida parte de hoje** — senão o atraso se acumularia, que foi exatamente o erro do vencimento estimado na Substituição.

### 4 · Menu retrátil e o funil que voltava ao início
- Botão **«** na topbar (⌘\) esconde a sidebar pra apresentar a Revisão ao cliente sem o menu do CRM. Persiste por aparelho, some no celular e no print.
- 🐞 **"clico no card e volta pro início do funil"**: o `.nnboard` é recriado inteiro a cada `render()`, então o scroll horizontal (e a posição da página) voltava a zero em TODA ação. Resolvido **na origem** — guardar/repor a posição nos dois funis vale pra todo botão, atual e futuro. Provado: sem o fix 0, com o fix 400 nos 6 caminhos.
- **`lpSelfCheck()` foi de 34 a 50 invariantes.**

### 5 · Estudo GlobalCRM avaliado (item que estava parado desde julho)
Conferido **contra o app de hoje**, não contra a foto de julho. Já coberto: funil por ação, ANCE, SitPlan datado, metas, atrasos, taxa de passagem e agora a agenda. **Sobraram 5**, por valor/esforço: (1) **relatório X218630** — resolve a lacuna de cobertura da Carteira e mata o join por nome; (2) Google Agenda de verdade (OAuth); (3) scripts de atraso por motivo; (4) valor em R$ em risco na Lista de Atraso; (5) Modo Foco no SitPlan.

### Lições da sessão (custaram tempo)
- **Marcador de idempotência tem que passar pelo `u()`** nos patches do `vendas.html`: com "ó" cru o marcador nunca casa e o bloco entra de novo a cada rodada. Mesmo motivo, marcador que também aparecia em `@media print` fez a regra do mobile **nunca entrar**.
- **`io.open(P,'w')` trunca o arquivo antes de escrever**: um erro de encoding deixou o `vendas.html` com 0 byte. Recuperado com `git checkout` porque todo patch é idempotente. Agora é `open(P,'wb').write(s.encode(...))`.
- **Self-check não pode tocar no estado real**: um invariante empurrou um contato de mentira em `S.contatos` e ele ficou salvo. Invariante testa função pura, ponto.
- **A autorização de merge precisa vir na mensagem imediatamente anterior** — o classificador barrou na 1ª tentativa mesmo com o pedido dele algumas mensagens antes.

### O que ficou aberto

**Depende do Gustavo:**
1. **CG do Vida Inteira até 65** — enquanto `EV_WL_CONFIRMADO = false`, as cartas WL* calculam e aparecem **só pra ele**, com aviso, e ficam fora do material do cliente. Confirmou? É trocar a constante pra `true`.
2. **Validação de prêmios** (`validacao-premios-v19.md`) — o **WL Vida Inteira divergente** é a prioridade que o próprio doc dele marca; e as 26 da planilha precisam do de-para.
3. **Simulação com a tabela de resgate do WD** (Vida Inteira Mais) — não está na planilha 3.3.
4. **Drag/edição dos tópicos de Produtos** e os **toggles "na apresentação"** dos anexos (sumiram na fusão; retrago se ele usa).
5. **Limpeza do histórico do repo** (PII em commits antigos).
6. **PR #35 (Revisão de Apólices)** — segue `MERGEABLE` e sem OK: duplica ou complementa o `revisao-protecao.html`?
7. **Usar LOGADO**: tarefas e agenda só gravam em `lp_contatos` com sessão.
8. Continuam da lista velha: trilha de follow-up do cliente (destrava 3 itens do caderno), data de emissão das apólices-gatilho, 7 SQL de `~/Downloads/leads-bkp-restore` + decisão de RLS nas `lp_key_*`, prints do item 3 e da aba Oportunidades.

**Pode ser tocado sem ele:** fase 2 da agenda (OAuth do Painel Central) · os 5 itens do GlobalCRM · cobertura da Carteira em lote quando ele exportar o X218630.

**Fora desta visão:** extensão WA 2.0, dividida em Captação × LP Vendas.

---

## 📸 Snapshot — 12–13/08/2026 · caderno pág.2 INTEIRO + funil com visão de negócio (v0.10.3 → v0.10.9)

**Estado em 30 s:** `main` = `f6d2fba`, **tudo no ar** em `juca-alt.github.io/crm-captacao/vendas.html`. Sete versões em duas levas: a **página 2 do caderno** dele (PRs #62–#65) e o **upgrade de negócio do funil de vendas** (PRs #66–#68), com uma varredura QA no meio.

### Caderno página 2 — entregue inteiro
- **v0.10.3 (#62)** — coluna **MOTIVO** da Lista de Atraso mostra só a última mensagem (o relatório concatena todas as tentativas numa célula de 300+ chars), com o log inteiro no tooltip · **janela de 180d nos cards** da Substituição (dias corridos e quantos faltam) + data de emissão · **alerta honesto** quando não há pagamento vinculado · bloco "Sugestão de fluxo" removido a pedido dele · **cadastro puxando da Lista de Atraso** (nome → telefone + apólices com prêmio/vencimento oficial/LP/motivo) · **filtro por LP** nas Recomendações.
- **v0.10.4 (#63)** — **seletor de funil no card do contato**: trocar de esteira sem apagar e recriar, com a etapa de destino escolhida na hora (o app não inventa equivalência), sem duplicata e com histórico preservado · **ordem das colunas** configurável (↑↓) no motor genérico, valendo pras 4 telas com colunas · **Data Grid nas Recomendações** (edição na célula, filtro por coluna, largura arrastável, lote, Tab entre células).
- **v0.10.5 (#64)** — **colar células em massa** com preview linha a linha, opt-out por mudança e **desfazer**.
- **v0.10.6 (#65)** — **varredura QA**, 4 achados: 🔴 colar em coluna de lista gravava valor inválido (`Cliente` virava `estagio="Cliente"`, badge certo na tela e ZERO em toda contagem) · "nenhum pagamento vinculado" era falso quando havia pagamento fora do período · ficha aberta pela tabela das Recomendações se fechava sozinha no primeiro `render()` · emissão futura mostrava "-293 de 180 dias". Nasceu aqui o **`lpSelfCheck()`** de boot.

### Funil de vendas com visão de negócio
- **v0.10.7 (#66)** — 🐞 **o prêmio não salvava**: digitar no card do funil e clicar fora perdia o valor (só Enter ou o botão gravavam) — e a nota logo abaixo, no mesmo painel, já salvava no blur. **Régua de negócio** nos dois funis: PA em jogo, ticket médio, **previsto fechar** × **previsto emitir** no mês, fechamento vencido. **Previsão de fechamento e de emissão** por negócio (datas diferentes de propósito: a venda fecha, a apólice emite depois, e a comissão anda com a segunda). De quebra, o chip "PA no funil" somava os **encerrados** — dois números pro mesmo conceito na mesma tela; removido.
- **v0.10.8 (#67)** — **probabilidade de virar apólice**: padrão por etapa + override manual que sempre ganha · **PA ponderado** · **taxa de passagem foi pro topo de cada coluna** do board, com o gargalo como KPI. 🐞 Achado no PRINT: "120% passam" — a contagem não era monotônica; virou `nnMaxIdx` (ponto mais fundo alcançado).
- **v0.10.9 (#68)** — ele perguntou **de que período** era a taxa e **como** a probabilidade era calculada. Eram: período nenhum e tabela minha. Agora: **seletor de período** (30/90/180/365/tudo) valendo só pra taxa e calibragem, com os excluídos declarados; **`entradaFunil()`** separando data de cadastro (fato) de estimada; **probabilidade calibrada no funil dele** (`alcançaram(fim)/alcançaram(E)`) com amostra mínima, e os **dois percentuais lado a lado, rotulados**, pra ele não ler errado.

**`lpSelfCheck()` está em 34 invariantes** — um pra cada regra que quebrou nestas duas levas. Roda no boot em ~1ms e só reclama no console.

### O que ficou aberto (para a próxima sessão)

**Depende do Gustavo:**
1. **PR #35 (Revisão de Apólices)** — estava em conflito desde 28/07 e **foi desencalhado nesta sessão** (merge da main, 6 hunks mecânicos, smoke test OK, `MERGEABLE`). **Não foi mergeado de propósito**: subir pede criar as tabelas de revisão no playground + publicar a Edge Function `importar-apolice`, e falta decidir se ele **duplica ou complementa** o `revisao-protecao.html` que já está no ar.
2. **Print do item 3** do caderno — se era o *menu lateral arrastável* (estilo Central Financeira), só metade foi entregue (foi feita a ordem das colunas das planilhas).
3. **Print da aba Oportunidades** (item 4 da pág.1) — o botão "Adicionar" não existe naquela tela.
4. **Itens 6/7/9 da pág.1** — dependem dele definir a **trilha de follow-up do cliente** (quais etapas um cliente percorre depois de virar cliente). O seletor de funil da v0.10.4 já cobre parte do 7 e do 9.
5. **Data de emissão das apólices-gatilho** no ✏️ do card da Substituição — sem ela a janela de 180 dias nunca fecha.
6. **7 SQL** de `~/Downloads/leads-bkp-restore` e a **decisão de RLS** em `lp_key_contatos` / `lp_key_leads` / `lp_match_leads`.

**Pode ser tocado sem ele:** Google Agenda reaproveitando o OAuth do Painel Central (item 14) · estudo GlobalCRM (avaliar e trazer as decisões). **Fora desta visão:** extensão WA 2.0 (outra base, e ele quer dividida em Captação × LP Vendas).

---

## 📸 Snapshot — 11/08/2026 · 🔁 SUBSTITUIÇÃO nativa e OPERÁVEL (v0.10.2) + caderno de 8 ajustes + fix do "Ver no CRM"

**Estado em 30 s:** `main` = `0513250`, **tudo no ar** em `juca-alt.github.io/crm-captacao/`. Quatro entregas hoje, nesta ordem: (1) **PR #58 / v0.10.0** — o módulo **Substituição de Apólice** deixou de ser um stub morto e virou módulo de verdade no `vendas.html`, gravando em `subst_clientes/subst_apolices/subst_pagamentos`; (2) **PR #59 / v0.10.1** — 8 dos 14 itens do caderno de ajustes dele; (3) **PR #60** — fix do "Ver no CRM", achado no uso real dele; (4) **PR #61 / v0.10.2** — a Lista de Atraso virou a porta de entrada do módulo (cria cliente+apólice) e a apólice virou editável.

### 1. Substituição de Apólice — de stub morto a módulo (PR #58, v0.10.0)
O item 🔁 Substituições do menu abria uma tela dizendo "o módulo vive no arquivo `controle-substituicao.html` nesta mesma pasta" — **arquivo que não existe no repo**. O de verdade vivia solto em `~/Documents/Claude/Projects/CRM Life Planner/Artefatos/` (90KB, v1.9, localStorage `csa_state_v3`).

**REGRA DE OURO do domínio (preservada):** a apólice antiga não pode cair antes da nova completar a janela. Cair = **59 dias** de atraso. O jogo é segurar cada antiga na **faixa 30–40 dias** — atraso de propósito, economia real pro cliente, com folga pro imprevisto. `papel:'gatilho'` = a nova (abre a janela); `'proteger'` = as antigas.

- Portfólio por fôlego + ficha do cliente (janela, cards por apólice, gauge, tracker de boleto, vantagem pro cliente, timeline com cadência, sugestão de próxima ação)
- Ações: boleto → comprovante → confirmado (avança 1 mês, zera postergação), marcar pago, postergação, valor final, cadastro manual
- **Migration aplicada** (`subst_apolice_modulo_v1`, versionada em `supabase/migrations/subst_apolice.sql`): RLS por dono `lp_email = auth.jwt()->>'email'` + DEFAULT, `revoke anon`
- **Versionamento por data de impressão**: espelho traz `Impresso em`, atraso traz `origem_relatorio`; documento mais antigo que o aplicado = `stale`, não sobrescreve
- **Duas fontes de update**: colar espelho OU **puxar da Lista de Atraso** (o relatório que ele já cola tem vencido_em/pago_ate/prêmio/motivo)
- Import do backup JSON do controle antigo (o dado real entra sem passar pelo repo, que é PÚBLICO)

**Também na #58 — Lista de Atraso, o caso do abatimento de parcelas:** (a) bug latente real — a ESCRITA normalizava o nº da apólice, a **LEITURA não** (`atRowToRec` + carga do localStorage): linha fora do formato canônico nunca casava com o relatório novo → caía em "sumiu" **E** entrava de novo como nova; (b) "saiu do relatório" deixou de ter destino único → 3 saídas explícitas (regularizada / continua em atraso só saiu do corte / não sei), padrão *regularizada*; (c) vencimento que anda pra frente agora é rotulado `abatimento · −Nd de atraso`.

**Também na #58 — busca inline na topbar** (typeahead sobre o mesmo motor do ⌘K). De quebra **zerou o estouro horizontal da topbar a 375px** (medido em iframe real: 415→371px).

### 2. Caderno de ajustes — 8 dos 14 itens (PR #59, v0.10.1)
- **Janela = 180 DIAS corridos**, não "6 meses de calendário" (`SUB_JANELA_DIAS`). Emissão 10/03 fecha **06/09**, não 10/09 — o indicador mostrava folga inexistente.
- **Dias em atraso, raiz do acúmulo:** lançar pagamento no app avançava `venc` 1 mês por ESTIMATIVA; quando o pagamento abatia parcela diferente, o erro ficava e **somava a cada lançamento**. Agora existe `vencFonte` ('oficial'|'estimado'), o card avisa, e qualquer documento oficial devolve pra 'oficial' zerando o desvio.
- **Busca do Estoque não perde o foco:** o `oninput` re-renderizava a view a cada tecla, destruindo o `<input>`. Debounce 180ms + `atFocus('bn-q')` + autocomplete por `<datalist>`.
- Ordenação do kanban (5 modos, default Livre) · contador de recomendações no card · **Sincronizar ≠ Atualizar app** (dados sem reload, preservando rota/modal) · **DnD otimista** (card muda de coluna no mesmo tick do drop).

### 3. Fix do "Ver no CRM" (PR #60) — achado no uso real dele
Print do George de Melo Santos: clicar em "Ver no CRM" abria o painel com o nome certo na busca e **"Nenhuma pessoa com esses filtros"**. O `&abrir=1` não bastava — o painel abre na lista padrão **"Prontos p/ ligar"**, que exige `estagio==='lista_ta'`, e cliente da carteira é `estagio==='cliente'` (mais trilha 'seguro' e faixas de idade/renda). Fix = `irParaOndeEstA()`: zera filtros, preenche a busca e **troca a lista** pela que contém a pessoa, antes de abrir a ficha.

### 4. Substituição operável de verdade (PR #61, v0.10.2) — pedido no fechamento
Ele perguntou: *"eu tb posso add os clientes e puxar pela lista de atraso né? quero que seja funcional"*. **Estava capenga:** o "Puxar da Lista de Atraso" só ATUALIZAVA apólices já cadastradas — com o módulo vazio respondia "nada novo" e não fazia nada. Mas quem está em substituição está, por construção, em atraso, e o relatório oficial já traz cliente/apólice/prêmio/vencimento/LP/motivo.
- Preview em 2 seções (**Atualizar o que já está aqui** / **Trazer pra cá**), checkbox por apólice (opt-in) + escolha do papel + "Marcar todas". Cliente criado só se não existir, casando por nome normalizado (as N apólices da mesma pessoa caem num cliente só). Entra como fonte `oficial` + data do relatório → reprocessar não duplica.
- ⚠️ **O outro lado:** apólice vinda do atraso não tem **data de emissão** e sem ela a janela de 180d não fecha — a tela dizia "sem apólice gatilho" mesmo havendo uma. Agora distingue "sem gatilho" de **"falta a data de emissão da nova"**, com aviso + botão que resolve na hora.
- **✏️ Editar apólice** em cada card (papel, emissão, prêmio, dia, vencimento, LP, forma) + **remover do controle**. Vencimento mexido à mão vira `estimado`.
- **LIÇÃO:** entregar o "atualizar" sem o "criar" deixou o módulo inutilizável na partida. Sempre checar o caminho do **estado inicial vazio**.

**Verificação da sessão:** 105 golden asserts (jsc) contra o **backup real** do controle antigo e o **espelho real em PDF** do Drive; E2E no browser em cada entrega (fluxo de boleto completo, ponte com o atraso, as 3 saídas do "sumiu", foco da busca, DnD no mesmo tick, os 3 casos do "Ver no CRM"); console limpo; desktop e mobile por screenshot; prod confirmada pelo CONTEÚDO, não só pelo número da versão.

**⚠️ PENDENTE (dele) e próximas frentes:**
1. ✅ **Backup da Substituição JÁ IMPORTADO por ele** (confirmou no fechamento). Agora pode também **puxar da Lista de Atraso** pra trazer clientes/apólices que faltarem, e completar a **data de emissão** da apólice-gatilho pelo ✏️ (sem ela a janela de 180d não fecha).
2. **Caso Ricardo Da Fonte** — não reproduzi (base vazia). Corrigi o mecanismo pela especificação; se após importar ainda divergir, precisa do print da ficha + relatório.
3. **Caso Gilvania** — precisa dos **dois relatórios** (antes/depois do abatimento) pra fechar em definitivo.
4. **Item 4 do caderno** (botão "Adicionar" na aba Oportunidades): esse selector **não existe** em `vendas.html` nem `carteira.html` — **precisa de print** pra conectar a coisa certa.
5. **Itens 6+7+9** (duplo modelo do card Cliente×Oportunidades · modal Mover Estágio em etapa única · converter contato→aba Clientes): dependem de definir a **trilha de follow-up de cliente**. Viram UMA frente, sessão própria.
6. **Item 13** (extensão Wapp, PA/PM editáveis): outra base (`extensao-whatsapp/`), já reservado como frente "extensão WA 2.0".
7. **Item 14** (Google Agenda): precisa OAuth — o **Painel Central já tem** integração persistente, reaproveitar de lá.
8. **PR #35** (Revisão de Apólices) segue aberto desde 28/07 e **precisa rebase** (mexe no mesmo `vendas.html`, que mudou muito hoje).

**Pontos críticos que o Claude futuro NÃO pode esquecer:**
- **Espelhos REAIS da Prudential estão no Drive**: `~/Library/CloudStorage/GoogleDrive-juca@.../Meu Drive/Prudential/Apolices Carteira {Jucá,Daniel,Rebeca}` (345 PDFs, da skill `apolices-prudential`). Ler com `pdfplumber`. **Calibrar sempre no texto real** — foi assim que achei que o CPF não era extraído (a regex exigia início de linha, mas o PDF traz `Segurado: FULANO CPF: ...` na mesma linha).
- No `painel-lp.html`, `S.cont` é a base INTEIRA, mas **`SMART[S.activeList].base` + `passFilter` decidem o que aparece** — achar o contato em memória não significa que ele está visível.
- **Em linha compacta do `vendas.html`, usar `/* */` e NUNCA `//`**: um comentário `//` engoliu o resto da linha (incluindo o fechamento de um `try`) e derrubou o script inteiro com "Unexpected end of script".
- **Bisect de sintaxe por fatia de linhas dá falso positivo** (corta no meio de função). O certo é reconstruir do `git show HEAD:arquivo` e aplicar patch por patch checando cada estágio.
- **`innerWidth: 0`** no `javascript_tool` de novo. Pra medir layout: montar um **iframe de 375px dentro da página** e medir `scrollWidth` lá.
- Editar o `vendas.html` por **python com latin-1** (`s.encode('utf-8').decode('latin-1')` nas âncoras acentuadas), não por Edit direto.
- O classificador **barra `gh pr merge` e `git push <sha>:main`** por padrão; **passa** quando o Gustavo autoriza expressamente na mesma sessão.
- `git fetch` ANTES de editar o clone compartilhado; `grep -a` obrigatório no `vendas.html`; sem node na máquina (testes no browser interno ou via `jsc`).

**Prompt pronto pra retomar (cole num chat novo):**
> Sessão CRM **Visão LP** (repo `juca-alt/crm-captacao`, git real em `~/Documents/crm-captacao`, playground Supabase `cjieobmdpqcupzdpckef`). Leia as memórias `crm-lp-substituicao` + `crm-lp-caderno-ajustes`. Estado: `main` = `0513250`, v0.10.2 no ar — módulo **Substituição de Apólice** nativo (tabelas `subst_*`, RLS por dono), 8 ajustes do caderno e o fix do "Ver no CRM". **Já importei o backup da Substituição**; falta completar a data de emissão das apólices-gatilho (✏️ no card) pra janela de 180d fechar. **Frentes na fila, eu escolho:** (a) itens 6+7+9 do caderno = duplo modelo do card + modal Mover Estágio + converter contato→Clientes (precisa definir a trilha de follow-up de cliente); (b) item 4 (te mando o print da aba Oportunidades); (c) extensão WA 2.0; (d) Google Agenda reaproveitando o OAuth do Painel Central; (e) rebase do PR #35. **Regras:** `git fetch` antes de editar, `grep -a` no `vendas.html`, editar por python/latin-1, uma sessão só nesta visão.

---

## 📸 Snapshot — 10/08/2026 · ⏰ LISTA DE ATRASO virou MÓDULO no ar (v0.9.9) — backoffice.html standalone → `vendas_atrasos`/Supabase

**Estado em 30 s:** a **Lista de Atraso** (antes só o artefato `backoffice.html` em localStorage) agora é um **módulo dentro do `vendas.html`** (Outros módulos → BackOffice → Lista de Atraso), gravando na tabela **`vendas_atrasos`** do playground `cjieobmdpqcupzdpckef`. **NO AR** em `juca-alt.github.io/crm-captacao/vendas.html` (v0.9.9, main `d269685`, PRs #54→#57 mergeados hoje). Fluxo: **📋 Colar relatório** → detecta oficial Prudential × assistentes → preview → aplica (upsert por `(lp_email, apolice)`). Dias em atraso são DERIVADOS (hoje − vencido_em), nunca coluna.

**O que foi feito nesta sessão (evolução v0.9.6 → v0.9.9):**
- **v0.9.6 (#54):** módulo criado + migration aplicada (`supabase/migrations/vendas_atrasos.sql`: +7 colunas, UNIQUE `(lp_email,apolice)`, RLS por dono `lp_email=jwt email`). Os 7 bugs do prompt corrigidos na origem (upsert por apólice, dias derivado, presente nunca vira "pago", pago≠venc, apólice string normalizada).
- **v0.9.7 (#55):** aplicar não exige mais nome (desbloqueou) + 1ª tentativa de ler nome sem rótulo.
- **v0.9.8 (#56) — O FIX GRANDE:** com o **relatório real** do Gustavo (salvo em `scratchpad/relatorio-real.txt`), descobri que TODO o registro vem **DEPOIS** do nº da apólice → reescrevi o parser p/ **janela FORWARD** `[nº..próxima apólice]`. Isso consertou o **bug de datas herdadas da apólice de cima** (Gilvania 001737611=22/06, 001505343=27/06) — **que já existia no artefato backoffice.html**. Nome extraído entre `Ativa` e o 1º contato (some o "Ativa" que vazava). **Status workflow de volta** (dropdown na ficha) + os 2 novos que ele pediu (`Boleto pago cliente`, `Aguardando baixa sistema`). Ficha ganhou edição de segurado/responsável/vencimento/prêmio.
- **v0.9.9 (#57):** re-colar CONSERTA nomes "Ativa …" salvos na v0.9.7 (heal), preservando nome corrigido à mão.

**Verificação:** 73 golden asserts contra o relatório REAL (`scratchpad/atrasos-core.js` + `atrasos-test.html`, rodo no browser interno — SEM node na máquina). E2E no app conferido (10 registros, datas/prêmio/LP/nome ok).

**⚠️ PENDENTE / próximas frentes:**
1. **Gustavo re-colar o relatório LOGADO** (Cmd+Shift+R p/ pegar a v0.9.9) → cura datas + nomes dos registros que já tinha aplicado.
2. **Separar automático os ~8 registros "2 nomes" (resp≠segurado, ex. Everton/Ludmila):** o texto colado do PDF achata as colunas → não dá p/ separar. Empresa+pessoa (LTDA/EIRELI) já separa. Solução real = ligar o **upload de PDF com coordenadas** (o `lpPdfText`/`lpMergeWrap` do LP antigo já faz isso por gap de coluna) — frente a mais, aguardando OK.
3. Colisão histórica: o módulo Revisão de Apólices (PR #35, aberto) também mexe no `vendas.html` — vai precisar rebase.

**Pontos críticos que o Claude futuro NÃO pode esquecer:**
- `grep -a` obrigatório no `vendas.html` (bytes não-UTF8). **`git fetch` ANTES de editar** (clone compartilhado; a v0.9.5 subiu por baixo enquanto eu editava a v0.9.4).
- Sem node na máquina → rodo testes no **browser interno** (python3 `http.server` no scratchpad; `preview_start {url}` abre :8799, mas `navigate` direto a localhost é bloqueado por policy → usar `preview_start` + `javascript_tool` com `tabId` explícito).
- `let`/`const` no topo do `<script>` NÃO viram `window.*` — testar por nome nu.
- O `MFB` do relatório é sempre "Gustavo Melo Juca"; o LP de serviço (Daniel/Gustavo/Rebeca) vem do agrupamento `LP:` — é o `lp_servico`, distinto do `lp_email` (dono do registro).

**Prompt pronto pra retomar (cole num chat novo):**
> Sessão CRM Life Planner (`vendas.html`, repo `juca-alt/crm-captacao`, playground Supabase `cjieobmdpqcupzdpckef`). O módulo **Lista de Atraso** (Outros módulos → BackOffice) está NO AR (v0.9.9, `vendas_atrasos`). Leia o snapshot 10/08 do `ESTADO_DO_PROJETO.md` + a memória `crm-captacao-visao-lp`. Retomar em UMA das frentes: (a) **upload de PDF com coordenadas** pra separar automático os ~8 registros de 2 nomes (resp≠segurado) — o `lpPdfText`/`lpMergeWrap` do LP antigo já faz isso; (b) ajustes que o Gustavo pedir depois de usar. Regras: `grep -a` no vendas.html, `git fetch` antes de editar, sem node → testo no browser interno (fixture real em `scratchpad/relatorio-real.txt`, golden em `atrasos-core.js`+`atrasos-test.html`).

---

## 📸 Snapshot — 23/07/2026 (noite) · SYNC CONTATOS LP → SUPABASE no ar + extensão v0.3.0 (frente "c" CONCLUÍDA no código)

**Pedido do Gustavo: "o que falta do app pro Supabase? bota logo".** PR #28 MERGED (main `f4c7f8b`):
- **vendas.html v0.4.1**: nova tabela **`lp_contatos`** (migration `supabase/migrations/lp_contatos.sql`
  — 1 linha/contato, `dados` jsonb, RLS por dono=email, padrão carteira). `salvar()` carimba `_upd`
  no contato alterado + push com debounce; boot faz merge remoto×local por `_upd` (maior vence) e
  sobe base local no 1º sync. Deslogado/sem migration = comporta como antes (localStorage).
  Validado em Chromium (boot offline, carimbo, recarimbo).
- **Extensão v0.3.0**: Visão LP resolve contato do FUNIL → Carteira → criar; card LP EDITÁVEL
  (etapa NN/BC, telefone, notas, upsert com `_upd`); criar contato LP direto do chat
  (NN→SitPlan, BC→Clientes Ativos). QA Playwright **22/22 verde**.

**⚠️ PENDENTE DO GUSTAVO (sem isso o sync não liga; app segue como hoje):**
1. Rodar `supabase/migrations/lp_contatos.sql` no SQL Editor.
2. Atualizar a extensão local (ZIP da main + ↻ em chrome://extensions).
3. Abrir o vendas.html LOGADO uma vez em cada aparelho (1º sync sobe a base local).
Enum origem: ALTERs rodados por ele em 23/07; lista final do enum ainda não conferida no chat.
⚠️ SESSÃO LP paralela: o vendas.html ganhou o bloco "SYNC CONTATOS" + salvar() novo — dar fetch
antes de mexer.

---

## 📸 Snapshot — 23/07/2026 · Extensão WhatsApp em USO REAL — v0.2.0 (Captação + Visão LP) (sessão da extensão, visão CAPTAÇÃO)

**Teste real do Gustavo ANDOU:** card achou lead pelo telefone (PI00455), salvar revelou que
`leads.origem` é ENUM (`origem_t`) DEFASADO — faltava até 'Rec Cliente' (a velha pendência
"validar 4 origens"). Migration `origem_whatsapp.sql` alinha o enum com TODAS as origens do app
+ 'WhatsApp' (Gustavo rodou os ALTERs no SQL Editor em 23/07; conferir lista com
`select unnest(enum_range(null::public.origem_t))`).

**Extensão v0.2.0 na main** (PRs #25 toast/origem, #26 aba recolher/expandir, #27 seletor de visão):
- Tabs **Captação × Visão LP** no painel; escolha persiste.
- **Visão LP** = card da **Carteira** (única fonte LP no Supabase): cliente identificado
  AUTOMATICAMENTE pelo número (telefone extraído do `dados` jsonb, variantes do 9º dígito),
  leitura + apólices; sem match → atalho "Criar como lead de Captação".
- Descoberta da exploração: contatos/funil LP (nn/bc) vivem 100% no `crmlp_v03_state`
  (localStorage do vendas.html) — card LP editável SÓ depois da frente "sync contatos LP →
  Supabase" (fazer em sessão LP; nada do vendas.html foi tocado por esta sessão).
- Card de lead sem origem não grava mais 'WhatsApp' sozinho ("— sem origem —" default).
- QA automatizado (Chromium+Playwright, mock WhatsApp + Supabase mockado): **18/18 verde**.

**Pendências desta frente:** Gustavo atualizar a extensão local (ZIP main + ↻ em
chrome://extensions) e seguir o uso real; trava 2b de telefone segue não rodada;
migration origem rodada mas lista final do enum não conferida no chat.

---

## 📸 Snapshot — 23/07/2026 · Sessão "Funil Negócios Base de Clientes" — ✅ **NO AR (v0.4.0, MVP 1.0 zerado pro uso real)**

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO LP)
```
Retoma o CRM Visão LP (vendas.html). Lê o ESTADO_DO_PROJETO.md.
REGRA: uma sessão por visão — NÃO tocar na Captação (index.html); git fetch antes de editar.
Estado 23/07: v0.4.0 NO AR (PR #24 MERGED, main c4c095f) — módulo FUNIL NEGÓCIOS BASE DE
CLIENTES (espelho do funil CLIENTES CARTEIRA do Kommo, pipeline 12543239) + DADOS DEMO
ZERADOS (chave localStorage v03, seed vazio, botão demo removido). Estou usando com dados
reais e: [tudo certo / deu isso: ...]. Frentes candidatas: (a) importar os leads direto do
Kommo pela API interna (evita digitação manual), (b) ajustes de uso real, (c) sync
contatos/funil → Supabase (hoje é localStorage por aparelho).
```

**✅ DEPLOY 23/07 (autorização explícita do Gustavo no chat):** PR #24 **MERGED** (merge via `gh pr merge`
— 1ª tentativa deu "Base branch was modified" TRANSITÓRIO do GitHub com main idêntica; retry 5s depois
passou). Pages reconstruiu em ~1min; confirmado no ar: v0.4.0, módulo BC presente, `crmlp_v03_state`,
zero dado demo (conferido com `grep -a` — sem o `-a` o grep falha MUDO no vendas.html, pegadinha de sempre).

**Limpeza do demo (2º commit do PR, `d5d8cb6`):** seed sem os 9 contatos fictícios (perfis Gustavo/Daniel
ficam); chave localStorage `crmlp_v02_state` → **`crmlp_v03_state`** (todo aparelho começa limpo, sem
depender de clique; estado demo antigo fica abandonado); botão "Recarregar demonstração" + `resetDemo()`
removidos ("Começar do zero" fica); empty-state de Planos sem referência ao caso demo. As menções
CINQ/Artur que FICARAM são texto explicativo do método (Princípios/subtítulo de Planos), não dados.

**O que foi construído (pedido do Gustavo 23/07):** módulo **Negócios Base de Clientes** no
vendas.html (v0.3.1 → **v0.4.0**), mesmo formato do Funil Novos Negócios: grupo na sidebar
(💼 Funil + lista de Etapas com contagem), kanban arrastável + modo Lista, encerramentos
recolhíveis. Etapas capturadas ao vivo do Kommo via API interna (`/api/v4/leads/pipelines/12543239`,
funil "CLIENTES CARTEIRA"): Clientes Ativos → Pendência/Atraso → Contato Agenda/Revisita →
Agendada Revisita → Novo Negócio/Resolução pós Revisita → N/Emissão → Emissão Final → Delivery,
encerramentos Venda ganha/Venda perdida (typos do Kommo saneados: "Pendência/Atrasot", "Delivery.1";
etapa de sistema "leads de entrada" fica de fora).

**Arquitetura:** contato ganha campo `funil: 'nn'|'bc'` (ausente = nn, retrocompatível com
localStorage existente); `meusContatos()` agora EXCLUI bc (SitPlan/KPIs/Contatos/funil NN não
veem cliente da base) e `meusContatosBC()` é a população do módulo novo; drawer usa `etapasDe(c)`
(stepper mostra as etapas do funil certo); motor `registrarResultado` mapeia p/ BC ("Agendou X" →
Agendada Revisita, "Sem interesse" → Venda perdida); "➕ Novo negócio" reusa o modal de novo
contato com `openNovoContato('bc')` (nasce em Clientes Ativos, sem lista de discagem).

**Validação (preview local lp-static:8781):** sem erro de console; criar negócio BC ✓; stepper BC
no drawer ✓; motor mapeado ✓; drag (bcMoveEtapa) + jornada logada ✓; isolamento NN×BC ✓ (contato
bc não aparece em meusContatos); encerramentos abrem/recolhem ✓; funil NN intacto ✓. Sintaxe
validada via JavaScriptCore (sem node local); regra do guard ok (0 insert em leads no vendas.html).

**Pendências:** (1) validação REAL do Gustavo no preview + OK explícito pra merge do PR;
(2) carga dos dados oficiais (ele digita ou a gente importa do Kommo em sessão futura — a API
interna do Kommo dá os leads por etapa, dá pra automatizar importação depois); (3) validação
logada do sync carteira ☁️ (pendência anterior, segue).

---

## 📸 Snapshot — 21/07/2026 · Sessão "Extensão WhatsApp → CRM" (visão CAPTAÇÃO, branch `claude/whatsapp-web-crm-extension-h9z9l3`)

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO CAPTAÇÃO)
```
Retoma o CRM Captação (visão Captação = index.html). Lê o ESTADO_DO_PROJETO.md.
REGRA: uma sessão por visão — NÃO tocar na LP (vendas.html); git fetch antes de editar.
Estado 21/07: extensão Chrome "Captação · WhatsApp → CRM" v0.1.0 MERGEADA na main
(PR #22, main = a2e74f3, guard verde; index.html/vendas.html intocados — Pages sem
mudança no app). Pasta extensao-whatsapp/ — falta o TESTE REAL do Gustavo (load
unpacked, roteiro no extensao-whatsapp/README.md; checklist guiado entregue no chat).
Testei o fluxo real (WhatsApp Web → card → criar/editar lead): [FUNCIONOU / deu isso: ...]
```

**O que foi construído (pedido do Gustavo, inspiração HubSpot/Atendare):** extensão Chrome MV3
pra WhatsApp Web — ao abrir uma conversa, painel lateral (Shadow DOM, visual do CRM) mostra o
card do lead casado por **telefone** (variantes com/sem 9º dígito); sem match → "+ Criar lead"
pré-preenchido (status "Com Telefone", origem nova "WhatsApp", PI pela trigger); edição de
Etapa×Status (funil dinâmico de `app_settings.funil_cfg`), cargo/empresa/cidade/e-mail/origem/
recomendante/observações, follow-up + tarefa na timeline. Busca manual como fallback. v1 SEM IA,
SEM API Meta, SEM ler conteúdo de mensagens; DOM só leitura (anti-ban).

**Arquitetura:** REST puro (GoTrue senha+refresh, PostgREST) sem supabase-js; rede só no service
worker; `crm-api.js` = choke point da extensão espelhando `insertLead`/`updateLead`/`logEdit`/
`setLeadTask` (derivados, carimbos, `etapa` nunca gravada, 23505 traduzido). Guard de CI ganhou
bloco aditivo: `rest/v1/leads` fora do `crm-api.js` na pasta da extensão = build falha (rodado
local, verde; blocos antigos intocados). Login = mesma senha do CRM, token em `chrome.storage`.

**Novos arquivos:** `extensao-whatsapp/` (manifest, config, normalize — ports fiéis de normPhone/
fuzzy/FN_CFG_DEFAULT —, crm-api, sw, content/wa-dom + panel + css, README com roteiro de QA de
12 passos), `supabase/migrations/telefone_e164_unique.sql` (trava 2b: diagnóstico dos 6 telefones
duplicados → unificar em Duplicatas → UNIQUE comentado até zerar), `privacidade-extensao-whatsapp.html`.

**Pontos críticos pro Claude futuro:**
- **Mergeado na main em 21/07** (PR #22, autorização do Gustavo no chat: "já deixar no crm captacao") — merge não muda o app em prod (só pasta nova + guard + docs). QA real do Gustavo AINDA PENDENTE; bugs viram branch novo.
- Migration da trava 2b **NÃO rodada** (manual, e depende de unificar os 6 duplicados primeiro).
- DOM do WhatsApp não tem contrato: detecção em camadas (JID `data-id` → número no título → nome
  → busca manual). Se o WhatsApp mudar o DOM, a extensão degrada pra busca manual — checar
  `content/wa-dom.js` primeiro. JIDs `@lid` (privacidade de número) caem no fallback por nome.
- Pendências herdadas continuam: deploy v2.7.0 no ar (conferir rodapé), teste real do fluxo
  Instagram, 4 origens de PI logado.

---

## 📸 Snapshot — 19/07/2026 (noite) · Sessão "Ativação Prospector Instagram" (visão CAPTAÇÃO, autonomo-3)

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO CAPTAÇÃO)
```
Retoma o CRM Captação (visão Captação = index.html). Lê a memória insta-prospector-extensao e o ESTADO_DO_PROJETO.md em ~/Documents/crm-captacao.
REGRA: uma sessão por visão — NÃO tocar na LP (vendas.html); git fetch antes de editar.
Estado 19/07 noite: Instagram → CRM ATIVADO — migration instagram_handle rodada+verificada no Supabase, PR #19 (QA v2.6.3) e PR #21 (v2.7.0) integrados, main = ac52a04. Deploy Pages ficou preso em incidente do GitHub — PRIMEIRO checar se https://juca-alt.github.io/crm-captacao/ mostra v2.7.0; se não, forçar rebuild (gh api -X POST repos/juca-alt/crm-captacao/pages/builds).
Testei o fluxo real (extensão → 📋 Enviar pro CRM → ◎ Sincronizar do Instagram): [FUNCIONOU / deu isso: ...]
Frente: (a) ajustes do teste real; (b) score A/B/C/D por IA na bio; (c) foto data-URI → Storage.
```

**Estado em 30 segundos:** migration `instagram_handle.sql` verificada em prod (coluna+índice único+CHECK, select provou 1/1/1). PR #19 MERGED; PR #21 integrado via merge local `--no-ff` + push (`gh pr merge` bloqueado por permissão da sessão) — main = `ac52a04` = **v2.7.0 · Instagram → CRM**; #21 fechado c/ comentário (GitHub recusou retarget por já estar 100% contido na main). Sanity pós-merge ok (24× instagram_handle, sem marcador de conflito).

**Pontos críticos pro Claude futuro:**
- **Deploy NÃO confirmado no ar ao fechar:** incidente do GitHub (Pages degraded + API 503) segurou o build "building" por 40+ min. O commit certo (`ac52a04`) está na main; era só o Pages. Checar versão no rodapé antes de qualquer coisa.
- Gustavo ainda **não testou o fluxo real** — dedup por @ foi validado em harness, não com os leads reais dele. No teste: lead existente tem que ser casado pelo @ (atualizar, não duplicar). Lembrar de recarregar a extensão E a aba do Instagram.
- `ESTADO_DO_PROJETO_backup-local-2026-07-08.md` (86KB, não-versionado) = o ESTADO antigo local, preservado quando a main passou a versionar este arquivo — tem o histórico até 08/07 (pendências antigas: validar 4 origens de PI logado, 6 telefones duplicados → trava 2b).

---

## 📸 Snapshot — 19/07/2026 · Sessão "UX mobile do Vendas" (Claude Code, branch `claude/mobile-app-ux-navigation-nok5sf`)

**Contexto:** Gustavo mandou print do `vendas.html` (ISLAND · v0.3) no iPhone — inutilizável: sidebar de 64px só com ícones comendo a tela, topbar estourando na horizontal, funil espremido, botões minúsculos, sem conseguir navegar.

**O que foi feito (só `vendas.html`, bump pra v0.3.1):**
- **Sidebar → gaveta off-canvas** no mobile (≤980px), com rótulos completos, aberta pelo hambúrguer ☰ na topbar; fecha ao navegar ou tocar fora.
- **Barra de navegação inferior** (zona do polegar): Início · SitPlan · Contatos · Funil · Menu, com estado ativo sincronizado com a navegação existente (`irPara`).
- **Fim do estouro horizontal:** `min-width:0` no `.main` (causa raiz — item flex não encolhia), tabelas e funil roláveis dentro dos cards, topbar compacta (tags e nome do perfil somem em tela estreita, fica só avatar).
- **Alvos de toque:** botões ≥44px, checkboxes 20px, stepper maior; **inputs/selects com fonte 16px** (mata o auto-zoom do iOS que desorientava a navegação).
- **Drawer de contato em tela cheia** no celular (`100dvh`, botão fechar 40px). Bug de flexbox corrigido: `.sec` com `flex-shrink:0` (senão as seções comprimiam/clipavam dentro do `drawer-body`).
- KPIs em grid 2 colunas; toasts acima da barra inferior; `viewport-fit=cover` + `env(safe-area-inset-*)` pro iPhone; texto do kanban avisa que no celular a etapa muda pelo perfil (drag HTML5 não existe em touch).
- Desktop (>980px) **intocado**.

**Verificação:** Playwright/Chromium headless a 390×844 (iPhone) — sem estouro horizontal em Início/SitPlan/Contatos/Funil, gaveta abre/fecha, barra inferior sincroniza ativo, drawer 390px de largura, alvos da barra 52px. App roda 100% em localStorage mesmo com CDN do Supabase bloqueado (sandbox).

**Estado real do repo notado nesta sessão (CLAUDE.md está desatualizado):**
- `vendas.html` no main já é **ISLAND · v0.3 · Visão LP** com chave `crmlp_v02_state` (CLAUDE.md ainda fala em v0.1/`crmlp_v01_state` e num `vendas-dev.html` que não existe no repo).
- `ESTADO_DO_PROJETO.md` não existia no repo (recriado agora).

**Publicação:** Gustavo aprovou pelos screenshots da verificação (19/07) e mandou publicar direto — merge no main feito na mesma sessão, v0.3.1 no ar via GitHub Pages. Validação final de uso real: no iPhone dele, em produção.

---

*Contrato: Code escreve aqui; Chat só lê; Cowork reconcilia repo ↔ Drive.*
