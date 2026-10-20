# Extensão Chrome — CRM · WhatsApp (Visão LP) — v2.9.1

## 2.9.1 (20/10/2026) — entrar pelo GOOGLE (sem senha)
- Palavra dele: *"ajusta pra eu fazer login pelo Gmail também na extensão, porque lembrar senha é loucura"*.
- O Google não abre dentro do painel (iframe). Agora **quem abre é o Chrome**: `chrome.identity.launchWebAuthFlow` numa janelinha;
  o Supabase devolve a sessão pro endereço fixo da extensão e ela vai pro card por mensagem (`wa-google` → `auth.google.card` →
  `wa-sessao` → `sb.auth.setSession` no app). Cada login cria uma sessão NOVA (o card e a extensão não dividem refresh token).
  Também vale no login da própria extensão (botão **Entrar com Google**). E-mail e senha continuam funcionando.
- **Endereço fixo:** o manifest ganhou `"key"` → o id da extensão é o mesmo em qualquer Chrome: `mjickkflfaghdchkbpoiefioggomfdea`.
  Por isso a 2.9.1 entra como extensão NOVA (o login da extensão e as preferências do painel começam do zero uma vez).
- ⚠️ **Passo único no Supabase:** Authentication › URL Configuration › Redirect URLs › **Add URL** →
  `https://mjickkflfaghdchkbpoiefioggomfdea.chromiumapp.org/**` (sem isso o Google volta pro site e o login não completa).
- Permissão nova: `identity`.

## 2.9.0 (19/10/2026) — o CARD DO CRM no painel + Umbler Talk
- **Palavra dele:** *"ela tem que abrir um card como é no CRM, igual — aí atualizo tudo lá como se tivesse no CRM; inclusive se mudo
  algo no CRM fica mais fácil pra atualizar a extensão"* — e a abertura tem que ser rápida, principalmente com a conversa ligada (📌).
- **O painel mostra o próprio card do CRM** (`content/embed.html` → `vendas.html?wa=1`), não mais as abas 👤 Perfil / 💼 Negócios.
  Tudo o que o card tem no app (etapa, funil, status, listas, tarefas, agenda, valor, recomendações, jornada) funciona aqui e grava
  no mesmo lugar; o que mudar no card do app aparece na extensão sem refazer nada nela. O código das abas 2.8 ficou como reserva
  (rollback rápido) e sai na 2.9.1 depois da validação.
- **Por que agora é rápido** (o card completo da 2.7 levava até 25 s): o app tem o **modo leve** `?wa=1` (CARD-WA-LEVE-V1) — não
  desenha as telas de fundo, não roda o autoteste, carrega primeiro só contatos/perfil/carteira/dicionário (o resto 6 s depois) e
  abre a ficha **do cache** antes do servidor responder. O iframe é criado UMA vez e nunca recarrega: trocar de conversa só manda a
  pessoa por mensagem. Quando a extensão confirma quem é (telefone ou 📌 vínculo, pelo servidor), manda o **id** e o card abre direto.
  Medido com base de teste: abrir ≈ 0,2–0,7 s · trocar de conversa ≈ 0,3 s.
- **💬 Mensagem pronta** do card põe o texto **na caixa da conversa** (WhatsApp ou Umbler) — **não envia**; ele revisa e aperta Enter.
  Sem caixa achada: copia o texto.
- **Pessoa escolhida à mão** nas sugestões do card ("Parecidos pelo nome") → a extensão grava o 📌 vínculo da conversa (próxima vez abre direto).
- **Sem login na extensão** o card abre igual (o CRM acha pelo telefone, no próprio cache); o login da extensão só dá o atalho do 📌.
- **Login do card:** o CRM dentro do painel tem o login dele (entre com **e-mail e senha** — o Google não abre dentro de painel).
  O Chrome guarda esse login **por site**: entra 1 vez no WhatsApp Web e 1 vez no Umbler.
