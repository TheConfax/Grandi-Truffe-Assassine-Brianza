# Le corsie delle auto IA lontano dagli ostacoli, per ogni comune (docs/motore.md 7, "corsie IA", 26/10). After the walls, fences, gates
# and buildings are final (build_data.py), every lane of the AI traffic (the line the game draws from node to node: the axis moved to the
# right by r.lf / r.lb, or by r.lane, world3.js edgePts) is checked against them, with or without a DBGT:
#   - each point of a lane at least SPAZIO from an obstacle (half the widest car, 1.01 m, and a margin): where it is closer the lane moves
#     away across the street, node by node, as long as it stays on the asphalt (where the data have it, inside a comune with a DBGT: the
#     asphalt the game draws and the paved yards; else the OSM width), preferably BORDO inside its edge and, on a two-way street, META
#     right of the middle of the carriageway (dbgt_strade corsie_locali; else the middle of the asphalt across, or the axis)
#   - where it cannot (a wall across the street, a dead end in a yard's wall, a lane off the asphalt), and where a two-way street leaves
#     less than 2 META between the lanes of its two ways for STRETTA m (walls closer than about 3.7 m), that stretch has no AI traffic and
#     the lanes on either side stop PRIMA before it: the car turns round there as at the end of any dead end (game.src.html extendRoute).
#     A dead end stops PRIMA before the obstacle ahead of it
#   - a one-way street left running into one of those cuts loses its traffic back to the last junction, and a scrap of street left alone
#     between cuts (shorter than MIN_RETE) too
# Nothing here knows a comune: the obstacles, the asphalt and the area it covers come from build_data.py.
# Out, on the ways: lf / lb (cm right of the axis at each node, as before; written where they differ from the plain r.lane), nt (the
# segments k, from refs[k-1] to refs[k], without AI traffic) and the nodes added where a stretch is cut; the report.
import math
from collections import defaultdict, Counter
import numpy as np, shapely
from shapely.strtree import STRtree

SPAZIO = 1.25        # the lanes move until every point is this far from an obstacle (the check after, SPAZIO_TAGLIO, has a little slack)
SPAZIO_TAGLIO = 1.15 # closer than this after moving: the stretch has no traffic
META = 0.6           # two-way: each lane this far right of the middle when there is room (the two lanes 1.2 m apart)
STRETTA = 3.0        # two-way: where the room between the obstacles leaves the two lanes closer than 2 META for this long, no traffic (too narrow for two cars)
BORDO = 1.0          # and this far inside the edge of the asphalt when there is room (the car's body on it)
PRIMA = 3.5          # the lanes stop this far before a stretch without traffic, and a dead end this far before its obstacle
PASSO = 1.0          # samples along the axis for moving the lanes
PASSO_PROVA = 0.5    # ... and along the lanes for the check
FETTA = SPAZIO       # the obstacles across a sample: the pieces of them within this distance along the way
LARGO = 8.0          # ... and this far across
MIN_RETE = 40.0      # a piece of network cut off between cuts, shorter than this (m of axis), has no traffic
ITER = 150


def _link(x, z): return '?x=%.0f&z=%.0f' % (x, z)


def _libero(forb, ref, lo, hi):
    """the free interval of [lo, hi] (not in any of the forbidden intervals) that holds ref, or the nearest one; None if none"""
    if lo > hi: return None
    cur = lo; free = []
    for a, b in sorted(f for f in forb if f[1] > lo and f[0] < hi):
        if a > cur: free.append((cur, min(a, hi)))
        cur = max(cur, b)
        if cur >= hi: break
    if cur <= hi: free.append((cur, hi))
    if not free: return None
    r = min(max(ref, lo), hi)
    return min(free, key=lambda f: 0.0 if f[0] <= r <= f[1] else min(abs(f[0] - r), abs(f[1] - r)))


