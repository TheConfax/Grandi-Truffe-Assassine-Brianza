"""The public and special buildings (Carlo 8/11, facciate-2): every one not made by hand is drawn in shocking pink with its group (CHIESA, SCUOLA...)
and its name written all round it, until it is made properly. The rule is the census of 8/11 (217 buildings at Meda and Seveso, scripts ext.py, c2.py,
c5.py of that session), here for the whole map: a building's label comes from the DBGT (use EDIFC_USO, type EDIFC_TY / EDI_MIN_TY), from its OSM
building tags and from the OSM points and areas of amenity, office, leisure... in it. OSM wins when it says something precise, then the DBGT, then
the vague OSM labels. The volumes of one DBGT building are one building. b['pu'] is the group (index in GRUPPI), b['pn'] the name (OSM)"""
import re
from collections import Counter, defaultdict
from shapely.geometry import Point, Polygon
from shapely.strtree import STRtree

GRUPPI = ['CAPPELLA', 'CHIESA', 'SCUOLA', 'SCUOLA SUPERIORE', 'ASILO', 'SPORT', 'SANITÀ', 'COMUNE', 'CARABINIERI', 'POLIZIA LOCALE', 'POSTE', 'STAZIONE', 'CULTURA', 'TRIBUNA', 'ALTRO']
INF = "scuola dell'infanzia"
GRUPPO_DI = {
    'cappella': 'CAPPELLA', 'edicola funeraria': 'CAPPELLA',
    'chiesa': 'CHIESA', 'oratorio': 'CHIESA', 'oratorio / centro parrocchiale': 'CHIESA', 'santuario': 'CHIESA', 'campanile': 'CHIESA', 'altro luogo di culto': 'CHIESA',
    'scuola primaria': 'SCUOLA', 'scuola media': 'SCUOLA', 'scuola primaria e media': 'SCUOLA', 'scuola (non precisata)': 'SCUOLA',
    'scuola superiore / formazione': 'SCUOLA SUPERIORE', INF: 'ASILO', 'asilo nido': 'ASILO',
    'impianto sportivo': 'SPORT', 'palazzetto / palestra pubblica': 'SPORT', 'piscina coperta': 'SPORT', 'palestra privata / fitness': 'SPORT',
    'ambulatorio / clinica': 'SANITÀ', 'ospedale': 'SANITÀ', 'ospedale / sanità (non precisato)': 'SANITÀ', 'servizi sociali / RSA / centro diurno': 'SANITÀ', 'AVIS / ambulanze': 'SANITÀ',
    'municipio': 'COMUNE', 'ufficio pubblico': 'COMUNE', 'edificio pubblico (non precisato)': 'COMUNE', 'protezione civile': 'COMUNE', 'centro civico / sala polifunzionale': 'COMUNE',
    'caserma carabinieri': 'CARABINIERI', 'polizia locale': 'POLIZIA LOCALE', 'poste': 'POSTE', 'stazione': 'STAZIONE', 'casello ferroviario': 'STAZIONE',
    'biblioteca': 'CULTURA', 'cinema / teatro': 'CULTURA', 'sala civica / centro culturale': 'CULTURA', 'tribuna campo sportivo': 'TRIBUNA',
    'cabina / centrale elettrica': 'ALTRO', 'albergo': 'ALTRO', 'villa storica': 'ALTRO', 'mercato coperto': 'ALTRO',
}
VAGUE = ('scuola (non precisata)', 'edificio pubblico (non precisato)', 'ospedale / sanità (non precisato)', 'impianto sportivo', 'altro luogo di culto',
         'sala civica / centro culturale', 'centro civico / sala polifunzionale')
POI_K = ('amenity', 'office', 'leisure', 'healthcare', 'emergency', 'tourism', 'public_transport', 'railway', 'man_made', 'shop', 'craft', 'historic', 'government', 'military')


