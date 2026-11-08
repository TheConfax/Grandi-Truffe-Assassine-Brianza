"""Chiusure a T (Carlo, 8/11, voti 19, 20, 27, 30 del campione dei varchi: "queste sono sempre piccole chiusure a T, dovrebbe decisamente diventare una regola").
Il capo di una recinzione, di un muro o di una siepe che finisce libero a pochi metri dal fianco di un'altra recinzione, di un edificio o di un cancello
si prolunga sulla sua linea fino a toccarlo e li' si chiude a T. Vale ovunque (fronte strada e dentro i lotti), per ogni comune. Non si chiude dove c'e'
un accesso: un cancello o una porta nel varco, una via o un sentiero OSM, una superficie pavimentata (strada, marciapiede, vialetto, parcheggio) o un
passo carraio del DBGT entro 4 m. Funzione pura (shapely), provata fuori dalla build su brianza.json (scratchpad della sessione)."""
import math, os
from collections import Counter
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree
from shapely.ops import nearest_points

GAP_MIN = 0.5
GAP_MAX_G = 12.0   # m: the gap between the end of a fence and a gate on its line (the opening beside a gate: Carlo 8/11, voto 38) may be wider
GAP_MAX = 7.5      # m: wider than this is an opening to think about, not a T
ANG_MIN = 30.0     # deg: a T, not two lines running side by side
LAT = 0.8          # m: tolerance when the extension of the end misses the target by a corner
COSMIN = 0.92
LAT_G = 1.5       # m: the same towards a gate, which stands on the line of the street front the short end of a fence may point slightly beside
VIA_D = 1.0
TAN_W = 1.5       # m: the direction of the target is read over this much of it each side of the hit (a short hook at the end of a line is no flank)
PC_GATE_D = 4.0   # m
PC_D = 1.5        # m: a closure that passes this near a passo carraio of the DBGT closes an access
PAR_D = 2.3       # m: a closure that runs side by side with another divider nearer than this for PAR_L m or more is a double of it (src/barriere.py DOPPIO_D, DOPPIO_L, DOPPIO_COS)
PAR_L = 3.0
PAR_COS = 0.9
GAP_I = 2.5        # m: (varchi 3, Carlo 9/11, via Vespucci x -311 z -900: "manca una cancellata, non un varco") two pieces of a boundary in line with a hole up to this wide between them,
                   # and nothing that enters there (the same accesses as for a T), are one boundary: the hole closes
COS_I = 0.94       # in line: the two ends point at each other within 20 degrees

def _parallelo(S, altre):
    """True if S runs side by side (within PAR_D, the same way) with one of the lines altre for PAR_L m or more"""
    if not altre: return False
    n = max(2, int(S.length / 0.5)); sx, sz = S.coords[-1][0] - S.coords[0][0], S.coords[-1][1] - S.coords[0][1]; sl = math.hypot(sx, sz) or 1.0; sx, sz = sx / sl, sz / sl
    for L in altre:
        marks = 0
        for k in range(n + 1):
            P = S.interpolate(k * S.length / n)
            if L.distance(P) >= PAR_D: continue
            t = L.project(P); a = L.interpolate(max(0.0, t - 0.3)); b = L.interpolate(min(L.length, t + 0.3)); dx, dz = b.x - a.x, b.y - a.y; dl = math.hypot(dx, dz)
            if dl > 1e-6 and abs((dx * sx + dz * sz) / dl) > PAR_COS: marks += 1
        if marks * S.length / n >= PAR_L: return True
    return False


