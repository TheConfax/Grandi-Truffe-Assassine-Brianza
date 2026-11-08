# Le superfici del suolo: censimento e regole (6/11/2026)

Carlo (3/11): "dobbiamo cercare tutte le superfici e come cazzo sono assegnate". Qui c'è ogni tipo di suolo che entra nella build, da dove viene,
che aspetto prende nel gioco, con quale regola e quanto copre in Meda+Seveso. I numeri si rifanno con gli script descritti in fondo.

## Come arriva il suolo al gioco

1. `src/build_data.py` mette in ogni tile poligoni con una chiave: `a` (aree, col tipo `t`), `as` (carreggiate), `pz` (piazze e aree pedonali),
   `sd` (marciapiedi), `ft` (vialetti), `cv` (cortili e accessi AC_VEI 0307), `sf` (massicciata), `md` (isole), `ls` (terreni vestiti da
   `paesaggio3.js`). Dal 6/11 `as`, `pz`, `ft`, `cv` e le aree `a` di tipo 17 possono avere `m`, il materiale (`src/fondi.py`).
2. `src/world3.js` `cellOwners` (le celle intere di S) e i drappi `polyFill` (il resto) disegnano ogni poligono con l'aspetto della sua chiave;
   vince il rango più alto: aree 1-2, cortili AATT 1.1, cortili AC_VEI 1.2, massicciata 1.3, piazze OSM 4, vialetti 3, carreggiate 5, piazze 5.1,
   poi marciapiedi (gradino) e terreni di `paesaggio3.js`.
3. Dove nessun poligono copre il suolo resta il **terreno nudo** (`MAT.terrainS`, la foto `tex/terreno.jpg`, prato e terra): questo è il colore
   neutro vero, il suolo di cui i dati non dicono niente.

## Censimento: Meda+Seveso, 12,68 km² di suolo (edifici esclusi)

Aspetto visibile (lo strato più alto) metro per metro. "Prima" = build 5/11 di `dev`; "dopo" = ramo `superfici`.

