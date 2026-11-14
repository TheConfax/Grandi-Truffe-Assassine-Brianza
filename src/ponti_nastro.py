"""I ponti dal nastro (docs/nastri.md, passo 2; Carlo 13/11: "il ponte è largo come la strada, la sagoma PONTE dice solo dove comincia e dove finisce").
L'impalcato di un ponte stradale non nasce più dalla sagoma PONTE allungata a quadretti (impalcati.py celle_spalla, striscia, rampa, fianchi) ma dai
nastri (src/nastri.py) che ci passano sopra:
  - un nastro sta sul ponte nelle stazioni dentro la sagoma PONTE ALLA QUOTA del suo piano (entro SU_DZ: la strada che passa sotto è dentro la sagoma
    in pianta ma a un'altra quota e non conta);
  - da lì il tratto continua, una stazione alla volta, finché sotto la sezione del nastro (asse e due punti verso i bordi) il suolo S sta più di ARIA
    sotto la quota del nastro: è il pezzo di strada che il terreno non ha (il rilevato che il LiDAR non vede, il suolo tolto dietro le spalle). Finisce
    alla prima stazione che ha il suolo alla sua quota: lì c'è il capo, un taglio dritto di traverso all'asse, e l'impalcato appoggia;
  - la sezione: i due bordi del nastro (la carreggiata misurata sull'AC_VEI), il marciapiede dove il DBGT lo dà accanto alla carreggiata alla stessa
    quota (AC_PED, AC_CIC), più CORDOLO per lato: la striscia di cemento che porta il parapetto, subito fuori;
  - più nastri sullo stesso PONTE (le due carreggiate di una superstrada) fanno un impalcato solo: la fessura fra due strisce fino a 2 * FESSURA si chiude
    (lo spartitraffico sta sul ponte);
  - la quota: quella del nastro (dell'asse, piana di traverso), mediata fra i nastri dove sono più d'uno; ai capi che appoggiano va su S (lo scarto fra
    nastro e suolo lungo il taglio di un capo, con la sua pendenza di traverso, sposta l'impalcato di quel tanto, da un capo all'altro in linea retta)
    e i vertici sul taglio prendono S esatto.
Un PONTE stradale senza nastri sopra resta al metodo vecchio e finisce nel rapporto (senza_nastro)."""
import numpy as np, shapely
from shapely.geometry import Polygon
from scipy.spatial import cKDTree
from scipy.ndimage import median_filter

SU_DZ = 1.5       # una stazione sta sul PONTE se è dentro la sagoma e la sua quota sta entro questo dal piano del PONTE
ARIA = 0.5        # sotto la sezione il suolo più basso di tanto: lì la strada è in aria (= impalcati.LEVEL_TOL)
EST_MAX = 150.0   # il tratto oltre la sagoma PONTE al massimo tanto per capo (m)
BUCO = 3          # stazioni fuori dalla sagoma fra due dentro: stesso tratto
CORTO = 4         # un tratto più corto di tante stazioni non è un ponte di quel nastro (lo sfiora)
LARGO_MIN = 2.0   # sezione più stretta di tanto: il nastro lì non ha carreggiata misurata, prende la mediana del tratto
CORDOLO = 0.6     # per lato, oltre la carreggiata o il marciapiede: porta il parapetto
FESSURA = 3.0     # fra due strisce dello stesso PONTE fino a 2 * FESSURA m: chiusa
MARC_MAX = 5.0    # un marciapiede accanto alla carreggiata è largo al massimo tanto
MARC_MIN = 0.6    # ... e almeno tanto, per almeno MARC_LUNGO stazioni
MARC_LUNGO = 5
PILA = 8          # fra due tratti dello stesso nastro fino a tante stazioni di suolo alla sua quota: lo stesso ponte (una pila, la spalla fra il PONTE e la campata che il DBGT non segna)
NS_MIN, NS_ALTO = 6, 1.5   # un tratto senza PONTE è un ponte solo se è lungo almeno tante stazioni e alto almeno tanto sul suolo
CAPO_NASTRO = 1.0 # dove il nastro stesso finisce a meno di tanto sul suolo, il capo appoggia
SEZ, PIANO = 7, 0.12   # il suolo sotto la sezione in tanti punti; fuori di tanto dalla retta che li attraversa: non è un piano solo (m)
SCARTO = 1.0      # fra la quota del nastro e il suolo a un capo che appoggia al massimo tanto: l'impalcato si sposta di quello (m)
SUL_SUOLO = 0.3   # un vertice del taglio di capo prende la quota del suolo se il suolo sta entro tanto dall'impalcato (oltre, lì il taglio sporge sulla scarpata)


