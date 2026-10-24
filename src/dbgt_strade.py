# Il disegno dal DBGT, strade e marciapiedi (docs/motore.md 7). Inside a comune with a DBGT the streets take their shape from it:
#   - the axes of the ways (the graph of the AI cars, the pedestrians, the nodes) are the EL_STR axes, matched way by way to the OSM ways
#     (map matching on the EL_STR network); OSM keeps the name, class, one-way, limits, lanes. The OSM ways with no DBGT axis stay as they are
#     and go in the report (osm_senza_dbgt); the EL_STR elements no OSM way runs on go in it too (dbgt_senza_osm)
#   - cycle ways on EL_CIC, tracks and paths on EL_VMS, the same way
#   - the width of a matched way is the width of its carriageway AC_VEI (cross sections), so lanes, crossings, signs and posts stand on it
#   - the surfaces: asphalt = AC_VEI of the street (ZON not 0307), yards = AC_VEI ZON 0307 (pavement of their own, no AI traffic), sidewalks
#     = AC_PED on the sidewalk zones (step layer with a kerb), pedestrian areas and passages = the other AC_PED zones, islands and medians =
#     MAN_TR (AR_STR is the union of AC_VEI, AC_PED and MAN_TR piece by piece: nothing of its own to draw), cycle paths AC_CIC, dirt roads
#     AR_VMS; OSM's own surfaces stay only where the DBGT has nothing within 3 m
#   - checks (report): street furniture, barriers and buildings in the carriageway, lanes inside AC_VEI, drawn sidewalks and squares
#     against AC_PED + AR_STR
# Used by build_data.py (a few lines call it); python src/dbgt_strade.py DUMP runs the matching alone on a dump of build_data.py
# (GTA_DUMP_STRADE=file), with a picture of the result.
import os, sys, math, time, sqlite3
from collections import defaultdict, Counter
import numpy as np, shapely
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, GeometryCollection, box
from shapely.ops import unary_union
from shapely.strtree import STRtree
from pyproj import Transformer
from scipy.sparse import csr_matrix
from scipy.sparse.csgraph import dijkstra

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq

# AC_VEI_ZON (Specifiche di contenuto regionali, AC_VEI): 01 carriageway (0101 ordinary, 0102 ramp, 0103 service road, 0104 level crossing,
# 0105 alley), 02 structured traffic (0201 toll, 0204 square, 0205 junction, 0206 roundabout), 03 unstructured (0301 car park, 0307 inside a
# private area: courtyards, yards, drives), 04 parking lane, 05 lay-by, 06 bus bay, 07 shoulder, 08 painted island, 95 other
CORTILE = ('0307',)
# AC_PED_ZON: 01 sidewalk, 03 refuge island (raised: the step with a kerb), 04 arcade, 05 pedestrian gallery, 06 stepped path, 07 garden
# path, 08 alley, 09 pedestrian square or churchyard, 10 pedestrian passage at street level (a white line or a barrier, no kerb), 95 other
PED_STEP = ('01', '03')
PED_PIAZZA = ('04', '05', '08', '09', '10', '95')
PED_VIALE = ('06', '07')
MAN_ISOLA = ('01', '02', '03')   # MAN_TR_TY: 01 median, 02 traffic island, 03 roundabout centre
ISOLA_VERDE = 12.0               # an island this big (m2) has grass on top (see Strade.push_tiles)

SIGMA = 3.0      # map matching: spread of the OSM axis around the DBGT one (m)
BETA = 3.0       # ... of the difference between the route along the network and the straight line between two samples (m)
R_CAND = 12.0    # candidates within this distance of a sample
COS_MIN = 0.75   # and running the same way (|cos| of the angle between the two directions)
STEP = 3.0       # samples along the OSM way
D_FREE = 7.0     # a sample with no candidate nearer than this may stay unmatched: the cost of the unmatched state
T_FREE = 8.0     # ... and of entering or leaving it
EXT_END = 10.0   # a matched way that ends at a junction is carried along its element to the element's end (the DBGT junction) within this


def _tr():
    return Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)


def _game(tr, xy):
    lon, lat = tr.transform(xy[:, 0], xy[:, 1]); x, z = dq.to_game_lonlat(np.asarray(lon), np.asarray(lat)); return np.column_stack((x, z))


def _geom2(tr, blob):
    g = dq._geom(blob)
    return shapely.transform(shapely.force_2d(g), lambda c: _game(tr, c))


