# Collisioni degli oggetti

## La regola (Carlo, 8/11/2026)

- Tutto ciò che si vede collide. Ogni oggetto ha una collisione sola, i suoi pali o il suo ingombro nella griglia `WALLS`, e la stessa vale per il pedone, l'auto, la moto, la bici e l'elicottero.
- Quello che succede dipende dalla forza dell'urto, cioè la velocità per la massa del mezzo (`propForza`, src/props3.js). Un urto piano ferma. Un urto forte rompe l'oggetto, se è rompibile.
- A piedi non si sfonda niente. L'elicottero segue la stessa regola dei mezzi, con la massa di un furgone (circa 2,5 t): sopra soglia abbatte o sposta, sotto soglia si ferma (`propHitsElicottero`, chiamata da `heliStep1` prima di `heliPush`). I suoi danni non sono cambiati.
- Tre gruppi (`FORZA` in src/props3.js):

| Gruppo | Soglia per un'auto compatta | Cosa fa |
|---|---|---|
| **leggero** | 8,3 m/s (30 km/h) | si abbatte o si rompe |
| **medio** | 16,7 m/s (60 km/h) | serve velocità e massa: si abbatte, oppure si sposta (le rotoballe rotolano, i blocchi di cemento scivolano) |
| **indistruttibile** | mai | ferma a qualunque velocità |

La massa è quella che il gioco usa già negli urti tra mezzi: un mezzo a due ruote pesa un quarto di un'auto. Per le auto la massa va con l'ingombro (lunghezza per larghezza, rispetto alla compatta che vale 1), tra 0,5 e 3. Il furgone vale 1,4, come l'elicottero. Quindi:

- il furgone abbatte un oggetto leggero da 21 km/h e un medio da 43 km/h;
- l'elicottero ha le stesse soglie del furgone;
- uno scooter o una bici non abbattono niente (servirebbero 120 km/h).

Una rotoballa o un blocco spinto parte nella direzione del mezzo, rallenta per l'attrito, si ferma contro i muri e torna solido dove si ferma. Se il tile viene ricostruito resta lì. Gli oggetti abbattuti restano giù, come i lampioni di prima.

Le barriere di `sfondabili3.js` (siepi, reti, staccionate) e le tombe tengono le soglie che avevano, solo in velocità: siepi 2,5 m/s, reti e staccionate 3 m/s, tombe 6 m/s. Le colonnine dei distributori esplodono da 3 m/s.

## Ogni oggetto

