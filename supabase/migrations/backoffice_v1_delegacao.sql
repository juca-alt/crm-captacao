-- DELEGACAO (02/09/2026): dono -> delegado. Aplicada no playground cjieobmdpqcupzdpckef via MCP.
-- O delegado (Victor) passa a LER e ESCREVER as linhas do dono nas tabelas do BackOffice,
-- gravando com lp_email = dono. O dado continua sendo do dono; quem delega e o dono (ou admin).
create table if not exists public.lp_delegacoes (
  dono_email      text not null,
  delegado_email  text not null,
  modulos         jsonb not null default '{"backoffice":true}'::jsonb,
  criado_em       timestamptz default now(),
  primary key (dono_email, delegado_email)
);
alter table public.lp_delegacoes enable row level security;
drop policy if exists lp_delegacoes_ler on public.lp_delegacoes;
create policy lp_delegacoes_ler on public.lp_delegacoes for select to authenticated
  using (delegado_email = (auth.jwt()->>'email') or dono_email = (auth.jwt()->>'email') or lp_sou_admin());
drop policy if exists lp_delegacoes_escrever on public.lp_delegacoes;
create policy lp_delegacoes_escrever on public.lp_delegacoes for all to authenticated
  using (dono_email = (auth.jwt()->>'email') or lp_sou_admin())
  with check (dono_email = (auth.jwt()->>'email') or lp_sou_admin());

create or replace function public.lp_donos_visiveis() returns setof text
language sql stable security definer set search_path = public as $$
  select (auth.jwt()->>'email')
  union
  select dono_email from public.lp_delegacoes where delegado_email = (auth.jwt()->>'email')
$$;

-- politicas das tabelas do BackOffice: dono OU delegado do dono (mesmo formato nas 6)
-- vendas_atrasos, emissao_pendencias, solicitacoes, subst_apolices, subst_clientes, subst_pagamentos:
--   drop policy if exists <t>_dono on public.<t>;
--   create policy <t>_dono on public.<t> for all to public
--     using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
drop policy if exists vendas_atrasos_dono on public.vendas_atrasos;
create policy vendas_atrasos_dono on public.vendas_atrasos for all to public using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
drop policy if exists emissao_pendencias_dono on public.emissao_pendencias;
create policy emissao_pendencias_dono on public.emissao_pendencias for all to public using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
drop policy if exists solicitacoes_dono on public.solicitacoes;
create policy solicitacoes_dono on public.solicitacoes for all to public using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
drop policy if exists subst_apolices_dono on public.subst_apolices;
create policy subst_apolices_dono on public.subst_apolices for all to public using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
drop policy if exists subst_clientes_dono on public.subst_clientes;
create policy subst_clientes_dono on public.subst_clientes for all to public using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
drop policy if exists subst_pagamentos_dono on public.subst_pagamentos;
create policy subst_pagamentos_dono on public.subst_pagamentos for all to public using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
