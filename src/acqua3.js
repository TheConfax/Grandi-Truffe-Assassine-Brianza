// ---------------------------------------------------------------- water that looks like water (Carlo, 3/11): pools, rivers, streams, ponds
// One material for all: clear where it is shallow (the bottom shows), darker and more opaque where it is deep, the sky mirrored by the angle you look at it
// (Fresnel), the sun as a glint, gentle ripples; a river carries them downstream. The depth and the direction of the current come with each vertex in the uv:
// uv.x = depth of the water under that point (m), uv.y = direction of the current (rad, along x = 0, towards +z = pi/2), 99 = still water.
// The pools (64, OSM and DBGT outlines) are real basins: the ground inside the outline is not drawn (the stencil, see ACQ_BUCO), the basin has its own walls and
// floor in tiles, the water 18 cm under the coping, the ladders go down into it, and H.ground / H.surface answer with the floor, so on foot you fall in.
const ACQ = {
  U: { uTime: { value: 0 }, uSky: { value: new THREE.Color(0x5e8fd0) }, uHor: { value: new THREE.Color(0xa9c3e0) }, uSunC: { value: new THREE.Color(0xffdcae) }, uSunD: { value: SUN_DIR.clone() }, uLit: { value: 1 } },
  frame: -1,
};
const ACQ_VS = `varying vec3 vW; varying vec2 vU;
#include <fog_pars_vertex>
void main() { vec4 wp = modelMatrix * vec4(position, 1.0); vW = wp.xyz; vU = uv; vec4 mvPosition = viewMatrix * wp; gl_Position = projectionMatrix * mvPosition;
#include <fog_vertex>
}`;
const ACQ_FS = `uniform float uTime, uAbs, uRip, uFlow, uLit, uMin; uniform vec3 uSky, uHor, uSunC, uSunD, uTint; varying vec3 vW; varying vec2 vU;
#include <fog_pars_fragment>
vec2 wave(vec2 q, vec2 d, float f, float sp, float a, float ph) { return d * f * a * cos(dot(q, d) * f + ph + uTime * sp); }
/* no lattice of glints (Carlo, 6/11): six waves of unrelated length and direction on a coordinate warped by a slow noise, the strength of the ripples changes from place to place (calm and busy patches, 5-20 m), the short waves fade with the distance */
float wh21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float wvn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(wh21(i), wh21(i + vec2(1, 0)), f.x), mix(wh21(i + vec2(0, 1)), wh21(i + vec2(1, 1)), f.x), f.y); }
void main() {
  float flowing = step(vU.y, 10.0); vec2 fl = vec2(cos(vU.y), sin(vU.y)) * uFlow * flowing;
  vec2 q = vW.xz - fl * uTime;
  float dist = length(cameraPosition - vW); float hf = 1.0 - smoothstep(25.0, 110.0, dist);
  vec2 qw = q + (vec2(wvn(q / 9.0 + uTime * 0.03), wvn(q / 9.0 + 17.0 - uTime * 0.02)) - 0.5) * 6.0;
  float am = 0.25 + 1.5 * smoothstep(0.25, 0.75, wvn(qw / 7.0 + 3.1 + uTime * 0.04)); am *= 0.6 + 0.8 * wvn(qw / 21.0 + 9.7);
  vec2 g = wave(qw, normalize(vec2(1.0, 0.45)), 1.9, 0.9, 0.06, 0.0) + wave(qw, normalize(vec2(-0.62, 1.0)), 2.9, 1.3, 0.045, 1.7) + wave(qw, normalize(vec2(0.83, -0.91)), 4.3, 1.7, 0.03, 4.1)
    + hf * (wave(qw, normalize(vec2(-1.0, -0.27)), 6.7, 2.2, 0.017, 2.3) + wave(qw, normalize(vec2(0.31, 1.0)), 9.7, 2.8, 0.011, 5.2) + wave(qw, normalize(vec2(-0.9, 0.7)), 14.1, 3.4, 0.0065, 0.9));
  g *= am;
  g += (vec2(wvn(qw * 1.3 + 40.0 + uTime * 0.2) - wvn(qw * 1.3 + 40.4 + uTime * 0.2), wvn(qw * 1.3 + 71.0 - uTime * 0.2) - wvn(qw * 1.3 + 71.4 - uTime * 0.2))) * 0.55 * hf;
  vec3 N = normalize(vec3(-g.x * uRip, 1.0, -g.y * uRip));
  vec3 V = normalize(cameraPosition - vW); float ndv = max(dot(N, V), 0.0);
  float fres = 0.025 + 0.975 * pow(1.0 - ndv, 5.0);
  vec3 R = reflect(-V, N); R.y = abs(R.y);
  vec3 sky = mix(uHor, uSky, pow(clamp(R.y, 0.0, 1.0), 0.45));
  float spec = pow(max(dot(R, normalize(uSunD)), 0.0), 220.0) * 2.2;
  float dep = max(vU.x, 0.0); float a = 1.0 - exp(-dep * uAbs); a = max(a, uMin) * smoothstep(0.0, 0.06, dep + 0.02);
  vec3 body = uTint * uLit;
  vec3 col = mix(body, sky * (0.55 + 0.45 * uLit), fres) + uSunC * spec * uLit;
  gl_FragColor = vec4(col, clamp(a + (1.0 - a) * fres + spec * 0.6, 0.0, 1.0));
#include <fog_fragment>
}`;
function acquaMat(tint, abs, rip, flow, minA) {
  return new THREE.ShaderMaterial({
    vertexShader: ACQ_VS, fragmentShader: ACQ_FS, transparent: true, depthWrite: false, fog: true, side: THREE.DoubleSide,
    uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, ACQ.U, { uAbs: { value: abs }, uRip: { value: rip }, uFlow: { value: flow }, uMin: { value: minA }, uTint: { value: new THREE.Color(tint) } }]),
  });
}
// the uniforms are shared (merge clones them): the shared object is the one we write, the materials copy it at each frame
const ACQ_MATS = [];
function acquaMatReg(...a) { const m = acquaMat(...a); ACQ_MATS.push(m); return m; }
const ACQ_POOL = acquaMatReg('#46c1de', 0.34, 0.35, 0, 0.06), ACQ_RIVER = acquaMatReg('#3f7d8f', 2.4, 0.7, 0.45, 0.3), ACQ_LAKE = acquaMatReg('#4f9a98', 0.8, 0.45, 0, 0.25);
function acquaAgg(frame, day) { // each frame, from the first water that is drawn: the sky, the sun and the time
  if (ACQ.frame === frame) return; ACQ.frame = frame; const t = performance.now() / 1000;
  const sky = ACQ.U.uSky.value, hor = ACQ.U.uHor.value; hor.copy(scene.fog.color); sky.copy(hemi.color).multiplyScalar(0.8);
  for (const m of ACQ_MATS) { const u = m.uniforms; u.uTime.value = t; u.uLit.value = 0.3 + 0.7 * Math.min(1, hemi.intensity / 0.78); u.uSky.value.copy(sky); u.uHor.value.copy(hor); u.uSunC.value.copy(sun.color); u.uSunD.value.copy(SUN_DIR); }
}
function acquaDraw(m) { m.onBeforeRender = (r) => acquaAgg(r.info.render.frame); m.frustumCulled = true; return m; }

