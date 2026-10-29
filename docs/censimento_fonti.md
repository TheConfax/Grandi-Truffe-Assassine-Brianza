# Censimento delle fonti di dati aperti (29/10/2026)

Fatto prima di allargare la mappa da Meda a 60 km². Solo ricerca (cataloghi, API di metadati, schede licenza): nessun dato grosso scaricato, il gioco non toccato. Cosa abbiamo e dove: `docs/dati.md`; cosa usiamo per cosa: `docs/fonti.md`. "Verificato" = letto sulla scheda o sul servizio il 29/10; "da verificare" = detto da una fonte secondaria o non trovato, va aperta la scheda prima di scaricare.

## Sintesi

1. **Sorpresa sulle ortofoto**: l'ortofoto della Regione (2012-2021, 20 cm) è AGEA, "proprietà esclusiva di AGEA" (testo del servizio ArcGIS, verificato), consultabile ma non riusabile. Già oggi `manufatti_foto.py` ne ricava dati (classi di manufatti): vanno verificate le condizioni d'uso prima di pubblicare, e per i colori dei tetti non è la strada giusta. Alternativa libera: Sentinel-2 (10 m, Copernicus) o i colori da Mapillary/OSM.
2. **Numeri civici**: Overture `addresses` per l'Italia è ANNCSU (ISTAT + Agenzia Entrate), CC BY 4.0 (verificato sulla pagina attribuzioni di Overture, release 2026-10). Un solo download piccolo, da incrociare con i 6 432 civici di OSM. Alta.
3. **Overture Places** (negozi, insegne): CDLA Permissive 2.0 (Meta, Microsoft ecc., verificato), compatibile. Da incrociare con le 1 301 attività di OSM; serve contare quante sono nuove e quante hanno nome/categoria. Alta.
4. **Wikidata + Commons**: 837 elementi con coordinate nel riquadro grande (query SPARQL fatta il 29/10, CC0): chiese, ville, cascine, cimiteri, stazioni, monumenti (Palazzo Arese Borromeo, Villa Borromeo, Parco delle Groane...). Base per la missione di fotografia e per i monumenti. Foto su Commons una per una con la licenza del file. Alta.
5. **DUSAF 8.0 (2024) / 7.0 (2021)**: servizi sul Geoportale (`dusaf8`, `dusaf7`), DUSAF 6.0 (2018) scaricabile da dati.lombardia.it in CC BY 4.0 (verificato). Dà campi, prati, orti, cantieri, cave, cimiteri, aree verdi con classe fine, più di WorldCover (10 classi). Licenza di 7/8 da verificare (probabile CC BY 4.0). Alta per campi e paesaggio.
6. **Panoramax**: ci sono foto stradali nel riquadro (verificato, API `api.panoramax.xyz`, CC BY-SA 4.0), più recenti di Mapillary 2018-19. Conta e anno da misurare; servirebbe per aspetto di facciate e controllo cartelli. Media.
7. **DBGT già in mano**: 24 tabelle del gpkg di Meda non lette (`PT_QUO` 19 128 punti quotati, `SCARPT` 926 scarpate, `CV_LIV` curve di livello, `BRK_LN`, `CPRESA`, `Z_FOTO`...) e 22+8 comuni scaricati e non estratti. Costo zero. Alta (controlli e comuni nuovi).
8. **Basso**: tutto il resto (Copernicus 10 m, GHSL, Microsoft Buildings, CENED, rumore, luce notturna) o ripete quello che abbiamo o serve poco a un gioco. Dettagli sotto.

Rischio licenza da tenere d'occhio: Mapillary, Panoramax e le foto Commons CC BY-SA sono "share-alike"; OSM e Overture buildings sono ODbL. Con GitHub Pages e crediti in pagina vanno bene, ma conviene una riga unica di crediti e, se un giorno si ridistribuisce il file dei dati, valutare lo share-alike sulla base dati derivata.

