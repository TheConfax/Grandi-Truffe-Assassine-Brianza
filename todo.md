# Da fare

## Priorità: parcheggi veri da OSM
Prima di tutto il resto: vedi la sezione **Parcheggi** in fondo. I dati sono già in `data/maplarge.osm`, non serve aspettare Overpass.

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

## Segnaletica
- [ ] Segnaletica orizzontale: linee di arresto e scritte STOP, frecce di corsia, piste ciclabili, strisce blu (oggi ci sono le strisce pedonali, 510 attraversamenti)
- [ ] Verticale: nel gioco c'è (901 cartelli in `src/segnaletica.json`, generati da `src/segnaletica_osm.py`), ma gli estratti OSM `t*.xml` usati per generarla non sono stati salvati. Rigenerarla da `data/maplarge.osm`, che ha 112 `traffic_sign` mappati, e salvare la sorgente in `data/`

## Mappa
- [ ] Cercare gli edifici fantasma in mappa

## Stazioni
Le banchine (rialzate, pensiline, sottopasso, cartelli) ci sono in tutte e cinque le stazioni e il fabbricato di Meda è già quello del 2023. Da sistemare i fabbricati di:

- [ ] Stazione di Seveso: ci sono lavori in corso sul nodo, servono foto recenti
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
**Priorità.** Oggi i posti sono generati (strisce a pettine dentro i 921 contorni OSM `amenity=parking`). In `data/maplarge.osm` ci sono già 1964 `amenity=parking_space`, 134 parcheggi con `capacity` e 37 strade con `parking:*`:
- [ ] Importare in `build_data.py` i posti veri `amenity=parking_space`, la `capacity` dei parcheggi e i parcheggi lungo strada `parking:left/right/both`
- [ ] Usare i posti veri dove ci sono (forma, direzione, disabili), la `capacity` come tetto per quelli generati
- [ ] Posti in linea lungo le strade, strisce blu a pagamento in centro
