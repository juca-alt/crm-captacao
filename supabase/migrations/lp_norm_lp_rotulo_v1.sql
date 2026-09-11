-- LP-ROTULO-PORTA-V1 (11/09/2026): dados.lp tem que ser um rotulo do dono (lp_rotulo_dono).
-- Se nao for, vira o primeiro rotulo do dono (ordem alfabetica: juca -> gustavo). Dono sem rotulo: nao mexe.
create or replace function public.lp_norm_lp_rotulo() returns trigger
language plpgsql security definer set search_path to 'public' as $$
declare v_lp text; v_ok boolean; v_padrao text;
begin
  if NEW.dono is null or NEW.dados is null then return NEW; end if;
  select min(rotulo) into v_padrao from public.lp_rotulo_dono where dono_email=NEW.dono;
  if v_padrao is null then return NEW; end if;
  v_lp := lower(btrim(coalesce(NEW.dados->>'lp','')));
  select exists(select 1 from public.lp_rotulo_dono where dono_email=NEW.dono and lower(rotulo)=v_lp) into v_ok;
  if not v_ok then NEW.dados := NEW.dados || jsonb_build_object('lp', v_padrao); end if;
  return NEW;
end $$;
revoke execute on function public.lp_norm_lp_rotulo() from public, anon;
drop trigger if exists trg_norm_lp_rotulo on public.lp_contatos;
create trigger trg_norm_lp_rotulo before insert or update of dados, dono on public.lp_contatos
for each row execute function public.lp_norm_lp_rotulo();
