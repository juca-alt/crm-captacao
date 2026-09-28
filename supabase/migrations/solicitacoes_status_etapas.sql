-- SO-4ETAPAS-V1 (28/09/2026): etapas "A fazer" e "Aguardando" (so amplia a lista; nada muda nos registros).
alter table public.solicitacoes drop constraint if exists solicitacoes_status_check;
alter table public.solicitacoes add constraint solicitacoes_status_check
  check (status = any (array['aberta','a_fazer','em_andamento','aguardando','respondida','executada','sem_retorno','cancelada']));
-- situacao "Aguardando" = marca que vale em qualquer etapa (filtro), separada da etapa.
alter table public.solicitacoes add column if not exists aguardando boolean not null default false;