| Oggetto | Funzione | Gruppo | Piano | Forte |
|---|---|---|---|---|
| Cartelli stradali, semafori | `buildSegnali`, `buildSignals` | leggero | ferma | si abbatte |
| Cartello P dei parcheggi | `buildParkingLines` | leggero | ferma | si abbatte |
| **Parchimetro** (prima attraversabile) | `buildParkingLines`, `propIstanze` | leggero | ferma | si abbatte |
| **Tabella col nome della stazione** (prima i pali erano attraversabili) | `buildPlatforms` | leggero | ferma | si abbatte intera |
| **Totem dei prezzi dei distributori** | `buildFuel` | leggero | ferma | si abbatte |
| Panchine e cestini dei parchi | `parkProps` | leggero | ferma | si abbatte |
| **Panchine dei binari** (prima attraversabili; ora sono la panchina dei parchi) | `buildPlatforms`, `parkProps` | leggero | ferma | si abbatte |
| Oggetti OSM piccoli (pali, paletti, idranti, campane del vetro, colonnine di ricarica, panchine, cestini, fontanelle, telecamere, distributori automatici, rastrelliere, cassette postali, tavoli da picnic) | `buildOggetti` | leggero | ferma | si abbatte |
| Pannelli dei cantieri | `paesaggio3.js` | leggero | ferma | si abbatte |
| Siepi, reti, staccionate | `sfondabili3.js` | leggero (soglie loro) | ferma | si apre o si rompe il pezzo colpito |
| Tombe | `sfondabili3.js` | (soglia loro, 6 m/s) | ferma | si abbatte |
| **Lampioni di strada** (prima si abbattevano da 12,6 km/h) | world3.js, `LPS` | medio | ferma | si abbatte e si spegne |
| **Lampioni dei parcheggi** (prima attraversabili) | `buildParkingLines`, `propIstanze` | medio | ferma | si abbatte |
| **Lampioni dei parchi** (prima attraversabili) | `buildParkFurniture`, `propIstanze` | medio | ferma | si abbatte |
| **Lampioni dei binari** (prima attraversabili) | `buildPlatforms`, `propIstanze` | medio | ferma | si abbatte |
| **Alberi piccoli** (sotto i 7 m del DSM, il modello piccolo; prima fissi) | world3.js, `TREE_PROPS` | medio | ferma | si abbatte |
| **Pensiline del bus** (prima si abbattevano da 12,6 km/h e i pali alle estremità erano attraversabili) | `buildSignals` | medio | ferma | si abbatte con i suoi pali |
| **Rotoballe** (prima fisse) | `paesaggio3.js` | medio | ferma | rotola via, poi torna solida dove si ferma |
| **Blocchi di cemento** (prima fissi) | `buildOggetti` | medio | ferma | scivola via, poi torna solido |
| Alberi grandi (dal DSM 7 m o più, e quelli senza altezza) | world3.js | indistruttibile | ferma | ferma |
| Edifici, muri, muretti con ringhiera, muri di contenimento, recinzioni della ferrovia | world3.js, barriere | indistruttibile | ferma | ferma |
| Tralicci, antenne, torri dell'acqua, giochi, armadietti, pannelli, attrezzi fitness | `buildOggetti` | indistruttibile | ferma | ferma |
| Silos, cisterne, vasche; **le scale dei silos** ora attaccate al silo (prima 25 cm fuori) | `buildManufatti` | indistruttibile | ferma | ferma |
| Fontane | `layFontana` | indistruttibile | ferma | ferma |
| Cespugli delle rotonde | `rotonde3.js` | indistruttibile | ferma | ferma |
| Colonnine dei distributori | `layPompe` | (esplodono, 3 m/s) | ferma | esplode |
| Pilastri della pensilina dei distributori | `layPompe` | indistruttibile | ferma | ferma |
| **Pilastri dei cancelli** (prima solo quelli con la recinzione accanto) | `layCancelli` | indistruttibile | ferma | ferma |
| Ante dei cancelli | `gateHits` | (si sfondano da 3 m/s) | ferma | si sfonda |
| **Pali della pensilina dei binari** (prima attraversabili; reggono il tetto) | `buildPlatforms` | indistruttibile | ferma | ferma |
| **Ringhiera e pali della tettoia della scala del sottopasso** (prima attraversabili) | `buildPlatforms` | indistruttibile | ferma | ferma |

## Prove delle soglie (headless, 8/11 sera)

| Prova | Punto x z | Esito |
|---|---|---|
| Auto a 25 km/h contro un parchimetro (leggero) | 1622.05 209.6 | si ferma, il parchimetro resta in piedi |
| Auto a 40 km/h contro lo stesso parchimetro | 1622.05 209.6 | lo abbatte e passa |
| Auto a 50 km/h contro un lampione del parcheggio (medio) | -241.2 1887.1 | si ferma, il lampione resta in piedi |
| Auto a 70 km/h contro lo stesso lampione | -241.2 1887.1 | lo abbatte e passa |
| Auto a 50 km/h contro una rotoballa | 2202.6 1568.3 | si ferma, la rotoballa resta lì |
| Auto a 70 km/h contro la stessa rotoballa | 2202.6 1568.3 | la rotoballa rotola via di 24 m |
| Elicottero a 30 km/h contro un lampione del parco | 2228.5 -323.8 | si ferma, il lampione resta in piedi |
| Elicottero a 80 km/h contro lo stesso lampione | 2228.5 -323.8 | lo abbatte |

Avvio senza errori in console.

