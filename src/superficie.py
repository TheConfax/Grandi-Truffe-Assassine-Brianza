# Motore nuovo, fase 2 (docs/motore.md 1.1-1.4, 2.2, 5): the single ground surface S. It is computed once for the whole test area (the
# tiles touching the comune plus 250 m) on one 2 m lattice anchored on the tile corners, so neighbouring tiles share their border nodes by
# construction; then it is cut into tiles of 2 m or 10 m and written as terreno/<tx>_<tz>.bin. Grown out of src/mondo/terreno_unico.py.
# Heights come from src/dbgt_quote.py (clean DBGT Z, comune offset removed). No change to the game yet.
#   python src/superficie.py [--out DIR] [--comune Meda] [--margine 250] [--blend 4] [--no-png] [--accetta]
import os, sys, json, time, gzip, struct, zlib, pickle, argparse, sqlite3
import xml.etree.ElementTree as ET
import numpy as np, shapely
from shapely.geometry import Polygon, LineString, box
from pyproj import Transformer
from scipy import ndimage, sparse
import scipy.sparse.linalg
from scipy.spatial import cKDTree
from scipy.interpolate import LinearNDInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq
from dbgt_quote import DATA, KX, KZ, LAT0, LON0, FT_RAW, FT_NONE

# map frame, as src/build.py and the game: tile i,j has its corner at (-META.hw + i*TILE, -META.hh + j*TILE)
BBOX = (45.6345, 45.6805, 9.117, 9.191)        # S N W E
HW_X, HH_X = (BBOX[3] - BBOX[2]) / 2 * KX, (BBOX[1] - BBOX[0]) / 2 * KZ
HW, HH = round(HW_X, 1), round(HH_X, 1)          # what META.hw/hh carry and the game uses
TILE = 250.0
NTX, NTZ = int(np.ceil(2 * HW_X / TILE)), int(np.ceil(2 * HH_X / TILE))
SF, SC = 2.0, 10.0                               # fine and coarse step
NF, NCO = int(TILE / SF) + 1, int(TILE / SC) + 1  # 126, 26 nodes per side
K = 1.5          # embankment slope 1 : 1.5 (vertical : horizontal = 1/K)
BAND = 20.0      # the slope band around the fixed features
FRINGE = 0.5     # nodes this far outside a polygon are written too (the mesh must not bleed)
AX_OWN = 1.5     # an axis within this of a carriageway polygon is its own
AX_NEAR = 8.0    # ... otherwise one within this; farther than this from every axis, the polygon TIN takes over
BLEND = 4.0      # axes within d_min + BLEND are blended (1/d^2 with a taper): no step where two axes share a polygon
AX_SIGMA = 15.0  # the axis Z is smoothed along the network over this (the DBGT gives it in steps of 0.21 m)
LEVEL = 3.0      # an axis this far from the polygon's own vertices is at another level (underpass, ramp beside)
DZ_WARN, DZ_CAP = 1.5, 3.0   # C4: DBGT farther than this from the LiDAR is listed; farther than DZ_CAP the LiDAR wins (the "tetto")
NEAR_BR = 30.0   # ... unless within this of a bridge: then it is the part of the deck the DBGT left as ground (phase 3 makes it a deck)
NEAR_UNDER = 10.0   # ... and a road under the LiDAR this close to a bridge or the gallery is never capped (the DTM is filled across the deck)
LUCE_MIN = 2.5   # inside a PONTE, fixed nodes this far over the lowest fixed ones are at the level of the deck (fase 6)
RAMP = 10.0      # the capped patch is joined to the kept DBGT over this distance
FINE_BUF = 20.0  # a tile is fine (2 m) when one of the features is within this of it
DENS = 2.0       # polygon rings are densified to this before the TIN (a nearly constrained Delaunay)
KERB_TOL = 0.3   # a sidewalk or area edge point this close to a carriageway takes the carriageway height (no step along the kerb)
KERB_MAX = 1.0   # ... unless the two differ by more than this (a wall, not a kerb)
ZW_MARG = 0.1    # the water level stays this much under the ring of the bed (the water's edge) and the bed edge this much over the water
ALV_D, ALV_G = 1.5, 1.0   # the bed is dug from the water level: 1:1 from the edge (like the banks outside) down to ALV_D under the water
ALV_GIU = 1.0    # the water's edge in a bed is at most this under the ring (where a low bank downstream holds the level down)
BANK_FLAT = 0.0  # ... and under the lowest ground 2-5 m out from the bed (a flat bank at water level: no pond past the edge)
WMAX = 12.0      # a bed node takes zw of the nearest axis point within this (the game: H.water)
VIA_MAX, VIA_OFF, VIA_DZ = 8.0, 4.5, 6.0   # drawn road: a free node this close to a DBGT carriageway, the carriageway within w/2 + VIA_OFF of the OSM axis, at most VIA_DZ under the LiDAR
VIA_SU = 1.0     # ... and at most this over it (a fill beyond the DBGT carriageway: by point 22 the drawn Milano-Meda was raised 5.9 m where the DBGT stops, and with 2 m a fill on the steep LiDAR slope there made a wall of 2.6 m)
VIA_BORDO = 2.83 # ... and the nodes within one cell diagonal of the drawn surface (the corners of every cell it touches)
SOTTO_MAX = 0.01 # C10: share of the axis points with the water under the lowest S of the section (covered stretches excluded)
Q5 = 0.05        # coarse tiles are stored in multiples of 5 cm: the fine border nodes interpolated between them are whole cm, no T crack
# priority (docs/motore.md 4) as a rank: higher wins
R_RIT, R_VEI, R_PED, R_ALV = 9, 8, 7, 6
# node classes and cell materials (2.2)
C_NONE, C_VEI, C_VEIT, C_PED, C_AREA, C_FER, C_ALV, C_ARG = 0, 1, 2, 3, 4, 5, 6, 7
M_ASF, M_MARC, M_ERBA, M_ALVEO, M_SCARP, M_BIN = 1, 2, 3, 4, 5, 6
CLS_MAT = np.array([0, M_ASF, M_ASF, M_MARC, M_ASF, M_BIN, M_ALVEO, M_ERBA], np.uint8)
ROADTYPE = (C_VEI, C_VEIT, C_PED, C_AREA, C_FER)


def log(*a): print('%5.1fs' % (time.time() - T0), *a, flush=True)
T0 = time.time()


# ---------- lattice ----------
class Reticolo:
    def __init__(s, x0, z0, nx, nz, st): s.x0, s.z0, s.nx, s.nz, s.st = x0, z0, nx, nz, st

    def xs(s): return s.x0 + np.arange(s.nx) * s.st
    def zs(s): return s.z0 + np.arange(s.nz) * s.st

    def win(s, b, pad=0.0):  # index window (r0, r1, c0, c1), end exclusive, of the nodes in the bounds b + pad
        c0 = max(0, int(np.floor((b[0] - pad - s.x0) / s.st))); c1 = min(s.nx, int(np.ceil((b[2] + pad - s.x0) / s.st)) + 1)
        r0 = max(0, int(np.floor((b[1] - pad - s.z0) / s.st))); r1 = min(s.nz, int(np.ceil((b[3] + pad - s.z0) / s.st)) + 1)
        return None if c0 >= c1 or r0 >= r1 else (r0, r1, c0, c1)

    def xz(s, w):
        r0, r1, c0, c1 = w; return np.meshgrid(s.x0 + np.arange(c0, c1) * s.st, s.z0 + np.arange(r0, r1) * s.st)


def tri_interp(G, R, x, z):  # the game's formula (world3.js groundH): two triangles per cell, diagonal u >= v
    fx = np.clip((np.asarray(x) - R.x0) / R.st, 0, R.nx - 1.000001); fz = np.clip((np.asarray(z) - R.z0) / R.st, 0, R.nz - 1.000001)
    i, j = fx.astype(int), fz.astype(int); u, v = fx - i, fz - j
    h00, h10, h01, h11 = G[j, i], G[j, i + 1], G[j + 1, i], G[j + 1, i + 1]
    return np.where(u >= v, h00 + u * (h10 - h00) + v * (h11 - h10), h00 + v * (h01 - h00) + u * (h11 - h01))


# ---------- L: LiDAR 1 m as the area mean over the cell of each node ----------
def _wmat(nodes, c0, pitch, npix, cell):  # sparse weights: overlap of [n - cell/2, n + cell/2] with each pixel box
    lo, hi = nodes - cell / 2, nodes + cell / 2; k0 = np.floor((lo - c0) / pitch + 0.5).astype(int)
    R, C, V = [], [], []
    for o in range(int(np.ceil(cell / pitch)) + 2):
        k = k0 + o; pl = c0 + (k - 0.5) * pitch; ov = np.minimum(hi, pl + pitch) - np.maximum(lo, pl)
        ok = (ov > 1e-9) & (k >= 0) & (k < npix); R.append(np.nonzero(ok)[0]); C.append(k[ok]); V.append(ov[ok])
    return sparse.csr_matrix((np.concatenate(V), (np.concatenate(R), np.concatenate(C))), shape=(len(nodes), npix))


def lidar_media(lid, R, cell):
    """Area mean of the LiDAR pixels (boxes around the PixelIsPoint centres) over the cell x cell square of every node of R. The game
    frame is linear in lon and lat, so the pixel lattice and the node lattice are both axis aligned: the mean is separable."""
    px, pz = lid.sx * KX, lid.sy * KZ
    xc0, zc0 = (lid.lon0 - LON0) * KX, (LAT0 - lid.lat0) * KZ        # centre of pixel (0, 0) in game metres
    xs, zs = R.xs(), R.zs()
    ca, cb = int(np.floor((xs[0] - cell - xc0) / px)) - 2, int(np.ceil((xs[-1] + cell - xc0) / px)) + 2
    ra, rb = int(np.floor((zs[0] - cell - zc0) / pz)) - 2, int(np.ceil((zs[-1] + cell - zc0) / pz)) + 2
    M = np.full((rb - ra, cb - ca), np.nan, np.float32)
    for t in lid.t:
        r0, c0 = t['r0'] - ra, t['c0'] - ca; r1, c1 = r0 + t['h'], c0 + t['w']
        if r1 <= 0 or c1 <= 0 or r0 >= M.shape[0] or c0 >= M.shape[1]: continue
        a = lid._arr(t); sr, sc = max(0, -r0), max(0, -c0); er, ec = min(t['h'], M.shape[0] - r0), min(t['w'], M.shape[1] - c0)
        M[r0 + sr:r0 + er, c0 + sc:c0 + ec] = a[sr:er, sc:ec]
    ok = ~np.isnan(M); M0 = np.where(ok, M, 0).astype(np.float64)
    Wx = _wmat(xs, xc0 + ca * px, px, M.shape[1], cell); Wz = _wmat(zs, zc0 + ra * pz, pz, M.shape[0], cell)
    num = (Wx @ (Wz @ M0).T).T; den = (Wx @ (Wz @ ok.astype(np.float64)).T).T
    full = cell * cell
    out = np.where(den > 0.5 * full, num / np.maximum(den, 1e-9), np.nan)
    return out


# ---------- DBGT helpers ----------
def anelli(L, i):  # rings of area piece i: (xy, z, fonte)
    a, b = L['off'][i], L['off'][i + 1]; st = L['anelli'][i] + [b - a]
    for k in range(len(st) - 1):
        s_, e_ = a + st[k], a + st[k + 1]
        if e_ - s_ >= 3: yield L['xy'][s_:e_], L['z'][s_:e_], L['fonte'][s_:e_]


def denso(xy, z, ok, step=DENS, closed=True):  # ring (open) or line -> points every <= step, Z interpolated along it between the ok vertices
    if ok.sum() == 0: return None
    P = np.vstack((xy, xy[:1])) if closed else xy
    seg = np.hypot(*np.diff(P, axis=0).T); s = np.concatenate(([0], np.cumsum(seg))); per = s[-1]
    sv = s[:len(xy)]; so, zo = sv[ok], z[ok]
    zz = np.interp(sv, np.concatenate((so - per, so, so + per)), np.concatenate((zo, zo, zo))) if closed else np.interp(sv, so, zo)
    zn = np.append(zz, zz[0]) if closed else zz
    m = np.maximum(1, np.ceil(seg / step).astype(int)); j = np.repeat(np.arange(len(seg)), m)
    t = np.arange(m.sum()) - np.repeat(np.cumsum(m) - m, m); t = t / m[j]
    pts = P[j] + (P[j + 1] - P[j]) * t[:, None]; zp = zn[j] + (zn[j + 1] - zn[j]) * t
    if not closed: pts, zp = np.vstack((pts, P[-1:])), np.append(zp, zn[-1])
    return pts, zp


class Tin:  # Delaunay of the points (dense rings: almost the constrained one), the nearest point outside the hull
    def __init__(s, P, z):
        _, ix = np.unique(np.round(P, 2), axis=0, return_index=True); s.P, s.z = P[ix], z[ix]; s.f = None
        if len(s.P) >= 3:
            try: s.f = LinearNDInterpolator(s.P, s.z)
            except Exception: s.f = None
        s.kd = cKDTree(s.P)

    def __call__(s, x, z):
        x, z = np.asarray(x, float), np.asarray(z, float)
        h = s.f(x, z) if s.f is not None else np.full(x.shape, np.nan)
        bad = np.isnan(h)
        if bad.any(): h[bad] = s.z[s.kd.query(np.column_stack((x[bad], z[bad])))[1]]
        return h


def tin_di(L, i, ok_fn, extra=None):
    P, Z = [], []
    for xy, z, ft in anelli(L, i):
        r = denso(xy, z, ok_fn(z, ft))
        if r is not None: P.append(r[0]); Z.append(r[1])
    if extra is not None and len(extra[0]): P.append(extra[0]); Z.append(extra[1])
    return (np.vstack(P), np.concatenate(Z)) if P else None


def poly(L, i):
    P = dq.poligono(L, i)
    return P if P.is_valid else P.buffer(0)


def sed_ok(L, i): return 'sed' not in L['attr'] or L['attr']['sed'][i] in ('01', None)


def pava_dec(y):  # the closest non-increasing sequence (least squares, pool adjacent violators)
    v, w, n = [], [], []
    for a in np.asarray(y, float):
        v.append(a); w.append(1.0); n.append(1)
        while len(v) > 1 and v[-2] < v[-1]:
            ww = w[-2] + w[-1]; vv = (v[-2] * w[-2] + v[-1] * w[-1]) / ww; nn = n[-2] + n[-1]
            v[-2:] = [vv]; w[-2:] = [ww]; n[-2:] = [nn]
    return np.repeat(v, n)


