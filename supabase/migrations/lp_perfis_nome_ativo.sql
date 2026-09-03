-- ============================================================================
-- lp_perfis: nome de exibicao e liberacao de acesso  (Painel Master v2)
-- 03/09/2026 - Visao LP (vendas.html v0.44.0)
--
-- O QUE FAZ
--   nome  = como a pessoa aparece no painel. Null cai no prefixo do e-mail.
--   ativo = false PAUSA o acesso NO APP: a tela avisa e nao pinta o CRM.
--
-- O QUE NAO FAZ (esta escrito na tela tambem)
--   `ativo=false` NAO revoga o login. O token do Supabase continua valendo e
--   quem manda no dado e o RLS. Para tirar o acesso de verdade: remover a
--   delegacao (lp_delegacoes) e o usuario em Auth -> Users.
--
-- SEGURO DE RODAR DUAS VEZES: tudo com `if not exists`.
-- O APP FUNCIONA ANTES E DEPOIS: ele le `select('*')`, e os dois controles so
-- aparecem quando as colunas existirem.
-- ============================================================================

alter table public.lp_perfis add column if not exists nome  text;
alter table public.lp_perfis add column if not exists ativo boolean not null default true;

comment on column public.lp_perfis.nome  is 'Nome de exibicao no Painel Master. Null = deriva do e-mail.';
comment on column public.lp_perfis.ativo is 'false = acesso PAUSADO no app (a tela avisa e nao pinta). Nao e revogacao: o RLS segue mandando no dado.';

-- conferencia
-- select email, papel, nome, ativo from public.lp_perfis order by email;

-- ----------------------------------------------------------------------------
-- ROLLBACK (reversivel; roda so se quiser desfazer)
-- alter table public.lp_perfis drop column if exists ativo;
-- alter table public.lp_perfis drop column if exists nome;
-- ----------------------------------------------------------------------------
