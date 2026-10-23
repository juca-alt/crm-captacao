-- UW & EMISSÃO · T1 (23/10/2026) — Lote Global 1 · Parte B. Colunas da esteira proposta → emissão → entrega e do PLACED por
-- período. Só ACRESCENTA (nada é apagado ou renomeado). Idempotente: "add column if not exists" pula a coluna inteira
-- (com o check) quando ela já existe; o cfg.periodo só é gravado onde ainda não há.

-- Pendências: 1ª parcela (CCB) e o "não conta" do Placed
alter table public.emissao_pendencias add column if not exists ccb_quitada_em date;
alter table public.emissao_pendencias add column if not exists nao_conta boolean not null default false;
alter table public.emissao_pendencias add column if not exists nao_conta_motivo text
  check (nao_conta_motivo in ('mpp','sem_mqc','divisao_comissao','outro'));

-- Emitidas: 2ª parcela, entrega, "sumiu do relatório → desfecho" (espelho das pendências) e o "não conta"
alter table public.emissao_emitidas add column if not exists segunda_parcela_em date;
alter table public.emissao_emitidas add column if not exists entrega_status text not null default 'sem_entrega'
  check (entrega_status in ('sem_entrega','pronta','entregue'));
alter table public.emissao_emitidas add column if not exists entrega_em date;
alter table public.emissao_emitidas add column if not exists entrega_modo text
  check (entrega_modo in ('presencial','whatsapp','video','correio'));
alter table public.emissao_emitidas add column if not exists entrega_obs text;
alter table public.emissao_emitidas add column if not exists saiu_do_relatorio_em timestamptz;
alter table public.emissao_emitidas add column if not exists desfecho text
  check (desfecho in ('cancelada','not_taken','continua_ativa','reabilitada'));
alter table public.emissao_emitidas add column if not exists desfecho_em date;
alter table public.emissao_emitidas add column if not exists nao_conta boolean not null default false;
alter table public.emissao_emitidas add column if not exists nao_conta_motivo text
  check (nao_conta_motivo in ('mpp','sem_mqc','divisao_comissao','outro'));

-- PLACED: período de apuração no cfg (merge — não apaga lag/alto/baixo/janela/leitura/meses). Período = o que contém hoje:
-- 01/11/A–31/10/A+1, emissão aceita até 31/01/A+2. O motor recalcula pela data de hoje; este valor é a referência gravada.
update public.placed_estado p
   set dados = jsonb_set(coalesce(p.dados,'{}'::jsonb), '{cfg,periodo}', jsonb_build_object(
         'inicio',      make_date(a.ini, 11, 1)::text,
         'fim',         make_date(a.ini + 1, 10, 31)::text,
         'emissao_ate', make_date(a.ini + 2, 1, 31)::text), true)
  from (select case when extract(month from current_date) >= 11 then extract(year from current_date)::int
                    else extract(year from current_date)::int - 1 end as ini) a
 where p.dados ? 'cfg' and not (p.dados->'cfg' ? 'periodo');
