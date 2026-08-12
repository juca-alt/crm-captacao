-- ============================================================================
--  Visão Life Planner — MÓDULO REVISÃO DE APÓLICES (fase 1)
--  Coberturas NORMALIZADAS por apólice + catálogo de domínio + parâmetros da
--  calculadora de necessidade (metodologia Prudential).
--
--  POR QUE NORMALIZADO (diverge do jsonb da carteira_*): o catálogo é tabela de
--  domínio editável pelo LP (classificação de códigos), os parâmetros precisam
--  de chave/valor consultável, e o valor de resgate manual precisa SOBREVIVER
--  ao snapshot substitutivo da carteira — a chave aqui é o NÚMERO DA APÓLICE,
--  estável entre imports. Decisão aprovada pelo Gustavo em 27/07/2026.
--
--  RLS: rev_apolices / rev_apolice_coberturas POR DONO (e-mail, igual carteira_*).
--       rev_cobertura_catalogo / rev_parametros COMPARTILHADOS entre os LPs
--       (authenticated full — TP10G significa o mesmo pra todo mundo; aprovado).
--
--  Ligação com a carteira: cliente_ref = normKey(nome do segurado) — mesma
--  chave natural usada em carteira_clientes.ref. Sem uuid de cliente (o app
--  não tem esse conceito; convenção do repo).
--
--  ⚠️ Não toca em nenhuma tabela existente. Prefixo `rev_` é novo.
--  Rodar no SQL editor do Supabase (projeto kbiinfpjfmuidyzsfegp), role postgres.
-- ============================================================================

-- ── 1. Apólice detalhada (1 linha por apólice do demonstrativo Prudential) ──
create table if not exists public.rev_apolices (
  dono              text not null default (auth.jwt()->>'email'),
  numero            text not null,                 -- "001520815"
  cliente_ref       text not null,                 -- normKey(nome do segurado) = carteira_clientes.ref
  cliente_nome      text,                          -- nome como está no demonstrativo (exibição)
  proposta          text,
  status            text not null default 'Ativa'
                    check (status in ('Ativa','Cancelada','Substituída','Rejeitada','Anulada','Sinistrada')),
  data_emissao      date,
  inicio_vigencia   date,
  tipo_contestacao  text,                          -- "Médica" | "Não Médica"
  idade_emissao     int,
  premio_liquido    numeric(12,2),
  iof               numeric(12,2),
  premio_total      numeric(12,2),
  periodicidade     text check (periodicidade is null or periodicidade in ('Mensal','Anual')),
  forma_pagamento   text,                          -- cartao | debito | boleto (texto livre do demonstrativo)
  cartao_expiracao  date,
  dia_pagamento     int,
  pago_ate          date,
  dias_atraso       int,
  proximo_venc      date,
  total_pago        numeric(14,2),                 -- soma do histórico de cobranças (do demonstrativo)
  num_pagamentos    int,
  -- Reserva técnica: SÓ entrada manual nesta fase (não temos a tabela de fatores
  -- de resgate do WL65G; estimar por analogia com WL10 erraria PRA MAIS).
  -- Futuro: tabela fator_resgate(produto, sexo, idade_emissao, ano_apolice) +
  -- provider no serviço (RevisaoService.fatorResgateProvider) — interface pronta.
  valor_resgate      numeric(14,2),
  valor_resgate_data date,
  atualizado        timestamptz not null default now(),
  primary key (dono, numero)
);

-- ── 2. Coberturas por apólice (o coração do módulo) ──
create table if not exists public.rev_apolice_coberturas (
  dono              text not null default (auth.jwt()->>'email'),
  apolice_numero    text not null,
  codigo            text not null,                 -- "TP10G", "WL65G", "DDMRG"…
  nome              text,                          -- descrição da Prudential
  valor_segurado    numeric(14,2) not null default 0,
  premio_liquido    numeric(12,2) not null default 0,
  iof               numeric(12,2),
  classe_ajuste     text,                          -- Standard | Preferencial | Super Preferencial | null
  termino           date,                          -- término da cobertura (null = sem data no demonstrativo)
  status_cobertura  text,                          -- Premium Paying | Surrendered | Lapsed
  atualizado        timestamptz not null default now(),
  primary key (dono, apolice_numero, codigo),
  foreign key (dono, apolice_numero)
    references public.rev_apolices (dono, numero) on delete cascade
);

