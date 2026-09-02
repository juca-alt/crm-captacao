-- BACKOFFICE V1 (02/09/2026) · Entrega 2 — Solicitacoes a assessoria (atravessa atraso e emissao).
create table if not exists public.solicitacoes (
  id              uuid primary key default gen_random_uuid(),
  lp_email        text not null default (auth.jwt() ->> 'email'),
  frente          text not null check (frente in ('atraso','emissao','outro')),
  ref_atraso_id   uuid references public.vendas_atrasos(id) on delete set null,
  ref_emissao_id  uuid references public.emissao_pendencias(id) on delete set null,
  segurado        text not null,
  apolice         text,
  base_lp         text check (base_lp in ('Gustavo','Daniel','Rebeca')),
  acao            text not null check (acao in ('consultar','executar')),
  tipo            text not null check (tipo in
                    ('postecipar','alt_pag','alt_dados','boleto','anexar',
                     'beneficio','reabilitacao','consulta_valor','outro')),
  contexto        text,
  prazo           date,
  contato_com     text check (contato_com in ('lm','gustavo','ninguem')),
  aberta_por      text,
  aberta_em       timestamptz default now(),
  respondida_em   timestamptz,
  resultado       text,
  protocolo       text,
  status          text not null default 'aberta'
                  check (status in ('aberta','respondida','executada','sem_retorno','cancelada'))
);
create index if not exists solicitacoes_status_idx on public.solicitacoes (status);
create index if not exists solicitacoes_prazo_idx on public.solicitacoes (prazo);
create index if not exists solicitacoes_aberta_em_idx on public.solicitacoes (aberta_em);
alter table public.solicitacoes enable row level security;
drop policy if exists solicitacoes_dono on public.solicitacoes;
create policy solicitacoes_dono on public.solicitacoes
  for all to public
  using  (lp_email = (auth.jwt() ->> 'email'))
  with check (lp_email = (auth.jwt() ->> 'email'));
