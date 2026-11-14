"""I nastri (docs/nastri.md, passo 1). Ogni carreggiata del DBGT diventa un nastro:
  - l'asse in 3D: gli elementi EL_STR uniti capo a capo dove proseguono (dbgt_righe.strokes, le stesse carreggiate delle righe), con la quota pulita
    di ogni vertice (dbgt_quote.load_dbgt: m sul mare, tolto lo scarto del comune), una stazione ogni metro;
  - i due bordi: a ogni stazione, di traverso all'asse, la distanza dal bordo della carreggiata AC_VEI (zone 01xx e 02xx) ALLA STESSA QUOTA della
    stazione (entro DZ). Il contorno è quello delle aree a raso, di quelle su ponte (SED 02) e di quelle in galleria (SED 03), ognuno con la quota dei
    suoi vertici; il tratto di contorno dove un'area su ponte e una a raso si toccano alla stessa quota (il capo del ponte) non è un bordo e si
    toglie, quello della strada che passa sotto resta ma sta a un'altra quota e il raggio non lo vede. Dove l'asse corre in un cortile o in un
    parcheggio: il contorno di tutto l'AC_VEI a raso. Un bordo che si apre (l'imbocco di una traversa, un incrocio: oltre 1 m sopra la sua
    apertura dal basso su 41 m) si porta dritto da dove corre prima a dove corre dopo, poi si liscia tenendolo sull'asfalto (dbgt_righe._liscia);
  - la sede di ogni stazione, dall'elemento EL_STR: 0 a raso, 1 ponte (SED 02), 2 galleria (SED 03), 3 sotto (LIV 01: il tratto che passa sotto
    un'altra opera). La trincea scoperta il DBGT non la scrive: la dirà la quota dell'asse rispetto al terreno, al passo 4;
  - un numero: il suo posto nell'elenco.
Scrive mappa/nastri.bin (gzip di un JSON: le stazioni sfoltite a 4 cm, in cm: asse e i due punti di bordo, quote sopra terrain.base come nel gioco)
e report_nastri.json. Il gioco per ora li disegna soltanto, con &nastri=1 (src/nastri3.js); il metro dei livelli (src/controllo_livelli.mjs) li
usa come riferimento.
  python src/nastri.py [cartella con brianza.json, di default il repo]        (build.py lo lancia dopo build_data.py)
calcola(D, base) rende i nastri interi (una stazione al metro) a chi nella build li vuole usare."""
import os, sys, json, gzip, io, time, math
import collections
from collections import Counter
import numpy as np, shapely
from shapely.geometry import Polygon
from shapely.strtree import STRtree
from scipy.ndimage import minimum_filter1d, maximum_filter1d
from scipy.spatial import cKDTree

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
import dbgt_quote as dq
from dbgt_righe import strokes, _liscia

PASSO = 1.0       # una stazione ogni metro
RMAX = 20.0       # i raggi di traverso
DZ = 2.5          # stesso livello: quote entro questo
APRE = 41         # un bordo che si apre per meno di questi metri...
APRE_DI = 1.0     # ...di oltre questo: portato dritto
LISCIA = 3.0      # i bordi lisciati su questi metri
CUCI = 15.0       # due capi liberi dell'asse che si guardano entro tanto: ricuciti (m)
FINO = 0.04       # lo sfoltimento delle stazioni nel file: entro 4 cm
RASO, PONTE, GALLERIA, SOTTO = 0, 1, 2, 3
SEDI = ['raso', 'ponte', 'galleria', 'sotto']


def _sede(sed, liv):
    return PONTE if sed == '02' else GALLERIA if sed == '03' else SOTTO if liv == '01' else RASO


def _poligoni(L, quali):
    """[(poligono in pianta, i suoi vertici x z quota)]"""
    out = []
    for i in np.nonzero(quali)[0]:
        a, b = L['off'][i], L['off'][i + 1]; st = list(L['anelli'][i]) + [b - a]; xy = L['xy'][a:b]
        an = [xy[st[k]:st[k + 1]] for k in range(len(st) - 1)]; an = [r for r in an if len(r) >= 3]
        if not an: continue
        p = Polygon(an[0], an[1:]).buffer(0)
        if not p.is_empty: out.append((p, np.column_stack((xy, L['z'][a:b]))))
    return out


