# PROMPT_CODE — Equipe nova no CRM e na Umbler (07/11/2026) · Rebeca entra, Vitor fica no MO/VG, "ver como" de verdade, T3+T4 no ar

Você é o engenheiro do CRM Visão LP do Gustavo (repo `juca-alt/crm-captacao`, Supabase `cjieobmdpqcupzdpckef`, `vendas.html` + Edge Function `umbler`). Leia `CLAUDE.md` e o topo do `ESTADO_DO_PROJETO.md` antes de mexer em qualquer coisa. Este prompt substitui o T2 a T5 do `docs/PROMPT_CODE_UMBLER_PRE_VIAGEM_2026-11-06.md` (o T1, o vigia de queda, já está no ar: v8.85).

## 0. Objetivo
Deixar a equipe nova rodando no CRM e na Umbler, e o Gustavo conseguir **ver na prática** o que cada assistente enxerga antes de liberar.

## 1. Decisões já tomadas (palavra dele, 07/11)
- **Rebeca entra** no atendimento e no backoffice (no lugar do backoffice da LM). Ela já foi assistente dele. Atende pelos números do Gustavo, na Umbler, com assinatura própria. Foco: revisão da base, carteira, atrasos e pós-venda.
- **Vitor fica por enquanto, só no CRM, na parte Multi Office e Vida em Grupo (VG)** (confirmado 07/11 19:53: "vamos deixar Vitor só no CRM mesmo por hora"). Ele tem outro trabalho e não entrega no tempo do atendimento do WhatsApp. **Sai da Umbler**, e a Rebeca fica com a vaga dele (2 usuários: Gustavo e Rebeca).
- **Números na Umbler, no máximo 2, ambos do Gustavo:** (1) o WhatsApp Business principal (clientes); (2) um número de **prospecção** (chip de outro telefone, sem conversa pessoal). O **número do Vitor sai** depois de avisar os clientes (aviso com data de 14/11). O número pessoal do Gustavo **fica fora** da Umbler.
- **T5 (lista de canais permitidos) SAI do escopo:** não há número pessoal entrando.
- **Sem API oficial por enquanto.** Palavra dele: "vamos deixar tudo pronto sem API… caso não [rode bem], avalio; não quero ter esse custo agora sem ter operação rodando".
- **Viagem: 12 a 30/12/2026** (não é novembro). Prazo deste prompt: tudo rodando bem antes, idealmente nesta semana.

## 2. Protocolo (obrigatório)
- **Um ticket por vez.** Ao fim de cada um, pare, mostre e espere o OK dele.
- **Merge na main e deploy de Edge Function só com o OK dele no chat**, para aquele item.
- **SQL que grava no banco: ele roda.** Você entrega o SQL pronto, com conferência antes e depois.
- **Repo público:** nada de dado de cliente, telefone, CPF nem e-mail de operador (mascarar: `rebeca@…`).
- Tela nova ou mudança de tela: testar em **390 e 1280**, prints dos dois, e `python3 scripts/portao.py` verde antes de subir. Na nuvem (Linux): `PORTAO_CHROME=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome`.
- Bloco dobrável nasce fechado; capacidade nova segue a regra `NOVO_SO_MEU` / `MODS` do `CLAUDE.md`.
- Fim de sessão: `ESTADO_DO_PROJETO.md` atualizado, LOG no Notion e cópia no Drive (autorização permanente).

## 3. Tickets

### A — ✅ FEITO 07/11 19:54 (umbler v5 no ar; falta ele rodar o SQL) — Publicar o T3 + T4 da função `umbler` · 30 min
- **O que tem lá:**
  - **T3:** `mapMensagem` recebe o mapa de membros e preenche o autor quando a API manda só o id.
  - **T4:** helper `cmpData`/`emDia` no `nucleo.ts`. Antes, as datas eram comparadas como texto (`…Z` contra `…+00:00`), e nenhuma conversa ficava "em dia".
  - **Testes:** 14 deno, 3 novos. A rede da nuvem bloqueia o `jsr:`: use um import map local com `assert`/`assertEquals`.
- **Passos:**
  1. Revise o diff (`git diff origin/main origin/claude/umbler-t3-t4 -- supabase/`).
  2. Rode os testes.
  3. Com o OK dele, faça o deploy da `umbler` (verify_jwt **false**, como hoje; arquivos `index.ts` + `nucleo.ts`).
  4. Mande ele rodar `supabase/migrations/umbler_t3_t4_2026-11-07.sql`: backfill de autor (141 do Gustavo + 74 do Victor) e cron com timeout de 20 s.
  5. Faça o merge do branch na main.
- **Aceite:**
  - na próxima rodada, `umbler_estado.stats.ms` bem abaixo de 100 s e `req` caindo para as páginas da cabeça mais os chats com novidade;
  - `ainda_sem_autor = 0`;
  - em 6 h, nenhum `timed_out` novo em `net._http_response`.

