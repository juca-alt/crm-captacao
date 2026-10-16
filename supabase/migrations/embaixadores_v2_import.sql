-- EMBAIXADORES-V2 · T2 (16/10/2026) — importação da planilha Mercado X do embaixador. Idempotente.
-- emb_tel_chave: chave de identidade do telefone = DDD + últimos 8 dígitos (casa com/sem o 9 e com/sem +55).
-- emb_nome_norm: nome sem acento, minúsculo, espaços únicos.
-- emb_importar(embaixador, linhas, arquivo): só admin. Cria os nomes no ESTOQUE (funil 'bn', estagio 'estoque') em
--   etapa_embaixador='mapeado'. Linha sem nome: ignorada e contada. Mesmo telefone (ou, sem telefone, mesmo nome) já
--   importado pra este embaixador: pula (2ª importação = 0 novos). Já existe no CRM (qualquer funil/Estoque) ou é
--   cliente da carteira (telefone ou nome igual): NÃO cria, só sinaliza no relatório. id determinístico (emb<id>_<chave>).
create or replace function public.emb_tel_chave(p text) returns text language sql immutable as $$
  select case when length(d) in (10,11) then left(d,2)||right(d,8) else null end
  from (select case when length(x)>=12 and left(x,2)='55' then substr(x,3) else x end d
        from (select regexp_replace(coalesce(p,''),'\D','','g') x) a) b $$;
create or replace function public.emb_nome_norm(p text) returns text language sql immutable as $$
  select nullif(regexp_replace(lower(translate(trim(coalesce(p,'')),
    'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ','AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')),'\s+',' ','g'),'') $$;

-- número brasileiro ("10.000,50", "R$ 8000", "8000.5") → numeric; o que não for número limpo vira null (nunca derruba a carga)
create or replace function public.emb_num(p text) returns numeric language sql immutable as $$
  select case when x ~ '^\d+(\.\d+)?$' then x::numeric end
  from (select case when y !~ '^[0-9.,]+$' then null
                    when y ~ ',' then replace(replace(y,'.',''),',','.')
                    when y ~ '^\d{1,3}(\.\d{3})+$' then replace(y,'.','') else y end x
        from (select regexp_replace(upper(coalesce(p,'')),'R\$|\s','','g') y) a) b $$;