def leggi(gpkg):
    """the layers of the streets, in game metres: axes (EL_STR, EL_CIC, EL_VMS) as dicts, areas as (Polygon, attributes)"""
    con = sqlite3.connect(gpkg); tr = _tr(); D = {}

    def rows(sql):
        try: return con.execute(sql).fetchall()
        except sqlite3.OperationalError: return []

    def assi(sql, keys):
        out = []
        for row in rows(sql):
            if row[0] is None: continue
            g = dq._geom(row[0])
            for part in getattr(g, 'geoms', [g]):
                c = np.asarray(part.coords)
                if len(c) < 2: continue
                xy = _game(tr, c[:, :2]); z = c[:, 2] if c.shape[1] > 2 else np.full(len(c), np.nan)
                keep = np.r_[True, np.hypot(*np.diff(xy, axis=0).T) > 0.01]
                if keep.sum() < 2: continue
                out.append(dict(xy=xy[keep], z=z[keep], **dict(zip(keys, row[1:]))))
        return out

    def aree(sql, keys):
        out = []
        for row in rows(sql):
            if row[0] is None: continue
            g = _geom2(tr, row[0])
            if not g.is_valid: g = g.buffer(0)
            for part in getattr(g, 'geoms', [g]):
                if part.geom_type == 'Polygon' and part.area > 0.05: out.append((part, dict(zip(keys, row[1:]))))
        return out

    D['str'] = assi('select Shape, OBJECTID, EL_STR_SED, EL_STR_LIV, EL_STR_TY, EL_STR_CL, EL_STR_CF from EL_STR_EL_STR_TRA_SG', ('id', 'sed', 'liv', 'ty', 'cl', 'cf'))
    D['cic'] = assi('select Shape, OBJECTID, EL_CIC_SED, EL_CIC_POS from EL_CIC_EL_CIC_TRA_SG', ('id', 'sed', 'pos'))
    D['vms'] = assi('select s.Shape, s.OBJECTID, s.EL_VMS_SED, e.EL_VMS_TY from EL_VMS_EL_VMS_TRA_SG s left join EL_VMS e on s.CLASSREF = e.CLASSID', ('id', 'sed', 'ty'))
    D['vei'] = aree('select Shape, OBJECTID, AC_VEI_ZON, AC_VEI_SED, AC_VEI_FON from AC_VEI_AC_VEI_SUP_SR', ('id', 'zon', 'sed', 'fon'))
    D['ped'] = aree('select s.Shape, s.OBJECTID, s.AC_PED_ZON, s.AC_PED_SED, p.AC_PED_POS from AC_PED_AC_PED_SUP_SR s left join AC_PED p on s.CLASSREF = p.CLASSID', ('id', 'zon', 'sed', 'pos'))
    D['acic'] = aree('select Shape, OBJECTID, AC_CIC_SED from AC_CIC_AC_CIC_SUP_SR', ('id', 'sed'))
    D['man'] = aree('select s.Shape, s.OBJECTID, m.MAN_TR_TY from MAN_TR_MAN_TR_SUP s join MAN_TR m on s.CLASSREF = m.CLASSID', ('id', 'ty'))
    D['avms'] = aree('select s.Shape, s.OBJECTID, s.AR_VMS_SED from AR_VMS_AR_VMS_SUP_SR s', ('id', 'sed'))
    D['ar'] = aree('select Shape, OBJECTID, AR_STR_CF, AR_STR_SED from AR_STR_AR_STR_SUP_SR', ('id', 'cf', 'sed'))
    D['ponte'] = aree('select Shape, OBJECTID from PONTE_PONTE_SEDE', ('id',))
    return D


# ---------------------------------------------------------------- the network of the axes
class Rete:
    """EL_STR (or EL_CIC, EL_VMS) as a graph: element ends are the junctions; segments indexed for the candidates"""

    def __init__(s, assi):
        s.assi = assi; keys = {}; ends = []
        def nodo(p):
            k = (round(p[0] * 20), round(p[1] * 20))
            if k not in keys: keys[k] = len(keys); ends.append(p)
            return keys[k]
        s.e0, s.e1, s.len, s.cum = [], [], [], []
        A, B, E, S0 = [], [], [], []
        for i, a in enumerate(assi):
            xy = a['xy']; d = np.hypot(*np.diff(xy, axis=0).T); c = np.r_[0, np.cumsum(d)]
            s.e0.append(nodo(xy[0])); s.e1.append(nodo(xy[-1])); s.len.append(float(c[-1])); s.cum.append(c)
            A.append(xy[:-1]); B.append(xy[1:]); E.append(np.full(len(d), i)); S0.append(c[:-1])
        s.P = np.array(ends); s.n = len(ends)
        s.A, s.B, s.E, s.S0 = np.vstack(A), np.vstack(B), np.concatenate(E), np.concatenate(S0)
        s.tree = STRtree(shapely.linestrings(np.stack((s.A, s.B), 1)))
        r, c, w = [], [], []
        for i in range(len(assi)): r += [s.e0[i], s.e1[i]]; c += [s.e1[i], s.e0[i]]; w += [s.len[i], s.len[i]]
        s.G = csr_matrix((w, (r, c)), shape=(s.n, s.n)); s._dc = {}
        s.edge_of = {}
        for i in range(len(assi)):
            k = (min(s.e0[i], s.e1[i]), max(s.e0[i], s.e1[i]))
            if k not in s.edge_of or s.len[i] < s.len[s.edge_of[k]]: s.edge_of[k] = i
        s.deg = np.bincount(np.r_[s.e0, s.e1], minlength=s.n)

    def dist_from(s, u):
        if u not in s._dc:
            d, p = dijkstra(s.G, indices=u, limit=400.0, return_predecessors=True); s._dc[u] = (d, p)
        return s._dc[u]

    def point_at(s, e, t):
        c = s.cum[e]; xy = s.assi[e]['xy']; t = min(max(t, 0.0), c[-1]); k = min(max(np.searchsorted(c, t) - 1, 0), len(c) - 2)
        f = (t - c[k]) / max(c[k + 1] - c[k], 1e-9); return xy[k] + (xy[k + 1] - xy[k]) * f

    def piece(s, e, t0, t1):  # the points of element e from t0 to t1 (either way), ends included
        c = s.cum[e]; xy = s.assi[e]['xy']
        if t0 <= t1: inner = [xy[k] for k in range(len(c)) if t0 < c[k] < t1]
        else: inner = [xy[k] for k in range(len(c) - 1, -1, -1) if t1 < c[k] < t0]
        return [s.point_at(e, t0)] + inner + [s.point_at(e, t1)]

    def candidates(s, P, U, R=R_CAND):
        """for each sample point P[k] (direction U[k]): list of (element, t, distance, point), the nearest point of each element"""
        pts = shapely.points(P); qi, qj = s.tree.query(pts, predicate='dwithin', distance=R)
        out = [dict() for _ in range(len(P))]
        if not len(qi): return [[] for _ in range(len(P))]
        a, b = s.A[qj], s.B[qj]; d = b - a; L = np.hypot(d[:, 0], d[:, 1]); L = np.maximum(L, 1e-9); u = d / L[:, None]
        p = P[qi]; t = np.clip(((p - a) * u).sum(1), 0, L); q = a + u * t[:, None]; dd = np.hypot(*(p - q).T)
        cs = np.abs((u * U[qi]).sum(1))
        for k, j, tt, di, qq, cc in zip(qi, qj, t, dd, q, cs):
            if cc < COS_MIN: continue
            e = int(s.E[j]); te = float(s.S0[j] + tt); o = out[k]
            if e not in o or di < o[e][1]: o[e] = (te, float(di), qq)
        return [[(e, v[0], v[1], v[2]) for e, v in o.items()] for o in out]

    def route(s, c1, c2):
        """length along the network from candidate c1 = (e, t) to c2, and how: ('same',) or (end of e1, end of e2) through the graph"""
        e1, t1 = c1[0], c1[1]; e2, t2 = c2[0], c2[1]
        if e1 == e2: return abs(t2 - t1), ('same',)
        best = (math.inf, None)
        for u, du in ((s.e0[e1], t1), (s.e1[e1], s.len[e1] - t1)):
            d, _ = s.dist_from(u)
            for v, dv in ((s.e0[e2], t2), (s.e1[e2], s.len[e2] - t2)):
                tot = du + d[v] + dv
                if tot < best[0]: best = (tot, (u, v))
        return best

    def path_nodes(s, u, v):
        _, p = s.dist_from(u); out = [v]
        while out[-1] != u:
            w = p[out[-1]]
            if w < 0: return None
            out.append(int(w))
        return out[::-1]

    def route_points(s, c1, c2, how):
        e1, t1 = c1[0], c1[1]; e2, t2 = c2[0], c2[1]
        if how[0] == 'same': return s.piece(e1, t1, t2)
        u, v = how; pts = s.piece(e1, t1, 0.0 if u == s.e0[e1] else s.len[e1])
        ns = s.path_nodes(u, v) or [u, v]
        for a, b in zip(ns, ns[1:]):
            e = s.edge_of[(min(a, b), max(a, b))]; pts += s.piece(e, 0.0, s.len[e]) if s.e0[e] == a else s.piece(e, s.len[e], 0.0)
        pts += s.piece(e2, 0.0 if v == s.e0[e2] else s.len[e2], t2)
        return pts