Object.assign(ACQ_RIVER, { polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -4 }); /* the sheet meets the banks of S, which write their depth */
// the direction of the current at a point: that of the nearest axis of an OSM river (they are drawn downstream) within 40 m, else 99 (no current)
function riverFlow(segs, x, z) {
  let best = 1600, ang = 99;
  for (const s of segs) { const dx = s[2] - s[0], dz = s[3] - s[1], l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - s[0]) * dx + (z - s[1]) * dz) / l2)), ex = x - s[0] - dx * t, ez = z - s[1] - dz * t, d = ex * ex + ez * ez; if (d < best) { best = d; ang = Math.atan2(dz, dx); } }
  return ang;
}
// ---- the ground does not draw where a pool is: a mask in the stencil, laid first; the ground materials (the whole MAT) do not draw where the mask is
const ACQ_BUCO = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false, depthTest: false, stencilWrite: true, stencilFunc: THREE.AlwaysStencilFunc, stencilRef: 1, stencilZPass: THREE.ReplaceStencilOp, stencilFail: THREE.ReplaceStencilOp, stencilZFail: THREE.ReplaceStencilOp, side: THREE.DoubleSide });
function acquaSuoloMasch(m) { Object.assign(m, { stencilWrite: true, stencilFunc: THREE.NotEqualStencilFunc, stencilRef: 1, stencilFail: THREE.KeepStencilOp, stencilZFail: THREE.KeepStencilOp, stencilZPass: THREE.KeepStencilOp }); }
const ACQ_SKIP = new Set(['crown', 'trunk', 'net', 'railing', 'hedge', 'lamp', 'lampHead', 'old', 'mod', 'plain', 'roof', 'canopy', 'wall', 'post', 'steel', 'rail']);
function acquaMascheraSuolo() { for (const k in MAT) if (!ACQ_SKIP.has(k) && MAT[k] && MAT[k].isMaterial) acquaSuoloMasch(MAT[k]); }
acquaMascheraSuolo();

