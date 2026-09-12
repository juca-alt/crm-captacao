-- 12/09/2026: a varredura das 2h acusou trg_touch_atualizado_em executavel por anon (funcao nova de 11/09). Aplicada.
revoke execute on function public.trg_touch_atualizado_em() from public, anon;
revoke execute on function public.lp_norm_lp_rotulo() from public, anon;
