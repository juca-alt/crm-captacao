-- ============================================================================
--  Controle de ID por lead — código sequencial visível (PI#####) + backstops
--  de deduplicação. Complementa os índices UNIQUE já existentes em
--  linkedin_url_norm e telefone_e164 (CRM LP v1.0).
--
--  O app (index.html v2.6) já deduplica na criação por LinkedIn/telefone/
--  e-mail via insertLead/insertLeadsBatch; este script dá o código visível
--  por lead e deixa pronta (comentada) a trava de e-mail no banco.
--
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
--  Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

-- ── 0) RELATÓRIO (só leitura — rode antes p/ conhecer a base) ────────────────
-- formatos de codigo já existentes (legado v1.0; NÃO serão sobrescritos):
select codigo, count(*) n from public.leads
 where codigo is not null and codigo <> '' group by 1 order by 1 limit 20;
-- e-mails duplicados hoje (impedem a trava do passo 2 — limpe antes em "Duplicatas"):
select lower(trim(email)) em, count(*) n, array_agg(id) ids
  from public.leads where email is not null and email <> ''
 group by 1 having count(*) > 1 order by n desc;

-- ── 1) Código sequencial PI##### ──────────────────────────────────────────────
-- Todo lead novo ganha codigo automático; os antigos SEM código são preenchidos
-- na ordem de criação (id). Códigos legados preenchidos ficam intocados; a
-- sequência começa acima do maior sufixo numérico já usado.
create sequence if not exists public.leads_codigo_seq;

select setval('public.leads_codigo_seq',
  greatest(
    coalesce((select max(nullif(regexp_replace(codigo,'\D','','g'),'')::bigint)
                from public.leads where codigo is not null), 0),
    (select count(*) from public.leads),
    1));

create or replace function public.leads_set_codigo() returns trigger
language plpgsql as $$
begin
  if new.codigo is null or new.codigo = '' then
    new.codigo := 'PI' || lpad(nextval('public.leads_codigo_seq')::text, 5, '0');
  end if;
  return new;
end $$;

drop trigger if exists trg_leads_codigo on public.leads;
create trigger trg_leads_codigo before insert on public.leads
  for each row execute function public.leads_set_codigo();

-- backfill: só quem está sem código, na ordem de criação
with pendentes as (
  select id from public.leads where codigo is null or codigo = '' order by id
)
update public.leads l
   set codigo = 'PI' || lpad(nextval('public.leads_codigo_seq')::text, 5, '0')
  from pendentes p where l.id = p.id;

-- ── 2) Trava de e-mail no banco (OPCIONAL — ligar depois de limpar a base) ───
-- O app já barra e-mail duplicado na criação; este índice é o backstop.
-- Só descomente quando o relatório de e-mails duplicados (passo 0) vier vazio,
-- senão o CREATE INDEX falha.
-- create unique index if not exists leads_email_norm_uq
--   on public.leads (lower(trim(email))) where email is not null and email <> '';

-- ── 3) Verificação (só leitura) ───────────────────────────────────────────────
-- códigos gerados:
select codigo, nome from public.leads order by id desc limit 5;
-- backstops UNIQUE ativos na tabela:
select indexname, indexdef from pg_indexes
 where tablename = 'leads' and indexdef ilike '%unique%';
