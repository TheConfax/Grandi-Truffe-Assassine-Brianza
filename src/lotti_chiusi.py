"""Lotti chiusi dal cancello (caso 40, Carlo 12/11, Colombara x -215 z -972). Un cancello 'g' di recinzione con un pilastro che non tocca niente (nessuna recinzione, muro,
edificio, cancello o porta entro ATT m) lascia il lotto aperto da quel lato: dal pilastro si prolunga la recinzione lungo la linea del cancello fino al primo muro, edificio o
cancello (fino a LMAX m), dello stile della recinzione accanto al cancello. Non attraversa una carreggiata. Funzione pura (shapely).
Ritorna ([(pts, kind, h, punto della linea di cui prende lo stile)], contatori)."""
import math
from collections import Counter
import shapely
from shapely.geometry import LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

ATT = 1.3      # m: un pilastro con qualcosa entro questa distanza e' attaccato
LMAX = 35.0    # m: oltre non e' piu' un lotto (Carlo 13/11: fino a 35 si chiude, oltre resta aperto, verso strada come verso piazzale o altro lotto)
GATE_CUT = 0.3 # m: sotto un cancello il tratto nuovo non passa: lo si toglie (taglio piatto, come i divisori della build); contro il capo di un cancello arriva fino al pilastro
LMIN = 0.8     # m: sotto non serve
CARR_MAX = 1.5 # m di carreggiata attraversata oltre i quali non si chiude


def _taglia(poly, S):
    x0, z0, x1, z1 = S.bounds
    return shapely.clip_by_rect(poly, x0 - 1, z0 - 1, x1 + 1, z1 + 1)


def chiudi_dal_cancello(lines, edifici, gates, doors, carr, punti, rep=None):
    """lines [(LineString, kind, h)]; edifici [Polygon]; gates [(LineString, tipo)]; doors [LineString]; carr [Polygon] (la carreggiata); punti [(x, z, r)] o None: dove vale (None = ovunque)"""
    rep = rep if rep is not None else Counter()
    gl = [g for g, t in gates]
    obst = [l[0] for l in lines] + [b.boundary for b in edifici] + gl + list(doors)
    nl, nb, ng = len(lines), len(edifici), len(gl)
    T = STRtree(obst)
    carr = [p for c in (carr or []) for p in getattr(c, 'geoms', [c]) if not p.is_empty]   # in pezzi: un poligono solo per tutta la mappa renderebbe ogni intersezione lentissima
    CT = STRtree(carr) if carr else None
    out = []; fatti = []
    for gi, (g, t) in enumerate(gates):
        if t != 'g' or g.length < 1.5: continue
        a, b = g.coords[0], g.coords[-1]
        if punti and not any(math.dist(((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), (x, z)) <= r for x, z, r in punti): continue
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
            if best is None: rep['senza_fine'] += 1; continue   # oltre LMAX: resta aperto
            d, j = best
            if d < LMIN: rep['troppo_corto'] += 1; continue
            e = ray.interpolate(d).coords[0]; S = LineString([p, e])
            if CT is not None and sum(_taglia(carr[k], S).intersection(S).length for k in CT.query(S)) > CARR_MAX: rep['attraversa_la_carreggiata'] += 1; continue
            if any(S.distance(f) < 0.2 for f in fatti): rep['doppio'] += 1; continue
            # lo stile: la recinzione (non un edificio) piu' vicina all'altro pilastro del cancello
            qp = Point(q); cand = [k for k in T.query(qp.buffer(3.0)) if k < nl and obst[k].distance(qp) < 3.0]
            if not cand: cand = [k for k in T.query(Point(p).buffer(8.0)) if k < nl]
            if not cand: rep['senza_stile'] += 1; continue
            k = min(cand, key=lambda k: obst[k].distance(qp)); kind, h = lines[k][1], lines[k][2]
            sty = obst[k].interpolate(0.5, normalized=True).coords[0]
            # dove passa sotto un cancello (non quello contro cui si ferma) il tratto si toglie
            tagli = [gl[m].buffer(GATE_CUT, cap_style=2) for m in range(ng) if m != gi and nl + nb + m != j and gl[m].distance(S) < GATE_CUT + 0.01]
            parti = [S]
            if tagli:
                R_ = S.difference(unary_union(tagli)); parti = [g for g in getattr(R_, 'geoms', [R_]) if g.geom_type == 'LineString' and g.length >= 0.3]; rep['sotto_un_cancello'] += 1
                if not parti: rep['tutto_sotto_un_cancello'] += 1; continue
            fatti.append(S); rep['chiusi'] += 1
            for g in parti: rep['tratti'] += 1; rep['metri'] += round(g.length); out.append(([g.coords[0], g.coords[-1]], kind, h, sty))
    return out, rep
