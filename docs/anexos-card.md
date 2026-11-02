# 📎 Anexos no card — ANEXOS-CARD-V1 (v8.83 · 02/11/2026)

Anexar documento direto no card do negócio (recibo de proposta, extrato de apólice, alteração, exame, documento pessoal)
com um gesto — **arrastar, ＋ Anexar ou Ctrl/⌘+V** — e achar depois na própria ficha e na linha do tempo.

Origem: PROMPT_CODE_ANEXOS_CARDS + ADENDO ("reaproveitar o 📎 Anexos do Drive; só criar bucket/tabela no Supabase se o
Drive não atender a algum teste"). Decisões dele: **1A 2A** (02/11).

## Onde mora (decisão de arquitetura)

**No Google Drive, não no Supabase.** Reaproveita a camada que já existia:
- ANEXOS-DRIVE-V1 (v8.17): `drvToken/drvApi/drvUpload/drvNomeArq` — upload com o token Google da Agenda (escopo `auth/drive`).
- DRIVE-PASTA-V1 (09/10): `drvPastaCliente/drvIndice/drvCasa` — pasta do cliente filha de
  **Pipe X / CRM Life Planner / Histórico de Clientes**, achada pela chave do nome (não duplica), nasce no 1º arquivo.
  A Revisão de Proteção usa a mesma pasta (`modulos/drive-cliente.js`).

Por que não criar bucket/tabela: o Drive cumpre os 13 testes de aceite (tabela abaixo). O bucket `emb-anexos` também não
serve: ele é do portal do Embaixador, com pasta por embaixador, outra regra de acesso, 10 MB e só imagem/PDF.

**Fonte única = o arquivo no Drive.** Os metadados ficam nas `properties` do próprio arquivo:

| property | valor |
|---|---|
| `crm` | `card` (marca o que é anexo de card) |
| `contato_id` | id do negócio (`lp_contatos.id`) |
| `tipo_doc` | `proposta` · `recibo` · `apolice_extrato` · `alteracao` · `exame` · `documento_pessoal` · `outro` |
| `referencia` | nº de proposta (6–9 dígitos + letra) ou apólice (9 dígitos), opcional |

Nome no Drive: `AAAA-MM-DD_HHMM_card_<arquivo>` (mesmo padrão de `_solicitacao_`/`_atividade_`).
A linha do tempo **só referencia**: `dados.interacoes += {k:'anexo', l:'📎 nome · Tipo · ref', id, ts, dia, por, anexo_id}`
(`anexo_id` = id do arquivo no Drive). Remoção: `{k:'anexo', l:'🗑️ Anexo removido: nome', anexo_id, removido:true}`.

## O que o usuário vê

- **Ficha do negócio → "📎 Anexos · Drive"** (no lugar do antigo "📁 Arquivos no Drive"; nasce fechada; o resumo no título
  diz "N anexos · M outros na pasta").
  - Linha por anexo, mais recente primeiro: ícone · nome · data · **tipo** (lista) · **referência** (campo) · **Ver** ·
    **Baixar** · **🗑**. Mudar tipo/referência grava direto no arquivo do Drive.
  - **Outros arquivos da pasta** (solicitação, atividade, Revisão…): bloco dobrável, só pra consulta.
  - Área "Solte o arquivo aqui" (vários de uma vez; no celular, tocar e escolher), botão **＋ Anexar**, **Ctrl/⌘+V** com a
    ficha aberta (print vira `print.png`).
- **Sugestão automática** pelo nome do arquivo (editável). Tipo: recibo → proposta → alteracao →
  relatorio/demonstrativo/detalhe/apolice → exame/laudo/psa/biopsia/ressonancia/ultra → rg/cnh/cpf/comprovante → outro.
- **Barrado antes de subir** (nada vai pro Drive nem pra linha do tempo): > 20 MB, extensão fora de
  pdf/jpg/jpeg/png/heic/webp/docx/xlsx/csv, arquivo vazio. Aviso diz qual e por quê.
- **Jornada:** anexo ativo é clicável (abre no Drive ↗); removido fica apagado e não abre.
- **Selo 📎 N** no cabeçalho da ficha (inclusive a ficha nova), no card do funil antigo e no card do quadro novo. Conta pela
  linha do tempo (o funil não consulta o Drive card a card); com a pasta já lida, vale a lista do Drive.
- **Excluir (decisão 1A):** 🗑 → confirmação na própria página → arquivo vai pra **Lixeira do Drive** (recupera por lá em
  até 30 dias) → "🗑️ Anexo removido" na linha do tempo. Aviso com **desfazer** por 6 s.

## Acesso
- Portão: `anxOn()` = módulo `anexos-drive` (MODS, def:false — Gustavo e Victor). Melhoria dentro de módulo já liberado,
  então não ganhou trava nova.
- Quem vê o arquivo = quem tem permissão na pasta do Drive. A raiz *Histórico de Clientes* tem **uma permissão só (dono)**,
  conferido 02/11. O app nunca cria link público (não chama `/permissions`).
- **DRIVE-ACESSO-ASSISTENTE-V1 (02/11, palavra dele: "compartilha a pasta com o Victor e usuários que add como
  assistente"):** assistente = quem tem delegação na base do admin (`lp_delegacoes` dono = ele). Marcar a delegação em
  Painel Master · Acessos compartilha *Histórico de Clientes* como **Editor** (permissão nominal, com o token Google do
  admin); tirar a delegação tira o acesso. Botão **📂 dar acesso à pasta do Drive** na linha do assistente refaz.
  `drvAcessoPodeDar/drvAcessoDar/drvAcessoTirar`. O conector do Drive desta sessão foi recusado ao compartilhar
  ("caller does not have permission") — por isso o caminho é o botão no app, com o login Google dele.
- Limite do Google (Meu Drive): quem é Editor só manda pra Lixeira o que ele mesmo subiu; arquivo do dono, só o dono.
- Daniel também está com `anexos-drive` ligado, mas a pasta é do Gustavo e ele não é assistente dela: anexo pela base
  dele não sobe (erro claro na tela). Decisão do Gustavo se/como atender a base do Daniel.

## Testes de aceite → status

| # | Teste | Como foi provado |
|---|---|---|
| 1–3 | tipo/ref sugeridos, interação com `anexo_id`, edição persiste | autoteste `ANEXOS-CARD-V1` + simulação no navegador; **persistência no Drive real: falta (login Google dele)** |
| 4 | 3 arquivos → 3 interações, selo 📎 3 | simulação (soltar 5 → 3 sobem) + `ANEXOS-CARD-T3` |
| 5–6 | 25 MB / .exe barrados, nada gravado | autoteste + simulação |
| 7 | nada público | permissões da raiz conferidas pelo Drive; app sem `/permissions` |
| 8 | outro usuário não vê | permissão do Drive (só o dono) |
| 9 | excluir → some, selo cai, "🗑️", antiga não abre | simulação (PATCH `trashed:true`, desfazer `trashed:false`) + `ANEXOS-CARD-T3` |
| 10 | migração 2× | não se aplica (sem migração) |
| 11 | mudar etapa/tarefa não apaga anexos | simulação: mudou etapa + tarefa, recarregou a página, anexos e remoção intactos |
| 12 | colar print | simulação (`print.png · Outro`) |
| 13 | zero arquivo de teste | nada foi criado no Drive nem no Supabase |

Portão: verde em 55 telas × 6 cenários. Prints 390/1280 conferidos (toque ≥ 44 px, campo 16 px no celular, sem estouro).

## Funções (vendas.html)
`anxNomeDe` · `anxNomeLimpo` · `anxSugerir` · `anxValidar` · `anxPreparar` · `anxInteracao` · `cardAnexar` · `anxDoCard` ·
`anxCardResumo` · `anxCardLinhaHtml` · `anxCardListaHtml` · `anxCardEditar` · `anxAtivos` · `anxQtd` · `anxSeloHtml` ·
`anxIntHtml` · `anxRemocao` · `anxExcluirPedir` · `anxCardExcluir` · `drvNegBloco` (seção da ficha).
Mexidas: `drvUpload` (4º parâmetro `props`), `drvListar` (campos `properties/createdTime/webContentLink`),
`drvBlocoCorpo`/`drvBlocoCarregar` (modo card via `data-cid`). Módulos: `ficha-ux2.js` (chip 📎 no cabeçalho),
`funil-unico.js` (selo no card).

## Limites conhecidos
- Card renomeado → a pasta é achada pelo nome novo (regra do DRIVE-PASTA-V1); os anexos antigos continuam na pasta antiga.
- Arquivo apagado/restaurado direto no Drive: a lista da ficha reflete na hora; o selo do funil só depois de abrir a ficha.
- Anexos de card de antes da v8.83 (nota com link, prefixo `_negocio_`) aparecem em "Outros arquivos da pasta".
