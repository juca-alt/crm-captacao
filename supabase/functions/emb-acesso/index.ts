// ============================================================================
//  Edge Function: emb-acesso  (Supabase / Deno) — EMBAIXADORES-V6 (16/10/2026)
//  Gera o LINK DE ACESSO (link mágico) do portal de um embaixador, sem depender do
//  e-mail chegar: quem gerencia copia o link e manda pelo WhatsApp.
//
//  Quem pode pedir:
//   1. usuário logado do CRM que GERENCIA embaixadores (rpc emb_gestor() não-nulo — o
//      Gustavo ou o backoffice dele), com o próprio JWT no Authorization; ou
//   2. operação pontual: header x-ops-chave cujo SHA-256 bate com
//      app_settings['emb_ops_chave_hash'] (a chave nunca fica no repo; o hash é apagado após o uso).
//  Só gera link pra e-mail de um cadastro em `parceiros` com tipo='embaixador' (nunca pra
//  quem usa o CRM). Cria o login dele se ainda não existir.
//  verify_jwt = OFF porque a função faz a própria checagem (o publishable key não é JWT).
// ============================================================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const PORTAL = "https://juca-alt.github.io/crm-captacao/embaixador.html";
const ALLOWED_ORIGINS = new Set(["https://juca-alt.github.io", "http://localhost:8758", "http://127.0.0.1:8758"]);

function cors(req: Request): Record<string, string> {
  const o = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(o) ? o : "https://juca-alt.github.io",
    "Vary": "Origin",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-ops-chave",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}
function json(req: Request, status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(req), "Content-Type": "application/json" } });
}
async function sha256(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, 405, { erro: "use POST" });
  const URL_ = Deno.env.get("SUPABASE_URL")!, ANON = Deno.env.get("SUPABASE_ANON_KEY")!, SRV = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const adm = createClient(URL_, SRV, { auth: { persistSession: false } });

  // ── quem está pedindo ──
  let autorizado = false;
  const ops = req.headers.get("x-ops-chave") || "";
  if (ops.length >= 32) {
    const { data } = await adm.from("app_settings").select("valor").eq("chave", "emb_ops_chave_hash").maybeSingle();
    const h = data && typeof data.valor === "string" ? data.valor : (data?.valor?.hash ?? "");
    autorizado = !!h && h === (await sha256(ops));
  }
  const auth = req.headers.get("authorization") || "";
  if (!autorizado && /^Bearer\s+\S+/.test(auth)) {
    const eu = createClient(URL_, ANON, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
    const { data, error } = await eu.rpc("emb_gestor");
    autorizado = !error && !!data;
  }
  if (!autorizado) return json(req, 403, { erro: "só quem gerencia os embaixadores gera o link" });

  // ── de quem é o link ──
  let corpo: { embaixador_id?: number } = {};
  try { corpo = await req.json(); } catch (_) { /* corpo vazio */ }
  const id = Number(corpo.embaixador_id);
  if (!id) return json(req, 400, { erro: "embaixador_id obrigatório" });
  const { data: p, error: e1 } = await adm.from("parceiros").select("id,nome,email,tipo,ativo").eq("id", id).maybeSingle();
  if (e1 || !p || p.tipo !== "embaixador" || p.ativo === false) return json(req, 404, { erro: "embaixador não encontrado" });
  const email = String(p.email || "").trim().toLowerCase();
  if (!/^\S+@\S+\.\S+$/.test(email) || /\.invalid$/.test(email)) return json(req, 400, { erro: "cadastre o e-mail real do embaixador primeiro" });
  const { data: perfil } = await adm.from("lp_perfis").select("email").ilike("email", email).maybeSingle();
  if (perfil) return json(req, 400, { erro: "esse e-mail é de um usuário do CRM — use outro pro portal" });

  // cria o login se ainda não houver (ignora "já existe") e gera o link mágico
  await adm.auth.admin.createUser({ email, email_confirm: true }).catch(() => null);
  const { data: g, error: e2 } = await adm.auth.admin.generateLink({ type: "magiclink", email, options: { redirectTo: PORTAL } });
  if (e2 || !g?.properties?.action_link) return json(req, 500, { erro: e2?.message || "não gerou o link" });
  return json(req, 200, { link: g.properties.action_link, email, nome: p.nome, validade: "1 hora, uso único" });
});