- **Umbler Talk** (`https://app-utalk.umbler.com/*`, plano Essencial, sem API — só DOM, nenhuma requisição ao Umbler):
  `content/umbler-dom.js` com a MESMA interface do `wa-dom.js` (`getOpenChat`, `observe`, `fillComposer`); o `panel.js` escolhe o
  adaptador pelo host. Leitura em camadas: (1) título = telefone (contato não salvo) → `header`; (2) "Detalhes do contato" aberto →
  telefone do `h6` → `painel`; (3) senão só o nome → `nome` (o card sugere pelo nome; aviso "abra Detalhes do contato"). A lista
  lateral **nunca** é lida (telefone de outra conversa); o id da URL `/chats/<id>` muda e **não** é chave. Grupo: sem marcador
  confiável conhecido no DOM do Umbler (17/10) — heurística conservadora (ícone/"Grupo" no cabeçalho); senão vale como contato pelo
  nome e o card só sugere, nunca cria sozinho. Vínculo: chaves `tel:` e `nome:` iguais às do WhatsApp → o 📌 vale nos dois (sem `lid:`).
  Os 2 canais do Umbler (2 números) não importam: a busca é pelo telefone/nome do CONTATO.
- **Layout no Umbler:** com o painel aberto a página encolhe à esquerda (440 px) — o painel não cobre a caixa de mensagem nem o
  "Detalhes do contato" (o offcanvas passa a abrir encostado no painel). No WhatsApp Web segue sobreposto como na 2.8.
- **Permissões que voltam:** `declarativeNetRequest` (regra `rules.json`: COEP `credentialless` + CORP só no iframe do CRM, senão o
  WhatsApp barra o iframe) e host `juca-alt.github.io`. Novo host: `app-utalk.umbler.com`. Ícone da barra abre o painel nos dois sites.
- **Atualizar:** baixe e descompacte o zip por cima da pasta da extensão → `chrome://extensions` → **↻** na extensão → **F5** no
  WhatsApp Web e no Umbler.
- **Testes rodados (19/10, Chrome com a extensão carregada, páginas que imitam WhatsApp e Umbler com os seletores reais):** card certo
  pelo telefone (WA e Umbler não salvo) · troca de conversa ≤0,35 s sem mostrar o anterior · Umbler contato salvo: só nome → sugestões
  em ~2 s; abrir Detalhes → resolve pelo telefone do h6 em ~0,3 s · grupo (WA) → card "abra uma conversa" + aviso de grupo ·
  Mensagem pronta → texto na caixa, não enviado (WA e Umbler) · página do Umbler encolhe 440 px e o offcanvas encosta no painel ·
  guard-choke-point verde. **Falta validar no WhatsApp/Umbler reais** (DOM real, login do card, vínculo 📌 entre os dois sites).

## 2.8.1 (13/10/2026) — atividades, valor e funil de volta ao negócio aberto
- Palavra dele no teste da 2.8.0: *"tirou a parte de tarefas/agenda e atualização de funil, os valores? — poder marcar tarefas e
  agendas da extensão é essencial"*.
- **📅 Atividades à vista** no negócio aberto (onde ficava "Sem próxima atividade"): até 3 abertas, a 1ª como ➡️ Próxima, cada uma
  com **✓ concluir · +1d · +7d · 📅 Agenda**. **rápido:** 📞 ligar hoje · 💬 WhatsApp amanhã · 🔁 follow-up 7d (o `tarAtalho` do app)
  e o formulário tipo · título · dia · hora (opcional) · duração. Formato **igual ao `tarCriar`** do vendas.html em `dados.tarefas`
  (`{id,tipo,tit,quando,hora,dur,feito:null,notas:'',criadoEm,por}`, id do `uid()`), com o registro "Tarefa criada / Tarefa
  concluída: …" em `dados.interacoes`. Concluir = `feito` ISO (`tarConcluir`); +1d/+7d = `tarNovaData` (parte de hoje se venceu).
