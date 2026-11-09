-- ============================================================================
-- SENSIVEL-V1 (09/11/2026) — cartão e CPF que clientes mandaram no WhatsApp: limpar o que JÁ está gravado.
-- (O sync novo — Edge Function `umbler`, nucleo.ts → mascararSensivel — já mascara o que entra daqui pra frente.)
-- Palavra dele: "mascarar na entrada (cartão: só os 4 últimos; CPF: ***) e limpar o que já está gravado,
-- com a minha aprovação antes de gravar qualquer coisa."
--
-- RODAR À MÃO no SQL editor do CRM, EM ETAPAS:
--   PASSO 1 — cria 4 funções (mesma regra do nucleo.ts). Não muda nenhum dado.
--   PASSO 2 — só CONTA quantas linhas mudariam (a sessão do Claude também consegue rodar e te mostrar).
--   PASSO 3 — GRAVA. Só depois do OK dele no chat.
--   PASSO 4 — conferência: tem que dar tudo 0.
-- Regra (idêntica ao nucleo.ts):
--   cartão = sequência INTEIRA de 13–19 dígitos (espaço/ponto/traço entre eles), começa com 3–6, válida no Luhn,
--            e não é telefone com DDI (13 dígitos começando com 55) → "•••• 1234"
--   CPF    = 000.000.000-00 ou 11 dígitos soltos com dígitos verificadores certos → "***.***.***-**"
--   só nos campos de TEXTO (texto, prévia; no bruto: content, headerContent, caption, text, body). Telefone, id e
--   datas ficam como estão.
-- Não tem volta depois do PASSO 3 (é o objetivo: o número inteiro deixa de existir no banco).
-- ============================================================================

-- ---------- PASSO 1: funções (sem mexer em dado) ----------
create or replace function public.umbler_luhn_ok(d text) returns boolean language sql immutable as $$
  select case when d !~ '^\d{13,19}$' then false else
    (select sum(case when ((length(d) - i) % 2) = 1
                     then (case when substr(d, i, 1)::int * 2 > 9 then substr(d, i, 1)::int * 2 - 9 else substr(d, i, 1)::int * 2 end)
                     else substr(d, i, 1)::int end) % 10 = 0
       from generate_series(1, length(d)) i) end $$;

create or replace function public.umbler_cpf_ok(d text) returns boolean language sql immutable as $$
  select case when d !~ '^\d{11}$' or d ~ '^(\d)\1{10}$' then false else
    ((select sum(substr(d, i, 1)::int * (11 - i)) from generate_series(1, 9) i) * 10 % 11 % 10) = substr(d, 10, 1)::int
    and ((select sum(substr(d, i, 1)::int * (12 - i)) from generate_series(1, 10) i) * 10 % 11 % 10) = substr(d, 11, 1)::int end $$;

create or replace function public.umbler_mascarar(t text) returns text language plpgsql immutable as $$
declare r text := t; m text; d text;
begin
  if t is null or t = '' then return t; end if;
  for m in select (regexp_matches(t, '(?<!\d[ .-]?)((?:\d[ .-]?){12,18}\d)(?![ .-]?\d)', 'g'))[1] loop
    d := regexp_replace(m, '\D', '', 'g');
    if length(d) between 13 and 19 and d ~ '^[3-6]' and not (length(d) = 13 and d like '55%') and public.umbler_luhn_ok(d) then
      r := replace(r, m, '•••• ' || right(d, 4));
    end if;
  end loop;
  for m in select (regexp_matches(r, '(?<!\d[ .-]?)(\d{3}\.\d{3}\.\d{3}-\d{2}|\d{11})(?![ .-]?\d)', 'g'))[1] loop
    if public.umbler_cpf_ok(regexp_replace(m, '\D', '', 'g')) then r := replace(r, m, '***.***.***-**'); end if;
  end loop;
  return r;
end $$;

create or replace function public.umbler_mascarar_json(j jsonb) returns jsonb language plpgsql immutable as $$
declare k text; v jsonb; r jsonb;
begin
  if j is null then return null; end if;
  if jsonb_typeof(j) = 'object' then
    r := '{}'::jsonb;
    for k, v in select * from jsonb_each(j) loop
      if jsonb_typeof(v) = 'string' and lower(k) in ('content', 'headercontent', 'caption', 'text', 'body', '_texto') then
        r := r || jsonb_build_object(k, public.umbler_mascarar(v #>> '{}'));
      else
        r := r || jsonb_build_object(k, public.umbler_mascarar_json(v));
      end if;
    end loop;
    return r;
  elsif jsonb_typeof(j) = 'array' then
    return coalesce((select jsonb_agg(public.umbler_mascarar_json(e) order by o) from jsonb_array_elements(j) with ordinality t(e, o)), '[]'::jsonb);
  end if;
  return j;
end $$;

-- funções internas: o app não chama (fora do alcance de anon/authenticated)
revoke all on function public.umbler_luhn_ok(text), public.umbler_cpf_ok(text), public.umbler_mascarar(text), public.umbler_mascarar_json(jsonb)
  from public, anon, authenticated;

-- autoteste das funções (números de teste públicos; tem que dar true)
select public.umbler_mascarar('cartão 4111 1111 1111 1111 e cpf 111.444.777-35') = 'cartão •••• 1111 e cpf ***.***.***-**'
   and public.umbler_mascarar('+55 81 99000-0006') = '+55 81 99000-0006'
   and public.umbler_mascarar('34191.79001 01043.510047 91020.150008 1 98170000010000') = '34191.79001 01043.510047 91020.150008 1 98170000010000'
   and public.umbler_mascarar_json('{"content":"11144477735","contact":{"phoneNumber":"5581999990000"}}')
       = '{"content":"***.***.***-**","contact":{"phoneNumber":"5581999990000"}}'::jsonb as funcoes_ok;


-- ---------- PASSO 2: só CONTA (nada é gravado) ----------
select
  (select count(*) from public.umbler_mensagens where texto is distinct from public.umbler_mascarar(texto))          as msgs_texto,
  (select count(*) from public.umbler_mensagens where bruto is distinct from public.umbler_mascarar_json(bruto))     as msgs_bruto,
  (select count(*) from public.umbler_chats where ultima_msg_previa is distinct from public.umbler_mascarar(ultima_msg_previa)) as chats_previa,
  (select count(*) from public.umbler_chats where bruto is distinct from public.umbler_mascarar_json(bruto))         as chats_bruto,
  (select count(*) from public.umbler_eventos where bruto is distinct from public.umbler_mascarar_json(bruto))       as eventos;


-- ---------- PASSO 3: GRAVA (só com o OK dele no chat) ----------
-- update public.umbler_mensagens set texto = public.umbler_mascarar(texto), bruto = public.umbler_mascarar_json(bruto)
--  where texto is distinct from public.umbler_mascarar(texto) or bruto is distinct from public.umbler_mascarar_json(bruto);
-- update public.umbler_chats set ultima_msg_previa = public.umbler_mascarar(ultima_msg_previa), bruto = public.umbler_mascarar_json(bruto)
--  where ultima_msg_previa is distinct from public.umbler_mascarar(ultima_msg_previa) or bruto is distinct from public.umbler_mascarar_json(bruto);
-- update public.umbler_eventos set bruto = public.umbler_mascarar_json(bruto)
--  where bruto is distinct from public.umbler_mascarar_json(bruto);


-- ---------- PASSO 4: conferência (rodar o PASSO 2 de novo: tudo 0) ----------
