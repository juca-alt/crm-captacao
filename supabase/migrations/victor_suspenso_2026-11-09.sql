-- ============================================================================
-- C' · VICTOR SUSPENSO (09/11/2026) — RODAR À MÃO no SQL editor do CRM (cjieobmdpqcupzdpckef).
-- Palavra dele: "Victor saiu de tudo. Sem módulos, delegação do Gustavo desligada, login bloqueado
-- (ban no auth, NUNCA delete). Dados com dono dele intactos. Deixe no doc o SQL de religar. Nada de DELETE."
--
-- Repo público: o e-mail real NÃO fica aqui. Troque  victor@EXEMPLO.invalid  pelo e-mail dele
-- (a versão pronta, com o e-mail certo, vai só no chat).
--
-- O que faz (tudo UPDATE/INSERT — nenhum DELETE):
--   1. guarda uma FOTO do antes em app_settings 'suspenso_victor_2026-11-09' (módulos, delegações, times) → o religar usa ela
--   2. lp_perfis: todos os módulos = false (inclusive os que nascem ligados: carteira, backoffice, benefícios, planos, placed)
--   3. lp_delegacoes: as delegações pra ele (Gustavo e Daniel) ficam SUSPENSAS — o e-mail do delegado ganha "#suspenso-2026-11-09"
--      (a linha continua lá; nenhuma regra de acesso reconhece mais esse e-mail)
--   4. auth.users: banned_until = 2999 (login bloqueado; a conta e o histórico continuam)
--   5. app_settings.equipe: sai dos times (Gustavo e Daniel); continua em "membros" pra o histórico mostrar o nome
--   6. triagem: o que estava 🔵 Victor vira 🔴 Gustavo
-- Dados com dono dele (se houver) ficam intactos — nada aqui toca tabela de dados.
-- Sessão já aberta dele morre em até 1h (o token não renova com ban).
-- Fora do banco (à mão): tirar o acesso dele à pasta do Drive "Pipe X" e à agenda, se houver.
-- ============================================================================

-- ---------- ANTES (conferência) ----------
select 'perfil' as o_que, papel as info, (select count(*) from jsonb_each(modulos) where value = 'true'::jsonb)::text as ligados
  from public.lp_perfis where lower(email) = lower('victor@EXEMPLO.invalid')
union all select 'delegação de ' || dono_email, 'ativa', modulos::text from public.lp_delegacoes where lower(delegado_email) = lower('victor@EXEMPLO.invalid')
union all select 'login', coalesce(banned_until::text, 'liberado'), '' from auth.users where lower(email) = lower('victor@EXEMPLO.invalid')
union all select 'times com ele', string_agg(k, ', '), '' from public.app_settings s, jsonb_each(s.valor->'times') t(k, v)
  where s.chave = 'equipe' and v ? 'victor@EXEMPLO.invalid'
union all select 'triagem 🔵', count(*)::text, '' from public.copiloto_fila_cache where destino = 'vitor';


-- ---------- GRAVA (uma transação: ou vai tudo, ou nada) ----------
begin;

-- 1. foto do antes (não sobrescreve se já existir — rodar duas vezes não perde a foto original)
insert into public.app_settings (chave, valor, atualizado_em)
select 'suspenso_victor_2026-11-09', jsonb_build_object(
    'email', lower('victor@EXEMPLO.invalid'),
    'perfil_modulos', (select modulos from public.lp_perfis where lower(email) = lower('victor@EXEMPLO.invalid')),
    'delegacoes', (select coalesce(jsonb_agg(jsonb_build_object('dono_email', dono_email, 'modulos', modulos)), '[]'::jsonb)
                     from public.lp_delegacoes where lower(delegado_email) = lower('victor@EXEMPLO.invalid')),
    'times', (select coalesce(jsonb_agg(k), '[]'::jsonb) from public.app_settings s, jsonb_each(s.valor->'times') t(k, v)
                where s.chave = 'equipe' and v ? 'victor@EXEMPLO.invalid'),
    'feito_em', now()), now()
on conflict (chave) do nothing;

