# Motore nuovo, fase 1 (docs/motore.md 1.3 e 5): DBGT read with clean Z. load_dbgt() returns the layers the height model needs, with every
# vertex in game metres and a Z that is either real, borrowed from a nearby axis, or the LiDAR; offset_comune() measures DBGT - DTM on the
# at-grade road axes; controlli() writes C1-C3. No use of build_data.py or of the game.
#   python src/dbgt_quote.py [--gpkg data/dbt/Meda/dbgt.gpkg] [--out report.json] [--outl 3] [--no-offset] [--accetta]
import os, sys, glob, json, time, sqlite3, argparse
import numpy as np, tifffile, shapely
from shapely import wkb
from shapely.geometry import Polygon, LineString
from shapely.ops import polygonize, unary_union
from pyproj import Transformer
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__))
_rd = os.path.join(HERE, '..', 'data')
DATA = os.environ.get('GTA_DATA', _rd if os.path.isdir(_rd) else r'C:/Users/theco/GitHub/GTA-Brianza/data')
LAT0, LON0 = 45.6575, 9.154
KX, KZ = 111320 * np.cos(np.radians(LAT0)), 110540.0
ZMIN = 200.0     # DBGT heights below 200 m are holes (0, -9999, the 109 m of the river bed)
OUTL = 3.0       # vertex farther than this from the local median of its piece: outlier (not on bridges)
RLOC = 20.0      # radius of the local median: the whole-piece median threw away good vertices of long ramps
KNN, RMAX = 5, 60.0  # ... or the 5 nearest within 60 m
RSUB = 3.0       # a discarded vertex borrows the Z of an EL_STR axis within this distance
RESCUE = 1.0     # an outlier this close to the LiDAR (offset removed) is kept: the neighbours were wrong, not it
OFF_BAND = 0.5   # offset: only axis points with |dz| below this

# name: (table, kind, {short attr: column})
LAYERS = {
    'EL_STR': ('EL_STR_EL_STR_TRA_SG', 'linea', {'sed': 'EL_STR_SED', 'liv': 'EL_STR_LIV', 'ty': 'EL_STR_TY'}),
    'GZ_STR': ('GZ_STR', 'punto', {}),
    'AC_VEI': ('AC_VEI_AC_VEI_SUP_SR', 'area', {'sed': 'AC_VEI_SED', 'liv': 'AC_VEI_LIV', 'zon': 'AC_VEI_ZON'}),
    'AC_PED': ('AC_PED_AC_PED_SUP_SR', 'area', {'sed': 'AC_PED_SED', 'liv': 'AC_PED_LIV', 'zon': 'AC_PED_ZON'}),
    'AC_CIC': ('AC_CIC_AC_CIC_SUP_SR', 'area', {'sed': 'AC_CIC_SED', 'liv': 'AC_CIC_LIV'}),
    'AR_STR': ('AR_STR_AR_STR_SUP_SR', 'area', {'sed': 'AR_STR_SED', 'liv': 'AR_STR_LIV'}),
    'EL_FER': ('EL_FER_EL_FER_TRA_SG', 'linea', {'sed': 'EL_FER_SED', 'liv': 'EL_FER_LIV'}),
    'SD_FER': ('SD_FER_SD_FER_SUP_SR', 'area', {'sed': 'SD_FER_SED', 'liv': 'SD_FER_LIV'}),
    'PONTE': ('PONTE_PONTE_SEDE', 'area', {}),
    'GALLER': ('GALLER', 'area', {'ty': 'GALLER_TY'}),
    'ALVEO': ('ALVEO_ALVEO_SUP', 'area', {}),
    'ALVEO_A': ('ALVEO_A_ALVEO_A_SU', 'area', {}),
    'ARGINE': ('ARGINE_ARGN_SUP', 'area', {}),
    'EL_IDR': ('EL_IDR_EL_IDR_TRA_SG', 'linea', {'liv': 'EL_IDR_LIV', 'ty': 'EL_IDR_TY'}),
}
DECK_LAYERS = ('PONTE', 'GALLER')  # never outlier-tested: their Z is meant to be off the ground
# per-vertex codes
SC_OK, SC_Z0, SC_NAN, SC_LOW, SC_OUT = 0, 1, 2, 3, 4           # 'scarto': why the raw Z was dropped
FT_NONE, FT_RAW, FT_AXIS, FT_SELF, FT_LIDAR = -1, 0, 1, 2, 3    # 'fonte': where the final Z comes from (SELF: along its own axis)
SC_NAMES = {SC_Z0: 'z0', SC_NAN: 'nan', SC_LOW: 'sotto200', SC_OUT: 'outlier'}


