-- PARCEIROS-V1 (30/09/2026): módulo Parceiros (Outros módulos → 🤝 Parceiros).
-- Parceiro = LP que divide comissão FYC com o Gustavo nos clientes indicados via Pipe X.
-- Modelo genérico: o primeiro parceiro é carga de dado (feita direto no banco, fora do repo público),
-- nenhum nome ou e-mail mora aqui.
--
-- Regra (fonte única no front: parcMotor em vendas.html):
--   parte do Gustavo por apólice = round(comissão do parceiro × % do cliente × (1 − Simples), 2)
--
-- Por que tabelas próprias e não comp_linhas/comp_extratos: comp_* é o detalhe da comissão do
-- PRÓPRIO Gustavo (alimentado pelo processo do Compensation), e a apuração dele (comp_apuracao)
-- é por mes_ano, sem CPD. Linha de parceiro ali contaminaria a conferência dele.
-- O formato das colunas de linha é o mesmo da comp_linhas.
--
-- Idempotente: rodar 2× deixa o mesmo estado. RLS ligada em todas as tabelas novas.
-- Quem lê: admin + delegado de BackOffice do parceiro (Victor). Quem grava acordo/fechamento/
-- pagamento: só admin. Extrato entra só pela função parceria_importar_extrato (admin ou delegado).

create table if not exists public.parceiros (
  id           bigserial primary key,
  nome         text not null,
  email        text not null unique,          -- login do parceiro = dono da carteira dele
  cpd          text unique,
  pct_padrao   numeric(5,2) not null default 50,
  simples_pct  numeric(5,2) not null default 6,
  ativo        boolean not null default true,
  criado_em    timestamptz not null default now()
);

-- % por apólice com vigência por competência ('AAAA-MM'). Trocar o % fecha a linha (ate) e abre outra.
create table if not exists public.parceria_acordos (
  id             bigserial primary key,
  parceiro_id    bigint not null references public.parceiros(id) on delete cascade,
  apolice        text not null,               -- só dígitos, sem zeros à esquerda
  segurado       text,
  cliente_ref    text,                        -- carteira_clientes.ref do parceiro (null = sem vínculo)
  pct            numeric(5,2) not null check (pct >= 0 and pct <= 100),
  desde          text not null check (desde ~ '^\d{4}-\d{2}$'),
  ate            text check (ate is null or ate ~ '^\d{4}-\d{2}$'),
  atualizado_em  timestamptz not null default now(),
  atualizado_por text,
  unique (parceiro_id, apolice, desde)
);
create index if not exists parceria_acordos_parc on public.parceria_acordos (parceiro_id, apolice);

-- Cabeçalho de cada Extrato Detalhado de Comissão Direta importado (1 por competência).
create table if not exists public.parceria_extratos (
  id            bigserial primary key,
  parceiro_id   bigint not null references public.parceiros(id) on delete cascade,
  competencia   text not null check (competencia ~ '^\d{4}-\d{2}$'),
  mes_ano       text,                          -- como vem no portal: 'Set/26'
  periodo_ini   date,
  periodo_fim   date,
  linhas        integer not null,
  total         numeric(12,2) not null,
  arquivo       text,
  importado_em  timestamptz not null default now(),
  importado_por text,
  unique (parceiro_id, competencia)
);

-- Linhas do extrato (mesmo formato da comp_linhas). Identidade = competência + apólice + cobertura
-- + parcela + data de geração; seq só separa linhas idênticas DENTRO do mesmo arquivo.
create table if not exists public.parceria_linhas (
  id              bigserial primary key,
  extrato_id      bigint not null references public.parceria_extratos(id) on delete cascade,
  parceiro_id     bigint not null references public.parceiros(id) on delete cascade,
  competencia     text not null,
  apolice         text not null,
  cobertura       integer,
  segurado        text,
  tipo            text,
  dt_geracao      date,
  parcela         integer,                      -- "Mês Pago Até"
  premio_liquido  numeric(12,2),
  pct_comissao    numeric(7,3),
  pct_divisao     numeric(7,3),
  comissao        numeric(12,2) not null,
  dt_emissao      date,
  periodicidade   text,
  seq             integer not null default 0
);
create unique index if not exists parceria_linhas_ident
  on public.parceria_linhas (parceiro_id, competencia, apolice, coalesce(cobertura,-1), coalesce(parcela,-1), coalesce(dt_geracao,'1900-01-01'::date), seq);
create index if not exists parceria_linhas_comp on public.parceria_linhas (parceiro_id, competencia);

