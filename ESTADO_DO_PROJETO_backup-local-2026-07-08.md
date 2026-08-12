# 📌 ESTADO DO PROJETO — CRM da Unidade Island (Captação + LP/Vendas)

> ⚙️ **MODELO DE TRABALHO (regra fixa do Gustavo, 29/06): UMA SESSÃO POR VISÃO.** Cada visão é trabalhada numa sessão própria, em paralelo, pra evitar confusão. **Esta sessão/contexto = visão CAPTAÇÃO (`index.html`).** A **visão LP (`vendas.html`) tem sessão própria, paralela** (o Gustavo já a iniciou). Convivem sem conflito porque tocam arquivos/tabelas diferentes (`index.html` vs `vendas.html`; `leads`/`app_users` vs `vendas_*`/`lp_*`). **Ao retomar este contexto, NÃO mexer na LP — ela é tratada na outra sessão.** Ver [[crm-captacao-uma-sessao-por-visao]].

**Última atualização:** 08/07/2026 — **PR #15 MERGEADO → v2.6.2 NO AR.** Nesta sessão o merge do PR #15 (`feat/id-hardening`) foi feito (com autorização explícita do Gustavo no chat) e o deploy do GitHub Pages concluiu com sucesso. `origin/main` = **`e5c7316`** (v2.6.2), `main` local sincronizada. Agora o app manda `codigo` VAZIO e a **trigger do banco numera o PI atômico** (fim da colisão entre aparelhos); guard do choke point roda verde no CI. **O que SOBRA (parte do Gustavo, pra amanhã):** (2) validar logado que lead novo por cada origem — manual/inbox/captura/import — sai com PI do banco sequencial, sem duplicar (recarregar com Cmd+Shift+R pra pegar a v2.6.2; próximos PIs a partir de ~PI01538); (3) unificar os **6 telefones duplicados** na tela Duplicatas (4 são mesma pessoa 2×: Luiz, Lucas Atanasio, Maurilio, Renan; 2 dependem do julgamento dele: Rafael Farias×Raphael Freitas, "OT Dea…"×Deadigliane) → **depois PEDIR pra ligar a trava 2b de telefone** (comentada na `lead_id_control.sql`). · Contexto da auditoria: 07/07 (abaixo). Snapshots em ordem decrescente. · **Leia isto primeiro ao retomar.**

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO CAPTAÇÃO)
```
Retoma o CRM Captação (visão Captação = index.html). Lê o ESTADO_DO_PROJETO.md em /Users/gustavojuca/Documents/crm-captacao.
REGRA: uma sessão por visão — aqui é SÓ a Captação; NÃO toco na Visão LP (vendas.html), que tem sessão paralela própria.
Estado: v2.6.2 (código PI numerado pelo BANCO + guard do choke point no CI + trava de e-mail). O SQL de hardening JÁ foi rodado em prod e provado (trigger atribui PI, trava de e-mail pega dup). Checar comigo:
(1) PR #15 JÁ MERGEADO — main = v2.6.2 no ar (origin/main e5c7316). Feito na sessão de 08/07. Nada a fazer aqui.
(2) FALTA testar no dia a dia (logado): lead novo por cada origem (manual/inbox/captura/import) sai com código PI do banco, sequencial (a partir de ~PI01538), sem duplicar. Recarregar com Cmd+Shift+R pra pegar a v2.6.2.
(3) Já unifiquei os 6 telefones duplicados na tela Duplicatas? Quando terminar, PEDIR pra ligar a trava de telefone (passo 2b da migration lead_id_control.sql — já pronto, comentado).
(4) A EXTENSÃO Chrome segue em stand-by (fazer no final; NÃO iniciar até eu pedir).
Me orienta em poucas linhas e engata.
```

---

## 🟢 SNAPSHOT 08/07/2026 — PR #15 MERGEADO → v2.6.2 no ar

**Resumo:** sessão curta de fechamento. O Gustavo autorizou explícito no chat e o **merge do PR #15 (`feat/id-hardening`) foi feito** + **deploy do Pages concluído com sucesso**. `origin/main` = **`e5c7316`** (v2.6.2), `main` local sincronizada (ff-only). A v2.6.2 (PI numerado pelo banco + guard do choke point no CI) é agora a versão de produção.

### Feito nesta sessão (autônomo)
- Reli o diff completo do #15 (4 arquivos, +84/−14) → **aprovado pra merge** (fallback cliente limpo p/ banco sem trigger; 23505-em-`codigo` com mensagem própria; guard CI verde).
- `gh pr merge 15 --merge` → **MERGED** (mergedAt 2026-07-08T00:00:41Z). Deploy `pages-build-deployment` = **success** (run 28907259877).
- `main` local puxada pra `e5c7316`; `index.html` = `v2.6.2 · código PI pelo banco`.

### ⭐ SOBRA pro Gustavo (amanhã)
1. **Validar logado** — lead novo por cada origem (manual/inbox/captura/import) sai com PI do banco, sequencial (próximos ~PI01538+), sem duplicar. Recarregar com **Cmd+Shift+R** pra pegar a v2.6.2. Se aparecer "colisão de código PI — recarregue", é a proteção nova funcionando (não é erro).
2. **Unificar os 6 telefones duplicados** na tela Duplicatas — 4 são mesma pessoa 2× (Luiz, Lucas Atanasio, Maurilio, Renan); 2 são julgamento dele (Rafael Farias×Raphael Freitas, "OT Dea…"×Deadigliane). **Depois PEDIR pra ligar a trava 2b de telefone** (comentada na `lead_id_control.sql`).
3. Extensão Chrome segue em **stand-by** (não iniciar até ele pedir).

---

## 🟢 SNAPSHOT 07/07/2026 — Auditoria da lógica de ID + v2.6.2 (código PI pelo banco) · [MERGEADO em 08/07]

**Resumo:** sessão de checagem (rastreabilidade de lead) que virou hardening. Duas partes: (A) **auditoria read-only** provando que todo lead recebe id + código PI e não some/duplica; (B) **fix v2.6.2** para o único risco real encontrado, com SQL já rodado em produção e testado ponta-a-ponta.

### (A) Auditoria — VEREDITO: lógica de ID ÍNTEGRA
- **Choke point confirmado:** no `index.html` só existem 2 `sb.from('leads').insert` — ambos dentro de `insertLead` (def ~1424) e `insertLeadsBatch` (def ~1455). As 4 origens passam por eles: inbox LinkedIn (~2377), manual `#n-save` (~3378, `dedupe:false` pós two-click de nome), captura múltipla (~3606), import CSV (~3675). `insertLead` normaliza derivados, roda `findLeadMatch` antes do insert (LinkedIn > telefone > e-mail bloqueiam; nome só sugere) e trata 23505. `vendas.html` **NÃO** escreve em `leads` (verificado).
- **RLS ok:** REST anônima com a publishable key devolve `*/0` — diagnóstico de dados só logado.
- **Diagnóstico logado (1.496 leads, via Chrome):** 0 sem código PI · 0 PI repetido · 0 LinkedIn dup · 0 e-mail dup · **6 telefones duplicados** (Luiz, Lucas Atanasio, Maurilio, Renan = mesma pessoa 2×; Rafael Farias×Raphael Freitas e "OT Dea…"×Deadigliane = Gustavo julga) → unificar na tela **Duplicatas**.
- **Índices reais em prod (pg_indexes):** UNIQUE em `linkedin_url_norm` (`idx_leads_url`), **`codigo` (`leads_codigo_key`)** e `id` (pkey). **NÃO havia** UNIQUE em `telefone_e164` (o header antigo da migration mentia; os 6 dups provam).

### (B) v2.6.2 — código PI numerado pelo BANCO + guard do choke point (PR #15, commit `e7c7ba2`)
- **Risco real corrigido:** como `codigo` tem UNIQUE em prod, a colisão de PI entre 2 aparelhos (contador `maxCodigoNum()` local) NÃO era cosmética — o 2º insert falhava com 23505 e o app lia como "lead duplicado", **engolindo um lead legítimo**. Fix: `insertLead`/`insertLeadsBatch` mandam `codigo` VAZIO → **trigger `trg_leads_codigo` numera com sequência atômica**; sem trigger, fallback pós-insert preenche no cliente (degradação limpa). 23505-em-`codigo` ganhou mensagem própria.
- **Guard no CI:** `scripts/guard-choke-point.mjs` + `.github/workflows/guard-choke-point.yml` — o build **falha** se `from('leads').insert` aparecer fora de `insertLead`/`insertLeadsBatch` (index.html) ou em qualquer lugar do `vendas.html`. É o teste automatizado sugerido na auditoria — nenhuma origem futura fura o controle em silêncio.
- **Migration `supabase/migrations/lead_id_control.sql`:** header corrigido + passo **2b** (trava de telefone, opcional, rodar só após unificar os 6 pares).

### SQL RODADO EM PROD (aprovado pelo Gustavo no chat) + prova E2E
- Rodado no SQL Editor (via Chrome): seção 1 da migration (sequência+trigger) + trava de e-mail. **Verificado:** `leads_codigo_seq` = 1536; UNIQUEs agora = `leads_pkey, leads_codigo_key, leads_email_norm_uq, idx_leads_url`.
- **Smoke test ponta-a-ponta no app logado** (leads de teste apagados na hora): insert sem código → banco atribuiu **PI01537** ✅; insert com e-mail repetido (caixa/espaços diferentes) → rejeitado com **`23505 leads_email_norm_uq`** ✅.

### ⭐ PENDÊNCIAS desta sessão
1. **[Gustavo] MERGEAR o PR #15** → github.com/juca-alt/crm-captacao/pull/15 (OPEN, MERGEABLE, CI verde). Self-merge foi barrado pelo classifier. O banco já está pronto pra receber a v2.6.2; a v2.6.1 atual convive normal até o merge.
2. **[Gustavo] Validar no dia a dia** — lead novo por cada origem aparece com PI do banco (sequencial) e não duplica.
3. **[Gustavo] Unificar os 6 telefones duplicados** na tela Duplicatas → depois PEDIR pra ligar a trava 2b de telefone.
4. Faxina já feita nesta sessão: branch antigo `claude/lead-id-deduplication-gqrvv3` **apagado**; `git pull` local ok; backfill de código = 0 pendentes (base já estava completa).

### Deploy / estado do repo
- `origin/main` = **`eb2640f`** (v2.6.1, inalterado até o merge do PR). Branch da sessão: `feat/id-hardening` (`e7c7ba2`), pushado, PR #15 aberto. Local `main` sincronizado com origin.

---

## 🟢 SNAPSHOT 01/07/2026 — Iteração no uso real (v2.4.3 → v2.5.3) + extensão preparada (STAND-BY) · `origin/main`=`88892e8`

