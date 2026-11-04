"""Where the build spends its time, line by line (build più veloce, 3/11). py-spy does not give the line of the top-level code of
build_data.py (a script of 2400 lines with no functions), this does: a thread looks at every thread of the build every PASSO seconds and
writes the stack of each, with its lines, to a file. Nothing in the build changes.
  python src/campiona.py campioni.txt src/build_data.py <the arguments of build_data.py>
  python src/campiona.py --leggi campioni.txt [n]     the lines of build_data.py where the main thread stood longest, and what it was doing there
Each sample: 't <seconds>' then one line per thread: '<thread name>|file:line:function;file:line:function;...' (outermost first)."""
import os, sys, time, threading, runpy, collections

PASSO = 0.2


def _stack(f):
    out = []
    while f is not None:
        co = f.f_code; out.append('%s:%d:%s' % (os.path.basename(co.co_filename), f.f_lineno or 0, co.co_name)); f = f.f_back
    return ';'.join(reversed(out))


def via(path):
    fo = open(path, 'w', encoding='utf-8', buffering=1 << 16); t0 = time.time()
    def giro():
        me = threading.get_ident()   # this thread, not the one that started it
        while True:
            time.sleep(PASSO)
            nomi = {t.ident: t.name for t in threading.enumerate()}
            fr = sys._current_frames(); fo.write('t %.2f\n' % (time.time() - t0))
            for tid, f in fr.items():
                if tid == me: continue
                fo.write('%s|%s\n' % (nomi.get(tid, tid), _stack(f)))
    th = threading.Thread(target=giro, name='campiona', daemon=True); th.start(); return th


def leggi(path, n=40):
    righe = collections.Counter(); cosa = collections.defaultdict(collections.Counter); attesa = collections.Counter(); prima = {}
    t = 0.0; dt = PASSO
    for ln in open(path, encoding='utf-8'):
        if ln.startswith('t '): t = float(ln[2:]); continue
        nome, _, st = ln.rstrip('\n').partition('|')
        if nome != 'MainThread': continue
        fr = st.split(';'); mod = [x for x in fr if x.startswith('build_data.py:') and x.endswith(':<module>')]
        if not mod: continue
        r = int(mod[0].split(':')[1]); righe[r] += dt; prima.setdefault(r, t)
        dentro = fr[fr.index(mod[0]) + 1:]
        cosa[r][';'.join(x.split(':')[2] + '@' + x.split(':')[0] + ':' + x.split(':')[1] for x in dentro[:3])] += dt
        if any(':result' in x or ':wait' in x for x in dentro): attesa[r] += dt
    tot = sum(righe.values()); print('filo principale: %.0f s' % tot)
    for r, s in righe.most_common(n):
        top = '; '.join('%s %.0fs' % (k[:110], v) for k, v in cosa[r].most_common(2))
        print('%6.1f s  riga %5d  (da %4.0f s)%s  %s' % (s, r, prima[r], '  ATTESA %.0f s' % attesa[r] if attesa[r] else '', top))


if __name__ == '__main__':
    if sys.argv[1] == '--leggi': leggi(sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 40); sys.exit()
    out, script = sys.argv[1], sys.argv[2]
    sys.argv = [script] + sys.argv[3:]; sys.path.insert(0, os.path.dirname(os.path.abspath(script)))
    via(out)
    runpy.run_path(script, run_name='__main__')
