-- BACKOFFICE V1 (02/09/2026) · Entrega 3 — campos novos na Lista de Atraso.
-- Aditiva e idempotente. Aplicada no playground cjieobmdpqcupzdpckef via MCP.
alter table public.vendas_atrasos
  add column if not exists bola_com            text check (bola_com in ('cliente','prudential','lm','nos')),
  add column if not exists ultima_acao         text,
  add column if not exists ultima_acao_em      date,
  add column if not exists proxima_acao        text,
  add column if not exists proxima_acao_prazo  date,
  add column if not exists autorizacao_contato text check (autorizacao_contato in ('lm_pode','gustavo_trata','nao_contatar')),
  add column if not exists protocolo           text;
comment on column public.vendas_atrasos.autorizacao_contato is 'Trava de contato: lm_pode | gustavo_trata | nao_contatar. Aparece na linha da tabela.';
comment on column public.vendas_atrasos.bola_com is 'Com quem esta a bola: cliente | prudential | lm | nos.';
