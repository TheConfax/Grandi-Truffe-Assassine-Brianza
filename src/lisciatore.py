# Lisciatore del terreno, fase 1 (todo.md "cacciatore di seghettature", docs/motore.md 8): a pass on the surface S of superficie.py, after raccordi()
# and before tessere(), general on the whole map. Two jobs:
#   - buche: the closed depressions of S beside the streets with no ramp drawn are filled (a harmonic membrane on their rim), also those
#     sottoterra.py kept as possible ramps or doubts (Carlo, 25/10: "un buco enorme nel terreno, cose così non hanno senso"). A ramp of the data
#     stays: the drawn pits of sottoterra.py, and a pit with a carriageway on its bottom (a street that goes down).
#   - dente di sega: S up and down at the step of the cell along streets, sidewalks and edges. Its causes are two: a step between a fixed surface
#     and the ground closed inside one cell (the 2:3 envelope of raccordi() counts the distance between nodes, so along a diagonal edge the
#     lattice comes out as teeth) and a narrow sidewalk or area steep across its width (the lattice reads now the kerb side, now the outer side).
#     So the step under a limit is spread over at least RACC_W on the true distance from the edge of the polygon, the sidewalks by a street
#     go flat across at the height of its kerb, and what is left at the step of the cell is relaxed (only on nodes free to move).
# Never touched: decks, the ground under them and by them, water and beds, culverts, the rail bed, the drawn ramps, the carriageways (their
# height is the DBGT's or the LiDAR's, they are the anchors), a step over STEP_MAX (a true slope or wall). No node moves more than
# LIM_DENTE for the teeth; a filled pit moves what the pit is deep and no more than the rim around it.
import os, sys, time, json, heapq
import numpy as np, shapely
from scipy import ndimage, sparse
import scipy.sparse.linalg

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

# --- limits
LIM_DENTE = 1.5     # m: the most a node moves for the teeth (sidewalks flat across included)
RACC_W = 4.0        # m: a step is spread over at least this, on the true distance from the edge
K = 1.5             # ... and never steeper than the raccordi of superficie.py (1 : 1.5)
STEP_PIENO, STEP_MAX = 1.5, 2.5   # m: a step up to STEP_PIENO is spread in full; from there it fades, over STEP_MAX it is a true slope or wall and stays
PED_D0, PED_D1 = 3.0, 6.0         # m from the carriageway: a sidewalk is flat at its kerb height up to D0, its own height again at D1
PED_PIENO, PED_MAX = 1.5, 2.5     # m: its step from the kerb flattened in full up to this, over the other it is a wall or a path on a bank (flat it would be a notch)
PED_PONTE = 40.0  # m from a PONTE: no sidewalk goes flat (the ramps up to a footbridge stand on structures the DTM leaves out, 30-40 m from it: PONTE 9)
CASE_BAND = 4.0   # m: under a building the raccordo reaches only this far from the edge (the corners of the cells the edge crosses; its walls go down to the ground)
MOSSO_MIN = 0.015 # m: a node that would move less stays exactly as it was
RILASSA_IT, RILASSA_R = 6, 6.0    # iterations of the relaxation of the free nodes and how far from the edges (m)
# --- buche
B_PROF = 1.0        # m: a pit is a closed depression of S at least this deep ...
B_REG = 0.25        # ... its region the nodes this far under the spill point ...
B_AREA_MIN, B_AREA_MAX = 12.0, 1000.0   # ... at least this big and at most this (over it: a valley or a hollow of the land, listed and left)
B_STRADA = 12.0     # m: from a street, a sidewalk or a road area
B_CARR = 0.10       # a carriageway on this share of the deep half of the pit: a street that goes down, a ramp of the data
# --- pozzetti (Carlo, 31/10, x 497 z -432: "il lisciatore passa la malta"): every small closed depression, on the whole map, whatever the street
POZ_PROF = 0.4      # m: from its lowest node to its spill point
POZ_NODI = 3        # at most this many nodes deeper than POZ_PROF under the spill point (12 m2)
POZ_TUTTI = 12      # ... and this many in all, with the shallow halo around the hole
POZ_MARG = 4.0      # m around decks, water and the rail bed where they stay as they are (the banks and the abutments read the nodes next to them)
SF = 2.0


def _mask_geoms(R, geoms, buf=0.0):
    m = np.zeros((R.nz, R.nx), bool)
    for g in geoms:
        if buf: g = g.buffer(buf, 2)
        w = R.win(g.bounds, SF)
        if w is None: continue
        X, Z = R.xz(w); m[w[0]:w[1], w[2]:w[3]] |= shapely.contains_xy(g, X, Z)
    return m


