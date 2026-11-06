"""Controllo della build su recinzioni e cancelli (Carlo, 6/11): tre numeri che devono essere 0, con i posti.
 - coppie di divisori doppi rimaste: due linee (muri, recinzioni, siepi, recinzioni ferroviarie) entro DOPPIO_D l'una dall'altra, parallele, per almeno DOPPIO_L metri;
 - cancelli doppi: due cancelli con il centro a meno di GATE_D metri;
 - cancelli OSM non costruiti: ogni nodo barrier=gate/lift_gate/swing_gate/sliding_gate/kissing_gate/entrance dentro la mappa deve avere un cancello (o una porta) a meno di OSM_D m;
 - cancellate DBGT isolate disegnate (indici dei divisori DBGT disegnati che sono cancellate isolate).
Funziona sui dati finali di build_data.py (stessi pezzi che finiscono nelle tile)."""
import math
import numpy as np, shapely
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree
from barriere import DOPPIO_D, DOPPIO_L, DOPPIO_COS

OSM_D = 3.0


def doppioni(linee):
    """linee: [pts]. Ritorna [(x, z, metri)] una per coppia di linee che corrono affiancate (entro DOPPIO_D, parallele) per almeno DOPPIO_L m, vista da tutte e due"""
    L = [LineString(p) if len(p) >= 2 else None for p in linee]
    idx = [i for i, l in enumerate(L) if l is not None and l.length > 0.3]
    tree = STRtree([L[i] for i in idx]); runs = {}
    for i in idx:
        li = L[i]; pts = shapely.get_coordinates(shapely.segmentize(li, 0.5)); m = len(pts)
        if m < 2: continue
        mid = (pts[:-1] + pts[1:]) / 2; P = shapely.points(mid)
        dr = np.diff(pts, axis=0); nn = np.hypot(*dr.T); nn[nn == 0] = 1; dr = dr / nn[:, None]
        for jj in tree.query(li.buffer(DOPPIO_D)):
            j = idx[jj]
            if j == i: continue
            M = L[j]; d = shapely.distance(M, P); c = d < DOPPIO_D
            if not c.any(): continue
            pr = shapely.line_locate_point(M, P[c])
            a = shapely.get_coordinates(shapely.line_interpolate_point(M, np.maximum(pr - 0.3, 0)))
            b = shapely.get_coordinates(shapely.line_interpolate_point(M, np.minimum(pr + 0.3, M.length)))
            dm = b - a; nm = np.hypot(*dm.T); nm[nm == 0] = 1; dm = dm / nm[:, None]
            mark = np.zeros(len(mid), bool); mark[np.nonzero(c)[0][np.abs((dm * dr[c]).sum(1)) > DOPPIO_COS]] = True
            tot = 0.0; s = None; best = None
            for q in range(len(mid) + 1):
                if q < len(mid) and mark[q]:
                    if s is None: s = q
                elif s is not None:
                    l_ = float(nn[s:q].sum())
                    if l_ >= DOPPIO_L and (best is None or l_ > best[0]): best = (l_, mid[(s + q - 1) // 2])
                    s = None
            if best: runs[(i, j)] = (round(float(best[1][0]), 1), round(float(best[1][1]), 1), round(best[0], 1))
    # a pair is double when each of the two runs side by side with the other for DOPPIO_L or more
    return [v for (i, j), v in runs.items() if i > j and (j, i) in runs]


def cancelli_doppi_coppie(gates):
    """pairs of indexes (i, j), i < j, of gates on the same varco; gates: [(x0, z0, x1, z1)] in m. Two gates are one varco twice when they run the same way (within 30 degrees) and one lies along the other
    (within 1 m) for at least 1 m: pieces that only meet at an end, in a chain, are different gates"""
    seg = [LineString([(g[0], g[1]), (g[2], g[3])]) if math.dist(g[:2], g[2:4]) > 0.05 else None for g in gates]
    idx = [i for i, l in enumerate(seg) if l is not None]
    if not idx: return []
    tree = STRtree([seg[i] for i in idx]); out = []
    for i in idx:
        a = seg[i]; da = (gates[i][2] - gates[i][0], gates[i][3] - gates[i][1]); na = math.hypot(*da)
        for jj in tree.query(a.buffer(1.0)):
            j = idx[jj]
            if j <= i: continue
            b = seg[j]; db = (gates[j][2] - gates[j][0], gates[j][3] - gates[j][1]); nb = math.hypot(*db)
            if abs(da[0] * db[0] + da[1] * db[1]) / (na * nb) < 0.866: continue
            sh, lg = (a, b) if a.length <= b.length else (b, a)
            if sh.intersection(lg.buffer(1.0)).length >= 1.0: out.append((i, j))
    return out


def cancelli_doppi(gates):
    out = []
    for i, j in cancelli_doppi_coppie(gates):
        m = LineString([(gates[i][0], gates[i][1]), (gates[i][2], gates[i][3])]).interpolate(0.5, normalized=True); out.append((round(m.x, 1), round(m.y, 1)))
    return out


def togli_cancelli_doppi(gates, prio):
    """gates: the gate_out list ([x0, z0, x1, z1, ...] in decimetres); prio: f(gate) -> 0 OSM, 1 DBGT, 2 derived. Of two gates on the same varco (see cancelli_doppi)
    the one with the lower priority goes (of the same priority the later one). Returns the gates left and how many went per priority"""
    segs = [(g[0] / 10, g[1] / 10, g[2] / 10, g[3] / 10) for g in gates]
    dup = cancelli_doppi_coppie(segs); tolti = set(); per = {0: 0, 1: 0, 2: 0}
    for i, j in sorted(dup):
        if i in tolti or j in tolti: continue
        pi_, pj_ = prio(gates[i]), prio(gates[j])
        k = j if pj_ >= pi_ else i
        tolti.add(k); per[prio(gates[k])] += 1
    return [g for k, g in enumerate(gates) if k not in tolti], per


def osm_non_costruiti(osm, gates, porte=()):
    """osm: [(x, z, id, nome)]; gates, porte: [(x0, z0, x1, z1)] in m. Ritorna gli OSM senza un cancello o una porta a meno di OSM_D m"""
    segs = [LineString([(g[0], g[1]), (g[2], g[3])]) if math.dist(g[:2], g[2:4]) > 0.01 else Point(g[0], g[1]) for g in list(gates) + list(porte)]
    if not segs: return list(osm)
    tree = STRtree(segs); out = []
    for o in osm:
        P = Point(o[0], o[1])
        if not any(segs[j].distance(P) < OSM_D for j in tree.query(P.buffer(OSM_D))): out.append(o)
    return out


def controlla(bar_pts, fences, gates, osm, porte, iso_disegnate, comuni_pt, log):
    """bar_pts: [pts] dei divisori finali; fences: [pts]; gates: [(x0, z0, x1, z1)]; osm: [(x, z, id, nome)]; iso_disegnate: [(x, z)];
    comuni_pt: f(x, z) -> nome del comune o None. Ritorna il rapporto"""
    dop = doppioni(list(bar_pts) + list(fences)); gd = cancelli_doppi(gates); nc = osm_non_costruiti(osm, gates, porte)
    rep = {'coppie_doppie_rimaste': len(dop), 'cancelli_doppi_rimasti': len(gd), 'cancelli_osm_in_mappa': len(osm), 'cancelli_osm_non_costruiti': len(nc),
           'cancellate_isolate_disegnate': len(iso_disegnate),
           'cancelli_osm_non_costruiti_a_meda_seveso': sum(1 for o in nc if comuni_pt(o[0], o[1]) in ('meda', 'seveso')),
           'cancelli_osm_a_meda_seveso': sum(1 for o in osm if comuni_pt(o[0], o[1]) in ('meda', 'seveso')),
           'dove_coppie_doppie': dop[:80], 'dove_cancelli_doppi': gd[:80], 'dove_osm_non_costruiti': [(round(o[0], 1), round(o[1], 1), o[2], o[3]) for o in nc][:80],
           'dove_cancellate_isolate': iso_disegnate[:80]}
    log('CONTROLLO recinzioni: coppie doppie', rep['coppie_doppie_rimaste'], 'cancelli doppi', rep['cancelli_doppi_rimasti'], 'cancelli OSM', rep['cancelli_osm_in_mappa'], 'non costruiti', rep['cancelli_osm_non_costruiti'],
        '(Meda e Seveso', rep['cancelli_osm_non_costruiti_a_meda_seveso'], 'su', rep['cancelli_osm_a_meda_seveso'], ') cancellate isolate disegnate', rep['cancellate_isolate_disegnate'])
    return rep
