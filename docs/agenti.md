# Foglio per gli agenti

Leggi questo, `CLAUDE.md` e solo le parti di `docs/motore.md` che servono al tuo compito (cerca con grep, non leggerlo tutto).

## Dove sta cosa
- Gioco: `src/*.js` assemblati in `index.html` da `python src/assemble3.py`. Pezzi principali: `world3.js` (tile, superfici, muri), `altezze3.js` (quote `H.*`), `assemble3.py` (fisica e guida, blocchi inseriti), `sfondabili3.js` (barriere che si rompono), `negozi3.js`, `paesaggio3.js` (campi, cantieri), `rotonde3.js`, `segnali3.js`, `police3.js`.
- Build dei dati: `src/build.py <out.json>` lancia `build_data.py`, che chiama `dbgt_strade.py`, `dbgt_righe.py`, `dbgt_verde.py`, `dbgt_manufatti.py`, `dbgt_edifici.py`, `barriere.py`, `corsie_ia.py`, `rotonde.py`. Circa 5 minuti per Meda, deterministica.
- Terreno: `superficie.py`, `impalcati.py`, `terreno_gioco.py` scrivono `terreno/indice.json` + `terreno/pacco.bin` (`terreno_pacco.py`).
- Dati: `data/` (non versionata; dalle copie di lavoro `GTA_DATA=C:/Users/theco/GitHub/GTA-Brianza/data`). DBGT di Meda `data/dbt/Meda/dbgt.gpkg` (lettore `src/dbgt_quote.py`), OSM `data/osm/maplarge.osm`, LiDAR `data/terreno/lidar`, token Mapillary `data/mapillary_token.txt`.
- Python: `C:/Users/theco/GitHub/GTA-Brianza/.venv/Scripts/python.exe` (pacchetti mancanti: installali nella venv).

## Regole
- Ramo tuo da `origin/dev` in una worktree nella tua scratchpad. Mai nella cartella principale, mai `main`.
- Build e terreno solo col gettone (vedi `CLAUDE.md`).
- Niente dati inventati: forme e quote dal DBGT, nomi e attributi da OSM, aspetto da ortofoto o foto; dove non si sa, neutro. Niente regole o coordinate scritte per un comune: regole generali.
- Un muro non sparisce mai: se va tolto da un posto si sposta sul confine.
- Il gioco di Carlo su http://127.0.0.1:8013/ resta acceso. Porta tua, spenta alla fine. Non chiudere processi non tuoi; chiudi i tuoi browser di prova.
- Commit in italiano scritti in un file (`git commit -F`), ultima riga `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Nelle righe lunghe a più istruzioni usa `/* */`, mai `//` a metà riga.

## Prove (proporzionate al compito)
- Sempre: prova di avvio con Playwright (GPU: args `['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu']`, `http://127.0.0.1:<porta>/` non localhost): `window.__G` presente, nessun PAGEERR; `node --check` sullo script più lungo di `index.html` estratto in un `.mjs`.
- Correzione piccola: una o due viste nel punto segnalato e un conteggio. Lavoro grosso (terreno, fisica, traffico): misure prima/dopo complete.
- Il gioco accetta `?x=&z=`; espone `window.__G`. Script di prova da copiare: scratchpad della sessione, cartella `prove` (`h.mjs` e simili).
- Le foto le guardi tu, poche e mirate; non mandarle a Carlo.

## Chiusura
- Rapporto corto: cosa hai cambiato, numeri prima/dopo, problemi aperti, domande per Carlo.
- L'ultimo `index.html` prima di unire in `dev` si assembla con `GTA_RAMO=dev python src/assemble3.py`, così la riga della versione in basso dice "ramo dev" e non il nome del tuo ramo.
- Unione in `dev`, tag `archivio/<ramo>`, cancellazione di ramo e worktree: come dice il compito (dal prossimo giro le unioni le fa l'agente di build a fine giro).
