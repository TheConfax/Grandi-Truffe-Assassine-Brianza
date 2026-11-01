"""Confine della zona disegnata dal DBGT: il perimetro di ogni comune acceso (unione di copertura_completa di base_dbt_per_pianificazione.gpkg,
accanto al dbgt.gpkg: lo strato COMUNE del DBGT è fatto di schegge, a Meda 13 pezzi per 0,02 km², vedi docs/portabilita.md), in coordinate di gioco, in confine_dbgt.json.
Qui ci sono anche le due barriere che il gioco disegna (src/confine3.js): la rossa sul confine della zona giocabile, la gialla dove finisce la zona di alta qualità (più sotto).
Comuni accesi: quelli con data/dbt/<Comune>/dbgt.gpkg, la stessa regola di build.py (gli zip e le cartelle estratto/ degli altri non contano).
uso: python src/confine_dbgt.py [out.json]      (di default confine_dbgt.json nella cartella del repo; build.py lo lancia dopo build_data.py)"""
import os, sys, glob, json, sqlite3
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString, box
from skimage import morphology
from pyproj import Transformer
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from dbgt_quote import _geom, to_game_lonlat, DATA, Lidar
import griglia

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'confine_dbgt.json')
tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
comuni, pezzi = [], []
for f in sorted(glob.glob(os.path.join(DATA, 'dbt', '*', 'dbgt.gpkg'))):
    nome = os.path.basename(os.path.dirname(f)); cop = os.path.join(os.path.dirname(f), 'base_dbt_per_pianificazione.gpkg')
    if not os.path.exists(cop): print('confine DBGT:', nome, 'senza base_dbt_per_pianificazione.gpkg, saltato'); continue
    con = sqlite3.connect(cop)
    tutto = shapely.union_all([_geom(b).buffer(0.5) for (b,) in con.execute('select Shape from copertura_completa')]).buffer(-0.5)  # 0,5 m chiude le fessure fra i pezzi
    pezzi.append((nome, tutto))
# due comuni che si toccano sono una zona sola: il muro rosso sta attorno, non fra i due (3 m chiudono le fessure fra le coperture di due comuni)
if len(pezzi) > 1: pezzi = [('+'.join(n for n, _ in pezzi), shapely.union_all([g.buffer(3) for _, g in pezzi]).buffer(-3))]
for nome, tutto in pezzi:
    for part in getattr(tutto, 'geoms', [tutto]):
        if part.area < 10000: continue  # schegge staccate: il confine è il corpo del comune
        xs, ys = part.exterior.xy; lon, lat = tr.transform(list(xs), list(ys))
        ring = Polygon([to_game_lonlat(a, b) for a, b in zip(lon, lat)]).simplify(1.0)  # 1 m: il muro non ha bisogno dei vertici del rilievo
        comuni.append({'n': nome, 'p': [[round(x, 1), round(z, 1)] for x, z in list(ring.exterior.coords)[:-1]], 'km2': round(part.area / 1e6, 2)})
# ----- le due barriere del gioco (src/confine3.js), ogni anello con un punto ogni PASSO_M al massimo, perché seguano il suolo
# rossa: la fine della zona giocabile, data/confine_gioco/confine_gioco.kml
# gialla: la fine della zona di alta qualità, dove ci sono insieme il DBGT di un comune acceso e il LiDAR DTM e DSM. Viene solo dai dati: arrivano dati nuovi, alla build dopo si allarga da sola
PASSO_M, MASCHERA_M, MIN_M2 = 20.0, 4.0, 10000.0   # un buco o una scheggia sotto 1 ha non è un confine: un buco nel LiDAR fra le case non si vede
def anello(c): return [[round(float(x), 1), round(float(z), 1)] for x, z in shapely.get_coordinates(shapely.segmentize(LineString(c), PASSO_M))[:-1]]
def gialla():
    zona = shapely.union_all([Polygon(c['p']) for c in comuni]).buffer(0) if comuni else None
    if zona is None or zona.is_empty: return []
    dtm, dsm = Lidar(), Lidar(os.path.join(DATA, 'terreno', 'lidar_dsm'))
    if not dtm.t or not dsm.t: print('confine: manca il LiDAR DTM o DSM, niente zona di alta qualità'); return []
    x0, z0, x1, z1 = zona.bounds; xs = np.arange(x0 - MASCHERA_M, x1 + 2 * MASCHERA_M, MASCHERA_M); zs = np.arange(z0 - MASCHERA_M, z1 + 2 * MASCHERA_M, MASCHERA_M)
    X, Z = np.meshgrid(xs, zs); M = np.isfinite(dtm.at(X.ravel(), Z.ravel()) + dsm.at(X.ravel(), Z.ravel())).reshape(X.shape)
    celle = int(MIN_M2 / MASCHERA_M ** 2); M = morphology.remove_small_holes(morphology.remove_small_objects(M, celle), celle)
    # la maschera in poligono, riga per riga; il bordo del comune resta quello vero, a gradini ci sono solo i bordi del LiDAR, che si lisciano
    q = []
    for j, r in enumerate(M):
        e = np.flatnonzero(np.diff(np.concatenate(([0], r.astype(np.int8), [0]))))
        q += [box(xs[a] - MASCHERA_M / 2, zs[j] - MASCHERA_M / 2, xs[b - 1] + MASCHERA_M / 2, zs[j] + MASCHERA_M / 2) for a, b in zip(e[::2], e[1::2])]
    if not q: return []
    L = shapely.union_all(q).buffer(MASCHERA_M).buffer(-MASCHERA_M).simplify(MASCHERA_M)
    G = zona.intersection(L); out = []
    for part in getattr(G, 'geoms', [G]):
        if part.geom_type != 'Polygon' or part.area < MIN_M2: continue
        out.append(anello(part.exterior)); out += [anello(h) for h in part.interiors if Polygon(h).area >= MIN_M2]
    return out
rossa = [anello(griglia.confine_gioco(DATA))]; gia = gialla()
json.dump({'ver': 1, 'comuni': comuni, 'rossa': rossa, 'gialla': gia}, open(out, 'w', encoding='utf-8'), separators=(',', ':'))
print('confine DBGT:', ', '.join(f"{c['n']} ({len(c['p'])} vertici)" for c in comuni) or 'nessun comune acceso', '->', os.path.relpath(out, ROOT))
print('barriere: rossa %d vertici, gialla %d anelli, %d vertici' % (sum(map(len, rossa)), len(gia), sum(map(len, gia))))
