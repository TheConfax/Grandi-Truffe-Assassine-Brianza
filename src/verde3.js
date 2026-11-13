// ---------------------------------------------------------------- realismo 3, fase C: the green (Carlo 13/11: "il verde a blocchi")
//  - hedges: leaves all over (a canvas of small leaves, laid in world metres, so no stretching), a darker solid inside and a shell of leaves HEDGE_FR out of it
//    with holes (alpha), so the outline is ragged and the inside shows dark between the leaves (sfondabili3.js barDraw, key hdF);
//  - shrubs where they really are (src/dbgt_verde.py cespugli: the LiDAR in the green of the DBGT, the scrub of the DBGT), the small crowns of the trees
//    near the ground, solid (a car stops in a thicket);
//  - tufts of grass round the camera on the lawns and the banks (only near: a pool of a few thousand that follows the camera);
//  - ivy on some garden walls (one stretch in nine, from the ground, thinner towards the top: sfondabili3.js, key ivy).
// &verde=0 turns all of it off (the hedges back to the block)
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
// ---- tufts of grass round the camera: a pool that follows it, on the lawns and banks (cells 3 and 5 of S), on the old ground's green too
const CIUFFI = (() => {
  if (!VERDE3.on || /[?&]ciuffi=0/.test(location.search)) return null;
  const g = new THREE.BufferGeometry(), P = [], UV = [], Nn = [];
  for (let k = 0; k < 3; k++) { const a = k * Math.PI / 3, cx = Math.cos(a) * 0.2, cz = Math.sin(a) * 0.2; const v = [[-cx, 0, -cz, 0, 0], [cx, 0, cz, 1, 0], [cx, 0.38, cz, 1, 1], [-cx, 0.38, -cz, 0, 1]];
    for (const i of [0, 1, 2, 0, 2, 3]) { P.push(v[i][0], v[i][1], v[i][2]); UV.push(v[i][3], v[i][4]); Nn.push(0, 1, 0); } }
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setAttribute('normal', new THREE.Float32BufferAttribute(Nn, 3));
  const m = new THREE.MeshLambertMaterial({ map: GRASS_TEX, alphaTest: 0.45, side: THREE.DoubleSide });
  m.onBeforeCompile = s => { s.uniforms.uCfT = RIF.t; s.vertexShader = 'uniform float uCfT;\n' + s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  { vec4 o = instanceMatrix * vec4(0., 0., 0., 1.); transformed.x += sin(uCfT * 2.1 + o.x * .7 + o.z * .4) * .05 * uv.y; transformed.z += cos(uCfT * 1.7 + o.z * .6) * .04 * uv.y; }'); };
  m.customProgramCacheKey = () => 'ciuffi-r3';
  const N = 3500, im = new THREE.InstancedMesh(g, m, N); im.count = 0; im.frustumCulled = false; im.receiveShadow = true; scene.add(im);
  return { im, N, cx: 1e9, cz: 1e9, R: 22, cell: 0.8, cache: new Map() };
})();
const _cfM = new THREE.Matrix4(), _cfQ = new THREE.Quaternion(), _cfE = new THREE.Euler(), _cfP = new THREE.Vector3(), _cfS = new THREE.Vector3(), _cfC = new THREE.Color();
/* on grass: the look of the highest layer of the tile over the point is the lawn or the dry grass (world3.js pitLook, with a box test first: hundreds of areas in a town tile), or the cell of S is grass or bank */
function ciuffoSuErba(x, z) {
  if (!H.fineAt(x, z)) return false; const mm = H.mat(x, z); if (mm === 3 || mm === 5) return true; if (mm === 1 || mm === 2 || mm === 6 || mm === 4) return false;
  const T = TILES[tileOf(x, z)]; if (!T || !T.layers || !T.ready) return null; /* the tile not laid out yet: asked again later */
  if (!T._lb || T._lbN !== T.layers.length) { T._lb = T.layers.map(([o]) => bbox(o)); T._lbN = T.layers.length; }
  let best = null, br = -1; T.layers.forEach(([o, k, rank, st], q) => { const b = T._lb[q]; if (rank < br || x < b[0] || x > b[2] || z < b[1] || z > b[3]) return; if (inPoly(x, z, o) && !k.some(h => inPoly(x, z, h))) { best = st; br = rank; } });
  return !!best && (best.m === MAT.grassS || best.m === MAT.incoltoS);
}
function ciuffiAggiorna() {
  const C = CIUFFI; if (!C) return; const x0 = camera.position.x, z0 = camera.position.z;
  if (hyp(x0 - C.cx, z0 - C.cz) < 3 && !(C.pend && performance.now() - C.t > 1000)) return; C.cx = x0; C.cz = z0; C.pend = false; C.t = performance.now();
  if (camera.position.y - H.surface(x0, z0) > 30) { C.im.count = 0; return; }
  const inv = LUCE.nome === 'inverno' ? 0.55 : LUCE.nome === 'autunno' ? 0.3 : 0; let n = 0;
  const s = C.cell, i0 = Math.floor((x0 - C.R) / s), i1 = Math.floor((x0 + C.R) / s), j0 = Math.floor((z0 - C.R) / s), j1 = Math.floor((z0 + C.R) / s);
  for (let j = j0; j <= j1 && n < C.N; j++) for (let i = i0; i <= i1 && n < C.N; i++) {
    const h1 = trHash(i * 1.31, j * 0.77); if (h1 > 0.6) continue;
    const x = (i + trHash(i, j)) * s, z = (j + trHash(j, i)) * s; if (hyp(x - x0, z - z0) > C.R) continue;
    const ck = i * 100003 + j; let ok = C.cache.get(ck); if (ok === undefined) { ok = ciuffoSuErba(x, z); if (ok !== null) C.cache.set(ck, ok); else C.pend = true; if (C.cache.size > 60000) C.cache.clear(); } if (!ok) continue;
    if (inBuilding(x, z, 0.2)) continue;
    const gy = H.surface(x, z), k = trHash(x * 3.1, z * 1.9), sz = 0.5 + 0.6 * k;
    _cfM.compose(_cfP.set(x, gy - 0.02, z), _cfQ.setFromEuler(_cfE.set(0, k * TAU, 0)), _cfS.set(sz, sz * (0.45 + 0.4 * h1), sz)); C.im.setMatrixAt(n, _cfM);
    C.im.setColorAt(n, _cfC.setRGB(0.9 + 0.35 * inv + 0.15 * k, 1.05 + 0.15 * k - 0.15 * inv, 0.55 + 0.05 * inv)); n++;
  }
  C.im.count = n; C.im.instanceMatrix.needsUpdate = true; if (C.im.instanceColor) C.im.instanceColor.needsUpdate = true; VERDE3.ciuffi = n;
}
{ const u = updDayNight; updDayNight = function (dt) { u(dt); ciuffiAggiorna(); }; }