def protetti(s):
    """the nodes never touched: everything that is not plain ground or a plain street"""
    import superficie as sf
    R = s.R; sh = (R.nz, R.nx); FIX = s.RANK > 0
    bed = (np.isin(s.CLS, (sf.C_ALV, sf.C_ARG)) & FIX) | s.TORR | s.ALVCOP | s.TOMB | s.TOMBC | s.RIEMP
    if getattr(s, 'ZE', None) is not None: bed = bed | np.isfinite(s.ZE)
    fer = (s.CLS == sf.C_FER) & FIX
    if getattr(s, 'BORDO_FER', None) is not None: fer = fer | s.BORDO_FER
    ponti = s.BR | s.AIR | s.BRP | s.ALTO
    if getattr(s, 'SOTTO', None) is not None: ponti = ponti | s.SOTTO
    rampe = [p['g'] for p in s.sotto.pits1 if p['esito'] == 'rampa']
    ram = _mask_geoms(R, rampe, 6.0) if rampe else np.zeros(sh, bool)
    P = ndimage.distance_transform_edt(~ponti, sampling=SF) <= 12.0
    P |= ndimage.distance_transform_edt(~bed, sampling=SF) <= 6.0
    P |= ndimage.distance_transform_edt(~fer, sampling=SF) <= 4.0
    return P | ram, dict(ponti=ponti, bed=bed, fer=fer, ram=ram)


def pozzi(S, prof=POZ_PROF, nodi=POZ_NODI):
    """the small closed depressions of the surface S. From each local minimum narrower than a closing of 5 x 5 nodes (a wider bowl is a shape of the land) a flood, lowest
    neighbour first. It stops at the way down, or when the deep part (more than `prof` under the water) passes `nodi` nodes or the whole pit POZ_TUTTI: the pit is then
    what lay under the last level that fitted (a deep hole in a shallow dimple counts by its hole: x 579 z -1179, two nodes 3 m down and a halo of a few cm).
    Returns [(rr, cc, depth, spill)]"""
    sh = S.shape; ch = ndimage.grey_closing(S, size=(5, 5)); rr, cc = np.nonzero((S <= ndimage.minimum_filter(S, 3)) & (ch - S >= prof))
    out, visti = [], set()
    for r0, c0 in zip(rr.tolist(), cc.tolist()):
        if (r0, c0) in visti: continue
        z0 = float(S[r0, c0]); liv = z0; dentro = [z0]; nd = []; heap = [(z0, r0, c0)]; seen = {(r0, c0)}; best = None
        while heap:
            h, r, c = heapq.heappop(heap)
            if h < liv: break                                       # the way down: the level so far is the spill point
            if h > liv:
                if sum(z < h - prof for z in dentro) > nodi or len(dentro) > POZ_TUTTI: break
                liv = h; best = (liv, [q for q in nd])
            dentro.append(h); nd.append((r, c))
            if r == 0 or c == 0 or r == sh[0] - 1 or c == sh[1] - 1: break
            for dr in (-1, 0, 1):
                for dc in (-1, 0, 1):
                    q = (r + dr, c + dc)
                    if q not in seen: seen.add(q); heapq.heappush(heap, (float(S[q]), q[0], q[1]))
        if best is None or best[0] - z0 < prof: continue
        pit = [q for q in best[1] if float(S[q]) < best[0]]
        if not pit: continue
        visti.update(pit); a = np.array(pit)
        out.append((a[:, 0], a[:, 1], best[0] - z0, best[0]))
    return out


def motivi_pozzi(s, PARTI, CARR):
    import superficie as sf
    tomb = s.TOMB | s.TOMBC | s.RIEMP
    return [('impalcato o ponte', PARTI['ponti']), ('tombino', tomb), ('acqua o alveo', PARTI['bed'] & ~tomb), ('ferrovia', PARTI['fer']), ('rampa disegnata', PARTI['ram']), ('carreggiata (quota DBGT o LiDAR)', CARR)]


def malta(s, S, PARTI, CARR):
    """the small pits filled from their rim (the median of the nodes around, never under the spill point), again until none is left; a pit with a protected
    node stays and goes on the list with the reason"""
    R = s.R; S = np.round(S * 100) / 100; FILL = np.zeros(S.shape, bool); fatti = []; eccez = {}   # (in whole cm, as the tiles: what is checked here is what the game reads)
    mot = motivi_pozzi(s, PARTI, CARR); marg = np.zeros(S.shape, bool)
    for k in ('ponti', 'bed', 'fer'): marg |= ndimage.distance_transform_edt(~PARTI[k], sampling=SF) <= POZ_MARG
    for giro in range(16):
        # at several depths, the deepest first: a hole counts by its deep part
        n = 0; pz = []; presi = np.zeros(S.shape, bool)
        for p_ in (2.0, 1.0, 0.6, POZ_PROF):
            for q in pozzi(S, p_):
                if presi[q[0], q[1]].any(): continue
                pz.append(q)
                if not (marg[q[0], q[1]].any() or any(M[q[0], q[1]].any() for _, M in mot)): presi[q[0], q[1]] = True   # (a protected one does not hide a smaller pit that can be filled)
        for rr, cc, prof, liv in pz:
            j = np.argmin(S[rr, cc]); x, z = R.x0 + cc[j] * SF, R.z0 + rr[j] * SF; key = (int(rr[j]), int(cc[j]))
            motivo = next((nm for nm, M in mot if M[rr, cc].any()), None)
            if motivo is None and marg[rr, cc].any(): motivo = 'a meno di %.0f m da ponte, acqua o ferrovia' % POZ_MARG
            if motivo is not None:
                eccez.setdefault(key, dict(x=round(float(x), 1), z=round(float(z), 1), m2=int(len(rr) * SF * SF), prof=round(float(prof), 2), motivo=motivo)); continue
            ring = np.zeros(S.shape[0:2], bool) if False else None
            pts = set(zip(rr.tolist(), cc.tolist())); vic = [(r + a, c + b) for r, c in pts for a in (-1, 0, 1) for b in (-1, 0, 1) if (r + a, c + b) not in pts]
            h = max(float(np.median([S[q] for q in vic])), liv)
            S[rr, cc] = np.maximum(S[rr, cc], np.round(h * 100) / 100); FILL[rr, cc] = True; n += 1
            fatti.append(dict(x=round(float(x), 1), z=round(float(z), 1), m2=int(len(rr) * SF * SF), prof=round(float(prof), 2)))
        if not n: break
    return S, FILL, fatti, list(eccez.values())


