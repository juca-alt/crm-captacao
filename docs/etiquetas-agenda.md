# Etiquetas do Google Agenda — tabela única (CRM + Pietro)

> ETIQUETAS-V1 · 09/11/2026 · pedido do Gustavo: *"quando os eventos forem criados, estarem coloridos com etiquetas corretas… se tiver faltando algo vamos bater e deixar em linha… quando o Pietro cria pra mim no chat e atualiza o CRM, tô tendo retrabalho de reorganizar tudo"*.
>
> **Esta tabela é a fonte única.** O CRM segue (`gcalEtiquetaDe` no `vendas.html`) e o Pietro segue (colar o bloco do fim no Pietro). Mudou aqui → muda nos dois.

## Como a cor chega no Google

A API do Google grava só o **número da cor** (`colorId`). O nome da etiqueta ("OI/FF", "P/C"…) existe só no Google do Gustavo. Por isso o CRM guarda **nome → número** no ⚙ da Agenda (Agenda → ⚙ Agendas e regras → *Cores do Google*), salvo no servidor e válido em todos os aparelhos.

Desde jun/2026 o Google tem 24 cores padrão + cores próprias, e a API aceita todas ([anúncio](https://workspaceupdates.googleblog.com/2026/06/custom-event-colors-in-google-calendar.html)). O ⚙ lista todas as cores que a API devolve.

## As 14 etiquetas e o número da cor

Números conferidos nos eventos dele de 20/10 a 20/11/2026 (eventos já etiquetados à mão):

| Etiqueta | colorId | Conferido |
|---|---|---|
| OI/FF | 5 (Banana) | ✅ eventos "OI/FF …" estão na 5 |
| P/C | 10 (Manjericão) | ✅ "[PC]" na 10 |
| C2 | 2 (Sálvia) | cor do seletor (verde médio) |
| DELIVERY | 7 (Pavão) | ✅ "[DELIVERY]" na 7 |
| TA/PIPE | 4 (Flamingo) | cor do seletor (salmão) |
| LEMBRETE | 6 (Tangerina) | cor do seletor (laranja) |
| URGENTE | 11 (Tomate) | ✅ "[SUBST]/[ATRASO]" urgentes na 11 |
| ROTINA | 8 (Grafite) | ✅ "Sono 21h30" na 8 |
| STRATEGIC | 9 (Mirtilo) | cor do seletor (anil) |
| RCP/FF | **cor nova** | ⚠ nomear no ⚙ |
| RCP/PC | **cor nova** | ⚠ nomear no ⚙ |
| GAEL + FAMÍLIA | **cor nova** | ⚠ nomear no ⚙ |
| CORPORE SANO | **cor nova** | ⚠ nomear no ⚙ |
| OUTROS | **cor nova** | ⚠ nomear no ⚙ |

Enquanto uma etiqueta "cor nova" não for nomeada no ⚙, o CRM cria o evento **sem cor** (melhor do que na cor errada) e o ⚙ mostra o aviso "⚠ Etiquetas ainda SEM cor".

## A regra: qual etiqueta cada evento ganha

**Trabalho (o CRM aplica sozinho):**

| O que é | Etiqueta |
|---|---|
| Reunião de prospect em OI/FF (abertura / fact find) | OI/FF |
| Reunião em P/C, N, FA, Emissão | P/C |
| Reunião em C2 | C2 |
| Revisita de cliente da base (abertura) — `[RCP/FF]`, `[REVISITA]` | RCP/FF |
| Revisita de fechamento / N-Emissão da base — `[RCP/PC]` | RCP/PC |
| Entrega de apólice — `[DELIVERY]` | DELIVERY |
| Ligar · WhatsApp · TA · SitPlan | TA/PIPE |
| Enviar proposta | P/C |
| Follow-up · `[LEMBRETE]` · cobrar retorno | LEMBRETE |
| Atividade com prioridade **alta** (fora reunião) · `[SUBST]` · `[ATRASO]` · `[BENEFÍCIO]` | URGENTE |
| Reunião sem etapa no mapa · `[VG]` · `[EQUIPE]` · `[REC]` · qualquer outra do trabalho | OUTROS |

**Pessoal (só o Pietro cria — o CRM não cria evento pessoal):**

| O que é | Etiqueta |
|---|---|
| Gael, Camila, família, escola, terapia, pediatra | GAEL + FAMÍLIA |
| Gym, movimento, alongamento, treino | CORPORE SANO |
| Sono, rotina da casa | ROTINA |
| Planejamento, estratégia, estudo, IA, CFP | STRATEGIC |

**Cor trocada à mão é respeitada:** o CRM só repinta um evento quando a etiqueta calculada muda (ex.: o negócio passou de OI/FF pra P/C). Se você trocou a cor no Google, a edição seguinte no CRM não desfaz.

## Bloco pronto pra colar no Pietro

```
ETIQUETAS DA AGENDA (fonte: CRM, docs/etiquetas-agenda.md) — todo evento que eu criar no Google Agenda do Gustavo leva colorId:
• OI/FF (reunião de abertura/fact find) → colorId 5
• P/C (proposta/fechamento, N, FA, emissão; "enviar proposta") → 10
• C2 → 2
• DELIVERY (entrega de apólice) → 7
• TA/PIPE (ligar, WhatsApp, TA, SitPlan) → 4
• LEMBRETE (follow-up, cobrar retorno, lembrete) → 6
• URGENTE (prioridade alta, substituição, atraso, benefício) → 11
• ROTINA (sono, rotina) → 8
• STRATEGIC (planejamento, estratégia, estudo, IA, CFP) → 9
• RCP/FF (revisita de abertura de cliente) → [número do ⚙]
• RCP/PC (revisita de fechamento de cliente) → [número do ⚙]
• GAEL + FAMÍLIA → [número do ⚙]
• CORPORE SANO (gym, movimento) → [número do ⚙]
• OUTROS (trabalho que não cabe acima: VG, equipe, recomendação) → [número do ⚙]
Regra: escolha UMA etiqueta pela tabela; na dúvida entre trabalho e pessoal, pergunte. Nunca deixe evento sem colorId quando a etiqueta tiver número.
```

Os 5 `[número do ⚙]` são preenchidos depois que o Gustavo nomear essas cores no ⚙ do CRM.
