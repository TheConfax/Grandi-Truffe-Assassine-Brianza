# three.js da r128 a 0.186.1: preparazione (A METÀ, fermata morbida 9/11)

Sola lettura. Codice letto: snapshot `snap7` (`src/*.js`, `src/game.src.html`, `src/assemble3.py`).
Sorgenti di three scaricati per confronto in `threejs/pkg/r0.128.0` e `threejs/pkg/r0.186.1` (npm pack).

## DOVE SONO ARRIVATO

Fatto:
- versione scelta e modo di caricarla (sezione 1);
- inventario quasi completo, letto riga per riga contro i sorgenti veri delle due versioni (sezione 2);
- harness di foto con Playwright funzionante (`threejs/script/h.mjs` + `survey.mjs`), punti fissi quasi tutti trovati con prove a 960×540 (sezione 3, foto di prova in `threejs/foto/sv/` e `threejs/foto/sv_mont.jpg`).

Manca:
1. guardare l'ultimo giro di prove (`foto/sv/`: porfido a Seveso x -1271 z 1468, cantiere da 8 m in 4 direzioni, asfalto al contrario, notte in via Solferino) e fissare i 3-4 punti ancora incerti (porfido, cantiere, asfalto);
2. foto finali 1920×1080 dei 14-15 punti (file JSON delle viste da scrivere come `sv3.json`, poi `node h.mjs survey.mjs <viste> ../mont/gioco`), più la schermata del titolo (`page.screenshot` prima di GIOCA);
3. foto vere da Mapillary (token in `data/mapillary_token.txt`, conversione `lat = 45.6575 - z/110540`, `lon = 9.154 + x/(111320·cos 45.6575)`), poi `mont/N.jpg` con gioco e vero affiancati (PIL della venv);
4. sezione 4 (piano a passi) scritta per intero: sotto c'è solo la traccia;
5. ricontrollare le ultime voci minori: SpriteMaterial e Points, `scene.background` con CanvasTexture, `Texture.premultiplyAlpha` delle vetrine.

## 1. Versione di arrivo

**three 0.186.1** (r186, uscita il 24/09/2026). La 0.187.0 è del 30/10/2026: ha 10 giorni, quindi non è ancora stabile da due settimane. La 0.186.1 è una patch della 0.186.0 (08/09).

Perché va bene per noi:
- solo WebGL2 (WebGL1 tolto in r163), il nostro codice usa già i rami `__VERSION__ >= 300`;
- tone mapping **AgX** e Neutral nel core;
- **BatchedMesh** nel core;
- gestione del colore automatica (`ColorManagement.enabled = true`, `outputColorSpace = SRGBColorSpace`);
- addon `SMAAPass`, `TAARenderPass`, `SSAARenderPass`, `GTAOPass`, `SAOPass`, `OutputPass`, `EffectComposer`;
- **novità utile:** `examples/jsm/lights/SunLight.js` + `SunLightShadow.js`. È una luce "sole" con **ombre a cascate (2 cascate, sfumate fra loro)** che `WebGLRenderer` disegna da solo (`NUM_SUN_LIGHT_SHADOWS` nei chunk). Le cascate si adattano al frustum della camera: è proprio quello che serve contro le ombre che "inseguono". Va provata: 2 cascate da 1024 di base, `mapSize` da alzare.

### Come si carica
Dalla r160 non c'è più `build/three.min.js`: ci sono `three.module.min.js` (che importa `three.core.min.js`) e gli addon in `examples/jsm/`, tutti moduli ES.

Buona notizia: **il nostro gioco è già un `<script type="module">`** (lo fa `assemble3.py` riga 20, con top-level await). Oggi il modulo usa il `THREE` globale messo da `three.min.js`. Basta quindi:

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

- Provato: cdnjs ha `0.186.1/three.module.min.js` e `three.core.min.js` (HTTP 200); jsdelivr ha gli addon (es. `SMAAPass.js`, 200). Gli addon importano `'three'`: l'import map li fa puntare allo stesso modulo, una sola copia di three.
- La copia `Object.assign({}, ...)` serve perché il codice riassegna `THREE.CanvasTexture` (foto3_colori.js) e un namespace di modulo non si può modificare (in strict mode dà errore).
- `window.THREE` resta per gli script di prova che lo usano da `page.evaluate`.
- GitHub Pages e server locale: funziona uguale (http). Da `file://` i moduli non vanno, ma già oggi il gioco non va da `file://` (legge `mappa/*.bin` con `fetch`).
- Alternativa senza CDN: copiare i file in `lib/three-0.186.1/` (licenza MIT) e puntare l'import map lì. Più sicuro contro i CDN che cambiano; da decidere con Carlo.
- In `assemble3.py` si toccano le righe 612 (tag script di r128 e Sky.js r128) e l'inizio del modulo (riga 20) per mettere import map e import.

