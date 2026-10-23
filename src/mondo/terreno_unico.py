# Prototipo del motore nuovo (docs/motore.md, fasi 1-2): la superficie unica S a 2 m su un'area di prova di 600 x 600 m attorno allo
# svincolo della Milano-Meda. Base LiDAR 1 m (media delle celle), carreggiate DBGT AC_VEI (SED=01) alla quota dell'asse EL_STR e piatte in
# sezione, marciapiedi AC_PED (SED=01) al TIN dei loro vertici, raccordi S = clamp(L, Zb - d/K, Zb + d/K) con K = 1,5. I ponti (AC_VEI SED=02,
# PONTE_PONTE_SEDE, assi EL_STR SED=02) restano fuori: sotto c'e' il LiDAR, l'impalcato sara' un oggetto. Script autonomo: non usa
# build_data.py ne' il gioco.
#   python src/mondo/terreno_unico.py [--no-offset]
import os, sys, glob, sqlite3, struct, zlib, json
import numpy as np, tifffile, shapely
from shapely import wkb
from shapely.geometry import Polygon, LineString
from pyproj import Transformer
from scipy import ndimage
from scipy.spatial import cKDTree
from scipy.interpolate import LinearNDInterpolator

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('GTA_DATA', r'C:/Users/theco/GitHub/GTA-Brianza/data')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', '..', 'wf_tmp'))
X0, X1, Z0, Z1, STEP = -350.0, 250.0, 150.0, 750.0, 2.0
K = 1.5            # scarpata 1:1,5 (orizzontale:verticale)
ZMIN = 200.0       # quote DBGT sotto i 200 m sono buchi (0 o -9999)
OUTL = 4.0         # vertice o asse a piu' di 4 m dalla mediana del suo poligono: scartato
APPLY_OFF = '--no-offset' not in sys.argv
lat0, lon0 = 45.6575, 9.154
KX, KZ = 111320 * np.cos(np.radians(lat0)), 110540.0

gxs = np.arange(X0, X1 + STEP / 2, STEP); gzs = np.arange(Z0, Z1 + STEP / 2, STEP)
GX, GZ = np.meshgrid(gxs, gzs); NR, NC = GX.shape
GLON, GLAT = lon0 + GX / KX, lat0 - GZ / KZ
t7791 = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
def to_game(a):  # (n, >=2) UTM 32N RDN2008 -> (n, 2) metri del gioco
    lon, lat = t7791.transform(a[:, 0], a[:, 1]); return np.column_stack(((lon - lon0) * KX, -(lat - lat0) * KZ))
def ij(px, pz): return (pz - Z0) / STEP, (px - X0) / STEP  # riga, colonna (frazionarie)

# ---------- 1. LiDAR: ogni nodo da 2 m = media delle 2 x 2 celle da 1 m intorno ----------
def lidar():
    S_, N_ = np.zeros(GX.shape), np.zeros(GX.shape); nt = 0
    for f in sorted(glob.glob(os.path.join(DATA, 'terreno', 'lidar', '*.tif*'))):
        with tifffile.TiffFile(f) as t:
            p = t.pages[0]; tg = p.tags
            sx, sy = tg['ModelPixelScaleTag'].value[:2]; tp = tg['ModelTiepointTag'].value
            x0, y0 = tp[3] - tp[0] * sx, tp[4] + tp[1] * sy
            gk = tg['GeoKeyDirectoryTag'].value; gk = {gk[i]: gk[i + 3] for i in range(4, len(gk) - 3, 4)}
            if gk.get(1025) == 2: x0, y0 = x0 - sx / 2, y0 + sy / 2   # PixelIsPoint
            c = (GLON - x0) / sx; r = (y0 - GLAT) / sy
            if c.max() < -2 or r.max() < -2 or c.min() > p.shape[1] + 2 or r.min() > p.shape[0] + 2: continue
            arr = p.asarray().astype(np.float32)
        nd = float(tg['GDALNoDataTag'].value) if 'GDALNoDataTag' in tg else None
        if nd is not None: arr[arr == nd] = np.nan
        arr[(arr < -100) | (arr > 5000)] = np.nan
        kx, kz = max(1, round(STEP / (sx * KX))), max(1, round(STEP / (sy * KZ))); nt += 1
        for dx in range(kx):
            ci = np.floor(c - kx / 2 + dx + 0.5).astype(int)
            for dz in range(kz):
                ri = np.floor(r - kz / 2 + dz + 0.5).astype(int)
                ok = (ci >= 0) & (ci < arr.shape[1]) & (ri >= 0) & (ri < arr.shape[0])
                v = np.full(GX.shape, np.nan, np.float32); v[ok] = arr[ri[ok], ci[ok]]; ok &= ~np.isnan(v)
                S_ += np.where(ok, v, 0); N_ += ok
    L = np.where(N_ > 0, S_ / np.maximum(N_, 1), np.nan)
    if np.isnan(L).any():  # buchi (bordo fra tessere): il vicino valido
        idx = ndimage.distance_transform_edt(np.isnan(L), return_distances=False, return_indices=True); L = L[idx[0], idx[1]]
    return L, nt
