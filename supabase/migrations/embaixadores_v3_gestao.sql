-- EMBAIXADORES-V3 · T3 (16/10/2026) — gestão por embaixador (Gustavo e o Victor, backoffice dele). Idempotente.
-- emb_gestor(): de QUEM é a base de embaixadores que o logado gerencia — o próprio admin, ou o admin de quem ele é
--   delegado com backoffice (o Victor ajuda o Gustavo). null = não gerencia. Fonte ÚNICA da permissão de gestão.
create or replace function public.emb_gestor() returns text language sql stable security definer set search_path = public as $$
  select case when public.lp_sou_admin() then lower(auth.jwt()->>'email')
    else (select lower(d.dono_email) from public.lp_delegacoes d join public.lp_perfis p on lower(p.email) = lower(d.dono_email) and p.papel = 'admin'
          where lower(d.delegado_email) = lower(coalesce(auth.jwt()->>'email','')) and coalesce((d.modulos->>'backoffice')::boolean,false) limit 1) end $$;
revoke all on function public.emb_gestor() from public, anon;
grant execute on function public.emb_gestor() to authenticated;

-- quem gerencia LÊ os embaixadores (a gravação de parceiros segue só admin)
do $$ begin
  if not exists (select 1 from pg_policies where tablename = 'parceiros' and policyname = 'parceiros_emb_gestor_ler') then
    create policy parceiros_emb_gestor_ler on public.parceiros for select to authenticated using (tipo = 'embaixador' and public.emb_gestor() is not null);
  end if;
end $$;

-- lista do embaixador pra quem gerencia (etapa resumida DERIVADA no banco — a mesma regra do portal)
create or replace function public.emb_leads(p_embaixador bigint)
returns table (id text, nome text, telefone text, gi text, pessoa_chave text, renda numeric, idade text, profissao text, recomendante text, etapa text)
language sql stable security definer set search_path = public as $$
  select c.id, c.dados->>'nome', c.dados->>'telefone', c.dados->>'gi', c.dados->>'pessoa_chave',
         case when (c.dados->>'renda_estimada') ~ '^\d+(\.\d+)?$' then (c.dados->>'renda_estimada')::numeric end,
         c.dados->>'idade', c.dados->>'profissao', c.dados->>'recomendante', public.emb_etapa_resumida(c.dados)
  from public.lp_contatos c
  where public.emb_gestor() is not null and c.dono = public.emb_gestor() and c.dados->>'embaixador_id' = p_embaixador::text $$;
revoke all on function public.emb_leads(bigint) from public, anon;
grant execute on function public.emb_leads(bigint) to authenticated;

-- seleção em lote: mapeado → selecionado (ou de volta, se ainda não esquentou). Só mexe no que está na etapa de origem.
create or replace function public.emb_selecionar(p_ids text[], p_voltar boolean default false) returns int
language plpgsql security definer set search_path = public as $$
declare v_g text := public.emb_gestor(); v_n int; v_de text; v_para text;
begin
  if v_g is null then raise exception 'Só quem gerencia os embaixadores seleciona'; end if;
  v_de := case when p_voltar then 'selecionado' else 'mapeado' end; v_para := case when p_voltar then 'mapeado' else 'selecionado' end;
  update public.lp_contatos c set
    dados = c.dados || jsonb_build_object('etapa_embaixador', v_para, '_upd', (extract(epoch from now())*1000)::bigint,
      'emb_hist', coalesce(c.dados->'emb_hist','[]'::jsonb) || jsonb_build_array(jsonb_build_object('de',v_de,'para',v_para,'em',now(),'por',lower(auth.jwt()->>'email')))),
    atualizado = now()
  where c.dono = v_g and c.id = any(p_ids) and c.dados ? 'embaixador_id' and public.emb_etapa_resumida(c.dados) = v_de;
  get diagnostics v_n = row_count; return v_n;
end $$;
revoke all on function public.emb_selecionar(text[], boolean) from public, anon;
grant execute on function public.emb_selecionar(text[], boolean) to authenticated;

-- importação: emb_importar (v2) passou a usar emb_gestor() — admin OU backoffice dele importa; o lead fica sempre
--   NO NOME DO ADMIN (base dele). Rodar o v2 de novo depois deste.
