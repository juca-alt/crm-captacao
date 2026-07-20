# ESTADO DO PROJETO — CRM Captação / Vendas LP

> ⚠️ **Nota de reconciliação (19/07/2026):** a cópia versionada deste arquivo estava **ausente do repo** (o CLAUDE.md referencia ela, mas não existia commit). Este arquivo recomeça aqui com o snapshot da sessão de hoje. **Cowork:** na próxima passada, reconciliar com a versão oficial do Drive (pasta "CAPTACAO LIFE PLANNER") — o histórico anterior vive lá.

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
