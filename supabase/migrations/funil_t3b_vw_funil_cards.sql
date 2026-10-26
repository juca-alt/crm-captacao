-- FUNIL ÚNICO · T3b (26/10/2026) — view `vw_funil_cards`: os cards FANTASMA do quadro (só leitura).
--
-- DECISÃO DELE (26/10, "T3b A"): SÓ os clientes da carteira sem ficha. Os leads do LinkedIn ficaram de fora — a tabela
-- `leads` é da Captação de LIFE PLANNERS (recrutamento), não prospect de venda (1.038 nomes, só 114 com contato).
--
-- O QUE FAZ
--   fonte='carteira' → cliente da carteira (`carteira_clientes`) com apólice Ativa/Pendente de Emissão e SEM ficha em
--   lp_contatos (do mesmo dono) → aparece no quadro 🎯 Vida Individual na coluna 'emitida' (Apólice Emitida), só leitura.
--   Não migra nada, não grava nada: é só uma VIEW. Quando ele "trouxer pro funil" (botão no card), o app cria o contato
--   em lp_contatos com o mesmo nome/telefone e o fantasma some sozinho na próxima leitura.
--
-- SEGURANÇA
--   security_invoker = true → quem consulta enxerga só o que a RLS das tabelas de base deixa
--   (lp_contatos / carteira_*: dono IN lp_donos_visiveis() — o próprio + quem delegou pra ele). anon: sem acesso.
--
-- CASAMENTO (o fantasma só aparece se NADA bater com uma linha de lp_contatos DO MESMO DONO, inclusive Estoque e
-- fundidos): nome normalizado (emb_nome_norm) OU telefone (celular/telefone/telComercial; DDD + 8 últimos, inclui
-- telefones_alt) OU e-mail — a mesma regra do app (drwCarteira casa por nome OU telefone).
--
-- COMO CONFERIR (SQL editor):
--   select split_part(dono,'@',1) as dono, count(*) as cards from public.vw_funil_cards group by 1 order by 1;
--   Esperado em 26/10/2026 (simulado antes de criar): 3 do Gustavo + 26 do Daniel (o Gustavo vê os 26 por delegação).
--
-- ROLLBACK:
--   drop view if exists public.vw_funil_cards;

create or replace view public.vw_funil_cards with (security_invoker = true) as
with
-- todas as chaves de casamento das fichas do LP (qualquer funil, Estoque e fundidos inclusos)
ck as materialized (
  select c.dono, 't:' || public.emb_tel_chave(c.dados->>'telefone') as k
    from public.lp_contatos c where public.emb_tel_chave(c.dados->>'telefone') is not null
  union
  select c.dono, 't:' || public.emb_tel_chave(x.v)
    from public.lp_contatos c
    cross join lateral jsonb_array_elements_text(case when jsonb_typeof(c.dados->'telefones_alt') = 'array'
                                                      then c.dados->'telefones_alt' else '[]'::jsonb end) as x(v)
   where public.emb_tel_chave(x.v) is not null
  union
  select c.dono, 'e:' || lower(btrim(c.dados->>'email'))
    from public.lp_contatos c where coalesce(btrim(c.dados->>'email'),'') <> ''
  union
  select c.dono, 'n:' || public.emb_nome_norm(c.dados->>'nome')
    from public.lp_contatos c where public.emb_nome_norm(c.dados->>'nome') is not null
),

-- ── 2) clientes da carteira sem ficha ──
ap as (
  select a.dono, a.dados->>'cli_ref' as ref,
         count(*)                                                        as n_apolices,
         sum(case when jsonb_typeof(a.dados->'premio') = 'number'
                  then (a.dados->>'premio')::numeric / case when a.dados->>'periodicidade' = 'Anual' then 12 else 1 end end) as premio_mensal,
         count(*) filter (where jsonb_typeof(a.dados->'premio') <> 'number') as apolices_sem_premio
    from public.carteira_apolices a
   where a.dados->>'status' in ('Ativa','Pendente de Emissão')
   group by 1,2
),
cli as (
  select k.dono, k.ref, k.dados, k.atualizado, ap.n_apolices, ap.premio_mensal, ap.apolices_sem_premio
    from public.carteira_clientes k
    join ap on ap.dono = k.dono and ap.ref = k.ref        -- só quem tem apólice viva
),
cli_bate as (
  select distinct cl.dono, cl.ref
    from cli cl
    cross join lateral unnest(array[
      'n:' || public.emb_nome_norm(cl.dados->>'nome'),
      't:' || public.emb_tel_chave(cl.dados->>'celular'),
      't:' || public.emb_tel_chave(cl.dados->>'telefone'),
      't:' || public.emb_tel_chave(cl.dados->>'telComercial'),
      'e:' || nullif(lower(btrim(cl.dados->>'email')),'')]) as kk(k)
    join ck on ck.dono = cl.dono and ck.k = kk.k
),
fant_cli as (
  select 'carteira'::text                                   as fonte,
         cl.ref                                             as ref_id,
         cl.dono                                            as dono,
         cl.dados->>'nome'                                  as nome,
         coalesce(nullif(cl.dados->>'celular',''), nullif(cl.dados->>'telefone',''), nullif(cl.dados->>'telComercial','')) as telefone,
         nullif(btrim(cl.dados->>'email'),'')               as email,
         null::text                                         as cidade,
         null::text                                         as profissao,
         'vi'::text                                         as funil_id,
         'emitida'::text                                    as etapa_id,
         'carteira'::text                                   as origem_tipo,
         jsonb_strip_nulls(jsonb_build_object(
           'n_apolices',          cl.n_apolices,
           'premio_mensal',       round(cl.premio_mensal, 2),
           'apolices_sem_premio', nullif(cl.apolices_sem_premio, 0),
           'produtos',            nullif(cl.dados->>'produtos',''),
           'idade',               cl.dados->'idade',
           'nascimento',          nullif(cl.dados->>'nascimento',''),
           'fonte_importacao',    nullif(cl.dados->>'_fonte',''),
           'tem_contato',         true
         ))                                                 as extra,
         coalesce(case when cl.dados->>'_importadoEm' ~ '^\d{4}-\d{2}-\d{2}'
                       then left(cl.dados->>'_importadoEm',10)::date::timestamptz end, cl.atualizado) as criado_em
    from cli cl
   where not exists (select 1 from cli_bate b where b.dono = cl.dono and b.ref = cl.ref)
)
select * from fant_cli;

comment on view public.vw_funil_cards is
  'FUNIL ÚNICO T3b: cards fantasma (só leitura) do quadro Vida Individual — clientes da carteira com apólice viva e sem ficha (coluna emitida). security_invoker: RLS de quem consulta.';

revoke all on public.vw_funil_cards from anon, authenticated, public;
grant select on public.vw_funil_cards to authenticated;
