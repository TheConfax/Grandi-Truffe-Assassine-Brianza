# Sotto terra a Meda: censimento e proposta per il motore

La tappa 1 è fatta (26/10): vedi la sezione "Tappa 1 fatta" qui sotto. Indagine del 25/10/2026 (ramo `sottoterra`), dopo che Carlo ha trovato la falla: il motore non sa disegnare niente sotto la superficie, perché il terreno è una griglia di quote unica (`S`, `docs/motore.md` 1.1). Qui c'è l'elenco di quello che sta sotto terra a Meda (autorimesse e parcheggi interrati, rampe, sottopassi, gallerie), quali fonti lo vedono, cosa c'è oggi nel gioco in quel punto, e una proposta in due tappe. Non ho toccato né il gioco né la build: ho solo letto dati e codice. La scelta spetta a Carlo.

## In breve

- **379 casi**, di cui 81 visti dal DBGT o da OSM (Tabella 1) e 298 visti solo dal LiDAR (Tabella 2). Quelli sicuri sono pochi. Le **autorimesse interrate** sono 60: 29 hanno insieme un volume interrato del DBGT e una fossa nel LiDAR, 3 un parcheggio OSM e una fossa, 26 solo il volume del DBGT. Le **rampe probabili** sono 225, viste solo dal LiDAR: 67 hanno un passo carraio del DBGT in testa. Ci sono poi 68 cortili ribassati o scavi, 7 sottopassi stradali e 2 pedonali.
- Il campione guardato sull'ortofoto 2018-19 dice che tra le "rampe" del solo LiDAR circa una su due è davvero una rampa: su 16, 8 rampe, 5 dubbi e 3 no. Le altre sono cortili ribassati, bocche di lupo o scavi del 2008 su cui poi si è costruito.
- **Oggi nel gioco** quasi tutte queste fosse ci sono già, perché `S` segue il LiDAR del 2008 fuori dalle strade del DBGT. Però sono conche morbide: la griglia ha passo 2 m e non ha muri, porte né fondo. Le autorimesse viste solo dal DBGT non hanno niente, perché il volume interrato (`UN_VOL_POR 08`) non si disegna. I sottopassi stradali funzionano già con gli impalcati della fase 3, tranne uno sotto la Milano-Meda sul confine (x −767 z 103), dove la via incrocia la Milano-Meda a raso su un dosso di 6 m. Il sottopasso pedonale della stazione è chiuso: c'è la copertura, ma mancano le scale.
- **Via Mazzini** non è spianata ma il contrario. Il LiDAR del 2008 ha visto lo scavo di un cantiere, profondo 6-9 m. Nel 2015 al suo posto ci sono un palazzo nuovo con piscina, un giardino con le prese d'aria dell'autorimessa (OSM `parking=underground`) e un cortile a piano strada (DBGT). Il gioco disegna ancora lo scavo del 2008: una conca di 5-8 m con prato e vialetti drappeggiati sopra. È lo "smashato" che ha visto Carlo.
- **Via Gagarin** ha una fossa del LiDAR di 152 m², profonda fino a 5,6 m, a 1,5 m dal passo carraio. Una parte sta sotto una copertura (il DSM del 2008 vede un tetto sopra): è coerente con la rampa a spirale vista da Carlo. Il DBGT lì ha solo tre cortiletti a piano strada, e né il DBGT né OSM segnano l'interrato. Nel gioco c'è una conca morbida accanto allo spigolo dell'edificio.
- **Proposta.** La tappa 1 tiene la griglia unica: rampe e ingressi diventano oggetti "fossa" con muri e serranda, la quota della rampa si brucia in `S` e le celle si tagliano come per le superfici. Il costo è medio e funziona solo sui casi controllati, circa 100-140. La tappa 2 porta parcheggi percorribili sotto la superficie: servono un livello in più in `H`, collisioni con l'altezza (oggi sono 2D), soffitti e telecamera. Il costo è grande e il rischio di rompere la fisica in tutto il gioco è reale. La sezione "Proposta" ha i dettagli, la sezione "Da decidere" le scelte per Carlo.

## Tappa 1 fatta (26/10, ramo `buche-rampe`): buche irragionevoli tolte, rampe disegnate

Un'analisi sola, `src/sottoterra.py`, chiamata da `superficie.py` dopo le strade e prima del "tetto" (`Superficie.sottoterra`), più `src/sottoterra.json` con quello che ho guardato a vista. Decisioni di Carlo del 26/10: dove LiDAR 2008 e DBGT 2015 non sono d'accordo perché nel frattempo si è costruito vince il 2015; rampe solo con due fonti e attaccate a un passo carraio; i dubbi non si decidono da soli.

**La regola delle buche irragionevoli.** Una buca è una depressione chiusa del LiDAR sul reticolo di `S` (2 m): riempita fino al punto di traboccamento, i nodi più di 1 m sotto, almeno 3 (12 m²), dentro Meda. Si toglie quando il DBGT 2015 la smentisce: almeno metà dei suoi nodi visibili ha sopra una superficie del DBGT (carreggiata, cortile 0307, parcheggio, marciapiede, area stradale: la quota della superficie, o la TIN del suo anello per i cortili lasciati al LiDAR) più di 1 m sopra il LiDAR, oppure un edificio che il DSM 2008 non vedeva (DSM − DTM sotto 2 m: costruito dopo il volo). I nodi sotto un edificio che c'era già nel 2008 non contano né per né contro (pieghe del filtro del DTM, seminterrati). Non si toglie: entro 6 m da un alveo, entro 12 m da un ponte o dalla galleria, accanto alla ferrovia, dove il DBGT stesso sta in fondo alla buca (su almeno il 30% dei nodi la sua quota è entro 1 m dal LiDAR: trincee, sottopassi, cortili ribassati veri), dove c'è una fossa che può essere una rampa (disegnata, dubbia, o stretta, in discesa e con un passo carraio entro 25 m senza che l'abbia guardata) e dove l'ho segnata come dubbia. Togliere vuol dire che il terreno di base `L` della buca diventa una membrana armonica (Laplace) fra il LiDAR intorno e le quote del DBGT dentro, mai sotto il LiDAR: il DBGT entro i 3 m del "tetto" vince da solo, i cortili interni prendono la loro quota, i giardini e gli edifici nuovi il piano raccordato.

Numeri (Meda): 1104 buche; tolte 370 (42 690 nodi di `L`, alzati di 0,88 m a metà, 2,81 al 90%, 9,0 al massimo, a via Mazzini); restano 486 senza DBGT sopra (verde, sotto gli alberi, sotto edifici del 2008), 113 accanto a una rampa possibile, 104 col DBGT in fondo, 22 vicino a un fiume, 4 vicino a un ponte, 5 guardate e dubbie. Campione sull'ortofoto (le 9 più grandi e 27 a caso fra le 370): 31 giuste (edifici e capannoni costruiti dopo il 2008, cortili, vialetti, parcheggi), 5 dubbie (tolte dalla regola e messe nell'elenco qui sotto, B1-B5). Su tutto, una su sette potrebbe essere vera: è il prezzo di una regola generale.

I casi di Carlo: via Mazzini (x 118 z −445) suolo 21,6 → 29,5, a piano strada, il cortile e il palazzo stanno sul piano e non nella conca; x 510 z −448 in via Gagarin (cortile 0307 3453, buca di 4 m sotto l'angolo di un edificio del 2008) 27,3 → 30,9; via Pietro Orsi x 507,2 z −719,7 28,1 → 32,7 e x 505,3 z −703,8 30,0 → 32,2 (buche del LiDAR sotto l'area pedonale e il porticato del complesso). Restano come prima, e perché: via Pietro Orsi x 484,9 z −731,6 (suolo 32,5, due nodi fino a 31,0): è un pozzo stretto (1-2 m) di 3-5 m nel cortile verde interno del complesso, dove il DBGT non ha quote; sembra una bocca di lupo o una scala vera, non una buca da togliere. Dietro via Indipendenza x 608 z −166 era una buca (tolta: 30,5 con il vialetto che scendeva, ora piano a 30,5-31); la "spazzatura strana" sono pezzetti di recinzione del DBGT rimasti soli nel vialetto, non terreno. x 591 z −172 (suolo 28,3 contro 30,8): resta, è una fossa di 32 m² accanto al muro dell'edificio, sotto la gronda (DSM alto), senza superficie del DBGT sopra: per la regola non c'è niente che la smentisca. Via Isonzo x 554,1 z −246,2: 26,4 → 30,1, tolta (parcheggio 0301 a piano strada sopra una buca del LiDAR di 4,6 m). Il capannone di x 1666 z −1009 (costruito sullo scavo del 2008) ora sta a 40,7 invece che 34,6. I tre punti dell'indagine di x 158 z −739, x −96 z −960, x 252 z −809 non sono buche: sono parchi di ville coperti da un cortile 0307 enorme, dove la TIN dell'anello del DBGT taglia per aria il pendio; lì il LiDAR ha ragione e non si tocca.

**Le rampe.** Le fosse del LiDAR a 1 m (918, nucleo oltre 1 m, almeno 15 m², profonde almeno 1,5 m) con la forma di una rampa (stretta, in discesa da una testa), un volume interrato del DBGT o un parcheggio interrato di OSM vicino: 154, guardate tutte sull'ortofoto 2018-19 (`sottoterra.json`, 166 righe compresi i 9 di prima). Seconda fonte: il volume interrato `UN_VOL_POR 08` entro 8 m, OSM entro 25 m, l'ortofoto, Carlo per Gagarin; in più il passo carraio entro 25 m dalla testa. Ne sono uscite 29, ne disegno 26: tre sono finite fra i dubbi perché in fondo il LiDAR è profondo meno di 1,2 m. Ogni rampa segue la fossa: la linea di mezzo dalla testa al punto più profondo della parte non coperta da edifici (dove la fossa del LiDAR passa sotto un tetto la rampa si ferma: via Gagarin), lisciata a 1,5 m; larghezza costante, la mediana della fossa (3-6,5 m), stretta dove toccherebbe un edificio del DBGT o del gioco; bocca allungata di 1,5 m verso la testa; fondo dal DTM, sempre in discesa (regressione isotonica), mai più ripido del 25%, alla bocca al livello del suolo. Lunghe 7-22 m (mediana 12,7), alla serranda 1,3-3,2 m sotto il suolo (mediana 2,5). In `terreno/indice.json` `pits`: i due lati con la quota del fondo, le celle di `S` che la rampa prende e i triangoli del suolo intorno in quelle celle.

