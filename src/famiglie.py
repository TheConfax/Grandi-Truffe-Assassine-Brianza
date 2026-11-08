"""The family of each building for the facades 2.0 (Carlo 8/11): from the data only (type t, footprint, height, isolated or built onto another).
0 box, garage, shed; 1 villetta; 2 casa in linea / di corte; 3 palazzina 4-6 floors; 4 condominio alto 7+ floors; 5 capannone; 6 commerciale / uffici.
The public ones (b['pu'], src/pubblici.py) are pink whatever their family. The volumes of one DBGT building share the family of the whole
building (its biggest footprint and highest top), so a low annex of a palazzina is drawn as the palazzina. b['fa'] in the output"""
from collections import defaultdict
from shapely.geometry import Polygon
from shapely.strtree import STRtree

FL = 3.1   # one floor (m), as the game draws them (world3.js FAC.FL)


def famiglie(blds, log):
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
    cnt = Counter()
    for k, js in grp.items():
        A = sum(geo[j].area for j in js); H = max(blds[idx[j]]['h'] for j in js); main = max(js, key=lambda j: geo[j].area); t = blds[idx[main]].get('t', 0)
        att = False
        for j in js:
            for q in tr.query(geo[j].buffer(0.5)):
                if key(idx[q]) != k and geo[q].area > 30 and geo[q].distance(geo[j]) < 0.5: att = True; break
            if att: break
        nf = H / FL
        if t in (1, 9) or (A < 45 and H < 4.5): f = 0
        elif t == 2 or (t == 0 and A > 800 and H < 12): f = 5
        elif t == 3: f = 6
        elif nf >= 6.6: f = 4
        elif nf >= 3.7 or (t == 4 and nf >= 2.7 and not att): f = 3
        elif t == 10 or (not att and A < 300 and H < 10.5): f = 1
        else: f = 2
        cnt[f] += 1
        for j in js: blds[idx[j]]['fa'] = f
    log('famiglie delle facciate (edifici)', {['box', 'villetta', 'corte', 'palazzina', 'alto', 'capannone', 'commerciale'][f]: n for f, n in sorted(cnt.items())})
    return dict(cnt)
