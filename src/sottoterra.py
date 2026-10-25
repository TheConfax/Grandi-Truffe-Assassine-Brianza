# Sotto terra, tappa 1 (docs/sottoterra.md): one analysis of the closed depressions of the LiDAR DTM (2008) against the DBGT (2015), OSM and
# what was looked at on the orthophoto 2018-19 (src/sottoterra.json). Two outcomes, in one pass:
#   - buche irragionevoli: a pit of the LiDAR where the DBGT 2015 has the ground at street level (a surface with its Z well over the LiDAR)
#     or a building the DSM 2008 did not see (built after the flight). There the LiDAR is older than what stands there now: the base terrain L
#     of superficie.py is filled (a harmonic membrane through the DBGT heights and the rim), so the DBGT wins and the "tetto" no longer pulls
#     it back down. Not near rivers, bridges, the gallery, the railway, nor where the DBGT itself is down in the pit (trenches, underpasses,
#     sunken yards the DBGT draws at their bottom).
#   - rampe: a pit shaped like a ramp (narrow, deepening steadily from one end), confirmed by a second source (a DBGT underground volume
#     UN_VOL_POR 08 at its deep end, an OSM underground parking or entrance, or the orthophoto / Carlo in sottoterra.json) and attached to a
#     passo carraio of the DBGT. S gets the ground over it (filled like a buca) and the ramp becomes an object of terreno/indice.json `pits`:
#     a strip along the centre line of the pit (its curve, its slope), walls down from S to the floor, a parapet, a closed door at the end.
#   - dubbi: ramp-shaped pits with only the LiDAR, or without a passo carraio, or looked at and not clear: left as they are and listed.
# Used by superficie.py (analizza() after strade(), before tetto(); fosse() at the end) and run alone for the list:
#   python src/sottoterra.py [--out DIR]       (writes sottoterra_casi.json there: every pit with its sources and outcome)
import os, sys, json, time, pickle, argparse, sqlite3
import xml.etree.ElementTree as ET
import numpy as np, shapely
from shapely.geometry import Polygon, LineString, Point, box
from scipy import ndimage, sparse
from scipy.spatial import cKDTree
import scipy.sparse.linalg
from skimage.morphology import reconstruction
from skimage.graph import MCP_Geometric
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq
from dbgt_quote import DATA, KX, KZ, LAT0, LON0

# --- buche (2 m lattice of S)
B_CORE = 1.0      # a pit: nodes this far under the spill point of the filled DTM (2 m means)...
B_NODI = 3        # ... at least this many of them (12 m2)
B_REG = 0.25      # the filled region: the nodes of the basin this far under the spill point, around the core
B_ALTO = 1.0      # the DBGT says "street level": its surface this much over the LiDAR (median over the pit)
B_FRAZ = 0.5      # ... over at least this share of the pit, counting the buildings the DSM 2008 did not see
B_BASSO = 1.0     # the DBGT down in the pit (its surface within this of the LiDAR) on this share: the pit is real (trench, underpass, yard)
B_NUOVO = 2.0     # a building over a node is new (after 2008) where DSM - DTM there is under this
B_FIUME, B_PONTE = 6.0, 12.0   # no buca within this of a river bed, of a bridge or the gallery
# --- rampe (1 m lattice of the LiDAR)
R_CORE, R_REG = 1.0, 0.3   # the pit at 1 m: deeper than R_CORE, its region down to R_REG around it
R_AREA = 15.0     # m2 of the core
R_LARGA = 9.0     # a ramp is at most this wide (short side of the rotated rectangle of the core) ...
R_GRANDE = 400.0  # ... and at most this big
R_R2 = 0.45       # depth against the distance along the pit from its head: this well fitted by a line ...
R_PEND = (0.05, 0.35)   # ... with this slope ...
R_SALTO = 1.0     # ... and at least this much deeper at the far end
R_PC = 25.0       # a passo carraio within this of the head: the ramp is attached to it
R_V08 = 8.0       # a DBGT underground volume this close to the pit confirms it
R_OSM = 25.0      # an OSM underground parking or entrance this close confirms it
R_VISTA = 8.0     # a case of sottoterra.json this close to the pit is the same pit
W_MIN, W_MAX = 3.0, 6.5   # width of the drawn ramp
PEND_MAX = 0.25   # the drawn floor is never steeper than this
PORTA_H = 2.4     # the door at the end (closed): this high, a lintel above it up to the ground
LISCIA = 1.5      # the centre line is smoothed over this (m)


def log_(*a): print('%5.1fs' % (time.time() - T0), 'sottoterra:', *a, flush=True)
T0 = time.time()