| Superficie nel gioco | Fonte e regola | Aspetto | Prima m² | Dopo m² |
|---|---|---|---:|---:|
| Prato (area 1) | DBGT AR_VRD 01/02/04/07/95, PS_INC 01/05, CL_AGR 05 (`dbgt_verde.py:25-36`); OSM grass/meadow/village_green (`build_data.py:361`); WorldCover 30 fuori da OSM e DBGT (`build_data.py:102`) | `grassTex` (`world3.js` cellOwners `a.t <= 3`) | 3.570.498 | 3.570.607 |
| Bosco (11) | DBGT BOSCO, AR_VRD 03, CL_AGR 04; OSM forest/wood; WorldCover 10 | prato scuro `#7d9a6a` + alberi | 1.852.689 | 1.852.692 |
| Cortili e accessi AC_VEI 0307 (`cv`) | DBGT AC_VEI ZON 0307 (`dbgt_strade.py:33`, `:944`) | asfalto (Carlo 2/11) | 1.733.019 | 1.671.875 asfalto, 55.257 ghiaia (FON 02), 4.312 pavimentato, 899 terra, 729 porfido e ciottoli (OSM) |
| Carreggiate (`as`) | DBGT AC_VEI (non 0307); OSM fuori dal DBGT (`dbgt_strade.py:943`) | asfalto | 1.693.597 | 1.645.247 asfalto, 37.229 ghiaia, 4.942 terra, 2.270 porfido, 2.062 ciottoli, 985 masselli, 839 pavimentato |
| Incolti (18) | DBGT PS_INC 04 (`dbgt_verde.py:37`) | `incoltoTex` | 1.067.027 | 1.067.011 |
| Residenziale (16) | OSM landuse=residential dove sotto non c'è altro (`build_data.py:361`) | prato chiaro `#d2e2b2` | 915.112 | 915.099 |
| Campi (`ls` campo) | DBGT CL_AGR 06/07, OSM farmland (`build_data.py:402`) | solchi di `paesaggio3.js` | 557.852 | 557.852 |
| Terreno nudo | nessuno strato | `tex/terreno.jpg` (neutro) | 371.333 | 371.465 |
| Marciapiedi (`sd`) | DBGT AC_PED 01/03; OSM fuori dal DBGT | masselli (`tex/marciapiede.jpg`) con cordolo | 151.125 | 151.125 |
| Cantieri (7) | OSM landuse=construction | asfalto tinto `#a88f6c` | 112.123 | 112.126 |
| Cortili AATT (17) | DBGT AATT (`dbgt_manufatti.py:396`); il DBGT non dice il materiale | grigio liscio `#b9b5ac` senza texture (prima); pavimentato neutro e materiale dalla foto (dopo) | 109.653 | 75.407 pavimentato (foto), 19.921 prato (foto), 11.095 terra (foto), 3.236 neutro senza foto |
| Sport (`ls` sport:) | DBGT ATTR_SP + sport e fondo da OSM (`dbgt_verde.py:40`) | campi disegnati da `paesaggio3.js` | ~96.000 | ~96.000 |
| Cespugli (12) | DBGT BOSCO 04, OSM scrub | `#c9d7a8` | 87.400 | 87.400 |
| Vialetti (`ft`) | DBGT AC_PED 06/07, AC_CIC, AR_VMS; OSM footway/path/cycleway fuori dal DBGT (`dbgt_strade.py:618`, `:925`) | beige liscio `#c8b89c` (prima); materiale o pavimentato neutro (dopo) | 84.778 | 28.479 ghiaia (AR_VMS, OSM), 17.818 pavimentato (AC_PED, AC_CIC, foto), 15.502 terra (OSM, foto), 7.996 asfalto (OSM), 1.000 altri, 14.035 neutro |
| Massicciata (`sf`) | DBGT SD_FER a raso | `gravelTex` | 80.998 | 80.999 |
| Piazze e aree pedonali (`pz`) | DBGT AC_PED 04/05/08/09/10/95; OSM pedestrian fuori dal DBGT (`dbgt_strade.py:617`, `:942`) | porfido (`tex/porfido.jpg`) | 44.837 | 43.352 porfido, 1.458 da OSM (ghiaia, pavimentato, asfalto, ciottoli) |
| Scuole (15) | OSM amenity=school/kindergarten | prato `#d6e2b4` | 38.497 | |
| Isole e spartitraffico (`md`) | DBGT MAN_TR 01-03 (verde da 12 m²) | prato / pavimentate | 20.957 | |
| Zone industriali e commerciali OSM (8, 9) | OSM landuse=industrial/retail/commercial | asfalto tinto | 21.168 | |
| Cimiteri (14) | OSM | prato `#c3cdb6` | 18.221 | |
| Parcheggi OSM (4) | OSM amenity=parking | asfalto tinto `#7b7c7a` | 16.983 | |
| Piste, frutteti, vivai, orti, piscine, prato `ls` | OSM e DBGT (`build_data.py:402-412`) | `paesaggio3.js` | ~27.500 | |
| Parchi (2), acqua (6), coltivi (13), campi (3) | OSM, DBGT | prato chiaro, acqua | ~6.900 | |

Note sul "prima":
- **Terreno nudo**: 265.000 m² stanno a nord fuori dal riquadro dei dati (non ci sono tile); 106.000 m² dentro, in 12.830 pezzi: soprattutto i letti
  di Seveso, Certesa e Tarò (la riga rossa lungo i fiumi in `censo_prima_neutro.png`), le strisce fra due strati e la cava di x -1119 z -778
  (OSM landuse=quarry, che nessuna regola riconosce).
- **Cortili AATT**: il grigio liscio è il neutro che si vedeva bianco (la piazza di via Indipendenza x 369 z -456: AATT 95 "altro" con sopra
  i vialetti beige delle footway OSM). Il DBGT dice solo "cortile, corte, spazio interno, altro".
- **Vialetti**: il beige liscio era un colore scelto, non un materiale: AR_VMS sono carrarecce (sterrato), AC_PED e AC_CIC hanno FON 01
  "pavimentato".
- **AC_VEI_FON 02** "non pavimentato" (Meda 175 pezzi, Seveso 51: cortili e qualche carreggiata) era disegnato in asfalto.
- **Residenziale OSM**: è una zona, non un suolo, ma la foto aerea gli dà lo stesso colore dei prati (luce mediana 56 contro 57, verde sul
  rosso +10 contro +11): lì il prato chiaro va bene e resta.
- **Piazze in porfido**: il DBGT non dice il materiale (AC_PED_FON è sempre 01, "pavimentato"); il porfido è una scelta del gioco. Resta finché
  OSM non dice altro (domanda per Carlo in fondo).