### B — Rebeca no CRM (login e acesso) · 1 h · **ela começa segunda, 10/11** (mês de teste até 10/12; alinhamento toda sexta às 12h30)
- **Antes, perguntar a ele:** o **e-mail** dela (ele está pedindo a ela), a sigla e a cor (sugestão: **RC, laranja**).
- **Módulos:** proponha uma tabela com o que o Victor tem hoje. Recomendação: o pacote de backoffice + Carteira + Conversas + Solicitações + Agenda nova + Funil novo; **sem** Parceiros e Plano. Peça A/B.
- **SQL pra ele rodar:**
  - `lp_perfis` (papel igual ao do Victor, `modulos` da tabela aprovada);
  - `lp_delegacoes` (dono = Gustavo, delegada = Rebeca);
  - `app_settings.equipe` (nome, sigla, cor; e ela em `times.gustavo`).
- **Conferir:**
  - a RLS dela lê `umbler_chats`/`umbler_mensagens` e vê o vigia;
  - não vê a base do Daniel;
  - o botão 🔄 Sincronizar funciona pra ela (a função `umbler` aceita delegado);
  - a extensão do Chrome loga com o usuário dela.
- **Avisar ele:** como delegada, ela vê todas as conversas do canal profissional, inclusive as notas internas.

### C — Vitor só no Multi Office e VG · 30 min
- Levante os módulos atuais dele (`lp_perfis.modulos`) e proponha o recorte. Recomendação: fica com `funis_extra`, `fu-mfo`, `funil-unico`, `ficha-ux2`, `agenda-global`, `planos`, `solic-*`; **sai** `conversas` (ele deixa a Umbler) e o que for só de vida individual/backoffice da carteira. Peça A/B antes de gerar o SQL.
- A delegação dele **continua** (ele precisa ver os negócios MFO/VG do dono).
- SQL pra ele rodar, com conferência.

### D — "Ver como" de verdade: o Gustavo usa o app com a visão do assistente · 2 a 3 h
- **Hoje:** o "👁️ Ver o que ele enxerga" (`admVerComo`, em Acessos & Módulos) só lista os menus num modal.
- **Pedido dele:** "quero ver como vai ser a visão deles na prática".
- **Como:** um botão **"👁️ Usar o app como {nome}"** no mesmo lugar.
  - Liga um **modo visual** que aplica, só nesta aba, o perfil da pessoa: papel, `modulos` e a regra de `novoOn`, que fica desligada para quem não é admin.
  - O app inteiro se redesenha como ela veria: menus, Início, telas e ficha.
  - Em cima de tudo, uma **faixa fixa** "Você está vendo como {nome} — [Sair]". No celular ela fica acima da barra inferior, sem cobrir nada.
- **Regras:**
  - não troca a sessão;
  - não lê a conta da pessoa;
  - **não grava nada enquanto o modo estiver ligado**: toda escrita é bloqueada com toast "modo ver como: só leitura";
  - sair (ou recarregar) volta ao normal;
  - só o admin vê o botão.
- **Dado:** como delegados leem as linhas do dono, a tela mostra o dado real que ela veria. Um aviso pequeno na faixa: "dados do dono; o que vem da RLS (ex.: base do Daniel) pode diferir".
- **Aceite:**
  - self-check `VER-COMO-V1` (entra, menus batem com `admMods`, escrita bloqueada, sair restaura `PERFIL`);
  - prints 390/1280 como Rebeca e como Vitor;
  - portão verde.
- Entregar perguntando se ele quer o botão também na ficha do usuário.

### E — Checklist da Umbler (ação DELE, você só confere no banco depois)
Entregue esta lista pronta pra ele, na ordem:
1. Convidar a **Rebeca** como membro (assinatura ligada). Quando ela aceitar, a sessão confere o mapa `umbler_estado.stats->'membros'` com o nome dela.
2. Mandar, pelo número do Vitor, o aviso aos clientes (texto já entregue no chat, com data de 14/11).
3. **Conectar o número de prospecção** como canal novo. Confira no banco:
   - os chats dele aparecem em `umbler_chats.canal`;
   - o vigia (T1) mostra o canal novo em 💬 Conversas.
4. Em 14/11: remover o Vitor como membro e desconectar o canal "Vitor - Corporativo". O vigia passa a mostrar o canal como ⚪ inativo depois de 7 dias.
5. No celular, manter **no máximo 3 dispositivos conectados** (hoje: Umbler, Mac e o Global CRM, que faz a transcrição de áudio).

