# Controlli dell'acqua e dei ponti (todo.md: "i fiumi sono il problema più grosso", "strade e ferrovia sfondate sul fiume", "strada doppia al
# cavalcavia"; docs/motore.md 7, fiumi e ponti). Leggono quello che legge il gioco, terreno/indice.json + pacco.bin (S, materiali, celle
# sotto un impalcato, impalcati, acqua) e brianza.json (strade disegnate, binari, fiumi OSM), più il LiDAR per il fondo delle valli, e
# contano su tutta la mappa:
#   A1 acqua disegnata sopra una carreggiata o un binario (m2 e luoghi), come la disegna il gioco (velo dell'acqua sull'alveo, striscia dei
#      fiumi OSM senza alveo, aree d'acqua OSM)
#   A2 punti di carreggiata o di binario sopra un corso d'acqua con la superficie più di 1 m sotto la strada (strade sfondate)
#   A3 carreggiata, marciapiedi e piazze dipinti sul suolo sotto un impalcato (celle, impalcati)
#   A4 parapetti e cordoli dei fiumi in bosco o in campagna (lontano da case e strade), e bocche di tombino lontane da una strada
#   A5 tratti d'acqua OSM lontani dal fondo della valle del LiDAR
#   A6 strade e binari sopra un corso d'acqua coperto (assi EL_IDR_TY 03 del DBGT, tombinati, sotto una carreggiata o un binario disegnati):
#      quanti incroci, e in quanti la superficie sopra l'asse sta piu di 1 m sotto la strada intorno (strada o massicciata sfondata)
# e le prove fisse delle segnalazioni di Carlo (viale Francia, via Maroncelli, Campaccio, via Varese) con le quote attese.
#   python src/controlli_acqua.py [--terreno DIR] [--dati brianza.json] [--out report_acqua.json]
# terreno_gioco.py lo chiama a fine corsa. Regole generali: nessuna coordinata fuori dalle prove fisse.
import os, sys, json, gzip, struct, argparse, time
import numpy as np, shapely, shapely.ops
from shapely.geometry import Polygon, LineString, Point, box
from scipy import ndimage
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)

TILE = 250.0
SOTTO_DK = 1.0     # a cell is under a deck when the top stands this much over S there (A3, and the bit of terreno_gioco.py)
STRADA_MAT = (1, 2)  # cell materials that are a road or a sidewalk at their own level (S burned there): the paint under a deck stays
SFONDO = 1.0       # A2: a point of a carriageway this far under the road around it is a hole
FONDO = 1.0        # A5: a point of an OSM stream this far over the bottom of the valley across it
WMAX = 12.0        # the game's H.water: zw of the nearest DBGT axis point within this


def libero(d):  # altezze3.js: nothing but water or a field passes under it; the game lifts the drawn streets onto its top (H.overFree)
    return d.get('tipo') != 'copertura' and not (d.get('sotto') and (d['sotto'].get('strade') or d['sotto'].get('ferrovia')))


def triangoli_impalcati(decks, liberi=True):
    """the top triangles of the decks that are not a gallery cover (without the free ones: liberi False): (array n x 3 x 3 of x, z, y;
    STRtree; deck id of each)"""
    T, ids = [], []
    for k, d in enumerate(decks):
        if d.get('tipo') == 'copertura' or (not liberi and libero(d)): continue
        t = np.asarray(d['tri'], float).reshape(-1, 3, 3); T.append(t); ids.append(np.full(len(t), d.get('id', k)))
    if not T: return np.zeros((0, 3, 3)), None, np.zeros(0, int)
    T = np.concatenate(T); return T, shapely.STRtree(shapely.polygons(T[:, :, :2])), np.concatenate(ids)


def cima_impalcati(tri, tree, x, z):
    """the highest deck top over the points (NaN where there is none), the deck triangles as the game reads them (altezze3.js deckAt)"""
    x, z = np.asarray(x, float), np.asarray(z, float); out = np.full(x.shape, np.nan)
    if tree is None or not len(x): return out
    pi, ti = tree.query(shapely.points(x, z), predicate='intersects')
    if not len(pi): return out
    T = tri[ti]; px, pz = x[pi], z[pi]
    ax, az, bx, bz, cx, cz = T[:, 0, 0], T[:, 0, 1], T[:, 1, 0], T[:, 1, 1], T[:, 2, 0], T[:, 2, 1]
    den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); den = np.where(np.abs(den) < 1e-12, 1e-12, den)
    l1 = ((bz - cz) * (px - cx) + (cx - bx) * (pz - cz)) / den; l2 = ((cz - az) * (px - cx) + (ax - cx) * (pz - cz)) / den; l3 = 1 - l1 - l2
    y = l1 * T[:, 0, 2] + l2 * T[:, 1, 2] + l3 * T[:, 2, 2]
    np.fmax.at(out, pi, np.where((l1 >= -1e-6) & (l2 >= -1e-6) & (l3 >= -1e-6), y, np.nan))
    return out


