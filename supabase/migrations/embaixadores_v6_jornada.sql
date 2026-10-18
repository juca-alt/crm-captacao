-- EMBAIXADORES-V8 (18/10/2026) — no lugar das "notas", a LINHA DO TEMPO DA JORNADA de cada nome, dos dois lados, com anexos.
-- Pedido dele: "ao invés de notas deixa tipo uma timeline da jornada… mando também informações das interações, pra poder anexar
-- imagens ou PDF". Idempotente.
--   * Post da jornada = item em dados.emb_notas (o campo de antes, agora com por/autor/anexos):
--       {id, em, por:'embaixador'|'equipe', autor, texto, anexos:[{path, nome, mime, tam}]}
--     O embaixador posta nos nomes DELE já liberados; quem gerencia (Gustavo/Victor) posta em qualquer nome de embaixador.
--     O que a equipe posta o embaixador VÊ (é conversa dos dois lados).
--   * Marcos automáticos = dados.emb_hist (Para esquentar, Esquentado…) — no portal sai SEM o e-mail de quem moveu.
--   * Anexos no Storage do Supabase, bucket privado `emb-anexos` (10 MB, imagem ou PDF), caminho <embaixador>/<nome>/<arquivo>.
--     Embaixador lê/sobe só na pasta dele; quem gerencia lê/sobe em todas. Link pra abrir = URL assinada (expira).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('emb-anexos', 'emb-anexos', false, 10485760, array['image/jpeg','image/png','image/webp','image/heic','image/heif','image/gif','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'emb_anexos_ler') then
    create policy emb_anexos_ler on storage.objects for select to authenticated using (
      bucket_id = 'emb-anexos' and (public.emb_gestor() is not null
        or (public.emb_eu() is not null and (storage.foldername(name))[1] = public.emb_eu()::text)));
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'emb_anexos_subir') then
    create policy emb_anexos_subir on storage.objects for insert to authenticated with check (
      bucket_id = 'emb-anexos' and (public.emb_gestor() is not null
        or (public.emb_eu() is not null and (storage.foldername(name))[1] = public.emb_eu()::text)));
  end if;
end $$;

-- postar na jornada (os dois lados). Anexos já subidos no Storage; aqui só confere o caminho e grava a referência.
create or replace function public.emb_jornada_add(p_id text, p_texto text, p_anexos jsonb default '[]'::jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_e bigint := public.emb_eu(); v_g text := public.emb_gestor(); v_c record; v_t text := left(trim(coalesce(p_texto,'')), 2000);
        v_an jsonb := '[]'::jsonb; v_por text; v_autor text; v_n jsonb; x jsonb;
begin
  select c.dono, c.dados into v_c from public.lp_contatos c where c.id = p_id and c.dados ? 'embaixador_id' limit 1;
  if not found then raise exception 'Nome não encontrado'; end if;
  if v_e is not null and v_c.dados->>'embaixador_id' = v_e::text and public.emb_etapa_resumida(v_c.dados) <> 'mapeado' then
    v_por := 'embaixador'; select split_part(p.nome,' ',1) into v_autor from public.parceiros p where p.id = v_e;
  elsif v_g is not null and v_c.dono = v_g then
    v_por := 'equipe';   -- autor = 1º nome do login Google (sem o e-mail, que é chave de acesso)
    select initcap(split_part(coalesce(nullif(u.raw_user_meta_data->>'full_name',''), nullif(u.raw_user_meta_data->>'name',''), 'Equipe'),' ',1)) into v_autor
      from auth.users u where lower(u.email) = lower(auth.jwt()->>'email');
    v_autor := coalesce(v_autor, 'Equipe');
  else raise exception 'Esse nome não está na sua lista'; end if;
  if jsonb_typeof(coalesce(p_anexos,'[]'::jsonb)) <> 'array' or jsonb_array_length(coalesce(p_anexos,'[]'::jsonb)) > 5 then raise exception 'Até 5 anexos por vez'; end if;
  for x in select * from jsonb_array_elements(coalesce(p_anexos,'[]'::jsonb)) loop
    if coalesce(x->>'path','') not like (v_c.dados->>'embaixador_id')||'/'||p_id||'/%' then raise exception 'Anexo fora da pasta deste nome'; end if;
    v_an := v_an || jsonb_build_array(jsonb_build_object('path', x->>'path', 'nome', left(coalesce(x->>'nome','arquivo'),120), 'mime', left(coalesce(x->>'mime',''),60), 'tam', (x->>'tam')::bigint));
  end loop;
  if v_t = '' and jsonb_array_length(v_an) = 0 then raise exception 'Escreva algo ou anexe um arquivo'; end if;
  update public.lp_contatos c set
    dados = c.dados || jsonb_build_object('emb_notas',
      (select coalesce(jsonb_agg(y order by o), '[]'::jsonb) from (
         select y, o from jsonb_array_elements(coalesce(c.dados->'emb_notas','[]'::jsonb) || jsonb_build_array(jsonb_build_object(
           'id', md5(random()::text || clock_timestamp()::text), 'em', now(), 'por', v_por, 'autor', v_autor, 'texto', v_t, 'anexos', v_an))) with ordinality t(y, o)
         order by o desc limit 100) z),
      '_upd', (extract(epoch from now())*1000)::bigint),
    atualizado = now()
  where c.id = p_id and c.dono = v_c.dono
  returning c.dados->'emb_notas' into v_n;
  return v_n;
end $$;
revoke all on function public.emb_jornada_add(text, text, jsonb) from public, anon;
grant execute on function public.emb_jornada_add(text, text, jsonb) to authenticated;

-- marcos automáticos sem dado interno (só a etapa nova e quando)
create or replace function public.emb_marcos(p_dados jsonb) returns jsonb language sql immutable as $$
  select coalesce(jsonb_agg(jsonb_build_object('em', h->>'em', 'para', h->>'para') order by h->>'em'), '[]'::jsonb)
    from jsonb_array_elements(coalesce(p_dados->'emb_hist','[]'::jsonb)) h $$;

-- portal: a jornada (posts dos dois lados + marcos). Colunas novas no FIM da view segura.
create or replace view public.emb_portal with (security_barrier = true) as
  select c.id, c.dados->>'nome' as nome, e.etapa, public.emb_etapa_rotulo(e.etapa) as etapa_rotulo, public.emb_valor_lead(c.dados) as valor,
         coalesce(c.dados->'emb_notas', '[]'::jsonb) as notas, public.emb_marcos(c.dados) as marcos
    from public.lp_contatos c
    cross join lateral (select public.emb_etapa_resumida(c.dados) as etapa) e
   where c.dados->>'embaixador_id' = public.emb_eu()::text
     and e.etapa <> 'mapeado';
revoke all on public.emb_portal from public, anon;
grant select on public.emb_portal to authenticated;

-- CRM: a jornada de um nome pra quem gerencia
create or replace function public.emb_jornada_lead(p_id text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('posts', coalesce(c.dados->'emb_notas','[]'::jsonb), 'marcos', public.emb_marcos(c.dados), 'etapa', public.emb_etapa_resumida(c.dados))
    from public.lp_contatos c where public.emb_gestor() is not null and c.dono = public.emb_gestor() and c.id = p_id and c.dados ? 'embaixador_id' $$;
revoke all on function public.emb_jornada_lead(text) from public, anon;
grant execute on function public.emb_jornada_lead(text) to authenticated;

-- o portal precisa do id do embaixador pra montar a pasta dos anexos (o próprio id; nada além do nome)
create or replace function public.emb_portal_eu() returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', p.id, 'nome', p.nome) from public.parceiros p where p.id = public.emb_eu() $$;
