-- BACKOFFICE V1 (02/09/2026) · Modulo 3 — Beneficios (regulacao de sinistro).
-- Aditiva e idempotente. Aplicada no playground cjieobmdpqcupzdpckef via MCP.
-- Nao tem relatorio: o caso e aberto a mao e vive ate o pagamento.
-- DADO DE SAUDE: RLS por dono (ou delegado do dono, lp_donos_visiveis()), igual as outras 6 do BackOffice.
-- Este arquivo NAO contem seed com dado real (repo publico) — o caso inicial foi inserido direto no banco.
create table if not exists public.beneficios (
  id                 uuid primary key default gen_random_uuid(),
  lp_email           text not null default (auth.jwt() ->> 'email'),
  segurado           text not null,
  apolice            text not null,
  lp                 text check (lp in ('Gustavo','Daniel','Rebeca')),
  tipo_evento        text not null,        -- quebra_ossos | doenca_grave | invalidez | morte | outro
  descricao_evento   text,
  data_evento        date,
  data_aviso         date,                 -- quando o cliente comunicou
  data_abertura      date,                 -- quando o beneficio foi aberto na seguradora
  protocolo          text,                 -- TEXTO. nunca so imagem.
  situacao           text not null default 'montagem'
                     check (situacao in ('montagem','aberto','em_exigencia','em_analise','pago','negado','cancelado')),
  bola_com           text check (bola_com in ('segurado','hospital','assessoria','seguradora','nos')),
  ultima_acao        text,
  ultima_acao_em     date,
  proxima_acao       text,
  proxima_acao_prazo date,
  valor_pago         numeric(12,2),
  data_pagamento     date,
  observacao         text,
  criado_em          timestamptz default now(),
  atualizado_em      timestamptz default now()
);
create index if not exists beneficios_situacao_idx on public.beneficios (situacao);
create index if not exists beneficios_prazo_idx    on public.beneficios (proxima_acao_prazo);
create index if not exists beneficios_lp_idx       on public.beneficios (lp);
create index if not exists beneficios_dono_idx     on public.beneficios (lp_email);

-- checklist de documentos: uma linha por item, por caso
create table if not exists public.beneficio_documentos (
  id            uuid primary key default gen_random_uuid(),
  beneficio_id  uuid not null references public.beneficios(id) on delete cascade,
  item          text not null,
  estado        text not null default 'pendente'
                check (estado in ('nao_se_aplica','pendente','solicitado','recebido','anexado')),
  solicitado_em date,
  recebido_em   date,
  anexado_em    date,
  observacao    text,
  ordem         integer
);
create index if not exists beneficio_documentos_caso_idx on public.beneficio_documentos (beneficio_id);

-- exigencias do CES
create table if not exists public.beneficio_exigencias (
  id            uuid primary key default gen_random_uuid(),
  beneficio_id  uuid not null references public.beneficios(id) on delete cascade,
  descricao     text not null,
  recebida_em   date not null,
  prazo         date,
  respondida_em date,
  situacao      text not null default 'aberta'
                check (situacao in ('aberta','respondida','cumprida','inaplicavel')),
  observacao    text
);
create index if not exists beneficio_exigencias_caso_idx on public.beneficio_exigencias (beneficio_id);
create index if not exists beneficio_exigencias_prazo_idx on public.beneficio_exigencias (situacao, prazo);

-- diario do caso: o historico que hoje mora no WhatsApp
create table if not exists public.beneficio_eventos (
  id            uuid primary key default gen_random_uuid(),
  beneficio_id  uuid not null references public.beneficios(id) on delete cascade,
  ocorrido_em   timestamptz not null default now(),
  autor         text,
  tipo          text,   -- contato | documento | exigencia | protocolo | prazo | nota
  texto         text not null
);
create index if not exists beneficio_eventos_caso_idx on public.beneficio_eventos (beneficio_id, ocorrido_em);

-- RLS: dono ou delegado do dono (mesmo formato das 6 tabelas do BackOffice).
alter table public.beneficios           enable row level security;
alter table public.beneficio_documentos enable row level security;
alter table public.beneficio_exigencias enable row level security;
alter table public.beneficio_eventos    enable row level security;
drop policy if exists beneficios_dono on public.beneficios;
create policy beneficios_dono on public.beneficios for all to public
  using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
-- filhas: visiveis so quando o caso pai e visivel (o pai ja filtra por dono/delegado)
drop policy if exists beneficio_documentos_dono on public.beneficio_documentos;
create policy beneficio_documentos_dono on public.beneficio_documentos for all to public
  using (exists (select 1 from public.beneficios b where b.id=beneficio_id and b.lp_email in (select public.lp_donos_visiveis())))
  with check (exists (select 1 from public.beneficios b where b.id=beneficio_id and b.lp_email in (select public.lp_donos_visiveis())));
drop policy if exists beneficio_exigencias_dono on public.beneficio_exigencias;
create policy beneficio_exigencias_dono on public.beneficio_exigencias for all to public
  using (exists (select 1 from public.beneficios b where b.id=beneficio_id and b.lp_email in (select public.lp_donos_visiveis())))
  with check (exists (select 1 from public.beneficios b where b.id=beneficio_id and b.lp_email in (select public.lp_donos_visiveis())));
drop policy if exists beneficio_eventos_dono on public.beneficio_eventos;
create policy beneficio_eventos_dono on public.beneficio_eventos for all to public
  using (exists (select 1 from public.beneficios b where b.id=beneficio_id and b.lp_email in (select public.lp_donos_visiveis())))
  with check (exists (select 1 from public.beneficios b where b.id=beneficio_id and b.lp_email in (select public.lp_donos_visiveis())));

-- Reverter (manual): drop table if exists public.beneficio_eventos, public.beneficio_exigencias, public.beneficio_documentos, public.beneficios;
