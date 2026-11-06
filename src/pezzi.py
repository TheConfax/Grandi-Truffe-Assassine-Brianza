"""I pezzi della mappa (passo 0 della mappa grande, docs/motore.md "Caricamento a pezzi"). Prende quello che esce da build.py e terreno_gioco.py (brianza.json, terreno/) e scrive
mappa/, che è tutto quello che il gioco legge:
  mappa/globale.bin      gzip di un JSON: meta, grafo stradale, nomi, punti di interesse, ferrovie, fiumi, l'elenco dei pezzi e quello che la cottura ha deciso sull'intera mappa
  mappa/suolo.bin        gzip: il terreno a 10 m su tutta la zona giocabile, il suolo che c'è sempre (la fisica non cade mai nel vuoto)
  mappa/p/<tx>_<tz>.bin  un pezzo per ogni tile con dei dati, gzip di: lunghezza del JSON (uint32), JSON del tile, S del tile (GTAS). Un tile senza file è suolo nudo
  mappa/grande.webp       la mappa grande, disegnata dalla cottura
Due passate: la prima scrive i pezzi crudi, poi src/cuoci.mjs apre il gioco con ?cuoci (legge tutti i pezzi e calcola una volta sola ciò che dipende dall'intera mappa), la seconda ci scrive dentro il risultato.
  python src/pezzi.py                 tutte e due le passate con la cottura in mezzo (PLAYWRIGHT e CHROME come per i controlli)
  python src/pezzi.py --solo-crudi    solo la prima
"""
import argparse, gzip, hashlib, io, json, math, os, shutil, struct, subprocess, sys, threading, base64
import http.server
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import griglia as GR

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get('GTA_DATA', os.path.join(ROOT, 'data'))
TILE = GR.TILE


def gz(b):
    o = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=o, compresslevel=9, mtime=0) as f: f.write(b)
    return o.getvalue()