# ---------- the LiDAR on its own lattice (pixel centres, 1 m) ----------
class Mosaico:
    """DTM and DSM of the LiDAR over a box of game metres on the native pixel lattice (EPSG:4326, axis aligned with the game frame)."""
    def __init__(s, box_, lid=None, dsm=None):
        s.lid = lid or dq.Lidar(); s.dsm_ = dsm or dq.Lidar(os.path.join(DATA, 'terreno', 'lidar_dsm'))
        L = s.lid; s.px, s.pz = L.sx * KX, L.sy * KZ
        s.xc0, s.zc0 = (L.lon0 - LON0) * KX, (LAT0 - L.lat0) * KZ
        x0, z0, x1, z1 = box_
        s.ca, s.cb = int(np.floor((x0 - s.xc0) / s.px)), int(np.ceil((x1 - s.xc0) / s.px)) + 1
        s.ra, s.rb = int(np.floor((z0 - s.zc0) / s.pz)), int(np.ceil((z1 - s.zc0) / s.pz)) + 1
        s.dtm = s._mos(L); s.dsm = s._mos(s.dsm_)
        for t in L.t + s.dsm_.t: t['a'] = None   # the tiles are read again if asked: 54 of each kept in memory are 1 GB
        assert (s.dsm_.sx, s.dsm_.sy, s.dsm_.lon0, s.dsm_.lat0) == (L.sx, L.sy, L.lon0, L.lat0), 'DSM e DTM su reticoli diversi'

    def _mos(s, L):
        M = np.full((s.rb - s.ra, s.cb - s.ca), np.nan, np.float32)
        for t in L.t:
            r0, c0 = t['r0'] - s.ra, t['c0'] - s.ca; r1, c1 = r0 + t['h'], c0 + t['w']
            if r1 <= 0 or c1 <= 0 or r0 >= M.shape[0] or c0 >= M.shape[1]: continue
            a = L._arr(t); sr, sc = max(0, -r0), max(0, -c0); er, ec = min(t['h'], M.shape[0] - r0), min(t['w'], M.shape[1] - c0)
            M[r0 + sr:r0 + er, c0 + sc:c0 + ec] = a[sr:er, sc:ec]
        return M

    def xz(s, r, c): return s.xc0 + (np.asarray(c) + s.ca) * s.px, s.zc0 + (np.asarray(r) + s.ra) * s.pz
    def rc(s, x, z): return (np.asarray(z) - s.zc0) / s.pz - s.ra, (np.asarray(x) - s.xc0) / s.px - s.ca

    def at(s, A, x, z):  # bilinear on the pixel centres of array A
        r, c = s.rc(x, z); r0 = np.clip(np.floor(r).astype(int), 0, A.shape[0] - 2); c0 = np.clip(np.floor(c).astype(int), 0, A.shape[1] - 2)
        fr, fc = np.clip(r - r0, 0, 1), np.clip(c - c0, 0, 1)
        return (A[r0, c0] * (1 - fr) * (1 - fc) + A[r0, c0 + 1] * (1 - fr) * fc + A[r0 + 1, c0] * fr * (1 - fc) + A[r0 + 1, c0 + 1] * fr * fc)


def riempi(A):  # depth of the closed depressions: the array filled up to its spill points (morphological reconstruction) minus itself
    B = np.where(np.isnan(A), np.nanmax(A), A).astype(np.float64)
    seed = B.copy(); seed[1:-1, 1:-1] = B.max()
    F = reconstruction(seed, B, method='erosion').astype(np.float32); return F, (F - B).astype(np.float32)


def raster(geoms, X, Z):  # mask of the points inside any of the geometries
    m = np.zeros(X.shape, bool)
    if not geoms: return m
    t = shapely.STRtree(geoms); b = box(X.min(), Z.min(), X.max(), Z.max())
    for j in t.query(b):
        g = geoms[j]; x0, z0, x1, z1 = g.bounds
        k = (X >= x0) & (X <= x1) & (Z >= z0) & (Z <= z1)
        if k.any(): m[k] |= shapely.contains_xy(g, X[k], Z[k])
    return m


# ---------- the other sources ----------
def dbgt_extra(gpkg):
    """ACC_PC (passi carrai), UN_VOL_POR 08 (underground volumes), EDI_MIN (minor buildings: box, sheds) of the DBGT, game metres."""
    con = sqlite3.connect(gpkg); tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
    A = dq._read_layer(con, tr, 'ACC_PC_ACC_PC_POS', 'punto', {})
    V = dq._read_layer(con, tr, 'UN_VOL', 'area', {'por': 'UN_VOL_POR'})
    M = dq._read_layer(con, tr, 'EDI_MIN_CR_EDF_IS', 'area', {})
    con.close()
    pol = lambda L, i: (lambda g: g if g.is_valid else g.buffer(0))(dq.poligono(L, i))
    v08 = [pol(V, i) for i in range(len(V['off']) - 1) if V['attr']['por'][i] == '08'] if V is not None else []
    emin = [pol(M, i) for i in range(len(M['off']) - 1)] if M is not None else []
    return dict(acc=A['xy'] if A is not None else np.zeros((0, 2)), v08=v08, emin=emin)


def osm_sotto(path, area, cache=None):
    """OSM underground parkings and parking entrances (and garage entrances) inside `area`: [(kind, geometry)]"""
    if cache and os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(path):
        return [(k, shapely.from_wkb(b)) for k, b in pickle.load(open(cache, 'rb'))]
    x0, z0, x1, z1 = area.bounds; lo0, la1 = dq.game_to_lonlat(x0, z0); lo1, la0 = dq.game_to_lonlat(x1, z1)
    nodes, out = {}, []
    def kind(t):
        if t.get('parking') == 'underground' or (t.get('amenity') == 'parking' and str(t.get('layer', '0')).startswith('-')): return 'parcheggio interrato'
        if t.get('amenity') == 'parking_entrance': return 'ingresso parcheggio'
        if t.get('entrance') == 'garage' or t.get('door') == 'garage' or t.get('ramp') not in (None, 'no'): return 'ingresso garage'
        return None
    for ev, el in ET.iterparse(path):
        if el.tag == 'node':
            lat, lon = float(el.get('lat')), float(el.get('lon'))
            if la0 - 0.001 <= lat <= la1 + 0.001 and lo0 - 0.001 <= lon <= lo1 + 0.001:
                p = dq.to_game_lonlat(lon, lat); nodes[el.get('id')] = p
                t = {c.get('k'): c.get('v') for c in el.iter('tag')}; k = kind(t) if t else None
                if k: out.append((k, Point(p)))
            el.clear()
        elif el.tag == 'way':
            t = {c.get('k'): c.get('v') for c in el.iter('tag')}; k = kind(t)
            if k:
                p = [nodes[c.get('ref')] for c in el.iter('nd') if c.get('ref') in nodes]
                if len(p) >= 4 and p[0] == p[-1]: out.append((k, Polygon(p).buffer(0)))
                elif len(p) >= 2: out.append((k, LineString(p)))
            el.clear()
        elif el.tag == 'relation': el.clear()
    out = [(k, g) for k, g in out if g.intersects(area)]
    if cache: pickle.dump([(k, shapely.to_wkb(g)) for k, g in out], open(cache, 'wb'))
    return out


