# CRM Captação / Vendas LP — repo do app (`juca-alt/crm-captacao`)

App single-file HTML + vanilla JS, backend **Supabase** (`kbiinfpjfmuidyzsfegp`), deploy **GitHub Pages**.
- `index.html` = **PROD** (Captação de LP). Versão atual: **v2.4.1 "mobile alinhado"** (+ captura de leads por IA, commit `6baaa4d`).
- `index-dev.html` = **STAGING** (mesmo Supabase, banner de teste).
- `vendas.html` = **CRM Life Planner** (Vendas/Clientes). ⚠️ No ar (main) = **v0.1, localStorage** (`crmlp_v01_state`). As tabelas `vendas_contatos`/`vendas_atrasos` JÁ existem no Supabase (migration rodada 18/06 — confirmado por probe 25/06), mas o **port v0.2 Supabase** segue só em `app_crm/vendas.html` (NUNCA promovido pro repo). Convergir = promover+validar → staging `vendas-dev.html`.
- `vendas-dev.html` = **STAGING do Vendas** (port Supabase v0.2 + "ver como [LP]"; banner de teste). Frente Visão-LP (relatório semanal) na branch `feat/lp-relatorio`.
- Responder no LinkedIn é **manual** (anti-ban). Captação: sem libs novas, sem localStorage.

## Release (sempre)
Branch → **preview LOCAL com dados reais** → validar com o Gustavo → só então promover. Promover = copiar `index-dev`→`index.html`, bump `APP_VERSION`, tirar banner. **NADA vai ao ar sem o Gustavo validar local.**

---

## 🔗 Contrato de Sincronia (contexto do projeto)

A fonte de verdade viva deste projeto é **`ESTADO_DO_PROJETO.md`** (existe uma cópia aqui no repo).
- Centro oficial = Google Drive, pasta "CAPTACAO LIFE PLANNER". Eu (Claude Code) NÃO tenho o Drive — uso a cópia versionada `ESTADO_DO_PROJETO.md` daqui do repo.
- **Início de sessão:** ler `ESTADO_DO_PROJETO.md` antes de mexer em código. Se parecer desatualizado, perguntar ao Gustavo (o Cowork pode ter versão mais nova no Drive).
- **Fim de sessão:** atualizar `ESTADO_DO_PROJETO.md` (snapshot novo no topo, datado), `git commit`, e avisar: "ESTADO atualizado no repo — sincronizar no Drive na próxima passada do Cowork."
- Eu (Code) escrevo no ESTADO do repo; o **Chat** nunca escreve (só lê + propõe delta); o **Cowork** reconcilia repo ↔ Drive.
- Docs de apoio (CONTRATO completo, ÍNDICE de docs Prudential, PROMPT de destilação de chats) ficam em `_SISTEMA_DE_CONTEXTO/` no Drive e na pasta do Cowork.
