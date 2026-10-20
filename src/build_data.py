"""Build the game data for the big Brianza map.
usage: build_data.py map.osm dem.tif out.json S N W E
World frame: x = east (m), z = south (m), origin = centre of the cut. Integers are decimetres."""
import json, math, sys, heapq, hashlib, base64
def key(p): return (round(p[0]), round(p[1]))
from collections import defaultdict, Counter
import xml.etree.ElementTree as ET
import numpy as np, tifffile
from pyproj import Transformer
from shapely.geometry import LineString, Polygon, Point, box, GeometryCollection, MultiLineString
from shapely.ops import unary_union, linemerge
from shapely.strtree import STRtree
from shapely import prepare

src, dem, dst = sys.argv[1:4]
S, Nn, W, E = map(float, sys.argv[4:8])
lat0, lon0 = (S + Nn) / 2, (W + E) / 2
KX, KZ = 111320 * math.cos(math.radians(lat0)), 110540
proj = lambda lat, lon: ((lon - lon0) * KX, -(lat - lat0) * KZ)
HW, HH = (E - W) / 2 * KX, (Nn - S) / 2 * KZ
q = lambda v: int(round(v * 10))
RECT = box(-HW, -HH, HW, HH)
inside = lambda p, m=0: abs(p[0]) <= HW + m and abs(p[1]) <= HH + m
TILE = 250.0
import time; _T0 = time.time()
log = lambda *a: print('%4.0fs' % (time.time() - _T0), *a, flush=True)  # seconds since the start: where the build spends its time

# ------------------------------------------------------------------ parse
nodes, ntags, ways, rels, wrefs = {}, {}, {}, [], {}
for ev, el in ET.iterparse(src):
    tg = el.tag
    if tg == 'node':
        p = proj(float(el.get('lat')), float(el.get('lon')))
        nodes[el.get('id')] = p
        t = el.findall('tag')
        if t and inside(p, 400): ntags[el.get('id')] = {x.get('k'): x.get('v') for x in t}
        el.clear()
    elif tg == 'way':
        t = {x.get('k'): x.get('v') for x in el.findall('tag')}
        nd_ = [n.get('ref') for n in el.findall('nd')]; wrefs[el.get('id')] = nd_
        if t: ways[el.get('id')] = (nd_, t)
        el.clear()
    elif tg == 'relation':
        rels.append(([(m.get('type'), m.get('ref'), m.get('role')) for m in el.findall('member')], {x.get('k'): x.get('v') for x in el.findall('tag')}))
        el.clear()
log('parsed', len(nodes), 'nodes', len(ways), 'ways')

def h01(s): return int(hashlib.md5(str(s).encode()).hexdigest()[:8], 16) / 0xffffffff
def num(v):
    try: return float(str(v).replace(',', '.').split()[0].rstrip('m'))
    except Exception: return None
def ring(refs):
    pts = [nodes[r] for r in refs if r in nodes]
    if len(pts) > 1 and pts[0] == pts[-1]: pts = pts[:-1]
    return pts
def sarea(pts): return sum(pts[i][0] * pts[(i + 1) % len(pts)][1] - pts[(i + 1) % len(pts)][0] * pts[i][1] for i in range(len(pts))) / 2
def centroid(pts): return (sum(p[0] for p in pts) / len(pts), sum(p[1] for p in pts) / len(pts))
def join_rings(ids):
    segs = [list(wrefs[w]) for w in ids if w in wrefs]; out = []
    while segs:
        cur = segs.pop(0); ch = True
        while cur[0] != cur[-1] and ch:
            ch = False
            for i, s_ in enumerate(segs):
                if s_[0] == cur[-1]: cur += s_[1:]
                elif s_[-1] == cur[-1]: cur += s_[::-1][1:]
                elif s_[-1] == cur[0]: cur = s_[:-1] + cur
                elif s_[0] == cur[0]: cur = s_[::-1][:-1] + cur
                else: continue
                segs.pop(i); ch = True; break
        if cur[0] == cur[-1]: out.append(ring(cur))
    return out

# ------------------------------------------------------------------ terrain sampler
page = tifffile.TiffFile(dem).pages[0]
E0, N0 = page.tags['ModelTiepointTag'].value[3:5]
A = page.asarray().astype(np.float32)
tr = Transformer.from_crs('EPSG:4326', 'EPSG:32632', always_xy=True)
def sample(X, Z):
    lon = lon0 + X / KX; lat = lat0 - Z / KZ
    e, n = tr.transform(lon, lat)
    c = (e - E0) / 10 - 0.5; r = (N0 - n) / 10 - 0.5
    c0, r0 = np.floor(c).astype(int), np.floor(r).astype(int); fc, fr = c - c0, r - r0
    g = lambda rr, cc: A[np.clip(rr, 0, A.shape[0] - 1), np.clip(cc, 0, A.shape[1] - 1)]
    return g(r0, c0) * (1 - fc) * (1 - fr) + g(r0, c0 + 1) * fc * (1 - fr) + g(r0 + 1, c0) * (1 - fc) * fr + g(r0 + 1, c0 + 1) * fc * fr
TSTEP, TM = 10.0, 480
txs = np.arange(-HW - TM, HW + TM + TSTEP, TSTEP); tzs = np.arange(-HH - TM, HH + TM + TSTEP, TSTEP)
TX, TZ = np.meshgrid(txs, tzs); TH = sample(TX, TZ); assert (TH > -100).all()
TBASE = float(TH.min())
def ground(x, z):
    fx = min(max((x - txs[0]) / TSTEP, 0), len(txs) - 1.001); fz = min(max((z - tzs[0]) / TSTEP, 0), len(tzs) - 1.001)
    i, j = int(fx), int(fz); u, v = fx - i, fz - j
    return float((TH[j, i] * (1 - u) + TH[j, i + 1] * u) * (1 - v) + (TH[j + 1, i] * (1 - u) + TH[j + 1, i + 1] * u) * v - TBASE)
log('terrain', TH.shape, 'elev %.0f-%.0f' % (TH.min(), TH.max()))

# ------------------------------------------------------------------ buildings
BTYPE = {'garage': 1, 'garages': 1, 'service': 1, 'shed': 1, 'carport': 9, 'roof': 9, 'industrial': 2, 'warehouse': 2, 'commercial': 3, 'retail': 3, 'office': 3, 'supermarket': 3,
         'apartments': 4, 'residential': 5, 'house': 6, 'detached': 6, 'semidetached_house': 6, 'terrace': 5, 'villa': 6, 'farm': 6, 'church': 7, 'chapel': 7, 'cathedral': 7,
         'school': 11, 'kindergarten': 11, 'college': 11, 'public': 8, 'train_station': 8, 'hospital': 8, 'university': 8, 'civic': 8, 'greenhouse': 1}
def bheight(t, a, key):
    h, lv = num(t.get('height')), num(t.get('building:levels'))
    if h: return h
    if lv: return lv * 3.1 + 0.6
    bt, r = t.get('building', 'yes'), h01(key)
    if bt in ('garage', 'garages', 'roof', 'service', 'greenhouse', 'shed', 'carport'): return 2.8 + r * 0.8
    if bt in ('industrial', 'warehouse'): return 7 + r * 5
    if bt in ('commercial', 'retail', 'office', 'supermarket'): return 7 + r * 7
    if bt == 'apartments': return 12 + r * 10
    if bt in ('residential', 'terrace'): return 8.5 + r * 6
    if bt in ('house', 'villa', 'detached', 'semidetached_house', 'farm'): return 6.5 + r * 2.5
    if bt in ('church', 'cathedral'): return 17
    if bt == 'chapel': return 8
    if bt in ('school', 'kindergarten', 'public', 'train_station', 'hospital', 'university', 'civic'): return 9 + r * 4
    if a < 40: return 3 + r
    if a < 150: return 6 + r * 4
    if a < 600: return 8 + r * 7
    return 7 + r * 6  # big unknown footprints are mostly sheds/factories
buildings, bpolys = [], []
def add_building(outer, holes, t, key):
    if len(outer) < 3: return
    if t.get('location') == 'underground' or t.get('building') in ('construction', 'no', 'ruins') or num(t.get('layer')) and num(t.get('layer')) < 0: return
    c = centroid(outer)
    if not inside(c, 0): return
    a = abs(sarea(outer))
    if a < 6: return
    bt = t.get('building', 'yes')
    if t.get('amenity') == 'place_of_worship' and a > 120: bt = 'church'
    rec = {'p': outer, 'h': round(bheight(t, a, key), 1), 't': BTYPE.get(bt, 0), 'ht': bool(num(t.get('height')) or num(t.get('building:levels'))), 'lv': num(t.get('building:levels')), 'bt': bt}
    if t.get('man_made') == 'water_tower': rec['wt'] = True; rec['h'] = num(t.get('height')) or max(rec['h'], 25)
    if holes: rec['k'] = [h for h in holes if len(h) >= 3]
    buildings.append(rec)
mp_ways = set()
for members, t in rels:
    if t.get('type') != 'multipolygon': continue
    outers = [m[1] for m in members if m[0] == 'way' and m[2] == 'outer']; inners = [m[1] for m in members if m[0] == 'way' and m[2] == 'inner']
    mp_ways.update(outers + inners)
    if 'building' in t:
        ir = join_rings(inners)
        for o in join_rings(outers): add_building(o, ir, t, outers[0] if outers else 'r')