def _contorno(u):
    c, ix = shapely.get_coordinates(shapely.get_rings(shapely.get_parts(u)), return_index=True); ok = ix[:-1] == ix[1:]
    return c[:-1][ok], c[1:][ok]


def _incontri(T, A, B, P, U):
    """i raggi P + t U (t fino a RMAX) contro i tratti A-B dell'albero T: (raggio, tratto, t, posto lungo il tratto da 0 a 1)"""
    ri, si = T.query(shapely.linestrings(np.stack((P, P + U * RMAX), 1)), predicate='intersects')
    d = U[ri]; e = B[si] - A[si]; w = A[si] - P[ri]; den = d[:, 0] * e[:, 1] - d[:, 1] * e[:, 0]; ok = np.abs(den) > 1e-12; den = np.where(ok, den, 1)
    return ri[ok], si[ok], ((w[:, 0] * e[:, 1] - w[:, 1] * e[:, 0]) / den)[ok], ((w[:, 0] * d[:, 1] - w[:, 1] * d[:, 0]) / den)[ok]


class _Bordo:
    """il contorno di un'unione di aree in pianta: i raggi da un punto fino al primo tratto di contorno"""
    def __init__(s, polys):
        s.u = shapely.union_all(polys) if polys else None; s.vuoto = s.u is None or s.u.is_empty
        if s.vuoto: return
        shapely.prepare(s.u); s.A, s.B = _contorno(s.u); s.T = STRtree(shapely.linestrings(np.stack((s.A, s.B), 1)))

    def dentro(s, P):
        return np.zeros(len(P), bool) if s.vuoto else shapely.contains_xy(s.u, P[:, 0], P[:, 1])

    def raggi(s, P, U):
        """la distanza dal punto P al contorno lungo U (versori); RMAX se non lo incontra"""
        out = np.full(len(P), RMAX)
        if s.vuoto or not len(P): return out
        ri, si, t, _ = _incontri(s.T, s.A, s.B, P, U); np.minimum.at(out, ri, np.clip(t, 0, RMAX))
        return out


class _Carreggiata:
    """il contorno delle carreggiate su più livelli: quello di ogni classe (a raso, ponte, galleria) con la quota dei vertici, senza i capi dove
    due classi si toccano alla stessa quota. I raggi si fermano solo sul contorno alla loro quota"""
    def __init__(s, classi):   # {classe: [(poligono, vertici)]}
        s.U = []; SA, SB, ZA, ZB = [], [], [], []; s.capi = 0
        for c, pol in classi.items():
            if not pol: continue
            u = shapely.union_all([p for p, _ in pol]); shapely.prepare(u); s.U.append(u); A, B = _contorno(u)
            v = np.vstack([q for _, q in pol]); v = v[~np.isnan(v[:, 2])]; kd = cKDTree(v[:, :2]); za, zb = v[kd.query(A)[1], 2], v[kd.query(B)[1], 2]
            e = B - A; L = np.hypot(e[:, 0], e[:, 1]); nr = np.column_stack((-e[:, 1], e[:, 0])) / np.maximum(L, 1e-9)[:, None]; M = (A + B) / 2; zm = (za + zb) / 2
            capo = np.zeros(len(A), bool)
            for c2, pol2 in classi.items():   # il capo: da una parte del tratto c'è un'area di un'altra classe che lì sta alla stessa quota
                if c2 == c or not pol2: continue
                T2 = STRtree([p for p, _ in pol2])
                for verso in (0.05, -0.05):
                    qi, pi = T2.query(shapely.points(M + nr * verso), predicate='within')
                    for q, k in zip(qi, pi):
                        w = pol2[k][1]; w = w[~np.isnan(w[:, 2])]
                        if len(w) and abs(w[np.argmin(np.hypot(w[:, 0] - M[q, 0], w[:, 1] - M[q, 1])), 2] - zm[q]) < DZ: capo[q] = True
            ok = ~capo & (L > 1e-6); s.capi += int(capo.sum()); SA.append(A[ok]); SB.append(B[ok]); ZA.append(za[ok]); ZB.append(zb[ok])
        s.A, s.B, s.za, s.zb = np.vstack(SA), np.vstack(SB), np.concatenate(ZA), np.concatenate(ZB)
        s.T = STRtree(shapely.linestrings(np.stack((s.A, s.B), 1)))

    def dentro(s, P):
        m = np.zeros(len(P), bool)
        for u in s.U: m |= shapely.contains_xy(u, P[:, 0], P[:, 1])
        return m

    def raggi(s, P, U, z):
        """la distanza dal punto P (quota z) lungo U al primo tratto di contorno che lì sta alla sua quota; RMAX se non ne incontra"""
        out = np.full(len(P), RMAX)
        if not len(P): return out
        ri, si, t, u = _incontri(s.T, s.A, s.B, P, U); ok = (t >= 0) & (np.abs(s.za[si] + (s.zb[si] - s.za[si]) * np.clip(u, 0, 1) - z[ri]) < DZ)
        np.minimum.at(out, ri[ok], np.minimum(t[ok], RMAX))
        return out


