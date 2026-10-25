# Come sono fatti i manufatti MN_IND secondo le foto (src/manufatti_foto.json, letto da dbgt_manufatti.py; i modelli in paesaggio3.js e
# oggetti3.js). Due parti:
#   - automatica: il colore del tetto delle cabine (MN_IND 01, 02, 03) dall'ortofoto 2018-19 della Regione, la mediana dei pixel nel mezzo della
#     pianta; scartato dove la foto non lo vede (chiome sopra: verde; ombra: scuro) o dove i pixel sono troppo diversi tra loro (una cabina a
#     torre inclinata dalla prospettiva, mezzo tetto e mezzo muro);
#   - a mano (MANUALI qui sotto): quello che ho visto guardando le foto pezzo per pezzo (forma delle serre, colori dei silos diversi dal metallo
#     chiaro, l'acqua delle vasche, la torre piezometrica), con la nota di cosa si vede. Dove non c'e' niente vale la regola del tipo, con
#     colori neutri. Per un comune nuovo: guardare le foto e aggiungere qui le righe, poi rilanciare.
# python src/manufatti_foto.py [brianza_manufatti.json] [cartella cache delle foto]   (scarica le foto che mancano nella cache)
import os, sys, io, json, math, time, urllib.request
import numpy as np
from PIL import Image
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq

ORTO = ('https://www.cartografia.servizirl.it/arcgis2/rest/services/BaseMap/Ortofoto2018_2019/ImageServer/exportImage?bbox=%.7f,%.7f,%.7f,%.7f'
        '&bboxSR=4326&imageSR=3857&size=%d,%d&format=jpgpng&pixelType=U8&interpolation=RSP_BilinearInterpolation&f=image')
