"""What each DBGT divider (EL_DIV) is: one rule for every comune (docs/fonti.md). Used by build_data.py now and by the new engine later,
which only changes the height the barriers stand at.
Kinds as the game draws them: 1 wall, 2 low wall with railings, 3 hedge, 4 retaining wall, 5 wire mesh, 6 railway fence, 7 wooden post-and-rail.
EL_DIV_TY (Specifiche di contenuto regionali, p. 173): 02 cancellata, 04 filo spinato, 13 rete metallica, 17 recinzione, 18 staccionata,
19 siepe, 95 altro. The precise codes mean the same everywhere; 17, 18 and 95 each survey uses its own way (Seregno and Cesano Maderno put
almost all their fences under 18, Meda its garden borders and the rim of a fountain), so for those the place decides."""
import math
import numpy as np
import shapely
from shapely.geometry import LineString, Point

KIND_H = {1: 2.0, 2: 1.5, 3: 1.7, 4: 1.2, 5: 1.8, 6: 2.0, 7: 1.2}
SPECIFIC = {'02': 2, '04': 5, '13': 5, '19': 3}
GENERIC = ('17', '18', '95')
# between gardens, where nothing says what it is: one kind for the whole edge of a property (the hash of the building it belongs to),
# wire mesh, hedge or a low wall with railings, so a garden is never a patchwork of three
LOT_MIX = ((0.5, 5), (0.8, 3), (1.0, 2))
RING_MAX = 40  # a closed ring shorter than this is the border of a flower bed or a basin, drawn by that object, not a fence


def classify(ty, osm, zone, lot_h, ring_len=None):
    """ty: EL_DIV_TY; osm: (kind, height) of the OSM barrier drawn along the same line, or None; zone: 'rail', 'street', 'industrial',
    'park', 'farm' or None, in this order of precedence; lot_h: 0..1 hash of the property the line belongs to; ring_len: the length if the
    line is a closed ring. Returns (kind, height) or None for no barrier."""
    if ring_len is not None and ring_len < RING_MAX: return None
    if osm: return osm
    if ty in SPECIFIC:
        k = SPECIFIC[ty]
        if k == 5 and zone == 'rail': return 6, KIND_H[6]
        if k == 5 and zone == 'industrial': return 5, 2.2
        return k, KIND_H[k]
    if zone == 'rail': return 6, KIND_H[6]
    if zone == 'street': return 2, KIND_H[2]
    if zone == 'industrial': return 5, 2.2
    if zone in ('park', 'farm'): return 7, KIND_H[7]
    for lim, k in LOT_MIX:
        if lot_h < lim: return k, KIND_H[k]
    return LOT_MIX[-1][1], KIND_H[LOT_MIX[-1][1]]


# ---- a divider never disappears (Carlo, 25/10): where it falls in a carriageway (or in any zone that would cut it) it moves onto the edge of
# the zone, so it stays the divider between the two (street and yard, street and railway, street and sidewalk). Only where it runs across the
# zone (a street or a track going through it) it opens: the zone is the passage
HALF_T = {1: 0.14, 2: 0.12, 3: 0.45, 4: 0.14, 5: 0.03, 6: 0.1, 7: 0.06}   # half the thickness the game draws each kind with (world3.js)
STEP = 0.5     # the line is followed every STEP m
JUMP = 1.5     # two consecutive points that land farther apart than this went to the two sides of the zone: the line crosses it there
SPOSTAMENTI = []   # the largest shift of every divider moved, for the report


def margine(kind):
    """how far outside the edge of a zone a divider of this kind stands: its face on the edge, not in the zone"""
    return HALF_T.get(kind, 0.14) + 0.05


