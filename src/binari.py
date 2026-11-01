# The tracks have a height of their own (Carlo, 31/10, viale Francia: "binari ondulati"). A pass of the lisciatore (src/lisciatore.py), before bordo_barriere.
# Why: along viale Francia the near rail lies 2 m from a carriageway 50 cm lower. A cell of the 2 m lattice has corners on both, so no choice of nodes gives both a straight rail
# and a flat street: draped on S, the rail read now one level and now the other. So:
#   - profilo(): one height along each track, once, from S on the axis (the DBGT EL_FER height, burned), smoothed along the network as a railway is (a penalty on the
#     second difference, Huber on the outliers), joined at the switches, tied between parallel tracks, held at the level crossings (the street's height) and by the decks
#   - quota(): the ground under it follows: the corners of the cells under the sleepers and under a fence near the tracks, and the rail bed, take the profile; a carriageway does not
#     move (only at a level crossing, faded along the street); the free nodes around stay within 1 : K of it. What cannot follow (a carriageway under a rail) goes in the report
#   - the game (src/altezze3.js H.railY, src/world3.js) draws rails, sleepers and ballast on the profile, with a shoulder down into S, and H.ground and H.surface read it on the
#     strip of the ballast: physics and drawing read the same height. It is written in terreno/indice.json (binari)
import numpy as np, shapely
from collections import defaultdict
from scipy import ndimage, sparse
import scipy.sparse.linalg

SF = 2.0
LAMBDA = 2e4       # the penalty on the second difference (2 m samples): wavelengths under about 60 m go, a railway's vertical curves stay
MU = 200.0         # the tie between two tracks side by side
LINK_D = 6.0       # m: tracks this close are side by side ...
LINK_DZ = 0.6      # ... if their heights are this close (else one passes over the other)
HUBER = 0.08       # m: a sample further than this from the profile counts less and less (the teeth of S on the axis)
PESO_ANCORA = 100.0   # the weight of a level crossing and of the approach to a deck, against 1 for an ordinary sample. One height for each (the median of its samples): two anchors 4 m apart a few dm off would force a grade, and the curve swings metres away from it
PENDENZA = 2.0     # a small penalty on the grade itself: no swing where the data is missing
MED_W = 31         # samples (60 m): the median along the track an outlier is judged on ...
MED_DZ = 0.5       # m: ... a sample this far off is not the track: a road embankment that S carries across it, x -1120 z 51 (weight 0)
PESO_STRADA = 0.05 # a sample whose nearest node is a carriageway beside the track: it read the street
DECK_NEAR = 6.0    # m from a railway deck: the approach, held at S (the spalle rest on it)
PONTE_NEAR = 8.0   # m from anything else a bridge, a cover: held too (weight below): the track passes under it or on it at the level of S
W_SLEEPERS = 1.35  # m from the axis: the corners of the cells this touches take the profile
FENCE_MAX = 6.5    # m from a track: a fence this near has the ground flat up to it, on the corners of its cells
STEP_MAX = 1.5     # m: a node never moves more than this (over it: a true wall, listed)
SHELF_MAX = 0.7    # m: the same for the nodes that are there only for a fence
BED_R = 8.0        # m from an axis: a node of the rail bed takes the profile
K = 1.5            # the free nodes around stay within 1 : K of what moved
BAND = 8.0         # m: ... this far from it
LX_FULL, LX_FADE = 2.5, 9.0   # m from the axis at a level crossing: the street at the profile, then back to its own height
BLEND = 4.0        # the same blend as Assi.valuta and H.railY: axes within d_min + BLEND
PASSO_GIOCO = 4.0  # m between the samples written for the game


