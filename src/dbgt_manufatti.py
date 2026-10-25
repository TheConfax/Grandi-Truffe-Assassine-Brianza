# Motore nuovo, sezione 7 (docs/motore.md): manufatti, aree attrezzate, parcheggi, acqua ferma, linee elettriche e altezza degli alberi dal DBGT,
# con le altezze dal DSM First LiDAR 2008 (data/terreno/lidar_dsm, stessa griglia del DTM) dove il DSM le vede e combaciano con la forma.
# Dove c'e' il DBGT (dentro il confine del comune meno 3 m, lo stesso dbt_cover di build_data.py):
#   - MN_IND (manufatti industriali, Specifiche di contenuto regionali v2.0 p. 157-158): 01 cabina elettrica e 03 cabina gas -> edifici semplici
#     (scatola), 13 serra -> serra (vetro, paesaggio3.js), 12 torre piezometrica -> torre dell'acqua (paesaggio3.js lsTower), 07 contenitore
#     industriale protetto e 0702 serbatoio -> cilindro se la pianta e' tonda, altrimenti prisma ('mf' nelle tile, oggetti3.js buildManufatti),
#     11 vasca -> bordo di calcestruzzo con l'acqua dentro ('mf'). Gli edifici OSM che li doppiano (cabine power=substation, serre) si tolgono.
#   - MN_INT 01 (manufatti industriali, punto) sono il simbolo degli stessi contenitori 07 (19 su 21 entro 3 m): niente di nuovo, nel rapporto.
#   - MN_RTC 03 (rete di telecomunicazione, punto): 6 su 8 sono le antenne OSM; dove OSM non ha un'antenna entro 15 m e il DSM vede una
#     struttura alta, un'antenna ('og') con quell'altezza. MN_ARR (monumenti, tabernacoli, arredo) sono simboli senza misura: nel rapporto.
#   - MAN_TR (spartitraffico, isole, rotatoria) e AC_VEI li disegna il lavoro delle strade (src/dbgt_strade.py): qui niente.
#   - PAR_AR nel DBGT non sono i parcheggi ma i "particolari architettonici" (02 scale esterne degli edifici): lavoro degli edifici, nel rapporto.
#     I parcheggi del DBGT sono AC_VEI ZON 0301 ("parcheggi liberi"): la loro forma va al generatore dei posti auto ('pk' nelle tile,
#     landmarks3.js buildParkingLines); un parcheggio OSM coperto da uno del DBGT non genera piu' i suoi posti ('ns'), la capienza OSM resta.
#   - AATT (aree attrezzate del suolo: 01 cortile, 02 corte, 06 spazio interno, 95 altro) non si sovrappongono a nessun'altra superficie del
#     DBGT: pavimentazione di cortile neutra (tipo d'area 17), tolte le zone pavimentate o d'acqua di OSM.
#   - SP_ACQ, INVASO: specchi d'acqua (area 6) sul terreno, ritagliati dove il DTM sta sotto il pelo dell'acqua.
#   - TRALIC (basi dei tralicci) e TR_ELE (tracciati): le linee aeree del DBGT coincidono con quelle OSM entro 1 m; i vertici OSM vanno sulle
#     basi DBGT, i tralicci hanno l'altezza del DSM (massimo sopra la base) e i fili partono da li' ('pw' con le quote per vertice). I TR_ELE
#     senza tralicci e lontani da OSM sono cavi interrati: niente.
#   - Alberi (tutti quelli di Meda dopo dbgt_verde.py): altezza = massimo di DSM - DTM entro 2,5 m (fuori dagli edifici), chioma dalla
#     discesa del DSM attorno alla cima; dove il DSM non vede l'albero l'altezza tipica (mediana degli alberi visti).
# build_data.py chiama Manufatti(...) e poi .edifici(), .aree(), .elettrico(), .alberi(), .uscite(); fuori dal DBGT non cambia niente.
# Da solo (python src/dbgt_manufatti.py [rapporto.json]) stampa il censimento e le altezze senza OSM.
import os, sys, json, math, sqlite3, time
from collections import Counter, defaultdict
import numpy as np, shapely
from shapely import wkb, prepare
from shapely.geometry import Polygon, LineString, Point, box, GeometryCollection
from shapely.ops import unary_union
from shapely.strtree import STRtree
from pyproj import Transformer

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq

LAT0, LON0 = 45.6575, 9.154
TILE = 250.0
# MN_IND_TY, Specifiche di contenuto regionali v2.0 (febbraio 2022) p. 157-158
TIPI_IND = {'01': 'cabina trasformazione energia', '02': 'cabina rete acqua', '03': 'cabina rete gas', '04': 'aeromotore', '05': 'torre di raffreddamento',
            '06': 'ciminiera', '07': 'contenitore industriale protetto', '0703': 'silo', '0702': 'serbatoio', '070203': 'serbatoio pensile', '070202': 'serbatoio in superficie',
            '070201': 'serbatoio interrato', '0701': 'cisterna', '08': 'impianti produzione energia', '0803': 'pannello solare', '0802': 'pannello fotovoltaico',
            '0801': 'pala eolica', '09': 'pozzo/stazione di pompaggio', '10': 'forno', '11': 'vasca', '12': 'torre piezometrica', '13': 'serra', '14': 'idrovora',
            '15': 'abbeveratoio', '95': 'altro'}
# what the game draws for each: an OSM-like building, a cylinder or prism ('mf'), a basin ('mf'), a water tower
CABINA, SERRA, TORRE, CONT, VASCA = 'cabina', 'serra', 'torre', 'contenitore', 'vasca'
RESA = {'01': CABINA, '02': CABINA, '03': CABINA, '07': CONT, '0703': CONT, '0702': CONT, '070202': CONT, '070203': CONT, '0701': CONT, '11': VASCA, '12': TORRE, '13': SERRA}
# heights accepted from the DSM (m): outside these the reading is something else (a tree over a cabin, a roof next to it)
LIM = {CABINA: (2.0, 12.0), SERRA: (2.0, 8.0), TORRE: (10.0, 60.0), CONT: (2.0, 30.0), VASCA: (0.0, 6.0)}
VASCA_RIM = 0.3      # a basin the DSM sees at ground level: a low concrete rim, the water just under it
TORRE_CAB = 6.0      # m: an electric cabin this high on a plan of 40 m2 at most is a tower cabin
TUNNEL_W = 9.0       # m: a rectangular greenhouse at most this wide and 1.8 times as long is a plastic tunnel, unless the photo says otherwise
TONDO = 0.85         # 4 pi A / P^2 above this: a round tank or silo (a cylinder), else a prism
DUP_OSM = 0.3        # a manufatto this much inside a bigger OSM building is part of it (the building stays, the manufatto is not added)
DUP_BLD = 0.5        # an OSM building this much on a manufatto is that manufatto (it goes, the DBGT shape comes in)
TOWER_SNAP = 15.0    # an OSM pylon this close to a DBGT base is that pylon
TOWER_MIN_DSM = 20.0  # a lattice pylon: the DSM catches its top only now and then; below this the reading is the lower steel
ALB_R = 2.5          # tree height: highest DSM - DTM within this of the point (the DBGT point is the middle of the crown)
ALB_SEEN = 2.5       # below this the DSM does not see a tree there (planted after 2008, or nothing standing)
ALB_H = (3.0, 35.0)  # m
ALB_D = (2.0, 18.0)  # crown diameter, m
ALB_CMIN, ALB_CFR, ALB_CR = 2.0, 0.25, 10.0  # crown: canopy pixels at least this high (m, and times the height), at most this far from the tree (m)
ALB_SPORGE = 1.5     # m a crown may reach over a building's wall
CLEAR, MOVE = 0.4, 3.0  # as dbgt_verde.py: a trunk off a manufatto, moved at most this far
ALB_BLD = 3.0        # DSM pixels this close to a DBGT building and as high as its roof are the roof (2008 and 2015 are a metre or two apart)
WIRE_R, WIRE_R_MT, PYL_R = 9.0, 3.0, 5.0  # m: around a high-voltage line (its outer conductors are 6.5 m off the axis), a minor line, a pylon
VASCA_TERRA = 0.5    # a basin whose DSM median is under this is in the ground (a rim), whatever stands around it
INTERRATO = 1.5      # a container the DSM does not see, its p90 under this: in the ground (0702 of x -431 z -75, a paved strip in the photo)
FOTO_R = 3.0         # m: a line of src/manufatti_foto.json is the manufatto of the same code whose centre is this close
DOPPIA = 0.5         # a cabin more than this much inside a bigger one is part of it (none in Meda: the two gas cabins of x 274 z -76 touch)
try: FOTO = json.load(open(os.path.join(HERE, 'manufatti_foto.json'), encoding='utf-8'))['oggetti']
except Exception: FOTO = []


def _geom(b): f = b[3]; return wkb.loads(bytes(b[8 + [0, 32, 48, 48, 64][(f >> 1) & 7]:]))