create or replace function public.emb_importar(p_embaixador bigint, p_linhas jsonb, p_arquivo text default null, p_simular boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_emb public.parceiros%rowtype; v_dono text; v_r jsonb;
begin
  if not public.lp_sou_admin() then raise exception 'Só o admin importa leads de embaixador'; end if;
  select * into v_emb from public.parceiros where id = p_embaixador and tipo = 'embaixador';
  if not found then raise exception 'Embaixador % não encontrado', p_embaixador; end if;
  v_dono := lower(coalesce(auth.jwt()->>'email',''));
  if v_dono = '' then raise exception 'Sem login'; end if;
  -- uma consulta só (sem tabela temporária): classifica cada linha, insere as novas e devolve o relatório
  with l as (
    select n, nullif(trim(x->>'nome'),'') nome, nullif(trim(x->>'telefone'),'') telefone,
           public.emb_tel_chave(x->>'telefone') tk, public.emb_nome_norm(x->>'nome') nk,
           nullif(upper(trim(x->>'gi')),'') gi, nullif(upper(trim(x->>'pessoa_chave')),'') pc,
           x->>'idade' idade, x->>'profissao' profissao, x->>'area_atuacao' area, x->>'estado_civil' civil, x->>'filhos' filhos,
           x->>'origem_contato' origem_contato, x->>'recomendante' recomendante, x->>'renda' renda
    from jsonb_array_elements(coalesce(p_linhas,'[]'::jsonb)) with ordinality t(x,n)),
  l2 as (select l.*, coalesce(tk,'n:'||nk) chave,
           case when nome is null then 0 else row_number() over (partition by (nome is null), coalesce(tk,'n:'||nk) order by n) end rk from l),
  crm as (select coalesce(c.dados->>'funil','nn') funil, c.dados->>'embaixador_id' emb,
                 public.emb_tel_chave(c.dados->>'telefone') tk, public.emb_nome_norm(c.dados->>'nome') nk
          from public.lp_contatos c where coalesce(c.dados->>'estagio','') <> 'fundido'),
  cart as (select public.emb_tel_chave(coalesce(cc.dados->>'celular',cc.dados->>'telefone')) tk, public.emb_nome_norm(cc.dados->>'nome') nk
           from public.carteira_clientes cc),
  cls as (select l2.*,
     case when nome is null then 'sem_nome' when rk > 1 then 'repetida'
          when exists (select 1 from crm c where c.emb = p_embaixador::text and ((l2.tk is not null and c.tk = l2.tk) or (l2.tk is null and c.nk = l2.nk))) then 'ja_importado'
          when exists (select 1 from cart k where (l2.tk is not null and k.tk = l2.tk) or k.nk = l2.nk) then 'cliente'
          when l2.tk is not null and exists (select 1 from crm c where c.tk = l2.tk) then 'existente' end situacao,
     coalesce((select 'Carteira' from cart k where (l2.tk is not null and k.tk = l2.tk) or k.nk = l2.nk limit 1),
              (select case c.funil when 'bn' then 'Estoque de Nomes' else 'Funil '||c.funil end from crm c where l2.tk is not null and c.tk = l2.tk limit 1)) onde
     from l2),
  ins as (
    insert into public.lp_contatos (dono, id, dados, atualizado)
    select v_dono, 'emb'||p_embaixador||'_'||md5(a.chave), jsonb_strip_nulls(jsonb_build_object(
        'id','emb'||p_embaixador||'_'||md5(a.chave), 'nome',a.nome, 'telefone',a.telefone, 'funil','bn', 'estagio','estoque',
        'listas','[]'::jsonb, 'trilha','seguro', 'notas','', 'criadoEm',to_char(now(),'YYYY-MM-DD'), '_upd',(extract(epoch from now())*1000)::bigint,
        'origem','Embaixador: '||v_emb.nome, 'embaixador_id',p_embaixador, 'etapa_embaixador','mapeado',
        'gi',a.gi, 'pessoa_chave',a.pc, 'idade',a.idade, 'profissao',a.profissao, 'cargo',a.profissao, 'area_atuacao',a.area,
        'estado_civil',a.civil, 'filhos_txt',a.filhos, 'origem_contato',a.origem_contato, 'recomendante',a.recomendante,
        'renda_estimada', public.emb_num(a.renda),
        'importado_de', coalesce(p_arquivo,'Mercado X'), 'importado_em', to_char(now(),'YYYY-MM-DD'))), now()
    from cls a where a.situacao is null and not p_simular
    on conflict (dono, id) do nothing
    returning dados->>'gi' gi),
  ja as (select dados->>'gi' gi from public.lp_contatos where dados->>'embaixador_id' = p_embaixador::text)
  select jsonb_build_object(
    'simulacao', p_simular,
    'criados', case when p_simular then (select count(*) from cls where situacao is null) else (select count(*) from ins) end,
    'ja_importados', (select count(*) from cls where situacao='ja_importado'),
    'sem_nome', (select count(*) from cls where situacao='sem_nome'),
    'repetidas_no_arquivo', (select count(*) from cls where situacao='repetida'),
    'sem_telefone', (select count(*) from cls where nome is not null and tk is null),
    'clientes', coalesce((select jsonb_agg(jsonb_build_object('linha',n,'nome',nome,'onde',onde) order by n) from cls where situacao='cliente'),'[]'),
    'existentes', coalesce((select jsonb_agg(jsonb_build_object('linha',n,'nome',nome,'onde',onde) order by n) from cls where situacao='existente'),'[]'),
    'gi_arquivo', (select jsonb_object_agg(g, q) from (select coalesce(gi,'—') g, count(*) q from cls where nome is not null and rk = 1 group by 1) z),
    'leads_do_embaixador', (select count(*) from ja) + (select count(*) from ins),
    'gi', (select jsonb_object_agg(g, q) from (select coalesce(gi,'—') g, count(*) q from (select gi from ja union all select gi from ins) u group by 1) z)
  ) into v_r;
  return v_r;
end $$;
revoke all on function public.emb_importar(bigint, jsonb, text, boolean) from public, anon;
grant execute on function public.emb_importar(bigint, jsonb, text, boolean) to authenticated;
