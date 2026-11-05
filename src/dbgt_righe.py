# Le righe della carreggiata dal DBGT (docs/motore.md 7, "righe"). Inside a comune with a DBGT the road markings are drawn from the edges of
# the carriageway AC_VEI, not from the OSM axes: the axes, moved onto EL_STR by the map matching, zigzag across it (Carlo 25/10, the
# Milano-Meda junction of via Vignazzola: "le righe vanno per i cazzi loro"; the game put the dashes on each OSM axis, two one-way ways
# OSM draws on a carriageway the DBGT has as one, bends up to 54 degrees where the nodes were snapped to the axes).
#   - the carriageways: the EL_STR axes joined end to end where they go on (through a junction where a ramp leaves: the pair that goes on
#     best), the longest first. OSM says what runs on them: the ways matched on EL_STR of class 0-2 (lanes, oneway, class)
#   - each carriageway gets a reference line: the middle of its ordinary carriageway (AC_VEI 01, 0101-0105; on a bridge SED 02 and at grade
#     past its ends as one) measured across the axis every metre, smoothed; across that line every metre again: the two edges (on the raster,
#     then exactly on the boundary of the same union), smoothed over 5 m (LISCIA, held on the asphalt: _liscia). An edge that opens (the mouth of a side street,
#     a ramp leaving or joining: more than 0.6 m past the opening from below over 61 m of its distances) is carried across from where it runs
#   - the ways in a cross section are the OSM axes crossing it alongside; its lanes are their OSM lanes (one-way without lanes: 1; two-way:
#     lanes:forward/backward, lanes, else 1 + 1), each the same share of the width between the edges; between two lanes of one way a dashed
#     line, between the two directions a centre line (continuous with 4 lanes or more, or between two ways OSM draws apart; dashed
#     otherwise) on the EL_STR axis, the middle of the carriageway for the DBGT, when it is near the share of the lanes. Each line keeps its
#     place by name (C, L1, R1...) where the lanes change; where it jumps or the carriageway widens it goes across from where it is sure
#     before to where it is sure after (SALTO, ALLARGA). Edge lines 0.35 m inside the edge on the streets of class
#     0-1 (primary to tertiary and the ramps), where that edge runs on; the DBGT does not say which streets have them, the residential ones get
#     none (the game had none)
#   - the roundabouts (AC_VEI 0206): edge lines round the ring and its islands, not across the mouths of the arms
#   - a cross section is drawn by the first carriageway whose axis is in it, and a piece of a line within 1 m of one drawn before is left out
# Out: lines [{ri, t: 0 edge 1 centre 2 dashed, p: [(x, z)...], lev: 1 on S, 2 on a bridge}] and the report; the game draws them
# (world3.js, tiles[t].sg) and leaves out the old dashes on the axes of the streets that have them (roads[].sg).
import math
from collections import defaultdict, Counter
import numpy as np, shapely
from shapely.geometry import LineString
from shapely.ops import unary_union
from dbgt_strade import _parts
from shapely.strtree import STRtree
from scipy.ndimage import gaussian_filter1d, median_filter, minimum_filter1d, maximum_filter1d

TRONCO = ('01', '0101', '0102', '0103', '0105')
INCROCIO = '0205'   # the junction areas: the lines run through them along the carriageway, not across the streets that cross it (Carlo 3/11:
                    # corso Isonzo at x 305 z 1988 and via Montecassino at both mouths of the trench lie in junction areas 30-50 m long, and had no line)
TRONCO_R = TRONCO + (INCROCIO,)
BORDO = 0.35        # edge lines this far inside the edge of the carriageway (centre of a 0.15 m line)
PASSO = 1.0         # samples along a stroke
RMAX = 20.0         # rays across the carriageway
GAP = 25           # the lines go on where both edges open for up to this many metres
LANE_MIN = 2.4      # narrower lanes are merged
LISCIA = 5.0        # the edges and the lines between the lanes smoothed over this (gaussian sigma, m): the boundary of AC_VEI has vertices
                    # off its curve by 0.5-0.85 m (Carlo 26/10, the ramp of the Milano-Meda at x 48 z 422), with 2 m the lines copied them
DENTRO = 0.2        # an edge smoothed out past the edge measured by more than this is held back: the edge line stays 0.15 m on the asphalt
ALLARGA = 0.05      # the carriageway widening (or narrowing) by more than this per metre: the lines go across it from where it does not
ALLARGA_MAX = 40    # over at most this many metres
SALTO = 12          # a line that jumps across goes over from this many metres before the jump to as many after


def _resample(xy, step):
    """the polyline at a step along its length"""
    d = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
    if d[-1] < step: return xy[[0, -1]], d[[0, -1]]
    s = np.linspace(0, d[-1], int(round(d[-1] / step)) + 1)
    return np.column_stack((np.interp(s, d, xy[:, 0]), np.interp(s, d, xy[:, 1]))), s


def _normals(xy):
    t = np.gradient(xy, axis=0); L = np.hypot(t[:, 0], t[:, 1]); L[L < 1e-9] = 1; t = t / L[:, None]
    return t, np.column_stack((-t[:, 1], t[:, 0]))   # (-uz, ux): the right of the way (x east, z south), as world3.js edgePts


def _runs(mask, minlen=1):
    """[(i0, i1)) runs of True at least minlen long"""
    out = []; i = 0; n = len(mask)
    while i < n:
        if not mask[i]: i += 1; continue
        j = i
        while j < n and mask[j]: j += 1
        if j - i >= minlen: out.append((i, j))
        i = j
    return out


def _fill_gaps(mask, gap):
    """False runs shorter than gap between True samples become True"""
    m = mask.copy(); n = len(m); i = 0
    while i < n:
        if m[i]: i += 1; continue
        j = i
        while j < n and not m[j]: j += 1
        if i > 0 and j < n and j - i <= gap: m[i:j] = True
        i = j
    return m


def _morbida(p, lim=10.0):
    """a line through a tight corner (a turn over lim degrees from one metre to the next): Chaikin's corner cutting, twice, so it turns
    in steps of a few degrees, within a few centimetres of where it was"""
    p = np.asarray(p, float)
    for _ in range(2):
        if len(p) < 3 or _bends(p).max() <= lim: break
        q = np.empty((2 * (len(p) - 1), 2)); q[0::2] = 0.75 * p[:-1] + 0.25 * p[1:]; q[1::2] = 0.25 * p[:-1] + 0.75 * p[1:]
        p = np.vstack((p[:1], q, p[-1:]))
    return p


