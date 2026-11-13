// ---------------------------------------------------------------- realismo 3, fase C: the green (Carlo 13/11: "il verde a blocchi")
//  - hedges: leaves all over (a canvas of small leaves, laid in world metres, so no stretching), a darker solid inside and a shell of leaves HEDGE_FR out of it
//    with holes (alpha), so the outline is ragged and the inside shows dark between the leaves (sfondabili3.js barDraw, key hdF);
//  - shrubs where they really are (src/dbgt_verde.py cespugli: the LiDAR in the green of the DBGT, the scrub of the DBGT), the small crowns of the trees
//    near the ground, solid (a car stops in a thicket);
//  - the lawns by kind and the tall grass where it is tall (giro del verde, below);
//  - ivy on some garden walls (one stretch in nine, from the ground, thinner towards the top: sfondabili3.js, key ivy).
// &verde=0 turns all of it off (the hedges back to the block); &prato=0, &erba=0 each its own part
const VERDE3 = window.__VERDE3 = { on: !/[?&]verde=0/.test(location.search), cespugli: 0, ciuffi: 0, edera: 0 };
const HEDGE_FR = 0.11;
const R3_CANVAS = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
let r3s = 91; const r3r = () => (r3s = r3s * 16807 % 2147483647) / 2147483647;
// small leaves (privet, laurel), seamless: every leaf drawn again across the edges; alpha 0 between them (the shell), the solid inside uses the colour only
const HEDGE_TEX = R3_CANVAS(512, 512, (g, W, H) => {
  g.fillStyle = 'rgba(38,52,30,0)'; g.clearRect(0, 0, W, H);
  const leaf = (x, y, a, L, col) => { for (const dx of [-W, 0, W]) for (const dy of [-H, 0, H]) { g.save(); g.translate(x + dx, y + dy); g.rotate(a); g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, -L * 0.36, L / 2, 0); g.quadraticCurveTo(0, L * 0.36, -L / 2, 0); g.fillStyle = col; g.fill(); g.fillStyle = 'rgba(0,0,0,0.18)'; g.beginPath(); g.moveTo(-L / 2, 0); g.quadraticCurveTo(0, L * 0.36, L / 2, 0); g.closePath(); g.fill(); g.restore(); } };
  for (let i = 0; i < 2600; i++) { const k = i / 2600, v = 70 + 150 * k + r3r() * 30, gr = v * (1.0 + 0.1 * r3r()); leaf(r3r() * W, r3r() * H, r3r() * TAU, 16 + r3r() * 14, `rgb(${v * 0.62 | 0},${gr | 0},${v * 0.45 | 0})`); } /* back to front: the last ones lit */
});
const IVY_TEX = R3_CANVAS(256, 512, (g, W, H) => {
  g.clearRect(0, 0, W, H);
  for (let i = 0; i < 2600; i++) { const y = H * Math.pow(r3r(), 0.45), x = r3r() * W, v = 60 + 110 * r3r(), L = 12 + r3r() * 12, a = r3r() * TAU; /* thick at the bottom (v 0), thinning out upwards */
    for (const dx of [-W, 0, W]) { g.save(); g.translate(x + dx, y); g.rotate(a); g.beginPath(); for (let k = 0; k < 5; k++) { const b = k / 5 * TAU, rr = k % 2 ? L * 0.45 : L * 0.62; g.lineTo(Math.cos(b) * rr, Math.sin(b) * rr); } g.closePath(); g.fillStyle = `rgb(${v * 0.5 | 0},${v * 0.82 | 0},${v * 0.42 | 0})`; g.fill(); g.restore(); } }
});
const GRASS_TEX = R3_CANVAS(128, 128, (g, W, H) => {
  g.clearRect(0, 0, W, H); g.lineCap = 'round';
  for (let i = 0; i < 60; i++) { const x = W * (0.1 + 0.8 * r3r()), h = H * (0.3 + 0.7 * r3r()), b = (r3r() - 0.5) * 30, v = 120 + 100 * r3r(); g.strokeStyle = `rgb(${v * 0.75 | 0},${v | 0},${v * 0.45 | 0})`; g.lineWidth = 1.5 + r3r() * 1.5; g.beginPath(); g.moveTo(x, H); g.quadraticCurveTo(x + b * 0.3, H - h * 0.6, x + b, H - h); g.stroke(); }
});
/* world-space leaves for the hedge: the sides by (along the face, height), the top by (x, z); 0.8 m a repeat */
const HEDGE_PATCH = (shell) => s => {
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHgP;\nvarying vec3 vHgN;').replace('#include <project_vertex>', '#include <project_vertex>\n  vHgP = (modelMatrix * vec4(transformed, 1.0)).xyz; vHgN = normalize(mat3(modelMatrix) * objectNormal);');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vHgP;\nvarying vec3 vHgN;\nfloat hgH(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }\nfloat hgN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(hgH(i), hgH(i + vec2(1, 0)), f.x), mix(hgH(i + vec2(0, 1)), hgH(i + vec2(1, 1)), f.x), f.y); }')
    .replace('#include <map_fragment>', `{ vec3 Nw = normalize(vHgN); vec2 uw = abs(Nw.y) > .6 ? vHgP.xz : vec2(dot(vHgP.xz, normalize(vec2(-Nw.z, Nw.x))), vHgP.y);
    vec4 lt = texture2D(map, uw / .8 + ${shell ? 'vec2(.37, .61)' : 'vec2(0.)'}); float mac = hgN(vHgP.xz / 6.) * .5 + hgN(vHgP.xz / 1.7 + 4.) * .5;
    vec3 c = lt.rgb * vec3(.95 + .2 * mac, 1., .9 + .15 * (1. - mac)) * (.8 + .4 * mac);
    ${shell ? 'diffuseColor.rgb *= c * 1.15; diffuseColor.a = lt.a > .5 && hgH(floor(uw * 9.)) > .12 ? 1. : 0.; /* some leaves missing: holes to the dark inside */' : 'diffuseColor.rgb *= mix(vec3(.16, .2, .12), c * .55, lt.a); /* the inside: dark between the leaves */'} }`);
};
if (VERDE3.on) {
  MAT.hedge.map = HEDGE_TEX; MAT.hedge.color.set(0xffffff); MAT.hedge.onBeforeCompile = HEDGE_PATCH(false); MAT.hedge.customProgramCacheKey = () => 'siepe-r3'; MAT.hedge.needsUpdate = true;
  MAT.hedgeLeaf = new THREE.MeshLambertMaterial({ map: HEDGE_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
  MAT.hedgeLeaf.onBeforeCompile = HEDGE_PATCH(true); MAT.hedgeLeaf.customProgramCacheKey = () => 'siepe-r3-foglie';
  MAT.ivy = new THREE.MeshLambertMaterial({ map: IVY_TEX, alphaTest: 0.5, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
}
// ---- shrubs: per tile, from the build (T.d.cs: [x, z, h] in dm)
const CESP_COL = ['#5d8a3b', '#4f7a35', '#6b8f3e', '#47703a', '#7f9a45', '#5a8040']; /* the greens of the trees (world3.js GREENS), a little fresher */
function buildVerde(T, G) {
  if (!VERDE3.on || !T.d.cs || !T.d.cs.length) return;
  const L = [];
  for (const [X, Z, HH] of T.d.cs) { const x = X / 10, z = Z / 10, h = HH / 10; if (inBuilding(x, z, 0.3) || onAnyRoad(x, z, 0.5) || H.inPit(x, z, 0.5)) continue; const gy = H.ground(x, z); if (inWater(x, z, gy)) continue; L.push([x, z, h, gy]); }
  if (!L.length) return;
  const by = [[], [], [], [], [], []]; for (const s of L) by[Math.floor(trHash(s[0], s[1]) * 6) % 6].push(s); /* three shapes, evergreen (laurel, privet) or with the season's leaves */
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  by.forEach((list, v) => {
    if (!list.length) return;
    const im = new THREE.InstancedMesh(TREE_G.crownS[v % 3], v < 3 ? MAT.crownSemp : MAT.crown, list.length); im.castShadow = true; im.receiveShadow = true; im.customDepthMaterial = TREE_DEPTH;
    list.forEach(([x, z, h, gy], i) => {
      const k = trHash(x * 1.7, z * 2.3), wx = (0.55 + 0.35 * k) * Math.max(h, 1.1) / 2.25 * 1.15, wy = h / 4.1; /* the crown is 4.5 m across and 4.1 m high */
      m4.compose(p.set(x, gy + h * 0.5 - 0.1, z), q.setFromEuler(e.set(0, k * TAU, 0)), sc.set(wx, wy, wx * (0.85 + 0.3 * trHash(z, x)))); im.setMatrixAt(i, m4);
      im.setColorAt(i, c.copy(COL(CESP_COL[Math.floor(k * 6) % 6])).multiplyScalar(0.95 + 0.3 * trHash(x + 3, z)));
      if (!T.vrDone) WALLS.add(x - 1, z - 1, x + 1, z + 1, { r: Math.min(0.9, 0.3 + 0.25 * h), x, z, y0: gy - 1, y1: gy + h }); /* a thicket stops a car (Carlo 25/10: nothing a car goes through) */
    });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; G.add(im); VERDE3.cespugli += list.length;
  });
  T.vrDone = true;
}
// ---------------------------------------------------------------- giro del verde (Carlo 14/11: "il verde della Brianza deve sembrare vero")
// ---- the lawn (fase 1): photos of grass seen from above (CC0, src/tex_verde.py), mixed in world space so that nothing repeats:
//  G a mown lawn, E a lawn with clover and thin patches, S dry yellowish grass, T earth with sparse grass (the earth showing through).
//  Three kinds, by what the map says the ground is (pratoStile, world3.js cellOwners):
//   0 giardino (gardens of the DBGT, residential, schools, cemeteries, pitches): green and even, a few softer patches;
//   1 parco (parks, the lawns of the DBGT and OSM, verges, the bare ground's green): irregular, greener and yellower patches, earth here and there, darker zones;
//   2 incolto (incolti, scrub): dry and pale, green in patches, more earth.
//  The colour of the season (stagioni3.js) stays on top. &prato=0: the old lawn
const PRATO = window.__PRATO = { on: VERDE3.on && !/[?&]prato=0/.test(location.search) };
const prTex = f => { const t = new THREE.TextureLoader().load('tex/' + f + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; };
const PR_U = PRATO.on ? { uPrG: { value: prTex('prato_g') }, uPrE: { value: prTex('prato_e') }, uPrS: { value: prTex('prato_s') }, uPrT: { value: prTex('prato_t') } } : null;
/* the masks and the mix: the same lines in the ground (fragment, the photos at full detail) and in the tall grass (vertex, the photos blurred), so a tuft
   takes the colour of the ground under it and the edge of the tall grass does not show. P in metres */
const PR_MIX = `
float prN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(prH(i), prH(i + vec2(1, 0)), f.x), mix(prH(i + vec2(0, 1)), prH(i + vec2(1, 1)), f.x), f.y); }
vec4 prPesi(vec2 P, float kind) { /* the weights of E, S, T over G, and the tone */
  float n1 = prN(P / 6.5 + 1.3) * .6 + prN(P / 2.3 + 7.1) * .4, n2 = prN(P / 23. + 17.) * .6 + prN(P / 41. + 5.) * .4, n3 = prN(P / 1.3 + 3.3) * .55 + prN(P / .55 + 9.1) * .45, n4 = prN(P / 11. + 21.7);
  if (kind < .5) return vec4(smoothstep(.62, .88, n1) * .4, 0., smoothstep(.84, .97, n3) * smoothstep(.6, .85, n1) * .3, (n2 - .5) * .14 + (n1 - .5) * .06);
  if (kind < 1.5) return vec4(smoothstep(.3, .7, n2 * .55 + n1 * .45), smoothstep(.56, .8, n1 * .65 + n4 * .35) * .7, smoothstep(.7, .88, n3 * .55 + n1 * .45) * .75, (n4 - .5) * .3 + (n2 - .5) * .1);
  return vec4(.55 + .45 * smoothstep(.3, .7, n1 * .7 + n2 * .3), smoothstep(.35, .75, n1 * .6 + n4 * .4) * .62, smoothstep(.6, .82, n3 * .5 + n2 * .5) * .55, (n4 - .5) * .26); /* incolto: the weedy grass, dry in patches */
}
vec3 prMix(vec3 G, vec3 E, vec3 S, vec3 T, vec4 w, vec2 P, float kind) { vec3 c = mix(G, E, w.x); c = mix(c, S, w.y); c = mix(c, T, w.z);
  float yl = smoothstep(.55, .8, prN(P / 9. + 33.)) * (kind < .5 ? .12 : .5), gr = smoothstep(.6, .85, prN(P / 7.3 + 51.)) * (kind < .5 ? .25 : .55); /* yellower and greener patches */
  return c * (1. + w.w) * mix(vec3(1.), vec3(1.12, 1.03, .74), yl) * mix(vec3(1.), vec3(.9, 1.07, .86), gr); }
`;
const PR_GLSL = `
uniform sampler2D uPrG; uniform sampler2D uPrE; uniform sampler2D uPrS; uniform sampler2D uPrT;
float prH(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
` + PR_MIX + `
vec3 prS(sampler2D m, vec2 uv, float salt) { /* mirrored tiles (pattern3.js patS) and a second sample turned by 30 degrees, 2.6 times larger, as the ground photos */
  vec2 dx = dFdx(uv), dy = dFdy(uv); float h; vec3 a = patS(m, uv, dx, dy, salt, h);
  const mat2 R2 = mat2(.866, -.5, .5, .866) * .385; vec3 b = patS(m, R2 * uv + vec2(.31, .77), R2 * dx, R2 * dy, salt + 7.7, h);
  vec3 mean = textureLod(m, vec2(.5), 12.).rgb; return mean + (.7 * (a - mean) + .3 * (b - mean)) / .7616;
}
vec3 prato(vec2 P, float kind) { return prMix(prS(uPrG, P / 2.4, 1.3), prS(uPrE, P / 2.6, 5.1), prS(uPrS, P / 2.2, 9.7), prS(uPrT, P / 2.8, 13.3), prPesi(P, kind), P, kind); }
`;
function pratoMat(m, kind) {
  if (!PRATO.on || !m || m.userData.prato !== undefined) return m; m.userData.prato = kind;
  const before = m.onBeforeCompile, prev = m.customProgramCacheKey ? m.customProgramCacheKey() : '', pat = PAT_FRAG(true);
  m.onBeforeCompile = (s, r) => {
    if (before) before.call(m, s, r); if (!s.fragmentShader.includes(pat)) return; Object.assign(s.uniforms, PR_U);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + PR_GLSL).replace(pat, `\n  vec4 texelColor = vec4(prato(vWp.xz, ${kind.toFixed(1)}), 1.);\n  diffuseColor *= texelColor;`);
  };
  m.customProgramCacheKey = () => prev + '|prato' + kind; m.needsUpdate = true; return m;
}
if (PRATO.on) {
  /* the garden lawn: a material of its own (the grass photo as map, so the season tints it as the others, stagioni3.js) */
  const g = new THREE.MeshLambertMaterial({ map: grassTex, vertexColors: true }); g.onBeforeCompile = PAT_PATCH(true, 'ciottoli'); g.customProgramCacheKey = () => 'pattern-org'; r3Ground(g, 'prato', 'pat', 1); MAT.pratoGiardS = g;
  MAT.incoltoS.map = MAT.incolto.map = grassTex; /* the dry grass is drawn by the shader now; the season tints it too */
  for (const [m, k] of [[MAT.pratoGiardS, 0], [MAT.grassS, 1], [MAT.grass, 1], [MAT.embank, 1], [MAT.terrainS, 1], [MAT.terrain, 1], [MAT.incoltoS, 2], [MAT.incolto, 2], [typeof RO_MAT !== 'undefined' ? RO_MAT.prato : null, 0]]) pratoMat(m, k);
  try { stagCalcola(); } catch (e) { }
}
/* the look of a green area of the map by its type (world3.js cellOwners): [key, material, tint]. 19 gardens of the DBGT (AR_VRD 01), 16 residential, 15 schools,
   14 cemeteries, 3 pitches: kept lawns; 18 incolti and 12 scrub: dry; the rest (lawns, parks, woods, farmland) keeps its tint on the park's lawn */
const PR_GIARD = new Set([3, 14, 15, 16, 19]);
function pratoStile(t) {
  if (!PRATO.on) return t === 18 ? ['i', MAT.incoltoS, null] : ['g', MAT.grassS, COL(AREA_COL[t] || '#ffffff')];
  if (t === 18 || t === 12) return ['i', MAT.incoltoS, null];
  if (PR_GIARD.has(t)) return ['gg', MAT.pratoGiardS, COL('#ffffff')];
  return ['g', MAT.grassS, COL(t === 1 || t === 2 ? '#ffffff' : AREA_COL[t] || '#ffffff')];
}
// ---- the tall grass (fase 1): only where it is tall in the real world: the incolti and the scrub, the edges of the fields (1.6 m in from the edge of a
// field or a meadow of the map), the banks of the streams (the grass within 4 m of a river bed) and the embankments (the cells of S the build calls bank).
// Not on the kept lawns. Tufts of 7 real blades, bent and of different heights, thick (one every 30 cm), in chunks of 10 m round the camera; from 12 m they
// thin out (each tuft has its rank and goes when the density falls under it, shrinking first), the few left a little bigger, none past 46 m. Each tuft takes
// the colour of the ground under it (PR_MIX, the same masks), so where the tufts end the ground goes on in the same colour. The wind (stagioni3.js VENTO)
// bends them, more at the top, in waves that run with the gusts. &erba=0 (or &ciuffi=0) turns them off
const ERBA = window.__ERBA = { on: VERDE3.on && !/[?&](erba|ciuffi)=0/.test(location.search), CH: 10, R: 46, F0: 11, F1: 44, sp: 0.27, cap: 50000, chunks: new Map(), n: 0, cx: 1e9, cz: 1e9, dirty: true };
const ERBA_G = (() => {
  const P = [], N = [], UV = [], W = [], I = []; let sd = 7; const r = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  for (let b = 0; b < 10; b++) {
    const az = (b + r() * 0.8) / 10 * TAU, rad = 0.01 + r() * 0.11, bx = Math.cos(az) * rad, bz = Math.sin(az) * rad, la = az + (r() - 0.5) * 0.9, dx = Math.cos(la), dz = Math.sin(la);
    const lean = 0.15 + r() * 0.5, hb = 0.55 + r() * 0.45, w0 = 0.008 + r() * 0.006, wx = -dz, wz = dx, i0 = P.length / 3;
    for (let k = 0; k <= 3; k++) { const t = k / 3, out = lean * hb * t * t, y = hb * t - out * 0.3 * t, w = w0 * (1 - t * 0.9);
      for (const sg of [-1, 1]) { P.push(bx + dx * out, y, bz + dz * out); W.push(wx * w * sg, 0, wz * w * sg); UV.push(sg * 0.5 + 0.5, t); const nl = Math.hypot(dx * 0.25, 1, dz * 0.25); N.push(dx * 0.25 / nl, 1 / nl, dz * 0.25 / nl); } } /* the normal near the ground's: lit as the lawn under it */
    for (let k = 0; k < 3; k++) { const a = i0 + k * 2; I.push(a, a + 1, a + 3, a, a + 3, a + 2); }
  }
  return { P, N, UV, W, I };
})();
const ERBA_VERT = `
attribute vec4 iP; attribute vec4 iS; attribute vec3 iC; attribute vec3 aW;
uniform vec3 uCam; uniform vec4 uVento; uniform vec3 uErF; uniform sampler2D uPrG; uniform sampler2D uPrE; uniform sampler2D uPrS; uniform sampler2D uPrT;
varying vec3 vErC; varying float vErH;
float prH(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
` + PR_MIX;
const ERBA_BEGIN = `
  float erD = length(iP.xz - uCam.xz), erDen = 1. - smoothstep(uErF.x, uErF.y, erD), erK = smoothstep(0., .1, erDen - iP.w); /* this tuft's rank against the density here */
  float erHt = iS.x * uErF.z * mix(.55, 1., erK), erWd = (1. + 2.2 * smoothstep(8., uErF.y, erD)) * erK; /* far ones wider (a blade under a pixel flickers), going ones lower and thinner */
  float erC = cos(iS.y), erS = sin(iS.y); mat2 erR = mat2(erC, erS, -erS, erC);
  vec3 transformed = position; transformed.xz = erR * (transformed.xz * mix(.6, 1.15, iS.w) + aW.xz * erWd); transformed.y *= erHt;
  { float t = uv.y, ph = dot(iP.xz, uVento.xy) * .32 - uVento.w * 1.9, g = uVento.z * (.6 + .4 * sin(ph) + .25 * sin(ph * 2.3 + 1.7)) + .06 * sin(uVento.w * 3.3 + iP.x * 1.9 + iP.z * 1.3 + position.x * 9.);
    float bnd = clamp(g, 0., 2.2) * .38 * t * t * erHt; transformed.xz += uVento.xy * bnd; transformed.y -= bnd * bnd * .35 / max(erHt, .2); }
  transformed += iP.xyz; vErH = uv.y;
  { vec2 P = iP.xz; vec3 G = textureLod(uPrG, P / 2.4, 5.).rgb, E = textureLod(uPrE, P / 2.6, 5.).rgb, S = textureLod(uPrS, P / 2.2, 4.).rgb, T = textureLod(uPrT, P / 2.8, 4.).rgb;
    vec4 w = prPesi(P, iS.z); w.z *= .3; /* the earth is under the grass, not on its blades */ vErC = prMix(G, E, S, T, w, P, iS.z) * iC;
    float rb = prH(iP.xz * 3.1 + position.xz * 7.); vErC = mix(vErC, vec3(.5, .43, .26) * iC, step(.84, rb) * .7) * (.9 + .3 * prH(iP.zx * 1.7 + position.zx * 5.)); } /* some blades dry (straw), each a little lighter or darker */
`;
ERBA.mat = (() => {
  if (!ERBA.on || !PRATO.on) return null;
  const m = new THREE.MeshLambertMaterial({ side: THREE.DoubleSide });
  m.onBeforeCompile = s => {
    Object.assign(s.uniforms, PR_U); s.uniforms.uCam = { value: camera.position }; s.uniforms.uVento = VENTO.u; s.uniforms.uErF = ERBA.uF = ERBA.uF || { value: new THREE.Vector3(ERBA.F0, ERBA.F1, 1) };
    s.vertexShader = ERBA_VERT + s.vertexShader.replace('#include <begin_vertex>', ERBA_BEGIN);
    s.fragmentShader = 'varying vec3 vErC; varying float vErH;\n' + s.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\n  diffuseColor.rgb *= vErC * mix(.68, 1.28, smoothstep(0., .85, vErH)); /* dark in the thick of the tuft, lit at the tips */');
  };
  m.customProgramCacheKey = () => 'erba-alta'; return m;
})();
ERBA.mesh = (() => {
  if (!ERBA.mat) return null;
  const g = new THREE.InstancedBufferGeometry(), G = ERBA_G, cap = ERBA.cap;
  g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.N, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(G.UV, 2)); g.setAttribute('aW', new THREE.Float32BufferAttribute(G.W, 3)); g.setIndex(G.I);
  ERBA.aP = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); ERBA.aS = new THREE.InstancedBufferAttribute(new Float32Array(cap * 4), 4); ERBA.aC = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3);
  for (const a of [ERBA.aP, ERBA.aS, ERBA.aC]) a.setUsage(THREE.DynamicDrawUsage);
  g.setAttribute('iP', ERBA.aP); g.setAttribute('iS', ERBA.aS); g.setAttribute('iC', ERBA.aC); g.instanceCount = 0;
  const m = new THREE.Mesh(g, ERBA.mat); m.frustumCulled = false; m.receiveShadow = true; m.castShadow = false; scene.add(m); return m;
})();
const CIUFFI = ERBA.mesh ? { im: ERBA.mesh } : null; /* bagnato3.js hides them in the mirror */
/* the fields and meadows of the map near a box: their outlines, to find their edges (a field belongs to the tile of its middle) */
function erbaCampi(x0, z0, x1, z1) {
  const out = [], seen = new Set();
  for (const dx of [-260, 0, 260]) for (const dz of [-260, 0, 260]) { const T = TILES[tileOf((x0 + x1) / 2 + dx, (z0 + z1) / 2 + dz)]; if (!T || seen.has(T) || !T.d) continue; seen.add(T);
    if (!T._erC) T._erC = (T.d.ls || []).filter(L => L.s === 'campo' || L.s === 'prato').map(L => { const P = dec(L.p); return { P, b: bbox(P) }; });
    for (const f of T._erC) if (f.b[0] < x1 + 2 && f.b[2] > x0 - 2 && f.b[1] < z1 + 2 && f.b[3] > z0 - 2) out.push(f); }
  return out;
}
const erbaBordo = (x, z, P) => { let d = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length]; d = Math.min(d, segDist(x, z, a[0], a[1], c[0], c[1])); } return d; };
/* the look of the highest layer over a point (exact, where a cell of S is on the edge of a surface) */
function erbaStrato(T, x, z) {
  if (!T._lb || T._lbN !== T.layers.length) { T._lb = T.layers.map(([o]) => bbox(o)); T._lbN = T.layers.length; }
  let best = null, br = -1; T.layers.forEach(([o, k, rank, st], q) => { const b = T._lb[q]; if (rank < br || x < b[0] || x > b[2] || z < b[1] || z > b[3]) return; if (inPoly(x, z, o) && !k.some(h => inPoly(x, z, h))) { best = st; br = rank; } });
  return best;
}
/* is the grass tall here? -1 no, null: its tile is not laid out yet; else [kind of lawn under it, tint, height] */
function erbaQui(x, z, campi) {
  const T = TILES[tileOf(x, z)]; if (!T || !T.d) return -1; const F = H.tile(T.t); if (!F) return -1; if (!T.ready || !F.sty || !T.layers) return null;
  const c = F.n - 1, i = Math.floor((x - F.x0) / F.st), j = Math.floor((z - F.z0) / F.st); if (i < 0 || j < 0 || i >= c || j >= c) return -1;
  const w = j * c + i, U = F.ud2 || F.ud; if ((U && U[w]) || (F.pc && F.pc[w])) return -1; /* under a deck, in a ramp */
  let sy = F.sty[w]; const m = F.m ? F.m[w] : 0;
  if (sy && i > 0 && j > 0 && i < c - 1 && j < c - 1 && (F.sty[w - 1] !== sy || F.sty[w + 1] !== sy || F.sty[w - c] !== sy || F.sty[w + c] !== sy)) sy = erbaStrato(T, x, z); /* on an edge: the exact outline */
  const wild = sy && sy.m === MAT.incoltoS, lawn = !sy ? m === 3 || m === 5 : sy.m === MAT.grassS;
  if (wild) return [2, null, 0.62];
  if (!lawn) return -1;
  if (m === 5) return [1, sy && sy.col, 0.45]; /* an embankment */
  for (const f of campi) if (x > f.b[0] && x < f.b[2] && z > f.b[1] && z < f.b[3] && inPoly(x, z, f.P)) return erbaBordo(x, z, f.P) < 1.6 ? [1, sy && sy.col, 0.5] : -1; /* the edge of a field */
  if (F.m) { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < c && jj < c && F.m[jj * c + ii] === 4) return [1, sy && sy.col, 0.5]; } } /* a stream's bank */
  return -1;
}
function erbaChunk(ci, cj) {
  const E = ERBA, CH = E.CH, x0 = ci * CH, z0 = cj * CH, n = Math.round(CH / E.sp), campi = erbaCampi(x0, z0, x0 + CH, z0 + CH), L = [];
  for (let gj = 0; gj < n; gj++) for (let gi = 0; gi < n; gi++) {
    const qi = ci * n + gi, qj = cj * n + gj, x = (qi + trHash(qi * 0.37, qj * 1.13)) * E.sp, z = (qj + trHash(qj * 0.71, qi * 0.53)) * E.sp;
    const q = erbaQui(x, z, campi); if (q === null) return null; if (q === -1) continue;
    const cl = trHash(Math.floor(x / 3.1) * 1.7, Math.floor(z / 2.9) * 0.9); if (q[0] === 2 && cl < 0.08) continue; /* a few clearings */
    if (inBuilding(x, z, 0.15)) continue;
    const y = H.surface(x, z), hv = (Math.sin(x * 0.53 + Math.cos(z * 0.31) * 2.1) * 0.5 + 0.5) * 0.5 + trHash(x * 1.9, z * 2.7) * 0.5; /* heights: in patches, and each its own */
    L.push([trHash(x * 3.7, z * 5.3), x, y - 0.03, z, q[2] * (0.6 + 0.8 * hv), trHash(x, z) * TAU, q[0], trHash(z * 2.1, x), q[1]]);
  }
  L.sort((a, b) => a[0] - b[0]); /* by rank: the first ones stay farthest */
  const N = L.length, P = new Float32Array(N * 4), S = new Float32Array(N * 4), C = new Float32Array(N * 3);
  L.forEach(([r, x, y, z, h, a, k, s, col], i) => { P.set([x, y, z, r], i * 4); S.set([h, a, k, s], i * 4); if (col) C.set([col.r, col.g, col.b], i * 3); else C.set([1, 1, 1], i * 3); });
  return { ci, cj, N, P, S, C, R: L.map(l => l[0]) };
}
function erbaAggiorna() {
  const E = ERBA, cam = camera.position, CH = E.CH;
  if (cam.y - H.surface(cam.x, cam.z) > 45) { E.mesh.geometry.instanceCount = 0; E.cx = 1e9; return; }
  if (E.uF) E.uF.value.z = 1 - 0.35 * (STAG.bare || 0) - 0.15 * (STAG.spring || 0); /* winter: low and flattened; spring: still growing */
  E.mesh.material.color.copy(MAT.incoltoS.color); /* the tint of the season, as the ground */
  const i0 = Math.floor((cam.x - E.R) / CH), i1 = Math.floor((cam.x + E.R) / CH), j0 = Math.floor((cam.z - E.R) / CH), j1 = Math.floor((cam.z + E.R) / CH), want = [];
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) { const dx = Math.max(i * CH - cam.x, 0, cam.x - (i + 1) * CH), dz = Math.max(j * CH - cam.z, 0, cam.z - (j + 1) * CH), d = Math.hypot(dx, dz); if (d < E.R) want.push([d, i, j]); }
  want.sort((a, b) => a[0] - b[0]); let made = 0;
  for (const [, i, j] of want) { const k = i + ',' + j; if (E.chunks.has(k)) continue; if (made >= 3) break; const c = erbaChunk(i, j); made++; if (c) { E.chunks.set(k, c); E.dirty = true; } }
  for (const [k, c] of E.chunks) { const dx = Math.max(c.ci * CH - cam.x, 0, cam.x - (c.ci + 1) * CH), dz = Math.max(c.cj * CH - cam.z, 0, cam.z - (c.cj + 1) * CH); if (Math.hypot(dx, dz) > E.R + 2 * CH) E.chunks.delete(k); }
  if (!E.dirty && Math.hypot(cam.x - E.cx, cam.z - E.cz) < 2) return;
  E.dirty = false; E.cx = cam.x; E.cz = cam.z; let n = 0; const aP = E.aP.array, aS = E.aS.array, aC = E.aC.array;
  for (const [d, i, j] of want) {
    const c = E.chunks.get(i + ',' + j); if (!c || !c.N) continue; const den = 1 - clamp((d - E.F0) / (E.F1 - E.F0), 0, 1); if (den <= 0) continue;
    const t = den + 0.1; let m = c.N; if (t < 1) { let lo = 0, hi = c.N; while (lo < hi) { const mid = (lo + hi) >> 1; if (c.R[mid] < t) lo = mid + 1; else hi = mid; } m = lo; } /* the tufts whose rank is under the density at the chunk's nearest point */
    m = Math.min(m, E.cap - n); if (m <= 0) break;
    aP.set(c.P.subarray(0, m * 4), n * 4); aS.set(c.S.subarray(0, m * 4), n * 4); aC.set(c.C.subarray(0, m * 3), n * 3); n += m;
  }
  for (const a of [E.aP, E.aS, E.aC]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * a.itemSize); a.needsUpdate = true; }
  E.mesh.geometry.instanceCount = n; E.n = n; VERDE3.ciuffi = n;
}
{ const u = updDayNight; updDayNight = function (dt) { u(dt); if (ERBA.mesh) erbaAggiorna(); }; }