## 2. Inventario di cosa si rompe

Legenda difficoltà: F facile (sostituzione di testo), M media (va capito e riprovato a occhio), D difficile (va ripensato).
"Muto" = non dà errore, cambia solo l'aspetto: sono i più pericolosi.

### 2a. Chunk di three usati negli shader (diff vero r128 → r186)

| Chunk | Cambiato? | Cosa cambia per noi |
|---|---|---|
| `common`, `begin_vertex`, `project_vertex` | aggiunte sole (alphahash, batching) | ancore e variabili (`transformed`, `mvPosition`, `objectNormal`, `transformedNormal`) restano: OK |
| `fog_pars_vertex/fragment`, `fog_vertex`, `fog_fragment` | `fogDepth` → `vFogDepth` | chi scrive `fogDepth` a mano si rompe (errore di compilazione) |
| `map_fragment` | `texelColor`/`vUv` → `sampledDiffuseColor`/`vMapUv`, niente `mapTexelToLinear` | chi lo sostituisce intero va bene se non usa `vUv`; chi modifica il testo del chunk si rompe muto |
| `emissivemap_fragment` | `vUv` → `vEmissiveMapUv`, niente `emissiveMapTexelToLinear` | come sopra |
| `color_fragment` | unito il caso `USE_COLOR` | OK |
| `aomap_fragment` | `vUv2` → `vAoMapUv`, `geometry.normal` → `geometryNormal` | le nostre aggiunte dopo il chunk usano solo `reflectedLight`: OK |
| `shadowmap_vertex` | ristrutturato, aggiunte cascate sole e spot coords | usa ancora `worldPosition`: i nostri spostamenti prima del chunk funzionano |
| Lambert intero | **per pixel** (r128: luce per vertice, `vLightFront/Back`, `getShadowMask()`) | ordine: map, color, normal, emissivemap, luci, aomap, `vec3 outgoingLight =`: ancore ancora presenti, tranne `getShadowMask()` e `gl_FrontFacing ? vLightFront : vLightBack` |
| `vUv` | non esiste più senza `USE_UV` | **ogni frammento nostro che legge `vUv` non compila**: va `vMapUv` (stessa trasformazione della map di r128) |
| `mapTexelToLinear()` | tolta | le texture sRGB arrivano già lineari dall'hardware: `#define mapTexelToLinear(x) (x)` o toglierla |

### 2b. Voce per voce