-- Fechamento = fotografia da competência (o número não muda depois de fechado).
create table if not exists public.parceria_fechamentos (
  parceiro_id      bigint not null references public.parceiros(id) on delete cascade,
  competencia      text not null check (competencia ~ '^\d{4}-\d{2}$'),
  comissao_acordo  numeric(12,2) not null,
  bruto            numeric(12,2) not null,
  simples          numeric(12,2) not null,
  valor            numeric(12,2) not null,      -- parte do Gustavo
  linhas           jsonb not null default '[]'::jsonb,
  fechado_em       timestamptz not null default now(),
  fechado_por      text,
  primary key (parceiro_id, competencia)
);

create table if not exists public.parceria_pagamentos (
  id           bigserial primary key,
  parceiro_id  bigint not null references public.parceiros(id) on delete cascade,
  competencia  text not null check (competencia ~ '^\d{4}-\d{2}$'),
  valor        numeric(12,2) not null,
  pago_em      date,
  meio         text,
  obs          text,
  criado_em    timestamptz not null default now(),
  criado_por   text
);
create index if not exists parceria_pagamentos_comp on public.parceria_pagamentos (parceiro_id, competencia);

-- Quem enxerga o parceiro: admin, o PRÓPRIO parceiro (liberado em 02/10 — vê a parceria dele, só leitura)
-- ou quem recebeu delegação de BackOffice do parceiro (Victor).
create or replace function public.parc_pode_ler(p_parceiro bigint) returns boolean
language sql stable security definer set search_path = public as $$
  select public.lp_sou_admin() or exists (
    select 1 from public.parceiros p where p.id = p_parceiro
       and lower(p.email) = lower(coalesce(auth.jwt()->>'email',''))) or exists (
    select 1 from public.parceiros p
      join public.lp_delegacoes d on lower(d.dono_email) = lower(p.email)
     where p.id = p_parceiro
       and lower(d.delegado_email) = lower(coalesce(auth.jwt()->>'email',''))
       and coalesce((d.modulos->>'backoffice')::boolean, false))
$$;
revoke all on function public.parc_pode_ler(bigint) from public, anon;
grant execute on function public.parc_pode_ler(bigint) to authenticated;

