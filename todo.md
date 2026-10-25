# Da fare

## Scaletta (ottobre 2026)
Regola per tutto: niente stili, scritte o dettagli inventati. Quello che non viene da OSM, da foto recenti o da chi gioca resta neutro.
1. **Storia**: una traccia di una pagina (Carlo). Dice quali luoghi vanno curati per primi
2. **Zona di gioco**: verificare che dati OSM e quote coprano Seregno, allargare la mappa a est, disegnare un confine lungo strade e ferrovie (non il rettangolo), uscite chiuse con transenne, fuori solo il paesaggio
3. **Pulizia** dentro il confine definitivo, una zona alla volta: quote e rampe, edifici fantasma, incroci, marciapiedi, sponde del Seveso
   - [ ] Muri e recinzioni: spesso sbagliati (Carlo, 20/10). È anche il passo più lento della build (`barriers`, circa 300 s su 450): rifarlo per correttezza e velocità insieme
4. **Varietà**:
   - [ ] Orari dei negozi: quelli mappati (`opening_hours`, 185) usano i loro; gli altri prendono quelli del vicino più simile che li ha, spostati a caso di scatti da 15 minuti. Chiuso: serranda giù, insegna e vetrina spente
   - [ ] Cancelli dedotti: dove un passo carraio (`service=driveway`) attraversa una recinzione, e davanti ai vialetti delle villette
   - [ ] Fabbriche e mobilifici, campi sportivi per sport, oratori, asili, edicole votive (sezione qui sotto)
   - [ ] Classi di edifici (villette, condomini, capannoni, cascine) solo con i dati OSM (`building:colour`, `roof:shape`, `building:levels`) o con foto

