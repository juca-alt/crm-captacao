# Fechamento · CRM Visão LP (sessão Code nuvem: C' / Rebeca / L2) · 09/11 → 10/11/2026
_Modo: CÓDIGO/APP · fechado em 23/11/2026 só salvando (ele vai consolidar as pendências de todas as sessões numa só) · última leitura do banco: 09/11 ~17h_

> ⚠️ Desde 10/11 a main andou até **v8.94** (15/11) com outras sessões (Início T1, Revisão de Proteção calibrada, funil: ordem das colunas + filtro por pessoa/joint). O que está abaixo é o estado **desta** sessão — conferir na main antes de agir.

## ✅ Feito
**Publicado (main, cada um conferido no Pages pelo conteúdo servido)**
- **v8.90 · C' — Victor saiu** (PR #335): triagem sem 🔵 (Multi Office/VG/outros seguros → 🔴 Gustavo); Conversas sem "Victor" no "Para quem"; canal "Vitor - Corporativo" = ⚪ encerrado no vigia (nunca vermelho) e escondido por padrão; Rebeca no lugar do Victor em Solicitações e Agenda & Tarefas (chave interna `victor` mantida); "Usar o app como" só pra delegado; **AGENDA-LIVRE-V1** (agenda do dono só com disponibilidade → aviso "peça ao Gustavo a permissão de edição").
- **Edge `triagem` v2** no ar (sem destino `vitor`; 7 testes).
- **v8.91 · L1** (PR #336): Embaixadores pra não-admin sem "50% da comissão", sem renda estimada (lista, legenda e formulário) e sem o botão ✏️ E-mail.
- **v8.92 · MENU-POR-PESSOA-V1** (PR #337): 5 chaves de menu no Painel de Acessos (`menu-solicitacoes`, `menu-estoque`, `menu-sitplan`, `menu-modulos`, `menu-antigo`), nascem ligadas; regra única `viewNoMenu(view)`.

**Banco (SQL rodado por ele, conferido por mim)**
- Victor suspenso **sem DELETE**: 0 módulos, 2 delegações renomeadas `#suspenso-2026-11-09`, ban no login até 2999, fora dos times, foto do antes em `app_settings 'suspenso_victor_2026-11-09'` (o "religar" está comentado em `supabase/migrations/victor_suspenso_2026-11-09.sql`).
- Rebeca: sem Revisão, Solicitações, Estoque, SitPlan & TA e Telas antigas; **Módulos ligado** (é o caminho dela pra Conversas/Carteira/Lista de Atraso).

**Equipe**
- **Rebeca logada** (09/11 16h35, Google). Conta criada por ele no painel do Supabase (Auth › Users). Acesso conferido simulando o JWT dela: base inteira do Gustavo (6.437 nomes, 146 clientes, 238 apólices). Funil: **só Vida Individual** (decisão dele).
- Lembrete de 17/11 (Umbler/Victor) apagado da agenda.

**Leituras (L0, só leitura)**
- O `emb_gestor` já reconhece a Rebeca; todas as RPC `emb_*`, o storage `emb-anexos` e a `emb-acesso` funcionam pra ela.
- Keyman: `lp_key_contatos` (5.285) e `lp_key_leads` (1.799) com RLS e sem policy, e nenhuma tela.
- Joint: 33 cards. Parceiros: bloqueado no banco pra ela.

## 🔴 Aberto
**Code**
- **L2 (parceiros nas Conversas): aguarda A/B dele.** Achado: `parceiros` não tem coluna de telefone (1 LP parceiro + 3 embaixadores) e não existe tipo "keyman".
  - **A (recomendado):** botão "🤝 Marcar como parceiro" na conversa.
  - **B:** telefone + tipo keyman no cadastro, com SQL.
  - Regras da triagem: parceiro → 🔴; agenda/horário → 🟡; nova indicação de keyman/embaixador → 🟡 com aviso pro Gustavo.
- **J**: detecção na extensão, só leitura, versão nova. Era "A, faz e publica", mas ficou pra depois do L2.
- **G**, depois **F com L3**: títulos `[TIPO] Nome · RC` + `· EMB` / `· KEY` / `· Joint <LP>`; o joint mantém `🤝 [REVISITA] <Cliente> · Joint <LP>`; relatório mensal por origem.
- **Embaixadores (pra ele revisar antes de liberar pra Rebeca):** ninguém é avisado quando o embaixador marca "Esquentei", e não dá pra agendar nem levar pro funil a partir da tela. Proposta: aviso no Início + botão 📅 Agendar na linha esquentada.
- A renda estimada some da tela da Rebeca, mas ainda chega no navegador pela `emb_leads`. Esconder no banco, se ele quiser.
- Ideia guardada: "menu fixo por pessoa" (o admin escolhe os 📌 de cada usuário).
- **K** (transcrição de áudio): parado por decisão dele.

**Ele (à mão)**
- Google Workspace: liberar o compartilhamento externo da agenda com edição pra Rebeca. Pode já ter feito depois de 10/11.
- Tirar o Victor da pasta "Pipe X" no Drive e da agenda. Pode já ter feito.

## 🧭 Decisões da sessão
- Victor fora de tudo: suspensão reversível, **nunca DELETE**. A triagem não tem mais destino dele.
- Rebeca: só o funil Vida Individual; Embaixadores só depois da revisão dele; Módulos fica (é o caminho dela pras telas).
- Ordem do Code: **L2 → J → G → F (com L3)**. K parado.
- Menu por pessoa via chaves no `MODS` (Painel de Acessos). Config por pessoa fora do `MODS` some quando o Painel salva.

## 🔥 Livro de erros (erro → causa → regra)
1. Portão deu "fatal: VIEWS_CONHECIDAS is not defined". **Causa:** um apóstrofo ("C'") dentro de string JS com aspas simples quebrou o script inteiro. **Regra:** sem `'` dentro de `'...'` em texto de autoteste; quando o portão dá fatal, rodar `node --check` nos scripts inline.
2. Mesmo fatal, outra causa. **Causa:** entrada nova anexada no objeto `MODS` sem a vírgula da entrada anterior. **Regra:** ao anexar num objeto literal, conferir a vírgula e rodar `node --check`.
3. Quase cortei Conversas, Carteira e Atraso da Rebeca ao esconder "Módulos". **Causa:** o "Usar o app como" mostra os 📌 fixados **do admin**, não os do usuário. **Regra:** o menu real do usuário é o menu base mais os 📌 dele; conferir a central Módulos antes de esconder.
4. Rebeca não entrava: "Signups not allowed for this instance". **Causa:** o Supabase não aceita cadastro sozinho. **Regra:** criar a conta em Authentication › Users › Add user (auto-confirm) **antes** do primeiro login; o "Entrar com Google" liga na mesma conta.
5. Config por pessoa guardada fora do `MODS` seria apagada. **Causa:** o Painel de Acessos regrava `lp_perfis.modulos` só com as chaves do `MODS`. **Regra:** toda config de acesso por pessoa vira chave no `MODS`.
6. E-mail real do operador num autoteste antigo, num repo público. **Regra:** antes de commitar, `grep` pelos e-mails reais da equipe e trocar por inventado (`@exemplo.invalid`).

## ▶️ Prompt de retomada
```
Retomar o CRM Visão LP — pendências da sessão Code nuvem (C'/Rebeca/L2), salvas em 23/11.
1. git fetch origin main claude/wizardly-sagan-bwghr3. Leia o CLAUDE.md e o topo do ESTADO_DO_PROJETO.md
   (bloco "📌 23/11/2026 — PENDÊNCIAS ABERTAS da sessão Code nuvem") e docs/FECHAMENTO_SESSAO_CRM_LP_2026-11-23.md
   no branch claude/wizardly-sagan-bwghr3 (já tem a main v8.94 dentro). Trabalhe a partir da main atualizada.
2. Confira na main se C' (v8.90), L1 (v8.91) e MENU-POR-PESSOA-V1 (v8.92) seguem lá
   (autotestes "C' (Victor saiu)", "L1:", "MENU-POR-PESSOA-V1", "AGENDA-LIVRE-V1") e o que ele já resolveu à mão
   (agenda externa com edição pra Rebeca; Victor fora do Drive/agenda).
3. Me pergunte L2: A (botão "🤝 Marcar como parceiro" na conversa — recomende) ou B (telefone + keyman no cadastro).
   Depois: J → G → F (com L3). K parado. Embaixadores só depois da revisão dele.
Regras: SQL que grava, ele roda (passo guiado + link do SQL editor do projeto cjieobmdpqcupzdpckef);
deploy/merge na main só com OK dele no chat; repo público sem nome de cliente nem e-mail real;
390 e 1280 + python3 scripts/portao.py verde antes de subir; blocos nascem fechados; coisa nova = MODS def:false.
Estilo: veredito primeiro, curto, A/B, um passo de cada vez (ele é TDAH).
```
