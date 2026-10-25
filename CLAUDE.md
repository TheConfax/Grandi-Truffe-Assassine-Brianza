# Regole per Claude

- **Motore nuovo**: dal 25/10/2026 è in `main` e si lavora lì. Il ramo `motore` non si usa più. Il piano e dove siamo sono in `todo.md`, sezione "Motore nuovo".
- **Fotorealismo**: il ramo `fotorealismo` è entrato in `main` il 23/10/2026 e non si usa più. La grafica realistica si continua su `main`; le note sono in `todo.md`, sezione "Fotorealismo".

- Ogni modifica si fa su un ramo suo, che a lavoro verificato torna su `main` (dal 25/10/2026). Sei autorizzato a fare commit, push e merge in `main` senza chiedere, niente richieste di conferma.
- Quando un ramo è unito in `main`: tag `archivio/<nome-ramo>` sul suo ultimo commit, push del tag, poi cancella il ramo (locale e su GitHub) e la sua copia di lavoro.
- Dopo ogni modifica ai sorgenti in `src/` rigenera `index.html` con `python src/assemble3.py` e committa entrambi.
- Prima di pushare fai `git pull` su `main`: altre sessioni ci lavorano in parallelo.
- Prima di mandare uno screenshot guardalo bene: niente oggetti in mezzo alla strada, niente edifici finti su viali e piazzali.
