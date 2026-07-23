-- ============================================================================
--  Sync contatos/funil da Visão LP → Supabase (frente "c" do ESTADO, 23/07/2026)
--
--  Até aqui os contatos e funis do vendas.html (Novos Negócios + Base de
--  Clientes) viviam SÓ no localStorage de cada aparelho (crmlp_v03_state).
--  Esta tabela é o espelho por dono: 1 linha por contato, `dados` jsonb =
--  contato inteiro no shape do app (id, lp, nome, telefone, etapa, funil,
--  notas, ance, eventos…). O app continua usando localStorage como cache e
--  fallback offline; logado, o banco vira o espelho e sincroniza aparelhos.
--  Merge por contato: campo `_upd` (carimbado pelo app dentro do jsonb) —
--  o maior vence. A extensão de WhatsApp lê/edita a mesma tabela.
--
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
--  Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

create table if not exists public.lp_contatos (
  dono       text        not null default (auth.jwt()->>'email'),
  id         text        not null,
  dados      jsonb       not null,
  atualizado timestamptz not null default now(),
  primary key (dono, id)
);

alter table public.lp_contatos enable row level security;

-- RLS por dono (mesmo padrão da carteira): cada LP só vê/grava os próprios contatos
drop policy if exists lp_contatos_dono on public.lp_contatos;
create policy lp_contatos_dono on public.lp_contatos
  for all to authenticated
  using (dono = (auth.jwt()->>'email'))
  with check (dono = (auth.jwt()->>'email'));

-- carimbo de atualização automático no update
create or replace function public.lp_contatos_touch() returns trigger
language plpgsql as $$
begin
  new.atualizado := now();
  return new;
end $$;
drop trigger if exists trg_lp_contatos_touch on public.lp_contatos;
create trigger trg_lp_contatos_touch before update on public.lp_contatos
  for each row execute function public.lp_contatos_touch();

-- ── Verificação (só leitura) ──────────────────────────────────────────────────
select tablename, rowsecurity from pg_tables where tablename='lp_contatos';
select policyname from pg_policies where tablename='lp_contatos';
