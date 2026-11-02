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
# CAVALCAVIA (un PONTE con sotto assi EL_STR_LIV 01), in ordine: 1. la strada sotto, alla sua quota, comprese le aree con qualche vertice preso dal livello di sopra;
# 2. l'impalcato (impalcati.py); 3-4. spalle e scarpate: il suolo libero attorno alla strada sotto non sta sopra la scarpata 1:K che parte dal bordo della strada, e sotto
# l'impalcato mai oltre il suo intradosso; 5. recinzioni e scale seguono il suolo come prima. La vernice di strada non sale sulla scarpata (terreno_gioco.py, controlli_acqua.py).
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
RAMO_MAX, RAMO_DZ, RAMO_LARGO, RAMO_SOTTO = 9.0, 0.6, 3.0, 0.2   # m: un altro asse del fondo entro tanto dall'asse, a tanto di quota, il margine che gli si lascia verso la parete, e quanto sta sotto il suolo (sopra e un'altra strada)
ALLUNGA_MAX = 160.0  # m: per lato, oltre questo non e una trincea
COPERTO_OSM = 6.0  # m: una stazione cosi vicina alla via tunnel di OSM e coperta
K_SCARPATA = 1.5   # come superficie.K
RAGGIO_OPERA = 18.0  # m dall'impalcato: oltre, il vincolo della scarpata si allenta e il suolo torna quello di prima
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
    log('sottopassi: %d (vie OSM in galleria per auto %d, scartate %d)' % (len(out), len(W), len(scartati)))
    return out, scartati


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
    cl = lambda v: np.clip(v, -0.3, 0.3)   # (non oltre: se accanto il suolo sale, e la scarpata, non la strada)
    yl = y + cl(tl[0] - y[0]) * bl + cl(tl[-1] - y[-1]) * br; yr = y + cl(tr[0] - y[0]) * bl + cl(tr[-1] - y[-1]) * br
    # coperta: dentro la GALLER (senza GALLER vicino alla via tunnel). Una soletta sola: la quota viene dal tratto piu alto del coperto, e vale per tutto il coperto
    vie = [LineString(w['p']) for w in gr['vie'] if w['t'].get('tunnel') in ('yes', 'covered')]
    cop = np.array([dentro[k] or (not gs and any(v.distance(Point(C[k])) < COPERTO_OSM for v in vie)) for k in range(n)]); cop = ndimage.binary_closing(cop, np.ones(5, bool)) | cop
    soff = None; gal = np.zeros(n, bool)
    if cop.any():
        vt = tp[cop]; soff = float(np.median(vt[vt > vt.max() - PIANO]) - SP_OPERA)
        if soff - max(yl[cop].max(), yr[cop].max()) < LUCE_MIN: cop[:] = False; soff = None
    if soff is not None:
        idx = np.nonzero(cop & (tp >= soff + SP_OPERA - PIANO * 0.5))[0]      # S resta sopra da qui a qui; verso le testate l'opera prende le celle
        if len(idx):
            gal[idx[0]:idx[-1] + 1] = True
            if idx[-1] + 1 < n: cop[idx[-1] + 1] = True     # (il tratto arriva alla stazione di confine)
        r_ = np.nonzero(cop)[0]
        if r_[0] <= 3: cop[:r_[0]] = True                   # la testata e la bocca: niente tre metri di aperto davanti al fronte
        if r_[-1] >= n - 4: cop[r_[-1]:] = True
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
            if r.get('c', 9) > 3 or len(g) < 2: continue
            xy = np.array([nodes[q] for q in g], float); den = [foot.contains(Point(q)) for q in xy]
            if not any(den): continue
            l0 = 0.0 if r.get('o') else min(r['w'] * 0.24, r['mh'] * 0.5)
            F = list(r.get('lf') or [int(round(l0 * 100))] * len(g)); B = (list(r.get('lb') or [int(round(l0 * 100))] * len(g))) if not r.get('o') else None
            Rg = []
            for k in range(len(g)):
                T = xy[min(k + 1, len(g) - 1)] - xy[max(k - 1, 0)]; T = T / max(np.hypot(*T), 1e-9); Rg.append(np.array([-T[1], T[0]]))
                if den[k]:
                    hR, hL = lat(xy[k], Rg[k]), lat(xy[k], -Rg[k])
                    if r.get('o'): F[k] = int(round(100 * (hR - hL) / 2))     # senso unico: in mezzo
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


def scarpate(sup, S):
    """in raccordi(), sulla S libera: la scarpata che parte dal bordo della strada sotto. Dentro RAGGIO_OPERA dall'impalcato il suolo non sta sopra u + d / K; sotto l'impalcato
    non oltre il suo intradosso. I nodi fissi (le strade, la ferrovia, il letto) non si muovono. Oltre il raggio il vincolo si allenta: nessun gradino al bordo."""
    tot = 0; dz = []
    for o in getattr(sup, 'OPERE', []):
        w = sup.R.win(o['g'].buffer(RAGGIO_OPERA + 20).bounds, 0)
        if w is None: continue
        r0, r1, c0, c1 = w; X, Z = sup.R.xz(w); pts = shapely.points(X, Z); shapely.prepare(o['corr'])
        d = shapely.distance(o['corr'], pts); dp = shapely.distance(o['g'], pts)
        tetto = o['u'] + d / K_SCARPATA + np.maximum(0.0, dp - RAGGIO_OPERA)
        sotto = dp <= 0; tetto = np.where(sotto, np.minimum(tetto, o['bot'] - 0.2), tetto)
        W = S[r0:r1, c0:c1]; lib = ~sup.FIX[r0:r1, c0:c1] | (sup.BR[r0:r1, c0:c1] & ~np.isin(sup.CLS[r0:r1, c0:c1], (1, 2, 3, 4, 5, 6, 7)))
        k = lib & (W > tetto) & (d > 0)
        if k.any():
            dz.append((W[k] - tetto[k])); W[k] = tetto[k]; tot += int(k.sum()); o['nodi_scarpata'] = o.get('nodi_scarpata', 0) + int(k.sum())
    sup.opere_scarpate = dict(nodi=tot, abbassati_m=[round(float(v), 2) for v in np.percentile(np.concatenate(dz), (50, 90, 100))] if dz else None)
    sup.log('scarpate dei cavalcavia: %d nodi liberi abbassati, %s' % (tot, sup.opere_scarpate['abbassati_m']))


def rapporto(sup):
    return [dict(ponte=o['ponte'], c=_c(o['g']), quota_sotto=round(o['u'], 2), nodi_strada=o['nodi_strada'], nodi_scarpata=o.get('nodi_scarpata', 0)) for o in getattr(sup, 'OPERE', [])]