def buche(s, PROT, CARR, ROAD, CASE):
    """closed depressions of S beside the streets, no ramp in the data: filled. S and L (the ground the raccordi start from) go up together"""
    import sottoterra as stt
    R = s.R; F, D = stt.riempi(s.S)
    lab, n = ndimage.label(D > B_REG, np.ones((3, 3), bool)); objs = ndimage.find_objects(lab)
    dst = ndimage.distance_transform_edt(~ROAD, sampling=SF)
    casi = []; FILL = np.zeros(D.shape, bool)
    fos = [p for p in s.sotto.pits1 if p['esito'] in ('dubbio', 'altro') and 'g' in p]; ftree = shapely.STRtree([p['g'] for p in fos]) if fos else None
    for k, sl in enumerate(objs):
        m = lab[sl] == k + 1; prof = float(D[sl][m].max())
        if prof < B_PROF: continue
        a = m.sum() * SF * SF
        if a < B_AREA_MIN: continue
        rr, cc = np.nonzero(m); rr, cc = rr + sl[0].start, cc + sl[1].start
        j = np.argmax(D[rr, cc]); x, z = R.x0 + cc[j] * SF, R.z0 + rr[j] * SF
        if dst[rr, cc].min() > B_STRADA: continue
        fondo = D[rr, cc] >= 0.5 * prof
        c = dict(x=round(float(x), 1), z=round(float(z), 1), m2=int(a), prof=round(prof, 2), sotto_edificio=round(float(CASE[rr, cc].mean()), 2))
        fossa = [p for j_ in ftree.query(shapely.points(x, z).buffer(3.0)) for p in [fos[j_]]] if ftree is not None else []
        if fossa: c['era'] = fossa[0]['esito'] + ('/possibile' if fossa[0].get('rampa_possibile') else ''); c['fonti'] = fossa[0].get('fonti', [])
        dati = any(p.get('forma') and (p.get('osm') or (p.get('v08_m') is not None and p['v08_m'] <= 8.0)) for p in fossa)   # shaped like a ramp and an underground parking of OSM or the DBGT at it
        if PROT[rr, cc].any(): c['esito'] = 'protetta'
        elif dati: c['esito'] = 'rampa_nei_dati'
        elif a > B_AREA_MAX: c['esito'] = 'troppo_grande'
        elif CARR[rr, cc][fondo].mean() >= B_CARR: c['esito'] = 'strada_in_fondo'
        else: c['esito'] = 'riempita'; FILL[rr, cc] = True
        casi.append(c)
    # membrane: the region filled from its rim; carriageways stay as they are, never under S, never over the spill point
    S = s.S; Sn = S.copy(); labf, nf = ndimage.label(FILL)
    for k, sl in enumerate(ndimage.find_objects(labf)):
        r0, r1, c0, c1 = max(0, sl[0].start - 1), min(S.shape[0], sl[0].stop + 1), max(0, sl[1].start - 1), min(S.shape[1], sl[1].stop + 1)
        M = (labf[r0:r1, c0:c1] == k + 1) & ~CARR[r0:r1, c0:c1]; W = S[r0:r1, c0:c1]; nu = int(M.sum())
        if not nu: continue
        idx = -np.ones(M.shape, np.int64); idx[M] = np.arange(nu); rr, cc = np.nonzero(M); rows, cols, vv = [], [], []; rhs = np.zeros(nu); deg = np.zeros(nu)
        for dr, dc in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            r2, c2 = rr + dr, cc + dc; ok = (r2 >= 0) & (r2 < M.shape[0]) & (c2 >= 0) & (c2 < M.shape[1])
            me = idx[rr[ok], cc[ok]]; r2, c2 = r2[ok], c2[ok]; deg[me] += 1; inn = M[r2, c2]
            rows.append(me[inn]); cols.append(idx[r2[inn], c2[inn]]); vv.append(-np.ones(int(inn.sum())))
            np.add.at(rhs, me[~inn], W[r2[~inn], c2[~inn]])
        A = sparse.csr_matrix((np.concatenate([deg] + vv), (np.concatenate([np.arange(nu)] + rows), np.concatenate([np.arange(nu)] + cols))), shape=(nu, nu))
        sol = scipy.sparse.linalg.spsolve(A.tocsc(), rhs)
        Fw = F[r0:r1, c0:c1]; Sn[r0:r1, c0:c1][M] = np.minimum(np.maximum(sol, W[M]), Fw[M])
    return Sn, FILL, casi


