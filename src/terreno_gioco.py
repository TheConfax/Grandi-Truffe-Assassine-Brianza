# Motore nuovo, fase 4 (docs/motore.md 2.2, 3): what the game reads of the new engine, in the folder terreno/ next to index.html.
#   terreno/<tx>_<tz>.bin.gz   the tiles of S written by src/superficie.py, gzip (the game unpacks them with DecompressionStream)
#   terreno/indice.json        which tiles have a .bin and their step, the decks and pits of src/impalcati.py (decks_meda.json) and
#                              the water level zw along the DBGT river axes (acqua_fase2.json of superficie.py), in metres above sea
# Until brianza.json carries decks, rv.zw and meta.ver = 2 (the build, phase 7-8) these are read from here; the game falls back to the
# old engine where a tile has no .bin.
#   python src/terreno_gioco.py --da DIR            pack the outputs of superficie.py / impalcati.py found in DIR
#   python src/terreno_gioco.py --da DIR --rigenera run superficie.py and impalcati.py into DIR first (under 1 min for Meda: impalcati.py reuses the surface superficie.py just made)
# The cells under a deck where S is not a street get bit 7 of their material (the game paints no street there), and at the end the checks
# of the water and the bridges (src/controlli_acqua.py) write report_acqua.json next to the terreno folder (--no-controlli skips them)
import os, sys, json, gzip, glob, re, argparse, struct, io
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)


def gz(b):  # deterministic gzip (no name, no time): the same .bin gives the same file
    o = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=o, compresslevel=9, mtime=0) as f: f.write(b)
    return o.getvalue()


def r2(v): return round(float(v), 2)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Impacchetta S, impalcati e acqua per il gioco (fase 4)')
    ap.add_argument('--da', required=True, help='cartella con terreno/*.bin, decks_meda.json, acqua_fase2.json')
    ap.add_argument('--out', default=os.path.join(ROOT, 'terreno'))
    ap.add_argument('--rigenera', action='store_true'); ap.add_argument('--no-controlli', action='store_true'); ap.add_argument('--comune', default='Meda')
    a = ap.parse_args(argv)
    if a.rigenera:
        sys.path.insert(0, HERE)
        import superficie, impalcati
        superficie.main(['--out', a.da, '--comune', a.comune, '--no-png', '--accetta'])
        impalcati.main(['--out', a.da, '--comune', a.comune, '--no-png', '--accetta'])
    os.makedirs(a.out, exist_ok=True)
    sys.path.insert(0, HERE)
    import controlli_acqua as ca
    from superficie import HW, HH, TILE
    dk = json.load(open(os.path.join(a.da, 'decks_meda.json'), encoding='utf-8'))
    decks = []
    for d in dk['decks']:
        e = dict(id=d['id'], tipo=d['tipo'], fonte=d['fonte'], sp=d['sp'], luce=r2(d['luce']), imp=[[r2(x), r2(z)] for x, z in d['imp']],
                 tri=[r2(v) for v in d['tri']], spalle=[[r2(v) for v in s] for s in d.get('spalle', [])], ra=d.get('ra', []), sotto=d.get('sotto'))
        if d.get('nucleo'): e['nucleo'] = [[r2(x), r2(z)] for x, z in d['nucleo']]
        if d.get('fondo') is not None: e['fondo'] = r2(d['fondo'])
        if d.get('tn'): e['tn'] = d['tn']
        decks.append(e)
    # the cells under a deck where S is not a street at its own level: bit 7 of the material (the game paints no street there; fiumi-ponti, 28/10)
    tri, tree, _ = ca.triangoli_impalcati(decks, liberi=False); sotto = 0
    tiles, peso = {}, 0
    for f in sorted(glob.glob(os.path.join(a.da, 'terreno', '*.bin'))):
        m = re.match(r'(\d+)_(\d+)\.bin$', os.path.basename(f))
        if not m: continue
        b = open(f, 'rb').read(); assert b[:4] == b'GTAS', f
        ver, st, n = struct.unpack('<BBH', b[4:8]); assert ver == 1 and n == round(250 / st) + 1, (f, ver, st, n)
        tx, tz = int(m.group(1)), int(m.group(2)); b, k = ca.segna_sotto_impalcati(b, -HW + tx * TILE, -HH + tz * TILE, tri, tree); sotto += k
        g = gz(b); open(os.path.join(a.out, os.path.basename(f) + '.gz'), 'wb').write(g); peso += len(g)
        tiles['%s_%s' % m.groups()] = st
    acqua = []
    fa = os.path.join(a.da, 'acqua_fase2.json')
    if os.path.exists(fa):
        for s in json.load(open(fa, encoding='utf-8')):
            acqua.append(dict(p=[v for q in s['p'] for v in (r2(q[0]), r2(q[1]))], zw=[r2(v) for v in s['zw']]))
    pits = dk.get('pits', [])
    ff = os.path.join(a.da, 'fosse_meda.json')   # the ramps of src/sottoterra.py (docs/sottoterra.md, tappa 1)
    if os.path.exists(ff): pits = pits + json.load(open(ff, encoding='utf-8'))['fosse']
    ind = dict(ver=1, fase=4, comune=a.comune, nota='docs/motore.md fase 4: quote in m sul mare; il gioco toglie terrain.base di brianza.json',
               tiles=tiles, decks=decks, pits=pits, acqua=acqua)
    fb = os.path.join(a.da, 'binari_meda.json')   # the height of the tracks (src/binari.py)
    if os.path.exists(fb): ind['binari'] = json.load(open(fb, encoding='utf-8'))['binari']
    open(os.path.join(a.out, 'indice.json'), 'w', encoding='utf-8').write(json.dumps(ind, ensure_ascii=False, separators=(',', ':')))
    import terreno_pacco; terreno_pacco.impacchetta(a.out)  # i .bin.gz in un file solo (avvio veloce)
    print('terreno: %d tile (%s), %.1f MB in gzip; impalcati %d, fosse %d, assi d acqua %d; indice %.0f KB; celle sotto un impalcato senza strada %d' % (
        len(tiles), {s: sum(1 for v in tiles.values() if v == s) for s in sorted(set(tiles.values()))}, peso / 1e6, len(decks), len(ind['pits']), len(acqua),
        os.path.getsize(os.path.join(a.out, 'indice.json')) / 1024, sotto))
    fl = os.path.join(a.da, 'report_lisciatore.json')   # the checks of the lisciatore (src/lisciatore.py), next to the other reports
    if os.path.exists(fl): import shutil; shutil.copyfile(fl, os.path.join(os.path.dirname(os.path.abspath(a.out)), 'report_lisciatore.json'))
    if not a.no_controlli:   # the checks of the water and the bridges on what the game reads (src/controlli_acqua.py)
        ca.controlla(a.out, os.path.join(ROOT, 'brianza.json'), os.path.join(os.path.dirname(os.path.abspath(a.out)), 'report_acqua.json'))


if __name__ == '__main__':
    main()
