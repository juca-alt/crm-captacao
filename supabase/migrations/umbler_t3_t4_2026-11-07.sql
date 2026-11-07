-- ============================================================================
-- UMBLER T3 + T4 (07/11/2026) — RODAR À MÃO no SQL editor, DEPOIS do deploy da function `umbler`.
-- Nada aqui apaga dado. Cada bloco tem a conferência antes/depois.
-- ============================================================================

-- ---------- T3: autor das mensagens nossas que ficaram sem nome ----------
-- A API às vezes manda o remetente só com o id; o nome está no mapa de membros que o próprio sync
-- grava em umbler_estado.stats->'membros'. Conferido em 07/11: 141 do Gustavo + 74 do Victor sem autor.

-- (a) ANTES — quantas vão mudar, por nome
with mp as (select key id, value nome from umbler_estado, jsonb_each_text(stats->'membros'))
select mp.nome, count(*) vai_receber_autor
from umbler_mensagens m join mp on mp.id = m.bruto->'sentByOrganizationMember'->>'id'
where m.autor is null and m.de = 'nos'
group by 1;

-- (b) o backfill
with mp as (select key id, value nome from umbler_estado, jsonb_each_text(stats->'membros'))
update umbler_mensagens m set autor = mp.nome
from mp
where m.autor is null and m.de = 'nos'
  and mp.id = m.bruto->'sentByOrganizationMember'->>'id';

-- (c) DEPOIS — tem que dar 0
select count(*) ainda_sem_autor
from umbler_mensagens m
where m.autor is null and m.de = 'nos' and m.bruto->'sentByOrganizationMember'->>'id' is not null;


-- ---------- T4: cron com folga de tempo ----------
-- O pg_net desistia em 5 s e marcava timeout (8 de 36 chamadas nas últimas 24 h em 07/11). A function
-- responde "iniciado" na hora e roda em segundo plano; 20 s só dá folga pro arranque a frio.
-- Mesma URL, mesma chave do Vault (umbler_cron_chave), mesmo horário — só o timeout muda.
do $$ begin
  if exists (select 1 from cron.job where jobname='umbler-sync') then perform cron.unschedule('umbler-sync'); end if;
  perform cron.schedule('umbler-sync', '*/10 * * * *', $job$
    select net.http_post(
      url := 'https://cjieobmdpqcupzdpckef.supabase.co/functions/v1/umbler',
      headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-chave', (select decrypted_secret from vault.decrypted_secrets where name='umbler_cron_chave')),
      body := '{"modo":"cron"}'::jsonb,
      timeout_milliseconds := 20000)
  $job$);
end $$;

-- conferência: o job existe, ativo, com 20000
select jobname, schedule, active, command like '%20000%' timeout_20s from cron.job where jobname='umbler-sync';
-- e, depois de 6 h: nenhum timeout novo
-- select count(*) filter (where timed_out) timeouts, count(*) total from net._http_response where created > now()-interval '6 hours';
