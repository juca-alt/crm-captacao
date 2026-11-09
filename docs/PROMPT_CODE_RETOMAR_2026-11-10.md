# PROMPT — retomar o CRM Visão LP (10/11/2026)

Cole numa sessão nova do Claude Code (repo `juca-alt/crm-captacao`).

---

Retomar o CRM Visão LP. Antes de tudo:
1. `git fetch origin main` e leia o topo do `ESTADO_DO_PROJETO.md` (bloco "RETOMAR AQUI — 10/11/2026") e o `CLAUDE.md`.
2. Confira se a main ainda está em v8.92 ou se outra sessão publicou por cima (o `<title>` do `vendas.html`). Se publicou, confirme que C' (v8.90), L1 (v8.91) e MENU-POR-PESSOA-V1 (v8.92) continuam lá — autotestes `C' (Victor saiu)`, `L1:`, `MENU-POR-PESSOA-V1`, `AGENDA-LIVRE-V1`.

Hoje: **L2 — parceiros nas Conversas.** Me pergunte primeiro: **A** (botão "🤝 Marcar como parceiro" na conversa, admin escolhe Joint/Embaixador/Keyman, telefone vem do chat) ou **B** (telefone + tipo keyman no cadastro de parceiros, com SQL). Recomende A.
Regras da triagem pra parceiro: assunto do parceiro → 🔴 Gustavo; agenda/horário → 🟡 Rebeca; nova indicação de keyman/embaixador → 🟡 Rebeca com aviso pro Gustavo.
Depois: J → G → F (com L3). K parado.

Regras de sempre: SQL que grava, ele roda (passo guiado, link do SQL editor do projeto certo); deploy de Edge Function e merge na main só com OK dele no chat; repo público — sem nome de cliente (iniciais), sem e-mail real de operador; testar 390 e 1280 + `python3 scripts/portao.py` verde antes de subir; blocos dobráveis nascem fechados; coisa nova pra usuário que não tem = `MODS def:false`. Fim de sessão: ESTADO + Notion (LOG DE SESSÕES) + Drive.

Estilo: ele é TDAH — veredito primeiro, curto, 2–3 opções (A/B), um passo de cada vez.