-- ── 3. Catálogo de coberturas (domínio, editável pelo LP no app) ──
-- sinistro NULL = pendente de classificação → aparece no painel "⚙️ Catálogo"
-- e no rodapé da revisão como aviso. NUNCA silenciar código desconhecido.
create table if not exists public.rev_cobertura_catalogo (
  codigo            text primary key,              -- código COMPLETO (permite override manual)
  sinistro          text check (sinistro is null or sinistro in
                      ('MORTE_QUALQUER_CAUSA','MORTE_ACIDENTAL','DOENCA_TERMINAL','INVALIDEZ_TOTAL',
                       'INVALIDEZ_PARCIAL','DOENCAS_GRAVES','INTERNACAO','CIRURGIAS','FRATURAS',
                       'PERDA_AUTONOMIA','FUNERAL')),
  natureza          text check (natureza is null or natureza in ('vitalicio','temporario')),
  eh_diaria         boolean not null default false, -- true p/ Renda Hospitalar (valor é DIÁRIA, não capital)
  descricao_cliente text,                           -- texto explicativo mostrado ao cliente
  atualizado        timestamptz not null default now()
);

-- ── 4. Parâmetros da metodologia (a Prudential muda esses critérios) ──
create table if not exists public.rev_parametros (
  chave       text primary key,
  valor       numeric not null,
  descricao   text
);

-- ── RLS ──
alter table public.rev_apolices            enable row level security;
alter table public.rev_apolice_coberturas  enable row level security;
alter table public.rev_cobertura_catalogo  enable row level security;
alter table public.rev_parametros          enable row level security;

drop policy if exists rev_apolices_dono on public.rev_apolices;
create policy rev_apolices_dono on public.rev_apolices
  for all to authenticated
  using (dono = (auth.jwt()->>'email'))
  with check (dono = (auth.jwt()->>'email'));

drop policy if exists rev_apolice_coberturas_dono on public.rev_apolice_coberturas;
create policy rev_apolice_coberturas_dono on public.rev_apolice_coberturas
  for all to authenticated
  using (dono = (auth.jwt()->>'email'))
  with check (dono = (auth.jwt()->>'email'));

-- catálogo e parâmetros: compartilhados (leitura+escrita p/ qualquer LP logado)
drop policy if exists rev_catalogo_auth on public.rev_cobertura_catalogo;
create policy rev_catalogo_auth on public.rev_cobertura_catalogo
  for all to authenticated using (true) with check (true);

drop policy if exists rev_parametros_auth on public.rev_parametros;
create policy rev_parametros_auth on public.rev_parametros
  for all to authenticated using (true) with check (true);

-- ============================================================================
--  SEED — parâmetros da metodologia (valores oficiais da ferramenta Prudential)
-- ============================================================================
insert into public.rev_parametros (chave, valor, descricao) values
  ('emergenciais_meses',    3,       'Reserva emergencial = despesas fixas × N meses'),
  ('restabelecimento_meses',6,       'Restabelecimento = despesas fixas × N meses'),
  ('inventario_pct',        0.15,    'Custo de inventário = % do patrimônio total'),
  ('invalidez_mult',        2,       'Necessidade invalidez = capital vitalício × N'),
  ('dg_meses',              24,      'Doenças graves = despesas totais × N meses'),
  ('dg_teto',               2000000, 'Teto da necessidade de doenças graves (R$)'),
  ('dg_arredondamento',     5000,    'Arredondamento (floor) da necessidade de doenças graves (R$)'),
  ('fraturas_meses',        3,       'Fraturas = despesas totais × N meses'),
  ('fraturas_teto',         100000,  'Teto da necessidade de fraturas (R$)'),
  ('diaria_teto',           3000,    'Teto da diária de internação (R$)'),
  ('diaria_arredondamento', 50,      'Arredondamento (floor) da diária de internação (R$)'),
  ('educacao_anos_default', 20,      'Anos de educação (default do formulário)'),
  ('dividas_anos_default',  5,       'Anos de dívidas (default do formulário)'),
  ('limite_mensal_pct',     0.05,    'Limite recomendado do prêmio mensal = % da renda mensal'),
  ('limite_anual_pct',      0.08,    'Limite recomendado do prêmio anual = % da renda mensal × 12'),
  ('uti_mult',              2,       'Diária de UTI = diária de internação × N')
on conflict (chave) do nothing;   -- não sobrescreve ajuste manual do Gustavo