def catene(B):
    """the tracks of the tiles (rl) joined again: lists of points between the switches and the ends"""
    dec = lambda a: np.cumsum(np.asarray(a, float).reshape(-1, 2), axis=0) / 10
    pcs = [dec(r['p']) for T in B['tiles'] for r in T.get('rl', [])]; pcs = [p for p in pcs if len(p) >= 2]
    key = lambda p: (int(round(p[0] * 2)), int(round(p[1] * 2))); ends = defaultdict(list)
    for i, p in enumerate(pcs): ends[key(p[0])].append((i, 0)); ends[key(p[-1])].append((i, 1))
    seen = set(); out = []
    def walk(i, e):
        o = []
        while True:
            seen.add(i); p = pcs[i] if e == 0 else pcs[i][::-1]; o.append(p if not o else p[1:]); k = key(p[-1]); nb = [a for a in ends[k] if a[0] not in seen]
            if len(ends[k]) != 2 or not nb: return np.vstack(o)
            i, e = nb[0]
    for i, p in enumerate(pcs):
        for e in (0, 1):
            if i not in seen and len(ends[key(p[0] if e == 0 else p[-1])]) != 2: out.append(walk(i, e))
    for i in range(len(pcs)):
        if i not in seen: out.append(walk(i, 0))
    return out, key


def maschera_ponti_ferro(s):
    """the nodes of the PONTE that carry a railway (EL_FER on a deck): the tracks there are the deck's"""
    import superficie as sf, dbgt_quote as dq
    R = s.R; M = np.zeros((R.nz, R.nx), bool); L = s.D['EL_FER']; dk = dq.is_deck('EL_FER', L); assi = []
    for i in range(len(L['off']) - 1):
        if dk[i]:
            a, b = L['off'][i], L['off'][i + 1]
            if b - a >= 2: assi.append(shapely.linestrings(L['xy'][a:b]))
    if not assi: return M
    U = shapely.union_all(assi); P_ = s.D['PONTE']; polys = 0
    for i in range(len(P_['off']) - 1):
        P = sf.poly(P_, i)
        if P.is_empty or not P.intersects(U): continue
        w, m = s.raster(P.buffer(2.0, 2)); polys += 1
        if w is not None: M[w[0]:w[1], w[2]:w[3]] |= m
    s.binari_ponti = polys
    return M


