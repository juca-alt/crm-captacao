-- EMBAIXADORES-V4 · T4+T6 (16/10/2026) — o embaixador no banco: identidade, view segura, o ÚNICO movimento dele. Idempotente.
-- Login: link mágico (Supabase Auth, sem senha) pro e-mail do cadastro dele em `parceiros` (tipo='embaixador').
-- Isolamento é do BANCO, não da tela:
--   * lp_contatos: o embaixador não é dono nem delegado → a RLS existente (lp_donos_visiveis) devolve 0 linhas pra ele.
--   * emb_portal (view segura): SÓ os leads dele, SÓ a partir de 'selecionado', SÓ nome + etapa resumida + valor.
--     Telefone, renda, GI, prêmio, apólice e leads de outro embaixador não existem na resposta da API.
--   * emb_esquentei(id): o único movimento dele — 'selecionado' → 'esquentado'. Qualquer outro o banco recusa.
-- emb_eu(): o parceiro-embaixador do logado (pelo e-mail do login). null = não é embaixador.
create or replace function public.emb_eu() returns bigint language sql stable security definer set search_path = public as $$
  select p.id from public.parceiros p
   where p.tipo = 'embaixador' and coalesce(p.ativo, true)
     and coalesce(auth.jwt()->>'email','') <> '' and lower(p.email) = lower(auth.jwt()->>'email')
   order by p.id limit 1 $$;
revoke all on function public.emb_eu() from public, anon;
grant execute on function public.emb_eu() to authenticated;

-- T6 · valor a receber do lead — FONTE ÚNICA. Regra do termo: 50% da comissão líquida (após Simples 8%) dos 12 primeiros
--   meses do negócio. Hoje o CRM NÃO tem comissão por lead (o motor do módulo Parceiros apura pelo extrato do PARCEIRO × apólice
--   do acordo; a comissão de um negócio do embaixador vem no extrato do Gustavo e não há vínculo lead → apólice → comissão).
--   Então devolve null → a tela mostra "—", nunca R$ 0,00 inventado. Quando o vínculo existir, só esta função muda.
create or replace function public.emb_valor_lead(p_dados jsonb) returns numeric language sql stable as $$ select null::numeric $$;

create or replace view public.emb_portal with (security_barrier = true) as
  select c.id, c.dados->>'nome' as nome, e.etapa, public.emb_etapa_rotulo(e.etapa) as etapa_rotulo, public.emb_valor_lead(c.dados) as valor
    from public.lp_contatos c
    cross join lateral (select public.emb_etapa_resumida(c.dados) as etapa) e
   where c.dados->>'embaixador_id' = public.emb_eu()::text
     and e.etapa <> 'mapeado';
revoke all on public.emb_portal from public, anon;
grant select on public.emb_portal to authenticated;

-- quem sou eu no portal (só o nome; o resto do cadastro não sai daqui)
create or replace function public.emb_portal_eu() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('nome', p.nome) from public.parceiros p where p.id = public.emb_eu() $$;
revoke all on function public.emb_portal_eu() from public, anon;
grant execute on function public.emb_portal_eu() to authenticated;

-- "Esquentei": só o embaixador DONO do lead, só de 'selecionado'. Qualquer outro caso → erro do banco.
create or replace function public.emb_esquentei(p_id text) returns text language plpgsql security definer set search_path = public as $$
declare v_e bigint := public.emb_eu(); v_n int;
begin
  if v_e is null then raise exception 'Só o embaixador marca "Esquentei"'; end if;
  update public.lp_contatos c set
    dados = c.dados || jsonb_build_object('etapa_embaixador', 'esquentado', 'esquentado_em', now(), '_upd', (extract(epoch from now())*1000)::bigint,
      'emb_hist', coalesce(c.dados->'emb_hist','[]'::jsonb) || jsonb_build_array(jsonb_build_object('de','selecionado','para','esquentado','em',now(),'por',lower(auth.jwt()->>'email')))),
    atualizado = now()
  where c.id = p_id and c.dados->>'embaixador_id' = v_e::text and public.emb_etapa_resumida(c.dados) = 'selecionado';
  get diagnostics v_n = row_count;
  if v_n = 0 then raise exception 'Movimento não permitido: o embaixador só leva "Para esquentar" → "Esquentado"'; end if;
  return 'esquentado';
end $$;
revoke all on function public.emb_esquentei(text) from public, anon;
grant execute on function public.emb_esquentei(text) to authenticated;
