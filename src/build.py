"""Rigenera brianza.json: controlla che in data/ ci sia tutto, poi lancia build_data.py con gli argomenti giusti.
uso: python src/build.py [out.json]      (di default brianza.json nella cartella del repo; dura 4-10 minuti)
La cartella dei dati si può spostare con la variabile GTA_DATA. Le fonti sono descritte in docs/dati.md."""
import os, sys, glob, subprocess

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.environ.get('GTA_DATA', os.path.join(ROOT, 'data'))
S, N, W, E = '45.6345', '45.6805', '9.117', '9.191'  # il riquadro della mappa: meta di brianza.json lat0 45.6575, lon0 9.154
OSM = os.path.join(DATA, 'osm', 'maplarge.osm')
DEM = os.path.join(DATA, 'terreno', 'w50550_s10.tif')

# senza questi la build parte lo stesso ma esce una mappa diversa (niente cartelli di paese, niente edifici Overture, niente muri del DBGT...)
NEEDED = [
    (OSM, 'estratto OpenStreetMap (Overpass)'),
    (DEM, 'TINITALY 1.1, quote del terreno'),
    (os.path.join(DATA, 'osm', 'confini_comuni.json'), 'confini comunali (Overpass)'),
    (os.path.join(DATA, 'overture', 'edifici_overture.geojson'), 'edifici Overture Maps'),
    (os.path.join(DATA, 'worldcover', 'wc', 'wc.npy'), 'ritaglio ESA WorldCover (python src/wccrop.py)'),
    (os.path.join(DATA, 'worldcover', 'wc', 'wc_meta.txt'), 'ritaglio ESA WorldCover (python src/wccrop.py)'),
    (os.path.join(DATA, 'dbt', 'Meda', 'dbgt.gpkg'), 'DBGT di Meda (Geoportale Lombardia)'),
]

missing = [(f, what) for f, what in NEEDED if not os.path.exists(f)]
for f, what in missing:
    print('MANCA', os.path.relpath(f, DATA), '-', what)
if missing:
    if any('wc' in f for f, _ in missing) and os.path.exists(os.path.join(DATA, 'worldcover', 'ESA_WorldCover_10m_2021_v200_N45E009_Map.tif')):
        print('il tif di WorldCover c\'è: rifai il ritaglio con python src/wccrop.py')
    print('vedi docs/dati.md per dove scaricarli')
    sys.exit(1)
dbt = sorted(os.path.basename(os.path.dirname(f)) for f in glob.glob(os.path.join(DATA, 'dbt', '*', 'dbgt.gpkg')))
print('dati a posto; DBGT usati:', ', '.join(dbt))
# il LiDAR del Ministero è facoltativo: dove manca resta TINITALY. Il riquadro con il margine di 480 m sta in 54 tessere da 0,01 gradi
lid = [f for f in glob.glob(os.path.join(DATA, 'terreno', 'lidar', '**', '*'), recursive=True) if f.lower().endswith(('.tif', '.tiff', '.asc'))]
want = ['D%d%04d' % (la, lo) for la in range(4563, 4569) for lo in range(911, 920)]
named = [t for t in want if any(t in os.path.basename(f).upper() for f in lid)]
print('LiDAR: %d file in terreno/lidar' % len(lid) + ('' if not lid or not named else ', mancano le tessere ' + (', '.join(t for t in want if t not in named) or 'nessuna')))

out = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'brianza.json')
env = dict(os.environ, GTA_DATA=DATA, PYTHONIOENCODING='utf-8')
sys.exit(subprocess.call([sys.executable, '-u', os.path.join(ROOT, 'src', 'build_data.py'), OSM, DEM, out, S, N, W, E], env=env))