- **Agenda Google:** o app só sobe pro Google o que está na fila DELE (`crmlp_gsync_v1`, localStorage do navegador do CRM) — não há
  varredura de "tarefa com `gcalSync` sem `gcalId`" no boot. Por isso a extensão **não** grava `gcalSync` (seria sincronia de
  mentira): cada atividade tem **📅 Agenda**, o link do Google Agenda já preenchido (mesmo formato do `tarGcalUrl`), 1 clique.
  Pra subir sozinho faltaria, no vendas.html, enfileirar no boot/sync as tarefas abertas com hora e sem `gcalId`/`gtaskId`.
- **💰 Valor do negócio:** Prêmio mensal R$ → `pm` + `premio_mes` + `premio_total` (= pm × 12, salvo se ajustado à mão no app),
  igual ao `drwSalvarPM`; o PA aparece derivado. Funis **MFO**: 💰 Receita estimada R$ → `receita_estimada`.
- **Funil + Etapa à vista** (saíram ◀ voltar / Avançar etapa ▶): select **Funil** com os 8 funis do app (`FUNIS`) e as etapas do
  funil em chips. Trocar de funil leva à 1ª etapa do funil novo (ele escolhe outra nos chips), limpa o status e registra
  "Funil: A → B (etapa x → y)" (`drwMoverFunil`). VG/Prud/MFO sem Funil & Etapas no banco usam o esqueleto de fábrica do app.
  Status e listas seguem no bloco **⚑ Status · listas** (fechado, com resumo).
- Tudo entra no **rascunho** e sobe no **💾 Salvar**: o SW relê a linha fresca e grava uma vez só (`lpc.patch`), conferindo
  depois que o banco devolveu cada atividade/valor/funil.

## 2.8.0 (13/10/2026) — um painel só: 👤 Perfil e 💼 Negócios
- **Saíram os modos "🗂 Card completo" e "⚡ Rápido".** O card completo (iframe do `vendas.html?wa=1`, até 25 s pra abrir)
  foi removido com tudo o que só servia a ele: `content/embed.html`, `content/embed.js`, `rules.json` (regra COEP do
  declarativeNetRequest), o painel lateral do Chrome, a janela separada e a injeção `ABRIR_NO_CRM` no `sw.js`.
  Permissões que caíram: `sidePanel`, `declarativeNetRequest`, host `juca-alt.github.io`. O app inteiro fica a um clique:
  **↗ CRM** no cabeçalho abre o `vendas.html` numa aba nova (o app não tem parâmetro de URL pra abrir um contato por id
  fora do modo `?wa=1` — por isso abre na tela inicial).
- **Cabeçalho escuro com a pessoa:** nome, idade (nascimento do cadastro ou da Carteira), telefone **só com os 4 últimos
  dígitos**, "LP <dona>", chips "Cliente · N apólices" (Carteira) e alertas baratos: atividade atrasada, aniversário em até
  30 dias, apólice com status fora de "Ativa". Botão **💬 Mensagem pronta** (os modelos de sempre) e o vínculo
  📌 ligar / não é esta pessoa / ＋ é outra pessoa. 🔍 abre a busca por nome.
- **👤 Perfil:** blocos Quem é · Família (`carteira_perfil` do app: cônjuge, filhos, outros) · 🛡️ Apólices (número
  **mascarado** `001…611` já no service worker, prêmio, periodicidade, forma, status) · 🧭 Coberturas (resumo da Carteira;
  sem detalhe na carga do cockpit = diz isso) · ✏️ Telefone e observação.
- **💼 Negócios:** o negócio aberto com trilho de etapas (Funil & Etapas do app), "etapa N de M", há quanto tempo está nela,
  **◀ voltar / Avançar etapa ▶**, próxima atividade (1ª tarefa não feita de `dados.tarefas`, por data/hora — régua do
  `proxTarefa` do app), nota rápida com **Salvar**, e os blocos ⚑ Etapa · status · listas (tudo o que o Rápido tinha) e
  🕓 Últimas interações (5). Os outros negócios da pessoa viram blocos com "Abrir este negócio"; ＋ Novo negócio continua.
