# Da fare

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
- [ ] Altre scuole di Seveso: servono foto (Collodi, Leonardo da Vinci / Milani, Bruno Munari, Toti, Don Aurelio Giussani, Frassati di via San Carlo)

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
Oggi i posti sono generati (strisce a pettine dentro i 921 contorni OSM `amenity=parking`). Da fare quando Overpass risponde:
- [ ] Importare in `build_data.py` i posti veri `amenity=parking_space`, la `capacity` dei parcheggi e i parcheggi lungo strada `parking:left/right/both`
- [ ] Usare i posti veri dove ci sono (forma, direzione, disabili), la `capacity` come tetto per quelli generati
- [ ] Posti in linea lungo le strade, strisce blu a pagamento in centro