def distanza_vera(s, FISSI, band):
    """true distance from the edge of the surfaces the DBGT burned (the polygons, not the nodes) at the nodes of `band`; where a node is fixed past
    the polygons (the drawn roads of vie(): corners of the cells their edge crosses) the distance from those nodes, which is the edge there"""
    import superficie as sf
    R = s.R; polys = []
    for nm in ('AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR'):
        L = s.D[nm]
        for i in range(len(L['off']) - 1):
            if sf.sed_ok(L, i):
                P = sf.poly(L, i)
                if not P.is_empty: polys.append(P)
    tree = shapely.STRtree(polys); rr, cc = np.nonzero(band); pts = shapely.points(R.x0 + cc * SF, R.z0 + rr * SF)
    jn = tree.nearest(pts); dp = shapely.distance(np.array(polys, dtype=object)[jn], pts)
    Fp = np.zeros(FISSI.shape, bool)   # the fixed nodes outside the polygons
    pfix = FISSI & (s.VIE if getattr(s, 'VIE', None) is not None else np.zeros(FISSI.shape, bool))
    de = ndimage.distance_transform_edt(~pfix, sampling=SF)[rr, cc] if pfix.any() else np.full(len(rr), 1e9)
    D = np.full(FISSI.shape, np.inf, np.float32); D[rr, cc] = np.minimum(dp, np.maximum(de - SF / 2, 0.0)); return D


