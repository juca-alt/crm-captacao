-- ============================================================================
--  Visão Life Planner — armazenamento do relatório semanal (BackOffice + Clientes)
--  Modelo SNAPSHOT por LP, preservando o status do app por chave (apólice/proposta
--  /cliente). Uma tabela única com discriminador `entidade` cobre as 5 entidades
--  lógicas do brief (atrasos, pendencias, statust, aniversario, datas) — mesmo
--  shape, um upsert, uma policy. O app (vendas.html) é a fonte da verdade dos
--  campos; por isso `dados` é jsonb (acompanha o parser sem nova migração).
--
--  ⚠️ NÃO mexe na tabela `vendas_atrasos` (do CRM LP v1.0). Prefixo `lp_` é novo.
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
-- ============================================================================

create table if not exists public.lp_relatorio_itens (
  id          bigint generated always as identity primary key,
  entidade    text not null check (entidade in ('atrasos','pendencias','statust','aniversario','datas')),
  lp          text not null,                 -- dono (nome do LP do relatório; futuro: lp_email)
  chave       text not null,                 -- chave de upsert (apólice/proposta/cliente, normalizada)
  dados       jsonb not null default '{}'::jsonb,  -- campos parseados da linha
  status      text not null default 'pendente',   -- status_followup OU status_contato (estado do app)
  resolvido   boolean not null default false,      -- sumiu do último relatório (arquivado, não deletado)
  entrou      date not null default current_date,  -- 1ª vez visto
  visto       date not null default current_date,  -- último relatório em que apareceu
  atualizado  timestamptz not null default now(),
  unique (entidade, lp, chave)               -- a chave de upsert (preserva status no re-upload)
);

create index if not exists lp_itens_ent_lp_idx on public.lp_relatorio_itens (entidade, lp);
create index if not exists lp_itens_ativos_idx on public.lp_relatorio_itens (entidade, lp) where not resolvido;

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Liga RLS. Por ora, igual ao que foi feito no CRM LP v1.0: acesso total para
-- QUALQUER usuário autenticado (a Edge Function já exige login; visitante anônimo
-- nem chega aqui). A trava POR LP (cada LP só o seu; Master vê tudo) fica pronta
-- abaixo, comentada, p/ ligar quando o modelo de identidade por lp_email entrar —
-- ver dívida [[crm-captacao-rls-pendente]]. Decisão de segurança = do Gustavo.
alter table public.lp_relatorio_itens enable row level security;

drop policy if exists lp_itens_auth_full on public.lp_relatorio_itens;
create policy lp_itens_auth_full on public.lp_relatorio_itens
  for all to authenticated using (true) with check (true);

-- -- POLICY estrita por LP (ligar na fase de identidade real):
-- -- pressupõe um mapa auth.uid()/email -> nome do LP (ex.: tabela lp_membros(email, lp, papel)).
-- drop policy if exists lp_itens_auth_full on public.lp_relatorio_itens;
-- create policy lp_itens_por_lp on public.lp_relatorio_itens
--   for all to authenticated
--   using (
--     exists (select 1 from public.lp_membros m
--             where m.email = auth.jwt()->>'email'
--               and (m.papel = 'master' or m.lp = lp_relatorio_itens.lp))
--   ) with check (true);

-- ── Upsert helper (opcional; o app também pode usar .upsert() do supabase-js) ──
-- Preserva status/entrou quando a chave reaparece; reseta resolvido; atualiza dados/visto.
create or replace function public.lp_upsert_item(
  p_entidade text, p_lp text, p_chave text, p_dados jsonb
) returns void language sql as $$
  insert into public.lp_relatorio_itens (entidade, lp, chave, dados, status, resolvido, visto, atualizado)
  values (p_entidade, p_lp, p_chave, p_dados, 'pendente', false, current_date, now())
  on conflict (entidade, lp, chave) do update
    set dados = excluded.dados,
        resolvido = false,
        visto = current_date,
        atualizado = now();
$$;
