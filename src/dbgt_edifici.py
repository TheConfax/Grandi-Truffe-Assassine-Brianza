# Il disegno dal DBGT, edifici (docs/motore.md 7). Inside a comune with a DBGT the buildings are the DBGT's:
#   - footprints and heights: every unit volume UN_VOL of the buildings EDIFC and of the minor buildings EDI_MIN is one building of the game,
#     with its own height UN_VOL_AV (several volumes for a building: the parts of different height). The volumes that stand on the ground
#     (UN_VOL_POR 01) go from the ground to the top; the ceilings of porticoes and passages and the overhangs (03, 04, 02) are raised, the
#     ring of their base is at the height of the ceiling (Specifiche di contenuto regionali, UN_VOL), and the game draws them from there up:
#     cars and people pass under them. Underground volumes (08) are not drawn. Heights in metres above sea level, the comune's offset
#     between the DBGT and the LiDAR (the base rings against the LiDAR on the ground volumes) taken away
#   - what a building is: OSM first (building, levels, roof shape, colours, name) from the OSM building that overlaps it most; where OSM
#     says nothing ("yes", or no building) the DBGT's use and type (EDIFC_USO, EDIFC_TY, EDI_MIN_TY)
#   - roofs from the LiDAR DSM (docs/motore.md 7, "Tetti dal DSM LiDAR"): DSM - wall top inside each volume, fitted with a flat roof, a
#     gable (ridge along one of the sides of the volume's minimum rectangle, slope and ridge offset fitted), a hip roof, a single slope. The
#     DSM (2008) is used only where it agrees with the DBGT (2015): the eaves of the fitted roof within 2 m of the top of the walls and the
#     structure over the whole footprint; otherwise the roof of today (OSM roof:shape, or the game's own rule) and the reason in the report
#   - OSM buildings with nothing of the DBGT within 3 m stay (more recent than the 2015 survey) and go in the report (osm_senza_dbgt), cut
#     off the carriageways AC_VEI; Overture's footprints only outside the DBGT; an OSM building just across the boundary that overlaps a
#     DBGT building is the same building and goes
#   - entrances: ACC_INT (Specifiche, "Accesso interno": the middle of the opening of the entrance of a building), tiles[t].ai
# Checks in the report (report_edifici.json beside brianza.json, summary in brianza.json report.edifici): buildings on a carriageway
# AC_VEI, DBGT and OSM buildings on top of each other, roofs from the DSM and why not.
# Used by build_data.py (a few lines call it, class Edifici). The roof fit runs in its own processes:
#   python src/dbgt_edifici.py --tetti in.pkl out.pkl      (called by Edifici.tetti)
import os, sys, math, time, sqlite3, json, pickle, subprocess, tempfile
from collections import Counter, defaultdict
import numpy as np, shapely
from shapely.geometry import Polygon, Point, LineString, GeometryCollection, box
import shapely.ops
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely import prepare
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq
from presto import in_parallelo   # (src/presto.py)

FREE_D = 3.0       # an OSM building with no DBGT building within this distance stays (docs/motore.md 7)
FAR_MIN, FAR_SH = 30.0, 0.25   # ... and one whose part farther than FREE_D from every DBGT building is this big (m2, share of it) is not the
                   # DBGT's: that part stays, cut off the DBGT buildings
EDGE_DUP = 0.3     # an OSM building outside the comune overlapping a DBGT building by this share of its area is the same building
MIN_VOL = 2.0      # volumes smaller than this (m2) are slivers
RAISED = 1.0       # a volume whose base stands this far over the ground is raised (portico, passage, overhang)
DSM_EAVE = 2.0     # the DSM roof is used when its eaves are within this of the top of the walls (UN_VOL_AV is the height to the eaves:
                   # on 258 gables of a sample the fitted eaves are 0.2 m below it in the median, the ridge 1.8 m above)
DSM_COVER = 0.7    # ... and the structure (over 1.5 m above the ground) covers this share of the footprint
DSM_TREES = 0.35   # more than this share of the DSM points far above the fitted roof: tree crowns over the roof
S_MIN, S_MAX = 0.12, 1.3   # slopes of a pitched roof (7 to 52 degrees)
OSM_SLOPE = 0.55   # a roof shape OSM gives without its height: about 29 degrees
ALA_MIN = 15.0     # the smallest wing of a volume cut into wings for its roof (m2)
RECT_FILL = 0.8    # the pitched roofs are fitted on the volume's minimum rectangle: only where the volume fills this much of it
RH_MAX = {1: 6.0, 2: 6.0, 3: 3.0}   # the highest ridge over the eaves (m): a steeper fit is the next, taller building seen by the DSM along a
                   # shared wall (a shed of 81 m2 came out with a single slope rising 17.9 m)
MIN_IN = 0.3       # a way inside the buildings for less than this (m) is left as it is
CLEAR_FOOT, CLEAR_CAR = 0.6, 1.0   # how far from the walls a way that ran inside a building moves (footways, the others)
PUSH_MAX = 2.5     # a stretch never deeper than this inside the walls moves out; a deeper one goes through the building and is cut
CU_MIN, CU_STD, CU_DROP = 4.0, 1.0, 2.5   # a dome or a spire from the DSM: this far over the highest wall, this round, this drop at its rim (m)
CU_TOWER = 80.0    # ... a spire stands on a volume this small (m2): a bell tower
TETTI_PROC = max(1, min(12, (os.cpu_count() or 4) - 2))

# what a building is when OSM does not say: DBGT use (EDIFC_USO, Specifiche p. 137) and type (EDIFC_TY p. 135, EDI_MIN_TY p. 151) as an OSM
# building value (the game's types in build_data.py BTYPE)
USO_BT = [('030301', 'school'), ('030302', 'university'), ('0303', 'school'), ('0301', 'hospital'), ('0201', 'civic'), ('02', 'public'), ('03', 'public'),
          ('05', 'church'), ('060301', 'train_station'), ('0603', 'train_station'), ('0602', 'yes'), ('06', 'public'), ('0704', 'supermarket'), ('0701', 'commercial'),
          ('07', 'commercial'), ('08', 'industrial'), ('09', 'warehouse'), ('10', 'public'), ('12', 'apartments'), ('01', 'yes'), ('95', 'yes')]
TY_BT = {'02': 'apartments', '05': 'terrace', '07': 'church', '08': 'industrial', '09': 'warehouse', '11': 'church', '19': 'public', '22': 'church'}  # values the game knows (build_data.py BTYPE)
MIN_BT = {'01': 'shed', '02': 'shed', '03': 'shed', '04': 'chapel', '07': 'garage', '09': 'service', '10': 'service', '12': 'service', '13': 'service',
          '14': 'industrial', '15': 'service', '16': 'service', '17': 'roof', '18': 'chapel', '20': 'shed'}
OSM_KEEP = ('building', 'building:levels', 'roof:shape', 'roof:colour', 'building:colour', 'name', 'amenity', 'man_made')


