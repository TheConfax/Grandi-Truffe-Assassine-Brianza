# I fondi: di che cosa e' fatto ogni pezzo di suolo (docs/superfici.md). build_data.py prima di scrivere i tile da' a certe superfici un
# materiale 'm' (chiave dei poligoni nei tile); world3.js lo disegna con la sua texture (FONDO_LOOK). Senza 'm' resta l'aspetto di sempre.
# Le fonti, in quest'ordine (regole generali, nessuna coordinata):
#   1. OSM surface=* della via o dell'area che sta sopra il pezzo (una via vale per la larghezza della sua sede)
#   2. il DBGT: AC_VEI_FON 02 "non pavimentato" (carreggiate e cortili) e AR_VMS (carrarecce) -> sterrato; AC_PED e AC_CIC (FON 01) -> pavimentato
#   3. la foto aerea Esri (luglio 2025, solo riferimento interno della build, come dbgt_edifici.py): per i pezzi di cui i dati non dicono il
#      materiale (cortili AATT del DBGT, vialetti che vengono solo da OSM) la mediana dei pixel dentro il pezzo dice verde, terra o pavimentato
# Dove nessuna di queste dice niente il pezzo resta neutro (nessun 'm').
import os, numpy as np
from shapely.geometry import Polygon, LineString
from shapely.ops import unary_union
from shapely.strtree import STRtree

# materiali del gioco: a asfalto, n pavimentato (materiale ignoto o cemento), b masselli/autobloccanti, f porfido (cubetti), c ciottoli,
# g ghiaia/sterrato, t terra, p prato
OSM_M = {'asphalt': 'a', 'chipseal': 'a', 'paved': 'n', 'concrete': 'n', 'concrete:plates': 'n', 'concrete:lanes': 'n', 'paving_stones': 'b',
         'paving_stones:30': 'b', 'bricks': 'b', 'sett': 'f', 'cobblestone': 'c', 'unhewn_cobblestone': 'c', 'pebblestone': 'g', 'gravel': 'g',
         'fine_gravel': 'g', 'compacted': 'g', 'unpaved': 'g', 'rock': 'g', 'ground': 't', 'dirt': 't', 'earth': 't', 'mud': 't', 'sand': 't',
         'grass': 'p', 'grass_paver': 'p'}
LARGO = {'footway': 2.0, 'path': 1.5, 'cycleway': 2.5, 'steps': 2.0, 'bridleway': 2.0, 'track': 3.0, 'pedestrian': 4.0, 'service': 4.0,
         'living_street': 5.0, 'residential': 6.0, 'unclassified': 6.0, 'tertiary': 7.0, 'secondary': 8.0, 'primary': 8.0}
COPRE = 0.5        # un'area OSM (o la sede di una via) da' il suo materiale a un pezzo che copre almeno per tanto
OMBRA = 45         # pixel piu' scuri di cosi' (luce media 0-255) sono ombra: non contano
MIN_PIX = 40       # pixel buoni minimi per decidere dalla foto


PIEDI = ('footway', 'path', 'cycleway', 'steps', 'bridleway', 'pedestrian', 'track', 'corridor')


def zone_osm(ways, nodes):
    """[(geometria, materiale, genere)] dalle vie e dalle aree OSM con surface=* (le vie larghe come la loro sede, o width=); genere: 'area',
    'piedi' (vie pedonali, ciclabili, sentieri, carrarecce), 'auto' (le altre vie)"""
    out = []
    for wid, (refs, t) in ways.items():
        m = OSM_M.get(t.get('surface'))
        if not m or 'building' in t: continue
        pts = [nodes[r] for r in refs if r in nodes]
        if len(pts) < 2: continue
        area = refs[0] == refs[-1] and len(pts) >= 4 and (t.get('area') == 'yes' or not t.get('highway'))
        try:
            if area: g = Polygon(pts).buffer(0)
            else:
                w = t.get('width'); w = float(str(w).replace(',', '.').split()[0].rstrip('m')) if w else LARGO.get(t.get('highway'), 3.0)
                g = LineString(pts).buffer(max(1.0, w / 2), cap_style=2)
        except Exception: continue
        if not g.is_empty: out.append((g, m, 'area' if area else 'piedi' if t.get('highway') in PIEDI else 'auto'))
    return out


