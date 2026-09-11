-- CFG-SALVAR-V2 (11/09/2026): atualizado_em nunca andava no UPDATE (sem trigger) e enganou o diagnostico.
create or replace function public.trg_touch_atualizado_em() returns trigger language plpgsql as $$
begin NEW.atualizado_em := now(); return NEW; end $$;
drop trigger if exists trg_app_settings_touch on public.app_settings;
create trigger trg_app_settings_touch before update on public.app_settings for each row execute function public.trg_touch_atualizado_em();
