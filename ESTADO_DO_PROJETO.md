# ESTADO DO PROJETO — CRM Captação / Vendas LP

> ⚠️ **Nota de reconciliação (19/07/2026):** a cópia versionada deste arquivo estava **ausente do repo** (o CLAUDE.md referencia ela, mas não existia commit). Este arquivo recomeça aqui com o snapshot da sessão de hoje. **Cowork:** na próxima passada, reconciliar com a versão oficial do Drive (pasta "CAPTACAO LIFE PLANNER") — o histórico anterior vive lá.

## 18/09/2026 (35ª onda) — SEMANA-GRADE-V1: a vista Semana da Agenda vira grade de horas no estilo do Google (v7.93)

Prints dele (vista Dia e vista Semana no iPhone): *"essa visualização do Dia já está no estilo do calendário do Google. É a mesma lógica pra Semana."*

### O que mudou
- **Semana = grade de horas** (`gcalSemanaGradeHTML`): eixo de horas à esquerda (fixo), **7 colunas** (hoje + 6, hoje com o número em círculo azul), **faixa "dia todo"** no topo, **linha vermelha do agora** na coluna de hoje, faixa de horas compartilhada (7–20h, alarga com os eventos e com o agora). Blocos são os mesmos da vista Dia (`.gcal-ev`, com sobreposição em faixas), com a classe (pessoal tracejado/apagado, feito riscado, etiqueta do negócio).
- **Toque no vazio** de uma coluna cria naquele dia e hora (reuso de `gcalCliqueVazio`). **＋** no cabeçalho do dia cria às 9h.
- **Arrasto** (motor AGENDA-FLUIDA): vertical muda a hora; **horizontal muda o dia** (a coluna-alvo acende; o bloco não pega o ponteiro enquanto arrasta); borda de baixo estica; toque curto abre o **cartão ⋯** (com a classe ligada) ou o editor. Chips de dia todo aceitam as células novas como alvo.
- **Celular:** colunas de 120px e a grade **rola de lado dentro do card** (eixo e cabeçalhos com `position:sticky`); a página não estoura. Desktop: 7 colunas cabem.
- A semana de chips antiga ficou como `gcalSemanaChipsHTML` (é o que quem não tem a chave vê).

### Gate
- Só na base dele: chave **`agenda-semana`** em `NOVO_SO_MEU`.

### Prova
- Portão aberto (47 telas) · guard OK · `teste-agenda-semana.mjs` **10/10** em 390 e 1280 (grade com 7 colunas, evento na coluna/altura certas, pessoal apagado, dia todo, linha do agora, rolagem lateral sem estouro, toque no vazio → editor com dia e 10:00, arrasto pra outra coluna → PATCH com o dia novo mantendo a hora, Daniel nos chips) · regressão Agenda-classe 20/20 · 1 invariante novo.

---

## 18/09/2026 (34ª onda) — AGENDA-CLASSE-V1: compromisso do Google com classe (negócio · trabalho · pessoal), várias agendas, e o botão ⋯ ação (v7.92)

Prints da Agenda no iPhone (lista do Google com Gym, Gael Escola, Ponto de Apoio, cada um com 5 botões de tarefa): *"compromisso pessoal é só OCUPADO, não faz sentido tratar como tarefa. Deixa configurado pra linkar conforme as listas do Google (RCP, OI, OI Novo…). Nos de trabalho: associar ao negócio do funil, marcar feito/não feito, adiar mais do que +1d/+7d — um botão 'pra depois' que abre um cardzinho de opção."*

### O que mudou
- **Classe do compromisso** (`gcalClasse`): **negócio** (casou com um negócio do funil — carimbo, telefone ou nome), **trabalho**, **pessoal** (só ocupado). Ordem: marca no próprio evento (`extendedProperties.private.crmClasse`, vale em qualquer aparelho) → regra da agenda do Google de onde veio → negócio → palavra-chave (listas pessoal/trabalho) ou prefixo de etapa `[OI/FF]`. Seed de pessoal: gym, academia, treino, escola, colégio, dentista, médico, pediatra.
- **Linha da Agenda:** negócio = 🎯 selo + **um botão "⋯ ação"** (+ 💬 e ↗); trabalho = idem + "🎯 vincular"; pessoal = 🔒 apagado, só ⋯. Os pessoais ficam **recolhidos num bloco "🔒 N ocupados"** (nasce fechado; opcional em ⚙). Cabeçalho: "2 hoje · 2 ocupado(s)". Semana: chip pessoal apagado.
- **Cartão ⋯** (`gcalMais`, folha no celular / centrado no desktop): **✓ Feito** (nasceu de atividade do CRM → conclui a atividade; senão grava `crmFeito` no evento + nota na ficha, linha riscada) · **✗ Não aconteceu** (nota + já abre pra remarcar) · **⏳ Delay 7d** (negócio entra em Delay pelo DELAY-SINC + evento anda 7d) · 👤 Ficha · 💬 · **Adiar** +1 · +7 · próx. segunda · **data e hora escolhidas** (duração mantida) · **Tipo** 🔒 É pessoal / 💼 É trabalho / **🔒 Pessoal — este e os com o mesmo nome** (vira palavra-chave) · ✏️ Editar · 🗑️ Excluir · ↗ Google · ⚙ Regras.
- **Várias agendas do Google** (`users/me/calendarList`, só as que ele pode escrever): `gcalApi` passou a receber a agenda do evento (Adiar/Mover/Salvar/Excluir vão na agenda certa). **⚙ Agendas e regras:** por agenda — Automático · Trabalho · Pessoal · Não mostrar (principal nasce em auto, as outras em off até ele ligar) + palavras pessoal/trabalho + "recolher pessoais". Regras moram em `PL.gcalCfg` (placed_estado, por dono → sincroniza).

### Gate
- Só na base dele: chave **`agenda-classe`** em `NOVO_SO_MEU`. Daniel: linha do Google como antes (+1d/+7d), sem ⋯ e sem ⚙; só a agenda principal.

### Prova
- Portão aberto (47 telas) · guard OK · `teste-agenda-classe.mjs` **20/20** em 390 e 1280 com a API do Google simulada (classes certas, bloco de ocupados fechado, cartão completo com botões ≥44px, Feito grava e risca, Pessoal-todos vira regra e salva no PL, É trabalho desfaz, Delay sincroniza e move 7d, mover pra data/hora mantém duração, ⚙ com 2 agendas e palavras, Daniel na linha antiga) · regressão Agenda V2 18/18 · 1 invariante novo.

---

## 18/09/2026 (33ª onda) — PLANO-V1: Plano Prudential (Planejamento Financeiro por mês) distribuído nos cards (v7.91)

Print do painel "Planejamento Financeiro 2026" da Prudential | franquia (Mês · Apólices Emitidas · PA Total · PA Médio · CS Total · CS Médio · Faturamento/Comissão Bruta): *"coloca as informações — o que vai fazer de apólice, o que está pensando pra aquele período — e isso distribui nos desdobramentos das nossas metas, dos acompanhamentos, dos cards. Botar nos outros módulos."*

### O que mudou
- **Módulos → Visão → 🧭 Plano Prudential** (`viewPlano`): 12 meses do ano escolhido; você digita **apólices, PA médio, CS médio e comissão bruta**; **PA total = apólices × PA médio** e **CS total = apólices × CS médio** saem sozinhos; coluna **Realizado (apól. · PA · %)** por mês (emitidas Ativas, mesma conta do Resumo MF); totais do ano em 5 KPIs; botão **⤓ repetir nos seguintes** (o plano da franquia costuma ser igual mês a mês); "Copiar plano do ano anterior" quando o ano está vazio. Desktop = tabela; celular = um card por mês, **fechados** (abrir/recolher tudo), campos ≥44px.
- **Onde mora:** `PL.plano[ano][mm] = {n, pam, csm, com}` no documento `placed_estado` (um por dono, RLS) — já sincroniza entre iPad/iPhone/desktop quando logado; cache local `crmlp_placed_v1`.
- **Distribuição (só lê, não obriga):**
  - **Cards do ciclo** (Consolidada e Emissão Diária): PA emitido ganha "· plano R$ X · Y%" — plano do período **prorrateado por dia** (`plnPeriodo`), então vale igual pro ciclo mensal e pro de compensação. Nos funis não entra (o recorte é por funil; o plano é da operação).
  - **Metas** (mês/trimestre): sem meta digitada, Apólices emitidas e PA emitida usam o plano como meta padrão (placeholder + selo "plano"); digitar sobrescreve.
  - **Resumo MF:** gauge usa a soma do plano do ano quando não há "plano do ano" digitado ali; gráfico ganha a **linha tracejada do plano** (apólices, PA total, PA médio).
  - **Emissão Diária:** sem plano por LP no mês, o plano × real usa o PA do Plano Prudential daquele mês.

### Gate
- Só na base dele: chave **`plano`** em `NOVO_SO_MEU` (card do hub com `novo:'plano'`; todas as leituras passam por `plnOn()`). Daniel: sem card, sem "plano" nos cards, Metas como antes.

### Prova
- Portão aberto (47 telas) · guard OK · `teste-plano.mjs` **16/16** em 390 e 1280 (tabela/cards, preencher pelo campo → totais e realizado 30%, repetir até dezembro, salvo no PL, Consolidada "plano R$ 60.000 · 30%", Metas com meta do plano, Resumo MF gauge + linha, Emissão Diária, Daniel) · regressão ciclo 14/14 · 1 invariante novo.

---

## 18/09/2026 (32ª onda) — PESSOA-SUGERE-V1: campo de pessoa autocompleta com quem já está na base e grava a grafia registrada (v7.90)

Print da ficha no iPad (Recomendante digitado "Fábio barrão", em minúscula): *"esses campos de pessoas já cadastradas têm que autocompletar — digito Fábio e aparecem os Fábios que já existem, pra não ficar cadastro bagunçado e cair no perfil certo do recomendante."*

### O que mudou
- **Lista própria de sugestões** (`pesCandidatos` / `pesSug*`), no lugar do `<datalist>` nativo que não dava conta no iPad: junta **funil + carteira + estoque** (sem repetir por nome normalizado, descartado do estoque fora), "começa com" primeiro, depois carteira → funil → estoque, alfabética. Cada linha traz o nome + onde a pessoa está (funil · etapa / Carteira / estágio do estoque · rec.) + etiqueta. Fixa na tela, abaixo ou acima do campo, linha ≥44px, teclado (↓ ↑ Enter Esc), reposiciona ao rolar.
- **Grafia registrada** (`pesCanon`): ao escolher na lista ou ao salvar um nome que já existe (caixa/acento diferentes), grava como está na base ("fábio barrão" → "Fábio Barrão") — o selo do recomendante passa a achar a ficha certa.
- **Onde:** Recomendante da ficha (`pes_rec`), "Origem / recomendante" do ➕ Novo contato (`ncOrigem`) e Recomendante da ficha do Estoque (`bne-rec`). Pendura-se em qualquer input com `${pesSugAttrs()}`.

### Gate
- Só na base dele: chave **`pes-sugere`** em `NOVO_SO_MEU`. Com a chave desligada o campo fica exatamente como era (datalist antigo, sem canônico).

### Prova
- Portão aberto (46 telas) · guard OK · `teste-pessoa-sugere.mjs` **18/18** em 390 e 1280 (widget na ficha sem datalist, "fab" → 3 nomes certos sem repetir, dentro da tela e colada ao campo, toque e teclado preenchem, salvar torto vira canônico e o selo aponta pra ficha, Novo contato e Estoque, Daniel fica com o campo antigo) · regressão ficha 18/18 · 1 invariante novo.

---

## 18/09/2026 (31ª onda) — PIPES-V1: Pipe Vida Individual + Pipe Vida em Grupo + Pipe Prud. Demais + Pipe MFO, cada um com Consolidada · Novos Negócios · Negócios na Base (v7.89)

Print do menu (iPad): *"Pipe Negócios vira Pipe Vida Individual — Visão Consolidada, Novos Negócios, Negócios na Base. Depois Pipe Vida em Grupo, Pipe Prud. Demais e Pipe MFO, a mesma lógica, mesmo estilo de card. O Daniel não vai ter acesso."*

### O que mudou
- **Menu:** "Pipe Negócios" → **Pipe Vida Individual** (Consolidada · Novos Negócios · Negócios na Base). Nascem **Pipe Vida em Grupo**, **Pipe Prud. Demais** e **Pipe MFO**, cada um com o mesmo trio. Os funis VG/Prud/MFO saíram do grupo antigo e viraram o "Novos Negócios" do seu pipe. Grupos nascem fechados; o da tela atual abre sozinho.
- **Funis novos "Negócios na Base"** (`vg-bc`, `prud-bc`, `mfo-bc`) na fábrica, mesmo desenho do BC num esqueleto curto: Clientes Ativos → Contato/Revisita → Revisita agendada → Proposta → Fechamento · Ganho · Perdido. Board pelo `viewFunilExtra` (arrastar, ➕ Novo negócio fixado no funil, status por etapa).
- **Consolidada por pipe** (`PIPES` = 2 funis por pipe): `consol-vg`, `consol-prud`, `consol-mfo` usam a mesma `viewConsolidado`, restrita aos funis do pipe, com chip do pipe no título e escolha lembrada em chave própria (`crmlp_consol_<pipe>_v1`; a Vida Individual segue em `crmlp_consol_v1`).
- **Cfg do funil vinda do servidor** agora mescla com a fábrica (`Object.assign(funFabMat(), v)`): funil de fábrica que ainda não está na cfg salva não some mais ao sincronizar (era o risco de os `-bc` sumirem ao logar).
- **WA em fluxo** ficou genérico pros funis novos (encerrado e Clientes Ativos ficam de fora). Siglas `VG·B`, `PRUD·B`, `MFO·B` nos painéis e na Consolidada.

### Gate
- Só na base dele: chave **`pipes`** em `NOVO_SO_MEU` (`data-novo="pipes"` nos 9 itens dos 3 pipes novos; cabeçalho do pipe some quando não sobra item). Pra liberar por pessoa: tirar de `NOVO_SO_MEU` — as views já estão em `MODS.funis_extra` (que o Daniel tem desligado). Pipe Vida Individual continua pra todos.

### Prova
- Portão aberto (46 telas × 3 larguras × cheia/vazia) · `--prova` OK · guard OK · `teste-pipes.mjs` **22/22** em 390 e 1280 (menu 4 pipes, Consolidada do pipe soma só os 2 funis e lembra em chave própria, Vida Individual intacta, board `vg-bc`, Novo negócio fixado, WA em fluxo, Daniel vê só Vida Individual, mescla da cfg) · regressão ciclo 14/14 e WA 18/18 · 2 invariantes novos.

---

## 18/09/2026 (30ª onda) — CICLO-V1: PA emitido e FYC emitido por ciclo (mensal ou de compensação) na Consolidada, nos funis e na Emissão Diária (v7.88)

Prints dele (Consolidada, NN, BC, Emissão Diária): *"tira Parados e A entregar da Consolidada. Bota PA emitido e FYC emitido — pelo ciclo do mês (1 a 30) e pelo ciclo de compensação (ex.: 21/08 → 20/09) — na Consolidada, nos dois funis e na Emissão Diária, com um botãozinho pra trocar e ajustar os períodos."*

### Motor (`CIC`, por aparelho em `crmlp_ciclo_v1`)
- `cicloPeriodo(modo, ref, corte, ini, fim)` — pura: **mensal** = 1º ao último dia; **compensação** = do dia de corte (padrão **21**) ao dia anterior ao corte do mês seguinte (antes do corte, o ciclo começou no mês passado); **de/até na mão** ganham de tudo.
- `cicloEmitidas(per, linhas, filtro)` — uma fonte só: as emitidas do app (`EX`, relatório UW & Emissão). **Ativa soma, cancelada desconta** (mesma conta da Emissão Diária). **FYC = AFYC projetado** do relatório.
- `cicloFiltroFunil(ns)` — nos funis, só as emitidas de quem tem negócio naquele funil (casa segurado/resp. pagamento com os contatos pelas chaves do card do cliente).
- Barra **Ciclo**: 📅 Mensal · 💰 Compensação; em compensação aparecem **corte dia**, **de**, **até** e "↺ pelo corte" quando o período foi ajustado na mão.

### Onde
- **Consolidada:** KPIs = PA em jogo · Ponderado · PA médio · **PA emitido · FYC emitido**. "Parados" virou link vermelho no sub do PA em jogo (continua caminho pra "Onde está travado"); "A entregar" saiu (a Entrega segue na régua). Barra do ciclo abaixo dos KPIs.
- **Funis NN e BC:** os dois cards na faixa que sempre aparece (filtrados pelo funil); barra do ciclo em "mais números".
- **Emissão Diária:** barra do ciclo + os dois cards acima dos KPIs do mês (o seletor mês/dias continua).

### Prova
- Portão aberto (40 telas) · `--prova` OK · guard OK · `teste-ciclo.mjs` **14/14** em 390 e 1280 (KPIs certos, cancelada desconta, troca pra compensação, corte e período na mão, funil filtra, Emissão Diária) · regressão (Agenda, WA, Início) verde · 2 invariantes novos, 1 antigo ajustado ("A entregar" saiu a pedido).

## 18/09/2026 (29ª onda) — AGENDA-V2 + DELAY-SINC-V1: delay sincronizado com o funil, 3 KPIs, um fluxo por linha, seções dobráveis/organizáveis (v7.87)

Prints dele da Agenda no iPad: *"essa linguagem de tarefas precisa ter sincronia — se eu boto o delay no Felipe (RCP), ele já atualiza em todos os pontos. Tira os cards A finalizar e Negócios sem atividade; deixa Atrasadas, Hoje e Em aberto. As linhas com a mesma lógica dos painéis. Tópicos clicáveis, expansíveis, organizáveis."*

### DELAY-SINC-V1 — o delay mora no negócio
- `c.delay_ate` (data) + `negDelayMarcar(c, ate, motivo)`: marca a data, **põe o status "Delay …" da etapa** quando ele existe na configuração do funil (`Delay OI/FF`, `Delay P/C`, `Delay C2` hoje), grava na linha do tempo (`etstatus`). **Expira sozinho na data.**
- Quem lê: `taDelayTipo` (→ listas **Delay** do Painel TA e WA), `etStatusChip` (chip ⏳ no card do negócio, na ficha, na Agenda), linha do tempo. BC não tem status configurado → o delay vale mesmo assim, pela data.
- Duas portas: **⏳ Delay 7d** no seletor da atividade (remarca +7d e marca o negócio) e o desfecho novo da reunião **"⏳ Cliente pediu pra adiar (Delay)"** (pede a data nova; remarca e marca até lá).

### AGENDA-V2
- **KPIs:** Atrasadas · Hoje · Em aberto (o "Em aberto" avisa "N reuniões a finalizar" no rodapé). Saíram "A finalizar" e "Negócios sem atividade".
- **Seções dobráveis** (`agBloco`, nascem fechadas, resumo com contagem + primeiros nomes, memória `crmlp_agenda_secs_v1`): Reuniões a finalizar · Atrasadas · Hoje · Amanhã · Próximas · Sem data · Sem próxima atividade. Botões **⌄ abrir tudo · ⌃ recolher tudo · ⋮⋮ organizar** (ordem/esconder, `crmlp_agenda_ordem_v1`, mesma regra de "nova entra no lugar natural").
- **Linha com um fluxo só:** seletor **Ação…** (✓ Feita · ⏳ Delay 7d · +1 dia · +7 dias · ✏️ Editar · ✕ Remover) + 💬 + Google. Reunião a finalizar: **Finalizar** + "Mais…" (sem Feita). Chip de status/delay na linha.

### Prova
- Portão aberto (40 telas) · `--prova` OK · guard OK · `teste-agenda-v2.mjs` **18/18** em 390 e 1280 (KPIs, seções fechadas com resumo, abrir tudo, seletor, Delay pela linha → lista Delay do TA, desfecho Delay na reunião, organizar/esconder/restaurar) · regressão dos testes de painéis/ficha verde · 2 invariantes novos, 1 antigo ajustado (editar mora no seletor).

## 18/09/2026 (28ª onda) — TA-COLUNAS-V1: colunas ajustáveis nos painéis TA/WA + campos linkados (endereço → Maps) (v7.86)

Voz dele: *"tem também a possibilidade de ajustar essas colunas — a pessoa quer botar o endereço, que já vai brincar com o link dos mapas no fluxo de visitação direta. Trabalha bem esses campos linkados."*

### O que mudou (Painel TA e WA — mesma tela)
- **🧩 Colunas** na barra (desktop), no mesmo desenho do Estoque: ligar/desligar + ↑↓, salvo por aparelho (`crmlp_ta_cols_v2`), botão Padrão. Nome, resultado do dia e ações ficam fixos.
- **Catálogo próprio** (`TA_COLS`, serve funil e Estoque): Profissão/empresa · Idade · Renda · Estágio · Listas · Indicado por · Telefone (padrão = as 7 de hoje) + **📍 Endereço** · Cidade · Empresa · E-mail · Nascimento · Última tentativa. Ordenação nas que têm campo (`fxTh`).
- **Campos linkados:** 📍 Endereço → **Google Maps** em nova aba (coordenada quando o local tem lat/lng, senão o texto; vem do Mapa de locais / pontos da carteira via `locPrincipalPessoa`) · Telefone → `tel:` · 👤 Indicado por → **abre a ficha do recomendante** (Estoque, funil ou carteira; sem ficha, avisa) · E-mail → `mailto:` · Cidade e Empresa → busca no Maps.
- **Celular:** o card ganha o chip 📍 do endereço, linkado. O seletor de colunas não aparece (é card, não tabela).
- ⚠️ A preferência antiga (`crmlp_ta_cols_v1`, nunca renderizada) foi aposentada.

### Prova
- Portão aberto (40 telas) · `--prova` OK · guard OK · `teste-ta-colunas.mjs` **8/8** (1280: padrão, ligar Endereço + E-mail, mover pra 1ª coluna, Maps em nova aba, clicar no recomendante abre a gaveta, vale no WA, Padrão volta; 390: chip linkado, sem seletor, sem estouro) · regressão dos 6 testes anteriores verde · 2 invariantes novos. ⚠️ Lição: `esc()` troca `&` por `&amp;` no href — invariante que confere URL precisa esperar isso.

## 18/09/2026 (27ª onda) — TA-LINHA-V2: coluna Listas, funil na etapa e resultado num seletor só (Painel TA e WA) (v7.85)

Print dele do Painel TA no iPad (linhas altas, 5 botões empilhados por pessoa): *"tanto pro Painel TA como pro do WhatsApp: mais colunas — a etapa que ele está, as listas — porque é o fluxo que vai ligar cada estágio. E reorganiza esses botões num único seletor, pra ficar mais curto entre as linhas."*

### O que mudou (vale pros dois painéis — é a mesma tela)
- **Resultado do dia virou um seletor** por linha: Estoque (`Resultado…` com os 5 do TA), funil (`Status da ligação…`, agora sem os resultados de Zap) e WA (`Zap de hoje…`). Registrado, a linha mostra o rótulo + ↩︎ como antes. **Linha no desktop: ~240px → 65px.** Celular: seletor de 44px, largura cheia.
- **Coluna Estágio** ganhou o funil: `NN · OI/FF`, `BC · PC`; Estoque segue `Lista de TA` / `Estoque`…
- **Coluna Listas** (nova, desktop): chips `📅 Hoje` e `📋 <lista nomeada>` de cada pessoa. No celular entram como chips do card.
- Modo Foco não mudou (botões grandes fazem sentido lá).

### Prova
- Portão aberto (40 telas) · `--prova` OK · guard OK · `teste-painel-wa` 18/18 · 2 invariantes novos (seletor único sem botão; funil·etapa + listas na linha).

## 18/09/2026 (26ª onda) — WA-PAINEL-V1: Painel WA (WhatsApp Approach), irmão do Painel TA, só na base dele (v7.84)

Pedido dele (print do Painel TA no iPad): *"constrói um painel WA, WhatsApp Approach. Não vai ser liberado ainda pro Daniel — fase beta que eu vou desenvolver. Pega a mesma lógica do Painel TA, só que pra quem está em fluxo no funil, com abordagens de WhatsApp. Em sinergia com o funil: se virou ganho, sai. Os de delay do RCP, os de marcar — a mesma coisa, com foco de WhatsApp."*

### Desenho: a MESMA tela, canal trocado
- `viewBnWa` = `viewBnTa` com `taCanal()==='wa'` (lido da VIEW). Nada duplicado: lateral, filtros, busca, tabela/cards, CSV, listas nomeadas — tudo é o do Painel TA. O que muda por canal: **listas inteligentes**, **resultado do dia**, título com selo **💬 WA**, e o Modo Foco fica só no TA por enquanto.
- **Listas do WA** (`WA_SMART`): 🌊 Em fluxo (funil) · 🎯 Novos Negócios · 🏠 Base de Clientes · ⏳ Delay · 🔕 TA não atendeu → Zap · 🕗 Ficou pra trás · 🙌 Recomendações · 💎 Rec de cliente · ⭐ Clientes (carteira). Todas exigem telefone.
- **"Em fluxo"** (`waEmFluxo`): negócio do funil, com telefone, **não** encerrado, **não** ganho, **não** pós-venda (BC: fora Ativos, Venda ganha e Delivery). É recorte vivo: mudou a etapa no funil, a lista muda — **ganho sai sozinho**.
- **Resultado do Zap** (`WA_RES`): 💬 Mandei msg · ✅ Respondeu · 🗓️ Agendou · 🔇 Sem resposta · 🚫 Sem interesse. Funil → interação (`RESULTADOS` ganhou `whatsapp`/`whats_respondeu`/`whats_sem_resposta` com `wa:1`, **sem contar como ligação**; agendou = `agendou_oi`, recusou = `sem_interesse`, mesmo caminho do TA). Estoque → `hist` tipo **`wa`** (agendou/recusou passam pelo `bnResultado`, que leva pro funil / descarta) + espelho em `lp_interacoes` (migration `lp_interacoes_wa_v1.sql` aplicada em prod: tipo `wa` e resultados do Zap no CHECK). ↩︎ desfaz o Zap de hoje.
- Cada canal **lembra a própria lista** (`TA_LISTA_MEM`); trocar de painel zera seleção e filtro de resultado.
- **Gate:** `novoOn('painel-wa')`; item do menu com `data-novo` (o `aplicarGates` esconde pra quem não tem a chave) e a tela cai no Painel TA se alguém chegar por link. `bn-wa` entrou em `MODS.bn.views`, `VIEWS_CONHECIDAS` (portão: 40 telas), `TITULO_VIEW`, contador do menu = pessoas em fluxo.

### Prova
- Portão aberto (40 telas × 3 × 2, lpSelfCheck 0) · `--prova` OK · guard OK.
- `teste-painel-wa.mjs` **18/18** em 390 e 1280: Em fluxo lista só negócio aberto com telefone; listas do canal; 💬 + resultado em cada linha; Mandei msg no funil vira interação `whatsapp` sem ligação; no Estoque vira `hist wa` com ↩︎; canal lembra a lista; Daniel não vê o item e cai no TA. Regressão: os 5 testes anteriores seguem verdes.
- 4 invariantes novos. ⚠️ Lição de teste: a tela desenha tabela **e** cards (um escondido por CSS) — contar linhas só pelas visíveis (`getClientRects().length`).

### Ele vai lapidar (beta)
- Mensagens prontas por lista/etapa (hoje é o template do TA: com/sem recomendante) — dá pra plugar o Repertório.
- Modo Foco no WA · resultados do Zap no SitPlan · sair da lista quando "roda alguma etapa" (hoje: ganho/encerrado saem; delay e etapa seguem a régua do TA).

## 18/09/2026 (25ª onda) — FORM-BASE-V1 (campos sem borda) + DRW-ORDEM-V1 (organizar tópicos da ficha) (v7.83)

Print dele da ficha no iPad: *"alguns campos como telefone aparecem em branco. Verifica todos os campos e corrige. Permite também no card do cliente, além de expandir e recolher, organizar os tópicos — tipo o Início."*

### Bug: Telefone/Profissão "em branco"
- **Causa:** regra da calculadora de planos (`.pl`) **sem escopo** em `input[type=text]` e `select` desde 11/09 (v7.39). Fora da calculadora as variáveis `--pl-*` não existem → `border:1px solid var(--pl-ring)` inválida → **campo sem borda nem fundo** (o valor aparecia como texto solto; vazio, sumia). E-mail/número/data escapavam por não estarem na regra — mas ficavam no estilo cru do navegador.
- **Conserto (FORM-BASE-V1):** a regra ganhou o `.pl` de volta e nasceu uma **base única e válida** pra todo campo de texto/select/textarea que nenhum bloco estilizou (borda `--linha`, raio 7, padding 6/9, fundo branco, foco na cor primária). Regras de bloco (`.bne-f`, `.toolbar`, `.sheet`…) seguem ganhando por virem depois. `width:100%` em `input[type=text]`/`select` mantido (status quo desde 11/09). Font-size fora da base (o 16px do celular anti-zoom continua).
- Invariante que renderiza um input/select/e-mail fora da tela e exige borda sólida + varre as folhas de estilo por `input[type=text]` com `var(--pl-`.

### Organizar tópicos da ficha (DRW-ORDEM-V1)
- Botão **⋮⋮ organizar** ao lado de Expandir/Recolher na gaveta do negócio. Modo organizar = barra ↑ ↓ 🚫 em cada tópico (14 hoje, inclusive "Quem é a pessoa" e "Dados da pessoa"), cabeçalho amarelo com **↺ voltar ao padrão** e **✓ pronto**. Escondido continua listado (riscado) no modo; fora dele, some e aparece "N tópicos escondidos — organizar".
- Memória por aparelho (`crmlp_ficha_ordem_v1`), separada da memória de aberto/fechado. Tópico novo do app entra **logo depois do vizinho natural** (`drwOrdCalc`, pura e testada). Funciona por cima do DOM após cada render (a gaveta é innerHTML refeito).

### Prova
- Portão aberto · `teste-ficha-ordem.mjs` **18/18** em 390 e 1280 (bordas iguais em todos os campos, select com borda, organizar/mover/esconder/lembrar/restaurar, Expandir tudo segue) · 2 invariantes novos. ⚠️ Lição: `String(renderDrawer)` não serve pra invariante — a função é envelopada pelas camadas (voltar do Android).

## 17/09/2026 (24ª onda) — HUB-DOBRA-V1: Módulos e Configurações com seções dobráveis (v7.82)

Print dele da tela Módulos no iPhone: *"a área de outros módulos também precisa que os tópicos sejam recolhidos ou expandíveis. Está ficando muito extenso."* É a regra da dobra fechada (16/09) chegando no hub.