- **Gravação igual à 2.2:** etapa/status/listas/nota/telefone/observação entram no rascunho; **💾 Salvar** (ou o Salvar da
  nota) grava via `lpc.patch` e confere contra o que o banco devolveu.
- **Ninguém com esse telefone:** busca por nome já preenchida (sugestões do CRM + Carteira), "É ele · ligar" (liga a
  conversa), **＋ Novo negócio** / **＋ Negócio na Base** (o formulário de criar de sempre, com o pipe já escolhido).
- **Blocos nascem fechados** (regra permanente), com resumo no cabeçalho, e cada aba tem **⊕ abrir tudo / ⊖ recolher tudo**.
  Aberto/fechado e a aba escolhida ficam lembrados neste Chrome (`wa_crm_dob` chaves `v28.*`, `wa_crm_aba`).
- Carteira: o chip "Cliente" também casa pelo telefone do cadastro e pelo nome **igual** (único) quando o telefone do
  chat não bate; apólice casa também pelo `cli_ref` do cockpit.
- Ícone da extensão na barra do Chrome: no WhatsApp Web abre o painel; fora dele, abre o WhatsApp Web.
- Painel com 400px (era 330px), campos com 16px, alvos de toque ≥40–44px.

## 2.7.1 (01/10/2026) — Vida em Grupo no "＋ Novo"
- O formulário de criar ganhou **👥 Vida em Grupo** (Novos Negócios e Base). Lá o negócio é a **empresa** (espelho do `pjSalvarNovaEmpresa` do app): pede nome da empresa*, CNPJ, nº de vidas e o papel da pessoa; ela entra como contato ⭐ (`pjContatos`, telefone da empresa = o dela via `pjTelDe`).
- Vindo de "＋ Novo negócio" num card de pessoa: o contato leva `ct` = id do negócio dela (aparece em 💼 dos dois lados pela regra única H1). Empresa nunca leva `pessoaId`; a conversa continua ligada ao card da pessoa.
- Vindo de "＋ Novo" (pessoa que ainda não está no CRM): cria só a empresa, contato sem `ct`, e a conversa fica ligada à empresa.

## 2.7.0 (01/10/2026) — criar novo direto do WhatsApp + versão certa no painel
- **Rec no nome da conversa:** "Fulano Rec Beltrana Silva" → pessoa *Fulano*, recomendante *Beltrana Silva* (port fiel do `recDoNome`, REC-DO-NOME-V1 do app). A busca por nome só compara a parte da PESSOA — antes casava a conversa do indicado com a recomendante.
- **＋ Novo** ao lado da busca (sempre) e **＋ é outra pessoa** no card: formulário com nome/recomendante tirados da conversa, telefone do chat e o pipe/funil (Vida Individual, Prud. Demais, MFO — NN e Base). Recomendante preenchido carimba `rec_recebida_em` = hoje (REC-TIMING). A conversa fica ligada ao negócio novo.
- Card achado **só pelo nome** mostra o aviso "confira" com **＋ Criar contato novo** (antes era um toast que sumia).
- **＋ Novo negócio** em 💼 Negócios desta pessoa: mesmo pessoaId (MULTI-NEG); o negócio de origem ganha pessoaId se não tinha (ação `pessoa`, nunca troca um existente). Vida em Grupo fica no CRM (card da empresa).
- Versão do cabeçalho sai do `manifest.json` (antes era texto fixo e mostrava v2.5.0 com a 2.6.0 instalada).

## 2.3 → 2.5 (28/09/2026) — card completo DENTRO do painel + conversa ligada ao negócio
- **2.2.x (caminho, testado com ele):** o painel lateral do Chrome não abriu confiável; a janela separada do CRM funcionou,
  mas ele pediu o completo DENTRO do painel "pra operar normal no WhatsApp".
