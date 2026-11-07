"""La build attorno al punto (Carlo 7/11, docs/agenti.md): rifà i dati e i pezzi solo per i tile vicini a un punto, per provare una correzione in pochi minuti.
  python src/build.py --zona X Z [R]      i tile che toccano il quadrato di lato 2R attorno a (X, Z) (R di default 150 m: da 2x2 a 3x3 tile)

Come funziona: le regole della build non cambiano, cambiano i dati che legge.
  1. dati ritagliati: OSM, DBGT e Overture solo dentro la finestra (i tile della zona più MARGINE metri per lato), interi i pezzi che la toccano
     (una via, un poligono, un divisore del DBGT che entra nella finestra c'è tutto); il resto di data/ (LiDAR, WorldCover, confini, foto) è quello di
     sempre, WorldCover a parte (fuori dalla finestra nessun dato). Il ritaglio sta in cache_build/zona/<finestra>/dati e si rifà solo se cambiano i file di data/
  2. build_data.py su quei dati, con lo stesso riquadro (stessi tile, stesso reticolo): cache_build/zona/<finestra>/brianza.json. Le poche decisioni
     che guardano tutta la mappa (mediane su tutte le strade o tutti gli edifici, il classificatore dei demoliti) le prende da costanti_build.json,
     scritto dalla build completa (src/costanti.py)
  3. i tile della zona di quel brianza.json prendono il posto degli stessi tile nel brianza.json della cartella (l'ultima build completa); i numeri delle
     strade (rp, gr) passano a quelli del grafo di quella build, che il gioco continua a leggere da mappa/globale.bin
  4. pezzi.py: i pezzi crudi di tutta la mappa in una cartella a parte, la cottura su quelli, poi in mappa/p si riscrivono solo i pezzi della zona
     (più globale.bin e grande.webp); gli altri pezzi restano come sono. Anche il numero degli edifici DBGT (e, da cui il gioco prende i colori) passa
     a quello della build completa, dallo stesso volume
Il terreno (terreno/) è quello della cartella: se la correzione tocca il terreno serve la build completa del terreno (col gettone, CLAUDE.md).
Serve una build completa fatta prima nella stessa cartella (brianza.json, costanti_build.json, terreno/, mappa/ dello stesso giro)."""
import argparse, gzip, json, math, os, shutil, sqlite3, subprocess, sys, time
import xml.etree.ElementTree as ET
from xml.sax.saxutils import quoteattr

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import riquadro as RQ

TILE = 250.0
MARGINE = 500.0   # m attorno ai tile della zona: quello che sta più in là non cambia i pezzi della zona (verificato byte per byte, docs/agenti.md)
KX, KZ = RQ.KX, 110540.0
HW, HH = (RQ.E - RQ.W) / 2 * KX, (RQ.N - RQ.S) / 2 * KZ   # = build_data.py, il riquadro dei dati
NTX, NTZ = int(math.ceil(2 * HW / TILE)), int(math.ceil(2 * HH / TILE))


