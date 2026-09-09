-- 09/09/2026 — idempotência do import em lote do crm-mcp (criar_contatos_lote).
-- ref_base único por dono. Aditivo: coluna nullable + índice único (dono, ref_base).
-- NULLS DISTINCT (default) => múltiplos ref_base nulos convivem; não-nulo é único por dono.
-- Já aplicado em prod via MCP apply_migration (lp_contatos_ref_base_lote). Este arquivo versiona o schema.
alter table public.lp_contatos add column if not exists ref_base text;
create unique index if not exists lp_contatos_dono_refbase_uidx on public.lp_contatos(dono, ref_base);