def segna_sotto_impalcati(b, x0, z0, tri, tree):
    """a tile of S (.bin bytes) with bit 7 of the cell material set where the cell is under a deck (tri, tree: the decks that are not
    free, triangoli_impalcati(liberi=False)) (its middle more than SOTTO_DK under the
    top) and S there is not a street at its own level (material 1, 2): the game paints no street there (world3.js), the ground under the
    bridge shows what it is (grass, slope, rail bed, river bed). Returns (bytes, cells marked)"""
    _, st, n = struct.unpack('<BBH', b[4:8]); base, = struct.unpack('<f', b[8:12]); mo = 12 + 2 * n * n; c = n - 1
    if len(b) < mo + c * c or tree is None: return b, 0
    h = (base * 100 + np.frombuffer(b, '<u2', n * n, 12).reshape(n, n).astype(np.float64)) / 100
    m = np.frombuffer(b, np.uint8, c * c, mo).reshape(c, c).copy() & 127
    J, I = np.meshgrid(np.arange(c), np.arange(c), indexing='ij'); x = x0 + (I + 0.5) * st; z = z0 + (J + 0.5) * st
    tp = cima_impalcati(tri, tree, x.ravel(), z.ravel()).reshape(c, c)
    if not np.isfinite(tp).any(): return b[:mo] + m.tobytes() + b[mo + c * c:], 0
    hc = (h[:-1, :-1] + h[1:, 1:]) / 2      # the middle of the cell: on the diagonal of its two triangles
    k = np.isfinite(tp) & (tp > hc + SOTTO_DK) & ~np.isin(m, STRADA_MAT)
    m[k] |= 128
    return b[:mo] + m.tobytes() + b[mo + c * c:], int(k.sum())


def dec(a): return np.cumsum(np.asarray(a, float).reshape(-1, 2), axis=0) / 10


def link(x, z): return '?x=%.1f&z=%.1f' % (x, z)


def pct(a, ps=(50, 90, 99)):
    a = np.asarray(a, float); a = a[np.isfinite(a)]
    if not len(a): return dict(n=0)
    return dict(n=int(len(a)), **{'p%d' % p: round(float(np.percentile(a, p)), 3) for p in ps}, max=round(float(a.max()), 3))


def luoghi(P, r=4.0, val=None, n=12):
    """points -> places (clusters within r), the biggest first: [{punti, x, z, v, link}]"""
    P = np.asarray(P, float)
    if not len(P): return []
    T = cKDTree(P); pairs = T.query_pairs(r, output_type='ndarray'); lab = np.arange(len(P))
    if len(pairs):
        import scipy.sparse as sp
        A = sp.coo_matrix((np.ones(len(pairs)), (pairs[:, 0], pairs[:, 1])), shape=(len(P), len(P)))
        _, lab = sp.csgraph.connected_components(A, directed=False)
    out = []
    for k in np.unique(lab):
        m = lab == k; j = np.nonzero(m)[0]
        jj = j[np.argmax(val[j])] if val is not None else j[np.argmin(np.hypot(*(P[j] - P[j].mean(0)).T))]
        out.append(dict(punti=int(m.sum()), x=round(float(P[jj, 0]), 1), z=round(float(P[jj, 1]), 1), **({'v': round(float(val[jj]), 2)} if val is not None else {}), link=link(*P[jj])))
    out.sort(key=lambda c: -c['punti'])
    return out[:n] if n else out


