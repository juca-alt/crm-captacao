# Deploy — Visão Life Planner (relatório semanal por PDF)

Pôr no ar o parser do relatório + a Visão LP. A parte das contas/painel é sua (mastigada abaixo); o código do app é comigo (já está na branch `feat/lp-relatorio`).

> **Hoje já dá pra validar SEM nada disto:** abra `vendas.html` → menu **Subir relatório** → **Carregar exemplo**. Toda a tela (Atrasos, Pendências, Status T, Aniversariantes, Datas) funciona com dados de exemplo, no localStorage. Os passos abaixo só são necessários pra ler PDF de verdade e sincronizar entre LPs.

---

## 1. Banco — criar as tabelas  · ~3 min · **VOCÊ**
No Supabase → projeto `kbiinfpjfmuidyzsfegp` → **SQL Editor** → cole o conteúdo de
`supabase/migrations/lp_relatorio.sql` → **Run**.
- Cria `lp_relatorio_itens` (não toca em `vendas_atrasos`).
- RLS ligado em modo *authenticated-full* (igual ao CRM LP v1.0). A trava por-LP fica comentada no arquivo pra ligar depois.

## 2. IA — publicar a Edge Function  · ~5 min · **VOCÊ** (Terminal)
A chave da Anthropic é a **mesma** da captura de leads — se você já publicou a `capturar-lead`, o secret já existe; senão, rode a 1ª linha.
```bash
cd ~/Documents/crm-captacao
# (só se ainda não existir) chave da Anthropic no servidor:
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
# publicar a função:
supabase functions deploy importar-relatorio-lp
```
> A função sobe com `verify_jwt = ON` (padrão) — só usuário logado chama. CORS travado em `juca-alt.github.io` + localhost.

## 3. App — apontar pro Supabase (quando quiser sair do localStorage)  · **COMIGO**
O `vendas.html` já tem o cliente Supabase e a chamada da função. Hoje ele **guarda no localStorage** (preview). Pra gravar no banco (sync entre você e os LPs), é trocar a camada `LPDB` (3 funções: `lpCarregar`/`lpSalvar`/`lpIngest`) pra ler/gravar em `lp_relatorio_itens`. Me avisa quando o passo 1 e 2 estiverem prontos que eu faço a virada e a gente valida logado.

## 4. Testar ao vivo  · **VOCÊ + EU**
1. Logar no CRM (`index.html`) — a Visão LP herda a sessão (mesma origem).
2. `vendas.html` → **Subir relatório** → soltar o PDF da Prudential.
3. Conferir se os 5 quadros bateram com o PDF. Mexer no **Follow-up** de um item.
4. Subir o relatório da semana seguinte → confirmar que **o status que você marcou continua lá** e que item resolvido sumiu da lista ativa (vira "resolvido", não some do banco).

---

## Custo & ajuste
Cada leitura de PDF usa ~**R$ 0,05–0,20** (modelo Sonnet). Pra mudar, 1 linha em
`supabase/functions/importar-relatorio-lp/index.ts` (`const MODEL`):
`claude-haiku-4-5` (mais barato) · `claude-opus-4-8` (máxima precisão em PDF ruim).

## O que ainda vem do Cowork (regras §4 do brief — hoje estão como stub configurável)
- **§4.1** tabela `motivo_classe → ação` (regex em `MOTIVO_REGRAS` + textos em `LP_ACOES`).
- **§4.2** qual data dispara a **faixa** do Status T (`const FAIXA_CAMPO`, hoje `data_2o_premio`).
- **§4.3** tamanho da **janela de ação** dos aniversários (`const JANELA_DIAS`, hoje 15).

A mecânica está pronta e testada; quando o Cowork fechar os números é só trocar essas constantes.