### O que mudou
- `hubSecoesHtml` (usado por **Módulos** e **Configurações**) passa a desenhar cada seção como `<details class="hub-dobra">` — **nasce fechada**, lembrada por aparelho (`crmlp_hub_secs_v1`, `hubSecAberta`/`hubSecToggle`), aberta só por `${ab?'open':''}`.
- **Cabeçalho fechado leva o que tem dentro:** título + contagem + os nomes dos cards ("Contatos · Visão da Carteira · Clientes (carteira) · …"), com a contagem do badge quando há (ex.: "Duplicatas (105)"). Aberto, o resumo sai.
- **Dois botões fixos** no topo: ⌄ abrir tudo · ⌃ recolher tudo (`hubSecsTodas`).
- **Celular:** card virou **linha** (ícone à esquerda, título + descrição em 2 linhas, sem o selo "MÓDULO") — 56px em vez de ~240px por card. Desktop segue com a grade de cards. ⚠️ Lição: a regra de celular precisava de especificidade (`.hub-grid>.hub-card`) porque no arquivo ela fica **antes** da regra base do card.
- Tela de Módulos no iPhone: de ~7.300px de rolagem (tudo aberto) pra **844px** (uma tela) fechada.

### Prova
- Portão aberto · `--prova` OK · guard OK.
- `teste-hub-dobra.mjs` **16/16** em 390 e 1280: 6 seções fechadas, resumo no cabeçalho, botões, memória por aparelho, card abre a tela, Configurações idem, console limpo.
- 1 invariante novo (renderiza seção de teste: nasce fechada, resumo com contagem, memória, botões nas duas telas).

## 17/09/2026 (23ª onda) — SOLIC-AGENDA-V1: agendar atividade a partir da solicitação → Google Agenda (v7.81)

Print dele da lista de Solicitações no iPhone: *"permite que nessa área de solicitações/pendências eu já gere uma tarefa, uma atividade, jogando direto pro Google Agenda, como a gente já faz nos cards dos clientes."*

### Como funciona (reaproveita o motor que já existia — nada de segundo cano pro Google)
- Regra do app: **tarefa é sempre de um contato (negócio)**. Então o botão **📅** (na linha da lista e na ficha V2) abre uma folha — *O quê · Tipo · Dia · Hora* — já preenchida: título = próximo passo (ou "Cobrar <área> · <tipo>"), dia = "até quando" (senão o prazo da área, senão amanhã), 09:00.
- **Achou o negócio do segurado** (`soContatoDe`: `cliNegociosDe` por nome/telefone, preferindo Base de Clientes) → `tarCriar` no negócio, notas com tipo/área/prazo/protocolo/contexto, `t.solicId`; com hora, a fila do GCAL-BIDIRECIONAL leva pra Agenda Google **dentro do toque** (é quando o Google pode pedir consentimento sem o Safari barrar).
- **Não achou negócio** → abre o **evento do Google já preenchido** (`gcalModalEvento`: título, dia, hora–hora+1, descrição da solicitação), sem criar tarefa em ninguém.
- Nos dois casos a solicitação ganha o andamento **"Atividade agendada: dd/mm às hh — título"** na linha do tempo e, se estava **sem próximo passo, passa a ter** (título + dia).
- Só na base dele: `novoOn('solic-agenda')`. Victor (com `solic-v2`) vê a V2 sem o 📅 até ele liberar.

### Prova
- Portão aberto (39 telas × 3 × 2, lpSelfCheck 0) · `--prova` OK · guard OK.
- `teste-solic-agenda.mjs` **20/20** em 390 e 1280: 📅 nas linhas (44px no celular), folha preenchida, atividade criada no negócio + fila do Google + andamento, ficha → sem negócio → evento do Google preenchido e a solicitação ganha próximo passo, Victor sem o botão, console limpo. `teste-solic` 26/26 e `teste-ini-acomp` 24/24 seguem.
- 2 invariantes novos.

### Pendente dele
- Liberar `solic-agenda` (e `ini-acomp`) pro Victor?

## 17/09/2026 (22ª onda) — INI-ACOMP-V1: cards de acompanhamento no Início · `solic-v2` liberado pro Victor (v7.80)

Voz dele, logo depois do "pode subir" da v7.79: *"ajusta já essa solicitação pro Victor poder acompanhar. E vou ter um card no Início — tanto pras solicitações/pendências como pra parte de benefício — pra estar com ele na onda das tratativas, assim como já tem o de atraso."*

### Liberação pessoa a pessoa (primeira vez que a regra de 16/09 rodou de ponta a ponta)
- `solic-v2` **saiu de `NOVO_SO_MEU` e entrou em `MODS`** com `def:false` e `views:[]` (não é tela, é capacidade dentro da tela Solicitações). `novoOn(k)` agora, pra chave que já saiu da lista mas está em `MODS`, **obedece ao mapa de módulos do usuário** (`modOn`).
- **Victor ligado direto no banco** (`lp_perfis.modulos → "solic-v2": true`). Operando a base dele (delegação) o Victor vê a V2 porque o dono é admin; na base do Daniel vê a antiga (Daniel não tem o módulo). Painel Master · Acessos mostra o toggle novo pra cada pessoa.
- Daniel segue na tela antiga até ele ligar.

### Cards novos no Início (só na base dele: `novoOn('ini-acomp')`)
- **📨 Solicitações em acompanhamento** — cabeçalho: "N em aberto · X prazo passou · Y paradas". Linhas (até 6): dias em aberto · segurado · badge (prazo passou / Nd sem andamento / status) · tipo · área · até <prazo> · ➡️ próximo passo · bola com. Vencidas primeiro, depois paradas, depois mudas. Clique abre a ficha V2. Botões: abrir Solicitações · ＋ nova.
- **🩹 Benefícios em regulação** — cabeçalho: "N em regulação · X exig. vencidas · Y parados · Z mudos". Linhas: dias · segurado · situação · 🔴 parado · evento · exigências (vencidas em vermelho) · ➡️ próxima ação até <prazo> (passou/hoje) · bola com. Clique abre o caso. Botões: abrir Benefícios · 🩹 abrir benefício.
- Os dois **nascem fechados**, entram **logo depois do Agora**, respeitam `modOn('backoffice')`/`modOn('beneficios')`, alvo ≥44px, sem estouro em 390.
- **Correção de painel que veio junto:** card novo do app entrava **no fim** da ordem salva (quem já tinha reordenado o Início ganhava a novidade escondida lá embaixo). Agora entra **no lugar natural**, logo depois do vizinho que a ordem já conhece (`pordOrdem`). Invariante atualizado com o caso que distingue.

### Prova
- Portão aberto (39 telas × 3 larguras × cheia/vazia, lpSelfCheck 0), `--prova` OK, guard OK.
- `teste-ini-acomp.mjs` 24/24 (390 e 1280): cards, número no cabeçalho, ordem, linhas, clique abre ficha/caso, Victor vê V2, Daniel vê antiga, ninguém além dele vê os cards. `teste-solic.mjs` 26/26 continua.
- 3 invariantes novos (cards testáveis por lista injetada; `novoOn` × `MODS`).

### Pendente dele
- Liberar `ini-acomp` (os cards) pro Victor também? Hoje só ele vê.
- Régua real de prazos por área (`SO_AREAS`) — continua chutada.

## 17/09/2026 (21ª onda) — SOLIC-V2: acompanhamento de solicitações e pendências, com prazo por área (v7.79)

Pedido dele por voz: *"módulo de acompanhamento de solicitações e pendências — o que entrou, o que está sendo tratado, os próximos passos, o tempo que está a solicitação, os prazos de cada área — até pra colocar o Victor como assistente nesse fluxo."* Exemplos dele: erro no fluxo de cobrança de uma cliente; benefício/app de cashback que não aparece pra outra.

### Diagnóstico antes de construir
- O módulo **Solicitações já existia** (tabela `solicitacoes`, RLS com `lp_donos_visiveis()` → o Victor já enxerga e grava pela delegação), mas estava magro: 3 linhas em prod, todas `alt_pag`/aberta de 02/09, nunca atualizadas. Sem área, sem prazo, sem linha do tempo, sem próximo passo.
- Decisão: **evoluir, não recriar.** Tudo atrás de `novoOn('solic-v2')` → só na base dele; Daniel/Victor seguem vendo a tela antiga (tabela), sem menu morto.

### O que entrou (banco — migration `solicitacoes_v2_acompanhamento.sql`, aplicada em prod 17/09, idempotente)
- `solicitacoes` ganha `area`, `prazo_area_dias` (gravado no dia da abertura — mudar a régua depois não reescreve o passado), `proxima_acao`, `proxima_acao_prazo`, `bola_com` (nos | cliente | area), `ultimo_toque_em`, `encerrada_em`. Caíram os CHECKs fixos de `tipo`/`frente` (vocabulário passa a viver no app).
- Tabela nova **`solicitacao_eventos`** (linha do tempo: abertura | contato | retorno | protocolo | prazo | status | nota), espelho da `beneficio_eventos`, RLS `lp_donos_visiveis()`.

### O que entrou (app)
- **Vocabulário novo de tipos** (`SO_TIPOS_V2`): erro no fluxo de cobrança, benefício/app não aparece, alteração de pagamento, postecipar, boleto, alteração de dados, anexar, reabilitação, consulta de valor, 2ª via, reclamação, outro.
- **Régua de prazos por área** (`SO_AREAS`): Assessoria (LM) 3d · Prudential Atendimento 5d · Cobrança 7d · Benefícios/App 10d · Subscrição 15d · Sinistro 30d · Outro 7d. Escolher a área na abertura preenche o prazo sozinho (editável). ⚠️ Régua **chutada por mim** — ele ajusta em `SO_AREAS` quando tiver os prazos reais.
- **Lista V2** com 4 lentes clicáveis: **Em aberto · Prazo passou · Paradas (3d+ sem andamento) · Sem próximo passo**; filtro por área; linha em 3 níveis (dias em aberto + segurado + status · tipo + área + prazo + "Nd sem andamento" · próximo passo + bola com). Vencidas primeiro. Régua de áreas no rodapé.
- **Ficha V2**: 4 KPIs (Aberta há · Com <área> até <prazo> · Último andamento · Bola com) e 3 blocos dobráveis que **nascem fechados**: Próximo passo (texto, até quando, bola com, área, protocolo, status), **Registrar andamento** (tipo + texto → evento + zera "último andamento") e **Linha do tempo**.
- **Salvar escreve o andamento sozinho:** mudou status/próximo passo/bola/área/protocolo → vira evento na linha do tempo sem ele precisar redigitar. `executada`/`cancelada` grava `encerrada_em`.
- **Início · Agora:** "N solicitações em acompanhamento", urgência 1 quando há prazo estourado ou parada.
- **Card do cliente (gaveta do negócio, Base, Carteira):** "📨 N solicitações em acompanhamento · prazo estourado" com botão **ver** (casa por nome normalizado ou nº de apólice).
- 11 invariantes novos no `lpSelfCheck`.

### Prova
- Portão aberto (39 telas × 375/1024/1280 × cheia/vazia, lpSelfCheck 0), `--prova` acusou o defeito, guard do choke point OK.
- Teste como usuário 390 e 1280 (`teste-solic.mjs`): 26/26 — lentes, ficha, registrar andamento, salvar com evento automático, encerrar, Agora, card do cliente, outro LP vê a tela antiga, console limpo. ⚠️ Lição: `innerText` não lê `<details>` fechado — teste de tela com dobra fechada usa `textContent`.

### Pendente dele
- **Liberar `solic-v2` pro Victor (e Daniel)?** Hoje só na base dele (🧪). Pro Victor virar assistente do fluxo, é tirar a chave de `NOVO_SO_MEU` (ou `MODS` com `def:false` e ligar por usuário).
- Ajustar a régua real de prazos por área.

## 17/09/2026 (20ª onda) — NIVER-FEITO-V1: "parabenizei → feito", por botão ou arrasto (v7.77)

Print dele do card de aniversariantes no iPhone: *"permitir que eu coloque os aniversários em que já dei parabéns como feito. Botão, ou tipo o e-mail, arrasta pro lado e dá baixa. Começa a ficar melhor a usabilidade."*

### O que entrou
- **✓ em cada linha** (desktop e celular) e, no celular, **arrastar a linha pro lado** (≥80px) mostra "✓ parabenizei" e dá baixa. Arrasto curto volta pro lugar. Toast com **desfazer**.
- Quem está feito **some da lista**; um chip **"✓ N feitos"** mostra os feitos (riscados, com ↩︎ pra desfazer). Sem feitos, o chip some e o modo desliga sozinho.
- **Lembrado entre aparelhos:** grava local na hora e no banco em seguida — tabela nova **`lp_niver_feito`** (dono, chave da pessoa, ano; RLS por dono, espelho da `lp_dup_fila`). Chave = a mesma pessoa do card (8 últimos dígitos do telefone ou nome) **+ ano**: ano que vem ela volta. Deslogado fica local; falha no banco não trava a tela.
- **Linha do card refeita** em duas linhas fixas (nome + ações · selos + 🎂) — antes o 💬 caía sozinho numa terceira linha como um quadrado de 44px.
- Nasceu sob a regra de 16/09 (`novoOn('niver-feito')`) e foi **liberado no mesmo dia** — palavra dele: *"pode liberar pro Daniel"*. Chave saiu de `NOVO_SO_MEU` (v7.78): todo LP vê o ✓ e o arrasto; cada um marca os seus (RLS por dono).

**Provas:** migração aplicada em produção · 8 invariantes · teste como usuário **16/16** em 390 e 1280 (✓ some · chip mostra e desfaz · arrasto de 120px marca · arrasto de 40px não · outro LP não vê · console limpo) · portão verde.

## 16/09/2026 (19ª onda) — DOBRA-FECHADA-V1: todo bloco dobrável nasce fechado (v7.75)

Print dele da gaveta do negócio, tudo expandido: *"toda vez que abro o card ele já vem expandido… pra consultar algo tenho que ir recolhendo cada um. Ajuste esse card e assume essa regra para TODOS os itens expansíveis ou retráteis, os de agora e os do futuro: ao abrir a tela, vir já encolhido. O usuário que vai abrindo cada tópico que quiser. Fluidez e menos fricção."*

### Virou regra permanente (CLAUDE.md) e fonte única no código
`dobraAberta(chave, estado)` no `vendas.html`: **fechado a menos que ele tenha aberto** (escolha lembrada por aparelho onde o sistema lembra). Na Revisão de Proteção, `blkFechado()` / `secMSFechada()` (estado no documento, como já era). O cabeçalho fechado continua com o resumo — encolher nunca apaga o número. Toda tela com blocos tem abrir/fechar tudo.

### Onde mudou (inventário completo)

| Tela | Antes | Agora |
|---|---|---|
| **Gaveta do negócio** (o print) | 7 seções abertas por padrão + "Quem é a pessoa" aberto | **todas fechadas**; "Expandir tudo" no topo |
| **Início** | agora, números, aniversariantes, funil NN, radar CF… abertos | **todos fechados**; resumo no cabeçalho; "abrir tudo" |
| **Ficha do lead** (Estoque) | "Quem é a pessoa" e Qualificação abertos, sem memória | **todos fechados**, ganhou **memória por aparelho** e botão **⌄⌃ tópicos** (maioria aberta → fecha; senão abre) |
| Repertório (ontem) | nascia aberto | fechado; o resumo do cabeçalho diz a situação |
| Filtros do TA | abriam sozinhos quando tinham valor | fechados; o valor aparece no resumo do cabeçalho |
| SitPlan "Do Estoque de Nomes" | abria se tinha gente na lista | fechado; a contagem está no título |
| Relatório "Detalhado" | abria com ≤12 linhas | fechado |
| Benefícios (docs, exigências) | abertos | fechados |
| Varredura diária | abria com alerta | fechada; nº de alertas no título |
| **Revisão de Proteção** — blocos das 6 etapas e seções da Mudança de Seguro | abertos | **fechados**; clique abre e grava no documento |

Fora da regra, de propósito: a **apresentação/impressão pro cliente** (ali o documento sai inteiro).

### v7.76 — "tem botão de expandir tudo mas não tem de encolher tudo"
Tinha um botão só, que trocava de rótulo pela **maioria**: com 2 de 12 seções abertas ainda dizia "Expandir tudo" — e não havia como recolher. Agora são **dois botões fixos** (⌄ Expandir tudo · ⌃ Recolher tudo) na gaveta do negócio, no Início e na ficha do lead. Teste como usuário 29/29.

### Guarda pro futuro
Invariante varre **todos os scripts** e fecha o portão se aparecer um `details` com `open` escrito literal — abrir só via escolha gravada. (Ele se acusou duas vezes na hora de nascer: o próprio comentário e a própria mensagem soletravam a tag. Corrigido reescrevendo sem soletrar.)

**Provas:** 9 invariantes novos + 2 antigos atualizados (eles codificavam o padrão aberto) · teste como usuário **25/25** (Início 12 blocos fechados · gaveta 12 seções fechadas e a que ele abriu continua aberta ao reabrir · ficha do lead 6 grupos fechados, memória e "tópicos" nos dois sentidos · Revisão de Proteção blocos fechados e clique grava) em 390 e 1280 · portão verde nos 6 cenários.

## 16/09/2026 (18ª onda) — REPERTÓRIO-V1: o script certo da recomendação, na ficha do lead (v7.74)

Ele mandou a spec (handoff) antes de dormir: *"dentro do painel do lead, dar ao LP o SCRIPT certo pra cada situação de recomendação, já com nome do lead e do recomendante preenchidos, a um clique de copiar. Roda tudo autônomo, quero acordar com isso no ar. Depois roda a skill de UX 2x e a de engenharia 2x."*

### Uma decisão que precisou ser tomada sozinho (registrada aqui pra ele conferir)
A spec citava campos da tabela **`leads`** (`tentativas_ligacao`, `inbox_hot`, `data_status_atual`, `agendamento`). Essa tabela é a da **Captação (index.html)** — recrutamento de LP, outra visão, outra sessão. Mas os 5 scripts são de **venda de proteção** ("como fica sua proteção", reunião de 20 min): isso é o **lead do Estoque de Nomes do vendas.html**, que tem `recomendante`, `hist` de TA, estrelas ANCE e `estagio`. Construí no lugar certo e traduzi os sinais campo a campo (`repSinais()`):

| Spec | Campo real do Estoque |
|---|---|
| `tentativas_ligacao` | nº de TAs no `hist` |
| `agendamento ≠ null` | estágio "OI agendado"/"Cliente" ou último TA = "agendou" |
| `inbox_hot` | Quente pelo ANCE (≥4 estrelas) ou prioridade P1 |
| `data_status_atual` | dia do último TA; sem TA, o dia em que entrou |

Ninguém lê `leads` a partir do `vendas.html` (o guard de CI continua valendo). Segundo ajuste de julgamento: a regra 1 (≥4 tentativas sem agendar → *reativar pela ponte*) **exige um recomendante de verdade** — sem ponte não há quem reativar; cai pra próxima regra.

### T1 — `kb_scripts_captacao` (espelho da `kb_scripts_cobranca`)
Migração **idempotente** (create if not exists · drop/create policy · upsert por `gatilho`), mesma postura de RLS (leitura `crm_autorizado()`, escrita `lp_sou_admin()`). **Aplicada 2x no projeto de produção** e conferida: 5 linhas, 5 ativas, 5 gatilhos distintos, 0 fixtures; `kb_scripts_cobranca` **3 antes, 3 depois**. Os 5 textos são de produção, dele.

### T2 — fonte única
`repSugerir(lead)` decide o gatilho (ordem da spec; `so_texto` nunca sai sozinho). `repResolver(lead, script)` troca `{primeiro_nome}`/`{recomendante}` e devolve se **pode copiar** — texto liberado **nunca** carrega `{chave}`; sem recomendante num script que o usa, a cópia trava. Textos do banco; `REP_FALLBACK` com o mesmo conteúdo cobre offline/deslogado/portão (invariante confere as 5 chaves). Sem nome, a saudação sai limpa ("Olá, tudo bem?").

### T3 — a seção "Repertório" na ficha
Logo abaixo da Qualificação do TA (onde o recomendante mora). Selo **★ sugerido** + seletor pros 5 gatilhos (troca = texto muda na hora, selo vira "escolhido") · "enviar para:" (o lead pelo primeiro nome, ou o recomendante quando é a ponte) · horários entre `[colchetes]` destacados e contados · aviso + **Copiar travado** sem recomendante — e **digitar o recomendante (sem salvar) já destrava** · **📋 Copiar texto** · **💬 WhatsApp** com o texto já dentro (só quando o alvo é o lead e há telefone). Nada grava no lead nem no banco.

**Nasce sob a regra de 16/09:** `novoOn('repertorio')` — só ele vê. Daniel abre a mesma ficha sem a seção.

### UX (2 passadas, medidas)
1ª: seletor cortava a situação no celular ("★ Quente: pediu o próxim…") → linha inteira, selo em cima · Copiar travado **parecia ativo** → opacidade .45 · "2 horários pra / completar" quebrando no meio → peças · botões de dedo 44px · **WhatsApp com o texto** (1 toque em vez de copiar → 💬 → colar).
2ª: WhatsApp era `<a>` sublinhado em 2 linhas → botão "💬 WhatsApp" · pendência virou **chip âmbar** (a cor dos horários no texto — ensina o amarelo).

### Engenharia (2 passadas)
1ª: **corrida** — a 1ª carga do banco redesenhava a ficha do lead que *abriu a sessão*, não a que estava na tela; agora lê o `data-id` da própria seção.
2ª: redesenhar reabria o bloco que ele tinha fechado → preserva · falha transitória na 1ª carga prendia o app no fallback a sessão inteira → tenta de novo na próxima ficha.

**Provas:** 28 invariantes novos (14 regras da spec + 9 tela + 5 UX/eng) · teste de ponta a ponta **como usuário** (abre ficha, vê sugestão, troca, digita recomendante, copia, WhatsApp, outro LP não vê) **28/28 em 390px e 1280px** · portão verde nos 6 cenários · `--prova` acusando o defeito injetado.

**Aceite da spec, item a item:** migração 2x = 5 ✅ · quente → `quente_pediu_passo` com nome ✅ · 5 tentativas sem agendar → `reativar_recomendante`, destino recomendante, texto pro recomendante ✅ · 20 dias parado → `quer_nao_senta` ✅ · sem recomendante → aviso + cópia travada ✅ · clipboard sem `{chave}` ✅ · trocar gatilho muda na hora ✅ · `kb_scripts_cobranca` igual antes/depois ✅ · sem `%Exemplo%`/`%Teste%` ✅.

## 16/09/2026 (17ª onda) — O app avisa quando saiu versão nova (v7.73)

Ele disse **"bota no ar" três vezes seguidas**. Estava no ar — conferido buscando o arquivo público (`<title>… v7.72 …</title>`, hash igual ao local). O que estava velho era **o app aberto no iPhone dele**.

### A causa, e por que não era óbvio
O service worker é **network-first**: qualquer carga nova traz o código novo, ninguém fica preso. Mas uma aba (ou atalho na tela de início) que passa dias sem recarregar **segue rodando o JS antigo** — e ele não tinha nenhum sinal disso. O conserto existia (⋯ → Atualizar app), mas dependia de ele **adivinhar** que precisava.

### AVISO-VERSAO-V1
- Guarda a **assinatura (ETag)** do próprio arquivo na abertura e confere de 15 em 15 min com um **HEAD** — só cabeçalho, nada dos 1,6 MB, nada de dado. Confere também quando ele volta pro app (`visibilitychange`).
- Mudou a assinatura → faixa com **um botão: Atualizar**. Mais um ✕ pra dispensar.
- **Nunca recarrega sozinho.** Ele pode estar no meio de uma ligação com cliente; perder a tela seria pior que a versão velha.
- Sem ETag (offline, outro host) **não inventa aviso**; a primeira leitura é a versão que ele está rodando, não um alarme.
- A faixa vive **fora do `#main`** — navegar não pode fazer o aviso sumir.

Conferido contra o host real: o GitHub Pages manda `etag: "6aaa07dc-19bc11"`, e o mesmo ETag volta com o cache-buster na query.

### Primeira feature nascida sob a regra de hoje
Entrou em `NOVO_SO_MEU` como `'aviso-versao'` — **só ele vê**. Daniel e os outros não recebem nada até ele validar e mandar liberar. Aparece no Painel Master · Acessos → 🧪 Ainda só na sua base.

**Provas:** teste de ponta a ponta com servidor trocando a assinatura — **24/24 em 390px e 1280px** (primeira leitura quieta · aparece no deploy · cabe na tela · alvo ≥44px no dedo · dá pra fechar · não recarrega sozinho · o botão dispara o Atualizar · outro LP não vê · admin vê · console limpo). 9 invariantes novos. Portão verde nos 6 cenários.

## 16/09/2026 (16ª onda) — Regra nova: coisa nova nasce só na base dele (v7.72)

Palavra dele: *"tudo que eu for criando primeiro fica na minha base. E só depois você vai me perguntando se eu já libero pro Daniel ou pros outros usuários. Esses que já estão, deixa como tá. Primeiro eu desenvolvo bem, depois eu valido pra liberar sem erro e funcionando bem."*

### Como ficou (usando o que já existia, sem sistema paralelo)
O app já tinha `MODS` + `lp_perfis.modulos` — mas isso gateia **MENU**, ou seja, tela inteira. A maior parte do que ele pede nasce **dentro** de uma tela (um card do Início, um campo da ficha, uma coluna). Então entrou uma porta irmã, do mesmo tamanho do problema:

- **`NOVO_SO_MEU`** — registro `{chave: {o:'o que é', desde:'AAAA-MM-DD'}}`.
- **`novoOn('<chave>')`** — `true` só pro admin (ele). Chave fora da lista → `true` pra todo mundo, então **o que já estava no ar não mudou nada** (ele pediu isso explicitamente; a lista nasceu **vazia**).
- **Sem login** (base local dele) nada é escondido.
- **"Ver como" outro dono** mostra a **ausência** da novidade — é assim que ele confere antes de liberar.

### Liberar (decisão dele, nunca minha)
| Quero liberar | O que se faz |
|---|---|
| pra todo mundo | tira a chave de `NOVO_SO_MEU` |
| pessoa a pessoa | tira daqui e registra em `MODS` com `def:false` → ele liga por usuário no Painel Master |

Ele revisa a lista em **Painel Master · Acessos → "🧪 Ainda só na sua base"** (com a data de cada uma). Hoje: *"Nada em provador agora"*.

A regra virou linha fixa no `CLAUDE.md`, junto com a de mobile+desktop e a do portão.

**Provas:** 7 invariantes novos (não-listado passa · admin vê · outro LP não vê · ver-como esconde · tirar da lista libera · sem login vê · o painel lista), portão verde nos 6 cenários.

## 16/09/2026 (15ª onda) — Visão Consolidada reformada pelos prints do iPhone (v7.71)

Ele mandou 5 prints da Consolidada no iPhone e descreveu um a um: *"essa tela ficou muito boa... agora ajusta logo o layout"*. Rodado com a skill **construir-time-ux** (medir antes → mexer → medir depois), celular e desktop juntos.

### O que ele apontou → o que foi feito

| Ele disse | Causa | O que mudou |
|---|---|---|
| *"o cifrão tá ali, os números embaixo"* | 5 KPIs em 3 colunas + `overflow-wrap:anywhere` quebravam **dentro** do valor | 2 colunas no celular e `white-space:nowrap` no valor (`.kpis-consol`) |
| *"tira ticket médio e bota PA médio"* | vocabulário errado | rótulo **PA médio** |
| *"esse card de entrega + encerrados eu não entendi"* | somava **apólice ganha** com **negócio perdido** | virou **"A entregar"** — R$ de PA emitido esperando delivery, com a contagem de apólices. Encerrado continua na régua |
| *"essas descrições explicando, pode ir tirando"* | subtítulo da tela, `desc` de cada etapa, rodapé do de-para | saíram os 3 |
| *"aqueles textinhos de rodapé, tipo sem valor lançado"* | rodapé de linha para valor zero | zero não aparece: sem ponderado, sem sub-linha |
| *"está aparecendo base de negócio, base de negócio"* | o nome inteiro do funil repetido em toda linha | vira **sigla** (NN/BC), e **só quando há mais de um funil somado** |
| nome e valor cortados na direita | `.cs-lin` era uma faixa `nowrap` de 3 colunas | no celular o nome pega a linha inteira e etapa+PA descem pra segunda |
| o botão **fechar** quebrando o título | botão solto dentro do `.tar-grp` | cabeçalho próprio (`.cs-grp`) com o botão na ponta |

Extras da mesma passada: **"Parados" virou caminho** (toca e vai pra lista de travados, padrão LENTE), a barra da régua ficou **44px** no celular (era 30 — alvo de mouse), a coluna de dinheiro da tabela "Por funil" parou de quebrar o `R$`, e no celular o PA deixou de ser repetido embaixo da barra que já o escreve.

### Um bug sério achado de passagem — no card de aniversariantes
O `onclick` de cada aniversariante saía com um `${...}` **literal** (escape a mais no patch do NIVER-V2): `cartAbrir('${esc(jsq(String(c.ref)))})`. **Clicar em qualquer aniversariante estourava `Invalid or unexpected token` e não abria nada** — desde a v7.69. Corrigido nos 3 caminhos (cliente, negócio, lead), com invariante que **compila** o onclick (`new Function`) para não voltar.

### Medido (base inventada, 33 negócios em 2 funis)

| | antes | depois |
|---|---|---|
| textos recortados a 390px | **7** | **0** |
| alvos de toque <44px a 390px | **13** | **0** |
| estouro horizontal (390 e 1280) | 0 | 0 |
| clique no aniversariante | ❌ erro de sintaxe | ✅ abre a ficha |

**Provas:** portão verde nos 6 cenários (39 telas × 375/1024/1280 × cheia/vazia), `--prova` acusando o defeito injetado, 7 invariantes novos, teste de clique antes×depois.

## 15/09/2026 (14ª onda) — NIVER-V2: aniversariantes de TODAS as bases (v7.69)

Ele: *"foi aniversário do Felipe Leonardo ontem e do Sinval hoje, e nenhum dos dois apareceu. Esses dois têm apólice comigo E com o Daniel."* E o pedido junto: *"quero aniversariante GERAL, não só cliente — prospect e lead também, com filtro, porque dar parabéns é ponto de contato que ajuda a venda depois."*

### Três causas somadas (as duas primeiras ele viu; a terceira estava escondida)
Conferido no banco — os dois existem, com a data certa:

| Caso | Onde está | Por que sumiu |
|---|---|---|
| **Sinval** (hoje, 15/09) | carteira do **Daniel** | `cartVis()` corta pelo **escopo** da tela |
| **Felipe Leonardo** (ontem, 14/09) | carteira do **Daniel** | mesmo corte **+** o card só olhava pra frente (ontem virava "faltam 364 dias") |
| **Cinthia e Diego** (hoje, 15/09) | base **dele**, rótulo **`lp: Rebeca`** | `pxLpOk` corta pelo **rótulo** — 2 dos 3 do dia |

Medido com os 4 casos reais: **motor antigo devolvia 0 aniversariantes hoje; o novo devolve os 4**, cada um com a carteira de origem.

### O que o NIVER-V2 faz
- Lê **todas as bases que ele tem direito de ver** (o RLS já manda — ele é delegado do Daniel), com **selo de qual carteira** e filtro por LP. Aniversário é exceção declarada ao escopo: é ponto de contato, não recorte de operação.
- Inclui **quem passou há até 3 dias** ("foi ontem") — ainda dá pra ligar.
- Junta **carteira + negócios do funil + leads do Estoque**, com filtro por tipo (🛡 Cliente · 🎯 Negócio · 📇 Lead).
- **Mesma pessoa em duas bases = uma linha**, com os dois selos (o Sinval está na carteira do Daniel e como negócio na dele).
- **Data de nascimento virou campo editável na ficha da pessoa** — é isso que põe lead e negócio na lista.

### Estado do dado (sem maquiar)
222 clientes da carteira têm nascimento (**146 dele + 76 do Daniel**); **nenhum dos 6.851 contatos tem**. Enquanto a importação não trouxer a data, a lista sai só com clientes — a capacidade está pronta e o dado entra sozinho quando chegar.
Na janela de hoje: **1 que passou · 3 hoje · 4 nos próximos 7 · 19 no mês** (9 deles da carteira do Daniel, que ele nunca via).

**Provas:** teste novo **22/22** nos dois tamanhos reproduzindo os casos reais; **8 invariantes** novos (inclusive o do rótulo Rebeca); portão verde; 7 suítes anteriores verdes.

## 15/09/2026 (13ª onda) — O app parou de FALAR SOZINHO na abertura (v7.68)

Print dele: quatro avisos empilhados na tela, em toda abertura. *"Essas msgs ficam aparecendo toda hora em qualquer device ou navegador."* Não era o cache do aparelho — eram **dois defeitos somados**, e um deles é sério.

### 1. SELF-CHECK-MUDO-V1 — o self-check falava e gravava como se fosse ele
`lpSelfCheck()` e `funSelfCheck()` rodam **no boot do app de produção** (linha do boot, sempre rodaram). Alguns invariantes exercitam funções **de verdade**:
- `bnJuntar(...)` → 2× toast **"Fundidos — reversível em Decididos"** + `bnSalvar()` + `_bnDupSync()` (**escrita remota** com dados de teste);
- `consolToggle(...)` → toast **"Deixe pelo menos um funil marcado"**;
- e o `bnSalvar()` desses invariantes, na base de 5,2 mil nomes, **estoura a cota** → toast **"Cache do navegador cheio"**.

Resultado: **4 avisos em toda abertura, em qualquer aparelho**, sem ele ter tocado em nada. Conferido no banco: **0 lixo** chegou em `lp_dup_fila` (a escrita remota não vingou), mas o risco existia.

**Correção — trava geral, não remendo por invariante:** enquanto o self-check roda, o app fica **mudo** (`toast`/`toastDesfazer` no-op), **não grava no aparelho** (`salvar`/`bnSalvar`/`gsyncSalvar`/`cartSalvar`) e **não sobe nada** (`bnAgendarPush`/`_bnDupSync`/`pendMarcar`). As funções reais ficam em `__SC_REAL` — e o invariante da cota passou a chamá-las, senão passaria de graça (*um teste que não pode falhar não é teste*).

### 2. QUOTA-V2 — o cache não cabia, e o app insistia
A base dele tem **5.261 nomes** (3 MB já comprimidos no Postgres) — como JSON **não cabe** nos ~5 MB do localStorage. O app tentava gravar tudo a cada save e o navegador recusava, **sempre**. Agora o cache do Estoque tem **orçamento de 1,5 MB**: grava o que cabe, priorizando quem serve na abertura (lista do dia primeiro, depois os mexidos por último) e marca `parcial`. Nada se perde — o Estoque inteiro vem do servidor a cada carga. Só avisa se nem a fatia couber.

### Sobre o menu "abrindo sozinho"
Medido em **375, 640, 768, 834, 900, 980, 1024 e 1280**: a gaveta abre em todas, o véu fecha ao toque e a rolagem destrava. O que o print mostrava era a tela **com os quatro avisos empilhados** — sintoma dos defeitos acima, não do menu.

**Provas:** **teste de usuário novo (28/28)** com base do tamanho da dele — 5.200 nomes no Estoque, 200 negócios, 222 clientes — em celular, iPad retrato, iPad paisagem e desktop: 0 aviso no boot, cache em 1.105 KB, menu abrindo de verdade, passeio por 9 telas + criar/concluir tarefa sem exceção. Portão verde, 5 invariantes novos, 7 suítes anteriores verdes, `--servido` conferido.

### Backup antes da Apple
O MacBook vai para reparo **sem backup** (não liga). Subi ao Drive, na pasta *Pipe X - Captacao Life Planner*: **MAPA DE CONTINUIDADE** (o que está seguro, o que só existe no Mac, o que pedir à Apple, e como recomeçar do zero) e o **delta 05/09→15/09** do ESTADO (a cópia do Drive tinha parado em 05/09).

## 15/09/2026 (12ª onda) — NASC-UM-CLIQUE-V1: a data de nascimento resolve todas as apólices

Ele escolheu o **caminho A**: em vez de digitar a idade de emissão apólice por apólice, informar **uma** data de nascimento e deixar o app calcular a idade exata de cada contrato (*nascimento × emissão*).

- Quando algum ativo está com a idade na emissão **ESTIMADA**, o app pede o dado **no lugar em que a diferença aparece** (topo do bloco de ativos); o botão leva à etapa 1, rola até o campo, põe o cursor e abre o seletor de data.
- O aviso é **só do consultor** (`so-consultor`) — o cliente não lê pedido de cadastro no material dele. Com a data preenchida, o aviso some sozinho.
- O espelho colado **já trazia** "Data de Nascimento" quando o documento tem (`cli.nasc` → `state.cliente.nasc`); o pedido só aparece quando o dado realmente falta.

**Por que importa, no número:** no caso de teste a estimativa dava 35 anos e a data real dá 34 — **44,1% contra 43,0%** de resgate no 10º ano. Um ano de diferença muda o valor que vai pro cliente.

**Provas:** 3 invariantes novos no `selfTestFam` + teste funcional novo **14/14** com clique de verdade nos dois tamanhos (inclusive a mudança do percentual); tarifas 45/45; carreira 17/17; 390/834/1280 sem estouro nem exceção; servido pelo Pages conferido pelo hash (`cdf408708f52`).

## 15/09/2026 (11ª onda) — Revisão de Proteção: a projeção do valor de resgate voltou

Print dele: no ativo que o cliente **já tem**, a coluna "Resgate — valor e % do capital" com **traço em toda linha** e as barras do gráfico vazias. Eram **dois defeitos somados**:

1. **Barras vazias — regressão minha (8ª onda).** A passada de "vírgula decimal" trocou o ponto por vírgula **também dentro de `style="width:…"`**. CSS não aceita vírgula decimal: `width:2,3%` é inválido e o navegador ignora — toda barra do arquivo (curva de resgate, capital ano a ano, comparativo, planos) ficou vazia. Voltaram ao ponto; a vírgula fica só no texto que a pessoa lê.
2. **Coluna de resgate em branco — antigo.** A tabela é lida por **produto + sexo + IDADE NA EMISSÃO**. Quando o espelho colado não traz "Idade na Emissão", a idade ficava nula, a curva vinha vazia e a coluna virava "—" **sem dizer por quê**.

**Correção (RESGATE-VOLTA-V1):** a idade na emissão passa a ser **deduzida** — *data de nascimento × data de emissão* (exata) ou, na falta do nascimento, *idade de hoje − anos de contrato*, e nesse caso marcada como **ESTIMADA** (pode variar 1 ano conforme o aniversário), com pedido de confirmação ao consultor. Idade digitada na apólice sempre vence. E quando ainda assim não houver curva, a tela **diz o motivo**: produto sem tabela na base (WD, p.ex.), idade ausente, ou idade fora da faixa 14–70.

**Livro de erros #18 — vírgula decimal não entra em CSS.** Formatação br ("1,9%") é para o texto que a pessoa lê; `width`, `left`, `flex` e afins precisam de ponto. Ficou um **invariante que rejeita qualquer largura montada com vírgula** — esse erro não volta.

**Provas:** 7 invariantes novos no `selfTestFam` (curva com e sem idade, dedução exata, dedução estimada, motivo de cada caso, guarda do CSS); `selfTest` de tarifas 45/45; 390/834/1280 sem estouro nem exceção; teste funcional da carreira 17/17. Servido pelo Pages conferido pelo hash.

## 15/09/2026 (10ª onda) — ORGANIZAR PAINEL (fila B, item do 2.0)

**v7.67.** O Início tinha ordem **fixa** e cada card só abria/fechava. Mas a ordem certa depende do ciclo — em semana de ligação o **TA** é o primeiro, em semana de agenda são as **Reuniões** — e card que ele não usa só empurrava o resto pra baixo (no celular, várias telas de rolagem antes de qualquer coisa acionável).

- **⋮⋮ organizar painel** no topo do Início: **↑ ↓** move, **🚫** esconde, **↺** volta ao padrão, **✓ pronto** sai do modo.
- **Botões, não arrastar** — de propósito: mesmo gesto no mouse e no dedo, alvo de 44px, e sem brigar com a rolagem do celular (arrastar card longo em tela de 390px é cilada).
- **Não vira esconderijo:** card escondido continua listado no modo organizar com o botão de trazer de volta, e o painel avisa *"N cards escondidos"* quando há algum.
- **Card novo do app entra no fim sozinho** — nunca nasce escondido, nunca some porque a preferência é velha. Preferência corrompida no aparelho não derruba o Início.
- **Por aparelho** (`crmlp_painel_v1`, localStorage), como o abre/fecha dos blocos — é preferência de tela, não dado de conta (fora do `CONTA_CHAVES`, de propósito).

**Provas:** portão verde (39 telas × {375,1024,1280} × {cheia,vazia}), **8 invariantes novos** no `lpSelfCheck` (ordem natural, card inexistente, mover, esconder/mostrar, restaurar, card novo no fim, preferência corrompida, chave de tela), teste funcional novo **19/19** com clique de verdade nos dois tamanhos (inclusive **fechar e abrir o app** e voltar com a ordem dele).

**Nota de escolha (fila B):** o item *"extensão WhatsApp no CRM"* ficou **na frente da fila, mas não foi feito agora** — é extensão Chrome MV3, que ele **não consegue instalar nem testar no iPad**. Fica pro MacBook voltar do suporte; enquanto isso a fila anda no que ele usa hoje.

## 15/09/2026 (9ª onda) — CARTEIRA NO MAPA (fila B, item 2)

**v7.66.** Segundo item da frente **MAPA & LOCAIS**: o Mapa de locais só enxergava **lead e negócio**. Os **clientes da carteira** — que são justamente quem ele visita — ficavam de fora do mapa e da rota do dia.

- **Cliente da carteira tem local igual ao resto do app:** mesmo buscador de endereço (OSM/Google), mesmas **rotinas** (dia/turno: "T. atende no RHP sexta de manhã"), mesmo pino, mesma rota. O editor entra na ficha do cliente, no tópico **Pessoa e família**.
- **Onde o dado mora:** `carteira_perfil.dados.pontos` (por dono+ref, já sincronizado no Supabase) — de propósito **fora de `carteira_clientes`**, que a importação apaga e reinsere. O campo antigo `locais` (texto livre "Recife, Petrolina") continua onde estava; `pontos` é o endereço **com lat/lng**.
- **Ninguém vira dois pinos:** se o nome já entrou como lead/negócio, o cliente não repete — e o **contato do funil sem local próprio herda o do cliente** (`locDePessoa`). Um pino, um endereço.
- **Filtro novo no mapa:** *Carteira (clientes)*. Filtro de funil/etapa/status continua sendo coisa de funil e não traz cliente.
- **Na rota do dia:** evento do Google com o **nome do cliente no título** ("Entrega de apólice — T. L.") passa a usar o **endereço da ficha dele**, com selo 🛡 Cliente e link pra ficha da carteira. Nome de uma palavra só **não** vira palpite.
- **Celular:** o editor de locais ganhou alvos de 44px (a regra geral do celular parava em 42 por causa do `:not()`, que pesa mais que `.loc-busca` — por isso a correção mora dentro do bloco do celular, não como remendo).

**Provas:** portão verde (39 telas × {375,1024,1280} × {cheia,vazia}), **8 invariantes novos** no `lpSelfCheck` (pino, rotina, dedupe, filtro, rota pelo nome, gravação pelo caminho real, id de DOM com espaço/acento), teste funcional novo **13/13** nos dois tamanhos, e as 4 suítes de antes seguem verdes (gsync 17 · agenda 14 · atividade 14 · estabilidade).

**Fila B, o que resta:** extensão WhatsApp no CRM · "Organizar painel" (feito na 10ª onda) · *(terceiros)* Victor resubir emitidas, Daniel subir a carteira real.

**Bônus da onda (PORTAO-LINUX-V1):** o portão só sabia abrir o Chrome do **macOS** — nesta sessão (iPad → sessão na nuvem, Linux) ele caía no `open`, que não existe lá, e terminava em *"sem resultado em 300 s"*. Agora procura o navegador nos dois mundos (`PORTAO_CHROME` manda em tudo) e usa `--no-sandbox` quando é container. `--prova` conferido: o guarda acusou o defeito injetado.

> ### ⏯️ RETOMAR AQUI (ponto de retomada — 15/09)
> **`main` = v7.67**, portão verde (39 telas × {375,1024,1280} × {cheia,vazia}) e `--prova` OK.
> ```
> Sessão CRM Visão LP — retomar. v7.67 no ar. Ler o topo do ESTADO (ondas 6→10).
> Últimas entregas: CARTEIRA-NO-MAPA-V1 (cliente da carteira com local/rotina no mapa e na rota;
> dado em carteira_perfil.dados.pontos; dedupe com lead/negócio; filtro "Carteira"; 44px no celular)
> + PORTAO-LINUX-V1 (o portão roda no Linux desta sessão) + PAINEL-ORGANIZAR-V1 (⋮⋮ organizar
> painel no Início: ↑ ↓ esconder, por aparelho em crmlp_painel_v1).
> Fila B que resta: extensão WhatsApp no CRM (só com o MacBook — MV3 não roda no iPad) ·
> (terceiros) Victor resubir emitidas, Daniel subir a carteira real.
> Regras de sempre: git fetch antes, grep -a no vendas.html, portão verde e --servido depois do merge.
> Testes fora do portão (scratchpad): teste-gsync 17 · teste-agenda 14 · teste-atividade 14 ·
> teste-estabilidade · teste-carreira 17 · teste-carteira-mapa 13 · teste-painel 19.
> Atenção (livro de erros #18): vírgula decimal é só para TEXTO — nunca dentro de style="width:…".
> ```

## 15/09/2026 (8ª onda) — Carreira do ativo: LIGADA no documento do cliente + vírgula decimal

Ele repetiu o pedido da Revisão de Apólice ("quero esse mesmo tópico do ativo quando eu monto o plano proposto, pra mostrar ao CLIENTE a evolução ao longo do período"). A tela já existia (CARREIRA-PLANO-V1, 5ª onda) — o que faltava era ela **chegar ao cliente**:
- A seção **"O que este plano vira em patrimônio"** nascia **desligada** no material do cliente (`show.carreira:false`). Como o pedido é justamente mostrar ao cliente, agora **nasce ligada** — ele tira no ✓ quando não quiser.
- **Vírgula decimal** nos percentuais de resgate (15 pontos): num documento em português que vai pro cliente, "1.9%" estava errado — agora "1,9%".

**Provas:** teste funcional da carreira 17/17 com o motor real; `selfTest` do arquivo 45/45; 390/834/1280 sem estouro nem exceção.

## 14-15/09/2026 (7ª onda) — ROTA DO DIA (fila B, item 1)

**v7.65.** Ele liberou a fila: *"pode seguir o caminho B e vai andando… quero que você opere bem aí."* Primeiro item da frente **MAPA & LOCAIS**: a **rota do dia**.

O app já sabia duas coisas separadas — **onde** cada pessoa fica (locais na ficha) e **o que** está combinado (atividades + Agenda Google). Faltava cruzar.
- **No topo do Mapa de locais:** o dia em **ordem de hora**, com endereço, **distância entre as paradas** e o total.
- **O que entra:** atividade do CRM com data no dia (local = local de trabalho da pessoa) **+ evento do Google com local preenchido**. Evento que nasceu de atividade (`crmTarefa`) **não entra duas vezes**.
- **🗺️ Traçar no Maps:** uma URL só com origem, destino e todas as paradas do meio na ordem — ele só dirige.
- Por parada: abrir a ficha, ligar, WhatsApp e abrir aquele endereço no Maps. Seletor **Hoje / Amanhã**.
- **Honestidade:** a distância é **em linha reta** (haversine) — o app não tem roteirizador, e a tela escreve isso. Quem não tem local cadastrado **aparece pedindo cadastro**, em vez de sumir da rota.
- Medido com 5 paradas reais de Recife: 13,4 km, 0 exceção, 0 estouro em 390 e 1280.

**Provas:** portão 6/6 verde (39 telas), 6 invariantes novos da rota, 4 suítes funcionais verdes. O portão acusou 2 alvos de toque <44px (o seletor Hoje/Amanhã) — corrigido antes de subir.

## 14/09/2026 (6ª onda) — Painel TA: Delay só é Delay · fila "TA não atendeu" · autoria do Victor

> ### ⏯️ RETOMAR AQUI (ponto de retomada — 14/09, 20h40)
> **`main` = v7.64 no ar e conferido pelo `--servido`.** Sessão feita do iPad (MacBook no suporte Apple), tudo direto na main com autorização dele no chat ("pode executar tudo e ir pro ar").
> **Prompt pra próxima sessão:**
> ```
> Sessão CRM Visão LP — retomar. v7.64 no ar (ler o topo do ESTADO: 6 ondas do dia 14/09).
> Entregue hoje: GCAL-BIDIRECIONAL-V1 (fila persistida crmlp_gsync_v1, volta do Google) ·
> ESTABILIDADE-DE-TELA-V1 (render/renderDrawer preservam rolagem+foco) · AGENDA-FLUIDA-V1
> (arrastar pra mover, título nítido, nada trava) · FUNIL-CONSOLIDADO-V1 (tela 'consolidado') ·
> IPAD-SEM-FAIXA-V1 (portão passou a medir 1024) · ATIVIDADE-UX-V1 (tarDe/tarPar, editar/excluir) ·
> GTASKS-V1 (com hora→Agenda, sem hora→Tarefas do Google) · AGENDA-NEGOCIO-V1 (evento sabe de que
> negócio é) · CARREIRA-PLANO-V1 (revisao-protecao.html: carreira do ativo no plano novo) ·
> TA-LISTAS-V2 (Delay × TA não atendeu × Ficou pra trás) · AUTORIA-V1 (quemFez() = e-mail logado).
> Testes fora do portão (playwright, no scratchpad da sessão): teste-gsync 17 · teste-agenda 14 ·
> teste-atividade 14 · teste-estabilidade · teste-carreira 17. Regras de sempre: git fetch antes,
> grep -a no vendas.html, portão verde (agora 39 telas × {375,1024,1280} × {cheia,vazia}) e
> --servido depois do merge. Fila dele: MAPA & LOCAIS (rota do dia, locais na carteira) ·
> extensão WhatsApp no CRM · 'Organizar painel' do 2.0 · (terceiros) Victor resubir emitidas,
> Daniel subir a carteira.
> ```
> **Por que este bloco existe:** o iPad dele derruba a navegação no meio da conversa. Se a sessão se
> perder, este parágrafo é o suficiente pra qualquer sessão nova continuar de onde parou.

**v7.64.**
### Listas do Painel TA (TA-LISTAS-V2)
Pedido dele: *"esse filtro tá puxando da lista de TA quem não atendeu, e o caso aqui é o que tem STATUS DELAY — ex.: delay OI, delay P/C. Cria um filtro só 'TA não atendeu', e fica todo mundo que não atendeu, seja em qual funil ou etapa estiver."*
A lista **Delay** virou saco de gato: os 20 que ele viu eram todos "ficou pra trás" (ninguém ligou), não status de delay. Agora são **três filas, três perguntas**:
- ⏳ **Delay** — a ETAPA travou (Delay OI, Delay P/C, C2, Revisita, Delivery, Retornar). O Estoque **não entra** (não tem etapa).
- 🔕 **TA não atendeu** — ligou e ninguém atendeu, **em qualquer funil, etapa ou no Estoque** (funil pelo `taStatus='Não respondeu'`, Estoque pelo último `hist` com `res='nao_atendeu'`). Selo mostra nº de tentativas e a última.
- 🕗 **Ficou pra trás** — o dia da lista passou e ninguém chegou a ligar. Nunca duplica com o Delay (quem já tem delay não entra aqui). Selo mostra de que dia era a lista.

### Autoria (AUTORIA-V1) — o caso do Victor
Ele confirmou: *"o Victor não vai ter base dele; é usuário que dá suporte a mim e ao Daniel — pode mexer em tudo, mas fica REGISTRADO no usuário dele."* Conferido no banco: as delegações **já existem** (Victor → base do juca e → base do Daniel) e a base dele está **zerada** (0 em lp_contatos/carteira/atrasos/pendências/emitidas), como deve ser. **Nada a criar no seletor** — Victor não tem base pra aparecer nele.
O que estava ERRADO era o rastro: os 28 pontos que gravam `por:` carimbavam `S.activeUser` — o **perfil local** ('gustavo') — então o que o Victor fazia na base delegada aparecia como se fosse do dono. Agora existe `quemFez()` (e-mail de quem está logado; sem login, o perfil local) e `lpNome` sabe mostrar e-mail como rótulo/nome.

### Erro meu, pego pelo portão (e vale de lição)
O invariante novo da autoria trocava `PERFIL` e restaurava com `if(P!==null)` — deslogado, `P` era `null` e **o app ficava logado como Victor depois do self-check**. Resultado: 33 telas com campo morto (o "Dono (LP)" só aparece logado). É o **livro de erros #17** (self-check não deixa lixo) de novo. Restaura SEMPRE agora.

**Provas:** portão 6/6 verde (39 telas × {375,1024,1280} × {cheia,vazia}); 4 suítes funcionais verdes (14+14+17+14).

## 14/09/2026 (5ª onda) — CARREIRA DO ATIVO no plano NOVO (Revisão de Proteção)

**Arquivo: `revisao-protecao.html`** (fora do portão, selfTest próprio). Pedido dele: *"quero a mesma visão que mostro no ativo securitário que o cliente já tem, trazida para o plano que eu monto — habilitado para múltiplos cenários, pra simular a contratação e o comportamento desse ativo."*

**Como foi feito (sem conta nova):** cada linha do plano cujo produto TEM tabela de valores de resgate (famílias WL e WV da base de fatores — `resgProduto`) vira um **ativo simulado**: uma apólice hipotética emitida hoje, na idade/sexo do cliente, com o capital e o prêmio que o motor já calcula (`calcC`). A partir daí passa pelas **mesmas funções** do ativo que ele já tem — `ativosVitalicios`, `resgCurva`, `evItens`, `simLinhas`, `ativoCardHTML`. O que muda é a ORIGEM do ativo, não a matemática.
- **Bloco novo no console** (etapa 4, logo após Planos propostos) + **seção na apresentação** ("O que este plano vira em patrimônio"), **fora do material por padrão** — ele liga no switch, como nas outras.
- **Múltiplos cenários**: um grupo por plano, com a cor do plano. Plano sem produto que forma patrimônio **diz isso** em vez de inventar curva.
- **Resumo que sustenta a conversa**: capital contratado · 1º resgate (ano e valor) · **o ano em que o resgate passa o total pago** · onde chega no 40º ano. Ex. medido (H, 40 anos, WV10, 250 mil): 1º resgate R$ 4.725 no 3º ano; **vira no 9º ano** (R$ 134.965 de resgate × R$ 132.280 pagos); 40º ano R$ 1.215.607 com capital de R$ 2.033.468.
- **Contrato que começa hoje**: o 1º ano sai **exatamente pelo que foi cotado** (não leva um degrau de IPCA antes de existir). A mudança no motor é guardada por `at.novo` — **o ativo que o cliente já tem não mudou em nada** (tem invariante provando).
- **Bug pego pelo teste:** `at.pre` do ativo simulado guardava o prêmio COM IOF, e `premioAnualHoje` soma IOF de novo — imposto cobrado duas vezes (11.785,89 × 11.741,28). Corrigido: `at.pre` é líquido, `at.preExib` é o de exibição.
- Cabeçalho da simulação deixou de espremer no celular.

**Provas:** 17/17 num teste funcional no navegador com o motor REAL do arquivo (nada dublado) — inclui a regressão do ativo existente; `selfTest` do arquivo segue **45/45**; 390/834/1280 sem estouro e sem exceção nas 6 abas.

## 14/09/2026 (4ª onda) — Faixa branca do iPad · Finalizar que não finalizava · Editar atividade · Tarefas do Google · Compromisso sabe de que negócio é

**v7.63.** Quatro coisas que ele reportou usando o app no iPad, e duas que apareceram na investigação.

### 1. A "tela branca do nada" (IPAD-SEM-FAIXA-V1) — bug antigo, nunca medido
Entre **981px e ~1300px** (o iPad em PAISAGEM, que é como ele trabalha agora) a página estourava pro lado em TODAS as telas — a barra de cima pedia ~1140px e não tinha como encolher, empurrando o documento inteiro; sobrava a faixa branca à direita. **O portão só media 375 e 1280**, então essa faixa nunca foi olhada. Conserto na origem: a barra **quebra a linha** (`flex-wrap`) e a busca encolhe. Medido depois: **estouro 0 em 768/834/1024/1112/1180/1366**.
- **O portão passou a medir 1024** (`LARGURAS=[375,1024,1280]`) — 6 cenários, 39 telas cada.
- **Regressão minha, pega pelo próprio portão:** ao tirar a gaveta da tela por `transform` (em vez de `right:-580px`, que no Safari alarga o documento), a regra antiga do celular (`right:-102vw`) brigou e **a ficha parou de abrir em ≤640px**. Consertado e agora há um invariante de COMPORTAMENTO (mede a geometria da gaveta aberta em cada largura), não de texto.

### 2. "Finalizar" não fazia nada (ATIVIDADE-UX-V1)
Atividade vinda do import tem id **NÚMERO**; o clique manda **TEXTO**; a busca era `x.id===tid`. `12345 === '12345'` é false → a função dava `return` e o clique morria calado (valia pra finalizar, concluir, remarcar e remover). É o erro #7 do livro (ids como string) de novo. Agora existe **UM acessador** (`tarDe`/`tarPar`) e ninguém mais busca atividade na mão.
- **Editar / atualizar / excluir** em toda atividade (ficha, Agenda e "reuniões a finalizar"): tipo, título, dia, hora, duração, destino e anotação numa folha só. Reunião a finalizar ganhou ✏️, +1d e ✕ além do Finalizar.

### 3. Tarefas do Google (GTASKS-V1)
"Uso muito a função tarefas." Agora o escopo do Google inclui **Tasks** e a atividade vai pro lugar certo: **com hora → evento na Agenda; sem hora → Tarefa do Google** (ele troca o padrão no cabeçalho da Agenda e força um ou outro em cada atividade pelo ✏️). Trocar o destino **migra** (apaga de um lado antes de criar no outro, nunca duplica). Volta também: concluir ou remarcar a tarefa no Google reflete no CRM. Se ele autorizar só a Agenda, o app percebe e manda tudo pra Agenda em vez de perder o compromisso.

### 4. Compromisso ↔ negócio (AGENDA-NEGOCIO-V1)
"Esse compromisso do A. B. é um cliente que está em etapa de OI." O evento criado à mão no Google não sabia de quem era. Agora o app reconhece o dono por (1) carimbo do CRM, (2) telefone na anotação, (3) **nome dentro do título** (ignorando o prefixo de etapa). A **etapa aparece no bloco da grade, no chip da semana e na lista**, o selo abre a ficha, e o editor permite **vincular à mão** — o vínculo fica gravado no próprio evento.

**Provas:** portão **6/6 verde** (39 telas × {375,1024,1280} × {cheia,vazia}); **59 checagens funcionais** no navegador (14 atividade/Tasks + 14 agenda + 17 sincronia + 14 estabilidade); 18 invariantes novos.

## 14/09/2026 (3ª onda) — VISÃO CONSOLIDADA: os funis numa régua só

**v7.61.** Pedido dele: "quero uma visão unificada dos funis, tipo um funil consolidado, e eu seleciono os funis que quero ver. Não é tela de manipulação e operação do dia a dia — é painel visual pra nortear minha visão do funil."
- Tela nova **Visão Consolidada** (1º item do Pipe Negócios, também no hub de Módulos). **Só leitura**: não arrasta, não edita, não move — clicar num nome abre a ficha, clicar num funil abre o funil.
- **Seletor de funis** em chips (persistido em `crmlp_consol_v1`, nunca fica vazio). Vida em Grupo/Prud./MFO só aparecem se o módulo `funis_extra` estiver ligado.
- **Régua única de 5 faixas**: Prospecção · Abertura · Proposta & Fechamento · Entrega · Encerrados. Usa o **de-para JÁ APROVADO** (o mesmo que carimba a etapa no título da reunião, 27/08): [OI/FF]→Abertura, [PC]→Proposta, [DELIVERY]→Entrega. Funil **sem** de-para entra pela **posição** na régua do próprio funil — e a tela escreve isso, pra ninguém achar que o app inventou equivalência de etapa.
- **KPIs**: PA em jogo (+ R$/mês), ponderado pela probabilidade da etapa, ticket médio, parados (sem próxima atividade), entrega + encerrados.
- **Por funil** (negócios em jogo, PA, ponderado, parados) e **"Onde está travado"** — maior PA sem próxima atividade, que é por onde o mês escorre. Clicar numa faixa abre a lista dela (30 maiores).
- Nenhuma conta nova de negócio: reusa `somaPA`/`paPonderado`/`probDe`/`ehPosVenda`/`semProxAtividade`/`escVisivel` (escopo Meu/Rebeca/Daniel/Pipe X vale igual).
- **O portão pegou uma falta real** antes de subir: tela de hub sem nome próprio na barra de cima (faltava em `TITULO_VIEW`). Corrigido.