-- 2. sem módulos (todas as chaves que ele tinha + as do app que nascem ligadas, explícitas em false)
update public.lp_perfis p
   set modulos = (select jsonb_object_agg(k, false) from (
          select jsonb_object_keys(coalesce(p.modulos, '{}'::jsonb)) k
          union select unnest(array['bn','recs','funis_extra','revisao','carteira','backoffice','solic-v2','carga','painel-wa','plano',
            'pm-padrao','ini-acomp','solic-tarefas','solic-agenda','solic-negocio','solic-kanban','anexos-drive','beneficios','planos',
            'embaixadores','parceiros','congelar-pa','conversas','importacoes','placed','funil-unico','fu-mfo','ficha-ux2','agenda-global'])) x),
       atualizado = now()
 where lower(email) = lower('victor@EXEMPLO.invalid');

-- 3. delegações suspensas (Gustavo e Daniel) — UPDATE, não DELETE
update public.lp_delegacoes
   set delegado_email = lower(delegado_email) || '#suspenso-2026-11-09'
 where lower(delegado_email) = lower('victor@EXEMPLO.invalid');

-- 4. login bloqueado (a conta continua)
update auth.users set banned_until = '2999-12-31 00:00:00+00'
 where lower(email) = lower('victor@EXEMPLO.invalid');

-- 5. fora dos times (fica em "membros" pro histórico)
update public.app_settings s
   set valor = jsonb_set(s.valor, '{times}', (
         select coalesce(jsonb_object_agg(k, coalesce((select jsonb_agg(e) from jsonb_array_elements(v) e
                                                       where lower(e #>> '{}') <> lower('victor@EXEMPLO.invalid')), '[]'::jsonb)), '{}'::jsonb)
           from jsonb_each(s.valor->'times') t(k, v))),
       atualizado_em = now()
 where s.chave = 'equipe' and jsonb_typeof(s.valor->'times') = 'object';

-- 6. triagem: 🔵 Victor → 🔴 Gustavo
update public.copiloto_fila_cache set destino = 'gustavo' where destino = 'vitor';

commit;


-- ---------- DEPOIS (conferência: tem que dar ligados 0 · delegação 0 · login 2999 · times vazio · triagem 0 · foto ok) ----------
select 'perfil' as o_que, papel as info, (select count(*) from jsonb_each(modulos) where value = 'true'::jsonb)::text as resultado
  from public.lp_perfis where lower(email) = lower('victor@EXEMPLO.invalid')
union all select 'delegações ativas', count(*)::text, '' from public.lp_delegacoes where lower(delegado_email) = lower('victor@EXEMPLO.invalid')
union all select 'delegações suspensas', count(*)::text, '' from public.lp_delegacoes where delegado_email like '%#suspenso-2026-11-09'
union all select 'login', coalesce(banned_until::text, 'liberado'), '' from auth.users where lower(email) = lower('victor@EXEMPLO.invalid')
union all select 'times com ele', coalesce(string_agg(k, ', '), 'nenhum'), '' from public.app_settings s, jsonb_each(s.valor->'times') t(k, v)
  where s.chave = 'equipe' and v ? 'victor@EXEMPLO.invalid'
union all select 'triagem 🔵', count(*)::text, '' from public.copiloto_fila_cache where destino = 'vitor'
union all select 'foto do antes', case when exists (select 1 from public.app_settings where chave = 'suspenso_victor_2026-11-09') then 'guardada' else 'FALTOU' end, '';


-- ============================================================================
-- RELIGAR (só se ele voltar — rodar à mão, tudo comentado de propósito). Usa a foto do passo 1.
-- ============================================================================
-- begin;
-- update auth.users set banned_until = null where lower(email) = lower('victor@EXEMPLO.invalid');
-- update public.lp_delegacoes set delegado_email = replace(delegado_email, '#suspenso-2026-11-09', '')
--  where delegado_email = lower('victor@EXEMPLO.invalid') || '#suspenso-2026-11-09';
-- update public.lp_perfis set modulos = (select valor->'perfil_modulos' from public.app_settings where chave = 'suspenso_victor_2026-11-09'), atualizado = now()
--  where lower(email) = lower('victor@EXEMPLO.invalid');
-- update public.app_settings s set valor = jsonb_set(s.valor, '{times}', (
--          select jsonb_object_agg(k, case when f.valor->'times' ? k and not v ? lower('victor@EXEMPLO.invalid')
--                                          then v || to_jsonb(lower('victor@EXEMPLO.invalid')) else v end)
--            from jsonb_each(s.valor->'times') t(k, v), public.app_settings f where f.chave = 'suspenso_victor_2026-11-09')),
--        atualizado_em = now()
--  where s.chave = 'equipe';
-- commit;
-- (a triagem não volta pro 🔵: o destino "vitor" saiu da Edge Function; religar o destino é outra decisão)