def lab_poi(t):
    a, o, l, h, e, pt, rw = [t.get(k) for k in ('amenity', 'office', 'leisure', 'healthcare', 'emergency', 'public_transport', 'railway')]
    nm = (t.get('name') or '').lower()
    if a == 'townhall': return 'municipio'
    if a == 'police': return 'caserma carabinieri' if re.search('carabin|compagnia', nm) else 'polizia locale'
    if a == 'post_office': return None if re.search('mail boxes', nm) else 'poste'
    if a in ('school', 'kindergarten', 'college', 'university'):
        if re.search('infanzia|materna', nm): return INF
        if re.search('primaria|element', nm) and re.search('secondaria|media', nm): return 'scuola primaria e media'
        if re.search('primaria|element', nm): return 'scuola primaria'
        if re.search('secondaria|media', nm): return 'scuola media'
        if re.search('istituto|liceo|professional|superiore|formazione|accademia|brianteo|grimoldi', nm): return 'scuola superiore / formazione'
        return 'scuola (non precisata)' if a == 'school' else INF
    if a == 'childcare': return 'asilo nido'
    if a == 'library': return 'biblioteca'
    if a in ('cinema', 'theatre'): return 'cinema / teatro'
    if a == 'arts_centre': return 'sala civica / centro culturale'
    if a in ('community_centre', 'events_venue'): return 'oratorio' if 'oratorio' in nm else 'centro civico / sala polifunzionale'
    if a == 'social_facility': return 'servizi sociali / RSA / centro diurno'
    if a == 'clinic' or h in ('clinic', 'centre', 'rehabilitation', 'laboratory', 'vaccination_centre') or h == 'yes': return 'ambulatorio / clinica'
    if h == 'blood_donation' or e == 'ambulance_station': return 'AVIS / ambulanze'
    if e == 'disaster_response': return 'protezione civile'
    if a == 'hospital': return 'ospedale'
    if a == 'place_of_worship':
        if re.search('cappell|chiesin', nm): return 'cappella'
        if 'santuario' in nm: return 'santuario'
        if re.search('sala del regno', nm): return 'altro luogo di culto'
        return 'chiesa'
    if a == 'marketplace': return 'mercato coperto'
    if o == 'government': return 'ufficio pubblico'
    if rw == 'station' or pt == 'station': return 'stazione'
    if l == 'sports_hall': return 'palazzetto / palestra pubblica'
    if l == 'sports_centre': return 'impianto sportivo'
    if l == 'fitness_centre': return 'palestra privata / fitness'
    return None


def lab_bld(t):
    b = t.get('building'); nm = (t.get('name') or '').lower()
    r = lab_poi(t)
    if r: return r
    m = {'school': 'scuola (non precisata)', 'kindergarten': INF, 'hospital': 'ospedale', 'train_station': 'stazione', 'church': 'chiesa', 'parish': 'oratorio / centro parrocchiale',
         'chapel': 'cappella', 'religious': 'altro luogo di culto', 'public': 'edificio pubblico (non precisato)', 'civic': 'protezione civile' if 'protezione' in nm else 'edificio pubblico (non precisato)',
         'grandstand': 'tribuna campo sportivo', 'cathedral': 'chiesa'}
    if t.get('tourism') == 'hotel': return 'albergo'
    if t.get('historic') == 'manor': return 'villa storica'
    return m.get(b)


USO = [('030301', 'scuola (non precisata)'), ('030102', 'ospedale'), ('030104', 'ambulatorio / clinica'), ('030101', 'servizi sociali / RSA / centro diurno'), ('0301', 'ospedale / sanità (non precisato)'),
       ('0201', 'municipio'), ('0306', 'caserma carabinieri'), ('100101', 'biblioteca'), ('100102', 'cinema / teatro'), ('100201', 'piscina coperta'), ('100202', 'palestra privata / fitness'),
       ('1002', 'impianto sportivo'), ('1001', 'sala civica / centro culturale'), ('060301', 'stazione'), ('060303', 'casello ferroviario'), ('080201', 'cabina / centrale elettrica'), ('05', 'altro luogo di culto')]


