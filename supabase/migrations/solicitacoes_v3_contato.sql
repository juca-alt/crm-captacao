-- SOLICITAÇÕES V3 · VÍNCULO COM O NEGÓCIO (23/09/2026)
-- Pedido dele: "permitir associar essas solicitações e tarefas aos clientes e oportunidades no funil,
-- porque por vezes são ações pra destravar a emissão do cliente — ex.: Marcus Tulio, ajuste na apólice
-- antiga pra destravar a emissão/compensação da oportunidade que está em UW & Emissão."
-- IDEMPOTENTE. Rodar no SQL editor do projeto cjieobmdpqcupzdpckef (ou via MCP apply_migration).
alter table public.solicitacoes
  add column if not exists contato_id text;   -- id do contato/negócio em lp_contatos (dados->>'id'); null = solta
create index if not exists solicitacoes_contato_idx on public.solicitacoes (contato_id);
