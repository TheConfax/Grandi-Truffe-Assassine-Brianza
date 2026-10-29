"""Mapillary dentro la build: cartelli veri, lampioni, semafori, pali e cestini da data/mapillary/oggetti.json (3 469 oggetti del riquadro).
Regole generali, uguali per ogni comune e per ogni settore della mappa grande: niente coordinate, niente nomi di luoghi.

  1. Il tipo: solo quello che Mapillary dice con una classe precisa (object_type 'trafficsign' per i cartelli, 'mvd_fast'/'panoptic' per
     gli oggetti) e per cui il gioco ha un modello. Tipo non capito o senza modello: l'oggetto non entra (niente cartelli inventati).
  2. La conferma: un oggetto di Mapillary e' un riconoscimento e il file non dice in quante foto e' stato visto (prima e ultima vista
     coincidono nel 90% dei casi). Entra se (a) ha una seconda vista (prima e ultima diverse), (b) e' di una foto recente (dal 2023),
     (c) il posto la conferma (stop, precedenza e rotatoria prima di un incrocio, indicazione di attraversamento vicino a uno di OSM),
     (d) un altro riconoscimento della stessa classe sta entro CONF_R_* (lo stesso oggetto visto da un altro passaggio) o, per lampioni e
     pali, c'e' un altro lampione/palo in fila entro 60-80 m (le file regolari non sono errori del riconoscitore), per i semafori ce ne sono
     altri entro 40 m o uno di OSM. I CARTELLI dal 29/10 (regola piu' larga, Carlo) entrano anche con un solo riconoscimento ('una_vista'): restano
     tutte le altre regole (tipo noto, via giusta, bordo, verso, niente doppioni con OSM, niente carreggiata, edifici, muri, lotti privati, alberi).
  3. L'aggancio: il cartello sta sulla via giusta (entro larghezza/2 + SNAP_MAX m dall'asse e con la direzione della via coerente con
     quella del cartello), sul bordo della carreggiata, a destra di chi guida nel verso a cui parla, salvo dove Mapillary lo mette
     chiaramente sull'altro bordo. Gli altri oggetti, se cadono in carreggiata, si portano fuori col suo bordo; dentro un edificio no.
  3b. Il posto e' pubblico e libero (Carlo, 29/10): un oggetto non sta in un lotto privato (dentro un cortile del DBGT, AC_VEI 0307, o oltre un
     muro, una recinzione o una siepe rispetto alla via piu' vicina, a piu' di PRIV_BORDO m dal bordo della carreggiata) ne' nella chioma o nel tronco di
     un albero (ALBERO_MIN, o 0.7 volte il raggio della chioma dove il DBGT la da'): un cartello scivola lungo la via fino a un posto libero, gli altri
     oggetti si scartano.
  4. I doppioni: con OSM (stesso tipo vicino) e fra riconoscimenti di Mapillary stesso: uno solo. Fra OSM e Mapillary in contrasto vince OSM.
Direzione: aligned_direction e' il verso in cui guarda la faccia del cartello; chi guida va nel verso opposto (verificato su 464 cartelli
vicini a una via: nel 79% di quelli lontani dall'asse il cartello sta a destra di chi guida cosi')."""
import json, math, os, collections
import shapely
from shapely.geometry import Point, LineString
from shapely.strtree import STRtree

