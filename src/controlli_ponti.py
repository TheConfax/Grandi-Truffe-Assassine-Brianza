# Controllo dei capi dei ponti (todo.md 6/11, ramo ponti-spalle: "ogni ponte e ogni passerella deve sembrare un ponte vero"). Legge quello
# che legge il gioco, terreno/indice.json + pacco.bin (S e impalcati) e brianza.json (edifici), e guarda i due capi di ogni impalcato lungo
# la sua direzione (dir): i lati del bordo che guardano fuori da quel capo, entro CAPO m dall'estremo. Un capo è a posto quando l'impalcato
# appoggia sul terreno (spalla o rilevato): il piano di sopra arriva a S appena fuori (GRADINO) e sotto la fine dell'impalcato il terreno
# sta all'altezza del fondo o più su (VUOTO). Non si contano i punti dove un altro impalcato prosegue alla stessa quota né quelli contro un
# edificio (le passerelle fra due palazzi). Scrive report_ponti.json accanto alla cartella terreno/; la soglia è 0 capi fuori.
#   python src/controlli_ponti.py [--terreno DIR] [--dati brianza.json] [--out report_ponti.json]
# terreno_gioco.py lo chiama a fine corsa. Regola generale: nessuna coordinata scritta qui.
import os, sys, json, gzip, struct, argparse, time
import numpy as np, shapely
from shapely.geometry import Polygon

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
sys.path.insert(0, HERE)
from controlli_acqua import cima_impalcati, triangoli_impalcati, dec, link, pct

TILE = 250.0
CAPO = 3.0       # m: i punti del bordo entro tanto dall'estremo dell'impalcato lungo dir, con la normale verso fuori dal capo
GRADINO = 0.25   # m: |piano dell'impalcato - S appena fuori| oltre tanto (mediana sul capo) è un capo che non appoggia
VUOTO = 0.3      # m: fondo dell'impalcato (piano - sp) sopra S mezzo metro dentro il capo di più di tanto (mediana): vuoto sotto la fine
FUORI, DENTRO = 0.6, 0.5   # m: dove si legge S fuori e dentro il capo
CONTINUA = 0.8   # m: un altro impalcato appena fuori entro tanto dal piano lo continua
SPALLA_MURO = 6.0   # m: sotto i lati dove l'impalcato appoggia il gioco chiude il vuoto con il muro di spalla fino a tanto (world3.js SPALLA_CAPO_MAX)
EDIFICIO = 3.0   # m: un capo con un edificio entro tanto oltre finisce nell'edificio (le passerelle fra due palazzi; impalcati.py EDIFICIO_CAPO)