Nel gioco (`altezze3.js`, `world3.js`): dentro il contorno della rampa `H.base`, `H.ground` e `H.surface` danno il fondo (i triangoli della striscia fra i due lati), fuori `S`; la mesh del terreno lascia le celle della rampa, che disegna `buildPits`: il fondo in cemento, il suolo intorno con l'aspetto dello strato che copre la cella, i muri dal fondo fino a 1 m sopra il suolo lungo i due lati (muro di contenimento e parapetto insieme, più bassi vicino alla bocca), una serranda chiusa in fondo (alta 2,4 m, grigia a doghe, senza scritte) col muro sopra; muri e serranda sono in `WALLS` (a due facce, con la fascia di quota), l'auto si ferma sulla serranda. Le recinzioni e i muri dei dati che passano dentro una rampa (il DBGT disegna i muri della rampa vera, il contorno del LiDAR è un po' più largo) si tagliano lì; alberi e auto parcheggiate non nascono dentro una rampa. I cancelli dei passi carrai restano dove sono: in alcune rampe chiudono la bocca.

| # | x | z | lunga | larga | fondo sotto il suolo alla porta | fonti | guida dalla bocca | da 3 m prima |
|---|---|---|---|---|---|---|---|---|
| 0 | 524 | -1680 | 11,1 m | 2,8-3,3 m | 1,3 m | LiDAR, DBGT volume interrato a 0 m, ortofoto 2018-19 | alla serranda | non entra |
| 1 | 732 | -1494 | 12,3 m | 6,2-6,5 m | 2,8 m | LiDAR, ortofoto 2018-19 | non entra | non entra |
| 2 | 127 | -1401 | 12,2 m | 3,9-4,1 m | 2,6 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 3 | -586 | -1328 | 12,0 m | 6,5 m | 2,7 m | LiDAR, ortofoto 2018-19 | alla serranda | non entra |
| 4 | -704 | -1251 | 12,6 m | 4,1 m | 2,1 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 5 | 836 | -1249 | 11,1 m | 3,9 m | 2,1 m | LiDAR, DBGT volume interrato a 2 m, ortofoto 2018-19 | alla serranda | non entra |
| 6 | -755 | -1205 | 7,8 m | 6,5 m | 1,7 m | LiDAR, ortofoto 2018-19 | non entra | non entra |
| 7 | 436 | -1014 | 9,9 m | 5,3 m | 1,5 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 8 | 189 | -1011 | 7,3 m | 5,9 m | 1,9 m | LiDAR, DBGT volume interrato a 0 m, ortofoto 2018-19 | alla serranda | alla serranda |
| 9 | 812 | -944 | 9,4 m | 4,3-5,8 m | 2,2 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 10 | 890 | -809 | 17,4 m | 4,8-5,2 m | 2,6 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 11 | 487 | -701 | 16,3 m | 5,0-5,4 m | 2,5 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 12 | 588 | -698 | 15,9 m | 4,0-4,2 m | 3,2 m | LiDAR, ortofoto 2018-19 | alla serranda | non entra |
| 13 | 1510 | -619 | 12,9 m | 5,6-5,9 m | 2,6 m | LiDAR, ortofoto 2018-19 | alla serranda | non entra |
| 14 | 540 | -496 | 14,4 m | 3,7-5,2 m | 2,6 m | LiDAR, Carlo (nel gioco e dal vero) | alla serranda | alla serranda |
| 15 | 100 | -479 | 12,0 m | 4,3-5,3 m | 2,5 m | LiDAR, OSM parcheggio interrato, ortofoto 2018-19 | alla serranda | non entra |
| 16 | -277 | -469 | 13,5 m | 6,5 m | 2,2 m | LiDAR, OSM parcheggio interrato, ortofoto 2018-19 | alla serranda | alla serranda |
| 17 | -185 | -242 | 13,6 m | 6,5 m | 2,6 m | LiDAR, DBGT volume interrato a 0 m, ortofoto 2018-19 | alla serranda | alla serranda |
| 18 | -363 | -251 | 16,7 m | 5,5 m | 2,7 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 19 | 754 | -228 | 18,2 m | 4,2-5,7 m | 2,7 m | LiDAR, ortofoto 2018-19 (**tolta il 31/10: Carlo, guardandola nel gioco, è un errore; la fossa è riempita**) | alla serranda | alla serranda |
| 20 | 1418 | 719 | 18,1 m | 5,8 m | 3,0 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 21 | 1454 | 745 | 13,5 m | 6,5 m | 2,6 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 22 | 1343 | 782 | 12,8 m | 4,0 m | 2,1 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 23 | 1334 | 803 | 12,4 m | 5,6 m | 2,4 m | LiDAR, ortofoto 2018-19 | alla serranda | alla serranda |
| 24 | 1320 | 846 | 11,4 m | 5,6 m | 2,2 m | LiDAR, ortofoto 2018-19 | alla serranda | non entra |
| 25 | 1114 | 912 | 21,6 m | 5,8-6,5 m | 2,9 m | LiDAR, ortofoto 2018-19 | alla serranda | non entra |

"Non entra" da 3 m prima: la bocca è chiusa da qualcosa dei dati (il cancello del passo carraio, una recinzione sul confine della proprietà, l'angolo di un edificio); dalla bocca stessa due non scendono (1 e 6: il cancello del passo carraio sulla bocca).

**Controlli** (prima = `dev` rifatto con la stessa build, dopo = il ramo): C4 198 luoghi, 31 con almeno 5 nodi, fuori soglia → 135 e 15, dentro la soglia (i cortili e i parcheggi cambiati fra il 2008 e il 2015 erano la maggior parte); C5 0,005 m al massimo, C6 nessun asse sopra il 18% (triangoli sopra il 18% 905 → 798), C7 0,000, C10 0 non monotone, 0 sopra le sponde, uguali a prima. `S` prima e dopo: 40 211 nodi mossi, 39 157 dentro i nodi riempiti, 1054 entro 10 m da loro (le scarpate di raccordo e il "tetto" che non tira più giù), nessuno oltre 10 m (al massimo 1,49 m fuori dai riempiti). `H.check` su 201 tile 0,0007 m, raggi 0,0001; `H.checkPits` su 26 rampe e 300 punti l'una: 0,000 m, nessun buco. Salti di ruota oltre 0,2 m su tutte le corsie delle tile di S (2860 lati, 321 km, una ruota ogni 0,233 m): 329 → 282, nessuno nuovo (41 spariti, fra cui i due di via Mazzini). Guida con la fisica vera: 24 rampe su 26 dalla bocca fino alla serranda (l'auto si ferma a 2,1-2,3 m dal centro della serranda, cioè col muso contro), salto massimo 0,078 m per frame, l'auto sta al più 0,27 m sotto il fondo sul ciglio della bocca (il ritardo di sempre su un dosso).

**Elenco dei dubbi** (da guardare con Carlo; restano come oggi, conche morbide). Fosse del LiDAR a 1 m con la forma o le fonti di una rampa, non disegnate:

| # | x | z | fossa nel LiDAR 2008 | DBGT 2015 | OSM | perché è un dubbio (ortofoto 2018-19) |
|---|---|---|---|---|---|---|
| 1 | -580 | -1643 | 76 m², 3,3 m, 15 × 6,7 m | - | - | rampa a vista, ma nessun passo carraio entro 25 m |
| 2 | 663 | -1611 | 97 m², 2,6 m, 15 × 4,1 m | passo carraio a 18 m, 53% sotto un edificio | - | non si capisce se è una rampa |
| 3 | 724 | -1584 | 118 m², 2,5 m, 15 × 4,1 m | passo carraio a 12 m, 64% sotto un edificio | - | non si capisce se è una rampa |
| 4 | -32 | -1476 | 22 m², 2,1 m, 12 × 3,7 m | passo carraio a 9 m | - | non si capisce se è una rampa |
| 5 | -753 | -1431 | 115 m², 2,4 m, 17 × 5,6 m | passo carraio a 12 m, 31% sotto un edificio | - | non si capisce se è una rampa |
| 6 | 781 | -1380 | 19 m², 2,1 m, 9 × 4,1 m | - | - | rampa a vista, ma nessun passo carraio entro 25 m |
| 7 | 137 | -1367 | 188 m², 2,2 m, 20 × 5,2 m | passo carraio a 10 m, 47% sotto un edificio | - | non si capisce se è una rampa |
| 8 | 1123 | -1348 | 102 m², 2,7 m, 20 × 4,1 m | passo carraio a 3 m, 40% sotto un edificio | - | non si capisce se è una rampa |
| 9 | 182 | -1329 | 175 m², 1,8 m, 41 × 5,6 m | volume interrato a 0 m, passo carraio a 13 m | - | striscia scura lungo la casa, ma la fossa del LiDAR va nel giardino (36 m): forma non chiara |
| 10 | -895 | -1286 | 56 m², 1,9 m, 7 × 3,2 m | 77% sotto un edificio | - | non si capisce se è una rampa |
| 11 | 848 | -1260 | 161 m², 2,3 m, 14 × 6,0 m | volume interrato a 0 m, passo carraio a 14 m, 34% sotto un edificio | - | non si capisce se è una rampa |
| 12 | 1014 | -1234 | 59 m², 3,3 m, 20 × 4,1 m | - | - | rampa a vista, ma nessun passo carraio entro 25 m |
| 13 | -617 | -1192 | 46 m², 2,4 m, 19 × 5,2 m | passo carraio a 18 m | - | corsello fra due edifici |
| 14 | 1079 | -1178 | 69 m², 2,1 m, 22 × 2,6 m | passo carraio a 13 m, 38% sotto un edificio | - | non si capisce se è una rampa |
| 15 | 92 | -1141 | 31 m², 2,7 m, 15 × 4,1 m | volume interrato a 0 m, passo carraio a 9 m | - | non si capisce se è una rampa |
| 16 | 951 | -1107 | 586 m², 2,3 m, 68 × 5,4 m | volume interrato a 0 m, passo carraio a 19 m, 44% sotto un edificio | - | non si capisce se è una rampa |
| 17 | -626 | -1088 | 137 m², 3,8 m, 21 × 5,6 m | passo carraio a 16 m | - | non si capisce se è una rampa |
| 18 | 709 | -974 | 53 m², 3,3 m, 17 × 5,2 m | passo carraio a 9 m | - | non si capisce se è una rampa |
| 19 | 954 | -900 | 78 m², 3,8 m, 48 × 6,7 m | volume interrato a 0 m, 64% sotto un edificio | - | non si capisce se è una rampa |
| 20 | 938 | -875 | 66 m², 4,5 m, 42 × 5,9 m | volume interrato a 0 m, 75% sotto un edificio | - | non si capisce se è una rampa |
| 21 | 945 | -848 | 1315 m², 4,4 m, 109 × 10,0 m | volume interrato a 0 m, passo carraio a 5 m, 51% sotto un edificio | - | non si capisce se è una rampa |
| 22 | 702 | -736 | 85 m², 3,2 m, 13 × 5,2 m | passo carraio a 14 m, 51% sotto un edificio | - | striscia lungo l'edificio |
| 23 | 33 | -673 | 203 m², 6,1 m, 30 × 4,1 m | passo carraio a 8 m | - | non si capisce se è una rampa |
| 24 | -369 | -652 | 624 m², 3,7 m, 45 × 2,6 m | volume interrato a 0 m, passo carraio a 18 m, 77% sotto un edificio | - | non si capisce se è una rampa |
| 25 | -23 | -647 | 26 m², 2,2 m, 9 × 4,1 m | passo carraio a 6 m | - | non si capisce se è una rampa |
| 26 | 127 | -611 | 56 m², 2,9 m, 17 × 5,6 m | passo carraio a 10 m | - | non si capisce se è una rampa |
| 27 | 847 | -606 | 710 m², 2,3 m, 58 × 5,6 m | volume interrato a 0 m, passo carraio a 10 m, 60% sotto un edificio | - | non si capisce se è una rampa |
| 28 | -913 | -547 | 287 m², 3,7 m, 32 × 5,6 m | volume interrato a 0 m, passo carraio a 11 m, 38% sotto un edificio | - | non si capisce se è una rampa |
| 29 | 983 | -530 | 33 m², 2,3 m, 10 × 5,2 m | - | - | rampa a vista, ma nessun passo carraio entro 25 m |
| 30 | 483 | -523 | 64 m², 2,5 m, 18 × 5,6 m | - | - | non si capisce se è una rampa |
| 31 | 761 | -511 | 70 m², 3,0 m, 21 × 4,1 m | - | - | non si capisce se è una rampa |
| 32 | 1648 | -471 | 28 m², 2,9 m, 15 × 3,7 m | passo carraio a 7 m | - | non si capisce se è una rampa |
| 33 | -77 | -459 | 49 m², 2,5 m, 18 × 4,1 m | volume interrato a 0 m, passo carraio a 7 m | - | non si capisce se è una rampa |
| 34 | -1063 | -425 | 189 m², 1,8 m, 48 × 3,7 m | volume interrato a 0 m, passo carraio a 14 m, 37% sotto un edificio | - | non si capisce se è una rampa |
| 35 | 968 | -360 | 20 m², 1,9 m, 15 × 4,1 m | volume interrato a 6 m, passo carraio a 20 m | - | in fondo è profonda solo 0.8 m |
| 36 | 944 | -354 | 76 m², 1,9 m, 11 × 4,7 m | volume interrato a 3 m, passo carraio a 1 m, 56% sotto un edificio | - | non si capisce se è una rampa |
| 37 | 959 | -348 | 24 m², 1,9 m, 20 × 3,7 m | volume interrato a 0 m, passo carraio a 12 m | - | non si capisce se è una rampa |
| 38 | -610 | -327 | 115 m², 2,6 m, 20 × 4,7 m | volume interrato a 0 m, passo carraio a 2 m, 40% sotto un edificio | - | non si capisce se è una rampa |
| 39 | 482 | -312 | 512 m², 3,1 m, 38 × 6,7 m | volume interrato a 0 m, passo carraio a 15 m, 51% sotto un edificio | - | non si capisce se è una rampa |
| 40 | 509 | -276 | 23 m², 2,9 m, 9 × 3,7 m | passo carraio a 6 m | - | non si capisce se è una rampa |
| 41 | 1832 | -204 | 52 m², 1,7 m, 19 × 7,4 m | passo carraio a 16 m | - | vialetto in discesa verso la casa, senza muri |
| 42 | 778 | -202 | 58 m², 2,8 m, 18 × 5,2 m | passo carraio a 18 m | - | non si capisce se è una rampa |
| 43 | 996 | -156 | 83 m², 2,1 m, 17 × 5,2 m | - | - | striscia lungo l'edificio |
| 44 | 966 | -128 | 33 m², 2,0 m, 10 × 3,7 m | 47% sotto un edificio | - | non si capisce se è una rampa |
| 45 | 998 | -9 | 36 m², 2,8 m, 14 × 5,2 m | - | parcheggio interrato | rampa a vista, ma nessun passo carraio entro 25 m |
| 46 | 960 | 153 | 28 m², 2,2 m, 10 × 3,7 m | passo carraio a 12 m | - | non si capisce se è una rampa |
| 47 | -678 | 187 | 121 m², 3,5 m, 34 × 4,1 m | volume interrato a 0 m, passo carraio a 10 m | - | non si capisce se è una rampa |
| 48 | 1656 | 285 | 50 m², 2,1 m, 13 × 4,1 m | passo carraio a 4 m | - | non si capisce se è una rampa |
| 49 | 1043 | 296 | 77 m², 3,0 m, 24 × 5,2 m | - | - | non si capisce se è una rampa |
| 50 | 1090 | 304 | 50 m², 2,7 m, 14 × 4,1 m | passo carraio a 8 m | - | non si capisce se è una rampa |
| 51 | 308 | 317 | 138 m², 2,1 m, 20 × 1,9 m | volume interrato a 0 m, passo carraio a 3 m, 71% sotto un edificio | - | non si capisce se è una rampa |
| 52 | 1476 | 361 | 16 m², 2,1 m, 11 × 3,7 m | passo carraio a 13 m | - | non si capisce se è una rampa |
| 53 | 582 | 366 | 159 m², 3,8 m, 28 × 5,6 m | passo carraio a 4 m | - | non si capisce se è una rampa |
| 54 | 983 | 484 | 96 m², 3,3 m, 32 × 4,1 m | - | - | rampa a vista, ma nessun passo carraio entro 25 m |
| 55 | 1014 | 486 | 39 m², 2,1 m, 11 × 5,2 m | volume interrato a 0 m, 36% sotto un edificio | - | non si capisce se è una rampa |
| 56 | 1138 | 703 | 3367 m², 2,4 m, 111 × 7,4 m | volume interrato a 0 m, passo carraio a 6 m, 50% sotto un edificio | - | non si capisce se è una rampa |
| 57 | 306 | 714 | 348 m², 3,0 m, 29 × 7,4 m | volume interrato a 0 m, passo carraio a 6 m | - | non si capisce se è una rampa |
| 58 | 80 | 721 | 52 m², 1,7 m, 16 × 3,7 m | passo carraio a 13 m | - | non si capisce se è una rampa |
| 59 | 76 | 744 | 46 m², 2,2 m, 14 × 4,1 m | passo carraio a 7 m | - | non si capisce se è una rampa |
| 60 | 38 | 746 | 49 m², 2,2 m, 12 × 3,7 m | volume interrato a 0 m, 51% sotto un edificio | - | non si capisce se è una rampa |
| 61 | 771 | 766 | 160 m², 3,2 m, 24 × 2,2 m | volume interrato a 0 m, passo carraio a 2 m | - | corsello curvo: il LiDAR scende verso la strada, la parte profonda e allo sbocco sul marciapiede |
| 62 | 324 | 780 | 56 m², 2,2 m, 10 × 3,7 m | volume interrato a 0 m, passo carraio a 4 m, 82% sotto un edificio | - | in fondo è profonda solo 0.3 m |
| 63 | 376 | 817 | 44 m², 2,5 m, 12 × 4,1 m | volume interrato a 0 m, passo carraio a 13 m | - | in fondo è profonda solo 0.7 m |
| 64 | 377 | 839 | 169 m², 2,4 m, 22 × 5,6 m | volume interrato a 6 m, passo carraio a 18 m, 40% sotto un edificio | - | non si capisce se è una rampa |
| 65 | 961 | 873 | 28 m², 2,6 m, 13 × 3,7 m | - | - | rampa a vista, ma nessun passo carraio entro 25 m |

| buca | x | z | fossa nel LiDAR (2 m) | DBGT sopra la fossa | ortofoto 2018-19 |
|---|---|---|---|---|---|
| B1 | 858 | -1279 | 84 m², 2,5 m | 24% dei nodi, 1,6 m sopra il LiDAR | corpo curvo attaccato all edificio (come Gagarin?) |
| B2 | -796 | -1188 | 84 m², 2,3 m | 33% dei nodi, 2,4 m sopra il LiDAR | rettangolo chiaro fra due case (piscina o bocca di lupo?) |
| B3 | 1129 | -995 | 300 m², 2,2 m | 36% dei nodi, 2,2 m sopra il LiDAR | corsello scuro fra due edifici, forse una rampa |
| B4 | 755 | -965 | 92 m², 2,8 m | 87% dei nodi, 2,9 m sopra il LiDAR | cortile in ombra fra edifici, forse ribassato |
| B5 | 1066 | -479 | 2532 m², 4,4 m | 32% dei nodi, 3,1 m sopra il LiDAR | prato ribassato fra due muri (forse vero) |

Le buche B1-B5 sono quelle del campione che la regola toglierebbe e che sull'ortofoto non sono chiare: restano come oggi.

**Aperti.** (1) Le fosse con la forma di una rampa che non ho guardato (circa 400 piccole e strette, di solo LiDAR) restano come oggi e proteggono la loro buca dalla regola. (2) La regola sbaglia forse una buca su sette (campione): le 370 sono in `sottoterra_casi.json` dell'uscita di `superficie.py`. (3) Il fondo delle rampe viene dal DTM 2008 e da un'isotonica: in alcune il primo metro è più ripido del resto. (4) In 10 rampe da fuori non si entra (cancello, recinzione, edificio sulla bocca). (5) La tappa 2 (le autorimesse dove si entra) non è fatta.

## Le due segnalazioni di Carlo

### Via Yuri Gagarin (x 538 z −497)

| Fonte | Cosa dice |
|---|---|
| LiDAR DTM 2008 | Fossa chiusa di 152 m² (22 × 14 m) a x 532-544, z −499/−479, profonda fino a 5,6 m; accanto, sotto l'edificio, un'altra di 77 m² profonda 5,1 m |
| LiDAR DSM 2008 | Sul 58% della prima fossa e sul 99% della seconda c'è qualcosa di alto (DSM − DTM > 2 m): la rampa è in parte coperta |
| DBGT 2015 | Tre cortiletti `AC_VEI` ZON 0307 di 17-23 m² a piano strada (223,4 m), sopra la fossa; passo carraio `ACC_PC` 3585 a x 547 z −489, a 1,5 m dalla fossa; nessun volume `UN_VOL_POR 08` |
| OSM | Niente (solo via Yuri Gagarin, un vialetto e un passo di servizio) |
| Ortofoto 2018-19 | Un complesso di palazzine; la rampa non si vede, coperta |
| Gioco oggi | `S` = LiDAR: conca morbida fino a circa 5 m fra lo spigolo dell'edificio e la recinzione, mezza sotto l'edificio; niente muri, niente fondo, niente porta |

Il caso è chiaro solo perché lo ha visto Carlo: per i dati è una fossa di solo LiDAR con un passo carraio davanti. La spirale non si può fare con una rampa piana (vedi Tappa 1, rischi).

### Via Giuseppe Mazzini (x 130 z −435, guardando a sud-ovest)

| Fonte | Cosa dice |
|---|---|
| LiDAR DTM 2008 | Fossa di 1431 m² (45 × 35 m) a x 100-124, z −457/−437, profonda 5-8 m (8,2 al massimo). È uno scavo: il DSM 2008 non ha niente sopra (copertura 7%) |
| DBGT 2015 | Sopra la fossa ci sono il cortile `AC_VEI` 3688 (ZON 0307) e l'area `AR_STR` 2018 / `AC_PED` 250, tutti a piano strada (221,4-221,9 m) e fino a 4-5 m sopra il LiDAR. Ci sono i passi carrai 1324-1325 a x 133-135 z −434. Nessun volume 08 |
| OSM | `amenity=parking parking=underground layer=-1`, area di 1461 m² a nord-est (centro x 135 z −465) |
| Ortofoto 2018-19 | Sopra il parcheggio OSM c'è un giardino con le prese d'aria dell'autorimessa; sullo scavo del 2008 c'è un palazzo nuovo con piscina. La rampa probabilmente corre lungo il lato nord-est del palazzo, dai passi carrai di via Mazzini |
| Gioco oggi | `S` = LiDAR 2008. A x 120 z −445 il suolo sta a 213,3 m e la strada a 221,2 m: è una conca di circa 8 m, con prato e vialetti drappeggiati e le recinzioni a piano strada. Accanto alla corsia c'è un salto di ruota di 0,24 m (x 135 z −435, collaudo del 25/10). Il cortile 3688 del DBGT non vince per la regola del "tetto" di `superficie.py`: oltre 3 m dal LiDAR vince il LiDAR |

Qui le fonti non sono in disaccordo sull'interrato: sono di anni diversi. Il LiDAR del 2008 ha visto lo scavo, mentre DBGT e OSM vedono quello che ci hanno costruito. Lo stesso problema, cioè fosse del 2008 su cui oggi c'è un edificio o un cortile a piano strada, riguarda molte altre fosse: in 338 delle 906 fosse del LiDAR il DBGT 2015 ha sopra un edificio o superfici più alte di 1,5 m. Il numero è largo: comprende anche rampe vere che il DBGT disegna solo con il bordo in alto.

## Le fonti e come le ho lette

Codici del DBGT dalle Specifiche regionali (`data/dbt/specifiche/Lombardia_specifiche_DBT_allegato2_III.pdf`):

| Strato DBGT | Codice (pagina delle Specifiche) | A Meda |
|---|---|---|
| `UN_VOL_POR` | 08 "sotterranea" (p. 134); la base è "la linea di distacco ... interrata (unità volumetrica sotterranea)" (p. 130) | 67 volumi in 64 gruppi (il 65° della stima di prima era un gruppo diviso in due a meno di 1 m), 5425 m² in tutto, alti 2,0-6,8 m (media 3,2). La quota della base è il pavimento (≥ 1,5 m sotto il LiDAR) solo in 25 gruppi; in 33 sta fra 1,5 m sotto e 0,5 sopra il terreno, in 6 sopra: la profondità dal DBGT vale solo per quei 25. Sono spesso piccoli: terrazzi, giardini e strisce accanto agli edifici, cioè la copertura di box e cantine (ortofoto) |
| `EL_STR_LIV` | 01 "in sottopasso" (p. 74) | 18 assi, tutti sotto i 7 ponti stradali e ferroviari (PONTE 7, 8, 12, 13, 14, 19, 20) |
| `AC_VEI_LIV`, `AR_STR_LIV`, `AC_PED_LIV` | 01 "in sottopasso" (p. 54) | non compilati (`-99991`), tranne un pezzo che vale 02 |
| `*_SED` | 03 "in galleria/sotterraneo", "non quelli in sottopasso" (p. 54) | solo `AC_PED` 1, il passaggio della stazione; nessuna strada |
| `GALLER` | uso, tipo (p. 193-194) | 1, il sottopasso pedonale della stazione; la sua quota (226,9 m) sta sopra le strade e non dà la profondità (`docs/motore.md` fase 3) |
| `ACC_PC` | passo carraio | 4553 punti, senza quota: dicono dov'è l'ingresso, non dove porta |
| `MN_IND_SO` | 02 "sotterraneo" | nessuno (5 "non sotterraneo", 122 non compilati) |
| `PT_QUO_SED` | 0104 "depressione" | nessuno |

OSM, dentro il confine di Meda più 30 m: 4 `parking=underground` (2 aree: via Mazzini 1461 m² e un supermercato in via Indipendenza 1489 m²; 2 punti: via Venticinque Aprile e la stazione, con 2 `amenity=parking_entrance`); 22 `tunnel=yes` (5 marciapiedi, 3 rami e 2 tratti della Milano-Meda sotto i cavalcavia, via Busnelli e la ferrovia sotto il ponte, via Milano, la via sotto la Milano-Meda a x −767, 4 `service` sotto la pensilina del distributore di x −650 z 85 che non sono sotto terra, 3 tratti del Tarò); 3 `tunnel=culvert` (Tarò e un fosso), 4 `tunnel=building_passage` (androni in centro). Niente `parking=multi-storey`, `ramp`, `entrance=garage`. I 607 `building=garage(s)` sono box fuori terra. La stima di "26 aree e 134 vie" valeva per tutta la mappa, non per Meda.

LiDAR del Ministero (2008), DTM a 1 m: ho ricampionato il DTM, il DSM First e la `S` del gioco (`terreno/*.bin.gz`, la stessa formula dei due triangoli di `H.onF`) su una griglia di 1 m sopra Meda. Poi ho riempito le depressioni chiuse del DTM (ricostruzione morfologica): la differenza fra riempito e DTM è la profondità di ogni fossa sotto il suo punto di traboccamento. Ci sono 1284 fosse più profonde di 1 m e larghe almeno 8 m²; 906 sono larghe almeno 15 m² e profonde almeno 1,5 m. Su queste ultime:
- 327 stanno sotto un edificio che c'era già nel 2008 (impronta DBGT per più di metà e DSM alto): le ho tolte, sono pieghe del filtro del DTM o seminterrati;
- 190 stanno nel verde, nei campi o nei fossi, 2 sono piscine: tolte;
- le altre 387 (cortili e piazzali privati, 0307 e 0301, marciapiedi, vicino a un volume 08 o a un parcheggio OSM, dietro un passo carraio, in strada, sotto edifici nuovi) sono nei casi; quelle a meno di 12 m l'una dall'altra o da un oggetto DBGT o OSM formano un caso solo.

Una fossa larga al massimo 9 m e grande al massimo 400 m² è una "rampa?", una più larga è un "cortile ribassato o scavo?". Le rampe vanno da 24 a 110 m² (10°-90° percentile, mediana 49) e sono profonde 1,7-3,2 m (mediana 2,4). L'ingresso è "chiaro" se un passo carraio DBGT sta a meno di 12 m dalla testa della fossa (l'estremo meno profondo lungo l'asse lungo) o se OSM ha un ingresso. È "probabile" se c'è solo la testa della fossa o un passo carraio a meno di 8 m dal volume 08.

Foto. Ho provato Mapillary: 16 foto del 2017-2020, a 9-50 m dalle fosse, quasi tutte da auto sulle vie principali. Nessuna mostra una rampa, che sta dietro cancelli e siepi, quindi non servono. Ho usato invece l'ortofoto AGEA 2018-19 della Regione (servizio `BaseMap/Ortofoto2018_2019` di cartografia.servizirl.it, 20 cm; quello del 2021 risponde con un errore). L'ho solo guardata, non è salvata da nessuna parte. Campioni: 16 "rampe?" (8 rampe o rampe probabili, 5 dubbi, 3 no), 8 "cortili?" (4 sotto edifici costruiti dopo il 2008, 2 piazzali industriali ribassati, 2 dubbi) e 16 autorimesse più i casi speciali. Il giudizio è nella colonna "verifica" delle tabelle. Nel gioco ho guardato solo via Mazzini, via Gagarin, la stazione, una rampa e il sottopasso sotto la Milano-Meda (foto per me, non mandate).

## Conteggi

| tipo | casi | ingresso chiaro | ingresso probabile | visti da una sola fonte |
|---|---|---|---|---|
| rampa? | 225 | 67 | 158 | 224 |
| cortile ribassato o scavo? | 68 | 1 | 0 | 68 |
| autorimessa interrata | 60 | 7 | 21 | 28 |
| sottopasso stradale | 7 | 0 | 0 | 2 |
| corso d'acqua tombinato | 6 | 0 | 0 | 6 |
| androne o passaggio coperto | 5 | 0 | 0 | 5 |
| scavo 2008, poi edificio | 4 | 1 | 1 | 4 |
| sottopasso pedonale | 2 | 1 | 0 | 1 |
| avvallamento in strada | 2 | 0 | 2 | 2 |
| **totale** | **379** | **77** | **182** | **340** |

"Visti da una sola fonte" conta i casi con una fonte sola fra DBGT, OSM e LiDAR. Gagarin è nel conto: per i dati è solo LiDAR, anche se Carlo l'ha visto. Su 379 casi, 299 sono solo LiDAR, 27 solo DBGT, 14 solo OSM; 29 sono DBGT+LiDAR, 4 LiDAR+OSM, 4 DBGT+OSM e 2 vedono tutte e tre (il sottopasso di via Busnelli e la stazione).

## Proposta per il motore

### Come funziona oggi

- `src/superficie.py` costruisce `S`: il LiDAR ovunque, e sopra le strade e le aree del DBGT bruciate con una priorità (`R_RIT, R_VEI, R_PED, R_ALV = 9, 8, 7, 6`, r. 57). La regola del "tetto" (`tetto()`, r. 611; `DZ_CAP = 3,0`, r. 37) rimette il LiDAR dove il DBGT ne dista più di 3 m. Per questo a via Mazzini vince lo scavo del 2008.
- `src/impalcati.py` ha già gli oggetti sopra e sotto `S`. Gli impalcati (`decks`) sono ponti e la copertura della galleria. Le fosse (`build_pits`, r. 514) erano le scale dei sottopassi, lette da `STAIRWELLS` di `landmarks3.js`: dal 24/10 quei pezzi sono in `src/_vecchi/`, quindi `terreno/indice.json` ha `pits: []`, e nel gioco non c'è più codice che le disegni.
- `src/altezze3.js` è l'unico lettore della griglia. `H.base` è `S`, `H.surface(x, z, cy)` (r. 376) prende l'impalcato più alto sotto `cy + 0,8`, così si passa sotto i ponti. Un livello sotto `S` non esiste.
- `src/world3.js` disegna la mesh di `S` per tile (r. 996) e taglia le superfici sulle celle (`H.clipPoly`, `H.coverCells`: un livello può prendersi le celle intere, r. 255).
- Le collisioni sono 2D. `collideStatic(p, r)` (`game.src.html` r. 705) guarda solo x e z. Alcuni muri hanno già `y0`/`y1` (guardrail e pilastri degli impalcati, `world3.js` r. 273, 296, 843, 858, 907), ma nessuno li legge. Anche `inBuilding(x, z)` (`world3.js` r. 188) è 2D.
- I volumi `UN_VOL_POR 08` non si disegnano (`docs/motore.md`, edifici); i volumi rialzati 03-04 sì, e sotto si passa: gli androni ci sono già.

### Tappa 1: rampe e ingressi come fosse, con la griglia unica

Cosa si ottiene: la rampa scende con il suo piano e i suoi muri dritti fino a una serranda chiusa in fondo; le bocche delle scale della stazione scendono a un pianerottolo chiuso; gli scavi del 2008 spariscono dove oggi c'è altro. Non si entra da nessuna parte.

1. **Dati (build), un modulo nuovo `src/sottoterra.py`**, come `dbgt_manufatti.py`. Prende i casi di questo censimento e, per ognuno che si tiene, scrive una fossa:
   `{imp, tipo: 'rampa' | 'scala', bocca: [segmento sulla strada], z_bocca, fondo, porta: [segmento in fondo], muri: [lati], fonti}`.
   - `imp`: il contorno della fossa del LiDAR raddrizzato (rettangolo minimo, o il pezzo `AC_VEI` 0307 che la contiene se coincide).
   - `bocca`: il lato verso il passo carraio `ACC_PC`. La quota `z_bocca` è quella della strada DBGT.
   - `fondo`: il pavimento del volume 08 dove la base è profonda (25 gruppi), altrimenti il minimo del LiDAR.
   - `porta`: il lato verso l'edificio o il volume 08.

   Un file `src/sottoterra.json` (come `ritocchi.json`) dice quali casi tenere e quali togliere dopo il giro di Carlo.
2. **`S` (`src/superficie.py`)**: una priorità nuova `R_RAMPA` fra `R_VEI` e `R_RIT`, che brucia il piano della rampa da `z_bocca` a `fondo`. Le rampe si tolgono dal "tetto". Insieme, se Carlo lo decide: gli scavi del 2008 senza edificio nel DSM, che nel 2015 hanno un edificio o un cortile a piano strada e non sono una rampa tenuta, prendono il DBGT invece del LiDAR. È la regola provata nel collaudo del 25/10, ma senza il "tetto" che la annullava.
3. **Indice (`src/impalcati.py` / `src/terreno_gioco.py`)**: le fosse vanno in `terreno/indice.json` `pits`, la chiave che c'è già.
4. **Gioco**:
   - `altezze3.js`: una griglia delle fosse come `DKG` per gli impalcati. Dentro una fossa `H.base` e `H.surface` danno il piano esatto della rampa, fuori `S`. `H.check` deve accettare le celle che una fossa possiede.
   - `world3.js`: la fossa si prende le celle con `coverCells` e disegna la sua mesh con i bordi netti: piano, muri di contenimento verticali da `S` al piano, parapetto, serranda (una texture neutra, senza scritte). Lungo i lati e sulla porta mette segmenti in `WALLS`: in 2D vanno bene, perché separano proprio la rampa dal giardino sopra.
   - La fisica non cambia: auto e pedoni chiedono già `H.surface`.
5. **Il sottopasso sotto la Milano-Meda di x −767** è un ponte che manca, non sotto terra: si fa con un impalcato in `impalcati.py` (OSM `bridge=yes` sopra `tunnel=yes`), con `S` in fondo.

Quali casi tenere (proposta): i 39 casi con almeno due fonti (quasi tutti autorimesse e sottopassi della Tabella 1), più le rampe del solo LiDAR con il passo carraio in testa (67), più Gagarin. Sono circa 100-110. Con le rampe "probabili" che reggono un controllo sull'ortofoto si arriva a circa 140. Le altre 160 "rampe?" e i 68 cortili restano come oggi, o si riempiono se Carlo sceglie il DBGT per gli scavi.

Costi: un modulo di build (circa un giorno di lavoro), `superficie.py` e il controllo C4 (mezza giornata), il gioco (uno o due giorni), il collaudo con le foto (mezza giornata). La build dura meno di un minuto in più. Nel gioco sono 100-140 mesh piccole, un costo trascurabile.

Rischi:
- **Falsi positivi**: le rampe che portano a una serranda dove non c'è niente. Per questo si tengono solo i casi controllati.
- **LiDAR del 2008**: non vede le rampe fatte dopo e vede quelle chiuse dopo. Il campione dice che metà delle "rampe?" non lo sono.
- **Rampe a spirale o coperte** (Gagarin): un piano non basta. Serve un pezzo a mano, oppure Gagarin resta una rampa dritta fino alla copertura.
- **Rampe sotto un edificio**: il muro dell'edificio taglia la rampa. Va bene finché la serranda sta sul filo della facciata.
- **Passo 2 m**: una rampa larga 3-4 m sono una o due celle. Per questo i bordi li dà la mesh della fossa e non `S`, altrimenti resta la conca di oggi.
- **Effetto largo della regola sugli scavi**: con la regola sugli scavi del 2008 i nodi di `S` cambiano in un'area larga (il collaudo del 25/10 ne aveva spostati 1221 per 48 cortili). Va misurata con C4 prima di tenerla.

### Tappa 2: parcheggi interrati percorribili, un secondo livello

Cosa si ottiene: dalla rampa si entra in un'autorimessa con pavimento, soffitto, pilastri e luci, ci si gira dentro in auto e a piedi e si esce. Lo stesso vale per il passaggio pedonale sotto i binari della stazione.

1. **Dati**: un oggetto "interrato" `{imp, fondo, soffitto, ingressi: [fosse]}` in `terreno/indice.json`. Le impronte sicure sono poche: i 64 gruppi 08 (5425 m², ma i grandi sono una decina) e le 2 aree OSM. Per le altre autorimesse l'impronta non la dice nessuno: o si inventa una scatola dietro la serranda (contro la regola dei dettagli inventati, da decidere) o si lascia solo la serranda della tappa 1. Le più grandi, che varrebbe la pena fare per prime: via Mazzini (OSM 1461 m²), via Indipendenza (supermercato, OSM 1489 m²), via delle Cave x −566 z −596 (08, 831 m²), via Cialdini x 843 z −603 (421 m²), via Zara x 953 z −1110 (374 m²), via Cadorna x 485 z −311 (333 m²), via Colombo x −368 z −652 (322 m²), via Milano x −608 z −343 (313 m²), via Rho x 946 z −855 (248 m²), via Trieste x 1515 z −961 (217 m²), la stazione (GALLER, 453 m² con le bocche).
2. **`altezze3.js`**: un livello sotto `S`. Il modello è quello degli impalcati rovesciato: `H.surface(x, z, cy)` dà il pavimento dell'interrato se `cy` sta sotto il soffitto, altrimenti `S`. `H.base` e `H.ground` restano `S` per tutto quello che si piazza sopra (alberi, arredi, traffico): vanno separati i chiamanti che seguono chi si muove da quelli che piazzano cose.
3. **Collisioni con l'altezza**: `collideStatic(p, r, y)` deve leggere `y0`/`y1`, e ogni muro deve averli. Per gli edifici la quota va dalla base al tetto, per i muri dell'interrato dal fondo al soffitto. Altrimenti i muri dell'edificio sopra fermano l'auto sotto, e quelli dell'interrato fermano chi cammina nel giardino sopra. Lo stesso vale per `inBuilding` e per chi spawna (`police3.js` gli passa già una `y` che `collideStatic` ignora).
4. **Disegno (`world3.js`)**: soffitto, pareti, pilastri e luci dell'interrato. La mesh di `S` si vede da sotto solo se ha la faccia giusta, quindi il soffitto deve essere una mesh sua. La telecamera in terza persona non deve uscire dal soffitto: oggi resta sopra il suolo, e dentro l'interrato salterebbe su in giardino. Servono anche ombre e luce dentro. Sulla minimappa il livello va nascosto o segnato.
5. **Traffico e polizia**: niente traffico dentro. Per l'inseguimento va deciso se la polizia entra o aspetta fuori.

Costi: grandi. Sono tre-sei giorni di lavoro più il collaudo, perché collisioni e telecamera toccano tutto il gioco. Il costo nel gioco è piccolo: una decina di interni.

Rischi:
- regressioni nella fisica ovunque (le collisioni passano da 2D a 2D con l'altezza);
- la telecamera dentro gli spazi chiusi;
- impronte e altezze inventate dove il DBGT e OSM non le danno;
- quote del DBGT 08 non affidabili in 39 gruppi su 64 (base a piano campagna).

### Costi e rischi in una riga

| | Tappa 1 (fosse con muri e serranda) | Tappa 2 (interrati percorribili) |
|---|---|---|
| Cosa si vede | rampe e bocche delle scale vere, scavi del 2008 tolti | si entra in 10-15 autorimesse e nel sottopasso della stazione |
| Cosa cambia | nuovo `src/sottoterra.py`, `superficie.py` (priorità, tetto), `impalcati.py`/`terreno_gioco.py` (`pits`), `altezze3.js` (griglia delle fosse), `world3.js` (mesh, `WALLS`) | in più: `altezze3.js` (livello sotto `S`), `game.src.html` `collideStatic` e tutti i muri con `y0`/`y1`, `inBuilding`, telecamera, interni in `world3.js`, `police3.js` |
| Griglia unica | sì | no: `H` a più quote |
| Lavoro | 3-4 giorni | 3-6 giorni in più |
| Rischio | basso-medio (falsi positivi, scelta LiDAR/DBGT) | alto (fisica e telecamera in tutto il gioco) |

### Da decidere (Carlo)

1. **LiDAR 2008 o DBGT 2015 sugli scavi**: dove il LiDAR ha uno scavo e il DBGT 2015 un edificio o un cortile a piano strada (via Mazzini e molte altre), quale vince? È la domanda rimasta aperta dal collaudo del 25/10.
2. **Quante rampe**: solo quelle con almeno due fonti o con il passo carraio in testa (circa 100-110), anche le probabili guardate sull'ortofoto (circa 140), o tutte le 225 "rampe?", di cui metà non lo sono.
3. **Gagarin**: una rampa dritta fino alla copertura, oppure la spirale fatta a mano?
4. **Tappa 2 sì o no**, e se sì su quali autorimesse. Le autorimesse senza impronta nei dati restano chiuse o prendono una scatola generica?

## Elenco dei casi

Coordinate in metri del gioco (x verso est, z verso sud). "Profondità": dal LiDAR è la profondità della fossa sotto il suo bordo; dal DBGT è quanto la base del volume 08 sta sotto il LiDAR e quanto è alto il volume. "Nel gioco oggi": "fossa morbida (S = LiDAR)" vuol dire che `S` scende come il LiDAR (mediana di `S` − DTM nella fossa entro 0,5 m), con la griglia di 2 m e senza muri; "in parte spianata" e "spianato" vogliono dire che `S` sta sopra il LiDAR, quasi sempre perché lì brucia una strada o un cortile del DBGT. "orto": cosa si vede sull'ortofoto 2018-19.

### Tabella 1: casi visti dal DBGT o da OSM, e i due di Carlo

In cima i due di Carlo, poi per numero di fonti, tipo e grandezza (profondità × area).

| # | tipo | via | x | z | dimensioni | profondità | fonti | ingresso | nel gioco oggi | verifica |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | autorimessa interrata | Via Giuseppe Mazzini | 120 | -450 | 2872 m² | LiDAR 8,2 m | LiDAR+OSM (parcheggio OSM e fossa vicini; LiDAR 2008 e DBGT 2015 diversi: cambiato) | passi carrai (133-135, -434) su via Mazzini, dove Carlo ha visto la rampa (x 130 z -435) | fossa morbida (S = LiDAR) | orto: giardino con prese d'aria sopra l'autorimessa; sullo scavo del 2008 c'è un palazzo nuovo con piscina; nel gioco conca di 5-8 m con prato e vialetti |
| 2 | autorimessa interrata | Via Yuri Gagarin | 538 | -495 | 22×14 m, 152 m² | LiDAR 5,6 m | LiDAR (rampa a spirale vista da Carlo nel gioco) | passo carraio (547, -489) a 1,5 m dalla fossa | fossa morbida (S = LiDAR) |  |
| 3 | sottopasso stradale | Strada provinciale ex SS 35 Milano-Meda | -577 | 79 | 2538 m² | LiDAR 3,6 m | DBGT+LiDAR+OSM | - | strada sotto l'impalcato (fase 3) |  |
| 4 | sottopasso pedonale | Via Pace | 345 | -484 | 453 m² | LiDAR 4,4 m | DBGT+LiDAR+OSM | scale dal piazzale della stazione (bocche nel LiDAR) | copertura (impalcato GALLER) senza fosse | nel gioco: piazzale e binari a raso, le bocche delle scale sono conche morbide; sotto non si passa |
| 5 | sottopasso stradale | Strada provinciale ex SS 35 Milano-Meda | -58 | 484 | 282 m² | - | DBGT+OSM | - | strada sotto l'impalcato (fase 3) |  |
| 6 | sottopasso stradale |  | 54 | 470 | 85 m² | - | DBGT+OSM | - | strada sotto l'impalcato (fase 3) |  |
| 7 | sottopasso stradale | Sovrappasso Monsignor Antonio Motta | 60 | 378 | 301 m² | - | DBGT+OSM | - | strada sotto l'impalcato (fase 3) |  |
| 8 | sottopasso stradale | Via Milano | -747 | -27 | 89 m² | - | DBGT+OSM | - | strada sotto l'impalcato (fase 3) |  |
| 9 | autorimessa interrata | Via Po | 1143 | 709 | volume 35 m²; fosse 3363 m² | DBGT: base a piano campagna, alto 3,4; LiDAR 2,3 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 10 | autorimessa interrata |  | 739 | 847 | volume 68 m²; fosse 2075 m² | DBGT: base a piano campagna, alto 4,0; LiDAR 4,8 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 11 | autorimessa interrata | Via Luigi Rho | 946 | -855 | volume 248 m²; fosse 1576 m² | DBGT: base 2,6 m sotto, alto 3,3; LiDAR 4,4 m | DBGT+LiDAR (volume e fossa vicini; LiDAR 2008 e DBGT 2015 diversi: cambiato) | testa della fossa a (935, -872), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 12 | autorimessa interrata | Via Indipendenza | 989 | -43 | 1548 m² | LiDAR 3,1 m | LiDAR+OSM (parcheggio OSM e fossa vicini) | testa della fossa a (1014, -12), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: sotto un supermercato |
| 13 | autorimessa interrata | Via Gorizia | 1229 | 498 | volume 81 m²; fosse 1271 m² | DBGT: base 3,3 m sotto, alto 3,4; LiDAR 2,8 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 14 | autorimessa interrata | Via Enrico Cialdini | 843 | -603 | volume 421 m²; fosse 705 m² | DBGT: base 3,4 m sotto, alto 3,5; LiDAR 2,3 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 15 | autorimessa interrata | Via delle Cave | -904 | -536 | volume 45 m²; fosse 628 m² | DBGT: base a piano campagna, alto 3,4; LiDAR 4,1 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) | orto: dubbio |
| 16 | autorimessa interrata | Via Cristoforo Colombo | -368 | -652 | volume 322 m²; fosse 623 m² | DBGT: base 2,3 m sotto, alto 4,0; LiDAR 3,6 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 17 | autorimessa interrata | Via Luigi Cadorna | 485 | -311 | volume 333 m²; fosse 510 m² | DBGT: base 2,7 m sotto, alto 3,6; LiDAR 3,1 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (465, -328) a 6 m, rampa non vista (probabile) | fossa morbida (S = LiDAR) |  |
| 18 | autorimessa interrata | Via Zara | 953 | -1110 | volume 374 m²; fosse 579 m² | DBGT: base 1,8 m sotto, alto 2,0; LiDAR 2,2 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 19 | autorimessa interrata | Via Este | 303 | 714 | volume 74 m²; fosse 350 m² | DBGT: base a piano campagna, alto 4,7; LiDAR 3,0 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (289, 696) a 5 m, rampa non vista (probabile) | fossa morbida (S = LiDAR) |  |
| 20 | autorimessa interrata | Via Milano | -608 | -343 | volume 313 m²; fosse 113 m² | DBGT: base 2,8 m sotto, alto 2,5; LiDAR 2,5 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (-609, -314) a 5 m, rampa non vista (probabile) | fossa morbida (S = LiDAR) |  |
| 21 | autorimessa interrata | Via Vicenza | 374 | 830 | volume 19 m²; fosse 266 m² | DBGT: base 2,2 m sotto, alto 2,5; LiDAR 3,0 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (366, 817), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 22 | autorimessa interrata | Via Trento | 849 | -1255 | volume 108 m²; fosse 200 m² | DBGT: base a piano campagna, alto 2,3; LiDAR 2,7 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (837, -1248), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 23 | autorimessa interrata |  | 770 | 766 | volume 74 m²; fosse 160 m² | DBGT: base 1,2 m sotto, alto 3,4; LiDAR 3,2 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (776, 775) a 2 m, rampa non vista (probabile) | fossa morbida (S = LiDAR) | orto: terrazzo e corsello |
| 24 | autorimessa interrata | Via Seveso | -179 | -247 | volume 28 m²; fosse 161 m² | DBGT: base 1,3 m sotto, alto 3,1; LiDAR 2,9 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 25 | autorimessa interrata | Via San Celso | -678 | 187 | volume 15 m²; fosse 130 m² | DBGT: base a piano campagna, alto 3,1; LiDAR 3,5 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (-675, 196), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 26 | autorimessa interrata | Via Felice Orsini | -83 | -465 | volume 105 m²; fosse 48 m² | DBGT: base 2,8 m sotto, alto 2,9; LiDAR 2,1 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (-74, -457), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: terrazzo |
| 27 | autorimessa interrata | Via Monte Grappa | 186 | -1327 | volume 52 m²; fosse 168 m² | DBGT: base a piano campagna, alto 2,9; LiDAR 1,8 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 28 | autorimessa interrata | Via Walter Tobagi | -1062 | -425 | volume 25 m²; fosse 180 m² | DBGT: base 0,6 m sotto, alto 2,2; LiDAR 1,7 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 29 | autorimessa interrata | Via Monte Ortigara | 94 | -1146 | volume 83 m²; fosse 29 m² | DBGT: base 3,3 m sotto, alto 3,2; LiDAR 2,3 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (89, -1141), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: riquadro pavimentato |
| 30 | autorimessa interrata | Via Marco Polo | 308 | 317 | volume 31 m²; fosse 139 m² | DBGT: base a piano campagna, alto 2,6; LiDAR 2,0 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (319, 320) a 5 m, rampa non vista (probabile) | fossa morbida (S = LiDAR) | orto: sotto un tetto, dubbio |
| 31 | autorimessa interrata | Via Tre Venezie | 646 | 590 | volume 50 m²; fosse 125 m² | DBGT: base a piano campagna, alto 3,0; LiDAR 2,1 m | DBGT+LiDAR (volume e fossa vicini) | non chiaro | fossa morbida (S = LiDAR) |  |
| 32 | autorimessa interrata | Via Iesolo | 324 | 811 | volume 52 m²; fosse 57 m² | DBGT: base 2,0 m sotto, alto 2,1; LiDAR 1,7 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (323, 798) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 33 | autorimessa interrata | Via Giulio Campi | 964 | -355 | volume 25 m²; fosse 60 m² | DBGT: base 1,6 m sotto, alto 3,1; LiDAR 2,2 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (986, -373) in testa alla rampa | fossa morbida (S = LiDAR) | orto: terrazzo |
| 34 | autorimessa interrata | Via Iesolo | 325 | 779 | volume 47 m²; fosse 60 m² | DBGT: base 1,4 m sotto, alto 2,7; LiDAR 2,1 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (315, 787) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 35 | autorimessa interrata | Via Ticino | 1014 | 484 | volume 34 m²; fosse 38 m² | DBGT: base 2,6 m sotto, alto 2,5; LiDAR 2,1 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (1013, 489), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: striscia fra due edifici |
| 36 | autorimessa interrata | Via Vignazzola | 34 | 742 | volume 29 m²; fosse 51 m² | DBGT: base a piano campagna, alto 3,3; LiDAR 2,2 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (38, 741), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 37 | autorimessa interrata | Via Venticinque Aprile | -274 | -473 | 13×6 m, 59 m² | LiDAR 2,6 m | LiDAR+OSM (parcheggio OSM e fossa vicini) | testa della fossa a (-277, -470), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,4 m sopra il LiDAR) | orto: rampa coperta nel parcheggio |
| 38 | autorimessa interrata | Via Asti | 524 | -1687 | volume 31 m²; fosse 25 m² | DBGT: base 2,2 m sotto, alto 2,4; LiDAR 1,8 m | DBGT+LiDAR (volume e fossa vicini) | testa della fossa a (522, -1685), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 39 | autorimessa interrata | Via Carso | 191 | -1009 | volume 5 m²; fosse 28 m² | DBGT: base a piano campagna, alto 3,0; LiDAR 1,8 m | DBGT+LiDAR (volume e fossa vicini) | passo carraio (190, -1020) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 40 | rampa? | Via Arno | 881 | 861 | 9×6 m, 54 m² | LiDAR 2,4 m | LiDAR+OSM | passo carraio (877, 852) in testa alla rampa | fossa in parte spianata (S 1,5 m sopra il LiDAR) |  |
| 41 | sottopasso pedonale | Via Pace | 408 | -541 |  | - | OSM | - | niente |  |
| 42 | sottopasso stradale | Strada provinciale ex SS 35 Milano-Meda | -767 | 103 |  | - | OSM (OSM: Milano-Meda bridge=yes sopra la via tunnel=yes; DBGT senza PONTE (sul confine)) | - | niente impalcato: la via sale sul rilevato (S = LiDAR) | nel gioco la via incrocia la Milano-Meda a raso su un dosso di 6 m |
| 43 | sottopasso stradale | Via Vignazzola | -22 | 764 | 97 m² | ? | DBGT | - | strada sotto l'impalcato (fase 3) |  |
| 44 | autorimessa interrata | Via Trieste | 1515 | -961 | volume 217 m² | DBGT: base 4,1 m sotto, alto 4,2 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: copertura piana accanto al capannone |
| 45 | autorimessa interrata | Via delle Cave | -566 | -596 | volume 831 m² | DBGT: base 1,0 m sotto, alto 4,9 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: prato condominiale con prese d'aria: autorimessa sotto il giardino |
| 46 | autorimessa interrata |  | 234 | -891 | volume 93 m² | DBGT: base 4,6 m sotto, alto 4,5 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 47 | autorimessa interrata | Salita delle Benedettine | 41 | -762 | volume 78 m² | DBGT: base 4,6 m sotto, alto 4,5 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: giardino sotto gli alberi |
| 48 | autorimessa interrata | Via Monte Bianco | 114 | -1272 | volume 141 m² | DBGT: base 2,2 m sotto, alto 3,0 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 49 | autorimessa interrata | Via Monte Grappa | 32 | -1280 | volume 61 m² | DBGT: base 4,1 m sotto, alto 3,9 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 50 | autorimessa interrata | Via Monte Rosa | 350 | -1022 | volume 66 m² | DBGT: base 2,7 m sotto, alto 2,8 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: due riquadri nel giardino |
| 51 | autorimessa interrata | Via Carlo Agrati | -219 | -1054 | volume 98 m² | DBGT: base 1,4 m sotto, alto 2,5 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 52 | autorimessa interrata | Via delle Colline | 118 | -1340 | volume 55 m² | DBGT: base 2,2 m sotto, alto 2,1 | DBGT (nessuna fossa nel LiDAR) | passo carraio (118, -1350) a 2 m, rampa non vista (probabile) | niente (volume 08 non disegnato, sopra S = terreno) | orto: rampa lungo l'edificio |
| 53 | autorimessa interrata | Via delle Colline | 304 | -1193 | volume 36 m² | DBGT: base 3,2 m sotto, alto 3,1 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 54 | autorimessa interrata | Via Monte Cervino | 317 | -1083 | volume 72 m² | DBGT: base 1,6 m sotto, alto 3,3 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 55 | autorimessa interrata | Via Leonardo da Vinci | 1051 | -193 | volume 51 m² | DBGT: base 1,5 m sotto, alto 2,8 | DBGT (nessuna fossa nel LiDAR) | passo carraio (1039, -187) a 6 m, rampa non vista (probabile) | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 56 | autorimessa interrata | Via Moncenisio | 295 | -976 | volume 25 m² | DBGT: base 2,7 m sotto, alto 2,9 | DBGT (nessuna fossa nel LiDAR) | passo carraio (288, -973) a 6 m, rampa non vista (probabile) | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 57 | autorimessa interrata | Via Monte Grappa | 183 | -1446 | volume 63 m² | DBGT: base a piano campagna, alto 2,5 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: terrazza piana accanto all'edificio |
| 58 | autorimessa interrata | Via Tre Venezie | 265 | 517 | volume 38 m² | DBGT: base a piano campagna, alto 6,8 | DBGT (nessuna fossa nel LiDAR) | passo carraio (268, 505) a 3 m, rampa non vista (probabile) | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 59 | autorimessa interrata | Via Tre Venezie | 1253 | 659 | volume 14 m² | DBGT: base 0,5 m sotto, alto 2,7 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: striscia fra edifici |
| 60 | autorimessa interrata | Via Carso | 207 | -1045 | volume 55 m² | DBGT: base a piano campagna, alto 4,8 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 61 | autorimessa interrata | Via Volturno | 783 | 849 | volume 11 m² | DBGT: base a piano campagna, alto 2,3 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: piccolo, dubbio |
| 62 | autorimessa interrata | Via Monte Ortigara | 141 | -1191 | volume 32 m² | DBGT: base a piano campagna, alto 4,1 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 63 | autorimessa interrata | Via Santa Caterina da Siena | 619 | 53 | volume 30 m² | DBGT: base a piano campagna, alto 2,3 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 64 | autorimessa interrata | Via Laguna | 620 | 663 | volume 12 m² | DBGT: base a piano campagna, alto 3,2 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: piccolo, dubbio |
| 65 | autorimessa interrata | Via Marco Polo | 200 | 597 | volume 94 m² | DBGT: base a piano campagna, alto 3,9 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) | orto: striscia lungo l'edificio, dubbio |
| 66 | autorimessa interrata | Via Carso | 167 | -1046 | volume 54 m² | DBGT: base a piano campagna, alto 4,5 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 67 | autorimessa interrata | Via Adige | 278 | 649 | volume 29 m² | DBGT: base a piano campagna, alto 4,2 | DBGT (nessuna fossa nel LiDAR) | passo carraio (281, 640) a 6 m, rampa non vista (probabile) | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 68 | autorimessa interrata | Via Carlo Agrati | -275 | -1132 | volume 21 m² | DBGT: base a piano campagna, alto 2,3 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 69 | autorimessa interrata | Via Martiri di Bologna | -996 | -396 | volume 20 m² | DBGT: base a piano campagna, alto 2,3 | DBGT (nessuna fossa nel LiDAR) | non chiaro | niente (volume 08 non disegnato, sopra S = terreno) |  |
| 70 | autorimessa interrata | Via Yuri Gagarin | 591 | -600 | 38 m² | 1 piano (layer -1) | OSM | ingresso OSM (596, -602) | niente | orto 2018: cantiere, il parcheggio è stato fatto dopo |
| 71 | corso d'acqua tombinato | Via Enrico Cialdini | 480 | -822 |  | - | OSM | - | non serve (acqua coperta) |  |
| 72 | androne o passaggio coperto | Piazza Vittorio Veneto | 66 | -832 |  | a raso | OSM | - | si passa sotto il volume rialzato UN_VOL 04 |  |
| 73 | androne o passaggio coperto | Piazza Alessandro Volta | -88 | -849 |  | a raso | OSM | - | si passa sotto il volume rialzato UN_VOL 04 |  |
| 74 | androne o passaggio coperto | Piazza Alessandro Volta | -66 | -836 |  | a raso | OSM | - | si passa sotto il volume rialzato UN_VOL 04 |  |
| 75 | androne o passaggio coperto | Via Alessandro Manzoni | -101 | -863 |  | a raso | OSM | - | si passa sotto il volume rialzato UN_VOL 04 |  |
| 76 | corso d'acqua tombinato | Viale Francia | 216 | -388 |  | - | OSM | - | non serve (acqua coperta) |  |
| 77 | corso d'acqua tombinato | Largo Europa | 296 | -557 |  | - | OSM | - | non serve (acqua coperta) |  |
| 78 | androne o passaggio coperto | Via Arno | 860 | 875 |  | a raso | OSM | - | niente |  |
| 79 | corso d'acqua tombinato | Strada provinciale ex SS 35 Milano-Meda | -247 | 211 |  | - | OSM | - | non serve (acqua coperta) |  |
| 80 | corso d'acqua tombinato | Via Luigi Cadorna | -104 | -110 |  | - | OSM | - | non serve (acqua coperta) |  |
| 81 | corso d'acqua tombinato | Via San Giuseppe | 458 | -1031 |  | - | OSM | - | non serve (acqua coperta) |  |

