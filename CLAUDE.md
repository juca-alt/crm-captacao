# CRM Captação / Vendas LP — repo do app (`juca-alt/crm-captacao`)

App single-file HTML + vanilla JS, backend **Supabase**, deploy **GitHub Pages** (main → https://juca-alt.github.io/crm-captacao/).

> ⚠️ **Projeto Supabase corrigido em 15/09/2026:** produção (index, vendas, revisao-protecao, carteira) roda em **`cjieobmdpqcupzdpckef`** — conferido nas URLs dos próprios arquivos. O `kbiinfpjfmuidyzsfegp` que constava aqui é o projeto ANTIGO e só aparece no `index-dev.html` (staging legado).

- `index.html` = **PROD Captação de LP**. Versão atual: **v2.7.0 · Instagram → CRM** (inclui QA v2.6.3; código PI numerado pelo BANCO via trigger — o app manda `codigo` vazio; dedupe por `linkedin_url_norm`, `email_norm` e `instagram_handle`).
- `vendas.html` = **PROD Visão LP** (CRM Life Planner / Vendas). Versão atual: **v8.14 · Vendas LP** (23/09/2026; histórico das ondas no `ESTADO_DO_PROJETO.md`), mobile-ready (gaveta ☰ + barra inferior). Persistência **híbrida**: contatos/funil em localStorage (chave `crmlp_v02_state`); relatório semanal (`lp_relatorio_itens`) e Carteira (`carteira_clientes`/`carteira_apolices`, RLS por dono; migration rodada 19/07) no **Supabase** quando logado, com fallback local. O PR #18 ficou OPEN no GitHub mas o conteúdo dele JÁ está na main (fechar como superado). **Não existe `vendas-dev.html` no repo.** ⚠️ O arquivo tem bytes não-UTF8 — `grep` nele exige `-a` (sem isso falha mudo).
- `index-dev.html` = staging LEGADO, defasado — não confiar sem conferir.
- `supabase/` = migrations (rodadas manualmente no SQL editor, nunca automático) + Edge Functions de IA (`capturar-lead`, `importar-relatorio-lp`; motor Gemini, secret compartilhado).
- `extensao-whatsapp/` = extensão Chrome MV3 "Captação · WhatsApp → CRM" (card do lead na conversa do WhatsApp Web; visão Captação). Choke point próprio: todo `rest/v1/leads` só em `crm-api.js` (guard de CI cobre). DOM do WhatsApp = só leitura (anti-ban).
- **Guard no CI:** `scripts/guard-choke-point.mjs` + workflow — o build FALHA se `from('leads').insert` aparecer fora de `insertLead`/`insertLeadsBatch` no `index.html`, ou em qualquer lugar do `vendas.html`. Não burlar; novas origens de lead passam por essas 2 funções.
- Responder no LinkedIn é **manual** (anti-ban). Captação: sem libs novas.

## Regras fixas de trabalho
- **UMA SESSÃO POR VISÃO:** Captação (`index.html`) e LP (`vendas.html`) em sessões separadas, nunca misturar. Arquivos/tabelas são disjuntos (`leads`/`app_users` vs `vendas_*`/`lp_*`/carteira).
- **`git fetch` antes de editar** — costuma haver sessão paralela na outra visão com a main à frente.
- **MOBILE E DESKTOP SÃO DOIS USOS LEGÍTIMOS (regra permanente, 16/08/2026).** Toda evolução entrega os dois, ajustada às particularidades de cada um — nunca o desktop encolhido. Concretamente:
  - **Pensar nos dois:** desktop (mouse, tela larga, hover, teclado, densidade) e celular (dedo, tela estreita, toque longo, safe-area, botão voltar do Android). Solução que só serve a um não está pronta.
  - **Isolar por mídia, não remendar:** o que é de celular vive num `@media` próprio; o que é de desktop fica fora dele. Nada de "empurrar com margem" o que se resolve na origem (z-index, layout, posição).
  - **Verificar nos dois ANTES de subir:** 390px e 1280px, screenshot dos dois, console limpo, zero estouro horizontal, alvo de toque ≥44px no celular, **campo de formulário ≥16px no celular** (abaixo disso o iOS dá zoom ao tocar e a tela escorrega de lado — 19/09; o portão fecha).
  - **Feature nova = feature nos dois.** O comportamento pode diferir (no celular vira folha inferior, no desktop vira modal); a CAPACIDADE, não.
- **COISA NOVA NASCE SÓ NA BASE DELE (regra permanente, 16/09/2026).** Palavra dele: *"tudo que eu for criando primeiro fica na minha base. E só depois você vai me perguntando se eu já libero pro Daniel ou pros outros usuários. Esses que já estão, deixa como tá. Primeiro eu desenvolvo bem, depois eu valido pra liberar sem erro e funcionando bem."*
  - **Toda capacidade nova entra atrás de `novoOn('<chave>')`**, registrada em `NOVO_SO_MEU` no `vendas.html` (`{o:'o que é', desde:'AAAA-MM-DD'}`). Enquanto estiver na lista: só o admin (ele) vê; os outros abrem o app sem ela, sem menu morto e sem aviso.
  - **Vale pra qualquer granularidade** — card do Início, campo da ficha, coluna, botão. `MODS` gateia MENU (tela inteira); `novoOn` gateia o resto, que é onde a maior parte do que ele pede nasce.
  - **Liberar é decisão dele, no chat, nunca minha.** Ao entregar algo novo, terminar perguntando se libera. Liberar pra todo mundo = tirar a chave de `NOVO_SO_MEU`. Liberar pessoa a pessoa = tirar daqui e registrar em `MODS` com `def:false`, que ele liga por usuário no Painel Master · Acessos.
  - **Não retroagir:** o que já estava no ar em 16/09/2026 fica como está. A lista nasceu vazia de propósito.
  - Ele revisa a lista em **Painel Master · Acessos → "🧪 Ainda só na sua base"**.
- **BLOCO DOBRÁVEL NASCE FECHADO (regra permanente, 16/09/2026).** Palavra dele: *"toda vez que abro o card ele já vem expandido… pra consultar algo tenho que ir recolhendo cada um. Assume essa regra para todos os itens expansíveis ou retráteis, os de agora e os do futuro: ao abrir a tela, vir já encolhido. O usuário que vai abrindo cada tópico que quiser."*
  - **Todo `<details>`, seção da gaveta, bloco do Início, grupo da ficha, filtro dobrável — nasce fechado.** Aberto só por escolha dele, lembrada por aparelho onde o sistema lembra (`dobraAberta(chave, estado)` é a fonte única no `vendas.html`; na Revisão de Proteção, `blkFechado()`/`secMSFechada()`).
  - **`<details open>` literal no código é proibido** — um invariante varre os scripts e fecha o portão. Abrir é sempre `${aberta?'open':''}` lido da escolha gravada.
  - **Fechado nunca apaga o número:** o cabeçalho do bloco leva o resumo (contagem, valor, estado). E toda tela com blocos tem **DOIS botões fixos: abrir tudo e recolher tudo** (um só que troca de rótulo pela maioria já o deixou sem como recolher — 16/09).
  - Isso NÃO vale pra saída impressa/apresentação pro cliente (ali o documento sai inteiro).
- **Portão de deploy = UM comando (desde 03/09, v0.44.1):** `python3 scripts/portao.py` abre `portao.html`, roda TODAS as `VIEWS_CONHECIDAS` nos 4 cenários (375 × 1280, base CHEIA × VAZIA), mede exceção / campo morto / estouro / alvos <44px, roda `lpSelfCheck` e `funSelfCheck`, e devolve 0 (aberto) ou 1 (fechado). `--prova` injeta defeito e exige que o portão acuse (o guarda se prova quebrando). Depois do merge: `python3 scripts/portao.py --servido` compara o vendas.html servido pelo Pages com o local (hash + versão) — conferência pelo CONTEÚDO servido, não pelo commit. Só python3, sem node; o iframe nunca está logado, nada toca o banco. A fixture cheia é inventada (sem PII) e traz a carteira nos DOIS formatos (importador e cockpit).

## Privacidade no repo (repo PÚBLICO — regra fixa desde 15/09/2026)
Este repositório é **público**. Dado pessoal de cliente/lead **nunca** entra em arquivo versionado — nem em `.md`, nem em comentário de código, nem em fixture de teste.
- **Nome de cliente/lead → INICIAIS** ("Ricardo Da Fonte" vira "R. D. F."). Nome da equipe (Gustavo, Daniel, Victor, Rebeca) pode ficar.
- **Número de apólice → mascarado** (`001…611`). **CPF, telefone e endereço de cliente: nunca.**
- **E-mail de operador** (é chave de acesso no RLS) fica mascarado nos docs (`victor@…`).
- Fixture de teste usa nome inventado (Fulano, Beltrano) — nunca um nome real da base.
- Higienização de 15/09/2026: 80 trocas em `ESTADO_DO_PROJETO.md`, no backup local e num comentário da extensão. **O histórico do git ainda guarda as menções antigas** — só sai com reescrita de histórico ou tornando o repo privado.

## Release (sempre)
Branch → preview LOCAL com dados reais → validar com o Gustavo → **merge na main só com autorização explícita dele no chat** (self-merge sem OK já foi barrado). O push na main é o deploy (Pages).

---

## 🔗 Contrato de Sincronia (contexto do projeto)

A fonte de verdade viva deste projeto é **`ESTADO_DO_PROJETO.md`** — **versionado neste repo desde 19/07/2026** (o histórico anterior a essa data vive no Google Drive e no `ESTADO_DO_PROJETO_backup-local-2026-07-08.md`, cópia local não-versionada).
- Centro oficial = Google Drive, pasta "CAPTACAO LIFE PLANNER". Eu (Claude Code) NÃO tenho o Drive — uso a cópia versionada do repo.
- **Início de sessão:** ler `ESTADO_DO_PROJETO.md` antes de mexer em código. Se parecer desatualizado, perguntar ao Gustavo (o Cowork pode ter versão mais nova no Drive).
- **Fim de sessão:** atualizar `ESTADO_DO_PROJETO.md` (snapshot novo no topo, datado), `git commit`, e avisar: "ESTADO atualizado no repo — sincronizar no Drive na próxima passada do Cowork."
- Eu (Code) escrevo no ESTADO do repo; o **Chat** nunca escreve (só lê + propõe delta); o **Cowork** reconcilia repo ↔ Drive.
- Docs de apoio (CONTRATO completo, ÍNDICE de docs Prudential, PROMPT de destilação de chats) ficam em `_SISTEMA_DE_CONTEXTO/` no Drive e na pasta do Cowork.
- **AUTORIZAÇÃO PERMANENTE — Notion e Drive (17/09/2026).** Palavra dele: *"Tudo permitido já previamente. Não precisa ficar me perguntando. Tudo do Notion permitido! E do Drive também."* Sincronizar ESTADO/deltas no Drive (pasta *Pipe X - Captacao Life Planner*), atualizar o **Mapa da Casa** e o **LOG DE SESSÕES** no Notion, criar/atualizar páginas e arquivos desses dois lugares: **fazer direto, sem pedir**, ao fim de cada entrega. A regra de release (merge na main só com OK dele no chat) continua como está.