class Mondo:
    """S, materials, under-deck cells, decks and water of terreno/, the drawn streets and rivers of brianza.json"""
    def __init__(s, terreno, dati, log=print):
        t0 = time.time(); s.log = log
        s.B = B = json.load(open(dati, encoding='utf-8')); m = B['meta']; s.hw, s.hh, s.ntx = m['hw'], m['hh'], m['ntx']
        s.ind = ind = json.load(open(os.path.join(terreno, 'indice.json'), encoding='utf-8'))
        pk = ind.get('pacco'); blob = open(os.path.join(terreno, pk['file']), 'rb').read() if pk else None
        tiles = {}
        for k, st in ind['tiles'].items():
            if pk: o, n_ = pk['tile'][k]; b = gzip.decompress(blob[o:o + n_])
            else: b = gzip.decompress(open(os.path.join(terreno, k + '.bin.gz'), 'rb').read())
            assert b[:4] == b'GTAS'
            _, st_, n = struct.unpack('<BBH', b[4:8]); base, = struct.unpack('<f', b[8:12])
            q = np.frombuffer(b, '<u2', n * n, 12).reshape(n, n); mo = 12 + 2 * n * n
            mm = np.frombuffer(b, np.uint8, (n - 1) ** 2, mo).reshape(n - 1, n - 1) if len(b) >= mo + (n - 1) ** 2 else np.zeros((n - 1, n - 1), np.uint8)
            tiles[tuple(int(v) for v in k.split('_'))] = (st_, (base * 100 + q.astype(np.float64)) / 100, mm)
        s.tiles = tiles
        I = [t[0] for t in tiles]; J = [t[1] for t in tiles]; s.i0, s.j0 = min(I), min(J); i1, j1 = max(I), max(J)
        s.x0, s.z0 = -s.hw + s.i0 * TILE, -s.hh + s.j0 * TILE; s.st = 2.0; nt = int(TILE / s.st)
        s.nx, s.nz = (i1 - s.i0 + 1) * nt + 1, (j1 - s.j0 + 1) * nt + 1
        s.S = np.full((s.nz, s.nx), np.nan); s.M = np.zeros((s.nz - 1, s.nx - 1), np.uint8); s.UD = np.zeros((s.nz - 1, s.nx - 1), bool)
        for (tx, tz), (st, h, mm) in tiles.items():
            r0, c0 = (tz - s.j0) * nt, (tx - s.i0) * nt
            if st != s.st:   # a coarse tile: its triangles on the 2 m lattice
                k = np.arange(nt + 1) * s.st / st; i = np.minimum(k.astype(int), h.shape[0] - 2); u = k - i
                J_, I_ = np.meshgrid(i, i, indexing='ij'); V_, U_ = np.meshgrid(u, u, indexing='ij')
                h00, h10, h01, h11 = h[J_, I_], h[J_, I_ + 1], h[J_ + 1, I_], h[J_ + 1, I_ + 1]
                h = np.where(U_ >= V_, h00 + U_ * (h10 - h00) + V_ * (h11 - h10), h00 + V_ * (h01 - h00) + U_ * (h11 - h01)); mm = np.zeros((nt, nt), np.uint8)
            s.S[r0:r0 + nt + 1, c0:c0 + nt + 1] = h; s.M[r0:r0 + nt, c0:c0 + nt] = mm & 127; s.UD[r0:r0 + nt, c0:c0 + nt] = (mm & 128) > 0
        s.IN = ~np.isnan(s.S); s.G0 = np.nan_to_num(s.S)
        # decks: top at a point (max over the decks that are not a gallery cover)
        s.decks = [d for d in ind.get('decks', []) if d.get('tipo') != 'copertura']
        s._tri, s._ttree, s._did = triangoli_impalcati(s.decks)
        s._tri_nl, s._ttree_nl, _ = triangoli_impalcati(s.decks, liberi=False)   # the decks that do not carry the drawn streets (A3)
        # the drawn surfaces (tiles of brianza.json)
        s.poly = {k: [] for k in ('as', 'pz', 'sd', 'ft', 'cv', 'sf', 'b', 'acqua')}; s.rv, s.rl = [], []
        for ti, T in enumerate(B['tiles']):
            if not T: continue
            for k in ('as', 'pz', 'sd', 'ft', 'cv', 'sf'):
                for a in T.get(k, []):
                    P = Polygon(dec(a['p']), [dec(h) for h in a.get('k', []) if len(h) >= 6])
                    s.poly[k].append(P if P.is_valid else P.buffer(0))
            for a in T.get('b', []):
                o = dec(a['p'])
                if len(o) >= 3: s.poly['b'].append(Polygon(o).buffer(0))
            for a in T.get('a', []):
                if a.get('t') == 6:
                    P = Polygon(dec(a['p']), [dec(h) for h in a.get('k', []) if len(h) >= 6]); s.poly['acqua'].append(P if P.is_valid else P.buffer(0))
            for r in T.get('rv', []): s.rv.append(dict(p=dec(r['p']), w=float(r['w']), e=r.get('e', [0, 0]), t=ti))
            for r in T.get('rl', []): s.rl.append(dec(r['p']))
        s.U = {k: (shapely.union_all(v) if v else Polygon()) for k, v in s.poly.items()}
        for g in s.U.values(): shapely.prepare(g)
        rails = [LineString(p) for p in s.rl if len(p) >= 2]
        s.U['rl'] = shapely.union_all([g.buffer(1.5, cap_style=2) for g in rails]) if rails else Polygon(); shapely.prepare(s.U['rl'])
        s.strade = shapely.union_all([s.U['as'], s.U['pz'], s.U['sf'], s.U['rl']]); shapely.prepare(s.strade)   # what a car or a train runs on
        # the water level as the game reads it (altezze3.js water): the DBGT axes, else the lowest S across an OSM river + 0.3
        P, Z = [], []
        for a in ind.get('acqua', []):
            p = np.asarray(a['p'], float).reshape(-1, 2); zw = np.asarray(a['zw'], float)
            for k in range(1, len(p)):
                L = np.hypot(*(p[k] - p[k - 1])); n = max(1, int(np.ceil(L / 1.0))); t = np.arange(n) / n
                P.append(p[k - 1] + (p[k] - p[k - 1]) * t[:, None]); Z.append(zw[k - 1] + (zw[k] - zw[k - 1]) * t)
        s.acq_p = np.vstack(P) if P else np.zeros((0, 2)); s.acq_z = np.concatenate(Z) if Z else np.zeros(0)
        s.acq_kd = cKDTree(s.acq_p) if len(s.acq_p) else None
        rp, rz, rw = [], [], []
        for r in s.rv:
            p = r['p']
            for k in range(1, len(p)):
                L = np.hypot(*(p[k] - p[k - 1])); n = max(1, int(np.ceil(L / 1.0))); t = np.arange(n + 1) / n
                q = p[k - 1] + (p[k] - p[k - 1]) * t[:, None]; u = (p[k] - p[k - 1]) / max(L, 1e-9); nrm = np.array([-u[1], u[0]])
                Q = q[:, None, :] + np.linspace(-r['w'], r['w'], 9)[None, :, None] * nrm[None, None, :]
                lo = np.nanmin(s.H(Q[..., 0].ravel(), Q[..., 1].ravel()).reshape(Q.shape[:2]), axis=1)
                rp.append(q); rz.append(lo + 0.3); rw.append(np.full(len(q), r['w']))
        s.rv_p = np.vstack(rp) if rp else np.zeros((0, 2)); s.rv_z = np.concatenate(rz) if rz else np.zeros(0); s.rv_w = np.concatenate(rw) if rw else np.zeros(0)
        s.rv_kd = cKDTree(s.rv_p) if len(s.rv_p) else None
        s.log('controlli acqua: %d tile, %d impalcati, %d pezzi di fiume OSM, %d punti d acqua DBGT (%.0f s)' % (len(tiles), len(s.decks), len(s.rv), len(s.acq_p), time.time() - t0))

    # ---- readers, vectorised
    def ij(s, x, z):
        fx, fz = (np.asarray(x, float) - s.x0) / s.st, (np.asarray(z, float) - s.z0) / s.st
        return fx, fz

    def H(s, x, z):   # S as the game draws it (two triangles per cell, diagonal u >= v), NaN outside the tiles
        fx, fz = s.ij(x, z); ok = (fx >= 0) & (fz >= 0) & (fx <= s.nx - 1) & (fz <= s.nz - 1)
        fx, fz = np.clip(fx, 0, s.nx - 1.000001), np.clip(fz, 0, s.nz - 1.000001); i, j = fx.astype(int), fz.astype(int); u, v = fx - i, fz - j
        G = s.S; h00, h10, h01, h11 = G[j, i], G[j, i + 1], G[j + 1, i], G[j + 1, i + 1]
        h = np.where(u >= v, h00 + u * (h10 - h00) + v * (h11 - h10), h00 + v * (h01 - h00) + u * (h11 - h01))
        return np.where(ok, h, np.nan)

    def cella(s, x, z):
        fx, fz = s.ij(x, z); i, j = np.clip(np.floor(fx).astype(int), 0, s.nx - 2), np.clip(np.floor(fz).astype(int), 0, s.nz - 2)
        return j, i

    def mat(s, x, z): j, i = s.cella(x, z); return s.M[j, i]

    def top(s, x, z): return cima_impalcati(s._tri, s._ttree, x, z)   # the highest deck top over the points (NaN where none)

    def deck_id(s, x, z):
        x, z = np.asarray(x, float), np.asarray(z, float); out = np.full(x.shape, -1)
        if s._ttree is None or not len(x): return out
        pi, ti = s._ttree.query(shapely.points(x, z), predicate='intersects'); out[pi] = s._did[ti]
        return out

    def water(s, x, z):   # altezze3.js water(): the DBGT axes within WMAX, else an OSM river within its half width
        x, z = np.asarray(x, float), np.asarray(z, float); w = np.full(x.shape, np.nan); P = np.column_stack((x, z))
        if s.acq_kd is not None:
            d, j = s.acq_kd.query(P, workers=-1); k = d <= WMAX; w[k] = s.acq_z[j[k]]
        if s.rv_kd is not None:
            d, j = s.rv_kd.query(P, workers=-1); k = np.isnan(w) & (d <= s.rv_w[np.minimum(j, len(s.rv_w) - 1)]); w[k] = s.rv_z[j[k]]
        return w