| # | File:riga | Cosa fa oggi | Cosa succede in r186 | Correzione probabile | Diff. |
|---|---|---|---|---|---|
| 1 | game.src.html:167, assemble3.py:612 | `three.min.js` r128 e `examples/js/objects/Sky.js` r128 | file inesistenti | import map + import (sezione 1) | F |
| 2 | foto3_colori.js:6-10 (iniettato da assemble3.py:611) | converte a mano hex/css da sRGB a lineare | three lo fa già: **doppia conversione**, tutto più scuro e saturo (muto) | togliere il blocco Color | F |
| 3 | foto3_colori.js:11-12 | sottoclasse di `CanvasTexture` con `encoding = sRGBEncoding` | `encoding` non esiste più (r162): le texture disegnate restano lineari, colori slavati (muto) | `this.colorSpace = THREE.SRGBColorSpace` | F |
| 4 | world3.js:761, 796, 2603 | `t.encoding = THREE.sRGBEncoding` | come sopra (muto) | `t.colorSpace = THREE.SRGBColorSpace` | F |
| 5 | facciate3.js:218 | maschera `msk.encoding = LinearEncoding` | `LinearEncoding` undefined; prende sRGB dalla sottoclasse: maschera sbagliata (muto) | `msk.colorSpace = THREE.NoColorSpace` | F |
| 6 | foto3.js:82 | `outputEncoding = sRGBEncoding`, ACES, esposizione 1.1 | `outputEncoding` ignorato (l'uscita è già sRGB di base) | togliere; tone mapping lo si rifà al passo 3 (AgX) | F |
| 7 | game.src.html:247-252, extras.js:24, foto3.js:125 | intensità di hemi (0.78), sole (0.88), headSpot; r128 senza `physicallyCorrectLights` moltiplica per π | in r186 la modalità "legacy" non c'è più (tolta in r165): **tutto ~3 volte più scuro** | moltiplicare le intensità per `Math.PI` al passo 2, poi ritarare al passo 3 | F |
| 8 | extras.js:24 | `SpotLight(…, 70, 0.55, 0.6, 1.2)` dei fari, Lambert per vertice | decadimento fisico (1/d^decay con finestra), Lambert per pixel: la luce dei fari ora si vede davvero sull'asfalto e si somma alla macchia `HEADPOOL_MAT` | ritarare intensità e decay, forse togliere la macchia finta | M |
| 9 | game.src.html:226 | `PCFSoftShadowMap` | tolto: three avvisa e usa `PCFShadowMap` (mappa di profondità, filtro diverso) | `PCFShadowMap` + `shadow.radius`; bias da ritarare (-0.0007, normalBias 0.03) | M |
| 10 | fusi3.js:50 | `instanceMatrix.updateRange.count = …` | `updateRange` tolto in r169: **errore, il gioco si ferma** | `clearUpdateRanges(); addUpdateRange(0, n*16)` (e per `instanceColor`) | F |
| 11 | world3.js:883-884 | `AO_GROUND_MAT` con `MultiplyBlending` | in r186 `MultiplyBlending` vuole `premultipliedAlpha: true`, altrimenti errore in console e fusione sbagliata | `premultipliedAlpha: true` (con alpha 1 il risultato è uguale) | F |
| 12 | world3.js:884 | sostituisce `fog_fragment` scrivendo `fogDepth` | non compila (`vFogDepth`) | rinominare | F |
| 13 | world3.js:815 | chiome: forza la luce di fronte (`vLightFront`) sulle due facce | Lambert per pixel: il testo non c'è più, sostituzione muta, il retro delle carte si illumina al contrario | agganciarsi a `normal_fragment_begin` e togliere `* faceDirection` per `MAT.crown` | M |
| 14 | world3.js:922-928 `FAC_WALL` (finestre disegnate di `old`/`mod`) | `vUv`; modifica il testo di `ShaderChunk.map_fragment` (`texture2D( map, vUv )`) e di `emissivemap_fragment` | `vUv` non compila; le sostituzioni nel testo dei chunk non trovano niente | riscrivere i due pezzi con `vMapUv` / `vEmissiveMapUv` e testo nuovo | M |
| 15 | extras.js:14-16 (finestre accese) | `vUv` nel frammento | non compila | `vMapUv` (o `vEmissiveMapUv`) | F |
| 16 | facciate3.js:229-289 (`MAT.fac`, facciate 3D) | `vUv`, `mapTexelToLinear`, `textureGrad` su `map` e `emissiveMap` | non compila | `vMapUv`; togliere `mapTexelToLinear` (le texture sRGB sono già lineari) | F |
| 17 | foto3.js:32-60 (marciapiede a blocchi) | `vUv`, `mapTexelToLinear`, `textureGrad` | non compila | come 16 | F |
| 18 | foto3.js:160-178 (`FOTO_FACADE`, vetri che specchiano) | `vUv`; usa `cameraPosition` in un Lambert | non compila; e **dipende dal bug di r128**: lì `cameraPosition` vale (0,0,0) nei Lambert, in r186 è giusta, quindi il riflesso dei vetri cambia (muto) | `vMapUv`; ritarare i vetri guardandoli | M |
| 19 | foto3.js:187-256 (asfalto stocastico) | `vUv`, `textureLod(map,…,9.)`, `mapTexelToLinear`, `pow(…, 2.2)` sulla toppa | non compila; la media e il miscuglio ora avvengono in lineare (leggera differenza) | `vMapUv`, togliere `mapTexelToLinear`; la toppa (`uPat`, senza colorSpace) resta col `pow` | F |
| 20 | pattern3.js:38-57, 64 (prato, terra, porfido, ciottoli senza ripetizioni) | `vUv`, `mapTexelToLinear` | non compila | come 16 | F |
| 21 | negozi3.js:239-264 (`NG_ROOM_GLSL`, interni delle vetrine) | `vUv`, `mapTexelToLinear`, `textureLod/Grad(map)` | non compila | come 16; la texture atlante ha `premultiplyAlpha = true`: controllare | F |
| 22 | negozi3.js:218-226, 480-511 (LOD e insegne) | `#include <common>`, `project_vertex`, `shadowmap_vertex`, `map_fragment`, `emissivemap_fragment` | ancore presenti; nessun `vUv` | nessuna | F |
| 23 | riflessi3.js:66 | `.replace('* getShadowMask();', '* (rfSh = getShadowMask());')` | il Lambert nuovo non chiama più `getShadowMask()`: `rfSh` resta 1, **il riflesso del sole compare anche all'ombra** (muto) | prendere l'ombra del sole dentro `lights_fragment_begin` (agganciarsi al calcolo di `directLight` per la luce 0, o alla cascata del sole) | D |
| 24 | facciate3.js:224-226 (`FAC_CAMGL`) | ricava la camera dalla `viewMatrix` per aggirare il bug di `cameraPosition` | funziona ancora | si può semplificare con `cameraPosition` (non obbligatorio) | F |
| 25 | facciate3.js:402-427 (`facRecMat`, luce nelle finestre incassate) | sposta `worldPosition` prima di `shadowmap_vertex`; dopo `aomap_fragment` moltiplica `reflectedLight.directDiffuse` | funziona; con `SunLight` lo spostamento vale anche per le cascate (va riprovato) | nessuna subito; riprova al passo 5 | M |
| 26 | world3.js:878-880 (`AO_WALL`) | dopo `aomap_fragment` tocca `reflectedLight` | funziona; ma ora la luce diretta è per pixel, il peso 0.35 sul sole va riguardato | ritaratura a occhio | F |
| 27 | extras.js:28-30 (`GLOW_FOG`) | regex su `ShaderChunk.fog_fragment` (`gl_FragColor.rgb = mix(`) | la riga c'è ancora: funziona | nessuna | F |
| 28 | acqua3.js:11-49 (`ShaderMaterial` dell'acqua) | `fog_*` include, `cameraPosition`, niente `colorspace_fragment`/`tonemapping` | compila (GLSL1 tradotto da three); come oggi esce lineare e senza tone mapping | aggiungere `#include <tonemapping_fragment>` e `#include <colorspace_fragment>` al passo 3, poi ritarare i colori dell'acqua | M |
| 29 | foto3.js:88-98 (cielo `Sky`) | `replace('const vec3 cameraPos = …')` e `replace('gl_FragColor = vec4( retColor, 1.0 );')` | Sky.js nuovo: usa già `cameraPosition`, finisce con `vec4( texColor, 1.0 )`, **non ha più il `pow` di r128** e ha **nuvole proprie** (`cloudCoverage` 0.4 di base) | riscrivere le due sostituzioni su `texColor`; decidere se usare le nuvole di Sky (comandate dal meteo) o `cloudCoverage = 0`; `uSkyK` da ritarare | M |
| 30 | foto3.js:98-116 (lettura del colore del cielo) | rende su un `WebGLRenderTarget` e legge i pixel; in r128 il tone mapping si applicava **anche al render target** | in r186 sui render target niente tone mapping: i colori letti cambiano (muto) | ritarare foschia e vetri al passo 3 | M |
| 31 | foto3.js:103 | `renderer.capabilities.isWebGL2` | ancora presente (vale sempre true) | nessuna | F |
| 32 | foto3.js:145 | `color.convertSRGBToLinear()` ogni frame sulle montagne | il metodo esiste ancora; ma col blocco 2 tolto, il colore entrato con `setHex` è già lineare: controllare che non diventi doppio | guardare `_far`/`_near` | F |
| 33 | InstancedMesh (29 posti, es. landmarks3.js:30, oggetti3.js:152, sfondabili3.js:279, paesaggio3.js:366) | in r128 nascono con `frustumCulled = false` | in r186 nascono `true` con una sfera calcolata **una volta** sulle istanze: chi si muove dopo (oggetti abbattuti, pezzi di barriera) può sparire (muto) | nel file di compatibilità una sottoclasse che rimette `frustumCulled = false`; pezzi3.js poi mette la sua `cullS` come oggi | F |
| 34 | pezzi3.js:160 | ridefinisce `Frustum.prototype.intersectsObject` per usare `o.cullS` | r186 chiama `object.intersectsFrustum(f)` che chiama ancora `f.intersectsObject(this)`: funziona | nessuna | F |
| 35 | pezzi3.js:187 | `sun.shadow.updateMatrices(sun)`, `getFrustum()` per spegnere i tile fuori dall'ombra | uguale per `DirectionalLight`; con `SunLight` ci sono 2 frustum (`getFrustum(i)`) | al passo 5 controllare entrambe le cascate | M |
| 36 | pezzi3.js:198-212 (`vetrinaShader`, precompilazione) | `renderer.compile(scene, camera)` su un gruppo invisibile | `compile` usa ancora `traverse` per i materiali: funziona; ma le chiavi dei programmi cambiano con luci e ombre | rifare la lista `VETRINA` dopo il passo 5 (o usare `compileAsync`) | M |
| 37 | game.src.html:1862-1870, titolo | allarga la camera d'ombra a 230 m per il sorvolo | con `SunLight` la camera d'ombra non si usa più (left/right ignorati) | togliere al passo 5 | F |
| 38 | MeshDepthMaterial con `RGBADepthPacking` (world3.js:816, negozi3.js:230-231) | ombre di foglie e insegne | le ombre ora sono mappe di profondità: il colore impacchettato non conta più, l'`alphaTest` sì. Funziona | nessuna | F |
| 39 | Lambert per pixel ovunque (134 materiali) | luce per vertice | aspetto più liscio, costo GPU un po' più alto | misurare FPS al passo 2 (riferimento 165 FPS sul PC di Carlo) | M |

Conteggio: **39 voci. 25 facili, 13 medie, 1 difficile** (il riflesso del sole che non sa più dell'ombra). Senza correzione, tre voci fermano il gioco (1, 10, e gli shader che non compilano: 12, 14-21); molte altre sono mute (2, 3, 4, 5, 7, 13, 18, 23, 29, 30, 33).

### 2c. Sostituzioni `rep(...)` di assemble3.py che toccano three
assemble3.py ha 274 `rep(...)`. Quasi tutte inseriscono file o cambiano gioco e fisica. Toccano three:
- riga 20 (inizio del modulo): qui vanno import map e `import`;
- riga 611: inietta `foto3_colori.js` prima del renderer (voci 2-3);
- riga 612: i due tag `<script>` di r128 (voce 1);
- riga 85: il terreno di fondo `PlaneGeometry` + `MeshLambertMaterial` (OK);
- righe 439-440, 783: `BoxGeometry` della carrozzeria con `fU`, `PlaneGeometry` della macchia dei fari (OK; la macchia va rivista per la voce 8);
- riga 782: `boxG` e `fusi3.js` (voce 10);
- riga 843: `headSpot.intensity` (voce 7-8);
- righe 672, 695, 833: solo `THREE.Vector3` (OK).

## 3. Punti fissi (scelti finora, da confermare)

Il link prende solo `?x=&z=` (più `piedi`, `mezzo`, `debug`): l'ora si mette col tasto N o in prova con `window.__setTOD(h)`, la direzione girando la camera. Per le foto uso `threejs/script/h.mjs` + `survey.mjs` (camera e punto guardato in metri sopra il suolo, ora). Giorno di gioco 7-18, tramonto verso le 18.7.

| N | Cosa | Link | Camera → punto guardato, ora | Stato |
|---|---|---|---|---|
| 1 | Facciate con finestre 3D, via Solferino | http://127.0.0.1:8109/?x=242&z=-597&debug=1 | (242.4,1.7,-597.3) → (276.2,6,-627.0), 10:30 | buona |
| 2 | Vetrina di giorno, Barzaghi, corso Matteotti | http://127.0.0.1:8109/?x=247&z=-549&debug=1 | (247.0,1.7,-549.0) → (250.2,1.8,-552.8), 11:00 | buona |
| 3 | Vetrina di sera, stessa | stesso | stessa, 19:30 | buona |
| 4 | Interno di vetrina, Chandelier | http://127.0.0.1:8109/?x=208&z=-578&debug=1 | (207.75,1.6,-578.0) → (203.7,1.3,-574.3), 20:00 | buona |
| 5 | Ciottoli, via Antona Traversi | http://127.0.0.1:8109/?x=182&z=-788&debug=1 | (182.3,1.7,-787.6) → (155.4,0.5,-800.9), 11:00 | buona |
| 6 | Porfido | candidato Seveso http://127.0.0.1:8109/?x=-1271&z=1468&debug=1 | da scegliere fra `foto/sv/porf_a/b/c.jpg` | da guardare (piazza Cavour x 451 z -904 non mostra porfido) |
| 7 | Asfalto, corso della Resistenza | http://127.0.0.1:8109/?x=435&z=-431&debug=1 | (435.2,1.4,-430.9) → (460,0,-414), 12:30 | da guardare (`asf_inv`); l'altro verso ha la Posta rosa |
| 8 | Prato e bosco, Bosco delle Querce | http://127.0.0.1:8109/?x=60&z=1250&debug=1 | (60,1.7,1250) → (13,4,1321), 11:00 | buona |
| 9 | Acqua, il Seveso | http://127.0.0.1:8109/?x=-1296&z=800&debug=1 | (-1296,3,800) → (-1296,0,860), 11:00 | buona |
| 10 | Cavalcavia, via Cadorna (161 m su impalcato) | http://127.0.0.1:8109/?x=-95&z=-100&debug=1 | (-95,1.7,-100) → (0,1.5,-35), 11:00 | buona (manca una vista da sotto) |
| 11 | Cantiere grande (gru) | http://127.0.0.1:8109/?x=-38&z=37&debug=1 | da 8 m d'altezza, da scegliere fra `cant_n/e/s/w.jpg` | da guardare |
| 12 | Cielo al tramonto | come 10 | (-95,1.7,-100) → (-300,20,-60), 18:42 | buona |
| 13 | Notte coi lampioni, via Solferino | come 1 | come 1, 22:30 | da guardare (`notte_solf`) |
| 14 | Elicottero in quota sopra Meda verso le Alpi | http://127.0.0.1:8109/?x=300&z=-400&debug=1 | (300, 230 m assoluti, -400) → (300,120,-1400), 14:00 | buona |
| 15 | Titolo | http://127.0.0.1:8109/ | schermata prima di GIOCA | da fare |

Foto vere: non ancora cercate.

## 4. Piano di lavoro (traccia, da completare)

1. **Il gioco parte.** Import map, copia modificabile di `THREE`, voci 1, 10, 12, 14-21 (`vUv` → `vMapUv`, `mapTexelToLinear` tolta), 11, 33. Prova: avvio Playwright senza PAGEERR né errori di shader in console; `node --check`. Rischio: shader che compilano ma sbagliano (si vede solo in foto).
2. **Uguale a oggi tranne i colori.** Voci 2-6 (colore), 7 (×π), 13, 23, 29, 30. Foto dei 15 punti prima/dopo affiancate. Misura FPS (voce 39).
3. **Colore e tone mapping AgX.** Togliere ACES, provare AgX ed esposizione; acqua e cielo dentro il tone mapping (28, 29); ritarare palette, luci, foschia e vetri sui punti fissi confrontati col vero. Prova: foto gioco/vero affiancate, giudica Carlo.
4. **SMAA o TAA.** `EffectComposer` + `RenderPass` + `SMAAPass` + `OutputPass` (il tone mapping passa all'`OutputPass`). TAA solo da fermi (`TAARenderPass` accumula quando la camera è ferma): in guida conta SMAA. Costo da misurare.
5. **Ombre a cascate.** Provare `SunLight` (2 cascate) al posto di `DirectionalLight`; voci 9, 25, 35, 36, 37. Rischio: solo 2 cascate e codice nuovo (r186): se non basta, `CSM` degli addon o cascate fatte a mano.
6. **Occlusione ambientale.** `GTAOPass` nel composer; togliere o ridurre l'AO finta (`AO_WALL`, `AO_GROUND_MAT`) dove raddoppia.
7. **BatchedMesh dove serve.** Candidati: auto fuse (`fusi3.js`), pezzi delle facciate (`FAC_PARTS`), oggetti per tile; misurare draw call prima/dopo.

Rischi più grossi finora: (a) i cambi muti di colore e luce, tanti e sommati (voci 2-7, 18, 29-30): servono le foto prima/dopo su punti fissi; (b) gli shader nostri agganciati al Lambert per vertice (13, 23) vanno ripensati; (c) `SunLight` è nuova in three e ha 2 cascate fisse.
