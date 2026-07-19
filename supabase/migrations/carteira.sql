-- ============================================================================
--  Visão Life Planner — CARTEIRA DE CLIENTES no Supabase (fase 2 do módulo)
--  Modelo SNAPSHOT SUBSTITUTIVO por dono: o import dos 2 .xls da Prudential
--  substitui a carteira inteira (delete das linhas do dono + insert) — cliente
--  que saiu da carteira deve SUMIR, diferente do LPDB que preserva histórico.
--  `dados` é jsonb com o shape do CART do app (vendas.html) intacto: o parser
--  client-side é a fonte da verdade dos campos (evolui sem nova migração).
--
--  `dono` = e-mail do usuário logado, preenchido por DEFAULT no insert (o app
--  não manda). RLS POR DONO desde o dia 1: cada LP vê e grava SÓ a própria
--  carteira (Gustavo ≠ Daniel). Isso é mais estrito que o lp_relatorio_itens
--  (authenticated-full) de propósito — carteira é o dado mais sensível do app.
--
--  ⚠️ Não toca em nenhuma tabela existente. Prefixo `carteira_` é novo.
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
-- ============================================================================

create table if not exists public.carteira_clientes (
  dono        text not null default (auth.jwt()->>'email'),
  ref         text not null,                        -- normKey(nome) — chave natural do cliente
  dados       jsonb not null default '{}'::jsonb,   -- objeto cliente do CART (cob, contatos, _raw…)
  atualizado  timestamptz not null default now(),
  primary key (dono, ref)
);

create table if not exists public.carteira_apolices (
  dono        text not null default (auth.jwt()->>'email'),
  chave       text not null,                        -- "apólice|idx" — única dentro do snapshot
  dados       jsonb not null default '{}'::jsonb,   -- objeto apólice do CART (segurado, respPagto…)
  atualizado  timestamptz not null default now(),
  primary key (dono, chave)
);

-- ── RLS por dono (select/insert/update/delete só nas linhas do próprio e-mail) ──
alter table public.carteira_clientes enable row level security;
alter table public.carteira_apolices enable row level security;

drop policy if exists carteira_clientes_dono on public.carteira_clientes;
create policy carteira_clientes_dono on public.carteira_clientes
  for all to authenticated
  using (dono = (auth.jwt()->>'email'))
  with check (dono = (auth.jwt()->>'email'));

drop policy if exists carteira_apolices_dono on public.carteira_apolices;
create policy carteira_apolices_dono on public.carteira_apolices
  for all to authenticated
  using (dono = (auth.jwt()->>'email'))
  with check (dono = (auth.jwt()->>'email'));
