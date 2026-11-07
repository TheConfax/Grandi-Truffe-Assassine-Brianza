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

    def strade(s, ways, nodes, celle=(), raggio=20.0, passo=2.0):
        """la superficie di una strada vale per la carreggiata fino a dove comincia un'altra strada (Carlo 6/11: la sede sull'asse lasciava
        una striscia di ciottoli in mezzo all'asfalto, piazza Vittorio Veneto; le celle AC_VEI del DBGT sono lunghe e prendono piu' strade).
        Ogni punto della carreggiata entro raggio da una via con surface=* va alla via per auto piu' vicina (Voronoi dei punti degli assi ogni
        passo m): il confine e' a meta' fra due assi, dove cambia la strada. Zone di genere 'strada' (per le carreggiate)"""
        import shapely
        from shapely.geometry import MultiPoint
        assi = []
        for wid, (refs, t) in ways.items():
            h = t.get('highway')
            if not h or h in PIEDI or t.get('area') == 'yes' or h in ('proposed', 'construction', 'platform', 'bus_stop'): continue
            pts = [nodes[r] for r in refs if r in nodes]
            if len(pts) >= 2: assi.append((LineString(pts), OSM_M.get(t.get('surface')) or 'a'))
        sur = [(L, m) for L, m in assi if m != 'a']
        if not sur: return
        zona = unary_union([L.buffer(raggio) for L, m in sur]); vicino = zona.buffer(raggio); shapely.prepare(vicino)
        P, M = [], []
        for L, m in assi:
            if not vicino.intersects(L): continue
            Lv = L.intersection(vicino)
            for part in (list(Lv.geoms) if hasattr(Lv, 'geoms') else [Lv]):
                if part.geom_type != 'LineString' or part.length <= 0: continue
                n = max(1, int(part.length // passo))
                for k in range(n + 1): q = part.interpolate(k / n, normalized=True); P.append((q.x, q.y)); M.append(m)
        import numpy as np
        P = np.round(np.array(P), 2); P, ui = np.unique(P, axis=0, return_index=True); M = [M[i] for i in ui]
        V = shapely.voronoi_polygons(MultiPoint(P), extend_to=vicino, ordered=True)
        per = {}
        for g, m in zip(V.geoms, M):
            if m != 'a': per.setdefault(m, []).append(g)
        ZM = {m: unary_union(gs).intersection(zona) for m, gs in per.items()}
        # il confine segue il bordo vero dove il DBGT lo ha (Carlo 7/11: in via Garibaldi i ciottoli di via Antona Traversi entravano nell'incrocio
        # con un taglio obliquo a meta' fra i due assi). Celle: [(poligono AC_VEI, zona)]. Un incrocio, una rotonda, una piazza veicolare (02xx)
        # prende intero il materiale della via che ci corre per piu' metri; in un'altra cella un materiale entra solo se una sua via ci corre, e se
        # la copre per il 60% la prende intera; le altre (celle lunghe che prendono piu' strade) restano divise a meta' fra gli assi
        nc = dict(incroci=0, intere=0, divise=0)
        if celle:
            TC = STRtree([g for g, z in celle]); intere = {}; fuori = []
            AT = STRtree([L for L, m in assi])
            for i in sorted(set(TC.query(zona, predicate='intersects').tolist())):
                g, zon = celle[i]; A = g.area
                if A <= 0: continue
                lun = {}
                for j in AT.query(g, predicate='intersects'):
                    L, m = assi[j]; l = g.intersection(L).length
                    if l > 0: lun[m] = lun.get(m, 0) + l
                if str(zon)[:2] == '02':
                    if lun: intere[i] = max(lun, key=lun.get); nc['incroci'] += 1
                    continue
                q = {}
                for m, Zm in ZM.items():
                    if not Zm.intersects(g): continue
                    if lun.get(m, 0) < 2.0: fuori.append((m, g)); continue   # nessuna via di quel materiale corre nella cella: non ci entra
                    q[m] = Zm.intersection(g).area
                if not q: continue
                m = max(q, key=q.get)
                if q[m] >= 0.6 * A: intere[i] = m; nc['intere'] += 1
                else: nc['divise'] += 1
            for m, g in fuori: ZM[m] = ZM[m].difference(g)
            nc['tolte'] = len(fuori)
            if intere:
                tutte = unary_union([celle[i][0] for i in intere])
                for m in list(ZM): ZM[m] = ZM[m].difference(tutte)
                for i, m in intere.items():
                    if m != 'a': ZM[m] = unary_union([ZM.get(m, Polygon()), celle[i][0]])
        n = 0
        for m, z in ZM.items():
            if not z.is_empty: s.Z.append((z, m, 'strada')); n += 1
        s.T = STRtree([q[0] for q in s.Z]); s.rep['strade_voronoi'] = dict(assi=len(assi), punti=len(P), materiali=sorted(per), celle=nc)

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

    def dividi(s, geom, regole, generi, foto=None, base=None, vicini=False, isole=False):
        """geom (l'unione di una superficie) in pezzi per materiale: prima le zone OSM dei generi dati, poi regole [(geometria, materiale)] in
        ordine (la prima vince), poi foto(pezzo) per quel che resta, pezzo per pezzo. base: il materiale che la superficie ha gia' (va con
        None). -> {materiale o None: geometria}. Lavora sui pezzi di geom che ogni zona tocca, mai sull'unione intera (le carreggiate di tutta
        la mappa: tagliate intere la build durava 17 minuti di piu')"""
        parts = _pz(geom); kn = []   # kn: [pezzo, materiale] dei pezzi che sanno il loro materiale; parts: quelli che non lo sanno
        def take(Z, m):
            nonlocal parts
            if Z is None or Z.is_empty or not parts: return
            hit = set(STRtree(parts).query(Z, predicate='intersects').tolist()); got, new = [], []
            for i, p in enumerate(parts):
                c = p.intersection(Z) if i in hit else None
                if c is not None and not c.is_empty and c.area >= 0.5: got.append(c); new += _pz(p.difference(Z))
                else: new.append(p)
            if got: parts = new; kn.extend([q, m] for c in got for q in _pz(c))
        R = unary_union([g for g, m in regole]) if regole else None
        # OSM prima: la via con surface=* sopra un pezzo del DBGT e' piu' precisa del tipo del DBGT. Il materiale che la superficie ha gia'
        # conta solo dove una regola direbbe altro
        if s.T is not None and parts:
            for m in sorted(set(z[1] for z in s.Z)):
                if m == base and R is None: continue
                zs = [z for z, m_, k in s.Z if m_ == m and k in generi]
                if m == base: zs = (lambda zz: [zz[i] for i in STRtree(zz).query(R, predicate='intersects')])(zs) if zs else []
                if not zs: continue
                Z = unary_union(zs)
                take(Z.intersection(R) if m == base else Z, m)
        for g, m in regole: take(g, m)
        # i pezzi attaccati della stessa superficie (nessun bordo fra loro: sono un pezzo solo dell'unione) senza materiale prendono quello del
        # vicino che lo conosce, con cui hanno piu' confine (Carlo 6/11: macchie chiare sull'asfalto del vialetto lungo la Milano-Meda). Il
        # neutro resta solo a una superficie intera di cui nessun pezzo sa niente. 'n' (pavimentato, materiale ignoto: AC_PED, AC_CIC, la foto)
        # sa poco: un pezzo 'n' attaccato a un materiale vero per almeno un quarto del suo contorno prende quello (le strisce chiare ai lati del
        # vialetto d'asfalto); un materiale vero non ne scaccia mai un altro
        def confini(p, T):
            pb = p.buffer(0.05); best = {}
            for i in T.query(pb, predicate='intersects'):
                g, m = kn[i]
                if g is p: continue
                L = g.boundary.intersection(pb).length
                if L > 0: best[m] = best.get(m, 0) + L
            return best
        def propaga():
            nonlocal parts
            for _ in range(8):
                cambi = 0
                if parts and kn:
                    T = STRtree([g for g, m in kn]); rest, nuovi = [], []
                    for p in parts:
                        best = confini(p, T)
                        if best:
                            spec = {m: L * (0.5 if m == 'n' else 1) for m, L in best.items()}; m = max(spec, key=spec.get)
                            if best[m] >= 0.5: nuovi.append([p, m]); continue
                        rest.append(p)
                    parts = rest; kn.extend(nuovi); cambi += len(nuovi)
                if kn:
                    T = STRtree([g for g, m in kn])
                    for e in kn:
                        if e[1] != 'n': continue
                        best = {m: L for m, L in confini(e[0], T).items() if m != 'n'}
                        if best:
                            m = max(best, key=best.get)
                            if best[m] >= max(0.5, 0.25 * e[0].length): e[1] = m; cambi += 1
                if not cambi: return
        if vicini: propaga()
        # isole: un pezzo senza materiale piccolo (fino a 300 m2) e chiuso per almeno meta' del contorno da un materiale prende quello (le chiazze
        # d'asfalto fra i ciottoli di piazza Vittorio Veneto, Carlo 7/11)
        if isole and parts and kn:
            T = STRtree([g for g, m in kn]); rest = []
            for p in parts:
                if p.area <= 300:
                    best = confini(p, T)
                    if best:
                        m = max(best, key=best.get)
                        if best[m] >= 0.5 * p.length: kn.append([p, m]); continue
                rest.append(p)
            parts = rest
        if foto is not None:
            altri = []
            for p in parts:
                m = foto(p) if p.area >= 4 else None
                if m: kn.append([p, m])
                else: altri.append(p)
            parts = altri
            if vicini: propaga()
        per = {}
        for g, m in kn: per.setdefault(None if m == base else m, []).append(g)
        if parts: per.setdefault(None, []).extend(parts)
        return {m: unary_union(gs) for m, gs in per.items()}


def _pz(g):
    """i poligoni di g (non vuoti, da 0,01 m2)"""
    if g is None or g.is_empty: return []
    return [p for p in (list(g.geoms) if hasattr(g, 'geoms') else [g]) if p.geom_type == 'Polygon' and p.area > 0.01] +         [q for p in (list(g.geoms) if hasattr(g, 'geoms') else []) if p.geom_type == 'MultiPolygon' for q in p.geoms if q.area > 0.01]
