-- FUNIL ÚNICO · T1 (24/10/2026) — mapa de etapas legadas → funil único + settings de ANCE/Alta Renda.
-- FONTE ÚNICA do mapeamento: a tabela kb_etapa_mapa. Nada de `if` espalhado — o app (mapearEtapa) e a migração
-- de dados (T2, fn_mapear_etapa) leem daqui. O vendas.html traz uma cópia de fábrica (ETAPA_MAPA_FAB) só pra
-- funcionar deslogado; o portão (scripts/teste_funil_mapa.py) acusa se as duas cópias divergirem.
-- ADITIVA: não altera nenhum registro existente (lp_contatos/leads intactos; isso é o T2).
-- Idempotente: rodar 2× dá o mesmo schema; o seed atualiza as linhas de fábrica e não duplica.
-- Rollback: drop function public.fn_mapear_etapa(text,text); drop table public.kb_etapa_mapa;
--           delete from public.app_settings where chave='funil_ance_cfg';

-- 1) o mapa
create table if not exists public.kb_etapa_mapa (
  funil_origem    text not null,                -- 'leads', 'bc', … ou '*' = qualquer funil do CRM (nn, bn, bc, vg, prud, mfo, *-bc, prospects)
  etapa_origem    text not null,                -- como está gravado; a busca compara lower(btrim())
  etapa_nova      text not null check (etapa_nova in ('novo','oi','revisita','pc','n','c2','fa','emitida','entrega','nao','prop_cancelada','apol_cancelada')),
  status_card     text,                          -- estado do card que nasce junto (ta_na_lista, sitplan, conexao, dormente, em_contato)
  precisa_revisao boolean not null default false,-- true = o Gustavo decide pra onde vai (o T2 lista)
  obs             text,
  primary key (funil_origem, etapa_origem)
);
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

-- 2) seed (MANTER IGUAL ao ETAPA_MAPA_FAB do vendas.html — o portão confere)
insert into public.kb_etapa_mapa (funil_origem, etapa_origem, etapa_nova, status_card, precisa_revisao, obs) values
 -- Funil LP (nn) e Estoque (bn): mesmo vocabulário
 ('*','SitPlan','novo','sitplan',false,'TA/SitPlan não é coluna: é estado do card'),
 ('*','TA','novo','ta_na_lista',false,'TA não é coluna: é estado do card'),
 ('*','OI/FF','oi',null,false,null),
 ('*','P/C','pc',null,false,null),
 ('*','C2','c2',null,false,null),
 ('*','N','n',null,false,null),
 ('*','FA','fa',null,false,null),
 ('*','EMISSÃO','fa',null,false,'spec 3.1: FA recebe EMISSÃO (confirmar na revisão do T1)'),
 ('*','DELIVERY','entrega',null,false,'também cobre o Delivery da Base (busca sem caixa)'),
 ('*','Não','nao',null,false,null),
 ('*','Prop. Cancelada','prop_cancelada',null,false,null),
 ('*','Apól. Cancelada','apol_cancelada',null,false,null),
 -- Base de Clientes (bc)
 ('*','Clientes Ativos','emitida',null,false,'todo cliente ativo mora em Apólice Emitida (também os *-bc)'),
 ('*','Contato Agenda/Revisita','revisita',null,false,'rótulo atual dele: TA/RC'),
 ('*','Agendada Revisita','revisita',null,false,'rótulo atual dele: RC/FF'),
 ('*','Novo Negócio/Resolução pós Revisita','pc',null,false,'rótulo atual dele: RC/PC'),
 ('*','N/Emissão','n',null,false,'rótulo atual dele: (N) PROPOSTA FECHADA'),
 ('*','Emissão Final','fa',null,false,'rótulo atual dele: UW & Emissão · spec 3.1'),
 ('*','Venda ganha','emitida',null,false,'rótulo atual dele: APOLICE EMITIDA'),
 ('*','Venda perdida','nao',null,false,'rótulo atual dele: OPORTUNIDADE perdida'),
 ('*','Pendência/Atraso','emitida',null,false,'etapa extinta em 04/09 (virou status de cliente ativo)'),
 ('bc','cst_1','novo',null,true,'etapa criada à mão que sumiu da cfg (bug FUNIL-BC-EDITAVEL-V1, 19/10) — sem rótulo conhecido'),
 -- Pipes VG / Prud. Demais / MFO e os Negócios na Base deles (*-bc)
 ('*','Oportunidade','novo',null,false,'DESVIO da spec (dizia emitida): nos pipes é a 1ª etapa, 10% — confirmar na revisão do T1'),
 ('*','Em contato','novo','em_contato',false,null),
 ('*','Análise','n',null,false,'spec 3.1'),
 ('*','Proposta','n',null,false,'spec 3.1'),
 ('*','Fechamento','fa',null,false,'spec 3.1 (o Fechamento da captação LinkedIn vai pra N — linha própria)'),
 ('*','Ganho','emitida',null,false,'fora da spec; equivalente a Venda ganha'),
 ('*','Perdido','nao',null,false,'fora da spec; equivalente a Venda perdida'),
 ('*','Contato/Revisita','revisita',null,false,'equivalente a Contato Agenda/Revisita'),
 ('*','Revisita agendada','revisita',null,false,'equivalente a Agendada Revisita'),
 ('*','Descartado','nao',null,false,null),
 -- Captação LinkedIn (tabela leads) — vocabulário próprio, ganha da linha '*'
 ('leads','Conexao','novo','conexao',false,null),
 ('leads','Dormente','novo','dormente',false,null),
 ('leads','TA','novo','ta_na_lista',false,null),
 ('leads','SitPlan','novo','sitplan',false,null),
 ('leads','Qualificacao','oi',null,false,null),
 ('leads','OT','oi',null,false,null),
 ('leads','FIP','pc',null,false,null),
 ('leads','Fechamento','n',null,false,null),
 ('leads','Descartado','nao',null,false,null)
on conflict (funil_origem, etapa_origem) do update
  set etapa_nova=excluded.etapa_nova, status_card=excluded.status_card, precisa_revisao=excluded.precisa_revisao, obs=excluded.obs;

-- 3) a função (mesma regra do mapearEtapa do app): linha do funil ganha da '*'; sem linha (ou etapa vazia) → novo + revisão
create or replace function public.fn_mapear_etapa(p_funil text, p_etapa text)
returns table(etapa_id text, status_card text, precisa_revisao boolean)
language sql stable set search_path = public as $$
  with k as (select lower(btrim(coalesce(p_funil,''))) as f, lower(btrim(coalesce(p_etapa,''))) as e),
  hit as (
    select m.etapa_nova, m.status_card, m.precisa_revisao
    from public.kb_etapa_mapa m, k
    where k.e <> '' and lower(btrim(m.etapa_origem)) = k.e and (lower(m.funil_origem) = k.f or m.funil_origem = '*')
    order by (m.funil_origem = '*')   -- false (linha do funil) primeiro
    limit 1)
  select etapa_nova, status_card, precisa_revisao from hit
  union all
  select 'novo', null::text, true where not exists (select 1 from hit);
$$;
revoke all on function public.fn_mapear_etapa(text,text) from anon, public;
grant execute on function public.fn_mapear_etapa(text,text) to authenticated;

-- 4) ANCE automático + Alta Renda (setting; default = o desenho do CRM, 20 mil / 1 mi). Não sobrescreve o que ele editar.
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
