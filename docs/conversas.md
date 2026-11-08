# 💬 Conversas — o WhatsApp (Umbler Talk) dentro do CRM (CONVERSAS-V1 · 24/10/2026)

Tela nova no `vendas.html` (v8.81) em cima do que o UMBLER-V1 já trouxe pro banco em 23/10.
Nada aqui fala com o Umbler direto: a tela só **lê** `umbler_chats` / `umbler_mensagens`, e o
único botão que vai ao servidor é o "🔄 Sincronizar agora", que chama a Edge Function `umbler`
(que por sua vez só faz **GET** na API do Talk).

## A regra que manda
> *"pode ler tudo… os envios da resposta são avaliados por mim e Victor"* — Gustavo, 23/10.

| | |
|---|---|
| **Ler** | Tudo que já está no banco: todas as conversas, dos dois lados, com histórico. |
| **Enviar** | **Nunca daqui.** Não existe campo de resposta nem botão de enviar na tela. O que ela faz é **copiar o texto** e **abrir a conversa** no WhatsApp ou no Talk — quem responde é gente (Gustavo ou Victor). |
| **Quem vê** | RLS de leitura por dono + delegados (`lp_donos_visiveis()`): hoje Gustavo e o Victor. O Daniel não vê. |

Um invariante do self-check (`CONVERSAS-V1`) fecha o portão se aparecer `<textarea>`,
`contenteditable`, um botão "Enviar/Responder/Mandar", uma chamada a `/v1/messages`, ou
qualquer `.insert/.upsert/.update/.delete` nas funções do módulo.

## Acesso (regra do CLAUDE.md: tela nova = MODS `def:false`)
`MODS.conversas` com `def:false`. O **Victor** recebe ligado (`lp_perfis.modulos.conversas=true`);
o **Daniel** só quando ele disser. Ele liga/desliga por usuário no **Painel Master · Acessos**.
A tela mora em **Módulos → Atendimento → 💬 Conversas** (e vai pro menu lateral pelo 📌 do card).

## A lista
Medido na base real em 24/10: **213** conversas com o cliente falando por último, mas só **24**
nas últimas 24 h — e a mais antiga é de **dezembro/25**. Ou seja, "cliente falou por último"
mistura quem está esperando AGORA com o "obrigada!" de um ano atrás. Por isso:

| Filtro | O que mostra | Ordem |
|---|---|---|
| **⏳ Aguardando** (padrão) | o cliente falou por último | **o mais recente na frente** (quem espera agora) |
| **⏰ Esfriando** | esperando de **1 a 7 dias** | **o mais parado na frente** — é a lista curta de bola caída, que dá pra zerar |
| **Todas** | tudo | aguardando primeiro, depois a conversa mais recente |

Ainda: **Só abertas** (esconde o que o Talk fechou), **canal** e **busca por nome ou telefone**.
Cada linha traz o nome, há quanto tempo, a prévia da última mensagem ("você:" / "robô:" quando
foi nosso), o atendente, o canal e as não lidas.

Três números no topo: **Aguardando resposta** (nas últimas 24 h · total), **⏰ Esfriando**, e
**Última leitura** (o servidor lê sozinho a cada 10 min; o erro da última rodada aparece aqui).

## A conversa
Mensagens em ordem cronológica, com separador por dia. Nosso lado à direita, o cliente à
esquerda, o robô em roxo, **🔒 nota interna** destacada no meio, e o arquivo **pelo nome**
(`📎 media.jpg`, com link quando o Talk mandou a URL). O rodapé de cada balão diz quem mandou —
`pelo celular` é mensagem que ele mandou pelo WhatsApp do aparelho, fora do Talk.

Botões: **📂 Abrir ficha** (quando o telefone casa com o CRM) · **📋 Copiar texto** ·
**💬 Abrir no WhatsApp** (`wa.me`) · **🔗 Abrir no Talk** · **↻** releitura.

- **Celular:** a conversa vira **tela cheia**, e o **voltar do Android** fecha ela (camada própria
  `conversa`, entre `ficha` e `gaveta` no `CAM_ORDEM`).
- **Desktop:** dois painéis — lista à esquerda (rolagem própria), conversa à direita.

