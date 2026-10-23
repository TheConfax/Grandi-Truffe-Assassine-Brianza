# Motore nuovo, fase 3 (docs/motore.md 1.5, 2.1, 5): the objects above and below the surface S of src/superficie.py.
#   build_decks(): bridges from PONTE_PONTE_SEDE (top from the axes and areas with SED=02 on them), the parts of their approaches the DTM
#     does not have (superficie.py AIR: road more than 3 m over the LiDAR near a bridge), the bridges the DBGT does not flag (superficie.py
#     PNS: the Milano-Meda over the Taro) and the cover of the gallery (GALLER). Where a deck reaches ground at its own height (spalla) it is
#     extended to that lattice line and its top is pulled onto S there: the terrain is never moved. A PONTE end that reaches no ground
#     where OSM says the bridge goes on is carried on to the first ground at its level (EXT_MAX).
#   build_pits(): the underpass stairwells (landmarks3.js STAIRWELLS, the only source of their depth) as {imp, fondo, gradini}.
# Writes decks_meda.json and report_fase3.json (C5 on the spalle, C11). No change to brianza.json or to the game.
#   python src/impalcati.py [--out DIR] [--comune Meda] [--no-png] [--accetta]
import os, sys, re, json, time, pickle, argparse, types, warnings
import xml.etree.ElementTree as ET
import numpy as np, shapely, shapely.ops
from shapely.geometry import Polygon, LineString, Point, box
from scipy import ndimage
from scipy.spatial import Delaunay

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq
import superficie as sf
from superficie import SF, C_VEI, C_VEIT, C_PED, C_AREA, C_FER, C_ALV, C_ARG, ROADTYPE, tri_interp, pct, link

SP = {'strada': 0.9, 'ferro': 0.9, 'pedonale': 0.5, 'copertura': 0.9}   # slab thickness (a generic default: the DBGT has none)
LUCE = 2.5        # spec 1.5: under min(S) + LUCE one passes under the deck
LEVEL_TOL = 0.5   # ground within this of the deck top is where the deck lands (spalla); farther it is a drop (a side, a parapet).
                  # 1 m also took bank and embankment nodes and copied their slope into road decks (172 triangles over 18 % against 75)
LEVEL_PED = 1.0   # ... a footbridge lands on a bank up to 1 m lower (a few steps: H.surface climbs 0.8 m)
REACH = 2.5       # spalla cells reach landing ground this far from the PONTE outline (a dip between them is bridged)
EXT_MAX = 12.0    # an end with no ground at its level within REACH, where an OSM bridge goes on, is carried on to ground this far at most
def tol(tipo, ped=False): return LEVEL_PED if (tipo == 'pedonale' or ped) else LEVEL_TOL
RC = 10.0         # the pull of the deck top onto the ground at its spalle fades over about this distance
NEAR_V = 2.9      # lattice nodes this close to the footprint carry the deck values
BAD_RING = 1.5    # a PONTE ring vertex this far from the axes and areas on the deck is not the deck top (dropped from its TIN)
ASSIGN_D = sf.NEAR_BR + 2.5   # an AIR patch with a node within this of a bridge belongs to bridges
OSM_DIR = 5.0     # OSM bridges within this of a PONTE give its type and direction when the DBGT has no axis on it
MATCH_BUF = 3.0   # roads and OSM ways are matched on the footprint grown by this (OSM is often 2-4 m off the DBGT)
UNDER_MIN = 1.0   # a deck whose top lies under S by more than this (median) is not a bridge one can see: reported, not emitted
OSM_NEAR = 10.0   # spec 4: an OSM bridge with no DBGT deck within this is listed (C11)
TYPE_OF_CLS = {C_VEI: 'strada', C_VEIT: 'strada', C_PED: 'pedonale', C_FER: 'ferro'}
CAR = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary',
       'tertiary_link', 'unclassified', 'residential', 'service', 'living_street', 'road'}


def log(*a): print('%5.1fs' % (time.time() - T0), *a, flush=True)
T0 = time.time()


# ---------- OSM ways (highway / railway) with their bridge and tunnel tags ----------
def osm_vie(path, lonlat, cache=None):
    if cache and os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(path):
        return pickle.load(open(cache, 'rb'))
    W, S_, E, N = lonlat; nodes, out = {}, []
    keep = ('highway', 'railway', 'bridge', 'tunnel', 'layer', 'name', 'covered', 'incline')
    for ev, el in ET.iterparse(path):
        if el.tag == 'node':
            lat, lon = float(el.get('lat')), float(el.get('lon'))
            if S_ <= lat <= N and W <= lon <= E: nodes[el.get('id')] = dq.to_game_lonlat(lon, lat)
            el.clear()
        elif el.tag == 'way':
            t = {c.get('k'): c.get('v') for c in el.iter('tag')}
            if t.get('highway') or t.get('railway') in ('rail', 'light_rail', 'tram', 'subway', 'narrow_gauge'):
                p = [nodes[c.get('ref')] for c in el.iter('nd') if c.get('ref') in nodes]
                if len(p) >= 2: out.append(dict(id=int(el.get('id')), t={k: t[k] for k in keep if k in t}, p=np.array(p)))
            el.clear()
        elif el.tag == 'relation': el.clear()
    if cache: pickle.dump(out, open(cache, 'wb'))
    return out


def is_bridge(t): return t.get('bridge') not in (None, 'no')
def is_tunnel(t): return t.get('tunnel') not in (None, 'no') or str(t.get('layer', '0')).startswith('-')
def osm_tipo(t):
    if t.get('railway'): return 'ferro'
    return 'strada' if t.get('highway') in CAR else 'pedonale'


# ---------- the underpass stairwells: landmarks3.js STAIRWELLS holds their depth until phase 6 moves them here ----------
def stairwells(path=None):
    src = open(path or os.path.join(HERE, 'landmarks3.js'), encoding='utf-8').read()
    m = re.search(r'const STAIRWELLS = (\[.*?\n\]);', src, re.S)
    if not m: return []
    js = re.sub(r"'([^']*)'", lambda g: json.dumps(g.group(1)), m.group(1))      # 'text' -> "text"
    js = re.sub(r'([{,]\s*)([A-Za-z_]\w*)\s*:', r'\1"\2":', js)                    # bare keys
    return json.loads(re.sub(r',\s*([\]}])', r'\1', js))


def hull(pts):  # as landmarks3.js hull(): monotone chain
    p = sorted(map(tuple, pts)); cr = lambda o, a, b: (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]); lo, up = [], []
    for q in p:
        while len(lo) >= 2 and cr(lo[-2], lo[-1], q) <= 0: lo.pop()
        lo.append(q)
    for q in reversed(p):
        while len(up) >= 2 and cr(up[-2], up[-1], q) <= 0: up.pop()
        up.append(q)
    return lo[:-1] + up[:-1]


# ---------- geometry helpers ----------
def parts(g): return [p for p in getattr(g, 'geoms', [g]) if isinstance(p, Polygon) and not p.is_empty]


def pulito(g, hole=4.0):  # valid, polygons only, holes under `hole` m2 filled
    g = shapely.make_valid(g) if not g.is_valid else g
    ps = [Polygon(p.exterior, [r for r in p.interiors if Polygon(r).area >= hole]) for p in parts(g) if p.area > 0.05]
    return shapely.union_all(ps) if ps else Polygon()


def anelli_di(g):
    for p in parts(g):
        yield np.asarray(p.exterior.coords)[:-1]
        for r in p.interiors: yield np.asarray(r.coords)[:-1]


def densa(ring, step):  # closed ring -> points every <= step (the vertices kept)
    P = np.vstack((ring, ring[:1])); seg = np.hypot(*np.diff(P, axis=0).T); m = np.maximum(1, np.ceil(seg / step - 1e-9).astype(int))
    j = np.repeat(np.arange(len(seg)), m); t = (np.arange(m.sum()) - np.repeat(np.cumsum(m) - m, m)) / m[j]
    return P[j] + (P[j + 1] - P[j]) * t[:, None]


def direzione(segs):  # length-weighted direction (mod 180) of segments [(A, B)], as a unit vector
    if not len(segs): return None
    d = np.array([np.asarray(b) - np.asarray(a) for a, b in segs]); l = np.hypot(*d.T); a = 2 * np.arctan2(d[:, 1], d[:, 0])
    c, s_ = (l * np.cos(a)).sum(), (l * np.sin(a)).sum()
    if np.hypot(c, s_) < 1e-9: return None
    t = np.arctan2(s_, c) / 2; return np.array([np.cos(t), np.sin(t)])


def segs_line(g): return [(a, b) for q in getattr(g, 'geoms', [g]) if q.length > 0 for a, b in zip(q.coords[:-1], q.coords[1:])]


def dir_rect(g):  # long side of the minimum rotated rectangle
    r = np.asarray(g.minimum_rotated_rectangle.exterior.coords)[:4]; e = np.diff(np.vstack((r, r[:1])), axis=0); k = np.argmax(np.hypot(*e.T))
    return e[k] / max(np.hypot(*e[k]), 1e-9)


def aree(P, T):  # triangle areas
    u, v = P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]; return np.abs(u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]) / 2


def ang(u, v): return float(np.degrees(np.arccos(min(1.0, abs(float(np.dot(u, v)))))))


