-- Lista de Atraso (módulo do vendas.html, port do backoffice.html) — camada de dados.
-- APLICADA no playground cjieobmdpqcupzdpckef em 10/08/2026 via MCP
-- (apply_migration "vendas_atrasos_lista_atraso_v1"). Aditiva e idempotente:
-- só adiciona; não apaga dados (a tabela estava vazia). Deixada aqui versionada.
--
-- A tabela public.vendas_atrasos já existia (id uuid PK, lp_email, segurado,
-- resp_pagto, apolice, premio, vencido_em, forma_pagto, celular, status,
-- responsavel, ultima, criado_em). Esta migração completa o modelo alvo.

-- 1) colunas que faltavam
alter table public.vendas_atrasos
  add column if not exists lp_servico       text,      -- 'Daniel' | 'Gustavo' | 'Rebeca' (LP que atende a apólice)
  add column if not exists pago_ate         date,
  add column if not exists motivo_recusa    text,
  add column if not exists tratativa        text,      -- a nota de cobrança (fonte do status derivado)
  add column if not exists prox_contato     date,
  add column if not exists resolvido_em     date,      -- null = ativo; setado = saiu da contagem
  add column if not exists origem_relatorio date;      -- data do relatório que gerou/atualizou a linha (p/ o diff "sumiu")

-- 2) lp_email = dono do registro (o MFB logado). DEFAULT = e-mail do JWT, igual a
--    lp_contatos/carteira. A UI também seta explicitamente no upsert.
alter table public.vendas_atrasos alter column lp_email set default (auth.jwt() ->> 'email');

-- 3) a chave de negócio que faltava — raiz do bug de matching (upsert por apólice).
--    Índice único CHEIO p/ o ON CONFLICT (lp_email, apolice) do supabase-js.
--    A UI garante apólice normalizada e não-vazia antes do upsert.
create unique index if not exists vendas_atrasos_dono_apolice_uidx
  on public.vendas_atrasos (lp_email, apolice);

-- 4) RLS por dono, alinhada a lp_contatos_dono (NÃO desliga RLS; troca auth.role() por lp_email=email)
drop policy if exists "auth all vendas_atrasos" on public.vendas_atrasos;
create policy "vendas_atrasos_dono" on public.vendas_atrasos
  for all to public
  using  (lp_email = (auth.jwt() ->> 'email'))
  with check (lp_email = (auth.jwt() ->> 'email'));

-- doc
comment on column public.vendas_atrasos.responsavel is 'Responsável pela tratativa (time interno), não confundir com resp_pagto (quem paga a apólice).';
comment on column public.vendas_atrasos.lp_servico  is 'LP que atende a apólice (Daniel/Gustavo/Rebeca), do agrupamento do relatório — distinto de lp_email (dono do registro no app).';
