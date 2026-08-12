-- Modulo Substituicao de Apolice (port do controle-substituicao.html v1.9).
-- APLICADA no playground cjieobmdpqcupzdpckef em 11/08/2026 (subst_apolice_modulo_v1).
-- Aditiva: 3 tabelas novas, nada existente e tocado.
-- Padrao alinhado a vendas_atrasos: dono = lp_email via DEFAULT auth.jwt()->>'email' + RLS por dono.

create table if not exists public.subst_clientes (
  id uuid primary key default gen_random_uuid(),
  lp_email text not null default (auth.jwt() ->> 'email'),
  ref text not null,                     -- id estavel vindo do controle antigo (ou gerado)
  nome text not null default '',
  cpf text, tel text, email text,
  valor_final numeric,                   -- premio do plano definitivo apos a transicao
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado timestamptz not null default now(),
  unique (lp_email, ref)
);

create table if not exists public.subst_apolices (
  id uuid primary key default gen_random_uuid(),
  lp_email text not null default (auth.jwt() ->> 'email'),
  ref text not null,
  cli_ref text not null,                 -- liga em subst_clientes.ref (mesmo dono)
  numero text not null default '',
  papel text not null default 'proteger',-- 'gatilho' (nova, abre a janela de 6 meses) | 'proteger' (antiga)
  emissao date,
  premio numeric not null default 0,
  dia int,                               -- dia escolhido para pagamento
  venc_aberto date,                      -- vencimento do premio em aberto
  lp text, forma text,
  pode_postergar boolean,                -- null = nao avaliado com a assistente
  data_postergada date,
  impresso date,                         -- VERSAO do dado: data de impressao do documento aplicado
  motivo text,                           -- motivo da recusa de cobranca
  dados jsonb not null default '{}'::jsonb,
  criado_em timestamptz not null default now(),
  atualizado timestamptz not null default now(),
  unique (lp_email, ref)
);
create index if not exists subst_apolices_numero_idx on public.subst_apolices (lp_email, numero);

create table if not exists public.subst_pagamentos (
  id uuid primary key default gen_random_uuid(),
  lp_email text not null default (auth.jwt() ->> 'email'),
  ref text not null,
  apo_ref text not null,                 -- liga em subst_apolices.ref (mesmo dono)
  venc date,
  valor numeric not null default 0,
  status text not null default 'confirmado',  -- aguardando -> comprovante -> confirmado
  enviado date, comprovante date, confirmado date,
  primeiro boolean not null default false,    -- marco de inicio da janela
  obs text,
  criado_em timestamptz not null default now(),
  atualizado timestamptz not null default now(),
  unique (lp_email, ref)
);
create index if not exists subst_pagamentos_apo_idx on public.subst_pagamentos (lp_email, apo_ref);

alter table public.subst_clientes   enable row level security;
alter table public.subst_apolices   enable row level security;
alter table public.subst_pagamentos enable row level security;

drop policy if exists subst_clientes_dono   on public.subst_clientes;
drop policy if exists subst_apolices_dono   on public.subst_apolices;
drop policy if exists subst_pagamentos_dono on public.subst_pagamentos;

create policy subst_clientes_dono on public.subst_clientes
  for all to authenticated
  using (lp_email = (auth.jwt() ->> 'email')) with check (lp_email = (auth.jwt() ->> 'email'));
create policy subst_apolices_dono on public.subst_apolices
  for all to authenticated
  using (lp_email = (auth.jwt() ->> 'email')) with check (lp_email = (auth.jwt() ->> 'email'));
create policy subst_pagamentos_dono on public.subst_pagamentos
  for all to authenticated
  using (lp_email = (auth.jwt() ->> 'email')) with check (lp_email = (auth.jwt() ->> 'email'));

-- tabela nova nasce sem acesso anonimo (default privileges do schema public dao grant amplo)
revoke all on public.subst_clientes   from anon;
revoke all on public.subst_apolices   from anon;
revoke all on public.subst_pagamentos from anon;
grant select, insert, update, delete on public.subst_clientes   to authenticated;
grant select, insert, update, delete on public.subst_apolices   to authenticated;
grant select, insert, update, delete on public.subst_pagamentos to authenticated;