def triangola(g, R, step=1.0):
    """Vertices: the outline every <= step (so every lattice node on a lattice edge of the outline), the lattice nodes inside; Delaunay
    triangles kept when their centroid and edge midpoints are inside the footprint."""
    Bp = np.vstack([densa(r, step) for r in anelli_di(g)])
    w = R.win(g.bounds, SF); X, Z = R.xz(w); X, Z = X.ravel(), Z.ravel()
    k = shapely.contains_xy(g, X, Z); X, Z = X[k], Z[k]
    k = shapely.distance(g.boundary, shapely.points(X, Z)) > 0.3; P = np.vstack((Bp, np.column_stack((X[k], Z[k]))))
    _, ix = np.unique(np.round(P, 3), axis=0, return_index=True); P = P[np.sort(ix)]
    T = Delaunay(P).simplices; c3 = P[T].mean(1); ok = shapely.contains_xy(g, c3[:, 0], c3[:, 1]); gb = g.buffer(0.02)
    for e in ((0, 1), (1, 2), (2, 0)):
        m = (P[T[:, e[0]]] + P[T[:, e[1]]]) / 2; ok &= shapely.contains_xy(gb, m[:, 0], m[:, 1])
    T = T[ok]; return P, T[aree(P, T) > 1e-4]


# ---------- the deck top from the DBGT ----------
class Piano:
    """Top of a bridge: the axes with SED=02 on it blended as on the carriageways (superficie.Assi.valuta), the TIN of the rings of its
    areas with SED=02/03 and of the PONTE ring beyond AX_NEAR from them; no axis: the TIN alone."""
    def __init__(s, segs, P, Z):
        s.ax = types.SimpleNamespace(A=segs[0], B=segs[1], za=segs[2], zb=segs[3]) if segs is not None and len(segs[0]) else None
        s.tin = sf.Tin(P, Z) if P is not None and len(P) >= 1 else None

    def __call__(s, x, z):
        x, z = np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float))
        if s.ax is None: return s.tin(x, z)
        h, dm = sf.Assi.valuta(s.ax, np.arange(len(s.ax.A)), x, z, sf.BLEND)
        if s.tin is not None:
            w = np.clip((dm - sf.AX_NEAR) / sf.AX_NEAR, 0, 1); k = w > 0
            if k.any(): h[k] = h[k] * (1 - w[k]) + s.tin(x[k], z[k]) * w[k]
        return h


def segs_of(pts_list):  # [(xy, z)] of densified lines -> A, B, za, zb
    A, B, za, zb = [], [], [], []
    for p, z in pts_list:
        if len(p) < 2: continue
        A.append(p[:-1]); B.append(p[1:]); za.append(z[:-1]); zb.append(z[1:])
    return (np.vstack(A), np.vstack(B), np.concatenate(za), np.concatenate(zb)) if A else None


class Campo:
    """Height of one deck: inside its PONTE core the DBGT top plus a pull c onto the ground at the spalle; elsewhere (approaches, spalla
    cells, bridges with no PONTE) the triangles of a lattice field V on the same nodes as S. V = S on the ground nodes where the deck lands,
    the DBGT road height on its AIR nodes, the core top + c (or the nearest of those) on the others."""
    def __init__(s, imp, g, core, own, tipo):
        R = imp.R; w = R.win(g.bounds, 2 * SF); r0, r1, c0, c1 = w; X, Z = R.xz(w)
        s.R = sf.Reticolo(R.x0 + c0 * SF, R.z0 + r0 * SF, c1 - c0, r1 - r0, SF); s.core = core; s.w = w
        Sw = imp.SQ[r0:r1, c0:c1]; AIRw = own[r0:r1, c0:c1].copy(); ZFw = imp.s.ZF[r0:r1, c0:c1]
        if AIRw.any():   # an AIR node far off its own neighbours is another level (a road under the ramp): not the deck
            zz = np.where(AIRw, ZFw, np.nan); pad = np.pad(zz, 1, constant_values=np.nan)
            nb = np.stack([pad[1 + dr:1 + dr + zz.shape[0], 1 + dc:1 + dc + zz.shape[1]] for dr in (-1, 0, 1) for dc in (-1, 0, 1) if dr or dc])
            with warnings.catch_warnings(): warnings.simplefilter('ignore'); med = np.nanmedian(nb, 0)   # all-NaN where no AIR around
            odd = AIRw & ~np.isnan(med) & (np.abs(ZFw - med) > 1.5); s.dispari = int(odd.sum()); AIRw &= ~odd
        else: s.dispari = 0
        near = (shapely.distance(g, shapely.points(X, Z)) < NEAR_V)
        # the deck height a node is compared with: the DBGT top by the core, the nearest own AIR node along the approaches
        ref = Sw.copy(); bycore = np.zeros(X.shape, bool)
        if AIRw.any():
            idx = ndimage.distance_transform_edt(~AIRw, return_distances=False, return_indices=True); ref = ZFw[idx[0], idx[1]]
        ext = np.zeros(X.shape, bool)   # corners of the cells that carry the deck past a short PONTE end (Impalcati.celle_spalla)
        for r, c in (core or {}).get('ext', ()):
            ext[max(0, r - r0):max(0, r + 2 - r0), max(0, c - c0):max(0, c + 2 - c0)] = True
        if core is not None:
            Tw = core['top'](X.ravel(), Z.ravel()).reshape(X.shape); bycore = shapely.distance(core['g'], shapely.points(X, Z)) < SF
            ref = np.where(bycore | ext | ~AIRw.any(), Tw, ref)
        land = imp.LAND[r0:r1, c0:c1] & (np.abs(Sw - ref) < tol(tipo, core is not None and core['ped'])) & near & ~AIRw
        s.valid = land | AIRw
        V = np.where(AIRw, ZFw, np.where(land, Sw, np.nan)); s.land = land
        s.A, s.r = np.zeros((0, 2)), np.zeros(0); s.salti = 0
        if core is not None:   # anchors: the valid nodes by the core at about its height (a ramp starting lower is a step, counted)
            m = s.valid & (shapely.distance(core['g'], shapely.points(X, Z)) < 4.0); res = V - Tw
            s.salti = int((m & (np.abs(res) > 1.5)).sum()); m &= np.abs(np.nan_to_num(res)) <= 1.5
            s.A, s.r = np.column_stack((X[m], Z[m])), res[m]
        # empty nodes: the core top pulled onto the ground next to the core, the nearest valid node elsewhere (a flat side, no spike)
        if s.valid.any():
            idx = ndimage.distance_transform_edt(~s.valid, return_distances=False, return_indices=True); nv = V[idx[0], idx[1]]
        else: nv = Sw
        if core is not None:
            tp = Tw + s.pull(X.ravel(), Z.ravel()).reshape(X.shape); nv = np.where(bycore, tp, nv)
            fill = ext & ~s.valid & ~bycore
            if fill.any() and land.any():   # the carried-on part: straight from the core end to the ground it reaches
                dc = shapely.distance(core['g'], shapely.points(X[fill], Z[fill])); dl = ndimage.distance_transform_edt(~land, sampling=SF)[fill]
                nv[fill] = (dl * tp[fill] + dc * nv[fill]) / np.maximum(dl + dc, 1e-9)
        s.V = np.where(s.valid, V, nv)

    def approda(s, rr, cc):  # global lattice nodes -> is it a node where this deck lands (V = S there)
        r0, r1, c0, c1 = s.w; k = (rr >= r0) & (rr < r1) & (cc >= c0) & (cc < c1); out = np.zeros(len(rr), bool)
        out[k] = s.land[rr[k] - r0, cc[k] - c0]; return out

    def pull(s, x, z):
        if not len(s.A): return np.zeros(len(x))
        p = np.column_stack((x, z)); out = np.empty(len(p))
        for k in range(0, len(p), 2000):
            d2 = ((p[k:k + 2000, None, :] - s.A[None]) ** 2).sum(-1); w = 1 / (d2 + 0.04)
            out[k:k + 2000] = (w * s.r[None]).sum(1) / (w.sum(1) + 1 / RC ** 2)
        return out

    def __call__(s, P):
        P = np.atleast_2d(P); h = np.atleast_1d(tri_interp(s.V, s.R, P[:, 0], P[:, 1]))
        if s.core is not None:
            # strictly inside the core: on its outline the lattice field holds (there V = S on the landing nodes, exactly)
            inc = shapely.contains_xy(s.core['g'].buffer(-1e-3), P[:, 0], P[:, 1])
            if inc.any(): h[inc] = s.core['top'](P[inc, 0], P[inc, 1]) + s.pull(P[inc, 0], P[inc, 1])
        return h


