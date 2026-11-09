"""Epoca di costruzione degli edifici (Carlo, 8/11): ogni edificio di brianza.json riceve il campo 'ep'.
Fonte: attestati CENED+2 (dati.lombardia.it, dataset bbky-sde5, CC0), scaricati una volta in data/cened/*.csv (docs/dati.md).
La regola e' quella approvata da Carlo sulla mappa fatta a mano (docs/censimento_fonti.md, riga CENED+2):
  1. l'attestato si aggancia all'edificio per via + civico: il civico e' quello di OpenStreetMap; se manca si interpola
     sul civico piu' vicino della stessa via oppure lungo la strada con lo stesso nome;
  2. l'epoca dell'edificio e' la fascia PIU' VECCHIA fra i suoi attestati (se sono piu' di 3, la fascia piu' vecchia che ha almeno 2 attestati);
  3. gli edifici senza attestati prendono l'epoca della via (attestati con la stessa via entro 100 m) o, se non c'e', del vicinato entro 100 m;
  4. 'sconosciuto' (campo assente) solo se non c'e' nessun dato.
Il comune non e' scritto da nessuna parte: ogni file di data/cened/ porta il nome del comune nelle sue righe (comune_catastale),
il suo confine e' in data/osm/confini_comuni.json. Un comune senza file CENED resta tutto sconosciuto.
Fasce (quelle del CENED), codice nel campo 'ep':
  0 prima del 1930, 1 1930-1945, 2 1946-1960, 3 1961-1976, 4 1977-1992, 5 1993-2006, 6 dopo il 2006; assente = sconosciuto."""
import csv, glob, json, os, re, math, collections, difflib, unicodedata
from shapely.geometry import Polygon, Point, LineString
from shapely.ops import unary_union, polygonize
from shapely.prepared import prep
from shapely.strtree import STRtree

FASCE = ['Prima del 1930', '1930-1945', '1946-1960', '1961-1976', '1977-1992', '1993-2006', 'Dopo il 2006']
LIMITI = [1930, 1946, 1961, 1977, 1993, 2007]  # un anno esatto cade nella fascia il cui limite superiore lo supera
RAGGIO = 100  # m: il vicinato
MAX_EDIFICIO = 15  # m: un civico fuori da ogni edificio va all'edificio piu' vicino se e' entro questa distanza


def fascia(a):
    a = (a or '').strip()
    if re.fullmatch(r'\d{4}', a):
        y = int(a)
        for i, l in enumerate(LIMITI):
            if y < l: return i
        return 6
    al = a.lower()
    if al.startswith('prima'): return 0
    if '1930' in al and '1945' in al: return 1
    if '1946' in al: return 2
    if '1961' in al: return 3
    if '1977' in al: return 4
    if '1993' in al: return 5
    if al.startswith('dopo'): return 6
    return None


def epoca(fs):  # la piu' vecchia; con piu' di 3 attestati la piu' vecchia che ne ha almeno 2 (uno solo fuori posto non conta)
    c = collections.Counter(fs)
    if len(fs) > 3:
        for f in range(7):
            if c[f] >= 2: return f
    return min(fs)


ABBR = {'v': 'via', 'vle': 'viale', 'v.le': 'viale', 'p.zza': 'piazza', 'pza': 'piazza', 'pzza': 'piazza', 'p.le': 'piazzale', 'ple': 'piazzale', 'c.so': 'corso', 'cso': 'corso', 'l.go': 'largo', 'lgo': 'largo', 'str': 'strada'}
TIPI = {'via', 'viale', 'piazza', 'piazzale', 'corso', 'largo', 'vicolo', 'strada', 'passaggio', 'salita', 'traversa'}
STOP = {'di', 'del', 'della', 'dello', 'dei', 'degli', 'delle', 'de', 'da', 'dal', 'd', 'e', 'la', 'il', 'lo', 'l', 'al', 'alla', 'dell', 'n', 'nr', 'numero'}
NOMI = {'yuri', 'jury', 'juri', 'j', 'iuri', 'giuseppe', 'g', 'giacomo', 'alessandro', 'a', 'francesco', 'f', 'guglielmo', 'antonio', 'carlo', 'c', 'don', 'san', 'santa', 'sant', 's', 'papa', 'beato', 'dott', 'prof', 'gen', 'generale', 'fratelli', 'cardinale', 'card', 'mons', 'monsignor'}


def norm(s):  # il nome della via senza tipo, articoli e nome di battesimo: "Via G. Garibaldi" e "VIA GIUSEPPE GARIBALDI" coincidono
    s = unicodedata.normalize('NFKD', s.lower()); s = ''.join(c for c in s if not unicodedata.combining(c))
    s = re.sub(r"[.,'`]", ' ', s); s = re.sub(r'\s+', ' ', s).strip()
    toks = [ABBR.get(t, t) for t in s.split()]
    toks = [t for t in toks if t not in TIPI and t not in STOP]
    n = [t for t in toks if t not in NOMI]
    return ' '.join(n if n else toks)


