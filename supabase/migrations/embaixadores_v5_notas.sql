-- EMBAIXADORES-V7 (16/10/2026) — o embaixador participa: NOTAS por nome + adicionar UM nome (não só planilha). Idempotente.
-- Nota do embaixador: dados.emb_notas = [{em, texto, por:'embaixador'}…] (máx. 50 por nome, 1.000 caracteres cada).
--   Só ele escreve, só nos nomes DELE já liberados (de 'selecionado' em diante). Quem gerencia lê no CRM (emb_leads_notas).
-- Adicionar um nome: emb_adicionar() = emb_importar() com UMA linha (mesma dedup, mesmo relatório) + opção de já nascer
--   em 'Para esquentar'.
create or replace function public.emb_nota(p_id text, p_texto text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_e bigint := public.emb_eu(); v_t text := left(trim(coalesce(p_texto,'')), 1000); v_n jsonb;
begin
  if v_e is null then raise exception 'Só o embaixador escreve nota aqui'; end if;
  if v_t = '' then raise exception 'Nota vazia'; end if;
  update public.lp_contatos c set
    dados = c.dados || jsonb_build_object('emb_notas',
      (select coalesce(jsonb_agg(x order by o), '[]'::jsonb) from (
         select x, o from jsonb_array_elements(coalesce(c.dados->'emb_notas','[]'::jsonb) || jsonb_build_array(jsonb_build_object('em', now(), 'texto', v_t, 'por', 'embaixador'))) with ordinality t(x, o)
         order by o desc limit 50) z),
      '_upd', (extract(epoch from now())*1000)::bigint),
    atualizado = now()
  where c.id = p_id and c.dados->>'embaixador_id' = v_e::text and public.emb_etapa_resumida(c.dados) <> 'mapeado'
  returning c.dados->'emb_notas' into v_n;
  if v_n is null then raise exception 'Esse nome não está na sua lista'; end if;
  return v_n;
end $$;
revoke all on function public.emb_nota(text, text) from public, anon;
grant execute on function public.emb_nota(text, text) to authenticated;

-- o portal passa a trazer as notas DELE (coluna nova no fim da view segura; nada de telefone/renda/GI)
create or replace view public.emb_portal with (security_barrier = true) as
  select c.id, c.dados->>'nome' as nome, e.etapa, public.emb_etapa_rotulo(e.etapa) as etapa_rotulo, public.emb_valor_lead(c.dados) as valor,
         coalesce(c.dados->'emb_notas', '[]'::jsonb) as notas
    from public.lp_contatos c
    cross join lateral (select public.emb_etapa_resumida(c.dados) as etapa) e
   where c.dados->>'embaixador_id' = public.emb_eu()::text
     and e.etapa <> 'mapeado';
revoke all on public.emb_portal from public, anon;
grant select on public.emb_portal to authenticated;

-- quem gerencia lê as notas de um embaixador (só os nomes que têm nota)
create or replace function public.emb_leads_notas(p_embaixador bigint) returns table (id text, notas jsonb)
language sql stable security definer set search_path = public as $$
  select c.id, c.dados->'emb_notas' from public.lp_contatos c
   where public.emb_gestor() is not null and c.dono = public.emb_gestor()
     and c.dados->>'embaixador_id' = p_embaixador::text and jsonb_array_length(coalesce(c.dados->'emb_notas','[]'::jsonb)) > 0 $$;
revoke all on function public.emb_leads_notas(bigint) from public, anon;
grant execute on function public.emb_leads_notas(bigint) to authenticated;

-- adicionar UM nome pelo CRM (mesma regra da planilha) e, se pedido, já em 'Para esquentar'
create or replace function public.emb_adicionar(p_embaixador bigint, p_linha jsonb, p_esquentar boolean default false) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_r jsonb; v_id text; v_ch text;
begin
  if public.emb_gestor() is null then raise exception 'Só quem gerencia os embaixadores adiciona'; end if;
  if nullif(trim(coalesce(p_linha->>'nome','')),'') is null then raise exception 'Nome obrigatório'; end if;
  v_r := public.emb_importar(p_embaixador, jsonb_build_array(p_linha), 'manual', false);
  v_ch := coalesce(public.emb_tel_chave(p_linha->>'telefone'), 'n:'||public.emb_nome_norm(p_linha->>'nome'));
  v_id := 'emb'||p_embaixador||'_'||md5(v_ch);
  if (v_r->>'criados')::int = 1 and p_esquentar then perform public.emb_selecionar(array[v_id]); end if;
  return v_r || jsonb_build_object('id', case when (v_r->>'criados')::int = 1 then v_id end);
end $$;
revoke all on function public.emb_adicionar(bigint, jsonb, boolean) from public, anon;
grant execute on function public.emb_adicionar(bigint, jsonb, boolean) to authenticated;
