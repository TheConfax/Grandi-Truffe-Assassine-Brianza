# Le opere di attraversamento come un flusso di costruzione solo, con una regola per tutta la mappa (todo.md, correzioni del 1/11, punti 7 e 8).
#
# SOTTOPASSI (una strada che passa sotto una ferrovia o un'altra strada, senza PONTE nel DBGT). Forme e quote dal DBGT, attributi da OSM:
#   - si parte da una via OSM tunnel=yes per auto (non building_passage), con sotto un asse EL_STR del DBGT almeno LUCE_MIN sotto il suolo. Fonti: tutte e due, o niente;
#     l'asse SED=03 ("in galleria") basta senza OSM solo se c'e il poligono GALLER
#   - l'asse continua lungo la rete del DBGT finche non torna alla quota del suolo: quella e la trincea
#   - larghezza dalla GALLER (taglio trasversale), altrimenti dalle aree SED=03, altrimenti neutra (LARGA_NEUTRA); stretta dove accanto corre una strada a un altro livello
#   - coperto dove c'e la GALLER o la via tunnel e sopra resta abbastanza suolo; altrove aperto
# La superficie S non si tocca: chi sta sopra (la ferrovia con la sua quota, la Milano-Meda) resta dov'e, treno compreso.
# L'opera e un pezzo solo, e prima viene lei: un fondo, due pareti continue dal fondo alla cima, una soletta a una quota sola lungo tutto il tratto coperto, un fronte che chiude
# ogni testata del coperto, un parapetto con spessore sopra le pareti aperte e sopra il fronte. Poi il terreno e la vernice si tagliano attorno al suo contorno, a filo.
# Dove sopra la soletta c'e S abbastanza, S resta disegnata ('galleria': sotto c'e un livello in piu che legge solo H.surface(x, z, cy) con cy sotto il soffitto, src/altezze3.js);
# altrove l'opera prende le celle di S (tipo 'rampa', sotto=True, con tetto dove e coperta: sopra c'e l'impalcato). Niente serranda, fondo d'asfalto.
#
# CAVALCAVIA: ogni PONTE con muri di sostegno (MU_SOS) o scarpate (SCARPT) del DBGT entro 30 m e un'opera fatta dai suoi pezzi (opere_dbgt): dentro la sua
# impronta il suolo e solo del DBGT, mai il LiDAR. In ordine: la strada di sotto alla quota dei suoi assi; i muri e le scarpate con la quota dei loro vertici;
# sotto l'impalcato la strada di sotto piana fino alle spalle; il resto armonico fra questi. Le spalle (muri di cemento con spessore dove l'impalcato
# appoggia) e l'impalcato li fa impalcati.py e li disegna il gioco. Prima qui c'era una scarpata 1:1,5 inventata sopra il LiDAR: tolta (Carlo, 3/11).
# Le aree a raso con vertici presi dal livello di sopra stanno alla quota della strada (cavalcavia()). Le RIGHE dentro le opere si prolungano da quelle
# alle bocche (righe_opere); le SCALE di OSM scavate nel suolo sono fosse con i gradini (scale).
import os, sys, numpy as np, shapely
from shapely.geometry import LineString, Polygon, box, Point
from scipy import ndimage

LUCE_MIN = 2.5     # m: sotto meno di questo non ci passa niente
SP_SOLETTA = 0.9   # m: spessore della soletta dei cavalcavia (come impalcati.SP: valore generico, il DBGT non lo dice)
SP_OPERA = 1.25    # m: dalla cima al soffitto dell'opera (generico: la soletta, e la pancia degli impalcati sopra non sporge sotto)
PIANO = 1.0        # m: la cima dell'opera e il suolo entro tanto dal punto piu alto del tratto coperto (le testate stanno piu in basso, sulla scarpata)
PARAPETTO = 1.0    # m sopra il suolo, come PIT_PAR di world3.js
BOCCA = 0.15       # m: dove il fondo arriva a tanto dal suolo finisce la trincea
LARGA_NEUTRA = 3.5 # m: mezza larghezza quando il DBGT non la da (neutra, una corsia per senso)
MEZZA_STRADA = 2.75  # m: quanto si tiene lontano dall'asse di una strada a un altro livello ...
MARGINE = 0.3      # ... piu questo
MEZZA_MIN = 3.25   # m: la trincea non si stringe sotto questo (due corsie)
PASSO = 1.0        # m fra le stazioni lungo l'asse
OLTRE_STRADA = 8   # stazioni: oltre la GALLER il coperto va fin dove sopra c'e la strada, al massimo di tanto
OLTRE_GALLER = 3   # stazioni: il coperto va oltre il bordo della GALLER al massimo di tanto
MARGINE_S = 1      # stazioni: il coperto comincia dove S e alta anche tante stazioni prima e dopo (una cella di S e 2 m)
RAMO_MAX, RAMO_DZ, RAMO_LARGO, RAMO_SOTTO = 9.0, 0.6, 3.0, 0.2   # m: un altro asse del fondo entro tanto dall'asse, a tanto di quota, il margine che gli si lascia verso la parete, e quanto sta sotto il suolo (sopra e un'altra strada)
ALLUNGA_MAX = 160.0  # m: per lato, oltre questo non e una trincea
COPERTO_OSM = 6.0  # m: una stazione cosi vicina alla via tunnel di OSM e coperta
GALLER_M = 1.0     # m: oltre il bordo della GALLER il coperto va ancora tanto, se sopra c'e la strada (il fronte col suo parapetto sta oltre il bordo della strada)
PIENA_M = 1.5      # m: S sopra una galleria stradale e alla quota della strada di sopra fin tanto oltre la GALLER (galleria_piena)
SOPRA_MIN = 0.7    # m: un vertice di un'area piu di tanto sopra il livello della strada sotto e del livello di sopra


def assi_dbgt(D):
    E = D['EL_STR']; out = []
    for i in range(len(E['off']) - 1):
        a, b = E['off'][i], E['off'][i + 1]
        if b - a < 2: continue
        xy, z = E['xy'][a:b], E['z'][a:b]
        if np.isnan(z).all(): continue
        z = np.where(np.isnan(z), np.nanmedian(z), z)
        out.append(dict(k=i, id=int(E['id'][i]), xy=xy, z=z, sed=E['attr']['sed'][i], liv=E['attr']['liv'][i], g=LineString(xy)))
    return out


def poligoni(D, nm, cond=lambda i: True):
    import superficie as sf
    L = D.get(nm)
    return [] if L is None else [sf.poly(L, i) for i in range(len(L['off']) - 1) if cond(i)]


def gallerie_stradali(D, minimo=5.0):
    """i poligoni GALLER con dentro almeno `minimo` m di assi EL_STR in galleria (SED=03): una strada passa sotto. Per il DBGT sopra non c'e un ponte ma
    il suolo pieno (il rilevato della Milano-Meda, x -768 z 103): le strade di sopra stanno su S alla loro quota e non diventano impalcati (superficie.tetto)"""
    assi = [a['g'] for a in assi_dbgt(D) if a['sed'] == '03']
    if not assi: return []
    tree = shapely.STRtree(assi); out = []
    for p in poligoni(D, 'GALLER'):
        if not p.is_valid: p = p.buffer(0)
        if p.area < 20: continue
        if sum(assi[j].intersection(p).length for j in tree.query(p)) >= minimo: out.append(p)
    return out


def tunnel_osm(osm):
    """le vie OSM per auto in galleria (un androne non e una galleria)"""
    CAR = {'motorway', 'motorway_link', 'trunk', 'trunk_link', 'primary', 'primary_link', 'secondary', 'secondary_link', 'tertiary', 'tertiary_link', 'unclassified', 'residential', 'service', 'living_street', 'road'}
    return [w for w in osm if w['t'].get('tunnel') in ('yes', 'covered') and w['t'].get('highway') in CAR]


def trova(D, quota, osm, log=lambda *a: None):
    """i sottopassi: lista di dict con le stazioni (C, y, hl, hr, coperta). quota(x, z): il suolo di sopra. rep: perche una galleria OSM non e diventata un sottopasso"""
    assi = assi_dbgt(D); tree = shapely.STRtree([a['g'] for a in assi]); ponti = poligoni(D, 'PONTE')
    pu = shapely.union_all(ponti) if ponti else Polygon()
    gall = [p for p, z in zip(poligoni(D, 'GALLER'), range(10 ** 6)) if p.area >= 20 and np.nanmedian(_z_poly(D, 'GALLER', z)) > 50]
    W = tunnel_osm(osm); usati = set(); gruppi = []; scartati = []
    for w in W:
        g = LineString(w['p'])
        if g.distance(pu) < 6: scartati.append(dict(osm=w['id'], motivo='sotto un PONTE: ci pensa l impalcato', c=_c(g))); continue
        m = g.interpolate(0.5, normalized=True); top = float(quota(m.x, m.y)); sem = []
        dv = np.asarray(g.coords[-1]) - np.asarray(g.coords[0]); dv = dv / max(np.hypot(*dv), 1e-9)
        for j in tree.query(g.buffer(5.0)):
            a = assi[j]
            if np.median(a['z']) > top - LUCE_MIN: continue
            pr = a['g'].intersection(g.buffer(5.0))
            if pr.length < 2 and a['sed'] != '03': continue
            da = np.asarray(a['xy'][-1]) - np.asarray(a['xy'][0]); da = da / max(np.hypot(*da), 1e-9)
            if abs(da @ dv) < 0.8: continue     # una strada bassa che incrocia, non quella della galleria
            sem.append(j)
        if not sem: scartati.append(dict(osm=w['id'], nome=w['t'].get('name'), motivo='nessun asse DBGT sotto il suolo', c=_c(g))); continue
        if any(assi[j]['g'].length >= 5 for j in sem): sem = [j for j in sem if assi[j]['g'].length >= 2]   # (via Farga: un asse SED=03 di pochi cm)
        if any(j in usati for j in sem):
            for gr in gruppi:
                if set(sem) & gr['semi']: gr['semi'] |= set(sem); gr['vie'].append(w)
            usati |= set(sem); continue
        gruppi.append(dict(semi=set(sem), vie=[w])); usati |= set(sem)
    # SED=03 senza via tunnel in OSM: basta la GALLER
    for j, a in enumerate(assi):
        if a['sed'] == '03' and j not in usati and any(p.distance(a['g']) < 3 for p in gall) and a['g'].length >= 5:
            gruppi.append(dict(semi={j}, vie=[])); usati.add(j)
    out = []
    for gr in gruppi:
        c = _catena(assi, gr['semi'], quota)
        if c is None: scartati.append(dict(osm=[w['id'] for w in gr['vie']], motivo='assi non in fila')); continue
        s = _stazioni(c, assi, gr, gall, quota, D)
        if s is None: scartati.append(dict(osm=[w['id'] for w in gr['vie']], motivo='fondo a meno di %.1f m dal suolo' % LUCE_MIN)); continue
        s['vie'] = [w['id'] for w in gr['vie']]; s['nome'] = next((w['t'].get('name') for w in gr['vie'] if w['t'].get('name')), None); out.append(s)
    # i sottopassi pedonali: una via OSM a piedi in galleria dentro una GALLER senza strade (il sottopasso della stazione di Meda, x 325 z -500)
    npd = 0; gs_str = gallerie_stradali(D)
    for w in osm:
        t = w['t']
        if t.get('highway') not in PIEDI or t.get('tunnel') not in ('yes', 'covered'): continue
        g = LineString(w['p'])
        if g.length < 4: continue
        gg = [p for p in gall if p.intersection(g).length > 0.6 * g.length and not any(p.intersects(q) for q in gs_str)]
        if not gg: continue
        s = _pedonale(w, osm, gg, quota)
        if s is None: scartati.append(dict(osm=w['id'], motivo='pedonale: fondo non trovato o luce sotto %.1f m' % LUCE_PED, c=_c(g))); continue
        s['vie'] = [w['id']]; s['nome'] = t.get('name'); out.append(s); npd += 1
    log('sottopassi: %d, di cui pedonali %d (vie OSM in galleria per auto %d, scartate %d)' % (len(out), npd, len(W), len(scartati)))
    return out, scartati


