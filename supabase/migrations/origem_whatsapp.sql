-- ============================================================================
--  Habilita a origem "WhatsApp" no enum origem_t — canal da extensão
--  "Captação · WhatsApp → CRM".
--
--  Contexto 23/07/2026: no primeiro teste real da extensão, salvar um lead com
--  origem WhatsApp devolveu `invalid input value for enum origem_t: "WhatsApp"`
--  — a coluna leads.origem é um ENUM do Postgres, não texto livre, e "WhatsApp"
--  ainda não existia nele.
--
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
--  Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

alter type public.origem_t add value if not exists 'WhatsApp';

-- ── Verificação (só leitura) ──────────────────────────────────────────────────
-- "WhatsApp" deve aparecer na lista de valores do enum:
select unnest(enum_range(null::public.origem_t)) as origem;
