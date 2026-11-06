# Diagnóstico Umbler Talk × CRM — 06/11/2026 (só leitura)

> Feito sem alterar nada: nenhum código, deploy, DDL, gravação, cron ou secret. Consultas ao banco só com SELECT.
> Horários em Recife (UTC−3). Sem dado de cliente: só contagens e IDs técnicos.
> **Atualização 06/11, 12:07:** o Gustavo confirmou pelos prints a queda do canal dele (a Umbler mostra "há 20 horas" enquanto o WhatsApp Web tem mensagens de hoje). Próximo passo dele: reler o QR Code.
> Próximo passo de código: `docs/PROMPT_CODE_UMBLER_PRE_VIAGEM_2026-11-06.md`.

## ⚠️ Três achados

| # | Achado | Evidência | Ação |
|---|---|---|---|
| **A** | **O canal "Atendimento GUSTAVO JUCA" ficou sem nenhuma mensagem desde 05/11, 14h30.** O canal do Vitor seguiu normal. | Última mensagem no banco: 05/11 14:30. A própria lista da API da Umbler, lida às 11:51 de 06/11, confirma. O canal do Vitor tinha mensagem às 11:39 de 06/11. Num dia útil normal, o canal do Gustavo tem de 200 a 500 mensagens. | **Confirmado pelo Gustavo às 12:07** → reler o QR Code. É a 2ª queda em uma semana (a 1ª foi de 31/10 a 03/11). |
| **B** | **Bug no sync: nenhuma conversa é vista como "em dia", então cada rodada relê tudo que cabe no tempo.** | O código compara datas como texto em formatos diferentes: `…Z` (JavaScript) contra `…+00:00` (PostgREST). Como `Z` vem depois de `+`, uma data igual parece "mais nova". No banco, 477 de 489 chats já estão em dia (`msgs_ate = ultima_msg_em`). Mesmo assim, a última rodada fez 112 requisições, gravou 0 mensagens e usou 101 s, ou seja, todo o orçamento. | Ticket 4 (1 a 2 h). |
| **C** | **O copiloto nunca foi usado de verdade.** | As 11 sugestões gravadas são todas do usuário de teste (26/10 e 02/11). A extensão da main não tem tela de copiloto. O código da function só existe no branch `claude/copiloto-t1`, que não foi mergeado. | Replanejar o 2.11 (seção 6). |

---

## 1. Estado atual

### Functions
| Function | Versão no ar | Atualizada | verify_jwt | Código no repo |
|---|---|---|---|---|
| `umbler` | v4 | 23/10 | off (trava própria) | Igual à main (`supabase/functions/umbler/`) |
| `copiloto-sugerir` | v6 | 24/10 | off (confere o JWT por conta própria) | **Só no branch `claude/copiloto-t1`**, fora da main |
| Outras | `crm-mcp` v10, `capturar-lead` v4, `importar-relatorio-lp` v4, `emb-acesso` v3, `bn-import-temp` v4, `faxina-backup` v1 | | | |

### Cron (pg_cron)
| Job | Agenda | Ativo |
|---|---|---|
| `umbler-sync` | a cada 10 min | ✅ |
| `lp_varredura_diaria_2am` | 02h | ✅ |

### Saúde do sync (`umbler_estado`, 06/11 11:51)
| Item | Valor |
|---|---|
| Último sync / último OK | 06/11 11:51 / 11:51 |
| Último erro | nenhum |
| Duração | **101,4 s** (orçamento de 100 s; estoura sempre) |
| Requisições | 112. Varia, porque quem limita é o tempo, não o trabalho a fazer. |
| Mensagens gravadas na rodada | **0** |
| Páginas da "cabeça" | 3 (cerca de 150 chats); parou por tempo |
| Varredura completa / histórico | completa; 0 chats pendentes |
| Base | 489 chats · 6.854 mensagens |
| Membros mapeados | 2 |

### Chamadas do cron (`net._http_response`; o banco só guarda cerca de 6 h)
| Resultado | Qtde (06/11, 06:00 → 11:50) |
|---|---|
| 200 `{"ok":true,"iniciado":true}` | 29 |
| **Timeout de 5 s do pg_net** | **7** (06:00, 07:30, 08:00, 08:30, 09:00, 09:40, 10:00) |

