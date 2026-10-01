-- RLS-COMP-V1 (29/09/2026) -- varredura de seguranca achou 5 tabelas do public SEM RLS.
-- comp_* = extratos de comissao Prudential (FYC, comissao, INSS/IR, segurado): qualquer usuario LOGADO
-- (Daniel, Victor) lia e alterava. Nenhum codigo do CRM usa essas tabelas. Conserto:
--   comp_*            -> RLS ligado + so o ADMIN (lp_perfis.papel='admin') le e escreve
--   _bkp_20260921_ta  -> RLS ligado sem policy (deny-all, igual aos outros backups)
-- Funcao do servidor (service_role) nao e afetada. ASCII puro.
do $$
declare t text;
begin
  foreach t in array array['comp_agenciamento','comp_apuracao','comp_extratos','comp_linhas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t||'_admin', t);
    execute format('create policy %I on public.%I for all using (exists (select 1 from public.lp_perfis p where lower(p.email)=lower(coalesce(auth.jwt()->>''email'','''')) and p.papel=''admin'')) with check (exists (select 1 from public.lp_perfis p where lower(p.email)=lower(coalesce(auth.jwt()->>''email'','''')) and p.papel=''admin''))', t||'_admin', t);
  end loop;
end $$;
alter table public._bkp_20260921_ta enable row level security;
select relname, relrowsecurity from pg_class where relname in ('comp_agenciamento','comp_apuracao','comp_extratos','comp_linhas','_bkp_20260921_ta') order by 1;
-- 2a etapa (29/09, mesma aprovacao): as tabelas ja tinham policies *_autorizado (crm_autorizado = qualquer usuario do CRM),
-- escondidas enquanto o RLS estava desligado. Removidas pra valer o "so admin".
drop policy if exists comp_agenciamento_autorizado on public.comp_agenciamento;
drop policy if exists comp_apuracao_autorizado on public.comp_apuracao;
drop policy if exists comp_extratos_autorizado on public.comp_extratos;
drop policy if exists comp_linhas_autorizado on public.comp_linhas;