def _bordo_pulito(d):
    """un bordo misurato lungo il nastro (NaN dove l'asse non sta sull'asfalto): portato dritto sulle aperture, lisciato. Rende (bordo, portato)"""
    n = len(d); ok = ~np.isnan(d)
    if not ok.any(): return np.zeros(n), np.ones(n, bool)
    x = np.arange(n); f = np.interp(x, x[ok], d[ok])
    k = min(APRE, n if n % 2 else n - 1) if n > 2 else 1
    ap = maximum_filter1d(minimum_filter1d(f, k, mode='nearest'), k, mode='nearest') if k > 1 else f
    port = ~ok | (f > ap + APRE_DI) | (f >= RMAX - 1e-6)
    if port.all(): port = ~ok | (f >= RMAX - 1e-6)
    if port.all(): return np.zeros(n), port
    g = np.interp(x, x[~port], f[~port])
    return (_liscia(g, LISCIA, g) if n > 4 * LISCIA else g), port


def _sfoltisci(V, fissi, tol):
    """gli indici delle stazioni da tenere: le altre stanno entro tol dalla retta fra le due tenute (Douglas-Peucker su tutte le colonne di V)"""
    n = len(V); keep = np.zeros(n, bool); keep[0] = keep[-1] = True; keep[fissi] = True
    ks = np.nonzero(keep)[0]; pila = [(int(a), int(b)) for a, b in zip(ks[:-1], ks[1:])]
    while pila:
        a, b = pila.pop()
        if b - a < 2: continue
        t = (np.arange(a + 1, b) - a)[:, None] / (b - a); e = np.abs(V[a + 1:b] - (V[a] + (V[b] - V[a]) * t)).max(1); j = int(e.argmax())
        if e[j] > tol: m = a + 1 + j; keep[m] = True; pila += [(a, m), (m, b)]
    return np.nonzero(keep)[0]