def _bends(p):
    """the turns between consecutive segments of a polyline (degrees)"""
    p = np.asarray(p, float)
    if len(p) < 3: return np.zeros(0)
    d = np.diff(p, axis=0); a = np.arctan2(d[:, 1], d[:, 0]); t = np.abs((np.diff(a) + np.pi) % (2 * np.pi) - np.pi)
    return np.degrees(t)


def _liscia(d, sig=LISCIA, lim=None):
    """d smoothed (a running median over 2 sigma, then gaussian sigma), held under lim (the edges: under the edge measured + DENTRO) by
    smoothing again what is under it, a few times, so the line stays on the asphalt and smooth"""
    e = gaussian_filter1d(median_filter(d, 2 * int(sig) + 1, mode='nearest'), sig, mode='nearest')
    if lim is None: return e
    for _ in range(4):
        if (e <= lim + 0.02).all(): break
        e = gaussian_filter1d(np.minimum(e, lim), sig / 2, mode='nearest')
    return np.minimum(e, lim + 0.02)


def corsie(r):
    """(lanes with the way, lanes against it) from OSM"""
    ln = r.get('ln') or (None, None, None)
    n, nf, nb = [int(v) if v and v >= 1 else None for v in ln]
    if r['o']: return (min(n or nf or 1, 4), 0)
    if nf and nb: return (min(nf, 3), min(nb, 3))
    if n and n >= 2: return (min((n + 1) // 2, 3), min(n // 2, 3))
    return (1, 1)


def _chains(ids, nxt):
    """walk the joins nxt[(id, end)] = (id2, end2) into chains [(id, reversed)]"""
    seen = set(); out = []
    for i in ids:
        if i in seen: continue
        cur, rev = i, False; guard = 0
        while guard < 2000:   # back to the start of the chain
            k = nxt.get((cur, 1 if rev else 0))
            if k is None or k[0] in seen or k[0] == i: break
            cur, rev = k[0], k[1] == 0; guard += 1
        chain = []; c, rv = cur, rev
        while c is not None and c not in seen:
            seen.add(c); chain.append((c, rv))
            k = nxt.get((c, 0 if rv else 1))
            if k is None: break
            c, rv = k[0], k[1] == 1
        out.append(chain)
    return out


def strokes(els):
    """the EL_STR elements joined into carriageways: two at a node go on (up to 60 degrees), at a junction the pair that goes on best
    (up to 30 degrees): the main carriageway runs through the node where a ramp leaves it"""
    key = lambda p: (int(round(p[0] * 20)), int(round(p[1] * 20)))
    ends = defaultdict(list)
    for i, e in enumerate(els): ends[key(e['xy'][0])].append((i, 0)); ends[key(e['xy'][-1])].append((i, 1))
    def dirin(i, end):   # the direction along element i into the node at its end
        xy = els[i]['xy']; a, b = (xy[-2], xy[-1]) if end else (xy[1], xy[0]); v = np.subtract(b, a); return v / (np.hypot(*v) or 1)
    nxt = {}
    for l in ends.values():
        if len(l) < 2: continue
        cand = []
        for p in range(len(l)):
            for q in range(p + 1, len(l)):
                (a, ea), (b, eb) = l[p], l[q]
                if a != b: cand.append((float(np.dot(dirin(a, ea), -dirin(b, eb))), p, q))
        cand.sort(reverse=True); used = set()
        for c, p, q in cand:
            if p in used or q in used or c < math.cos(math.radians(60 if len(l) == 2 else 30)): continue
            used |= {p, q}; nxt[l[p]] = l[q]; nxt[l[q]] = l[p]
    return _chains(range(len(els)), nxt)


def righe(STR, raw_roads, nodes, log=print):
    R = STR.R; D = STR.D
    lev = lambda a: 1 if a.get('sed') in ('01', None) else 2
    TRs = {1: R.draw([g for g, a in D['vei'] if a['zon'] in TRONCO_R and lev(a) == 1]), 2: R.draw([g for g, a in D['vei'] if a['zon'] in TRONCO_R and lev(a) == 2])}
    TRs[3] = TRs[1] | TRs[2]
    # the edges exactly: the raster finds the edge within half a metre and leans outwards (edge lines 0.1-0.4 m past the edge), the
    # segments of the boundary of the same union give the distance along the ray
    def bordi(polys):
        segs_ = []
        for p in _parts(unary_union(polys)):
            for ring in [p.exterior] + list(p.interiors):
                c = np.asarray(ring.coords); segs_.append(np.stack((c[:-1], c[1:]), 1))
        S_ = np.concatenate(segs_); return STRtree(shapely.linestrings(S_)), S_[:, 0], S_[:, 1]
    TB = {1: bordi([g for g, a in D['vei'] if a['zon'] in TRONCO_R and lev(a) == 1]), 3: bordi([g for g, a in D['vei'] if a['zon'] in TRONCO_R])}
    def esatto(tb, P, N, d0):
        tree, A, B = tb; d = d0.copy(); m = d0 < RMAX
        if not m.any(): return d
        idx = np.where(m)[0]; E = P[idx] + N[idx] * (d0[idx] + 1.0)[:, None]
        qi, qj = tree.query(shapely.linestrings(np.stack((P[idx], E), 1)), predicate='intersects')
        if not len(qi): return d
        n_ = N[idx][qi]; p = P[idx][qi]; a = A[qj]; e = B[qj] - a
        den = n_[:, 0] * e[:, 1] - n_[:, 1] * e[:, 0]; ok = np.abs(den) > 1e-9
        w = a - p; t = (w[:, 0] * e[:, 1] - w[:, 1] * e[:, 0]) / np.where(ok, den, 1)
        ok &= t > 0.02; best = np.full(len(idx), np.inf); np.minimum.at(best, qi[ok], t[ok])
        g = np.isfinite(best) & (np.abs(best - d0[idx]) < 1.0); d[idx[g]] = best[g]
        return d
    cover = STR.cover
    K = set(ri for ri, r in enumerate(raw_roads) if r['c'] <= 2 and r.get('dbgt') == 'str' and not r.get('pv') and not r['tunnel'] and len(r['refs']) >= 2)
    els = [e for e in D['str'] if e.get('ty') not in ('0307', '0301') and len(e['xy']) >= 2]
    ST = strokes(els)
    # the longer carriageway first: where a ramp runs in the same carriageway before it leaves, the main one draws the section
    ST.sort(key=lambda ch: -sum(LineString(els[i]['xy']).length for i, _ in ch))
    # the axes of the streets with traffic (who runs in a cross section, with its lanes) and of the carriageways (who draws it)
    segs, own, sdir = [], [], []
    for ri, r in enumerate(raw_roads):
        if r['c'] > 3 or r.get('pv') or r['tunnel'] or len(r['refs']) < 2: continue
        xy = np.array([nodes[n_] for n_ in r['refs']])
        for a, b in zip(xy[:-1], xy[1:]):
            L = math.hypot(*(b - a))
            if L > 0.05: segs.append((a, b)); own.append(ri); sdir.append((b - a) / L)
    SA = np.array([s_[0] for s_ in segs]); SB = np.array([s_[1] for s_ in segs]); own = np.array(own); sdir = np.array(sdir)
    TREE = STRtree(shapely.linestrings(np.stack((SA, SB), 1)))
    esegs, eown, edir = [], [], []
    for k, ch in enumerate(ST):
        for i, _ in ch:
            xy = els[i]['xy']
            for a, b in zip(xy[:-1], xy[1:]):
                L = math.hypot(*(b - a))
                if L > 0.05: esegs.append((a, b)); eown.append(k); edir.append((b - a) / L)
    EA = np.array([s_[0] for s_ in esegs]); EB = np.array([s_[1] for s_ in esegs]); eown = np.array(eown); edir = np.array(edir)
    ETREE = STRtree(shapely.linestrings(np.stack((EA, EB), 1)))
    def crossing(tree, A_, B_, Tq, Nq, Q, SA_, SB_, dirs):
        """the segments crossing each section A_-B_ running alongside (|cos| over 0.8): (section, segment, offset along the normal, sign)"""
        qi, qj = tree.query(shapely.linestrings(np.stack((A_, B_), 1)), predicate='intersects')
        if not len(qi): return []
        cs = (dirs[qj] * Tq[qi]).sum(1); keep = np.abs(cs) > 0.8; qi, qj, cs = qi[keep], qj[keep], cs[keep]
        a, d = SA_[qj], SB_[qj] - SA_[qj]; n_ = Nq[qi]; p = Q[qi]
        den = n_[:, 0] * d[:, 1] - n_[:, 1] * d[:, 0]; okd = np.abs(den) > 1e-6
        w_ = a - p; t_ = (w_[:, 0] * d[:, 1] - w_[:, 1] * d[:, 0]) / np.where(okd, den, 1)
        return list(zip(qi[okd], qj[okd], t_[okd], np.where(cs[okd] > 0, 1, -1)))

    lines = []; nsez = 0; nlead = 0; with_lines = set()
    for k, ch in enumerate(ST):
        pts, sed = [], []
        for i, rv in ch:
            xy = list(map(tuple, els[i]['xy']))
            if rv: xy = xy[::-1]
            if pts: xy = xy[1:]
            pts += xy; sed += [els[i].get('sed') == '02'] * len(xy)
        xy = np.array(pts, float)
        d0 = np.r_[0, np.cumsum(np.hypot(*np.diff(xy, axis=0).T))]
        if d0[-1] < 8: continue
        P, s = _resample(xy, PASSO); T, N = _normals(P)
        br = np.array(sed)[np.clip(np.searchsorted(d0, s, side='right') - 1, 0, len(sed) - 1)]   # on a bridge
        up = maximum_filter1d(br.astype(np.uint8), 61, mode='nearest').astype(bool)   # and 30 m either side: the rays cross from the bridge to the street at grade
        inc = shapely.contains_xy(cover, P[:, 0], P[:, 1])
        if not inc.any(): continue
        def across(P, N, up, up2=None):
            # a street on a bridge runs on the bridge's carriageway (SED 02) and on its own at grade before and after it, as one: its rays
            # cross from one to the other (the edge of the bridge at the abutment is not an edge of the street); one at grade only on its own
            lv = np.where(up & R.at(TRs[2], P[:, 0], P[:, 1]) & (up2 if up2 is not None else up), 2, 1)
            dr = np.full(len(P), RMAX); dl = np.full(len(P), RMAX); inm = np.zeros(len(P), bool)
            for u_, M in ((True, TRs[3]), (False, TRs[1])):
                m = up == u_
                if not m.any(): continue
                inm[m] = R.at(M, P[m, 0], P[m, 1]); tb = TB[3 if u_ else 1]
                dr[m] = esatto(tb, P[m], N[m], R.ray(M, P[m], N[m], RMAX)); dl[m] = esatto(tb, P[m], -N[m], R.ray(M, P[m], -N[m], RMAX))
            return dl, dr, inm, lv
        def edges(P, N, up, inc, up2=None):
            """the distance to each edge across (smoothed), where that edge runs on (not at the mouth of a side street, not where a ramp
            opens or merges: an edge more than 0.6 m beyond the opening from below over 61 m of its distances), the level"""
            dl, dr, inm, lv = across(P, N, up, up2); n = len(P); ok = inm & inc; out = []
            for d in (dl, dr):
                good = ok & (d < RMAX)
                if good.sum() < 4: return None
                f = median_filter(np.interp(np.arange(n), np.where(good)[0], d[good]), 5, mode='nearest')
                base = maximum_filter1d(minimum_filter1d(f, 61, mode='nearest'), 61, mode='nearest')
                v = good & (d <= base + 0.6)
                if v.sum() < 4: return None
                ds = np.interp(np.arange(n), np.where(v)[0], d[v])
                out.append((_liscia(ds, LISCIA, ds + DENTRO), v))
            (dls, vl), (drs, vr) = out
            return dls, drs, vl, vr, ok & (vl | vr) & (dls + drs >= 2.4), lv, ok
        # 1. the reference: the middle of the carriageway across the OSM axis, smoothed
        e = edges(P, N, up, inc, br)
        if e is None: continue
        dls, drs, _, _, ok, _, inm = e
        if ok.sum() < 6: continue
        C = P + N * ((drs - dls) / 2)[:, None]
        refs = []
        for i0, i1 in _runs(_fill_gaps(ok, GAP) & inm, 6):   # across up to GAP m where both edges open (a ramp leaves on one side, another joins on the other), in the carriageway
            idx = np.arange(i0, i1); good = ok[idx]
            if good.sum() < 4: continue
            cx = np.interp(idx, idx[good], C[idx[good], 0]); cz = np.interp(idx, idx[good], C[idx[good], 1])
            # a robust middle: the running median over 9 m first, then gaussian 3 m
            cx = gaussian_filter1d(median_filter(cx, 9, mode='nearest'), 3, mode='nearest'); cz = gaussian_filter1d(median_filter(cz, 9, mode='nearest'), 3, mode='nearest')
            Q, qs = _resample(np.column_stack((cx, cz)), PASSO)
            if len(Q) < 6: continue
            # the way and the level at each sample of the reference: from the nearest sample of the axis
            j = np.clip(np.round(np.interp(qs, np.r_[0, np.cumsum(np.hypot(*np.diff(np.column_stack((cx, cz)), axis=0).T))], idx - i0)).astype(int) + i0, i0, i1 - 1)
            refs.append((Q, br[j], up[j], inc[j]))
        for Q, qbr, qup, qinc in refs:
            Tq, Nq = _normals(Q)
            e = edges(Q, Nq, qup, qinc, qbr)
            if e is None: continue
            dls, drs, vl, vr, valid, lv, inm = e
            n = len(Q)
            if valid.sum() < 6: continue
            Ws = dls + drs
            valid = _fill_gaps(valid, GAP) & inm
            # 3. who runs in each cross section: the axes crossing it running alongside (|cos| over 0.8)
            secs = [dict() for _ in range(n)]; lead = np.full(n, k)
            A_ = Q - Nq * (dls + 2.5)[:, None]; B_ = Q + Nq * (drs + 2.5)[:, None]   # 2.5 m past the edges: an OSM axis can run along the edge, or past it where the edge opened
            for i_, j_, t__, sg in crossing(TREE, A_, B_, Tq, Nq, Q, SA, SB, sdir):
                o_ = own[j_]
                if o_ not in secs[i_] or abs(t__) < abs(secs[i_][o_][0]): secs[i_][o_] = (t__, sg)
            for i_, j_, t__, sg in crossing(ETREE, Q - Nq * dls[:, None], Q + Nq * drs[:, None], Tq, Nq, Q, EA, EB, edir): lead[i_] = min(lead[i_], eown[j_])
            # 4. the lanes of each section, left to right, and the lines between them
            sig = []; lanes_at = []
            for i in range(n):
                sc = secs[i]
                if lead[i] < k or not any(o_ in K for o_ in sc): sig.append(None); lanes_at.append(None); continue   # another carriageway axis draws it; no street of ours in it
                seq = []   # (t, [+1/-1 lanes left to right], way)
                for o_, (t__, sg) in sc.items():
                    f, b = corsie(raw_roads[o_])
                    if sg < 0: f, b = b, f
                    seq.append((t__, [-1] * b + [1] * f, o_))
                seq.sort(); L = [x for _, l_, _ in seq for x in l_]; ways = [o_ for _, l_, o_ in seq for _ in l_]
                W_ = Ws[i]
                if W_ / len(L) < LANE_MIN:   # too narrow for all: one lane each way
                    L2, w2 = [], []
                    for x, o_ in zip(L, ways):
                        if not L2 or L2[-1] != x: L2.append(x); w2.append(o_)
                    L, ways = L2, w2
                if W_ / len(L) < 2.5: L, ways = [L[0]], [ways[0]]   # one lane, no centre line
                kinds = []   # between two lanes: C1 continuous centre line, C2 dashed centre line, S dashed between two lanes of one way
                for j in range(1, len(L)):
                    if L[j] != L[j - 1]: kinds.append('C1' if (len(L) >= 4 or ways[j] != ways[j - 1]) else 'C2')
                    else: kinds.append('S')
                bordi = any(raw_roads[o_]['c'] <= 1 for o_ in sc)
                sig.append((len(L), tuple(kinds), bordi)); lanes_at.append(L)
            # the structure of a section, voted over 9 samples (a way seen in one section and not in the next one cut the lines)
            sig2 = list(sig)
            for i in range(n):
                w = [x for x in sig[max(0, i - 4):i + 5] if x is not None]
                if sig[i] is None or not w: continue
                c_ = Counter(w).most_common(1)[0]
                if c_[1] > len([x for x in sig[max(0, i - 4):i + 5]]) // 2: sig2[i] = c_[0]
            sig = sig2
            nsez += n; nlead += sum(1 for x in sig if x is not None)
            lvq = lv
            def way(i):   # the street nearest the middle of a section (the report)
                sc = secs[i]; return min(sc, key=lambda o_: abs(sc[o_][0])) if sc else -1
            for i in range(n):
                if sig[i] is not None: with_lines.update(o_ for o_ in secs[i] if o_ in K)
            def emit(ri_, t, idx, off):
                pts = Q[idx] + Nq[idx] * off[idx][:, None]
                # split where the level changes
                lvs = lvq[idx]; cut = [0] + [m for m in range(1, len(idx)) if lvs[m] != lvs[m - 1]] + [len(idx)]
                for a_, b_ in zip(cut[:-1], cut[1:]):
                    if b_ - a_ < 3: continue
                    q = _morbida(pts[a_:b_])
                    lines.append(dict(ri=int(ri_), t=t, p=[(round(float(x), 2), round(float(z), 2)) for x, z in q], lev=int(lvs[a_])))
            # edges: where the edge runs on and the section has them
            has = np.array([x is not None and x[2] for x in sig])
            for nm, v, sgn in (('l', vl, -1), ('r', vr, 1)):
                m = has & _fill_gaps(v, 3) & valid
                off = (drs - BORDO) if sgn > 0 else -(dls - BORDO)
                for i0, i1 in _runs(m, 5): emit(way((i0 + i1) // 2), 0, np.arange(i0, i1), off)
            # centre and lane lines, each one followed by its place in the section: the centre line (C), the lines between the lanes of a way
            # counted from it (L1, L2... on its left, R1... on its right) or, on a one-way carriageway, from the left edge (D1...). Where the
            # lanes change (a ramp joins) a line keeps its name and moves over 8 m or so instead of jumping (gaussian 4 m on its offset)
            ids = defaultdict(lambda: (np.full(n, np.nan), [''] * n))
            eline = LineString(xy); ep = shapely.line_interpolate_point(eline, shapely.line_locate_point(eline, shapely.points(Q)))
            eo = ((shapely.get_coordinates(ep) - Q) * Nq).sum(1)   # the EL_STR axis across the reference
            for i in range(n):
                if sig[i] is None or not valid[i] or sig[i][0] < 2: continue
                nL, kinds, _ = sig[i]
                cs = [j for j, kd in enumerate(kinds) if kd != 'S']; c0 = cs[0] if cs else None
                # the centre line on the EL_STR axis, the middle of the carriageway for the DBGT, when it is near the share of the lanes
                # (within a quarter of the width; a ramp joining in the section moved the share and the line with it)
                pos = [-dls[i] + Ws[i] * (j + 1) / nL for j in range(nL - 1)]
                if c0 is not None and len(cs) == 1 and abs(eo[i] - pos[c0]) < 0.25 * Ws[i] and -dls[i] + 1.5 < eo[i] < drs[i] - 1.5:
                    c = eo[i]; pos = [-dls[i] + (c + dls[i]) * (j + 1) / (c0 + 1) if j < c0 else c if j == c0 else c + (drs[i] - c) * (j - c0) / (nL - 1 - c0) for j in range(nL - 1)]
                for j, kd in enumerate(kinds):
                    nm = 'D%d' % (j + 1) if c0 is None else 'C' if j == c0 else ('L%d' % (c0 - j) if j < c0 else 'R%d' % (j - c0)) if kd == 'S' else 'C%d' % j
                    o, t_ = ids[nm]; o[i] = pos[j]; t_[i] = kd
            # where the carriageway widens or narrows (a ramp joins, a lane begins: more than ALLARGA per metre, over up to ALLARGA_MAX m) the
            # place of a line measured there moves with it; and where a line jumps (the lanes OSM gives change from one way to the next: the
            # centre line from the EL_STR axis to the share of the lanes and back, 3 m across). There the line goes across from where it is
            # sure before to where it is sure after, at least SALTO m either side of the jump (Carlo 26/10 at x 48 z 422: the centre line made
            # an S, jumping three times in 60 m where a ramp joins)
            wa = np.abs(np.gradient(Ws)) > ALLARGA; unsafe = np.zeros(n, bool)
            for i0, i1 in _runs(wa):
                if i1 - i0 <= ALLARGA_MAX: unsafe[max(0, i0 - 3):i1 + 3] = True
            for nm, (o, t_) in ids.items():
                m = _fill_gaps(~np.isnan(o), 8)
                for i0, i1 in _runs(m, 6):
                    idx = np.arange(i0, i1); g = ~np.isnan(o[idx]); og = o[idx][g]; jg = idx[g]
                    un = unsafe[idx].copy()
                    for q in np.where(np.abs(np.diff(og)) > 0.4)[0]:   # a jump between two samples where the line is
                        un[max(0, jg[q] - i0 - SALTO):jg[q + 1] - i0 + SALTO + 1] = True
                    gs = g & ~un
                    if gs.sum() >= 2: g = gs
                    oo = np.interp(idx, idx[g], o[idx][g]); oo = gaussian_filter1d(median_filter(oo, 5, mode='nearest'), 4.0, mode='nearest')
                    kd = Counter(x for x in t_[i0:i1] if x).most_common(1)[0][0]
                    off = np.zeros(n); off[idx] = oo
                    emit(way((i0 + i1) // 2), 1 if kd == 'C1' else 2, idx, off)
    # the roundabouts (AC_VEI 0206): the edge line round the ring and round the islands, 0.35 m inside, where the ring meets no other
    # carriageway (not across the mouths of the arms)
    nan = 0
    isole = [g for g, a in D['man']]
    for g, a in D['vei']:
        if a['zon'] != '0206' or not g.intersects(cover): continue
        near_ = [h for h, b in D['vei'] if h is not g and b['zon'] not in ('0307',) and h.distance(g) < 0.5 and lev(b) == lev(a)]
        gi = g.difference(unary_union([h for h in isole if h.intersects(g)])) if isole else g
        inner = gi.buffer(-BORDO, join_style=1).simplify(0.05)
        if inner.is_empty: continue
        mouth = unary_union([h.buffer(BORDO + 0.4) for h in near_]) if near_ else None
        for p in getattr(inner, 'geoms', [inner]):
            for ring in [p.exterior] + list(p.interiors):
                ln = LineString(ring.coords)
                if mouth is not None: ln = ln.difference(mouth)
                ln = ln.intersection(cover)
                for part in getattr(ln, 'geoms', [ln]):
                    if part.geom_type != 'LineString' or part.length < 4: continue
                    q, _ = _resample(np.asarray(part.coords), PASSO)
                    sg_ = 0.7   # the buffer already rounds it: more and it cut into the tips of the islands
                    if len(q) >= 5: q = np.column_stack((gaussian_filter1d(q[:, 0], sg_, mode='wrap' if part.is_closed else 'nearest'), gaussian_filter1d(q[:, 1], sg_, mode='wrap' if part.is_closed else 'nearest')))
                    q = _morbida(q, 8.0) if len(q) >= 3 else q
                    lines.append(dict(ri=-1, t=0, p=[(round(float(x), 2), round(float(z), 2)) for x, z in q], lev=lev(a))); nan += 1
    # no line twice: a piece of a line within 1 m of a line drawn before it (by a longer carriageway: a ramp that drew a section the main
    # one draws too, from a reference of its own) is left out
    kept = []; grid = defaultdict(list)
    def near(p):
        gx, gz = int(p[0] // 4), int(p[1] // 4)
        for a in (gx - 1, gx, gx + 1):
            for b in (gz - 1, gz, gz + 1):
                for q in grid.get((a, b), ()):
                    if (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2 < 1.0: return True
        return False
    ndup = 0
    for l in lines:
        m = np.array([not near(p) for p in l['p']]); ndup += int((~m).sum())
        for i0, i1 in _runs(m, 4): kept.append(dict(l, p=l['p'][i0:i1]))
        for p in l['p']: grid[(int(p[0] // 4), int(p[1] // 4))].append(p)
    lines = kept
    # and no line off the carriageway: a piece whose points fall outside AC_VEI (a line that cut the corner of a notch) is left out
    kept = []; nfuori = 0
    for l in lines:
        p = np.array(l['p']); m = shapely.contains_xy(STR.U_carr, p[:, 0], p[:, 1]); nfuori += int((~m).sum())
        for i0, i1 in _runs(m, 3): kept.append(dict(l, p=l['p'][i0:i1]))
    lines = kept
    # in a junction area a line stops where a street crosses it: the parts of a line in a junction area within the carriageway of a street that
    # crosses it (its OSM axis, w/2 + 1 m, at more than 45 degrees to the line there) are left out
    inc_ = [g for g, a in D['vei'] if a['zon'] == INCROCIO]
    if inc_:
        UI = unary_union(inc_); shapely.prepare(UI); vie_ = [(LineString([nodes[n_] for n_ in r['refs']]), r['w']) for r in raw_roads if r['c'] <= 5 and len(r['refs']) >= 2 and not r.get('bridge') and not r['tunnel']]
        TV = STRtree([g for g, _ in vie_]); kept = []; ntag = 0
        for l in lines:
            p = np.array(l['p'], float)
            if len(p) < 2: continue
            m = shapely.contains_xy(UI, p[:, 0], p[:, 1])
            if not m.any(): kept.append(l); continue
            d = np.gradient(p, axis=0); d /= np.maximum(np.hypot(*d.T), 1e-9)[:, None]; via = np.zeros(len(p), bool)
            for i in np.nonzero(m)[0]:
                q = shapely.points(p[i])
                for j in TV.query(q.buffer(12.0)):
                    g, w = vie_[j]; dd = g.distance(q)
                    if dd > w / 2 + 1.0: continue
                    pr = g.project(q); a_ = np.asarray(g.interpolate(max(pr - 1, 0)).coords[0]); b_ = np.asarray(g.interpolate(min(pr + 1, g.length)).coords[0]); t_ = b_ - a_; t_ /= max(math.hypot(*t_), 1e-9)
                    if abs(float(t_ @ d[i])) < 0.7: via[i] = True; break
            if not via.any(): kept.append(l); continue
            ntag += 1
            for i0, i1 in _runs(~via, 3): kept.append(dict(l, p=l['p'][i0:i1]))
        lines = kept; log('dbgt righe: righe tagliate dove una strada attraversa un incrocio %d' % ntag)
    # a line on a carriageway the DBGT has in gallery (AC_VEI SED=03) gets level 3: the game draws it on the floor of the underpass (src/opere.py),
    # not on the ground over it nor on a deck (the dashes of via Montecassino and of x -768 z 103 under the Milano-Meda)
    # (a line of the road over the gallery crosses the same area in plan: only a line running along the carriageway in gallery is its own. The
    # direction of each SED=03 area: the long side of its smallest rectangle)
    p3 = []
    for g, a in D['vei']:
        if a.get('sed') != '03' or g.is_empty: continue
        r = np.asarray(g.minimum_rotated_rectangle.exterior.coords)[:3]; e1, e2 = r[1] - r[0], r[2] - r[1]; e = e1 if np.hypot(*e1) >= np.hypot(*e2) else e2
        p3.append((g, e / max(np.hypot(*e), 1e-9)))
    if p3:
        tr3 = STRtree([g for g, _ in p3]); kept = []; n3 = 0
        for l in lines:
            p = np.array(l['p'], float)
            if len(p) < 2: kept.append(l); continue
            d = np.gradient(p, axis=0); d /= np.maximum(np.hypot(*d.T), 1e-9)[:, None]; m = np.zeros(len(p), bool)
            for i, q in enumerate(p):
                for j in tr3.query(shapely.points(q)):
                    g, e = p3[j]
                    if abs(float(d[i] @ e)) > 0.85 and g.contains(shapely.points(q)): m[i] = True; break
            if not m.any(): kept.append(l); continue
            cut = [0] + [i for i in range(1, len(m)) if m[i] != m[i - 1]] + [len(m)]
            for a_, b_ in zip(cut[:-1], cut[1:]):
                a0, b0 = max(0, a_ - (1 if m[a_] else 0)), min(len(m), b_ + (1 if m[a_] else 0))   # (the run in gallery takes the point before and after: no gap at the edge)
                if b0 - a0 >= 2: kept.append(dict(l, p=l['p'][a0:b0], lev=3 if m[a_] else l['lev'])); n3 += int(m[a_])
        lines = kept; log('dbgt righe: pezzi in galleria (livello 3) %d' % n3)
    # il lisciatore delle righe: solo forme ragionevoli (regole() sotto); il controllo conta le righe fuori regola prima e dopo
    ctl_prima = controllo(lines, STR.U_carr, raw_roads)
    lines, nlisc = lisciatore(lines, STR.U_carr, raw_roads)
    ctl_dopo = controllo(lines, STR.U_carr, raw_roads)
    log('dbgt righe: lisciatore %s; fuori regola prima %s, dopo %s' % (nlisc, ctl_prima, ctl_dopo))
    # the report: bends and lines off the carriageway
    bends = np.concatenate([_bends(l['p']) for l in lines]) if lines else np.zeros(0)
    out = 0; tot = 0; U = STR.U_carr
    bends_v = np.concatenate([_bends(l['p']) for l in lines if l['ri'] >= 0]) if lines else np.zeros(0)   # the streets (not the rings round the islands)
    for l in lines:   # the samples every 0.5 m of a line off the carriageway AC_VEI (exact, not on the 0.5 m raster)
        p = np.array(l['p']); q, _ = _resample(p, 0.5); tot += len(q); out += int((~shapely.contains_xy(U, q[:, 0], q[:, 1])).sum())
    rep = dict(strade=len(K), strade_con_righe=len(with_lines), carreggiate=len(ST), righe=len(lines), km=round(sum(LineString(l['p']).length for l in lines) / 1000, 1),
               per_tipo=dict(Counter(['bordo', 'mezzeria', 'tratteggio'][l['t']] for l in lines)), su_ponte=sum(1 for l in lines if l['lev'] == 2),
               pieghe_oltre_15=int((bends > 15).sum()), pieghe_oltre_5=int((bends > 5).sum()), piega_max=round(float(bends.max()), 1) if len(bends) else 0,
               pieghe_oltre_15_strade=int((bends_v > 15).sum()), piega_max_strade=round(float(bends_v.max()), 1) if len(bends_v) else 0,
               bordi_delle_rotatorie=nan, punti_doppi_tolti=ndup, punti_fuori_tolti=nfuori, campioni_fuori_carreggiata=out, campioni=tot, sezioni=nsez, sezioni_disegnate=nlead,
               lisciatore=nlisc, fuori_regola_prima=ctl_prima, fuori_regola=ctl_dopo)
    # the game leaves out the old dashes on the axis of these (roads[].sg), but only where the lines of the carriageway cover the street: a segment of it
    # with no line of ours alongside keeps its dashes (Carlo 3/11: corso Isonzo at x 305 z 1988, via Montecassino past the trench, under the Milano-Meda
    # at x -766 z 65 had no line at all). roads[].sg: 1 all covered, else one flag per segment
    if lines:
        LT = STRtree([LineString(l['p']) for l in lines if len(l['p']) >= 2]); LG = [LineString(l['p']) for l in lines if len(l['p']) >= 2]
    nsc = 0
    for ri in K:
        r = raw_roads[ri]; xy = np.array([nodes[n_] for n_ in r['refs']], float); fl = []
        for a_, b_ in zip(xy[:-1], xy[1:]):
            m_ = (a_ + b_) / 2; d_ = b_ - a_; L_ = math.hypot(*d_)
            if not lines or L_ < 0.05: fl.append(1 if lines else 0); continue
            seg = LineString([a_, b_]); near = [LG[j] for j in LT.query(seg.buffer(r['w'] / 2 + 1.0))]
            cov = sum(g.intersection(seg.buffer(r['w'] / 2 + 1.0)).length for g in near)
            fl.append(1 if cov >= 0.6 * L_ else 0)
        nsc += fl.count(0)
        r['sg'] = True if all(fl) else fl
    log('dbgt righe: tratti di strade con righe ma senza righe dalla carreggiata (tengono il tratteggio sull asse) %d' % nsc)
    log('dbgt righe: %s' % rep)
    return lines, rep


# ---- il lisciatore delle righe (Carlo 5/11, la Milano-Meda: "fatte molto male"). Una riga vera ha una forma che si può dipingere: una curva non
# più stretta di quella che la strada permette, la stessa distanza dal bordo (spartitraffico compreso), niente punte, pieghe o pezzetti. Dove i
# dati chiedono una forma che non va, la riga va dritta fra i punti buoni prima e dopo; se così uscirebbe dalla carreggiata, lì non c'è.
# Regole per classe di strada (raggio minimo della riga, m): superstrade e autostrade (c 0 con x) 120, rampe (c 1 con x) 20, strade principali
# (c 0) 30, terziarie e rampe (c 1) 15, c 2 10, le altre e i bordi delle rotatorie 5
R_MIN = dict(sup=120.0, rampa=20.0, c0=30.0, c1=15.0, c2=10.0, altro=5.0)
CURVA_W = 3          # la curvatura si misura fra i punti a 3 m prima e dopo (m): una riga ricampionata a 1 m
PIEGA = 15.0         # una svolta di più fra due metri consecutivi è una piega (gradi)
BORDO_TOL = 0.25     # una riga di bordo sta a BORDO dal bordo della carreggiata, più o meno questo (m)
ONDA = 0.12          # una riga ondeggia dove, su ONDA_S m, gira avanti e indietro (la somma delle svolte meno la svolta netta) più di
ONDA_S = 8           # tanto (radianti; svolte misurate ogni 2 m): una curva vera gira da una parte sola
BORDO_LONTANO = 1.5  # una riga di bordo più lontana di così dal bordo attraversa una bocca: lì non si giudica
CORTA = {0: 6.0, 1: 6.0, 2: 4.5}   # le righe più corte di così sono pezzetti (bordo, mezzeria, tratteggio)
ALLARGA_B = 2        # un tratto fuori regola si allarga di tanti metri per parte: la riga dritta parte da punti sicuri
SPOSTA_MAX = 0.6     # arrotondando una curva la riga si sposta al più di tanto (m): di più, lì la riga non c'è


def _classe(l, raw_roads):
    if l['ri'] < 0: return 'altro'
    r = raw_roads[l['ri']]
    if r.get('x'): return 'sup' if r['c'] == 0 else 'rampa'
    return {0: 'c0', 1: 'c1', 2: 'c2'}.get(r['c'], 'altro')


def _bordo(U):
    """i segmenti del bordo della carreggiata (tutte le carreggiate AC_VEI): un STRtree per la distanza dal bordo"""
    segs = []
    for p in _parts(U):
        for ring in [p.exterior] + list(p.interiors):
            c = np.asarray(ring.coords)
            if len(c) >= 2: segs.append(shapely.linestrings(np.stack((c[:-1], c[1:]), 1)))
    G = np.concatenate(segs) if segs else np.zeros(0, object)
    return STRtree(G)


def _difetti(l, raw_roads, tree):
    """la riga ricampionata a 1 m e, campione per campione, cosa non va: curva (più stretta del raggio minimo), piega, bordo (una riga di
    bordo non a BORDO dal bordo dove il bordo è vicino), onda (gira avanti e indietro); la lunghezza"""
    p = np.asarray(l['p'], float)
    L = float(np.hypot(*np.diff(p, axis=0).T).sum()) if len(p) >= 2 else 0.0
    if L < 1.0: return p, dict(), L
    q, _ = _resample(p, PASSO); n = len(q)
    bad = {}
    if n >= 2 * CURVA_W + 1:
        k = np.zeros(n); w = CURVA_W
        a = q[w:-w] - q[:-2 * w]; b = q[2 * w:] - q[w:-w]
        ang = np.abs((np.arctan2(b[:, 1], b[:, 0]) - np.arctan2(a[:, 1], a[:, 0]) + np.pi) % (2 * np.pi) - np.pi)
        k[w:-w] = ang / w   # radianti per metro: 1 / raggio
        bad['curva'] = k > 1.0 / R_MIN[_classe(l, raw_roads)] * 1.25 + 0.002
    if n >= 3:
        t = np.zeros(n); t[1:-1] = _bends(q); bad['piega'] = t > PIEGA
    if n >= 2 * ONDA_S // 2 + 3:
        q2, _ = _resample(p, 2.0)
        if len(q2) >= ONDA_S // 2 + 2:
            dd = np.diff(q2, axis=0); a = np.arctan2(dd[:, 1], dd[:, 0]); t = (np.diff(a) + np.pi) % (2 * np.pi) - np.pi
            w = ONDA_S // 2; cs = np.r_[0, np.cumsum(t)]; ca = np.r_[0, np.cumsum(np.abs(t))]
            zig = np.zeros(len(t))
            for i in range(len(t)):
                i0, i1 = max(0, i - w // 2), min(len(t), i - w // 2 + w)
                zig[i] = (ca[i1] - ca[i0]) - abs(cs[i1] - cs[i0])
            z2 = np.zeros(len(q2)); z2[1:-1] = zig
            bad['onda'] = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(q2)), z2) > ONDA
    if l['t'] == 0 and len(tree.geometries):
        _, d = tree.query_nearest(shapely.points(q), return_distance=True, all_matches=False)
        d = np.asarray(d, float)
        if len(d) == n:   # troppo vicina (o fuori); troppo lontana solo dove la riga segue il bordo che si allontana (non dove va dritta: lì è giusto)
            gira = np.zeros(n); gira[CURVA_W:-CURVA_W] = k[CURVA_W:-CURVA_W] * CURVA_W if n >= 2 * CURVA_W + 1 else 0
            bad['bordo'] = (d < BORDO - BORDO_TOL) | ((d > BORDO + BORDO_TOL) & (d < BORDO_LONTANO) & (gira > math.radians(2)))
    return q, bad, L


def controllo(lines, U, raw_roads):
    """in tutta la mappa: quante righe sono fuori regola, e per quale regola (una riga conta una volta per regola)"""
    tree = _bordo(U); c = Counter(); n_ = 0
    for l in lines:
        q, bad, L = _difetti(l, raw_roads, tree)
        f = False
        if L < CORTA.get(l['t'], 4.5): c['corta'] += 1; f = True
        for k, m in bad.items():
            if m.sum() >= 2: c[k] += 1; f = True
        n_ += f
    return dict(righe=len(lines), km=round(sum(LineString(l['p']).length for l in lines if len(l['p']) >= 2) / 1000, 1), fuori_regola=n_, **{k: c[k] for k in ('curva', 'piega', 'bordo', 'onda', 'corta')})


def lisciatore(lines, U, raw_roads):
    """ogni riga fuori regola: i tratti che non vanno (allargati di ALLARGA_B m) diventano dritti fra i punti buoni prima e dopo; un tratto in
    fondo alla riga si toglie; un tratto dritto che uscirebbe dalla carreggiata si toglie; i pezzetti si tolgono"""
    tree = _bordo(U); shapely.prepare(U); c = Counter()
    for giro in range(3):   # una riga dritta fra due punti buoni può piegare dove si attacca: un altro giro su quelle
        lines, nc = _lisciatore1(lines, U, raw_roads, tree, c)
        if not nc: break
    return lines, {k: int(v) for k, v in c.items()}


def _curva(r, lim):
    """i campioni di r (a 1 m) in una curva più stretta del raggio minimo (lim: 1 / raggio, con la tolleranza) o in una piega"""
    n = len(r); bad = np.zeros(n, bool)
    if n >= 2 * CURVA_W + 1:
        w = CURVA_W; a = r[w:-w] - r[:-2 * w]; b = r[2 * w:] - r[w:-w]
        ang = np.abs((np.arctan2(b[:, 1], b[:, 0]) - np.arctan2(a[:, 1], a[:, 0]) + np.pi) % (2 * np.pi) - np.pi)
        bad[w:-w] = ang / w > lim
    if n >= 3: t = np.zeros(n); t[1:-1] = _bends(r); bad |= t > PIEGA
    return bad


def _lisciatore1(lines, U, raw_roads, tree, c):
    """un giro: (a) dove la riga ondeggia o non sta alla sua distanza dal bordo va dritta fra i punti buoni prima e dopo (allargati di
    ALLARGA_B m); (b) le curve troppo strette e le pieghe (anche quelle dove il tratto dritto si attacca) si arrotondano, lisciando solo lì,
    finché la curva va o la riga si sposterebbe più di SPOSTA_MAX m; (c) dove non va ancora, o la riga uscirebbe dalla carreggiata, lì non c'è"""
    out = []; nc = 0
    for l in lines:
        q, bad, L = _difetti(l, raw_roads, tree)
        if L < CORTA.get(l['t'], 4.5): c['corte_tolte'] += 1; continue
        m = np.zeros(len(q), bool)
        for k, b in bad.items():
            if b.sum() >= 2 or (k == 'piega' and b.any()): m |= b
        if not m.any(): out.append(l); continue
        c['righe_corrette'] += 1; nc += 1
        keep = np.ones(len(q), bool); r = q.copy(); n = len(q)
        ml = np.zeros(n, bool)
        for k in ('onda', 'bordo'):
            if k in bad and bad[k].sum() >= 2: ml |= bad[k]
        m0 = ml; ml = maximum_filter1d(ml.astype(np.uint8), 2 * ALLARGA_B + 1, mode='nearest').astype(bool)
        for i0, i1 in _runs(ml):
            if i0 == 0 or i1 == n:   # in fondo alla riga: via solo i punti che non vanno, fino al primo buono
                e = np.where(m0[i0:i1])[0]
                if not len(e): continue
                a_, b_ = (i0, i0 + e[-1] + 1) if i0 == 0 else (i0 + e[0], i1)
                keep[a_:b_] = False; c['punte_in_fondo_tolte_m'] += b_ - a_; continue
            a, b = q[i0 - 1], q[i1]; t = (np.arange(i0, i1) - (i0 - 1)) / (i1 - (i0 - 1))
            r[i0:i1] = a + (b - a) * t[:, None]; c['metri_dritti'] += i1 - i0
        lim = 1.0 / R_MIN[_classe(l, raw_roads)] * 1.25 + 0.002
        r0 = r.copy()
        for it in range(20):
            bd = _curva(r, lim) & keep
            if not bd.any(): break
            w = maximum_filter1d(bd.astype(np.uint8), 2 * CURVA_W + 3, mode='nearest').astype(bool); w[0] = w[-1] = False
            sm = gaussian_filter1d(r, 1.5, axis=0, mode='nearest'); r[w] = sm[w]
        c['metri_arrotondati'] += int((np.hypot(*(r - r0).T) > 0.02).sum())
        bd = _curva(r, lim); sp = np.hypot(*(r - q).T) > SPOSTA_MAX
        out_ = ~shapely.contains_xy(U, r[:, 0], r[:, 1])
        c['metri_tolti_curva'] += int((bd & keep).sum()); c['metri_tolti_spostati'] += int((sp & keep & ~bd).sum()); c['metri_tolti_fuori'] += int((out_ & keep & ~bd & ~sp).sum())
        keep &= ~bd & ~sp & ~out_
        for i0, i1 in _runs(keep, 2):
            seg = r[i0:i1]
            Ls = float(np.hypot(*np.diff(seg, axis=0).T).sum()) if len(seg) >= 2 else 0.0
            if Ls < CORTA.get(l['t'], 4.5): c['corte_tolte'] += 1; continue
            out.append(dict(l, p=[(round(float(x), 2), round(float(z), 2)) for x, z in seg]))
    return out, nc


def push_tiles(lines, ntiles, tbox, push):
    """the lines in the tiles: tiles[t].sg = [[t, lev, s0, [dx, dz, ...]]], points in centimetres delta-encoded (Douglas-Peucker 2 cm first),
    s0 the length of the line before the piece in the tile (decimetres: the dashes go on across the edge of the tile)"""
    from shapely.strtree import STRtree as _T
    if not lines: return
    G = [LineString(l['p']) for l in lines]; T = _T(G)
    for t in range(ntiles):
        bx = tbox(t)
        for i in T.query(bx):
            g = G[i]; c = g.intersection(bx)
            for part in getattr(c, 'geoms', [c]):
                if part.geom_type != 'LineString' or part.length < 0.3: continue
                s0 = g.project(shapely.Point(part.coords[0]))
                q = part.simplify(0.02, preserve_topology=False); o = []; px = pz = 0
                for x, z in q.coords:
                    X, Z = int(round(x * 100)), int(round(z * 100)); o += [X - px, Z - pz]; px, pz = X, Z
                push(t, 'sg', [lines[i]['t'], lines[i]['lev'], int(round(s0 * 10)), o])
