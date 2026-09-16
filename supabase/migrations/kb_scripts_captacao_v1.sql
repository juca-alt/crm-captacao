-- REPERTORIO-V1 (16/09/2026) · T1 — biblioteca de scripts de RECOMENDAÇÃO pro Life Planner.
-- Espelha a kb_scripts_cobranca (mesma postura: leitura = crm_autorizado(), escrita = lp_sou_admin()).
-- IDEMPOTENTE: rodar 2x = mesmo resultado (create if not exists · drop/create policy · upsert por gatilho).
-- NÃO toca em kb_scripts_cobranca.
--
-- Chave = `gatilho` (a situação). `destino` diz pra QUEM o LP manda: pro lead ou pro recomendante (a ponte).
-- Placeholders: {primeiro_nome} e {recomendante} — resolvidos no app (repResolver). Texto entre [colchetes]
-- é horário que o LP completa antes de enviar; o app só destaca como pendente.

create table if not exists public.kb_scripts_captacao (
  id             uuid primary key default gen_random_uuid(),
  gatilho        text not null unique,
  rotulo         text not null,
  descricao      text,
  destino        text not null check (destino in ('lead','recomendante')),
  canal          text not null default 'whatsapp',
  script         text not null,
  ordem          int  default 0,
  ativo          boolean default true,
  criado_em      timestamptz default now(),
  atualizado_em  timestamptz default now()
);

alter table public.kb_scripts_captacao enable row level security;

drop policy if exists kb_scripts_captacao_read on public.kb_scripts_captacao;
create policy kb_scripts_captacao_read on public.kb_scripts_captacao
  for select to authenticated using (crm_autorizado());

drop policy if exists kb_scripts_captacao_write on public.kb_scripts_captacao;
create policy kb_scripts_captacao_write on public.kb_scripts_captacao
  for all to authenticated using (lp_sou_admin()) with check (lp_sou_admin());

-- Seed: os 5 scripts REAIS de produção (texto do Gustavo, 16/09/2026). Upsert por gatilho:
-- rodar de novo atualiza o texto sem duplicar linha.
insert into public.kb_scripts_captacao (gatilho, rotulo, descricao, destino, canal, script, ordem, ativo) values
('recem_indicado', 'Recém-indicado (1º contato)',
 'Primeira mensagem pra quem acabou de ser indicado e ainda não conhece o Jucá.',
 'lead', 'whatsapp',
$s$Olá {primeiro_nome}, tudo bem? Aqui é o Gustavo Jucá 👋

Não nos conhecemos ainda, mas o {recomendante} me pediu pra falar com você — e indicação de quem confia eu levo a sério.

É uma conversa rápida, uns 20 min, sem compromisso: eu te mostro como funciona e você decide com calma. Consigo [quinta 9h] ou [sábado 10h] — qual encaixa melhor?$s$, 1, true),

('quente_pediu_passo', 'Quente: pediu o próximo passo',
 'O lead está com energia de resolver e pediu o próximo passo — facilita e trava a agenda.',
 'lead', 'whatsapp',
$s${primeiro_nome}, boa! Já que você tá com energia de resolver, deixa eu facilitar 👇

Nossa conversa é rápida, uns 20 min. Você não prepara nada nem traz documento agora — sou eu te mostrando como fica sua proteção e você decidindo com calma.

Me diz o melhor: [amanhã 9h] ou [sábado 10h]? Já travo na agenda e te mando o link 🙌$s$, 2, true),

('so_texto', 'Só quer texto / não atende ligação',
 'Pessoa que não atende ligação e prefere resolver por mensagem. Seleção manual — não é auto-detectado.',
 'lead', 'whatsapp',
$s${primeiro_nome}, fechado — fazemos do seu jeito 👊

O {recomendante} me pediu pra te mostrar uma coisa que ele achou que faz sentido pra você. Sem compromisso: é você entender e decidir.

É rápido, 20 min por vídeo, e você não precisa preparar nada. Consigo [quinta 19h] ou [sábado 10h]. Qual fica melhor?$s$, 3, true),

('quer_nao_senta', 'Quer mas não senta há semanas',
 'Demonstrou interesse mas vem adiando há semanas. Direto, com duas opções fechadas.',
 'lead', 'whatsapp',
$s${primeiro_nome}, vou ser direto porque respeito seu tempo 🙏

A gente vem tentando encaixar faz um tempo e eu sei que corrido é o normal. Então bora resolver: me manda só um "sim" num desses que eu travo na agenda —
📅 [terça 8h]
📅 [quarta 20h]

São 20 min, por vídeo, sem preparar nada. Se nenhum servir, me diz qual semana é a sua que eu me adapto.$s$, 4, true),

('reativar_recomendante', 'Reativar pela ponte (fala com quem indicou)',
 'Muitas tentativas sem agendar: pede ao recomendante um alô rápido pro lead.',
 'recomendante', 'whatsapp',
$s${recomendante}, tudo certo? 🙏

Tô querendo ajudar o {primeiro_nome} de verdade, mas ele anda muito corrido e some. Você que abriu essa porta — consegue dar um alô rápido pra ele, só um "fala com o Jucá que vale a pena"? De você faz toda diferença. Te devo essa! 🙌$s$, 5, true)

on conflict (gatilho) do update set
  rotulo        = excluded.rotulo,
  descricao     = excluded.descricao,
  destino       = excluded.destino,
  canal         = excluded.canal,
  script        = excluded.script,
  ordem         = excluded.ordem,
  ativo         = excluded.ativo,
  atualizado_em = now();
