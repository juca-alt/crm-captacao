-- Perfil do cliente da carteira (04/09/2026): profissão, locais, cônjuge, filhos, notas.
-- Vive FORA de carteira_clientes porque a importação da carteira apaga e reinsere aquela tabela.
create table if not exists public.carteira_perfil (
  dono text not null default (auth.jwt() ->> 'email'),
  ref text not null,
  dados jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now(),
  primary key (dono, ref)
);
alter table public.carteira_perfil enable row level security;
drop policy if exists carteira_perfil_dono on public.carteira_perfil;
create policy carteira_perfil_dono on public.carteira_perfil for all using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
-- rollback: drop table public.carteira_perfil;
