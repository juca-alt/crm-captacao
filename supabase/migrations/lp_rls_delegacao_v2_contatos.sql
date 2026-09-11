-- RLS-UNIFICADA-V2 (10/09/2026, OK do Gustavo): lp_contatos / lp_interacoes / lp_sitplan passam a usar a MESMA
-- regra da carteira e do backoffice: dono OU delegado (lp_donos_visiveis(), 1 salto). Aplicada no playground.
-- Antes (reverter se precisar): USING/WITH CHECK (dono = auth.jwt()->>'email') nas 3 tabelas
--   (policies lp_contatos_dono, lpi_dono, lps_dono).
drop policy if exists lp_contatos_dono on public.lp_contatos;
create policy lp_contatos_dono on public.lp_contatos for all
  using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
drop policy if exists lpi_dono on public.lp_interacoes;
create policy lpi_dono on public.lp_interacoes for all
  using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
drop policy if exists lps_dono on public.lp_sitplan;
create policy lps_dono on public.lp_sitplan for all
  using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
