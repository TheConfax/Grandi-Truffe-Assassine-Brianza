# I corsi d'acqua OSM sul fondo della valle (fiumi-ponti, 28/10; todo.md "i fiumi sono il problema più grosso"). La linea OSM di un
# torrente spesso non sta sul fondo della valle del LiDAR: al Campaccio (x 11 z -1887) correva a mezza costa sul fianco della collina, 3-4 m
# sopra il fondo asciutto accanto, e il gioco ci disegnava l'acqua. Qui ogni linea si sposta sul fondo: stazioni ogni 2 m, a ognuna i
# punti di traverso fino a R m (1 m di passo) con la quota del LiDAR, e il percorso che costa meno (Viterbi): costo di una stazione la quota
# sopra il punto più basso della sua sezione, più un poco per allontanarsi dalla linea OSM, più molto dentro una casa o una strada disegnata
# (un torrente non corre sotto l'asfalto per lungo), e lo spostamento fra due stazioni (niente zig-zag). La linea si sposta solo dove il fondo
# trovato sta davvero più in basso; le confluenze restano attaccate. Usato da build_data.py prima di tagliare i fiumi alle strade.
import os, sys, math
import numpy as np, shapely, shapely.ops
from shapely.geometry import LineString, Point

HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)

PASSO = 2.0       # stations along the line
MU = 0.6          # cost of moving 1 m sideways between two stations (per m^2 of the shift)
LONTANO = 0.04    # cost per m away from the OSM line
VIETATO = 3.0     # cost of a point in a building or on a drawn street
ANCORA, ANCORA_D = 1.0, 6.0   # near a street (within ANCORA_D) the line keeps to OSM (ANCORA per m off it): the culvert is where OSM crosses the street,
                              # and over an embankment the LiDAR across says nothing (at the Campaccio the line climbed the embankment of the road)
GUADAGNO = 0.3    # the line moves only if somewhere (over 10 m) the bottom found is this much lower


def raggio(w): return max(12.0, 4.0 + 3.0 * w)   # how far across to look: 12 m for a stream (w 1.4), 13.6 m for a river (w 3.2); the valley of the Tarò at x 0 z -2290 is 20 m wide and OSM ran 8-15 m off its bottom


def _stazioni(g, passo=PASSO):
    n = max(2, int(math.ceil(g.length / passo)) + 1); s = np.linspace(0, g.length, n)
    p = shapely.get_coordinates(shapely.line_interpolate_point(g, s))
    a = shapely.get_coordinates(shapely.line_interpolate_point(g, np.maximum(0, s - 4))); b = shapely.get_coordinates(shapely.line_interpolate_point(g, np.minimum(g.length, s + 4)))
    t = b - a; t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]
    return p, np.column_stack((-t[:, 1], t[:, 0]))


