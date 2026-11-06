# Il censimento delle superfici (docs/superfici.md): python src/censo_superfici.py brianza.json confine_dbgt.json <uscita> [x]
# rasterizza a 1 m gli strati del suolo dei tile nell ordine dei ranghi di world3.js dentro Meda+Seveso, edifici esclusi, e conta i m2 per aspetto.
# Scrive <uscita>.npy (codici), <uscita>.json (nomi) e <uscita>_neutro.png (rosso: terreno nudo; bianco: cortili AATT grigi).
import json, sys, math, numpy as np
from shapely.geometry import Polygon, mapping
from rasterio.features import rasterize
from rasterio.transform import from_origin
from PIL import Image
B = json.load(open(sys.argv[1], encoding='utf-8')); FT_DEF = sys.argv[4] if len(sys.argv) > 4 else 'beige liscio'; C = json.load(open(sys.argv[2], encoding='utf-8')); out = sys.argv[3]
ms = Polygon([c for c in C['comuni'] if c['n'] == 'Meda+Seveso'][0]['p']).buffer(0)
x0, z0, x1, z1 = [math.floor(v) for v in ms.bounds]; W, H = x1 - x0 + 1, z1 - z0 + 1
TR = from_origin(x0, z0, 1, -1)  # row j = z0 + j (z grows south)
def dec(a):
    o = []; X = Z = 0
    for i in range(0, len(a), 2): X += a[i]; Z += a[i + 1]; o.append((X / 10, Z / 10))
    return o
def poly(q, key='p'):
    try:
        g = Polygon(dec(q[key]), [dec(h) for h in q.get('k', []) if len(h) >= 6])
        return g if g.is_valid else g.buffer(0)
    except Exception: return None
LOOKS = []  # code -> name
MN = dict(g='ghiaia/sterrato', t='terra', n='pavimentato neutro', b='masselli', f='porfido', c='ciottoli', p='prato', a='asfalto')
def code(n):
    if n not in LOOKS: LOOKS.append(n)
    return LOOKS.index(n) + 1
AN = {1: 'prato (t1 grass/meadow, DBGT AR_VRD, PS_INC, WC 30)', 2: 'prato parco (t2 park/garden/playground)', 3: 'prato campo sportivo (t3 pitch)', 4: 'parcheggio OSM (t4, asfalto tinto)',
      6: 'acqua (t6)', 7: 'cantiere (t7, asfalto tinto)', 8: 'zona industriale OSM (t8, asfalto tinto)', 9: 'zona commerciale OSM (t9, asfalto tinto)', 10: 'piazza (t10, porfido)',
      11: 'bosco (t11, prato scuro)', 12: 'cespugli (t12)', 13: 'coltivi (t13)', 14: 'cimitero (t14, prato)', 15: 'scuola OSM (t15, prato)', 16: 'residenziale OSM (t16, prato chiaro)',
      17: 'AATT cortile DBGT (t17, ' + ('grigio liscio' if FT_DEF == 'beige liscio' else 'pavimentato neutro') + ')', 18: 'incolto (t18)'}
RANK_A = lambda t: 2 if t == 6 else 4 if t == 10 else 1.1 if t in (4, 7, 8, 9, 17) else 1
items = []  # (rank, seq, geom, code)
seq = 0
for ti, t in enumerate(B['tiles']):
    if not t: continue
    for q in t.get('a', []):
        g = poly(q); seq += 1
        if g is not None and not g.is_empty and q['t'] != 5: items.append((RANK_A(q['t']), seq, g, code(('AATT -> ' + MN[q['m']]) if q.get('m') else AN.get(q['t'], 't%d' % q['t']))))
    for k, r, n in (('cv', 1.2, 'cortile DBGT AC_VEI 0307 (asfalto)'), ('sf', 1.3, 'massicciata ferrovia (ghiaia)'), ('ft', 3, 'vialetto (' + FT_DEF + ')'), ('as', 5, 'carreggiata (asfalto)'),
                    ('pz', 5.1, 'area pedonale/piazza (porfido)'), ('md', 6, 'isola/spartitraffico'), ('sd', 7, 'marciapiede (autobloccanti)')):
        for q in t.get(k, []):
            g = poly(q); seq += 1
            if g is not None and not g.is_empty: items.append((r, seq, g, code(n.split(' (')[0] + ' -> ' + MN[q['m']] if q.get('m') else n if k != 'md' else n + (' verde' if q.get('v') else ' pavimentata'))))
    for q in t.get('ls', []):
        s = q.get('s', '')
        if s.split(':')[0] in ('industria', 'cantiere', 'cani', 'torre_acqua'): continue  # (paesaggio3.js: only things on the ground, no ground of their own)
        g = poly(q); seq += 1
        if g is not None and not g.is_empty: items.append((8, seq, g, code('terreno per tipo: ' + (s.split(':')[0] + ':' + s.split(':')[-1] if s.startswith('sport') or s.startswith('pista') else s))))
    for q in t.get('b', []):
        g = poly(q); seq += 1
        if g is not None and not g.is_empty: items.append((99, seq, g, 255))
items.sort(key=lambda a: (a[0], a[1]))
R = rasterize(((mapping(g), c) for r, s, g, c in items), out_shape=(H, W), transform=TR, fill=0, dtype='uint8', all_touched=False)
M = rasterize([(mapping(ms), 1)], out_shape=(H, W), transform=TR, fill=0, dtype='uint8')
R[M == 0] = 254
np.save(out + '.npy', R); json.dump(dict(x0=x0, z0=z0, looks=LOOKS), open(out + '.json', 'w'))
tot = int(((R != 254) & (R != 255)).sum())
print('Meda+Seveso: %d m2 di suolo (edifici esclusi), %d m2 di edifici' % (tot, int((R == 255).sum())))
cnt = np.bincount(R.ravel(), minlength=256)
rows = [('terreno nudo (nessuno strato)', int(cnt[0]))] + [(LOOKS[i], int(cnt[i + 1])) for i in range(len(LOOKS))]
for n, v in sorted(rows, key=lambda a: -a[1]):
    if v: print('%9d m2 %5.1f%%  %s' % (v, 100 * v / tot, n))
neu = (R == 0) | (R == (LOOKS.index(AN[17]) + 1 if AN[17] in LOOKS else 0))
img = np.zeros((H, W, 3), 'uint8'); img[R == 254] = 40; img[R == 255] = 90; img[(R != 254) & (R != 255)] = (150, 190, 150); img[R == 0] = (255, 60, 60)
if AN[17] in LOOKS: img[R == LOOKS.index(AN[17]) + 1] = (255, 255, 255)
Image.fromarray(img).save(out + '_neutro.png')
