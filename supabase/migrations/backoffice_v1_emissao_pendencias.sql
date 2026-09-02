-- BACKOFFICE V1 (02/09/2026) · Entrega 1 — Pendencias de Emissao (espelho de vendas_atrasos).
-- RLS por dono (lp_email = e-mail do JWT), igual a vendas_atrasos. Unicidade (lp_email, proposta) = onConflict do upsert.
create table if not exists public.emissao_pendencias (
  id                    uuid primary key default gen_random_uuid(),
  lp_email              text not null default (auth.jwt() ->> 'email'),
  -- vindos do relatorio (sobrescritos a cada colagem)
  proposta              text not null,
  apolice               text,
  segurado              text not null,
  resp_pagamento        text,
  status_apolice        text,
  contestacao           text check (contestacao in ('medica','nao_medica')),
  dias_pendentes        integer,
  dt_assinatura         date,
  pa_sem_iof            numeric(12,2),
  afyc_projetado        numeric(12,2),
  lp                    text check (lp in ('Gustavo','Daniel','Rebeca')),
  lp_nome_completo      text,
  -- mantidos pelo Victor (NUNCA sobrescritos pela colagem)
  pendencia_descricao   text,
  bola_com              text check (bola_com in ('cliente','prudential','lm','nos')),
  status_tratativa      text,
  ultima_acao           text,
  ultima_acao_em        date,
  proxima_acao          text,
  proxima_acao_prazo    date,
  protocolo             text,
  observacao            text,
  -- controle
  importado_em          timestamptz default now(),
  atualizado_em         timestamptz default now(),
  saiu_do_relatorio_em  timestamptz,
  desfecho              text check (desfecho in ('emitida','cancelada')),
  desfecho_em           date,
  origem_relatorio      date
);
create unique index if not exists emissao_pendencias_dono_proposta_uidx on public.emissao_pendencias (lp_email, proposta);
create index if not exists emissao_pendencias_lp_idx on public.emissao_pendencias (lp);
create index if not exists emissao_pendencias_status_idx on public.emissao_pendencias (status_tratativa);
create index if not exists emissao_pendencias_dias_idx on public.emissao_pendencias (dias_pendentes);
create index if not exists emissao_pendencias_prazo_idx on public.emissao_pendencias (proxima_acao_prazo);
alter table public.emissao_pendencias enable row level security;
drop policy if exists emissao_pendencias_dono on public.emissao_pendencias;
create policy emissao_pendencias_dono on public.emissao_pendencias
  for all to public
  using  (lp_email = (auth.jwt() ->> 'email'))
  with check (lp_email = (auth.jwt() ->> 'email'));