def chiudi_a_t(lines, edifici, gates, doors, vie, pav, pc=(), rep=None, dec=None, carr=()):
    """lines [(LineString, kind, h)] (no railway); edifici [Polygon]; gates [(LineString, tipo)]; doors [LineString]; vie [LineString]; pav [Polygon] (surfaces a fence never crosses); carr [Polygon] (the carriageway proper: never crossed; a closure that ends on a gate, along the line of the lot, may cross the rest of pav);
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
    CAT = STRtree(carr) if carr else None
    # a passo carraio of the DBGT that has a gate within PC_GATE_D already has its access: the rest of the opening beside it is not the driveway (voto 38)
    gT = STRtree(gg) if gg else None
    pc = [p for p in pc if gT is None or not any(gg[k].distance(Point(p)) < PC_GATE_D for k in gT.query(Point(p).buffer(PC_GATE_D)))]
    CT = STRtree([Point(p) for p in pc]) if pc else None
    pcs = [Point(p) for p in pc]
    out = []; seg_done = []
    _dbg = [tuple(map(float, x_.split(','))) for x_ in os.environ.get('GTA_T_DEBUG', '').split(';') if x_]   # x,z;x,z: say what became of the free ends within 3 m of these points
    def note(e, why, d=None, k=None):
        rep[why] += 1
        if _dbg and any(math.dist(e, q_) < 3.0 for q_ in _dbg): print('chiusura a T debug', (round(e[0], 1), round(e[1], 1)), why, None if d is None else round(d, 1))
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
            axis = LineString([e, (e[0] + ux * GAP_MAX_G, e[1] + uz * GAP_MAX_G)])
            best = None
            for j in T.query(axis):
                if j == i: continue
                x = cl[j].intersection(axis)
                if x.is_empty: continue
                c = nearest_points(x, P)[0].coords[0]; d = math.dist(e, c)
                if d > 0.05 and (best is None or d < best[0]): best = (d, j, c)
            if best is None:
                strip = axis.buffer(LAT_G, cap_style=2)
                for j in T.query(strip):
                    if j == i: continue
                    x = cl[j].intersection(strip)
                    if x.is_empty: continue
                    for part in getattr(x, 'geoms', [x]):
                        pts_ = list(part.coords) if part.geom_type in ('LineString', 'Point') else []
                        if part.geom_type == 'LineString' and part.length > 0.2: pts_ += [part.interpolate(k_ * 0.2).coords[0] for k_ in range(int(part.length / 0.2) + 1)]
                        for c in pts_:
                            d = math.dist(e, c)
                            if d > 0.05 and ((c[0] - e[0]) * ux + (c[1] - e[1]) * uz) / d >= (COSMIN if j < nb else 0.85) and abs((c[0] - e[0]) * uz - (c[1] - e[1]) * ux) <= (LAT if j < nb else LAT_G) and (best is None or d < best[0]): best = (d, j, c)
            if best is None: note(e, 'niente_davanti'); continue
            d, j, c = best
            if d < GAP_MIN: note(e, 'gia_vicino', d); continue
            isg = j >= nb
            if not isg and d > GAP_MAX: note(e, 'troppo_largo', d); continue
            if not isg:
                tg = cl[j]; pos = tg.project(Point(c))
                p1 = tg.interpolate(max(0, pos - TAN_W)); p2 = tg.interpolate(min(tg.length, pos + TAN_W))
                tx, tz = p2.x - p1.x, p2.y - p1.y; tl = math.hypot(tx, tz)
                if tl < 1e-6: continue
                sx, sz = (c[0] - e[0]) / d, (c[1] - e[1]) / d
                ang = math.degrees(math.asin(min(1.0, abs(sx * tz - sz * tx) / tl)))
                if ang < ANG_MIN:
                    inl = False
                    if j < nl and d <= GAP_I:   # not a T: the end of another piece in line with this one, across a short hole
                        for ce in (tg.coords[0], tg.coords[-1]):
                            if math.dist(ce, c) > 0.6: continue
                            s2 = 0.0 if ce == tg.coords[0] else tg.length; f2 = tg.interpolate(min(tg.length, 3.0) if s2 == 0.0 else max(0.0, tg.length - 3.0)).coords[0]; d2 = math.dist(ce, f2)
                            if d2 > 0.3 and ((ce[0] - f2[0]) * -ux + (ce[1] - f2[1]) * -uz) / d2 >= COS_I: inl = True
                    if not inl: note(e, 'angolo_stretto', d, j >= nl); continue
                    rep['in_linea'] += 1
            else: ang = 0.0
            S = LineString([e, c])
            # a gate or a door stands in the opening (its own gate, not the one the end is next to): an access
            if GT is not None and any(blk[k].distance(S) < 0.8 for k in GT.query(S.buffer(0.8)) if not (isg and blk[k] is cl[j])): note(e, 'cancello_nel_varco', d); continue
            if VT is not None and any(vie[k].distance(S) < VIA_D for k in VT.query(S.buffer(VIA_D))): note(e, 'via_nel_varco', d); continue
            if CAT is not None and any(carr[k].intersects(S) and carr[k].intersection(S).length > 0.3 for k in CAT.query(S)): note(e, 'carreggiata_nel_varco', d); continue
            if PT is not None and not isg and any(pav[k].intersects(S) and pav[k].intersection(S).length > 0.3 for k in PT.query(S)): note(e, 'pavimentato_nel_varco', d); continue
            if CT is not None and any(pcs[k].distance(S) < PC_D for k in CT.query(S.buffer(PC_D))): note(e, 'passo_carraio_vicino', d); continue
            if any(S.distance(sd) < 0.2 for sd in seg_done): note(e, 'doppio'); continue
            if _parallelo(S, [cl[k] for k in T.query(S.buffer(PAR_D)) if k < nl and k != i] + [sd for sd in seg_done if sd.distance(S) < PAR_D]): note(e, 'parallelo_a_un_altro', d); continue
            seg_done.append(S)
            note(e, 'chiuso', d, j >= nl)
            rep['chiusi_' + ('cancello' if isg else 'edificio' if j >= nl else 'in_linea' if ang < ANG_MIN else 'recinzione')] += 1
            out.append(([e, c], kind, h))
    return out, rep