def edifici_gioco(sup):
    """the footprints of the buildings brianza.json gives the game (DBGT volumes and OSM) near the comune, not the raised ones (porticos,
    passages: one drives under them)"""
    bj = os.path.join(HERE, '..', 'brianza.json')
    if not os.path.exists(bj): return []
    import superficie as sf
    B = json.load(open(bj, encoding='utf-8')); m = B['meta']; ntx = m['ntx']; x0, z0, x1, z1 = sup.conf.buffer(60).bounds; out = []
    dec = lambda a: np.cumsum(np.asarray(a, float).reshape(-1, 2), axis=0) / 10
    for ti, T in enumerate(B['tiles']):
        if not T or not T.get('b'): continue
        bx, bz = -m['hw'] + (ti % ntx) * sf.TILE, -m['hh'] + (ti // ntx) * sf.TILE
        if bx > x1 or bx + sf.TILE < x0 or bz > z1 or bz + sf.TILE < z0: continue
        for b in T['b']:
            if 'zb' in b: continue
            o = dec(b['p'])
            if len(o) >= 3:
                g = Polygon(o); out.append(g if g.is_valid else g.buffer(0))
    return out


def viste(path=None):
    f = path or os.path.join(HERE, 'sottoterra.json')
    return json.load(open(f, encoding='utf-8')).get('viste', []) if os.path.exists(f) else []


def spina(op, D, Z, head, pix, fondo=False):
    """the centre line of a pit: from the shallow head to the open pixel farthest along the pit, staying in the middle (cost 1/(distance
    to the edge)); dict(r, c pixel path, s distance along it, z the DTM on it, w the width there), or None when too short"""
    edt = ndimage.distance_transform_edt(op)
    g = MCP_Geometric(np.where(op, 1.0, np.inf)); dist, _ = g.find_costs([head])
    dist = np.where(op & np.isfinite(dist), dist, -1)
    far = np.unravel_index(np.argmax(dist), dist.shape)
    if dist[far] * pix < 4: return None
    # the end: the farthest open pixel (the shape of the pit); for the drawing (fondo) the deepest one at least 4 m from the head, where the ramp goes under
    dd = np.where(dist * pix >= 4, D, -1); tail = np.unravel_index(np.argmax(dd), dd.shape) if fondo and dd.max() > 0 else far
    m = MCP_Geometric(np.where(op, 1.0 / (edt + 0.5) ** 2 + 0.05, np.inf)); m.find_costs([head], [tail]); path = np.array(m.traceback(tail))
    rr, cc = path[:, 0], path[:, 1]
    sv = np.concatenate(([0.0], np.cumsum(np.hypot(np.diff(rr), np.diff(cc))))) * pix
    return dict(r=rr, c=cc, s=sv, z=Z[rr, cc].astype(float), w=2 * edt[rr, cc] * pix, d=D[rr, cc])


# ---------- the analysis ----------
class Sottoterra:
    def __init__(s, sup, log=log_):
        s.sup, s.log = sup, log; s.rep = {}

    # ----- 1 m: the pits of the DTM, the ramp candidates and their sources
    def fosse_1m(s):
        t0 = time.time(); sup = s.sup; conf = sup.conf
        b = conf.buffer(40).bounds; s.M = M = Mosaico(b, lid=sup.lid)
        s.F1, s.D1 = riempi(M.dtm)
        s.ex = dbgt_extra(sup.gpkg)
        s.osm = osm_sotto(os.path.join(DATA, 'osm', 'maplarge.osm'), conf.buffer(60), getattr(s, 'cache_osm', None))
        s.edifici = list(sup.edifici) + s.ex['emin'] + edifici_gioco(sup)   # what the game draws too (brianza.json): the ramp keeps off its walls
        s.vis = viste()
        cores, n = ndimage.label(s.D1 > R_CORE, np.ones((3, 3), bool))
        pa = M.px * M.pz; out = []
        objs = ndimage.find_objects(cores)
        shapely.prepare(conf)
        acc = s.ex['acc']; s.acck = cKDTree(acc); v08t = shapely.STRtree(s.ex['v08']) if s.ex['v08'] else None
        osmg = [g for _, g in s.osm]; osmt = shapely.STRtree(osmg) if osmg else None
        for k, sl in enumerate(objs):
            m = cores[sl] == k + 1; a = m.sum() * pa
            if a < R_AREA: continue
            rr, cc = np.nonzero(m); rr, cc = rr + sl[0].start, cc + sl[1].start
            X, Z = M.xz(rr, cc)
            if not shapely.contains_xy(conf, X.mean(), Z.mean()): continue
            d = s.D1[rr, cc]
            if d.max() < 1.5: continue
            out.append(dict(k=k + 1, sl=sl, area=round(float(a), 1), cx=round(float(X.mean()), 1), cz=round(float(Z.mean()), 1), dmax=round(float(d.max()), 2)))
        s.cores = cores; s.pits1 = out
        s.log('fosse a 1 m: %d (nucleo oltre %.1f m, almeno %.0f m2, profonde almeno 1,5 m), %.0f s' % (len(out), R_CORE, R_AREA, time.time() - t0))
        for p in out: s._forma(p, acc, v08t, osmt, osmg)

    def _forma(s, p, acc, v08t, osmt, osmg):
        """region, open part (not under a building), head, distance along the pit from the head, ramp shape, sources"""
        M = s.M; sl = p['sl']; pad = 8
        r0, r1, c0, c1 = max(0, sl[0].start - pad), min(M.dtm.shape[0], sl[0].stop + pad), max(0, sl[1].start - pad), min(M.dtm.shape[1], sl[1].stop + pad)
        core = s.cores[r0:r1, c0:c1] == p['k']; D = s.D1[r0:r1, c0:c1]
        near = ndimage.binary_dilation(core, np.ones((3, 3), bool), iterations=6)
        lab, _ = ndimage.label((D > R_REG) & near, np.ones((3, 3), bool)); ids = np.unique(lab[core]); reg = np.isin(lab, ids[ids > 0])
        rr, cc = np.mgrid[r0:r1, c0:c1]; X, Z = M.xz(rr, cc)
        ed = raster(s.edifici, X, Z)
        cop = (M.dsm[r0:r1, c0:c1] - M.dtm[r0:r1, c0:c1]) > 2.0
        p.update(win=(r0, r1, c0, c1), f_edi=round(float(ed[core].mean()), 2), cop=round(float(cop[core].mean()), 2))
        g = shapely.MultiPoint(np.column_stack((X[core], Z[core]))).convex_hull
        mr = g.minimum_rotated_rectangle; e = np.asarray(mr.exterior.coords) if mr.geom_type == 'Polygon' else np.zeros((5, 2))
        l1, l2 = np.hypot(*(e[1] - e[0])), np.hypot(*(e[2] - e[1])); p.update(L=round(float(max(l1, l2)), 1), W=round(float(min(l1, l2)), 1))
        op = reg & ~ed
        lab2, n2 = ndimage.label(op, np.ones((3, 3), bool))
        if n2:  # the open part that has most of the core outside the buildings
            cnt = np.bincount(lab2[core & op], minlength=n2 + 1); j = int(np.argmax(cnt[1:])) + 1 if cnt[1:].max() > 0 else int(np.argmax(np.bincount(lab2.ravel())[1:])) + 1
            op = lab2 == j
        p['area_aperta'] = round(float(op.sum() * M.px * M.pz), 1)
        # sources near the pit
        pg = shapely.MultiPoint(np.column_stack((X[reg], Z[reg]))).convex_hull.buffer(0.5)
        p['g'] = pg
        dv = min([pg.distance(s.ex['v08'][j]) for j in v08t.query(pg.buffer(R_V08))], default=1e9) if v08t is not None else 1e9
        do = [(s.osm[j][0], pg.distance(osmg[j])) for j in osmt.query(pg.buffer(R_OSM))] if osmt is not None else []
        p['v08_m'] = round(float(dv), 1) if dv < 1e8 else None
        p['osm'] = sorted(set(k for k, dd in do if dd <= R_OSM))
        # head: a shallow pixel of the open part; nearest a passo carraio within reach, else the one farthest from the deepest
        p['pc'] = p['pc_m'] = None
        if op.sum() < 6: p['forma'] = False; p['perche'] = 'tutta sotto un edificio'; return
        sh = op & (D < max(R_REG + 0.4, np.percentile(D[op], 15)))
        sr, sc = np.nonzero(sh); sx, sz = M.xz(sr + r0, sc + c0)
        dpc, jpc = s.acck.query(np.column_stack((sx, sz)))
        hi = int(np.argmin(dpc))
        if dpc[hi] <= R_PC: p['pc'] = [round(float(acc[jpc[hi], 0]), 1), round(float(acc[jpc[hi], 1]), 1)]; p['pc_m'] = round(float(dpc[hi]), 1)
        else:
            dr, dc = np.unravel_index(np.argmax(np.where(op, D, -1)), D.shape); hi = int(np.argmax(np.hypot(sr - dr, sc - dc))); p['pc'] = None; p['pc_m'] = None
        head = (int(sr[hi]), int(sc[hi]))
        sp = spina(op, D, M.dtm[r0:r1, c0:c1], head, np.sqrt(M.px * M.pz))
        if sp is None: p['forma'] = False; p['perche'] = 'troppo corta'; return
        t, zz, w = sp['s'], sp['z'], sp['w']
        A = np.column_stack((np.ones_like(t), t)); coef = np.linalg.lstsq(A, zz, rcond=None)[0]
        r2 = 1 - ((zz - A @ coef) ** 2).sum() / max(((zz - zz.mean()) ** 2).sum(), 1e-9)
        salto = float(zz[:3].mean() - zz[-3:].mean()); mono = float((np.diff(zz) <= 0.05).mean())
        p.update(r2=round(float(r2), 2), pend=round(float(-coef[1]), 3), salto=round(salto, 2), lung=round(float(t[-1]), 1), largh=round(float(np.median(w)), 1), mono=round(mono, 2))
        p['forma'] = bool(np.median(w) <= R_LARGA and p['area'] <= R_GRANDE and r2 >= R_R2 and R_PEND[0] <= -coef[1] <= R_PEND[1] and salto >= R_SALTO)
        if not p['forma']: p['perche'] = 'larga %.1f m, area %.0f, r2 %.2f, pendenza %.0f%%, salto %.1f m' % (np.median(w), p['area'], r2, -100 * coef[1], salto)
        p['_sp'] = spina(op, D, M.dtm[r0:r1, c0:c1], head, np.sqrt(M.px * M.pz), fondo=True) or sp   # the drawn ramp ends where it is deepest
        p['_op'] = op

    # ----- the verdicts of sottoterra.json: each to the pit with the nearest centre (within R_VISTA), one pit each
    def assegna_viste(s):
        if not s.pits1: return
        c = np.array([[p['cx'], p['cz']] for p in s.pits1]); kd = cKDTree(c); s.viste_perse = []
        for p in s.pits1: p['vista'] = None
        for v in s.vis:
            if v.get('tipo') == 'buca': continue
            d, j = kd.query([v['x'], v['z']])
            if d <= R_VISTA and s.pits1[j]['vista'] is None: s.pits1[j]['vista'] = v
            else: s.viste_perse.append(v)

    def classifica(s):
        s.assegna_viste(); n = dict(rampa=0, dubbio=0, no=0, altro=0)
        for p in s.pits1:
            v = p['vista']; fonti = ['LiDAR 2008']
            if p.get('v08_m') is not None and p['v08_m'] <= R_V08: fonti.append('DBGT volume interrato a %.0f m' % p['v08_m'])
            if p.get('osm'): fonti.append('OSM ' + ', '.join(p['osm']))
            if v and v['esito'] == 'rampa': fonti.append(v.get('fonte', 'ortofoto 2018-19'))
            p['fonti'] = fonti
            # not looked at but shaped like a ramp by a passo carraio: kept away from the buche (it could be a ramp the DBGT draws by its top edge)
            p['rampa_possibile'] = bool(p.get('largh') is not None and 2.5 <= p['largh'] <= 8 and p['area'] <= R_GRANDE and p.get('pc') is not None and p['f_edi'] < 0.6
                                        and p.get('salto', 0) >= 0.5 and p.get('r2', 0) >= 0.25)
            if v and v['esito'] == 'no': p['esito'] = 'no'
            elif v and v['esito'] == 'dubbio': p['esito'] = 'dubbio'; p['perche'] = 'a vista: ' + v.get('nota', 'non chiaro')
            elif v and v['esito'] == 'rampa':
                if p.get('pc') is None: p['esito'] = 'dubbio'; p['perche'] = 'rampa a vista, ma nessun passo carraio entro %.0f m' % R_PC
                elif p.get('_sp') is None: p['esito'] = 'dubbio'; p['perche'] = 'rampa a vista, ma la fossa aperta e troppo corta per disegnarla'
                else: p['esito'] = 'rampa'
            elif p.get('forma') and len(fonti) >= 2 and p.get('pc') is not None: p['esito'] = 'dubbio'; p['perche'] = 'forma di rampa con due fonti, da guardare'
            else: p['esito'] = 'altro'
            n[p['esito']] += 1
        s.rep['fosse_1m'] = dict(totale=len(s.pits1), viste_non_assegnate=len(s.viste_perse), **n)
        s.log('fosse a 1 m: rampe %d, dubbi %d, viste e non rampe %d, altre %d; viste senza fossa %d' % (n['rampa'], n['dubbio'], n['no'], n['altro'], len(s.viste_perse)))

    def analizza(s):  # after Superficie.strade(), before tetto(): the pits, their outcome, L filled under the buche and the ramps
        s.fosse_1m(); s.classifica(); s.buche()

    # ----- 2 m: the buche, and the fill of L under the buche and the ramps
    def buche(s):
        t0 = time.time(); sup = s.sup; R = sup.R; L = sup.L; RANK, CLS = sup.RANK, sup.CLS
        import superficie as sf
        s.F2, s.D2 = riempi(L)
        X, Z = np.meshgrid(R.xs(), R.zs())
        IN = shapely.contains_xy(sup.conf, X, Z)
        # what the DBGT says the ground is: the burned surfaces, and the inner yards (0307 with no axis, left to the LiDAR) by their ring TIN
        DREF = np.where((RANK > 0) & np.isin(CLS, (sf.C_VEI, sf.C_VEIT, sf.C_PED, sf.C_AREA)), sup.ZF, np.nan)
        V = sup.D['AC_VEI']; okz = lambda z, ft: ~np.isnan(z)
        viz = {}
        for i in range(len(V['off']) - 1):
            if V['attr']['zon'][i] == '0307' and sf.sed_ok(V, i): viz[tuple(np.round(sf.poly(V, i).representative_point().coords[0], 2))] = i
        for P in sup.interne:
            w = R.win(P.bounds, 2)
            if w is None: continue
            Xw, Zw = R.xz(w); sub = DREF[w[0]:w[1], w[2]:w[3]]; m = shapely.contains_xy(P, Xw, Zw) & np.isnan(sub)
            if not m.any(): continue
            i = viz.get(tuple(np.round(P.representative_point().coords[0], 2)))
            tv = sf.tin_di(V, i, okz) if i is not None else None
            if tv is not None: sub[m] = sf.Tin(*tv)(Xw[m], Zw[m])
        s.DREF = DREF
        ED = np.zeros(L.shape, bool)
        for g in s.edifici:
            w = R.win(g.bounds, 0)
            if w is not None: Xw, Zw = R.xz(w); ED[w[0]:w[1], w[2]:w[3]] |= shapely.contains_xy(g, Xw, Zw)
        far_alv = ndimage.distance_transform_edt(~np.isin(CLS, (sf.C_ALV, sf.C_ARG)), sampling=R.st) > B_FIUME
        far_br = ndimage.distance_transform_edt(~sup.BR, sampling=R.st) > B_PONTE
        far_fer = ndimage.distance_transform_edt(~((CLS == sf.C_FER) & (RANK > 0)), sampling=R.st) > 3.0
        # the 1 m pits that may be ramps (drawn, doubtful, or ramp-shaped by a passo carraio and not looked at) keep their ground
        prot = [p['g'] for p in s.pits1 if p['esito'] in ('rampa', 'dubbio') or (p['esito'] == 'altro' and p.get('rampa_possibile'))]
        ptree = shapely.STRtree(prot) if prot else None
        lab, n = ndimage.label(IN & (s.D2 > B_CORE), np.ones((3, 3), bool)); objs = ndimage.find_objects(lab)
        LN = L.copy(); s.casi_buche = []; FILL = np.zeros(L.shape, bool)
        conta = dict(nuclei=0, tolte=0, fiume=0, ponte=0, ferrovia=0, dbgt_in_fondo=0, poco_dbgt=0, rampa_vicina=0, vista_dubbia=0)
        regl, _ = ndimage.label(s.D2 > B_REG, np.ones((3, 3), bool))
        for k, sl in enumerate(objs):
            m = lab[sl] == k + 1
            if m.sum() < B_NODI: continue
            conta['nuclei'] += 1
            rr, cc = np.nonzero(m); rr, cc = rr + sl[0].start, cc + sl[1].start
            x, z = R.x0 + cc * R.st, R.z0 + rr * R.st
            dz = DREF[rr, cc] - L[rr, cc]; has = ~np.isnan(dz)
            alto = has & (dz > B_ALTO); basso = has & (dz < B_BASSO)
            sotto = ED[rr, cc] & ~has; nuovo = np.zeros(len(rr), bool); vecchio = np.zeros(len(rr), bool)
            if sotto.any():
                ds = s.M.at(s.M.dsm, x[sotto], z[sotto]) - s.M.at(s.M.dtm, x[sotto], z[sotto]); nuovo[sotto] = ds < B_NUOVO; vecchio[sotto] = ds >= B_NUOVO
            vis = ~vecchio   # under a building the DSM 2008 saw already: not seen, it counts neither way (the fold of the DTM filter, a basement)
            f = float((alto | nuovo)[vis].mean()) if vis.sum() >= B_NODI else 0.0
            caso = dict(x=round(float(x.mean()), 1), z=round(float(z.mean()), 1), nodi=int(m.sum()), m2=int(m.sum() * R.st * R.st), prof=round(float(s.D2[rr, cc].max()), 1),
                        dbgt_sopra=round(float(alto.mean()), 2), edificio_nuovo=round(float(nuovo.mean()), 2), dbgt_in_fondo=round(float(basso.mean()), 2), sotto_edificio_2008=round(float(vecchio.mean()), 2),
                        dbgt_meno_lidar=round(float(np.median(dz[has])), 1) if has.any() else None)
            if not far_alv[rr, cc].all(): esito = 'fiume'
            elif not far_br[rr, cc].all(): esito = 'ponte'
            elif not far_fer[rr, cc].all(): esito = 'ferrovia'
            elif basso[vis].mean() >= 0.3 if vis.any() else False: esito = 'dbgt_in_fondo'
            elif f < B_FRAZ: esito = 'poco_dbgt'
            else:
                esito = 'tolte'
                vb = [v for v in s.vis if v.get('tipo') == 'buca' and np.hypot(v['x'] - caso['x'], v['z'] - caso['z']) <= R_VISTA]
                if vb: esito = 'vista_dubbia' if vb[0]['esito'] == 'dubbio' else 'tolte'; caso['vista'] = vb[0].get('nota', '')
                if esito == 'tolte' and ptree is not None:
                    reg = shapely.MultiPoint(np.column_stack((x, z))).buffer(2.5)
                    for j in ptree.query(reg):
                        if prot[j].intersection(reg).area > 0.3 * prot[j].area: esito = 'rampa_vicina'; break
            conta[esito] += 1; caso['esito'] = esito; s.casi_buche.append(caso)
            if esito != 'tolte': continue
            ids = np.unique(regl[rr, cc]); ids = ids[ids > 0]
            a0, b0 = max(0, sl[0].start - 40), max(0, sl[1].start - 40)
            reg = np.isin(regl[a0:sl[0].stop + 40, b0:sl[1].stop + 40], ids)
            rr2, cc2 = np.nonzero(reg); FILL[rr2 + a0, cc2 + b0] = True
        # the ramps: their ground is filled too (S runs over them as over the garage; the ramp is the pit object)
        for p in s.pits1:
            if p['esito'] != 'rampa': continue
            g = p['g'].buffer(1.5); w = R.win(g.bounds, 2); Xw, Zw = R.xz(w); FILL[w[0]:w[1], w[2]:w[3]] |= shapely.contains_xy(g, Xw, Zw)
        s.FILL = FILL; nodi = s.membrana(FILL, LN, DREF)
        s.L0 = L; sup.L = LN
        dl = (LN - L)[FILL]
        s.rep['buche'] = dict(conta, nodi_riempiti=int(nodi), alzati_m=dict(zip(('p50', 'p90', 'max'), [round(float(v), 2) for v in np.percentile(dl, (50, 90, 100))])) if len(dl) else None)
        s.log('buche: %s; nodi di L riempiti %d, %.0f s' % (conta, nodi, time.time() - t0))

    def membrana(s, FILL, LN, DREF):
        """L under each filled region: the harmonic surface (Laplace, 4 neighbours) through the LiDAR around it and the DBGT heights inside it
        (never more than 1 m over the spill point), never under the LiDAR"""
        lab, n = ndimage.label(FILL); tot = 0
        for k, sl in enumerate(ndimage.find_objects(lab)):
            r0, r1, c0, c1 = max(0, sl[0].start - 1), min(FILL.shape[0], sl[0].stop + 1), max(0, sl[1].start - 1), min(FILL.shape[1], sl[1].stop + 1)
            M = lab[r0:r1, c0:c1] == k + 1; W = LN[r0:r1, c0:c1].copy(); Dr = DREF[r0:r1, c0:c1]; Fs = s.F2[r0:r1, c0:c1]
            fix = M & ~np.isnan(Dr) & (Dr <= Fs + 1.0) & (Dr >= W - 0.1)
            un = M & ~fix; nu = int(un.sum())
            if not nu: continue
            idx = -np.ones(M.shape, np.int64); idx[un] = np.arange(nu); rr, cc = np.nonzero(un)
            val = np.where(fix, Dr, W); rows, cols, vv = [], [], []; rhs = np.zeros(nu); deg = np.zeros(nu)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                r2, c2 = rr + dr, cc + dc; ok = (r2 >= 0) & (r2 < M.shape[0]) & (c2 >= 0) & (c2 < M.shape[1])
                me = idx[rr[ok], cc[ok]]; r2, c2 = r2[ok], c2[ok]; deg[me] += 1; inn = un[r2, c2]
                rows.append(me[inn]); cols.append(idx[r2[inn], c2[inn]]); vv.append(-np.ones(int(inn.sum())))
                np.add.at(rhs, me[~inn], val[r2[~inn], c2[~inn]])
            A = sparse.csr_matrix((np.concatenate([deg] + vv), (np.concatenate([np.arange(nu)] + rows), np.concatenate([np.arange(nu)] + cols))), shape=(nu, nu))
            sol = scipy.sparse.linalg.spsolve(A.tocsc(), rhs)
            W2 = W.copy(); W2[un] = np.maximum(sol, W[un]); W2[fix] = np.maximum(Dr[fix], W[fix])
            LN[r0:r1, c0:c1] = np.where(M, W2, LN[r0:r1, c0:c1]); tot += int(M.sum())
        return tot

    # ----- the ramps as objects (terreno/indice.json pits), on the final S of the tiles (s.sup.HQ: the same cm the game reads)
    def fosse(s):
        t0 = time.time(); sup = s.sup; R = s.R = sup.R; G = sup.HQ / 100.0
        import superficie as sf
        Sat = lambda x, z: sf.tri_interp(G, R, np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float)))
        etree = shapely.STRtree(s.edifici); s.pits = []; s.rampe_scartate = []
        for p in s.pits1:
            if p['esito'] != 'rampa': continue
            r = s._rampa(p, Sat, etree)
            if isinstance(r, str): p['esito'] = 'dubbio'; p['perche'] = r; s.rampe_scartate.append(p); continue
            r['id'] = len(s.pits); s.pits.append(r)
        n = len(s.pits)
        s.rep['rampe'] = dict(disegnate=n, scartate=len(s.rampe_scartate), lunghezza_m=[round(float(v), 1) for v in np.percentile([q['lung'] for q in s.pits], (0, 50, 100))] if n else None,
                              profondita_porta_m=[round(float(v), 1) for v in np.percentile([q['prof'] for q in s.pits], (0, 50, 100))] if n else None)
        s.log('rampe disegnate %d, diventate dubbi %d, %.0f s' % (n, len(s.rampe_scartate), time.time() - t0))

    def _rampa(s, p, Sat, etree):
        M = s.M; sp = p['_sp']; r0, r1, c0, c1 = p['win']
        X, Z = M.xz(sp['r'] + r0, sp['c'] + c0); P = np.column_stack((X, Z)).astype(float); d = sp['d']; w = sp['w']
        k = max(2, len(d) // 5)
        if d[:k].mean() > d[-k:].mean(): P, d, w = P[::-1], d[::-1], w[::-1]   # from the shallow end down
        # along the centre line every 0.5 m, smoothed (the curve of the pit, not the 1 m pixel steps)
        if p.get('pc') is not None and np.hypot(*(P[-1] - p['pc'])) < np.hypot(*(P[0] - p['pc'])): return 'il LiDAR scende verso il passo carraio, non verso l edificio'
        sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(P, axis=0).T)))); L0 = sv[-1]
        if L0 < 4: return 'centro linea troppo corto'
        ns = int(np.ceil(L0 / 0.5)) + 1; st = np.linspace(0, L0, ns)
        C = np.column_stack((np.interp(st, sv, P[:, 0]), np.interp(st, sv, P[:, 1]))); W = np.interp(st, sv, w)
        sig = LISCIA / 0.5
        C = np.column_stack([ndimage.gaussian_filter1d(C[:, j], sig, mode='nearest') for j in (0, 1)])
        k0, k1 = len(W) // 5, max(len(W) // 5 + 1, 4 * len(W) // 5)
        W = np.full(len(W), float(np.clip(np.median(W[k0:k1]), W_MIN, W_MAX)))   # walls parallel: one width, the middle of the pit's
        # where the pit goes on under a roof (DSM 2008 over the DTM by more than 2.5 m, at least 1.5 m on, after 3 m in the open) the ramp
        # goes under ground: it stops there with its door (via Gagarin: the spiral is under the cover, the open part is the way down to it)
        cov = (M.at(M.dsm, C[:, 0], C[:, 1]) - M.at(M.dtm, C[:, 0], C[:, 1])) > 2.5; ds_ = 0.5
        if not cov[:int(3 / ds_)].any():
            for k in range(int(3 / ds_), len(C) - 3):
                if cov[k:k + 3].all(): C, W = C[:k + 1], W[:k + 1]; p['sotto_tetto'] = True; break
        # the mouth goes on 1.5 m back along the line (the pit of the LiDAR starts 0.3 m deep), unless that is in a building
        def tang(a, b): v = C[b] - C[a]; return v / max(np.hypot(*v), 1e-9)
        dentro = lambda q: any(s.edifici[j].contains(Point(*q)) for j in etree.query(Point(*q)))
        dentro_b = lambda q: any(s.edifici[j].distance(Point(*q)) < 0.2 for j in etree.query(Point(*q).buffer(0.2)))
        t0_ = tang(min(3, len(C) - 1), 0); ext = []
        for e in (0.5, 1.0, 1.5):
            q = C[0] + t0_ * e
            if dentro(q): break
            ext.insert(0, q)
        if ext: C = np.vstack((ext, C)); W = np.concatenate((np.full(len(ext), W[0]), W))
        # the end goes on to a facade within 1.5 m (the door on the wall of the building)
        t1_ = tang(max(0, len(C) - 4), len(C) - 1); add = []
        for e in np.arange(0.5, 1.51, 0.5):
            q = C[-1] + t1_ * e
            if dentro(q): break
            add.append(q)
        else: add = []
        if add: C = np.vstack((C, add)); W = np.concatenate((W, np.full(len(add), W[-1])))
        sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(C, axis=0).T)))); L = sv[-1]
        # tangent, normal (left), and the width never more than the radius of the curve allows
        T = np.gradient(C, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; N = np.column_stack((-T[:, 1], T[:, 0]))
        ang = np.unwrap(np.arctan2(T[:, 1], T[:, 0])); curv = np.abs(np.gradient(ang, sv))
        rad = 1 / np.maximum(ndimage.maximum_filter1d(curv, 7), 1e-6); W = np.minimum(W, 1.8 * rad)
        # each side stops 0.2 m short of a building (the outline of the LiDAR pit, smoothed and widened, went into the walls)
        facc = np.array([any(s.edifici[j].distance(Point(*q)) < 0.6 for j in etree.query(Point(*q).buffer(0.6))) for q in C])   # at the facade (the door): as it is
        facc |= (sv > L - 3.0) | (sv < 2.0)   # ... and the mouth, where the walls are low
        def lato(sg):
            h = W / 2
            for k in range(len(C)):
                if facc[k]: continue
                while h[k] - 0.25 >= 0.95 and dentro_b(C[k] + sg * N[k] * h[k]): h[k] -= 0.25
            return h
        hl, hr = lato(1), lato(-1)
        if getattr(s, 'dbg', False): p['_dbg'] = (C.copy(), hl.copy(), hr.copy(), facc.copy(), W.copy())
        if (~facc).any() and (min(hl[~facc].min(), hr[~facc].min()) < 0.95 or (hl + hr)[~facc].min() < 2.4): return 'stretta fra gli edifici'
        hl, hr = ndimage.minimum_filter1d(hl, 3), ndimage.minimum_filter1d(hr, 3)
        W = hl + hr; C = C + N * ((hl - hr) / 2)[:, None]
        if W.min() < 2.5: return 'curva troppo stretta per la larghezza'
        # the floor: the DTM of the open pit by the nearest station, monotone down (isotonic), from the ground at the mouth, at most PEND_MAX
        op = p['_op']; rr, cc = np.nonzero(op); px, pz = M.xz(rr + r0, cc + c0); zz = M.dtm[rr + r0, cc + c0].astype(float)
        j = cKDTree(C).query(np.column_stack((px, pz)))[1]
        med = np.full(len(C), np.nan)
        for q in np.unique(j): med[q] = np.median(zz[j == q])
        okm = ~np.isnan(med)
        if okm.sum() < 3: return 'fondo senza punti del LiDAR'
        med = np.interp(sv, sv[okm], med[okm])
        g0 = float(Sat(*C[0])[0]); f = np.minimum(pava_dec(med), g0); f[0] = g0
        for _ in range(2):
            for q in range(1, len(f)): f[q] = min(f[q - 1], max(f[q], f[q - 1] - PEND_MAX * (sv[q] - sv[q - 1])))
            f = np.minimum(ndimage.uniform_filter1d(f, 5, mode='nearest'), g0); f[0] = g0
        for q in range(1, len(f)): f[q] = min(f[q - 1], max(f[q], f[q - 1] - PEND_MAX * (sv[q] - sv[q - 1])))
        Lft, Rgt = C + N * W[:, None] / 2, C - N * W[:, None] / 2
        poly = Polygon(np.vstack((Lft, Rgt[::-1])))
        if not poly.is_valid: return 'contorno che si incrocia'
        sl_, sr_ = Sat(Lft[:, 0], Lft[:, 1]), Sat(Rgt[:, 0], Rgt[:, 1])
        bl = np.clip(1 - sv / 2.0, 0, 1)            # across the mouth the floor takes the ground on each side, flat again within 2 m
        yl, yr = f + (sl_[0] - f[0]) * bl, f + (sr_[0] - f[0]) * bl
        gend = float(Sat(*C[-1])[0]); prof = gend - f[-1]
        if prof < 1.2: return 'in fondo e profonda solo %.1f m' % prof
        # cells of S the ramp takes (any 2 m cell its outline touches) and the ground of those cells outside it, cut on the cell triangles
        sf_ = sys.modules["superficie"]; R = s.R; TS_ = sf_.TILE; st = R.st; nct = int(TS_ / st)
        bx0, bz0, bx1, bz1 = poly.bounds; i0, i1 = int(np.floor((bx0 + sf_.HW) / st)), int(np.floor((bx1 + sf_.HW) / st)); j0, j1 = int(np.floor((bz0 + sf_.HH) / st)), int(np.floor((bz1 + sf_.HH) / st))
        celle, anello = {}, []; shapely.prepare(poly)
        for J in range(j0, j1 + 1):
            for I in range(i0, i1 + 1):
                x0, z0 = -sf_.HW + I * st, -sf_.HH + J * st
                if not poly.intersects(box(x0, z0, x0 + st, z0 + st)): continue
                tx, tz = I // nct, J // nct; wloc = (J - tz * nct) * nct + (I - tx * nct); key = '%d_%d' % (tx, tz)
                celle.setdefault(key, []).append(int(wloc)); flat = []
                for tri in (Polygon([(x0, z0), (x0 + st, z0), (x0 + st, z0 + st)]), Polygon([(x0, z0), (x0 + st, z0 + st), (x0, z0 + st)])):
                    rest = tri.difference(poly)
                    if rest.is_empty or rest.area < 1e-4: continue
                    for t in shapely.get_parts(shapely.constrained_delaunay_triangles(rest)):
                        cxy = np.asarray(t.exterior.coords)[:3]
                        if t.area < 1e-6 or not rest.buffer(1e-6).contains(t.centroid): continue
                        flat += [round(float(v), 3) for v in cxy.ravel()]
                if flat: anello.append([key, int(wloc), flat])
        v = p.get('vista') or {}
        r3 = lambda A, y: [[round(float(x), 3), round(float(z), 3), round(float(h), 3)] for (x, z), h in zip(A, y)]
        return dict(tipo='rampa', c=[round(float(C[len(C) // 2][0]), 1), round(float(C[len(C) // 2][1]), 1)], fonti=p['fonti'], nota=v.get('nota', ''),
                    sx=r3(Lft, yl), dx=r3(Rgt, yr),   # the game rebuilds the outline (sx, then dx backwards) and the floor (the strip between them)
                    lung=round(float(L), 1), larg=[round(float(W.min()), 1), round(float(W.max()), 1)], prof=round(prof, 2), bocca=round(g0, 2), fondo=round(float(f[-1]), 2),
                    pc=p.get('pc'), pc_m=p.get('pc_m'), celle=celle, anello=anello, porta_h=PORTA_H)


    def scrivi(s, out):
        """fosse_meda.json (the ramps for terreno_gioco.py) and sottoterra_casi.json (every pit and its outcome: the list of docs/sottoterra.md)"""
        json.dump(dict(fosse=s.pits), open(os.path.join(out, 'fosse_meda.json'), 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
        np.save(os.path.join(out, 'sottoterra_riempiti.npy'), s.FILL)   # the nodes of L filled (2 m lattice of S): where S may change
        keep = ('cx', 'cz', 'area', 'dmax', 'largh', 'lung', 'r2', 'pend', 'salto', 'f_edi', 'cop', 'pc', 'pc_m', 'v08_m', 'osm', 'fonti', 'esito', 'perche', 'rampa_possibile')
        f1 = [dict({k: p.get(k) for k in keep}, vista=(p['vista'] or {}).get('nota')) for p in s.pits1]
        json.dump(dict(rapporto=s.rep, fosse_1m=f1, buche=s.casi_buche, rampe=[{k: q[k] for k in ('id', 'c', 'fonti', 'nota', 'lung', 'larg', 'prof', 'bocca', 'fondo', 'pc', 'pc_m')} for q in s.pits]),
                  open(os.path.join(out, 'sottoterra_casi.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0, default=float)


def pava_dec(y):  # the closest non-increasing sequence (least squares, pool adjacent violators)
    v, w, n = [], [], []
    for a in np.asarray(y, float):
        v.append(a); w.append(1.0); n.append(1)
        while len(v) > 1 and v[-2] < v[-1]:
            ww = w[-2] + w[-1]; vv = (v[-2] * w[-2] + v[-1] * w[-1]) / ww; nn = n[-2] + n[-1]
            v[-2:] = [vv]; w[-2:] = [ww]; n[-2:] = [nn]
    return np.repeat(v, n)
