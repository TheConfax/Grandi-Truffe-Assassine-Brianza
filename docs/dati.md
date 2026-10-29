# Dati grezzi

La cartella `data/` non è in git (pesa circa 700 MB): qui c'è cosa contiene, da dove viene e chi la usa. La stessa pagina è in `data/README.md`.

Per rigenerare `brianza.json`: `python src/build.py` (con il Python della `.venv`). Controlla che ci siano tutti i file qui sotto, dice quali mancano, poi lancia `src/build_data.py` con il riquadro della mappa (S 45.6345, N 45.6805, W 9.117, E 9.191). Dura circa 4 minuti per Meda (le grandi operazioni GEOS su più core, `src/presto.py`; il terreno, `python src/terreno_gioco.py --da DIR --rigenera`, meno di uno) e dà sempre gli stessi file. La cartella dei dati si può spostare con la variabile `GTA_DATA`.

## Usate dalla build

| File | Fonte | Scaricato | Licenza | Script |
|---|---|---|---|---|
| `osm/maplarge.osm` (119 MB) | OpenStreetMap, estratto Overpass del riquadro della mappa (`osm_base` 2026-10-18T11:35Z) | 18/10/2026 | ODbL 1.0, © OpenStreetMap contributors | `build_data.py` (argomento) |
| `osm/confini_comuni.json` (0,7 MB) | OpenStreetMap via Overpass: `rel[boundary=administrative][admin_level=8](45.62,9.10,45.70,9.24);out geom;` | 20/10/2026 | ODbL 1.0 | `build_data.py` (cartelli di paese, perimetro dei DBGT) |
| `terreno/w50550_s10.tif` (100 MB) | TINITALY 1.1, INGV, foglio w50550_s10, DEM a 10 m: <https://tinitaly.pi.ingv.it/> | 19/10/2026 | CC BY 4.0, Tarquini S. et al. (2023), doi:10.13127/tinitaly/1.1 | `build_data.py` (argomento) |
| `overture/edifici_overture.geojson` (14 MB) e `.state` | Overture Maps, tema buildings, release 2026-09-23.1, riquadro della mappa (scaricato con `overturemaps`) | 18/10/2026 | ODbL 1.0 (gli edifici Overture includono dati OSM) | `build_data.py` |
| `worldcover/ESA_WorldCover_10m_2021_v200_N45E009_Map.tif` (107 MB) | ESA WorldCover 2021 v200, tessera N45E009: <https://esa-worldcover.s3.eu-central-1.amazonaws.com/v200/2021/map/ESA_WorldCover_10m_2021_v200_N45E009_Map.tif> | 18/10/2026 | CC BY 4.0, © ESA WorldCover project 2021 / Copernicus Sentinel | `wccrop.py` |
| `worldcover/wc/wc.npy`, `wc_meta.txt` (0,9 MB) | ritaglio del tif sopra, fatto da `python src/wccrop.py` | 19/10/2026 | come sopra | `build_data.py` |
| `dbt/Meda/dbgt.gpkg` (87 MB) | Regione Lombardia, Database GeoTopografico (DBGT) del comune di Meda, rilievo 2015 | 20/10/2026 | CC BY 4.0 (scheda metadati, sotto) | `build_data.py` (muri `EL_DIV`, altezze `UN_VOL`, quote delle strade `EL_STR_EL_STR_TRA_SG`) |

La build usa ogni `data/dbt/<Comune>/dbgt.gpkg` che trova, purché il nome della cartella sia quello del comune in `confini_comuni.json`. Gli altri file arrivati con il DBGT di Meda (`base_dbt_per_pianificazione.gpkg`, `Isoipse.zip`, `leggimi.txt`) stanno accanto e non li usa nessuno.

## DBGT degli altri comuni (scaricati, non ancora usati)

Il riquadro della mappa tocca nove comuni (verificato con `confini_comuni.json`): Meda 27% del riquadro, Seveso 24%, Lentate sul Seveso 13%, Seregno 9%, Cabiate 8%, Barlassina 8%, Cesano Maderno 7%, Mariano Comense 3%, Cogliate 0,1% (non scaricato).

Sono in `data/dbt/<Comune>/<COMUNE>.zip`, ancora da estrarre: la build legge solo `dbgt.gpkg`, quindi finché resta nello zip non entra nella mappa. Per usarne uno basta estrarre il suo `dbgt.gpkg` nella cartella del comune.

| Comune | Anno di rilievo | Zip | Scaricato |
|---|---|---|---|
| Meda | 2015 | 41,8 MB (già estratto) | 20/10/2026 |
| Seveso | 2015 | 38,8 MB | 23/10/2026 |
| Lentate sul Seveso | 2021 | 26,8 MB | 23/10/2026 |
| Cabiate | 2021 | 12,2 MB | 23/10/2026 |
| Barlassina | 2018 | 9,3 MB | 23/10/2026 |
| Mariano Comense | 2015 | 34,6 MB | 23/10/2026 |
| Seregno | 2007 | 42,5 MB | 23/10/2026 |
| Cesano Maderno | 2005 | 30,5 MB | 23/10/2026 |

