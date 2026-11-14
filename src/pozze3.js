// ---------------------------------------------------------------- realismo 3: the pools of light of the lamps and the headlights with no seam (Carlo 14/11: "da lontano vedo i
// cerchi, mi avvicino e spariscono di botto, poi piano entra la luce nuova: non ci sei con le drawing distance")
// Three levels of the same light, each lamp (and each car) handed over from one to the next by its own weight, so their sum is always one:
//  1. real: the few spot lights of luci3.js (6 lamps, 3 cars nearest the camera), on everything, with their own fade in;
//  2. computed: the next 48 lamps and 16 cars, the same spot light worked out in the shaders of the ground, the walls and the covers (the same fall-off, cone,
//     penumbra, colour and intensity as three's SpotLight: no change of shape or strength when a lamp passes to a real light): weight 1 - real, fading out
//     at 330-400 m (cars 130-160 m);
//  3. painted: the old pool on the ground, for each lamp or car only for what is left (1 - real - computed): far away, or past the 48.
// No cut at a fixed distance: each lamp crosses over on its own. &pozzeluce=0 back to before (painted pools fading near the camera)
const POZZE = window.__POZZE = { on: !/[?&]pozzeluce=0/.test(location.search), NL: 48, NC: 16, k: 0,
  fl: { value: Array.from({ length: 48 }, () => new THREE.Vector4()) }, fln: { value: 0 }, flc: { value: new THREE.Color() },
  fcp: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, fcd: { value: Array.from({ length: 16 }, () => new THREE.Vector4()) }, fcn: { value: 0 }, fcc: { value: new THREE.Color() },
  pw: { value: Array.from({ length: 54 }, () => new THREE.Vector4()) }, pwn: { value: 0 }, init: false, _L: [], _A: [], _d: new THREE.Vector3() };
const pzSm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const POZZE_DECL = `
vec3 pzAlb(vec3 a) { float l = max(dot(a, vec3(.2126, .7152, .0722)), 1e-4); return a * min(3., pow(l / .17, .45) * .17 / l); }
uniform vec4 uFL[48]; uniform int uFLN; uniform vec3 uFLC;
uniform vec4 uFCp[16]; uniform vec4 uFCd[16]; uniform int uFCN; uniform vec3 uFCC;
`;
/* three's spot light by hand (lights_pars_begin: getDistanceAttenuation, getSpotAttenuation), world space, Lambert at the game's scale (diffuseColor, no 1/pi: three186.js) */
const POZZE_FRAG = `
  if (uFLN > 0 || uFCN > 0) { vec3 flP = (vec4(geometryPosition, 0.0) * viewMatrix).xyz + cameraPosition, flN = inverseTransformDirection(geometryNormal, viewMatrix), flE = vec3(0.0);
    for (int i = 0; i < 48; i++) { if (i >= uFLN) break; vec4 L = uFL[i]; vec3 lv = L.xyz - flP; float d = length(lv); if (d >= 26.0 || d < 1e-3) continue; vec3 ld = lv / d; float nl = dot(flN, ld); if (nl <= 0.0) continue;
      float at = 1.0 / max(d * d, 0.01) * pow2(saturate(1.0 - pow4(d / 26.0))); flE += uFLC * (L.w * at * smoothstep(0.40849, 0.98516, ld.y) * nl); }
    for (int i = 0; i < 16; i++) { if (i >= uFCN) break; vec4 L = uFCp[i]; vec3 lv = L.xyz - flP; float d = length(lv); if (d >= 55.0 || d < 1e-3) continue; vec3 ld = lv / d; float nl = dot(flN, ld); if (nl <= 0.0) continue;
      float at = 1.0 / max(d * d, 0.01) * pow2(saturate(1.0 - pow4(d / 55.0))); flE += uFCC * (L.w * at * smoothstep(0.87758, 0.97479, dot(-ld, uFCd[i].xyz)) * nl); }
    reflectedLight.directDiffuse += flE * pzAlb(material.diffuseColor); }
`;
/* the lamps and the headlights on a pale ground (Carlo 14/11, piazza Vittorio Veneto: "box di luce", a patch of light with straight edges, and the lamp that hardly lights the
   ground under it): nothing cut the light, it was the ground: the pale paving of a path (albedo 0.32) under a lamp or in the headlights burnt out white, three and a half
   times the asphalt round it (0.09), which stayed dark; the edge of the patch was the edge of the path. As a camera's or the eye's response at night: for the light of the
   lamps and the cars (real spot lights and computed ones alike) the ground answers with its albedo compressed towards a middle grey (power 0.45 round 0.17): the asphalt
   under a lamp 1.4 times lighter, the pale paving 0.7, the same colours. The sun, the sky and the moon as before */