N = 400
# ty, x, z (centro della pianta, gioco), campi, nota. Campi: forma (serre: tunnel, vetro, assente), telo (colore del telo di un tunnel),
# colore e tetto (silos, cabine), muri (cabine), acqua e bordo (vasche), spicchi (torre: colori alterni della copertura e quanti), dsm
# ('no': l'altezza del DSM 2008 era di una chioma, vale quella tipica)
MANUALI = [
    # torre piezometrica: dall'alto (2015 e 2018-19) copertura conica a spicchi bianchi e rossi, 16; vasca tonda di 16 m (l'ombra del 2018
    # e' un disco di 16,7 m, appena allungato: la vasca e' a fungo, senza un cilindro alto); l'ombra del fusto nel 2015 e' larga 3 m
    ('12', -335.7, -1774.6, {'spicchi': ['#ece9e2', '#c8664a', 16], 'fusto': 3.2}, 'copertura conica a spicchi bianchi e rossi; fusto sottile dall ombra'),
    # silos e cisterne (07): metallo chiaro quasi tutti; questi sono diversi
    ('07', 1760.3, -478.8, {'colore': '#4a80b4', 'tetto': '#3f78b0'}, 'serbatoio blu'),
    ('07', 1289.0, 593.7, {'colore': '#6c6e70', 'tetto': '#55585b'}, 'scuro'),
    ('07', 1223.0, 545.0, {'tetto': '#9a6c58'}, 'cima color ruggine'),
    ('07', 867.3, -900.2, {'colore': '#e2dccd', 'tetto': '#cdb89c'}, 'via Cadorna: quattro silos color crema, cime coniche con le giunture arrugginite, passerelle tra le cime'),
    ('07', 874.5, -895.8, {'colore': '#e2dccd', 'tetto': '#cdb89c'}, 'via Cadorna'),
    ('07', 871.1, -907.8, {'colore': '#e2dccd', 'tetto': '#cdb89c'}, 'via Cadorna'),
    ('07', 878.0, -904.2, {'colore': '#e2dccd', 'tetto': '#cdb89c'}, 'via Cadorna'),
    ('07', -880.1, -241.1, {'tetto': '#cbb3a4'}, 'tre silos bianchi, cime arrugginite'),
    ('07', -883.1, -243.2, {'tetto': '#cbb3a4'}, ''),
    ('07', -883.5, -246.1, {'tetto': '#cbb3a4'}, ''),
    # serre (13): tunnel di plastica negli orti, serre di vetro a capanna nei giardini; quattro non ci sono piu' nella foto 2018-19
    ('13', 1479.1, 515.9, {'forma': 'assente'}, '2015: telaio scoperto; 2018-19: coperto dalla vegetazione'),
    ('13', 1467.3, 510.0, {'forma': 'assente'}, 'come la vicina'),
    ('13', 922.2, -98.8, {'forma': 'assente'}, 'nel 2015 c era, nel 2018-19 no'),
    ('13', -991.6, -1795.1, {'forma': 'assente'}, 'orti, niente al suo posto'),
    ('13', 1024.8, 519.2, {'forma': 'tunnel', 'telo': '#2f6b66'}, 'tunnel con telo verde scuro'),
    ('13', 1347.6, 567.3, {'forma': 'tunnel', 'telo': '#4a7360'}, 'tunnel con telo verde'),
    ('13', -909.8, -1332.8, {'forma': 'tunnel', 'telo': '#dcecef'}, 'copertura trasparente di una piscina'),
    ('13', 1302.0, 786.7, {'forma': 'tunnel', 'telo': '#c4e6ec'}, 'copertura di una piscina'),
    ('13', 248.3, -1290.2, {'forma': 'tunnel', 'telo': '#e8e8e2'}, 'telo bianco'),
    ('13', -680.2, -950.0, {'forma': 'tunnel', 'telo': '#a49e92'}, 'telo grigio sporco'),
    ('13', 1359.0, 568.7, {'forma': 'tunnel'}, ''), ('13', 47.0, -2082.6, {'forma': 'tunnel'}, ''), ('13', -647.4, -1076.1, {'forma': 'tunnel'}, ''),
    ('13', 164.4, -1988.9, {'forma': 'tunnel'}, ''), ('13', -504.4, -628.6, {'forma': 'tunnel'}, ''), ('13', -385.6, -1331.5, {'forma': 'tunnel'}, ''),
    ('13', 41.1, -2065.4, {'forma': 'tunnel'}, ''), ('13', 118.5, -2038.2, {'forma': 'tunnel'}, '2015'), ('13', -424.7, -1419.7, {'forma': 'tunnel'}, ''),
    ('13', -384.3, -1327.8, {'forma': 'tunnel'}, ''), ('13', 75.8, -1248.3, {'forma': 'tunnel'}, ''), ('13', -435.0, -1404.1, {'forma': 'tunnel'}, ''),
    ('13', -863.8, -459.3, {'forma': 'vetro'}, ''), ('13', 995.5, 868.7, {'forma': 'vetro'}, ''), ('13', 133.5, -1995.4, {'forma': 'vetro'}, 'a capanna'),
    ('13', -1019.0, -1757.8, {'forma': 'vetro'}, 'a capanna'), ('13', 229.5, -1380.1, {'forma': 'vetro'}, ''), ('13', 35.1, -1239.5, {'forma': 'vetro'}, ''),
    ('13', -176.8, -1988.0, {'forma': 'vetro'}, ''), ('13', 912.6, -92.7, {'forma': 'vetro'}, ''), ('13', 596.7, 357.7, {'forma': 'vetro'}, ''),
    ('13', 419.8, 861.2, {'forma': 'vetro'}, ''), ('13', -912.0, -1831.5, {'forma': 'vetro'}, ''), ('13', 1157.5, 782.3, {'forma': 'vetro'}, ''),
    ('13', 298.9, -1237.3, {'forma': 'vetro', 'dsm': 'no'}, 'serra di vetro a capanna sotto gli alberi: i 7,3 m del DSM 2008 sono le chiome'),
    # cabine: la cabina a torre di x 740 ha i muri chiari color sabbia (si vedono di lato) e il tetto scuro
    ('01', 739.5, -622.0, {'muri': '#cfbf9e', 'tetto': '#5f5654'}, 'cabina a torre, muri color sabbia, tetto scuro'),
    ('01', 789.3, -1605.3, {'tetto': '#9a4a3c'}, 'attaccata a una casa, tetto di coppi'),
    # vasche (11): quattro sono piscine, una uno stagno
    ('11', 1645.6, -1038.6, {'acqua': '#5fb8d6', 'bordo': '#e8e2d4'}, 'piscina'),
    ('11', 473.1, -1367.8, {'acqua': '#5fb8d6', 'bordo': '#e8e2d4'}, 'piscina'),
    ('11', -507.1, 553.8, {'acqua': '#5fb8d6', 'bordo': '#e8e2d4'}, 'piscina'),
    ('11', 1632.5, 14.8, {'acqua': '#a9d6de', 'bordo': '#e8e2d4'}, 'piscina coperta da un telo chiaro'),
    ('11', 1879.5, -448.9, {'acqua': '#4c5a3e'}, 'stagno tondo, acqua verde scura'),
]


