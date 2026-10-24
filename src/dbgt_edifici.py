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
from shapely.geometry import Polygon, Point, GeometryCollection, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from shapely import prepare
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq

FREE_D = 3.0       # an OSM building with no DBGT building within this distance stays (docs/motore.md 7)
EDGE_DUP = 0.3     # an OSM building outside the comune overlapping a DBGT building by this share of its area is the same building
MIN_VOL = 2.0      # volumes smaller than this (m2) are slivers
RAISED = 1.0       # a volume whose base stands this far over the ground is raised (portico, passage, overhang)
DSM_EAVE = 2.0     # the DSM roof is used when its eaves are within this of the top of the walls (UN_VOL_AV is the height to the eaves:
                   # on 258 gables of a sample the fitted eaves are 0.2 m below it in the median, the ridge 1.8 m above)
DSM_COVER = 0.7    # ... and the structure (over 1.5 m above the ground) covers this share of the footprint
DSM_TREES = 0.35   # more than this share of the DSM points far above the fitted roof: tree crowns over the roof
S_MIN, S_MAX = 0.12, 1.3   # slopes of a pitched roof (7 to 52 degrees)
OSM_SLOPE = 0.55   # a roof shape OSM gives without its height: about 29 degrees
RECT_FILL = 0.8    # the pitched roofs are fitted on the volume's minimum rectangle: only where the volume fills this much of it
RH_MAX = {1: 6.0, 2: 6.0, 3: 3.0}   # the highest ridge over the eaves (m): a steeper fit is the next, taller building seen by the DSM along a
                   # shared wall (a shed of 81 m2 came out with a single slope rising 17.9 m)
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