def zona(x, z, r):
    """i tile del riquadro dei dati (numeri di brianza.json) che toccano il quadrato attorno a (x, z), e il loro riquadro in metri"""
    i0, i1 = max(0, int((x - r + HW) // TILE)), min(NTX - 1, int((x + r + HW) // TILE))
    j0, j1 = max(0, int((z - r + HH) // TILE)), min(NTZ - 1, int((z + r + HH) // TILE))
    ts = [i + NTX * j for j in range(j0, j1 + 1) for i in range(i0, i1 + 1)]
    return ts, (-HW + i0 * TILE, -HH + j0 * TILE, -HW + (i1 + 1) * TILE, -HH + (j1 + 1) * TILE)


def lonlat(x, z): return RQ.LON0 + x / KX, RQ.LAT0 - z / KZ


def tocca(b, w): return not (b[2] < w[0] or b[0] > w[2] or b[3] < w[1] or b[1] > w[3])


# ------------------------------------------------------------------ il ritaglio dei dati
def ritaglia_osm(src, dst, win):
    """le vie e le relazioni il cui riquadro tocca la finestra, intere, e i nodi che usano; i nodi con etichette dentro la finestra. Stesso ordine del file"""
    lo0, la1 = lonlat(win[0], win[1]); lo1, la0 = lonlat(win[2], win[3]); W = (lo0, la0, lo1, la1)
    nodes, ways, rels = {}, [], []
    for ev, el in ET.iterparse(src):
        tg = el.tag
        if tg == 'node':
            nodes[el.get('id')] = (float(el.get('lon')), float(el.get('lat')), [(x.get('k'), x.get('v')) for x in el.findall('tag')], el.get('lat'), el.get('lon'))
            el.clear()
        elif tg == 'way':
            ways.append((el.get('id'), [n.get('ref') for n in el.findall('nd')], [(x.get('k'), x.get('v')) for x in el.findall('tag')])); el.clear()
        elif tg == 'relation':
            rels.append((el.get('id'), [(m.get('type'), m.get('ref'), m.get('role')) for m in el.findall('member')], [(x.get('k'), x.get('v')) for x in el.findall('tag')])); el.clear()
    def bb(refs):
        ps = [nodes[r] for r in refs if r in nodes]
        if not ps: return None
        return (min(p[0] for p in ps), min(p[1] for p in ps), max(p[0] for p in ps), max(p[1] for p in ps))
    wbb = {w[0]: bb(w[1]) for w in ways}; wref = {w[0]: w[1] for w in ways}
    keep_w = {wid for wid, b in wbb.items() if b and tocca(b, W)}
    keep_r = []
    for rid, mem, tags in rels:
        bs = [wbb.get(ref) for ty, ref, ro in mem if ty == 'way'] + [(nodes[ref][0], nodes[ref][1]) * 2 for ty, ref, ro in mem if ty == 'node' and ref in nodes]
        bs = [b for b in bs if b]
        if bs and tocca((min(b[0] for b in bs), min(b[1] for b in bs), max(b[2] for b in bs), max(b[3] for b in bs)), W):
            keep_r.append((rid, mem, tags)); keep_w.update(ref for ty, ref, ro in mem if ty == 'way' and ref in wref)
    keep_n = {r for wid in keep_w for r in wref[wid]}
    keep_n.update(ref for rid, mem, tags in keep_r for ty, ref, ro in mem if ty == 'node')
    keep_n.update(nid for nid, n in nodes.items() if n[2] and W[0] <= n[0] <= W[2] and W[1] <= n[1] <= W[3])
    tag = lambda tags: ''.join('<tag k=%s v=%s/>' % (quoteattr(k), quoteattr(v or '')) for k, v in tags)
    with open(dst, 'w', encoding='utf-8') as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<osm version="0.6">\n')
        for nid, n in nodes.items():
            if nid in keep_n: f.write('<node id="%s" lat="%s" lon="%s">%s</node>\n' % (nid, n[3], n[4], tag(n[2])))
        for wid, refs, tags in ways:
            if wid in keep_w: f.write('<way id="%s">%s%s</way>\n' % (wid, ''.join('<nd ref="%s"/>' % r for r in refs), tag(tags)))
        for rid, mem, tags in keep_r:
            f.write('<relation id="%s">%s%s</relation>\n' % (rid, ''.join('<member type=%s ref=%s role=%s/>' % (quoteattr(t or ''), quoteattr(r or ''), quoteattr(o or '')) for t, r, o in mem), tag(tags)))
        f.write('</osm>\n')
    return dict(nodi=len(keep_n), vie=len(keep_w), relazioni=len(keep_r), di=[len(nodes), len(ways), len(rels)])


def ritaglia_gpkg(src, dst, win):
    """una copia del GeoPackage con, in ogni tabella di geometrie, solo le righe il cui riquadro (il suo indice rtree) tocca la finestra"""
    from pyproj import Transformer
    t = Transformer.from_crs('EPSG:4326', 'EPSG:7791', always_xy=True)
    cs = [t.transform(*lonlat(x, z)) for x in (win[0], win[2]) for z in (win[1], win[3])]
    x0, y0, x1, y1 = min(c[0] for c in cs) - 5, min(c[1] for c in cs) - 5, max(c[0] for c in cs) + 5, max(c[1] for c in cs) + 5
    shutil.copyfile(src, dst + '.tmp')
    con = sqlite3.connect(dst + '.tmp'); n0 = n1 = 0
    for (tr,) in con.execute("select name from sqlite_master where type='trigger'").fetchall(): con.execute('drop trigger "%s"' % tr)
    for tb, col in con.execute('select table_name, column_name from gpkg_geometry_columns').fetchall():
        rt = 'rtree_%s_%s' % (tb, col)
        if not con.execute("select 1 from sqlite_master where name=?", (rt,)).fetchone(): continue
        pk = [c[1] for c in con.execute('pragma table_info("%s")' % tb) if c[5]]
        if len(pk) != 1: continue
        n0 += con.execute('select count(*) from "%s"' % tb).fetchone()[0]
        con.execute('delete from "%s" where "%s" in (select id from "%s" where maxx < ? or minx > ? or maxy < ? or miny > ?)' % (tb, pk[0], rt), (x0, x1, y0, y1))
        n1 += con.execute('select count(*) from "%s"' % tb).fetchone()[0]
    con.commit(); con.close(); os.replace(dst + '.tmp', dst)
    return dict(righe=n1, di=n0)


def ritaglia_geojson(src, dst, win):
    lo0, la1 = lonlat(win[0], win[1]); lo1, la0 = lonlat(win[2], win[3]); W = (lo0, la0, lo1, la1)
    d = json.load(open(src, encoding='utf-8')); fe = d['features']
    def bb(c):
        xs, ys = [], []
        def giu(c):
            if isinstance(c[0], (int, float)): xs.append(c[0]); ys.append(c[1])
            else:
                for q in c: giu(q)
        giu(c); return (min(xs), min(ys), max(xs), max(ys))
    d['features'] = [f for f in fe if f.get('geometry') and tocca(bb(f['geometry']['coordinates']), W)]
    json.dump(d, open(dst, 'w', encoding='utf-8'), ensure_ascii=False)
    return dict(edifici=len(d['features']), di=len(fe))


def ritaglia_wc(src_dir, dst_dir, win):
    """il ritaglio di WorldCover (wc.npy) con le celle fuori dalla finestra a 0 (nessun dato): le sue aree coprono tutta la mappa e senza le zone OSM
    di fuori diventavano villette su 15 km2, il passo più lento della build della zona"""
    import numpy as np
    os.makedirs(dst_dir); A = np.load(os.path.join(src_dir, 'wc.npy')); lo0, la0, st = map(float, open(os.path.join(src_dir, 'wc_meta.txt')).read().split())
    (a0, b1), (a1, b0) = lonlat(win[0], win[1]), lonlat(win[2], win[3])
    c0, c1 = max(0, int((a0 - lo0) / st)), min(A.shape[1], int(math.ceil((a1 - lo0) / st)) + 1); r0, r1 = max(0, int((la0 - b1) / st)), min(A.shape[0], int(math.ceil((la0 - b0) / st)) + 1)
    B = np.zeros_like(A); B[r0:r1, c0:c1] = A[r0:r1, c0:c1]; np.save(os.path.join(dst_dir, 'wc.npy'), B)
    for n in os.listdir(src_dir):
        if n != 'wc.npy': collega(os.path.join(src_dir, n), os.path.join(dst_dir, n))
    return dict(celle=int((B > 0).sum()), di=int((A > 0).sum()))


def collega(src, dst):
    """dst rimanda a src: una giunzione per le cartelle (Windows, senza permessi speciali), un collegamento fisso per i file"""
    if os.path.isdir(src):
        if os.name == 'nt': import _winapi; _winapi.CreateJunction(src, dst)
        else: os.symlink(src, dst)
    else:
        try: os.link(src, dst)
        except OSError: shutil.copyfile(src, dst)


def impronta(data):
    """cosa dei dati entra nel ritaglio: nome, grandezza e data dei file ritagliati"""
    fs = [os.path.join(data, 'osm', 'maplarge.osm'), os.path.join(data, 'worldcover', 'wc', 'wc.npy')] + [os.path.join(data, 'overture', n) for n in ('edifici_overture.geojson', 'edifici_mappa_grande.geojson')]
    fs += [os.path.join(data, 'dbt', d, 'dbgt.gpkg') for d in sorted(os.listdir(os.path.join(data, 'dbt')))]
    return [[os.path.relpath(f, data), os.path.getsize(f), int(os.path.getmtime(f))] for f in fs if os.path.exists(f)]


def togli(cart):
    """cancella una cartella della zona: le giunzioni dentro dati/ si staccano senza toccare quello a cui rimandano"""
    stacca(os.path.join(cart, 'dati')); shutil.rmtree(cart, ignore_errors=True)


def stacca(cart):
    """toglie le giunzioni e i collegamenti a cartelle sotto cart (non quello a cui rimandano), prima di cancellarla"""
    for r, ds, _ in os.walk(cart):
        for d in list(ds):
            p = os.path.join(r, d)
            if os.path.islink(p) or os.path.isjunction(p): (os.rmdir if os.name == 'nt' else os.remove)(p); ds.remove(d)


def prepara_dati(data, cart, win):
    """la cartella dei dati ritagliati (GTA_DATA della build della zona)"""
    out = os.path.join(cart, 'dati'); fatto = os.path.join(out, 'ritaglio.json'); imp = dict(finestra=win, file=impronta(data), versione=3)
    if os.path.exists(fatto) and json.load(open(fatto, encoding='utf-8')).get('impronta') == imp: return out, json.load(open(fatto, encoding='utf-8'))['rep']
    if os.path.isdir(out): stacca(out); shutil.rmtree(out)
    os.makedirs(out); rep = {}
    for n in sorted(os.listdir(data)):
        s = os.path.join(data, n); d = os.path.join(out, n)
        if n in ('osm', 'overture', 'dbt'): os.makedirs(d)
        elif n == 'worldcover':
            os.makedirs(d)
            for m in os.listdir(s):
                if m == 'wc' and os.path.exists(os.path.join(s, m, 'wc.npy')): rep['worldcover'] = ritaglia_wc(os.path.join(s, m), os.path.join(d, m), win)
                else: collega(os.path.join(s, m), os.path.join(d, m))
        else: collega(s, d)
    for n in os.listdir(os.path.join(data, 'osm')):
        if n != 'maplarge.osm': collega(os.path.join(data, 'osm', n), os.path.join(out, 'osm', n))
    rep['osm'] = ritaglia_osm(os.path.join(data, 'osm', 'maplarge.osm'), os.path.join(out, 'osm', 'maplarge.osm'), win)
    for n in os.listdir(os.path.join(data, 'overture')):
        s = os.path.join(data, 'overture', n)
        if n.endswith('.geojson'): rep[n] = ritaglia_geojson(s, os.path.join(out, 'overture', n), win)
        else: collega(s, os.path.join(out, 'overture', n))
    import dbgt_quote as dq
    from shapely.geometry import box
    for c in sorted(os.listdir(os.path.join(data, 'dbt'))):
        s = os.path.join(data, 'dbt', c)
        if not os.path.isdir(s): collega(s, os.path.join(out, 'dbt', c)); continue
        cc = dq.confine_comune(c, os.path.join(data, 'osm', 'confini_comuni.json')) if os.path.exists(os.path.join(s, 'dbgt.gpkg')) else None
        if cc is not None and not cc.intersects(box(*win).buffer(50)): rep['dbgt ' + c] = 'fuori dalla finestra, lasciato fuori'; continue   # un comune che non tocca la finestra non c'è (come fuori dalla zona DBGT)
        os.makedirs(os.path.join(out, 'dbt', c))
        for n in os.listdir(s):
            if n == 'dbgt.gpkg': rep['dbgt ' + c] = ritaglia_gpkg(os.path.join(s, n), os.path.join(out, 'dbt', c, n), win)
            else: collega(os.path.join(s, n), os.path.join(out, 'dbt', c, n))
    json.dump(dict(impronta=imp, rep=rep), open(fatto, 'w', encoding='utf-8'))
    return out, rep


# ------------------------------------------------------------------ i tile della zona nel brianza.json completo
def firme(B, box):
    """per ogni strada: i suoi nodi (dm) dentro box, nell'ordine della strada; la stessa strada nelle due build ha la stessa firma"""
    N = B['nodes']; x0, z0, x1, z1 = [v * 10 for v in box]; out = []
    for r in B['roads']:
        out.append(tuple((N[3 * i], N[3 * i + 1]) for i in r['g'] if x0 <= N[3 * i] <= x1 and z0 <= N[3 * i + 1] <= z1))
    return out


def unisci(B, L, zt, box):
    """B con i tile zt presi da L; rp di L passa ai numeri delle strade di B; cancelli e porte della zona presi da L. Rende quante strade non trovate"""
    fb = {}
    for i, f in enumerate(firme(B, box)):
        if f: fb.setdefault(f, []).append(i)
    fl = firme(L, box); usate = {}; mappa = {}
    for i, f in enumerate(fl):
        if not f: continue
        k = usate.get(f, 0); usate[f] = k + 1
        if f in fb and k < len(fb[f]): mappa[i] = fb[f][k]
    # e: il numero dell'edificio DBGT di un volume (il gioco ne prende i colori): quello della build completa, dallo stesso volume nello stesso tile
    emap, emax = {}, max([v['e'] for d in B['tiles'] for v in d.get('b', []) if 'e' in v] or [0])
    for t in zt:
        vb = {json.dumps(v['p']): v['e'] for v in B['tiles'][t].get('b', []) if 'e' in v}
        for v in L['tiles'][t].get('b', []):
            if 'e' in v and v['e'] not in emap and json.dumps(v['p']) in vb: emap[v['e']] = vb[json.dumps(v['p'])]
    persi = set(); Z = set(zt); enuovi = set()
    for t in zt:
        d = dict(L['tiles'][t])
        if 'rp' in d:
            rp = [mappa[i] for i in d['rp'] if i in mappa]; persi.update(i for i in d['rp'] if i not in mappa)
            d['rp'] = sorted(rp)
        if 'gr' in d:   # i guardrail: [tipo, [strade], punti]
            persi.update(i for g in d['gr'] for i in g[1] if i not in mappa); d['gr'] = [[g[0], [mappa[i] for i in g[1] if i in mappa]] + g[2:] for g in d['gr']]
        if 'b' in d:
            d['b'] = [dict(v, e=emap[v['e']]) if v.get('e') in emap else (dict(v, e=emax + 1 + v['e']) if 'e' in v else v) for v in d['b']]
            enuovi.update(v['e'] for v in L['tiles'][t]['b'] if 'e' in v and v['e'] not in emap)
        B['tiles'][t] = d
    meta = B['meta']
    tof = lambda x, z: min(NTX - 1, max(0, int((x + meta['hw']) // TILE))) + NTX * min(NTZ - 1, max(0, int((z + meta['hh']) // TILE)))   # = pezzi.py
    for k in ('gates', 'doors'):
        B[k] = [e for e in B.get(k, []) if tof((e[0] + e[2]) / 20, (e[1] + e[3]) / 20) not in Z] + [e for e in L.get(k, []) if tof((e[0] + e[2]) / 20, (e[1] + e[3]) / 20) in Z]
    return sorted(persi), sorted(enuovi)


# ------------------------------------------------------------------ tutto
def main(argv=None):
    ap = argparse.ArgumentParser(description='La build attorno al punto: dati e pezzi solo per i tile vicini a (x, z)')
    ap.add_argument('x', type=float); ap.add_argument('z', type=float); ap.add_argument('r', type=float, nargs='?', default=150.0)
    ap.add_argument('--margine', type=float, default=MARGINE); ap.add_argument('--root', default=ROOT)
    ap.add_argument('--solo-dati', action='store_true', help='solo il brianza.json della zona, niente pezzi')
    a = ap.parse_args(argv); T0 = time.time()
    log = lambda *s: print('%4.0fs zona:' % (time.time() - T0), *s, flush=True)
    DATA = os.environ.get('GTA_DATA', os.path.join(ROOT, 'data'))
    zt, zb = zona(a.x, a.z, a.r); m = a.margine; win = (zb[0] - m, zb[1] - m, zb[2] + m, zb[3] + m)
    for f in ('brianza.json', os.path.join('terreno', 'indice.json'), os.path.join('mappa', 'globale.bin')):
        if not os.path.exists(os.path.join(a.root, f)): sys.exit('manca %s: prima serve una build completa nella cartella' % f)
    if not os.path.exists(os.path.join(a.root, 'costanti_build.json')): log('ATTENZIONE: manca costanti_build.json (la build completa è di prima di src/costanti.py): le decisioni su tutta la mappa si prendono sul pezzo, i pezzi possono venire diversi')
    cart = os.path.join(a.root, 'cache_build', 'zona', '%d_%d_%d_%d' % tuple(round(v) for v in win)); os.makedirs(cart, exist_ok=True); os.utime(cart)
    zz = sorted((d for d in os.listdir(os.path.dirname(cart)) if d[:1].isdigit() or d[:1] == '-'), key=lambda d: -os.path.getmtime(os.path.join(os.path.dirname(cart), d)))
    for d in zz[3:]: togli(os.path.join(os.path.dirname(cart), d))   # tiene le ultime tre zone (ogni ritaglio sono ~200 MB)
    log('tile', ['%d_%d' % (t % NTX, t // NTX) for t in zt], 'riquadro', [round(v) for v in zb], 'finestra dei dati', [round(v) for v in win])
    dati, rep = prepara_dati(DATA, cart, win); log('dati ritagliati', rep)
    out = os.path.join(cart, 'brianza.json'); S, N, W, E = map(repr, RQ.BBOX)
    env = dict(os.environ, GTA_DATA=dati, PYTHONIOENCODING='utf-8', GTA_CACHE=os.path.join(a.root, 'cache_build', 'zona', 'cache'), GTA_COSTANTI_LEGGI=os.path.join(a.root, 'costanti_build.json'))
    rc = subprocess.call([sys.executable, '-u', os.path.join(HERE, 'build_data.py'), os.path.join(dati, 'osm', 'maplarge.osm'), os.path.join(dati, 'terreno', 'w50550_s10.tif'), out, S, N, W, E], env=env)
    if rc: sys.exit('build dei dati della zona fallita')
    log('dati della zona fatti')
    if a.solo_dati: return
    import pezzi, griglia as GR
    B = json.load(open(os.path.join(a.root, 'brianza.json'), encoding='utf-8')); L = json.load(open(out, encoding='utf-8'))
    assert B['meta'] == L['meta'], 'il riquadro della build completa non è quello di adesso: rifai la build completa'
    persi, enuovi = unisci(B, L, zt, (zb[0] - 200, zb[1] - 200, zb[2] + 200, zb[3] + 200))
    if persi: log('ATTENZIONE: %d strade della zona non trovate nel grafo della build completa (strade nuove o cambiate: per quelle serve la build completa)' % len(persi))
    if enuovi: log('edifici DBGT della zona senza lo stesso volume nella build completa (cambiati): %d, numeri nuovi (i colori possono cambiare)' % len(enuovi))
    IND = json.load(open(os.path.join(a.root, 'terreno', 'indice.json'), encoding='utf-8'))
    PK = open(os.path.join(a.root, 'terreno', IND['pacco']['file']), 'rb').read() if IND.get('pacco') else b''
    g = GR.griglia(B['meta']['hw'], B['meta']['hh'], DATA); dem = os.path.join(DATA, 'terreno', 'w50550_s10.tif')
    sito = os.path.join(cart, 'crudi'); shutil.rmtree(sito, ignore_errors=True)
    log('crudi', pezzi.scrivi(sito, B, IND, PK, g, None, dem))
    c = os.path.join(sito, 'cotta.json'); webp = os.path.join(sito, 'grande.webp')
    if pezzi.cottura(a.root, c, webp, mappa=os.path.join(sito, 'mappa')): sys.exit('cottura fallita')
    log('cottura fatta')
    solo = {(t % NTX + g['dx']) + g['ntx'] * (t // NTX + g['dz']) for t in zt}
    log('cotti', pezzi.scrivi(a.root, B, IND, PK, g, json.load(open(c, encoding='utf-8')), dem, solo=solo))
    shutil.copyfile(webp, os.path.join(a.root, 'mappa', 'grande.webp'))
    log('pezzi riscritti', sorted('%d_%d' % (t % g['ntx'], t // g['ntx']) for t in solo))


if __name__ == '__main__':
    main()
