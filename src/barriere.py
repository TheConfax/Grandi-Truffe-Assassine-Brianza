"""What each DBGT divider (EL_DIV) is: one rule for every comune (docs/fonti.md). Used by build_data.py now and by the new engine later,
which only changes the height the barriers stand at.
Kinds as the game draws them: 1 wall, 2 low wall with railings, 3 hedge, 4 retaining wall, 5 wire mesh, 6 railway fence, 7 wooden post-and-rail.
EL_DIV_TY (Specifiche di contenuto regionali, p. 173): 02 cancellata, 04 filo spinato, 13 rete metallica, 17 recinzione, 18 staccionata,
19 siepe, 95 altro. The precise codes mean the same everywhere; 17, 18 and 95 each survey uses its own way (Seregno and Cesano Maderno put
almost all their fences under 18, Meda its garden borders and the rim of a fountain), so for those the place decides."""
import numpy as np
import shapely
from shapely.geometry import LineString

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