def sul_confine(L, Z, margin=0.2, fermi=None):
    """L (a LineString) against a zone Z (a polygon, the union of what is near L): the stretches inside Z, or nearer than margin to it, are
    moved onto the edge of Z margin outside it; where L goes across Z (its points land on the two sides) it is opened. Points in fermi (a
    prepared polygon: the edges between two pieces of the zone) are already on a line between two zones and stay. Returns the pieces
    (LineStrings, at least 2 points; the caller drops the short ones) and the metres of L that were moved"""
    if Z is None or Z.is_empty or L.length < 0.05: return [L], 0.0
    Zb = Z.buffer(margin, quad_segs=2) if margin > 0 else Z
    if not Zb.intersects(L): return [L], 0.0
    pts = shapely.get_coordinates(shapely.segmentize(L, STEP))
    ins = shapely.contains_xy(Zb, pts[:, 0], pts[:, 1])
    if fermi is not None and ins.any(): ins &= ~shapely.contains_xy(fermi, pts[:, 0], pts[:, 1])
    if not ins.any(): return [L], 0.0
    B = Zb.boundary
    P = shapely.points(pts[ins])
    new = pts.copy(); new[ins] = shapely.get_coordinates(shapely.get_point(shapely.shortest_line(B, P), 0))
    dsp = np.hypot(*(new - pts).T); sh = dsp > 0.25   # moved, not just set a few cm off the edge
    seg = np.hypot(*np.diff(pts, axis=0).T); moved = float(seg[sh[1:] | sh[:-1]].sum())
    if moved: k = int(dsp.argmax()); SPOSTAMENTI.append((float(dsp[k]), float(pts[k, 0]), float(pts[k, 1])))
    d = np.hypot(*np.diff(new, axis=0).T)
    # a moved stretch whose middle falls back in the zone cuts across it (the tip of a narrow strip of carriageway): opened there too
    mid = (new[:-1] + new[1:]) / 2; back = shapely.contains_xy(Z, mid[:, 0], mid[:, 1]) & (ins[:-1] | ins[1:])
    cut = np.nonzero((d > JUMP) | back)[0]
    out = []
    for a, b in zip(np.r_[0, cut + 1], np.r_[cut + 1, len(new)]):
        run = new[a:b]
        if len(run) < 2: continue
        keep = np.r_[True, np.hypot(*np.diff(run, axis=0).T) > 1e-3]
        run = run[keep]
        if len(run) >= 2: out.append(LineString(run))
    return out, moved


PASSO = 3.0    # an opening at most this far either side of where a way crosses a divider (a yard road matched to a DBGT axis took 19.5 m)


def passaggi(L, vie):
    """where the ways vie ([(LineString, width)]) cross L: an opening as wide as the way (at most 2 PASSO), centred on the crossing (a way
    that runs along a divider without crossing it leaves it where it is: inside a DBGT the divider is surveyed, the OSM way drawn by hand)"""
    out = []
    for V, w in vie:
        x = V.intersection(L)
        if x.is_empty: continue
        out.append(x.buffer(min(PASSO, max(0.8, w / 2)), quad_segs=3))
    return out


# ---- building sites (Carlo, 26/10): the game fences each OSM building site (landuse=construction) with its hoarding panels along the edge.
# Where a wall or fence of the map (DBGT or OSM, any kind) already runs along that edge, the two used to stand side by side: there the
# divider becomes hoarding, on the line of the divider (it is surveyed, the site is drawn by hand), and the edge beside it gets none. A
# divider never disappears: it is replaced, without gaps; the gates in it stay open
C_DIST = 4.0     # a divider this near the edge and parallel to it is the site's fence (via Cadorna: 1.3 and 2.5-2.9 m; x 1540 z -265: 3.6-3.9)
C_EXT = 5.0      # once it is, it goes on being so while it stays this near (no zigzag where it drifts round C_DIST)
C_COPY = 1.0     # two parallel dividers this near each other along the edge are one, mapped twice (an OSM fence on a DBGT one, the railway fence)
C_SMOOTH = 4.0   # a stretch of edge where the game leaves the hoarding out, widened this much each way
C_ROAD = 1.0     # not across a street: more than this much carriageway between the divider and the edge, they are two sides of it
C_ANG = math.cos(math.radians(30))   # parallel: within 30 degrees
C_STEP = 0.5
C_JOIN = 1.5     # two covered stretches of a divider this close are one; a leftover end this short goes with them
C_MIN = 1.0      # covered stretches shorter than this stay a wall (a divider meeting the edge across)


def _dir(L, s, h=0.5):
    a = L.interpolate(max(0.0, s - h)); b = L.interpolate(min(L.length, s + h)); dx, dz = b.x - a.x, b.y - a.y; n = math.hypot(dx, dz)
    return (dx / n, dz / n) if n > 1e-6 else (0.0, 0.0)


