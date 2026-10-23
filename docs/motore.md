# Motore nuovo: un solo modello delle altezze

Specifica del 23/10/2026 per chi lo implementa. Le fonti sono descritte in `docs/fonti.md` e `docs/dati.md`. I numeri di riga si riferiscono al ramo `motore` di oggi.

## 0. Il problema in breve

Oggi la quota di un punto la calcolano cinque funzioni che danno risultati diversi:
- `groundH` (world3.js r. 49), per auto, strade e oggetti;
- `visH` (r. 69), per la grafica del terreno;
- la patch di tile a passo `st`, che è anche la maschera di profondità;
- `surfAt` (r. 274), per la fisica;
- lo sfondo a 40 m (r. 71).

Gli impalcati, poi, sono calcolati nella build su un `ground` bilineare (build_data.py r. 145), mentre il gioco interpola su triangoli. Da qui vengono i glitch: alberi sospesi sopra l'alveo, buche invisibili al bordo dell'asfalto, crepe fra tile a 2 m e tile a 10 m, auto che galleggiano sulle scarpate e rampe con un gradino.

La regola del motore nuovo: **la build calcola una sola superficie, il gioco la disegna e la interroga con la stessa funzione.** Gli unici oggetti che stanno sopra o sotto quella superficie sono ponti, coperture e fosse dei sottopassi.

---

## 1. Il modello unico

### 1.1 La superficie `S`

`S(x,z)` è la quota del suolo calpestabile come lo disegna il gioco. Contiene già:
- il terreno LiDAR;
- le carreggiate e i marciapiedi alla quota DBGT, piatti in sezione;
- i raccordi (scarpate di rilevati e trincee) fra la strada e il LiDAR;
- l'alveo del Seveso e gli argini;
- le strade e la ferrovia che passano sotto i ponti.

Non contiene impalcati di ponti, coperture di gallerie, fosse dei sottopassi né edifici.

**Griglia.** È una griglia regolare per tile da 250 m (la stessa `TS` di oggi), in coordinate di gioco, con due triangoli per cella e diagonale fissa `u >= v`, come `groundH` alla r. 53. Fra i nodi l'interpolazione è lineare sul triangolo: **mesh e fisica usano la stessa formula sugli stessi numeri**.

**Passo per tile, deciso dalla build in base a cosa contiene la tile:**

| Passo | Quando | Nodi per tile |
|---|---|---|
| 2 m | la tile tocca, anche solo con il buffer, una strada (OSM o AC_VEI), un marciapiede, un binario, un fiume o canale, un edificio, un argine | 126×126 |
| 10 m | campi e boschi senza niente di quanto sopra | 26×26 |

10 è multiplo di 2, quindi i nodi di bordo di una tile a 10 m sono un sottoinsieme di quelli di una tile a 2 m. **Regola di cucitura:** sul lato che una tile a 2 m condivide con una a 10 m, la build sovrascrive i nodi di bordo della tile fine con l'interpolazione lineare dei due nodi grossi vicini. Così non si aprono crepe a T e non serve nessuna gonna (skirt). Il controllo C7 (§5) lo verifica.

Il passo da 1 m non serve: il LiDAR a 1 m mediato su 2×2 pixel basta per le scarpate e a 2 m Meda pesa circa quattro volte meno. I gradini veri (cordoli, banchine) non stanno nella griglia (vedi 1.4).

### 1.2 Il terreno di base `L`

- Si legge il LiDAR 1 m (54 GeoTIFF EPSG:4326 PixelIsPoint, `lidar_tiles()` r. 95). Per ogni nodo della griglia si prende la media dei pixel nella cella da 2 m (per le tile a 10 m, media 10×10), con riproiezione nel sistema di gioco.
- Dove il LiDAR manca si usa TINITALY bilineare, raccordato su 20 m (oggi `LID_FADE`). Il raccordo serve solo per riempire buchi o fuori dal riquadro LiDAR.
- Il `DROP` della scala Diaz–Anna Frank (world3.js r. 6–15) passa nella build, come poligono di ritocco in `src/ritocchi.json`. Nel gioco non deve rimanere nessuna modifica fatta a mano al terreno.

### 1.3 Come si bruciano le strade e le acque

Ogni elemento scrive su `S` una quota e una **priorità** (§4). Su un nodo vince la priorità più alta. A parità di priorità vince la quota dell'elemento più vicino al nodo. La build usa rasterizzazione vettoriale in numpy, per poligono e per segmento, con distanza punto-segmento sui nodi del riquadro del pezzo. Niente shapely punto per punto.

