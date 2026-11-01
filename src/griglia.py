"""La griglia dei pezzi: tutta la zona giocabile (data/confine_gioco/confine_gioco.kml), in tile da 250 m, sugli stessi punti del reticolo dei dati.
Il riquadro dei dati (src/riquadro.py) dice fin dove arrivano le build e può crescere; la griglia del gioco è già quella finale. I dati di un tile (i, j) del
riquadro stanno nel tile (i + DX, j + DZ) della griglia. La griglia è simmetrica attorno all'origine, come META.hw e META.hh; il limite vero del gioco è la zona."""
import math, os, re
import riquadro as RQ

TILE = 250.0
KX, KZ = 111320 * math.cos(math.radians(RQ.LAT0)), 110540.0
# il tile di riferimento dei sorteggi: colori e alberi dipendono dal posto, non dal numero che un tile ha nella griglia del momento (T.seme)
SEME_HW, SEME_HH, SEME_NX, SEME_NZ = 3628.8, 2542.4, 30, 21
# dove parte il gioco: il parcheggio di via Yuri Gagarin davanti alla fontana, vicino alla stazione. È un dato, non sta nel codice
PARTENZA = dict(stazione='Stazione di Meda', via='Via Yuri Gagarin', comune='MEDA', lat=45.661706, lon=9.161211)


def zona_gioco(data):
    """il riquadro del confine disegnato da Carlo in coordinate di gioco: x0, z0, x1, z1"""
    s = open(os.path.join(data, 'confine_gioco', 'confine_gioco.kml'), encoding='utf-8').read()
    c = [(float(a), float(b)) for blocco in re.findall(r'<coordinates>(.*?)</coordinates>', s, re.S) for a, b in re.findall(r'(-?\d+\.\d+),(-?\d+\.\d+)', blocco)]
    xs = [(lo - RQ.LON0) * KX for lo, _ in c]; zs = [-(la - RQ.LAT0) * KZ for _, la in c]
    return min(xs), min(zs), max(xs), max(zs)


def griglia(hw_dati, hh_dati, data):
    """hw, hh, ntx, ntz della griglia e lo scarto dx, dz dal riquadro dei dati"""
    x0, z0, x1, z1 = zona_gioco(data)
    dx = max(0, math.ceil((max(-x0, x1) - hw_dati) / TILE)); dz = max(0, math.ceil((max(-z0, z1) - hh_dati) / TILE))
    hw, hh = round(hw_dati + dx * TILE, 1), round(hh_dati + dz * TILE, 1)
    return dict(hw=hw, hh=hh, ntx=int(math.ceil(2 * hw / TILE)), ntz=int(math.ceil(2 * hh / TILE)), dx=dx, dz=dz, zona=[round(v, 1) for v in (x0, z0, x1, z1)])
