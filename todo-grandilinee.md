# Piano di lavoro a grandi linee

Deciso con Carlo il 9/11/2026 notte. I dettagli e lo stato di ogni voce stanno in `todo.md`; qui c'è solo l'ordine dei blocchi grossi. Regola di fondo: prima il gameplay di base, poi i sistemi, missioni e storia alla fine.

## 0. Adesso
- three.js 0.186 in tre fasi: funziona, colori e luci veri (anche luce delle stagioni e del meteo), realismo (fari, lampioni, asfalto bagnato...).
- Chiome degli alberi almeno 0,45 dell'altezza; varchi e cancelli (varchi-2); niente balconi, finestre e oggetti sopra le insegne.
- Poi: prove fps vere sul PC di Carlo (riferimento 165 FPS in alta qualità), antialiasing.

## 1. Mappa pulita
- "Nastro unico" di strade, ponti e fiumi: si parte dai 10 posti peggiori (cavalcavia, attraversamenti dei fiumi).
- Recinzioni e cancelli: varchi rimasti, doppioni, lotti privati.
- Terreno ondulato, case che escono come garage, alberi nei cantieri.

## 2. Estensione della mappa
- Altri comuni: tutte le regole sono già generali, poi un giro di controllo sulla mappa nuova.
- Dopo l'estensione, a mappa fissata: srosatura degli edifici (macro-azione) insieme al kit per gli edifici pubblici (scuole, chiese, cappelle dei cimiteri).

## 3. Gameplay di base
- Veicoli rifatti: derapate (asfalto ed erba), dossi che fanno saltare, impennate e stoppie fino a 45°.
- Danni rivisti tutti insieme con il gestore unico (esplosione del benzinaio, atterraggio dell'elicottero...).
- Giocatore rifatto: animazioni, scavalco; nuoto e volo.
- Traffico e pedoni: ingorghi, pedoni bloccati.

## 4. Armi, funzionalità e HUD (insieme)
- Armi e tutte le funzionalità di gioco che ci girano attorno.
- HUD fatto insieme alle armi e alle funzionalità che deve mostrare.

## 5. Sistemi
- Meteo vero (niente pioggia sotto i ripari), stagioni.
- Menu delle opzioni; title screen con inquadrature su posti belli; via il codice morto (riga della versione).

## 6. Missioni e storia (insieme)
- Idee già segnate: salto sulla ferrovia a Meredo (x 1728 z 530), fuga dall'elicottero nel cantiere di Meredo (x 1637 z 933).

## Più avanti, da valutare coi numeri
- WebGPU, se dopo three.js e le prove fps il disegno resta il collo di bottiglia.