def to_game_lonlat(lon, lat): return (lon - LON0) * KX, -(lat - LAT0) * KZ
def game_to_lonlat(x, z): return LON0 + x / KX, LAT0 - z / KZ


# ---------- LiDAR 1 m: bilinear on the pixel centres, tiles loaded on demand ----------
class Lidar:
    def __init__(self, d=None):
        self.t = []
        for f in sorted(glob.glob(os.path.join(d or os.path.join(DATA, 'terreno', 'lidar'), '*.tif*'))):
            with tifffile.TiffFile(f) as tf:
                p = tf.pages[0]; tg = p.tags
                sx, sy = tg['ModelPixelScaleTag'].value[:2]; tp = tg['ModelTiepointTag'].value
                gk = tg['GeoKeyDirectoryTag'].value if 'GeoKeyDirectoryTag' in tg else ()
                gk = {gk[i]: gk[i + 3] for i in range(4, len(gk) - 3, 4)}
                cx, cy = tp[3] - tp[0] * sx, tp[4] + tp[1] * sy
                if gk.get(1025) != 2: cx, cy = cx + sx / 2, cy - sy / 2   # PixelIsArea: tie point at the corner; PixelIsPoint: at the centre
                nd = float(tg['GDALNoDataTag'].value) if 'GDALNoDataTag' in tg else None
                h, w = p.shape[:2]
            self.t.append(dict(f=f, cx=cx, cy=cy, sx=sx, sy=sy, w=w, h=h, nd=nd, a=None,
                               bb=(cx - sx / 2, cy - (h - 0.5) * sy, cx + (w - 0.5) * sx, cy + sy / 2)))

    def _arr(self, t):
        if t['a'] is None:
            a = tifffile.imread(t['f']).astype(np.float32)
            if t['nd'] is not None: a[a == t['nd']] = np.nan
            a[(a < -100) | (a > 5000)] = np.nan; t['a'] = a
        return t['a']

    def at(self, x, z):  # game metres -> m, NaN outside the LiDAR
        x, z = np.asarray(x, float), np.asarray(z, float); lon, lat = game_to_lonlat(x, z)
        out = np.full(x.shape, np.nan)
        for t in self.t:
            x0, y0, x1, y1 = t['bb']; sel = (lon >= x0) & (lon < x1) & (lat > y0) & (lat <= y1) & np.isnan(out)
            if not sel.any(): continue
            a = self._arr(t); c = (lon[sel] - t['cx']) / t['sx']; r = (t['cy'] - lat[sel]) / t['sy']
            c0 = np.clip(np.floor(c).astype(int), 0, t['w'] - 2); r0 = np.clip(np.floor(r).astype(int), 0, t['h'] - 2)
            fc, fr = np.clip(c - c0, 0, 1), np.clip(r - r0, 0, 1)
            vs = [a[r0, c0], a[r0, c0 + 1], a[r0 + 1, c0], a[r0 + 1, c0 + 1]]
            ws = [(1 - fc) * (1 - fr), fc * (1 - fr), (1 - fc) * fr, fc * fr]
            num = sum(np.where(np.isnan(v), 0, v * w_) for v, w_ in zip(vs, ws)); den = sum(np.where(np.isnan(v), 0, w_) for v, w_ in zip(vs, ws))
            out[sel] = np.where(den > 1e-6, num / np.maximum(den, 1e-6), np.nan)
        return out


# ---------- boundary of a comune (OSM relation), in game metres ----------
def confine_comune(nome, path=None):
    d = json.load(open(path or os.path.join(DATA, 'osm', 'confini_comuni.json'), encoding='utf-8'))
    for e in d['elements']:
        if e.get('tags', {}).get('name', '').lower() != nome.lower(): continue
        ls = []
        for m in e.get('members', []):
            g = m.get('geometry') or []
            if m.get('type') == 'way' and len(g) > 1:
                ls.append(LineString([to_game_lonlat(p['lon'], p['lat']) for p in g]))
        return unary_union(list(polygonize(unary_union(ls))))
    return None