def lab_dbgt(kind, ty, uso):
    if kind == 'M': return {'18': 'cappella', '04': 'edicola funeraria'}.get(ty)
    if ty in ('11', '22'): return 'chiesa'
    if ty == '07': return 'campanile'
    for u in uso or []:
        for p, l in USO:
            if u.startswith(p): return l
    if ty == '19': return 'palazzetto / palestra pubblica'
    return None


def classifica(blds, ntags, ways, nodes, ring, log):
    """blds: the building records of build_data.py (game metres, 'p'); sets 'pu' and 'pn' on the public ones. Returns the count by group"""
    geo, idx = [], []
    for i, b in enumerate(blds):
        try: g = Polygon(b['p']).buffer(0)
        except Exception: continue
        if g.is_empty: continue
        geo.append(g); idx.append(i)
    tr = STRtree(geo)
    key = lambda i: ('e', blds[i]['e']) if blds[i].get('e') is not None else ('o', i)
    grp = defaultdict(lambda: dict(D=[], O=[], P=[], i=[]))
    for i in idx:
        b = blds[i]; G = grp[key(i)]; G['i'].append(i)
        if b.get('dk') is not None: G['D'].append(lab_dbgt(b['dk'], b.get('dty'), b.get('du')))
        if b.get('tg'): G['O'].append((lab_bld(b['tg']), b['tg'].get('name')))
    # the OSM points and areas
    pois = [(t, nodes[r], None) for r, t in ntags.items() if r in nodes and any(k in t for k in POI_K)]
    for wid, (refs, t) in ways.items():
        if 'building' in t or not any(k in t for k in POI_K) or len(refs) < 4 or refs[0] != refs[-1]: continue
        try: pg = Polygon(ring(refs)).buffer(0)
        except Exception: continue
        if not pg.is_empty and pg.area > 0: pois.append((t, None, pg))
    nfall = 0
    for t, pt, pg in pois:
        if t.get('leisure') == 'pitch': continue
        js = []
        if pg is None:
            P = Point(pt); js = [j for j in tr.query(P) if geo[j].contains(P)]
            if not js:
                q = [j for j in tr.query(P.buffer(12)) if geo[j].distance(P) < 12]
                if q: js = [min(q, key=lambda j: geo[j].distance(P))]; nfall += 1
        else:
            js = [j for j in tr.query(pg) if geo[j].area >= 60 and geo[j].intersection(pg).area > 0.5 * geo[j].area]
        for k in {key(idx[j]) for j in js}: grp[k]['P'].append((lab_poi(t), t.get('name')))
    cnt = Counter()
    for k, G in grp.items():
        ld = [x for x in G['D'] if x]; lo = [x for x, n in G['O'] if x]; lp = [x for x, n in G['P'] if x]
        if not (ld or lo or lp): continue
        osm = lo + lp
        pri = [x for x in lo if x not in VAGUE] or [x for x in osm if x not in VAGUE]
        if pri: best = Counter(pri).most_common(1)[0][0]
        elif ld and ld[0] not in VAGUE: best = ld[0]
        elif osm: best = Counter(osm).most_common(1)[0][0]
        else: best = ld[0]
        g = GRUPPO_DI.get(best)
        if not g: continue
        nl = [(l, n) for l, n in G['O'] + G['P'] if n]
        names = [n for l, n in nl if l == best] or [n for l, n in nl]
        name = (names[0] if names else '').strip()[:60]
        cnt[g] += 1
        for i in G['i']:
            blds[i]['pu'] = GRUPPI.index(g)
            if name: blds[i]['pn'] = name
    log('pubblici (rosa): edifici per gruppo', dict(cnt), 'punti agganciati al vicino entro 12 m', nfall)
    return dict(cnt)
