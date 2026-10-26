-- FUNIL ÚNICO · T3b (26/10/2026) — view `vw_funil_cards`: os cards FANTASMA do quadro (só leitura, opção A dele).
--
-- O QUE FAZ
--   Junta numa forma única duas populações que NÃO têm linha em lp_contatos e que o quadro novo (modulos/funil-unico.js)
--   mostra como card somente-leitura no funil 🎯 Vida Individual ('vi'):
--     1) fonte='linkedin' → lead da Captação arquivada (tabela `leads`) ainda vivo e SEM ficha no LP     → etapa 'novo'
--        (decisão 3A: oportunidade que vem de outro pipe cai na 1ª etapa; a etapa da Captação vai no `extra`)
--     2) fonte='carteira' → cliente da carteira (`carteira_clientes`) com apólice Ativa/Pendente e SEM ficha → etapa 'emitida'
--        (CLIENTE_COL.vi)
--   Não migra nada, não grava nada: é só uma VIEW. Quando ele "trouxer pro funil", o app cria o contato em lp_contatos
--   (com lead_id / mesmo telefone) e o fantasma some sozinho na próxima leitura.
--
-- SEGURANÇA
--   security_invoker = true → quem consulta enxerga só o que a RLS das tabelas de base deixa (todas com RLS ligado):
--     · lp_contatos / carteira_*: dono IN lp_donos_visiveis() (o próprio + quem delegou pra ele)
--     · leads: NÃO é por dono — é da equipe da Captação (crm_captacao_user() = e-mail em app_users). Por isso o `dono` do
--       fantasma de lead é o admin da Captação que também é dono no LP e está entre os donos visíveis de quem consulta
--       (hoje: o Gustavo; o Victor vê por delegação; o Daniel não está em app_users → 0 leads).
--   anon: sem acesso (revoke). authenticated: select.
--
-- REGRAS DE CASAMENTO (o fantasma só aparece se NADA bater com uma linha de lp_contatos DO MESMO DONO — inclusive Estoque
-- e fundidos, pra não duplicar o que o Estoque já mostra):
--   · lead: lp_contatos.dados.lead_id = leads.id  OU  telefone (emb_tel_chave: DDD + 8 últimos, inclui telefones_alt)
--           OU e-mail (minúsculo, sem espaço)  OU  slug do LinkedIn (linkedin.com/in/<slug>, minúsculo).
--           Nome igual NÃO esconde (homônimo demais na base de 6 mil nomes): vira extra.possivel_dup_nome = true.
--           (lp_match_leads não é usada: tem RLS sem política → invisível pro app; dados.lead_id espelha ela 754/754.)
--   · carteira: nome normalizado (emb_nome_norm) OU telefone (celular/telefone/telComercial) OU e-mail — mesma regra
--           do app (drwCarteira casa por nome OU telefone).
--
-- LEADS QUE ENTRAM: etapa fora de Descartado/Dormente/Fechamento e status fora de
--   Convite Nao Aceito / Sem Interesse / Sem Perfil / Fora de Regiao / Sumiu / Convertido / Onboarding.
--   ⚠ A maioria (Conexão · Convite Enviado) não tem telefone nem e-mail: extra.tem_contato diz quem dá pra ligar.
--
-- COMO CONFERIR (logado no app, ou no SQL editor — lá roda como postgres, sem JWT: os leads dão 0 porque o dono
-- deles sai de lp_donos_visiveis(); a carteira aparece de todos os donos):
--   select fonte, etapa_id, split_part(dono,'@',1) as dono, count(*) as cards,
--          count(*) filter (where (extra->>'tem_contato')::boolean) as com_contato
--     from public.vw_funil_cards group by 1,2,3 order by 1,3;
--   Pra ver COMO UM USUÁRIO vê (RLS de verdade), no SQL editor, numa transação que não grava nada:
--     begin;
--     select set_config('request.jwt.claims', json_build_object('email',(select email from public.lp_perfis where papel='admin' limit 1),'role','authenticated')::text, true);
--     set local role authenticated;
--     select fonte, split_part(dono,'@',1), count(*) from public.vw_funil_cards group by 1,2;
--     rollback;
--   Esperado em 26/10/2026 (simulado antes de criar): Gustavo → linkedin 1.038 (114 com telefone/e-mail) + carteira 3 dele
--   + 26 do Daniel (delegação) · Victor → igual ao Gustavo · Daniel → 0 linkedin + 26 carteira.
--
-- ROLLBACK:
--   drop view if exists public.vw_funil_cards;

