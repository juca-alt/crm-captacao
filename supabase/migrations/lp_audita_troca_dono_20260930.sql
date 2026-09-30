-- AUDIT-29-09 (30/09/2026) -- auditoria adversarial achou: trocar o DONO de um negocio (lp_contatos.dono) ou de uma
-- solicitacao nao entrava na trilha (o dono NOVO era usado; se o novo dono era quem fazia, nada era gravado).
-- Agora a troca de dono SEMPRE e registrada, no nome do dono ANTIGO (quem perdeu o registro ve na trilha dele),
-- com 'dono -> <novo>' em campos. Aplicado via MCP; testado em transacao desfeita. ASCII puro.
create or replace function public.lp_audita() returns trigger
language plpgsql security definer set search_path = public, extensions, pg_temp as $$
declare
  v_email text := coalesce(auth.jwt()->>'email', 'sistema');
  v_new jsonb; v_old jsonb; v_dono text; v_id text; v_campos text[];
  v_dono_old text; v_dono_new text; v_troca boolean := false;
begin
  if TG_OP <> 'DELETE' then v_new := to_jsonb(NEW); end if;
  if TG_OP <> 'INSERT' then v_old := to_jsonb(OLD); end if;
  if TG_TABLE_NAME = 'lp_contatos' then
    v_dono_old := v_old->>'dono'; v_dono_new := v_new->>'dono';
    v_new := v_new->'dados'; v_old := v_old->'dados';
  else
    v_dono_old := v_old->>'lp_email'; v_dono_new := v_new->>'lp_email';
  end if;
  v_troca := TG_OP = 'UPDATE' and v_dono_old is distinct from v_dono_new;
  v_dono := case when v_troca then v_dono_old else coalesce(v_dono_new, v_dono_old) end;
  v_id := coalesce(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
  if not v_troca and TG_OP <> 'DELETE' and v_email = coalesce(v_dono, '') then return null; end if;
  select array_agg(k order by k) into v_campos from (
    select coalesce(n.key, o.key) k
    from jsonb_each(coalesce(v_new, '{}'::jsonb)) n
    full outer join jsonb_each(coalesce(v_old, '{}'::jsonb)) o on o.key = n.key
    where n.value is distinct from o.value
      and coalesce(n.key, o.key) not in ('_upd', 'atualizado', 'ord', 'ultimo_toque_em')
  ) x;
  if v_troca then v_campos := array_prepend('dono -> ' || coalesce(v_dono_new, '?'), coalesce(v_campos, '{}')); end if;
  if TG_OP = 'UPDATE' and v_campos is null then return null; end if;
  insert into public.lp_auditoria (email, tabela, registro_id, op, dono, campos)
  values (v_email, TG_TABLE_NAME, v_id, TG_OP, v_dono, case when TG_OP = 'UPDATE' then v_campos else null end);
  return null;
end $$;
