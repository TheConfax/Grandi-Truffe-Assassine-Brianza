"""Many GEOS differences against one big geometry, in processes of their own (build più veloce, Carlo 3/11).
shapely 2.2 keeps the GIL for the whole of a difference or an intersection (measured: another thread stands still for the whole call;
union_all and buffer let it go), so the threads of src/presto.py do not run those at the same time: processes do. The inputs go to a file
once, as WKB (the same coordinates, bit for bit); each process reads it, makes the same call g.difference(Z) on the same geometries and
sends back the WKB of the result: the same geometry, coordinate by coordinate, in the same order as [g.difference(Z) for g in geoms].
Windows starts the processes fresh (spawn): they run this file, never build_data.py.
  differenze(geoms, Z)    = [g.difference(Z) for g in geoms]; on NP processes when there are many, otherwise here
  intersezioni(geoms, Z)  = [g.intersection(Z) for g in geoms], the same way
  mappa(modulo, fn, items, iniz)  = [modulo.fn(x) for x in items] after modulo.iniz[0](*iniz[1:]) (a pure fn of src/<modulo>.py, picklable items and results)"""
import os, sys, pickle, subprocess, tempfile, shutil, time
import shapely

NP = max(1, min(8, (os.cpu_count() or 4) // 2))   # eight at most: each holds its own copy of Z (the build shares the machine)


def differenze(geoms, Z, nproc=NP, minimo=200): return _molte('difference', geoms, Z, nproc, minimo)


def intersezioni(geoms, Z, nproc=NP, minimo=200): return _molte('intersection', geoms, Z, nproc, minimo)


def _molte(op, geoms, Z, nproc, minimo):
    geoms = list(geoms)
    if len(geoms) < minimo or nproc < 2 or os.environ.get('GTA_SENZA_PROCESSI'): return [getattr(g, op)(Z) for g in geoms]
    d = tempfile.mkdtemp(prefix='processi_'); fi, fo = os.path.join(d, 'in.pkl'), os.path.join(d, 'out.pkl')
    try:
        t0 = time.time(); zb = shapely.to_wkb(Z)
        with open(fi, 'wb') as f: pickle.dump((zb, [shapely.to_wkb(g) for g in geoms]), f, protocol=4)
        rc = subprocess.call([sys.executable, os.path.abspath(__file__), '--' + op, fi, fo, str(nproc)])
        if rc == 0 and os.path.exists(fo):
            with open(fo, 'rb') as f: out = [shapely.from_wkb(b) for b in pickle.load(f)]
            print('processi: %d %s contro una geometria di %.0f MB (WKB) in %d processi, %.0f s' % (len(geoms), op, len(zb) / 1e6, nproc, time.time() - t0), flush=True)
            return out
        print('processi: %s non riuscite (codice %s), le faccio qui' % (op, rc), flush=True)
        return [getattr(g, op)(Z) for g in geoms]
    finally: shutil.rmtree(d, ignore_errors=True)


def mappa(modulo, fn, items, iniz=None, nproc=NP, minimo=50):
    items = list(items)
    import importlib
    m = importlib.import_module(modulo)
    if len(items) < minimo or nproc < 2 or os.environ.get('GTA_SENZA_PROCESSI'):
        if iniz: getattr(m, iniz[0])(*iniz[1:])
        return [getattr(m, fn)(x) for x in items]
    d = tempfile.mkdtemp(prefix='processi_'); fi, fo = os.path.join(d, 'in.pkl'), os.path.join(d, 'out.pkl')
    try:
        with open(fi, 'wb') as f: pickle.dump((modulo, fn, iniz, items), f, protocol=4)
        rc = subprocess.call([sys.executable, os.path.abspath(__file__), '--mappa', fi, fo, str(nproc)])
        if rc == 0 and os.path.exists(fo):
            with open(fo, 'rb') as f: return pickle.load(f)
        print('processi: %s.%s non riuscita (codice %s), la faccio qui' % (modulo, fn, rc), flush=True)
        if iniz: getattr(m, iniz[0])(*iniz[1:])
        return [getattr(m, fn)(x) for x in items]
    finally: shutil.rmtree(d, ignore_errors=True)


class _Dopo:
    def __init__(s, modulo, fn, arrays):
        s.modulo, s.fn, s.arrays = modulo, fn, arrays; s.d = tempfile.mkdtemp(prefix='processi_dopo_'); s.p = None; s.val = None
        if os.environ.get('GTA_SENZA_PROCESSI'): return
        try:
            import numpy as np
            for k, a in enumerate(arrays): np.save(os.path.join(s.d, 'in_%d.npy' % k), a)
            s.p = subprocess.Popen([sys.executable, os.path.abspath(__file__), '--dopo', modulo, fn, s.d, str(len(arrays))])
        except Exception as e: print('processi: %s.%s non partita (%s), la faccio dopo qui' % (modulo, fn, e), flush=True); s.p = None

    def result(s):
        if s.val is not None: return s.val
        import numpy as np, importlib, glob
        try:
            if s.p is not None and s.p.wait() == 0:
                n = len(glob.glob(os.path.join(s.d, 'out_*.npy')))
                s.val = tuple(np.load(os.path.join(s.d, 'out_%d.npy' % k)) for k in range(n)); return s.val
            if s.p is not None: print('processi: %s.%s non riuscita (codice %s), la faccio qui' % (s.modulo, s.fn, s.p.returncode), flush=True)
            s.val = tuple(getattr(importlib.import_module(s.modulo), s.fn)(*s.arrays)); return s.val
        finally: shutil.rmtree(s.d, ignore_errors=True); s.arrays = None


def dopo(modulo, fn, *arrays):
    """modulo.fn(*arrays) (numpy arrays in, a tuple of numpy arrays out) started now in a process of its own: .result() waits for it and gives
    the tuple. The arrays go by .npy (the same bytes), so the result is the one fn gives here; for a long numpy step that keeps the GIL
    (skimage reconstruction) while the build goes on"""
    return _Dopo(modulo, fn, arrays)


_M = _F = None
def _init_mappa(fi):
    global _M, _F, _G
    import importlib
    with open(fi, 'rb') as f: modulo, fn, iniz, _G = pickle.load(f)
    _M = importlib.import_module(modulo); _F = getattr(_M, fn)
    if iniz: getattr(_M, iniz[0])(*iniz[1:])


def _uno_mappa(i): return _F(_G[i])


_Z = _G = _OP = None
def _init(fi, op):
    global _Z, _G, _OP
    _OP = op
    with open(fi, 'rb') as f: zb, _G = pickle.load(f)
    _Z = shapely.from_wkb(zb)


def _uno(i): return shapely.to_wkb(getattr(shapely.from_wkb(_G[i]), _OP)(_Z))


if __name__ == '__main__' and len(sys.argv) >= 6 and sys.argv[1] == '--dopo':
    import numpy as np, importlib
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    modulo, fn, d, n = sys.argv[2], sys.argv[3], sys.argv[4], int(sys.argv[5])
    out = getattr(importlib.import_module(modulo), fn)(*[np.load(os.path.join(d, 'in_%d.npy' % k)) for k in range(n)])
    for k, a in enumerate(out): np.save(os.path.join(d, 'out_%d.npy' % k), a)

if __name__ == '__main__' and len(sys.argv) >= 5 and sys.argv[1] == '--mappa':
    import multiprocessing as mp
    fi, fo, n = sys.argv[2], sys.argv[3], int(sys.argv[4])
    with open(fi, 'rb') as f: ng = len(pickle.load(f)[3])
    with mp.Pool(n, initializer=_init_mappa, initargs=(fi,)) as pool: res = pool.map(_uno_mappa, range(ng), chunksize=8)
    with open(fo, 'wb') as f: pickle.dump(res, f, protocol=4)

if __name__ == '__main__' and len(sys.argv) >= 5 and sys.argv[1] in ('--difference', '--intersection'):
    import multiprocessing as mp
    fi, fo, n = sys.argv[2], sys.argv[3], int(sys.argv[4])
    with open(fi, 'rb') as f: ng = len(pickle.load(f)[1])
    with mp.Pool(n, initializer=_init, initargs=(fi, sys.argv[1][2:])) as pool: res = pool.map(_uno, range(ng), chunksize=4)
    with open(fo, 'wb') as f: pickle.dump(res, f, protocol=4)