# ---------- decks ----------
class Impalcati:
    def __init__(s, sup, osm=None):
        s.s, s.osm, s.R, s.D = sup, osm or [], sup.R, sup.D
        s.SQ = sup.HQ / 100.0                           # S exactly as the .bin give it
        s.LAND = ~sup.BR   # ground a deck can land on, not under or on a bridge (BR has the AIR nodes): a road the DBGT burned, a lot's
                           # inner road left to the LiDAR (PONTE 20), a path or a bank (footbridges); road nodes only left 3 bridges with no spalla
        s.ROAD = sup.FIX & np.isin(sup.CLS, ROADTYPE) & s.LAND
        P = []                                           # SED=01 road-like polygons: the sides of the approach parts follow them
        for nm in ('AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR', 'SD_FER'):
            L = s.D[nm]; P += [sf.poly(L, i) for i in range(len(L['off']) - 1) if sf.sed_ok(L, i)]
        s.roadp = P; s.roadt = shapely.STRtree(P)
        s.ax_on, s.ax_under = [], []                     # axes on decks, axes under them
        for nm in ('EL_STR', 'EL_FER'):
            L = s.D[nm]
            for i in range(len(L['off']) - 1):
                a, b = L['off'][i], L['off'][i + 1]
                if b - a < 2: continue
                sed, liv = L['attr']['sed'][i], L['attr']['liv'][i]; g = LineString(L['xy'][a:b])
                if sed not in ('01', None): s.ax_on.append(dict(nm=nm, i=i, id=int(L['id'][i]), g=g, xy=L['xy'][a:b], z=L['z'][a:b]))
                elif liv == '01': s.ax_under.append(dict(nm=nm, i=i, id=int(L['id'][i]), g=g))
        s.ar_on = [dict(nm=nm, i=i, id=int(s.D[nm]['id'][i]), g=sf.poly(s.D[nm], i)) for nm in ('AC_VEI', 'AR_STR', 'AC_PED', 'AC_CIC', 'SD_FER')
                   for i in range(len(s.D[nm]['off']) - 1) if s.D[nm]['attr']['sed'][i] in ('02', '03')]
        s.osm_br = [w for w in s.osm if is_bridge(w['t'])]
        s.info = dict(anelli_ponte_scartati=0, nodi_air=int(sup.AIR.sum()), nodi_air_di_ponti_non_segnati_superficie=int(getattr(sup, 'PNS', np.zeros(1, bool)).sum()))
        s.decks = []

    def Sat(s, x, z): return np.atleast_1d(tri_interp(s.SQ, s.R, np.atleast_1d(x), np.atleast_1d(z)))

    def under_dirs(s, g):
        return [u for u in (direzione(segs_line(a['g'].intersection(g.buffer(2.0)))) for a in s.ax_under if a['g'].intersects(g)) if u is not None]

    # ----- the cores: PONTE polygons with their top
    def nuclei(s):
        D = s.D; P = D['PONTE']; s.cores = []; okz = lambda z, ft: ~np.isnan(z)
        for i in range(len(P['off']) - 1):
            g = pulito(sf.poly(P, i)); gb = g.buffer(1.0); lines = []
            for a in s.ax_on:
                if not a['g'].intersects(gb): continue
                r = sf.denso(a['xy'], a['z'], ~np.isnan(a['z']), SF, closed=False)
                if r is None: continue
                k = shapely.contains_xy(g.buffer(3.0), r[0][:, 0], r[0][:, 1])
                if k.sum() >= 2: lines.append((r[0][k], r[1][k], a))
            ars = [a for a in s.ar_on if a['g'].intersects(g) and a['g'].intersection(g).area > min(1.0, 0.2 * a['g'].area)]
            PA, ZA = [], []
            for a in ars:
                tv = sf.tin_di(D[a['nm']], a['i'], okz)
                if tv is not None: PA.append(tv[0]); ZA.append(tv[1])
            tv = sf.tin_di(P, i, okz); segs = segs_of([(p, z) for p, z, _ in lines])
            ring = (tv[0], tv[1]) if tv is not None else (np.zeros((0, 2)), np.zeros(0))
            if (segs is not None or PA) and len(ring[0]):  # PONTE ring vertices off the axes and areas on the deck are not its top
                f = Piano(segs, np.vstack(PA) if PA else None, np.concatenate(ZA) if ZA else None)
                bad = np.abs(ring[1] - f(ring[0][:, 0], ring[0][:, 1])) > BAD_RING
                if bad.any() and (~bad).sum() >= 3: s.info['anelli_ponte_scartati'] += int(bad.sum()); ring = (ring[0][~bad], ring[1][~bad])
            PP = PA + ([ring[0]] if len(ring[0]) else []); ZZ = ZA + ([ring[1]] if len(ring[0]) else [])
            if not PP: continue
            top = Piano(segs, np.vstack(PP), np.concatenate(ZZ))
            ob = [w for w in s.osm_br if LineString(w['p']).distance(g) < OSM_DIR]
            on = {a['nm'] for _, _, a in lines} | {a['nm'] for a in ars}   # type: what runs on it, else the OSM bridge, else its size
            if on & {'EL_STR', 'AC_VEI', 'AR_STR'}: tipo = 'strada'
            elif on & {'EL_FER', 'SD_FER'}: tipo = 'ferro'
            elif on & {'AC_PED', 'AC_CIC'} and not any(osm_tipo(w['t']) == 'strada' for w in ob): tipo = 'pedonale'
            elif ob: tipo = osm_tipo(max(ob, key=lambda w: LineString(w['p']).intersection(g.buffer(OSM_DIR)).length)['t'])
            else: tipo = 'pedonale' if g.area < 60 else 'strada'
            # direction: the axes on it, else the OSM bridge, else across the axes under it, else its long side
            dv = direzione([(p[j], p[j + 1]) for p, _, _ in lines for j in range(len(p) - 1)]) if lines else None
            if dv is None and ob: dv = direzione([q for w in ob for q in segs_line(LineString(w['p']).intersection(g.buffer(OSM_DIR)))])
            if dv is None:
                ud = s.under_dirs(g)
                if ud: u = direzione([((0, 0), tuple(v)) for v in ud]); dv = np.array([-u[1], u[0]])
            z0 = P['z0'][P['off'][i]:P['off'][i + 1]]
            ped = not (on & {'EL_STR', 'AC_VEI', 'AR_STR', 'EL_FER', 'SD_FER'})   # nothing for cars or trains on it in the DBGT
            s.cores.append(dict(k=len(s.cores), pid=int(P['id'][i]), g=g, top=top, tipo=tipo, ped=ped, dir=dv if dv is not None else dir_rect(g), ob=ob,
                                assi=sorted({(a['nm'], a['id']) for _, _, a in lines}), aree=sorted({(a['nm'], a['id']) for a in ars}),
                                z_dbgt=[round(float(np.nanmin(z0)), 2), round(float(np.nanmax(z0)), 2)]))
        return s.cores

    # ----- AIR nodes (approaches the DTM has not, bridges it removed) to their bridge: per connected patch
    def assegna(s, pits):
        sup = s.s; R = s.R; rr, cc = np.nonzero(sup.AIR); X, Z = R.x0 + cc * SF, R.z0 + rr * SF; pts = shapely.points(X, Z)
        own = np.full(len(rr), -1); pitu = shapely.union_all([p['g'] for p in pits]) if pits else None
        inpit = shapely.contains_xy(pitu.buffer(1.0), X, Z) if pitu is not None else np.zeros(len(rr), bool)
        lab = ndimage.label(sup.AIR, np.ones((3, 3), bool))[0][rr, cc]
        dist = np.stack([shapely.distance(c['g'], pts) for c in s.cores]) if s.cores else np.zeros((0, len(rr)))
        ty = [TYPE_OF_CLS.get(int(c_)) for c_ in sup.CLS[rr, cc]]; s.liberi = []
        for j in np.unique(lab):
            m = np.nonzero((lab == j) & ~inpit)[0]
            if not len(m): continue
            cand = [k for k in range(len(s.cores)) if dist[k, m].min() <= ASSIGN_D]
            if not cand:
                if len(m) >= 3: s.liberi.append(m)
                continue
            sc = []
            for k in cand:   # nearest bridge of the same kind at about the same height
                c = s.cores[k]; dzk = np.abs(sup.ZF[rr[m], cc[m]] - c['top'](X[m], Z[m]))
                sc.append(dist[k, m] + 5 * np.maximum(0, dzk - LEVEL_TOL) + np.array([0 if (ty[q] is None or ty[q] == c['tipo']) else 20 for q in m]))
            own[m] = np.array(cand)[np.argmin(np.stack(sc), 0)]
        own[inpit] = -2; s.air_rr, s.air_cc, s.air_own = rr, cc, own
        s.info.update(nodi_air_ai_ponti=int((own >= 0).sum()), nodi_air_nelle_fosse=int(inpit.sum()), nodi_air_ponti_non_segnati=int(sum(len(v) for v in s.liberi)),
                      nodi_air_scartati=int((own == -1).sum() - sum(len(v) for v in s.liberi)))

    def celle(s, rr, cc):  # cells (r, c) with a corner among the nodes
        out = set()
        for r, c in zip(rr, cc):
            for dr in (-1, 0):
                for dc in (-1, 0):
                    if 0 <= r + dr < s.R.nz - 1 and 0 <= c + dc < s.R.nx - 1: out.add((r + dr, c + dc))
        return out

    def cbox(s, rc): r, c = rc; x, z = s.R.x0 + c * SF, s.R.z0 + r * SF; return box(x, z, x + SF, z + SF)

    def celle_spalla(s, core):  # cells by the core ends (within REACH, inside its width) with a corner on ground at the deck level
        w = s.R.win(core['g'].bounds, EXT_MAX + 2 * SF)
        if w is None: return set()
        r0, r1, c0, c1 = w; X, Z = s.R.xz(w)
        lv = s.LAND[r0:r1, c0:c1] & (np.abs(s.SQ[r0:r1, c0:c1] - core['top'](X.ravel(), Z.ravel()).reshape(X.shape)) < tol(core['tipo'], core['ped']))
        n = lv[:-1, :-1].astype(int) + lv[:-1, 1:] + lv[1:, :-1] + lv[1:, 1:]
        cb = shapely.box(X[:-1, :-1], Z[:-1, :-1], X[:-1, :-1] + SF, Z[:-1, :-1] + SF); dcore = shapely.distance(cb, core['g'])
        # only lengthwise: a cell off the core's width would turn the bank by a footbridge into a platform with parapets round it
        nv = np.array([-core['dir'][1], core['dir'][0]]); v = np.asarray(core['g'].exterior.coords) @ nv
        vc = (X[:-1, :-1] + SF / 2) * nv[0] + (Z[:-1, :-1] + SF / 2) * nv[1]; band = (vc >= v.min() - SF / 2) & (vc <= v.max() + SF / 2)
        hit = (dcore <= REACH) & (n > 0) & band   # all four at level too: the deck edge then runs on lattice lines
        # an end with no ground at its level within REACH and no approach of its own (AIR) beyond it, where an OSM bridge goes on past it:
        # the DBGT PONTE is shorter than the bridge (PONTE 20, via Vignazzola: 33 m against 56 in OSM, the end 6 m over the trench). The
        # deck is carried on inside its width to the first ground at its level, at most EXT_MAX and no farther than OSM goes
        dv = np.asarray(core['dir'], float); u = np.asarray(core['g'].exterior.coords) @ dv; uc = (X[:-1, :-1] + SF / 2) * dv[0] + (Z[:-1, :-1] + SF / 2) * dv[1]
        k = getattr(s, 'air_own', None); own = (s.air_own == core['k']) if k is not None else np.zeros(0, bool)
        ua = (s.R.x0 + s.air_cc[own] * SF) * dv[0] + (s.R.z0 + s.air_rr[own] * SF) * dv[1] if own.any() else np.zeros(0)
        ext = set()
        for sg, end in ((-1, u.min()), (1, u.max())):
            beyond = sg * (uc - end) > -SF / 2                                   # cells at or past this end
            if (hit & beyond).any() or (sg * (ua - end) > 0).any(): continue
            ov = [sg * (np.asarray(wv['p']) @ dv - end).max() for wv in core.get('ob', [])]
            reach = min(EXT_MAX, max(ov, default=0.0) + SF)
            if reach <= REACH: continue
            cand = band & beyond & (n >= 2) & (dcore <= reach)   # a whole cell side on the ground: the lane lands on a lattice line
            if not cand.any(): s.info.setdefault('estremi_sospesi', []).append(dict(ponte=core['pid'], lato=sg, osm_oltre_m=round(max(ov, default=0.0), 1))); continue
            al = sg * (uc - end); fill = np.zeros(cand.shape, bool); land = np.zeros(cand.shape, bool)
            lane = np.indices(cand.shape)[0 if abs(dv[0]) >= abs(dv[1]) else 1]   # the lattice rows (or columns) closest to the deck direction
            for q in np.unique(lane[cand]):   # lane by lane (across the width): each runs on to its own first cell that reaches the ground
                m = lane == q; dl = al[cand & m].min()
                land |= cand & m & (al <= dl + SF / 2); fill |= band & beyond & m & (al < dl) & (dcore <= reach)
            # lanes that find no ground at the deck level go on as far as the others (a lower bank at their end, not the drop at the PONTE end)
            rest = band & beyond & ~np.isin(lane, np.unique(lane[cand])) & (al < al[land].max() - SF / 2) & (dcore <= reach); fill |= rest
            ext |= {(r0 + r, c0 + c) for r, c in zip(*np.nonzero(fill))}; hit |= land
            s.info.setdefault('estensioni', []).append(dict(ponte=core['pid'], lato=sg, metri=round(float(al[land].max() + SF / 2), 1), celle=int((fill | land).sum())))
        core['ext'] = ext
        return {(r0 + r, c0 + c) for r, c in zip(*np.nonzero(hit))} | ext

    def _clip(s, pts):  # the road-like polygons holding the points (the deck's own AIR nodes), with the fringe: not the street beside it
        _, js = s.roadt.query(pts, predicate='intersects'); js = np.unique(js)
        return shapely.union_all([s.roadp[j] for j in js]).buffer(sf.FRINGE) if len(js) else Polygon()

    def build(s, pits=()):
        t0 = time.time(); s.nuclei(); s.assegna(pits)
        # cells of each deck; a cell belongs to one deck only (an AIR corner first, else the nearest core)
        want = {}
        for k, c in enumerate(s.cores):
            m = s.air_own == k
            for rc in s.celle(s.air_rr[m], s.air_cc[m]): want.setdefault(rc, {})[('c', k)] = 0
            for rc in s.celle_spalla(c): want.setdefault(rc, {}).setdefault(('c', k), 1)
        for j, idx in enumerate(s.liberi):
            for rc in s.celle(s.air_rr[idx], s.air_cc[idx]): want.setdefault(rc, {})[('l', j)] = 0
        by = {}
        for rc, ks in want.items():
            ctr = s.cbox(rc).centroid
            q = min(ks, key=lambda q: (ks[q], s.cores[q[1]]['g'].distance(ctr) if q[0] == 'c' else 0.0)); by.setdefault(q, ([], []))[ks[q]].append(rc)
        for k, c in enumerate(s.cores):
            ca, cs = by.get(('c', k), ([], []))
            s._deck(c, ca, cs, 'PONTE %d' % c['pid'], np.nonzero(s.air_own == k)[0])
        for j, idx in enumerate(s.liberi):
            ca, _ = by.get(('l', j), ([], []))
            s._deck(None, ca, [], 'ponte non segnato', idx)
        s.info['t_impalcati'] = round(time.time() - t0, 1)
        return s.decks

    def _deck(s, core, cells_air, cells_sp, fonte, air_idx):
        ea = shapely.union_all([s.cbox(rc) for rc in cells_air]) if cells_air else Polygon()
        if not ea.is_empty:   # AIR cells: the sides follow the road polygons, the squares round the AIR nodes keep the patch in one piece
            sq = shapely.union_all(shapely.box(s.R.x0 + s.air_cc[air_idx] * SF - 1, s.R.z0 + s.air_rr[air_idx] * SF - 1, s.R.x0 + s.air_cc[air_idx] * SF + 1, s.R.z0 + s.air_rr[air_idx] * SF + 1))
            pts = shapely.points(s.R.x0 + s.air_cc[air_idx] * SF, s.R.z0 + s.air_rr[air_idx] * SF)
            ea = ea.intersection(s._clip(pts).union(sq).union(core['g'] if core else Polygon()))
        es = shapely.union_all([s.cbox(rc) for rc in cells_sp]) if cells_sp else Polygon()
        g = shapely.union_all([x for x in (core['g'] if core else None, ea, es) if x is not None and not x.is_empty])
        g = pulito(g.union(g.buffer(1.5, join_style=2).buffer(-1.5, join_style=2)))   # gaps under 3 m inside the deck closed
        if g.is_empty: return
        ps = sorted(parts(g), key=lambda p: -(p.intersection(core['g']).area if core else p.area))
        own = np.zeros(s.s.AIR.shape, bool); own[s.air_rr[air_idx], s.air_cc[air_idx]] = True
        for n, p in enumerate(ps):
            w = s.R.win(p.bounds, 0)
            if n and (p.area < 6.0 or not own[w[0]:w[1], w[2]:w[3]].any()):   # a loose bit of landing cells with no AIR node: nothing to carry
                s.info['pezzi_lasciati'] = s.info.get('pezzi_lasciati', 0) + 1; continue
            cr = core if (core is not None and n == 0) else None
            s._emit(p, cr, fonte if (cr is not None or core is None) else fonte + ' (pezzo staccato)', own, air_idx, core['tipo'] if core else None, core)

    def _emit(s, g, core, fonte, own, air_idx, tipo, parent):  # core: the PONTE whose top this piece carries; parent: the PONTE it comes from
        if tipo is None:  # a bridge the DBGT does not flag: what its AIR nodes are
            ts = [TYPE_OF_CLS.get(int(c_)) for c_ in s.s.CLS[s.air_rr[air_idx], s.air_cc[air_idx]]]; ts = [t for t in ts if t]
            tipo = max(set(ts), key=ts.count) if ts else 'strada'
        F = Campo(s, g, core, own, tipo); P, T = triangola(g, s.R); Hv = F(P)
        dv = core['dir'] if core else (parent['dir'] if parent else None)
        if dv is None:
            ob = [w for w in s.osm_br if LineString(w['p']).distance(g) < OSM_DIR]
            dv = direzione([q for w in ob for q in segs_line(LineString(w['p']).intersection(g.buffer(OSM_DIR)))]) if ob else None
        s.decks.append(dict(id=len(s.decks), tipo=tipo, fonte=fonte, imp=g, P=P, T=T, Hv=Hv, F=F, core=core, sp=SP[tipo],
                            dbgt=dict(ponte=core['pid'], assi_sopra=core['assi'], aree_sopra=core['aree'], z_ponte=core['z_dbgt']) if core else None,
                            area_nucleo=round(core['g'].area, 1) if core else 0.0, dir=dv if dv is not None else dir_rect(g)))

    # ----- the cover of the gallery: GALLER, less the stairwells at its ends
    def copertura(s, pits):
        G = s.D.get('GALLER')
        if G is None or len(G['off']) < 2: return None
        g0 = pulito(sf.poly(G, 0)); sel = [p for p in pits if p['g'].distance(g0) < 3.0]
        g = pulito(g0.difference(shapely.union_all([p['g'] for p in sel]))) if sel else g0
        g = max(parts(g), key=lambda p: p.area)
        P, T = triangola(g, s.R); Hv = s.Sat(P[:, 0], P[:, 1])   # the cover is the ground: the streets and the railway at grade run on it
        zg = G['z0'][G['off'][0]:G['off'][1]]; fondo = min([p['fondo'] for p in sel]) if sel else None
        d = dict(id=len(s.decks), tipo='copertura', fonte='GALLER %d' % int(G['id'][0]), imp=g, P=P, T=T, Hv=Hv, F=None, core=None, sp=SP['copertura'],
                 dbgt=dict(galler=int(G['id'][0]), ty=str(G['attr']['ty'][0]), z_galler=round(float(np.nanmedian(zg)), 2), z_galler_meno_S=round(float(np.nanmedian(zg) - np.median(Hv)), 2),
                           nota='la quota della GALLER sta sopra le strade e la ferrovia che le passano sopra: non usata; il passaggio e sotto (OSM tunnel, fosse)'),
                 area_nucleo=round(g0.area, 1), dir=dir_rect(g0), fondo=fondo, fosse=[p['id'] for p in sel])
        s.decks.append(d); return d