# ---------- reading ----------
def _geom(b): f = b[3]; return wkb.loads(bytes(b[8 + [0, 32, 48, 48, 64][(f >> 1) & 7]:]))

def _read_layer(con, tr, table, kind, attrs):
    cols = ['OBJECTID', 'Shape'] + list(attrs.values())
    try: rows = con.execute('select %s from "%s"' % (', '.join(cols), table)).fetchall()
    except sqlite3.OperationalError: return None
    ids, at, off, rings, pts = [], {k: [] for k in attrs}, [0], [], []
    fc = dict(oggetti=0, oggetti_con_z=0, vertici=0, z0=0, sotto200=0)  # as in the file (closing vertices counted), for the census
    for row in rows:
        if row[1] is None: continue
        g = _geom(row[1]); zz = np.asarray(shapely.get_coordinates(g, include_z=True))[:, 2]
        fc['oggetti'] += 1; fc['oggetti_con_z'] += int((zz >= ZMIN).any()); fc['vertici'] += len(zz)
        fc['z0'] += int((zz == 0).sum()); fc['sotto200'] += int(((zz != 0) & (zz < ZMIN)).sum())
        for part in getattr(g, 'geoms', [g]):
            if kind == 'area':
                rs = [np.asarray(part.exterior.coords)] + [np.asarray(h.coords) for h in part.interiors]
                rs = [r[:-1] if len(r) > 1 and np.allclose(r[0, :2], r[-1, :2]) else r for r in rs]  # rings stored open
            else: rs = [np.asarray(part.coords)]
            rs = [r for r in rs if len(r)]
            if not rs: continue
            st, n = [], 0
            for r in rs:
                st.append(n); n += len(r)
                pts.append(r[:, :3] if r.shape[1] >= 3 else np.column_stack((r[:, :2], np.full(len(r), np.nan))))
            ids.append(row[0]); rings.append(st); off.append(off[-1] + n)
            for k, v in zip(attrs, row[2:]): at[k].append(v)
    P = np.vstack(pts) if pts else np.zeros((0, 3))
    lon, lat = tr.transform(P[:, 0], P[:, 1]) if len(P) else (np.zeros(0), np.zeros(0))
    gx, gz = to_game_lonlat(np.asarray(lon), np.asarray(lat))
    n = len(P)
    return dict(tipo=kind, tabella=table, file=fc, id=np.array(ids), attr={k: np.array(v, dtype=object) for k, v in at.items()},
                off=np.array(off), anelli=rings, xy=np.column_stack((gx, gz)), z0=P[:, 2].astype(float),
                z=np.full(n, np.nan), scarto=np.zeros(n, np.int8), fonte=np.full(n, FT_NONE, np.int8))


def pezzo_di(L):  # vertex -> piece index
    return np.repeat(np.arange(len(L['off']) - 1), np.diff(L['off']))


def is_deck(name, L):  # per piece: bridge or gallery cover (no outlier test)
    n = len(L['off']) - 1
    if name in DECK_LAYERS: return np.ones(n, bool)
    if 'sed' in L['attr']: return np.array([s not in ('01', None) for s in L['attr']['sed']], bool)
    return np.zeros(n, bool)


def poligono(L, i):  # shapely Polygon of area piece i, game metres
    a, b = L['off'][i], L['off'][i + 1]; st = L['anelli'][i] + [b - a]; xy = L['xy'][a:b]
    rs = [xy[st[k]:st[k + 1]] for k in range(len(st) - 1)]
    return Polygon(rs[0], [r for r in rs[1:] if len(r) >= 3])


# ---------- cleaning ----------
def _local_median(xy, z, r):  # neighbours: within r, or the KNN nearest within RMAX (sparse vertices along long straight edges)
    n = len(z)
    if n <= 400:
        d2 = ((xy[:, None, :] - xy[None, :, :]) ** 2).sum(-1); rk = np.argsort(np.argsort(d2, axis=1), axis=1)
        m = (d2 <= r * r) | ((rk < KNN) & (d2 <= RMAX * RMAX))
        zz = np.where(m, z[None, :], np.nan); return np.nanmedian(zz, axis=1), m.sum(1)
    tr = cKDTree(xy); nb = tr.query_ball_point(xy, r); dk, jk = tr.query(xy, KNN, distance_upper_bound=RMAX)
    nb = [np.union1d(a_, jk[i][np.isfinite(dk[i])]).astype(int) for i, a_ in enumerate(nb)]
    return np.array([np.median(z[i]) for i in nb]), np.array([len(i) for i in nb])