O pg_net corta a chamada em 5 s. Quando a function demora a acordar, a chamada cai e não dá pra saber se aquela rodada aconteceu. Isso afeta perto de 1 em cada 5 rodadas.

### Webhook
| Item | Estado |
|---|---|
| Rota `?k=` na function | Existe: guarda o evento cru e relê o chat pela API |
| Chave no Vault | Existe (`umbler_webhook_chave`) |
| `umbler_eventos` | **0 linhas, desde sempre** |
| **Por que está vazia** | A URL nunca foi cadastrada no painel da Umbler. O `docs/umbler-leitura.md` já marcava isso como pendência do Gustavo. Não dá pra confirmar do lado da Umbler. |

---

## 2. Dependências da Umbler

| Endpoint (só GET) | Pra quê | Chamadas por rodada |
|---|---|---|
| `/v1/members/me/` | organização e o próprio membro | 1 |
| `/v1/organizations/{org}/` e `/details/` | mapa de membros (id → nome) | 2 |
| `/v1/chats/` (`ChatState=All`, 50 por página, mais recentes primeiro) | lista de conversas | 1 a 20 |
| `/v1/chats/{id}/relative-messages/` (250 por página) | mensagens de cada chat | hoje, cerca de 1 por chat lido (bug B) |

Nunca usamos `POST /v1/messages`. Uma trava em teste garante isso.

| Risco | Hoje | Com mais canais |
|---|---|---|
| Limite da API (100 req/5 s, segundo o código; não confirmado com a Umbler) | longe: cerca de 1,1 req/s | segue longe |
| **Tempo da rodada** | é o gargalo real: cerca de 0,9 s por chamada → no máximo ~110 chats por rodada, e o orçamento acaba sempre | piora: a lista é única pra organização inteira, então os canais disputam os mesmos ~110 lugares |
| Limite da Edge Function (150 s de execução no plano gratuito) | 101 s, dentro | sem folga se o orçamento subir |
| Perda de mensagem | não há: chat com mensagem nova sobe pro topo da lista | só se mais de ~110 chats receberem mensagem em 10 min |

**Conclusão:** o volume não é problema, o desperdício é. Com o bug B corrigido, cada rodada lê só os poucos chats que mudaram, e sobra folga pra 3 canais ou mais.

---

## 3. Membros e voz

### Como é hoje
| Campo | Origem | Situação real |
|---|---|---|
| `umbler_chats.atendente` | nome ou id do membro → mapa `stats.membros` | Funciona. Chats atribuídos: Gustavo 42 · Victor 12 · sem atendente 435 |
| `umbler_mensagens.de` | `source`: Contact → cliente; Member ou External → nós; Bot → bot | Funciona |
| `umbler_mensagens.autor` | nome em `sentByOrganizationMember` | **Quebrado pra tudo que sai pelo Talk.** A API manda só o id do membro, e o `mapMensagem` não consulta o mapa de membros. Resultado: 214 mensagens nossas com autor nulo. |
| Autor "pelo celular" | `source = External` (enviada direto do aparelho) | 1.754 mensagens. Hoje se assume que são do Gustavo. |

Mensagens enviadas pelo Talk, por membro (o id está no `bruto`):

| Membro (id técnico) | Canal Gustavo | Canal Vitor |
|---|---|---|
| `atJ3j0UX…` (GUSTAVO JUCA) | 140 | 1 |
| `atfVdu07…` (Victor Figueiredo) | 48 | 25 |

### O que muda com a Rebeca
| Peça | Impacto |
|---|---|
| Mapa de membros | Ela entra sozinha se o endpoint da organização listar todos os membros (hoje lista 2). **Conferir quando ela entrar.** |
| Autor das mensagens | Sem corrigir o `mapMensagem`, o autor dela também fica nulo. **Durante a viagem, não vai dar pra saber quem respondeu o quê** (Ticket 3). |
| "Pelo celular" = tom do Gustavo | **Fica contaminado** se o Vitor ou a Rebeca mandarem mensagem pelo aparelho do Gustavo durante a viagem. A seleção de tom do 2.11 (item 3.4) depende disso. |
| Copiloto no ar (v6) | Não sabe quem está enviando. A mensagem de espera é sempre "Vou alinhar isso com o Gustavo": certa pro Vitor e pra Rebeca, errada pro Gustavo. |
| Voz por remetente do 2.11 (3.5) | **Foi pensada pra 2 pessoas**: trata o delegado em `lp_delegacoes` como "o Vitor". Com 2 delegados, quebra. Precisa ler o nome de cada usuário (`app_settings.equipe` já tem membros, siglas e times). |
| Assinatura | O 2.11 conta com a assinatura automática da Umbler pra cada atendente. Confirmar a da Rebeca (pergunta pra Umbler). |
| Acesso ao CRM | **A Rebeca não existe no CRM**: sem `lp_perfis` e sem delegação. Sem isso ela não vê Conversas, não usa a extensão logada e não vê o vigia. |
| Quem vê | Pela RLS, o dono e os delegados. Como delegada, ela veria **tudo**, inclusive as notas internas. |