import os
DATA = os.environ.get('GTA_DATA', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data'))
# ------------------------------------------------------------------ DBGT, the second source (Regione Lombardia, Database GeoTopografico)
# data/dbt/<Comune>/dbgt.gpkg, as the Geoportale gives it. Inside each comune's boundary (data/confini_comuni.json) it is the reference for
# walls and fences (EL_DIV) and for the height of buildings (UN_VOL); OSM stays the base everywhere else
import sqlite3
from shapely import wkb as _wkb
from shapely.ops import polygonize
CONF = os.path.join(DATA, 'confini_comuni.json'); DBT_DIR = os.path.join(DATA, 'dbt')
_t7791 = Transformer.from_crs('EPSG:7791', 'EPSG:4326', always_xy=True)
def _gpkg_geom(blob): f_ = blob[3]; return _wkb.loads(bytes(blob[8 + [0, 32, 48, 48, 64][(f_ >> 1) & 7]:]))
def _xy(coords):  # RDN2008 UTM 32N (x, y, z, m) -> game metres
    a_ = np.asarray([(c_[0], c_[1]) for c_ in coords]); lon_, lat_ = _t7791.transform(a_[:, 0], a_[:, 1]); return list(zip((lon_ - lon0) * KX, -(lat_ - lat0) * KZ))
_comuni = {}
if os.path.exists(CONF):
    for e_ in json.load(open(CONF, encoding='utf-8'))['elements']:
        ls_ = [LineString([proj(p['lat'], p['lon']) for p in m['geometry']]) for m in e_.get('members', []) if m.get('type') == 'way' and len(m.get('geometry') or []) > 1]
        if ls_ and e_.get('tags', {}).get('name'): _comuni[e_['tags']['name'].lower()] = unary_union(list(polygonize(unary_union(ls_))))
dbt_walls, dbt_vols, _cov = [], [], []
for d_ in (sorted(os.listdir(DBT_DIR)) if os.path.isdir(DBT_DIR) else []):
    f_ = os.path.join(DBT_DIR, d_, 'dbgt.gpkg')
    if not os.path.exists(f_): continue
    if d_.lower() not in _comuni: log('dbgt: no boundary for', d_); continue
    con_ = sqlite3.connect(f_)
    # dividers: 13 fences, 18 low wall with railings, 95 'other' (mostly fences); 02 and 17 are left out until someone has seen what they are
    for blob, ty in con_.execute('select Shape, EL_DIV_TY from EL_DIV'):
        if blob is None or ty not in ('13', '18', '95'): continue
        g_ = _gpkg_geom(blob)
        for part in getattr(g_, 'geoms', [g_]):
            pts_ = _xy(part.coords)
            if len(pts_) >= 2: dbt_walls.append(pts_)
    for blob, av in con_.execute('select Shape, UN_VOL_AV from UN_VOL'):
        if blob is None or not av or float(av) <= 1: continue
        g_ = _gpkg_geom(blob)
        for part in getattr(g_, 'geoms', [g_]):
            ext_ = _xy(part.exterior.coords)
            if len(ext_) >= 4: dbt_vols.append((ext_[:-1], float(av)))
    _cov.append(_comuni[d_.lower()]); log('dbgt', d_)
dbt_cover = unary_union(_cov).buffer(-3) if _cov else GeometryCollection()  # a few metres inside the boundary: the neighbour's data meets it
prepare(dbt_cover)
log('dbgt: muri e recinzioni', len(dbt_walls), 'volumi', len(dbt_vols), 'comuni', len(_cov))
OVT = os.path.join(DATA, 'edifici_overture.geojson')
ms_h, ms_only = {}, []
if os.path.exists(OVT):
    for f_ in json.load(open(OVT, encoding='utf-8'))['features']:
        pr_ = f_['properties']; srcs = pr_.get('sources') or []; ds = {x.get('dataset') for x in srcs}
        if pr_.get('is_underground'): continue
        hh_ = pr_.get('height')
        osm_ids = [x['record_id'].split('@')[0][1:] for x in srcs if x.get('dataset') == 'OpenStreetMap' and (x.get('record_id') or '').startswith('w')]
        if osm_ids and hh_ and 'Microsoft ML Buildings' in ds: ms_h[osm_ids[0]] = hh_
        if ds == {'Microsoft ML Buildings'}:
            g_ = f_['geometry']; polys_ = g_['coordinates'] if g_['type'] == 'MultiPolygon' else [g_['coordinates']]
            for pc in polys_: ms_only.append(([proj(la, lo) for lo, la in pc[0]][:-1], [[proj(la, lo) for lo, la in h][:-1] for h in pc[1:]], hh_, pr_.get('subtype')))
for wid, (refs, t) in ways.items():
    if 'building' in t and wid not in mp_ways and refs[0] == refs[-1]:
        if wid in ms_h and not num(t.get('height')) and not num(t.get('building:levels')): t = dict(t, height=str(round(ms_h[wid], 1)))
        add_building(ring(refs), [], t, wid)
def _Pp(o, k=()):
    try:
        g = Polygon(o, [h for h in k if len(h) >= 3]).buffer(0); return g if not g.is_empty else None
    except Exception: return None
_ob = [_Pp(b['p'], b.get('k', [])) for b in buildings]; _ob = [g for g in _ob if g is not None]; _obt = STRtree(_ob); nms = 0
for k_, (o_, hs_, hh_, st_) in enumerate(ms_only):
    g_ = _Pp(o_, hs_)
    if g_ is None or g_.area < 12: continue
    if any(_ob[j].intersection(g_).area > 0.3 * g_.area for j in _obt.query(g_)): continue
    tt = {'building': {'residential': 'house', 'industrial': 'industrial', 'commercial': 'commercial', 'outbuilding': 'shed'}.get(st_, 'yes')}
    if hh_: tt['height'] = str(round(hh_, 1))
    n0 = len(buildings); add_building(o_, hs_, tt, 'ms%d' % k_); nms += len(buildings) - n0
    if len(buildings) > n0: buildings[-1]['ml'] = True
log('overture: ML heights for', len(ms_h), 'OSM buildings, ML-only footprints added', nms)
if dbt_vols:  # where the Comune's map covers: its heights, no footprints only the ML model saw, its buildings OSM lacks
    _vg = [_Pp(p_) for p_, h_ in dbt_vols]; _vok = [i for i, g_ in enumerate(_vg) if g_ is not None]; _vt = STRtree([_vg[i] for i in _vok])
    keep_, nh_, nd_ = [], 0, 0
    for b in buildings:
        g_ = _Pp(b['p'], b.get('k', []))
        if g_ is None or not dbt_cover.contains(g_.centroid): keep_.append(b); continue
        hit = [(_vg[_vok[j]].intersection(g_).area, dbt_vols[_vok[j]][1]) for j in _vt.query(g_)]; tot = sum(a_ for a_, h_ in hit)
        if tot < 0.3 * g_.area:
            if b.get('ml'): nd_ += 1; continue  # a ghost
            keep_.append(b); continue
        if not b['ht']: b['h'] = round(sum(a_ * h_ for a_, h_ in hit) / tot, 1); b['ht'] = True; nh_ += 1
        keep_.append(b)
    buildings[:] = keep_
    _bg = [g_ for g_ in (_Pp(b['p'], b.get('k', [])) for b in buildings) if g_ is not None]; _bt = STRtree(_bg); na_ = 0
    for i in _vok:
        g_ = _vg[i]
        if g_.area < 6 or not dbt_cover.contains(g_.centroid) or any(_bg[j].intersection(g_).area > 0.3 * g_.area for j in _bt.query(g_)): continue
        n0_ = len(buildings); add_building(dbt_vols[i][0], [], {'building': 'yes', 'height': str(dbt_vols[i][1])}, 'dbt%d' % i)
        if len(buildings) > n0_: buildings[-1]['dbt'] = True; na_ += 1
    log('dbgt edifici: altezze vere', nh_, 'fantasmi tolti', nd_, 'aggiunti', na_)
log('buildings', len(buildings))

# ------------------------------------------------------------------ areas
AREA_T = {'grass': 1, 'meadow': 1, 'village_green': 1, 'recreation_ground': 2, 'park': 2, 'garden': 2, 'playground': 2, 'pitch': 3, 'parking': 4,
          'platform': 5, 'water': 6, 'construction': 7, 'industrial': 8, 'retail': 9, 'commercial': 9, 'forest': 11, 'wood': 11, 'scrub': 12, 'farmland': 13, 'cemetery': 14, 'allotments': 13, 'orchard': 13, 'residential': 16, 'swimming_pool': 6, 'sports_centre': 2}
def area_type(t):
    if t.get('amenity') == 'parking' and t.get('parking') not in ('underground', 'multi-storey'): return 4
    if t.get('railway') == 'platform' or t.get('public_transport') == 'platform': return 5
    if t.get('amenity') == 'grave_yard': return 14
    if t.get('amenity') in ('school', 'kindergarten', 'college', 'university'): return 15
    for k in ('leisure', 'landuse', 'natural'):
        if t.get(k) in AREA_T: return AREA_T[t[k]]
    return None
areas = []
for members, t in rels:
    if t.get('type') != 'multipolygon' or 'building' in t: continue
    at = area_type(t)
    if not at: continue
    outers = [m[1] for m in members if m[0] == 'way' and m[2] == 'outer']; inners = [m[1] for m in members if m[0] == 'way' and m[2] == 'inner']
    ir = join_rings(inners)
    for o in join_rings(outers):
        if len(o) >= 3: areas.append((at, o, ir))
for wid, (refs, t) in ways.items():
    if wid in mp_ways or refs[0] != refs[-1] or 'building' in t: continue
    at = area_type(t)
    if at and not (t.get('highway') and t.get('area') != 'yes'):
        pts = ring(refs)
        if len(pts) >= 3: areas.append((at, pts, []))
def P(o, k=()):
    try:
        g = Polygon(o, [h for h in k if len(h) >= 3]).buffer(0)
        return g if not g.is_empty else None
    except Exception: return None
area_geoms = []
for at, o, ir in areas:
    g = P(o, ir)
    if g is not None:
        g = g.intersection(RECT.buffer(60))
        if not g.is_empty: area_geoms.append((at, g))
# ---- land the game dresses by kind (paesaggio3.js): fields, meadows, orchards, allotments, building sites, industrial yards, nurseries,
# pitches by sport (and surface), pools. One polygon each, given to the tile of its middle
LS = {'farmland': 'campo', 'meadow': 'prato', 'orchard': 'frutteto', 'vineyard': 'frutteto', 'allotments': 'orti', 'construction': 'cantiere',
      'industrial': 'industria', 'greenhouse_horticulture': 'vivaio', 'plant_nursery': 'vivaio', 'flowerbed': 'aiuola'}
def ls_kind(t):
    if t.get('leisure') == 'swimming_pool' or t.get('amenity') == 'swimming_pool': return 'piscina'
    if t.get('leisure') == 'pitch': return 'sport:' + (t.get('sport') or '').split(';')[0] + ':' + (t.get('surface') or '')
    if t.get('leisure') == 'horse_riding': return 'sport:equestrian:' + (t.get('surface') or '')
    if t.get('leisure') == 'track': return 'pista:' + (t.get('surface') or '')
    if t.get('leisure') == 'dog_park': return 'cani'
    if t.get('amenity') == 'car_wash': return 'lavaggio'
    if t.get('man_made') == 'water_tower': return 'torre_acqua:' + str(num(t.get('height')) or '')
    return LS.get(t.get('landuse'))
land = []
for members, t in rels:
    if t.get('type') != 'multipolygon' or 'building' in t: continue
    k_ = ls_kind(t)
    if not k_: continue
    for o in join_rings([m[1] for m in members if m[0] == 'way' and m[2] == 'outer']):
        if len(o) >= 3: land.append((k_, o))
for wid, (refs, t) in ways.items():
    if wid in mp_ways or refs[0] != refs[-1] or 'building' in t: continue
    k_ = ls_kind(t)
    if k_:
        pts = ring(refs)
        if len(pts) >= 3: land.append((k_, pts))
log('terreni', len(land), dict(Counter(k.split(':')[0] + (':' + k.split(':')[1] if k.startswith('sport') else '') for k, _ in land)))
WCF = os.path.join(DATA, 'wc', 'wc.npy')
WC = None; WC_BUILT = None
if os.path.exists(WCF):
    WC = np.load(WCF); wlon0, wlat0, wsx = map(float, open(WCF.replace('wc.npy', 'wc_meta.txt')).read().split())
    osm_land = unary_union([g for at, g in area_geoms]).buffer(1)
    _wc_roads = unary_union([LineString([nodes[n_] for n_ in refs if n_ in nodes]).buffer(5.0 if t['highway'] in ('motorway', 'trunk', 'primary', 'secondary', 'tertiary', 'motorway_link', 'trunk_link') else 3.5) for refs, t in ways.values() if 'highway' in t and t.get('area') != 'yes' and len([n_ for n_ in refs if n_ in nodes]) > 1])
    WCT = {10: 11, 30: 1, 40: 13, 50: None}
    for cls_, at_ in WCT.items():
        m_ = (WC == cls_); boxes = []
        for r_ in range(m_.shape[0]):
            row = m_[r_]; d_ = np.diff(np.concatenate(([0], row.view(np.int8), [0])))
            st_, en_ = np.where(d_ == 1)[0], np.where(d_ == -1)[0]
            la0, la1 = wlat0 - r_ * wsx, wlat0 - (r_ + 1) * wsx
            for a_, b_ in zip(st_, en_):
                x0, z0 = proj(la0, wlon0 + a_ * wsx); x1, z1 = proj(la1, wlon0 + b_ * wsx); boxes.append(box(min(x0, x1), min(z0, z1), max(x0, x1), max(z0, z1)))
        u_ = unary_union(boxes).buffer(-6).buffer(6).difference(osm_land).difference(_wc_roads).intersection(RECT.buffer(40))  # drop single-pixel speckle; never over a road
        if at_ is None: WC_BUILT = u_; log('worldcover built-up outside OSM zones', round(u_.area / 1e6, 2), 'km2'); continue
        added = 0
        for g_ in (list(u_.geoms) if hasattr(u_, 'geoms') else [u_]):
            if g_.geom_type == 'Polygon' and g_.area > 600: area_geoms.append((at_, g_.simplify(2.5))); added += g_.area
        log('worldcover', cls_, '->', at_, round(added / 1e6, 2), 'km2')
def wc_at(x, z):
    if WC is None: return None
    la = lat0 - z / KZ; lo = lon0 + x / KX; r_ = int((wlat0 - la) / wsx); c_ = int((lo - wlon0) / wsx)
    return int(WC[r_, c_]) if 0 <= r_ < WC.shape[0] and 0 <= c_ < WC.shape[1] else None
area_geoms.sort(key=lambda a: 0 if a[0] == 16 else 1)  # gardens first, everything else drawn over them
log('areas', len(area_geoms))

# ------------------------------------------------------------------ roads
DRIVE = {'motorway': 11, 'trunk': 10, 'primary': 9.5, 'secondary': 8.5, 'tertiary': 8, 'unclassified': 6.5, 'residential': 6.5, 'living_street': 5.5,
         'service': 4.2, 'pedestrian': 6, 'road': 6, 'motorway_link': 6, 'trunk_link': 6, 'primary_link': 6.5, 'secondary_link': 6.5, 'tertiary_link': 6}
FOOT = {'footway': 2.2, 'cycleway': 2.4, 'path': 1.8, 'steps': 2.4, 'track': 3.2, 'bridleway': 2}
RCLASS = {'motorway': 0, 'trunk': 0, 'primary': 0, 'secondary': 0, 'motorway_link': 1, 'trunk_link': 1, 'primary_link': 1, 'secondary_link': 1, 'tertiary': 1, 'tertiary_link': 1,
          'unclassified': 2, 'residential': 2, 'road': 2, 'living_street': 3, 'service': 4, 'pedestrian': 5,
          'footway': 6, 'cycleway': 6, 'path': 6, 'steps': 6, 'track': 6, 'bridleway': 6}
SPEED = {'motorway': 30, 'trunk': 25, 'primary': 15, 'secondary': 14, 'motorway_link': 15, 'trunk_link': 14, 'primary_link': 12, 'secondary_link': 12, 'tertiary': 13, 'tertiary_link': 11,
         'unclassified': 11, 'residential': 10, 'road': 10, 'living_street': 6, 'service': 6}
names, name_idx = [], {}
def nid(n):
    if not n: return -1
    if n not in name_idx: name_idx[n] = len(names); names.append(n)
    return name_idx[n]
node_index, node_list = {}, []
def gnode(ref):
    if ref not in node_index: node_index[ref] = len(node_list); node_list.append(ref)
    return node_index[ref]
def clip_runs(refs, m):
    refs = [r for r in refs if r in nodes]; runs, cur = [], []
    for i, r in enumerate(refs):
        ok = inside(nodes[r], m) or (i > 0 and inside(nodes[refs[i - 1]], m)) or (i + 1 < len(refs) and inside(nodes[refs[i + 1]], m))
        if ok: cur.append(r)
        elif cur:
            if len(cur) > 1: runs.append(cur)
            cur = []
    if len(cur) > 1: runs.append(cur)
    return runs
PK_OR = {'parallel': 1, 'diagonal': 2, 'perpendicular': 3}
def street_parking(t):  # [left, right] of the way: 0 none, 1 parallel, 2 diagonal, 3 perpendicular, +4 paid (strisce blu); None if not mapped
    out = []
    for sd in ('left', 'right'):
        v = t.get('parking:' + sd) or t.get('parking:both'); o = t.get('parking:%s:orientation' % sd) or t.get('parking:both:orientation')
        if v is None:  # the old scheme: parking:lane:left=parallel
            ol = t.get('parking:lane:' + sd) or t.get('parking:lane:both')
            v, o = (ol, ol) if ol in PK_OR else (None, None)
        k = PK_OR.get(o, 1) if v in ('lane', 'street_side', 'on_kerb', 'half_on_kerb', 'parallel', 'diagonal', 'perpendicular') else 0
        fee = t.get('parking:%s:fee' % sd) or t.get('parking:both:fee') or t.get('parking:fee')
        cond = t.get('parking:condition:' + sd) or t.get('parking:condition:both')
        if k and (fee == 'yes' or cond == 'ticket'): k += 4
        out.append(k)
    return out if any(out) else None
roads, raw_roads = [], []
rails, rivers, rows, rail_raw, barriers = [], [], [], [], []
bar_runs, gate_ways = [], []
for wid, (refs, t) in ways.items():
    hw = t.get('highway')
    if hw in DRIVE or hw in FOOT:
        if t.get('area') == 'yes': continue
        if t.get('access') == 'private' and hw == 'service' and t.get('service') in ('driveway', 'parking_aisle'): pass
        w = num(t.get('width'))
        if not w or w > 30:
            lanes = num(t.get('lanes')); w = DRIVE.get(hw) or FOOT.get(hw)
            if lanes and hw in DRIVE: w = max(w, min(lanes, 4) * 3.4)
        layer = num(t.get('layer')) or 0
        bridge = t.get('bridge') in ('yes', 'viaduct') or (layer >= 1 and t.get('bridge') not in (None, 'no')) or (layer >= 1 and hw in ('trunk', 'trunk_link', 'secondary', 'primary') and t.get('tunnel') is None)
        for run in clip_runs(refs, 40):
            raw_roads.append({'refs': run, 'w': round(w, 1), 'wx': bool(num(t.get('width'))) and num(t.get('width')) <= 30, 'c': RCLASS[hw], 'hw': hw, 'n': nid(t.get('name') or t.get('ref')),
                              'o': t.get('oneway') in ('yes', '1') or hw in ('motorway', 'motorway_link') or t.get('junction') == 'roundabout',
                              'bridge': bridge, 'layer': layer, 'emb': t.get('embankment') == 'yes', 'tunnel': t.get('tunnel') in ('yes', 'covered') or layer < 0, 'under': t.get('tunnel') in ('yes', 'covered', 'building_passage') or layer < 0,
                              'x': hw in ('motorway', 'trunk', 'motorway_link', 'trunk_link'), 'ms': num(t.get('maxspeed')) if str(t.get('maxspeed', '')).replace('.', '').isdigit() else None, 'pk': street_parking(t)})
    elif t.get('railway') == 'rail' and (t.get('tunnel') != 'yes' or sum(math.dist(nodes[a], nodes[b]) for a, b in zip(refs, refs[1:]) if a in nodes and b in nodes) < 200) and t.get('service') not in ('yard', 'siding', 'spur'):  # short rail tunnels (underpasses) stay as track at grade
        lay = num(t.get('layer')) or 0
        for run in clip_runs(refs, 300): rails.append([nodes[r] for r in run]); rail_raw.append({'refs': run, 'bridge': t.get('bridge') in ('yes', 'viaduct') or lay >= 1, 'emb': t.get('embankment') == 'yes', 'layer': lay})
    elif t.get('waterway') in ('river', 'stream', 'canal') and t.get('tunnel') not in ('yes', 'culvert') and not str(t.get('layer', '0')).startswith('-'):
        for run in clip_runs(refs, 60): rivers.append(([nodes[r] for r in run], 3.2 if t['waterway'] == 'river' else 1.4))
    elif t.get('barrier') in ('wall', 'fence', 'hedge', 'retaining_wall', 'city_wall', 'guard_rail', 'handrail'):
        kind = {'wall': 1, 'city_wall': 1, 'fence': 2, 'handrail': 2, 'guard_rail': 2, 'hedge': 3, 'retaining_wall': 4}[t['barrier']]
        hgt = num(t.get('height')) or {1: 1.7, 2: 1.6, 3: 1.6, 4: 1.2}[kind]
        for run in clip_runs(refs, 5): barriers.append(([nodes[r] for r in run], kind, min(hgt, 3.5))); bar_runs.append(run)
    elif t.get('barrier') in ('gate', 'swing_gate', 'sliding_gate', 'lift_gate'):
        pts = [nodes[r] for r in refs if r in nodes]
        if len(pts) >= 2 and inside(pts[0], 0): gate_ways.append((pts, 'l' if t['barrier'] == 'lift_gate' else 'g', num(t.get('height'))))
    elif t.get('natural') == 'tree_row':
        rows.append([nodes[r] for r in refs if r in nodes])
log('roads', len(raw_roads), 'rails', len(rails), 'rivers', len(rivers))

# ---- only bridges that pass over a road or a railway are raised (river bridges stay at street level); short tunnels stay on the surface
for r in raw_roads: r['line'] = LineString([nodes[n_] for n_ in r['refs']])
for r in raw_roads: r['tunnel'] = r['tunnel'] and r['line'].length > 80
# ---- narrow streets: where the houses stand closer than the default width, shrink the road instead of letting walls poke into it
_hb = [P(b['p'], b.get('k', [])) for b in buildings if b['t'] != 9 and not b.get('ml')]; _hb = [g for g in _hb if g is not None]
_ht = STRtree(_hb); nnarrow = 0
for r in raw_roads:
    if r['wx'] or r['c'] not in (0, 1, 2, 3, 4) or r['x'] or r['bridge'] or r['tunnel'] or r['line'].length < 4: continue
    L = r['line']; half = r['w'] / 2; cl = []
    for k in range(int(L.length // 3) + 1):
        pt = L.interpolate(min(L.length, k * 3)); d = half + 3
        for j in _ht.query(pt.buffer(half + 3)): d = min(d, _hb[j].distance(pt))
        cl.append(d)
    cl.sort(); q10 = cl[max(0, int(len(cl) * 0.1) - 1)] if len(cl) > 3 else cl[0]
    if q10 < half:
        r['w'] = round(max(3.2 if r['c'] == 4 else 4.2 if r['c'] >= 2 else 5.5, min(r['w'], 2 * q10 - 0.3)), 1); nnarrow += 1
    r['clear'] = q10
log('narrowed streets', nnarrow)
# ---- the street always wins: cut away the part of any building that pokes into the carriageway
_cb = [r['line'].buffer(r['w'] / 2 + 0.15) for r in raw_roads if r['c'] <= 5 and not r['bridge'] and not r['tunnel'] and r['line'].length > 0.5]
_cbt = STRtree(_cb); nclip = ndrop = 0; keep_b = []
for b in buildings:
    if b['t'] == 9: keep_b.append(b); continue
    g = P(b['p'], b.get('k', []))
    if g is None: continue
    hits = [_cb[j] for j in _cbt.query(g) if _cb[j].intersects(g)]
    if hits:
        cut = g.difference(unary_union(hits))
        lost = g.area - cut.area
        if lost > 0.5:
            parts = [x for x in (list(cut.geoms) if hasattr(cut, 'geoms') else [cut]) if x.geom_type == 'Polygon']
            big = max(parts, key=lambda x: x.area) if parts else None
            if big is None or big.area < 10 or (b.get('ml') and big.area < 0.5 * g.area): ndrop += 1; continue
            big = big.simplify(0.05)
            b['p'] = list(big.exterior.coords)[:-1]; b['k'] = [list(h.coords)[:-1] for h in big.interiors]
            if not b['k']: b.pop('k')
            nclip += 1
    keep_b.append(b)
buildings[:] = keep_b
log('buildings clipped to the street edge', nclip, 'dropped', ndrop)
railL0 = [LineString(p) for p in rails if len(p) >= 2]
_low = [r['line'] for r in raw_roads if not r['bridge'] and not r['tunnel'] and r['line'].length > 0.1] + railL0
_lowtree = STRtree(_low)
for r in raw_roads:
    if r['bridge']: r['bridge'] = any(r['line'].crosses(_low[i]) for i in _lowtree.query(r['line']))
log('overpasses', sum(1 for r in raw_roads if r['bridge']))
# ---- road elevation: bridges are sources; the height carries on along the straight continuation (ramps), side streets drop fast
adj = defaultdict(list)  # node -> (other, length, grade, way_is_car)
edge_fam = {}  # (a, b) -> (name id, expressway?, way index, bridge?) of the road using that edge
src_car, src_foot, src_dir = {}, {}, defaultdict(set)
for wi, r in enumerate(raw_roads):
    car = r['c'] <= 5
    if r['tunnel']: continue
    for a_, b_ in zip(r['refs'], r['refs'][1:]):
        L = math.dist(nodes[a_], nodes[b_]); g = 0 if (r['bridge'] or r['emb']) else (0.055 if car else 0.09)
        adj[a_].append((b_, L, g, car)); adj[b_].append((a_, L, g, car)); edge_fam[(a_, b_)] = edge_fam[(b_, a_)] = (r['n'], r['x'], wi, bool(r['bridge']))
    if r['bridge']:
        H = 6.6 * min(max(r['layer'], 1), 2.3)
        for i, n_ in enumerate(r['refs']):
            d = src_car if car else src_foot
            d[n_] = max(d.get(n_, 0), H)
            if i > 0: src_dir[n_].add(r['refs'][i - 1])
            if i < len(r['refs']) - 1: src_dir[n_].add(r['refs'][i + 1])
def propagate(srcs, car_only, cap=None, drops=None):
    val = dict(srcs); pq = []
    for n_, v in srcs.items():
        for pv in src_dir.get(n_) or ['']: pq.append((-v, n_, pv))
    heapq.heapify(pq); best = {}
    while pq:
        v, n_, pv = heapq.heappop(pq); v = -v
        if best.get((n_, pv), -1) >= v: continue
        best[(n_, pv)] = v
        for m, L, g, car in adj[n_]:
            if car_only and not car: continue
            if m == pv: continue
            if pv and g > 0:
                d0 = tang(nodes[pv], nodes[n_]); d1 = tang(nodes[n_], nodes[m])
                if d0[0] * d1[0] + d0[1] * d1[1] < 0.82: g = 0.3  # turning off the ramp: drop within a few metres
                fp, fc = edge_fam.get((pv, n_)), edge_fam.get((n_, m))
                # a ramp never lifts a different local street. Unnamed car ways (roundabouts, service roads) always drop; an unnamed
                # foot/cycle path is "the same street" along its own way or as the straight approach right off a bridge
                # (footbridges are split from their unnamed ramps in OSM: without this the Meredo ramp fell 6.6 m in 22 m)
                if fp and fc and not fc[1] and (fc[0] != fp[0] or (fc[0] == -1 and (car or (fc[2] != fp[2] and not fp[3])))): g = 0.3
                if g == 0.3 and drops is not None: drops.append((n_, m, L, v))
            nv = v - g * L
            if cap: nv = min(nv, cap.get(m, 1e9))
            if nv > 0.05:
                if nv > val.get(m, 0) + 1e-6: val[m] = nv
                if best.get((m, n_), -1) < nv: heapq.heappush(pq, (-nv, m, n_))
    return val
def tang(a, b): L = math.dist(a, b) or 1; return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
# a shared node is one height: where a low street joins a raised ramp (a merge, a diverge, a side road) the ramp comes down
# to it instead of the street jumping up 30% grades. The junction caps the height, the cap grows at RAMP_G along the roads
# and the bridges keep theirs, so the ramp spreads the climb between the deck and the junction (Meda: 2.6 m steps in 10 m)
RAMP_G = 0.07
drops = []; off_car = propagate(src_car, True, drops=drops); pin = {}
for _ in range(3):
    new = 0
    for n_, m, L, v in drops:
        base = off_car.get(m, 0); base = 0 if base <= max(0, v - 0.3 * L) + 1e-6 else base  # the street's own height, not the lift it got here
        if off_car.get(n_, 0) - (base + RAMP_G * L) > 0.3 and base + RAMP_G * L < pin.get(n_, 1e9) - 0.05: pin[n_] = base + RAMP_G * L; new += 1
    if not new: break
    cap = {}
    for p_, pv_ in list(pin.items()):  # each junction alone, a steeper ramp when a deck is close; too close and the street drops as before
        for rg in (RAMP_G, 0.1, 0.14):
            c = {p_: pv_}; pq = [(pv_, p_)]; ok = True
            while pq and ok:
                v, n_ = heapq.heappop(pq)
                if v > c.get(n_, 1e9) or v > 6.6 * 2.3: continue
                if src_car.get(n_, 0) > v + 0.5: ok = False
                for m, L, g, car in adj[n_]:
                    nv = v + rg * L
                    if car and nv < c.get(m, 1e9): c[m] = nv; heapq.heappush(pq, (nv, m))
            if ok: break
        if not ok: del pin[p_]; continue
        for n_, v in c.items(): cap[n_] = min(cap.get(n_, 1e9), v)
    log('ramp caps', len(pin), 'junctions')
    drops = []; off_car = propagate(src_car, True, cap=cap, drops=drops)
off_foot = propagate({**src_foot, **{k: v for k, v in off_car.items()}}, False)
# absolute deck heights: terrain + offset, smoothed linearly across each bridge span
deckH = {}
for r in raw_roads:
    offs = [(off_car if r['c'] <= 5 else off_foot).get(n_, 0) for n_ in r['refs']]
    if max(offs) < 0.3: continue
    hs = [ground(*nodes[n_]) + o for n_, o in zip(r['refs'], offs)]
    if r['bridge'] and len(hs) > 2:
        cum = [0]
        for a, b in zip(r['refs'], r['refs'][1:]): cum.append(cum[-1] + math.dist(nodes[a], nodes[b]))
        for i in range(1, len(hs) - 1): hs[i] = hs[0] + (hs[-1] - hs[0]) * cum[i] / (cum[-1] or 1)
    for n_, hh in zip(r['refs'], hs): deckH[n_] = max(deckH.get(n_, -1e9), hh) if r['bridge'] else deckH.get(n_, hh)
    r['deck'] = True
log('elevated nodes', len(deckH), 'decks', sum(1 for r in raw_roads if r.get('deck')))

# ---- railway elevation
radj = defaultdict(list); rsrc = {}; rdir = defaultdict(set)
_roadtree_lines = [r['line'] for r in raw_roads if not r['tunnel'] and r['line'].length > 0.1]
_roadtree = STRtree(_roadtree_lines)
for rr in rail_raw:
    line = LineString([nodes[n_] for n_ in rr['refs']])
    if rr['bridge']: rr['bridge'] = any(line.crosses(_roadtree_lines[i]) for i in _roadtree.query(line))
    for a_, b_ in zip(rr['refs'], rr['refs'][1:]):
        L = math.dist(nodes[a_], nodes[b_]); g = 0 if (rr['bridge'] or rr['emb']) else 0.014
        radj[a_].append((b_, L, g, True)); radj[b_].append((a_, L, g, True))
    if rr['bridge']:
        for i, n_ in enumerate(rr['refs']):
            rsrc[n_] = 7.0
            if i > 0: rdir[n_].add(rr['refs'][i - 1])
            if i < len(rr['refs']) - 1: rdir[n_].add(rr['refs'][i + 1])
_adj_backup, _dir_backup = adj, src_dir
adj, src_dir = radj, rdir
rail_off = propagate(rsrc, False)
adj, src_dir = _adj_backup, _dir_backup
railH = {n_: ground(*nodes[n_]) + o for n_, o in rail_off.items() if o > 0.3}
for rr in rail_raw:
    rr['h'] = [railH.get(n_) for n_ in rr['refs']]
    rr['elev'] = [h is not None and h - ground(*nodes[n_]) > 1.0 for n_, h in zip(rr['refs'], rr['h'])]
log('elevated rail nodes', len(railH), 'rail bridges', sum(1 for rr in rail_raw if rr['bridge']))
coordH = {key(nodes[n_]): h for n_, h in railH.items()}

# ------------------------------------------------------------------ geometry (shapely)
# ---- fill residential blocks that OSM left empty with villette along the streets (OSM building coverage is patchy outside the centres)
_res = unary_union([g for at, g in area_geoms if at == 16] + ([WC_BUILT] if WC_BUILT is not None else [])).intersection(RECT.buffer(-10))
_occ = unary_union([g.buffer(8) for g in _hb])
_band = unary_union([r['line'].buffer(r['w'] / 2 + 2.6, cap_style=2) for r in raw_roads if r['c'] <= 6 and not r['tunnel'] and r['line'].length > 0.5])
_other = unary_union([g for at, g in area_geoms if at != 16] + [g_ for g_ in (P(pts) for k, pts in land) if g_ is not None])  # pitches, parks, car parks, fields...: never a made-up house on them
_free = _res.difference(_occ).difference(_band).difference(_other.buffer(2)).difference(dbt_cover).buffer(-0.5)  # the DBGT has every real house: none made up there
prepare(_free); prepare(_band)
_placed, nproc = [], 0
_pg = {}
def _clash(poly):
    c = poly.centroid; k0 = (int(c.x // 30), int(c.y // 30))
    for dx in (-1, 0, 1):
        for dz in (-1, 0, 1):
            for o in _pg.get((k0[0] + dx, k0[1] + dz), []):
                if o.distance(poly) < 4: return True
    return False
for r in sorted(raw_roads, key=lambda r: r['c']):
    if r['c'] not in (2, 3, 4) or r['tunnel'] or r.get('bridge') or r['line'].length < 14: continue
    L = r['line']
    if not _free.intersects(L.buffer(r['w'] / 2 + 22)): continue
    for sd in (1, -1):
        s0 = 7 + h01(str(r['refs'][0]) + str(sd)) * 6
        while s0 < L.length - 7:
            hh = h01(f"{r['refs'][0]}{sd}{s0:.0f}")
            fw, dp = 8.5 + hh * 4, 8 + h01(f"d{s0:.0f}{sd}") * 3.5
            pa, pb = L.interpolate(max(0, s0 - 1)), L.interpolate(min(L.length, s0 + 1)); ux, uz = tang((pa.x, pa.y), (pb.x, pb.y)); nx, nz = -uz * sd, ux * sd
            pc = L.interpolate(s0); off = r['w'] / 2 + 1.8 + 4.5 + hh * 2.5 + dp / 2
            cx, cz = pc.x + nx * off, pc.y + nz * off
            pts = [(cx + ux * a + nx * b, cz + uz * a + nz * b) for a, b in ((-fw / 2, -dp / 2), (fw / 2, -dp / 2), (fw / 2, dp / 2), (-fw / 2, dp / 2))]
            poly = Polygon(pts)
            if _free.contains(poly) and not _band.intersects(poly) and not _clash(poly) and (WC is None or wc_at(cx, cz) == 50):
                c = poly.centroid; _pg.setdefault((int(c.x // 30), int(c.y // 30)), []).append(poly)
                buildings.append({'p': pts, 'h': round(5.9 + hh * 1.6, 1), 't': BTYPE.get('house', 0), 'ht': False, 'lv': None, 'bt': 'house', 'proc': True}); nproc += 1
                s0 += fw + 7 + h01(f"g{s0:.0f}{sd}") * 6
            else: s0 += 3
log('procedural villette', nproc)
bgeoms = [P(b['p'], b.get('k', [])) for b in buildings if b['t'] != 9]
_bl = [(b, g) for b, g in zip([b for b in buildings if b['t'] != 9], bgeoms) if g is not None]
_bt = STRtree([g for b, g in _bl])
nvil = 0
_pools = [P(ring(refs)) for wid, (refs, t) in ways.items() if t.get('leisure') == 'swimming_pool' and refs[0] == refs[-1] and len(refs) >= 4]
_pools = [g for g in _pools if g is not None and g.area < 300]
_pt = STRtree(_pools) if _pools else None
for i, (b, g) in enumerate(_bl):
    a = g.area
    pool = _pt is not None and b['bt'] in ('yes', 'house', 'residential', 'villa', 'detached') and a < 900 and (b['lv'] is None or b['lv'] <= 3) and any(_pools[j].distance(g) < 15 for j in _pt.query(g.buffer(15)))
    small_house = pool or b['bt'] in ('house', 'detached', 'villa', 'semidetached_house') or (b['bt'] == 'yes' and 45 < a < 280 and (b['lv'] is None or b['lv'] <= 2))
    if not small_house or b['t'] in (1, 2, 3, 7, 8, 9, 11): continue
    near = [j for j in _bt.query(g.buffer(1.0)) if j != i]
    if any(_bl[j][1].area > 30 and _bl[j][1].distance(g) < 0.8 for j in near) and b['bt'] == 'yes' and not pool: continue
    b['t'] = 10; nvil += 1; b['villa'] = True
    if not b['ht'] or pool: b['h'] = round((6.6 if a > 250 else 5.9) + h01(str(b['p'][0])) * 1.6, 1)
log('villette', nvil)
bunion = unary_union([g for g in bgeoms if g is not None]).buffer(0.05)
prepare(bunion)
btree_geoms = [g for g in bgeoms if g is not None]
btree = STRtree(btree_geoms)
def road_line(r): return LineString([nodes[n_] for n_ in r['refs']])
# min free half-width (for lanes/kerbside parking) and sidewalk walking offset
for r in raw_roads:
    L = r['line']
    if L.length < 0.1: r['mh'] = r['w'] / 2; r['wk'] = r['w'] / 2; continue
    pts = [L.interpolate(d) for d in np.arange(0, L.length + 0.01, 4.0)]
    idx, dist = btree.query_nearest(pts, return_distance=True, max_distance=14, all_matches=False)
    dd = np.full(len(pts), 14.0)
    if len(idx):
        for (pi, gi), d in zip(idx.T, dist): dd[pi] = min(dd[pi], d)
    md = float(dd.min())
    r['mh'] = round(max(min(r['w'] / 2, md - 0.3), min(r['w'] / 2, 1.3)), 2)
    r['wk'] = round(max(r['mh'] + 0.45, min(r['w'] / 2 + 0.9, md - 0.55)), 2) if r['c'] <= 3 else (round(max(0.4, r['mh'] - 0.5), 2) if r['c'] <= 5 else 0)
def rbuf(cond, extra):
    out = [r['line'].buffer(r['w'] / 2 + extra, quad_segs=5) for r in raw_roads if cond(r) and r['line'].length > 0.1]
    return unary_union(out) if out else GeometryCollection()
flat = lambda r: not r.get('deck') and not r['tunnel']
parking = unary_union([g for at, g in area_geoms if at in (4,)])
platforms = unary_union([g for at, g in area_geoms if at == 5])
asph = rbuf(lambda r: r['c'] <= 4 and flat(r), 0).difference(bunion)
pedz = rbuf(lambda r: r['c'] == 5 and flat(r), 0).difference(asph).difference(bunion)
railL = [LineString(p) for p in rails if len(p) >= 2]
_lowrail = []
for rr in rail_raw:
    pts = [nodes[n_] for n_ in rr['refs']]
    for i in range(1, len(pts)):
        if not (rr['elev'][i - 1] or rr['elev'][i]): _lowrail.append(LineString([pts[i - 1], pts[i]]))
corridor = unary_union([l.buffer(2.9, quad_segs=4) for l in _lowrail]) if _lowrail else GeometryCollection()
side = rbuf(lambda r: r['c'] <= 3 and flat(r) and not r['x'] and not r['hw'].endswith('_link') and r.get('clear', 99) > r['w'] / 2 + 1.0, 1.8).difference(asph).difference(pedz).difference(bunion).difference(parking).difference(rbuf(lambda r: r.get('deck') or r['x'], 0.4))
if not corridor.is_empty: side = side.difference(corridor.buffer(-0.5))
side = side.buffer(-0.45, join_style=2).buffer(0.45, join_style=2).intersection(side)  # drop slivers the houses squeezed
foot = rbuf(lambda r: r['c'] == 6 and flat(r), 0).difference(asph).difference(side).difference(pedz).difference(bunion)
ex = rbuf(lambda r: r['x'] and not r['tunnel'], 0)
median = ex.buffer(4.5, quad_segs=3).buffer(-4.5, quad_segs=3).difference(ex).difference(bunion) if not ex.is_empty else GeometryCollection()
log('surfaces done')

# railway fences: corridor edge, open at level crossings / platforms / track ends
fences = []
if not corridor.is_empty:
    xpts = []
    for r in raw_roads:
        if not flat(r) or r['c'] > 6: continue
        for l in railL:
            if r['line'].distance(l) > 0.01: continue
            x_ = r['line'].intersection(l)
            for g_ in ([x_] if x_.geom_type == 'Point' else [g for g in getattr(x_, 'geoms', []) if g.geom_type == 'Point']): xpts.append(g_.buffer(r['w'] / 2 + 3.5))
    parallel = rbuf(lambda r: flat(r) and r['c'] <= 6, 0.4)
    corr = corridor.difference(parallel).difference(bunion)
    tips = [c for i, l in enumerate(railL) for c in (l.coords[0], l.coords[-1]) if not any(l2.distance(Point(c)) < 1.0 for j, l2 in enumerate(railL) if j != i)]
    openings = unary_union(xpts + [platforms.buffer(0.6), bunion.buffer(0.3)] + [Point(c).buffer(9) for c in tips])
    cut = corr.boundary.difference(openings).intersection(RECT.buffer(20))
    merged = linemerge(cut) if not cut.is_empty and cut.geom_type in ('MultiLineString', 'LineString') else cut
    for l in (list(merged.geoms) if hasattr(merged, 'geoms') else [merged]):
        if isinstance(l, LineString) and l.length > 2: fences.append(list(l.simplify(0.15).coords))
log('fences', len(fences))
gates = [Point(nodes[r_]) for r_, t in ntags.items() if t.get('barrier') in ('gate', 'lift_gate', 'swing_gate', 'sliding_gate', 'entrance', 'kissing_gate')]
bar_cut = unary_union([rbuf(lambda r: r['c'] <= 5 and flat(r), 0.5), rbuf(lambda r: r['c'] == 6 and flat(r), 0.25), bunion.buffer(0.15)] + [g.buffer(1.8) for g in gates])
prepare(bar_cut)
# where the DBGT covers, its dividers replace OSM's (emptied in place: the gates below index this list by position)
if dbt_walls:
    nrep_ = 0
    for i_, (pts, k_, h_) in enumerate(barriers):
        if len(pts) >= 2 and dbt_cover.contains(LineString(pts).centroid): barriers[i_] = ([], k_, h_); nrep_ += 1
    for pts in dbt_walls: barriers.append((pts, 2, 1.6))
    log('dbgt: muri OSM sostituiti', nrep_, 'aggiunti', len(dbt_walls))
# cemeteries are walled: perimeter wall wherever OSM has not drawn one (gates/paths open it like any other wall)
_osm_bar_all = unary_union([LineString(pts).buffer(1.5) for pts, k, h in barriers if len(pts) >= 2]) if barriers else GeometryCollection()
ncw = 0
for at, g in area_geoms:
    if at != 14: continue
    for poly in (list(g.geoms) if hasattr(g, 'geoms') else [g]):
        if poly.geom_type != 'Polygon' or poly.area < 400: continue
        ring_ = LineString(poly.exterior.coords).difference(_osm_bar_all)
        for part in (list(ring_.geoms) if hasattr(ring_, 'geoms') else [ring_]):
            if isinstance(part, LineString) and part.length > 2: barriers.append((list(part.coords), 1, 2.4)); ncw += 1
log('cemetery walls', ncw)
bar_out = []
# cut each line only against the pieces of bar_cut it touches, not the whole union: this was most of the build's time
# (the same pieces bar_cut is the union of, kept apart: united, the street buffers are one polygon as big as the whole network)
_bc_parts = [r['line'].buffer(r['w'] / 2 + (0.5 if r['c'] <= 5 else 0.25), quad_segs=3) for r in raw_roads if r['c'] <= 6 and flat(r) and r['line'].length > 0.1] + [g.buffer(0.2) for g in btree_geoms] + [g.buffer(1.8) for g in gates]
_bc_tree = STRtree(_bc_parts)
for bi_, (pts, kind, hgt) in enumerate(barriers):
    if bi_ % max(1, len(barriers) // 10) == 0: log('muri %d%%' % (bi_ * 100 // max(1, len(barriers))))  # progress: this used to be the slow step
    if len(pts) < 2: continue
    L = LineString(pts); near_ = _bc_tree.query(L)
    c = (L.difference(unary_union([_bc_parts[j] for j in near_])) if len(near_) else L).intersection(RECT)
    for part in (list(c.geoms) if hasattr(c, 'geoms') else [c]):
        if isinstance(part, LineString) and part.length > 1.0: bar_out.append((list(part.simplify(0.1).coords), kind, hgt))
log('barriers', len(bar_out), 'of', len(barriers), 'gates', len(gates))

# ---- gates (cancelli): fill the openings that bar_cut leaves in fences/walls; on footpaths they stand open
node_road = {}
for r in raw_roads:
    for n_ in r['refs']:
        if n_ not in node_road or r['c'] < node_road[n_]['c']: node_road[n_] = r
node_bar = {}
for bi, run in enumerate(bar_runs):
    for n_ in run: node_bar.setdefault(n_, bi)
gate_out = []
for r_, t in ntags.items():
    if t.get('barrier') not in ('gate', 'lift_gate', 'swing_gate', 'sliding_gate'): continue
    p = nodes[r_]
    if not inside(p, 0): continue
    rd = node_road.get(r_)
    if rd and (rd['c'] <= 1 or not flat(rd)): continue  # gates across main roads stay open
    kind = 'l' if t['barrier'] == 'lift_gate' else ('o' if rd and rd['c'] == 6 else 'g')
    span = None
    if r_ in node_bar:
        bpts, bk, bh = barriers[node_bar[r_]]
        gp = Point(p); c = LineString(bpts).intersection(bar_cut)
        for part in (list(c.geoms) if hasattr(c, 'geoms') else [c]):
            if isinstance(part, LineString) and part.distance(gp) < 0.05 and 0.8 < part.length < 12: span = (part.coords[0], part.coords[-1]); break
        hgt = min(2.2, max(1.2, bh))
    else: hgt = 1.6
    if span is None and rd:
        k = rd['refs'].index(r_); a = nodes[rd['refs'][max(0, k - 1)]]; b = nodes[rd['refs'][min(len(rd['refs']) - 1, k + 1)]]
        ux, uz = tang(a, b); hw_ = rd['w'] / 2 + 0.3
        span = ((p[0] + uz * hw_, p[1] - ux * hw_), (p[0] - uz * hw_, p[1] + ux * hw_))
    if span is None: continue
    gate_out.append([q(span[0][0]), q(span[0][1]), q(span[1][0]), q(span[1][1]), kind, round(1.0 if kind == 'l' else hgt, 1), 1 if rd and rd['c'] <= 3 else 0])
for pts, kind, hh in gate_ways:
    L = LineString(pts)
    if not 0.8 < L.length < 14: continue
    if any(r['c'] <= 3 and flat(r) and r['line'].intersects(L) for r in raw_roads if r['line'].distance(L) < 1): continue
    gate_out.append([q(pts[0][0]), q(pts[0][1]), q(pts[-1][0]), q(pts[-1][1]), kind, round(1.0 if kind == 'l' else min(2.2, max(1.2, hh or 1.6)), 1)])
log('gate meshes', len(gate_out))

# ---- villa frontages: muretto + cancellata along the street with a gate, where OSM has nothing mapped
_vil = [(b, g) for b, g in _bl if b.get('villa')]
_streets = [r for r in raw_roads if r['c'] <= 3 and flat(r) and not r['x'] and r['line'].length > 5]
_stt = STRtree([r['line'] for r in _streets])
_osm_bar = unary_union([LineString(pts).buffer(2.0) for pts, k, h in barriers if len(pts) >= 2]) if barriers else GeometryCollection()
_cut_f = unary_union([rbuf(lambda r: r['c'] <= 5 and flat(r), 0.6), rbuf(lambda r: r['c'] == 6 and flat(r), 0.2), bunion.buffer(0.6), parking, platforms, pedz, _osm_bar,
                      corridor.buffer(0.5) if not corridor.is_empty else GeometryCollection(), dbt_cover] + [LineString(p).buffer(w + 1.5) for p, w in rivers if len(p) >= 2])  # no made-up frontages where the DBGT has the real ones
prepare(_cut_f)
_drive = [r for r in raw_roads if r['c'] in (4, 5) and flat(r) and r['line'].length > 1]
_dt = STRtree([r['line'] for r in _drive]) if _drive else None
front_lines, front_gates = [], []
for b, g in _vil:
    c = g.centroid; best = None
    for j in _stt.query(g.buffer(24)):
        d = _streets[j]['line'].distance(g)
        if d < 24 and (best is None or d < best[0]): best = (d, _streets[j])
    if best is None: continue
    r = best[1]; L = r['line']; half = r['w'] / 2 + 1.8 + 0.35
    s0 = L.project(c); pa = L.interpolate(max(0, s0 - 1)); pb = L.interpolate(min(L.length, s0 + 1)); ux, uz = tang((pa.x, pa.y), (pb.x, pb.y))
    sgn_ = 1 if (c.x - pa.x) * -uz + (c.y - pa.y) * ux > 0 else -1
    try: off = L.offset_curve(half * sgn_, quad_segs=2, join_style=2)
    except Exception: continue
    if off.is_empty or off.geom_type != 'LineString': continue
    if off.distance(g) < 1.6: continue  # the house stands on the pavement: no front garden
    xs = [off.project(Point(p)) for p in g.exterior.coords]; a0, a1 = max(0, min(xs) - 3.5), min(off.length, max(xs) + 3.5)
    if a1 - a0 < 4: continue
    from shapely.ops import substring
    seg = substring(off, a0, a1)
    if seg.is_empty or seg.length < 4: continue
    front_lines.append(seg)
    # gate: on the driveway if one reaches the street here, otherwise facing the house
    gp = None
    if _dt is not None:
        for j in _dt.query(seg.buffer(1)):
            x = _drive[j]['line'].intersection(seg)
            if not x.is_empty: gp = x if x.geom_type == 'Point' else x.centroid; gw = _drive[j]['w'] + 0.6; break
    if gp is None:
        gp = off.interpolate(off.project(c)); depth = g.distance(gp); gw = 3.4 if depth > 2.8 else 1.2
    ga = off.project(gp); front_gates.append((off, ga, min(5.5, gw)))
fl = unary_union(front_lines) if front_lines else GeometryCollection()
gate_zone = unary_union([o.interpolate(a).buffer(w / 2) for o, a, w in front_gates]) if front_gates else GeometryCollection()
fl = fl.difference(_cut_f).difference(gate_zone)
nf = 0
for part in (list(fl.geoms) if hasattr(fl, 'geoms') else [fl]):
    if isinstance(part, LineString) and part.length > 1.2:
        k = 3 if h01(str(part.coords[0])) < 0.22 else 2
        bar_out.append((list(part.simplify(0.15).coords), k, 1.5 if k == 3 else 1.6)); nf += 1
ng = 0
for o, a, w in front_gates:
    g0, g1 = o.interpolate(max(0, a - w / 2)), o.interpolate(min(o.length, a + w / 2)); m = o.interpolate(a)
    if _cut_f.contains(m) and not any(r['line'].distance(m) < r['w'] / 2 + 0.8 for r in _drive): continue
    if any(math.dist((m.x, m.y), ((gg[0] + gg[2]) / 20, (gg[1] + gg[3]) / 20)) < 3 for gg in gate_out): continue
    gate_out.append([q(g0.x), q(g0.y), q(g1.x), q(g1.y), 'g', 1.6, 0]); ng += 1
log('villa frontages', nf, 'gates', ng, 'villas with pool', sum(1 for b, g in _vil if b['h'] >= 6.6))

# ---- fountains
fountains = []
for wid, (refs, t) in ways.items():
    if t.get('amenity') == 'fountain' and refs[0] == refs[-1] and len(refs) >= 4:
        pts = ring(refs); g = P(pts)
        if g is None or not inside(centroid(pts), 0): continue
        c = g.centroid; fountains.append([q(c.x), q(c.y), round(min(12, max(1.2, math.sqrt(g.area / math.pi))), 1)])
for r_, t in ntags.items():
    if t.get('amenity') == 'fountain' and inside(nodes[r_], 0) and t.get('drinking_water') != 'yes' and not any(math.dist(nodes[r_], (f[0] / 10, f[1] / 10)) < f[2] + 3 for f in fountains):
        fountains.append([q(nodes[r_][0]), q(nodes[r_][1]), 1.6])
log('fountains', len(fountains))

# ---- rivers: merge the OSM pieces, then cut them where a road / railway / building passes over (a bridge or culvert mouth)
from shapely.ops import linemerge
from shapely.strtree import STRtree as _ST
riv_lines = []
for w_ in sorted(set(w for p, w in rivers)):
    ml = linemerge([LineString(p) for p, w in rivers if w == w_ and len(p) >= 2])
    for l in (list(ml.geoms) if hasattr(ml, 'geoms') else [ml]):
        if isinstance(l, LineString) and l.length > 1: riv_lines.append((l, w_))
cut_src = []
for r in raw_roads:
    if flat(r) and r['line'].length > 0.1:
        cut_src.append((r['line'], r['w'] / 2 + (1.8 if r['c'] <= 3 and not r['x'] else 0) + 0.6))
for l in _lowrail: cut_src.append((l, 3.4))
_cl = [c[0] for c in cut_src]; _ct = _ST(_cl)
all_riv = [l for l, w in riv_lines]
bgeoms_buf = [g.buffer(0.3) for g in bgeoms if g is not None]; _bt = _ST(bgeoms_buf)
def _dir_at(line, pt):
    d = line.project(pt); a = line.interpolate(max(0, d - 1)); b = line.interpolate(min(line.length, d + 1)); return tang((a.x, a.y), (b.x, b.y))
riv_out = []
for RL, w_ in riv_lines:
    zones = []
    for i in _ct.query(RL.buffer(w_ + 8)):
        cl, half = cut_src[i]
        band = cl.buffer(half, cap_style=2)
        x = RL.intersection(cl)
        pts = [x] if x.geom_type == 'Point' else [g for g in getattr(x, 'geoms', []) if g.geom_type == 'Point']
        for P0 in pts:
            ra = _dir_at(RL, P0); rb = _dir_at(cl, P0); sn = max(0.3, abs(ra[0] * rb[1] - ra[1] * rb[0]))
            zones.append(band.intersection(P0.buffer((half + w_ + 2) / sn)))
        for E in (Point(RL.coords[0]), Point(RL.coords[-1])):  # a river end (culvert mouth) inside a road band
            if cl.distance(E) < half + w_ + 1: zones.append(band.intersection(E.buffer(half + w_ + 8)))
    bl = [bgeoms_buf[i] for i in _bt.query(RL.buffer(w_))]
    cutz = unary_union(zones + bl) if zones or bl else GeometryCollection()
    rest = RL.difference(cutz)
    for part in (list(rest.geoms) if hasattr(rest, 'geoms') else [rest]):
        if not isinstance(part, LineString) or part.length < 4: continue
        caps = []
        for E in (Point(part.coords[0]), Point(part.coords[-1])):  # no headwall where a stream flows into another river
            caps.append(not any(o is not RL and o.distance(E) < 4 for o in all_riv) and inside((E.x, E.y), -2))
        riv_out.append((list(part.simplify(0.2).coords), w_, caps))
log('river pieces', len(riv_out), 'from', len(riv_lines))

# ------------------------------------------------------------------ trains: smooth chains, longest first
def tang(a, b): L = math.dist(a, b) or 1; return ((b[0] - a[0]) / L, (b[1] - a[1]) / L)
pieces = [list(p) for p in rails if len(p) >= 2]
ends = defaultdict(list)
for j, pc in enumerate(pieces): ends[key(pc[0])].append((j, 0)); ends[key(pc[-1])].append((j, 1))
def grow(chain, used, at_end):
    while True:
        tip = chain[-1] if at_end else chain[0]; prev = chain[-2] if at_end else chain[1]; t0 = tang(prev, tip); best = None
        for j, which in ends[key(tip)]:
            if j in used: continue
            pc = pieces[j] if which == 0 else pieces[j][::-1]
            d = t0[0] * tang(pc[0], pc[1])[0] + t0[1] * tang(pc[0], pc[1])[1]
            if d > 0.6 and (best is None or d > best[0]): best = (d, j, pc)
        if not best: return chain
        used.add(best[1]); chain = chain + best[2][1:] if at_end else best[2][::-1][:-1] + chain
used_all = set(); trains = []
for _ in range(4):
    best = None
    for st in range(len(pieces)):
        if st in used_all: continue
        used = {st}; chain = grow(grow(list(pieces[st]), used, True), used, False)
        L = LineString(chain).length
        if best is None or L > best[0]: best = (L, chain, used)
    if not best or best[0] < 900: break
    line = LineString(best[1]); used_all |= best[2] | {j for j, pc in enumerate(pieces) if LineString(pc).within(line.buffer(9))}
    if line.intersection(RECT).length < 600: continue
    trains.append({'pts': best[1]})
stations = [(t.get('name', ''), nodes[r]) for r, t in ntags.items() if t.get('railway') in ('station', 'halt')]
for t in trains:
    line = LineString(t['pts'])
    t['st'] = [round(line.project(Point(p)), 1) for nm, p in stations if line.distance(Point(p)) < 70]
    t['stn'] = [nm for nm, p in stations if line.distance(Point(p)) < 70]
log('trains', [(round(LineString(t['pts']).length), t['stn']) for t in trains])

# ------------------------------------------------------------------ POIs, places, crossings, trees
KIND = {'restaurant': 'ristorante', 'cafe': 'bar', 'bar': 'bar', 'pub': 'bar', 'fast_food': 'fast food', 'ice_cream': 'gelateria', 'pharmacy': 'farmacia', 'bank': 'banca',
        'post_office': 'poste', 'place_of_worship': 'chiesa', 'school': 'scuola', 'police': 'polizia', 'fuel': 'benzinaio', 'community_centre': 'oratorio', 'townhall': 'municipio', 'library': 'biblioteca', 'hospital': 'ospedale', 'clinic': 'ospedale'}
pois, seen = [], set()
def add_poi(nm, kind, p):
    kk = (nm, kind, round(p[0] / 120), round(p[1] / 120))
    if not nm or kk in seen or not inside(p, -15): return
    seen.add(kk); pois.append({'n': nm, 'k': kind, 'x': round(p[0], 1), 'z': round(p[1], 1)})
for r, t in ntags.items():
    if t.get('railway') == 'station': add_poi('Stazione di ' + t.get('name', ''), 'stazione', nodes[r])
    elif t.get('amenity') in KIND: add_poi(t.get('name'), KIND[t['amenity']], nodes[r])
    elif t.get('shop') and t.get('name'): add_poi(t['name'], 'negozio', nodes[r])
    elif t.get('healthcare') and t.get('name'): add_poi(t['name'], 'ospedale', nodes[r])
for wid, (refs, t) in ways.items():
    if refs[0] != refs[-1]: continue
    pts = ring(refs)
    if len(pts) < 3: continue
    if t.get('amenity') in KIND: add_poi(t.get('name'), KIND[t['amenity']], centroid(pts))
    elif t.get('healthcare') and t.get('name'): add_poi(t['name'], 'ospedale', centroid(pts))
    elif t.get('leisure') == 'park': add_poi(t.get('name'), 'parco', centroid(pts))
    elif t.get('shop') and t.get('name'): add_poi(t['name'], 'negozio', centroid(pts))
    elif t.get('historic') or t.get('name', '').startswith('Villa '): add_poi(t.get('name'), 'monumento', centroid(pts))
# ---- shops, offices, workshops, surgeries by class: every one gets a shop front picked among its class's models (negozi3.js).
# [x dm, z dm, class, OSM subtype, name]; the name may be empty (the front then shows what it is: PARRUCCHIERE, AUTOFFICINA)
NG = ['mobili', 'bellezza', 'officina', 'auto', 'bar', 'ristorante', 'pizzeria', 'gelateria', 'alimentari', 'supermercato', 'moda', 'farmacia', 'banca', 'ufficio',
      'medico', 'tabacchi', 'bottega', 'artigiano', 'sfitto']
NG_SHOP = {'mobili': 'furniture kitchen interior_decoration bathroom_furnishing curtain bed carpet lighting antiques houseware flooring tiles doors windows',
           'bellezza': 'hairdresser beauty cosmetics massage tattoo perfumery nail_salon hairdresser_supply pet_grooming',
           'officina': 'car_repair tyres motorcycle_repair car_parts', 'auto': 'car motorcycle caravan truck',
           'alimentari': 'bakery pastry butcher greengrocer convenience deli cheese wine beverages seafood confectionery coffee tea chocolate farm frozen_food pasta alcohol general',
           'supermercato': 'supermarket', 'moda': 'clothes shoes jewelry optician bag boutique fabric tailor watches leather gift toys sports baby_goods fashion_accessories second_hand',
           'farmacia': 'chemist medical_supply herbalist', 'tabacchi': 'tobacco newsagent kiosk lottery e-cigarette books stationery',
           'bottega': 'hardware florist pet bicycle dry_cleaning laundry mobile_phone computer electronics locksmith funeral_directors copyshop paint doityourself garden_centre trade yes variety_store photo hifi appliance travel_agency music department_store craft sewing frame games video_games outdoor model art',
           'sfitto': 'vacant'}
NG_SHOP = {s: c for c, v in NG_SHOP.items() for s in v.split()}
NG_AMEN = {'cafe': 'bar', 'bar': 'bar', 'pub': 'bar', 'biergarten': 'bar', 'restaurant': 'ristorante', 'fast_food': 'pizzeria', 'ice_cream': 'gelateria', 'pharmacy': 'farmacia',
           'bank': 'banca', 'doctors': 'medico', 'dentist': 'medico', 'clinic': 'medico', 'veterinary': 'medico', 'driving_school': 'ufficio', 'car_wash': 'officina', 'bureau_de_change': 'banca', 'money_transfer': 'banca'}
def ng_class(t):
    am, sh = t.get('amenity'), t.get('shop')
    if am in NG_AMEN:
        c = NG_AMEN[am]; cu = t.get('cuisine', '')
        if c == 'ristorante' and 'pizza' in cu.split(';')[:1]: c = 'pizzeria'  # a pizzeria first and foremost
        return c, (cu.split(';')[0] if cu and am in ('restaurant', 'fast_food') else am)
    if sh: return NG_SHOP.get(sh, 'bottega'), sh
    if t.get('healthcare') in ('doctor', 'dentist', 'physiotherapist', 'psychotherapist', 'clinic', 'centre', 'laboratory', 'optometrist', 'podiatrist', 'audiologist', 'rehabilitation'): return 'medico', t['healthcare']
    if t.get('office'): return 'ufficio', t['office']
    if t.get('craft'): return 'artigiano', t['craft']
    return None, None
negozi, ng_seen = [], []
def add_ng(t, p):
    c, s = ng_class(t)
    if not c or not inside(p, -5): return
    nm = (t.get('name') or '').strip()
    if not nm and c in ('ufficio', 'artigiano') and s in ('company', 'yes', 'association', 'ngo', 'political_party'): return  # an unnamed company: nothing to put on the door
    if any(c == c2 and nm == n2 and math.dist(p, p2) < 15 for c2, n2, p2 in ng_seen): return  # the same shop mapped twice (node and area)
    ng_seen.append((c, nm, p)); negozi.append([q(p[0]), q(p[1]), NG.index(c), s[:24], nm[:40], (t.get('opening_hours') or '').strip()[:160]])
for r_, t in ntags.items(): add_ng(t, nodes[r_])
for wid, (refs, t) in ways.items():
    if refs[0] == refs[-1] and len(refs) >= 4: add_ng(t, centroid(ring(refs)))
log('negozi', len(negozi), dict(Counter(NG[n[2]] for n in negozi)))
places = [{'n': t['name'], 'k': t['place'], 'x': round(nodes[r][0], 1), 'z': round(nodes[r][1], 1)} for r, t in ntags.items()
          if t.get('place') in ('town', 'village', 'suburb', 'neighbourhood', 'hamlet', 'quarter') and t.get('name') and inside(nodes[r], 600)]
car_nodes = defaultdict(list)
for r in raw_roads:
    if r['c'] <= 4 and flat(r):
        for i, n_ in enumerate(r['refs']): car_nodes[n_].append((r, i))
crossings = []
for r_, t in ntags.items():
    if (t.get('highway') == 'crossing' or t.get('crossing') in ('zebra', 'marked', 'uncontrolled', 'traffic_signals')) and r_ in car_nodes and inside(nodes[r_], 0):
        r, i = car_nodes[r_][0]; a = nodes[r['refs'][max(0, i - 1)]]; c = nodes[r['refs'][min(len(r['refs']) - 1, i + 1)]]
        d = math.dist(a, c)
        if d > 0.1: crossings.append([round(nodes[r_][0], 1), round(nodes[r_][1], 1), round((c[0] - a[0]) / d, 3), round((c[1] - a[1]) / d, 3), r['mh'] * 2])
signals = [[round(nodes[r_][0], 1), round(nodes[r_][1], 1)] for r_, t in ntags.items() if t.get('highway') == 'traffic_signals' and inside(nodes[r_], 0)]
lamps = [[round(nodes[r_][0], 1), round(nodes[r_][1], 1)] for r_, t in ntags.items() if t.get('highway') == 'street_lamp' and inside(nodes[r_], 0)]
trees = [nodes[r_] for r_, t in ntags.items() if t.get('natural') == 'tree' and inside(nodes[r_], 0)]
for row in rows:
    for a, b in zip(row, row[1:]):
        L = math.dist(a, b)
        for k in range(int(L // 7) + 1):
            f = k * 7 / L if L else 0; p = (a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f)
            if inside(p, 0): trees.append(p)
# forests: scatter trees inside wood polygons (deterministic), avoiding roads & buildings
rng = np.random.default_rng(20821)
_railbuf = unary_union([l.buffer(4) for l in railL]) if railL else GeometryCollection(); prepare(_railbuf)
roadsU = rbuf(lambda r: True, 1.0)
prepare(roadsU)
for at, g in area_geoms:
    if at not in (11, 12, 2): continue
    dens = {11: 1 / 70, 12: 1 / 220, 2: 1 / 260}[at]
    n = int(min(4000, g.area * dens)); minx, minz, maxx, maxz = g.bounds
    if n <= 0: continue
    xs_ = rng.uniform(minx, maxx, n * 3); zs_ = rng.uniform(minz, maxz, n * 3)
    import shapely
    ptsg = shapely.points(xs_, zs_)
    ok = shapely.contains(g, ptsg) & ~shapely.intersects(roadsU, ptsg) & ~shapely.intersects(bunion, ptsg) & ~shapely.intersects(_railbuf, ptsg) & (np.abs(xs_) <= HW) & (np.abs(zs_) <= HH)
    for x, z in list(zip(xs_[ok], zs_[ok]))[:n]: trees.append((x, z))
log('pois', len(pois), 'places', len(places), 'trees', len(trees), 'crossings', len(crossings))
# ---- street objects from OSM: [kind, x, z, angle, extra]. The angle follows the nearest street (a bench faces it, a bump lies across it);
# extra is a height (pylons, poles, masts) or the street width (bumps). Kinds by index, same order as OGG_KINDS in oggetti3.js
OGG = ['traliccio', 'palo', 'dosso', 'rallentatore', 'piattaforma', 'paletto', 'blocco', 'idrante', 'campana', 'ricarica', 'antenna',
       'panchina', 'cestino', 'fontanella', 'giochi', 'telecamera', 'distributore', 'rastrelliera', 'cassetta',
       'armadietti', 'pannello', 'picnic', 'fitness', 'torre_acqua', 'lavaggio']
def ogg_kind(t):
    tc = t.get('traffic_calming')
    if tc: return {'table': 'piattaforma', 'hump': 'rallentatore', 'cushion': 'rallentatore', 'bump': 'dosso', 'yes': 'dosso', 'rumble_strip': None, 'chicane': None, 'choker': None, 'island': None}.get(tc, 'dosso')
    pw, mm, am = t.get('power'), t.get('man_made'), t.get('amenity')
    if pw == 'tower': return 'traliccio'
    if pw == 'pole': return 'palo'
    if mm in ('mast', 'antenna') or (mm == 'tower' and t.get('tower:type') == 'communication'): return 'antenna'
    if mm == 'surveillance': return 'telecamera'
    b = t.get('barrier')
    if b == 'bollard': return 'paletto'
    if b == 'block': return 'blocco'
    if t.get('emergency') == 'fire_hydrant': return 'idrante'
    if t.get('leisure') == 'playground': return 'giochi'
    if t.get('leisure') == 'picnic_table': return 'picnic'
    if t.get('leisure') == 'fitness_station': return 'fitness'
    if mm == 'water_tower': return 'torre_acqua'
    if t.get('tourism') == 'information' and t.get('information') in (None, 'board', 'map', 'terminal'): return 'pannello'
    return {'recycling': 'campana' if t.get('recycling_type') != 'centre' else None, 'charging_station': 'ricarica', 'bench': 'panchina', 'waste_basket': 'cestino',
            'drinking_water': 'fontanella', 'vending_machine': 'distributore', 'bicycle_parking': 'rastrelliera', 'post_box': 'cassetta', 'parcel_locker': 'armadietti', 'car_wash': 'lavaggio'}.get(am)
def num(v, d):
    try: return float(str(v).replace('m', '').replace(',', '.').split(';')[0])
    except (ValueError, TypeError): return d
_segs = []
for r in raw_roads:
    if r['tunnel']: continue
    for a_, b_ in zip(r['refs'], r['refs'][1:]): _segs.append((LineString([nodes[a_], nodes[b_]]), r))
_segtree = STRtree([s[0] for s in _segs])
def near_street(p, car=False, R=15, face=False):
    best = None
    for i in _segtree.query(Point(p).buffer(R)):
        L, r = _segs[i]
        if car and r['c'] > 5: continue
        d = L.distance(Point(p))
        if d < R and (best is None or d < best[0]): best = (d, L, r)
    if best is None: return 0.0, None
    if face:  # turned towards the street: from the object to its nearest point
        np_ = best[1].interpolate(best[1].project(Point(p)))
        if best[0] > 0.05: return math.atan2(np_.x - p[0], np_.y - p[1]), best[2]
    (ax, az), (bx, bz) = best[1].coords
    return math.atan2(bx - ax, bz - az), best[2]
pw_dir = {}  # pylon or pole -> direction of its line: the cross arms stand square to the wires
for wid, (refs, t) in ways.items():
    if t.get('power') not in ('line', 'minor_line'): continue
    for i, n_ in enumerate(refs):
        a_, b_ = refs[max(0, i - 1)], refs[min(len(refs) - 1, i + 1)]
        if a_ in nodes and b_ in nodes and a_ != b_: pw_dir[n_] = math.atan2(nodes[b_][0] - nodes[a_][0], nodes[b_][1] - nodes[a_][1])
ogg = []
def add_ogg(k, p, t, along=None):
    if not inside(p, 0): return
    car = k in ('dosso', 'rallentatore', 'piattaforma')
    ang, r = (along, None) if along is not None else near_street(p, car, face=k in ('panchina', 'distributore', 'cassetta', 'ricarica', 'telecamera', 'fontanella', 'campana', 'armadietti', 'pannello', 'lavaggio'))
    if car and r is None and along is None: return  # a bump off the streets
    extra = 0
    if k == 'traliccio': extra = num(t.get('height'), 30)
    elif k == 'palo': extra = num(t.get('height'), 9)
    elif k == 'antenna': extra = num(t.get('height'), 25)
    elif k == 'torre_acqua': extra = num(t.get('height'), 28)
    elif car: extra = (r['mh'] * 2) if r else 6
    ogg.append([OGG.index(k), q(p[0]), q(p[1]), round(ang, 2), round(extra, 1)])
for r_, t in ntags.items():
    k = ogg_kind(t)
    if k: add_ogg(k, nodes[r_], t, pw_dir.get(r_) if k in ('traliccio', 'palo') else None)
for wid, (refs, t) in ways.items():
    k = ogg_kind(t)
    # water towers and car washes mapped as areas are drawn as land (paesaggio3.js)
    if not k or k in ('traliccio', 'palo', 'torre_acqua', 'lavaggio') or t.get('highway') and k not in ('dosso', 'rallentatore', 'piattaforma'): continue
    pts = [nodes[n_] for n_ in refs if n_ in nodes]
    if len(pts) < 2: continue
    if refs[0] == refs[-1] and len(pts) >= 4: c = Polygon(pts).centroid; add_ogg(k, (c.x, c.y), t)  # an area: its middle
    else:  # a line (a table mapped along the street): its middle, lying along it
        L = LineString(pts); m = L.interpolate(0.5, normalized=True); a = L.interpolate(max(0, L.length / 2 - 1)); b = L.interpolate(min(L.length, L.length / 2 + 1))
        add_ogg(k, (m.x, m.y), t, math.atan2(b.x - a.x, b.y - a.y) if k in ('dosso', 'rallentatore', 'piattaforma') else None)
power_lines = []  # wires from pylon to pylon: [points], height of the top
for wid, (refs, t) in ways.items():
    if t.get('power') not in ('line', 'minor_line'): continue
    pts = [nodes[n_] for n_ in refs if n_ in nodes]
    if len(pts) >= 2: power_lines.append((pts, 28 if t['power'] == 'line' else 8.5))
log('oggetti', len(ogg), dict(Counter(OGG[o[0]] for o in ogg)), 'linee elettriche', len(power_lines))

# ---- real parking: the spaces mapped one by one (a rectangle each, split when it says capacity > 1) and the capacity of the car parks
pspaces, plots = [], []  # [x, z, angle of the long side, length, width, kind 0 normal / 1 disabled / 2 charging]; [x, z, capacity]
def add_space(pts, t):
    g = Polygon(pts).buffer(0)
    if g.is_empty or g.area < 4 or g.area > 400: return
    c = g.centroid
    if not inside((c.x, c.y), 0): return
    r = list(g.minimum_rotated_rectangle.exterior.coords)[:4]; e1, e2 = math.dist(r[0], r[1]), math.dist(r[1], r[2])
    a_, b_ = (r[0], r[1]) if e1 >= e2 else (r[1], r[2]); L, W = max(e1, e2), min(e1, e2); ang = math.atan2(b_[0] - a_[0], b_[1] - a_[1])
    kind = 1 if t.get('parking_space') == 'disabled' or num(t.get('capacity:disabled'), None) else 2 if t.get('parking_space') == 'charging' else 0
    cap = int(num(t.get('capacity'), None) or 1)
    if cap <= 1 or cap > 40: pspaces.append([q(c.x), q(c.y), round(ang, 3), round(L, 1), round(W, 1), kind]); return
    # a row of spaces mapped as one: split it along its long side (side by side if each is wider than deep)
    ux, uz = math.sin(ang), math.cos(ang); step = L / cap
    for i in range(cap):
        o_ = -L / 2 + step * (i + 0.5); pspaces.append([q(c.x + ux * o_), q(c.y + uz * o_), round(ang + math.pi / 2, 3), round(W, 1), round(step, 1), kind])
for wid, (refs, t) in ways.items():
    if refs[0] != refs[-1] or len(refs) < 4: continue
    if t.get('amenity') == 'parking_space': add_space(ring(refs), t)
    elif t.get('amenity') == 'parking' and num(t.get('capacity'), None):
        c_ = centroid(ring(refs))
        if inside(c_, 0): plots.append([q(c_[0]), q(c_[1]), int(num(t['capacity'], 0))])
# ---- comune boundaries: where a road crosses from one comune into the next, the town signs. [x, z, ux, uz, road width, comune ahead, comune behind]
# the boundaries come from data/confini_comuni.json (Overpass, admin_level 8 with geometry): the map extract has none
bway, bgeo = defaultdict(set), {}
CONF = os.path.join(DATA, 'confini_comuni.json')
if os.path.exists(CONF):
    for e_ in json.load(open(CONF, encoding='utf-8'))['elements']:
        nm_ = e_.get('tags', {}).get('name')
        if not nm_: continue
        for m in e_.get('members', []):
            if m.get('type') == 'way' and m.get('geometry'): bway[m['ref']].add(nm_); bgeo[m['ref']] = [proj(p['lat'], p['lon']) for p in m['geometry']]
pl_by = {t['name']: nodes[r_] for r_, t in ntags.items() if t.get('place') in ('city', 'town', 'village') and t.get('name')}
blines = [(LineString(bgeo[w_]), sorted(n_)) for w_, n_ in bway.items() if len(n_) == 2 and len(bgeo[w_]) >= 2]
cartelli = []
if blines:
    _bt = STRtree([b_[0] for b_ in blines])
    for r in raw_roads:
        if r['c'] > 3 or r['tunnel'] or r.get('bridge'): continue
        L_ = r['line']
        for i_ in _bt.query(L_):
            bl, (na, nb) = blines[i_]
            if na not in pl_by or nb not in pl_by: continue
            x_ = L_.intersection(bl)
            for p_ in (list(x_.geoms) if hasattr(x_, 'geoms') else [x_]):
                if p_.geom_type != 'Point' or not inside((p_.x, p_.y), 0) or any(math.dist((c_[0] / 10, c_[1] / 10), (p_.x, p_.y)) < 25 for c_ in cartelli): continue
                d_ = L_.project(p_); a_ = L_.interpolate(max(0, d_ - 2)); b_ = L_.interpolate(min(L_.length, d_ + 2)); ux, uz = b_.x - a_.x, b_.y - a_.y; l_ = math.hypot(ux, uz) or 1; ux /= l_; uz /= l_
                ahead, behind = (p_.x + ux * 40, p_.y + uz * 40), (p_.x - ux * 40, p_.y - uz * 40)
                fwd, back = (na, nb) if math.dist(ahead, pl_by[na]) + math.dist(behind, pl_by[nb]) <= math.dist(ahead, pl_by[nb]) + math.dist(behind, pl_by[na]) else (nb, na)
                cartelli.append([q(p_.x), q(p_.y), round(ux, 3), round(uz, 3), r['w'], fwd, back])
log('cartelli di paese', len(cartelli), 'confini', len(blines))
log('posti auto', len(pspaces), 'disabili', sum(1 for p in pspaces if p[5] == 1), 'parcheggi con capienza', len(plots), 'strade con sosta', sum(1 for r in raw_roads if r.get('pk')))
# ------------------------------------------------------------------ graph & tiles
used_nodes = {}
out_roads = []
for r in raw_roads:
    rec = {'g': [gnode(n_) for n_ in r['refs']], 'w': r['w'], 'c': r['c'], 'n': r['n'], 'mh': r['mh'], 'wk': r['wk'], 'sp': round(r['ms'] / 3.6 * 0.95, 1) if r['ms'] else SPEED.get(r['hw'], 0)}
    if r['o']: rec['o'] = 1
    if r['bridge']: rec['b'] = 1
    if r.get('deck'): rec['d'] = 1
    if r['tunnel']: rec['t'] = 1
    if r['x']: rec['x'] = 1
    if r.get('under'): rec['u'] = 1
    if r.get('pk'): rec['pk'] = r['pk']
    out_roads.append(rec)
q = lambda v: int(round(v * 10))
NODES = [[q(nodes[ref][0]), q(nodes[ref][1]), q(deckH[ref]) if ref in deckH else -32768] for ref in node_list]
def enc(pts):  # delta-encoded decimetres
    o, px, pz = [], 0, 0
    for x, z in pts:
        X, Z = q(x), q(z); o += [X - px, Z - pz]; px, pz = X, Z
    return o
ntx, ntz = int(math.ceil(2 * HW / TILE)), int(math.ceil(2 * HH / TILE))
tiles = [{} for _ in range(ntx * ntz)]
def tid(x, z): return min(ntx - 1, max(0, int((x + HW) // TILE))) + ntx * min(ntz - 1, max(0, int((z + HH) // TILE)))
def tbox(t): i, j = t % ntx, t // ntx; return box(-HW + i * TILE, -HH + j * TILE, -HW + (i + 1) * TILE, -HH + (j + 1) * TILE)
def push(t, k, v): tiles[t].setdefault(k, []).append(v)
for b in buildings:
    c = centroid(b['p']); rec = {'p': enc(b['p']), 'h': b['h'], 't': b['t']}
    if b.get('k'): rec['k'] = [enc(h) for h in b['k']]
    if b.get('bt') in ('garage', 'garages'): rec['g'] = 1  # rows of up-and-over doors
    elif b.get('bt') == 'greenhouse': rec['g'] = 2  # glass
    elif b.get('bt') == 'grandstand': rec['g'] = 3  # stepped seats under a roof
    elif b.get('wt'): rec['g'] = 4  # a water tower mapped as a building
    push(tid(*c), 'b', rec)
for k_, pts in land:  # one polygon per piece of land, simplified, in the tile of its middle
    try: g_ = Polygon(pts).buffer(0).simplify(0.3, preserve_topology=True)
    except Exception: continue
    if g_.is_empty or g_.geom_type != 'Polygon' or g_.area < 8 or not inside((g_.centroid.x, g_.centroid.y), 0): continue
    push(tid(g_.centroid.x, g_.centroid.y), 'ls', {'p': enc(list(g_.exterior.coords)[:-1]), 's': k_})
def polys_of(g, tol=0.15, min_area=0.5):
    g = g.simplify(tol, preserve_topology=True)
    out = []
    for p in (list(g.geoms) if hasattr(g, 'geoms') else [g]):
        if isinstance(p, Polygon) and p.area >= min_area:
            out.append({'p': enc(list(p.exterior.coords)[:-1]), 'k': [enc(list(i.coords)[:-1]) for i in p.interiors if Polygon(i).area > 0.3]})
    return out
SURF = {'as': asph, 'pz': pedz, 'sd': side, 'ft': foot}
parts_of = lambda g: [p for p in (list(g.geoms) if hasattr(g, 'geoms') else [g]) if not p.is_empty]
SURFP = {k: parts_of(g) for k, g in SURF.items() if not g.is_empty}
SURFT = {k: STRtree(v) for k, v in SURFP.items()}
AG = [g for at, g in area_geoms]; AT = STRtree(AG)
for t in range(ntx * ntz):
    bx = tbox(t)
    for k, tree in SURFT.items():
        idx = tree.query(bx)
        if not len(idx): continue
        c = unary_union([SURFP[k][i].intersection(bx) for i in idx])
        if not c.is_empty:
            ps = polys_of(c)
            if ps: tiles[t][k] = ps
    for i in AT.query(bx):
        c = AG[i].intersection(bx)
        for p in polys_of(c, 0.3, 2):
            p['t'] = area_geoms[i][0]; push(t, 'a', p)
def push_lines(key_, lines, extra=None):
    for i, pts in enumerate(lines):
        L = LineString(pts)
        if L.length < 0.5: continue
        for t in set(tid(*p) for p in L.buffer(1).exterior.coords) | {tid(*pts[0])}:
            c = L.intersection(tbox(t))
            for part in (list(c.geoms) if hasattr(c, 'geoms') else [c]):
                if isinstance(part, LineString) and part.length > 0.3:
                    rec = {'p': enc(list(part.coords))}
                    if extra: rec.update(extra(i))
                    push(t, key_, rec)
for rr in rail_raw:  # rail pieces per tile with heights where elevated
    pts = [nodes[n_] for n_ in rr['refs']]; hs = rr['h']; groups = []
    for i in range(1, len(pts)):
        t_ = tid((pts[i - 1][0] + pts[i][0]) / 2, (pts[i - 1][1] + pts[i][1]) / 2)
        if groups and groups[-1][0] == t_: groups[-1][2] = i
        else: groups.append([t_, i - 1, i])
    for t_, i0, i1 in groups:
        seg = list(range(i0, i1 + 1)); rec = {'p': enc([pts[k] for k in seg])}
        if any(hs[k] is not None for k in seg): rec['h'] = [q(hs[k]) if hs[k] is not None else -32768 for k in seg]
        push(t_, 'rl', rec)
for pts, kind, hgt in bar_out:
    c = LineString(pts).centroid; push(tid(c.x, c.y), 'ba', {'p': enc(pts), 't': kind, 'h': hgt})
for t in range(ntx * ntz):
    if median.is_empty: break
    bx = tbox(t)
    if not median.intersects(bx): continue
    for p_ in polys_of(median.intersection(bx), 0.2, 3): push(t, 'md', p_)
push_lines('fe', fences)
for pts, w_, caps in riv_out:
    L = LineString(pts); s0, s1 = pts[0], pts[-1]
    for t in set(tid(*p) for p in L.buffer(1).exterior.coords) | {tid(*pts[0])}:
        c = L.intersection(tbox(t))
        for part in (list(c.geoms) if hasattr(c, 'geoms') else [c]):
            if isinstance(part, LineString) and part.length > 0.3:
                cc = list(part.coords)
                e = [int(caps[0] and math.dist(cc[0], s0) < 0.05 or caps[1] and math.dist(cc[0], s1) < 0.05), int(caps[1] and math.dist(cc[-1], s1) < 0.05 or caps[0] and math.dist(cc[-1], s0) < 0.05)]
                push(t, 'rv', {'p': enc(cc), 'w': w_, 'e': e})
for x, z in trees: push(tid(x, z), 'tr', [q(x), q(z)])
for ri, r in enumerate(raw_roads):  # road pieces per tile (for markings and decks)
    pts = [nodes[n_] for n_ in r['refs']]
    hs = [deckH.get(n_) for n_ in r['refs']] if r.get('deck') else None
    for t in set(tid(*p) for p in pts) | set(tid((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) for a, b in zip(pts, pts[1:])):
        push(t, 'rp', ri)
for x, z, dx, dz, w in crossings: push(tid(x, z), 'cr', [q(x), q(z), round(dx, 3), round(dz, 3), round(w, 1)])
for x, z in lamps: push(tid(x, z), 'lp', [q(x), q(z)])
for o in ogg: push(tid(o[1] / 10, o[2] / 10), 'og', o)
for s_ in pspaces: push(tid(s_[0] / 10, s_[1] / 10), 'ps', s_)
for p_ in plots: push(tid(p_[0] / 10, p_[1] / 10), 'pc', p_)
for c_ in cartelli: push(tid(c_[0] / 10, c_[1] / 10), 'cl', c_)
push_lines('pw', [p for p, h in power_lines], lambda i: {'h': power_lines[i][1]})
# terrain as base64 uint16 decimetres
TH16 = np.clip(np.round((TH - TBASE) * 10), 0, 65535).astype('<u2')
out = {'meta': {'lat0': lat0, 'lon0': lon0, 'hw': round(HW, 1), 'hh': round(HH, 1), 'tile': TILE, 'ntx': ntx, 'ntz': ntz},
       'terrain': {'x0': float(txs[0]), 'z0': float(tzs[0]), 'step': TSTEP, 'nx': len(txs), 'nz': len(tzs), 'base': round(TBASE, 1), 'h16': base64.b64encode(TH16.tobytes()).decode()},
       'nodes': [c for n_ in NODES for c in n_], 'roads': out_roads, 'names': names, 'tiles': tiles,
       'trains': [{'p': enc(t['pts']), 'st': t['st'], 'stn': t['stn'], 'h': [q(coordH[key(p_)]) if key(p_) in coordH else -32768 for p_ in t['pts']]} for t in trains],
       'pois': pois, 'ng': negozi, 'gates': gate_out, 'fountains': fountains, 'places': places, 'signals': [node_index[r_] for r_, t in ntags.items() if t.get('highway') == 'traffic_signals' and r_ in node_index],
       'bus': [[q(nodes[r_][0]), q(nodes[r_][1]), (t.get('name') or '')[:40], node_index.get(r_, -1)] for r_, t in ntags.items() if (t.get('highway') == 'bus_stop' or t.get('public_transport') == 'platform' and t.get('bus') == 'yes') and inside(nodes[r_], 0)]}
s = json.dumps(out, separators=(',', ':'), ensure_ascii=False)
open(dst, 'w', encoding='utf-8').write(s)  # the game decodes UTF-8; Windows would default to cp1252
log('written', dst, len(s) // 1024, 'KB', 'tiles', ntx, 'x', ntz, 'roads', len(out_roads), 'nodes', len(NODES))
