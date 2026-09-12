-- placed_estado: mesma RLS por dono + delegacao das demais tabelas por pessoa (lp_donos_visiveis). Aplicada 12/09/2026.
drop policy if exists placed_estado_dono on public.placed_estado;
create policy placed_estado_dono on public.placed_estado for all to authenticated
  using (dono in (select lp_donos_visiveis())) with check (dono in (select lp_donos_visiveis()));
