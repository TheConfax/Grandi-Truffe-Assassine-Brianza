"""Guardrail e spartitraffico delle superstrade (Carlo 5/11, la Milano-Meda: "fatti molto male"). Un passaggio dedicato, come la recinzione
della ferrovia: le barriere di una superstrada (motorway, trunk e le loro rampe, roads[].x) dove c'è il DBGT si fanno qui, continue, e il gioco
non mette più i suoi pezzi di guardrail lungo quelle strade (world3.js roadBarriers, roads[].gp).
Com'è la Milano-Meda (Mapillary 2023, x -706 z 108, x 140 z 1308, x -23 z 700, x 321 z 1893): in mezzo un new jersey di cemento, ai lati un
guardrail su paletti, continuo, aperto solo dove una strada entra o esce.
  - la carreggiata della superstrada: i pezzi AC_VEI del DBGT che le sue vie (OSM, sulle linee EL_STR) attraversano più delle altre vie
  - lo spartitraffico: i MAN_TR del DBGT circondati per la maggior parte da quella carreggiata. Fino a NJ_MAX m di larghezza ha un new jersey
    sulla sua linea di mezzo e fa parte della carreggiata per i guardrail; più largo resta fuori e i guardrail corrono lungo i suoi bordi
  - i guardrail: il bordo della carreggiata (con gli spartitraffico stretti, le fessure sotto 2 * CHIUDI chiuse: la punta di una rampa dipinta
    non ha guardrail) allargato di OFF m. Si aprono solo dove serve: a meno di APRI m da un'altra carreggiata (un incrocio, una strada che
    entra), dalla via di un'altra strada che li attraversa, sui ponti (lì ci sono i parapetti dell'impalcato). I pezzi sotto CORTO m no
  - le righe si lisciano su LISCIA m senza avvicinarsi alla carreggiata
Esce: linee [dict(k=1 guardrail | 2 new jersey, p=[(x, z)...], r=[indici delle vie della superstrada lungo cui corre: il gioco ne prende la
quota])], le vie fatte qui (roads[].gp) e il rapporto con il controllo: punti di guardrail o new jersey dentro una carreggiata (deve essere 0)."""
import math
from collections import Counter
import numpy as np, shapely, shapely.ops
from shapely.geometry import LineString, Point, Polygon
from shapely.ops import unary_union
from shapely.strtree import STRtree
from scipy.ndimage import gaussian_filter1d

OFF = 0.6        # la faccia del guardrail dal bordo della carreggiata (m)
CHIUDI = 1.5     # carreggiate e spartitraffico più vicini di 2 * CHIUDI sono una cosa sola: nessun guardrail fra loro
APRI = 1.0       # il guardrail si apre a meno di tanto da un'altra carreggiata, e da w/2 + tanto dalla via di un'altra strada
CORTO = 8.0      # pezzi più corti si tolgono (m)
NJ_MAX = 6.0     # uno spartitraffico fino a tanto largo ha il new jersey nel mezzo (m)
NJ_MIN_L = 20.0  # e almeno tanto lungo
LISCIA = 2.0     # sigma della lisciatura delle linee (m)
DENTRO = 0.35    # una linea lisciata non va più vicina di tanto alla carreggiata (m)
DIV_D = 1.5      # un divisorio del DBGT tanto vicino a un guardrail o a un new jersey e parallelo è quel guardrail (sostituito)
PASSO = 0.5
LONTANO = 2.0    # un guardrail sta al più a tanto dal bordo della carreggiata della superstrada (m)
QUOTA = 2.0      # un'altra strada più alta o più bassa di tanto della superstrada le passa sopra o sotto (m)
CARR_NO = ('0307', '0301')   # cortili e parcheggi non sono carreggiate di una superstrada


def _parts(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g]
    return [p for p in getattr(g, 'geoms', []) if p.geom_type == 'Polygon' and not p.is_empty]


def _lines(g):
    if g is None or g.is_empty: return []
    if g.geom_type == 'LineString': return [g]
    out = []
    for p in getattr(g, 'geoms', []): out += _lines(p)
    return out


def _resample(xy, step):
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
    if d[-1] < step: return xy[[0, -1]]
    s = np.linspace(0, d[-1], int(round(d[-1] / step)) + 1)
    return np.column_stack((np.interp(s, d, xy[:, 0]), np.interp(s, d, xy[:, 1])))


