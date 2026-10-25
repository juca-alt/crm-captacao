-- FUNIL ÚNICO · T1 (24/10/2026, revisado no mesmo dia: 2 FUNIS) — mapa de etapas legadas → funil novo + settings de ANCE/Alta Renda.
-- Decisão dele (24/10): DOIS funis, não um — "1 - vida individual · 2 - mfo (vg + demais seguros)".
--   vi  = Vida Individual (Funil LP nn, Estoque bn, Base de Clientes bc, prospects, captação LinkedIn)
--   mfo = MFO (pipes vg, prud, mfo e os Negócios na Base deles: vg-bc, prud-bc, mfo-bc)
-- FONTE ÚNICA do mapeamento: a tabela kb_etapa_mapa. Nada de `if` espalhado — o app (mapearEtapa) e a migração
-- de dados (T2, fn_mapear_etapa) leem daqui. O vendas.html traz uma cópia de fábrica (ETAPA_MAPA_FAB) só pra
-- funcionar deslogado; o portão (scripts/teste_funil_mapa.py) acusa se as duas cópias divergirem.
-- Regra da busca: compara sem caixa e sem espaço nas pontas; a linha do funil de origem ganha da '*';
-- '*' (vocabulário da Vida Individual) só vale pra origem que cai na Vida Individual; sem linha → 1ª etapa
-- do funil de destino + precisa_revisao (nunca inventar).
-- ADITIVA: não altera nenhum registro de lp_contatos/leads (isso é o T2).
-- Idempotente: rodar 2× dá o mesmo schema e o mesmo seed; roda também por cima da 1ª versão (1 funil).
-- Rollback: drop function public.fn_mapear_etapa(text,text); drop table public.kb_etapa_mapa;
--           delete from public.app_settings where chave='funil_ance_cfg';

-- 1) o mapa
create table if not exists public.kb_etapa_mapa (
  funil_origem    text not null,                -- 'leads', 'bc', 'vg'… ou '*' = vocabulário da Vida Individual (nn, bn, bc, prospects)
  etapa_origem    text not null,                -- como está gravado; a busca compara lower(btrim())
  funil_novo      text not null default 'vi',   -- 'vi' | 'mfo'
  etapa_nova      text not null,
  status_card     text,                          -- estado do card que nasce junto (ta_na_lista, sitplan, em_contato, conexao, dormente)
  precisa_revisao boolean not null default false,-- true = o Gustavo decide pra onde vai (o T2 lista)
  obs             text,
  primary key (funil_origem, etapa_origem)
);
alter table public.kb_etapa_mapa add column if not exists funil_novo text not null default 'vi';
alter table public.kb_etapa_mapa drop constraint if exists kb_etapa_mapa_etapa_nova_check;   -- 1ª versão (1 funil)
alter table public.kb_etapa_mapa drop constraint if exists kb_etapa_mapa_destino_ck;
alter table public.kb_etapa_mapa add constraint kb_etapa_mapa_destino_ck check (
  (funil_novo = 'vi'  and etapa_nova in ('novo','oi','revisita','pc','c2','n','fa','emitida','entrega','nao','prop_cancelada','apol_cancelada')) or
  (funil_novo = 'mfo' and etapa_nova in ('m_oportunidade','m_contato','m_revisita','m_analise','m_proposta','m_fechamento','m_ativo','m_perdido')));
create unique index if not exists kb_etapa_mapa_norm_uk on public.kb_etapa_mapa (funil_origem, lower(btrim(etapa_origem)));
alter table public.kb_etapa_mapa enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='kb_etapa_mapa' and policyname='kb_etapa_mapa_read') then
    create policy kb_etapa_mapa_read on public.kb_etapa_mapa for select to authenticated using (public.crm_autorizado());
  end if;
  if not exists (select 1 from pg_policies where tablename='kb_etapa_mapa' and policyname='kb_etapa_mapa_write') then
    create policy kb_etapa_mapa_write on public.kb_etapa_mapa for all to authenticated using (public.lp_sou_admin()) with check (public.lp_sou_admin());
  end if;
end $$;
revoke all on public.kb_etapa_mapa from anon;
grant select on public.kb_etapa_mapa to authenticated;

-- 2) o vocabulário dos pipes saiu da '*' (1ª versão) e virou linha explícita por funil de origem → MFO
delete from public.kb_etapa_mapa where funil_origem = '*'
   and etapa_origem in ('Oportunidade','Em contato','Análise','Proposta','Fechamento','Ganho','Perdido','Contato/Revisita','Revisita agendada');

