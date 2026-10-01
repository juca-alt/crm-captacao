# Extensão Chrome — CRM · WhatsApp (Visão LP) — v2.7.0

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