---

## 4. Canais

| Pergunta | Resposta |
|---|---|
| **Sair o canal do Vitor: o que acontece com o histórico?** | No CRM, nada se perde: o sync só faz upsert e nunca apaga. Ficam 37 chats e 558 mensagens congelados. O filtro "canal" da tela Conversas continua mostrando "Vitor - Corporativo". Do lado da Umbler, depende dela (pergunta 4). Se o número continuar ativo fora da Umbler, o que entrar por ele depois não chega ao CRM. |
| **Canal novo entra no sync sozinho?** | **Sim, imediatamente.** A lista usa `ChatState=All` sem filtro de canal. Toda conversa nova (ou com mensagem nova) do canal novo é gravada **com o texto** já na primeira rodada, inclusive o histórico daquele chat (até 1.000 mensagens por rodada). Conversas antigas e paradas do canal novo só entram se a varredura completa rodar de novo. |
| **Canal privado sem gravar texto: onde mexer** | Em `processarPagina` e no `webhook` da function `umbler`: pular o chat inteiro quando o canal não for permitido. Isso não grava texto, nem `bruto`, nem nome, nem telefone. **Recomendado:** lista de canais PERMITIDOS, não de bloqueados. Assim qualquer canal novo nasce ignorado, o que resolve o "ovo e galinha": o id do canal novo só existe depois de conectado, e o primeiro cron roda em até 10 min. Mais um teste no `nucleo_test.ts`. |
| Esforço | **3 a 5 h** com testes. Gravar só metadados com RLS própria leva de 6 a 8 h. |
| ⚠️ Ordem obrigatória | **O filtro tem que estar no ar ANTES de conectar o número novo na Umbler.** |
| Visível só pro Gustavo na Umbler | Não depende do CRM: é permissão por canal ou setor dentro da Umbler (pergunta 3). |

---

## 5. Privacidade hoje

- **O sync grava texto de mensagens com `privada = true`?** Sim. `privada` é a nota interna do Talk, não canal privado. Há 36 notas, todas com texto, todas no canal do Gustavo. A tela Conversas mostra essas notas (🔒) pra quem tem acesso, inclusive o Victor.
- **Existe filtro por canal?** Não.

| Tabela | Campos com texto ou dado de conversa | Linhas | Quem lê |
|---|---|---|---|
| `umbler_mensagens` | `texto` (até 20 mil caracteres), **`bruto` (mensagem inteira da API)**, `arquivo_nome`, `arquivo_url` | 6.854 | dono e delegados |
| `umbler_chats` | `ultima_msg_previa` (280 caracteres), **`bruto` (inclui a última mensagem)**, `contato_nome`, `contato_tel` | 489 | dono e delegados |
| `umbler_eventos` | `bruto` (evento inteiro do webhook) | 0 | só admin |
| `wa_historico` | `texto`, `chat_nome`, `tel_norm` | 0 | só leitura (política SELECT). O comentário da tabela diz que ela guarda "conversas individuais do WhatsApp do Gustavo (3 meses), importado do WhatsApp Web". **Nenhum branch do repo cria nem preenche essa tabela**: a origem não está rastreada. |
| `copiloto_sugestoes` | `rascunho` (sem a conversa; pode ter o primeiro nome do cliente) | 11 (teste) | por dono |

Achado lateral (o repo é público): o comentário da linha 6 de `extensao-whatsapp/content/umbler-dom.js` traz um **telefone completo** como exemplo. Mascarar.

---

## 6. Status do 2.11 (`PROMPT_CODE_COPILOTO_2_11_FILA_TOM_2026-10-25.md`, no Drive)