**Pulizia della Z DBGT (prima di tutto):**
- vanno scartati i vertici con Z = 0, Z NaN, Z < 200 m, oppure con |Z − mediana dei vertici del pezzo| > 3 m dove il pezzo non è un ponte;
- un vertice scartato prende la Z dell'asse EL_STR più vicino entro 3 m, altrimenti `L`;
- l'offset fra DBGT e DTM si calcola come mediana di (Z_DBGT − L) sugli assi EL_STR con SED=01 e |dz| < 0,5 m (oggi `_off`, r. 617–627; atteso circa +0,08 m), separato per ogni comune, e si toglie da tutte le Z di quel comune. Il valore finisce nel rapporto (C2).

**Carreggiata (AC_VEI con SED=01, comprese le aree sotto i ponti):**
- Per ogni nodo dentro il poligono: quota = Z dell'asse EL_STR (SED=01) più vicino, interpolata nella proiezione sul segmento. La sezione è piatta, senza bombatura.
- Agli incroci, se due assi distano dal nodo meno di 1 m in più rispetto all'asse più vicino, si fa la media pesata 1/d².
- Se il poligono non ha un asse entro 8 m, si usa la TIN dei suoi vertici puliti (triangolazione di Delaunay vincolata ai bordi).
- Si scrivono anche i nodi entro 0,5 m fuori dal bordo, così la mesh non sbava.

**Marciapiede (AC_PED con SED=01):**
- La griglia prende la TIN dei vertici di AC_PED **meno `SIDE_H`**. In questo modo resta continua con la carreggiata, e il gradino del cordolo lo aggiunge lo strato `step` (1.4).
- Prima di fissare la regola, la fase 1 misura (C3) di quanto AC_PED sta sopra AC_VEI sul bordo comune. Se la differenza mediana è sotto 0,05 m, AC_PED non contiene il cordolo e non si toglie niente.

**Aree stradali (AR_STR: piazze, parcheggi) e GZ_STR:** TIN dei vertici puliti, con priorità sotto la carreggiata.

**Raccordo con il LiDAR (rilevati e trincee).** Per i nodi fuori da tutti i poligoni stradali, entro una fascia di 20 m:

```
S = clamp(L, Zb - d/K, Zb + d/K)      K = 1.5 (scarpata 2:3), d = distanza dal bordo
```

Qui `Zb` è la quota del bordo stradale più vicino. Una sola formula copre il rilevato (L sotto: si scende con pendenza 1/K finché si incontra L), la trincea (L sopra: si sale) e il raso (L ≈ Zb: S = L). Sostituisce `cuts`, `trench_cut`, `CUT_S`, `ground_cut` (build r. 645–668) e la scarpata fisica di `surfAt` (world3.js r. 289–296). Dove due fasce si sovrappongono vince quella con |S − L| minore, cioè la più vicina al terreno vero.

**Fiume.**
- L'alveo viene da ALVEO_ALVEO_SUP (pulito: 109 vertici a 0 e 2 anomali a ~109 m). Si triangolano i vertici rimasti (TIN) e la quota si brucia dentro il poligono.
- Gli argini vengono da ARGINE_ARGN_SUP (23 pezzi con Z), con una TIN bruciata dentro il poligono.
- Sotto un ponte o un tombino il bruciato dell'alveo continua: è l'oggetto ponte che copre l'alveo, il terreno non lo copre.
- **Pelo dell'acqua `zw`:** per ogni vertice dell'asse EL_IDR si prende il minimo di `S` nella sezione (entro la semilarghezza) più 0,3 m. Poi la serie si rende monotona verso valle: il Seveso scorre da nord a sud, e il verso si ricava dalla quota del primo e dell'ultimo vertice. Si applica un minimo progressivo e una lisciatura a 20 m che non può alzare.
- **Fuori dal DBGT:** profilo a U lungo le `riv_lines` OSM, con profondità 2,4 m sotto `L` minimo della sezione (come `RIV_D` di oggi), larghezza `w` e sponda 1:1.

**Strade fuori dal DBGT (OSM).**
- Asse con quota `Za(s)`: mediana di `L` sui nodi entro la semilarghezza, ogni 2 m lungo l'asse.
- Poi lisciatura 1D su 30 m, con pendenza massima 8% per le strade per auto e 15% per quelle pedonali.
- La sezione è piatta su `w/2` e il raccordo segue la formula sopra.
- Il marciapiede è il buffer `side` di oggi (r. 764–798) con la stessa quota del bordo carreggiata più `SIDE_H` tramite `step`.