def js(o): return json.dumps(o, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def suolo_esteso(B, g, dem):
    """il terreno di brianza.json, che resta com'è sugli stessi punti, allungato fino alla zona giocabile + 480 m con TINITALY; si aggiunge a gruppi di 4 celle (il fondale prende un punto ogni 4)"""
    import tifffile
    from pyproj import Transformer
    T = B['terrain']; nx, nz, st = T['nx'], T['nz'], T['step']; x0, z0 = T['x0'], T['z0']
    H0 = np.frombuffer(base64.b64decode(T['h16']), dtype='<u2').reshape(nz, nx)
    M = 480.0; zx0, zz0, zx1, zz1 = g['zona']
    pre = lambda a, b: int(math.ceil(max(0.0, a - b) / (4 * st))) * 4
    ax, az = pre(x0, zx0 - M), pre(z0, zz0 - M); bx, bz = pre(zx1 + M, x0 + (nx - 1) * st), pre(zz1 + M, z0 + (nz - 1) * st)
    NX, NZ = nx + ax + bx, nz + az + bz; X0, Z0 = x0 - ax * st, z0 - az * st
    xs = X0 + np.arange(NX) * st; zs = Z0 + np.arange(NZ) * st
    page = tifffile.TiffFile(dem).pages[0]; E0, N0 = page.tags['ModelTiepointTag'].value[3:5]; A = page.asarray().astype(np.float32)   # come build_data.py sample()
    XX, ZZ = np.meshgrid(xs, zs); e, n = Transformer.from_crs('EPSG:4326', 'EPSG:32632', always_xy=True).transform(GR.RQ.LON0 + XX / GR.KX, GR.RQ.LAT0 - ZZ / GR.KZ)
    c = (e - E0) / 10 - 0.5; r = (N0 - n) / 10 - 0.5; c0, r0 = np.floor(c).astype(int), np.floor(r).astype(int); fc, fr = c - c0, r - r0
    G_ = lambda rr, cc: A[np.clip(rr, 0, A.shape[0] - 1), np.clip(cc, 0, A.shape[1] - 1)]
    Hm = G_(r0, c0) * (1 - fc) * (1 - fr) + G_(r0, c0 + 1) * fc * (1 - fr) + G_(r0 + 1, c0) * (1 - fc) * fr + G_(r0 + 1, c0 + 1) * fc * fr
    H = np.clip(np.round((Hm.reshape(NZ, NX) - T['base']) * 10), 0, 65535)
    # al raccordo col terreno di prima: la differenza col suo bordo sfuma in 300 m, così niente gradino all'orlo
    fuori = np.ones((NZ, NX), bool); fuori[az:az + nz, ax:ax + nx] = False
    jj, ii = np.nonzero(fuori); cj = np.clip(jj, az, az + nz - 1); ci2 = np.clip(ii, ax, ax + nx - 1)
    d = H0[cj - az, ci2 - ax].astype('f8') - H[jj, ii]; dist = np.hypot((jj - cj) * st, (ii - ci2) * st)
    H[jj, ii] = np.clip(np.round(H[jj, ii] + d * np.clip(1 - dist / 300.0, 0, 1)), 0, 65535)
    H[az:az + nz, ax:ax + nx] = H0
    H = H.astype('<i4')
    D = H.copy(); D[:, 1:] = H[:, 1:] - H[:, :-1]; D[1:, 0] = H[1:, 0] - H[:-1, 0]   # differenze lungo la riga: si comprime molto meglio
    assert abs(D).max() < 32768
    return dict(x0=float(X0), z0=float(Z0), step=st, nx=int(NX), nz=int(NZ), base=T['base']), gz(D.astype('<i2').tobytes()), int(abs(d[dist < 11]).max()) if len(d) else 0


def scrivi(root, B, IND, PK, g, cotta, dem):
    meta0 = B['meta']; DX, DZ = g['dx'], g['dz']; ntx0, ntz0 = meta0['ntx'], meta0['ntz']; NTX, NTZ = g['ntx'], g['ntz']
    tn = lambda t0: (t0 % ntx0 + DX) + NTX * (t0 // ntx0 + DZ)
    k0n = lambda k: '%d_%d' % (int(k.split('_')[0]) + DX, int(k.split('_')[1]) + DZ)
    HW, HH = g['hw'], g['hh']
    tof = lambda x, z: min(NTX - 1, max(0, int((x + meta0['hw']) // TILE) + DX)) + NTX * min(NTZ - 1, max(0, int((z + meta0['hh']) // TILE) + DZ))
    box = lambda x0, z0, x1, z1: [i + NTX * j for j in range(max(0, int((z0 + HH) // TILE)), min(NTZ - 1, int((z1 + HH) // TILE)) + 1) for i in range(max(0, int((x0 + HW) // TILE)), min(NTX - 1, int((x1 + HW) // TILE)) + 1)]
    out = os.path.join(root, 'mappa'); pd = os.path.join(out, 'p')
    if os.path.isdir(pd): shutil.rmtree(pd)
    os.makedirs(pd)
    tiles = {}   # t della griglia -> JSON del pezzo
    rl, rv = [], []
    for t0, td in enumerate(B['tiles']):
        d = dict(td); t = tn(t0)
        for r in d.get('rl', []): rl.append([t, r])
        for r in d.get('rv', []): rv.append([t, r])
        if d: tiles[t] = d
    S = {}
    if IND.get('pacco'):
        for k, (o, l) in IND['pacco']['tile'].items():
            tx, tz = map(int, k0n(k).split('_')); S[tx + NTX * tz] = gzip.decompress(PK[o:o + l])
    for t in S: tiles.setdefault(t, {})
    D0 = lambda t: tiles.setdefault(t, {})
    # cancelli e porte: nel tile del loro punto di mezzo, come li disegna il gioco
    for key, name in (('gates', 'gt'), ('doors', 'dr')):
        for e in B.get(key, []):
            D0(tof((e[0] + e[2]) / 20, (e[1] + e[3]) / 20)).setdefault(name, []).append(e)
    # impalcati e fosse: una copia in ogni tile che toccano (il gioco ne tiene una sola finché un pezzo la vuole)
    M = 4.0
    for i, d in enumerate(IND.get('decks', [])):
        tr = d['tri']; xs = tr[0::3] + [p[0] for p in d['imp']]; zs = tr[1::3] + [p[1] for p in d['imp']]
        ts = box(min(xs) - M, min(zs) - M, max(xs) + M, max(zs) + M); e = dict(d, ord=i, tiles=ts)
        for t in ts: D0(t).setdefault('dk', []).append(e)
    for i, q in enumerate(IND.get('pits', [])):
        q = dict(q); q['celle'] = {k0n(k): v for k, v in q.get('celle', {}).items()}; q['anello'] = [[k0n(a[0])] + list(a[1:]) for a in q.get('anello', [])]
        pts = q.get('sx', []) + q.get('dx', []) or [q['c']]; xs = [p[0] for p in pts]; zs = [p[1] for p in pts]
        ts = set(box(min(xs) - M, min(zs) - M, max(xs) + M, max(zs) + M))
        for k in list(q['celle']) + [a[0] for a in q['anello']]:
            tx, tz = map(int, k.split('_')); ts.add(tx + NTX * tz)
        e = dict(q, ord=i)
        for t in sorted(ts): D0(t).setdefault('pt', []).append(e)
    # l'acqua: ogni serie a tratti, per tile (entro 12 m, il raggio di H.water)
    W = 12.0
    for a in IND.get('acqua', []):
        p, zw = a['p'], a['zw']; cur = {}
        for k in range(1, len(zw)):
            ax, az, bx, bz = p[2 * k - 2], p[2 * k - 1], p[2 * k], p[2 * k + 1]
            for t in box(min(ax, bx) - W, min(az, bz) - W, max(ax, bx) + W, max(az, bz) + W):
                c = cur.get(t)
                if c and c[0] == k - 1: c[1]['p'] += [bx, bz]; c[1]['zw'].append(zw[k]); c[0] = k
                else:
                    rec = dict(p=[ax, az, bx, bz], zw=[zw[k - 1], zw[k]]); cur[t] = [k, rec]; D0(t).setdefault('aq', []).append(rec)
    if cotta:
        for ts, v in cotta['pezzi'].items(): D0(int(ts)).update(v)
    pezzi = {}
    for t in sorted(tiles):
        d = tiles[t]; b = S.get(t, b''); j = js(d); tx, tz = t % NTX, t // NTX
        with open(os.path.join(pd, '%d_%d.bin' % (tx, tz)), 'wb') as f: f.write(gz(struct.pack('<I', len(j)) + j + b))
        pezzi[str(t)] = IND['tiles'].get('%d_%d' % (tx - DX, tz - DZ), 0)
    info, sg, salto = suolo_esteso(B, g, dem)
    open(os.path.join(out, 'suolo.bin'), 'wb').write(sg)
    meta = dict(meta0, hw=HW, hh=HH, ntx=NTX, ntz=NTZ, zona=g['zona'], dati=dict(hw=meta0['hw'], hh=meta0['hh']), seme=dict(hw=GR.SEME_HW, hh=GR.SEME_HH, nx=GR.SEME_NX, nz=GR.SEME_NZ), partenza=GR.PARTENZA)
    glob = dict(meta=meta, terrain=info, nodes=B['nodes'], roads=B['roads'], names=B['names'], pois=B['pois'], places=B['places'], signals=B.get('signals', []), fountains=B.get('fountains', []), bus=B.get('bus', []), trains=B.get('trains', []), cut=B.get('cut', []),
                rl=rl, rv=rv, binari=IND.get('binari', []), ondeck=sorted({r for d in IND.get('decks', []) for r in d.get('ra', [])}), pezzi=pezzi, cotta=(cotta or {}).get('globale'))
    h = hashlib.sha1(js(glob) + sg)
    for t in sorted(tiles): h.update(open(os.path.join(pd, '%d_%d.bin' % (t % NTX, t // NTX)), 'rb').read())
    glob['ver'] = h.hexdigest()[:10]
    open(os.path.join(out, 'globale.bin'), 'wb').write(gz(js(glob)))
    if not cotta: open(os.path.join(out, 'solo_cottura.json'), 'wb').write(js(dict(ng=B.get('ng', []))))
    elif os.path.exists(os.path.join(out, 'solo_cottura.json')): os.remove(os.path.join(out, 'solo_cottura.json'))
    return dict(pezzi=len(tiles), con_S=len(S), peso_pezzi_mb=round(sum(os.path.getsize(os.path.join(pd, f)) for f in os.listdir(pd)) / 1e6, 2), globale_kb=os.path.getsize(os.path.join(out, 'globale.bin')) // 1024, suolo_kb=len(sg) // 1024, griglia=[NTX, NTZ], dx=DX, dz=DZ, zona=g['zona'], salto_al_raccordo_dm=salto)


def main(argv=None):
    ap = argparse.ArgumentParser(description='Divide il mondo nei pezzi che il gioco carica')
    ap.add_argument('--root', default=ROOT); ap.add_argument('--solo-crudi', action='store_true'); ap.add_argument('--cotta', default=None, help='il file della cottura già pronto')
    a = ap.parse_args(argv)
    B = json.load(open(os.path.join(a.root, 'brianza.json'), encoding='utf-8'))
    IND = json.load(open(os.path.join(a.root, 'terreno', 'indice.json'), encoding='utf-8'))
    PK = open(os.path.join(a.root, 'terreno', IND['pacco']['file']), 'rb').read() if IND.get('pacco') else b''
    g = GR.griglia(B['meta']['hw'], B['meta']['hh'], DATA); dem = os.path.join(DATA, 'terreno', 'w50550_s10.tif')
    if a.cotta:
        print(scrivi(a.root, B, IND, PK, g, json.load(open(a.cotta, encoding='utf-8')), dem)); return
    print('crudi', scrivi(a.root, B, IND, PK, g, None, dem))
    if a.solo_crudi: return
    class Muto(http.server.SimpleHTTPRequestHandler):
        def __init__(s, *p, **k): super().__init__(*p, directory=a.root, **k)
        def log_message(s, *p): pass
    class Server(http.server.ThreadingHTTPServer): request_queue_size = 256   # the invisible browser opens 16 connections at once (5 fails on Windows)
    srv = Server(('127.0.0.1', 0), Muto); threading.Thread(target=srv.serve_forever, daemon=True).start()
    c = os.path.join(a.root, 'mappa', 'cotta.json')
    rc = subprocess.call(['node', os.path.join(ROOT, 'src', 'cuoci.mjs'), 'http://127.0.0.1:%d/' % srv.server_address[1], c, os.path.join(a.root, 'mappa', 'grande.webp')])
    srv.shutdown()
    if rc: sys.exit('cottura fallita')
    print('cotti', scrivi(a.root, B, IND, PK, g, json.load(open(c, encoding='utf-8')), dem))
    os.remove(c)
    # the check of the parapets and walls of the bridges, in the game just written (src/controlli_ponti.mjs, key barriere of report_ponti.json)
    srv = Server(('127.0.0.1', 0), Muto); threading.Thread(target=srv.serve_forever, daemon=True).start()
    subprocess.call(['node', os.path.join(ROOT, 'src', 'controlli_ponti.mjs'), 'http://127.0.0.1:%d/' % srv.server_address[1], os.path.join(a.root, 'report_ponti.json')])
    srv.shutdown()


if __name__ == '__main__': main()