L, ntl = lidar()
print('lidar: tessere %d, griglia %dx%d a %.0f m, quota %.1f..%.1f' % (ntl, NR, NC, STEP, L.min(), L.max()))

# ---------- 2. DBGT: aree e assi nell'area (con 30 m di margine) ----------
con = sqlite3.connect(os.path.join(DATA, 'dbt', 'Meda', 'dbgt.gpkg'))
def geom(b): f = b[3]; return wkb.loads(bytes(b[8 + [0, 32, 48, 48, 64][(f >> 1) & 7]:]))
AREA = shapely.box(X0 - 30, Z0 - 30, X1 + 30, Z1 + 30)
def polys(sql):  # -> [(Polygon nel gioco, vertici (n,3): gx, gz, quota, attributi)]
    out = []
    for row in con.execute(sql):
        if row[0] is None: continue
        for part in getattr(geom(row[0]), 'geoms', [geom(row[0])]):
            rings = [np.asarray(part.exterior.coords)] + [np.asarray(h.coords) for h in part.interiors]
            g = [to_game(a) for a in rings]
            P = Polygon(g[0], g[1:]).buffer(0)
            if P.is_empty or not P.intersects(AREA): continue
            V = np.vstack([np.column_stack((gg, a[:, 2])) for gg, a in zip(g, rings)])
            out.append((P, V, row[1:]))
    return out
vei = polys('select Shape, AC_VEI_SED, AC_VEI_ZON, AC_VEI_LIV from AC_VEI_AC_VEI_SUP_SR')
ped = polys('select Shape, AC_PED_SED, AC_PED_ZON from AC_PED_AC_PED_SUP_SR')
pon = polys('select Shape from PONTE_PONTE_SEDE')
axes = []  # punti degli assi ogni 0,5 m: gx, gz, quota, sede, livello
for b, sed, liv, ty in con.execute('select Shape, EL_STR_SED, EL_STR_LIV, EL_STR_TY from EL_STR_EL_STR_TRA_SG'):
    if b is None: continue
    for part in getattr(geom(b), 'geoms', [geom(b)]):
        a = np.asarray(part.coords); g = to_game(a)
        if not LineString(g).intersects(AREA): continue
        seg = np.hypot(*np.diff(g, axis=0).T); s = np.concatenate(([0], np.cumsum(seg)))
        t = np.arange(0, s[-1] + 0.25, 0.5); z = a[:, 2]
        ok = z > ZMIN
        if ok.sum() < 2: continue
        zz = np.interp(t, s[ok], z[ok])
        axes.append(np.column_stack((np.interp(t, s, g[:, 0]), np.interp(t, s, g[:, 1]), zz, np.full(len(t), int(sed)), np.full(len(t), int(liv)))))
AX = np.vstack(axes)
print('dbgt: AC_VEI %d (ponte %d), AC_PED %d, PONTE %d, assi %d (punti ogni 0,5 m %d, sede ponte %d, livello 01 %d)' % (
    len(vei), sum(1 for v in vei if v[2][0] == '02'), len(ped), len(pon), len(axes), len(AX), (AX[:, 3] == 2).sum(), (AX[:, 4] == 1).sum()))