// ---- tile of the basin: a light blue ceramic, 1 m a repeat (4 x 4 tiles)
const ACQ_TILE_TEX = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#d4ecf1'; g.fillRect(0, 0, w, h);
  for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) { const v = 0.94 + ((i * 7 + j * 13) % 5) * 0.015; g.fillStyle = `rgb(${Math.round(150 * v)},${Math.round(212 * v)},${Math.round(228 * v)})`; g.fillRect(i * 32 + 2, j * 32 + 2, 28, 28); }
});
const ACQ_TILE = new THREE.MeshLambertMaterial({ map: ACQ_TILE_TEX, side: THREE.DoubleSide }), ACQ_COPING = new THREE.MeshLambertMaterial({ color: 0xe9e4d6, side: THREE.DoubleSide });
const ACQ_LINE = new THREE.MeshLambertMaterial({ color: 0x1f5f8a, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });

// ---- the registry of the basins, for what walks and drives
const POOLS = new Map(), POOL_CELL = new Map(), POOL_CS = 8;
function poolCells(bb, f) { for (let i = Math.floor(bb[0] / POOL_CS); i <= Math.floor(bb[2] / POOL_CS); i++) for (let j = Math.floor(bb[1] / POOL_CS); j <= Math.floor(bb[3] / POOL_CS); j++) f(i * 100003 + j); }
function poolAdd(key, p) {
  poolDel(key); POOLS.set(key, p); poolCells(p.bb, k => { let a = POOL_CELL.get(k); if (!a) POOL_CELL.set(k, a = []); a.push(p); });
}
function poolDel(key) { const p = POOLS.get(key); if (!p) return; POOLS.delete(key); poolCells(p.bb, k => { const a = POOL_CELL.get(k); if (a) { const i = a.indexOf(p); if (i >= 0) a.splice(i, 1); if (!a.length) POOL_CELL.delete(k); } }); }
function poolsFree(T) { if (T.poolKeys) { for (const k of T.poolKeys) poolDel(k); T.poolKeys = null; } }
function poolAt(x, z) { const a = POOL_CELL.get(Math.floor(x / POOL_CS) * 100003 + Math.floor(z / POOL_CS)); if (!a) return null; for (const p of a) if (x >= p.bb[0] && x <= p.bb[2] && z >= p.bb[1] && z <= p.bb[3] && inPoly(x, z, p.O)) return p; return null; }
// the height of the ground inside a pool: the floor in the basin (and the submerged steps of the ladders), the coping round it
function poolGround(p, x, z) {
  if (p.lake) return p.floor(x, z);
  if (!inPoly(x, z, p.W)) return p.rim;
  let y = p.floor(x, z);
  for (const s of p.stairs) { const a = (x - s.x) * s.ux + (z - s.z) * s.uz, b = (x - s.x) * s.nx + (z - s.z) * s.nz; if (Math.abs(a) < s.hw && b > -0.05 && b < s.n * s.td) { const j = Math.min(s.n - 1, Math.max(0, Math.floor(b / s.td))), top = p.rim - 0.3 - j * s.rise; if (top > y) y = top; } }
  return y;
}
const H_GROUND_RAW = (x, z) => H_GROUND_RAW.f.call(H, x, z); H_GROUND_RAW.f = H.ground; /* the ground as it is without the basins */
{
  const hg = H.ground, hs = H.surface;
  H.ground = function (x, z) { if (POOLS.size) { const p = poolAt(x, z); if (p) return poolGround(p, x, z); } return hg.call(H, x, z); };
  H.surface = function (x, z, cy) { if (POOLS.size) { const p = poolAt(x, z); if (p && (cy === undefined || cy < p.rim + 1.5)) return poolGround(p, x, z); } return hs.call(H, x, z, cy); };
}
// WHERE THE PLAYER IS IN WATER AND HOW DEEP (swimming is decided by Carlo, not done yet): this is the one place that says it.
// Returns null out of the water, else { y: height of the water surface, depth: how far the water stands over the feet at (x, z), fondo: the ground under it, kind: 'piscina' | 'fiume' }
function acquaIn(x, z, feetY) {
  const p = POOLS.size ? poolAt(x, z) : null;
  if (p) { if (!inPoly(x, z, p.W)) return null; const g = poolGround(p, x, z), d = p.water - g; return d > 0 ? { y: p.water, depth: d, fondo: g, kind: p.lake ? 'lago' : 'piscina' } : null; }
  if (!H.fineAt(x, z)) return null; const w = H.water(x, z); if (w === null) return null; const g = H.base(x, z); return w > g ? { y: w, depth: w - g, fondo: g, kind: 'fiume' } : null;
}

