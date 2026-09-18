-- WA-PAINEL-V1 (18/09/2026): a interação do Estoque espelhada no banco passa a aceitar o canal
-- WhatsApp (tipo 'wa') e os resultados do Zap (mandei · respondeu · sem_resposta).
-- Aplicada em produção em 18/09/2026. IDEMPOTENTE (drop if exists + add).
alter table public.lp_interacoes drop constraint if exists lp_interacoes_tipo_check;
alter table public.lp_interacoes add constraint lp_interacoes_tipo_check
  check (tipo = any (array['ta','oi','msg','nota','wa']));
alter table public.lp_interacoes drop constraint if exists lp_interacoes_resultado_check;
alter table public.lp_interacoes add constraint lp_interacoes_resultado_check
  check (resultado is null or resultado = any (array['atendeu','nao_atendeu','agendou','recusou','numero_errado','mandei','respondeu','sem_resposta']));
