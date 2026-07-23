-- ============================================================================
--  Alinha o enum origem_t com TODAS as origens que o app usa + "WhatsApp"
--  (canal da extensão "Captação · WhatsApp → CRM").
--
--  Contexto 23/07/2026 (teste real da extensão): salvar lead devolvia
--  `invalid input value for enum origem_t: "WhatsApp"` e depois também
--  `...: "Rec Cliente"` — a coluna leads.origem é um ENUM do Postgres e estava
--  DEFASADA em relação aos rótulos do app (openNovo, index.html L3592). Isso
--  era a pendência antiga "validar 4 origens de PI logado" do ESTADO.
--
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
--  Idempotente. ⚠️ Rode a verificação em um Run SEPARADO (o Postgres não deixa
--  usar valores novos de enum na mesma transação que os criou).
-- ============================================================================

alter type public.origem_t add value if not exists 'LinkedIn';
alter type public.origem_t add value if not exists 'Rec LP';
alter type public.origem_t add value if not exists 'Rec OT';
alter type public.origem_t add value if not exists 'Rec Cliente';
alter type public.origem_t add value if not exists 'Rec Familiar';
alter type public.origem_t add value if not exists 'Instagram';
alter type public.origem_t add value if not exists 'Facebook';
alter type public.origem_t add value if not exists 'Abordagem Direta';
alter type public.origem_t add value if not exists 'WhatsApp';

-- ── Verificação (só leitura — rodar em um Run SEPARADO) ──────────────────────
-- select unnest(enum_range(null::public.origem_t)) as origem;
