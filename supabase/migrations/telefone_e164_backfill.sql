-- ============================================================================
--  Backfill de telefone_e164 nos leads antigos — corrige "cadastrado mas a
--  extensão de WhatsApp não reconhece".
--
--  Contexto 23/07/2026: a extensão casa o lead pelo telefone_e164. Leads
--  gravados por versões antigas do app (ou importados) têm `telefone`
--  preenchido mas `telefone_e164` vazio → nunca casam. Este script normaliza
--  o que dá (10/11 dígitos, com ou sem o 55 do país) e lista o resto pra
--  arrumar na mão (sem DDD etc.).
--
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
--  Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

-- ── 1) DIAGNÓSTICO (só leitura): quantos têm telefone mas não têm e164 ───────
select count(*) as sem_e164
  from public.leads
 where telefone is not null and telefone <> ''
   and (telefone_e164 is null or telefone_e164 = '');

-- ── 2) BACKFILL: normaliza 10/11 dígitos (regra do normPhone do app) ─────────
with base as (
  select id, regexp_replace(telefone, '\D', '', 'g') as d
    from public.leads
   where telefone is not null and telefone <> ''
     and (telefone_e164 is null or telefone_e164 = '')
), norm as (
  select id,
         case when d like '55%' and length(d) > 11 then substr(d, 3) else d end as dd
    from base
)
update public.leads l
   set telefone_e164 = '+55' || n.dd
  from norm n
 where l.id = n.id
   and length(n.dd) in (10, 11);

-- ── 3) SOBRAS (só leitura): telefones que não deu pra normalizar ─────────────
-- (sem DDD, curtos demais, internacionais…) — arrume o campo Telefone na ficha
-- do lead no CRM; o app deriva o e164 sozinho ao salvar.
select id, codigo, nome, telefone
  from public.leads
 where telefone is not null and telefone <> ''
   and (telefone_e164 is null or telefone_e164 = '')
 order by id;
