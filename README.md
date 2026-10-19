# Grandi Truffe Assassine · Brianza

Gioco in stile GTA nel browser, ambientato a Meda, Seveso, Barlassina, Baruccana e Cabiate con strade, edifici e dislivelli veri. Three.js, un solo file HTML più i dati della mappa.

## Giocare

- Online: GitHub Pages di questo repository.
- In locale: `python -m http.server 8000` in questa cartella, poi apri http://localhost:8000/

La radio in macchina (Discoradio, stream ufficiale) funziona solo fuori da claude.ai.

## Struttura

- `index.html`: il gioco completo
- `brianza.json`: mappa generata dalla pipeline
- `src/`: sorgenti (`build_data.py` pipeline dei dati, `world3.js` mondo, `extras.js` giorno/notte, danni, radio, `assemble3.py` che monta `game.src.html` nel gioco finale)
- `data/`: dati grezzi (OSM, Overture, WorldCover), esclusi da git perché troppo grandi

## Crediti dei dati

- Strade, edifici, luoghi: © OpenStreetMap contributors, ODbL
- Quote del terreno: Tarquini S. et al. (2023), TINITALY 1.1, INGV, doi:10.13127/tinitaly/1.1, CC BY 4.0
- Edifici aggiuntivi e altezze: Overture Maps Foundation, ODbL
- Copertura del suolo: © ESA WorldCover project 2021, contiene dati Copernicus Sentinel modificati (2021) elaborati dal consorzio ESA WorldCover, CC BY 4.0

Il file `brianza.json` è un database derivato da OpenStreetMap e Overture ed è distribuito con licenza ODbL.