-- 3) seed (MANTER IGUAL ao ETAPA_MAPA_FAB do vendas.html — o portão confere)
insert into public.kb_etapa_mapa (funil_origem, etapa_origem, funil_novo, etapa_nova, status_card, precisa_revisao, obs) values
 ('*','SitPlan','vi','novo','sitplan',false,'TA/SitPlan não é coluna: é estado do card'),
 ('*','TA','vi','novo','ta_na_lista',false,'TA não é coluna: é estado do card'),
 ('*','OI/FF','vi','oi',null,false,null),
 ('*','P/C','vi','pc',null,false,null),
 ('*','C2','vi','c2',null,false,null),
 ('*','N','vi','n',null,false,null),
 ('*','FA','vi','fa',null,false,null),
 ('*','EMISSÃO','vi','n',null,false,'decisão dele 24/10 (2B): N = proposta assinada aguardando UW'),
 ('*','DELIVERY','vi','entrega',null,false,'também cobre o Delivery da Base (busca sem caixa)'),
 ('*','Não','vi','nao',null,false,null),
 ('*','Prop. Cancelada','vi','prop_cancelada',null,false,null),
 ('*','Apól. Cancelada','vi','apol_cancelada',null,false,null),
 ('*','Clientes Ativos','vi','emitida',null,false,'todo cliente ativo mora em Apólice Emitida'),
 ('*','Contato Agenda/Revisita','vi','revisita',null,false,'rótulo atual dele: TA/RC'),
 ('*','Agendada Revisita','vi','revisita',null,false,'rótulo atual dele: RC/FF'),
 ('*','Novo Negócio/Resolução pós Revisita','vi','pc',null,false,'rótulo atual dele: RC/PC'),
 ('*','N/Emissão','vi','n',null,false,'rótulo atual dele: (N) PROPOSTA FECHADA'),
 ('*','Emissão Final','vi','n',null,false,'rótulo atual dele: UW & Emissão · decisão dele 24/10 (2B)'),
 ('*','Venda ganha','vi','emitida',null,false,'rótulo atual dele: APOLICE EMITIDA'),
 ('*','Venda perdida','vi','nao',null,false,'rótulo atual dele: OPORTUNIDADE perdida'),
 ('*','Pendência/Atraso','vi','emitida',null,false,'etapa extinta em 04/09 (virou status de cliente ativo)'),
 ('*','Descartado','vi','nao',null,false,null),
 ('bc','cst_1','vi','novo',null,true,'etapa criada à mão que sumiu da cfg (bug FUNIL-BC-EDITAVEL-V1, 19/10) — sem rótulo conhecido'),
 ('leads','Conexao','vi','novo','conexao',false,null),
 ('leads','Dormente','vi','novo','dormente',false,null),
 ('leads','TA','vi','novo','ta_na_lista',false,null),
 ('leads','SitPlan','vi','novo','sitplan',false,null),
 ('leads','Qualificacao','vi','oi',null,false,null),
 ('leads','OT','vi','oi',null,false,null),
 ('leads','FIP','vi','pc',null,false,null),
 ('leads','Fechamento','vi','n',null,false,null),
 ('leads','Descartado','vi','nao',null,false,null),
 ('vg','Oportunidade','mfo','m_oportunidade',null,false,'pipe vg → funil MFO'),
 ('vg','Em contato','mfo','m_contato','em_contato',false,null),
 ('vg','Proposta','mfo','m_proposta',null,false,null),
 ('vg','Fechamento','mfo','m_fechamento',null,false,null),
 ('vg','Ganho','mfo','m_ativo',null,false,null),
 ('vg','Perdido','mfo','m_perdido',null,false,null),
 ('prud','Oportunidade','mfo','m_oportunidade',null,false,'pipe prud → funil MFO'),
 ('prud','Em contato','mfo','m_contato','em_contato',false,null),
 ('prud','Proposta','mfo','m_proposta',null,false,null),
 ('prud','Fechamento','mfo','m_fechamento',null,false,null),
 ('prud','Ganho','mfo','m_ativo',null,false,null),
 ('prud','Perdido','mfo','m_perdido',null,false,null),
 ('mfo','Oportunidade','mfo','m_oportunidade',null,false,'pipe mfo → funil MFO'),
 ('mfo','Em contato','mfo','m_contato','em_contato',false,null),
 ('mfo','Análise','mfo','m_analise',null,false,null),
 ('mfo','Proposta','mfo','m_proposta',null,false,null),
 ('mfo','Fechamento','mfo','m_fechamento',null,false,null),
 ('mfo','Ganho','mfo','m_ativo',null,false,null),
 ('mfo','Perdido','mfo','m_perdido',null,false,null),
 ('vg-bc','Clientes Ativos','mfo','m_ativo',null,false,'pipe vg-bc → funil MFO'),
 ('vg-bc','Contato/Revisita','mfo','m_revisita',null,false,null),
 ('vg-bc','Revisita agendada','mfo','m_revisita',null,false,null),
 ('vg-bc','Proposta','mfo','m_proposta',null,false,null),
 ('vg-bc','Fechamento','mfo','m_fechamento',null,false,null),
 ('vg-bc','Ganho','mfo','m_ativo',null,false,null),
 ('vg-bc','Perdido','mfo','m_perdido',null,false,null),
 ('prud-bc','Clientes Ativos','mfo','m_ativo',null,false,'pipe prud-bc → funil MFO'),
 ('prud-bc','Contato/Revisita','mfo','m_revisita',null,false,null),
 ('prud-bc','Revisita agendada','mfo','m_revisita',null,false,null),
 ('prud-bc','Proposta','mfo','m_proposta',null,false,null),
 ('prud-bc','Fechamento','mfo','m_fechamento',null,false,null),
 ('prud-bc','Ganho','mfo','m_ativo',null,false,null),
 ('prud-bc','Perdido','mfo','m_perdido',null,false,null),
 ('mfo-bc','Clientes Ativos','mfo','m_ativo',null,false,'pipe mfo-bc → funil MFO'),
 ('mfo-bc','Contato/Revisita','mfo','m_revisita',null,false,null),
 ('mfo-bc','Revisita agendada','mfo','m_revisita',null,false,null),
 ('mfo-bc','Proposta','mfo','m_proposta',null,false,null),
 ('mfo-bc','Fechamento','mfo','m_fechamento',null,false,null),
 ('mfo-bc','Ganho','mfo','m_ativo',null,false,null),
 ('mfo-bc','Perdido','mfo','m_perdido',null,false,null)