**Ferrovia.**
- Assi EL_FER con SED=01 e sedi SD_FER: TIN dei vertici, priorità come la carreggiata.
- Il binario (`rl`) prende la quota da `S` lungo la linea, oppure dall'oggetto ponte ferroviario.
- `propagate()` per i binari (r. 680–704) sparisce.

**Sotto i ponti.** Le strade con LIV=01 (18 segmenti EL_STR e 10 EL_FER a Meda) si bruciano come le altre: sono a quota DTM. Le cose con SED=02 non si bruciano mai.

### 1.4 I gradini: lo strato `step`

La griglia non ha salti verticali. I salti sono un elenco di poligoni per tile, ciascuno con un'altezza sopra `S`:

| `k` | Cosa | Altezza |
|---|---|---|
| 1 | marciapiede (AC_PED, oppure `side` OSM) | `SIDE_H` 0,15 |
| 2 | banchina di stazione | `PLAT_H` 0,55 |
| 3 | spartitraffico, aiuola rialzata | 0,15 |

`step(x,z)` restituisce l'altezza del poligono che contiene il punto, oppure 0. La ricerca passa per una griglia di indice per tile a 10 m con l'elenco dei poligoni per cella.

La grafica disegna:
- il coperchio come poligono ritagliato sui triangoli della griglia, alla quota `S + h`;
- il cordolo come striscia verticale lungo il bordo, da `S` a `S + h`.

Sostituisce `onSide`/`SIDEMASK` (world3.js r. 160) e `onPlatform`.

### 1.5 Gli oggetti sopra e sotto `S`

**Impalcato** (ponte stradale, ponte ferroviario, passerella, copertura della galleria):

```
{ id, tipo: 'strada'|'ferro'|'pedonale'|'copertura',
  imp: [[x,z],...],           // impronta 2D: PONTE_PONTE_SEDE, GALLER, oppure il buffer dell'asse
  tri: [x,z,y, ...],          // TIN del piano di sopra (assi SED=02, AC_VEI/AR_STR/AC_PED con SED=02/03)
  sp: 0.9,                    // spessore della lastra
  luce: y,                    // quota minima di S sotto l'impronta + 2.5: sotto questa quota si passa sotto
  ra: [i,...] }               // indici delle strade che lo percorrono (roads[].br)
```

- Agli estremi (spalle) la TIN deve coincidere con `S` entro 0,05 m (C5). Dove non coincide si sposta il vertice dell'impalcato, non il terreno.
- La copertura della galleria (GALLER, Z +4 m sul DTM, con sopra AC_PED SED=03) è un impalcato di tipo `copertura`. Le due strade e le due ferrovie a quota 223 sotto di lei si bruciano in `S`.
- Fuori dal DBGT, i ponti OSM che `crosses` una strada o ferrovia bassa (r. 510–514) hanno la quota delle spalle presa da `S` e il piano di sopra lineare fra le spalle, alzato al minimo `luce + sp`.

**Fossa** (bocca di un sottopasso, scala che scende, `buildStairwells` landmarks3.js r. 1631–1648): `{ imp, fondo, gradini }`. Buca la mesh di `S`, con lo stencil di oggi (landmarks3.js r. 1603), e ha la sua geometria. `S` resta il terreno fuori dalla fossa.

Le rampe non sono oggetti: stanno già nel DBGT e quindi in `S`. L'euristica `propagate()`/`RAMP_G`/`pin`/`cap` (build r. 515–583) sparisce dove c'è il DBGT. Fuori dal DBGT resta solo il ponte lineare fra le spalle.

---

## 2. Il formato dei dati

### 2.1 `brianza.json` (sempre caricato)

Restano come oggi `meta`, `roads`, `trains`, le tile vettoriali `tiles[t]` (edifici, landuse, alberi, muri…). Cambiano:

| Chiave | Contenuto |
|---|---|
| `meta.ver` | `2` (modello unico); il gioco rifiuta `1` con un messaggio |
| `meta.hstep` | `[2, 10]`, i passi ammessi |
| `terrain` | solo la **griglia lontana**: passo 10 m su tutto il riquadro più 480 m, `h16` in dm sopra `base` (come oggi), ricavata **sottocampionando `S`**, non da TH |
| `nodes` | `[x, z, h]` con `h` sempre presente, in cm sopra `base`: quota di `S` nel nodo, oppure dell'impalcato se il nodo sta su un ponte. Niente −32768 |
| `roads[]` | niente `d`; `br: idx` se la strada percorre un impalcato, `tn: idx` se passa sotto una copertura |
| `decks` | elenco degli impalcati (1.5), in m con 2 decimali |
| `pits` | elenco delle fosse |
| `tiles[t].rv` | `{p, w, e, zw}`: `zw` è la quota dell'acqua per vertice |
| `tiles[t].st` | poligoni dello strato `step` `{k, h, p}` |
| `tiles[t].lod` | livello lontano della tile (2.3) |
| `report` | sintesi dei controlli (§5) |

