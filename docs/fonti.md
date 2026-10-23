# Fonti del motore nuovo: la migliore per ogni cosa

Censimento del 23/10/2026, numeri contati sul DBGT di Meda e su `data/osm/maplarge.osm`. Dove sono i file e le licenze: `docs/dati.md`.

## Priorità di Carlo
Muri, recinzioni e passi carrai: oggi sono molto sbagliati. Sono il primo pezzo del motore nuovo. Fonti: DBGT `EL_DIV` (16 728 tratti a Meda) e `ACC_PC` (4 553 passi carrai), con una tabella di traduzione dei tipi per comune (ogni rilievo li classifica a modo suo, vedi `docs/dati.md`) e le foto di Mapillary per controllare i casi dubbi (tipo `95`, "altro", che a Meda è la maggior parte).

Cosa sa il DBGT di Meda sui muri (analisi del 23/10): dove passano e la quota al piede, non l'altezza (`EL_DIV_QE` vuoto ovunque) né com'è fatto il 74% dei tratti (12 366 di tipo `95`, "altro"; il resto: 2 585 reti, 1 667 staccionate, 80 recinzioni, 18 cancellate). Dei 4 553 passi carrai 2 393 stanno entro 1,5 m da un muro o una recinzione, quasi tutti di tipo `95`.

Come rifarli (Carlo, 23/10: "dobbiamo fare diversi ragionamenti, forse anche giocando"):
- Una sola lista di barriere che unisce DBGT, OSM (`barrier=*`, ottimo dove c'è) e le recinzioni di cantiere, con una regola su chi vince dove si sovrappongono
- Il tipo: OSM dove lo dice; per gli altri una regola dal contesto (verso strada davanti a una casa, tra giardini, lungo un campo, attorno a una fabbrica) tarata su un campione di foto Mapillary; l'altezza tipica per tipo
- Aperture: un cancello carraio a ogni passo carraio vicino a un muro; capire se `ACC_INT` (3 731) sono gli ingressi pedonali
- Cosa si sfonda (reti, staccionate, siepi, transenne di cantiere) e cosa no (muri pieni)
- Ferrovie fatte bene: sede, recinzioni, sottopassi e passaggi a livello dal DBGT con le quote vere
- Controlli nella build: cancelli che non danno su una strada o un vialetto, giardini chiusi senza aperture, muri che attraversano una strada o un edificio

## Forma e quota del mondo: DBGT sul terreno LiDAR

| Cosa | Fonte | A Meda | Note |
|---|---|---|---|
| Terreno | LiDAR DTM 1 m (Ministero, 2008) | 54 tessere | TINITALY solo dove manca. Punti quotati `PT_QUO` (19 128) e scarpate `SCARPT` (926) per i controlli |
| Strade, forma | DBGT `AC_VEI` (aree di circolazione veicolare) | 6 096 aree con quota | La carreggiata vera: incroci e rotonde con la loro forma, non la larghezza stimata da OSM |
| Strade, quota | DBGT `EL_STR` (assi 3D) e `GZ_STR` (giunzioni) | 2 935 assi, 2 616 giunzioni | |
| Strade, cosa sono | OSM | | Nomi, sensi unici (4 735), limiti (2 710), corsie (2 587), classe |
| Marciapiedi e piazze | DBGT `AC_PED` | 1 151 aree con quota | |
| Ciclabili | DBGT `AC_CIC`, `EL_CIC`; OSM per i nomi | 17 aree, 14 assi | |
| Aree stradali | DBGT `AR_STR` | 2 428 aree | Da capire cosa contengono (isole, aiuole, banchine?) |
| Ponti | DBGT `PONTE_PONTE_SEDE` e la sede di `EL_STR` | 20 | OSM `bridge` come conferma |
| Gallerie e sottopassi | DBGT `GALLER`, OSM `tunnel` | 1 | |
| Ferrovia | DBGT `EL_FER`, `SD_FER` | 64 tratti, 37 sedi | OSM per stazioni, nomi, passaggi a livello |
| Acqua | DBGT `EL_IDR`, `ALVEO`, `ARGINE`, `SP_ACQ` | 69 tratti con quota, 31 alvei, 23 argini | LiDAR per la forma del letto, OSM per i nomi |
| Edifici, forma e altezza | DBGT `EDIFC` e `UN_VOL` (altezza per volume) | 3 357 edifici, 7 596 volumi | Overture solo dove non c'è DBGT |
| Edifici, cosa sono | OSM | | Uso, piani, colore e tetti dove ci sono |
| Muri e recinzioni | DBGT `EL_DIV` | 16 728 tratti | Tipi da tradurre per comune |
| Passi carrai | DBGT `ACC_PC` | 4 553 punti | |
| Alberi | DBGT `ALBERO`, filari `FIL_AL` | 12 334 alberi, 176 filari | OSM ne ha 7 962 |
| Boschi, verde, campi | DBGT `BOSCO`, `AR_VRD`, `CL_AGR` | 159, 4 049, 58 | DUSAF fuori dal DBGT, WorldCover come ultima risorsa |
| Impianti sportivi | DBGT `ATTR_SP`, OSM per lo sport | 38 | |
| Tralicci e linee elettriche | OSM; DBGT `TRALIC` per le basi | 83 tralicci, 59 linee | |

## Vita del mondo: OSM

| Cosa | Fonte | Note |
|---|---|---|
| Negozi, bar, servizi, orari | OSM | 1 301 attività, 185 con orari |
| Parcheggi | OSM | 1 964 posti, capienze |
| Nomi di luoghi e quartieri | OSM | |
| Confini comunali | OSM | |
| Numeri civici | OSM (6 432) | Da confrontare con ANNCSU |
| Stop, precedenze, semafori, strisce | OSM | 901, 408, 169, 2 430 |
| Cartelli veri | Mapillary (token in `data/mapillary_token.txt`) | OSM ne ha solo 112 |
| Lampioni | generati | OSM ne ha 181 |

Per dopo: ortofoto (Regione o AGEA, licenza da guardare) per i colori di tetti e campi; foto Mapillary per i modelli fatti a mano.

## Chi vince quando le fonti non sono d'accordo
1. Forma e quota: DBGT. Se una sua quota differisce dal LiDAR più di 1 m, va nel rapporto della build, non si corregge a mano.
2. Cos'è una cosa (nome, uso, sensi, orari): OSM.
3. DBGT vecchio (Seregno 2007, Cesano Maderno 2005): una strada o un edificio che OSM ha e il DBGT no è più recente, e vince OSM.
4. Terreno: LiDAR; TINITALY solo dove manca.

## Da verificare prima di fidarsi
- Alcune aree `AC_VEI` e `PONTE` hanno quota 0, cioè senza quota
- Cosa contiene `AR_STR`
- Se gli altri comuni hanno le stesse classi di Meda (i muri di sostegno `MU_SOS`, `MU_DIV` ci sono solo in alcuni)
