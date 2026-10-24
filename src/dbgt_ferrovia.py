# Il disegno dal DBGT, ferrovia e confini (docs/motore.md 7, quinto pezzo). Inside a comune with a DBGT:
#   - the tracks run on the EL_FER axes: EL_FER is the middle of every physical track ("un elemento per ogni binario", Specifiche di
#     contenuto regionali, EL_FER_TRA), so the number of tracks is the number of parallel axes (EL_FER_NBI and EL_FER_TY are empty at Meda).
#     The OSM rail ways are matched on the EL_FER network (the same map matching as the streets, dbgt_strade.viterbi) and their nodes moved
#     onto the axes; OSM keeps the line, its name, the electrification, the stations and the level crossings. A level crossing node (shared
#     by a rail way and a road way) goes where the road, already on its EL_STR axis, crosses the track. EL_FER stretches no OSM way runs on
#     (crossovers, sidings, the tracks of the station) are drawn as tracks of their own, not used by the trains
#   - the rail bed SD_FER (massicciata, a raso) is drawn as its own surface (tiles[t].sf), the sleepers and rails along each track over it
#   - the railway fences stand on the edge of the rail bed, never in a carriageway; the platforms keep clear of the tracks
#   - the comune boundaries: LIM_COM where the DBGT has it, spliced into the OSM boundary (for the town signs)
#   - checks (report): distance of the drawn tracks from EL_FER before and after, trains against platforms, buildings and carriageways,
#     level crossings, the town signs
# Used by build_data.py (a few lines call it, class Ferrovia). To work on it without the whole build: GTA_DUMP_FERROVIA=file makes
# build_data.py pickle nodes, raw_roads and rail_raw after the streets are on their axes, and stop.
import os, sys, math, time, sqlite3
from collections import defaultdict, Counter
import numpy as np, shapely
from shapely.geometry import LineString, Point, Polygon, MultiPolygon, GeometryCollection, MultiLineString
from shapely.ops import unary_union, linemerge, substring
from shapely.strtree import STRtree

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbgt_quote as dq
import dbgt_strade as ds

D_FREE = 3.0      # map matching: a sample farther than this from every axis may stay unmatched (the OSM tracks are 0.3 m off, p99 0.7)
X_MIN = 3.0       # an EL_FER stretch no OSM way runs on, at least this long, becomes a track of its own
CLEAR = 1.65      # a platform edge at least this far from the middle of a track (the train is 2.9 m wide; Italian platforms 1.65-1.75 m)
FENCE_OUT = 0.6   # the railway fence this far outside the rail bed
LIM_EDGE = 2.0    # ... and only if it lies within this of the edge of the DBGT (copertura_completa)
LIM_SNAP = 8.0    # a LIM_COM piece whose two ends lie within this of an OSM boundary line replaces that stretch of it


def _parts(g):
    if g is None or g.is_empty: return []
    if g.geom_type in ('Polygon', 'LineString', 'Point'): return [g]
    return [p for p in g.geoms for p in _parts(p)]


def _link(x, z): return '?x=%.0f&z=%.0f' % (x, z)


def _pct(a, ps=(50, 90, 99)):
    a = np.asarray(a, float)
    if not len(a): return None
    out = {('p%d' % p): round(float(np.percentile(a, p)), 2) for p in ps}; out['max'] = round(float(a.max()), 2); out['n'] = int(len(a)); return out


