-- ============================================================================
--  Base de Nomes / SITPLAN / TA — frente 03/08/2026 (handoff da sessão Cowork)
--
--  Os 5.229 contatos tratados entram na lp_contatos QUE JÁ EXISTE (jsonb
--  `dados`, marcador funil:'bn'), então aqui só nascem as tabelas satélite:
--    · lp_contato_origens — rastro append-only das 8.175 origens (é o que
--      torna qualquer fusão reversível; regra nº1 do Gustavo)
--    · lp_dup_fila        — 118 pares ambíguos; SÓ o humano decide
--    · lp_interacoes      — resultado de cada TA/OI (move o estágio)
--    · lp_sitplan         — sessões de planejamento
--    · lp_perfis          — painel adm: quais módulos cada LP enxerga
--      (privacidade/beta; Gustavo=admin libera por usuário)
--
--  Mesmo padrão da lp_contatos: RLS por dono = e-mail do login Google.
--  Idempotente. Rodável no crm-playground (cjieobmdpqcupzdpckef).
-- ============================================================================

create table if not exists public.lp_contato_origens (
  id         bigint generated always as identity primary key,
  dono       text not null default (auth.jwt()->>'email'),
  contato_id text not null,
  id_origem  text,
  sistema    text,
  arquivo    text,
  funil      text,
  etapa      text,
  data_mod   text
);
create index if not exists idx_lpco_dono_contato
  on public.lp_contato_origens (dono, contato_id);

create table if not exists public.lp_dup_fila (
  dono        text not null default (auth.jwt()->>'email'),
  id_a        text not null,
  id_b        text not null,
  motivo      text,
  chave       text,
  decisao     text check (decisao in ('fundir','manter_separado') or decisao is null),
  decidido_em timestamptz,
  primary key (dono, id_a, id_b)
);

create table if not exists public.lp_interacoes (
  id         bigint generated always as identity primary key,
  dono       text not null default (auth.jwt()->>'email'),
  contato_id text not null,
  tipo       text not null check (tipo in ('ta','oi','msg','nota')),
  resultado  text check (resultado in
               ('atendeu','nao_atendeu','agendou','recusou','numero_errado') or resultado is null),
  obs        text,
  quando     timestamptz not null default now()
);
create index if not exists idx_lpi_dono_contato
  on public.lp_interacoes (dono, contato_id);

create table if not exists public.lp_sitplan (
  id                   bigint generated always as identity primary key,
  dono                 text not null default (auth.jwt()->>'email'),
  data                 date not null default current_date,
  contatos_trabalhados int  not null default 0,
  promovidos           int  not null default 0,
  notas                text
);

-- ── Painel adm: módulos por usuário ──────────────────────────────────────────
-- `modulos` = jsonb {"bn-estoque":true,"bn-dups":false,...}. Chave ausente =
-- segue o default do app (módulos estáveis ligados, beta desligado p/ não-admin).
create table if not exists public.lp_perfis (
  email      text primary key,
  papel      text not null default 'lp' check (papel in ('admin','lp')),
  modulos    jsonb not null default '{}'::jsonb,
  atualizado timestamptz not null default now()
);

-- Checagem de admin SEM recursão de RLS na própria tabela
create or replace function public.lp_sou_admin() returns boolean
language sql stable security definer set search_path = public as
$$ select exists(select 1 from public.lp_perfis
                 where email = (auth.jwt()->>'email') and papel = 'admin') $$;
revoke all on function public.lp_sou_admin() from anon;

-- ── RLS: dono vê o seu; admin (lp_perfis) vê/gerencia tudo ──────────────────
alter table public.lp_contato_origens enable row level security;
drop policy if exists lpco_dono on public.lp_contato_origens;
create policy lpco_dono on public.lp_contato_origens for all to authenticated
  using (dono = (auth.jwt()->>'email')) with check (dono = (auth.jwt()->>'email'));

alter table public.lp_dup_fila enable row level security;
drop policy if exists lpdf_dono on public.lp_dup_fila;
create policy lpdf_dono on public.lp_dup_fila for all to authenticated
  using (dono = (auth.jwt()->>'email')) with check (dono = (auth.jwt()->>'email'));

alter table public.lp_interacoes enable row level security;
drop policy if exists lpi_dono on public.lp_interacoes;
create policy lpi_dono on public.lp_interacoes for all to authenticated
  using (dono = (auth.jwt()->>'email')) with check (dono = (auth.jwt()->>'email'));

alter table public.lp_sitplan enable row level security;
drop policy if exists lps_dono on public.lp_sitplan;
create policy lps_dono on public.lp_sitplan for all to authenticated
  using (dono = (auth.jwt()->>'email')) with check (dono = (auth.jwt()->>'email'));

alter table public.lp_perfis enable row level security;
drop policy if exists lpp_ler_proprio on public.lp_perfis;
create policy lpp_ler_proprio on public.lp_perfis for select to authenticated
  using (email = (auth.jwt()->>'email') or public.lp_sou_admin());
drop policy if exists lpp_admin_escreve on public.lp_perfis;
create policy lpp_admin_escreve on public.lp_perfis
  for all to authenticated
  using (public.lp_sou_admin()) with check (public.lp_sou_admin());

-- Seed: Gustavo é o admin. Daniel entra pela UI do painel adm quando liberado.
insert into public.lp_perfis (email, papel)
  values ('juca@segurocomjuca.com','admin')
  on conflict (email) do update set papel='admin';

-- ── Verificação (só leitura) ─────────────────────────────────────────────────
select tablename, rowsecurity from pg_tables where schemaname='public'
  and tablename in ('lp_contato_origens','lp_dup_fila','lp_interacoes','lp_sitplan','lp_perfis');