PIEDI = ('footway', 'path', 'pedestrian', 'cycleway', 'steps')
LUCE_PED = 2.1     # m: sotto meno di questo un pedone non passa
SP_PED = 0.9       # m: la soletta di un sottopasso pedonale (come impalcati.SP)
MEZZA_PED = 1.5    # m: mezza larghezza quando non c'e la GALLER (neutra)


def coperto(dentro, alto):
    """the stations under the cover: the runs where S stands high enough over the ceiling that touch the GALLER (past its edge, OLTRE_GALLER at most, as long as the bank
    stays high: the edge of the Milano-Meda carriageway is 2 m past the GALLER at x -768 z 88), less MARGINE_S at each end (a cell of S across the
    edge of the bank dipped under the ceiling: a V of ground in the mouth)"""
    lab, _ = ndimage.label(alto); k = np.unique(lab[dentro & alto]); k = k[k > 0]
    vicino = ndimage.binary_dilation(dentro, np.ones(2 * OLTRE_GALLER + 1, bool))   # (not further: over an open trench S stays at grade, the trench is not in S)
    return ndimage.binary_erosion(np.isin(lab, k) & vicino, np.ones(2 * MARGINE_S + 1, bool), border_value=1)


def _pedonale(w, osm, gall, quota):
    """un sottopasso pedonale: la via in galleria fra le due bocche, il fondo dalle buche delle scale che il LiDAR vede alle due teste (S, il punto piu
    basso entro 6 m lungo la via che continua), allungato verso ogni buca finche S non arriva al fondo: quel tratto e aperto (le pareti della buca)"""
    P = np.asarray(w['p'], float)
    def cont(end, d0):   # the way that goes on from this end (the steps): its direction, else the tunnel's own
        best = None
        for v in osm:
            if v is w or not v['t'].get('highway'): continue
            q = np.asarray(v['p'], float)
            for a, b in ((q[0], q[min(1, len(q) - 1)]), (q[-1], q[max(len(q) - 2, 0)])):
                if np.hypot(*(a - end)) < 0.5 and np.hypot(*(b - a)) > 0.5:
                    d = (b - a) / np.hypot(*(b - a))
                    if d @ d0 > 0.3 and (best is None or d @ d0 > best @ d0): best = d
        return best if best is not None else d0
    capi = []
    for end, nxt in ((P[0], P[1]), (P[-1], P[-2])):
        d0 = (end - nxt) / max(np.hypot(*(end - nxt)), 1e-9); d = cont(end, d0)
        ss = np.arange(0, 6.01, 0.25); zz = np.array([float(quota(*(end + d * s))) for s in ss]); i = int(np.argmin(zz))
        capi.append((d, ss, zz, i))
    yb = [float(c[2][c[3]]) for c in capi]
    if any(not np.isfinite(v) for v in yb): return None
    # the chain: from the bottom of the first hole, along the tunnel, to the bottom of the other
    (d0, s0, z0, i0), (d1, s1, z1, i1) = capi
    pre = [P[0] + d0 * s for s in np.arange(s0[i0], 0, -0.5)]; post = [P[-1] + d1 * s for s in np.arange(0.5, s1[i1] + 0.01, 0.5)]
    Q = np.array(pre + [p for p in P] + post); sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T)))); k_ = np.concatenate(([True], np.diff(sv) > 1e-6)); Q, sv = Q[k_], sv[k_]
    st = np.arange(0, sv[-1] + PASSO / 2, PASSO); C = np.column_stack((np.interp(st, sv, Q[:, 0]), np.interp(st, sv, Q[:, 1]))); n = len(C)
    y = np.interp(st, [0, sv[-1]], yb)
    T = np.gradient(C, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; Nn = np.column_stack((-T[:, 1], T[:, 0]))
    hl, hr = np.full(n, np.nan), np.full(n, np.nan)
    for k in range(n):
        for g in gall:
            if not g.contains(Point(C[k])): continue
            for arr, sg in ((hl, 1), (hr, -1)):
                r = LineString([C[k], C[k] + sg * Nn[k] * 15]).intersection(g)
                if not r.is_empty: arr[k] = r.length if r.geom_type == 'LineString' else max(q.length for q in r.geoms if q.geom_type == 'LineString')
    def stende(v):
        ok = np.isfinite(v)
        return np.full(n, MEZZA_PED) if not ok.any() else np.full(n, float(np.clip(np.median(v[ok]), 1.0, 4.0)))
    hl, hr = stende(hl), stende(hr)
    Lft, Rgt = C + Nn * hl[:, None], C - Nn * hr[:, None]
    tl, tr = np.array([float(quota(*q)) for q in Lft]), np.array([float(quota(*q)) for q in Rgt]); tp = np.minimum(np.minimum(tl, tr), np.array([float(quota(*q)) for q in C]))
    dentro = np.array([any(g.contains(Point(q)) for g in gall) for q in C])
    if not dentro.any(): return None
    vt = tp[dentro]; soff = float(np.median(vt[vt > vt.max() - PIANO]) - SP_PED)
    if soff - y[dentro].max() < LUCE_PED: return None
    gal = coperto(dentro, tp >= soff + SP_PED - PIANO * 0.5); idx = np.nonzero(gal)[0]
    if not len(idx): return None
    gal[:] = False; gal[idx[0]:idx[-1] + 1] = True; cop = gal.copy()
    if idx[-1] + 1 < n: cop[idx[-1] + 1] = True
    def cima(tq, yq):
        ts = ndimage.gaussian_filter1d(tq, 3.0, mode='nearest'); par = np.minimum(PARAPETTO, np.maximum(0.0, ts - yq)); t = np.maximum(ts + par, tq + np.minimum(par, 0.3))
        return ndimage.gaussian_filter1d(t, 1.0, mode='nearest')
    return dict(C=C, y=y, yl=y.copy(), yr=y.copy(), Lft=Lft, Rgt=Rgt, N=Nn, tp=tp, hl=hl, hr=hr, cop=cop, gal=gal, soff=soff, csx=cima(tl, y), cdx=cima(tr, y), fonte='GALLER pedonale',
                prof=float((tp - y).max()), lung=float(n - 1) * PASSO, pedonale=True)


def _z_poly(D, nm, i):
    L = D[nm]; return L['z0'][L['off'][i]:L['off'][i + 1]]


def _c(g): c = g.centroid; return [round(c.x, 1), round(c.y, 1)]


def _catena(assi, semi, quota):
    """gli assi semi messi in fila e allungati da tutte e due le parti lungo la rete finche il fondo torna al suolo: (xy, z)"""
    key = lambda p: (int(round(p[0])), int(round(p[1])))
    fine = {}
    for j, a in enumerate(assi):
        fine.setdefault(key(a['xy'][0]), []).append((j, 0)); fine.setdefault(key(a['xy'][-1]), []).append((j, 1))
    semi = set(semi); inizio = None
    gradi = {}
    for j in semi:
        for e in (0, -1): gradi[key(assi[j]['xy'][e])] = gradi.get(key(assi[j]['xy'][e]), 0) + 1
    capi = [k for k, v in gradi.items() if v == 1]
    if not capi: return None
    # in fila dal primo capo: su un incrocio si prende il seme che continua
    k = capi[0]; fatti = set(); P, Z = [], []
    while True:
        nx = [(j, e) for j, e in fine.get(k, []) if j in semi and j not in fatti]
        if not nx: break
        j, e = nx[0]; fatti.add(j); a = assi[j]; xy, z = (a['xy'], a['z']) if e == 0 else (a['xy'][::-1], a['z'][::-1])
        P.append(xy if not P else xy[1:]); Z.append(z if not Z else z[1:]); k = key(xy[-1])
    if len(fatti) < len(semi): return None
    P, Z = np.vstack(P), np.concatenate(Z)
    for lato in (0, 1):
        if lato: P, Z = P[::-1], Z[::-1]
        L = 0.0; k = key(P[-1]); visti = set(fatti)
        while L < ALLUNGA_MAX and quota(P[-1][0], P[-1][1]) - Z[-1] > BOCCA:
            d0 = P[-1] - P[-2]; d0 = d0 / max(np.hypot(*d0), 1e-9); best = None
            for j, e in fine.get(k, []):
                if j in visti: continue
                a = assi[j]; xy, z = (a['xy'], a['z']) if e == 0 else (a['xy'][::-1], a['z'][::-1])
                if abs(z[0] - Z[-1]) > 0.8: continue    # un altro livello
                d = xy[min(3, len(xy) - 1)] - xy[0]; d = d / max(np.hypot(*d), 1e-9); v = float(d @ d0)
                if v > 0.6 and (best is None or v > best[0]): best = (v, j, xy, z)
            if best is None: break
            _, j, xy, z = best; visti.add(j); L += LineString(xy).length; P = np.vstack((P, xy[1:])); Z = np.concatenate((Z, z[1:])); k = key(xy[-1])
    return P, Z


def _stazioni(cat, assi, gr, gall, quota, D):
    P, Z = cat; sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(P, axis=0).T)))); keep = np.concatenate(([True], np.diff(sv) > 1e-6)); P, Z, sv = P[keep], Z[keep], sv[keep]
    st = np.arange(0, sv[-1] + PASSO / 2, PASSO); C = np.column_stack((np.interp(st, sv, P[:, 0]), np.interp(st, sv, P[:, 1]))); y = np.interp(st, sv, Z)
    C = np.column_stack([ndimage.gaussian_filter1d(C[:, j], 1.5, mode='nearest') for j in (0, 1)]); y = ndimage.gaussian_filter1d(y, 2.0, mode='nearest')
    top = np.array([float(quota(*q)) for q in C]); prof = top - y
    # il tratto: attorno al punto piu profondo, fino a dove il fondo torna al suolo
    i = int(np.argmax(prof))
    if prof[i] < LUCE_MIN: return None
    a = i
    while a > 0 and prof[a] > BOCCA: a -= 1
    b = i
    while b < len(st) - 1 and prof[b] > BOCCA: b += 1
    C, y, top = C[a:b + 1], y[a:b + 1], top[a:b + 1]; n = len(C)
    T = np.gradient(C, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; Nn = np.column_stack((-T[:, 1], T[:, 0]))
    catg = LineString(C); gs = [p for p in gall if p.distance(catg) < 4]
    # larghezza: il taglio della GALLER; fuori, la mediana dei suoi tagli; senza GALLER le aree in galleria; senza, neutra
    hl, hr = np.full(n, np.nan), np.full(n, np.nan)
    for k in range(n):
        for g in gs:
            if not g.contains(Point(C[k])): continue
            for arr, sg in ((hl, 1), (hr, -1)):
                r = LineString([C[k], C[k] + sg * Nn[k] * 30]).intersection(g)
                if not r.is_empty: arr[k] = r.length if r.geom_type == 'LineString' else max(q.length for q in r.geoms if q.geom_type == 'LineString')
    fonte = 'GALLER' if np.isfinite(hl).any() else None
    if fonte is None:
        sed3 = [p for nm in ('AC_VEI', 'AR_STR') for p, q in zip(poligoni(D, nm), D[nm]['attr']['sed']) if q == '03' and p.distance(catg) < 4 and p.area > 15]
        for k in range(n):
            for g in sed3:
                if not g.contains(Point(C[k])): continue
                for arr, sg in ((hl, 1), (hr, -1)):
                    r = LineString([C[k], C[k] + sg * Nn[k] * 30]).intersection(g)
                    if not r.is_empty and r.geom_type == 'LineString': arr[k] = r.length
        fonte = 'aree SED=03' if np.isfinite(hl).any() else 'neutra'
    def stende(v, d):
        ok = np.isfinite(v)
        return np.full(n, d) if not ok.any() else np.where(ok, np.clip(v, MEZZA_MIN, 8.0), float(np.clip(np.median(v[ok]), MEZZA_MIN, 8.0)))
    hl, hr = stende(hl, LARGA_NEUTRA), stende(hr, LARGA_NEUTRA)
    # accanto corre una strada a un altro livello: ci si stringe (dove la trincea e aperta; sotto la GALLER comanda lei)
    cat_ids = {j for j, a_ in enumerate(assi) if a_['g'].distance(catg) < 0.5 and np.abs(np.median(a_['z']) - np.median(y)) < 8 and _su_catena(a_, catg)}
    altri = [a_ for j, a_ in enumerate(assi) if j not in cat_ids and a_['g'].distance(catg) < 15]
    dentro = np.array([any(g.contains(Point(q)) for g in gs) for q in C])
    for arr, sg in ((hl, 1), (hr, -1)):
        lim = np.full(n, np.inf)
        for k in range(n):
            if dentro[k]: continue
            r = LineString([C[k], C[k] + sg * Nn[k] * 12])
            for a_ in altri:
                if not r.intersects(a_['g']): continue
                x_ = r.intersection(a_['g']); d = C[k].astype(float); q = x_.representative_point(); dd = np.hypot(q.x - d[0], q.y - d[1])
                zq = np.interp(a_['g'].project(q), np.concatenate(([0], np.cumsum(np.hypot(*np.diff(a_['xy'], axis=0).T)))), a_['z'])
                if abs(zq - y[k]) > 1.0: lim[k] = min(lim[k], dd - MEZZA_STRADA - MARGINE)
        lim = ndimage.minimum_filter1d(lim, 7, mode='nearest'); arr[:] = np.maximum(np.minimum(arr, lim), MEZZA_MIN)
        arr[:] = ndimage.gaussian_filter1d(arr, 1.5, mode='nearest')
    # dove la strada si biforca verso la bocca l'altro ramo, alla stessa quota, resta dentro: la trincea si apre
    for arr, sg in ((hl, 1), (hr, -1)):
        ap = arr.copy()
        for k in range(n):
            if dentro[k]: continue
            r = LineString([C[k], C[k] + sg * Nn[k] * RAMO_MAX])
            for a_ in altri:
                if not r.intersects(a_['g']): continue
                q = r.intersection(a_['g']).representative_point(); dd = np.hypot(q.x - C[k][0], q.y - C[k][1])
                zq = np.interp(a_['g'].project(q), np.concatenate(([0], np.cumsum(np.hypot(*np.diff(a_['xy'], axis=0).T)))), a_['z'])
                if abs(zq - y[k]) < RAMO_DZ and float(quota(q.x, q.y)) - zq > RAMO_SOTTO and dd + RAMO_LARGO > ap[k]: ap[k] = dd + RAMO_LARGO
        arr[:] = ndimage.gaussian_filter1d(ap, 2.0, mode='nearest')
    Lft, Rgt = C + Nn * hl[:, None], C - Nn * hr[:, None]
    tl, tr = np.array([float(quota(*q)) for q in Lft]), np.array([float(quota(*q)) for q in Rgt]); tp = np.minimum(np.minimum(tl, tr), np.array([float(quota(*q)) for q in C]))
    # alle bocche il fondo prende il suolo su ogni lato, in piano entro 3 m
    bl = np.clip(1 - np.arange(n) / 3.0, 0, 1); br = bl[::-1]
    # the mouth meets the street beyond it with no step (Carlo 3/11, via Montecassino: through the gap of 0.2-0.3 m between the end of the floor and the street
    # one saw the sky): the end station takes the ground 1 m past the end, on each side and in the middle, and the floor bends to it over 3 m
    T_ = np.gradient(C, axis=0); T_ /= np.maximum(np.hypot(*T_.T), 1e-9)[:, None]
    # The street beyond the mouth on its middle line, for both sides (Carlo 3/11, via Montecassino x 830 z 2145 and x 680 z 2107: a jump in the car and grass
    # in the gap). Its sides are higher than its middle (kerbs, the ground by the walls: 0.3-0.4 m at x 830); a floor end that took them stood that much over the
    # street where the cars pass. The sides that stay lower than the ground are closed by a face (world3.js opSoglia)
    oltre = lambda P_, k, sg: float(quota(*(P_[k] + sg * T_[k] * 0.3)))
    e0, e1 = oltre(C, 0, -1), oltre(C, n - 1, 1)
    yl = y + (e0 - y[0]) * bl + (e1 - y[-1]) * br; yr = yl.copy()
    # coperta: dentro la GALLER (senza GALLER vicino alla via tunnel). Una soletta sola: la quota viene dal tratto piu alto del coperto, e vale per tutto il coperto
    vie = [LineString(w['p']) for w in gr['vie'] if w['t'].get('tunnel') in ('yes', 'covered')]
    cop = np.array([dentro[k] or (not gs and any(v.distance(Point(C[k])) < COPERTO_OSM for v in vie)) for k in range(n)]); cop = ndimage.binary_closing(cop, np.ones(5, bool)) | cop
    soff = None; gal = np.zeros(n, bool)
    if cop.any():
        vt = tp[cop]; soff = float(np.median(vt[vt > vt.max() - PIANO]) - SP_OPERA)
        if soff - max(yl[cop].max(), yr[cop].max()) < LUCE_MIN: cop[:] = False; soff = None
    if soff is not None:
        # coperto e solo dove sopra la soletta resta S abbastanza: li c'e la galleria e S resta disegnata sopra. Dove S scende sotto la cima della soletta
        # (la scarpata davanti alla testata) la trincea e aperta: un tetto senza niente sopra era un buco nel suolo, e un fronte appeso a un impalcato
        # che non c'e piu (le gallerie stradali non hanno impalcati sopra: galleria_stradale, superficie.tetto)
        # the road over it is covered all its width, its sidewalks too: the front stands at its edge, not inside its carriageway (x -768 z 117 under the
        # Milano-Meda: the front closed 2 m into the carriageway over it, Carlo 3/11). A station whose sides lie in an area at grade of the DBGT standing
        # over the ceiling is under that road
        import superficie as sf_
        sopra_ = [sf_.poly(D[nm], i) for nm in ('AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR') if nm in D for i in range(len(D[nm]['off']) - 1) if sf_.sed_ok(D[nm], i) and np.nanmedian(D[nm]['z'][D[nm]['off'][i]:D[nm]['off'][i + 1]]) > soff + SP_OPERA - PIANO]
        tr_ = shapely.STRtree(sopra_) if sopra_ else None
        strada_sopra = np.array([tr_ is not None and any(sopra_[j].contains(Point(q)) for q in (Lft[k], Rgt[k], C[k]) for j in tr_.query(Point(q))) for k in range(n)])
        alto_ = tp >= soff + SP_OPERA - PIANO * 0.5
        # what the DBGT has in gallery (the GALLER, GALLER_M past its edge) is covered whatever S does there: the front stands at the edge of the road over it,
        # with its parapet (Carlo 3/11, x -768 z 94 and 116: the front stood 2-4 m into the Milano-Meda, which lost its edge and its parapets; it was cut where S,
        # one cell of 2 m, began to fall down the bank). S over it is made up to the road (galleria_piena)
        dentro_b = np.array([any(g_.buffer(GALLER_M).contains(Point(q)) for g_ in gs) for q in C]) & strada_sopra if gs else np.zeros(n, bool)
        idx = np.nonzero(coperto(cop, alto_) | (strada_sopra & alto_ & ndimage.binary_dilation(cop, np.ones(2 * OLTRE_STRADA + 1, bool))) | dentro_b)[0]
        cop[:] = False
        if len(idx):
            gal[idx[0]:idx[-1] + 1] = True; cop[idx[0]:idx[-1] + 1] = True
            if idx[-1] + 1 < n: cop[idx[-1] + 1] = True     # (il tratto arriva alla stazione di confine)
        else: soff = None
    def cima(tq, yq):   # la riga del parapetto: una linea continua sopra il suolo liscio, mai sotto il suolo vero
        ts = ndimage.gaussian_filter1d(tq, 3.0, mode='nearest'); par = np.minimum(PARAPETTO, np.maximum(0.0, ts - yq)); t = np.maximum(ts + par, tq + np.minimum(par, 0.3))
        return ndimage.gaussian_filter1d(t, 1.0, mode='nearest')
    return dict(C=C, y=y, yl=yl, yr=yr, Lft=Lft, Rgt=Rgt, N=Nn, tp=tp, hl=hl, hr=hr, cop=cop, gal=gal, soff=soff, csx=cima(tl, yl), cdx=cima(tr, yr), fonte=fonte, prof=float((tp - y).max()), lung=float(n - 1) * PASSO)


def _su_catena(a_, catg):
    pts = [a_['g'].interpolate(t, normalized=True) for t in (0.1, 0.5, 0.9)]
    return all(p.distance(catg) < 0.8 for p in pts)


def celle_anello(poly):
    """le celle di S che il contorno tocca e il suolo di quelle celle fuori dal contorno (come sottoterra.py)"""
    import superficie as sf_
    st = 2.0; nct = int(sf_.TILE / st); bx0, bz0, bx1, bz1 = poly.bounds
    i0, i1 = int(np.floor((bx0 + sf_.HW) / st)), int(np.floor((bx1 + sf_.HW) / st)); j0, j1 = int(np.floor((bz0 + sf_.HH) / st)), int(np.floor((bz1 + sf_.HH) / st))
    celle, anello = {}, []; shapely.prepare(poly)
    for J in range(j0, j1 + 1):
        for I in range(i0, i1 + 1):
            x0, z0 = -sf_.HW + I * st, -sf_.HH + J * st
            if not poly.intersects(box(x0, z0, x0 + st, z0 + st)): continue
            tx, tz = I // nct, J // nct; wloc = (J - tz * nct) * nct + (I - tx * nct); key = '%d_%d' % (tx, tz)
            celle.setdefault(key, []).append(int(wloc)); flat = []
            for tri in (Polygon([(x0, z0), (x0 + st, z0), (x0 + st, z0 + st)]), Polygon([(x0, z0), (x0 + st, z0 + st), (x0, z0 + st)])):
                rest = tri.difference(poly)
                if rest.is_empty or rest.area < 1e-4: continue
                for t in shapely.get_parts(shapely.constrained_delaunay_triangles(rest)):
                    cxy = np.asarray(t.exterior.coords)[:3]
                    if t.area < 1e-6 or not rest.buffer(1e-6).contains(t.centroid): continue
                    flat += [round(float(v), 3) for v in cxy.ravel()]
            if flat: anello.append([key, int(wloc), flat])
    return celle, anello


def tratti(s):
    """i tratti consecutivi che lasciano S o prendono le sue celle: (S resta sopra, k0, k1), con la stazione di confine in tutti e due"""
    gal = s['gal']; out = []; k0 = 0
    for k in range(1, len(gal)):
        if gal[k] != gal[k - 1]: out.append((bool(gal[k - 1]), k0, k)); k0 = k
    out.append((bool(gal[-1]), k0, len(gal) - 1))
    return out


def _sagoma(s, a, b, m=0.0):
    N_ = s['N'][a:b + 1]; p = Polygon(np.vstack((s['Lft'][a:b + 1] + N_ * m, (s['Rgt'][a:b + 1] - N_ * m)[::-1])))
    return p if p.is_valid else p.buffer(0)


def impronte(sotto, m=0.0):
    """per la build dei dati: i contorni, allargati di m solo di lato (alle bocche la vernice arriva al fondo), di quel che prende le celle di S e di quel che le lascia"""
    ap, co = [], []
    for s in sotto:
        for g, a, b in tratti(s):
            if b - a >= 1: (co if g else ap).append(_sagoma(s, a, b, m))
    return ap, co


def fosse_gioco(sotto, nodo=lambda x, z: None):
    """le fosse per terreno/indice.json: un oggetto per tratto, tipo 'rampa' (prende le celle di S, sotto=True, tetto dove e coperto) o 'galleria'. fronti: [testa, coda] del tratto chiuse da un fronte"""
    r3 = lambda A, y: [[round(float(q[0]), 3), round(float(q[1]), 3), round(float(h), 3)] for q, h in zip(A, y)]; rr = lambda v: [round(float(q), 3) for q in v]; out = []
    for n, s in enumerate(sotto):
        cop = s['cop']; N = len(cop)
        for g, a, b in tratti(s):
            if b - a < 1: continue
            sx, dx = r3(s['Lft'][a:b + 1], s['yl'][a:b + 1]), r3(s['Rgt'][a:b + 1], s['yr'][a:b + 1]); m = (a + b) // 2
            fr = [bool(cop[a] and (a == 0 or not cop[a - 1])), bool(cop[b] and (b == N - 1 or not cop[b + 1]))]
            e = dict(sottopasso=n, nome=s.get('nome'), sotto=True, c=[round(float(s['C'][m][0]), 1), round(float(s['C'][m][1]), 1)], sx=sx, dx=dx, lung=b - a, fonte_larghezza=s['fonte'], osm=s.get('vie'), csx=rr(s['csx'][a:b + 1]), cdx=rr(s['cdx'][a:b + 1]), fronti=fr)
            if s.get('pedonale'): e['pedonale'] = True   # (a pedestrian underpass: paved floor, no road lines)
            if g:
                e.update(tipo='galleria', soffitto=[round(float(s['soff']), 3)] * (b - a + 1), celle={}, anello=[])
            else:
                ce, an = celle_anello(_sagoma(s, a, b)); e.update(tipo='rampa', celle=ce, anello=an, porta_h=0)
                te = [cop[k] and ((k > a and cop[k - 1]) or (k < b and cop[k + 1])) for k in range(a, b + 1)]
                if any(te): e['tetto'] = [round(float(s['soff']), 3) if v else None for v in te]
            out.append(e)
    return out


def corsie_opere(sotto, raw_roads, nodes, log=lambda *a: None):
    """dopo corsie_ia: dentro l'opera le corsie stanno a meta fra l'asse e la parete, e la rete non si taglia; il nodo appena fuori non le manda contro la parete"""
    tot = tolti = 0
    for s in sotto:
        foot = _sagoma(s, 0, len(s['C']) - 1); bordo = foot.exterior; shapely.prepare(foot)
        lat = lambda p, u: min((np.hypot(*(np.asarray(q) - p)) for q in _tagli(LineString([p, p + u * 30]), bordo)), default=0.0)
        pareti = [LineString(L_[d_ >= 0.25]) for L_, d_ in ((s['Lft'], s['csx'] - s['yl']), (s['Rgt'], s['cdx'] - s['yr'])) if (d_ >= 0.25).sum() >= 2]
        libera = lambda a_, b_: not any(LineString([a_, b_]).intersects(w_) for w_ in pareti)
        for r in raw_roads:
            g = r.get('refs') or []
            if r.get('c', 9) > 3 or len(g) < 2 or r.get('deck') or r.get('x') or r.get('bridge'): continue     # (chi passa sopra l'opera non e nell'opera)
            xy = np.array([nodes[q] for q in g], float); den = [foot.contains(Point(q)) for q in xy]
            if any(den):   # una strada a raso che attraversa sopra il coperto non e nell'opera: quella dell'opera le corre lungo
                dd = xy[-1] - xy[0]; j_ = int(np.argmin(np.hypot(*(s['C'] - xy[len(xy) // 2]).T))); t_ = s['C'][min(j_ + 2, len(s['C']) - 1)] - s['C'][max(j_ - 2, 0)]
                if abs(dd @ t_) < 0.7 * max(np.hypot(*dd) * np.hypot(*t_), 1e-9): continue
            if not any(den): continue
            l0 = 0.0 if r.get('o') else min(r['w'] * 0.24, r['mh'] * 0.5)
            F = list(r.get('lf') or [int(round(l0 * 100))] * len(g)); B = (list(r.get('lb') or [int(round(l0 * 100))] * len(g))) if not r.get('o') else None
            Rg = []
            for k in range(len(g)):
                T = xy[min(k + 1, len(g) - 1)] - xy[max(k - 1, 0)]; T = T / max(np.hypot(*T), 1e-9); Rg.append(np.array([-T[1], T[0]]))
                if den[k]:
                    hR, hL = lat(xy[k], Rg[k]), lat(xy[k], -Rg[k])
                    if r.get('o'): F[k] = int(round(100 * min(hR / 2, hR - 1.4)))     # senso unico: a destra anche lui, chi viene dall'altra parte ha l'altra meta (in mezzo si incontravano di fronte)
                    else: F[k] = int(round(100 * min(hR / 2, max(hR - 1.4, 0.5)))); B[k] = int(round(100 * min(hL / 2, max(hL - 1.4, 0.5))))
                    tot += 1
            # il nodo appena fuori: la corsia piu vicina alla sua che esce dalla bocca senza passare da una parete
            for k in range(len(g)):
                if den[k]: continue
                for j in (k - 1, k + 1):
                    if not (0 <= j < len(g) and den[j]): continue
                    for A, sg in ((F, 1), (B, -1)):
                        if A is None: continue
                        pin = xy[j] + sg * Rg[j] * A[j] / 100; pv = sorted(np.arange(-900, 901, 25), key=lambda v: abs(v - A[k]))
                        A[k] = int(next((v for v in pv if libera(pin, xy[k] + sg * Rg[k] * v / 100)), A[k]))
            r['lf'] = F
            if B is not None: r['lb'] = B
            if r.get('nt'):
                nn = [k for k in r['nt'] if not (den[k] or den[k - 1] or foot.contains(Point((xy[k] + xy[k - 1]) / 2)))]; tolti += len(r['nt']) - len(nn)
                if nn: r['nt'] = nn
                else: r.pop('nt')
    log('corsie nelle opere: %d nodi, %d tratti rimessi nella rete del traffico' % (tot, tolti))


def _tagli(linea, bordo):
    x = linea.intersection(bordo)
    if x.is_empty: return []
    return [(q.x, q.y) for q in (x.geoms if hasattr(x, 'geoms') else [x]) if q.geom_type == 'Point']


def da_indice(percorso):
    """le opere come le ha fatte il terreno (terreno/indice.json): per la build dei dati. Il contorno e uno solo: ricalcolato qui sul LiDAR veniva piu lungo di quello su S, e la vernice spariva oltre le bocche, sulle rotonde"""
    import json
    per = {}
    for f in json.load(open(percorso, encoding='utf-8'))['pits']:
        if f.get('sotto') and not f.get('scala'): per.setdefault(f['sottopasso'], []).append(f)   # (the stairs are not works for the build)
    out = []
    for n in sorted(per):
        L, R, gl, cs, cd = [], [], [], [], []
        for j, f in enumerate(per[n]):
            i0 = 0 if j == 0 else 1
            L += f['sx'][i0:]; R += f['dx'][i0:]; cs += f['csx'][i0:]; cd += f['cdx'][i0:]; gl += [f['tipo'] == 'galleria'] * (len(f['sx']) - i0)
        L, R = np.array(L, float), np.array(R, float); C = (L[:, :2] + R[:, :2]) / 2
        T = np.gradient(C, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; gal = np.array(gl)
        # (il primo tratto dopo una galleria: la stazione di confine appartiene al tratto dopo, come in tratti())
        out.append(dict(C=C, y=(L[:, 2] + R[:, 2]) / 2, yl=L[:, 2], yr=R[:, 2], Lft=L[:, :2], Rgt=R[:, :2], N=np.column_stack((-T[:, 1], T[:, 0])), gal=gal, csx=np.array(cs), cdx=np.array(cd), nome=per[n][0].get('nome'), pedonale=bool(per[n][0].get('pedonale') or per[n][0].get('fonte_larghezza') == 'GALLER pedonale')))
    return out


# ---------- i cavalcavia ----------
def cavalcavia(sup, log=lambda *a: None):
    """prima di tetto(): per ogni PONTE con sotto assi di livello 01 la strada sotto e la sua quota. Le aree a raso che gli passano sotto e che hanno vertici sia alla quota
    della strada sia a quella di sopra (il DBGT presta loro la Z dell'asse piu vicino, che puo essere quello sul ponte: marciapiede di corso Isonzo, 210,8..216,7) stanno
    tutte alla quota della strada. Scrive s.OPERE: [{g, u, d}] e riporta i nodi cambiati."""
    import superficie as sf
    D = sup.D; assi = assi_dbgt(D); P = D['PONTE']; opere = []; tot = 0
    bassi = [a for a in assi if a['liv'] == '01']
    tree = shapely.STRtree([a['g'] for a in bassi]) if bassi else None
    Ls = {nm: D[nm] for nm in ('AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR')}
    poly_ = {nm: [(i, sf.poly(L, i)) for i in range(len(L['off']) - 1) if sf.sed_ok(L, i)] for nm, L in Ls.items()}
    tr_ = {nm: shapely.STRtree([q for _, q in v]) for nm, v in poly_.items()}
    for i in range(len(P['off']) - 1):
        g = sf.poly(P, i)
        if tree is None: break
        ax = [bassi[j] for j in tree.query(g.buffer(3.0))]
        if not ax: continue
        u = float(np.median(np.concatenate([a['z'] for a in ax]))); top = np.nanmedian(P['z'][P['off'][i]:P['off'][i + 1]])
        if top - u < LUCE_MIN + 0.5: continue    # il ponte sta sulla strada, non sopra
        C = []; nodi = 0
        for nm, v in poly_.items():
            L = Ls[nm]
            for k in tr_[nm].query(g.buffer(1.0)):
                ii, q = v[k]; a, b = L['off'][ii], L['off'][ii + 1]; z = L['z'][a:b]; xy = L['xy'][a:b]
                low = np.isfinite(z) & (z < u + SOPRA_MIN)
                if low.sum() < 3 or not (q.intersection(g).area > 1.0): continue
                C.append(q)
                if low.all(): continue
                # la quota solo dai vertici bassi
                Tn = sf.Tin(xy[low], z[low]); w = sup.raster(q.buffer(0.5))
                if w[0] is None: continue
                (r0, r1, c0, c1), m = w; X, Z = sup.R.xz((r0, r1, c0, c1)); X, Z = X[m], Z[m]
                rr, cc = np.nonzero(m); rr, cc = rr + r0, cc + c0
                if not len(rr): continue
                h = Tn(X, Z); mz = np.isnan(h); h[mz] = u
                k_ = (sup.RANK[rr, cc] > 0) & (sup.ZF[rr, cc] > u + SOPRA_MIN)
                sup.ZF[rr[k_], cc[k_]] = np.minimum(h[k_], u + 0.3); nodi += int(k_.sum())
        if not C: continue
        opere.append(dict(ponte=int(P['id'][i]), g=g, corr=shapely.union_all(C), u=u, bot=float(top) - SP_SOLETTA, nodi_strada=nodi)); tot += nodi
    sup.OPERE = opere
    log('cavalcavia: %d PONTE con una strada sotto, %d nodi di strada riportati alla loro quota' % (len(opere), tot))


VICINO_OPERA = 30.0  # m: muri di sostegno (MU_SOS) e scarpate (SCARPT) del DBGT entro tanto da un PONTE sono della sua opera
ATTORNO = 12.0       # m: l'impronta dell'opera comprende il suolo attorno al PONTE entro tanto
FILO_SCARPT = 0.75   # m: un nodo cosi vicino a una linea di scarpata ne prende la quota
SPALLA_FUORI = 2.0   # m: oltre una spalla del PONTE il suolo scende ancora tanto (una cella di S): il gradino resta dietro il muro


def pezzi_dbgt(sup):
    """i muri di sostegno e le scarpate del DBGT dei comuni accesi, quota del DBGT (meno l'offset del comune): ([(Polygon, Tin, id)], [(LineString, z, id)])"""
    import sqlite3, superficie as sf, dbgt_quote as dq
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True); muri, linee = [], []
    info = getattr(sup, 'info', {}) or {}; off = (info.get('offset') or {}).get('per_comune') or {}
    for com in sup.comuni:
        o = float(off.get(com, (info.get('offset') or {}).get('valore', 0.0)) or 0.0); con = sqlite3.connect(dq.gpkg_di(com))
        M = dq._read_layer(con, tr, 'MU_SOS_MSOS_SUP', 'area', {}); C = dq._read_layer(con, tr, 'SCARPT_SCARPT_SUP_L', 'linea', {}); con.close()
        for L, out in ((M, muri), (C, linee)):
            if L is None: continue
            for i in range(len(L['off']) - 1):
                a, b = L['off'][i], L['off'][i + 1]; xy, z = L['xy'][a:b], L['z0'][a:b] - o
                ok = np.isfinite(z) & (z > 100)
                if out is muri:
                    if ok.sum() < 3: continue
                    g = Polygon(xy).buffer(0)
                    if g.is_empty or g.area < 1.0: continue
                    xs, zs = _denso(xy[ok], z[ok], True); out.append((g, sf.Tin(xs, zs), '%s MU_SOS %d' % (com, L['id'][i])))
                else:
                    if ok.sum() < 2: continue
                    xs, zs = _denso(xy[ok], z[ok], False)
                    if len(xs) >= 2: out.append((LineString(xs), zs, '%s SCARPT %d' % (com, L['id'][i])))
    return muri, linee


def _denso(xy, z, chiuso, passo=1.0):
    P = np.vstack((xy, xy[:1])) if chiuso else xy; Z = np.concatenate((z, z[:1])) if chiuso else z
    d = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(P, axis=0).T)))); keep = np.concatenate(([True], np.diff(d) > 1e-6)); P, Z, d = P[keep], Z[keep], d[keep]
    if len(P) < 2: return P, Z
    s = np.union1d(np.arange(0, d[-1] + 1e-9, passo), d)
    return np.column_stack((np.interp(s, d, P[:, 0]), np.interp(s, d, P[:, 1]))), np.interp(s, d, Z)


def opere_dbgt(sup, S):
    """in raccordi(), sulla S appena fatta. Ogni PONTE con muri di sostegno (MU_SOS) o scarpate (SCARPT) del DBGT entro VICINO_OPERA e un'opera: dentro la sua
    impronta (il PONTE e ATTORNO, i muri, le linee di scarpata) il suolo e solo quello del DBGT, mai il LiDAR (todo.md, punto 7: il cavalcavia di x 320 z 1985
    era "tutto distrutto" da una pendenza inventata sopra il LiDAR). In ordine: 1. la strada di sotto e le strade di sopra come le ha fatte strade() (nodi
    fissi); 2. i muri di sostegno e le scarpate con la quota dei loro vertici (la superficie del poligono MU_SOS fra testa e piede; le linee SCARPT sono
    spigoli: i nodi su di loro ne prendono la quota); 3. sotto l'impalcato il suolo della strada di sotto, piano fino alle spalle (la quota del nodo
    gia fatto piu vicino che sta sotto l'intradosso); 4. il resto dell'impronta e la superficie armonica fra questi (Laplace sui nodi liberi, il bordo
    dell'impronta per continuita). Le spalle le disegna il gioco dove l'impalcato appoggia (world3.js rampWalls). Scrive sup.OPERA (i nodi dell'opera,
    protetti dal lisciatore) e sup.opere_dbgt (il rapporto, e per ogni opera i pezzi del DBGT usati: il controllo della build li cerca nel gioco)."""
    import superficie as sf
    from scipy import sparse
    from scipy.sparse.linalg import spsolve
    D = sup.D; P = D['PONTE']; sup.OPERA = np.zeros(S.shape, bool); rep = []
    muri, linee = pezzi_dbgt(sup); ponti_s = ponti_sopra(D)
    tm = shapely.STRtree([g for g, _, _ in muri]) if muri else None; tl = shapely.STRtree([g for g, _, _ in linee]) if linee else None
    for i in range(len(P['off']) - 1):
        g = sf.poly(P, i)
        if not g.is_valid: g = g.buffer(0)
        mi = [j for j in (tm.query(g.buffer(VICINO_OPERA)) if tm is not None else []) if muri[j][0].distance(g) <= VICINO_OPERA]
        li = [j for j in (tl.query(g.buffer(VICINO_OPERA)) if tl is not None else []) if linee[j][0].distance(g) <= VICINO_OPERA]
        if not mi and not li: continue
        top = float(np.nanmedian(P['z'][P['off'][i]:P['off'][i + 1]])); bot = top - SP_SOLETTA
        O = shapely.union_all([g.buffer(ATTORNO)] + [muri[j][0] for j in mi] + [linee[j][0].buffer(FILO_SCARPT * 2) for j in li]).buffer(3.0).buffer(-3.0)
        w = sup.R.win(O.bounds, 2 * sf.SF)
        if w is None: continue
        r0, r1, c0, c1 = w; X, Z = sup.R.xz(w); pts = shapely.points(X, Z); shapely.prepare(O)
        dentro = shapely.contains(O, pts); W = S[r0:r1, c0:c1]
        V = np.full(W.shape, np.nan)
        # 1. the streets, rails and beds as strade() burned them. The street over it outside the PONTE is on its bank (the DBGT has the bank: MU_SOS, SCARPT),
        # not a deck part where the DTM is low: its nodes go back to the ground at their DBGT height (the deck stops at the PONTE and rests there)
        ponte_m = shapely.contains(g, pts); Ar = sup.AIR[r0:r1, c0:c1]; sopra = dentro & Ar & ~ponte_m & np.isfinite(sup.ZF[r0:r1, c0:c1])
        if sopra.any():
            W[sopra] = sup.ZF[r0:r1, c0:c1][sopra]; Ar[sopra] = False; sup.BR[r0:r1, c0:c1][sopra] = False; sup.FIX[r0:r1, c0:c1][sopra] = True; sup.RANK[r0:r1, c0:c1][sopra] = sf.R_VEI
        fx = sup.FIX[r0:r1, c0:c1] & dentro & ~Ar; V[fx] = W[fx]
        for j in mi:                                                                          # 2. the walls and banks: their own surface
            mg, tn, _ = muri[j]; k = shapely.contains(mg, pts) & dentro & ~fx
            if k.any(): V[k] = tn(X[k], Z[k])
        for j in li:
            lg, lz, _ = linee[j]; d = shapely.distance(lg, pts); k = (d <= FILO_SCARPT) & dentro & ~fx
            if k.any():
                cum = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(np.asarray(lg.coords), axis=0).T))))
                V[k] = np.interp(shapely.line_locate_point(lg, pts[k]), cum, lz)
        sotto = ponte_m & dentro & np.isnan(V)                                # 3. under the deck: the street under it, flat to the abutments
        strada = fx & np.isin(sup.CLS[r0:r1, c0:c1], (sf.C_VEI, sf.C_VEIT, sf.C_PED, sf.C_AREA, sf.C_FER))   # (a street, sidewalk or track under it: over a river bed the harmonic below)
        basso = strada & (V < bot - LUCE_MIN * 0.5)
        if sotto.any() and basso.any():
            idx = ndimage.distance_transform_edt(~basso, return_distances=False, return_indices=True); V[sotto] = V[idx[0][sotto], idx[1][sotto]]
        lib = dentro & np.isnan(V); n = int(lib.sum())                                       # 4. the rest: harmonic between them, the edge of the footprint as it is
        if n:
            Vb = np.where(dentro, V, W); idn = -np.ones(W.shape, np.int64); idn[lib] = np.arange(n); rr, cc = np.nonzero(lib)
            rows, cols, vals = [], [], []; rhs = np.zeros(n); deg = np.zeros(n)
            for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                r2, c2 = rr + dr, cc + dc; ok = (r2 >= 0) & (r2 < W.shape[0]) & (c2 >= 0) & (c2 < W.shape[1]); me = idn[rr[ok], cc[ok]]; deg[me] += 1
                nb = idn[r2[ok], c2[ok]]; free = nb >= 0
                rows += list(me[free]); cols += list(nb[free]); vals += [-1.0] * int(free.sum())
                np.add.at(rhs, me[~free], Vb[r2[ok][~free], c2[ok][~free]])
            A = sparse.csr_matrix((np.array(vals + list(deg)), (np.array(rows + list(range(n))), np.array(cols + list(range(n))))), shape=(n, n))
            V[lib] = spsolve(A, rhs)
        sottoP = ponte_m & dentro & ~fx & np.isfinite(V); V[sottoP] = np.minimum(V[sottoP], bot - 0.3)   # under the deck never up to it (the grass came through the deck top, Carlo 3/11)
        nuovi = dentro & ~fx & np.isfinite(V); dz = V[nuovi] - W[nuovi]
        W[nuovi] = V[nuovi]; sup.OPERA[r0:r1, c0:c1] |= dentro
        # 5. a PONTE over a street: the street under it is flat up to the abutments, which stand on the sides of the PONTE across the road over it (the game draws
        # them there as walls, world3.js spalleNucleo), and the bank begins behind them. Under the deck nothing stays of the road over it or of its bank (Carlo 3/11,
        # corso Isonzo under the Milano-Meda: slopes of grass with pieces of the Milano-Meda's asphalt under the bridge, a hump of grass on the sidewalk, the
        # sidewalk cut 2 m short of the abutment). The nodes within SPALLA_FUORI past an abutment go down too: the step of S (a cell of 2 m) then lies behind the wall
        ps_ = [q for q in ponti_s if q[0].intersection(g).area > 0.5 * g.area]
        if ps_:
            _, v_, b_, c_ = ps_[0]; ring = np.asarray(g.exterior.coords); lati = []
            for a_, e_ in zip(ring[:-1], ring[1:]):
                d_ = e_ - a_; n_ = np.hypot(*d_)
                if n_ > 1.0 and abs(d_ @ v_) / n_ < 0.5: lati.append(LineString([a_, e_]).buffer(SPALLA_FUORI, cap_style=2))
            zona_g = shapely.union_all([g.buffer(0.05)] + lati); zona = shapely.contains(zona_g, pts) & dentro
            strada_ = np.isin(sup.CLS[r0:r1, c0:c1], (sf.C_VEI, sf.C_VEIT, sf.C_PED, sf.C_AREA, sf.C_FER)) & sup.FIX[r0:r1, c0:c1]
            base_ = strada_ & ponte_m & (W < bot - LUCE_MIN)   # the street under it, as made above
            if zona.any() and base_.any():
                idx = ndimage.distance_transform_edt(~base_, return_distances=False, return_indices=True); vb = W[idx[0], idx[1]]
                giu = zona & ~base_ & (W > vb + 0.05); W[giu] = vb[giu]
                in_c = shapely.contains(c_, pts) if not c_.is_empty else np.zeros(pts.shape, bool); in_b = shapely.contains(b_, pts) if not b_.is_empty else np.zeros(pts.shape, bool)
                CL, FI = sup.CLS[r0:r1, c0:c1], sup.FIX[r0:r1, c0:c1]
                k_ = zona & ~base_
                CL[k_ & in_c] = sf.C_VEI; CL[k_ & in_b & ~in_c] = sf.C_PED; FI[k_ & in_b] = True
                CL[k_ & ~in_b] = sf.C_NONE; FI[k_ & ~in_b] = False
                for nm_ in ('SCARP', 'INT'):
                    M_ = getattr(sup, nm_, None)
                    if M_ is not None: M_[r0:r1, c0:c1][k_] = False
                sup.OPERA[r0:r1, c0:c1] |= zona; rep_giu = int(giu.sum())
            else: rep_giu = 0
        else: rep_giu = 0
        rep.append(dict(ponte=int(P['id'][i]), c=_c(g), muri=[muri[j][2] for j in mi], scarpate=[linee[j][2] for j in li], nodi=int(nuovi.sum()), rilevato=int(sopra.sum()), sotto_le_spalle=rep_giu,
                        dz_m=[round(float(v), 2) for v in np.percentile(dz, (5, 50, 95))] if len(dz) else None,
                        pezzi=[[[round(float(x), 2), round(float(z), 2)] for x, z in np.asarray(muri[j][0].representative_point().coords)] for j in mi] +
                              [[[round(float(x), 2), round(float(z), 2)] for x, z in np.asarray(linee[j][0].interpolate(0.5, normalized=True).coords)] for j in li]))
    sup.opere_dbgt = rep
    sup.log('opere dal DBGT: %d ponti con muri o scarpate, %d nodi fatti senza il LiDAR' % (len(rep), sum(r['nodi'] for r in rep)))


