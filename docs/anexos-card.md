# 📎 Anexos no card — ANEXOS-CARD (T1 · decisão, 02/11/2026)

> Ticket T1 do PROMPT_CODE_ANEXOS_CARDS + ADENDO ("reaproveitar o 📎 Anexos do Drive; só criar bucket/tabela se o Drive
> não atender a algum teste de aceite"). **Veredito: o Drive atende os 13 testes. Nada novo no Supabase.**

## O que já existe (não reimplementar)

| Peça | Onde | O que faz |
|---|---|---|
| ANEXOS-DRIVE-V1 (v8.17) | `vendas.html` · `drvToken/drvApi/drvUpload/drvNomeArq` | Upload multipart pro Drive com o token Google da Agenda (escopo `auth/drive`). Nome `AAAA-MM-DD_HHMM_<prefixo>_<arquivo>`. |
| DRIVE-PASTA-V1 (09/10) | `vendas.html` · `drvPastaCliente/drvIndice/drvCasa` + `modulos/drive-cliente.js` (Revisão) | Pasta do cliente = filha de **Pipe X / CRM Life Planner / Histórico de Clientes** achada pela CHAVE do nome (não duplica). Nasce no 1º arquivo. |
| Área de soltar | `anxZona/anxZonaEnviar/anxEscolher` + `dragover/drop` globais | Arrastar (desktop) / tocar e escolher (celular), vários arquivos. |
| Seção da gaveta do negócio | `drvNegBloco(c)` → `drvNegSoltar` (prefixo `negocio`) | "📁 Arquivos no Drive": lista a pasta inteira + soltar; link vai pra linha do tempo como `k:'nota'`. |
| Ctrl/⌘+V | listener `paste` | **Só** na ficha da solicitação aberta. |
| Portão | `anxOn()` = `novoOn('anexos-drive')` → `MODS['anexos-drive']` def:false (Gustavo + Victor) | |

Por isso o bucket `emb-anexos` (portal do Embaixador, pasta por embaixador) **não** entra: o anexo do card vive no Drive,
na mesma pasta das solicitações, atividades e Revisões.

## Teste de aceite → como o Drive cumpre

| # | Teste | Drive hoje | Falta (T2/T3) |
|---|---|---|---|
| 1–3 | tipo_doc / referência sugeridos e editáveis, persistem | — | Gravar em **`appProperties`** do arquivo no Drive (`tipo_doc`, `referencia`, `contato_id`); editar = `PATCH`. Fonte única = o próprio arquivo. |
| 1 | interação `k:'anexo'` com `anexo_id` | grava `k:'nota'` com URL no texto | `k:'anexo'`, `anexo_id` = id do arquivo no Drive. Notas antigas ficam como estão. |
| 1 | nome `AAAA-MM-DD_HHMM_card_<arquivo>` | prefixo `negocio` | trocar pra `card` (o `anxLinkHtml` já limpa o prefixo na exibição; incluir `card`/`negocio`). |
| 4 | 3 arquivos → 3 linhas, selo 📎 3 | soltar vários ✓ | selo no cabeçalho do card e no card do funil (conta pelos `k:'anexo'` ativos, sem chamar o Drive por card). |
| 5–6 | 25 MB / .exe bloqueados, nada gravado | **sem validação** | validar antes do upload (≤ 20 MB; pdf, jpg/jpeg, png, heic, webp, docx, xlsx, csv). |
| 7 | nada público | raiz `Histórico de Clientes` com **1 permissão só (dono)**, conferido 02/11; o app nunca chama `/permissions` | manter: Ver = `webViewLink` (exige login Google com acesso). |
| 8 | outro dono não lista nem baixa | acesso = permissão do Drive (só o dono da pasta) | — |
| 9 | excluir → some, selo cai, "🗑️ Anexo removido", interação antiga não abre | — | ver decisão de exclusão abaixo. |
| 10 | migração 2× | **não se aplica** (sem migração) | — |
| 11 | editar etapa/tarefa não apaga anexo | arquivo vive no Drive; interações no `dados` de sempre | autoteste de regressão. |
| 12 | colar print no card | só na solicitação | listener de `paste` com a gaveta do negócio aberta. |
| 13 | zero arquivo de teste no fim | — | limpar a pasta usada no teste. |

## Achado (fora do escopo, só aviso)
A raiz do Drive é compartilhada **só com o dono** (juca@…). O módulo `anexos-drive` está ligado pro Victor: se ele
conecta com a conta Google dele, upload e leitura dão 404 nessa pasta. Isso não foi testado aqui. Decisão dele.

## Em aberto (decisão do Gustavo)
- **Exclusão:** A) Lixeira do Drive (some da pasta; desfaz pelo Drive em até 30 dias) · B) marca `excluido` no
  `appProperties` (o arquivo fica na pasta, some só no CRM; reversível sempre).
- **Lista do card:** só os anexos do card (`appProperties.contato_id`) com tipo/ref editáveis + "outros arquivos da pasta"
  em leitura (o bloco 📁 de hoje) · ou tudo da pasta editável.
