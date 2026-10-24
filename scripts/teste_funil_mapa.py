#!/usr/bin/env python3
"""FUNIL-UNICO-V1 · T1 — o mapa de etapas tem DUAS cópias: o seed da kb_etapa_mapa (SQL, fonte única no banco)
e o ETAPA_MAPA_FAB do vendas.html (só pra funcionar deslogado/no portão). Este teste acusa se divergirem.

    python3 scripts/teste_funil_mapa.py      # 0 = iguais · 1 = divergem (o portão chama antes de abrir)
"""
import os, re, sys

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SQL = os.path.join(RAIZ, 'supabase', 'migrations', 'funil_t1_etapas_mapa.sql')
APP = os.path.join(RAIZ, 'vendas.html')
# [funil_origem, etapa_origem, funil_novo, etapa_nova, status_card, precisa_revisao] (2 funis desde 24/10)
LINHA = r"""\(?\[?'([^']*)','([^']*)','([^']*)','([^']*)',\s*(null|'[^']*'),\s*(true|false)"""


def linhas(txt):
    return {(a, b): (fn, et, None if st == 'null' else st.strip("'"), rv == 'true') for a, b, fn, et, st, rv in re.findall(LINHA, txt)}


def checar():
    with open(SQL, encoding='utf-8') as f:
        sql = f.read()
    with open(APP, encoding='utf-8', errors='surrogateescape') as f:   # vendas.html tem bytes não-UTF8
        app = f.read()
    m = re.search(r'insert into public\.kb_etapa_mapa.*?on conflict', sql, re.S)
    j = re.search(r'const ETAPA_MAPA_FAB=\[(.*?)\n\];', app, re.S)
    if not m or not j:
        return ['não achei o seed do SQL ou o ETAPA_MAPA_FAB do vendas.html']
    s, a = linhas(m.group(0)), linhas(j.group(1))
    erros = []
    for k in sorted(set(s) | set(a)):
        if s.get(k) != a.get(k):
            erros.append(f'{k}: SQL={s.get(k)} · app={a.get(k)}')
    if len(s) < 60:
        erros.append(f'seed curto demais ({len(s)} linhas) — o regex parou de casar?')
    return erros


if __name__ == '__main__':
    e = checar()
    if e:
        print('❌ mapa de etapas: SQL e app divergem'); [print('  ·', x) for x in e]; sys.exit(1)
    print('✅ mapa de etapas: SQL e app iguais'); sys.exit(0)
