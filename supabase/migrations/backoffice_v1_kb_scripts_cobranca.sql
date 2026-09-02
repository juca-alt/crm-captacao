-- BACKOFFICE V1 (02/09/2026) · Entrega 5 — biblioteca de scripts de cobranca (estrutura; textos oficiais entram depois).
create table if not exists public.kb_scripts_cobranca (
  id                  uuid primary key default gen_random_uuid(),
  motivo_normalizado  text not null unique,
  motivo_variantes    text[],
  script              text not null,
  canal               text default 'whatsapp',
  ativo               boolean default true,
  atualizado_em       timestamptz default now()
);
alter table public.kb_scripts_cobranca enable row level security;
drop policy if exists kb_scripts_cobranca_read on public.kb_scripts_cobranca;
create policy kb_scripts_cobranca_read on public.kb_scripts_cobranca for select to authenticated using (true);
drop policy if exists kb_scripts_cobranca_write on public.kb_scripts_cobranca;
create policy kb_scripts_cobranca_write on public.kb_scripts_cobranca for all to authenticated using (true) with check (true);
-- Os 3 motivos orfaos do relatorio de 02/09, com o MOLDE que ja funciona na operacao.
-- ativo=false ate o Gustavo trazer o texto oficial da assessoria.
insert into public.kb_scripts_cobranca (motivo_normalizado, motivo_variantes, script, ativo) values
 ('suspeita de fraude transacao rejeitada pelo banco emissor',
  array['Suspeita De Fraude - Transação Rejeitada Pelo Banco Emissor'],
  E'*Seguradora:* Prudential\n*Segurado:* {segurado}\n*Apólice:* {apolice}\n*Venc:* {venc}\n*Dias de Atraso:* {dias}\n*R$:* {valor}\n*Forma de Pagamento:* {forma}\n\nQual dessas opções fica melhor p/ você?\n1️⃣ Alterar p/ *Cartão de Crédito*; 💳\n2️⃣ Alterar p/ *Débito em Conta*; 🏦\n3️⃣ Gerar novo *Boleto*; 🧾', false),
 ('debito nao efetuado sem contrato de debito automatico',
  array['Débito Não Efetuado - Sem Contrato De Débito Automático'],
  E'*Seguradora:* Prudential\n*Segurado:* {segurado}\n*Apólice:* {apolice}\n*Venc:* {venc}\n*Dias de Atraso:* {dias}\n*R$:* {valor}\n*Forma de Pagamento:* {forma}\n\nQual dessas opções fica melhor p/ você?\n1️⃣ Alterar p/ *Cartão de Crédito*; 💳\n2️⃣ Alterar p/ *Débito em Conta*; 🏦\n3️⃣ Gerar novo *Boleto*; 🧾', false),
 ('debito nao efetuado sugerimos alt de forma de pagamento rp',
  array['Débito Não Efetuado - Sugerimos Alt. De Forma De Pagamento (RP)'],
  E'*Seguradora:* Prudential\n*Segurado:* {segurado}\n*Apólice:* {apolice}\n*Venc:* {venc}\n*Dias de Atraso:* {dias}\n*R$:* {valor}\n*Forma de Pagamento:* {forma}\n\nQual dessas opções fica melhor p/ você?\n1️⃣ Alterar p/ *Cartão de Crédito*; 💳\n2️⃣ Alterar p/ *Débito em Conta*; 🏦\n3️⃣ Gerar novo *Boleto*; 🧾', false)
on conflict (motivo_normalizado) do nothing;