def leggi(gpkg):
    """the railway layers and the comune boundary, game metres"""
    con = sqlite3.connect(gpkg); tr = ds._tr(); D = {}

    def rows(sql):
        try: return con.execute(sql).fetchall()
        except sqlite3.OperationalError: return []

    def g2(blob):
        g = dq._geom(blob); return shapely.transform(shapely.force_2d(g), lambda c: ds._game(tr, c))
    fer = []
    for row in rows('select Shape, OBJECTID, EL_FER_SED, EL_FER_LIV, EL_FER_POS from EL_FER_EL_FER_TRA_SG'):
        if row[0] is None: continue
        g = dq._geom(row[0])
        for part in getattr(g, 'geoms', [g]):
            c = np.asarray(part.coords)
            if len(c) < 2: continue
            xy = ds._game(tr, c[:, :2]); z = c[:, 2] if c.shape[1] > 2 else np.full(len(c), np.nan)
            keep = np.r_[True, np.hypot(*np.diff(xy, axis=0).T) > 0.01]
            if keep.sum() >= 2: fer.append(dict(xy=xy[keep], z=z[keep], id=row[1], sed=row[2], liv=row[3], pos=row[4]))
    D['fer'] = fer
    D['sd'] = []
    for row in rows('select Shape, OBJECTID, SD_FER_SED from SD_FER_SD_FER_SUP_SR'):
        if row[0] is None: continue
        g = g2(row[0])
        if not g.is_valid: g = g.buffer(0)
        D['sd'] += [(p, dict(id=row[1], sed=row[2])) for p in _parts(g) if p.geom_type == 'Polygon' and p.area > 0.05]
    D['gz'] = [g2(r[0]) for r in rows('select Shape from GZ_FER') if r[0] is not None]
    D['sv'] = [p for r in rows('select Shape from SV_FER') if r[0] is not None for p in _parts(g2(r[0]))]
    D['pl'] = [p for r in rows("select Shape from AC_VEI_AC_VEI_SUP_SR where AC_VEI_ZON = '0104'") if r[0] is not None for p in _parts(g2(r[0]).buffer(0))]
    D['lim'] = [p for r in rows('select Shape from LIM_COM') if r[0] is not None for p in _parts(g2(r[0])) if p.geom_type == 'LineString']
    return D


