# Deploy — Visão Life Planner (relatório semanal por PDF)

Pôr no ar o parser do relatório + a Visão LP. A parte das contas/painel é sua (mastigada abaixo); o código do app é comigo (já está na branch `feat/lp-relatorio`).

> **Hoje já dá pra validar SEM nada disto:** abra `vendas.html` → menu **Subir relatório** → **Carregar exemplo**. Toda a tela (Atrasos, Pendências, Status T, Aniversariantes, Datas) funciona com dados de exemplo, no localStorage. Os passos abaixo só são necessários pra ler PDF de verdade e sincronizar entre LPs.

---

## 1. Banco — criar as tabelas  · ~3 min · **VOCÊ**
No Supabase → projeto `kbiinfpjfmuidyzsfegp` → **SQL Editor** → cole o conteúdo de
`supabase/migrations/lp_relatorio.sql` → **Run**.
- Cria `lp_relatorio_itens` (não toca em `vendas_atrasos`).
- RLS ligado em modo *authenticated-full* (igual ao CRM LP v1.0). A trava por-LP fica comentada no arquivo pra ligar depois.

## 2. IA — publicar a Edge Function  · ~3 min · **VOCÊ** (Terminal)
Usa o **mesmo motor e a mesma key** da captura de leads (**Gemini, free tier**). O secret `GEMINI_API_KEY` **já existe** no projeto (a `capturar-lead` usa ele) — então **não precisa de secret novo**, é só publicar:
```bash
cd ~/Documents/crm-captacao
git pull                                      # pega a versão Gemini desta função
supabase functions deploy importar-relatorio-lp
```
> A função sobe com `verify_jwt = ON` (padrão) — só usuário logado chama. CORS travado em `juca-alt.github.io` + localhost. Leitura **gratuita** (free tier do Gemini, sem cartão).

## 3. App — apontar pro Supabase (quando quiser sair do localStorage)  · **COMIGO**
O `vendas.html` já tem o cliente Supabase e a chamada da função. Hoje ele **guarda no localStorage** (preview). Pra gravar no banco (sync entre você e os LPs), é trocar a camada `LPDB` (3 funções: `lpCarregar`/`lpSalvar`/`lpIngest`) pra ler/gravar em `lp_relatorio_itens`. Me avisa quando o passo 1 e 2 estiverem prontos que eu faço a virada e a gente valida logado.

## 4. Testar ao vivo  · **VOCÊ + EU**
1. Logar no CRM (`index.html`) — a Visão LP herda a sessão (mesma origem).
2. `vendas.html` → **Subir relatório** → soltar o PDF da Prudential.
3. Conferir se os 5 quadros bateram com o PDF. Mexer no **Follow-up** de um item.
4. Subir o relatório da semana seguinte → confirmar que **o status que você marcou continua lá** e que item resolvido sumiu da lista ativa (vira "resolvido", não some do banco).

---

## Custo & ajuste
Leitura de PDF é **gratuita** (Gemini free tier, sem cartão — mesma conta da captura de leads). Pra trocar o modelo, 1 linha em
`supabase/functions/importar-relatorio-lp/index.ts` (`const MODEL`):
`gemini-2.5-flash-lite` (mais rápido) · `gemini-3.5-flash` (mais capaz).

## O que ainda vem do Cowork (regras §4 do brief — hoje estão como stub configurável)
- **§4.1** tabela `motivo_classe → ação` (regex em `MOTIVO_REGRAS` + textos em `LP_ACOES`).
- **§4.2** qual data dispara a **faixa** do Status T (`const FAIXA_CAMPO`, hoje `data_2o_premio`).
- **§4.3** tamanho da **janela de ação** dos aniversários (`const JANELA_DIAS`, hoje 15).

A mecânica está pronta e testada; quando o Cowork fechar os números é só trocar essas constantes.