class Terreno:
    def __init__(s, terreno, dati):
        s.ind = ind = json.load(open(os.path.join(terreno, 'indice.json'), encoding='utf-8'))
        B = json.load(open(dati, encoding='utf-8')); m = B['meta']; s.hw, s.hh = m['hw'], m['hh']
        pk = ind.get('pacco'); blob = open(os.path.join(terreno, pk['file']), 'rb').read() if pk else None; s.tiles = {}
        for k in ind['tiles']:
            if pk: o, n_ = pk['tile'][k]; b = gzip.decompress(blob[o:o + n_])
            else: b = gzip.decompress(open(os.path.join(terreno, k + '.bin.gz'), 'rb').read())
            _, st, n = struct.unpack('<BBH', b[4:8]); base, = struct.unpack('<f', b[8:12])
            s.tiles[tuple(int(v) for v in k.split('_'))] = (st, (base * 100 + np.frombuffer(b, '<u2', n * n, 12).reshape(n, n).astype(np.float64)) / 100)
        bl = []
        for T in B['tiles']:
            for a in (T or {}).get('b', []):
                o = dec(a['p'])
                if len(o) >= 3: bl.append(Polygon(o).buffer(0))
        s.edifici = shapely.STRtree(bl) if bl else None
        s.decks = [d for d in ind.get('decks', []) if d.get('tipo') != 'copertura']
        s.tri = {d['id']: triangoli_impalcati([d]) for d in s.decks}

    def H(s, x, z):   # S as the game draws it (two triangles per cell, diagonal u >= v), NaN outside the tiles
        x, z = np.atleast_1d(np.asarray(x, float)), np.atleast_1d(np.asarray(z, float)); out = np.full(x.shape, np.nan)
        tx, tz = np.floor((x + s.hw) / TILE).astype(int), np.floor((z + s.hh) / TILE).astype(int)
        for k in set(zip(tx.tolist(), tz.tolist())):
            if k not in s.tiles: continue
            st, h = s.tiles[k]; m = (tx == k[0]) & (tz == k[1]); n = h.shape[0]
            fx = np.clip((x[m] + s.hw - k[0] * TILE) / st, 0, n - 1.000001); fz = np.clip((z[m] + s.hh - k[1] * TILE) / st, 0, n - 1.000001)
            i, j = fx.astype(int), fz.astype(int); u, v = fx - i, fz - j; h00, h10, h01, h11 = h[j, i], h[j, i + 1], h[j + 1, i], h[j + 1, i + 1]
            out[m] = np.where(u >= v, h00 + u * (h10 - h00) + v * (h11 - h10), h00 + v * (h01 - h00) + u * (h11 - h01))
        return out

    def top(s, did, x, z): t, tr, _ = s.tri[did]; return cima_impalcati(t, tr, np.atleast_1d(x), np.atleast_1d(z))

    def altro(s, did, x, z, y):   # another deck at about this height over the points
        out = np.zeros(np.atleast_1d(x).shape, bool)
        for d in s.decks:
            if d['id'] != did: t = s.top(d['id'], x, z); out |= np.isfinite(t) & (np.abs(t - y) < CONTINUA)
        return out

    def edificio(s, x, z):
        if s.edifici is None: return np.zeros(len(x), bool)
        i, _ = s.edifici.query(shapely.buffer(shapely.points(x, z), EDIFICIO / 2), predicate='intersects')
        out = np.zeros(len(x), bool); out[i] = True; return out


def direzione(d):
    if d.get('dir'): u = np.asarray(d['dir'], float); return u / np.hypot(*u)
    P = np.asarray(d.get('nucleo') or d['imp'], float); P = P - P.mean(0); w, V = np.linalg.eigh(P.T @ P); return V[:, 1]


def bordo(d, passo=0.5):   # points every <= passo m on the boundary edges of the deck's triangles: (x, z, top, nx, nz, spalla) with n outwards
    T = np.asarray(d['tri'], float).reshape(-1, 3, 3); E = {}
    sk = {tuple(sorted(((round(q[0], 2), round(q[1], 2)), (round(q[2], 2), round(q[3], 2))))) for q in d.get('spalle', [])}
    for t in T:
        for a, b in ((0, 1), (1, 2), (2, 0)):
            k = tuple(sorted((tuple(np.round(t[a, :2], 2)), tuple(np.round(t[b, :2], 2)))))
            E.setdefault(k, []).append((t[a], t[b], t[:, :2].mean(0)))
    out = []
    for kk, v in E.items():
        if len(v) != 1: continue
        A, B, G = v[0]; L = np.hypot(*(B[:2] - A[:2]))
        if L < 0.05: continue
        n = np.array([-(B[1] - A[1]), B[0] - A[0]]) / L
        if np.dot(G - (A[:2] + B[:2]) / 2, n) > 0: n = -n
        for f in (np.arange(max(1, int(np.ceil(L / passo)))) + 0.5) / max(1, int(np.ceil(L / passo))):
            p = A + (B - A) * f; out.append((p[0], p[1], p[2], n[0], n[1], float(kk in sk)))
    return np.array(out).reshape(-1, 6)


