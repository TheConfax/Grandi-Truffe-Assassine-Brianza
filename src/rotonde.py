# Le aiuole delle rotonde (docs/rotonde.md). Per ogni rotonda della tabella src/rotonde.json (scritta guardando la foto aerea 2018-19 della
# Regione e, per via Cadorna, la foto di Carlo): l'isola centrale del DBGT (MAN_TR) piena, senza il buco che a via Cadorna, largo Terragni e
# nella minirotonda a est del centro il DBGT lascia per l'aiuola (AR_VRD), e quello che ci sta sopra secondo il suo modello:
#   A  anello di ciottoli + cordolo + prato rialzato + bordure di fiori rossi + cespugli tondi (via Cadorna)
#   B  la base: fascia di cemento chiaro dentro il cordolo, prato a leggera cupola, arbusti tondi al centro e in tre gruppi (dalle rotonde della zona)
#   C  prato con le mezzelune bordate di bianco piantate ad arbusti bassi
#   D  pavimentata in pietra
#   E  anello (di ciottoli o di cemento) + prato rialzato, con le mezzelune se ci sono
# Le isole piccole (gocce, spartitraffico) e tutto fuori da Meda restano come sono. Gli alberi sono solo quelli dei dati.
# Escono in tiles[t].ro (la tile del centro), una voce per rotonda: m modello, an anello (poligoni), am 1 ciottoli 2 cemento, pr prato
# rialzato (con cu: la cupola della base, m), fa fascia della base, mz mezzelune [{p, k, i, t: f|a|t}] (gli arbusti delle mezzelune sono in cs),
# cs cespugli [x, z, mezza larghezza, altezza] in dm e colore, pv pavimentata
import json, math, os
from shapely.geometry import Point, Polygon, LineString, MultiPolygon
from shapely.ops import unary_union

TAB = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'rotonde.json')
MARGINE = 0.35   # m: le mezzelune stanno almeno a tanto dal bordo del prato
BORDO = 0.2      # m: la pietra bianca che borda le mezzelune, vista dall'alto (foto aerea)


def _poly(g):
    return [p for p in getattr(g, 'geoms', [g]) if p.geom_type == 'Polygon' and not p.is_empty]