**Resumo:** sessão longa de CÓDIGO, SÓ na Captação (`index.html`), guiada pelo uso real do Gustavo (ele testava logado e mandava pontos; eu corrigia e deployava em lotes). LP intocada (subiu PRs #8/#9/#10 em `vendas.html` no meio → mergeei limpo, arquivos disjuntos).

### O que entrou (deployado via Pages)
- **v2.4.3 · usabilidade:** tap targets 40px no mobile (`.tk-del/.tk-open/.star/.x`), `.qbtn` 38, `.itag` 12px, `.colpick-btn` 32, `:focus-visible` (a11y). Micro-guards JS: `toast` null-guard, `error.message||'…'`, handler de erro no `Papa.parse`, guard `||[]` no dropdown Etapa→Status.
- **v2.5.0 · VISÃO UNIFICADA (mudança de produto):** `canSeeAll()`→`true` (todo usuário com acesso vê TODOS os leads). Removidos: switcher "Ver o app como", chips Meus/Todos do inbox, campo **Responsável** dos drawers, coluna **Resp.**, bulk "→ Juca/→ Victor". No lugar: **log de atividade por lead** (`logEdit` → `lead_events` tipo `edicao`/`status`, fire-and-forget, lista os campos alterados + `usuario`). `DAY_SCOPE` fixo `'all'`.
  - **Inbox espelha o LinkedIn:** ordena por **recência** (`inboxAge()` parseia "há 2 h / 3 sem / ontem") + **área "Arquivadas"** (chip próprio; `INBOX_ARCHIVED` Set persistido em `app_settings 'inbox_arquivados'`, sincroniza; arquivar/desarquivar sem apagar dados).
  - **Save não "volta pro início do funil":** `render()` virou wrapper (`renderInner()` + `_snapScroll/_restoreScroll`) que preserva a rolagem (`.funil`/`.lkboard`/`#content`) quando NÃO troca de view.
  - **Card do kanban recolhível** (botão `▾/▸`, `KCOLLAPSED`, localStorage `kfold`).
- **v2.5.1 · etapas recolhíveis:** recolher **COLUNA/etapa** no kanban (`COLCOLLAPSED`, faixa 46px + rótulo vertical; funil e lkboard; localStorage `kcolfold`).
- **v2.5.2 · fix Unificar duplicata:** erro "falha ao atualizar registro mantido" = colisão **23505** do índice UNIQUE `linkedin_url_norm` (gravava a URL no mantido antes de apagar o dup de mesma URL). FIX: reordena → update-sem-URL → delete dups → grava URL (+ recomputa norm).
- **v2.5.3 · Recomendações navegável:** sub-abas **Todas / Rec LP / Rec OT / Rec Cliente / Rec Familiar** (com contagem) + **filtro por recomendante** (dropdown escopado à aba). Rec LP = recs dos Life Planners (ex.: Daniel); Rec OT = recs das OTs.

### Verificação (honesta)
- Tudo via preview a 375/1280px + smoke test injetando LEADS falso (builders inbox/funil/board, recência, arquivar, recolher card/coluna, ordem do applyMerge, sub-abas/filtro de Recomendações). **Console limpo em todos.** Sem `node` local → o boot no browser é o check de sintaxe.
- **⚠️ PENDE VALIDAR LOGADO** (não tenho login): menu de status (pílula colorida no card do Funil → menu flutuante), scroll preservado ao salvar, recolher etapa. O menu de status é a pendência arrastada desde o v2.4.2.

### 🔴 EXTENSÃO CHROME — STAND-BY (fazer no FINAL, ver [[crm-captacao-extensao]])
Gustavo pausou a pedido. **Tudo pronto pra retomar:** decidido publicar na **Chrome Web Store unlisted** p/ auto-update (fim do Victor reinstalar; taxa **US$5 ÚNICA** confirmada, Workspace não isenta). Preparados por mim: pacote `~/Documents/Claude/Projects/CAPTACAO LIFE PLANNER/extensao_webstore/` + zip `../captacao-extensao-webstore.zip` (7 arquivos + ícones), **política de privacidade LIVE** (`juca-alt.github.io/crm-captacao/privacidade-extensao.html`), contrato `CONTRATO_APP_EXTENSAO.md`, e um **checklist guiado** de publicação. Pendente junto: **"dados não batendo" no sync** — aguardo diagnóstico do Gustavo (é ORDEM ou INFORMAÇÃO? >100 conversas?); suspeito nº1 = seletores do LinkedIn mudaram; fix certo p/ ordem = extensão mandar a **POSIÇÃO** de cada conversa na lista.

### Deploy / paralelismo
- 6 deploys nesta sessão (v2.4.3, v2.5.0, v2.5.1, v2.5.2, v2.5.3 + política). Padrão: branch → `merge --ff-only origin/main` → `merge --no-ff` → push. LP↔Captação **sem conflito** em todos (index.html disjunto de vendas.html). `origin/main` final = **`88892e8`**.

---

## 🟢 SNAPSHOT 29/06/2026 — Estabilização da Captação (mobile + bugs) DEPLOYADA · v2.4.2

**Resumo:** sessão de CÓDIGO (Claude Code) focada SÓ na visão **Captação** (`index.html`) — correções e estabilização, a frente que o Gustavo tinha reconfirmado. Varredura ampla (3 leituras paralelas por lente) → lista priorizada → **3 lotes de fixes aplicados, verificados no preview a 375px, e DEPLOYADOS**. main local estava atrás da Visão LP no remoto (PRs #3–#5, só `vendas.html`+edge fn) → merge **sem conflito** (arquivos disjuntos, exatamente o cenário de paralelismo). `origin/main` = `17c884a`, `index.html` = **v2.4.2 · estabiliza**.

### O que entrou (3 commits + bump + 2 merges)
- **Lote 1 (`74cc969`) — mobile + bugs:**
  - 🔴 **Menu de status estava QUEBRADO em produção** (confirmado baixando o HTML no ar, byte-idêntico): `.stmenu` nascia `position:static`, sem fundo/sombra → renderizava **invisível no fim do body**. O Gustavo não via porque muda status pelo **dropdown Etapa/Status do drawer**, não pelo badge flutuante. FIX: `position:fixed`+visual no `.stmenu`.
  - Drawer do lead: "Salvar" movido pra **rodapé sticky** (`.drawer-actions`) — fim do bug histórico "Salvar fora da tela" (só o modal Novo lead tinha o fix).
  - Modais Inbox/Thread paste: ações em `.modal-actions` sticky.
  - **Bug do acento em `dupGroups`** (linha ~3402): agora normaliza tirando acento (João/Joao agrupam). Era o fix de 1 linha pendente desde 17/06.
  - `clampMenu()` mantém menus na viewport (desconta tab bar no mobile) + **fecham ao rolar a página** (não ao rolar a lista interna) + resize.
  - **ESC** fecha overlay/menu do topo + **scroll-lock** do body com overlay aberto.
  - `.row2` empilha no mobile (campos lado-a-lado não espremem no drawer).
- **Lote 2 (`787726e`) — bugs profundos:** guard contra **boot duplo** (`__booting`/`__bootedUid`: `getSession`+`onAuthStateChange` rodavam loadLeads/loadSettings 2x); **try/catch** em `loadLeads`/`loadReport`/`mLoadReport` (se a query REJEITAR a tela não trava mais em "Carregando…").
- **Lote 3 (`b4790d4`) — polimentos:** delete em massa reporta falhas ("X excluídos · Y falharam"); erro 23505 vira "Já existe um lead…"; `max-width` nos menus (iPhone SE 320px).
- **NÃO mexido de propósito:** tap targets (chips 36px/ícones 38-40px) — cosmético, exige render logado pra validar. Fica como ajuste opcional.

### Verificação (honesta)
- Tudo testado via preview a 375px com dados injetados (não logado — sem credenciais): estrutura sticky do drawer, clamp/fixed/scroll-close do menu, ESC, scroll-lock, acento, guards de boot, max-width. **Smoke test consolidado: todos os checks ✅, console limpo.**
- **PENDÊNCIA DE VALIDAÇÃO (Gustavo):** confirmar **logado em produção** que tudo se comporta certo — especialmente o **menu de status** (eu provei que estava quebrado no código; se notar algo, sinaliza). A validação logada não dá pra eu fazer (sem login).
- **Drift repo↔prod**: o menu de status estava quebrado no que está no ar, mas o Gustavo nunca reportou → ele usa o dropdown do drawer. Reforça vigiar drift.

### Deploy / tooling
- Branch `fix/captacao-estabiliza` → merge `--no-ff` na main → push REJEITADO (main remota à frente com a Visão LP) → `git merge origin/main` (disjunto, limpo) → push OK. **Lição:** sempre `git fetch` antes de deployar; LP e Captação convivem porque tocam arquivos/tabelas diferentes.
- Preview local: servidor `crm` (launch.json global) serve `/tmp/crm-preview`; copiar `index.html` pra lá + reload. O preview não navega pra URL externa (fica no localhost) — pra testar prod, baixei o HTML e servi local.

---

## 🟡 SNAPSHOT 25/06/2026 — Visão LP calibrada no PDF real, MAS upload real ERRANDO → PAUSADA

**Resumo (honesto):** sessão de CÓDIGO (Claude Code) na **Visão Life Planner** (`vendas.html`). Construí os 5 módulos (BackOffice: Atrasos/Pendências/Status T; Clientes: Aniversariantes/Datas) + a Edge Function `importar-relatorio-lp` (parser por IA) e **calibrei no PDF real** que o Gustavo mandou (`OUTLIERS - GUSTAVO JUCA.pdf`, 11 págs, 3 LPs). **MAS o upload do PDF real ainda DÁ ERRO pra ele → feature PAUSADA a pedido dele.** Não funciona de ponta a ponta ainda.

### O que foi feito (PRs #1–#5 mergeados na main; main=`a606a1d`)
- 5 módulos em `vendas.html` **v0.2** (no ar via Pages), snapshot por LP preservando status de follow-up (núcleo verificado no browser com dados de exemplo).
- Edge Function **`importar-relatorio-lp`** PUBLICADA via Chrome MCP (dashboard → Via Editor; código buscado do GitHub raw p/ não corromper). Motor **`gemini-2.5-flash-lite`** (o `gemini-2.5-flash` saturou a cota free compartilhada c/ a captura-ia → bucket próprio). Sem secret novo (reusa GEMINI_API_KEY).
- **Fix PDF grande:** o app extrai o **texto do PDF no navegador (pdf.js, por linha via coordenada Y)** e manda TEXTO (não a imagem) → não estoura o token do Gemini.
- **Calibração no layout real:** títulos ABAIXO da tabela, datas DD/MM/YYYY→ISO, prêmio vírgula→ponto, nomes multi-linha, multi-LP, colunas exatas por tipo, "APÓLICES EMITIDAS"→Atrasos, Status T = tabela `30 DIAS/2º PRÊMIO`, motivos reais.
- **Verificado** parse correto numa **AMOSTRA** do formato real. **NÃO verificado no PDF real de 11 págs** (deu erro).

### 🔴 Pendência crítica (ao RETOMAR a Visão LP — NÃO é a próxima frente)
1. **Diagnosticar o ERRO do upload real:** hard-refresh na `vendas.html`, subir o PDF, e ler o erro REAL em **Console → Network** da chamada `importar-relatorio-lp` (suspeitos: cache do navegador / flash-lite throttle no doc de 11 págs / timeout / texto ~15k chars).
2. Confirmar 3 decisões de produto: APÓLICES EMITIDAS dobrado em Atrasos? Status T = tabela 30d/2º-prêmio? Qual data dispara a `faixa` (hoje `data_2o_premio`)?
3. Depois: migration `lp_relatorio.sql` + trocar LPDB localStorage→Supabase (sync entre LPs); §4 do Cowork (regras motivo→script, janelas).

### Próxima frente (Gustavo, explícito no fechamento)
**Modo Captação MFB — foco em correções e ajustes** (= ESTABILIZAR: overhaul de usabilidade/navegação mobile + revisão ampla de bugs). A Visão LP fica **pausada** até isso.

---

## 🟢 SNAPSHOT 25/06/2026 (noite) — Captura Inteligente de leads por IA (Gemini) NO AR + Recomendações + fix mobile

**Resumo:** sessão de CÓDIGO (Claude Code). Em produção a **Captura Inteligente de leads** no `index.html` (Captação/Pipe X): cola **print / foto de papel-cartão / PDF / texto** e a IA lê e preenche os campos do lead (1 ou vários de uma vez). Motor = **Google Gemini** (free tier, **sem custo por uso** — escolha do Gustavo p/ não pagar API por captura). main = `bcfa444`.

### O que entrou (tudo live + testado por curl/preview)
- **Frontend:** botão `✨ IA` (topo desktop) + `✨ Preencher com IA` dentro do "Novo lead" (porta no mobile). Modal de captura (imagem com downscale, **PDF** cru, texto, Ctrl+V). 1 lead → abre o form pra revisar; vários → modal de lote (marca quem entra, salva em lote, dedup por LinkedIn+telefone). Campo E-mail novo no form.
- **Backend = Edge Function `capturar-lead`** (Supabase kbiinfpjfmuidyzsfegp): Gemini `gemini-2.5-flash`, `generateContent` + `responseMimeType:application/json` + schema descrito no prompt, parser defensivo, **retry até 3x em 503** (free tier dá "high demand"). Chave server-side, verify_jwt ON, CORS travado nos domínios do app, limites de tamanho.
- **RLS LIGADO** no banco (leads/lead_events/app_settings/mining_sessions/app_users · policy `crm_auth_full` to authenticated) — fecha o buraco da chave pública/anônima. Dívida antiga resolvida.
- **Novas origens de lead:** + **Rec Cliente, Rec Familiar, Instagram, Facebook** (além de LinkedIn/Rec LP/Rec OT/Abordagem Direta). Recomendante capturado em toda "Rec ..." (a IA infere, ex.: "indicado pelo cliente Marcelo" → Rec Cliente + recomendante Marcelo).
- **Novo módulo `Recomendações`** (sidebar, abaixo do LinkedIn): lista os leads de recomendação **agrupados por quem indicou**, clique abre o lead. Já populou com ~223 leads / 55 recomendantes reais. Versão simples — evoluir depois.
- **Fix mobile:** botões dos modais agora **sticky no rodapé** + modal rolável (`.modal` max-height 90vh + `.modal-actions`). Resolve o "Salvar fora da tela" no celular.

### Pendência / atenção
- **Secret do Gemini salvo como "Gemini API Key" (com espaços)** em vez de `GEMINI_API_KEY` — a função tolera (lê vários nomes alternativos). Opcional renomear no Supabase (deleta + re-adiciona com a mesma key).
- Custo: Gemini free tier (sem cartão). Tradeoff: free tier pode usar dados pra treinar; pra privacidade total, ligar billing no Google (continua barato, não treina).
- Diagnóstico via dashboard Supabase exige **aba nova do Chrome** (a aba antiga trava no `document_idle`).
- Commits: `6baaa4d` (captura base) → swap Anthropic→Gemini → origens+Recomendações `052ff18` → fix mobile `bcfa444`. Checklist de deploy local: `DEPLOY-CAPTURA-IA.html`.

### ⏭ PRÓXIMA FRENTE (declarada pelo Gustavo) — ESTABILIZAR antes de features
**Antes de evoluir qualquer coisa nova:** (1) **overhaul DEFINITIVO de usabilidade + navegação no MOBILE** (passe geral em todas as telas/modais, não só o do Novo lead); (2) **revisão ampla de erros/bugs**; (3) garantir uma **versão estável e sólida**. Bugs mobile recorrentes (o de hoje: Salvar fora da tela, corrigido pontual). Ver memória `crm-captacao-estabilizar-mobile` + regra `crm-captacao-device-layout`.

---

## 🟢 SNAPSHOT 25/06/2026 — Visão Life Planner construída + PR aberto (deploy pendente de merge)

**Resumo:** sessão de CÓDIGO (Claude Code). Construída a feature **Visão Life Planner** no `vendas.html`: o relatório semanal da Prudential (PDF) por LP vira 5 módulos operacionais. Commitada na branch `feat/lp-relatorio` (commit `37dd07f`, rebaseada sobre `6baaa4d`), **PR #1 MERGEADO em 25/06** com OK explícito do Gustavo → `origin/main`=`5c9fab5`, **`vendas.html` v0.2 no ar** (`juca-alt.github.io/crm-captacao/vendas.html`). (Obs.: push direto na main tinha sido bloqueado pelo classifier — deploy de produção exige consentimento explícito; por isso foi via PR + merge autorizado.)

### O que foi feito
- **Parser = Edge Function de IA** `importar-relatorio-lp` (espelha a `capturar-lead`): PDF → Claude com output estruturado (json_schema) → JSON das 5 seções. Robusto a layout (não precisa de amostra). ~R$0,05–0,20/upload. Em `supabase/functions/importar-relatorio-lp/`.
- **5 módulos** em `vendas.html` (nav nova **BackOffice** + **Clientes**): Atrasos (motivo classificado → ação sugerida), Pendências de Emissão, Status T (faixa de urgência), Aniversariantes e Datas de Apólice (janela de ação 15d).
- **Núcleo P0 (verificado no browser):** upsert **snapshot por LP preservando status_followup/status_contato por chave** — re-upload não zera follow-up, snapshot isolado por LP, item resolvido é arquivado (não deletado). Chave com fallback (pendências por `proposta`).
- **Persistência:** localStorage hoje (validável já via "Carregar exemplo"); costura `LPDB` pronta p/ Supabase. Migration `supabase/migrations/lp_relatorio.sql` + checklist `DEPLOY-VISAO-LP.md` prontos.
- **Derivados P1 = stubs configuráveis** (1 const cada) esperando os números do **Cowork §4** (motivo→script, qual data dispara a faixa, tamanho da janela). v0.2 · Visão LP. Bug de data sem-ano (janela não acendia) achado e corrigido.

### Estado real / divergência
- O `vendas.html` em prod era um **v0.1 PREVIEW localStorage** (não o "v1.0 Supabase" que este doc/CLAUDE.md afirmavam). A Visão LP segue localStorage com porta pro Supabase — coerente com a trilha do arquivo. **Reconciliar o CLAUDE.md.**
- **main já está em `6baaa4d`** (a captura-ia foi promovida por fora desde a0014f0); a branch da Visão LP foi rebaseada sobre ela. Só toca `vendas.html` + arquivos novos — não mexe em `index.html` nem na captura-ia.

### Próximos passos (Gustavo)
1. ✅ FEITO — PR #1 mergeado, `vendas.html` v0.2 no ar em `juca-alt.github.io/crm-captacao/vendas.html`.
2. Testar live: **Subir relatório → Carregar exemplo**; editar status numa linha → recarregar/re-importar → status persiste.
3. `supabase functions deploy importar-relatorio-lp` + testar com **PDF real** da Prudential (1º teste real, nunca rodou).
4. Rodar a migration + trocar `LPDB` localStorage→Supabase.
5. Cowork fechar os números §4.

---

## 🟢 SNAPSHOT 23/06/2026 — Migração pro Claude Code + Sistema de Sincronia de contexto

**Resumo:** sessão de ORGANIZAÇÃO (não de código). Montado o sistema que mantém o contexto do projeto sincronizado entre as 3 superfícies do Claude, pra parar de recontar tudo a cada retomada.

### O que foi montado hoje (Cowork)
- **Contrato de Sincronia** (`_SISTEMA_DE_CONTEXTO/CONTRATO_SINCRONIA.md`): define a fonte única (este ESTADO), quem lê/escreve em cada superfície (Cowork+Code escrevem, Chat só lê + propõe delta), e o ritual de início/fim de sessão. **Drive = centro** (pasta `CAPTACAO LIFE PLANNER`, id `1cGcOBuo7hb9DAzPUWiQ6OxnaMbSXfGT7`).
- **Índice de docs Prudential** (`_SISTEMA_DE_CONTEXTO/INDICE_DOCS_PRUDENCIAL.md`): os manuais/regras grandes da franqueadora (estavam como "Unknown.pdf" no Drive) agora indexados com título, resumo, palavras-chave e link → busca sob demanda, sem carregar arquivão no contexto.
- **Prompt de destilação de chats** (`_SISTEMA_DE_CONTEXTO/PROMPT_DESTILACAO_CHATS.md`): pra trazer chats antigos como MD limpo, sem entupir.
- **Snippet pro CLAUDE.md do repo** (`_SISTEMA_DE_CONTEXTO/SNIPPET_CLAUDE_MD_REPO.md`): liga o Claude Code ao contrato.

### Estado do build (do MEMORY + migração 23/06)
- **Claude Code é a oficina agora:** CC instalado/logado, repo `juca-alt/crm-captacao` clonado em `~/Documents/crm-captacao`, push de teste OK. Editar HTML no Cowork = legado; **fonte da verdade do código = repo git**. Cowork = cérebro (estratégia/validação/memória).
- **1ª feature no Code:** redesign do funil (rail lateral + lista/kanban + board) + ficha do lead (stepper das 8 etapas + abas). Branch `feat/funil-ficha`, preview LOCAL com dados reais, nada no ar sem validar. Briefing em `MIGRACAO_CLAUDE_CODE/`.
- **Redesenho mobile:** `app_crm/index-next.html` PUBLICADO no **staging** (`juca-alt.github.io/crm-captacao/index-next.html`, commit `6229f9d`; prod intocada). ⛔ **Bloqueio pra promover:** index-next foi feito sobre base local v1.27, mas a PROD no ar é v2.0 ("redesign + Visão Etapas") → reaplicar a camada mobile sobre o v2.0 antes de promover (senão regride o desktop do Victor).
- **✅ Drift de versão RECONCILIADO (1ª prova de valor do sistema):** conectei o repo `crm-captacao` e confirmei a realidade — **PROD `index.html` = v2.3 "funil único"** (359 KB); `index-dev.html` = v2.0 "redesign + Visão Etapas" (staging); **`vendas.html` v1.0 JÁ ESTÁ no repo, commitado** (43 KB). O ESTADO vinha ~5 versões atrás (dizia "v1.27, falta push"). Branches ativos: `feat/funil-ficha`, `feat/mobile-sobre-v2`, `feat/visao-geral-dup`, `design/layout-novo`. Tags `v2.0-producao` + `producao-pre-revisao-20260618`. **Lição:** sem este sistema, o contexto tinha ficado MUITO defasado do código real. Agora o repo tem `CLAUDE.md` (criado hoje) + cópia deste ESTADO.

### Foco a seguir (pedido do Gustavo)
- **Evoluir o modo Life Planner** (`vendas.html` / CRM LP) — próximo grande passo de produto. Antes de codar pesado, confirmar no Code o estado real de `vendas.html` no ar (v1.0 Supabase foi pushado?) e o RLS por `lp_email` antes do Daniel logar.

---

## 🟢 SNAPSHOT 18/06/2026 (noite) — v1.27 fixes (código) + CRM LP no Supabase (migration RODADA, CRUD ok) · falta só o PUSH

**Resumo:** sessão que (a) corrigiu no código os 2 bugs de merge que estavam pendentes e (b) tirou o CRM Life Planner do localStorage e botou no Supabase de produção, com a migration já rodada e validada. **Nada foi deployado ainda** — os 2 arquivos estão prontos na pasta, falta o Gustavo dar `git push` (ou mandar o Claude Code fazer).

### O que foi FEITO
- **`app_crm/index.html` → v1.27** (pronto, NÃO deployado):
  - **FIX applyMerge** (causa-raiz do bug 23505): agora **deleta os dups ANTES** de gravar a URL no mantido → destrava o botão ⚡ Unificar pra Gustavo e Victor. (linhas ~2055)
  - **FIX dupGroups** acento: `norm()` agora faz `.normalize('NFD')...` → "João/Joao", "José/Jose" agrupam na aba Duplicatas. Testado em node (João=Joao, São=Sao, Conceição=Conceicao). (linha ~2027)
  - Backup salvo: `app_crm/index_v1.26_prod_backup_*.html`.
- **`app_crm/vendas.html` → v1.0** (pronto, NÃO deployado): RELIGADO de localStorage→**Supabase** (tabela `vendas_contatos`).
  - **Auth herdada** do index.html (sessão Supabase é por origem → não loga de novo). Sem login = redireciona pro index.
  - **Botão "+ Novo cliente"** na aba Contatos (insert + select, grava no banco): nome*, sexo, idade, profissão, telefone, email, etapa, estrelas, origem, notas.
  - **Visibilidade real:** admin(Gustavo)=Master vê tudo; LP vê só `lp_email` próprio; **Victor(assistente) é barrado** (boot redireciona pro Captação). Switch de perfil fictício REMOVIDO (cada um é quem logou).
  - Todas as mutações (etapa, TA, notas, InfoClient, recs, status de plano) persistem via upsert. `node --check` OK. Brand agora "ISLAND · v1.0".
- **Migration `migration_v2_0_vendas.sql` RODADA no Supabase de produção** (projeto kbiinfpjfmuidyzsfegp, role postgres, via Chrome no SQL editor):
  - 1 fix necessário: `app_settings.valor` é tipo **json** → `('vendas_prox_cpp', '')` quebrava (22P02) → corrigido p/ `'""'` (no banco e no arquivo).
  - Resultado: **Success**. Tabelas `vendas_contatos` + `vendas_atrasos` criadas, RLS authenticated-full, 3 settings inseridos.
  - **CRUD verificado AO VIVO** com a sessão real do Gustavo: insert + select + delete sem erro (linha de teste apagada). Banco pronto pra dado real.
- Backlog: **B-11** (deploy Supabase do CRM LP) + **B-12** (botão Novo Cliente) logados no `FUNIL_DE_MELHORIAS.md`.

### PENDENTE (estado real)
1. **🔴 git push dos 2 arquivos** (`app_crm/index.html` v1.27 + `app_crm/vendas.html`) pro repo `juca-alt/crm-captacao` (Pages). **Passo do Gustavo** — a pasta do Cowork não é repo git e não dá pra eu digitar no Terminal (trava de tier). Opções: Terminal (janela nova + bloco abaixo) OU pedir pro **Claude Code** fazer o commit/push (mais limpo, ele tem o repo).
2. **Smoke test do vendas.html ao vivo** (login herdado / criar cliente / F5 persiste / Master vê tudo) — só DEPOIS do push (vendas.html precisa estar na origem github.io pra herdar a sessão).
3. Decidir os **12 grupos de dups restantes** (homônimos; Diego = nunca) — quando quiser.
4. Validar extensão v1.9.2 ao longo da semana.

### Bloco de deploy (Gustavo cola no Terminal — janela nova)
```bash
cd "/Users/gustavojuca/Documents/Claude/Projects/CAPTACAO LIFE PLANNER" 2>/dev/null || cd ~/"Documents/Claude/Projects/CAPTACAO LIFE PLANNER"
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git add app_crm/index.html app_crm/vendas.html
  git commit -m "CRM LP v1.0: vendas.html no Supabase + Novo Cliente; index v1.27 (fix merge/acento)"
  git push && echo ">>> DEPLOY OK <<<"
else
  echo ">>> ESTA PASTA NAO E O REPO GIT — usar GitHub Desktop ou apontar o repo."
fi
```

### Decisão estratégica (18/06 noite)
- **Migração pro Claude Code = casa certa pra EVOLUIR o app daqui pra frente** (deploy nativo via git, iteração de código mais rápida). Esta sessão provou o atrito: no Cowork apanhei pra fazer um simples `git push`. Plano de migração segue pra noite de 18/06 (ver [[migracao-claude-code]]). Cowork segue ótimo pra estratégia/consolidação/agenda.

### Tooling (lição desta sessão)
- **Transporte de SQL grande pra a página (Chrome MCP):** strings longas que eu emito sofrem corrupção por **homóglifo Cyrillic** (Ф/Р/О no meio do base64). Solução que funcionou: **base64 em 4 partes + validação regex `^[A-Za-z0-9+/=]+$` por parte** antes de decodificar/injetar. Injeção no Monaco via `monaco.editor.getEditors()[0].getModel().setValue(...)`.
- **Chrome MCP tab-grouping** falhou 1x ("Grouping is not supported by tabs in this window") e voltou na 2ª tentativa. `navigate` pra `file://` NÃO funciona (força https://). **`crypto.subtle` indisponível** no `javascript_tool` → validei por regex.

---

## 🟢 SNAPSHOT 18/06/2026 — retomada: extensão OK · LP dropdown cancelado · DEDUP-POR-NOME EXECUTADO (33 unificados) + bug do merge diagnosticado

**Resumo:** sessão de retomada dos 3 pendentes (extensão / dups por nome / LP dropdown). **Os 33 dups "certos" foram unificados (base → 995), os 8 ambíguos preservados.** Nenhum deploy de código (merge feito via execução controlada na sessão, não pelo botão do app). Bug do merge diagnosticado (causa-raiz real abaixo) e contornado.

### Decisões desta sessão
- **LP "Recomendante" → dropdown CANCELADO (Gustavo).** Fica **texto livre**. Motivo: indicação vem de **qualquer Life Planner da rede**, não só dos 1-5 do time → dropdown travaria. Pendência antiga RESOLVIDA, zero código (campo `#n-rec` em `openNovo` já é input livre).
- **Unificação de dups por nome:** Gustavo escolheu unificar só os **33 "certos"** (4 telefone idêntico + 29 mesmo nome+empresa), manter os 8 ambíguos.

### Extensão v1.9.2
- Gustavo **recarregou + testou — "a princípio ok"**, vai validando ao longo da semana (volta se houver erro).
- Zip pro Victor confirmado limpo: `extensao_captacao_v1.9.2_para_victor.zip` (manifest v1.9.2 + content.js + inbox.js + content.css + INSTRUCOES.md). Recado de reinstalação passado (Remover antiga → Carregar sem compactação → F5).

### Dedup por NOME — análise ao vivo (base 1022 leads)
- **45 grupos** de nome colidindo (94 leads): **4 telefone idêntico** (Amanda Lapa, Bruno Valença, Bianca Mendes, Jonas Lima) + **29 mesmo nome+empresa** (Bradesco/Safra/Ambev/Neo Energia…) + **9 needs-eye** + **3 empresas diferentes / homônimos** (Thiago Santos, Renato Medeiros, Victor).
- **INSIGHT:** a maioria é a **mesma pessoa capturada por você E pelo Victor** (mineração sobreposta nas mesmas empresas) → vale combinar divisão de empresas pra parar o retrabalho na fonte.
- **⚠️ Diego (needs-eye) NUNCA mesclar — uma cópia é Convertido.** (Verificado pós-merge: Diego segue 2x, intacto.)
- Triagem completa salva em **`REVISAO_DUPLICADOS_NOME_2026-06-17.md`**.
- **✅ EXECUTADO (18/06):** os **33 grupos** unificados via execução controlada (ordem segura: campos sem-URL → deleta dups → grava URL). Base **→ 995 leads**. Verificado: Amanda Lapa/Pedro Rosado/José Carlos(era 3x)/Maria Eduarda(3x)/Saulo Costa(3x) → 1x limpo, URL gravada, sem resíduo. Os **12 grupos restantes** (9 needs-eye + 3 homônimos), incl. Diego, **preservados**.

### 🐞 BUG DE MERGE — CAUSA-RAIZ CONFIRMADA (ainda latente no botão do app)
- **Erro exato:** `duplicate key value violates unique constraint "idx_leads_url"` (código **23505**) — há **índice UNIQUE em `linkedin_url_norm`**.
- **Por quê:** `applyMerge` faz `updateLead(keep, patch)` **antes** de deletar os dups. Quando o lead mantido não tem URL e o dup tem, o patch copia a URL pro mantido enquanto o dup AINDA existe com a mesma URL → colisão do índice único. (NÃO era enum — testei campo a campo: `observacoes`/`cargo`/`empresa`/`faixa_idade` passam isolados; só `linkedin_url_norm` do dup quebra.)
- **AFETA o botão ⚡ Unificar do app** pra qualquer grupo onde o mantido não tem URL e um dup tem. Nesta sessão contornei executando na ordem segura (deleta dup → grava URL); **o código do app NÃO foi corrigido.**
- **FIX do app (pendente, ~simples):** em `applyMerge`, **deletar os dups ANTES** de gravar a URL no mantido (ou separar: grava campos sem-URL → deleta → grava URL). 1 reorder.
- **`dupGroups()` gap (pendente):** agrupa nome por minúsculas mas **não tira acento** → "João/Joao", "Márcio/Marcio" não aparecem agrupados na aba Duplicatas. Fix = 1 linha (`.normalize('NFD').replace(/[̀-ͯ]/g,'')`).

### Próximos passos (priorizados)
1. **Corrigir o `applyMerge` no código** (reorder: deleta dups ANTES de gravar URL) — destrava o botão ⚡ Unificar pra todos (Gustavo + Victor) e pra futuros dups. Deploy via GitHub.
2. **`dupGroups()` tirar acento** (1 linha) — pra dups de acento ("João/Joao") aparecerem na aba Duplicatas.
3. **Decidir os 12 grupos restantes** (9 needs-eye + 3 homônimos): a maioria é homônimo/ambíguo p/ MANTER; revisar caso a caso quando quiser (Diego = nunca).
4. Validar extensão v1.9.2 ao longo da semana.

### Tooling (lição)
- **Tabs do Chrome MCP morreram em segundos** repetidamente (navigate ok → js "tab no longer exists" / "Detached while handling command"); `select_browser` no deviceId reconectou 1x. Confirma: **async `sb` via CDP é não-confiável pra MUTAR produção** → preferir a sessão estável do Gustavo (botão do app). Leitura SÍNCRONA de `LEADS` p/ análise funcionou bem.

---

## 🟢 SNAPSHOT 15-16/06/2026 — PACOTE GRANDE (fixes + features) + DEDUP da base · TUDO EM PRODUÇÃO

**No ar** em produção (juca-alt.github.io/crm-captacao/, ~47 commits) **e** no arquivo local do Gustavo (ele dá ⌘R pra pegar o código novo). Migrations todas na pasta do projeto.

### Banco (Supabase, via Chrome SQL editor)
- **`migration_fix_status_enum_2026-06-15.sql`** — `status/etapa/responsavel` de ENUM → **TEXT**. Resolveu o erro "invalid input value for enum status_funil" ao salvar na etapa **SitPlan** (o front virou a fonte da verdade; não quebra mais com status/etapa novos). Trigger reconhece SitPlan e preserva etapa em status desconhecido.
- **`migration_delay_ot_to_ta_2026-06-15.sql`** + **`migration_ta_followup_2026-06-15.sql`** — **Delay OT → etapa TA** (reunião não rolou → volta pra tentativa, mantém o status); novo status **'Follow up'** em TA. Existentes re-derivados.
- **origem** segue ENUM, só adicionei o valor **'Abordagem Direta'**.
- **`migration_dedup_2026-06-15.sql`** — BACKUP `leads_bkp_20260615` (RLS on) → normalizou URLs → limpou nomes poluídos → **unificou grupos de MESMA URL**. **Base 1182 → 995 (187 dups de URL unificados), 0 grupos de URL restantes, sem over-merge** (verificado). Restaurável do backup. Dups só-por-NOME ficaram p/ revisão na aba Duplicatas.

### App (`app_crm/index.html`)
- **Card ⚡ Agora** ignora etapas avançadas (OT/FIP/Fechamento/Dormente/Descartado) p/ sinais de inbox/telefone defasados (Heitor FIP resolvido).
- **Novo lead por ORIGEM** (LinkedIn / Rec. LP / Rec. OT / Abordagem direta): campos adaptam, **Recomendante** p/ LP/OT, Abordagem direta força responsavel=Gustavo. Acaba o nome poluído ("OT… Rec LP…").
- **Listas estilo planilha** (Contatos + Funil Captação·Lista + Pipe·Lista): cabeçalho **ordena ↑↓** + **▾ por coluna** filtra (checkboxes dos valores).
- **Botão 🔄 Sincronizar** no topbar: re-busca dados **sem reload** (não desloga; resolve o flicker do "Atualizar versão"/⌘R).
- **Templates de mensagem** no drawer: "Copiar mensagem" → **📩 Modelos** (seletor). 2 semeados: Recomendação (WhatsApp, usa `{{recomendante}}`) e Conexão LinkedIn. Mais na Config.
- normUrl canônico (tira https://www.).

### Extensão (`extensao_chrome_captacao`, v1.9.2)
- `inbox.js`: **nome limpo** (tira "O status está off-line"+headline), **foto certa** (casa alt==nome → evita avatar reciclado E a foto do próprio Gustavo no header), captura URL do perfil. Zip `extensao_captacao_v1.9.2_para_victor.zip`.

### ⏭ PENDENTE — avaliação honesta (nada disto foi testado/feito pelo Gustavo ainda)
1. **Testar ao vivo** (⌘R local): Novo lead por origem · ordenação/filtro de coluna · 🔄 Sincronizar · 📩 Modelos. **Risco baixo, mas sem validação dele ainda.**
2. **Recarregar a extensão v1.9.2** (chrome://extensions) + **F5 no LinkedIn** — sem isso o script antigo segue e novas capturas continuam com nome/foto errados.
3. **Revisar dups por NOME na aba Duplicatas** — o dedup só uniu os de URL idêntica; nome (ex.: 2 "Paulo Cavalcanti") é julgamento humano.
4. **Nomes dos LPs** — pra o "Recomendante de LP" virar dropdown (hoje é texto livre).
5. **Gating do balão "⇄ Vendas" só-admin** (Victor não deve ver Vendas) — pendência ANTIGA, NÃO mexida nesta sessão.

> Pendências antigas ainda abertas: Calendar OAuth, Gestão de Perfis (acesso por módulo), foto via Storage, deploy do Relatório v1.27 (staging), Google Doc REGISTRO_DE_EVOLUCAO.

---

## 🔎 SNAPSHOT 13/06 (parte 2) — diagnóstico "leads do Victor" + Relatório consertado (staging) + handoff a corrigir

**Diagnóstico (RESOLVIDO): NÃO há perda de dados.** Base = 1167 leads, o app carrega TODOS (paginação OK). **Victor tem 572 leads, todos visíveis a você (admin).** O "~300" que você comparou veio do **Relatório, que estava travando** ("Carregando…" — a query `mining_sessions` não resolve). Mineração nova pós-import (11-14/06) ≈ 33; os blocos grandes (10/06 = 280) são o **import da planilha do Victor**, já na base.

**Números reais do funil (estado atual, batem com a base):** **191** aguardando VOCÊ qualificar · **190** Qualificado · **56** A Enviar Convite · **139** Convite Enviado.

**⚠️ Furo no handoff (a corrigir):** você qualifica → status **"Qualificado"**, mas a fila de convite do Victor é **"A Enviar Convite"** → os **190 "Qualificado" ficam parados FORA da fila dele**. Conserto: qualificar manda o lead pra fila de convite do Victor.

**Feito nesta sessão (staging, NÃO deployado):** Relatório reescrito pra **calcular da base de leads** (síncrono, nunca trava) em `app_crm/index-dev.html` = **"DEV · v1.27 staging · Relatório confiável"** (node --check OK, validado contra os 1167 reais). ⚠️ Esse arquivo **substituiu o staging v2.0** (Vendas merged, já vetado — está no git). GitHub staging ainda tem v2.0; o v1.27 local **não foi pushado**.

### Próximos passos (priorizados)
1. **Deployar o Relatório v1.27** no staging → validar → produção.
2. **Consertar o handoff qualificar→convidar** — os 190 "Qualificado" entram na fila do Victor (decisão: incluir "Qualificado" na fila dele OU qualificar já marca "A Enviar Convite").
3. **Gestão de Perfis** em Configurações: admin add/edita/bloqueia/exclui usuário + **acesso por MÓDULO** (checkbox do que cada perfil vê); regras obedecem a isso (só Gustavo qualifica; balão "⇄ Vendas" só admin).
4. **Revisar inbox do LinkedIn + caminho completo do lead** (info sem perdas).

**Lição de tooling:** consultas async via `sb` (CDP) travam nesse app ao vivo → usar leitura SÍNCRONA de `LEADS` pra diagnóstico.

---

## 🟢 SNAPSHOT — PRODUÇÃO v1.26 · troca de SISTEMAS Captação ⇄ Vendas (LP)

**Decisão-chave (Gustavo, 13/06):** Captação e Vendas são **DOIS sistemas distintos** (modelo **LP Business**), **não** uma visão única. O v2.0 (que tinha juntado Vendas como grupo de menu dentro da Captação) foi **vetado**. A troca entre os dois é clicando o **balão de marca do topo**. Os perfis (Gustavo Master, Daniel LP, futuros) ficam **dentro do Vendas**.

**No ar (produção, repo `juca-alt/crm-captacao`, GitHub Pages):**
- Raiz **`index.html` = v1.26** = a **v1.25 do Victor (views 100% intactas)** + **balão "⇄ Vendas"** → abre o CRM de Vendas. Entrada: **https://juca-alt.github.io/crm-captacao/**
- **`vendas.html`** = CRM de Vendas (LP) = cópia de `modulo_lp_vendas/crm-life-planner.html` (v0.1), perfis **Gustavo Master / Daniel LP**, + balão **"⇄ Captação"** → volta pro `index.html`.
- Único delta nos dois = o balão virou clicável (`onclick location.href`); **nenhuma tela/funcionalidade alterada**. Testado ao vivo nos 2 sentidos (cache-bust), console limpo. Backup: `app_crm/index_v1.25_backup.html`. Leftover `app_crm/captacao.html` (cópia v1.25 do preview, pode apagar).

**Limite honesto (é a BASE INICIAL):** os dois só dividem a mesma **casa de deploy** (mesmo repo/origem → login Supabase compartilhado), **ainda NÃO a mesma base de dados real**. Captação = Supabase real (produção, 1.108 leads); Vendas = localStorage demo (exemplo Gustavo/Daniel).

### ⏭ PRÓXIMA SESSÃO — Gustavo definiu: "melhorias, ajustes e adicionar DADOS REAIS ao CRM LP"
1. **Gating do balão "⇄ Vendas" p/ só-admin** — hoje aparece p/ TODOS, inclusive **Victor** (modelo LP Business: assistente não vê Vendas). vendas.html é demo (sem dado real) → risco baixo, mas é o 1º ajuste.
2. **Dados reais no CRM LP** — portar o Vendas pro Supabase (lp_id + papel + RLS), sair do localStorage, popular com contatos reais.
3. **Melhorias/ajustes de UX** na troca e no módulo de Vendas.
4. Limpar o leftover `app_crm/captacao.html`.

> Pendências antigas da Captação seguem abertas: triar 158 grupos "Nome igual" nas Duplicatas, Google Calendar OAuth, foto via Storage, atualizar Google Doc REGISTRO_DE_EVOLUCAO. Snapshots abaixo (v1.22→v1.25) = histórico.

---

## 🔀 CONSOLIDAÇÃO 12/06/2026 — projeto "CRM Life Planner" agora mora AQUI

Este projeto virou o **guarda-chuva do CRM único da unidade Island**: Módulo 1 Captação (em produção, abaixo) + **Módulo LP/Vendas** (operação de vendas/clientes, perfis Master ↔ LP). Tudo do projeto antigo foi trazido pra `modulo_lp_vendas/` — **leia `modulo_lp_vendas/HANDOFF_MODULO_LP_VENDAS.md`** (protótipos v0.1/v0.2, modelo de dados pronto pro Supabase, decisões herdadas, caso Azos, plano de integração). Decisão inverte a de 11/06 (que mandava MFB pra lá): a casa é aqui porque aqui está o app em produção + Supabase + deploy + Victor. ⚠️ O módulo **Substituição continua EM PRODUÇÃO na pasta original** "CRM Life Planner" (localStorage — não mover). Lacuna: memória persistente do projeto antigo (benchmarks LP Business/Sekos tela-a-tela) não migra — resumo no handoff. **Pré-requisito antes de codar o módulo novo: fechar as pendências do Victor (liberar + triar duplicatas "Nome igual").**

---

## 🟢 SNAPSHOT ATUAL — PRODUÇÃO v1.22 · MVP 1.0 (+ v1.24 e CSV de import PRONTOS, NÃO APLICADOS) — leia primeiro

**App em produção:** https://juca-alt.github.io/crm-captacao/ → **v1.22 · MVP 1.0** (sem banner, console limpo, validado ao vivo 09/06). Staging `index-dev.html` = **v1.24** (com banner). Extensão **v1.9.1** (inalterada; recarga manual + F5 na aba do LinkedIn).
**Banco:** Supabase compartilhado staging↔prod. Migration `migration_v1_20_bairro.sql` rodada (col `leads.bairro`).

### O que entrou em PRODUÇÃO nesta sessão (Ondas 1-3, v1.22)
| Onda | O que é |
|---|---|
| 1 (pente-fino) | **Trava do Victor corrigida** (`uiAdmin()` esconde Usuários/Duplicatas/Perfil no preview "ver como Victor" E p/ Victor real; Duplicatas respeita `pode_duplicatas`); **nome editável** no drawer (#d-nome); botão **↗ Abrir LinkedIn**; removido "Funil completo" (toggle só **Kanban/Lista**); **choke point** em `updateLead` (recalcula primeiro_nome/linkedin_url_norm/telefone_e164 em qualquer save → consistência). |
| 2 (visual) | Menu **"Captação · LinkedIn" expansível** (`#cap-toggle`/`#cap-group`) com **Pipe LinkedIn** (ex-Funil LinkedIn) 1º; **card rico** `cardCore()` (nome·cargo·empresa·status·idade·renda·📍bairro) no Pipe + Funil Captação; campo **Bairro/CEP** (#d-bairro); aba **Contatos** (Hub = lista da base toda + drawer). |
| 3 (filtros/msg) | Filtro **Empresa multiseleção** (`F_EMPRESA` virou array, `openEmpresaMenu`); **Modelos de mensagem** em `app_settings.msg_templates` (editor na Config; botão 📩 abre seletor se 2+; {{primeiro_nome}}). |

### ⏳ v1.24 PRONTO mas NÃO DEPLOYADO (QA Victor + Duplicatas-turbo)
Arquivos validados (node --check) em `app_crm/index-dev.html` e `app_crm/index.html`. Inclui:
- **Correções do QA:** chips de situação respeitam a visão (`scope=baseLeads()`, antes mostravam total global p/ Victor); header "Gestão" some se não sobra item (`#sec-gestao`); campo Bairro/CEP também no form "Novo lead" (#n-bairro).
- **Duplicatas-turbo:** checkbox por grupo + "Selecionar todos" + **⚡ Unificar selecionados (auto)** — por grupo mantém o lead de maior avanço (`statusRank`; Descartado/Dormente baixos), junta observações (união, lossless) e campos do mais avançado, remove os dups. Funções: `statusRank`/`autoMergePlan`/`applyMerge`; `dupHTML`/`wireDup` reescritos. "Revisar" campo-a-campo mantido.
**Não subiu: automação do Chrome caiu na sessão** (find/screenshot/file_upload travam em `document_idle`, falha até no example.com; só `javascript_tool` funciona). **PROD segue v1.22.**

### 📥 Import da base do Victor (CSV pronto, NÃO importado)
Planilha viva = **"Captaçao Linkedin"** (Drive `1qsBhjUFeNjiL-THtCMRbIay2YXXRct7IN8NzQbd-U8s`, 4 abas). Gerado **`import_planilha_victor_2026-06-09.csv`** (na pasta, **288 leads únicos**). Consolidou as re-colagens sem perder nada (status originais + e-mail + datas em observacoes, tag `[IMPORT planilha 2026-06-09]`); status mapeados só a valores válidos do CRM (STATUS_BY_ETAPA); "Aguardando Convite enviado"→Convite Enviado; 6 recusas recentes corrigidas; responsável default Victor (2 do Juca). Mantém duplicatas vs a base p/ validar no Duplicatas. Distribuição: Convite Enviado 126, Qualificado 71, Aguardando Qualificacao 44, Sem Perfil 17, etc. **Falta subir no Supabase** (Table Editor → `leads` → Import CSV, append). Temporários p/ apagar: `_sheet_raw.csv`, `_sheet_raw.xlsx`, `_build_import.py`.

### QA como Victor (feito) — resultado
- ✅ Trava OK: Victor vê só a base dele (~25 leads); Usuários/Duplicatas/Perfil escondidos.
- Gaps achados → já corrigidos no v1.24 (acima).
- Falso alarme: default "Responsável" do Novo lead usa `ME` (login real) → p/ Victor real cai Victor; só no preview dá Gustavo (ok, não é bug).
- ⚠️ Possível resíduo: lead **"ZZZ TESTE QA Victor (apagar)"** pode ter ficado na base (o save travou no meio do teste) — apagar se aparecer.

### Próximos passos (priorizados) — fechar a entrega do Victor
1. **Deploy do v1.24** (2 min): GitHub `juca-alt/crm-captacao` → Add file → Upload files → subir `app_crm/index-dev.html` **e** `app_crm/index.html` → Commit (Pages 1-3 min, `?v=N`). Leva QA + Duplicatas-turbo. (Ou via Claude quando a automação do Chrome voltar.)
2. **Importar a base do Victor:** Supabase → Table Editor → `leads` → Insert ▸ Import CSV → `import_planilha_victor_2026-06-09.csv` (append, mantém dups).
3. **Validar duplicatas** no app (aba Duplicatas → Selecionar todos / marcar → ⚡ Unificar selecionados; delicados no "Revisar") → **liberar o Victor**.
4. Apagar resíduo "ZZZ TESTE QA Victor" se aparecer; apagar temporários `_sheet_raw.*` / `_build_import.py` da pasta.
5. Pendências antigas: Google Calendar bidirecional (OAuth, ~10min); foto via Storage (opcional — foto do LinkedIn expira e cai p/ iniciais).

---

## 🗂 SNAPSHOT ANTERIOR — PRODUÇÃO v1.19 + EXTENSÃO v1.9.1

**App em produção:** https://juca-alt.github.io/crm-captacao/ → **v1.19 · MVP 1.0** (sem banner). Staging `index-dev.html` = v1.19 (com banner). **Deploy feito por mim via Claude in Chrome em 09/06 e validado AO VIVO** (logado): réguas de meta, filtros do Funil, Funil Captação, Configurações — console limpo.
**Extensão:** **v1.9.1** — Gustavo precisa **recarregar manual** (chrome://extensions ⟳) **+ dar F5 na aba do LinkedIn** (senão o script antigo fica órfão).
**Migração:** `migration_v1_19_bloco1.sql` **rodada e verificada** no Supabase (`app_settings` c/ 2 metas 100/40, `leads.segmento`, `leads.convite_enviado_em`). Idempotente.

### O que entrou (Bloco 1 + 2 + 3 — tudo em produção)
| Frente | O que é |
|---|---|
| Meu Dia (Bloco 1) | Réguas de meta (⛏ Minerados / 🔗 Convites) por período (Dia ×1 / Semana ×5 / Mês ×22), 5 cards de funil, etapa **SitPlan** nova. ⚙ admin define metas/dia. |
| Funil LinkedIn | Filtros combináveis novos: **Empresa, Profissão(cargo), Segmento, Idade (até29/30-40/41+), Sexo, Renda≥10k**. Saíram origem/recomendante + chips Juca/Victor. Texto filtra ao vivo (debounce, sem perder foco). |
| Aba Qualificar (Bloco 2.1) | Cards/lista com filtros renda/idade/sexo; clica no card → drawer (edição inline). |
| Aba Funil Captação | **NOVA.** Kanban/lista das etapas SitPlan→TA→OT→FIP→Fechamento. |
| Aba Configurações | **NOVA (todos).** Trocar e-mail + senha (`sb.auth.updateUser`). |
| Perfil escondido do Victor | classe `perfil-admin` + applyPerms; Victor cai em Configurações; profile-chip vai pra config. |
| Campo Segmento | no drawer (`#d-segmento`) + no save; alimenta o filtro de segmento (nasce vazio). |
| Extensão (Bloco 3, v1.9) | Captura ganhou **Etapa inicial / Idade / Sexo**; duplicado agora **PERGUNTA se quer atualizar** (PATCH cargo/empresa/foto/cidade/idade/sexo) em vez de só barrar. |
| Fix v1.9.1 | guard `_ctxOk()` em TODO acesso a `chrome.storage` (inbox.js + content.js) — mata o erro "reading 'local'" do content script órfão pós-reload; o setInterval órfão se auto-encerra. |

### Pendências / próximos passos
1. **Gustavo:** recarregar extensão (v1.9.1) + **F5 na aba do LinkedIn** + "Remover tudo" nos erros do chrome://extensions → testar ⛏ Captar e 📌 Atualizar este lead.
2. **Victor cria conta** (nome **"Victor"** no signup) → conferir trava + permissões na aba Usuários; testar Configurações (trocar senha) com a conta dele.
3. **Onda 2 — Google Calendar bidirecional:** OAuth Client ID no Google Cloud (~10min do Gustavo) → Claude liga a sync. `gcal_event_id` já reservado.
4. Ir **preenchendo "segmento"** nos leads (alimenta o filtro). Evoluir Relatório; M-01 (telefone público) / M-07 (checklist contexto).

### Atenção (não esquecer)
- **🔑 Depois de recarregar a extensão em chrome://extensions, SEMPRE dar F5 na aba do LinkedIn** — carrega o script novo; sem isso o antigo fica órfão e estoura erro de chrome.storage. chrome:// não é automatizável → reload é clique manual do Gustavo.
- **Deploy (feito por mim via Chrome):** GitHub `juca-alt/crm-captacao` → /upload/main → file_upload (substitui na raiz) → Commit. Migração: Supabase SQL editor `monaco.editor.getEditors()[0].setValue(sql)`+Run (aviso "destructive" do `drop policy` = ok).
- **Todo update de status passa por `updateLead`** (carimba `convite_enviado_em` na 1ª vez que vira "Convite Enviado"). Single-file, sem libs novas, sem localStorage. `etapa` é string livre (SitPlan/Funil Captação não precisam migration).
- Sobras inofensivas: query salva "Configurações e campos de segmentação…" no SQL editor do Supabase (registro da migration, pode apagar) e o arquivo `app_crm/_DUPLICADO_pode_apagar_index-dev_2.html`.

---

## 🗂 SNAPSHOT ANTERIOR — PRODUÇÃO v1.18 + EXTENSÃO v1.8 (histórico)

**App em produção:** https://juca-alt.github.io/crm-captacao/ → **v1.18 · MVP 1.0** (sem banner). Staging `index-dev.html` também v1.18 (com banner). **Verificado ao vivo no Chrome** (menu novo, Mineração, Usuários, base real ~379 ativos).
**Extensão:** v1.8 — **sem mudança nesta sessão** (não precisa recarregar por causa da v1.18).
**Migração:** `migration_v1_18.sql` **rodada no Supabase** (Success): `leads.agendamento`+`gcal_event_id`, tabela `mining_sessions`, tabela `app_users` (papéis+permissões, seed admin juca@segurocomjuca.com), RLS authenticated. Idempotente.

### O que entrou (Onda 1 — tudo em produção)
| Frente | O que é |
|---|---|
| Menu pelo processo | Matou redundância (Pipeline/Lista/Novo lead saíram do menu). Agora: Meu Dia · [1. Mineração · 2. Conexão & Telefone · Funil LinkedIn] · Relatório · Usuários(admin) · Duplicatas(admin) · Perfil. "+Novo lead" segue no topbar. |
| Mineração gamificada | Abrir LinkedIn + sessão com timer (15/25/50/livre) → Play conta capturas ao vivo → Encerrar grava `mining_sessions`. Importar CSV + Captura rápida aqui. |
| Conexão & Telefone | Inbox + ação **🎯 1ª Abordagem** (promove pra TA quem tem telefone). |
| Funil LinkedIn | Só o processo (LK_FLOW). Toggle admin "Funil completo". De TA em diante sai do LinkedIn. |
| Usuários & Permissões | `app_users`; **trava do Victor** (assistente vê só responsável + 👁). Toggles por pessoa (minerar/importar/relatório/duplicatas). |
| Fotos | Sync em massa só preenche quem falta (não sobrescreve); individual sobrescreve. Foto em todas as telas. |
| Calendar base | Agendamento data+hora no drawer + faixa Agenda no Meu Dia + botão "Adicionar ao Google Calendar" (1-via, funciona já). **Bidirecional = Onda 2 (OAuth).** |
| Relatório | mining_sessions → capturas/tempo/ritmo por minerador. |

### Pendências / próximos passos
1. **Victor cria conta amanhã** (nome **"Victor"** no signup) → cai travado (vê só os dele + 👁). Ajustar permissões na aba **Usuários**.
2. **Onda 2 — Google Calendar bidirecional:** precisa OAuth Client ID no Google Cloud (~10min de setup do Gustavo) → Claude liga a sync. `gcal_event_id` já reservado.
3. Evoluir o **Relatório** (metas, gráficos) e os menores **M-01** (telefone público no perfil), **M-07** (checklist de contexto).
4. Atualizar o Google Doc "REGISTRO DE EVOLUÇÃO" no Drive (id 1O5Yjnvk2dYkJAEI8Jkye8ynsTAsmPX5-1yW0ISkdHsg) — ainda pendente.

### Atenção (não esquecer)
- **Deploy (feito por mim via Chrome):** GitHub `juca-alt/crm-captacao` → /upload/main → file_upload do index-dev.html (staging) / index.html (prod) → msg no campo "Add files via upload" → Commit changes por coordenada → Pages ~1min (`?v=N` cache-bust). Promover = copiar index-dev→index.html, apagar a linha do banner "AMBIENTE DE TESTE", APP_VERSION → 'vX · MVP 1.0'.
- **Migração via Chrome:** Supabase SQL editor, `monaco.editor.getEditors()[0].setValue(sql)` + Run (aviso "destructive" por `drop policy if exists` = ok, é só idempotência).
- **Trava do Victor é FOCO/VISÃO (client-side)**, não cadeado de segurança no banco — decisão consciente (2 usuários de confiança, sem overengineering).
- Funil de melhorias: `FUNIL_DE_MELHORIAS.md`. Changelog: `REGISTRO_DE_EVOLUCAO_CRM.md` (+ Google Doc no Drive).

---

## 🗂 SNAPSHOT ANTERIOR — PRODUÇÃO v1.17 + EXTENSÃO v1.8 (histórico)

**App em produção:** https://juca-alt.github.io/crm-captacao/ → **v1.17 · MVP 1.0** (sem banner, console limpo, ~380 leads ativos). Verificado ao vivo.
**Extensão:** v1.8 (Gustavo precisa **recarregar manual** em chrome://extensions pra subir da versão anterior).

### O que foi entregue nesta sessão (tudo em produção)
| # | Entrega | Onde |
|---|---------|------|
| Card | cargo · empresa · renda resumidos na lista do inbox e no painel direito | app |
| Sync único | 1 botão "🔄 Sincronizar tudo" (leve: só Caixa de entrada + últimas 8 msgs de cada) + barra de progresso X/N | extensão |
| Fotos | extensão captura a foto de cada conversa; app grava foto_url (preenche a cada sync) | extensão+app |
| Ingestão unificada | payload tipo:"sync" → revisão de leads + fotos + históricos casados por nome | app |
| Templates (B-07) | botão "💬 Modelos" no inbox do LinkedIn, {{primeiro_nome}}, insere no campo | extensão |
| Sync individual (B-08) | "📌 Atualizar este lead" (conversa aberta) grava aquele lead direto no Supabase | extensão |
| Menu (B-10) | módulo expansível "Captação · LinkedIn" (Pipeline, Inbox, Minerar, Abrir LinkedIn, Importar) | app |
| Timeline (B-05/06) | no card: 💬 Conversa capturada + campo de nota + histórico com ícones | app |
| Arquivar (B-04) | botão "✓ Arquivar" no inbox tira a conversa e limpa o histórico pesado | app |
| Etapa×Status (B-03) | 2 caixas dependentes (etapa → status repopula) no drawer, inbox e filtro da Lista | app |
| UX inbox (B-09) | polish estilo LinkedIn (faixa azul na seleção, espaçamento, bolhas) | app |
| Fix realtime (v1.17) | bug pré-existente: boot rodava 2x e re-inscrevia 'leads-rt' → corrigido c/ trava window.__rtSub | app |

### Confirmado por pesquisa
Arquivar conversa no LinkedIn é seguro: se a pessoa responder depois, volta pra Caixa de entrada como não lida. Fluxo: **responde → 🔄 sincroniza → arquiva** (inbox fica leve).

### Pendências / próximos passos
1. Gustavo **recarregar a extensão** (v1.8) e testar o "📌 Atualizar este lead" num thread real.
2. **M-10 — WhatsApp no CRM** via extensão (próximo grande do funil).
3. Ideias soltas no funil: M-01 (telefone público no perfil), M-07 (checklist de contexto), M-09 (data+hora OT → Google Calendar).
4. Sincronizar o `index-dev.html` no GitHub com o local (ficou em v1.16; o local tem o fix v1.17).
5. Atualizar o Google Doc "REGISTRO DE EVOLUÇÃO" no Drive numa próxima consolidação.

### Atenção (não esquecer)
- **Deploy:** GitHub `juca-alt/crm-captacao` → /upload/main → sobe index.html (prod) ou index-dev.html (staging) → commit na main → Pages republica em ~1min (usar ?v=N pra cache-bust). Promover = copiar index-dev→index.html, apagar a linha do banner "AMBIENTE DE TESTE", APP_VERSION → 'vX · MVP 1.0'.
- **Extensão:** recarregar é sempre clique manual do Gustavo (chrome:// não automatiza).
- **Responder no LinkedIn é manual** (anti-ban). O CRM é contexto + triagem + registro.
- Funil de melhorias detalhado: `FUNIL_DE_MELHORIAS.md`. Changelog: `REGISTRO_DE_EVOLUCAO_CRM.md` (+ Google Doc no Drive).

---

## 🗂 HISTÓRICO DE SESSÕES ANTERIORES (referência)

## 🟩 SESSÃO 06/06/2026 — v1.11 EM PRODUÇÃO + INBOX 2 COLUNAS (Fase 1) + HISTÓRICO DO THREAD (Fase 2 no staging)

**PRODUÇÃO hoje = v1.11** (https://juca-alt.github.io/crm-captacao/, rodapé "v1.11 · MVP 1.0", sem banner). Backup do anterior: `app_crm/index_v1.10_backup.html`.

**O que entrou em produção (v1.11):**
- O **redesign do inbox** que estava pendente no staging (KPIs + filtros de status + tela de validação "Aprovar e sincronizar" + status "1a Abordagem").
- **FASE 1 — Inbox em 2 colunas (estilo LinkedIn):** ESQUERDA = lista de conversas (clica e SELECIONA); DIREITA = painel com perfil **editável inline** (telefone/nome/status/responsável + Salvar), última mensagem em balão, Copiar mensagem, +1 ligação, **↗ Abrir no LinkedIn**, Ficha completa. Mobile = 1 coluna com "← Voltar".
- ⏳ **PENDENTE:** Gustavo aprovou o layout VISUALMENTE, mas **ainda não testou editar+Salvar ao vivo** (abriu o link sem dados/sessão). Confirmar na produção logado.

**FASE 2 — HISTÓRICO COMPLETO DO THREAD (pronta no STAGING `index-dev.html`, aguardando validação pra promover):**
- **Extensão v1.4:** novo botão roxo **📜 Captar conversa** (aparece só com um thread aberto). Lê a conversa inteira e copia JSON. ⏳ **Gustavo precisa recarregar a extensão (chrome://extensions → v1.4) e dar F5.**
- **Banco:** `migration_v1_12.sql` rodado ✅ (colunas `inbox_thread` + `inbox_thread_sync`).
- **CRM staging:** botão **📜 Colar conversa** no painel direito + render da conversa completa em bolhas (minhas à direita, do contato à esquerda). Validado por smoke test (10/10) e render ao vivo no staging.
- **Como usar:** LinkedIn abre conversa → 📜 Captar conversa → CRM Inbox seleciona o MESMO lead → 📜 Colar conversa. Responder segue MANUAL no LinkedIn (anti-ban).

**PRÓXIMAS AÇÕES:** 1) Gustavo testar editar+Salvar no inbox de produção; 2) recarregar extensão v1.4 + testar 📜 Captar/Colar num thread real no staging; 3) validado → **promover Fase 2 pra produção** (copiar index-dev→index.html, bump versão, tirar banner); 4) M-10 WhatsApp segue na fila.

---

## 🟦 SESSÃO 04/06/2026 — MVP 1.0 FECHADA + RELEASE PROCESS + FUNIL DE MELHORIAS (leia primeiro)

**Produção HOJE = v1.10** em https://juca-alt.github.io/crm-captacao/ — entregue e confirmado live:
- **v1.8 Triagem na captura:** no Garimpo, ao colar perfil → painel sugere score A-D + renda + aviso "possível seguros". Bloco `TRIAGE` editável no topo do index.html. **SÓ SUGERE — humano valida, nada bloqueia** (decisão do Gustavo).
- **v1.9 MVP 1.0:** responsivo (sidebar→drawer + backdrop no mobile) + PWA instalável (iPhone/iPad "Adicionar à Tela de Início"). Gustavo confirmou que abriu no iPhone, só falta polish.
- **v1.10 Trocar senha:** Perfil → 🔑 Trocar senha (usa sessão logada, não precisa da antiga). Resolve "esqueci a senha" — a senha do app é a MESMA da extensão.
- **Extensão v1.3:** botão "Enviar pro CRM" agora CRIA o lead direto (login no mesmo usuário do app, guarda só token, dedup + erros). ⏳ **PENDENTE: Gustavo recarregar a extensão (clique manual em chrome://extensions) e validar o envio ao vivo.**

**Processo de release (NOVO — sempre usar daqui pra frente):** ver `RELEASE_PROCESS.md`.
- Produção = `index.html` (/crm-captacao/). **Staging = `index-dev.html`** (/crm-captacao/index-dev.html, banner vermelho, mesmo Supabase).
- **Toda melhoria nova → constrói no staging → valida (web+mobile+Victor) → checa de novo → só então copia pro index.html (patch de produção).** Um banco só pros dois.

**⏳ NO STAGING, aguardando Gustavo validar pra promover a v1.11:**
- **Inbox redesenhado:** KPIs + filtros de status clicáveis + lista única estilo inbox + auto-paste do clipboard.
- **Sincronização com TELA DE VALIDAÇÃO + aprovação** (substituiu "vários botões + pede link"): tabela com Ação (cria/atualiza), Status (dropdown por etapa), Telefone (extraído), Responsável; edita e só grava ao **Aprovar e sincronizar**. + **edição em massa** (marcar todos / aplicar responsável e status).
- Migração já rodada no banco: status **"1a Abordagem"** na etapa TA (`migration_v1_11.sql`).

**📋 FUNIL DE MELHORIAS (`FUNIL_DE_MELHORIAS.md`) — modo observador, cards pra próximas evoluções:**
M-01 telefone na mineração · M-03 mobile UX kanban/lista (expert UX) · M-06 extensão ler telefone DENTRO do thread · M-07 checklist "contexto LinkedIn" (2 eixos Conexão×Conversa, mockup pronto) · M-08 templates WhatsApp · M-09 data+hora ao marcar OT (→ Google Calendar) · **M-10 WhatsApp pro CRM via extensão Chrome = FOCO DO PRÓXIMO CHAT** (inspiração: extensão "CRM para Vendas por WhatsApp"/WhatStation do RD Station — painel lateral no WhatsApp Web, ações rápidas + puxar histórico) · IDEIA-01 aba Dashboards.

**PRÓXIMAS AÇÕES (ordem sugerida):** 1) validar o inbox no staging → promover v1.11; 2) recarregar+validar extensão v1.3 (envio direto); 3) **abrir novo chat pra M-10 (extensão WhatsApp)**; 4) M-07/M-06/M-09 conforme prioridade.

---

## 🔵 SESSÃO 03/06/2026 (parte 3) — CAPTURA REAL DO INBOX (v1.7 + extensão v1.2)
Acessei o LinkedIn pelo Chrome e mapeei a página de Mensagens. **Boa notícia:** ao contrário do perfil, as classes do inbox são estáveis (`msg-conversation-listitem__*`), então a leitura é confiável. Scraper validado ao vivo no inbox real do Gustavo: 10 conversas, 4 responderam, 6 aguardando, 2 quentes (ex.: "Bianca: me liga em 20 min").

**STATUS DEPLOY (03/06 noite):** ✅ (1) migração rodada no Supabase via Chrome — "Success" (criou inbox_* + acompanhar_victor + prioridade, tudo idempotente). ✅ (3) `index.html` v1.7 commitado no repo (commit f9f18e0) e **confirmado LIVE** em juca-alt.github.io/crm-captacao (rodapé "Versão v1.7", 245 leads ativos lendo a base real). ✅ (2) Extensão recarregada pra v1.2 pelo Gustavo — botão azul **📥 Captar inbox** apareceu nas Mensagens e **deu certo** (confirmado 03/06 ~23h). (Obs: precisa F5 na página de Mensagens depois de recarregar a extensão; o botão roxo "⛏ Captar" é o de PERFIL, só serve em /in/.)

**TUDO NO AR E FUNCIONANDO.** Próximos passos pedidos pelo Gustavo: (1) melhorar o **fluxo de mineração com o Victor**; (2) melhorar o **fluxo de qualificação com o Juca**.

**Como usar o controle de inbox:**
1. No LinkedIn → **Mensagens**, clicar no botão **📥 Captar inbox** (canto inferior direito, azul) → ele rola a lista, lê todas as conversas e copia um JSON.
2. No app → aba **Inbox** → **📥 Colar inbox do LinkedIn** → cola → o app casa por nome com os leads e marca quem **respondeu**, quem está **aguardando**, e quem está **quente** (mencionou telefone/"me liga").
3. Aba Inbox ganha o bucket **"Responderam — sua vez"** (verde, no topo) mostrando a última mensagem real da pessoa, 🔥 nos quentes e "não lida". Conversas que não casam viram opção de **+ criar lead**.

**Arquivos:** `extensao_chrome_captacao/inbox.js` (novo) + `manifest.json` (v1.2, +matches /messaging/*); `app_crm/index.html` (v1.7, ingestão + bucket); `migration_v1_6.sql`; backup `app_crm/index_v1.6_backup.html`.

**Decisão de stack:** captura por **Copiar→Colar** (read-only, disparo manual) — mesma lógica do garimpo, zero risco de banimento, zero infra nova. Envio direto (Edge Function) só se o volume pedir.

**Validação:** `node --check` ok; smoke test jsdom do parse→match→aplicar→render confirmou snapshot gravado, bucket "Responderam" e 🔥 nos quentes; scraper testado no inbox real via Chrome.

**Próximo (pendente, pedido do Gustavo):** melhorias no fluxo de **mineração com o Victor** e de **qualificação com o Juca**.

---

## 🟢 SESSÃO 03/06/2026 (parte 2) — APP v1.6: perfis, kanban, inbox
Continuação direta da v1.5. **Não precisa de nova migração** (usa colunas que já existem). Pra ir ao ar: subir `app_crm/index.html` no repo GitHub → ⟳ Atualizar versão.

- **Perfis de usuário + "ver como Victor":** detecta no login se é Juca (admin) ou Victor (assistente). Chip de perfil na sidebar. Admin troca a visão por um seletor (aba **Perfil** ou chip) e vê o app como o Victor — é pré-visualização (segue logado como Juca; ações ficam no nome dele). Banner amarelo "vendo como Victor · voltar". Victor real: ferramentas de admin (Importar, Duplicatas) escondidas; abre no Meu Dia.
- **Aba Perfil:** dados do usuário, papel, seletor de visão, anel de meta de garimpo e métricas pessoais (ativos, convites a enviar/enviados, em tentativa, OTs, conversões, follow vencidos) do perfil em foco.
- **Kanban corrigido:** o board do LinkedIn não tinha regra `display:flex` (por isso "caía pra baixo"). Agora Funil e LinkedIn têm scroll horizontal limpo (`flex-wrap:nowrap`).
- **Toggle Kanban ↔ Lista + filtros** no Funil e no LinkedIn (barra de filtros padrão reaproveitada + segmented control).
- **Aba Inbox (controle de conversas):** conversas em estados do inbox (convite enviado/aceito s/tel/c/tel/aguardando retorno) ordenadas por **dias parado**, com badge vermelho ≥3d / âmbar ≥2d — resolve o "passa 1-2 dias e perco o timing". Ações rápidas (msg, telefone, ligar, +2d) + toggle Meus/Todos.
  - *Pendente (próxima rodada, precisa do Chrome dele):* puxar as mensagens reais do inbox do LinkedIn via extensão — exige mapear a página logada. Hoje o controle é por status + dias parado.
- **Validação:** `node --check` ok; smoke test jsdom renderizou perfil/inbox/funil/lista/linkedin + toggle lista + ver-como-victor + Victor real sem exceção.
- **Backup:** `app_crm/index_v1.5_backup.html`.

---

## 🟣 SESSÃO 03/06/2026 — APP v1.5 "captação em grande estilo"
Foco: deixar a parte do LinkedIn incrível pra dar acesso ao **Victor até quinta**. App reanalisado (estava em v1.3.1, mais avançado que o doc indicava) e reconstruído pra **v1.5**.

**⚠️ AÇÃO NECESSÁRIA (1x, ~10s):** rodar `migration_v1_5.sql` no SQL Editor do Supabase (adiciona `acompanhar_victor` e `prioridade`, aditivo e idempotente, não toca nos 688 leads). Depois: app → "⟳ Atualizar versão". Sem isso, tudo funciona menos "marcar OT p/ Victor" e a estrela de prioridade.

**O que entrou na v1.5:**
- **Aba "Meu Dia" (home, role-aware):** detecta no login se é Victor ou Juca e monta filas de ação diferentes.
  - *Victor:* convites a enviar · inbox (pedir telefone) · telefone recebido (passar p/ Juca) · OTs que o Juca marcou 👁 · follow-ups vencidos · anel de meta de garimpo (10/dia).
  - *Juca:* pra qualificar · telefone recebido (ligar) · em tentativa/agendar · OTs em aberto · FIP · follow-ups vencidos.
  - Toggle Meus/Todos. Cada linha tem atalhos (✓ qualificar, ➜ avançar status, 📩 msg, 📞 +1, +2d, 👁 Victor).
- **Aba "LinkedIn" dedicada:** kanban do topo do funil (Garimpado→Qualificado→Convite a enviar→Enviado→Aceito s/ tel→Tel recebido→TA). Arrasta pra avançar; cada card tem 📩 Msg, +2d, ➜ próximo. Toggle Todos/Só meus.
- **Inbox/follow-up (o "perco timing"):** campo de **próxima ação** (data) no drawer com atalhos Hoje/+1/+2/+7/Limpar; vencidos aparecem em vermelho no Meu Dia e na Lista. Estrela ★ de prioridade joga o lead pro topo das filas.
- **OT p/ Victor acompanhar:** Juca liga o 👁 numa OT (drawer, card de OT, ou em massa) → ela aparece só na fila do Victor. Não são todas, só as marcadas.
- **Multi-seleção + ações em massa na Lista:** checkbox + selecionar tudo + barra inferior (mudar status, → Juca/Victor, 👁 Victor, +2d/+7d/limpar follow, excluir).
- **Polish visual** geral (cores, cards, vazios, sidebar com seção Ações, badge "in" do LinkedIn).
- **Victor mantém acesso total** (decisão antiga preservada) — a visão dele é só *direcionada por padrão*, sem trava dura.

**Extensão Chrome v1.1 — bugs corrigidos:**
- **Foto errada:** não varre mais a página inteira pegando a maior imagem (era isso que puxava foto de outra pessoa do "Pessoas que também viram"). Agora escopa ao `<main>`, ignora `<aside>`, casa pelo nome (alt) e, na dúvida, pega a foto mais alta do cabeçalho (funciona com lazy-load). ✅ testado.
- **Empresa sumindo:** 4 âncoras em ordem de confiança (aria-label "Empresa atual" → texto ao lado do logo → link /company/ → headline "cargo at empresa"). ✅ testado.
- Recarregar no Chrome: chrome://extensions → recarregar a extensão (versão pulou pra 1.1).

**Validação:** JS sem erro de sintaxe (`node --check`); smoke test em jsdom renderizou todas as abas (hoje/linkedin/funil/lista/dup) + barra de massa + drawer sem exceção; extração da extensão testada com DOM simulado.

**Arquivos desta sessão:** `app_crm/index.html` (v1.5), `app_crm/index_v1.3.1_backup.html` (backup), `migration_v1_5.sql`, `extensao_chrome_captacao/content.js` (v1.1) + `manifest.json`.

**Próximos passos (quando retomar):** (1) rodar a migração e dar Atualizar versão; (2) Victor cria conta e testa o fluxo real; (3) opcional: envio direto da extensão via Supabase Edge Function (hoje é Copiar→Colar, confiável); (4) calibrar lead score.

---

## 🟢 SESSÃO 02/06/2026 (parte 2) — BASE ÚNICA IMPORTADA + app v1.2
- **App v1.2 no ar** (produção GitHub Pages): toggle de **Situação** (Ativos/Dormentes/Convertidos/Descartados/Todos, default Ativos) + filtros **Origem** e **Recomendante**. Pra pegar: ⟳ Atualizar versão / F5.
- **Consolidação das 3 planilhas feita** a partir do **Master_v2_Captacao_LP.xlsx** (já era base consolidada, 680 leads, aba BASE) — mais confiável que mesclar as 3 à mão.
- **Importados 617 leads novos** (dedup vs os 66 seed) via **Import CSV nativo do Supabase** (Table Editor). **Total agora = 688 leads.** Verificado: 391 dormentes, 169 qualificação, renda máx R$25k, 37 com renda≥10k, 244 no Victor.
- **Tratamentos aplicados:** Aline→Victor com `[Histórico: trabalhado por Aline]` nas obs; nomes limpos (Ot/Rec/Linkedin) com `[Nome original:...]`; origem normalizada + "Mercado X" adicionado ao enum; renda corrigida (bug de centavos); LinkedIn em triagem→Qualificado.
- **Arquivos:** `base_unica.json`, `net_new_import.csv` (na pasta), `ANALISE_BASES_E_ROADMAP.md`.
- **PENDENTE no roadmap (pedido do Gustavo):** função no app de **buscar duplicatas** + **unificar escolhendo campos** (há ~18 nomes repetidos que são julgamento humano, ex. Gabriel Chamie, Guilherme Nobre). E os ~23 "Aguardando Qualificação" sem origem pra ele triar.

---

## 🚀 SESSÃO 02/06/2026 — APP NO AR (leia primeiro)
**MVP 1.0 do frontend construído pelo Claude e hospedado de graça, ligado ao Supabase próprio.**

- **App ao vivo (permanente):** https://juca-alt.github.io/crm-captacao/
- **Repo (GitHub Pages):** github.com/juca-alt/crm-captacao (público; index.html único). Pra atualizar o app: subir novo index.html no repo → Pages republica sozinho.
- **Supabase:** URL `https://kbiinfpjfmuidyzsfegp.supabase.co` · publishable key `sb_publishable_dJIyTLNxc88kS3p3cCOZYg_laSzn727` (pública, RLS protege).
- **Auth:** e-mail/senha, confirmação de e-mail DESLIGADA → signup instantâneo. 1º acesso = cada um cria conta no próprio app (Juca e Victor). Dados ao vivo compartilhados (realtime).
- **Arquivo fonte:** `app_crm/index.html` na pasta do projeto (single-file: supabase-js via CDN + auth + Lista + Funil kanban arrastável + Novo lead/Garimpo compatível com a extensão + Drawer com timeline, copiar mensagem, registrar ligação).
- **Decisão de stack:** frontend feito no Cowork (custo fixo Max), NÃO Lovable (sem queimar crédito). Lovable "Life Planner Connect" abandonado (estava no Lovable Cloud).
- **Próximas iterações (1.1):** importar base atual (~190 leads + contatos Kommo); tela Modo Mineração cheia (pomodoro); envio direto da extensão (Edge Function → CONFIG.ENDPOINT); lead score automático; filtros salvos; export CSV; tela Hoje; teste mobile.

---

## 🔥 SESSÃO 01/06/2026 — o que mudou (leia primeiro)
**Backend está NO AR.** Criamos o Supabase próprio e carregamos os dados reais.

- **Projeto Supabase:** `crm-captacao` · org `central-financeira` (Free Plan) · região **São Paulo (sa-east-1)** · ref **`kbiinfpjfmuidyzsfegp`** · URL `https://kbiinfpjfmuidyzsfegp.supabase.co`.
- **Schema v2 rodado** (enums, leads, lead_events, saved_filters, triggers, view `vw_hoje`, RLS) — sem erro.
- **Seed rodado e verificado:** **66 leads** carregados → 19 com renda ≥ R$10k, 23 em Qualificação.
- **DECISÃO DE BACKEND:** o CRM vai usar **este Supabase próprio** (`crm-captacao`), **não** o Lovable Cloud. Motivo: dono dos dados + a extensão Chrome (passo 2) aponta pra cá.
- **Lovable — atenção:** já existe um projeto **"Life Planner Connect"** (id `c7e6af63-d8dd-42a7-8f65-cd0dca6de67e`), mas ele foi construído **em cima do Lovable Cloud** (backend gerenciado deles, stack TanStack Start), com auth/login já feitos e schema simples (só leads+lead_events, sem os 66 leads). Telas Hoje/Funil/Lista/Novo Lead **ainda não feitas**.
- **BLOQUEIO:** a conta Lovable está com **apenas 5 créditos**. Não dá pra trocar backend + construir as telas com isso. **Build do Lovable PAUSADO** nesta sessão (decisão: não queimar os 5 créditos num swap pela metade).

### Próximo passo recomendado (quando retomar)
1. **Top-up de créditos no Lovable** (decisão de gasto do Gustavo).
2. Criar um **projeto Lovable NOVO já ligado ao `crm-captacao`** desde o início (mais limpo que arrancar o Lovable Cloud do "Life Planner Connect"). Conectar via integração Supabase (OAuth — Gustavo autoriza), apontar pro projeto `crm-captacao`.
3. Colar o `Briefing_Lovable_v2.md` (v3.0) + protótipo como referência e mandar construir as telas contra o schema/leads que já existem.

---

## 1. O que é
CRM **próprio** do Gustavo (MFB Prudential, Recife), construído por módulos com **Cowork + Lovable** (Cowork gera spec/protótipo, Lovable constrói). O **Módulo 1 é a Captação de Life Planners pelo LinkedIn** — substitui as planilhas atuais.

- **Kommo está FORA.** Sem CRM externo. O CRM é o que estamos construindo.
- **2 usuários:** Gustavo (Juca) e Victor, ambos com **acesso total** (sem trava por papel; só registra quem fez via `responsavel`).
- **LinkedIn manual** + extensão Chrome de captura (sem automação de envio — risco de banimento).
- Projetar dados pra crescer (outros módulos virão), mas entregar só Captação.

## 2. Decisões tomadas (com o porquê)
- **App = Módulo 1 de um CRM próprio**, não feeder do Kommo. *Por quê:* dono dos dados, escala com o negócio.
- **Funil de 2 níveis (Etapa → Status)**, status fixos por lista. Inclui OT (Confirmação de OT, OT Realizada, Delay OT, TA Reagendar OT) e FIP (Confirmação de FIP), pedidos pelo Gustavo.
- **Régua de renda = R$ 10.000** é critério central de qualificação.
- **Nunca captar seguros/corretores** (desqualifica direto no score).
- **Enriquecimento via extensão Chrome (Rota A, grátis)**, não API paga. *Por quê:* Proxycurl morreu (jul/2025, processo da LinkedIn); APIs pagas (Bright Data/Netrows) custam cents/lead e ficam pra depois se o volume exigir.
- **Waalaxy: recomendado cancelar/pausar** (R$55/mês, estava sem uso). Captação do Gustavo é alto-toque/indicação, não combina com disparo em massa. Reavaliar só se o envio manual virar gargalo. **NÃO** construir motor de automação de envio próprio.

## 3. Mapa dos arquivos (pasta do projeto)
| Arquivo | O que é | Status |
|---|---|---|
| `ESTADO_DO_PROJETO.md` | Este doc — ponto de retomada | ✅ atual |
| `Briefing_Lovable_v2.md` | **Spec principal (v3.0)** pra colar no Lovable | ✅ atual |
| `prototipo_captacao_v2.html` | **Protótipo interativo v3.0** (referência viva de UX) | ✅ atual |
| `supabase_schema_v2.sql` | Schema do banco (enums, leads, lead_events, saved_filters, triggers, view, RLS) | ✅ **rodado no Supabase `crm-captacao` (01/06)** |
| `leads_seed_v2.sql` / `leads_seed_v2.json` | 66 leads reais tratados (de ~256 da planilha) | ✅ **rodado e verificado (66 leads) (01/06)** |
| `extensao_chrome_captacao/` | Extensão Chrome (manifest, content.js, content.css, INSTRUCOES.md) | ✅ funcionando |
| `Briefing_Lovable_Modulo_Captacao_MVP1.md` | Briefing v1 (histórico, superado pelo v2/v3) | 🗄️ histórico |
| `Master_v1/v2_Captacao_LP.xlsx`, `apps_script_master_v2.gs` | Planilhas/script originais do Gustavo (fonte) | 📎 referência |

## 4. O protótipo v3.0 — o que já faz
Abrir `prototipo_captacao_v2.html` no navegador (persiste no localStorage; recarregar reseta se limpar o storage).
- **Sidebar** (Hoje / Funil / Lista / Modo Mineração / Filtros / Funcionalidades).
- **Hoje:** filas de ação + atrasados + resumo do funil.
- **Funil:** kanban arrastável; status clicável reposiciona a etapa.
- **Lista:** edição inline em qualquer célula; status/responsável/próxima ação/score inline.
- **Filtros múltiplos + salvos** (idade, renda, empresa, sexo, etapa, score, flag) com chips; atalho "💰 Renda ≥ 10k".
- **Funcionalidades:** 🎯 Rodar qualificação (lead score A/B/C/D), 💰 Sugerir renda (heurística cargo+empresa), 📤 Exportar CSV.
- **Modo Mineração:** pomodoro (15/25/50) + anel de meta/contador; cola URL **ou** o JSON da extensão → entra com score automático.
- Campos: nome, cargo, empresa, **sexo**, idade, **renda (régua 10k)**, telefone, foto (avatar/foto).

## 5. A extensão Chrome — funcionando
Pasta `extensao_chrome_captacao/`. Instalada em modo desenvolvedor (ver `INSTRUCOES.md`).
- Botão flutuante **⛏ Captar** em perfis `linkedin.com/in/*`.
- Extrai **nome, cargo, empresa, cidade e foto** e abre um cartão editável. Validado em perfil real (todos os 4 + foto).
- **Como a extração é robusta:** a UI nova do LinkedIn usa **classes embaralhadas** (`_6bc9d9b3`), sem h1/meta/JSON estáveis. Então a extração é por **âncora/posição**: nome pelo título da aba; cartão do topo = ancestral que contém a foto (`img[src*="displayphoto"]`); cargo = linha mais longa do cartão; empresa = texto ao lado do 1º `img[src*="company-logo"]`; foto = maior `displayphoto`.
- **📋 Copiar p/ app** copia um JSON → colar no Modo Mineração preenche tudo.
- **➤ Enviar (direto)** só funcionará quando o app estiver no Supabase com endpoint — hoje usa-se Copiar→Colar.

## 6. Próximos passos (priorizados)
1. **Subir o app real:** ✅ Backend feito (Supabase `crm-captacao` com schema v2 + 66 leads, em 01/06/2026). ⏳ Falta o frontend no Lovable — **bloqueado por créditos** (ver Sessão 01/06 acima). Quando houver crédito: projeto Lovable novo ligado ao `crm-captacao` + `Briefing_Lovable_v2.md` + protótipo como UX.
2. **Ligar o envio direto da extensão:** criar uma Supabase Edge Function (no projeto `crm-captacao`) que insere o lead; colar a URL em `CONFIG.ENDPOINT` no `content.js`; adicionar o domínio em `host_permissions` no `manifest.json`. (Independe do Lovable — dá pra fazer assim que quiser.)
3. **Importar os ~190 leads restantes** (gerar CSV completo da planilha "Captaçao Linkedin").
4. **Calibrar os pesos do lead score** com o Gustavo e deixá-los configuráveis (tela de config, não hardcoded).
5. **Testar no celular** (Victor usa devices diferentes).
6. **Decidir Rota B (API paga)** de enriquecimento só se o volume crescer.

## 7. Pendências / decisões abertas
- Empresa às vezes vem vazia para perfis sem empresa no topo (estudante, autônomo) — Victor completa.
- Falta confirmar o cancelamento do Waalaxy.
- Pesos do score são um ponto de partida — ajustar com dados reais.

---
**Como retomar:** abra um novo chat neste projeto, diga "li o ESTADO_DO_PROJETO, bora no passo X" — e seguimos do ponto certo.
