"""Lotti chiusi dal cancello (caso 40, Carlo 12/11, Colombara x -215 z -972). Un cancello 'g' di recinzione con un pilastro che non tocca niente (nessuna recinzione, muro,
edificio, cancello o porta entro ATT m) lascia il lotto aperto da quel lato: dal pilastro si prolunga la recinzione lungo la linea del cancello fino al primo muro, edificio o
cancello (fino a LMAX m), dello stile della recinzione accanto al cancello. Non attraversa una carreggiata. Funzione pura (shapely).
Ritorna ([(pts, kind, h, punto della linea di cui prende lo stile)], contatori)."""
import math
from collections import Counter
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

ATT = 1.3      # m: un pilastro con qualcosa entro questa distanza e' attaccato
LMAX = 60.0    # m: oltre non e' piu' un lotto
LMIN = 0.8     # m: sotto non serve
CARR_MAX = 1.5 # m di carreggiata attraversata oltre i quali non si chiude


def chiudi_dal_cancello(lines, edifici, gates, doors, carr, punti, rep=None):
    """lines [(LineString, kind, h)]; edifici [Polygon]; gates [(LineString, tipo)]; doors [LineString]; carr [Polygon] (la carreggiata); punti [(x, z, r)]: dove vale"""
    rep = rep if rep is not None else Counter()
    gl = [g for g, t in gates]
    obst = [l[0] for l in lines] + [b.boundary for b in edifici] + gl + list(doors)
    nl, nb, ng = len(lines), len(edifici), len(gl)
    T = STRtree(obst); CT = STRtree(carr) if carr else None
    out = []; fatti = []
    for gi, (g, t) in enumerate(gates):
        if t != 'g' or g.length < 1.5: continue
        a, b = g.coords[0], g.coords[-1]
        if not any(math.dist(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), (x, z)) <= r for x, z, r in punti): continue
        sides = []
        for p, q in ((a, b), (b, a)):
            P = Point(p)
            att = [j for j in T.query(P.buffer(ATT)) if j != nl + nb + gi and obst[j].distance(P) < ATT]
            sides.append((p, q, att))
        for p, q, att in sides:
            if att: continue
            rep['pilastri_liberi'] += 1
            dx, dz = p[0] - q[0], p[1] - q[1]; L = math.hypot(dx, dz); dx /= L; dz /= L
            ray = LineString([(p[0] + dx * 0.05, p[1] + dz * 0.05), (p[0] + dx * LMAX, p[1] + dz * LMAX)])
            best = None
            for j in T.query(ray):
                if j == nl + nb + gi: continue
                x = obst[j].intersection(ray)
                if x.is_empty: continue
                pts = [c for gg in getattr(x, 'geoms', [x]) for c in gg.coords]
                d = min(ray.project(Point(c)) for c in pts)
                if d > 0.05 and (best is None or d < best[0]): best = (d, j)
            if best is None: rep['senza_fine'] += 1; continue
            d, j = best
            if d < LMIN: rep['troppo_corto'] += 1; continue
            e = ray.interpolate(d).coords[0]; S = LineString([p, e])
            if CT is not None and sum(carr[k].intersection(S).length for k in CT.query(S)) > CARR_MAX: rep['attraversa_la_carreggiata'] += 1; continue
            if any(S.distance(f) < 0.2 for f in fatti): rep['doppio'] += 1; continue
            # lo stile: la recinzione (non un edificio) piu' vicina all'altro pilastro del cancello
            qp = Point(q); cand = [k for k in T.query(qp.buffer(3.0)) if k < nl and obst[k].distance(qp) < 3.0]
            if not cand: cand = [k for k in T.query(Point(p).buffer(8.0)) if k < nl]
            if not cand: rep['senza_stile'] += 1; continue
            k = min(cand, key=lambda k: obst[k].distance(qp)); kind, h = lines[k][1], lines[k][2]
            fatti.append(S); rep['chiusi'] += 1; rep['metri'] += round(S.length)
            out.append(([p, e], kind, h, obst[k].interpolate(0.5, normalized=True).coords[0]))
    return out, rep
