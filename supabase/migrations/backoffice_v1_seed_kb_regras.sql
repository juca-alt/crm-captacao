-- BACKOFFICE V1 (02/09/2026) · Entrega 6 — 14 regras em kb_regras_negocio.
-- Colunas REAIS da tabela: dominio (=categoria), codigo, regra, fonte (=origem), status (=confianca: vigente), data_decisao.
insert into public.kb_regras_negocio (dominio, codigo, regra, fonte, status, data_decisao) values
 ('rcp_cobranca','BO-01','A cobranca e lancada 1 dia antes do vencimento - postecipar no dia do vencimento nao evita a tentativa.','historico_lm_2026','vigente','2026-09-02'),
 ('rcp_cobranca','BO-02','O retorno de uma tentativa de cobranca leva ate 48h; enquanto houver "cobranca em andamento" o sistema nao emite boleto.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-03','Alteracao anexada leva 3 dias uteis para concluir.','historico_lm_2026','vigente','2026-09-02'),
 ('rcp_cobranca','BO-04','Postecipacao nao muda o mes de vencimento - so reduz os dias de atraso. Cada apolice tem uma data maxima.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-05','Se o responsavel pelo pagamento e diferente do segurado, o aceite vai para os dois.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-06','Migrar a forma de pagamento para boleto e sempre excecao (a regra antiga de plano > R$ 500/mes ou responsavel PJ nao vale mais).','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-07','Reabilitacao no cartao exige transmitir para o aceite chegar ao portal do cliente; no boleto nao transmite - emite boleto + termo de aceite.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-08','Em beneficio, cada documento novo reinicia o prazo - subir tudo de uma vez.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-09','Proposta sem recibo anexado e cancelada automaticamente (~15 dias); depois so volta via RCMO.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-10','Retirada de ajuste apos decisao de UW leva ~5 dias uteis para refletir no espelho.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-11','Alteracao de cobertura exige dados bancarios do cliente para finalizar.','historico_lm_2026','vigente','2026-09-02'),
 ('rcp_cobranca','BO-12','Multa e juros de reabilitacao nao sao detalhaveis - calculo interno da seguradora.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-13','Assistente nao tem acesso a alteracao ONECLICK de proposta em UW nem a reabilitacao de apolice - ambas so o LP. Fonte: Guia Life Planner - Processos Operacionais.','historico_lm_2026','vigente','2026-09-02'),
 ('processo','BO-14','O boleto de reabilitacao so o LP consegue puxar; a assessoria so enxerga os valores.','historico_lm_2026','vigente','2026-09-02')
on conflict (codigo) do nothing;