def _parts(g):
    if g is None or g.is_empty: return []
    if g.geom_type in ('Polygon', 'LineString', 'Point'): return [g]
    return [p for q in getattr(g, 'geoms', []) for p in _parts(q)]


def _polys(g, amin=0.0): return [p for p in _parts(g) if p.geom_type == 'Polygon' and p.area >= amin]


def _pct(a, q):
    a = np.asarray(a, float); a = a[np.isfinite(a)]
    return round(float(np.percentile(a, q)), 2) if len(a) else None


class Grid:
    """A window of the LiDAR lattice (0.00001 deg, PixelIsPoint) over a box in game metres, in memory: DTM, DSM and their difference."""
    def __init__(self, bounds, pad=30.0, d_dtm=None, d_dsm=None):
        self.dtm = dq.Lidar(d_dtm); self.dsm = dq.Lidar(d_dsm or os.path.join(dq.DATA, 'terreno', 'lidar_dsm'))
        L = self.dtm; x0, z0, x1, z1 = bounds
        lonA, latA = dq.game_to_lonlat(x0 - pad, z1 + pad); lonB, latB = dq.game_to_lonlat(x1 + pad, z0 - pad)
        self.c0 = int(math.floor((lonA - L.lon0) / L.sx)); c1 = int(math.ceil((lonB - L.lon0) / L.sx))
        self.r0 = int(math.floor((L.lat0 - latB) / L.sy)); r1 = int(math.ceil((L.lat0 - latA) / L.sy))
        self.shape = (r1 - self.r0 + 1, c1 - self.c0 + 1)
        self.T = self._mosaic(self.dtm); self.S = self._mosaic(self.dsm) if self.dsm.t else np.full(self.shape, np.nan, np.float32)
        self.N = self.S - self.T  # DSM - DTM
        self.ok = bool(self.dsm.t) and np.isfinite(self.N).any()
        # metres per pixel along x and z (the lattice is in degrees)
        self.mx = L.sx * dq.KX; self.mz = L.sy * dq.KZ

    def _mosaic(self, L):
        A = np.full(self.shape, np.nan, np.float32)
        if not L.t: return A
        if (L.lon0, L.lat0, L.sx, L.sy) != (self.dtm.lon0, self.dtm.lat0, self.dtm.sx, self.dtm.sy):
            dc = int(round((L.lon0 - self.dtm.lon0) / L.sx)); dr = int(round((self.dtm.lat0 - L.lat0) / L.sy))
        else: dc = dr = 0
        for t in L.t:
            tc0, tr0 = t['c0'] + dc - self.c0, t['r0'] + dr - self.r0
            a0, a1 = max(0, tc0), min(self.shape[1], tc0 + t['w']); b0, b1 = max(0, tr0), min(self.shape[0], tr0 + t['h'])
            if a0 >= a1 or b0 >= b1: continue
            A[b0:b1, a0:a1] = L._arr(t)[b0 - tr0:b1 - tr0, a0 - tc0:a1 - tc0]; t['a'] = None
        return A

    def rc(self, x, z):  # game metres -> fractional (row, col) in the window
        lon, lat = dq.game_to_lonlat(np.asarray(x, float), np.asarray(z, float))
        return (self.dtm.lat0 - lat) / self.dtm.sy - self.r0, (lon - self.dtm.lon0) / self.dtm.sx - self.c0

    def xz(self, r, c):  # pixel centre -> game metres
        lon = self.dtm.lon0 + (np.asarray(c) + self.c0) * self.dtm.sx; lat = self.dtm.lat0 - (np.asarray(r) + self.r0) * self.dtm.sy
        return dq.to_game_lonlat(lon, lat)

    def at(self, A, x, z):  # bilinear, NaN outside
        r, c = self.rc(x, z); r0, c0 = np.floor(r).astype(int), np.floor(c).astype(int); fr, fc = r - r0, c - c0
        out = np.zeros(np.shape(r)); w = np.zeros(np.shape(r))
        for dr, dc, ww in ((0, 0, (1 - fr) * (1 - fc)), (0, 1, (1 - fr) * fc), (1, 0, fr * (1 - fc)), (1, 1, fr * fc)):
            rr, cc = r0 + dr, c0 + dc; ins = (rr >= 0) & (rr < self.shape[0]) & (cc >= 0) & (cc < self.shape[1])
            v = np.full(np.shape(r), np.nan); v[ins] = A[rr[ins], cc[ins]]; g = np.isfinite(v); out[g] += v[g] * ww[g]; w[g] += ww[g]
        return np.where(w > 1e-6, out / np.maximum(w, 1e-6), np.nan)

    def roofs(self, polys, inner=0.5, outer=3.0, tol=2.5):
        """the pixels of the buildings' roofs: inside each polygon grown by inner, and around it up to outer where DSM - DTM is within tol
        of the roof (median inside): the DSM of 2008 and the DBGT of 2015 are a metre or two apart, the roof edge spills out; a lower
        crown beside the wall stays"""
        M = np.zeros(self.shape, bool)
        for p in polys:
            x0, z0, x1, z1 = p.buffer(outer).bounds
            ra, ca = self.rc(x0, z1); rb, cb = self.rc(x1, z0); ra, rb = min(ra, rb), max(ra, rb); ca, cb = min(ca, cb), max(ca, cb)
            r0, r1 = max(0, int(math.floor(ra))), min(self.shape[0] - 1, int(math.ceil(rb))); c0, c1 = max(0, int(math.floor(ca))), min(self.shape[1] - 1, int(math.ceil(cb)))
            if r0 > r1 or c0 > c1: continue
            R, C = np.mgrid[r0:r1 + 1, c0:c1 + 1]; R, C = R.ravel(), C.ravel(); X, Z = self.xz(R, C); v = self.N[R, C]
            ins, din, dout = shapely.contains_xy(p, X, Z), shapely.contains_xy(p.buffer(inner), X, Z), shapely.contains_xy(p.buffer(outer), X, Z)
            hb = np.nanmedian(v[ins]) if np.isfinite(v[ins]).any() else np.inf
            m = din | (dout & (v >= hb - tol)); M[R[m], C[m]] = True
        return M

    def near(self, A, x, z):  # nearest pixel, NaN outside
        r, c = self.rc(x, z); r, c = np.rint(r).astype(int), np.rint(c).astype(int)
        ins = (r >= 0) & (r < self.shape[0]) & (c >= 0) & (c < self.shape[1]); v = np.full(np.shape(r), np.nan)
        v[ins] = A[r[ins], c[ins]]; return v

    def mask(self, polys, buf=0.0):  # pixels inside any polygon (buffered)
        M = np.zeros(self.shape, bool)
        for p in polys:
            g = p.buffer(buf) if buf else p
            x0, z0, x1, z1 = g.bounds
            ra, ca = self.rc(x0, z1); rb, cb = self.rc(x1, z0)  # rows grow southwards, with z: z1 is the last row (min/max, or the mask was empty)
            ra, rb = min(ra, rb), max(ra, rb); ca, cb = min(ca, cb), max(ca, cb)
            r0, r1 = max(0, int(math.floor(ra))), min(self.shape[0] - 1, int(math.ceil(rb))); c0, c1 = max(0, int(math.floor(ca))), min(self.shape[1] - 1, int(math.ceil(cb)))
            if r0 > r1 or c0 > c1: continue
            R, C = np.mgrid[r0:r1 + 1, c0:c1 + 1]; X, Z = self.xz(R.ravel(), C.ravel())
            m = shapely.contains_xy(g, X, Z); M[R.ravel()[m], C.ravel()[m]] = True
        return M


def _pts_in(g, step=0.5):
    x0, z0, x1, z1 = g.bounds
    X, Z = np.meshgrid(np.arange(x0 + step / 2, x1, step), np.arange(z0 + step / 2, z1, step)); X, Z = X.ravel(), Z.ravel()
    m = shapely.contains_xy(g, X, Z)
    if m.sum() < 3: c = g.representative_point(); return np.array([c.x]), np.array([c.y])
    return X[m], Z[m]


