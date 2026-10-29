# Prove fisse dei punti segnalati da Carlo il 28/10 (todo.md, correzioni-piccole-2): ogni punto e' un conteggio che la build stampa e mette in
# report.controlli_28_10.prove_fisse; se un punto non passa lo dice. Da solo: python src/prove_fisse.py [brianza.json]
import json, math, sys, os
import numpy as np
from shapely.geometry import LineString, Polygon, Point

PUNTI = {
    # via Pace, la striscia di porfido fra la banchina e il binario (Carlo, 28/10 sera): il bordo del binario verso il porfido deve avere una recinzione (T.fe, 'chiusure' di build_data.py) entro 3 m dal punto di mezzo
    'pace_chiusura_banchina': dict(x=575.0, z=-745.0, r=3.0),
    # rotonda di via Papa Giovanni XXIII: i due alberi non possono essere "minuscoli" (almeno 6 m)
    'rotonda_papa_giovanni_alberi': dict(x=-549.9, z=-681.5, r=8.0, h_min=6.0),
    # parcheggio di via del Cimitero: il DBGT lo ha (AC_VEI 0301), il gioco deve averlo ('pk' della tile) entro 3 m dal punto della segnalazione; i bordi delle aiuole attorno sono cordoli bassi (kind 1), non siepi da 1,7 m (i posti dipinti li decide landmarks3.js, che li toglie dove non c'e' posto + corsia)
    'parcheggio_via_del_cimitero': dict(x=515.3, z=-230.9, r=3.0, r_aiuole=25.0),
}


def _dec(a):
    return np.cumsum(np.asarray(a, float).reshape(-1, 2), axis=0) / 10


def prove(D, isole_alberi_sotto_6=None):
    ba, tr, pk, fe, aiu = [], [], [], [], []
    for T in D['tiles']:
        if not T: continue
        for b in T.get('ba', []):
            if len(b['p']) >= 4: ba.append((b['t'], LineString(_dec(b['p']))))
        for b in T.get('fe', []):
            if len(b['p']) >= 4: fe.append(LineString(_dec(b['p'])))
        for t in T.get('tr', []):
            if len(t) >= 4: tr.append((t[0] / 10, t[1] / 10, t[2] / 10, t[3] / 10))
        for a in T.get('pk', []):
            P = _dec(a['p'])
            if len(P) >= 3: pk.append(Polygon(P).buffer(0))
    out = {}
    p = PUNTI['pace_chiusura_banchina']; pt = Point(p['x'], p['z'])
    n = sum(1 for L in fe if L.distance(pt) <= p['r']); out['pace_chiusura_banchina'] = {'recinzioni_entro_%gm' % p['r']: n, 'ok': n > 0}
    p = PUNTI['rotonda_papa_giovanni_alberi']
    A = [t for t in tr if math.hypot(t[0] - p['x'], t[1] - p['z']) <= p['r']]
    out['rotonda_papa_giovanni_alberi'] = {'alberi': [(round(t[2], 1), round(t[3], 1)) for t in A], 'ok': bool(A) and all(t[2] >= p['h_min'] for t in A)}
    p = PUNTI['parcheggio_via_del_cimitero']; pt = Point(p['x'], p['z'])
    n = sum(1 for g in pk if g.distance(pt) <= p['r'])
    alte = sum(1 for t, L in ba if t == 3 and L.distance(pt) <= p['r_aiuole'])  # aiuole DBGT disegnate come siepi: nessuna (ora cordolo basso, tipo 1)
    basse = sum(1 for t, L in ba if t == 1 and L.distance(pt) <= p['r_aiuole'])
    out['parcheggio_via_del_cimitero'] = {'parcheggi_dbgt_entro_%gm' % p['r']: n, 'siepi_alte_entro_%gm' % p['r_aiuole']: alte, 'cordoli_bassi': basse, 'ok': n > 0 and alte == 0 and basse > 0}
    return out


if __name__ == '__main__':
    f = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'brianza.json')
    r = prove(json.load(open(f, encoding='utf-8')))
    for k, v in r.items(): print('OK ' if v['ok'] else 'NO ', k, v)
