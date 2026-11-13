// ---------------------------------------------------------------- realismo 3, fase A: materials with relief and gloss (Carlo 13/11: "sembra ancora un gioco PS1/PS2")
// Every photo of the ground, the plaster and the roofs gets its relief (normal) and its roughness, from the same CC0 set as the colour (Poly Haven) or, where the
// colour photo has no matching set, worked out of the photo itself (the joints of the blocks and setts, the grain): tex/<name>_nr.jpg, src/tex_pbr.py.
// R, G: the normal (OpenGL), B: the roughness against the mean of the material (128 = the mean). The normal is sampled the same way the colour is (the
// stochastic tiling of the asphalt, the blocks of the pavement, the mirrored tiles of grass and setts), so relief and colour stay together. The Lambert lights
// with the bent normal (sun and shade on every block); the reflections of riflessi3.js (sky, sun, lamps on the wet) take the bent normal and the roughness.
// The roofs: the coppi (Poly Haven clay_roof_tiles_02, 2.5 m) laid along the slope of each pitch from the world position (the roofs have no UVs), the colour of
// the house's roof kept (the photo divided by its mean). &pbr=0 turns all of it off
const R3 = { on: !/[?&]pbr=0/.test(location.search), tex: {}, skip: ((/[?&]r3x=([a-z,]+)/.exec(location.search) || [])[1] || '').split(',') }; /* &r3x=marciapiede,asfalto: those without relief (tests) */
const r3Load = (f, srgb) => R3.tex[f] || (R3.tex[f] = (() => { const t = new THREE.TextureLoader().load('tex/' + f + '.jpg'); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; })());
const R3_GLSL = `
vec3 r3Dec(vec4 t) { vec2 xy = t.xy * 2. - 1.; return vec3(xy, sqrt(max(1. - dot(xy, xy), 0.))); }
`;
/* the frame of the texture on the surface, from the screen derivatives (as three's getTangentFrame); not three's normalMap: with it the colour map sampled the relief */
const R3_TBN = `
uniform sampler2D uR3Nm; uniform float uR3K;
mat3 r3Frame(vec3 eye, vec3 N, vec2 uv) { vec3 q0 = dFdx(eye), q1 = dFdy(eye); vec2 st0 = dFdx(uv), st1 = dFdy(uv); vec3 q1p = cross(q1, N), q0p = cross(N, q0);
  vec3 T = q1p * st0.x + q0p * st1.x, B = q1p * st0.y + q0p * st1.y; float det = max(dot(T, T), dot(B, B)), sc = det == 0. ? 0. : inversesqrt(det); return mat3(T * sc, B * sc, N); }
`;
/* the sampling of the relief, as the colour of each kind is sampled (foto3.js, pattern3.js): r3N tangent normal, r3R roughness against the mean */
const R3_SAMPLE = {
  plain: `{ vec4 t = texture2D(uR3Nm, vUv); r3N = r3Dec(t); r3R = t.b * 2.; }`,
  asf: `{ vec2 uv = vUv, dx = dFdx(uv), dy = dFdy(uv), ci = floor(uv), cf = fract(uv), w2 = cf * cf * (3. - 2. * cf); vec3 an = vec3(0.); float ar = 0.;
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(float(k - k / 2 * 2), float(k / 2)), c = ci + o; float w = (o.x > .5 ? w2.x : 1. - w2.x) * (o.y > .5 ? w2.y : 1. - w2.y);
      vec2 r = h22(c + 7.3); float a = r.x * 6.2832, ca = cos(a), sa = sin(a); mat2 R = mat2(ca, sa, -sa, ca);
      vec4 t = textureGrad(uR3Nm, R * (uv - c) + r.yx * 13.7, R * dx, R * dy); vec3 n = r3Dec(t); n.xy = n.xy * R; /* back from the turned sample */
      an += n * w; ar += t.b * w; }
    r3N = normalize(an); r3R = ar * 2.; }`,
  side: `{ vec2 dx = dFdx(vUv), dy = dFdy(vUv); float fw = max(length(dx), length(dy)), a2 = 1. - smoothstep(.008, .03, fw);
    vec2 P = vec2(vUv.x, 1. - vUv.y) * 512.; float r = floor(mod(P.y - 25., 512.) / 25.6), ph = uPh[int(r)], j = floor(mod(P.x - ph, 512.) / 51.2);
    vec2 cen = vec2(ph + 51.2 * (j + .5), 25. + 25.6 * (r + .5)), rel = mod(P - cen + 256., 512.) - 256.;
    vec2 cell = floor(vec2(vUv.x - rel.x / 512., vUv.y + rel.y / 512.)), sd = vec2(r * 13. + j + 1., cell.x * 3.17 + cell.y * 5.31 + 1.7);
    float hd = h21(sd + 31.7), he = h21(sd + 47.3), hf = h21(sd + 63.9), rd = min(floor(hd * 20.), 19.), jd = min(floor(he * 10.), 9.), rot = hf > .5 ? -1. : 1.;
    vec2 cen2 = vec2(uPh[int(rd)] + 51.2 * (jd + .5), 25. + 25.6 * (rd + .5)), P2 = cen2 + rel * rot, uv2 = vec2(P2.x, 512. - P2.y) / 512.;
    vec4 t0 = texture2D(uR3Nm, vUv), t1 = textureGrad(uR3Nm, uv2, dx * rot, dy * rot); vec3 n1 = r3Dec(t1); n1.xy *= rot;
    r3N = normalize(mix(r3Dec(t0), n1, a2)); r3R = mix(t0.b, t1.b, a2) * 2.; }`,
  pat: `{ vec2 dx = dFdx(vUv), dy = dFdy(vUv), c = floor(vUv), f = fract(vUv), h = vec2(h21(c + 1.3), h21(c + 1.3 + 31.7));
    vec2 s = vec2(h.x > .5 ? -1. : 1., h.y > .5 ? -1. : 1.); vec4 t = textureGrad(uR3Nm, f * s + (1. - s) * .5, dx * s, dy * s);
    r3N = r3Dec(t); r3N.xy *= s; r3R = t.b * 2.; }`,
};
const r3Decl = s => { if (!/float r3R = /.test(s.fragmentShader)) s.fragmentShader = s.fragmentShader.replace('void main() {', 'void main() {\n  vec3 r3N = vec3(0., 0., 1.); float r3R = 1.;'); };
/* a ground material: its relief texture (the same repeat as its colour), sampled as the colour is */
function r3Ground(m, f, mode, k = 1) {
  if (!R3.on || !m || m.userData.r3 || R3.skip.includes(f)) return; m.userData.r3 = f;
  const t = r3Load(f + '_nr'); m.userData.r3t = t;
  const sync = () => { if (m.map) { t.repeat.copy(m.map.repeat); t.offset.copy(m.map.offset); } }; sync(); R3.sync = (R3.sync || []).concat(sync); /* the photos set their repeat when they load */
  const before = m.onBeforeCompile, prev = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (s, r) => {
    if (before) before.call(m, s, r);
    r3Decl(s); s.uniforms.uR3Nm = { value: t }; s.uniforms.uR3K = { value: k };
    s.fragmentShader = '#define R3_NRM\n' + s.fragmentShader.replace('#include <common>', '#include <common>\n' + R3_GLSL + R3_TBN + (/float h21\(/.test(s.fragmentShader) ? '' : VAR_GLSL.replace('varying vec3 vWp;', '')) + (mode === 'asf' && !/vec2 h22\(/.test(s.fragmentShader) ? 'vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }\n' : ''))
      .replace('#include <normal_fragment_maps>', R3_SAMPLE[mode] + '\n  { vec3 mapN = r3N; mapN.xy *= uR3K; normal = normalize( r3Frame( - vViewPosition, normal, vUv ) * mapN ); }');
    if (/[?&]r3dbg=1/.test(location.search)) s.fragmentShader = s.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  gl_FragColor = vec4(r3R * .5, normal.z * .5 + .5, fract(vUv.x), 1.);');
  };
  m.customProgramCacheKey = () => prev + '|r3-' + mode; m.needsUpdate = true;
}
/* the photos (foto3.js FOTO_TEX) set the repeat of their textures when they come: the relief follows */
{ const u = updDayNight; let n = 0; updDayNight = function (dt) { u(dt); if (n++ % 30 === 0 && R3.sync) for (const f of R3.sync) f(); }; }
if (R3.on) {
  for (const k of ['asph', 'asphS', 'paved', 'pavedS', 'deck']) r3Ground(MAT[k], 'asfalto', 'asf', 2.5);
  r3Ground(MAT.side, 'marciapiede', 'side', 1.5);
  for (const k of ['piazza', 'piazzaS']) r3Ground(MAT[k], 'porfido', 'pat', 1);
  for (const k of ['grass', 'grassS', 'embank']) r3Ground(MAT[k], 'prato', MAT[k].onBeforeCompile && /pattern/.test(MAT[k].customProgramCacheKey ? MAT[k].customProgramCacheKey() : '') ? 'pat' : 'plain', 1);
  for (const k of ['terrain', 'terrainS']) r3Ground(MAT[k], 'terreno', 'pat', 1);
  if (typeof RO_MAT !== 'undefined') { r3Ground(RO_MAT.ciottoli, 'ciottoli', 'pat', 1); r3Ground(RO_MAT.prato, 'prato', 'pat', 1); }
  if (!/[?&]r3st=0/.test(location.search)) for (const k of ['side', 'piazza', 'piazzaS']) rifMat(MAT[k], 'stone');
  /* the looks of the surfaces by material (world3.js fondoLook), made at their first use */
  const fl = fondoLook; fondoLook = function (m) {
    const L = fl(m); if (L && !L.r3) { L.r3 = true; const f = { g: 'ghiaia', t: 'terra', n: 'pavimento', c: 'ciottoli', b: 'marciapiede' }[m];
      if (f) for (const q of [L.S, L.F]) { r3Ground(q, f, q === MAT.side ? 'side' : m === 'c' ? 'pat' : 'plain', 1); if (m === 'n' || m === 'b' || m === 'c') rifMat(q, 'stone'); } }
    return L;
  };
}
// the plaster of the facades: the relief of the stucco (white_stucco_02, 1.8 m, as the grain of foto3.js), not on the panes and shutters of the drawing; the frame from the wall
const R3_FAC = (s, tile) => {
  r3Decl(s); s.uniforms.uR3Pl = { value: r3Load('intonaco_nr') };
  const facW = /float facF = floor/.test(s.fragmentShader);
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uR3Pl;\n' + R3_GLSL)
    .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { vec3 Nw = normalize(vWNrm); if (abs(Nw.y) < .5) {
      vec2 uvp = vUv * vec2(${tile.toFixed(2)}, 3.1) / 1.8; vec4 t = texture2D(uR3Pl, uvp); vec3 n = r3Dec(t);
      float m = smoothstep(.5, .8, dot(texture2D(map, vUv).rgb, vec3(.3333)));${facW ? ' m = mix(1., m, facW);' : ''} m = clamp(m, 0., 1.) * (1. - smoothstep(30., 90., length(vWPos - cameraPosition)));
      vec3 T = normalize(vec3(Nw.z, 0., -Nw.x)), B = vec3(0., 1., 0.), nw = normalize(mix(Nw, T * n.x + B * n.y + Nw * n.z, m));
      normal = normalize((viewMatrix * vec4(nw, 0.)).xyz); r3R = t.b * 2.; } }`);
};
if (R3.on) for (const [k, m, tile] of [['old', MAT.old, 3.4], ['mod', MAT.mod, 4.2], ['plain', MAT.plain, 4]]) {
  const before = m.onBeforeCompile, prev = m.customProgramCacheKey(); m.onBeforeCompile = (s, r) => { before.call(m, s, r); R3_FAC(s, tile); }; m.customProgramCacheKey = () => prev + '|r3fac'; m.needsUpdate = true;
}
// the roofs: coppi on the pitches (laid along the slope: rows across it, the courses down it), a faint grain of concrete on the flat ones. World position, no UVs
const R3_ROOF = s => {
  r3Decl(s); s.uniforms.uR3T = { value: r3Load('tegole') }; s.uniforms.uR3TN = { value: r3Load('tegole_nr') }; s.uniforms.uR3F = { value: r3Load('pavimento_nr') };
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vR3P;\nvarying vec3 vR3N;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n  vR3P = (modelMatrix * vec4(transformed, 1.0)).xyz; vR3N = normalize(mat3(modelMatrix) * objectNormal);');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform sampler2D uR3T;\nuniform sampler2D uR3TN;\nuniform sampler2D uR3F;\nvarying vec3 vR3P;\nvarying vec3 vR3N;\n' + R3_GLSL)
    .replace('void main() {', 'void main() {\n  vec3 r3W = vec3(0.); float r3K = 0.;')
    .replace('#include <color_fragment>', `#include <color_fragment>
  { vec3 Nw = normalize(vR3N);
    if (Nw.y > .2 && Nw.y < .985) { /* a pitch: u along the eaves, v down the slope (metres along the roof), 2.5 m a repeat */
      vec2 dn = normalize(Nw.xz), ea = vec2(-dn.y, dn.x); vec2 uv = vec2(-dot(vR3P.xz, ea), -dot(vR3P.xz, dn) / Nw.y) / 2.5;
      diffuseColor.rgb *= texture2D(uR3T, uv).rgb * 2.; vec4 t = texture2D(uR3TN, uv); vec3 n = r3Dec(t);
      vec3 T = vec3(-ea.x, 0., -ea.y), B = normalize(cross(Nw, T)); /* where u and v grow: along the eaves, up the slope */ r3W = T * n.x + B * n.y + Nw * n.z; r3K = 1.; r3R = t.b * 2.;
    } else if (Nw.y >= .985) { /* flat: sheath or concrete, a faint grain */
      vec4 t = texture2D(uR3F, vR3P.xz / 3.); vec3 n = r3Dec(t); r3W = normalize(vec3(n.x * .6, n.z, n.y * .6)); r3K = 1.; diffuseColor.rgb *= .94 + .12 * t.b; }
  }`)
    .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n  if (r3K > 0.) normal = normalize((viewMatrix * vec4(r3W, 0.)).xyz);');
};
if (R3.on) { const m = MAT.roof, before = m.onBeforeCompile, prev = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; m.onBeforeCompile = (s, r) => { if (before) before.call(m, s, r); R3_ROOF(s); }; m.customProgramCacheKey = () => prev + '|r3roof'; m.needsUpdate = true; }
// the covers in the asphalt (realismo 3, fase A; Carlo: "i tombini che mancano"), flush with the road, photos of ambientCG (CC0) in one atlas, tex/chiusini.png.
// The data have almost none (Mapillary sees 118 on the whole map, OSM none), so a cautious rule, the same for every town, on the roads of the town (class 1-3, asphalt, on the
// ground, at least 4 m wide): a sewer cover in a lane every 40 m on average, a drain grate at the kerb every 22 m where a pavement runs beside, a double utility cover
// near the edge every 90 m. The place along each piece of road from a hash of its ends, so the same in every build and in both tiles a piece crosses. &tombini=0 turns them off
const CHIUSINI = window.__CH = { on: !/[?&]tombini=0/.test(location.search), n: 0, slot: [[0.78, 0.77], [0.75, 0.75], [0.9, 0.48], [0.6, 0.38]] };
const chiusiniMat = (() => { const t = r3Load('chiusini', true); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.loader = new THREE.TextureLoader().load('tex/chiusini.png', i => { t.image = i.image; t.needsUpdate = true; }); return t; })();
const CHIUSINI_MAT = new THREE.MeshLambertMaterial({ map: chiusiniMat, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
r3Ground(CHIUSINI_MAT, 'chiusini', 'plain', 1); rifMat(CHIUSINI_MAT, 'stone');
function buildChiusini(T, G) {
  if (!CHIUSINI.on) return;
  const x0 = T.cx - TS / 2, z0 = T.cz - TS / 2, x1 = T.cx + TS / 2, z1 = T.cz + TS / 2, seen = new Set(), b = Object.assign(FBuf(), { noclip: true }), cw = COL('#ffffff'), placed = [];
  const put = (x, z, ux, uz, k) => {
    if (x < x0 || x >= x1 || z < z0 || z >= z1 || !onAsph(x, z) || inBuilding(x, z, 0.3) || H.inPit(x, z, 0.5) || placed.some(([px, pz]) => hyp(px - x, pz - z) < 1.5)) return;
    const [W, L] = CHIUSINI.slot[k], nx = -uz, nz = ux, i0 = b.p.length / 3, u0 = k / 4;
    const fu = 0.125 * (W >= L ? 1 : W / L), fv = 0.5 * (L >= W ? 1 : L / W); /* the photo fills its square cell along its longer side */
    for (const [s, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vtx(b, x + ux * s * W / 2 + nx * v * L / 2, 0.02, z + uz * s * W / 2 + nz * v * L / 2, 0, 1, 0, u0 + 0.125 + s * fu, 0.5 + v * fv, cw);
    b.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); placed.push([x, z]); CHIUSINI.n++;
  };
  ROADSEG.each(x0 - 2, z0 - 2, x1 + 2, z1 + 2, s => {
    const r = s.r; if (seen.has(s) || r.c < 1 || r.c > 3 || r.d || (r.m && r.m !== 'a') || r.w < 4 || !atGrade(s)) return; seen.add(s);
    const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L = hyp(ex, ez); if (L < 1) return; const ux = ex / L, uz = ez / L, nx = -uz, nz = ux;
    const h = k => hashRnd(s.a[0] * 0.731 + s.a[1] * 1.37 + s.b[0] * 2.11 + s.b[1] * 0.53 + k * 17.3);
    const along = (step, k, f) => { for (let d = h(k) * step; d < L; d += step * (0.7 + 0.6 * h(k + d))) f(s.a[0] + ux * d, s.a[1] + uz * d, d); };
    along(40, 1, (x, z, d) => { const lane = [0, -1, 1][Math.floor(h(d + 3) * 3)] * r.w / 4, a = h(d + 5) * TAU; put(x + nx * lane, z + nz * lane, Math.cos(a), Math.sin(a), h(d + 7) < 0.55 ? 0 : 1); });
    for (const sd of [-1, 1]) along(22, 10 + sd, (x, z) => { const o = sd * (r.w / 2 - 0.3), ox = sd * (r.w / 2 + 1.2); if (onSide(x + nx * ox, z + nz * ox)) put(x + nx * o, z + nz * o, ux, uz, 3); });
    along(90, 20, (x, z, d) => { const sd = h(d + 9) < 0.5 ? -1 : 1, o = sd * (r.w / 2 - 0.8); put(x + nx * o, z + nz * o, ux, uz, 2); });
  });
  if (b.i.length) mkMesh(b, CHIUSINI_MAT, 6, false, G);
}