def _tratti(m):
    out = []; i = 0; k = len(m)
    while i < k:
        if not m[i]: i += 1; continue
        j = i
        while j < k and m[j]: j += 1
        out.append((i, j - 1)); i = j
    return out


class Marciapiedi:
    """le aree pedonali e ciclabili del DBGT con la quota dei loro vertici: quanto si allarga la sezione oltre il bordo della carreggiata"""
    def __init__(s, D):
        import nastri as NS
        cl = {}
        for nm in ('AC_PED', 'AC_CIC'):
            L = D.get(nm)
            if L is None: continue
            sed = np.array([str(v or '') for v in L['attr']['sed']])
            for c, q in ((NS.RASO, ~np.isin(sed, ('02', '03'))), (NS.PONTE, sed == '02')): cl.setdefault(c, []).extend(NS._poligoni(L, q))
        s.C = NS._Carreggiata(cl) if any(cl.values()) else None

    def largo(s, P, U, z):
        """dal punto di bordo P verso fuori (U): la larghezza del marciapiede che comincia lì alla quota z, 0 se non c'è"""
        if s.C is None or not len(P): return np.zeros(len(P))
        Q = P + U * 0.2; m = s.C.dentro(Q); out = np.zeros(len(P))
        if m.any():
            r = s.C.raggi(Q[m], U[m], z[m]) + 0.2; out[m] = np.where(r < MARC_MAX, r, 0.0)
        return out


class Quota:
    """la quota dell'impalcato: quella dei nastri delle sue strisce, mediata dove sono più d'una (peso: quanto il punto sta fuori dalla striscia)"""
    def __init__(s, strisce, capi): s.S = strisce; s.kd = [cKDTree(t['xy']) for t in strisce]; s.land = np.array([bool(c[2]) for c in capi]); s.valid = np.zeros(1, bool); s.r = np.zeros(0); s.salti = s.dispari = 0

    def approda(s, rr, cc): return np.zeros(len(rr), bool)

    def __call__(s, P):
        P = np.atleast_2d(np.asarray(P, float)); num = np.zeros(len(P)); den = np.zeros(len(P))
        for t, kd in zip(s.S, s.kd):
            _, i = kd.query(P); d = P - t['xy'][i]; n = t['n'][i]; lat = (d * n).sum(1); al = -d[:, 0] * n[:, 1] + d[:, 1] * n[:, 0]   # (the tangent is (-n_z, n_x))
            sa = np.clip(t['s'][i] + al, t['s'][0], t['s'][-1]); f = sa / max(t['s'][-1], 1e-6)
            y = np.interp(sa, t['s'], t['y']) + (1 - f) * np.interp(lat, t['rr'][0][0], t['rr'][0][1]) + f * np.interp(lat, t['rr'][1][0], t['rr'][1][1])   # the profile of the ribbon, on the ground at its two ends
            fuori = np.maximum(np.abs(lat) - np.where(lat > 0, t['sx'][i], t['dx'][i]), 0) + np.abs(t['s'][i] + al - sa)
            w = 1 / (fuori + 0.05) ** 2; num += w * y; den += w
        return num / den