def foto(x, z, R, cache):
    f = os.path.join(cache, 'mn_x%.1f_z%.1f_R%.0f.jpg' % (x, z, R))
    if os.path.exists(f): return Image.open(f).convert('RGB')
    lon0, lat0 = dq.game_to_lonlat(x - R, z + R); lon1, lat1 = dq.game_to_lonlat(x + R, z - R)
    for k in range(4):
        try:
            im = Image.open(io.BytesIO(urllib.request.urlopen(ORTO % (lon0, lat0, lon1, lat1, N, N), timeout=90).read())).convert('RGB'); im.save(f, quality=90); return im
        except Exception: time.sleep(2)
    return None


def tetto(o, cache):
    R = max(12, 2.5 * math.sqrt(o['m2'])); im = foto(o['x'], o['z'], R, cache)
    if im is None: return None, 'niente foto'
    a = np.asarray(im).astype(float); r = 0.45 * math.sqrt(o['m2'] / math.pi) / (2 * R) * N
    yy, xx = np.mgrid[0:N, 0:N]; m = (xx - N / 2) ** 2 + (yy - N / 2) ** 2 <= max(r, 1.5) ** 2
    c = np.median(a[m], 0); sd = float(a[m].std(0).mean())
    if c[1] > c[0] + 5 and c[1] >= c[2] + 4: return None, 'chiome sopra'
    if c.mean() < 60: return None, 'in ombra'
    if sd > 30: return None, 'pixel misti (%.0f)' % sd
    return '#%02x%02x%02x' % tuple(int(v) for v in c), 'foto'


if __name__ == '__main__':
    rep = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(HERE), 'brianza_manufatti.json')
    cache = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(HERE), 'data', 'ortofoto_manufatti')
    os.makedirs(cache, exist_ok=True)
    po = json.load(open(rep, encoding='utf-8'))['altezze_manufatti']['per_oggetto']
    out, nota = [], {}
    for ty, x, z, campi, n in MANUALI: out.append(dict(ty=ty, x=x, z=z, nota=n, **campi))
    for o in po:
        if o['ty'] not in ('01', '02', '03'): continue
        c, perche = tetto(o, cache); nota[perche.split(' (')[0]] = nota.get(perche.split(' (')[0], 0) + 1
        if c is None: continue
        man = next((m for m in out if m['ty'] == o['ty'] and math.hypot(m['x'] - o['x'], m['z'] - o['z']) < 3), None)
        if man is not None: man.setdefault('tetto', c)
        else: out.append({'ty': o['ty'], 'x': o['x'], 'z': o['z'], 'tetto': c, 'nota': 'tetto dalla foto'})
    doc = {'fonte': 'ortofoto 2018-19 Regione Lombardia (BaseMap/Ortofoto2018_2019) e, per i dubbi, 2015 (ortofoto2015UTM32N); src/manufatti_foto.py',
           'tetti_delle_cabine': nota, 'oggetti': out}
    json.dump(doc, open(os.path.join(HERE, 'manufatti_foto.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
    print(len(out), 'righe;', nota)
