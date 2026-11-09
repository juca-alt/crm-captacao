# Prompt — sessão GUIADA: Supabase Pro + créditos da API Claude (preparado em 09/11/2026)

> Colar numa sessão nova. Sem PII. E-mails e chaves nunca entram aqui.

```
MODO GUIADO — destravar 2 pendências de infra do CRM Vendas LP. Use a skill construir-checklist-guiado-html.
Dimensão: Prudential/LP (infra do CRM). Tempo-alvo: 20 min. Eu executo o que só eu posso (pagamento,
chave, cartão); você executa o resto e me dá UM passo por vez, com URL pronta e onde clicar.
Antes de tudo: git fetch e ler o topo do ESTADO_DO_PROJETO.md (juca-alt/crm-captacao) — se algum item
abaixo já estiver resolvido lá, pula e me diz.

CONTEXTO
- Supabase de produção do CRM: projeto cjieobmdpqcupzdpckef. Risco: plano grátis, SEM backup restaurável,
  pode pausar. Pedido desde 17/10 (ESTADO, bloco "ORGANIZAR O SUPABASE").
- Central Financeira e Painel Central usam OUTRO projeto (mieqsiojvfiqrhectquc). Confirme na tela de billing
  se os dois estão na mesma organização e quanto o Pro custa no total. Não afirme preço sem ver a tela.
- Desde 09/11 a IA roda sozinha: Edge Functions copiloto-sugerir (v7, botão ✨ em Conversas), triagem
  (cron às :05, Haiku, até 25 conversas por rodada) e capturar-lead. Todas leem o secret ANTHROPIC_API_KEY.
  Crédito da assinatura claude.ai NÃO vale pra API: o saldo é no Console (platform.claude.com).

TAREFA 1 — Supabase Pro
1. Me levar à tela de billing (https://supabase.com/dashboard/org/_/billing): plano, organização, projetos.
2. Eu assino o Pro. Você confirma depois: backup diário ativo e projeto sem risco de pausa.
(A faxina das tabelas _bkp_* e de emb_teste_x() é de outra sessão — só me lembre no fim.)

TAREFA 2 — Créditos da API (não deixar a triagem parar)
1. Me levar ao Console → Billing: saldo atual, recarga automática e limite de gasto.
2. Estimar o gasto/mês com o que já roda (triagem a cada hora + copiloto + capturar-lead), pelo Usage do
   Console e pelo volume no banco (copiloto_fila_cache, copiloto_sugestoes). Me dar 2 opções (A ou B) de
   recarga automática + teto mensal.
3. Se a chave não estiver nos secrets, eu colo direto no painel do Supabase (Edge Functions → Secrets).
   A chave NUNCA vai pro chat, pro repo nem pra arquivo.
4. Testar a copiloto-sugerir com texto INVENTADO (sem dado de cliente): resposta, tempo, custo estimado.

REGRAS: um passo por vez; sem pergunta aberta (A ou B); nada de PII; não mexer no código do vendas.html.
Ao fim: checklist marcado, ESTADO atualizado (bloco novo no topo) e LOG DE SESSÕES no Notion
(autorização permanente). Uma linha do que ficou pendente.
```
