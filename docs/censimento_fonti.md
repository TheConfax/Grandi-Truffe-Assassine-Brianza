# Censimento delle fonti aperte per GTA Brianza (31/10/2026)

Fatto solo con ricerca web e qualche richiesta di conteggio ai servizi (niente download di dati). "Non verificato" = non sono riuscito a leggerlo alla fonte vera.

## In cima

**Le 5 da aggiungere per prime**
1. **DUSAF 7.0 (Regione Lombardia, 2021)**: uso del suolo vero (campi, prati, orti, parchi, cantieri, cave) al posto di WorldCover a 10 m. Nel riquadro di Meda ci sono 1 122 poligoni. Dentro c'è anche lo strato "Filari e siepi" (359 elementi a Meda), che il DBGT non ha. Licenza CC BY 4.0 secondo una fonte di seconda mano: da confermare sulla scheda.
2. **Particelle catastali (Agenzia delle Entrate, CC BY 4.0)**: i confini delle proprietà. Dicono dove corrono davvero muri, recinzioni e siepi dove il DBGT è vecchio (Seregno 2007, Cesano 2005, Bovisio 2005). Copre tutta l'Italia.
3. **Numeri civici ANNCSU (ISTAT + Agenzia Entrate, open data mensile)**: sono già in parte in OSM (6 432 a Meda) ma ANNCSU è il registro ufficiale e riempie i buchi. Licenza esatta non verificata.
4. **Overture Places (CDLA Permissive 2.0)**: negozi e luoghi da incrociare con i 1 301 di OSM. Copertura su Meda non verificata. Il pacchetto edifici lo usiamo già con lo stesso strumento, quindi il costo è basso.
5. **Wikidata + Wikimedia Commons**: 262 voci con coordinate nel riquadro di Meda e 454 foto di Commons entro 5 km dal centro. Servono alla missione delle foto e ai luoghi notevoli. Wikidata è CC0. Commons ha licenze diverse file per file.

**Cose che abbiamo già e non usiamo**
- `data/mapillary_grande/` (17 168 oggetti, 67 078 foto): scaricato, non letto da nessuna build. Quello di Meda invece lo legge `src/mapillary_obj.py` (la voce 3 di `todo.md` è da aggiornare).
- DBGT di 30 comuni attorno a Meda: 8 scaricati prima più 22 nuovi, zip non estratti. La build legge solo `dbgt.gpkg`.
- `overture/edifici_mappa_grande.geojson` e `osm/mappa_grande.osm`: pronti, non letti dalla build di Meda.
- LiDAR: 54 tessere su 170 per la mappa grande. Le altre 116 non si scaricano perché il portale del Ministero ha la manutenzione fino al 6/11.
- Il DBGT ha 106 tabelle e la build non le legge tutte. Non sono solo tre: il codice ne cita molte di più (fra cui `AC_VEI`, `AC_PED`, `AR_STR`, `EL_STR`, `EL_FER`, `EL_IDR`, `PONTE`, `GALLER`, `MAN_TR`, `PS_INC`, `FIL_AL`, `EL_DIV`, `UN_VOL`). L'elenco di quelle non usate è da fare. Da controllare anche se `FIL_AL` e le siepi `EL_DIV` tipo 19 coprono già lo strato "Filari e siepi" di DUSAF, che qui sopra è detto mancante nel DBGT.

## Tabella

Legenda "Entra nel gioco": SI = licenza compatibile; RIF = solo riferimento, non entra; ? = da confermare.
Legenda "Build": SI = la build la usa oggi; no = non la usa.