def _runs(flags, step, length, closed=False):
    """runs of True in the samples flags (every step along a line of this length) as [s0, s1] in metres"""
    out, i, n = [], 0, len(flags)
    while i < n:
        if not flags[i]: i += 1; continue
        j = i
        while j + 1 < n and flags[j + 1]: j += 1
        out.append([max(0.0, (i - 0.5) * step), min(length, (j + 0.5) * step)]); i = j + 1
    if closed and len(out) > 1 and out[0][0] <= 0 and out[-1][1] >= length: out[0][0] = out[-1][0] - length; out.pop()
    return out


def cantieri(polys, bars, gates, rep, strada=None, senza=None):
    """polys: the building sites as the game gets them (Polygons); bars: the dividers [(pts, kind, h)]; gates: [(x0, z0, x1, z1)] in m.
    Returns the new bars (the replaced stretches taken out) and for each site (h, w): h the stretches of its edge that still get the
    hoarding of the game (filtered against streets and buildings there), w the lines of the dividers it replaces (drawn as they are), or
    None where no divider runs along the edge (the game goes round the polygon as before). strada(xs, zs): True where a point is in a
    carriageway; senza(x, z): True where the game leaves the hoarding out (paesaggio3.js: by a street or in a building)"""
    from shapely.ops import substring
    from shapely.strtree import STRtree
    import os
    if os.environ.get('CANTIERI_DUMP'):   # the inputs, to look at them outside the build
        import pickle; pickle.dump((polys, bars, gates), open(os.environ['CANTIERI_DUMP'], 'wb'))
    lines = [LineString(p) if len(p) >= 2 else None for p, k, h in bars]
    idx = [i for i, L in enumerate(lines) if L is not None and L.length > 0.05]
    tree = STRtree([lines[i] for i in idx]) if idx else None
    G = [LineString([(g[0], g[1]), (g[2], g[3])]) for g in gates if math.dist(g[:2], g[2:4]) > 0.05]
    gtree = STRtree(G) if G else None
    cut = {}       # bar index -> [s0, s1] replaced
    out = []
    rep.update(metri_per_tipo={}, cantieri=len(polys), muri_sostituiti=0, metri_sostituiti=0.0, metri_copie=0.0, metri_bordo_tolti=0.0, metri_bordo=0.0, raccordi=0)
    for poly in polys:
        C = poly.exterior; rep['metri_bordo'] += C.length
        near = [idx[j] for j in tree.query(C.buffer(C_EXT))] if tree is not None else []
        near = [i for i in near if lines[i].distance(C) <= C_EXT]
        if not near: out.append(None); continue
        # each sample of a divider: near the edge, parallel to it, and the nearest parallel divider to that point of the edge
        R, FL, K = [], [], []
        for i in sorted(near):
            L = lines[i]; n = max(2, int(math.ceil(L.length / C_STEP)) + 1); st = L.length / (n - 1); fl = []; sz = [False] * n
            for k in range(n):   # 0 no, 1 near (C_EXT), 2 nearer (C_DIST), 3 a copy of a nearer divider (within C_COPY of it): it goes with it
                s = k * st; p = L.interpolate(s); dd = C.distance(p)
                if dd > C_EXT: fl.append(0); continue
                f = C.interpolate(C.project(p)); u = _dir(L, s); v = _dir(C, C.project(p))
                ok = abs(u[0] * v[0] + u[1] * v[1]) >= C_ANG; copia = False
                if ok:
                    for i2 in near:
                        if i2 == i: continue
                        L2 = lines[i2]; d2 = L2.distance(f)
                        if d2 < dd - 0.3:
                            u2 = _dir(L2, L2.project(f))
                            if abs(u2[0] * v[0] + u2[1] * v[1]) >= C_ANG:
                                if L2.distance(p) <= C_COPY: copia = True
                                else: ok = False; break
                if ok and senza is not None and senza(f.x, f.y): sz[k] = True
                if ok and strada is not None and dd > C_ROAD:
                    m_ = max(2, int(dd / 0.25)); t_ = np.linspace(0, 1, m_)
                    ok = float(np.count_nonzero(strada(p.x + (f.x - p.x) * t_, p.y + (f.y - p.y) * t_))) * dd / m_ <= C_ROAD
                fl.append(0 if not ok else 3 if copia else 2 if dd <= C_DIST else 1)
            # the game draws no hoarding on the edge on or by a street (and leaves gaps where it is borderline): there the divider stays, over
            # the whole stretch where the edge comes that near now and then, and the edge beside it gets no hoarding either (no panels and
            # mesh by turns, no two dividers): it is the only one
            w_ = int(round(C_SMOOTH / st)); zs = [any(sz[max(0, k - w_):k + w_ + 1]) for k in range(n)]
            for r in _runs([zs[k] and fl[k] in (1, 2) for k in range(n)], st, L.length):
                if r[1] - r[0] >= C_MIN: K.append(substring(L, r[0], r[1]))
            fl = [0 if zs[k] else fl[k] for k in range(n)]
            FL.append((i, L, n, st, fl))
        for i, L, n, st, fl in FL:   # the divider along the edge becomes hoarding on its own line
            runs = [r for r in _runs([v_ in (1, 2) for v_ in fl], st, L.length) if sum(1 for k in range(n) if fl[k] == 2 and r[0] <= k * st <= r[1]) >= 2]
            mg = []
            for r in runs:
                if mg and r[0] - mg[-1][1] < C_JOIN: mg[-1][1] = r[1]
                else: mg.append(r)
            for r in mg:
                if r[0] < C_JOIN: r[0] = 0.0
                if L.length - r[1] < C_JOIN: r[1] = L.length
            for r in mg:
                if r[1] - r[0] >= C_MIN: cut.setdefault(i, []).append(r); R.append(substring(L, r[0], r[1]))
        Rt0 = STRtree(R) if R else None
        for i, L, n, st, fl in FL:   # a copy goes only where the divider it copies did become hoarding, beside it
            c3 = [fl[k] == 3 and Rt0 is not None and any(R[j].distance(L.interpolate(k * st)) <= C_COPY + 0.05 for j in Rt0.query(L.interpolate(k * st).buffer(C_COPY + 0.05))) for k in range(n)]
            for r in _runs(c3, st, L.length):
                if r[1] - r[0] >= C_MIN: cut.setdefault(i, []).append(r); rep['metri_copie'] += r[1] - r[0]
        if not R and not K: out.append(None); continue
        # the edge: no hoarding where a replaced divider runs beside it (its foot inside that stretch), or one kept by a street, or across a gate
        n = max(8, int(math.ceil(C.length / C_STEP))); st = C.length / n; cov = []
        RK = R + K; Rt = STRtree(RK); rep['metri_tenuti_lungo_strade'] = rep.get('metri_tenuti_lungo_strade', 0.0) + sum(k_.length for k_ in K)
        for k in range(n):
            s = (k + 0.5) * st; q = C.interpolate(s); v = _dir(C, s); c = False
            for j in Rt.query(q.buffer(C_EXT + 0.3)):
                W = RK[j]; sw = W.project(q)
                if 0.05 < sw < W.length - 0.05 and W.distance(q) <= C_EXT + 0.3:
                    u = _dir(W, sw)
                    if abs(u[0] * v[0] + u[1] * v[1]) >= C_ANG: c = True; break
            if not c and gtree is not None:
                for j in gtree.query(q.buffer(C_EXT + 0.5)):
                    g = G[j]; sg = g.project(q)
                    if -0.3 < sg < g.length + 0.3 and g.distance(q) <= C_EXT + 0.5 and any(W.distance(g) < 2.0 for W in RK): c = True; break
            cov.append(c)
        free = _runs([not c for c in cov], st, C.length, closed=True)
        H = []
        for a, b in free:
            if b - a < 0.5: continue
            if a < 0: H.append(list(substring(C, C.length + a, C.length).coords) + list(substring(C, 0, b).coords)[1:])
            else: H.append(list(substring(C, a, b).coords))
        rep['metri_bordo_tolti'] += C.length - sum(LineString(h).length for h in H)
        # where a replaced divider ends and the edge goes on with its hoarding, a panel across closes the corner (not at a gate); a short piece
        # of edge between the ends of two replaced dividers (the tip of the site beyond where they meet) goes, the two ends are joined
        atgate = lambda E: gtree is not None and any(G[j].distance(Point(E)) < 2.5 for j in gtree.query(Point(E).buffer(2.5)))
        RE = [tuple(E) for W in R for E in (W.coords[0], W.coords[-1]) if not atgate(E)]
        near_end = lambda e: min(RE, key=lambda E: math.dist(E, e)) if RE else None
        done, H2 = set(), []
        for h in H:
            hl = LineString(h).length; e0, e1 = near_end(h[0]), near_end(h[-1])
            if hl < 6.0 and e0 and e1 and math.dist(e0, h[0]) <= C_EXT + 1.0 and math.dist(e1, h[-1]) <= C_EXT + 1.0:
                rep['metri_bordo_tolti'] += hl; done |= {e0, e1}
                if e0 != e1 and math.dist(e0, e1) > 0.3: H2.append([e0, e1]); rep['raccordi'] += 1
                continue
            H2.append(h)
        H = H2
        ends = [h[0] for h in H] + [h[-1] for h in H]
        for E in RE:
            if E in done or not ends: continue
            e = min(ends, key=lambda p: math.dist(p, E)); dd = math.dist(e, E)
            if 0.3 < dd <= C_EXT + 1.0: H.append([E, tuple(e)]); rep['raccordi'] += 1
        out.append((H, [list(W.simplify(0.1).coords) for W in R]))
    nb = []
    for i, (p, k, h) in enumerate(bars):
        if i not in cut: nb.append((p, k, h)); continue
        L = lines[i]; rs = sorted(cut[i]); rep['muri_sostituiti'] += 1; s0 = 0.0
        for a, b in rs + [[L.length, L.length]]:
            m_ = max(0.0, min(b, L.length) - max(a, s0)) if a < L.length else 0.0
            rep['metri_sostituiti'] += m_; rep['metri_per_tipo'][str(k)] = rep['metri_per_tipo'].get(str(k), 0.0) + m_
            if a - s0 > 0.05: nb.append((list(substring(L, s0, a).coords), k, h))
            s0 = max(s0, b)
    rep.setdefault('metri_tenuti_lungo_strade', 0.0)
    for k_ in ('metri_sostituiti', 'metri_copie', 'metri_bordo_tolti', 'metri_bordo', 'metri_tenuti_lungo_strade'): rep[k_] = round(rep[k_])
    rep['metri_per_tipo'] = {k_: round(v_) for k_, v_ in sorted(rep['metri_per_tipo'].items())}
    return nb, out


