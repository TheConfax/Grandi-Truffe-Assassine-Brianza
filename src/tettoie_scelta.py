# Fase 1 del ramo tettoie: elenca le tettoie (t 9) di brianza.json con area, casa accanto, quota DBGT e LiDAR (DSM-DTM sulla pianta). Solo analisi, nessuna regola.
# uso: python src/tettoie_scelta.py out.json
import sys, os, json
import numpy as np, shapely
from shapely.geometry import Polygon
from shapely.strtree import STRtree
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbgt_quote as dq
D = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'brianza.json'), encoding='utf-8'))
def dec(p):
    x, z = p[0], p[1]; o = [(x / 10, z / 10)]
    for i in range(2, len(p), 2): x += p[i]; z += p[i + 1]; o.append((x / 10, z / 10))
    return o
T9, H = [], []
for i, t in enumerate(D['tiles']):
    for b in t.get('b', []):
        o = dec(b['p'])
        if len(o) < 3: continue
        g = Polygon(o).buffer(0)
        if g.is_empty: continue
        (T9 if b.get('t') == 9 else H).append((g, b, i))
tree = STRtree([g for g, _, _ in H])
dsm = dq.Lidar(os.path.join(dq.DATA, 'terreno', 'lidar_dsm')); dtm = dq.Lidar(os.path.join(dq.DATA, 'terreno', 'lidar'))
out = []
for k, (g, b, ti) in enumerate(T9):
    c = g.centroid; x0, z0, x1, z1 = g.bounds
    gx, gz = np.meshgrid(np.arange(x0, x1, 0.5) + 0.25, np.arange(z0, z1, 0.5) + 0.25); X, Z = gx.ravel(), gz.ravel(); m = shapely.contains_xy(g.buffer(-0.2) if g.buffer(-0.2).area > 2 else g, X, Z)
    X, Z = X[m], Z[m]; dd = dsm.at(X, Z) - dtm.at(X, Z) if len(X) else np.array([np.nan]); dd = dd[~np.isnan(dd)]
    near = [(g.distance(H[j][0]), j) for j in tree.query(g.buffer(2.0))]
    near.sort(); att = [n for n in near if n[0] <= 1.5]
    cas = H[att[0][1]] if att else None
    lon, lat = dq.game_to_lonlat(c.x, c.y)
    out.append(dict(id=k, x=round(c.x, 1), z=round(c.y, 1), lat=round(float(lat), 6), lon=round(float(lon), 6), area=round(g.area, 1), h_dbgt=b['h'], zt=b.get('zt'), e=b.get('e'),
        lidar_med=round(float(np.median(dd)), 2) if len(dd) else None, lidar_p90=round(float(np.percentile(dd, 90)), 2) if len(dd) else None, lidar_max=round(float(dd.max()), 2) if len(dd) else None,
        attaccata=bool(att), dist=round(near[0][0], 2) if near else None, h_casa=cas[1]['h'] if cas else None, zt_casa=cas[1].get('zt') if cas else None, casa_rk=cas[1].get('rk') if cas else None, casa_e=cas[1].get('e') if cas else None, ti=ti, b=b))
json.dump(out, open(sys.argv[1], 'w'), ensure_ascii=False)
print(len(out))
