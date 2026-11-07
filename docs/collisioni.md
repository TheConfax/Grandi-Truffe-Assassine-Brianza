# Collisioni: cosa si vede solido ma si attraversa

Censimento del 7/11/2026 (ramo `collisioni`), chiesto da Carlo. Qui ci sono solo gli oggetti che auto o pedone attraversano: nessuno di questi è stato corretto, li sistemerà chi decide Carlo. L'unico corretto su questo ramo è il totem dei distributori (vedi in fondo).

## Come è stato fatto

1. **Censimento automatico** su 29 punti sparsi per Meda, Seveso e dintorni (centri, stazioni, parchi, parcheggi, distributori, periferie). Per ogni tile costruito, ogni mesh è stata divisa in pezzi (le istanze, o i gruppi di vertici attaccati). Si tengono i pezzi che stanno ad altezza di auto o pedone (sopra 0,45 m dal suolo, con la base sotto 1,6 m, larghi meno di 14 m) e per ognuno si guarda se nella griglia `WALLS` c'è un muro, un palo o un oggetto abbattibile che lo copre. Ogni pezzo è legato alla fetta di `buildTileGen` che l'ha disegnato.
2. **Prove vere** in headless sugli oggetti trovati e su un campione di quelli solidi: un'auto guidata dal giocatore che parte da 10 m e va a tutto gas contro l'oggetto, e il pedone che ci cammina contro da 3 m, ciascuno da una o due direzioni con la rincorsa libera. "Passa" vuol dire che il centro dell'auto o del pedone è andato oltre il centro dell'oggetto.

Script: `coll_h.mjs`, `coll_censo.mjs`, `coll_spinta.mjs` nella cartella `prove` della scratchpad della sessione.

## Oggetti senza collisione

Nessuno di questi si rompe, si abbatte o si sposta: l'auto ci passa dentro, piano e forte.

| Oggetto | Funzione (file:riga) | Auto | Pedone | Comportamento oggi | Dove vederlo (x z) |
|---|---|---|---|---|---|
| Pali della pensilina dei binari (3,4 m) | `buildPlatforms`, src/landmarks3.js:91 | — (*) | passa | attraversabile | 353.6 -510.9 (Meda FNM) |
| Panchine sui binari | `buildPlatforms`, src/landmarks3.js:96 | passa | passa | attraversabile | -1056.5 1005.9 (Seveso), 1141.6 -2057.4 |
| Lampioni dei binari (4,6 m) | `buildPlatforms`, src/landmarks3.js:100 | — (*) | passa | attraversabile | -1035.8 1062.1, -1616 -1275.3 |
| Pali del cartello col nome della stazione | `buildPlatforms`, src/landmarks3.js:101 | — (*) | passa | attraversabile | -1039 1041.8 |
| Ringhiera e pali della tettoia della scala al sottopasso | `buildPlatforms`, src/landmarks3.js:107 | passa | passa | attraversabile | 362.3 -520.3 |
| Lampioni dei parcheggi (7,6 m, due teste) | `buildParkingLines`, src/landmarks3.js:336 | passa | passa | attraversabile | -241.2 1887.1 (Famila), 23.9 -635.5 |
| Parchimetro (palo scuro con la testa gialla) | `buildParkingLines`, src/landmarks3.js:346 | passa | passa | attraversabile | 1622.05 209.6 (Unes, via Indipendenza), 301.5 -418.6 |
| Lampioni dei parchi (4 m) | `buildParkFurniture`, src/landmarks3.js:391 | passa | passa | attraversabile | 2228.5 -323.8, 1114.9 -2093.7 (parco della Libertà) |
| Pensilina del bus: i due pali alle estremità e il palo del cartello | `buildSignals`, src/world3.js:3073 e 3076 | si abbatte (**) | passa | la pensilina si abbatte, i pali alle estremità no | 48.6 1909.7, -1372.3 1650.7 |
| Pilastri di alcuni cancelli isolati (senza recinzione attorno) | `buildGates`, src/world3.js:2589 | passa | fermo | attraversabile in auto | -1582.4 -1082.1, 246.7 -604.3 |
| Scale a pioli dei silos (fuori dal silo di 25 cm) | `buildManufatti`, src/oggetti3.js:234 | passa | passa | attraversabile | -880 -239.4 |