# ---- the way in to a building of the public (police station): the door looks onto the street, so the barrier between them opens there
# (Carlo, 27/10: the Polizia Locale of Meda stood behind a fence with no way in). The front is picked as the game picks it (world3.js, CASERME):
# a long wall with nothing between it and a street (class up to 5), the nearest street and the longest wall winning
FRONT_MAX = 45.0   # how far from the wall the street may be
FRONT_W = 2.0      # half the width of the opening: the door and its canopy are 3.6 m wide


def facciata_su_strada(B, altri, strade):
    """B: the building polygon; altri: the other buildings (shapely, near B); strade: [(LineString, width)] of the streets at grade, class
    up to 5. Returns (a, c, mx, mz, nx, nz, t): the front wall's ends, its middle, the outward normal and the distance to the street's
    edge, or None when no wall looks onto a street"""
    ring = list(B.exterior.coords)[:-1]; best = None
    for i in range(len(ring)):
        a, c = ring[i], ring[(i + 1) % len(ring)]; L = ((c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2) ** 0.5
        if L < 5: continue
        mx, mz = (a[0] + c[0]) / 2, (a[1] + c[1]) / 2; nx, nz = (c[1] - a[1]) / L, -(c[0] - a[0]) / L
        if B.contains(Point(mx + nx * 0.3, mz + nz * 0.3)): nx, nz = -nx, -nz
        if B.contains(Point(mx + nx * 0.3, mz + nz * 0.3)): continue
        road = None; t = 1.0
        while t <= FRONT_MAX and road is None:
            p = Point(mx + nx * t, mz + nz * t)
            if t > 1.5 and any(o.contains(p) for o in altri): break
            if any(l.distance(p) < w / 2 for l, w in strade): road = t
            t += 0.75
        score = (road if road else 80) - min(L, 24) * 0.5
        if best is None or score < best[0]: best = (score, a, c, mx, mz, nx, nz, road)
    if best is None or best[7] is None: return None
    return best[1:]


def apertura_ingresso(mx, mz, nx, nz, t):
    """the opening in the barriers: from the door out to the edge of the street"""
    return LineString([(mx + nx * 0.2, mz + nz * 0.2), (mx + nx * max(0.5, t - 0.3), mz + nz * max(0.5, t - 0.3))]).buffer(FRONT_W, cap_style=2)