**Provas:** portão 4/4 verde com **39 telas** (a tela nova entra sozinha na lista), 6 invariantes novos; 390px e 1280px sem estouro e sem exceção.

## 14/09/2026 (2ª onda) — AGENDA FLUIDA: arrastar pra mover, título nítido, nada trava

**v7.60.** Pedido dele: "mais fluidez, menos crivação; os nomes dos eventos têm que estar nítidos; fácil de mover e organizar — a mesma experiência do Google Agenda."
- **Arrastar pra mover:** na grade do dia o bloco segue o dedo/mouse e cai de 15 em 15 min; a **borda de baixo estica** a duração; na semana, arrastar o chip pra outra coluna muda o DIA mantendo a hora. Mouse no desktop, **segurar ~320 ms** no toque (mesma receita do DRAG-TOUCH-V1 dos funis, pra não brigar com a rolagem). Arrasto curto sem sair do lugar = clique (abre o editor).
- **Título nítido:** 13px/700 com até 3 linhas conforme a altura do bloco (era 11,5px cortado numa linha), bloco com altura mínima de 34px e hora de início–fim.
- **Menos crivação:** clicar no vazio da grade cria naquele horário; a grade aparece **mesmo no dia vazio**; **linha vermelha do AGORA**; mudar o início **leva o fim junto** (mantém a duração) e salvar **nunca mais é barrado** por "o fim tem que ser depois do início" — o app conserta e segue; atalhos −15/+15/+1h/amanhã/+7d no editor.
- **Mover otimista:** a tela responde no mesmo toque, grava no Google e, se o evento nasceu de uma atividade do CRM, a atividade anda junto na hora. Se o Google recusar, **volta pro lugar** (nunca fica meio movido).
- **Achado:** a camada de avisos (`#toasts`) **engolia o toque** por 2,6 s depois de cada ação — sem `pointer-events:none`, tocar no que estava embaixo não fazia nada. Era uma fonte silenciosa de "cliquei e não foi". Corrigido.
- **Leitura da data do evento virou fonte ÚNICA** (`gsyncDataDoEvento`): o pull periódico e o arrasto leem do mesmo lugar.

**Provas:** portão 4/4 verde (38 telas); **14/14** num teste de arrasto real no navegador (mouse e toque via CDP, desktop e 390px); 12 invariantes novos no lpSelfCheck.

## 14/09/2026 — Agenda Google BIDIRECIONAL (fila que não perde clique) · Tela que não sobe mais · Trava de troca de conta que estava inerte

**Estado em 30s:** branch `claude/google-calendar-sync-bidirectional-ruaeiq` — **v7.59**, portão VERDE (38 telas × {375,1280} × {cheia,vazia}, lpSelfCheck 0, funSelfCheck 0) + `--prova` acusando o defeito injetado. **Aguarda OK dele pra merge.** Sessão feita do iPad (MacBook no suporte Apple), 100% na nuvem.

### 1. GCAL-BIDIRECIONAL-V1 — o caso Dv.
**Sintoma dele:** "adicionei tarefa na oportunidade do Dv., cliquei pra mandar pra agenda do Google, não refletiu."
**Causa:** mandar pra agenda era um TIRO ÚNICO sem rede de segurança. Token do Google vencido, popup de consentimento bloqueado (Safari do iPad bloqueia popup que não nasce do toque) ou rede oscilando = o clique não virava nada, nem evento nem sinal. E não existia caminho de volta: remarcar/apagar no Google não mexia no CRM.
**Correção (uma via, dois sentidos):**
- **CRM → Google:** toda mudança (criar com hora, clicar 📅, remarcar, concluir, remover) ENFILEIRA num `crmlp_gsync_v1` PERSISTIDO. Drena no boot, ao voltar o foco, a cada 90 s, quando a rede volta e ao reconectar. Clique não se perde mais.
- **Google → CRM:** o app relê só os eventos que ele mesmo criou (`extendedProperties.private.crmApp='crmlp'`) e traz de volta **dia, hora e duração**. Evento apagado lá → atividade marcada "fora da agenda", **nunca apagada** (dado do CRM não some por fora). Título NÃO volta do Google (texto livre é do CRM).
- **Conflito:** quem tem item na fila (mudança local não subida) vence; sem fila, vence o carimbo mais novo (`ev.updated` × `t.gcalUpd`).
- **Sem hora = evento de dia inteiro** (antes, atividade sem hora simplesmente não ia).
- **Onde roda:** QUALQUER tela (antes só com a Agenda aberta na cara).
- **Concluir antes do dia** tira o compromisso futuro da agenda; **remover** apaga o evento; reunião mantém etapa no título + cor Pavão e respeita título ajustado à mão no Google.
- **UI:** selo na atividade (📅 na agenda · na fila · fora da agenda) e um aviso único na Agenda ("N esperando · Reconectar e enviar", botão 44px no celular).