class Fondi:
    def __init__(s, ways, nodes, to_ll, log=print):
        s.log = log; s.Z = zone_osm(ways, nodes); s.T = STRtree([z[0] for z in s.Z]) if s.Z else None
        s.foto = None
        if not os.environ.get('GTA_SENZA_ESRI'):
            import esri_foto as ef
            s.foto = ef.Foto(to_ll, scarica=False)   # solo le tile gia' in data/esri (le scarica dbgt_edifici.py): senza foto si resta neutri
        s.rep = {}

    def da_osm(s, g, generi=('area',)):
        """il materiale delle zone OSM (di quei generi) che coprono g per almeno COPRE (quello che copre di piu'), o None"""
        if s.T is None or g.is_empty: return None
        c = {}
        for i in s.T.query(g, predicate='intersects'):
            z, m, k = s.Z[i]
            if k in generi: c[m] = c.get(m, 0) + z.intersection(g).area
        if not c: return None
        m, a = max(c.items(), key=lambda kv: kv[1]); return m if a >= COPRE * g.area else None

    def da_foto(s, g):
        """'verde', 'terra', 'pav' o None dalla mediana dei pixel della foto aerea dentro g (ristretto di 0.5 m: i bordi sono dei vicini)"""
        if s.foto is None: return None
        q = g.buffer(-0.5)
        if q.is_empty: q = g
        try: r = s.foto.pixel(q)
        except Exception: return None
        if r is None: return None
        P = r[0].astype(np.float32)
        if len(P): P = P[P.mean(1) >= OMBRA]
        if len(P) < MIN_PIX: return None
        v = float(np.median(P.mean(1))); gr = float(np.median(P[:, 1] - P[:, 0])); rb = float(np.median(P[:, 0] - P[:, 2]))
        # (tarato sulle superfici note di Meda+Seveso, docs/superfici.md, mediane per poligono: prati e boschi luce 58-74 e verde sul rosso
        # +10..+30; campi arati luce 67 e rosso sul blu +21; cortili d'asfalto, piazze e cortili AATT luce 109-121, rosso sul blu +15..+22:
        # la foto di luglio e' calda, il pavimentato si separa dalla terra per la luce, non per il colore)
        if gr >= 9 and v < 100: return 'verde'
        if rb >= 15 and gr < 9 and v < 95: return 'terra'
        if v >= 80: return 'pav'
        return None

    def cortile(s, g):
        """un cortile AATT del DBGT (il DBGT non dice di che cosa e' fatto): OSM, poi la foto. None = neutro"""
        m = s.da_osm(g)
        if m: return m, 'osm'
        f = s.da_foto(g)
        return {'verde': 'p', 'terra': 't', 'pav': 'n'}.get(f), ('foto' if f else None)

    def dividi(s, geom, regole, generi, foto=None, base=None):
        """geom (l'unione di una superficie) in pezzi per materiale: prima le zone OSM dei generi dati, poi regole [(geometria, materiale)] in
        ordine (la prima vince), poi foto(pezzo) per quel che resta, pezzo per pezzo. base: il materiale che la superficie ha gia' (va con
        None). -> {materiale o None: geometria}"""
        out = {}; resto = geom
        def add(m, g):
            m = None if m == base else m
            out[m] = unary_union([out[m], g]) if m in out else g
        # OSM prima: la via con surface=* sopra un pezzo del DBGT e' piu' precisa del tipo del DBGT
        if s.T is not None and not resto.is_empty:
            for m in sorted(set(z[1] for z in s.Z)):
                zs = [s.Z[i][0] for i in s.T.query(resto, predicate='intersects') if s.Z[i][1] == m and s.Z[i][2] in generi]
                if not zs: continue
                c = resto.intersection(unary_union(zs))
                if c.is_empty or c.area < 0.5: continue
                add(m, c); resto = resto.difference(c)
        for g, m in regole:
            if resto.is_empty: break
            c = resto.intersection(g)
            if c.is_empty or c.area < 0.5: continue
            add(m, c); resto = resto.difference(c)
        if foto is not None and not resto.is_empty:
            altri = []
            for p in (list(resto.geoms) if hasattr(resto, 'geoms') else [resto]):
                if p.is_empty: continue
                m = foto(p) if p.area >= 4 else None
                if m: add(m, p)
                else: altri.append(p)
            resto = unary_union(altri) if altri else Polygon()
        if not resto.is_empty: add(None, resto)
        return out