# (Carlo 6/11, corso Isonzo: "guardrail storto accanto al parapetto invece di continuarlo") a guardrail that ends by a bridge goes on to the end of the parapet of
# the deck: its last RACCORDO m are a straight line to the nearest corner of the PONTE (the deck outline the parapets follow, terreno/indice.json nucleo)
RACCORDO = 4.0
def _angoli_parapetti():
    import os, json
    f = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'terreno', 'indice.json')
    if not os.path.exists(f): return None
    ind = json.load(open(f, encoding='utf-8')); base = 0.0; V = []
    for d in ind.get('decks', []):
        if d.get('tipo') not in ('strada', 'ferro') or not d.get('nucleo'): continue
        T = np.asarray(d['tri'], float).reshape(-1, 3)
        for q in d['nucleo']: V.append((q[0], q[1], T[np.argmin(np.hypot(T[:, 0] - q[0], T[:, 1] - q[1])), 2]))   # (x, z, the top of the deck there, m)
    return np.asarray(V, float) if V else None


def _al_parapetto(P, V, quota=None):
    if V is None or len(P) < 3: return P
    for fine in (True, False):
        Q = P[::-1] if fine else P; e = Q[0]; d = np.hypot(*(V[:, :2] - e).T); j = int(np.argmin(d))
        if d[j] > RACCORDO: continue
        if quota is not None:   # only a deck at the level of the road the guardrail runs along (not an overpass over it)
            q_ = quota(Point(*e))
            if q_ is not None and abs(q_ - V[j, 2]) > 1.5: continue   # (no heights of the ways here: the corner nearest the end of the guardrail)
        s = np.concatenate(([0], np.cumsum(np.hypot(*np.diff(Q, axis=0).T)))); k = int(np.searchsorted(s, RACCORDO))
        if k >= len(Q) - 1: continue
        v = V[j, :2]; Q = np.vstack((v[None], np.linspace(v, Q[k], max(2, int(np.ceil(s[k]))))[1:-1], Q[k:]))
        P = Q[::-1] if fine else Q; _al_parapetto.n += 1
    return P
_al_parapetto.n = 0