class Rotonde:
    def __init__(s, isole, log=print):
        """isole: i poligoni MAN_TR (spartitraffico, isole, rotatorie) del DBGT, in metri del gioco (dbgt_strade.Strade.isole)"""
        s.log = log; s.voci = []; s.piene = []; s.rep = {}
        tab = json.load(open(TAB, encoding='utf-8'))['rotonde']
        for e in tab:
            P = Point(e['x'], e['z'])
            cand = [g for g in isole if Polygon(g.exterior).buffer(1.0).contains(P)]
            if not cand: log('rotonde: nessuna isola del DBGT a x %s z %s' % (e['x'], e['z'])); continue
            g = min(cand, key=lambda g: Polygon(g.exterior).area)
            piena = Polygon(g.exterior); c = piena.centroid; v = dict(m=e['modello'], c=(c.x, c.y))
            buchi = unary_union([Polygon(h) for h in g.interiors]) if g.interiors else None
            prato = piena
            if e.get('anello'):
                w, mat = e['anello']
                if w is None and buchi is not None and buchi.area > 0.3 * piena.area: prato = buchi   # the DBGT island is the ring itself
                else: prato = piena.buffer(-(w or 1.6), join_style='round')
                v['an'] = piena.simplify(0.15, preserve_topology=True).difference(prato); v['am'] = 1 if mat == 'ciottoli' else 2; v['pr'] = prato
            if e['modello'] == 'D': v['pv'] = piena
            if e['modello'] == 'B':   # the base (docs/rotonde.md, "La base"): a band of light worked concrete inside the kerb, the lawn a low dome
                R = math.sqrt(piena.area / math.pi); w = min(1.2, max(0.8, 0.07 * R))
                prato = piena.buffer(-w, join_style='round'); v['fa'] = piena.simplify(0.15, preserve_topology=True).difference(prato); v['pr'] = prato
                v['cu'] = round(min(0.5, max(0.2, 0.035 * R)), 2)
            dentro = prato.buffer(-MARGINE)
            mz = []
            arb = []   # the shrubs of the crescents: a row of round shrubs along the arc (a: close, a hedge of them; t: spaced in the soil)
            for ang, ap, r, w, t, *col in e.get('mezzelune', []):
                a = [math.radians(ang - ap / 2 + ap * k / 24) for k in range(25)]
                arco = LineString([(c.x + r * math.cos(q), c.y + r * math.sin(q)) for q in a]).buffer(w / 2, quad_segs=6)
                bed = [p for p in _poly(arco.intersection(dentro)) if p.area > 0.3]
                mz += [(p, t) for p in bed]
                if t in ('a', 't') and bed:
                    passo, hw, h = (0.7, max(0.35, min(0.45, w / 2 - BORDO - 0.05)), 0.85) if t == 'a' else (1.5, max(0.3, min(0.35, w / 2 - BORDO - 0.05)), 0.55)
                    n = max(1, int(math.radians(ap) * r / passo)); dent = unary_union(bed).buffer(-BORDO - hw * 0.4)
                    for k in range(n + 1):
                        q_ = math.radians(ang - ap / 2 + ap * (k + 0.5) / (n + 1)); x, z = c.x + r * math.cos(q_), c.y + r * math.sin(q_)
                        if dent.contains(Point(x, z)): arb.append((x, z, hw * (0.9 + 0.2 * ((k * 7) % 3) / 2), h * (0.9 + 0.1 * (k % 2)), col[0] if col else ('#3d5e27' if t == 'a' else '#4a6a2c')))
            v['mz'] = mz
            v['cs'] = [(c.x + r * math.cos(math.radians(a)), c.y + r * math.sin(math.radians(a)), hw, h, col) for a, r, hw, h, col in e.get('cespugli', [])]
            if e['modello'] == 'B':   # a clump of shrubs in the middle and three groups halfway to the edge (s1, e3, n1, medici, De Gasperi in the aerial photos)
                R = math.sqrt(prato.area / math.pi); a0 = (e['x'] * 7.3 + e['z'] * 3.1) % 120; VERDI = ('#2f4a1c', '#7a762b', '#3d5e27', '#4f6b2a')
                v['cs'].append((c.x, c.y, 1.0, 1.4, VERDI[0]))
                for j in range(6): ga = math.radians(a0 + 60 * j); v['cs'].append((c.x + 1.3 * math.cos(ga), c.y + 1.3 * math.sin(ga), 0.7 - 0.08 * (j % 2), 1.0 - 0.15 * (j % 2), VERDI[1 + j % 3]))
                for k in range(3):
                    ga = math.radians(a0 + 60 + 120 * k); gx, gz = c.x + 0.55 * R * math.cos(ga), c.y + 0.55 * R * math.sin(ga)
                    for j, (dx, dz) in enumerate(((0, 0), (1.1, 0.4), (0.3, -1.1), (-0.9, 0.6))):
                        v['cs'].append((gx + dx * math.cos(ga) - dz * math.sin(ga), gz + dx * math.sin(ga) + dz * math.cos(ga), 0.75 - 0.08 * j, 1.0 - 0.1 * j, VERDI[(j + k) % 4]))
            v['cs'] = [q for q in v['cs'] if dentro.contains(Point(q[0], q[1]))] + arb
            s.voci.append(v); s.piene.append(piena)
            s.rep['x %d z %d' % (round(c.x), round(c.y))] = dict(modello=e['modello'], area_m2=round(piena.area), buco_riempito_m2=round(buchi.area) if buchi is not None else 0,
                                                                   anello_m2=round(v['an'].area) if 'an' in v else 0, mezzelune=len(mz), cespugli=len(v['cs']))
        log('rotonde: %d aiuole (%s)' % (len(s.voci), ', '.join('%s %d' % (m, sum(1 for v in s.voci if v['m'] == m)) for m in 'ABCDE')))

    def riempi(s, md):
        """the islands of the DBGT (dbgt_strade md_dbgt) with the rings of the roundabouts filled: the aiuola in the middle is part of the island.
        Only those pieces change (a union of everything would move the vertices of every other island)"""
        if not s.piene: return md
        out = []
        for p in _poly(md):
            if p.interiors and any(f.buffer(0.05).contains(p) for f in s.piene): p = Polygon(p.exterior)
            out.append(p)
        return MultiPolygon(out)

    def push_tiles(s, tid, polys_of, push, q):
        for v in s.voci:
            r = {'m': v['m'], 'c': [q(v['c'][0]), q(v['c'][1])]}
            # the outer edge as the island's (md, simplified 0.15 by polys_of in push_tiles of dbgt_strade): no sliver of its grass beside it
            if 'an' in v: r['an'] = polys_of(v['an'], 0.01, 0.2)
            if 'fa' in v: r['fa'] = polys_of(v['fa'], 0.01, 0.2)
            if 'cu' in v: r['cu'] = v['cu']
            if 'pr' in v: r['pr'] = polys_of(v['pr'], 0.01, 0.2)
            if 'pv' in v: r['pv'] = polys_of(v['pv'].buffer(0.06, join_style='round'), 0.15, 0.2)   # 6 cm over the kerb's top: none of the grass under it shows at the edge
            if 'am' in v: r['am'] = v['am']
            if v['mz']:   # i: inside the white stone edge (BORDO m wide on top), where the flowers, shrubs or soil are
                r['mz'] = [dict(p_, t=t, i=[x['p'] for x in polys_of(p.buffer(-BORDO, join_style='round'), 0.05, 0.1)]) for p, t in v['mz'] for p_ in polys_of(p, 0.05, 0.2)]
            if v['cs']: r['cs'] = [[q(x), q(z), q(hw), q(h), col] for x, z, hw, h, col in v['cs']]
            push(tid(*v['c']), 'ro', r)