- Download diretto per comune: `https://www.geoportale.regione.lombardia.it/rlregis_download/service/package?dbId=514&cod=<codice ISTAT senza zeri davanti>` (Meda 108030, Seveso 108040, Lentate 108054, Cabiate 13035, Barlassina 108005, Mariano 13143, Seregno 108039, Cesano 108019, Cogliate 108020). Il link e l'anno di rilievo vengono dal servizio `DBGT_Inquadramento` del Geoportale (campi `DOWNLOAD` e `ANNO_RIL_AGG`).
- Scheda metadati: <https://www.geoportale.regione.lombardia.it/metadati?p_p_id=detailSheetMetadata_WAR_gptmetadataportlet&p_p_lifecycle=0&p_p_state=normal&p_p_mode=view&_detailSheetMetadata_WAR_gptmetadataportlet_identifier=r_lombar%3A0092b7ba-c697-433b-b5f2-9f9d9b8694e3&_jsfBridgeRedirect=true> (r_lombar:0092b7ba-c697-433b-b5f2-9f9d9b8694e3, revisione 2023-02-15, scheda aggiornata il 2026-10-06). Limitazioni d'uso: <https://creativecommons.org/licenses/by/4.0/legalcode.it>, cioè CC BY 4.0. Accesso: nessuna limitazione. Né IODL 2.0 né CC BY-NC-SA.
- Sono fatti come quello di Meda: stesso zip (`dbgt.gpkg`, `base_dbt_per_pianificazione.gpkg`, `Isoipse.zip`, `leggimi.txt`), GeoPackage in EPSG:7791 (RDN2008 / UTM 32N) con le quote Z, le tre tabelle che usa la build ci sono tutte e gli assi stradali hanno la quota. Le differenze: ogni comune contiene solo le classi che ha rilevato (93-111 tabelle), e chi ha fatto il rilievo ha classificato i muri a modo suo. A Meda e Seveso quasi tutto è `95` (altro), a Seregno e Cesano Maderno quasi tutto è `18` (staccionata), a Lentate e Barlassina `17` (recinzione), a Cabiate e Mariano molte `02` (cancellata) e a Mariano 2683 `19` (siepi). Prima di usarli va controllato che quei tipi corrispondano a quello che si vede. Seregno (2007) e Cesano Maderno (2005) sono rilievi vecchi: a Cesano solo 8940 volumi su 14093 hanno l'altezza.

## Terreno più fine

- **DTM 5×5 della Regione Lombardia, edizione 2015.** Esiste. Formato ERDAS IMAGINE (`.img` + `.ige`), 5 m, WGS84 / UTM 32N, tutta la regione. Le quote vengono per l'80% dal DBT (curve di livello, punti quotati, linee di rottura; nelle aree urbane rilevate a 1:2000 la precisione in quota è 0,30 m), lungo i fiumi dal LiDAR a 1 m. Licenza CC BY 4.0. Scheda: r_lombar:dfc98d60-5f02-4a2b-8113-5ad24cc53a9c. Download: <https://www.cartografia.servizirl.it/download/DTM5_RL.zip>, 3,09 GB (8,3 GB estratto). Non si può ritagliare dallo zip: è un unico file compresso.
- **LiDAR del Ministero dell'Ambiente (PST-A), DTM a 1 m: usato dalla build al posto di TINITALY dove c'è.** Copre tutto il riquadro della mappa, margine compreso. Voli del 25/10, 15/11 e 16/11/2008 (contratto 140), qualche tessera del 7 e 10/07/2010 (contratto 145). Licenza CC BY 4.0. Sulle strade di Meda coincide con le quote del DBGT entro 0,1 m; TINITALY invece sbaglia fino a 7 m in centro.
  - Non c'è un servizio che dia il raster: il WCS del Ministero è vuoto, WMS ed export ArcGIS danno solo immagini colorate. Le tessere si scaricano dall'app <https://sim.mase.gov.it/portalediaccesso/mappe/#/viewer/new> (istruzioni: <https://gn.mase.gov.it/portale/distribuzione-dati-pst>), senza login: Catalogo, "Dati LiDAR grigliato 1x1", Seleziona l'area di interesse, poligono, Aggiungi al carrello, Carrello, freccia di download. Si apre una pagina con un file zip per prodotto (DTM, DSM First, DSM Last): per il terreno serve il **DTM**; per i tetti serve anche il **DSM First** (primo ritorno del laser, sopra edifici e alberi). Scaricato il 23/10/2026: `data/terreno/lidar_pst_dtm_1x1_88d08de1.zip` (216 MB, 54 GeoTIFF `lombardia_140_D…_0101_DTM.tiff` da 1000 × 1000 celle di 0,00001°, EPSG:4326, PixelIsPoint), estratto in `data/terreno/lidar/`.
  - Servono 54 tessere da 0,01° × 0,01°, circa 190 MB: `D4563` … `D4568` (latitudine 45,63-45,69) per `0911` … `0919` (longitudine 9,11-9,20), cioè da `D45630911_0101` a `D45680919_0101`. L'elenco viene dal WFS dei quadri d'unione: <http://wms.pcn.minambiente.it/ogc?map=/ms_ogc/wfs/QU_Lidar.map>, tipo `EL.QUADRO.UNIONE.LIDAR.0101`.
  - Vanno estratte in `data/terreno/lidar/` (anche in sottocartelle). La build legge GeoTIFF o ASCII grid, in gradi o in UTM 32N. `python src/build.py` dice quante tessere trova e quali mancano. Ogni nodo della griglia di 10 m prende la media delle celle da 1 m intorno, e al bordo della copertura il LiDAR sfuma in TINITALY su 200 m.
  - **DSM First**, scaricato il 24/10/2026 dallo stesso carrello (poligono `c3c0f041…`, file 1668567: `https://sim.mase.gov.it/core/api/pst-ms/download/c3c0f041aa5d46d9be2bf00421bd2ef0/1668567`, 216 MB, senza login): `data/terreno/lidar_dsm/lidar_pst_dsm_first_1x1_88d08de1.zip`, estratto nella stessa cartella (54 GeoTIFF `lombardia_140_D…_0101_DSMFirst.tiff`, stessa griglia del DTM). DSM − DTM dà l'altezza di edifici e alberi; il volo è del 2008, gli edifici più recenti mancano. Il DSM Last (file 1668568) non serve.
  - Per controllare un punto senza scaricare niente c'è l'identify del servizio ArcGIS: <http://www.pcn.minambiente.it/arcgis/rest/services/dtm/LiDAR_Lombardia/MapServer/identify> (layer 8, `Grid 1x1 DTM`).

