-- Controle de PLACED (módulo do CRM Visão LP) — um documento jsonb por dono, mesmo padrão da carteira.
-- Aplicado no playground em 04/09/2026.
create table if not exists public.placed_estado (
  dono text primary key default (auth.jwt() ->> 'email'),
  dados jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now()
);
alter table public.placed_estado enable row level security;
drop policy if exists placed_estado_dono on public.placed_estado;
create policy placed_estado_dono on public.placed_estado
  for all using (dono = (auth.jwt() ->> 'email')) with check (dono = (auth.jwt() ->> 'email'));
-- rollback: drop table public.placed_estado;
