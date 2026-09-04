#!/usr/bin/env python3
"""Portão de deploy da Visão LP — UM comando.

    python3 scripts/portao.py            # sobe um servidor local, abre o portao.html, roda os 4 cenários
                                         # (375/1280 × base cheia/vazia) em todas as VIEWS_CONHECIDAS e
                                         # devolve 0 (aberto) ou 1 (fechado)
    python3 scripts/portao.py --prova    # injeta defeito de propósito e exige que o portão acuse (R6)
    python3 scripts/portao.py --servido  # DEPOIS do merge: compara o vendas.html servido pelo Pages com
                                         # o desta pasta (hash + versão do <title>) — é a conferência
                                         # "pelo conteúdo servido", não pelo commit
    python3 scripts/portao.py --sem-abrir --porta 4612   # só serve e espera (pra outro navegador dirigir)

Não precisa de node: só python3 (vem no macOS) e o navegador padrão. O app no iframe nunca está
logado, então nada aqui toca o banco.
"""
import argparse, hashlib, http.server, json, os, re, subprocess, sys, threading, time, urllib.request

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PAGES = 'https://juca-alt.github.io/crm-captacao/vendas.html'
RESULTADO = {}

def versao(txt):
    m = re.search(r'<title>[^<]*?(v\d+\.\d+(?:\.\d+)?)', txt)
    return m.group(1) if m else '?'

def servido():
    local = open(os.path.join(RAIZ, 'vendas.html'), 'rb').read()
    req = urllib.request.Request(PAGES, headers={'Cache-Control': 'no-cache', 'Pragma': 'no-cache', 'User-Agent': 'portao/1'})
    remoto = urllib.request.urlopen(req, timeout=30).read()
    hl, hr = hashlib.sha256(local).hexdigest()[:12], hashlib.sha256(remoto).hexdigest()[:12]
    vl, vr = versao(local.decode('utf-8', 'replace')), versao(remoto.decode('utf-8', 'replace'))
    print(f'local   {vl}  sha256 {hl}  {len(local):>8} bytes')
    print(f'servido {vr}  sha256 {hr}  {len(remoto):>8} bytes   ({PAGES})')
    if hl == hr:
        print('✅ o Pages está servindo EXATAMENTE este arquivo')
        return 0
    print('❌ o conteúdo servido é DIFERENTE do local — deploy ainda não propagou, ou o merge não é este arquivo')
    return 1

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=RAIZ, **k)
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()
    def do_POST(self):
        if self.path.startswith('/portao/resultado'):
            n = int(self.headers.get('Content-Length') or 0)
            try:
                RESULTADO['r'] = json.loads(self.rfile.read(n) or b'{}')
            except Exception as e:
                RESULTADO['r'] = {'ok': False, 'fatal': 'resultado ilegível: %s' % e}
            self.send_response(204); self.end_headers()
        else:
            self.send_response(404); self.end_headers()
    def log_message(self, *a):
        pass

def imprimir(r):
    for c in r.get('cenarios', []):
        ruins = [t for t in c['telas'] if not t.get('ok')]
        print(f"{'✅' if c['ok'] else '❌'} {c['largura']}px · base {c['base']}: {len(c['telas'])} telas · "
              f"lpSelfCheck {len(c['selfcheck'])} · funSelfCheck {len(c['funcheck'])} · {len(ruins)} tela(s) com problema")
        for f in c['selfcheck']:
            print('     self-check:', f)
        for t in ruins:
            det = []
            if t['erros']: det.append(f"{len(t['erros'])} exceção(ões): " + ' | '.join(t['erros'])[:240])
            if t['mortos']: det.append('campo morto: ' + ', '.join(t['mortos']))
            if t['estouro'] > 1: det.append(f"estouro {t['estouro']}px")
            fi = t.get('ficha')
            if fi and (fi['mortos'] or fi['estouro'] > 1): det.append(f"{fi['nome']}: mortos {fi['mortos']} estouro {fi['estouro']}px")
            print(f"     {t['view']}: " + ' · '.join(det))
        avisos = sum(t.get('alvos', 0) for t in c['telas'])
        if avisos:
            print(f'     aviso: {avisos} alvo(s) de toque abaixo de 44px (não fecha o portão)')
    if r.get('fatal'):
        print('❌ fatal:', r['fatal'])
    if 'prova' in r:
        print('🧪 prova do guarda:', 'acusou o defeito injetado' if r['prova'].get('acusou') else 'NÃO ACUSOU — o portão está quebrado')

def subir_servidor(porta, tentativas=20):
    """Sobe na porta pedida; se ela estiver presa (servidor solto de outra sessão), anda até achar
    uma livre — o portão é UM comando e não pode morrer por porta ocupada. O portao.html fala com
    o servidor por caminho relativo, então qualquer porta serve."""
    for p in range(porta, porta + tentativas):
        try:
            srv = http.server.ThreadingHTTPServer(('127.0.0.1', p), Handler)
        except OSError as e:
            if e.errno not in (48, 98):
                raise
            print(f'porta {p} ocupada — tentando a {p + 1}')
            continue
        if p != porta:
            print(f'⚠️ subi na porta {p} (a {porta} estava presa por outro processo)')
        return srv, p
    sys.exit(f'❌ nenhuma porta livre entre {porta} e {porta + tentativas - 1}')

def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--porta', type=int, default=4611)
    ap.add_argument('--servido', action='store_true')
    ap.add_argument('--prova', action='store_true')
    ap.add_argument('--sem-abrir', action='store_true')
    ap.add_argument('--timeout', type=int, default=300)
    a = ap.parse_args()
    if a.servido:
        sys.exit(servido())
    srv, porta = subir_servidor(a.porta)
    threading.Thread(target=srv.serve_forever, daemon=True).start()
    url = f'http://127.0.0.1:{porta}/portao.html?auto=1&post=1' + ('&quebrar=1' if a.prova else '')
    print('portão:', url)
    if not a.sem_abrir:
        try:
            subprocess.Popen(['open', url])
        except Exception as e:
            print('não consegui abrir o navegador:', e, '— abra a URL acima')
    ini = time.time()
    while 'r' not in RESULTADO and time.time() - ini < a.timeout:
        time.sleep(0.5)
    srv.shutdown()
    if 'r' not in RESULTADO:
        print(f'❌ sem resultado em {a.timeout} s (o navegador não devolveu nada)')
        sys.exit(2)
    r = RESULTADO['r']
    imprimir(r)
    if a.prova:
        print('✅ PROVA OK — o guarda acusa defeito (isto NÃO é o portão; rode sem --prova antes de subir)' if r.get('ok') else '❌ PROVA FALHOU — o guarda deixou passar o defeito injetado')
    else:
        print('✅ PORTÃO ABERTO — pode subir' if r.get('ok') else '❌ PORTÃO FECHADO')
    sys.exit(0 if r.get('ok') else 1)

if __name__ == '__main__':
    main()
