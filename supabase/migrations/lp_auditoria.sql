-- LP-AUDITORIA-V1 (29/09/2026) -- pedido: "pode tudo, mas fica os registros".
-- O Victor (delegado) continua lendo e escrevendo nas bases do Gustavo e do Daniel.
-- O que muda: (1) trilha de quem mexeu na base de OUTRO dono (e todo DELETE);
-- (2) solicitacoes guarda o e-mail de quem criou; eventos guardam o e-mail do autor;
-- (3) evento de solicitacao sempre com o dono da solicitacao-pai;
-- (4) dono (lp_email) da solicitacao nao troca em UPDATE, a nao ser pelo admin.
-- ASCII puro de proposito (SQL Editor).

create table if not exists public.lp_auditoria (
  id          bigserial primary key,
  em          timestamptz not null default now(),
  email       text,
  tabela      text not null,
  registro_id text,
  op          text not null,
  dono        text,
  campos      text[]
);
create index if not exists lp_auditoria_dono_em on public.lp_auditoria (dono, em desc);
alter table public.lp_auditoria enable row level security;
drop policy if exists lp_auditoria_ler on public.lp_auditoria;
create policy lp_auditoria_ler on public.lp_auditoria for select
  using (public.crm_autorizado() and (dono in (select public.lp_donos_visiveis()) or email = (auth.jwt()->>'email')));
-- sem policy de insert/update/delete: so o trigger (security definer) escreve; ninguem apaga pelo app

create or replace function public.lp_audita() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_email text := coalesce(auth.jwt()->>'email', 'sistema');
  v_new jsonb; v_old jsonb; v_dono text; v_id text; v_campos text[];
begin
  if TG_OP <> 'DELETE' then v_new := to_jsonb(NEW); end if;
  if TG_OP <> 'INSERT' then v_old := to_jsonb(OLD); end if;
  if TG_TABLE_NAME = 'lp_contatos' then
    v_dono := coalesce(v_new->>'dono', v_old->>'dono');
    v_new := v_new->'dados'; v_old := v_old->'dados';
  else
    v_dono := coalesce(v_new->>'lp_email', v_old->>'lp_email');
  end if;
  v_id := coalesce(to_jsonb(NEW)->>'id', to_jsonb(OLD)->>'id');
  -- so registra acao na base de OUTRO dono, ou qualquer DELETE
  if TG_OP <> 'DELETE' and v_email = coalesce(v_dono, '') then return null; end if;
  select array_agg(k order by k) into v_campos from (
    select coalesce(n.key, o.key) k
    from jsonb_each(coalesce(v_new, '{}'::jsonb)) n
    full outer join jsonb_each(coalesce(v_old, '{}'::jsonb)) o on o.key = n.key
    where n.value is distinct from o.value
      and coalesce(n.key, o.key) not in ('_upd', 'atualizado', 'ord', 'ultimo_toque_em')
  ) x;
  if TG_OP = 'UPDATE' and v_campos is null then return null; end if;   -- upsert sem mudanca real
  insert into public.lp_auditoria (email, tabela, registro_id, op, dono, campos)
  values (v_email, TG_TABLE_NAME, v_id, TG_OP, v_dono, case when TG_OP = 'UPDATE' then v_campos else null end);
  return null;
end $$;

drop trigger if exists trg_z_audita on public.lp_contatos;
create trigger trg_z_audita after insert or update or delete on public.lp_contatos
  for each row execute function public.lp_audita();
drop trigger if exists trg_z_audita on public.solicitacoes;
create trigger trg_z_audita after insert or update or delete on public.solicitacoes
  for each row execute function public.lp_audita();
drop trigger if exists trg_z_audita on public.solicitacao_eventos;
create trigger trg_z_audita after insert or update or delete on public.solicitacao_eventos
  for each row execute function public.lp_audita();

-- quem criou / quem escreveu (o app nao manda: vem do login)
alter table public.solicitacoes add column if not exists criado_por_email text default (auth.jwt()->>'email');
alter table public.solicitacao_eventos add column if not exists autor_email text default (auth.jwt()->>'email');

-- evento sempre com o dono da solicitacao-pai
create or replace function public.lp_so_evento_dono() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dono text;
begin
  select lp_email into v_dono from public.solicitacoes where id = NEW.solicitacao_id;
  if v_dono is not null then NEW.lp_email := v_dono; end if;
  return NEW;
end $$;
drop trigger if exists trg_so_evento_dono on public.solicitacao_eventos;
create trigger trg_so_evento_dono before insert or update on public.solicitacao_eventos
  for each row execute function public.lp_so_evento_dono();

-- dono da solicitacao nao troca em UPDATE (so o admin)
create or replace function public.lp_so_dono_fixo() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if NEW.lp_email is distinct from OLD.lp_email
     and not exists (select 1 from public.lp_perfis where lower(email) = lower(coalesce(auth.jwt()->>'email', '')) and papel = 'admin')
     and auth.jwt() is not null then
    NEW.lp_email := OLD.lp_email;
  end if;
  return NEW;
end $$;
drop trigger if exists trg_so_dono_fixo on public.solicitacoes;
create trigger trg_so_dono_fixo before update on public.solicitacoes
  for each row execute function public.lp_so_dono_fixo();
