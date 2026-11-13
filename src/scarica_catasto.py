"""Scarica le particelle catastali del riquadro di gioco dal WFS INSPIRE dell'Agenzia delle Entrate (CC BY 4.0, senza login) in data/catasto/particelle.geojson.
A tasselli, una richiesta alla volta. Poligoni in EPSG:6706 (lat lon) nel GML, scritti in GeoJSON lon,lat. Uso: python src/scarica_catasto.py [cartella_data]"""
import sys, os, time, json, urllib.request, xml.etree.ElementTree as ET
sys.path.insert(0, os.path.dirname(__file__))
from riquadro import BBOX
S, N, W, E = BBOX
URL = 'https://wfs.cartografia.agenziaentrate.gov.it/inspire/wfs/owfs01.php?service=WFS&request=GetFeature&version=2.0.0&typeNames=CP:CadastralParcel&bbox=%.6f,%.6f,%.6f,%.6f'
GML = '{http://www.opengis.net/gml/3.2}'
out = os.path.join(sys.argv[1] if len(sys.argv) > 1 else 'data', 'catasto'); os.makedirs(out, exist_ok=True)
cache = os.path.join(out, 'tasselli'); os.makedirs(cache, exist_ok=True)
DL, DO = 0.004, 0.005
def ring(el):
    v = [float(t) for t in el.find('.//' + GML + 'posList').text.split()]
    return [[v[i + 1], v[i]] for i in range(0, len(v), 2)]
feats = {}; tot = 0
iy = 0; la = S
while la < N:
    io = 0; lo = W
    while lo < E:
        f = os.path.join(cache, 't_%d_%d.xml' % (iy, io))
        if not os.path.exists(f):
            for tent in range(4):
                try:
                    d = urllib.request.urlopen(URL % (la, lo, la + DL, lo + DO), timeout=120).read(); ET.fromstring(d); break
                except Exception as e:
                    print('errore', iy, io, e, flush=True); time.sleep(10 * (tent + 1)); d = None
            if d is None: raise SystemExit('tassello fallito')
            open(f, 'wb').write(d); time.sleep(1.0)
        root = ET.parse(f).getroot()
        m = root.get('numberMatched'); r = root.get('numberReturned'); tot += int(r or 0)
        if m != r: print('ATTENZIONE limite', iy, io, m, r, flush=True)
        for mem in root.iter('{http://www.opengis.net/wfs/2.0}member'):
            p = mem[0]; gid = p.get(GML + 'id')
            if gid in feats: continue
            rings = []
            for poly in p.iter(GML + 'Polygon'):
                ext = poly.find(GML + 'exterior'); rs = [ring(ext)]
                for it in poly.findall(GML + 'interior'): rs.append(ring(it))
                rings.append(rs)
            lab = p.find('.//{http://mapserver.gis.umn.edu/mapserver}nationalCadastralReference')
            feats[gid] = {'type': 'Feature', 'properties': {'id': gid.replace('CadastralParcel.IT.AGE.PLA.', ''), 'rif': lab.text if lab is not None else ''},
                          'geometry': {'type': 'MultiPolygon', 'coordinates': rings}}
        io += 1; lo += DO
    print('riga', iy, len(feats), flush=True)
    iy += 1; la += DL
json.dump({'type': 'FeatureCollection', 'features': list(feats.values())}, open(os.path.join(out, 'particelle.geojson'), 'w'))
print('fine', len(feats), 'particelle (con duplicati ai bordi dei tasselli:', tot, ')')
