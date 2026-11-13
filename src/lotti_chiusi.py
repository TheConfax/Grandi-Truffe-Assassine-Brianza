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


# ---------------------------------------------------------------------------------------------------------------------------------------------------------------
# Versione col catasto (ramo lotti-chiusi-catasto). Le particelle (data/catasto, Agenzia delle Entrate, CC BY 4.0) dicono dov'e' il confine del lotto col vuoto pubblico (le strade
# non sono particelle). Dal pilastro di ogni cancello 'g' si segue il confine della particella dietro al cancello, solo dove da' sul vuoto (non verso un'altra particella),
# fino al primo edificio, muro, recinzione o cancello (tolleranza TOL: catasto e DBGT non combaciano al metro), con lo stile della recinzione accanto al cancello.
# Piu' lungo di CAT_MAX m resta aperto. Mai toccare un cancello esistente. Regola generale, senza coordinate.
from shapely.ops import linemerge, substring, unary_union, nearest_points
from shapely.affinity import translate
from shapely.geometry import Polygon, MultiPolygon

DBG = lambda *a: None
RAGGIO = True   # ripiego: se il confine del catasto non si accorda col DBGT (spostato di qualche m) si prova la linea del cancello, accettata solo sul confine pubblico
TOL = 1.3       # m: un pilastro o un punto del confine con qualcosa entro questa distanza e' coperto
CAT_MAX = 35.0  # m: tratto da chiudere piu' lungo = resta aperto
PASSO = 0.5


