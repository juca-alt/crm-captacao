# crm-mcp v3.0 — leitura pra decisão (WhatsApp/Umbler + funil + UW/Emissão)

23/10/2026 · Edge Function `supabase/functions/crm-mcp/` · `SERVER.version = "3.0.0"`

## O que mudou
8 ferramentas **somente leitura** novas, pra que as sessões de assistente do Gustavo leiam o CRM e as conversas do
WhatsApp (Umbler Talk) e ajudem a decidir. **Nenhuma envia mensagem nem grava nada**: responder cliente é sempre
humano (Gustavo ou Victor). As descrições das ferramentas dizem isso pro assistente.

| Ferramenta | Pra quê |
|---|---|
| `conversas_listar` | conversas do Umbler (mais recente primeiro); filtros busca (nome/telefone), `aguardando_resposta`, `desde`, `canal`, `abertas`; `horas_sem_resposta` quando o cliente falou por último |
| `conversa_ler` | uma conversa (por `chat_id` ou `telefone`): cabeçalho + últimas N mensagens em ordem cronológica (texto até 2000 caracteres) |
| `conversas_buscar` | procura termo no texto das mensagens (`ilike`), devolve trecho de ~300 caracteres + contato |
| `conversas_status` | saúde do sync (`umbler_estado` sem `stats.membros`) + contagens (conversas, abertas, aguardando resposta, sem histórico completo, mensagens) |
| `contato_conversa` | ponte CRM ↔ WhatsApp: contato do `lp_contatos` + resumo do negócio + últimas 30 mensagens do chat casado pelo telefone |
| `funil_resumo` | por funil → etapa: quantidade, `pa_total`, `sem_valor`, `sem_proxima_atividade`, `congelados`, `tarefas_atrasadas`; encerrados e Clientes Ativos à parte |
| `negocios_listar` | negócios abertos com PA, dias na etapa, próxima atividade, telefone e congelado; ordena por `pa` ou `parado` |
| `emissao_pendencias` | pendências de emissão em aberto + emitidas nos últimos N dias |

## Segurança (igual às ferramentas antigas)
- Toda query roda com o **token curto do dono** (`ctxFor`) → o RLS confina. Nada de negócio usa a service role.
- `umbler_*`: o `authenticated` só tem SELECT (escrita só da service role do sync).
- Nunca pede a coluna `bruto`; todo `select=` é explícito; todo valor de filtro passa por `encodeURIComponent`
  (e o de `ilike` ainda tira `* , ( )` e escapa `\ % _`).
- O RLS também mostra **bases delegadas** a este e-mail. Pra não misturar pipelines, `funil_resumo`,
  `negocios_listar` e `emissao_pendencias` aceitam `base`: `minha` (padrão) · `todas` · e-mail de uma base.
- Leitura não grava em `lp_mcp_audit` (mesma prática do `listar_atrasos`).
- Respostas v3 em JSON compacto e sem campos vazios (as antigas continuam com indentação).

## Regras de dado (espelho do `vendas.html`)
- **Negócio = contato com `dados.etapa`**. Os ~6 mil sem etapa (funil `bn`, a base de nomes) não saem do banco; só são contados.
- **Funil** = `funilDe` do app: `bc`, `vg`, `prud`, `mfo`, `vg-bc`, `prud-bc`, `mfo-bc`; qualquer outro (inclusive `bn`/`prospects` com etapa) cai em `nn`.
- **Etapas e encerramento** vêm de `app_settings.lp_funil_cfg` (o que o admin configura em Funil & Etapas; o rótulo
  da cfg sai como `etapa_label`), com o padrão de fábrica do app se não der pra ler. Etapa fora da cfg sai com `fora_da_cfg`.
- **"Clientes Ativos"** (1ª coluna dos Negócios na Base) = carteira parada, fora do fluxo → `carteira_clientes_ativos`, fora dos totais.
- **PA = `pm` × 12** (`premio_mes` como reserva). O padrão R$ 250/mês do app (`pm-padrao`, liberado por usuário) **não**
  é aplicado: quem não tem prêmio entra em `sem_valor`. MFO soma também `receita_estimada`.
- **Tarefa pendente** = `tarefas[]` com `feito` vazio; **atrasada** = pendente com `quando` < hoje (Recife).
- **Dias na etapa** = última `interacoes[]` com `k:'etapa'` e `para` = etapa atual (`dia`); senão `criadoEm`.
- **Congelado** = `dados.congelado.em` presente (`{em, ate, motivo}`); `negocios_listar` deixa de fora por padrão (`congelados:true` lista só eles).
- **Mesclados** (`merged_into`) ficam de fora.
- **Telefone** casa pelos 8 últimos dígitos no banco (`contato_tel_norm=ilike.*XXXXXXXX`) e o DDD é conferido no código
  (tolera 55 e o 9º dígito; DDD diferente não casa).
- **Pendência de emissão aberta** = `desfecho` nulo e `status_tratativa` ≠ `resolvido`.

## Testes
`CRM_MCP_TESTE=1 deno test --allow-env --no-check supabase/functions/crm-mcp/ferramentas_test.ts`
— funções puras + despacho das 8 ferramentas com `fetch` falso (dados inventados). A variável `CRM_MCP_TESTE`
impede o `Deno.serve` de subir no teste; em produção ela não existe.

## Deploy
Só `index.ts` vai pro deploy (o arquivo de teste não precisa). Não precisa de migration.
