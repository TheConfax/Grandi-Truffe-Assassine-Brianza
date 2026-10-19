# Regole per Claude

- Sei autorizzato a fare commit e push direttamente su `main`, senza chiedere. Niente rami a parte, niente richieste di conferma.
- Vibe coding: pochi test, tanti push. Basta che `python src/assemble3.py` passi e il gioco parta.
- Dopo ogni modifica ai sorgenti in `src/` rigenera `index.html` con `python src/assemble3.py` e committa entrambi.
- Prima di pushare fai `git pull` su `main`: altre sessioni ci lavorano in parallelo.