# ---------- pits ----------
def build_pits(imp):
    """The stairwells down to the underpasses: {imp, fondo, gradini}. landmarks3.js takes fondo = min(ground on the outline) - D; here the
    street level is S at the tops of the flights (the median), because the outline crosses the stair holes the LiDAR sees (down to 220.3 m
    where the street is at 223)."""
    out = []
    for n, q in enumerate(stairwells()):
        pts = []; (lx, lz), h = q['landing'], q['lw'] / 2
        for a, b, w in q['flights']:
            a, b = np.array(a, float), np.array(b, float); L = np.hypot(*(b - a)); nn = np.array([-(b[1] - a[1]), b[0] - a[0]]) / L * w / 2
            pts += [a + nn, a - nn, b + nn, b - nn]
        tv = np.array(q['tunnel'], float) - np.array([lx, lz]); tx, tz = tv / np.hypot(*tv)
        for u, v in ((-h, -h), (h, -h), (h, h), (-h, h)): pts.append(np.array([lx + tx * u - tz * v, lz + tz * u + tx * v]))
        ring = np.array(hull([tuple(p) for p in pts])); g = Polygon(ring)
        sr = imp.Sat(*densa(ring, 0.5).T); y0 = float(np.median(imp.Sat(*np.array([a for a, b, w in q['flights']], float).T))); fondo = y0 - q['D']
        gr = [dict(a=[round(a[0], 2), round(a[1], 2)], b=[round(b[0], 2), round(b[1], 2)], w=w, da=round(float(imp.Sat(a[0], a[1])[0]), 2), a_quota=round(fondo, 2)) for a, b, w in q['flights']]
        out.append(dict(id=n, n=q.get('n'), g=g, imp=np.round(ring, 2).tolist(), y0=round(y0, 2), y0_minimo_di_S=round(float(sr.min()), 2), fondo=round(fondo, 2), D=q['D'], gradini=gr,
                        pianerottolo=dict(c=[lx, lz], lw=q['lw'], dir=[round(float(tx), 4), round(float(tz), 4)]), tunnel=q['tunnel'], box=bool(q.get('box')), fonte='landmarks3.js STAIRWELLS'))
    return out


