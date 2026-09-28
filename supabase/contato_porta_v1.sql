-- CONTATO-PORTA-V1 (28/09/2026) -- Backlog #3: contato que entra por QUALQUER porta (app, crm-mcp, SQL da
-- assistente) sai na forma canonica. O app ja normaliza no lpcRowOut; este trigger cobre as outras portas.
--   1) lp minusculo (os rotulos em lp_rotulo_dono sao minusculos)
--   2) telefone / telefones_alt sem marcas invisiveis (U+200B-200F, U+202A-202E, U+2060-2069, U+FEFF) e com
--      hifen padrao (U+2010-2015, U+2212 -> '-')
--   3) trilha nunca vazia em NENHUM funil (antes so o Estoque ganhava 'seguro')
-- Idempotente: CREATE OR REPLACE + backfill que so toca quem esta fora da forma. SQL ASCII-puro.

create or replace function public.lp_tel_limpa(t text) returns text language sql immutable as $$
  select nullif(btrim(regexp_replace(regexp_replace(regexp_replace(
    coalesce(t,''),
    E'[\\u200B-\\u200F\\u202A-\\u202E\\u2060-\\u2069\\uFEFF]', '', 'g'),
    E'[\\u2010-\\u2015\\u2212]', '-', 'g'),
    E'[\\u00A0\\s]+', ' ', 'g')), '')
$$;

create or replace function public.lp_norm_estagio()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare d jsonb; f text; e text; est text;
begin
  d := coalesce(new.dados, '{}'::jsonb);
  if jsonb_typeof(d) <> 'object' then return new; end if;
  if coalesce(d->>'id','') = '' or d->>'id' <> new.id then d := d || jsonb_build_object('id', new.id); end if;
  f := d->>'funil';
  if f is null or f = '' then f := 'bn'; d := d || jsonb_build_object('funil', f); end if;
  if coalesce(d->>'estagio','') = '' then
    e := coalesce(d->>'etapa','');
    est := case
      when f = 'bn' then 'estoque'
      when e = 'SitPlan' then 'estoque'
      when e = 'TA' then 'lista_ta'
      when e in ('OI/FF','P/C','C2','N','FA',U&'EMISS\00C3O','EMISSAO') then 'oi_agendado'
      when e in ('DELIVERY',U&'Ap\00F3lice Emitida','Venda ganha') then 'cliente'
      when e in (U&'N\00E3o','Nao','Prop. Cancelada',U&'Ap\00F3l. Cancelada','Apol. Cancelada','Venda perdida') then 'descartado'
      else 'estoque' end;
    d := d || jsonb_build_object('estagio', est);
  end if;
  -- CONTATO-PORTA-V1: trilha em qualquer funil (era so no 'bn')
  if coalesce(d->>'trilha','') = '' then d := d || '{"trilha":"seguro"}'::jsonb; end if;
  if f = 'bn' then
    if d->'listas' is null then d := d || '{"listas":[]}'::jsonb; end if;
  end if;
  -- CONTATO-PORTA-V1: telefone limpo
  if jsonb_typeof(d->'telefone') = 'string' and d->>'telefone' is distinct from public.lp_tel_limpa(d->>'telefone') then
    d := d || jsonb_build_object('telefone', public.lp_tel_limpa(d->>'telefone'));
  end if;
  if jsonb_typeof(d->'telefones_alt') = 'array' then
    d := d || jsonb_build_object('telefones_alt', coalesce((select jsonb_agg(public.lp_tel_limpa(x)) from jsonb_array_elements_text(d->'telefones_alt') x where public.lp_tel_limpa(x) is not null), '[]'::jsonb));
  end if;
  new.dados := d;
  return new;
end $function$;

create or replace function public.lp_norm_lp_rotulo()
 returns trigger language plpgsql security definer set search_path to 'public' as $function$
declare v_lp text; v_ok boolean; v_padrao text;
begin
  if NEW.dono is null or NEW.dados is null then return NEW; end if;
  select min(rotulo) into v_padrao from public.lp_rotulo_dono where dono_email=NEW.dono;
  if v_padrao is null then return NEW; end if;
  v_lp := lower(btrim(coalesce(NEW.dados->>'lp','')));
  select exists(select 1 from public.lp_rotulo_dono where dono_email=NEW.dono and lower(rotulo)=v_lp) into v_ok;
  if not v_ok then NEW.dados := NEW.dados || jsonb_build_object('lp', lower(v_padrao));
  elsif NEW.dados->>'lp' is distinct from v_lp then NEW.dados := NEW.dados || jsonb_build_object('lp', v_lp);   -- CONTATO-PORTA-V1: minusculo
  end if;
  return NEW;
end $function$;

-- Backfill (so quem esta fora da forma; o proprio trigger normaliza no UPDATE)
update public.lp_contatos set dados = dados
 where coalesce(dados->>'trilha','') = ''
    or (dados->>'lp') is distinct from lower(dados->>'lp')
    or (jsonb_typeof(dados->'telefone') = 'string' and dados->>'telefone' is distinct from public.lp_tel_limpa(dados->>'telefone'));