def guardrail(D, cover, U_carr, raw_roads, nodes, zh=None, log=print, innesti=True):
    """zh: la quota delle vie nodo per nodo (dal DBGT, build_data.py): un'altra strada a più di QUOTA m dalla superstrada passa sopra o sotto e non apre"""
    rep = Counter()
    xy = lambda r: np.array([nodes[n_] for n_ in r['refs']], float)
    lin = {ri: LineString(xy(r)) for ri, r in enumerate(raw_roads) if len(r['refs']) >= 2 and r['c'] <= 5}
    X = [ri for ri in lin if raw_roads[ri].get('x') and not raw_roads[ri]['tunnel']]
    if not X: return [], set(), {}, (None, [], None)
    sotto = lambda r: r['tunnel'] or r.get('under')
    # una via a un'altra quota: in galleria sotto; sopra un pezzo a raso, un'altra strada su un ponte; sotto un pezzo su un ponte, un'altra
    # strada non su un ponte. Su un pezzo a raso le vie della superstrada contano sempre (OSM fa ponte anche il tratto sopra una galleria che il
    # DBGT ha a raso); su un pezzo su un ponte solo quelle su un ponte (sotto un cavalcavia la superstrada passa sotto)
    altra_quota = lambda r, br: sotto(r) or (bool(r['bridge']) != br if (br or not r.get('x')) else False)
    # le quote: lungo ogni via, dai nodi che il DBGT ha (zh); la superstrada accanto a un punto: la sua via più vicina
    zh = zh or {}; prof = {}
    for ri, L in lin.items():
        r = raw_roads[ri]; h = np.array([zh.get(n_, np.nan) for n_ in r['refs']], float)
        if np.isfinite(h).sum() >= 1: prof[ri] = (np.r_[0, np.cumsum(np.hypot(*np.diff(xy(r), axis=0).T))], h)
    def quota(ri, pt):
        if ri not in prof: return None
        d, h = prof[ri]; ok = np.isfinite(h); return float(np.interp(lin[ri].project(pt), d[ok], h[ok]))
    XT0 = STRtree([lin[ri] for ri in X])
    def quota_x(pt, R=25):
        j = XT0.query(pt.buffer(R))
        if not len(j): return None
        return quota(min((X[k] for k in j), key=lambda ri: lin[ri].distance(pt)), pt)
    stessa = lambda a, b: a is None or b is None or abs(a - b) <= QUOTA
    # 1. la carreggiata della superstrada: ogni pezzo AC_VEI va alla superstrada se le sue vie lo attraversano più delle altre (alla stessa
    # quota: su un ponte contano le vie sul ponte, a raso quelle a raso; le vie in galleria sotto non contano)
    vei = [(g, a) for g, a in D['vei'] if a['zon'] not in CARR_NO and a.get('sed') not in ('03', '04') and not g.is_empty and g.intersects(cover)]   # (in galleria: sotto)
    on_br = lambda a: a.get('sed') == '02'
    TL = STRtree([lin[ri] for ri in lin]); RL = list(lin)
    isx, lx_ = [], []
    PB2 = unary_union([g for g, a in vei if on_br(a)]).buffer(0.5)
    PB2 = None if PB2.is_empty else PB2
    if PB2 is not None: shapely.prepare(PB2)
    for g, a in vei:
        br = on_br(a); lx = lo = ls = 0.0
        for j in TL.query(g):
            r = raw_roads[RL[j]]
            if altra_quota(r, br): continue
            c_ = lin[RL[j]].intersection(g); L = c_.length
            if L <= 0: continue
            if r.get('x'):
                if not br and PB2 is not None: L = c_.difference(PB2).length   # la parte della superstrada su un ponte del DBGT passa sopra un pezzo a raso (corso Isonzo, x 395 z 2018: OSM non la fa ponte)
                lx += L
            else:
                if r['c'] >= 4: ls += L   # una via di servizio non divide la carreggiata con una superstrada: conta solo se non c'è lei
                else: lo += L
        if lx == 0: lo += ls
        if lx == 0 and lo == 0:   # nessuna via dentro: la via più vicina alla stessa quota
            c = g.representative_point(); best = None
            for j in TL.query(c.buffer(10)):
                r = raw_roads[RL[j]]
                if altra_quota(r, br): continue
                d = lin[RL[j]].distance(c)
                if d < 10 and (best is None or d < best[0]): best = (d, bool(r.get('x')))
            isx.append(bool(best and best[1]))
        else: isx.append(lx > 0 and lx >= lo)
    UX = unary_union([g for (g, a), f in zip(vei, isx) if f]); UXb = unary_union([g for (g, a), f in zip(vei, isx) if f and on_br(a)])
    oth = []
    for (g, a), f in zip(vei, isx):
        if f or (not innesti and (on_br(a) or a.get('sed') == '03')) or g.distance(UX) > OFF + APRI + 0.5: continue   # (anche un pezzo su un ponte: la rampa che sale su un cavalcavia e lì si innesta, x 72 z 223)
        hs = []; p0 = shapely.ops.nearest_points(g, UX)[0]   # le quote dove il pezzo è più vicino alla superstrada
        for j in TL.query(g):
            r = raw_roads[RL[j]]
            if r.get('x') or altra_quota(r, on_br(a)): continue
            c_ = lin[RL[j]].intersection(g)
            if c_.length > 0: hs.append(quota(RL[j], p0))
        hs = [h_ for h_ in hs if h_ is not None]
        hx = quota_x(p0)
        if hs and hx is not None and abs(sorted(hs)[len(hs) // 2] - hx) > QUOTA: rep['carreggiate_ad_altra_quota'] += 1; continue
        if on_br(a) and not hs: continue   # un ponte di cui non si sa la quota: un cavalcavia che passa sopra
        oth.append(g)
    OTH = unary_union(oth) if oth else Polygon()
    rep['carreggiata_superstrada_m2'] = round(UX.area); rep['pezzi_superstrada'] = sum(isx)
    # 2. gli spartitraffico della superstrada: i MAN_TR circondati per almeno il 60% da quella carreggiata
    med_n, med_w, nj = [], [], []
    for g, a in D['man']:
        if g.is_empty or not g.intersects(cover): continue
        rim = g.buffer(1.0).difference(g)
        if rim.area <= 0 or rim.intersection(UX).area < 0.6 * rim.area: continue
        w = 2 * g.area / max(g.length, 1e-6)
        if w <= NJ_MAX: med_n.append(g); rep['spartitraffico_stretti'] += 1
        else: med_w.append(g); rep['spartitraffico_larghi'] += 1
        if w <= NJ_MAX and a.get('ty') == '01': nj.append(g)
    MX = unary_union(med_n) if med_n else None
    nj = _parts(unary_union([g.buffer(0.1) for g in nj]).buffer(-0.1)) if nj else []   # uno spartitraffico che il DBGT taglia in più pezzi (al confine fra due comuni) è uno
    # 3. i guardrail: il bordo della carreggiata con gli spartitraffico stretti, le fessure chiuse, allargato di OFF
    A = unary_union([UX] + ([MX] if MX is not None else [])).buffer(CHIUDI, quad_segs=4).buffer(-CHIUDI, quad_segs=4)
    G = A.buffer(OFF, quad_segs=4)
    edge = []
    for p in _parts(G):
        for ring in [p.exterior] + list(p.interiors): edge.append(LineString(ring.coords))
    # dove si apre: vicino a un'altra carreggiata a raso, sulla via di un'altra strada a raso, lungo la superstrada sui ponti (i parapetti),
    # fuori dal DBGT
    cut = [OTH.buffer(APRI, quad_segs=3)] if not OTH.is_empty else []
    for ri, L in lin.items():
        r = raw_roads[ri]
        if r.get('x') or sotto(r) or r['bridge'] or r['c'] > 5 or L.distance(UX) > r['w'] / 2 + APRI + OFF + 0.5: continue
        P = xy(r)
        for a_, b_ in zip(P[:-1], P[1:]):   # tratto per tratto: solo dove la strada sta alla quota della superstrada
            sg = LineString([a_, b_])
            if sg.length < 0.05 or sg.distance(UX) > r['w'] / 2 + APRI + OFF + 0.5: continue
            fuori = sg.difference(UX)   # solo la parte fuori dalla carreggiata della superstrada: una via disegnata sopra di lei (una di servizio sotto il rilevato) non apre
            if fuori.is_empty or fuori.length < 0.05: continue
            m_ = shapely.ops.nearest_points(fuori, UX)[0]
            if not stessa(quota(ri, m_), quota_x(m_)): rep['tratti_di_vie_ad_altra_quota'] += 1; continue
            cut.append(fuori.buffer(r['w'] / 2 + APRI, quad_segs=3))
    # gli innesti: dove una via della superstrada e un'altra strada (non in galleria) hanno un nodo in comune il guardrail si apre sempre, per
    # tutta la larghezza dell'innesto (Carlo 6/11, x 72 z 223: la fine della rampa chiusa di traverso)
    nx_ = {}
    for ri in X:
        for n_ in raw_roads[ri]['refs']: nx_.setdefault(n_, []).append(ri)
    for ri, L in lin.items():
        r = raw_roads[ri]
        if not innesti or r.get('x') or sotto(r) or r['c'] > 5: continue
        for n_ in (r['refs'][0], r['refs'][-1]) + tuple(r['refs'][1:-1]):
            if n_ in nx_:
                w_ = max([r['w']] + [raw_roads[k]['w'] for k in nx_[n_]])
                cut.append(Point(nodes[n_]).buffer(w_ / 2 + OFF + APRI + 1.0, quad_segs=4)); rep['innesti'] += 1
    if not UXb.is_empty: cut.append(UXb.buffer(OFF + 0.4, quad_segs=3))
    CUT = unary_union(cut) if cut else None
    inside = cover.buffer(-1.0)
    gl = []
    for e in edge:
        c = e.intersection(inside)
        if CUT is not None: c = c.difference(CUT)
        for part in _lines(shapely.line_merge(c) if c.geom_type == 'MultiLineString' else c):
            if part.length >= CORTO: gl.append(part)
            else: rep['pezzi_corti_tolti'] += 1
    # 3b. una fessura lunga e stretta fra le due carreggiate opposte della superstrada senza MAN_TR del DBGT (Baruccana, x 385 z 2110: le due
    # carreggiate a 1,5 m l'una dall'altra) è uno spartitraffico anche lei: il new jersey (le due vie accanto vanno in versi opposti; nella punta
    # dipinta fra una rampa e la strada vanno nello stesso verso, e lì niente)
    def verso(ri, pt):
        L = lin[ri]; s_ = L.project(pt); a = L.interpolate(max(0, s_ - 1)); b = L.interpolate(min(L.length, s_ + 1)); v = np.array([b.x - a.x, b.y - a.y]); return v / (np.hypot(*v) or 1)
    fess = A.difference(unary_union([UX] + ([MX] if MX is not None else [])))
    for f in _parts(fess):
        if f.area < 20 or 2 * f.area / max(f.length, 1e-6) > NJ_MAX or f.length / 2 < NJ_MIN_L: continue
        rim = f.buffer(1.0).difference(f)
        if rim.intersection(UX).area < 0.8 * rim.area: continue
        si = no = 0   # in più punti lungo la fessura: le due vie più vicine, una per lato, vanno in versi opposti?
        bd = np.asarray(f.exterior.coords)
        for c in (Point(*shapely.ops.nearest_points(f, Point(*bd[int(i)]))[0].coords[0]) for i in np.linspace(0, len(bd) - 1, 12)[:-1]):
            c = shapely.ops.nearest_points(f.buffer(-0.2) if not f.buffer(-0.2).is_empty else f, c)[0]
            lati = {}; ref = None
            for ri in sorted((X[k] for k in XT0.query(c.buffer(15))), key=lambda ri: lin[ri].distance(c)):
                q = lin[ri].interpolate(lin[ri].project(c)); d_ = q.distance(c)
                if d_ > 15 or d_ < 1e-6: continue
                t = verso(ri, q)
                if ref is None: ref = t   # il lato si misura sempre rispetto alla stessa direzione (la via più vicina)
                sd = float(np.sign(ref[0] * (q.y - c.y) - ref[1] * (q.x - c.x)))
                if sd not in lati or d_ < lati[sd][0]: lati[sd] = (d_, t)
            if len(lati) == 2:
                if float(lati[1.0][1] @ lati[-1.0][1]) < -0.7: si += 1
                else: no += 1
        if si > no: nj.append(f); rep['fessure_con_new_jersey'] += 1
    # 4. il new jersey: la linea di mezzo di ogni spartitraffico stretto, per raggi dalla via della superstrada che gli corre accanto
    njl = []
    XL = STRtree([lin[ri] for ri in X])
    for g in nj:
        cand = [X[j] for j in XL.query(g.buffer(15))]
        if not cand: continue
        # le vie della superstrada che gli corrono accanto, unite in linee lunghe (una via corta sopra un sottopasso da sola non bastava per
        # NJ_MIN_L); il doppione fra le due carreggiate si toglie dopo
        ax = unary_union([lin[ri].intersection(g.buffer(12)) for ri in cand])
        segs_ = _lines(shapely.line_merge(ax) if ax.geom_type == 'MultiLineString' else ax)
        for seg in segs_:
            if seg.length < 4: continue
            P = _resample(np.asarray(seg.coords), 1.0)
            T = np.gradient(P, axis=0); T /= np.maximum(np.hypot(*T.T), 1e-9)[:, None]; Nn = np.column_stack((-T[:, 1], T[:, 0]))
            mids = np.full((len(P), 2), np.nan)
            for i in range(len(P)):
                for sg in (1, -1):
                    ray = LineString([P[i], P[i] + Nn[i] * sg * 25])
                    h = ray.intersection(g)
                    pp = [q for q in _lines(h)]
                    if not pp: continue
                    q = min(pp, key=lambda q: q.distance(Point(P[i])))
                    if q.length > NJ_MAX + 1: continue
                    if np.isnan(mids[i, 0]) or q.distance(Point(P[i])) < Point(mids[i]).distance(Point(P[i])):
                        c_ = q.interpolate(0.5, normalized=True); mids[i] = (c_.x, c_.y)
            ok = ~np.isnan(mids[:, 0])
            i = 0
            while i < len(P):
                if not ok[i]: i += 1; continue
                j = i
                while j < len(P) and ok[j]: j += 1
                if j - i >= NJ_MIN_L:
                    m = mids[i:j]
                    m = np.column_stack((gaussian_filter1d(m[:, 0], 3, mode='nearest'), gaussian_filter1d(m[:, 1], 3, mode='nearest')))
                    njl.append(LineString(m))
                i = j
    # i new jersey dello stesso spartitraffico visti da due vie (una per carreggiata): uno solo
    nj_out = []
    for L in sorted(njl, key=lambda L: -L.length):
        rest = L
        for M in nj_out: rest = rest.difference(M.buffer(1.0))
        for part in _lines(rest):
            if part.length >= NJ_MIN_L / 2: nj_out.append(part)
    # 5. lisciatura dei guardrail, senza avvicinarsi alla carreggiata; la quota: le vie della superstrada accanto
    UXp = UX.buffer(0); shapely.prepare(UXp)
    out = []
    XT = STRtree([lin[ri] for ri in X])
    def vie_accanto(P):
        rs = set()
        for q in P[::5]:
            pt = Point(q); j = XT.query(pt.buffer(25))
            if len(j): rs.add(min((X[k] for k in j), key=lambda ri: lin[ri].distance(pt)))
        return sorted(rs)
    angoli = _angoli_parapetti(); _al_parapetto.n = 0
    for L in gl:
        P = _resample(np.asarray(L.coords), 1.0); closed = L.is_closed
        if len(P) >= 5:
            md = 'wrap' if closed else 'nearest'
            S = np.column_stack((gaussian_filter1d(P[:, 0], LISCIA, mode=md), gaussian_filter1d(P[:, 1], LISCIA, mode=md)))
            d = shapely.distance(UXp, shapely.points(S))
            S[d < DENTRO] = P[d < DENTRO]
            if not closed: S[0], S[-1] = P[0], P[-1]
            P = S
        if not closed: P = _al_parapetto(P, angoli, quota_x)
        out.append(dict(k=1, p=[(round(float(x), 2), round(float(z), 2)) for x, z in P], r=vie_accanto(P)))
    rep['guardrail_attaccati_ai_parapetti'] = _al_parapetto.n
    for L in nj_out:
        P = _resample(np.asarray(L.coords), 1.0)
        out.append(dict(k=2, p=[(round(float(x), 2), round(float(z), 2)) for x, z in P], r=vie_accanto(P)))
    # le vie fatte qui: quelle della superstrada che stanno per almeno il 90% dove c'è il DBGT
    fatte = set(ri for ri in X if lin[ri].length > 0 and lin[ri].intersection(cover).length >= 0.9 * lin[ri].length)
    # il controllo: punti (ogni PASSO m) di un guardrail o di un new jersey dentro una carreggiata alla stessa quota (la superstrada e le altre
    # accanto a lei); deve essere 0
    PB = unary_union([g for g, a in vei if on_br(a)] + ([MX.buffer(0.3)] if MX is not None else []))
    Uc = unary_union([UX, OTH]).buffer(-0.05).difference(PB.buffer(0.5)); shapely.prepare(Uc); nin = 0; dove = []   # (sui ponti la strada sotto è a un'altra quota; sullo spartitraffico, sopra un ponte, la strada sotto lui)
    for l in out:
        q = _resample(np.asarray(l['p'], float), PASSO); m = shapely.contains_xy(Uc, q[:, 0], q[:, 1])
        nin += int(m.sum())
        if m.any() and len(dove) < 5: dove.append((round(float(q[m][0][0]), 1), round(float(q[m][0][1]), 1)))
    # il controllo nuovo (Carlo 6/11): nessun pezzo di guardrail o new jersey attraversa una carreggiata qualsiasi (AC_VEI, anche su un ponte)
    # alla stessa quota; i posti dove succede (un pezzo di linea per pezzo di carreggiata, più lungo di 0,5 m, fuori dallo spartitraffico)
    # e nessun pezzo di guardrail lontano dal bordo della carreggiata della superstrada (più di LONTANO m): deve essere 0
    nl = 0; dl = []
    for l in out:
        if l['k'] != 1: continue
        q = _resample(np.asarray(l['p'], float), 2.0); d = shapely.distance(UXp, shapely.points(q)); m = d > LONTANO
        if m.any(): nl += 1; dl.append((round(float(q[m][0][0]), 1), round(float(q[m][0][1]), 1)))
    rep['controllo_guardrail_lontani'] = nl; rep['controllo_lontani_dove'] = dl[:5]
    rep['controllo_attraversa_carreggiata'], rep['controllo_attraversa_dove'] = attraversa(out, vei, MX, TL, RL, raw_roads, lin, altra_quota, on_br, quota, quota_x, stessa)
    rep = dict(rep); rep.update(guardrail_km=round(sum(LineString(l['p']).length for l in out if l['k'] == 1) / 1000, 2), guardrail_pezzi=sum(1 for l in out if l['k'] == 1),
               new_jersey_km=round(sum(LineString(l['p']).length for l in out if l['k'] == 2) / 1000, 2), new_jersey_pezzi=sum(1 for l in out if l['k'] == 2),
               vie_fatte=len(fatte), controllo_punti_in_carreggiata=nin, controllo_dove=dove)
    log('guardrail: %s' % rep)
    return out, fatte, rep, (MX, med_w, unary_union(nj) if nj else None, UX)


def attraversa(out, vei, MX, TL, RL, raw_roads, lin, altra_quota, on_br, quota, quota_x, stessa):
    MXb = MX.buffer(0.3) if MX is not None else None
    G = [g for g, a in vei]; T = STRtree(G); n = 0; dove = []
    for l in out:
        L = LineString(l['p'])
        if MXb is not None and l['k'] == 2: L = L.difference(MXb)
        if L.is_empty: continue
        for j in T.query(L):
            g, a = vei[j]; c = L.intersection(g.buffer(-0.05))
            for part in _lines(c):
                if part.length < 0.5: continue
                m = part.interpolate(0.5, normalized=True); hs = []
                for k in TL.query(g):
                    r = raw_roads[RL[k]]
                    if altra_quota(r, on_br(a)) or lin[RL[k]].intersection(g).length <= 0: continue
                    h = quota(RL[k], m)
                    if h is not None: hs.append(h)
                hg = sorted(hs)[len(hs) // 2] if hs else None
                if stessa(hg, quota_x(m)):
                    n += 1
                    if len(dove) < 8: dove.append((round(m.x, 1), round(m.y, 1)))
    return n, dove


LAMP_NJ = 4.0      # un lampione a meno di tanto da un new jersey sta sullo spartitraffico: va sul new jersey
LAMP_PASSO = 15.0  # due lampioni dello spartitraffico più vicini di tanto sono lo stesso, visto da due fonti (OSM, Mapillary): uno, nel mezzo
LAMP_DOPPIO = 6.0  # lungo la superstrada fuori dallo spartitraffico, due lampioni più vicini di tanto sono uno


def lampioni(lamps, linee, UX, log=print):
    """i lampioni lungo la superstrada (Carlo 6/11, Baruccana: "ammucchiati e a caso"). Sulla Milano-Meda stanno sul new jersey, uno ogni
    30-35 m (Mapillary 2023, ortofoto); i dati ne danno di più fonti (OSM, i riconoscimenti di Mapillary di più passaggi) a pochi metri l'uno
    dall'altro e un po' di lato. Quelli vicini a un new jersey vanno sulla sua linea e quelli più vicini di LAMP_PASSO lungo di lei diventano uno
    (nel mezzo); gli altri entro 10 m dalla carreggiata, più vicini di LAMP_DOPPIO, uno"""
    NJ = [LineString(l['p']) for l in linee if l['k'] == 2 and len(l['p']) >= 2]
    if not lamps: return lamps, {}
    rep = Counter(); out = []; su = {}   # su[j]: [(s, ...)] i lampioni sul new jersey j, per distanza lungo di lui
    T = STRtree(NJ) if NJ else None
    for x, z in lamps:
        p = Point(x, z)
        if T is not None:
            j = T.nearest(p)
            if j is not None and NJ[int(j)].distance(p) < LAMP_NJ: su.setdefault(int(j), []).append(NJ[int(j)].project(p)); continue
        out.append([x, z])
    nj_i = set()
    for j, ss in su.items():
        ss.sort(); grp = [[ss[0]]]
        for v in ss[1:]:
            if v - grp[-1][0] < LAMP_PASSO: grp[-1].append(v)
            else: grp.append([v])
        for g in grp:
            q = NJ[j].interpolate(sum(g) / len(g)); out.append([round(q.x, 1), round(q.y, 1)]); nj_i.add(len(out) - 1); rep['sul_new_jersey'] += 1; rep['fusi'] += len(g) - 1
    # i doppi accanto alla superstrada
    UXb = UX.buffer(10.0); shapely.prepare(UXb); keep = []; done = [False] * len(out)
    P = np.array(out, float); tr = STRtree(shapely.points(P)) if len(P) else None
    for i in sorted(range(len(out)), key=lambda i: i not in nj_i):   # prima quelli sul new jersey: un lampione accanto a uno di loro è lui
        x, z = out[i]
        if done[i]: continue
        if not shapely.contains_xy(UXb, x, z): keep.append([x, z]); done[i] = True; continue
        R_ = LAMP_PASSO if i in nj_i else LAMP_DOPPIO   # (sul new jersey anche fra due suoi pezzi)
        near = [k for k in tr.query(Point(x, z).buffer(R_)) if not done[k] and np.hypot(*(P[k] - P[i])) < R_]
        for k in near: done[k] = True
        keep.append([x, z]); rep['doppi_tolti'] += len(near) - 1
    rep = dict(rep); log('guardrail: lampioni della superstrada %s, %d -> %d' % (rep, len(lamps), len(keep)))
    return keep, rep


def sostituisci_divisori(bar_out, linee, MX, log=print):
    """i divisori del DBGT che sono il guardrail o il new jersey (a meno di DIV_D m da una linea e paralleli, di tipo 2 o 7: i 'muretti' e le
    staccionate che il DBGT ha lungo la strada senza dire cosa sono), e quelli dentro uno spartitraffico stretto: al loro posto c'è la linea.
    Gli altri muri, le reti e le siepi restano"""
    if not linee: return bar_out, {}
    LG = [LineString(l['p']) for l in linee if len(l['p']) >= 2]; KG = [l['k'] for l in linee if len(l['p']) >= 2]; T = STRtree(LG)
    MXp = MX.buffer(0.3) if MX is not None else None
    if MXp is not None: shapely.prepare(MXp)
    out = []; c = Counter()
    for b in bar_out:
        pts, kind = b[0], b[1]
        if len(pts) < 2 or kind not in (1, 2, 5, 7): out.append(b); continue
        L = LineString(pts); near = T.query(L.buffer(DIV_D + 0.5))
        inm = MXp is not None and MXp.intersects(L)
        if not len(near) and not inm: out.append(b); continue
        q = _resample(np.asarray(pts, float), PASSO); n = len(q)
        if n < 2: out.append(b); continue
        dq = np.gradient(q, axis=0); dq /= np.maximum(np.hypot(*dq.T), 1e-9)[:, None]
        rm = np.zeros(n, bool)
        if inm: rm |= shapely.contains_xy(MXp, q[:, 0], q[:, 1])
        for j in near:
            if kind not in (2, 7) and KG[j] != 2: continue   # lungo un new jersey anche una rete o un muro parallelo è lui (Baruccana: la rete a rombi nella fessura fra le carreggiate)
            g = LG[j]; P = shapely.points(q); d = shapely.distance(g, P); close = d < DIV_D
            if not close.any(): continue
            s = shapely.line_locate_point(g, P[close]); a = shapely.get_coordinates(shapely.line_interpolate_point(g, np.maximum(s - 0.5, 0))); b2 = shapely.get_coordinates(shapely.line_interpolate_point(g, s + 0.5))
            t = b2 - a; t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]
            par = np.abs((t * dq[close]).sum(1)) > 0.85
            idx = np.where(close)[0][par]; rm[idx] = True
        if not rm.any(): out.append(b); continue
        c['divisori_toccati'] += 1; c['metri_sostituiti'] += float(rm.sum()) * PASSO
        i = 0
        while i < n:
            if rm[i]: i += 1; continue
            j = i
            while j < n and not rm[j]: j += 1
            seg = q[i:j]
            if len(seg) >= 2 and float(np.hypot(*np.diff(seg, axis=0).T).sum()) > 1.0:
                out.append((list(map(tuple, np.round(seg, 2))),) + tuple(b[1:]))
            i = j
    c = {k: round(v) for k, v in c.items()}
    log('guardrail: divisori del DBGT che erano il guardrail o il new jersey %s' % c)
    return out, c


def push_tiles(linee, ntiles, tbox, push):
    """le linee nei tile: tiles[t].gr = [[k, [vie], [dx, dz, ...]]], punti in centimetri delta (Douglas-Peucker 2 cm)"""
    if not linee: return
    G = [LineString(l['p']) for l in linee]; T = STRtree(G)
    for t in range(ntiles):
        bx = tbox(t)
        for i in T.query(bx):
            c = G[i].intersection(bx)
            for part in _lines(c):
                if part.length < 0.3: continue
                q = part.simplify(0.02, preserve_topology=False); o = []; px = pz = 0
                for x, z in q.coords:
                    X_, Z_ = int(round(x * 100)), int(round(z * 100)); o += [X_ - px, Z_ - pz]; px, pz = X_, Z_
                push(t, 'gr', [linee[i]['k'], linee[i]['r'], o])
