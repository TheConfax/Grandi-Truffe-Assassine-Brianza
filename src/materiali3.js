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
// the covers in the asphalt (realismo 3; Carlo 13/11: "i tombini che mancano", then "sembrano messi a caso, la fila non segue mai la strada"), flush with the road,
// photos of ambientCG (CC0) in one atlas, tex/chiusini.png (src/tex_pbr.py). The same rule for every town, on the roads of the town (class 1-3, asphalt, on the ground,
// at least 4 m wide), along the true axis of each road (its whole line, curve by curve, by the length along it):
//  - the sewer: a big round cast-iron cover in the middle of one lane, between the wheel tracks, always the same lane along a road, every 30-50 m, and one in
//    the middle of every junction; a square patch of paler asphalt round it; now and then a slotted grate beside it;
//  - the drain grates: always at the edges, by the kerb: every 20-25 m, one at each corner of a junction, one before every zebra crossing, one in every low point
//    of the road (from its heights); along the edge of the car parks too;
//  - utilities: small round covers and square diamond plates near the edge, here and there;
//  - where Mapillary saw a cover (data/mapillary_grande, object--manhole, object--catch-basin: T.d.mh) it goes there, put on its lane or its kerb, in place of the rule
//    nearby. No writing, no painted crosses. &tombini=0 turns them off
const CHIUSINI = window.__CH = { on: !/[?&]tombini=0/.test(location.search), n: 0, fogna: 0, caditoie: 0, servizi: 0, mapillary: 0,
  slot: [[0.68, 0.67], [0.46, 0.46], [0.55, 0.36], [0.45, 0.45], [1.25, 1.25]] }; /* metres: sewer, small round, grate, diamond square, patch */
