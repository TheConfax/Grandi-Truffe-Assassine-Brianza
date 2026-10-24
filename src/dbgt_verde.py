# Motore nuovo, sezione 7 (docs/motore.md): il verde e gli alberi dal DBGT. Dove c'e' il DBGT (data/dbt/<Comune>/dbgt.gpkg, dentro il confine
# del comune meno 3 m, lo stesso dbt_cover di build_data.py) la forma del verde viene dal DBGT: AR_VRD (aree verdi), BOSCO, CL_AGR (colture),
# PS_INC (pascoli e incolti), ATTR_SP (impianti sportivi, lo sport da OSM); gli alberi sono ALBERO e i filari FIL_AL. OSM e WorldCover restano
# solo dove il DBGT non ha niente entro 3 m (a Meda il DBGT copre il 99,6% del comune), e finiscono nel rapporto (osm_senza_dbgt).
# Nessun albero su carreggiate e cortili (AC_VEI), marciapiedi (AC_PED), ciclabili, strade bianche, edifici, binari, acqua, campi sportivi:
# il punto del DBGT e' spesso il centro della chioma, quindi un albero che ci cade si sposta al punto libero piu' vicino entro 3 m, altrimenti
# si toglie. build_data.py chiama Verde(...).aree() prima di spargere gli alberi nei boschi, poi .alberi() e .siepi(); fuori dal DBGT non
# cambia niente. Da solo (python src/dbgt_verde.py) stampa il censimento e il rapporto senza OSM.
import os, sys, json, math, sqlite3, time
from collections import Counter, defaultdict
import numpy as np, shapely
from shapely import wkb, prepare
from shapely.geometry import Polygon, LineString, Point, box, GeometryCollection
from shapely.ops import unary_union
from shapely.strtree import STRtree
from pyproj import Transformer

LAT0, LON0 = 45.6575, 9.154  # the centre of the map (build_data.py lat0, lon0)
KX, KZ = 111320 * math.cos(math.radians(LAT0)), 110540.0
TILE = 250.0

# area types of build_data.py (AREA_T; colours in world3.js AREA_COL): 1 grass, 3 pitch, 6 water, 11 wood, 12 scrub, 13 farmland
# AR_VRD_TY (Specifiche di contenuto regionali, p. 312): 01 giardino, 02 prato, 04 aiuola -> prato; 03 alberi, "area alberata non sufficiente a
# definirsi bosco (sotto i 2000 m2)", l'inviluppo delle chiome -> bosco
VRD_T = {'01': 1, '0101': 1, '0102': 1, '0103': 1, '0104': 1, '0105': 1, '0106': 1, '0107': 1, '02': 1, '04': 1, '07': 1, '95': 1, '03': 11}
# BOSCO_TY (p. 300): 01 conifere, 02 latifoglie, 03 piantagioni, 05 rimboschimenti, 95 altro -> bosco; 04 arbusteti e macchia (a Meda 0401,
# "macchia mediterranea": arbusteti) -> cespugli
BOSCO_T = {'04': 12, '0401': 12, '0402': 12}
# CL_AGR_TY (p. 310): 07 seminativi -> campo, 08 orti, 09 vivai, 01-02 vigneti e frutteti -> frutteto, 05 prati. Il 04 per la specifica sono
# gli oliveti: a Meda sono 8 pezzi in centro e lungo la Milano-Meda, OSM e WorldCover ci hanno bosco e la foto Mapillary dalla rampa della
# Milano-Meda (2019) mostra un bosco fitto di latifoglie con l'edera, nessun olivo: bosco
AGR_T = {'01': (13, 'frutteto'), '02': (13, 'frutteto'), '03': (13, 'frutteto'), '04': (11, None), '05': (1, None), '06': (13, 'campo'),
         '07': (13, 'campo'), '0701': (13, 'campo'), '0702': (13, 'campo'), '08': (13, 'orti'), '09': (13, 'vivaio'), '95': (13, None)}
# PS_INC (p. 308): 01 pascolo, 04 incolti, 05 radura. Le foto Mapillary degli incolti (via Vignazzola e le rampe della Milano-Meda) sono
# scarpate e margini d'erba alta con qualche cespuglio: prato, senza alberi inventati
PS_T = 1
# ATTR_SP_TY (p. 163): 01 piscine; 02xx campi per sport; 08 piste; 95 altro (a Meda 23 su 38: campi da calcio, tennis, basket, pallavolo
# secondo OSM, e la foto di un campo da tennis in terra rossa a x 1324 z -365). Lo sport e il fondo vengono dal campo OSM che lo copre
SPORT_DBGT = {'0201': 'sport:soccer:', '0202': 'sport:tennis:', '0203': 'sport:soccer:', '0204': 'sport:basketball:', '0205': 'sport:boules:',
              '0206': 'sport:baseball:', '0207': 'sport:rugby:', '0208': 'sport:handball:', '08': 'pista:', '0801': 'pista:'}
