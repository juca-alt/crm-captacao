-- MFO-ANALISE-V1 (13/10/2026): etapa "Análise" no funil mfo, entre "Em contato" e "Proposta".
-- Idempotente: só insere se ainda não houver item id='Análise' no array mfo. Não toca nos outros funis.
create table if not exists _bkp_20261013_funcfg as select * from app_settings where chave='lp_funil_cfg';
alter table _bkp_20261013_funcfg enable row level security;
update app_settings set valor = jsonb_set(valor,'{mfo}',
  (select jsonb_agg(e order by o) from (
     select e, i*10 o from jsonb_array_elements(valor->'mfo') with ordinality t(e,i)
     union all
     select '{"id":"Análise","label":"Análise","cor":"azul","prob":45,"enc":false}'::jsonb,
            (select i*10+5 from jsonb_array_elements(valor->'mfo') with ordinality t(e,i) where e->>'id'='Em contato')
  ) x)), atualizado_em=now()
where chave='lp_funil_cfg'
  and not exists (select 1 from jsonb_array_elements(valor->'mfo') e where e->>'id'='Análise');