def raster(P):  # maschera dei nodi dentro P (solo nel suo riquadro)
    m = np.zeros(GX.shape, bool); x0, z0, x1, z1 = P.bounds
    c0, c1 = max(0, int(np.floor((x0 - X0) / STEP))), min(NC - 1, int(np.ceil((x1 - X0) / STEP)))
    r0, r1 = max(0, int(np.floor((z0 - Z0) / STEP))), min(NR - 1, int(np.ceil((z1 - Z0) / STEP)))
    if c0 > c1 or r0 > r1: return m, None
    sub = shapely.contains_xy(P, GX[r0:r1 + 1, c0:c1 + 1], GZ[r0:r1 + 1, c0:c1 + 1]); m[r0:r1 + 1, c0:c1 + 1] = sub
    return m, (slice(r0, r1 + 1), slice(c0, c1 + 1))

def clean(V):  # vertici con quota vera e vicini alla mediana del poligono
    ok = V[:, 2] > ZMIN
    if ok.sum() == 0: return V[:0]
    med = np.median(V[ok, 2]); ok &= np.abs(V[:, 2] - med) < OUTL; return V[ok]

def tin(V, px, pz):  # TIN dei vertici, il vertice piu' vicino fuori dall'inviluppo
    u, ix = np.unique(np.round(V[:, :2], 2), axis=0, return_index=True); V = V[ix]
    if len(V) >= 3:
        try:
            h = LinearNDInterpolator(V[:, :2], V[:, 2])(px, pz)
        except Exception: h = np.full(len(px), np.nan)
    else: h = np.full(len(px), np.nan)
    bad = np.isnan(h)
    if bad.any(): h[bad] = V[cKDTree(V[:, :2]).query(np.column_stack((px[bad], pz[bad])))[1], 2]
    return h

# ---------- 3. ponti: maschera (restano oggetti, sotto resta il LiDAR) ----------
BR = np.zeros(GX.shape, bool)
for P, V, at in pon: BR |= raster(P)[0]
for P, V, at in vei:
    if at[0] == '02': BR |= raster(P)[0]

# ---------- 4. carreggiate: quota dell'asse EL_STR piu' vicino fra quelli del poligono, piatta in sezione ----------
ZB = np.full(GX.shape, np.nan); ROAD = np.zeros(GX.shape, bool); ZSRC = np.zeros(GX.shape, np.int8)  # 1 asse, 2 vertici
road_ok = AX[:, 3] == 1
treeAX = cKDTree(AX[road_ok, :2]); AXr = AX[road_ok]
nfb = 0
for P, V, at in vei:
    if at[0] != '01': continue
    m, sl = raster(P); m &= ~BR
    if not m.any(): continue
    px, pz = GX[m], GZ[m]; Vc = clean(V)
    cand = AXr[treeAX.query_ball_point(np.array(P.centroid.coords[0]), np.hypot(P.bounds[2] - P.bounds[0], P.bounds[3] - P.bounds[1]) / 2 + 2)]
    if len(cand):
        Pb = P.buffer(1.5); cand = cand[shapely.contains_xy(Pb, cand[:, 0], cand[:, 1])]
    if len(cand) and len(Vc):  # assi di un'altra quota che attraversano l'area (sottopassi, gallerie): fuori
        cand = cand[np.abs(cand[:, 2] - np.median(Vc[:, 2])) < OUTL]
    if len(cand):
        h = cand[cKDTree(cand[:, :2]).query(np.column_stack((px, pz)))[1], 2]; ZSRC[m] = 1
    elif len(Vc):
        h = tin(Vc, px, pz); ZSRC[m] = 2; nfb += 1
    else: continue
    ZB[m] = h; ROAD |= m
print('carreggiate: nodi %d, poligoni senza asse (TIN dei vertici) %d' % (ROAD.sum(), nfb))