Spariscono `cut` e `nodes[i*3+2] = -32768`.

### 2.2 `terreno/<tx>_<tz>.bin` (a richiesta)

Un file binario per tile, little-endian:

```
u8[4]  'GTAS'      u8 ver=1     u8 step (2|10)    u16 n (nodi per lato: 126|26)
f32    base        (m, quota minima della tile)
u16[n*n] h         cm sopra base, riga per riga (z poi x); 65535 = vuoto
u8[(n-1)*(n-1)] m  materiale per cella (facoltativo, 0 = assente): 1 asfalto, 2 marciapiede, 3 erba, 4 alveo, 5 scarpata, 6 binario
```

- Si servono compressi in gzip e si decomprimono con `DecompressionStream('gzip')`.
- A Meda: circa 700 tile, di cui la maggior parte a 2 m, circa 32 KB l'una non compressa. In tutto circa 20 MB, stimati 6–8 MB compressi. Il controllo C9 lo misura davvero.
- `tileTick` (world3.js r. 979) scarica la tile entro 900 m, la costruisce entro 760 m e la libera oltre 1150 m, come oggi.
- Finché il `.bin` non è arrivato la tile non si costruisce, e `H` usa la griglia lontana.

### 2.3 Il livello lontano (oltre 760 m, fino alla nebbia)

Per ogni tile, in `tiles[t].lod`, li calcola la build:
- `r`: strade semplificate, come polilinee Douglas-Peucker a 2 m con larghezza e classe, solo le strade per auto. Si disegnano come nastri sulla griglia lontana, a +0,1 m;
- `b`: case come scatole, cioè impronta semplificata a 1 m (al massimo 8 vertici) con quota del piede da `H.range` e altezza. Gli edifici sotto i 30 m² si scartano;
- `v`: alberi come punti, disegnati con un impostor.

Il gioco tiene il livello lontano tra 760 m e `fog.far + 100`. Una tile mostra il livello lontano finché la sua versione fine non è `ready`, così sparisce il buco attuale fra 580 e 720 m. La maschera di profondità lontana si fa con la griglia lontana a −0,5 m e non a −3,2 m, perché ora è un sottocampionamento di `S` e non di TH grezzo. Il controllo C8 misura lo scarto massimo fra griglia lontana e `S`.

---

## 3. L'API dell'altezza nel gioco

Un modulo nuovo, `src/altezze3.js`, assemblato prima di `world3.js`. È l'unico che legge `terrain`, i `.bin`, `decks` e `step`.

```js
H.ground(x, z)          // m. S(x,z) + step(x,z). Il suolo come disegnato. Usa la tile fine se pronta, sennò la griglia lontana.
H.base(x, z)            // m. S(x,z) senza step: per chi disegna e deve stare sotto il cordolo (mesh, drappeggi).
H.surface(x, z, cy)     // m. max(ground + bumpAt, top di ogni impalcato con imp ∋ (x,z) e top <= cy + 0.8).
                        //    Senza cy: solo ground + bumpAt (oggetti fermi a terra).
H.deckAt(x, z)          // [{id, top, bot}] impalcati sopra il punto: camera, ombre, spawn.
H.range(ring)           // [min, max] di H.ground sui vertici dell'anello e sui nodi della griglia interni.
H.node(i)               // m. nodes[i].h. Per auto IA, pedoni, polizia.
H.water(x, z)           // m oppure null: pelo dell'acqua da rv.zw, interpolato sull'asse più vicino entro w.
H.kind(x, z)            // 'road'|'side'|'plat'|'river'|'green'|'slope'|'rail' dal materiale della cella e da step.
H.onTri(tile, cb)       // itera i triangoli della griglia di una tile: lo usano mesh e ritaglio dei poligoni.
```

**Contratto:** la mesh del terreno della tile si costruisce da `H.onTri` e i vertici sono i nodi della griglia senza nessuna correzione. Quindi `H.base` coincide con la mesh fino all'errore di arrotondamento float32. Il controllo G1 nel gioco (`H.check()`, §5) lo verifica su 1000 punti a caso per tile.

