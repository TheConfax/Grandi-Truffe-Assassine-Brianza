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
# Used by build_data.py (a few lines call it, class Strade). To work on it without the whole build: GTA_DUMP_STRADE=file makes build_data.py
# pickle nodes and raw_roads before the matching; Strade(...).assi(raw_roads, nodes) runs on that alone in a few seconds.
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
    # beside a street), the stretch goes to the nearer one on average over the stretch; the other stays OSM there. Decided per pair of ways
    # over all the samples they share, not in 2 m bins one by one: with samples every 3 m a bin caught a third of them, scattered, two ways
    # on either side of the axis won bins by turns, no run of lost samples was long enough and both went onto the axis, their lanes one on
    # top of the other (verifica 24/10: x 91 z 134 for 136 m, the south arm of the via Milano roundabout). A sample is shared when the other
    # way has one within a sample step along the same element. Two one-way ways running opposite ways on opposite sides of the axis, both
    # 1 m or more from it (the two carriageways OSM draws where the DBGT has one wide carriageway and one axis), both keep their OSM line
    on = defaultdict(lambda: defaultdict(list))   # (net, element) -> {way: [(t, sample)]}
    for wi, (nk, P, V, M) in res.items():
        for k, m in enumerate(M):
            if m is not None: on[(nk, m[0])][wi].append((m[1], k))
    share = defaultdict(lambda: defaultdict(list))   # (way a, way b) -> {way: [sample]}
    for key, byw in on.items():
        ws = sorted(byw)
        if len(ws) < 2: continue
        Ts = {w: np.sort(np.array([t for t, _ in byw[w]])) for w in ws}
        for i_ in range(len(ws)):
            for j_ in range(i_ + 1, len(ws)):
                for w, o in ((ws[i_], ws[j_]), (ws[j_], ws[i_])):
                    to = Ts[o]
                    for t, k in byw[w]:
                        j = int(np.searchsorted(to, t)); near = min(abs(to[j - 1] - t) if j > 0 else 1e9, abs(to[j] - t) if j < len(to) else 1e9)
                        if near <= STEP: share[(ws[i_], ws[j_])][w].append(k)
    def side_dir(w, ks):   # median side of the axis (+1 right of the element) and way along it (+1 with it) of the samples ks of way w
        nk, P, V, M = res[w]; rt = nets[nk]; U = _samples(np.array([nodes[n_] for n_ in raw_roads[w]['refs']]))[1]; sd, dr = [], []
        for k in ks:
            e, t, d_, q = M[k]; c = rt.cum[e]; j = min(max(int(np.searchsorted(c, t)) - 1, 0), len(c) - 2); xy = rt.assi[e]['xy']; u = xy[j + 1] - xy[j]
            o = P[k] - q; sd.append(np.sign(u[0] * o[1] - u[1] * o[0])); dr.append(np.sign(u @ U[k]))
        return float(np.median(sd)), float(np.median(dr))
    lost = defaultdict(set); winner = {}; ndual = 0
    for (wa, wb), byw in share.items():
        ka, kb = byw.get(wa, []), byw.get(wb, [])
        if len(ka) < 3 or len(kb) < 3: continue   # a junction: the two ways touch, they do not share a stretch
        da = float(np.mean([res[wa][3][k][2] for k in ka])); db = float(np.mean([res[wb][3][k][2] for k in kb]))
        if raw_roads[wa]['o'] and raw_roads[wb]['o'] and min(da, db) >= 1.0:
            sa, ra = side_dir(wa, ka); sb, rb = side_dir(wb, kb)
            if sa * sb < 0 and ra * rb < 0:
                ndual += 1
                for k in ka: lost[wa].add(k); winner[(wa, k)] = wb
                for k in kb: lost[wb].add(k); winner[(wb, k)] = wa
                continue
        lw, ww, kl = (wb, wa, kb) if db > da else (wa, wb, ka)
        for k in kl: lost[lw].add(k); winner[(lw, k)] = ww
    rep['carreggiate_doppie_osm_su_un_asse'] = ndual
    nconf = 0; conf = []
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
                nconf += 1; wb = raw_roads[winner[(w, run[0])]]; rl = raw_roads[w]; p = P[run[len(run) // 2]]
                conf.append(dict(perde='%s%s' % (rl['hw'], ' o' if rl['o'] else ''), vince='%s%s' % (wb['hw'], ' o' if wb['o'] else ''), m=len(run) * STEP, link=_link(*p)))
    rep['tratti_contesi'] = nconf; rep['tratti_contesi_elenco'] = conf
    rep['buchi_riempiti'] = _riempi(res, nets, lost, cover)
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
    # two ways through the same point of an axis are joined there: the vertices put on the axes are new nodes of each way, and where two ways
    # run through the same DBGT vertex (within 0.3 m) without an OSM node in common there the graph had two nodes in one place, not connected (verifica
    # 24/10: on via Indipendenza the cars from the side street drove 7 m past the junction to the OSM node and turned back)
    from scipy.spatial import cKDTree
    wof = defaultdict(set)
    for wi, r in enumerate(raw_roads):
        if r.get('dbgt'):
            for n_ in r['refs']: wof[n_].add(wi)
    ids = list(wof); par = {i: i for i in ids}
    lev = lambda n_: {(bool(raw_roads[w]['bridge']), bool(raw_roads[w]['tunnel']), raw_roads[w].get('layer', 0)) for w in wof[n_]}
    def root(i):
        while par[i] != i: par[i] = par[par[i]]; i = par[i]
        return i
    for a_, b_ in cKDTree(np.array([nodes[i] for i in ids])).query_pairs(0.3):   # within 0.3 m, one of them put on an axis (of one way too: a way that runs to a node and back)
        i, j = ids[a_], ids[b_]
        if not any(str(k).startswith('dbgt') or k in newpos for k in (i, j)): continue
        if lev(i) != lev(j): continue   # a bridge over a street is not a junction with it
        ri, rj = root(i), root(j)
        if ri != rj: par[ri] = rj
    canon = {}
    groups = defaultdict(list)
    for i in ids: groups[root(i)].append(i)
    for g in groups.values():
        if len(g) < 2: continue
        c = min(g, key=lambda i: (str(i).startswith('dbgt'), str(i)))   # an OSM node (its tags: signals, crossings) before a new one
        for i in g:
            if i != c: canon[i] = c
    nj = 0
    if canon:
        for r in raw_roads:
            if not any(n_ in canon for n_ in r['refs']): continue
            out = []
            for n_ in r['refs']:
                m_ = canon.get(n_, n_)
                if not out or out[-1] != m_: out.append(m_)
            if len(out) >= 2: nj += sum(1 for n_ in r['refs'] if n_ in canon); r['refs'] = out
    rep['nodi_uniti_sugli_assi'] = nj
    # spikes (verifica 24/10: 98 ways turned 150-180 degrees at a vertex where OSM turned less than 40, a car made a U-turn there): the shared
    # node of a junction placed beside or beyond the point where the way's route meets the other way. (a) A, N, A: the detour to N goes when
    # every other way through N passes through A as well, or ends at N within 6 m of A (it ends at A then); (b) a short loop back to a node the way passed (N .. N) goes;
    # (c) a reversal with a leg under 2.5 m: a vertex of this way only goes, a shared node moves onto the line of its neighbours (under 2.5 m)
    nsp = _punte(raw_roads, nodes)
    rep['punte_tolte'] = nsp
    mv = np.array(list(moved.values())) if moved else np.zeros(1)
    rep['nodi_nuovi_lungo_gli_assi'] = nnew
    rep['spostamento_nodi_m'] = dict(p50=round(float(np.percentile(mv, 50)), 2), p90=round(float(np.percentile(mv, 90)), 2), p99=round(float(np.percentile(mv, 99)), 2), max=round(float(mv.max()), 2))
    rep['vie_abbinate'] = dict(Counter(nk for nk, *_ in res.values()))
    rep['tempo_s'] = round(time.time() - t0, 1)
    return rep, res, nets


def _riempi(res, nets, lost, cover, nmax=40):
    """an unmatched run of samples between two matched ones of the same way (not lost to another way) is matched on the route between
    them when the route is about as long as the way there (35% + 6 m longer at most: a cut curve) and every sample of the run has a candidate on it within R_CAND:
    an OSM way drawn straight across a curve of its street (Via Trieste, verifica 24/10: up to 9 m off the axis for 68 m, across the
    sidewalk) stayed unmatched there, the matching preferred the unmatched state to a candidate farther than D_FREE"""
    nf = 0
    for wi, (nk, P, V, M) in res.items():
        rt = nets[nk]; n = len(M); k = 0
        while k < n:
            if M[k] is not None: k += 1; continue
            j = k
            while j < n and M[j] is None: j += 1
            a, b = k - 1, j   # matched samples around the run k..j-1
            k = j
            if a < 0 or b >= n or j - (a + 1) > nmax or any(q in lost.get(wi, ()) for q in range(a + 1, b)): continue
            if not shapely.contains_xy(cover, P[a:b + 1, 0], P[a:b + 1, 1]).all(): continue
            L, how = rt.route(M[a], M[b])
            dk = float(np.hypot(*np.diff(P[a:b + 1], axis=0).T).sum())
            if L == math.inf or L > 1.35 * dk + 6 or L < dk - 6: continue   # the way cuts a curve: the route is longer
            els = {M[a][0], M[b][0]}
            if how[0] != 'same':
                ns = rt.path_nodes(*how) or []
                els |= {rt.edge_of[(min(u, v), max(u, v))] for u, v in zip(ns, ns[1:])}
            Tg = P[a + 2:b + 1] - P[a:b - 1]; Tg = Tg / np.maximum(1e-6, np.hypot(Tg[:, 0], Tg[:, 1]))[:, None]
            C = rt.candidates(P[a + 1:b], Tg)
            pick = []
            for cs in C:
                cs = [c for c in cs if c[0] in els]
                if not cs: break
                pick.append(min(cs, key=lambda c: c[2]))
            if len(pick) != b - a - 1: continue
            for q, c in zip(range(a + 1, b), pick): M[q] = c
            nf += 1
    return nf


def _turn(p, q, r):
    a = (q[0] - p[0], q[1] - p[1]); b = (r[0] - q[0], r[1] - q[1]); la, lb = math.hypot(*a), math.hypot(*b)
    if la < 1e-6 or lb < 1e-6: return 0.0, la, lb
    c = max(-1.0, min(1.0, (a[0] * b[0] + a[1] * b[1]) / (la * lb))); return math.degrees(math.acos(c)), la, lb


def _punte(raw_roads, nodes):
    ways_of = defaultdict(set)
    for wi, r in enumerate(raw_roads):
        for n_ in r['refs']: ways_of[n_].add(wi)
    mine = lambda n_, wi: ways_of[n_] <= {wi}
    nsp = 0
    for wi, r in enumerate(raw_roads):
        if not r.get('dbgt'): continue
        refs = list(r['refs'])
        for _ in range(200):
            if len(refs) < 3: break
            done = False
            for k in range(1, len(refs) - 1):   # (a)
                a_, n_, b_ = refs[k - 1], refs[k], refs[k + 1]
                if a_ != b_ and math.dist(nodes[a_], nodes[b_]) > 0.3: continue
                oth = [w for w in ways_of[n_] if w != wi and a_ not in raw_roads[w]['refs']]
                if oth:   # ways that end at N end at A instead (within 6 m: N was put beside the junction), else N stays
                    if math.dist(nodes[a_], nodes[n_]) > 6 or any(raw_roads[w]['refs'][0] != n_ and raw_roads[w]['refs'][-1] != n_ for w in oth): continue
                    for w in oth:
                        rw = raw_roads[w]['refs']; raw_roads[w]['refs'] = [a_] + rw[1:] if rw[0] == n_ else rw[:-1] + [a_]
                        ways_of[n_].discard(w); ways_of[a_].add(w)
                refs = refs[:k] + refs[k + 2:] if a_ == b_ else refs[:k] + refs[k + 1:]; done = True; break
            if not done:   # (b) a short loop back to a node it passed (N .. N), whose other vertices are this way's or on ways through N too
                for i in range(len(refs) - 2):
                    e = refs[i]
                    j = next((j for j in range(i + 2, min(len(refs), i + 14)) if refs[j] == e), None)
                    if j is None: continue
                    if all(all(e in raw_roads[w]['refs'] for w in ways_of[n_] if w != wi) for n_ in refs[i + 1:j]):
                        refs = refs[:i + 1] + refs[j + 1:]; done = True; break
            if not done:   # (c)
                for k in range(1, len(refs) - 1):
                    a_, n_, b_ = refs[k - 1], refs[k], refs[k + 1]; t, la, lb = _turn(nodes[a_], nodes[n_], nodes[b_])
                    if t < 150 or min(la, lb) > 2.5: continue
                    if mine(n_, wi): refs = refs[:k] + refs[k + 1:]; done = True; break
                    pa, pb, pn = np.array(nodes[a_]), np.array(nodes[b_]), np.array(nodes[n_]); d = pb - pa; L2 = float(d @ d)
                    if L2 < 1e-6: continue
                    q = pa + d * max(0.0, min(1.0, float((pn - pa) @ d) / L2))
                    if math.dist(q, pn) < 2.5: nodes[n_] = (float(q[0]), float(q[1])); done = True; break
            if not done: break
            nsp += 1
        if refs != r['refs']:
            for n_ in set(r['refs']) - set(refs): ways_of[n_].discard(wi)
            r['refs'] = refs
    return nsp


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
        d = np.full(len(P), float(rmax)); alive = np.ones(len(P), bool)   # float: with rmax 25 the distances were cut to whole metres
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
        # for the dividers (build_data.py, barriere.sul_confine): the streets at grade (01 carriageway, 02 junctions and roundabouts) are the
        # zone a wall moves out of onto the edge; a lay-by, a parking lane or a shoulder (04-08, 95) is the other side of that edge, as a yard
        # is; on a bridge (SED 02) a wall at ground level cannot stand and the deck has its own parapets
        s.strade_raso = [g for g, a in D['vei'] if a['zon'][:2] in ('01', '02') and a.get('sed') in ('01', None)]
        s.carr_ponti = [g for g, a in D['vei'] if a.get('sed') not in ('01', None) and a['zon'] not in NON_CARR]
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
    def dividi(s, raw_roads, nodes, new_id, minimo=10.0):
        """a way that runs in and out of the comune is cut where it crosses the boundary (a node there, or the way's node within 2 m): the
        width and the free half width of the DBGT are for the part inside, outside it stays OSM as it was (verifica 24/10: Via della Cavalla,
        855 m outside Meda, had taken 5.2 m instead of 6.5, Via Ventiquattro Maggio a free half width of 1 m for 423 m out of the comune).
        Excursions shorter than minimo m are not cut"""
        C = s.cover; Bd = C.boundary; nnew = 0; ncut = 0
        for wi in range(len(raw_roads)):
            r = raw_roads[wi]
            if not (r['c'] <= 5 or r['hw'] in ('cycleway', 'track', 'path', 'bridleway')) or len(r['refs']) < 2: continue
            if r['x']: continue   # the Milano-Meda stays whole: cut, its town sign at PONTE 20 found no room on the short piece (width there 10 m OSM, 9.8 DBGT)
            xy = np.array([nodes[n_] for n_ in r['refs']]); ins = shapely.contains_xy(C, xy[:, 0], xy[:, 1])
            if ins.all() or not ins.any(): continue
            cum = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
            cuts = []   # (distance along the way, segment index i: between node i-1 and i, point)
            for i in range(1, len(xy)):
                if ins[i] == ins[i - 1]: continue
                p = LineString([xy[i - 1], xy[i]]).intersection(Bd)
                pts = [g for g in getattr(p, 'geoms', [p]) if g.geom_type == 'Point']
                q = min(pts, key=lambda g: g.distance(Point(xy[i - 1]))) if pts else Point((xy[i - 1] + xy[i]) / 2)
                cuts.append((cum[i - 1] + q.distance(Point(xy[i - 1])), i, (q.x, q.y)))
            # drop the cuts around a run shorter than minimo (a way that grazes the boundary)
            while True:
                bounds = [0.0] + [c[0] for c in cuts] + [cum[-1]]; runs = np.diff(bounds)
                k = int(np.argmin(runs)) if len(runs) else -1
                if not cuts or runs[k] >= minimo: break
                if k == 0: cuts.pop(0)
                elif k == len(runs) - 1: cuts.pop()
                else: del cuts[k - 1:k + 1]
            if not cuts: continue
            refs = list(r['refs']); out = []; cur = [refs[0]]; ci = 0
            for i in range(1, len(refs)):
                while ci < len(cuts) and cuts[ci][1] == i:
                    d0, _, q = cuts[ci]; ci += 1
                    if d0 - cum[i - 1] < 2.0 and len(cur) > 1: out.append(cur); cur = [cur[-1]]; continue     # the node before is on the boundary
                    if cum[i] - d0 < 2.0: break                                                             # the node after: cut there
                    nid = new_id(); nodes[nid] = (float(q[0]), float(q[1])); cur.append(nid); out.append(cur); cur = [nid]; nnew += 1
                else:
                    cur.append(refs[i]); continue
                cur.append(refs[i]); out.append(cur); cur = [refs[i]]
            if len(cur) > 1: out.append(cur)
            out = [p for p in out if len(p) > 1]
            if len(out) < 2: continue
            r['refs'] = out[0]; r['parte'] = wi   # the pieces of one way know each other (build_data.py _cl_free: a sibling is not another road)
            for p in out[1:]: raw_roads.append(dict(r, refs=p))
            ncut += 1
        s.rep['vie_tagliate_al_confine'] = dict(vie=ncut, nodi_nuovi=nnew)
        s.log('dbgt strade: vie tagliate al confine del comune %d (nodi nuovi %d)' % (ncut, nnew))

    def privati(s, raw_roads, nodes, new_id=None):
        """the streets OSM maps over a yard of the DBGT (AC_VEI 0307: inside a private area, no EL_STR axis there) carry no AI traffic: more
        than half of the way in a yard and not in a carriageway (verifica 24/10: 26 residential ways, the cul-de-sacs of Via della Vigna, Via
        Federico Borromeo, Via Martiri di Bologna...). A way that ends in a yard (a run of 12 m or more to its first or last node: Via Arno,
        Via Vignola, Via Piermarini, Via del Ry, verifica 24/10; no Mapillary photo within 30 m of any) is cut where the yard begins and the
        piece in the yard has no AI traffic either. The player still drives there"""
        CO = s.R.draw(s.cortili); out = []; tails = []
        for wi in range(len(raw_roads)):
            r = raw_roads[wi]; r.pop('pv', None)
            if r['c'] > 3 or len(r['refs']) < 2: continue
            xy = np.array([nodes[n_] for n_ in r['refs']]); P, U, V = _samples(xy)
            inc = shapely.contains_xy(s.cover, P[:, 0], P[:, 1])
            if inc.sum() < 3: continue
            yard = s.R.at(CO, P[:, 0], P[:, 1]) & ~s.R.at(s.CV, P[:, 0], P[:, 1]) & inc
            if yard.sum() >= 5 and yard.sum() >= 0.5 * len(P):
                r['pv'] = 1; m = P[len(P) // 2]; out.append(_link(*m)); continue
            if new_id is None or not yard.any(): continue
            cum = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
            a = 0
            while a < len(P) and yard[a]: a += 1
            b = len(P) - 1
            while b >= 0 and yard[b]: b -= 1
            cut0 = cum[a] if a >= 4 and a < len(P) else None             # a yard from the first node to here
            cut1 = cum[b] if len(P) - 1 - b >= 4 and b >= 0 else None    # from here to the last node
            if cut0 is not None and cut1 is not None and cut1 - cut0 < 10: continue
            for c_ in ([cut1] if cut1 is not None else []) + ([cut0] if cut0 is not None else []):   # the far cut first: the near one keeps its index
                k = s._taglia(raw_roads, wi, c_, nodes, new_id)
                if k is None: continue
                tail = k if c_ == cut1 else wi
                raw_roads[tail]['pv'] = 1; q = nodes[raw_roads[tail]['refs'][len(raw_roads[tail]['refs']) // 2]]; tails.append(_link(*q))
        s.rep['vie_nei_cortili_senza_traffico'] = dict(n=len(out), dove=out[:40], code_nei_cortili=len(tails), dove_code=tails[:40])
        s.log('dbgt strade: vie nei cortili senza traffico IA %d, code di vie nei cortili %d' % (len(out), len(tails)))

    def _taglia(s, raw_roads, wi, d, nodes, new_id):
        """way wi cut at d m from its start (at its node when one is within 1.5 m, else a new node): wi keeps the first piece, the second is
        appended; its index is returned (None when the cut falls at an end)"""
        r = raw_roads[wi]; refs = list(r['refs']); xy = np.array([nodes[n_] for n_ in refs]); cum = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
        if d < 1.5 or d > cum[-1] - 1.5: return None
        j = int(np.argmin(np.abs(cum - d)))
        if abs(cum[j] - d) < 1.5 and 0 < j < len(refs) - 1: a, b = refs[:j + 1], refs[j:]
        else:
            i = int(np.searchsorted(cum, d)); f_ = (d - cum[i - 1]) / max(cum[i] - cum[i - 1], 1e-9); p = xy[i - 1] + (xy[i] - xy[i - 1]) * f_
            nid = new_id(); nodes[nid] = (float(p[0]), float(p[1])); a, b = refs[:i] + [nid], [nid] + refs[i:]
        r['refs'] = a; r.setdefault('parte', wi); raw_roads.append(dict(r, refs=b)); return len(raw_roads) - 1

    def assi(s, raw_roads, nodes):
        cnt = [0]
        def new_id(): cnt[0] += 1; return 'dbgt%d' % cnt[0]
        s.dividi(raw_roads, nodes, new_id)
        s.orig = {i: [nodes[n_] for n_ in r['refs']] for i, r in enumerate(raw_roads)}
        refs0 = {i: list(r['refs']) for i, r in enumerate(raw_roads)}; pos0 = dict(nodes)
        rep, res, nets = abbina(raw_roads, nodes, s.D, s.cover, s.log, new_id)
        s.res, s.nets = res, nets
        rep['anelli_osm'] = s.anelli(raw_roads, nodes, refs0, pos0)
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
            dw.append(wm - r['w']); r['w_osm'] = r['w']; r['w'] = round(wm, 1); r['wx'] = True; nw += 1
            # the free half width: p5 of the distance to the nearer edge where the axis runs in the middle of its carriageway (|dl - dr| under
            # half the larger): where it runs off centre (the mouth of a junction, a stretch the matching left) it is not the lane's room, and
            # taken in it gave 28 two-way streets a free half width of 1 m (lanes 0.5 m from the axis, no centre line; verifica 24/10)
            d_, dl_, dr_ = np.minimum(dl, dr)[ok], dl[ok], dr[ok]; mid = np.abs(dl_ - dr_) < 0.5 * np.maximum(dl_, dr_)
            r['mh_dbgt'] = round(float(max(1.0, np.percentile(d_[mid] if mid.sum() > 3 else d_, 5))), 2)
        rep['larghezze_da_ac_vei'] = dict(vie=nw, differenza_dalla_larghezza_osm_m=_pct(dw, (10, 50, 90)))
        s.privati(raw_roads, nodes, new_id)
        s.rep['assi'] = rep
        s.log('dbgt strade: %s' % {k: v for k, v in rep.items() if k != 'tratti_contesi_elenco'})

    def anelli(s, raw_roads, nodes, refs0, pos0):
        """the ring of a roundabout the DBGT draws as chords (EL_STR straight across from one arm to the next round an island MAN_TR: the
        mini roundabout by the centre at x -77 z -858, the one at x 1670 z -855): matched on them the ring turned 50-180 degrees at its
        corners and the cars cut across. A one-way way round an island (all its OSM points between the island's radius and 15 m beyond it,
        round at least 20 degrees of a round island) keeps its OSM line, its nodes where OSM has them (the arms end on the ring), when one of
        the ways round that island (45 degrees or more of it) came out of the matching turning by more than 35 degrees at a vertex where OSM
        turns less than 30: the DBGT has no axis for the ring"""
        isl = []
        for g in s.isole:   # round ones: the centre of a roundabout, not a splitter island or a median (4 pi A / P^2 at least 0.7)
            if 4 * math.pi * g.area / g.length ** 2 < 0.7: continue
            c = g.centroid; isl.append((c.x, c.y, math.sqrt(g.area / math.pi)))
        if not isl: return 0
        I = np.array(isl); used = Counter(n_ for r in raw_roads for n_ in r['refs']); back = []
        def maxturn(pts):
            t = [_turn(pts[k - 1], pts[k], pts[k + 1])[0] for k in range(1, len(pts) - 1) if math.dist(pts[k - 1], pts[k]) > 0.5 and math.dist(pts[k], pts[k + 1]) > 0.5]
            return max(t) if t else 0.0
        ring = defaultdict(list); bad = set()   # island -> the one-way ways round it; islands where one of them came out cornered
        for wi, r in enumerate(raw_roads):
            if r.get('dbgt') != 'str' or not r['o'] or wi not in refs0: continue
            o = np.array([pos0[n_] for n_ in refs0[wi]])
            d = np.hypot(o[:, None, 0] - I[None, :, 0], o[:, None, 1] - I[None, :, 1]); j = int(np.argmin(d.max(0)))
            cx, cz, ri = I[j]
            if not (d[:, j].min() > ri * 0.8 and d[:, j].max() < ri + 15): continue
            ang = np.unwrap(np.arctan2(o[:, 1] - cz, o[:, 0] - cx))
            if abs(ang[-1] - ang[0]) < math.radians(20): continue
            ring[j].append(wi)
            if abs(ang[-1] - ang[0]) >= math.radians(45) and maxturn([nodes[n_] for n_ in r['refs']]) > 35 and maxturn([tuple(p) for p in o]) < 30: bad.add(j)
        for j in bad:
            for wi in ring[j]:
                r = raw_roads[wi]
                for n_ in refs0[wi]: nodes[n_] = pos0[n_]   # the ring where OSM has it, its junctions with the arms too: the arms end on it
                r['refs'] = list(refs0[wi]); r.pop('dbgt', None); r.pop('match', None)
            back.append(_link(I[j][0], I[j][1]))
        s.log('dbgt strade: rotatorie con l anello OSM %d %s' % (len(back), back[:10]))
        return dict(n=len(back), dove=back)

    def mezze(s, raw_roads, nodes=None):
        """the free half width of a matched street is its carriageway's (the lanes stay inside AC_VEI)"""
        for r in raw_roads:
            if r.get('mh_dbgt'): r['mh'] = round(min(r['w'] / 2, r['mh_dbgt']), 2)
        if nodes is not None: s.corsie_locali(raw_roads, nodes)

    def corsie_locali(s, raw_roads, nodes, passo=1.0, rmax=12.0):
        """the lane lines of the AI cars node by node (r['lf'] forward, r['lb'] backward: cm right of the axis at each node of refs; an edge
        runs from the value at its start to the value at its end, world3.js edgePts): from the carriageway across the axis (AC_VEI of the
        ordinary stretches), not from the axis alone. EL_STR does not always run in the middle of its carriageway (via Seveso by the station
        1 m from the east edge of 7 m; on via Indipendenza it crosses the carriageway on a 40 m straight), and a carriageway narrows or
        widens along a street: with one offset for the whole way 3.3% of the lane samples were less than half a lane from the edge
        (verifica 24/10). Samples every passo m across the ordinary carriageway (a sample where it opens to the side, wider than 1.25 times
        the way's median or 1.3 times its width, is not one): its middle c and width W, running medians over 15 m, at each node the value
        along the way there (a node more than 6 m from any sample, in a junction, keeps the old lane). Two-way: each direction
        0.2 W right of the middle (W the p25 over 15 m), at least 0.9 m, at most W / 2 - 1 m, 0.3-2 m; one-way: the middle. Where another street
        with traffic runs alongside in the same carriageway it ends halfway between the two axes (bound)"""
        nl = 0; nsh = 0
        # the axes of the other streets with traffic: a carriageway two of them run in (two one-way carriageways OSM draws where the DBGT has
        # one, a street and its parallel ramp) is shared at the line halfway between their axes, else both lanes went to its middle, one on
        # the other (verifica 24/10: 409 m of lanes of opposite ways closer than 1.8 m, 42 before the work)
        segs, own, sdir = [], [], []
        for ri, r in enumerate(raw_roads):
            if r['c'] > 3 or r.get('pv') or len(r['refs']) < 2: continue
            xy = np.array([nodes[n_] for n_ in r['refs']])
            for a, b in zip(xy[:-1], xy[1:]):
                L = math.hypot(*(b - a))
                if L > 0.05: segs.append((a, b)); own.append(r.get('parte', ri)); sdir.append((b - a) / L)
        SA = np.array([s[0] for s in segs]); SB = np.array([s[1] for s in segs]); own = np.array(own); sdir = np.array(sdir)
        ST = STRtree(shapely.linestrings(np.stack((SA, SB), 1)))
        def bound(ri, P, U, N):   # distance right and left of each sample to halfway to the axis of another street running alongside (inf if none)
            br, bl = np.full(len(P), np.inf), np.full(len(P), np.inf)
            qi, qj = ST.query(shapely.points(P), predicate='dwithin', distance=2 * rmax)
            if not len(qi): return br, bl
            keep = (own[qj] != ri) & (np.abs((sdir[qj] * U[qi]).sum(1)) > 0.85); qi, qj = qi[keep], qj[keep]
            a, d = SA[qj], SB[qj] - SA[qj]; n_ = N[qi]; p = P[qi]
            den = n_[:, 0] * d[:, 1] - n_[:, 1] * d[:, 0]; ok = np.abs(den) > 1e-6
            w_ = a - p; s_ = (w_[:, 0] * d[:, 1] - w_[:, 1] * d[:, 0]) / np.where(ok, den, 1); t_ = (w_[:, 0] * n_[:, 1] - w_[:, 1] * n_[:, 0]) / np.where(ok, den, 1)
            ok &= (t_ >= 0) & (t_ <= 1) & (np.abs(s_) > 0.5)
            for i_, s__ in zip(qi[ok], s_[ok]):
                if s__ > 0: br[i_] = min(br[i_], s__ / 2)
                else: bl[i_] = min(bl[i_], -s__ / 2)
            return br, bl
        for ri, r in enumerate(raw_roads):
            r.pop('lf', None); r.pop('lb', None)
            if r['c'] > 3 or r.get('dbgt') != 'str' or len(r['refs']) < 2: continue
            xy = np.array([nodes[n_] for n_ in r['refs']]); P, U, Sx = [], [], []
            cum = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
            for i in range(len(xy) - 1):
                a, b = xy[i], xy[i + 1]; d = b - a; L = cum[i + 1] - cum[i]
                if L < 1e-6: continue
                n = max(1, int(round(L / passo)))
                for k in range(n): f_ = (k + 0.5) / n; P.append(a + d * f_); U.append(d / L); Sx.append(cum[i] + L * f_)
            if len(P) < 3: continue
            P, U, Sx = np.array(P), np.array(U), np.array(Sx); N = np.column_stack((-U[:, 1], U[:, 0]))
            dr, dl = s.R.ray(s.TR, P, N, rmax), s.R.ray(s.TR, P, -N, rmax)   # N = (-uz, ux) is the right of the way (x east, z south; edgePts)
            ok0 = (dl < rmax) & (dr < rmax)
            br, bl = bound(r.get('parte', ri), P, U, N); sh = (br < dr) | (bl < dl); nsh += int(sh.any())
            dr, dl = np.minimum(dr, br), np.minimum(dl, bl)
            Wd = dl + dr; c = (dr - dl) / 2
            ok = s.R.at(s.TR, P[:, 0], P[:, 1]) & shapely.contains_xy(s.cover, P[:, 0], P[:, 1]) & ok0 & (Wd >= 2.4)
            if ok.sum() < 3: continue
            ok &= Wd <= min(1.25 * np.median(Wd[ok]), 1.3 * r['w']) + 0.5
            if ok.sum() < 3: continue
            vi = np.where(ok)[0]
            sm = lambda v: np.array([np.median(v[vi[max(0, j - 7):j + 8]]) for j in range(len(vi))])
            cn, Wn = np.interp(cum, Sx[vi], sm(c)), np.interp(cum, Sx[vi], sm(Wd))
            Wq = np.interp(cum, Sx[vi], np.array([np.percentile(Wd[vi[max(0, j - 7):j + 8]], 25) for j in range(len(vi))]))   # the narrower part of the 15 m
            lane0 = 0.0 if r['o'] else min(r['w'] * 0.24, r['mh'] * 0.5)
            # 0.2 W right of the middle (W the p25 over 15 m), 0.9 at least (two cars side by side), the car's body inside (W / 2 - 1 m), 0.3-2 m. Capped at the old lane as well
            # (min(0.24 w, mh / 2), mh the p5 of the room) the two lanes of 5-6 m streets came 1.6-1.8 m apart, the cars of the two ways one on
            # the other (verifica 24/10: Via Como, 5.8 m, lanes 1.68 m apart for 1 km); 0.22 W and 0.25 W put more lanes within half a lane
            # of the edge (3.4 and 6.4% of the samples, 2.4% so) for fewer close lanes on the narrowest streets
            hl = np.clip(np.minimum(0.5 * Wq - 1.0, np.maximum(0.2 * Wq, 0.9)), 0.3, 2.0)
            out = [np.clip(cn, -4.0, 4.0)] if r['o'] else [np.clip(cn + hl, 0.3, 5.0), np.clip(hl - cn, 0.3, 5.0)]
            far = np.abs(cum[:, None] - Sx[vi][None, :]).min(1) > 6.0   # a node in a junction, away from any ordinary carriageway: the old lane
            for o in out: o[far] = lane0
            if all(np.abs(o - lane0).max() < 0.1 for o in out): continue
            r['lf'] = [int(round(v * 100)) for v in out[0]]
            if not r['o']: r['lb'] = [int(round(v * 100)) for v in out[1]]
            nl += 1
        s.rep['corsie_locali'] = dict(vie=nl, carreggiate_condivise=nsh)
        s.log('dbgt strade: corsie IA dalla carreggiata, vie %d (carreggiata condivisa con un altra via %d)' % (nl, nsh))

    def carreggiate(s, buf=0.0, strade=False):
        """the carriageway pieces inside the comuni (buffered): nothing stands or is built in them. Shrunk, the union is shrunk (shrinking
        each piece left a strip along the edges between two pieces where a wall crossing the street survived). strade: only the streets at
        grade (strade_raso), the zone the dividers move out of"""
        if strade:
            if not hasattr(s, 'U_raso'): s.U_raso = _u(s.strade_raso)
            if not buf: return list(s.strade_raso)
        if buf < 0:  # cut in 50 m squares: united the network is one polygon as big as the town, and cutting a wall against it is slow
            U = (s.U_raso if strade else s.U_carr).buffer(buf, join_style=2); x0, z0, x1, z1 = U.bounds; out = []
            sq = [box(x, z, x + 50, z + 50) for x in np.arange(x0, x1, 50) for z in np.arange(z0, z1, 50)]
            for b, g in zip(sq, shapely.intersection(U, np.array(sq, dtype=object))): out += [p for p in _parts(g) if p.area > 0.5]
            return out
        return [g.buffer(buf, join_style=2) if buf else g for g in (s.strade_raso if strade else s.carr)]

    def bordi_interni(s, buf=0.3):
        """the edges two streets at grade share (strade_raso, as the DBGT cuts them), buffered: a divider standing on one is on the line
        between two zones and stays there (a wall between a street and the service road beside it, x 1567 z −998 at Meda); where a street runs
        through it, the way opens it (barriere.passaggi)"""
        if not hasattr(s, '_bi'):
            P = s.strade_raso; T = STRtree(P) if P else None; E = []
            for i, g in enumerate(P):
                for j in T.query(g.buffer(0.1)):
                    if j <= i: continue
                    x = g.boundary.intersection(P[j].buffer(0.05))
                    if x.length > 1: E.append(x)
            s._bi = _u([e.buffer(buf, cap_style=2) for e in E]); shapely.prepare(s._bi)
        return s._bi

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

    def attraversamento(s, x, z, ux, uz, w):
        """a zebra crossing at (x, z) across a street running (ux, uz): its middle and width, edge to edge of the carriageway there. The
        game draws it symmetric about its middle; centred on the axis with the larger side twice (larghezza_locale) the stripes ran onto
        the sidewalk where the axis is off the middle of the carriageway (verifica 24/10: 53 crossings 0.5-3 m on a sidewalk, 18 before
        the work). A side that runs on more than w/2 + 3 m (the mouth of a junction) counts w/2"""
        if not s.R.at(s.CV, [x], [z])[0]: return x, z, w
        P = np.array([[x, z]]); N = np.array([[-uz, ux]])
        dl, dr = float(s.R.ray(s.CV, P, N, 25)[0]), float(s.R.ray(s.CV, P, -N, 25)[0]); lim = w / 2 + 3
        dl, dr = (dl if dl < lim else w / 2), (dr if dr < lim else w / 2)
        sh = (dl - dr) / 2
        return round(x - uz * sh, 1), round(z + ux * sh, 1), round(max(2.5, dl + dr), 1)

    def togli_cortili(s, cantieri):
        """the yards inside an OSM building site (landuse=construction) are gone since the survey (Meda 2015), as the green and the trees
        of the DBGT there (dbgt_verde.py cons): the site keeps its own ground (unione di strade e verde, 24/10: the site with the crane
        along the Milano-Meda was a grey yard with patches of earth)"""
        if cantieri is None or cantieri.is_empty or s.cv.is_empty: return
        a0 = s.cv.area; s.cv = s.cv.difference(cantieri)
        s.rep['superfici']['cortili_nei_cantieri_m2'] = round(a0 - s.cv.area); s.rep['superfici']['cortili_m2'] = round(s.cv.area)
        s.log('dbgt strade: cortili tolti nei cantieri OSM %d m2' % round(a0 - s.cv.area))

    def push_tiles(s, ntiles, tbox, polys_of, push):
        """the yards (cv), the islands and medians of the DBGT (md with g: 1, drawn whatever their size; v: 1 grass on top) and the carriageways
        on bridges (ap, only for what keeps off the carriageway) in the tiles.
        Grass or paved: MAN_TR_VRD is empty at Meda; on the Mapillary photos of 10 islands and medians (strade/mly_man) 8 are grass or a hedge
        behind a kerb, the small ones paved: grass from ISOLA_VERDE m2 up"""
        P1 = _parts(s.cv); P2 = [p for p in _parts(s.md_dbgt) if p.area >= ISOLA_VERDE]; P3 = [p for p in _parts(s.md_dbgt) if p.area < ISOLA_VERDE]
        # ap: the carriageways on the bridges (AC_VEI SED 02; the deck draws its own top): the guardrails of the ramps keep out of them (verifica
        # 24/10: 20 pieces in them on the decks of the Milano-Meda junction)
        P4 = _parts(_u([g for g, a in s.D['vei'] if a.get('sed') not in ('01', None) and a['zon'] not in NON_CARR]).intersection(s.cover))
        T1, T2, T3, T4 = (STRtree(P_) if P_ else None for P_ in (P1, P2, P3, P4))
        for t in range(ntiles):
            bx = tbox(t)
            for P_, T_, key, extra in ((P1, T1, 'cv', {}), (P2, T2, 'md', {'g': 1, 'v': 1}), (P3, T3, 'md', {'g': 1}), (P4, T4, 'ap', {})):
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
            # x, z only: the trees carry height and crown too (dbgt_manufatti)
            pts = np.asarray([tuple(q)[:2] for q in pts], float).reshape(-1, 2); m = dentro(pts); rep[nm + '_in_carreggiata'] = dict(n=int(m.sum()), di=len(pts), dove=elenco(pts, m))
        # town signs: the two posts as paesaggio3.js puts them, w/2 + 1.2 m right of each driver, 3 m before and after
        posts = []
        for c in cartelli:
            x, z, ux, uz, w = c[0] / 10, c[1] / 10, c[2], c[3], c[4]; rx, rz, off = -uz, ux, w / 2 + 1.2
            posts += [(x - ux * 3 + rx * off, z - uz * 3 + rz * off), (x + ux * 3 - rx * off, z + uz * 3 - rz * off)]
        m = dentro(posts); rep['pali_dei_cartelli_in_carreggiata'] = dict(n=int(m.sum()), di=len(posts), dove=elenco(posts, m))
        # barriers: length inside a street at grade (deeper than 0.3 m). Not the lay-bys, parking lanes and shoulders (AC_VEI 04-08, 95): a
        # wall moved out of the street stands on their edge (barriere.sul_confine), and on the edges two streets share (bordi_interni)
        if not hasattr(s, 'U_raso'): s.U_raso = _u(s.strade_raso)
        inner = s.U_raso.buffer(-0.3).difference(s.bordi_interni()); shapely.prepare(inner); nb, lb, dove = 0, 0.0, []
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
        rep['corsie_di_fronte'] = s.frontali(raw_roads, nodes)
        # AI traffic over the yards (AC_VEI 0307 outside any carriageway): the ways with AI traffic, metres in a yard
        CO = s.R.draw(s.cortili); ny, my, dv = 0, 0.0, []
        for r in raw_roads:
            if r['c'] > 3 or r.get('pv') or len(r['refs']) < 2: continue
            xy = np.array([nodes[n_] for n_ in r['refs']]); P, U, V = _samples(xy)
            yd = s.R.at(CO, P[:, 0], P[:, 1]) & ~s.R.at(s.CV, P[:, 0], P[:, 1]) & shapely.contains_xy(C, P[:, 0], P[:, 1])
            if yd.sum() >= 4: ny += 1; my += STEP * yd.sum(); dv.append(_link(*P[yd][len(P[yd]) // 2]))
        rep['traffico_nei_cortili'] = dict(n=ny, metri=round(my), nota='vie con traffico IA per 12 m o piu sopra un cortile AC_VEI 0307', dove=dv[:20])
        rep.update(s._resto(raw_roads))
        rep['attraversamenti'] = dict(n=len(attraversamenti))
        rep['tempo_s'] = round(time.time() - t0, 1)
        s.rep['controlli'] = rep
        s.log('dbgt strade: controlli ' + ', '.join('%s %s' % (k, v.get('n', v.get('quota', v.get('iou')))) for k, v in rep.items() if isinstance(v, dict)))
        return s.rep

    def corsie(s, raw_roads, nodes):
        """lanes inside AC_VEI: the lane line of the AI cars (axis + r.lane, or r.lf / r.lb of the segment, to the right, as world3.js) at least half a lane from the edge
        (half the lane width, at most 1.5 m, minus 0.25), on the ordinary stretches: in junctions the lanes are virtual"""
        C = s.cover; tot = bad = car = 0; dove = []; dist = []; why = Counter(); deg = Counter()
        for r in raw_roads:
            if r['c'] <= 5:
                for k, n_ in enumerate(r['refs']): deg[n_] += 1 if k in (0, len(r['refs']) - 1) else 2
        J = np.array([nodes[n_] for n_, d_ in deg.items() if d_ >= 3]).reshape(-1, 2); JT = STRtree(shapely.points(J))
        for r in raw_roads:
            if r['c'] > 3 or r.get('dbgt') != 'str': continue
            xy = np.array([nodes[n_] for n_ in r['refs']]); P, U, V = _samples(xy)
            if len(P) < 2: continue
            ins = s.R.at(s.TR, P[:, 0], P[:, 1]) & shapely.contains_xy(C, P[:, 0], P[:, 1])
            if not ins.any(): continue
            lane = 0.0 if r['o'] else min(r['w'] * 0.24, r['mh'] * 0.5); half = min(1.5, (r['w'] if r['o'] else r['w'] / 2) / 2)
            N = np.column_stack((-U[:, 1], U[:, 0]))   # the right of the way
            cum = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]; sP = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
            for sg, key in ((1, 'lf'), (-1, 'lb'))[:1 if r['o'] else 2]:
                off = np.interp(sP, cum, np.asarray(r[key], float) / 100) if r.get(key) else np.full(len(P), lane)   # the lanes node by node (corsie_locali)
                Q = P[ins] + N[ins] * (off[ins] * sg)[:, None]; inq = shapely.contains_xy(s.U_carr, Q[:, 0], Q[:, 1])
                d = s.bordi.query_nearest(shapely.points(Q), return_distance=True, all_matches=False)[1] if len(Q) else np.zeros(0); d[~inq] = 0
                b = d < half - 0.25; tot += len(Q); bad += int(b.sum()); car += int((d < 0.9).sum()); dist += list(d - half)
                for q in Q[b][:2]: dove.append(_link(*q))
                if b.any():   # why: by a junction (a node of 3 ways within w/2 + 8 m), where the carriageway is narrower than the way's width by 0.75 m
                    Pb, Nb = P[ins][b], N[ins][b]; dj = JT.query_nearest(shapely.points(Pb), return_distance=True, all_matches=False)[1]
                    Wl = s.R.ray(s.TR, Pb, Nb, 12.0) + s.R.ray(s.TR, Pb, -Nb, 12.0)
                    for dj_, wl_ in zip(dj, Wl): why['incrocio' if dj_ < r['w'] / 2 + 8 else 'strettoia' if wl_ < r['w'] - 0.75 else 'altro'] += 1
        return dict(campioni=tot, fuori=bad, quota=round(bad / max(1, tot), 4), fuori_per_motivo=dict(why), auto_fuori=car, nota_auto='la linea della corsia a meno di 0,9 m (mezza auto) dal bordo o fuori',
                    margine_m=_pct(dist, (1, 10, 50)), dove=dove[:30])

    def frontali(s, raw_roads, nodes, lim=1.8):
        """lanes of opposite ways closer than lim m (cars of the two ways one on the other), away from junctions (8 m from a node of 3 ways):
        of two different streets (two carriageways on one axis, verifica 24/10) and the two lanes of one two-way street (narrow streets)"""
        from scipy.spatial import cKDTree
        deg = Counter()
        for r in raw_roads:
            if r['c'] <= 5:
                for k, n_ in enumerate(r['refs']): deg[n_] += 1 if k in (0, len(r['refs']) - 1) else 2
        P, U, W = [], [], []
        for wi, r in enumerate(raw_roads):
            if r['c'] > 3 or r.get('pv') or len(r['refs']) < 2: continue
            g = r['refs']; xy = np.array([nodes[n_] for n_ in g]); lane = 0.0 if r['o'] else min(r['w'] * 0.24, r['mh'] * 0.5)
            lf = r.get('lf') if r.get('lf') and len(r['lf']) == len(g) else None; lb = r.get('lb') if r.get('lb') and len(r['lb']) == len(g) else None
            for k in range(1, len(g)):
                sides = [(xy[k - 1], xy[k], lf[k - 1] / 100 if lf else lane, lf[k] / 100 if lf else lane, g[k - 1], g[k])]
                if not r['o']: sides.append((xy[k], xy[k - 1], lb[k] / 100 if lb else lane, lb[k - 1] / 100 if lb else lane, g[k], g[k - 1]))
                for p, q, oa, ob, na, nb in sides:
                    d = q - p; L = math.hypot(*d)
                    if L < 0.5: continue
                    u = d / L; R = np.array([-u[1], u[0]])
                    for t in (np.arange(max(1, int(L))) + 0.5) / max(1, int(L)):
                        if (deg[na] >= 3 and t * L < 8) or (deg[nb] >= 3 and (1 - t) * L < 8): continue
                        P.append(p + d * t + R * (oa + (ob - oa) * t)); U.append(u); W.append(r.get('parte', wi))
        if not P: return {}
        P, U, W = np.array(P), np.array(U), np.array(W); ins = shapely.contains_xy(s.cover, P[:, 0], P[:, 1]); P, U, W = P[ins], U[ins], W[ins]
        pr = np.array(list(cKDTree(P).query_pairs(lim))).reshape(-1, 2); i, j = pr[:, 0], pr[:, 1]; opp = (U[i] * U[j]).sum(1) < -0.7
        dv = (W[i] != W[j]) & opp; sv = (W[i] == W[j]) & opp
        dove = [_link(*P[a]) for a in i[dv][::max(1, int(dv.sum()) // 20)][:20]]
        return dict(n=len(set(i[dv]) | set(j[dv])), campioni=len(P), vie_diverse=len(set(i[dv]) | set(j[dv])), stessa_via=len(set(i[sv]) | set(j[sv])), nota='punti di corsia (1 m) con una corsia di verso opposto a meno di %.1f m, lontano dagli incroci' % lim, dove=dove)

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
        return dict(vie_abbinate=a.get('vie_abbinate'), nodi_spostati=a.get('nodi_spostati'), spostamento_nodi_m=a.get('spostamento_nodi_m'), muri_sul_confine=s.rep.get('muri_sul_confine'),
                    **{k: {kk: vv for kk, vv in v.items() if kk not in ('dove', 'elenco')} for k, v in c.items() if isinstance(v, dict)})
