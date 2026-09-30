# CRM Captação — arquivado em 30/09/2026

Pedido do Gustavo: "tira o CRM Captação da base, deixa salvo para, se necessário, eu retomar algo ou alguma informação; no momento não tenho interesse de usar. Foco é Vendas LP."

- **App:** `arquivo/captacao/index.html` (era o `index.html` da raiz, v2.7.0 · Instagram → CRM). Continua abrindo em https://juca-alt.github.io/crm-captacao/arquivo/captacao/index.html (pede login, igual antes).
- **Etiqueta git:** `captacao-arquivada-2026-09-30` aponta pro último estado com a Captação na raiz.
- **Dados:** nada foi apagado. Tabelas `leads`, `app_users` e afins seguem no Supabase (playground `cjieobmdpqcupzdpckef`), com RLS. Em 30/09: 194 leads ativos na Captação e 1.120 no LinkedIn.
- **Raiz do site:** `index.html` agora só redireciona pro `vendas.html` (quem tinha o app "CRM Captação" instalado cai no Vendas LP).
- **Guard do CI:** `scripts/guard-choke-point.mjs` passou a ler `arquivo/captacao/index.html`.
- **Extensões ligadas à Captação** (Garimpo LinkedIn, Instagram Prospector) seguem em stand-by; a extensão WhatsApp atende só o Vendas LP.
- **Pra retomar:** mover `arquivo/captacao/index.html` de volta pra raiz (e o guard), ou abrir direto pelo endereço acima.
