# PROMPT_CODE — Equipe nova no CRM e na Umbler (07/11/2026) · Rebeca entra, Vitor fica no MO/VG, "ver como" de verdade, T3+T4 no ar

Você é o engenheiro do CRM Visão LP do Gustavo (repo `juca-alt/crm-captacao`, Supabase `cjieobmdpqcupzdpckef`, `vendas.html` + Edge Function `umbler`). Leia `CLAUDE.md` e o topo do `ESTADO_DO_PROJETO.md` antes de mexer em qualquer coisa. Este prompt substitui o T2 a T5 do `docs/PROMPT_CODE_UMBLER_PRE_VIAGEM_2026-11-06.md` (o T1, o vigia de queda, já está no ar: v8.85).

## 0. Objetivo
Deixar a equipe nova rodando no CRM e na Umbler, e o Gustavo conseguir **ver na prática** o que cada assistente enxerga antes de liberar.

## 1. Decisões já tomadas (palavra dele, 07/11)
- **Rebeca entra** no atendimento e no backoffice (no lugar do backoffice da LM). Ela já foi assistente dele. Atende pelos números do Gustavo, na Umbler, com assinatura própria. Foco: revisão da base, carteira, atrasos e pós-venda.
- **Vitor fica por enquanto, só na parte Multi Office e Vida em Grupo (VG).** Ele tem outro trabalho e não entrega no tempo do atendimento do WhatsApp. **Sai da Umbler**, e a Rebeca fica com a vaga dele (2 usuários: Gustavo e Rebeca).
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

### A — Publicar o T3 + T4 da função `umbler` (pronto no branch `claude/umbler-t3-t4`) · 30 min
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

### B — Rebeca no CRM (login e acesso) · 1 h
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

## 4. Fora do escopo (agora)
- T5 (canais permitidos); API oficial / coexistência; copiloto 2.11 (fila, tom, voz por remetente) e transcrição de áudio própria, que ficam para depois de a operação rodar; `wa_historico`.

## 5. Entrega
Por ticket: diff, testes que rodaram, prints (D), SQL pronto (A, B, C) e a pergunta de liberação. No fim: ESTADO atualizado, LOG no Notion, cópia no Drive.