def _flag(name, L, outl):
    z0 = L['z0']; sc = L['scarto']
    sc[np.isnan(z0)] = SC_NAN; sc[(z0 == 0)] = SC_Z0; sc[(sc == SC_OK) & (z0 < ZMIN)] = SC_LOW
    deck = is_deck(name, L); L['nontest'] = 0
    for i in range(len(L['off']) - 1 if L['tipo'] != 'punto' else 0):
        a, b = L['off'][i], L['off'][i + 1]
        if deck[i]: continue
        ok = np.where(sc[a:b] == SC_OK)[0]
        if len(ok) < 3: L['nontest'] += len(ok); continue
        med, cnt = _local_median(L['xy'][a + ok], z0[a + ok], RLOC)
        bad = (np.abs(z0[a + ok] - med) > outl) & (cnt >= 3); L['nontest'] += int((cnt < 3).sum())
        sc[a + ok[bad]] = SC_OUT
    good = sc == SC_OK; L['z'][good] = z0[good]; L['fonte'][good] = FT_RAW


class Axes:  # clean EL_STR segments for the "nearest axis within 3 m" rule
    def __init__(self, L):
        A, B, za, zb, dk = [], [], [], [], []
        deck = is_deck('EL_STR', L)
        for i in range(len(L['off']) - 1):
            a, b = L['off'][i], L['off'][i + 1]; z = L['z'][a:b]; xy = L['xy'][a:b]
            ok = ~np.isnan(z[:-1]) & ~np.isnan(z[1:])
            A.append(xy[:-1][ok]); B.append(xy[1:][ok]); za.append(z[:-1][ok]); zb.append(z[1:][ok]); dk.append(np.full(ok.sum(), deck[i]))
        self.A, self.B = np.vstack(A), np.vstack(B); self.za, self.zb = np.concatenate(za), np.concatenate(zb); self.deck = np.concatenate(dk)
        self.half = np.hypot(*(self.B - self.A).T) / 2; self.tree = cKDTree((self.A + self.B) / 2); self.R = self.half.max() + RSUB

    def near(self, p, deck, zref=None, outl=OUTL):  # Z on the nearest compatible segment within RSUB, or None
        js = np.array(self.tree.query_ball_point(p, self.R), int)
        js = js[(self.deck[js] == deck)] if len(js) else js
        if not len(js): return None
        A, B = self.A[js], self.B[js]; d = B - A; l2 = np.maximum((d ** 2).sum(1), 1e-12)
        t = np.clip(((p - A) * d).sum(1) / l2, 0, 1); q = A + d * t[:, None]; dist = np.hypot(*(p - q).T)
        zq = self.za[js] + (self.zb[js] - self.za[js]) * t
        ok = dist <= RSUB
        if zref is not None: ok &= np.abs(zq - zref) < outl   # an axis at another level (underpass) is not ours
        if not ok.any(): return None
        k = np.argmin(np.where(ok, dist, np.inf)); return float(zq[k])


def _fill_from_axes(name, L, ax, outl):
    sc, z = L['scarto'], L['z']; deck = is_deck(name, L); n = 0
    for i in range(len(L['off']) - 1):
        a, b = L['off'][i], L['off'][i + 1]
        miss = np.where(np.isnan(z[a:b]))[0]
        if not len(miss): continue
        good = np.where(L['fonte'][a:b] == FT_RAW)[0]
        if name in ('EL_STR', 'EL_FER', 'EL_IDR') and len(good) >= 2:  # a line first takes the Z along itself, between good vertices
            xy = L['xy'][a:b]; s = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(xy, axis=0).T))))
            inner = miss[(miss > good[0]) & (miss < good[-1])]
            z[a + inner] = np.interp(s[inner], s[good], z[a + good]); L['fonte'][a + inner] = FT_SELF; miss = np.setdiff1d(miss, inner)
        if name not in ('EL_STR', 'GZ_STR', 'AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR', 'PONTE', 'GALLER'): continue  # rail and water: no road axis
        for k in miss:
            p = L['xy'][a + k]; zref = None
            if len(good):
                dd = np.hypot(*(L['xy'][a + good] - p).T); nb = good[dd <= RLOC]
                if len(nb): zref = float(np.median(z[a + nb]))
            zz = ax.near(p, bool(deck[i]), zref, outl)
            if zz is not None: z[a + k] = zz; L['fonte'][a + k] = FT_AXIS; n += 1
    return n


