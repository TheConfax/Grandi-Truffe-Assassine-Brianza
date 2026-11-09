# three.js da r128 a 0.186.1: preparazione

Preparazione in sola lettura, finita il 9/11. Codice letto: snapshot `snap7` (`src/*.js`, `src/game.src.html`, `src/assemble3.py`).
Per il confronto ho scaricato i sorgenti veri delle due versioni con `npm pack` (r128 e 0.186.1); i diff dei chunk qui sotto vengono da lì.
L'aggiornamento vero partirà più avanti, su un ramo suo da `nightly`.

In breve:
- arrivo: **0.186.1**, caricata con un import map; il gioco è già un modulo, quindi il cambio di caricamento è piccolo;
- **39 voci** da sistemare: **25 facili, 13 medie, 1 difficile**; tre gruppi fermano il gioco, una decina cambia l'aspetto senza dare errori;
- 15 punti fissi fotografati a 1920×1080, con link; le foto vere vicine si trovano solo per 6 punti (Mapillary a Meda è quasi vuota);
- piano in 7 passi, ognuno provabile da solo.

## 1. Versione di arrivo

**three 0.186.1** (r186, uscita il 24/09/2026). La 0.187.0 è del 30/10/2026: ha 10 giorni, quindi non è ancora stabile da due settimane. La 0.186.1 è una correzione della 0.186.0 (08/09).

Cosa ci porta:
- solo WebGL2 (WebGL1 è stato tolto in r163); il nostro codice usa già i rami `__VERSION__ >= 300`;
- tone mapping **AgX** e Neutral nel core;
- **BatchedMesh** nel core;
- gestione del colore automatica (`ColorManagement.enabled = true`, uscita `SRGBColorSpace`);
- addon `EffectComposer`, `OutputPass`, `SMAAPass`, `TAARenderPass`, `SSAARenderPass`, `GTAOPass`, `SAOPass`;
- **novità utile:** `examples/jsm/lights/SunLight.js` con `SunLightShadow.js`. È un sole con **ombre a cascate**: 2 cascate che sfumano l'una nell'altra, adattate da sole al campo della camera. `WebGLRenderer` le disegna da solo (`NUM_SUN_LIGHT_SHADOWS` nei chunk). È proprio quello che serve contro le ombre che "inseguono". È codice nuovo e va provato.

### Come si carica
Dalla r160 non c'è più `build/three.min.js`. Restano `three.module.min.js`, che importa `three.core.min.js`, e gli addon in `examples/jsm/`, tutti moduli ES.

**Il gioco è già un `<script type="module">`** (lo fa `assemble3.py` riga 20, con top-level await). Oggi il modulo usa il `THREE` globale messo da `three.min.js`. Basta quindi:

```html
<script type="importmap">
{ "imports": {
  "three": "https://cdnjs.cloudflare.com/ajax/libs/three.js/0.186.1/three.module.min.js",
  "three/addons/": "https://cdn.jsdelivr.net/npm/three@0.186.1/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE_NS from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
const THREE = Object.assign({}, THREE_NS, { Sky }); window.THREE = THREE; /* copia modificabile: il namespace di un modulo è congelato */
...il gioco come oggi...
```

- **Verificato:** cdnjs ha `0.186.1/three.module.min.js` e `three.core.min.js`, jsdelivr ha gli addon (tutti HTTP 200). Gli addon importano `'three'` e l'import map li manda allo stesso file: una sola copia di three.
- **Perché la copia `Object.assign`:** il codice riassegna `THREE.CanvasTexture` (foto3_colori.js), e un namespace di modulo non si può modificare (in strict mode dà errore). `window.THREE` resta per gli script di prova che lo usano da `page.evaluate`.
- **GitHub Pages e server locale** vanno uguale (http). Da `file://` i moduli non partono, ma già oggi il gioco non parte da lì: legge `mappa/*.bin` con `fetch`.
- **Alternativa:** copiare i file nel repo, in `lib/three-0.186.1/` (licenza MIT), e far puntare l'import map lì. Così non dipendiamo dal CDN. Da decidere con Carlo.
- In `assemble3.py` si toccano la riga 612 (i due tag di r128: `three.min.js` e `examples/js/objects/Sky.js`) e l'inizio del modulo (riga 20).