## Mapillary (cartelli, lampioni, semafori, pali e cestini usati dal 29/10, `src/mapillary_obj.py`)

- `mapillary/oggetti.json` (1 MB): 3 469 oggetti riconosciuti nelle foto sul riquadro della mappa, di cui 1 100 cartelli (626 di obbligo e divieto, 126 di pericolo, 339 di indicazione, 9 complementari), più lampioni, semafori, pali, cestini (1 960), segni a terra (218) e cose da cantiere (87). Per ognuno: tipo, posizione, direzione, prima e ultima foto in cui compare.
- `mapillary/foto.json` (3 MB): l'elenco delle 12 163 foto (posizione, data, direzione, autore). Sono vecchie: l'80% del 2018-2019, dal 2023 solo 350. Per i cartelli vuol dire la situazione di 6-7 anni fa: vanno incrociati con OSM.
- Come entrano (regole generali, stesse per ogni comune, controlli in `report.mapillary` di `brianza.json` e in `src/prove_fisse.py`): solo classi con un modello nel gioco (stop, precedenza, senso vietato, limiti, rotatoria, passaggio obbligatorio, dritto, divieto di sosta e di fermata, mezzi pesanti, attraversamento pedonale, parcheggio, senso unico); le altre (indicazioni, pericolo, `general--traffic-sign`) no. Il file non dice in quante foto è stato visto un oggetto (prima e ultima vista coincidono nel 90%): entra se ha una seconda vista, o è dal 2023, o un altro riconoscimento uguale sta entro 8 m, o il posto lo conferma (stop, precedenza e rotatoria prima di un incrocio; attraversamento pedonale vicino a uno di OSM); lampioni e pali anche se in fila con altri. `aligned_direction` è il verso in cui guarda la faccia: chi guida va nel verso opposto. Il cartello va sul bordo della via giusta (coerente con la direzione), a destra di chi guida; mai sulla carreggiata, in un edificio o su un muro. Con OSM: stesso tipo vicino = lo stesso cartello (resta OSM), tipo in contrasto della stessa famiglia = vince OSM. Semafori: l'incrocio vicino diventa con semaforo se OSM non lo ha. Pali generici (`support--pole`) non usati: non si sa che sostegno siano.
- Scaricato il 23/10/2026 dalla Graph API v4 (`map_features` e `images`, a tessere da 0,01°) con lo script nella scratchpad della sessione; il token è in `mapillary_token.txt` (non va in git). Licenza CC BY-SA 4.0, © Mapillary e i suoi contributori.

## Non usati da nessuno script

- `_vecchi/map.osm` (2,5 MB): primo estratto OSM dal sito di openstreetmap.org (17/10/2026), un riquadro di circa 1,3 × 0,7 km sul centro di Meda. Sostituito da `osm/maplarge.osm`.
- `_vecchi/MEDA.zip` (42 MB): lo zip originale del DBGT di Meda, già estratto in `dbt/Meda/`. È identico a quello che si scarica oggi.
- `_vecchi/segnalazioni-*.json`: segnalazioni esportate dal gioco (19/10/2026), non sono dati di mappa.

`src/segnaletica_osm.py` non legge niente da `data/`: usava degli estratti `t*.xml` che non sono stati salvati (vedi `todo.md`, Segnaletica).
