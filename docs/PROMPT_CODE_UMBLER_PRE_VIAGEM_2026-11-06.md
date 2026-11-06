# PROMPT_CODE — Umbler pré-viagem (06/11/2026) · vigia de queda, Rebeca, autor, sync, canal privado

> Cole este texto inteiro numa sessão nova do Claude Code (repo `juca-alt/crm-captacao`).
> Fonte do diagnóstico: `docs/umbler-diagnostico-2026-11-06.md`, no repo. Cópias no Drive (pasta *Pipe X - Captacao Life Planner*) e no Notion (LOG DE SESSÕES, 06/11). **Leia o diagnóstico antes de tudo.**

## 0. Objetivo
O Gustavo viaja de **12 a 30/11** e o atendimento fica com o **Vitor** e a **Rebeca** (3ª atendente nova na Umbler, pelo número do Gustavo, foco em revisão da base e backoffice). O QR Code do canal do Gustavo caiu **2 vezes numa semana**: de 31/10 a 03/11, e de novo desde 05/11 às 14h30, confirmado em 06/11. Nada no CRM avisa quando isso acontece.

Até **11/11 (noite)**, entregar, um ticket por vez e parando pra revisão a cada um:
1. Vigia mínimo de queda (semáforo por canal).
2. Rebeca dentro do CRM.
3. Autor de cada mensagem atribuído ao membro certo.
4. Sync sem desperdício (bug de datas) + timeout do cron.
5. Lista de canais permitidos no sync. O canal novo, número pessoal do Gustavo, nasce ignorado.

## 1. Protocolo (obrigatório)
- `git fetch` e partir de `origin/main`. Ler `CLAUDE.md`, `ESTADO_DO_PROJETO.md`, `docs/umbler-diagnostico-2026-11-06.md`, `docs/umbler-leitura.md` e `docs/conversas.md`.
- Branch próprio. **Merge na main só com OK do Gustavo no chat.** Deploy de Edge Function também só com OK dele.
- **Migração e SQL que escreve no banco: ele roda no SQL editor.** O aviso de confirmação do MCP não chega no aparelho dele. Entregar o SQL pronto, idempotente, com rollback no cabeçalho.
- Regras do CLAUDE.md valem integralmente:
  - mobile **e** desktop: 390 e 1280, toque ≥ 44px, campo ≥ 16px no celular, zero estouro;
  - `python3 scripts/portao.py` verde antes de subir;
  - bloco dobrável nasce fechado (`<details open>` literal é proibido);
  - sem "abrir tudo / recolher tudo";
  - repo público: zero dado de cliente (iniciais; fixture inventada); e-mail de operador mascarado nos docs (`victor@…`).
- Liberação (refino de 29/09): melhoria em algo que o usuário **já** usa nasce liberada pra todos. Tela ou módulo **novo** vai em `MODS` com `def:false`. Na dúvida, perguntar.
- A function `umbler` **nunca envia**: só GET. A trava `POST /v1/messages` continua.
- `vendas.html` tem bytes não-UTF8: usar `grep -a` e editar por bytes.
- Fim de sessão: snapshot no topo do `ESTADO_DO_PROJETO.md`, LOG no Notion e cópia no Drive (pré-autorizados).

## 2. Tickets

### T1 — Vigia mínimo (semáforo por canal) · 2 a 3 h
- **Onde:** no topo da tela 💬 Conversas e como aviso no Início, só pra quem tem o módulo `conversas`. É melhoria em módulo que o Victor já usa, então nasce liberada. Confirmar com o Gustavo se o aviso no Início vai pra todos com `conversas`.
- **Cálculo, no app, sem tabela nova e sem cron:** por canal, `max(ultima_msg_em)` de `umbler_chats` (já lido pela RLS). **Vermelho** quando passarem mais de **3 h** sem mensagem, **de segunda a sexta, das 08h às 20h** (Recife). Também avisar "leitura parada" quando `umbler_estado.ultimo_ok` tiver mais de 30 min. Limites numa constante só (opcional: `app_settings`).
- **Texto:** "⚠️ Canal «{canal}» sem mensagem há {X} h. Abra a Umbler → Canais e confira se está conectado (releia o QR Code)." Verde: "✅ {canal}: última mensagem há {X} min".
- **Não faz:** não chama a Umbler, não grava nada, não tenta recuperar mensagens.
- **Aceite:**
  - autotestes com fixture inventada (canal parado 3 h 01 min às 14h de uma terça → vermelho; sábado → nada; 21h → nada; mensagem nova → verde; `ultimo_ok` velho → "leitura parada");
  - portão verde; prints 390 e 1280.

### T2 — Rebeca no CRM · ~1 h
- **Perguntar ao Gustavo:** o e-mail dela (mascarar nos docs), a sigla e a cor, e quais módulos ela recebe. Sugestão: os mesmos do Victor, inclusive `conversas`.
- **SQL pra ele rodar:**
  - `lp_perfis` (papel igual ao do Victor);
  - `lp_delegacoes` (dono = Gustavo, delegada = ela);
  - `lp_perfis.modulos`;
  - `app_settings.equipe` (membro com nome, sigla e cor; e ela no `times.gustavo`).