do $$ declare t text; begin
  foreach t in array array['parceiros','parceria_acordos','parceria_extratos','parceria_linhas','parceria_fechamentos','parceria_pagamentos'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon', t);
    execute format('drop policy if exists %I on public.%I', t||'_ler', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all to authenticated using (public.lp_sou_admin()) with check (public.lp_sou_admin())', t||'_admin', t);
  end loop;
end $$;
create policy parceiros_ler            on public.parceiros            for select to authenticated using (public.parc_pode_ler(id));
create policy parceria_acordos_ler     on public.parceria_acordos     for select to authenticated using (public.parc_pode_ler(parceiro_id));
create policy parceria_extratos_ler    on public.parceria_extratos    for select to authenticated using (public.parc_pode_ler(parceiro_id));
create policy parceria_linhas_ler      on public.parceria_linhas      for select to authenticated using (public.parc_pode_ler(parceiro_id));
create policy parceria_fechamentos_ler on public.parceria_fechamentos for select to authenticated using (public.parc_pode_ler(parceiro_id));
create policy parceria_pagamentos_ler  on public.parceria_pagamentos  for select to authenticated using (public.parc_pode_ler(parceiro_id));
grant select, insert, update, delete on public.parceiros, public.parceria_acordos, public.parceria_extratos,
  public.parceria_linhas, public.parceria_fechamentos, public.parceria_pagamentos to authenticated;
grant usage, select on sequence public.parceiros_id_seq, public.parceria_acordos_id_seq, public.parceria_extratos_id_seq,
  public.parceria_linhas_id_seq, public.parceria_pagamentos_id_seq to authenticated;

-- Importação do extrato (Victor ou admin). Validação bloqueante: o que ficou gravado tem que bater
-- em quantidade de linhas E no total com o que o arquivo trouxe — senão nada é gravado.
-- Competência fechada: mesmo arquivo de novo = "já importado" (nada muda); arquivo diferente = bloqueia.
create or replace function public.parceria_importar_extrato(
  p_cpd text, p_competencia text, p_mes_ano text, p_ini date, p_fim date,
  p_arquivo text, p_total numeric, p_linhas jsonb
) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_parc bigint; v_ext bigint; v_n int; v_soma numeric; v_ant record; v_quem text;
begin
  v_quem := lower(coalesce(auth.jwt()->>'email',''));
  select id into v_parc from public.parceiros where cpd = p_cpd and ativo;
  if v_parc is null then raise exception 'CPD % não é de nenhum parceiro cadastrado', p_cpd; end if;
  if not public.parc_pode_ler(v_parc) then raise exception 'sem permissão pra importar extrato deste parceiro'; end if;
  if p_competencia !~ '^\d{4}-\d{2}$' then raise exception 'competência inválida: %', p_competencia; end if;
  if jsonb_typeof(p_linhas) <> 'array' or jsonb_array_length(p_linhas) = 0 then raise exception 'extrato sem linhas'; end if;

  select linhas, total into v_ant from public.parceria_extratos where parceiro_id = v_parc and competencia = p_competencia;
  if exists (select 1 from public.parceria_fechamentos where parceiro_id = v_parc and competencia = p_competencia) then
    if v_ant is not null and v_ant.linhas = jsonb_array_length(p_linhas) and v_ant.total = round(p_total,2) then
      return jsonb_build_object('status','ja_importado','linhas',v_ant.linhas,'total',v_ant.total);
    end if;
    raise exception 'competência % já está FECHADA — o extrato não pode mudar', p_competencia;
  end if;

  insert into public.parceria_extratos (parceiro_id, competencia, mes_ano, periodo_ini, periodo_fim, linhas, total, arquivo, importado_por)
       values (v_parc, p_competencia, p_mes_ano, p_ini, p_fim, jsonb_array_length(p_linhas), round(p_total,2), p_arquivo, v_quem)
  on conflict (parceiro_id, competencia) do update
       set mes_ano = excluded.mes_ano, periodo_ini = excluded.periodo_ini, periodo_fim = excluded.periodo_fim,
           linhas = excluded.linhas, total = excluded.total, arquivo = excluded.arquivo,
           importado_em = now(), importado_por = excluded.importado_por
  returning id into v_ext;

  -- reimportar a mesma competência (aberta) substitui as linhas: o arquivo novo é a verdade
  delete from public.parceria_linhas where parceiro_id = v_parc and competencia = p_competencia;
  insert into public.parceria_linhas (extrato_id, parceiro_id, competencia, apolice, cobertura, segurado, tipo, dt_geracao,
         parcela, premio_liquido, pct_comissao, pct_divisao, comissao, dt_emissao, periodicidade, seq)
  select v_ext, v_parc, p_competencia, ltrim(l->>'apolice','0'), nullif(l->>'cobertura','')::int, l->>'segurado', l->>'tipo',
         nullif(l->>'dt_geracao','')::date, nullif(l->>'parcela','')::int, nullif(l->>'premio_liquido','')::numeric,
         nullif(l->>'pct_comissao','')::numeric, nullif(l->>'pct_divisao','')::numeric, (l->>'comissao')::numeric,
         nullif(l->>'dt_emissao','')::date, l->>'periodicidade', coalesce(nullif(l->>'seq','')::int, 0)
    from jsonb_array_elements(p_linhas) l
  on conflict do nothing;

  select count(*), coalesce(sum(comissao),0) into v_n, v_soma
    from public.parceria_linhas where parceiro_id = v_parc and competencia = p_competencia;
  if v_n <> jsonb_array_length(p_linhas) or round(v_soma,2) <> round(p_total,2) then
    raise exception 'extrato não bateu: arquivo % linhas / R$ %, gravado % linhas / R$ % — nada foi gravado',
      jsonb_array_length(p_linhas), round(p_total,2), v_n, round(v_soma,2);
  end if;
  return jsonb_build_object('status', case when v_ant is null then 'novo' else 'substituido' end, 'linhas', v_n, 'total', round(v_soma,2));
end $$;
revoke all on function public.parceria_importar_extrato(text,text,text,date,date,text,numeric,jsonb) from public, anon;
grant execute on function public.parceria_importar_extrato(text,text,text,date,date,text,numeric,jsonb) to authenticated;

-- comp_* (comissão do PRÓPRIO Gustavo) estava legível/gravável por qualquer usuário logado do CRM
-- (inclusive o parceiro). Passa a ser só admin. O processo do Compensation grava pelo banco direto
-- (papel de serviço), que não passa por RLS — nada muda pra ele.
do $$ declare t text; begin
  foreach t in array array['comp_extratos','comp_linhas','comp_agenciamento','comp_apuracao'] loop
    if to_regclass('public.'||t) is not null then
      execute format('drop policy if exists %I on public.%I', t||'_autorizado', t);
      execute format('drop policy if exists %I on public.%I', t||'_admin', t);
      execute format('create policy %I on public.%I for all to authenticated using (public.lp_sou_admin()) with check (public.lp_sou_admin())', t||'_admin', t);
      execute format('revoke all on public.%I from anon', t);
    end if;
  end loop;
end $$;

-- Base da projeção por apólice (última parcela conhecida): competência, nº da parcela, comissão e prêmio
-- líquido de UMA parcela. Atualizada ao fechar cada competência (só apólices que compensaram nela).
alter table public.parceria_acordos add column if not exists ult_comp     text;
alter table public.parceria_acordos add column if not exists ult_parcela  integer;
alter table public.parceria_acordos add column if not exists ult_comissao numeric(12,2);
alter table public.parceria_acordos add column if not exists ult_premio   numeric(12,2);