## Motore nuovo (ramo `motore`, deciso il 23/10; aggiornato il 24/10)
Il mondo intero dal DBGT: forma e quota di tutto ciò che si vede (terreno, strade, marciapiedi, ferrovia, acqua, verde, alberi, edifici, manufatti) dal DBGT sul LiDAR; OSM solo per cos'è una cosa (nomi, sensi, negozi) e per ciò che il DBGT non ha. Piano in `docs/motore.md` (sezioni 1-6 il terreno, sezione 7 il disegno), fonti in `docs/fonti.md` e `docs/dati.md`, punti di Carlo in `docs/collaudo.md`. Meda è la sandbox: si lavora lì finché Carlo non l'ha vista e commentata. Solo in locale (http://localhost:8013/), niente `main` senza il suo sì. Stato dei lavori in corso: http://127.0.0.1:8020/.
- [x] Fasi 1-6 su Meda (quote DBGT, terreno unico S, impalcati, acqua, `altezze3.js`, superfici ritagliate, fisica), verificate il 24/10; rifinitura del fiume
- [ ] Sezione 7, in corso dal 24/10: strade e marciapiedi (assi `EL_STR`, `AC_VEI`, `AC_PED`, cortili); ferrovia sugli assi `EL_FER` e confini dal DBGT, insieme alle strade; verde e alberi; manufatti, aree attrezzate, parcheggi, acqua ferma, altezza degli alberi dal DSM; poi edifici (`EDIFC`, `UN_VOL`, tetti dal DSM) con tutti i pezzi fatti a mano spenti e messi in `src/_vecchi/`; poi il collaudo degli agenti
- [ ] Giro di Carlo su Meda dopo il collaudo, e un giro di correzioni dai suoi commenti
- [ ] Da controllare nel collaudo: le strade sui ponti si disegnano sull'impalcato, non anche sul terreno sotto
- [ ] Dopo il giro di Carlo: avvio veloce (i 202 `.bin` di `terreno/` in un file solo); fase 7, il livello lontano oltre 760 m
- [ ] Prima di estendere la mappa: codice generico per comune (oggi `superficie.py`, `impalcati.py`, `dbgt_quote.py`, `build.py` hanno `comune='Meda'`), build su tutti i core (con le strade nuove dura 25 minuti per la sola Meda), rapporto `docs/portabilita.md` sulle differenze fra i DBGT dei comuni
- [ ] Fase 8, la mappa estesa ai comuni interi: DBGT di Seveso, Lentate, Barlassina, Cabiate, Mariano, Cesano, Seregno (scaricati ed estratti in `data/dbt/<Comune>/estratto/`), le 33 tessere LiDAR mancanti; chiude il gradino della Milano-Meda sul confine con Seveso (punto 22) e i dossi dei cavalcavia nel margine fuori da Meda
- [ ] Idee di Carlo del 24/10, da vedere bene dopo il suo giro: panchine abbattibili (come lampioni e cartelli); recinzioni sfondabili, cioè filo spinato, reti e staccionate (tipi DBGT 04, 13, 18; da decidere per il tipo 95 "altro"), mai muri e muretti; le siepi si sfondano, ma come gelatina: l'auto le buca solo sopra una certa velocità (Carlo, 25/10; tutto il discorso delle barriere abbattibili merita un approfondimento prima di partire, dopo i muri); silos, serbatoi, cabine e serre modellati bene (oggi volumi semplici)
- [ ] Per il 26/10, dopo l'esito dei muri: **barriere doppie dei cantieri**. Il gioco delimita i cantieri con la sua recinzione da cantiere, ma dove la mappa (DBGT/OSM) ha già un muro o una recinzione sul bordo del cantiere vengono due barriere una accanto all'altra. Ne deve restare una sola, quella da cantiere (Carlo, 25/10)
- [ ] Per il 26/10: **alberi troppo magri** (Carlo, 25/10). Altezza mediana 11,7 m, chioma 5,1 m: chioma/altezza 0,44, mentre una latifoglia isolata è larga circa 0,6-0,8 volte l'altezza. Causa probabile in `dbgt_manufatti.py` (alberi dal DSM): il raggio della chioma si misura fin dove DSM − DTM scende sotto metà dell'altezza (il bordo vero della chioma sta più in basso) e la chioma è tagliata a 1,3 volte la distanza dall'albero più vicino (in filari e boschi le chiome si toccano e si sovrappongono). Da rivedere confrontando qualche chioma con l'ortofoto
- [ ] **Stato al 25/10 notte:** su `motore` ci sono strade, verde, ferrovia, manufatti ed edifici di Meda dal DBGT, tutti verificati e uniti. Manca il collaudo degli agenti: è morto a metà per un riavvio della sessione (registro in `subagents/workflows/wf_e03e1747-845`, agente `collaudo`), ha lasciato due modifiche non committate in `src/altezze3.js` e `src/superficie.py`. Da rilanciare col riassunto di quello che aveva già fatto (scelta B di Carlo), poi il secondo giro di Carlo. **Fatto il 25/10:** collaudo ripreso e chiuso (esiti in `docs/collaudo.md`, nota in `docs/motore.md` sezione 7): tenuta la correzione di `altezze3.js` (H.check), tolta quella di `superficie.py` (i cortili cambiati non correggevano il passo carraio di via Mazzini). Resta da decidere quale rilievo vince sulle aree cambiate fra LiDAR 2008 e DBGT 2015
- [ ] Dopo il collaudo e il giro di Carlo, i difetti trovati da lui il 25/10: (1) **muri spariti** sul bordo delle carreggiate (lungo la ferrovia in viale Francia, via Pace, via Trento: 43 punti su 45 senza barriera fra strada e binari; via Santa Maria nord x −128 z −1768; probabilmente tutti i muri di cinta verso strada): il margine di 0,3 m di `STR.carreggiate`/`FER.fuori_dalle_carreggiate` e i cortili 0307 contati come carreggiata li tolgono. Regola di Carlo: un muro non sparisce MAI, se cade in carreggiata si sposta sul confine fra le due zone; (2) **righe ubriache** dello svincolo della Milano-Meda (x 62-106, z 365→60): `lf` per nodo non lisciato, larghezze di due carreggiate date a una, pieghe fino a 54° dall'aggancio agli assi; (3) **incolti** (PS_INC 04, 69 ha) disegnati come prato: pronto e non provato sul ramo locale `motore-incolti` (erba secca e chiazze di terra composte dalle foto)
- [ ] Dopo i muri: **cancelli dei passi carrai sul bordo della carreggiata** (4 segnalazioni di Carlo del 24/10 in via Bernardino Luini, forse anche via Cialdini). Per Carlo la recinzione accanto c'era e se l'è mangiata la stessa regola delle carreggiate: da verificare quando i muri sono sistemati. Dove un passo carraio non ha davvero recinzione, niente cancello ma solo il marciapiede abbassato
- [ ] Allo stesso livello, dopo tutto il resto: **verifica delle strutture strane**. Porte e reti dei campi sportivi molto buggate su tutta la mappa (a Ceredo, x 1935 z −37, la porta sta sul lato lungo e la traversa sporge sul vialetto; rete nera quando OSM segna più sport sullo stesso campo), campi da calcio, silos, serbatoi, cabine, serre
- [ ] Prossimo passo del motore: **il sotto terra** (Carlo: "una vera falla"). Rampe e ingressi dei parcheggi sotterranei come fosse dai dati (65 gruppi di volumi DBGT interrati UN_VOL_POR 08, OSM parking=underground e tunnel, buche nel LiDAR; esempi via Gagarin x 538 z −497, via Mazzini x 130 z −435), poi parcheggi interni percorribili
  - Censimento e proposta in due tappe in `docs/sottoterra.md` (25/10): 379 casi (60 autorimesse interrate, 225 rampe probabili solo dal LiDAR, 68 cortili ribassati o scavi, 9 sottopassi), il punto su Gagarin e Mazzini (a Mazzini il gioco disegna lo scavo del cantiere del 2008), quattro scelte per Carlo
- [x] Salti (25/10, ramo `salti`): l'auto si stacca sulle creste prese forte, vola con la gravità e atterra sulle molle, anche sopra gli impalcati; sotto 61 km/h e sul suolo più ripido del 20 % (le gobbe di `S`) resta attaccata come prima. Tolta la guida realistica, resta solo l'arcade. Dettagli e misure in `docs/motore.md` sezione 8. Da fare col sotto terra: le vie che in `S` scavalcano il rilevato della Milano-Meda invece di passarci sotto (x −767 z 97, via Farga x −977 z 61, x 79 z 236) e l'avvallamento della Milano-Meda a x −756 z 98
- [ ] Idee: punto di partenza "casa sicura" a x 44, z −450 (solo un'idea)
- [ ] Fase 9, pulizia del motore vecchio
- [ ] Aperti, per dopo: luci notturne di auto e lampioni tagliate dal terreno sui dossi; prestazioni delle tile (più lente col motore nuovo, 27 000 alberi a Meda); marca della concessionaria da OSM o Overture (punto 17); il Billy's che non si vede (punto 26)
- [ ] Edifici fotorealistici in serie, dopo: tipi brianzoli fatti con parametri, attributi di ogni edificio dalle foto di Mapillary, colori dei tetti dall'ortofoto, i pezzi forti rifatti a mano dagli screenshot di Carlo (idee del 24/10)

## Priorità: parcheggi veri da OSM
Prima di tutto il resto: vedi la sezione **Parcheggi** in fondo. I dati sono già in `data/osm/maplarge.osm`, non serve aspettare Overpass.

## Quote delle strade: da sistemare (analisi del 23/10 su `brianza.json`)
Le quote vere del DBGT ci sono solo a Meda; altrove i ponti sono stimati (+6,6 m) e la quota scivola sulle rampe e sulle rotonde vicine.
- [ ] Rotonde rialzate vicino ai ponti stimati, dove la strada sotto in realtà è in trincea: due allo svincolo della Milano-Meda di Baruccana (fino a 5,1 e 4,2 m, x 489 z 2064 e x 307 z 2004), Viale delle Nazioni Unite a Ceredo (3,6 m, x 2676 z 641), Meredo (1,3 m, x 1312 z 681). Serve il DBGT di Seveso e Seregno, oppure una regola: una rotonda non prende la quota del ponte
- [x] Impalcati finti a Meda (Manzoni/Rosmini/Cattaneo fino a 11,3 m, Monte Cervino, Carso, Borromeo, Molino, piazza Dozio) e trincee finte fino a 10 m (Via Como, Varese, Luigi Rho): era TINITALY, fino a 7 m sopra il terreno vero in centro. Dal 23/10 il terreno viene dal DTM LiDAR del Ministero (1 m, `data/terreno/lidar/`, vedi `docs/dati.md`): sulle strade coincide col DBGT entro 0,1 m. Controllato col LiDAR: impalcati senza niente sotto 0 (erano 239 nodi), trincee da 996 nodi a 35, fondo massimo 2,5 m (sottopasso di Via Milano, Via Busnelli); lo svincolo della Milano-Meda è nel terreno stesso, sponde di 6 m come nel LiDAR
- [ ] Svincolo di Meda da guardare in gioco: carreggiate sul fondo, scarpate, rampe sopra. Restano una ventina di tagli da 1,2-2,2 m che il LiDAR non conferma (Carlo Agrati, Colombara, Vicolo di Santa Maria): piccoli, ma si possono togliere
- [ ] Comuni interi (Meda, Seveso, Barlassina, Lentate, Cabiate, Seregno, Cesano Maderno, Mariano Comense) con un margine che si vede ma dove non si entra: col LiDAR servono 144 tessere con 500 m di margine (circa 580 MB), 177 con 1 km. Si scaricano dall'app del Ministero senza login, disegnando l'area: vedi `docs/dati.md`

## Fotorealismo (entrato in `main` il 23/10)
Grafica realistica, provata sul ramo `fotorealismo` e poi unita a `main`.
Fatto (primo giro, piaciuto a Carlo):
- [x] Texture fotografiche per asfalto, prato, terreno, marciapiedi e porfido (`tex/*.jpg`, Poly Haven CC0, ricolorate sul colore medio delle texture disegnate di prima), applicate da `src/foto3.js`
- [x] Luce in spazio lineare con curva filmica ACES (`src/foto3_colori.js` converte i colori esadecimali; `src/foto3.js` alza la luce nelle ombre e ingrigisce la foschia di giorno). Controllato anche di notte
- [x] Alberi veri (secondo giro): chioma di 14 ciuffi di foglie (due carte incrociate ciascuno) intorno a un nucleo pieno, tronco con tre rami che salgono dentro la chioma, corteccia (`TREE_G`, `TREE_LEAF` in `src/world3.js`). 76 triangoli a chioma invece di 20: nei parchi più fitti la scena passa da circa 370 000 a 600 000 triangoli, nelle strade alberate +20%. Le foglie sono disegnate al caricamento in un atlante 512×512 (niente file da scaricare), con le mipmap fatte a mano perché le chiome lontane non si sfaldino. Normali sferiche (la chioma si illumina come una palla), ombra finta dentro e sotto la chioma nei colori dei vertici, ombre con i buchi tra le foglie. I colori restano quelli di prima (`GREENS`), anche per i frutteti di `paesaggio3.js`
  - [ ] Da tenere d'occhio sui telefoni: le carte con `alphaTest` costano in riempimento. Se pesa, nella qualità bassa: meno ciuffi o chiome lontane più semplici
- [x] Occlusione ambientale (terzo giro), solo sugli edifici generici di `world3.js`: i muri si scuriscono alla base (fino a 2 m), sotto la gronda dei tetti a falde e negli angoli rientranti, calcolato per pixel nello shader da un attributo `aoD` dei vertici (`AO_WALL`, concatenato in `foto3.js` dopo la patch delle finestre accese di `extras.js`). Toglie soprattutto la luce del cielo, poco quella del sole. A terra una fascia di 1,6 m intorno a ogni edificio, moltiplicata su quello che c'è sotto (`aoGround`), alla quota del terreno come è disegnato (`terrDrawnH`: con `visH` fluttuava sui dossi tra i nodi della griglia)
  - [ ] Da estendere ai pezzi fatti a mano: vetrine (`negozi3.js`), monumenti e chiese (`landmarks3.js`), supermercati, muri di cinta
- [x] Cielo vero (quarto giro): modello di Preetham di three (`Sky.js` r128 da jsdelivr, aggiunto da `assemble3.py` accanto a `three.min.js`) con il disco del sole, in `src/foto3.js`. Si disegna per primo sopra il vecchio gradiente e sfuma di notte, con le nuvole e nella nebbia, dove torna il gradiente col suo grigio del tempo. Il shader originale mette la telecamera nell'origine: qui usa `cameraPosition`. Tarato a occhio: esposizione 0,13, torbidità 2, Rayleigh 2,5, saturazione 1,8 che scende a 1,2 col sole basso (al tramonto virava al verde acqua), tinta spostata verso il blu. La foschia prende il colore del cielo all'orizzonte davanti alla telecamera: una striscia di cielo 8×2 resa a parte e letta ogni mezzo secondo. Il bagliore disegnato intorno al sole (`SUNGLOW`) cala dove c'è il cielo nuovo
  - [ ] Le nuvole (sprite di `weather3.js`) al tramonto restano grigio chiaro: dovrebbero prendere la luce del sole basso
  - [ ] Le montagne lontane (`_far`, `_near`) sul cielo nuovo fanno una fascia grigia piatta all'orizzonte
- [x] Facciate (quinto giro), sugli edifici generici: l'intonaco prende la grana di una foto vera (`tex/intonaco.jpg`, Poly Haven "White Stucco 02", CC0, 1,8 m di lato, ridotta a grigio intorno a 128 da `src/foto3_intonaco.py` così la casa tiene il suo colore; solo dove il disegno è muro, non su vetri e persiane). I vetri riflettono il cielo: colore all'orizzonte e in alto (letti dal cielo nuovo) secondo la direzione riflessa, di più di sbieco (Fresnel), ogni vetro un po' storto, e il riflesso del sole; di notte molto meno. Davanzali di pietra sotto le finestre delle case vecchie dal primo piano in su (6 triangoli l'uno, visibili solo entro 180 m: circa 8 000 triangoli in una via del centro). Tutto in `FOTO_FACADE` (`src/foto3.js`) e `addSill` (`world3.js`)
  - [ ] I davanzali seguono il disegno della facciata (una finestra ogni 3,4 m al centro della campata): dove una vetrina occupa il piano terra o la facciata è stretta va bene, ma non guardano le finestre vere (che non abbiamo da OSM)
  - [ ] Condomini moderni: niente davanzali (hanno il balcone continuo disegnato); un balcone vero in rilievo sarebbe il passo dopo
Prossimi giri, in ordine di effetto:
- [ ] I modelli fatti a mano non hanno ancora niente del fotorealismo (Carlo, 23/10): monumenti e chiese (`landmarks3.js`), vetrine (`negozi3.js`), supermercati, stazioni, scuole, muri di cinta. Servono gli stessi materiali degli edifici generici: intonaco, vetri che riflettono il cielo, occlusione ambientale
- [ ] Impostazione qualità alta/bassa per i telefoni
Per provarlo: `python -m http.server` nella cartella del repo e apri `http://localhost:8000` (da `file://` il browser blocca `brianza.json`). Per i confronti si fotografano le stesse inquadrature prima e dopo, con l'ora fissata (`window.__setTOD(15.5)`) e la telecamera messa a mano.

## Telecamera
- [ ] Telecamera più vicina all'auto
- [ ] Visuale in terza persona

## Altri oggetti OSM
Fatti in `src/oggetti3.js` (dati: chiave `og` per tile, fili in `pw`): 464 oggetti nell'area di gioco. I piccoli si abbattono come i lampioni, i grandi sono solidi, i dossi alzano davvero la strada.
- [x] Tralicci (83) con i fili delle 59 linee elettriche; pali (`power=pole`): nessuno nell'area
- [x] Dossi (24), rallentatori (1) e piattaforme rialzate (7): profilo fisico in `surfAt`, scossone in auto
- [x] Paletti (27) e blocchi (11)
- [x] Idranti (10), campane del vetro (19), colonnine di ricarica (15), antenne e ripetitori (35)
- [x] Panchine (56), cestini (25), fontanelle (50), giochi (23), telecamere (36), distributori (15), rastrelliere (17), cassette postali (10)
- [ ] Da rifinire: distributori e telecamere mappati contro i muri finiscono a filo della facciata; i giochi mappati come area sono un solo gruppo al centro

## Vetrine per classe
Fatte in `src/negozi3.js` (dati: chiave `ng` in `brianza.json`, da `build_data.py`): 1301 attività OSM in 19 classi, 1245 vetrine nel gioco. Ogni classe ha 5 o 6 modelli (insegna, cornice, porta, tenda, cose sul marciapiede); il modello lo sceglie un hash del posto, l'interno della vetrina segue il sottotipo (macelleria, panetteria, ottica...). Le marche note (Esselunga, Eurospin, Intesa, ecc.) tengono i loro colori.
- [x] Vetrine più larghe: ognuna si allarga nella parete libera accanto (fino a 18 m), senza sovrapporsi alle vicine e senza girare gli angoli interni
- [x] Supermercati grandi in un edificio tutto loro (12: Unes, Carrefour, Iperal, famila, MD, Prix...): edificio su misura con pannelli, fascia del colore della catena, insegna grande, vetrata con pensilina, baie di carico, impianti sul tetto, pensilina dei carrelli e totem sulla strada dove c'è posto
- [ ] Lo stesso per i mobilifici grandi e i concessionari nei capannoni
- [ ] Le officine con la serranda aperta: niente spazio per gomme e bidoni quando il portone occupa tutta la facciata

## Altre classi da ricavare dalla mappa (punto 4 della scaletta)
- [ ] Fabbriche (`man_made=works`, 155; `office=company` nei capannoni, 129): ciminiere, cancelli con la targa, piazzali con i bancali, mobilifici di Meda con i camion
- [ ] Scuole materne, oratori, palestre (`leisure=fitness_centre`, `sport=*`) con 5 modelli ciascuno
- [ ] Campi sportivi per sport (`sport=soccer` 44, `basketball` 22, `tennis` 13, `boules`): porte, canestri, reti, bocce
- [ ] Edicole votive (`historic=wayside_shrine`, 11) e monumenti piccoli (`historic=memorial`/`monument`, 13)
- [ ] Colori e tetti veri dove OSM li ha (`building:colour`, `roof:shape`, `roof:material`)
- [ ] Mercato (`amenity=marketplace`, 4): bancarelle nel giorno giusto
- [ ] Armadietti dei pacchi (`amenity=parcel_locker`, 12) e bancomat isolati (`amenity=atm`, 10)

## Segnaletica
- [ ] Segnaletica orizzontale: linee di arresto e scritte STOP, frecce di corsia, piste ciclabili, strisce blu (oggi ci sono le strisce pedonali, 510 attraversamenti)
- [ ] Verticale: nel gioco c'è (901 cartelli in `src/segnaletica.json`, generati da `src/segnaletica_osm.py`), ma gli estratti OSM `t*.xml` usati per generarla non sono stati salvati. Rigenerarla da `data/osm/maplarge.osm`, che ha 112 `traffic_sign` mappati, e salvare la sorgente in `data/osm/`

## Mappa
- [ ] Cercare gli edifici fantasma in mappa

## Stazioni
Le banchine (rialzate, pensiline, sottopasso, cartelli) ci sono in tutte e cinque le stazioni e il fabbricato di Meda è già quello del 2023. Da sistemare i fabbricati di:

- [ ] Stazione di Seveso: ci sono lavori in corso sul nodo, servono foto recenti
  - [ ] Il cantiere della stazione va fatto come cantiere vero (recinzioni da cantiere, mezzi, gru se ci sono, percorsi provvisori), non con le recinzioni ferroviarie normali: lì binari, banchine e passaggi sono provvisori
- [ ] Stazione di Cabiate
- [ ] Stazione di Camnago-Lentate

Le foto di Wikipedia sono vecchie: usare solo foto recenti (o screenshot di Street View mandati da chi gioca, o Mapillary con un token).

## Scuole
- [x] Scuole Traversi (Palazzo delle Scuole Professionali), con la zona della partenza: parcheggi a strisce, parco Fusetti arredato
- [x] Liceo Marie Curie (foto dell'ingresso dal sito del liceo)
- [x] Primaria San Giorgio (Magistretti e Aulenti): fatta dalla descrizione, mattoni a vista e tetto piano; manca una foto per i dettagli
- [x] Anna Frank e Diaz (via Giovanni XXIII, Meda), con la scalinata coperta tra le due, dalle viste 3D di Apple Maps
- [x] Seminario di San Pietro Martire, Seveso (il complesso accanto al santuario)
- [x] Liceo Frassati di Baruccana con la palestra (foto della perizia del Comune, 2025)
- [ ] Asilo Garibaldi
- [ ] Altre scuole di Seveso: servono foto (Collodi, Leonardo da Vinci / Milani, Bruno Munari, Toti, Don Aurelio Giussani, Frassati di via San Carlo)

## Sala del Regno e la sua zona
- [ ] Sala del Regno dei Testimoni di Geova (punto OSM a x -534.6, z 6.3, ovest di Meda): modello fotorealistico come i monumenti, da foto recenti
- [ ] La zona intorno con un'atmosfera cupa e un po' losca (luci, lotti, capannoni), da foto: è l'ambiente a essere losco, non la comunità che ci si riunisce

## Piscine da fare bene
Modelli su misura come i monumenti (vasche, edificio, tribune, parcheggio), solo da foto recenti.
- [ ] Meda: SportVillage, via Icmesa (OSM way 1216938842, centro sportivo con piscina e calcio)
- [ ] Seregno: Nuoto Club Seregno (OSM way 422227820, al bordo est della mappa attuale)
- [ ] Seveso: da individuare, in OSM non c'è una piscina con nome o indirizzo a Seveso

## Piccoli monumenti
- [ ] Lapidi, cippi, edicole, piccoli monumenti sparsi nei quartieri (oltre a quelli qui sotto)

## Monumenti con le foto già trovate, manca la posizione esatta
- [ ] Muro dell'ICMESA (via Icmesa, Meda) con il pannello sul 1976
- [ ] Monumento ai Caduti di Meda
- [ ] Monumento ai Caduti di Seveso (Nardo Pajella)
- [ ] Monumento al Falegname, Meda
- [ ] Casa del Fascio, Seveso
- [ ] Statua del Donatore di Sangue (piazza Cavour, Meda) e Statua dell'Intagliatore (giardino di Villa Besana)

Le foto sono in Viaggiare in Brianza (guide di Meda e Seveso).

## Ritocchi ai monumenti già fatti
- [ ] Torretta con lanterna del Seminario di Seveso: posizione stimata, da verificare
- [ ] Campanile del Santuario del Crocifisso di Meda: posizione approssimata
- [ ] San Pietro Martire di Meda: la lanterna sul tetto è al centro a occhio, forse va sopra l'altare (più a est)
- [ ] Casa Ferrario: tre piani bassi invece dei due della foto; torre merlata stimata sull'angolo
- [ ] Villa Bianca di Terragni: più allungata della foto perché segue la pianta OSM
- [ ] Santa Maria Nascente: campanile non trovato nelle fonti, copertura della cupola ipotizzata in rame
- [ ] Municipio di Meda: colori e dettagli tipici, non da foto; mancano le bandiere dei quattro rioni
- [ ] Pensiline delle banchine tutte uguali tra le stazioni; il sottopasso non si percorre
- [ ] Parco Fusetti: aiuola e panchine generiche, da confrontare con una foto

## Idee per dopo
- [ ] "Scopri la Brianza": cartello con nome e due righe di storia avvicinandosi a un monumento, icone sulla mappa grande, contatore dei monumenti scoperti salvato
- [ ] Missioni legate ai luoghi veri (fiori al Santuario prima delle campane, consegna in Municipio)
- [ ] Vita intorno ai monumenti: fedeli all'uscita della messa, mercato in piazza Vittorio Veneto, bancarelle del Palio
- [ ] Prestazioni: verificare su telefono il numero di auto parcheggiate nei posti (oggi fino a 14 per tile)

## Come si lavora
- Foto: Wikipedia ha foto vecchie; Wikimedia Commons limita le richieste (riprovare dopo qualche minuto); Street View non utilizzabile (chiave e termini); Mapillary va bene con un token.
- I monumenti stanno in `src/landmarks3.js` (lista `LANDMARKS` in cima); `python src/assemble3.py` rigenera `index.html`.

## Parcheggi
**Priorità.** Oggi i posti sono generati (strisce a pettine dentro i 921 contorni OSM `amenity=parking`). In `data/osm/maplarge.osm` ci sono già 1964 `amenity=parking_space`, 134 parcheggi con `capacity` e 37 strade con `parking:*`:
- [ ] Importare in `build_data.py` i posti veri `amenity=parking_space`, la `capacity` dei parcheggi e i parcheggi lungo strada `parking:left/right/both`
- [ ] Usare i posti veri dove ci sono (forma, direzione, disabili), la `capacity` come tetto per quelli generati
- [ ] Posti in linea lungo le strade, strisce blu a pagamento in centro