- **2.3.0 — card completo dentro do painel:** `rules.json` (declarativeNetRequest) põe `Cross-Origin-Embedder-Policy:
  credentialless` + `Cross-Origin-Resource-Policy: cross-origin` SÓ na resposta do CRM (`juca-alt.github.io/crm-captacao/`)
  quando carregado como frame → o Chrome deixa embutir sob o COEP do WhatsApp. O iframe nasce 1 vez e nunca muda de lugar
  (mover iframe = recarregar). Quem acha o negócio é a extensão (`lpLookup`: telefone → nome tolerante às etiquetas) e o
  SW injeta `ABRIR_NO_CRM` no frame do CRM (`allFrames`, só o hostname do CRM) → `abrirContato(id)`. Login do CRM dentro
  do painel = 1 vez (storage particionado sob web.whatsapp.com). "↗ abrir em janela separada" fica como alternativa.
- **2.4.0 — conversa ligada ao negócio:** o WhatsApp novo esconde o telefone (`@lid`) e o nome vem com etiquetas. Ao
  ESCOLHER/criar o negócio no ⚡ Rápido (ou "📌 ligar esta conversa"), grava chave-da-conversa → id do negócio
  (`tel:` · `lid:` id fixo do WhatsApp · `nome:`). O vínculo vence qualquer busca, no rápido e no completo.
  "não é esta pessoa" desfaz. `wa-dom.js` passou a ler `@lid`.
- **2.5.0 — vínculo no cadastro do CRM:** além do atalho local (`chrome.storage.local.wa_vinc`), vai pra `dados.wa_chats`
  do negócio (ações `wa_vinc`/`wa_desv` no `lpcAplicar`, via `lpcPatch`) → vale em qualquer aparelho. Uma conversa = um
  negócio (sai dos outros). Histórico do negócio ganha "📌 Conversa do WhatsApp ligada".
- Permissões novas: `declarativeNetRequest`, host `juca-alt.github.io`.
- **Carregar no Chrome:** "Carregar sem compactação" apontando pra `extensao-whatsapp/` do clone; depois de atualizar o
  código, ↻ no card da extensão em chrome://extensions e ⌘+Shift+R no WhatsApp.


## 2.2 (28/09/2026) — card completo no PAINEL LATERAL do Chrome + card rápido com 💾 Salvar
- **Por que o card completo mostrava o ícone cinza de página quebrada (2.1):** o `web.whatsapp.com` responde com
  `Cross-Origin-Embedder-Policy: require-corp`. O iframe da extensão (`content/embed.html`) posto DENTRO da página herda
  essa política, e o `vendas.html` do GitHub Pages não manda cabeçalho COEP/CORP → o Chrome barra o CRM (em todo load,
  e de novo sempre que o painel era redesenhado e o iframe remontado, ex.: ao passar por um grupo).
- **Agora:** o card completo abre no **painel lateral do Chrome** (`side_panel` → `content/embed.html`), que é página da
  extensão FORA da árvore do WhatsApp: sem COEP herdado, o CRM carrega, o login fica guardado e o iframe fica vivo.
  Trocar de conversa: o content script avisa o service worker (`wa.chat` → `chrome.storage.session`) e o painel lateral
  manda `{tipo:'wa-abrir',tel,nome}` por postMessage — não recarrega o CRM. Enquanto carrega: esqueleto; sem resposta em
  25 s: "O CRM não respondeu" com ↻ Tentar de novo / Abrir numa aba.
  Abrir: botão **CRM** do WhatsApp (modo Card completo), aba 🗂 Card completo, ou o ícone da extensão na barra do Chrome.
  No painel lateral, **⚡ Rápido** volta pro card dentro do WhatsApp.
- **Card rápido: nada grava sozinho.** Etapa, status, listas, nota, telefone e observação viram rascunho (● não salvo) e
  só o **💾 Salvar** grava: "Salvando…" → "✓ Salvo no CRM às HH:MM" conferido contra o que o banco devolveu, ou erro que
  fica na tela com ↻ Tentar de novo. Trocou de conversa com rascunho? Ele fica guardado e um aviso no topo permite
  💾 Salvar agora ou Descartar de qualquer conversa.
