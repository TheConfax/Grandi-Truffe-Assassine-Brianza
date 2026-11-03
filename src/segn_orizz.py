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
        kind = {'stop': 0, 'dare': 1}.get(e[0]) if e[0] != 'rotatoria' else (1 if len(e) > 5 and e[5] == 'dare' else None)
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
  art. 151 c.2: zona di 12 m + centrale + 12 m; la centrale lunga quanto il veicolo piu' lungo che ferma + 2 m: qui 12 m (autobus urbano) + 2 = 14 m, in tutto 38 m
      (la lunghezza del veicolo non e' in OSM: e' l'unico dato assunto, il bus urbano standard di 12 m)
  art. 151 c.4: scritta BUS gialla (art. 148 c.4) dentro la zona, leggibile da chi arriva; altezza 1,60 m come le lettere della fig. II.441/b; larghezza 2,40 m
      e posto a un terzo della zona dall'ingresso (fig. II.447 su Commons): misure dalla foto di riferimento di Carlo (BUS largo quanto la zona di 2,70 m)
  modulo della discontinua: non e' scritto nel regolamento per la fermata; dalla foto di riferimento di Carlo: tratto circa 1,0 m, intervallo circa 1,5 m (la
      stessa proporzione della striscia di guida alle intersezioni, art. 138 c.3 tipo g: 1,0 m / 1,5 m)
  zig zag (fig. II.447): non disegnato (facoltativo, art. 151 c.3; Carlo: da citta' popolosa)
Riga: [dash, kerb, [bx, bz, ux, uz]]: dash, kerb: x, z in dm lungo la zona (un punto ogni 2 m: la striscia discontinua e il bordo di fronte a lei); la scritta BUS in (bx, bz) dm,
con il verso di marcia (ux, uz)."""
FB_PRIMA, FB_CENTRO, FB_ULT = 12.0, 14.0, 12.0
FB_DIST = 2.70
FB_LUNG = FB_PRIMA + FB_CENTRO + FB_ULT


def fermate(nodes, ntags, car_nodes, STR, inside, log):
    R = STR.R if STR is not None else None; CV = STR.CV if STR is not None else None
    cnt = collections.Counter(); out = []
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
    def ray(P, N): return float(R.ray(CV, np.array([P], float), np.array([N], float), 25.0)[0])
    def dentro(p): return R is not None and bool(R.at(CV, [p[0]], [p[1]])[0])
    fatte = []
    for nid, t in ntags.items():
        if nid not in nodes or not inside(nodes[nid], 0): continue
        if not (t.get('highway') == 'bus_stop' or (t.get('public_transport') == 'platform' and t.get('bus') == 'yes')): continue
        p = nodes[nid]; best = None
        for gx in (int(p[0] // 30) - 1, int(p[0] // 30), int(p[0] // 30) + 1):
            for gz in (int(p[1] // 30) - 1, int(p[1] // 30), int(p[1] // 30) + 1):
                for r_, k in grid.get((gx, gz), ()):
                    a, b = nodes[r_['refs'][k]], nodes[r_['refs'][k + 1]]; ex, ez = b[0] - a[0], b[1] - a[1]; L2 = ex * ex + ez * ez or 1.0
                    u = min(max(((p[0] - a[0]) * ex + (p[1] - a[1]) * ez) / L2, 0), 1); d = math.hypot(p[0] - a[0] - ex * u, p[1] - a[1] - ez * u)
                    if d <= 14 and (best is None or d < best[0]): best = (d, r_, k, u)
        if best is None: cnt['saltata: nessuna via'] += 1; continue
        _, r_, k, u = best; refs = r_['refs']
        a, b = nodes[refs[k]], nodes[refs[k + 1]]; ex, ez = b[0] - a[0], b[1] - a[1]; L = math.hypot(ex, ez) or 1.0
        side = (p[0] - a[0]) * (-ez / L) + (p[1] - a[1]) * (ex / L)   # > 0: a destra del verso della via
        fwd = side >= 0
        if r_['o'] and not fwd: cnt['saltata: a sinistra di una via a senso unico'] += 1; continue
        seq = list(range(len(refs))) if fwd else list(range(len(refs) - 1, -1, -1))
        pts = [nodes[refs[i]] for i in seq]; cum = [0.0]
        for q0, q1 in zip(pts, pts[1:]): cum.append(cum[-1] + math.dist(q0, q1))
        kk = (k if fwd else len(refs) - 2 - k); sc = cum[kk] + (u if fwd else 1 - u) * (cum[kk + 1] - cum[kk])   # la fermata lungo la via nel verso di marcia
        s0 = sc - FB_LUNG / 2
        if s0 < 0 or s0 + FB_LUNG > cum[-1]: cnt['saltata: via troppo corta per la zona'] += 1; continue
        if any(s0 < cum[j] < s0 + FB_LUNG and deg(refs[seq[j]]) >= 3 for j in range(1, len(pts) - 1)): cnt['saltata: un incrocio dentro la zona'] += 1; continue
        def at(s):
            j = 1
            while j < len(pts) - 1 and cum[j] < s: j += 1
            Lk = cum[j] - cum[j - 1] or 1.0; f = min(max((s - cum[j - 1]) / Lk, 0.0), 1.0)
            A, B = pts[j - 1], pts[j]; return (A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f), ((B[0] - A[0]) / Lk, (B[1] - A[1]) / Lk)
        n_s = int(round(FB_LUNG / 2.0)); dash = []; kerb = []; dr_min = 99
        for i in range(n_s + 1):
            P, d = at(s0 + FB_LUNG * i / n_s); nrm = (-d[1], d[0])
            if dentro(P):
                dr = ray(P, nrm); lim = r_['w'] / 2 + 3
                dr = dr if dr < lim else r_['w'] / 2
            else: dr = r_['mh']   # fuori dal DBGT la larghezza di OSM, come il gioco la disegna
            dr_min = min(dr_min, dr)
            dash.append((P[0] + nrm[0] * (dr - FB_DIST), P[1] + nrm[1] * (dr - FB_DIST))); kerb.append((P[0] + nrm[0] * dr, P[1] + nrm[1] * dr))
        if dr_min < FB_DIST + 0.3: cnt['saltata: carreggiata stretta (meno di 3 m dall\'asse al bordo)'] += 1; continue
        i_b = int(round(n_s / 3.0)); (Pb, db) = at(s0 + FB_LUNG / 3.0)   # la scritta a un terzo della zona dall'ingresso, a meta' fra la striscia e il bordo
        mid = ((dash[i_b][0] + kerb[i_b][0]) / 2, (dash[i_b][1] + kerb[i_b][1]) / 2)
        if any(math.dist(mid, m_) < 12 for m_ in fatte): cnt['saltata: doppione'] += 1; continue
        fatte.append(mid)
        f = lambda L_: [int(round(v * 10)) for q_ in L_ for v in q_]
        out.append([f(dash), f(kerb), [int(round(mid[0] * 10)), int(round(mid[1] * 10)), round(db[0], 3), round(db[1], 3)]]); cnt['fermate'] += 1
    log('fermate del bus', len(out), dict(cnt))
    return out