def lisciatore(s, log=print):
    import superficie as sf
    t0 = time.time(); R = s.R; S0 = s.S.copy(); L0 = s.L; FIX = s.RANK > 0
    PROT, parti = protetti(s)
    CARR = FIX & np.isin(s.CLS, (sf.C_VEI, sf.C_VEIT))
    ROAD = FIX & np.isin(s.CLS, (sf.C_VEI, sf.C_VEIT, sf.C_PED, sf.C_AREA))
    CASE = _mask_geoms(R, s.case)
    rep = dict(limiti=dict(dente_m=LIM_DENTE, raccordo_minimo_m=RACC_W, gradino_pieno_m=STEP_PIENO, gradino_massimo_m=STEP_MAX, buca_prof_m=B_PROF, buca_m2=[B_AREA_MIN, B_AREA_MAX], buca_da_strada_m=B_STRADA))
    # ----- buche
    Sb, FILLB, casi = buche(s, PROT, CARR, ROAD, CASE)
    Lb = np.where(FILLB, np.maximum(L0, Sb), L0)
    rep['buche'] = dict(conta={e: sum(c['esito'] == e for c in casi) for e in ('riempita', 'protetta', 'troppo_grande', 'strada_in_fondo', 'rampa_nei_dati')}, nodi=int(FILLB.sum()),
                        alzati_m=sf.pct((Sb - S0)[FILLB]), rimaste_oltre_soglia=[c for c in casi if c['esito'] != 'riempita'][:80], riempite=sorted([c for c in casi if c['esito'] == 'riempita'], key=lambda c: -c['prof'] * c['m2'])[:80])
    # ----- sidewalks and road areas by a street: flat across at the height of the kerb
    S = Sb.copy(); MOB = ~PROT & ~CARR
    dc, (ri, ci) = ndimage.distance_transform_edt(~CARR, sampling=SF, return_indices=True)
    PED = FIX & np.isin(s.CLS, (sf.C_PED, sf.C_AREA)) & MOB & ~FILLB & (dc < PED_D1)
    Tk = S[ri, ci]; a = np.clip((PED_D1 - dc) / (PED_D1 - PED_D0), 0, 1)
    dT = np.where(PED, (Tk - S) * a, 0.0)
    PED &= ndimage.distance_transform_edt(~s.BRP, sampling=SF) > PED_PONTE if s.BRP.any() else PED
    gp = np.clip((PED_MAX - np.abs(Tk - S)) / (PED_MAX - PED_PIENO), 0, 1)
    dT = np.where(PED, dT * gp, 0.0)
    S = S + np.clip(dT, -LIM_DENTE, LIM_DENTE)
    # ... and relaxed along themselves on their neighbours and the kerb: no crumple where the flattening fades or hits the limit
    Y = S.copy(); nb = PED | CARR; ker = np.array([[1, 2, 1], [2, 0, 2], [1, 2, 1]], np.float32)
    for _ in range(3):
        n_ = ndimage.convolve(np.where(nb, Y, 0), ker, mode='constant'); d_ = ndimage.convolve(nb.astype(np.float32), ker, mode='constant')
        k = PED & (d_ > 0); Y[k] = 0.5 * Y[k] + 0.5 * n_[k] / d_[k]
    S = np.where(PED, Y, S)
    # ----- the raccordo: over at least RACC_W, on the true distance from the edge. Offset from the ground (L, the fill of the pits in it) along the edge, read off the fixed nodes
    FISSI = ROAD | (FIX & (s.CLS == sf.C_NONE) & ~PROT)
    u = np.where(FISSI, S - Lb, np.nan)
    dbord, (rb, cb) = ndimage.distance_transform_edt(~FISSI, sampling=SF, return_indices=True)
    bordo = FISSI & ~ndimage.binary_erosion(FISSI, np.ones((3, 3), bool))
    w = bordo.astype(np.float32); val = np.where(bordo, np.nan_to_num(u), 0).astype(np.float32)
    nu_ = ndimage.uniform_filter(val, 5, mode='constant'); de_ = ndimage.uniform_filter(w, 5, mode='constant')
    ub = np.where(de_ > 0, nu_ / np.maximum(de_, 1e-6), 0)   # the step of the edge, averaged along it over 10 m
    dzb = ub[rb, cb]
    W = np.maximum(RACC_W, K * np.abs(dzb))
    LIB = ~FIX & ~PROT & ~FILLB & (dbord <= np.maximum(RACC_W, K * STEP_MAX) + 2.0) & (~CASE | (dbord <= CASE_BAND))
    dv = distanza_vera(s, FISSI, LIB)
    tgt = Lb + dzb * np.clip(1 - dv / W, 0, 1)
    g = np.clip((STEP_MAX - np.abs(dzb)) / (STEP_MAX - STEP_PIENO), 0, 1)
    dn = np.where(LIB, (tgt - S) * g, 0.0)
    S = S + np.clip(dn, -LIM_DENTE, LIM_DENTE)
    # ----- what is left at the step of the cell: the free nodes relaxed on their neighbours (on the offset from the ground, so the shape of the land stays)
    rel = ~FIX & ~PROT & ~FILLB & (dbord <= RILASSA_R) & (~CASE | (dbord <= CASE_BAND))
    O = S - Lb; Y = O.copy()
    ker = np.array([[1, 2, 1], [2, 0, 2], [1, 2, 1]], np.float32) / 12
    for _ in range(RILASSA_IT):
        Yn = ndimage.convolve(Y, ker, mode='nearest'); Y[rel] = 0.5 * Y[rel] + 0.5 * Yn[rel]
    S = np.where(rel, Lb + Y, S)
    # the limit, on the teeth only
    d = S - Sb; S = np.where(np.abs(d) > LIM_DENTE, Sb + np.clip(d, -LIM_DENTE, LIM_DENTE), S); S = np.where(np.abs(S - Sb) < MOSSO_MIN, Sb, S)
    S[PROT] = S0[PROT]; S[CARR] = S0[CARR]
    # never deeper: a node of a closed pit of S does not go down (the raccordo along a street lowered the pit of x 497 z -432 by 20 cm), and a node brought down
    # stops at its lowest neighbour (no new minimum)
    POZ0 = np.zeros(S.shape, bool)
    for rr_, cc_, _p, _l in pozzi(S0, 0.1, 8): POZ0[rr_, cc_] = True
    S = np.where(POZ0 & (S < S0), S0, S)
    sopra = np.ones((3, 3), bool); sopra[1, 1] = False
    for _ in range(4):
        vm = ndimage.minimum_filter(S, footprint=sopra); nuovi = (S < S0 - 1e-6) & (S < vm)
        if not nuovi.any(): break
        S = np.where(nuovi, np.minimum(S0, vm), S)
    # the pits the teeth pass left or made: one more round of the same fill
    Sc = s.S; s.S = S; S2, F2, casi2 = buche(s, PROT, CARR, ROAD, CASE); s.S = Sc; S = S2; FILLB = FILLB | F2
    rep['buche']['secondo_giro_nodi'] = int(F2.sum())
    # the mortar: the small pits, all over the map
    S, POZ, fatti, eccez = malta(s, S, parti, CARR); s.LISC_POZZ = POZ; FILLB = FILLB | POZ; s.lisc_poz = (fatti, eccez)
    s.S0_lisc = S0; s.S = S; s.L_lisc = Lb; s.LISC_BUCHE = FILLB; s.LISC_PROT = PROT; s.LISC_PARTI = parti; s.CASE_LISC = CASE
    rep['pozzetti'] = dict(profondita_minima_m=POZ_PROF, massimo_m2=POZ_NODI * SF * SF, riempiti=len(s.lisc_poz[0]), nodi=int(s.LISC_POZZ.sum()), alzati_m=sf.pct((S - Sb)[s.LISC_POZZ], (50, 90, 99)))
    mv = np.abs(S - S0) > 0.005
    rep['dente'] = dict(nodi_mossi=int((mv & ~FILLB).sum()), spostamento_m=sf.pct(np.abs(S - Sb)[mv & ~FILLB], (50, 90, 99)), su_m=float(np.max(S - Sb)), giu_m=float(np.min(S - Sb)))
    s.lisc_rep = rep; s.t['lisciatore'] = round(time.time() - t0, 1)
    log('lisciatore: buche %s (nodi %d, alzati %s); dente: %d nodi, %s; %.0f s' % (rep['buche']['conta'], rep['buche']['nodi'], rep['buche']['alzati_m'], rep['dente']['nodi_mossi'], rep['dente']['spostamento_m'], time.time() - t0))
    return rep


