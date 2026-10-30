# Foto aeree recenti (Esri World Imagery, su Meda del 3/7/2025, ~0,2 m/pixel a z19) SOLO come riferimento interno della build: non vanno nel gioco.
# Serve a dbgt_edifici.py per togliere gli edifici del DBGT (rilievo 2015) demoliti dopo. Le tile stanno in data/esri/<z>/<x>_<y>.jpg
# (cache, scaricate una volta sola, il download riparte da dove era arrivato; un file vuoto = la tile non esiste).
# python src/esri_foto.py S W N E [z]    scarica tutte le tile del riquadro in gradi (come fa la build per la mappa intera); senza argomenti: Meda
import os, sys, io, math, time, urllib.request
import numpy as np
from PIL import Image, ImageDraw
HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.environ.get('GTA_DATA', os.path.join(os.path.dirname(HERE), 'data'))
URL = 'https://services.arcgisonline.com/arcgis/rest/services/World_Imagery/MapServer/tile/%d/%d/%d'
Z = 19
PAUSA = 0.05   # secondi tra due richieste: gentile col server


def tile_di(lon, lat, z=Z):
    n = 2 ** z; x = (lon + 180) / 360 * n
    y = (1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n
    return x, y   # in tile (frazionarie)


def _file(z, x, y): return os.path.join(DATA, 'esri', str(z), '%d_%d.jpg' % (x, y))


def scarica(x, y, z=Z, tentativi=4):
    """una tile in cache (la scarica se manca); False se non esiste"""
    f = _file(z, x, y)
    if os.path.exists(f): return os.path.getsize(f) > 0
    os.makedirs(os.path.dirname(f), exist_ok=True)
    for t in range(tentativi):
        try:
            req = urllib.request.Request(URL % (z, y, x), headers={'User-Agent': 'GTA-Brianza-build (riferimento interno)'})
            d = urllib.request.urlopen(req, timeout=30).read()
            if len(d) < 1200: d = b''   # la tile "nessun dato" di Esri e' minuscola
            open(f + '.tmp%d' % os.getpid(), 'wb').write(d); os.replace(f + '.tmp%d' % os.getpid(), f); time.sleep(PAUSA); return len(d) > 0
        except Exception as e:
            if getattr(e, 'code', 0) in (400, 404): open(f, 'wb').write(b''); return False
            time.sleep(2 * (t + 1))
    return False


def scarica_riquadro(S, W, N, E, z=Z, log=print):
    x0, y1 = tile_di(W, S, z); x1, y0 = tile_di(E, N, z)
    xs, ys = range(int(x0), int(x1) + 1), range(int(y0), int(y1) + 1)
    tot = len(xs) * len(ys); log('esri: %d tile (z%d)' % (tot, z)); n = 0
    for y in ys:
        for x in xs:
            scarica(x, y, z); n += 1
            if n % 500 == 0: log('esri: %d/%d' % (n, tot))


class Foto:
    """pixel delle tile Esri sotto un poligono; to_ll(x, z) -> (lon, lat) dalle coordinate del gioco. scarica=True prende le tile che mancano"""
    def __init__(self, to_ll, z=Z, scarica=True):
        self.to_ll, self.z, self.sc = to_ll, z, scarica; self.cache = {}

    def _tile(self, x, y):
        k = (x, y)
        if k not in self.cache:
            if len(self.cache) > 400: self.cache.clear()
            ok = os.path.exists(_file(self.z, x, y)) and os.path.getsize(_file(self.z, x, y)) > 0
            if not ok and self.sc: ok = scarica(x, y, self.z)
            self.cache[k] = np.asarray(Image.open(_file(self.z, x, y)).convert('RGB')) if ok else None
        return self.cache[k]

    def tiles_per(self, geom):
        """le tile (x, y) sotto la geometria (gioco)"""
        x0, z0, x1, z1 = geom.bounds
        (lo0, la0), (lo1, la1) = self.to_ll(x0, z1), self.to_ll(x1, z0)   # z cresce verso sud
        a, b = tile_di(lo0, la0, self.z), tile_di(lo1, la1, self.z)
        return [(x, y) for x in range(int(a[0]), int(b[0]) + 1) for y in range(int(b[1]), int(a[1]) + 1)]

    def pixel(self, geom):
        """(N x 3 pixel dentro la geometria, finestra RGB intera, maschera) oppure None se la foto manca"""
        x0, z0, x1, z1 = geom.bounds
        (lo0, la0), (lo1, la1) = self.to_ll(x0 - 6, z0 - 6), self.to_ll(x1 + 6, z1 + 6)
        a, b = tile_di(lo0, la0, self.z), tile_di(lo1, la1, self.z)   # a: nord-ovest (y piccola), b: sud-est
        tx0, tx1, ty0, ty1 = int(a[0]), int(b[0]), int(a[1]), int(b[1])
        W = np.zeros(((ty1 - ty0 + 1) * 256, (tx1 - tx0 + 1) * 256, 3), np.uint8)
        for y in range(ty0, ty1 + 1):
            for x in range(tx0, tx1 + 1):
                t = self._tile(x, y)
                if t is None: return None
                W[(y - ty0) * 256:(y - ty0 + 1) * 256, (x - tx0) * 256:(x - tx0 + 1) * 256] = t
        px0, py0 = int(a[0] * 256) - tx0 * 256, int(a[1] * 256) - ty0 * 256
        px1, py1 = int(b[0] * 256) - tx0 * 256 + 1, int(b[1] * 256) - ty0 * 256 + 1
        win = W[py0:py1, px0:px1]
        m = Image.new('L', (win.shape[1], win.shape[0]), 0); d = ImageDraw.Draw(m)
        polys = list(geom.geoms) if hasattr(geom, 'geoms') else [geom]
        for p in polys:
            for ring, fill in [(p.exterior, 1)] + [(r, 0) for r in p.interiors]:
                pts = []
                for x, z in ring.coords:
                    lo, la = self.to_ll(x, z); tx, ty = tile_di(lo, la, self.z); pts.append(((tx - tx0) * 256 - px0, (ty - ty0) * 256 - py0))
                d.polygon(pts, fill=fill)
        mk = np.asarray(m, bool)
        return win[mk], win, mk


def da_gioco(to_ll, scarica=True):
    """Strumento comune: Foto pronta all'uso dalle altre parti della build. to_ll(x, z) -> (lon, lat) dal gioco.
       f = esri_foto.da_gioco(to_ll); f.pixel(poligono_shapely_in_coordinate_gioco) -> (pixel Nx3, finestra RGB, maschera) o None;
       f.bbox(x0, z0, x1, z1) -> finestra RGB che copre il riquadro (coordinate gioco) o None; f.tiles_per(geom) -> tile da scaricare"""
    f = Foto(to_ll, scarica=scarica)
    def bbox(x0, z0, x1, z1):
        from shapely.geometry import box
        r = f.pixel(box(x0, z0, x1, z1)); return None if r is None else r[1]
    f.bbox = bbox; return f


if __name__ == '__main__':
    a = sys.argv[1:]
    S, W, N, E = [float(v) for v in a[:4]] if len(a) >= 4 else (45.635, 9.12, 45.69, 9.19)
    scarica_riquadro(S, W, N, E, int(a[4]) if len(a) > 4 else Z)


# ------------------------------------------------------------------ "tetto o non tetto" dai pixel di una pianta
NOMI = ['luce', 'dev_luce', 'r', 'g', 'b', 'exg', 'verde', 'sat', 'scuro', 'bordi', 'tessitura', 'dev_r', 'dev_g', 'stacco_col', 'stacco_luce', 'bordo']


def _grad(L):
    gy = np.abs(np.diff(L, axis=0, prepend=L[:1])); gx = np.abs(np.diff(L, axis=1, prepend=L[:, :1])); return gx + gy


def caratteristiche(res):
    """vettore di numeri dai pixel di una pianta (gia' ristretta di 1 m); res = Foto.pixel(). None se i pixel sono troppo pochi"""
    if res is None: return None
    P, win, mk = res
    if len(P) < 60: return None
    P = P.astype(np.float32); r, g, b = P[:, 0], P[:, 1], P[:, 2]; s = r + g + b + 1.0; L = s / 3
    mx, mn = P.max(1), P.min(1)
    Lw = win.astype(np.float32).mean(2); G = _grad(Lw)
    from scipy.ndimage import uniform_filter, binary_dilation
    # il tetto si stacca dal terreno attorno: i pixel dentro contro l'anello 1-3 m fuori dalla pianta, e il gradiente lungo il bordo
    d7 = binary_dilation(mk, iterations=7); ring = binary_dilation(mk, iterations=16) & ~d7; band = d7 & ~binary_dilation(mk, iterations=3)
    Wf = win.astype(np.float32)
    if ring.sum() >= 40 and band.sum() >= 20:
        mi, mo = Wf[mk].mean(0), Wf[ring].mean(0); stc = float(np.abs(mi - mo).sum()); stl = float(abs(mi.mean() - mo.mean())); bor = float(G[band].mean())
    else: stc = stl = bor = 0.0
    loc = np.sqrt(np.maximum(uniform_filter(Lw * Lw, 5) - uniform_filter(Lw, 5) ** 2, 0))
    return np.array([L.mean(), L.std(), (r / s).mean(), (g / s).mean(), (b / s).mean(), ((2 * g - r - b) / s).mean(), ((2 * g - r - b) > 25).mean(),
                     ((mx - mn) / (mx + 1)).mean(), (L < 55).mean(), G[mk].mean(), loc[mk].mean(), (r / s).std(), (g / s).std(), stc, stl, bor], np.float32)


class Modello:
    """regressione logistica con i quadrati dei numeri; positivi: tetti sicuri; negativi: terreno senza edifici"""
    def fit(self, X, y, l2=1.0, it=40):
        self.mu, self.sd = X.mean(0), X.std(0) + 1e-6
        A = self._a(X); w = np.zeros(A.shape[1]); R = l2 * np.eye(A.shape[1]); R[0, 0] = 0
        for _ in range(it):
            p = 1 / (1 + np.exp(-np.clip(A @ w, -30, 30)))
            H = A.T @ (A * (p * (1 - p))[:, None]) + R + 1e-6 * np.eye(len(w)); gr = A.T @ (p - y) + R @ w
            w -= np.linalg.solve(H, gr)
        self.w = w; return self

    def _a(self, X): Z = (X - self.mu) / self.sd; return np.column_stack((np.ones(len(Z)), Z, Z ** 2))
    def p(self, X): return 1 / (1 + np.exp(-np.clip(self._a(X) @ self.w, -30, 30)))