- **Conferir:** a RLS dela vê `umbler_chats`/`umbler_mensagens` e o vigia do T1; não vê a base do Daniel; a extensão loga com o usuário dela.
- **Avisar o Gustavo:** como delegada ela vê **todas** as conversas, inclusive as notas internas. Item 8 do diagnóstico: a decisão é dele.

### T3 — Autor por membro · 1 a 2 h
- `nucleo.ts`: `mapMensagem` passa a receber o mapa `membros` e preenche `autor` com `membros[sentByOrganizationMember.id]` quando o nome não vier no objeto. Passar `MEMBROS` em `gravarMsgs` e no `webhook`.
- Teste novo em `nucleo_test.ts`, com id inventado.
- **SQL de backfill pra ele rodar:** `update umbler_mensagens set autor = <nome do mapa em umbler_estado.stats->'membros'>`, onde `autor is null` e `bruto->'sentByOrganizationMember'->>'id'` estiver no mapa. Antes e depois, conferir que as 214 mensagens nossas sem autor viram Gustavo (140 + 1) e Victor (48 + 25).
- A tela Conversas já mostra `ms.autor`. Conferir que aparece o nome, e não "nós".

### T4 — Sync sem desperdício + timeout do cron · 1 a 2 h
- **Bug:** em `processarPagina` (`ult <= at.msgs_ate`) e em `sincChat` (`pg.max > antes`, `pg.max <= antes`, `pg.min >= desde`), datas são comparadas como **texto** em formatos diferentes: `…Z` (JavaScript) contra `…+00:00` (PostgREST). Nenhuma conversa é vista como "em dia".
- **Correção:** comparar por número (`Date.parse`), com um helper no `nucleo.ts` (ex.: `emDia(ult, msgsAte)`) e teste cobrindo os dois formatos.
- **Aceite depois do deploy (com OK dele):** uma rodada sem mensagem nova faz poucas requisições (páginas da cabeça + 0 por chat) e termina em bem menos de 100 s (`umbler_estado.stats.ms`); uma mensagem nova faz só aquele chat ser lido.
- **Timeout do cron:** SQL pra ele rodar, que reagenda o `umbler-sync` com `timeout_milliseconds := 20000`, mantendo a chave no Vault exatamente como está na migração `umbler_v1_leitura.sql`.
- **Aceite do timeout:** em `net._http_response`, nenhuma linha com timeout nas próximas 6 h.

### T5 — Lista de canais permitidos · 3 a 5 h
- **Pra quê:** o Gustavo vai conectar outro número dele, com conversas pessoais. Ele deve ser visível só pra ele e **o texto não pode ser gravado no CRM**. Hoje o sync lê `ChatState=All` sem filtro: um canal novo seria gravado inteiro, com texto, no 1º cron depois de conectado.
- **Como:** lista de **canais permitidos** (ids) lida pela function `umbler` (ex.: `app_settings.umbler_canais`, só admin escreve). Valor inicial: o canal do Gustavo e o do Vitor, este enquanto existir. Os ids estão em `umbler_chats.bruto->'channel'->>'id'`.
- Em `processarPagina` e no `webhook`: se o canal do chat **não** estiver na lista, pular o chat inteiro. Não grava chat, mensagem, `bruto`, nome nem telefone, e não chama `relative-messages`.
- Sem lista configurada, o comportamento é o de hoje (não pode quebrar o que funciona).
- **Aceite:**
  - teste no `nucleo_test.ts` (chat de canal fora da lista → nada gravado);
  - depois do deploy, SQL de conferência: 0 linhas de canal fora da lista;
  - documentar no `docs/umbler-leitura.md`.
- **Ordem:** isto precisa estar no ar **antes** de o Gustavo conectar o número novo. Avisar ele disso na entrega.

## 3. Fora do escopo (não fazer agora)
- Copiloto 2.11: T1 a T5, tom, fila. Será replanejado depois da viagem. Atenção à colisão de versão: a 2.10.0 da main é a do portal.
- Coexistência / API oficial (dezembro).
- Webhook: cadastrar na Umbler é ação do Gustavo, depois do T4.
- Remover o canal do Vitor (esperar as respostas da Umbler).
- Tabela `wa_historico` (existe vazia e sem código no repo; só registrar).

## 4. Pendências do lado do Gustavo (lembrar na entrega)
- Reler o QR Code do canal dele e avisar. A sessão confere no banco: `max(ultima_msg_em)` por canal tem que voltar a andar em até 10 min.
- Responder pelo celular ou pelo WhatsApp Web quem escreveu durante a queda (desde 05/11, 14h30). A Umbler não recupera esse período.
- Mandar as 13 perguntas da seção 9 do diagnóstico pra vendedora da Umbler.
- E-mail, sigla, cor e módulos da Rebeca (T2).

## 5. Entrega
Diff por ticket + testes que rodaram + prints 390/1280 (T1) + SQL pronto pra ele rodar (T2, T3, T4). Parar a cada ticket. No fim: ESTADO atualizado, LOG no Notion, cópia no Drive e a pergunta de liberação.
