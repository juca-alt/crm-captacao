-- Apólices Emitidas no Período (relatório UW e Emissão) — mesma RLS por dono/delegação das pendências.
-- Aplicado no playground em 04/09/2026.
create table if not exists public.emissao_emitidas (
  id uuid primary key default gen_random_uuid(),
  lp_email text not null default (auth.jwt() ->> 'email'),
  proposta text, apolice text,
  segurado text not null default '', resp_pagamento text, status_apolice text,
  dt_assinatura date, emissao date,
  motivo_cancelamento text, motivo_uw text,
  pa_sem_iof numeric, afyc_projetado numeric,
  lp text, lp_nome_completo text,
  origem_relatorio date, periodo_ini date, periodo_fim date,
  nomes_conferir boolean not null default false,
  importado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  chave text generated always as (coalesce(apolice, proposta)) stored,
  unique (lp_email, chave)
);
alter table public.emissao_emitidas enable row level security;
drop policy if exists emissao_emitidas_dono on public.emissao_emitidas;
create policy emissao_emitidas_dono on public.emissao_emitidas
  for all using (lp_email in (select lp_donos_visiveis())) with check (lp_email in (select lp_donos_visiveis()));
-- rollback: drop table public.emissao_emitidas;
