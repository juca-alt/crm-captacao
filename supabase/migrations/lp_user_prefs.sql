-- NAV-ORDEM-V2 (28/09/2026): preferencias de tela POR USUARIO (ordem do menu lateral).
-- Cada usuario le e grava so a propria linha (email do JWT). Nada de dado de cliente aqui.
create table if not exists public.lp_user_prefs (
  email      text primary key,
  prefs      jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now()
);
alter table public.lp_user_prefs enable row level security;
drop policy if exists lp_user_prefs_proprio on public.lp_user_prefs;
create policy lp_user_prefs_proprio on public.lp_user_prefs
  for all to authenticated
  using (email = lower(coalesce(auth.jwt() ->> 'email','')) and crm_autorizado())
  with check (email = lower(coalesce(auth.jwt() ->> 'email','')) and crm_autorizado());
revoke all on public.lp_user_prefs from anon;
grant select, insert, update on public.lp_user_prefs to authenticated;
