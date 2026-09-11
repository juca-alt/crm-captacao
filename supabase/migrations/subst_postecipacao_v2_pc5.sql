-- PC-5: view subst_postecipacao idempotente com proxima cobranca (motor canonico = vendas.html pc*)
-- Ciclo 31 ancorado no dia da emissao. posicao = ((dia - emissao) mod 31) + 1; postecipado = pos 1..16.
-- melhor_dia = ((emissao + 14) mod 31) + 1  (20->4, 30->14, 31->15). Sem "+1 fim-de-mes".
-- proxima_cobranca: mes ancora = mes do venc em aberto; dia > melhor -> mes ancora, senao mes seguinte;
-- dia inexistente no mes alvo -> NULL (indisponivel). ganho_dias = prox(melhor) - prox(dia_atual).
-- Reexecutavel: CREATE OR REPLACE (colunas antigas preservadas na mesma ordem, novas so no fim).

create or replace function public.pc_melhor_dia(emissao date)
returns integer language sql immutable as $$
  select case when emissao is null then null
              else ((extract(day from emissao)::int + 14) % 31) + 1 end
$$;

create or replace function public.pc_proxima_cobranca(dia integer, emissao date, venc_aberto date)
returns date language sql immutable as $$
  with p as (
    select pc_melhor_dia(emissao) as melhor,
           date_trunc('month', venc_aberto)::date as m0
  ), alvo as (
    select case when dia > melhor then m0 else (m0 + interval '1 month')::date end as m1 from p
  )
  select case
           when dia is null or emissao is null or venc_aberto is null or dia < 1 or dia > 31 then null
           when dia > extract(day from (m1 + interval '1 month' - interval '1 day'))::int then null
           else m1 + (dia - 1)
         end
  from alvo
$$;

create or replace view public.subst_postecipacao as
 WITH cli AS (
         SELECT subst_apolices.cli_ref,
            subst_apolices.lp_email,
            COALESCE(max(subst_apolices.emissao) FILTER (WHERE subst_apolices.papel = 'gatilho'::text), max(subst_apolices.emissao)) AS emis_gatilho
           FROM subst_apolices
          GROUP BY subst_apolices.cli_ref, subst_apolices.lp_email
        )
 SELECT a.id,
    a.lp_email,
    a.cli_ref,
    c.nome AS cliente,
    a.numero,
    a.papel,
    a.emissao,
    a.dia AS dia_venc,
    a.venc_aberto,
    a.premio,
    a.forma,
        CASE
            WHEN a.emissao IS NULL OR a.dia IS NULL THEN NULL::integer
            ELSE (a.dia - EXTRACT(day FROM a.emissao)::integer + 31) % 31
        END AS off_dias,
        CASE
            WHEN a.emissao IS NULL OR a.dia IS NULL THEN NULL::text
            WHEN ((a.dia - EXTRACT(day FROM a.emissao)::integer + 31) % 31) <= 15 THEN 'postecipado'::text
            ELSE 'antecipado'::text
        END AS pgto_situacao,
    pc_melhor_dia(a.emissao) AS melhor_dia,
        CASE
            WHEN a.emissao IS NULL OR a.dia IS NULL THEN NULL::integer
            ELSE GREATEST(0, 15 - (a.dia - EXTRACT(day FROM a.emissao)::integer + 31) % 31)
        END AS margem_float_dias,
    a.venc_aberto + 59 AS suspende_em,
    a.venc_aberto + 59 - CURRENT_DATE AS dias_ate_suspender,
    cli.emis_gatilho,
    cli.emis_gatilho + 180 AS data_segura,
    cli.emis_gatilho + 180 - CURRENT_DATE AS dias_ate_liberar,
    cli.emis_gatilho + 180 - (a.venc_aberto + 59) AS gap_susp_x_seguro,
        CASE
            WHEN cli.emis_gatilho IS NULL OR a.venc_aberto IS NULL OR a.emissao IS NULL OR a.dia IS NULL THEN 'dados_incompletos'::text
            WHEN CURRENT_DATE > (cli.emis_gatilho + 180) THEN 'liberado'::text
            WHEN CURRENT_DATE > (a.venc_aberto + 59) THEN 'suspensa'::text
            WHEN (a.venc_aberto + 59) >= (cli.emis_gatilho + 180) THEN 'aguardar'::text
            ELSE 'resetar'::text
        END AS veredito,
        CASE
            WHEN a.venc_aberto IS NULL THEN 'sem_dado'::text
            WHEN (a.venc_aberto + 59 - CURRENT_DATE) < 0 THEN 'suspensa'::text
            WHEN (a.venc_aberto + 59 - CURRENT_DATE) <= 7 THEN 'critico'::text
            WHEN (a.venc_aberto + 59 - CURRENT_DATE) <= 15 THEN 'atencao'::text
            WHEN (a.venc_aberto + 59 - CURRENT_DATE) <= 30 THEN 'planejar'::text
            ELSE 'tranquilo'::text
        END AS semaforo,
    -- PC-5 (novas, no fim):
        CASE WHEN a.emissao IS NULL OR a.dia IS NULL THEN NULL::integer
             ELSE ((a.dia - EXTRACT(day FROM a.emissao)::integer + 31) % 31) + 1 END AS posicao,
    pc_proxima_cobranca(a.dia, a.emissao, a.venc_aberto) AS proxima_cobranca,
    pc_proxima_cobranca(pc_melhor_dia(a.emissao), a.emissao, a.venc_aberto) AS proxima_cobranca_melhor,
    (pc_proxima_cobranca(pc_melhor_dia(a.emissao), a.emissao, a.venc_aberto)
       - pc_proxima_cobranca(a.dia, a.emissao, a.venc_aberto)) AS ganho_dias
   FROM subst_apolices a
     JOIN cli ON cli.cli_ref = a.cli_ref AND cli.lp_email = a.lp_email
     LEFT JOIN subst_clientes c ON c.ref = a.cli_ref AND c.lp_email = a.lp_email;
