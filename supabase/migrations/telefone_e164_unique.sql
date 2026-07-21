-- ============================================================================
--  Trava de telefone único (a "trava 2b" do lead_id_control.sql, L67-71) —
--  backstop de dedupe no BANCO para o canal WhatsApp.
--
--  Contexto 2026-07-21: a extensão "Captação · WhatsApp → CRM" usa o telefone
--  (telefone_e164) como chave natural do lead. O app e a extensão já deduplicam
--  ANTES do insert (findLeadMatch / findByPhone), mas sem UNIQUE no banco uma
--  escrita fora do fluxo ainda pode duplicar. Auditoria 2026-07-07: 6 telefones
--  repetidos impediam o índice — por isso o passo 2 fica comentado até zerar.
--
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
--  Idempotente: pode rodar mais de uma vez sem efeito colateral.
-- ============================================================================

-- ── 1) DIAGNÓSTICO (só leitura — rode primeiro) ──────────────────────────────
-- telefones duplicados hoje (cada linha = um telefone com 2+ leads):
select telefone_e164,
       count(*)                                   as n,
       array_agg(id || ' / ' || coalesce(codigo,'#'||id) || ' / ' || coalesce(nome,'?')
                 order by id)                     as leads
  from public.leads
 where telefone_e164 is not null and telefone_e164 <> ''
 group by 1 having count(*) > 1
 order by n desc, 1;

-- ── 2) RESOLUÇÃO — NÃO é SQL ─────────────────────────────────────────────────
-- Unifique cada par na tela "Duplicatas" do app (o merge preserva histórico,
-- timeline e o código PI do lead mantido). Critério sugerido: manter o lead de
-- menor id (PI mais antigo) e absorver os demais. NUNCA delete por SQL aqui —
-- delete cru perde lead_events e o rastro do PI.

-- ── 3) TRAVA (descomente e rode SÓ quando o passo 1 voltar ZERO linhas) ──────
-- create unique index if not exists leads_tel_e164_uq
--   on public.leads (telefone_e164)
--   where telefone_e164 is not null and telefone_e164 <> '';

-- ── 4) VERIFICAÇÃO (só leitura) ──────────────────────────────────────────────
-- o índice deve aparecer na lista de UNIQUEs da tabela:
select indexname, indexdef from pg_indexes
 where tablename = 'leads' and indexdef ilike '%unique%';