| Ticket | Status | Evidência |
|---|---|---|
| **T0** Copiloto respondendo | 🟡 **Parcial** | Responde: 11 sugestões gravadas com `claude-haiku-5-5`, **todas do usuário de teste**. Falta: o erro do log ainda é engolido (só `console.error`, sem `log_ok:false`), o `output_config` continua no código, e **o código não está na main**. |
| **T1** Copiloto lendo do banco (`chat_id`) | ⚪ Não iniciado | A v6 só aceita `mensagens[]`. Não há `chat_id` nem exclusão de `privada`. |
| **T2** Fila pelo banco + cache | ⚪ Não iniciado | `copiloto_fila_cache` e a função `copiloto_fila` não existem. A extensão não tem aba Fila. |
| **T3** Tom + voz por remetente | ⚪ Não iniciado | `copiloto_config` só tem `janelas_agenda`: sem `exemplos_tom` e sem `tom_ativo`. A mensagem de espera é fixa, em 3ª pessoa. |
| **T4** Vigia de conexão | ⚪ Não iniciado | Não existem `umbler_lacunas`, o job de vigia nem o banner. |
| **T5** README 2.11.0 + bump | ⚪ Não iniciado | ⚠️ **Colisão de versão:** o prompt supõe que a "2.10.0" é a do copiloto, mas a 2.10.0 da main é a dos relatórios do portal ("Gabi própria"). A tela do copiloto na extensão nunca foi entregue: o branch `copiloto-t1` só tem a function e a migração, com o manifest em 2.9.1. |
| **T6** | — | **Não aparece no trecho legível do documento** (a leitura parou no item "7. EM ABERTO"). Única pista solta: `wa_historico` existe, vazia e sem código no repo. |

---

## 7. Quedas

| Pergunta | Resposta |
|---|---|
| O que detecta queda hoje? | **Nada.** Quando o QR Code cai, a API da Umbler continua respondendo, só que sem mensagens novas. O sync fica "OK" e a "Última leitura" da tela Conversas fica verde. |
| Como tratamos `Failed`? | **Não tratamos.** O sync guarda só o último estado da mensagem (o upsert sobrescreve), sem histórico e sem aviso. Hoje há **0 mensagens `Failed` no banco**. A de 03/11, 13:12, não aparece: as 13 mensagens nossas entre 12:50 e 13:40 estão como Received ou Processing. |
| A API mostra o status do canal? | Não no que guardamos: o objeto `channel` do chat só traz `id`, `name`, `channelType` e `phoneNumber`. Se existe um endpoint de status, é pergunta pra Umbler. |

### Vigia mínimo viável antes de 12/11
| Versão | O que faz | Esforço |
|---|---|---|
| **Mínima (fazer já)** | Semáforo por canal no Início e em Conversas: "última mensagem neste canal há X h". Fica vermelho acima de 3 h em dia útil, das 08h às 20h. Calculado no app a partir de `umbler_chats`, sem tabela nova e sem cron. | **2 a 3 h** com portão 390/1280 |
| Completa (depois da viagem) | T4 do 2.11: tabela `umbler_lacunas`, job a cada 30 min, banner no CRM e na extensão, lista de lacunas | 5 a 7 h |

---

## 8. Extensão

| Item | Situação |
|---|---|
| Versão na main | **2.10.0**: card do CRM no WhatsApp Web e no Umbler, mais os relatórios do portal |
| Depende do WhatsApp Web | `wa-dom.js`: lê só o cabeçalho da conversa aberta (telefone e nome) e preenche a caixa de texto pra revisão (`fillComposer`). **Nunca envia.** |
| Depende do Umbler | `umbler-dom.js`: lê o DOM do Talk (Blazor): título, "Detalhes do contato" e caixa de texto. Não usa a API. |
| Não depende de nenhum dos dois | o sync (API da Umbler, no servidor) |
| Se migrar pra coexistência (API oficial) | **Umbler:** a tela tende a continuar igual, então o `umbler-dom.js` deve seguir funcionando (confirmar). **WhatsApp Web:** depende de a coexistência manter o WhatsApp Web no número; se não mantiver, fica só o card no Umbler. **Sync:** não muda; pode mudar o sentido de `source=External` e dos estados. **Ganho:** acaba o QR Code, que é a causa das quedas. **Custo novo:** janela de 24 h e templates pro atendimento. |