### F — Agenda da Rebeca: "quem marcou" + tipo alinhado ao funil · 2 a 3 h
**Decisões dele (07/11, etapas 1 a 6):**
- A Rebeca **edita a agenda principal dele** (Agenda Jucá, Google). Opção escolhida por ele; o risco de ela ver eventos pessoais foi avisado.
- **Janelas em que ela pode marcar:** seg 12h–20h · ter a qui 9h30–20h · sex 9h30–13h. Fora disso, nunca.
- **Formato:** online = 45 min + 15 min de folga; presencial = 45 min + 30 min de deslocamento antes e depois. **Sem limite** de reuniões por dia.
- **Tipos que ela marca (todos):** Revisão (base), OI (1ª reunião, indicação), P/C (proposta/fechamento), Delivery (entrega de apólice). O tipo vira a **etiqueta do evento** na Agenda Jucá, **alinhada com a etapa do funil no CRM**.
- **O que construir (sem gravar nada no Google sem o OK dele; leia antes o que a Agenda & Tarefas nova já faz com o Google):**
  - **Padrão do título do evento**, legível pelo CRM: `[TIPO] Nome do cliente · RC` (RC = sigla de quem marcou). Proponha a cor de cada tipo dentro da convenção dele (COMERCIAL 🔴, PIPELINE 🔵…), sem usar as cores de GAEL+FAMÍLIA 🟢, PESSOAL 🟣 e CAMILA 🩷.
  - **"Quem marcou"** em cada reunião do CRM (Rebeca, Vitor, Gustavo), lido do título ou do campo próprio.
  - **Validador de janela:** ao marcar pelo CRM, avisar se o horário cai fora das janelas acima ou se choca com outro evento, contando o deslocamento no presencial.
  - **Relatório do mês por quem marcou:** marcadas, realizadas, não compareceu, por tipo. No 1º mês **não há meta de número** (é teste); é só medir.
- Aceite: self-check `AGENDA-EQUIPE-V1` (janelas, folga e deslocamento, parse do título); prints 390/1280; portão verde.

### G — Fila de revisões da Rebeca · 2 a 3 h
- Antes, leia o que já existe (Aniversário de Apólice `lp-datas`, revisão anual do Lote Global 2) e proponha o **mínimo**: uma fila diária de quem chamar, com estado por cliente (a convidar · convidado · agendado · recusou · retomar em…) e atalho pra abrir a conversa em 💬 Conversas e marcar na agenda.
- Inclui a carteira adotada da Rebeca (adoção/substituição) como origem da fila.
- Pergunte A/B a ele antes de construir.

### I — Copiloto faz o trabalho de bastidor, a Rebeca só conversa · 1 dia
**Pedido dele (09/11):** "quero você [copiloto] resolvendo; foco dela nas interações". Nada de etiquetar nem renomear à mão na Umbler.
**Dado que sustenta (conferido em 09/11, 30 dias):** de 152 conversas com telefone, **61 casam com cliente da carteira** e **116 com contato do funil** pelos 8 últimos dígitos. Sobram **35**, quase todas da equipe, de grupos ou pessoais. Na Umbler, as 143 conversas do mês estão **sem etiqueta** e 22 estão **sem nome** (ou ".").
1. **Identificar pelo telefone, no CRM, sem gravar nada na Umbler:** em 💬 Conversas, cada conversa ganha o nome que o CRM conhece (carteira > funil > nome da Umbler) e um selo: **Cliente** (carteira, com a apólice), **No funil** (etapa), **Recomendação** (origem) ou **Desconhecido**. A Umbler continua como está; o CRM é quem enriquece.
2. **Triagem do copiloto** (antecipa o T2 da 2.11, `copiloto_fila`): cada conversa aguardando resposta cai num destino:
   - 🔴 **Gustavo decide** (proposta, preço, recomendação, venda nova, retenção/cancelamento, cliente preocupado);
   - 🟡 **Rebeca** (agenda, confirmação, documento, pagamento, atraso, pós-venda, carteira adotada);
   - 🔵 **Vitor** (Multi Office, VG, outros seguros);
   - ⚪ **Sem ação** (agradecimento, "ok", grupo).
   Classificação pela IA (Haiku, o mesmo cliente Anthropic do copiloto, dados sensíveis tirados antes com `redact()`), com cache por conversa e reclassificação só quando chega mensagem nova. Sem texto de conversa nos logs.
3. **Onde aparece:** a fila 🟡 abre a tela da Rebeca (junto com a fila de revisões do ticket G); a 🔴 vira o filtro "Gustavo decide" dele; a 🔵 vai pro Vitor.
- Aceite: self-check `TRIAGEM-V1` com conversas inventadas para cada destino; prints 390/1280; portão verde; nenhuma escrita na Umbler.
- Ordem sugerida: B → I → G → F → C → D (I e G são o que tira trabalho da Rebeca no dia 1).

## 4. Fora do escopo (agora)
- T5 (canais permitidos); API oficial / coexistência; copiloto 2.11 (fila, tom, voz por remetente) e transcrição de áudio própria, que ficam para depois de a operação rodar; `wa_historico`.

## 5. Entrega
Por ticket: diff, testes que rodaram, prints (D), SQL pronto (A, B, C) e a pergunta de liberação. No fim: ESTADO atualizado, LOG no Notion, cópia no Drive.
