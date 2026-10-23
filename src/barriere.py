"""What each DBGT divider (EL_DIV) is: one rule for every comune (docs/fonti.md). Used by build_data.py now and by the new engine later,
which only changes the height the barriers stand at.
Kinds as the game draws them: 1 wall, 2 low wall with railings, 3 hedge, 4 retaining wall, 5 wire mesh, 6 railway fence, 7 wooden post-and-rail.
EL_DIV_TY (Specifiche di contenuto regionali, p. 173): 02 cancellata, 04 filo spinato, 13 rete metallica, 17 recinzione, 18 staccionata,
19 siepe, 95 altro. The precise codes mean the same everywhere; 17, 18 and 95 each survey uses its own way (Seregno and Cesano Maderno put
almost all their fences under 18, Meda its garden borders and the rim of a fountain), so for those the place decides."""

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