def _parts(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [p for q in getattr(g, 'geoms', []) for p in _parts(q)]


def bt_dbgt(kind, ty, usi):
    """The OSM building value for a DBGT building, from its type and uses"""
    if kind == 'M': return MIN_BT.get(ty, 'shed')
    if ty in TY_BT and not (ty == '08' and any(u.startswith('07') for u in usi)): return TY_BT[ty]
    for u in usi:
        for p, b in USO_BT:
            if u.startswith(p): return b
    return 'yes'


# ---------------------------------------------------------------- roofs: planes over the top of the walls
def piani_tetto(kind, poly, s, frame=None, o=0.0):
    """Planes [A, Bx, Bz] round the centre c (f = A + Bx (x - cx) + Bz (z - cz)); the roof is max(0, min_k f_k) over the top of the walls.
    kind 1 gable (ridge along the long side, or along `frame`'s u, offset o across), 2 hip, 3 single slope (frame = uphill direction)"""
    if frame is None: frame = rect_frame(poly)
    c, u, v, a, b = frame
    P = np.asarray(poly.exterior.coords)[:-1] - c; qu = P @ u; qv = P @ v
    if kind == 1:
        d = np.abs(qv - o).max(); rh = s * d
        return c, [[rh + s * o, -s * v[0], -s * v[1]], [rh - s * o, s * v[0], s * v[1]]], rh
    if kind == 2:
        a, b = np.abs(qu).max(), np.abs(qv).max(); rh = s * min(a, b)
        return c, [[s * a, -s * u[0], -s * u[1]], [s * a, s * u[0], s * u[1]], [s * b, -s * v[0], -s * v[1]], [s * b, s * v[0], s * v[1]]], rh
    if kind == 3:  # u uphill
        dmin = qu.min(); return c, [[-s * dmin, s * u[0], s * u[1]]], s * (qu.max() - dmin)
    return c, [], 0.0


def rect_frame(poly):
    """The minimum rotated rectangle: centre, long axis u, short axis v, half sizes"""
    rr = np.asarray(poly.minimum_rotated_rectangle.exterior.coords)[:4]
    e1, e2 = rr[1] - rr[0], rr[2] - rr[1]; L1, L2 = np.hypot(*e1), np.hypot(*e2)
    if L1 < 1e-6 or L2 < 1e-6: return rr.mean(0), np.array([1.0, 0.0]), np.array([0.0, 1.0]), 0.0, 0.0
    u, v = (e1 / L1, e2 / L2) if L1 >= L2 else (e2 / L2, e1 / L1)
    return rr.mean(0), u, v, max(L1, L2) / 2, min(L1, L2) / 2


def ali(poly, depth=0):
    """an L, a T, a U (a volume that fills less than RECT_FILL of its minimum rectangle, no holes) cut into wings that each fill their own
    rectangle: cuts along the volume's two axes through its vertices, the one that leaves the least empty rectangle; at most two rounds
    (four wings), each wing over ALA_MIN m2. [] when it does not come apart that way"""
    c, u, v, a, b = rect_frame(poly)
    def fill(q): r = q.minimum_rotated_rectangle; return q.area / max(1e-6, r.area)
    if fill(poly) >= RECT_FILL: return [poly]
    if depth >= 2: return []
    P = np.asarray(poly.exterior.coords)[:-1] - c; qs = (P @ u, P @ v); R = 4 * max(a, b) + 10
    best = None
    for ax, qq in ((0, qs[0]), (1, qs[1])):
        d = u if ax == 0 else v; o = v if ax == 0 else u
        for t in np.unique(np.round(qq, 2)):
            if t <= qq.min() + 1.0 or t >= qq.max() - 1.0: continue
            p0 = c + d * t - o * R; p1 = c + d * t + o * R
            try: ps = [q for q in _parts(shapely.ops.split(poly, LineString([p0, p1])))]
            except Exception: continue
            if len(ps) < 2 or min(q.area for q in ps) < ALA_MIN: continue
            empty = sum(q.minimum_rotated_rectangle.area - q.area for q in ps)
            if best is None or empty < best[0]: best = (empty, ps)
    if best is None: return []
    out = []
    for q in best[1]:
        sub = ali(q, depth + 1)
        if not sub: return []
        out += sub
    return out if len(out) <= 4 and all(fill(q) >= RECT_FILL and q.area >= ALA_MIN for q in out) else []


def _tls(A, h, it=3, cut=0.8):
    """least squares that drops the points far off (crowns, chimneys, the next building), a few rounds"""
    m = np.ones(len(h), bool); c = None
    for _ in range(it):
        c, *_ = np.linalg.lstsq(A[m], h[m], rcond=None); r = h - A @ c
        s = max(cut, 2.5 * np.sqrt(np.mean(r[m] ** 2)))
        m2 = np.abs(r) < s
        if m2.sum() < max(6, 0.5 * len(h)): break
        m = m2
    r = h - A @ c
    return c, float(np.sqrt(np.mean(r[m] ** 2))), float(m.mean()), float(np.mean(r > 2.0))


_DSM = None
def _dsm_init(d):
    global _DSM
    _DSM = dq.Lidar(d)


def fit_tetto(job):
    """job: (id, ring xy, has holes, top of the walls and base in m a.s.l.) -> (id, result dict)"""
    vid, ring, holes, top, zbase, church = job
    poly = Polygon(ring).buffer(0)
    if poly.is_empty or poly.geom_type != 'Polygon': return vid, dict(m='forma')
    inn = poly.buffer(-0.6)
    if inn.is_empty or inn.area < 6: return vid, dict(m='piccolo')
    x0, z0, x1, z1 = inn.bounds; gx, gz = np.meshgrid(np.arange(x0, x1, 1.0) + 0.5, np.arange(z0, z1, 1.0) + 0.5)
    X, Z = gx.ravel(), gz.ravel(); m = shapely.contains_xy(inn, X, Z)
    if m.sum() < 8: return vid, dict(m='piccolo')
    X, Z = X[m], Z[m]; h = _DSM.at(X, Z) - top
    ok = ~np.isnan(h); X, Z, h = X[ok], Z[ok], h[ok]
    if len(h) < 8: return vid, dict(m='senza_dsm')
    c, u, v, a, b = rect_frame(poly)
    qu = (X - c[0]) * u[0] + (Z - c[1]) * u[1]; qv = (X - c[0]) * v[0] + (Z - c[1]) * v[1]; one = np.ones_like(h)
    R = {'flat': _tls(one[:, None], h), 'plane': _tls(np.column_stack((one, qu, qv)), h)}
    best = None
    for ax, qa, half, fr in (('u', qv, b, (c, u, v, a, b)), ('v', qu, a, (c, v, u, b, a))):  # ridge along u: the distance across is |qv|
        for o in np.linspace(-0.25, 0.25, 6) * half:
            cc = _tls(np.column_stack((one, -np.abs(qa - o))), h)
            if best is None or cc[1] < best[0][1]: best = (cc, fr, o)
    R['gable'] = best[0]
    R['hip'] = _tls(np.column_stack((one, np.minimum(a - np.abs(qu), b - np.abs(qv)))), h)
    cover = float(np.mean(h + top - zbase > 1.5))  # the structure over the footprint (a building after 2008 is not in the DSM)
    r0 = R['flat'][1]
    cand = [('gable', R['gable']), ('hip', R['hip']), ('shed', R['plane'])]
    k, (co, rm, inl, hi) = 'flat', R['flat']
    fill = poly.area / max(1e-6, 4 * a * b)   # the share of its minimum rectangle the volume fills: the roof models are on that rectangle
    if r0 > 0.35 and (holes or fill < RECT_FILL): k = 'irregolare'   # an L, a T, a court: not one of our roofs (an L as a gable or a slope rose 6-10 m)
    elif r0 > 0.35:
        nm, (co2, rm2, inl2, hi2) = min(cand, key=lambda t: t[1][1])
        s = co2[1] if nm != 'shed' else float(np.hypot(co2[1], co2[2]))  # a gable or hip with the slopes the other way is a valley: not a roof of ours
        if rm2 < 0.7 * r0 and S_MIN < s < S_MAX: k, co, rm, inl, hi = nm, co2, rm2, inl2, hi2
        elif r0 > 0.8: k = 'complesso'
    # eaves of the fitted roof over the top of the walls
    if k == 'flat': eave = co[0]
    elif k == 'gable': eave = co[0] - co[1] * (best[1][4] + abs(best[2]))
    elif k == 'hip': eave = co[0]
    elif k == 'shed': eave = float(np.min(co[0] + co[1] * qu + co[2] * qv))
    else: eave = float(np.median(h))
    res = dict(k=k, eave=round(float(eave), 2), rms=round(rm, 2), alberi=round(hi, 2), n=int(len(h)), med=round(float(np.median(h)), 2), cover=round(cover, 2))
    if cover < DSM_COVER: res['m'] = 'non_copre'; return vid, res
    if abs(eave) > DSM_EAVE: res['m'] = 'basso' if eave < 0 else 'alto'; return vid, res
    if hi > DSM_TREES: res['m'] = 'chiome'; return vid, res
    if k in ('complesso', 'irregolare'): res['m'] = k; return vid, res
    if k == 'flat': res['rk'] = 4; return vid, res
    if k == 'gable':
        fr, o = best[1], best[2]; ctr, pl, rh = piani_tetto(1, poly, co[1], fr, o)
    elif k == 'hip': ctr, pl, rh = piani_tetto(2, poly, co[1])
    else:
        g = np.array([co[1], co[2]]); s = float(np.hypot(*g)); gw = (g[0] * u + g[1] * v) / s
        ctr, pl, rh = piani_tetto(3, poly, s, (c, gw, np.array([-gw[1], gw[0]]), a, b))
    kk = {'gable': 1, 'hip': 2, 'shed': 3}[k]
    if rh > RH_MAX[kk] * (2 if church else 1): res['m'] = 'troppo_ripido'; res['rh'] = round(float(rh), 2); return vid, res
    res.update(rk=kk, rc=[round(float(ctr[0]), 2), round(float(ctr[1]), 2)], rf=[round(float(x), 3) for p in pl for x in p], rh=round(float(rh), 2))
    return vid, res


def _tetti_main(inp, out, dsm_dir, nproc=TETTI_PROC):
    import multiprocessing as mp
    jobs = pickle.load(open(inp, 'rb'))
    # in order of place, so that each chunk reads few DSM tiles (in any order every process ended up holding all 54: out of memory)
    jobs.sort(key=lambda j: (int(j[1][:, 0].mean() // 250), int(j[1][:, 1].mean() // 250)))
    with mp.Pool(nproc, initializer=_dsm_init, initargs=(dsm_dir,)) as pool:
        res = dict(pool.imap_unordered(fit_tetto, jobs, chunksize=64))
    pickle.dump(res, open(out, 'wb'))


# ---------------------------------------------------------------- the class build_data.py uses
class Edifici:
    def __init__(self, fonti, log=print, to_game=None, base=0.0, lidar_dir=None, dsm_dir=None):
        """fonti: [(gpkg, confine del comune)] dei comuni con il DBGT; base: terrain.base of brianza.json (heights are written above it)"""
        t0 = time.time(); self.log = log; self.base = base
        DATA = dq.DATA
        self.lidar_dir = lidar_dir or os.path.join(DATA, 'terreno', 'lidar'); self.dsm_dir = dsm_dir or os.path.join(DATA, 'terreno', 'lidar_dsm')
        tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
        tg = to_game or dq.to_game_lonlat
        def xy(a): lon, lat = tr.transform(a[:, 0], a[:, 1]); x, z = tg(np.asarray(lon), np.asarray(lat)); return np.column_stack((x, z))
        def poly(g):
            out = []
            for p in _parts(g):
                ext = np.asarray(p.exterior.coords); ho = [np.asarray(h.coords) for h in p.interiors]
                q = Polygon(xy(ext), [xy(h) for h in ho if len(h) >= 4]).buffer(0)
                out += [(r, ext[:, 2] if ext.shape[1] > 2 else None) for r in _parts(q)]
            return out
        self.ed, self.vol, self.acc = [], [], []   # buildings, volumes, entrances
        self.carr, self.comuni = [], []
        self.rep = dict(comuni=[], censimento={})
        cens = Counter()
        for gpkg, conf in fonti:
            con = sqlite3.connect(gpkg); self.rep['comuni'].append(os.path.basename(os.path.dirname(gpkg))); self.comuni.append(conf)
            idx = {}
            def rows(sql):
                try: return con.execute(sql).fetchall()
                except sqlite3.OperationalError: return []
            uso = defaultdict(list)
            for cid, u in rows('select CLASSREF, EDIFC_USO from EDIFC_EDIFC_USO'): uso[cid].append(u or '')
            for kind, tab, cols in (('E', 'EDIFC', 'EDIFC_TY, EDIFC_STAT'), ('M', 'EDI_MIN', 'EDI_MIN_TY, EDI_MIN_ST')):
                for cid, ty, st in rows('select CLASSID, %s from %s' % (cols, tab)):
                    idx[cid] = len(self.ed); self.ed.append(dict(kind=kind, ty=ty or '', st=st or '', uso=uso.get(cid, []), vols=[], comune=len(self.comuni) - 1))
                    cens['%s_TY %s' % (tab, ty)] += 1
                for cid, b in rows('select CLASSREF, Shape from %s_CR_EDF_IS' % tab):
                    if b is not None and cid in idx: self.ed[idx[cid]]['is'] = unary_union([p for p, z in poly(dq._geom(b))])
            vrows = rows('select OBJECTID, Shape, UN_VOL_AV, CEDIUV, UN_VOL_POR, DATA_INI from UN_VOL') or [r + (None,) for r in rows('select OBJECTID, Shape, UN_VOL_AV, CEDIUV, UN_VOL_POR from UN_VOL')]
            for oid, b, av, ced, por, di in vrows:
                cens['UN_VOL_POR %s' % por] += 1
                if b is None or ced not in idx or not av or float(av) <= 0: cens['volumi senza edificio o altezza'] += 1; continue
                for p, zz in poly(dq._geom(b)):
                    if p.area < MIN_VOL: continue
                    zr = zz[(zz > 100) & np.isfinite(zz)] if zz is not None else np.zeros(0)
                    self.vol.append(dict(p=p, av=float(av), por=por or '01', ed=idx[ced], zmin=float(zr.min()) if len(zr) else None, oid=oid, gen=_gen(di, ced)))
                    self.ed[idx[ced]]['vols'].append(len(self.vol) - 1)
            for (b,) in rows('select Shape from ACC_INT'):
                if b is None: continue
                g = dq._geom(b); self.acc.append(tuple(xy(np.array([[g.x, g.y]]))[0]))
            for b, zon, sed in rows('select Shape, AC_VEI_ZON, AC_VEI_SED from AC_VEI_AC_VEI_SUP_SR'):
                if b is not None and zon != '0307' and sed in ('01', None): self.carr += [p for p, z in poly(dq._geom(b))]
            con.close()
        self.rep['censimento'] = dict(sorted(cens.items()))
        self.aggiornati()
        for e in self.ed:  # the footprint: the ground plan (IS), or the union of the volumes
            if 'is' not in e or e['is'].is_empty: e['is'] = unary_union([self.vol[i]['p'] for i in e['vols']]) if e['vols'] else GeometryCollection()
        self.carr_u = unary_union(self.carr) if self.carr else GeometryCollection(); prepare(self.carr_u)
        self.carr_t = STRtree(self.carr) if self.carr else None
        # heights: the base rings of the ground volumes against the LiDAR on the same ring give the comune's offset (DBGT - DTM)
        self.lid = dq.Lidar(self.lidar_dir)
        # the LiDAR on the base ring of every volume, in one call (point by point the same bilinear: one call per volume was 15 s)
        rings = [np.asarray(v['p'].exterior.coords) for v in self.vol]; ro = np.cumsum([0] + [len(r) for r in rings])
        rg = self.lid.at(np.concatenate([r[:, 0] for r in rings]), np.concatenate([r[:, 1] for r in rings])) if rings else np.zeros(0)
        dz = []
        for k, v in enumerate(self.vol):
            if v['por'] != '01' or v['zmin'] is None: continue
            g = rg[ro[k]:ro[k + 1]]
            if np.isfinite(g).sum() >= 3: v['gmed'] = float(np.nanmedian(g)); dz.append(v['zmin'] - v['gmed'])
        dz = np.asarray(dz); self.off = float(np.median(dz)) if len(dz) else 0.0
        self.rep['offset_dbgt_lidar'] = dict(valore=round(self.off, 3), p10=round(float(np.percentile(dz, 10)), 2) if len(dz) else None, p90=round(float(np.percentile(dz, 90)), 2) if len(dz) else None, n=int(len(dz)))
        for k, v in enumerate(self.vol):
            if v['zmin'] is None:  # no height on the ring: the LiDAR under it
                g = rg[ro[k]:ro[k + 1]]; v['zmin'] = float(np.nanmedian(g)) + self.off if np.isfinite(g).any() else None
            v['z0'] = None if v['zmin'] is None else v['zmin'] - self.off      # base, m a.s.l. on the LiDAR
            if v['z0'] is not None and v['por'] in ('02', '03', '04', '05', '06', '07', '09'):
                if 'gmed' not in v:
                    g = rg[ro[k]:ro[k + 1]]; v['gmed'] = float(np.nanmedian(g)) if np.isfinite(g).any() else v['z0']
                v['alto'] = v['z0'] - v['gmed'] > RAISED
        self.rep['edifici_dbgt'] = len(self.ed); self.rep['volumi'] = len(self.vol); self.rep['accessi'] = len(self.acc)
        log('dbgt edifici: edifici', len(self.ed), 'volumi', len(self.vol), 'accessi', len(self.acc), 'offset %+.2f m' % self.off, '%.0fs' % (time.time() - t0))

    def aggiornati(self):
        """The DBGT's later updates (UN_VOL DATA_INI 2019, or no DATA_INI and the date in the building's code, 20210831_...) add the new
        volumes of a building without retiring the ones of the 2015 survey: at Meda 14 volumes of 2015 lie under a newer volume of another
        building (the same house drawn twice, or a block redrawn in parts with their heights). The newer wins: an older volume covered by
        newer volumes of other buildings for more than half its area goes, one covered less is cut off them."""
        vs = self.vol
        if not vs: return
        t = STRtree([v['p'] for v in vs]); gone = cut = 0; touched = set()
        for i, v in enumerate(vs):
            nw = [vs[j]['p'] for j in t.query(v['p'], predicate='intersects') if vs[j]['ed'] != v['ed'] and vs[j]['gen'] > v['gen'] and vs[j]['por'] != '08']
            if not nw or v['por'] == '08': continue
            u = unary_union(nw); a = u.intersection(v['p']).area
            if a <= 1.0: continue
            if a > 0.5 * v['p'].area: v['via'] = True; gone += 1; touched.add(v['ed']); continue
            ps = _parts(v['p'].difference(u.buffer(0.05)))
            big = max(ps, key=lambda q: q.area) if ps else None
            if big is None or big.area < MIN_VOL: v['via'] = True; gone += 1
            else: v['p'] = big; cut += 1
            touched.add(v['ed'])
        # two ground volumes of the same building on top of each other (3 at Meda: a tower of 72 m2 drawn inside the 3206 m2 block round it,
        # x 1077 z 48): the lower one is cut off the higher, 5 cm round, so that their walls on a shared facade do not flicker
        same = 0
        for i, v in enumerate(vs):
            if v.get('via') or v['por'] != '01': continue
            top = (v['zmin'] or 0) + v['av']
            for j in t.query(v['p'], predicate='intersects'):
                w = vs[j]
                if j == i or w.get('via') or w['por'] != '01' or w['ed'] != v['ed']: continue
                wt = (w['zmin'] or 0) + w['av']
                if wt < top or (wt == top and j < i) or w['p'].intersection(v['p']).area <= 1.0: continue
                ps = _parts(v['p'].difference(w['p'].buffer(0.05)))
                big = max(ps, key=lambda q: q.area) if ps else None
                if big is None or big.area < MIN_VOL: v['via'] = True; gone += 1; break   # (the ground plan stays: the union is the same)
                v['p'] = big; same += 1
        # a volume inside another of the same building, in plan and in height, is the same space drawn twice with two materials (Carlo, 25/10, Piazza
        # Vittorio Veneto x 86 z -791: edificio 2562, a tower with a ground volume 50.0-62.3 m and a raised one 52.0-62.3 m on the same plan, 18 m2): what
        # is inside the other in height is cut off its plan (gone when nothing is left). A raised volume under a ceiling, a floor over a portico (they only
        # touch in height) and volumes that only partly share their height stay
        dentro = 0
        def _zz(v): return (v['zmin'], v['zmin'] + v['av']) if v['zmin'] is not None else None
        for i, v in enumerate(vs):
            if v.get('via') or v['por'] == '08' or _zz(v) is None: continue
            zv = _zz(v)
            for j in t.query(v['p'], predicate='intersects'):
                w = vs[j]
                if j == i or w.get('via') or w['por'] == '08' or w['ed'] != v['ed'] or _zz(w) is None: continue
                zw = _zz(w)
                if zv[0] < zw[0] - 0.3 or zv[1] > zw[1] + 0.3 or w['p'].intersection(v['p']).area <= 1.0: continue
                if v['por'] == '01' and w['por'] == '01': continue  # the ground pairs are the loop above's
                ev, ew = zv[1] - zv[0], zw[1] - zw[0]
                if not (ev < ew - 0.6 or (abs(ev - ew) <= 0.6 and ((v['por'] != '01' and w['por'] == '01') or (v['por'] == w['por'] and j < i)))): continue  # the smaller one yields
                ps = _parts(v['p'].difference(w['p'].buffer(0.05)))
                big = max(ps, key=lambda q: q.area) if ps else None
                if big is None or big.area < MIN_VOL: v['via'] = True; gone += 1; dentro += 1; touched.add(v['ed']); break
                v['p'] = big; dentro += 1; touched.add(v['ed'])
        if gone:
            keep = [k for k, v in enumerate(vs) if not v.get('via')]; ren = {k: n for n, k in enumerate(keep)}
            self.vol = [vs[k] for k in keep]
            for e in self.ed: e['vols'] = [ren[k] for k in e['vols'] if k in ren]
        for k in touched:  # its ground plan is the volumes that stay
            e = self.ed[k]; e['is'] = unary_union([self.vol[j]['p'] for j in e['vols']]) if e['vols'] else GeometryCollection()
        self.rep['aggiornamenti_dbgt'] = dict(volumi_superati=gone, volumi_tagliati=cut, volumi_dello_stesso_edificio_tagliati=same, volumi_dentro_un_altro_dello_stesso_edificio=dentro)
        self.log('dbgt edifici: volumi superati da un aggiornamento', gone, 'tagliati', cut)

    # ---------------------------------------------------------------- OSM against the DBGT
    def unisci(self, buildings, P):
        """buildings: the OSM and Overture buildings of build_data.py (records with 'p', 'k', 'tg'); P(outer, holes) -> polygon.
        Returns the new list of the buildings on the ground; the raised volumes are in self.alti"""
        t0 = time.time()
        # a DBGT building with only underground volumes (UN_VOL_POR 08: the garages under a garden or a yard) is not drawn and is not what
        # stands on top: an OSM building over it is something the DBGT does not have (verifica 24/10, x -558 z -587)
        # what the DBGT has of a building is its ground plan and all its volumes above ground: the raised ones too (the ceiling of a
        # portico, UN_VOL_POR 03, is outside the ground plan, and an OSM building drawn over the whole block came back as a solid box
        # filling the portico under the DBGT's raised volume: 8 at Meda, 1431 m2, verifica 2 del 24/10, x 188 z -519)
        geo = [unary_union([e['is']] + [self.vol[j]['p'] for j in e['vols'] if self.vol[j]['por'] != '08']) if any(self.vol[j]['por'] != '08' for j in e['vols']) else GeometryCollection() for e in self.ed]
        ok = [i for i, g in enumerate(geo) if not g.is_empty]
        dt = STRtree([geo[i] for i in ok]); confs = [c for c in self.comuni if c is not None]
        conf_u = unary_union(confs) if confs else GeometryCollection(); prepare(conf_u)
        best = {}   # DBGT building -> (overlap share, OSM tags)
        keep, kept_osm = [], []
        cnt = Counter(); dove = []
        for b in buildings:
            g = P(b['p'], b.get('k', []))
            if g is None: keep.append(b); continue
            near = [ok[j] for j in dt.query(g, predicate='dwithin', distance=FREE_D)]
            inside = conf_u.contains(g.centroid)
            if inside:
                if b.get('ml'): cnt['overture_tolti'] += 1; continue
                far = None
                if near:
                    # the DBGT has this building when (almost) all of it is within 3 m of DBGT buildings; a DBGT building at a corner of a
                    # big OSM one does not make it the DBGT's (the Flou block, the Auxologico, Elbo Controlli, the stadium's stands were lost)
                    nu = unary_union([geo[i] for i in near]); far = g.difference(nu.buffer(FREE_D))
                    if far.area < max(FAR_MIN, FAR_SH * g.area):
                        cnt['osm_sostituiti'] += 1
                        for i in near:
                            a = geo[i].intersection(g).area; sh = a / max(1e-6, min(g.area, geo[i].area))
                            if sh > 0.2 and sh > best.get(i, (0,))[0]: best[i] = (sh, b.get('tg') or {}, b)
                        continue
                    # its part off the DBGT buildings stays (newer than the survey, or something the DBGT does not have)
                    # (less the strips under 1.8 m wide along the DBGT walls: the same building drawn 1-2 m off by OSM, verifica 2 del 24/10, x 232 z -296)
                    rest = g.difference(nu.buffer(0.1)); rest = rest.buffer(-0.9, join_style='mitre').buffer(0.9, join_style='mitre').intersection(rest)
                    ps = [q for q in _parts(rest) if q.area >= 10]
                    if not ps: cnt['osm_sostituiti'] += 1; continue
                    cnt['osm_in_parte_senza_dbgt'] += 1
                    for k, q in enumerate(sorted(ps, key=lambda q: -q.area)):
                        bb = b if k == 0 else dict(b)
                        q = q.simplify(0.05); bb['p'] = list(q.exterior.coords)[:-1]; bb['k'] = [list(h.coords)[:-1] for h in q.interiors if len(h.coords) >= 4]
                        if not bb['k']: bb.pop('k')
                        bb['osm_solo'] = True; c = q.centroid
                        dove.append([round(c.x, 1), round(c.y, 1), round(q.area), (b.get('tg') or {}).get('building', 'yes'), 'parte'])
                        kept_osm.append((bb, q, False))
                    continue
                cnt['osm_senza_dbgt'] += 1; b['osm_solo'] = True
                c = g.centroid; dove.append([round(c.x, 1), round(c.y, 1), round(g.area), (b.get('tg') or {}).get('building', 'yes')])
                kept_osm.append((b, g, True)); continue
            dup = [i for i in near if geo[i].intersection(g).area > EDGE_DUP * g.area]
            if dup:
                cnt['doppi_al_confine'] += 1
                for i in dup:
                    sh = geo[i].intersection(g).area / max(1e-6, min(g.area, geo[i].area))
                    if sh > best.get(i, (0,))[0]: best[i] = (sh, b.get('tg') or {}, b)
                continue
            ov = [geo[i] for i in near if geo[i].intersection(g).area > 1.0]
            if ov:  # just across the boundary and on a DBGT building by a little: cut off it (the DBGT's shape wins where it has one)
                ps = _parts(g.difference(unary_union(ov).buffer(0.1))); big = max(ps, key=lambda q: q.area) if ps else None
                if big is None or big.area < 10: cnt['doppi_al_confine'] += 1; continue
                big = big.simplify(0.05); b['p'] = list(big.exterior.coords)[:-1]; b['k'] = [list(h.coords)[:-1] for h in big.interiors if len(h.coords) >= 4]
                if not b['k']: b.pop('k')
                cnt['tagliati_al_confine'] += 1
            keep.append(b)
        # the OSM buildings that stay are cut off the carriageways (the street always wins, as for OSM's own streets)
        ncut = ndrop = 0
        # (an OSM building the DBGT has nowhere stays whole: the DBGT is from 2015 and the road surface it draws there may be older than the building)
        for b, g, intero in kept_osm:
            if self.carr_t is not None and not intero:
                hit = [self.carr[j] for j in self.carr_t.query(g, predicate='intersects')]
                if hit:
                    cut = g.difference(unary_union(hit))
                    if g.area - cut.area > 0.5:
                        ps = _parts(cut); big = max(ps, key=lambda x: x.area) if ps else None
                        if big is None or big.area < 10: ndrop += 1; continue
                        big = big.simplify(0.05); b['p'] = list(big.exterior.coords)[:-1]; b['k'] = [list(h.coords)[:-1] for h in big.interiors]
                        if not b['k']: b.pop('k')
                        ncut += 1
            keep.append(b)
        cnt['osm_tagliati_sulle_carreggiate'] = ncut; cnt['osm_tolti_sulle_carreggiate'] = ndrop
        self.rep['osm'] = dict(cnt); self.rep['osm_senza_dbgt'] = dict(n=len(dove), m2=round(sum(o[2] for o in dove)), dove=dove[:400])
        # the DBGT buildings, volume by volume
        alti, terra = [], []
        ntipo, nvol, nstato = Counter(), Counter(), Counter()
        for i, e in enumerate(self.ed):
            sh, tg, ob = best.get(i, (0, {}, None))
            obt = tg.get('building')
            if obt in ('roof', 'carport') and e['kind'] == 'E': obt = None   # a roof on posts is a form: the DBGT's building (a volume on the ground) wins
            bt = obt if obt and obt not in ('yes',) else bt_dbgt(e['kind'], e['ty'], e['uso'])
            if tg.get('amenity') == 'place_of_worship' and e['is'].area > 120: bt = 'church'
            # the state in 2015 (EDIFC_STAT): a ruin stays a ruin (bare walls to its height, the roof only where the DSM sees one) unless OSM, newer, says what it is now
            # (anything but 'yes' or ruins); a building under construction then is finished by now when OSM maps it as a building, and
            # otherwise is drawn as surveyed, a bare shell with a flat roof
            stato = None
            if e['kind'] == 'E' and e['st'] == '02' and (obt in (None, 'yes', 'ruins') or tg.get('ruins') == 'yes'): stato = 2
            elif e['kind'] == 'E' and e['st'] == '01' and obt in (None, 'construction'): stato = 1
            if stato: nstato[stato] += 1; bt = 'yes' if stato == 2 else bt
            ntipo[bt] += 1
            for vi in e['vols']:
                v = self.vol[vi]
                if v['por'] == '08': nvol['sotterranei'] += 1; continue
                if v['z0'] is None: nvol['senza_quota'] += 1; continue
                p = v['p']; rec = dict(p=[tuple(c) for c in np.asarray(p.exterior.coords)[:-1]], h=round(v['av'], 1), bt=bt, ht=True, dbgt=True, e=i, vid=vi,
                                       lv=_num(tg.get('building:levels')), zt=round(v['z0'] + v['av'] - self.base, 2))
                ho = [list(map(tuple, np.asarray(h.coords)[:-1])) for h in p.interiors if len(h.coords) >= 4]
                if ho: rec['k'] = ho
                if tg.get('building:colour'): rec['wc'] = tg['building:colour'][:20]
                if tg.get('roof:colour'): rec['rcol'] = tg['roof:colour'][:20]
                if tg.get('roof:shape'): rec['rs'] = tg['roof:shape']
                if tg.get('man_made') == 'water_tower': rec['wt'] = True
                if stato: rec['st'] = stato
                if v.get('alto'): rec['zb'] = round(v['z0'] - self.base, 2); rec['zg'] = round(v['gmed'] - self.base, 2); alti.append(rec); nvol['alti_' + v['por']] += 1
                else: terra.append(rec); nvol['a_terra'] += 1
        self.alti = alti; self.terra = terra
        self.rep['volumi_disegnati'] = dict(nvol); self.rep['tipi'] = dict(ntipo.most_common())
        self.rep['attributi_da_osm'] = len(best)
        self.rep['stato_2015'] = dict(ruderi=nstato[2], in_costruzione_senza_osm=nstato[1], diruti=sum(1 for e in self.ed if e['kind'] == 'E' and e['st'] == '02'), in_costruzione=sum(1 for e in self.ed if e['kind'] == 'E' and e['st'] == '01'))
        self.log('dbgt edifici: OSM', dict(cnt), 'volumi', dict(nvol), 'con attributi OSM', len(best), '%.0fs' % (time.time() - t0))
        return keep + terra

    # ---------------------------------------------------------------- roofs
    def _dsm(self, jobs):
        """fit_tetto on the jobs in processes of their own: {id: result}"""
        if not jobs or not os.path.isdir(self.dsm_dir): return {}
        d = tempfile.mkdtemp(prefix='tetti_'); fi, fo = os.path.join(d, 'in.pkl'), os.path.join(d, 'out.pkl')
        pickle.dump(jobs, open(fi, 'wb'))
        for npr in sorted({TETTI_PROC, min(TETTI_PROC, 4), 1}, reverse=True):  # fewer processes when memory is short, never no roofs in silence
            rc = subprocess.call([sys.executable, os.path.abspath(__file__), '--tetti', fi, fo, self.dsm_dir, str(npr)])
            if rc == 0 and os.path.exists(fo): return pickle.load(open(fo, 'rb'))
            self.log('dbgt edifici: tetti dal DSM non riusciti con', npr, 'processi, codice', rc)
        raise RuntimeError('dbgt edifici: tetti dal DSM non riusciti')

    def cupole(self, recs):
        """domes and spires from the DSM: a church whose DSM rises a peak at least CU_MIN m over its highest wall, round (the DSM in each ring
        round the peak within CU_STD m) and standing clear of the roof round it (a drop of CU_DROP m at its rim). The dome is drawn as the
        DSM's own profile turned round the peak (median height ring by ring, every 0.5 m), down to the top of the walls of the volume it
        stands on (the drum). Santa Maria Nascente: 43.1 m over the ground, rim at 11 m, on a crossing the DBGT gives 11.2 m (verifica 24/10:
        a grey box round a hole). The record of that volume gets cu = {c: centre, r: radii, y: heights above terrain.base}"""
        if not os.path.isdir(self.dsm_dir): return 0
        dsm = dq.Lidar(self.dsm_dir); n = 0; byb = defaultdict(list)
        for k, r in enumerate(recs):
            if r['bt'] in ('church', 'cathedral', 'chapel') and not r.get('st'): byb[r['e']].append(k)
        for e, ks in byb.items():
            polys = [Polygon(recs[k]['p'], recs[k].get('k') or []).buffer(0) for k in ks]
            U = unary_union(polys); Ub = U.buffer(3.0); x0, z0, x1, z1 = Ub.bounds   # 3 m round it: a tower alone shows its rim against the ground
            gx, gz = np.meshgrid(np.arange(x0, x1, 0.5) + 0.25, np.arange(z0, z1, 0.5) + 0.25)
            m = shapely.contains_xy(Ub, gx.ravel(), gz.ravel()); X, Z = gx.ravel()[m], gz.ravel()[m]
            if len(X) < 10: continue
            Y = dsm.at(X, Z) - self.base; ok = np.isfinite(Y); X, Z, Y = X[ok], Z[ok], Y[ok]
            inU = shapely.contains_xy(U, X, Z)
            if inU.sum() < 4: continue
            tops = [recs[k]['zt'] for k in ks]; tmax = max(tops)
            pk = float(Y[inU].max())
            if pk - tmax < CU_MIN: continue
            sel = inU & (Y > pk - 1.0); cx, cz = float(X[sel].mean()), float(Z[sel].mean()); d = np.hypot(X - cx, Z - cz)
            prof = []
            for i in range(40):
                s_ = (d >= i * 0.5) & (d < i * 0.5 + 0.5)
                if s_.sum() < 2: prof.append(None); continue
                prof.append((i * 0.5 + 0.25, float(np.median(Y[s_])), float(np.std(Y[s_]))))
            rim = None
            for i in range(1, len(prof) - 3):
                if prof[i] is None: break
                if prof[i][2] > CU_STD: break
                nxt = [q for q in prof[i + 1:i + 4] if q is not None]
                if nxt and prof[i][1] - min(q[1] for q in nxt) >= CU_DROP: rim = i; break
            ins = [k for k, p in zip(ks, polys) if p.contains(Point(cx, cz))]
            if not ins: continue
            k = ins[0]; base = recs[k]['zt']; pv = polys[ks.index(k)]
            if rim is not None and prof[rim][0] >= 1.0:   # a dome standing clear of the roof round it
                R = [q for q in prof[:rim + 1] if q is not None]
            elif pv.area <= CU_TOWER:   # a spire on a tower: its profile down to the top of the tower's walls, within the tower
                rin = pv.exterior.distance(Point(cx, cz))
                R = []
                for q in prof:
                    if q is None: continue
                    if q[0] > rin or q[1] < base + 0.3: break
                    R.append(q)
                if len(R) < 2: continue
            else: continue
            rr = [0.0] + [q[0] for q in R]; yy = [pk] + [q[1] for q in R]
            for i in range(1, len(yy)): yy[i] = min(yy[i], yy[i - 1])   # never rising outwards
            if yy[-1] - base < 0.3: continue
            recs[k]['cu'] = dict(c=[round(cx, 2), round(cz, 2)], r=[round(v, 2) for v in rr] + [round(rr[-1], 2)], y=[round(v, 2) for v in yy] + [round(base, 2)])
            n += 1; self.log('dbgt edifici: cupola o guglia a x %.0f z %.0f, %.1f m sopra il muro piu alto, raggio %.1f m' % (cx, cz, pk - tmax, rr[-1]))
        return n

    def tetti(self):
        """the roof of every DBGT volume from the DSM (in its own processes), or from OSM roof:shape; the reasons in the report.
        A volume shaped like an L, a T or a U is cut into its wings (ali), each with its roof from the DSM: the wings are drawn as volumes of
        their own (same building, same height). Returns the new ground pieces (the raised ones go in self.alti)"""
        t0 = time.time()
        recs = self.terra + self.alti
        job = lambda k, r, ring: (k, np.asarray(ring), bool(r.get('k')), r['zt'] + self.base, r['zt'] + self.base - r['h'], r['bt'] in ('church', 'cathedral', 'chapel'))
        res = self._dsm([job(k, r, r['p']) for k, r in enumerate(recs) if r['bt'] not in ('roof',) and r.get('st') != 1])
        # the wings of the irregular volumes, in a second round
        wings, wj = {}, []
        def ali_di(k):  # the wings of volume k (None when it is not irregular): on all the cores (src/presto.py), used in order below
            r = recs[k]; f = res.get(k)
            if not f or f.get('m') != 'irregolare' or r.get('k') or r.get('st'): return None
            p = Polygon(r['p']).buffer(0)
            return ali(p) if p.geom_type == 'Polygon' else None
        for k, ps in enumerate(in_parallelo(ali_di, range(len(recs)))):
            if ps is None or len(ps) < 2: continue
            r = recs[k]
            wings[k] = ps
            for n, q in enumerate(ps): wj.append(job((k, n), r, np.asarray(q.exterior.coords)[:-1]))
        wres = self._dsm(wj)
        new_t, new_a, nw = [], [], Counter()
        for k, ps in wings.items():
            rr = [wres.get((k, n)) or {} for n in range(len(ps))]
            if not any(x.get('rk') in (1, 2, 3) for x in rr): nw['ali_senza_falde'] += 1; continue   # flat all over: the volume stays whole
            r = recs[k]; nw['volumi_in_ali'] += 1; nw['ali'] += len(ps)
            for n, (q, x) in enumerate(zip(ps, rr)):
                rec = r if n == 0 else dict(r)
                rec['p'] = [tuple(c) for c in np.asarray(q.exterior.coords)[:-1]]; rec.pop('k', None); rec['ala'] = True
                for kk in ('rk', 'rf', 'rc'): rec.pop(kk, None)
                if x.get('rk'):
                    rec['rk'] = x['rk']
                    if x['rk'] != 4: rec['rf'] = x['rf']; rec['rc'] = x['rc']
                else: rec['rk'] = 4; nw['ali_piane_senza_dsm'] += 1   # a wing the DSM does not fit: flat, as the whole volume was
                nw[{1: 'ala_a_falde', 2: 'ala_a_padiglione', 3: 'ala_a_una_falda', 4: 'ala_piana'}[rec['rk']]] += 1
                if n: (new_a if 'zb' in r else new_t).append(rec)
            res[k] = dict(rk=-1)
        self.terra += new_t; self.alti += new_a
        cnt, mot = Counter(), Counter(); rhs = []
        for k, r in enumerate(recs):
            f = res.get(k)
            if r.get('st') == 1: r['rk'] = 4; cnt['in_costruzione_piano'] += 1; continue   # a shell under construction: a flat roof
            if r.get('st') == 2:   # a ruin keeps the roof the DSM (2008) sees over it (st 3), otherwise it has none
                if f and f.get('rk'):
                    r['st'] = 3; r['rk'] = f['rk']
                    if f['rk'] != 4: r['rf'] = f['rf']; r['rc'] = f['rc']
                    cnt['rudere_con_tetto_dal_dsm'] += 1
                else: cnt['rudere_senza_tetto'] += 1
                continue
            if f and f.get('rk') == -1: cnt['in_ali'] += 1; continue
            if f and f.get('rk'):
                r['rk'] = f['rk']
                if f['rk'] != 4: r['rf'] = f['rf']; r['rc'] = f['rc']; rhs.append(f['rh'])
                cnt[{1: 'a_falde', 2: 'a_padiglione', 3: 'a_una_falda', 4: 'piano'}[f['rk']]] += 1
                continue
            m = (f or {}).get('m', 'senza_dsm'); mot[m] += 1
            # not from the DSM: OSM's roof shape where it gives one, otherwise the game's rule (r['rk'] absent)
            rs = r.get('rs')
            if rs in ('gabled', 'hipped', 'pyramidal', 'skillion', 'flat'):
                p = Polygon(r['p']).buffer(0)
                if p.geom_type == 'Polygon' and not r.get('k'):
                    if rs == 'flat': r['rk'] = 4
                    else:
                        kk = {'gabled': 1, 'hipped': 2, 'pyramidal': 2, 'skillion': 3}[rs]
                        c, pl, rh = piani_tetto(kk, p, OSM_SLOPE)
                        r['rk'] = kk; r['rf'] = [round(float(x), 3) for q in pl for x in q]; r['rc'] = [round(float(c[0]), 2), round(float(c[1]), 2)]
                    cnt['da_osm_roof_shape'] += 1
        cnt['cupole_e_guglie_dal_dsm'] = self.cupole(self.terra + self.alti)
        self.rep['tetti'] = dict(dal_dsm=dict(cnt), non_dal_dsm=dict(mot), ali=dict(nw), colmo_sulla_gronda=dict(p50=round(float(np.median(rhs)), 2), p90=round(float(np.percentile(rhs, 90)), 2), max=round(float(max(rhs)), 2)) if rhs else None)
        self.log('dbgt edifici: tetti dal DSM', dict(cnt), 'no', dict(mot), 'ali', dict(nw), '%.0fs' % (time.time() - t0))
        return new_t

    # ---------------------------------------------------------------- the OSM ways against the DBGT buildings
    def vie(self, raw_roads, nodes, buildings=None, P=None):
        """The OSM ways no DBGT axis took (footways, service roads, the streets OSM draws over a yard) were drawn against the OSM buildings,
        and the OSM buildings were cut on them. The DBGT buildings are not cut (their shape wins), so a way that runs inside one moves out:
        verifica 24/10, 26 ways inside a DBGT volume for more than 1 m (266 m), most of them footways and service roads 1 m inside a facade
        (x 249 z -589 for 32 m), and the AI pedestrians walked through the walls. A stretch inside a building (ground volumes, and the OSM
        buildings kept inside the comune) that is never deeper than PUSH_MAX moves out to `clear` m from the walls (its nodes and new ones in
        between); one that goes deeper, or that cannot get out without crossing the building, is cut away: the DBGT has no passage there (a
        passage under a building is a raised volume, UN_VOL_POR 04, and is not an obstacle here). Tunnels and bridges stay. In place, before
        build_data.py draws the ways; the moves and cuts in the report (vie_negli_edifici)"""
        t0 = time.time()
        obs = [g for g in (Polygon(r['p'], r.get('k') or []).buffer(0) for r in getattr(self, 'terra', [])) if not g.is_empty]
        if buildings is not None and P is not None:   # the OSM buildings kept inside the comune as they are now (cut on the streets, not the roofs on posts)
            obs += [g for g in (P(b['p'], b.get('k', [])) for b in buildings if b.get('osm_solo') and b.get('t') != 9 and b.get('bt') not in ('roof', 'carport')) if g is not None and not g.is_empty]
        if not obs: return
        T = STRtree(obs); cnt = [0]; rep = dict(spostate=[], tagliate=[])
        def new_id(): cnt[0] += 1; return 'edv%d' % cnt[0]
        def inside_len(xy, U): return LineString(xy).intersection(U).length if len(xy) >= 2 else 0.0
        nmove = ncut = 0
        for pas in range(2):   # a node moved for one way may bring the next way into a wall: a second round
            for wi in range(len(raw_roads)):
                r = raw_roads[wi]
                if r.get('tunnel') or r.get('bridge') or len(r['refs']) < 2: continue
                xy = np.array([nodes[n_] for n_ in r['refs']], float)
                line = LineString(xy)
                if line.length < 0.5: continue
                cand = [obs[j] for j in T.query(line, predicate='dwithin', distance=2.5)]
                if not cand: continue
                U = unary_union(cand)
                if line.intersection(U).length < MIN_IN: continue
                clear = CLEAR_FOOT if r['c'] >= 6 else CLEAR_CAR
                Uc = U.buffer(clear, quad_segs=3); B = Uc.boundary
                # samples every 0.5 m, the nodes among them
                S, owner = [], []   # point, node index (or -1)
                for i in range(len(xy) - 1):
                    a, b = xy[i], xy[i + 1]; L = float(np.hypot(*(b - a))); n = max(1, int(math.ceil(L / 0.5)))
                    for k in range(n): S.append(a + (b - a) * k / n); owner.append(i if k == 0 else -1)
                S.append(xy[-1]); owner.append(len(xy) - 1); S = np.array(S)
                ins = shapely.contains_xy(Uc, S[:, 0], S[:, 1])
                if not ins.any(): continue
                runs = []; k = 0
                while k < len(S):
                    if not ins[k]: k += 1; continue
                    j = k
                    while j + 1 < len(S) and ins[j + 1]: j += 1
                    runs.append((k, j)); k = j + 1
                newpts = {}; drop = []   # sample -> new position; runs cut away
                for k0, k1 in runs:
                    seg = S[k0:k1 + 1]
                    if inside_len(np.vstack([S[max(k0 - 1, 0)], seg, S[min(k1 + 1, len(S) - 1)]]), U) < 0.05 and len(seg) < 4: continue   # only the clearance, not the wall
                    dep = np.array([B.distance(Point(p)) for p in seg])
                    if dep.max() <= clear + PUSH_MAX:
                        q = [shapely.ops.nearest_points(B, Point(p))[0] for p in seg]; q = np.array([[g.x, g.y] for g in q])
                        test = np.vstack(([S[k0 - 1]] if k0 > 0 else []) + [q] + ([S[k1 + 1]] if k1 + 1 < len(S) else []))
                        if inside_len(test, U) < 0.2:
                            for k, p in zip(range(k0, k1 + 1), q): newpts[k] = p
                            continue
                    drop.append((k0, k1))
                if not newpts and not drop: continue
                # the new polyline: the nodes that stay, moved nodes, new nodes where a stretch moved (simplified)
                pieces, cur, run_pts = [], [], []
                def flush_run():
                    if not run_pts: return
                    P_ = np.array([p for p, nd in run_pts]); keep = set()
                    if len(P_) > 2:
                        sl = LineString(P_).simplify(0.15)
                        sc = np.asarray(sl.coords)
                        for c in sc[1:-1]: keep.add(int(np.argmin(np.hypot(*(P_ - c).T))))
                    for idx, (p, nd) in enumerate(run_pts):
                        if nd is not None:
                            nodes[nd] = (float(p[0]), float(p[1]))
                            cur.append(nd)
                        elif idx in keep or idx in (0, len(run_pts) - 1):
                            nid = new_id(); nodes[nid] = (float(p[0]), float(p[1])); cur.append(nid)
                    run_pts.clear()
                dropped = np.zeros(len(S), bool)
                for k0, k1 in drop: dropped[k0:k1 + 1] = True
                for k in range(len(S)):
                    nd = r['refs'][owner[k]] if owner[k] >= 0 else None
                    if dropped[k]:
                        flush_run()
                        if len(cur) >= 2: pieces.append(cur)
                        cur = []; continue
                    if cur == [] and k > 0 and dropped[k - 1] and nd is None:   # the way starts again at the wall
                        nid = new_id(); nodes[nid] = (float(S[k][0]), float(S[k][1])); cur.append(nid); continue
                    if k in newpts: run_pts.append((newpts[k], nd)); continue
                    flush_run()
                    if nd is not None: cur.append(nd)
                    elif k + 1 < len(S) and dropped[k + 1]:   # the way stops at the wall
                        nid = new_id(); nodes[nid] = (float(S[k][0]), float(S[k][1])); cur.append(nid)
                flush_run()
                if len(cur) >= 2: pieces.append(cur)
                pieces = [[n_ for i_, n_ in enumerate(p) if i_ == 0 or n_ != p[i_ - 1]] for p in pieces]
                pieces = [p for p in pieces if len(p) >= 2 and LineString([nodes[n_] for n_ in p]).length >= 2.0]
                m = xy[len(xy) // 2]; nm = r.get('n', -1)
                lin = round(line.intersection(U).length, 1)
                if drop:
                    ncut += 1; rep['tagliate'].append([round(float(m[0]), 1), round(float(m[1]), 1), r['c'], lin, sum(int(k1 - k0 + 1) for k0, k1 in drop) // 2, nm])
                if newpts: nmove += 1; rep['spostate'].append([round(float(m[0]), 1), round(float(m[1]), 1), r['c'], lin, round(float(max(np.hypot(*(newpts[k] - S[k])) for k in newpts)), 2), nm])
                if not pieces: r['refs'] = r['refs'][:1] * 2; r['vuota'] = True; continue
                r['refs'] = pieces[0]
                for p in pieces[1:]: r.setdefault('parte', wi); raw_roads.append(dict(r, refs=p))
        n_empty = sum(1 for r in raw_roads if r.get('vuota'))
        raw_roads[:] = [r for r in raw_roads if not r.get('vuota')]
        self.rep['vie_negli_edifici'] = dict(spostate=nmove, tagliate=ncut, tolte=n_empty, dove_spostate=rep['spostate'][:80], dove_tagliate=rep['tagliate'][:80])
        self.log('dbgt edifici: vie OSM negli edifici, spostate', nmove, 'tagliate', ncut, 'tolte', n_empty, '%.0fs' % (time.time() - t0))

    # ---------------------------------------------------------------- checks
    def controlli(self, buildings, P):
        """buildings on a carriageway, DBGT and OSM buildings on top of each other (after the build has done with them)"""
        on, dup, dd, d2 = [], 0, [], []
        # every building that is not the DBGT's near a comune (OSM kept inside, OSM and Overture just across the boundary)
        near_c = unary_union([c for c in self.comuni if c is not None]).buffer(60) if self.comuni else GeometryCollection(); prepare(near_c)
        osm = [(b, P(b['p'], b.get('k', []))) for b in buildings if not b.get('dbgt')]
        osm = [(b, g) for b, g in osm if g is not None and near_c.intersects(g)]
        ot = STRtree([g for b, g in osm]) if osm else None
        # the DBGT volumes: on the ground, and the raised ones (only for the doubles: a portico's ceiling over a carriageway is right)
        dg = [(b, P(b['p'], b.get('k', []))) for b in buildings if b.get('dbgt')] + [(b, P(b['p'], b.get('k', []))) for b in getattr(self, 'alti', [])]
        dg = [(b, g) for b, g in dg if g is not None]
        dt = STRtree([g for b, g in dg]) if dg else None
        for k, (b, g) in enumerate(dg + [(b, g) for b, g in osm if b.get('osm_solo')]):
            if self.carr_t is not None and 'zb' not in b:
                a = sum(self.carr[j].intersection(g).area for j in self.carr_t.query(g, predicate='intersects'))
                if a > 1.0: c = g.centroid; on.append([round(c.x, 1), round(c.y, 1), round(a, 1), 'dbgt' if b.get('dbgt') else 'osm'])
            if not b.get('dbgt'): continue
            if ot is not None:
                for j in ot.query(g, predicate='intersects'):
                    a = osm[j][1].intersection(g).area
                    if a > 1.0: dup += 1; c = g.centroid; dd.append([round(c.x, 1), round(c.y, 1), round(a, 1)])
            for j in dt.query(g, predicate='intersects'):  # volumes of two DBGT buildings on top of each other
                if j <= k or dg[j][0].get('e') == b.get('e'): continue
                a = dg[j][1].intersection(g).area
                if a > 1.0: c = g.centroid; d2.append([round(c.x, 1), round(c.y, 1), round(a, 1)])
        # volumes of the SAME building that share plan (> 1 m2) and height (> 0.5 m): the same space drawn twice (check of 28/10, Piazza Vittorio Veneto)
        ds = []
        for k, (b, g) in enumerate(dg):
            if 'zt' not in b or not b.get('dbgt'): continue
            z0, z1 = b.get('zb', b['zt'] - b['h']), b['zt']
            for j in dt.query(g, predicate='intersects'):
                if j <= k or dg[j][0].get('e') != b.get('e') or 'zt' not in dg[j][0]: continue
                w = dg[j][0]; a = dg[j][1].intersection(g).area
                if a > 1.0 and min(z1, w['zt']) - max(z0, w.get('zb', w['zt'] - w['h'])) > 0.5: c = g.centroid; ds.append([round(c.x, 1), round(c.y, 1), round(a, 1), b.get('e')])
        self.rep['volumi_sovrapposti_stesso_edificio'] = dict(n=len(ds), dove=ds[:50])
        self.log('dbgt edifici: volumi dello stesso edificio sovrapposti in pianta e in altezza', len(ds), ds[:5])
        self.rep['su_carreggiata'] = dict(n=len(on), m2=round(sum(o[2] for o in on), 1), dove=sorted(on, key=lambda o: -o[2])[:50])
        self.rep['doppi_dbgt_osm'] = dict(n=dup, dove=dd[:50])
        self.rep['doppi_dbgt_dbgt'] = dict(n=len(d2), dove=d2[:50])
        self.log('dbgt edifici: su una carreggiata', len(on), '(%.0f m2)' % self.rep['su_carreggiata']['m2'], 'doppi DBGT+OSM', dup, 'DBGT+DBGT', len(d2))

    def sintesi(self):
        r = self.rep
        return dict(edifici_dbgt=r.get('edifici_dbgt'), volumi=r.get('volumi_disegnati'), osm=r.get('osm'), tetti=r.get('tetti'), su_carreggiata=r.get('su_carreggiata', {}).get('n'),
                    doppi_dbgt_osm=r.get('doppi_dbgt_osm', {}).get('n'), doppi_dbgt_dbgt=r.get('doppi_dbgt_dbgt', {}).get('n'), volumi_sovrapposti_stesso_edificio=r.get('volumi_sovrapposti_stesso_edificio', {}).get('n'), aggiornamenti=r.get('aggiornamenti_dbgt'), accessi=r.get('accessi'), offset=r.get('offset_dbgt_lidar', {}).get('valore'),
                    vie_negli_edifici={k: v for k, v in r.get('vie_negli_edifici', {}).items() if not k.startswith('dove')}, stato_2015=r.get('stato_2015'))


def _gen(di, ced):
    """when a volume entered the DBGT, as yyyymmdd: its DATA_INI, or the date its building's code starts with (the updates without DATA_INI)"""
    s = str(di or '')
    if len(s) >= 10 and s[:4].isdigit() and s[5:7].isdigit() and s[8:10].isdigit(): return int(s[:4] + s[5:7] + s[8:10])
    c = str(ced or '')
    if len(c) >= 8 and c[:8].isdigit() and c[:2] in ('19', '20') and 1 <= int(c[4:6]) <= 12: return int(c[:8])
    return 0


def _num(v):
    try: return float(str(v).replace(',', '.').split()[0])
    except Exception: return None


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == '--tetti':
        _tetti_main(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else os.path.join(dq.DATA, 'terreno', 'lidar_dsm'), int(sys.argv[5]) if len(sys.argv) > 5 else TETTI_PROC)
    else:
        print(__doc__ or 'uso: python src/dbgt_edifici.py --tetti in.pkl out.pkl [dsm]')