-- ============================================================================
--  SEED — catálogo de coberturas
--  Códigos COMPLETOS extraídos da carteira real (coluna Produtos dos .xls),
--  classificados pelo mapa de prefixos da metodologia:
--    WL*/WV* morte vitalício · TP*/DR*/DT* morte temporário · AB* morte acidental
--    DD*/CI* doenças graves · PD* inval. parcial · PI* inval. total · PA* perda
--    autonomia · HC* internação (diária) · AF* funeral · BRB* fraturas
--  Prefixos SEM regra (AP*, FR*, TF*, TR*, WD*, WS*, DI*) entram PENDENTES
--  (sinistro null) → classificar no painel ⚙️ Catálogo. Nunca silenciar.
-- ============================================================================
insert into public.rev_cobertura_catalogo (codigo, sinistro, natureza, eh_diaria, descricao_cliente) values
  -- Morte qualquer causa — VITALÍCIO (WL*, WV*)
  ('WL10F','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida e o valor de resgate é uma característica desse seguro vitalício.'),
  ('WL10G','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida e o valor de resgate é uma característica desse seguro vitalício.'),
  ('WL20G','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida e o valor de resgate é uma característica desse seguro vitalício.'),
  ('WL60G','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida e o valor de resgate é uma característica desse seguro vitalício.'),
  ('WL65G','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida e o valor de resgate é uma característica desse seguro vitalício.'),
  ('WV10G','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida.'),
  ('WV20G','MORTE_QUALQUER_CAUSA','vitalicio',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias na apólice. A vigência é por toda a vida.'),
  -- Morte qualquer causa — TEMPORÁRIO (TP*, DR*, DT*)
  ('TP10G','MORTE_QUALQUER_CAUSA','temporario',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias. A vigência corresponde ao período de pagamento dos prêmios desta cobertura.'),
  ('TP20G','MORTE_QUALQUER_CAUSA','temporario',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias. A vigência corresponde ao período de pagamento dos prêmios desta cobertura.'),
  ('TP30G','MORTE_QUALQUER_CAUSA','temporario',false,'Em caso de morte natural ou acidental, o valor do seu seguro de vida será recebido pelas pessoas indicadas como beneficiárias. A vigência corresponde ao período de pagamento dos prêmios desta cobertura.'),
  ('DR10G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte com capital decrescente: o valor do benefício reduz ao longo da vigência, acompanhando dívidas que também diminuem (ex.: financiamento).'),
  ('DR15G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte com capital decrescente: o valor do benefício reduz ao longo da vigência, acompanhando dívidas que também diminuem (ex.: financiamento).'),
  ('DR20G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte com capital decrescente: o valor do benefício reduz ao longo da vigência, acompanhando dívidas que também diminuem (ex.: financiamento).'),
  ('DR25G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte com capital decrescente: o valor do benefício reduz ao longo da vigência, acompanhando dívidas que também diminuem (ex.: financiamento).'),
  ('DR30G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte com capital decrescente: o valor do benefício reduz ao longo da vigência, acompanhando dívidas que também diminuem (ex.: financiamento).'),
  ('DT10G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte temporária: em caso de morte natural ou acidental durante a vigência, os beneficiários recebem o valor contratado.'),
  ('DT15G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte temporária: em caso de morte natural ou acidental durante a vigência, os beneficiários recebem o valor contratado.'),
  ('DT20G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte temporária: em caso de morte natural ou acidental durante a vigência, os beneficiários recebem o valor contratado.'),
  ('DT25G','MORTE_QUALQUER_CAUSA','temporario',false,'Cobertura de morte temporária: em caso de morte natural ou acidental durante a vigência, os beneficiários recebem o valor contratado.'),
  -- Morte acidental (AB*)
  ('AB05G','MORTE_ACIDENTAL','temporario',false,'No caso de morte por acidente coberto, quem você indicou como beneficiário na apólice receberá o valor do benefício da cobertura opcional mais o benefício de morte, que é uma garantia básica.'),
  ('AB15G','MORTE_ACIDENTAL','temporario',false,'No caso de morte por acidente coberto, quem você indicou como beneficiário na apólice receberá o valor do benefício da cobertura opcional mais o benefício de morte, que é uma garantia básica.'),
  ('AB20G','MORTE_ACIDENTAL','temporario',false,'No caso de morte por acidente coberto, quem você indicou como beneficiário na apólice receberá o valor do benefício da cobertura opcional mais o benefício de morte, que é uma garantia básica.'),
  ('AB30G','MORTE_ACIDENTAL','temporario',false,'No caso de morte por acidente coberto, quem você indicou como beneficiário na apólice receberá o valor do benefício da cobertura opcional mais o benefício de morte, que é uma garantia básica.'),
  ('ABR5G','MORTE_ACIDENTAL','temporario',false,'No caso de morte por acidente coberto, quem você indicou como beneficiário na apólice receberá o valor do benefício da cobertura opcional mais o benefício de morte, que é uma garantia básica.'),
  -- Doenças graves (DD*, CI*)
  ('DDMRG','DOENCAS_GRAVES','temporario',false,'Em caso de diagnóstico de doença grave ou realização de procedimento médico que esteja previsto, você receberá o valor determinado na sua apólice.'),
  ('DDP5G','DOENCAS_GRAVES','temporario',false,'Em caso de diagnóstico de doença grave ou realização de procedimento médico que esteja previsto, você receberá o valor determinado na sua apólice.'),
  ('DDR5G','DOENCAS_GRAVES','temporario',false,'Em caso de diagnóstico de doença grave ou realização de procedimento médico que esteja previsto, você receberá o valor determinado na sua apólice.'),
  ('CIA5G','DOENCAS_GRAVES','temporario',false,'Em caso de diagnóstico de doença grave ou realização de procedimento médico que esteja previsto, você receberá o valor determinado na sua apólice.'),
  ('CIB5G','DOENCAS_GRAVES','temporario',false,'Em caso de diagnóstico de doença grave ou realização de procedimento médico que esteja previsto, você receberá o valor determinado na sua apólice.'),
  -- Invalidez parcial (PD*)
  ('PD05F','INVALIDEZ_PARCIAL','temporario',false,'No caso de sofrer um acidente e uma invalidez parcial prevista na apólice, você receberá o valor do seguro. Consulte a tabela de invalidez parcial majorada.'),
  ('PD05G','INVALIDEZ_PARCIAL','temporario',false,'No caso de sofrer um acidente e uma invalidez parcial prevista na apólice, você receberá o valor do seguro. Consulte a tabela de invalidez parcial majorada.'),
  -- Invalidez total (PI*)
  ('PI05G','INVALIDEZ_TOTAL','temporario',false,'Se sofrer alguma das lesões irreversíveis previstas nas condições gerais, em consequência exclusiva de acidente coberto, você pode receber integralmente o valor do benefício, e o seguro será encerrado.'),
  -- Perda de autonomia (PA*)
  ('PA05G','PERDA_AUTONOMIA','temporario',false,'Se passar a precisar do auxílio de outras pessoas para realizar atividades básicas do seu dia a dia (tomar banho, fazer higiene pessoal, comer, vestir-se etc.) por causa de doença ou acidente, você receberá o valor estabelecido na apólice.'),
  ('PA10G','PERDA_AUTONOMIA','temporario',false,'Se passar a precisar do auxílio de outras pessoas para realizar atividades básicas do seu dia a dia (tomar banho, fazer higiene pessoal, comer, vestir-se etc.) por causa de doença ou acidente, você receberá o valor estabelecido na apólice.'),
  -- Internação / Renda hospitalar (HC*) — valor é DIÁRIA
  ('HC05G','INTERNACAO','temporario',true,'Pagamento de uma diária para cada dia de internação hospitalar por doença ou acidente coberto. A partir do 5º dia em que estiver internado, você receberá o valor contratado. Caso seja em UTI, a diária será paga em dobro.'),
  -- Funeral (AF*)
  ('AF05G','FUNERAL','temporario',false,'Um serviço que atua na organização do funeral em caso de falecimento do segurado titular. A cobertura inclui também questões administrativas, registros em cartório, sepultamento e cremação.'),
  ('AFC5G','FUNERAL','temporario',false,'Serviço de organização do funeral — opção Casal. Inclui questões administrativas, registros em cartório, sepultamento e cremação.'),
  ('AFF5G','FUNERAL','temporario',false,'Serviço de organização do funeral — opção Familiar. Inclui questões administrativas, registros em cartório, sepultamento e cremação.'),
  ('AFI5G','FUNERAL','temporario',false,'Serviço de organização do funeral — opção Individual. Inclui questões administrativas, registros em cartório, sepultamento e cremação.'),
  ('AFP5G','FUNERAL','temporario',false,'Serviço de organização do funeral — opção Plus (pais e pets). Inclui questões administrativas, registros em cartório, sepultamento e cremação.'),
  ('AFQ5G','FUNERAL','temporario',false,'Serviço de organização do funeral em caso de falecimento do segurado. Inclui questões administrativas, registros em cartório, sepultamento e cremação.'),
  -- Fraturas (BRB*)
  ('BRB5G','FRATURAS','temporario',false,'Opção de cobertura para quebra de ossos com indenização adicional de 50% em caso de fratura exposta. Múltiplas fraturas podem ser cobertas a cada 12 meses.'),
  -- ── PENDENTES de classificação (prefixo sem regra na metodologia) ──
  ('AP10G',null,null,false,null),
  ('AP60G',null,null,false,null),
  ('AP65G',null,null,false,null),
  ('DIMRG',null,null,false,null),
  ('DINRG',null,null,false,null),
  ('FR20G',null,null,false,null),
  ('FR25G',null,null,false,null),
  ('TF10G',null,null,false,null),
  ('TF20G',null,null,false,null),
  ('TR05G',null,null,false,null),
  ('WD10G',null,null,false,null),
  ('WS00G',null,null,false,null)
on conflict (codigo) do nothing;  -- não sobrescreve classificação manual já feita

-- ── verificação rápida (rodar depois do seed) ──
-- select count(*) filter (where sinistro is not null) as classificados,
--        count(*) filter (where sinistro is null)     as pendentes
--   from rev_cobertura_catalogo;           -- esperado: 42 classificados, 12 pendentes
-- select count(*) from rev_parametros;     -- esperado: 16
