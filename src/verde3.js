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
    .replace('#include <map_fragment>', `{ vec3 Nw = normalize(vHgN); vec2 uw = abs(Nw.y) > .45 ? vHgP.xz : vec2(dot(vHgP.xz, normalize(vec2(-Nw.z, Nw.x))), vHgP.y);
    vec4 lt = texture2D(map, uw / .8 + ${shell ? 'vec2(.37, .61)' : 'vec2(0.)'}); float mac = hgN(vHgP.xz / 6.) * .5 + hgN(vHgP.xz / 1.7 + 4.) * .5;
    vec3 c = lt.rgb * vec3(.95 + .2 * mac, 1., .9 + .15 * (1. - mac)) * (.8 + .4 * mac);
    ${shell ? 'diffuseColor.rgb *= c * 1.15; diffuseColor.a = lt.a > .5 && hgH(floor(uw * 9.)) > .12 && hgN(vHgP.xz * .8 + vHgP.y * .6) < .8 ? 1. : 0.; /* some leaves missing, and here and there a gap: holes to the dark inside */' : 'diffuseColor.rgb *= mix(vec3(.16, .2, .12), c * .55, lt.a); /* the inside: dark between the leaves */'} }`);
  if (typeof SIEPI !== 'undefined' && SIEPI.on) s.fragmentShader = s.fragmentShader.replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { /* the clumps of leaves (giro del verde): a bump of 3D noise at 25-30 cm turns the normal, lit clumps and dark hollows between them */
    vec3 p = vHgP / .22, Nw = normalize(vHgN); float e = .4;
    #define HGC(q) ((hgN((q).xz) + hgN((q).zy + 3.7) + hgN((q).yx + 7.1)) / 3.)
    float c0 = HGC(p), gx = HGC(p + vec3(e, 0., 0.)) - c0, gy = HGC(p + vec3(0., e, 0.)) - c0, gz = HGC(p + vec3(0., 0., e)) - c0;
    vec3 g = vec3(gx, gy, gz) / e; g -= Nw * dot(g, Nw); vec3 nb = normalize(Nw - g * 1.1);
    vec3 nv = normalize((viewMatrix * vec4(nb, 0.)).xyz); normal = dot(normal, (viewMatrix * vec4(Nw, 0.)).xyz) < 0. ? -nv : nv;
    diffuseColor.rgb *= mix(.55, 1.25, smoothstep(.3, .66, c0)); }`);
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
  if (VERDE3.on && typeof SIEPI !== 'undefined') siepeArbusti(T, G);
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
const ERBA = window.__ERBA = { on: VERDE3.on && !/[?&](erba|ciuffi)=0/.test(location.search), CH: 10, R: 46, F0: 11, F1: 44, sp: 0.27, cap: 60000, chunks: new Map(), n: 0, cx: 1e9, cz: 1e9, dirty: true };
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
  float erUp = iS.z > 2.5 ? .4 : 1.; if (iS.z > 3.5 && iS.z < 4.5) erWd *= mix(1., 2.6, smoothstep(.55, .72, uv.y)); /* crops stand upright; the ears of the wheat */
  vec3 transformed = position; transformed.xz = erR * (transformed.xz * mix(.6, 1.15, iS.w) * erUp + aW.xz * erWd); transformed.y *= erHt;
  { float t = uv.y, ph = dot(iP.xz, uVento.xy) * .32 - uVento.w * 1.9, g = uVento.z * (.6 + .4 * sin(ph) + .25 * sin(ph * 2.3 + 1.7)) + .06 * sin(uVento.w * 3.3 + iP.x * 1.9 + iP.z * 1.3 + position.x * 9.);
    float bnd = clamp(g, 0., 2.2) * .38 * t * t * erHt; transformed.xz += uVento.xy * bnd; transformed.y -= bnd * bnd * .35 / max(erHt, .2); }
  transformed += iP.xyz; vErH = uv.y;
  { vec2 P = iP.xz; vec3 G = textureLod(uPrG, P / 2.4, 5.).rgb, E = textureLod(uPrE, P / 2.6, 5.).rgb, S = textureLod(uPrS, P / 2.2, 4.).rgb, T = textureLod(uPrT, P / 2.8, 4.).rgb;
    vec4 w = prPesi(P, iS.z); w.z *= .3; /* the earth is under the grass, not on its blades */ vErC = prMix(G, E, S, T, w, P, iS.z) * iC;
    float rb = prH(iP.xz * 3.1 + position.xz * 7.); vErC = mix(vErC, vec3(.5, .43, .26) * iC, step(.84, rb) * .7) * (.9 + .3 * prH(iP.zx * 1.7 + position.zx * 5.));
    if (iS.z > 2.5) vErC = (iS.z < 3.5 ? vec3(.1, .21, .05) : iS.z < 4.5 ? vec3(.56, .43, .18) : vec3(.5, .41, .25)) * (.82 + .36 * prH(iP.xz * 1.3 + position.xz * 3.)); } /* green wheat, ripe wheat, stubble */ /* some blades dry (straw), each a little lighter or darker */
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
  for (const dx of [-260, 0, 260]) for (const dz of [-260, 0, 260]) { const T = TILES[tileOf((x0 + x1) / 2 + dx, (z0 + z1) / 2 + dz)]; if (!T || seen.has(T)) continue; if (!T.l0 || !T.d) return null; seen.add(T); /* a tile round it not loaded yet: asked again later (a field belongs to the tile of its middle) */
    if (!T._erC || T._erCd !== T.d) T._erCd = T.d, T._erC = (T.d.ls || []).filter(L => L.s === 'campo' || L.s === 'prato').map(L => { const P = dec(L.p); return { P, b: bbox(P), k: L.s, st: CAMPI.on ? campoStato(P, L.s) : null }; });
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
  for (const f of campi) if (x > f.b[0] && x < f.b[2] && z > f.b[1] && z < f.b[3] && inPoly(x, z, f.P)) { /* the edge of a field; inside, its crop (campoStato) */
    if (erbaBordo(x, z, f.P) < 1.6) return [1, sy && sy.col, 0.5]; const st = f.st; if (!st) return -1;
    if (st.stato === 'prato') return [1, sy && sy.col, st.h]; if (st.stato === 'verde') return [3, null, st.h]; if (st.stato === 'oro') return [4, null, 0.92];
    if (st.stato === 'stoppie') return trHash(x * 7.7, z * 3.1) < 0.45 ? [5, null, 0.16] : -1; return -1; }
  if (F.m) { for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) { const ii = i + di, jj = j + dj; if (ii >= 0 && jj >= 0 && ii < c && jj < c && F.m[jj * c + ii] === 4) return [1, sy && sy.col, 0.5]; } } /* a stream's bank */
  return -1;
}
function erbaChunk(ci, cj) {
  const E = ERBA, CH = E.CH, x0 = ci * CH, z0 = cj * CH, n = Math.round(CH / E.sp), campi = erbaCampi(x0, z0, x0 + CH, z0 + CH), L = []; if (!campi) return null;
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
// ---- the hedges (fase 2; Carlo 14/11, via Tommaseo: "ancora un blocco dritto con un disegno di foglie"). A hedge is a mass of leaves: a core of leaves, darker
// inside and at the foot, its outline moved by the noise of the world (the same at the joins of two pieces, and where a car cut it), the top uneven, one or two
// shells of leaves standing out of it with holes, and sprigs poking out. Two kinds, by what lies along it (siepeTipo):
//  - potata, in the gardens and the built-up areas: square but soft, rounded edges, a few cm of lumps, short fresh sprigs on the top;
//  - libera, along fields, ditches, the railway and the incolti: a hedge of the countryside, mixed shrubs and small trees, wide and swollen, uneven in height
//    (humps up to 1.5 m more where a small tree stands), lumpy outline, long twigs and sprigs out of the top and sides, greens of different shrubs.
// The collision stays the line of the map (a car still cuts it as before, sfondabili3.js). &siepi=0: the hedges of realismo 3
const SIEPI = window.__SIEPI = { on: VERDE3.on && !/[?&]siepi=0/.test(location.search), potate: 0, libere: 0, tipo: new Map(), arb: new Map(), narb: 0 };
const vn2 = (x, z) => { const i = Math.floor(x), j = Math.floor(z), f = x - i, g = z - j, u = f * f * (3 - 2 * f), v = g * g * (3 - 2 * g), h = (a, b) => trHash(a * 1.731 + 0.13, b * 2.197 + 0.71);
  return (h(i, j) * (1 - u) + h(i + 1, j) * u) * (1 - v) + (h(i, j + 1) * (1 - u) + h(i + 1, j + 1) * u) * v; };
/* the land on both sides of a hedge: 1 libera (fields, meadows, incolti, scrub, woods, farmland, the railway), 0 potata (gardens, homes, parks, schools). Once per hedge */
function siepeTipo(br) {
  const P = br.pts, key = Math.round(P[0][0] * 10) + ',' + Math.round(P[0][1] * 10) + ',' + P.length; if (SIEPI.tipo.has(key)) return SIEPI.tipo.get(key);
  let lib = 0, pot = 0; const bb = bbox(P), campi = erbaCampi(bb[0] - 4, bb[1] - 4, bb[2] + 4, bb[3] + 4) || [];
  const areaT = (x, z) => { const T = TILES[tileOf(x, z)]; if (!T || !T.d) return 0; if (!T._sbA || T._sbAd !== T.d) T._sbAd = T.d, T._sbA = (T.d.a || []).map(a => { const o = dec(a.p); return { t: a.t, o, b: bbox(o) }; }); let t = 0;
    for (const A of T._sbA) if (x > A.b[0] && x < A.b[2] && z > A.b[1] && z < A.b[3] && inPoly(x, z, A.o)) t = A.t; return t; };
  const step = Math.max(1, Math.floor((P.length - 1) / 8));
  for (let k = 1; k < P.length; k += step) {
    const a = P[k - 1], c = P[k], L = hyp(c[0] - a[0], c[1] - a[1]) || 1, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
    if (nearRail(mx, mz, 9)) lib += 3;
    for (const sd of [-2.5, 2.5]) { const x = mx + nx * sd, z = mz + nz * sd;
      if (campi.some(f => x > f.b[0] && x < f.b[2] && z > f.b[1] && z < f.b[3] && inPoly(x, z, f.P))) { lib += 2; continue; }
      const t = areaT(x, z); if (t === 18 || t === 12 || t === 13 || t === 11) lib++; else if (t) pot++; }
  }
  const r = lib > 0 && lib >= pot ? 1 : 0; SIEPI.tipo.set(key, r); return r; /* wild land on one side is enough: a lot of incolto, a field */
}
/* the cross-section: [u across (in half-widths), y up (in heights)], from the foot on one side over the top to the foot on the other */
const SP_PRF = [[[-1, 0], [-1, .5], [-1, .84], [-.94, .96], [-.74, 1], [-.3, 1], [.3, 1], [.74, 1], [.94, .96], [1, .84], [1, .5], [1, 0]],
  [[-.8, 0], [-.95, .25], [-1.02, .5], [-1, .72], [-.9, .88], [-.6, .98], [-.2, 1.02], [.2, 1.02], [.6, .98], [.9, .88], [1, .72], [1.02, .5], [.95, .25], [.8, 0]]];
const SP_NRM = SP_PRF.map(P => P.map((p, i) => { const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)], tu = b[0] - a[0], ty = (b[1] - a[1]) * 1.6, l = Math.hypot(tu, ty) || 1; return [ty / l, -tu / l]; })); /* outward in the plane (height ~1.6 half-widths) */
const SP_TINT = [[1, 1, 1], [1.12, 1.06, .78], [.84, .96, .92], [1.05, .92, .8]]; /* the shrubs of a free hedge: their own greens */
function siepeDraw(B, br, a, c, acc, cap, ga, gc, la, lc) {
  const L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.02) return;
  const lib = siepeTipo(br), P = SP_PRF[lib], NR = SP_NRM[lib], ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, nx = uz, nz = -ux, col = new THREE.Color();
  if (acc === 0) SIEPI[lib ? 'libere' : 'potate']++;
  const n = Math.max(1, Math.ceil(L / (lib ? 0.4 : 0.5))), W0 = lib ? 0.8 : 0.42, H0 = br.h * (lib ? 1.12 : 1);
  /* the ring at s along the segment, the shell off metres out, salt for its noise: [x, y, z, nx, ny, nz, shade] per point of the section */
  const ring = (s, off, salt) => {
    const x0 = a[0] + ux * s, z0 = a[1] + uz * s, gy = ga + (gc - ga) * s / L, fy = Math.min(gy, la + (lc - la) * s / L) - 0.12;
    const hump = lib ? 1.5 * Math.pow(Math.max(0, vn2(x0 / 9 + 3.1, z0 / 9 - 1.7) - 0.62) / 0.38, 1.6) : 0, Hs = H0 * (lib ? 0.88 + 0.3 * vn2(x0 / 5.3, z0 / 5.3) : 1) + hump, Ws = W0 * (lib ? 0.92 + 0.16 * vn2(x0 / 6.1 + 7, z0 / 6.1) + 0.25 * hump / 1.5 : 1);
    return P.map(([pu, py], i) => {
      const [qu, qy] = NR[i], y = gy + py * Hs, X = x0 + nx * pu * Ws, Z = z0 + nz * pu * Ws;
      const d = lib ? (vn2(X / 1.1 + y * 0.7, Z / 1.1 - y * 0.5) - 0.5) * 0.42 + (vn2(X / 0.5, Z / 0.5 + y * 1.1) - 0.5) * 0.2 : (vn2(X / 0.9 + y * 0.8, Z / 0.9 - y * 0.5) - 0.5) * 0.1 + (vn2(X / 0.35, Z / 0.35 + y * 1.3) - 0.5) * 0.06 + (py > 0.9 ? (vn2(X / 0.6 + 5, Z / 0.6) - 0.5) * 0.1 : 0); /* the same lumps for every layer: the shells stand round the core; a clipped top uneven by a few cm */
      const o = off * (0.8 + 0.4 * vn2(X / 0.3 + salt, Z / 0.3 + y)) + d * (0.4 + 0.6 * Math.min(1, py * 1.6)), wx = nx * qu, wz = nz * qu; /* less at the foot: the hedge stands on its line */
      return [X + wx * o, i === 0 || i === P.length - 1 ? fy : y + qy * o, Z + wz * o, wx, qy, wz, 0.5 + 0.5 * Math.min(1, py * 1.25)];
    });
  };
  const tint = s => { const x = a[0] + ux * s, z = a[1] + uz * s; if (!lib) return SP_TINT[0]; const t = SP_TINT[Math.floor(vn2(x / 4.3 + 11, z / 4.3) * 3.99)]; return t; };
  const strip = (b, R0, R1, t0, t1, dark) => { const i0 = b.p.length / 3, m = R0.length;
    for (const [R, t] of [[R0, t0], [R1, t1]]) for (const q of R) vtx(b, q[0], q[1], q[2], q[3], q[4], q[5], 0, 0, col.setRGB(t[0] * q[6] * dark, t[1] * q[6] * dark, t[2] * q[6] * dark));
    for (let i = 0; i + 1 < m; i++) b.i.push(i0 + i, i0 + m + i, i0 + m + i + 1, i0 + i, i0 + m + i + 1, i0 + i + 1, i0 + i, i0 + m + i + 1, i0 + m + i, i0 + i, i0 + i + 1, i0 + m + i + 1); }; /* both faces: the shells are seen from inside through their holes */
  const layers = lib ? [[B.hd, 0, 0, 0.95], [B.hdF, 0.1, 3.3, 1.12], [B.hdF, 0.22, 7.1, 1.2]] : [[B.hd, 0, 0, 1.0], [B.hdF, 0.08, 3.3, 1.22]];
  for (const [b, off, salt, dark] of layers) { if (!b) continue; let R0 = ring(0, off, salt), t0 = tint(0);
    for (let k = 1; k <= n; k++) { const s = L * k / n, R1 = ring(s, off, salt), t1 = tint(s); strip(b, R0, R1, t0, t1, dark); R0 = R1; t0 = t1; } }
  /* a free hedge is mixed shrubs and small trees: every 4-8 m a shrub crown standing out of it (1.2-1.6 times its height), now and then a small tree (3.5-5 m);
     the crowns of the trees (TREE_G, MAT.crown: their season, bare in winter), drawn by buildVerde in the tile of each */
  if (lib) for (let s = 0.5; s < L; s += 1) { const x = a[0] + ux * s, z = a[1] + uz * s; if (trHash(Math.round(x) * 1.3, Math.round(z) * 0.7) > 0.22) continue;
    const t = SIEPI.T ?? tileOf(x, z), key = Math.round(x) + ',' + Math.round(z); let m = SIEPI.arb.get(t); if (!m) SIEPI.arb.set(t, m = new Map()); if (m.has(key) || [...m.values()].some(q => hyp(q[0] - x, q[1] - z) < 4)) continue;
    const h = trHash(x * 2.1, z * 1.3), tree = h < 0.25, gy = ga + (gc - ga) * s / L; m.set(key, [x + nx * (h - 0.5) * 0.6, z + nz * (h - 0.5) * 0.6, tree ? 3.5 + 1.5 * trHash(z, x) : H0 * (1.35 + 0.5 * trHash(z, x)), gy, tree]); }
  /* the ends (of the hedge, and of a cut): the section closed */
  for (const [e, s] of [[1, 0], [2, L]]) if (cap & e) { const R = ring(s, 0, 0), i0 = B.hd.p.length / 3; let cx = 0, cy = 0, cz = 0; for (const q of R) { cx += q[0]; cy += q[1]; cz += q[2]; }
    const sg = e === 1 ? -1 : 1, t = tint(s); vtx(B.hd, cx / R.length, cy / R.length, cz / R.length, ux * sg, 0, uz * sg, 0, 0, col.setRGB(t[0] * 0.5, t[1] * 0.5, t[2] * 0.5));
    for (const q of R) vtx(B.hd, q[0], q[1], q[2], ux * sg, 0, uz * sg, 0, 0, col.setRGB(t[0] * q[6] * 0.8, t[1] * q[6] * 0.8, t[2] * q[6] * 0.8));
    for (let i = 0; i + 1 < R.length; i++) B.hd.i.push(i0, i0 + 1 + i, i0 + 2 + i, i0, i0 + 2 + i, i0 + 1 + i); }
  /* sprigs: a spray of narrow leafy strips (a twig with its leaves) out of the top, and of the sides of a free hedge, leaning out; short fresh growth on a clipped one */
  if (B.hdF) { const step = lib ? 0.3 : 0.35;
    for (let s = step * 0.5; s < L; s += step) { const x0 = a[0] + ux * s, z0 = a[1] + uz * s, h1 = trHash(x0 * 3.1, z0 * 1.7), h2 = trHash(z0 * 2.3, x0 * 0.9), h3 = trHash(x0 * 0.7 + 5, z0 * 4.1); if (!lib && h1 > 0.7) continue; if (lib && h2 >= 0.45 && h3 > 0.4) continue; /* a free hedge: a spray on the top here and there, not in a row */
      const R = ring(s, lib ? 0.12 : 0.05, 3.3), side = lib && h2 < 0.45, pi = side ? (h1 < 0.5 ? 2 + Math.floor(h2 * 5) : P.length - 3 - Math.floor(h2 * 5)) : Math.floor(P.length / 2) - 2 + Math.floor(h2 * 4), q = R[Math.max(1, Math.min(P.length - 2, pi))];
      const len = lib ? 0.35 + 0.65 * h2 + (side ? 0 : 0.35 * h1) : 0.14 + 0.2 * h2, lean = lib ? 0.3 + 0.5 * h1 : 0.25, t = tint(s);
      let dx = q[3] * lean + (h2 - 0.5) * 0.4, dy = side ? 0.4 : 1, dz = q[5] * lean + (h1 - 0.5) * 0.4; const dl = Math.hypot(dx, dy, dz); dx /= dl; dy /= dl; dz /= dl;
      const bx = q[0] - dx * 0.15, by = q[1] - dy * 0.15, bz = q[2] - dz * 0.15, nb = lib ? 4 : 3;
      for (let k = 0; k < nb; k++) { const ang = h1 * TAU + k * 2.4, fan = (trHash(x0 + k, z0 - k) - 0.5) * 0.9, ca = Math.cos(ang), sa = Math.sin(ang);
        let ex = dx + ca * fan, ey = dy, ez = dz + sa * fan; const el = Math.hypot(ex, ey, ez); ex /= el; ey /= el; ez /= el; /* each strip its own way out of the spray */
        const wd = (lib ? 0.09 : 0.06) * (0.8 + 0.5 * trHash(z0 + k, x0)), Lk = len * (0.6 + 0.5 * trHash(x0 - k, z0 + k)), sx = -sa * wd / 2, sz = ca * wd / 2, tx = bx + ex * Lk, ty = by + ey * Lk, tz = bz + ez * Lk, i0 = B.hdF.p.length / 3;
        let cx = sz * ey, cy = sx * ez - sz * ex, cz = -sx * ey; const cl = Math.hypot(cx, cy, cz) || 1; cx /= cl; cy /= cl; cz /= cl; /* the strip's own normal: the leaves laid along it (HEDGE_PATCH) */
        for (const [px, py, pz, sh] of [[bx - sx, by, bz - sz, 0.6], [bx + sx, by, bz + sz, 0.6], [bx + ex * Lk * 0.6 + sx * 1.6, by + ey * Lk * 0.6, bz + ez * Lk * 0.6 + sz * 1.6, 0.85], [tx, ty, tz, 0.92], [bx + ex * Lk * 0.6 - sx * 1.6, by + ey * Lk * 0.6, bz + ez * Lk * 0.6 - sz * 1.6, 0.85]]) vtx(B.hdF, px, py, pz, cx, cy, cz, 0, 0, col.setRGB(t[0] * sh, t[1] * sh, t[2] * sh));
        B.hdF.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 4, i0 + 4, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 4, i0 + 2, i0 + 4, i0 + 3, i0 + 2); }
    } }
}
if (SIEPI.on && VERDE3.on) { MAT.hedge.vertexColors = true; MAT.hedgeLeaf.vertexColors = true; }
/* the shrubs and small trees of the free hedges of a tile (siepeDraw): crowns of the trees, the small tree with its stem */
function siepeArbusti(T, G) {
  const m = SIEPI.arb.get(T.t); if (!m || !m.size) return; const L = [...m.values()].filter(([x, z]) => !inBuilding(x, z, 0.5) && !onAnyRoad(x, z, 0.3)); if (!L.length) return;
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), p = new THREE.Vector3(), sc = new THREE.Vector3(), c = new THREE.Color();
  for (let v = 0; v < 3; v++) { const list = L.filter(([x, z]) => Math.floor(trHash(z * 1.7, x * 0.3) * 3) === v); if (!list.length) continue;
    const im = new THREE.InstancedMesh(TREE_G.crownS[v], MAT.crown, list.length); im.castShadow = true; im.receiveShadow = true; im.customDepthMaterial = TREE_DEPTH; const tr = list.filter(l => l[4]), tm = tr.length ? new THREE.InstancedMesh(TREE_G.trunkS, MAT.trunk, tr.length) : null; let ti = 0;
    list.forEach(([x, z, h, gy, tree], i) => { const k = trHash(x * 1.7, z * 2.3), w = tree ? (2.2 + 1.2 * k) / 5.4 : (1.4 + 0.8 * k) / 4.5, hy = tree ? (h - 1.2) / 4.5 : h / 4.1, yc = tree ? gy + 1.2 + (h - 1.2) * 0.5 : gy + h * 0.5 - 0.1;
      m4.compose(p.set(x, yc, z), q.setFromEuler(e.set(0, k * TAU, 0)), sc.set(w, hy, w * (0.85 + 0.3 * trHash(z, x)))); im.setMatrixAt(i, m4); im.setColorAt(i, c.copy(COL(CESP_COL[Math.floor(k * 6) % 6])).multiplyScalar(0.9 + 0.3 * trHash(x + 3, z)));
      if (tree && tm) { m4.compose(p.set(x, gy, z), q.identity(), sc.set(0.45, 1.6 + (h - 1.2) * 0.3, 0.45)); tm.setMatrixAt(ti++, m4); } });
    im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true; G.add(im); ramiAggiungi(G, im, true); if (tm) { tm.castShadow = true; G.add(tm); } SIEPI.narb += list.length; }
}
// ---- the fields (fase 3; Carlo 14/11: the fields were stickers, furrows drawn flat, the round bales "ultra PS1"). What a field is comes from the map (DBGT CL_AGR
// 07 seminativi and OSM farmland: campo; CL_AGR 05 and OSM meadow: prato stabile). What is sown nobody knows: each seminativo has a choice of its own, the same
// every time (from its place), among maize, wheat and ploughed land, and the day of the year (stagioni3.js STAG_DOY) says how it is now:
//  - maize: ploughed until spring, then the plants in rows 75 cm apart, up to about 2.2 m in summer, drying out in September; after the harvest the stubble;
//  - wheat: the young green rows in winter, green and taller in spring, golden and waving in June, then the stubble and the round bales, ploughed in autumn;
//  - ploughed: the clods of real earth along the furrows;
//  - prato stabile: tall grass, mown three times (June, August, September), the round bales on the mown meadow for some weeks.
// The tile takes the state when it is laid out (a season changed by a code shows on the tiles laid out after). &campi=0: the fields as before
const CAMPI = window.__CAMPI3 = { on: VERDE3.on && PRATO.on && !/[?&]campi=0/.test(location.search), stati: {} };
const CAMPO_ID = { arato: 0, stoppie: 1, giovane: 2, verde: 3, oro: 4, mais: 5, stoppieMais: 6 };
function campoStato(P, kind) {
  const [cx, cz] = centroid(P), h = trHash(cx * 0.131, cz * 0.293), d = STAG_DOY, A = lsRect(P) || lsAxis(P), r = { ux: A.ux, uz: A.uz, balle: false, h: 0, secco: 0 };
  if (kind === 'prato') {
    const cut = (d >= 155 && d < 190) || (d >= 215 && d < 250) || (d >= 262 && d < 300); r.tipo = 'prato'; r.stato = cut ? 'sfalciato' : 'prato';
    r.balle = cut && !(d >= 215 && d < 219) && !(d >= 262 && d < 266) && d >= 158; r.h = d < 75 || d > 320 ? 0.3 : d > 250 ? 0.42 : 0.62; return r;
  }
  r.tipo = h < 0.36 ? 'mais' : h < 0.72 ? 'frumento' : 'arato';
  if (r.tipo === 'arato') r.stato = 'arato';
  else if (r.tipo === 'frumento') {
    if (d < 60 || d >= 290) { r.stato = 'giovane'; r.h = 0.1; } else if (d < 150) { r.stato = 'verde'; r.h = 0.15 + 0.6 * (d - 60) / 90; } else if (d < 185) { r.stato = 'oro'; r.h = 0.9; }
    else if (d < 255) { r.stato = 'stoppie'; r.balle = d < 245; } else r.stato = 'arato';
  } else {
    if (d < 130) r.stato = 'arato'; else if (d < 272) { r.stato = 'mais'; r.h = Math.min(2.25, 0.25 + 2.0 * (d - 130) / 70); r.secco = clamp((d - 228) / 40, 0, 1); } else r.stato = 'stoppieMais';
  }
  return r;
}
/* the ground of a seminativo: one drape over the field, its look from the vertex colour: the row direction (r, g) and the state (b); in world space */
const CAMPO_GLSL = `
uniform sampler2D uZo; uniform sampler2D uZoN; uniform sampler2D uPa; uniform sampler2D uPrG; uniform sampler2D uPrS;
float cpH(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float cpN(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(cpH(i), cpH(i + vec2(1, 0)), f.x), mix(cpH(i + vec2(0, 1)), cpH(i + vec2(1, 1)), f.x), f.y); }
vec3 cpTex(sampler2D m, vec2 uv) { vec2 c = floor(uv), f = fract(uv), s = vec2(cpH(c) > .5 ? -1. : 1., cpH(c + 7.3) > .5 ? -1. : 1.); return textureGrad(m, f * s + (1. - s) * .5, dFdx(uv) * s, dFdy(uv) * s).rgb; } /* mirrored tiles: no repeat */
`;
const CAMPO_FRAG = `
  vec2 cpU = normalize(vColor.rg * 2. - 1. + 1e-4), cpV = vec2(-cpU.y, cpU.x); float cpSt = floor(vColor.b * 10.);
  vec2 cpP = vWp.xz; float cpS = dot(cpP, cpU), cpR = dot(cpP, cpV), cpFw = length(fwidth(cpP)); /* along the rows, across them; the size of a pixel */
  vec3 cpSoil = cpTex(uZo, vec2(cpS, cpR) / 2.3) * (.9 + .2 * cpN(cpP / 7.)), cpC = cpSoil; float cpRid = 0.;
  if (cpSt < .5) { float p = fract(cpR / .85); cpRid = smoothstep(0., .5, p) * smoothstep(1., .5, p); cpC = cpSoil * mix(.62, 1.08, mix(.5, cpRid, 1. - smoothstep(.04, .2, cpFw))); } /* ploughed: the furrows */
  else if (cpSt < 1.5) { vec3 pa = cpTex(uPa, cpP / 1.9) * vec3(1.05, .95, .7); float rw = smoothstep(.35, .0, abs(fract(cpR / .15) - .5)) * (1. - smoothstep(.015, .05, cpFw)); cpC = mix(cpSoil, pa, .6 + .2 * rw + .25 * (cpN(cpP / 2.3) - .5)); } /* wheat stubble: straw in the drill rows */
  else if (cpSt < 2.5) { float rw = smoothstep(.22, .0, abs(fract(cpR / .15) - .5)); rw = mix(.3, rw, 1. - smoothstep(.02, .08, cpFw)); cpC = mix(cpSoil, vec3(.11, .2, .05) * (.8 + .4 * cpN(cpP * 3.)), rw * .85); } /* young wheat: green rows on the earth */
  else if (cpSt < 3.5) { cpC = mix(cpSoil, cpTex(uPrG, cpP / 2.4) * vec3(.85, 1.05, .7), .9); }
  else if (cpSt < 4.5) { cpC = cpTex(uPa, vec2(cpS / .9, cpR / .9)) * vec3(1.15, 1., .62); }
  else if (cpSt < 5.5) { float rw = smoothstep(.3, .0, abs(fract(cpR / .75) - .5)); cpC = cpSoil * (.75 + .1 * rw); cpC = mix(cpC, cpTex(uPrS, cpP / 2.2) * .7, .25 * rw); } /* under the maize */
  else { vec3 pa = cpTex(uPa, vec2(cpS / .6, cpR / .6)) * vec3(.8, .66, .45); float rw = smoothstep(.25, .0, abs(fract(cpR / .75) - .5)) * (1. - smoothstep(.03, .12, cpFw)); cpC = mix(cpSoil * .9, pa, .3 + .25 * rw * step(.55, cpN(vec2(cpS * 4., cpR)))); } /* maize stubble: stalks cut in the rows, the leaves on the ground */
  diffuseColor.rgb *= cpC;
