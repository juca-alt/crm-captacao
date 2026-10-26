// ===== CONFIG — mesmos valores do index.html (chave publishable, já pública no app) =====
// Carregado no service worker (importScripts) e nos content scripts (ordem do manifest).
// 03/08/2026: banco próprio do Gustavo (crm-playground) — o kbiinf… é do Guto desde 29/07.
const SB_URL = "https://cjieobmdpqcupzdpckef.supabase.co";
const SB_KEY = "sb_publishable_B1yApF8NUHh0BRpKzoIWIQ_ukZFs9kR";
// 2.7.0: a versão do painel sai do manifest — antes era texto fixo aqui e ficou "v2.5.0" com a 2.6.0 instalada.
const EXT_VERSION = (()=>{ try{ return 'v'+chrome.runtime.getManifest().version; }catch(_){ return ''; } })();
// 2.10.0: CRM que recebe os relatórios puxados do portal (window.portalReceber). Produção = sempre este endereço.
// Teste local: o portal-sw.js só aceita outro destino se `crm_url_teste` (chrome.storage.local) for http://127.0.0.1 ou localhost.
const CRM_RELATORIOS_URL = "https://juca-alt.github.io/crm-captacao/vendas.html";