// ---- building a pool (called by lsPool, paesaggio3.js) ----
const AQ_B = () => ({ p: [], n: [], uv: [], c: [], i: [] });
function acquaTile() { return { hole: AQ_B(), floor: AQ_B(), lane: AQ_B(), cop: AQ_B(), water: AQ_B(), bed: AQ_B(), lake: AQ_B(), n: 0 }; }
function aqQuad(b, P0, P1, P2, P3, n, uv) { // four points (counter-clockwise or not) facing the normal n
  const q = b.p.length / 3; for (let k = 0; k < 4; k++) { const P = [P0, P1, P2, P3][k]; b.p.push(P[0], P[1], P[2]); b.n.push(n[0], n[1], n[2]); b.uv.push(uv[k][0], uv[k][1]); }
  const ux = P1[0] - P0[0], uy = P1[1] - P0[1], uz = P1[2] - P0[2], vx = P3[0] - P0[0], vy = P3[1] - P0[1], vz = P3[2] - P0[2];
  const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
  if (cx * n[0] + cy * n[1] + cz * n[2] >= 0) b.i.push(q, q + 1, q + 2, q, q + 2, q + 3); else b.i.push(q, q + 2, q + 1, q, q + 3, q + 2);
}
function aqPoly(b, R, yOf, uvOf, n) { // a flat or sloping polygon: triangulated on its outline, the height from yOf(x, z)
  const faces = THREE.ShapeUtils.triangulateShape(R.map(v => new THREE.Vector2(v[0], v[1])), []), base = b.p.length / 3;
  for (const v of R) { b.p.push(v[0], yOf(v[0], v[1]), v[1]); b.n.push(n[0], n[1], n[2]); const u = uvOf(v[0], v[1]); b.uv.push(u[0], u[1]); }
  for (const f of faces) b.i.push(base + f[0], base + f[1], base + f[2]);
}
function aqMiter(P, d) { // the outline moved inwards by d (outwards if d < 0), at the corners: for the simple convex outlines (a rectangle stays a rectangle)
  const sg = sArea(P) < 0 ? -1 : 1, n = P.length;
  return P.map((p, i) => { const a = P[(i + n - 1) % n], c = P[(i + 1) % n], l1 = hyp(p[0] - a[0], p[1] - a[1]) || 1, l2 = hyp(c[0] - p[0], c[1] - p[1]) || 1, n1 = [-(p[1] - a[1]) / l1 * sg, (p[0] - a[0]) / l1 * sg], n2 = [-(c[1] - p[1]) / l2 * sg, (c[0] - p[0]) / l2 * sg], k = d / Math.max(0.3, 1 + n1[0] * n2[0] + n1[1] * n2[1]); return [p[0] + (n1[0] + n2[0]) * k, p[1] + (n1[1] + n2[1]) * k]; });
}
function piscina(P, A, T, TL, solid) {
  const area = Math.abs(sArea(P)); if (area < 4) return false;
  const rect = P.length <= 6 && isConvex(P); let W = rect ? aqMiter(P, 0.3) : lsInset(P, 0.3), O = rect ? aqMiter(P, -0.45) : lsInset(P, -0.45);
  if (!W || !O || W.length !== O.length) { W = aqMiter(P, 0.3); O = aqMiter(P, -0.45); }
  const n = W.length, g0 = hyp, gr = H_GROUND_RAW; // (the registry is not in the way of its own ground: the pool is not registered yet)
  let rim = -1e9, lo = 1e9; for (const q of O) { const y = gr(q[0], q[1]); rim = Math.max(rim, y); lo = Math.min(lo, y); } for (const q of P) rim = Math.max(rim, gr(q[0], q[1]));
  rim += 0.1; if (rim - lo > 0.9) return false; /* a pool on a steep slope: left as the ground it is, not a basin with a wall metres high */
  const water = rim - 0.18, L = A.s1 - A.s0, big = L >= 6 && area > 30, hash = LS_HASH(A.cx, A.cz, 'vasca');
  const dMin = big ? 1.15 : 0.95, dMax = big ? 1.95 : 0.95, dir = hash < 0.5 ? 1 : -1; /* deeper at one end: the basin is 1.15 m at the shallow end, 1.95 at the deep one */
  const dAt = (x, z) => { const s = ((x - A.cx) * A.ux + (z - A.cz) * A.uz - A.s0) / (L || 1); const t = Math.min(1, Math.max(0, dir > 0 ? s : 1 - s)); return dMin + (dMax - dMin) * t; }; /* depth under the coping */
  const floor = (x, z) => rim - dAt(x, z), bb = [1e9, 1e9, -1e9, -1e9]; for (const q of O) { bb[0] = Math.min(bb[0], q[0]); bb[1] = Math.min(bb[1], q[1]); bb[2] = Math.max(bb[2], q[0]); bb[3] = Math.max(bb[3], q[1]); }
  // ladders: steps going down into the water, at the middle of an edge (two on a rectangle, on the opposite long sides); the steps are what you walk up
  const stairs = [], np = P.length, pick = rect ? [0, 2] : [0];
  for (const e of pick) {
    const a = P[e % np], c = P[(e + 1) % np], L1 = hyp(c[0] - a[0], c[1] - a[1]); if (L1 < 1.6) continue; const ux = (c[0] - a[0]) / L1, uz = (c[1] - a[1]) / L1, sg = sArea(P) < 0 ? -1 : 1, nx = -uz * sg, nz = ux * sg; /* nx, nz: inwards */
    const mx = (a[0] + c[0]) / 2 + nx * 0.3, mz = (a[1] + c[1]) / 2 + nz * 0.3, dd = dAt(mx, mz), rise = 0.38, k = Math.max(2, Math.min(6, Math.ceil((dd - 0.72) / rise) + 1)); /* the last step is at most 42 cm over the floor: what a walker climbs (SALTO.stepUp 0.45) */
    if (!inPoly(mx + nx * 0.4, mz + nz * 0.4, W)) continue; stairs.push({ x: mx, z: mz, ux, uz, nx, nz, hw: 0.5, n: k, td: 0.3, rise });
  }
  const pool = { W, O, bb, rim, water, floor, stairs };
  const key = A.cx.toFixed(1) + ',' + A.cz.toFixed(1); (T.poolKeys || (T.poolKeys = [])).push(key); poolAdd(key, pool); TL.n++;
  // the mask of the ground, laid first
  aqPoly(TL.hole, W, () => rim, () => [0, 0], [0, 1, 0]);
  // the coping: a ring 75 cm wide, flat, 10 cm over the highest ground, and its outer wall down to the ground
  { const b = TL.cop; for (let i = 0; i < n; i++) { const j = (i + 1) % n, wi = W[i], wj = W[j], oi = O[i], oj = O[j]; aqQuad(b, [wi[0], rim, wi[1]], [wj[0], rim, wj[1]], [oj[0], rim, oj[1]], [oi[0], rim, oi[1]], [0, 1, 0], [[0, 0], [1, 0], [1, 1], [0, 1]]);
    const yi = Math.min(gr(oi[0], oi[1]), rim - 0.05) - 0.12, yj = Math.min(gr(oj[0], oj[1]), rim - 0.05) - 0.12, l = hyp(oj[0] - oi[0], oj[1] - oi[1]) || 1, ox = (oj[1] - oi[1]) / l, oz = -(oj[0] - oi[0]) / l, os = sArea(O) < 0 ? -1 : 1;
    aqQuad(b, [oi[0], yi, oi[1]], [oj[0], yj, oj[1]], [oj[0], rim, oj[1]], [oi[0], rim, oi[1]], [ox * os, 0, oz * os], [[0, 0], [1, 0], [1, 1], [0, 1]]); } }
  // the walls of the basin, tiled, the lines of the tiles go round; the floor
  { const b = TL.floor; let acc = 0, ws = sArea(W) < 0 ? -1 : 1; for (let i = 0; i < n; i++) { const j = (i + 1) % n, wi = W[i], wj = W[j], l = hyp(wj[0] - wi[0], wj[1] - wi[1]) || 1, nx = -(wj[1] - wi[1]) / l * ws, nz = (wj[0] - wi[0]) / l * ws, yi = floor(wi[0], wi[1]), yj = floor(wj[0], wj[1]);
      aqQuad(b, [wi[0], yi, wi[1]], [wj[0], yj, wj[1]], [wj[0], rim, wj[1]], [wi[0], rim, wi[1]], [nx, 0, nz], [[acc, -(rim - yi)], [acc + l, -(rim - yj)], [acc + l, 0], [acc, 0]]); acc += l; }
    aqPoly(b, W, floor, (x, z) => [x, z], [0, 1, 0]);
    // the lane lines on the floor of a long straight pool: dark blue, 12 cm wide
    if (rect && L >= 18 && A.v1 - A.v0 >= 7) { const lanes = Math.floor((A.v1 - A.v0 - 1.2) / 2.2); for (let k = 1; k < lanes; k++) { const v = A.v0 + 0.6 + (A.v1 - A.v0 - 1.2) * k / lanes, p0 = A.at(A.s0 + 0.9, v), p1 = A.at(A.s1 - 0.9, v);
        aqQuad(TL.lane, [p0[0] - A.nx * 0.06, floor(p0[0], p0[1]) + 0.004, p0[1] - A.nz * 0.06], [p1[0] - A.nx * 0.06, floor(p1[0], p1[1]) + 0.004, p1[1] - A.nz * 0.06], [p1[0] + A.nx * 0.06, floor(p1[0], p1[1]) + 0.004, p1[1] + A.nz * 0.06], [p0[0] + A.nx * 0.06, floor(p0[0], p0[1]) + 0.004, p0[1] + A.nz * 0.06], [0, 1, 0], [[0, 0], [0, 0], [0, 0], [0, 0]]); } }
    // the steps of the ladders: blocks of the same tile, as high as the physics (poolGround)
    for (const s of stairs) for (let j = 0; j < s.n; j++) { const top = rim - 0.3 - j * s.rise, b0 = j * s.td, b1 = (j + 1) * s.td, P4 = (a, bb2, y) => [s.x + s.ux * a + s.nx * bb2, y, s.z + s.uz * a + s.nz * bb2];
      const bot = rim - dMax - 0.1; aqQuad(b, P4(-s.hw, b0, top), P4(s.hw, b0, top), P4(s.hw, b1, top), P4(-s.hw, b1, top), [0, 1, 0], [[0, 0], [1, 0], [1, 0.3], [0, 0.3]]);
      aqQuad(b, P4(-s.hw, b1, bot), P4(s.hw, b1, bot), P4(s.hw, b1, top), P4(-s.hw, b1, top), [s.nx, 0, s.nz], [[0, 0], [1, 0], [1, 1], [0, 1]]);
      for (const sd of [-1, 1]) aqQuad(b, P4(sd * s.hw, b0, bot), P4(sd * s.hw, b1, bot), P4(sd * s.hw, b1, top), P4(sd * s.hw, b0, top), [s.ux * sd, 0, s.uz * sd], [[0, 0], [1, 0], [1, 1], [0, 1]]); }
    // the handrails of the ladder: two steel tubes, up from the coping, over and down into the water
    for (const s of stairs) for (const sd of [-0.42, 0.42]) { const P3 = (bb2, y) => [s.x + s.ux * sd + s.nx * bb2, y, s.z + s.uz * sd + s.nz * bb2]; lsRod(solid, P3(-0.4, rim), P3(-0.4, rim + 0.9), 0.022, '#d9dcde', 6); lsRod(solid, P3(-0.4, rim + 0.9), P3(0.35, rim + 0.9), 0.022, '#d9dcde', 6); lsRod(solid, P3(0.35, rim + 0.9), P3(0.35, rim - 0.9), 0.022, '#d9dcde', 6); }
  }
  // the water: 18 cm under the coping; the depth under each vertex goes to the shader
  { const b = TL.water; const base = b.p.length / 3; const faces = THREE.ShapeUtils.triangulateShape(W.map(v => new THREE.Vector2(v[0], v[1])), []);
    for (const v of W) { b.p.push(v[0], water, v[1]); b.n.push(0, 1, 0); b.uv.push(Math.max(0.05, water - floor(v[0], v[1])), 99); } for (const f of faces) b.i.push(base + f[0], base + f[1], base + f[2]); }
  void g0; void ACQ_POOL;
  return true;
}
// ---- ponds and lakes (DBGT water areas outside the river beds, that are not a pool): a bowl dug where the outline is, the ground left out by the same mask, the water in it
// DBGT says where the water is and nothing of how deep: a shallow shore going down to a flat bottom, as deep as a pond of that size can be (1 m at most)
const LAGO_D = [0.3, 0.9, 1.8, 3.0, 4.5];
function lagoDi(a, T) { // the outline of a water area of the DBGT that becomes a lake, else null
  if (a.t !== 6 || !T.fine || (a.k && a.k.length)) return null; if (a._lago !== undefined) return a._lago;
  const P = dec(a.p); a._lago = null; if (P.length < 4 || Math.abs(sArea(P)) < 40) return null;
  const [cx, cz] = centroid(P), ar = Math.abs(sArea(P)); for (const b of T.d.a || []) if (b !== a && b.t === 6 && !(b.k && b.k.length)) { const Q = dec(b.p); if (Math.abs(sArea(Q)) > ar && inPoly(cx, cz, Q)) { a._lago = null; a._dup = true; return null; } } /* the same pond drawn twice: the bigger outline stays */
  for (const L0 of T.d.ls || []) if (L0.s === 'piscina' && inPoly(cx, cz, dec(L0.p))) return null; /* the DBGT draws a pool as water too: that is the pool */
  if (waterInBed(a, P, [], T)) return null; return (a._lago = P);
}
function lagoAnello(a, T) { // a water area with a hole that is the lake itself seen twice (the DBGT draws the bank band round it), or the smaller copy of the same pond: painted by nobody
  if (a.t !== 6 || !T.fine) return false; lagoDi(a, T); if (a._dup) return true; if (!(a.k && a.k.length)) return false; const P = dec(a.p), [cx, cz] = centroid(P);
  for (const b of T.d.a || []) if (b !== a && b.t === 6) { const Q = lagoDi(b, T); if (Q && (inPoly(cx, cz, Q) || inPoly(...centroid(Q), P))) return true; } return false;
}
function lagoProf(d, D) { const t = Math.min(1, Math.max(0, (d - 0.3) / 4.2)); return 0.12 + (D - 0.12) * t * t * (3 - 2 * t); } // depth at d metres from the bank
function lago(P, T, TL) {
  const gr = H_GROUND_RAW, rings = [], sg = sArea(P) < 0 ? -1 : 1; void sg;
  const r0 = lsInset(P, 0.3); if (!r0) return false; const n = r0.length; rings.push(r0);
  for (const d of LAGO_D.slice(1)) { const r = lsInset(P, d); if (!r || r.length !== n) break; rings.push(r); }
  const ext = Math.min(...(() => { const A = lsAxis(P); return [A.s1 - A.s0, A.v1 - A.v0]; })()), D = Math.min(1.0, 0.25 + 0.08 * ext);
  let wl = 1e9; for (const q of P) wl = Math.min(wl, gr(q[0], q[1])); const water = wl - 0.15;
  const dep = [0.3, 0.9, 1.8, 3.0, 4.5].slice(0, rings.length); const last = rings.length - 1;
  const yAt = (q, k) => gr(q[0], q[1]) - (k === last ? D : lagoProf(dep[k], D)) - 0.1;
  const Y = rings.map((R, k) => R.map(q => yAt(q, k)));
  const key = 'L' + centroid(P).map(v => v.toFixed(1)).join(','); (T.poolKeys || (T.poolKeys = [])).push(key);
  const bb = [1e9, 1e9, -1e9, -1e9]; for (const q of P) { bb[0] = Math.min(bb[0], q[0]); bb[1] = Math.min(bb[1], q[1]); bb[2] = Math.max(bb[2], q[0]); bb[3] = Math.max(bb[3], q[1]); }
  const edist = (x, z) => { let d = 1e9; for (let i = 0; i < P.length; i++) { const a = P[i], b = P[(i + 1) % P.length], dx = b[0] - a[0], dz = b[1] - a[1], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1))); d = Math.min(d, hyp(x - a[0] - dx * t, z - a[1] - dz * t)); } return d; };
  poolAdd(key, { W: P, O: P, bb, rim: water + 1, water, lake: true, stairs: [], floor: (x, z) => gr(x, z) - lagoProf(edist(x, z), D) - 0.1, solo: true });
  TL.n++;
  aqPoly(TL.hole, r0, () => water + 1, () => [0, 0], [0, 1, 0]);
  const strip = (b, A, YA, B, YB, uvf) => { for (let i = 0; i < n; i++) { const j = (i + 1) % n; aqQuad(b, [A[i][0], YA[i], A[i][1]], [A[j][0], YA[j], A[j][1]], [B[j][0], YB[j], B[j][1]], [B[i][0], YB[i], B[i][1]], [0, 1, 0], [uvf(i, YA[i]), uvf(j, YA[j]), uvf(j, YB[j]), uvf(i, YB[i])]); } };
  const zero = () => [0, 0];
  const Yout = P.length === n ? P.map(q => gr(q[0], q[1]) - 0.1) : null; void Yout;
  for (let k = 0; k < last; k++) strip(TL.bed, rings[k], Y[k], rings[k + 1], Y[k + 1], zero);
  aqPoly(TL.bed, rings[last], (x, z) => gr(x, z) - D - 0.1, zero, [0, 1, 0]);
  // the water: the same rings at the level of the water, the depth under each vertex to the shader
  const w = TL.lake, wv = (q, y) => [q[0], water, q[1], Math.max(0.0, water - y)];
  const wq = (A, YA, B, YB) => { for (let i = 0; i < n; i++) { const j = (i + 1) % n, P4 = [wv(A[i], YA[i]), wv(A[j], YA[j]), wv(B[j], YB[j]), wv(B[i], YB[i])], q = w.p.length / 3; for (const v of P4) { w.p.push(v[0], v[1], v[2]); w.n.push(0, 1, 0); w.uv.push(v[3], 99); } w.i.push(q, q + 1, q + 2, q, q + 2, q + 3); } };
  for (let k = 0; k < last; k++) wq(rings[k], Y[k], rings[k + 1], Y[k + 1]);
  { const base = w.p.length / 3, R = rings[last], faces = THREE.ShapeUtils.triangulateShape(R.map(v => new THREE.Vector2(v[0], v[1])), []); for (let i = 0; i < n; i++) { w.p.push(R[i][0], water, R[i][1]); w.n.push(0, 1, 0); w.uv.push(Math.max(0, water - Y[last][i]), 99); } for (const f of faces) w.i.push(base + f[0], base + f[1], base + f[2]); }
  // the first strip, from the outline to the first ring, goes under the ground: the mask is the first ring
  return true;
}
const ACQ_BED = new THREE.MeshLambertMaterial({ color: 0x77714f, side: THREE.DoubleSide });
function acquaMesh(TL, G, solidOnly) {
  if (!TL.n) return;
  const mk = (b, mat, ro, sh) => { if (!b.i.length) return null; return mkMesh(b, mat, ro, sh, G); };
  const h = mk(TL.hole, ACQ_BUCO, -100, false); if (h) h.receiveShadow = false;
  mk(TL.floor, ACQ_TILE, 9, false); mk(TL.lane, ACQ_LINE, 9, false); mk(TL.cop, ACQ_COPING, 9, 'cast');
  const w = mk(TL.water, ACQ_POOL, 12, false); if (w) { w.receiveShadow = false; acquaDraw(w); }
  mk(TL.bed, ACQ_BED, 9, false); const l = mk(TL.lake, ACQ_LAKE, 12, false); if (l) { l.receiveShadow = false; acquaDraw(l); }
  void solidOnly;
}