GREEN = {1, 2, 3, 11, 12, 13}      # OSM/WorldCover areas the DBGT replaces
PAVED = {4, 8, 9}                  # OSM zones drawn as paving over the green (car parks, industrial, retail): the DBGT green is cut out of them
SPORT_LS = ('sport:', 'pista', 'piscina')  # a sports ground is a thing of its own (ATTR_SP), not land cover: OSM's stays where the DBGT has none within 3 m
LS_GREEN = ('campo', 'prato', 'frutteto', 'orti', 'vivaio', 'aiuola', 'sport:', 'pista', 'piscina')
FREE_D = 3.0      # OSM keeps its shape only with nothing of the DBGT within this distance (docs/motore.md 7)
MIN_OSM = 20.0    # leftover OSM pieces smaller than this (m2) are slivers along the DBGT edges
FIL_STEP = 7.0    # trees along a row (FIL_AL is one line for many trees), as for OSM's tree_row
CLEAR = 0.4       # a trunk stays this far from a forbidden surface (its collision radius in world3.js)
MOVE = 3.0        # how far a tree may move off a forbidden surface
DUP = 1.0         # two trees closer than this are one
BOSCO_M2, SCRUB_M2 = 100.0, 220.0  # ground per scattered tree in the DBGT woods and scrub (Verde.bosco)

# every surface of the DBGT: a point of the comune none of these covers is where OSM may keep its shape
SURF = ['A_PVEG', 'AATT', 'AB_CDA_AB_CDA_SUP', 'AC_CIC_AC_CIC_SUP_SR', 'AC_PED_AC_PED_SUP_SR', 'AC_VEI_AC_VEI_SUP_SR', 'ALVEO_A_ALVEO_A_SU',
        'ALVEO_ALVEO_SUP', 'AR_STR_AR_STR_SUP_SR', 'AR_VMS_AR_VMS_SUP_SR', 'AR_VRD_AR_VRD_SUP', 'ATTR_SP', 'BOSCO', 'CL_AGR_CL_AGR_SUP', 'CV_AES',
        'EDIFC_CR_EDF_IS', 'EDI_MIN_CR_EDF_IS', 'ELE_CP', 'INVASO', 'MAN_TR_MAN_TR_SUP', 'MN_IND_MN_IND_SUP', 'MN_MAU_MN_MAU_SUP', 'PAR_AR', 'PS_INC',
        'SC_DIS', 'SD_FER_SD_FER_SUP_SR', 'SP_ACQ', 'SV_FER', 'TRALIC_TRAL_BAS', 'PONTE_PONTE_SEDE', 'ARGINE_ARGN_SUP']
# where no tree stands: carriageways, parking strips and squares (AC_VEI), pavements, cycle paths, dirt roads, buildings, railway, water,
# bridges, sports grounds. Not AC_VEI ZON 0307, "area a traffico non strutturato in area di pertinenza" (p. 52): the yards inside private
# property. 1187 DBGT trees stand there more than 3 m from any place they could move to; the Mapillary photos of those spots (x 99 z 760,
# x 111 z 698, x 1254 z -1113, x 422 z -54) show trees in gardens and yards behind the fences and a car park lined with trees, none on a street
NO_TREE = ['AC_VEI_AC_VEI_SUP_SR', 'AC_PED_AC_PED_SUP_SR', 'AC_CIC_AC_CIC_SUP_SR', 'AR_VMS_AR_VMS_SUP_SR', 'EDIFC_CR_EDF_IS', 'EDI_MIN_CR_EDF_IS',
           'SD_FER_SD_FER_SUP_SR', 'ALVEO_A_ALVEO_A_SU', 'ALVEO_ALVEO_SUP', 'SP_ACQ', 'INVASO', 'PONTE_PONTE_SEDE', 'ATTR_SP']


def _geom(b): f = b[3]; return wkb.loads(bytes(b[8 + [0, 32, 48, 48, 64][(f >> 1) & 7]:]))


def _parts(g):
    if g is None or g.is_empty: return []
    if g.geom_type in ('Polygon', 'LineString', 'Point'): return [g]
    return [p for q in getattr(g, 'geoms', []) for p in _parts(q)]