def civ(h):
    m = re.match(r'\s*(\d+)\s*[/\- ]?\s*([a-zA-Z]?)', h or '')
    return (int(m.group(1)), m.group(2).lower()) if m else None


def confine(elementi, nome, proj):  # il confine di un comune (relazione OSM di confini_comuni.json) in metri di gioco
    for e in elementi:
        if e.get('tags', {}).get('name', '').lower() != nome.lower(): continue
        ls = []
        for m in e.get('members', []):
            g = m.get('geometry') or []
            if m.get('type') == 'way' and len(g) > 1: ls.append(LineString([proj(p['lat'], p['lon']) for p in g]))
        return unary_union(list(polygonize(unary_union(ls))))
    return None


def leggi_cened(cartella):
    """{comune (maiuscolo): [righe]} da tutti i csv di cartella. Le righe di un comune sono quelle con il suo prefisso ISTAT di sezione (il piu' frequente):
    gli attestati con la stessa comune_catastale ma la sezione in un altro comune (indirizzo fuori) o senza sezione non entrano."""
    per = collections.defaultdict(list)
    for f in sorted(glob.glob(os.path.join(cartella, '*.csv'))):
        for r in csv.DictReader(open(f, encoding='utf-8')):
            if r.get('comune_catastale'): per[r['comune_catastale'].strip().upper()].append(r)
    out = {}
    for com, rows in per.items():
        pre = collections.Counter(r['sez_censimento'][:6] for r in rows if r.get('sez_censimento')).most_common(1)
        if pre: out[com] = [r for r in rows if r.get('sez_censimento', '').startswith(pre[0][0])]
    return out


