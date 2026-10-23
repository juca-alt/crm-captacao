# Umbler Talk · LEITURA TOTAL (UMBLER-V1 · 23/10/2026)

## Decisão (palavra dele, 23/10)
*"pode ler tudo… os envios da resposta são avaliados por mim e Victor… mas ler, pode ler tudo."*

| | Regra |
|---|---|
| **Ler** | TUDO: todas as conversas do Talk (abertas e fechadas), todas as mensagens dos dois lados, histórico inteiro. Via API (Caminho B), não só a conversa aberta na tela. |
| **Enviar** | **Nunca automático.** Toda resposta ao cliente é aprovada e enviada por gente (Gustavo ou Victor). O servidor não tem rota de envio: a função só faz GET, e um teste (`TRAVA`) fecha se aparecer `/v1/messages` ou método diferente de GET. |
| **Quem vê** | Dono (Gustavo) + delegados dele (`lp_donos_visiveis()` → hoje o Victor). Daniel não vê. |

A extensão (`umbler-dom.js`, Caminho A) continua: ela preenche o campo de resposta pra revisão humana. O que muda é a fonte da leitura — agora o banco tem tudo, não só o que está na tela.

## Peças
- **Migração** `supabase/migrations/umbler_v1_leitura.sql` (rodada 23/10): `umbler_chats`, `umbler_mensagens`, `umbler_eventos` (webhook cru), `umbler_estado` (cursor/erro/estatística). RLS: app só LÊ; escrita só service role. `pg_net` instalado.
- **Edge Function `umbler`** (`supabase/functions/umbler/`, verify_jwt off, 3 travas próprias):
  1. **pg_cron `umbler-sync`, a cada 10 min** → header `x-cron-chave` (Vault `umbler_cron_chave`).
  2. **Webhook do Talk** → `POST …/functions/v1/umbler?k=<chave>` (Vault `umbler_webhook_chave`; o valor não entra no repo). Guarda o evento cru, parseia na defensiva (formato não documentado) e confirma o chat pela API.
  3. **Botão no app** → JWT do dono/delegado; `?status=1` devolve o estado.
- Chaves internas conferidas por `umbler_chave_ok()` (só service_role).

## Como a leitura anda
1. **Cabeça:** lista os chats pela última mensagem (mais novo primeiro) e lê o que chegou depois de `msgs_ate`. Para no primeiro trecho já em dia.
2. **Varredura completa (1ª vez):** passa por TODOS os chats (`ChatState=All`); cursor `lista_skip` sobrevive entre rodadas.
3. **Histórico antigo:** para trás a partir de `msgs_desde`, até 1.000 msgs por chat por rodada, até `historico_completo`.
- Orçamento de 100 s por rodada; limite da API (100 req/5 s) respeitado com 60 ms entre chamadas e espera de 5 s no 429.

## Falta (só ele)
1. **Token da API do Talk** → secret `UMBLER_TOKEN` no Supabase. Sem ele a função responde `sem_token` e não faz nada.
2. **Webhook no Talk** (opcional, deixa em tempo real; sem ele o atraso é de até 10 min): colar a URL com `?k=` que foi passada no chat.

## Depois
- Tela "Conversas" no vendas.html (MODS `def:false`) e o Copiloto lendo de `umbler_mensagens` no servidor.
