-- SOLICITAÇÕES V2 · ACOMPANHAMENTO (17/09/2026)
-- Pedido dele: "módulo de acompanhamento de solicitações e pendências: o que entrou, o que está
-- sendo tratado, os próximos passos, o tempo que está a solicitação, os prazos de cada área —
-- até pra colocar o Victor como assistente nesse fluxo."
-- Evolui a tabela que JÁ existe (solicitacoes, RLS com delegação → o Victor já enxerga e grava)
-- e cria a linha do tempo (solicitacao_eventos), espelho da beneficio_eventos. IDEMPOTENTE.

-- 1. o vocabulário de tipo/frente passa a viver no app (SO_TIPOS/SO_FRENTES): tira as travas fixas
alter table public.solicitacoes drop constraint if exists solicitacoes_tipo_check;
alter table public.solicitacoes drop constraint if exists solicitacoes_frente_check;

-- 2. campos do acompanhamento
alter table public.solicitacoes
  add column if not exists area               text,          -- com quem está: lm | prudential_atendimento | prudential_cobranca | prudential_beneficios | prudential_subscricao | prudential_sinistro | outro
  add column if not exists prazo_area_dias    int,           -- prazo padrão da área no dia em que abriu (fica gravado: mudar a régua depois não reescreve o passado)
  add column if not exists proxima_acao       text,          -- o próximo passo, escrito
  add column if not exists proxima_acao_prazo date,          -- até quando
  add column if not exists bola_com           text,          -- quem deve o próximo movimento: nos | cliente | area
  add column if not exists ultimo_toque_em    timestamptz,   -- último andamento registrado (é o que mede "parada")
  add column if not exists encerrada_em       timestamptz;

-- 3. linha do tempo
create table if not exists public.solicitacao_eventos (
  id               uuid primary key default gen_random_uuid(),
  solicitacao_id   uuid not null references public.solicitacoes(id) on delete cascade,
  lp_email         text not null default (auth.jwt() ->> 'email'),
  ocorrido_em      timestamptz not null default now(),
  autor            text,
  tipo             text,      -- abertura | contato | retorno | protocolo | prazo | status | nota
  texto            text not null
);
create index if not exists solicitacao_eventos_sol_idx on public.solicitacao_eventos (solicitacao_id, ocorrido_em);
alter table public.solicitacao_eventos enable row level security;
drop policy if exists solicitacao_eventos_dono on public.solicitacao_eventos;
create policy solicitacao_eventos_dono on public.solicitacao_eventos for all to public
  using (lp_email in (select public.lp_donos_visiveis())) with check (lp_email in (select public.lp_donos_visiveis()));
