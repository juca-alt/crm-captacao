# Extensão Chrome — Captação · WhatsApp → CRM (v0.1.0)

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
- `etapa` NUNCA é gravada — deriva do status (regra do app).
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