Le prove qui sotto sono del giro con le soglie vecchie (3,5 e 9 m/s). Valgono ancora gli esiti del pedone e dell'auto piano. Le colonne "auto forte" sono superate dalla tabella sopra.

## Prove (headless, 8/11)

Pedone che cammina contro l'oggetto. Auto compatta piano (frenata a 2,5 m/s) e forte (a tutto gas da 25 m, 15–23 m/s), con il traffico tolto dalla strada della prova.

| Oggetto | Punto x z | Pedone | Auto piano | Auto forte |
|---|---|---|---|---|
| Parchimetro (leggero) | 1622.05 209.6 (Unes) | fermo | ferma | abbattuto a 22,8 m/s |
| Totem MORO (leggero) | -859.4 1636.1 | fermo | ferma | abbattuto a 20,6 m/s |
| Totem Eni (leggero) | 756.0 -102.5 | fermo | ferma | abbattuto a 23,1 m/s |
| Lampione del parcheggio (medio) | -241.2 1887.1 | fermo | ferma | abbattuto a 20,6 m/s |
| Lampione del parco (medio) | 2228.5 -323.8 | fermo | ferma | abbattuto a 24,8 m/s |
| Lampione di strada (medio) | -8.9 -581.3 | fermo | ferma | abbattuto a 15,9 m/s |
| Albero piccolo (medio) | 573 -300.5 | fermo | ferma | abbattuto a 11,2 m/s |
| Pensilina del bus (medio) | 421.22 -392.38 | fermo | ferma | abbattuta a 16,9 m/s |
| Rotoballa (medio, rotola) | 2239.9 1509.1 | fermo | ferma | rotolata via di 18 m |
| Fontana (indistruttibile) | 1102.7 -2031.3 | fermo | ferma | ferma |
| Blocco di cemento (medio, scivola) | nessuno nei 10 punti cercati | — | — | non provato: stesso codice della rotoballa, senza rotolare |
| Pilastro di cancello isolato (indistruttibile) | -1582.4 -1082.1 | fermo | ferma | ferma a 17 m/s |
| Albero grande (indistruttibile) | 120.7 -548.3 | fermo | ferma | ferma a 17 m/s |
| Palo della pensilina dei binari (indistruttibile) | 353.6 -510.9 | fermo | — | — |
| Tabella della stazione, panchina e lampione dei binari | 389.33 -528.1, 388.07 -527.11, 433.11 -567.48 | fermo | — | — |

Sui marciapiedi dei binari l'auto non arriva: la ferma il bordo del marciapiede. Per gli oggetti dei binari conta il pedone. L'avvio è senza errori in console.

## Rimasti da fare

- **Pannelli delle vetrine**: 9 pezzi su 2300 (es. -1377.2 1637.4, -909.9 1172.9). Sono parti delle facciate dei negozi (`negozi3.js`): un montante della tenda o della cornice che sta fuori dal muro dell'edificio. Non ho trovato in tempo quale pezzo del modello sia; servono una foto da vicino e un giro sul codice delle tende.
- **3 pali di recinzione** su 23 000 (es. -78.5 -733.3, -1304.4 1572.3): pali alla fine di una recinzione, dove il tratto del muro finisce prima del palo. Non corretti.
- Le altezze restano diverse per chi va a piedi e per chi va in mezzo, come prima. Per l'auto un muretto basso è alto almeno 1,2 m (`yv`), così non lo scavalca. A piedi il muro di un edificio arriva fino al tetto (`yp`). L'ingombro è lo stesso per tutti.

## Il censimento del 7/11

Il primo giro aveva trovato gli oggetti attraversabili con un censimento automatico su 29 punti: ogni mesh dei tile divisa in pezzi, e per ognuno la ricerca di un muro che lo copra in `WALLS`. Poi auto e pedone sono stati spinti contro gli oggetti trovati. L'elenco di allora è la colonna "prima attraversabile" della tabella sopra. Script: `coll_h.mjs`, `coll_censo.mjs`, `coll_spinta.mjs`, `coll_gruppi.mjs` nella cartella `prove` della scratchpad della sessione.