def capi(m):
    out = []
    for d in m.decks:
        Q = bordo(d)
        if not len(Q): continue
        x, z, y, nx, nz, spl = Q.T; spl = spl > 0; u = direzione(d); sp = float(d['sp']); did = d['id']
        pu = x * u[0] + z * u[1]; ue = np.asarray(d['imp'], float) @ u
        xo, zo = x + nx * FUORI, z + nz * FUORI
        cont = m.altro(did, xo, zo, y); bld = m.edificio(x + nx * EDIFICIO / 2, z + nz * EDIFICIO / 2)
        so = m.H(xo, zo); xi, zi = x - nx * DENTRO, z - nz * DENTRO; si = m.H(xi, zi); ti = m.top(did, xi, zi)
        for sg, e, nm in ((-1, ue.min(), 'inizio'), (1, ue.max(), 'fine')):
            k = (np.abs(pu - e) < CAPO) & ((nx * u[0] + nz * u[1]) * sg > 0.5)
            if not k.any(): continue
            libero = k & ~cont & ~bld
            c = dict(impalcato=did, tipo=d['tipo'], fonte=d['fonte'], capo=nm, punti=int(k.sum()), continua=int((k & cont).sum()), edificio=int((k & bld).sum()))
            j = np.nonzero(libero)[0]
            if len(j) < max(2, 0.3 * k.sum()):   # the end goes on into another deck or a building
                c.update(stato='prosegue'); out.append(c); continue
            g = np.abs(y[j] - so[j]); v = ti[j] - sp - si[j]
            v = np.where(spl[j] & (v <= SPALLA_MURO), np.minimum(v, 0.0), v)   # on the edges where it rests on S the game closes the gap with the abutment (world3.js spalleCapi)
            cx, cz = float(np.median(x[j])), float(np.median(z[j]))
            c.update(x=round(cx, 1), z=round(cz, 1), gradino=round(float(np.nanmedian(g)), 2), vuoto=round(float(np.nanmedian(v)), 2), link=link(cx, cz))
            c['stato'] = 'fuori' if (c['gradino'] > GRADINO or c['vuoto'] > VUOTO) else 'ok'
            out.append(c)
    return out


def controlla(terreno, dati, out=None, log=print):
    t0 = time.time(); m = Terreno(terreno, dati); C = capi(m)
    fuori = [c for c in C if c['stato'] == 'fuori']; misurati = [c for c in C if c['stato'] != 'prosegue']
    rep = dict(definizione='capi degli impalcati (i due estremi lungo la direzione, lati che guardano fuori entro %.0f m): gradino = mediana |piano - S| %.1f m fuori, '
                           'vuoto = mediana (piano - sp - S) %.1f m dentro, chiuso dal muro di spalla del gioco sui lati dove appoggia (fino a %.0f m); fuori soglia se gradino > %.2f m o vuoto > %.2f m. Esclusi i punti dove un altro impalcato '
                           'prosegue a meno di %.1f m o che finiscono contro un edificio' % (CAPO, FUORI, DENTRO, SPALLA_MURO, GRADINO, VUOTO, CONTINUA),
               impalcati=len(m.decks), capi=len(C), misurati=len(misurati), proseguono=len(C) - len(misurati), fuori_soglia=len(fuori),
               gradino=pct([c['gradino'] for c in misurati]), vuoto=pct([c['vuoto'] for c in misurati]),
               elenco_fuori=sorted(fuori, key=lambda c: -max(c['gradino'], c['vuoto'])), capi_tutti=C, soglia='0 capi fuori', ok=not fuori,
               tempo_s=round(time.time() - t0, 1))
    if out: json.dump(rep, open(out, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    log('controllo dei capi dei ponti: %d capi misurati su %d impalcati, fuori soglia %d%s' % (len(misurati), len(m.decks), len(fuori),
        (': ' + ', '.join('%s %s (gradino %.2f, vuoto %.2f) %s' % (c['fonte'], c['capo'], c['gradino'], c['vuoto'], c['link']) for c in rep['elenco_fuori'][:12])) if fuori else ''))
    return rep


def main(argv=None):
    ap = argparse.ArgumentParser(description='Controllo dei capi dei ponti: gradino e vuoto sotto la fine degli impalcati')
    ap.add_argument('--terreno', default=os.path.join(ROOT, 'terreno')); ap.add_argument('--dati', default=os.path.join(ROOT, 'brianza.json'))
    ap.add_argument('--out', default=None)
    a = ap.parse_args(argv)
    rep = controlla(a.terreno, a.dati, a.out or os.path.join(os.path.dirname(os.path.abspath(a.terreno)), 'report_ponti.json'))
    return 0 if rep['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