def campioni(g, passo):
    """points every passo m inside the polygon g"""
    if g.is_empty: return np.zeros((0, 2))
    b = g.bounds; xs = np.arange(np.floor(b[0] / passo) * passo + passo / 2, b[2], passo); zs = np.arange(np.floor(b[1] / passo) * passo + passo / 2, b[3], passo)
    out = []
    for z0 in range(0, len(zs), 400):
        X, Z = np.meshgrid(xs, zs[z0:z0 + 400]); X, Z = X.ravel(), Z.ravel(); k = shapely.contains_xy(g, X, Z); out.append(np.column_stack((X[k], Z[k])))
    return np.vstack(out) if out else np.zeros((0, 2))


def zona_acqua(m, extra=3.0):
    """where a watercourse runs: the bed cells of S (material 4), the OSM rivers (half width), the OSM water areas, plus extra m"""
    jj, ii = np.nonzero(m.M == 4)
    cells = [box(m.x0 + i * m.st, m.z0 + j * m.st, m.x0 + (i + 1) * m.st, m.z0 + (j + 1) * m.st) for j, i in zip(jj, ii)]
    g = [shapely.union_all(cells).buffer(extra)] if cells else []
    g += [LineString(r['p']).buffer(r['w'] + extra) for r in m.rv if len(r['p']) >= 2]
    g += [m.U['acqua'].buffer(extra)] if not m.U['acqua'].is_empty else []
    Z = shapely.union_all(g) if g else Polygon(); shapely.prepare(Z); return Z