# classe di Mapillary -> (tipo del gioco in segnali3.js, extra)
SEGNALI = {
    'regulatory--stop--g1': ('stop', None), 'regulatory--yield--g1': ('dare', None), 'regulatory--no-entry--g1': ('vietato', None),
    'regulatory--roundabout--g1': ('rotatoria', None), 'regulatory--keep-right--g1': ('destra', None),
    'regulatory--road-closed-to-vehicles--g3': ('transito', None), 'regulatory--one-way-right--g1': ('unico', None),
    'regulatory--one-way-left--g1': ('unico', 'sx'),
    'regulatory--no-parking--g1': ('sosta', None), 'regulatory--no-stopping--g1': ('fermata', None), 'regulatory--no-stopping--g3': ('fermata', None),
    'regulatory--go-straight--g1': ('dritto', None), 'regulatory--no-heavy-goods-vehicles--g1': ('pesanti', None),
    'information--pedestrians-crossing--g1': ('pedoni', None), 'information--parking--g1': ('parcheggio', None), 'information--parking--g5': ('parcheggio', None),
}
for _v in (20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120): SEGNALI['regulatory--maximum-speed-limit-%d--g1' % _v] = ('limite', _v)
# famiglie in contrasto: due cartelli della stessa famiglia vicini, orientati allo stesso modo e di tipo diverso: vince OSM
FAMIGLIE = {'stop': 'precedenza', 'dare': 'precedenza', 'limite': 'limite', 'vietato': 'accesso', 'unico': 'accesso', 'transito': 'accesso',
            'sosta': 'sosta', 'fermata': 'sosta', 'rotatoria': 'rotatoria', 'destra': 'obbligo', 'dritto': 'obbligo'}
LAMPIONE = ('object--street-light',)
SEMAFORO = ('object--traffic-light--general-upright', 'object--traffic-light--general-upright-front', 'object--traffic-light--general-upright-side',
            'object--traffic-light--general-single')
PALO = ('object--support--utility-pole',)
ALTRI = {'object--trash-can': 'cestino', 'object--bench': 'panchina', 'object--bike-rack': 'rastrelliera', 'object--fire-hydrant': 'idrante', 'object--mailbox': 'cassetta'}

RECENTE = '2023'      # l'ultima vista dal 2023 in poi vale come conferma
CONF_R_SEGNALE = 8.0  # un altro riconoscimento della stessa classe entro 8 m
CONF_R_OGGETTO = 3.0
FILA = (8.0, 60.0)    # un altro lampione fra 8 e 60 m
FILA_PALI = 80.0
SNAP_MAX = 8.0        # il cartello entro larghezza/2 + 8 m dall'asse della via
ALLINEA = 0.6         # |coseno| minimo fra la faccia del cartello e la via
PRIV_BORDO = 1.0       # un muro entro 1 m dal bordo della carreggiata e' il bordo del marciapiede, non un lotto privato
ALBERO_MIN = 0.9       # raggio minimo attorno a un tronco (m); senza chioma nota 1.2 m
DOPPIO_SEGNALE = 10.0 # un cartello di OSM dello stesso tipo entro 10 m (e verso simile) e' lo stesso
DOPPIO_OGGETTO = 4.0
DOPPIO_MLY = 12.0     # lo stesso cartello visto da piu' passaggi: stesso tipo, stesso verso, entro 12 m
SEPARA = 1.4          # due cartelli di Mapillary sullo stesso palo non si sovrappongono: il secondo scivola lungo la via
LONTANO_OGGETTO = 30.0
SPOSTI = (0, 1, -1, 2, -2, 3, -3, 4, -4, 6, -6)  # metri lungo la via per trovare un posto libero


def _carica(data_dir, proj, inside):
    f = os.path.join(data_dir, 'mapillary', 'oggetti.json')
    if not os.path.exists(f): return []
    out = []
    for o in json.load(open(f, encoding='utf-8')):
        x, z = proj(o['geometry']['coordinates'][1], o['geometry']['coordinates'][0])
        if not inside((x, z), 0): continue
        out.append(dict(id=o['id'], v=o['object_value'], t=o['object_type'], x=x, z=z, a=o.get('aligned_direction'), p=o['first_seen_at'], u=o['last_seen_at']))
    return out


def _conferma(o, vicini):
    if o['p'] != o['u']: return 'seconda_foto'
    if o['u'] >= RECENTE: return 'foto_recente'
    if vicini: return 'ripetuto'
    return None


def _vers(c):  # unit vector (dx, dz) of a compass bearing (north is -z)
    th = math.radians(c); return math.sin(th), -math.cos(th)