# ---------- 5. marciapiedi e piazze: TIN dei vertici ripuliti ----------
PED = np.zeros(GX.shape, bool)
for P, V, at in ped:
    if at[0] != '01': continue
    m, sl = raster(P); m &= ~BR & ~ROAD & ~PED   # la carreggiata vince
    Vc = clean(V)
    if not m.any() or not len(Vc): continue
    ZB[m] = tin(Vc, GX[m], GZ[m]); PED |= m
FIX = ROAD | PED
print('marciapiedi: nodi %d' % PED.sum())

# ---------- 6. offset DBGT - LiDAR (spec. punto 2): mediana sulle carreggiate ----------
dl_raw = (ZB - L)[ROAD]
OFF = float(np.median(dl_raw))
if APPLY_OFF: ZB = ZB - OFF

# ---------- 6b. carreggiate SED=01 sospese accanto ai ponti: la sede ponte del DBGT non copre tutto l'impalcato (spalle, ultime campate).
# Un nodo a meno di 30 m da un ponte e piu' di 3 m sopra il LiDAR non ha terreno sotto: passa all'impalcato (oggetto), non entra in S
dbr = ndimage.distance_transform_edt(~BR, sampling=STEP) if BR.any() else np.full(GX.shape, 1e9)
AIR = ROAD & (dbr <= 30) & (ZB - L > 3.0)
AIR = ndimage.binary_propagation(AIR, mask=ROAD & (ZB - L > 1.5))  # fino a dove la carreggiata torna sul terreno
nair = int(AIR.sum()); ROAD &= ~AIR; BR |= AIR; FIX = ROAD | PED
print('carreggiate sospese accanto ai ponti passate all impalcato: nodi %d' % nair)

# ---------- 7. raccordi: S = clamp(L, Zb - d/K, Zb + d/K) dal nodo fisso piu' vicino ----------
d, idx = ndimage.distance_transform_edt(~FIX, sampling=STEP, return_indices=True)
Zn = ZB[idx[0], idx[1]]
S = np.clip(L, Zn - d / K, Zn + d / K)
S[FIX] = ZB[FIX]
S[BR & ~FIX] = L[BR & ~FIX]   # sotto i ponti il terreno e' il LiDAR; il raccordo delle spalle lo fara' l'impalcato
S = S.astype(np.float32)

# ---------- 8. gradino cordolo (C3): marciapiede - carreggiata sui nodi a contatto ----------
kerb = []
for dr, dc in ((0, 1), (1, 0), (0, -1), (-1, 0)):
    a = PED[max(0, -dr):NR - max(0, dr), max(0, -dc):NC - max(0, dc)]
    b = ROAD[max(0, dr):NR - max(0, -dr) or None, max(0, dc):NC - max(0, -dc) or None]
    za = ZB[max(0, -dr):NR - max(0, dr), max(0, -dc):NC - max(0, dc)]
    zb = ZB[max(0, dr):NR - max(0, -dr) or None, max(0, dc):NC - max(0, -dc) or None]
    kerb.append((za - zb)[a & b])
kerb = np.concatenate(kerb)

# ---------- 9. uscite ----------
os.makedirs(OUT, exist_ok=True)
np.save(os.path.join(OUT, 'terreno_unico.npy'), S)
np.save(os.path.join(OUT, 'terreno_unico_maschere.npy'), (ROAD * 1 + PED * 2 + BR * 4 + AIR * 8).astype(np.uint8))  # 1 carreggiata, 2 marciapiede, 4 ponte, 8 sospesa