def assi_acqua(D, AU):
    """The EL_IDR axes that run in the DBGT bed (at least half inside AU), merged, every 2 m, first point upstream (the Seveso flows
    southwards; the way is from the Z of the axis vertices at the two ends)."""
    E = D['EL_IDR']; lines, zz = [], []
    for i in range(len(E['off']) - 1):
        a, b = E['off'][i], E['off'][i + 1]; xy = E['xy'][a:b]
        if len(xy) < 2: continue
        r = denso(xy, E['z'][a:b], ~np.isnan(E['z'][a:b]), 2.0, closed=False)
        if r is None: continue
        if shapely.contains_xy(AU, r[0][:, 0], r[0][:, 1]).mean() < 0.5: continue
        lines.append(LineString(xy)); zz.append((xy, E['z'][a:b]))
    if not lines: return []
    allxy = np.vstack([q[0] for q in zz]); allz = np.concatenate([q[1] for q in zz]); kd = cKDTree(allxy[~np.isnan(allz)]); zv = allz[~np.isnan(allz)]
    merged = shapely.line_merge(shapely.union_all(lines)); out = []
    for g in getattr(merged, 'geoms', [merged]):
        xy = np.asarray(g.coords)[:, :2]
        if len(xy) < 2: continue
        p = denso(xy, np.zeros(len(xy)), np.ones(len(xy), bool), 2.0, closed=False)[0]
        dd, jj = kd.query(xy); zax = zv[jj]
        out.append(p[::-1] if zax[0] < zax[-1] else p)
    return out


class Assi:  # EL_STR segments at ground (SED=01), every <= 2 m, with their clean Z smoothed along the road network
    def __init__(s, L, sigma=None, name='EL_STR'):
        sigma = AX_SIGMA if sigma is None else sigma
        # The DBGT axis Z is a staircase: runs of vertices at the same Z, then a jump of 0.21 or 0.42 m (e.g. the Milano-Meda at the
        # junction: 215.09, 215.09, 214.67, 214.67, 214.67, 214.46...). Taken as it is the road comes out terraced. So the axes are
        # resampled at 2 m and the Z diffused along the network (junctions joined) to a Gaussian of sigma metres: a constant grade
        # stays as it is, the terraces become the grade.
        P, Z, Z0, pz, first = [], [], [], [], []
        deck = dq.is_deck(name, L)
        for i in range(len(L['off']) - 1):
            if deck[i]: continue
            a, b = L['off'][i], L['off'][i + 1]; z = L['z'][a:b]; xy = L['xy'][a:b]
            r = denso(xy, z, ~np.isnan(z), SF, closed=False)
            if r is None or len(r[0]) < 2: continue
            keep = np.concatenate(([True], np.hypot(*np.diff(r[0], axis=0).T) > 1e-3)); p_, z_ = r[0][keep], r[1][keep]
            if len(p_) < 2: continue
            first.append(sum(len(q) for q in P)); P.append(p_); Z.append(z_); pz.append(np.full(len(p_), i))
        P, Z, pz = np.vstack(P), np.concatenate(Z), np.concatenate(pz); n = len(P)
        start = np.zeros(n, bool); start[first] = True
        ia = np.nonzero(~start)[0]; e0, e1 = ia - 1, ia                           # consecutive points of a piece
        key = np.round(P, 2); _, uid, inv = np.unique(key, axis=0, return_index=True, return_inverse=True)  # shared ends = one node
        inv = inv.ravel(); m = len(uid)
        A = sparse.coo_matrix((np.ones(2 * len(e0)), (np.concatenate((inv[e0], inv[e1])), np.concatenate((inv[e1], inv[e0])))), shape=(m, m)).tocsr()
        A.data[:] = 1.0; deg = np.asarray(A.sum(1)).ravel(); deg[deg == 0] = 1
        zn = np.bincount(inv, Z, m) / np.bincount(inv, minlength=m); z0n = zn.copy()
        for _ in range(int(round(2 * (sigma / SF) ** 2))): zn = 0.5 * zn + 0.5 * (A @ zn) / deg
        Zs = zn[inv]; s.dz_liscio = Zs - Z
        s.A, s.B = P[e0], P[e1]; s.za, s.zb, s.pz = Zs[e0], Zs[e1], pz[e1]
        s.tree = shapely.STRtree(shapely.linestrings(np.stack((s.A, s.B), 1)))

    def cand(s, g): return np.sort(s.tree.query(g, predicate='intersects'))

    def valuta(s, js, x, z, blend=BLEND):  # height and distance to the nearest axis at the points, from the segments js
        p = np.column_stack((x, z)); h = np.empty(len(p)); dm = np.empty(len(p))
        A, B, za, zb = s.A[js], s.B[js], s.za[js], s.zb[js]; d = B - A; l2 = (d ** 2).sum(1)
        ch = max(1, int(1e6 // max(1, len(js))))
        for k in range(0, len(p), ch):
            q = p[k:k + ch]
            t = np.clip(((q[:, None, :] - A[None]) * d[None]).sum(-1) / l2[None], 0, 1)
            dist = np.hypot(q[:, None, 0] - A[None, :, 0] - d[None, :, 0] * t, q[:, None, 1] - A[None, :, 1] - d[None, :, 1] * t)
            zq = za[None] + (zb - za)[None] * t; dmin = dist.min(1)
            if blend <= 0: hh = zq[np.arange(len(q)), dist.argmin(1)]
            else:
                w = (1 - np.clip((dist - dmin[:, None]) / blend, 0, 1)) ** 2 / (dist ** 2 + 0.25); hh = (w * zq).sum(1) / w.sum(1)
            h[k:k + ch] = hh; dm[k:k + ch] = dmin
        return h, dm


# ---------- OSM: only to decide which tiles need 2 m outside the DBGT ----------
def osm_ostacoli(path, lonlat, cache=None):
    if cache and os.path.exists(cache) and os.path.getmtime(cache) > os.path.getmtime(path):
        return [shapely.from_wkb(b) for b in pickle.load(open(cache, 'rb'))]
    W, S_, E, N = lonlat; nodes, out = {}, []
    # the game draws paths and tracks too (build_data.py FOOT): a tile with one is fine like any other road tile
    skip_hw = {'proposed', 'construction', 'abandoned', 'razed', 'platform'}
    for ev, el in ET.iterparse(path):
        if el.tag == 'node':
            lat, lon = float(el.get('lat')), float(el.get('lon'))
            if S_ <= lat <= N and W <= lon <= E: nodes[el.get('id')] = dq.to_game_lonlat(lon, lat)
            el.clear()
        elif el.tag == 'way':
            t = {c.get('k'): c.get('v') for c in el.iter('tag')}
            kind = None
            if t.get('highway') and t['highway'] not in skip_hw: kind = 'strada'
            elif t.get('railway') in ('rail', 'light_rail', 'tram', 'subway', 'narrow_gauge'): kind = 'ferro'
            elif t.get('waterway') in ('river', 'canal', 'stream'): kind = 'acqua'
            elif t.get('building') and t['building'] != 'no': kind = 'edificio'
            elif t.get('man_made') == 'embankment' or t.get('embankment') == 'yes': kind = 'argine'
            if kind:
                p = [nodes[c.get('ref')] for c in el.iter('nd') if c.get('ref') in nodes]
                if len(p) >= 2:
                    g = LineString(p)
                    out.append(g.buffer(4.0 if kind == 'strada' else 2.0, 4) if kind != 'edificio' else (Polygon(p) if len(p) >= 4 and p[0] == p[-1] else g).buffer(0.5, 2))
            el.clear()
        elif el.tag == 'relation': el.clear()
    if cache: pickle.dump([shapely.to_wkb(g) for g in out], open(cache, 'wb'))
    return out


# ---------- PNG ----------
def png(path, rgb):
    rgb = np.clip(rgb, 0, 255).astype(np.uint8); h, w, _ = rgb.shape; raw = b''.join(b'\x00' + rgb[r].tobytes() for r in range(h))
    ch = lambda t, d_: struct.pack('>I', len(d_)) + t + d_ + struct.pack('>I', zlib.crc32(t + d_) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 6)) + ch(b'IEND', b''))


def shade(H, st, ex=2.0):  # light from the north-west; rows grow southwards
    gy, gx = np.gradient(H.astype(np.float64), st); gx, gy = gx * ex, gy * ex
    n = np.dstack((-gx, -gy, np.ones_like(gx))); n /= np.linalg.norm(n, axis=2, keepdims=True)
    l = np.array([-1.0, -1.0, 1.4]); l /= np.linalg.norm(l); return np.clip((n * l).sum(2), 0, 1)


