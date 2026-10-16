-- EMBAIXADORES-V1 · T1 (16/10/2026) — modelo de dados do programa "Embaixadores da Proteção".
-- Idempotente (rodar 2× = mesmo schema). Decisões:
--  * Embaixador = linha de `parceiros` com tipo='embaixador' (reaproveita a tabela do módulo Parceiros; pct_padrao=50, simples_pct=8).
--  * Lead de embaixador = nome do ESTOQUE (lp_contatos com dados.funil='bn') — o Estoque já é a lista de nomes antes do funil
--    e já tem idade/profissão/recomendante/renda/estado civil/filhos. Campos novos em dados: embaixador_id, etapa_embaixador,
--    gi, pessoa_chave, area_atuacao (origem = "Embaixador: <nome>").
--    dados é jsonb → sem FK de verdade; a integridade (embaixador existe e é tipo 'embaixador') é garantida pela RPC de
--    importação (T2) e pela de seleção (T3). Índice parcial pra buscar os leads de cada embaixador.
--  * Etapa resumida = DERIVADA (fonte única: emb_etapa_resumida). Antes do funil: dados.etapa_embaixador
--    (mapeado → selecionado → esquentado). Quando o nome vira negócio, o app cria o card do funil e grava
--    dados.funil_contato_id no nome — daí em diante a etapa vem do CARD, lida na config dos funis (app_settings.lp_funil_cfg):
--    prob 100 → fechado · etapa de encerramento (enc) → encerrado · qualquer outra → em_atendimento.
alter table public.parceiros add column if not exists tipo text not null default 'lp';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'parceiros_tipo_chk') then
    alter table public.parceiros add constraint parceiros_tipo_chk check (tipo in ('lp','embaixador'));
  end if;
end $$;

create index if not exists lp_contatos_embaixador_idx on public.lp_contatos ((dados->>'embaixador_id')) where dados ? 'embaixador_id';

create or replace function public.emb_etapa_resumida(p_dados jsonb) returns text
language plpgsql stable security definer set search_path = public as $$
declare v_f jsonb; v_cfg jsonb; v_e jsonb; v_chave text;
begin
  if coalesce(p_dados->>'funil_contato_id','') <> '' then
    select c.dados into v_f from public.lp_contatos c where c.id = p_dados->>'funil_contato_id';
    if v_f is not null then
      v_chave := case when coalesce(v_f->>'funil','nn') in ('nn','lp') then 'lp' else v_f->>'funil' end;   -- o funil Novos Negócios é 'lp' na config
      select a.valor -> v_chave into v_cfg from public.app_settings a where a.chave = 'lp_funil_cfg';
      select e into v_e from jsonb_array_elements(coalesce(v_cfg,'[]'::jsonb)) e where e->>'id' = v_f->>'etapa' limit 1;
      if v_e is not null and coalesce((v_e->>'prob')::numeric,0) >= 100 then return 'fechado'; end if;
      if v_e is not null and coalesce((v_e->>'enc')::boolean,false) then return 'encerrado'; end if;
      return 'em_atendimento';
    end if;
  end if;
  if p_dados->>'estagio' = 'descartado' then return 'encerrado'; end if;
  return case when p_dados->>'etapa_embaixador' in ('mapeado','selecionado','esquentado') then p_dados->>'etapa_embaixador' else 'mapeado' end;
end $$;
revoke all on function public.emb_etapa_resumida(jsonb) from public, anon;
grant execute on function public.emb_etapa_resumida(jsonb) to authenticated;

-- rótulo que o EMBAIXADOR vê (mapeado não aparece pra ele — filtro no portal/T4)
create or replace function public.emb_etapa_rotulo(p_etapa text) returns text language sql immutable as $$
  select case p_etapa when 'selecionado' then 'Para esquentar' when 'esquentado' then 'Esquentado'
    when 'em_atendimento' then 'Em conversa' when 'fechado' then 'Fechado' when 'encerrado' then 'Encerrado' else null end $$;