def _gz_outliers(L, ax, outl):  # junctions: compared with the axes that meet there (a point has no piece to take a median of)
    for k in np.where(L['scarto'] == SC_OK)[0]:
        zz = ax.near(L['xy'][k], False, None, outl)
        zd = ax.near(L['xy'][k], True, None, outl)
        cand = [v for v in (zz, zd) if v is not None]
        if cand and min(abs(L['z0'][k] - v) for v in cand) > outl:
            L['scarto'][k] = SC_OUT; L['z'][k] = np.nan; L['fonte'][k] = FT_NONE


def load_dbgt(path, lidar=None, confine=None, outl=OUTL, offset=True):
    """Layers of the DBGT at `path` with clean Z (game metres). With `lidar`, the comune offset is measured and removed and the vertices
    still without a Z take the LiDAR; without it they stay NaN. Returns {name: layer, '_info': {...}}"""
    t0 = time.time(); con = sqlite3.connect(path); tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
    D = {}
    for name, (table, kind, attrs) in LAYERS.items():
        L = _read_layer(con, tr, table, kind, attrs)
        if L is not None: D[name] = L
    con.close(); t1 = time.time()
    for name, L in D.items(): _flag(name, L, outl)
    info = dict(file=path, outl=outl, t_lettura=round(t1 - t0, 1))
    if lidar is not None:  # offset on the raw axes, then an "outlier" within RESCUE of the LiDAR is a real step of the ground: kept
        off = offset_comune(D, lidar, confine); info['offset'] = off
        for L in D.values():
            o = np.where(L['scarto'] == SC_OUT)[0]
            if not len(o): continue
            ok = np.abs(L['z0'][o] - off['valore'] - lidar.at(L['xy'][o, 0], L['xy'][o, 1])) < RESCUE; o = o[ok]
            L['scarto'][o] = SC_OK; L['z'][o] = L['z0'][o]; L['fonte'][o] = FT_RAW; L['salvati'] = int(len(o))
    ax = Axes(D['EL_STR'])
    _fill_from_axes('EL_STR', D['EL_STR'], ax, outl)   # the axis itself first, then the others borrow from it
    ax = Axes(D['EL_STR'])
    if 'GZ_STR' in D: _gz_outliers(D['GZ_STR'], ax, outl)
    for name, L in D.items():
        if name != 'EL_STR': _fill_from_axes(name, L, ax, outl)
    if lidar is not None:
        if offset:
            for L in D.values(): L['z'] = L['z'] - off['valore']   # NaN stays NaN
        info['offset_tolto'] = bool(offset)
        for name, L in D.items():
            miss = np.isnan(L['z'])
            if name in DECK_LAYERS: continue   # a deck never falls to the ground
            dk = is_deck(name, L)[pezzo_di(L)]; miss &= ~dk
            if miss.any():
                zl = lidar.at(L['xy'][miss, 0], L['xy'][miss, 1]); idx = np.where(miss)[0]; ok = ~np.isnan(zl)
                L['z'][idx[ok]] = zl[ok]; L['fonte'][idx[ok]] = FT_LIDAR
    info['t_pulizia'] = round(time.time() - t1, 1); D['_info'] = info
    return D


# ---------- offset DBGT - DTM, per comune ----------
def _pct(a):
    a = np.asarray(a, float)
    if not len(a): return dict(n=0)
    return dict(n=int(len(a)), p10=round(float(np.percentile(a, 10)), 3), p50=round(float(np.median(a)), 3), p90=round(float(np.percentile(a, 90)), 3))