# ---------- the surface ----------
class Superficie:
    def __init__(s, comune='Meda', gpkg=None, margine=250.0, blend=BLEND, log_=log):
        s.comune, s.blend, s.log = comune, blend, log_
        s.gpkg = gpkg or os.path.join(DATA, 'dbt', comune, 'dbgt.gpkg')
        s.lid = dq.Lidar(); s.conf = dq.confine_comune(comune)
        area = s.conf.buffer(margine)
        s.tiles = []  # (tx, tz) inside the map whose box touches the comune + margin
        for tz in range(NTZ):
            for tx in range(NTX):
                if box(*s.tbox(tx, tz)).intersects(area): s.tiles.append((tx, tz))
        s.fuori_mappa = 0
        b = area.bounds  # tiles of the comune + margin that the map does not have (the map stops at -HH: the north of Meda is outside)
        for tz in range(int(np.floor((b[1] + HH) / TILE)), int(np.ceil((b[3] + HH) / TILE))):
            for tx in range(int(np.floor((b[0] + HW) / TILE)), int(np.ceil((b[2] + HW) / TILE))):
                if not (0 <= tx < NTX and 0 <= tz < NTZ) and box(*s.tbox(tx, tz)).intersects(area): s.fuori_mappa += 1
        s.i0, s.i1 = min(t[0] for t in s.tiles), max(t[0] for t in s.tiles); s.j0, s.j1 = min(t[1] for t in s.tiles), max(t[1] for t in s.tiles)
        nt = int(TILE / SF)
        s.R = Reticolo(-HW + s.i0 * TILE, -HH + s.j0 * TILE, (s.i1 - s.i0 + 1) * nt + 1, (s.j1 - s.j0 + 1) * nt + 1, SF)
        s.Rc = Reticolo(s.R.x0, s.R.z0, (s.i1 - s.i0 + 1) * int(TILE / SC) + 1, (s.j1 - s.j0 + 1) * int(TILE / SC) + 1, SC)
        s.t = {}  # times

    @staticmethod
    def tbox(tx, tz): return (-HW + tx * TILE, -HH + tz * TILE, -HW + (tx + 1) * TILE, -HH + (tz + 1) * TILE)

    def tile_win(s, tx, tz, R=None):  # window of a tile in the lattice R (both borders included)
        R = R or s.R; n = int(TILE / R.st)
        r0, c0 = (tz - s.j0) * n, (tx - s.i0) * n; return (r0, r0 + n + 1, c0, c0 + n + 1)

    # ----- 1. base terrain
    def base(s):
        t0 = time.time(); s.L = lidar_media(s.lid, s.R, SF)
        s.nbuchi = int(np.isnan(s.L).sum())
        if s.nbuchi:  # outside the LiDAR: the nearest LiDAR node (TINITALY with its 20 m blend is phase 8, out of the DBGT area)
            idx = ndimage.distance_transform_edt(np.isnan(s.L), return_distances=False, return_indices=True); s.L = s.L[idx[0], idx[1]]
        s.Lc = lidar_media(s.lid, s.Rc, SC)
        if np.isnan(s.Lc).any():
            idx = ndimage.distance_transform_edt(np.isnan(s.Lc), return_distances=False, return_indices=True); s.Lc = s.Lc[idx[0], idx[1]]
        s.t['lidar'] = round(time.time() - t0, 1)
        s.log('lidar: griglia %dx%d a 2 m, %d buchi, quota %.1f..%.1f' % (s.R.nx, s.R.nz, s.nbuchi, s.L.min(), s.L.max()))

    # ----- 2. DBGT
    def dbgt(s):
        t0 = time.time(); s.D = dq.load_dbgt(s.gpkg, s.lid, s.conf); s.info = s.D.pop('_info'); s.AX = Assi(s.D['EL_STR']); s.AXF = Assi(s.D['EL_FER'], name='EL_FER')
        con = sqlite3.connect(s.gpkg); tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
        E = dq._read_layer(con, tr, 'EDIFC_CR_EDF_ME', 'area', {}); con.close()
        s.edifici = [poly(E, i) for i in range(len(E['off']) - 1)] if E is not None else []
        s.t['dbgt'] = round(time.time() - t0, 1)
        s.log('dbgt: offset %+.3f m, assi %d segmenti, edifici %d' % (s.info['offset']['valore'], len(s.AX.A), len(s.edifici)))

    # ----- burning
    def _alloc(s):
        sh = (s.R.nz, s.R.nx)
        s.RANK = np.zeros(sh, np.int8); s.INS = np.zeros(sh, bool); s.DST = np.full(sh, np.inf, np.float32)
        s.ZF = np.full(sh, np.nan); s.CLS = np.zeros(sh, np.int8); s.FID = np.full(sh, -1, np.int32)
        s.BR = np.zeros(sh, bool); s.BRP = np.zeros(sh, bool)

    def burn(s, P, rank, cls, fid, hfun, fringe=True):
        w = s.R.win(P.bounds, FRINGE + SF)
        if w is None: return 0
        X, Z = s.R.xz(w); shapely.prepare(P)
        ins = shapely.contains_xy(P, X, Z)
        fr = (shapely.contains_xy(P.buffer(FRINGE, 4), X, Z) & ~ins) if fringe else np.zeros_like(ins)
        sel = ins | fr
        if not sel.any(): return 0
        r0, r1, c0, c1 = w; RK, IN, DS = s.RANK[r0:r1, c0:c1], s.INS[r0:r1, c0:c1], s.DST[r0:r1, c0:c1]
        dn = np.zeros(X.shape, np.float32)
        if fr.any(): dn[fr] = shapely.distance(P, shapely.points(X[fr], Z[fr]))
        kn, ko = rank * 2 + ins.astype(np.int16), RK.astype(np.int16) * 2 + IN
        win = sel & ((kn > ko) | ((kn == ko) & (dn < DS)))
        if not win.any(): return 0
        h = hfun(X[win], Z[win]); good = ~np.isnan(h); win[win] = good; h = h[good]
        RK[win] = rank; IN[win] = ins[win]; DS[win] = dn[win]
        s.ZF[r0:r1, c0:c1][win] = h; s.CLS[r0:r1, c0:c1][win] = cls; s.FID[r0:r1, c0:c1][win] = fid
        return int(win.sum())

    def raster(s, P):  # mask window of the nodes inside P
        w = s.R.win(P.bounds, SF)
        if w is None: return None, None
        X, Z = s.R.xz(w); shapely.prepare(P); return w, shapely.contains_xy(P, X, Z)

    # ----- 3. features
    def strade(s):
        t0 = time.time(); s._alloc(); D = s.D; AX = s.AX
        # bridges and gallery cover: never burned (phase 3 objects); the SED=01 features below them are
        for nm in ('PONTE', 'GALLER', 'AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR', 'SD_FER'):
            L = D[nm]
            for i in range(len(L['off']) - 1):
                if nm not in ('PONTE', 'GALLER') and sed_ok(L, i): continue
                w, m = s.raster(poly(L, i))
                if w is not None:
                    s.BR[w[0]:w[1], w[2]:w[3]] |= m
                    if nm == 'PONTE': s.BRP[w[0]:w[1], w[2]:w[3]] |= m
        okz = lambda z, ft: ~np.isnan(z)
        # carriageways: own axes (blended), else an axis within 8 m (not for the inner areas ZON 0307), else the TIN of the vertices
        V = D['AC_VEI']; s.vei = {}; s.interne = []; nst = dict(asse=0, asse_vicino=0, tin=0, interne=0, scartati=0)
        for i in range(len(V['off']) - 1):
            if not sed_ok(V, i): continue
            P = poly(V, i); tv = tin_di(V, i, okz); tin = Tin(*tv) if tv is not None else None
            js = AX.cand(P.buffer(AX_OWN)); how = 'asse'
            if len(js) and tin is not None:
                mx, mz = (AX.A[js] + AX.B[js]).T / 2; js = js[np.abs((AX.za[js] + AX.zb[js]) / 2 - tin(mx, mz)) < LEVEL]
            if not len(js) and V['attr']['zon'][i] != '0307':
                js = AX.cand(P.buffer(AX_NEAR)); how = 'asse_vicino'
                if len(js) and tin is not None:
                    mx, mz = (AX.A[js] + AX.B[js]).T / 2; js = js[np.abs((AX.za[js] + AX.zb[js]) / 2 - tin(mx, mz)) < LEVEL]
            if not len(js): js = None; how = 'tin'
            if js is None and V['attr']['zon'][i] == '0307':  # inner areas of the lots with no axis: their DBGT Z is off the LiDAR by
                s.interne.append(P); nst['interne'] += 1; continue  # more than 0.5 m on 12 % of the nodes; the ground there is the LiDAR
            if js is None and tin is None: nst['scartati'] += 1; continue
            s.vei[i] = dict(P=P, js=js, tin=tin, how=how, ax=AX); nst[how] += 1
        s.nst = nst
        masters = [i for i, r in s.vei.items() if r['js'] is not None]
        for i in masters:
            r = s.vei[i]; s.burn(r['P'], R_VEI, C_VEI, i, lambda x, z, r=r: s.road(r, x, z))
        # secondary polygons: their ring points on a carriageway edge take the carriageway height, then their own TIN
        sec = [('AC_VEI', i) for i, r in s.vei.items() if r['js'] is None]
        for nm in ('AC_PED', 'AC_CIC', 'AR_STR'):
            L = D[nm]; sec += [(nm, i) for i in range(len(L['off']) - 1) if sed_ok(L, i)]
        rings = {}
        for nm, i in sec:
            L = D[nm]; tv = tin_di(L, i, okz)
            if tv is not None: rings[(nm, i)] = [tv[0], tv[1].copy()]
        keys = list(rings); allp = np.vstack([rings[k][0] for k in keys]); own = np.repeat(np.arange(len(keys)), [len(rings[k][0]) for k in keys])
        mp = [s.vei[i]['P'] for i in masters]; mt = shapely.STRtree(mp); pg = shapely.points(allp)
        pi, mi = mt.query(pg, predicate='dwithin', distance=KERB_TOL)
        if len(pi):
            dd = shapely.distance(pg[pi], np.array(mp, dtype=object)[mi]); o = np.lexsort((dd, pi)); pi, mi = pi[o], mi[o]
            first = np.concatenate(([True], pi[1:] != pi[:-1])); pi, mi = pi[first], mi[first]
            zsn = np.empty(len(pi))
            for m in np.unique(mi):
                k = mi == m; r = s.vei[masters[m]]; zsn[k] = s.road(r, allp[pi[k], 0], allp[pi[k], 1])
            zall = np.concatenate([rings[k][1] for k in keys]); s.kerb_dz = zsn - zall[pi]; ok = np.abs(s.kerb_dz) <= KERB_MAX
            s.kerb_lontani = int((~ok).sum()); zall[pi[ok]] = zsn[ok]; pi = pi[ok]
            st = np.concatenate(([0], np.cumsum([len(rings[k][0]) for k in keys])))
            for n, k in enumerate(keys): rings[k][1] = zall[st[n]:st[n + 1]]
        else: s.kerb_dz = np.zeros(0); s.kerb_lontani = 0
        s.nkerb = int(len(pi))
        for (nm, i), (P_, Z_) in rings.items():
            if nm == 'AC_VEI':
                r = s.vei[i]; r['tin'] = Tin(P_, Z_); s.burn(r['P'], R_VEI, C_VEIT, i, r['tin'])
        # rail beds: like the carriageways, on their own EL_FER axes (smoothed the same way), else the TIN of the ring
        Sd, AXF = D['SD_FER'], s.AXF; s.ferro = {}
        for i in range(len(Sd['off']) - 1):
            if not sed_ok(Sd, i): continue
            P = poly(Sd, i); tv = tin_di(Sd, i, okz); tin = Tin(*tv) if tv is not None else None
            js = AXF.cand(P.buffer(AX_OWN))
            if len(js) and tin is not None:
                mx, mz = (AXF.A[js] + AXF.B[js]).T / 2; js = js[np.abs((AXF.za[js] + AXF.zb[js]) / 2 - tin(mx, mz)) < LEVEL]
            if not len(js): js = None
            if js is None and tin is None: continue
            r = s.ferro[i] = dict(P=P, js=js, tin=tin, ax=AXF); s.burn(P, R_VEI, C_FER, i, lambda x, z, r=r: s.road(r, x, z))
        beds = shapely.union_all([r['P'] for r in s.ferro.values()]) if s.ferro else None
        mid = (AXF.A + AXF.B) / 2
        out_ = AXF.pz[~shapely.contains_xy(beds, mid[:, 0], mid[:, 1])] if beds is not None else AXF.pz
        s.ferro_fuori = int(len(out_))
        for i in np.unique(out_):  # rail axes outside every bed: a 3 m strip at their own height
            js = np.nonzero(AXF.pz == i)[0]; g = shapely.union_all(shapely.linestrings(np.stack((AXF.A[js], AXF.B[js]), 1))).buffer(1.5, 2)
            r = dict(P=g, js=js, tin=None, ax=AXF); s.burn(g, R_VEI, C_FER, 10000 + int(i), lambda x, z, r=r: s.road(r, x, z), fringe=False)
        # sidewalks, cycle lanes, road areas (with the GZ_STR junctions inside them)
        G = D['GZ_STR']; gz_ok = ~np.isnan(G['z']); gxy, gzz = G['xy'][gz_ok], G['z'][gz_ok]
        ar = [k for k in rings if k[0] == 'AR_STR']; gz_in = {}
        if ar and len(gxy):
            ii, jj = shapely.STRtree([poly(D['AR_STR'], i) for _, i in ar]).query(shapely.points(gxy), predicate='within')
            for a_, b_ in zip(ii, jj): gz_in.setdefault(ar[b_], []).append(a_)
        for nm, cls in (('AC_PED', C_PED), ('AC_CIC', C_PED), ('AR_STR', C_AREA)):
            L = D[nm]
            for k, (P_, Z_) in [(k, v) for k, v in rings.items() if k[0] == nm]:
                sel = gz_in.get(k)
                if sel: P_, Z_ = np.vstack((P_, gxy[sel])), np.concatenate((Z_, gzz[sel]))
                s.burn(poly(L, k[1]), R_PED, cls, k[1], Tin(P_, Z_))
        s.alveo()
        s.INT = np.zeros(s.RANK.shape, bool)
        for P in s.interne:
            w, m = s.raster(P)
            if w is not None: s.INT[w[0]:w[1], w[2]:w[3]] |= m
        s.t['strade'] = round(time.time() - t0, 1)
        s.log('strade: carreggiate %s, nodi fissi %d, sotto ponti %d, bordi agganciati %d' % (nst, int((s.RANK > 0).sum()), int(s.BR.sum()), s.nkerb))

    def road(s, r, x, z):  # carriageway height at the points: blended axes, the polygon TIN taking over farther than AX_NEAR from them
        if r['js'] is None: return r['tin'](x, z)
        h, dm = r['ax'].valuta(r['js'], x, z, s.blend)
        if r['tin'] is not None:
            w = np.clip((dm - AX_NEAR) / AX_NEAR, 0, 1); k = w > 0
            if k.any(): h[k] = h[k] * (1 - w[k]) + r['tin'](x[k], z[k]) * w[k]
        return h

    # ----- 3b. the river (rifinitura del 24/10). The ALVEO ring is not the top of the bank, as phase 2 assumed: across the Seveso the LiDAR
    # has the whole channel, a trough 2-4 m deep with the banks outside the polygon and a flat bottom (the water, which the DTM keeps as a
    # surface) at the height of the ring TIN (ring - LiDAR in the middle of the bed: median +0.14 m on the Seveso). The polygon is the wet
    # bed and its ring the water's edge. So the water level zw comes first, along the EL_IDR axes, from the ring just under the edge and
    # under the banks around, made monotone; the bed is then dug from zw: at the edge just over the water, down 1:1 (the slope of the banks
    # outside, so the line where the water meets them is the polygon edge and not the rows of the 2 m lattice) to ALV_D under the water.
    # The 23 ARGINE (1 m wide strips along the edge, Z within 0.3 m of the ring) are no longer burned on their own at ring height: they made a
    # dry strip inside the bed. The water is opaque: the shape under it is not seen.
    def alveo(s):
        D = s.D; okz = lambda z, ft: ~np.isnan(z); okf = lambda z, ft: ft == FT_RAW
        G = D['ARGINE']; ga = []
        for i in range(len(G['off']) - 1):
            tv = tin_di(G, i, okz)
            if tv is not None and len(tv[0]) >= 3: ga.append(tv)
        gp = np.vstack([t[0] for t in ga]) if ga else np.zeros((0, 2)); gzz_ = np.concatenate([t[1] for t in ga]) if ga else np.zeros(0)
        s.alvei = []
        for nm in ('ALVEO', 'ALVEO_A'):
            L = D[nm]
            for i in range(len(L['off']) - 1):
                tv = tin_di(L, i, okf)
                if tv is None or len(tv[0]) < 3: continue
                P = poly(L, i); edge = Tin(*tv); inner = None
                if len(gp):
                    k = shapely.contains_xy(P.buffer(0.5), gp[:, 0], gp[:, 1])
                    if k.any(): inner = Tin(np.vstack((tv[0], gp[k])), np.concatenate((tv[1], gzz_[k])))
                s.alvei.append((P, edge, inner))
        s.AU = shapely.union_all([a[0] for a in s.alvei]).buffer(0.01); shapely.prepare(s.AU)
        s.ACQ = s.acqua_build()
        pts = np.vstack([q['p'] for q in s.ACQ]) if s.ACQ else np.zeros((1, 2)) + 1e9; zz = np.concatenate([q['zw'] for q in s.ACQ]) if s.ACQ else np.zeros(1)
        # a bed takes zw from the axis points that run in it (a side ditch by the Seveso took the level of the river 4 m lower and was dug
        # under a building); a bed with no axis is dug as in phase 2 (ring - 1 m, 1:1) and has no water. The water's edge stays within
        # ALV_GIU of the ring where the level is held down by a low bank downstream
        inp = [shapely.contains_xy(a[0].buffer(2.0), pts[:, 0], pts[:, 1]) for a in s.alvei]
        def zwn_for(k):
            sel = np.nonzero(inp[k])[0]
            if not len(sel): return lambda x, z: np.full(len(x), np.nan)
            kd = cKDTree(pts[sel]); zs = zz[sel]
            def f(x, z):
                d, j = kd.query(np.column_stack((x, z))); return np.where(d <= WMAX, zs[j], np.nan)
            return f
        s.nalveo = 0; s.ZOLD = None; s.secco = 0; zwk = [zwn_for(k) for k in range(len(s.alvei))]
        def quota(P, edge, zwn, x, z):   # (water's edge, bed) at the points
            d = shapely.distance(P.boundary, shapely.points(x, z)) * shapely.contains_xy(P, x, z)
            e = edge(x, z); w = zwn(x, z); wet = ~np.isnan(w)
            ze = np.where(wet, np.clip(np.nan_to_num(w) + ZW_MARG, e - ALV_GIU, e), e)
            return ze, np.where(wet, ze - np.minimum(ALV_D, d * ALV_G), e - np.minimum(1.0, d))
        for k, (P, edge, inner) in enumerate(s.alvei):
            def fondo(x, z, P=P, edge=edge, inner=inner, zwn=zwk[k]):
                h = np.minimum(quota(P, edge, zwn, x, z)[1], s.L_at(x, z))
                return np.minimum(h, inner(x, z)) if inner is not None else h
            s.burn(P, R_ALV, C_ALV, k, fondo); s.nalveo += 1
        # per bed node: the water's edge (the bed before digging), for the slopes of step 6 (the banks outside follow the water's edge,
        # not the dug bed: else the 2:3 envelope from the bottom cut them down to 0.3 m), and the bed as phase 2 dug it (ring - 1 m, 1:1, the
        # ARGINE strips at their TIN), only to find the covered stretches in step 4 as before
        s.ZE = np.full(s.ZF.shape, np.nan); s.ZOLD = s.ZF.copy(); A_ = (s.CLS == C_ALV) & (s.RANK == R_ALV)
        arg = [(poly(G, i), Tin(*tv)) for i, tv in [(i, tin_di(G, i, okz)) for i in range(len(G['off']) - 1)] if tv is not None and len(tv[0]) >= 3]
        for k, (P, edge, inner) in enumerate(s.alvei):
            w = s.R.win(P.bounds, FRINGE + SF)
            if w is None: continue
            m = A_[w[0]:w[1], w[2]:w[3]] & (s.FID[w[0]:w[1], w[2]:w[3]] == k)
            if not m.any(): continue
            X, Z = s.R.xz(w); x, z = X[m], Z[m]
            d = shapely.distance(P.boundary, shapely.points(x, z)) * shapely.contains_xy(P, x, z)
            ze = quota(P, edge, zwk[k], x, z)[0]; e = edge(x, z)
            s.ZE[w[0]:w[1], w[2]:w[3]][m] = np.minimum(ze, s.L_at(x, z))
            h = np.minimum(e - np.minimum(1.0, d), s.L_at(x, z))
            if inner is not None: h = np.minimum(h, inner(x, z))
            for Pg, tg in arg:
                if Pg.bounds[2] < x.min() or Pg.bounds[0] > x.max() or Pg.bounds[3] < z.min() or Pg.bounds[1] > z.max(): continue
                ka = shapely.contains_xy(Pg, x, z)
                if ka.any(): h[ka] = tg(x[ka], z[ka])
            s.ZOLD[w[0]:w[1], w[2]:w[3]][m] = h
            s.secco += int(np.isnan(zwk[k](x, z)).sum())

    def acqua_build(s):
        """zw along the merged EL_IDR axes, every 2 m from upstream: the ring TIN at the axis - ZW_MARG, never over the banks around - 0.1
        (what stands outside the bed before the slopes: fixed roads and sidewalks, else the LiDAR; the higher of the first two samples
        outside, 1 and 2 m, so the 2 m lattice of the edge does not count, and the lowest ground 2-5 m out + BANK_FLAT), monotone downstream by the closest monotone profile (isotonic
        regression, which lowers and raises, not the running minimum that dragged everything after one hole down), smoothed over 20 m and
        then under the running minimum of the banks only (the water cannot pass a low bank)."""
        H1 = np.where(s.RANK > 0, s.ZF, s.L); out = []; tree = shapely.STRtree([a[0] for a in s.alvei])
        s.acqua_info = dict(serie=0, punti=0, trascinati=[], rialzati=[])
        for p in assi_acqua(s.D, s.AU):
            x0, x1, z0, z1 = s.R.x0, s.R.x0 + (s.R.nx - 1) * SF, s.R.z0, s.R.z0 + (s.R.nz - 1) * SF
            p = p[(p[:, 0] > x0 + 30) & (p[:, 0] < x1 - 30) & (p[:, 1] > z0 + 30) & (p[:, 1] < z1 - 30)]
            if len(p) < 3: continue
            t = np.gradient(p, axis=0); t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]; nrm = np.column_stack((-t[:, 1], t[:, 0]))
            offs = np.arange(-25, 25.5, 1.0); Q = p[:, None, :] + offs[None, :, None] * nrm[:, None, :]
            ins = shapely.contains_xy(s.AU, Q[..., 0], Q[..., 1]); hq = tri_interp(H1, s.R, Q[..., 0].ravel(), Q[..., 1].ravel()).reshape(Q.shape[:2])
            c = len(offs) // 2; bank = np.full(len(p), np.nan); edge = np.full(len(p), np.nan)
            ii, jj = tree.query(shapely.points(p), predicate='within')
            for a_, b_ in zip(ii, jj):
                if np.isnan(edge[a_]): edge[a_] = s.alvei[b_][1](p[a_:a_ + 1, 0], p[a_:a_ + 1, 1])[0]
            for k in range(len(p)):
                if not ins[k, c]: continue
                lo_ = c
                while lo_ > 0 and ins[k, lo_ - 1]: lo_ -= 1
                hi_ = c
                while hi_ < len(offs) - 1 and ins[k, hi_ + 1]: hi_ += 1
                sides = []
                if lo_ > 4: sides.append(min(max(hq[k, lo_ - 1], hq[k, lo_ - 2]), hq[k, lo_ - 5:lo_ - 1].min() + BANK_FLAT))
                if hi_ < len(offs) - 5: sides.append(min(max(hq[k, hi_ + 1], hq[k, hi_ + 2]), hq[k, hi_ + 2:hi_ + 6].min() + BANK_FLAT))
                if sides: bank[k] = min(sides)
            ok = ~np.isnan(edge)
            if ok.sum() < 3: continue
            sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(p, axis=0).T))))
            tg = np.interp(sv, sv[ok], edge[ok]) - ZW_MARG          # under culverts and gaps of the polygon: along the axis
            u = np.where(np.isnan(bank), np.inf, bank - 0.1); tg = np.minimum(tg, u)
            zw = pava_dec(tg)
            n = 5; ker = np.ones(2 * n + 1) / (2 * n + 1); zw = np.convolve(np.pad(zw, n, mode='edge'), ker, 'valid')
            U = np.minimum.accumulate(u); zw = np.minimum(zw, U)
            s.acqua_info['serie'] += 1; s.acqua_info['punti'] += len(p)
            s.acqua_info['trascinati'].append(np.maximum(0, tg - zw)); s.acqua_info['rialzati'].append(np.maximum(0, zw - tg))
            out.append(dict(p=p, zw=zw, bank1=bank))
        for k in ('trascinati', 'rialzati'):
            v = np.concatenate(s.acqua_info[k]) if s.acqua_info[k] else np.zeros(0); s.acqua_info[k] = pct(v, (50, 90, 99))
        s.log('acqua: %d serie, %d punti; sotto il bordo dell alveo per la monotonia %s, sopra %s' % (s.acqua_info['serie'], s.acqua_info['punti'], s.acqua_info['trascinati'], s.acqua_info['rialzati']))
        return out

    # ----- 4. the cap on the LiDAR, and the deck parts left as ground
    def tetto(s):
        FIX = s.RANK > 0; RT = np.isin(s.CLS, ROADTYPE) & FIX
        s.DZ = np.where(FIX, s.ZF - s.L, np.nan)
        dbr = ndimage.distance_transform_edt(~s.BR, sampling=SF) if s.BR.any() else np.full(s.BR.shape, 1e9)
        st8 = np.ones((3, 3), bool); dz = np.nan_to_num(s.DZ)
        s.AIR = ndimage.binary_propagation(RT & (dbr <= NEAR_BR) & (dz > DZ_CAP), structure=st8, mask=RT & (dz > DZ_WARN))
        # a road under the LiDAR under a bridge or the gallery cover, or by them, keeps the DBGT: the DTM is filled across the deck and a few m
        # past its edges (via Busnelli under PONTE 12 is flat at 215.2 in the DBGT, the LiDAR rises to 219.7 and shut the road; the streets
        # over the station underpass took the stair holes of the LiDAR)
        s.UND = (dbr <= NEAR_UNDER) & (dz < 0)
        s.CAP = ndimage.binary_propagation(RT & (np.abs(dz) > DZ_CAP) & ~s.AIR & ~s.UND, structure=st8, mask=RT & (np.abs(dz) > DZ_WARN) & ~s.AIR & ~s.UND)
        # a capped patch over the river is a culvert (tombino) the LiDAR sees through: the road keeps the DBGT
        s.TOMB = np.zeros(s.CAP.shape, bool); s.PNS = np.zeros(s.CAP.shape, bool)
        if s.CAP.any():
            alv = np.zeros(s.CAP.shape, bool)
            for nm in ('ALVEO', 'ALVEO_A'):
                L = s.D[nm]
                for i in range(len(L['off']) - 1):
                    w, m = s.raster(poly(L, i).buffer(3.0))
                    if w is not None: alv[w[0]:w[1], w[2]:w[3]] |= m
            lab, nl = ndimage.label(s.CAP, st8)
            if nl:
                hit = np.unique(lab[s.CAP & alv]); hit = hit[hit > 0]
                s.TOMB = np.isin(lab, hit); s.CAP &= ~s.TOMB
                # a road over the river standing above the LiDAR is a bridge the DTM removed, not a culvert (the Milano-Meda over the Taro:
                # OSM bridge=yes, walls of 6.7 m in the DTM): its nodes are a deck like AIR (phase 3), the river stays under it
                up = [k for k in hit if np.median(s.DZ[lab == k]) > 0]
                if up: s.PNS = np.isin(lab, up); s.TOMB &= ~s.PNS; s.AIR |= s.PNS
        s.WARN = RT & (np.abs(dz) > DZ_WARN)
        s.ZRAW = s.ZF.copy(); s.NEARCAP = np.zeros(s.CAP.shape, bool)
        if s.CAP.any():
            dc = ndimage.distance_transform_edt(~s.CAP, sampling=SF); wt = np.clip(dc / RAMP, 0, 1); s.NEARCAP = dc < RAMP
            k = RT & ~s.AIR & ~s.UND; s.ZF[k] = s.L[k] + s.DZ[k] * wt[k]
        s.RANK[s.AIR] = 0; s.BR |= s.AIR
        # river bed more than DZ_CAP under the LiDAR (and not under a bridge): a covered stretch (the street over the Seveso in the centre,
        # x 260 z -525, is flat in the DTM 3.5 m over the DBGT bed) or the walls of the ravine in the north. The LiDAR is kept there, else
        # the burn opens a trench nobody covers
        AL = np.isin(s.CLS, (C_ALV, C_ARG)) & FIX & ~s.BR; da = np.where(AL, s.L - np.nan_to_num(s.ZOLD if s.ZOLD is not None else s.ZF), 0)   # (on the bed as phase 2 dug it: the same covered stretches)
        s.ALVCOP = ndimage.binary_propagation(AL & (da > DZ_CAP), structure=st8, mask=AL & (da > DZ_WARN))
        s.RANK[s.ALVCOP] = 0
        s.log('tetto: nodi oltre %.1f m %d, al LiDAR %d, parti di impalcato %d (di ponti non segnati %d), tombini %d, alveo coperto o sponda al LiDAR %d' % (
            DZ_WARN, int(s.WARN.sum()), int(s.CAP.sum()), int(s.AIR.sum()), int(s.PNS.sum()), int(s.TOMB.sum()), int(s.ALVCOP.sum())))

    # ----- 5. ritocchi (src/ritocchi.json): the highest priority, only for proven errors
    def ritocchi(s):
        s.nrit = 0; f = os.path.join(HERE, 'ritocchi.json')
        if not os.path.exists(f): return
        for r in json.load(open(f, encoding='utf-8')).get('ritocchi', []):
            P = Polygon(r['poligono']); q, o = r.get('quota'), r.get('offset', 0.0)
            s.burn(P, R_RIT, C_NONE, s.nrit, lambda x, z, q=q, o=o: (np.full(len(x), q) if q is not None else s.L_at(x, z) + o), fringe=False); s.nrit += 1

    # ----- 5b. the drawn road (rifinitura del 24/10, collaudo 1). The game draws asphalt and sidewalks from OSM (brianza.json tiles[t].as and
    # .sd: the flat roads, no decks or tunnels), the DBGT carriageway is often narrower or off: under the railway bridge of via Milano
    # (PONTE 14) the AC_VEI is about 6 m wide and up to 4 m off the OSM axis of an 8 m road with sidewalks, so the section under the bridge was
    # a V with 3 m flat and asphalt and sidewalks climbed the slopes of the trench in teeth. The free nodes (no DBGT feature fixes them: slopes,
    # LiDAR, under the bridges) inside the drawn road within VIA_MAX of a DBGT carriageway take the height of that carriageway there (its
    # own function: the blended axes, flat in section) and are fixed, so the section is flat over the whole drawn width and the slopes of
    # step 6 start past its edge. The height comes from the DBGT, the width from the drawn road. Not where the carriageway is capped to the
    # LiDAR or a deck part, and not more than VIA_DZ over or under the ground (another level: a road beside a ramp)
    def vie(s):
        s.nvie = dict(nodi=0, sotto_ponti=0); s.vie_dz = np.zeros(0); s.VIE = np.zeros(s.RANK.shape, bool); s.ZSOTTO = np.full(s.RANK.shape, np.nan)   # the ground under those deck parts: the drawn road
        bj = os.path.join(HERE, '..', 'brianza.json')
        if not os.path.exists(bj): return
        t0 = time.time(); B = json.load(open(bj, encoding='utf-8')); m = B['meta']; ntx = m['ntx']
        x0, x1, z0, z1 = s.R.x0, s.R.x0 + (s.R.nx - 1) * SF, s.R.z0, s.R.z0 + (s.R.nz - 1) * SF
        def dec(a):
            o = np.cumsum(np.asarray(a, float).reshape(-1, 2), axis=0) / 10; return o
        ins = {}; ALL = np.zeros(s.RANK.shape, bool)
        for key, cls in (('as', C_VEIT), ('sd', C_PED)):
            M = np.zeros(s.RANK.shape, bool)
            for ti, T in enumerate(B['tiles']):
                if not T or not T.get(key): continue
                tx, tz = ti % ntx, ti // ntx; bx, bz = -m['hw'] + tx * TILE, -m['hh'] + tz * TILE
                if bx > x1 or bx + TILE < x0 or bz > z1 or bz + TILE < z0: continue
                for a in T[key]:
                    o = dec(a['p'])
                    if len(o) < 3: continue
                    P = Polygon(o, [dec(h) for h in a.get('k', []) if len(h) >= 6])
                    if not P.is_valid: P = P.buffer(0)
                    w, mk = s.raster(P)
                    if w is not None: M[w[0]:w[1], w[2]:w[3]] |= mk
                    w, mk = s.raster(P.buffer(VIA_BORDO, 4))   # every cell the drawn surface touches: all its corners flat
                    if w is not None: ALL[w[0]:w[1], w[2]:w[3]] |= mk
            ins[cls] = M
        # docs/motore.md 7: inside the DBGT the game draws its own areas (AC_VEI, AC_PED, MAN_TR: src/dbgt_strade.py), already burned here at
        # their height, so inside them nothing is left to do; what remains is the corners of the cells their edge crosses (VIA_BORDO, flat
        # at the height of the carriageway: else the edge of the asphalt climbs the slope in teeth, punto 1 under PONTE 14) and the ways
        # still drawn from OSM (the DBGT does not have them, or outside the comune)
        DBM = (np.isin(s.CLS, (C_VEI, C_VEIT, C_PED, C_AREA)) & (s.RANK > 0)) | s.INT
        for cls in ins: ins[cls] &= ~DBM
        s.nvie['nodi_dbgt_nel_disegno'] = int((ALL & DBM).sum())
        N = np.asarray(B['nodes'], float).reshape(-1, 3)[:, :2] / 10; segs, rw = [], []
        for r in B['roads']:
            if r.get('d') or r.get('t'): continue          # decks and tunnels are not drawn on S (build_data.py flat)
            g = N[r['g']]
            if (g[:, 0].max() < x0 or g[:, 0].min() > x1 or g[:, 1].max() < z0 or g[:, 1].min() > z1) or len(g) < 2: continue
            segs.append(LineString(g)); rw.append(float(r['w']))
        rgeo = np.array(segs, dtype=object); rw = np.array(rw); rtree = shapely.STRtree(rgeo)
        CARR = (s.RANK == R_VEI) & np.isin(s.CLS, (C_VEI, C_VEIT)) & ~s.CAP & ~s.NEARCAP & ~s.AIR & ~s.TOMB
        d, (ri, ci) = ndimage.distance_transform_edt(~CARR, sampling=SF, return_indices=True)
        free = (s.RANK == 0) & ~s.AIR & ~s.ALVCOP & (d <= VIA_MAX) & ~np.isin(s.CLS, (C_ALV, C_ARG))
        case = list(s.edifici)   # not under the buildings (DBGT and the game's), nor right by them: a drawn road wider than the street there cut under the houses (plinths up to 3 m)
        for ti, T in enumerate(B['tiles']):
            if not T or not T.get('b'): continue
            tx, tz = ti % ntx, ti // ntx; bx, bz = -m['hw'] + tx * TILE, -m['hh'] + tz * TILE
            if bx > x1 or bx + TILE < x0 or bz > z1 or bz + TILE < z0: continue
            for b in T['b']:
                o = dec(b['p'])
                if len(o) >= 3: case.append(Polygon(o))
        # by a PONTE, what the DBGT fixes at the level of the deck inside the drawn road is the bridge, not the ground: under the railway
        # bridge of via Milano the rail bed SD_FER runs 4 m past the PONTE where OSM draws the road and its sidewalks 4 m off the DBGT
        # carriageway, and the sidewalks climbed the embankment at both mouths. Those nodes become deck parts (AIR: impalcati.py hangs them on
        # the bridge, which then spans the drawn road) and the ground under them is filled like the rest under the bridges
        dp = ndimage.distance_transform_edt(~s.BRP, sampling=SF) if s.BRP.any() else np.full(s.BRP.shape, 1e9)
        alto = (s.RANK > 0) & np.isin(s.CLS, (C_FER, C_PED, C_AREA)) & (dp <= NEAR_UNDER) & (d <= VIA_MAX)
        for P in case:
            w, mk = s.raster(P.buffer(1.5, 2))
            if w is not None: free[w[0]:w[1], w[2]:w[3]] &= ~mk; alto[w[0]:w[1], w[2]:w[3]] &= ~mk
        rr, cc = np.nonzero(ALL & (free | alto))
        if len(rr):
            sr, sc = ri[rr, cc], ci[rr, cc]; X, Z = s.R.x0 + cc * SF, s.R.z0 + rr * SF
            h = s.ZF[sr, sc].copy(); fid = s.FID[sr, sc]
            for f in np.unique(fid):
                j = fid == f
                if f in s.vei:
                    hv = s.road(s.vei[f], X[j], Z[j]); good = np.abs(hv - h[j]) < 0.5; hj = h[j]; hj[good] = hv[good]; h[j] = hj
            # the carriageway must be the drawn road's own: the source node within w/2 + VIA_OFF of the axis of the flat road nearest the node
            P_ = np.column_stack((X, Z)); jn = rtree.nearest(shapely.points(P_)); wn = rw[jn]
            dn = shapely.distance(rgeo[jn], shapely.points(P_))
            ds = shapely.distance(rgeo[jn], shapely.points(np.column_stack((s.R.x0 + sc * SF, s.R.z0 + sr * SF))))
            ok = (h - s.L[rr, cc] >= -VIA_DZ) & (h - s.L[rr, cc] <= VIA_SU) & (dn <= wn / 2 + 1.8 + VIA_BORDO + 0.2) & (ds <= wn / 2 + VIA_OFF)
            s.nvie['scartati_altra_strada'] = int((~ok & free[rr, cc]).sum())
            ka = ok & alto[rr, cc] & (s.ZF[rr, cc] > h + LUCE_MIN)
            s.AIR[rr[ka], cc[ka]] = True; s.RANK[rr[ka], cc[ka]] = 0; s.BR[rr[ka], cc[ka]] = True; s.ZSOTTO[rr[ka], cc[ka]] = h[ka]; s.nvie['impalcato_sopra_la_via'] = int(ka.sum())
            ok &= free[rr, cc]
            rr, cc, h, fid = rr[ok], cc[ok], h[ok], fid[ok]
            cls = np.where(ins[C_VEIT][rr, cc], C_VEIT, np.where(ins[C_PED][rr, cc], C_PED, C_NONE))   # past the drawn edge: no material
            old = (s.CLS[rr, cc].copy(), s.ZF[rr, cc].copy(), s.FID[rr, cc].copy())
            s.RANK[rr, cc] = R_PED; s.CLS[rr, cc] = cls; s.ZF[rr, cc] = h; s.FID[rr, cc] = fid; s.VIE[rr, cc] = True
            # two drawn roads side by side at different levels (a ramp by a street, x -6 z -1272): each flat at its own height left a wall of
            # 4 m in one cell where the LiDAR had a slope. A node that would stand steeper than 2:3 (+ 0.3 m) over or under a fixed neighbour
            # stays free, and so on outwards; by the bridges the abutment is such a wall and stays
            idx = -np.ones(s.RANK.shape, np.int64); idx[rr, cc] = np.arange(len(rr)); far = dp > NEAR_UNDER; nz_, nx_ = s.RANK.shape; s.nvie['tolti_per_muro'] = 0
            for _ in range(6):
                bad = np.zeros(s.RANK.shape, bool); FX = s.RANK > 0
                for dr in (-1, 0, 1):
                    for dc in (-1, 0, 1):
                        if not dr and not dc: continue
                        a_ = (slice(max(0, dr), nz_ + min(0, dr)), slice(max(0, dc), nx_ + min(0, dc))); b_ = (slice(max(0, -dr), nz_ + min(0, -dr)), slice(max(0, -dc), nx_ + min(0, -dc)))
                        lim = np.hypot(dr, dc) * SF / K + 0.3
                        bad[b_] |= s.VIE[b_] & FX[a_] & (np.abs(np.nan_to_num(s.ZF[b_] - s.ZF[a_])) > lim)
                bad &= far
                if not bad.any(): break
                k_ = idx[bad]; s.nvie['tolti_per_muro'] += int(bad.sum())
                s.RANK[bad] = 0; s.CLS[bad] = old[0][k_]; s.ZF[bad] = old[1][k_]; s.FID[bad] = old[2][k_]; s.VIE[bad] = False
            keep = s.VIE[rr, cc]; rr, cc, h, cls = rr[keep], cc[keep], h[keep], cls[keep]
            s.vie_dz = h - s.L[rr, cc]
            s.nvie['nodi'] = int(len(rr)); s.nvie['oltre_il_bordo'] = int((cls == C_NONE).sum()); s.nvie['sotto_ponti'] = int(s.BR[rr, cc].sum())
        big = s.VIE & (np.abs(np.nan_to_num(s.ZF - s.L)) > 1.5); lab, nl = ndimage.label(big, np.ones((3, 3), bool)); s.vie_luoghi = []
        for k, sl in enumerate(ndimage.find_objects(lab)):
            m_ = lab[sl] == k + 1; rr, cc = np.nonzero(m_); rr, cc = rr + sl[0].start, cc + sl[1].start; dz = s.ZF[rr, cc] - s.L[rr, cc]; j = np.argmax(np.abs(dz))
            s.vie_luoghi.append(dict(nodi=int(len(rr)), dz_max=round(float(dz[j]), 2), sotto_ponte=bool(s.BR[rr, cc].any()), link=link(s.R.x0 + cc[j] * SF, s.R.z0 + rr[j] * SF)))
        s.vie_luoghi.sort(key=lambda c: -c['nodi'] * abs(c['dz_max']))
        s.t['vie'] = round(time.time() - t0, 1)
        s.log('vie disegnate: %d nodi liberi dentro asfalto e marciapiedi OSM portati alla quota della carreggiata DBGT (sotto i ponti %d), quota - LiDAR %s' % (s.nvie['nodi'], s.nvie['sotto_ponti'], pct(s.vie_dz, (1, 10, 50, 90, 99))))

    def L_at(s, x, z): return tri_interp(s.L, s.R, x, z)

    # ----- 6. slopes: S = L + clamp(0, lo, hi) with lo/hi the 1/K envelopes of (Z - L) of the fixed nodes within BAND (one formula, no
    # seams). The envelope is on the offset from the LiDAR, not on the height: on natural slopes steeper than 1/K (the Seveso ravine, the
    # bank under a road on a hillside) the absolute clamp built a 2:3 fill or cut that never met the LiDAR and left a cliff of up to 7 m at
    # the edge of the band. On flat ground the two are the same.
    def raccordi(s):
        t0 = time.time(); s.deck_level()
        FIX = s.RANK > 0; nz, nx = FIX.shape
        hi = np.full(FIX.shape, np.inf, np.float32); lo = np.full(FIX.shape, -np.inf, np.float32)
        dz = s.ZF - s.L
        if getattr(s, 'ZE', None) is not None: dz = np.where(np.isfinite(s.ZE) & (s.CLS == C_ALV), s.ZE - s.L, dz)   # the bed: from the water's edge
        sh = np.where(FIX, dz, np.inf).astype(np.float32); sl = np.where(FIX, dz, -np.inf).astype(np.float32)
        n = int(BAND / SF)
        for dr in range(-n, n + 1):
            for dc in range(-n, n + 1):
                r = np.hypot(dr, dc) * SF
                if r > BAND or r == 0: continue
                c = np.float32(r / K)
                a = (slice(max(0, dr), nz + min(0, dr)), slice(max(0, dc), nx + min(0, dc)))
                b = (slice(max(0, -dr), nz + min(0, -dr)), slice(max(0, -dc), nx + min(0, -dc)))
                np.minimum(hi[a], sh[b] + c, out=hi[a]); np.maximum(lo[a], sl[b] - c, out=lo[a])
        BARR = s.BR & ~FIX
        S = s.L.copy(); band = ~FIX & ~BARR & np.isfinite(hi)
        lo_, hi_ = np.minimum(lo, hi), np.maximum(lo, hi)
        S[band] = s.L[band] + np.clip(0.0, lo_[band], hi_[band]); S[FIX] = s.ZF[FIX]
        s.FIX = FIX; s.sotto_ponti(S, BARR)
        zs = getattr(s, 'ZSOTTO', None)
        if zs is not None: k = np.isfinite(zs) & BARR; S[k] = zs[k]
        s.S = S
        d = ndimage.distance_transform_edt(~FIX, sampling=SF); s.DFIX = d
        s.bordo_banda = int((band & (d > BAND - 2.5) & (np.abs(S - s.L) > 0.05)).sum())
        s.SCARP = band & (np.abs(S - s.L) > 0.05)
        s.t['raccordi'] = round(time.time() - t0, 1)
        s.log('raccordi: nodi in fascia %d, mossi > 5 cm %d, al bordo della fascia ancora mossi %d' % (int(band.sum()), int(s.SCARP.sum()), s.bordo_banda))

    # ----- 6a. what the DBGT burns at the level of a deck inside a PONTE (fase 6): the rail bed SD_FER of the railway bridge over via Milano
    # (PONTE 14) is one piece with SED=01 across the bridge, and since the DTM is filled across the deck it was no higher than the LiDAR
    # (not a deck part for the cap of step 4): fixed at 220.3 m, 5.5 m over the road under it and 2 m from it. Inside a PONTE footprint with
    # fixed nodes at two levels, those more than LUCE_MIN over the lowest are the deck's, not the ground's: they are freed, and filled below
    def deck_level(s):
        s.ALTO = np.zeros(s.BRP.shape, bool); lab, nl = ndimage.label(s.BRP, np.ones((3, 3), bool))
        for k, sl in enumerate(ndimage.find_objects(lab)):
            M = (lab[sl] == k + 1) & (s.RANK[sl] > 0)
            if M.sum() < 4: continue
            z = s.ZF[sl][M]; lo = np.nanmin(z)
            hi = M & (s.ZF[sl] > lo + LUCE_MIN)
            if hi.any() and (M & ~hi).sum() >= 4: s.ALTO[sl] |= hi
        s.RANK[s.ALTO] = 0
        s.log('a livello di impalcato dentro un PONTE: %d nodi liberati' % int(s.ALTO.sum()))

    # ----- 6b. under the bridges (fase 6): the nodes under a deck that no road, rail or river fixes kept the LiDAR, and the DTM is filled across
    # the deck: under the railway bridge over via Milano (PONTE 14) the sides of the 6 m carriageway stood at the top of the deck, 220.3 m
    # against 214.7, and the diagonal edge of the burn on the 2 m lattice made teeth of 1.3 m across the lane (collaudo 1: the car bounced
    # under the bridge). What passes under a bridge goes on under it as it is on either side: each such node takes the line through it along
    # what passes under (the direction of the fixed road, rail or river nodes under the deck), and S there is the linear interpolation of the
    # first nodes outside the patch on that line, on both sides of the deck (the cross-section of the trench carries on under the bridge, with
    # its sidewalks). Where nothing fixed passes under (a ramp over a field) the harmonic fill (Laplace, 4 neighbours) of what is around. Never
    # above the LiDAR
    def sotto_ponti(s, S, BARR):
        s.SOTTO = np.zeros(BARR.shape, bool); s.n_sotto = 0; s.sotto_dz = np.zeros(0); s.sotto_modo = dict(lungo=0, laplace=0)
        lab, nl = ndimage.label(BARR, np.ones((3, 3), bool))
        if not nl: return
        nz, nx = BARR.shape; dzs = []; FIXED = s.FIX & s.BR & np.isin(s.CLS, (C_VEI, C_VEIT, C_FER, C_ALV, C_ARG, C_PED, C_AREA))
        for k, sl in enumerate(ndimage.find_objects(lab)):
            P = 6; r0, r1, c0, c1 = max(0, sl[0].start - P), min(nz, sl[0].stop + P), max(0, sl[1].start - P), min(nx, sl[1].stop + P)
            M = lab[r0:r1, c0:c1] == k + 1; n = int(M.sum()); W = S[r0:r1, c0:c1]; Lw = s.L[r0:r1, c0:c1]
            rr, cc = np.nonzero(M); new = None
            fr, fc = np.nonzero(FIXED[r0:r1, c0:c1])
            if len(fr) >= 6:  # the direction of what passes under: the long axis of the fixed nodes under the deck
                X = np.stack((fc, fr), 1).astype(float); X -= X.mean(0); ev, evec = np.linalg.eigh(X.T @ X / len(X))
                if ev[1] > 3 * max(ev[0], 1e-6):
                    u = evec[:, 1]; vals = np.full(n, np.nan)
                    for i in range(n):
                        ends = []
                        for sg in (1, -1):
                            t = 0.5
                            while t < 400:
                                c_, r_ = int(round(cc[i] + sg * u[0] * t)), int(round(rr[i] + sg * u[1] * t))
                                if r_ < 0 or c_ < 0 or r_ >= M.shape[0] or c_ >= M.shape[1]: break
                                if not M[r_, c_]: ends.append((t, W[r_, c_])); break
                                t += 0.5
                        if len(ends) == 2: vals[i] = (ends[0][1] * ends[1][0] + ends[1][1] * ends[0][0]) / (ends[0][0] + ends[1][0])
                        elif len(ends) == 1: vals[i] = ends[0][1]
                    if np.isfinite(vals).all(): new = vals; s.sotto_modo['lungo'] += n
            if new is None:  # harmonic fill
                idx = -np.ones(M.shape, np.int64); idx[M] = np.arange(n); me = idx[rr, cc]; rows, cols, vals_ = [], [], []; rhs = np.zeros(n); deg = np.zeros(n)
                for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    r2, c2 = rr + dr, cc + dc; ok = (r2 >= 0) & (r2 < M.shape[0]) & (c2 >= 0) & (c2 < M.shape[1])
                    deg[me[ok]] += 1; r2, c2, m1 = r2[ok], c2[ok], me[ok]; inn = M[r2, c2]
                    rows.append(m1[inn]); cols.append(idx[r2[inn], c2[inn]]); vals_.append(-np.ones(int(inn.sum())))
                    np.add.at(rhs, m1[~inn], W[r2[~inn], c2[~inn]])
                if not (deg > 0).all() or not np.isfinite(rhs).all(): continue
                A = sparse.csr_matrix((np.concatenate([deg] + vals_), (np.concatenate([np.arange(n)] + rows), np.concatenate([np.arange(n)] + cols))), shape=(n, n))
                try: new = sparse.linalg.spsolve(A.tocsc(), rhs)
                except Exception: continue
                if not np.isfinite(new).all(): continue
                s.sotto_modo['laplace'] += n
            new = np.minimum(Lw[M], new); dzs.append(new - W[M]); W[M] = new; s.SOTTO[r0:r1, c0:c1] |= M; s.n_sotto += n
        s.sotto_dz = np.concatenate(dzs) if dzs else np.zeros(0)
        s.log('sotto i ponti: %d nodi (%s), abbassati di %s m' % (s.n_sotto, s.sotto_modo, pct(-s.sotto_dz, (50, 90, 99)) if len(s.sotto_dz) else '-'))

    # ----- 7. tiles: 2 m or 10 m, seams, quantisation
    def tessere(s, osm=None):
        t0 = time.time()
        NEED = s.FIX | s.BR
        for P in s.edifici:
            w, m = s.raster(P)
            if w is not None: NEED[w[0]:w[1], w[2]:w[3]] |= m
        near = ndimage.distance_transform_edt(~NEED, sampling=SF) <= FINE_BUF
        tree = shapely.STRtree(osm) if osm else None
        s.passo = {}
        for tx, tz in s.tiles:
            r0, r1, c0, c1 = s.tile_win(tx, tz); fine = bool(near[r0:r1, c0:c1].any())
            if not fine and tree is not None: fine = len(tree.query(box(*s.tbox(tx, tz)).buffer(FINE_BUF), predicate='intersects')) > 0
            s.passo[(tx, tz)] = SF if fine else SC
        # one global array of final node values: the coarse tiles write their nodes and, along every edge, the line between them
        GF = s.S.copy()
        Cq = np.round(s.Lc / Q5) * Q5
        for (tx, tz), st in s.passo.items():
            if st == SF: continue
            r0, r1, c0, c1 = s.tile_win(tx, tz, s.Rc); C = Cq[r0:r1, c0:c1]
            k = np.arange(NF); i, u = np.minimum(k // 5, NCO - 2), (k - np.minimum(k // 5, NCO - 2) * 5) / 5.0
            J, I = np.meshgrid(i, i, indexing='ij'); V_, U_ = np.meshgrid(u, u, indexing='ij')
            h00, h10, h01, h11 = C[J, I], C[J, I + 1], C[J + 1, I], C[J + 1, I + 1]
            blk = np.where(U_ >= V_, h00 + U_ * (h10 - h00) + V_ * (h11 - h10), h00 + V_ * (h01 - h00) + U_ * (h11 - h01))
            f0, f1, g0, g1 = s.tile_win(tx, tz); GF[f0:f1, g0:g1] = blk
        s.GF = GF; s.HQ = np.round(GF * 100).astype(np.int64)   # whole cm, shared by every tile that has the node
        # node material, then per cell the most common among its four corners
        NM = CLS_MAT[s.CLS] * s.FIX; NM[(NM == 0) & s.SCARP] = M_SCARP; NM[(NM == 0) & s.INT] = M_ASF; s.NM = NM.astype(np.uint8)
        s.t['tessere'] = round(time.time() - t0, 1)
        s.log('tessere: %d (a 2 m %d, a 10 m %d), fuori dalla mappa %d' % (len(s.tiles), sum(v == SF for v in s.passo.values()), sum(v == SC for v in s.passo.values()), s.fuori_mappa))

    def build_S(s, tile):
        """(step, base, h, m) of tile (tx, tz) as written in the .bin: h in cm above base (u16), m the cell materials (u8)"""
        tx, tz = tile; st = s.passo[tile]; r0, r1, c0, c1 = s.tile_win(tx, tz)
        hq = s.HQ[r0:r1, c0:c1]; nm = s.NM[r0:r1, c0:c1]
        if st == SC: hq = hq[::5, ::5]; m = np.zeros((NCO - 1, NCO - 1), np.uint8)
        else:
            cn = np.stack((nm[:-1, :-1], nm[:-1, 1:], nm[1:, :-1], nm[1:, 1:]))
            cnt = np.stack([(cn == v).sum(0) for v in range(1, 7)]); m = np.where(cnt.max(0) >= 2, cnt.argmax(0) + 1, 0).astype(np.uint8)
        base = int(np.floor(hq.min() / 100.0)); q = hq - base * 100
        assert q.max() < 65535
        return int(st), float(base), q.astype(np.uint16), m

    def scrivi(s, out_dir):
        os.makedirs(out_dir, exist_ok=True); peso = dict(n2=0, n10=0, raw2=0, raw10=0, gz2=0, gz10=0)
        for tile in s.tiles:
            st, base, q, m = s.build_S(tile); n = q.shape[0]
            b = b'GTAS' + struct.pack('<BBH', 1, st, n) + struct.pack('<f', base) + q.astype('<u2').tobytes() + m.tobytes()
            open(os.path.join(out_dir, '%d_%d.bin' % tile), 'wb').write(b)
            k = '2' if st == 2 else '10'; peso['n' + k] += 1; peso['raw' + k] += len(b); peso['gz' + k] += len(gzip.compress(b, 9))
        return peso


_S = {}
def costruisci(comune='Meda', margine=250.0, blend=BLEND, osm=True, cache_dir=None):
    """The whole surface of the comune + margine, all steps (about 40 s for Meda); cached per comune."""
    if comune in _S: return _S[comune]
    s = Superficie(comune, margine=margine, blend=blend); s.base(); s.dbgt(); s.strade(); s.tetto(); s.ritocchi(); s.vie(); s.raccordi()
    ob = None
    if osm:
        lo_, la_ = dq.game_to_lonlat(np.array([s.R.x0 - 50, s.R.x0 + s.R.nx * SF + 50]), np.array([s.R.z0 + s.R.nz * SF + 50, s.R.z0 - 50]))
        ob = osm_ostacoli(os.path.join(DATA, 'osm', 'maplarge.osm'), (lo_[0], la_[0], lo_[1], la_[1]), os.path.join(cache_dir, 'cache_osm_v2.pkl') if cache_dir else None)
    s.tessere(ob); _S[comune] = s; return s


def build_S(tile, comune='Meda'):
    """docs/motore.md fase 2: (step, base, h, m) of tile (tx, tz), h in cm above base, as written in terreno/<tx>_<tz>.bin"""
    return costruisci(comune).build_S(tuple(tile))


# ---------- reading the .bin back (what the game will do) ----------
def leggi_bin(f):
    b = open(f, 'rb').read(); assert b[:4] == b'GTAS'
    ver, st, n = struct.unpack('<BBH', b[4:8]); base, = struct.unpack('<f', b[8:12])
    q = np.frombuffer(b, '<u2', n * n, 12).reshape(n, n); m = np.frombuffer(b, np.uint8, (n - 1) ** 2, 12 + 2 * n * n).reshape(n - 1, n - 1)
    return st, (base * 100 + q.astype(np.float64)) / 100, m      # decode as (base*100 + q)/100: the same number in every tile


# ---------- controls ----------
def pct(a, ps=(50, 90, 99)):
    a = np.asarray(a, float); a = a[np.isfinite(a)]
    if not len(a): return dict(n=0)
    return dict(n=int(len(a)), **{'p%d' % p: round(float(np.percentile(a, p)), 3) for p in ps}, max=round(float(a.max()), 3))


def link(x, z): return '?x=%.1f&z=%.1f' % (x, z)


def controlli(s, out_dir):
    R = s.R; t0 = time.time(); rep = {}; punti = []
    # read every tile back into one array of decoded nodes (also C7)
    GQ = np.full((R.nz, R.nx), np.nan); dec = {}
    for tile in s.tiles:
        st, h, m = leggi_bin(os.path.join(out_dir, '%d_%d.bin' % tile)); dec[tile] = (st, h)
    salto, salto_t, ncomp = 0.0, 0.0, 0
    for (tx, tz), (st, h) in dec.items():
        for dx, dz in ((1, 0), (0, 1), (1, 1), (1, -1)):
            o = dec.get((tx + dx, tz + dz))
            if o is None: continue
            so, ho = o
            # the shared nodes in metres from this tile's corner
            ex, ez = (tx - s.i0) * TILE, (tz - s.j0) * TILE
            def nodes_of(tt, stt):
                n = int(TILE / stt) + 1; k = np.arange(n) * stt; return k
            if (dx, dz) == (1, 0): pa = [(TILE, v) for v in nodes_of(None, max(st, so))]
            elif (dx, dz) == (0, 1): pa = [(v, TILE) for v in nodes_of(None, max(st, so))]
            elif (dx, dz) == (1, 1): pa = [(TILE, TILE)]
            else: pa = [(TILE, 0.0)]
            for (u, v) in pa:
                a = h[int(round(v / st)), int(round(u / st))]
                uo, vo = u - dx * TILE, v - dz * TILE; b = ho[int(round(vo / so)), int(round(uo / so))]
                salto = max(salto, abs(a - b)); ncomp += 1
            if st != so and (dx, dz) in ((1, 0), (0, 1)):  # T junction: fine border nodes against the coarse edge line
                fh, ch, sgn = (h, ho, 1) if st == SF else (ho, h, -1)
                for k in range(NF):
                    t = k * SF; j, f = min(int(t // SC), NCO - 2), (t - min(int(t // SC), NCO - 2) * SC) / SC
                    if (dx, dz) == (1, 0):
                        fv = fh[k, -1] if sgn == 1 else fh[k, 0]; cv = ch[:, 0] if sgn == 1 else ch[:, -1]
                    else:
                        fv = fh[-1, k] if sgn == 1 else fh[0, k]; cv = ch[0, :] if sgn == 1 else ch[-1, :]
                    salto_t = max(salto_t, abs(fv - (cv[j] * (1 - f) + cv[j + 1] * f)))
    for tile, (st, h) in dec.items():
        r0, r1, c0, c1 = s.tile_win(*tile)
        if st == SF: GQ[r0:r1, c0:c1] = h
        else:
            Cq = h; k = np.arange(NF); i = np.minimum(k // 5, NCO - 2); u = (k - i * 5) / 5.0
            J, I = np.meshgrid(i, i, indexing='ij'); V_, U_ = np.meshgrid(u, u, indexing='ij')
            h00, h10, h01, h11 = Cq[J, I], Cq[J, I + 1], Cq[J + 1, I], Cq[J + 1, I + 1]
            GQ[r0:r1, c0:c1] = np.where(U_ >= V_, h00 + U_ * (h10 - h00) + V_ * (h11 - h10), h00 + V_ * (h01 - h00) + U_ * (h11 - h01))
    rep['C7'] = dict(salto_max_m=round(salto, 6), nodi_confrontati=ncomp, salto_a_T_max_m=round(salto_t, 6), soglia='0.000 m', ok=bool(round(salto, 3) == 0 and round(salto_t, 3) == 0))
    s.GQ = GQ; IN = ~np.isnan(GQ); G0 = np.nan_to_num(GQ)
    H = lambda x, z: tri_interp(G0, R, x, z)
    def nodo(x, z):  # nearest node index
        return np.clip(np.round((z - R.z0) / SF).astype(int), 0, R.nz - 1), np.clip(np.round((x - R.x0) / SF).astype(int), 0, R.nx - 1)
    # C4: carriageway nodes with |DBGT - L| > 1.5 m, as places (connected patches)
    car = np.isin(s.CLS, (C_VEI, C_VEIT)) & (np.abs(np.nan_to_num(s.DZ)) > DZ_WARN) & ((s.RANK > 0) | s.AIR)
    lab, nl = ndimage.label(car, np.ones((3, 3), bool)); casi = []
    zon = s.D['AC_VEI']['attr']['zon']; ids = s.D['AC_VEI']['id']
    if nl:
        objs = ndimage.find_objects(lab)
        for k, sl in enumerate(objs):
            m = lab[sl] == k + 1; dz = s.DZ[sl][m]; rr, cc = np.nonzero(m); rr, cc = rr + sl[0].start, cc + sl[1].start
            fid = s.FID[rr, cc]; zz = sorted(set(str(zon[f]) for f in fid if f >= 0))
            dec_ = 'impalcato' if s.AIR[rr, cc].any() else ('lidar' if s.CAP[rr, cc].any() else ('tombino' if s.TOMB[rr, cc].any() else 'dbgt'))
            j = np.argmax(np.abs(dz)); x, z = R.x0 + cc[j] * SF, R.z0 + rr[j] * SF
            casi.append(dict(x=round(float(x), 1), z=round(float(z), 1), nodi=int(m.sum()), dz_max=round(float(dz[j]), 2), dz_mediana=round(float(np.median(dz)), 2),
                             esito=dec_, zon=zz, ac_vei=sorted(set(int(ids[f]) for f in fid if f >= 0))[:6], interne=bool(zz == ['0307']), link=link(x, z)))
    casi.sort(key=lambda c: -abs(c['dz_max']) * c['nodi'] ** 0.5)
    strade_vere = [c for c in casi if not c['interne'] and c['esito'] != 'impalcato']
    rep['C4'] = dict(definizione='nodi di carreggiata (AC_VEI SED=01) con |Z_DBGT - L| > %.1f m, raggruppati in luoghi (8-connessi); oltre %.1f m e lontano dai ponti si tiene L (esito lidar), entro %.0f m da un ponte diventa impalcato (fase 3)' % (DZ_WARN, DZ_CAP, NEAR_BR),
                     nodi=int(car.sum()), luoghi=len(casi), per_esito={e: sum(1 for c in casi if c['esito'] == e) for e in ('dbgt', 'lidar', 'impalcato', 'tombino')},
                     luoghi_aree_interne_0307=sum(1 for c in casi if c['interne']), luoghi_strade_non_impalcato=len(strade_vere),
                     luoghi_strade_almeno_5_nodi=sum(1 for c in strade_vere if c['nodi'] >= 5),
                     soglia='< 30 luoghi sulle strade (ZON diversa da 0307, impalcati esclusi) con almeno 5 nodi', elenco=casi[:300])
    rep['C4']['ok'] = rep['C4']['luoghi_strade_almeno_5_nodi'] < 30
    punti += [dict(c='C4', x=c['x'], z=c['z'], v=c['dz_max'], esito=c['esito'], link=c['link']) for c in strade_vere[:15]]
    # C5: road nodes of the road graph (brianza.json) on the DBGT carriageways, not on decks
    nodes = None; bj = os.path.join(HERE, '..', 'brianza.json')
    if os.path.exists(bj):
        nn = np.array(json.load(open(bj, encoding='utf-8'))['nodes'], float).reshape(-1, 3); nodes = nn[:, :2] / 10
    c5 = {}
    if nodes is not None:
        x, z = nodes[:, 0], nodes[:, 1]; ok = (x > R.x0) & (x < R.x0 + (R.nx - 1) * SF) & (z > R.z0) & (z < R.z0 + (R.nz - 1) * SF)
        x, z = x[ok], z[ok]; r_, c_ = nodo(x, z); ok = IN[r_, c_] & np.isin(s.CLS[r_, c_], (C_VEI, C_VEIT)) & s.FIX[r_, c_] & ~s.BR[r_, c_] & ~s.NEARCAP[r_, c_]
        x, z, r_, c_ = x[ok], z[ok], r_[ok], c_[ok]
        nok = IN & s.FIX & np.isin(s.CLS, (C_VEI, C_VEIT)) & ~s.BR & ~s.NEARCAP
        ci, ri = np.clip(((x - R.x0) // SF).astype(int), 0, R.nx - 2), np.clip(((z - R.z0) // SF).astype(int), 0, R.nz - 2)
        ok = nok[ri, ci] & nok[ri, ci + 1] & nok[ri + 1, ci] & nok[ri + 1, ci + 1]   # the whole cell on carriageway
        x, z, r_, c_ = x[ok], z[ok], r_[ok], c_[ok]; hb = H(x, z); hs = tri_interp(s.GF, R, x, z)
        e1 = np.abs(hb - hs)
        zr = np.full(len(x), np.nan)   # the carriageway function itself at the node (the polygon of the nearest node)
        fid = s.FID[r_, c_]
        for f in np.unique(fid):
            k = fid == f
            if f in s.vei: zr[k] = s.road(s.vei[f], x[k], z[k])
        e2 = np.abs(hb - zr)
        c5 = dict(definizione='nodi delle strade (brianza.json nodes) sulle carreggiate DBGT, fuori da ponti e tetto: |S letto dai .bin (triangoli) - S calcolato| e |S dai .bin - quota della carreggiata nel punto|',
                  nodi=int(len(x)), bin_contro_S=pct(e1), bin_contro_carreggiata=pct(e2), spalle='fase 3 (impalcati)', soglia='p99 < 0.05 m, max < 0.2 m')
        c5['ok'] = bool(len(x) and c5['bin_contro_S']['p99'] < 0.05 and c5['bin_contro_S']['max'] < 0.2)
        c5['ok_carreggiata'] = bool(len(x) and c5['bin_contro_carreggiata']['p99'] < 0.05 and c5['bin_contro_carreggiata']['max'] < 0.2)
        o = np.argsort(-np.nan_to_num(e2))[:10]
        punti += [dict(c='C5', x=round(float(x[k]), 1), z=round(float(z[k]), 1), v=round(float(e2[k]), 3), link=link(x[k], z[k])) for k in o]
    rep['C5'] = c5
    # C6: slope of S along every ground axis (4 m base), against the slope of the axis itself
    EL = s.D['EL_STR']; deck = dq.is_deck('EL_STR', EL); c6 = []; allsl = []
    nok = IN & s.FIX & np.isin(s.CLS, (C_VEI, C_VEIT)) & ~s.BR & ~s.CAP
    cellok = nok[:-1, :-1] & nok[:-1, 1:] & nok[1:, :-1] & nok[1:, 1:]   # the whole cell on carriageway: its triangles are all road
    for i in range(len(EL['off']) - 1):
        if deck[i]: continue
        a, b = EL['off'][i], EL['off'][i + 1]; xy, za = EL['xy'][a:b], EL['z'][a:b]
        if np.isnan(za).sum() > len(za) - 2: continue
        r = denso(xy, za, ~np.isnan(za), 1.0, closed=False)
        if r is None or len(r[0]) < 6: continue
        p, zx = r; cc = np.clip(((p[:, 0] - R.x0) // SF).astype(int), 0, R.nx - 2); rr = np.clip(((p[:, 1] - R.z0) // SF).astype(int), 0, R.nz - 2)
        ok = cellok[rr, cc]
        hs = H(p[:, 0], p[:, 1]); sl = np.abs(hs[4:] - hs[:-4]) / 4; sa = np.abs(zx[4:] - zx[:-4]) / 4; ok = ok[4:] & ok[:-4]
        if not ok.any(): continue
        sl, sa = sl[ok], sa[ok]; allsl.append(sl); j = np.argmax(sl); pj = p[4:][ok][j]
        c6.append(dict(el_str=int(EL['id'][i]), x=round(float(pj[0]), 1), z=round(float(pj[1]), 1), pendenza=round(float(sl[j]), 3), pendenza_asse=round(float(sa[j]), 3), link=link(*pj)))
    allsl = np.concatenate(allsl) if allsl else np.zeros(0)
    sopra = sorted([c for c in c6 if c['pendenza'] > 0.18], key=lambda c: -c['pendenza'])
    nuove = [c for c in sopra if c['pendenza_asse'] <= 0.18]
    # cross steps: slope of every triangle of the carriageway cells (all four corners carriageway, not capped)
    G = np.nan_to_num(GQ); cv = np.isin(s.CLS, (C_VEI, C_VEIT)) & s.FIX & ~s.CAP & IN
    cell = cv[:-1, :-1] & cv[:-1, 1:] & cv[1:, :-1] & cv[1:, 1:]
    h00, h10, h01, h11 = G[:-1, :-1], G[:-1, 1:], G[1:, :-1], G[1:, 1:]
    s1 = np.hypot(h10 - h00, h11 - h10) / SF; s2 = np.hypot(h11 - h01, h01 - h00) / SF; tri = np.maximum(s1, s2)[cell]
    rr, cc = np.nonzero(cell); o = np.argsort(-tri)[:200]
    ripidi = [dict(x=round(float(R.x0 + cc[k] * SF + 1), 1), z=round(float(R.z0 + rr[k] * SF + 1), 1), pendenza=round(float(tri[k]), 3)) for k in o if tri[k] > 0.18]
    rep['C6'] = dict(definizione='pendenza di S lungo ogni asse EL_STR a terra (base 4 m, campioni ogni 1 m sulle carreggiate) e, a parte, pendenza dei triangoli delle celle di carreggiata',
                     assi=len(c6), pendenza_lungo_assi=pct(allsl, (50, 99)), assi_sopra_18=len(sopra), assi_sopra_18_non_ripidi_nel_dbgt=len(nuove),
                     triangoli_carreggiata=pct(tri, (50, 90, 99)), triangoli_sopra_18=int((tri > 0.18).sum()), celle_carreggiata=int(cell.sum()),
                     soglia='< 18 %% lungo gli assi; ok se ogni asse sopra il 18 %% lo e gia nel DBGT', elenco=sopra[:100], triangoli_ripidi=ripidi[:60])
    rep['C6']['ok'] = len(nuove) == 0
    # steps S has and the LiDAR has not: adjacent nodes whose difference grows by more than 1.5 m (steeper than the 2:3 slope) (decks, culverts and their edges excluded)
    ex = (s.BR | s.AIR | s.TOMB)
    ex = ndimage.binary_dilation(ex, np.ones((3, 3), bool))
    gr = []
    for ax in (0, 1):
        dS, dL = np.abs(np.diff(G, axis=ax)), np.abs(np.diff(s.L, axis=ax))
        a_ = [slice(None)] * 2; b_ = [slice(None)] * 2; a_[ax] = slice(0, -1); b_[ax] = slice(1, None)
        m = (dS - dL > 1.5) & IN[tuple(a_)] & IN[tuple(b_)] & ~ex[tuple(a_)] & ~ex[tuple(b_)]
        cl = s.CLS[tuple(a_)]; clb = s.CLS[tuple(b_)]
        gr.append((m, np.isin(cl, (C_ALV, C_ARG)) | np.isin(clb, (C_ALV, C_ARG))))
    ng = sum(int(m.sum()) for m, _ in gr); nga = sum(int((m & a).sum()) for m, a in gr)
    rep['C6']['gradini_non_nel_lidar'] = dict(definizione='coppie di nodi vicini con |dS| - |dL| > 1.5 m (oltre la scarpata 2:3 su 2 m), fuori da ponti, impalcati e tombini', coppie=ng, di_cui_sponde_alveo=nga)
    punti += [dict(c='C6', x=c['x'], z=c['z'], v=c['pendenza'], link=c['link']) for c in (nuove or sopra)[:10]]
    # C10: water level along the river axes inside the bed
    rep['C10'], acqua, pw = acqua_fiume(s, H, IN)
    punti += pw
    if acqua:  # what the game draws: share of the bed cells under the water, wet cells outside the bed
        cn = np.stack((s.NM[:-1, :-1], s.NM[:-1, 1:], s.NM[1:, :-1], s.NM[1:, 1:])); cnt = np.stack([(cn == v).sum(0) for v in range(1, 7)])
        cm = np.where(cnt.max(0) >= 2, cnt.argmax(0) + 1, 0)
        rep['C10']['copertura'] = copertura_acqua(G0, R, (cm == M_ALVEO) & IN[:-1, :-1] & IN[1:, 1:], acqua, s.AU)
    json.dump(acqua, open(os.path.join(os.path.dirname(out_dir.rstrip('/\\')), 'acqua_fase2.json'), 'w'), indent=0)
    s.t['controlli'] = round(time.time() - t0, 1)
    return rep, punti[:50]


def copertura_acqua(G, R, celle, serie, AU=None, wmax=12.0, sub=4):
    """What the game draws (world3.js, the water level of a tile of S): zw of the nearest axis within wmax, a sheet where zw > S. Returns
    the share of the bed cells (cell material 4) under water (sub x sub points per cell) and, flooding from the bed cells as the game
    does (a cell joins when the water is over S at one of its corners, at most wmax out), the wet cells more than 1 m outside the bed."""
    pts = np.vstack([np.asarray(q['p'], float) for q in serie]); zz = np.concatenate([np.asarray(q['zw'], float) for q in serie]); kd = cKDTree(pts)
    def zw_at(x, z):
        d, j = kd.query(np.column_stack((x, z))); return np.where(d <= wmax, zz[np.minimum(j, len(zz) - 1)], np.nan)
    rr, cc = np.nonzero(celle); u = (np.arange(sub) + 0.5) / sub; U, V = np.meshgrid(u, u)
    x = (R.x0 + (cc[:, None] + U.ravel()[None]) * R.st).ravel(); z = (R.z0 + (rr[:, None] + V.ravel()[None]) * R.st).ravel()
    wet = (zw_at(x, z) > tri_interp(G, R, x, z)).reshape(len(rr), -1).mean(1)
    out = dict(celle_alveo=int(len(rr)), coperte=round(float(wet.mean()), 3), celle_asciutte=int((wet == 0).sum()))
    # flood as the game: from the bed cells, 4-neighbours, a cell is wet when one corner is under the water
    nz, nx = G.shape; ii, jj = np.meshgrid(np.arange(nx), np.arange(nz)); X, Z = R.x0 + ii * R.st, R.z0 + jj * R.st
    W = zw_at(X.ravel(), Z.ravel()).reshape(G.shape); under = np.nan_to_num(W - G, nan=-1) > 0
    cw = under[:-1, :-1] | under[:-1, 1:] | under[1:, :-1] | under[1:, 1:]
    seed = celle & cw; grown = ndimage.binary_propagation(seed, mask=cw & ndimage.binary_dilation(celle, iterations=int(wmax / R.st)))
    if AU is not None:
        er, ec = np.nonzero(grown & ~celle)
        cx, cz = R.x0 + (ec + 0.5) * R.st, R.z0 + (er + 0.5) * R.st
        far = shapely.distance(AU, shapely.points(cx, cz)) > 1.0
        out['celle_bagnate_oltre_1m_fuori_alveo'] = int(far.sum())
        far &= kd.query(np.column_stack((cx, cz)))[0] > 3.0     # the water that goes on along the axis where the polygon has a gap is the river
        out['di_cui_fuori_dall_asse_oltre_3m'] = int(far.sum())
        M = np.zeros(celle.shape, bool); M[er[far], ec[far]] = True; lab, nl = ndimage.label(M, np.ones((3, 3), bool))
        if nl:
            sz = np.bincount(lab.ravel())[1:]; o = np.argsort(-sz)[:10]; cm = ndimage.center_of_mass(M, lab, o + 1)
            out['macchie'] = [dict(celle=int(sz[j]), link=link(R.x0 + (c_[1] + 0.5) * R.st, R.z0 + (c_[0] + 0.5) * R.st)) for j, c_ in zip(o, cm)]
    return out


def acqua_fiume(s, H, IN):
    """C10 on the final S (read back from the .bin): the zw of the build (acqua_build) against the lowest S of the bed in the section and
    the banks (the higher of the first two samples outside the bed, 1 and 2 m). Where the water would still stand over a bank - 0.1 it is
    lowered there and downstream (running minimum); the series written for the game are these."""
    out, nonmono, sopra, sotto, npt, pw, abbassati, coperti, scarti = [], 0, 0, 0, 0, [], 0, 0, []
    R = s.R; AU = s.AU
    for q in s.ACQ:
        p, zw = q['p'].copy(), q['zw'].copy()
        ri, ci = np.round((p[:, 1] - R.z0) / SF).astype(int), np.round((p[:, 0] - R.x0) / SF).astype(int)
        ok = (ri >= 0) & (ri < R.nz) & (ci >= 0) & (ci < R.nx); ok[ok] = IN[ri[ok], ci[ok]]
        p, zw, ri, ci = p[ok], zw[ok], ri[ok], ci[ok]
        if len(p) < 3: continue
        t = np.gradient(p, axis=0); t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]; nrm = np.column_stack((-t[:, 1], t[:, 0]))
        offs = np.arange(-25, 25.5, 1.0); Q = p[:, None, :] + offs[None, :, None] * nrm[:, None, :]
        ins = shapely.contains_xy(AU, Q[..., 0], Q[..., 1]); hq = H(Q[..., 0].ravel(), Q[..., 1].ravel()).reshape(Q.shape[:2])
        c = len(offs) // 2; zmin = np.full(len(p), np.nan); bank = np.full(len(p), np.nan)
        for k in range(len(p)):
            if not ins[k, c]: continue
            lo_ = c
            while lo_ > 0 and ins[k, lo_ - 1]: lo_ -= 1
            hi_ = c
            while hi_ < len(offs) - 1 and ins[k, hi_ + 1]: hi_ += 1
            zmin[k] = hq[k, lo_:hi_ + 1].min()
            sides = []
            if lo_ > 1: sides.append(max(hq[k, lo_ - 1], hq[k, lo_ - 2]))
            if hi_ < len(offs) - 2: sides.append(max(hq[k, hi_ + 1], hq[k, hi_ + 2]))
            if sides: bank[k] = min(sides)
        u = np.where(np.isnan(bank), np.inf, bank - 0.1); U = np.minimum.accumulate(u)
        low = zw > U + 1e-9; abbassati += int(low.sum())
        if low.any(): scarti.append(zw[low] - U[low])
        zw = np.minimum(zw, U)
        cov = s.ALVCOP[ri, ci] | ~s.FIX[ri, ci] | (s.CLS[ri, ci] != C_ALV)   # covered stretches and culverts (a street over the axis): no water to see
        coperti += int(cov.sum())
        nonmono += int((np.diff(zw) > 1e-9).sum()); bad = zw > bank + 0.1; sopra += int(np.nansum(bad))
        bs = (zw < zmin - 1e-6) & ~cov; sotto += int(bs.sum()); npt += len(p)
        for k in np.nonzero(bs)[0][::25]: pw.append(dict(c='C10_sotto', x=round(float(p[k, 0]), 1), z=round(float(p[k, 1]), 1), v=round(float(zw[k] - zmin[k]), 2), link=link(*p[k])))
        for k in np.argsort(-np.nan_to_num(zw - bank))[:3]:
            if bad[k]: pw.append(dict(c='C10', x=round(float(p[k, 0]), 1), z=round(float(p[k, 1]), 1), v=round(float(zw[k] - bank[k]), 2), link=link(*p[k])))
        out.append(dict(p=np.round(p, 1).tolist(), zw=np.round(zw, 2).tolist(), fondo=[None if np.isnan(v) else round(float(v), 2) for v in zmin], sponda=[None if np.isnan(v) else round(float(v), 2) for v in bank]))
    sc = np.concatenate(scarti) if scarti else np.zeros(0)
    rep = dict(definizione='pelo dell acqua lungo gli assi EL_IDR dentro ALVEO/ALVEO_A (rifinitura 24/10): dalla quota dell anello all asse - %.1f m, mai sopra le sponde intorno - 0.1 m, regressione isotonica verso valle, lisciatura a 20 m, minimo progressivo delle sole sponde; il fondo si scava dal pelo (1:1 fino a %.1f m sotto). Sponda: la piu alta fra i primi due campioni fuori dall alveo (1 e 2 m)' % (ZW_MARG, ALV_D),
               serie=len(out), punti=npt, build=s.acqua_info, abbassati_sulle_sponde_finali=abbassati, abbassati_di=pct(sc, (50, 90, 99)), zw_non_monotona=nonmono, acqua_sopra_le_sponde=sopra,
               acqua_sotto_il_fondo=sotto, punti_coperti_esclusi=coperti, nodi_alveo_senza_asse_asciutti=s.secco, soglia='0 non monotone, 0 sopra le sponde (+0.1 m), sotto il fondo al massimo %.0f %% dei punti (tratti coperti esclusi)' % (SOTTO_MAX * 100))
    rep['ok'] = bool(nonmono == 0 and sopra == 0 and sotto <= SOTTO_MAX * max(1, npt))
    return rep, out, pw[:10]


# ---------- images ----------
def immagini(s, out):
    R = s.R; fuori = np.isnan(s.GQ); G = np.where(fuori, s.L, s.GQ); D = G - s.L
    ed = np.zeros(G.shape, bool)  # outline of the comune
    try:
        ring = np.vstack([np.asarray(g.exterior.coords) for g in getattr(s.conf, 'geoms', [s.conf])])
        r = denso(ring, np.zeros(len(ring)), np.ones(len(ring), bool), 1.0, closed=False)[0]
        rr, cc = np.round((r[:, 1] - R.z0) / SF).astype(int), np.round((r[:, 0] - R.x0) / SF).astype(int); k = (rr >= 0) & (rr < R.nz) & (cc >= 0) & (cc < R.nx)
        ed[rr[k], cc[k]] = True
    except Exception: pass
    coarse = np.zeros(G.shape, bool)
    for tile, st in s.passo.items():
        if st == SC: r0, r1, c0, c1 = s.tile_win(*tile); coarse[r0:r1, c0:c1] = True
    sh = shade(D, SF, 6.0); t = np.clip(D / 3.0, -1, 1)[..., None]
    pos, neg, mid = np.array([200, 60, 40]), np.array([40, 90, 210]), np.array([235, 235, 230])
    col = np.where(t > 0, mid + (pos - mid) * t, mid + (neg - mid) * (-t))
    img = col * (0.25 + 0.75 * sh[..., None])
    img[coarse] = img[coarse] * 0.8 + np.array([120, 160, 110]) * 0.2
    img[fuori] = img[fuori] * 0.5 + 110
    img[ed] = (20, 20, 20)
    png(os.path.join(out, 'S_meda.png'), img)
    sh = shade(G, SF, 2.0); lo, hi = np.percentile(G, 1), np.percentile(G, 99); t = np.clip((G - lo) / max(1e-6, hi - lo), 0, 1)[..., None]
    img = ((1 - t) * np.array([70, 120, 80]) + t * np.array([215, 200, 160])) * (0.3 + 0.7 * sh[..., None]); img[fuori] = img[fuori] * 0.5 + 110; img[ed] = (20, 20, 20)
    png(os.path.join(out, 'S_intero.png'), img)
    # zoom on the Milano-Meda junction (the prototype area): LiDAR | S - L | S, 1 px = 1 m
    w = R.win((-350, 150, 250, 750))
    if w is not None:
        r0, r1, c0, c1 = w; Lc, Gc = s.L[r0:r1, c0:c1], G[r0:r1, c0:c1]; Dc = Gc - Lc
        def tint(H_):
            lo, hi = np.percentile(H_, 1), np.percentile(H_, 99); tt = np.clip((H_ - lo) / max(1e-6, hi - lo), 0, 1)[..., None]
            return ((1 - tt) * np.array([70, 120, 80]) + tt * np.array([215, 200, 160])) * (0.3 + 0.7 * shade(H_, SF, 2.0)[..., None])
        tt = np.clip(Dc / 3.0, -1, 1)[..., None]; cd = np.where(tt > 0, mid + (pos - mid) * tt, mid + (neg - mid) * (-tt)) * (0.25 + 0.75 * shade(Dc, SF, 6.0)[..., None])
        both = np.concatenate((tint(Lc), np.full((Lc.shape[0], 4, 3), 255.0), cd, np.full((Lc.shape[0], 4, 3), 255.0), tint(Gc)), axis=1)
        png(os.path.join(out, 'S_svincolo.png'), np.repeat(np.repeat(both, 2, 0), 2, 1))


def main(argv=None):
    global AX_SIGMA
    ap = argparse.ArgumentParser(description='Superficie unica S (fase 2): griglia, tessere .bin e controlli C4-C7, C10')
    ap.add_argument('--out', default=os.path.normpath(os.path.join(HERE, '..', '..', 'motore_out')))
    ap.add_argument('--comune', default='Meda'); ap.add_argument('--margine', type=float, default=250.0)
    ap.add_argument('--blend', type=float, default=BLEND, help='0: quota dell asse piu vicino (il prototipo)')
    ap.add_argument('--sigma', type=float, default=AX_SIGMA, help='lisciatura degli assi (0: Z degli assi come nel DBGT)')
    ap.add_argument('--no-png', action='store_true'); ap.add_argument('--accetta', action='store_true')
    a = ap.parse_args(argv)
    AX_SIGMA = a.sigma
    s = Superficie(a.comune, margine=a.margine, blend=a.blend)
    log('tessere da fare %d (tx %d..%d, tz %d..%d), griglia %dx%d' % (len(s.tiles), s.i0, s.i1, s.j0, s.j1, s.R.nx, s.R.nz))
    s.base(); s.dbgt(); s.strade(); s.tetto(); s.ritocchi(); s.vie(); s.raccordi()
    t0 = time.time()
    lo_, la_ = dq.game_to_lonlat(np.array([s.R.x0 - 50, s.R.x0 + s.R.nx * SF + 50]), np.array([s.R.z0 + s.R.nz * SF + 50, s.R.z0 - 50]))
    osm = osm_ostacoli(os.path.join(DATA, 'osm', 'maplarge.osm'), (lo_[0], la_[0], lo_[1], la_[1]), os.path.join(a.out, 'cache_osm_v2.pkl'))
    s.t['osm'] = round(time.time() - t0, 1); log('osm: %d oggetti per decidere il passo' % len(osm))
    s.tessere(osm)
    tdir = os.path.join(a.out, 'terreno'); t0 = time.time(); peso = s.scrivi(tdir); s.t['scrittura'] = round(time.time() - t0, 1)
    rep, punti = controlli(s, tdir)
    if not a.no_png: t0 = time.time(); immagini(s, a.out); s.t['immagini'] = round(time.time() - t0, 1)
    np.save(os.path.join(a.out, 'S_2m.npy'), s.GQ.astype(np.float32)); np.save(os.path.join(a.out, 'L_2m.npy'), s.L.astype(np.float32))
    np.save(os.path.join(a.out, 'maschere_2m.npy'), (s.CLS.astype(np.uint16) | (s.FIX << 4) | (s.BR << 5) | (s.AIR << 6) | (s.CAP << 7) | (s.SCARP << 8)).astype(np.uint16))
    dz = s.DZ[np.isin(s.CLS, (C_VEI, C_VEIT)) & ~np.isnan(s.DZ)]
    tot = round(time.time() - T0, 1)
    out = dict(fase=2, comune=a.comune, griglia=dict(x0=s.R.x0, z0=s.R.z0, nx=s.R.nx, nz=s.R.nz, passo=SF, file_npy='S_2m.npy L_2m.npy maschere_2m.npy (classe | fisso<<4 | ponte<<5 | impalcato<<6 | tetto<<7 | scarpata<<8)'),
               tessere=dict(totale=len(s.tiles), a_2m=sum(v == SF for v in s.passo.values()), a_10m=sum(v == SC for v in s.passo.values()), fuori_dalla_mappa=s.fuori_mappa,
                            elenco_10m=sorted('%d_%d' % t for t, v in s.passo.items() if v == SC)),
               parametri=dict(K=K, fascia_m=BAND, frangia_m=FRINGE, asse_proprio_m=AX_OWN, asse_vicino_m=AX_NEAR, fusione_assi_m=s.blend, lisciatura_assi_m=AX_SIGMA, livello_m=LEVEL, dz_elenco_m=DZ_WARN, dz_tetto_m=DZ_CAP,
                              vicino_ponte_m=NEAR_BR, raccordo_tetto_m=RAMP, buffer_passo_fine_m=FINE_BUF, infittimento_m=DENS, aggancio_cordolo_m=KERB_TOL, acqua_sotto_anello_m=ZW_MARG, fondo_sotto_acqua_m=ALV_D, sponda_sotto_acqua=ALV_G, quanto_10m=Q5),
               dbgt=dict(offset_m=s.info['offset']['valore'], assi_lisciati_quanto_si_muovono=pct(np.abs(s.AX.dz_liscio)), carreggiate=s.nst, bordi_agganciati=s.nkerb, bordi_non_agganciati_oltre_1m=s.kerb_lontani, scarto_aggancio=pct(np.abs(s.kerb_dz)), aree_interne_al_lidar=len(s.interne), alvei_bruciati=s.nalveo, ferrovia_fuori_sedi_punti=s.ferro_fuori),
               lidar=dict(buchi=s.nbuchi, nota='nessun buco nel riquadro: TINITALY non serve qui'),
               superficie=dict(nodi_fissi=int(s.FIX.sum()), sotto_ponti=int(s.BR.sum()), nodi_impalcato_da_fase3=int(s.AIR.sum()), nodi_tetto=int(s.CAP.sum()), nodi_tombino_tenuti=int(s.TOMB.sum()), nodi_alveo_al_lidar=int(s.ALVCOP.sum()), nodi_scarpata=int(s.SCARP.sum()),
                               bordo_fascia_ancora_mosso=s.bordo_banda, dentro_ponte_a_livello_impalcato=int(s.ALTO.sum()), sotto_ponti_riempiti=s.n_sotto, sotto_ponti_modo=s.sotto_modo, sotto_ponti_abbassati_m=pct(-s.sotto_dz) if len(s.sotto_dz) else None, carreggiata_meno_lidar=pct(dz, (10, 50, 90)), ritocchi=s.nrit,
                               vie_disegnate=dict(s.nvie, definizione='nodi liberi dentro asfalto e marciapiedi disegnati (brianza.json as, sd) entro %.0f m da una carreggiata DBGT della stessa via, portati alla sua quota' % VIA_MAX, quota_meno_lidar=pct(s.vie_dz, (1, 10, 50, 90, 99)), luoghi_oltre_1_5m=len(s.vie_luoghi), elenco=s.vie_luoghi[:40])),
               C9_peso=peso, **rep, punti_da_guardare=punti, tempi_s=dict(s.t, totale=tot))
    ok = all(rep[c].get('ok', True) for c in ('C4', 'C5', 'C6', 'C7', 'C10'))
    out['esito'] = {c: rep[c].get('ok') for c in ('C4', 'C5', 'C6', 'C7', 'C10')}
    json.dump(out, open(os.path.join(a.out, 'report_fase2.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1, default=float)
    log('C4 luoghi %d (strade %d, con >=5 nodi %d) %s' % (rep['C4']['luoghi'], rep['C4']['luoghi_strade_non_impalcato'], rep['C4']['luoghi_strade_almeno_5_nodi'], rep['C4']['per_esito']))
    if rep['C5']: log('C5 bin-S %s, bin-carreggiata %s' % (rep['C5']['bin_contro_S'], rep['C5']['bin_contro_carreggiata']))
    log('C6 assi sopra 18%% %d (nuovi %d), triangoli %s sopra 18%% %d' % (rep['C6']['assi_sopra_18'], rep['C6']['assi_sopra_18_non_ripidi_nel_dbgt'], rep['C6']['triangoli_carreggiata'], rep['C6']['triangoli_sopra_18']))
    log('C7 %s' % rep['C7']); log('C10 %s' % {k: v for k, v in rep['C10'].items() if k != 'definizione'})
    log('C9 %s' % peso); log('esito %s -> %s' % (out['esito'], 'ok' if ok else 'FUORI SOGLIA'))
    return 0 if ok or a.accetta else 2


if __name__ == '__main__':
    sys.exit(main())