def profilo(s, S, CARR, parti):
    """the profile of the network. Returns runs [dict(p, y)] (the stretches at grade, on the lattice), and what the terrain and the report need"""
    import superficie as sf
    R = s.R; ch, key = catene(s.B); PF = maschera_ponti_ferro(s); dpf = ndimage.distance_transform_edt(~PF, sampling=SF) if PF.any() else np.full(PF.shape, 1e9)
    dpo = ndimage.distance_transform_edt(~(parti['ponti'] & ~PF), sampling=SF)
    ass = []
    for T in s.B['tiles']:
        for a in T.get('as', []):
            o = np.cumsum(np.asarray(a['p'], float).reshape(-1, 2), axis=0) / 10
            if len(o) >= 3: ass.append(shapely.polygons(o))
    tree_as = shapely.STRtree(ass) if ass else None
    X, Z, W, Y0, CH, LX, nod = [], [], [], [], [], [], {}
    idx = []; n = 0; catene_ = []
    for ci, P in enumerate(ch):
        g = shapely.linestrings(P); ln = g.length
        if ln < 0.5: continue
        m = max(1, int(round(ln / SF))); u = np.linspace(0, ln, m + 1); Q = shapely.get_coordinates(shapely.line_interpolate_point(g, u))
        fx, fz = (Q[:, 0] - R.x0) / SF, (Q[:, 1] - R.z0) / SF; dentro = (fx >= 0) & (fz >= 0) & (fx < R.nx - 1) & (fz < R.nz - 1)
        ij = []
        for j in range(len(Q)):
            if j in (0, len(Q) - 1):
                k = key(Q[j])
                if k in nod: ij.append(nod[k]); continue
                nod[k] = n
            ij.append(n); n += 1
        ij = np.array(ij); catene_.append((ij, Q, dentro))
    X = np.full(n, np.nan); Z = np.full(n, np.nan); IN = np.zeros(n, bool); DK = np.zeros(n, bool); CHI = np.full(n, -1, int)
    for ci, (ij, Q, dentro) in enumerate(catene_):
        X[ij] = Q[:, 0]; Z[ij] = Q[:, 1]; IN[ij] = dentro; CHI[ij] = ci
    ok = np.nonzero(IN)[0]; r_, c_ = np.round((Z[ok] - R.z0) / SF).astype(int), np.round((X[ok] - R.x0) / SF).astype(int)
    DK[ok] = PF[r_, c_]
    y0 = np.full(n, np.nan); y0[ok] = sf.tri_interp(S, R, X[ok], Z[ok])
    W = np.zeros(n); W[ok] = 1.0; W[DK] = 0.0
    onr = np.zeros(n, bool); onr[ok] = CARR[r_, c_]
    # the level crossings: the axis on the asphalt drawn
    LXm = np.zeros(n, bool)
    if tree_as is not None:
        pts = shapely.points(X[ok], Z[ok]); a_, b_ = tree_as.query(pts, predicate='intersects'); LXm[ok[np.unique(a_)]] = True
    # a sample on a carriageway beside the track counts little; on an asphalt crossing it is the anchor
    W[onr & ~LXm & ~DK] = PESO_STRADA
    ANC = np.zeros(n, bool); ANC[LXm & ~DK] = True
    nearpf = np.zeros(n, bool); nearpf[ok] = (dpf[r_, c_] <= DECK_NEAR) & ~PF[r_, c_]; ANC |= nearpf
    nearpo = np.zeros(n, bool); nearpo[ok] = dpo[r_, c_] <= PONTE_NEAR; W[nearpo & ~ANC & ~DK] = 10.0
    # what is not the track: far from the median along it. No weight, and no anchor
    FUORI = np.zeros(n, bool)
    for ij, Q, dentro in catene_:
        k = np.nonzero(IN[ij] & ~DK[ij])[0]
        if len(k) < 2: continue
        v = np.interp(np.arange(len(ij)), k, y0[ij[k]]); m_ = ndimage.median_filter(v, size=MED_W, mode='nearest'); FUORI[ij[k]] |= np.abs(v[k] - m_[k]) > MED_DZ
    W[FUORI] = 0.0; ANC &= ~FUORI
    # one height for each anchor: the stretches of anchors along a track
    y0a = y0.copy()
    for ij, Q, dentro in catene_:
        i = 0
        while i < len(ij):
            if not ANC[ij[i]]: i += 1; continue
            j = i
            while j + 1 < len(ij) and ANC[ij[j + 1]]: j += 1
            y0a[ij[i:j + 1]] = np.median(y0[ij[i:j + 1]]); i = j + 1
    W[ANC] = PESO_ANCORA
    # the system: second differences along the tracks (only between samples at grade), ties between tracks side by side
    G = IN & ~DK; rows, cols, vals = [], [], []; nr = 0; r1, c1, v1 = [], [], []; n1 = 0
    for ij, Q, dentro in catene_:
        a, b, c = ij[:-2], ij[1:-1], ij[2:]; k = G[a] & G[b] & G[c]; a, b, c = a[k], b[k], c[k]; m = len(a)
        rows += [np.arange(nr, nr + m)] * 3; cols += [a, b, c]; vals += [np.ones(m), -2 * np.ones(m), np.ones(m)]; nr += m
        a, b = ij[:-1], ij[1:]; k = G[a] & G[b]; a, b = a[k], b[k]; m = len(a); r1 += [np.arange(n1, n1 + m)] * 2; c1 += [a, b]; v1 += [np.ones(m), -np.ones(m)]; n1 += m
    D2 = sparse.csr_matrix((np.concatenate(vals), (np.concatenate(rows), np.concatenate(cols))), shape=(nr, n)) if nr else sparse.csr_matrix((0, n))
    gi = np.nonzero(G)[0]; tr = shapely.STRtree(shapely.points(X[gi], Z[gi])); a_, b_ = tr.query(shapely.points(X[gi], Z[gi]), predicate='dwithin', distance=LINK_D)
    k = (CHI[gi[a_]] != CHI[gi[b_]]) & (a_ < b_) & (np.abs(y0[gi[a_]] - y0[gi[b_]]) < LINK_DZ); ia, ib = gi[a_[k]], gi[b_[k]]
    # the nearest sample of each other track only
    dd = np.hypot(X[ia] - X[ib], Z[ia] - Z[ib]); best = {}
    for p_, q_, d_ in zip(ia.tolist(), ib.tolist(), dd.tolist()):
        for ky in ((p_, CHI[q_]), (q_, CHI[p_])):
            if ky not in best or d_ < best[ky][2]: best[ky] = (p_, q_, d_)
    li = sorted({(a, b) for a, b, _ in best.values()}); m = len(li)
    L_ = sparse.csr_matrix((np.concatenate((np.ones(m), -np.ones(m))), (np.concatenate((np.arange(m), np.arange(m))), np.concatenate(([a for a, _ in li], [b for _, b in li])))), shape=(m, n)) if m else sparse.csr_matrix((0, n))
    D1 = sparse.csr_matrix((np.concatenate(v1), (np.concatenate(r1), np.concatenate(c1))), shape=(n1, n)) if n1 else sparse.csr_matrix((0, n))
    A0 = LAMBDA * (D2.T @ D2) + PENDENZA * (D1.T @ D1) + MU * (L_.T @ L_)
    y = np.nan_to_num(y0).copy(); act = G | (A0.diagonal() > 0); act = np.nonzero(G)[0]; w_ = W.copy()
    z_ = np.nan_to_num(y0a)
    for it in range(5):
        A = (A0 + sparse.diags(w_ + 1e-9)).tocsc()[act][:, act]; sol = scipy.sparse.linalg.spsolve(A, (w_ * z_)[act]); y[act] = sol
        res = np.abs(y - z_); hub = np.where(res > HUBER, HUBER / np.maximum(res, 1e-6), 1.0); w_ = W * hub; w_[ANC] = PESO_ANCORA
    # the runs at grade, for the terrain and for the game
    runs = []
    for ij, Q, dentro in catene_:
        g_ = G[ij]; i = 0
        while i < len(ij):
            if not g_[i]: i += 1; continue
            j = i
            while j + 1 < len(ij) and g_[j + 1]: j += 1
            if j > i: runs.append(dict(p=Q[i:j + 1], y=y[ij[i:j + 1]]))
            i = j + 1
    fu = FUORI & G; s.binari_fuori = [dict(x=round(float(X[i]), 1), z=round(float(Z[i]), 1), S_meno_profilo=round(float(y0[i] - y[i]), 2)) for i in np.nonzero(fu)[0][::5]]
    info = dict(n=int(G.sum()), catene=len(catene_), campioni_che_non_sono_il_binario=int(fu.sum()), legami_fra_binari=m, passaggi_a_livello_campioni=int((LXm & G).sum()), ponti_ferroviari=getattr(s, 'binari_ponti', 0),
                scarto_da_S_m=sf.pct(np.abs(y - z_)[G & ~FUORI], (50, 90, 99, 100)), scarto_ancore_m=sf.pct(np.abs(y - z_)[G & ANC], (50, 90, 99, 100)))
    if getattr(s, 'L', None) is not None:
        info['scarto_dal_lidar_m'] = sf.pct((y - sf.tri_interp(s.L, R, np.nan_to_num(X), np.nan_to_num(Z)))[G], (1, 50, 99))
    # grades and vertical radii of the runs (sampled on 20 m: what a railway is judged on)
    gr, rg = [], []
    for r in runs:
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(r['p'], axis=0).T))]
        if d[-1] < 40: continue
        u = np.arange(0, d[-1], 20.0); v = np.interp(u, d, r['y']); g1 = np.diff(v) / 20.0; gr.append(np.abs(g1)); rg.append(np.abs(np.diff(g1)) / 20.0)
    if gr:
        info['pendenza_per_mille'] = sf.pct(np.concatenate(gr) * 1000, (50, 99, 100))
        cv = np.concatenate(rg); info['raggio_verticale_minimo_m'] = int(1.0 / max(cv.max(), 1e-6))
    return runs, dict(X=X, Z=Z, G=G, LX=LXm & G, y=y), info