def sposta(g, w, lid, vietate=None, strade=None):
    """one line -> (new line, median drop of the LiDAR along it, offsets), or (g, 0, None) where nothing better is found"""
    if g.length < 6: return g, 0.0, None
    p, nrm = _stazioni(g); R = raggio(w); offs = np.arange(-R, R + 0.5, 1.0)
    Q = p[:, None, :] + offs[None, :, None] * nrm[:, None, :]
    E = lid.at(Q[..., 0].ravel(), Q[..., 1].ravel()).reshape(Q.shape[:2])
    if np.isnan(E[:, len(offs) // 2]).mean() > 0.2: return g, 0.0, None
    Ef = np.where(np.isnan(E), np.nanmax(E) + 5 if np.isfinite(E).any() else 0, E)
    Es = (np.pad(Ef, ((0, 0), (1, 1)), mode='edge')[:, :-2] + Ef + np.pad(Ef, ((0, 0), (1, 1)), mode='edge')[:, 2:]) / 3
    cost = Es - Es.min(1, keepdims=True) + LONTANO * np.abs(offs)[None, :]
    if vietate is not None and not vietate.is_empty:
        cost += VIETATO * shapely.contains_xy(vietate, Q[..., 0], Q[..., 1])
    if strade is not None and not strade.is_empty:
        near = shapely.dwithin(strade, shapely.points(p[:, 0], p[:, 1]), ANCORA_D)
        cost += ANCORA * near[:, None] * np.abs(offs)[None, :]
    n, m = cost.shape; D = (offs[None, :] - offs[:, None]) ** 2 * MU; D[np.abs(offs[None, :] - offs[:, None]) > 2.0] = 1e9
    acc = cost[0].copy(); back = np.zeros((n, m), int)
    for k in range(1, n):
        tot = acc[:, None] + D; back[k] = np.argmin(tot, 0); acc = tot[back[k], np.arange(m)] + cost[k]
    j = np.zeros(n, int); j[-1] = int(np.argmin(acc))
    for k in range(n - 1, 0, -1): j[k - 1] = back[k, j[k]]
    o = offs[j]; o = np.convolve(np.pad(o, 2, mode='edge'), np.ones(5) / 5, 'valid')
    c = len(offs) // 2; e0 = Es[:, c]; e1 = np.array([np.interp(o[k], offs, Es[k]) for k in range(n)])
    gl = np.convolve(np.pad(e0 - e1, 2, mode='edge'), np.ones(5) / 5, 'valid'); gain = float(gl.max())
    if gain < GUADAGNO: return g, gain, None
    q = p + o[:, None] * nrm
    return LineString(q).simplify(0.2), gain, o


PIEDE_P, PIEDE_MAX = 0.25, 20.0   # a culvert goes on under the embankment: from a street the open water starts where the ground stops falling steeper than this


def al_piede(g, inizio, lid):
    """the open piece g of a stream cut at a street: its end there (inizio: the first point, else the last) moved along it to the foot of
    the embankment, where the LiDAR along it stops falling more than PIEDE_P per m (at most PIEDE_MAX m): at the Campaccio the mouth of the
    culvert stood halfway down the embankment of the road. Returns the shorter line (or g)"""
    if g.length < 6 or lid is None: return g
    L = g.length; s = np.arange(0, min(PIEDE_MAX, L - 4) + 0.01, 1.0); t = s if inizio else L - s
    q = shapely.get_coordinates(shapely.line_interpolate_point(g, t)); h = lid.at(q[:, 0], q[:, 1])
    if np.isnan(h).any(): return g
    k = 0
    while k + 2 < len(h) and (h[k] - h[k + 2]) / 2 > PIEDE_P: k += 1
    if k == 0: return g
    a, b = (s[k], L) if inizio else (0, L - s[k])
    return shapely.ops.substring(g, a, b)


def al_fondo(lines, vietate=None, lid=None, log=print, strade=None):
    """[(LineString, w)] -> ([(LineString, w)], report). The ends that met another line before still meet it after"""
    if lid is None:
        import dbgt_quote as dq
        lid = dq.Lidar()
    if not lid.t: return lines, dict(nota='senza LiDAR: linee OSM come sono')
    if vietate is not None: shapely.prepare(vietate)
    if strade is not None: shapely.prepare(strade)
    out, mosse, gains, offs_all = [], 0, [], []
    for g, w in lines:
        g2, gain, o = sposta(g, w, lid, vietate, strade)
        if o is not None:   # a second pass from where the first one got: a valley wider than the search (OSM 20 m off the bottom of the Tarò)
            g3, gain3, o3 = sposta(g2, w, lid, vietate, strade)
            if o3 is not None: g2, gain, o = g3, gain + gain3, o + o3 if len(o3) == len(o) else o
            mosse += 1; gains.append(gain); offs_all.append(np.abs(o))
        out.append((g2, w))
    # confluences: an end within 1 m of another line before the move goes onto that line after it
    old = [g for g, _ in lines]; attaccati = 0
    for i, (g2, w) in enumerate(out):
        c = list(g2.coords)
        for ei, E in ((0, Point(lines[i][0].coords[0])), (-1, Point(lines[i][0].coords[-1]))):
            for j, o_ in enumerate(old):
                if j == i or o_.distance(E) > 1.0: continue
                nj = out[j][0]; q = nj.interpolate(nj.project(Point(c[ei])))
                if q.distance(Point(c[ei])) < 20: c[ei] = (q.x, q.y); attaccati += 1
                break
        if len(c) >= 2: out[i] = (LineString(c), w)
    oa = np.concatenate(offs_all) if offs_all else np.zeros(0)
    al_fondo.lid = lid
    rep = dict(linee=len(lines), spostate=mosse, abbassate_al_massimo_mediana_m=round(float(np.median(gains)), 2) if gains else 0, spostamento_p50_m=round(float(np.median(oa)), 1) if len(oa) else 0,
               spostamento_p90_m=round(float(np.percentile(oa, 90)), 1) if len(oa) else 0, confluenze_riattaccate=attaccati)
    log('fiumi sul fondo della valle: %s' % rep)
    return out, rep
