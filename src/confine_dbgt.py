"""Confine della zona disegnata dal DBGT: il perimetro di ogni comune acceso (unione di copertura_completa di base_dbt_per_pianificazione.gpkg,
accanto al dbgt.gpkg: lo strato COMUNE del DBGT è fatto di schegge, a Meda 13 pezzi per 0,02 km², vedi docs/portabilita.md), in coordinate di gioco, in confine_dbgt.json.
Il gioco ci disegna un muro rosso trasparente e la stessa linea sulla minimappa (src/confine3.js), così si vede quando si esce dalla zona fatta bene.
Comuni accesi: quelli con data/dbt/<Comune>/dbgt.gpkg, la stessa regola di build.py (gli zip e le cartelle estratto/ degli altri non contano).
uso: python src/confine_dbgt.py [out.json]      (di default confine_dbgt.json nella cartella del repo; build.py lo lancia dopo build_data.py)"""
import os, sys, glob, json, sqlite3
import shapely
from shapely.geometry import Polygon
from pyproj import Transformer
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from dbgt_quote import _geom, to_game_lonlat, DATA

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'confine_dbgt.json')
tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
comuni = []
for f in sorted(glob.glob(os.path.join(DATA, 'dbt', '*', 'dbgt.gpkg'))):
    nome = os.path.basename(os.path.dirname(f)); cop = os.path.join(os.path.dirname(f), 'base_dbt_per_pianificazione.gpkg')
    if not os.path.exists(cop): print('confine DBGT:', nome, 'senza base_dbt_per_pianificazione.gpkg, saltato'); continue
    con = sqlite3.connect(cop)
    tutto = shapely.union_all([_geom(b).buffer(0.5) for (b,) in con.execute('select Shape from copertura_completa')]).buffer(-0.5)  # 0,5 m chiude le fessure fra i pezzi
    for part in getattr(tutto, 'geoms', [tutto]):
        if part.area < 10000: continue  # schegge staccate: il confine è il corpo del comune
        xs, ys = part.exterior.xy; lon, lat = tr.transform(list(xs), list(ys))
        ring = Polygon([to_game_lonlat(a, b) for a, b in zip(lon, lat)]).simplify(1.0)  # 1 m: il muro non ha bisogno dei vertici del rilievo
        comuni.append({'n': nome, 'p': [[round(x, 1), round(z, 1)] for x, z in list(ring.exterior.coords)[:-1]], 'km2': round(part.area / 1e6, 2)})
json.dump({'ver': 1, 'comuni': comuni}, open(out, 'w', encoding='utf-8'), separators=(',', ':'))
print('confine DBGT:', ', '.join(f"{c['n']} ({len(c['p'])} vertici)" for c in comuni) or 'nessun comune acceso', '->', os.path.relpath(out, ROOT))
