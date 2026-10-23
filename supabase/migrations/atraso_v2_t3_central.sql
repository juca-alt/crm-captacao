-- ATRASO-V2 · T3 (23/10/2026) — Central de Importações + defeito do rodapé do PDF no relatório de atraso. Idempotente.

-- 1) log de importação com descarte e diff (novas / saíram). Linhas antigas ficam null = "não medido".
alter table public.rel_importacoes add column if not exists descartadas int;
alter table public.rel_importacoes add column if not exists novas int;
alter table public.rel_importacoes add column if not exists sairam int;

-- 2) registro-lixo: o rodapé "Life Planner é a marca registrada…" (e o cabeçalho da página seguinte) grudou em campos de
--    2 apólices REAIS (já resolvidas). Não apaga a apólice (perderia o histórico): limpa só o campo contaminado.
--    O parser agora corta o bloco no rodapé e descarta o que sobrar (vendas.html, atParseOficial).
update public.vendas_atrasos set
  forma_pagto   = case when forma_pagto   ilike '%marca registrada%' then null else forma_pagto end,
  motivo_recusa = case when motivo_recusa ilike '%marca registrada%' then null else motivo_recusa end,
  segurado      = case when segurado      ilike '%marca registrada%' then '' else segurado end,
  resp_pagto    = case when resp_pagto    ilike '%marca registrada%' then null else resp_pagto end
where concat_ws(' ', forma_pagto, motivo_recusa, segurado, resp_pagto) ilike '%marca registrada%';