def chiudi_col_catasto(lines, edifici, gates, doors, carr, parcels, punti=None, rep=None, strade=None):
    """parcels [Polygon] in metri locali (x, z); strade [Polygon]: asfalto e marciapiedi del DBGT (una particella coperta per piu' della meta' e' strada pubblica, non lotto). Ritorna ([(pts, kind, h, punto_stile, info)], contatori). punti None = ovunque."""
    rep = rep if rep is not None else Counter()
    gl = [g for g, t in gates]
    obst = [l[0] for l in lines] + [b.boundary for b in edifici] + gl + list(doors)
    nl, nb = len(lines), len(edifici)
    T = STRtree(obst); CT = STRtree(carr) if carr else None; PT = STRtree(parcels)
    out = []; fatti = []
    ST = STRtree(strade) if strade else None; _sc = {}
    def strada(j):
        if j not in _sc:
            p = parcels[j]; ar = sum(strade[k].intersection(p).area for k in ST.query(p)) if ST is not None and p.area > 0 else 0.0
            x0, z0, x1, z1 = p.bounds; el = ((x1 - x0) ** 2 + (z1 - z0) ** 2) / p.area if p.area > 0 else 0
            _sc[j] = (ar / p.area > 0.5 or (el > 30 and (x1 - x0) ** 2 + (z1 - z0) ** 2 > 3600)) if p.area > 0 else False   # strada: coperta dall'asfalto del DBGT, o lunga e sottile (strade, fossi, ferrovia)
        return _sc[j]
    def _raggio(p, q, P, esp, altre, own, gi):
        dx, dz = p[0] - q[0], p[1] - q[1]; Ld = math.hypot(dx, dz); dx /= Ld; dz /= Ld
        ray = LineString([(p[0] + dx * 0.05, p[1] + dz * 0.05), (p[0] + dx * (CAT_MAX + 5), p[1] + dz * (CAT_MAX + 5))])
        best = None
        for j in T.query(ray):
            if j == own: continue
            x = obst[j].intersection(ray)
            if x.is_empty: continue
            d = min(ray.project(Point(c)) for gg in getattr(x, 'geoms', [x]) for c in gg.coords)
            if d > 0.05 and (best is None or d < best): best = d
        if best is None: rep['raggio_senza_fine'] += 1; return
        if best < LMIN: rep['gia_chiuso'] += 1; return
        if best > CAT_MAX: rep['troppo_lungo_resta_aperto'] += 1; return
        e = ray.interpolate(best).coords[0]; S = LineString([p, e])
        # deve stare sul confine pubblico del lotto: vicino al confine esposto, non dentro un'altra particella privata
        ok = esp is not None and not esp.is_empty
        for u in range(0, int(best) + 1):
            pt = S.interpolate(min(u, best))
            if ok and esp.distance(pt) > 6.0: ok = False
            if altre is not None and not altre.is_empty and altre.contains(pt): ok = False
        if not ok: rep['raggio_non_sul_confine_pubblico'] += 1; return
        if CT is not None and sum(carr[k].intersection(S).length for k in CT.query(S)) > CARR_MAX: rep['attraversa_la_carreggiata'] += 1; return
        if any(S.distance(f) < 0.2 for f in fatti): rep['doppio'] += 1; return
        qp = Point(q); cand = [k for k in T.query(qp.buffer(3.0)) if k < nl and obst[k].distance(qp) < 3.0]
        if not cand: cand = [k for k in T.query(P.buffer(8.0)) if k < nl]
        if not cand: rep['senza_stile'] += 1; return
        k = min(cand, key=lambda k: obst[k].distance(qp)); kind, h = lines[k][1], lines[k][2]
        fatti.append(S); rep['chiusi'] += 1; rep['metri'] += round(S.length); rep['fine_raggio'] += 1
        out.append((list(S.coords), kind, h, obst[k].interpolate(0.5, normalized=True).coords[0], dict(gate=gi, fine='raggio', L=round(S.length, 1))))
    def _inroad(pt): return ST is not None and any(strade[k].contains(pt) for k in ST.query(pt))
    for gi, (g, t) in enumerate(gates):
        if t != 'g' or g.length < 1.5: continue
        a, b = g.coords[0], g.coords[-1]
        M = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2)
        if punti is not None and not any(math.dist(M, (x, z)) <= r for x, z, r in punti): continue
        rep['cancelli'] += 1
        # il lotto dietro al cancello: la particella tocca un lato (a 3 m dal punto di mezzo, perpendicolare) e l'altro lato e' vuoto
        gx, gz = b[0] - a[0], b[1] - a[1]; gL = math.hypot(gx, gz); nx, nz = -gz / gL, gx / gL
        lato = None
        for sg in (1, -1):
            prv = [j for j in PT.query(Point(M[0] + sg * nx * 3.0, M[1] + sg * nz * 3.0)) if parcels[j].contains(Point(M[0] + sg * nx * 3.0, M[1] + sg * nz * 3.0)) ]
            vuo = not any(parcels[j].contains(Point(M[0] - sg * nx * 3.0, M[1] - sg * nz * 3.0)) and not strada(j) and not _inroad(Point(M[0] - sg * nx * 3.0, M[1] - sg * nz * 3.0)) for j in PT.query(Point(M[0] - sg * nx * 3.0, M[1] - sg * nz * 3.0)))
            if prv and vuo: lato = (sg, prv); break
        if lato is None: rep['cancello_non_sul_confine'] += 1; continue
        sg, prv = lato
        lot = unary_union([parcels[j] for j in prv]).buffer(0)
        vic = lot.buffer(2.0)
        # le altre particelle PRIVATE: dalla particella si toglie l'asfalto/marciapiede del DBGT (alcune strade sono particelle, anche enormi) e si scartano le strisce sotto i 2 m
        vic2 = lot.buffer(6.0)
        stl = unary_union([strade[k] for k in ST.query(vic2)]) if ST is not None else None
        pz = []
        for j in PT.query(vic):
            if j in prv or not parcels[j].intersects(vic) or strada(j): continue
            pj = parcels[j].intersection(vic2)
            if stl is not None and not stl.is_empty: pj = pj.difference(stl)
            if not pj.is_empty: pz.append(pj)
        altre = unary_union(pz).buffer(-1.0).buffer(1.2) if pz else Polygon()
        bd = lot.boundary
        esp = bd.difference(altre) if not altre.is_empty else bd
        if esp.is_empty: rep['tutto_verso_altre_particelle'] += 1; continue
        parti = [esp] if esp.geom_type == 'LineString' else [x for x in getattr(esp, 'geoms', []) if x.geom_type == 'LineString']
        if not parti: continue
        try: mg = linemerge(parti)
        except Exception: mg = None
        parti = [mg] if mg is not None and mg.geom_type == 'LineString' else (list(mg.geoms) if mg is not None else parti)
        own = nl + nb + gi
        for p, q in ((a, b), (b, a)):
            P = Point(p); n0 = len(out)
            libero = not any(j != own and obst[j].distance(P) < ATT for j in T.query(P.buffer(ATT)))
            L = min(parti, key=lambda l: l.distance(P))
            if L.distance(P) > 7.0:
                rep['pilastro_lontano_dal_confine'] += 1
                if libero and RAGGIO: _raggio(p, q, P, esp, altre, own, gi)
                continue
            npt = L.interpolate(L.project(P)); v = (p[0] - npt.x, p[1] - npt.y)
            s0 = L.project(P); DBG(gi, p, v, L.length, s0, [tuple(round(c,1) for c in x) for x in L.coords][:12])
            # senso di marcia: allontanandosi dall'altro pilastro
            ta, tb = L.interpolate(max(s0 - 1.5, 0)), L.interpolate(min(s0 + 1.5, L.length)); tx, tz = tb.x - ta.x, tb.y - ta.y; tl = math.hypot(tx, tz) or 1.0
            cs = (tx * (p[0] - q[0]) + tz * (p[1] - q[1])) / (tl * (math.dist(p, q) or 1.0))
            dirs = [1] if cs > 0.3 else [-1] if cs < -0.3 else [1, -1]
            if not dirs: rep['senso_incerto'] += 1; continue
            if len(dirs) == 2: rep['cancello_di_traverso'] += 1   # il confine corre di traverso al cancello: si prova da tutte e due le parti
            for sgn in dirs:
                tmax = (L.length - s0) if sgn > 0 else s0
                cop = lambda pt: any(j != own and obst[j].distance(pt) < TOL for j in T.query(pt.buffer(TOL)))
                fine = None; t_ = 0.0
                lim = min(tmax, CAT_MAX + 5)
                while t_ <= lim + 1e-9:
                    s = s0 + sgn * t_; pt = L.interpolate(min(max(s, 0), L.length)); pt = Point(pt.x + v[0], pt.y + v[1])
                    if cop(pt): fine = 'ostacolo'; break
                    t_ += PASSO
                if fine is None:
                    fine = 'fine_confine' if tmax <= CAT_MAX + 5 else 'troppo_lungo'
                    t_ = min(t_, tmax) if fine == 'fine_confine' else t_
                if t_ < LMIN: rep['gia_chiuso'] += 1; continue
                tt = t_ - PASSO if fine == 'ostacolo' else t_
                tt = max(tt, 0.0)
                if fine == 'troppo_lungo' or tt > CAT_MAX: rep['troppo_lungo_resta_aperto'] += 1; continue
                sub = substring(L, s0, s0 + sgn * tt) if tt > 0 else None
                if sub is None or sub.is_empty or sub.geom_type != 'LineString': continue
                pts = [(c[0] + v[0], c[1] + v[1]) for c in sub.coords]
                if fine == 'ostacolo':
                    E = Point(pts[-1]); cand = [j for j in T.query(E.buffer(TOL + 0.5)) if j != own and obst[j].distance(E) < TOL + 0.5]
                    if cand:
                        j = min(cand, key=lambda j: obst[j].distance(E)); n2 = nearest_points(obst[j], E)[0]
                        if n2.distance(E) > 0.05: pts.append((n2.x, n2.y))
                S = LineString(pts).simplify(0.1)
                if S.length < LMIN: rep['gia_chiuso'] += 1; continue
                if CT is not None and sum(carr[k].intersection(S).length for k in CT.query(S)) > CARR_MAX: rep['attraversa_la_carreggiata'] += 1; continue
                if any(S.distance(f) < 0.2 and S.intersection(f.buffer(0.2)).length > 0.5 * S.length for f in fatti): rep['doppio'] += 1; continue
                qp = Point(q); cand = [k for k in T.query(qp.buffer(3.0)) if k < nl and obst[k].distance(qp) < 3.0]
                if not cand: cand = [k for k in T.query(P.buffer(8.0)) if k < nl]
                if not cand: rep['senza_stile'] += 1; continue
                k = min(cand, key=lambda k: obst[k].distance(qp)); kind, h = lines[k][1], lines[k][2]
                fatti.append(S); rep['chiusi'] += 1; rep['metri'] += round(S.length); rep['fine_' + fine] += 1
                out.append((list(S.coords), kind, h, obst[k].interpolate(0.5, normalized=True).coords[0], dict(gate=gi, fine=fine, L=round(S.length, 1))))
            if len(out) == n0 and libero and RAGGIO: _raggio(p, q, P, esp, altre, own, gi)
    return out, rep