let POZZE_CHUNK = null;
function pozzeChunk() {
  if (POZZE_CHUNK) return POZZE_CHUNK; let c = THREE.ShaderChunk.lights_fragment_begin; const k = '#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )', i0 = c.indexOf(k), i1 = i0 < 0 ? -1 : c.indexOf('#pragma unroll_loop_end', i0);
  if (i0 >= 0 && i1 > i0) { const mid = c.slice(i0, i1); if (mid.includes('material, reflectedLight')) c = c.slice(0, i0) + 'LambertMaterial pzMat = material; pzMat.diffuseColor = pzAlb( material.diffuseColor );\n' + mid.split('material, reflectedLight').join('pzMat, reflectedLight') + c.slice(i1); }
  return POZZE_CHUNK = c;
}
function pozzeMat(m) {
  if (!POZZE.on || !m || m.userData.pozze) return; m.userData.pozze = true;
  const before = m.onBeforeCompile, prev = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (s, r) => { if (before) before.call(m, s, r);
    Object.assign(s.uniforms, { uFL: POZZE.fl, uFLN: POZZE.fln, uFLC: POZZE.flc, uFCp: POZZE.fcp, uFCd: POZZE.fcd, uFCN: POZZE.fcn, uFCC: POZZE.fcc });
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + POZZE_DECL).replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\n' + POZZE_FRAG);
    if (s.fragmentShader.includes('#include <lights_lambert_fragment>') && s.fragmentShader.includes('#include <lights_fragment_begin>')) s.fragmentShader = s.fragmentShader.replace('#include <lights_fragment_begin>', pozzeChunk()); };
  m.customProgramCacheKey = () => prev + '|pozze'; m.needsUpdate = true;
}
if (POZZE.on) {
  for (const k of ['asph', 'asphS', 'paved', 'pavedS', 'deck', 'side', 'piazza', 'piazzaS', 'grass', 'grassS', 'terrain', 'terrainS', 'incolto', 'incoltoS', 'foot', 'footS', 'cortile', 'cortileS', 'aatt', 'aattS', 'kerb', 'mark', 'embank', 'median', 'wall', 'wallPlaster', 'wallOchre', 'old', 'mod', 'plain', 'gravel', 'gravelS'])
    if (MAT[k] && MAT[k].isMeshLambertMaterial) pozzeMat(MAT[k]);
  pozzeMat(CHIUSINI_MAT); pozzeMat(TOPPA_MAT);
  const fl = fondoLook; fondoLook = function (m) { const L = fl(m); if (L) { pozzeMat(L.S); pozzeMat(L.F); } return L; };
}
/* the painted pool of a lamp: as much as is left of it (the cover of its lamp in POZZE.pw, by the centre of its quad: 14 m a side, uv 0..1) */
function pozzeDipinte() {
  const m = LAMPPOOL_MAT, before = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => { if (before) before.call(m, s, r); s.uniforms.uPW = POZZE.pw; s.uniforms.uPWN = POZZE.pwn;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vPzC;').replace('#include <project_vertex>', '#include <project_vertex>\n  vPzC = (modelMatrix * vec4(transformed, 1.0)).xz - (uv - 0.5) * 14.0;');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vPzC;\nuniform vec4 uPW[54];\nuniform int uPWN;')
      .replace('#include <opaque_fragment>', '#include <opaque_fragment>\n  { float cv = 0.0; for (int i = 0; i < 54; i++) { if (i >= uPWN) break; if (distance(uPW[i].xy, vPzC) < 0.5) cv = max(cv, uPW[i].z); } gl_FragColor.a *= 1.0 - clamp(cv, 0.0, 1.0); }'); };
  m.customProgramCacheKey = () => 'pozze-dipinte'; m.needsUpdate = true;
}
function pozzeAggiorna() {
  const Z = POZZE; if (!Z.on) return;
  if (!Z.init) { if (!LUCI.init || !LUCI_ON) return; Z.init = true; LUCI.near.value = -1; pozzeDipinte(); if (LUCI.lamp[0]) Z.flc.value.copy(LUCI.lamp[0].color); if (LUCI.auto[0]) Z.fcc.value.copy(LUCI.auto[0].color); }
  const k = Z.k, cx = camera.position.x, cz = camera.position.z, base = 110 * LUCI.kl * k, baseA = 70 * LUCI.ka * k;
  /* lamps: the real ones and their weight */
  const real = new Map(); for (const s of LUCI.lamp) if (s.intensity > 0 && base > 0) real.set(Math.round(s.position.x * 10) + ',' + Math.round(s.position.z * 10), s.intensity / base);
  const L = Z._L; L.length = 0;
  if (k > 0) for (const T of VIVI) { if (!T.lampL || T.dist > 520) continue; for (const l of T.lampL) { if (l.off) continue; const d = Math.hypot(l.x - cx, l.z - cz); if (d < 400) L.push([d, l]); } }
  L.sort((a, b) => a[0] - b[0]);
  let n = 0, np = 0;
  for (const [d, l] of L) {
    const wr = real.get(Math.round(l.x * 10) + ',' + Math.round(l.z * 10)) || 0;
    let wf = 0; if (n < Z.NL) { wf = (1 - wr) * (1 - pzSm(330, 400, d)); if (wf > 0.002) { Z.fl.value[n].set(l.x, l.y, l.z, base * wf); n++; } else wf = 0; }
    if (np < 54 && wr + wf > 0.002) { Z.pw.value[np].set(l.x, l.z, wr + wf, 0); np++; }
  }
  Z.fln.value = n; Z.pwn.value = np;
  /* cars: the real spots (luci3.js luciPosAuto: from the front, 20 m ahead and down) and the computed ones, the painted pool of each for what is left */
  const realA = new Map(); for (const s of LUCI.auto) if (s.intensity > 0 && s.userData.v && baseA > 0) realA.set(s.userData.v, s.intensity / baseA);
  const A = Z._A; A.length = 0;
  for (const v of VEH) { const ud = v.m && v.m.body && v.m.body.userData; if (!ud || !ud.hp) continue; if (!ud.hp.userData.own) { ud.hp.material = HEADPOOL_MAT.clone(); ud.hp.userData.own = true; } ud.hp.material.opacity = HEADPOOL_MAT.opacity; ud.hp.material.visible = HEADPOOL_MAT.visible;
    if (k > 0 && v !== P.car && v.driver && v.health > 0 && !v.exploded && !v.fallen && !v.heli && !v.spec.pedal && v.m.g.visible) { const d = Math.hypot(v.x - cx, v.z - cz); if (d < 160) A.push([d, v]); } }
  A.sort((a, b) => a[0] - b[0]); let nc = 0;
  for (const [d, v] of A) {
    const wr = realA.get(v) || 0; let wf = 0;
    if (nc < Z.NC) { wf = (1 - wr) * (1 - pzSm(130, 160, d)); if (wf > 0.002) { const fx = Math.sin(v.h), fz = Math.cos(v.h), hl = v.spec.L / 2, px = v.x + fx * hl, py = v.y + 0.75, pz = v.z + fz * hl, dd = Z._d.set(fx * 20, -1.35, fz * 20).normalize();
      Z.fcp.value[nc].set(px, py, pz, baseA * wf); Z.fcd.value[nc].set(dd.x, dd.y, dd.z, 0); nc++; } else wf = 0; }
    const hp = v.m.body.userData.hp; hp.material.opacity = HEADPOOL_MAT.opacity * (1 - clamp(wr + wf, 0, 1));
  }
  Z.fcn.value = nc;
}
{ const la = luciAggiorna; luciAggiorna = function (on) { la(on); POZZE.k = on > 0.02 ? on : 0; }; }
{ const d0 = disegna; disegna = function () { pozzeAggiorna(); d0(); }; }
