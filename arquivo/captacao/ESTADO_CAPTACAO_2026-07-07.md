# 📌 CRM Captação — Snapshot de sessão 07/07/2026

**Visão:** CAPTAÇÃO (`index.html`). LP (`vendas.html`) é sessão paralela — não tocada aqui.
**Tema da sessão:** auditoria da lógica de ID/rastreabilidade de lead + hardening v2.6.2.
**Repo:** github.com/juca-alt/crm-captacao · `origin/main` = `eb2640f` (v2.6.1) · branch da sessão `feat/id-hardening` (`e7c7ba2`), PR #15 aberto.

---

## Veredito da auditoria: lógica de ID ÍNTEGRA ✅
- Choke point confirmado: só 2 `sb.from('leads').insert` no index.html, ambos dentro de `insertLead`/`insertLeadsBatch`. As 4 origens (inbox LinkedIn, manual `#n-save`, captura múltipla, import CSV) passam por eles. `vendas.html` não escreve em `leads`. RLS barra leitura anônima.
- Diagnóstico logado (1.496 leads): 0 sem código PI · 0 PI repetido · 0 LinkedIn dup · 0 e-mail dup · **6 telefones duplicados** (unificar em Duplicatas).
- Índices reais em prod: UNIQUE em `linkedin_url_norm`, **`codigo` (`leads_codigo_key`)** e `id`. **NÃO havia** UNIQUE em `telefone_e164`.

## Fix v2.6.2 (PR #15)
- Como `codigo` tem UNIQUE, a colisão de PI entre 2 aparelhos não era cosmética: o 2º insert dava 23505 lido como "duplicado", engolindo um lead legítimo.
- App agora manda `codigo` VAZIO → **trigger do banco numera atômico**; sem trigger, fallback pós-insert no cliente.
- **Guard do choke point no CI** (`scripts/guard-choke-point.mjs` + workflow): build falha se `from('leads').insert` aparecer fora das 2 funções ou no vendas.html. CI verde.
- Migration `lead_id_control.sql`: header corrigido + passo 2b (trava de telefone, opcional).

## SQL rodado em PROD (aprovado no chat) + prova E2E
- Rodado: sequência+trigger + trava de e-mail. Verificado: `leads_codigo_seq`=1536; UNIQUEs = `leads_pkey, leads_codigo_key, leads_email_norm_uq, idx_leads_url`.
- Smoke test no app logado (testes apagados na hora): insert sem código → **PI01537** pelo banco ✅; e-mail dup (caixa/espaços diferentes) → **23505 leads_email_norm_uq** ✅.

## Pendências (todas do Gustavo)
1. **Mergear PR #15** (OPEN, MERGEABLE, CI verde) — self-merge barrado pelo classifier.
2. Validar no dia a dia (lead novo por origem com PI do banco, sem duplicar).
3. Unificar os 6 telefones duplicados em Duplicatas → depois pedir p/ ligar trava 2b de telefone.
4. Extensão Chrome segue em STAND-BY (fazer no final; não iniciar até pedir).

## Faxina feita
- Branch antigo `claude/lead-id-deduplication-gqrvv3` apagado; `git pull` local ok; backfill de código = 0 pendentes.
