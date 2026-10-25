# Regole per Claude

- **Motore nuovo**: dal 25/10/2026 è in `main` e si lavora lì. Il ramo `motore` non si usa più. Il piano e dove siamo sono in `todo.md`, sezione "Motore nuovo".
- **Fotorealismo**: il ramo `fotorealismo` è entrato in `main` il 23/10/2026 e non si usa più. La grafica realistica si continua su `main`; le note sono in `todo.md`, sezione "Fotorealismo".

- **Rami (dal 25/10/2026)**: ogni modifica si fa su un ramo suo, partito da `dev`, che a lavoro verificato torna su `dev`. Sei autorizzato a fare commit, push e merge fino a `dev` senza chiedere. `main` vuol dire "visto da Carlo": `dev` entra in `main` solo quando lo dice lui. GitHub Pages pubblica `main`. `dev` e `main` sono rami permanenti: non si cancellano mai.
- Quando un ramo è unito in `dev`: tag `archivio/<nome-ramo>` sul suo ultimo commit, push del tag, poi cancella il ramo (locale e su GitHub) e la sua copia di lavoro.
- Dopo ogni modifica ai sorgenti in `src/` rigenera `index.html` con `python src/assemble3.py` e committa entrambi.
- Prima di pushare fai `git pull` sul ramo di arrivo (`dev`): altre sessioni ci lavorano in parallelo.
- Prima di mandare uno screenshot guardalo bene: niente oggetti in mezzo alla strada, niente edifici finti su viali e piazzali.
