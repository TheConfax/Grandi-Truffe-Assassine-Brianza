"""What each DBGT divider (EL_DIV) is: one rule for every comune (docs/fonti.md). Used by build_data.py now and by the new engine later,
which only changes the height the barriers stand at.
Kinds as the game draws them: 1 wall, 2 low wall with railings, 3 hedge, 4 retaining wall, 5 wire mesh, 6 railway fence, 7 wooden post-and-rail.
EL_DIV_TY (Specifiche di contenuto regionali, p. 173): 02 cancellata, 04 filo spinato, 13 rete metallica, 17 recinzione, 18 staccionata,
19 siepe, 95 altro. The precise codes mean the same everywhere; 17, 18 and 95 each survey uses its own way (Seregno and Cesano Maderno put
almost all their fences under 18, Meda its garden borders and the rim of a fountain), so for those the place decides."""
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


# ---- double dividers (Carlo, 25/10: "muro doppio, ci sono dentro"; via Santi Aimo e Vermondo, a fence beside the wall narrows the street):
# the DBGT draws two lines for one boundary (a wall and the foot of its bank, a wall and the fence on its top, the two edges of a strip of yard
# one metre wide) and OSM adds its own. Where two dividers run side by side within DOPPIO_D for DOPPIO_L or more, one stays: the stronger kind
# (a wall over a fence over a hedge); of the same kind the one farther from the street, so the passage is not narrowed. The other is cut only
# along the stretches that run parallel (a divider that crosses another keeps its two halves), and what remains stays a divider
DOPPIO_D = 2.3    # two dividers nearer than this (axis to axis) are one boundary (the two walls of a 2 m shoulder strip in Meda are 2.0-2.15 apart; a real alley is wider)
DOPPIO_L = 3.0    # ... for at least this many metres
DOPPIO_COS = 0.9  # and running the same way (|cos| of the angle between them)
FORZA = {1: 0, 4: 0, 6: 1, 5: 2, 2: 3, 7: 4, 3: 5}   # the lower, the stronger
FUSI = {'coppie': 0, 'metri_tolti': 0.0, 'linee_toccate': 0}


def fondi_doppi(items, dist_strada):
    """items: [(pts, kind, height)]; dist_strada(LineString) -> distance of the line from the nearest carriageway. Returns the new list"""
    from shapely.strtree import STRtree
    n = len(items)
    L = [LineString(p) if len(p) >= 2 else None for p, k, h in items]
    key = []
    for i in range(n):
        if L[i] is None: key.append((9, 0, i)); continue
        key.append((FORZA.get(items[i][1], 3), -round(dist_strada(L[i]), 1), -L[i].length, i))
    order = sorted((i for i in range(n) if L[i] is not None), key=lambda i: key[i])
    rank = {i: r for r, i in enumerate(order)}
    tree = STRtree([L[i] for i in order]); surv = {}
    out = [None] * n
    for i in order:
        li = L[i]; pts = shapely.get_coordinates(shapely.segmentize(li, 0.5)); m = len(pts)
        if m < 2: surv[i] = [li]; continue
        mid = (pts[:-1] + pts[1:]) / 2; P = shapely.points(mid)
        dr = np.diff(pts, axis=0); nn = np.hypot(*dr.T); nn[nn == 0] = 1; dr = dr / nn[:, None]
        mark = np.zeros(len(mid), bool)
        for jj in tree.query(li.buffer(DOPPIO_D)):
            j = order[jj]
            if rank[j] >= rank[i] or j not in surv: continue
            for M in surv[j]:
                d = shapely.distance(M, P); c = d < DOPPIO_D
                if not c.any(): continue
                pr = shapely.line_locate_point(M, P[c])
                a = shapely.get_coordinates(shapely.line_interpolate_point(M, np.maximum(pr - 0.3, 0)))
                b = shapely.get_coordinates(shapely.line_interpolate_point(M, np.minimum(pr + 0.3, M.length)))
                dm = b - a; nm = np.hypot(*dm.T); nm[nm == 0] = 1; dm = dm / nm[:, None]
                ok = np.abs((dm * dr[c]).sum(1)) > DOPPIO_COS
                mark[np.nonzero(c)[0][ok]] = True
        # runs of marked half-metres of at least DOPPIO_L are removed; shorter ones stay (a corner, a crossing)
        cut = np.zeros(len(mid), bool); s = None
        for q in range(len(mid) + 1):
            if q < len(mid) and mark[q]:
                if s is None: s = q
            elif s is not None:
                if nn[s:q].sum() >= DOPPIO_L: cut[s:q] = True
                s = None
        if not cut.any(): surv[i] = [li]; continue
        FUSI['linee_toccate'] += 1; FUSI['metri_tolti'] += float(nn[cut].sum())
        pieces = []; s = None
        for q in range(len(mid) + 1):
            if q < len(mid) and not cut[q]:
                if s is None: s = q
            elif s is not None:
                run = pts[s:q + 1]
                if len(run) >= 2 and nn[s:q].sum() > 1.0: pieces.append(LineString(run).simplify(0.05))
                s = None
        surv[i] = pieces
    FUSI['coppie'] = FUSI['linee_toccate']
    res = []
    for i in range(n):
        if L[i] is None: continue
        if i in surv and surv[i] == [L[i]]: res.append(items[i])
        else:
            for pc in surv.get(i, []): res.append((list(pc.coords), items[i][1], items[i][2]))
    return res

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
