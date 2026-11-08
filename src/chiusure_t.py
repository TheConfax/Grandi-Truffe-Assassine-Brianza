"""Chiusure a T (Carlo, 8/11, voti 19, 20, 27, 30 del campione dei varchi: "queste sono sempre piccole chiusure a T, dovrebbe decisamente diventare una regola").
Il capo di una recinzione, di un muro o di una siepe che finisce libero a pochi metri dal fianco di un'altra recinzione, di un edificio o di un cancello
si prolunga sulla sua linea fino a toccarlo e li' si chiude a T. Vale ovunque (fronte strada e dentro i lotti), per ogni comune. Non si chiude dove c'e'
un accesso: un cancello o una porta nel varco, una via o un sentiero OSM, una superficie pavimentata (strada, marciapiede, vialetto, parcheggio) o un
passo carraio del DBGT entro 4 m. Funzione pura (shapely), provata fuori dalla build su brianza.json (scratchpad della sessione)."""
import math
from collections import Counter
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree
from shapely.ops import nearest_points

GAP_MIN = 0.5
GAP_MAX = 7.5      # m: wider than this is an opening to think about, not a T
ANG_MIN = 30.0     # deg: a T, not two lines running side by side
LAT = 0.8          # m: tolerance when the extension of the end misses the target by a corner
COSMIN = 0.92
VIA_D = 1.0

def chiudi_a_t(lines, edifici, gates, doors, vie, pav, pc=(), rep=None, dec=None):
    """lines [(LineString, kind, h)] (no railway); edifici [Polygon]; gates [(LineString, tipo)]; doors [LineString]; vie [LineString]; pav [Polygon];
    pc [(x, z)] passi carrai. Returns ([(pts, kind, h)] new segments, rep)."""
    rep = rep if rep is not None else Counter()
    cl = [l[0] for l in lines] + [g.boundary for g in edifici]
    nl = len(lines); nb = nl + len(edifici)
    gg = [g for g, t in gates if t in ('g', 'o')]
    cl += gg
    T = STRtree(cl)
    blk = [g for g, t in gates] + list(doors)
    GT = STRtree(blk) if blk else None
    VT = STRtree(vie) if vie else None
    PT = STRtree(pav) if pav else None
    CT = STRtree([Point(p) for p in pc]) if pc else None
    pcs = [Point(p) for p in pc]
    out = []; seg_done = []
    def note(e, why, d=None, k=None):
        rep[why] += 1
        if dec is not None: dec.append((e, why, d, k))
    for i, (L, kind, h) in enumerate(lines):
        if L.length < 1.0: continue
        cs = list(L.coords)
        for end in (0, 1):
            e = cs[-1] if end else cs[0]
            s = max(0.0, L.length - 3.0) if end else min(L.length, 3.0)
            f = L.interpolate(s).coords[0]; dd = math.dist(e, f)
            if dd < 0.3: continue
            ux, uz = (e[0] - f[0]) / dd, (e[1] - f[1]) / dd
            P = Point(e)
            if any(j != i and cl[j].distance(P) < 0.5 for j in T.query(P.buffer(0.5))): continue
            rep['capi_liberi'] += 1
            if GT is not None and any(blk[j].distance(P) < 1.5 for j in GT.query(P.buffer(1.5))): note(e, 'cancello_al_capo'); continue
            axis = LineString([e, (e[0] + ux * GAP_MAX, e[1] + uz * GAP_MAX)])
            best = None
            for j in T.query(axis):
                if j == i: continue
                x = cl[j].intersection(axis)
                if x.is_empty: continue
                c = nearest_points(x, P)[0].coords[0]; d = math.dist(e, c)
                if d > 0.05 and (best is None or d < best[0]): best = (d, j, c)
            if best is None:
                strip = axis.buffer(LAT, cap_style=2)
                for j in T.query(strip):
                    if j == i: continue
                    x = cl[j].intersection(strip)
                    if x.is_empty: continue
                    for part in getattr(x, 'geoms', [x]):
                        pts_ = list(part.coords) if part.geom_type in ('LineString', 'Point') else []
                        if part.geom_type == 'LineString' and part.length > 0.2: pts_ += [part.interpolate(k_ * 0.2).coords[0] for k_ in range(int(part.length / 0.2) + 1)]
                        for c in pts_:
                            d = math.dist(e, c)
                            if d > 0.05 and ((c[0] - e[0]) * ux + (c[1] - e[1]) * uz) / d >= COSMIN and (best is None or d < best[0]): best = (d, j, c)
            if best is None: note(e, 'niente_davanti'); continue
            d, j, c = best
            if d < GAP_MIN: note(e, 'gia_vicino', d); continue
            isg = j >= nb
            if not isg:
                tg = cl[j]; pos = tg.project(Point(c))
                p1 = tg.interpolate(max(0, pos - 0.5)); p2 = tg.interpolate(min(tg.length, pos + 0.5))
                tx, tz = p2.x - p1.x, p2.y - p1.y; tl = math.hypot(tx, tz)
                if tl < 1e-6: continue
                sx, sz = (c[0] - e[0]) / d, (c[1] - e[1]) / d
                ang = math.degrees(math.asin(min(1.0, abs(sx * tz - sz * tx) / tl)))
                if ang < ANG_MIN: note(e, 'angolo_stretto', d, j >= nl); continue
            else: ang = 0.0
            S = LineString([e, c])
            # a gate or a door stands in the opening (its own gate, not the one the end is next to): an access
            if GT is not None and any(blk[k].distance(S) < 0.8 for k in GT.query(S.buffer(0.8)) if not (isg and blk[k] is cl[j])): note(e, 'cancello_nel_varco', d); continue
            if VT is not None and any(vie[k].distance(S) < VIA_D for k in VT.query(S.buffer(VIA_D))): note(e, 'via_nel_varco', d); continue
            if PT is not None and any(pav[k].intersects(S) and pav[k].intersection(S).length > 0.3 for k in PT.query(S)): note(e, 'pavimentato_nel_varco', d); continue
            if CT is not None and any(pcs[k].distance(S) < 4.0 for k in CT.query(S.buffer(4.0))): note(e, 'passo_carraio_vicino', d); continue
            if any(S.distance(sd) < 0.2 for sd in seg_done): note(e, 'doppio'); continue
            seg_done.append(S)
            note(e, 'chiuso', d, j >= nl)
            rep['chiusi_' + ('cancello' if isg else 'edificio' if j >= nl else 'recinzione')] += 1
            out.append(([e, c], kind, h))
    return out, rep
