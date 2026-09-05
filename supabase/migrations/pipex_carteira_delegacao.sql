-- Pipe X (04/09/2026): a carteira passa a seguir a MESMA regra das tabelas de emissão —
-- visível pro dono e pra quem ele delegou (lp_donos_visiveis). O app grava só as linhas
-- do próprio dono (cartPersistRemoto filtra por _dono). Aplicado no playground em 04/09.
drop policy if exists carteira_clientes_dono on public.carteira_clientes;
create policy carteira_clientes_dono on public.carteira_clientes
  for all using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
drop policy if exists carteira_apolices_dono on public.carteira_apolices;
create policy carteira_apolices_dono on public.carteira_apolices
  for all using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
-- delegação Daniel → Gustavo (admin da MFB vê a carteira do LP no escopo Pipe X): feita por SQL, sem e-mail no repo.
-- rollback: recriar as políticas com (dono = auth.jwt()->>'email') e apagar a linha de lp_delegacoes.