def _ricuci(els, log=print):
    """Dove l'asse si interrompe (al confine fra due comuni ognuno finisce il suo, e in mezzo resta un buco: via Vignazzola x -260 z 689, proprio su un
    ponte): due capi liberi che si guardano entro CUCI m, ognuno nella direzione dell'altro (entro 20 gradi) e alla stessa quota, sono la stessa
    strada. Rende gli elementi che li uniscono, a raso (se sotto non c'è terra lo dice il terreno, ponti_nastro.py)"""
    key = lambda p: (int(round(p[0] * 20)), int(round(p[1] * 20))); n = collections.Counter(); capi = []
    for e in els: n[key(e['xy'][0])] += 1; n[key(e['xy'][-1])] += 1
    for e in els:
        for p, q, z in ((e['xy'][0], e['xy'][1], e['z'][0]), (e['xy'][-1], e['xy'][-2], e['z'][-1])):
            if n[key(p)] == 1 and not np.isnan(z): v = np.subtract(p, q); capi.append((np.asarray(p, float), v / (np.hypot(*v) or 1), float(z)))
    if len(capi) < 2: return []
    P = np.array([c[0] for c in capi]); T = cKDTree(P); out = []; usati = set()
    for i, j in sorted(T.query_pairs(CUCI), key=lambda ij: np.hypot(*(P[ij[0]] - P[ij[1]]))):
        if i in usati or j in usati: continue
        d = P[j] - P[i]; L = np.hypot(*d)
        if L < 0.06 or capi[i][1] @ d / L < 0.94 or capi[j][1] @ -d / L < 0.94 or abs(capi[i][2] - capi[j][2]) > 1.5: continue
        usati |= {i, j}; out.append(dict(xy=np.array([P[i], P[j]]), z=np.array([capi[i][2], capi[j][2]]), sede=RASO, id=-1 - len(out)))
    log('nastri: assi ricuciti dove si interrompono: %d (%s)' % (len(out), ', '.join('x %.0f z %.0f %.0f m' % (*((e['xy'][0] + e['xy'][1]) / 2), np.hypot(*(e['xy'][1] - e['xy'][0]))) for e in out[:12])))
    return out


def calcola(D, base=0.0, log=print):
    """i nastri dal DBGT letto da dbgt_quote (EL_STR e AC_VEI): [{i, el, xy, y, s, sede, n, sx, dx, portato_sx, portato_dx, fuori}], una stazione al
    metro; y in m sopra base, n il versore a sinistra di chi va lungo l'asse, sx e dx le distanze dei due bordi dall'asse (0 dove non c'è carreggiata)"""
    E = D['EL_STR']; els = []
    for i in range(len(E['off']) - 1):
        a, b = E['off'][i], E['off'][i + 1]
        if b - a < 2: continue
        els.append(dict(xy=E['xy'][a:b], z=E['z'][a:b], sede=_sede(E['attr']['sed'][i], E['attr']['liv'][i]), id=int(E['id'][i])))
    els += _ricuci(els, log)
    V = D['AC_VEI']; zon = np.array([str(z or '') for z in V['attr']['zon']]); sed = np.array([str(s_ or '') for s_ in V['attr']['sed']])
    carr = np.array([z[:2] in ('01', '02') for z in zon]); su = {PONTE: sed == '02', GALLERIA: sed == '03'}; raso = ~(su[PONTE] | su[GALLERIA])
    C = _Carreggiata({RASO: _poligoni(V, carr & raso), PONTE: _poligoni(V, carr & su[PONTE]), GALLERIA: _poligoni(V, carr & su[GALLERIA])})
    tutto = _Bordo([p for p, _ in _poligoni(V, raso)])
    N = []
    for ch in strokes(els):
        xs, zs, ss = [], [], []
        for k, (j, rev) in enumerate(ch):
            e = els[j]; xy, z = (e['xy'][::-1], e['z'][::-1]) if rev else (e['xy'], e['z']); o = 1 if k else 0
            xs.append(xy[o:]); zs.append(z[o:]); ss.append(np.full(len(xy) - o, e['sede']))
        xy = np.vstack(xs); z = np.concatenate(zs); sv = np.concatenate(ss)   # sv[k]: la sede del tratto che arriva al vertice k
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
        if d[-1] < 2 * PASSO: continue
        s = np.linspace(0, d[-1], int(round(d[-1] / PASSO)) + 1)
        P = np.column_stack((np.interp(s, d, xy[:, 0]), np.interp(s, d, xy[:, 1]))); y = np.interp(s, d, z) - base
        sede = sv[np.clip(np.searchsorted(d, s, side='left'), 1, len(d) - 1)]
        t = np.gradient(P, axis=0); t /= np.maximum(np.hypot(t[:, 0], t[:, 1]), 1e-9)[:, None]
        N.append(dict(el=[els[j]['id'] for j, _ in ch], xy=P, y=y, s=s, sede=sede.astype(np.int8), n=np.column_stack((t[:, 1], -t[:, 0]))))   # n: a sinistra di chi va (x est, z sud)
    # i bordi, tutte le stazioni insieme
    P = np.vstack([n['xy'] for n in N]); Sx = np.vstack([n['n'] for n in N]); Z = np.concatenate([n['y'] for n in N]) + base
    dl = np.full(len(P), np.nan); dr = dl.copy()
    m = C.dentro(P); dl[m] = C.raggi(P[m], Sx[m], Z[m]); dr[m] = C.raggi(P[m], -Sx[m], Z[m])
    m2 = ~m; m2[m2] = tutto.dentro(P[m2]); dl[m2] = tutto.raggi(P[m2], Sx[m2]); dr[m2] = tutto.raggi(P[m2], -Sx[m2])
    o = 0
    for i, n in enumerate(N):
        k = len(n['xy']); n['i'] = i
        n['sx'], n['portato_sx'] = _bordo_pulito(dl[o:o + k]); n['dx'], n['portato_dx'] = _bordo_pulito(dr[o:o + k]); n['fuori'] = np.isnan(dl[o:o + k]); o += k
    log('nastri: %d, %.1f km; capi di ponte tolti dal contorno: %d tratti' % (len(N), sum(n['s'][-1] for n in N) / 1000, C.capi))
    return N