def elabora(data_dir, proj, inside, segs, segtree, STR, edifici, osm_segn, lamps, ogg, OGG, osm_semafori, incroci, attraversamenti, barriere, near_street, fuori, log=print, cortili=None, alberi=None):
    """segs, segtree: i tratti di via (LineString di due punti, r) come _segs di build_data.py; STR: dbgt_strade.Strade o None; edifici: i
    poligoni degli edifici; osm_segn: i cartelli di OSM del gioco (segnaletica.json); lamps [[x, z]]; ogg le righe 'og' gia' fatte;
    osm_semafori [(x, z)]; incroci [(ref, (x, z))] i nodi con 3 o piu' vie; attraversamenti [(x, z)] quelli di OSM; barriere [[(x, z), ...]] muri, recinzioni e siepi; cortili: i poligoni (shapely) dei cortili privati del DBGT; alberi: [(x, z[, altezza, chioma])]; near_street(p, face=) -> (angolo, via); fuori(p) -> (p, spostato).
    Restituisce dict(sm=[[tipo, x, z, dx, dz, extra]], lp=[[x, z]], og=[[kind, x, z, ang, extra]], sf=[ref dei semafori nuovi], rep=report)"""
    O = _carica(data_dir, proj, inside); rep = collections.OrderedDict(); rep['oggetti_nel_riquadro'] = len(O)
    if not O: return dict(sm=[], lp=[], og=[], sf=[], rep=rep)
    etree = STRtree(edifici) if edifici else None
    uc = None
    if STR is not None:
        uc = STR.U_carr; shapely.prepare(uc)
    def in_edificio(x, z, m=0.3):
        if etree is None: return False
        P = Point(x, z)
        return any(edifici[i].distance(P) <= m for i in etree.query(P.buffer(m)))
    bl = [LineString(b) for b in barriere if len(b) >= 2]; btree = STRtree(bl) if bl else None
    def su_barriera(x, z, m=0.45):  # sopra o a ridosso di un muro, una recinzione, una siepe
        if btree is None: return False
        P = Point(x, z)
        return any(bl[i].distance(P) < m for i in btree.query(P.buffer(m)))
    def in_carreggiata(x, z):
        P = Point(x, z)
        if uc is not None and STR.cover.contains(P): return bool(uc.contains(P))  # dentro il DBGT: la carreggiata vera
        for i in segtree.query(P.buffer(10)):
            L, r = segs[i]
            if r['c'] <= 5 and L.distance(P) < r['w'] / 2 + 0.2: return True
        return False
    def strade_vicine(x, z, R):
        P = Point(x, z); return [segs[i] for i in segtree.query(P.buffer(R))]
    cort = [g for g in (cortili or []) if g is not None and not g.is_empty]; ctree = STRtree(cort) if cort else None
    TA = [tuple(a) for a in (alberi or [])]; atree = STRtree([Point(a[0], a[1]) for a in TA]) if TA else None
    def in_albero(x, z):  # nel tronco o nella chioma (0.7 del raggio) di un albero
        if atree is None: return False
        P = Point(x, z)
        for i in atree.query(P.buffer(6)):
            a = TA[i]; r = max(ALBERO_MIN, 0.7 * a[3] / 2) if len(a) >= 4 and a[3] else 1.2
            if len(a) >= 3 and a[2] and a[2] < 2.0: r = 0.6  # un alberello: solo il tronco
            if math.hypot(a[0] - x, a[1] - z) < r: return True
        return False
    def privato(x, z):  # dentro un cortile privato, o dietro un muro/recinzione/siepe rispetto alla via piu' vicina
        P = Point(x, z)
        if ctree is not None and any(cort[i].contains(P) for i in ctree.query(P)): return True
        if btree is None: return False
        best = None
        for L, r in strade_vicine(x, z, 40):
            if r['c'] > 5 or r.get('tunnel'): continue
            d = L.distance(P)
            if best is None or d < best[0]: best = (d, L, r)
        if best is None: return False
        d, L, r = best; c = L.interpolate(L.project(P)); S = LineString([(c.x, c.y), (x, z)])
        if S.length < 0.3: return False
        for i in btree.query(S):
            X = bl[i].intersection(S)
            if X.is_empty: continue
            for pt in (X.geoms if hasattr(X, 'geoms') else [X]):
                if pt.geom_type == 'Point' and L.distance(pt) > r['w'] / 2 + PRIV_BORDO: return True
        return False

    # ------------------------------------------------------------- (a) cartelli
    sc = collections.Counter(); senza_modello = collections.Counter(); conf = collections.Counter()
    S = [o for o in O if o['t'] == 'trafficsign']
    rep['cartelli_nel_riquadro'] = len(S)
    classi = collections.defaultdict(list)
    for o in S: classi[o['v']].append(o)
    def contesto(o):
        # una sola vista, ma il posto la conferma: stop, precedenza e rotatoria stanno prima di un incrocio verso cui va chi guida (entro 25 m
        # davanti al cartello); l'attraversamento pedonale ha un attraversamento (OSM) entro 15 m
        k = SEGNALI[o['v']][0]; f = _vers(o['a']); d = (-f[0], -f[1])
        if k in ('stop', 'dare', 'rotatoria'):
            for ref, xy in incroci:
                ax, az = xy[0] - o['x'], xy[1] - o['z']; L_ = math.hypot(ax, az)
                if 3 < L_ < 25 and (ax * d[0] + az * d[1]) / L_ > 0.7: return 'contesto_incrocio'
        if k == 'pedoni' and any(math.hypot(a[0] - o['x'], a[1] - o['z']) < 15 for a in attraversamenti): return 'contesto_attraversamento'
        return None
    cand = []
    for o in S:
        if o['v'] not in SEGNALI: senza_modello[o['v']] += 1; sc['tipo senza modello'] += 1; continue
        if o['a'] is None: sc['senza direzione'] += 1; continue
        vic = [p for p in classi[o['v']] if p is not o and math.hypot(p['x'] - o['x'], p['z'] - o['z']) < CONF_R_SEGNALE]
        c = _conferma(o, vic) or contesto(o) or 'una_vista'  # dal 29/10 anche un solo riconoscimento (decisione di Carlo): contano le altre regole
        conf[c] += 1; o['k'], o['e'] = SEGNALI[o['v']]; o['c'] = c; cand.append(o)
    # doppioni fra riconoscimenti: stesso tipo (e stesso extra), entro 5 m e orientamento simile: uno, il piu' recente
    cand.sort(key=lambda o: o['u'], reverse=True); tenuti = []
    for o in cand:
        d = _vers(o['a'])
        if any(p['k'] == o['k'] and p['e'] == o['e'] and math.hypot(p['x'] - o['x'], p['z'] - o['z']) < DOPPIO_MLY and _vers(p['a'])[0] * d[0] + _vers(p['a'])[1] * d[1] > 0.5 for p in tenuti):
            sc['doppione di Mapillary'] += 1; continue
        tenuti.append(o)
    # OSM: cartelli del gioco [tipo, x, z, dx, dz, extra]; (dx, dz) = verso del traffico (0, 0: lungo la via piu' vicina)
    osm_t = STRtree([Point(s[1], s[2]) for s in osm_segn]) if osm_segn else None
    sm = []
    for o in tenuti:
        f = _vers(o['a']); d = (-f[0], -f[1])  # chi guida va nel verso opposto alla faccia
        best = None
        for L, r in strade_vicine(o['x'], o['z'], 25):
            if r['c'] > 5 or r.get('tunnel'): continue
            (ax, az), (bx, bz) = L.coords[0], L.coords[-1]; l = math.hypot(bx - ax, bz - az) or 1; t = ((bx - ax) / l, (bz - az) / l)
            al = abs(t[0] * d[0] + t[1] * d[1]); dist = L.distance(Point(o['x'], o['z']))
            if al < ALLINEA or dist > r['w'] / 2 + SNAP_MAX: continue
            sc_ = dist + (1 - al) * 6
            if best is None or sc_ < best[0]: best = (sc_, L, r, t)
        if best is None: sc['lontano da una via o di traverso'] += 1; continue
        _, L, r, t = best; hw = r['w'] / 2
        if t[0] * d[0] + t[1] * d[1] < 0: t = (-t[0], -t[1])
        dx, dz = t  # nel verso di chi guida, squadrato con la via
        rn = (-dz, dx); P0 = Point(o['x'], o['z']); c0 = L.interpolate(L.project(P0)); lat = (o['x'] - c0.x) * rn[0] + (o['z'] - c0.y) * rn[1]
        side = -1 if lat < -(hw + 1.0) else 1  # a destra, salvo dove e' chiaramente sull'altro bordo
        fam = FAMIGLIE.get(o['k']); skip = None
        if osm_t is not None:
            for i in osm_t.query(P0.buffer(DOPPIO_SEGNALE + 10)):
                s = osm_segn[i]; dd = math.hypot(s[1] - o['x'], s[2] - o['z'])
                stessa_dir = (not (s[3] or s[4])) or s[3] * dx + s[4] * dz > 0.3
                tipi = {s[0]} | ({'dare'} if s[0] == 'rotatoria' and len(s) > 5 and s[5] == 'dare' else set()) | ({'vietato', 'destra'} if s[0] == 'isola' else set())  # il cartello di OSM puo' portarne due
                uguale = o['k'] in tipi and (o['k'] != 'limite' or s[5] == o['e'])
                if uguale and dd < (DOPPIO_SEGNALE if s[0] != 'isola' else 14.0) and stessa_dir: skip = 'doppione di OSM'; break
                if fam and s[0] in FAMIGLIE and FAMIGLIE[s[0]] == fam and dd < 20 and stessa_dir and not uguale: skip = 'in contrasto con OSM (vince OSM)'; break
        if skip: sc[skip] += 1; continue
        # il posto: sul bordo, 0.9 m oltre, libero da altre vie e da edifici; se no, qualche metro piu' avanti o indietro
        ok = None; primo = None
        for sh in SPOSTI:
            qx, qz = c0.x + dx * sh, c0.y + dz * sh
            off = 0.5
            while off < hw + 6 and in_carreggiata(qx + side * rn[0] * off, qz + side * rn[1] * off): off += 0.25
            if off >= hw + 6: continue
            off += 0.9; px, pz = qx + side * rn[0] * off, qz + side * rn[1] * off
            if in_carreggiata(px, pz) or in_edificio(px, pz, 0.4) or su_barriera(px, pz) or not inside((px, pz), 0): continue
            if in_albero(px, pz): primo = primo or 'albero'; continue
            if privato(px, pz): primo = primo or 'privato'; continue
            if any(math.hypot(s_[1] - px, s_[2] - pz) < SEPARA for s_ in sm): continue
            if any(p_[0] == o['k'] and math.hypot(p_[1] - px, p_[2] - pz) < DOPPIO_SEGNALE and ((not (p_[3] or p_[4])) or p_[3] * dx + p_[4] * dz > 0.3) and (o['k'] != 'limite' or p_[5] == o['e']) for p_ in osm_segn): continue  # scivolando lungo la via non diventa il doppione di un cartello di OSM
            ok = (px, pz); break
        if ok is None: sc['nessun posto libero sul bordo' + (' (%s)' % primo if primo else '')] += 1; continue
        if primo: sc['spostato (era %s)' % ('dentro un albero' if primo == 'albero' else 'in un lotto privato')] += 1
        sm.append([o['k'], round(ok[0], 1), round(ok[1], 1), round(dx, 3), round(dz, 3)] + ([o['e']] if o['e'] is not None else []))
    rep['cartelli'] = dict(entrano=len(sm), per_tipo=dict(collections.Counter(s[0] for s in sm)), conferma=dict(conf), scartati=dict(sc),
                           senza_modello_prime=dict(senza_modello.most_common(12)), senza_modello_totale=sum(senza_modello.values()))
    dop = 0  # controllo: nessuno dello stesso tipo di un cartello di OSM a meno di 10 m con verso simile (deve essere 0)
    for s in sm:
        for p in osm_segn:
            if p[0] == s[0] and math.hypot(p[1] - s[1], p[2] - s[2]) < DOPPIO_SEGNALE and ((not (p[3] or p[4])) or p[3] * s[3] + p[4] * s[4] > 0.3) and (s[0] != 'limite' or p[5] == s[5]): dop += 1; break
    rep['cartelli']['doppioni_con_osm'] = dop
    rep['cartelli']['sulla_carreggiata'] = sum(1 for s in sm if in_carreggiata(s[1], s[2]))
    rep['cartelli']['dentro_un_edificio'] = sum(1 for s in sm if in_edificio(s[1], s[2], 0.0))
    rep['cartelli']['su_una_barriera'] = sum(1 for s in sm if su_barriera(s[1], s[2], 0.3))
    rep['cartelli']['in_lotto_privato'] = sum(1 for s in sm if privato(s[1], s[2])); rep['cartelli']['dentro_un_albero'] = sum(1 for s in sm if in_albero(s[1], s[2]))

    # ------------------------------------------------------------- (b) lampioni, semafori, pali, cestini
    def porta_fuori(o, sc_):
        """(x, z) fuori dalla carreggiata e dagli edifici, o None (il perche' in sc_)"""
        p = (o['x'], o['z'])
        if not strade_vicine(p[0], p[1], LONTANO_OGGETTO): sc_['lontano da una via (>%d m)' % LONTANO_OGGETTO] += 1; return None
        if in_carreggiata(*p):
            q2, mosso = fuori(p)
            if mosso: p = q2
        if in_carreggiata(*p): sc_['in carreggiata'] += 1; return None
        if in_edificio(*p, 0.3): sc_['dentro un edificio'] += 1; return None
        if su_barriera(*p, 0.3): sc_['su un muro o una recinzione'] += 1; return None
        if in_albero(*p): sc_['dentro un albero (tronco o chioma)'] += 1; return None
        if privato(*p): sc_['in un lotto privato (cortile o oltre un muro)'] += 1; return None
        if not inside(p, 0): return None
        return p
    def dedup(lista, R):  # un solo riconoscimento per posto (il piu' recente)
        keep = []
        for o in sorted(lista, key=lambda o: o['u'], reverse=True):
            if any(math.hypot(p['x'] - o['x'], p['z'] - o['z']) < R for p in keep): continue
            keep.append(o)
        return keep
    scl = collections.Counter(); lam = [o for o in O if o['v'] in LAMPIONE]; rep['lampioni_nel_riquadro'] = len(lam)
    lam_all = [(o['x'], o['z']) for o in lam] + [tuple(l) for l in lamps]; lt = STRtree([Point(*p) for p in lam_all])
    ok_l = []
    for o in lam:
        vic = [p for p in lam if p is not o and math.hypot(p['x'] - o['x'], p['z'] - o['z']) < CONF_R_OGGETTO]
        c = _conferma(o, vic)
        if c is None:
            P0 = Point(o['x'], o['z']); fila = any(FILA[0] <= math.hypot(lam_all[i][0] - o['x'], lam_all[i][1] - o['z']) <= FILA[1] for i in lt.query(P0.buffer(FILA[1])))
            c = 'in_fila' if fila else None
        if c is None: scl['non confermato (isolato, visto una volta)'] += 1; continue
        o['c'] = c; ok_l.append(o)
    lpn = []; conf_l = collections.Counter(o['c'] for o in ok_l); dd_ = dedup(ok_l, 3.0); scl['doppione di Mapillary'] = len(ok_l) - len(dd_)
    for o in dd_:
        if any(math.hypot(l[0] - o['x'], l[1] - o['z']) < DOPPIO_OGGETTO for l in lamps): scl['doppione di OSM'] += 1; continue
        p = porta_fuori(o, scl)
        if p is not None: lpn.append([round(p[0], 1), round(p[1], 1)])
    rep['lampioni'] = dict(entrano=len(lpn), conferma=dict(conf_l), scartati=dict(scl))
    # semafori: il nodo d'incrocio piu' vicino (entro 18 m) diventa un incrocio con semaforo, se OSM non ce l'ha gia'
    scs = collections.Counter(); sem = [o for o in O if o['v'] in SEMAFORO]; rep['semafori_nel_riquadro'] = len(sem)
    sf = []; nodi_ok = set()
    for o in sem:
        vic = [p for p in sem if p is not o and math.hypot(p['x'] - o['x'], p['z'] - o['z']) < 40]
        osm_v = [s for s in osm_semafori if math.hypot(s[0] - o['x'], s[1] - o['z']) < 40]
        c = _conferma(o, vic) or ('osm' if osm_v else None)
        if c is None: scs['non confermato (isolato)'] += 1; continue
        if osm_v: scs['gia in OSM (doppione)'] += 1; continue
        best = None
        for ref, xy in incroci:
            dd = math.hypot(xy[0] - o['x'], xy[1] - o['z'])
            if dd < 18 and (best is None or dd < best[0]): best = (dd, ref, xy)
        if best is None: scs['non vicino a un incrocio'] += 1; continue
        if best[1] in nodi_ok: scs['stesso incrocio di un altro riconoscimento'] += 1; continue
        nodi_ok.add(best[1]); sf.append(best[1])
    rep['semafori'] = dict(incroci_nuovi=len(sf), scartati=dict(scs))
    # altri oggetti: pali della luce/telefono, cestini, panchine, rastrelliere, idranti, cassette
    sco = collections.Counter(); og_new = []; per = collections.Counter(); ognuno = {}
    for o in O:
        if o['v'] in PALO: ognuno[id(o)] = 'palo'
        elif o['v'] in ALTRI: ognuno[id(o)] = ALTRI[o['v']]
    sco['pali generici (support--pole, senza tipo: sostegno di cartello, lampione o altro): non usati'] = sum(1 for o in O if o['v'] == 'object--support--pole')
    esist = collections.defaultdict(list)
    for r_ in ogg: esist[OGG[r_[0]]].append((r_[1] / 10, r_[2] / 10))
    for kind in sorted(set(ognuno.values())):
        gr = [o for o in O if ognuno.get(id(o)) == kind]
        for o in dedup(gr, CONF_R_OGGETTO):
            vic = [p for p in gr if p is not o and math.hypot(p['x'] - o['x'], p['z'] - o['z']) < CONF_R_OGGETTO]
            c = _conferma(o, vic)
            if c is None and kind == 'palo':  # i pali di una linea stanno in fila
                c = 'in_fila' if any(FILA[0] <= math.hypot(p['x'] - o['x'], p['z'] - o['z']) <= FILA_PALI for p in gr if p is not o) else None
            if c is None: sco['%s non confermato (isolato, visto una volta)' % kind] += 1; continue
            if any(math.hypot(e[0] - o['x'], e[1] - o['z']) < DOPPIO_OGGETTO for e in esist[kind]): sco['%s doppione di OSM' % kind] += 1; continue
            p = porta_fuori(o, sco)
            if p is None: continue
            ang, _ = near_street(p, face=kind in ('panchina', 'cassetta'))
            og_new.append([OGG.index(kind), int(round(p[0] * 10)), int(round(p[1] * 10)), round(ang, 2), 9.0 if kind == 'palo' else 0]); per[kind] += 1
    rep['altri_oggetti'] = dict(entrano=len(og_new), per_tipo=dict(per), scartati=dict(sco))
    rep['lampioni']['sulla_carreggiata'] = sum(1 for p in lpn if in_carreggiata(*p))
    rep['lampioni']['in_lotto_privato_o_albero'] = sum(1 for p in lpn if privato(*p) or in_albero(*p)); rep['altri_oggetti']['in_lotto_privato_o_albero'] = sum(1 for r_ in og_new if privato(r_[1] / 10, r_[2] / 10) or in_albero(r_[1] / 10, r_[2] / 10))
    rep['altri_oggetti']['sulla_carreggiata'] = sum(1 for r_ in og_new if in_carreggiata(r_[1] / 10, r_[2] / 10))
    rep['altri_oggetti']['su_una_barriera'] = sum(1 for r_ in og_new if su_barriera(r_[1] / 10, r_[2] / 10, 0.3)); rep['lampioni']['su_una_barriera'] = sum(1 for p in lpn if su_barriera(p[0], p[1], 0.3))
    log('MAPILLARY cartelli', rep['cartelli']['entrano'], rep['cartelli']['per_tipo'], 'scartati', rep['cartelli']['scartati'], 'doppioni con OSM', dop, 'in carreggiata', rep['cartelli']['sulla_carreggiata'])
    log('MAPILLARY lampioni', len(lpn), dict(scl), 'semafori nuovi', len(sf), dict(scs), 'altri', dict(per), dict(sco))
    return dict(sm=sm, lp=lpn, og=og_new, sf=sf, rep=rep)
