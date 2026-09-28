-- SO-COM-V1 (28/09/2026): novo status "Em andamento" nas solicitacoes (so amplia a lista; nada muda nos registros).
alter table public.solicitacoes drop constraint if exists solicitacoes_status_check;
alter table public.solicitacoes add constraint solicitacoes_status_check
  check (status = any (array['aberta','em_andamento','respondida','executada','sem_retorno','cancelada']));
