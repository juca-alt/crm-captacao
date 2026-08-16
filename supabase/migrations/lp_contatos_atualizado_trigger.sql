-- ═══════════════════════════════════════════════════════════════════════════
-- lp_contatos.atualizado passa a marcar a ÚLTIMA MUDANÇA, não a criação
--
-- POR QUE ISTO EXISTE
-- O boot do app baixa a Base de Nomes inteira toda vez: 5.135 linhas, 3,09 MB.
-- Desde a v0.11.0 isso saiu do caminho crítico (chega em segundo plano,
-- paginado), mas o volume continua o mesmo — e no celular do Gustavo isso é
-- franquia de dados e bateria, toda abertura.
--
-- O corte natural seria pedir só o que mudou desde o último sync:
--     .gt('atualizado', <carimbo do último sync bem-sucedido>)
--
-- Só que hoje a coluna `atualizado` tem DEFAULT now() e mais nada. DEFAULT só
-- vale no INSERT. O push do app faz upsert; quando a linha já existe, o UPDATE
-- não toca em `atualizado`, que fica congelado na data em que o nome ENTROU na
-- base. Um sync incremental sobre essa coluna simplesmente NÃO VERIA as
-- edições — nomes corrigidos, telefone novo, estágio mudado no aparelho ao
-- lado sumiriam em silêncio. É o tipo de defeito que apaga trabalho sem avisar,
-- então o incremental fica parado até esta migration rodar.
--
-- COMO RODAR (regra do projeto: migration é aplicada à mão no SQL editor)
--   1. Supabase → SQL Editor → cole este arquivo → Run.
--   2. Confira com a consulta do rodapé: `atualizado` tem que andar ao editar.
--   3. Me avise. Aí eu ligo o sync incremental no app, com carga completa como
--      fallback sempre que não houver carimbo, o carimbo for mais velho que a
--      linha mais antiga, ou a base local estiver vazia.
--
-- É SEGURO RODAR AGORA?
-- Sim, e não muda nada do comportamento atual: nenhuma linha é reescrita, só
-- passa a existir um gatilho que carimba a hora em toda alteração futura.
-- Enquanto o app não usar a coluna para filtrar, ela é apenas informação.
-- ═══════════════════════════════════════════════════════════════════════════

create or replace function public.tocar_atualizado()
returns trigger
language plpgsql
as $$
begin
  new.atualizado := now();
  return new;
end;
$$;

drop trigger if exists trg_lp_contatos_atualizado on public.lp_contatos;
create trigger trg_lp_contatos_atualizado
  before update on public.lp_contatos
  for each row execute function public.tocar_atualizado();

-- índice para o recorte incremental ficar barato quando ele entrar
create index if not exists idx_lp_contatos_dono_atualizado
  on public.lp_contatos (dono, atualizado desc);

-- ── conferência ────────────────────────────────────────────────────────────
-- Depois de rodar, edite qualquer nome no app e confirme que a coluna andou:
--
--   select id, atualizado
--   from public.lp_contatos
--   order by atualizado desc
--   limit 5;
--
-- Se `atualizado` continuar mostrando a data de criação, o gatilho não pegou.