def _polys(g, amin=0.0): return [p for p in _parts(g) if p.geom_type == 'Polygon' and p.area >= amin]


class Verde:
    def __init__(self, dbt_dir, comuni, cover, log=print, to_game=None, origin=(0.0, 0.0)):
        """dbt_dir: data/dbt; comuni: {nome minuscolo: poligono del confine}; cover: dbt_cover di build_data.py (confini meno 3 m);
        origin: the corner of the game's tiles (-HW, -HH)."""
        t0 = time.time(); self.log = log; self.cover = cover; self.origin = origin; self.cons = GeometryCollection(); self.rep = {'comuni': [], 'osm_senza_dbgt': {'aree': [], 'terreni': [], 'alberi': []}}
        tr = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
        tg = to_game or (lambda lon, lat: ((lon - LON0) * KX, -(lat - LAT0) * KZ))
        self._tf = lambda g: shapely.transform(shapely.force_2d(g), lambda a: np.column_stack(tg(*tr.transform(a[:, 0], a[:, 1]))))
        self.areas = []        # (type, polygon), DBGT
        self.land = []         # (kind, polygon): fields, allotments, pitches (paesaggio3.js)
        self.sport = []        # (ATTR_SP_TY, polygon)
        self.forest = []       # polygons where the DBGT has trees as an area, scattered (BOSCO, AR_VRD 03, CL_AGR 04)
        self.alb, self.fil, self.hedge = [], [], []
        surf, notree = [], []
        cnt = Counter()
        for d in (sorted(os.listdir(dbt_dir)) if os.path.isdir(dbt_dir) else []):
            f = os.path.join(dbt_dir, d, 'dbgt.gpkg')
            if not os.path.exists(f) or d.lower() not in comuni: continue
            con = sqlite3.connect(f); self.rep['comuni'].append(d)
            def rows(sql):
                try: return [(self._tf(_geom(r[0])),) + tuple(r[1:]) for r in con.execute(sql) if r[0] is not None]
                except sqlite3.OperationalError: return []
            for g, t in rows('select s.Shape, a.AR_VRD_TY from AR_VRD a join AR_VRD_AR_VRD_SUP s on s.CLASSREF = a.CLASSID'):
                at = VRD_T.get(t, 1); cnt['AR_VRD ' + str(t)] += 1
                for p in _polys(g.buffer(0)): self.areas.append((at, p))
            for g, t in rows('select Shape, BOSCO_TY from BOSCO'):
                at = BOSCO_T.get(t, 11); cnt['BOSCO ' + str(t)] += 1
                for p in _polys(g.buffer(0)): self.areas.append((at, p))
            for g, t in rows('select s.Shape, a.CL_AGR_TY from CL_AGR a join CL_AGR_CL_AGR_SUP s on s.CLASSREF = a.CLASSID'):
                at, k = AGR_T.get(t, (13, None)); cnt['CL_AGR ' + str(t)] += 1
                for p in _polys(g.buffer(0)):
                    self.areas.append((at, p))
                    if k: self.land.append((k, p))
            for g, t in rows('select Shape, PS_INC_TY from PS_INC'):
                cnt['PS_INC ' + str(t)] += 1
                for p in _polys(g.buffer(0)): self.areas.append((PS_T, p))
            for g, t in rows('select Shape, ATTR_SP_TY from ATTR_SP'):
                cnt['ATTR_SP ' + str(t)] += 1
                for p in _polys(g.buffer(0)): self.sport.append((t, p))
            for (g,) in rows('select Shape from ALBERO'): self.alb.append((g.x, g.y))
            for g, t in rows('select Shape, FIL_AL_TY from FIL_AL'):
                cnt['FIL_AL ' + str(t)] += 1
                for p in _parts(g):
                    if p.geom_type == 'LineString' and p.length > 0.5: (self.hedge if t == '02' else self.fil).append(p)
            for t in SURF:
                for (g,) in rows('select Shape from "%s"' % t): surf += _polys(g if g.is_valid else g.buffer(0))
            for t in NO_TREE:
                q = 'select Shape, AC_VEI_ZON from "%s"' % t if t.startswith('AC_VEI') else 'select Shape, NULL from "%s"' % t
                for g, z in rows(q):
                    if z != '0307': notree += _polys(g if g.is_valid else g.buffer(0))
        self.rep['censimento'] = dict(sorted(cnt.items()))
        # inside the cover only
        cv = cover
        def clip(ps): return [q for p in ps for q in (_polys(p) if cv.contains(p) else _polys(p.intersection(cv)))]
        self.areas = [(t, q) for t, p in self.areas for q in clip([p])]
        self.land = [(k, q) for k, p in self.land for q in clip([p]) if q.area >= 8]
        self.sport = [(t, q) for t, p in self.sport for q in clip([p])]
        A = np.array(self.alb) if self.alb else np.zeros((0, 2)); self.alb = A[shapely.contains_xy(cv, A[:, 0], A[:, 1])] if len(A) else A
        # a wooded area whose trees the DBGT has one by one (AR_VRD 03 is the envelope of the crowns: 2384 m2 with 24 ALBERO at x 272 z -1100)
        # is a lawn under its own trees; the others get trees scattered like OSM's woods (build_data.py, one every 70 m2)
        nre = 0
        for i, (t, q) in enumerate(self.areas):
            if t == 11 and len(self.alb):
                n = int(shapely.contains_xy(q, self.alb[:, 0], self.alb[:, 1]).sum())
                if n >= max(3, q.area / 400): self.areas[i] = (1, q); nre += 1
        self.forest = [(t, q) for t, q in self.areas if t in (11, 12)]; self.rep['boschi_con_i_loro_alberi'] = nre
        self.fil = [q for p in self.fil for q in _parts(p.intersection(cv)) if q.geom_type == 'LineString' and q.length > 0.5]
        self.hedge = [q for p in self.hedge for q in _parts(p.intersection(cv)) if q.geom_type == 'LineString' and q.length > 1.0]
        # where OSM may keep its shape: the comune minus every DBGT surface, more than FREE_D m from them
        su = unary_union(surf) if surf else GeometryCollection()
        self.free = cv.difference(su).buffer(-FREE_D) if not cv.is_empty else GeometryCollection(); prepare(self.free)
        self.rep['copertura'] = {'comune_ha': round(cv.area / 1e4, 1), 'dbgt_ha': round(su.intersection(cv).area / 1e4, 1) if surf else 0, 'libero_oltre_3m_ha': round(self.free.area / 1e4, 2)}
        self.notree = notree; self.surf_tree = STRtree(surf) if surf else None
        self.forest_u = unary_union([q for t, q in self.forest]) if self.forest else GeometryCollection(); prepare(self.forest_u)
        log('dbgt verde: aree', len(self.areas), 'terreni', len(self.land), 'impianti sportivi', len(self.sport), 'alberi', len(self.alb), 'filari', len(self.fil),
            'siepi', len(self.hedge), 'copertura', self.rep['copertura'], '%.0fs' % (time.time() - t0))

    # ---------------------------------------------------------------- areas and land
    def aree(self, area_geoms, land):
        """area_geoms [(type, geom)], land [(kind, pts)] of build_data.py -> the same lists with the DBGT green inside the cover."""
        cv, free = self.cover, self.free
        if cv.is_empty: return area_geoms, land
        # an OSM building site (landuse=construction) is newer than the survey (Meda 2015): no DBGT green or trees inside it. The site by the
        # Milano-Meda at x 100 z 140 with its crane was lawns and a wood in the DBGT, cut out of the dark soil it looked like a patchwork
        cons = unary_union([g.intersection(cv) for at, g in area_geoms if at == 7 and g.intersects(cv)]); self.cons = cons; prepare(cons)
        if not cons.is_empty:
            ncut = Counter()
            def nocons(L, key):
                res = []
                for t, q in L:
                    if q.intersects(cons): ncut[key] += 1; res += [(t, r) for r in _polys(q.difference(cons), 1.0)]
                    else: res.append((t, q))
                return res
            self.areas, self.sport, self.land = nocons(self.areas, 'aree'), nocons(self.sport, 'sport'), nocons(self.land, 'terreni')
            self.forest = [(t, q) for t, q in self.areas if t in (11, 12)]; self.forest_u = unary_union([q for t, q in self.forest]) if self.forest else GeometryCollection(); prepare(self.forest_u)
            self.rep['cantieri_osm'] = {'m2': round(cons.area), 'pezzi_dbgt_ritagliati': dict(ncut)}
        spt = STRtree([q for t, q in self.sport]) if self.sport else None
        def has_sport(g, d=FREE_D): return spt is not None and len(spt.query(g, predicate='dwithin', distance=d)) > 0
        green_u = unary_union([p for t, p in self.areas] + [p for t, p in self.sport]); gt = STRtree(_polys(green_u))
        out, rm, kept = [], Counter(), []
        X0, Z0 = self.origin
        def tiles_of(g):  # the game's tiles under g
            x0, z0, x1, z1 = g.bounds
            for i in range(int(math.floor((x0 - X0) / TILE)), int(math.floor((x1 - X0) / TILE)) + 1):
                for j in range(int(math.floor((z0 - Z0) / TILE)), int(math.floor((z1 - Z0) / TILE)) + 1):
                    yield box(X0 + i * TILE, Z0 + j * TILE, X0 + (i + 1) * TILE, Z0 + (j + 1) * TILE)
        def cut(g, fn):  # an OSM area that reaches into the cover, in tile pieces: a tile away from the cover gets exactly the piece the
            res = []    # build cuts today (build_data.py intersects every area with every tile), so nothing changes outside the DBGT
            for tb in tiles_of(g):
                if not tb.intersects(g): continue
                c = g.intersection(tb)
                if tb.intersects(cv): c = fn(c)
                res += _polys(c, 0.5)
            return res
        for at, g in area_geoms:
            if not g.intersects(cv): out.append((at, g)); continue
            if at == 3 and not has_sport(g.intersection(cv)):  # an OSM pitch the DBGT has no sports ground for (newer, or a field on a lawn)
                out.append((at, g)); c = g.intersection(cv).representative_point(); kept.append({'t': at, 'm2': round(g.intersection(cv).area), 'x': round(c.x, 1), 'z': round(c.y, 1)}); continue
            if at == 6 and any(t.startswith('01') and q.intersection(g).area > 0.3 * min(q.area, g.area) for t, q in self.sport):  # the pool is ATTR_SP 01
                rm['piscina'] += 1
                for p in cut(g, lambda c: c.difference(cv)): out.append((at, p))
                continue
            if at in GREEN:
                rm[at] += 1
                for p in cut(g, lambda c: c.difference(cv)): out.append((at, p))
                for p in _polys(g.intersection(free), MIN_OSM):
                    out.append((at, p)); c = p.representative_point(); kept.append({'t': at, 'm2': round(p.area), 'x': round(c.x, 1), 'z': round(c.y, 1)})
            elif at in PAVED:  # an OSM zone of paving (car park, yard, building site) over the real green: the green shows through
                near = [gt.geometries[i] for i in gt.query(g)]
                if not near: out.append((at, g)); continue
                nu = unary_union(near); rm['ritaglio %d' % at] += 1
                for p in cut(g, lambda c: c.difference(nu)): out.append((at, p))
            else: out.append((at, g))
        self.rep['osm_senza_dbgt']['aree'] = kept
        # OSM pitches and pools give the DBGT sports grounds their sport
        osm_sp = [(k, Polygon(pts).buffer(0)) for k, pts in land if k.startswith(('sport:', 'pista', 'piscina')) and len(pts) >= 3]
        ot = STRtree([g for k, g in osm_sp]) if osm_sp else None
        new_land, sp_src = [], Counter()
        for t, p in self.sport:
            best, bk = 0.0, None
            for i in (ot.query(p) if ot is not None else []):
                k, g = osm_sp[i]
                if g.is_empty: continue
                f = g.intersection(p).area / max(1e-6, min(g.area, p.area))
                if f > best: best, bk = f, k
            if best >= 0.3: k = bk; sp_src['osm'] += 1
            elif t.startswith('01'): k = 'piscina'; sp_src['dbgt'] += 1
            else: k = SPORT_DBGT.get(t, 'sport::'); sp_src['dbgt' if t in SPORT_DBGT else 'senza sport'] += 1
            new_land.append((k, p))
        # the DBGT areas, merged by type within each tile (one polygon where the DBGT cuts a lawn in pieces) and cut on the tiles
        by_t = defaultdict(list)
        for t, p in self.areas: by_t[t].append(p)
        for t, p in self.sport: by_t[6 if t.startswith('01') else 3].append(p)
        nadd = Counter(); x0, z0, x1, z1 = cv.bounds
        for t in (1, 12, 11, 13, 3, 6):  # drawn in this order: pitches and pools over the lawns
            ps = by_t.get(t)
            if not ps: continue
            st = STRtree(ps)
            for i in range(int(math.floor((x0 - X0) / TILE)), int(math.floor((x1 - X0) / TILE)) + 1):
                for j in range(int(math.floor((z0 - Z0) / TILE)), int(math.floor((z1 - Z0) / TILE)) + 1):
                    bx = box(X0 + i * TILE, Z0 + j * TILE, X0 + (i + 1) * TILE, Z0 + (j + 1) * TILE)
                    idx = st.query(bx)
                    if not len(idx): continue
                    u = unary_union([ps[k] for k in idx]).intersection(bx)
                    for p in _polys(u, 1.0): out.append((t, p)); nadd[t] += 1
        # land: the OSM kinds of green go where the DBGT is, the DBGT fields and pitches come in
        out_land, lrm = [], 0
        for k, pts in land:
            if not k.startswith(LS_GREEN) or len(pts) < 3: out_land.append((k, pts)); continue
            g = Polygon(pts).buffer(0)
            if not g.intersects(cv): out_land.append((k, pts)); continue
            if k.startswith(SPORT_LS) and not has_sport(g):
                out_land.append((k, pts)); c = g.representative_point(); self.rep['osm_senza_dbgt']['terreni'].append({'k': k, 'm2': round(g.area), 'x': round(c.x, 1), 'z': round(c.y, 1)}); continue
            lrm += 1
            for p in _polys(g.difference(cv), 8): out_land.append((k, list(p.exterior.coords)[:-1]))
            for p in _polys(g.intersection(free), MIN_OSM):
                out_land.append((k, list(p.exterior.coords)[:-1])); c = p.representative_point(); self.rep['osm_senza_dbgt']['terreni'].append({'k': k, 'm2': round(p.area), 'x': round(c.x, 1), 'z': round(c.y, 1)})
        for k, p in self.land + new_land: out_land.append((k, list(p.exterior.coords)[:-1]))
        self.rep['aree'] = {'osm_tolte': dict((str(k), v) for k, v in rm.items()), 'dbgt_pezzi_per_tipo': dict((str(k), v) for k, v in sorted(nadd.items())),
                            'osm_tenute_pezzi': len(kept), 'osm_tenute_m2': round(sum(k['m2'] for k in kept)), 'terreni_osm_tolti': lrm,
                            'terreni_dbgt': dict(Counter(k for k, p in self.land)), 'sport': dict(sp_src), 'sport_tipi': dict(Counter(k for k, p in new_land))}
        self.log('dbgt verde: aree OSM tolte o ritagliate', dict(rm), 'tenute (niente DBGT entro 3 m)', len(kept), round(sum(k['m2'] for k in kept)), 'm2;',
                 'pezzi DBGT per tipo', dict(nadd), '; terreni OSM tolti', lrm, 'DBGT', len(self.land) + len(new_land), 'sport', dict(sp_src))
        return out, out_land

    # ---------------------------------------------------------------- trees
    def filari(self):
        out = []
        for L in self.fil:
            n = max(1, int(round(L.length / FIL_STEP)))
            for k in range(n): p = L.interpolate((k + 0.5) * L.length / n); out.append((p.x, p.y))
        return np.array(out) if out else np.zeros((0, 2))

    def bosco(self, strade):
        """trees scattered in the DBGT woods: one every 100 m2 (scrub one every 220), at most 4000 a piece, off the roads and paths
        (strade: build_data.py roadsU), with a generator of their own so the scatter outside the DBGT does not change. build_data.py asks
        one every 70 m2 of OSM's woods but draws only three candidates a tree: in the long woods along the Seveso (a fifth of their box)
        that gave one every 120-220 m2, in the round ones one every 75; 100 m2 is what OSM's woods of Meda had on average, everywhere the same"""
        rng = np.random.default_rng(20822); out = []
        for t, g in self.forest:
            n = int(min(4000, g.area / (BOSCO_M2 if t == 11 else SCRUB_M2)))
            if n <= 0: continue
            x0, z0, x1, z1 = g.bounds; m = int(n * min(40, 1.3 * (x1 - x0) * (z1 - z0) / g.area)) + 8
            xs = rng.uniform(x0, x1, m); zs = rng.uniform(z0, z1, m)
            ok = shapely.contains_xy(g, xs, zs) & ~shapely.intersects_xy(strade, xs, zs)
            out += list(zip(xs[ok], zs[ok]))[:n]
        return np.array(out) if out else np.zeros((0, 2))

    def alberi(self, trees, n_gen, vietati=(), rail=(), posti=(), strade=None):
        """trees: build_data.py's list, [0:n_gen] OSM (nodes and tree rows), [n_gen:] scattered in the woods; vietati: the game's own
        surfaces (asphalt, pavements, footways, buildings), strade: every road and path buffered (roadsU), rail: railway lines, posti: the parking spaces OSM maps one by one ([x, z, angle,
        length, width, kind], decimetres). Returns the list with the DBGT trees inside the cover."""
        cv = self.cover; T = np.asarray(trees, float).reshape(-1, 2)
        if cv.is_empty: return trees
        ins = shapely.contains_xy(cv, T[:, 0], T[:, 1]); idx = np.arange(len(T))
        F = self.filari(); D = np.vstack([self.alb, F]) if len(F) else self.alb
        src = np.concatenate([np.zeros(len(self.alb), int), np.ones(len(F), int)])  # 0 ALBERO, 1 filare, 2 OSM, 3 bosco
        from scipy.spatial import cKDTree
        kd = cKDTree(D) if len(D) else None
        # OSM trees: kept with no DBGT tree within FREE_D and not in a wood of the DBGT (its trees are the wood); a tree row of OSM along a FIL_AL is that row
        osm = ins & (idx < n_gen)
        dd = kd.query(T[osm])[0] if kd is not None and osm.any() else np.full(int(osm.sum()), 1e9)
        fu = unary_union(self.fil) if self.fil else None
        df = shapely.distance(fu, shapely.points(T[osm])) if fu is not None and osm.any() else np.full(int(osm.sum()), 1e9)
        inf = shapely.contains_xy(self.forest_u, T[osm, 0], T[osm, 1]) if osm.any() else np.zeros(0, bool)
        keep_osm = (dd >= FREE_D) & (df >= FREE_D) & ~inf
        # scattered in OSM's woods: only where OSM kept its wood; the DBGT woods get their own
        gen = ins & (idx >= n_gen)
        keep_gen = shapely.contains_xy(self.free, T[gen, 0], T[gen, 1]) if gen.any() else np.zeros(0, bool)
        B = self.bosco(strade if strade is not None else GeometryCollection())
        P = np.vstack([D, T[osm][keep_osm], T[gen][keep_gen], B])
        src = np.concatenate([src, np.full(int(keep_osm.sum()), 2), np.full(int(keep_gen.sum()) + len(B), 3)])
        self.rep['osm_senza_dbgt']['alberi'] = [[round(x, 1), round(z, 1)] for x, z in T[osm][keep_osm]]
        if not self.cons.is_empty:  # DBGT trees in an OSM building site: gone since the survey
            ic = shapely.contains_xy(self.cons, P[:, 0], P[:, 1]) & (src != 2); self.rep['alberi_dbgt_nei_cantieri'] = int(ic.sum()); P, src = P[~ic], src[~ic]
        # forbidden surfaces: the DBGT's and the game's (cut to the cover, in pieces so the tree query stays local)
        bx = box(*cv.bounds).buffer(10)
        V = list(self.notree)
        for g in vietati:
            if g is None or g.is_empty: continue
            V += [q for p in _polys(g.intersection(bx)) for q in _split(p)]
        for L in rail:
            if L.intersects(bx): V += _polys(L.buffer(3.6))  # with CLEAR the 4 m the game keeps trees from the tracks (world3.js nearRail)
        for X, Z, a, l, w, *_ in posti:  # a car stands there (landmarks3.js draws the space and parks a car on it)
            x, z = X / 10, Z / 10
            if not bx.contains(Point(x, z)): continue
            ux, uz = math.sin(a), math.cos(a); l, w = min(max(l, 4), 7) / 2, min(max(w, 1.8), 3.5) / 2
            V.append(Polygon([(x + ux * l * s + uz * w * t, z + uz * l * s - ux * w * t) for s, t in ((-1, -1), (1, -1), (1, 1), (-1, 1))]))
        vt = STRtree(V)
        def hit(pts):
            m = np.zeros(len(pts), bool)
            if not len(pts): return m
            a, _ = vt.query(shapely.points(pts), predicate='dwithin', distance=CLEAR); m[np.unique(a)] = True; return m
        bad = hit(P); moved = np.zeros(len(P), bool); drop = np.zeros(len(P), bool)
        ang = np.linspace(0, 2 * math.pi, 16, endpoint=False); rad = np.arange(0.5, MOVE + 0.01, 0.5)
        off = np.array([(r * math.cos(a), r * math.sin(a)) for r in rad for a in ang])
        why = Counter()
        for i in np.where(bad)[0]:
            if src[i] == 3: drop[i] = True; why['bosco'] += 1; continue  # a scattered tree just goes
            C = P[i] + off; ok = ~hit(C) & shapely.contains_xy(cv, C[:, 0], C[:, 1])
            if ok.any(): j = int(np.argmax(ok)); P[i] = C[j]; moved[i] = True; why['spostati'] += 1
            else: drop[i] = True; why['tolti'] += 1
        # where a tree stood on what (for the report)
        keep = ~drop
        # duplicates (an OSM tree, a moved tree on another): the first wins (ALBERO, filari, OSM, woods)
        kd2 = cKDTree(P[keep]); pairs = kd2.query_pairs(DUP); kk = np.where(keep)[0]; dup = set(max(a, b) for a, b in pairs)
        for d in dup: keep[kk[d]] = False
        self.rep['alberi'] = {'albero': int(len(self.alb)), 'filari': int(len(F)), 'osm_dentro': int(osm.sum()), 'osm_tenuti': int(keep_osm.sum()),
                              'osm_tolti_vicini_dbgt': int(((dd < FREE_D) | (df < FREE_D)).sum()), 'osm_tolti_nei_boschi': int((inf & (dd >= FREE_D) & (df >= FREE_D)).sum()),
                              'sparsi_osm_dentro': int(gen.sum()), 'sparsi_osm_tenuti': int(keep_gen.sum()), 'sparsi_boschi_dbgt': int(len(B)), 'su_superfici_vietate': int(bad.sum()), 'esito': dict(why),
                              'doppi': len(dup), 'finali_dentro': int(keep.sum()), 'fuori': int((~ins).sum()),
                              'per_fonte': {n: int((keep & (src == k)).sum()) for k, n in enumerate(('albero', 'filare', 'osm', 'bosco'))},
                              'tolti_dbgt': [[round(P[i, 0], 1), round(P[i, 1], 1)] for i in np.where(drop & (src < 2))[0]]}
        self.log('dbgt verde: alberi ALBERO', len(self.alb), 'filari', len(F), 'OSM dentro', int(osm.sum()), 'tenuti', int(keep_osm.sum()), 'sparsi nei boschi DBGT', len(B), 'nei boschi OSM',
                 int(keep_gen.sum()), 'di', int(gen.sum()), '; su superfici vietate', int(bad.sum()), dict(why), 'doppi', len(dup), '; finali dentro', int(keep.sum()), 'fuori', int((~ins).sum()))
        out = [tuple(p) for p in T[~ins]] + [tuple(p) for p in P[keep]]
        return out

    def siepi(self, bar_out):
        """FIL_AL 02 (siepi): a hedge (kind 3 of the barriers, 1.5 m like the other hedges) where no barrier already runs along it."""
        if not self.hedge: return []
        bl = [LineString(b[0]) for b in bar_out if len(b[0]) >= 2]; bt = STRtree(bl) if bl else None; out = []
        for L in self.hedge:
            near = [bl[i] for i in bt.query(L.buffer(1.0))] if bt is not None else []
            cov = L.intersection(unary_union([g.buffer(1.0) for g in near])).length if near else 0
            if cov < 0.5 * L.length: out.append((list(L.simplify(0.15).coords), 3, 1.5))
        self.rep['siepi'] = {'filari_siepe': len(self.hedge), 'aggiunte': len(out)}
        self.log('dbgt verde: siepi FIL_AL', len(self.hedge), 'aggiunte', len(out))
        return out

    def scrivi(self, path):
        json.dump(self.rep, open(path, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)


def _split(p, s=125.0):  # a big polygon in pieces of s m (the game's asphalt is one polygon as big as the network)
    x0, z0, x1, z1 = p.bounds
    if x1 - x0 <= s and z1 - z0 <= s: return [p]
    out = []
    for i in range(int(math.floor(x0 / s)), int(math.ceil(x1 / s))):
        for j in range(int(math.floor(z0 / s)), int(math.ceil(z1 / s))):
            out += _polys(p.intersection(box(i * s, j * s, (i + 1) * s, (j + 1) * s)))
    return out


if __name__ == '__main__':  # census and the report without OSM: python src/dbgt_verde.py [rapporto.json]
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    import dbgt_quote as dq
    DATA = dq.DATA; cov = dq.confine_comune('Meda').buffer(-3); prepare(cov)
    V = Verde(os.path.join(DATA, 'dbt'), {'meda': None}, cov)
    a, l = V.aree([], [])
    t = V.alberi([], 0)
    print(json.dumps({k: v for k, v in V.rep.items() if k != 'osm_senza_dbgt'}, ensure_ascii=False)[:3000])
    if len(sys.argv) > 1: V.scrivi(sys.argv[1])
