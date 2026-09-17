-- NIVER-FEITO-V1 (17/09/2026) — "permitir que eu marque os aniversários em que já dei parabéns: feito".
-- Uma linha por (dono, pessoa, ano). A pessoa é a chave do card de aniversariantes
-- (últimos 8 dígitos do telefone, ou o nome normalizado) — a mesma que junta carteira,
-- negócio e lead numa linha só. Guardar por ANO: ano que vem a pessoa volta pra lista.
-- Mesmo padrão de RLS da lp_dup_fila: dono = e-mail do login. IDEMPOTENTE.
create table if not exists public.lp_niver_feito (
  dono      text not null default (auth.jwt()->>'email'),
  chave     text not null,
  ano       int  not null,
  nome      text,
  feito_em  timestamptz not null default now(),
  primary key (dono, chave, ano)
);
alter table public.lp_niver_feito enable row level security;
drop policy if exists lpnf_dono on public.lp_niver_feito;
create policy lpnf_dono on public.lp_niver_feito for all to authenticated
  using (dono = (auth.jwt()->>'email')) with check (dono = (auth.jwt()->>'email'));