def a1_acqua_sulle_strade(m, Z, gioco_ringhiere=False):
    """the water the game draws over a carriageway, a rail bed or a track. (a) the sheet at zw over the bed (material 4 cells and the cells
    the flood reaches, at most 6 from the bed, as world3.js), where zw > S; (b) the strip of an OSM river where no bed is near, at H.water;
    (c) the OSM water areas not in the bed"""
    st = m.st; c_ = m.M.shape; out = dict()
    # (a) the sheet, on 4 x 4 points per cell
    bed = (m.M == 4) & m.IN[:-1, :-1] & m.IN[1:, 1:]
    Wn = np.full(m.S.shape, np.nan); near = ndimage.binary_dilation(bed, iterations=7); rr, cc = np.nonzero(np.pad(near, ((0, 1), (0, 1))) | np.pad(near, ((1, 0), (1, 0))))
    Wn[rr, cc] = m.water(m.x0 + cc * st, m.z0 + rr * st)
    under = np.nan_to_num(Wn - m.S, nan=-1) > 0; cw = under[:-1, :-1] | under[:-1, 1:] | under[1:, :-1] | under[1:, 1:]
    dist = np.where(bed, 0, -1); front = bed.copy(); seen = bed.copy()
    for k in range(1, 7):
        grow = ndimage.binary_dilation(front & cw, structure=np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)) & ~seen; seen |= grow; front = grow
    wet_cells = seen
    jj, ii = np.nonzero(wet_cells); u = (np.arange(4) + 0.5) / 4; U, V = np.meshgrid(u, u)
    X = (m.x0 + (ii[:, None] + U.ravel()[None]) * st).ravel(); Zc = (m.z0 + (jj[:, None] + V.ravel()[None]) * st).ravel()
    pts_a = np.zeros((0, 2))
    if len(X):
        on = shapely.contains_xy(m.strade, X, Zc)
        if on.any():
            x, z = X[on], Zc[on]; wl = m.water(x, z); wet = np.nan_to_num(wl - m.H(x, z), nan=-1) > 0
            tp = m.top(x, z); wet &= ~(np.isfinite(tp) & (tp > m.H(x, z) + SOTTO_DK))    # under a deck the street on it is the deck's
            pts_a = np.column_stack((x[wet], z[wet]))
    out['velo_m2'] = round(len(pts_a) * st * st / 16, 1)
    # (b) the OSM strips with no bed near (world3.js bedNear), (c) the OSM water areas outside the bed
    strips = []
    for r in m.rv:
        p = r['p']
        for k in range(1, len(p)):
            a, c = p[k - 1], p[k]; L = np.hypot(*(c - a))
            if L < 0.05: continue
            n = np.array([-(c[1] - a[1]), c[0] - a[0]]) / L; mid = (a + c) / 2
            probes = np.array([mid, mid + n * r['w'] * 0.5, mid - n * r['w'] * 0.5, mid + (c - a) / 2])
            if (m.mat(probes[:, 0], probes[:, 1]) == 4).any() and np.isfinite(m.H(*mid[:, None])).all(): continue
            if not gioco_ringhiere and shapely.dwithin(m.strade, Point(mid), r['w']): continue   # world3.js: never on a street (fiumi-ponti)
            strips.append(Polygon([a - n * r['w'], a + n * r['w'], c + n * r['w'], c - n * r['w']]))
    S_ = shapely.union_all(strips) if strips else Polygon()
    ib = shapely.intersection(S_, m.strade) if not S_.is_empty else Polygon()
    out['strisce_osm_m2'] = round(ib.area, 1)
    ac = m.U['acqua']; ia = shapely.intersection(ac, m.strade) if not ac.is_empty else Polygon(); out['aree_osm_m2'] = round(ia.area, 1)
    pts = [pts_a] + [campioni(g, 0.5) for g in (ib, ia) if not g.is_empty]
    P = np.vstack(pts) if pts else np.zeros((0, 2))
    out['totale_m2'] = round(out['velo_m2'] + out['strisce_osm_m2'] + out['aree_osm_m2'], 1)
    out['luoghi'] = luoghi(P, 3.0); out['n_luoghi'] = len(luoghi(P, 3.0, n=0))
    return out, P


def a2_sfondate(m, Z):
    """points of a carriageway, a rail bed or a track (every 0.5 m) over a watercourse whose S stands more than SFONDO under the road
    around (the median of S on the same streets 2-10 m away, off the water), not where a deck carries the street"""
    zona = shapely.intersection(m.strade, Z)
    P = campioni(zona, 0.5)
    if not len(P): return dict(punti=0, luoghi=[], n_luoghi=0), P
    h = m.H(P[:, 0], P[:, 1]); tp = m.top(P[:, 0], P[:, 1]); ok = np.isfinite(h) & ~(np.isfinite(tp) & (tp > h + SOTTO_DK)); P, h = P[ok], h[ok]
    ring = shapely.difference(shapely.intersection(m.strade, Z.buffer(10.0)), Z)
    R = campioni(ring, 1.0); hr = m.H(R[:, 0], R[:, 1]); tr = m.top(R[:, 0], R[:, 1]); okr = np.isfinite(hr) & ~(np.isfinite(tr) & (tr > hr + SOTTO_DK)); R, hr = R[okr], hr[okr]
    if not len(R): return dict(punti=0, luoghi=[], n_luoghi=0), np.zeros((0, 2))
    kd = cKDTree(R); ref = np.full(len(P), np.nan)
    for k, nb in enumerate(kd.query_ball_point(P, 10.0)):
        if len(nb) >= 3: ref[k] = np.median(hr[nb])
    drop = ref - h; bad = np.nan_to_num(drop) > SFONDO
    # the samples within 1 m of the edge of the streets, by a channel that runs beside them: the cell of the 2 m lattice the edge crosses
    # slopes from the street down to the bed (no vertical wall on the lattice); counted apart
    bordo = ~shapely.contains_xy(m.strade.buffer(-1.0), P[:, 0], P[:, 1])
    Q = P[bad & ~bordo]; v = drop[bad & ~bordo]
    return dict(punti=int(len(Q)), m2=round(len(Q) * 0.25, 1), abbassamento=pct(v), luoghi=luoghi(Q, 3.0, v), n_luoghi=len(luoghi(Q, 3.0, v, n=0)), punti_controllati=int(len(P)),
                bordo_punti=int((bad & bordo).sum()), bordo_luoghi=len(luoghi(P[bad & bordo], 3.0, n=0))), Q