### 2. ESTABILIDADE-DE-TELA-V1
**Sintoma dele:** "toda vez que clico num campo de tarefa ou atualizo um dado, a tela sobe sozinha."
**Causa:** cada ação repinta trocando `innerHTML` de `#main`/`#drawer` — e trocar innerHTML DESTRÓI os nós, levando junto rolagem e foco. **Medido na main:** a ficha pulava de **420 → 0**, o foco se perdia e o texto digitado sumia.
**Correção:** `render` e `renderDrawer` embrulhados: foto antes (rolagem da janela + de tudo que rola em #main/#drawer + foco + cursor + texto digitado em campo que não mora no estado) e reposição na mesma batida + conferida no quadro seguinte. Medido depois: 420 → 420, foco e cursor no lugar, nos DOIS tamanhos.

### 3. Achado de brinde: a trava de troca de conta estava INERTE
O guarda do V10.1 (`localStorage.setItem` bloqueado durante troca de conta) era escrito com `Object.defineProperty` **no objeto** `localStorage` — num objeto Storage isso cai no *named property setter* do navegador (vira um ITEM chamado 'setItem') e a chamada seguia indo pro método do prototype. **O invariante V10.1 estava VERMELHO na main** (reproduzido no portão, antes e depois, no arquivo da main). Agora a trava mora em `Storage.prototype.setItem` — provado verde.

### Provas
- Portão 4/4 verde (38 telas), `--prova` OK. Guard do choke point OK.
- **17/17** num teste funcional com a API do Google DUBLADA (navegador de verdade): carimbo, dia inteiro, remarcar dos dois lados, offline → fila → sobe sozinho, apagar no Google, remover no CRM, recriar sem duplicar, fila local vencendo o Google.
- **14/14** de estabilidade em 390 e 1280 (lista, ficha, +1d, foco/cursor/texto, quadro que rola de lado).
- 15 invariantes novos no `lpSelfCheck` (rodam no portão pra sempre).

### Pendências
- **Gustavo:** conferir logado no iPad (clicar 📅 numa tarefa do Dv., remarcar no Google e ver voltar) e **autorizar o merge**.
- Nenhuma migration, nenhum dado tocado. Fila e sincronia são 100% client-side (sem servidor novo).
- Frentes anteriores seguem: Victor resubir emitidas · Daniel carteira real · extensão WhatsApp no CRM · MAPA & LOCAIS (rota do dia).

## 10-11/09/2026 — Painel TA nativo · Estágio único · Escopo único (RLS unificada) · SitPlan unificado · listas do método · auditoria das bases

**Estado em 30s:** `main` — **v7.58.1 no ar** (caça a bugs 11–12/09: 7 rodadas, PRs #227–#235, ~60 correções: handlers do PLACED, lp do contato novo, foto inicial/PEND, funis extras, agenda meia-noite/404, multiusuário (troca de conta limpa cache, dono na edição, push resiliente, SW v3), cfg admin, escopo em todos os leitores; anterior: v7.52 (PRs #210–#226: … MAPA & LOCAIS v7.50/7.51 (locais+rotinas na ficha/Estoque, busca OSM, local no evento da Agenda, Mapa filtra dia/turno), GCAL-SEM-TELA, CFG-ADMIN (cfg global só admin, RLS), ESCOPO-TUDO v1/v2, crm-mcp v2.5 (buscar_local/definir_locais c/ rotinas), prompt do assistente no Notion; antes: SEGURANÇA-V1/V2/V3 + varredura diária 02:00, DRAG-TOUCH no iPhone, STATUS-ETAPA-V1, IMPORT-DONO-V1 (relatório roteia por LP; Victor delegado por Daniel), LP-ROTULO-PORTA-V1, CARTEIRA-SEGURA-V1, CFG-SALVAR-V2). Supabase playground = PRODUÇÃO. Portão = 37 telas × {375,1280} × {cheia,vazia}. Frente "Painel TA / SitPlan × TA" **FECHADA**; sobra só ele conferir logado.

**Prompt pra próxima sessão:**
```
Sessão CRM Visão LP — retomar. v7.58.1 no ar (caça a bugs fechada em 7 rodadas; ver memória crm-lp-painel-ta-consolidacao, entradas 11–12/09). Anterior: v7.52 no ar (ler memória crm-lp-mapa-locais + crm-lp-painel-ta-consolidacao). Frente aberta: MAPA & LOCAIS (próximos: rota do dia, locais em clientes da carteira, tarefa/compromisso via conector). Fila dele: Victor resubir emitidas + consolidado de divergências; conferir logado; Daniel carteira. Anterior: v7.46 no ar (FUNDAÇÃO V1 servidor manda + fila PEND; SEGURANÇA-V1/V2 c/ varredura diária pg_cron 02:00; DRAG-TOUCH-V1 no iPhone; STATUS-ETAPA-V1 (status Delay OI/FF, P/C, C2, Delivery já cadastrados no servidor); v7.46.1 IMPORT-DONO-V1 (Victor sobe relatório → cada linha vai pro dono do LP; delegação Daniel→Victor criada); v7.47 SEGURANÇA-V3 (carteira sem delete-all, cfg funil debounce+pendente, jsq). Fila: Victor resubir emitidas (J. R./Sd. faltam), Victor passa CONSOLIDADO de divergências dos relatórios, conferir 1ª execução do pg_cron 12/09, itens médios da auditoria (badge de pendência, debounce salvar()). Ler memória crm-lp-painel-ta-consolidacao (frente FECHADA, lições dos 97 e do rótulo do Daniel) + ESTADO (topo) + CANONICO_CRM.md no Drive. Fila: (1) Gustavo conferir logado: seletor do nome (Meu/Rebeca/Daniel/Pipe X), Painel TA (listas do método, Delay, Rec de cliente, filtros dobráveis), SitPlan; (2) Daniel subir a carteira real; (3) extensão WhatsApp no CRM; (4) opcional: 'Organizar painel' (arrastar/ocultar) do 2.0. Regras iguais: git fetch antes, branch de origin/main no worktree crm-wt-rp, grep -a no vendas.html, portão verde, --servido, merge só com OK em regra/dado real/RLS.
```

### O que entrou (tudo no ar, PRs #186–#196)
- **PC-5 (v7.32→#186):** view `subst_postecipacao` com `posicao/proxima_cobranca/proxima_cobranca_melhor/ganho_dias` (funções SQL `pc_melhor_dia`/`pc_proxima_cobranca` = motor do app). Postecipação FECHADA.
- **v7.33 ESTAGIO-UNICO:** trigger `lp_norm_estagio` em `lp_contatos` (sem funil→bn; sem estágio→derivado da etapa). Base do Daniel roteada por etapa: 1.371 → Estoque (SitPlan/TA), 219 ficam no NN (OI/FF em diante) com estágio. `lpcSemOsDoEstoque`. Menu: Estoque de Nomes no nível principal, Recomendações submódulo.
- **v7.34 PAINEL-TA-NATIVO:** `painel-lp.html` virou redirect; Painel TA = view `bn-ta` (store BN). Modo Foco do TA c/ timer, grava `lp_sitplan`. Rota `#view=<tela>&q=`.
- **v7.35/.1 ESCOPO-UNICO:** UM seletor no cartão do nome (Meu · Rebeca · Daniel · Pipe X, do mapa `lp_rotulo_dono`) dirige Estoque/Painel TA/funis/Carteira/BackOffice E a gravação (`lpcRowOut` leva o dono). **RLS de lp_contatos/lp_interacoes/lp_sitplan unificada** (`dono IN lp_donos_visiveis()`). Topbar Pipe X e filtros "LP:" saem logado. Cartão âmbar "vendo: X".
- **v7.36:** Painel TA com a ESTRUTURA do 2.0 (coluna Listas/Listas de TA/Filtros; tabela c/ avatar; ⋯ mover/listas; ficha em modal; cards no celular). "Todos os nomes" sai do menu.
- **v7.37/.1 SITPLAN-UNIFICADO (opção 1):** `spListaDoDia` = funil (`c.sitplan`) + Estoque (`ta_dia`); resultado gravado onde o contato mora; SitPlan planeja, Painel TA executa; Lista do Dia sai do hub. Rótulo do "Meu" vem do banco (`escMeuLpDe`).
- **v7.38/.39/.39.1/.40 listas do método:** Toda a base · Rec (com telefone) · Recomendações · Delay (`taDelayTipo`, filtro por tipo, inclui funil) · Rec (sem fone) · Clientes (carteira, `taEhCliente`) · Rec de cliente 💎 · Descartados. "OIs agendados" sai: agendou → `bnLevarProFunil('OI/FF')`. Cards de KPI fora; "Hoje" fora do card. SERVIDOR-MANDA no Estoque (`bnSemOsApagados`, só carga completa). Filtros dobráveis c/ resumo. `MODS.funis_extra` off pro LP. VER-COMO-V2: modo "vendo: X" aplica os módulos DELE e esconde o painel admin.
- **Banco (OK dele):** 7 rótulos 'gustavo'→'daniel' em contatos do Daniel; 115 contatos de funil do Gustavo com estágio; apagados 3 'D. Teste' (Daniel+Victor) e 'lista de atrasos' (Victor).
- **v7.40.1 QUOTA-V1 (#198):** o localStorage do Gustavo estourou a cota com 6.5k linhas → exceção no meio da carga → os 1.368 do Daniel nunca chegavam à memória (servidor devolvia todos). Cache guarda só os MEUS nomes; falha de cota avisa e não derruba. `escLinhaOk`: Benefícios/Atraso/Solicitações respeitam o escopo. SitPlan: busca em vez do select gigante.
- **v7.41.1 (#201):** densidade compacta anulava a safe-area da topbar no iPhone (barra sob o relógio) — regra do celular cobre as duas densidades.
- **v7.42 DONO-V1 (#202):** sem dono gravado = MEU (não vaza pro 'vendo: X'); `bnGarantirDono` busca a base do outro dono do servidor ao escolher no seletor; linha 'Dono (LP)' em toda ficha; editor do Estoque com Recomendante 1º + select Dono (admin move de base: `bnMoverDono`); Painel TA 'sem recomendante' explícito; linha do SitPlan abre a ficha.
- **v7.43 FUNDAÇÃO DE DADOS V1 (#203):** `fundMerge` pura — servidor manda; só a fila `PEND` (editado neste aparelho e não confirmado) vence; carga completa apaga o que não voltou (fantasmas locais); parcial não apaga. Fila persistida, retenta online/60s. Fim do 'local mais novo vence'. `ctMoverDono` + Dono (LP) editável (admin) na ficha do funil. **Diagnóstico:** a raiz de todos os bugs da rodada era a camada 'local primeiro'; não precisa reconstruir o app.
- **v7.43.1–.4 (#205–#208):** 1ª foto e merge do servidor NUNCA marcam pendente (só edição local); pendente igual ao servidor se limpa; faixa 'homologação' removida; **ID-NA-PORTA**: o import do MCP gravava `dados` sem `id` → os 1.575 do Daniel viravam UM registro no app (chave undefined) — `lpcComDono` usa o id da coluna, trigger garante `dados.id`, backfill rodado (banco 100% com id, 0 colisões entre donos). Conferido ao vivo: Daniel 1.370 Estoque + 219 funil na conta do Gustavo.
- **v7.41 FICHA-UX-V2 (#199):** ficha do contato do Estoque redesenhada (cabeçalho avatar/nome/badges/ações, grupos dobráveis com resumo, rótulo em cima, alvos ≥42px, rodapé fixo; mesmos ids bne-*).

### Livro de erros (custaram tempo)
1. **97 nomes (v7.35):** `delegCarregar` rodou antes da sessão restaurar → `DELEG.eu=''` → escopo "Meu" com dono vazio excluía toda linha com dono. Regra: escopo NUNCA pode ser mais restritivo que "meu" por falta de dado; dono desconhecido não exclui.
2. **Rótulo do Daniel (v7.37.1):** `pxMeu()` vinha do perfil DEMO ('Gustavo') → o "Meu" do Daniel esconderia os 1.371 dele. Regra: identidade/rótulo vem do banco (`lp_rotulo_dono`), nunca do demo.
3. **"Só local vence"** devolvia pro NN o que o servidor moveu pro Estoque → regra "servidor manda" (funis e Estoque), sempre condicionada a carga COMPLETA.
4. **Smart keys `sm:` resetadas** pela guarda de "lista nomeada inexistente". Invariante de `<details>` não pode depender do `ontoggle`.
8. **`dados` sem `id`** (import do MCP): o app indexa pelo JSON → todos colapsam num registro. Regra: chave da linha entra no objeto NA PORTA (erro #48 de novo) e o trigger garante no banco.
9. **Merge do servidor tratado como edição local** → tudo pendente. Regra: só edição do usuário marca pendente; merges passam `{doServidor:true}`.
6. **localStorage tem cota (~5 MB):** com 2 donos no Estoque o cache estourou e o setItem lançou DENTRO da carga → dado do servidor descartado em silêncio. Regra: cache só do próprio dono; todo setItem em try; carga nunca depende do cache.
5. **Clientes = 614:** flag `estagio='cliente'` da carga de 04/08 (569 "CLIENTE ATIVO" da planilha) ≠ carteira real (146). Cliente = está na carteira.

### Auditoria das bases (11/09)
Outras tabelas SEM mistura (só subst_apolices juca/lp=Daniel 6, intencional). Daniel 1.590 = 1.371 Estoque + 219 funil. Caso deixado: A. C. (NN etapa SitPlan c/ estágio cliente que ele mesmo setou). RLS provada como juca: vê 1.590 do Daniel, 0 do Victor.

### Pendências
- Gustavo conferir LOGADO (seletor, Painel TA, SitPlan, Delay, filtros). Daniel: "Atualizar app" e conferir o Estoque dele.
- Daniel subir a carteira real. Extensão WhatsApp no CRM. Opcional: "Organizar painel" do 2.0.
- Victor: seu escopo padrão cai na base delegada (juca); os 3 nomes próprios dele só aparecem em "Meu".

## 09-10/09/2026 — Victor login · Mistura de bases (limpeza+trava) · Delivery pós-venda · Postecipação PC-1..PC-4+colar · saudação Daniel · crm-mcp em lote

**Estado em 30s:** `main 8ed4bf8` — v7.31 no ar; **v7.32 = PR #184 aberto** (colar apólice, portão verde, aguarda OK de merge). crm-mcp **v2.2** no ar (deploy v4). Supabase playground = PRODUÇÃO. Portão = **37 telas** × {375,1280} × {cheia,vazia}.

### O que entrou (no ar, salvo indicado)
- **Victor login destravado** — não tinha conta em `auth.users` (signup off ⇒ "Entrar com Google" dava erro). Provisionada a conta de auth (email confirmado + identidade), espelhando a do Daniel (uid 964bbe10). Entra por Google **ou** senha temp `VictorCRM#2026`. E-mail `victor@…` confirmado pelo Gustavo.
- **Mistura de bases (Gustavo/Rebeca/Daniel)** — contaminação REAL achada: o import MFB não separava por LP e o RLS não amarra rótulo⟷dono. **Limpeza rodada** (vendas_atrasos double-count desfeito: 15 espelhos apagados + 21 roteadas; pendências/emitidas/solicitações roteadas; 4 órfãos invisíveis recuperados; 108 rótulos normalizados; 9 contatos do Daniel re-rotulados; placed do Daniel apagado). **Trava NO AR** (migration `lp_trava_anti_mistura_v1`: tabela `lp_rotulo_dono` + trigger **normalizador** `trg_norm_dono` em vendas_atrasos/emissao_pendencias/emissao_emitidas/solicitacoes/beneficios). Verificação: **0 mismatch** (só subst_apolices=6, intencional/cliente-level). Plano completo: scratchpad/PLANO_ANTI_MISTURA.md. ⚠️ **melhor_dia emissão 30 = 14 (planilha), NÃO 15.**
- **Delivery pós-venda** (v7.26, PR #177) — fora das somas do funil (BC+LP), mantém a coluna; venda conta em **Apólice Emitida**. Helper único `ehPosVenda`.
- **Saudação do Daniel** (v7.30, PR #181) — usava `user()` demo (mostrava "Gustavo"); agora `nomeAtual()` (PERFIL da sessão).
- **crm-mcp em lote** (v2.2, deploy v4, verify_jwt=false) — `criar_contatos_lote` (até 200, 1 INSERT, upsert idempotente `(dono,ref_base)`) + `atualizar_contatos_lote` (merge por id), resposta **enxuta** `{criados/atualizados,erros}` (Prefer return=minimal, não ecoa). Migration `lp_contatos.ref_base` + índice único. **Daniel já usa** (prompt entregue no chat).
- **Postecipação (motor validado contra a planilha oficial + caso Dv.):** PC-1 motor único `pcPosicao/pcClassifica/pcMelhorDia/pcProximaCobranca/pcGanhoDias` (PR #178); PC-2 componente `pcSimuladorHtml` (#179); PC-3 aba standalone "Melhor dia de vencimento" em Módulos→Referência (#180); PC-4 embed em **Substituição** (card) + **Lista de Atraso** (topo) via `pcSimModal` (#183); **colar apólice** no standalone reusando `subExtrai` (#184, aberto).

### Provas
Portão em cada PR (37 telas, lpSelfCheck 0 com os testes de PC-1/2/4/4c, funSelfCheck 0); hash servido conferido nos deploys (Delivery/PC-1 via `--servido`); idempotência do mcp e da trava provadas por SQL; contaminação zerada por INV-1.

### Pendências (o que a próxima sessão pega)
- **PR #184** (colar apólice) aberto, portão verde — aguarda OK de merge.
- **PC-5** — view SQL `subst_postecipacao` idempotente: melhor_dia com correção fim-de-mês + colunas `proxima_cobranca`/`proxima_cobranca_melhor`/`ganho_dias`. Ler `pg_get_viewdef` ANTES; preservar off_dias/pgto_situacao/semaforo/veredito; apólice de teste 002…592.
- **Perfil "ver como"** — seletor no cartão do nome (Daniel/Victor/Pipe X=todos/Juca=meu) pro admin logado. `togglePerfilMenu` hoje retorna cedo quando logado; reusar PX.escopo/DELEG. **Decidir: só ver × operar/gravar como ele** (write-as = dado real).
- **Daniel** subir a carteira real dele. **Substituição** (6 apólices Daniel sob juca) deixada de propósito (cliente-level/misto — mover a árvore cliente→apólice→pagamento junto se um dia for reatribuir).


- **Bug real achado com o Daniel logado:** `carteira.html` embutia a carteira do Gustavo (143 cli/196 apólices, snapshot 28/07, com telefone/e-mail — PII em repo público) e, na 1ª abertura com tabela vazia, **semeava essa carteira na conta de quem abrisse**. Aconteceu às 21:39 de 08/09: 143/196 linhas com `_src=cockpit-2026-07-28` entraram em `carteira_clientes/apolices` com `dono=daniel@…`. Painel TA 2.0 estava certo (os 7 contatos são dele).
- **ISOLA-COCKPIT-V1 (PR #174, main cc2fee0):** snapshot e seed removidos; filas "Onde agir hoje", ABCD e profissão calculadas do dado vivo; filtro `dono=eq.<logado>` (escopo Pipe X `todos` abre pra delegação); estado vazio orientado; título por usuário; sessão herdada (cockpit e painel-lp) prioriza o login do app e descarta `lp_sess` de outro usuário. Portão 4/4 verde; Pages servindo `f77954bd68f7`.
- **Conector MCP:** token antigo revogado, token novo emitido (insert do hash direto — `mcp_session_issue` exige JWT de admin, não roda pelo MCP). `crm-mcp` **v2.1 (deploy v3)**: `busca` em `listar_contatos` filtra por `dados->>nome` (antes quebrava com 42883). Provas ao vivo: quem_sou_eu=Daniel · 7 contatos dele · busca "Piquet" (meu) = 0 · token adulterado recusado · 15 atrasos dele. Fonte da função agora versionada em `supabase/functions/crm-mcp/index.ts`.
- **PENDENTE (dado real, precisa de OK):** apagar as 143/196 linhas semeadas na conta do Daniel (`dono='daniel@…' and dados->>'_src'='cockpit-2026-07-28'`) e subir a carteira REAL dele (Subir relatório → Carteira de Clientes, logado como ele).

## 📸 Snapshot — 07/09 noite → 09/09/2026 · **v6.4 → v7.24** · 32 PRs (#141→#172), todos no ar

**Estado em 30 s:** `main d4a55ea`, v7.24 servida (hash conferido a cada merge: `3c37b86d`). Worktree `crm-wt-rp`, branch por feature, merge direto de ajustes (regra 04/09). Próxima sessão = **base do Daniel + MCP dele**.

### O que entrou
- **Backlog Seabra (noite 07/09, autônomo) v7.0→v7.15:** menu reorg; PT-A motor de mensagem pronta (+autoassinatura); funil BC redesenhado + 1ª automação (Apólice Emitida→Delivery); Metas ampliadas (emissão/PA, trimestre); módulo **Persistência** (Extrato de Comissão + simulador de cancelamento); GC-07 win-back; GC-10/28/33 status e lente do recomendante; GC-29 resumo do TA; GC-25 lembrete de reunião; GC-44 anotações de reunião.
- **Organizar cards/leads/clientes:** v7.16 PESSOA-CAMPOS-V1 (acessador único na porta, promover lossless) · v7.24 FICHA-PESSOA-V1 (o mesmo bloco "quem é a pessoa" nas 3 fichas). Frente concluída.
- **Revisão de Proteção:** v7.17 salva no Drive por cliente (`Histórico de Clientes/<Cliente>/`, File System Access) · v7.18 **MS bate com a Prudential** (prêmio capturado usado direto — Daniel 622,70) · v7.19–v7.22 lado do cliente: apresentação com MS, cards de valor selecionáveis (uma conta = A×B global), Checkout = régua da ordem, simulador de CS na frente do cliente, modo cliente = documento + simulador vivo, detalhes do ativo abrem no arquivo, 0 comissão no material.
- **v7.23** ordem manual dos cards no funil (c.ord, arrasto ao vivo, independente de filtro).
- **Acervo:** plano WhatsApp Meta (congelado) no Drive/Notion; benchmark Global CRM gitignorado (repo público).

### Provas
Portão em cada PR (36 telas × {375,1280} × {cheia,vazia}, lpSelfCheck 0, +~15 invariantes); `revisao-protecao.html` (fora do portão) conferido no navegador (selfTest 45/45) + hash servido; Pages byte-exato a cada merge.

### Pendências
- Extensão WhatsApp no CRM (reusa `fichaPessoaHtml`) · GC-36/50/32 em standby (decisão dele) · WhatsApp Meta congelado · plano novo/combo já coberto pelos cards genéricos.
- **Daniel:** passar a limpo a base dele no CRM e fechar o conector MCP (Path A, crm-mcp v2 no ar; falta ele plugar + provas ao vivo).

## 📸 Snapshot — 04/09/2026 noite → 05/09 madrugada · **v5.1 → v6.4** · 14 PRs (#127→#140), todos no ar

**Estado em 30 s:** `main b0496eb`, v6.4 servida (hash conferido a cada merge). Sessão longa no Mac com worktree `crm-wt-rp` (branch por feature). A partir do #135 os ajustes entraram **direto** por regra dele ("segue mergeando direto o que for ajuste"); regra de negócio, dado real e RLS continuam esperando OK.

### O que entrou (por PR)
- **#128 v5.1 Emitidas** — importador "Apólices Emitidas no Período" (`exParse`, prévia caixa a caixa): desfecho da pendência, apólice na carteira, negócio entregue, PLACED sincronizado. Tabela `emissao_emitidas`.
- **#129 v5.2** — 💬 enviar o compromisso ao cliente pelo WhatsApp (texto pronto) na ficha e na Agenda.
- **#130 v5.4** — Emissão Diária + Resumo MF (espelhos do BI HUB-MFB) · carteira→funil · 🔗 Juntar no Estoque · LP por cliente na carteira.
- **Banco (04/09, sem PR):** `carteira_clientes`/`carteira_apolices` estavam **zeradas** (delete+insert do importador falhou; os 147 "importados" eram cache). Repovoadas por SQL a partir de Carteira de Clientes + Apólices Vigentes do portal: 232 clientes / 324 apólices exatas; Rebeca na base dele com `lp`, Daniel no dono dele. Arquivos datados no Drive (Pipe X/CRM Life Planner/01).
- **#131 v5.5 Pipe X** — escopo meu/todos/LP na topbar (carteira por `lp_donos_visiveis()` + delegação Daniel→Gustavo; gravação só do próprio dono) · **login sem loop** (Google nunca ligou a identidade; e-mail+senha no card) · Google Agenda com token persistido + hint.
- **#132 v5.6** — vários telefones por nome · sugestões nos filtros das Recomendações · menu sem listas de etapas.
- **#133 v5.7** — **Base de Clientes redesenhada**: Clientes Ativos = carteira inteira, Pendência/Atraso vira STATUS filtrável, venda só de Revisita em diante, revisita paga (🤝) · Detalhado por Apólice · portão headless.
- **#134 v5.8 · #135 v5.9** — títulos de etapas somem de vez · modal de novo negócio pergunta o funil · etapa extinta não volta do servidor · quadro acompanha a ficha · grupo familiar (paga p/ · pago por · c/) · ficha da carteira rola.
- **#136 v6.0** — perfil do cliente (profissão, locais múltiplos, cônjuge, filhos/outros com idades, notas) em `carteira_perfil`.
- **#137 v6.1** — ficha da carteira em tópicos dobráveis; grupo familiar clicável.
- **#138 v6.2** — carteira dentro do tópico "Já é seu cliente" da ficha do contato; apólices do cliente casado por telefone (era 0).
- **#139 v6.3** — Aniversariantes / Aniversário de Apólice em Módulos, derivados da carteira e das emitidas (`lpDerivar`).
- **#140 v6.4** — **Subir relatório universal**: detecta o tipo (semanal, Carteira .xls, Apólices Vigentes .xls, Emitidas, Pendentes, Atraso) e roteia.
- **Casa:** acervo no Drive (subpastas 01–04 + LEIA-ME) e página [Acervo] CRM Life Planner no Notion; regra "material entra no acervo na hora".

### Provas
Portão em cada PR (33 telas × {375,1280} × {cheia,vazia}, lpSelfCheck 0, ~60 invariantes novas); hash do Pages conferido a cada merge; fluxos testados no preview (emitidas, funil BC, perfil, roteamento).

### Lacunas conhecidas (fecham com relatório do portal)
CS MQC por apólice · cancelamentos com data · data de emissão das apólices antigas · Status T/Benefícios no detector.

### Presos nele
Exports acima · Google como identidade (opcional) · Sy. no ar · migration `lp_perfis_nome_ativo.sql` · Victor · textos de cobrança · faixas 15/8 · PR #35.

---

## 📸 Snapshot — 03/09/2026, noite (sessão remota, pelo celular) · **v0.45.0 → v0.46.0** · Entradas pelo funil na Carteira + editor do funil com alvo de 44px

✅ **NO AR (03/09, 20h50):** ele autorizou pelo celular ("pode deploy, quero já no app"); a main foi avançada por fast-forward até `e63c844` — isso levou a cadeia inteira #113→#121 + #118 + v0.46.0 + v0.47.0. `python3 scripts/portao.py --servido` = **EXATAMENTE este arquivo, v0.47.0** (sha 892d1f367a63). Falta ele abrir logado e tocar "Atualizar app".

**Estado em 30 s:** sessão rodada num container remoto (claude.ai/code), dirigida pelo celular — **sem o Mac, sem worktrees, sem sessão logada**. `main` segue em `d37b628` / v0.42.1 no ar; **nada da cadeia foi mergeado** (conferido no GitHub: #113 → #121 e #118 abertos). Branch desta sessão: `claude/crm-lp-continuation-59xph2`, em cima de `portao-porta` (ponta da cadeia) + merge de `estado-03-09`. O portão **roda no container** (python3 + Chromium headless dirigindo o `portao.html`): 4 cenários × 29 telas verdes.

### O que entrou (v0.46.0, um commit)
- **Item 4 — Entradas pelo funil (Visão da Carteira).** `cartEntradasFunil(mes)` conta a apólice que tem `_origem` + `_criadaEm` (só o `vendaAplicar` grava isso; a importação da LP não). Seção nova na Visão: N apólices · prêmio/mês (estimados marcados) · clientes novos · lista por pessoa (🤝 pela venda / 📋 pela emissão · dia · prêmio), clicável pra ficha do cliente; seletor de mês quando há mais de um; vazio honesto ("nenhuma entrou pelo funil em set/26"). `cartApoliceOrigem(a)` → 'venda' | 'emissão' | 'importação'. **+5 invariantes**, provados quebrando (função anulada → 3 caem; religada → 0).
- **Item 5 — Alvos de toque no `config-funil`.** Bloco `@media(max-width:600px)` dentro do `<style>` do editor (desktop fora dele): bolinha de cor com **área de toque 44px e desenho de 24px** (`background-clip:content-box!important` — o `background` inline, shorthand, reseta o clip; sem o `!important` a bolinha vira um botão de 44px inteiro), setas 44×44, lixeira 44×44, "no fluxo"/encerramento e abas com `min-height:44`, `+ Adicionar etapa` 48. **Medido a 375: 123 → 0** alvos abaixo de 44px (eram 72 `fc-sw`, 24 `fc-arrow`, 12 `fc-del`, 12 `fc-enc`, 2 abas, 1 `fc-add`). Zero estouro. 1280 conferido por print: idêntico ao de antes.

### 04/09 · v0.48.1 — recomendante lido do nome ("Rec <nome>") · ✅ NO AR (main `0d0efdf`, `--servido` EXATAMENTE)
- `recDoNome()` cobre "Nome - Rec Fulano" e "Rec Nome Rec Fulano" (a pessoa É rec); sufixo Cliente/Novo cai; "Recife"/"Recuperação" não casam. `recAplicarDoNome()` roda no `normContato` (cópia local de cada aparelho + contato novo), guarda `nome_original`, nunca sobrescreve recomendante digitado.
- **Banco corrigido daqui** (`lp_contatos`, projeto cjieobmdpqcupzdpckef, via MCP): 11 contatos do funil (9 bc, 2 nn) com nome limpo + `recomendante` + `nome_original` + `_upd` novo pra ganhar o merge. Base de Nomes (5.136) já tinha o campo; nada tocado lá.
- Conferido antes de aplicar: parser testado nos 11 nomes reais em node; SQL com `returning` mostrando os 11.

### 04/09 manhã · v0.47.1 + v0.48.0 — ficha do contato fluida + Recomendante · ✅ NO AR (`--servido` EXATAMENTE, v0.48.0)
- **v0.47.1 ficha:** cabeçalho com safe-area (nome não colide com o relógio), ✕ 44px, 📞 Ligar + 💬 WhatsApp; meta só com o que existe (`drwMetaPartes`, fim do "— · anos · —"); `telBR` formata (DD) 9XXXX-XXXX no cabeçalho, cards, listas e Modo Foco; etapas do fluxo em grade 3 colunas de 44px e encerramentos em linha própria (`drwStepperHtml`); título da seção à esquerda. Medido a 375: alvos <44 na ficha 15 → 0; bloco de etapas 295 → 327px (preço dos 44px).
- **v0.48.0 Recomendante:** `recomendanteDe(c)` = campo `recomendante` ou quem tem a pessoa nas próprias `recs`; selo pelo `clienteDe` (cliente · N apólices / no funil · etapa / não é cliente); chip no cabeçalho abre a ficha do recomendante; campo em Dados da pessoa com datalist (funis + carteira); `recomendante` entrou em `PESSOA_CAMPOS` (propaga entre oportunidades). +7 invariantes no total.
- Deploys desta sessão remota, todos com OK dele no chat: v0.47.0 (main `e63c844`), v0.48.0 (main `952737f`). PRs #113–#121 fechados como superados (conteúdo na main); #118 mergeado.
- Ideia dele pra próxima: importar o padrão "Rec <nome>" dos nomes do WhatsApp na extensão pra preencher o recomendante.

### v0.47.0 — barra inferior nova + ➕ Adicionar rápido (pedido dele pelo print, 20:26)
- **Barra:** `Menu · SitPlan · ➕ · Novos Neg. · Base Clientes`. Menu e ➕ são FIXOS; sobram **3 destinos** à escolha (`BNAV_N=3`, chave `crmlp_bnav_v2`; a preferência antiga de 4 cai no padrão). Início e Contatos saíram da barra (moram no Menu).
- **➕ Adicionar rápido** (`maisRapido`): folha com Novo contato · Novo negócio na base · Nome no Estoque · **Tarefa para um contato** (busca por nome/telefone → tipo · título · hoje/amanhã/7d/data → `tarCriar` e abre a ficha na tarefa) · Evento na agenda · Solicitação · Apólice em atraso. Cada item chama a porta de criação que já existia; item de módulo desligado no perfil não aparece (`maisModDe`). **Desktop tem a mesma porta**: botão "＋ Adicionar" no topo, folha centrada (`.sheet-bd.mais-centro`).
- Provas: fluxo da tarefa dirigido de ponta a ponta a 375 e 1280 (achou o contato, criou `ligar` amanhã, ficha abriu, folha fechou); 0 alvo <44 na folha; +4 invariantes (ordem da barra, itens da folha, busca da tarefa, porta no desktop); portão 4×29 verde.

### Provas
- Portão no container: 375/1280 × cheia/vazia, 29 telas, 0 exceção, 0 campo morto, 0 estouro, `lpSelfCheck` 0, `funSelfCheck` 0. Avisos de alvo: **186 → 63** (cheia) e **159 → 36** (vazia). O que sobra: `nn-funil` 19, `bc-funil` 12, `inicio` 8, `cart-clientes` 6 (fila de UX celular).
- Prints a 375 e 1280 da Visão da Carteira (com uma apólice entrada pela venda injetada na aba) e do editor do funil.
- Guard do choke point ok. Diff sem PII (só `Zz …` inventados nos invariantes).

### Itens do prompt que continuam presos nele (conferido, não presumido)
1. Merge da cadeia — nada entrou; o `--servido` tem que dizer EXATAMENTE **v0.46.0** agora (esta sessão subiu a versão).
2. `lp_perfis_nome_ativo.sql` — não rodada (o painel Master ainda sem nome/pausa).
3. 3 textos de cobrança — não chegaram (`kb_scripts_cobranca` com as 3 linhas `ativo=false`).
6. CPF / extensão — sem resposta; fase 3 não começou.
- **As 29 telas LOGADO na base real** (Carteira ×3, Card Cliente com dado dele) não dá pra fazer do container: é passo dele no PC.

### Lições novas
- **#55 — Shorthand inline vence regra de mídia.** `style="background:…"` reseta `background-clip`; regra de mídia que depende de sub-propriedade do shorthand precisa de `!important` ou de mudar o inline pra `background-color`.
- **#56 — String simples dentro de `${}` não interpola.** `${x?'…${y}…':''}` deixa `${y}` literal e quebra na primeira aspa — o `node --check` por bloco `<script>` acha em segundos.
- **Sessão remota é uma superfície válida pra Visão LP:** portão, prints e invariantes rodam no container; o que não roda é a sessão logada dele.

### Falta dele
1. OK para mergear #113 → #121 + #118, e depois **este branch** (`claude/crm-lp-continuation-59xph2`) — ou abrir PR dele pra main depois da cadeia.
2. No PC, logado: 29 telas, Carteira ×3 na base real, Card Cliente, e a Visão da Carteira com as entradas reais do mês.
3. Migration, textos, CPF/extensão (iguais).

---

## 📸 Snapshot — 03/09/2026, fechamento · **v0.45.0 + PR #121** · o portão rodou de ponta a ponta como UM comando; nada da cadeia foi mergeado

**Estado em 30 s:** `main` = `d37b628` / **v0.42.1 no ar** (conferido pelo CONTEÚDO servido: sha `e2701bbcc925` do Pages = `main:vendas.html`, byte a byte). **#113 → #120 seguem todos ABERTOS** — ele não mergeou nada. Dos 5 itens do prompt dele, só o 2 (portão) era destravável; os outros 4 continuam presos nele (merge, migration, textos, CPF/extensão). Cadeia agora: **#113 → #114 → #115 → #116 → #117 → #119 → #120 → #121**.

### O que foi conferido (não presumido)
- **Item 1 (v0.44.0 no Pages):** não aplicável — nada mergeado. O `--servido` rodado na pasta da `main` diz *"EXATAMENTE este arquivo"* (v0.42.1); rodado no worktree diz DIFERENTE (local v0.45.0). É o comportamento certo dos dois lados.
- **Item 3 (`lp_perfis_nome_ativo.sql`):** NÃO rodada — `information_schema` do playground não tem `nome` nem `ativo` em `lp_perfis`. Nome e pausa no Painel Master ficam pra depois dela.
- **Item 4 (3 textos de cobrança):** NÃO chegaram — `kb_scripts_cobranca` tem as 3 linhas com `ativo=false` e o MESMO molde de 294 caracteres (`*Seguradora:* Prudential *Segurado:* {segurado}…`). Nada pra ativar; o selo "texto oficial" fica pra quando os textos entrarem.
- **Item 5 (CPF / extensão):** sem resposta dele → fase 3 da identidade não começou.

### Item 2 · o portão como UM comando — rodado de verdade, e consertado no caminho (PR #121)
`python3 scripts/portao.py` no worktree `card-cliente` (v0.45.0), navegador da sessão dirigindo:
- **Normal:** 375/1280 × cheia/vazia, **29 telas** (ele falou em 26; `VIEWS_CONHECIDAS` tem 29 hoje — a lista é lida do app), 0 exceção, 0 campo morto, 0 estouro, `lpSelfCheck` 0, `funSelfCheck` 0 → **exit 0, PORTÃO ABERTO**.
- **`--prova`:** `cart-visao: campo morto portao-morto-proposital · estouro 2112px` → **acusou**.
- **`--servido`:** ver acima.
- **Defeito do próprio comando, achado ao rodar:** a porta 4611 estava presa por um `python -m http.server` solto da sessão anterior → `OSError 48` e o comando morria. **PR #121 (só `scripts/portao.py`):** anda até a próxima porta livre e avisa (provado: 4611 presa → subiu em 4612); e o `--prova` deixa de terminar com "PORTÃO ABERTO — pode subir" (era enganoso: o vermelho era o defeito injetado) → agora `PROVA OK — o guarda acusa defeito (isto NÃO é o portão; rode sem --prova antes de subir)`.
- **Aviso que o portão registra sem fechar:** **183 alvos de toque < 44px a 375 (base cheia)**, 123 deles em `config-funil`: 72 chaves `fc-sw` de 16px, 24 setas `fc-arrow` de 18px, 12 lixeiras `fc-del` de 27px, 12 `fc-enc` de 21–23px. É o editor de etapas do funil — entra na fila de UX celular. Fora dele: `nn-funil` 19, `bc-funil` 12, `inicio` 8, `cart-clientes` 6.

### Lição nova
- **#54 — Comando de portão tem que sobreviver ao ambiente.** Porta presa por processo órfão não é falha do app, e o portão não pode morrer por ela. *Regra:* recurso externo (porta, pasta, navegador) falhou → o comando contorna e avisa; só o APP fecha o portão.

### Falta dele (igual à noite, mais um)
1. **OK para mergear #113 → #121, na ordem**, reapontando cada filho para `main` antes de apagar a base do pai. Depois: `git checkout main && python3 scripts/portao.py --servido` → tem que dizer "EXATAMENTE" e **v0.45.0**.
2. Rodar `lp_perfis_nome_ativo.sql` · 3 textos de cobrança · CPF? · extensão cria ou anexa?
3. **Próximo que dá pra tocar sozinho:** relatório da carteira com "entradas pelo funil"; outros cards do contato (mock b149d50e); alvos < 44px do `config-funil` (UX celular).

---

## 📸 Snapshot — 03/09/2026, noite · **v0.44.1 → v0.45.0** · o portão virou UM comando, e o Card Cliente fecha o ciclo emitida → entregue → apólice na base

**Estado em 30 s:** `main` segue em `d37b628` / v0.42.1 no ar — **nada dos #113–#117 foi mergeado** (conferido no GitHub e no Pages, não presumido). A cadeia cresceu: **#113 → #114 → #115 → #116 → #117 → #119 → #120**. Dos 5 itens do prompt dele, só o 2 (portão) era destravável; 1/3/4/5 dependem dele (merge, migration, textos, CPF/extensão). Depois, o foco que ele pediu: *funil da Base de Clientes + base de clientes 100% redondos, começando pelo card cliente*.

### O que entrou
- **#119 · v0.44.1 — Portão de deploy em UM comando** (Onda 3 da planta). `python3 scripts/portao.py` sobe um servidor, abre `portao.html`, que carrega o `vendas.html` num iframe em **375 e 1280, base cheia e vazia**, passa por **todas as `VIEWS_CONHECIDAS`** (29 hoje — a lista é lida do app, tela nova entra sozinha), abre 4 fichas (negócio nn/bc, cliente da carteira, emissão) e mede exceção · campo morto · estouro · alvos <44px (aviso); por cenário roda `lpSelfCheck` e `funSelfCheck`. Devolve 0/1. **`--prova`** injeta um campo morto e um estouro e exige que o portão acuse (R6 — provado). **`--servido`** compara o `vendas.html` do Pages com o local por sha256 + versão do `<title>` (hoje: servido v0.42.1 ≠ local, como deve). Só python3, sem node; o iframe nunca está logado. A fixture cheia é inventada e traz a **carteira nos dois formatos** (importador e cockpit) — a porta que quebrou de manhã é a que mais se testa.
  - **Achados de cara:** (a) a Agenda pedia token silencioso do Google **sem ninguém logado** → popup bloqueado + erro no console em toda abertura fria; agora só com sessão. (b) A fixture da Lista de Atraso e do relatório de exemplo tinham **nomes, celulares e nºs de apólice reais** → inventados. (c) Aba escondida no Chrome estrangula `setTimeout` (o 1º passe levou 7 min); o portão cede a vez por `MessageChannel` e roda os 4 cenários em ~5 s.
- **#120 · v0.45.0 — Card Cliente.** `clienteDe(pessoa)` = UMA leitura derivada: apólices vivas/canceladas, atraso, **propostas pendentes na Emissão** (o radar antigo lia só a lista legada do PDF), negócios no funil; casa por nome, telefone ou `cli_ref`. `cliCardHtml` pinta o MESMO card em três lugares: chips no card do funil (`🛡 2 apólices · R$ 500/mês` · `⏰ atraso 12d` · `📋 emissão 18d`), o bloco da ficha do negócio (substitui "Já é seu cliente") e a ficha da carteira, que ganha **Negócios e emissão**.
  - **O ciclo fecha por decisão dele:** desfecho *emitida* na Emissão → `vendaModal`: apólice na carteira (prêmio = PA s/ IOF ÷ 12, carimbado **estimado**) + negócio casado → **Delivery** (editável). Negócio **ganho sem apólice** mostra "Registrar apólice" na ficha → mesmo modal; já em Venda ganha não muda de etapa. `vendaPlano` é pura, `vendaAplicar` grava só no Aplicar, duplicata por nº/proposta não entra. Cliente que não existia nasce **sem cobertura inventada** (a ficha diz que capital chega na próxima importação).
  - **Bug pego no caminho:** modal aberto de dentro da ficha ficava **atrás** dela (z-index 80 < 90) — no celular, invisível. Corrigido, medido a 375.

### Provas
- Portão: 4 cenários × 29 telas, 0 exceção, 0 campo morto, 0 estouro, `lpSelfCheck` 0 (+12 invariantes do card, cada um provado quebrando: sem `funEhGanho` caem 2, sem chips 1, sem dup 1, religa → 0). Estado restaurado depois do self-check (CART/EM/S e o cache local — erro #17).
- Ciclo de ponta a ponta no preview: Joana (bc, N/Emissão, 1 apólice do cockpit por `cli_ref`) → emitida → Delivery + 2ª apólice ≈ R$ 350 → chips `🛡 2 apólices · R$ 500/mês`; Kleber (Venda ganha sem apólice) → registrar → cliente novo na carteira com PM e sem CS inventado.

### Lições novas
- **#51 — Aba escondida estrangula timer.** Portão/harness em iframe: ceder a vez por `MessageChannel`, nunca `setTimeout`.
- **#52 — Modal em cima de folha precisa de z-index acima da folha.** `atModal` nasce em 80 e o drawer está em 90; toda confirmação aberta de dentro da ficha tem que subir (ou o `atModal` ganhar um parâmetro).
- **#53 — `display` inline vence `[hidden]`.** Tópico dobrável esconde filhos por `hidden`; um `style="display:flex"` inline fura. Usar classe.

### Decisões tomadas sozinho (reversíveis)
- `ET_GANHO={nn:['DELIVERY'], bc:['Delivery','Venda ganha']}` — emitida sugere entregar (Delivery encerra o funil, decisão dele de 31/08).
- Apólice da venda entra no **snapshot** da carteira (`cartPersistRemoto`) — sem migration. Se a próxima importação do .xls não a trouxer, ela sai (aí está no relatório oficial, que é a autoridade).
- Card cliente **abre por padrão** na ficha (é ação — atraso, emissão pendente, registrar apólice — não estoque).

### Falta dele
1. **OK para mergear #113 → #120, na ordem**, reapontando cada filho para `main` antes de apagar a base do pai. Depois: `git checkout main && python3 scripts/portao.py --servido` (deve dizer "EXATAMENTE este arquivo" e v0.45.0).
2. Rodar `lp_perfis_nome_ativo.sql` · convite do Victor · 3 textos de cobrança · CPF? · extensão cria ou anexa?
3. **Não feito (próximo):** relatório da carteira com "entradas pelo funil" (ele citou "relatório carteira clientes, algo assim"); os outros cards de informação do contato (prospect × cliente, mock b149d50e).

---

## 📸 Snapshot — 03/09/2026 · **v0.42.1 → v0.44.0** · a Carteira estava MORTA na base real, e o acesso virou painel

**Estado em 30 s:** cinco PRs escritos e **abertos, nenhum mergeado** — `main` segue em `d37b628` / v0.42.1 no ar. Os PRs são **encadeados**: #113 → #114 → #115 → #116 → #117. O achado da sessão: **as três telas da Carteira estouravam com os dados reais dele** (143 clientes, 196 apólices), e o self-check que gritava apontava para o lugar errado. Planta da 2.0 publicada: https://claude.ai/code/artifact/70adfead-06fb-40da-a731-e12846e1f8de

### O que entrou (um PR por item, na ordem que ele pediu)
- **#113 · v0.43.0 — Configurações vira hub de cards.** Pedido dele ao ver o print dos Módulos. O grupo dobrável virou UM item que abre a tela de cartões. O cartão saiu de dentro do `viewModulos` e virou `hubCardHtml`/`hubSecoesHtml`: **os dois hubs usam a mesma função**, com invariante provando. Card de Acessos só é DESENHADO para admin; Barra inferior só no celular.
- **#114 · v0.43.1 — Carteira: uma forma só.** 🚨 **O maior achado.** Duas superfícies gravam as MESMAS tabelas com formatos diferentes: o importador da LP grava `{ref, nascimento, celular, cob{}}`, e o **cockpit** (`carteira.html`, que semeou a carteira real em 11/08) grava `{nome, nasc, cel, cap, mrr}` + `{ap, period, cli_ref}` — com a **chave da linha FORA do `dados`**. O `cartCarregar` fazia `map(r=>r.dados)` e jogava a chave fora → `c.cob.pm` indefinido → **Visão, Clientes e Oportunidades estouravam antes de pintar**. Conserto: normalizador único em toda carga (remoto, cache e importador); `cli_ref` entra no índice como chave própria (`'x:'`); e **sem detalhe de cobertura o app não inventa gap** (`cobDetalhe:false` — a tela explica em vez de listar todo mundo como "sem HC").
- **#115 · v0.43.2 — `pos X/16` fora do modal.** O card já estava limpo desde 27/08 (`e7b60c0`, conferido por `merge-base`); o jargão sobrava no modal da Postergação. A condição `pc.pos===16` do "já na melhor data" **não foi tocada** — tem invariante exigindo que ela continue de pé.
- **#116 · v0.43.3 — `atScript` lê a `kb_scripts_cobranca`.** Ligado na tomada e **apagado**: só entram linhas `ativo=true`, e as 3 de hoje são `false`. Casamento pelo motivo normalizado + variantes (o relatório muda acento/hífen/maiúscula de mês para mês). Molde preenchido sem deixar `{buraco}`. Quando os textos chegarem, ativar é **uma linha de SQL, sem release**.
- **#117 · v0.44.0 — Painel Master de usuários.** A tabela de 8 colunas de checkbox virou **um cartão por pessoa** (o que ela vê · o que não vê · de quem é a carteira · aviso âmbar quando falta delegação) e **uma folha só** para cadastrar e editar, com delegação como caixa. "Ver o que ele enxerga" responde qual DADO ele abre. **Migration nova** `supabase/migrations/lp_perfis_nome_ativo.sql` (`nome` + `ativo`, `if not exists`, com rollback escrito) — **o app funciona antes dela**. De quebra: a barra de cima voltou a dizer a TELA dentro de um hub, e 6 funções mortas saíram.

### Provas
- **Base real, aba logada, leitura pura:** antes → `Cannot read properties of undefined (reading 'pm'/'renda')` nas três telas; depois → as três pintam, 143 clientes, 196 apólices, **196 achadas pelo índice**, 0 cliente sem apólice, 42 com mais de uma.
- **Três guardas provados quebrando de propósito** (desliga → acusa → religa → zero): normalizador da Carteira, jargão da Substituição, pausa de acesso.
- 1280 e 375 reais, base cheia e vazia: `lpSelfCheck` 0, `qaCamposMortos` 0, zero estouro horizontal, alvos ≥44px. **+28 invariantes.**

### Lições novas (entram no Livro de Erros)
- **#47 — Guarda que compara chave sem exigir que ela exista.** `a.ref===c.ref` com os dois `undefined` dá `true`. O guarda gritou "o índice perdeu apólice" enquanto o defeito era a porta de entrada. *Regra:* comparação de chave exige chave dos dois lados.
- **#48 — Duas superfícies gravando a mesma tabela com formatos diferentes.** *Regra:* **um normalizador na porta de cada tabela**, e a chave da linha entra no objeto.
- **#49 — Ausência de DADO virando afirmação na tela.** Zerar cobertura que a carga não trouxe cria lista de abordagem inventada. *Regra:* o que não veio não vira zero; a tela diz que não sabe.
- **#50 — Invariante que lê `funcao.toString()` mente quando a função é embrulhada.** O `render` é embrulhado no fim do arquivo (bnav) e o `toString()` devolve o embrulho. *Regra:* testar COMPORTAMENTO; leitura de código-fonte só para o que nunca é embrulhado.

### Decisões tomadas sozinho (reversíveis)
- Gap de cobertura some quando a carga não traz o detalhe, com a tela explicando por quê — em vez de listar 143 clientes como "sem HC".
- `status: 'Ativa'` presumido na carga do cockpit fica **carimbado** com asterisco e explicação.
- Pausa de acesso (`lp_perfis.ativo`) é **do app**: a tela avisa e não pinta. **Não é revogação** — está escrito na tela e no comentário da migration.
- PRs encadeados em vez de cinco branches paralelas, para o diff de cada um ficar limpo (custo: mergear em ordem e reapontar os filhos antes de apagar a base — erro #32).

### Falta dele
1. **OK para mergear** os cinco, na ordem, reapontando cada filho para `main` antes de apagar a branch do pai.
2. **Rodar a migration** `lp_perfis_nome_ativo.sql` no SQL Editor (nome e pausa só aparecem depois).
3. **Convite do Victor** no Supabase (Auth → Users → Add user → Send invitation).
4. **Os 3 textos oficiais** de cobrança + confirmar as faixas 15/8 da emissão.
5. **CPF vira identidade?** e **a extensão cria pessoa ou só anexa?** — travam a fase 3 e a extensão 2.0.

---

## 📸 Snapshot — 02/09/2026, tarde · **v0.40.0 → v0.41.0 · Benefícios (regulação de sinistro)** — ✅ **NO AR** (main `9492594`, deploy conferido)

**Adendos no ar:** v0.40.1 = fix do boot (Emissão/Solicitações/Benefícios só carregavam no botão Sincronizar — `BOOT_LOADERS` única + invariante) · v0.41.0 = pedido dele depois de ver: **Benefícios saiu de Outros módulos/BackOffice e virou módulo isolado no menu de topo** (gate `MODS.beneficios`) + **card no bloco AGORA do Início** (exigências vencidas · parados · ação pra hoje/atrasada; urgência 1 quando pede ação). PR #110 mergeado por push (gh barrado pelo classificador). Sobra: 1 falha pré-existente do self-check na base real (índice de apólices por cliente, carteira).

**Estado em 30 s:** terceiro módulo do BackOffice, `bf*` no `vendas.html`, espelhando at/em/so (cards, lentes, modal, campos de estado `bola_com`/`ultima_acao`/`proxima_acao`/`protocolo`). **Não tem "Colar relatório"**: o caso é aberto à mão e vive até o pagamento. Banco JÁ MIGRADO no playground (`supabase/migrations/backoffice_v1_beneficios.sql`: `beneficios` + `beneficio_documentos` + `beneficio_exigencias` + `beneficio_eventos`, RLS dono/delegado via `lp_donos_visiveis()`, filhas visíveis só quando o pai é). **O caso Dg. foi semeado DIRETO no banco** (1 caso `em_exigencia`, 10 docs = 7 anexados + 3 pendentes, 3 exigências abertas de 18/08, 12 entradas no diário, próxima ação com prazo 02/09) — de propósito NÃO está em migration nem em fixture: dado de saúde + repo público. `lpSelfCheck` 0 falhas (+11 invariantes).

### O que entrou
- **Tela `beneficios`** (menu BackOffice → 🩹 Benefícios, contador no grupo): cards Casos abertos · Mais antigo · Exigências vencidas (lente) · 🔴 Parados há 3d+ (lente, `BF_PARADO_DIAS`, = sem evento novo no diário) · 🔇 Casos mudos (sem bola ou sem próxima ação) · quebra por LP. Lista SEGURADO · APÓLICE · EVENTO · PROTOCOLO · DIAS · SITUAÇÃO · BOLA · PRÓXIMA AÇÃO · PRAZO; filtros situação/LP/"só os parados"/busca.
- **Ficha**: cabeçalho com protocolo em TEXTO (badge vermelho "sem protocolo" quando falta), dias aberto, exigências abertas há N dias; estado no topo sempre visível; 3 tópicos dobráveis (norte de UX) — 📎 Documentos (5 estados, dicas nos itens 4 e 10, obs. por item), 📋 Exigências (adicionar + situação), 🗒️ Diário (cronológico + registrar).
- **A REGRA virou tela**: marcar `anexado` com exigência aberta e outro item ainda em aberto → confirmação em cima da ficha ("ainda tem N itens em aberto… Anexar mesmo assim?"); todo anexo grava `prazo: prazo reiniciado` no diário. Toda ação relevante (doc, exigência, protocolo, mudança de situação, solicitação) escreve no diário.
- **Gerar solicitação**: registra em Solicitações (frente outro · benefício · EXECUTAR) e mostra o texto no formato obrigatório com PROTOCOLO + itens recebidos ainda não anexados + o que ainda falta.
- "Ver exemplo" só sem login, nomes inventados, nada clínico.

### Aceite (spec §8) — verificados no preview local com o fixture do mesmo formato do caso real
1 ✅ protocolo em texto, 23 dias, 3 exigências há 15d, próxima ação com prazo — sem rolar (375 e 1280) · 2 ✅ 7 anexados / 3 pendentes · 3 ✅ aviso "2 itens em aberto" ao anexar · 4 ✅ diário em ordem · 5 ✅ texto com o protocolo · 6 ✅ parado = sem evento há ≥3d (invariante). **Falta ele abrir logado e ver o caso Dg. real** (o preview local não tem a sessão dele).

### Decisões tomadas sozinho
- Seed do caso real fora do git (banco direto). `lp_email` do caso = juca@ (dono; o Victor vê pela delegação).
- "Exigência ainda tem N itens" = documentos não anexados/não dispensados enquanto houver exigência aberta (o schema não liga doc ↔ exigência).
- Nova exigência põe o caso em `em_exigencia`; última exigência fechada leva a `em_analise`.

---

## 📸 Snapshot — 02/09/2026, noite (fechamento) · **v0.38.0 → v0.42.1** · Backoffice V1 no ar, Victor a um convite de entrar

**Estado em 30 s:** ✅ `main` = `cbf2907`, `vendas.html` **v0.42.1** servida. Sete PRs desta sessão (#106–#112) mergeados; a outra sessão subiu v0.40.1/v0.41.0 (Benefícios)/v0.42.1. Painel de pendências do CRM: https://claude.ai/code/artifact/5d57e691-38c9-4ac7-9eb3-021f485e910a (34 abertas, 4 altas).

### O que entrou depois do snapshot da tarde
- **v0.39.0 — Delegação dono → assistente** (`lp_delegacoes`, `lp_donos_visiveis()`, RLS das 6 tabelas do BackOffice aceita o delegado; o app grava com `lp_email` = dono; painel Delegações em Acessos). SQL rodado por ele no dashboard (classificador barrou DDL de RLS na sessão).
- **v0.39.1/v0.39.2 — parser da emissão consertado com o relatório REAL**: token com letra = proposta, 9 dígitos = apólice, pareados por adjacência aceitando `/` entre eles; chave `coalesce(proposta, apolice)` como coluna gerada + unique por dono; colagem que diverge do `Total MFB` **não grava**; "Ver exemplo" bloqueado logado e com números inventados; teste de idempotência no `lpSelfCheck`. Erro de origem: fixture com identificador real + exemplo desligando a sync.
- **v0.41.1 — cards seguem os filtros** (LP/contestação/busca; lentes ficam de fora) na emissão e no atraso; ficha de emissão com "Corrigir nomes" (`nomes_corrigidos`).
- **v0.42.0 — hub Módulos**: o grupo "Outros módulos" virou um item que abre tela de cards (como o Atalhos do Painel Central); gates MODS valem nos cards.
- **Banco**: relatório real de UW e Emissão colado logado (5 propostas · PA 37.696,56 · AFYC 15.013,88, sem duplicar); Victor (`victor@…`) já com `lp_perfis` (preset Assistente) e `lp_delegacoes` (juca → victor). **Falta só o convite no Supabase** (Auth → Users → Add user → Send invitation).

### Lições desta sessão
- Aba com versão em cache = colagem que "parece" que rodou e não vai pro banco. Sempre "Atualizar app" antes de testar.
- Duas sessões no mesmo clone: `git fetch` + `git pull` na main antes de cada branch; o branch local muda sozinho.
- Preview local: sem `node`; o servidor estático não segue symlink pra fora do cwd; a porta 4599 é da outra sessão.

### Próxima sessão (ordem recomendada)
1. Self-check da Carteira acusando na base real (risco de apólice escondida) — sessão própria.
2. `pos X/16` fora do card da Substituição; CANONICO_CRM.md no Drive.
3. Ligar `kb_scripts_cobranca` no `atScript` assim que os 3 textos chegarem.
4. Depois das decisões dele (CPF, extensão cria/anexa): fase 3 da identidade.

---

## 📸 Snapshot — 02/09/2026 · **v0.38.0 · Backoffice V1 (Victor)** — branch `backoffice-v1`, PR aberto, **aguarda OK dele pra merge**

**Estado em 30 s:** a spec "Backoffice V1" (levantamento do papel do Victor) foi construída inteira, **espelhando o módulo Lista de Atraso** (mesma stack, mesmo Supabase por dono, mesmos cards/chips/modal). Banco JÁ MIGRADO no playground (6 migrations, todas `if not exists`, versionadas em `supabase/migrations/backoffice_v1_*.sql`). Front no `vendas.html` v0.38.0, verificado a 375 e 1280, base cheia e vazia, 0 campo morto, `lpSelfCheck` 0 falhas (+16 invariantes).

### O que entrou
1. **Entrega 3 — Lista de Atraso ganhou o estado do caso**: `bola_com`, `autorizacao_contato` (🚫 Não contatar aparece NA LINHA), última/próxima ação com data, protocolo; card-lente **🔇 Casos mudos** (sem status ou sem próxima ação) e botão **📨 Nova solicitação** na ficha. CSV exporta os campos novos. Nada do resto mudou.
2. **Entrega 4 — dicionário de status** (`ST_DIC` no JS = `kb_status_tratativa` no banco, 8 chaves com significado, legenda ❔ nas fichas). No atraso é ADITIVO: 4 rótulos novos no dropdown, os antigos seguem válidos.
3. **Entrega 1 — Pendências de Emissão** (`em*`, tabela `emissao_pendencias`): parser do PDF "Underwriting e Emissão → Propostas Pendentes" (proposta+apólice em 2 linhas, LP pelo bloco `LP:`, confere contra `Total LP`/`Total MFB` e avisa se divergir), upsert por `(lp_email, proposta)` que **preserva os campos do Victor**, "sumiram" não apaga (card + desfecho emitida/cancelada), faixas em `EM_FAIXAS` (≥15 / 8–14 / <8, a confirmar), **card JANELA DE COMPENSATION** (dia 20 em `EM_COMP_DIA`: dias restantes, quantas dá tempo, quantas perderam = janela fechada OU prazo da próxima ação depois do dia 20). Assumiu a view `lp-pendencias` (a antiga do relatório semanal virou `viewLpPendenciasRelatorio`, fora do dispatch — mesmo destino do LPDB `atrasos`).
4. **Entrega 2 — Solicitações** (`so*`, tabela `solicitacoes`, view `solicitacoes`): `AÇÃO` consultar/executar obrigatória, texto no FORMATO OBRIGATÓRIO do item 4 (invariante testa o formato exato), Em aberto por prazo com "passou", contador **sem retorno há +3d** (`SO_SEM_RETORNO_DIAS`), **Victor × Gustavo no mês** (indicador da migração). Abre de dentro da ficha do atraso e da emissão já preenchida.
5. **Entrega 6** — 14 regras `BO-01…BO-14` em `kb_regras_negocio` (colunas reais: `dominio`=categoria, `fonte`=historico_lm_2026, `status`=vigente).
6. **Entrega 5** — `kb_scripts_cobranca` criada com os 3 motivos órfãos e o molde; `ativo=false` até os textos oficiais da assessoria. O app ainda NÃO lê essa tabela (`AT_SCRIPTS` segue no JS) — ligar quando os textos chegarem.

### Decisões tomadas sozinho (reversíveis, avisadas no chat)
- view `lp-pendencias` reaproveitada pelo módulo novo (precedente do atraso).
- unicidade `(lp_email, proposta)` em vez de `proposta` global — é o `onConflict` do padrão por dono.
- **RLS por dono segue valendo**: o Victor logado com o e-mail dele vê tela VAZIA até a delegação (pendência antiga, decisão do Gustavo).

### Aceite (spec §5) — todos verdes no preview local
1 ✅ exemplo sintético no mesmo formato → 3 · PA 12.336,00 · AFYC 4.939,81 batendo com Total MFB · 2 ✅ recolar = 0 novas, campos manuais intactos · 3 ✅ 02/09 → 18 dias; prazo 25/09 → "perdeu o mês" · 4 ✅ texto gerado com AÇÃO: EXECUTAR · 5 ✅ 🚫 Não contatar na linha · 6 ✅ 14 regras no banco · 7 ✅ atraso: só acréscimos (colunas e campos novos), nenhum comportamento antigo tocado.

**Falta dele:** colar o relatório REAL de 02/09 logado (o parser foi validado só no sintético com o mesmo layout), confirmar as faixas 15/8, e mandar os textos oficiais dos 3 scripts.

---

## 📸 Snapshot — 01/09/2026, noite · **v0.31.0 → v0.35.1** (5 entregas, sozinho)

**Estado em 30 s:** ✅ **NO AR** — `main` = `cbce796`, `vendas.html` **v0.35.1**, `revisao-protecao.html` com o PD tarifado como PI. Ele foi dormir e pediu para eu seguir sozinho. Tudo abaixo subiu conferido pelo conteúdo servido.

### 1 · v0.32.0 — o Telephone Approach soma LIGAÇÕES, não pessoas

Item do estudo do LP Business, e era literal. "Ligações" era a soma de `taTentativas` — contador vitalício, **sem data** — e "Sucesso" era quantos contatos estão *hoje* com esse status. Dois significados no mesmo cartão.

Agora **disquei · falei · agendei**, com recorte (hoje/7/30/sempre) e os desfechos do catálogo. Nenhum campo novo: cada resultado registrado já virava interação com dia e desfecho; faltava somar as **interações**. As duas taxas ficam separadas de propósito — `atendimento = falei/disquei` mede a lista e a hora; `agendamento = agendei/falei` mede a conversa. Numa taxa só, uma esconde a outra.

### 2 · v0.33.0 — reunião: agendado × realizado por etapa

O funil conta etapa, o TA conta ligação, e no meio ficava a reunião. **Marquei / aconteceu / sem desfecho**, taxa de comparecimento e a quebra **por etapa**.

**Regra da conta:** `remarcada` **não entra no denominador** — a reunião mudou de data, não falhou, e a nova será contada na vez dela. Falta e cancelamento entram. Uma linha de dado nova, só uma: `t.etapaDe`, senão a quebra por etapa daria o mérito à etapa errada (a que a própria reunião fez avançar).

### 3 · v0.34.0 — diário dos relatórios colados

O app guardava só `AT.carregadoEm`. A Lista de Atraso e a Substituição agora abrem com uma faixa: *"Dado do relatório de 28/08 · colado há 4 dias · 12 atualizadas, 3 novas, 1 sumiu"* — âmbar passando de 14 dias, com o histórico completo num clique. Poda nos últimos 24 **por tipo**.

### 4 · v0.35.0 — o card diz O QUE se vende

Com uma pessoa tendo várias oportunidades (o caso das duas do Rg.), o nome repetido não distingue nada. Precedência: **título escrito > simulação ATIVADA > nada**. Simulação apenas "Apresentada" não vira título.

### 5 · v0.35.1 — o atraso é a palavra da seguradora

O card já avisava quando o vencimento era *estimado*; o caso positivo ficava mudo. Agora: *"✓ atraso conforme a seguradora · relatório de 29/08"*.

### Revisão de Proteção · PD tarifado como PI (`b986544`)

PD não existe no catálogo local e a linha caía na tarifa da origem — mostrando um preço que **o formulário não aceita**. A página 3 do DOC0013133 não tem campo PD, e a Invalidez migra como PI. Agora tarifa como PI e diz que trocou: **R$ 49,42 na origem → R$ 64,25 como PI**. Os 30% são o *"PI encarece"* do playbook.

### O que a verificação pegou antes do deploy

- `const _r` colidiu com um `_r` existente no `lpSelfCheck` → **SyntaxError que matava o boot**.
- **Plural em português outra vez** (#40): `'aconteceu'+'ram'` = *"aconteceuram"*.
- **Invariante com data fixa** passaria hoje e quebraria amanhã → reescrito com datas relativas.
- **`colado há -1 dias`**: `toISOString()` é UTC e às 21h no Brasil já é o dia seguinte lá.
- WhatsApp contado **duas vezes** no funil da ligação.
- O guarda de campo morto achou **9 campos na gaveta** que as varreduras anteriores nunca cobriram (só passavam pelas views).

**+32 invariantes** somando as cinco entregas. `lpSelfCheck`, `funSelfCheck` e `selfTest` em 0 falhas; zero campo morto no funil, na ficha e nas 25 views; sem rolagem lateral a 375; console limpo conferido em aba nova.

---

## 📸 Snapshot — 01/09/2026, tarde · **v0.31.0** — o Início

**Estado em 30 s:** ✅ **NO AR** — `main` = `ca3de78`, `vendas.html` **v0.31.0**. O pedido era cosmético ("atualiza esses gráficos, bota tópicos encolhíveis"); o achado não era.

### O gráfico do funil estava com a conta errada

`funilHtml()` dividia *quantos estão parados AQUI* por *quantos estão parados na PRÓXIMA*. Isso não é taxa de passagem — é a razão entre duas fotografias. No funil real dele, P/C, C2 e N estavam zerados **porque o negócio já tinha passado por eles**, e a tela anunciava **0% em cinco etapas seguidas** num funil com gente em FA. As barras (12, 9, 2, 0, 0, 0, **1**, 0, 0) subiam de novo no FA, o que num funil é impossível.

Agora chama **`nnTaxas()`** — a mesma função que pinta o `% passam` no topo de cada coluna do quadro — sobre o **mesmo `funRecorte()`**. Não são duas contas parecidas: é uma conta só, lida em dois lugares. Reproduzido numa base de teste igual ao print dele, **75/22/0/0/0/0/0/0 virou 50/25/33/100/100/100/0/—**.

A barra passou a ser **quem alcançou** a etapa (por isso o funil só desce) e quantos estão parados nela hoje ficou na linha de baixo. Onde não há ninguém para medir, escreve `—` em vez de fingir 0%. `alc` é derivado do próprio `nnTaxas` **de propósito**: recalcular por fora reabriria a porta para as duas contas divergirem.

**O mesmo erro ao contrário:** o KPI "pior passagem" no cabeçalho do quadro lia a lista crua enquanto os chips das colunas liam o recorte — com um período escolhido, os dois discordavam. Passou a ler `rec.lista`.

### Início em tópicos dobráveis

Pedido dele, e agora **norte declarado de UX**: tela longa vira lista de tópicos que encolhem e estendem, com a escolha lembrada por aparelho (`crmlp_inicio_secs_v1`) e um abrir/fechar tudo. Blocos: Números · Funil Novos Negócios · Funil Base de Clientes · Telephone Approach · Para acompanhar · Funil por LP.

Duas regras que impedem isso de virar esconderijo: **bloco fechado mostra o resumo no cabeçalho** (encolher troca a tabela pela manchete, nunca apaga o número) e **o bloco `Agora` fica de fora e nunca fecha** — ele é a resposta a "o que eu faço agora".

### O resto

- **Cada funil no seu bloco**, com a taxa dele. Base de Clientes só aparece quando existe negócio lá.
- **Nomes das etapas saem de `ET_LABEL`** (o rótulo editável), não mais do id de fábrica.
- **Card "Base de Nomes" saiu** da tela de abrir — era estoque, não ação. Os cinco números seguem no módulo.
- **Duplicatas viraram linha do `Agora`**, em **urgência 4**: dentro da mesma urgência a ordem é por tamanho, e 107 pares empurrariam 24 negócios parados para baixo. Higiene de base não passa na frente de venda.

**Medido a 375px:** 1.038 → **1.016px** no padrão, **608px** com tudo fechado, sem rolagem lateral. `lpSelfCheck()` e `funSelfCheck()` passando. Deploy conferido pelo **conteúdo servido** do Pages.

**Validação:** https://claude.ai/code/artifact/b9015211-8730-4faa-bc14-aec98444748c

**Ficou em aberto:** a combinação de blocos que abre por padrão (hoje Números + Funil Novos Negócios) — ele pode pedir outra.

---

## 📸 Snapshot — 31/08 e 01/09/2026 · v0.15.2 → **v0.30.0** (13 versões)

**Estado em 30 s:** ✅ **NO AR** — `main` = `79bcc72`, `vendas.html` **v0.30.0**, e `revisao-protecao.html` com a **etapa 5 (Mudança de Seguro)** e o **Checkout**. Foram duas sessões longas: a primeira de fluidez e modelo de dados, a segunda (noturna) de UX no celular. Restou **1 PR aberto**: o **#35**, travado numa decisão de escopo do Gustavo desde julho.

### O que entrou, por frente

**Fluidez e funil**
- **v0.16.0** — Captação **escondida** atrás do interruptor `CAPTACAO_VISIVEL` (ele parou de usar; `index.html` intacto). E o `lpSelfCheck`, que estava **vermelho em produção desde a v0.14.0**, voltou a 0 falhas: eram duas *mentiras* (o `config-funil` nunca entrou em `VIEWS_CONHECIDAS`; o invariante do menu ainda exigia "Painel de TA" em Outros módulos).
- **v0.17.0** — cabeçalho do funil que **cabe na tela**: 4 números na faixa, o resto em "mais números". Desktop 44%→32%, celular **105%→43%**. E os KPIs "fechamento vencido" e "sem próxima atividade" viraram **lente** do quadro.
- **v0.19.0** — **avançar etapa em um toque** no card, com desfazer. O desfazer **apaga o registro** em vez de empilhar a volta, porque a taxa de passagem lê o histórico.
- **v0.29.0** — **atalho de etapa** no celular (o quadro tem 6,5 telas de arrasto) **+ conserto de um bug antigo**: levar o quadro até uma etapa *nunca funcionou* (`scrollIntoView` rodava antes do layout). Afetava também os atalhos do menu lateral.

**Dinheiro e cobrança**
- **v0.18.0** — **script de cobrança por motivo** (8 + genérico, por palavra-chave), editável antes de enviar, com cobertura visível na tela. "Sem tratativa" passou a mostrar **R$**, não só contagem. *(O "💰 Prêmio em risco" já existia — a nota do estudo GlobalCRM estava desatualizada.)*
- **v0.28.0** — **criar/editar/excluir simulação**. A tela existia inteira e **não havia como criar uma** (`planos.push` não existia). Ativar uma simulação **oferece** usar o prêmio dela no negócio — oferece, não aplica.

**Modelo de identidade** (ver `crm-lp-modelo-identidade` na memória)
- **v0.20.0** — **telefone como 2ª chave** (`telKey`: DDD + últimos 8 dígitos, ignora o 9º, recusa sem DDD). A mesma pessoa vivia em 5 depósitos ligados só por `normKey(nome)`.
- **v0.21.0** — a ficha do negócio **avisa quando a pessoa já é cliente**, dizendo se casou por nome ou por telefone.
- **v0.22.0** — **fila de duplicadas** no funil: unir · excluir · separar.
- **v0.23.0 / v0.24.0** — **pessoa ↔ oportunidades** (`pessoaId` derivado, zero migration) e **excluir um negócio** — que o app **não tinha**: a única exclusão era "Começar do zero".
- **v0.25.0** — **editar os dados da pessoa**, valendo para todas as oportunidades dela. Também não existia: nome e telefone só na criação.
- **v0.27.0** — **quatro estados do contato** (Novo · Abordado · Em andamento · Cliente), **derivados**, nunca digitados.

**Agenda e produtividade**
- **v0.26.1** — **fila de reuniões a finalizar**, com desfecho que move o funil. "Atrasada" e "a finalizar" não são a mesma coisa: a reunião provavelmente *aconteceu*, e o que falta é dizer o que saiu dela.
- **v0.27.1** — os **tópicos da ficha dobram** (7.799px → 1.912px).
- **v0.29.0** — **Modo Foco** na discagem: tela cheia, um nome por vez, registrar avança sozinho.
- **v0.30.0** — bloco **"Agora"** na tela de abrir, que antes tinha **zero ações clicáveis**.

**Revisão de Proteção**
- **Etapa 5 · Mudança de Seguro** com 5 blocos, simulações salvas e vínculo com os cenários da etapa 4.
- **Nova linha de etapas** (Cliente · Necessidade · Carteira de Proteção Hoje · Mudança de Seguro · Nova proposta · **Checkout**), Produtos movido para a barra de cima.

### ⚠️ Aberto / depende do Gustavo
1. **PR #35** — Revisão de Apólices duplica ou complementa o `revisao-protecao.html`? É **pré-requisito da Mudança de Seguro**.
2. **`ms-calc.html`** — sem o motor de tarifa (1.038 séries) o prêmio da apólice nova é digitado da prévia. A tela avisa que o custo fica **subestimado**. E o **caso Ms.** para rodar os critérios de aceite.
3. **Usar o app logado** — 13 versões subiram verificadas *deslogado*. Só a sessão real exercita o upsert no Supabase.
4. **X218630** · **motivos de recusa órfãos** · **CG do WL65** · **emissão das apólices-gatilho** · decisões de **CPF como identidade** e **extensão cria ou anexa**.

### 🔑 Lições desta rodada (para não repetir)
- **Medir antes de mexer.** O script que percorre as 24 views a 375px apontou o SitPlan (69% de cabeçalho) — não o palpite.
- **O app sabe MOSTRAR muito mais do que sabe RECEBER.** Três buracos do mesmo tipo: excluir negócio, editar pessoa, criar simulação. Ao achar tela bonita, perguntar antes: *existe como criar isso?*
- **Nada de escrita antes da última recusa possível** (o desfecho de reunião movia a etapa antes de validar, e pulava duas).
- **Normalizar dinheiro pela periodicidade** com o helper do próprio app (`divApol`) — somar anual como mensal deu um total 6× maior.
- Neste `vendas.html` o **`$` é querySelector** (pede `#`); no `revisao-protecao.html` os formatadores são `fmt`/`fmt0`.
- **rAF não dispara em aba em segundo plano** — não dá para verificar assim.
- **Plural em português não é "+s" no fim da frase.**
- **Falso alarme recorrente:** `scrollWidth > clientWidth` acusa rolagem lateral quando o painel do browser está oculto (largura 0). Medir em 375/1440 reais.

---

## 📸 Snapshot — 27/08/2026 (2ª leva) · v0.15.1 + R22 na Revisão de Proteção

**Estado em 30 s:** ✅ **NO AR** — `main` = `87c1958`. Duas entregas sobre a 1ª leva (agenda etapa+cor): (1) **v0.15.1** tirou o "pos X/16" do card da Substituição; (2) **R22** atualizou a Revisão de Proteção (`revisao-protecao.html`), que estava defasada no app (era R21 + Agenda). Merge autorizado pelo Gustavo ("já validei no uso do artefato; se tiver erro, ajusta depois").

### O que entrou
- **`e7b60c0` · v0.15.1 · Substituição:** removido o "· pos X/16 ·" do rótulo do card (jargão interno que confundia). A condição `pc.pos===16` do Fix A ("✓ já na melhor data") ficou intacta.
- **`87c1958` · R22 · Revisão de Proteção** (só `revisao-protecao.html`, **+174/−60**):
  - **patch44** (linha do tempo / raio-X): sai o nº de apólice das linhas; sai a lista "O que muda no caminho"; cada linha da linha do tempo e do raio-X vira **arrastável (⠿)** e **ocultável (✕)**; os 3 contadores do raio-X **recontam** com o visível; as duas visões viram **selecionáveis** (desligando as duas, a seção sai do documento do cliente).
  - **patch45** (comissão / proposta): a aba **Comissão sai do nav → gaveta na Proposta** (fechada por padrão; some por completo no modo cliente, no PDF e na apresentação); a **Proposta vira editável no modo cliente** (só a apresentação trava). Marcador `COMISSAO_GAVETA_V1` adicionado.

### Verificação
- R22 por **Caminho A** (patchers idempotentes): base md5 `ef3b10d5…` → resultado md5 **`a6f216bc…`**, **byte a byte** igual ao artefato validado headless na sessão Cowork (vtl/vcomo/vmelh3 + 13 validadores, 0 erro JS, selfTest 6/6). Diff exato **174/60**. No app servido: **selfTest 6/6, selfTestFam []**, guard de CI limpo; marcadores `COMISSAO_GAVETA_V1` + gaveta/`mesmo-cliente` confirmados na fonte.
- ⚠️ **Browser pane local travou em render de largura 0** → o portão visual dos 4 cenários NÃO rodou aqui. Aceite pela **identidade md5** com o artefato já validado + self-tests + Gustavo ter validado o comportamento no uso do artefato. Sem bump de versão (R22 não toca `vendas.html`; main segue **v0.15.1**).

### Próximo / aberto
- **Mudança de Seguro** — frente NOVA que o Gustavo está montando no chat de Projetos; entra em **outra sessão, SOBRE esta base R22** (Revisão de Apólices → mudança de seguro).
- **Revisão de Proteção no celular** ("título quebra letra a letra"): **verificado sobre o R22 — NÃO reproduz.** Scan por line-boxes reais em 375px = 0 títulos quebrando letra a letra; não há `break-all` no CSS. Provável já resolvido pelo rework do R22. Se o Gustavo ainda vir, precisa a tela/modo/dado exatos. *Achado lateral (opcional):* a tabela de cobertura ("Se acontecer…") rola horizontal no celular, cortando as colunas Custo/mês + Natureza.
- `bc` N/Emissão + Emissão Final → 🟢 [RCP/PC]: **✅ feito** (v0.15.2, `470be1f`) — de-para da agenda fechado, +1 invariante.

---

## 📸 Snapshot — 27/08/2026 · v0.15.0 — reunião de venda na Agenda Google com etapa no TÍTULO + cor Pavão

**Estado em 30 s:** ✅ **NO AR** — `main` = `8c89e2f`, **v0.15.0**. Fast-forward de `origin/main` (`e696249`), push = deploy Pages, autorizado por ele depois de validar logado. Frente pedida por um prompt do **projeto Juca 3.7** (visão holística única dos projetos dele): a etapa do funil parou de morrer na descrição do evento e passou a viver no **título + cor** — dá pra bater o olho na semana da agenda e ler se abre (🟡), fecha (🟢) ou entrega (📦) negócio.

### O que entrou (commit `8c89e2f`, só `vendas.html`)
- **Constante `REUNIAO_PREFIXO`** no topo (de-para etapa→prefixo por funil, fácil de editar). Reunião (`tipo:'reuniao'`) ganha **botão 1-toque** que cria/atualiza o evento no Google **via API** já com `<emoji> [ETAPA] <nome>` + `colorId:'7'` (Pavão). **colorId só existe pela API** — o link-template do Google (`action=TEMPLATE`) aceita `text`+`details` mas IGNORA cor; por isso virou botão, não só link.
- **De-para aprovado:** `nn`(prospect) OI/FF→🟡[OI/FF]; P/C,**C2,N,FA,EMISSÃO**→🟢[PC] (ressalva dele: esses 4 ficam mapeados); DELIVERY→📦[DELIVERY]. `bc`(base) Agendada Revisita→🟡[RCP/FF]; Novo Negócio/Resolução pós Revisita→🟢[RCP/PC]; Delivery→📦[DELIVERY]. **Fora por decisão:** bc N/Emissão e Emissão Final (viram aviso). Etapa fora do mapa: título cru, sem cor, `console.warn`.
- **Idempotente** (regex `^(\S+\s+)?\[[A-Z/]+\]\s*` substitui sem concatenar), **respeita título ajustado à mão** (prefixo não-canônico → não toca), guarda `t.gcalId` pra não duplicar. Só reunião entra — WhatsApp/ligar seguem no link-template.

### Descoberta (Passo 1 — lido do banco ANTES de codar)
Etapa vive em `lp_contatos.dados->>'etapa'` (ID de fábrica). **4 valores de funil em produção** (o código só define `lp`/`bc`): `nn` (usa etapas do funil lp), `bc` (espelho Kommo), `bn` (5.130 leads **sem etapa**), `prospects` (1 legado). **Reuniões reais só em 2 etapas hoje:** `nn`/OI/FF (1) e `bc`/Agendada Revisita (3). Os valores "Agendada Revisita"/"Contato Agenda/Revisita" que o prompt citou são etapas do funil `bc`, não do prospect — por isso não assumir.

### Verificação
Sem `node`/`deno`/`bun` na máquina (só python3): servi o arquivo com `python3 -m http.server` e validei no browser — o `<script>` inline parseia (sem erro de sintaxe), funções definidas, casos reais certos, **10 invariantes novos de reunião verdes** no self-check de boot. **Guard de CI limpo** (0 `from('leads').insert` no vendas.html). As 2 falhas de self-check `menu:…` são **ambientais** (app servido estático, sem Supabase, não bootou o menu) — não é regressão (não toquei em menu).

### Backfill aplicado (via MCP Google Calendar, dry-run mostrado antes de escrever)
2 eventos reais viraram **`🟡 [RCP/FF] Daniel Rc.…`** (id `2pgjvs5j…`, 25/08) e **`🟡 [RCP/FF] R. J.…`** (id `73d11rd2…`, 01/09), colorId 7, **local/descrição/horário preservados**. Os 2 `WhatsApp ·` (Rc., Herica) NÃO foram tocados (Regra 3). Verissimo/Fe. não tinham evento no Google.

### Lições da leva
- **Link-template do Google Calendar ignora `colorId`** — cor exige a API. Metade do pedido ("ler o funil na agenda") só fecha criando o evento pela API.
- **Ler o banco antes de escrever o de-para** evitou assumir etapa errada: o funil `bc` (base de clientes) tem nomes de etapa próprios, distintos do prospect.
- **App single-file sem node valida bem** por `http.server` do python + self-check no console do browser.

### O que ficou aberto
- **Ritual:** sincronizar este ESTADO no Drive (pasta "CAPTACAO LIFE PLANNER") — **Cowork** na próxima passada.
- `bc` N/Emissão e Emissão Final seguem **sem prefixo por decisão**; mapear pra 🟢 [RCP/PC] é 2 linhas no `REUNIAO_PREFIXO` se ele quiser.
- **PR #91** (`feat/lp-conectar-claude`, botão Conectar Claude) segue **aberto e independente** — esta frente saiu de `origin/main`, não dele. PRs #88–#90 e a 🔴 RLS dos backups `bkp_movimentos_dup_*` da Central Financeira seguem em aberto (sessão à parte).

---

## 📸 Snapshot — 16/08/2026 (2ª leva) · CRM SeguroComJucá v0.12.0 — cartões no celular, filtros recolhidos, OFFLINE e barra configurável

**Estado em 30 s:** ✅ **NO AR** — `main` = `5323669`, **v0.12.0 · CRM SeguroComJucá**. Cinco commits no branch `claude/crm-lp-fluidity-v2`, merge com `--no-ff`, autorizado por ele depois de validar o demo. Produção conferida pelo CONTEÚDO servido (SHA idêntico ao commit) e o portão rodado de novo contra o arquivo baixado do Pages.

### O que entrou
- **`ed16c34` · tabela vira cartão no celular, em CAMADA ÚNICA.** O Estoque já tinha cartões, mas escritos à mão no HTML da view. Aqui o JS lê os `<th>` uma vez por tabela e o CSS reempilha a linha por posição — vale para Contatos, Lista de TA, Lista de Atraso, SitPlan, Recomendações e para a próxima tabela que nascer. Lista de Atraso tinha 589px e Lista de TA 718px numa tela de 390.
  ⚠️ **Duas armadilhas de performance, medidas:** rotular célula a célula (`data-rot` em cada `<td>`) custava **+44ms** por repintura na tela de Clientes (4.400 nós); e `.card:has(> table.t-cards)` no CSS fez o **Funil, que nem tem tabela, sair de 160ms para 320ms** — `:has()` obriga o motor a reavaliar todos os `.card`. Custo final, medido INTERCALANDO com a v0.11.0 em produção para descontar ruído de máquina: **entre −5,5ms e +8ms**.
- **`84f502c` · barra de filtros recolhe atrás de um botão no celular.** A lista da Lista de Atraso começava no y=1050 de uma tela de 844; agora começa no **y=435**. Quatro cuidados que só apareceram testando tela por tela: contar "controles" escondia o **navegador de data do SitPlan** atrás de "Buscar e filtrar" (botão mentindo sobre o que faz) → agora exige 2 filtros de verdade; Estoque e Lista de TA já têm folha própria (`.bn-mob`) e são pulados; barra que a view já esconde (`#bn-tb2`) fica fora; segunda barra vira "Mais filtros". O botão mostra **quantos filtros estão ativos**.
- **`8044275` · service worker, barra inferior configurável e a marca nova.**
  - **SW (`sw.js`)**: *online sempre a versão nova (network-first), offline a última que funcionou*. `index.html` (Captação) **passa direto, sem interceptação** — as visões são separadas por regra do repo. Supabase nunca é cacheado. CDN do supabase-js vai cache-first (URL versionada). **Nada é pré-cacheado no install** de propósito. O "⬆︎ Atualizar app" passou a mandar `postMessage('limpar')` para o worker esvaziar o cache dele junto.
  - **Barra inferior configurável** (Configurações → Barra inferior): 10 destinos, escolhe 4, a folha impede passar disso. Padrão = o de hoje. Preferência inválida cai no padrão.
  - **Marca**: só o que aparece na tela — título, logo **SJ**, gaveta, rodapé, nome no iPhone. **Repo e URL NÃO mudaram** (quebraria links salvos e o deploy do Pages).
- **`2dd8553` · migration do sync incremental — VERSIONADA, NÃO APLICADA.** Ver "aberto".
- **`cd2393a` · safe-area do topo.** 🐞 **Regressão minha**: ao marcar o app como instalável, ele passou a abrir em **standalone** e o conteúdo subiu por baixo da status bar — o ☰ colidindo com o relógio do iPhone (print dele às 12:22). O arquivo **não tinha uma única regra de `safe-area-inset-TOP`** (só bottom/left/right), porque até então a barra do Safari segurava. Junto: **o ☰ saiu do topo** (a barra inferior já tem "☰ Menu" — dois caminhos para a mesma gaveta) e **o `h1.pg` some no celular** (pedido original: o título já vive na barra). Os KPIs do Início sobem ~180px.
  Antes de esconder o `h1`, auditei as **21 telas** comparando com o título da barra: em 17 é o mesmo texto ou equivalente; nas outras o `.sub` dá o contexto. Nada exclusivo se perde.

### Verificação
Portão (`gate.js`) verde nos **4 cenários** a cada commit e de novo contra o **arquivo baixado do Pages**. Voltar do Android, menu, filtro da Lista de Atraso, os 24 destinos e o **offline real** (rede desligada → app abre com os 260 contatos) conferidos. Console limpo, `lpSelfCheck()` com 10 invariantes novos. Guard do CI ok.

### Lições da leva
- **`:has()` é caro em lista viva.** Marcar o contêiner por JS custa zero; por `:has()` custou o dobro do tempo de render numa tela que nem tinha tabela.
- **Marcação por TABELA, não por célula.** Trocar N×M `setAttribute` por M `setProperty` + `td:nth-child(n)::before{content:var(--rN)}` tirou os 44ms.
- **Tornar o app instalável é meia entrega sem safe-area de topo.** `apple-mobile-web-app-capable` remove a barra do navegador; se não houver `env(safe-area-inset-top)`, o topo vai parar embaixo do relógio.
- **Service worker exige MIME de JavaScript.** O servidor de teste mandava `application/octet-stream` e o registro falhava em silêncio — parecia bug do código.
- **`Buffer.from(s,'latin1')` e literal JSON dentro de `<script>`**: HTML embutido tem `</script>` no meio e fecha o bloco. Base64 é ASCII puro e imune (usado no demo para embutir os 3 módulos).
- **Heurística de UI se valida tela por tela.** "Barra com 3+ controles" parecia razoável e escondia o navegador de data do SitPlan.

### O que ficou aberto

**Depende do Gustavo:**
1. **Rodar a migration `supabase/migrations/lp_contatos_atualizado_trigger.sql`** no SQL editor. Sem ela o sync incremental do Estoque não pode existir: `lp_contatos.atualizado` tem `DEFAULT now()` e **nenhum trigger** — DEFAULT só vale no INSERT, e o push faz upsert, então a coluna congela na data de criação. Um incremental por ela **não veria edições** (nome corrigido, telefone novo, estágio mudado noutro aparelho sumiriam em silêncio). Rodou? Ligo o incremental com carga completa como rede.
2. **Revisão de Proteção no celular** — arquivo próprio de 703 KB, está quebrada lá (título quebrando letra a letra). Frente separada.
3. **Toque longo com seleção em lote** — depende de decidir QUAIS ações em lote fazem sentido em cada tela.

**Continuam da lista anterior:** CG do Vida Inteira até 65, validação de prêmios, PR #35, limpeza do histórico com PII, os 5 do GlobalCRM.

---

## 📸 Snapshot — 16/08/2026 · FLUIDEZ: o celular volta a funcionar e trocar de tela custa 27ms (branch, sem deploy)

**Estado em 30 s:** ✅ **NO AR** — `main` = `ae2a70d`, **v0.11.0 · Fluidez**, mergeado e deployado com autorização expressa dele. Oito commits no branch `claude/crm-lp-fluidity-mobile-fd9oi9`, merge com `--no-ff`. Sessão de UX + performance no `vendas.html`: **zero mudança de regra de negócio, zero mudança no banco**. Produção conferida pelo CONTEÚDO servido (SHA idêntico ao commit), não pelo número da versão.

### Portão de deploy — a prática que ficou
Antes do merge rodou o `gate.js`: **4 cenários** (celular 390 × desktop 1280) × (base CHEIA × base VAZIA), cada um com 9 verificações — boot pinta a tela, `lpSelfCheck()` verde, 25 views sem exceção, nenhuma view em branco, zero estouro, criar/salvar/apagar contato, índice da Carteira idêntico à varredura, ficha dentro da tela, barra inferior inteira, console limpo. **Tudo verde nos 4 cenários, e repetido contra o arquivo BAIXADO DE PRODUÇÃO.** A base vazia entrou na lista porque o caminho do estado inicial já inutilizou um módulo inteiro neste projeto (Substituição, 11/08).
⚠️ **Lição do próprio portão:** medir a gaveta no mesmo tick de `abrirContato()` acusa falso positivo — ela desliza com `transition:right .22s`. Esperar a transição antes de medir.

### O problema, medido antes de mexer
Varredura das 22 telas em 390px e 1280px (Chromium real, CPU 4×, 1,6 Mbps, gzip como no Pages), com base sintética em volume realista e os tamanhos REAIS das tabelas lidos por SQL no playground (`lp_contatos` = 5.180 linhas / 2,9 MB de jsonb).

1. **As 22 telas estouravam a horizontal no celular** (123–254px). Culpado único: os 3 botões da topbar (🔄 Sincronizar, ⬆︎ Atualizar app, ⇄ Captação), com `white-space:nowrap` e nenhuma regra de celular. Esticavam a barra para 513px numa tela de 390 — e, com a área de layout alargada, **tudo que é `position:fixed` passava a se medir por 513**: barra inferior com a aba ☰ Menu no x=406 (fora da tela), **ficha do contato abrindo em x=150** (fechar/WhatsApp/prêmio cortados — era o "praticamente inutilizável" dele) e FAB 🎨 invisível. Provado: escondendo os 3 botões, `scrollWidth` 513 → 390.
2. **`cartRadarLista()` custava 174ms em TODO `render()`** — 92% do custo fixo de qualquer clique — só para pintar o contador do menu "Oportunidades". O(clientes × linhas) com `normKey()` por linha.
3. **O boot esperava 3,12 MB** numa consulta só (`lp_contatos`), dos quais 3,09 MB é Base de Nomes que o Dashboard não usa, atrás de um `Promise.all([...8]).then(render)`.

### O que foi entregue (5 commits)
- **`adc0837` fase 1** — ações da topbar viram folha do ⋯ no celular; KPIs em **3 colunas** com apoio em 2 linhas e toque para expandir; `.btn-mini` 40→44px; caixas de seleção 22px; "Pbaixa" → "P · baixa"; contador do módulo na gaveta ganha a pílula.
- **`390bc2e` fase 2** — índice por nome normalizado no lugar da varredura do radar; índice `ref → apólices` (o quadrático aparecia duas vezes na mesma tela); **boot sem barreira** (cada carga repinta ao chegar, coalescido em rAF).
- **`59b8981` fase 3** — `lp_contatos` em **duas voltas** (funis primeiro, Estoque paginado em segundo plano) com fallback para a consulta única de hoje; esqueleto estático no `#main`. Paginação com **duas travas**: só continua enquanto a página traz id novo e teto de 60 páginas.
- **`3a02b18` fase 4** — **botão voltar do Android** fecha camada por camada (folha → busca → modal → ficha → gaveta); favicon (dava 404) e metas de app instalável.
- **acabamento** — FAB 🎨 sai do celular (tapava o "+ Novo contato"); número do KPI cabe em 1/3 de tela; **`vendas.html` volta a ser UTF-8 100% válido** (havia 1 byte latin-1 solto num comentário — é ele que obrigava `grep -a`).

### Antes → depois (celular, CPU 4×)
| | antes | depois |
|---|---|---|
| trocar de tela (mediana das 22) | 219 ms | **27 ms** (−88%) |
| telas com estouro horizontal | 22 | **0** |
| base na tela abrindo logado | 17,5 s | **2,0 s** (−89%) |
| alvos de toque < 44px | 2.360 | **402** (−83%) |
| pior tela (Clientes da Carteira) | 567 ms | **178 ms** |

Desktop, Início: 45,7 → 4,6 ms por repintura. Console limpo e `lpSelfCheck()` verde (**60 invariantes**, 10 novos) nos dois tamanhos, em todas as telas.

### Entregáveis para ele
- **Demo navegável** (artifact): o CRM inteiro com as 4 fases, dados fictícios, sem cliente Supabase e com `localStorage` prefixado `DEMO::` — não lê nem escreve nada real.
- **Dossiê antes/depois** (artifact) com os pares de screenshot em 390px.

### Lições da sessão
- **Marcador de idempotência tem que ser ASCII PURO.** Marcador com acento passa por `u()` e nunca casa na 2ª rodada: um bloco entrou duas vezes e derrubou o script inteiro com "Identifier already declared". O `patchlib.py` agora afirma `marca.isascii()`.
- **`Patch` só grava no fim**: se o script morre no meio, as trocas já impressas NÃO foram salvas. Aconteceu com o FAB.
- **Sincronizar histórico na hora não funciona.** Fechar uma camada e abrir outra no mesmo tick (o caminho real de "abrir a ficha pelo menu") faz o `history.back()` correr contra o `pushState` seguinte e o app é abandonado dois voltares depois. A sincronização precisa ser **coalescida num microtask**, decidindo uma vez sobre o estado final. O E2E em 390px pegou; o self-check não pegaria.
- **Paginação otimista é perigosa**: sem trava, um servidor que ignore o recorte vira loop infinito de 3 MB na franquia de dados dele. A trava é "só continua enquanto trouxer id novo".
- **`Buffer.from(s,'latin1')` trunca tudo acima de U+00FF** e corrompe JSON embutido. Seed embutida vai escapada em ASCII (`\uXXXX`).

### O que ficou aberto

**Depende do Gustavo:**
1. **OK no demo** → merge na main (o push na main é o deploy).
2. **Os 4 destinos da barra inferior** no celular (hoje: Início · SitPlan · Contatos · Funil · Menu).
3. **Troca de nome para CRM SeguroComJucá** — ele pediu para o fim da sessão; falta definir o alcance (só a marca na tela, ou também repo e URL, que quebra links salvos).
4. **Service worker** — deixado FORA de propósito: é a única peça capaz de prender o app numa versão antiga. Sem ele, não abre offline.
5. **Cortar de vez os 3 MB do Estoque no boot** — mexe no merge/push dos 5.135 nomes reais.

**Pode ser tocado sem ele:** toque longo com seleção em lote + folha inferior por linha (a maior mudança de UX que falta) · tabelas de 13 colunas virando cartões em Contatos, Lista de TA, Lista de Atraso e SitPlan (o Estoque já provou o padrão) · tópicos recolhíveis com ordem persistida · virtualização das listas longas.

**Continuam da lista anterior:** todos os itens abertos do snapshot de 13/08 (CG do Vida Inteira até 65, validação de prêmios, PR #35, limpeza do histórico com PII, os 5 do GlobalCRM).

---

## 📸 Snapshot — 13/08/2026 · Revisão de Proteção v14→v19, Tarefas & Agenda, menu retrátil e o funil que voltou a ficar no lugar (v0.10.10)

**Estado em 30 s:** `main` = `d51552b`, **tudo no ar** (Pages ✅, conferido pelo CONTEÚDO servido, não pelo número da versão). Uma sessão só, [PR #69](https://github.com/juca-alt/crm-captacao/pull/69) com 4 commits, mergeado com autorização expressa dele. Cinco frentes entregues e uma exposição de dados fechada.

### 1 · Revisão de Proteção — do v13 ao v19 numa sessão
- **Motor por pessoa** (`itensDe/consDe/custoDe`): `itensHoje()` virou um caso particular deles. Uma verdade só.
- **Benefício em vida** das vitalícias (≠ cobertura de Doenças Graves): WD/WL antecipam por idade (40/50/60%), WV só depois da quitação (até 50%), com a CG citada em cada carta.
- **Grupo familiar**: `state.familia` com o **mesmo shape de apólice** do titular, então o mesmo motor roda por pessoa. O editor virou `htmlApolices(alvo, aps)` e o **⎘ Colar espelho ganhou "aplicar em"** — espelho de familiar entra só como apólice da pessoa e **nunca zera** a revisão do titular.
- **Drill-down por segurado**: chips trocam as pizzas **e** o detalhe juntos.
- **Gráficos SVG inline** (zero dependência: a peça é offline-first) e **cartas arrastáveis** — como `cartasSituacao` lê `ordemAtual()`, a ordem vale na tela, na apresentação, no PDF e no arquivo do cliente.
- **v15→v19 do protótipo dele** aplicada com os patchers do `handoff-revisao-v19.zip`: família no doc do cliente, **Carteira de proteção** (patrimônio + 4 tiers de gravidade), **área Produtos** em sanfona com os embeds (200 cirurgias com busca, 33 fraturas por região, invalidez, DDR, glossário), grupos colapsados e `ORDEM_SIT` por gravidade.
- **Regra dele, tarde da noite: "o benefício é característica do ativo, por isso fica DENTRO do ativo".** O Patrimônio virou **um card por ativo vitalício** com: o que paga em vida, **atualização do capital (IPCA + juros atuariais de até 3% a.a.)** e **curva de resgate** — fatores da planilha oficial dele (`REVISAO DE APOLICES 3.3.xlsm`, abas RESGATEWL10 e IPCA). **WD não está na planilha**: o card diz isso em vez de aproximar pela curva de outro produto. E **nenhuma projeção de valor** — o IPCA entra como histórico de 20 anos + média, porque o índice é mutável.
- **Arrastar os BLOCOS**: a ordem que ele monta no console é a ordem do material do cliente (`ui.ordemBlocos`); a numeração das seções só é resolvida **depois** de aplicar a ordem, e bloco fora da lista fica onde estava.
- 🎛️ O botão "Atualizar valor no funil (CRM)" **deixou de flutuar** sobre a peça (ele viu na visão cliente em tela cheia): virou item discreto do rodapé, escondido no modo cliente, na apresentação e no PDF.
- **`selfTestFam()` = 35 invariantes** no boot, com números de fantasia de propósito (o repositório é público).

### 2 · 🔒 Exposição de dados fechada
O arquivo **carregava sozinho a revisão completa de uma cliente real** — gravando no `localStorage` de quem abrisse a página — e trazia **um segundo cliente real** no exemplo. Ambos viraram exemplos fictícios (identidade, nº de apólice, proposta, final de cartão), **preservando capitais, prêmios e códigos** para o exemplo continuar servindo de demonstração. De quebra, o exemplo **deixou de sobrescrever** a revisão já salva no aparelho. Conferido no ar: **0 ocorrência** dos dados antigos no arquivo servido.
⚠️ **Sobra**: os dados reais continuam em **commits antigos** do repo público. Limpar o histórico é reescrita de commits — decisão dele, em momento sem ninguém mexendo no repo.

### 3 · Tarefas & Agenda (frente que ele pediu duas vezes)
Negócio sem **próxima atividade** marcada é negócio parado. As tarefas vivem no próprio contato (`c.tarefas`) e o sync manda o objeto inteiro no jsonb `dados` de `lp_contatos` → **zero migration**.
- **Card do funil**: chip da próxima atividade (vermelho atrasada, âmbar hoje) e, sem nenhuma, um **"+ próxima atividade"**.
- **Ficha**: bloco com marcar/concluir/remarcar (+1d/+7d), histórico e três atalhos.
- **Agenda & Tarefas**: view nova no menu com contador, agrupada em atrasadas/hoje/amanhã/próximas, mais a lista de negócios **sem próxima atividade**.
- **KPI "sem próxima atividade"** nos dois funis · **Google Agenda por link** (evento pré-preenchido, sem OAuth) — a sincronia de verdade é a fase 2.
- A situação da tarefa é **derivada da data** (nada de status gravado que envelhece) e **remarcar tarefa vencida parte de hoje** — senão o atraso se acumularia, que foi exatamente o erro do vencimento estimado na Substituição.

### 4 · Menu retrátil e o funil que voltava ao início
- Botão **«** na topbar (⌘\) esconde a sidebar pra apresentar a Revisão ao cliente sem o menu do CRM. Persiste por aparelho, some no celular e no print.
- 🐞 **"clico no card e volta pro início do funil"**: o `.nnboard` é recriado inteiro a cada `render()`, então o scroll horizontal (e a posição da página) voltava a zero em TODA ação. Resolvido **na origem** — guardar/repor a posição nos dois funis vale pra todo botão, atual e futuro. Provado: sem o fix 0, com o fix 400 nos 6 caminhos.
- **`lpSelfCheck()` foi de 34 a 50 invariantes.**

### 5 · Estudo GlobalCRM avaliado (item que estava parado desde julho)
Conferido **contra o app de hoje**, não contra a foto de julho. Já coberto: funil por ação, ANCE, SitPlan datado, metas, atrasos, taxa de passagem e agora a agenda. **Sobraram 5**, por valor/esforço: (1) **relatório X218630** — resolve a lacuna de cobertura da Carteira e mata o join por nome; (2) Google Agenda de verdade (OAuth); (3) scripts de atraso por motivo; (4) valor em R$ em risco na Lista de Atraso; (5) Modo Foco no SitPlan.

### Lições da sessão (custaram tempo)
- **Marcador de idempotência tem que passar pelo `u()`** nos patches do `vendas.html`: com "ó" cru o marcador nunca casa e o bloco entra de novo a cada rodada. Mesmo motivo, marcador que também aparecia em `@media print` fez a regra do mobile **nunca entrar**.
- **`io.open(P,'w')` trunca o arquivo antes de escrever**: um erro de encoding deixou o `vendas.html` com 0 byte. Recuperado com `git checkout` porque todo patch é idempotente. Agora é `open(P,'wb').write(s.encode(...))`.
- **Self-check não pode tocar no estado real**: um invariante empurrou um contato de mentira em `S.contatos` e ele ficou salvo. Invariante testa função pura, ponto.
- **A autorização de merge precisa vir na mensagem imediatamente anterior** — o classificador barrou na 1ª tentativa mesmo com o pedido dele algumas mensagens antes.

### O que ficou aberto

**Depende do Gustavo:**
1. **CG do Vida Inteira até 65** — enquanto `EV_WL_CONFIRMADO = false`, as cartas WL* calculam e aparecem **só pra ele**, com aviso, e ficam fora do material do cliente. Confirmou? É trocar a constante pra `true`.
2. **Validação de prêmios** (`validacao-premios-v19.md`) — o **WL Vida Inteira divergente** é a prioridade que o próprio doc dele marca; e as 26 da planilha precisam do de-para.
3. **Simulação com a tabela de resgate do WD** (Vida Inteira Mais) — não está na planilha 3.3.
4. **Drag/edição dos tópicos de Produtos** e os **toggles "na apresentação"** dos anexos (sumiram na fusão; retrago se ele usa).
5. **Limpeza do histórico do repo** (PII em commits antigos).
6. **PR #35 (Revisão de Apólices)** — segue `MERGEABLE` e sem OK: duplica ou complementa o `revisao-protecao.html`?
7. **Usar LOGADO**: tarefas e agenda só gravam em `lp_contatos` com sessão.
8. Continuam da lista velha: trilha de follow-up do cliente (destrava 3 itens do caderno), data de emissão das apólices-gatilho, 7 SQL de `~/Downloads/leads-bkp-restore` + decisão de RLS nas `lp_key_*`, prints do item 3 e da aba Oportunidades.

**Pode ser tocado sem ele:** fase 2 da agenda (OAuth do Painel Central) · os 5 itens do GlobalCRM · cobertura da Carteira em lote quando ele exportar o X218630.

**Fora desta visão:** extensão WA 2.0, dividida em Captação × LP Vendas.

---

## 📸 Snapshot — 12–13/08/2026 · caderno pág.2 INTEIRO + funil com visão de negócio (v0.10.3 → v0.10.9)

**Estado em 30 s:** `main` = `f6d2fba`, **tudo no ar** em `juca-alt.github.io/crm-captacao/vendas.html`. Sete versões em duas levas: a **página 2 do caderno** dele (PRs #62–#65) e o **upgrade de negócio do funil de vendas** (PRs #66–#68), com uma varredura QA no meio.

### Caderno página 2 — entregue inteiro
- **v0.10.3 (#62)** — coluna **MOTIVO** da Lista de Atraso mostra só a última mensagem (o relatório concatena todas as tentativas numa célula de 300+ chars), com o log inteiro no tooltip · **janela de 180d nos cards** da Substituição (dias corridos e quantos faltam) + data de emissão · **alerta honesto** quando não há pagamento vinculado · bloco "Sugestão de fluxo" removido a pedido dele · **cadastro puxando da Lista de Atraso** (nome → telefone + apólices com prêmio/vencimento oficial/LP/motivo) · **filtro por LP** nas Recomendações.
- **v0.10.4 (#63)** — **seletor de funil no card do contato**: trocar de esteira sem apagar e recriar, com a etapa de destino escolhida na hora (o app não inventa equivalência), sem duplicata e com histórico preservado · **ordem das colunas** configurável (↑↓) no motor genérico, valendo pras 4 telas com colunas · **Data Grid nas Recomendações** (edição na célula, filtro por coluna, largura arrastável, lote, Tab entre células).
- **v0.10.5 (#64)** — **colar células em massa** com preview linha a linha, opt-out por mudança e **desfazer**.
- **v0.10.6 (#65)** — **varredura QA**, 4 achados: 🔴 colar em coluna de lista gravava valor inválido (`Cliente` virava `estagio="Cliente"`, badge certo na tela e ZERO em toda contagem) · "nenhum pagamento vinculado" era falso quando havia pagamento fora do período · ficha aberta pela tabela das Recomendações se fechava sozinha no primeiro `render()` · emissão futura mostrava "-293 de 180 dias". Nasceu aqui o **`lpSelfCheck()`** de boot.

### Funil de vendas com visão de negócio
- **v0.10.7 (#66)** — 🐞 **o prêmio não salvava**: digitar no card do funil e clicar fora perdia o valor (só Enter ou o botão gravavam) — e a nota logo abaixo, no mesmo painel, já salvava no blur. **Régua de negócio** nos dois funis: PA em jogo, ticket médio, **previsto fechar** × **previsto emitir** no mês, fechamento vencido. **Previsão de fechamento e de emissão** por negócio (datas diferentes de propósito: a venda fecha, a apólice emite depois, e a comissão anda com a segunda). De quebra, o chip "PA no funil" somava os **encerrados** — dois números pro mesmo conceito na mesma tela; removido.
- **v0.10.8 (#67)** — **probabilidade de virar apólice**: padrão por etapa + override manual que sempre ganha · **PA ponderado** · **taxa de passagem foi pro topo de cada coluna** do board, com o gargalo como KPI. 🐞 Achado no PRINT: "120% passam" — a contagem não era monotônica; virou `nnMaxIdx` (ponto mais fundo alcançado).
- **v0.10.9 (#68)** — ele perguntou **de que período** era a taxa e **como** a probabilidade era calculada. Eram: período nenhum e tabela minha. Agora: **seletor de período** (30/90/180/365/tudo) valendo só pra taxa e calibragem, com os excluídos declarados; **`entradaFunil()`** separando data de cadastro (fato) de estimada; **probabilidade calibrada no funil dele** (`alcançaram(fim)/alcançaram(E)`) com amostra mínima, e os **dois percentuais lado a lado, rotulados**, pra ele não ler errado.

**`lpSelfCheck()` está em 34 invariantes** — um pra cada regra que quebrou nestas duas levas. Roda no boot em ~1ms e só reclama no console.

### O que ficou aberto (para a próxima sessão)

**Depende do Gustavo:**
1. **PR #35 (Revisão de Apólices)** — estava em conflito desde 28/07 e **foi desencalhado nesta sessão** (merge da main, 6 hunks mecânicos, smoke test OK, `MERGEABLE`). **Não foi mergeado de propósito**: subir pede criar as tabelas de revisão no playground + publicar a Edge Function `importar-apolice`, e falta decidir se ele **duplica ou complementa** o `revisao-protecao.html` que já está no ar.
2. **Print do item 3** do caderno — se era o *menu lateral arrastável* (estilo Central Financeira), só metade foi entregue (foi feita a ordem das colunas das planilhas).
3. **Print da aba Oportunidades** (item 4 da pág.1) — o botão "Adicionar" não existe naquela tela.
4. **Itens 6/7/9 da pág.1** — dependem dele definir a **trilha de follow-up do cliente** (quais etapas um cliente percorre depois de virar cliente). O seletor de funil da v0.10.4 já cobre parte do 7 e do 9.
5. **Data de emissão das apólices-gatilho** no ✏️ do card da Substituição — sem ela a janela de 180 dias nunca fecha.
6. **7 SQL** de `~/Downloads/leads-bkp-restore` e a **decisão de RLS** em `lp_key_contatos` / `lp_key_leads` / `lp_match_leads`.

**Pode ser tocado sem ele:** Google Agenda reaproveitando o OAuth do Painel Central (item 14) · estudo GlobalCRM (avaliar e trazer as decisões). **Fora desta visão:** extensão WA 2.0 (outra base, e ele quer dividida em Captação × LP Vendas).

---

## 📸 Snapshot — 11/08/2026 · 🔁 SUBSTITUIÇÃO nativa e OPERÁVEL (v0.10.2) + caderno de 8 ajustes + fix do "Ver no CRM"

**Estado em 30 s:** `main` = `0513250`, **tudo no ar** em `juca-alt.github.io/crm-captacao/`. Quatro entregas hoje, nesta ordem: (1) **PR #58 / v0.10.0** — o módulo **Substituição de Apólice** deixou de ser um stub morto e virou módulo de verdade no `vendas.html`, gravando em `subst_clientes/subst_apolices/subst_pagamentos`; (2) **PR #59 / v0.10.1** — 8 dos 14 itens do caderno de ajustes dele; (3) **PR #60** — fix do "Ver no CRM", achado no uso real dele; (4) **PR #61 / v0.10.2** — a Lista de Atraso virou a porta de entrada do módulo (cria cliente+apólice) e a apólice virou editável.

### 1. Substituição de Apólice — de stub morto a módulo (PR #58, v0.10.0)
O item 🔁 Substituições do menu abria uma tela dizendo "o módulo vive no arquivo `controle-substituicao.html` nesta mesma pasta" — **arquivo que não existe no repo**. O de verdade vivia solto em `~/Documents/Claude/Projects/CRM Life Planner/Artefatos/` (90KB, v1.9, localStorage `csa_state_v3`).

**REGRA DE OURO do domínio (preservada):** a apólice antiga não pode cair antes da nova completar a janela. Cair = **59 dias** de atraso. O jogo é segurar cada antiga na **faixa 30–40 dias** — atraso de propósito, economia real pro cliente, com folga pro imprevisto. `papel:'gatilho'` = a nova (abre a janela); `'proteger'` = as antigas.

- Portfólio por fôlego + ficha do cliente (janela, cards por apólice, gauge, tracker de boleto, vantagem pro cliente, timeline com cadência, sugestão de próxima ação)
- Ações: boleto → comprovante → confirmado (avança 1 mês, zera postergação), marcar pago, postergação, valor final, cadastro manual
- **Migration aplicada** (`subst_apolice_modulo_v1`, versionada em `supabase/migrations/subst_apolice.sql`): RLS por dono `lp_email = auth.jwt()->>'email'` + DEFAULT, `revoke anon`
- **Versionamento por data de impressão**: espelho traz `Impresso em`, atraso traz `origem_relatorio`; documento mais antigo que o aplicado = `stale`, não sobrescreve
- **Duas fontes de update**: colar espelho OU **puxar da Lista de Atraso** (o relatório que ele já cola tem vencido_em/pago_ate/prêmio/motivo)
- Import do backup JSON do controle antigo (o dado real entra sem passar pelo repo, que é PÚBLICO)

**Também na #58 — Lista de Atraso, o caso do abatimento de parcelas:** (a) bug latente real — a ESCRITA normalizava o nº da apólice, a **LEITURA não** (`atRowToRec` + carga do localStorage): linha fora do formato canônico nunca casava com o relatório novo → caía em "sumiu" **E** entrava de novo como nova; (b) "saiu do relatório" deixou de ter destino único → 3 saídas explícitas (regularizada / continua em atraso só saiu do corte / não sei), padrão *regularizada*; (c) vencimento que anda pra frente agora é rotulado `abatimento · −Nd de atraso`.

**Também na #58 — busca inline na topbar** (typeahead sobre o mesmo motor do ⌘K). De quebra **zerou o estouro horizontal da topbar a 375px** (medido em iframe real: 415→371px).

### 2. Caderno de ajustes — 8 dos 14 itens (PR #59, v0.10.1)
- **Janela = 180 DIAS corridos**, não "6 meses de calendário" (`SUB_JANELA_DIAS`). Emissão 10/03 fecha **06/09**, não 10/09 — o indicador mostrava folga inexistente.
- **Dias em atraso, raiz do acúmulo:** lançar pagamento no app avançava `venc` 1 mês por ESTIMATIVA; quando o pagamento abatia parcela diferente, o erro ficava e **somava a cada lançamento**. Agora existe `vencFonte` ('oficial'|'estimado'), o card avisa, e qualquer documento oficial devolve pra 'oficial' zerando o desvio.
- **Busca do Estoque não perde o foco:** o `oninput` re-renderizava a view a cada tecla, destruindo o `<input>`. Debounce 180ms + `atFocus('bn-q')` + autocomplete por `<datalist>`.
- Ordenação do kanban (5 modos, default Livre) · contador de recomendações no card · **Sincronizar ≠ Atualizar app** (dados sem reload, preservando rota/modal) · **DnD otimista** (card muda de coluna no mesmo tick do drop).

### 3. Fix do "Ver no CRM" (PR #60) — achado no uso real dele
Print do George de Melo Santos: clicar em "Ver no CRM" abria o painel com o nome certo na busca e **"Nenhuma pessoa com esses filtros"**. O `&abrir=1` não bastava — o painel abre na lista padrão **"Prontos p/ ligar"**, que exige `estagio==='lista_ta'`, e cliente da carteira é `estagio==='cliente'` (mais trilha 'seguro' e faixas de idade/renda). Fix = `irParaOndeEstA()`: zera filtros, preenche a busca e **troca a lista** pela que contém a pessoa, antes de abrir a ficha.

### 4. Substituição operável de verdade (PR #61, v0.10.2) — pedido no fechamento
Ele perguntou: *"eu tb posso add os clientes e puxar pela lista de atraso né? quero que seja funcional"*. **Estava capenga:** o "Puxar da Lista de Atraso" só ATUALIZAVA apólices já cadastradas — com o módulo vazio respondia "nada novo" e não fazia nada. Mas quem está em substituição está, por construção, em atraso, e o relatório oficial já traz cliente/apólice/prêmio/vencimento/LP/motivo.
- Preview em 2 seções (**Atualizar o que já está aqui** / **Trazer pra cá**), checkbox por apólice (opt-in) + escolha do papel + "Marcar todas". Cliente criado só se não existir, casando por nome normalizado (as N apólices da mesma pessoa caem num cliente só). Entra como fonte `oficial` + data do relatório → reprocessar não duplica.
- ⚠️ **O outro lado:** apólice vinda do atraso não tem **data de emissão** e sem ela a janela de 180d não fecha — a tela dizia "sem apólice gatilho" mesmo havendo uma. Agora distingue "sem gatilho" de **"falta a data de emissão da nova"**, com aviso + botão que resolve na hora.
- **✏️ Editar apólice** em cada card (papel, emissão, prêmio, dia, vencimento, LP, forma) + **remover do controle**. Vencimento mexido à mão vira `estimado`.
- **LIÇÃO:** entregar o "atualizar" sem o "criar" deixou o módulo inutilizável na partida. Sempre checar o caminho do **estado inicial vazio**.

**Verificação da sessão:** 105 golden asserts (jsc) contra o **backup real** do controle antigo e o **espelho real em PDF** do Drive; E2E no browser em cada entrega (fluxo de boleto completo, ponte com o atraso, as 3 saídas do "sumiu", foco da busca, DnD no mesmo tick, os 3 casos do "Ver no CRM"); console limpo; desktop e mobile por screenshot; prod confirmada pelo CONTEÚDO, não só pelo número da versão.

**⚠️ PENDENTE (dele) e próximas frentes:**
1. ✅ **Backup da Substituição JÁ IMPORTADO por ele** (confirmou no fechamento). Agora pode também **puxar da Lista de Atraso** pra trazer clientes/apólices que faltarem, e completar a **data de emissão** da apólice-gatilho pelo ✏️ (sem ela a janela de 180d não fecha).
2. **Caso R. D. F.** — não reproduzi (base vazia). Corrigi o mecanismo pela especificação; se após importar ainda divergir, precisa do print da ficha + relatório.
3. **Caso G.** — precisa dos **dois relatórios** (antes/depois do abatimento) pra fechar em definitivo.
4. **Item 4 do caderno** (botão "Adicionar" na aba Oportunidades): esse selector **não existe** em `vendas.html` nem `carteira.html` — **precisa de print** pra conectar a coisa certa.
5. **Itens 6+7+9** (duplo modelo do card Cliente×Oportunidades · modal Mover Estágio em etapa única · converter contato→aba Clientes): dependem de definir a **trilha de follow-up de cliente**. Viram UMA frente, sessão própria.
6. **Item 13** (extensão Wapp, PA/PM editáveis): outra base (`extensao-whatsapp/`), já reservado como frente "extensão WA 2.0".
7. **Item 14** (Google Agenda): precisa OAuth — o **Painel Central já tem** integração persistente, reaproveitar de lá.
8. **PR #35** (Revisão de Apólices) segue aberto desde 28/07 e **precisa rebase** (mexe no mesmo `vendas.html`, que mudou muito hoje).

**Pontos críticos que o Claude futuro NÃO pode esquecer:**
- **Espelhos REAIS da Prudential estão no Drive**: `~/Library/CloudStorage/GoogleDrive-juca@.../Meu Drive/Prudential/Apolices Carteira {Jucá,Daniel,Rebeca}` (345 PDFs, da skill `apolices-prudential`). Ler com `pdfplumber`. **Calibrar sempre no texto real** — foi assim que achei que o CPF não era extraído (a regex exigia início de linha, mas o PDF traz `Segurado: FULANO CPF: ...` na mesma linha).
- No `painel-lp.html`, `S.cont` é a base INTEIRA, mas **`SMART[S.activeList].base` + `passFilter` decidem o que aparece** — achar o contato em memória não significa que ele está visível.
- **Em linha compacta do `vendas.html`, usar `/* */` e NUNCA `//`**: um comentário `//` engoliu o resto da linha (incluindo o fechamento de um `try`) e derrubou o script inteiro com "Unexpected end of script".
- **Bisect de sintaxe por fatia de linhas dá falso positivo** (corta no meio de função). O certo é reconstruir do `git show HEAD:arquivo` e aplicar patch por patch checando cada estágio.
- **`innerWidth: 0`** no `javascript_tool` de novo. Pra medir layout: montar um **iframe de 375px dentro da página** e medir `scrollWidth` lá.
- Editar o `vendas.html` por **python com latin-1** (`s.encode('utf-8').decode('latin-1')` nas âncoras acentuadas), não por Edit direto.
- O classificador **barra `gh pr merge` e `git push <sha>:main`** por padrão; **passa** quando o Gustavo autoriza expressamente na mesma sessão.
- `git fetch` ANTES de editar o clone compartilhado; `grep -a` obrigatório no `vendas.html`; sem node na máquina (testes no browser interno ou via `jsc`).

**Prompt pronto pra retomar (cole num chat novo):**
> Sessão CRM **Visão LP** (repo `juca-alt/crm-captacao`, git real em `~/Documents/crm-captacao`, playground Supabase `cjieobmdpqcupzdpckef`). Leia as memórias `crm-lp-substituicao` + `crm-lp-caderno-ajustes`. Estado: `main` = `0513250`, v0.10.2 no ar — módulo **Substituição de Apólice** nativo (tabelas `subst_*`, RLS por dono), 8 ajustes do caderno e o fix do "Ver no CRM". **Já importei o backup da Substituição**; falta completar a data de emissão das apólices-gatilho (✏️ no card) pra janela de 180d fechar. **Frentes na fila, eu escolho:** (a) itens 6+7+9 do caderno = duplo modelo do card + modal Mover Estágio + converter contato→Clientes (precisa definir a trilha de follow-up de cliente); (b) item 4 (te mando o print da aba Oportunidades); (c) extensão WA 2.0; (d) Google Agenda reaproveitando o OAuth do Painel Central; (e) rebase do PR #35. **Regras:** `git fetch` antes de editar, `grep -a` no `vendas.html`, editar por python/latin-1, uma sessão só nesta visão.

---

## 📸 Snapshot — 10/08/2026 · ⏰ LISTA DE ATRASO virou MÓDULO no ar (v0.9.9) — backoffice.html standalone → `vendas_atrasos`/Supabase

**Estado em 30 s:** a **Lista de Atraso** (antes só o artefato `backoffice.html` em localStorage) agora é um **módulo dentro do `vendas.html`** (Outros módulos → BackOffice → Lista de Atraso), gravando na tabela **`vendas_atrasos`** do playground `cjieobmdpqcupzdpckef`. **NO AR** em `juca-alt.github.io/crm-captacao/vendas.html` (v0.9.9, main `d269685`, PRs #54→#57 mergeados hoje). Fluxo: **📋 Colar relatório** → detecta oficial Prudential × assistentes → preview → aplica (upsert por `(lp_email, apolice)`). Dias em atraso são DERIVADOS (hoje − vencido_em), nunca coluna.

**O que foi feito nesta sessão (evolução v0.9.6 → v0.9.9):**
- **v0.9.6 (#54):** módulo criado + migration aplicada (`supabase/migrations/vendas_atrasos.sql`: +7 colunas, UNIQUE `(lp_email,apolice)`, RLS por dono `lp_email=jwt email`). Os 7 bugs do prompt corrigidos na origem (upsert por apólice, dias derivado, presente nunca vira "pago", pago≠venc, apólice string normalizada).
- **v0.9.7 (#55):** aplicar não exige mais nome (desbloqueou) + 1ª tentativa de ler nome sem rótulo.
- **v0.9.8 (#56) — O FIX GRANDE:** com o **relatório real** do Gustavo (salvo em `scratchpad/relatorio-real.txt`), descobri que TODO o registro vem **DEPOIS** do nº da apólice → reescrevi o parser p/ **janela FORWARD** `[nº..próxima apólice]`. Isso consertou o **bug de datas herdadas da apólice de cima** (G. 001…611=22/06, 001…343=27/06) — **que já existia no artefato backoffice.html**. Nome extraído entre `Ativa` e o 1º contato (some o "Ativa" que vazava). **Status workflow de volta** (dropdown na ficha) + os 2 novos que ele pediu (`Boleto pago cliente`, `Aguardando baixa sistema`). Ficha ganhou edição de segurado/responsável/vencimento/prêmio.
- **v0.9.9 (#57):** re-colar CONSERTA nomes "Ativa …" salvos na v0.9.7 (heal), preservando nome corrigido à mão.

**Verificação:** 73 golden asserts contra o relatório REAL (`scratchpad/atrasos-core.js` + `atrasos-test.html`, rodo no browser interno — SEM node na máquina). E2E no app conferido (10 registros, datas/prêmio/LP/nome ok).

**⚠️ PENDENTE / próximas frentes:**
1. **Gustavo re-colar o relatório LOGADO** (Cmd+Shift+R p/ pegar a v0.9.9) → cura datas + nomes dos registros que já tinha aplicado.
2. **Separar automático os ~8 registros "2 nomes" (resp≠segurado, ex. Everton/Ludmila):** o texto colado do PDF achata as colunas → não dá p/ separar. Empresa+pessoa (LTDA/EIRELI) já separa. Solução real = ligar o **upload de PDF com coordenadas** (o `lpPdfText`/`lpMergeWrap` do LP antigo já faz isso por gap de coluna) — frente a mais, aguardando OK.
3. Colisão histórica: o módulo Revisão de Apólices (PR #35, aberto) também mexe no `vendas.html` — vai precisar rebase.

**Pontos críticos que o Claude futuro NÃO pode esquecer:**
- `grep -a` obrigatório no `vendas.html` (bytes não-UTF8). **`git fetch` ANTES de editar** (clone compartilhado; a v0.9.5 subiu por baixo enquanto eu editava a v0.9.4).
- Sem node na máquina → rodo testes no **browser interno** (python3 `http.server` no scratchpad; `preview_start {url}` abre :8799, mas `navigate` direto a localhost é bloqueado por policy → usar `preview_start` + `javascript_tool` com `tabId` explícito).
- `let`/`const` no topo do `<script>` NÃO viram `window.*` — testar por nome nu.
- O `MFB` do relatório é sempre "Gustavo Melo Juca"; o LP de serviço (Daniel/Gustavo/Rebeca) vem do agrupamento `LP:` — é o `lp_servico`, distinto do `lp_email` (dono do registro).

**Prompt pronto pra retomar (cole num chat novo):**
> Sessão CRM Life Planner (`vendas.html`, repo `juca-alt/crm-captacao`, playground Supabase `cjieobmdpqcupzdpckef`). O módulo **Lista de Atraso** (Outros módulos → BackOffice) está NO AR (v0.9.9, `vendas_atrasos`). Leia o snapshot 10/08 do `ESTADO_DO_PROJETO.md` + a memória `crm-captacao-visao-lp`. Retomar em UMA das frentes: (a) **upload de PDF com coordenadas** pra separar automático os ~8 registros de 2 nomes (resp≠segurado) — o `lpPdfText`/`lpMergeWrap` do LP antigo já faz isso; (b) ajustes que o Gustavo pedir depois de usar. Regras: `grep -a` no vendas.html, `git fetch` antes de editar, sem node → testo no browser interno (fixture real em `scratchpad/relatorio-real.txt`, golden em `atrasos-core.js`+`atrasos-test.html`).

---

## 📸 Snapshot — 23/07/2026 (noite) · SYNC CONTATOS LP → SUPABASE no ar + extensão v0.3.0 (frente "c" CONCLUÍDA no código)

**Pedido do Gustavo: "o que falta do app pro Supabase? bota logo".** PR #28 MERGED (main `f4c7f8b`):
- **vendas.html v0.4.1**: nova tabela **`lp_contatos`** (migration `supabase/migrations/lp_contatos.sql`
  — 1 linha/contato, `dados` jsonb, RLS por dono=email, padrão carteira). `salvar()` carimba `_upd`
  no contato alterado + push com debounce; boot faz merge remoto×local por `_upd` (maior vence) e
  sobe base local no 1º sync. Deslogado/sem migration = comporta como antes (localStorage).
  Validado em Chromium (boot offline, carimbo, recarimbo).
- **Extensão v0.3.0**: Visão LP resolve contato do FUNIL → Carteira → criar; card LP EDITÁVEL
  (etapa NN/BC, telefone, notas, upsert com `_upd`); criar contato LP direto do chat
  (NN→SitPlan, BC→Clientes Ativos). QA Playwright **22/22 verde**.

**⚠️ PENDENTE DO GUSTAVO (sem isso o sync não liga; app segue como hoje):**
1. Rodar `supabase/migrations/lp_contatos.sql` no SQL Editor.
2. Atualizar a extensão local (ZIP da main + ↻ em chrome://extensions).
3. Abrir o vendas.html LOGADO uma vez em cada aparelho (1º sync sobe a base local).
Enum origem: ALTERs rodados por ele em 23/07; lista final do enum ainda não conferida no chat.
⚠️ SESSÃO LP paralela: o vendas.html ganhou o bloco "SYNC CONTATOS" + salvar() novo — dar fetch
antes de mexer.

---

## 📸 Snapshot — 23/07/2026 · Extensão WhatsApp em USO REAL — v0.2.0 (Captação + Visão LP) (sessão da extensão, visão CAPTAÇÃO)

**Teste real do Gustavo ANDOU:** card achou lead pelo telefone (PI00455), salvar revelou que
`leads.origem` é ENUM (`origem_t`) DEFASADO — faltava até 'Rec Cliente' (a velha pendência
"validar 4 origens"). Migration `origem_whatsapp.sql` alinha o enum com TODAS as origens do app
+ 'WhatsApp' (Gustavo rodou os ALTERs no SQL Editor em 23/07; conferir lista com
`select unnest(enum_range(null::public.origem_t))`).

**Extensão v0.2.0 na main** (PRs #25 toast/origem, #26 aba recolher/expandir, #27 seletor de visão):
- Tabs **Captação × Visão LP** no painel; escolha persiste.
- **Visão LP** = card da **Carteira** (única fonte LP no Supabase): cliente identificado
  AUTOMATICAMENTE pelo número (telefone extraído do `dados` jsonb, variantes do 9º dígito),
  leitura + apólices; sem match → atalho "Criar como lead de Captação".
- Descoberta da exploração: contatos/funil LP (nn/bc) vivem 100% no `crmlp_v03_state`
  (localStorage do vendas.html) — card LP editável SÓ depois da frente "sync contatos LP →
  Supabase" (fazer em sessão LP; nada do vendas.html foi tocado por esta sessão).
- Card de lead sem origem não grava mais 'WhatsApp' sozinho ("— sem origem —" default).
- QA automatizado (Chromium+Playwright, mock WhatsApp + Supabase mockado): **18/18 verde**.

**Pendências desta frente:** Gustavo atualizar a extensão local (ZIP main + ↻ em
chrome://extensions) e seguir o uso real; trava 2b de telefone segue não rodada;
migration origem rodada mas lista final do enum não conferida no chat.

---

## 📸 Snapshot — 23/07/2026 · Sessão "Funil Negócios Base de Clientes" — ✅ **NO AR (v0.4.0, MVP 1.0 zerado pro uso real)**

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO LP)
```
Retoma o CRM Visão LP (vendas.html). Lê o ESTADO_DO_PROJETO.md.
REGRA: uma sessão por visão — NÃO tocar na Captação (index.html); git fetch antes de editar.
Estado 23/07: v0.4.0 NO AR (PR #24 MERGED, main c4c095f) — módulo FUNIL NEGÓCIOS BASE DE
CLIENTES (espelho do funil CLIENTES CARTEIRA do Kommo, pipeline 12543239) + DADOS DEMO
ZERADOS (chave localStorage v03, seed vazio, botão demo removido). Estou usando com dados
reais e: [tudo certo / deu isso: ...]. Frentes candidatas: (a) importar os leads direto do
Kommo pela API interna (evita digitação manual), (b) ajustes de uso real, (c) sync
contatos/funil → Supabase (hoje é localStorage por aparelho).
```

**✅ DEPLOY 23/07 (autorização explícita do Gustavo no chat):** PR #24 **MERGED** (merge via `gh pr merge`
— 1ª tentativa deu "Base branch was modified" TRANSITÓRIO do GitHub com main idêntica; retry 5s depois
passou). Pages reconstruiu em ~1min; confirmado no ar: v0.4.0, módulo BC presente, `crmlp_v03_state`,
zero dado demo (conferido com `grep -a` — sem o `-a` o grep falha MUDO no vendas.html, pegadinha de sempre).

**Limpeza do demo (2º commit do PR, `d5d8cb6`):** seed sem os 9 contatos fictícios (perfis Gustavo/Daniel
ficam); chave localStorage `crmlp_v02_state` → **`crmlp_v03_state`** (todo aparelho começa limpo, sem
depender de clique; estado demo antigo fica abandonado); botão "Recarregar demonstração" + `resetDemo()`
removidos ("Começar do zero" fica); empty-state de Planos sem referência ao caso demo. As menções
CINQ/Artur que FICARAM são texto explicativo do método (Princípios/subtítulo de Planos), não dados.

**O que foi construído (pedido do Gustavo 23/07):** módulo **Negócios Base de Clientes** no
vendas.html (v0.3.1 → **v0.4.0**), mesmo formato do Funil Novos Negócios: grupo na sidebar
(💼 Funil + lista de Etapas com contagem), kanban arrastável + modo Lista, encerramentos
recolhíveis. Etapas capturadas ao vivo do Kommo via API interna (`/api/v4/leads/pipelines/12543239`,
funil "CLIENTES CARTEIRA"): Clientes Ativos → Pendência/Atraso → Contato Agenda/Revisita →
Agendada Revisita → Novo Negócio/Resolução pós Revisita → N/Emissão → Emissão Final → Delivery,
encerramentos Venda ganha/Venda perdida (typos do Kommo saneados: "Pendência/Atrasot", "Delivery.1";
etapa de sistema "leads de entrada" fica de fora).

**Arquitetura:** contato ganha campo `funil: 'nn'|'bc'` (ausente = nn, retrocompatível com
localStorage existente); `meusContatos()` agora EXCLUI bc (SitPlan/KPIs/Contatos/funil NN não
veem cliente da base) e `meusContatosBC()` é a população do módulo novo; drawer usa `etapasDe(c)`
(stepper mostra as etapas do funil certo); motor `registrarResultado` mapeia p/ BC ("Agendou X" →
Agendada Revisita, "Sem interesse" → Venda perdida); "➕ Novo negócio" reusa o modal de novo
contato com `openNovoContato('bc')` (nasce em Clientes Ativos, sem lista de discagem).

**Validação (preview local lp-static:8781):** sem erro de console; criar negócio BC ✓; stepper BC
no drawer ✓; motor mapeado ✓; drag (bcMoveEtapa) + jornada logada ✓; isolamento NN×BC ✓ (contato
bc não aparece em meusContatos); encerramentos abrem/recolhem ✓; funil NN intacto ✓. Sintaxe
validada via JavaScriptCore (sem node local); regra do guard ok (0 insert em leads no vendas.html).

**Pendências:** (1) validação REAL do Gustavo no preview + OK explícito pra merge do PR;
(2) carga dos dados oficiais (ele digita ou a gente importa do Kommo em sessão futura — a API
interna do Kommo dá os leads por etapa, dá pra automatizar importação depois); (3) validação
logada do sync carteira ☁️ (pendência anterior, segue).

---

## 📸 Snapshot — 21/07/2026 · Sessão "Extensão WhatsApp → CRM" (visão CAPTAÇÃO, branch `claude/whatsapp-web-crm-extension-h9z9l3`)

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO CAPTAÇÃO)
```
Retoma o CRM Captação (visão Captação = index.html). Lê o ESTADO_DO_PROJETO.md.
REGRA: uma sessão por visão — NÃO tocar na LP (vendas.html); git fetch antes de editar.
Estado 21/07: extensão Chrome "Captação · WhatsApp → CRM" v0.1.0 MERGEADA na main
(PR #22, main = a2e74f3, guard verde; index.html/vendas.html intocados — Pages sem
mudança no app). Pasta extensao-whatsapp/ — falta o TESTE REAL do Gustavo (load
unpacked, roteiro no extensao-whatsapp/README.md; checklist guiado entregue no chat).
Testei o fluxo real (WhatsApp Web → card → criar/editar lead): [FUNCIONOU / deu isso: ...]
```

**O que foi construído (pedido do Gustavo, inspiração HubSpot/Atendare):** extensão Chrome MV3
pra WhatsApp Web — ao abrir uma conversa, painel lateral (Shadow DOM, visual do CRM) mostra o
card do lead casado por **telefone** (variantes com/sem 9º dígito); sem match → "+ Criar lead"
pré-preenchido (status "Com Telefone", origem nova "WhatsApp", PI pela trigger); edição de
Etapa×Status (funil dinâmico de `app_settings.funil_cfg`), cargo/empresa/cidade/e-mail/origem/
recomendante/observações, follow-up + tarefa na timeline. Busca manual como fallback. v1 SEM IA,
SEM API Meta, SEM ler conteúdo de mensagens; DOM só leitura (anti-ban).

**Arquitetura:** REST puro (GoTrue senha+refresh, PostgREST) sem supabase-js; rede só no service
worker; `crm-api.js` = choke point da extensão espelhando `insertLead`/`updateLead`/`logEdit`/
`setLeadTask` (derivados, carimbos, `etapa` nunca gravada, 23505 traduzido). Guard de CI ganhou
bloco aditivo: `rest/v1/leads` fora do `crm-api.js` na pasta da extensão = build falha (rodado
local, verde; blocos antigos intocados). Login = mesma senha do CRM, token em `chrome.storage`.

**Novos arquivos:** `extensao-whatsapp/` (manifest, config, normalize — ports fiéis de normPhone/
fuzzy/FN_CFG_DEFAULT —, crm-api, sw, content/wa-dom + panel + css, README com roteiro de QA de
12 passos), `supabase/migrations/telefone_e164_unique.sql` (trava 2b: diagnóstico dos 6 telefones
duplicados → unificar em Duplicatas → UNIQUE comentado até zerar), `privacidade-extensao-whatsapp.html`.

**Pontos críticos pro Claude futuro:**
- **Mergeado na main em 21/07** (PR #22, autorização do Gustavo no chat: "já deixar no crm captacao") — merge não muda o app em prod (só pasta nova + guard + docs). QA real do Gustavo AINDA PENDENTE; bugs viram branch novo.
- Migration da trava 2b **NÃO rodada** (manual, e depende de unificar os 6 duplicados primeiro).
- DOM do WhatsApp não tem contrato: detecção em camadas (JID `data-id` → número no título → nome
  → busca manual). Se o WhatsApp mudar o DOM, a extensão degrada pra busca manual — checar
  `content/wa-dom.js` primeiro. JIDs `@lid` (privacidade de número) caem no fallback por nome.
- Pendências herdadas continuam: deploy v2.7.0 no ar (conferir rodapé), teste real do fluxo
  Instagram, 4 origens de PI logado.

---

## 📸 Snapshot — 19/07/2026 (noite) · Sessão "Ativação Prospector Instagram" (visão CAPTAÇÃO, autonomo-3)

### ▶️ PROMPT PRA RETOMAR (cole numa sessão nova — foco VISÃO CAPTAÇÃO)
```
Retoma o CRM Captação (visão Captação = index.html). Lê a memória insta-prospector-extensao e o ESTADO_DO_PROJETO.md em ~/Documents/crm-captacao.
REGRA: uma sessão por visão — NÃO tocar na LP (vendas.html); git fetch antes de editar.
Estado 19/07 noite: Instagram → CRM ATIVADO — migration instagram_handle rodada+verificada no Supabase, PR #19 (QA v2.6.3) e PR #21 (v2.7.0) integrados, main = ac52a04. Deploy Pages ficou preso em incidente do GitHub — PRIMEIRO checar se https://juca-alt.github.io/crm-captacao/ mostra v2.7.0; se não, forçar rebuild (gh api -X POST repos/juca-alt/crm-captacao/pages/builds).
Testei o fluxo real (extensão → 📋 Enviar pro CRM → ◎ Sincronizar do Instagram): [FUNCIONOU / deu isso: ...]
Frente: (a) ajustes do teste real; (b) score A/B/C/D por IA na bio; (c) foto data-URI → Storage.
```

**Estado em 30 segundos:** migration `instagram_handle.sql` verificada em prod (coluna+índice único+CHECK, select provou 1/1/1). PR #19 MERGED; PR #21 integrado via merge local `--no-ff` + push (`gh pr merge` bloqueado por permissão da sessão) — main = `ac52a04` = **v2.7.0 · Instagram → CRM**; #21 fechado c/ comentário (GitHub recusou retarget por já estar 100% contido na main). Sanity pós-merge ok (24× instagram_handle, sem marcador de conflito).

**Pontos críticos pro Claude futuro:**
- **Deploy NÃO confirmado no ar ao fechar:** incidente do GitHub (Pages degraded + API 503) segurou o build "building" por 40+ min. O commit certo (`ac52a04`) está na main; era só o Pages. Checar versão no rodapé antes de qualquer coisa.
- Gustavo ainda **não testou o fluxo real** — dedup por @ foi validado em harness, não com os leads reais dele. No teste: lead existente tem que ser casado pelo @ (atualizar, não duplicar). Lembrar de recarregar a extensão E a aba do Instagram.
- `ESTADO_DO_PROJETO_backup-local-2026-07-08.md` (86KB, não-versionado) = o ESTADO antigo local, preservado quando a main passou a versionar este arquivo — tem o histórico até 08/07 (pendências antigas: validar 4 origens de PI logado, 6 telefones duplicados → trava 2b).

---

## 📸 Snapshot — 19/07/2026 · Sessão "UX mobile do Vendas" (Claude Code, branch `claude/mobile-app-ux-navigation-nok5sf`)

**Contexto:** Gustavo mandou print do `vendas.html` (ISLAND · v0.3) no iPhone — inutilizável: sidebar de 64px só com ícones comendo a tela, topbar estourando na horizontal, funil espremido, botões minúsculos, sem conseguir navegar.

**O que foi feito (só `vendas.html`, bump pra v0.3.1):**
- **Sidebar → gaveta off-canvas** no mobile (≤980px), com rótulos completos, aberta pelo hambúrguer ☰ na topbar; fecha ao navegar ou tocar fora.
- **Barra de navegação inferior** (zona do polegar): Início · SitPlan · Contatos · Funil · Menu, com estado ativo sincronizado com a navegação existente (`irPara`).
- **Fim do estouro horizontal:** `min-width:0` no `.main` (causa raiz — item flex não encolhia), tabelas e funil roláveis dentro dos cards, topbar compacta (tags e nome do perfil somem em tela estreita, fica só avatar).
- **Alvos de toque:** botões ≥44px, checkboxes 20px, stepper maior; **inputs/selects com fonte 16px** (mata o auto-zoom do iOS que desorientava a navegação).
- **Drawer de contato em tela cheia** no celular (`100dvh`, botão fechar 40px). Bug de flexbox corrigido: `.sec` com `flex-shrink:0` (senão as seções comprimiam/clipavam dentro do `drawer-body`).
- KPIs em grid 2 colunas; toasts acima da barra inferior; `viewport-fit=cover` + `env(safe-area-inset-*)` pro iPhone; texto do kanban avisa que no celular a etapa muda pelo perfil (drag HTML5 não existe em touch).
- Desktop (>980px) **intocado**.

**Verificação:** Playwright/Chromium headless a 390×844 (iPhone) — sem estouro horizontal em Início/SitPlan/Contatos/Funil, gaveta abre/fecha, barra inferior sincroniza ativo, drawer 390px de largura, alvos da barra 52px. App roda 100% em localStorage mesmo com CDN do Supabase bloqueado (sandbox).

**Estado real do repo notado nesta sessão (CLAUDE.md está desatualizado):**
- `vendas.html` no main já é **ISLAND · v0.3 · Visão LP** com chave `crmlp_v02_state` (CLAUDE.md ainda fala em v0.1/`crmlp_v01_state` e num `vendas-dev.html` que não existe no repo).
- `ESTADO_DO_PROJETO.md` não existia no repo (recriado agora).

**Publicação:** Gustavo aprovou pelos screenshots da verificação (19/07) e mandou publicar direto — merge no main feito na mesma sessão, v0.3.1 no ar via GitHub Pages. Validação final de uso real: no iPhone dele, em produção.

---

*Contrato: Code escreve aqui; Chat só lê; Cowork reconcilia repo ↔ Drive.*
