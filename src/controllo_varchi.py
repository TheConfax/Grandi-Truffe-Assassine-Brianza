"""Controllo della build sui cancelli della regola dei varchi (Carlo, voti del campione del 7/11, docs/voti_varchi_7-11.md).
Un cancello sta dove lo metterebbe una persona vera: sul filo della strada, fra i due capi della recinzione, largo da cancello, con qualcosa dietro.
Conta, sui dati finali di build_data.py:
 - dietro_cancello: un cancello della regola con un altro cancello fra lui e la strada (il doppione del 7, 16, 17, 18);
 - dietro_recinzione: un cancello della regola con un divisore o un edificio fra lui e la strada (10, 11, 20: la recinzione davanti è continua);
 - larghi: cancelli della regola oltre LARGO m (4, 26, 27, 30: è una cancellata);
 - storti: cancelli della regola con un capo arretrato di oltre STORTO m rispetto all'altro, guardando la strada (2, 12, 15, 21);
 - ante_in_carreggiata: cancelli aperti (tipo 'o', di ogni fonte) con l'anta sulla carreggiata di una strada, e cancelli chiusi della regola col mezzo sulla carreggiata (24);
 - alberi_sulla_linea: alberi a meno di ALBERO_D m dalla linea di un cancello, di ogni fonte (28).
Si lancia anche fuori dalla build: python src/controllo_varchi.py dump.pkl (GTA_DUMP_VARCHI=dump.pkl nella build)."""
import math, sys
from shapely.geometry import LineString, Point
from shapely.strtree import STRtree

LARGO = 7.5
STORTO = 1.0
ALBERO_D = 0.7
VIA_D = 25.0       # la strada del cancello: la più vicina di classe <= 3 entro questi metri
REGOLA = ('passo_carraio', 'rampa', 'vialetto', 'varco', 'capo_recinzione')
ANTA_COS, ANTA_SIN = math.cos(1.35), math.sin(1.35)   # world3.js: un cancello 'o' ha un'anta sola, larga quanto lui, girata di 1,35 rad verso la normale (-uz, ux)


def anta_aperta(a, b):
    """the leaf of an open gate as the game draws it (world3.js gateOggetti): hinged at a, the whole width, turned towards the left normal"""
    W = math.dist(a, b)
    if W < 0.05: return None
    ux, uz = (b[0] - a[0]) / W, (b[1] - a[1]) / W; nx, nz = -uz, ux
    return LineString([a, (a[0] + W * (ANTA_COS * ux + ANTA_SIN * nx), a[1] + W * (ANTA_COS * uz + ANTA_SIN * nz))])


class Vie:
    def __init__(self, roads):
        self.r = [(LineString(c), w) for c, w, k, drv, fl in roads if k <= 3 and fl and len(c) >= 2]
        self.t = STRtree([l for l, w in self.r]) if self.r else None

    def dentro(self, g):
        """how much of g (m, or 1 for a point) lies on the carriageway of a street (axis +- w/2)"""
        if self.t is None: return 0
        tot = 0
        for j in self.t.query(g.buffer(8)):
            L, w = self.r[j]
            if L.distance(g) < w / 2: tot = max(tot, g.intersection(L.buffer(w / 2, cap_style=2)).length if g.geom_type == 'LineString' else 1)
        return tot

    def vicina(self, P, R=VIA_D):
        if self.t is None: return None
        best = None
        for j in self.t.query(P.buffer(R)):
            d = self.r[j][0].distance(P)
            if d <= R and (best is None or d < best[0]): best = (d, j)
        return self.r[best[1]] if best else None


def approccio(a, b, via):
    """the way from the middle of the gate to the edge of its street: (segment, street) or None"""
    L, w = via; m = ((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); P = Point(m)
    s = L.interpolate(L.project(P)); d = P.distance(s)
    if d <= w / 2 + 0.3: return None
    ux, uz = (s.x - m[0]) / d, (s.y - m[1]) / d
    return LineString([(m[0] + ux * 0.3, m[1] + uz * 0.3), (m[0] + ux * (d - w / 2), m[1] + uz * (d - w / 2))])


def controlla(gates, orig, bar, fences, trees, carr, buildings, roads, log=print):
    G = [((g[0] / 10, g[1] / 10), (g[2] / 10, g[3] / 10), g[4]) for g in gates]
    segs = [LineString([a, b]) if math.dist(a, b) > 0.05 else Point(a) for a, b, k in G]; gt = STRtree(segs)
    lines = [LineString(p) for p, k, h in bar if len(p) >= 2] + [LineString(p) for p in fences if len(p) >= 2] + [g.boundary for g in buildings]
    lt = STRtree(lines); vie = Vie(roads)
    rep = {k: [] for k in ('dietro_cancello', 'dietro_recinzione', 'larghi', 'storti', 'ante_in_carreggiata', 'alberi_sulla_linea')}
    per = {}
    for i, (a, b, k) in enumerate(G):
        o = orig[i]; m = (round((a[0] + b[0]) / 2, 1), round((a[1] + b[1]) / 2, 1)); W = math.dist(a, b)
        # the leaves on the carriageway: of every gate
        # the leaves on the street: an open leaf over a street's carriageway (of every gate), a closed gate of the rule standing in the street
        if k == 'o':
            lf = anta_aperta(a, b)
            if lf is not None and vie.dentro(lf) > 0.3: rep['ante_in_carreggiata'].append(m + (o, 'anta'))
        elif k == 'g' and o in REGOLA and W > 0.05 and vie.dentro(Point(m)) > 0: rep['ante_in_carreggiata'].append(m + (o, 'chiuso'))
        if o not in REGOLA: continue
        per[o] = per.get(o, 0) + 1
        if W > LARGO: rep['larghi'].append(m + (o, round(W, 1)))
        via = vie.vicina(Point(m))
        if via is None: continue
        L = via[0]
        if abs(L.distance(Point(a)) - L.distance(Point(b))) > STORTO: rep['storti'].append(m + (o, round(abs(L.distance(Point(a)) - L.distance(Point(b))), 1)))
        ap = approccio(a, b, via)
        if ap is None: continue
        if any(j != i and segs[j].intersects(ap) for j in gt.query(ap)): rep['dietro_cancello'].append(m + (o,)); continue
        if any(lines[j].intersects(ap) for j in lt.query(ap)): rep['dietro_recinzione'].append(m + (o,))
    if trees:
        for t in trees:
            P = Point(t[0], t[1])
            for j in gt.query(P.buffer(ALBERO_D)):
                if segs[j].geom_type == 'LineString' and segs[j].distance(P) < ALBERO_D:
                    rep['alberi_sulla_linea'].append((round(t[0], 1), round(t[1], 1), orig[j])); break
    out = {'cancelli': len(G), 'della_regola': per}
    for k, v in rep.items():
        out[k] = len(v); out[k + '_regola'] = sum(1 for x in v if x[2] in REGOLA); out['dove_' + k] = v[:300]
    log('CONTROLLO varchi:', {k: v for k, v in out.items() if not k.startswith('dove_')})
    return out


if __name__ == '__main__':
    import pickle, json
    D = pickle.load(open(sys.argv[1], 'rb'))
    r = controlla(D['gates'], D['orig'], D['bar'], D['fences'], D['trees'], D['carr'], D['buildings'], D['roads'])
    if len(sys.argv) > 2: json.dump(r, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
