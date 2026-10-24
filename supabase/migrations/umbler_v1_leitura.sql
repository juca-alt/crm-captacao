-- UMBLER-V1 · LEITURA (23/10/2026) — o CRM LÊ TODAS as conversas do Umbler Talk (API + webhook).
-- ENVIO: nunca daqui. Resposta ao cliente é sempre humana (Gustavo/Victor aprovam e enviam). Nenhuma função
-- deste módulo chama POST /v1/messages. As tabelas só recebem escrita do servidor (service role, Edge Functions
-- `umbler`: cron + webhook + botão); o app só LÊ, filtrado por dono (dono + delegados via lp_donos_visiveis()).
-- Idempotente. Rodada pelo MCP do Supabase em 23/10/2026.

-- 1) conversas (1 linha por chat do Talk)
create table if not exists public.umbler_chats (
  id                text primary key,              -- id do chat no Talk
  dono              text not null,                 -- e-mail do dono da conta Umbler (RLS)
  org_id            text,
  contato_id        text,
  contato_nome      text,
  contato_tel       text,                          -- como veio
  contato_tel_norm  text,                          -- só dígitos (casar com o contato do CRM)
  canal             text,
  setor             text,
  atendente         text,
  etiquetas         text[] not null default '{}',
  aberto            boolean,
  aguardando        boolean,
  aguardando_desde  timestamptz,
  nao_lidas         int,
  ultima_msg_em     timestamptz,
  ultima_msg_de     text,                          -- cliente | nos | bot | externo
  ultima_msg_previa text,
  criado_em         timestamptz,
  fechado_em        timestamptz,
  msgs_ate          timestamptz,                   -- mensagem mais nova já lida
  msgs_desde        timestamptz,                   -- mensagem mais antiga já lida
  historico_completo boolean not null default false,
  sincronizado_em   timestamptz not null default now(),
  bruto             jsonb
);
create index if not exists umbler_chats_dono_ult on public.umbler_chats (dono, ultima_msg_em desc);
create index if not exists umbler_chats_tel on public.umbler_chats (contato_tel_norm);

-- 2) mensagens (todas, dos dois lados)
create table if not exists public.umbler_mensagens (
  id            text primary key,                  -- id da mensagem no Talk
  chat_id       text not null,                     -- sem FK: o webhook pode chegar antes do chat
  dono          text not null,
  de            text not null default 'externo' check (de in ('cliente','nos','bot','externo')),
  tipo          text,                              -- Text, Image, Audio, File…
  texto         text,
  arquivo_nome  text,
  arquivo_url   text,
  autor         text,                              -- atendente que enviou (quando é nosso)
  enviada_em    timestamptz,
  estado        text,
  privada       boolean not null default false,    -- nota interna do Talk
  bruto         jsonb,
  lida_em       timestamptz not null default now()
);
create index if not exists umbler_msg_chat_t on public.umbler_mensagens (chat_id, enviada_em desc);
create index if not exists umbler_msg_dono_t on public.umbler_mensagens (dono, enviada_em desc);

-- 3) eventos crus do webhook (formato do payload não é documentado → guarda tudo, parseia na defensiva)
create table if not exists public.umbler_eventos (
  id          bigint generated always as identity primary key,
  recebido_em timestamptz not null default now(),
  dono        text not null,
  tipo        text,
  chat_id     text,
  processado  boolean not null default false,
  erro        text,
  bruto       jsonb
);
create index if not exists umbler_eventos_t on public.umbler_eventos (recebido_em desc);

-- 4) estado da sincronização (1 linha por dono; sem segredo aqui — token e chaves ficam nos secrets das Functions)
create table if not exists public.umbler_estado (
  dono           text primary key,
  org_id         text,
  org_nome       text,
  ultimo_sync    timestamptz,
  ultimo_ok      timestamptz,
  ultimo_erro    text,
  lista_completa boolean not null default false,  -- já passou por TODOS os chats uma vez
  lista_skip     int not null default 0,          -- cursor da varredura completa
  stats          jsonb not null default '{}'::jsonb,
  atualizado_em  timestamptz not null default now()
);
insert into public.umbler_estado (dono) values ('juca@segurocomjuca.com') on conflict (dono) do nothing;

-- 5) RLS: SÓ leitura pelo app, por dono. Escrita: só service role (Edge Functions). Anônimo: nada.
do $$
declare t text;
begin
  foreach t in array array['umbler_chats','umbler_mensagens','umbler_estado'] loop
    execute format('alter table public.%I enable row level security', t);
    if not exists (select 1 from pg_policies where tablename=t and policyname=t||'_ler') then
      execute format('create policy %I on public.%I for select to authenticated using (dono in (select public.lp_donos_visiveis()))', t||'_ler', t);
    end if;
    execute format('revoke all on public.%I from anon', t);
    execute format('revoke insert, update, delete on public.%I from authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
  end loop;
end $$;
alter table public.umbler_eventos enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where tablename='umbler_eventos' and policyname='umbler_eventos_admin') then
    create policy umbler_eventos_admin on public.umbler_eventos for select to authenticated using (public.lp_sou_admin());
  end if;
end $$;
revoke all on public.umbler_eventos from anon;
revoke insert, update, delete on public.umbler_eventos from authenticated;
grant select on public.umbler_eventos to authenticated;

-- 6) chaves do cron e do webhook: geradas no Vault (vault.create_secret, nomes 'umbler_cron_chave' e
--    'umbler_webhook_chave'; os VALORES nunca entram no repo). A Function confere por esta RPC, só service_role.
create or replace function public.umbler_chave_ok(p_nome text, p_chave text) returns boolean
language sql stable security definer set search_path = public, vault as $$
  select p_nome in ('umbler_cron_chave','umbler_webhook_chave') and coalesce(length(p_chave),0) >= 32
     and exists (select 1 from vault.decrypted_secrets where name = p_nome and decrypted_secret = p_chave) $$;
revoke all on function public.umbler_chave_ok(text,text) from public, anon, authenticated;
grant execute on function public.umbler_chave_ok(text,text) to service_role;

-- 7) agendamento: a cada 10 min o pg_cron chama a Edge Function `umbler` (pg_net). A chave do cron fica no Vault
--    (nome 'umbler_cron_chave') e a Function confere com umbler_chave_ok() (abaixo). Sem token do Umbler,
--    a função responde "sem_token" e não faz nada.
create extension if not exists pg_net;
do $$ begin
  if exists (select 1 from cron.job where jobname='umbler-sync') then perform cron.unschedule('umbler-sync'); end if;
  perform cron.schedule('umbler-sync', '*/10 * * * *', $job$
    select net.http_post(
      url := 'https://cjieobmdpqcupzdpckef.supabase.co/functions/v1/umbler',
      headers := jsonb_build_object('Content-Type','application/json',
                 'x-cron-chave', (select decrypted_secret from vault.decrypted_secrets where name='umbler_cron_chave')),
      body := '{"modo":"cron"}'::jsonb,
      timeout_milliseconds := 5000)
  $job$);
end $$;
