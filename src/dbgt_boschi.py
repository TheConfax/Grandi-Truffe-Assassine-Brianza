# Boschi che il DBGT chiama prato (8/11, Carlo): dove nella realta' c'e' un bosco fitto, nel gioco ci deve essere un bosco. Il DBGT classifica come
# giardino (AR_VRD 01), prato (AR_VRD 02) o incolto (PS_INC 04) anche boschi veri (il Bosco delle Querce di Meda: OSM dice forest + park, il DBGT
# giardino, 0 alberi nel raggio di 100 m). Regola generale, uguale su qualsiasi comune dotato di DBGT, LiDAR e WorldCover:
#   1. le classi "dure" del DBGT non si toccano mai (edifici, strade, AC_VEI, acqua, colture, impianti sportivi, cimiteri, cantieri OSM; ALBERO e FIL_AL restano);
#   2. le classi "morbide" (giardino, prato, incolto) diventano bosco (tipo 11) solo sull'intersezione di: la chioma confermata da DUE fonti
#      (LiDAR DSM - DTM sopra CHIOMA_H e WorldCover 2021 classe 10) e il bosco o parco di OSM. La forma e' quella del DBGT intersecata con la chioma
#      (il confine OSM non entra mai), pulita con operazioni morfologiche, minimo MIN_M2;
#   3. gli alberi stanno sulle cime vere del LiDAR (massimi locali di DSM - DTM); dove le cime non si distinguono (chioma continua, piu' di GAP_R m
#      dalla cima piu' vicina) uno ogni DENS_M2. Altezza e chioma le dà poi dbgt_manufatti.alberi dal DSM, come per tutti gli alberi. Specie: nessuna
#      (il formato 'tr' non la porta): latifoglie neutre. Niente sottobosco.
# Cantieri (OSM landuse=construction): terreno smosso, nessun bosco e nessun albero nuovo (dati vecchi: Carlo 9/11). Dove il LiDAR o WorldCover mancano (fuori dalle tessere, fuori dal riquadro di WorldCover) niente e' confermato: il prato resta com'e'.
import os, math, time
import numpy as np, shapely
from shapely import prepare
from shapely.geometry import Polygon, Point, box, GeometryCollection
from shapely.ops import unary_union
from shapely.strtree import STRtree

CHIOMA_H = 4.0     # m: DSM - DTM sopra questo e' chioma (DSM first-return del 2008)
WC_BOSCO = 10      # ESA WorldCover 2021, classe "tree cover"
MIN_M2 = 1000.0    # un pezzo di bosco nuovo sotto questa area non nasce
PEAK_R = 2.2       # m: una cima e' il massimo di DSM - DTM (smussato) in questo raggio
PEAK_SEP = 3.0     # m: due cime piu' vicine di cosi' sono un albero solo (vince la piu' alta)
GAP_R = 5.0        # m: oltre questa distanza dalla cima piu' vicina "le cime non si distinguono": albero a distribuzione regolare
DENS_M2 = 70.0     # m2 per albero nei buchi
ALB_SEP = 2.5      # m: una cima a meno di cosi' da un ALBERO del DBGT e' quell'albero
CELLA = 2.5       # m: passo della griglia con cui si disegna la chioma
CLUSTER = 1500.0   # m: i candidati si leggono dal LiDAR a gruppi di questa taglia (una finestra di LiDAR per gruppo, non tutta la mappa)
_WC = {}


def _polys(g, amin=0.0):
    if g is None or g.is_empty: return []
    if g.geom_type == 'Polygon': return [g] if g.area >= amin else []
    return [p for q in getattr(g, 'geoms', []) for p in _polys(q, amin)]


