-- EMISSAO-FIX-IDENTIDADE (03/09/2026): chave de upsert = coalesce(proposta, apolice).
-- Aditiva/idempotente. Aplicada no playground cjieobmdpqcupzdpckef.
-- 1) proposta pode faltar (relatorio traz so a apolice)
alter table public.emissao_pendencias alter column proposta drop not null;
-- 2) dedup da base atual: funde duplicatas por (lp_email, coalesce(proposta, apolice)),
--    preservando os campos mantidos a mao do registro MAIS RECENTE que os tiver.
with g as (
  select lp_email, coalesce(proposta, apolice) chave, array_agg(id order by atualizado_em desc nulls last, importado_em desc) ids
  from public.emissao_pendencias group by 1,2 having count(*)>1
), manual as (
  select g.lp_email, g.chave, g.ids[1] keep,
    (select pendencia_descricao from public.emissao_pendencias e where e.id=any(g.ids) and pendencia_descricao is not null order by atualizado_em desc limit 1) pendencia_descricao,
    (select bola_com            from public.emissao_pendencias e where e.id=any(g.ids) and bola_com is not null            order by atualizado_em desc limit 1) bola_com,
    (select status_tratativa    from public.emissao_pendencias e where e.id=any(g.ids) and status_tratativa is not null    order by atualizado_em desc limit 1) status_tratativa,
    (select ultima_acao         from public.emissao_pendencias e where e.id=any(g.ids) and ultima_acao is not null         order by atualizado_em desc limit 1) ultima_acao,
    (select proxima_acao        from public.emissao_pendencias e where e.id=any(g.ids) and proxima_acao is not null        order by atualizado_em desc limit 1) proxima_acao,
    (select protocolo           from public.emissao_pendencias e where e.id=any(g.ids) and protocolo is not null           order by atualizado_em desc limit 1) protocolo,
    (select observacao          from public.emissao_pendencias e where e.id=any(g.ids) and observacao is not null          order by atualizado_em desc limit 1) observacao
  from g
), upd as (
  update public.emissao_pendencias e set
    pendencia_descricao=coalesce(m.pendencia_descricao,e.pendencia_descricao), bola_com=coalesce(m.bola_com,e.bola_com),
    status_tratativa=coalesce(m.status_tratativa,e.status_tratativa), ultima_acao=coalesce(m.ultima_acao,e.ultima_acao),
    proxima_acao=coalesce(m.proxima_acao,e.proxima_acao), protocolo=coalesce(m.protocolo,e.protocolo), observacao=coalesce(m.observacao,e.observacao),
    saiu_do_relatorio_em=null
  from manual m where e.id=m.keep returning e.id
)
delete from public.emissao_pendencias e using g where e.lp_email=g.lp_email and coalesce(e.proposta,e.apolice)=g.chave and e.id<>g.ids[1];
-- 3) chave gerada + unicidade por dono; a antiga (lp_email, proposta) sai
alter table public.emissao_pendencias add column if not exists chave text generated always as (coalesce(proposta, apolice)) stored;
drop index if exists public.emissao_pendencias_dono_proposta_uidx;
create unique index if not exists emissao_pendencias_dono_chave_uidx on public.emissao_pendencias (lp_email, chave);
