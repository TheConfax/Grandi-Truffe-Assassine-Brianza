# Regole per Claude

- **Ramo `motore`**: qui si rifà il fondo del motore (un modello unico del mondo: terreno, strade, ponti, acqua). Si prova solo in locale, non va su GitHub Pages. Se sei su questo ramo committa e pusha qui, non su `main`; il piano e dove siamo sono in `todo.md`, sezione "Motore nuovo".
- **Fotorealismo**: il ramo `fotorealismo` è entrato in `main` il 23/10/2026 e non si usa più. La grafica realistica si continua su `main`; le note sono in `todo.md`, sezione "Fotorealismo".

- Sei autorizzato a fare commit e push direttamente su `main`, senza chiedere. Niente rami a parte, niente richieste di conferma.
- Dopo ogni modifica ai sorgenti in `src/` rigenera `index.html` con `python src/assemble3.py` e committa entrambi.
- Prima di pushare fai `git pull` su `main`: altre sessioni ci lavorano in parallelo.
- Quando piazzi elementi (siepi, alberi, aiuole, aperture, panchine) in un luogo simmetrico, disponili simmetrici rispetto agli assi del luogo, non copiando le geometrie irregolari di OSM. E lascia sempre un modo per entrare negli spazi chiusi (chiostri, cortili).
- Prima di mandare uno screenshot guardalo bene: niente oggetti in mezzo alla strada, niente edifici finti su viali e piazzali.