(*) Sui marciapiedi dei binari l'auto non sale quasi mai: la ferma il bordo del marciapiede, non l'oggetto. Dove ci sale (1141.6 -2057.4) passa.

(**) La pensilina del bus è un oggetto abbattibile con un solo cerchio di 1,1 m al centro: l'auto veloce la abbatte, piano si ferma. Il pedone però passa dentro i pali alle estremità (sono a 1,6 m dal centro) e dentro il palo del cartello della fermata.

### Il caso di Carlo all'Unes (1622.3 205.1)

Il "palo scuro con la testa gialla accesa" è il **parchimetro** del parcheggio (`buildParkingLines`, src/landmarks3.js:346): non è abbattibile e non ha muro, quindi l'auto e il pedone ci passano attraverso (prova: auto oltre di 44 m, pedone oltre di 5 m). Accanto c'è una colonnina di ricarica (oggetto OSM `ricarica`, abbattibile) a circa 1 m. È probabile che l'urto sentito fosse quello della colonnina. Il cartello P lì vicino invece si abbatte.

La **colonnina di ricarica** a destra nella foto (1617.8 207.6) è messa alla quota giusta: la base è a 32.63, uguale al suolo `H.ground`, e vista da vicino in basso poggia sull'asfalto. Nella foto sembrava sospesa per l'ombra, che con il sole basso cade lontana dalla base. Ferma il pedone e l'auto la abbatte, come deve.

### Casi isolati (pochi pezzi, da guardare solo se capita)

- Arredi davanti ad alcuni negozi (pannelli sottili alti 2,4 m): 9 pezzi su 2300, es. -1377.2 1637.4 e -909.9 1172.9 (`negozi3.js`).
- Paletti di recinzione: 3 su 23 000, es. -78.5 -733.3.

## Cosa è solido e cosa succede quando l'auto ci va contro

"Piano" vuol dire a passo d'uomo, "forte" sopra la soglia indicata (3,5 m/s sono 12,6 km/h). "Si abbatte": cade e resta a terra, il suo muro sparisce. "Si rompe": il pezzo colpito vola via in frammenti. "Fisso": ferma l'auto a qualunque velocità, senza muoversi. Nessun oggetto fisso del mondo "si sposta" (lo fanno solo i veicoli).