def _worldcover(data):
    """(array, lon0, lat0, passo) o None se manca il file: fuori dal riquadro di WorldCover niente e' confermato"""
    if data not in _WC:
        f = os.path.join(data, 'worldcover', 'wc', 'wc.npy')
        if os.path.exists(f):
            try: lon0, lat0, sx = map(float, open(f.replace('wc.npy', 'wc_meta.txt')).read().split()); _WC[data] = (np.load(f), lon0, lat0, sx)
            except Exception: _WC[data] = None
        else: _WC[data] = None
    return _WC[data]


def _cime(Ns, G, mask):
    """massimi locali di Ns (DSM - DTM smussato) nel raggio PEAK_R sul reticolo del LiDAR, dove la maschera e' vera"""
    from scipy.ndimage import maximum_filter
    ri, ci = int(math.ceil(PEAK_R / G.mz)), int(math.ceil(PEAK_R / G.mx))
    R, C = np.mgrid[-ri:ri + 1, -ci:ci + 1]; fp = (np.hypot(R * G.mz, C * G.mx) <= PEAK_R)
    mx = maximum_filter(np.where(np.isfinite(Ns), Ns, -1e9), footprint=fp, mode='nearest')
    pk = np.isfinite(Ns) & (Ns >= mx - 1e-6) & (Ns >= CHIOMA_H) & mask
    r, c = np.nonzero(pk); return r, c, Ns[r, c]


def _separa(X, Z, H, sep):
    """la cima piu' alta vince su quelle a meno di sep metri"""
    if len(X) < 2: return np.ones(len(X), bool)
    from scipy.spatial import cKDTree
    o = np.argsort(-H, kind='stable'); P = np.c_[X, Z]; kd = cKDTree(P); keep = np.ones(len(X), bool)
    for i in o:
        if not keep[i]: continue
        for j in kd.query_ball_point(P[i], sep):
            if j != i and keep[j] and H[j] <= H[i]: keep[j] = False
    return keep


def _buchi(poly, cime, sep=GAP_R, dens=DENS_M2):
    """alberi a distribuzione regolare (uno ogni dens m2, reticolo ancorato all'origine con scarto fisso per cella: lo stesso in qualsiasi finestra)
    dove la poligonale e' a piu' di sep metri da ogni cima"""
    vuoto = poly.difference(unary_union([Point(p).buffer(sep) for p in cime])) if len(cime) else poly
    out = []
    s = math.sqrt(dens)
    for g in _polys(vuoto, 40.0):
        x0, z0, x1, z1 = g.bounds
        i0, i1, j0, j1 = int(math.floor(x0 / s)), int(math.ceil(x1 / s)), int(math.floor(z0 / s)), int(math.ceil(z1 / s))
        I, J = np.meshgrid(np.arange(i0, i1 + 1), np.arange(j0, j1 + 1)); I, J = I.ravel(), J.ravel()
        h1 = np.abs(np.sin(I * 12.9898 + J * 78.233) * 43758.5453) % 1.0; h2 = np.abs(np.sin(I * 39.3468 + J * 11.135) * 24634.6345) % 1.0
        X, Z = (I + 0.15 + 0.7 * h1) * s, (J + 0.15 + 0.7 * h2) * s
        m = shapely.contains_xy(g.buffer(-0.8), X, Z); out += list(zip(X[m], Z[m]))
    return out