class Indice:
    """i nastri cercati dal punto (per le regole della build che mettono le cose della strada sul loro nastro, docs/nastri.md passo 3)"""
    def __init__(s, N):
        s.N = N; s.P = np.vstack([n['xy'] for n in N]); s.ni = np.concatenate([np.full(len(n['xy']), i) for i, n in enumerate(N)])
        s.k = np.concatenate([np.arange(len(n['xy'])) for n in N]); s.T = cKDTree(s.P)

    def stazioni(s, p, r):
        """(nastro, stazione) di tutte le stazioni entro r da p"""
        j = s.T.query_ball_point(np.asarray(p, float), r); return s.ni[j], s.k[j]

    def lungo(s, p, d, r=6.0, cos=0.8):
        """il nastro che passa vicino a p e corre lungo d: (nastro, stazione più vicina), o None"""
        p = np.asarray(p, float); best = None
        for j in s.T.query_ball_point(p, r):
            n = s.N[s.ni[j]]['n'][s.k[j]]
            if abs(-n[1] * d[0] + n[0] * d[1]) < cos: continue
            dd = float(np.hypot(*(s.P[j] - p)))
            if best is None or dd < best[0]: best = (dd, int(s.ni[j]), int(s.k[j]))
        return best[1:] if best else None

    def striscia(s, i, a, b):
        """la carreggiata del nastro i fra le stazioni a e b (un poligono)"""
        n = s.N[i]; a = max(0, a); b = min(len(n['xy']) - 1, b)
        if b - a < 1: return Polygon()
        return Polygon(np.vstack((n['xy'][a:b + 1] + n['n'][a:b + 1] * n['sx'][a:b + 1, None], (n['xy'][a:b + 1] - n['n'][a:b + 1] * n['dx'][a:b + 1, None])[::-1]))).buffer(0)

    def di_linea(s, P, alto=False, r=8.0, fuori=1.5):
        """il nastro lungo cui corre la linea P (una riga, un cordolo): quello che ha più stazioni vicine e parallele a lei, entro i suoi bordi; se sono più d'uno uno
        sopra l'altro (la strada su un ponte e quella sotto), il più alto se alto, altrimenti il più basso. None se non corre lungo nessun nastro. fuori: quanto
        la linea può stare oltre il bordo del nastro (uno spartitraffico sta fuori dalla carreggiata)"""
        P = np.asarray(P, float)
        if len(P) < 2: return None
        dd = np.r_[0, np.cumsum(np.hypot(*np.diff(P, axis=0).T))]
        if dd[-1] < 0.5: return None
        ss = np.linspace(0, dd[-1], max(3, min(40, int(dd[-1] / 4) + 2))); Q = np.column_stack((np.interp(ss, dd, P[:, 0]), np.interp(ss, dd, P[:, 1])))
        d = np.gradient(Q, axis=0); d /= np.maximum(np.hypot(*d.T), 1e-9)[:, None]; voti = collections.Counter(); ys = collections.defaultdict(float)
        for i, l in enumerate(s.T.query_ball_point(Q, r)):
            best = {}
            for j in l:
                n = s.N[s.ni[j]]; k = s.k[j]; nn = n['n'][k]
                if abs(-nn[1] * d[i][0] + nn[0] * d[i][1]) < 0.9: continue
                lat = (Q[i] - s.P[j]) @ nn
                if lat > n['sx'][k] + fuori or lat < -n['dx'][k] - fuori: continue
                e = float(np.hypot(*(Q[i] - s.P[j])))
                if s.ni[j] not in best or e < best[s.ni[j]][0]: best[int(s.ni[j])] = (e, float(n['y'][k]))
            for ni, (e, y) in best.items(): voti[ni] += 1; ys[ni] += y
        if not voti: return None
        mx = max(voti.values()); cand = [ni for ni, v in voti.items() if v >= 0.6 * mx]; ym = {ni: ys[ni] / voti[ni] for ni in cand}
        q = max(ym.values()) if alto else min(ym.values()); cand = [ni for ni in cand if abs(ym[ni] - q) < 1.5]
        return int(s.N[max(cand, key=lambda ni: voti[ni])]['i'])

    def accanto(s, P, r=3.5):
        """i nastri che hanno un bordo misurato entro r dalla linea P e corrono lungo di lei (il new jersey fra due carreggiate: tutti e due)"""
        P = np.asarray(P, float)
        if len(P) < 2: return []
        T, E, U, Tg, I, Y = s.bordi(); d = np.gradient(P, axis=0); d /= np.maximum(np.hypot(*d.T), 1e-9)[:, None]; v = collections.Counter(); st = max(1, len(P) // 30)
        for i, l in zip(range(0, len(P), st), T.query_ball_point(P[::st], r)):
            for ni in {int(I[j]) for j in l if abs(Tg[j] @ d[i]) > 0.9}: v[ni] += 1
        if not v: return []
        mx = max(v.values()); return sorted(int(s.N[ni]['i']) for ni, c in v.items() if c >= 0.4 * mx)

    def bordi(s):
        """i punti di bordo di tutti i nastri, misurati (non portati dritti su un'apertura): (albero, punti, versore verso fuori, versore lungo l'asse, nastro, quota)"""
        if not hasattr(s, '_b'):
            E, U, T_, I, Y = [], [], [], [], []
            for i, n in enumerate(s.N):
                tg = np.column_stack((-n['n'][:, 1], n['n'][:, 0]))
                for sg, w, pt in ((1, n['sx'], n['portato_sx']), (-1, n['dx'], n['portato_dx'])):
                    ok = ~pt & ~n['fuori'] & (w > 0.3)
                    E.append(n['xy'][ok] + n['n'][ok] * sg * w[ok, None]); U.append(n['n'][ok] * sg); T_.append(tg[ok]); I.append(np.full(int(ok.sum()), i)); Y.append(n['y'][ok])
            E = np.vstack(E); s._b = (cKDTree(E), E, np.vstack(U), np.vstack(T_), np.concatenate(I), np.concatenate(Y))
        return s._b

    def sezione(s, i, st):
        """alla distanza st lungo il nastro i: (punto dell'asse, versore lungo l'asse, bordo a sinistra, bordo a destra, quota)"""
        n = s.N[i]; S = n['s']; st = float(np.clip(st, S[0], S[-1])); f = lambda a: float(np.interp(st, S, a))
        nx, nz = f(n['n'][:, 0]), f(n['n'][:, 1]); L = math.hypot(nx, nz) or 1.0
        return (f(n['xy'][:, 0]), f(n['xy'][:, 1])), (-nz / L, nx / L), f(n['sx']), f(n['dx']), f(n['y'])


def per_la_build(D, root, log=print):
    """i nastri per le regole della build (build_data.py). La build completa li calcola e li lascia in cache_build/nastri.pkl; la build attorno al punto (src/zona.py,
    che legge un DBGT ritagliato) prende quelli: gli stessi nastri con gli stessi numeri, che il gioco legge da mappa/nastri.bin della build completa"""
    import pickle
    f = os.path.join(root, 'cache_build', 'nastri.pkl')
    if os.environ.get('GTA_COSTANTI_LEGGI'):
        f = os.path.join(os.path.dirname(os.environ['GTA_COSTANTI_LEGGI']), 'cache_build', 'nastri.pkl')
        if os.path.exists(f): N = pickle.load(open(f, 'rb')); log('nastri: %d dalla build completa' % len(N)); return N
        log('ATTENZIONE: manca cache_build/nastri.pkl della build completa: i nastri si calcolano sul pezzo, i loro numeri possono non essere quelli di mappa/nastri.bin')
        return calcola(D, 0.0, log)
    N = calcola(D, 0.0, log); os.makedirs(os.path.dirname(f), exist_ok=True); pickle.dump(N, open(f, 'wb'))
    return N


def _nomi(N, B):
    """il nome della via OSM che corre sul nastro (la più frequente entro 8 m da cinque sue stazioni)"""
    nd = np.array(B['nodes'], float).reshape(-1, 3)[:, :2] / 10; pts, nm = [], []
    for r in B['roads']:
        if r.get('n', -1) < 0 or r.get('t'): continue
        g = nd[r['g']]; d = np.r_[0, np.cumsum(np.hypot(*np.diff(g, axis=0).T))]; s = np.arange(0, d[-1] + 4, 4.0).clip(0, d[-1])
        pts.append(np.column_stack((np.interp(s, d, g[:, 0]), np.interp(s, d, g[:, 1])))); nm += [r['n']] * len(s)
    if not pts: return
    T = cKDTree(np.vstack(pts)); nm = np.array(nm)
    for n in N:
        q = n['xy'][np.linspace(0, len(n['xy']) - 1, 5).astype(int)]; dd, ii = T.query(q, distance_upper_bound=8.0)
        c = Counter(int(nm[i]) for d_, i in zip(dd, ii) if np.isfinite(d_))
        n['nome'] = B['names'][c.most_common(1)[0][0]] if c else ''


def _tratti(m):
    out = []; i = 0; k = len(m)
    while i < k:
        if not m[i]: i += 1; continue
        j = i
        while j < k and m[j]: j += 1
        out.append((i, j)); i = j
    return out


def scrivi(N, root, base, log=print):
    cm = lambda a: np.round(np.asarray(a) * 100).astype(int)
    out = []; km = Counter(); st0 = st1 = 0; senza = []; portati = []
    for n in N:
        V = np.column_stack((n['xy'], n['y'], n['xy'] + n['n'] * n['sx'][:, None], n['xy'] - n['n'] * n['dx'][:, None])); cambia = np.nonzero(np.diff(n['sede']) != 0)[0]
        ks = _sfoltisci(V, np.unique(np.r_[cambia, cambia + 1]).astype(int), FINO); st0 += len(V); st1 += len(ks)
        out.append(dict(i=n['i'], n=n.get('nome', ''), a=cm(V[ks]).ravel().tolist(), s=''.join(str(int(c)) for c in n['sede'][ks])))
        for c in range(4): km[SEDI[c]] += float((n['sede'][1:] == c).sum()) * PASSO / 1000
        mid = lambda a, b: [round(float(n['xy'][(a + b) // 2][0]), 1), round(float(n['xy'][(a + b) // 2][1]), 1)]
        for a, b in _tratti(n['fuori']):
            if b - a >= 10: senza.append(dict(nastro=n['i'], nome=n.get('nome', ''), m=b - a, x=mid(a, b)[0], z=mid(a, b)[1], link='?x=%.0f&z=%.0f&debug=1&nastri=1' % tuple(mid(a, b))))
        for lato in ('sx', 'dx'):
            for a, b in _tratti(n['portato_' + lato] & ~n['fuori']):
                if b - a >= 10: portati.append(dict(nastro=n['i'], nome=n.get('nome', ''), lato=lato, m=b - a, x=mid(a, b)[0], z=mid(a, b)[1], link='?x=%.0f&z=%.0f&debug=1&nastri=1' % tuple(mid(a, b))))
    os.makedirs(os.path.join(root, 'mappa'), exist_ok=True)
    j = json.dumps(dict(ver=1, sedi=SEDI, nota='a: sette numeri per stazione, in cm: x, z, y dell asse (y sopra terrain.base), x, z del bordo sinistro, x, z del bordo destro (alla stessa y); s: la sede di ogni stazione', nastri=out), ensure_ascii=False, separators=(',', ':')).encode('utf-8')
    o = io.BytesIO()
    with gzip.GzipFile(filename='', mode='wb', fileobj=o, compresslevel=9, mtime=0) as f: f.write(j)
    open(os.path.join(root, 'mappa', 'nastri.bin'), 'wb').write(o.getvalue())
    larg = np.concatenate([(n['sx'] + n['dx'])[~n['fuori']] for n in N]) if N else np.zeros(1)
    rep = dict(definizione='i nastri delle carreggiate (src/nastri.py, docs/nastri.md passo 1): asse EL_STR con le quote, bordi misurati sull AC_VEI alla stessa quota, sede per stazione',
               nastri=len(N), km=round(sum(km.values()), 2), km_per_sede={k: round(v, 3) for k, v in km.items()}, stazioni=st0, stazioni_nel_file=st1, kb=len(o.getvalue()) // 1024,
               larghezza_m=dict(mediana=round(float(np.median(larg)), 2), p5=round(float(np.percentile(larg, 5)), 2), p95=round(float(np.percentile(larg, 95)), 2)),
               asse_fuori_dall_asfalto=dict(definizione='tratti di almeno 10 m in cui l asse non sta su nessun AC_VEI: lì il nastro non ha bordi misurati (portati dai tratti vicini, 0 se non ce ne sono)',
                                            tratti=len(senza), m=sum(c['m'] for c in senza), posti=sorted(senza, key=lambda c: -c['m'])[:60]),
               bordo_portato=dict(definizione='tratti di almeno 10 m in cui un bordo non segue l asfalto perché si apre (imbocchi, incroci, piazzali): portato dritto fra prima e dopo',
                                  tratti=len(portati), m=sum(c['m'] for c in portati), posti=sorted(portati, key=lambda c: -c['m'])[:60]))
    json.dump(rep, open(os.path.join(root, 'report_nastri.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    log('nastri: %(nastri)d, %(km).1f km' % rep + ' (' + ', '.join('%s %.2f' % kv for kv in rep['km_per_sede'].items()) + '); stazioni %d, nel file %d (%d kB); asse fuori dall\'asfalto %d m, bordo portato %d m'
        % (st0, st1, rep['kb'], rep['asse_fuori_dall_asfalto']['m'], rep['bordo_portato']['m']))
    return rep


def main(root=ROOT):
    t0 = time.time(); B = json.load(open(os.path.join(root, 'brianza.json'), encoding='utf-8')); base = B['terrain'].get('base', 0.0)
    D = dq.load_dbgt_comuni(dq.lista_comuni(None), dq.Lidar())
    N = calcola(D, base); _nomi(N, B); scrivi(N, root, base)
    print('nastri: %.0f s' % (time.time() - t0))
    return N


if __name__ == '__main__': main(os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else ROOT)