def _segmenti(ostacoli):
    a, b = [], []
    for pts in ostacoli:
        p = np.asarray(pts, float).reshape(-1, 2)
        if len(p) < 2: continue
        a.append(p[:-1]); b.append(p[1:])
    if not a: return np.zeros((0, 2)), np.zeros((0, 2))
    A, B = np.concatenate(a), np.concatenate(b); ok = np.hypot(*(B - A).T) > 0.02
    return A[ok], B[ok]


def corsie(raw_roads, nodes, deckH, ostacoli, asfalto=None, cover=None, new_id=None, log=print):
    """ostacoli: polylines (walls, fences, gates, building rings); asfalto: polygons of the asphalt the game draws and cover the area where
    they are all of it (the comuni with a DBGT), or None; new_id(): an id for a node added where a stretch is cut"""
    OA, OB = _segmenti(ostacoli)
    OT = STRtree(shapely.linestrings(np.stack((OA, OB), 1))) if len(OA) else None
    R = M = Mt = None
    if asfalto:
        from dbgt_strade import Raster
        bb = shapely.total_bounds(np.array(asfalto, dtype=object)); R = Raster((bb[0] - 20, bb[1] - 20, bb[2] + 20, bb[3] + 20)); M = R.draw(asfalto)
        from scipy.ndimage import binary_dilation
        Mt = binary_dilation(M, iterations=1)   # the check: half a metre of slack round the asphalt (the raster, the edges drawn on it)
        cov_in = cover.buffer(-2.0); shapely.prepare(cov_in)
    traf = [wi for wi, r in enumerate(raw_roads) if r['c'] <= 3 and not r['tunnel'] and not r.get('pv') and len(r['refs']) >= 2]
    lane0 = lambda r: 0.0 if r['o'] else min(r['w'] * 0.24, r['mh'] * 0.5)
    # the lanes as they are: forward and backward offsets at each node, the middle of the carriageway (dbgt_strade corsie_locali, else the axis)
    F, B, MID = {}, {}, {}
    for wi in traf:
        r = raw_roads[wi]; n = len(r['refs']); l0 = lane0(r)
        F[wi] = np.asarray(r['lf'], float) / 100 if r.get('lf') and len(r['lf']) == n else np.full(n, l0)
        B[wi] = np.asarray(r['lb'], float) / 100 if r.get('lb') and len(r['lb']) == n else np.full(n, l0)
        MID[wi] = np.asarray(r['_mid'], float) if r.get('_mid') and len(r['_mid']) == n else np.zeros(n)
    F0 = {wi: v.copy() for wi, v in F.items()}; B0 = {wi: v.copy() for wi, v in B.items()}
    # the network before the cuts (the degree of each node over the traffic ways: a dead end is a node of one segment)
    deg = Counter()
    for wi in traf:
        g = raw_roads[wi]['refs']
        for k in range(1, len(g)): deg[g[k - 1]] += 1; deg[g[k]] += 1
    solve = [wi for wi in traf if not raw_roads[wi].get('deck')]   # on a deck the parapets are the game's; walls at ground level stand below
    # ---- 1. move the lanes: samples along each axis, the obstacles across each, the interval each lane may be in there
    W_, K_, T_, P_, U_ = [], [], [], [], []
    for wi in solve:
        xy = np.array([nodes[n_] for n_ in raw_roads[wi]['refs']], float)
        for k in range(len(xy) - 1):
            d = xy[k + 1] - xy[k]; L = math.hypot(*d)
            if L < 1e-3: continue
            m = max(1, int(math.ceil(L / PASSO))); t = np.arange(m + 1) / m
            W_.append(np.full(m + 1, wi)); K_.append(np.full(m + 1, k)); T_.append(t); P_.append(xy[k] + d * t[:, None]); U_.append(np.tile(d / L, (m + 1, 1)))
    if not W_: return {}
    Ws, Ks, Ts, Ps, Us = np.concatenate(W_), np.concatenate(K_), np.concatenate(T_), np.concatenate(P_), np.concatenate(U_)
    Ns = np.column_stack((-Us[:, 1], Us[:, 0]))   # the right of the way (x east, z south), as edgePts
    forb = defaultdict(list)
    if OT is not None:
        c = Ps; ux, uz, nx, nz = Us[:, 0], Us[:, 1], Ns[:, 0], Ns[:, 1]
        sl = np.stack([c + Us * a + Ns * b for a, b in ((-FETTA, -LARGO), (FETTA, -LARGO), (FETTA, LARGO), (-FETTA, LARGO), (-FETTA, -LARGO))], 1)
        qi, qj = OT.query(shapely.polygons(sl), predicate='intersects')
        a_, b_ = OA[qj] - c[qi], OB[qj] - c[qi]
        xa, ya = a_[:, 0] * ux[qi] + a_[:, 1] * uz[qi], a_[:, 0] * nx[qi] + a_[:, 1] * nz[qi]
        xb, yb = b_[:, 0] * ux[qi] + b_[:, 1] * uz[qi], b_[:, 0] * nx[qi] + b_[:, 1] * nz[qi]
        dx = xb - xa; par = np.abs(dx) < 1e-9; dxs = np.where(par, 1.0, dx)
        t0 = np.where(par, 0.0, np.clip(np.minimum((-FETTA - xa) / dxs, (FETTA - xa) / dxs), 0, 1)); t1 = np.where(par, 1.0, np.clip(np.maximum((-FETTA - xa) / dxs, (FETTA - xa) / dxs), 0, 1))
        ok = (t0 <= t1) & (~par | (np.abs(xa) <= FETTA))
        y0, y1 = ya + (yb - ya) * t0, ya + (yb - ya) * t1; x0, x1 = xa + dx * t0, xa + dx * t1
        xm = np.where(x0 * x1 <= 0, 0.0, np.minimum(np.abs(x0), np.abs(x1)))   # the piece's nearest approach along the way
        c_ = np.sqrt(np.maximum(SPAZIO ** 2 - xm ** 2, 0.0))                     # how far across it keeps the lane at that
        for i_, a__, b__ in zip(qi[ok], (np.minimum(y0, y1) - c_)[ok], (np.maximum(y0, y1) + c_)[ok]): forb[int(i_)].append((float(a__), float(b__)))
    # the asphalt across each sample: from the raster of the DBGT where the axis is on it, else the OSM width
    half = np.array([raw_roads[wi]['w'] / 2 for wi in Ws])
    aL, aR = -half + 0.3, half - 0.3; sL, sR = -half + BORDO, half - BORDO
    if R is not None:
        on = R.at(M, Ps[:, 0], Ps[:, 1]) & shapely.contains_xy(cov_in, Ps[:, 0], Ps[:, 1])
        if on.any():
            dr, dl = R.ray(M, Ps[on], Ns[on], 12.0), R.ray(M, Ps[on], -Ns[on], 12.0)
            aL[on], aR[on] = -dl, dr; sL[on], sR[on] = -dl + BORDO, dr - BORDO
        # an axis off the asphalt (OSM runs along its edge: via Monte Grappa, via Einstein): the asphalt beside it, the run across nearest to it
        off_ = ~R.at(M, Ps[:, 0], Ps[:, 1]) & shapely.contains_xy(cov_in, Ps[:, 0], Ps[:, 1])
        if off_.any():
            oi = np.where(off_)[0]; ys = np.arange(-LARGO, LARGO + 0.01, 0.25)
            A_ = R.at(M, (Ps[oi, 0][:, None] + Ns[oi, 0][:, None] * ys[None, :]), (Ps[oi, 1][:, None] + Ns[oi, 1][:, None] * ys[None, :]))
            for r_, i in enumerate(oi):
                ok_ = np.where(A_[r_])[0]
                if not len(ok_): continue
                j = ok_[np.argmin(np.abs(ys[ok_]))]; a = b = j
                while a > 0 and A_[r_, a - 1]: a -= 1
                while b < len(ys) - 1 and A_[r_, b + 1]: b += 1
                aL[i], aR[i] = ys[a], ys[b]; sL[i], sR[i] = ys[a] + BORDO, ys[b] - BORDO
    oneway = np.array([bool(raw_roads[wi]['o']) for wi in Ws])
    mid = np.array([MID[wi][k] * (1 - t) + MID[wi][k + 1] * t for wi, k, t in zip(Ws, Ks, Ts)])
    if R is not None:   # a way without the middle of its carriageway (not on an axis of the DBGT): the middle of the asphalt across it, where that is a street
        nom = np.array([not raw_roads[wi].get('_mid') for wi in Ws]) & np.isfinite(aL) & (aR - aL < np.array([raw_roads[wi]['w'] for wi in Ws]) + 3.0) & shapely.contains_xy(cov_in, Ps[:, 0], Ps[:, 1])
        mid[nom] = (aL[nom] + aR[nom]) / 2
    # the target interval of each lane at each sample (forward frame: + right of the way); None where the lane cannot be
    ivs = {}; stretta = np.zeros(len(Ws), bool)
    for sgn, X0 in ((1, F0), (-1, B0)):
        lo = np.full(len(Ws), np.nan); hi = np.full(len(Ws), np.nan)
        for i in range(len(Ws)):
            if sgn < 0 and oneway[i]: continue
            wi, k, t = Ws[i], Ks[i], Ts[i]; ref = sgn * (X0[wi][k] * (1 - t) + X0[wi][k + 1] * t)
            l_, h_ = aL[i], aR[i]
            sl_, sh_ = sL[i], sR[i]
            if not oneway[i]:   # preferred: the middle of the carriageway is not always known (the mouth of a junction, a bend)
                if sgn > 0: sl_ = max(sl_, mid[i] + META)
                else: sh_ = min(sh_, mid[i] - META)
            f = _libero(forb.get(i, ()), ref, l_, h_)
            if f is None: continue
            if not oneway[i] and sgn > 0:   # the room between the obstacles round the lane, the asphalt aside: for two lanes, 2 META at least
                fw = _libero(forb.get(i, ()), ref, -LARGO, LARGO)
                if fw is not None and fw[1] - fw[0] < 2 * META and fw[0] > -LARGO and fw[1] < LARGO: stretta[i] = True
            for s_ in ((max(f[0], sl_), min(f[1], sh_)), (max(f[0], sL[i]), min(f[1], sR[i]))):
                if s_[0] <= s_[1]: f = s_; break
            lo[i], hi[i] = f
        ivs[sgn] = (lo, hi)
    # node values that keep each sample in its interval: projections, a few sweeps (a lane between two nodes is straight)
    off = {}; o_ = 0
    for wi in solve: off[wi] = o_; o_ += len(raw_roads[wi]['refs'])
    g0 = np.array([off[wi] + k for wi, k in zip(Ws, Ks)])
    nmoved = 0
    for sgn, X in ((1, F), (-1, B)):
        lo, hi = ivs[sgn]; act = ~np.isnan(lo)
        if not act.any(): continue
        V = np.zeros(o_)
        for wi in solve: V[off[wi]:off[wi] + len(X[wi])] = sgn * X[wi]
        V0 = V.copy(); a0, a1, w0, w1, l__, h__ = g0[act], g0[act] + 1, 1 - Ts[act], Ts[act], lo[act], hi[act]
        for _ in range(ITER):
            v = V[a0] * w0 + V[a1] * w1; dlt = np.where(v < l__, l__ - v, np.where(v > h__, h__ - v, 0.0))
            if np.abs(dlt).max() < 0.005: break
            nw = w0 * w0 + w1 * w1; num = np.zeros(o_); den = np.zeros(o_)
            np.add.at(num, a0, dlt * w0 / nw); np.add.at(den, a0, (dlt != 0) * w0); np.add.at(num, a1, dlt * w1 / nw); np.add.at(den, a1, (dlt != 0) * w1)
            m_ = den > 0; V[m_] += num[m_] / den[m_]
        nmoved += int((np.abs(V - V0) > 0.05).sum())
        for wi in solve: X[wi] = sgn * V[off[wi]:off[wi] + len(X[wi])]
    # ---- 2. the check: every lane as the game draws it (each segment, and the step at a node where the axis bends), every half metre
    Q_, QW, QS, QK = [], [], [], []   # points, way, position along the axis (m), kind (0 lane, 1 past a dead end)
    cumd = {}
    for wi in solve:
        r = raw_roads[wi]; g = r['refs']; xy = np.array([nodes[n_] for n_ in g], float); n = len(xy)
        cum = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]; cumd[wi] = cum
        d = np.diff(xy, axis=0); L = np.hypot(*d.T); L[L < 1e-9] = 1e-9; u = d / L[:, None]; nn = np.column_stack((-u[:, 1], u[:, 0]))
        sides = [(1, F[wi])] + ([] if r['o'] else [(-1, B[wi])])
        for sgn, X in sides:
            for k in range(n - 1):
                m = max(1, int(math.ceil(L[k] / PASSO_PROVA))); t = np.arange(m + 1) / m
                Q_.append(xy[k] + d[k] * t[:, None] + nn[k] * (sgn * (X[k] * (1 - t) + X[k + 1] * t))[:, None]); QW.append(np.full(m + 1, wi)); QS.append(cum[k] + L[k] * t); QK.append(np.zeros(m + 1, int))
                if k > 0:   # the step at node k from the lane of segment k-1 to that of segment k
                    p, q = xy[k] + nn[k - 1] * sgn * X[k], xy[k] + nn[k] * sgn * X[k]; m = max(1, int(math.ceil(math.dist(p, q) / PASSO_PROVA)))
                    if m > 1: t = np.arange(1, m) / m; Q_.append(p + (q - p) * t[:, None]); QW.append(np.full(m - 1, wi)); QS.append(np.full(m - 1, cum[k])); QK.append(np.zeros(m - 1, int))
            for end in (0, n - 1):   # a dead end: past it, PRIMA m on, nothing in the way (the car stops and turns round before it)
                if deg[g[end]] != 1: continue
                k = 0 if end == 0 else n - 2; dirn = -u[0] if end == 0 else u[-1]
                e = np.arange(1, int(PRIMA / PASSO_PROVA) + 1) * PASSO_PROVA
                Q_.append(xy[end] + nn[k] * sgn * X[end] + dirn * e[:, None]); QW.append(np.full(len(e), wi)); QS.append(-e if end == 0 else cum[-1] + e); QK.append(np.ones(len(e), int))
    Q, QW, QS, QK = np.concatenate(Q_), np.concatenate(QW), np.concatenate(QS), np.concatenate(QK)
    bad = np.zeros(len(Q), bool); why = np.zeros(len(Q), int)   # 1 obstacle, 2 off the asphalt, 3 too narrow (two-way)
    if OT is not None:
        qi, qj = OT.query(shapely.points(Q), predicate='dwithin', distance=SPAZIO_TAGLIO); bad[qi] = True; why[qi] = 1
    if R is not None:
        ins = shapely.contains_xy(cov_in, Q[:, 0], Q[:, 1]) & (QK == 0); off_a = ins & ~R.at(Mt, Q[:, 0], Q[:, 1])
        why[off_a & ~bad] = 2; bad |= off_a
    # ---- 3. the cuts: around each bad point PRIMA either side along the axis, merged; a node where each begins and ends
    cuts = defaultdict(list)
    for wi, s, w_ in zip(QW[bad], QS[bad], why[bad]): cuts[int(wi)].append((float(s), int(w_)))
    # two-way streets too narrow for two cars between their obstacles, over STRETTA m or more
    run = []
    for i in list(range(len(Ws))) + [-1]:
        if i >= 0 and stretta[i] and (not run or (Ws[run[-1]] == Ws[i] and (Ks[i], Ts[i]) >= (Ks[run[-1]], Ts[run[-1]]))): run.append(i); continue
        if run:
            wi = int(Ws[run[0]]); cum = cumd[wi]; s0 = cum[Ks[run[0]]] + (cum[Ks[run[0]] + 1] - cum[Ks[run[0]]]) * Ts[run[0]]; s1 = cum[Ks[run[-1]]] + (cum[Ks[run[-1]] + 1] - cum[Ks[run[-1]]]) * Ts[run[-1]]
            if s1 - s0 >= STRETTA:
                for s in np.arange(s0, s1 + 0.01, PASSO): cuts[wi].append((float(s), 3))
            run = []
        if i >= 0 and stretta[i]: run.append(i)
    nadd = 0; ncut = 0; mcut = 0.0; dove = []; nt = defaultdict(set); ends = set(); why_m = Counter()
    for wi, ss in sorted(cuts.items()):
        r = raw_roads[wi]; cum = cumd[wi]; Ltot = float(cum[-1]); iv = []
        for s, w_ in sorted(ss):
            a, b = max(0.0, s - PRIMA), min(Ltot, s + PRIMA)
            if b <= a: continue
            if iv and a <= iv[-1][1] + 2 * PRIMA: iv[-1][1] = max(iv[-1][1], b)   # closer than 2 PRIMA: one cut (nothing to drive between)
            else: iv.append([a, b])
        if not iv: continue
        if iv[0][0] < 2 * PRIMA: iv[0][0] = 0.0          # a scrap at either end goes with the cut
        if Ltot - iv[-1][1] < 2 * PRIMA: iv[-1][1] = Ltot
        g = list(r['refs']); xy = [np.asarray(nodes[n_], float) for n_ in g]; pos = [float(v) for v in cum]
        lst = [list(F[wi]), list(B[wi]), list(MID[wi])]
        def node_at(sv, outward):   # a node at sv along the axis: an existing one within 0.75 m on the outer side of the cut, or a new one
            j = int(np.argmin(np.abs(np.array(pos) - sv)))
            if abs(pos[j] - sv) < 0.05 or (abs(pos[j] - sv) < 0.75 and (pos[j] <= sv if outward < 0 else pos[j] >= sv)): return 0
            i = int(np.searchsorted(pos, sv)); f_ = (sv - pos[i - 1]) / max(pos[i] - pos[i - 1], 1e-9); p = xy[i - 1] + (xy[i] - xy[i - 1]) * f_
            nid = new_id(); nodes[nid] = (float(p[0]), float(p[1]))
            if g[i - 1] in deckH and g[i] in deckH: deckH[nid] = deckH[g[i - 1]] + (deckH[g[i]] - deckH[g[i - 1]]) * f_
            g.insert(i, nid); pos.insert(i, sv); xy.insert(i, p)
            for l_ in lst: l_.insert(i, l_[i - 1] + (l_[i] - l_[i - 1]) * f_)
            return 1
        for a, b in iv:
            if a > 0: nadd += node_at(a, -1)
            if b < Ltot: nadd += node_at(b, 1)
        r['refs'] = g; F[wi], B[wi], MID[wi] = (np.array(l_) for l_ in lst); cumd[wi] = np.array(pos)
        P_ = np.array(pos)
        for a, b in iv:
            ia = 0 if a <= 0 else int(np.argmin(np.abs(P_ - a))); ib = len(g) - 1 if b >= Ltot else int(np.argmin(np.abs(P_ - b)))
            for k in range(ia + 1, ib + 1): nt[wi].add(k)
            if ia > 0: ends.add(g[ia])
            if ib < len(g) - 1: ends.add(g[ib])
            mot = Counter(('muro', 'asfalto', 'stretta')[max(0, w_ - 1)] for s, w_ in ss if a - PRIMA - 0.01 <= s <= b + PRIMA + 0.01)
            ncut += 1; mcut += pos[ib] - pos[ia]; dove.append((round(pos[ib] - pos[ia], 1), _link(*nodes[g[(ia + ib) // 2]]) + ' ' + '/'.join(sorted(mot)) + ' %s %.1f m' % ('senso unico' if r['o'] else 'doppio senso', r['w'])))
        for s, w_ in ss: why_m[('muro o edificio', 'fuori asfalto', 'stretta fra i muri')[max(0, w_ - 1)]] += 1
    # ---- 4. what the cuts leave: a one-way street running into a cut loses its traffic back to its last junction, a scrap alone too
    def edges(skip):
        E = []
        for wi in traf:
            r = raw_roads[wi]; g = r['refs']
            for k in range(1, len(g)):
                if skip and k in nt[wi]: continue
                L = math.dist(nodes[g[k - 1]], nodes[g[k]]); E.append((g[k - 1], g[k], wi, k, L))
                if not r['o']: E.append((g[k], g[k - 1], wi, k, L))
        return E
    E0 = edges(False); od0 = Counter(e[0] for e in E0); sinks0 = set(e[1] for e in E0 if od0[e[1]] == 0)   # dead ends before the cuts: as they were
    npr = 0; mpr = 0.0
    while True:
        E = edges(True); od = Counter(e[0] for e in E)
        dead = [e for e in E if od[e[1]] == 0 and e[1] not in sinks0 and raw_roads[e[2]]['o']]
        if not dead: break
        for a, b, wi, k, L in dead: nt[wi].add(k); npr += 1; mpr += L
    par = {}
    def root(x):
        while par.get(x, x) != x: par[x] = par.get(par[x], par[x]); x = par[x]
        return x
    E = edges(True)
    for a, b, wi, k, L in E:
        ra, rb = root(a), root(b)
        if ra != rb: par[ra] = rb
    clen = Counter(); seen = set()
    for a, b, wi, k, L in E:
        if (wi, k) not in seen: seen.add((wi, k)); clen[root(a)] += L
    cut_c = set(root(n_) for n_ in ends)
    nsc = 0; msc = 0.0
    for a, b, wi, k, L in E:
        c_ = root(a)
        if c_ in cut_c and clen[c_] < MIN_RETE and k not in nt[wi]: nt[wi].add(k); nsc += 1; msc += L
    # ---- out: the lanes where they differ from the plain one, the segments without traffic
    nlf = 0
    for wi in traf:
        r = raw_roads[wi]; n = len(r['refs']); l0 = lane0(r); r.pop('nt', None)
        if wi in F and len(F[wi]) == n:
            moved = np.abs(F[wi] - l0).max() > 0.015 or (not r['o'] and np.abs(B[wi] - l0).max() > 0.015)
            if moved or r.get('lf'):
                r['lf'] = [int(round(v * 100)) for v in F[wi]]
                if not r['o']: r['lb'] = [int(round(v * 100)) for v in B[wi]]
                else: r.pop('lb', None)
                nlf += 1
        if nt[wi]: r['nt'] = sorted(nt[wi])
        r.pop('_mid', None)
    for r in raw_roads: r.pop('_mid', None)
    km = lambda: sum(math.dist(nodes[r['refs'][k - 1]], nodes[r['refs'][k]]) for wi in traf for r in [raw_roads[wi]] for k in range(1, len(r['refs'])) if k not in nt[wi]) / 1000
    km_tot = sum(math.dist(nodes[raw_roads[wi]['refs'][k - 1]], nodes[raw_roads[wi]['refs'][k]]) for wi in traf for k in range(1, len(raw_roads[wi]['refs']))) / 1000
    dove.sort(key=lambda d: -d[0])
    rep = dict(vie=len(traf), corsie_spostate_nodi=nmoved, vie_con_corsie=nlf, tagli=ncut, metri_tagliati=round(mcut), nodi_aggiunti=nadd, punti_per_motivo=dict(why_m),
               sensi_unici_tolti_metri=round(mpr), pezzi_isolati_tolti_metri=round(msc), km_rete=round(km_tot, 2), km_rete_ia=round(km(), 2), dove=[d[1] + ' %.0f m' % d[0] for d in dove[:40]])
    log('corsie IA: %s' % {k: v for k, v in rep.items() if k != 'dove'})
    return rep

