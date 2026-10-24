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
- La copertura della galleria (GALLER, con AC_PED SED=03) è un impalcato di tipo `copertura`. Le due strade e la ferrovia a quota 223 si bruciano in `S`. *Corretto nella fase 3:* passano **sopra** la galleria, che è il sottopasso pedonale della stazione (OSM `tunnel=yes layer=-1`, fosse di 3,6 m); la Z della GALLER (+3,85 m sulle strade) non si usa. La copertura ha il piano di sopra uguale a `S`, e in più `fondo`, il pavimento del passaggio, preso dalle fosse.
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
   *Verifica del 23/10.* Riprodotti i numeri. Controlli indipendenti: `L` contro i GeoTIFF letti a parte (media dei pixel nella cella) scarto p50 0,006 m, p99 0,16, e lo spostamento di mezzo metro peggiora (georeferenziazione giusta); vertici EL_STR SED=01 letti dal gpkg (Z − offset) contro `S` p50 0,03 m, p99 0,30; `.bin` riletti a parte: nessun 65535, 0,000 sui 46 240 nodi di bordo condivisi. Corretti tre errori: (1) **il raccordo assoluto `clamp(L, Zb − d/K, Zb + d/K)` sui pendii naturali più ripidi di 2:3** (la forra del Seveso a nord, le scarpate sotto le strade in costa) costruiva un riporto o uno scavo 2:3 che non incontrava mai il LiDAR e lasciava un dirupo fino a 7 m sul bordo della fascia dei 20 m (S − L arrivava a −10,3/+8,2 m; 12 383 nodi di scarpata). Ora la stessa formula vale sullo scarto da L: `S = L + clamp(0, max_j(Zj − Lj − d/K), min_j(Zj − Lj + d/K))`, identica in piano; S − L sta in −4,0/+4,9 m, 1991 nodi di scarpata, 0 nodi mossi sul bordo della fascia; (2) **alveo coperto**: dove il fondo DBGT sta più di 3 m sotto il LiDAR fuori dai ponti (il Seveso coperto in centro, x 260 z −525, con la strada piana a 223 m sopra un fondo a 219,4; e le pareti della forra a nord) si scavava una trincea aperta che nessun oggetto copre; ora lì resta il LiDAR (272 nodi); (3) **sentieri e carrarecce** (`path`, `track`, `bridleway`) non contavano per il passo fine, ma il gioco li disegna (FOOT in build_data.py): le 3 tile a 10 m avevano sentieri, ora sono a 2 m (202 su 202). Il rapporto ha in più `C6.gradini_non_nel_lidar` (coppie di nodi vicini con un salto più ripido della scarpata 2:3 che il LiDAR non ha, fuori da ponti e tombini): 97, di cui 60 sulle sponde dell'alveo (prima della correzione erano 438 contando anche i tombini, ora 144). Restano aperti: i due "tombini" della Milano-Meda sul Seveso (x −250, z 190–225) tengono la strada 4,9 m sopra il LiDAR con pareti di 6,7 m sull'alveo: il DTM ha tolto la struttura, quindi è un ponte senza PONTE nel DBGT e la fase 3 deve farne un impalcato; nei luoghi C4 con |dz| fra 1,5 e 3 m (tenuti dal DBGT) ci sono strisce di carreggiata o marciapiede 2–3,6 m sotto il LiDAR (es. x 53 z −748, x 283 z −548 accanto al Seveso coperto), da decidere come ritocchi; il conteggio C4 resta 33 luoghi.