def a3_dipinte_sotto(m):
    """cells of the tiles whose middle is in a drawn street surface (asphalt, squares, sidewalks, footways, yards) under a deck standing
    more than SOTTO_DK over S (not a free deck: the game lifts the streets onto those), where S there is not a road or sidewalk at its own level (material 1, 2): the paint of the street above on
    the ground below. 'dipinte' leaves out the cells terreno_gioco.py marks (the game paints nothing there)"""
    seg = shapely.union_all([m.U[k] for k in ('as', 'pz', 'sd', 'ft', 'cv')]); shapely.prepare(seg)
    jj, ii = np.nonzero(m.IN[:-1, :-1] & m.IN[1:, 1:]); x, z = m.x0 + (ii + 0.5) * m.st, m.z0 + (jj + 0.5) * m.st
    tp = cima_impalcati(m._tri_nl, m._ttree_nl, x, z); k = np.isfinite(tp); x, z, jj, ii, tp = x[k], z[k], jj[k], ii[k], tp[k]
    h = m.H(x, z); k = (tp > h + SOTTO_DK) & ~np.isin(m.M[jj, ii], STRADA_MAT); x, z, jj, ii = x[k], z[k], jj[k], ii[k]
    on = shapely.contains_xy(seg, x, z); dk = m.deck_id(x, z)
    tutte = on; dip = on & ~m.UD[jj, ii]
    seg_mk = int(m.UD.sum())
    P = np.column_stack((x[dip], z[dip]))
    return dict(celle_sotto_impalcati_con_strada_disegnata=int(tutte.sum()), dipinte=int(dip.sum()), m2=round(float(dip.sum()) * m.st * m.st, 1),
                impalcati=sorted(set(int(d) for d in dk[dip])), impalcati_prima_della_regola=sorted(set(int(d) for d in dk[tutte])), celle_segnate_sotto_impalcato=seg_mk,
                luoghi=luoghi(P, 4.0)), P


def a4_parapetti(m, gioco_ringhiere=False, lid=None):
    """river railings and culvert mouths as world3.js draws them in the tiles of S. gioco_ringhiere: the game still draws a railing along
    every OSM river (before this work); now none: the banks and walls are the DBGT's and OSM's barriers. Mouths: an end of an OSM river
    piece (e) where the ground over the culvert stands 0.6 m over the bed; 'lontane' those away from a street or a track (4 m plus a 2:3
    embankment down to the bed) or halfway up a slope (bed more than 1 m over the bottom of the valley)"""
    near = shapely.union_all([m.strade.buffer(15.0), m.U['b'].buffer(15.0)]) if not m.strade.is_empty else Polygon(); shapely.prepare(near)
    lung, bosco = 0.0, 0.0
    strade15 = m.strade.buffer(1.5); shapely.prepare(strade15)
    if gioco_ringhiere:
        for r in m.rv:
            p = r['p']
            for k in range(1, len(p)):
                a, c = p[k - 1], p[k]; L = np.hypot(*(c - a))
                if L < 0.05 or not np.isfinite(m.H(*((a + c) / 2)[:, None])).all(): continue
                n = np.array([-(c[1] - a[1]), c[0] - a[0]]) / L
                for sd in (1, -1):
                    mx, mz = (a + c) / 2 + n * r['w'] * sd
                    if shapely.contains_xy(strade15, mx, mz): continue
                    lung += L
                    if not shapely.contains_xy(near, mx, mz): bosco += L
    bocche, lontane = 0, []
    strade4 = m.strade.buffer(4.0); shapely.prepare(strade4)
    for r in m.rv:
        p = r['p']
        for ei, (E, F) in enumerate(((p[0], p[1]), (p[-1], p[-2]))):
            if not r['e'][ei] or not np.isfinite(m.H(E[0:1], E[1:2])).all(): continue
            L = np.hypot(*(F - E)) or 1; u = (F - E) / L; n = np.array([-u[1], u[0]]); W = r['w'] + 0.3
            q = np.linspace(-1, 1, 9); ys = m.H(E[0] + n[0] * W * q, E[1] + n[1] * W * q); lo, hi = np.nanmin(ys), np.nanmax(ys)
            topv = max(hi, float(m.H(E[0:1] - u[0] * 3, E[1:2] - u[1] * 3)[0]))
            if topv - lo < 0.6: continue
            bocche += 1
            # far from a street: more than 4 m plus the run of a 2:3 embankment down from the street to the bed (a mouth at the foot of a
            # high embankment stands well out from the asphalt), or halfway up the slope: the bed more than 1 m over the bottom of the valley
            if not m.strade.is_empty:
                q_ = shapely.ops.nearest_points(m.strade, Point(E))[0]; hs = float(m.H(np.array([q_.x]), np.array([q_.y]))[0]); dd = q_.distance(Point(E))
                lontana = dd > 4.0 + 1.5 * max(0.0, (hs if np.isfinite(hs) else lo) - lo)
            else: lontana = True
            if lid is not None:
                _, lb, _ = fondo_valle(lid, np.array([E, E + u]), r['w']); lontana |= lo - lb[0] > 1.0
            if lontana: lontane.append(E)
    return dict(ringhiere_m=round(lung), ringhiere_in_bosco_o_campagna_m=round(bosco), bocche_di_tombino=bocche, bocche_lontane_da_strade=len(lontane),
                luoghi_bocche_lontane=[dict(x=round(float(e[0]), 1), z=round(float(e[1]), 1), link=link(*e)) for e in lontane[:12]])


def fondo_valle(lid, p, w, R=15.0):
    """for points p of a stream line: (L at the point, lowest L across within R, its offset) on the LiDAR (1 m), profiles square to the line"""
    t = np.gradient(p, axis=0); t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]; n = np.column_stack((-t[:, 1], t[:, 0]))
    offs = np.arange(-R, R + 0.5, 1.0); Q = p[:, None, :] + offs[None, :, None] * n[:, None, :]
    L = lid.at(Q[..., 0].ravel(), Q[..., 1].ravel()).reshape(Q.shape[:2])
    Ls = ndimage.uniform_filter1d(np.nan_to_num(L, nan=1e4), 3, axis=1, mode='nearest')
    j = np.argmin(Ls, axis=1); c = len(offs) // 2
    return Ls[:, c], Ls[np.arange(len(p)), j], offs[j]