# ---------- roads on the decks (brianza.json, as it is today) and OSM ways ----------
def strade_bj(path):
    if not os.path.exists(path): return None
    d = json.load(open(path, encoding='utf-8')); n = np.array(d['nodes'], float).reshape(-1, 3); base = d['terrain'].get('base', 0.0)
    return dict(xy=n[:, :2] / 10, h=np.where(n[:, 2] == -32768, np.nan, n[:, 2] / 10 + base), roads=d['roads'])   # h: dm above terrain.base


class Linee:  # polylines [(key, xy)] with a tree
    def __init__(s, lines):
        s.k = [k for k, p in lines if len(p) >= 2]; s.g = [LineString(p) for k, p in lines if len(p) >= 2]; s.t = shapely.STRtree(s.g) if s.g else None
    def su(s, g): return [] if s.t is None else [(s.k[j], s.g[j]) for j in s.t.query(g, predicate='intersects')]


def sopra(g, dvec, linee, under_dirs, min_frac=0.3):  # which lines run on the footprint g (along it, not across under it)
    gb = g.buffer(MATCH_BUF); out = []; L = max(1.0, np.ptp(np.asarray(g.exterior.coords) @ dvec)) if dvec is not None else 1.0
    for j, ln in linee.su(gb):
        inn = ln.intersection(gb)
        if inn.length < max(2.0, min_frac * L): continue
        u = direzione(segs_line(inn))
        if u is None: continue
        a_on = ang(u, dvec) if dvec is not None else 0.0; a_un = min([ang(u, v) for v in under_dirs], default=90.0)
        if a_on < 35 and a_on < a_un: out.append((j, inn.length))
    return out


# ---------- controls ----------
def bordi(T):  # boundary edges of a triangulation (edges of one triangle only), with the third vertex
    E = np.vstack((T[:, [0, 1, 2]], T[:, [1, 2, 0]], T[:, [2, 0, 1]])); key = np.sort(E[:, :2], 1)
    _, inv, cnt = np.unique(key, axis=0, return_inverse=True, return_counts=True); inv = inv.ravel()
    return E[cnt[inv] == 1]


def leggi_S(imp, tdir):  # S read back from the .bin (what the game will draw), else the in-memory one
    sup = imp.s; SB = imp.SQ.copy(); nb = 0
    if tdir and os.path.isdir(tdir):
        for tile in sup.tiles:
            f = os.path.join(tdir, '%d_%d.bin' % tile)
            if not os.path.exists(f): continue
            st, h, _ = sf.leggi_bin(f)
            if st == SF: r0, r1, c0, c1 = sup.tile_win(*tile); SB[r0:r1, c0:c1] = h; nb += 1
    return SB, nb


def sotto(imp, d, SB):  # the lattice nodes under the footprint: clearance, what is there, how far under S the deck is
    R = imp.R; sup = imp.s; g = d['imp']; w = R.win(g.bounds, SF); X, Z = R.xz(w); X, Z = X.ravel(), Z.ravel(); k = shapely.contains_xy(g, X, Z); X, Z = X[k], Z[k]
    if not len(X): return None
    ri, ci = np.round((Z - R.z0) / SF).astype(int), np.round((X - R.x0) / SF).astype(int); sn = SB[ri, ci]
    hv = d['F'](np.column_stack((X, Z))) if d['F'] is not None else imp.Sat(X, Z)
    sp_lines = [LineString([(q[0], q[1]), (q[2], q[3])]) for q in d.get('spalle', [])]
    far = shapely.distance(shapely.union_all(sp_lines), shapely.points(X, Z)) > 4.0 if sp_lines else np.ones(len(X), bool)
    cl, fx = sup.CLS[ri, ci], sup.FIX[ri, ci]
    far &= sup.BR[ri, ci] & (hv - sn > LEVEL_TOL)   # under the span (PONTE footprint, AIR nodes), not ground at the deck level (abutment)
    return dict(X=X, Z=Z, sn=sn, hv=hv, far=far, cl=cl, fx=fx)


def spalla_lati(imp, d, a, b, SB):
    """Boundary edges (a, b) lying on a lattice edge whose two nodes are both where this deck lands (Campo.land: ground of its kind within
    LEVEL_TOL of the DBGT top). The rest of the outline is the deck side (an edge from a landing node down the bank is a side too)."""
    R = imp.R; fx = lambda v, o: (v - o) / SF; out = np.zeros(len(a), bool)
    for ax, o_on, o_al in ((0, R.x0, R.z0), (1, R.z0, R.x0)):   # edges on a line x = const (ax 0) or z = const (ax 1)
        ua, ub = fx(a[:, ax], o_on), fx(b[:, ax], o_on)
        on = (np.abs(ua - np.round(ua)) < 1e-3) & (np.abs(ub - np.round(ub)) < 1e-3) & (np.round(ua) == np.round(ub))
        va, vb = fx(a[:, 1 - ax], o_al), fx(b[:, 1 - ax], o_al); k0 = np.floor(np.minimum(va, vb) + 1e-6).astype(int)
        on &= np.maximum(va, vb) <= k0 + 1 + 1e-6
        if not on.any(): continue
        line = np.round(ua).astype(int)
        r0, c0 = (k0, line) if ax == 0 else (line, k0); r1, c1 = (k0 + 1, line) if ax == 0 else (line, k0 + 1)
        ok = on & (r0 >= 0) & (c0 >= 0) & (r1 < R.nz) & (c1 < R.nx)
        for rr, cc in ((r0, c0), (r1, c1)): ok &= d['F'].approda(rr, cc)
        out |= ok
    return out