---

## 9. Perguntas pra vendedora da Umbler

1. Quanto custa a 3ª atendente no Impulso? A fidelidade de 12 meses recomeça?
2. A assinatura automática do atendente liga e desliga por membro e por canal? A Rebeca terá a dela?
3. Dá pra deixar um canal visível só pra um membro (permissão por canal ou setor)? E na API: o token do dono enxerga esse canal mesmo assim?
4. Ao remover o canal "Vitor - Corporativo", o histórico de chats e mensagens continua no painel e na API, ou é apagado?
5. Dá pra transferir as conversas desse canal pro canal do Gustavo?
6. A Umbler avisa (e-mail ou app) quando um canal de QR Code desconecta? Dá pra mais de uma pessoa receber o aviso?
7. A API tem endpoint de status do canal (conectado ou desconectado)?
8. Qual é o limite oficial da API no Impulso (por segundo e por dia)? "100 req/5 s" está certo?
9. O webhook está disponível no Impulso? Quais eventos ele manda (mensagem nova, mudança de estado como Failed, canal desconectado)? O formato é documentado? Ele reenvia quando falha?
10. Quando uma mensagem fica `Failed`, a API ou o webhook avisa a mudança de estado?
11. As mensagens que chegam durante uma queda do QR se perdem de vez, ou aparecem depois de reconectar?
12. Na coexistência, continuam funcionando o app do celular e o WhatsApp Web? As mensagens enviadas pelo celular aparecem no Talk?
13. Qual o custo por conversa e por template, e como fica a janela de 24 h?

---

## 10. Próximos tickets (nenhum executado)

| # | Ticket | Por quê | Esforço | Antes de 12/11? |
|---|---|---|---|---|
| **0** | **Reler o QR Code do canal do Gustavo** (ação dele) e conferir no banco se as mensagens voltaram a entrar | Achado A | 5 min | 🔴 hoje |
| 1 | **Vigia mínimo:** semáforo por canal no Início e em Conversas | Na viagem, o Vitor e a Rebeca precisam ver a queda sem depender dele | 2 a 3 h | ✅ sim |
| 2 | **Rebeca no CRM:** login, `lp_perfis`, delegação, `MODS.conversas`, `app_settings.equipe` | Sem isso ela não vê conversas nem o vigia | ~1 h + decisão dele | ✅ sim |
| 3 | **Autor por membro:** `mapMensagem` usa o mapa de membros + backfill das 214 a partir do `bruto` | Saber quem respondeu durante a viagem; base da voz por remetente | 1 a 2 h | ✅ sim |
| 4 | **Corrigir a comparação de datas do sync** + **timeout do cron de 5 s → 20 s** | Achado B e as 7 chamadas cortadas; abre espaço pra mais canais | 1 a 2 h | ✅ sim |
| 5 | **Lista de canais permitidos no sync:** canal novo nasce ignorado | Obrigatório antes de conectar o número pessoal | 3 a 5 h | ✅ se o número entrar antes de 30/11 |
| 6 | Cadastrar o webhook na Umbler (ação dele) e testar 1 evento | Tempo real, em vez de até 10 min de atraso | 15 min + teste | desejável, depois do 4 |
| 7 | Mascarar o telefone do comentário em `umbler-dom.js` | Privacidade (repo público) | 5 min | desejável |
| 8 | Decidir sobre as notas internas: o Victor e a Rebeca veem? Gravar o texto? | Hoje vão pra quem tem acesso | decisão + 1 h | desejável |
| 9 | Histórico de estado das mensagens + aviso de `Failed` | Hoje a falha some sem rastro | 2 h | depois |
| 10 | **Replanejar o 2.11:** versão nova sem colidir, voz por usuário (3 pessoas), T0 completo e o código na main, depois T1 a T3 | O plano supõe a 2.10.0 do copiloto e só 2 remetentes | ~1 h de replanejamento + 2 a 3 dias | ❌ depois da viagem |
| 11 | Vigia completo (T4) + decisão sobre a `wa_historico` | Junto com a decisão da API oficial | 5 a 7 h | ❌ dezembro |
| 12 | Remover o canal do Vitor só depois das respostas 4 e 5 da Umbler | Não perder histórico do lado da Umbler | 0 h de código | quando a Umbler responder |
