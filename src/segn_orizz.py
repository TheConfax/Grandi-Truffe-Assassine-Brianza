"""Segnaletica orizzontale agli incroci: linee d'arresto di stop, dare precedenza e semafori (tile key 'la', disegnate da world3.js).

Posizioni solo da OSM, niente regole per un comune:
  - stop e dare precedenza: dove li dà src/segnaletica.json (segnaletica_osm.py: punto del cartello e verso del traffico). Da lì si va avanti
    lungo la via, nel verso del traffico, fino al primo incrocio: quello è il ramo che si ferma;
  - semafori: i nodi highway=traffic_signals sulle vie per auto, un ramo per ogni arrivo (per un nodo in mezzo a una via, il verso di
    traffic_signals:direction / direction se c'è, altrimenti tutti e due).
Dove sta la linea: sul ramo, a monte dell'incrocio, dove la carreggiata del DBGT torna alla larghezza normale del ramo (la "soglia", dopo lo
svaso dell'incrocio) e mai dentro l'incrocio; se lì c'e' una striscia pedonale (OSM) la linea la salta (art. 144 c.5: a 1 m dal suo limite,
per i semafori; per stop e dare solo se la strisce ci finisce sopra). Da bordo della carreggiata alla striscia di mezzeria (due sensi) o all'altro
bordo (senso unico): DPR 495/1992 art. 144 c.3.

Forme e misure (DPR 495/1992, Regolamento di esecuzione del codice della strada):
  art. 144 c.1: linea d'arresto continua larga almeno 50 cm con stop e semaforo (figg. II.432/a-c); discontinua con dare precedenza
  art. 144 c.4 (fig. II.433): linea del dare precedenza = triangoli bianchi con la punta verso il conducente; base x altezza 60x70 cm strade
      tipo C e D, 50x60 cm tipo E, 40x50 cm tipo F; distanza fra due triangoli pari a meta' della base
  art. 148 c.8 (fig. II.432/a, scritta di fig. II.441/b): STOP sulla pavimentazione davanti alla linea, in ogni corsia, il limite superiore
      della scritta a 1-3 m dalla linea (qui 2 m); la scritta di fig. II.441/b (strade locali) e' larga 2,09 m e alta 1,60 m
  art. 148 c.9 (fig. II.442/a): simbolo del triangolo del dare precedenza, ripetuto per ogni corsia, il suo limite superiore (la base) a non meno di 2 m
      dai vertici dei triangoli della linea; contorno largo 12 cm, 1,00 x 2,00 m (strade locali, centri abitati) o contorno 24 cm, 2,00 x 6,00 m
      (strade extraurbane secondarie)  [misure dal disegno quotato di fig. II.442/a nel progetto va.mite.gov.it/File/Documento/939947]
Tipo di strada (art. 2 CdS) da OSM: trunk/primary/secondary = C/D; tertiary = E; il resto F. Simbolo grande 2x6 solo con maxspeed >= 70 sulle
strade primary/secondary/trunk (extraurbane). Dove la corsia e' piu' stretta della scritta (2,09 m) la scritta non c'e'.
Riga: [k, x, z, dx, dz, s0, s1, c]: k 0 stop 1 dare 2 semaforo; (x, z) il punto sull'asse del ramo, (dx, dz) il verso del traffico, s0..s1 gli
estremi della linea a destra del verso (n = (-dz, dx)) da quel punto; c = tipo (0 C/D, 1 E, 2 F) + 4 se simbolo grande + 8 se la scritta/simbolo ci stanno."""
import json, math, os, collections
import numpy as np

ARR = 0.5          # larghezza della linea d'arresto, art. 144 c.1
ZEB_L = 3.2        # lunghezza delle strisce pedonali del gioco (world3.js)
STOP_L, STOP_W, STOP_D = 1.60, 2.09, 2.0   # fig. II.441/b; distanza dalla linea 1-3 m (art. 148 c.8)
TIPO_C, TIPO_E, TIPO_F = 0, 1, 2


def _tipo(r):
    return TIPO_C if r['hw'] in ('motorway', 'trunk', 'primary', 'secondary', 'motorway_link', 'trunk_link', 'primary_link', 'secondary_link') else TIPO_E if r['hw'] in ('tertiary', 'tertiary_link') else TIPO_F


def _grande(r):
    return r['hw'] in ('trunk', 'primary', 'secondary') and (r.get('ms') or 0) >= 70