def _tetti_main(inp, out, dsm_dir):
    import multiprocessing as mp
    jobs = pickle.load(open(inp, 'rb'))
    with mp.Pool(TETTI_PROC, initializer=_dsm_init, initargs=(dsm_dir,)) as pool:
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
            for oid, b, av, ced, por in rows('select OBJECTID, Shape, UN_VOL_AV, CEDIUV, UN_VOL_POR from UN_VOL'):
                cens['UN_VOL_POR %s' % por] += 1
                if b is None or ced not in idx or not av or float(av) <= 0: cens['volumi senza edificio o altezza'] += 1; continue
                for p, zz in poly(dq._geom(b)):
                    if p.area < MIN_VOL: continue
                    zr = zz[(zz > 100) & np.isfinite(zz)] if zz is not None else np.zeros(0)
                    self.vol.append(dict(p=p, av=float(av), por=por or '01', ed=idx[ced], zmin=float(zr.min()) if len(zr) else None, oid=oid))
                    self.ed[idx[ced]]['vols'].append(len(self.vol) - 1)
            for (b,) in rows('select Shape from ACC_INT'):
                if b is None: continue
                g = dq._geom(b); self.acc.append(tuple(xy(np.array([[g.x, g.y]]))[0]))
            for b, zon, sed in rows('select Shape, AC_VEI_ZON, AC_VEI_SED from AC_VEI_AC_VEI_SUP_SR'):
                if b is not None and zon != '0307' and sed in ('01', None): self.carr += [p for p, z in poly(dq._geom(b))]
            con.close()
        self.rep['censimento'] = dict(sorted(cens.items()))
        for e in self.ed:  # the footprint: the ground plan (IS), or the union of the volumes
            if 'is' not in e or e['is'].is_empty: e['is'] = unary_union([self.vol[i]['p'] for i in e['vols']]) if e['vols'] else GeometryCollection()
        self.carr_u = unary_union(self.carr) if self.carr else GeometryCollection(); prepare(self.carr_u)
        self.carr_t = STRtree(self.carr) if self.carr else None
        # heights: the base rings of the ground volumes against the LiDAR on the same ring give the comune's offset (DBGT - DTM)
        self.lid = dq.Lidar(self.lidar_dir)
        dz = []
        for v in self.vol:
            if v['por'] != '01' or v['zmin'] is None: continue
            r = np.asarray(v['p'].exterior.coords); g = self.lid.at(r[:, 0], r[:, 1])
            if np.isfinite(g).sum() >= 3: v['gmed'] = float(np.nanmedian(g)); dz.append(v['zmin'] - v['gmed'])
        dz = np.asarray(dz); self.off = float(np.median(dz)) if len(dz) else 0.0
        self.rep['offset_dbgt_lidar'] = dict(valore=round(self.off, 3), p10=round(float(np.percentile(dz, 10)), 2) if len(dz) else None, p90=round(float(np.percentile(dz, 90)), 2) if len(dz) else None, n=int(len(dz)))
        for v in self.vol:
            if v['zmin'] is None:  # no height on the ring: the LiDAR under it
                r = np.asarray(v['p'].exterior.coords); g = self.lid.at(r[:, 0], r[:, 1]); v['zmin'] = float(np.nanmedian(g)) + self.off if np.isfinite(g).any() else None
            v['z0'] = None if v['zmin'] is None else v['zmin'] - self.off      # base, m a.s.l. on the LiDAR
            if v['z0'] is not None and v['por'] in ('02', '03', '04', '05', '06', '07', '09'):
                if 'gmed' not in v:
                    r = np.asarray(v['p'].exterior.coords); g = self.lid.at(r[:, 0], r[:, 1]); v['gmed'] = float(np.nanmedian(g)) if np.isfinite(g).any() else v['z0']
                v['alto'] = v['z0'] - v['gmed'] > RAISED
        self.rep['edifici_dbgt'] = len(self.ed); self.rep['volumi'] = len(self.vol); self.rep['accessi'] = len(self.acc)
        log('dbgt edifici: edifici', len(self.ed), 'volumi', len(self.vol), 'accessi', len(self.acc), 'offset %+.2f m' % self.off, '%.0fs' % (time.time() - t0))

    # ---------------------------------------------------------------- OSM against the DBGT
    def unisci(self, buildings, P):
        """buildings: the OSM and Overture buildings of build_data.py (records with 'p', 'k', 'tg'); P(outer, holes) -> polygon.
        Returns the new list of the buildings on the ground; the raised volumes are in self.alti"""
        t0 = time.time()
        geo = [e['is'] for e in self.ed]; ok = [i for i, g in enumerate(geo) if not g.is_empty]
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
                if near:
                    cnt['osm_sostituiti'] += 1
                    for i in near:
                        a = geo[i].intersection(g).area; sh = a / max(1e-6, min(g.area, geo[i].area))
                        if sh > 0.2 and sh > best.get(i, (0,))[0]: best[i] = (sh, b.get('tg') or {}, b)
                    continue
                cnt['osm_senza_dbgt'] += 1; b['osm_solo'] = True
                c = g.centroid; dove.append([round(c.x, 1), round(c.y, 1), round(g.area), (b.get('tg') or {}).get('building', 'yes')])
                kept_osm.append((b, g)); continue
            dup = [i for i in near if geo[i].intersection(g).area > EDGE_DUP * g.area]
            if dup:
                cnt['doppi_al_confine'] += 1
                for i in dup:
                    sh = geo[i].intersection(g).area / max(1e-6, min(g.area, geo[i].area))
                    if sh > best.get(i, (0,))[0]: best[i] = (sh, b.get('tg') or {}, b)
                continue
            keep.append(b)
        # the OSM buildings that stay are cut off the carriageways (the street always wins, as for OSM's own streets)
        ncut = ndrop = 0
        for b, g in kept_osm:
            if self.carr_t is not None:
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
        self.rep['osm'] = dict(cnt); self.rep['osm_senza_dbgt'] = dict(n=len(dove), dove=dove[:200])
        # the DBGT buildings, volume by volume
        alti, terra = [], []
        ntipo, nvol = Counter(), Counter()
        for i, e in enumerate(self.ed):
            sh, tg, ob = best.get(i, (0, {}, None))
            obt = tg.get('building')
            if obt in ('roof', 'carport') and e['kind'] == 'E': obt = None   # a roof on posts is a form: the DBGT's building (a volume on the ground) wins
            bt = obt if obt and obt not in ('yes',) else bt_dbgt(e['kind'], e['ty'], e['uso'])
            if tg.get('amenity') == 'place_of_worship' and e['is'].area > 120: bt = 'church'
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
                if v.get('alto'): rec['zb'] = round(v['z0'] - self.base, 2); alti.append(rec); nvol['alti_' + v['por']] += 1
                else: terra.append(rec); nvol['a_terra'] += 1
        self.alti = alti; self.terra = terra
        self.rep['volumi_disegnati'] = dict(nvol); self.rep['tipi'] = dict(ntipo.most_common())
        self.rep['attributi_da_osm'] = len(best)
        self.log('dbgt edifici: OSM', dict(cnt), 'volumi', dict(nvol), 'con attributi OSM', len(best), '%.0fs' % (time.time() - t0))
        return keep + terra

    # ---------------------------------------------------------------- roofs
    def tetti(self):
        """the roof of every DBGT volume from the DSM (in its own processes), or from OSM roof:shape; the reasons in the report"""
        t0 = time.time()
        recs = self.terra + self.alti
        jobs = [(k, np.asarray(r['p']), bool(r.get('k')), r['zt'] + self.base, r['zt'] + self.base - r['h'], r['bt'] in ('church', 'cathedral', 'chapel')) for k, r in enumerate(recs) if r['bt'] not in ('roof',)]
        res = {}
        if jobs and os.path.isdir(self.dsm_dir):
            d = tempfile.mkdtemp(prefix='tetti_'); fi, fo = os.path.join(d, 'in.pkl'), os.path.join(d, 'out.pkl')
            pickle.dump(jobs, open(fi, 'wb'))
            rc = subprocess.call([sys.executable, os.path.abspath(__file__), '--tetti', fi, fo, self.dsm_dir])
            if rc == 0 and os.path.exists(fo): res = pickle.load(open(fo, 'rb'))
            else: self.log('dbgt edifici: tetti dal DSM non riusciti, codice', rc)
        cnt, mot = Counter(), Counter(); rhs = []
        for k, r in enumerate(recs):
            f = res.get(k)
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
        self.rep['tetti'] = dict(dal_dsm=dict(cnt), non_dal_dsm=dict(mot), colmo_sulla_gronda=dict(p50=round(float(np.median(rhs)), 2), p90=round(float(np.percentile(rhs, 90)), 2), max=round(float(max(rhs)), 2)) if rhs else None)
        self.log('dbgt edifici: tetti dal DSM', dict(cnt), 'no', dict(mot), '%.0fs' % (time.time() - t0))

    # ---------------------------------------------------------------- checks
    def controlli(self, buildings, P):
        """buildings on a carriageway, DBGT and OSM buildings on top of each other (after the build has done with them)"""
        on, dup, dd = [], 0, []
        osm = [(b, P(b['p'], b.get('k', []))) for b in buildings if b.get('osm_solo')]
        osm = [(b, g) for b, g in osm if g is not None]
        ot = STRtree([g for b, g in osm]) if osm else None
        for b in buildings:
            if not (b.get('dbgt') or b.get('osm_solo')): continue
            g = P(b['p'], b.get('k', []))
            if g is None: continue
            if self.carr_t is not None:
                a = sum(self.carr[j].intersection(g).area for j in self.carr_t.query(g, predicate='intersects'))
                if a > 1.0: c = g.centroid; on.append([round(c.x, 1), round(c.y, 1), round(a, 1), 'dbgt' if b.get('dbgt') else 'osm'])
            if b.get('dbgt') and ot is not None:
                for j in ot.query(g, predicate='intersects'):
                    a = osm[j][1].intersection(g).area
                    if a > 1.0: dup += 1; c = g.centroid; dd.append([round(c.x, 1), round(c.y, 1), round(a, 1)])
        self.rep['su_carreggiata'] = dict(n=len(on), m2=round(sum(o[2] for o in on), 1), dove=sorted(on, key=lambda o: -o[2])[:50])
        self.rep['doppi_dbgt_osm'] = dict(n=dup, dove=dd[:50])
        self.log('dbgt edifici: su una carreggiata', len(on), '(%.0f m2)' % self.rep['su_carreggiata']['m2'], 'doppi DBGT+OSM', dup)

    def sintesi(self):
        r = self.rep
        return dict(edifici_dbgt=r.get('edifici_dbgt'), volumi=r.get('volumi_disegnati'), osm=r.get('osm'), tetti=r.get('tetti'), su_carreggiata=r.get('su_carreggiata', {}).get('n'),
                    doppi_dbgt_osm=r.get('doppi_dbgt_osm', {}).get('n'), accessi=r.get('accessi'), offset=r.get('offset_dbgt_lidar', {}).get('valore'))


def _num(v):
    try: return float(str(v).replace(',', '.').split()[0])
    except Exception: return None


if __name__ == '__main__':
    if len(sys.argv) >= 4 and sys.argv[1] == '--tetti':
        _tetti_main(sys.argv[2], sys.argv[3], sys.argv[4] if len(sys.argv) > 4 else os.path.join(dq.DATA, 'terreno', 'lidar_dsm'))
    else:
        print(__doc__ or 'uso: python src/dbgt_edifici.py --tetti in.pkl out.pkl [dsm]')
