-- ============================================================================
-- TRIAGEM-V1 (ticket I, parte 2 · 09/11/2026) — RODAR À MÃO no SQL editor do CRM (cjieobmdpqcupzdpckef).
-- Palavra dele: "quero você [copiloto] resolvendo; foco dela nas interações".
-- Cada conversa em que o CLIENTE falou por último (últimos 7 dias) ganha um destino, classificado pela IA (Haiku):
--   gustavo (🔴 você decide) · rebeca (🟡) · vitor (🔵 Multi Office/VG/outros seguros) · sem_acao (⚪)
-- A tabela guarda SÓ o destino e um motivo curto — nunca o texto da conversa. Reclassifica só quando chega mensagem nova.
-- Idempotente. Rollback: drop table public.copiloto_fila_cache; select cron.unschedule('triagem-sync');
-- ============================================================================

create table if not exists public.copiloto_fila_cache (
  chat_id         text primary key,                 -- umbler_chats.id
  dono            text not null,                    -- RLS (igual às tabelas umbler_*)
  ultima_msg_em   timestamptz,                      -- a última mensagem que a IA leu (muda → reclassifica)
  destino         text not null check (destino in ('gustavo','rebeca','vitor','sem_acao')),
  motivo          text,                             -- 1 linha, sem dado pessoal
  urgencia        smallint check (urgencia between 1 and 3),
  modelo          text,
  classificado_em timestamptz not null default now()
);
create index if not exists copiloto_fila_dono on public.copiloto_fila_cache (dono, destino);

-- RLS: o app só LÊ (dono + delegados); escrita só pela Edge Function `triagem` (service role)
alter table public.copiloto_fila_cache enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='copiloto_fila_cache' and policyname='copiloto_fila_cache_ler') then
    create policy copiloto_fila_cache_ler on public.copiloto_fila_cache for select to authenticated
      using (dono in (select public.lp_donos_visiveis()));
  end if;
end $$;
revoke all on public.copiloto_fila_cache from anon;
revoke insert, update, delete on public.copiloto_fila_cache from authenticated;
grant select on public.copiloto_fila_cache to authenticated;

-- cron: a cada 10 min, 5 min depois do sync da Umbler (o sync roda em :00, :10…; a triagem em :05, :15…).
-- Usa a MESMA chave do cron do sync (Vault 'umbler_cron_chave'); a função confere por umbler_chave_ok().
do $$ begin
  if exists (select 1 from cron.job where jobname='triagem-sync') then perform cron.unschedule('triagem-sync'); end if;
  perform cron.schedule('triagem-sync', '5-59/10 * * * *', $job$
    select net.http_post(
      url := 'https://cjieobmdpqcupzdpckef.supabase.co/functions/v1/triagem',
      headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-chave', (select decrypted_secret from vault.decrypted_secrets where name='umbler_cron_chave')),
      body := '{"modo":"cron"}'::jsonb,
      timeout_milliseconds := 20000)
  $job$);
end $$;

-- conferência: tabela existe com RLS e o cron está ativo
select (select relrowsecurity from pg_class where oid = 'public.copiloto_fila_cache'::regclass) as rls_ok,
       (select active from cron.job where jobname = 'triagem-sync') as cron_ok;
