-- SYNC-ATUALIZADO-V1 (28/09/2026): o app puxa as mudancas dos outros aparelhos por `atualizado > ultima sincronizacao`
-- (SYNC-PUXA-V1), mas o upsert do app (e o PATCH do crm-mcp) nao mandam `atualizado` -> edicao nao mudava a data e o
-- outro aparelho nao via. Conferido 28/09: contatos editados hoje com `atualizado` de agosto.
-- Correcao na porta do banco: qualquer UPDATE que mude dados/dono marca atualizado = now() (relogio do servidor).
-- Roda por ultimo (ordem alfabetica: trg_norm_estagio, trg_norm_lp_rotulo, trg_toca_atualizado). Idempotente. ASCII-puro.

create or replace function public.lp_toca_atualizado() returns trigger language plpgsql as $$
begin
  if new.dados is distinct from old.dados or new.dono is distinct from old.dono then
    new.atualizado := now();
  end if;
  return new;
end $$;

drop trigger if exists trg_toca_atualizado on public.lp_contatos;
create trigger trg_toca_atualizado before update on public.lp_contatos
  for each row execute function public.lp_toca_atualizado();
