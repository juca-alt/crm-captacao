# 📌 ESTADO — VISÃO LP (vendas.html) · CRM Island
**Última atualização:** 03/07/2026 · **Foco desta visão:** SÓ `vendas.html` (LP/Vendas). Captação (`index.html`) tem sessão própria — **não tocar**.
> Modelo de trabalho: **uma sessão por visão** (LP ↔ MFB em paralelo). Regras de paralelismo no fim deste doc.

---

## ▶️ PROMPT PRA COLAR NA PRÓXIMA SESSÃO DE LP
```
Retoma a VISÃO LP do CRM Island (vendas.html). Lê primeiro o
~/Documents/crm-lp-build/ESTADO_VISAO_LP.md. Trabalha SÓ na visão LP,
worktree ~/Documents/crm-lp-build. Não toca em index.html.
PRIMEIRO: checa o PR #12 (Carteira frente A: Oportunidades + contato +
radar) — se eu ainda não mergeei, me lembra de mergear (1 clique) e de
validar LOGADO (reimportar os 2 .xls + conferir Oportunidades/drawer).
BACKLOG (decidir ordem comigo):
 B) Frente 2 (PARADA em feat/lp-supabase, commit 10042aa): separar
    segurado≠pagador no PDF. Falta só nome longo em 2 linhas (3 reg).
    Precisa REBASE (main andou: Carteira #11 + evolução #12).
 C) IA "de graça" via plano/Workspace (fallback do import, sem pagar Gemini).
 D) Persistência Supabase da Carteira (fase 2, shape já pronto no CART).
 E) (Opcional) Isolamento por-LP no RLS quando entrar identidade real.
```

## ⏱ ESTADO EM 30 SEGUNDOS (atualizado 03/07 — sessão Oportunidades)
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
- **Fonte:** 2 relatórios da Prudential exportados como `.xls` = **tabelas HTML (Latin-1)**, não Excel binário. Lidos **localmente via DOMParser, sem IA**. Import com 2 slots (`openCarteiraImport`).
- **Modelo** (`CART` em localStorage `crmlp_carteira_v1`, shape pronto pro Supabase fase 2): `clientes[]` + `apolices[]` ligados por SEGURADO (`ref=normKey(nome)`), join validado 120/120.
- **Normalização de dinheiro:** `"1.121,84"`→1121.84; dígitos puros = /100. PA=anual, PM=mensal.
- **UI:** sidebar 👥 → Visão (5 KPIs) + Clientes (busca) + Oportunidades (novo) + drawer.

### ⚙️ FRENTE 2 (PARADA — `feat/lp-supabase` commit `10042aa`, precisa REBASE)
- Feito: `lpPdfText` preserva coluna (gap >4pt → `\x1f`), `parseStatusT/parseAtrasos` separam seg≠pag sem IA, fix de segmentação por layout. gustavo 13→140 / daniel 1→54, regressão zero no colado.
- Falta: 3 registros de nome longo em 2 linhas físicas (nome truncado).

### 🗺 BACKLOG CONSOLIDADO (pra próxima sessão)
0. ~~Evoluir Carteira (frente A)~~ ✅ FEITO 03/07 (PR #12) — falta só Gustavo mergear + validar logado.
1. **Frente 2**: nome-quebrado (merge de linha-continuação) + rebase + deploy.
2. **IA "de graça"** via plano/Workspace (fallback do import).
3. **Persistência Supabase da Carteira** (fase 2 — shape do `CART` pronto).
4. (Opcional) Isolamento por-LP no RLS.

> Snapshot do doc local `~/Documents/crm-lp-build/ESTADO_VISAO_LP.md` (versão completa com histórico das sessões anteriores fica no local).