def rapporto(sup):
    return dict(opere_dbgt=getattr(sup, 'opere_dbgt', []), cavalcavia=[dict(ponte=o['ponte'], c=_c(o['g']), quota_sotto=round(o['u'], 2), nodi_strada=o['nodi_strada'], nodi_scarpata=o.get('nodi_scarpata', 0)) for o in getattr(sup, 'OPERE', [])])


# ---------- le righe dentro le opere ----------
RIGHE_PRESA = 15.0   # m oltre la bocca: le righe che arrivano all'opera da fuori si cercano entro tanto
RIGHE_COS = 0.85     # una riga che corre lungo l'opera (coseno con l'asse)
RIGHE_RACCORDO = 12.0  # m: dentro l'opera una riga raggiunge la sua posizione dalla riga che arriva alla bocca in tanto
RIGHE_DAL_MURO = 0.35  # m: una riga non sta piu vicino di tanto al muro


def righe_opere(sotto, lines, log=lambda *a: None):
    """le righe sempre anche dentro le opere (Carlo, regola fissa): dentro l'impronta di un'opera le righe del DBGT si tolgono (nella parte aperta tutte,
    sotto il coperto quelle che corrono lungo l'opera: le altre sono della strada di sopra) e si rifanno prolungando quelle che arrivano alle due bocche:
    ogni riga prima della bocca va avanti lungo l'asse dell'opera, alla sua distanza dall'asse, fino alla riga che la continua dopo l'altra bocca
    (stesso tipo, distanza piu vicina; in mezzo la distanza passa dall'una all'altra), dritta e continua. Senza righe a nessuna delle due bocche: i
    bordi a RIGHE_DAL_MURO dai muri e una mezzeria tratteggiata sull'asse (se la carreggiata e larga almeno 5,5 m). Livello 3: il gioco le disegna sul fondo"""
    if not sotto or not lines: return lines
    from shapely.geometry import MultiLineString
    out = list(lines); nuove = tolte = 0
    for s in sotto:
        C, N, L_, R_ = s['C'], s['N'], s['Lft'], s['Rgt']; n = len(C)
        if n < 3: continue
        if s.get('pedonale'):   # a pedestrian underpass: no road lines on its floor, and none of the road over it either
            fb = _sagoma(s, 0, n - 1).buffer(0.3); kept = []
            for l in out:
                p = np.asarray(l['p'], float); m = shapely.contains_xy(fb, p[:, 0], p[:, 1]) if len(p) else np.zeros(0, bool)
                if l.get('lev') == 3 and m.any(): continue
                kept.append(l)
            out = kept; continue
        foot = _sagoma(s, 0, n - 1)
        if foot.is_empty: continue
        gal = np.asarray(s['gal'], bool); cov = _sagoma(s, int(np.argmax(gal)), int(n - 1 - np.argmax(gal[::-1]))) if gal.any() else Polygon()
        T = np.gradient(C, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]
        hl, hr = np.hypot(*(L_ - C).T), np.hypot(*(R_ - C).T)
        fb = foot.buffer(0.3); shapely.prepare(fb)
        kept = []
        for l in out:   # 1. out with the lines on the floor of the work
            p = np.asarray(l['p'], float)
            if len(p) < 2 or not LineString(p).intersects(fb): kept.append(l); continue
            d = np.gradient(p, axis=0); d /= np.maximum(np.hypot(*d.T), 1e-9)[:, None]
            j = np.argmin(np.hypot(*(C[None, :, :] - p[:, None, :]).transpose(2, 0, 1)), axis=1); lungo = np.abs(np.sum(d * T[j], axis=1)) > 0.7
            dentro = shapely.contains_xy(fb, p[:, 0], p[:, 1]); sopra = shapely.contains_xy(cov, p[:, 0], p[:, 1]) if not cov.is_empty else np.zeros(len(p), bool)
            via = dentro & (~sopra | lungo)
            if not via.any(): kept.append(l); continue
            tolte += 1; i0 = 0
            for i in range(1, len(p) + 1):
                if i == len(p) or via[i] != via[i - 1]:
                    if not via[i0] and i - i0 >= 2: kept.append(dict(l, p=l['p'][i0:i]))
                    i0 = i
        out = kept
        # 2. the lines that come to each mouth from outside, along the work: their type and distance from the axis
        def bocca(k, verso):
            m = []
            for l in out:
                p = np.asarray(l['p'], float)
                if len(p) < 2: continue
                for e, e2 in ((0, 1), (len(p) - 1, len(p) - 2)):
                    q = p[e]; dd = np.hypot(*(q - C[k]))
                    if dd > RIGHE_PRESA: continue
                    v = q - p[e2]; v /= max(np.hypot(*v), 1e-9)
                    if abs(v @ T[k]) < RIGHE_COS: continue
                    along = (q - C[k]) @ T[k] * verso   # <= 0: before the mouth, outside
                    if along > 1.0: continue
                    o = float((q - C[k]) @ N[k])
                    if -hr[k] - 0.5 <= o <= hl[k] + 0.5: m.append((l['t'], float(np.clip(o, -hr[k] + RIGHE_DAL_MURO, hl[k] - RIGHE_DAL_MURO)), -along))
            r = []   # one per type and place (the nearest end)
            for t, o, a in sorted(m, key=lambda x: x[2]):
                if not any(t == t2 and abs(o - o2) < 0.8 for t2, o2 in r): r.append((t, o))
            return r
        # 3. the lines of the work itself, as the edges and the middle of its floor (Carlo 3/11: the lines of the station underpass were the best
        # model; the ones carried on from each mouth came out double and out of step): an edge line RIGHE_DAL_MURO from each wall, and the centre line
        # in the middle of the floor, continuous if a continuous centre line comes to one of the mouths, else dashed (only on a floor wide enough for two lanes)
        A, B = bocca(0, 1), bocca(n - 1, -1)
        cen = 1 if any(t == 1 for t, _ in A + B) else 2
        coppie = [(0, None, 'sx'), (0, None, 'dx')] + ([(cen, None, 'mezzo')] if np.median(hl + hr) >= 5.5 else [])
        sv_ = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(C, axis=0).T)))); Ltot = sv_[-1]
        def aggancio(o, dove, M, k):   # at a mouth the line meets the one outside that carries it on: its offset there, and back to the work's own over RIGHE_RACCORDO m
            if dove == 'mezzo': cand = [q for t, q in M if t in (1, 2)]
            else: cand = [q for t, q in M if t == 0 and (q > 0) == (dove == 'sx')]
            if not cand: return o
            q = min(cand, key=lambda v: abs(v - o[k])); d = sv_ if k == 0 else Ltot - sv_; w = np.clip(1 - d / RIGHE_RACCORDO, 0, 1)
            return o + (q - o[k]) * w * w * (3 - 2 * w)
        for t, _, dove in coppie:
            o = (hl - RIGHE_DAL_MURO) if dove == 'sx' else (-(hr - RIGHE_DAL_MURO) if dove == 'dx' else (hl - hr) / 2)
            o = ndimage.gaussian_filter1d(o, 3.0, mode='nearest'); o = aggancio(o, dove, A, 0); o = aggancio(o, dove, B, n - 1)
            q = C + N * o[:, None]
            out.append(dict(ri=-1, t=int(t), p=[(round(float(x), 2), round(float(z), 2)) for x, z in q], lev=3)); nuove += 1
    log('righe nelle opere: %d righe del DBGT tagliate, %d righe rifatte lungo le opere' % (tolte, nuove))
    return out