create or replace view public.vw_funil_cards with (security_invoker = true) as
with
-- quem é o dono dos leads da Captação, visto por QUEM CONSULTA: admin da Captação + dono no LP + visível pra ele
dono_leads as (
  select d.dono
    from (select public.lp_donos_visiveis() as dono) d
   where exists (select 1 from public.app_users u where lower(u.email) = lower(d.dono) and u.papel = 'admin')
     and exists (select 1 from public.lp_contatos c where c.dono = d.dono)
   order by (d.dono = (auth.jwt()->>'email')) desc, d.dono
   limit 1
),
-- todas as chaves de casamento das fichas do LP (qualquer funil, Estoque e fundidos inclusos)
ck as materialized (
  select c.dono, 'l:' || (c.dados->>'lead_id') as k
    from public.lp_contatos c where coalesce(c.dados->>'lead_id','') <> ''
  union
  select c.dono, 't:' || public.emb_tel_chave(c.dados->>'telefone')
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
  select c.dono, 'i:' || lower(substring(c.dados->>'linkedin' from 'linkedin\.com/in/([^/?#]+)'))
    from public.lp_contatos c where c.dados->>'linkedin' ~* 'linkedin\.com/in/[^/?#]+'
  union
  select c.dono, 'n:' || public.emb_nome_norm(c.dados->>'nome')
    from public.lp_contatos c where public.emb_nome_norm(c.dados->>'nome') is not null
),

-- ── 1) leads do LinkedIn (Captação) ──
lead_vivo as (
  select l.*, dl.dono as dono_lp,
         public.emb_tel_chave(coalesce(nullif(l.telefone_e164,''), l.telefone)) as tel_k,
         nullif(lower(btrim(l.email)),'') as email_k,
         lower(substring(coalesce(l.linkedin_url_norm, l.linkedin_url) from 'linkedin\.com/in/([^/?#]+)')) as li_k,
         public.emb_nome_norm(l.nome) as nome_k
    from public.leads l
    cross join dono_leads dl
   where coalesce(l.etapa,'') not in ('Descartado','Dormente','Fechamento')
     and coalesce(l.status,'') not in ('Convite Nao Aceito','Sem Interesse','Sem Perfil','Fora de Regiao','Sumiu','Convertido','Onboarding')
),
lead_bate as (   -- leads que JÁ têm ficha (chave forte)
  select distinct lv.id
    from lead_vivo lv
    cross join lateral unnest(array['l:' || lv.id::text, 't:' || lv.tel_k, 'e:' || lv.email_k, 'i:' || lv.li_k]) as lk(k)
    join ck on ck.dono = lv.dono_lp and ck.k = lk.k
),
fant_lead as (
  select 'linkedin'::text                                   as fonte,
         lv.id::text                                        as ref_id,
         lv.dono_lp                                         as dono,
         lv.nome                                            as nome,
         coalesce(nullif(lv.telefone_e164,''), nullif(lv.telefone,'')) as telefone,
         nullif(btrim(lv.email),'')                         as email,
         nullif(lv.cidade,'')                               as cidade,
         nullif(lv.cargo,'')                                as profissao,
         'vi'::text                                         as funil_id,
         'novo'::text                                       as etapa_id,
         'lead'::text                                       as origem_tipo,
         jsonb_strip_nulls(jsonb_build_object(
           'codigo',            lv.codigo,
           'linkedin_url',      coalesce(lv.linkedin_url, lv.linkedin_url_norm),
           'instagram',         nullif(lv.instagram_handle,''),
           'empresa',           nullif(lv.empresa,''),
           'segmento',          nullif(lv.segmento,''),
           'estado',            nullif(lv.estado,''),
           'etapa_captacao',    lv.etapa,
           'status_captacao',   nullif(lv.status,''),
           'responsavel',       lv.responsavel,
           'origem_captacao',   lv.origem::text,
           'recomendante',      nullif(lv.recomendante,''),
           'score',             nullif(btrim(lv.score),''),
           'renda_estimada',    lv.renda_estimada,
           'data_status_atual', lv.data_status_atual,
           'data_proxima_acao', lv.data_proxima_acao,
           'tem_contato',       (lv.tel_k is not null or lv.email_k is not null),
           'possivel_dup_nome', exists (select 1 from ck where ck.dono = lv.dono_lp and ck.k = 'n:' || lv.nome_k)
         ))                                                 as extra,
         lv.criado_em                                       as criado_em
    from lead_vivo lv
   where lv.id not in (select id from lead_bate)
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
select * from fant_lead
union all
select * from fant_cli;

comment on view public.vw_funil_cards is
  'FUNIL ÚNICO T3b: cards fantasma (só leitura) do quadro Vida Individual — leads da Captação sem ficha (novo) e clientes da carteira sem ficha (emitida). security_invoker: RLS de quem consulta.';

revoke all on public.vw_funil_cards from anon, authenticated, public;
grant select on public.vw_funil_cards to authenticated;
