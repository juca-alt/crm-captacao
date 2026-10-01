-- SEGURANCA-LINTS (30/09/2026) -- e-mail do Supabase "Action required: security vulnerabilities" (27/09):
-- CRITICO rls_disabled_in_public -> resolvido em rls_comp_20260929.sql (comp_* + _bkp_20260921_ta).
-- Avisos da mesma varredura, resolvidos aqui (aplicado via MCP com OK dele):
--   function_search_path_mutable (11 funcoes) -> search_path fixo (public, extensions, pg_temp)
--   extension_in_public (unaccent)           -> movida pro schema extensions; a unica usuaria
--     (lp_varredura_diaria) ganhou "extensions" no search_path. Testado: funcoes devolvem o mesmo;
--     varredura rodou inteira dentro de transacao desfeita.
alter function public.leads_set_codigo() set search_path = public, extensions, pg_temp;
alter function public.lp_patch_campos(text) set search_path = public, extensions, pg_temp;
alter function public.lp_tel_limpa(text) set search_path = public, extensions, pg_temp;
alter function public.lp_toca_atualizado() set search_path = public, extensions, pg_temp;
alter function public.lp_upsert_item(text,text,text,jsonb) set search_path = public, extensions, pg_temp;
alter function public.lp_var_add(jsonb,text,text,text) set search_path = public, extensions, pg_temp;
alter function public.norm_lk(text) set search_path = public, extensions, pg_temp;
alter function public.pc_melhor_dia(date) set search_path = public, extensions, pg_temp;
alter function public.pc_proxima_cobranca(integer,date,date) set search_path = public, extensions, pg_temp;
alter function public.trg_leads_touch() set search_path = public, extensions, pg_temp;
alter function public.trg_touch_atualizado_em() set search_path = public, extensions, pg_temp;
alter function public.lp_varredura_diaria(text) set search_path = public, extensions, pg_temp;
alter extension unaccent set schema extensions;
