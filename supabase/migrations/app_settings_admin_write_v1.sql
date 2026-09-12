-- CFG-ADMIN-V1 (11/09/2026): app_settings (cfg do funil, dicionarios) e GLOBAL da unidade
-- -> leitura para autorizados, escrita so admin (lp_sou_admin()).
drop policy if exists crm_autorizado_all on public.app_settings;
create policy app_settings_read on public.app_settings for select to authenticated using (crm_autorizado());
create policy app_settings_admin_write on public.app_settings for all to authenticated using (lp_sou_admin()) with check (lp_sou_admin());
