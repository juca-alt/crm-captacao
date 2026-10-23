-- ATRASO-V2 · T1 (23/10/2026) — normalização do motivo da recusa e da forma de pagamento da Lista de Atraso.
-- FONTE ÚNICA: a regra vive SÓ aqui — tabela kb_motivos_atraso + fn_normalizar_motivo_atraso / fn_normalizar_forma_pagto
-- + gatilho em vendas_atrasos. Qualquer importação (tela, Edge Function, SQL) recalcula motivo_chave/forma_norm sozinha;
-- a tela só LÊ as colunas. O valor bruto (motivo_recusa, forma_pagto) nunca é alterado.
-- Idempotente: rodar 2× dá o mesmo schema e o seed não duplica.

-- 1) catálogo dos motivos (variantes = fragmentos minúsculos SEM acento; o primeiro que casar, por ordem, vence)
create table if not exists public.kb_motivos_atraso (
  chave     text primary key,
  rotulo    text not null,
  variantes text[] not null default '{}',
  classe    text check (classe in ('reversivel','precisa_cliente','trocar_forma')),
  instrucao text,
  ordem     int  not null default 100,
  ativo     boolean not null default true
);
alter table public.kb_motivos_atraso enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='kb_motivos_atraso' and policyname='kb_motivos_atraso_read') then
    create policy kb_motivos_atraso_read on public.kb_motivos_atraso for select to authenticated using (public.crm_autorizado());
  end if;
  if not exists (select 1 from pg_policies where tablename='kb_motivos_atraso' and policyname='kb_motivos_atraso_write') then
    create policy kb_motivos_atraso_write on public.kb_motivos_atraso for all to authenticated using (public.lp_sou_admin()) with check (public.lp_sou_admin());
  end if;
end $$;
revoke all on public.kb_motivos_atraso from anon;
grant select on public.kb_motivos_atraso to authenticated;

insert into public.kb_motivos_atraso (chave, rotulo, variantes, classe, instrucao, ordem) values
 ('limite_insuficiente','Limite insuficiente', array['limite insuficiente'],'reversivel','Pedir pro cliente liberar limite ou trocar o dia/cartão · nova tentativa automática',10),
 ('cartao_expirado','Dados do cartão expirados/bloqueados', array['dados do cartao expirados','cartao expirado','expirados/bloqueados','expirado/bloqueado'],'precisa_cliente','Pedir novo cartão pelo link de troca · 2 min no app do cliente',20),
 ('suspeita_fraude','Suspeita de fraude', array['suspeita de fraude'],'precisa_cliente','Cliente libera a transação com o banco e autoriza nova tentativa · ou troca o cartão',30),
 ('transacao_nao_autorizada','Transação não autorizada', array['transacao nao autorizada'],'precisa_cliente','Cliente autoriza no banco ou troca a forma de pagamento',40),
 ('cobranca_rejeitada','Cobrança rejeitada', array['cobranca rejeitada'],'reversivel','Solicitar nova cobrança · conferir dados do cartão',50),
 ('debito_recadastrar','Débito não efetuado · reativar/recadastrar convênio', array['recadastrar convenio','reativar/recadastrar'],'reversivel','Cliente reativa/recadastra o convênio no app do banco (Serviços → Débito automático → Prudential)',60),
 ('debito_nao_autorizado','Débito não efetuado · não autorizado', array['debito nao autorizado'],'reversivel','Cliente autoriza o débito no banco · ou troca a forma',70),
 ('debito_sem_fundos','Débito não efetuado · insuficiência de fundos', array['insuficiencia de fundos'],'reversivel','Garantir saldo no dia · nova tentativa',80),
 ('debito_sem_contrato','Débito não efetuado · sem contrato de débito automático', array['sem contrato de debito'],'trocar_forma','Cadastrar o débito no banco ou trocar para cartão',90),
 ('debito_trocar_forma','Débito não efetuado · sugerimos alterar forma de pagamento', array['debito nao efetuado - sugerimos alt','debito nao efetuado sugerimos alt'],'trocar_forma','Trocar para cartão ou boleto',100),
 ('debito_cancelado','Débito cancelado pelo correntista / conta inválida', array['debito cancelado','conta corrente invalida'],'trocar_forma','Recadastrar conta (agência/dígito) ou trocar a forma',110),
 ('boleto_sem_retorno','Boleto sem retorno de pagamento', array['boleto sem retorno'],'reversivel','Reenviar 2ª via · confirmar se pagou',120),
 ('outro','Sem motivo informado', '{}', null, null, 999)
