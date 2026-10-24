-- FUNIL ÚNICO · T2 (24/10/2026, revisado: 2 FUNIS) — migração dos dados: chaves normalizadas em lp_contatos.dados.
-- Dois funis (decisão dele 24/10): funil_id = 'vi' (Vida Individual) | 'mfo' (VG + demais seguros). O mapa (T1) decide.
-- Depende do T1 (kb_etapa_mapa, fn_mapear_etapa, app_settings.funil_ance_cfg).
-- NÃO APAGA NADA: só acrescenta chaves em `dados` (merge `dados || patch`); funil, etapa e o resto ficam como estão.
-- Quem entra: todo contato vivo (sem merged_into) fora do Estoque + do Estoque só quem tem etapa ou ta_dia.
-- Chaves gravadas (nomes da spec §3.2, com 2 trocas por COLISÃO com chaves que já existem):
--   funil_id ('vi'|'mfo') · etapa_id · etapa_id_fonte ('mapa' = veio do mapa; quando ele arrastar no quadro vira 'manual' e a migração não toca mais)
--   status_card (estado inicial que o mapa dá: ta_na_lista, sitplan, em_contato…) · etapa_revisao (true = ele decide)
--     ↳ etapa_revisao e NÃO precisa_revisao: precisa_revisao já existe em 5.228 nomes do Estoque com outro sentido.
--   linha (prud = Vida Individual | vg | prud_demais | mo = Multi Office) · origem_tipo — só se ainda não existirem
--   ance_auto só na Vida Individual (no MFO fica null: o ANCE é método da vida individual)
--   cliente_ativo · ance_auto · alta_renda · ultimo_contato · prox_passo — derivados, recalculados a cada rodada
--     ↳ prox_passo e NÃO proximo_passo: proximo_passo já existe como TEXTO livre antigo (a ficha do MFO mostra).
--   funil_unico_v = 1 (carimbo da migração)
-- Idempotente: só faz UPDATE onde o resultado muda; rodar 2× = 0 linhas na 2ª.
-- ROLLBACK (volta os registros tocados ao estado de antes, pela cópia):
--   update public.lp_contatos c set dados = b.dados from public._bkp_20261024_funil b
--    where b.dono = c.dono and b.id = c.id and c.dados ? 'funil_unico_v';

-- 0) backup (uma vez só: a 2ª rodada NÃO sobrescreve a foto de antes)
create table if not exists public._bkp_20261024_funil as select * from public.lp_contatos;
alter table public._bkp_20261024_funil enable row level security;
revoke all on public._bkp_20261024_funil from anon, authenticated;

-- 1) quem entra no quadro
create or replace function public.fn_funil_no_quadro(d jsonb)
returns boolean language sql immutable as $$
  select coalesce(d->>'merged_into','') = ''
     and (coalesce(d->>'funil','') <> 'bn'
          or coalesce(d->>'etapa','') <> ''
          or coalesce(d->>'ta_dia','') not in ('','null'))
$$;

-- 2) número de texto livre ("R$ 15.000,00", "35000", "38 anos") → numeric
create or replace function public.fn_funil_num(t text)
returns numeric language sql immutable as $$
  select case when x ~ '^[0-9]+(\.[0-9]+)?$' then x::numeric end
  from (select regexp_replace(replace(replace(coalesce(t,''),'.',''),',','.'),'[^0-9.]','','g') as x) a
$$;