def a5_fondo_valle(m, lid):
    """OSM stream pieces in the tiles of S: points every 2 m whose LiDAR stands more than FONDO over the bottom of
    the valley across (within 15 m) and that bottom more than the half width off the line"""
    tot, lon, P, V = 0.0, 0.0, [], []
    for r in m.rv:
        p = r['p']
        if len(p) < 2: continue
        Lg = LineString(p); n = max(2, int(Lg.length / 2.0) + 1); q = np.array([Lg.interpolate(t, normalized=True).coords[0] for t in np.linspace(0, 1, n)])
        ok = np.isfinite(m.H(q[:, 0], q[:, 1]))
        if ok.sum() < 2: continue
        lp, lb, off = fondo_valle(lid, q, r['w'])
        far = ok & (lp - lb > FONDO) & (np.abs(off) > r['w'])
        seg = Lg.length / (n - 1); tot += ok.sum() * seg; lon += far.sum() * seg
        P.append(q[far]); V.append((lp - lb)[far])
    P = np.vstack(P) if P else np.zeros((0, 2)); V = np.concatenate(V) if V else np.zeros(0)
    return dict(metri_controllati=round(tot), metri_lontani_dal_fondo=round(lon), sopra_il_fondo=pct(V), luoghi=luoghi(P, 6.0, V), n_luoghi=len(luoghi(P, 6.0, V, n=0))), P


def assi_tombinati():
    """the DBGT axes of kind 03 (fittizio: "sotterraneo o tombinato") of every comune in data/dbt, game metres"""
    import sqlite3, dbgt_quote as dq
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True); out = []
    base = os.path.join(dq.DATA, 'dbt')
    for c in sorted(os.listdir(base)) if os.path.isdir(base) else []:
        f = os.path.join(base, c, 'dbgt.gpkg')
        if not os.path.exists(f): continue
        con = sqlite3.connect(f); L = dq._read_layer(con, tr, *dq.LAYERS['EL_IDR']); con.close()
        if L is None: continue
        for i in range(len(L['off']) - 1):
            a, b = L['off'][i], L['off'][i + 1]
            if L['attr']['ty'][i] == '03' and b - a >= 2: out.append((c, LineString(L['xy'][a:b])))
    return out


