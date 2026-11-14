# Piano di lavoro a grandi linee

Deciso con Carlo il 9/11/2026 notte, aggiornato il 13/11 sera. I dettagli e lo stato di ogni voce stanno in `todo.md`; qui c'è solo l'ordine dei blocchi grossi. Regola di fondo: prima il gameplay di base, poi i sistemi, missioni e storia alla fine (il gameplay però viene DOPO l'estensione: Carlo, 13/11).

## Fatto (9-13/11)
- three.js 0.186 con luci vere, stagioni, neve; realismo-2: ombre a cascate, occlusione ambientale, antialiasing, alberi d'inverno coi rami 3D, aloni, raggi di sole, finestre accese, riflessi, pozzanghere, vento in tutte le stagioni.
- Chiome almeno 0,45 dell'altezza; varchi-2; niente balconi e finestre sopra le insegne; fari fermi; serrande 3D solo dove davanti ci si arriva con l'auto (case-garage).
- LiDAR di tutta la mappa grande scaricato (170 tessere DTM e DSM).

## 0. Adesso (in corso, ognuno sul suo ramo)
- realismo-3: materiali fotografici con rilievo e tombini, kit delle case (gronde, comignoli, cornicioni, davanzali, zoccoli, cordoli), verde vero (siepi, cespugli, arbusti), riflessi del bagnato, bici, cassonetti, cavi, antenne.
- lotti-chiusi (regole del voto), androni-carrai (passo carraio + cortile cieco), altezze-lidar (case troppo basse e il loro tetto), rotoballe.
- nastri: valutazione del motore, "è adatto a un gioco 3D su più livelli?" (Fable 5.2, solo analisi).

## 1. Prima di estendere la mappa
- **Nastri / il gioco non è 2D**: dopo la valutazione, la conversione (ponti, cavalcavia, svincoli, sottopassi: ogni cosa al suo livello, bordi dritti, attacchi puliti). Va fatta prima di Seregno: la Valassina è piena di svincoli.
- Unire in `dev` i rami di adesso, una build sola.
- Recinzioni e cancelli rimasti: doppioni e cancelli arretrati (caso b2), rete orfana di via Tommaseo (da decidere).
- Case: il tetto delle case a L che il LiDAR scarta (via Verga); terreno ondulato a Seveso (x -653 z 891); alberi nei cantieri.
- **Giro di ottimizzazione, prima di espandere (Carlo 14/11):** sul ramo più pesante (verde + realismo-3) 100 FPS da fermo, ~20 veloci sulla Milano-Meda, ~15 col temporale (che costa ~10 FPS). Il risultato grafico si tiene ("questo risultato lo voglio"), si ottimizza dopo aver unito tutto.

## 2. Estensione della mappa
- Prima verso **Seregno**, a est fino alla Valassina. Dati già pronti per tutta la mappa grande: DBGT di 30 comuni (mancano Cadorago, Inverigo, Vertemate), LiDAR, OSM, Mapillary, Overture.
- Forma finale discussa il 13/11, non decisa (mappa: https://claude.ai/artifact/Vdt5G6n4S2jXqynXad3tjp; idee in `data/confine_gioco/GTA Brianza2.kmz`, fuori da git): base Meda, Seveso, Seregno, Barlassina (golf), Lentate (Milano-Meda); E2 a nord; E1 a sud per il manicomio di Mombello; l'anello di strade di E4 come forma finale. Per il sud (E1, E3, E4) vanno riscaricati LiDAR, OSM e Mapillary.
- La mappa si apre al giocatore a zone, con porte vere (lavori in corso, cantiere della Pedemontana, ferrovia e Seveso).
- Traffico ai bordi della mappa, quando i bordi sono tracciati.
- Dopo l'estensione, a mappa fissata: srosatura degli edifici (macro-azione) insieme al kit per gli edifici pubblici (scuole, chiese, cappelle dei cimiteri).

## 3. Gameplay di base
- Comandi del controller (schemi decisi il 31/10), telecamera e movimento a piedi, tasti PC (lista di Carlo), prima persona, collisioni su tutti gli oggetti.
- Veicoli rifatti (persone e auto non più a cubi, parco vetture con le auto parcheggiate): derapate (asfalto ed erba), dossi che fanno saltare, impennate e stoppie fino a 45°.
- Danni rivisti tutti insieme con il gestore unico (esplosione del benzinaio, atterraggio dell'elicottero...).
- Giocatore rifatto: animazioni, scavalco; nuoto e volo.
- Traffico e pedoni: ingorghi, pedoni bloccati.

## 4. Armi, funzionalità e HUD (insieme)
- Armi e tutte le funzionalità di gioco che ci girano attorno.
- HUD fatto insieme alle armi e alle funzionalità che deve mostrare.

## 5. Sistemi
- Meteo vero (niente pioggia sotto i ripari, nebbia e nuvole rifatte, pioggia più bella), stagioni.
- Suoni (pioggia, vento, traffico, campane).
- Menu delle opzioni; title screen con inquadrature su posti belli; via il codice morto (riga della versione).

## 6. Missioni e storia (insieme)
- Idee già segnate: salto sulla ferrovia a Meredo (x 1728 z 530), fuga dall'elicottero nel cantiere di Meredo (x 1637 z 933).

## Più avanti, da valutare coi numeri
- WebGPU, se dopo le prove fps il disegno resta il collo di bottiglia.
