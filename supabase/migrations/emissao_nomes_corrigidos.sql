-- 02/09/2026: nome corrigido a mao na ficha de emissao vence o relatorio nas colagens seguintes.
alter table public.emissao_pendencias add column if not exists nomes_corrigidos boolean default false;
