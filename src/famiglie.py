"""The family of each building for the facades 2.0 (Carlo 8/11): from the data only (type t, footprint, height, isolated or built onto another).
0 box, garage, shed; 1 villetta; 2 casa in linea / di corte; 3 palazzina 4-6 floors; 4 condominio alto 7+ floors; 5 capannone; 6 commerciale / uffici.
The public ones (b['pu'], src/pubblici.py) are pink whatever their family. The volumes of one DBGT building share the family of the whole
building (its biggest footprint and highest top), so a low annex of a palazzina is drawn as the palazzina. b['fa'] in the output"""
from collections import defaultdict
from shapely.geometry import Polygon, Point
from shapely.strtree import STRtree

FL = 3.1   # one floor (m), as the game draws them (world3.js FAC.FL)


# a capannone only where the data say production or storage (Carlo 8/11, via Indipendenza: palazzine with twenty shops drawn as sheds): the type t 2
# (DBGT use or type industrial / warehouse, OSM building=industrial / warehouse), or a big low generic building (t 0, over 800 m2, under 12 m) on OSM
# landuse=industrial with no shop in it. A big low generic one elsewhere: commerciale if one floor or two, otherwise by its floors as any other
SHOP_K = ('shop', 'office', 'craft')
SHOP_AM = {'restaurant', 'bar', 'cafe', 'fast_food', 'pub', 'bank', 'pharmacy', 'ice_cream', 'bureau_de_change', 'dentist', 'doctors', 'clinic', 'veterinary'}


def famiglie(blds, log, shops=(), industria=()):
    """shops: the game points (x, z) of the OSM shops, offices and the like; industria: the OSM landuse=industrial polygons (game metres)"""
    geo, idx = [], []
    for i, b in enumerate(blds):
        try: g = Polygon(b['p']).buffer(0)
        except Exception: continue
        if g.is_empty: continue
        geo.append(g); idx.append(i)
    key = lambda i: ('e', blds[i]['e']) if blds[i].get('e') is not None else ('o', i)
    grp = defaultdict(list)
    for j, i in enumerate(idx): grp[key(i)].append(j)
    tr = STRtree(geo)
    from collections import Counter
    cnt, cambio = Counter(), Counter()
    sp = [Point(p) for p in shops]; st = STRtree(sp) if sp else None
    ind = [g for g in industria if not g.is_empty]; it = STRtree(ind) if ind else None
    for k, js in grp.items():
        A = sum(geo[j].area for j in js); H = max(blds[idx[j]]['h'] for j in js); main = max(js, key=lambda j: geo[j].area); t = blds[idx[main]].get('t', 0)
        att = False
        for j in js:
            for q in tr.query(geo[j].buffer(0.5)):
                if key(idx[q]) != k and geo[q].area > 30 and geo[q].distance(geo[j]) < 0.5: att = True; break
            if att: break
        nf = H / FL
        grande = t == 0 and A > 800 and H < 12
        if grande:
            g0 = geo[main]
            negozi = st is not None and any(geo[j].distance(sp[q]) < 4 for j in js for q in st.query(geo[j].buffer(4)))
            zona_ind = it is not None and any(ind[q].contains(g0.representative_point()) for q in it.query(g0))
        if t in (1, 9) or (A < 45 and H < 4.5): f = 0
        elif t == 2 or (grande and zona_ind and not negozi): f = 5
        elif t == 3 or (grande and nf < 2.2): f = 6
        elif nf >= 6.6: f = 4
        elif nf >= 3.7 or (t == 4 and nf >= 2.7 and not att): f = 3
        elif t == 10 or (not att and A < 300 and H < 10.5): f = 1
        else: f = 2
        cnt[f] += 1
        if grande and f != 5: cambio[f] += 1   # these were capannoni before 8/11
        for j in js: blds[idx[j]]['fa'] = f
    nomi = ['box', 'villetta', 'corte', 'palazzina', 'alto', 'capannone', 'commerciale']
    log('famiglie delle facciate (edifici)', {nomi[f]: n for f, n in sorted(cnt.items())})
    log('capannoni generici che non lo sono piu (fuori dalla zona industriale o con negozi)', {nomi[f]: n for f, n in sorted(cambio.items())})
    return dict(cnt)