# ---------- the checks: the same measure before and after, on the whole map (docs/motore.md, "bordi a scalini" of bordi-lisci) ----------
LAYERS = ('AC_VEI', 'AC_PED', 'AC_CIC', 'AR_STR')
SOGLIE = (0.08, 0.15, 0.30)
DENTE_15_MAX_KM = 15.0   # km of edge sampled more than 15 cm off its own 4 m mean, outside the protected nodes: over this the error has come back


def _bordi(s):
    import superficie as sf
    out = []
    for nm in LAYERS:
        L = s.D[nm]
        for i in range(len(L['off']) - 1):
            if not sf.sed_ok(L, i): continue
            P = sf.poly(L, i)
            if P.is_empty: continue
            for g in getattr(P, 'geoms', [P]):
                for ring in [g.exterior] + list(g.interiors):
                    ln = ring.length
                    if ln < 4: continue
                    d = np.arange(0, ln, 0.5); xy = shapely.get_coordinates(shapely.line_interpolate_point(ring, d)); xy2 = shapely.get_coordinates(shapely.line_interpolate_point(ring, np.minimum(d + 0.05, ln)))
                    t = xy2 - xy; t /= np.maximum(np.hypot(*t.T), 1e-9)[:, None]; n = np.column_stack((-t[:, 1], t[:, 0]))
                    out.append((nm, xy + n * 0.3)); out.append((nm, xy - n * 0.3))
    return out


def misura_dente(G, R, bordi, PROT):
    """km of edge (S 0.3 m inside and outside every ring, every 0.5 m) off the mean of its 4 m by more than each limit, outside the protected nodes"""
    import superficie as sf
    res = {nm: dict(km=0.0, **{'oltre_%dcm' % (v * 100): 0.0 for v in SOGLIE}) for nm in LAYERS}; ker = np.ones(9) / 9; luoghi = []
    for nm, q in bordi:
        y = sf.tri_interp(G, R, q[:, 0], q[:, 1]); dev = np.abs(y - np.convolve(np.concatenate((y[-4:], y, y[:4])), ker, 'valid'))
        ok = ~PROT[np.clip(np.round((q[:, 1] - R.z0) / SF).astype(int), 0, R.nz - 1), np.clip(np.round((q[:, 0] - R.x0) / SF).astype(int), 0, R.nx - 1)]
        e = res[nm]; e['km'] += ok.sum() * 0.5 / 1000
        for v in SOGLIE: e['oltre_%dcm' % (v * 100)] += ((dev > v) & ok).sum() * 0.5 / 1000
        k = (dev > 0.30) & ok
        if k.any(): luoghi.append(np.column_stack((q[k], dev[k])))
    tot = {'oltre_%dcm' % (v * 100): round(sum(res[nm]['oltre_%dcm' % (v * 100)] for nm in LAYERS), 2) for v in SOGLIE}
    return {nm: {k: round(v, 2) for k, v in e.items()} for nm, e in res.items()}, tot, (np.vstack(luoghi) if luoghi else np.zeros((0, 3)))


def conta_buche(s, G, PROT, CARR, ROAD):
    """the pits of the same definition as buche(), on the surface G"""
    import sottoterra as stt
    fos = [p for p in s.sotto.pits1 if p['esito'] in ('dubbio', 'altro') and 'g' in p]; ftree = shapely.STRtree([p['g'] for p in fos]) if fos else None
    R = s.R; _, D = stt.riempi(G); lab, n = ndimage.label(D > B_REG, np.ones((3, 3), bool)); dst = ndimage.distance_transform_edt(~ROAD, sampling=SF); out = []
    for k, sl in enumerate(ndimage.find_objects(lab)):
        m = lab[sl] == k + 1; prof = float(D[sl][m].max()); a = m.sum() * SF * SF
        if prof < B_PROF + 0.03 or a < B_AREA_MIN: continue
        rr, cc = np.nonzero(m); rr, cc = rr + sl[0].start, cc + sl[1].start
        if dst[rr, cc].min() > B_STRADA or PROT[rr, cc].any(): continue
        fondo = D[rr, cc] >= 0.5 * prof; j = np.argmax(D[rr, cc]); xj, zj = R.x0 + cc[j] * SF, R.z0 + rr[j] * SF
        fossa = [fos[j_] for j_ in ftree.query(shapely.points(xj, zj).buffer(3.0))] if ftree is not None else []
        out.append(dict(dati=any(p.get('forma') and (p.get('osm') or (p.get('v08_m') is not None and p['v08_m'] <= 8.0)) for p in fossa), x=round(float(R.x0 + cc[j] * SF), 1), z=round(float(R.z0 + rr[j] * SF), 1), m2=int(a), prof=round(prof, 2), grande=bool(a > B_AREA_MAX), strada_in_fondo=bool(CARR[rr, cc][fondo].mean() >= B_CARR)))
    return out