### Tabella 2: fosse viste solo dal LiDAR

Prima le "rampe?" con il passo carraio in testa, poi le altre rampe, poi i cortili ribassati e gli scavi, ognuno per grandezza. Dal campione, metà delle "rampe?" sono rampe.

| # | tipo | via | x | z | dimensioni | profondità | ingresso | nel gioco oggi | verifica |
|---|---|---|---|---|---|---|---|---|---|
| 1 | rampa? | Via Lombardia | 1066 | -479 | 2614 m² | LiDAR 4,4 m | passo carraio (1085, -443) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 2 | rampa? | Via Concordia | -860 | -520 | 767 m² | LiDAR 3,5 m | passo carraio (-875, -484) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 3 | rampa? | Via Venti Settembre | 20 | -643 | 99 m² | LiDAR 5,0 m | passo carraio (27, -637) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 4 | rampa? | Via Vignoni | -14 | -661 | 125 m² | LiDAR 2,8 m | passo carraio (-29, -638) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 5 | rampa? | Via Goito | 1607 | 346 | 111 m² | LiDAR 3,1 m | passo carraio (1605, 356) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 6 | rampa? | Via Po | 430 | 620 | 22×8 m, 131 m² | LiDAR 2,4 m | passo carraio (430, 605) in testa alla rampa | fossa morbida (S = LiDAR) | orto: dubbio (in parte sotto un tetto) |
| 7 | rampa? | Via Isonzo | 550 | -236 | 58 m² | LiDAR 5,8 m | passo carraio (560, -240) in testa alla rampa | fossa in parte spianata (S 2,3 m sopra il LiDAR) |  |
| 8 | rampa? | Via Antonio Rosmini | -759 | -1214 | 21×7 m, 110 m² | LiDAR 2,5 m | passo carraio (-758, -1200) in testa alla rampa | fossa morbida (S = LiDAR) | orto: rampa curva dalla strada |
| 9 | rampa? | Via Tintoretto | 1030 | -402 | 12×8 m, 85 m² | LiDAR 2,9 m | passo carraio (1042, -410) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 10 | rampa? | Via Naviglio | -392 | -340 | 91 m² | LiDAR 2,7 m | passo carraio (-401, -346) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 11 | rampa? | Via Grado | 68 | 747 | 115 m² | LiDAR 2,1 m | passo carraio (90, 748) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 12 | rampa? | Via dell'Artigianato | 1659 | -469 | 83 m² | LiDAR 2,8 m | passo carraio (1634, -468) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 13 | rampa? | Via Fiume | 1120 | -1110 | 11×7 m, 64 m² | LiDAR 3,0 m | passo carraio (1126, -1097) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 14 | rampa? | Via Generale Lamarmora | 886 | -811 | 12×5 m, 59 m² | LiDAR 3,1 m | passo carraio (901, -807) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 15 | rampa? | Via Concordia | -860 | -467 | 12×7 m, 66 m² | LiDAR 2,7 m | passo carraio (-871, -471) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 16 | rampa? | Via Cesare Battisti | -359 | -249 | 13×6 m, 64 m² | LiDAR 2,7 m | passo carraio (-366, -259) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 17 | rampa? | Via Pescarenico | -584 | -1326 | 9×7 m, 60 m² | LiDAR 2,8 m | passo carraio (-592, -1337) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 18 | rampa? | Vicolo Comunale | 190 | -567 | 13×5 m, 63 m² | LiDAR 2,7 m | passo carraio (197, -562) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 19 | rampa? | Via Tolmezzo | 275 | 331 | 12×7 m, 65 m² | LiDAR 2,5 m | passo carraio (277, 329) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 20 | rampa? | Via Tiziano Vecellio | 994 | -487 | 11×6 m, 60 m² | LiDAR 2,7 m | passo carraio (993, -480) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 21 | rampa? | Via Isonzo | 544 | -184 | 9×5 m, 49 m² | LiDAR 3,1 m | passo carraio (543, -189) in testa alla rampa | fossa in parte spianata (S 0,7 m sopra il LiDAR) |  |
| 22 | rampa? | Via Valtellina | 735 | -1498 | 9×8 m, 61 m² | LiDAR 2,5 m | passo carraio (726, -1489) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 23 | rampa? | Via delle Cave | -767 | -575 | 11×6 m, 52 m² | LiDAR 2,8 m | passo carraio (-765, -562) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 24 | rampa? | Via Calabria | 1622 | -785 | 11×5 m, 56 m² | LiDAR 2,5 m | passo carraio (1634, -778) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 25 | rampa? | Via Enrico Fermi | 1566 | -54 | 8×8 m, 63 m² | LiDAR 2,2 m | passo carraio (1579, -58) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 26 | rampa? | Via Vignoni | -144 | -523 | 9×5 m, 39 m² | LiDAR 3,4 m | passo carraio (-140, -521) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 27 | rampa? | Via Pordenone | 1271 | 648 | 8×7 m, 54 m² | LiDAR 2,3 m | passo carraio (1279, 647) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 28 | rampa? | Via Ciro Menotti | 1090 | 304 | 8×6 m, 48 m² | LiDAR 2,6 m | passo carraio (1102, 311) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 29 | rampa? | Via Peschiera | 1630 | 471 | 9×8 m, 64 m² | LiDAR 1,9 m | passo carraio (1636, 459) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 30 | rampa? | Via Piave | 1022 | 343 | 12×6 m, 54 m² | LiDAR 2,2 m | passo carraio (1027, 336) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 31 | rampa? | Via San Giusto | 1362 | -621 | 8×6 m, 43 m² | LiDAR 2,6 m | passo carraio (1348, -624) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 32 | rampa? | Via Milano | -622 | -259 | 7×6 m, 46 m² | LiDAR 2,5 m | passo carraio (-619, -257) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 33 | rampa? | Via Giosuè Carducci | -292 | -688 | 7×7 m, 44 m² | LiDAR 2,5 m | passo carraio (-305, -682) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 34 | rampa? | Via Piave | 1264 | 388 | 8×8 m, 55 m² | LiDAR 2,0 m | passo carraio (1279, 387) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 35 | rampa? | Via Tevere | 1172 | 880 | 8×6 m, 44 m² | LiDAR 2,3 m | passo carraio (1174, 889) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 36 | rampa? | Via Pordenone | 1278 | 545 | 10×3 m, 25 m² | LiDAR 3,8 m | passo carraio (1271, 547) in testa alla rampa | fossa in parte spianata (S 0,9 m sopra il LiDAR) |  |
| 37 | rampa? | Via Forlì | 1337 | 804 | 8×5 m, 39 m² | LiDAR 2,6 m | passo carraio (1329, 800) in testa alla rampa | fossa in parte spianata (S 0,7 m sopra il LiDAR) |  |
| 38 | rampa? | Via del Falò | 438 | -1012 | 8×5 m, 39 m² | LiDAR 2,5 m | passo carraio (431, -1021) in testa alla rampa | fossa in parte spianata (S 1,5 m sopra il LiDAR) |  |
| 39 | rampa? | Via Legnano | 1656 | 286 | 11×6 m, 47 m² | LiDAR 2,0 m | passo carraio (1653, 296) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 40 | rampa? | Via Po | 1323 | 847 | 7×5 m, 39 m² | LiDAR 2,4 m | passo carraio (1316, 838) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 41 | rampa? | Via Forlì | 1330 | 826 | 7×5 m, 36 m² | LiDAR 2,5 m | passo carraio (1321, 821) in testa alla rampa | fossa in parte spianata (S 0,5 m sopra il LiDAR) |  |
| 42 | rampa? | Via Forlì | 1345 | 783 | 8×3 m, 33 m² | LiDAR 2,4 m | passo carraio (1336, 781) in testa alla rampa | fossa in parte spianata (S 0,8 m sopra il LiDAR) |  |
| 43 | rampa? | Via Abano | 267 | 743 | 8×5 m, 36 m² | LiDAR 1,9 m | passo carraio (265, 734) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 44 | rampa? | Via Leonardo da Vinci | 1029 | -172 | 8×4 m, 28 m² | LiDAR 2,4 m | passo carraio (1031, -181) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 45 | rampa? | Via Iesolo | 301 | 803 | 7×6 m, 40 m² | LiDAR 1,7 m | passo carraio (308, 793) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 46 | rampa? | Via dei Giovi | -592 | 525 | 8×6 m, 39 m² | LiDAR 1,8 m | passo carraio (-602, 522) in testa alla rampa | spianato (S a piano strada) |  |
| 47 | rampa? | Via Po | 508 | 599 | 7×4 m, 37 m² | LiDAR 1,9 m | passo carraio (502, 608) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 48 | rampa? | Via Stelvio | 747 | -1645 | 8×6 m, 41 m² | LiDAR 1,7 m | passo carraio (736, -1654) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 49 | rampa? | Via Giulio Campi | 880 | -312 | 6×6 m, 34 m² | LiDAR 2,0 m | passo carraio (891, -308) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 50 | rampa? | Via Grado | 121 | 670 | 8×3 m, 29 m² | LiDAR 2,3 m | passo carraio (109, 670) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 51 | rampa? | Via Carnia | 324 | 398 | 6×5 m, 31 m² | LiDAR 1,9 m | passo carraio (321, 411) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 52 | rampa? | Via Lombardia | 659 | 255 | 9×3 m, 29 m² | LiDAR 1,9 m | passo carraio (652, 263) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 53 | rampa? | Via Roma | 117 | -518 | 4×4 m, 20 m² | LiDAR 2,7 m | passo carraio (120, -525) in testa alla rampa | fossa in parte spianata (S 0,7 m sopra il LiDAR) |  |
| 54 | rampa? | Via del Cimitero | 509 | -276 | 7×3 m, 22 m² | LiDAR 2,4 m | passo carraio (514, -267) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 55 | rampa? | Corso della Resistenza | 411 | -504 | 6×4 m, 21 m² | LiDAR 2,4 m | passo carraio (401, -512) in testa alla rampa | fossa in parte spianata (S 1,4 m sopra il LiDAR) |  |
| 56 | rampa? | Via Bernardino Luini | 1203 | -219 | 5×4 m, 24 m² | LiDAR 1,9 m | passo carraio (1207, -231) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 57 | rampa? | Via Serio | -344 | -316 | 6×5 m, 29 m² | LiDAR 1,5 m | passo carraio (-353, -315) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 58 | rampa? | Via Leonardo da Vinci | 1307 | -38 | 9×2 m, 20 m² | LiDAR 1,8 m | passo carraio (1306, -25) in testa alla rampa | fossa in parte spianata (S 0,5 m sopra il LiDAR) |  |
| 59 | rampa? | Via Lombardia | 1178 | -533 | 4×4 m, 18 m² | LiDAR 2,0 m | passo carraio (1166, -532) in testa alla rampa | fossa morbida (S = LiDAR) | orto: no |
| 60 | rampa? | Via Enrico Cialdini | 823 | -633 | 5×4 m, 22 m² | LiDAR 1,6 m | passo carraio (828, -646) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 61 | rampa? | Via Consorziale dei boschi | 968 | 253 | 6×2 m, 16 m² | LiDAR 1,9 m | passo carraio (969, 248) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 62 | rampa? | Via fratelli Bandiera | 1013 | 235 | 4×4 m, 18 m² | LiDAR 1,7 m | passo carraio (1020, 242) in testa alla rampa | fossa morbida (S = LiDAR) | orto: dubbio |
| 63 | rampa? | Via Consorziale dei boschi | 842 | 119 | 5×4 m, 17 m² | LiDAR 1,6 m | passo carraio (829, 116) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 64 | rampa? | Via Piave | 1050 | 322 | 4×3 m, 15 m² | LiDAR 1,8 m | passo carraio (1041, 331) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 65 | rampa? | Via Martesana | -647 | -161 | 6×2 m, 15 m² | LiDAR 1,5 m | passo carraio (-643, -157) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 66 | rampa? | Via Livenza | 1545 | 247 | 4×3 m, 15 m² | LiDAR 1,5 m | passo carraio (1555, 253) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 67 | rampa? | Largo Paolo Giorgetti | -437 | -73 | 1804 m² | LiDAR 3,0 m | testa della fossa a (-446, -24), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 68 | rampa? | Via Leonardo da Vinci | 1407 | 10 | 685 m² | LiDAR 3,1 m | testa della fossa a (1433, -10), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 69 | rampa? | Corso della Resistenza | 452 | -477 | 306 m² | LiDAR 5,0 m | testa della fossa a (449, -446), passo carraio non trovato (probabile) | fossa in parte spianata (S 0,8 m sopra il LiDAR) |  |
| 70 | rampa? | Via Ferrara | 1463 | 670 | 407 m² | LiDAR 2,7 m | testa della fossa a (1459, 670), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 71 | rampa? | Viale Francia | 136 | -312 | 155 m² | LiDAR 5,8 m | testa della fossa a (133, -308), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 72 | rampa? | Via Indipendenza | 805 | -67 | 26×9 m, 181 m² | LiDAR 3,2 m | testa della fossa a (806, -76), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 73 | rampa? | Via Varese | 570 | -1663 | 301 m² | LiDAR 2,0 m | testa della fossa a (588, -1654), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 74 | rampa? | Via Este | 246 | 693 | 35×8 m, 201 m² | LiDAR 2,8 m | testa della fossa a (243, 705), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 75 | rampa? | Via Achille Grandi | 860 | -1634 | 206 m² | LiDAR 2,7 m | testa della fossa a (845, -1650), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 76 | rampa? | Via Tre Venezie | 1302 | 733 | 170 m² | LiDAR 3,1 m | testa della fossa a (1319, 742), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 77 | rampa? | Via Sant'Agostino | 1026 | -841 | 14×9 m, 106 m² | LiDAR 3,8 m | testa della fossa a (1020, -843), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 78 | rampa? | Via Gorizia | 550 | 274 | 150 m² | LiDAR 2,7 m | testa della fossa a (555, 282), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 79 | rampa? | Via Pace | 592 | -694 | 16×8 m, 101 m² | LiDAR 3,1 m | testa della fossa a (587, -698), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 80 | rampa? | Via Tevere | 1114 | 915 | 16×9 m, 102 m² | LiDAR 3,0 m | testa della fossa a (1115, 909), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: rampa curva; nel gioco discesa morbida fra due case |
| 81 | rampa? | Via Leonardo da Vinci | 1188 | -51 | 162 m² | LiDAR 2,0 m | testa della fossa a (1179, -39), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 82 | rampa? | Via Laguna | 650 | 697 | 11×9 m, 89 m² | LiDAR 3,4 m | testa della fossa a (646, 697), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 83 | rampa? | Via Como | 556 | -1160 | 12×9 m, 92 m² | LiDAR 3,0 m | testa della fossa a (558, -1164), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 84 | rampa? | Via Trieste | 1484 | -910 | 18×6 m, 95 m² | LiDAR 2,8 m | testa della fossa a (1487, -917), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 85 | rampa? | Via Guglielmo Marconi | 751 | -231 | 15×6 m, 84 m² | LiDAR 3,1 m | testa della fossa a (755, -227), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: rampa in un prato con prese d'aria (autorimessa sotto il prato, non nel DBGT) |
| 86 | rampa? | Via Luigi Rho | 755 | -965 | 12×8 m, 92 m² | LiDAR 2,9 m | testa della fossa a (753, -962), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 87 | rampa? | Via Giovanni Pascoli | 1159 | -955 | 16×8 m, 104 m² | LiDAR 2,5 m | testa della fossa a (1161, -950), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 88 | rampa? | Via Enrico Cialdini | 702 | -736 | 13×8 m, 81 m² | LiDAR 3,1 m | testa della fossa a (700, -740), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: striscia lungo l'edificio, rampa probabile |
| 89 | rampa? | Via dei Caduti Medesi | 1224 | 277 | 15×7 m, 84 m² | LiDAR 3,0 m | testa della fossa a (1225, 271), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 90 | rampa? | Via Indipendenza | 814 | -120 | 26×6 m, 78 m² | LiDAR 3,0 m | testa della fossa a (808, -127), passo carraio non trovato (probabile) | fossa in parte spianata (S 2,0 m sopra il LiDAR) |  |
| 91 | rampa? | Via Giotto | 792 | -618 | 57 m² | LiDAR 4,4 m | testa della fossa a (784, -624), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 92 | rampa? | Via Val Seriana | 803 | -1400 | 16×9 m, 104 m² | LiDAR 2,2 m | testa della fossa a (808, -1398), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 93 | rampa? | Via Casarilli | 1064 | -285 | 14×8 m, 91 m² | LiDAR 2,4 m | testa della fossa a (1060, -288), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 94 | rampa? | Via San Giorgio | 1507 | -613 | 16×6 m, 79 m² | LiDAR 2,8 m | testa della fossa a (1509, -619), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 95 | rampa? | Via Federico Borromeo | -562 | -1130 | 13×5 m, 67 m² | LiDAR 3,2 m | testa della fossa a (-566, -1134), passo carraio non trovato (probabile) | fossa in parte spianata (S 0,7 m sopra il LiDAR) |  |
| 96 | rampa? | Via Trieste | 1014 | -1233 | 13×6 m, 58 m² | LiDAR 3,3 m | testa della fossa a (1010, -1237), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 97 | rampa? |  | 49 | -123 | 10×8 m, 70 m² | LiDAR 2,8 m | testa della fossa a (48, -127), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 98 | rampa? | Via Ticino | 987 | 521 | 12×5 m, 55 m² | LiDAR 3,4 m | testa della fossa a (991, 523), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 99 | rampa? | Via Po | 1163 | 772 | 22×8 m, 84 m² | LiDAR 2,1 m | testa della fossa a (1155, 765), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 100 | rampa? | Via Santa Maria | -175 | -1627 | 11×9 m, 82 m² | LiDAR 2,2 m | testa della fossa a (-171, -1627), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 101 | rampa? | Via Este | 292 | 675 | 10×8 m, 71 m² | LiDAR 2,5 m | testa della fossa a (294, 672), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 102 | rampa? | Via Adria | 1416 | 723 | 14×5 m, 65 m² | LiDAR 2,7 m | testa della fossa a (1419, 718), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 103 | rampa? | Via Trieste | 1104 | -1188 | 14×8 m, 92 m² | LiDAR 1,9 m | testa della fossa a (1108, -1186), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 104 | rampa? | Via Leonardo da Vinci | 996 | -156 | 13×8 m, 82 m² | LiDAR 2,1 m | testa della fossa a (999, -160), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: striscia lungo l'edificio, rampa probabile |
| 105 | rampa? | Via Adda | 1262 | 890 | 13×6 m, 71 m² | LiDAR 2,3 m | testa della fossa a (1266, 892), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 106 | rampa? | Via Tevere | 925 | 883 | 8×8 m, 51 m² | LiDAR 3,0 m | testa della fossa a (922, 884), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 107 | rampa? | Corso Giacomo Matteotti | 127 | -611 | 13×5 m, 55 m² | LiDAR 2,8 m | testa della fossa a (128, -616), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 108 | rampa? | Via Peschiera | 1502 | 393 | 15×4 m, 53 m² | LiDAR 2,8 m | testa della fossa a (1505, 397), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 109 | rampa? | Via Pietro Orsi | 485 | -702 | 12×5 m, 58 m² | LiDAR 2,6 m | testa della fossa a (489, -700), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 110 | rampa? | Via Pace | 483 | -523 | 10×6 m, 63 m² | LiDAR 2,4 m | testa della fossa a (480, -520), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 111 | rampa? | Via Giuseppe Verdi | 98 | -482 | 11×8 m, 68 m² | LiDAR 2,2 m | testa della fossa a (99, -486), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: striscia pavimentata fra edifici, rampa probabile |
| 112 | rampa? | Via Nazario Sauro | -306 | -502 | 47 m² | LiDAR 3,5 m | testa della fossa a (-312, -495), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,9 m sopra il LiDAR) |  |
| 113 | rampa? | Via Adria | 1452 | 748 | 10×6 m, 53 m² | LiDAR 2,8 m | testa della fossa a (1454, 745), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 114 | rampa? | Via Enrico Fermi | 1501 | 122 | 12×5 m, 53 m² | LiDAR 2,7 m | testa della fossa a (1506, 123), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 115 | rampa? | Via Canova | 1136 | -144 | 12×7 m, 68 m² | LiDAR 2,1 m | testa della fossa a (1134, -140), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 116 | rampa? | Via Santa Maria | -80 | -1421 | 10×5 m, 49 m² | LiDAR 2,9 m | testa della fossa a (-79, -1424), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: no (terreno incolto con uno scavo) |
| 117 | rampa? | Via del Cimitero | 513 | -225 | 11×3 m, 29 m² | LiDAR 4,4 m | testa della fossa a (511, -221), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,6 m sopra il LiDAR) |  |
| 118 | rampa? | Via Farga | -547 | -221 | 10×7 m, 67 m² | LiDAR 2,1 m | testa della fossa a (-545, -224), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 119 | rampa? | Via Brennero | -361 | 628 | 5×4 m, 25 m² | LiDAR 5,3 m | testa della fossa a (-360, 630), passo carraio non trovato (probabile) | fossa in parte spianata (S 0,5 m sopra il LiDAR) |  |
| 120 | rampa? | Via Calabria | 1588 | -627 | 12×7 m, 73 m² | LiDAR 1,9 m | testa della fossa a (1586, -623), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 121 | rampa? | Via Tommaso Edison | 1649 | 90 | 9×9 m, 66 m² | LiDAR 2,0 m | testa della fossa a (1652, 92), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 122 | rampa? | Via San Giorgio | 1236 | -831 | 8×7 m, 57 m² | LiDAR 2,3 m | testa della fossa a (1235, -828), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 123 | rampa? | Via Antonio Meucci | 1724 | -278 | 10×7 m, 55 m² | LiDAR 2,4 m | testa della fossa a (1723, -282), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 124 | rampa? | Via Po | 381 | 612 | 12×7 m, 77 m² | LiDAR 1,7 m | testa della fossa a (385, 614), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: cortile interno, dubbio |
| 125 | rampa? | Via Cesare Battisti | -336 | -239 | 7×5 m, 38 m² | LiDAR 3,3 m | testa della fossa a (-338, -241), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 126 | rampa? | Via Adria | 1493 | 721 | 10×6 m, 50 m² | LiDAR 2,5 m | testa della fossa a (1490, 719), passo carraio non trovato (probabile) | spianato (S a piano strada) |  |
| 127 | rampa? | Via Consorziale dei boschi | 965 | 153 | 63 m² | LiDAR 2,2 m | testa della fossa a (959, 155), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 128 | rampa? | Via dei Cipressi | 189 | -141 | 10×6 m, 60 m² | LiDAR 2,0 m | testa della fossa a (187, -137), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 129 | rampa? | Via Yuri Gagarin | 497 | -434 | 9×4 m, 28 m² | LiDAR 4,0 m | testa della fossa a (498, -438), passo carraio non trovato (probabile) | fossa in parte spianata (S 2,0 m sopra il LiDAR) |  |
| 130 | rampa? | Via Canturina | -1044 | -349 | 11×7 m, 73 m² | LiDAR 1,7 m | testa della fossa a (-1041, -351), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 131 | rampa? | Via Alessandro Manzoni | -886 | -1378 | 9×5 m, 44 m² | LiDAR 2,7 m | testa della fossa a (-883, -1380), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 132 | rampa? | Via Lombardia | 1321 | -845 | 9×6 m, 51 m² | LiDAR 2,3 m | testa della fossa a (1321, -848), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 133 | rampa? | Via Alessandro Manzoni | -707 | -1253 | 11×6 m, 50 m² | LiDAR 2,3 m | testa della fossa a (-704, -1250), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 134 | rampa? | Via Dante Alighieri | -372 | -594 | 66 m² | LiDAR 1,9 m | testa della fossa a (-375, -585), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 135 | rampa? | Via Alessandro Manzoni | -617 | -1192 | 11×5 m, 46 m² | LiDAR 2,3 m | testa della fossa a (-620, -1189), passo carraio non trovato (probabile) | spianato (S a piano strada) | orto: corsello fra due edifici, rampa probabile |
| 136 | rampa? | Via Seveso | -392 | -480 | 11×6 m, 56 m² | LiDAR 2,0 m | testa della fossa a (-389, -477), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 137 | rampa? | Via Valtellina | 835 | -1610 | 11×4 m, 43 m² | LiDAR 2,5 m | testa della fossa a (832, -1613), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 138 | rampa? | Via G. B. Crespi | 898 | -334 | 7×7 m, 45 m² | LiDAR 2,4 m | testa della fossa a (900, -334), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 139 | rampa? | Via Palestro | 352 | -723 | 8×6 m, 43 m² | LiDAR 2,5 m | testa della fossa a (354, -722), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 140 | rampa? | Via Ferrara | 1529 | 704 | 11×5 m, 40 m² | LiDAR 2,6 m | testa della fossa a (1531, 707), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 141 | rampa? | Via Leonardo da Vinci | 1294 | 10 | 9×8 m, 70 m² | LiDAR 1,5 m | testa della fossa a (1292, 6), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 142 | rampa? | Via San Fedele | 705 | -33 | 11×3 m, 30 m² | LiDAR 3,3 m | testa della fossa a (709, -30), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 143 | rampa? | Via Trento | 752 | -1108 | 9×6 m, 50 m² | LiDAR 2,1 m | testa della fossa a (748, -1109), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 144 | rampa? | Via Pietro Orsi | 529 | -750 | 8×4 m, 41 m² | LiDAR 2,5 m | testa della fossa a (527, -747), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 145 | rampa? | Via San Giorgio | 1464 | -641 | 8×6 m, 41 m² | LiDAR 2,5 m | testa della fossa a (1465, -644), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 146 | rampa? | Via Carlo Agrati | -250 | -1182 | 7×5 m, 37 m² | LiDAR 2,7 m | testa della fossa a (-253, -1183), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,9 m sopra il LiDAR) |  |
| 147 | rampa? | Via Libertà | -808 | -438 | 7×5 m, 41 m² | LiDAR 2,5 m | testa della fossa a (-805, -438), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 148 | rampa? | Via Lombardia | 687 | 222 | 9×5 m, 40 m² | LiDAR 2,4 m | testa della fossa a (685, 224), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 149 | rampa? | Via Indipendenza | 1595 | 168 | 11×5 m, 38 m² | LiDAR 2,5 m | testa della fossa a (1593, 166), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 150 | rampa? | Via Santa Maria | -133 | -1632 | 10×5 m, 54 m² | LiDAR 1,8 m | testa della fossa a (-129, -1631), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,0 m sopra il LiDAR) |  |
| 151 | rampa? | Via San Giorgio | 1523 | -650 | 11×4 m, 39 m² | LiDAR 2,4 m | testa della fossa a (1525, -654), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 152 | rampa? | Via Pietro Maroncelli | 1462 | 230 | 13×5 m, 44 m² | LiDAR 2,1 m | testa della fossa a (1466, 231), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 153 | rampa? | Via Antonio Meucci | 1697 | -259 | 8×6 m, 45 m² | LiDAR 2,1 m | testa della fossa a (1700, -257), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 154 | rampa? | Via Zara | 910 | -1161 | 9×4 m, 37 m² | LiDAR 2,5 m | testa della fossa a (912, -1164), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: dubbio (alberi) |
| 155 | rampa? | Via Milano | -626 | -193 | 13×4 m, 52 m² | LiDAR 1,7 m | testa della fossa a (-622, -192), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 156 | rampa? | Via della Cavalla | 1001 | 938 | 10×7 m, 58 m² | LiDAR 1,5 m | testa della fossa a (1004, 938), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 157 | rampa? | Via Po | 1249 | 830 | 9×6 m, 49 m² | LiDAR 1,8 m | testa della fossa a (1251, 828), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 158 | rampa? | Via Piave | 911 | 292 | 12×6 m, 50 m² | LiDAR 1,7 m | testa della fossa a (914, 293), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 159 | rampa? | Via Antonio Meucci | 1832 | -205 | 8×6 m, 52 m² | LiDAR 1,7 m | testa della fossa a (1829, -205), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: vialetto che scende verso la casa, rampa |
| 160 | rampa? | Via Calabria | 1524 | -538 | 6×6 m, 34 m² | LiDAR 2,5 m | testa della fossa a (1525, -540), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 161 | rampa? | Via Conciliazione | -707 | -254 | 11×4 m, 42 m² | LiDAR 2,0 m | testa della fossa a (-710, -253), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 162 | rampa? | Via Giosuè Carducci | -88 | -506 | 10×5 m, 42 m² | LiDAR 2,0 m | testa della fossa a (-87, -509), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 163 | rampa? | Via Grado | 80 | 721 | 9×5 m, 49 m² | LiDAR 1,7 m | testa della fossa a (83, 721), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 164 | rampa? | Via Villafranca | 1691 | 473 | 8×6 m, 44 m² | LiDAR 1,9 m | testa della fossa a (1689, 471), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 165 | rampa? | Via Alessandro Manzoni | -914 | -1388 | 10×5 m, 43 m² | LiDAR 1,8 m | testa della fossa a (-910, -1389), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 166 | rampa? | Via Monte Grappa | 125 | -1403 | 9×4 m, 31 m² | LiDAR 2,3 m | testa della fossa a (127, -1400), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 167 | rampa? | Via Arno | 928 | 642 | 8×5 m, 43 m² | LiDAR 1,8 m | testa della fossa a (931, 641), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 168 | rampa? | Via Tiziano Vecellio | 983 | -530 | 8×5 m, 37 m² | LiDAR 2,0 m | testa della fossa a (982, -527), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 169 | rampa? | Via Prealpi | 810 | -942 | 7×6 m, 36 m² | LiDAR 2,1 m | testa della fossa a (811, -944), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 170 | rampa? | Via Dante Alighieri | -297 | -481 | 5×4 m, 20 m² | LiDAR 3,6 m | testa della fossa a (-298, -482), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,7 m sopra il LiDAR) |  |
| 171 | rampa? | Via Libertà | -1021 | -354 | 8×4 m, 31 m² | LiDAR 2,3 m | testa della fossa a (-1020, -351), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 172 | rampa? | Viale Brianza | 1126 | -1271 | 10×4 m, 38 m² | LiDAR 1,9 m | testa della fossa a (1122, -1272), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 173 | rampa? | Via Mestre | 387 | 783 | 8×5 m, 32 m² | LiDAR 2,2 m | testa della fossa a (386, 786), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 174 | rampa? | Via Adda | 1232 | 904 | 7×5 m, 30 m² | LiDAR 2,4 m | testa della fossa a (1230, 906), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: casa costruita sullo scavo, no |
| 175 | rampa? | Via Pescarenico | -612 | -1297 | 9×4 m, 34 m² | LiDAR 2,1 m | testa della fossa a (-614, -1299), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 176 | rampa? | Via Tevere | 961 | 873 | 8×4 m, 28 m² | LiDAR 2,5 m | testa della fossa a (964, 874), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 177 | rampa? | Via Antonio Meucci | 1750 | -191 | 8×6 m, 46 m² | LiDAR 1,5 m | testa della fossa a (1749, -194), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 178 | rampa? | Via Adda | 1139 | 855 | 7×5 m, 42 m² | LiDAR 1,7 m | testa della fossa a (1140, 858), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) | orto: dubbio |
| 179 | rampa? | Via Asiago | 1538 | -882 | 8×5 m, 36 m² | LiDAR 1,9 m | testa della fossa a (1535, -882), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 180 | rampa? | Via Adria | 1475 | 759 | 5×3 m, 19 m² | LiDAR 3,3 m | testa della fossa a (1476, 761), passo carraio non trovato (probabile) | fossa in parte spianata (S 0,6 m sopra il LiDAR) |  |
| 181 | rampa? | Via Piave | 855 | 326 | 6×6 m, 39 m² | LiDAR 1,7 m | testa della fossa a (855, 323), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 182 | rampa? | Via Vignazzola | 873 | 992 | 6×4 m, 22 m² | LiDAR 2,8 m | testa della fossa a (871, 994), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 183 | rampa? | Via fratelli Bandiera | 1018 | 195 | 8×6 m, 42 m² | LiDAR 1,5 m | testa della fossa a (1021, 197), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 184 | rampa? | Via Trieste | 1601 | -798 | 5×5 m, 28 m² | LiDAR 2,2 m | testa della fossa a (1602, -799), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 185 | rampa? | Via Francesco Petrarca | -172 | -622 | 7×6 m, 39 m² | LiDAR 1,6 m | testa della fossa a (-175, -622), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 186 | rampa? | Via Adda | 1154 | 797 | 6×6 m, 32 m² | LiDAR 1,9 m | testa della fossa a (1153, 799), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 187 | rampa? | Via del Cimitero | 396 | -89 | 7×5 m, 33 m² | LiDAR 1,9 m | testa della fossa a (393, -89), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 188 | rampa? | Via Abano | 239 | 746 | 6×4 m, 29 m² | LiDAR 2,1 m | testa della fossa a (239, 743), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 189 | rampa? | Via Belvedere | -317 | -1247 | 5×4 m, 20 m² | LiDAR 2,9 m | testa della fossa a (-317, -1249), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 190 | rampa? | Via Adria | 1365 | 689 | 8×3 m, 30 m² | LiDAR 2,0 m | testa della fossa a (1365, 686), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 191 | rampa? | Via Abano | 302 | 763 | 9×5 m, 37 m² | LiDAR 1,6 m | testa della fossa a (298, 762), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 192 | rampa? | Via Giovanni da Verazzano | -338 | -100 | 8×5 m, 36 m² | LiDAR 1,6 m | testa della fossa a (-335, -98), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 193 | rampa? | Largo Paolo Giorgetti | -478 | -128 | 6×3 m, 23 m² | LiDAR 2,5 m | testa della fossa a (-480, -128), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 194 | rampa? | Via Monte Berico | 1444 | -785 | 6×5 m, 29 m² | LiDAR 2,0 m | testa della fossa a (1446, -784), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 195 | rampa? | Via Fornaci | -49 | -1159 | 6×4 m, 28 m² | LiDAR 2,1 m | testa della fossa a (-51, -1159), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 196 | rampa? | Via Pietro Maroncelli | 1478 | 361 | 9×3 m, 21 m² | LiDAR 2,5 m | testa della fossa a (1481, 361), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 197 | rampa? | Via San Giorgio | 1196 | -971 | 9×3 m, 25 m² | LiDAR 2,2 m | testa della fossa a (1193, -971), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 198 | rampa? | Via Vignazzola | -540 | 605 | 5×4 m, 26 m² | LiDAR 2,2 m | testa della fossa a (-540, 606), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 199 | rampa? | Via Trieste | 960 | -1295 | 7×5 m, 30 m² | LiDAR 1,8 m | testa della fossa a (962, -1297), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 200 | rampa? | Via Alessandro Manzoni | -543 | -1211 | 5×3 m, 19 m² | LiDAR 2,8 m | testa della fossa a (-543, -1213), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 201 | rampa? | Via Seveso | -447 | -450 | 4×2 m, 15 m² | LiDAR 3,6 m | testa della fossa a (-447, -448), passo carraio non trovato (probabile) | fossa in parte spianata (S 0,6 m sopra il LiDAR) |  |
| 202 | rampa? | Via fratelli Bandiera | 1054 | 259 | 6×6 m, 36 m² | LiDAR 1,6 m | testa della fossa a (1053, 257), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 203 | rampa? | Via Walter Tobagi | -1034 | -440 | 6×5 m, 29 m² | LiDAR 1,9 m | testa della fossa a (-1035, -442), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 204 | rampa? | Via della Cavalla | 992 | 903 | 6×4 m, 24 m² | LiDAR 2,1 m | testa della fossa a (990, 906), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 205 | rampa? | Via Padova | 575 | 403 | 6×4 m, 31 m² | LiDAR 1,6 m | testa della fossa a (573, 402), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 206 | rampa? | Via Marco Polo | 428 | 186 | 6×4 m, 29 m² | LiDAR 1,7 m | testa della fossa a (430, 184), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 207 | rampa? | Via Marco Polo | 597 | -41 | 7×3 m, 23 m² | LiDAR 2,0 m | testa della fossa a (599, -39), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 208 | rampa? | Via Po | 1386 | 877 | 4×4 m, 17 m² | LiDAR 2,7 m | testa della fossa a (1388, 878), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 209 | rampa? | Via Molino | -489 | -998 | 5×3 m, 23 m² | LiDAR 2,0 m | testa della fossa a (-490, -1000), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 210 | rampa? |  | 279 | -196 | 7×3 m, 22 m² | LiDAR 2,0 m | testa della fossa a (280, -194), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 211 | rampa? | Strada provinciale ex SS 35 Milano-Meda | -659 | 84 | 5×3 m, 21 m² | LiDAR 2,2 m | testa della fossa a (-659, 82), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 212 | rampa? | Via Giosuè Carducci | -237 | -643 | 6×5 m, 28 m² | LiDAR 1,6 m | testa della fossa a (-240, -643), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 213 | rampa? | Via Antonio Rosmini | -781 | -1163 | 6×4 m, 28 m² | LiDAR 1,6 m | testa della fossa a (-781, -1165), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 214 | rampa? | Via Alessandro Manzoni | -457 | -1037 | 5×5 m, 26 m² | LiDAR 1,7 m | testa della fossa a (-455, -1038), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 215 | rampa? | Via Cavallina | -955 | -1549 | 7×4 m, 22 m² | LiDAR 1,8 m | testa della fossa a (-957, -1548), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 216 | rampa? | Via Milano | -480 | -475 | 6×4 m, 23 m² | LiDAR 1,8 m | testa della fossa a (-482, -477), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 217 | rampa? |  | -402 | -1686 | 4×4 m, 17 m² | LiDAR 2,3 m | testa della fossa a (-403, -1684), passo carraio non trovato (probabile) | fossa in parte spianata (S 1,5 m sopra il LiDAR) |  |
| 218 | rampa? | Via Santa Maria | -32 | -1476 | 6×3 m, 19 m² | LiDAR 2,0 m | testa della fossa a (-30, -1477), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 219 | rampa? | Via Armando Diaz | 535 | 238 | 6×4 m, 25 m² | LiDAR 1,5 m | testa della fossa a (537, 237), passo carraio non trovato (probabile) | spianato (S a piano strada) |  |
| 220 | rampa? |  | 778 | 731 | 4×4 m, 15 m² | LiDAR 2,4 m | testa della fossa a (780, 731), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 221 | rampa? | Via Mestre | 432 | 801 | 4×4 m, 19 m² | LiDAR 1,9 m | testa della fossa a (431, 800), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 222 | rampa? | Viale Brianza | 807 | -691 | 5×3 m, 19 m² | LiDAR 1,8 m | testa della fossa a (809, -691), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 223 | rampa? | Via Leonardo da Vinci | 667 | -467 | 5×3 m, 16 m² | LiDAR 1,6 m | testa della fossa a (665, -468), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 224 | rampa? | Via San Marco | 1418 | -871 | 5×3 m, 15 m² | LiDAR 1,6 m | testa della fossa a (1420, -871), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 225 | cortile ribassato o scavo? | Via Giorgio Perlasca | -1014 | -509 | 8015 m² | LiDAR 4,0 m | passo carraio (-1011, -536) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 226 | scavo 2008, poi edificio | Via Como | 653 | -1555 | 7×6 m, 35 m² | LiDAR 1,6 m | passo carraio (664, -1549) in testa alla rampa | fossa morbida (S = LiDAR) |  |
| 227 | cortile ribassato o scavo? |  | -162 | 105 | 322×159 m, 8648 m² | LiDAR 6,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 228 | cortile ribassato o scavo? | Via Solferino | 455 | -775 | 4653 m² | LiDAR 3,2 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 229 | scavo 2008, poi edificio | Via Trieste | 1666 | -1009 | 48×42 m, 1390 m² | LiDAR 7,2 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 230 | scavo 2008, poi edificio | Via Armando Diaz | 618 | 213 | 82×62 m, 1902 m² | LiDAR 4,3 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 231 | cortile ribassato o scavo? | Via Arno | 975 | 667 | 53×47 m, 2049 m² | LiDAR 2,5 m | non chiaro | fossa morbida (S = LiDAR) | orto: piazzale industriale |
| 232 | cortile ribassato o scavo? | Via Tommaso Edison | 1767 | 97 | 78×27 m, 1172 m² | LiDAR 4,2 m | non chiaro | fossa morbida (S = LiDAR) | orto: cortile industriale |
| 233 | cortile ribassato o scavo? | Via Felice Orsini | -207 | -343 | 49×36 m, 1407 m² | LiDAR 3,4 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 234 | cortile ribassato o scavo? |  | 829 | 454 | 875 m² | LiDAR 4,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 235 | cortile ribassato o scavo? | Via Padova | 578 | 477 | 51×40 m, 1284 m² | LiDAR 2,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 236 | cortile ribassato o scavo? | Viale Francia | 232 | -453 | 117×18 m, 1092 m² | LiDAR 2,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 237 | cortile ribassato o scavo? |  | 787 | -1040 | 137×58 m, 1602 m² | LiDAR 1,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 238 | cortile ribassato o scavo? | Via Resegone | -652 | -1144 | 1250 m² | LiDAR 2,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 239 | cortile ribassato o scavo? | Corso Alcide De Gasperi | 1517 | -6 | 47×21 m, 647 m² | LiDAR 2,5 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 240 | cortile ribassato o scavo? | Via Isonzo | 584 | -231 | 30×28 m, 566 m² | LiDAR 2,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 241 | cortile ribassato o scavo? | Via Grado | 77 | 674 | 36×21 m, 494 m² | LiDAR 3,2 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 242 | cortile ribassato o scavo? | Via Valsassina | -638 | -1427 | 94×10 m, 689 m² | LiDAR 1,9 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 243 | cortile ribassato o scavo? | Via Venti Settembre | 33 | -673 | 28×12 m, 195 m² | LiDAR 6,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 244 | cortile ribassato o scavo? | Via Vignazzola | -642 | 588 | 79×13 m, 667 m² | LiDAR 1,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 245 | cortile ribassato o scavo? | Via Ventiquattro Maggio | 1185 | 13 | 24×19 m, 344 m² | LiDAR 3,1 m | non chiaro | fossa morbida (S = LiDAR) | orto: sotto un edificio costruito dopo il 2008 |
| 246 | cortile ribassato o scavo? | Via Francesco Petrarca | -111 | -688 | 33×17 m, 313 m² | LiDAR 3,2 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 247 | cortile ribassato o scavo? | Via Vignazzola | -564 | 570 | 37×20 m, 334 m² | LiDAR 2,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 248 | cortile ribassato o scavo? | Via Luigi Rho | 1599 | -453 | 20×15 m, 232 m² | LiDAR 3,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 249 | cortile ribassato o scavo? | Viale delle Rimembranze | 679 | -374 | 25×17 m, 299 m² | LiDAR 2,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 250 | cortile ribassato o scavo? | Via San Giorgio | 1646 | -555 | 23×14 m, 275 m² | LiDAR 3,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 251 | cortile ribassato o scavo? | Viale delle Rimembranze | 630 | -291 | 37×15 m, 314 m² | LiDAR 2,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 252 | cortile ribassato o scavo? | Via Lombardia | 1009 | -315 | 30×16 m, 301 m² | LiDAR 2,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 253 | cortile ribassato o scavo? | Via Luigi Cadorna | -85 | -124 | 40×11 m, 338 m² | LiDAR 2,3 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 254 | cortile ribassato o scavo? | Via Giulio Campi | 911 | -373 | 26×15 m, 280 m² | LiDAR 2,8 m | non chiaro | fossa morbida (S = LiDAR) | orto: sotto un edificio costruito dopo il 2008 |
| 255 | cortile ribassato o scavo? | Via Francesco Petrarca | -89 | -658 | 19×12 m, 167 m² | LiDAR 4,5 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 256 | cortile ribassato o scavo? | Via Zara | 788 | -1143 | 34×16 m, 290 m² | LiDAR 2,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 257 | cortile ribassato o scavo? | Via Papa Giovanni Ventitreesimo | -379 | -853 | 35×19 m, 368 m² | LiDAR 2,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 258 | cortile ribassato o scavo? | Via Edmondo De Amicis | 286 | -595 | 284 m² | LiDAR 2,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 259 | cortile ribassato o scavo? | Via San Giorgio | 1054 | -941 | 39×13 m, 250 m² | LiDAR 2,9 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 260 | cortile ribassato o scavo? | Via Alessandro Manzoni | -595 | -1176 | 19×17 m, 275 m² | LiDAR 2,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 261 | cortile ribassato o scavo? | Via Armando Diaz | 585 | 259 | 22×15 m, 246 m² | LiDAR 2,8 m | non chiaro | fossa in parte spianata (S 0,8 m sopra il LiDAR) |  |
| 262 | cortile ribassato o scavo? | Via Farga | -354 | -189 | 26×15 m, 238 m² | LiDAR 2,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 263 | cortile ribassato o scavo? | Via Liguria | 1446 | -430 | 21×18 m, 292 m² | LiDAR 2,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 264 | cortile ribassato o scavo? | Via Padova | 582 | 366 | 21×12 m, 156 m² | LiDAR 3,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 265 | cortile ribassato o scavo? | Piazza della Chiesa | 133 | -397 | 22×13 m, 227 m² | LiDAR 2,5 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 266 | cortile ribassato o scavo? | Vicolo Comunale | 179 | -523 | 17×15 m, 199 m² | LiDAR 2,7 m | non chiaro | fossa in parte spianata (S 0,7 m sopra il LiDAR) |  |
| 267 | cortile ribassato o scavo? | Via Federico Borromeo | -626 | -1088 | 18×11 m, 136 m² | LiDAR 3,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 268 | cortile ribassato o scavo? | Via Grado | 92 | 519 | 19×19 m, 213 m² | LiDAR 2,4 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 269 | cortile ribassato o scavo? | Via Gaetano Donizetti | -129 | -328 | 21×10 m, 164 m² | LiDAR 3,0 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 270 | cortile ribassato o scavo? | Viale Brianza | 874 | -901 | 18×16 m, 240 m² | LiDAR 2,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 271 | cortile ribassato o scavo? | Corso della Resistenza | 414 | -464 | 17×14 m, 142 m² | LiDAR 3,1 m | non chiaro | fossa in parte spianata (S 1,3 m sopra il LiDAR) |  |
| 272 | cortile ribassato o scavo? | Via Monte Berico | 1535 | -755 | 30×9 m, 244 m² | LiDAR 1,8 m | non chiaro | fossa morbida (S = LiDAR) | orto: villette a schiera costruite dopo il 2008 |
| 273 | scavo 2008, poi edificio | Via Vignoni | -74 | -693 | 93 m² | LiDAR 4,9 m | testa della fossa a (-74, -682), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 274 | cortile ribassato o scavo? | Via Valtellina | 770 | -1528 | 21×14 m, 212 m² | LiDAR 2,0 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 275 | cortile ribassato o scavo? | Via Tevere | 1071 | 883 | 16×13 m, 161 m² | LiDAR 2,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 276 | cortile ribassato o scavo? | Via Monte Grappa | 137 | -1367 | 20×13 m, 186 m² | LiDAR 2,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 277 | cortile ribassato o scavo? | Via Indipendenza | 944 | -50 | 20×13 m, 204 m² | LiDAR 1,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 278 | cortile ribassato o scavo? | Via del Cimitero | 455 | -218 | 16×10 m, 118 m² | LiDAR 3,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 279 | cortile ribassato o scavo? | Via Piermarini | 1271 | -358 | 31×21 m, 237 m² | LiDAR 1,5 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 280 | cortile ribassato o scavo? | Via Tevere | 1212 | 820 | 23×9 m, 133 m² | LiDAR 2,4 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 281 | cortile ribassato o scavo? | Via Ventiquattro Maggio | 1216 | 22 | 12×10 m, 100 m² | LiDAR 3,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 282 | cortile ribassato o scavo? | Via delle Brughiere | 88 | -1556 | 18×10 m, 159 m² | LiDAR 2,0 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 283 | cortile ribassato o scavo? | Via del Dosso | 1127 | -595 | 15×9 m, 124 m² | LiDAR 2,5 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 284 | cortile ribassato o scavo? | Via Leonardo da Vinci | 1381 | 53 | 16×12 m, 133 m² | LiDAR 2,1 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 285 | cortile ribassato o scavo? | Via delle Cave | -938 | -621 | 14×11 m, 108 m² | LiDAR 2,5 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 286 | cortile ribassato o scavo? | Via delle Grigne | -753 | -1431 | 15×11 m, 116 m² | LiDAR 2,3 m | non chiaro | fossa morbida (S = LiDAR) | orto: case, dubbio |
| 287 | cortile ribassato o scavo? | Via Giovanni Pascoli | 1129 | -901 | 15×9 m, 100 m² | LiDAR 2,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 288 | cortile ribassato o scavo? | Via Conciliazione | -738 | -200 | 13×11 m, 115 m² | LiDAR 2,2 m | non chiaro | fossa morbida (S = LiDAR) | orto: villa con giardino, dubbio |
| 289 | cortile ribassato o scavo? | Via Tintoretto | 1060 | -431 | 16×9 m, 127 m² | LiDAR 2,0 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 290 | cortile ribassato o scavo? | Via Libertà | -955 | -304 | 15×10 m, 125 m² | LiDAR 2,0 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 291 | cortile ribassato o scavo? | Via Ticino | 986 | 727 | 17×10 m, 142 m² | LiDAR 1,7 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 292 | avvallamento in strada | Vicinale del Campaccio | 539 | -1341 | 10×9 m, 57 m² | LiDAR 3,9 m | testa della fossa a (536, -1345), passo carraio non trovato (probabile) | fossa morbida (S = LiDAR) |  |
| 293 | cortile ribassato o scavo? | Via Martesana | -559 | -99 | 12×9 m, 76 m² | LiDAR 2,9 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 294 | cortile ribassato o scavo? | Viale delle Rimembranze | 761 | -511 | 13×9 m, 70 m² | LiDAR 3,0 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 295 | cortile ribassato o scavo? | Via Fiume | 1115 | -1024 | 14×11 m, 126 m² | LiDAR 1,7 m | non chiaro | fossa morbida (S = LiDAR) | orto: in parte sotto un edificio |
| 296 | cortile ribassato o scavo? | Via Luigi Cadorna | 137 | -89 | 11×11 m, 103 m² | LiDAR 1,6 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 297 | cortile ribassato o scavo? | Via della Cavalla | 1011 | 891 | 9×9 m, 74 m² | LiDAR 1,8 m | non chiaro | fossa morbida (S = LiDAR) |  |
| 298 | avvallamento in strada | Via Trieste | 1748 | -924 | 19×4 m, 59 m² | LiDAR 1,8 m | testa della fossa a (1742, -928), passo carraio non trovato (probabile) | spianato (S a piano strada) |  |