- **Por que "não tinha salvo" ao voltar à conversa:** o cache do service worker (`lpcAll`, 2 min) podia ser regravado por
  uma leitura que saiu ANTES da gravação e chegou DEPOIS (a tabela inteira leva segundos). Agora o cache tem geração,
  a gravação troca a linha no cache na hora, e o card sempre relê do banco as linhas que vai mostrar (`lpcFrescos`).
  Resposta de conversa antiga não pinta mais por cima da conversa nova (`LOOKSEQ`).
- Permissão nova: `sidePanel` (Chrome 116+).


## 2.1 (28/09/2026) — o card COMPLETO do CRM na conversa
- **🗂 Card completo** (padrão): a MESMA ficha do negócio do CRM — etapa, status, listas, tarefas, agenda, jornada, valor,
  recomendações… — embutida ao lado da conversa. O WhatsApp bloqueia iframe de outros sites, então o painel embute
  `content/embed.html` (página da extensão) que embute `vendas.html?wa=1` (modo WhatsApp do app: só a ficha, tela cheia).
  Trocar de conversa manda `{tipo:'wa-abrir',tel,nome}` por postMessage (não recarrega o CRM); o app acha o negócio pelo
  telefone (aberto e mais recente primeiro) → Estoque → senão sugere pelo nome e oferece criar já preenchido.
  Login: o do próprio CRM, 1 vez dentro do painel (e-mail e senha).
- **⚡ Rápido**: o card nativo da 2.0, agora com tópicos que encolhem/estendem (escolha lembrada).
- **A aba Captação saiu** (o código de leads segue no crm-api.js, sem entrada na tela).


## 2.0 (28/09/2026) — a oportunidade da Visão LP dentro da conversa
Aba **Visão LP** do painel, com o MESMO cadastro do CRM (lê `app_settings.lp_funil_cfg` e `lp_listas_ta`):
- **Etapa** em botões (rótulos, ordem e cores de Funil & Etapas) + **Encerrar** (Não / Prop. Cancelada / Apól. Cancelada…).
- **⚑ Status nesta etapa** / **✖ Motivo da perda** (etapa de encerramento) — as mesmas opções do app.
- **📋 Listas de TA**: ✕ tira, "＋ pôr numa lista", "↪ só em X" (mover), nova lista.
- **📝 Registrar nota**: vira registro no histórico da oportunidade (não sobrescreve o campo Notas); últimos 5 registros no card.
- **Gravação segura** (`lpc.patch`): o service worker relê a linha FRESCA do banco (com o dono), aplica só a ação e grava
  — nunca uma cópia velha inteira por cima do que o app mudou. Histórico no formato do vendas.html (`Etapa: A → B`,
  `Status: X`, `Motivo da perda: X`, `Lista TA: A → B`).
- **Estoque separado**: nome do Estoque (`funil:'bn'`) abre card próprio (listas + nota), nunca vira negócio ao salvar.
- **Funil preservado**: o normalizador não força mais `nn` (VG/Prud/MFO/prospects ficam no funil deles).

Atualizar: `chrome://extensions` → no card da extensão, **↻ Recarregar**; depois F5 no WhatsApp Web.


Card do lead do **CRM Captação** ao lado da conversa aberta no WhatsApp Web (estilo HubSpot/Atendare).
Captura e atualização de leads sem sair do WhatsApp. **Somente leitura do DOM** — a extensão nunca
envia mensagem, nunca clica, nunca automatiza nada no WhatsApp (anti-ban).

## Instalar (uso interno, load unpacked)

1. Chrome → `chrome://extensions` → ligar **Modo do desenvolvedor** (canto superior direito).
2. **Carregar sem compactação** → escolher esta pasta (`extensao-whatsapp/`).
3. Abrir https://web.whatsapp.com → botão flutuante **CRM** no canto inferior direito.
4. Entrar com o mesmo e-mail/senha do CRM Captação (bolinha verde no botão = conectado).

## O que faz (v1)