def calcola(out, indirizzi, cartella, conf_path, proj, log=print):
    """out: il dizionario di brianza.json prima di scriverlo (tiles, nodes, roads, names); indirizzi: [(x, z, via, civico)] in metri di gioco
    (nodi e edifici OSM con addr:housenumber); proj(lat, lon) -> (x, z). Scrive rec['ep'] negli edifici; ritorna il report."""
    rep = dict(edifici=0, aggancio_esatto=0, dalla_via=0, dal_vicinato=0, sconosciuti=0, per_fascia=[0] * 7, comuni={})
    recs, blds = [], []
    for t in out['tiles']:
        for b in t.get('b', []):
            p = b['p']; x = p[0]; z = p[1]; pts = [(x / 10, z / 10)]
            for i in range(2, len(p), 2):
                x += p[i]; z += p[i + 1]; pts.append((x / 10, z / 10))
            pg = None
            if len(pts) >= 3:
                pg = Polygon(pts)
                if not pg.is_valid: pg = pg.buffer(0)
                if pg.is_empty or pg.geom_type != 'Polygon': pg = None
            if pg is not None: recs.append(b); blds.append(pg)
    rep['edifici'] = len(blds)
    cened = leggi_cened(cartella) if os.path.isdir(cartella) else {}
    if not cened or not os.path.exists(conf_path):
        rep['sconosciuti'] = len(blds); log('epoca: nessun CENED in', cartella, '- tutti sconosciuti'); return rep
    elementi = json.load(open(conf_path, encoding='utf-8'))['elements']
    nodes, names = out['nodes'], out['names']
    roads = []
    for r in out['roads']:
        if r.get('n') is None or r['n'] < 0 or r['n'] >= len(names): continue
        roads.append(([(nodes[3 * g] / 10, nodes[3 * g + 1] / 10) for g in r['g']], names[r['n']]))
    cents = [pg.centroid for pg in blds]
    giro = set()
    for com, rows in sorted(cened.items()):
        poly = confine(elementi, com, proj)
        if poly is None or poly.is_empty: log('epoca: nessun confine per', com); continue
        pu = prep(poly)
        mine = [i for i, c in enumerate(cents) if pu.contains(c)]
        if not mine: continue
        bl = [blds[i] for i in mine]
        btree = STRtree(bl)

        def building_of(pt):
            for i in btree.query(pt):
                if bl[i].contains(pt): return int(i)
            i = btree.nearest(pt)
            if i is not None and bl[i].distance(pt) <= MAX_EDIFICIO: return int(i)
            return None
        A = collections.defaultdict(list)
        for x, z, via, h in indirizzi:
            if not via: continue
            pt = Point(x, z)
            if not pu.contains(pt): continue
            c = civ(h); bi = building_of(pt)
            if c and bi is not None: A[norm(via)].append((c[0], c[1], bi, x, z))
        R = collections.defaultdict(list); rpts = []
        for ln, nm in roads:
            if not any(pu.contains(Point(x, z)) for x, z in ln[::max(1, len(ln) // 3)]): continue
            ns = norm(nm); R[ns].append(ln)
            for (x0, z0), (x1, z1) in zip(ln, ln[1:]):
                L = math.hypot(x1 - x0, z1 - z0); k = max(1, int(L // 10))
                for q in range(k + 1): rpts.append((x0 + (x1 - x0) * q / k, z0 + (z1 - z0) * q / k, ns))
        rtree = STRtree([Point(x, z) for x, z, _ in rpts]) if rpts else None
        streets = list(set(A.keys()) | set(R.keys()))

        def match_street(s):
            n = norm(s)
            if n in A or n in R: return n
            m = difflib.get_close_matches(n, streets, 1, 0.84)
            if m: return m[0]
            lt = n.split()[-1] if n else ''
            c = [x for x in streets if x.split() and x.split()[-1] == lt]
            if len(c) == 1: return c[0]
            c = [x for x in streets if lt and lt in x.split()]
            return c[0] if len(c) == 1 else None
        parsed = []; maxnum = collections.defaultdict(int)
        for r in rows:
            ind = (r.get('indirizzo') or '').strip()
            mm = re.search(r'\s(\d+)\s*([/\-]?\s*[a-zA-Z])?\b', ind)
            if not mm or re.search(r'\bsnc\b', ind, re.I): parsed.append((None, r)); continue
            ns = match_street(ind[:mm.start()]); num = int(mm.group(1)); let = (mm.group(2) or '').strip('/- ').lower()[:1]
            parsed.append(((ns, num, let), r))
            if ns: maxnum[ns] = max(maxnum[ns], num)
        bat = collections.defaultdict(list); att = []; ok = oki = nociv = nostr = 0
        for p, r in parsed:
            f = fascia(r.get('anno_costruzione'))
            if f is None: continue
            if p is None: nociv += 1; continue
            ns, num, let = p
            if ns is None: nostr += 1; continue
            c = [a for a in A[ns] if a[0] == num]
            if let: c = [a for a in c if a[1] == let] or c
            if c:  # il civico c'e' su un edificio
                b = sorted({a[2] for a in c})[0]; bat[b].append(f); ok += 1
                a0 = [a for a in c if a[2] == b][0]; att.append((a0[3], a0[4], ns, f))
            elif A.get(ns):  # civico mancante: il piu' vicino della stessa via
                k = min(A[ns], key=lambda a: abs(a[0] - num)); att.append((k[3], k[4], ns, f)); oki += 1
            elif ns in R:  # nessun civico OSM su quella via: lungo la strada, in proporzione al numero
                main = max(R[ns], key=len); idx = min(len(main) - 1, int(len(main) * num / max(num, maxnum[ns], 1)))
                att.append((main[idx][0], main[idx][1], ns, f)); oki += 1
            else: nostr += 1
        direct = {b: epoca(fs) for b, fs in bat.items()}
        astree = STRtree([Point(a[0], a[1]) for a in att]) if att else None
        est = {}
        for i, pg in enumerate(bl):
            if i in direct: continue
            c = pg.centroid; ns = None
            j = rtree.nearest(c) if rtree is not None else None
            if j is not None and Point(rpts[j][0], rpts[j][1]).distance(c) <= 40: ns = rpts[j][2]
            cand = [att[k] for k in astree.query(c.buffer(RAGGIO)) if Point(att[k][0], att[k][1]).distance(c) <= RAGGIO] if astree else []
            same = [a[3] for a in cand if ns and a[2] == ns]
            if same: est[i] = (epoca(same), 'via')
            elif cand: est[i] = (epoca([a[3] for a in cand]), 'vic')
        nv = sum(1 for v in est.values() if v[1] == 'via')
        for i, f in direct.items(): recs[mine[i]]['ep'] = f; giro.add(mine[i])
        for i, v in est.items(): recs[mine[i]]['ep'] = v[0]; giro.add(mine[i])
        rep['aggancio_esatto'] += len(direct); rep['dalla_via'] += nv; rep['dal_vicinato'] += len(est) - nv
        rep['comuni'][com] = dict(edifici=len(bl), attestati=len(rows), attestati_agganciati_al_civico=ok, attestati_interpolati=oki, senza_civico=nociv, via_non_trovata=nostr,
                                  esatti=len(direct), dalla_via=nv, dal_vicinato=len(est) - nv, sconosciuti=len(bl) - len(direct) - len(est))
        log('epoca', com, rep['comuni'][com])
    rep['sconosciuti'] = len(blds) - len(giro)
    for i in giro: rep['per_fascia'][recs[i]['ep']] += 1
    return rep
