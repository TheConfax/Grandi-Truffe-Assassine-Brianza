# The build's cache on disk (build più veloce, Carlo 3/11): the results of the slow computations that depend only on their own inputs,
# so that a build that changes one thing does not redo them all. Only pure computations go here: a result is a function of its key and
# nothing else (the input itself, the source of the code that computes it, the files of data it reads). A key that does not match is
# computed again; the result is the same as without the cache, byte for byte.
#   where: the folder in GTA_CACHE; build_data.py sets it to cache_build/ next to the out.json (not in the repo: .gitignore)
#   GTA_NOCACHE=1: nothing read and nothing written, everything computed
# What is cached (each "table" is a dict key -> result, saved whole after the build used it; entries the build did not use are dropped):
#   tetti_dsm     dbgt_edifici.py: the roof fitted on the DSM of each volume (fit_tetto), key = the job (ring, heights)
#   foto_esri     dbgt_edifici.py: the numbers of the Esri photo inside each plan (demoliti), key = the plan (WKB)
#   ali           dbgt_edifici.py: the wings of an L, T or U volume (ali), key = the plan (WKB)
import os, sys, hashlib, pickle

SRC = os.path.dirname(os.path.abspath(__file__))
ATTIVA = not os.environ.get('GTA_NOCACHE')


def cartella():
    return os.environ.get('GTA_CACHE') or os.path.join(os.path.dirname(SRC), 'cache_build')


def chiave(*o):
    """the hash of any picklable inputs (numpy arrays, shapely geometries via their WKB, numbers, strings)"""
    return hashlib.sha1(pickle.dumps(o, protocol=4)).hexdigest()


def sorgenti(*nomi):
    """the hash of the source files src/<nome> (the code that computes the result), with the versions of the libraries"""
    import numpy, shapely
    h = hashlib.sha1(('%s %s %s' % (sys.version, numpy.__version__, shapely.__version__)).encode())
    for n in nomi: h.update(open(os.path.join(SRC, n), 'rb').read())
    return h.hexdigest()


def dati(cartella_dati, estensioni=None):
    """the hash of a folder of data: names, sizes and times of its files (a file changed or added changes it)"""
    h = hashlib.sha1(); fs = []
    for r, ds, nn in os.walk(cartella_dati):
        ds.sort()
        for n in sorted(nn):
            if estensioni and not n.lower().endswith(estensioni): continue
            st = os.stat(os.path.join(r, n)); fs.append('%s|%d|%d' % (os.path.relpath(os.path.join(r, n), cartella_dati), st.st_size, int(st.st_mtime)))
    h.update('\n'.join(fs).encode()); return h.hexdigest()


class Tabella:
    """a dict key -> result on disk, valid for one versione (the hash of the code and data it depends on). get/put, then salva()"""
    def __init__(s, nome, versione):
        s.nome, s.v = nome, versione; s.vecchi, s.usati = {}, {}
        s.f = os.path.join(cartella(), nome + '.pkl')
        if ATTIVA and os.path.exists(s.f):
            try:
                v, d = pickle.load(open(s.f, 'rb'))
                if v == versione: s.vecchi = d
            except Exception: s.vecchi = {}

    def __contains__(s, k): return k in s.vecchi or k in s.usati

    def get(s, k):
        if k in s.usati: return s.usati[k]
        r = s.vecchi[k]; s.usati[k] = r; return r

    def put(s, k, r): s.usati[k] = r

    def salva(s):
        if not ATTIVA: return
        os.makedirs(cartella(), exist_ok=True); t = s.f + '.tmp%d' % os.getpid()
        with open(t, 'wb') as fo: pickle.dump((s.v, s.usati), fo, protocol=4)
        os.replace(t, s.f)

    def trovati(s): return sum(1 for k in s.usati if k in s.vecchi)
