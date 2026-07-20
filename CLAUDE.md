# CRM Captação / Vendas LP — repo do app (`juca-alt/crm-captacao`)

App single-file HTML + vanilla JS, backend **Supabase** (`kbiinfpjfmuidyzsfegp`), deploy **GitHub Pages** (main → https://juca-alt.github.io/crm-captacao/).

- `index.html` = **PROD Captação de LP**. Versão atual: **v2.7.0 · Instagram → CRM** (inclui QA v2.6.3; código PI numerado pelo BANCO via trigger — o app manda `codigo` vazio; dedupe por `linkedin_url_norm`, `email_norm` e `instagram_handle`).
- `vendas.html` = **PROD Visão LP** (CRM Life Planner / Vendas). Versão atual: **ISLAND · v0.3.1 · Visão LP**, mobile-ready (gaveta ☰ + barra inferior). Persistência **híbrida**: contatos/funil em localStorage (chave `crmlp_v02_state`); relatório semanal (`lp_relatorio_itens`) e Carteira (`carteira_clientes`/`carteira_apolices`, RLS por dono; migration rodada 19/07) no **Supabase** quando logado, com fallback local. O PR #18 ficou OPEN no GitHub mas o conteúdo dele JÁ está na main (fechar como superado). **Não existe `vendas-dev.html` no repo.** ⚠️ O arquivo tem bytes não-UTF8 — `grep` nele exige `-a` (sem isso falha mudo).
- `index-dev.html` = staging LEGADO, defasado — não confiar sem conferir.
- `supabase/` = migrations (rodadas manualmente no SQL editor, nunca automático) + Edge Functions de IA (`capturar-lead`, `importar-relatorio-lp`; motor Gemini, secret compartilhado).
- **Guard no CI:** `scripts/guard-choke-point.mjs` + workflow — o build FALHA se `from('leads').insert` aparecer fora de `insertLead`/`insertLeadsBatch` no `index.html`, ou em qualquer lugar do `vendas.html`. Não burlar; novas origens de lead passam por essas 2 funções.
- Responder no LinkedIn é **manual** (anti-ban). Captação: sem libs novas.

## Regras fixas de trabalho
- **UMA SESSÃO POR VISÃO:** Captação (`index.html`) e LP (`vendas.html`) em sessões separadas, nunca misturar. Arquivos/tabelas são disjuntos (`leads`/`app_users` vs `vendas_*`/`lp_*`/carteira).
- **`git fetch` antes de editar** — costuma haver sessão paralela na outra visão com a main à frente.
- Mobile e desktop = visões distintas: ancorar layout por device ao evoluir qualquer tela.

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