## Le regole del 6/11 (`src/fondi.py`)

Il materiale di un pezzo, in quest'ordine, senza coordinate scritte a mano:
0. **Correzioni locali di OSM** (`src/correzioni_osm.json`): tag di una via sbagliati dal vero (way, tag giusto, motivo, fonte), applicati da
   `build_data.py` subito dopo la lettura del file OSM, prima di ogni regola. OSM online non si tocca. Oggi una: via Monte Rosa (way 96763937)
   surface=sett → asphalt (Carlo 6/11, visto dal vero).
1. **OSM `surface=*`** della via o dell'area che sta sopra il pezzo. Solo vie del genere giusto: le carreggiate prendono le vie per auto, i
   vialetti le pedonali e ciclabili, le piazze le pedonali e le aree. Per le **carreggiate** (dal 6/11 sera) ogni punto va alla via per auto
   più vicina (Voronoi dei punti degli assi ogni 2 m, entro 20 m da una via con surface=*): il confine è a metà fra due assi, dove cambia la
   strada, così una piazza in ciottoli è tutta in ciottoli e la via d'asfalto che la attraversa resta d'asfalto (prima: la sede di 6 m sull'asse,
   una striscia di ciottoli fra chiazze d'asfalto in piazza Vittorio Veneto). Dove il DBGT ha le celle della carreggiata (AC_VEI) il confine
   segue il loro bordo (Carlo 7/11, via Garibaldi: i ciottoli entravano nell'incrocio con un taglio obliquo): un incrocio, una rotonda o una
   piazza veicolare (02xx) prende intero il materiale della via che ci corre per più metri; in un'altra cella un materiale entra solo se una sua
   via ci corre e non è solo una via di servizio (corsia di parcheggio, accesso, carraia) dentro la cella di una strada vera (Carlo 7/11, via
   Indipendenza x 824 z -87: gli autobloccanti di un parcheggio attraversavano la carreggiata; erano 8 celle, 959 m² in Meda e Seveso, dopo 0), e se
   la copre per il 60% la prende intera; un pezzetto d'asfalto fino a 300 m² chiuso per metà del contorno da un materiale
   prende quello. Per vialetti, piazze e cortili la via vale per la sua sede (`width=` o la classe).
   Le vie disegnate a nastro (le vecchie vie a raso del gioco) prendono il materiale del poligono sotto il loro centro, i capi o i lati; senza
   poligono il `surface=*` della via stessa (`roads[].m`); senza nemmeno quello il neutro.
   asphalt → asfalto; paved, concrete → pavimentato; paving_stones → masselli; sett → porfido; cobblestone → ciottoli; gravel, fine_gravel,
   compacted, unpaved → ghiaia; ground, dirt, earth, sand → terra; grass, grass_paver → prato.
2. **DBGT**: AC_VEI_FON 02 (carreggiate e cortili) → ghiaia/sterrato; AR_VMS (carrarecce) → ghiaia/sterrato; AC_PED e AC_CIC (FON 01) →
   pavimentato.
3. **Foto aerea Esri** (luglio 2025, solo riferimento interno della build come in `dbgt_edifici.py`; mai nel gioco) per i pezzi di cui i dati
   non dicono il materiale: i cortili AATT interi e i vialetti che vengono solo da OSM. La mediana dei pixel dentro il pezzo (ristretto di 0,5 m,
   senza le ombre): verde → prato; rosso sul blu da +15 con luce sotto 95 → terra; luce da 80 in su → pavimentato. Tarata sulle superfici
   note (`fondi.py da_foto`): la foto di luglio è calda, il pavimentato si separa dalla terra per la luce, non per il colore.
3b. **I pezzi attaccati della stessa superficie** (vialetti e piazze: pezzi di un'unica area, senza un cordolo in mezzo) che restano senza
   materiale prendono quello del vicino che lo conosce, con cui hanno più confine; prima e dopo la foto. Un materiale non ne scaccia mai un
   altro. Il pavimentato di materiale ignoto (AC_PED e AC_CIC del DBGT, la foto) sa poco: un pezzo così attaccato a un materiale vero per
   almeno un quarto del suo contorno prende quello. Prima: le strisce chiare di pavimentato neutro ai lati del vialetto d'asfalto lungo la
   Milano-Meda (x 92-120 z 50-196).
4. Altrimenti **neutro**: nessun `m`. Un cortile AATT o un vialetto neutro si disegna col pavimentato neutro (non più il grigio liscio o il beige).
   Il neutro resta solo a una superficie intera di cui nessun pezzo sa il materiale.

**Strisce** (`world3.js senzaStrisce`, Carlo 6/11: in Italia sui ciottoli, sul porfido, sui masselli, sulla ghiaia e sulla terra non si dipinge):
righe di bordo e di mezzeria, tratteggi, strisce pedonali, linee di arresto, triangoli, fermate del bus e scritte si tolgono dove la carreggiata, il
cortile o la piazza sotto non sono d'asfalto (le piazze senza materiale sono in porfido). Un triangolo a cavallo del confine si taglia fino a 0,4 m
e il pezzetto sul confine se ne va anche lui.

I materiali nel gioco (`world3.js fondoLook`): asfalto e porfido, masselli, ciottoli, prato con le foto di prima; tre foto nuove Poly Haven CC0:
`tex/ghiaia.jpg` (gravel_floor_02, ×0,88), `tex/terra.jpg` (brown_mud_dry), `tex/pavimento.jpg` (concrete_floor_02 portato a grigio chiaro,
il pavimentato di materiale ignoto). Crediti nel gioco (riga dei crediti, `assemble3.py`).

## Il neutro, prima e dopo (Meda+Seveso)

| | Prima m² | Dopo m² |
|---|---:|---:|
| Terreno nudo dentro il riquadro dei dati (fiumi, strisce, cava) | 106.000 | 106.000 |
| Cortili AATT grigio liscio (nessun materiale) | 109.653 | 3.236 |
| Vialetti beige liscio (nessun materiale) | 84.778 | 14.035 |
| Cortili e carreggiate AC_VEI FON 02 disegnati in asfalto | ~92.000 | 0 |
| **Totale senza un materiale dai dati** | **~300.000** | **~123.000** |

Il pavimentato neutro da foto (75.407 m² di cortili AATT) conta come "pavimentato, materiale ignoto": la foto dice che è pavimentato, non di che
cosa. Il terreno nudo fuori dal riquadro (265.000 m² a nord) non cambia: lì non ci sono dati.

## Domande aperte per Carlo
- Le piazze (AC_PED 09 e simili) restano in porfido? Il DBGT non lo dice; OSM lo dice per 2 piazze su 35 a Meda+Seveso.
- I cortili AC_VEI 0307 FON 01 restano asfalto (deciso il 2/11); la foto dice che molti sono più chiari (masselli o cemento), ma il DBGT dice
  "pavimentato" e basta.
- La cava di x -1119 z -778 (OSM landuse=quarry) è terreno nudo: serve un tipo "cava" (terra)?

## Rifare i numeri
`python src/censo_superfici.py brianza.json confine_dbgt.json
<uscita>` rasterizza a 1 m gli strati dei tile nell'ordine dei ranghi dentro Meda+Seveso e conta i m² per aspetto; la build scrive anche
`report.fondi` in `brianza.json` (m² per materiale di ogni superficie).

## Il pavimento dalla foto (ramo pavimenti-foto, 8/11)
Piazze (AC_PED 09, `pz`) e cortili AC_VEI 0307 (`cv`) senza materiale da OSM/DBGT prendono il materiale dalla foto Esri (`fondi.py pavimento`): media su
pixel senza ombre (luce < 45) e verde. Taratura su pezzi di materiale noto (`GTA_DUMP_FONDI=<file>` scrive i numeri): la foto separa bene solo il porfido
(G-R -22, R-B 43 contro -3 e 24 di asfalto e cemento); asfalto e cemento si sovrappongono (luce mediana 96 e 128), quindi su 400 pezzi noti la regola
indovina circa il 60%. Piazze: rossastro = porfido, luce < 105 = asfalto, verde (> 60% dei pixel) = prato, altrimenti pavimentato neutro `n`.
Cortili (giudicati a celle di 12 m): asfalto salvo G-R <= -20 e R-B >= 40 (porfido) o luce >= 145 (pavimentato chiaro).
Piazza Cavour (x 451 z -901, 98 m2): esce `n`, non porfido (la foto e' in ombra). Poligoni (pezzi tagliati per tile) prima -> dopo:
pz: porfido 735 -> 33 (+305 f), n 20 -> 174, a 9 -> 115, p 0 -> 137; cv: n 12 -> 3056, f 1 -> 1506.