# ---------- le scale (OSM highway=steps) ----------
MEZZA_SCALA = 1.2    # m: mezza larghezza di una scala quando OSM non la dice (neutra)
ALZATA = 0.16        # m: l'alzata di un gradino
SCALA_INFOSSATA = 0.5  # m: una scala con il suolo accanto almeno tanto sopra la sua rampa e scavata nel suolo: una fossa con i muri


def scale(osm, quota, sotto, log=lambda *a: None, sup=None):
    """le scale di OSM scavate nel suolo (la buca che il LiDAR vede alle teste dei sottopassi): una fossa lungo la via, il fondo una rampa dritta dalla
    quota della testa alta a quella della testa bassa (sul fondo dell'opera se la scala ci arriva), muri e parapetti come le opere, i gradini li disegna
    il gioco. Le scale a raso su un pendio restano sul suolo (il gioco disegna i gradini su S). Torna (scale come stazioni, rapporto)"""
    feet = []
    for s in sotto:
        n = len(s['C'])
        feet.append((_sagoma(s, 0, n - 1), s))
    out, rep = [], dict(scale_osm=0, infossate=0, a_raso=0, corte=0)
    for w in osm:
        if w['t'].get('highway') != 'steps': continue
        rep['scale_osm'] += 1
        g = LineString(w['p'])
        for f, _ in feet:   # the part outside the works (inside it is the floor of the work)
            if g.intersects(f): g = g.difference(f.buffer(0.05))
        parts = [q for q in getattr(g, 'geoms', [g]) if q.geom_type == 'LineString' and q.length >= 2.0]
        if not parts: rep['corte'] += 1; continue
        for q in parts:
            P = np.asarray(q.coords, float); sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(P, axis=0).T))))
            st = np.linspace(0, sv[-1], max(3, int(np.ceil(sv[-1] / 0.5)) + 1)); C = np.column_stack((np.interp(st, sv, P[:, 0]), np.interp(st, sv, P[:, 1]))); n = len(C)
            muro = []
            def capo(pt):   # the height at an end: the floor of a work it touches, else the ground. Against the wall of the covered part of a road work there is no way in
                for f, s in feet:
                    if f.distance(Point(pt)) < 1.0:
                        k = int(np.argmin(np.hypot(*(s['C'] - pt).T)))
                        if bool(np.asarray(s['gal'])[k]) and not s.get('pedonale'): muro.append(k)
                        return float((s['yl'][k] + s['yr'][k]) / 2)
                return float(quota(*pt))
            za, zb = capo(C[0]), capo(C[-1])
            if muro: rep['contro_un_muro'] = rep.get('contro_un_muro', []) + [w['id']]; continue   # (via Montecassino: stairs to the cycle tunnel beside it, which is not drawn)
            if abs(za - zb) < 2 * ALZATA: rep['corte'] += 1; continue
            if sup is not None:   # the stair fits the real hole: from where the ground drops to the bottom, as wide as the hole; the ground round it filled
                f_ = _scala_nel_buco(sup, C, za, zb, quota, [f for f, _ in feet], riempi=False)
                if f_ is None: rep['a_raso'] += 1; continue
                C, za, zb, mz = f_; n = len(C); st = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(C, axis=0).T)))); rep['buchi_riempiti_nodi'] = rep.get('buchi_riempiti_nodi', 0) + mz[2]
            else: mz = (MEZZA_SCALA, MEZZA_SCALA, 0)
            y = za + (zb - za) * st / st[-1]
            T = np.gradient(C, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; N = np.column_stack((-T[:, 1], T[:, 0]))
            Lft, Rgt = C + N * mz[0], C - N * mz[1]
            tl, tr = np.array([float(quota(*v)) for v in Lft]), np.array([float(quota(*v)) for v in Rgt])
            if sup is not None: tl, tr = np.maximum(tl, za), np.maximum(tr, za)   # (the ground beside it is the street, the hole filled)
            if max((tl - y).max(), (tr - y).max()) < SCALA_INFOSSATA: rep['a_raso'] += 1; continue
            def cima(tq):
                ts = ndimage.gaussian_filter1d(tq, 2.0, mode='nearest'); par = np.minimum(PARAPETTO, np.maximum(0.0, ts - y)); t = np.maximum(ts + par, tq + np.minimum(par, 0.3))
                return ndimage.gaussian_filter1d(t, 1.0, mode='nearest')
            out.append(dict(C=C, y=y, yl=y.copy(), yr=y.copy(), Lft=Lft, Rgt=Rgt, N=N, csx=cima(tl), cdx=cima(tr), osm=w['id'], gradini=int(round(abs(za - zb) / ALZATA)), za=za, zb=zb))
            rep['infossate'] += 1
    # flights that cross each other (the amphitheatre of via Indipendenza, x 364 z -471: several flights meeting on one landing, Carlo 3/11) are a piece
    # made by hand, not this rule: none of them is drawn and the hole stays as it is. The others fill the ground of their hole round them
    fp = [Polygon(np.vstack((s_['Lft'], s_['Rgt'][::-1]))).buffer(0) for s_ in out]
    croce = {i for i in range(len(out)) for j in range(len(out)) if i != j and fp[i].intersection(fp[j]).area > 0.5}
    if croce: rep['incrociate_tolte'] = sorted(int(out[i]['osm']) for i in croce)
    out = [s_ for i, s_ in enumerate(out) if i not in croce]
    if sup is not None:
        for s_ in out: rep['buchi_riempiti_nodi'] = rep.get('buchi_riempiti_nodi', 0) + _riempi_buco(sup, s_, [f for f, _ in feet])
    rep['infossate'] = len(out)
    log('scale: %s' % rep)
    return out, rep


def _riempi_buco(sup, s_, feet):
    """the nodes of S in the hole round a stair, out of its footprint (within 4 m), back to the street round it"""
    import superficie as sf
    foot = Polygon(np.vstack((s_['Lft'], s_['Rgt'][::-1]))).buffer(0); ztop = float(max(s_['za'], s_['zb']))
    zona = foot.buffer(4.0).difference(foot.buffer(0.3))
    for f in feet: zona = zona.difference(f.buffer(0.5))
    w = sup.R.win(zona.bounds, 2 * sf.SF)
    if w is None: return 0
    r0, r1, c0, c1 = w; X, Z = sup.R.xz(w); shapely.prepare(zona); m = shapely.contains_xy(zona, X, Z)
    G = sup.GF[r0:r1, c0:c1]; k = m & (G < ztop - BUCO)
    if k.any(): G[k] = ztop; sup.HQ[r0:r1, c0:c1][k] = int(round(ztop * 100))
    return int(k.sum())


BUCO = 0.25   # m: il suolo piu di tanto sotto la strada attorno e la buca della scala


def _scala_nel_buco(sup, C, za, zb, quota, feet, riempi=True):
    """la scala adattata alla buca che il suolo ha attorno alla via OSM: dalla testa alta (la strada attorno, ztop) al punto in cui il suolo scende, fino
    alla testa bassa; larga quanto la buca (mediana dei tagli trasversali). I nodi di S nella buca fuori dalla scala (entro 4 m) tornano alla quota della
    strada: il pavimento attorno si taglia sul bordo della scala, non scende nella buca. Torna (C, ztop, zbasso, (mezza sx, mezza dx, nodi riempiti)) o None"""
    import superficie as sf
    if za < zb: C = C[::-1]; za, zb = zb, za
    T0 = C[1] - C[0]; T0 = T0 / max(np.hypot(*T0), 1e-9)
    ring = [C[0] + np.array([np.cos(a), np.sin(a)]) * r for a in np.linspace(0, 2 * np.pi, 16, endpoint=False) for r in (4.0, 5.5)]
    ztop = float(np.percentile([quota(*q) for q in ring], 75))
    if ztop - zb < 2 * ALZATA: return None
    ext = np.array([C[0] - T0 * d for d in np.arange(4.0, 0, -0.5)])     # the hole can start before the OSM end
    A = np.vstack((ext, C)); sv = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(A, axis=0).T))))
    zs = np.array([quota(*q) for q in A]); k0 = next((k for k in range(len(A)) if zs[k] < ztop - BUCO), None)
    if k0 is None: return None
    k0 = max(0, k0 - 1); s_ = np.arange(sv[k0], sv[-1] + 1e-9, 0.5)
    P = np.column_stack((np.interp(s_, sv, A[:, 0]), np.interp(s_, sv, A[:, 1])))
    if len(P) < 3: return None
    T = np.gradient(P, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; N = np.column_stack((-T[:, 1], T[:, 0]))
    hs = {1: [], -1: []}; nb = 0
    for k in range(1, len(P) - 1):
        if quota(*P[k]) > ztop - BUCO: continue
        nb += 1
        for sg in (1, -1):
            d = next((d for d in np.arange(0.5, 5.01, 0.25) if quota(*(P[k] + sg * N[k] * d)) >= ztop - BUCO), None)
            if d is not None: hs[sg].append(d)
    if not nb or max(len(hs[1]), len(hs[-1])) < 0.5 * nb: return None   # (the ground beside does not come back up on either side: a stair down a slope, not into a hole)
    ml = float(np.clip(np.median(hs[1]), 0.8, 3.0)) if len(hs[1]) >= 0.5 * nb else None; mr = float(np.clip(np.median(hs[-1]), 0.8, 3.0)) if len(hs[-1]) >= 0.5 * nb else None
    ml = ml if ml is not None else mr; mr = mr if mr is not None else ml   # (a side against a building or a wall: as wide as the other)
    foot = Polygon(np.vstack((P + N * ml, (P - N * mr)[::-1]))).buffer(0)
    if not riempi: return P, ztop, zb, (ml, mr, 0)
    zona = foot.buffer(4.0).difference(foot.buffer(0.3))
    for f in feet: zona = zona.difference(f.buffer(0.5))
    w = sup.R.win(zona.bounds, 2 * sf.SF); nz = 0
    if w is not None:
        r0, r1, c0, c1 = w; X, Z = sup.R.xz(w); shapely.prepare(zona); m = shapely.contains_xy(zona, X, Z)
        G = sup.GF[r0:r1, c0:c1]; k = m & (G < ztop - BUCO)
        if k.any(): G[k] = ztop; sup.HQ[r0:r1, c0:c1][k] = int(round(ztop * 100)); nz = int(k.sum())
    return P, ztop, zb, (ml, mr, nz)


def fosse_scale(scale_, primo):
    """le scale per terreno/indice.json: come le opere (tipo rampa, sotto: muri e parapetti di opPareti, niente porta), con scala=True e i gradini"""
    r3 = lambda A, y: [[round(float(q[0]), 3), round(float(q[1]), 3), round(float(h), 3)] for q, h in zip(A, y)]; rr = lambda v: [round(float(q), 3) for q in v]; out = []
    for i, s in enumerate(scale_):
        n = len(s['C']); m = n // 2; ce, an = celle_anello(Polygon(np.vstack((s['Lft'], s['Rgt'][::-1]))).buffer(0))
        out.append(dict(tipo='rampa', sotto=True, scala=True, sottopasso=primo + i, gradini=s['gradini'], osm=[s['osm']], c=[round(float(s['C'][m][0]), 1), round(float(s['C'][m][1]), 1)],
                        sx=r3(s['Lft'], s['yl']), dx=r3(s['Rgt'], s['yr']), lung=n - 1, fonte_larghezza='neutra', csx=rr(s['csx']), cdx=rr(s['cdx']), fronti=[False, False],
                        celle=ce, anello=an, porta_h=0))
    return out


def controllo_opere(comuni, fatte):
    """i PONTE dei comuni con muri di sostegno o scarpate del DBGT entro VICINO_OPERA che opere_dbgt non ha fatto: [{comune, ponte, c}]"""
    import sqlite3, dbgt_quote as dq
    from pyproj import Transformer
    tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True); fatti = {(o['ponte'], tuple(o['c'])) for o in fatte}; out = []
    for com in comuni:
        con = sqlite3.connect(dq.gpkg_di(com)); L = {t: dq._read_layer(con, tr, t, k, {}) for t, k in (('PONTE_PONTE_SEDE', 'area'), ('MU_SOS_MSOS_SUP', 'area'), ('SCARPT_SCARPT_SUP_L', 'linea'))}; con.close()
        geo = lambda X, k: [(Polygon(X['xy'][X['off'][i]:X['off'][i + 1]]).buffer(0) if k == 'area' else LineString(X['xy'][X['off'][i]:X['off'][i + 1]])) for i in range(len(X['off']) - 1) if X['off'][i + 1] - X['off'][i] >= (3 if k == 'area' else 2)] if X is not None else []
        P = L['PONTE_PONTE_SEDE']; pz = geo(P, 'area'); pezzi = geo(L['MU_SOS_MSOS_SUP'], 'area') + geo(L['SCARPT_SCARPT_SUP_L'], 'linea')
        if not pezzi or P is None: continue
        tree = shapely.STRtree(pezzi)
        for i, g in enumerate(pz):
            if not any(pezzi[j].distance(g) <= VICINO_OPERA for j in tree.query(g.buffer(VICINO_OPERA))): continue
            pid, c = int(P['id'][i]), _c(g)
            if not any(abs(c[0] - c2[0]) < 1 and abs(c[1] - c2[1]) < 1 for _, c2 in fatti): out.append(dict(comune=com, ponte=pid, c=c))   # (by place: the ids of the PONTE of more comuni are renumbered when the layers are joined)
    return out


