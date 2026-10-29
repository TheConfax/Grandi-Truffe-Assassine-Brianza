# Prove fisse dei punti segnalati da Carlo il 28/10 (todo.md, correzioni-piccole-2): ogni punto e' un conteggio che la build stampa e mette in
# report.controlli_28_10.prove_fisse; se un punto non passa lo dice. Da solo: python src/prove_fisse.py [brianza.json]
import json, math, sys, os
import numpy as np
from shapely.geometry import LineString, Polygon, Point

PUNTI = {
    # via Pace, la striscia di porfido fra la banchina e il binario (Carlo, 28/10 sera): la recinzione fissa a mano (PACE_FISSE di build_data.py) fra il parapetto della banchina e la recinzione esistente, sul bordo verso il porfido (29/10)
    'pace_chiusura_banchina': dict(x=580.3, z=-751.6, r=1.5),
    # rotonda di via Papa Giovanni XXIII: i due alberi non possono essere "minuscoli" (almeno 6 m)
    'rotonda_papa_giovanni_alberi': dict(x=-549.9, z=-681.5, r=8.0, h_min=6.0),
    # parcheggio di via del Cimitero: il DBGT lo ha (AC_VEI 0301), il gioco deve averlo ('pk' della tile) entro 3 m dal punto della segnalazione; i bordi delle aiuole attorno sono cordoli bassi (kind 1), non siepi da 1,7 m (i posti dipinti li decide landmarks3.js, che li toglie dove non c'e' posto + corsia)
    'parcheggio_via_del_cimitero': dict(x=515.3, z=-230.9, r=3.0, r_aiuole=25.0),
    # Mapillary (29/10, src/mapillary_obj.py): un cartello di direzione obbligatoria (dritto) visto dalle foto lungo una via a scorrimento, che OSM non ha, deve esserci (tipo e verso)
    'mapillary_cartello_centro': dict(x=-206.5, z=219.3, r=4.0, tipo='dritto'),
    # il cartello pedoni di Mapillary nel parco di via Gramsci, in zona privata e dentro un albero (Carlo, 29/10): non deve piu' stare dentro la chioma ne' nel lotto privato
    'mapillary_pedoni_albero': dict(x=385.0, z=-81.0, r=6.0),
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
    p = PUNTI['mapillary_cartello_centro']; sm = [(s[0], s[1], s[2]) for T in D['tiles'] if T for s in T.get('sm', [])]
    n = sum(1 for k, x, z in sm if k == p['tipo'] and math.hypot(x - p['x'], z - p['z']) <= p['r'])
    out['mapillary_cartello_centro'] = {'cartelli_%s_entro_%gm' % (p['tipo'], p['r']): n, 'ok': n > 0}
    p = PUNTI['mapillary_pedoni_albero']
    chioma = lambda x, z: any(math.hypot(t[0] - x, t[1] - z) < max(0.9, 0.7 * t[3] / 2) for t in tr)
    vicini = [(k, x, z) for k, x, z in sm if math.hypot(x - p['x'], z - p['z']) <= p['r']]
    out['mapillary_pedoni_albero'] = {'cartelli_entro_%gm' % p['r']: [(k, round(x, 1), round(z, 1)) for k, x, z in vicini], 'dentro_chioma': sum(1 for k, x, z in vicini if chioma(x, z)), 'ok': not any(chioma(x, z) for k, x, z in vicini)}
    # i controlli generali: cartelli di Mapillary in giro, nessun doppione con OSM, nessuno in carreggiata (cartelli, lampioni, altri oggetti)
    M = D.get('report', {}).get('mapillary')
    if M:
        c = M['cartelli']; sul = c['sulla_carreggiata'] + M['lampioni']['sulla_carreggiata'] + M['altri_oggetti']['sulla_carreggiata']
        bar = c['su_una_barriera'] + M['lampioni']['su_una_barriera'] + M['altri_oggetti']['su_una_barriera']
        priv = c.get('in_lotto_privato', 0) + M['lampioni'].get('in_lotto_privato_o_albero', 0) + M['altri_oggetti'].get('in_lotto_privato_o_albero', 0); alb = c.get('dentro_un_albero', 0)
        out['mapillary_controlli'] = {'cartelli': len(sm), 'doppioni_con_osm': c['doppioni_con_osm'], 'sulla_carreggiata': sul, 'dentro_edifici': c['dentro_un_edificio'], 'su_barriere': bar,
                                      'in_lotto_privato_o_albero': priv + alb,
                                      'ok': len(sm) >= 150 and c['doppioni_con_osm'] == 0 and sul == 0 and c['dentro_un_edificio'] == 0 and bar == 0 and priv + alb == 0}
    return out


if __name__ == '__main__':
    f = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'brianza.json')
    r = prove(json.load(open(f, encoding='utf-8')))
    for k, v in r.items(): print('OK ' if v['ok'] else 'NO ', k, v)