on conflict (chave) do update set rotulo=excluded.rotulo, variantes=excluded.variantes, classe=excluded.classe,
  instrucao=excluded.instrucao, ordem=excluded.ordem;

-- 2) funções (únicas). minúsculas + sem acento + espaços colapsados; sufixos "/ há cobranças…", "(rp)", "(rt)", "(reversível)" não mudam a chave
create or replace function public.fn_texto_motivo(t text) returns text language sql immutable as $$
  select btrim(regexp_replace(lower(extensions.unaccent(coalesce(t,''))), '\s+', ' ', 'g')) $$;

create or replace function public.fn_normalizar_motivo_atraso(t text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((
    select m.chave from public.kb_motivos_atraso m
     where m.ativo and m.chave <> 'outro'
       and exists (select 1 from unnest(m.variantes) v where public.fn_texto_motivo(t) like '%' || v || '%')
     order by m.ordem limit 1), 'outro') $$;

create or replace function public.fn_normalizar_forma_pagto(t text) returns text language sql immutable as $$
  select case when public.fn_texto_motivo(t) like '%cart%'   then 'cartao'
              when public.fn_texto_motivo(t) like '%debito%' then 'debito'
              when public.fn_texto_motivo(t) like '%boleto%' then 'boleto'
              else 'outro' end $$;
grant execute on function public.fn_normalizar_motivo_atraso(text), public.fn_normalizar_forma_pagto(text), public.fn_texto_motivo(text) to authenticated;

-- 3) colunas derivadas + gatilho (recalcula a cada insert/update do bruto)
alter table public.vendas_atrasos add column if not exists motivo_chave text;
alter table public.vendas_atrasos add column if not exists forma_norm text;

create or replace function public.trg_atraso_normalizar() returns trigger language plpgsql as $$
begin
  new.motivo_chave := public.fn_normalizar_motivo_atraso(new.motivo_recusa);
  new.forma_norm   := public.fn_normalizar_forma_pagto(new.forma_pagto);
  return new;
end $$;
create or replace trigger trg_atraso_normalizar before insert or update of motivo_recusa, forma_pagto on public.vendas_atrasos
  for each row execute function public.trg_atraso_normalizar();

-- backfill (só onde mudou — rodar de novo não toca em nada)
update public.vendas_atrasos
   set motivo_chave = public.fn_normalizar_motivo_atraso(motivo_recusa),
       forma_norm   = public.fn_normalizar_forma_pagto(forma_pagto)
 where motivo_chave is distinct from public.fn_normalizar_motivo_atraso(motivo_recusa)
    or forma_norm   is distinct from public.fn_normalizar_forma_pagto(forma_pagto);

-- 4) kb_scripts_cobranca.motivo_normalizado → chaves novas (motivo_variantes fica por compatibilidade: o app ainda casa por elas)
update public.kb_scripts_cobranca set motivo_normalizado = public.fn_normalizar_motivo_atraso(coalesce(motivo_variantes[1], motivo_normalizado))
 where motivo_normalizado not in (select chave from public.kb_motivos_atraso);
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'kb_scripts_cobranca_motivo_fk') then
    alter table public.kb_scripts_cobranca add constraint kb_scripts_cobranca_motivo_fk
      foreign key (motivo_normalizado) references public.kb_motivos_atraso(chave) on update cascade;
  end if;
end $$;