def _axis_points(L, sel_piece, step=None):  # raw-Z vertices of the chosen axes (or resampled every `step` m between raw vertices)
    P, Z = [], []
    for i in np.where(sel_piece)[0]:
        a, b = L['off'][i], L['off'][i + 1]; ok = L['fonte'][a:b] == FT_RAW; xy, z = L['xy'][a:b], L['z'][a:b]
        if step is None: P.append(xy[ok]); Z.append(z[ok]); continue
        for j in range(b - a - 1):
            if not (ok[j] and ok[j + 1]): continue
            l = np.hypot(*(xy[j + 1] - xy[j])); t = (np.arange(0, l, step) + (l % step) / 2) / max(l, 1e-9) if l >= step else np.array([0.5])
            P.append(xy[j] + (xy[j + 1] - xy[j]) * t[:, None]); Z.append(z[j] + (z[j + 1] - z[j]) * t)
    return (np.vstack(P), np.concatenate(Z)) if P else (np.zeros((0, 2)), np.zeros(0))


def offset_comune(D, lidar, confine=None):
    """Median of (Z_DBGT - L) on the EL_STR axes with SED=01 and |dz| < OFF_BAND (spec 1.3), on raw vertices inside the comune.
    Also reports the same measure re-centred on its own median and on 2 m resampling, to see how much the band biases it."""
    L = D['EL_STR']; sel = np.array([s == '01' for s in L['attr']['sed']])
    res = {}
    for key, step in (('vertici', None), ('ogni_2m', 2.0)):
        P, Z = _axis_points(L, sel, step)
        if confine is not None and len(P): ins = shapely.contains_xy(confine, P[:, 0], P[:, 1]); P, Z = P[ins], Z[ins]
        dz = Z - lidar.at(P[:, 0], P[:, 1]); dz = dz[~np.isnan(dz)]
        band = dz[np.abs(dz) < OFF_BAND]; c = float(np.median(band)) if len(band) else 0.0
        for _ in range(20):  # band re-centred on its median until it stops moving
            bb = dz[np.abs(dz - c) < OFF_BAND]; c2 = float(np.median(bb)) if len(bb) else c
            if abs(c2 - c) < 1e-4: break
            c = c2
        res[key] = dict(tutti=_pct(dz), banda=_pct(band), banda_ricentrata=dict(_pct(dz[np.abs(dz - c) < OFF_BAND]), centro=round(c, 3)),
                        oltre_1_5m=int((np.abs(dz) > 1.5).sum()), oltre_3m=int((np.abs(dz) > 3).sum()))
    v = res['vertici']['banda']
    return dict(valore=round(v.get('p50', 0.0), 3), metodo='mediana di Z_DBGT - LiDAR, assi EL_STR SED=01, vertici con Z vera, |dz| < %.1f m' % OFF_BAND,
                dentro_confine=confine is not None, **res)


# ---------- C3: AC_PED - AC_VEI on the shared edge ----------
def _edge_pts(L, sel_piece, step=0.25):  # points every `step` m on the rings, Z interpolated between vertices with a real (raw) Z
    P, Z = [], []
    for i in np.where(sel_piece)[0]:
        a, b = L['off'][i], L['off'][i + 1]; st = L['anelli'][i] + [b - a]
        for k in range(len(st) - 1):
            xy = L['xy'][a + st[k]:a + st[k + 1]]; z = L['z'][a + st[k]:a + st[k + 1]]; ok = L['fonte'][a + st[k]:a + st[k + 1]] == FT_RAW
            n = len(xy)
            for j in range(n):
                j2 = (j + 1) % n
                if not (ok[j] and ok[j2]): continue
                l = np.hypot(*(xy[j2] - xy[j])); t = np.arange(0, 1, step / max(l, step))
                P.append(xy[j] + (xy[j2] - xy[j]) * t[:, None]); Z.append(z[j] + (z[j2] - z[j]) * t)
    return (np.vstack(P), np.concatenate(Z)) if P else (np.zeros((0, 2)), np.zeros(0))


def _verts(L, sel_piece):
    m = sel_piece[pezzo_di(L)] & (L['fonte'] == FT_RAW); return L['xy'][m], L['z'][m]