3. **Impalcati e fosse.** Si fanno `build_decks() -> decks[]` da PONTE, SED=02 e GALLER, e `build_pits()`. Poi si ricalcolano `nodes.h` e `roads.br/tn`. Verifica: C5 sulle spalle, C11; 18 o più ponti DBGT riconosciuti a Meda, la galleria come `copertura`.
   *Fatta il 24/10 (`python src/impalcati.py`, 35 s di cui 34 per la superficie di `superficie.costruisci()`; uscite `decks_meda.json`, `report_fase3.json`, `impalcati_meda.png`). `nodes.h` e `roads.br/tn` non sono ancora ricalcolati in `brianza.json`: `ra` e `tn` sono gli indici delle strade del `brianza.json` di oggi, `osm` gli id delle vie.* 22 oggetti: 19 PONTE su 20, 2 ponti che il DBGT non segna, 1 copertura; 15 stradali, 3 ferroviari, 3 pedonali; 2 fosse. Scelte: (a) **piano di sopra**: assi EL_STR/EL_FER con SED=02 fusi come sulle carreggiate, oltre 8 m la TIN delle aree SED=02/03 e dell'anello PONTE (34 punti dell'anello a più di 1,5 m dagli assi e dalle aree tolti); (b) **i nodi AIR** della fase 2 (rampe e campate che il DTM non ha) vanno per macchia connessa al ponte entro 32,5 m dello stesso tipo e alla stessa quota (489 nodi), 70 ai due ponti non segnati, 2 dentro la fossa di via Pace; un nodo AIR a più di 1,5 m dai vicini è un'altra strada e non entra; (c) **spalle**: l'impalcato si allunga con celle da 2 m, entro 2,5 m dall'impronta PONTE e dentro la sua larghezza, dove almeno un vertice è terreno fuori dai ponti entro 0,5 m dal piano DBGT (1 m se sul ponte il DBGT ha solo aree pedonali: un gradino che `H.surface` sale); lì l'impalcato vale S, dentro l'impronta vale il piano DBGT più una tirata IDW dei residui sui nodi d'appoggio (raggio 10 m), altrove un campo sul reticolo (S sugli appoggi, Z DBGT sui nodi AIR, il vicino valido sugli altri). Appoggiare solo sui nodi di strada lasciava 3 ponti senza spalle (PONTE 20 appoggia a ovest su una strada interna lasciata al LiDAR); con 1 m anche per le strade l'impalcato copiava le scarpate (172 triangoli sopra il 18% contro 75); (d) **formato**: `tri` è una lista di triangoli, 9 numeri ciascuno; `nucleo` è l'impronta PONTE, dove vanno i parapetti (il resto di `imp` sono rampe e appoggi a scalini di 2 m); `spalle` sono i lati che appoggiano su S; (e) **la GALLER non è una copertura sopra le strade**: la sua Z (226,9) sta 3,85 m sopra le due strade e la ferrovia che le passano sopra, OSM ha un `footway` `tunnel=yes layer=-1` con le scale che scendono e `landmarks3.js` le fosse profonde 3,6 m. È il sottopasso pedonale della stazione: la copertura è il terreno stesso (`tri` = S, meno le fosse), con `fondo` 218,85 dalle fosse e `luce` = fondo + 2,5. Il testo di 1.5 su questo punto è sbagliato; (f) **fosse** da `STAIRWELLS` di `landmarks3.js` (lette dal file, unica fonte della profondità finché la fase 6 non le sposta): la quota della strada è S in cima alle rampe, non il minimo sul contorno, perché il LiDAR ha i buchi delle scale (220,3 contro 222,5-222,9): fondo 219,31 (via Indipendenza) e 218,85 (via Pace), 0,46 m su 33 m di galleria; (g) **PONTE 4 scartato**: 2,3 m sotto il LiDAR, niente sotto né vie OSM sopra; (h) in `superficie.py` i "tombini" con la strada sopra il LiDAR diventano AIR (`PNS`): la Milano-Meda sul Tarò (OSM `bridge=yes`, pareti di 6,7 m nel DTM) è un ponte che il DTM ha tolto; il DTM tiene come terreno il tratto fra le carreggiate (il Tarò lì è in un tombino), quindi i due impalcati sono cunei dove la gola è aperta sotto la carreggiata. C4 della fase 2 passa da 33 a 31 luoghi. Controlli (`report_fase3.json`): **C5** 551 lati di spalla, |impalcato − S letto dai .bin| 0,000 (vale per costruzione sui lati del reticolo); riletto in modo indipendente da `decks_meda.json` massimo 0,005 m (il centimetro dell'arrotondamento); la tirata del piano DBGT verso S è p50 0,15, p90 0,47, massimo 0,98 m; **C6 sugli impalcati** lungo le 38 vie OSM sopra al massimo 7,5%, 206 triangoli sopra il 18% sui bordi e alle estremità delle rampe (massimo 80%, rampe del sovrappasso Motta); lungo le vie, ai passaggi terra-impalcato, salti di al massimo 0,13 m su 0,5 m tranne via Maroncelli (marciapiede accanto alla rampa, 0,73) e PONTE 2; **C11** 8 `bridge` OSM nel comune senza PONTE (la Milano-Meda sopra via Milano/sottopasso a x −768 z 98-109, via Como, via Grandi, la passerella di via delle Betulle, due carrarecce, un sentiero), 3 sui ponti non segnati, 2 PONTE senza strada sopra (PONTE 1 e 3: passerelle con AC_PED e nessuna via OSM), franco sotto 2,5 m in 10 casi (8 sui torrenti, PONTE 12 a −0,01 m su via Busnelli, PONTE 14 a 1,36 m); i nodi di oggi sugli impalcati (57) stanno a −0,08 m in mediana dalla quota nuova (p10 −0,32, p90 +0,15, massimo 2,24). Restano aperti: l'estremo est di PONTE 20 (via Vignazzola) non appoggia: il PONTE DBGT è lungo 33 m, il ponte OSM 56, e fra la fine del PONTE e il terreno alla sua quota S scende nella trincea; S sopra la copertura scende a 220,6 m dove il LiDAR ha i buchi delle scale fuori dal contorno delle fosse (altezza libera 0,87 m sul fondo: va bruciata la quota della strada sulla GALLER); 4 sottopassi pedonali OSM senza fossa (due alla stazione, x 400-413 z −549/−535; due a x 860-876 z 864-875), senza dati di profondità; il ponte della Milano-Meda a x −768 z 103 non ha PONTE né nodi AIR.
   *Verifica del 24/10.* Riprodotti i numeri e i file (`.bin` e `decks_meda.json` identici byte per byte). Controlli indipendenti, con letture proprie del gpkg (WKB grezzo, EPSG:7791 → gioco), dei GeoTIFF e dei `.bin`: impronte `nucleo` contro PONTE del gpkg IoU 0,997–1,000 (georeferenziazione giusta); piano degli impalcati contro i vertici SED=02 degli assi sopra −0,4/+0,3 m (PONTE 6 −0,35/−0,42: la tirata verso le rampe, che stanno più basse dell'asse a gradini del ponte); spalle rilette dai triangoli contro i `.bin` p99 0,007, massimo 0,010 m; nessuna sovrapposizione fra impalcati, triangoli che coprono l'impronta esatta; guida dal mezzo di ogni asse SED=02 fino a 45 m oltre l'impalcato lungo gli assi collegati, con `max(S, impalcato sotto y + 0,8)`: salto massimo 0,13 m ogni 0,5 m. Corretti tre errori: (1) **via Busnelli chiusa sotto PONTE 12** (e via Milano sotto PONTE 14): il tetto della fase 2 portava al LiDAR le strade più di 3 m sotto di lui anche sotto i ponti, dove il DTM è riempito attraverso l'impalcato; la strada del DBGT, piana a 215,2 m, diventava una gobba fino a 219,7 m con 0,0 m di franco (C11). Ora una strada sotto il LiDAR sotto un ponte o la GALLER, o entro 10 m (`NEAR_UNDER`, il riempimento sborda dall'impalcato), tiene il DBGT e non entra nella rampa di 10 m dei tetti vicini: 203 nodi cambiano, franco basso da 10 a 8 casi (restano solo i torrenti), C4 invariato a 31 luoghi; i triangoli di carreggiata più ripidi diventano le pareti delle spalle sotto PONTE 12 (massimo 371%, sotto l'impalcato); (2) **estremo est di PONTE 20 sospeso 6,3 m sulla trincea della Milano-Meda**: un estremo senza terreno alla sua quota entro 2,5 m, senza rampa AIR propria oltre, dove un `bridge` OSM prosegue, si allunga dentro la sua larghezza, corsia per corsia del reticolo, fino al primo lato di cella sul terreno alla sua quota (al massimo 12 m e non oltre l'OSM), con il piano lineare fra la fine del PONTE e l'appoggio. Su PONTE 20: 10,2 m, le corsie nord appoggiano esatte, quella sud finisce 1,2–1,7 m sopra la scarpata (prima 6,3 m); (3) **altezza libera della copertura 0,87 m**: era il bordo delle fosse, dove le celle del reticolo prendono i buchi delle scale nel LiDAR; oltre 1 m dalle fosse S sulla GALLER è 222,55 m (dopo il punto 1 il DBGT delle strade sopra vince sui buchi), cioè 2,80 m liberi sopra il fondo. Il rapporto ha in più `C5.estremi_senza_spalla` (un estremo dell'impalcato senza spalla entro 4 m) e le `uscite_vie_osm_senza_spalla` ignorano le vie OSM che corrono a lato dell'impalcato (via Vignazzola è 3–4 m a nord del PONTE: i due casi del rapporto erano fianchi). Restano aperti: PONTE 1 (passerella sul Seveso, x 726 z −1415) ha l'estremo est 2,5 m sopra la sponda, senza via OSM che confermi un allungamento; via Vignazzola in OSM (e quindi nelle strade del gioco) corre 3–4 m fuori dall'impalcato; vicino ai bordi di marciapiedi e carreggiate sopra l'alveo (es. PONTE 15) il passo di 2 m mette il nodo successivo nel fiume, buchi fino a 3 m larghi meno di una cella; la copertura non ha un pavimento camminabile: sotto la GALLER `H.surface` dà la strada sopra, la fase 6 deve usare `fondo` per chi è nel sottopasso; i binari OSM corrono fino a 3 m fuori dagli assi EL_FER e sul ponte della ferrovia sul Seveso (PONTE 11) lungo la linea OSM si salta di 1,7 m: il profilo dei treni va preso dagli assi DBGT.
4. **`altezze3.js` e mesh.** Si fanno `H.*` e la mesh di tile da `H.onTri`, caricando i `.bin` in `tileTick`. Le vecchie funzioni restano come alias. Verifica: `H.check()` dà 0,000; screenshot della stessa inquadratura prima e dopo su via Indipendenza, sul Seveso e su un cavalcavia, senza buchi né crepe.
   *Fatta il 24/10 (`src/altezze3.js`, assemblato prima di `interp3.js`; `python src/terreno_gioco.py --da <uscite fasi 2-3>` impacchetta `terreno/`).* Finché `brianza.json` non porta `decks`, `rv.zw` e `meta.ver = 2` (fasi 7-8), il gioco legge il motore nuovo da `terreno/`: 202 `.bin` gzip (3,9 MB, tutti a 2 m) e `terreno/indice.json` (463 KB: passo di ogni tile, i 22 impalcati e le 2 fosse di `decks_meda.json`, il pelo dell'acqua `zw` dei 27 assi DBGT, quote sul mare a cui si toglie `terrain.base`). Senza `indice.json` tutta la mappa va col motore vecchio. Scelte: (a) **caricamento**: `H.tick` in `tileTick` scarica il `.bin` entro 1150 m e lo libera oltre 1600 m se né la tile né una vicina è costruita; una tile si costruisce solo quando sono arrivati il suo `.bin` e quelli delle 8 vicine (così il bordo prende già S); le tile della stazione si caricano prima di costruire il mondo; (b) **mesh**: i nodi del `.bin` come sono, i triangoli di `H.onTri` (diagonale u >= v), indicizzati; le normali si calcolano anche attraverso i bordi con i nodi della tile vicina, quindi niente cucitura nella luce; la maschera di profondità è la stessa geometria 0,5 m sotto; (c) **fuori da Meda e nelle tile senza `.bin`** risponde il motore vecchio (`farH` = griglia a 10 m meno le trincee di `D.cut`, `riverCut` per il disegno); un punto sul bordo di una tile vecchia prende la quota della tile di S vicina e la tile vecchia accanto a una di S si costruisce a 2 m, così il bordo non si apre; (d) **alias**: `groundH`, `visH`, `surfAt`, `nodeY` chiamano `H.ground`, `H.vis`, `H.surface`, `H.node` con un `console.warn` per sito di chiamata; (e) **transitorio fino alle fasi 5-6**: `H.surface` aggiunge ancora `onSide`/`onPlatform`/`bumpAt` (lo strato `step` è vuoto), le strade di `D.roads` con `d` e i binari sopraelevati stanno sull'impalcato nuovo più vicino alla loro quota vecchia entro 3 m, altrimenti su S (`deckY`); gli impalcati si disegnano dai `tri` di `decks` con lastra di `sp` e fianchi sui lati che non sono spalle (la copertura no: è S); l'asfalto sopra un ponte che scavalca solo acqua o campi si drappeggia sul ponte (`H.street`); il fiume è un piano a `zw` tra le sponde OSM, le testate dei tombini vanno dal fondo di S al piano sopra; (f) **drappeggio nelle tile di S**: i poligoni di `polyFill` provano i lati ogni 2 m invece che in tre punti e si dividono fino a 2 m invece di 4 (stessa regola per lato, i vicini restano cuciti): prima sul Seveso i prati con le corde lunghe di earcut affondavano oltre la maschera (macchie chiare di terreno nudo) o lasciavano fessure sottili sulle sponde; +0,4% di triangoli sulle 9 tile della stazione. Controlli: **G1** `H.check()` (tasto J con `DEBUG`) su 88 tile di S costruite in 8 punti di Meda, 1000 punti ciascuna, scarto massimo mesh − `H.base` 0,0001 m (float32), 1760 raggi verticali sulla mesh 0,000; prova di avvio senza errori (i due 404 ci sono anche prima della fase); fuori da Meda le tile si costruiscono col motore vecchio. Foto prima/dopo con la stessa camera (quote assolute della foto di prima) in `scratchpad/fase4/` (prima) e `scratchpad/fase4/dopo2/` (dopo): via Indipendenza (2), Seveso (5, con PONTE 15 e 16), svincolo della Milano-Meda con PONTE 20 (4). Il Seveso ora scorre nell'alveo di S invece che fra i muri del taglio a 2,4 m; la Milano-Meda corre nella trincea del DBGT e PONTE 20 la scavalca a quota dei campi, dove il motore vecchio aveva un viadotto alto 6 m con i rilevati. Restano aperti: (1) **gradino sul confine di Meda**: fra il nodo di bordo (S) e il primo nodo della tile vecchia (TINITALY) lo scarto è p50 0,06, p90 0,33, p99 1,28 m, massimo 4,58 m a x −857 z 958 (trincea della Milano-Meda): non è una crepa ma un salto in 2 m, sparisce con la fase 8; (2) le sponde del fiume a passo 2 m tagliano il piano dell'acqua a dente di sega (PONTE 15 a nord): è il ritaglio sul poligono dell'alveo della fase 5; (3) i drappeggi restano corde sui triangoli (fino a 0,25 m sotto o 0,4 m sopra S) finché la fase 5 non li ritaglia sulla griglia; (4) gli impalcati non hanno ancora piloni né spalle murate (fase 6) e i muri di collisione del fiume sono ancora quelli del motore vecchio, calcolati su `farH`; (5) la griglia lontana (40 m) sta sopra S nelle valli: si vede solo dove la tile fine non è ancora costruita (fase 7).
   *Verifica del 24/10.* Riprodotti i numeri con letture proprie: `.bin` del repo identici byte per byte alle uscite delle fasi 2-3 (202 su 202) e `terreno_gioco.py` rifatto dà gli stessi 203 file; vertici della mesh di 112 tile di S contro i `.bin` decodificati a parte nella pagina (gunzip e intestazione propri) scarto 0,000004 m in quota e 0,0001 m in pianta; `H.check()` in 13 punti (8 di Meda e 5 sul confine) 0,0002 m al massimo, raggi 0,000; crepe misurate sui bordi in comune di 215 coppie di tile costruite (165 S-S, 21 S-vecchia, 29 vecchia-vecchia), ogni vertice di una contro la spezzata del bordo dell'altra: 0,000 su S-S e S-vecchia, 0,011 m fra due tile vecchie a 2 e 10 m (giunzione a T del motore vecchio, uguale su `cc191fe`); 31 500 raggi verticali (un terzo sui bordi delle tile) senza un buco; a S tolto `indice.json` tutta la mappa va col motore vecchio, con 31 `.bin` mancanti in mezzo a Meda le tile vecchie si cuciono a S senza crepe; profilo di `H.surface` ogni 0,5 m sulle 1368 strade dentro S: 45 luoghi con un salto oltre 0,25 m (massimo 0,72 m, rampe ripide di S stessa, es. x −74,6 z −688), contro 131 (massimo 3,26 m) del motore vecchio sulle stesse strade; guida a 16 m/s su PONTE 16, sulla Milano-Meda sotto PONTE 20 e su via Indipendenza senza salti oltre 0,2 m per frame. Corretti due errori: (1) **muro di 6,7 m sulla Milano-Meda al confine ovest di Meda** (x −1379, z −70 e −84, guidando si saliva di 2,8 + 3,0 m in due frame): il motore vecchio ha lì un viadotto che S non ha, e il terreno sul confine aveva gradini fino a 4,58 m in 2 m. Ora nelle tile vecchie entro 120 m da S (raggio scelto perché con 80 m la rampa veniva al 12-14% e i tappi piatti alle giunzioni di `surfAtOld` davano gradini di 0,6-0,7 m) il terreno vecchio è portato a S sul bordo (differenza S − vecchio nel punto più vicino di ogni tile di S, pesi 1/d², smoothstep a 120 m: esatto sul bordo, continuo agli angoli); gli impalcati vecchi scendono, o salgono, alla quota di S dove la loro strada entra in S (primo attraversamento lungo le strade, entro 240 m) con lo stesso peso, così le rampe di una giunzione restano insieme (proiettare sul bordo prendeva quote estranee, fino a 12 m sotto il viadotto); il taglio del fiume vecchio e il suo pelo sfumano allo stesso modo. Dopo: 108 strade che attraversano il confine, salto massimo 0,26 m ogni 0,5 m (prima due oltre 6 m); gradino del terreno sul confine p50 0,02, p90 0,14, p99 0,86, massimo 1,21 m (pendenze di S); guidando sulla Milano-Meda al confine salto massimo 0,24 m per frame, come nel motore vecchio; (2) **muri, guardrail, pilastri e impalcati di `surfAt` costruiti all'avvio leggevano S solo entro 1250 m dalla stazione**: altrove usavano le quote vecchie, e il mondo cambiava col punto di partenza; due pilastri del vecchio viadotto restavano come ostacoli invisibili alti 9 m vicino a PONTE 20 (x −35,5 z 766,7; x 46,1 z 962,2). Ora i 202 `.bin` arrivano tutti prima di costruire il mondo e non si liberano più (16 MB in memoria), e nelle tile di S guardrail e pilastri vecchi stanno su `deckY` come li disegna la tile: 0 pilastri invisibili. Il caricamento costa poco col server raggiunto da `127.0.0.1` (202 file in 0,2 s, avvio fino al pulsante 7,7 s qui), molto da `localhost` (10,6 s: Chrome aspetta circa 300 ms per connessione, IPv6 poi IPv4, e `http.server` chiude ogni connessione): conviene aprire `http://127.0.0.1:8013/` oppure fare un pacco unico. Foto prima (motore vecchio, `dda9389`) e dopo con le stesse camere in `scratchpad/fase4v/prima`, `prima_x`, `prima_t`, `prima_b` e `scratchpad/fase4v/finale`, affiancate in `scratchpad/fase4v/fogli/`: le 11 inquadrature della fase più PONTE 12, PONTE 1, il sottopasso, la Milano-Meda sul Tarò, due punti fuori da Meda, due sul confine; niente buchi né crepe, fuori da Meda nessun cambiamento (i colori delle case cambiano da un avvio all'altro anche prima della fase). Restano aperti: (1) gli impalcati fatti di celle da 2 m mostrano i fianchi a scalini dove la cella sporge dalla strada (ponti non segnati della Milano-Meda sul Tarò): il bordo va preso dal `nucleo` e dalle carreggiate nella fase 6, con spalle e parapetti; lì l'asfalto drappeggiato fa una piega dove comincia l'impalcato (fase 5); (2) il raccordo sul confine è transitorio: il vecchio viadotto della Milano-Meda a ovest di Meda scende fino al 9% entro 120 m e lascia i tappi piatti alle giunzioni; sparisce con la fase 8; (3) dente di sega dell'acqua sulle sponde, drappeggi a corda, muri di collisione del fiume sul terreno vecchio, griglia lontana: restano come scritto sopra; (4) le rampe di S oltre il 50% su strade (C6 della fase 2) si sentono guidando: sono il contenuto di S, non della mesh.
5. **Superfici ritagliate e `step`.** Si fanno `clipToGrid` per asfalto, piazze, prati e `VBuf`, coperchi e cordoli dei marciapiedi, piano dell'acqua. Si toglie `polyFill` con il drappeggio. Verifica: niente z-fighting sulle tre inquadrature; il conteggio dei triangoli per tile non deve superare quello di oggi.
   *Fatta il 24/10 (`altezze3.js`: `H.clipPoly`, `H.clipTri`, `H.cutLine`, `H.joinPieces`, `H.coverCells`, strato `step`; `world3.js`: `clipFill`, `clipDrape`, `kerbRing`, `cellOwners`; `polyFill` e `mkMesh` li chiamano tramite `assemble3.py`).* Scelte: (a) **taglio sulle celle**: un poligono si triangola una volta (earcut), le celle che nessun lato attraversa e con il centro dentro sono intere (i loro due triangoli come sono), le celle sul contorno prendono i triangoli del poligono tagliati a righe di celle e sulla diagonale u >= v, poi **ricuciti** per triangolo di cella (i lati in comune si annullano, il contorno rimasto si triangola una volta: senza ricucitura l'asfalto costava 15 000 triangoli per tile invece di 7 800). Strisce, nastri, quadri e dischi drappeggiati (`FBuf`, `VBuf`, i buffer dei monumenti) li taglia `clipDrape` in `mkMesh`, con gli attributi interpolati; i pezzi con le stesse funzioni affini (le due metà di un quadro, le strisce di un colore) si ricuciono allo stesso modo; la faccia di sotto delle strisce a due facce non si disegna più su S; (b) **il terreno delle tile di S scrive la sua profondità** e la maschera a −0,5 m sparisce: i pezzi stanno su S senza sollevamento e se ne staccano con `polygonOffset` (−1, −4, messo da `mkMesh` sui materiali drappeggiati). Con la maschera ogni superficie tagliata si sarebbe aggiunta ai 62 500 triangoli di terreno e maschera e il conteggio saliva fino a +90%; (c) **celle possedute**: prima di costruire la tile, `cellOwners` dà ogni cella coperta per intero da un poligono di prati (1), aree pavimentate (1,1), acqua (2), vialetti (3), piazze (4), asfalto (5) o vie pedonali (5,1) al livello più alto che la copre; quel livello la disegna al posto del terreno, con lo stesso materiale che scrive la profondità, sugli stessi due triangoli (H.check li legge da lì). I poligoni disegnano solo le celle del contorno, e i loro pezzi spariscono dove un livello pari o più alto possiede la cella (come oggi l'asfalto copriva il prato). Le vie sotto un impalcato libero non possiedono celle: il ponte ha la sua lastra; (d) **strato `step` dal gioco** finché la build non scrive `tiles[t].st`: marciapiedi (1, 0,15 m), banchine (2, 0,55 m) e spartitraffico (3, 0,15 m) delle tile di S, indice a 10 m; `H.surface` e `H.kind` nelle tile di S lo usano al posto di `onSide`/`onPlatform` (stesso risultato, in più gli spartitraffico); `H.ground` non somma ancora `step`: i consumatori che aggiungono `SIDE_H`/`PLAT_H` a mano migrano nella fase 6; (e) **coperchi** di marciapiedi e spartitraffico tagliati sulle celle a S + h; **cordoli** (`kerbRing`) tagliati dove il lato attraversa celle e diagonali, poi ridotti ai punti che servono al profilo di S entro 1 cm, con la base 0,1 m sotto S e la cima 1 cm sopra il coperchio (nessuna corda apre una fessura); (f) **vie sopraelevate vecchie che corrono su S** (`r.d` senza impalcato nuovo sotto, `deckY` dà S): si disegnano sulle celle con il materiale della loro classe (asfalto, via pedonale, vialetto), con dischi di raccordo e trattini sulle celle; dove `deckY` trova un impalcato resta il nastro alla quota della lastra. È il punto 4-5 di `collaudo.md`: il vialetto del sovrappasso Motta (vie 1421, 3527, 1420) era un nastro piatto alla quota del suo asse ogni 3 m, sospeso sopra il bordo del rilevato e sprofondato nella scarpata; (g) **acqua**: un velo a `zw` tagliato su ogni triangolo di cella dove `zw − S` cambia segno, che parte dalle celle dell'alveo (materiale 4) e si allarga alle celle vicine finché l'acqua ne bagna un angolo (al massimo 12 m), quindi riempie l'alveo fino alle sponde di S e mai una conca che il fiume non raggiunge; le aree acqua OSM con almeno il 30% delle celle sull'alveo non si disegnano; un fiume OSM senza alveo in S (fuori dal DBGT, a nord di Meda) tiene la striscia fra le sue sponde a `H.water` della fase 4, perché il LiDAR non ha il letto e il velo veniva a macchie; (h) **eccezioni senza taglio**: le rotaie (strisce di 12 cm a 11 cm su un letto liscio) e le strisce dei parcheggi (pezzi da 2,5 m, 5 cm sopra S) e le file dei campi e degli orti di `paesaggio3.js` (8 cm sopra S, pezzo dimezzato finché S non sale più di 3 cm sopra la corda) restano vertici su S: tagliate, le file dei campi portavano una tile di campagna a +51%, e a pezzi da 6 m 4 cm sopra S lasciavano buchi dove il campo ha un dosso; la striscia d'ombra al piede dei muri sta 6 cm sopra S invece di 3 (tagliarla costava sette volte i triangoli); le pozze di luce dei lampioni hanno gli angoli su S; (i) la costruzione della tile ha più fette (`yield`): fetta più lunga 20-34 ms (prima 16-25), tile intera 150-200 ms nel centro (prima 63-137). Controlli: **triangoli per tile** (tutte le mesh del gruppo della tile, istanze comprese), stesse inquadrature su `15875c5` e dopo: sulle 20 tile delle inquadrature tutte sotto, da −0,7% (13_7, la stazione) a −21,2%, in tutto 2 569 315 → 2 208 629 (−14,0%); su 139 tile di S costruite da 36 punti a passo 500 m su tutta Meda tutte sotto, da −0,7% a −37,9%, media −19,7%, in tutto 16 285 626 → 13 134 409; **fisica**: `H.surface` su 19 691 punti a caso nelle tile di S, con e senza `cy`, uguale al millimetro tranne 14 punti sugli spartitraffico (+0,15 m, lo strato `step`); **G1** `H.check()` 0,0000 m su 12 tile e sui raggi; **collaudo 4-5**: lungo i vialetti 1421, 3527, 1420 e le rampe 564, 124, 113, 3520, 3529, ogni 0,5 m, |superficie disegnata − `H.surface`| prima medio 0,06 m, massimo 0,27 m, 105 punti oltre 0,1 m; dopo 0,000 sulle parti su S, 0,06 sugli impalcati (il nastro sta 6 cm sopra la lastra), massimo 0,09, nessun punto oltre 0,1 (resta un punto a 2,67 m su via 113 sotto un altro impalcato, uguale prima e dopo); **z-fighting**: nessuno sulle tre inquadrature (via Indipendenza 2, Seveso 3, cavalcavia 3) né su altre 21 (i punti 4-5 da sette camere, sottopasso, PONTE 1, 12, 15-16, Tarò, spartitraffico, marciapiede, confine, fuori da Meda); prova di avvio senza errori. Foto prima (`15875c5`, servito da un worktree) e dopo con le stesse camere in `scratchpad/fase5/prima` e `scratchpad/fase5/dopo`, affiancate in `scratchpad/fase5/fogli/`. Restano aperti: (1) **il dente di sega dell'acqua è la forma di S**: le sponde dell'alveo bruciate per nodo a passo 2 m sono gradini di una cella, e la linea dove l'acqua le incontra segue le righe della griglia; ora che il terreno scrive la profondità si vede come prima; va lisciata la sponda nella build (distanza dal bordo vero, non nodo dentro/fuori); (2) l'asfalto di una via che passa su un impalcato non libero (sopra un'altra strada) si disegna ancora su S sotto il ponte, come prima: i poligoni `as` sono l'unione di tutte le vie e non dicono quale sta sopra; (3) le pozze di luce delle auto (piano rigido davanti all'auto) e dei lampioni possono essere tagliate dal terreno sui dossi, di notte; (4) `H.ground` senza `step` (fase 6); gli spartitraffico più stretti di 1,2 m restano fuori (filtro di oggi), quindi non sono né disegnati né in `step`; (5) la tile della stazione (13_7) sta solo 0,7% sotto il conteggio di prima: strisce sottili e vialetti sono quasi tutti contorno; (6) gli impalcati restano a celle da 2 m con i fianchi a scalini (fase 6).
6. **Fisica e consumatori.** Si porta `surfAt` su `H.surface` e si migra la tabella 3.1. Si tolgono `DECKG`, `trenchCut`, `riverCut`, la scarpata fisica e gli alias. Verifica: guida e camminata sulle tre inquadrature senza scatti (registrare `y` della ruota ogni frame: salto per frame < 0,2 m fuori dai cordoli); albero vicino al Seveso appoggiato; spawn della polizia su un ponte sopra il ponte.
7. **Livello lontano.** Si fanno `tiles[t].lod`, la griglia lontana da `S`, i nastri, le scatole e gli impostor, con il passaggio tra fine e lontano. Verifica: C8; video a 120 km/h in diagonale senza pezzi vuoti oltre 580 m; FPS non peggiori di oggi.
8. **Fuori da Meda.** Fallback OSM (strade, ponti lineari, fiumi a U) su tutto il riquadro. Poi si estraggono i DBGT di Seveso, Lentate e degli altri (`docs/dati.md`), un comune alla volta, ciascuno con il suo rapporto. Verifica: C1–C12 per comune, cucitura sul confine (C7) e sul confine DBGT/OSM (C5 sui nodi di confine).
9. **Pulizia.** Si tolgono `propagate()`, `RAMP_G`, `pin`/`cap`, `cuts`, `LID_FADE` come blend, `deckH`, la chiave `cut` e `meta.ver = 1`. Verifica: build completa entro C12; `grep` di `groundH|visH|surfAt|trenchCut` vuoto fuori da `altezze3.js`.