class _Assi:  # the profile as Assi.valuta wants it
    def __init__(s, runs):
        A, B, za, zb = [], [], [], []
        for r in runs: A.append(r['p'][:-1]); B.append(r['p'][1:]); za.append(r['y'][:-1]); zb.append(r['y'][1:])
        s.A, s.B, s.za, s.zb = np.vstack(A), np.vstack(B), np.concatenate(za), np.concatenate(zb); s.tree = shapely.STRtree(shapely.linestrings(np.stack((s.A, s.B), 1)))
    def valuta(s, x, z, blend=BLEND, passo=64):
        """height at the points and distance to the nearest axis; the same formula as H.railY"""
        import superficie as sf
        h, dm = np.full(len(x), np.nan), np.full(len(x), np.inf); c = (np.floor(x / passo).astype(int), np.floor(z / passo).astype(int))
        for key in set(zip(c[0].tolist(), c[1].tolist())):
            k = np.nonzero((c[0] == key[0]) & (c[1] == key[1]))[0]; bx = shapely.box(key[0] * passo - 16, key[1] * passo - 16, (key[0] + 1) * passo + 16, (key[1] + 1) * passo + 16); js = s.tree.query(bx)
            if not len(js): continue
            h[k], dm[k] = sf.Assi.valuta(s, np.sort(js), x[k], z[k], blend)
        return h, dm