def kerb_step(D, tol=0.3, side_h=0.15):
    """Median of AC_PED - AC_VEI (both SED=01) where they touch: a vertex of one within `tol` of the other's edge. Decides whether the
    grid takes AC_PED minus SIDE_H (spec 1.3) or AC_PED as it is (median below 0.05 m: the kerb is not in the DBGT)."""
    V, Pd = D['AC_VEI'], D['AC_PED']
    sv = np.array([s == '01' for s in V['attr']['sed']]); sp = np.array([s == '01' for s in Pd['attr']['sed']])
    out = {}
    ev, zv = _edge_pts(V, sv); ep, zp = _edge_pts(Pd, sp); tv, tp = cKDTree(ev), cKDTree(ep)
    pv, pzv = _verts(Pd, sp); d1, j1 = tv.query(pv, distance_upper_bound=tol); m1 = np.isfinite(d1)
    a = pzv[m1] - zv[j1[m1]]                                   # pedestrian vertex - road edge
    vv, vzv = _verts(V, sv); d2, j2 = tp.query(vv, distance_upper_bound=tol); m2 = np.isfinite(d2)
    b = zp[j2[m2]] - vzv[m2]                                   # pedestrian edge - road vertex
    d3, j3 = cKDTree(vv).query(pv, distance_upper_bound=0.05); m3 = np.isfinite(d3)
    c = pzv[m3] - vzv[j3[m3]]                                  # shared vertices
    allv = np.concatenate((a, b)); allv = allv[np.abs(allv) < 2]  # beyond 2 m it is not a kerb (bridge ramps, underpasses)
    edges = [-2, -0.25, -0.1, -0.05, -0.01, 0.01, 0.05, 0.1, 0.13, 0.17, 0.25, 2]; hist = np.histogram(allv, edges)[0]
    med = float(np.median(allv)) if len(allv) else 0.0
    out = dict(tolleranza_m=tol, bordo_comune=dict(_pct(allv), frazione_sopra_5cm=round(float((allv > 0.05).mean()), 3) if len(allv) else None),
               vertici_ped_su_bordo_vei=_pct(a), vertici_vei_su_bordo_ped=_pct(b), vertici_coincidenti=_pct(c),
               istogramma=[dict(da=edges[k], a=edges[k + 1], n=int(hist[k])) for k in range(len(hist))],
               cordolo_nel_dbgt=bool(med >= 0.05), griglia_ped='AC_PED - SIDE_H (%.2f)' % side_h if med >= 0.05 else 'AC_PED senza togliere niente')
    return out


# ---------- C1 and the report ----------
def conta(name, L):
    sc, ft = L['scarto'], L['fonte']; pz = pezzo_di(L); npz = len(L['off']) - 1
    raw = ft == FT_RAW
    withz = np.bincount(pz[raw], minlength=npz) > 0 if npz else np.zeros(0, bool)
    allz = (np.bincount(pz[sc != SC_OK], minlength=npz) == 0) if npz else np.zeros(0, bool)
    r = dict(tabella=L['tabella'], nel_file=L['file'], pezzi=int(npz), pezzi_con_z=int(withz.sum()), pezzi_tutti_validi=int(allz.sum()), vertici=int(len(sc)))
    r.update({v: int((sc == k).sum()) for k, v in SC_NAMES.items()})
    r.update(scartati=int((sc != SC_OK).sum()), sostituiti_asse=int((ft == FT_AXIS).sum()), sostituiti_lungo_se_stesso=int((ft == FT_SELF).sum()),
             sostituiti_lidar=int((ft == FT_LIDAR).sum()), senza_quota=int((ft == FT_NONE).sum()), non_testati_outlier=int(L.get('nontest', 0)),
             outlier_salvati_dal_lidar=int(L.get('salvati', 0)))
    if npz and 'sed' in L['attr']:
        r['per_sede'] = {str(s): int((L['attr']['sed'] == s).sum()) for s in sorted(set(map(str, L['attr']['sed'])))}
    r['outlier'] += r['outlier_salvati_dal_lidar']  # flagged by the median test, salvati included
    bad = np.where((sc == SC_LOW) | (sc == SC_OUT))[0]
    if len(bad):
        r['quote_scartate'] = _pct(L['z0'][bad])
    return r