- Ao abrir uma conversa individual, busca o lead pelo **telefone** (com as duas variantes do 9º dígito)
  e mostra o card: nome, código PI, status com a cor da etapa, telefone e responsável.
- **Sem lead?** Formulário "+ Criar lead" já preenchido com nome/telefone do chat
  (status inicial "Com Telefone", origem "WhatsApp"; código PI vem da trigger do banco).
- **Editar no card:** Etapa×Status (funil dinâmico, vem de `app_settings.funil_cfg`), cargo, empresa,
  cidade, e-mail, origem, recomendante, observações, follow-up + descrição de tarefa (timeline).
- Lead sem telefone achado por nome → botão "📱 Gravar telefone deste chat".
- **Busca manual** (nome ou telefone) sempre disponível — é o fallback quando o DOM do WhatsApp mudar.
- Grupos: sem captura (aviso). Match por nome nunca trava criação — é só sugestão, igual ao app.

## Arquitetura / contrato (não furar!)

- `crm-api.js` é o **choke point da extensão**: TODO acesso a `/rest/v1/leads` mora ali, espelhando
  `insertLead`/`updateLead` do index.html (derivados, carimbos, `codigo` vazio → trigger PI, dedupe
  pré-insert por telefone/e-mail, tradução do 23505, `lead_events` via port do `logEdit`).
  O CI (`scripts/guard-choke-point.mjs`) **falha** se `rest/v1/leads` aparecer em outro arquivo da extensão.
- `etapa` NUNCA é gravada em `leads` — deriva do status (regra do app).
- **Contato da Visão LP (`lp_contatos.dados`) nasce no SHAPE COMPLETO**: `lpcNovoContato`/
  `lpcNormContato` (normalize.js) são o port fiel do `salvarNovoContato` do vendas.html
  (`infoclient`, `recs`/`eventos`/`planos`/`interacoes`, `sexo`/`profissao`/`origem`/`taStatus`,
  `ance`, `idade`, `sitplan`, `funil`, `etapa`, `criadoEm`, espelho `pm`→`premio_mes`). Gravar
  subconjunto quebrava o drawer do app (`c.infoclient.pessoais`) — fix #38. O `lpcSave`
  normaliza no choke point, então a EDIÇÃO de contato antigo também sobe completa. Campo
  novo no shape do app entra aqui junto.
- Rede só no service worker (`sw.js`); content scripts só DOM/UI (Shadow DOM).
- Tokens de sessão em `chrome.storage.local`; refresh automático com promise única.
- Vanilla JS, zero libs (regra do projeto).

## Backstop no banco (recomendado)

Rodar `supabase/migrations/telefone_e164_unique.sql` no SQL Editor: diagnostica os telefones
duplicados (6 na auditoria de 07/07), aponta a unificação pela tela Duplicatas e habilita o
UNIQUE em `telefone_e164` quando a base zerar.

## Roteiro de QA manual

1. Login com senha errada → erro amigável; com senha certa → bolinha verde.
2. Conversa com contato salvo que já é lead → card com PI e badge na cor da etapa.
3. Contato NÃO salvo (número no título) → ainda acha o lead pelo telefone.
4. Lead antigo cadastrado sem o 9º dígito → ainda casa (variantes).
5. Grupo → aviso "captura por contato individual".
6. Conversa sem lead → "+ Criar lead" pré-preenchido; criar e conferir no CRM: PI da trigger,
   origem WhatsApp, sem duplicar (CRM aberto ao lado atualiza via realtime).
7. Criar com telefone que já existe → mensagem de duplicata e card do lead existente.
8. Mudar status → conferir `data_status_atual` e linha "✏️ Editou" na timeline do CRM.
9. Agendar follow-up com descrição → data no lead + tarefa na timeline.
10. Vários leads homônimos → picker de escolha; busca manual por nome e por telefone.
11. Revogar a sessão (trocar senha) → painel volta pro login sem quebrar.
12. Editar o funil em Configurações → Funil no CRM → selects da extensão refletem após recarregar.
