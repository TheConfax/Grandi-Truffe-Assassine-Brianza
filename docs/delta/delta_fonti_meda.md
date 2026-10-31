# Delta delle tre fonti su Meda (31/10/2026)

Prova fatta senza toccare il gioco: niente build, niente commit, i dati scaricati stanno in `data/delta/` (29 MB). "Meda" qui vuol dire il comune di Meda (801 ettari dentro il riquadro di gioco), preso dai suoi confini OSM. Le coordinate dei link sono quelle di gioco (x, z in metri dal centro `lat0 45.6575, lon0 9.154`, come fa `build_data.py`).

## In cima, una riga per fonte

| Fonte | Conviene su Meda? | Cosa cambierebbe in gioco | Costo stimato |
|---|---|---|---|
| **DUSAF 7.0** (uso del suolo 2021) | **Sì, solo per la campagna e i boschi** (non per l'abitato) | Su 397 ha di suolo non costruito a Meda, gioco e DUSAF non sono d'accordo su 106 ha (27%); 37 ha sono disaccordi veri, lontani dai bordi. Soprattutto prato che diventa campo (24 ha), "incolto" che diventa bosco (23 ha), 5,6 ha di cava. Sul campione di 20 punti ha ragione DUSAF 14 volte, il gioco 5, 1 incerto | Un agente Sonnet, circa 1,5-2 ore con build e prove; 9 MB di dati |
| **Particelle catastali** (Agenzia Entrate) | **No, per muri e recinzioni** (parziale solo come "dove andare a guardare") | Quasi niente: solo il 30% dei confini ha un muro o una recinzione nel gioco, ma nel campione nessun confine privo di barriera ne mostrava una vera sull'ortofoto. Il confine di proprietà non è un muro | Un agente Sonnet, circa 1 ora per un dato che non migliora; 19 MB |
| **Numeri civici ANNCSU** | **No per le porte** (parziale per i numeri) | A Meda l'archivio ha 7 902 numeri ma **nessuno ha le coordinate**: non può mettere nessuna porta. Servirebbe solo per avere il numero giusto sui negozi e sulle vie, senza posizione | Un agente Sonnet, circa 1 ora per i soli numeri; 1,2 MB filtrati |

Il verdetto sulle porte è semplice: le 1 000 porte che il gioco ha a Meda non dipendono dai civici e i civici che abbiamo (OSM) sono 821 e solo 210 stanno sulla facciata. Dettagli sotto.

## Come leggere questi numeri

Un conteggio dice dove due fonti differiscono, non chi ha ragione. Per questo, per ogni fonte, ho guardato 20 punti di disaccordo scelti a sorte sull'ortofoto Esri a 0,3 m che abbiamo (solo come riferimento, non entra nel gioco). Non sono sicuro di quanto sia recente quell'ortofoto: la data non l'ho verificata. Dall'alto si vedono bene campi, boschi, siepi e alberi, male i muri bassi e le recinzioni.

---

## 1. DUSAF 7.0

**Cos'è:** la Regione Lombardia disegna ogni pezzo di terra con una classe (seminativo, prato, bosco, parco, cantiere, cava...). Edizione 2021. Scaricato dal servizio `territorio/dusaf7` della Regione: 1 221 poligoni nel riquadro (più 150 m di margine) e 400 linee "filari e siepi", 9 MB.

**Licenza:** non verificata alla fonte. Il servizio non riporta licenza (campo vuoto) e il catalogo INSPIRE della Regione ha il certificato scaduto. Una fonte di seconda mano (plugin QGIS) dice CC BY 4.0; la ricerca web conferma solo che il geoportale offre quel filtro di licenza. **Non verificato.**

**Come ho confrontato:** ho costruito un raster a 2 m dei tipi di suolo che il gioco ha oggi (da `brianza.json`: aree `a`, `ls`, cortili, strade, edifici) e ho rasterizzato DUSAF sullo stesso reticolo. Ho confrontato solo dove il gioco non ha edificio, strada, marciapiede, cortile o piazza (397 ha su 801), perché DUSAF mette tutto l'abitato in poche classi "residenziale" e dei giardini non dice nulla.

### Tabella di confusione, ettari a Meda (righe: gioco; colonne: DUSAF)

| gioco \ DUSAF | urbano (case, industrie, servizi, strade, ferrovia) | cimitero | cava/discarica/degradata | cantiere | parchi/giardini | verde incolto | sport | seminativi | orti/frutteti | prati | bosco | cespuglieti | totale |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| nessun dato (terreno base) | 21 | - | - | - | 0 | - | - | 1 | - | - | 2 | - | 24 |
| prato/verde | 95 | 2 | - | - | 11 | 3 | 6 | 24 | 1 | 3 | 6 | 2 | 151 |
| sport | 1 | - | - | - | - | - | 5 | - | - | - | - | - | 6 |
| bosco | 5 | 1 | - | - | 7 | 1 | 1 | 4 | - | 0 | **86** | 2 | 107 |
| cespugli | 1 | - | 2 | - | - | - | - | 1 | - | - | 2 | - | 6 |
| campo/coltivo | 2 | 1 | - | - | - | - | - | **27** | - | 1 | 3 | - | 35 |
| incolto | 16 | 1 | 2 | 1 | 4 | 2 | - | 6 | - | - | **23** | 2 | 58 |
| cantiere | 5 | - | 1 | - | - | 1 | - | 1 | - | - | 0 | - | 8 |
| piazza, cortile, strada, marciapiede, edificio | 289 | 5 | 1 | - | 4 | 2 | 5 | 2 | - | - | 3 | 1 | 312 |
| **totale** | 524 | 7 | 7 | 2 | 27 | 10 | 16 | 66 | 1 | 5 | 128 | 6 | 800 |

(La tabella completa, 15 righe per 23 colonne, è in `dusaf_confusione_ha.csv`.)

### Quanti ettari cambierebbero aspetto, e in cosa

Su 397 ha di suolo non costruito, **106 ha (27%) cambierebbero classe**, ma tanti sono solo contorni spostati di qualche metro. Se si contano solo i punti a almeno 8 m dai bordi di entrambe le mappe, restano **37 ha di disaccordo vero**. I cambi più grandi:

| Da (gioco) → a (DUSAF) | ettari |
|---|---|
| prato/verde → seminativi (campi arati) | 23,8 |
| incolto → bosco | 23,0 |
| bosco → parchi e giardini | 6,6 |
| incolto → seminativi | 6,2 |
| prato → bosco | 5,8 |
| prato → impianti sportivi | 5,5 |
| incolto → parchi e giardini | 4,4 |
| bosco → seminativi | 3,6 |

- **Campi:** DUSAF ha circa 66 ha di seminativi liberi a Meda e il gioco ne riconosce 27 come campo. Il resto è prato o incolto: con DUSAF avrebbero i solchi.
- **Orti:** quasi niente a Meda dentro al suolo libero (1 ha): gli orti sono nei giardini, e lì DUSAF non scende.
- **Cantieri:** DUSAF ne ha 2,2 ha a Meda (più 0,6 di "aree degradate"), il gioco ne ha già 0,4 sotto. Non cambia molto. Due punti: x 1519 z -284 (il gioco ha già un cantiere) e x 1781 z -980.
- **Cave:** DUSAF ha una cava di 5,6 ha a x -1001 z -715. Il gioco lì ha cespugli, incolto e marciapiede. Sull'ortofoto è una vera cava con impianto e cumuli di sabbia (vedi punto 5 sotto). Il gioco non ha una classe "cava" a terra.
- **Il caso più interessante:** i 23 ha di "incolto → bosco". Sono le aree che il DBGT 2015 chiama `PS_INC` incolto (erba alta e arbusti) e che nel 2021 sono bosco: DUSAF qui è più recente del DBGT.

### Campione di 20 punti di disaccordo (scelti a sorte con seme fisso, solo dentro Meda, a almeno 8 m dai bordi)

Immagini: `dusaf_campione_1.png` e `dusaf_campione_2.png` (numerate da #1 a #20).

Risultato: **DUSAF 14, gioco 5, incerto 1.**

| # | punto | gioco | DUSAF | ha ragione | link |
|---|---|---|---|---|---|
| 1 | -683 -2500 | prato | seminativi | DUSAF (campo arato) | http://127.0.0.1:8080/?x=-683&z=-2500&piedi |
| 2 | -925 -862 | cespugli | seminativi | DUSAF (campo aperto) | http://127.0.0.1:8080/?x=-925&z=-862&piedi |
| 3 | 453 -2166 | incolto | bosco | DUSAF | http://127.0.0.1:8080/?x=453&z=-2166&piedi |
| 4 | -471 -1468 | prato | bosco | DUSAF | http://127.0.0.1:8080/?x=-471&z=-1468&piedi |
| 5 | -323 -2094 | incolto | seminativi | gioco (erba alta, non arata) | http://127.0.0.1:8080/?x=-323&z=-2094&piedi |
| 6 | -223 632 | incolto | seminativi | DUSAF (arato) | http://127.0.0.1:8080/?x=-223&z=632&piedi |
| 7 | -625 -2432 | prato | seminativi | DUSAF (arato) | http://127.0.0.1:8080/?x=-625&z=-2432&piedi |
| 8 | 427 -2100 | prato | seminativi | gioco (striscia d'erba) | http://127.0.0.1:8080/?x=427&z=-2100&piedi |
| 9 | 465 -2166 | incolto | bosco | DUSAF | http://127.0.0.1:8080/?x=465&z=-2166&piedi |
| 10 | -905 -192 | terreno base | bosco | DUSAF | http://127.0.0.1:8080/?x=-905&z=-192&piedi |
| 11 | 161 -1900 | prato | seminativi | incerto (campo verdastro) | http://127.0.0.1:8080/?x=161&z=-1900&piedi |
| 12 | 1653 922 | cantiere | seminativi | DUSAF (il punto è un campo; il cantiere vero è accanto) | http://127.0.0.1:8080/?x=1653&z=922&piedi |
| 13 | 439 -2098 | prato | seminativi | gioco (prato) | http://127.0.0.1:8080/?x=439&z=-2098&piedi |
| 14 | -377 -2078 | incolto | seminativi | gioco (erba alta umida) | http://127.0.0.1:8080/?x=-377&z=-2078&piedi |
| 15 | -703 -2450 | prato | seminativi | DUSAF (arato) | http://127.0.0.1:8080/?x=-703&z=-2450&piedi |
| 16 | -197 536 | bosco | parchi e giardini | gioco (è alberato fitto) | http://127.0.0.1:8080/?x=-197&z=536&piedi |
| 17 | -155 -2356 | prato | seminativi | DUSAF (solchi) | http://127.0.0.1:8080/?x=-155&z=-2356&piedi |
| 18 | -177 -2104 | incolto | bosco | DUSAF | http://127.0.0.1:8080/?x=-177&z=-2104&piedi |
| 19 | -717 -1900 | incolto | bosco | DUSAF | http://127.0.0.1:8080/?x=-717&z=-1900&piedi |
| 20 | -893 -190 | terreno base | bosco | DUSAF | http://127.0.0.1:8080/?x=-893&z=-190&piedi |

Attenzione: il campione viene dai disaccordi lontani dai bordi, quindi è favorevole a trovare differenze vere. Non dice che DUSAF abbia ragione ovunque: nell'abitato DUSAF non ha ragione né torto, non dice nulla sui giardini.

### 5 punti dove la differenza si vede di più (foto in `top5_dusaf.png`)

1. x -141 z -2236, 2,3 ha: il gioco ha prato, DUSAF seminativo; sull'ortofoto è un campo arato. http://127.0.0.1:8080/?x=-141&z=-2236&piedi
2. x 385 z -1868, 1,9 ha: il gioco ha incolto, DUSAF bosco; è un bosco fitto. http://127.0.0.1:8080/?x=385&z=-1868&piedi
3. x -143 z 366, 1,2 ha: il gioco ha bosco, DUSAF "parchi e giardini"; accanto alla superstrada è alberato: qui ha ragione il gioco. http://127.0.0.1:8080/?x=-143&z=366&piedi
4. x 1543 z 832: il gioco ha prato, DUSAF seminativo; campo arato con bordo di siepe. http://127.0.0.1:8080/?x=1543&z=832&piedi
5. x -1001 z -715, la cava di 5,6 ha: il gioco ha cespugli e incolto. http://127.0.0.1:8080/?x=-1001&z=-715&piedi

### Lo strato "Filari e siepi": è davvero un'aggiunta?

- Nel riquadro sono 400 linee (il "359" del censimento era il conteggio di tutto il servizio sul riquadro, con un'altra misura). **Dentro Meda sono 92 elementi, 10,8 km.**
- Il DBGT di Meda ha 176 elementi `FIL_AL` (5,7 km; 172 filari di alberi e 4 siepi) e **zero** elementi `EL_DIV` di tipo 19 (la tabella ha solo i tipi 02, 13, 17, 18, 95).
- I filari DUSAF entro 10 m da una linea DBGT sono solo il 15% della lunghezza. Ma il gioco ha anche gli alberi uno a uno (DBGT `ALBERO`, OSM, WorldCover): **entro 6 m da un albero del gioco cade il 56% dei filari DUSAF** (per caso, spostando le linee di 60 m, sarebbe il 20%), entro 10 m il 73% (per caso 37%).
- Solo **11 elementi, 1,3 km su 10,8**, non hanno alberi del gioco entro 10 m.
- Ho guardato 8 elementi a sorte non coperti entro 4 m (`filari_campione.png`): sono filari e siepi veri (tranne uno lungo la ferrovia), ma le linee DUSAF sono spostate di 5-10 m rispetto agli alberi veri. Quindi lo strato dice la stessa cosa che il gioco ha già, con meno precisione di posizione. **È un'aggiunta piccola, non una lacuna del DBGT.** Non ho fatto il campione di 20 su questo strato.

**Mappa:** `mappa_dusaf.png` (gioco oggi, DUSAF, disaccordi con i punti del campione numerati).

---

## 2. Particelle catastali (Agenzia delle Entrate)

**Cos'è:** il servizio WFS INSPIRE dell'Agenzia scarica le particelle (i lotti di proprietà) in formato GML. Scaricato per il riquadro più 150 m di margine: **36 441 particelle** (9 061 a Meda), 19 MB.

**Licenza:** il servizio riporta `Fees: CC BY 4.0` (letto sul `GetCapabilities` del servizio, 31/10/2026). Può entrare nel gioco con attribuzione all'Agenzia delle Entrate. Il campo "vincoli di accesso" dice solo "altri vincoli": non ho trovato quali.

**Cose che non vanno date per scontate:**
- Il primo scarico era incompleto (30 734 particelle) perché la paginazione del servizio salta pezzi. Ho rifatto lo scarico a riquadri senza paginazione: 36 441. In 16 riquadri su 100 il servizio risponde vuoto anche dopo 5 tentativi. Dentro Meda le particelle coprono 751 ha su 801; restano alcune chiazze senza particelle (grigie nella mappa), per esempio attorno a x 300 z -1000.
- La misura sotto usa 596 km di confini dentro Meda (i lati in comune fra due particelle contati una volta), a più di 3 m dal confine comunale.

### Numeri (barriere = `ba` + `fe` di `brianza.json`, cioè DBGT `EL_DIV` + OSM già uniti come li usa il gioco)

| | entro 1 m | entro 2 m | entro 3 m |
|---|---|---|---|
| Confini catastali con una barriera | 21% | **30%** | 36% |
| Confini senza barriera, km | 471 | **417** | 381 |
| Barriere senza confine catastale, km (su 203 km) | 93 | **65** | 52 |

- Solo DBGT `EL_DIV` (225 km): 23% entro 1 m, 32% entro 2 m. Solo OSM (29 km): 3-5%, ma di quelle barriere il 79% sta su un confine entro 2 m.
- Un quarto dei confini (27%) corre lungo un edificio (entro 1,5 m dal profilo): lì un muro non c'è perché c'è la parete. Togliendoli, restano 433 km di confine libero; di questi il gioco ne copre il 25% (1 m) o il 35% (2 m).
- Il catasto non è spostato rispetto al gioco: la sovrapposizione è massima con spostamento zero, e scende a 19% con 1 m di spostamento. I due dati sono ben registrati fra loro.

### Corregge o aggiunge?

**Né l'uno né l'altro, su Meda.** Un confine di proprietà non è un muro. Il 70% dei confini non ha barriera nel gioco e, nel campione, non mi risulta che ci sia: quella parte di confine passa in mezzo a prati, boschi, giardini aperti e parcheggi. Sono 20 punti guardati sull'ortofoto, in due gruppi di 10 (`catasto_campione_A.png`, `catasto_campione_B.png`; le righe 2 e 4 delle immagini hanno sopra il confine in azzurro e le barriere del gioco in rosso):

**A) confine catastale senza barriera nel gioco (e non lungo edifici): c'era un muro o una recinzione che al gioco manca?**
- Nessuno su 10 mostra un muro o una recinzione visibile che il gioco non ha. 6 sono bosco, campo o strada senza niente, 4 sono giardini dove l'ortofoto non permette di decidere.
- Ragione: **gioco 6, catasto 0, incerto 4.**

**B) barriera del gioco senza confine catastale entro 2 m: c'è davvero?**
- 2 sono muri o recinzioni plausibili (muro curvo a un giardino, recinto di una piscina), 1 è una barriera in mezzo al bosco senza niente sotto, 7 non si decidono.
- Ragione: **gioco 2, catasto 1, incerto 7.**

Totale 20 punti: **gioco 8, catasto 1, incerto 11.** L'ortofoto non vede bene i muri bassi, quindi "incerto" è alto. Il segnale non è a favore del catasto.

Punti A (confine senza barriera): A1 http://127.0.0.1:8080/?x=190&z=-1367&piedi, A2 .../?x=-402&z=-2241, A3 .../?x=279&z=-1548, A4 .../?x=117&z=-1495, A5 .../?x=996&z=-1308, A6 .../?x=491&z=-1787, A7 .../?x=-922&z=-392, A8 .../?x=2014&z=-583, A9 .../?x=-644&z=-1921, A10 .../?x=-85&z=-1327. Punti B (barriera senza confine): B1 .../?x=235&z=-868, B2 .../?x=483&z=-1866, B3 .../?x=440&z=-486, B4 .../?x=804&z=-1064, B5 .../?x=55&z=-768, B6 .../?x=86&z=-1387, B7 .../?x=430&z=-1182, B8 .../?x=1256&z=-307, B9 .../?x=929&z=554, B10 .../?x=228&z=-1156. (Completare ogni indirizzo con `http://127.0.0.1:8080/?x=<x>&z=<z>&piedi`.)

### 5 punti dove la differenza si vede di più

1. B2, bosco senza niente ma con una barriera del gioco: http://127.0.0.1:8080/?x=483&z=-1866&piedi
2. B4, muro curvo di giardino con la barriera del gioco e senza confine: http://127.0.0.1:8080/?x=804&z=-1064&piedi
3. A7, capannone con villette e muretti dove il confine catastale segue lotti che il gioco non ha: http://127.0.0.1:8080/?x=-922&z=-392&piedi
4. A5, strada con confini di campi accanto: http://127.0.0.1:8080/?x=996&z=-1308&piedi
5. A10, villette nel verde con lotti ben marcati: http://127.0.0.1:8080/?x=-85&z=-1327&piedi

### Il DBGT di Meda è del 2015: cosa aggiunge il catasto su Meda, e cosa aspettarsi altrove?

- **Su Meda:** il DBGT di Meda ha 16 615 divisori su 16 728 datati 2015. Il catasto è semestrale, ma i suoi dati non dicono se un muro c'è: dicono dove sta il lotto. I lotti nuovi dopo il 2015 non si riconoscono dal WFS (nessuna data nella risposta). Non ho trovato nulla che il catasto aggiunga ai muri di Meda.
- **Dove il DBGT è vecchio (Seregno 2007, Cesano 2005, Bovisio 2005):** non l'ho misurato, perché per quei comuni non ho il DBGT estratto in forma leggibile dal confronto; il gioco lì usa solo OSM, che ha 29 km di barriere in tutto il riquadro. Mi aspetto la stessa cosa: il catasto darebbe i lotti, non i muri. Come "ipotesi" potrebbe servire a decidere dove cercare una siepe, ma non a disegnarla.
- Una possibilità che non ho provato: usare i lotti per tagliare i giardini e dare un "dentro/fuori" alle proprietà. Non è nel compito.

**Mappa:** `mappa_catasto.png` (barriere del gioco, confini catastali, confronto a colori, con le chiazze senza particelle in grigio).

---

## 3. Numeri civici ANNCSU, per le porte

**Dove sono le porte di oggi:** in `brianza.json`, chiave `doors` (`build_data.py`, riga 1301: sono le "porte piccole 'p'" che il gioco mette in un varco lungo una facciata di una casa quando la fessura fra due chiusure cade su un edificio). Il disegno è in `src/world3.js` (`buildDoors`). Sono **2 042 in tutto il gioco, 1 000 dentro Meda** (il censimento dice 1 806: il conteggio del file è più alto). Le porte non dipendono dai civici.

**Licenza:** l'indirizzario ANNCSU compare sul catalogo dati.gov.it come "Stradari ed indirizzari regionali e nazionali da ANNCSU", licenza **CC BY 4.0** (letto sul catalogo, 31/10/2026). La pagina dell'ANNCSU non scrive la licenza: verificato sul catalogo nazionale, non sul sito dell'ANNCSU. Il file della Lombardia è di 37 MB (data 15/09/2026); l'ho filtrato e ho tenuto 1,2 MB.

**Il fatto principale:** **a Meda l'ANNCSU non ha nessuna coordinata.** 7 902 righe, tutte con `COORD_X` e `COORD_Y` vuote (1 380 sono accessi "senza numero civico"). Il censimento dava Meda "da verificare": ecco la verifica. Nei comuni intorno le coordinate ci sono: 7 137 civici nel riquadro (soprattutto Barlassina, Cabiate e Cesano Maderno).

### Civici ANNCSU contro OSM, solo a Meda

| | numero |
|---|---|
| Civici OSM dentro il comune di Meda | 821 (684 punti, 137 solo sull'area dell'edificio). I 6 432 del censimento sono tutto il riquadro, non Meda |
| Numeri ANNCSU di Meda (via e numero distinti) | 6 495 (7 902 righe) |
| Via e numero presenti in tutti e due | 543 |
| Solo in ANNCSU | 5 952 (3 690 sulle vie che hanno lo stesso nome in OSM; il resto su 132 vie che in OSM mancano o hanno un altro nome) |
| Solo in OSM | 157 (numeri come "2325" o "2931" che sono intervalli, vie con nomi scritti in altro modo) |

Quindi **ANNCSU ha 8 volte i numeri di OSM a Meda**, ma senza dove stanno. OSM ha circa l'11% dei numeri ANNCSU (700 su 6 495). L'abbinamento si fa sul testo (via e numero normalizzati: in alcuni casi sbaglia per come sono scritti i nomi, per esempio "Papa Giovanni XXIII").

### Le porte di oggi contro i civici OSM (1 000 porte a Meda, 821 civici)

- Distanza dal civico OSM più vicino: **mediana 29 m**; entro 3 m solo 61 porte (6%), entro 8 m 190 (19%).
- Stesso edificio: 245 porte (25%). Stessa facciata: 57 (6%).
- Edifici di Meda con un civico OSM: 564. **414 di questi (73%) non hanno nessuna porta nel gioco.**
- Edifici con una porta nel gioco: 715. **565 non hanno un civico OSM (79%).**
- Un edificio con civico e senza porta non è un difetto: il gioco mette porte solo dove trova un varco.

### Quanti numeri hanno davvero una posizione sul portone?

- OSM, 684 punti: **210 (31%) stanno sulla facciata o a 1,5 m dal profilo dell'edificio**; 346 stanno dentro l'edificio, lontano dal bordo (sono "il numero dell'edificio" messo al centro); 12 fuori da ogni edificio. Più 137 numeri senza punto (solo l'area). Sul totale di 821: **circa un quarto ha una posizione di portone**. Entrate OSM esplicite (`entrance=*`) a Meda: 26.
- ANNCSU, dove ha coordinate (comuni vicini, 7 137 civici): il 82% ha `METODO` 4 ("derivazione indiretta, accuratezza stimabile 5 m o peggio", secondo le specifiche tecniche ISTAT 2024), il 16% metodo 1 ("rilievo sul campo, accuratezza sotto 5 m"). Posizioni: 44% a più di 3 m da ogni edificio, 41% fuori ma a meno di 3 m, 7% dentro lontano dal bordo, 9% sul bordo. Per 180 numeri che trovo anche in OSM, la distanza mediana fra le due posizioni è 19 m. **Anche dove le coordinate ci sono, non sono sul portone.**

### Verdetto

L'ANNCSU non può mettere nessuna porta a Meda (nessuna coordinata) e, nei comuni dove le ha, le tiene per lo più sulla strada o a metà lotto. Per OSM, i 210 civici su facciata potrebbero guidare al massimo un paio di centinaia di porte. Il valore dell'ANNCSU a Meda è l'elenco dei numeri e delle vie (nomi ufficiali), non la posizione; per far comparire un numero civico su un edificio servirebbe una stima: interpolare lungo la via (pari/dispari) e agganciare all'edificio più vicino, con errori di decine di metri. Non l'ho provata.

**Non verificabile dall'ortofoto:** se il gioco ha la porta nel posto giusto o se un civico sta sul portone vero: un'ortofoto dall'alto non mostra le porte. Per questa fonte non ho fatto il campione di 20; servirebbero foto Mapillary a livello strada.

**Mappa:** `mappa_civici.png` (porte e civici OSM a Meda; ANNCSU con e senza coordinate; zoom su un isolato).

---

## Cosa non ho potuto verificare

- La licenza di DUSAF alla fonte (nessun documento letto).
- La licenza dell'ANNCSU sul sito dell'ANNCSU (ho solo il catalogo dati.gov.it).
- La data dell'ortofoto Esri usata come riferimento.
- Il catasto sui comuni col DBGT vecchio (non li ho confrontati); il significato di "altri vincoli" nel servizio dell'Agenzia.
- Se i 16 riquadri vuoti del WFS sono davvero senza particelle o un limite del servizio.
- Le porte e i civici sul terreno (nessuna foto di strada guardata).
- Il campione di 20 per lo strato "filari" e per le porte.

## File

Tutti in `C:/Users/theco/AppData/Local/Temp/claude/c--Users-theco-GitHub-GTA-Brianza/cc8d44cd-967d-4ab3-b1c9-455fe7d910b6/scratchpad/delta/`: i tre PNG delle mappe (`mappa_dusaf.png`, `mappa_catasto.png`, `mappa_civici.png`), le foto del campione (`dusaf_campione_1.png`, `dusaf_campione_2.png`, `top5_dusaf.png`, `filari_campione.png`, `catasto_campione_A.png`, `catasto_campione_B.png`), la tabella `dusaf_confusione_ha.csv`, `catasto_stats.json` e gli script Python. I dati scaricati sono in `data/delta/dusaf`, `data/delta/catasto`, `data/delta/civici`.