const chiusiniMat = (() => { const t = new THREE.TextureLoader().load('tex/chiusini.png'); t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy()); return t; })();
const CHIUSINI_MAT = new THREE.MeshLambertMaterial({ map: chiusiniMat, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 });
const TOPPA_MAT = new THREE.MeshLambertMaterial({ map: chiusiniMat, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 }); /* the patch under the cover */
r3Ground(CHIUSINI_MAT, 'chiusini', 'plain', 1); rifMat(CHIUSINI_MAT, 'stone'); rifMat(TOPPA_MAT, 'asphalt');
const CH_NS = 5;
/* the line of a road: its nodes and the length along it at each (once per road) */
const chLinea = r => r._cl || (r._cl = (() => { const P = r.g.map(i => N[i]), S = [0]; for (let k = 1; k < P.length; k++) S.push(S[k - 1] + hyp(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1])); return { P, S, L: S[S.length - 1] }; })());
const chAt = (cl, d) => { const { P, S } = cl; let k = 1; while (k < P.length - 1 && S[k] < d) k++; const l = S[k] - S[k - 1] || 1, f = clamp((d - S[k - 1]) / l, 0, 1), ux = (P[k][0] - P[k - 1][0]) / l, uz = (P[k][1] - P[k - 1][1]) / l; return [P[k - 1][0] + (P[k][0] - P[k - 1][0]) * f, P[k - 1][1] + (P[k][1] - P[k - 1][1]) * f, ux, uz]; };
const chHash = (r, k) => hashRnd((r.g[0] * 0.731 + r.g[r.g.length - 1] * 1.37) % 9973 + k * 17.3);
/* how far the asphalt goes from a point of the axis along (nx, nz): the drawn carriageway (the DBGT's) is often wider than the road's width, and off its axis */
const chBordo = (x, z, nx, nz, max) => { let d = 0.25; while (d < max && onAsph(x + nx * d, z + nz * d)) d += 0.25; return d - 0.25; };
const chRoadOk = r => r.c >= 1 && r.c <= 3 && !r.d && !(r.m && r.m !== 'a') && r.w >= 4;
function buildChiusini(T, G) {
  if (!CHIUSINI.on) return;
  const x0 = T.cx - TS / 2, z0 = T.cz - TS / 2, x1 = T.cx + TS / 2, z1 = T.cz + TS / 2, b = Object.assign(FBuf(), { noclip: true }), bt = Object.assign(FBuf(), { noclip: true }), cw = COL('#ffffff'), placed = [];
  const inT = (x, z) => x >= x0 && x < x1 && z >= z0 && z < z1;
  const quad = (B, x, z, ux, uz, k, y) => { const [W, L] = CHIUSINI.slot[k], nx = -uz, nz = ux, i0 = B.p.length / 3, u0 = k / CH_NS, fu = 0.5 / CH_NS * (W >= L ? 1 : W / L), fv = 0.5 * (L >= W ? 1 : L / W);
    for (const [s, v] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) vtx(B, x + ux * s * W / 2 + nx * v * L / 2, y, z + uz * s * W / 2 + nz * v * L / 2, 0, 1, 0, u0 + 0.5 / CH_NS + s * fu, 0.5 + v * fv, cw);
    B.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); };
  const put = (x, z, ux, uz, k, sep = 1.2, kind = 'servizi', grp = kind) => { /* sep: the least distance from another of the same group (sewer, grates, utilities), 1 m from any */
    if (!inT(x, z) || !onAsph(x, z) || inBuilding(x, z, 0.3) || H.inPit(x, z, 0.5) || placed.some(([px, pz, s, g]) => hyp(px - x, pz - z) < (g === grp ? Math.max(s, sep) : 1.0))) return false;
    if (k === 0) { if (!onAsph(x + 0.6, z) || !onAsph(x - 0.6, z) || !onAsph(x, z + 0.6) || !onAsph(x, z - 0.6)) return false; quad(bt, x, z, ux, uz, 4, 0.015); } /* the patch, square to the road */
    quad(b, x, z, k === 0 || k === 1 ? Math.cos(trHash(x, z) * TAU) : ux, k === 0 || k === 1 ? Math.sin(trHash(x, z) * TAU) : uz, k, 0.025); placed.push([x, z, sep, grp]); CHIUSINI.n++; CHIUSINI[kind]++; return true;
  };
  /* the ones Mapillary saw: first, each on its lane or at its kerb, and the rule keeps away from them */
  const vere = [];
  for (const [X, Z, k] of T.d.mh || []) {
    const x = X / 10, z = Z / 10; let best = null, bd = 12;
    ROADSEG.each(x - 12, z - 12, x + 12, z + 12, s => { if (!chRoadOk(s.r) || !atGrade(s)) return; const d = segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) - s.r.w / 2; if (d < bd) { bd = d; best = s; } });
    if (!best) continue;
    const ex = best.b[0] - best.a[0], ez = best.b[1] - best.a[1], L = hyp(ex, ez) || 1, ux = ex / L, uz = ez / L, t = clamp(((x - best.a[0]) * ex + (z - best.a[1]) * ez) / (L * L), 0, 1), cx = best.a[0] + ex * t, cz = best.a[1] + ez * t;
    const sd = (x - cx) * -uz + (z - cz) * ux >= 0 ? 1 : -1, off = k === 0 ? sd * (best.r.lane || best.r.w / 4) : sd * (best.r.w / 2 - 0.35);
    vere.push([cx - uz * off, cz + ux * off, ux, uz, k]);
  }
  for (const [x, z, ux, uz, k] of vere) put(x, z, ux, uz, k === 0 ? 0 : 2, k === 0 ? 20 : 8, 'mapillary', k === 0 ? 'fogna' : 'caditoie');
  /* the roads crossing the tile: each once, along its whole line */
  const roads = new Set(); ROADSEG.each(x0 - 2, z0 - 2, x1 + 2, z1 + 2, s => { if (chRoadOk(s.r) && atGrade(s)) roads.add(s.r); });
  for (const r of roads) {
    const cl = chLinea(r); if (cl.L < 8) continue;
    const side = 1, lane = r.lane > 0 ? r.lane : 0, kerb = r.w / 2 - 0.35; /* the sewer in the right lane of the road's own direction (a one-way: its middle) */
    /* the sewer, every 30-50 m from a phase of its own */
    for (let d = 8 + chHash(r, 1) * 25, k = 0; d < cl.L - 4; d += 30 + 20 * chHash(r, k + 2), k++) {
      const [x, z, ux, uz] = chAt(cl, d), nx = -uz, nz = ux, ep = chBordo(x, z, nx, nz, r.w / 2 + 6), em = chBordo(x, z, -nx, -nz, r.w / 2 + 6), mid = (ep - em) / 2, hw = (ep + em) / 2; /* the middle and the half width of the asphalt here */
      const lo = lane > 0 ? mid + side * hw / 2 : mid, px = x + nx * lo, pz = z + nz * lo; /* a two-way road: the middle of the right lane, between the wheel tracks; a one-way: its middle */
      if (!inT(px, pz) || nearJunction(px, pz, 8)) continue;
      if (put(px, pz, ux, uz, 0, 12, 'fogna') && chHash(r, k + 50) < 0.3) put(px + ux * 1.3 + nx * 0.6 * side, pz + uz * 1.3 + nz * 0.6 * side, ux, uz, 2, 1.0, 'fogna', 'griglia'); /* a grate beside it */
    }
    /* drain grates at both kerbs: every 20-25 m, and in the low points of the road (heights every 4 m) */
    const lows = []; { let prev = null, pprev = null; for (let d = 2; d < cl.L - 2; d += 4) { const [x, z] = chAt(cl, d), y = H.surface(x, z); if (prev && pprev && prev[1] < pprev[1] - 0.02 && prev[1] < y - 0.02) lows.push(prev[0]); pprev = prev; prev = [d, y]; } }
    for (const sd of [-1, 1]) {
      const at = d => { const [x, z, ux, uz] = chAt(cl, d), e = chBordo(x, z, -uz * sd, ux * sd, r.w / 2 + 6), o = Math.max(0.3, e - 0.33); return [x - uz * o * sd, z + ux * o * sd, ux, uz]; }; /* at the kerb: the edge of the asphalt, 33 cm in */
      for (let d = 4 + chHash(r, 10 + sd) * 18, k = 0; d < cl.L - 3; d += 20 + 5 * chHash(r, k + 20 + sd), k++) { const [x, z, ux, uz] = at(d); if (!nearJunction(x, z, 6)) put(x, z, ux, uz, 2, 4, 'caditoie'); }
      for (const d of lows) { const [x, z, ux, uz] = at(d); put(x, z, ux, uz, 2, 3, 'caditoie'); }
      /* the corners of the junctions at the ends: one at 5 m from the node */
      for (const [d, i] of [[5, r.g[0]], [cl.L - 5, r.g[r.g.length - 1]]]) if (NODE_DEG[i] >= 3 && cl.L > 12) { const [x, z, ux, uz] = at(d); put(x, z, ux, uz, 2, 2.5, 'caditoie'); }
    }
    /* utilities near the edge, here and there */
    for (let d = 15 + chHash(r, 30) * 40, k = 0; d < cl.L - 5; d += 45 + 40 * chHash(r, k + 31), k++) { const sd = chHash(r, k + 40) < 0.5 ? -1 : 1, [x, z, ux, uz] = chAt(cl, d), o = Math.max(0.3, chBordo(x, z, -uz * sd, ux * sd, r.w / 2 + 6) - 0.75) * sd; put(x - uz * o, z + ux * o, ux, uz, chHash(r, k + 45) < 0.5 ? 1 : 3, 3, 'servizi'); }
  }
  /* the sewer in the middle of the junctions */
  NODEG.each(x0, z0, x1, z1, ({ i }) => { if (NODE_DEG[i] < 3) return; const [x, z] = N[i]; let ok = false, ux = 1, uz = 0; ROADSEG.each(x - 1, z - 1, x + 1, z + 1, s => { if (!ok && chRoadOk(s.r) && atGrade(s) && (s.ia === i || s.ib === i)) { ok = true; const l = hyp(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1; ux = (s.b[0] - s.a[0]) / l; uz = (s.b[1] - s.a[1]) / l; } }); if (ok) put(x, z, ux, uz, 0, 10, 'fogna'); });
  /* before the zebra crossings: a grate at each kerb, 2.5 m before it on either side */
  for (const [X, Z, dx, dz, w] of T.d.cr || []) { const cx = X / 10, cz = Z / 10, l = hyp(dx, dz) || 1, ux = dx / l, uz = dz / l, nx = -uz, nz = ux;
    for (const sd of [-1, 1]) for (const e of [-1, 1]) put(cx + ux * 2.6 * e + nx * (w / 2 - 0.35) * sd, cz + uz * 2.6 * e + nz * (w / 2 - 0.35) * sd, ux, uz, 2, 2, 'caditoie'); }
  /* the edges of the car parks: a grate every 25 m along the edge, 0.4 m in */
  for (const a of T.d.a || []) { if (a.t !== 4) continue; const o = dec(a.p); for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length], L = hyp(q[0] - p[0], q[1] - p[1]); if (L < 6) continue; const ux = (q[0] - p[0]) / L, uz = (q[1] - p[1]) / L;
      for (let d = 6 + trHash(p[0], p[1]) * 10; d < L - 3; d += 25) { let x = p[0] + ux * d - uz * 0.4, z = p[1] + uz * d + ux * 0.4; if (!inPoly(x, z, o)) { x = p[0] + ux * d + uz * 0.4; z = p[1] + uz * d - ux * 0.4; } put(x, z, ux, uz, 2, 4, 'caditoie'); } } }
  if (bt.i.length) mkMesh(bt, TOPPA_MAT, 6, false, G);
  if (b.i.length) mkMesh(b, CHIUSINI_MAT, 6, false, G);
}