## 2. Inventario di cosa si rompe

Difficoltà: **F** facile (sostituzione di testo), **M** media (va capita e riprovata a occhio), **D** difficile (va ripensata).
"Muto" vuol dire che non dà errore e cambia solo l'aspetto: sono i più pericolosi.

### 2a. Chunk di three usati dai nostri shader (diff vero r128 → r186)

| Chunk | Cambiato? | Effetto per noi |
|---|---|---|
| `common`, `begin_vertex`, `project_vertex` | solo aggiunte (alphahash, batching) | ancore e variabili (`transformed`, `mvPosition`, `objectNormal`, `transformedNormal`) ci sono ancora: OK |
| `fog_pars_*`, `fog_vertex`, `fog_fragment` | `fogDepth` → `vFogDepth` | chi scrive `fogDepth` a mano non compila |
| `map_fragment` | `texelColor`/`vUv` → `sampledDiffuseColor`/`vMapUv`; niente `mapTexelToLinear` | chi sostituisce il chunk intero va, se non usa `vUv`; chi modifica il testo del chunk sbaglia senza errori |
| `emissivemap_fragment` | `vUv` → `vEmissiveMapUv`; niente `emissiveMapTexelToLinear` | come sopra |
| `color_fragment` | unito il caso `USE_COLOR` | OK |
| `aomap_fragment` | `vUv2` → `vAoMapUv`; `geometry.normal` → `geometryNormal` | le nostre aggiunte dopo il chunk usano solo `reflectedLight`: OK |
| `shadowmap_vertex` | riscritto; aggiunte le cascate del sole e le coordinate degli spot | usa ancora `worldPosition`: i nostri spostamenti prima del chunk vanno |
| Lambert intero | **luce per pixel** (r128: per vertice, `vLightFront/Back`, `getShadowMask()`) | l'ordine resta: map, color, normal, emissivemap, luci, aomap, `vec3 outgoingLight =`. Spariscono solo `getShadowMask()` e `gl_FrontFacing ? vLightFront : vLightBack` |
| `vUv` | non esiste più senza `USE_UV` | **ogni nostro frammento che legge `vUv` non compila**; il sostituto è `vMapUv` (stessa trasformazione della map di r128) |
| `mapTexelToLinear()` | tolta | le texture sRGB arrivano già lineari dall'hardware: basta toglierla |

### 2b. Voce per voce