def controlli(imp, decks, pits, osm, conf, bj, SB, nb):
    R = imp.R; rep = {}; punti = []; S_ = lambda x, z: tri_interp(SB, R, x, z); byid = {w['id']: w for w in osm}
    c5, c5p, mosso, estremi, sospesi = [], [], [], [], []
    for d in decks:
        P, T, Hv = d['P'], d['T'], d['Hv']; d['spalle'] = []
        if not len(T) or d['tipo'] == 'copertura': d['lati'] = dict(n=0); continue
        E = bordi(T); a, b, c = P[E[:, 0]], P[E[:, 1]], P[E[:, 2]]; m = (a + b) / 2
        t = b - a; nrm = np.column_stack((-t[:, 1], t[:, 0])) / np.maximum(np.hypot(*t.T), 1e-9)[:, None]
        nrm *= np.where(((c - m) * nrm).sum(1) > 0, -1, 1)[:, None]               # outwards
        q = m + nrm * 0.75; hm = (Hv[E[:, 0]] + Hv[E[:, 1]]) / 2
        ri, ci = np.clip(np.round((q[:, 1] - R.z0) / SF).astype(int), 0, R.nz - 1), np.clip(np.round((q[:, 0] - R.x0) / SF).astype(int), 0, R.nx - 1)
        sq = S_(q[:, 0], q[:, 1]); ha, hb = Hv[E[:, 0]], Hv[E[:, 1]]
        sp_ = spalla_lati(imp, d, a, b, SB); strada = sp_ & imp.ROAD[ri, ci]
        d['lati'] = dict(n=int(len(E)), spalla=int(sp_.sum()), spalla_su_strada=int(strada.sum()), salto_sui_lati=pct(hm[~sp_] - sq[~sp_], (10, 50)))
        for e in np.nonzero(sp_)[0]:
            A, B = a[e], b[e]; ha, hb = Hv[E[e, 0]], Hv[E[e, 1]]
            ts = np.linspace(0, 1, 5); X = A + (B - A) * ts[:, None]; dz = np.abs(ha + (hb - ha) * ts - S_(X[:, 0], X[:, 1]))
            c5.append(dz.max()); j = int(np.argmax(dz)); c5p.append((dz.max(), X[j], d['id']))
            d['spalle'].append([round(A[0], 2), round(A[1], 2), round(B[0], 2), round(B[1], 2)])
        if d['F'] is not None and len(d['F'].r): mosso += list(np.abs(d['F'].r))
        d['c5_max'] = round(float(max([v for v, _, k in c5p if k == d['id']], default=0.0)), 3)
        # where the OSM ways on the deck leave it (on the outline grown by MATCH_BUF, as they were matched: OSM runs 3-4 m off at PONTE 20):
        # with no spalla within 3 m of the nearest deck point that end is in the air (stairs, a ramp the DBGT has not, a wrong Z)
        spl = [LineString([(q_[0], q_[1]), (q_[2], q_[3])]) for q_ in d['spalle']]; gb = d['imp'].buffer(MATCH_BUF)
        ue = np.asarray(d['imp'].exterior.coords) @ np.asarray(d['dir'])   # the ends of the deck along its direction
        us = np.array([[q_[0] + q_[2], q_[1] + q_[3]] for q_ in d['spalle']]) / 2 @ np.asarray(d['dir']) if d['spalle'] else np.zeros(0)
        for nm_, e_ in (('inizio', ue.min()), ('fine', ue.max())):   # an end of the deck with no spalla within 4 m of it lands nowhere
            if not (np.abs(us - e_) < 4.0).any():
                p_ = np.asarray(d['imp'].exterior.coords)[np.argmin(np.abs(ue - e_))]
                sospesi.append(dict(impalcato=d['id'], fonte=d['fonte'], tipo=d['tipo'], estremo=nm_, x=round(float(p_[0]), 1), z=round(float(p_[1]), 1), link=link(*p_)))
        for oid in d.get('osm', []):
            ln = LineString(byid[oid]['p']); xs = ln.intersection(gb.exterior)
            for c_ in [Point(g_.coords[0]) for g_ in getattr(xs, 'geoms', [xs]) if g_.geom_type == 'Point']:
                pt = np.array(shapely.ops.nearest_points(d['imp'].exterior, c_)[0].coords[0])
                if spl and min(l_.distance(Point(pt)) for l_ in spl) < 3.0: continue
                if min(abs(pt @ d['dir'] - ue.min()), abs(ue.max() - pt @ d['dir'])) > 3.0: continue   # beside the deck (OSM a few m off), not at an end
                s0 = ln.project(c_); out_ = [np.array(ln.interpolate(s0 + k_).coords[0]) for k_ in (-1.5, 1.5)]
                out_ = [o for o in out_ if not gb.contains(Point(o))]
                if not out_: continue
                gap = float(d['F'](pt[None])[0] - S_(out_[0][0], out_[0][1]))
                estremi.append(dict(impalcato=d['id'], fonte=d['fonte'], tipo=d['tipo'], osm=oid, salto=round(gap, 2), x=round(float(pt[0]), 1), z=round(float(pt[1]), 1), link=link(*pt)))
    # slope of the decks (C6 for the objects): the triangles, and along the OSM ways on them (4 m base, both ends on the deck)
    ripide, prof = [], []
    for d in decks:
        if d['tipo'] == 'copertura' or not len(d['T']): continue
        P, T, Hv = d['P'], d['T'], d['Hv']; u, v = P[T[:, 1]] - P[T[:, 0]], P[T[:, 2]] - P[T[:, 0]]; hu, hv = Hv[T[:, 1]] - Hv[T[:, 0]], Hv[T[:, 2]] - Hv[T[:, 0]]
        det = u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]; gx = (hu * v[:, 1] - hv * u[:, 1]) / det; gz = (hv * u[:, 0] - hu * v[:, 0]) / det; sl = np.hypot(gx, gz)
        d['pendenza_triangoli'] = pct(sl, (50, 99)); d['triangoli_sopra_18'] = int((sl > 0.18).sum())
        for j in np.argsort(-sl)[:3]:
            if sl[j] > 0.18: c3 = P[T[j]].mean(0); ripide.append(dict(impalcato=d['id'], fonte=d['fonte'], pendenza=round(float(sl[j]), 3), x=round(float(c3[0]), 1), z=round(float(c3[1]), 1), link=link(*c3)))
        gi = d['imp'].buffer(-0.5)
        for oid in d.get('osm', []):
            ln = LineString(byid[oid]['p']).intersection(gi)
            for q_ in getattr(ln, 'geoms', [ln]):
                if q_.geom_type != 'LineString' or q_.length < 5: continue
                X = np.array([q_.interpolate(s0).coords[0] for s0 in np.arange(0, q_.length, 1.0)]); h = d['F'](X)
                g4 = np.abs(h[4:] - h[:-4]) / 4; j = int(np.argmax(g4)); prof.append(float(g4[j]))
                d['pendenza_vie'] = max(d.get('pendenza_vie', 0.0), round(float(g4[j]), 3))
                if g4[j] > 0.18: ripide.append(dict(impalcato=d['id'], fonte=d['fonte'], osm=oid, pendenza_via=round(float(g4[j]), 3), x=round(float(X[j + 2, 0]), 1), z=round(float(X[j + 2, 1]), 1), link=link(*X[j + 2])))
    rep['C6_impalcati'] = dict(definizione='pendenza dei triangoli degli impalcati e lungo le vie OSM sopra (base 4 m, dentro l impronta)', pendenza_lungo_le_vie=pct(prof, (50, 99)),
                               triangoli=pct([v_ for d in decks for v_ in ([d['pendenza_triangoli']['max']] if d.get('pendenza_triangoli') and d['pendenza_triangoli'].get('n') else [])], (50,)),
                               triangoli_sopra_18=sum(d.get('triangoli_sopra_18', 0) for d in decks), vie_sopra_18=sum(1 for v_ in prof if v_ > 0.18), elenco=ripide[:40], soglia='< 18 % lungo le vie')
    rep['C6_impalcati']['ok'] = rep['C6_impalcati']['vie_sopra_18'] == 0
    c5 = np.array(c5)
    rep['C5'] = dict(definizione='spalle: lati del bordo dell impalcato su un lato del reticolo i cui due nodi sono terreno dove l impalcato appoggia (fuori dai ponti, a meno di %.1f m dal piano DBGT); |TIN impalcato - S letto dai .bin| agli estremi del lato e a 1/4, 1/2, 3/4' % LEVEL_TOL,
                     tile_bin_lette=nb, lati_spalla=int(len(c5)), lati_spalla_su_strada=sum(d['lati'].get('spalla_su_strada', 0) for d in decks), spalle=pct(c5, (50, 90, 99)),
                     impalcati_con_spalle=sum(1 for d in decks if d['spalle']), tirata_del_piano_DBGT_verso_S=pct(mosso, (50, 90, 99)),
                     uscite_vie_osm_senza_spalla=estremi, estremi_senza_spalla=sospesi, soglia='p99 < 0.05 m, max < 0.2 m')
    rep['C5']['ok'] = bool(len(c5) and rep['C5']['spalle']['p99'] < 0.05 and rep['C5']['spalle']['max'] < 0.2)
    for v, X, k in sorted(c5p, key=lambda q: -q[0])[:10]: punti.append(dict(c='C5', x=round(float(X[0]), 1), z=round(float(X[1]), 1), v=round(float(v), 3), impalcato=k, link=link(*X)))
    # clearance under each deck away from the spalle, what is under it, luce
    bassa = []
    for d in decks:
        u = sotto(imp, d, SB)
        if u is None: d['luce'] = None; continue
        d['S_min'] = float(u['sn'].min())
        if d['tipo'] == 'copertura':   # under the cover is the passage: luce is its floor + LUCE; S over it dips where the LiDAR has the stair holes
            d['luce'] = round(d['fondo'] + LUCE if d.get('fondo') is not None else float(d['Hv'].min()) - d['sp'], 2)
            # the lattice cells across the pit outline take the stair holes of the LiDAR: the rim (1 m) is the pit's own wall, not the cover
            pu = shapely.union_all([p['g'] for p in pits]) if pits else Polygon()
            hv = d['Hv'][shapely.distance(pu, shapely.points(d['P'][:, 0], d['P'][:, 1])) > 1.0] if not pu.is_empty else d['Hv']
            d['S_sopra'] = dict(mediana=round(float(np.median(d['Hv'])), 2), minimo=round(float(d['Hv'].min()), 2), minimo_oltre_1_m_dalle_fosse=round(float(hv.min()), 2),
                                altezza_libera_min=round(float(hv.min()) - d['sp'] - d['fondo'], 2) if d.get('fondo') is not None else None); continue
        d['luce'] = round(d['S_min'] + LUCE, 2); free = u['hv'] - d['sp'] - u['sn']; far, cl, fx = u['far'], u['cl'], u['fx']
        d['sotto'] = dict(strade=int((fx & np.isin(cl, (C_VEI, C_VEIT, C_PED, C_AREA)) & far).sum()), ferrovia=int((fx & (cl == C_FER) & far).sum()),
                          fiume=int((fx & np.isin(cl, (C_ALV, C_ARG)) & far).sum()), terreno=int((~fx & far).sum()))
        d['franco'] = {}
        for nm, sel in (('strade', fx & np.isin(cl, (C_VEI, C_VEIT, C_PED, C_AREA))), ('ferrovia', fx & (cl == C_FER)), ('fiume', fx & np.isin(cl, (C_ALV, C_ARG)))):
            m = sel & far
            if m.any():
                fm = float(free[m].min()); d['franco'][nm] = round(fm, 2)
                if fm < LUCE: j = np.argmin(np.where(m, free, np.inf)); bassa.append(dict(impalcato=d['id'], fonte=d['fonte'], sopra=nm, franco=round(fm, 2), x=round(float(u['X'][j]), 1), z=round(float(u['Z'][j]), 1), link=link(u['X'][j], u['Z'][j])))
    # OSM bridges inside the comune with no DBGT deck near (spec 4), DBGT bridges with nothing on top
    cores = [d for d in decks if d['core'] is not None]; others = [d for d in decks if d['core'] is None and d['tipo'] != 'copertura']
    cu = shapely.union_all([d['core']['g'] for d in cores]) if cores else Polygon(); ou = shapely.union_all([d['imp'] for d in others]) if others else Polygon()
    senza, coperti = [], []
    for wv in osm:
        if not is_bridge(wv['t']): continue
        ln = LineString(wv['p'])
        if conf is not None and not ln.intersects(conf): continue
        if ln.distance(cu) <= OSM_NEAR: continue
        e = dict(osm=wv['id'], tipo=wv['t'].get('highway') or wv['t'].get('railway'), nome=wv['t'].get('name'), lunghezza=round(ln.length, 1),
                 x=round(ln.centroid.x, 1), z=round(ln.centroid.y, 1), link=link(ln.centroid.x, ln.centroid.y))
        if not ou.is_empty and ln.distance(ou) <= OSM_NEAR: e['impalcato'] = [d['id'] for d in others if ln.distance(d['imp']) <= OSM_NEAR]; coperti.append(e)
        else: senza.append(e)
    nulla = [dict(impalcato=d['id'], ponte=d['dbgt']['ponte'], tipo=d['tipo'], x=round(d['imp'].centroid.x, 1), z=round(d['imp'].centroid.y, 1), aree_sopra=d['dbgt']['aree_sopra'])
             for d in cores if not d['dbgt']['assi_sopra'] and not d.get('osm')]
    rep['C11'] = dict(definizione='bridge OSM dentro il comune senza PONTE DBGT entro %.0f m; PONTE senza assi SED=02 ne vie OSM sopra; franco (fondo dell impalcato - S) sotto %.1f m su strade, ferrovia o fiume sotto la campata (impronta PONTE e nodi AIR, dove S sta piu di %.1f m sotto il piano), a piu di 4 m dalle spalle' % (OSM_NEAR, LUCE, LEVEL_TOL),
                      osm_bridge_senza_ponte_dbgt=senza, osm_bridge_su_ponti_non_segnati=coperti, ponti_senza_strada_sopra=nulla, franco_sotto_2_5=bassa,
                      conteggi=dict(osm_senza_ponte=len(senza), osm_su_ponti_non_segnati=len(coperti), ponti_senza_strada=len(nulla), franco_basso=len(bassa)), soglia='informativo')
    punti += [dict(c='C11', x=e['x'], z=e['z'], v=e['franco'], link=e['link']) for e in bassa[:10]]
    if bj is not None:   # the deck heights against the nodes of today's road graph (phase 4 recomputes nodes.h from the decks)
        dv, ns = [], 0
        for d in decks:
            for j in d.get('ra', []):
                g = np.array(bj['roads'][j]['g']); xy = bj['xy'][g]; k = shapely.contains_xy(d['imp'], xy[:, 0], xy[:, 1])
                if not k.any(): continue
                ns += int(k.sum()); hv = d['F'](xy[k]); ho = bj['h'][g[k]]; dv += list((hv - ho)[~np.isnan(ho)])
        rep['nodi_su_impalcato'] = dict(definizione='nodi delle strade ra di brianza.json di oggi dentro l impronta: quota dell impalcato nuovo - quota di oggi (deckH), dove oggi c e', nodi=ns, scarto=pct(dv, (10, 50, 90)))
    return rep, punti