def bosco_da_chioma(soft, osm, duri, alb, cover, data, grid_cls, lidar_cls, log=print):
    """soft: [(classe, poligono)] giardini, prati e incolti del DBGT; osm: [poligono] bosco e parco di OSM; duri: [poligono] superfici dure del DBGT
    (edifici, strade, acqua...) fuori dalle quali nascono i boschi; alb: array (n, 2) degli ALBERO del DBGT; cover: il perimetro dei dati.
    Restituisce (nuovi: [(classe, poligono)] pezzi di bosco, cime: array (n, 2), rapporto)"""
    rep = {'candidati_m2': 0, 'lidar_coperto_m2': 0, 'worldcover_coperto_m2': 0, 'nuovi_m2': 0, 'nuovi_m2_per_classe': {}, 'pezzi': 0, 'cime': 0, 'alberi_nei_buchi': 0,
           'alberi_vicini_a_ALBERO_tolti': 0}
    nul = ([], np.zeros((0, 2)), rep)
    if not soft or not osm: return nul
    ou = unary_union(osm); prepare(ou)
    cand = []                                   # (classe, pezzo) di morbido dentro bosco o parco OSM
    for t, p in soft:
        if not p.intersects(ou): continue
        for q in _polys(p.intersection(ou), 100.0): cand.append((t, q))
    if not cand: return nul
    rep['candidati_m2'] = round(sum(q.area for t, q in cand))
    wc = _worldcover(data)
    if wc is None: log('boschi da chioma: WorldCover manca, niente'); return nul
    WCa, wlon0, wlat0, wsx = wc
    dtm = lidar_cls(None)
    if not dtm.t: log('boschi da chioma: LiDAR manca, niente'); return nul
    dsm = lidar_cls(os.path.join(data, 'terreno', 'lidar_dsm'))
    if not dsm.t: log('boschi da chioma: DSM manca, niente'); return nul
    dtree = STRtree(duri) if duri else None
    cl = {}
    for k, (t, q) in enumerate(cand):
        c = q.centroid; cl.setdefault((int(c.x // CLUSTER), int(c.y // CLUSTER)), []).append(k)
    nuovi, cime, alberi_buchi = [], [], 0
    from scipy.ndimage import binary_closing, binary_opening, gaussian_filter
    for key in sorted(cl):
        ks = cl[key]; qs = [cand[k][1] for k in ks]; U = unary_union(qs); t0 = time.time()
        G = grid_cls(U.bounds, pad=6.0, dtm=dtm, dsm=dsm)
        if not G.ok: continue
        R, C = np.mgrid[0:G.shape[0], 0:G.shape[1]]; Rr, Cc = R.ravel(), C.ravel()
        lon = G.dtm.lon0 + (Cc + G.c0) * G.dtm.sx; lat = G.dtm.lat0 - (Rr + G.r0) * G.dtm.sy
        ci = np.floor((lon - wlon0) / wsx).astype(int); ri_ = np.floor((wlat0 - lat) / wsx).astype(int)
        okw = (ci >= 0) & (ci < WCa.shape[1]) & (ri_ >= 0) & (ri_ < WCa.shape[0])
        w = np.zeros(len(Rr), np.uint8); w[okw] = WCa[ri_[okw], ci[okw]]
        wcm = (w == WC_BOSCO).reshape(G.shape)
        N = G.N; fin = np.isfinite(N)
        # copertura dei due dati sui candidati (per il rapporto)
        X, Z = G.xz(Rr, Cc); X, Z = np.asarray(X), np.asarray(Z); prepare(U)
        pk_ = shapely.contains_xy(U, X, Z); area_px = G.mx * G.mz
        rep['lidar_coperto_m2'] += float((fin.ravel() & pk_).sum() * area_px); rep['worldcover_coperto_m2'] += float((okw & pk_).sum() * area_px)
        Ub = U.buffer(3.0); prepare(Ub); near_ = shapely.contains_xy(Ub, X, Z).reshape(G.shape)   # only round the candidates: the window can be a few km
        m = fin & (N > CHIOMA_H) & wcm & near_
        if not m.any(): continue
        m = binary_opening(binary_closing(m, np.ones((3, 3))), np.ones((3, 3)))
        # la maschera a rettangoli di una griglia regolare di CELLA m (il passo del dato: WorldCover e' a 10 m): spigoli esatti, poche forme
        bx0, bz0, bx1, bz1 = Ub.bounds
        xs = np.arange(bx0 + CELLA / 2, bx1, CELLA); zs = np.arange(bz0 + CELLA / 2, bz1, CELLA)
        XX, ZZ = np.meshgrid(xs, zs)
        mv = G.near(m.astype(np.float32), XX.ravel(), ZZ.ravel()); mv = (np.nan_to_num(mv) > 0.5).reshape(XX.shape)
        mv = binary_opening(binary_closing(mv, np.ones((3, 3))), np.ones((3, 3)))
        boxes = []
        for r in range(mv.shape[0]):
            row = mv[r]
            if not row.any(): continue
            d = np.diff(np.concatenate(([0], row.view(np.int8), [0]))); st, en = np.where(d == 1)[0], np.where(d == -1)[0]
            za0, za1 = zs[r] - CELLA / 2, zs[r] + CELLA / 2
            for a_, b_ in zip(st, en): boxes.append(box(bx0 + a_ * CELLA, za0, bx0 + b_ * CELLA, za1))
        if not boxes: continue
        chioma = unary_union(boxes)
        durc = unary_union([duri[i] for i in dtree.query(Ub)]).buffer(0.5) if dtree is not None else GeometryCollection()   # the hard surfaces round this group, once
        mine = []
        for k in ks:
            t, q = cand[k]
            g = q.intersection(chioma)
            if not durc.is_empty: g = g.difference(durc)
            g = g.buffer(-1.0).buffer(1.0)               # pulizia: via le lingue e i ponti stretti
            for p in _polys(g, MIN_M2): mine.append((t, p.simplify(0.3)))
        if not mine: continue
        nu = unary_union([p for t, p in mine]); prepare(nu)
        # cime vere del LiDAR dentro i pezzi nuovi
        Nf = np.where(fin, N, 0.0); Ns = gaussian_filter(Nf, 0.8); Ns = np.where(fin, Ns, np.nan)
        pr, pc, ph = _cime(Ns, G, m)
        if len(pr):
            px, pz = G.xz(pr, pc); px, pz = np.asarray(px), np.asarray(pz)
            ins = shapely.contains_xy(nu, px, pz); px, pz, ph = px[ins], pz[ins], ph[ins]
            kp = _separa(px, pz, ph, PEAK_SEP); px, pz = px[kp], pz[kp]
        else: px = pz = np.zeros(0)
        cm = list(zip(px, pz))
        for t, p in mine:
            cma = np.array(cm, float).reshape(-1, 2); pb = p.buffer(GAP_R)
            nb = _buchi(p, cma[shapely.contains_xy(pb, cma[:, 0], cma[:, 1])] if len(cma) else [])
            alberi_buchi += len(nb); cm += nb
        nuovi += mine; cime += cm
        log('  gruppo', key, len(ks), 'pezzi', round(U.area), 'm2, finestra', [round(v) for v in U.bounds], 'nuovi', len(mine), 'alberi', len(cm), '%.1fs' % (time.time() - t0))
    cime = np.array(cime, float).reshape(-1, 2)
    if len(cime) and len(alb):
        from scipy.spatial import cKDTree
        d = cKDTree(alb).query(cime)[0]; rep['alberi_vicini_a_ALBERO_tolti'] = int((d < ALB_SEP).sum()); cime = cime[d >= ALB_SEP]
    rep['pezzi'] = len(nuovi); rep['nuovi_m2'] = round(sum(p.area for t, p in nuovi)); rep['cime'] = int(len(cime)); rep['alberi_nei_buchi'] = alberi_buchi
    for t, p in nuovi: rep['nuovi_m2_per_classe'][str(t)] = round(rep['nuovi_m2_per_classe'].get(str(t), 0) + p.area)
    rep['lidar_coperto_m2'] = round(rep['lidar_coperto_m2']); rep['worldcover_coperto_m2'] = round(rep['worldcover_coperto_m2'])
    log('boschi da chioma: candidati', rep['candidati_m2'], 'm2, nuovi', rep['nuovi_m2'], 'm2 in', rep['pezzi'], 'pezzi, alberi', len(cime), '(nei buchi', alberi_buchi, ')')
    return nuovi, cime, rep
