"""Il posto di un albero: UNA funzione, che decide per tutti (Carlo 8/11, via San Carlo e la scuola di Seveso).
Un albero sta in un posto buono se, tutte insieme:
  - la sua chioma, col raggio che il gioco disegna davvero (raggio()), non tocca un edificio alto 3 m o piu';
  - il tronco e' fuori dalla carreggiata, dai passaggi e androni, dal fronte di porte e cancelli, dalle recinzioni, dai manufatti;
  - se si sposta, il nuovo posto e' anche fuori dal marciapiede (un albero che c'era gia' sul marciapiede, e non ha problemi, resta).
Un albero in un posto cattivo va nel posto buono piu' vicino entro MOVE m (16 direzioni, passi da 0,5 m), altrimenti si toglie.
Le prime regole (dbgt_verde, dbgt_manufatti) mettono gli alberi dove i dati li hanno; questa e' l'ultima parola, a dati finiti."""
import math
import numpy as np
import shapely
from shapely.geometry import Polygon, LineString, Point
from shapely.ops import unary_union
from shapely.strtree import STRtree

MOVE, PASSO = 5.0, 0.5
TRONCO = 0.4          # il tronco sta almeno a tanto da carreggiata, recinzioni, manufatti
PORTA, CANCELLO = 1.3, 0.9
H_MIN = 3.0           # gli edifici piu' bassi non contano (la chioma comincia piu' su)
TREE_SMALL = 7.0      # = world3.js: sotto questa altezza DSM l'albero ha il modello piccolo


def raggio(t):
    """Il raggio della chioma come la disegna world3.js: albero con altezza e diametro dal DSM -> d/2 (il modello piccolo li stringe a 0,75-1,6
    volte l'altezza della chioma); senza misure il modello scala 0,75-1,35 su 2,7 m e un poco a caso: 3 m."""
    if len(t) >= 4 and t[2] and t[3]:
        th, td = float(t[2]), float(t[3])
        if th < TREE_SMALL:
            yb = max(0.8, 0.28 * th); hc = th - yb; td = min(max(td, 0.75 * hc), 1.6 * hc)
        return td / 2.0
    return 3.0


class Posto:
    def __init__(self, edifici, carreggiata, marciapiedi, passaggi, porte, cancelli, recinzioni, manufatti):
        """edifici [(Polygon, h)]; carreggiata e marciapiedi: geometrie; passaggi: [Polygon]; porte, cancelli, recinzioni: linee [(x0, z0, x1, z1)] o liste di punti; manufatti [Polygon]"""
        self.b = [g for g, h in edifici if g is not None and not g.is_empty and (h or 0) >= H_MIN]
        self.tb = STRtree(self.b) if self.b else None
        mk = lambda gs: (lambda L: (L, STRtree(L)) if L else (None, None))([g for g in gs if g is not None and not g.is_empty])
        self.carr = carreggiata; self.mar = marciapiedi
        self.pas, self.tp = mk([p.buffer(0.4) for p in passaggi])
        ln = lambda l: LineString([(l[0], l[1]), (l[2], l[3])] if len(l) == 4 and not isinstance(l[0], (tuple, list)) else l)
        self.por, self.tpo = mk([ln(l) for l in porte])
        self.can, self.tc = mk([ln(l) for l in cancelli])
        self.rec, self.tr = mk([LineString(l) for l in recinzioni if len(l) >= 2])
        self.man, self.tm = mk(manufatti)

    @staticmethod
    def _d(tree, pts, d):
        m = np.zeros(len(pts), bool)
        if tree is not None and len(pts): a, _ = tree.query(shapely.points(pts), predicate='dwithin', distance=d); m[np.unique(a)] = True
        return m

    def _gen(self, P, r, solo_tronco):
        """True dove il punto e' un posto cattivo. solo_tronco: non conta la chioma (usato per i posti sul marciapiede)"""
        bad = np.zeros(len(P), bool)
        if not solo_tronco:
            r = np.asarray(r, float)
            for rr in np.unique(np.round(r, 1)):
                sel = np.where(np.round(r, 1) == rr)[0]; bad[sel] |= self._d(self.tb, P[sel], float(rr) + 0.05)
        pts = shapely.points(P)
        for g in (self.carr,):
            if g is not None and not g.is_empty: bad |= shapely.dwithin(pts, g, TRONCO)
        bad |= self._d(self.tp, P, 0.0)
        bad |= self._d(self.tpo, P, PORTA) | self._d(self.tc, P, CANCELLO) | self._d(self.tr, P, TRONCO) | self._d(self.tm, P, TRONCO)
        return bad

    def sistema(self, trees):
        """trees: lista di (x, z) o [x, z, h, d]. Ritorna (alberi, rapporto)"""
        n = len(trees); rep = dict(alberi=n, spostati=0, tolti=0, per_motivo={})
        if not n: return trees, rep
        P = np.array([[t[0], t[1]] for t in trees], float); R = np.array([raggio(t) for t in trees])
        bad = self._gen(P, R, False)
        out = list(trees); ang = np.linspace(0, 2 * math.pi, 16, endpoint=False); rad = np.arange(PASSO, MOVE + 0.01, PASSO)
        off = np.array([(q * math.cos(a), q * math.sin(a)) for q in rad for a in ang])
        for i in np.where(bad)[0]:
            C = P[i] + off
            ko = self._gen(C, np.full(len(C), R[i]), False) | self._d_mar(C)
            ok = np.where(~ko)[0]
            if len(ok):
                x, z = C[ok[0]]; t = trees[i]; out[i] = type(t)([x, z] + list(t[2:])) if isinstance(t, (list, tuple)) else (x, z); rep['spostati'] += 1
            else: out[i] = None; rep['tolti'] += 1
        return [t for t in out if t is not None], rep

    def _d_mar(self, C):
        if self.mar is None or self.mar.is_empty: return np.zeros(len(C), bool)
        return shapely.contains_xy(self.mar, C[:, 0], C[:, 1])