def _samples(xy):
    """samples along a polyline every STEP m with its vertices; returns points, directions, index of the vertex (or -1)"""
    P, U, V = [], [], []
    for i in range(len(xy) - 1):
        a, b = xy[i], xy[i + 1]; d = b - a; L = math.hypot(*d)
        u = d / L if L > 1e-9 else np.array([1.0, 0.0]); n = max(1, int(math.ceil(L / STEP)))
        for k in range(n): P.append(a + d * (k / n)); U.append(u); V.append(i if k == 0 else -1)
    P.append(xy[-1]); U.append(U[-1] if U else np.array([1.0, 0.0])); V.append(len(xy) - 1)
    U = np.array(U)
    if len(U) > 2:  # at a vertex, the mean direction of the two sides
        for k in range(1, len(U) - 1):
            if V[k] >= 0: m = U[k - 1] + U[k]; nm = np.hypot(*m); U[k] = m / nm if nm > 1e-6 else U[k]
    return np.array(P), U, np.array(V)


def viterbi(rete, xy, d_free=D_FREE):
    """map matching of one polyline on the network: for each sample the chosen candidate (e, t, d, point) or None"""
    P, U, V = _samples(xy); C = rete.candidates(P, U)
    n = len(P); INF = math.inf; free_cost = (d_free / SIGMA) ** 2
    cost = [None] * n; back = [None] * n
    for k in range(n):
        em = [(c[2] / SIGMA) ** 2 for c in C[k]] + [free_cost]
        if k == 0: cost[0] = em; back[0] = [None] * len(em); continue
        prev = cost[k - 1]; pc = C[k - 1] + [None]; cc = C[k] + [None]; dk = float(np.hypot(*(P[k] - P[k - 1])))
        row, bk = [], []
        for j, c in enumerate(cc):
            best, bi = INF, None
            for i, p in enumerate(pc):
                if prev[i] == INF: continue
                if c is None or p is None:
                    tcost = 0.0 if (c is None and p is None) else T_FREE
                else:
                    L, how = rete.route(p, c)
                    if L > 2 * dk + 15: continue
                    tcost = abs(L - dk) / BETA
                v = prev[i] + tcost
                if v < best: best, bi = v, i
            row.append(best + em[j]); bk.append(bi)
        cost[k] = row; back[k] = bk
    j = int(np.argmin(cost[-1])); out = [None] * n
    for k in range(n - 1, -1, -1):
        cc = C[k] + [None]; out[k] = cc[j]
        if k: j = back[k][j]
    return P, V, out