def linee(nodes, ntags, car_nodes, osm_segn, crossings, STR, inside, log):
    """car_nodes: nodo OSM -> [(via, indice)] delle vie per auto a livello; osm_segn: segnaletica.json; crossings: [x, z, dx, dz, w]"""
    R = STR.R if STR is not None else None; CV = STR.CV if STR is not None else None
    deg = lambda n: sum(2 if 0 < i < len(r['refs']) - 1 else 1 for r, i in car_nodes.get(n, []))
    cnt = collections.Counter(); out = []; visti = set()

    def ray(P, N, mx=25.0): return float(R.ray(CV, np.array([P], float), np.array([N], float), mx)[0])

    def dentro(p): return R is None or bool(R.at(CV, [p[0]], [p[1]])[0])

    def braccio(r, i, passo):
        """il ramo che arriva al nodo i della via r dal lato passo (-1: i punti prima, +1: dopo): [(x, z)] da J verso monte, fino a 26 m o al nodo di incrocio dopo"""
        pts = [nodes[r['refs'][i]]]; acc = 0.0; j = i
        while 0 <= j + passo < len(r['refs']):
            j += passo; a = pts[-1]; b = nodes[r['refs'][j]]; acc += math.dist(a, b); pts.append(b)
            if acc >= 26 or (deg(r['refs'][j]) >= 3 and acc > 6): break
        return pts if len(pts) >= 2 and acc > 3 else None

    def punto(pts, cum, u):
        k = 1
        while k < len(pts) - 1 and cum[k] < u: k += 1
        L = cum[k] - cum[k - 1] or 1.0; f = min(max((u - cum[k - 1]) / L, 0.0), 1.0)
        a, b = pts[k - 1], pts[k]; return (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f), ((a[0] - b[0]) / L, (a[1] - b[1]) / L)   # il verso e' verso J: da b ad a

    def larghezza(P, d, w):
        n = (-d[1], d[0]); dr, dl = ray(P, n), ray(P, (-n[0], -n[1])); lim = w / 2 + 3
        return (dl if dl < lim else w / 2), (dr if dr < lim else w / 2)

    def un_ramo(kind, r, i, passo, semaforo):
        pts = braccio(r, i, passo)
        if pts is None: return
        cum = [0.0]
        for a, b in zip(pts, pts[1:]): cum.append(cum[-1] + math.dist(a, b))
        Lm = cum[-1]
        letto = R is not None
        if letto:
            us = np.arange(0.0, min(Lm, 22.0) + 1e-6, 0.5); ws = []
            for u in us:
                P, d = punto(pts, cum, u)
                if not dentro(P): ws.append(None); continue
                dl, dr = larghezza(P, d, r['w']); ws.append(dl + dr)
            norm = [w for u, w in zip(us, ws) if w is not None and u >= min(10.0, Lm * 0.5)]
            if len(norm) < 3: letto = False   # fuori dal DBGT (o l'asse non cade sulla carreggiata): la larghezza di OSM, come il gioco la disegna li'
            else:
                W0 = float(np.median(norm)); lim = W0 * 1.2 + 0.3; ts = 14.0
                for k, u in enumerate(us):
                    if u < 2.5: continue
                    if all(w is None or w <= lim for w in ws[k:k + 7]): ts = u; break
                u_l = min(ts, 14.0) + ARR / 2
        if not letto:
            altre = [r2['mh'] for r2, _i2 in car_nodes.get(r['refs'][i], []) if r2 is not r]
            u_l = max(3.0, (max(altre) if altre else r['mh']) + 1.5) + ARR / 2   # oltre il bordo della via che si attraversa
        P0, d0 = punto(pts, cum, 0)
        # le strisce pedonali del ramo: la linea non ci finisce sopra
        for _ in range(2):
            for cx, cz, cdx, cdz, cw in crossings:
                if math.hypot(cx - P0[0], cz - P0[1]) > 40: continue
                uc = None; best = 4.0
                for u in np.arange(0.0, min(Lm, 22.0) + 1e-6, 0.5):
                    Pu, du = punto(pts, cum, u); dd = math.hypot(cx - Pu[0], cz - Pu[1])
                    if dd < best and abs(cdx * du[0] + cdz * du[1]) > 0.8: best, uc = dd, u
                if uc is None: continue
                if semaforo and uc <= u_l + 4.0 and uc + ZEB_L / 2 + 1.0 > u_l - ARR / 2: u_l = max(u_l, uc + ZEB_L / 2 + 1.0 + ARR / 2)
                elif not semaforo and abs(uc - u_l) < ZEB_L / 2 + ARR / 2 + 0.3: u_l = uc + ZEB_L / 2 + 1.0 + ARR / 2
        if u_l > Lm - 0.5: cnt['saltato: ramo corto'] += 1; return
        P, d = punto(pts, cum, u_l)
        if letto:
            if not dentro(P): cnt['saltato: asse fuori carreggiata'] += 1; return
            dl, dr = larghezza(P, d, r['w'])
        else: dl = dr = r['mh']
        s1 = dr; s0 = -dl if r['o'] else (dr - dl) / 2
        if s1 - s0 < 1.5: cnt['saltato: carreggiata stretta'] += 1; return
        n = (-d[1], d[0]); c = _tipo(r) | (4 if _grande(r) else 0)
        ok = (s1 - s0) >= STOP_W + 0.2 if kind == 0 else (s1 - s0) >= (2.0 if _grande(r) else 1.0) + 0.2
        if ok and letto:   # la scritta o il simbolo stanno tutti sulla carreggiata
            sm = (s0 + s1) / 2; ext = (STOP_D + STOP_L + 0.3) if kind == 0 else (14.0 if _grande(r) else 5.5)
            for uu in (u_l, u_l + ext):
                for ss in (sm - 0.9, sm, sm + 0.9):
                    Q, dq = punto(pts, cum, min(uu, Lm))
                    if not dentro((Q[0] + n[0] * ss, Q[1] + n[1] * ss)): ok = False
        if ok: c |= 8
        # doppioni: stesso ramo (stessa via e stesso punto)
        kk = (kind, round(P[0] / 4), round(P[1] / 4))
        if kk in visti: return
        visti.add(kk)
        out.append([kind, round(P[0], 1), round(P[1], 1), round(d[0], 3), round(d[1], 3), round(s0, 2), round(s1, 2), c]); cnt[['stop', 'dare', 'semaforo'][kind]] += 1
        cnt['con scritta/simbolo'] += 1 if ok else 0

    # stop e dare precedenza di OSM (segnaletica.json): si va avanti nel verso del traffico fino al primo incrocio
    roads = collections.defaultdict(list)   # griglia delle vie per auto
    seen_r = {}
    for l_ in car_nodes.values():
        for r_, _i in l_: seen_r[id(r_)] = r_
    for r_ in seen_r.values():
        for a, b in zip(r_['refs'], r_['refs'][1:]):
            pa, pb = nodes[a], nodes[b]
            for gx in range(int(min(pa[0], pb[0]) // 30), int(max(pa[0], pb[0]) // 30) + 1):
                for gz in range(int(min(pa[1], pb[1]) // 30), int(max(pa[1], pb[1]) // 30) + 1): roads[(gx, gz)].append((r_, a, b))
    for e in osm_segn:
        kind = {'stop': 0, 'dare': 1}.get(e[0])   # the entries of the roundabouts: rotonde() below, on the ring
        if kind is None: continue
        x, z, dx, dz = e[1], e[2], e[3], e[4]
        if not (dx or dz): cnt['saltato: senza verso'] += 1; continue
        best = None
        for gx in (int(x // 30) - 1, int(x // 30), int(x // 30) + 1):
            for gz in (int(z // 30) - 1, int(z // 30), int(z // 30) + 1):
                for r_, a, b in roads.get((gx, gz), ()):
                    pa, pb = nodes[a], nodes[b]; ex, ez = pb[0] - pa[0], pb[1] - pa[1]; L2 = ex * ex + ez * ez or 1.0; L = math.sqrt(L2)
                    t = min(max(((x - pa[0]) * ex + (z - pa[1]) * ez) / L2, 0), 1); dist = math.hypot(x - pa[0] - ex * t, z - pa[1] - ez * t)
                    al = (ex * dx + ez * dz) / L
                    if abs(al) < 0.7 or dist > 12: continue
                    if best is None or dist < best[0]: best = (dist, r_, a, b, al)
        if best is None: cnt['saltato: via non trovata'] += 1; continue
        _, r_, a, b, al = best
        ia, ib = r_['refs'].index(a), r_['refs'].index(b)
        if al > 0:   # il traffico va da a verso b: avanti
            j, passo = ib, 1
        else: j, passo = ia, -1
        acc = math.dist((x, z), nodes[r_['refs'][j]])
        while deg(r_['refs'][j]) < 3 and 0 <= j + passo < len(r_['refs']):
            acc += math.dist(nodes[r_['refs'][j]], nodes[r_['refs'][j + passo]]); j += passo
        if deg(r_['refs'][j]) < 3 or acc > 45: cnt['saltato: nessun incrocio avanti'] += 1; continue
        try: un_ramo(kind, r_, j, -passo, False)
        except Exception as ex_: cnt['errore'] += 1; log('segn_orizz errore', repr(ex_))
    # semafori
    for nid, t in ntags.items():
        if t.get('highway') != 'traffic_signals' or nid not in car_nodes or not inside(nodes[nid], 0): continue
        dirn = t.get('traffic_signals:direction') or t.get('direction')
        l_ = car_nodes[nid]; mid = deg(nid) < 3
        for r_, i in l_:
            for passo in (-1, 1):   # il traffico arriva da i+passo verso i
                if not (0 <= i + passo < len(r_['refs'])): continue
                if r_['o'] and passo == 1: continue
                if mid and dirn in ('forward', 'backward'):
                    if (dirn == 'forward') != (passo == -1): continue
                try: un_ramo(2, r_, i, passo, True)
                except Exception as ex_: cnt['errore'] += 1; log('segn_orizz errore', repr(ex_))
    log('linee d\'arresto', len(out), dict(cnt))
    return out


# ---------------------------------------------------------------------------------------------------------------- fermate del bus
"""Fermate dei bus (OSM highway=bus_stop, o public_transport=platform con bus=yes, su un nodo vicino a una via per auto): la zona gialla di
DPR 495/1992 art. 151, sulla carreggiata dalla parte della fermata (il bus si ferma a destra del suo verso).
  art. 151 c.1: striscia longitudinale gialla discontinua a 2,70 m dal marciapiede (dal bordo della carreggiata) e due strisce trasversali gialle
      continue che la raccordano al bordo; larghezza delle strisce 12 cm
  art. 151 c.2: la zona centrale lunga quanto il veicolo piu' lungo che ferma + 2 m: qui 12 m (autobus urbano) + 2 = 14 m (la lunghezza del veicolo non
      e' in OSM: e' l'unico dato assunto, il bus urbano standard di 12 m). I 12 m di entrata e di uscita servono solo allo zig zag, che non c'e' (Carlo, 3/11)
  art. 151 c.4: scritta BUS gialla (art. 148 c.4) dentro la zona, leggibile da chi arriva; altezza 1,60 m come le lettere della fig. II.441/b; larghezza 2,40 m
      (dalla foto di riferimento di Carlo); al centro della zona, a meta' fra il bordo e la striscia, dritta lungo la corsia
  modulo della discontinua: non e' scritto nel regolamento per la fermata; dalla foto di riferimento di Carlo: tratto circa 1,0 m, intervallo circa 1,5 m (la
      stessa proporzione della striscia di guida alle intersezioni, art. 138 c.3 tipo g: 1,0 m / 1,5 m)
  zig zag (fig. II.447): non disegnato (facoltativo, art. 151 c.3; Carlo: da citta' popolosa)
Dove: centrata sulla pensilina (OSM amenity=shelter, shelter_type=public_transport) se ce n'e' una vicina dalla stessa parte, se no sul nodo della fermata.
Le linee si misurano dal bordo vero della carreggiata (il contorno di AC_VEI del DBGT, STR.U_carr), mai dall'asse di OSM: il bordo per 14 m attorno al
centro, liscio (una parabola nel suo riferimento: segue una curva dolce); dove non e' liscio (un passo carraio, l'angolo di un incrocio) la fermata
non si disegna, e cosi' se un incrocio, un passo carraio (un'altra via per auto o di servizio che parte dalla strada) o una striscia pedonale
cade dentro i 14 m.
Riga: [dash, kerb, [bx, bz, ux, uz]]: dash, kerb: x, z in cm lungo la zona (un punto per metro: la striscia discontinua e il bordo di fronte a lei); la scritta BUS
in (bx, bz) cm, con il verso di marcia (ux, uz)."""
FB_LUNG = 14.0
FB_DIST = 2.70
FB_LISCIO = 0.15   # m: il bordo puo' scostarsi tanto dalla sua parabola; di piu' e' un passo carraio o un angolo


def _bordo_vicino(U, P, N, rmax=25.0):
    """dal punto P (sulla carreggiata) lungo N: il primo punto del bordo di U (esatto, dal contorno del poligono)"""
    import shapely
    from shapely.geometry import LineString
    seg = LineString([P, (P[0] + N[0] * rmax, P[1] + N[1] * rmax)])
    hit = seg.intersection(U.boundary)
    best = None
    for g in getattr(hit, 'geoms', [hit]):
        if g.is_empty: continue
        for c in (g.coords if g.geom_type == 'Point' else [g.coords[0]]):
            d = math.dist(P, c)
            if d > 1e-6 and (best is None or d < best[0]): best = (d, c)
    return best


def _anello_di(U, Q):
    """l'anello (esterno o buco) del contorno di U che passa per Q"""
    from shapely.geometry import Point
    P = Point(Q); best = None
    for p in getattr(U, 'geoms', [U]):
        if p.geom_type != 'Polygon': continue
        for ring in [p.exterior] + list(p.interiors):
            d = ring.distance(P)
            if best is None or d < best[0]: best = (d, ring)
    return best[1] if best and best[0] < 0.05 else None


def fermate(nodes, ntags, car_nodes, STR, inside, log, banchine=(), vie_nodo=None, misure=None, crossings=()):
    """banchine: [((x, z), 'pensilina' | 'banchina')] le pensiline e le banchine di OSM disegnate come vie; vie_nodo: nodo -> quante vie per auto o di servizio ci passano"""
    from shapely.geometry import Point, box, LineString
    cnt = collections.Counter(); out = []
    if STR is None or getattr(STR, 'U_carr', None) is None: log('fermate del bus', 0, 'senza DBGT'); return out
    U = STR.U_carr
    deg = lambda n: sum(2 if 0 < i < len(r['refs']) - 1 else 1 for r, i in car_nodes.get(n, []))
    seen_r = {}
    for l_ in car_nodes.values():
        for r_, _i in l_: seen_r[id(r_)] = r_
    grid = collections.defaultdict(list)
    for r_ in seen_r.values():
        for k in range(len(r_['refs']) - 1):
            a, b = nodes[r_['refs'][k]], nodes[r_['refs'][k + 1]]
            for gx in range(int(min(a[0], b[0]) // 30), int(max(a[0], b[0]) // 30) + 1):
                for gz in range(int(min(a[1], b[1]) // 30), int(max(a[1], b[1]) // 30) + 1): grid[(gx, gz)].append((r_, k))
    pens = [(p, k) for p, k in banchine] + [(nodes[n], 'pensilina') for n, t in ntags.items() if n in nodes and t.get('amenity') == 'shelter' and t.get('shelter_type') == 'public_transport']

    def via(p):
        best = None
        for gx in (int(p[0] // 30) - 1, int(p[0] // 30), int(p[0] // 30) + 1):
            for gz in (int(p[1] // 30) - 1, int(p[1] // 30), int(p[1] // 30) + 1):
                for r_, k in grid.get((gx, gz), ()):
                    a, b = nodes[r_['refs'][k]], nodes[r_['refs'][k + 1]]; ex, ez = b[0] - a[0], b[1] - a[1]; L2 = ex * ex + ez * ez or 1.0
                    u = min(max(((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2, 0), 1); d = math.hypot(p[0] - a[0] - ex * u, p[1] - a[1] - ez * u)
                    if d <= 14 and (best is None or d < best[0]): best = (d, r_, k, u)
        return best

    fatte = []
    for nid, t in sorted(ntags.items()):
        if nid not in nodes or not inside(nodes[nid], 0): continue
        if not (t.get('highway') == 'bus_stop' or (t.get('public_transport') == 'platform' and t.get('bus') == 'yes')): continue
        p = nodes[nid]; best = via(p)
        if best is None: cnt['saltata: nessuna via'] += 1; continue
        dist, r_, k, u = best; refs = r_['refs']
        a, b = nodes[refs[k]], nodes[refs[k + 1]]; ex, ez = b[0] - a[0], b[1] - a[1]; L = math.hypot(ex, ez) or 1.0; ex, ez = ex / L, ez / L
        A = (a[0] + ex * u * L, a[1] + ez * u * L)   # la fermata sull'asse
        side = (p[0] - a[0]) * (-ez) + (p[1] - a[1]) * ex   # > 0: a destra del verso della via
        if abs(side) < 1.0:   # il nodo sta sulla via: la parte giusta e' quella della pensilina o della banchina vicina
            q = [(math.dist(pp, p), pp) for pp, _k in pens if math.dist(pp, p) < 25]
            if q: pp = min(q)[1]; side = (pp[0] - a[0]) * (-ez) + (pp[1] - a[1]) * ex
            elif r_['o']: side = 1.0
            else: cnt['saltata: nodo sulla via, parte ignota'] += 1; continue
        fwd = side >= 0
        if r_['o'] and not fwd: cnt['saltata: a sinistra di una via a senso unico'] += 1; continue
        d = (ex, ez) if fwd else (-ex, -ez); nr = (-d[1], d[0])   # il verso del bus e la sua destra (verso il marciapiede)
        # il centro: la pensilina dalla stessa parte, entro 15 m lungo la via, se c'e'
        c_al = 0.0; q = []
        for pp, kk in pens:
            al = (pp[0] - A[0]) * d[0] + (pp[1] - A[1]) * d[1]; lat = (pp[0] - A[0]) * nr[0] + (pp[1] - A[1]) * nr[1]
            if kk == 'pensilina' and abs(al) < 15 and 0 < lat < 15: q.append((abs(al), al))
        if q: c_al = min(q)[1]; cnt['centrata sulla pensilina'] += 1
        C = (A[0] + d[0] * c_al, A[1] + d[1] * c_al); osm = False
        if not U.contains(Point(C)):   # l'asse di OSM fuori dalla carreggiata del DBGT: il punto della carreggiata piu' vicino di traverso, entro 8 m
            Cn = None
            for t_ in np.arange(0.25, 8.01, 0.25):
                for sg_ in (-1, 1):
                    q_ = (C[0] + nr[0] * t_ * sg_, C[1] + nr[1] * t_ * sg_)
                    if U.contains(Point(q_)): Cn = q_; break
                if Cn is not None: break
            if Cn is not None: C = Cn
            elif U.distance(Point(C)) < 20: cnt['saltata: asse di OSM lontano dalla carreggiata del DBGT'] += 1; continue
            else: osm = True
        ts = np.arange(-FB_LUNG / 2 - 1.0, FB_LUNG / 2 + 1.0 + 1e-6, 0.5)
        if osm:   # fuori dal DBGT il gioco disegna la via di OSM larga 2 mh attorno al suo asse: il bordo e' l'asse spostato di mh a destra
            if r_['mh'] < FB_DIST + 0.3: cnt['saltata: carreggiata stretta'] += 1; continue
            ring = LineString([nodes[x] for x in (refs if fwd else refs[::-1])]).offset_curve(r_['mh'], join_style='mitre')   # x est, z sud: il lato positivo di shapely e' la destra
            if ring.geom_type != 'LineString': cnt['saltata: bordo non trovato'] += 1; continue
            s0 = ring.project(Point(C)); K0 = ring.interpolate(s0).coords[0]
            if s0 + ts[0] < 0 or s0 + ts[-1] > ring.length: cnt['saltata: via troppo corta per la zona'] += 1; continue
            S = np.array([ring.interpolate(s0 + tt).coords[0] for tt in ts])
        else:
            hit = _bordo_vicino(U, C, nr)
            if hit is None: cnt['saltata: bordo non trovato'] += 1; continue
            K0 = hit[1]; ring = _anello_di(U, K0)
            if ring is None: cnt['saltata: bordo non trovato'] += 1; continue
            Lr = ring.length; s0 = ring.project(Point(K0))
            S = np.array([ring.interpolate((s0 + tt) % Lr).coords[0] for tt in ts])
        if (S[-1] - S[0]) @ np.array(d) < 0: S = S[::-1]   # nel verso del bus
        ch = S[-1] - S[0]; Lc = float(np.hypot(*ch))
        if Lc < FB_LUNG * 0.9: cnt['saltata: bordo non liscio (angolo)'] += 1; continue
        e = ch / Lc; nn = np.array([-e[1], e[0]])   # nn: verso il marciapiede
        loc = S - np.array(K0); sx = loc @ e; sy = loc @ nn
        cf = np.polyfit(sx, sy, 2); res = float(np.abs(np.polyval(cf, sx) - sy).max())
        if res > FB_LISCIO: cnt['saltata: bordo non liscio (passo carraio o angolo)'] += 1; continue
        if abs(cf[0]) > 1 / 60.0: cnt['saltata: bordo troppo curvo'] += 1; continue
        # incroci e passi carrai dentro i 14 m (con mezzo metro di margine)
        brutto = False
        for j, nref in enumerate(refs):
            q_ = nodes[nref]; al = (q_[0] - C[0]) * d[0] + (q_[1] - C[1]) * d[1]
            if abs(al) > FB_LUNG / 2 + 0.5 or math.dist(q_, C) > 15: continue
            nv = vie_nodo.get(nref, 0) if vie_nodo is not None else 0
            if deg(nref) >= 3 or nv >= (2 if 0 < j < len(refs) - 1 else 3): brutto = True; break   # alle due teste della via la strada continua in un'altra
        if brutto: cnt['saltata: incrocio o passo carraio dentro i 14 m'] += 1; continue
        if any(abs((cx - C[0]) * d[0] + (cz - C[1]) * d[1]) < FB_LUNG / 2 + ZEB_L / 2 + 0.3 and abs((cx - C[0]) * nr[0] + (cz - C[1]) * nr[1]) < 8 for cx, cz, _dx, _dz, _w in crossings):
            cnt['saltata: striscia pedonale dentro i 14 m'] += 1; continue
        # la zona: 14 m centrati sul punto del bordo davanti al centro, ogni metro; la striscia a 2,70 m dal bordo lungo la normale della parabola
        xs = np.linspace(-FB_LUNG / 2, FB_LUNG / 2, int(FB_LUNG) + 1)
        ys = np.polyval(cf, xs); dy = np.polyval(np.polyder(cf), xs)
        kerb = []; dash = []
        for xx, yy, dd in zip(xs, ys, dy):
            tg = e + nn * dd; tg = tg / np.hypot(*tg); nm = np.array([-tg[1], tg[0]])   # nm verso il marciapiede
            Kp = np.array(K0) + e * xx + nn * yy; kerb.append(Kp); dash.append(Kp - nm * FB_DIST)
        dash = np.array(dash); kerb = np.array(kerb)
        # c'e' posto: la striscia sulla carreggiata, e oltre lei almeno 3 m di carreggiata per chi passa
        mid = len(xs) // 2; tg = e + nn * dy[mid]; tg = tg / np.hypot(*tg); nm = np.array([-tg[1], tg[0]])
        if not osm:
            if not all(U.contains(Point(*q_)) for q_ in dash): cnt['saltata: carreggiata stretta'] += 1; continue
            w_ = _bordo_vicino(U, tuple(kerb[mid] - nm * 0.05), tuple(-nm), 40.0)
            if w_ is None or w_[0] < FB_DIST + 3.0: cnt['saltata: carreggiata stretta'] += 1; continue
        bm = (kerb[mid] + dash[mid]) / 2
        if any(math.dist(bm, m_) < 14 and t_[0] * tg[0] + t_[1] * tg[1] > 0 for m_, t_ in fatte): cnt['saltata: doppione'] += 1; continue   # la stessa fermata (dalla stessa parte)
        fatte.append((tuple(bm), tuple(tg)))
        f = lambda L_: [int(round(v * 100)) for q_ in L_ for v in q_]
        out.append([f(dash), f(kerb), [int(round(bm[0] * 100)), int(round(bm[1] * 100)), round(float(tg[0]), 3), round(float(tg[1]), 3)]]); cnt['fermate'] += 1 ; cnt['fermate fuori dal DBGT (bordo della via di OSM disegnata)' if osm else 'fermate sul bordo del DBGT'] += 1
        if misure is not None: misure.append(dict(osm=osm, bordo=ring, dash=dash.tolist()))
    log('fermate del bus', len(out), dict(cnt))
    return out


# ---------------------------------------------------------------------------------------------------------------- rotonde
"""Il dare precedenza all'ingresso delle rotonde (Carlo, 3/11, per tutte le rotonde: OSM dice solo quali vie sono junction=roundabout/circular):
  - ogni ingresso di ogni rotonda ha il dare precedenza (art. 144 c.4, fig. II.433: i triangoli come agli incroci, misure per tipo della via che entra);
  - la linea sta sul bordo esterno dell'anello (la carreggiata che gira, dal DBGT: contorno di AC_VEI attorno all'isola centrale MAN_TR), ne segue la
    curva e copre solo la corsia d'ingresso: dall'isola spartitraffico (o dalla mezzeria se non c'e') al cordolo destro;
  - il simbolo del triangolo (art. 148 c.9, fig. II.442/a) nella corsia d'ingresso, la sua base a 2 m dai vertici dei triangoli, dritto nel verso di chi entra;
  - il cartello (dare precedenza + rotatoria) sul bordo destro dell'ingresso, all'altezza della linea, fuori dalla carreggiata.
Come: dal centro dell'anello di OSM un raggio ogni mezzo grado. Dove il raggio lascia la carreggiata subito dopo la larghezza dell'anello quello e' il bordo
esterno; dove va oltre di piu' di 0,6 m c'e' un'apertura (un ramo). Il bordo esterno e' un cerchio messo sui punti veri del bordo vicini all'apertura (minimi
quadrati), e attraverso l'apertura la linea sta su quel cerchio. Dentro un'apertura un tratto dove il raggio si ferma presto (l'isola spartitraffico, o il
cordolo fra due rami vicini) la divide. Le vie di OSM dicono quale apertura e' un ingresso: una via a doppio senso (la linea dal cordolo destro fino a dove
il suo asse passa il bordo: la mezzeria) o a senso unico verso l'anello (tutta l'apertura). Il traffico gira in senso antiorario: per chi entra la destra e'
il lato dell'apertura con l'angolo piu' piccolo (x est, z sud).
Riga 'lr': [linea, c, simbolo, cartello]: linea x, z in cm lungo il bordo dal cordolo destro verso la mezzeria (chi entra sta alla sua sinistra);
c = tipo (0 C/D, 1 E, 2 F) + 4 se simbolo grande; simbolo [x, z, ux, uz] (cm: il mezzo della base, u il verso di chi entra) o 0 se non ci sta; cartello
[x, z, dx, dz] (cm, la faccia verso chi entra) o [x, z, dx, dz, 1] dove il posto e' da cercare nel gioco (segnali3.js segPlace): l'anello fuori dal DBGT."""
RB_PASSO = 0.5          # gradi fra due raggi
RB_APERTURA = 0.6       # m oltre il bordo: un'apertura
RB_FERMO = 6.0          # m oltre il bordo: il raggio fermato presto dentro un'apertura (isola o cordolo fra due rami)
RB_MARGINE = 0.15       # m: la linea si ferma tanto prima del cordolo e dell'isola
RB_SIMB = 2.0           # m fra i vertici dei triangoli e la base del simbolo (art. 148 c.9)


def _cerchio(P):
    """cerchio ai minimi quadrati (Kasa): centro, raggio, scarto medio"""
    P = np.asarray(P, float); A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]; b = (P ** 2).sum(1)
    sol = np.linalg.lstsq(A, b, rcond=None)[0]; c = sol[:2]; r = math.sqrt(max(sol[2] + c @ c, 1e-6))
    return c, r, float(np.sqrt(np.mean((np.hypot(*(P - c).T) - r) ** 2)))


def _sul_cerchio(C, u, c, r):
    """il punto del raggio C + t u (t > 0) sul cerchio (c, r)"""
    f = np.asarray(C, float) - c; b = f @ u; q = b * b - (f @ f - r * r)
    if q < 0: return None
    t = -b + math.sqrt(q); return t if t > 0 else None


def rotonde(nodes, car_nodes, anelli, STR, inside, log, misure=None, crossings=()):
    """anelli: [[nodo]] le vie junction=roundabout/circular di OSM; misure: lista dove mettere le misure di prova"""
    import shapely
    from shapely.geometry import Point, LineString, box
    from shapely.ops import unary_union
    cnt = collections.Counter(); out = []
    U = getattr(STR, 'U_carr', None) if STR is not None else None
    isole = list(getattr(STR, 'isole', []) or []) if STR is not None else []
    it = shapely.STRtree(isole) if isole else None
    par = {}   # gli anelli: le vie che si toccano

    def fnd(a):
        while par.setdefault(a, a) != a: par[a] = par[par[a]]; a = par[a]
        return a
    for nd in anelli:
        for n_ in nd[1:]: par[fnd(n_)] = fnd(nd[0])
    gruppi = collections.defaultdict(set)
    for nd in anelli:
        for n_ in nd: gruppi[fnd(n_)].add(n_)
    vie = {}
    for l_ in car_nodes.values():
        for r_, _i in l_: vie[id(r_)] = r_

    def emetti(lin, rm, cl, rl, clip):
        """una linea sul bordo (punti dal cordolo destro verso la mezzeria), il simbolo e il cartello"""
        lin = np.asarray(lin)
        ch = lin[-1] - lin[0]; ch = ch / np.hypot(*ch); uin = np.array([ch[1], -ch[0]])   # chi entra: verso il centro, perpendicolare alla corda
        if (np.mean(lin, 0) - cl) @ uin > 0: uin = -uin
        c = _tipo(rm['r']) | (4 if _grande(rm['r']) else 0)
        h = [0.7, 0.6, 0.5][c & 3]; SW, SH = (2.0, 6.0) if c & 4 else (1.0, 2.0)
        mid = lin[len(lin) // 2] if len(lin) % 2 else (lin[len(lin) // 2 - 1] + lin[len(lin) // 2]) / 2   # il mezzo dell'arco
        B = mid - uin * (0.05 + h + RB_SIMB); nb = np.array([-uin[1], uin[0]])
        cn = [B + nb * SW / 2, B - nb * SW / 2, B - uin * SH, B - uin * SH / 2]
        if clip is not None: sta = all(clip.contains(Point(*q_)) for q_ in cn)
        else: asse = LineString(rm['seq']); sta = all(asse.distance(Point(*q_)) <= rm['r']['mh'] - 0.1 for q_ in cn)
        for cx, cz, cdx, cdz, cw in crossings:   # niente simbolo sopra una striscia pedonale ((cdx, cdz) il verso della strada: ZEB_L lungo lei, cw di traverso)
            if any(abs((q_[0] - cx) * cdx + (q_[1] - cz) * cdz) < ZEB_L / 2 + 0.3 and abs((q_[0] - cx) * -cdz + (q_[1] - cz) * cdx) < cw / 2 + 0.3 for q_ in cn + [B]): sta = False
        simb = [int(round(B[0] * 100)), int(round(B[1] * 100)), round(float(uin[0]), 3), round(float(uin[1]), 3)] if (math.dist(lin[0], lin[-1]) >= SW + 0.4 and sta) else 0
        if simb: cnt['con il simbolo'] += 1
        # il cartello: il punto fuori dalla carreggiata (almeno 0,5 m dal bordo) piu' vicino al capo destro della linea, alla sua destra (via
        # dall'apertura) o indietro verso chi entra, mai dentro l'anello
        E = lin[0]; tdx = lin[0] - lin[1]; tdx = tdx / np.hypot(*tdx); cart = None
        if clip is not None:
            ab = np.array(sorted(((math.hypot(a_, b_), a_, b_) for a_ in np.arange(0.0, 5.01, 0.1) for b_ in np.arange(0.0, 4.01, 0.1))))[:, 1:]
            Qs = E + np.outer(ab[:, 0], tdx) - np.outer(ab[:, 1], uin)
            okq = (np.hypot(*(Qs - cl).T) >= rl + 0.3) & (shapely.distance(clip, shapely.points(Qs)) >= 0.5)
            if okq.any(): cart = Qs[int(np.argmax(okq))]
        if cart is None: cnt['cartello: il posto lo cerca il gioco'] += 1; sg_ = [int(round(E[0] * 100)), int(round(E[1] * 100)), round(float(uin[0]), 3), round(float(uin[1]), 3), 1]
        else: sg_ = [int(round(cart[0] * 100)), int(round(cart[1] * 100)), round(float(uin[0]), 3), round(float(uin[1]), 3)]
        out.append([[int(round(v * 100)) for q_ in lin for v in q_], c, simb, sg_]); cnt['ingressi con la linea'] += 1
        return cart

    def solo_cartello(rm, motivo):
        """un ingresso senza linea: il cartello sul ramo, 6 m prima dell'anello, e il posto sul bordo lo cerca il gioco (segnali3.js segPlace)"""
        cnt[motivo] += 1
        a_, b_ = rm['seq'][0], rm['seq'][1]; L = math.dist(a_, b_)
        if L < 1: return
        dd = ((a_[0] - b_[0]) / L, (a_[1] - b_[1]) / L); s_ = min(6, L * 0.6)
        out.append([[], _tipo(rm['r']), 0, [int(round((a_[0] - dd[0] * s_) * 100)), int(round((a_[1] - dd[1] * s_) * 100)), round(dd[0], 3), round(dd[1], 3), 1]]); cnt['ingressi: solo il cartello'] += 1

    def arco(cl, rl, a0, a1, C=None, rfun=None):
        """i punti del bordo da a0 ad a1 (radianti, a1 > a0), ogni 0,4 m circa: sul cerchio (cl, rl) (raggi da C se c'e') o r = rfun(angolo) da C"""
        dm = RB_MARGINE / max(rl, 1)
        tt = np.linspace(a0 + dm, a1 - dm, max(3, int(rl * (a1 - a0) / 0.4) + 1)); P = []
        for a_ in tt:
            u = np.array([math.cos(a_), math.sin(a_)])
            if rfun is not None: P.append(np.asarray(C) + u * rfun(a_))
            elif C is None: P.append(np.asarray(cl) + u * rl)
            else:
                t_ = _sul_cerchio(C, u, cl, rl)
                if t_ is not None: P.append(np.asarray(C) + u * t_)
        return P

    def con_osm(g, C, rami, motivo):
        """l'anello fuori dal DBGT: il gioco disegna le vie di OSM larghe w; il bordo esterno e' il cerchio dell'asse dell'anello piu' la sua mezza larghezza"""
        cnt[motivo] += 1
        P = np.array([nodes[n_] for n_ in sorted(g)]); cA, rA, sA = _cerchio(P)
        mh = [r_['mh'] for r_ in vie.values() if all(n_ in g for n_ in r_['refs'])]
        if len(P) < 5 or sA > 1.5 or not mh:
            for rm in rami:
                if rm['ent']: solo_cartello(rm, 'ingressi senza linea: anello di OSM non tondo')
            return
        R = rA + float(np.median(mh))
        for rm in rami:
            if not rm['ent']: continue
            ang = None
            for a_, b_ in zip(rm['seq'], rm['seq'][1:]):
                ra, rb = math.dist(a_, cA), math.dist(b_, cA)
                if ra <= R <= rb:
                    f = (R - ra) / ((rb - ra) or 1); ang = math.atan2(a_[1] + (b_[1] - a_[1]) * f - cA[1], a_[0] + (b_[0] - a_[0]) * f - cA[0]); break
            if ang is None: solo_cartello(rm, 'ingressi senza linea: il ramo non esce dall\'anello'); continue
            al = rm['r']['mh'] / R
            lin = arco(cA, R, ang - al, ang if rm['usc'] else ang + al)
            if len(lin) < 3 or math.dist(lin[0], lin[-1]) < 1.5: solo_cartello(rm, 'ingressi senza linea: corsia stretta'); continue
            cnt['ingressi'] += 1; cnt['linea fino a: ' + ('mezzeria (OSM)' if rm['usc'] else 'cordolo (OSM)')] += 1
            emetti(lin, rm, cA, R, None)

    for g in gruppi.values():
        pts = np.array([nodes[n_] for n_ in sorted(g)]); C = pts.mean(0)   # in ordine: la stessa somma a ogni build
        if not inside(tuple(C), 0): continue
        r_ax = float(np.median(np.hypot(*(pts - C).T)))
        rami = []   # i rami: vie per auto (non dell'anello) con un nodo sull'anello
        for r_ in vie.values():
            if all(n_ in g for n_ in r_['refs']): continue
            for i, n_ in enumerate(r_['refs']):
                if n_ not in g: continue
                for passo in (-1, 1):
                    if not (0 <= i + passo < len(r_['refs'])) or r_['refs'][i + passo] in g: continue
                    ent = (not r_['o']) or passo == -1; usc = (not r_['o']) or passo == 1
                    seq = [nodes[r_['refs'][j]] for j in (range(i, -1, -1) if passo == -1 else range(i, len(r_['refs'])))]
                    rami.append(dict(r=r_, ent=ent, usc=usc, seq=seq))
        if not rami: continue
        cnt['rotonde'] += 1
        if U is None or not U.intersects(Point(*C).buffer(r_ax + 2)): con_osm(g, C, rami, 'rotonde fuori dal DBGT'); continue
        clip = U.intersection(box(C[0] - r_ax - 45, C[1] - r_ax - 45, C[0] + r_ax + 45, C[1] + r_ax + 45))
        if clip.is_empty: con_osm(g, C, rami, 'rotonde fuori dal DBGT'); continue
        bd = clip.boundary
        iso = unary_union([isole[j] for j in it.query(box(C[0] - r_ax - 45, C[1] - r_ax - 45, C[0] + r_ax + 45, C[1] + r_ax + 45))]) if it is not None else None
        th = np.radians(np.arange(0, 360, RB_PASSO)); UU = np.c_[np.cos(th), np.sin(th)]; n = len(th)
        rmax = r_ax + 40
        rays = shapely.linestrings([[(C[0], C[1]), (C[0] + u[0] * rmax, C[1] + u[1] * rmax)] for u in UU])
        hit = shapely.intersection(rays, bd)

        def primi(dopo):
            o_ = np.full(n, np.inf)
            for k, h in enumerate(hit):
                if h.is_empty: continue
                ds = [math.dist(C, c_) for g_ in getattr(h, 'geoms', [h]) for c_ in (g_.coords if g_.geom_type == 'Point' else g_.coords[:1])]
                ds = [x for x in ds if x > dopo[k] + 0.05]
                if ds: o_[k] = min(ds)
            return o_
        if clip.contains(Point(*C)): r_in = np.zeros(n); cnt['rotonde con il centro sulla carreggiata (minirotonde senza isola)'] += 1
        else: r_in = primi(np.full(n, -1.0))   # il bordo interno dell'anello: il buco della carreggiata attorno all'isola
        r_in = np.where(np.isfinite(r_in), r_in, 0.0)
        r_out = primi(r_in)
        fin = np.isfinite(r_out); W = r_out - r_in
        if fin.sum() < 40: con_osm(g, C, rami, 'rotonde con l\'anello non trovato nel DBGT'); continue
        W0 = float(np.median(W[fin]))
        ok0 = fin & (W < W0 + RB_APERTURA)
        if W0 < 2.0 or W0 > 15 or ok0.sum() < 40: con_osm(g, C, rami, 'rotonde con l\'anello non trovato nel DBGT'); continue
        Pe = C + UU * np.where(fin, r_out, 0)[:, None]
        cg, rg, sg = _cerchio(Pe[ok0])
        rc = np.array([_sul_cerchio(C, u, cg, rg) or 0 for u in UU])
        gap = ~(fin & (r_out < rc + RB_APERTURA))
        if gap.all() or not gap.any(): con_osm(g, C, rami, 'rotonde con l\'anello non trovato nel DBGT'); continue
        # il raggio fermato da un'isola spartitraffico (MAN_TR)
        isl_hit = np.zeros(n, bool)
        if iso is not None and not iso.is_empty:
            q_ = C + UU * (np.where(fin, r_out, 0) + 0.3)[:, None]; isl_hit = fin & shapely.contains_xy(iso, q_[:, 0], q_[:, 1])
        k0 = int(np.argmin(gap)); aperture = []; k = 0   # le aperture: raggi consecutivi in gap (giro chiuso), da un raggio sul bordo
        while k < n:
            if gap[(k0 + k) % n]:
                s = k
                while k < n and gap[(k0 + k) % n]: k += 1
                aperture.append([(k0 + j) % n for j in range(s, k)])
            else: k += 1
        for rm in rami:   # dove ogni ramo passa il bordo (il cerchio)
            seq = rm['seq']; ang = None
            for a_, b_ in zip(seq, seq[1:]):
                ra, rb = math.dist(a_, cg), math.dist(b_, cg)
                if ra <= rg <= rb:
                    f = (rg - ra) / ((rb - ra) or 1); ang = math.atan2(a_[1] + (b_[1] - a_[1]) * f - C[1], a_[0] + (b_[0] - a_[0]) * f - C[0]); break
            if ang is None and math.dist(seq[0], cg) > rg: ang = math.atan2(seq[0][1] - C[1], seq[0][0] - C[0])
            rm['k'] = int(round(math.degrees(ang) % 360 / RB_PASSO)) % n if ang is not None else None
        dk_ = lambda a, b: min(abs(a - b), n - abs(a - b))
        for ap in aperture:
            if len(ap) < 4: continue
            # dentro l'apertura i raggi fermati presto (un cordolo fra due rami) o da un'isola spartitraffico la dividono in passaggi
            ferm = [bool(fin[k_] and (r_out[k_] - rc[k_] < RB_FERMO or (isl_hit[k_] and r_out[k_] - rc[k_] < 20))) for k_ in ap]
            if all(ferm): continue   # un'insenatura, non un ramo
            passaggi = []; j = 0
            while j < len(ap):
                if not ferm[j]:
                    s = j
                    while j < len(ap) and not ferm[j]: j += 1
                    passaggi.append([s, j - 1])
                else: j += 1
            passaggi[0][0] = 0; passaggi[-1][1] = len(ap) - 1   # i raccordi ai due capi stanno nei passaggi di testa
            m_ = len(passaggi)
            pos_ = {}   # dove passa ogni ramo: nel passaggio i (2 i) o nel tratto fermato fra i e i + 1 (2 i + 1)
            for q_, rm in enumerate(rami):
                if rm['k'] is None or min(dk_(rm['k'], k_) for k_ in ap) > 2: continue
                ia = min(range(len(ap)), key=lambda i_: dk_(ap[i_], rm['k'])); sl_ = 0
                for pi_, (s, e) in enumerate(passaggi):
                    if s <= ia <= e: sl_ = 2 * pi_
                    elif pi_ < m_ - 1 and e < ia < passaggi[pi_ + 1][0]: sl_ = 2 * pi_ + 1
                pos_[q_] = (sl_, ia)
            if not pos_: cnt['aperture senza via'] += 1; continue
            occ = collections.Counter(v[0] for v in pos_.values() if v[0] % 2 == 0)
            ingressi = {}   # passaggio -> (ramo, indice dove la linea si ferma o None per tutto il passaggio, fine)
            for q_, (sl_, ia) in sorted(pos_.items(), key=lambda kv: kv[1]):
                rm = rami[q_]
                if not rm['ent']: continue
                pi_ = sl_ // 2
                if not rm['usc'] and sl_ % 2:   # a senso unico verso l'anello ma sopra un tratto fermato: il passaggio piu' vicino
                    pi_ = pi_ if ia - passaggi[pi_][1] <= passaggi[pi_ + 1][0] - ia else pi_ + 1; sl_ = 2 * pi_
                if not rm['usc']:   # a senso unico verso l'anello: tutto il suo passaggio, o fino a meta' strada dall'uscita a senso unico che ci sta accanto
                    usc_ = [ia2 for q2, (sl2, ia2) in pos_.items() if sl2 == sl_ and rami[q2]['usc'] and not rami[q2]['ent'] and ia2 > ia]
                    if usc_: ingressi.setdefault(pi_, (rm, (ia + min(usc_)) // 2, 'mezzeria'))
                    else: ingressi.setdefault(pi_, (rm, None, 'isola' if pi_ < m_ - 1 else 'cordolo'))
                elif sl_ % 2: ingressi.setdefault(pi_, (rm, None, 'isola'))   # a doppio senso sopra l'isola: l'ingresso e' il passaggio prima
                elif occ[sl_] == 1 and pi_ > 0 and occ[sl_ - 2] == 0: ingressi.setdefault(pi_ - 1, (rm, None, 'isola'))   # l'isola divide il suo passaggio da quello prima, vuoto
                elif occ[sl_] == 1 and pi_ < m_ - 1 and occ[sl_ + 2] == 0: ingressi.setdefault(pi_, (rm, None, 'isola'))
                else: ingressi.setdefault(pi_, (rm, ia, 'mezzeria'))
            for pi_, (rm, fino, fine) in sorted(ingressi.items()):
                s, e = passaggi[pi_]
                if fino is not None: e = int(min(max(fino, s + round((e - s) * 0.25)), s + round((e - s) * 0.75)))   # la mezzeria: fra un quarto e tre quarti del passaggio
                if e - s < 2: solo_cartello(rm, 'ingressi senza linea: corsia stretta'); continue
                cnt['ingressi'] += 1; cnt['linea fino a: ' + fine] += 1
                # il bordo qui: il cerchio sui punti veri del bordo da 3 a 15 gradi fuori dai due capi dell'apertura (non in un'apertura ne' a 3 gradi da una): la
                # linea continua il bordo che c'e' ai due lati; con meno di 10 punti, quelli entro 50 gradi. Un bordo che non sta su un cerchio (scarto oltre
                # 0,3 m: un anello schiacciato) non ha la linea
                w3 = int(3 / RB_PASSO); libero = lambda k_: fin[k_] and not any(gap[(k_ + d2) % n] for d2 in range(-w3, w3 + 1))
                vic = [Pe[(ap[0] - d_) % n] for d_ in range(w3, 5 * w3 + 1) if libero((ap[0] - d_) % n)] + [Pe[(ap[-1] + d_) % n] for d_ in range(w3, 5 * w3 + 1) if libero((ap[-1] + d_) % n)]
                if len(vic) < 10:
                    kc = ap[(s + e) // 2]; vic = [Pe[(kc + dk) % n] for dk in range(-int(50 / RB_PASSO), int(50 / RB_PASSO) + 1) if libero((kc + dk) % n)]
                cl, rl, sl = _cerchio(vic) if len(vic) >= 10 else (cg, rg, sg)
                if len(vic) < 10 or abs(rl - rg) > 0.5 * rg: cl, rl, sl = cg, rg, sg
                if sl > 0.3: solo_cartello(rm, 'ingressi senza linea: il bordo non sta su un cerchio'); continue
                a0 = th[ap[s]] - math.radians(RB_PASSO) / 2; a1 = th[ap[e]] + math.radians(RB_PASSO) / 2
                if a1 < a0: a1 += 2 * math.pi
                rfun = None
                lin = arco(cl, rl, a0, a1, C, rfun)
                if len(lin) < 3 or math.dist(lin[0], lin[-1]) < 1.5: solo_cartello(rm, 'ingressi senza linea: corsia stretta'); continue
                inc = float(np.mean(shapely.contains_xy(clip, np.array(lin)[:, 0], np.array(lin)[:, 1])))
                if inc < 0.95: solo_cartello(rm, 'ingressi senza linea: uscirebbe dalla carreggiata'); continue
                if misure is not None:   # quanto la linea continua il bordo vero: i punti veri del bordo da 3 a 15 gradi fuori dall'apertura, dalla parte dove la linea arriva al capo
                    rl_at = lambda k_: (rfun(th[k_]) if rfun is not None else (_sul_cerchio(C, UU[k_], cl, rl) or 0))
                    de = []
                    for k_ in ([(ap[0] - d_) % n for d_ in range(w3, 5 * w3)] if s == 0 else []) + ([(ap[-1] + d_) % n for d_ in range(w3, 5 * w3)] if e == len(ap) - 1 else []):
                        if fin[k_] and not gap[k_]: de.append(abs(r_out[k_] - rl_at(k_)))
                    a_lo, a_hi = a0 % (2 * math.pi), a1 % (2 * math.pi)
                    sopra = [q2 for q2 in rami if q2['usc'] and not q2['ent'] and q2['k'] is not None and ((a0 < th[q2['k']] < a1) or (a0 < th[q2['k']] + 2 * math.pi < a1))]
                    misure.append(dict(x=float(C[0]), z=float(C[1]), d_capi=de, scarto=sl, fine=fine, sopra_uscita=len(sopra), interp=rfun is not None,
                                       in_carr=float(np.mean([clip.contains(Point(*q_)) for q_ in lin])), lin=[list(map(float, q_)) for q_ in lin]))
                emetti(lin, rm, cl, rl, clip)
    log('rotonde', len(out), dict(cnt))
    return out
