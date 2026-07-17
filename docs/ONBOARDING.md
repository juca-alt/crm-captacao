# Onboarding — CRM Captação (Life Planners · MFB Recife / Prudential)

Documento único de entrada no projeto. Cobre **o que é**, **como está montado**, **como dar/receber
acesso** e **como rodar e publicar**. Escopo: apenas o CRM de Captação (este repositório).

> ⚠️ **Segurança:** este arquivo **não contém segredos**. Chaves e senhas nunca vão pro Git nem
> pro WhatsApp — são compartilhadas por Google Drive. Veja a seção *Acessos & segredos*.

---

## 1. O que é o projeto

CRM interno de **recrutamento/captação de Life Planners** (agentes de seguros de vida) para a
**Prudential do Brasil — Recife**, operado pela master franqueada **MFB Recife**. Cobre:

- Captura de leads (inclusive por uma **extensão Chrome** de garimpo no LinkedIn).
- Pipeline de recrutamento em Kanban (funil de captação).
- Guia interativo de condução da entrevista (OT).
- Dashboard semanal de vendas ("Visão Life Planner") alimentado pelo PDF de relatório da Prudential.

## 2. Stack & arquitetura

- **Front-end:** arquivos HTML estáticos e autocontidos, **JavaScript vanilla inline** — sem
  framework, sem build, sem `package.json` de app. Libs via CDN: `@supabase/supabase-js@2`,
  `papaparse@5.4.1`.
- **Backend:** **Supabase** (Postgres + Auth JWT + Edge Functions em Deno/TypeScript).
- **Hospedagem:** **GitHub Pages** (`https://juca-alt.github.io`). Não usa Vercel/Netlify.
- **CI:** GitHub Actions (`.github/workflows/guard-choke-point.yml`) — roda um *lint guard*, não faz deploy.

### Arquivos principais
| Arquivo | O que é |
|---|---|
| `index.html` | CRM principal (prod, v2.6.2): Visão Geral, Contatos, Funil LinkedIn (Minerar/Qualificar/Inbox), Recomendações, Funil Captação, Relatório, Duplicatas, Config. |
| `index-dev.html` | Cópia dev/staging do CRM. |
| `vendas.html` | Módulo "Visão Life Planner": parsing do PDF semanal da Prudential (Atrasos, Pendências, Status T, Aniversariantes). |
| `ot-captacao-guia-jx92kf.html` | Guia de condução da OT (entrevista). Progresso salvo em `localStorage`. |
| `privacidade-extensao.html` | Política de privacidade da extensão Chrome "Captação · Garimpo LinkedIn". |
| `supabase/migrations/*.sql` | Migrações rodadas manualmente no SQL Editor. |
| `supabase/functions/*/index.ts` | Edge Functions (ver abaixo). |
| `scripts/guard-choke-point.mjs` | Guard de CI (ver *Regras de ouro*). |

## 3. Modelo de dados (Supabase)

Tabelas principais do CRM:

- **`leads`** — núcleo: candidatos/prospects. Campos: `nome, cargo, empresa, sexo, faixa_idade/idade,
  renda_estimada, telefone, telefone_e164, email, linkedin_url, linkedin_url_norm, cidade, bairro,
  segmento, origem, recomendante, observacoes, status, etapa, responsavel, data_proxima_acao,
  criado_em, score, codigo (PI#####)`.
- **`lead_events`** — histórico/atividades por lead.
- **`app_settings`** — configuração do app (ex.: config do funil).
- **`app_users`** — usuários/perfis (papéis, ex.: Admin).
- **`mining_sessions`** — sessões de garimpo no LinkedIn.
- **`lp_relatorio_itens`** — snapshots do relatório semanal de LP (usada pelo `vendas.html`).
- **`vendas_atrasos`** — legado (v1.0).

**Identidade & dedupe (importante):** cada lead recebe um código humano sequencial `PI#####`
(sequence `leads_codigo_seq` + trigger `leads_set_codigo`, em `migrations/lead_id_control.sql`).
Há índices UNIQUE em `linkedin_url_norm`, `codigo` e `id`. É o que garante rastreabilidade e evita
duplicatas.

### Edge Functions
- `capturar-lead` — captura de lead por IA (Gemini): recebe print/PDF/texto e extrai JSON de lead.
- `importar-relatorio-lp` — importa o relatório semanal de LP para `lp_relatorio_itens`.

Ambas com `verify_jwt = ON` e CORS travado na origem do GitHub Pages + localhost.

## 4. Serviços de terceiros

- **Supabase** — projeto ref `kbiinfpjfmuidyzsfegp` (`https://kbiinfpjfmuidyzsfegp.supabase.co`).
  A chave usada no front (`SB_KEY`) é **publishable/anon** (pública por design; a proteção real é o RLS).
- **Google Gemini** — única IA usada (free tier; `gemini-2.5-flash` / `gemini-2.5-flash-lite`).
  Segredo `GEMINI_API_KEY` fica nos **secrets da função no Supabase**, não no repositório.
- **Sem** integração de e-mail, WhatsApp, pagamento. **Sem** `.env` no repo. **Sem** Lovable/Figma.

## 5. Regras de ouro (não quebrar)

- **Choke point de criação de lead:** todo `from('leads').insert` no `index.html` tem que passar
  por `insertLead()` / `insertLeadsBatch()`. O `vendas.html` **não** insere em `leads`. O guard de CI
  (`scripts/guard-choke-point.mjs`) falha o build se isso for violado — é o que preserva a
  rastreabilidade (id + código PI + dedupe).
- Não commitar segredos. `SB_KEY` (anon) pode ficar no código; `GEMINI_API_KEY` **nunca**.

