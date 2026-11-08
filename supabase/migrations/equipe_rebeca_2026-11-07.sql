-- ============================================================================
-- EQUIPE · REBECA NO CRM (ticket B, 07/11/2026) — RODAR À MÃO no SQL editor do CRM (cjieobmdpqcupzdpckef).
-- Decisão dele (07/11): sigla RC, cor laranja, pacote A (backoffice + carteira + conversas + relatórios do portal;
-- sem MFO/VG, sem Planos & Simulações, sem Parceiros/Plano e sem as regras que mudam número).
--
-- E-MAIL PROVISÓRIO: rebeca@pendente.invalid (domínio .invalid não existe → ninguém loga com ele). Serve pra ele já
-- ver a visão dela ("Ver como" / Acessos & Módulos) antes de ela mandar o e-mail. Quando o e-mail real chegar, rodar
-- o bloco 5 (troca em um passo). O e-mail real NUNCA entra no repo (repo público).
--
-- ROLLBACK (desfaz tudo; se já trocou pro e-mail real, use o real no lugar do provisório):
--   delete from lp_delegacoes where delegado_email = 'rebeca@pendente.invalid';
--   delete from lp_perfis     where email          = 'rebeca@pendente.invalid';
--   update app_settings set valor = jsonb_set(valor #- '{membros,rebeca@pendente.invalid}', '{times,juca@segurocomjuca.com}',
--     (select coalesce(jsonb_agg(x), '[]'::jsonb) from jsonb_array_elements(valor->'times'->'juca@segurocomjuca.com') x
--       where x <> to_jsonb('rebeca@pendente.invalid'::text))) where chave = 'equipe';
-- ============================================================================

-- 1) perfil (papel lp, igual ao Victor) com os módulos do pacote A
do $$
declare e text := lower(btrim('rebeca@pendente.invalid'));
begin
  insert into public.lp_perfis (email, papel, modulos) values (e, 'lp', jsonb_build_object(
    -- liga
    'backoffice', true, 'carteira', true, 'beneficios', true, 'placed', true,
    'solic-v2', true, 'solic-tarefas', true, 'solic-agenda', true, 'solic-negocio', true, 'solic-kanban', true,
    'ini-acomp', true, 'carga', true, 'anexos-drive', true,
    'conversas', true, 'importacoes', true,
    'agenda-global', true, 'funil-unico', true, 'ficha-ux2', true,
    'bn', true, 'revisao', true,
    -- desliga (explícito, pra não herdar padrão)
    'fu-mfo', false, 'funis_extra', false, 'painel-wa', false, 'embaixadores', false,
    'planos', false, 'parceiros', false, 'plano', false, 'pm-padrao', false, 'congelar-pa', false))
  on conflict (email) do update set papel = excluded.papel, modulos = excluded.modulos, atualizado = now();
end $$;

-- 2) delegação: ela trabalha na base do Gustavo (só dele; a base do Daniel fica fora)
do $$
declare e text := lower(btrim('rebeca@pendente.invalid'));
begin
  insert into public.lp_delegacoes (dono_email, delegado_email, modulos)
  values ('juca@segurocomjuca.com', e, '{"backoffice": true}'::jsonb)   -- mesmo valor da delegação do Victor
  on conflict (dono_email, delegado_email) do nothing;
end $$;

-- 3) equipe: membro RC laranja + entra no time do Gustavo ("quem toca")
do $$
declare e text := lower(btrim('rebeca@pendente.invalid'));
begin
  update public.app_settings set valor =
    jsonb_set(
      jsonb_set(valor, array['membros', e], jsonb_build_object('nome','Rebeca','sigla','RC','cor','#ea580c'), true),
      array['times','juca@segurocomjuca.com'],
      (select coalesce(jsonb_agg(distinct x), '[]'::jsonb)
         from (select jsonb_array_elements(coalesce(valor->'times'->'juca@segurocomjuca.com','[]'::jsonb)) x
               union select to_jsonb(e)) t),
      true)
  where chave = 'equipe';
end $$;

-- 4) CONFERÊNCIA (tem que aparecer: 1 perfil lp com 19 módulos ligados, 1 delegação do Gustavo, RC no time do Gustavo)
select 'perfil' o_que, papel, (select count(*) from jsonb_each(modulos) where value = 'true'::jsonb) modulos_ligados
  from public.lp_perfis where email like 'rebeca@pendente.invalid'
union all
select 'delegacao', split_part(dono_email,'@',1), null from public.lp_delegacoes where delegado_email like 'rebeca@pendente.invalid'
union all
select 'equipe', valor->'membros'->'rebeca@pendente.invalid'->>'sigla',
       (select count(*) from jsonb_array_elements_text(valor->'times'->'juca@segurocomjuca.com') x where x = 'rebeca@pendente.invalid')
  from public.app_settings where chave = 'equipe';

-- 5) QUANDO O E-MAIL REAL CHEGAR — troca o provisório pelo real nos 3 lugares (rodar sozinho, trocando NOVO_EMAIL)
-- do $$
-- declare velho text := 'rebeca@pendente.invalid'; novo text := lower(btrim('NOVO_EMAIL'));
-- begin
--   if novo not like '%@%' or novo like '%novo_email%' then raise exception 'Troque NOVO_EMAIL'; end if;
--   update public.lp_perfis     set email = novo, atualizado = now() where email = velho;
--   update public.lp_delegacoes set delegado_email = novo where delegado_email = velho;
--   update public.app_settings set valor = jsonb_set(
--       jsonb_set(valor #- array['membros', velho], array['membros', novo], valor->'membros'->velho, true),
--       array['times','juca@segurocomjuca.com'],
--       (select coalesce(jsonb_agg(case when x = to_jsonb(velho) then to_jsonb(novo) else x end), '[]'::jsonb)
--          from jsonb_array_elements(valor->'times'->'juca@segurocomjuca.com') x))
--   where chave = 'equipe';
-- end $$;
-- Depois: Painel Master · Acessos → linha dela → "📂 dar acesso à pasta do Drive" (anexos).