def a6_tombini_sotto_strade(m):
    """where a covered watercourse (EL_IDR 03) passes under a drawn carriageway or a track: points every 0.5 m on the streets within 3 m
    of the axis, S there against the median of S on the same streets 4-10 m off the axis. A crossing is 'sfondato' when a point stands more than SFONDO under
    (the old viale Francia: carriageway at 29.6, bed at 26.1 right on the street). Decks that carry the street leave the point out"""
    try: assi = assi_tombinati()
    except Exception as e: return dict(errore=str(e)), np.zeros((0, 2))
    inc, bad_all = [], []
    for c, g in assi:
        x = shapely.intersection(g, m.strade)
        if x.is_empty: continue
        for part in getattr(x, 'geoms', [x]):
            if part.geom_type != 'LineString' or part.length < 1.0: continue
            q = campioni(shapely.intersection(part.buffer(3.0), m.strade), 0.5)   # the culvert as wide as a canal (3 m each side of the axis), on the streets
            if not len(q): continue
            h = m.H(q[:, 0], q[:, 1]); tp = m.top(q[:, 0], q[:, 1])
            ok = np.isfinite(h) & ~(np.isfinite(tp) & (tp > h + SOTTO_DK))
            if not ok.any(): continue
            ring = shapely.difference(shapely.intersection(m.strade, part.buffer(10.0)), part.buffer(4.0)); R = campioni(ring, 1.0)
            if len(R) < 3: continue
            hr = m.H(R[:, 0], R[:, 1]); ref = float(np.nanmedian(hr))
            drop = ref - h[ok]; k = drop > SFONDO; mid = q[len(q) // 2]
            inc.append(dict(comune=c, x=round(float(mid[0]), 1), z=round(float(mid[1]), 1), m=round(part.length, 1), strada=round(ref, 2), S_min=round(float(np.nanmin(h[ok])), 2), sfondato=bool(k.any()), link=link(*mid)))
            if k.any(): bad_all.append(q[ok][k])
    B = np.vstack(bad_all) if bad_all else np.zeros((0, 2))
    sf = [i for i in inc if i['sfondato']]
    return dict(incroci=len(inc), sfondati=len(sf), punti_sfondati=int(len(B)), luoghi_sfondati=sf[:20], incroci_elenco=inc[:60]), B


# ---- the fixed tests: Carlo's reports (todo.md, 25/10 sera) with what is expected there
PROVE = [
    dict(nome='viale Francia, strada e ferrovia sul fiume', box=(206, -406, 230, -370), tipo='sfondata',
         attese='nessun punto di carreggiata o binario piu di 1 m sotto la strada intorno; S(216,-377) e S(222,-392) alla quota della via (Carlo: alveo a 26,1 e 28,1 m)', punti=[(216, -377), (222, -392)]),
    dict(nome='via Maroncelli, carreggiata dipinta sotto il cavalcavia', box=(1385, 445, 1440, 500), tipo='dipinta',
         attese='nessuna cella di asfalto, marciapiede o piazza dipinta sul suolo sotto l impalcato'),
    dict(nome='Campaccio, torrente a mezza costa', box=(-30, -1900, 80, -1820), tipo='valle',
         attese='il torrente OSM entro 1 m dal fondo della valle del LiDAR; nessuna ringhiera; nessuna bocca di tombino lontana dalla strada'),
    dict(nome='via Varese al Campaccio, acqua sopra l incrocio', box=(540, -1760, 590, -1715), tipo='acqua',
         attese='nessuna acqua disegnata sopra la carreggiata; nessuna bocca di tombino sulla carreggiata'),
]


def prove_fisse(m, lid, P1, P2, P3, P5, rep):
    out = []
    for pr in PROVE:
        bx = box(*pr['box']); r = dict(nome=pr['nome'], attese=pr['attese'], link=link(*np.asarray(bx.centroid.coords[0])))
        inb = lambda P: int(shapely.contains_xy(bx, P[:, 0], P[:, 1]).sum()) if len(P) else 0
        if pr['tipo'] == 'sfondata':
            r['punti_sfondati'] = inb(P2); r['quote'] = []
            for x, z in pr['punti']:
                # the road there: the median of S on the streets within 6 m (off the water)
                h = float(m.H(np.array([x]), np.array([z]))[0]); R_ = campioni(m.strade.intersection(Point(x, z).buffer(6.0)), 0.5); hr = m.H(R_[:, 0], R_[:, 1]) if len(R_) else np.zeros(0)
                r['quote'].append(dict(x=x, z=z, S=round(h, 2), strada_intorno=round(float(np.nanmedian(hr)), 2) if len(hr) else None))
            r['ok'] = r['punti_sfondati'] == 0 and all(q['strada_intorno'] is None or q['S'] > q['strada_intorno'] - SFONDO for q in r['quote'])
        elif pr['tipo'] == 'dipinta':
            r['celle_dipinte'] = inb(P3); r['ok'] = r['celle_dipinte'] == 0
        elif pr['tipo'] == 'valle':
            far = inb(P5)
            bo = [c for c in rep['A4']['luoghi_bocche_lontane'] if bx.contains(Point(c['x'], c['z']))]
            r['punti_lontani_dal_fondo'] = far; r['bocche_lontane'] = len(bo); r['ringhiere_m'] = rep['A4']['ringhiere_m']
            r['ok'] = not far and not bo and rep['A4']['ringhiere_m'] == 0
        elif pr['tipo'] == 'acqua':
            r['punti_acqua_su_strada'] = inb(P1); r['ok'] = r['punti_acqua_su_strada'] == 0
        out.append(r)
    return out


def controlla(terreno, dati, out=None, log=print, ringhiere=None):
    t0 = time.time(); m = Mondo(terreno, dati, log)
    import dbgt_quote as dq
    lid = dq.Lidar()
    Z = zona_acqua(m)
    rep = {}
    if ringhiere is None:   # does the game in this checkout still draw a railing along every OSM river? (world3.js, RIVER_RAIL: before fiumi-ponti)
        try: ringhiere = 'RIVER_RAIL = false' not in open(os.path.join(HERE, 'world3.js'), encoding='utf-8').read()
        except OSError: ringhiere = False
    rep['A1'], P1 = a1_acqua_sulle_strade(m, Z, ringhiere)
    rep['A2'], P2 = a2_sfondate(m, Z)
    rep['A3'], P3 = a3_dipinte_sotto(m)
    rep['A4'] = a4_parapetti(m, ringhiere, lid)
    rep['A5'], P5 = a5_fondo_valle(m, lid)
    rep['A6'], P6 = a6_tombini_sotto_strade(m)
    rep['prove_fisse'] = prove_fisse(m, lid, P1, P2, P3, P5, rep)
    rep['sintesi'] = dict(acqua_sulle_strade_m2=rep['A1']['totale_m2'], acqua_sulle_strade_luoghi=rep['A1']['n_luoghi'], strade_sfondate_punti=rep['A2']['punti'], strade_sfondate_luoghi=rep['A2']['n_luoghi'], strade_sfondate_bordo_punti=rep['A2']['bordo_punti'],
                          dipinte_sotto_impalcati_celle=rep['A3']['dipinte'], dipinte_sotto_impalcati_ponti=len(rep['A3']['impalcati']), ringhiere_m=rep['A4']['ringhiere_m'], ringhiere_in_bosco_m=rep['A4']['ringhiere_in_bosco_o_campagna_m'],
                          bocche_lontane_da_strade=rep['A4']['bocche_lontane_da_strade'], acqua_lontana_dal_fondo_m=rep['A5']['metri_lontani_dal_fondo'], acqua_lontana_dal_fondo_luoghi=rep['A5']['n_luoghi'], tombini_sotto_strade=rep['A6'].get('incroci'), tombini_sotto_strade_sfondati=rep['A6'].get('sfondati'),
                          prove_fisse_ok='%d su %d' % (sum(1 for p in rep['prove_fisse'] if p['ok']), len(rep['prove_fisse'])), tempo_s=round(time.time() - t0, 1))
    log('controlli acqua: %s' % rep['sintesi'])
    for p in rep['prove_fisse']: log('  prova fissa %s: %s' % (p['nome'], 'ok' if p['ok'] else 'NO ' + json.dumps({k: v for k, v in p.items() if k not in ('nome', 'attese', 'ok')}, ensure_ascii=False)[:300]))
    if out: json.dump(rep, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=float)
    return rep


if __name__ == '__main__':
    ap = argparse.ArgumentParser(description='Controlli dell acqua e dei ponti (A1-A6 e prove fisse)')
    ap.add_argument('--terreno', default=os.path.join(ROOT, 'terreno')); ap.add_argument('--dati', default=os.path.join(ROOT, 'brianza.json'))
    ap.add_argument('--out', default=None); ap.add_argument('--ringhiere', choices=('si', 'no'), default=None)
    a = ap.parse_args()
    controlla(a.terreno, a.dati, a.out, ringhiere=None if a.ringhiere is None else a.ringhiere == 'si')
