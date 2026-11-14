# Il controllo delle strisce sugli impalcati (Carlo 6/11, via Vignazzola sopra la Milano-Meda a x -15 z 767: sul ponte la carreggiata non
# aveva strisce). Per ogni impalcato stradale del terreno (terreno/indice.json, decks di tipo strada) e ogni strada che ci corre sopra
# (decks[].ra) con le righe dalla carreggiata (roads[].sg, src/dbgt_righe.py): l'asse della strada sull'impalcato, un campione ogni metro.
# Un campione ha le strisce se una riga al livello 2 (il gioco la disegna sul piano dell'impalcato; una al livello 1 sta sul suolo, sotto,
# tranne su un impalcato sotto cui non passa nessuna strada né ferrovia: world3.js, topS) corre lì accanto: entro w/2 + 1 m dall'asse e con
# lui (|cos| sopra 0.8: le righe della strada sotto passano di traverso). Un tratto (una strada su un impalcato, almeno 4 m, che ha le righe
# prima e dopo) è senza strisce se meno del 60% dei suoi campioni le ha. (Il gioco mette sull'impalcato anche le righe al livello 1 dove
# l'impalcato sta a meno di 2.5 m dal suolo: il controllo, senza le quote, non le conta.)
#   python src/controllo_strisce_ponti.py [brianza.json] [terreno/indice.json] [--elenco] [--vecchio: come il gioco prima del 6/11]
import json, math, sys
import numpy as np, shapely
from shapely.geometry import LineString, Polygon
from shapely.strtree import STRtree


def righe(d, lev):
    """i segmenti delle righe dei tile al livello lev: (A, B)"""
    A, B = [], []
    for T in d['tiles']:
        for ty, lv, s0, E in (r_[:4] for r_ in T.get('sg', []) or []):
            if lv != lev: continue
            px = pz = 0; P = []
            for i in range(0, len(E), 2): px += E[i]; pz += E[i + 1]; P.append((px / 100, pz / 100))
            for a, b in zip(P[:-1], P[1:]):
                if math.hypot(b[0] - a[0], b[1] - a[1]) > 0.05: A.append(a); B.append(b)
    return np.array(A, float).reshape(-1, 2), np.array(B, float).reshape(-1, 2)


class _Righe:
    def __init__(s, A, B):
        s.A, s.B = A, B; s.T = STRtree(shapely.linestrings(np.stack((A, B), 1))) if len(A) else None
        s.U = (B - A) / np.maximum(np.hypot(*(B - A).T), 1e-9)[:, None] if len(A) else None

    def accanto(s, p, u, r):
        """una riga corre accanto al punto p dell'asse (direzione u): il piede della perpendicolare sulla riga (mezzo metro di tolleranza),
        entro r di lato, con l'asse (|cos| sopra 0.8)"""
        if s.T is None: return False
        A, B, U = s.A, s.B, s.U
        for j in s.T.query(shapely.points(p).buffer(r)):
            if abs(float(U[j] @ u)) <= 0.8: continue
            t = float((p - A[j]) @ U[j]); Lj = float(np.hypot(*(B[j] - A[j])))
            if -0.5 <= t <= Lj + 0.5 and abs(float((p - A[j]) @ np.array([-U[j][1], U[j][0]]))) <= r: return True
        return False


def _campioni(g, passo=1.0):
    """i punti ogni passo lungo la linea g e la direzione lì"""
    for s in np.arange(passo / 2, g.length, passo):
        p = np.asarray(g.interpolate(s).coords[0]); q = np.asarray(g.interpolate(min(s + 0.5, g.length)).coords[0]) - np.asarray(g.interpolate(max(s - 0.5, 0)).coords[0])
        yield p, q / max(np.hypot(*q), 1e-9)


def controllo(d, ind, libero=True):
    """libero: le righe al livello 1 contano sugli impalcati liberi (il gioco dal 6/11; prima no)"""
    N = d['nodes']; nodo = lambda i: (N[3 * i] / 10, N[3 * i + 1] / 10)
    R2 = _Righe(*righe(d, 2)); A1, B1 = righe(d, 1); R1 = _Righe(A1, B1); A2, B2 = righe(d, 2); R12 = _Righe(np.vstack((A1, A2)), np.vstack((B1, B2)))
    tot = dict(tratti=0, senza=0, m=0, m_senza=0, senza_righe_prima_e_dopo=0); casi = []
    for dk in ind['decks']:
        if dk['tipo'] != 'strada': continue
        imp = Polygon(dk['imp']).buffer(0); so = dk.get('sotto') or {}; free = libero and not (so.get('strade') or so.get('ferrovia'))
        for ri in dk.get('ra', []):
            r = d['roads'][ri]
            if 'sg' not in r or r.get('t'): continue
            via = LineString([nodo(i) for i in r['g']]); asse = via.intersection(imp)
            parti = [g for g in getattr(asse, 'geoms', [asse]) if g.geom_type == 'LineString' and g.length >= 1]
            L = sum(g.length for g in parti)
            if L < 4: continue
            # prima e dopo: l'asse da 5 a 25 m fuori dall'impalcato; una strada senza righe lì (una via stretta, una carreggiata senza
            # righe nel DBGT) non le ha nemmeno sul ponte
            fuori = via.intersection(imp.buffer(25).difference(imp.buffer(5)))
            fp = [x for g in getattr(fuori, 'geoms', [fuori]) if g.geom_type == 'LineString' for x in _campioni(g)]
            if not fp or sum(R12.accanto(p, u, r['w'] / 2 + 1.0) for p, u in fp) < 0.5 * len(fp): tot['senza_righe_prima_e_dopo'] += 1; continue
            ok = 0; n = 0; peggio = None
            for g in parti:
                for p, u in _campioni(g):
                    si = R2.accanto(p, u, r['w'] / 2 + 1.0) or (free and R1.accanto(p, u, r['w'] / 2 + 1.0)); n += 1; ok += si
                    if not si and peggio is None: peggio = p
            tot['tratti'] += 1; tot['m'] += L
            if ok < 0.6 * n:
                tot['senza'] += 1; tot['m_senza'] += L
                casi.append((round(L), ri, dk['fonte'], round(float(peggio[0])), round(float(peggio[1])), d['names'][r['n']] if r.get('n', -1) >= 0 else ''))
    tot['m'] = round(tot['m']); tot['m_senza'] = round(tot['m_senza'])
    return tot, sorted(casi, reverse=True)


if __name__ == '__main__':
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    d = json.load(open(a[0] if a else 'brianza.json', encoding='utf-8'))
    ind = json.load(open(a[1] if len(a) > 1 else 'terreno/indice.json', encoding='utf-8'))
    tot, casi = controllo(d, ind, '--vecchio' not in sys.argv)
    print('strade su impalcato con righe prima e dopo: %(tratti)d tratti (%(m)d m); senza strisce sull\'impalcato: %(senza)d (%(m_senza)d m); '
          'strade senza righe nemmeno prima e dopo (non contate): %(senza_righe_prima_e_dopo)d' % tot)
    if '--elenco' in sys.argv:
        for c in casi: print('   %d m  strada %d  %s  http://127.0.0.1:8013/?x=%d&z=%d&piedi  %s' % c)