-- 3) fatos que o ANCE automático e a Alta Renda leem (um lugar só)
create or replace function public.fn_funil_fatos(d jsonb)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'renda',      public.fn_funil_num(coalesce(nullif(d->>'renda',''), nullif(d->>'renda_estimada',''), nullif(d#>>'{infoclient,financeiro,renda}',''))),
    'patrimonio', public.fn_funil_num(coalesce(nullif(d->>'patrimonio',''), nullif(d#>>'{infoclient,financeiro,patrimonio}',''))),
    'idade',      coalesce(public.fn_funil_num(d->>'idade'),
                    case when coalesce(d->>'nascimento','') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then extract(year from age(current_date, left(d->>'nascimento',10)::date))::numeric
                         when coalesce(d->>'nascimento','') ~ '^[0-9]{2}/[0-9]{2}/[0-9]{4}' then extract(year from age(current_date, to_date(left(d->>'nascimento',10),'DD/MM/YYYY')))::numeric end),
    'casado',     coalesce(d->>'civil_cod','') ~* '^[CU]/' or coalesce(d->>'estado_civil','') ~* '^(casad|uni)',   -- C = casado, U = união estável
    'filhos',     coalesce(d->>'civil_cod','') ~* '/CF$' or lower(coalesce(d->>'filhos','')) in ('true','sim','s') or coalesce(public.fn_funil_num(d->>'filhos'),0) > 0,
    'avisado',    lower(coalesce(d#>>'{ance,avisado}', d#>>'{ance,av}', '')) = 'true',
    'recomendante_cliente', coalesce(d->>'recomendante','') <> '' and exists (
                    select 1 from public.carteira_clientes cc where public.emb_nome_norm(cc.dados->>'nome') = public.emb_nome_norm(d->>'recomendante'))
  )
$$;

-- 4) ANCE automático: interpreta as regras do setting (campo · op · valor), soma 1 por regra cumprida, teto = max
create or replace function public.fn_funil_ance_auto(fatos jsonb, cfg jsonb)
returns int language sql immutable as $$
  select least(coalesce((cfg->>'max')::int, 5), (count(*) filter (where ok))::int)
  from (
    select case r->>'op'
      when '>'     then public.fn_funil_num(fatos->>(r->>'campo')) >  (r->>'valor')::numeric
      when '>='    then public.fn_funil_num(fatos->>(r->>'campo')) >= (r->>'valor')::numeric
      when '<'     then public.fn_funil_num(fatos->>(r->>'campo')) <  (r->>'valor')::numeric
      when '<='    then public.fn_funil_num(fatos->>(r->>'campo')) <= (r->>'valor')::numeric
      when 'entre' then public.fn_funil_num(fatos->>(r->>'campo')) between (r->'valor'->>0)::numeric and (r->'valor'->>1)::numeric
      when '='     then (fatos->(r->>'campo')) = (r->'valor')
    end as ok
    from jsonb_array_elements(coalesce(cfg->'regras','[]'::jsonb)) r
  ) x
$$;

-- 5) o patch de cada contato (puro: o relatório usa pra simular antes de gravar)
create or replace function public.fn_funil_t2_patch(p_dono text, p_id text, d jsonb)
returns jsonb language plpgsql stable set search_path = public as $$
declare
  f    text := coalesce(nullif(d->>'funil',''), 'nn');
  org  text := lower(btrim(coalesce(d->>'origem','')));
  cfg  jsonb;
  fat  jsonb;
  m    record;
  p    jsonb := '{}'::jsonb;
  tels text[];
begin
  select valor into cfg from public.app_settings where chave = 'funil_ance_cfg';
  cfg := coalesce(cfg, '{}'::jsonb);

  -- etapa: só enquanto veio do mapa (arrastou no quadro = 'manual' = não toca)
  if coalesce(d->>'etapa_id','') = '' or d->>'etapa_id_fonte' = 'mapa' then
    if f = 'bn' and coalesce(d->>'etapa','') = '' then
      p := p || '{"funil_id":"vi","etapa_id":"novo","status_card":"ta_na_lista","etapa_revisao":false}'::jsonb;   -- Estoque que já foi pra lista de TA
    else
      select * into m from public.fn_mapear_etapa(f, d->>'etapa');
      p := p || jsonb_build_object('funil_id', m.funil_id, 'etapa_id', m.etapa_id, 'status_card', m.status_card, 'etapa_revisao', m.precisa_revisao);
    end if;
    p := p || '{"etapa_id_fonte":"mapa"}'::jsonb;
  end if;

  -- linha e origem: só se ainda não tem (a partir do T3 é ele quem edita)
  if coalesce(d->>'linha','') = '' then
    p := p || jsonb_build_object('linha', case when f in ('vg','vg-bc') then 'vg' when f in ('prud','prud-bc') then 'prud_demais' when f in ('mfo','mfo-bc') then 'mo' else 'prud' end);
  end if;
  if not (d ? 'origem_tipo') then
    p := p || jsonb_build_object('origem_tipo', case
      when f = 'bc' or f like '%-bc' or org = 'carteira'                                   then 'carteira'
      when f = 'bn' or org = 'base de nomes'                                              then 'estoque'
      when coalesce(d->>'lead_id','') <> ''
        or exists (select 1 from public.lp_match_leads ml where ml.contato_id = p_id)     then 'lead'
      when org like 'parceri%'                                                            then 'parceiro'
      when coalesce(d->>'recomendante','') <> '' or org ~ '^(recomenda|indica)'           then 'recomendacao'
      when org not in ('','—','-','outros','agenda')                                       then 'recomendacao'   -- origem = nome de quem indicou
      when d ? 'id_kommo' or coalesce(d->>'origemCadastro','') <> '' or d ? 'importado_de' or d ? 'importado_em' then 'importacao'
      else null end);   -- sem pista nenhuma: fica null ("sem origem" no filtro) — não inventa
  end if;

  -- cliente ativo: apólice Ativa na carteira, pelo nome OU telefone (mesma regra do app: drwCarteira)
  tels := array_remove(array[public.emb_tel_chave(d->>'telefone')]
          || coalesce((select array_agg(public.emb_tel_chave(x)) from jsonb_array_elements_text(case when jsonb_typeof(d->'telefones_alt')='array' then d->'telefones_alt' else '[]'::jsonb end) x), '{}'), null);
  p := p || jsonb_build_object('cliente_ativo', exists (
    select 1 from public.carteira_apolices a
     where a.dados->>'status' = 'Ativa'
       and (public.emb_nome_norm(a.dados->>'segurado') = public.emb_nome_norm(d->>'nome')
            or public.emb_tel_chave(a.dados->>'celular') = any(tels)
            or public.emb_tel_chave(a.dados->>'telefone') = any(tels)
            or public.emb_tel_chave(a.dados->>'telComercial') = any(tels))));

  -- ANCE automático + Alta Renda (regras do setting funil_ance_cfg)
  fat := public.fn_funil_fatos(d);
  p := p || jsonb_build_object(
    'ance_auto',  case when coalesce(p->>'funil_id', d->>'funil_id') = 'mfo' then null else public.fn_funil_ance_auto(fat, cfg) end,
    'alta_renda', coalesce(public.fn_funil_num(fat->>'renda')      >= public.fn_funil_num(cfg#>>'{alta_renda,renda}'), false)
               or coalesce(public.fn_funil_num(fat->>'patrimonio') >= public.fn_funil_num(cfg#>>'{alta_renda,patrimonio}'), false));

  -- último contato: o mais recente entre o histórico do card, as tarefas concluídas e o Painel TA (lp_interacoes)
  p := p || jsonb_build_object('ultimo_contato', (
    select jsonb_build_object('tipo', tipo, 'quando', quando, 'fonte', fonte) from (
      select case i->>'k' when 'wa' then 'whatsapp' when 'whatsapp' then 'whatsapp' when 'whats_respondeu' then 'whatsapp'
                          when 'lig_atendida' then 'ligacao_atendida' when 'lig_nao_atendida' then 'ligacao_nao_atendida'
                          when 'reuniao' then 'reuniao' when 'agendou_oi' then 'agendou_oi' end as tipo,
             coalesce(nullif(i->>'ts',''), i->>'dia') as quando, 'historico' as fonte
        from jsonb_array_elements(case when jsonb_typeof(d->'interacoes')='array' then d->'interacoes' else '[]'::jsonb end) i
       where i->>'k' in ('wa','whatsapp','whats_respondeu','lig_atendida','lig_nao_atendida','reuniao','agendou_oi')
      union all
      select case t->>'tipo' when 'reuniao' then 'reuniao' when 'ligar' then 'ligacao' when 'whats' then 'whatsapp' else 'follow' end,   -- tarefa concluída não diz se atendeu
             t->>'feito', 'tarefa'
        from jsonb_array_elements(case when jsonb_typeof(d->'tarefas')='array' then d->'tarefas' else '[]'::jsonb end) t
       where jsonb_typeof(t->'feito') = 'string' and t->>'tipo' in ('reuniao','ligar','whats','follow')
      union all
      select case li.resultado when 'nao_atendeu' then 'ligacao_nao_atendida' when 'atendeu' then 'ligacao_atendida'
                               when 'agendou' then 'agendou_oi' when 'recusou' then 'sem_interesse' when 'numero_errado' then 'telefone_incorreto'
                               else 'ligacao_atendida' end,
             to_char(li.quando at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), 'painel_ta'
        from public.lp_interacoes li where li.contato_id = p_id and li.dono = p_dono
    ) u where quando is not null and quando <> '' order by quando desc limit 1));

  -- próximo passo: a tarefa aberta mais cedo (atrasada também conta: é um passo combinado)
  p := p || jsonb_build_object('prox_passo', (
    select jsonb_build_object('tipo', t->>'tipo', 'quando', nullif(t->>'quando',''), 'hora', nullif(t->>'hora',''), 'tarefa_id', t->>'id')
      from jsonb_array_elements(case when jsonb_typeof(d->'tarefas')='array' then d->'tarefas' else '[]'::jsonb end) t
     where coalesce(jsonb_typeof(t->'feito'),'null') = 'null'
     order by nullif(t->>'quando','') asc nulls last, nullif(t->>'hora','') asc nulls last limit 1));

  return p || '{"funil_unico_v":1}'::jsonb;
end $$;

revoke all on function public.fn_funil_no_quadro(jsonb), public.fn_funil_num(text), public.fn_funil_fatos(jsonb),
                       public.fn_funil_ance_auto(jsonb,jsonb), public.fn_funil_t2_patch(text,text,jsonb) from anon, public;

-- 6) aplica (só onde muda)
with alvo as (
  select c.dono, c.id, c.dados || public.fn_funil_t2_patch(c.dono, c.id, c.dados) as novo
    from public.lp_contatos c where public.fn_funil_no_quadro(c.dados))
update public.lp_contatos c set dados = a.novo
  from alvo a where a.dono = c.dono and a.id = c.id and a.novo is distinct from c.dados;