`;
const CAMPO_NRM = `
  { vec4 t = textureGrad(uZoN, vec2(cpS, cpR) / 2.3, dFdx(vec2(cpS, cpR) / 2.3), dFdy(vec2(cpS, cpR) / 2.3)); vec2 xy = (t.xy * 2. - 1.) * (cpSt < .5 || cpSt > 4.5 ? 1.4 : .7);
    float dr = 0.; if (cpSt < .5) { float p = fract(cpR / .85); dr = (p < .5 ? 1. : -1.) * .45 * (1. - smoothstep(.04, .2, cpFw)); } /* the slopes of the furrows */
    vec3 nw = normalize(vec3(0., 1., 0.) + vec3(cpU.x, 0., cpU.y) * xy.x + vec3(cpV.x, 0., cpV.y) * (xy.y - dr));
    normal = normalize((viewMatrix * vec4(nw, 0.)).xyz); }
`;
MAT.campo = (() => {
  if (!CAMPI.on) return null;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 });
  const U = { uZo: { value: prTex('zolle') }, uZoN: { value: (() => { const t = new THREE.TextureLoader().load('tex/zolle_nr.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; return t; })() }, uPa: { value: prTex('paglia') }, uPrG: PR_U.uPrG, uPrS: PR_U.uPrS };
  m.onBeforeCompile = s => { VAR_VERT(s); Object.assign(s.uniforms, U);
    s.fragmentShader = VAR_GLSL + CAMPO_GLSL + s.fragmentShader.replace('#include <color_fragment>', CAMPO_FRAG).replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + CAMPO_NRM); };
  m.customProgramCacheKey = () => 'campo-verde'; return m;
})();
/* the drape of a seminativo (paesaggio3.js), and the roof of a maize field seen from afar (past the plants round the camera: a surface at the height of the
   crop and its sides at the edge, faded out near the camera where the true plants stand) */
function campoSuolo(P, st, fb, tb) {
  const col = new THREE.Color(st.ux * 0.5 + 0.5, st.uz * 0.5 + 0.5, (CAMPO_ID[st.stato] + 0.5) / 10);
  try { polyFill(fb, P, [], 0.03, 10, col); } catch (e) { return; }
  if (st.stato === 'mais' && st.h > 0.8 && tb) {
    const top = st.h * 0.93, q = col.clone(); q.b = st.secco; try { polyFill(tb, P, [], top, 10, q); } catch (e) { }
    for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.2) continue; const n = Math.max(1, Math.ceil(L / 3));
      for (let k = 0; k < n; k++) { const x0 = a[0] + (c[0] - a[0]) * k / n, z0 = a[1] + (c[1] - a[1]) * k / n, x1 = a[0] + (c[0] - a[0]) * (k + 1) / n, z1 = a[1] + (c[1] - a[1]) * (k + 1) / n, g0 = H.ground(x0, z0), g1 = H.ground(x1, z1), nx = (z1 - z0) / (L / n), nz = -(x1 - x0) / (L / n), i0 = tb.w.p.length / 3;
        vtx(tb.w, x0, g0, z0, nx, 0, nz, 0, 0, q); vtx(tb.w, x1, g1, z1, nx, 0, nz, 0, 0, q); vtx(tb.w, x1, g1 + top, z1, nx, 0, nz, 0, 1, q); vtx(tb.w, x0, g0 + top, z0, nx, 0, nz, 0, 1, q);
        tb.w.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); } }
  }
}
const MAIS_R = 40;
MAT.maisTetto = (() => {
  if (!CAMPI.on) return null;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = s => { VAR_VERT(s); s.uniforms.uPrE = { value: HEDGE_TEX }; s.uniforms.uPrS = PR_U.uPrS;
    s.fragmentShader = VAR_GLSL + 'uniform sampler2D uPrE; uniform sampler2D uPrS;\n' + s.fragmentShader.replace('#include <color_fragment>', `
  { float d = length(vWp.xz - cameraPosition.xz), f = smoothstep(${MAIS_R - 7}.0, ${MAIS_R - 1}.0, d); if (h21(floor(gl_FragCoord.xy)) > f) discard; /* near: the true plants */
    vec2 cu = normalize(vColor.rg * 2. - 1. + 1e-4), P = vWp.xz + vec2(0., vWp.y * .7); float s = dot(P, cu), r = dot(P, vec2(-cu.y, cu.x)); /* along and across the rows */
    vec4 lf = texture2D(uPrE, vec2(s / 1.1, r / .4)), lf2 = texture2D(uPrE, vec2(r / 1.3, s / .5) + .37); float a = max(lf.a, lf2.a * .8);
    vec3 g = mix(vec3(.02, .045, .012), mix(lf.rgb, lf2.rgb, .4) * vec3(.3, .44, .2), a), y = texture2D(uPrS, P / 2.7).rgb * vec3(1.05, .85, .5) * mix(.45, 1., a);
    float k = (.75 + .5 * vn(P / 1.6)) * mix(.72, 1., smoothstep(.0, .3, abs(fract(r / .75) - .5))); diffuseColor.rgb *= mix(g, y, vColor.b) * k; }`); };
  m.customProgramCacheKey = () => 'mais-tetto'; return m;
})();
// ---- the maize plants round the camera (within MAIS_R): a stalk, nine long leaves arching out and hanging, the tassel, a cob; in the rows of the field,
// one every 30 cm; swaying with the wind. Built as the tall grass, in chunks of 10 m
const MAIS = window.__MAIS = { on: CAMPI.on && !/[?&]mais=0/.test(location.search), CH: 10, cap: 30000, chunks: new Map(), n: 0, cx: 1e9, cz: 1e9, dirty: true };
const MAIS_G = (() => {
  const P = [], N = [], C = [], I = []; let sd = 13; const r = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const G = [0.075, 0.16, 0.035], Y = [0.45, 0.37, 0.18], quad = (pts, col, nrm) => { const i0 = P.length / 3; for (const p of pts) { P.push(...p); N.push(...nrm); C.push(...col); } I.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
  for (const a of [0, Math.PI / 2]) { const ca = Math.cos(a) * 0.012, sa = Math.sin(a) * 0.012; quad([[-ca, 0, -sa], [ca, 0, sa], [ca * 0.6, 0.97, sa * 0.6], [-ca * 0.6, 0.97, -sa * 0.6]], G, [-Math.sin(a), 0.3, Math.cos(a)]); } /* the stalk */
  for (let k = 0; k < 9; k++) { /* the leaves: from the stalk, up and out, then hanging; alternate sides */
    const y0 = 0.14 + k * 0.085, az = (k % 2 ? Math.PI : 0) + (r() - 0.5) * 0.8, dx = Math.cos(az), dz = Math.sin(az), wx = -dz, wz = dx, L = (0.3 + 0.12 * Math.sin(k / 8 * Math.PI)) * (0.85 + 0.3 * r()), w = 0.03 + 0.012 * r();
    let px = 0, py = y0, pz = 0, ang = 1.1 - 0.05 * k; const pts = [];
    for (let s = 0; s <= 4; s++) { const ww = w * Math.sin(Math.min(1, (s + 0.6) / 4.6) * Math.PI) * (s === 4 ? 0.2 : 1); pts.push([px, py, pz, ww]); const st = L / 4; px += dx * Math.cos(ang) * st; pz += dz * Math.cos(ang) * st; py += Math.sin(ang) * st; ang -= 0.45 + 0.1 * r(); }
    for (let s = 0; s < 4; s++) { const [ax, ay, az2, aw] = pts[s], [bx, by, bz, bw] = pts[s + 1]; quad([[ax - wx * aw, ay, az2 - wz * aw], [ax + wx * aw, ay, az2 + wz * aw], [bx + wx * bw, by, bz + wz * bw], [bx - wx * bw, by, bz - wz * bw]], G.map(v => v * (0.85 + 0.12 * s)), [dx * 0.5 + wx * (r() - 0.5), 0.8, dz * 0.5 + wz * (r() - 0.5)]); }
  }
  for (let k = 0; k < 4; k++) { const az = k / 4 * Math.PI * 2 + 0.3, dx = Math.cos(az) * 0.06, dz = Math.sin(az) * 0.06; quad([[-0.004, 0.96, 0], [0.004, 0.96, 0], [dx + 0.004, 1.06, dz], [dx - 0.004, 1.06, dz]], Y, [0, 1, 0]); } /* the tassel */
  { const y = 0.5, o = 0.03; for (const a of [0, Math.PI / 2]) { const ca = Math.cos(a) * 0.022, sa = Math.sin(a) * 0.022; quad([[o - ca, y, -sa], [o + ca, y, sa], [o + ca * 0.7, y + 0.11, sa * 0.7], [o - ca * 0.7, y + 0.11, -sa * 0.7]], [0.2, 0.26, 0.08], [0, 0.3, 1]); } } /* the cob in its husk */
  return { P, N, C, I };
})();
MAIS.mesh = (() => {
  if (!MAIS.on) return null;
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = s => { s.uniforms.uVento = VENTO.u; s.uniforms.uCam = { value: camera.position };
    s.vertexShader = 'attribute vec4 iP; attribute vec4 iS; uniform vec4 uVento; uniform vec3 uCam;\n' + s.vertexShader.replace('#include <begin_vertex>', `
  float mzC = cos(iS.y), mzS = sin(iS.y); vec3 transformed = position; transformed.xz = mat2(mzC, mzS, -mzS, mzC) * transformed.xz; transformed *= iS.x;
  float mzK = 1. - smoothstep(${MAIS_R - 4}.0, ${MAIS_R}.0, length(iP.xz - uCam.xz)); transformed.y *= mzK; /* past the roof's edge: gone */
  { float t = position.y, ph = dot(iP.xz, uVento.xy) * .25 - uVento.w * 1.3, g = uVento.z * (.5 + .5 * sin(ph)) * .12 * t * t * iS.x; transformed.xz += uVento.xy * g + vec2(sin(uVento.w * 2.7 + iP.x), cos(uVento.w * 2.3 + iP.z)) * .015 * t * iS.x; }
  transformed += iP.xyz;`).replace('#include <color_vertex>', '#include <color_vertex>\n  vColor.rgb = mix(vColor.rgb, vec3(.42, .33, .17) * (.8 + .4 * iS.w), iS.z) * (.85 + .3 * iS.w); /* drying out in September */'); };
  m.customProgramCacheKey = () => 'mais';
  const g = new THREE.InstancedBufferGeometry(), G = MAIS_G;
  g.setAttribute('position', new THREE.Float32BufferAttribute(G.P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(G.N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(G.C, 3)); g.setIndex(G.I);
  MAIS.aP = new THREE.InstancedBufferAttribute(new Float32Array(MAIS.cap * 4), 4); MAIS.aS = new THREE.InstancedBufferAttribute(new Float32Array(MAIS.cap * 4), 4);
  for (const a of [MAIS.aP, MAIS.aS]) a.setUsage(THREE.DynamicDrawUsage); g.setAttribute('iP', MAIS.aP); g.setAttribute('iS', MAIS.aS); g.instanceCount = 0;
  const me = new THREE.Mesh(g, m); me.frustumCulled = false; me.castShadow = false; me.receiveShadow = true; scene.add(me); return me;
})();
function maisChunk(ci, cj) {
  const CH = MAIS.CH, x0 = ci * CH, z0 = cj * CH, out = [], all = erbaCampi(x0, z0, x0 + CH, z0 + CH); if (!all) return null; const fields = all.filter(f => f.st && f.st.stato === 'mais');
  for (const f of fields) {
    const st = f.st, ux = st.ux, uz = st.uz, vx = -uz, vz = ux, cs = [[x0, z0], [x0 + CH, z0], [x0, z0 + CH], [x0 + CH, z0 + CH]].map(([x, z]) => [x * ux + z * uz, x * vx + z * vz]);
    const s0 = Math.min(...cs.map(c => c[0])), s1 = Math.max(...cs.map(c => c[0])), r0 = Math.min(...cs.map(c => c[1])), r1 = Math.max(...cs.map(c => c[1]));
    for (let r = Math.ceil(r0 / 0.75) * 0.75; r < r1; r += 0.75) for (let s = Math.ceil(s0 / 0.3) * 0.3; s < s1; s += 0.3) {
      const j1 = trHash(s * 3.1, r * 1.7), x = ux * (s + (j1 - 0.5) * 0.1) + vx * r, z = uz * (s + (j1 - 0.5) * 0.1) + vz * r;
      if (x < x0 || x >= x0 + CH || z < z0 || z >= z0 + CH || j1 < 0.06) continue; /* a gap here and there */
      if (!(x > f.b[0] && x < f.b[2] && z > f.b[1] && z < f.b[3]) || !inPoly(x, z, f.P) || erbaBordo(x, z, f.P) < 1.2 || inBuilding(x, z, 0.3)) continue;
      out.push(x, H.surface(x, z) - 0.02, z, 0, st.h * (0.85 + 0.3 * trHash(x * 2.3, z * 5.1)), trHash(z, x) * TAU, st.secco, trHash(x * 7.1, z * 0.3));
    }
  }
  const N = out.length / 8, P = new Float32Array(N * 4), S = new Float32Array(N * 4);
  for (let i = 0; i < N; i++) { P.set(out.slice(i * 8, i * 8 + 4), i * 4); S.set(out.slice(i * 8 + 4, i * 8 + 8), i * 4); }
  return { ci, cj, N, P, S };
}
function maisAggiorna() {
  const E = MAIS, cam = camera.position, CH = E.CH;
  if (cam.y - H.surface(cam.x, cam.z) > 60) { E.mesh.geometry.instanceCount = 0; E.cx = 1e9; return; }
  const want = []; for (let j = Math.floor((cam.z - MAIS_R) / CH); j <= Math.floor((cam.z + MAIS_R) / CH); j++) for (let i = Math.floor((cam.x - MAIS_R) / CH); i <= Math.floor((cam.x + MAIS_R) / CH); i++) {
    const dx = Math.max(i * CH - cam.x, 0, cam.x - (i + 1) * CH), dz = Math.max(j * CH - cam.z, 0, cam.z - (j + 1) * CH), d = Math.hypot(dx, dz); if (d < MAIS_R) want.push([d, i, j]); }
  want.sort((a, b) => a[0] - b[0]); let made = 0;
  for (const [, i, j] of want) { const k = i + ',' + j; if (E.chunks.has(k)) continue; if (made >= 3) break; made++; const T = TILES[tileOf(i * CH + 5, j * CH + 5)]; if (!T || !T.ready) continue; const c = maisChunk(i, j); if (c) { E.chunks.set(k, c); E.dirty = true; } }
  for (const [k, c] of E.chunks) { const dx = Math.max(c.ci * CH - cam.x, 0, cam.x - (c.ci + 1) * CH), dz = Math.max(c.cj * CH - cam.z, 0, cam.z - (c.cj + 1) * CH); if (Math.hypot(dx, dz) > MAIS_R + 2 * CH) E.chunks.delete(k); }
  if (!E.dirty && Math.hypot(cam.x - E.cx, cam.z - E.cz) < 3) return;
  E.dirty = false; E.cx = cam.x; E.cz = cam.z; let n = 0;
  for (const [, i, j] of want) { const c = E.chunks.get(i + ',' + j); if (!c || !c.N) continue; const m = Math.min(c.N, E.cap - n); if (m <= 0) break; E.aP.array.set(c.P.subarray(0, m * 4), n * 4); E.aS.array.set(c.S.subarray(0, m * 4), n * 4); n += m; }
  for (const a of [E.aP, E.aS]) { a.clearUpdateRanges(); a.addUpdateRange(0, n * 4); a.needsUpdate = true; }
  E.mesh.geometry.instanceCount = n; E.n = n;
}
{ const u = updDayNight; updDayNight = function (dt) { u(dt); if (MAIS.mesh) maisAggiorna(); }; }