| # | File:riga | Cosa fa oggi | Cosa succede in r186 | Correzione probabile | Diff. |
|---|---|---|---|---|---|
| 1 | game.src.html:167, assemble3.py:612 | carica `three.min.js` r128 e `examples/js/objects/Sky.js` r128 | i file non esistono più | import map + import (sezione 1) | F |
| 2 | foto3_colori.js:6-10 (iniettato da assemble3.py:611) | converte a mano hex e css da sRGB a lineare | three lo fa già da solo: **doppia conversione**, tutto più scuro e saturo (muto) | togliere il blocco Color | F |
| 3 | foto3_colori.js:11-12 | sottoclasse di `CanvasTexture` con `encoding = sRGBEncoding` | `encoding` non esiste più (r162): le texture disegnate restano lineari, colori slavati (muto) | `this.colorSpace = THREE.SRGBColorSpace` | F |
| 4 | world3.js:761, 796, 2603 | `t.encoding = THREE.sRGBEncoding` | come la 3 (muto) | `t.colorSpace = THREE.SRGBColorSpace` | F |
| 5 | facciate3.js:218 | maschera delle facciate, `msk.encoding = LinearEncoding` | `LinearEncoding` è undefined e la sottoclasse la rende sRGB: maschera sbagliata (muto) | `msk.colorSpace = THREE.NoColorSpace` | F |
| 6 | foto3.js:82 | `outputEncoding = sRGBEncoding`, ACES, esposizione 1.1 | `outputEncoding` è ignorato (l'uscita è già sRGB di base) | togliere; il tone mapping si rifà al passo 3 | F |
| 7 | game.src.html:247-252, extras.js:24, foto3.js:125 | intensità di cielo (0.78), sole (0.88), fari; r128 senza `physicallyCorrectLights` moltiplica per π | la modalità "legacy" è stata tolta in r165: **tutto circa 3 volte più scuro** | moltiplicare le intensità per `Math.PI` al passo 2, ritarare al passo 3 | F |
| 8 | extras.js:24 | `SpotLight(…, 70, 0.55, 0.6, 1.2)` dei fari, su Lambert per vertice | decadimento fisico (1/d^decay con finestra) e luce per pixel: i fari ora illuminano davvero l'asfalto e si sommano alla macchia finta `HEADPOOL_MAT` | ritarare intensità e decay; forse togliere la macchia | M |
| 9 | game.src.html:226 | `PCFSoftShadowMap` | tolto: three avvisa e usa `PCFShadowMap` (mappa di profondità, altro filtro) | `PCFShadowMap` + `shadow.radius`; ritarare i bias (-0.0007, normalBias 0.03) | M |
| 10 | fusi3.js:50 | `instanceMatrix.updateRange.count = …` | `updateRange` tolto in r169: **errore, il gioco si ferma** | `clearUpdateRanges(); addUpdateRange(0, n*16)`, idem per `instanceColor` | F |
| 11 | world3.js:883 | `AO_GROUND_MAT` con `MultiplyBlending` | ora vuole `premultipliedAlpha: true`; senza, errore in console e fusione lasciata a caso | `premultipliedAlpha: true` (con alpha 1 il risultato è uguale) | F |
| 12 | world3.js:884 | sostituisce `fog_fragment` usando `fogDepth` | non compila | `vFogDepth` | F |
| 13 | world3.js:815 | chiome degli alberi: luce "di fronte" su tutte e due le facce delle carte | con il Lambert per pixel il testo non c'è più: niente sostituzione, il retro delle carte si illumina al contrario (muto) | agganciarsi a `normal_fragment_begin` e togliere `* faceDirection` per `MAT.crown` | M |
| 14 | world3.js:922-928 (`FAC_WALL`, finestre disegnate) | usa `vUv`; modifica il testo di `ShaderChunk.map_fragment` (`texture2D( map, vUv )`) e di `emissivemap_fragment` | `vUv` non compila; le sostituzioni nel testo non trovano niente | riscrivere i due pezzi con `vMapUv`/`vEmissiveMapUv` sul testo nuovo | M |
| 15 | extras.js:14-16 (finestre accese) | `vUv` nel frammento | non compila | `vMapUv` | F |
| 16 | facciate3.js:229-289 (`MAT.fac`, facciate 3D) | `vUv`, `mapTexelToLinear`, `textureGrad` su map e emissiveMap | non compila | `vMapUv`; togliere `mapTexelToLinear` | F |
| 17 | foto3.js:32-60 (marciapiede a blocchi) | `vUv`, `mapTexelToLinear` | non compila | come la 16 | F |
| 18 | foto3.js:160-178 (`FOTO_FACADE`, vetri che specchiano) | `vUv`; usa `cameraPosition` in un Lambert | non compila. Inoltre **dipende da un bug di r128**: lì `cameraPosition` nei Lambert vale (0,0,0), in r186 è giusta, quindi il riflesso dei vetri cambia (muto) | `vMapUv`; ritarare i vetri guardandoli | M |
| 19 | foto3.js:187-256 (asfalto senza ripetizioni) | `vUv`, `textureLod(map, …, 9.)`, `mapTexelToLinear`; la toppa con `pow(…, 2.2)` | non compila; la media e il miscuglio ora si fanno in lineare (piccola differenza) | `vMapUv`, togliere `mapTexelToLinear`. La toppa (`uPat`, senza colorSpace) tiene il suo `pow` | F |
| 20 | pattern3.js:38-57 (prato, terra, porfido, ciottoli) | `vUv`, `mapTexelToLinear` | non compila | come la 16 | F |
| 21 | negozi3.js:239-264 (`NG_ROOM_GLSL`, interni delle vetrine) | `vUv`, `mapTexelToLinear`, `textureLod/Grad(map)` | non compila | come la 16; ricontrollare l'atlante con `premultiplyAlpha = true` | F |
| 22 | negozi3.js:218-226, 480-511 (LOD, insegne, luce sul marciapiede) | ancore `common`, `project_vertex`, `shadowmap_vertex`, `map_fragment`, `emissivemap_fragment` | le ancore ci sono; nessun `vUv` | nessuna | F |
| 23 | riflessi3.js:66 | `.replace('* getShadowMask();', '* (rfSh = getShadowMask());')` | il Lambert nuovo non chiama più `getShadowMask()`: `rfSh` resta 1 e **il riflesso del sole compare anche all'ombra** (muto) | leggere l'ombra del sole dentro il calcolo delle luci (`lights_fragment_begin`, luce 0 o cascata del sole) e passarla al riflesso | D |
| 24 | facciate3.js:224-226 (`FAC_CAMGL`) | ricava la camera dalla `viewMatrix` per aggirare il bug di `cameraPosition` | funziona ancora | si può semplificare con `cameraPosition` (non serve subito) | F |
| 25 | facciate3.js:402-427 (`facRecMat`, sole nelle finestre incassate) | sposta `worldPosition` prima di `shadowmap_vertex`; dopo `aomap_fragment` scala `reflectedLight` | funziona; con `SunLight` lo spostamento vale anche per le cascate | riprovare al passo 5 | M |
| 26 | world3.js:878-880 (`AO_WALL`) | dopo `aomap_fragment` scala `reflectedLight` | funziona; ora la luce è per pixel, il peso 0.35 sul sole va riguardato | ritarare a occhio | F |
| 27 | extras.js:28-30 (`GLOW_FOG`) | regex su `ShaderChunk.fog_fragment` (`gl_FragColor.rgb = mix(`) | la riga c'è ancora: funziona | nessuna | F |
| 28 | acqua3.js:11-49 (`ShaderMaterial` dell'acqua) | include della nebbia, `cameraPosition`; niente tone mapping né spazio colore | compila (three traduce il GLSL1); esce lineare e senza tone mapping, come oggi | aggiungere `#include <tonemapping_fragment>` e `#include <colorspace_fragment>` al passo 3, poi ritarare l'acqua | M |
| 29 | foto3.js:88-98 (cielo `Sky`) | `replace('const vec3 cameraPos = …')` e `replace('gl_FragColor = vec4( retColor, 1.0 );')` | Sky.js nuovo: usa già `cameraPosition`, finisce con `vec4( texColor, 1.0 )`, **non ha più il `pow` di r128** e ha **nuvole sue** (`cloudCoverage` 0.4 di base) | riscrivere le due sostituzioni su `texColor`; decidere fra nuvole di Sky guidate dal meteo o `cloudCoverage = 0`; ritarare `uSkyK` | M |
| 30 | foto3.js:98-116 (colore del cielo letto da un render target) | in r128 il tone mapping si applicava **anche ai render target** | in r186 sui render target non c'è tone mapping: i colori letti cambiano (muto) | ritarare foschia e vetri al passo 3 | M |
| 31 | foto3.js:103 | `renderer.capabilities.isWebGL2` | c'è ancora (sempre true) | nessuna | F |
| 32 | foto3.js:145 | `color.convertSRGBToLinear()` sulle montagne, a ogni frame | il metodo c'è; tolta la voce 2, controllare che la conversione non diventi doppia | guardare `_far`/`_near` | F |
| 33 | InstancedMesh (29 posti; es. landmarks3.js:30, oggetti3.js:152, sfondabili3.js:279, paesaggio3.js:366) | in r128 nascono con `frustumCulled = false` | in r186 nascono `true` con una sfera calcolata **una volta** sulle istanze: chi si muove dopo (oggetti abbattuti, pezzi di barriera) può sparire (muto) | in un file di compatibilità, una sottoclasse che rimette `false`; pezzi3.js mette poi la sua `cullS` come oggi | F |
| 34 | pezzi3.js:160 | ridefinisce `Frustum.prototype.intersectsObject` per usare `o.cullS` | r186 chiama `object.intersectsFrustum(f)`, che chiama ancora `f.intersectsObject(this)`: funziona | nessuna | F |
| 35 | pezzi3.js:187 | `sun.shadow.updateMatrices(sun)` e `getFrustum()` per spegnere i tile fuori dall'ombra | uguale con `DirectionalLight`; con `SunLight` i frustum sono 2 (`getFrustum(i)`) | al passo 5 controllare tutte e due le cascate | M |
| 36 | pezzi3.js:198-212 (`vetrinaShader`) | precompila gli shader con `renderer.compile` su un gruppo invisibile | `compile` passa ancora tutti i materiali: funziona; ma le chiavi dei programmi cambiano con luci e ombre | rifare la lista `VETRINA` dopo il passo 5 (o `compileAsync`) | M |
| 37 | game.src.html:1862-1870 (titolo) | allarga la camera d'ombra a 230 m per il sorvolo | con `SunLight` la camera d'ombra non si usa più | togliere al passo 5 | F |
| 38 | MeshDepthMaterial `RGBADepthPacking` (world3.js:816, negozi3.js:230-231) | ombre di foglie e insegne | le ombre sono mappe di profondità: il colore non conta più, l'`alphaTest` sì. Funziona | nessuna | F |
| 39 | tutti i Lambert (134 materiali) | luce per vertice | aspetto più liscio, costo GPU un po' più alto | misurare gli FPS al passo 2 (riferimento 165 sul PC di Carlo) | M |

Guardate e senza problemi: `SpriteMaterial` e `Points` (la dimensione dei punti si calcola come prima), `scene.background` con una CanvasTexture (va solo col `colorSpace` della voce 3), `ShapeUtils`, `Raycaster`, `DataTexture` Float RGBA con `texelFetch`, stencil (`stencil: true` già esplicito), `onBeforeRender` di scena e oggetti, `renderer.info`.

**Conteggio:** 39 voci, **25 facili, 13 medie, 1 difficile**.
- **Fermano il gioco:** la voce 1, la 10 e gli shader che non compilano (12 e 14-21).
- **Cambiano l'aspetto senza errori:** 2, 3, 4, 5, 7, 13, 18, 23, 29, 30, 33.

### 2c. Sostituzioni `rep(...)` di assemble3.py che toccano three
`assemble3.py` ha 274 `rep(...)`. Quasi tutte inseriscono file o cambiano gioco e fisica. Quelle che toccano three:
- riga 20 (inizio del modulo): qui vanno l'import map e gli `import`;
- riga 611: inietta `foto3_colori.js` prima del renderer (voci 2-3);
- riga 612: i due `<script>` di r128 (voce 1);
- riga 85: il terreno di fondo, `PlaneGeometry` + `MeshLambertMaterial` (OK);
- righe 439-440 e 783: `BoxGeometry` della carrozzeria con `fU` e `PlaneGeometry` della macchia dei fari (OK; la macchia va rivista con la voce 8);
- riga 782: `boxG` e `fusi3.js` (voce 10);
- riga 843: `headSpot.intensity` (voci 7-8);
- righe 672, 695, 833: solo `THREE.Vector3` (OK).

## 3. Punti fissi

Il link prende solo `?x=&z=` (più `piedi`, `mezzo`, `debug`). L'ora si mette col tasto N, o nelle prove con `window.__setTOD(h)`; la direzione si dà girando la camera. Nel gioco il giorno va dalle 7 alle 18, il tramonto è verso le 18:40.

**Per rifare le foto uguali:**
- gli script sono `threejs/script/h.mjs`, `survey.mjs` e `titolo.mjs` (nella scratchpad di questa sessione);
- il file delle viste è `threejs/finali.json`: camera e punto guardato in metri, con l'altezza sopra il suolo, più l'ora;
- comando: `node h.mjs survey.mjs ../finali.json <cartella>` con `PORTA=<porta>`.
- **Attenzione:** l'apertura dei negozi segue il giorno della settimana vero (`NG_CLOCK.day`). Per avere foto uguali va fissato il giorno, come fa `vhq_h.mjs`. Le foto di oggi sono di lunedì: per questo alle 19:30 la vetrina Barzaghi è chiusa e buia.

Foto del gioco di oggi (r128, 1920×1080): `threejs/mont/gioco/`.
Gioco e vero affiancati: `threejs/mont/1.jpg` … `15.jpg`.

| N | Cosa | Link | Camera → punto guardato, ora | Foto vera |
|---|---|---|---|---|
| 1 | Facciate con finestre 3D, via Solferino | http://127.0.0.1:8109/?x=242&z=-597&debug=1 | (242.4, 1.7, -597.3) → (276.2, 6, -627.0), 10:30 | Mapillary 2017, a 166 m |
| 2 | Vetrina di giorno, Barzaghi, corso Matteotti | http://127.0.0.1:8109/?x=247&z=-549&debug=1 | (247.0, 1.7, -549.0) → (250.2, 1.8, -552.8), 11:00 | Mapillary 2017, a 128 m |
| 3 | Vetrina di sera, la stessa | stesso | stessa, 19:30 (fissare un giorno di apertura) | no |
| 4 | Interno di vetrina, Chandelier | http://127.0.0.1:8109/?x=208&z=-578&debug=1 | (207.75, 1.6, -578.0) → (203.7, 1.3, -574.3), 20:00 | no |
| 5 | Ciottoli, via Antona Traversi | http://127.0.0.1:8109/?x=182&z=-788&debug=1 | (182.3, 1.7, -787.6) → (155.4, 0.5, -800.9), 11:00 | **Commons, Meda 2010, quasi la stessa via** |
| 6 | Porfido, Seveso | http://127.0.0.1:8109/?x=-1271&z=1468&debug=1 | (-1271, 1.7, 1468) → (-1290, 0, 1446), 11:00 | no |
| 7 | Asfalto, via Busnelli | http://127.0.0.1:8109/?x=-358&z=-10&debug=1 | (-357.8, 1.4, -10.2) → (-332.9, 0, -26.9), 12:30 | Mapillary 2017, a 161 m (solo toni) |
| 8 | Prato e bosco, Bosco delle Querce | http://127.0.0.1:8109/?x=60&z=1250&debug=1 | (60, 1.7, 1250) → (13, 4, 1321), 11:00 | Mapillary 2019, a 216 m |
| 9 | Acqua, il Seveso | http://127.0.0.1:8109/?x=-1296&z=800&debug=1 | (-1296, 3, 800) → (-1296, 0, 860), 11:00 | no |
| 10 | Cavalcavia di via Cadorna (161 m su impalcato) | http://127.0.0.1:8109/?x=-95&z=-100&debug=1 | (-95, 1.7, -100) → (0, 1.5, -35), 11:00 | no |
| 11 | Cantiere grande con gru | http://127.0.0.1:8109/?x=-38&z=37&debug=1 | (-38, 8, 37) → (-38, 4, 80), 11:00 | Mapillary 2018, a 150 m (solo toni) |
| 12 | Cielo al tramonto | come 10 | (-95, 1.7, -100) → (-300, 20, -60), 18:42 | no |
| 13 | Notte coi lampioni, via Solferino | come 1 | come 1, 22:30 | no |
| 14 | Elicottero in quota sopra Meda, verso le Alpi | http://127.0.0.1:8109/?x=300&z=-400&debug=1 | (300, 230 m assoluti, -400) → (300, 120, -1400), 14:00 | no |
| 15 | Titolo | http://127.0.0.1:8109/ | schermata prima di GIOCA | no |

**Foto vere.** Mapillary a Meda e Seveso è quasi vuota. In 11 punti su 15 non c'è nessuna foto entro 120 m, e quelle che ci sono risalgono al 2017-2019. Wikimedia Commons ha qualcosa di utile solo per i ciottoli. Per gli altri punti, nel riquadro di destra di `mont/N.jpg` c'è il link Street View (posizione e direzione), da aprire a mano solo per guardare; l'elenco completo è in `threejs/mont/streetview.json`. Le foto vere sono solo un riferimento e non vanno nel repo (licenze CC-BY-SA).

**Cosa si vede già dal confronto dei ciottoli:**
- i ciottoli veri sono grigio scuro, quelli del gioco beige chiaro;
- il cielo del gioco è molto più saturo;
- il verde del prato è acceso, quello vero è spento.

È la ritaratura del passo 3.

## 4. Piano di lavoro

Il ramo parte da `nightly`. Ogni passo si chiude con un `index.html` che parte. Dopo ogni passo si rifanno le 15 foto con lo stesso `finali.json` e lo stesso giorno della settimana, e si affiancano a quelle di oggi.

### Passo 1: il gioco parte con 0.186.1
- **Cosa si tocca:**
  - in `assemble3.py` le righe 20 e 612: import map, `import`, `const THREE = Object.assign({}, …)`;
  - un file di compatibilità iniettato subito dopo gli import, con:
    - la sottoclasse di `InstancedMesh` con `frustumCulled = false` (voce 33);
    - una riga aggiunta a `THREE.ShaderChunk.common`: `#define mapTexelToLinear( a ) a`;
    - una riga aggiunta a `ShaderChunk.uv_pars_fragment`: `#if defined( USE_MAP ) && !defined( USE_UV )` / `#define vUv vMapUv` / `#endif`.

    Le ultime due fanno compilare subito tutti i nostri shader (voci 15-21) con lo stesso significato di r128. Al passo 2 si tolgono, scrivendo `vMapUv` nei file.
  - Voci 10, 11, 12, 14 (`FAC_WALL` va riscritto comunque, perché modifica il testo dei chunk). Sky: le sostituzioni nuove su `texColor` e `cloudCoverage = 0` (voce 29).
- **Come si prova:** prova di avvio Playwright senza PAGEERR e senza errori di shader in console (`THREE.WebGLProgram: Shader Error`); `node --check`; un giro in auto di un minuto.
- **Rischi:** shader che compilano ma disegnano male (si vedono solo in foto); il CDN (se dà problemi, si passa a `lib/`).

### Passo 2: uguale a oggi, tranne i colori
- **Cosa si tocca:**
  - voci 2-6: colore e `colorSpace`, togliere `outputEncoding`, tenere ACES per ora;
  - voce 7: luci × π;
  - voci 13, 18, 23 (la difficile: l'ombra del sole nel riflesso), 24, 30;
  - togliere i due `#define` del passo 1 e scrivere `vMapUv` nei file.
- **Come si prova:** le 15 foto affiancate a quelle di oggi devono somigliarsi (stessa luce, ombre, vetrine, acqua). Si guardano apposta:
  - il retro delle chiome;
  - il riflesso del sole su asfalto e auto all'ombra;
  - i vetri delle case;
  - i fari di notte.

  FPS sul PC di Carlo (riferimento 165) e draw call con `misure3.js`.
- **Rischi:** il Lambert per pixel costa di più (voce 39); i fari ora illuminano davvero (voce 8).

### Passo 3: gestione del colore e tone mapping AgX, colori ritarati sul vero
- **Cosa si tocca:**
  - `renderer.toneMapping = THREE.AgXToneMapping` e l'esposizione;
  - acqua e cielo dentro il tone mapping (voci 28, 29);
  - foschia e vetri (voce 30);
  - la palette dei materiali e delle texture fotografiche (asfalto, ciottoli, porfido, prato): luminosità e saturazione, misurate sui punti fissi contro le foto vere (5, 1, 2, 8 e, a mano, Street View).
- **Come si prova:** `mont/N.jpg` rifatti col gioco nuovo; decide Carlo guardando. Un punto alla volta, senza ritoccare un colore per un posto solo: le regole valgono per tutta la mappa.
- **Rischi:** AgX desatura e scurisce i colori accesi (rosa dei pubblici, insegne): potrebbe volere `NeutralToneMapping` o un'esposizione diversa. Il cielo Sky senza il `pow` va ritarato da capo.

### Passo 4: antialiasing SMAA (TAA solo da fermi)
- **Cosa si tocca:**
  - `EffectComposer` con `RenderPass`, `SMAAPass` e `OutputPass` (il tone mapping e lo spazio colore passano all'`OutputPass`);
  - `antialias: false` sul renderer, se SMAA basta (si risparmia l'MSAA);
  - la lettura del cielo (voce 30) e le foto di prova devono leggere l'uscita del composer.
- **Come si prova:** foto ingrandite di bordi (pali, ringhiere, cornicioni) prima e dopo; FPS.
- **Rischi:** `TAARenderPass` accumula solo a camera ferma, quindi in guida non serve. Le linee sottili (fili, ringhiere) SMAA le tiene meno dell'MSAA. Le linee e i punti additivi (aloni, stelle) vanno controllati nel composer.

### Passo 5: ombre a cascate
- **Cosa si tocca:**
  - `SunLight` al posto della `DirectionalLight` (`sun.position` = direzione del sole), `shadow.mapSize` da alzare (2048 per cascata), bias da ritarare;
  - voci 9, 25, 35 (i tile si spengono solo se fuori da tutte e due le cascate), 36 (rifare `VETRINA`), 37 (via il trucco del titolo).
- **Come si prova:** in auto a 50 km/h lungo una via di case (punto 1) e sul cavalcavia (punto 10): le ombre non devono "spuntare" né tremolare; dall'elicottero (punto 14) devono esserci ombre lontane.
- **Rischi:** `SunLight` è nuova in three e ha 2 cascate fisse (la costante `_cascadeCount` nei chunk). Se non basta, si passa all'addon `CSM` o a cascate fatte da noi: è il lavoro più grosso.

### Passo 6: occlusione ambientale
- **Cosa si tocca:** `GTAOPass` nel composer; ridurre o togliere l'occlusione finta dove raddoppia (`AO_WALL`, `AO_GROUND_MAT`, le finestre incassate di `facRecMat`).
- **Come si prova:** angoli delle case, sotto i balconi, sotto il cavalcavia, alberi nel bosco; FPS.
- **Rischi:** costo a 1920×1080 (va a mezza risoluzione); aloni sui bordi in movimento; la nebbia lontana non deve scurirsi.

### Passo 7: BatchedMesh dove serve
- **Cosa si tocca:** prima si misura dove vanno le draw call (`renderer.info`, `misure3.js`). Candidati:
  - le auto fuse (`fusi3.js`, che già unisce a mano);
  - i pezzi delle facciate 3D (`FAC_PARTS`, tante InstancedMesh);
  - gli oggetti per tile (`oggetti3.js`, `landmarks3.js`).
- **Come si prova:** draw call e FPS prima e dopo, negli stessi punti fissi; nessun oggetto sparito o fermo quando dovrebbe cadere.
- **Rischi:** BatchedMesh ha un limite fisso di vertici, indici e istanze per oggetto; i nostri `onBeforeCompile` vanno riprovati con `USE_BATCHING` (la matrice di batching sta in `project_vertex`).

### I tre rischi più grossi
1. **I cambi muti di colore e luce, tanti e tutti insieme** (voci 2-7, 18, 29, 30): senza foto prima e dopo sugli stessi punti non si capisce cosa è cambiato.
2. **Gli shader nostri pensati per il Lambert per vertice** (chiome, riflesso del sole all'ombra) vanno ripensati, non solo rinominati.
3. **`SunLight` è nuova e ha 2 cascate fisse**: se non regge Meda dall'elicottero, le ombre a cascate diventano un lavoro a sé.