def _segna_celle(R, sh, Q, M):
    """the four corners of the cells of the points Q"""
    c0, r0 = np.floor((Q[:, 0] - R.x0) / SF).astype(int), np.floor((Q[:, 1] - R.z0) / SF).astype(int)
    for a in (0, 1):
        for b in (0, 1):
            r, c = r0 + a, c0 + b; ok = (r >= 0) & (c >= 0) & (r < sh[0]) & (c < sh[1]); M[r[ok], c[ok]] = True


def quota(s, S, parti, CARR, log=print):
    """the profile, and the nodes under it. Returns S, the nodes moved, the report; s.binari the runs for the game, s.BIN_T the height of the profile at the nodes near the tracks"""
    import superficie as sf
    R = s.R; sh = S.shape; rep = {}
    runs, q, rep['profilo'] = profilo(s, S, CARR, parti); s.binari = runs; AX = _Assi(runs)
    # the nodes near the tracks, the profile on them
    tr = np.zeros(sh, bool); pts = np.vstack([r['p'] for r in runs]); rr = np.round((pts[:, 1] - R.z0) / SF).astype(int); cc = np.round((pts[:, 0] - R.x0) / SF).astype(int); tr[rr, cc] = True
    dn = ndimage.distance_transform_edt(~tr, sampling=SF); near = np.nonzero(dn <= BED_R + 2)
    T = np.full(sh, np.nan); D = np.full(sh, np.inf); xn, zn = R.x0 + near[1] * SF, R.z0 + near[0] * SF; T[near], D[near] = AX.valuta(xn, zn); s.BIN_T = T
    # the corners of the cells under the sleepers
    CORE = np.zeros(sh, bool)
    for r in runs:
        g = shapely.linestrings(r['p']); ln = g.length; u = np.arange(0, ln + 0.25, 0.5); P = shapely.get_coordinates(shapely.line_interpolate_point(g, u)); P2 = shapely.get_coordinates(shapely.line_interpolate_point(g, np.minimum(u + 0.25, ln)))
        t = P2 - P; t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]; N = np.column_stack((t[:, 1], -t[:, 0]))
        for o in np.linspace(-W_SLEEPERS, W_SLEEPERS, 7): _segna_celle(R, sh, P + N * o, CORE)
    # ... and of the fences near a track
    dec = lambda a: np.cumsum(np.asarray(a, float).reshape(-1, 2), axis=0) / 10; SHELF = np.zeros(sh, bool); lines = shapely.union_all([shapely.linestrings(r['p']) for r in runs]); shapely.prepare(lines)
    for T_ in s.B['tiles']:
        L_ = [dec(f['p']) for f in T_.get('fe', [])] + [dec(b['p']) for b in T_.get('ba', []) if b.get('t') == 6]
        for p in L_:
            if len(p) < 2: continue
            g = shapely.linestrings(p); u = np.arange(0, g.length + 0.25, 0.5); Pf = shapely.get_coordinates(shapely.line_interpolate_point(g, u)); k = shapely.distance(shapely.points(Pf), lines) <= FENCE_MAX
            if k.any(): _segna_celle(R, sh, Pf[k], SHELF)
    SHELF &= ~CORE
    # the rail bed
    FIX = s.RANK > 0; BED = FIX & (s.CLS == sf.C_FER) & (D <= BED_R)
    bed = (np.isin(s.CLS, (sf.C_ALV, sf.C_ARG)) & FIX) | s.TORR | s.ALVCOP
    dk = parti['ponti'] | parti['ram']; NO = s.CASE_LISC_ | ndimage.binary_dilation(dk, iterations=1) | bed | ~np.isfinite(T) | (D > BED_R + 1)
    d = np.nan_to_num(T - S, nan=0.0)
    M = ((CORE | BED) & ~NO & ~CARR & (np.abs(d) <= STEP_MAX)) | (SHELF & ~NO & ~FIX & (np.abs(d) <= SHELF_MAX))
    Sn = S.copy(); Sn[M] = T[M]
    # the level crossings: the street at the profile on the tracks, back to its own height along it
    LXK = np.zeros(sh, bool); xl, zl = q['X'][q['LX']], q['Z'][q['LX']]
    if len(xl):
        rr = np.round((zl - R.z0) / SF).astype(int); cc = np.round((xl - R.x0) / SF).astype(int); LXK[rr, cc] = True
        dl = ndimage.distance_transform_edt(~LXK, sampling=SF); k = CARR & (dl <= LX_FADE + 2) & np.isfinite(T) & (D <= LX_FADE) & ~NO
        f = np.clip((LX_FADE - D) / (LX_FADE - LX_FULL), 0, 1); Sn[k] = (S + (T - S) * f)[k]; ML = k & (np.abs(Sn - S) > 0.005); M |= ML
        rep['passaggi_a_livello'] = dict(nodi_di_strada=int(ML.sum()), mossi_m=sf.pct(np.abs(Sn - S)[ML], (50, 90, 100)) if ML.any() else {})
    # the free nodes around: no steeper than 1 : K from what moved
    mv = M & (np.abs(Sn - S) > 0.01)
    if mv.any():
        dm, (ri, ci) = ndimage.distance_transform_edt(~mv, sampling=SF, return_indices=True); Tn = Sn[ri, ci]; free = ~FIX & ~M & ~NO & (dm <= BAND) & ~s.CASE_LISC_
        lo, hi = Tn - dm / K, Tn + dm / K; Y = np.where(free, np.clip(np.clip(S, lo, hi), S - STEP_MAX, S + STEP_MAX), S); Sn = np.where(free, Y, Sn); M2 = free & (np.abs(Y - S) > 0.005)
    else: M2 = np.zeros(sh, bool)
    dS = (Sn - S)
    rep['terreno'] = dict(nodi_sul_profilo=int(M.sum()), nodi_attorno=int(M2.sum()), mossi_sul_profilo_m=sf.pct(np.abs(dS)[M], (50, 90, 99, 100)), mossi_attorno_m=sf.pct(np.abs(dS)[M2], (50, 90, 100)) if M2.any() else {},
                          su_m=round(float(dS.max()), 2), giu_m=round(float(dS.min()), 2), oltre_il_massimo_lasciati=int(((CORE | BED) & ~NO & ~CARR & (np.abs(d) > STEP_MAX)).sum()), carreggiate_sotto_le_traverse_ferme=int((CORE & CARR & ~NO & np.isfinite(T) & (np.abs(d) > 0.02) & ~M).sum()))
    log('binari: %s; %s' % (rep['profilo'], rep['terreno']))
    return Sn, M | M2, rep


def per_gioco(runs):
    """what terreno/indice.json carries: every run sampled every PASSO_GIOCO m, the height in mm"""
    out = []
    for r in runs:
        d = np.r_[0, np.cumsum(np.hypot(*np.diff(r['p'], axis=0).T))]
        if d[-1] < 0.5: continue
        u = np.linspace(0, d[-1], max(2, int(round(d[-1] / PASSO_GIOCO)) + 1)); x = np.interp(u, d, r['p'][:, 0]); z = np.interp(u, d, r['p'][:, 1]); y = np.interp(u, d, r['y'])
        out.append(dict(p=[v for a, b in zip(x, z) for v in (round(float(a), 2), round(float(b), 2))], y=[round(float(v), 3) for v in y]))
    return out