class Manufatti:
    def __init__(self, dbt_dir, comuni, cover, log=print, to_game=None, origin=(0.0, 0.0), dsm_dir=None, rect=None):
        """cover: dbt_cover of build_data.py; rect: the map (RECT), nothing outside it"""
        t0 = time.time(); self.log = log; self.origin = origin
        self.cover = cover.intersection(rect) if rect is not None and not cover.is_empty else cover; prepare(self.cover); cover = self.cover
        self.rep = {'comuni': [], 'censimento': {}, 'note': {}}
        tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
        tg = to_game or dq.to_game_lonlat
        tf = lambda g: shapely.transform(shapely.force_2d(g), lambda a: np.column_stack(tg(*tr.transform(a[:, 0], a[:, 1]))))
        self.ind, self.mnint, self.rtc, self.arr, self.aatt, self.park, self.acqua, self.tral, self.tre, self.blds, self.carr = [], [], [], [], [], [], [], [], [], [], []
        cnt = Counter()
        for d in (sorted(os.listdir(dbt_dir)) if os.path.isdir(dbt_dir) else []):
            f = os.path.join(dbt_dir, d, 'dbgt.gpkg')
            if not os.path.exists(f) or d.lower() not in comuni: continue
            con = sqlite3.connect(f); self.rep['comuni'].append(d)
            def rows(sql, z=False):
                out = []
                try:
                    for r in con.execute(sql):
                        if r[0] is None: continue
                        g3 = _geom(r[0]); out.append((tf(g3),) + tuple(r[1:]) + ((g3,) if z else ()))
                except sqlite3.OperationalError: pass
                return out
            for g, ty, so in rows('select s.Shape, m.MN_IND_TY, m.MN_IND_SO from MN_IND_MN_IND_SUP s join MN_IND m on s.CLASSREF = m.CLASSID'):
                cnt['MN_IND %s %s' % (ty, TIPI_IND.get(ty, '?'))] += 1
                if so == '02': continue  # sotterraneo
                for p in _polys(g.buffer(0), 1.0): self.ind.append({'ty': ty, 'g': p})
            for g, ty in rows('select Shape, MN_INT_TY from MN_INT'): cnt['MN_INT ' + ty] += 1; self.mnint.append((g, ty))
            for g, ty in rows('select Shape, MN_RTC_TY from MN_RTC'): cnt['MN_RTC ' + ty] += 1; self.rtc.append((g, ty))
            for g, ty in rows('select Shape, MN_ARR_TY from MN_ARR'): cnt['MN_ARR ' + ty] += 1; self.arr.append((g, ty))
            for g, ty in rows('select Shape, PAR_AR_TY from PAR_AR'): cnt['PAR_AR ' + ty] += 1
            for g, ty in rows('select s.Shape, m.MAN_TR_TY from MAN_TR_MAN_TR_SUP s join MAN_TR m on s.CLASSREF = m.CLASSID'): cnt['MAN_TR ' + ty] += 1
            for g, ty in rows('select Shape, AATT_TY from AATT'):
                cnt['AATT ' + ty] += 1
                for p in _polys(g.buffer(0), 0.5): self.aatt.append((ty, p))
            for g, z, sed in rows('select Shape, AC_VEI_ZON, AC_VEI_SED from AC_VEI_AC_VEI_SUP_SR'):
                if z == '0301' and sed in (None, '01'): self.park += _polys(g.buffer(0), 0.5)
                elif z != '0307' and sed in (None, '01'): self.carr += _polys(g.buffer(0), 0.5)
            for tab in ('SP_ACQ', 'INVASO'):
                for g, ty, g3 in rows('select Shape, %s_TY from %s' % (tab, tab), z=True):
                    cnt['%s %s' % (tab, ty)] += 1
                    zs = [c[2] for p in _parts(g3) for c in p.exterior.coords if len(c) > 2 and c[2] > 100]
                    for p in _polys(g.buffer(0), 1.0): self.acqua.append({'tab': tab, 'g': p, 'z': float(np.median(zs)) if zs else None})
            for g, ty in rows('select s.Shape, t.TRAL_TY from TRALIC_TRAL_BAS s join TRALIC t on s.CLASSREF = t.CLASSID'):
                cnt['TRALIC ' + ty] += 1; self.tral.append({'g': g.buffer(0), 'c': g.centroid})
            for g, ty in rows('select Shape, TR_ELE_TY from TR_ELE'):
                cnt['TR_ELE ' + ty] += 1; self.tre += [p for p in _parts(g) if p.geom_type == 'LineString' and p.length > 1]
            for (g,) in rows('select Shape from EDIFC_CR_EDF_IS') + rows('select Shape from EDI_MIN_CR_EDF_IS'): self.blds += _polys(g.buffer(0), 1.0)
        self.rep['censimento'] = dict(sorted(cnt.items()))
        cv = cover
        inside = lambda g: cv.contains(g.representative_point() if g.geom_type != 'Point' else g)
        self.ind = [o for o in self.ind if inside(o['g'])]; self.mnint = [o for o in self.mnint if inside(o[0])]; self.rtc = [o for o in self.rtc if inside(o[0])]
        self.arr = [o for o in self.arr if inside(o[0])]; self.aatt = [(t, q) for t, p in self.aatt for q in (_polys(p.intersection(cv), 0.5) if not cv.contains(p) else [p])]
        self.park = [q for p in self.park for q in (_polys(p.intersection(cv), 0.5) if not cv.contains(p) else [p])]
        self.acqua = [o for o in self.acqua if inside(o['g'])]; self.tral = [o for o in self.tral if cv.contains(o['c'])]
        self.tre = [q for p in self.tre for q in _parts(p.intersection(cv.buffer(50))) if q.geom_type == 'LineString']
        self.grid = Grid(cv.bounds, d_dsm=dsm_dir) if not cv.is_empty else None
        self.bld_mask = self.grid.mask(self.blds, 0.5) if self.grid is not None else None
        self._misura()
        self.mf = []          # tile objects: containers and basins
        self.new_blds = []    # building records for cabins, greenhouses, water towers
        self.ns_ids = set()   # OSM car parks whose stalls the DBGT car park draws
        self.pw = []          # power lines with per-vertex heights
        self.pk = []          # DBGT car parks (polygons)
        log('dbgt manufatti: MN_IND', len(self.ind), 'AATT', len(self.aatt), 'parcheggi 0301', len(self.park), 'acqua', len(self.acqua), 'tralicci', len(self.tral),
            'tracciati', len(self.tre), 'DSM', 'si' if self.grid is not None and self.grid.ok else 'no', '%.0fs' % (time.time() - t0))

    # ---------------------------------------------------------------- heights of the manufatti from DSM - DTM
    def _misura(self):
        G = self.grid; per = defaultdict(list); occ = [o['g'] for o in self.ind] + self.blds; ot = STRtree(occ) if occ else None
        for o in self.ind:  # what the photos say of it (src/manufatti_foto.json), if anything
            c = o['g'].centroid; fs = [f for f in FOTO if f['ty'] == o['ty'] and math.hypot(f['x'] - c.x, f['z'] - c.y) < FOTO_R]
            o['foto'] = min(fs, key=lambda f: math.hypot(f['x'] - c.x, f['z'] - c.y)) if fs else {}
        for o in self.ind:
            g, kind = o['g'], RESA.get(o['ty'])
            o['kind'] = kind; o['tondo'] = 4 * math.pi * g.area / max(1e-6, g.length ** 2) >= TONDO
            # a greenhouse the 2018-19 photo no longer shows (src/manufatti_foto.json): not drawn
            if kind == SERRA and o['foto'].get('forma') == 'assente': o['kind'] = None; o['seen'] = 'assente nella foto 2018-19'; o['h_dsm'] = None; continue
            if G is None or not G.ok or kind is None: o['h_dsm'] = None; continue
            gi = g.buffer(-0.4) if g.buffer(-0.4).area > 0.4 * g.area else g
            X, Z = _pts_in(gi); hv = G.at(G.N, X, Z)
            ring = g.buffer(3).difference(g.buffer(1))
            near = [occ[i] for i in ot.query(ring)] if ot is not None else []
            if near: ring = ring.difference(unary_union([q.buffer(0.5) for q in near]))
            hr = G.at(G.N, *_pts_in(ring)) if not ring.is_empty and ring.area > 1 else np.array([np.nan])
            p50, p90, rr = _pct(hv, 50), _pct(hv, 90), _pct(hr, 50)
            o['p50'], o['p90'], o['ring'] = p50, p90, rr
            if p50 is None: o['h_dsm'] = None; continue
            h = p90 if (o['tondo'] or kind == TORRE) else p50
            lo, hi = LIM[kind]; rr0 = rr if rr is not None else 0.0
            stands = np.mean(hv > 1.0) >= 0.6 and h - rr0 >= 1.0           # stands out of what is around it
            # a basin in the ground: the DSM sees the ground over most of it (at x 1633 z 15 p90 0.0 with something higher around: it got
            # the 2.8 m walls of the typical basin)
            if kind == VASCA and p50 < VASCA_TERRA: o['h_dsm'] = 0.0; o['seen'] = 'a terra'
            elif o['foto'].get('dsm') == 'no': o['h_dsm'] = None; o['seen'] = 'no, chiome sopra (foto)'
            elif stands and lo <= h <= hi: o['h_dsm'] = round(float(h), 1); o['seen'] = 'dsm'; per[o['ty']].append(h)
            else: o['h_dsm'] = None; o['seen'] = 'no'
            # a container the DSM sees as ground is under it (a buried tank: the photo shows a paved strip, no 2 m box)
            if kind == CONT and o['h_dsm'] is None and (p90 if p90 is not None else 99) < INTERRATO: o['kind'] = None; o['seen'] = 'interrato'
        # the typical height is the one of the same code (MN_IND_TY): the serbatoio 0702 of x -431 z -75, flat ground in the DSM, took the
        # 10.9 m of the silos 07; a code with nothing seen takes the lowest height of its kind
        self.typ = {k: round(float(np.median(v)), 1) for k, v in per.items()}
        for o in self.ind:
            k = o['kind']
            if k is None: continue
            if o.get('h_dsm') is not None: o['h'] = o['h_dsm']
            else: o['h'] = self.typ.get(o['ty'], LIM[k][0])
            # a small cabin the DSM does not see is a cabinet, no taller than its side and half a metre (a 4 m2 one of gas took 3.8 m)
            if k == CABINA and o.get('h_dsm') is None: o['h'] = round(min(o['h'], max(LIM[k][0], math.sqrt(o['g'].area) + 0.5)), 1)
        rep = defaultdict(lambda: Counter())
        for o in self.ind: rep[o['ty']][o.get('seen', 'tipo non disegnato')] += 1
        self.rep['altezze_manufatti'] = {'per_tipo': {t: dict(c) for t, c in rep.items()}, 'altezza_tipica_se_il_dsm_non_vede': self.typ,
                                        'per_oggetto': [{'ty': o['ty'], 'x': round(o['g'].centroid.x, 1), 'z': round(o['g'].centroid.y, 1), 'm2': round(o['g'].area, 1), 'h': o.get('h'),
                                                         'dsm_p50': o.get('p50'), 'dsm_p90': o.get('p90'), 'intorno': o.get('ring'), 'visto': o.get('seen'),
                                                         'foto': o['foto'].get('nota') if o['foto'] else None} for o in self.ind]}

    # ---------------------------------------------------------------- buildings: cabins, greenhouses, water tower
    def edifici(self, buildings, cantieri=()):
        """build_data.py's buildings (records with 'p' points): OSM, Overture or procedural buildings that double a manufatto go, the
        manufatti drawn as buildings come in. Called before bgeoms, so trees, kerbside parking and walls see them. cantieri: the OSM
        building sites (landuse=construction), newer than the survey: the manufatti inside them are gone (as the DBGT green, dbgt_verde.py;
        the basin of x 19 z 133 stood in the dark soil of the site by the Milano-Meda)"""
        cu = unary_union([g for g in cantieri if g.intersects(self.cover)]) if cantieri else GeometryCollection()
        if not cu.is_empty:
            prepare(cu); gone_c = [o for o in self.ind if o.get('kind') and cu.contains(o['g'].representative_point())]
            for o in gone_c: o['kind'] = None; o['seen'] = 'in un cantiere OSM'
            self.rep['manufatti_nei_cantieri_osm'] = [{'ty': o['ty'], 'x': round(o['g'].centroid.x, 1), 'z': round(o['g'].centroid.y, 1)} for o in gone_c]
        mine = [o for o in self.ind if o['kind'] in (CABINA, SERRA, TORRE)]
        if not mine: return buildings
        # a cabin mostly inside a bigger cabin is part of it
        cab = sorted([o for o in mine if o['kind'] == CABINA], key=lambda o: -o['g'].area); doppie = 0
        for i, o in enumerate(cab):
            if o['kind'] is None: continue
            for q in cab[i + 1:]:
                if q['kind'] is not None and q['g'].intersection(o['g']).area > DOPPIA * q['g'].area: q['kind'] = None; q['seen'] = 'dentro una cabina piu grande'; doppie += 1
        mine = [o for o in mine if o['kind'] is not None]
        # a building mostly on a manufatto (more than half of it) is that manufatto and goes; a manufatto inside a bigger building stays
        # out and the building stays (the 30% of the smaller of the two took away an industrial building of 8481 m2 at x 1402 z -1088
        # for its 53 m2 transformer cabin, and five more of 184-1664 m2)
        mt = STRtree([o['g'] for o in mine]); keep, gone, dentro = [], Counter(), Counter()
        for b in buildings:
            try: g = Polygon(b['p']).buffer(0)
            except Exception: keep.append(b); continue
            hit, inside = None, []
            if b.get('dbgt'):  # a volume of the DBGT (dbgt_edifici.py) always stays: a manufatto on it is part of it and is not added
                for i in mt.query(g):
                    if g.intersection(mine[i]['g']).area > 0.5: mine[i]['dentro'] = 'volume DBGT'
                keep.append(b); continue
            for i in mt.query(g):
                o = mine[i]; a = g.intersection(o['g']).area
                if a > DUP_BLD * g.area: hit = o; break
                if a > DUP_OSM * o['g'].area: inside.append(o)
            if hit is None:
                keep.append(b)
                for o in inside: o['dentro'] = b.get('bt') or '?'
                continue
            gone['%s (%s)' % (hit['kind'], b.get('bt'))] += 1
        for o in [o for o in mine if o.get('dentro')]: o['kind'] = None; o['seen'] = 'dentro un edificio OSM'; dentro['%s in %s' % (o['ty'], o['dentro'])] += 1
        mine = [o for o in mine if not o.get('dentro')]
        for o in mine:
            pts = [(round(x, 2), round(z, 2)) for x, z in list(o['g'].exterior.coords)[:-1]]
            holes = [[(round(x, 2), round(z, 2)) for x, z in list(i.coords)[:-1]] for i in o['g'].interiors if Polygon(i).area > 0.5]
            if o['kind'] == CABINA: rec = {'p': pts, 'h': o['h'], 't': 1, 'ht': True, 'lv': None, 'bt': 'service', 'mn': o['ty'], 'mm': self._modello(o)}
            elif o['kind'] == SERRA: rec = {'p': pts, 'h': o['h'], 't': 1, 'ht': True, 'lv': None, 'bt': 'greenhouse', 'mn': o['ty'], 'mm': self._modello(o)}
            else: rec = {'p': pts, 'h': o['h'], 't': 0, 'ht': True, 'lv': None, 'bt': 'yes', 'wt': True, 'mn': o['ty'], 'mm': self._modello(o)}
            if holes: rec['k'] = holes
            keep.append(rec); self.new_blds.append(o)
        self.rep['edifici'] = {'aggiunti': dict(Counter(o['kind'] for o in mine)), 'osm_tolti_doppi': dict(gone), 'dentro_edifici_osm_tenuti': dict(dentro),
                               'cabine_dentro_cabine': doppie, 'modelli': dict(Counter('%s %s' % (o['kind'], self._modello(o)['k']) for o in mine))}
        self.log('dbgt manufatti: edifici aggiunti', dict(Counter(o['kind'] for o in mine)), 'edifici OSM doppi tolti', dict(gone), 'manufatti dentro edifici OSM', dict(dentro))
        return keep

    # ---------------------------------------------------------------- the model of a cabin, greenhouse, water tower (paesaggio3.js)
    def _modello(self, o):
        """mm of the building record: k the model, and what the photos say (src/manufatti_foto.json), else the rule of the type.
        Cabins: 'el' electric (01, 02 water), 'gas' (03), 'torre' an electric cabin at least TORRE_CAB high on a small plan (the tall
        ENEL towers with the line coming in at the top); t roof colour, m walls. Greenhouses: 'tunnel' (an arched plastic tunnel) or
        'vetro' (glass under a ridge), c the colour of the film. Tower: s the roof's alternating colours and how many, f the shaft."""
        f, g = o.get('foto') or {}, o['g']
        if o['kind'] == CABINA:
            k = 'gas' if o['ty'] == '03' else 'torre' if o['h'] >= TORRE_CAB and g.area <= 40 else 'el'
            mm = {'k': k}
            if f.get('tetto'): mm['t'] = f['tetto']
            if f.get('muri'): mm['m'] = f['muri']
            return mm
        if o['kind'] == SERRA:
            r = g.minimum_rotated_rectangle; xs, zs = r.exterior.coords.xy; a, b = math.dist((xs[0], zs[0]), (xs[1], zs[1])), math.dist((xs[1], zs[1]), (xs[2], zs[2]))
            w, L = min(a, b), max(a, b); rect = g.area > 0.85 * r.area
            k = f.get('forma') or ('tunnel' if rect and w <= TUNNEL_W and L >= 1.8 * w else 'vetro')
            if k == 'tunnel' and not rect: k = 'vetro'  # a tunnel needs a rectangle
            mm = {'k': k}
            if f.get('telo'): mm['c'] = f['telo']
            return mm
        mm = {'k': 'torre'}
        if f.get('spicchi'): mm['s'] = f['spicchi']
        if f.get('fusto'): mm['f'] = f['fusto']
        return mm

    # ---------------------------------------------------------------- areas: yards (AATT), ponds, car parks
    def aree(self, area_geoms, land):
        """area_geoms [(type, geom)] and land [(kind, pts)] after dbgt_verde.py -> the same with the AATT yards (type 17) and the ponds (6);
        the OSM water tower drawn as land goes where the DBGT has its tower; self.ns_ids: the OSM car parks a DBGT car park replaces."""
        cv = self.cover
        if cv.is_empty: return area_geoms, land
        # OSM paving, water, building sites, cemeteries, platforms, squares over an AATT keep it: the yard is drawn around them
        # (and the pitches and playgrounds: OSM says what a place is; two courts at x -450 z 420 and x -324 z 477 were covered by the yard)
        osm_pav = [g for at, g in area_geoms if at in (2, 3, 4, 5, 6, 7, 8, 9, 10, 14) and g.intersects(cv)]
        pu = unary_union(osm_pav) if osm_pav else GeometryCollection(); prepare(pu)
        mfu = unary_union([o['g'] for o in self.ind]) if self.ind else GeometryCollection()
        out = list(area_geoms); n_a, m2_a, m2_cut = 0, 0.0, 0.0
        for ty, p in self.aatt:
            q = p.difference(pu) if pu.intersects(p) else p
            if not mfu.is_empty and mfu.intersects(q): q = q.difference(mfu)
            m2_cut += p.area - q.area
            for r in _polys(q, 2.0): out.append((17, r)); n_a += 1; m2_a += r.area
        # ponds: the water lies on the ground (the DTM of 2008 is the water where the pond was there); where the DTM is a pit deeper than
        # the DBGT level (the "lago" at x -958 z -813: the DTM bottom is 6 m under it and the valley goes on north of the polygon) the water
        # is cut to the ground under the level, and the level is no higher than the lowest bank (no wall of water hanging over the slope)
        G = self.grid; nw = []
        for o in self.acqua:
            g = o['g']; zw = o['z']
            if G is None: out.append((6, g)); nw.append({'m2': round(g.area)}); continue
            X, Z = _pts_in(g, 1.0); L = G.at(G.T, X, Z)
            bx, bz = np.array([g.exterior.interpolate(s).x for s in np.arange(0, g.exterior.length, 1.0)]), np.array([g.exterior.interpolate(s).y for s in np.arange(0, g.exterior.length, 1.0)])
            Lb = G.at(G.T, bx, bz); flat = (_pct(L, 95) or 0) - (_pct(L, 5) or 0) < 1.0
            if flat or zw is None: q = g; lev = None
            else:
                lev = min(zw, (_pct(Lb, 10) or zw) + 0.3)
                ins = L <= lev + 0.3
                cells = [box(x - 0.5, z - 0.5, x + 0.5, z + 0.5) for x, z in zip(X[ins], Z[ins])]
                q = unary_union(cells).buffer(0.6).buffer(-0.6).intersection(g) if cells else GeometryCollection()
            for r in _polys(q, 4.0): out.append((6, r))
            nw.append({'tab': o['tab'], 'm2': round(g.area), 'acqua_m2': round(sum(r.area for r in _polys(q, 4.0))), 'z_dbgt': o['z'], 'dtm_p5': _pct(L, 5), 'dtm_p95': _pct(L, 95),
                       'piano': bool(flat), 'livello': None if lev is None else round(lev, 2), 'x': round(g.centroid.x, 1), 'z': round(g.centroid.y, 1)})
        # car parks: AC_VEI 0301 pieces merged; an OSM car park mostly under one keeps its paving and capacity, the stalls come from the DBGT shape
        pk = _polys(unary_union(self.park).buffer(0.05).buffer(-0.05), 20.0) if self.park else []
        self.pk = pk; pt = STRtree(pk) if pk else None; n_ns = 0
        for at, g in area_geoms:
            if at != 4 or pt is None or not g.intersects(cv): continue
            a = sum(g.intersection(pk[i]).area for i in pt.query(g))
            if a > 0.3 * g.area: self.ns_ids.add(id(g)); n_ns += 1
        osm_pk = unary_union([g for at, g in area_geoms if at == 4 and g.intersects(cv)])
        nuovi = sum(1 for p in pk if p.intersection(osm_pk).area < 0.3 * p.area) if pk else 0
        # an OSM car park that keeps its own stalls (less than 30% under the DBGT one) keeps them alone: the DBGT car park is cut around
        # it (three of them drew two sets of stalls over 195-703 m2)
        keep_osm = unary_union([g for at, g in area_geoms if at == 4 and g.intersects(cv) and id(g) not in self.ns_ids])
        if pk and not keep_osm.is_empty:
            m2_0 = sum(p.area for p in pk); pk = [q for p in pk for q in _polys(p.difference(keep_osm) if p.intersects(keep_osm) else p, 20.0)]
            self.pk = pk; self.rep['parcheggi_dbgt_m2_sotto_parcheggi_osm_con_posti_propri'] = round(m2_0 - sum(p.area for p in pk))
        # the water tower of OSM drawn as land, where the DBGT has the tower (MN_IND 12)
        tw = [o['g'].centroid for o in self.ind if o['kind'] == TORRE]; out_land, n_lt = [], 0
        for k, pts in land:
            if k.startswith('torre_acqua') and len(pts) >= 3 and any(Polygon(pts).centroid.distance(c) < 20 for c in tw): n_lt += 1; continue
            out_land.append((k, pts))
        self.rep['aree'] = {'aatt_pezzi': n_a, 'aatt_m2': round(m2_a), 'aatt_m2_sotto_zone_osm_o_manufatti': round(m2_cut), 'aatt_tipi': dict(Counter(t for t, p in self.aatt)),
                            'acqua': nw, 'parcheggi_dbgt': len(pk), 'parcheggi_dbgt_m2': round(sum(p.area for p in pk)), 'parcheggi_dbgt_senza_osm': nuovi,
                            'parcheggi_osm_senza_posti_propri': n_ns, 'torre_acqua_osm_tolte': n_lt}
        self.log('dbgt manufatti: cortili AATT', n_a, round(m2_a), 'm2; specchi d acqua', len(nw), '; parcheggi DBGT', len(pk), 'di cui senza OSM', nuovi, 'parcheggi OSM che li lasciano al DBGT', n_ns)
        return out, out_land

    # ---------------------------------------------------------------- pylons, wires, masts, the water tower object
    def elettrico(self, ogg, power_lines, OGG, ground=None):
        """ogg: build_data.py's objects [kind, X, Z, angle, extra] (dm); power_lines [(pts, h)]; OGG the list of kinds. Returns the two lists:
        OSM pylons inside the cover replaced by the DBGT bases (height from the DSM), the lines through them kept here with a height per
        vertex (self.pw), masts where only the DBGT has them, the OSM water tower object where the DBGT draws it."""
        cv, G = self.cover, self.grid
        self.lines_all = [(p, h) for p, h in power_lines if len(p) >= 2 and LineString(p).intersects(cv.buffer(20))]  # the trees under them (alberi)
        if cv.is_empty: return ogg, power_lines
        kt, ka, kw = OGG.index('traliccio'), OGG.index('antenna'), OGG.index('torre_acqua')
        osm_t = [(i, o[1] / 10, o[2] / 10, o[4]) for i, o in enumerate(ogg) if o[0] == kt]
        masts = [(o[1] / 10, o[2] / 10) for o in ogg if o[0] == ka]
        lines_u = unary_union([LineString(p) for p, h in power_lines if len(p) >= 2]) if power_lines else GeometryCollection()
        tre_u = unary_union(self.tre) if self.tre else GeometryCollection()
        towers, tele = [], 0
        for o in self.tral:
            c = o['c']
            on_line = (not tre_u.is_empty and tre_u.distance(c) < 3) or (not lines_u.is_empty and lines_u.distance(c) < TOWER_SNAP)
            if not on_line and any(math.dist((c.x, c.y), m) < 5 for m in masts): tele += 1; continue  # a telecom mast OSM already has
            h = None
            if G is not None and G.ok:
                X, Z = _pts_in(o['g'].buffer(1.5)); hv = G.at(G.N, X, Z)
                if np.isfinite(hv).any() and np.nanmax(hv) >= TOWER_MIN_DSM: h = round(float(np.nanmax(hv)), 1)
            towers.append({'x': c.x, 'z': c.y, 'h_dsm': h, 'm2': round(o['g'].area, 1)})
        hs = [t['h_dsm'] for t in towers if t['h_dsm'] is not None]; htyp = round(float(np.median(hs)), 1) if hs else 30.0
        for t in towers: t['h'] = t['h_dsm'] if t['h_dsm'] is not None else htyp
        # OSM pylons matched to a DBGT base
        T = np.array([(t['x'], t['z']) for t in towers]) if towers else np.zeros((0, 2))
        drop, matched = set(), {}
        for i, x, z, ex in osm_t:
            if not len(T): break
            d = np.hypot(T[:, 0] - x, T[:, 1] - z); j = int(np.argmin(d))
            if d[j] < TOWER_SNAP: drop.add(i); matched[(round(x, 1), round(z, 1))] = j
        # lines: each vertex near a DBGT base goes onto it; the lines touched keep a height per vertex and are drawn from here
        new_pl, used = [], set()
        osm_h = {(round(o[1] / 10, 1), round(o[2] / 10, 1)): (o[4] or 30.0) for o in ogg if o[0] == kt}
        moved = []
        for pts, h in power_lines:
            P, hv, touched = [], [], False
            for p in pts:
                j = None
                if len(T):
                    d = np.hypot(T[:, 0] - p[0], T[:, 1] - p[1]); jj = int(np.argmin(d))
                    if d[jj] < TOWER_SNAP and cv.buffer(TOWER_SNAP).contains(Point(p)): j = jj
                if j is not None: P.append((float(T[j, 0]), float(T[j, 1]))); hv.append(towers[j]['h']); touched = True; used.add(j); moved.append(math.dist(p, T[j]))
                else: P.append(tuple(p)); hv.append(osm_h.get((round(p[0], 1), round(p[1], 1)), 30.0 if h > 15 else 9.0))
            if touched and h > 15: self.pw.append({'p': P, 'ht': hv, 'h': h})
            else: new_pl.append((pts, h))
        # pylon objects: the DBGT bases, cross arms square to the line through them
        def line_dir(j):
            x, z = T[j]
            for L in self.pw:
                for k, p in enumerate(L['p']):
                    if math.dist(p, (x, z)) < 0.01:
                        a, b = L['p'][max(0, k - 1)], L['p'][min(len(L['p']) - 1, k + 1)]
                        if a != b: return math.atan2(b[0] - a[0], b[1] - a[1])
            if not tre_u.is_empty:
                for Ls in self.tre:
                    if Ls.distance(Point(x, z)) < 3:
                        s = Ls.project(Point(x, z)); a, b = Ls.interpolate(max(0, s - 5)), Ls.interpolate(min(Ls.length, s + 5)); return math.atan2(b.x - a.x, b.y - a.y)
            return 0.0
        out = [o for i, o in enumerate(ogg) if i not in drop]
        for j, t in enumerate(towers): out.append([kt, int(round(t['x'] * 10)), int(round(t['z'] * 10)), round(line_dir(j), 2), t['h']])
        # masts: MN_RTC 03 where OSM has no mast or antenna within 15 m, and the DSM sees something standing (else it is a manhole or a box)
        n_m, rtc_rep = 0, []
        for g, ty in self.rtc:
            near = any(math.dist((g.x, g.y), m) < 15 for m in masts)
            h = None
            if G is not None and G.ok:
                X, Z = _pts_in(g.buffer(3)); hv = G.at(G.N, X, Z); h = float(np.nanmax(hv)) if np.isfinite(hv).any() else None
            rtc_rep.append({'x': round(g.x, 1), 'z': round(g.y, 1), 'antenna_osm_entro_15m': near, 'dsm_max': None if h is None else round(h, 1)})
            if not near and h is not None and h >= 8: out.append([ka, int(round(g.x * 10)), int(round(g.y * 10)), 0.0, round(h, 1)]); n_m += 1
        # the OSM water tower object where the DBGT draws the tower as a building
        tw = [o['g'].centroid for o in self.ind if o['kind'] == TORRE]; n_w = 0
        if tw:
            o2 = []
            for o in out:
                if o[0] == kw and any(c.distance(Point(o[1] / 10, o[2] / 10)) < 20 for c in tw): n_w += 1; continue
                o2.append(o)
            out = o2
        self.towers = towers
        self.rep['elettrico'] = {'tralicci_dbgt': len(towers), 'tralicci_di_telecomunicazioni_osm': tele, 'altezza_dsm': len(hs), 'altezza_tipica': htyp,
                                 'altezze': [t['h'] for t in towers], 'tralicci_osm_sostituiti': len(drop), 'tralicci_osm_tenuti_in_meda': sum(1 for i, x, z, ex in osm_t if i not in drop and cv.contains(Point(x, z))),
                                 'vertici_spostati_sulla_base': {'n': len(moved), 'p50': _pct(moved, 50), 'max': round(max(moved), 2) if moved else None},
                                 'linee_con_quote': len(self.pw), 'tracciati_dbgt_senza_tralicci_cavi_interrati_m': round(sum(L.length for L in self.tre if not any(L.distance(Point(t['x'], t['z'])) < 3 for t in towers))),
                                 'antenne_aggiunte': n_m, 'mn_rtc': rtc_rep, 'torre_acqua_osm_oggetto_tolta': n_w}
        self.log('dbgt manufatti: tralicci DBGT', len(towers), 'altezza dal DSM', len(hs), 'tipica', htyp, 'OSM sostituiti', len(drop), 'linee con quote', len(self.pw), 'antenne aggiunte', n_m)
        return out, new_pl

    # ---------------------------------------------------------------- trees: height and crown from DSM - DTM
    def alberi(self, trees, boschi=None, vietati=()):
        """trees [(x, z)] of the whole map -> inside the cover (x, z, h, d) in metres: height and crown diameter from the DSM; trees standing
        in a manufatto move off it (at most 3 m) or go. Outside the cover unchanged."""
        cv, G = self.cover, self.grid
        T = np.asarray([t[:2] for t in trees], float).reshape(-1, 2)
        if cv.is_empty or not len(T): return trees
        ins = shapely.contains_xy(cv, T[:, 0], T[:, 1]); idx = np.where(ins)[0]; P = T[idx].copy()
        if not len(P): return trees
        # off the manufatti (cabins, tanks, basins, greenhouses: buildings the verde did not know)
        V = [o['g'] for o in self.ind if o.get('kind')]
        n_mv = n_rm = 0; keep = np.ones(len(P), bool)
        if V:
            vt = STRtree(V)
            def hit(pts):
                m = np.zeros(len(pts), bool)
                if not len(pts): return m
                a, _ = vt.query(shapely.points(pts), predicate='dwithin', distance=CLEAR); m[np.unique(a)] = True; return m
            bad = hit(P); ang = np.linspace(0, 2 * math.pi, 16, endpoint=False); rad = np.arange(0.5, MOVE + 0.01, 0.5)
            off = np.array([(r * math.cos(a), r * math.sin(a)) for r in rad for a in ang])
            for i in np.where(bad)[0]:
                C = P[i] + off; ok = ~hit(C)
                if ok.any(): P[i] = C[int(np.argmax(ok))]; n_mv += 1
                else: keep[i] = False; n_rm += 1
        H = np.full(len(P), np.nan); D = np.full(len(P), np.nan); seen = np.zeros(len(P), bool); wz = np.zeros(len(P), bool); zone = []
        if G is not None and G.ok:
            # no roofs: the DSM of 2008 and the DBGT of 2015 are a metre or two apart, a tree by a wall took the roof (x 97 z -269: 31.5 m
            # by a 29.5 m building). Grid.mask had its rows upside down and masked nothing; the roof is cut with its spill (Grid.roofs)
            N = np.where(G.roofs(self.blds, 0.5, ALB_BLD), np.nan, G.N) if self.blds else G.N.copy()
            # for the crown only the buildings themselves (+0.5 m) are taken off: the roof's spill of 3 m took the crowns beside the walls
            Nc = np.where(self.bld_mask, np.nan, G.N) if self.blds and self.bld_mask is not None else G.N.copy()
            # no wires and no pylons: the DSM catches the conductors of a high-voltage line as rows one pixel wide, 20-35 m up (a tree under
            # the line at x -509 z 23 took 31.2 m from them). Near the lines an opening of 3 x 3 pixels takes away what is thinner than that
            # (wires, cross arms), the crowns stay; within PYL_R of a pylon nothing is read
            from scipy.ndimage import grey_opening
            big = [LineString(L['p']) for L in self.pw] + list(self.tre) + [LineString(p) for p, h in getattr(self, 'lines_all', []) if h > 15 and len(p) >= 2]
            small = [LineString(p) for p, h in getattr(self, 'lines_all', []) if h <= 15 and len(p) >= 2]
            def pieces(L):  # spans one by one: a buffer of a whole line would make the mask walk its bounding box
                c = list(L.coords); return [LineString(c[i:i + 2]) for i in range(len(c) - 1) if c[i] != c[i + 1]]
            zone = [s.buffer(WIRE_R) for g in big for s in pieces(g)] + [s.buffer(WIRE_R_MT) for g in small for s in pieces(g)]
            if zone:
                Mz = G.mask([p for z_ in zone for p in _polys(z_.intersection(cv.buffer(10)))])
                No = grey_opening(np.where(np.isfinite(N), N, 0.0), size=(3, 3)); self.n_wire_px = int(Mz.sum())
                N = np.where(Mz & np.isfinite(N), np.minimum(N, No), N); Nc = np.where(Mz & np.isfinite(Nc), np.minimum(Nc, No), Nc)
            tw = [Point(t['x'], t['z']).buffer(PYL_R) for t in getattr(self, 'towers', [])]
            if tw: Mt = G.mask(tw); N = np.where(Mt, np.nan, N); Nc = np.where(Mt, np.nan, Nc)
            # window of ALB_R m around each point, in pixels (they are 0.78 x 1.1 m)
            ri, ci = int(math.ceil(ALB_R / G.mz)), int(math.ceil(ALB_R / G.mx))
            offs = [(dr, dc) for dr in range(-ri, ri + 1) for dc in range(-ci, ci + 1) if math.hypot(dr * G.mz, dc * G.mx) <= ALB_R]
            r, c = G.rc(P[:, 0], P[:, 1]); r, c = np.rint(r).astype(int), np.rint(c).astype(int)
            if zone: wz = Mz[np.clip(r, 0, G.shape[0] - 1), np.clip(c, 0, G.shape[1] - 1)]
            V_ = np.full((len(P), len(offs)), np.nan)
            for k, (dr, dc) in enumerate(offs):
                rr, cc = r + dr, c + dc; okk = (rr >= 0) & (rr < G.shape[0]) & (cc >= 0) & (cc < G.shape[1]); V_[okk, k] = N[rr[okk], cc[okk]]
            allnan = ~np.isfinite(V_).any(1); Vf = np.where(np.isfinite(V_), V_, -1e9)
            k = np.argmax(Vf, 1); hmax = Vf[np.arange(len(P)), k]; hmax[allnan] = np.nan
            seen = np.isfinite(hmax) & (hmax >= ALB_SEEN)
            pr = r + np.array([o[0] for o in offs])[k]; pc = c + np.array([o[1] for o in offs])[k]
            # crown, 1: along 8 directions from the top, how far before DSM - DTM falls under half the height (or rises into a taller crown).
            # Alone it gave crowns of 0.44 times the height, 0.61 times what the 2018-19 orthophoto shows (verifica del 26/10): now only where 2 sees nothing
            dirs = [(math.cos(a), math.sin(a)) for a in np.linspace(0, 2 * math.pi, 8, endpoint=False)]; steps = np.arange(0.5, 8.01, 0.5)
            px, pz = G.xz(pr, pc); px, pz = np.asarray(px), np.asarray(pz)
            thr = np.maximum(1.5, 0.5 * hmax)
            radii = np.full((len(P), len(dirs)), 8.0)
            for di, (ux, uz) in enumerate(dirs):
                done = ~seen.copy(); rad_ = np.full(len(P), 8.0)
                for s in steps:
                    v = G.near(N, px + ux * s, pz + uz * s)
                    stop = ~done & (~np.isfinite(v) | (v < thr) | (v > hmax + 1.0))
                    rad_[stop] = s - 0.25; done |= stop
                radii[:, di] = rad_
            D_r = 2 * np.median(radii, 1) + 0.5
            # crown, 2 (26/10, Carlo: "alberi ridicolmente stretti"): the canopy pixels (DSM - DTM at least max(ALB_CMIN, ALB_CFR h) and at most
            # h + 1.5) that have this tree as the nearest within ALB_CR, D = 2 sqrt(area / pi). A tree alone takes its whole crown, in a row
            # or a wood the crowns share the canopy and touch, as they do (the cut at 1.3 times the nearest tree is gone). On 42 trees read on
            # the orthophoto: mean error -1.2 m (0.84 of the true width; the trees have grown since 2008), before -3.4 m
            from scipy.spatial import cKDTree
            okc = np.isfinite(Nc) & (Nc >= ALB_CMIN); Rc, Cc = np.nonzero(okc); vc = Nc[Rc, Cc]; Xc, Zc = G.xz(Rc, Cc)
            dd, kk = cKDTree(P).query(np.c_[np.asarray(Xc), np.asarray(Zc)], distance_upper_bound=ALB_CR)
            m_ = np.isfinite(dd); kk, vc = kk[m_], vc[m_]; hk = np.where(seen & keep, hmax, np.nan)[kk]
            good = np.isfinite(hk) & (vc >= np.maximum(ALB_CMIN, ALB_CFR * hk)) & (vc <= hk + 1.5)
            D_v = 2 * np.sqrt(np.bincount(kk[good], minlength=len(P)) * G.mx * G.mz / math.pi)
            n_ray = int((seen & keep & (D_r > D_v)).sum())
            D = np.maximum(D_v, D_r)
            H = hmax
        else: n_ray = 0
        from scipy.spatial import cKDTree
        nn = cKDTree(P).query(P, k=2)[0][:, 1] if len(P) > 1 else np.full(len(P), 10.0)
        H = np.where(seen, np.clip(H, *ALB_H), np.nan)
        D = np.where(seen, np.clip(np.clip(D, 0.2 * H, 1.5 * H), *ALB_D), np.nan)
        inb = shapely.contains_xy(boschi, P[:, 0], P[:, 1]) if boschi is not None and not boschi.is_empty else np.zeros(len(P), bool)
        # the trees the DSM does not see take the typical height of the seen ones in the same setting: in a wood the wood's, outside the
        # street and garden trees' (the median of all, 11.5 m, was the woods' pulling up the young trees planted after 2008)
        htyp = float(np.nanmedian(H)) if seen.any() else 8.0; rtyp = float(np.nanmedian(D / H)) if seen.any() else 0.6
        HT = np.full(len(P), htyp); RT = np.full(len(P), rtyp)
        for m in (inb, ~inb):
            if (m & seen).sum() >= 20: HT[m] = float(np.median(H[m & seen])); RT[m] = float(np.median(D[m & seen] / H[m & seen]))
        self.htyp_ctx = {'nei_boschi': round(float(HT[inb][0]), 1) if inb.any() else None, 'fuori': round(float(HT[~inb][0]), 1) if (~inb).any() else None}
        # under a line the strip is kept low (the DSM sees it so): a tree there it does not see is not a tree of the wood around it
        HT[wz & inb] = HT[~inb][0] if (~inb).any() else HT[wz & inb]; RT[wz & inb] = RT[~inb][0] if (~inb).any() else RT[wz & inb]
        H = np.where(seen, H, HT); D = np.where(seen, D, np.clip(np.minimum(RT * HT, np.maximum(3.0, 2.0 * nn)), *ALB_D))
        # a crown reaches at most ALB_SPORGE over a building's wall (the game draws it round: wider it would go through the wall)
        dB = np.full(len(P), 99.0)
        if self.blds and len(P):
            ii, dist = STRtree(self.blds).query_nearest(shapely.points(P), return_distance=True, max_distance=ALB_CR, all_matches=False); dB[ii[0]] = dist
        cap = np.maximum(ALB_D[0], 2 * (dB + ALB_SPORGE)); n_cap = int((keep & (D > cap)).sum()); D = np.minimum(D, cap)
        def st(m): return {'n': int(m.sum()), 'visti_dal_dsm': int((m & seen).sum()), 'h_p10_p50_p90': [_pct(H[m & seen], q) for q in (10, 50, 90)], 'chioma_p10_p50_p90': [_pct(D[m & seen], q) for q in (10, 50, 90)]}
        self.rep['alberi'] = {'dentro': int(len(P)), 'spostati_fuori_dai_manufatti': n_mv, 'tolti_dentro_i_manufatti': n_rm, 'altezza_tipica_se_il_dsm_non_vede': self.htyp_ctx,
                              'pixel_vicino_ai_fili_aperti_3x3': getattr(self, 'n_wire_px', 0), 'non_visti_sotto_le_linee_con_altezza_fuori_bosco': int((wz & inb & ~seen).sum()),
                              'chioma_su_altezza_tipica': round(rtyp, 2), 'chioma_dal_raggio_dove_i_pixel_non_bastano': n_ray, 'chiome_strette_dagli_edifici': n_cap,
                              'chioma_su_altezza_p10_p50_p90_visti': [_pct((D / H)[keep & seen], q) for q in (10, 50, 90)], 'tutti': st(keep), 'nei_boschi_dbgt': st(keep & inb), 'fuori_dai_boschi': st(keep & ~inb)}
        self.log('dbgt manufatti: alberi', len(P), 'visti dal DSM', int(seen.sum()), 'altezza tipica', self.htyp_ctx, 'spostati fuori dai manufatti', n_mv, 'tolti', n_rm)
        out = [tuple(t[:2]) for t in T[~ins]]
        for i in np.where(keep)[0]: out.append((float(P[i, 0]), float(P[i, 1]), round(float(H[i]), 1), round(float(D[i]), 1)))
        self.n_alberi_altezza = int(keep.sum())
        return out

    def suolo_gioco(self, x, z):
        """the ground the game stands the pylons on (m above sea): S of the new engine (terreno/<tx>_<tz>.bin.gz next to index.html, read as
        altezze3.js reads it, the triangles of its cells) where there is a tile of S, else the old ground of build_data.py. The DTM of 2008
        differs from S where the DBGT drew the ground anew (2.7 m at the pylon of x -966 z -1324: the wires hung over its insulators)"""
        if not hasattr(self, '_S'):
            self._S = {}
            d = os.path.join(os.path.dirname(HERE), 'terreno')
            try: idx = json.load(open(os.path.join(d, 'indice.json'), encoding='utf-8'))['tiles']
            except Exception: idx = {}
            for k in idx:
                try:
                    import gzip
                    b = open(os.path.join(d, k + '.bin.gz'), 'rb').read()
                    if b[:2] == b'\x1f\x8b': b = gzip.decompress(b)
                    if b[:4] != b'GTAS': continue
                    st, n = b[5], int.from_bytes(b[6:8], 'little'); base = float(np.frombuffer(b, '<f4', 1, 8)[0])
                    q = np.frombuffer(b, '<u2', n * n, 12).reshape(n, n).astype(np.float64)
                    self._S[tuple(map(int, k.split('_')))] = (st, n, np.where(q == 65535, np.nan, (base * 100 + q) / 100))
                except Exception: continue
        fb = self._ground_fb(x, z) if getattr(self, '_ground_fb', None) else self.suolo(x, z)
        if not self._S: return fb
        ox, oz = self.origin; i, j = int((x - ox) // TILE), int((z - oz) // TILE); F = self._S.get((i, j))
        if F is None: return fb
        st, n, Y = F; u = min(max((x - ox - i * TILE) / st, 0), n - 1); v = min(max((z - oz - j * TILE) / st, 0), n - 1)
        a, c = min(int(u), n - 2), min(int(v), n - 2); fu, fv = u - a, v - c
        h00, h10, h01, h11 = Y[c, a], Y[c, a + 1], Y[c + 1, a], Y[c + 1, a + 1]
        h = h00 + fu * (h10 - h00) + fv * (h11 - h10) if fu >= fv else h00 + fv * (h01 - h00) + fu * (h11 - h01)
        return float(h) if np.isfinite(h) else fb

    def suolo(self, x, z):  # DTM 1 m (the ground under a pylon), the LiDAR tiles outside the window
        if self.grid is not None:
            v = float(self.grid.at(self.grid.T, np.array([x]), np.array([z]))[0])
            if np.isfinite(v): return v
            v = float(self.grid.dtm.at(np.array([x]), np.array([z]))[0])
            if np.isfinite(v): return v
        return self._ground_fb(x, z) if getattr(self, '_ground_fb', None) else 0.0

    # ---------------------------------------------------------------- tile records
    def uscite(self, tid, tbox, enc, ground=None, base=0.0):
        """(tile, key, record) for the tiles: 'mf' containers and basins, 'pk' car parks, 'pw' the power lines with heights per vertex."""
        q = lambda v: int(round(v * 10))
        res = []
        for o in self.ind:
            if o['kind'] not in (CONT, VASCA): continue
            g, c = o['g'], o['g'].centroid; t = tid(c.x, c.y)
            if o['kind'] == CONT and o['tondo']: rec = {'k': 1, 'c': [q(c.x), q(c.y)], 'r': q(math.sqrt(g.area / math.pi)), 'h': q(o['h'])}
            elif o['kind'] == CONT: rec = {'k': 2, 'p': enc(list(g.simplify(0.1).exterior.coords)[:-1]), 'h': q(o['h'])}
            else: rec = {'k': 3, 'p': enc(list(g.simplify(0.1).exterior.coords)[:-1]), 'h': q(max(VASCA_RIM, o['h']))}
            f = o.get('foto') or {}  # colours from the photos: m walls, t top (containers); a water, b rim (basins)
            for k_, kf in (('m', 'colore'), ('t', 'tetto'), ('a', 'acqua'), ('b', 'bordo')):
                if f.get(kf): rec[k_] = f[kf]
            res.append((t, 'mf', rec)); self.mf.append(rec)
        # car parks cut on the tiles like the areas
        for p in self.pk:
            x0, z0, x1, z1 = p.bounds; done = set()
            for x in np.arange(x0, x1 + TILE, TILE / 2):
                for z in np.arange(z0, z1 + TILE, TILE / 2):
                    t = tid(min(x, x1), min(z, z1))
                    if t in done: continue
                    done.add(t); c = p.intersection(tbox(t))
                    for r in _polys(c, 20.0): res.append((t, 'pk', {'p': enc(list(r.simplify(0.2).exterior.coords)[:-1])}))
        # wires: the absolute height of the attachment line (top of the pylon) at every vertex, interpolated where a tile cuts a span
        for L in self.pw:
            pts, hv = L['p'], L['ht']
            gy = np.array([(ground or self.suolo_gioco)(x, z) for x, z in pts])
            top = gy + np.array(hv) - base
            Ls = LineString(pts); cum = np.concatenate([[0], np.cumsum([math.dist(a, b) for a, b in zip(pts, pts[1:])])])
            ts = set()
            for s in np.arange(0, Ls.length + 1, 25.0): pp = Ls.interpolate(s); ts.add(tid(pp.x, pp.y))
            for t in ts:
                cc = Ls.intersection(tbox(t))
                for part in _parts(cc):
                    if part.geom_type != 'LineString' or part.length < 0.3: continue
                    P2 = list(part.coords); S = [Ls.project(Point(p)) for p in P2]
                    y = np.interp(S, cum, top); hh = np.interp(S, cum, hv)
                    res.append((t, 'pw', {'p': enc(P2), 'h': L['h'], 'y': [q(v) for v in y], 'ht': [q(v) for v in hh]}))
        return res

    # ---------------------------------------------------------------- checks
    def controlli(self, carreggiate=None, edifici=None, buildings=None, ground=None):
        """things on the carriageways or in buildings, wires under the ground or through buildings."""
        rep = {}; carreggiate = carreggiate if carreggiate is not None else self.carr; ground = ground or self.suolo_gioco
        objs = [o['g'] for o in self.ind if o.get('kind')]
        if carreggiate is not None and objs:
            ct = STRtree(carreggiate); rep['manufatti_su_carreggiate_ac_vei'] = sum(1 for g in objs if any(g.intersection(carreggiate[i]).area > 0.5 for i in ct.query(g)))
        if objs and self.blds:
            bt = STRtree(self.blds); rep['manufatti_su_edifici_dbgt'] = sum(1 for g in objs if any(g.intersection(self.blds[i]).area > 0.5 for i in bt.query(g)))
        if carreggiate is not None and getattr(self, 'towers', None):
            ct = STRtree(carreggiate); rep['tralicci_su_carreggiate'] = sum(1 for t in self.towers if len(ct.query(Point(t['x'], t['z']).buffer(2.6), predicate='intersects')))
        if self.pw and ground is not None:
            bl = [(Polygon(b['p']).buffer(0), b['h']) for b in (buildings or []) if len(b['p']) >= 3]
            bt = STRtree([g for g, h in bl]) if bl else None; under, through, worst = 0, 0, []
            for L in self.pw:
                pts, hv = L['p'], L['ht']
                for (a, ha), (b, hb) in zip(zip(pts, hv), zip(pts[1:], hv[1:])):
                    l = math.dist(a, b); ga, gb = ground(*a), ground(*b)
                    for s in np.arange(2.0, l - 1.9, 2.0):
                        f = s / l; x, z = a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f
                        y = ga + 0.677 * ha + (gb + 0.677 * hb - ga - 0.677 * ha) * f  # the lowest wire (oggetti3.js)
                        g0 = ground(x, z)
                        if y < g0 + 6: under += 1; worst.append((round(x, 1), round(z, 1), round(y - g0, 1)))
                        if bt is not None:
                            for i in bt.query(Point(x, z)):
                                if bl[i][0].contains(Point(x, z)) and y < g0 + bl[i][1] + 2: through += 1; worst.append((round(x, 1), round(z, 1), 'edificio'))
            rep['fili_a_meno_di_6m_dal_suolo'] = under; rep['fili_dentro_edifici'] = through; rep['fili_peggiori'] = worst[:10]
        self.rep['controlli'] = rep
        self.log('dbgt manufatti: controlli', rep)
        return rep

    def scrivi(self, path):
        json.dump(self.rep, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


if __name__ == '__main__':  # census and the heights without OSM: python src/dbgt_manufatti.py [rapporto.json]
    DATA = dq.DATA; cov = dq.confine_comune('Meda').buffer(-3); prepare(cov)
    HH = (45.6805 - 45.6345) / 2 * 110540.0; HW = (9.191 - 9.117) / 2 * dq.KX
    M = Manufatti(os.path.join(DATA, 'dbt'), {'meda': None}, cov, rect=box(-HW, -HH, HW, HH))
    b = M.edifici([]); a, l = M.aree([], [])
    o, pl = M.elettrico([], [], ['traliccio', 'antenna', 'torre_acqua'])
    print(json.dumps({k: v for k, v in M.rep.items() if k not in ('altezze_manufatti',)}, ensure_ascii=False)[:4000])
    print(json.dumps(M.rep['altezze_manufatti']['per_tipo'], ensure_ascii=False), M.typ)
    if len(sys.argv) > 1: M.scrivi(sys.argv[1])