# ---------- output ----------
def scrivi_json(decks, pits, path, info):
    out = []
    for d in decks:
        tri = np.round(d['P'][d['T']], 2); y = d['Hv'][d['T']]; u, v = tri[:, 1] - tri[:, 0], tri[:, 2] - tri[:, 0]
        k = np.abs(u[:, 0] * v[:, 1] - u[:, 1] * v[:, 0]) > 2e-3   # slivers that rounding to the cm flattens: they cover nothing
        flat = np.stack((tri[k][..., 0], tri[k][..., 1], y[k]), -1).reshape(-1)
        e = dict(id=d['id'], tipo=d['tipo'], imp=np.round(np.asarray(d['imp'].exterior.coords)[:-1], 2).tolist(), tri=np.round(flat, 2).tolist(), sp=d['sp'],
                 luce=d.get('luce'), ra=d.get('ra', []), fonte=d['fonte'], top=[round(float(d['Hv'].min()), 2), round(float(d['Hv'].max()), 2)], spalle=d.get('spalle', []), osm=d.get('osm', []))
        if list(d['imp'].interiors): e['buchi'] = [np.round(np.asarray(r.coords)[:-1], 2).tolist() for r in d['imp'].interiors]
        if d['core'] is not None: e['nucleo'] = np.round(np.asarray(d['core']['g'].exterior.coords)[:-1], 2).tolist()   # the PONTE outline: parapets go here
        for k in ('dbgt', 'fondo', 'fosse', 'tn', 'franco', 'sotto'):
            if d.get(k) is not None: e[k] = d[k]
        out.append(e)
    pz = [{k: v for k, v in p.items() if k != 'g'} for p in pits]
    json.dump(dict(fase=3, formato='docs/motore.md 1.5: tri = triangoli del piano di sopra, 9 numeri per triangolo ((x, z, y) x 3), m; imp = impronta; spalle = lati [x1, z1, x2, z2] dove l impalcato appoggia su S; nucleo = impronta PONTE (i parapetti), il resto di imp sono rampe e appoggi sul reticolo; luce = min S sotto + 2.5; ra = indici di roads[] nel brianza.json di oggi; osm = id delle vie OSM sopra',
                   info=info, decks=out, pits=pz), open(path, 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    return os.path.getsize(path)


def immagini(imp, decks, pits, path):
    """One crop per deck, 120 m at 0.5 m per pixel: shaded S, the deck tinted by type, its outline in white, spalle in black, pits in red."""
    R = imp.R; col = dict(strada=(230, 140, 40), ferro=(150, 80, 190), pedonale=(60, 170, 80), copertura=(50, 120, 220)); n = 240; tiles = []
    def pix(q, xs, zs):
        i_, j_ = np.round((q[:, 1] - zs[0]) / 0.5).astype(int), np.round((q[:, 0] - xs[0]) / 0.5).astype(int); k = (i_ >= 0) & (i_ < n) & (j_ >= 0) & (j_ < n); return i_[k], j_[k]
    for d in decks:
        c = d['imp'].centroid; xs = c.x - 60 + np.arange(n) * 0.5; zs = c.y - 60 + np.arange(n) * 0.5; X, Z = np.meshgrid(xs, zs)
        H = tri_interp(imp.SQ, R, X.ravel(), Z.ravel()).reshape(n, n); sh = sf.shade(H, 0.5, 2.0)
        lo, hi = np.percentile(H, 2), np.percentile(H, 98); t = np.clip((H - lo) / max(hi - lo, 0.5), 0, 1)[..., None]
        img = ((1 - t) * np.array([90, 110, 90]) + t * np.array([225, 215, 190])) * (0.35 + 0.65 * sh[..., None])
        for e in decks:
            if e['imp'].distance(c) > 90: continue
            m = shapely.contains_xy(e['imp'], X, Z); img[m] = img[m] * 0.45 + np.array(col[e['tipo']]) * 0.55
            for r in anelli_di(e['imp']): img[pix(densa(r, 0.25), xs, zs)] = (255, 255, 255)
            for s_ in e.get('spalle', []):
                i_, j_ = pix(np.linspace([s_[0], s_[1]], [s_[2], s_[3]], 12), xs, zs)
                for di in (-1, 0, 1): img[np.clip(i_ + di, 0, n - 1), j_] = (0, 0, 0)
        for p in pits: img[pix(densa(np.array(p['imp']), 0.25), xs, zs)] = (220, 30, 30)
        img[:2] = img[-2:] = img[:, :2] = img[:, -2:] = (30, 30, 30); tiles.append(img)
    cols = 6; rows = int(np.ceil(len(tiles) / cols)); big = np.full((rows * n, cols * n, 3), 40.0)
    for k, t in enumerate(tiles): big[(k // cols) * n:(k // cols + 1) * n, (k % cols) * n:(k % cols + 1) * n] = t
    sf.png(path, big)


def build_decks(comune='Meda', out=None):
    """docs/motore.md fase 3: (decks, pits, Impalcati) of the comune, on the surface of superficie.costruisci()"""
    s = sf.costruisci(comune, cache_dir=out); R = s.R
    lo_, la_ = dq.game_to_lonlat(np.array([R.x0 - 50, R.x0 + R.nx * SF + 50]), np.array([R.z0 + R.nz * SF + 50, R.z0 - 50]))
    osm = osm_vie(os.path.join(dq.DATA, 'osm', 'maplarge.osm'), (lo_[0], la_[0], lo_[1], la_[1]), os.path.join(out, 'cache_osm_vie.pkl') if out else None)
    imp = Impalcati(s, osm); pits = build_pits(imp); decks = imp.build(pits); imp.copertura(pits)
    return imp.decks, pits, imp


def main(argv=None):
    ap = argparse.ArgumentParser(description='Impalcati e fosse (fase 3): decks_meda.json e report_fase3.json')
    ap.add_argument('--out', default=os.path.normpath(os.path.join(HERE, '..', '..', 'motore_out')))
    ap.add_argument('--comune', default='Meda'); ap.add_argument('--no-png', action='store_true'); ap.add_argument('--accetta', action='store_true')
    a = ap.parse_args(argv)
    decks, pits, imp = build_decks(a.comune, a.out); s = imp.s; osm = imp.osm
    bj = strade_bj(os.path.join(HERE, '..', 'brianza.json')); log('impalcati %d, osm %d vie, brianza.json %s strade' % (len(decks), len(osm), len(bj['roads']) if bj else 'senza'))
    # what runs on each deck: today's roads (ra, tn) and the OSM ways
    L_bj = Linee([(j, bj['xy'][r['g']]) for j, r in enumerate(bj['roads'])] if bj else [])
    L_tn = Linee([(j, bj['xy'][r['g']]) for j, r in enumerate(bj['roads']) if r.get('u') or r.get('t')] if bj else [])
    L_osm = Linee([(k, w['p']) for k, w in enumerate(osm) if not is_tunnel(w['t'])])
    for d in decks:
        g = d['imp']
        if d['tipo'] == 'copertura':
            d['osm'] = sorted(w['id'] for w in osm if is_tunnel(w['t']) and LineString(w['p']).intersection(g.buffer(MATCH_BUF)).length > 0.5 * min(LineString(w['p']).length, 10))
            d['tn'] = [j for j, _ in sopra(g, d['dir'], L_tn, [])]; continue
        ud = imp.under_dirs(g)
        d['ra'] = sorted(j for j, _ in sopra(g, d['dir'], L_bj, ud)); d['osm'] = sorted({osm[k]['id'] for k, _ in sopra(g, d['dir'], L_osm, ud)})
    SB, nb = leggi_S(imp, os.path.join(a.out, 'terreno'))
    # a PONTE whose top is under the ground is not a bridge one can see (PONTE 4: 2.3 m under the LiDAR, nothing under it)
    scart = []
    for d in decks:
        u = sotto(imp, d, SB)
        if u is not None and d['tipo'] != 'copertura' and np.median(u['hv'] - u['sn']) < -UNDER_MIN:
            scart.append(dict(fonte=d['fonte'], motivo='sotto il terreno di %.1f m (mediana)' % -np.median(u['hv'] - u['sn']), x=round(d['imp'].centroid.x, 1), z=round(d['imp'].centroid.y, 1), dbgt=d['dbgt'], link=link(d['imp'].centroid.x, d['imp'].centroid.y)))
            d['scartato'] = True
    decks = [d for d in decks if not d.get('scartato')]
    for n, d in enumerate(decks): d['id'] = n
    rep, punti = controlli(imp, decks, pits, osm, s.conf, bj, SB, nb)
    ponti = sorted({d['dbgt']['ponte'] for d in decks if d['dbgt'] and 'ponte' in d['dbgt']})
    per_tipo = {t: sum(1 for d in decks if d['tipo'] == t) for t in ('strada', 'ferro', 'pedonale', 'copertura')}
    cop = [d for d in decks if d['tipo'] == 'copertura']
    info = dict(comune=a.comune, offset_m=s.info['offset']['valore'], impalcati=len(decks), per_tipo=per_tipo, ponti_dbgt=len(imp.D['PONTE']['off']) - 1,
                ponti_dbgt_riconosciuti=len(ponti), ponti_non_segnati=sum(1 for d in decks if d['fonte'].startswith('ponte non segnato')),
                pezzi_staccati=sum(1 for d in decks if 'staccato' in d['fonte']), copertura=bool(cop), fosse=len(pits), **imp.info)
    size = scrivi_json(decks, pits, os.path.join(a.out, 'decks_meda.json'), info)
    if not a.no_png: immagini(imp, decks, pits, os.path.join(a.out, 'impalcati_meda.png'))
    elenco = []
    for d in decks:
        e = dict(id=d['id'], tipo=d['tipo'], fonte=d['fonte'], x=round(d['imp'].centroid.x, 1), z=round(d['imp'].centroid.y, 1), area=round(d['imp'].area, 1), area_nucleo=d['area_nucleo'],
                 triangoli=int(len(d['T'])), area_triangoli_su_impronta=round(float(aree(d['P'], d['T']).sum() / max(d['imp'].area, 1e-9)), 3) if len(d['T']) else 0,
                 top=[round(float(d['Hv'].min()), 2), round(float(d['Hv'].max()), 2)], luce=d.get('luce'), franco=d.get('franco'), sotto=d.get('sotto'), lati=d.get('lati'),
                 spalle=len(d.get('spalle', [])), c5_max=d.get('c5_max'), pendenza_triangoli=d.get('pendenza_triangoli'), pendenza_vie=d.get('pendenza_vie'), ra=d.get('ra', []), osm=d.get('osm', []), dbgt=d.get('dbgt'), link=link(d['imp'].centroid.x, d['imp'].centroid.y))
        if d['F'] is not None and len(d['F'].r): e['tirata_verso_S'] = pct(np.abs(d['F'].r), (50, 99))
        if d['F'] is not None and (d['F'].salti or d['F'].dispari): e['nodi_air_non_usati'] = dict(salto_dal_nucleo=d['F'].salti, fuori_dai_vicini=d['F'].dispari)
        for k in ('fondo', 'fosse', 'tn', 'S_sopra'):
            if d.get(k) is not None: e[k] = d[k]
        elenco.append(e)
    cu = shapely.union_all([p['g'] for p in pits] + [d['imp'] for d in cop])   # OSM underpasses with no pit or cover (informative)
    sottopassi = [dict(osm=w['id'], tipo=w['t'].get('highway'), nome=w['t'].get('name'), x=round(LineString(w['p']).centroid.x, 1), z=round(LineString(w['p']).centroid.y, 1), link=link(*LineString(w['p']).centroid.coords[0]))
                  for w in osm if is_tunnel(w['t']) and w['t'].get('highway') in ('footway', 'cycleway', 'path', 'steps', 'pedestrian') and LineString(w['p']).intersects(s.conf) and LineString(w['p']).distance(cu) > 10]
    steps = [LineString(w['p']) for w in osm if w['t'].get('highway') == 'steps']; tun = [LineString(w['p']) for w in osm if is_tunnel(w['t']) and w['t'].get('highway')]
    fosse = [dict(fossa=p['id'], n=p['n'], y0=p['y0'], y0_minimo_di_S=p['y0_minimo_di_S'], fondo=p['fondo'], D=p['D'],
                  scale_osm_piu_vicine_m=[round(min(l.distance(LineString([g_['a'], g_['b']])) for l in steps), 1) if steps else None for g_ in p['gradini']],
                  galleria_osm_dal_pianerottolo_m=round(min(l.distance(Point(p['pianerottolo']['c'])) for l in tun), 1) if tun else None) for p in pits]
    esito = dict(C5=rep['C5']['ok'], ponti_18=len(ponti) >= 18, copertura=info['copertura'])
    out = dict(fase=3, comune=a.comune, parametri=dict(spessori=SP, luce=LUCE, livello_spalla_m=LEVEL_TOL, raccordo_spalle_m=RC, anello_ponte_scartato_m=BAD_RING, assegna_air_m=ASSIGN_D,
                                                       sotto_terreno_m=UNDER_MIN, osm_vicino_m=OSM_NEAR, buffer_confronto_vie_m=MATCH_BUF),
               sintesi=info, impalcati=elenco, scartati=scart, fosse=fosse, sottopassi_osm_senza_fossa=sottopassi, **rep, punti_da_guardare=punti[:50],
               file=dict(decks='decks_meda.json', peso_kb=round(size / 1024, 1), immagine='impalcati_meda.png'), esito=esito,
               tempi_s=dict(s.t, impalcati=imp.info['t_impalcati'], totale=round(time.time() - T0, 1)))
    json.dump(out, open(os.path.join(a.out, 'report_fase3.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=float)
    log('impalcati %d %s; PONTE riconosciuti %d su %d; non segnati %d; pezzi staccati %d; copertura %s; fosse %d; scartati %s' % (
        len(decks), per_tipo, len(ponti), info['ponti_dbgt'], info['ponti_non_segnati'], info['pezzi_staccati'], info['copertura'], len(pits), [e['fonte'] for e in scart]))
    log('C5 spalle %s (lati %d, su strada %d), tirata del piano DBGT verso S %s, uscite di vie OSM senza spalla %d, estremi senza spalla %s' % (rep['C5']['spalle'], rep['C5']['lati_spalla'], rep['C5']['lati_spalla_su_strada'],
        rep['C5']['tirata_del_piano_DBGT_verso_S'], len(rep['C5']['uscite_vie_osm_senza_spalla']), [(e['fonte'], e['estremo']) for e in rep['C5']['estremi_senza_spalla']]))
    if imp.info.get('estensioni'): log('estremi allungati fino al terreno: %s' % imp.info['estensioni'])
    log('C6 impalcati: lungo le vie %s, sopra il 18%% %d; triangoli sopra il 18%% %d' % (rep['C6_impalcati']['pendenza_lungo_le_vie'], rep['C6_impalcati']['vie_sopra_18'], rep['C6_impalcati']['triangoli_sopra_18']))
    log('C11 %s' % rep['C11']['conteggi'])
    if 'nodi_su_impalcato' in rep: log('nodi di oggi sugli impalcati: %d, scarto %s' % (rep['nodi_su_impalcato']['nodi'], rep['nodi_su_impalcato']['scarto']))
    log('esito %s -> %s (%.0f KB)' % (esito, 'ok' if all(esito.values()) else 'FUORI SOGLIA', size / 1024))
    return 0 if all(esito.values()) or a.accetta else 2


if __name__ == '__main__':
    sys.exit(main())