# ---------- la strada di sopra non scende sotto il ponte ----------
PARALLELO = 0.7   # coseno: un pezzo che corre lungo l'impalcato e della strada di sopra


def ponti_sopra(D):
    """i PONTE che portano una strada sopra un'altra (assi EL_STR di livello 01 sotto, l'impalcato almeno LUCE_MIN sopra): [(poligono, direzione
    dell'impalcato, quel che sotto e della strada di sotto)]. La direzione: gli assi SED=02 dentro il PONTE; la strada di sotto: le aree del DBGT a raso
    (AC_VEI, AC_PED, AC_CIC, AR_STR) che toccano il PONTE con la quota (mediana dei vertici) almeno LUCE_MIN sotto l'impalcato"""
    import superficie as sf
    P = D['PONTE']; assi = assi_dbgt(D); t02 = shapely.STRtree([a['g'] for a in assi]); out = []
    # (an area of the road under it: at least 3 vertices under the deck. The DBGT lends some vertices of the low sidewalks the height of the axis on the bridge:
    # the sidewalk of corso Isonzo, 210.8..216.7, has its median up there, and its piece under the bridge was taken away with the kerb, Carlo 3/11)
    aree = [(sf.poly(D[nm], i), D[nm]['z'][D[nm]['off'][i]:D[nm]['off'][i + 1]], nm) for nm in ('AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR') if nm in D for i in range(len(D[nm]['off']) - 1) if sf.sed_ok(D[nm], i)]
    ta = shapely.STRtree([q[0] for q in aree])
    for i in range(len(P['off']) - 1):
        g = sf.poly(P, i)
        if not g.is_valid: g = g.buffer(0)
        top = float(np.nanmedian(P['z'][P['off'][i]:P['off'][i + 1]]))
        sopra = [assi[j] for j in t02.query(g) if assi[j]['sed'] == '02' and assi[j]['g'].intersection(g).length > 2]
        sotto = [assi[j] for j in t02.query(g) if assi[j]['liv'] == '01' and np.median(assi[j]['z']) < top - LUCE_MIN]
        if not sopra or not sotto: continue
        v = np.zeros(2)
        for a in sopra:
            c = np.asarray(a['g'].intersection(g).coords if a['g'].intersection(g).geom_type == 'LineString' else a['g'].coords); d = c[-1] - c[0]
            if v @ d < 0: d = -d
            v += d
        v /= max(np.hypot(*v), 1e-9)
        bassi = [aree[j] for j in ta.query(g) if np.sum(aree[j][1] < top - LUCE_MIN) >= 3 and aree[j][0].intersects(g)]
        basso = shapely.union_all([q[0] for q in bassi]); carr = shapely.union_all([q[0] for q in bassi if q[2] == 'AC_VEI'])
        out.append((g, v, basso, carr))
    return out


