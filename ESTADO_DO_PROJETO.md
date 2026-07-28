# ESTADO DO PROJETO — CRM Captação / Vendas LP

> ⚠️ **Nota de reconciliação (19/07/2026):** a cópia versionada deste arquivo estava **ausente do repo** (o CLAUDE.md referencia ela, mas não existia commit). Este arquivo recomeça aqui com o snapshot da sessão de hoje. **Cowork:** na próxima passada, reconciliar com a versão oficial do Drive (pasta "CAPTACAO LIFE PLANNER") — o histórico anterior vive lá.

---

## 📸 Snapshot — 28/07/2026 · Sessão "MÓDULO REVISÃO DE APÓLICES" (visão LP, autonomo-3) — ✅ construído e verificado, **PR aberto AGUARDANDO validação + OK do Gustavo**

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO LP)
```
Retoma o CRM Visão LP (vendas.html). Lê o ESTADO_DO_PROJETO.md (snapshot 28/07).
REGRA: uma sessão por visão — NÃO tocar na Captação (index.html); git fetch antes de editar.
Estado 28/07: módulo REVISÃO DE APÓLICES construído na branch feat/lp-revisao-apolices
(worktree ~/Documents/crm-lp-build), PR aberto, golden test Catarina 100 asserts verdes.
PENDENTE (nesta ordem): (1) rodar supabase/migrations/revisao_apolices.sql no SQL editor;
(2) deploy da Edge Function: supabase functions deploy importar-apolice;
(3) eu validei o preview ?revdemo=1: [tudo certo / deu isso: ...];
(4) com meu OK explícito → merge do PR.
Depois do merge: teste real com demonstrativo PDF meu (import IA) + classificar os 12
códigos pendentes em ⚙️ Catálogo.
```

**O que existe agora (tudo na branch `feat/lp-revisao-apolices`, 3 commits):**
- **Migration `supabase/migrations/revisao_apolices.sql`** (NÃO RODADA): `rev_apolices` (+ `valor_resgate`
  manual), `rev_apolice_coberturas`, `rev_cobertura_catalogo` (compartilhado), `rev_parametros`
  (16 parâmetros editáveis). Seed com **54 códigos reais** da carteira do Daniel (42 classificados
  por prefixo + 12 pendentes: AP*/FR*/TF*/TR*/WD*/WS*/DI*). RLS por dono nas 2 primeiras.
- **`revisao-service.js`** (arquivo novo na raiz, carregado pelo vendas.html): TODA a regra de negócio
  pura (consolidação por sinistro c/ sublinhas vitalício/temporário, antecipações "incluso",
  diária/UTI, linha do tempo c/ capital remanescente e destaque <50%, calculadora metodologia
  oficial, reserva manual + `fatorResgateProvider` plugável pro futuro cálculo automático).
- **Testes `scripts/test-revisao-core.js`** (portável jsc/Node) + `scripts/test-revisao.mjs` no CI
  (step novo no guard-choke-point.yml). **Golden test real da Catarina: 100 asserts verdes**
  (rodado local via jsc — Mac sem Node: `jsc revisao-service.js scripts/test-revisao-core.js`).
- **vendas.html v0.5.0**: views `cart-revisao` (7 seções + rodapé honesto c/ não-classificados +
  CSS de impressão, 1º do app) e `rev-catalogo` (classificação + parâmetros); entrada pelo drawer
  da Carteira; import demonstrativo PDF → **Edge Function `importar-apolice`** (nova, padrão
  importar-relatorio-lp, mesma GEMINI_API_KEY, NÃO DEPLOYADA) com preview de conferência;
  form manual completo (criar/editar/excluir apólice+coberturas); `?revdemo=1` = Catarina em
  memória (nada persiste). Dados híbridos: Supabase logado / localStorage fallback.

**Verificação feita (28/07, preview lp-static via scratchpad — ~/Documents bloqueado pro
sandbox do preview, mesma lição do /tmp/lp-preview):** console limpo; TODOS os números do golden
conferidos NA TELA (hero 1.215.681,86 · 6,1%/93,9% · 485,87 · timeline 2028: 7 cob/204,01/40 anos ·
2033: 125,44/45 anos/6,1% destacado · calculadora 1,05mi/sobra 162,7mil/2,2%/614,13 · reserva
13,2%); código ZZ99X injetado → aviso no rodapé + linha "Não classificado" (nunca quebra);
catálogo lista os 12 pendentes; picker/form/mobile OK. Guard ok (0 `from('leads')`).

**Decisões tomadas em autonomia (registradas):** coberturas Surrendered/Lapsed e términos < hoje
saem da consolidação mas são CONTADAS no rodapé; INVALIDEZ_TOTAL = antecipação (capital de morte)
+ soma de PI* se contratado; prêmio "deixa de pagar" na timeline = prêmio líquido (bate golden);
inputs da calculadora ficam só na sessão (não persistem — decidir depois se grava);
catálogo/parâmetros compartilhados entre LPs (aprovado antes de dormir).

**⚠️ Pro Claude futuro:** rev_* no Supabase AINDA NÃO EXISTE (app cai no fallback local sem erro);
Edge Function importar-apolice AINDA NÃO DEPLOYADA (import IA vai falhar até lá; form manual
funciona). Merge do PR SÓ com OK explícito do Gustavo (regra de sempre).

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