def controlli(s, G, out_file=None, log=print):
    """G: S as the tiles give it (read back). Before and after on the whole map, and what must not have changed"""
    import superficie as sf
    R = s.R; S0 = s.S0_lisc; PROT = s.LISC_PROT; FIX = s.RANK > 0; G0 = np.round(S0 * 100) / 100; bordi = _bordi(s)
    IN = ~np.isnan(G); G = np.where(IN, G, G0)
    CARR = FIX & np.isin(s.CLS, (sf.C_VEI, sf.C_VEIT)); ROAD = FIX & np.isin(s.CLS, (sf.C_VEI, sf.C_VEIT, sf.C_PED, sf.C_AREA))
    p0, t0_, _ = misura_dente(G0, R, bordi, PROT); p1, t1, luoghi = misura_dente(G, R, bordi, PROT)
    b0 = conta_buche(s, G0, PROT, CARR, ROAD); b1 = conta_buche(s, G, PROT, CARR, ROAD)
    dG = G - G0; mv = np.abs(dG) >= 0.015; B = s.LISC_BUCHE; parti = s.LISC_PARTI
    gr_ = {}; CS = s.CASE_LISC; g_lista = []
    for a_, b_ in (((slice(None), slice(0, -1)), (slice(None), slice(1, None))), ((slice(0, -1), slice(None)), (slice(1, None), slice(None))), ((slice(0, -1), slice(0, -1)), (slice(1, None), slice(1, None))), ((slice(0, -1), slice(1, None)), (slice(1, None), slice(0, -1)))):
        cresce = np.abs(G[a_] - G[b_]) - np.abs(G0[a_] - G0[b_]); k_ = ~CS[a_] & ~CS[b_] & ~B[a_] & ~B[b_]
        for lim in (0.3, 0.5, 1.0): gr_[lim] = gr_.get(lim, 0) + int(((cresce > lim) & k_).sum())
        rr_, cc_ = np.nonzero((cresce > 0.8) & k_); g_lista += [dict(x=round(float(R.x0 + c_ * SF), 1), z=round(float(R.z0 + r_ * SF), 1), cresce=round(float(cresce[r_, c_]), 2)) for r_, c_ in zip(rr_, cc_)]
    sint = lambda L: dict(n=len(L), prof_m=sf.pct([c['prof'] for c in L], (50, 90)), area_m2=sf.pct([c['m2'] for c in L], (50, 90)), riempibili=sum(not c['grande'] and not c['strada_in_fondo'] and not c['dati'] for c in L))
    rep = dict(s.lisc_rep)
    rep['controlli'] = dict(
        dente_km=dict(definizione='S a 0,3 m dentro e fuori da ogni anello AC_VEI, AC_PED, AC_CIC, AR_STR, ogni 0,5 m: km fuori dalla media dei suoi 4 m oltre la soglia; nodi protetti esclusi', prima=p0, dopo=p1, totale_prima=t0_, totale_dopo=t1, soglia_15cm_km=DENTE_15_MAX_KM),
        buche_vicino_alle_strade=dict(definizione='depressioni chiuse di S oltre %.1f m, almeno %.0f m2, entro %.0f m da una strada, nodi protetti esclusi' % (B_PROF, B_AREA_MIN, B_STRADA), prima=sint(b0), dopo=sint(b1), rimaste=b1[:60]),
        spostamento=dict(dente_m=sf.pct(np.abs(dG)[mv & ~B], (50, 90, 99, 99.9)), dente_su_m=round(float(dG[~B].max()), 3), dente_giu_m=round(float(dG[~B].min()), 3), buche_m=sf.pct(np.abs(dG)[mv & B], (50, 90, 99)), nodi_mossi=int(mv.sum()), nodi_griglia=int(G.size), limite_dente_m=LIM_DENTE),
        invariati=dict(nodi_nella_fascia_protetta_cambiati_fuori_dai_pozzetti=int((np.abs(dG)[PROT & ~s.LISC_POZZ] >= 0.015).sum()), nodi_nella_fascia_protetta_cambiati_nei_pozzetti=int((np.abs(dG)[PROT & s.LISC_POZZ] >= 0.015).sum()), carreggiate_cambiate=int((np.abs(dG)[CARR] >= 0.015).sum()), impalcati_e_sotto=int((np.abs(dG)[parti['ponti']] >= 0.015).sum()), acqua_e_alvei=int((np.abs(dG)[parti['bed']] >= 0.015).sum()), ferrovia=int((np.abs(dG)[parti['fer']] >= 0.015).sum()), rampe=int((np.abs(dG)[parti['ram']] >= 0.015).sum())),
        gradini_cresciuti=dict(definizione='coppie di nodi vicini (anche in diagonale), fuori dagli edifici e dalle buche riempite, con il salto cresciuto oltre la soglia', **{'oltre_%.1fm' % k: v for k, v in gr_.items()}, peggiori=sorted(g_lista, key=lambda q: -q['cresce'])[:30]),
        luoghi_oltre_30cm=[dict(x=round(float(q[0]), 1), z=round(float(q[1]), 1), scarto=round(float(q[2]), 2)) for q in luoghi[np.argsort(-luoghi[:, 2])][::max(1, len(luoghi) // 40)]][:40])
    # the small pits, before and after, on what the tiles give; the exceptions with the reason. And the small spikes, only counted
    mot = motivi_pozzi(s, parti, CARR); marg = np.zeros(G.shape, bool)
    for k_ in ('ponti', 'bed', 'fer'): marg |= ndimage.distance_transform_edt(~parti[k_], sampling=SF) <= POZ_MARG
    def conta_pozzi(H):
        tutti, ecc = 0, []
        for rr, cc, prof, liv in pozzi(H):
            if not IN[rr, cc].all(): continue   # the lattice past the tiles: the game has no such node
            tutti += 1; j = np.argmin(H[rr, cc]); motivo = next((nm for nm, M in mot if M[rr, cc].any()), None)
            if motivo is None and marg[rr, cc].any(): motivo = 'a meno di %.0f m da ponte, acqua o ferrovia' % POZ_MARG
            e = dict(x=round(float(R.x0 + cc[j] * SF), 1), z=round(float(R.z0 + rr[j] * SF), 1), m2=int(len(rr) * SF * SF), prof=round(float(prof), 2), motivo=motivo)
            ecc.append(e)
        return tutti, ecc
    n0, l0 = conta_pozzi(G0); G1 = np.where(IN, G, np.round(s.S * 100) / 100); n1, l1 = conta_pozzi(G1)
    fuori = [e for e in l1 if e['motivo'] is None]; ecc1 = sorted([e for e in l1 if e['motivo'] is not None], key=lambda e: -e['prof'])
    per_mot = {}
    for e in ecc1: per_mot[e['motivo']] = per_mot.get(e['motivo'], 0) + 1
    punte = sorted([dict(x=round(float(R.x0 + cc[np.argmax(G[rr, cc])] * SF), 1), z=round(float(R.z0 + rr[np.argmax(G[rr, cc])] * SF), 1), m2=int(len(rr) * SF * SF), alta=round(float(p_), 2)) for rr, cc, p_, _ in pozzi(-G) if IN[rr, cc].all()], key=lambda e: -e['alta'])
    punte_fuori = [e for e in punte if not any(M[int(round((e['z'] - R.z0) / SF)), int(round((e['x'] - R.x0) / SF))] for _, M in mot) and not marg[int(round((e['z'] - R.z0) / SF)), int(round((e['x'] - R.x0) / SF))]]
    POZm = s.LISC_POZZ
    cambiati_oggetti = sum(int((np.abs(dG)[M & ~POZm] >= 0.015).sum()) for _, M in mot)
    rep['controlli_pozzetti'] = dict(definizione='depressioni chiuse di S (piena dal minimo fino al punto di sfioro) profonde almeno %.1f m con al massimo %d nodi (%.0f m2), su tutta la mappa' % (POZ_PROF, POZ_NODI, POZ_NODI * SF * SF),
                                     prima=dict(totale=n0, senza_motivo=sum(e['motivo'] is None for e in l0), oltre_1m=sum(e['prof'] >= 1 for e in l0), oltre_2m=sum(e['prof'] >= 2 for e in l0)), dopo=dict(totale=n1, senza_motivo=len(fuori), oltre_1m=sum(e['prof'] >= 1 for e in l1), oltre_2m=sum(e['prof'] >= 2 for e in l1)),
                                     eccezioni_per_motivo=per_mot, eccezioni=ecc1[:300], senza_motivo=fuori[:60], riempiti_i_piu_profondi=sorted(s.lisc_poz[0], key=lambda e: -e['prof'])[:30],
                                     punte_verso_alto=dict(totale=len(punte), fuori_dalle_cose_protette=len(punte_fuori), peggiori=punte_fuori[:5], peggiori_tutte=punte[:5], nota='contate, non corrette'), oggetti_protetti_cambiati=cambiati_oggetti, ok=bool(not fuori and cambiati_oggetti == 0))
    c = rep['controlli']; c['ok'] = bool(rep['controlli_pozzetti']['ok'] and t1['oltre_15cm'] <= DENTE_15_MAX_KM and c['buche_vicino_alle_strade']['dopo']['riempibili'] == 0 and c['invariati']['carreggiate_cambiate'] == 0 and c['spostamento']['dente_m'].get('max', 0) <= LIM_DENTE + 0.02)
    log('lisciatore, controlli: dente oltre 15 cm %.1f -> %.1f km; buche %d -> %d (riempibili %d); pozzetti %d -> %d (senza motivo %d); ok %s' % (t0_['oltre_15cm'], t1['oltre_15cm'], len(b0), len(b1), c['buche_vicino_alle_strade']['dopo']['riempibili'], n0, n1, len(fuori), c['ok']))
    if out_file: json.dump(rep, open(out_file, 'w', encoding='utf-8'), ensure_ascii=False, indent=0, default=float)
    return rep