def png(path, rgb):
    h, w, _ = rgb.shape; raw = b''.join(b'\x00' + rgb[r].tobytes() for r in range(h))
    ch = lambda t, d_: struct.pack('>I', len(d_)) + t + d_ + struct.pack('>I', zlib.crc32(t + d_) & 0xffffffff)
    open(path, 'wb').write(b'\x89PNG\r\n\x1a\n' + ch(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + ch(b'IDAT', zlib.compress(raw, 9)) + ch(b'IEND', b''))
def shade(H):  # ombreggiatura da nord-ovest, z in giu' nell'immagine = sud (righe crescenti = z del gioco crescente = sud)
    gy, gx = np.gradient(H.astype(np.float64), STEP); gx, gy = gx * 2.0, gy * 2.0  # esagerazione 2x
    n = np.dstack((-gx, -gy, np.ones_like(gx))); n /= np.linalg.norm(n, axis=2, keepdims=True)
    l = np.array([-1.0, -1.0, 1.4]); l /= np.linalg.norm(l); return np.clip((n * l).sum(2), 0, 1)
def tint(H, sh):
    t = (H - np.percentile(H, 1)) / max(1e-6, np.percentile(H, 99) - np.percentile(H, 1)); t = np.clip(t, 0, 1)[..., None]
    base = (1 - t) * np.array([70, 120, 80]) + t * np.array([215, 200, 160])
    return base * (0.35 + 0.65 * sh[..., None])
img = tint(S, shade(S))
img[ROAD] = img[ROAD] * 0.8 + np.array([60, 60, 70]) * 0.2
img[PED] = img[PED] * 0.75 + np.array([200, 120, 60]) * 0.25
img[BR] = img[BR] * 0.5 + np.array([200, 40, 40]) * 0.5
lid = tint(L, shade(L))
both = np.concatenate((lid, np.full((NR, 6, 3), 255.0), img), axis=1)  # sinistra LiDAR, destra S
png(os.path.join(OUT, 'terreno_unico.png'), np.repeat(np.repeat(np.clip(both, 0, 255).astype(np.uint8), 2, 0), 2, 1))

# ---------- 10. statistiche ----------
def st(a, nome):
    a = a[~np.isnan(a)]; aa = np.abs(a)
    print('  %-44s n=%6d  media %+6.2f  mediana %+6.2f  |p95| %5.2f  |max| %6.2f' % (nome, len(a), a.mean(), np.median(a), np.percentile(aa, 95), aa.max()))
print('\nSTATISTICHE (metri)%s' % ('' if APPLY_OFF else ' [senza offset]'))
print('offset DBGT - LiDAR (mediana sulle carreggiate): %+.2f m %s' % (OFF, 'tolto' if APPLY_OFF else 'NON tolto'))
st((S - ZB)[ROAD], 'carreggiate: finale - quota DBGT (corretta)')
st((S - (ZB + (OFF if APPLY_OFF else 0)))[ROAD], 'carreggiate: finale - quota DBGT grezza')
st((S - L)[ROAD], 'carreggiate: finale - LiDAR (quanto si muove)')
st((S - L)[ROAD & (ZSRC == 1)], '  ... solo quota da asse EL_STR')
st((S - L)[ROAD & (ZSRC == 2)], '  ... solo quota da vertici AC_VEI')
st((S - L)[PED], 'marciapiedi: finale - LiDAR')
OUTR = ~FIX & ~BR
st((S - L)[OUTR], 'fuori dalle strade: finale - LiDAR')
ch = np.abs(S - L)[OUTR]
for th in (0.1, 0.5, 2.0): print('  fuori dalle strade, nodi mossi > %.1f m: %5.1f%%' % (th, 100 * (ch > th).mean()))
for dmax in (4, 10, 20, 50):
    sel = OUTR & (d <= dmax) & (d > dmax / 2.5 if dmax > 4 else True)
    if sel.any(): print('  fuori, distanza dal bordo <= %2d m: mediana |finale - LiDAR| %.2f, p95 %.2f' % (dmax, np.median(np.abs(S - L)[sel]), np.percentile(np.abs(S - L)[sel], 95)))
st((S - L)[BR], 'sotto i ponti: finale - LiDAR')
if len(kerb): st(kerb, 'C3 cordolo: marciapiede - carreggiata a contatto')
gy, gx = np.gradient(S.astype(np.float64), STEP); sl = np.hypot(gx, gy)
print('  pendenza finale fuori dalle strade p99 %.2f (1/K = %.2f), su carreggiata p99 %.3f' % (np.percentile(sl[OUTR], 99), 1 / K, np.percentile(sl[ROAD], 99)))
print('\nscritti:', os.path.join(OUT, 'terreno_unico.npy'), os.path.join(OUT, 'terreno_unico.png'))
