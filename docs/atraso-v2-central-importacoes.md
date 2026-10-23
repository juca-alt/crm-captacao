# Lista de Atraso v2 + Central de Importações (v8.78 · 23/10/2026)

Lote Global 1 · Parte A. Branch `feat/atraso-v2-central-importacoes`. Migrações (rodadas no SQL editor, idempotentes):
`supabase/migrations/atraso_v2_t1_normalizacao.sql`, `supabase/migrations/atraso_v2_t3_central.sql`.

## Fonte única da normalização (T1)
- **Onde mora a regra:** só no banco. Tabela `kb_motivos_atraso` (chave, rótulo, variantes, classe, instrução, ordem) +
  `fn_normalizar_motivo_atraso(text)` / `fn_normalizar_forma_pagto(text)` + gatilho `trg_atraso_normalizar` em `vendas_atrasos`.
- Qualquer gravação de `motivo_recusa` / `forma_pagto` (tela, Edge Function, SQL) recalcula `motivo_chave` / `forma_norm`. A tela só lê.
- **O bruto nunca muda:** `motivo_recusa` e `forma_pagto` ficam como vieram do relatório.
- Match: minúsculas + sem acento + espaços colapsados; a primeira variante que casar, pela `ordem`, vence; sem match = `outro`.
  Sufixos "/ há cobranças em andamento", "(rp)", "(rt)", "(reversível)" não mudam a chave.
- `kb_scripts_cobranca.motivo_normalizado` agora é FK pra `kb_motivos_atraso.chave` (`motivo_variantes` fica por compatibilidade).
- Editar os textos de instrução/rótulo: direto na tabela `kb_motivos_atraso` (admin).

## Derivados (calculados na leitura, nunca gravados — `atV2Der` / `atV2Kpis` no vendas.html)
| Derivado | Regra |
|---|---|
| dias de atraso | hoje − vencido_em; 0 se `pago_ate ≥ vencido_em` ou resolvido |
| crítica | dias ≥ 50 e não resolvida |
| cancela em | `prazo_cancelamento_dias` − dias (negativo = "cancelamento vencido") |
| em persistência | emissão (`emissao_emitidas.emissao`) há ≤ `janela_meses`; sem data = "sem data" (não conta dentro nem fora) |
| sem tratativa | status `sem_tratativa`; o legado "Sem tratativa" é lido como essa chave |
| valor em risco | prêmio das críticas ∪ em persistência, sem contar a mesma apólice 2× |
| próximo contato hoje | `prox_contato` ou `proxima_acao_prazo` = hoje |
| adotada | `carteira_apolices.dados.lpVenda` ≠ `dados.lp` (vendeu um LP, atende outro) |

- Sumidas do relatório ("Sumiu — verificar") ficam fora dos KPIs, como antes.
- Status da ficha e do filtro: os 8 de `kb_status_tratativa` (na ordem). Valor antigo de um caso continua na lista dele.
- WhatsApp da linha: script ATIVO de `kb_scripts_cobranca` pra chave do motivo, com `{nome}`; sem script → só o número.
  A mensagem pronta da ficha usa a chave do banco pra escolher o molde (a regex antiga só vale sem banco).

## Settings (`app_settings`)
- `atraso_config` = `{prazo_cancelamento_dias: 60, janela_meses: 12}` — confirmado pelo Gustavo em 23/10 (60 dias).
- `copiloto_config` (outro módulo) não interfere.

## Central de Importações (T3) — menu "Relatórios do portal" (`viewImportacoes`, MODS `importacoes` def:false)
- Catálogo (`IMP_CATALOGO`): Lista de Atraso, UW pendentes, UW emitidas (2 dias úteis) · Carteira (7 dias) ·
  Extrato Consolidado (mensal, até dia 10) · Extrato Detalhado (mensal, até dia 20) · Valor de Resgate/RPU (30 dias, **sem importador**).
- Semáforo (`impSemaforo`): Em dia (dentro do frescor) · Vencendo (até 50% além) · Atrasado · Nunca importado.
  Mensal: em dia se importou no mês corrente; antes do dia de vencimento = vencendo; depois = atrasado.
- Mapeamento pros tipos de `rel_importacoes`: carteira = `carteira_clientes` + `carteira_apolices`; consolidado = `persistencia`;
  detalhado = `comissao_direta`. Todos os importadores já chamam `relLog` (auditado 23/10).
- **Assinaturas de arquivo:** uma tabela só, `relDetectarOu(txt, padrao)` no vendas.html. `relDetectar` (Subir relatório)
  continua com padrão "semanal"; a Central usa padrão `null` e pergunta o tipo quando não reconhece.
- Log (`rel_importacoes`): + `descartadas`, `novas`, `sairam`. O atraso grava os três; os outros tipos, só `linhas`
  (a tela compara com a importação anterior).

## Defeito do rodapé (T3)
- O rodapé "Life Planner é a marca registrada…" e o cabeçalho "Apólices em Atraso N" da página seguinte entravam no bloco da
  última apólice da página. Agora o bloco é cortado no rodapé (`AT_RODAPE_RE`) e qualquer linha que ainda carregue isso — ou um
  motivo com data dentro (colunas embaralhadas) — é descartada e contada (`atLinhaLixo`).
- Validação bloqueante: quando o relatório declara "Total: N" (inteiro), lido ≠ declarado → não grava e explica.
- Os 2 registros contaminados (apólices reais, já resolvidas) foram **limpos** (só o campo com o rodapé), não apagados.

## Condicionais
- **T4 (boletos a vencer em 15 dias): PULADO.** A carteira traz `forma` e `periodicidade`, mas **não** o próximo vencimento
  (chaves conferidas em 23/10). Depende da carteira trazer vencimento.
- **T5 (adotada): FEITO** — `lpVenda` existe em 227 das 353 apólices da carteira; 4 das 50 em atraso são adotadas.

## Em aberto
- Persistência: `emissao_emitidas` só cobre ago–out/2026 → hoje todas as 50 em atraso aparecem como "sem data".
  Importar o histórico de emitidas resolve.
- "Responsável pelo pagamento"/e-mail do relatório do Global: o parser já lê o responsável quando vem; e-mail não vem no texto colado.