**Disegno delle superfici (asfalto, prati, piazze).**
- I poligoni `as`, `pz`, `sd`, `ft`, `md` e i `VBuf` non si drappeggiano più con `polyFill` (game.src.html r. 280–306).
- Si **ritagliano sui triangoli della griglia** con `clipToGrid(poly, tile)`, cioè Sutherland–Hodgman per riga di celle. Ogni vertice prende `H.base` (per i coperchi `H.ground`), quindi il poligono sta esattamente sul terreno.
- Il distacco dalla mesh si fa con `polygonOffset`, non con +0,045/+0,06 in y.
- `cutTouches`, il limite di 60.000 triangoli e le tolleranze −0,4/+0,25 spariscono.
- Se c'è il materiale per cella, le zone lontane si colorano nello shader del terreno e i poligoni restano solo entro 300 m.

**Acqua:** un piano a `zw` per pezzo di fiume, ritagliato sul poligono dell'alveo. Le aree acqua (`a.t = 6`) dentro l'alveo non si disegnano.

### 3.1 Come migrano i consumatori

| Oggi | Domani | Dove |
|---|---|---|
| `groundH`, `visH`, `terrDrawnH`, `surfY` per oggetti fermi | `H.ground` | landmarks3.js (alberi, lampioni, panche 170–180, 775, 1300–1349, 1583, 1665, 1819; telai 459, 476, 902, 958, 1062, 1452, 1503, 1526, 1574; WALLS 296, 305, 617, 764; scale 1783–1800), paesaggio3.js 82, 138–226, 304–410, oggetti3.js 165, props3.js 51, segnali3.js 59, game.src.html 1221, 1703, 1710, 1725, 1803 |
| `Math.min/max(...ring.map(groundH))` | `H.range(ring)` | landmarks3.js (circa 25 punti: 123, 602, 934, 1037, 1067, 1086, 1128, 1137, 1362, 1418, 1549, 1615, 1679, 1714), negozi3.js 525, 824, paesaggio3.js 78, 95, 188, 231 |
| `groundH + PLAT_H` | `H.ground` (la banchina è in `step`) | landmarks3.js 738, 1197 |
| vetrine e soglie `groundH(+n*0.6)` | `H.ground` nel punto davanti alla porta (prende già il marciapiede) | negozi3.js 610, 612, 846, 863, 867, 897 |
| `surfAt(x,z)` senza `cy` | `H.surface(x,z)` | negozi3.js 943, paesaggio3.js 252, 265, oggetti3.js 137, 149, assemble3.py 104, 228, 495, 502 |
| `surfAt(x,z,y)` | `H.surface(x,z,y)` | assemble3.py 82–87 (ruote, pedoni, giocatore) |
| `surfAt` per lo spawn della polizia | `H.node(i)` sul nodo di nascita | police3.js 25, 38 (oggi su un ponte prende il suolo di sotto) |
| `nodeY(a)` | `H.node(a)` | game.src.html 1192, 1198 |
| profilo `hs` dei treni o `groundH` | `rl.h` dalla build, ricavato da `S` o dall'impalcato | trains3.js 58 |
| `DECKG`, `DECK_SOLIDS`, `FLAT_RAILS`, `yAt` | parapetti e piloni generati da `decks` (bordo dell'impronta, piloni ogni 15 m da `bot` a `S`) | world3.js 87, 178, 189–237, 697–743, 796 |
| `trenchCut`, `riverCut`, `TH`, `DROP` | spariscono | world3.js 3–69 |
| fossa del sottopasso | oggetto `pits` | landmarks3.js 1631–1648 |

Le vecchie `groundH`, `visH`, `surfAt` restano per una fase come alias di `H.*`, con un `console.warn` una volta per sito di chiamata. Poi si tolgono.

---

## 4. Chi vince tra le fonti

Priorità sul nodo della griglia, dalla più alta alla più bassa:

1. **Ritocchi a mano** (`src/ritocchi.json`): poligoni con quota o offset, usati solo per errori dimostrati, ognuno con un commento.
2. **Carreggiata DBGT** (AC_VEI SED=01 con Z degli assi EL_STR), **sedi ferroviarie DBGT** (SD_FER/EL_FER SED=01).
3. **Marciapiedi e aree DBGT** (AC_PED, AR_STR, GZ_STR).
4. **Alveo e argini DBGT** (ALVEO, ARGINE).
5. **Strade e ferrovie OSM** fuori dal perimetro dei comuni con DBGT (`confini_comuni.json`). Dentro il perimetro OSM dà solo la **topologia** (nomi, classi, sensi, `bridge`/`tunnel` come conferma) e mai la quota.
6. **Fiumi OSM** con profilo a U, fuori dal DBGT.
7. **Raccordi** (formula 1.3).
8. **LiDAR 1 m**.
9. **TINITALY 10 m**, solo dove manca il LiDAR.

Regole di conflitto:
- **DBGT contro LiDAR sulla strada:** vince il DBGT se |Z − L| ≤ 1,5 m. Oltre si guarda SED/LIV: con SED=02 è un ponte e va negli oggetti; con SED=01 e |dz| > 1,5 m si usa `L`, il caso finisce nel rapporto (C4) e si decide se metterlo nei ritocchi.
- **Ponte DBGT contro OSM:** l'oggetto ponte nasce dal DBGT (PONTE + SED=02). Un `bridge=yes` OSM senza PONTE DBGT vicino (entro 10 m) dentro il perimetro si ignora e finisce nel rapporto. Un PONTE DBGT senza via OSM sopra si tiene comunque.
- **Galleria:** il poligono GALLER vince sui flag degli assi, che non la segnano. `tunnel=yes` OSM conta solo fuori dal DBGT e se più lungo di 80 m (come r. 468).
- **Due DBGT di comuni diversi sul confine:** vince il rilievo più recente. A pari anno vince il comune che contiene il nodo.
- **Edifici:** non toccano `S`. La base di un edificio è `H.range(impronta)[0]`, e lo zoccolo copre la differenza fino al massimo.

---

## 5. Il rapporto automatico della build

Alla fine `build_data.py` scrive `report_motore.json` (completo) e `report` dentro `brianza.json` (sintesi), e stampa una tabella. Ogni controllo ha una soglia: se la supera la build esce con il codice 2, a meno che non si passi `--accetta`.

| Id | Controllo | Soglia |
|---|---|---|
| C1 | Z DBGT scartate per strato (a 0, NaN, sotto 200 m, outlier) e quante sostituite | informativo |
| C2 | offset DBGT − DTM per comune, con p10/p50/p90 | \|p50\| < 0,3 m |
| C3 | AC_PED − AC_VEI sul bordo comune (mediana): decide `SIDE_H` nella griglia | informativo |
| C4 | nodi stradali SED=01 con \|Z_DBGT − L\| > 1,5 m: elenco con coordinate | < 30 |
| C5 | per ogni nodo strada \|S − nodes.h\| (fuori dai ponti) e per ogni spalla \|TIN impalcato − S\| | p99 < 0,05 m, massimo < 0,2 m |
| C6 | pendenza massima di `S` sulle carreggiate (per segmento) | < 18%, sopra con elenco |
| C7 | salto massimo sui bordi fra tile (stessa coordinata, due tile) | 0,000 m |
| C8 | scarto fra griglia lontana e `S` (p99, massimo) | p99 < 0,5 m |
| C9 | peso dei `.bin` compressi, tile a 2 m e a 10 m, peso di `brianza.json` | informativo |
| C10 | `zw` non monotona, acqua sopra le sponde (`zw` > `S` del bordo + 0,1) | 0 |
| C11 | `bridge` OSM senza PONTE DBGT, PONTE senza strada sopra, luce sotto 2,5 m | informativo |
| C12 | tempi di ogni fase della build | totale < 15 min |

Il rapporto contiene anche fino a 50 **punti da guardare** (le coordinate peggiori di C4, C5, C6, C10), con un link `?x=..&z=..` che il gioco accetta per teletrasportarsi lì. Nel gioco, con il tasto di debug, `H.check()` fa il controllo G1 (mesh contro `H.base`, scarto massimo atteso 0,000 m) sulle tile costruite e lo scrive in console.

---

## 6. Fasi di implementazione

Ogni fase si chiude con un commit sul ramo `motore`, `python src/assemble3.py`, la prova di avvio Playwright e una verifica precisa. Si parte da Meda: il riquadro di prova è il comune di Meda più 250 m (`--solo-meda`). Le altre tile restano col motore vecchio finché la fase 8 non le porta.

1. **Lettura e pulizia DBGT.** In un modulo `src/dbgt_quote.py` si fanno le funzioni `load_dbgt(path) -> dict di strati con Z pulita`, `offset_comune()` e C1–C3. Verifica: il rapporto riproduce i numeri del censimento (EL_STR 2935 su 2935, mediana dz circa +0,08 m, ALVEO pulito).
   *Fatta il 23/10 (`python src/dbgt_quote.py`, 9 s su Meda).* EL_STR 2935 oggetti su 2935 con quota; offset Meda +0,073 m (p10 −0,14, p90 +0,28; senza banda +0,076); ALVEO 109 vertici a 0 e 2 sotto i 200 m (contando le chiusure degli anelli), tutti sostituiti. Il test outlier usa la mediana locale (20 m, o i 5 vicini entro 60 m) e **salva** un outlier che sta entro 1 m dal LiDAR: erano i vicini a essere sbagliati (121 dei 210 in AC_VEI). C3: AC_PED − AC_VEI sul bordo comune ha mediana 0,00 m (p10 −0,12, p90 +0,20, il 40% entro 1 cm), quindi il DBGT non contiene il cordolo e la griglia prende AC_PED senza togliere `SIDE_H`.
   *Verifica del 23/10.* Numeri riprodotti, offset rifatto a mano con lettura indipendente (+0,072/+0,073 m), georeferenziazione DBGT/LiDAR entro 0,5 m (ricerca dello spostamento sui vertici in pendenza). Corretto `Lidar.at`: interpolava dentro ogni GeoTIFF da solo e lungo i bordi fra file (ogni 0,01°) lasciava gradini fino a 3,8 m (p99 0,6 m); ora interpola sul reticolo comune e il salto è 0,000. Per la fase 2: (a) C1 ora riporta i vertici tenuti lontani dal LiDAR: AC_VEI 6827 oltre 1,5 m e 1168 oltre 3 m, il 92% in aree interne (ZON 0307), quasi tutti sopra il LiDAR; (b) alcuni sono ponti non segnati (es. AC_VEI 636 sulla trincea a x 1421, z 452: DBGT +3,6 m con l'asse d'accordo, il LiDAR non ha la rampa), quindi il tetto "tieni il LiDAR" lì aprirebbe un buco; (c) nei 19 pezzi AC_VEI con outlier salvati restano 256 vertici oltre 3 m dal LiDAR (i "vicini sbagliati" non vengono scartati); (d) sui vertici condivisi AC_PED/AC_VEI la Z differisce (p10 −0,12, p90 +0,20 m), quindi il bordo del marciapiede va agganciato alla quota della carreggiata; (e) PONTE id 4 sta 2,4 m sotto il LiDAR.
2. **Griglia `S` della build.** In `src/superficie.py` si fanno `build_S(tile) -> (step, base, h)`, con LiDAR, carreggiate, marciapiedi, aree, raccordi, alveo e argini, e la scrittura dei `.bin`. Ancora nessun cambio nel gioco. Verifica: C4, C5, C6, C7, C10 entro soglia; un'immagine `scratchpad/S_meda.png` (hillshade di `S` meno `L`) dove si vedono le strade come linee nette, le scarpate e l'alveo.
   *Fatta il 23/10 (`python src/superficie.py`, 38 s su Meda; `build_S(tile)` per una tile).* S si calcola una volta sola su un reticolo a 2 m agganciato agli angoli delle tile (202 tile, Meda + 250 m; 26 tile di Meda stanno a nord della mappa), poi si taglia: 199 tile a 2 m, 3 a 10 m. Le tile a 10 m sono salvate a multipli di 5 cm, così i nodi di bordo delle tile fini interpolati fra due nodi grossi sono cm interi: C7 dà 0,000 sia sui nodi in comune sia sulle giunzioni a T. Il `.bin` si decodifica come `(base*100 + q)/100`, con `base` in metri interi. Scelte rispetto al testo sopra: (a) **la Z degli assi EL_STR è a gradini** (corse di vertici alla stessa quota, poi salti di 0,21 o 0,42 m): gli assi si ricampionano a 2 m e la Z si diffonde lungo la rete con sigma 15 m (mediana dello spostamento 0,02 m, p99 0,25). Era la causa principale delle "righe" trasversali sulle carreggiate del prototipo; (b) fra assi vicini si fa la media 1/d² con un raccordo continuo su 4 m invece del taglio netto a 1 m; oltre 8 m dall'asse subentra la TIN del poligono; (c) **le aree interne (ZON 0307) senza asse non si bruciano** (4175 pezzi: la loro Z sta a più di 0,5 m dal LiDAR sul 12% dei nodi), restano LiDAR con il materiale asfalto; (d) i punti del bordo di marciapiedi, aree e carreggiate senza asse entro 0,3 m da una carreggiata con asse ne prendono la quota (219 146 punti; non se differiscono di più di 1 m: 443); (e) la ferrovia usa gli assi EL_FER lisciati allo stesso modo; (f) **gli ARGINE stanno tutti dentro ALVEO_A** (sono le sponde inclinate del canale) e si bruciano prima dell'alveo; l'anello dell'alveo è il ciglio della sponda, quindi il fondo si scava 1 m sotto la sua TIN con sponda 1:1, mai sopra il LiDAR; (g) raccordi come inviluppo `S = clamp(L, max_j(Zj - d/K), min_j(Zj + d/K))` su tutti i nodi fissi entro 20 m, calcolato esatto: è la formula di 1.3 per un bordo solo e non ha salti fra due bordi; (h) tetto: si parte dai nodi oltre 3 m e ci si allarga finché si resta oltre 1,5 m; entro 30 m da un ponte la macchia diventa impalcato (491 nodi, per la fase 3), sopra l'alveo è un tombino e tiene il DBGT (la Milano-Meda sul Seveso, 87 nodi), altrove va al LiDAR con un raccordo di 10 m (872 nodi); (i) il pelo dell'acqua non supera mai la sponda più bassa meno 0,1 m (458 punti abbassati: canali più stretti della griglia). Il DROP della scala Diaz non serve: il LiDAR ha la scarpata, `src/ritocchi.json` è vuoto. Controlli (`report_fase2.json`): **C4** 199 luoghi, 33 su strade con almeno 5 nodi (soglia 30, fuori: elenco da guardare per i ritocchi, il peggiore a x 1571, z −1032 con il DBGT 6,8 m sotto il LiDAR); **C5** .bin contro S p99 0,004, massimo 0,005 m; .bin contro la quota della carreggiata nel punto p99 0,024, massimo 0,46 m (rampe accanto a strade di un'altra quota); **C6** nessun asse sopra il 18% (p99 8,7%); triangoli di carreggiata sopra il 18%: 901 su 188 225 (1253 con l'asse più vicino e la Z grezza, come il prototipo), quasi tutti rampe di garage o sottopassi nello stesso poligono della strada; **C7** 0,000; **C10** 0 non monotone, 0 sopra le sponde; **C9** 199 tile fini 9,4 MB, 3,8 MB in gzip. Le strade OSM fuori dal confine non si bruciano ancora (fase 8): lì S = L.
3. **Impalcati e fosse.** Si fanno `build_decks() -> decks[]` da PONTE, SED=02 e GALLER, e `build_pits()`. Poi si ricalcolano `nodes.h` e `roads.br/tn`. Verifica: C5 sulle spalle, C11; 18 o più ponti DBGT riconosciuti a Meda, la galleria come `copertura`.
4. **`altezze3.js` e mesh.** Si fanno `H.*` e la mesh di tile da `H.onTri`, caricando i `.bin` in `tileTick`. Le vecchie funzioni restano come alias. Verifica: `H.check()` dà 0,000; screenshot della stessa inquadratura prima e dopo su via Indipendenza, sul Seveso e su un cavalcavia, senza buchi né crepe.
5. **Superfici ritagliate e `step`.** Si fanno `clipToGrid` per asfalto, piazze, prati e `VBuf`, coperchi e cordoli dei marciapiedi, piano dell'acqua. Si toglie `polyFill` con il drappeggio. Verifica: niente z-fighting sulle tre inquadrature; il conteggio dei triangoli per tile non deve superare quello di oggi.
6. **Fisica e consumatori.** Si porta `surfAt` su `H.surface` e si migra la tabella 3.1. Si tolgono `DECKG`, `trenchCut`, `riverCut`, la scarpata fisica e gli alias. Verifica: guida e camminata sulle tre inquadrature senza scatti (registrare `y` della ruota ogni frame: salto per frame < 0,2 m fuori dai cordoli); albero vicino al Seveso appoggiato; spawn della polizia su un ponte sopra il ponte.
7. **Livello lontano.** Si fanno `tiles[t].lod`, la griglia lontana da `S`, i nastri, le scatole e gli impostor, con il passaggio tra fine e lontano. Verifica: C8; video a 120 km/h in diagonale senza pezzi vuoti oltre 580 m; FPS non peggiori di oggi.
8. **Fuori da Meda.** Fallback OSM (strade, ponti lineari, fiumi a U) su tutto il riquadro. Poi si estraggono i DBGT di Seveso, Lentate e degli altri (`docs/dati.md`), un comune alla volta, ciascuno con il suo rapporto. Verifica: C1–C12 per comune, cucitura sul confine (C7) e sul confine DBGT/OSM (C5 sui nodi di confine).
9. **Pulizia.** Si tolgono `propagate()`, `RAMP_G`, `pin`/`cap`, `cuts`, `LID_FADE` come blend, `deckH`, la chiave `cut` e `meta.ver = 1`. Verifica: build completa entro C12; `grep` di `groundH|visH|surfAt|trenchCut` vuoto fuori da `altezze3.js`.