# ---------------------------------------------------------------- matching the OSM ways
def abbina(raw_roads, nodes, D, cover, log=print, new_id=None):
    """moves the OSM ways inside cover onto the DBGT axes, in place: nodes get new positions, ways get new intermediate nodes ('d...').
    Returns the report"""
    t0 = time.time(); rep = {}
    nets = {'str': Rete(D['str'])}
    if D['cic']: nets['cic'] = Rete(D['cic'])
    if D['vms']: nets['vms'] = Rete(D['vms'])
    def net_of(r):
        if r['c'] <= 5: return 'str'
        if r['hw'] == 'cycleway': return 'cic'
        if r['hw'] in ('track', 'path', 'bridleway'): return 'vms'
        return None
    shapely.prepare(cover)
    res = {}   # way index -> (net, P, V, matched)
    for wi, r in enumerate(raw_roads):
        nk = net_of(r)
        if nk not in nets: continue   # trenches tagged layer -1 (the Milano-Meda) have their EL_STR too
        xy = np.array([nodes[n_] for n_ in r['refs']])
        inside = shapely.contains_xy(cover, xy[:, 0], xy[:, 1])
        if not inside.any(): continue
        dfree = max(D_FREE, r['w'] / 2 + 3.0) if nk == 'str' else 4.0
        P, V, M = viterbi(nets[nk], xy, dfree)
        Pin = shapely.contains_xy(cover, P[:, 0], P[:, 1])
        M = [m if ok else None for m, ok in zip(M, Pin)]
        res[wi] = (nk, P, V, M)
    log('dbgt strade: abbinamento %d vie in %.0f s' % (len(res), time.time() - t0))
    # one axis, one way: where two OSM ways run on the same stretch of an element (a dual carriageway mapped as one road, a service road
    # beside a street), the stretch goes to the nearer one; the other stays OSM there
    claim = defaultdict(list)   # (net, element, 2 m bin) -> [(distance, way, sample)]
    for wi, (nk, P, V, M) in res.items():
        for k, m in enumerate(M):
            if m is not None: claim[(nk, m[0], int(m[1] // 2))].append((m[2], wi, k))
    lost = defaultdict(set)
    for key, lst in claim.items():
        ws = {w for _, w, _ in lst}
        if len(ws) < 2: continue
        best = min(lst)[1]
        for d_, w, k in lst:
            if w != best: lost[w].add(k)
    nconf = 0
    for w, ks in lost.items():
        nk, P, V, M = res[w]
        # only real overlaps: a run of at least 3 lost samples (a junction shares a point, not a stretch)
        ks = sorted(ks); runs, cur = [], [ks[0]]
        for k in ks[1:]:
            if k == cur[-1] + 1: cur.append(k)
            else: runs.append(cur); cur = [k]
        runs.append(cur)
        for run in runs:
            if len(run) >= 3:
                for k in run: M[k] = None
                nconf += 1
    rep['tratti_contesi'] = nconf
    # where each OSM node goes: the matched point of its sample, per way; a shared node takes the DBGT junction its ways' routes have in common
    pos = defaultdict(list)   # node ref -> [(way, point)]
    for wi, (nk, P, V, M) in res.items():
        r = raw_roads[wi]
        for k, vi in enumerate(V):
            if vi >= 0 and M[k] is not None: pos[r['refs'][vi]].append((wi, M[k]))
    use = defaultdict(int)
    for r in raw_roads:
        for n_ in r['refs']: use[n_] += 1
    newpos = {}; njun = nmean = nkeep = 0
    sk = {wi: {vi: k for k, vi in enumerate(V) if vi >= 0} for wi, (nk, P, V, M) in res.items()}
    def put_end(w, n_, u):  # the way's candidate at node n_ moved to the end u of its element (the DBGT junction)
        nk, P, V, M = res[w]; rt = nets[nk]
        for vi, rf in enumerate(raw_roads[w]['refs']):
            if rf != n_: continue
            k = sk[w][vi]; m = M[k]
            if m is None: continue
            e = m[0]; t = 0.0 if rt.e0[e] == u else rt.len[e]; M[k] = (e, t, m[2], rt.P[u])
    for n_, lst in pos.items():
        pts = np.array([m[3] for _, m in lst])
        if len(lst) == 1: newpos[n_] = pts[0]; continue   # the other ways at this node are not matched (footways): they follow it
        # the junction of the DBGT nearest to the node among the ends of the elements the ways are on
        cand = None
        nets_ = {res[w][0] for w, _ in lst}
        if len(nets_) == 1:
            rt = nets[next(iter(nets_))]; common = None
            for w, m in lst:
                e = m[0]; ends = {rt.e0[e], rt.e1[e]}
                common = ends if common is None else common & ends
            if common and len({m[0] for _, m in lst}) > 1:
                o = np.array(nodes[n_]); cand = min(common, key=lambda u: np.hypot(*(rt.P[u] - o)))
                if np.hypot(*(rt.P[cand] - o)) > 20: cand = None
            if cand is not None:
                newpos[n_] = rt.P[cand]; njun += 1
                for w, m in lst: put_end(w, n_, cand)
                continue
        if np.hypot(*(pts - pts.mean(0)).T).max() < 1.5: newpos[n_] = pts.mean(0); nmean += 1; continue
        # no common junction: the point of the most important way
        w0 = min(lst, key=lambda wm: (raw_roads[wm[0]]['c'], wm[1][2]))
        newpos[n_] = w0[1][3]; nkeep += 1
    rep['nodi_spostati'] = len(newpos); rep['nodi_su_giunzione_dbgt'] = njun; rep['nodi_media'] = nmean; rep['nodi_senza_giunzione_comune'] = nkeep
    # the new polylines: between two consecutive nodes of a way, the route along the matched axes
    nnew = 0; moved = {}
    for wi, (nk, P, V, M) in res.items():
        r = raw_roads[wi]; rt = nets[nk]; refs = r['refs']; vk = sk[wi]
        out = [refs[0]]
        for i in range(len(refs) - 1):
            ka, kb = vk[i], vk[i + 1]; seg = []
            ok = all(M[k] is not None for k in range(ka, kb + 1))
            if ok:
                for k in range(ka, kb):
                    L, how = rt.route(M[k], M[k + 1])
                    if L == math.inf: ok = False; break
                    pts = rt.route_points(M[k], M[k + 1], how)
                    seg += pts[1:] if seg else pts
            if ok and len(seg) > 2:
                inner = LineString(seg).simplify(0.05).coords[1:-1]
                for p in inner:
                    nid = new_id(); nodes[nid] = (float(p[0]), float(p[1])); out.append(nid); nnew += 1
            out.append(refs[i + 1])
        r['refs'] = out; r['dbgt'] = nk
        r['match'] = float(np.mean([m is not None for m in M]))
    for n_, p in newpos.items():
        moved[n_] = math.dist(nodes[n_], p); nodes[n_] = (float(p[0]), float(p[1]))
    mv = np.array(list(moved.values())) if moved else np.zeros(1)
    rep['nodi_nuovi_lungo_gli_assi'] = nnew
    rep['spostamento_nodi_m'] = dict(p50=round(float(np.percentile(mv, 50)), 2), p90=round(float(np.percentile(mv, 90)), 2), p99=round(float(np.percentile(mv, 99)), 2), max=round(float(mv.max()), 2))
    rep['vie_abbinate'] = dict(Counter(nk for nk, *_ in res.values()))
    rep['tempo_s'] = round(time.time() - t0, 1)
    return rep, res, nets


# ---------------------------------------------------------------- rasters of the areas (widths, lanes, what stands in the carriageway)
class Raster:
    def __init__(s, bounds, res=0.5):
        s.res = res; s.x0, s.z0 = bounds[0], bounds[1]
        s.nx, s.nz = int(math.ceil((bounds[2] - bounds[0]) / res)) + 1, int(math.ceil((bounds[3] - bounds[1]) / res)) + 1

    def draw(s, polys):
        from PIL import Image, ImageDraw
        im = Image.new('1', (s.nx, s.nz), 0); dr = ImageDraw.Draw(im)
        f = lambda c: [((x - s.x0) / s.res, (z - s.z0) / s.res) for x, z in c]
        for g in polys:
            for p in getattr(g, 'geoms', [g]):
                if p.geom_type != 'Polygon' or p.is_empty: continue
                dr.polygon(f(p.exterior.coords), fill=1)
                for h in p.interiors: dr.polygon(f(h.coords), fill=0)
        return np.array(im, dtype=bool)

    def at(s, M, x, z):
        c = np.round((np.asarray(x, float) - s.x0) / s.res).astype(np.int64); r = np.round((np.asarray(z, float) - s.z0) / s.res).astype(np.int64)
        ok = (c >= 0) & (c < s.nx) & (r >= 0) & (r < s.nz); out = np.zeros(c.shape, bool); out[ok] = M[r[ok], c[ok]]; return out

    def ray(s, M, P, N, rmax=20.0, step=0.25):
        """distance from each point P along the direction N to the first cell outside M (rmax if none)"""
        d = np.full(len(P), rmax); alive = np.ones(len(P), bool)
        for k in range(1, int(rmax / step) + 1):
            t = k * step; q = P + N * t; inm = s.at(M, q[:, 0], q[:, 1])
            hit = alive & ~inm; d[hit] = t - step / 2; alive &= inm
            if not alive.any(): break
        return d


TRONCO = ('01', '0101', '0102', '0103', '0105')
NON_CARR = ('0307', '0301')   # not the carriageway: yards and car parks (asphalt, lamps and benches stand there)


def _parts(g):
    if g is None or g.is_empty: return []
    return [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and not p.is_empty]


def _u(gs):
    gs = [g for g in gs if g is not None and not g.is_empty]
    return unary_union(gs) if gs else GeometryCollection()


def _pct(a, ps=(50, 90, 99)):
    a = np.asarray(a, float)
    return {('p%d' % p): round(float(np.percentile(a, p)), 2) for p in ps} if len(a) else {}


def _link(x, z): return '?x=%.0f&z=%.0f' % (x, z)


class Strade:
    """the streets of the comuni with a DBGT, for build_data.py"""

    def __init__(s, gpkgs, cover, log=print):
        t0 = time.time(); s.log = log; s.cover = cover; shapely.prepare(cover); s.rep = {}
        D = None
        for f in gpkgs:
            d = leggi(f)
            if D is None: D = d
            else:
                for k in D: D[k] += d[k]
        s.D = D
        base = [(g, a) for g, a in D['vei'] if a.get('sed') in ('01', None)]
        s.asfalto = [g for g, a in base if a['zon'] not in CORTILE]
        s.cortili = [g for g, a in base if a['zon'] in CORTILE]
        s.carr = [g for g, a in D['vei'] if a['zon'] not in NON_CARR]      # bridges too: nothing stands in a carriageway
        s.tronco = [g for g, a in D['vei'] if a['zon'] in TRONCO]
        ped = [(g, a) for g, a in D['ped'] if a.get('sed') in ('01', None)]
        s.marciapiedi = [g for g, a in ped if a['zon'] in PED_STEP]
        s.piazze = [g for g, a in ped if a['zon'] in PED_PIAZZA or a['zon'] not in PED_STEP + PED_VIALE]
        s.vialetti = [g for g, a in ped if a['zon'] in PED_VIALE] + [g for g, a in D['acic'] if a.get('sed') in ('01', None)] + [g for g, a in D['avms']]
        s.isole = [g for g, a in D['man'] if a['ty'] in MAN_ISOLA]
        s.tutto = s.asfalto + s.cortili + [g for g, a in D['ped']] + [g for g, a in D['acic']] + [g for g, a in D['avms']] + [g for g, a in D['man']]
        s.U_carr = _u(s.carr); shapely.prepare(s.U_carr)
        segs = []   # the edges of the carriageways, one segment each: exact distances to the edge
        for p in _parts(s.U_carr):
            for ring in [p.exterior] + list(p.interiors):
                c = np.asarray(ring.coords); segs.append(np.stack((c[:-1], c[1:]), 1))
        s.bordi = STRtree(shapely.linestrings(np.concatenate(segs))) if segs else None
        s.T_carr = STRtree(s.carr)
        bb = cover.bounds; bb = (bb[0] - 40, bb[1] - 40, bb[2] + 40, bb[3] + 40)
        s.R = Raster(bb); s.CV = s.R.draw(s.carr); s.TR = s.R.draw(s.tronco)
        log('dbgt strade: strati letti in %.0f s, assi %d, carreggiate %d, cortili %d, marciapiedi %d, piazze e passaggi %d, vialetti ciclabili e sterrati %d, isole %d' % (
            time.time() - t0, len(D['str']), len(s.asfalto), len(s.cortili), len(s.marciapiedi), len(s.piazze), len(s.vialetti), len(s.isole)))

    # ---- 1. the axes
    def assi(s, raw_roads, nodes):
        cnt = [0]
        def new_id(): cnt[0] += 1; return 'dbgt%d' % cnt[0]
        s.orig = {i: [nodes[n_] for n_ in r['refs']] for i, r in enumerate(raw_roads)}
        rep, res, nets = abbina(raw_roads, nodes, s.D, s.cover, s.log, new_id)
        s.res, s.nets = res, nets
        # the width of a matched street: its carriageway in cross sections (the ordinary stretches, not junctions or roundabouts)
        nw = 0; dw = []
        for wi, r in enumerate(raw_roads):
            if r.get('dbgt') != 'str': continue
            xy = np.array([nodes[n_] for n_ in r['refs']]); P, U, V = _samples(xy)
            if len(P) < 2: continue
            M = s.TR; ins = s.R.at(M, P[:, 0], P[:, 1])
            if ins.sum() < max(2, 0.3 * len(P)): M = s.CV; ins = s.R.at(M, P[:, 0], P[:, 1])   # a way all in junctions or lay-bys: on the whole carriageway
            if ins.sum() < 2: continue
            N = np.column_stack((-U[:, 1], U[:, 0]))[ins]; Q = P[ins]
            # EL_STR is the middle of its carriageway: twice the nearer edge (a ramp or a parallel carriageway joined on one side doubled dl + dr)
            dl, dr = s.R.ray(M, Q, N), s.R.ray(M, Q, -N); w = 2 * np.minimum(dl, dr); ok = w < 30
            if ok.sum() < 2: continue
            wm = float(np.median(w[ok]))
            if not 2.4 <= wm <= 30: continue
            dw.append(wm - r['w']); r['w'] = round(wm, 1); r['wx'] = True; nw += 1
            r['mh_dbgt'] = round(float(max(1.0, np.percentile(np.minimum(dl, dr)[ok], 5))), 2)
        rep['larghezze_da_ac_vei'] = dict(vie=nw, differenza_dalla_larghezza_osm_m=_pct(dw, (10, 50, 90)))
        s.rep['assi'] = rep
        s.log('dbgt strade: %s' % rep)

    def mezze(s, raw_roads):
        """the free half width of a matched street is its carriageway's (the lanes stay inside AC_VEI)"""
        for r in raw_roads:
            if r.get('mh_dbgt'): r['mh'] = round(min(r['w'] / 2, r['mh_dbgt']), 2)

    def carreggiate(s, buf=0.0):
        """the carriageway pieces inside the comuni (buffered): nothing stands or is built in them. Shrunk, the union is shrunk (shrinking
        each piece left a strip along the edges between two pieces where a wall crossing the street survived)"""
        if buf < 0:  # cut in 50 m squares: united the network is one polygon as big as the town, and cutting a wall against it is slow
            U = s.U_carr.buffer(buf, join_style=2); x0, z0, x1, z1 = U.bounds; out = []
            sq = [box(x, z, x + 50, z + 50) for x in np.arange(x0, x1, 50) for z in np.arange(z0, z1, 50)]
            for b, g in zip(sq, shapely.intersection(U, np.array(sq, dtype=object))): out += [p for p in _parts(g) if p.area > 0.5]
            return out
        return [g.buffer(buf, join_style=2) if buf else g for g in s.carr]

    # ---- 2. the surfaces
    def superfici(s, raw_roads, asph, pedz, side, foot, median, bunion):
        t0 = time.time(); C = s.cover
        tutto = _u([g.buffer(3.0, quad_segs=2) for g in s.tutto]); shapely.prepare(tutto)
        # OSM ways the DBGT does not have: no axis matched and no DBGT surface within 3 m along most of them; their surfaces stay OSM
        sole = []
        for wi, r in enumerate(raw_roads):
            if r['c'] > 6 or r['line'].length < 0.5 or not C.intersects(r['line']): continue
            if r.get('dbgt') and r.get('match', 0) >= 0.5: continue
            L = r['line'].intersection(C)
            if L.length < 0.5: continue
            if L.difference(tutto).length / L.length > 0.5: sole.append(wi)
        s.sole = sole
        buf = lambda cs: _u([raw_roads[wi]['line'].buffer(raw_roads[wi]['w'] / 2, quad_segs=5) for wi in sole if raw_roads[wi]['c'] in cs and not raw_roads[wi].get('deck') and not raw_roads[wi]['tunnel']])
        dbgt_all = _u(s.tutto); out = {}
        out_C = lambda g: g.difference(C) if not g.is_empty else g
        out['as'] = _u([out_C(asph)] + s.asfalto + [buf((0, 1, 2, 3, 4)).difference(dbgt_all).difference(bunion)])
        out['pz'] = _u([out_C(pedz)] + s.piazze + [buf((5,)).difference(dbgt_all).difference(bunion)]).difference(out['as'])
        out['sd'] = _u([out_C(side)] + s.marciapiedi).difference(out['as']).difference(out['pz'])
        out['ft'] = _u([foot.difference(dbgt_all) if not foot.is_empty else foot] + s.vialetti).difference(out['as']).difference(out['sd']).difference(out['pz']).difference(bunion)
        out['md'] = out_C(median)
        s.md_dbgt = _u(s.isole)
        s.cv = _u(s.cortili).difference(out['as']).difference(bunion)
        s.surf = out
        s.rep['superfici'] = dict(osm_tenute_vie=len(sole), asfalto_m2=round(_u(s.asfalto).area), cortili_m2=round(s.cv.area), marciapiedi_m2=round(_u(s.marciapiedi).area),
                                  piazze_m2=round(_u(s.piazze).area), vialetti_m2=round(_u(s.vialetti).area), isole_m2=round(s.md_dbgt.area), tempo_s=round(time.time() - t0, 1))
        s.log('dbgt strade: superfici %s' % s.rep['superfici'])
        return out['as'], out['pz'], out['sd'], out['ft'], out['md']

    # ---- 3. what stands by the street
    def fuori(s, p, margin=0.6):
        """a point in a carriageway: moved to the nearest point outside it, margin past the edge (None if it is not in one)"""
        P = Point(p)
        if not s.U_carr.contains(P): return None
        if not hasattr(s, '_bd'): s._bd = s.U_carr.boundary
        b = s._bd; q = b.interpolate(b.project(P)); d = math.hypot(q.x - p[0], q.y - p[1])
        ux, uz = ((q.x - p[0]) / d, (q.y - p[1]) / d) if d > 1e-6 else (1.0, 0.0)
        for m in (margin, margin + 0.6, margin + 1.5):
            c = (q.x + ux * m, q.y + uz * m)
            if not s.U_carr.contains(Point(c)): return c
        return (q.x + ux * margin, q.y + uz * margin)

    def larghezza_locale(s, x, z, ux, uz, w):
        """the width a pair of posts square to (ux, uz) at (x, z) must clear: the carriageway there, both sides from the axis"""
        P = np.array([[x, z]]); N = np.array([[-uz, ux]])
        if not s.R.at(s.CV, [x], [z])[0]: return w
        dl, dr = s.R.ray(s.CV, P, N, 25)[0], s.R.ray(s.CV, P, -N, 25)[0]
        return round(min(w + 6, max(w, 2 * max(dl, dr) + 0.2)), 1) if max(dl, dr) < 25 else w   # at most 3 m more a side (a ray along a junction runs on)

    def push_tiles(s, ntiles, tbox, polys_of, push):
        """the yards (cv) and the islands and medians of the DBGT (md with g: 1, drawn whatever their size; v: 1 grass on top) in the tiles.
        Grass or paved: MAN_TR_VRD is empty at Meda; on the Mapillary photos of 10 islands and medians (strade/mly_man) 8 are grass or a hedge
        behind a kerb, the small ones paved: grass from ISOLA_VERDE m2 up"""
        P1 = _parts(s.cv); P2 = [p for p in _parts(s.md_dbgt) if p.area >= ISOLA_VERDE]; P3 = [p for p in _parts(s.md_dbgt) if p.area < ISOLA_VERDE]
        T1, T2, T3 = (STRtree(P_) if P_ else None for P_ in (P1, P2, P3))
        for t in range(ntiles):
            bx = tbox(t)
            for P_, T_, key, extra in ((P1, T1, 'cv', {}), (P2, T2, 'md', {'g': 1, 'v': 1}), (P3, T3, 'md', {'g': 1})):
                if T_ is None: continue
                idx = T_.query(bx)
                if not len(idx): continue
                c = unary_union([P_[i].intersection(bx) for i in idx])
                for p_ in polys_of(c, 0.15, 0.5): p_.update(extra); push(t, key, p_)

    # ---- 4. checks (docs/motore.md 7, last paragraph)
    def controlli(s, raw_roads, nodes, oggetti=(), lampioni=(), cartelli=(), barriere=(), edifici=(), alberi=(), attraversamenti=()):
        t0 = time.time(); rep = {}; C = s.cover
        def dentro(pts):
            pts = np.asarray(pts, float).reshape(-1, 2)
            if not len(pts): return np.zeros(0, bool)
            return shapely.contains_xy(C, pts[:, 0], pts[:, 1]) & shapely.contains_xy(s.U_carr, pts[:, 0], pts[:, 1])
        def elenco(pts, m, n=20): return [_link(*p) for p in np.asarray(pts, float).reshape(-1, 2)[m][:n]]
        for nm, pts in (('oggetti', oggetti), ('lampioni', lampioni), ('alberi', alberi)):
            pts = np.asarray(list(pts), float).reshape(-1, 2); m = dentro(pts); rep[nm + '_in_carreggiata'] = dict(n=int(m.sum()), di=len(pts), dove=elenco(pts, m))
        # town signs: the two posts as paesaggio3.js puts them, w/2 + 1.2 m right of each driver, 3 m before and after
        posts = []
        for c in cartelli:
            x, z, ux, uz, w = c[0] / 10, c[1] / 10, c[2], c[3], c[4]; rx, rz, off = -uz, ux, w / 2 + 1.2
            posts += [(x - ux * 3 + rx * off, z - uz * 3 + rz * off), (x + ux * 3 - rx * off, z + uz * 3 - rz * off)]
        m = dentro(posts); rep['pali_dei_cartelli_in_carreggiata'] = dict(n=int(m.sum()), di=len(posts), dove=elenco(posts, m))
        # barriers: length inside the carriageway (deeper than 0.3 m)
        inner = s.U_carr.buffer(-0.3); shapely.prepare(inner); nb, lb, dove = 0, 0.0, []
        for pts in barriere:
            if len(pts) < 2: continue
            L = LineString(pts)
            if not C.intersects(L) or not inner.intersects(L): continue
            li = L.intersection(inner).length
            if li > 0.2: nb += 1; lb += li; m_ = L.intersection(inner).representative_point(); dove.append(_link(m_.x, m_.y))
        rep['barriere_in_carreggiata'] = dict(n=nb, metri=round(lb, 1), dove=dove[:20])
        # buildings on a carriageway (more than 1 m2)
        ne, dove = 0, []
        for g in edifici:
            if g is None or not C.contains(g.centroid): continue
            for j in s.T_carr.query(g):
                if s.carr[j].intersection(g).area > 1.0: ne += 1; dove.append(_link(g.centroid.x, g.centroid.y)); break
        rep['edifici_su_carreggiata'] = dict(n=ne, dove=dove[:20])
        rep['corsie_dentro_ac_vei'] = s.corsie(raw_roads, nodes)
        rep.update(s._resto(raw_roads))
        rep['attraversamenti'] = dict(n=len(attraversamenti))
        rep['tempo_s'] = round(time.time() - t0, 1)
        s.rep['controlli'] = rep
        s.log('dbgt strade: controlli ' + ', '.join('%s %s' % (k, v.get('n', v.get('quota', v.get('iou')))) for k, v in rep.items() if isinstance(v, dict)))
        return s.rep

    def corsie(s, raw_roads, nodes):
        """lanes inside AC_VEI: the lane line of the AI cars (axis + r.lane to the right, as world3.js) at least half a lane from the edge
        (half the lane width, at most 1.5 m, minus 0.25), on the ordinary stretches: in junctions the lanes are virtual"""
        C = s.cover; tot = bad = car = 0; dove = []; dist = []
        for r in raw_roads:
            if r['c'] > 3 or r.get('dbgt') != 'str': continue
            xy = np.array([nodes[n_] for n_ in r['refs']]); P, U, V = _samples(xy)
            if len(P) < 2: continue
            ins = s.R.at(s.TR, P[:, 0], P[:, 1]) & shapely.contains_xy(C, P[:, 0], P[:, 1])
            if not ins.any(): continue
            lane = 0.0 if r['o'] else min(r['w'] * 0.24, r['mh'] * 0.5); half = min(1.5, (r['w'] if r['o'] else r['w'] / 2) / 2)
            N = np.column_stack((-U[:, 1], U[:, 0]))
            for sg in ((1,) if r['o'] else (1, -1)):
                Q = P[ins] + N[ins] * lane * sg; inq = shapely.contains_xy(s.U_carr, Q[:, 0], Q[:, 1])
                d = s.bordi.query_nearest(shapely.points(Q), return_distance=True, all_matches=False)[1] if len(Q) else np.zeros(0); d[~inq] = 0
                b = d < half - 0.25; tot += len(Q); bad += int(b.sum()); car += int((d < 0.9).sum()); dist += list(d - half)
                for q in Q[b][:2]: dove.append(_link(*q))
        return dict(campioni=tot, fuori=bad, quota=round(bad / max(1, tot), 4), auto_fuori=car, nota_auto='la linea della corsia a meno di 0,9 m (mezza auto) dal bordo o fuori',
                    margine_m=_pct(dist, (1, 10, 50)), dove=dove[:30])

    def _resto(s, raw_roads):
        C = s.cover; rep = {}
        # OSM ways without DBGT, DBGT axes without OSM
        sole = []
        for wi in getattr(s, 'sole', []):
            r = raw_roads[wi]; m = r['line'].interpolate(0.5, normalized=True); sole.append(dict(classe=r['hw'], m=round(r['line'].length), link=_link(m.x, m.y)))
        rep['osm_senza_dbgt'] = dict(n=len(sole), metri=sum(o['m'] for o in sole), per_classe=dict(Counter(o['classe'] for o in sole)), elenco=sole[:60])
        used = set()
        for wi, (nk, P, V, M) in s.res.items():
            if nk == 'str': used |= {m[0] for m in M if m is not None}
        senza = []
        for e, a in enumerate(s.D['str']):
            if e in used: continue
            L = LineString(a['xy'])
            if L.length < 5 or not C.intersects(L): continue
            m = L.interpolate(0.5, normalized=True); senza.append(dict(tipo=a.get('ty'), m=round(L.length), link=_link(m.x, m.y)))
        senza.sort(key=lambda o: -o['m'])
        rep['dbgt_senza_osm'] = dict(n=len(senza), metri=sum(o['m'] for o in senza), per_tipo=dict(Counter(o['tipo'] for o in senza)), elenco=senza[:60])
        # drawn sidewalks and squares against AC_PED + AR_STR
        def iou(a, b):
            a, b = a.intersection(C), b.intersection(C); i = a.intersection(b).area; u = a.union(b).area
            return dict(disegnato_m2=round(a.area), dbgt_m2=round(b.area), iou=round(i / u, 3) if u else None)
        sv = s.surf
        rep['marciapiedi_e_piazze_contro_ac_ped'] = iou(_u([sv['sd'], sv['pz']]), _u([g for g, a in s.D['ped'] if a.get('sed') in ('01', None)]))
        rep['asfalto_contro_ac_vei'] = iou(sv['as'], _u(s.asfalto))
        ar = _u([g for g, a in s.D['ar'] if a.get('sed') in ('01', None)]).intersection(C); dis = _u([sv['as'], sv['sd'], sv['pz'], s.md_dbgt]).intersection(C)
        rep['strada_disegnata_contro_ar_str'] = dict(ar_str_m2=round(ar.area), coperta_dal_disegno=round(ar.intersection(dis).area / ar.area, 3) if ar.area else None,
                                                     nota='AR_STR e l unione di AC_VEI, AC_PED e MAN_TR pezzo per pezzo; il disegno ha in piu parcheggi (AC_VEI 0301) e aree pedonali fuori dalla sede stradale')
        return rep

    def sintesi(s):
        c = s.rep.get('controlli', {}); a = s.rep.get('assi', {})
        return dict(vie_abbinate=a.get('vie_abbinate'), nodi_spostati=a.get('nodi_spostati'), spostamento_nodi_m=a.get('spostamento_nodi_m'),
                    **{k: {kk: vv for kk, vv in v.items() if kk not in ('dove', 'elenco')} for k, v in c.items() if isinstance(v, dict)})