def _parallelo(geom, v):
    """la direzione principale di un pezzo (il lato lungo del suo rettangolo minimo, o la corda di una linea) e parallela a v"""
    if geom.is_empty: return False
    if geom.geom_type in ('LineString', 'LinearRing'):
        c = np.asarray(geom.coords); d = c[-1] - c[0]
    else:
        r = np.asarray(geom.minimum_rotated_rectangle.exterior.coords)[:3]; e1, e2 = r[1] - r[0], r[2] - r[1]; d = e1 if np.hypot(*e1) >= np.hypot(*e2) else e2
    n = np.hypot(*d)
    return n > 1e-6 and abs(d @ v) / n > PARALLELO


def senza_strada_di_sopra(ponti, superfici, isole, barriere, log=lambda *a: None):
    """sotto l'impronta di un PONTE resta solo la strada di sotto (Carlo, 3/11, il cavalcavia di x 320 z 1985: lo spartitraffico, le recinzioni e l'asfalto
    della Milano-Meda erano disegnati sul suolo sotto il ponte). Toglie: dalle superfici (asfalto, marciapiedi, cortili, vialetti) quel che sta nel PONTE
    fuori dalle aree della strada di sotto; dalle isole e dagli spartitraffico i pezzi nel PONTE che corrono lungo l'impalcato; dalle barriere i tratti nel
    PONTE che corrono lungo l'impalcato. Sull'impalcato la strada di sopra la disegna il gioco (piano dell'impalcato, parapetti, righe di livello 2).
    superfici: {nome: geometria}; isole: geometria; barriere: [(punti, tipo, altezza)]. Torna (superfici, isole, barriere)"""
    from shapely.ops import unary_union
    senza_strada_di_sopra.sul_ponte = None
    if not ponti: return superfici, isole, barriere
    m2 = dict(superfici=0.0, isole=0.0, barriere_m=0.0)
    sul_ponte = []   # the islands of the road over the bridge: they go on its deck (the game draws them on the deck top, tiles md with dk)
    togli = unary_union([g.buffer(0.3).difference(b) if not b.is_empty else g.buffer(0.3) for g, v, b, c in ponti])
    out = {}
    for k, s in superfici.items():
        if s.is_empty or not s.intersects(togli): out[k] = s; continue
        a0 = s.area; out[k] = s.difference(togli); m2['superfici'] += a0 - out[k].area
    if isole is not None and not isole.is_empty:
        for g, v, b, c in ponti:
            gb = g.buffer(0.5)
            if not isole.intersects(gb): continue
            via = [p for p in getattr(isole.intersection(gb), 'geoms', [isole.intersection(gb)]) if p.area > 0.5 and _parallelo(p, v)]
            if via: u = unary_union(via); m2['isole'] += u.area; isole = isole.difference(u.buffer(0.05)); sul_ponte.append(u)
    nb = []
    for pts, k_, h_ in barriere:
        L = LineString(pts) if len(pts) >= 2 else None
        hit = [(g, v, b, c) for g, v, b, c in ponti if L is not None and L.intersects(g.buffer(0.5))]
        if not hit: nb.append((pts, k_, h_)); continue
        rest = L
        for g, v, b, c in hit:   # under the bridge: what runs along the deck, what stands in the carriageway under it, what is off the road under it
            dentro = rest.intersection(g.buffer(0.5)); ci = c.buffer(-0.3) if not c.is_empty else c; bo = b.buffer(0.5) if not b.is_empty else b
            via = [q for q in getattr(dentro, 'geoms', [dentro]) if q.geom_type == 'LineString']   # (all of them: what runs across under the deck stands on the line of the abutment, which the game draws as a wall: two low walls with a fence in the street, x 344 z 1995, Carlo 3/11)
            if via: m2['barriere_m'] += sum(q.length for q in via); rest = rest.difference(unary_union([q.buffer(0.05) for q in via]))
        for q in getattr(rest, 'geoms', [rest]):
            if q.geom_type == 'LineString' and q.length > 0.5: nb.append((list(q.coords), k_, h_))
    log('strada di sopra tolta da sotto i ponti (%d PONTE): superfici %.0f m2, spartitraffico %.0f m2, barriere %.0f m' % (len(ponti), m2['superfici'], m2['isole'], m2['barriere_m']))
    senza_strada_di_sopra.sul_ponte = unary_union(sul_ponte) if sul_ponte else None
    return out, isole, nb