| Oggetto | Funzione | Piano | Forte | Pedone | Punto di prova |
|---|---|---|---|---|---|
| Alberi | world3.js:168 | ferma | **fisso** | ferma | 120.7 -548.3 |
| Rotoballe di fieno | paesaggio3.js:357 | ferma | **fisso** (provato a 61 km/h da 4 lati: non si muove né si rompe) | ferma, ci si sale sopra | 2202.6 1568.3, 2239.9 1509.1 |
| Lampioni di strada | world3.js:2455, props3.js | ferma | si abbatte (da 3,5 m/s) | ferma | -8.9 -581.3 |
| Cartelli stradali e semafori | segnali3.js, world3.js:3039 | ferma | si abbatte (da 3,5 m/s) | ferma | 365.7 -549.1 |
| Cartello P dei parcheggi | landmarks3.js:345 | ferma | si abbatte | ferma | 1622.4 208.1 |
| Pensilina del bus (il centro) | world3.js:3079 | ferma | si abbatte | vedi sopra | 48.6 1909.7 |
| Panchine e cestini dei parchi | landmarks3.js:356 | ferma | si abbatte | ferma | 1113.3 -2115.5 |
| Oggetti OSM piccoli: pali, paletti, idranti, campane del vetro, colonnine di ricarica, panchine, cestini, fontanelle, telecamere, distributori automatici, rastrelliere, cassette postali, tavoli da picnic | oggetti3.js:10 (`knock`) | ferma | si abbatte (da 3,5 m/s) | ferma | 1617.8 207.6 (colonnina Unes) |
| Oggetti OSM grandi: blocchi di cemento, tralicci, antenne, giochi dei parchi, armadietti, pannelli, attrezzi fitness, torri dell'acqua | oggetti3.js:10 | ferma | **fisso** | ferma | dal censimento |
| Tombe | sfondabili3.js:332 | ferma | si abbatte (da 6 m/s) | ferma | non provato |
| Siepi | sfondabili3.js:10 | ferma | si apre un buco largo come l'auto (da 2,5 m/s), l'auto rallenta | ferma | 2735.6 1104.9 |
| Reti metalliche e staccionate | sfondabili3.js:9 | ferma | si rompe il pannello colpito (da 3 m/s) | ferma | -1303.3 1122.8, 235.7 -733.2 |
| Muri, muretti con ringhiera, muri di contenimento, recinzioni della ferrovia | world3.js, barriere | ferma | **fisso** | ferma | 149.3 -362.6, 2652.3 1159.6 |
| Ante dei cancelli | world3.js:2609 | ferma | si sfonda (da 3 m/s) | ferma | -3.5 -590.4 |
| Pilastri dei cancelli con recinzione | world3.js:2589 | ferma | **fisso** | ferma | -3.5 -590.4 |
| Fontane | world3.js:2653 | ferma | **fisso** | ferma | 1102.7 -2031.3 |
| Cespugli delle rotonde | rotonde3.js:66 | ferma | **fisso** | ferma | dal codice |
| Distributori: colonnine | world3.js:2775 | ferma | **esplode** e prende fuoco (da 3 m/s), fa esplodere le vicine | ferma | -845.7 1632.1 |
| Distributori: pilastri della pensilina e totem | world3.js:2775 | ferma | **fisso** | ferma | -841.8 1629, -859.4 1636.1 |
| Sbarre del passaggio a livello | world3.js:3087 | ferma | il braccio si spezza e vola, il palo si abbatte | ferma | non provato |
| Arredi dei negozi | negozi3.js:896 | ferma | quello provato **fisso**; i piccoli si abbattono | ferma | 22.1 -603.5 |
| Silos, cisterne, vasche | oggetti3.js:193 | ferma | **fisso** | ferma | dal codice |
| Edifici | world3.js:149 | ferma | **fisso** | ferma | ovunque |

## Limiti del censimento

- Sono esclusi i pezzi lunghi più di 14 m (recinzioni, muri, siepi lunghe): nel censimento i loro pezzi corti risultano tutti coperti da muri, e una siepe provata con auto e pedone (1.8 -652.5) ferma.
- Sono esclusi i pezzi bassi (sotto 0,45 m: cordoli, fermaruote, aiuole), che l'auto sale.
- Un oggetto attaccato a un muro risulta coperto dal muro anche se non ne ha uno suo: lì l'elenco può averne perso qualcuno.
- Non sono capitati nei punti campione: cimiteri, campi sportivi e cantieri (`paesaggio3.js`). Dal codice hanno tutti muri (`solidAt`, `TOMBE`, cipressi a world3.js:3000), ma non li ho provati.

## Corretto su questo ramo

**Totem dei prezzi dei distributori** (`buildFuel` / `layPompe`, src/world3.js): ora ha un muro a due facce lungo la faccia del totem (1,6 m, alto 4,4 m), come i pali. La posizione sta in `FUEL_TOT`, la stessa per il disegno e per il muro. Prima l'auto passava oltre il totem del MORO di 9,6 m e il pedone di 5,4 m. Ora l'auto si ferma a circa 2 m dal centro e il pedone a 0,4 m, su MORO (-859.4 1636.1), Eni (756.0 -102.5) ed Esso (560.1 -349.3). Colonnine e pilastri della pensilina erano già solidi.