## 6. Como rodar localmente

Servir os HTML por um servidor estático na porta **8758** (origem já liberada no CORS das functions):

```
python3 -m http.server 8758
# abrir http://localhost:8758/index.html
```

Login pela tela do `index.html` (Auth do Supabase). Para testar o módulo de vendas, subir um PDF
da Prudential em `vendas.html`.

## 7. Deploy

- **Front-end:** publicado via **GitHub Pages** (branch `main`). Merge na `main` → publica.
- **Edge Functions / migrações:** manuais.
  - Migração: colar o SQL de `supabase/migrations/*.sql` no **SQL Editor** do projeto.
  - Função: `supabase functions deploy <nome>` (ex.: `importar-relatorio-lp`). Ver `DEPLOY-VISAO-LP.md`.

## 8. Acessos & segredos (runbook)

### GitHub
Acesso é **por repositório**: adicionar alguém a este repo **não** dá acesso a outros repos da conta.
- Adicionar colaborador: repo → **Settings → Collaborators → Add people** → usuário → confirmar.

### Supabase
Acesso é **por organização**: um membro da org enxerga **todos os projetos daquela org** (no plano
Free não há papel por-projeto). Portanto, antes de convidar alguém, **confirme em qual organização
o projeto do CRM está** e se essa org contém só projetos do CRM.
- Convidar: org → **Settings → Team → Invite** (papel Administrator). O convite expira em ~24h.
- Se o projeto do CRM dividir a org com projetos de outra natureza, **isole primeiro** (crie uma org
  dedicada e transfira o projeto em *Project Settings → General → Transfer project*) antes de convidar.
- ✅ **Status 15/07/2026:** isolamento FEITO — o projeto do CRM (`kbiinfpjfmuidyzsfegp`) está sozinho
  na org dedicada **crm-captacao** (plano Free). Financeiro e demais apps pessoais ficaram em outra org.

### Segredos
- `GEMINI_API_KEY` (secret da função Supabase) → compartilhar por **Google Drive**, nunca WhatsApp.
- `SB_KEY` do front é anon/publishable — não é segredo.
- Não é necessário entregar senhas de conta: os convites acima já dão o acesso de trabalho.

## 9. Histórico

- Desenvolvimento em feature branch + PR (PRs #8–#15), commits em PT-BR, versões marcadas nas
  mensagens (v2.5.x → v2.6.2). Parte do código foi gerada por IA (assistente) com revisão humana.
- Auditoria de dados em 2026-07-07 (base de leads): registrada nos comentários de
  `supabase/migrations/lead_id_control.sql`.

## 10. Pendências a confirmar (preencher)

- [x] **Supabase:** plano **Free**. O CRM está sozinho na org dedicada **crm-captacao** (isolado em 15/07/2026).
- [ ] **Domínio:** há domínio próprio comprado (ex.: `segurocomjuca.com`)? Em qual registrador?
- [x] **Extensão Chrome** ("Garimpo LinkedIn"): código-fonte **só local** (fora do Git), confirmado em 15/07/2026.
- [ ] **Credenciais Prudential** (relatório semanal): onde ficam e como acessar.
- [ ] **Dados reais:** confirmar volume atual de candidatos em `leads` e etapas do funil mais usadas.

## 11. Transição 360 (16/07/2026) — backlog vivo & onde está cada material

### PRs abertos (features prontas aguardando merge — ordem sugerida)
1. **#16 Daniel v1** (inclui #12): SitPlan & TA datado, funil 12 etapas, ANCE, metas — vendas.html v0.3.
2. **#17 Frente 2 LP**: PDF separa segurado≠pagador + nome longo em 2 linhas (independente).
3. **#18 Carteira→Supabase** (empilhado no #16): sync entre aparelhos, RLS por dono. ⚠️ exige rodar
   a migration `carteira.sql` — já está COLADA no SQL Editor do projeto, falta clicar **Run**.
4. **#19 QA Captação v2.6.3**: 24 correções desktop+mobile.

### Pendências operacionais (Captação, herdadas do ESTADO)
- Validar logado: lead novo por cada origem (manual/inbox/captura/import) sai com PI do banco, sequencial, sem duplicar.
- Unificar 6 telefones duplicados na tela Duplicatas → depois ligar a trava 2b de telefone (comentada em `supabase/migrations/lead_id_control.sql`).

### Materiais FORA deste repo (pasta privada no Google Drive, compartilhada com o novo dev)
Motivo: este repo é público e esses arquivos citam nomes reais de candidatos e estudos internos.
- **ESTADO_DO_PROJETO.md** — histórico vivo de todas as sessões da Captação (fonte de verdade; ver Contrato de Sincronia no `CLAUDE.md`). + ESTADO_CAPTACAO e ESTADO_VISAO_LP.
- **Estudo Global-CRM completo** — APRENDIZADOS.md (TOP 10 + roadmap de 3 ondas = backlog de funcionalidades), PLANO_DE_ESTUDO.md, espelho funcional `espelho-globalcrm.html` (10 módulos replicados) e anotações módulo-a-módulo.
- **Extensão Chrome "Garimpo LinkedIn"** — código-fonte completo + CONTRATO_APP_EXTENSAO.md. Status: stand-by; decisão tomada = publicar como *unlisted* na Chrome Web Store (US$5 taxa única) p/ auto-update; suspeita de seletores do LinkedIn desatualizados no sync.
- **app_crm/vendas.html (port v0.2 Supabase)** — port do Vendas pra Supabase nunca promovido ao repo (as tabelas `vendas_*` já existem no banco).
