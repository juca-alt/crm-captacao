-- BACKOFFICE V1 (02/09/2026) · Entrega 4 — dicionario de status de tratativa.
-- Tabela de consulta (compartilhada, mesmo padrao das kb_*): RLS ligado, leitura aberta a autenticados.
create table if not exists public.kb_status_tratativa (
  chave        text primary key,
  rotulo       text not null,
  significado  text not null,
  ordem        integer not null default 0,
  ativo        boolean not null default true
);
alter table public.kb_status_tratativa enable row level security;
drop policy if exists kb_status_tratativa_read on public.kb_status_tratativa;
create policy kb_status_tratativa_read on public.kb_status_tratativa for select to authenticated using (true);
insert into public.kb_status_tratativa (chave,rotulo,significado,ordem) values
 ('sem_tratativa','Sem tratativa','Ninguem tocou no caso ainda',1),
 ('aguardando_cliente','Aguardando cliente','Bola com o segurado ou com o responsavel pelo pagamento',2),
 ('aguardando_prudential','Aguardando Prudential','Alteracao ou protocolo dentro do prazo da seguradora',3),
 ('aguardando_lm','Aguardando assessoria','Pedido aberto, ainda sem retorno',4),
 ('ajuda_do_corretor','Ajuda do corretor','Precisa da intervencao do LP',5),
 ('gustavo_trata','Gustavo trata','Caso pessoal, ninguem mais contata',6),
 ('nao_contatar','Nao contatar','Trava explicita de contato',7),
 ('resolvido','Resolvido','Pago, emitido ou encerrado com motivo',8)
on conflict (chave) do update set rotulo=excluded.rotulo, significado=excluded.significado, ordem=excluded.ordem;
