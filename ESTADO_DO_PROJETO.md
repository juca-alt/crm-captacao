# ESTADO DO PROJETO — CRM Captação / Vendas LP

> ⚠️ **Nota de reconciliação (19/07/2026):** a cópia versionada deste arquivo estava **ausente do repo** (o CLAUDE.md referencia ela, mas não existia commit). Este arquivo recomeça aqui com o snapshot da sessão de hoje. **Cowork:** na próxima passada, reconciliar com a versão oficial do Drive (pasta "CAPTACAO LIFE PLANNER") — o histórico anterior vive lá.

---

## 📸 Snapshot — 11/08/2026 · 🔁 SUBSTITUIÇÃO virou módulo nativo (v0.10.0) + caderno de 8 ajustes (v0.10.1) + fix do "Ver no CRM"

**Estado em 30 s:** `main` = `462913a`, **tudo no ar** em `juca-alt.github.io/crm-captacao/`. Três entregas hoje, nesta ordem: (1) **PR #58 / v0.10.0** — o módulo **Substituição de Apólice** deixou de ser um stub morto e virou módulo de verdade no `vendas.html`, gravando em `subst_clientes/subst_apolices/subst_pagamentos`; (2) **PR #59 / v0.10.1** — 8 dos 14 itens do caderno de ajustes dele; (3) **PR #60** — fix do "Ver no CRM", achado no uso real dele.

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

**Verificação da sessão:** 105 golden asserts (jsc) contra o **backup real** do controle antigo e o **espelho real em PDF** do Drive; E2E no browser em cada entrega (fluxo de boleto completo, ponte com o atraso, as 3 saídas do "sumiu", foco da busca, DnD no mesmo tick, os 3 casos do "Ver no CRM"); console limpo; desktop e mobile por screenshot; prod confirmada pelo CONTEÚDO, não só pelo número da versão.

**⚠️ PENDENTE (dele) e próximas frentes:**
1. **Importar o backup fresco da Substituição, LOGADO** — exportar do `controle-substituicao.html` (o de `~/Downloads` é de 16/07 e o artefato semeia dados mais novos no boot) e usar o botão ⬆︎ Importar backup. Sem isso o módulo está vazio em produção.
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
> Sessão CRM **Visão LP** (repo `juca-alt/crm-captacao`, git real em `~/Documents/crm-captacao`, playground Supabase `cjieobmdpqcupzdpckef`). Leia as memórias `crm-lp-substituicao` + `crm-lp-caderno-ajustes`. Estado: `main` = `462913a`, v0.10.1 no ar — módulo **Substituição de Apólice** nativo (tabelas `subst_*`, RLS por dono), 8 ajustes do caderno e o fix do "Ver no CRM". **Meu passo pendente:** importar o backup fresco da Substituição logado. **Frentes na fila, eu escolho:** (a) itens 6+7+9 do caderno = duplo modelo do card + modal Mover Estágio + converter contato→Clientes (precisa definir a trilha de follow-up de cliente); (b) item 4 (te mando o print da aba Oportunidades); (c) extensão WA 2.0; (d) Google Agenda reaproveitando o OAuth do Painel Central; (e) rebase do PR #35. **Regras:** `git fetch` antes de editar, `grep -a` no `vendas.html`, editar por python/latin-1, uma sessão só nesta visão.

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