> ⚠️ **A conferir com ele:** o "🔗 Abrir no Talk" aponta pra `app-utalk.umbler.com/chats/<id>`
> usando o id da API. O comentário do `umbler-dom.js` diz que o id da URL do Talk **muda** entre
> a lista e a conversa aberta — então o link pode cair na lista em vez da conversa. O 💬 WhatsApp
> (pelo telefone) é o caminho certo de todo jeito.

## A ponte com o CRM
Casa pelo telefone com a **mesma regra do servidor** (`telChave`/`telScore` do `crm-mcp`):
**8 últimos dígitos** têm que bater e, se os dois lados tiverem **DDD**, o DDD também.
O `telKey()` do app não serve aqui porque ele exige 10+ dígitos, e a conversa do Talk às vezes
chega sem DDD.

- **Conversa → CRM:** negócio do funil primeiro (aberto e mais recente na frente), senão lead do
  Estoque de Nomes. No celular a conversa fecha antes de abrir a ficha (ela é z96 e cobriria).
- **CRM → conversa:** a ficha ganha o bloco **💬 WhatsApp**, que **nasce fechado** (DOBRA-FECHADA-V1)
  com o resumo no cabeçalho (⏳ esperando há X · N conversas · canal) e as **12 últimas mensagens**
  dentro. Sem conversa casada o bloco não aparece — nada de bloco morto na ficha. A busca é por
  telefone direto no servidor (`ilike` nos 8 últimos dígitos), não baixa o índice inteiro.

## Testes
- Self-check `CONVERSAS-V1`: chave de telefone (os 4 casos de score), ordem das duas listas,
  filtros, busca por nome e por telefone com DDD, "há quanto tempo", trava do envio, ordem
  cronológica + nota interna + arquivo, copiar texto, casamento com o funil, bloco da ficha
  fechado, fiação do módulo (MODS/hub/título/portão) e a ordem das camadas do voltar.
- Portão: **51 telas × 6 cenários**, verde; a tela de Conversas com 0 exceção, 0 campo morto,
  0 estouro e 0 campo com fonte < 16px — na lista E na conversa aberta.
  O `portao.html` ganhou `cvExemplo` (fixture **inventada**, sem nenhum dado de cliente) e o
  gancho que abre a conversa pra medir a tela cheia do celular.
- Prints: 390 (lista, conversa, esfriando) e 1280 (dois painéis).

## Depois
- Copiloto lendo de `umbler_mensagens` no servidor (em vez de raspar a tela) — Tarefa 2.
- Webhook do Talk (opcional): deixa em tempo real; sem ele o atraso é de até 10 min.

## 🚦 Vigia de queda (VIGIA-QUEDA-V1 · 06/11/2026 · v8.85)
O QR Code do canal do Gustavo caiu 2× numa semana e nada avisava (a API da Umbler segue respondendo,
só que sem mensagem nova). Agora, por canal, o app olha a **última mensagem** (`max(ultima_msg_em)` de
`umbler_chats`, que a RLS já deixa ler) — sem tabela nova, sem cron, sem chamar a Umbler, sem gravar nada.

| Estado | Quando |
|---|---|
| 🔴 **Vermelho** | mais de **3 h úteis** sem mensagem, e agora é horário útil (**seg a sex, 8h às 20h**, Recife). Só contam as horas dentro da janela: segunda 9h com a última na sexta 19h = 2 h úteis → verde. |
| ✅ Verde | dentro do limite, ou fora do horário |
| ⚪ Inativo | canal sem mensagem há **7+ dias** (ex.: canal removido) — fora do vigia |
| ⚠️ Leitura parada | `umbler_estado.ultimo_ok` com mais de **30 min** (o servidor lê a cada 10) |

- **Onde:** topo da tela 💬 Conversas (semáforo inteiro) e faixa vermelha no **Início só quando há alerta**,
  com o atalho "💬 Abrir Conversas". Só pra quem tem o módulo `conversas`.
- **Texto:** "⚠️ Canal «{canal}» sem mensagem há {X} h. Abra a Umbler → Canais e confira se está conectado (releia o QR Code)."
- Relê a cada 5 min com o app aberto no Início ou em Conversas (aba escondida não gasta); o 🔄 Sincronizar também relê.
- Limites numa constante só: `CV_VIGIA` (limH 3, iniH 8, fimH 20, leituraMin 30, inativoD 7).
- **Não trata feriado** (num feriado de semana, um canal parado pode acender).
- Self-check `VIGIA-QUEDA-V1` (15 checagens, com datas fixas de nov/2026).
