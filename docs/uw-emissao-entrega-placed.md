# UW & Emissão + esteira de entrega + PLACED por período (v8.79 · 23/10/2026)

Lote Global 1 · Parte B. Branch `feat/uw-emissao-entrega-placed`. Migração: `supabase/migrations/uw_emissao_t1_entrega_placed.sql` (aplicada, idempotente).

## Colunas novas (T1)
| Tabela | Coluna | Uso |
|---|---|---|
| emissao_pendencias | `ccb_quitada_em` | 1ª parcela (CCB) — **manual** (o relatório não traz) |
| as duas | `nao_conta`, `nao_conta_motivo` (mpp · sem_mqc · divisao_comissao · outro) | fora do Placed — **manual** (os relatórios não trazem produto/plano) |
| emissao_emitidas | `segunda_parcela_em` | 2ª parcela — **manual** |
| emissao_emitidas | `entrega_status` (sem_entrega · pronta · entregue), `entrega_em`, `entrega_modo`, `entrega_obs` | esteira de entrega |
| emissao_emitidas | `saiu_do_relatorio_em`, `desfecho` (cancelada · not_taken · continua_ativa · reabilitada), `desfecho_em` | espelho do "sumiu → desfecho" das pendências |
| placed_estado.dados.cfg | `periodo {inicio, fim, emissao_ate}` | merge no jsonb; o resto do R05 ficou idêntico (hash conferido) |

## Pendentes v2 (T2 · Pendências de Emissão › aba Pendentes)
- Relógio da proposta: `dias = max(hoje − dt_assinatura, dias do relatório)`, mostrado `x/60`. > 60 = linha vermelha ("estourou"); 53–60 = "vencem em 7 d".
- KPIs: Total pendente (PA · AFYC) · Passaram de 60 d · Vencem em 7 d · 1ª parcela em aberto · Sem ação registrada (+ os que já existiam).
- Filtros: chips Todas / > 60 d / ≤ 7 d / 1ª parcela em aberto + select da 1ª parcela (mais LP, status, contestação que já existiam).
- Linha: botão da 1ª parcela (✓ quitada dd/mm / ✕ em aberto), 💬 WhatsApp e 📞 ligar quando o CRM tem o telefone do segurado.

## Emitidas + entrega (T3 · aba Emitidas · entrega)
- `x/30` da emissão = janela Not Taken. KPIs: Emitidas no mês · Na janela Not Taken · Prontas pra entregar · Entregues no mês · Sem entrega acumulado · Sumiram.
- **Pronta** é automática: apólice na carteira (`CART.apolices`). Entregue nunca volta pra pronta. (Anexo de PDF da apólice: não existe mecanismo → ignorado.)
- **Entregar** grava `entrega_*` e, se houver contato no CRM (apólice no card ou nome do segurado), registra no histórico do card e em `lp_interacoes` (tipo `entrega`). Sem contato: grava só na apólice.
- **＋ tarefa** cria a tarefa no card do cliente (o mecanismo que já existe).
- **Sumiu:** na importação, apólice da base do mesmo LP, emitida dentro do período do relatório novo, que não veio → `saiu_do_relatorio_em`. Fora do período não é "sumiu". Desfecho: `not_taken` só se o cancelamento foi em até 30 dias da emissão (senão sugere "cancelada").

## PLACED por período (T4 motor · T5 tela)
- Motor único `plp*` (vendas.html): `plpPeriodo`, `plpUniverso`, `plpClassifica`, `plpCalc`, `plpSim`, `plpFaixa`. A tela e o selfTest usam as mesmas funções. O R05 mensal não mudou.
- Período = o que contém hoje: 01/11/A–31/10/A+1, emissão até 31/01/A+2.
- Universo = pendências ∪ emitidas (dedup pela proposta, a emitida ganha), assinadas no período, sem `nao_conta`.
- Emitida = tem emissão ≤ emissão_ate e não é Not Taken; reabilitada conta se reabilitou em até 120 d do cancelamento (cancelamento = `saiu_do_relatorio_em`).
- Caminhos a 92%: curto (menor k ≤ P), cheio ((E+P)/A), sem recuperar (n = ⌈(0,92·A − E)/0,08⌉). Simulador: k e n.
- Faixas: ≥ 92 qualifica · 87–91,9 rebaixa uma candidatura · < 87 não participa (alto/baixo do cfg do R05).
- Números do Global conferidos no selfTest: A=26 E=21 → 80,8% · k=3 → 92,3% · n=37 → 92,1% (36 não basta).

## Em aberto
- CCB, 2ª parcela, produto/plano: os relatórios de pendentes/emitidas não trazem — tudo manual.
- Data real do cancelamento pra reabilitação: hoje usa o dia em que sumiu do relatório.
