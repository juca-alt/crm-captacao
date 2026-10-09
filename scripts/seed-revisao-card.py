#!/usr/bin/env python3
"""One-off: grava um arquivo revisao_*.json no histórico de um card do CRM (dados.revisoes).

Mesmo formato que a Revisão de Proteção grava ao Salvar com card vinculado (BUSCA-CLIENTE-V1):
    {"arquivo", "salvo_em", "origem", "n_cen", "tem_ap", "snapshot_gz"}   — máx. 10, mais recente primeiro.

Uso (gera o SQL; rodar no SQL editor do Supabase ou pelo MCP — nunca automático):
    python3 scripts/seed-revisao-card.py ~/Drive/.../revisao_2026-10-02_0015.json --dono EMAIL --id ID_DO_CARD > seed.sql

Achar o card antes (só leitura):
    select dono, id, dados->>'nome', dados->>'funil' from lp_contatos
     where unaccent(dados->>'nome') ilike '%primeiro%ultimo%';
Se não existir card, NÃO crie: avise o Gustavo.

Idempotente: se o card já tem esse arquivo no histórico, o UPDATE não faz nada.
Nada de dado de cliente neste arquivo (o repo é público) — o JSON vem do Drive na hora.
"""
import argparse, base64, gzip, json, os, re, sys


def lit(s):
    return "'" + str(s).replace("'", "''") + "'"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('arquivo')
    ap.add_argument('--dono', required=True)
    ap.add_argument('--id', required=True)
    ap.add_argument('--origem', choices=['claude', 'app'])
    a = ap.parse_args()

    nome = os.path.basename(a.arquivo)
    o = json.load(open(a.arquivo, encoding='utf-8'))
    m = re.search(r'revisao_(\d{4})-(\d{2})-(\d{2})_(\d{2})(\d{2})', nome)
    salvo = f'{m[1]}-{m[2]}-{m[3]}T{m[4]}:{m[5]}:00-03:00' if m else None
    origem = a.origem or ('claude' if (o.get('apresentacao') or re.search('claude', str(o.get('recado') or ''), re.I)) else 'app')
    ent = {
        'arquivo': nome, 'salvo_em': salvo, 'origem': origem,
        'n_cen': sum(1 for c in (o.get('cen') or []) if c.get('linhas')),
        'tem_ap': bool(o.get('apresentacao')),
        'snapshot_gz': base64.b64encode(gzip.compress(json.dumps(o, ensure_ascii=False, separators=(',', ':')).encode('utf-8'))).decode(),
    }
    sql = f"""-- seed do histórico de revisões · {nome} → card {a.id}
update public.lp_contatos
   set dados = jsonb_set(dados, '{{revisoes}}',
         (jsonb_build_array({lit(json.dumps(ent))}::jsonb)
          || coalesce((select jsonb_agg(x) from jsonb_array_elements(dados->'revisoes') x
                        where x->>'arquivo' <> {lit(nome)}), '[]'::jsonb))
         - 10, true),   -- teto de 10 (o novo + até 10 antigos = 11; sai o 11º)
       atualizado = now()
 where dono = {lit(a.dono)} and id = {lit(a.id)}
   and not coalesce(dados->'revisoes' @> jsonb_build_array(jsonb_build_object('arquivo', {lit(nome)})), false)
returning id, dados->>'nome' as nome, jsonb_array_length(dados->'revisoes') as n_revisoes;
"""
    sys.stdout.write(sql)


if __name__ == '__main__':
    main()
