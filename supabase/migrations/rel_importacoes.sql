-- REL-SUPORTADOS-V1 (28/09/2026): registro de cada importacao de relatorio (qual, quando, quem, quantas linhas).
-- Serve pra tela "Relatorios suportados" mostrar a ultima atualizacao de cada um. Sem dado de cliente.
create table if not exists public.rel_importacoes (
  id     bigserial primary key,
  tipo   text not null,
  por    text,
  em     timestamptz not null default now(),
  linhas integer
);
alter table public.rel_importacoes enable row level security;
drop policy if exists rel_importacoes_ler on public.rel_importacoes;
create policy rel_importacoes_ler on public.rel_importacoes for select to authenticated using (crm_autorizado());
drop policy if exists rel_importacoes_gravar on public.rel_importacoes;
create policy rel_importacoes_gravar on public.rel_importacoes for insert to authenticated
  with check (crm_autorizado() and por = lower(coalesce(auth.jwt() ->> 'email','')));
revoke all on public.rel_importacoes from anon;
grant select, insert on public.rel_importacoes to authenticated;
grant usage, select on sequence public.rel_importacoes_id_seq to authenticated;
create index if not exists rel_importacoes_tipo_em on public.rel_importacoes (tipo, em desc);