on conflict (funil_origem, etapa_origem) do update
  set funil_novo=excluded.funil_novo, etapa_nova=excluded.etapa_nova, status_card=excluded.status_card, precisa_revisao=excluded.precisa_revisao, obs=excluded.obs;

-- 4) a função (mesma regra do mapearEtapa do app)
drop function if exists public.fn_mapear_etapa(text,text);
create function public.fn_mapear_etapa(p_funil text, p_etapa text)
returns table(funil_id text, etapa_id text, status_card text, precisa_revisao boolean)
language sql stable set search_path = public as $$
  with k as (select lower(btrim(coalesce(p_funil,''))) as f, lower(btrim(coalesce(p_etapa,''))) as e),
  dest as (select coalesce((select m.funil_novo from public.kb_etapa_mapa m, k where lower(m.funil_origem) = k.f limit 1), 'vi') as fn),
  hit as (
    select m.funil_novo, m.etapa_nova, m.status_card, m.precisa_revisao
    from public.kb_etapa_mapa m, k, dest
    where k.e <> '' and lower(btrim(m.etapa_origem)) = k.e
      and (lower(m.funil_origem) = k.f or (m.funil_origem = '*' and dest.fn = 'vi'))
    order by (m.funil_origem = '*')   -- false (linha do funil) primeiro
    limit 1)
  select funil_novo, etapa_nova, status_card, precisa_revisao from hit
  union all
  select d.fn, case d.fn when 'mfo' then 'm_oportunidade' else 'novo' end, null::text, true
    from dest d where not exists (select 1 from hit);
$$;
revoke all on function public.fn_mapear_etapa(text,text) from anon, public;
grant execute on function public.fn_mapear_etapa(text,text) to authenticated;

-- 5) ANCE automático (só Vida Individual) + Alta Renda (setting; default = o desenho do CRM, 20 mil / 1 mi). Não sobrescreve o que ele editar.
insert into public.app_settings (chave, valor, atualizado_em) values ('funil_ance_cfg', '{
  "versao": 1,
  "max": 5,
  "regras": [
    {"campo":"renda","op":">","valor":10000,"rotulo":"Renda acima de R$ 10 mil"},
    {"campo":"idade","op":"entre","valor":[24,60],"rotulo":"Idade entre 24 e 60"},
    {"campo":"casado","op":"=","valor":true,"rotulo":"Casado"},
    {"campo":"filhos","op":"=","valor":true,"rotulo":"Tem filhos"},
    {"campo":"avisado","op":"=","valor":true,"rotulo":"Avisado pelo recomendante"},
    {"campo":"recomendante_cliente","op":"=","valor":true,"rotulo":"Recomendante é cliente"}
  ],
  "alta_renda": {"renda": 20000, "patrimonio": 1000000}
}'::jsonb, now())
on conflict (chave) do nothing;