def sotto_impalcato_sopra(indice, ponti):
    """dove l'impalcato di un PONTE che porta una strada sopra un'altra va oltre il PONTE, sul rilevato (impalcati.py lo allunga fin dove appoggia): la sua
    impronta fuori dal PONTE. Li le isole della strada di sopra stanno sotto il piano dell'impalcato e non si vedono: vanno sull'impalcato (build_data)"""
    import json, os
    from shapely.ops import unary_union
    if not ponti or not os.path.exists(indice): return None
    out = []
    for d in json.load(open(indice, encoding='utf-8')).get('decks', []):
        if d.get('tipo') != 'strada' or not d.get('nucleo') or len(d['imp']) < 3: continue
        nu = Polygon(d['nucleo']).buffer(0)
        for g, v, b, c in ponti:
            if nu.intersection(g).area < 0.5 * min(nu.area, g.area): continue
            im = Polygon(d['imp']).buffer(0)
            fuori = im.difference(g.buffer(0.3))
            if not fuori.is_empty: out.append(fuori)
    return unary_union(out) if out else None


def galleria_piena(sup, S):
    """in raccordi(), dopo opere_dbgt: sopra una galleria stradale (gallerie_stradali) S e piena fino al bordo della GALLER, PIENA_M oltre, alla quota della strada
    di sopra (il nodo di strada alto piu vicino). Una cella di S (2 m) a cavallo del bordo del rilevato scendeva gia dentro la GALLER, e la strada di sopra
    perdeva il suo bordo sopra il fronte (Carlo 3/11, x -768 z 90 e 117 sotto la Milano-Meda). Scrive i nodi in sup.OPERA (il lisciatore non li tocca)"""
    import superficie as sf
    D = sup.D; assi = [a for a in assi_dbgt(D) if a['sed'] == '03']; tot = 0
    for P in gallerie_stradali(D):
        w = sup.R.win(P.buffer(PIENA_M + 3.0).bounds, 0)
        if w is None: continue
        r0, r1, c0, c1 = w; X, Z = sup.R.xz(w); pts = shapely.points(X, Z); W = S[r0:r1, c0:c1]
        zs = [np.median(a['z']) for a in assi if a['g'].intersects(P)]
        if not zs: continue
        basso = float(np.median(zs))
        zona = shapely.contains(P.buffer(PIENA_M), pts)
        strada = np.isin(sup.CLS[r0:r1, c0:c1], sf.ROADTYPE) & sup.FIX[r0:r1, c0:c1] & (W > basso + LUCE_MIN + 1.0) & shapely.contains(P.buffer(PIENA_M + 3.0), pts)
        if not strada.any() or not zona.any(): continue
        idx = ndimage.distance_transform_edt(~strada, return_distances=False, return_indices=True); vs = W[idx[0], idx[1]]
        su = zona & ~strada & (W < vs - 0.05); W[su] = vs[su]; sup.OPERA[r0:r1, c0:c1] |= zona; tot += int(su.sum())
    sup.log('gallerie stradali piene fino al bordo della GALLER: %d nodi alzati alla strada di sopra' % tot)