def trova(imp, N, log=print):
    """({k del nucleo: dict(g, strisce, capi, F)} per i nuclei 'strada' con dei nastri sopra, [gli stessi dict per i ponti che il DBGT non segna], rapporto)"""
    from scipy import ndimage
    R = imp.R; marc = Marciapiedi(imp.D); rep = dict(ponti=0, non_segnati=0, strisce=0, senza_nastro=[], capi_sospesi=[], tratti=[], stretti=0, marciapiedi_m=0)
    AIRN = ndimage.binary_dilation(imp.s.AIR, np.ones((3, 3), bool))
    nodo = lambda P: AIRN[np.clip(np.round((P[:, 1] - R.z0) / R.st).astype(int), 0, R.nz - 1), np.clip(np.round((P[:, 0] - R.x0) / R.st).astype(int), 0, R.nx - 1)]
    bb = [(n['xy'][:, 0].min(), n['xy'][:, 1].min(), n['xy'][:, 0].max(), n['xy'][:, 1].max()) for n in N]
    su = [np.full(len(n['xy']), -1) for n in N]   # the PONTE each station is on
    for c in imp.cores:
        if c['tipo'] != 'strada': continue
        gb = c['g'].buffer(0.5); b = gb.bounds
        for ni, n in enumerate(N):
            if bb[ni][0] > b[2] or bb[ni][2] < b[0] or bb[ni][1] > b[3] or bb[ni][3] < b[1]: continue
            m = shapely.contains_xy(gb, n['xy'][:, 0], n['xy'][:, 1])
            if not m.any(): continue
            m[m] = np.abs(n['y'][m] - c['top'](n['xy'][m, 0], n['xy'][m, 1])) < SU_DZ
            for a, b_ in _tratti(m):   # holes of a few stations closed
                w = np.nonzero(m[max(0, a - BUCO - 1):a])[0]
                if len(w): m[max(0, a - BUCO - 1) + w[-1]:a] = True
            for a, b_ in _tratti(m):
                if b_ - a + 1 >= CORTO: su[ni][a:b_ + 1] = c['k']
    per = {}; liberi = []
    G = imp.D.get('GALLER'); import superficie as sf   # over the cover of a gallery the ground is the cover (impalcati.copertura): no span there
    gal = shapely.union_all([sf.poly(G, i) for i in range(len(G['off']) - 1)]).buffer(2.0) if G is not None and len(G['off']) > 1 else None
    for ni, n in enumerate(N):
        k = len(n['xy']); P = n['xy']; nv = n['n']; y = n['y']; Q = (P, P + nv * (n['sx'] * 0.7)[:, None], P - nv * (n['dx'] * 0.7)[:, None])
        if not (su[ni] >= 0).any() and not (nodo(Q[0]) | nodo(Q[1]) | nodo(Q[2])).any(): continue
        # the ground under the section, at SEZ points from edge to edge of the carriageway: the road is in the air where the lowest lies more than ARIA under the ribbon, or where the
        # ground is not one plane across (more than PIANO off the straight line through it: a part of the section is already over the drop, the edge of the abutment)
        fr = np.linspace(-0.95, 0.95, SEZ); lat = np.where(fr[None] > 0, n['sx'][:, None] * fr[None], n['dx'][:, None] * fr[None])
        SS = np.stack([imp.Sat(*(P + nv * lat[:, j:j + 1]).T) for j in range(SEZ)], 1); sm = SS.min(1); alto = y - sm
        A_ = np.stack((lat, np.ones_like(lat)), 2); cf = np.array([np.linalg.lstsq(A_[q], SS[q], rcond=None)[0] if np.ptp(lat[q]) > 0.5 else (0.0, SS[q].mean()) for q in range(k)])
        storto = np.abs(SS - (cf[:, :1] * lat + cf[:, 1:])).max(1) > PIANO; aria = (alto > ARIA) | storto
        m = (alto > ARIA) & (nodo(Q[0]) | nodo(Q[1]) | nodo(Q[2]))
        if gal is not None and m.any(): m &= ~shapely.contains_xy(gal, P[:, 0], P[:, 1])
        m |= su[ni] >= 0   # on a PONTE, or in the air where the terrain says the road is a deck (superficie.py AIR)
        for a, b_ in _tratti(m):   # a short landing between two stretches (a pier, the abutment between a PONTE and the span the DBGT does not flag) is the same bridge
            w = np.nonzero(m[max(0, a - PILA - 1):a])[0]
            if len(w): m[max(0, a - PILA - 1) + w[-1]:a] = True
        tr = _tratti(m); preso = np.zeros(k, bool)
        for a, b_ in tr: preso[a:b_ + 1] = True
        for a, b_ in tr:
            ks = su[ni][a:b_ + 1]; ks = ks[ks >= 0]
            if not len(ks) and (b_ - a + 1 < NS_MIN or alto[a:b_ + 1].max() < NS_ALTO): continue   # no PONTE: only a real span
            a2 = a
            while a2 > 0 and aria[a2] and a - a2 < EST_MAX and not preso[a2 - 1]: a2 -= 1
            b2 = b_
            while b2 < k - 1 and aria[b2] and b2 - b_ < EST_MAX and not preso[b2 + 1]: b2 += 1
            preso[a2:b2 + 1] = True
            sl = slice(a2, b2 + 1); sx, dx = n['sx'][sl].copy(), n['dx'][sl].copy(); xy = P[sl]; nn = nv[sl]; yy = y[sl]
            st = sx + dx < LARGO_MIN
            if st.any():
                rep['stretti'] += 1
                if st.all(): continue
                sx[st] = np.median(sx[~st]); dx[st] = np.median(dx[~st])
            ml = marc.largo(xy + nn * sx[:, None], nn, yy); mr = marc.largo(xy - nn * dx[:, None], -nn, yy)
            for w in (ml, mr):   # a sidewalk: wide enough for a stretch, its width steadied
                w[:] = median_filter(w, 5, mode='nearest'); ok = w >= MARC_MIN
                for p, q in _tratti(ok):
                    if q - p + 1 < MARC_LUNGO: ok[p:q + 1] = False
                w[~ok] = 0; rep['marciapiedi_m'] += int(ok.sum())
            sx += ml + CORDOLO; dx += mr + CORDOLO
            s_ = n['s'][sl] - n['s'][a2]; L = s_[-1]; capi = []; rr = [None, None]
            for e, (i, vicino) in enumerate(((a2, a2 - 1), (b2, b2 + 1))):
                j = 0 if e == 0 else -1; A, B = xy[j] + nn[j] * sx[j], xy[j] - nn[j] * dx[j]
                segue = 0 <= vicino < k and preso[vicino]   # the next stretch of the same ribbon is a deck too: the road goes on there, it does not rest on the ground
                appoggia = not segue and (not aria[i] or (not 0 <= vicino < k and alto[i] < CAPO_NASTRO))   # (where the ribbon itself ends a little over the ground it comes down onto it)
                if appoggia:   # the gap between the ribbon and the ground where it lands, across the whole cut (the ground has its crossfall, the ribbon is flat across): where the cut hangs over the bank, that of the axis
                    lat = np.arange(-dx[j], sx[j] + 0.25, 0.5); ra = float(np.clip(imp.Sat(xy[j, 0], xy[j, 1])[0] - yy[j], -SCARTO, SCARTO)); rl = imp.Sat(*(xy[j] + nn[j] * lat[:, None]).T) - yy[j]
                    rr[e] = (lat, np.where(np.abs(rl - ra) < SUL_SUOLO, rl, ra), ra)
                capi.append([A, B, appoggia, round(float(alto[i]), 2)])
            # the height: the profile of the ribbon, moved onto the ground at the ends that land (the gap of one end at that end, of the other at the other, straight between)
            for e in (0, 1):   # an end that does not land: the gap of the other at its axis, or none
                if rr[e] is None: ra = rr[1 - e][2] if rr[1 - e] is not None else 0.0; rr[e] = (np.array([-1.0, 1.0]), np.array([ra, ra]), ra)
            yq = yy + rr[0][2] + (rr[1][2] - rr[0][2]) * s_ / max(L, 1e-6)
            g = Polygon(np.vstack((xy + nn * sx[:, None], (xy - nn * dx[:, None])[::-1]))).buffer(0)
            if g.is_empty: continue
            ck = int(np.bincount(ks).argmax()) if len(ks) else -1
            t = dict(nastro=n['i'], xy=xy, n=nn, s=s_, y=yy, yq=yq, rr=rr, sx=sx, dx=dx, capi=capi, g=g, da=int(a2), a=int(b2), ponte=ck)
            (per.setdefault(ck, []) if ck >= 0 else liberi).append(t)
            rep['tratti'].append(dict(ponte=imp.cores[ck]['pid'] if ck >= 0 else None, nastro=n['i'], m=round(float(L), 1), prima=int(a - a2), dopo=int(b2 - b_), largo=round(float(np.median(sx + dx)), 2), appoggia=[bool(capi[0][2]), bool(capi[1][2])],
                                   x=round(float(xy[len(xy) // 2, 0]), 1), z=round(float(xy[len(xy) // 2, 1]), 1)))

    def impalcato(strisce, pid):
        g = shapely.union_all([t['g'] for t in strisce])
        if len(strisce) > 1: g = g.buffer(FESSURA, join_style=2, mitre_limit=2.0).buffer(-FESSURA, join_style=2, mitre_limit=2.0)
        g = g.buffer(0); capi = []
        for t in strisce:
            for A, B, ap, h in t['capi']:
                if g.boundary.distance(shapely.Point((A + B) / 2)) > 0.3: continue   # inside the deck (two ribbons meet end to end on the bridge): not an end
                capi.append((A, B, ap))
                if not ap and h > CAPO_NASTRO: rep['capi_sospesi'].append(dict(ponte=pid, nastro=t['nastro'], x=round(float((A[0] + B[0]) / 2), 1), z=round(float((A[1] + B[1]) / 2), 1), sopra_il_suolo=h))
        rep['strisce'] += len(strisce)
        return dict(g=g, strisce=strisce, capi=capi, F=Quota(strisce, capi))

    out = {}
    for c in imp.cores:
        if c['tipo'] != 'strada': continue
        if c['k'] not in per: rep['senza_nastro'].append(dict(ponte=c['pid'], x=round(c['g'].centroid.x, 1), z=round(c['g'].centroid.y, 1))); continue
        out[c['k']] = impalcato(per[c['k']], c['pid']); rep['ponti'] += 1
    ns = []   # the spans the DBGT does not flag: the stretches that touch (within the gap closed between two carriageways) are one bridge
    resto = list(liberi)
    while resto:
        gr = [resto.pop()]; cresce = True
        while cresce:
            cresce = False
            for t in list(resto):
                if any(t['g'].distance(u['g']) < 2 * FESSURA for u in gr): gr.append(t); resto.remove(t); cresce = True
        ns.append(impalcato(gr, None)); rep['non_segnati'] += 1
    log('ponti dal nastro: %d sui PONTE, %d non segnati (strisce %d), PONTE stradali senza nastro %d, capi sospesi %d, sezioni strette %d, marciapiede lungo %d m di bordo' % (
        rep['ponti'], rep['non_segnati'], rep['strisce'], len(rep['senza_nastro']), len(rep['capi_sospesi']), rep['stretti'], rep['marciapiedi_m']))
    return out, ns, rep


def sul_capo(P, capi, solo_appoggio=True, tol=0.03):
    """quali punti P stanno su un taglio di capo (A, B, appoggia)"""
    P = np.atleast_2d(P); out = np.zeros(len(P), bool)
    for A, B, ap in capi:
        if solo_appoggio and not ap: continue
        e = B - A; L2 = float(e @ e)
        if L2 < 1e-9: continue
        t = np.clip(((P - A) @ e) / L2, 0, 1); out |= np.hypot(*(P - (A + t[:, None] * e)).T) < tol
    return out


def anello_coi_nodi(ring, capi, R, tol=0.03):
    """l'anello (chiuso o no) con, sui lati che stanno su un taglio che appoggia, i punti dove il taglio incontra le linee del reticolo di S (x, z e la
    diagonale di ogni cella: lungo il taglio S è lineare fra quei punti, e l'impalcato combacia)"""
    Q = np.asarray(ring, float)
    if len(Q) > 1 and np.allclose(Q[0], Q[-1]): Q = Q[:-1]
    on = sul_capo(Q, capi, True, tol); out = []
    for i in range(len(Q)):
        p, q = Q[i], Q[(i + 1) % len(Q)]; out.append(p)
        if not (on[i] and on[(i + 1) % len(Q)]): continue
        ts = []
        for f in (lambda v: (v[0] - R.x0) / R.st, lambda v: (v[1] - R.z0) / R.st, lambda v: ((v[0] - R.x0) - (v[1] - R.z0)) / R.st):
            a, b = f(p), f(q)
            if abs(b - a) < 1e-9: continue
            for kk in range(int(np.ceil(min(a, b) + 1e-6)), int(np.floor(max(a, b) - 1e-6)) + 1): ts.append((kk - a) / (b - a))
        for t in sorted(set(round(t, 6) for t in ts if 0.01 < t < 0.99)): out.append(p + (q - p) * t)
    return np.array(out)