def main(argv=None):
    ap = argparse.ArgumentParser(description='DBGT: lettura, pulizia delle quote, offset sul LiDAR, controlli C1-C3')
    ap.add_argument('--gpkg', default=os.path.join(DATA, 'dbt', 'Meda', 'dbgt.gpkg'))
    ap.add_argument('--comune', default=None, help='nome del comune (di default la cartella del gpkg)')
    ap.add_argument('--lidar', default=os.path.join(DATA, 'terreno', 'lidar'))
    ap.add_argument('--out', default=os.path.normpath(os.path.join(HERE, '..', '..', 'motore_out', 'report_fase1.json')))
    ap.add_argument('--outl', type=float, default=OUTL)
    ap.add_argument('--no-offset', action='store_true')
    ap.add_argument('--accetta', action='store_true', help='non uscire con 2 se un controllo supera la soglia')
    a = ap.parse_args(argv)
    t0 = time.time(); nome = a.comune or os.path.basename(os.path.dirname(os.path.abspath(a.gpkg)))
    lid = Lidar(a.lidar); conf = confine_comune(nome)
    D = load_dbgt(a.gpkg, lid, conf, a.outl, not a.no_offset); info = D.pop('_info')
    t1 = time.time()
    C1 = {n: conta(n, L) for n, L in D.items()}
    off = info['offset']; p50 = off['vertici']['banda'].get('p50', 0.0)
    C2 = {nome: dict(off, soglia='|p50| < 0.3 m', ok=bool(abs(p50) < 0.3))}
    C3 = kerb_step(D)
    rep = dict(fase=1, comune=nome, file=a.gpkg, lidar_tessere=len(lid.t), confine_trovato=conf is not None,
               parametri=dict(zmin=ZMIN, outlier_m=a.outl, salvataggio_lidar_m=RESCUE, vicini=dict(raggio_m=RLOC, knn=KNN, knn_max_m=RMAX), raggio_mediana_m=RLOC, raggio_asse_m=RSUB, banda_offset_m=OFF_BAND, offset_tolto=not a.no_offset),
               C1=C1, C2=C2, C3=C3,
               tempi_s=dict(lettura=info['t_lettura'], pulizia_offset=info['t_pulizia'], controlli=round(time.time() - t1, 1), totale=round(time.time() - t0, 1)))
    os.makedirs(os.path.dirname(a.out), exist_ok=True)
    json.dump(rep, open(a.out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    # table
    print('%-8s %6s %6s %6s %8s %6s %6s %6s %6s %6s %7s %6s %6s' % ('strato', 'pezzi', 'conZ', 'tuttiZ', 'vertici', 'z0', 'nan', '<200', 'outl', 'salv', 'd.asse', 'lidar', 'senza'))
    for n, r in C1.items():
        print('%-8s %6d %6d %6d %8d %6d %6d %6d %6d %6d %7d %6d %6d' % (n, r['pezzi'], r['pezzi_con_z'], r['pezzi_tutti_validi'], r['vertici'], r['z0'], r['nan'],
              r['sotto200'], r['outlier'], r['outlier_salvati_dal_lidar'], r['sostituiti_asse'] + r['sostituiti_lungo_se_stesso'], r['sostituiti_lidar'], r['senza_quota']))
    v = off['vertici']
    print('C2 offset %s: %+.3f m (p10 %+.3f, p90 %+.3f, n %d); tutti p50 %+.3f; banda ricentrata %+.3f; ogni 2 m %+.3f -> %s' % (
        nome, off['valore'], v['banda'].get('p10', 0), v['banda'].get('p90', 0), v['banda']['n'], v['tutti'].get('p50', 0),
        v['banda_ricentrata']['centro'], off['ogni_2m']['banda'].get('p50', 0), 'ok' if C2[nome]['ok'] else 'FUORI SOGLIA'))
    b = C3['bordo_comune']
    print('C3 AC_PED - AC_VEI sul bordo: mediana %+.3f m (p10 %+.3f, p90 %+.3f, n %d) -> %s' % (b.get('p50', 0), b.get('p10', 0), b.get('p90', 0), b['n'], C3['griglia_ped']))
    print('rapporto:', a.out, '(%.0f s)' % (time.time() - t0))
    return 0 if (C2[nome]['ok'] or a.accetta) else 2


if __name__ == '__main__':
    sys.exit(main())