class Ferrovia:
    """the railway and the comune boundaries of the comuni with a DBGT, for build_data.py"""

    def __init__(s, gpkgs, cover, log=print):
        t0 = time.time(); s.log = log; s.cover = cover; shapely.prepare(cover); s.rep = {}
        D = None; s.lim = {}; s.dirs = {}
        for f in gpkgs:
            d = leggi(f); k = os.path.basename(os.path.dirname(os.path.abspath(f))); s.lim[k] = d['lim']; s.dirs[k] = os.path.dirname(os.path.abspath(f))
            if D is None: D = d
            else:
                for k in D: D[k] += d[k]
        s.misura = cover.buffer(-12)   # the drawn tracks are measured off the comune edge (EL_FER ends on the boundary)
        s.D = D
        s.rete = ds.Rete(D['fer']) if D['fer'] else None
        s.assi_L = [LineString(a['xy']) for a in D['fer']]
        s.T_assi = STRtree(s.assi_L) if s.assi_L else None
        s.sede = [g for g, a in D['sd'] if a['sed'] in ('01', None)]       # a raso: on the bridges the deck is drawn
        s.U_sede = unary_union(s.sede) if s.sede else GeometryCollection()
        s.U_pl = unary_union(D['pl']) if D['pl'] else GeometryCollection()
        log('dbgt ferrovia: strati letti in %.1f s, assi EL_FER %d (%.0f m), sedi SD_FER %d (%.0f m2 a raso), giunzioni GZ_FER %d, passaggi a livello AC_VEI 0104 %d, limiti LIM_COM %d (%.0f m)' % (
            time.time() - t0, len(D['fer']), sum(l.length for l in s.assi_L), len(D['sd']), s.U_sede.area, len(D['gz']), len(D['pl']), len(D['lim']), sum(l.length for l in D['lim'])))

    # ---- distance of a set of lines from the axes, every 1 m inside the cover
    def scarto(s, lines):
        d = []
        for L in lines:
            Li = L.intersection(s.misura)
            for part in _parts(Li):
                if part.geom_type != 'LineString' or part.length < 1: continue
                pts = shapely.points(np.array([part.interpolate(t).coords[0] for t in np.arange(0, part.length, 1.0)]))
                j, dd = s.T_assi.query_nearest(pts, return_distance=True, all_matches=False)
                d += list(dd)
        return d

    # ---- 1. the axes
    def assi(s, rail_raw, nodes, raw_roads, ntags):
        """moves the OSM rail ways inside the cover onto EL_FER, in place; appends the EL_FER stretches no OSM way runs on to rail_raw ('x')"""
        t0 = time.time(); rep = {}; rt = s.rete
        if rt is None: return rep
        cnt = [0]
        def new_id(): cnt[0] += 1; return 'fer%d' % cnt[0]
        lines0 = [LineString([nodes[n_] for n_ in rr['refs']]) for rr in rail_raw]
        d0 = s.scarto(lines0)
        res = {}
        for wi, rr in enumerate(rail_raw):
            xy = np.array([nodes[n_] for n_ in rr['refs']])
            inside = shapely.contains_xy(s.cover, xy[:, 0], xy[:, 1])
            if not inside.any(): continue
            P, V, M = ds.viterbi(rt, xy, D_FREE)
            Pin = shapely.contains_xy(s.cover, P[:, 0], P[:, 1])
            res[wi] = (P, V, [m if ok else None for m, ok in zip(M, Pin)])
        sk = {wi: {vi: k for k, vi in enumerate(V) if vi >= 0} for wi, (P, V, M) in res.items()}
        # where each node goes: its matched point; a node shared by rail ways (a switch, the joint of two ways) the junction of EL_FER their
        # elements have in common, else the mean
        pos = defaultdict(list)
        for wi, (P, V, M) in res.items():
            for k, vi in enumerate(V):
                if vi >= 0 and M[k] is not None: pos[rail_raw[wi]['refs'][vi]].append((wi, k))
        newpos = {}; njun = 0
        for n_, lst in pos.items():
            ms = [res[w][2][k] for w, k in lst]
            if len(lst) > 1 and len({m[0] for m in ms}) > 1:
                common = None
                for m in ms:
                    e = m[0]; ends = {rt.e0[e], rt.e1[e]}; common = ends if common is None else common & ends
                if common:
                    o = np.array(nodes[n_]); u = min(common, key=lambda u: np.hypot(*(rt.P[u] - o)))
                    if np.hypot(*(rt.P[u] - o)) < 10:
                        for (w, k), m in zip(lst, ms):
                            e = m[0]; res[w][2][k] = (e, 0.0 if rt.e0[e] == u else rt.len[e], m[2], rt.P[u])
                        newpos[n_] = rt.P[u]; njun += 1; continue
            newpos[n_] = np.mean([m[3] for m in ms], 0)
        # level crossings: a node of a rail way that a road way uses too goes where the road (on its EL_STR axis) crosses the track
        road_of = defaultdict(list)
        for ri, r in enumerate(raw_roads):
            for i, n_ in enumerate(r['refs']): road_of[n_].append((ri, i))
        nlx = 0; s.lx = []
        for n_, lst in pos.items():
            if n_ not in road_of: continue
            w, k = lst[0]; m = res[w][2][k]; e = m[0]; A = s.assi_L[e]; o = Point(nodes[n_]); best = None
            for ri, i in road_of[n_]:
                refs = raw_roads[ri]['refs']; seg = [nodes[refs[j]] for j in range(max(0, i - 1), min(len(refs), i + 2))]
                if len(seg) < 2: continue
                x = LineString(seg).intersection(A)
                for p in _parts(x):
                    if p.geom_type == 'Point' and (best is None or p.distance(o) < best.distance(o)): best = p
            if best is None: best = A.interpolate(A.project(o))
            if best.distance(o) > 6: continue
            t = A.project(best)
            for w2, k2 in lst:
                m2 = res[w2][2][k2]
                if m2[0] == e: res[w2][2][k2] = (e, t, m2[2], np.array(best.coords[0]))
            newpos[n_] = np.array(best.coords[0]); nlx += 1; s.lx.append((best.x, best.y, n_, ntags.get(n_, {}).get('railway')))
        rep['passaggi_a_livello_osm_sugli_assi'] = nlx
        # the new polylines: between two consecutive nodes the route along the matched axes
        nnew = 0; cov = defaultdict(list)
        for wi, (P, V, M) in res.items():
            rr = rail_raw[wi]; refs = rr['refs']; vk = sk[wi]; out = [refs[0]]
            for k, m in enumerate(M):
                if m is not None: cov[m[0]].append(m[1])
            for i in range(len(refs) - 1):
                ka, kb = vk[i], vk[i + 1]; seg = []
                ok = all(M[k] is not None for k in range(ka, kb + 1))
                run = (ka, kb)
                if not ok:   # a segment that leaves the cover (or the axes): along the axis as far as its matched samples go from the matched end
                    if M[ka] is not None:
                        k1 = ka
                        while k1 + 1 <= kb and M[k1 + 1] is not None: k1 += 1
                        run = (ka, k1)
                    elif M[kb] is not None:
                        k0 = kb
                        while k0 - 1 >= ka and M[k0 - 1] is not None: k0 -= 1
                        run = (k0, kb)
                    else: run = (ka, ka)
                    ok = run[1] - run[0] >= 1
                if ok:
                    for k in range(*run):
                        L, how = rt.route(M[k], M[k + 1])
                        if L == math.inf: ok = False; break
                        pts = rt.route_points(M[k], M[k + 1], how)
                        seg += pts[1:] if seg else pts
                        if how[0] == 'same': cov[M[k][0]] += list(np.linspace(M[k][1], M[k + 1][1], 5))
                        else:
                            u, v = how
                            for a_, b_ in zip(*(lambda ns: (ns[:-1], ns[1:]))(rt.path_nodes(u, v) or [u, v])):
                                ee = rt.edge_of[(min(a_, b_), max(a_, b_))]; cov[ee] += list(np.linspace(0, rt.len[ee], max(2, int(rt.len[ee] / 2))))
                            e1, t1 = M[k][0], M[k][1]; cov[e1] += list(np.linspace(t1, 0.0 if u == rt.e0[e1] else rt.len[e1], 5))
                            e2, t2 = M[k + 1][0], M[k + 1][1]; cov[e2] += list(np.linspace(0.0 if v == rt.e0[e2] else rt.len[e2], t2, 5))
                if ok and len(seg) >= 2:
                    cs = LineString(seg).simplify(0.03).coords
                    for p in cs[(1 if run[0] == ka else 0):(len(cs) - 1 if run[1] == kb else len(cs))]:
                        nid = new_id(); nodes[nid] = (float(p[0]), float(p[1])); out.append(nid); nnew += 1
                out.append(refs[i + 1])
            rr['refs'] = out; rr['dbgt'] = float(np.mean([m is not None for m in M]))
        moved = []
        for n_, p in newpos.items():
            moved.append(math.dist(nodes[n_], p)); nodes[n_] = (float(p[0]), float(p[1]))
        rep['vie_osm_abbinate'] = len(res); rep['nodi_spostati'] = len(newpos); rep['nodi_su_giunzione_el_fer'] = njun; rep['nodi_nuovi_lungo_gli_assi'] = nnew
        rep['spostamento_nodi_m'] = _pct(moved)
        # EL_FER stretches no OSM way runs on: tracks of their own (crossovers, sidings, station tracks), drawn, not for the trains
        nx = 0; mx = 0.0; s.x_pieces = []
        for e, a in enumerate(s.D['fer']):
            L = s.assi_L[e]; Le = rt.len[e]
            if not s.cover.intersects(L): continue
            ts = np.sort(np.array(cov.get(e, []), float)); free = []; prev = 0.0
            for t in list(ts) + [Le]:
                if t - prev > X_MIN + 2 * STEP_COV: free.append((prev + (STEP_COV if prev > 0 else 0), t - (STEP_COV if t < Le else 0)))
                prev = max(prev, t)
            for t0_, t1_ in free:
                if t1_ - t0_ < X_MIN: continue
                part = substring(L, t0_, t1_)
                if part.length < X_MIN: continue
                refs = []
                for p in part.coords:
                    nid = new_id(); nodes[nid] = (float(p[0]), float(p[1])); refs.append(nid)
                rail_raw.append({'refs': refs, 'bridge': a.get('sed') == '02', 'emb': False, 'layer': 0, 'wid': 'el_fer_%s' % a['id'], 't': {}, 'x': True, 'dbgt': 1.0})
                nx += 1; mx += part.length
        rep['binari_solo_dbgt'] = dict(n=nx, metri=round(mx))
        lines1 = [LineString([nodes[n_] for n_ in rr['refs']]) for rr in rail_raw if not rr.get('x')]
        d1 = s.scarto(lines1)
        rep['scarto_dagli_assi_el_fer_m'] = dict(prima=_pct(d0), dopo=_pct(d1), nota='binari OSM disegnati, ogni 1 m dentro il comune, dal piu vicino asse EL_FER')
        # how many tracks: parallel axes across the line every 25 m; switches: EL_FER junctions where three or more elements meet
        deg = rt.deg; rep['scambi'] = dict(giunzioni_el_fer_con_3_o_piu_elementi=int((deg >= 3).sum()), gz_fer=len(s.D['gz']))
        nb = Counter()
        for L in s.assi_L:
            for t in np.arange(10, L.length, 25):
                p = L.interpolate(t); a_ = L.interpolate(max(0, t - 1)); b_ = L.interpolate(min(L.length, t + 1)); ux, uz = b_.x - a_.x, b_.y - a_.y; l_ = math.hypot(ux, uz) or 1
                cut = LineString([(p.x + uz / l_ * 8, p.y - ux / l_ * 8), (p.x - uz / l_ * 8, p.y + ux / l_ * 8)])
                nb[sum(1 for j in s.T_assi.query(cut) if s.assi_L[j].intersects(cut))] += 1
        rep['binari_paralleli_ogni_25_m'] = dict(sorted(nb.items()))
        rep['tempo_s'] = round(time.time() - t0, 1)
        s.rep['assi'] = rep
        s.log('dbgt ferrovia: %s' % rep)
        return rep

    # ---- 2. what stands along the track
    def corridoio(s, corridor):
        """the railway land for the fences: the rail bed SD_FER inside the cover (a little wider), the buffer of the tracks outside"""
        if s.U_sede.is_empty: return corridor
        inner = s.cover.buffer(-1)
        return unary_union([corridor.difference(inner), s.U_sede.buffer(FENCE_OUT, join_style=2).intersection(inner)])

    def banchine(s, area_geoms, rail_lines):
        """platforms (area type 5) clear of the middle of every track by CLEAR: an OSM platform that runs over a track is cut back"""
        tracks = unary_union([l.buffer(CLEAR, cap_style=2) for l in rail_lines]) if rail_lines else GeometryCollection()
        out = []; ncut = 0; lost = 0.0
        for at, g in area_geoms:
            if at != 5 or not g.intersects(tracks) or not s.cover.intersects(g): out.append((at, g)); continue
            g2 = g.difference(tracks); lost += g.area - g2.area; ncut += 1
            for p in _parts(g2):
                if p.geom_type == 'Polygon' and p.area > 2: out.append((at, p))
        s.rep['banchine'] = dict(tagliate=ncut, m2_tolti=round(lost, 1), distanza_dal_mezzo_del_binario_m=CLEAR)
        return out

    def fuori_dalle_carreggiate(s, lines, carr):
        """fence lines minus the carriageways (with a margin)"""
        if not carr: return lines
        U = unary_union(carr); shapely.prepare(U); out = []; cut = 0
        for f in lines:
            L = LineString(f)
            if not U.intersects(L): out.append(f); continue
            cut += 1
            for p in _parts(L.difference(U)):
                if p.geom_type == 'LineString' and p.length > 2: out.append(list(p.coords))
        s.rep['recinzioni_tagliate_sulle_carreggiate'] = cut
        return out

    def via_dai_ponti(s, lines):
        """the railway fences of the corridor (the edge of the rail bed) not within PONTE_FENCE of a railway bridge: there the rail bed runs
        on over the street below (via Milano under PONTE 14) and the fence stood on the slopes of the cutting, hanging under the deck"""
        s.via_dai_binari([], [], '_')   # makes Z_ponti
        Z = s.Z_ponti.buffer(PONTE_FENCE).intersection(s.cover) if not s.Z_ponti.is_empty else None
        if Z is None: return lines
        out = []; nc = 0
        for f in lines:
            L = LineString(f)
            if not Z.intersects(L): out.append(f); continue
            nc += 1
            for p in _parts(L.difference(Z)):
                if p.geom_type == 'LineString' and p.length > 2: out.append(list(p.coords))
        s.rep['recinzioni_tolte_vicino_ai_ponti'] = nc
        return out

    def via_dai_binari(s, items, rail_lines, nome, get=lambda b: b, put=lambda b, pts: pts):
        """fences and walls that cross a track are opened over it (TRACK_CLEAR either side of the middle of the track): the corridor of the
        rail bed closes across the line at the ends of a bridge, and a few DBGT dividers run across the tracks at a level crossing"""
        ponti = getattr(s, 'Z_ponti', None)
        if ponti is None:   # the railway bridges of the DBGT: what crosses under them is not across the track
            s.Z_ponti = ponti = unary_union([g.buffer(1.0) for g, a in s.D['sd'] if a['sed'] == '02'] + [s.assi_L[e].buffer(3.0) for e, a in enumerate(s.D['fer']) if a.get('sed') == '02'])
        rail_lines = [p for l in rail_lines for p in _parts(l.difference(ponti) if not ponti.is_empty else l) if p.geom_type == 'LineString']
        T = STRtree(rail_lines) if rail_lines else None
        if T is None: return items
        out = []; nc = 0; lost = 0.0
        for b in items:
            pts = get(b)
            if len(pts) < 2: out.append(b); continue
            L = LineString(pts); hit = [rail_lines[j] for j in T.query(L) if rail_lines[j].intersects(L)]
            if not hit: out.append(b); continue
            # only around the crossing points: a fence that also runs along the track nearer than TRACK_CLEAR keeps that stretch
            xs = [q for h in hit for q in _parts(h.intersection(L))]
            zona = unary_union([h.buffer(TRACK_CLEAR) for h in hit]).intersection(unary_union([q.buffer(3 * TRACK_CLEAR) for q in xs]))
            rest = L.difference(zona); nc += 1; lost += L.length - rest.length
            for p in _parts(rest):
                if p.geom_type == 'LineString' and p.length > 1.0: out.append(put(b, list(p.coords)))
        s.rep.setdefault('aperti_sui_binari', {})[nome] = dict(n=nc, metri=round(lost, 1))
        return out

    # ---- 3. the comune boundaries
    def confini(s, blines):
        """LIM_COM pieces of each DBGT spliced into the OSM boundary lines of its comune (the town signs). A piece whose two ends lie
        within LIM_SNAP of a boundary line replaces the stretch between their projections, but only if it agrees with the edge of the
        DBGT itself (copertura_completa of base_dbt_per_pianificazione.gpkg, which the Geoportale gives with every comune) within
        LIM_EDGE: at Meda LIM_COM and COMUNE are fragments (13 pieces, 1.46 km of a 14.6 km boundary, docs/portabilita.md) that run
        6-29 m inside both the OSM boundary and the edge of the DBGT, so they are not the boundary and OSM stays"""
        out = []; nrep = 0; mrep = 0.0; scarti = []; prova = []
        low = {}
        for k, v in s.lim.items():
            edge = s.bordo_dbgt(k); ok = []
            for P_ in v:
                d = max(edge.distance(Point(c)) for c in P_.coords) if edge is not None else None
                prova.append(dict(comune=k, metri=round(P_.length), dal_bordo_del_dbgt_max_m=None if d is None else round(d, 1)))
                if d is not None and d <= LIM_EDGE: ok.append(P_)
            low[k.lower()] = ok
        for L, names in blines:
            lims = [p for n_ in names for p in low.get(n_.lower(), [])]
            if not lims: out.append((L, names)); continue
            cur = L
            for P_ in lims:
                a, b = Point(P_.coords[0]), Point(P_.coords[-1])
                if cur.distance(a) > LIM_SNAP or cur.distance(b) > LIM_SNAP: continue
                ta, tb = cur.project(a), cur.project(b)
                piece = P_ if ta <= tb else LineString(P_.coords[::-1]); ta, tb = min(ta, tb), max(ta, tb)
                if tb - ta < 1: continue
                head = substring(cur, 0, ta); tail = substring(cur, tb, cur.length)
                cs = (list(head.coords) if head.length > 0 else [cur.coords[0]]) + list(piece.coords) + (list(tail.coords) if tail.length > 0 else [cur.coords[-1]])
                old = substring(cur, ta, tb)
                scarti += [old.distance(Point(c)) for c in piece.coords]
                cur = LineString(cs); nrep += 1; mrep += piece.length
            out.append((cur, names))
        s.rep['confini'] = dict(pezzi_lim_com=sum(len(v) for v in s.lim.values()), metri_lim_com=round(sum(l.length for v in s.lim.values() for l in v)), pezzi_usati=nrep, metri_usati=round(mrep),
                                scarto_da_osm_m=_pct(scarti), pezzi=prova, regola='un pezzo LIM_COM entra solo se sta entro %.0f m dal bordo del DBGT (copertura_completa); altrimenti OSM (confini_comuni.json)' % LIM_EDGE)
        s.log('dbgt ferrovia: confini %s' % s.rep['confini'])
        return out

    def bordo_dbgt(s, comune):
        """the outer edge of the DBGT of a comune: the union of copertura_completa (base_dbt_per_pianificazione.gpkg), its largest part"""
        f = os.path.join(s.dirs.get(comune, ''), 'base_dbt_per_pianificazione.gpkg')
        if not os.path.exists(f): return None
        con = sqlite3.connect(f); tr = ds._tr()
        try:
            col = con.execute("select column_name from gpkg_geometry_columns where table_name = 'copertura_completa'").fetchone()[0]
            gs = [shapely.transform(shapely.force_2d(dq._geom(r[0])), lambda c: ds._game(tr, c)).buffer(0) for r in con.execute('select "%s" from copertura_completa' % col) if r[0] is not None]
        except (sqlite3.OperationalError, TypeError): return None
        if not gs: return None
        U = unary_union(gs); P = max(_parts(U), key=lambda p: p.area)
        return P.exterior

    # ---- 4. tiles
    def disegno(s, rail_lines, cut):
        """the rail bed to draw: SD_FER a raso, and at least a 4.2 m strip along every track (2.1 m a side: two tracks 4 m apart meet) (between two tracks the DBGT may have
        something else, as the pedestrian area over the station underpass, AC_PED in galleria: it is not on the surface), less the streets,
        sidewalks, platforms and buildings (`cut`) and the bridges (their deck is drawn)"""
        ponti = [g.buffer(2.0) for g, a in s.D['sd'] if a['sed'] == '02'] + [s.assi_L[e].buffer(3.0) for e, a in enumerate(s.D['fer']) if a.get('sed') == '02']
        strip = unary_union([l.buffer(BED_HW, cap_style=2) for l in rail_lines]).intersection(s.cover) if rail_lines else GeometryCollection()
        U = unary_union([s.U_sede, strip]).difference(cut).difference(unary_union(ponti) if ponti else GeometryCollection())
        s.U_draw = U.buffer(-0.05).buffer(0.05)
        s.rep['massicciata'] = dict(sd_fer_a_raso_m2=round(s.U_sede.area), disegnata_m2=round(s.U_draw.area), aggiunta_lungo_i_binari_m2=round(s.U_draw.difference(s.U_sede).area))

    def push_tiles(s, ntiles, tbox, polys_of, push):
        """the rail bed a raso (sf) in the tiles"""
        P = [p for p in _parts(getattr(s, 'U_draw', s.U_sede).intersection(s.cover.buffer(20))) if p.geom_type == 'Polygon']
        T = STRtree(P) if P else None
        if T is None: return
        for t in range(ntiles):
            bx = tbox(t); idx = T.query(bx)
            if not len(idx): continue
            c = unary_union([P[i].intersection(bx) for i in idx])
            for p_ in polys_of(c, 0.1, 0.3): push(t, 'sf', p_)

    # ---- 5. checks
    def controlli(s, trains, platforms, buildings, carr, cartelli):
        """the trains (their path, a 2.9 m box along it) against platforms, buildings and carriageways (but at the level crossings);
        the town signs"""
        t0 = time.time(); rep = {}; C = s.cover
        pl = unary_union([g for g in platforms]) if platforms else GeometryCollection()
        bu = unary_union([g for g in buildings if g is not None]) if buildings else GeometryCollection()
        lxz = unary_union([Point(x, z).buffer(14) for x, z, *_ in s.lx] + ([s.U_pl.buffer(2)] if not s.U_pl.is_empty else []))
        # a street over the train (EL_FER in sottopasso) or under it (EL_FER or SD_FER on a bridge) is not crossed
        sopra_sotto = unary_union([s.assi_L[e].buffer(4.0) for e, a in enumerate(s.D['fer']) if a.get('sed') == '02' or a.get('liv') == '01'] + [g.buffer(2.0) for g, a in s.D['sd'] if a['sed'] == '02'])
        ca = unary_union(carr).difference(lxz).difference(sopra_sotto) if carr else GeometryCollection()
        for g in (pl, bu, ca): shapely.prepare(g)
        out = []
        for ti, t in enumerate(trains):
            L = LineString(t['pts']); Li = L.intersection(C)
            if Li.length < 1: continue
            r = dict(treno=ti, stazioni=t.get('stn'), metri_nel_comune=round(Li.length))
            for nm, g in (('banchine', pl), ('edifici', bu), ('carreggiate', ca)):
                band = Li.buffer(1.45, cap_style=2); x = band.intersection(g) if not g.is_empty else GeometryCollection()
                r[nm + '_m2'] = round(x.area, 1); r[nm + '_dove'] = [_link(p.representative_point().x, p.representative_point().y) for p in _parts(x) if p.area > 0.05][:8]
            out.append(r)
        rep['treni'] = out
        # level crossings: DBGT areas against the OSM nodes moved on the axes
        rep['passaggi_a_livello'] = dict(dbgt_ac_vei_0104=len(s.D['pl']), osm_sugli_assi=len(s.lx), osm_dentro_un_area_dbgt=sum(1 for x, z, *_ in s.lx if s.U_pl.buffer(1).contains(Point(x, z))),
                                        elenco=[_link(x, z) for x, z, *_ in s.lx])
        rep['cartelli_di_paese'] = dict(n=len(cartelli))
        rep['tempo_s'] = round(time.time() - t0, 1)
        s.rep['controlli'] = rep
        s.log('dbgt ferrovia: controlli %s' % {k: v for k, v in rep.items() if k != 'treni'})
        for r in out: s.log('   treno', {k: v for k, v in r.items()})
        return s.rep

    def sintesi(s):
        a = s.rep.get('assi', {}); c = s.rep.get('controlli', {})
        return dict(scarto_dagli_assi_el_fer_m=a.get('scarto_dagli_assi_el_fer_m'), binari_solo_dbgt=a.get('binari_solo_dbgt'), passaggi_a_livello=a.get('passaggi_a_livello_osm_sugli_assi'),
                    banchine=s.rep.get('banchine'), confini=s.rep.get('confini'), treni=[{k: v for k, v in r.items() if not k.endswith('_dove')} for r in c.get('treni', [])])


PONTE_FENCE = 8.0 # no corridor fence this near a railway bridge of the DBGT
TRACK_CLEAR = 2.3 # no fence or wall nearer than this to the middle of a track it crosses (the train is 2.9 m wide)
BED_HW = 2.1      # the drawn rail bed at least this far either side of a track (the old ballast strip)
STEP_COV = 2.0    # the coverage of an element is known every few metres: a free stretch is trimmed by this at each end
