"""Le decisioni della build che guardano tutta la mappa (una mediana su tutte le strade, la soglia del classificatore dei demoliti...), scritte dalla build
completa e lette dalla build attorno al punto (src/zona.py), che vede solo un pezzo di mappa: così i suoi pezzi sono quelli della build completa.
  build completa: build_data.py le calcola come sempre e le scrive in costanti_build.json accanto al suo out.json (GTA_COSTANTI_SCRIVI)
  build attorno al punto: GTA_COSTANTI_LEGGI=<costanti_build.json della build completa>; un nome che manca si calcola sul pezzo di mappa (e lo dice)
Fuori dalla build (terreno, prove) niente si scrive e niente si legge: si calcola."""
import json, os

LEGGI = os.environ.get('GTA_COSTANTI_LEGGI')
_letti = json.load(open(LEGGI, encoding='utf-8')) if LEGGI and os.path.exists(LEGGI) else {}
_scritti = {}
mancanti = []


def costante(nome, calcola):
    """il valore della build completa se c'è (lettura), altrimenti calcola(); un valore JSON (numeri, liste, dizionari con chiavi stringa)"""
    if LEGGI:
        if nome in _letti: return _letti[nome]
        mancanti.append(nome); print('costanti: %s manca in %s, calcolata sul pezzo di mappa' % (nome, LEGGI), flush=True)
    v = calcola(); _scritti[nome] = v
    return v


def letta(nome):
    """il valore della build completa, None se non c'è o se non si sta leggendo"""
    return _letti.get(nome) if LEGGI else None


def scrivi(nome, v):
    """una decisione della build completa da tenere (senza calcola: la scrive chi l'ha presa)"""
    if not LEGGI: _scritti[nome] = v


def salva():
    f = os.environ.get('GTA_COSTANTI_SCRIVI')
    if f and not LEGGI: open(f, 'w', encoding='utf-8').write(json.dumps(_scritti, ensure_ascii=False, sort_keys=True, separators=(",", ":")))


class Sorteggi:
    """un generatore usato in fila su tutta la mappa (gli alberi sparsi nei boschi, uno dopo l'altro): la build completa scrive lo stato del generatore
    prima di ogni pezzo (chiave: il pezzo), la build attorno al punto lo rimette prima dello stesso pezzo e così sorteggia gli stessi numeri"""
    def __init__(s, nome, rng):
        s.nome, s.rng, s.letti, s.scritti, s.visti = nome, rng, (letta(nome) or {}), {}, {}

    def prima(s, chiave):
        k = s.visti.get(chiave, 0); s.visti[chiave] = k + 1
        if LEGGI:
            st = s.letti.get(chiave)
            if st and k < len(st): s.rng.bit_generator.state = st[k]
        else: s.scritti.setdefault(chiave, []).append(s.rng.bit_generator.state)

    def fine(s): scrivi(s.nome, s.scritti)