## Tabella completa

Legenda: **Ce l'ho** = file in `data/`; **Build** = letta da `src/`. Conviene: A alta, M media, B bassa.

### Quello che abbiamo già

| Fonte | Chi | Cosa dà (scala, anno, copertura) | Formato / accesso | Licenza | Ce l'ho | Build | A cosa serve | Conviene |
|---|---|---|---|---|---|---|---|---|
| [DBGT](https://www.geoportale.regione.lombardia.it/) (r_lombar:0092b7ba-...) | Regione Lombardia | Forme e quote 3D di strade, edifici, volumi, muri, alberi, acque, ferrovia; 1:1000; rilievi 2005-2021 per comune; Meda 2015 | GeoPackage per comune, `package?dbId=514&cod=` | CC BY 4.0 (verificato) | Meda estratto, 8 comuni in zip, 22 in zip | sì, 63 tabelle su 88 | Base del mondo | A (è il cuore) |
| DBGT, tabelle non lette | idem | `PT_QUO` 19 128 punti quotati, `SCARPT_SUP_L` 926 scarpate, `CV_LIV` 104 curve di livello, `BRK_LN` 45 linee di rottura, `CPRESA` 9 prese d'acqua, `Z_FOTO` 77, `PE_UINS` 16, `LOC_SG` 19, `ND_IDR` 56, `GZ_CIC`, `GZ_VMS`, `A_VOLO` 7 (le `_SR` sono duplicati di superficie) | stesso gpkg | CC BY 4.0 | sì | no | Controlli di quota sul LiDAR, scarpate e muri di sostegno, prese e nodi d'acqua | M |
| DBGT altri 30 comuni | idem | I 9 della mappa di oggi + i 22 della mappa grande | zip | CC BY 4.0 | scaricati | no (zip) | Mappa a 60 km²; vedi avvertenza sui rilievi vecchi in `dati.md` | A |
| [OSM](https://www.openstreetmap.org/) via Overpass e Geofabrik | OpenStreetMap | Nomi, attributi, negozi, cartelli, sensi, limiti, civici (6 432), stazioni | .osm | ODbL | `osm/maplarge.osm`, `mappa_grande.osm` | sì | Cosa sono le cose | A |
| [Overture buildings](https://overturemaps.org/) | Overture Maps | 64 149 edifici nel riquadro grande; include OSM, Microsoft ML, Esri | GeoJSON (`overturemaps`) | ODbL (verificato) | sì | sì (dove manca il DBGT) | Edifici di riserva | M |
| LiDAR PST-A DTM e DSM First 1 m | Min. Ambiente (MASE) | Terreno e altezza di tetti e alberi, voli 2008 (+2010) | GeoTIFF dal portale `sim.mase.gov.it` | CC BY 4.0 | 54 tessere su 224 | DTM sì; DSM per altezze sì | Terreno, tetti | A (manca il resto: portale fermo fino al 6/11) |
| [TINITALY 1.1](https://tinitaly.pi.ingv.it/) | INGV | DEM 10 m, 2023 | GeoTIFF | CC BY 4.0 | sì | sì (dove manca il LiDAR) | Terreno di riserva | B |
| [ESA WorldCover 2021](https://esa-worldcover.org/) | ESA | Copertura 10 m, 11 classi | GeoTIFF S3 | CC BY 4.0 | sì | sì | Campi, boschi, prati dove il DBGT non c'è | M (DUSAF è più fine) |
| [Mapillary](https://www.mapillary.com/) | Meta + utenti | 17 168 oggetti e 67 078 foto nel riquadro grande; 80% del 2018-19 | Graph API v4, token | CC BY-SA 4.0 | sì | sì (cartelli, lampioni) | Cartelli, pali, cestini | A |
| [Wikimedia Commons](https://commons.wikimedia.org/) segnali | Wikimedia | 27 SVG dei segnali del Codice della strada | API Commons | PD (22) e CC BY-SA 3.0 Flanker (5), verificati per file | atlante `tex/segnali.png` | sì (`segnali3.js`) | Cartelli veri | A (fatto) |
| Ortofoto 2018-19 (ImageServer Regione) | AGEA via Regione | 20 cm, finestra per volta | ArcGIS `exportImage` | **AGEA, proprietà esclusiva** (testo del servizio, verificato) | nessun file | sì (`manufatti_foto.py`) | Classifica manufatti | vedi sotto: licenza da chiarire |

### Regione Lombardia: Geoportale, servizi ArcGIS e dati.lombardia.it

Elenco dei servizi preso il 29/10 da `https://www.cartografia.servizirl.it/arcgis1/rest/services` e `arcgis2/...`; schede licenza su dati.lombardia.it dove esistono.

| Fonte | Chi | Cosa dà | Formato / accesso | Licenza | Ce l'ho | Build | A cosa serve | Conviene |
|---|---|---|---|---|---|---|---|---|
| DUSAF 8.0 (2024) e 7.0 (2021), [servizi `dusaf8`, `dusaf7`](https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/dusaf8/MapServer) | Regione / ERSAF | Uso del suolo 1:10 000 con classi fini (seminativi, prati, vigneti, orti, cave, cantieri, discariche, cimiteri, parchi urbani, verde sportivo) più strato filari e siepi | MapServer (identify/export; il download dello shapefile sta nella scheda del Geoportale) | 6.0: CC BY 4.0 (verificato su dati.lombardia.it); 7.0 e 8.0: da verificare (probabile CC BY 4.0) | no | no | Campi, cantieri, cave, verde: classe fine invece di WorldCover; siepi e filari | A |
| DUSAF 6.0 (2018) [`7rae-fng6`](https://www.dati.lombardia.it/d/7rae-fng6), 5.0 `iq6r-u7y2`, 4.0 `2ze8-fyd2` | idem | Come sopra, versioni vecchie | Socrata + link shapefile | CC BY 4.0 (verificato) | no | no | Piano B se 7/8 non fossero compatibili | M |
| Ortofoto 1975, 1998, 2003, 2007, 2012, 2015, 2018-19, 2021 (servizi `ortofoto*`, `Ortofoto2021`) | Regione / AGEA | Foto aeree, 2018-21 a 20 cm | ImageServer, MapServer, WMTS | 2018-2021: AGEA, uso consultazione, non ridistribuibile (verificato per 2018 sul servizio; scheda 2021: solo visualizzazione). Le più vecchie: da verificare | no | solo 2018-19 | Vedi sotto | B finché la licenza non è chiara |
| Sentinel-2 (servizio `SENTINEL_2_image`) | Regione su dati Copernicus | Immagine 10 m della Lombardia | ImageServer | Copernicus gratuito e aperto, con attribuzione; da verificare per il servizio | no | no | Colori medi di campi, boschi, tetti grandi | M (la risoluzione è bassa) |
| DTM 5×5 (`DTM5_RL`) | Regione | Quota 5 m, 2015, tutta la regione | .img 3 GB o ImageServer | CC BY 4.0 | no (scartato) | no | Terreno più grezzo del LiDAR | B |
| DSM (`DSM_UTM32N`), CTR 1:10 000, CT50, `Rilievo*` | Regione | Superficie, carte tecniche e rilievi ombreggiati | MapServer | da verificare | no | no | Niente di nuovo sul DBGT | B |
| `carta_microrilievo`, `cle` (condizione limite emergenza), `Microzonazione_sismica`, `carta_geomorfologica`, `PAI`, `fattibilita_geologica` | Regione, ARPA | Rischi, geologia, vincoli | MapServer | CC BY 4.0 per la maggior parte (da verificare per layer) | no | no | Nulla di visibile nel gioco | B (scartata) |
| `dbtr_dynamic`, `dbtr_identify`, `EDIFICATO_CATASTO_DBTR` | Regione | Servizi sul DBT regionale: edifici "bonificati" dal catasto, province, comuni | MapServer | come DBGT | no | no | Controllo incrociato degli edifici | B |
| `ReticoloIdrografico_RIRU`, `LOM_WMS4_Idrografia` | Regione | Reticolo idrografico regionale | MapServer, WFS | CC BY 4.0 (da verificare) | no | no | Nomi di rogge e fossi, oltre a DBGT `EL_IDR` | B |
| `LOM_WMS1..3`, `Azzonamenti_comunali`, `ptcp`, `stato_pgt` | Regione | Ambiti, tessuto urbanizzato, trasporti, azzonamenti e PTCP | MapServer | da verificare | no | no | Zone industriali e residenziali (aiuterebbe i tetti e le facciate per zona) | M (PGT: azzonamento per carattere dei quartieri) |
| [Edifici DBT di province](https://www.dati.lombardia.it/d/sh4u-buxa) (Lecco, Sondrio) | Regione | Edifici da DBT in Socrata | CSV/GeoJSON | CC BY | no | no | Per Monza-Brianza e Como non risultano nel catalogo | B |
| CENED 2, [`bbky-sde5`](https://www.dati.lombardia.it/d/bbky-sde5) | Regione, ARIA | Attestati energetici con indirizzo, anno di costruzione, volumi, classe, piano | Socrata (CSV/JSON) | CC0 (Public Domain, verificato) | no | no | Anno di costruzione e tipo per indirizzo → stile e colore dell'edificio (da incrociare con i civici) | M (milioni di righe, posizione solo per indirizzo) |
| [Piste ciclabili Provincia Monza-Brianza](https://www.dati.lombardia.it/d/xh9r-g2rn) | Provincia MB | Tracciati dal Piano Mobilità Ciclistica 2014, poligoni | Socrata/shapefile | CC BY 4.0 (verificato) | no | no | Confronto con ciclabili OSM e DBGT `AC_CIC` (solo 17) | B |
| [Strade provinciali MB](https://www.dati.lombardia.it/d/kvdw-v42u) | Provincia MB | Tracciato SP | Socrata | CC0 | no | no | Ripete OSM | B |
| [Medie strutture di vendita](https://www.dati.lombardia.it/d/a9dq-823b) | Regione | Elenco al 30/06/2013 | Socrata | CC0 | no | no | Vecchio | B (scartata) |
| Bellezze Individue / alberi monumentali (`jadb-69ie`, `3p7i-wahf`, servizio alberi monumentali) | Regione | Alberi monumentali d'Italia (L. 10/2013) con coordinate | Socrata + WMS | CC0 (scheda) | no | no | Alberi speciali con nome (pochi, forse nessuno a Meda) | B |
| Parchi Lombardia (`uttz-yemc`), PLIS, aree protette | Regione | Perimetri di parchi (Groane, Brianza centrale, Bosco delle Querce) | Socrata/WFS | CC0 (scheda) | no | no | Nomi e confini di parco per cartelli e missioni | M |
| Rete escursionistica REL, strade agro-silvo-pastorali | Regione | Sentieri e strade bianche | Geoportale / Socrata | CC BY 4.0 per le strade agro-silvo (da OSM wiki); REL da verificare (notate riserve) | no | no | Sentieri nei boschi delle Groane | B (OSM li ha) |
| Numeri civici regionali | Regione | Esisteva in shapefile per provincia (nel 2015); oggi non trovato nel catalogo | | IODL 2.0 allora | no | no | Sostituito da ANNCSU via Overture | B |
| Open data dei comuni: Seregno (anagrafe aggregata), Monza (verde, parcheggi con parcometri), Montorfano (toponimi) | Comuni | Cataloghi in dati.lombardia.it | Socrata | CC0 / CC BY | no | no | Per Meda, Seveso, Lentate, Cabiate, Barlassina, Mariano, Giussano, Como: nulla di utile trovato nel catalogo (nessun civico, lampione, albero) | B (ricerca fatta: `meda`, `civici`, `alberi`, `illuminazione`, `segnaletica`, `rumore` senza risultati utili per la zona) |

### Ministero, ISTAT, Agenzia delle Entrate, AGEA

| Fonte | Chi | Cosa dà | Formato / accesso | Licenza | Ce l'ho | Build | A cosa serve | Conviene |
|---|---|---|---|---|---|---|---|---|
| [ANNCSU](https://www.anncsu.gov.it/) numeri civici | ISTAT + Agenzia Entrate + comuni | Strade e civici nazionali (28 milioni, ma solo una quota con coordinate; dati di Lombardia buoni) | download massivo mensile; distribuito anche da Overture/OpenAddresses | CC BY 4.0 (verificato via Overture) | no | no | Civici sulle case: targhe, citofoni, missioni di consegna | A (via Overture) |
| ISTAT basi territoriali 2021 / sezioni di censimento | ISTAT | Poligoni delle sezioni con popolazione, edifici, abitazioni, età dell'edificato (R03_21.zip) | shapefile | probabile CC BY 4.0 (da verificare nel PDF "Descrizione dei dati") | no | no | Densità di traffico e pedoni per quartiere; età degli edifici per sezione | M |
| Catasto: cartografia catastale particelle | Agenzia delle Entrate | Particelle e fabbricati | WMS/download (CC0 per le particelle, da verificare) | da verificare | no | no | Lotti e giardini; già nel DBGT come muri | B |
| OMI quotazioni immobiliari | Agenzia delle Entrate | Prezzi per zona | CSV | CC BY 4.0 (da verificare) | no | no | Ricchezza dei quartieri (auto e persone) | B |
| AGEA ortofoto (open data) | AGEA | Ortofoto nazionali | WMS/download per enti | restrittiva (verificato per Lombardia) | no | no | vedi sopra | B |
| PST: altri servizi del Ministero | MASE | Ortofoto IT2000/2006, geologia | WMS | da verificare | no | no | | B |

### Overture, OSM e derivati, Wikimedia, foto stradali

| Fonte | Chi | Cosa dà | Formato / accesso | Licenza | Ce l'ho | Build | A cosa serve | Conviene |
|---|---|---|---|---|---|---|---|---|
| Overture `addresses` | Overture (fonte Italia: ANNCSU) | Civici con coordinate | `overturemaps download -t address` | CC BY 4.0 (ANNCSU; verificato sulla pagina attribuzioni) | no | no | Civici veri | A |
| Overture `places` | Overture (Meta, Microsoft, PinMeTo, Krick ecc.) | Negozi, bar, servizi, nome e categoria, a volte sito e orari; ~2,5 milioni in Italia | `overturemaps download -t place` | CDLA Permissive 2.0 (verificato) | no | no | Insegne, negozi mancanti in OSM; dedup con OSM per nome e distanza | A |
| Overture `transportation` | Overture (OSM + TomTom/Meta) | Strade e segmenti | come sopra | ODbL | no | no | Ripete OSM | B |
| Overture `base` (land, land_cover, infrastructure, water, land_use) | Overture (OSM, ESA WorldCover) | Strati di OSM e WorldCover | come sopra | ODbL + CC BY 4.0 (verificato) | no | no | Ripete cose che già abbiamo | B |
| Overture `divisions` | Overture (OSM, geoBoundaries) | Confini | come sopra | ODbL | no | no | Ripete `confini_comuni*.json` | B |
| OSM derivati: Geofabrik (fatto), Overpass (fatto), Daylight, osm2pgsql | | Gli stessi dati di OSM | | ODbL | sì | sì | | A (fatto) |
| [Wikidata](https://query.wikidata.org/) | Wikimedia | 837 elementi georeferenziati nel riquadro grande (chiese, ville, cascine, fabbriche storiche, cimiteri, monumenti, stazioni, biblioteche), spesso con foto (P18), anno, stile, codice Beni Culturali (P1435, Lombardia Beni Culturali) | SPARQL | CC0 | no | no | Luoghi per la missione di fotografia; targhe e nomi dei monumenti; stile/anno degli edifici storici | A |
| [Wikimedia Commons](https://commons.wikimedia.org/) foto di luoghi | Wikimedia + utenti | Foto georeferenziate (Wiki Loves Monuments) | API | licenza per file (CC BY, CC BY-SA, PD) | no | no | Riferimento visivo per i modelli dei monumenti; non per dati | M |
| [Panoramax](https://panoramax.xyz/) | Comunità (federazione) | Foto stradali con posizione e direzione; nel riquadro ci sono foto (da contare e datare) | STAC `api.panoramax.xyz/api/search` | CC BY-SA 4.0 (per immagine, verificato) | no | no | Cartelli e facciate recenti; controllo dei cartelli di Mapillary | M |
| KartaView (OpenStreetCam) | Grab | Foto stradali | API | da verificare (CC BY-SA 4.0 dichiarata dal sito) | no | no | Copertura da misurare | B |
| Mapillary mappa grande (già in tabella sopra) | | | | | sì | | | |
| Microsoft GlobalML Building Footprints | Microsoft | Impronte da satellite, Italia ben coperta | GeoJSON per regione | ODbL | no | no (in Overture) | Ripete DBGT + Overture | B |
| Google Open Buildings (v3) | Google | Copertura soprattutto Africa/Asia/America Latina; per l'Europa non confermata | | CC BY 4.0 / ODbL | no | no | Nulla | B (scartata) |

### Copernicus, satellite, globali

| Fonte | Chi | Cosa dà | Formato / accesso | Licenza | Ce l'ho | Build | A cosa serve | Conviene |
|---|---|---|---|---|---|---|---|---|
| Copernicus HRL Imperviousness 2018 | EEA/CLMS | Grado di impermeabilizzazione 10 m | GeoTIFF dopo login gratuito | gratuita e aperta, con attribuzione, vietato non dichiarare le modifiche (verificato) | no | no | Ripete DBGT/WorldCover (edifici e strade già vettoriali) | B |
| Copernicus HRL Tree Cover Density 2018 | EEA/CLMS | Densità chioma 10-20 m | GeoTIFF | come sopra | no | no | Densità di alberi nel bosco e nei giardini dove il DBGT non ha `ALBERO` | M |
| Copernicus Urban Atlas 2018 e Building Height 2012/2021 | EEA/CLMS | Uso del suolo urbano 1:10 000 per Milano e Monza (FUA); altezza edifici raster 10 m (2021) | GPKG / raster | come sopra; il Building Height 2012 solo su richiesta | no | no | Altezze: abbiamo già DBGT + LiDAR | B |
| Copernicus Sentinel-2 | ESA | Immagini 10 m ogni 5 giorni; colore medio per cella | STAC (Copernicus Data Space, AWS) | aperta e gratuita | no | no | Colori di campi e tetti grandi | M |
| GHSL (GHS-BUILT-H, GHS-BUILT-S) | JRC | Altezza edifici 100 m / 10 m, superficie costruita | GeoTIFF | CC BY 4.0 (noto, da verificare) | no | no | Ripete DBGT | B |
| Luce notturna (VIIRS) | NASA/NOAA | Radianza notturna 500 m | GeoTIFF | aperta | no | no | Quanti lampioni accendere per quartiere (le lampade vere sono Mapillary e OSM) | B |
| Rumore (mappatura acustica Dir. 2002/49) | ARPA Lombardia, comuni | Mappe di rumore di strade e ferrovia per agglomerati (Milano) | PDF/shapefile | da verificare | no | no | Niente per il gioco | B |

### Altre idee valutate

| Fonte | Cosa dà | Conviene |
|---|---|---|
| Interni dei parcheggi sotterranei | Nessuna fonte aperta; DBGT (`sottoterra.py`) e OSM `parking=underground` sono l'unica base | n.a. |
| Ferrovia, acque | DBGT (già) + OSM; RFI non ha dati aperti | n.a. |
| Insegne e colori dei negozi | Overture Places (nome/categoria) + Mapillary (foto); i colori delle insegne non esistono come dato aperto: si resta neutri | vedi Places |
| Alberi singoli | DBGT `ALBERO` (12 334, già); OSM 7 962 | n.a. |
| Orari bus e treni | Non servono (Carlo) | n.a. |

## Cosa fare prima della mappa grande (ordine di costo)

1. Chiarire la licenza dell'uso delle ortofoto AGEA in `manufatti_foto.py`: i dati derivati (classi) probabilmente vanno, ma l'immagine non si ridistribuisce, e lo script non salva file (`data/ortofoto_manufatti` è locale). Da scrivere nei crediti.
2. Scaricare Overture `address` e `place` sul riquadro grande (pochi MB), contare quanti nuovi rispetto a OSM.
3. Query Wikidata (già pronta, 837 elementi) salvata in `data/wikidata/`, con P18 e P1435.
4. DUSAF 8.0: aprire la scheda del Geoportale, verificare la licenza, scaricare lo shapefile di Monza-Brianza e Como; misurare contro il DBGT `CL_AGR` e WorldCover a Meda.
5. Estrarre gli altri `dbgt.gpkg` (nessun costo) e leggere `PT_QUO`, `SCARPT`, `CV_LIV` come controlli.
6. Misurare Panoramax nel riquadro: numero di foto per anno.
7. Azzonamento PGT / `stato_pgt` e ISTAT sezioni: provare solo se serve variare lo stile dei quartieri.

## Fonti scartate e perché

- **Orari di bus e treni (GTFS)**: Carlo ha detto che non servono.
- **DTM 5×5 Regione**: peggiore del LiDAR 1 m, 3 GB.
- **Google Open Buildings**: copertura europea non confermata, gli edifici ci sono già dal DBGT e da Overture.
- **Microsoft Building Footprints, GHSL, Copernicus Imperviousness e Building Height**: ripetono forme e quote che il DBGT dà meglio.
- **Rischi (PAI, sismica, geomorfologia, fattibilità), servizi PGT e PTCP in dettaglio**: niente di visibile in un gioco.
- **OMI, Catasto particelle**: niente di visibile; i lotti si vedono già dai muri del DBGT.
- **Rumore e luce notturna**: troppo grossolani.
- **Ortofoto AGEA come fonte di colore**: non ridistribuibile; per i colori si usano Sentinel-2 e Mapillary.
- **Dati comunali di Meda, Seveso, Lentate, Cabiate, Barlassina, Mariano, Giussano, Como**: cercati nel catalogo di dati.lombardia.it per nome, civici, alberi, illuminazione, segnaletica: niente di geografico e utile; i portali comunali propri (non Socrata) non sono stati esplorati e restano da guardare a mano se serve.
- **Numeri civici regionali del 2015**: sostituiti da ANNCSU.
- **Overture transportation, base, divisions**: ripetono OSM e WorldCover.

## Limiti di questo censimento

Fatto solo con HTTP: le licenze marcate "da verificare" non sono state aperte sulla scheda. Non è stato contato quanti `places` e `addresses` ci sono nel riquadro (serve un download). Il Geoportale ha anche un catalogo web (`geoportale.regione.lombardia.it/ricerca`) che non si interroga da script: potrebbero esserci altri dati senza servizio ArcGIS.
