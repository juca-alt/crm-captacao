-- COPILOTO-V1 (23/10/2026) — log das sugestões do copiloto de resposta (extensão WhatsApp/Umbler 2.10.0).
-- Pra calibrar o prompt depois: categoria, rascunho, ação e se o humano usou. NÃO guarda o texto da conversa.
-- RLS no mesmo padrão das lp_*: dono (ou delegado do dono) vê e grava. Idempotente: rodar 2× dá o mesmo schema.
create table if not exists public.copiloto_sugestoes (
  id              uuid primary key default gen_random_uuid(),
  criado_em       timestamptz not null default now(),
  dono            text not null default (auth.jwt()->>'email'),
  contato_id      text null,
  categoria       text,
  precisa_gustavo boolean,
  rascunho        text,
  acao_crm        jsonb,
  usado           boolean not null default false,
  latencia_ms     int,
  modelo          text
);
create index if not exists copiloto_sugestoes_dono_idx on public.copiloto_sugestoes (dono, criado_em desc);

alter table public.copiloto_sugestoes enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'copiloto_sugestoes' and policyname = 'copiloto_dono') then
    create policy copiloto_dono on public.copiloto_sugestoes for all to authenticated
      using (dono in (select public.lp_donos_visiveis()))
      with check (dono in (select public.lp_donos_visiveis()));
  end if;
end $$;
revoke all on public.copiloto_sugestoes from anon;
grant select, insert, update on public.copiloto_sugestoes to authenticated;
-- sem DELETE pra ninguém pelo app: o log é pra calibrar, não se apaga pela extensão.

-- Config editável pelo Gustavo (texto livre). Vazia = o rascunho de agendamento pergunta dia/turno.
insert into public.app_settings (chave, valor)
values ('copiloto_config', jsonb_build_object('janelas_agenda', ''))
on conflict (chave) do nothing;
