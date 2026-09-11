-- ESTAGIO-UNICO-V1 (10/09/2026): todo contato de lp_contatos tem um estagio do metodo
-- (estoque -> lista_ta -> oi_agendado -> cliente | descartado), independente do funil.
-- Normalizador (preenche o que falta, NUNCA sobrescreve o que o app mandou):
--   * sem 'funil'  -> funil='bn' (chegou sem endereco = bau do Estoque)
--   * sem 'estagio' -> derivado: bn -> 'estoque'; funil de vendas -> pela etapa
--       SitPlan->estoque, TA->lista_ta, OI/FF|P/C|C2|N|FA|EMISSAO->oi_agendado,
--       DELIVERY->cliente, Nao|Prop. Cancelada|Apol. Cancelada->descartado, outra->estoque
--   * funil bn sem trilha -> 'seguro'; sem listas -> []
-- Aplicada no playground em 10/09 (provada 5/5). Reverter: drop trigger trg_norm_estagio on lp_contatos; drop function lp_norm_estagio;
create or replace function public.lp_norm_estagio()
returns trigger language plpgsql security definer set search_path=public as $$
declare d jsonb; f text; e text; est text;
begin
  d := coalesce(new.dados, '{}'::jsonb);
  if jsonb_typeof(d) <> 'object' then return new; end if;
  f := d->>'funil';
  if f is null or f = '' then f := 'bn'; d := d || jsonb_build_object('funil', f); end if;
  if coalesce(d->>'estagio','') = '' then
    e := coalesce(d->>'etapa','');
    est := case
      when f = 'bn' then 'estoque'
      when e = 'SitPlan' then 'estoque'
      when e = 'TA' then 'lista_ta'
      when e in ('OI/FF','P/C','C2','N','FA','EMISSÃO','EMISSAO') then 'oi_agendado'
      when e in ('DELIVERY','Apólice Emitida','Venda ganha') then 'cliente'
      when e in ('Não','Nao','Prop. Cancelada','Apól. Cancelada','Apol. Cancelada','Venda perdida') then 'descartado'
      else 'estoque' end;
    d := d || jsonb_build_object('estagio', est);
  end if;
  if f = 'bn' then
    if coalesce(d->>'trilha','') = '' then d := d || '{"trilha":"seguro"}'::jsonb; end if;
    if d->'listas' is null then d := d || '{"listas":[]}'::jsonb; end if;
  end if;
  new.dados := d;
  return new;
end $$;

drop trigger if exists trg_norm_estagio on public.lp_contatos;
create trigger trg_norm_estagio before insert or update of dados on public.lp_contatos
  for each row execute function public.lp_norm_estagio();

-- Dado real rodado 10/09 (OK do Gustavo): base do Daniel roteada por etapa —
-- 1.368 (SitPlan/TA) -> funil bn (estoque/lista_ta, etapa_origem guardada, _upd novo); 218 (OI/FF..DELIVERY) ficaram no NN com estagio.
