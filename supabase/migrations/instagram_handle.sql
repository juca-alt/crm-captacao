-- ============================================================================
-- instagram_handle — chave forte de dedupe do canal Instagram
--
-- Motivo: o findLeadMatch() do app resolve identidade por
--   linkedin_url_norm -> telefone_e164 -> email -> nome (palpite).
-- Um lead vindo da extensão Prospector Instagram não tem nenhuma das três
-- primeiras (o telefone só chega depois, quando o LP faz a ponte), então caía
-- sempre no match fraco por nome — homônimo virava a mesma pessoa e mudança de
-- nome de exibição no perfil criava lead duplicado.
--
-- O @ do Instagram é único e estável na plataforma: é o equivalente exato do
-- que a URL é no LinkedIn. Guardamos normalizado (minúsculo, sem @, sem URL).
--
-- Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp).
-- Idempotente: pode rodar de novo sem quebrar.
-- ============================================================================

alter table public.leads
  add column if not exists instagram_handle text;

comment on column public.leads.instagram_handle is
  'Handle do Instagram normalizado (minusculo, sem @). Chave forte de dedupe do canal Instagram, espelha o papel de linkedin_url_norm.';

-- UNIQUE parcial: só vale para quem tem handle. NULL não colide com NULL,
-- então leads sem Instagram (a maioria) seguem convivendo normalmente.
create unique index if not exists idx_leads_instagram_handle
  on public.leads (instagram_handle)
  where instagram_handle is not null;

-- Guarda de integridade: nunca aceitar '@' nem URL nessa coluna. Se algum
-- caminho futuro esquecer de normalizar, o banco recusa em vez de criar uma
-- segunda identidade para a mesma pessoa.
alter table public.leads
  drop constraint if exists chk_leads_instagram_handle_norm;

alter table public.leads
  add constraint chk_leads_instagram_handle_norm
  check (
    instagram_handle is null
    or (
      instagram_handle = lower(instagram_handle)
      and instagram_handle !~ '[@/\s]'
      and length(instagram_handle) between 1 and 30
    )
  );