| Fonte | Cosa dà al gioco | Licenza / entra? | Copertura Meda / mappa grande | L'abbiamo? | Build | Conviene |
|---|---|---|---|---|---|---|
| [DUSAF 7.0, uso del suolo 2021](https://www.geoportale.regione.lombardia.it/) (servizio [`territorio/dusaf7`](https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio/dusaf7/MapServer)) | Cos'è davvero ogni pezzo di terra (seminativo, prato, orto, parco urbano, cantiere, cava, verde incolto). Strato "Filari e siepi" | CC BY 4.0 secondo il plugin QGIS che lo usa; scheda del Geoportale non letta (certificato scaduto sul catalogo INSPIRE): **da confermare**. ? | Meda: 1 122 poligoni e 359 filari/siepi (conteggio fatto sul servizio). Tutta la Lombardia | No | no | **Alta**: oggi fuori dal DBGT il verde viene da WorldCover a 10 m, cioè quadrettato; qui sono poligoni veri, aggiornati al 2021 |
| [Particelle catastali, Agenzia delle Entrate](https://www.agenziaentrate.gov.it/portale/cartografia-catastale) (WFS/GML per comune, servizio aperto da feb 2025) | Confini di proprietà: dove stanno davvero i muri tra giardini, se un giardino è chiuso, lotti agricoli | CC BY 4.0, citare l'Agenzia (da notizie e comunicato AdE 2020; testo della licenza non letto). SI se confermato | Tutta l'Italia, quindi Meda e la mappa grande. Aggiornamento semestrale | No | no | **Alta**: è l'unica fonte omogenea per le recinzioni dei comuni col DBGT vecchio (2005-2007) |
| [ANNCSU, numeri civici e strade](https://www.anncsu.gov.it/it/consultazione-dellarchivio/open-data/) | Civici ufficiali con posizione; nomi delle vie ufficiali | "Formato aperto" per il Regolamento UE 2023/138; **licenza non scritta sulla pagina**: non verificato. CSV in zip, mensile, per regione o Italia | Georeferenziati completamente in 4 304 comuni (dato di marzo 2026). Meda: non verificato | No | no | **Media/alta**: OSM ha già 6 432 civici a Meda; serve per i buchi e per controllare i nomi delle vie |
| [Overture Places](https://docs.overturemaps.org/attribution) | Negozi, bar, servizi, categorie e nomi, da incrociare con OSM | CDLA Permissive 2.0 (dati da Meta e Microsoft); se derivati da OSM, ODbL. SI con attribuzione. Dubbio aperto in comunità OSM sulla compatibilità | Mondiale. Italia: 2,48 milioni di luoghi secondo un sito terzo; **Meda non verificato** | No (gli edifici sì) | no | **Media**: i luoghi di OSM sono 1 301, ma 185 con orari; i luoghi Overture portano solo nome e categoria, mai gli orari. Serve solo se OSM è povero in un quartiere |
| [Wikidata](https://query.wikidata.org/) | Luoghi notevoli (ville, chiese, monumenti) con nome, data, collegamento a Wikipedia e foto | CC0. SI | 262 voci con coordinate nel riquadro di Meda (conteggio fatto) | No | no | **Media/alta**: costa poco ed è la base per la missione "trova il posto della foto" |
| [Wikimedia Commons, foto geolocalizzate](https://commons.wikimedia.org/wiki/Commons:Geocoding) | Foto di luoghi veri (missione foto, controllo a vista), disegni | Per file: CC BY-SA, CC BY, pubblico dominio. Va letta la licenza di ogni file (già fatto per i cartelli). ? | 454 file entro 5 km dal centro di Meda (conteggio fatto) | Solo i cartelli stradali | SI (cartelli) | **Media**: ottima per la missione foto, da usare come immagini di riferimento |
| [Alberi monumentali d'Italia (MASAF)](https://www.masaf.gov.it/) e [elenco della Regione](https://www.regione.lombardia.it/content/dam/rl/canali-tematici-servizi/06-ambiente-e-territorio/05-biodiversita/alberi-monumentali/allegati/dgr-4536-2025-censimento-alberi-monumentali-aggiornamento-2025.pdf) | Alberi con nome e grandezza speciale (3-4 a Meda forse) | CC BY 4.0 secondo il plugin QGIS e una discussione OSM; non letto alla fonte. Elenco regionale: 431 voci + 48 (DGR 4536/2025). ? | Italia (4 749 alberi) / Lombardia; quanti a Meda: non verificato | No | no | **Bassa**: pochi alberi, ma sono "luoghi" belli da mostrare nelle missioni naturalistiche |
| [Ortofoto 2021/2018-19 AGEA (Regione Lombardia)](https://www.regione.lombardia.it/ambiente-e-territorio/infrastruttura-dati-territoriali-idt/consultazione-e-distribuzione-delle-foto-aeree-e-dei-rilievi-lidar) | Colori reali di tetti, campi, strade; controllo a vista | AGEA tiene i diritti; Regione la usa "per finalità istituzionali", solo vista e stampa, vietato cederla a terzi. **Non entra.** RIF | Lombardia intera | Solo qualche finestra (`manufatti_foto.py`) | SI (solo riferimento) | **Solo riferimento**: va bene per guardare e dedurne una regola, non per colorare il gioco con i suoi pixel |
| Esri World Imagery (z19 di Meda) | Guardare a 0,2 m | Termini Esri, uso interno. RIF | Mondiale | Si (cache di Meda) | SI (solo riferimento) | Già in uso come riferimento |
| [ESA WorldCover 2021](https://esa-worldcover.org/) | Copertura del suolo a 10 m | CC BY 4.0. SI | Tutto, anche mappa grande | Si | SI | Resta come ultima risorsa dove manca DUSAF/DBGT |
| [Copernicus HRL: Tree Cover Density e Imperviousness 2018 (10 m)](https://land.copernicus.eu/) | Densità di alberi e di asfalto/cemento | Accesso libero e gratuito; strati Foresta indicati CC BY 4.0 da un mirror ceco; scarico con registrazione. ? | Europa | No | no | **Bassa**: il DSM-DTM del LiDAR e il DBGT fanno già meglio sulle alberature a Meda |
| [Meta/WRI Canopy Height 1 m](https://registry.opendata.aws/dataforgood-fb-forests/) | Altezza degli alberi da satellite | CC BY 4.0 (registro AWS) | Parti del mondo; Europa e Meda: non verificato | No | no | **Bassa**: il LiDAR (DSM First - DTM) ha già l'altezza vera degli alberi |
| [Copernicus DEM GLO-30](https://dataspace.copernicus.eu/) | Quote a 30 m | Libero con attribuzione | Mondiale | No | no | Scartata (vedi sotto) |
| [TINITALY 1.1](https://tinitaly.pi.ingv.it/) | Quote a 10 m | CC BY 4.0. SI | Nord Italia | Si | SI | Resta come ripiego fuori dal LiDAR |
| [LiDAR PST-A, Ministero (DTM e DSM 1 m)](https://sim.mase.gov.it/portalediaccesso/mappe/#/viewer/new) | Quote vere del terreno e altezze di alberi e tetti | CC BY 4.0. SI | Meda 54 tessere su 54. Mappa grande: 116 mancano (portale in manutenzione fino al 6/11, non verificato) | Parziale | SI | Già in uso; completare per la mappa grande |
| [DTM 5 m Regione Lombardia 2015](https://www.geoportale.regione.lombardia.it/) | Quote a 5 m | CC BY 4.0. SI | Lombardia | No | no | **Bassa**: il LiDAR a 1 m è meglio; serve solo come ripiego se le 116 tessere non arrivano |
| DBGT Regione Lombardia (Meda 2015 e altri 29 comuni) | Forme e quote di strade, edifici, muri, ferrovia, acqua | CC BY 4.0. SI | Meda estratto; 29 comuni scaricati e non estratti | Si | SI (solo Meda) | **Alta**: vedi "abbiamo e non usiamo" |
| [Servizi Regione `LOM_WMS3_Trasporti` e `ReticoloIdrografico_RIRU`](https://www.cartografia.servizirl.it/arcgis1/rest/services/territorio) | Rete stradale e ferroviaria regionale, reticolo idrico regionale con nomi | Licenza non verificata. ? | Lombardia | No | no | **Bassa**: strade e ferrovia sono già in DBGT e OSM; il reticolo RIRU serve solo a controllare i nomi dei torrenti |
| [OpenStreetMap (Geofabrik 28/10)](https://download.geofabrik.de/europe/italy/nord-ovest.html) | Attributi: nomi, sensi, negozi, orari, civici | ODbL. SI con attribuzione | Tutto | Si (Meda e mappa grande) | SI (Meda) | Già in uso |
| [Overture edifici](https://docs.overturemaps.org/attribution) | Edifici fuori dal DBGT, altezze ML | ODbL | Tutto | Si (Meda e grande) | SI (Meda) | Già in uso |
| [Mapillary](https://www.mapillary.com/) | Cartelli, lampioni, semafori, pali, cestini; foto | CC BY-SA 4.0. SI | Meda 3 469 oggetti; grande 17 168 | Si | SI (Meda), no (grande) | Già in uso; usare anche quello grande |
| [Panoramax](https://wiki.openstreetmap.org/wiki/Panoramax) | Foto di strada aperte, alternativa a Mapillary | CC BY-SA 4.0 (wiki OSM) | **Zero foto nel riquadro di Meda** (una sola richiesta all'API di panoramax.xyz) | No | no | **Bassa** oggi: non c'è copertura |
| [ISTAT basi territoriali 2021 e sezioni di censimento](https://www.istat.it/notizia/basi-territoriali-e-variabili-censuarie/) | Residenti per sezione: quanta gente a piedi e quanto traffico mettere per quartiere | CC BY 4.0. SI | Italia, per sezione. Tabella dei residenti per sezione: link non verificato | No | no | **Media**: dà un modo oggettivo di decidere quanti pedoni e auto generare |
| [Open Lombardia: stazioni di qualità dell'aria ARPA](https://www.dati.lombardia.it) | Dati orari di PM10, NO2... per stazione e stime per comune | CC0. SI | Lombardia; stazioni vicino a Meda: non verificato | No | no | **Bassa**: solo se un giorno si vuole la foschia reale |
| [Open Lombardia: rilievi di traffico](https://www.dati.lombardia.it) | Conteggi di auto per sezione | CC0 (Città metropolitana di Milano 2015-2016) e CC BY 4.0 (stazioni storiche) | Provincia di Milano, fino al 2016. Meda è in Monza-Brianza: **non verificato che ci siano punti** | No | no | **Bassa**: il progetto vuole "frequenze adatte al gioco", non conteggi reali |
| [GTFS Trenord (treni e bus) su Open Lombardia](https://mobilitydatabase.org/feeds/gtfs/mdb-855) | Orari e fermate dei treni di Meda | Licenza non scritta sulla scheda: non verificato. Feed del 4/8/2026, valido fino al 12/12/2026 | Lombardia; 63 linee treno e bus | No | no | **Bassa**: il piano dice niente orari veri, solo frequenze. Servirebbe solo per il numero di treni all'ora |
| [Catalogo generale dei beni culturali (MiC)](https://catalogo.cultura.gov.it) | Schede di ville, chiese, monumenti | Metadati CC BY 4.0; altre fonti dicono CC BY-NC-SA: **in contrasto, non entra finché non si chiarisce**. ? | Italia; non verificato per Meda | No | no | **Bassa**: Wikidata e OSM danno già i luoghi notevoli con licenza chiara |
| [Volo GAI 1954 (Regione Lombardia, proprietà IGM)](https://www.cartografia.servizirl.it/arcgis2/services/BaseMap/Lombardia_GAI_UTM32N/MapServer/WMSServer) | Come era Meda nel 1954 (storia, curiosità) | Nessuna licenza trovata; non scaricabile. RIF | Lombardia (WMS) | No | no | **Bassa**: solo se un giorno si fa una modalità storica |
| [Poly Haven](https://polyhaven.com/license) | Texture di asfalto, erba, mattoni, cielo, modelli 3D | CC0. SI | Mondiale | No | no | **Media**: utile ai materiali "fotorealistici" dei muri e delle strade, senza obbligo di crediti |
| Open-Meteo (meteo e storico) | Meteo vero | CC BY 4.0 (API gratuita non commerciale) | Mondiale | No | no | Non verificato alla fonte |

## Fonti scartate

- **Ortofoto AGEA 2021, 2018-19 e 2012-15 come dato nel gioco**: i diritti sono di AGEA, solo uso istituzionale e vietato cederle a terzi. Restano riferimento per guardare, mai nei pixel del gioco.
- **Copernicus DEM GLO-30**: 30 m, peggio del LiDAR a 1 m e di TINITALY a 10 m. E dal 28/07/2026 il servizio di visualizzazione è riservato a certe categorie di utenti.
- **Overture in generale per i colori**: i colori dei tetti non ci sono nei dati aperti, vengono dalle ortofoto (vietate sopra).
- **Orari reali di bus e treni**: scelta del progetto (frequenze adatte al gioco).
- **Conteggi di traffico di Milano 2015-2016**: fermi al 2016 e fuori dalla Brianza.
- **Panoramax per ora**: zero foto nel riquadro. Da ricontrollare tra un anno.
- **Google Street View e Google Earth**: licenza chiusa, solo riferimento a mano di Carlo.
- **KartaView e altri servizi di foto di strada**: non verificato. Ne sapevo l'esistenza ma non ho trovato la copertura su Meda; il tempo non bastava.
- **Catasto storico (Teresiano, Lombardo-Veneto)**: non cercato in dettaglio; serve solo a una modalità storica.

## Cosa non ho potuto verificare
- La licenza di DUSAF alla scheda del Geoportale (il catalogo INSPIRE dava certificato scaduto): solo da seconda mano.
- La licenza ANNCSU e la copertura dei civici di Meda; i file reali.
- Overture Places su Meda (numero e qualità); ho solo la licenza.
- La licenza del GTFS Trenord e dei servizi RIRU e Trasporti della Regione.
- Alberi monumentali a Meda: quanti sono e la loro licenza alla fonte.
- Se in Panoramax o altri servizi aperti esiste qualcosa vicino a Meda oltre ai conteggi fatti.
- Open-Meteo e Copernicus HRL alla fonte; Meta Canopy Height su Meda.
- Il Catasto: il testo della licenza e il formato per Meda; la fonte è un comunicato di stampa AdE del 2020 e notizie del 2025.
- Il portale del Ministero per il LiDAR: se la manutenzione finisce davvero il 6/11.
