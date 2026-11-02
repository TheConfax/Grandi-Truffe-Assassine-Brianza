// ---------------------------------------------------------------- the land by kind (paesaggio)
// build_data.py hands each tile its pieces of land with what they are (D tile key ls: { p, s }): fields, meadows, orchards, allotments, building
// sites, industrial yards, nurseries, pools, pitches by sport and surface. Each gets dressed for what it is: furrows and bales, rows of fruit trees,
// plots with sheds, a fenced site with containers and a crane, pallets and skips round the sheds, stone round the pool, lines, goals, hoops and nets.
// Garages get their up-and-over doors on the side you drive up to, greenhouses are glass. Variety comes from a hash of the place, never from
// what a real place looks like: nothing here pretends to know more than the map says
const LS_HASH = (x, z, k = '') => NG_HASH(k + Math.round(x * 10) + ',' + Math.round(z * 10));
function lsResample(P, step) { /* a closed outline walked again with a vertex every step metres */
  const out = []; let carry = 0;
  for (let i = 0; i < P.length; i++) { const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 1e-6) continue; let t = carry; while (t < L) { out.push([a[0] + (c[0] - a[0]) * t / L, a[1] + (c[1] - a[1]) * t / L]); t += step; } carry = t - L; }
  return out.length >= 4 ? out : P;
}
function lsAxis(P) { // the long axis of a polygon, and its extent along and across it
  const [cx, cz] = centroid(P); let sxx = 0, szz = 0, sxz = 0;
  for (const [x, z] of P) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
  const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang), nx = -uz, nz = ux;
  const Q = P.map(([x, z]) => [(x - cx) * ux + (z - cz) * uz, (x - cx) * nx + (z - cz) * nz]);
  const s = Q.map(q => q[0]), v = Q.map(q => q[1]);
  return { cx, cz, ux, uz, nx, nz, Q, s0: Math.min(...s), s1: Math.max(...s), v0: Math.min(...v), v1: Math.max(...v), at: (a, b) => [cx + ux * a + nx * b, cz + uz * a + nz * b] };
}
// minimum-area rectangle of a polygon, as a frame like lsAxis: long axis u, centred, s in -a..a (the long sides run along u), v in -b..b
function lsRect(P) {
  const pts = P.map(p => [p[0], p[1]]).sort((p, q) => p[0] - q[0] || p[1] - q[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of pts) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  const Hu = lo.slice(0, -1).concat(up.slice(0, -1)); let best = null;
  for (let i = 0; i < Hu.length; i++) {
    const a = Hu[i], c = Hu[(i + 1) % Hu.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 1e-6) continue;
    const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L; let s0 = 1e18, s1 = -1e18, v0 = 1e18, v1 = -1e18;
    for (const p of Hu) { const s = p[0] * ux + p[1] * uz, v = -p[0] * uz + p[1] * ux; if (s < s0) s0 = s; if (s > s1) s1 = s; if (v < v0) v0 = v; if (v > v1) v1 = v; }
    const ar = (s1 - s0) * (v1 - v0); if (!best || ar < best.ar) best = { ar, ux, uz, s0, s1, v0, v1 };
  }
  if (!best) return null;
  let { ux, uz, s0, s1, v0, v1 } = best;
  if (s1 - s0 < v1 - v0) { [ux, uz, s0, s1, v0, v1] = [-uz, ux, v0, v1, -s1, -s0]; }
  const nx = -uz, nz = ux, sm = (s0 + s1) / 2, vm = (v0 + v1) / 2, cx = ux * sm + nx * vm, cz = uz * sm + nz * vm;
  return { cx, cz, ux, uz, nx, nz, s0: -(s1 - s0) / 2, s1: (s1 - s0) / 2, v0: -(v1 - v0) / 2, v1: (v1 - v0) / 2, at: (a, b) => [cx + ux * a + nx * b, cz + uz * a + nz * b] };
}
// test hook (window.__CAMPI, set by a test page only): what each pitch put where, in the frame of its rectangle
function lsAud(rec, tipo, x, z) {
  if (!rec) return; const R = rec.rc; if (!R) return; const da = x - R[0], dz = z - R[1], a = da * R[2] + dz * R[3], b = -da * R[3] + dz * R[2];
  rec.it.push([tipo, +x.toFixed(2), +z.toFixed(2), inPoly(x, z, rec.P) ? 0 : 1, onAnyRoad(x, z, 0.2) ? 1 : 0, R[5] - Math.abs(b) < R[4] - Math.abs(a) ? 1 : 0]); /* tipo, x, z, fuori dal campo, su strada, sul lato lungo */
}
function lsSpans(Q, v) { // where the line across at v runs inside the polygon (in axis coordinates)
  const xs = []; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; if ((a[1] > v) !== (b[1] > v)) xs.push(a[0] + (v - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
  xs.sort((p, q) => p - q); const out = []; for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); return out;
}
// a flat strip laid on the ground (draped, so y is the height above it), from (s0,v) to (s1,v) in the frame A, w wide, in pieces of 6 m
function lsStrip(b, A, s0, s1, v, w, col, dy = 0.05) {
  const n = Math.max(1, Math.ceil((s1 - s0) / 6)), cuts = [];
  for (let k = 0; k < n; k++) cuts.push([s0 + (s1 - s0) * k / n, s0 + (s1 - s0) * (k + 1) / n]);
  if (b.noclip) { // a tile of S: the corners stand on S (4 cm higher), and a piece is halved where S rises more than 3 cm over its chord
    const g = (s, t) => { const [x, z] = A.at(s, t); return H.base(x, z); }, bad = (a, c) => { for (const t of [v - w / 2, v, v + w / 2]) { const ya = g(a, t), yc = g(c, t), m = Math.max(1, Math.round((c - a) / 0.5)); for (let q = 1; q < m; q++) if (g(a + (c - a) * q / m, t) - (ya + (yc - ya) * q / m) > 0.03) return true; } return false; };
    for (let k = 0; k < cuts.length; k++) { const [a, c] = cuts[k]; if (c - a > 0.6 && bad(a, c)) { cuts.splice(k, 1, [a, (a + c) / 2], [(a + c) / 2, c]); k--; } }
  }
  for (const [a, c] of cuts) {
    const i = b.p.length / 3;
    for (const [s, t] of [[a, v - w / 2], [c, v - w / 2], [c, v + w / 2], [a, v + w / 2]]) { const [x, z] = A.at(s, t); vtx(b, x, dy + (b.noclip ? 0.04 : 0), z, 0, 1, 0, 0, 0, col); } // b.noclip: a tile of S, corners on S and 4 cm more
    triUp(b, i, i + 1, i + 2); triUp(b, i, i + 2, i + 3);
  }
}
function lsLine(b, A, s0, v0, s1, v1, w, col) { // a painted line between two points of the frame, any direction
  const L = hyp(s1 - s0, v1 - v0); if (L < 0.01) return; const n = Math.max(1, Math.ceil(L / 4)), ps = (s1 - s0) / L, pv = (v1 - v0) / L;
  for (let k = 0; k < n; k++) {
    const a = L * k / n, c = L * (k + 1) / n, i = b.p.length / 3;
    for (const [d, o] of [[a, -w / 2], [c, -w / 2], [c, w / 2], [a, w / 2]]) { const [x, z] = A.at(s0 + ps * d - pv * o, v0 + pv * d + ps * o); vtx(b, x, 0.07, z, 0, 1, 0, 0, 0, col); }
    triUp(b, i, i + 1, i + 2); triUp(b, i, i + 2, i + 3);
  }
}
const lsFreeAt = (x, z, r) => !onAnyRoad(x, z, r) && !inBuilding(x, z, r) && !nearRail(x, z, 3) && !ngInPark(x, z, r);
// up-and-over doors: a pressed-steel texture, tinted per door
const LS_DOOR_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, map: canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let x = 2; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x, 4, 1, h - 8); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 1, 4, 1, h - 8); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h); g.fillStyle = '#555'; g.fillRect(w / 2 - 3, h * 0.55, 6, 3); }, false) });
const LS_DOOR_COLS = ['#c9ccd1', '#9da1a6', '#b8ad95', '#6b7a6b', '#8a6a52', '#d9d6cf', '#7d8ea0'];
const LS_GLASS = new THREE.MeshLambertMaterial({ color: 0xe4f0ee, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
// the film of a plastic tunnel: milky, or the colour the photo shows (green shade cloth, the clear cover of a pool), per vertex
const LS_FILM = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide });
const LS_BALE_G = (() => { const g = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 12); g.rotateZ(Math.PI / 2); g.translate(0, 0.75, 0); return g; })(), LS_BALE_M = lam(0xc9ab62);
// a hoarding panel 1 m long (stretched to its length along x), 2 m high, with its post at one end; the colour comes per instance
const LS_PANEL_G = (() => { const b = Buf(), F = lmFrame(new THREE.Matrix4()); F.geo(b, lmBox(1, 2, 0.05, 0, 1, 0), null, COL('#ffffff')); F.geo(b, lmBox(0.05, 2.1, 0.07, -0.5, 1.05, 0), null, COL('#8f949a'));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.setIndex(b.i); return g; })();
const LS_PANEL_M = new THREE.MeshLambertMaterial({ vertexColors: true }), LS_PANEL_PROPS = new Map();
const LS_POT_G = (() => { const g = new THREE.IcosahedronGeometry(0.32, 0); g.translate(0, 0.45, 0); return g; })();

function* buildPaesaggio(T, G) {
  const d = T.d, solid = Buf(), drape = Object.assign(VBuf(), { noclip: !!H.tile(T.t) }), lines = VBuf(), doors = Buf(), glass = Buf(), net = Buf(), film = Buf(), F0 = lmFrame(new THREE.Matrix4());
  const box = (w, h, dd, x, y, z, col, ry = 0) => F0.geo(solid, lmBox(w, h, dd, x, y, z, ry), null, COL(col));
  const cyl = (r, h, x, y, z, col, seg = 10) => F0.geo(solid, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z), null, COL(col));
  const solids = [], bales = [], pots = [], panels = [], ftrees = [], potPlants = [], crops = [], stakes = [], fruitG = [];
  const solidAt = (x, z, r, h) => solids.push([x, z, r, h]);
  // ---- garages: doors on the open side, one per box
  for (const B of T.bld) {
    if (B.g !== 1 || B.lm || B.h < 2.2) continue;
    const P = B.pts, A = sArea(P), n = P.length, walls = [];
    for (let i = 0; i < n; i++) {
      const a = P[i], c = P[(i + 1) % n], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 2.5) continue;
      let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (A < 0) { nx = -nx; nz = -nz; }
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; let open = 0;
      for (let t = 1; t <= 8; t += 1) { if (inBuilding(mx + nx * t, mz + nz * t)) break; open++; }
      if (open < 4) continue;
      let road = 0; ROADSEG.each(mx - 25, mz - 25, mx + 25, mz + 25, s => { if (atGrade(s) && segDist(mx + nx * 6, mz + nz * 6, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + 12) road = 1; });
      walls.push({ a, c, L, nx, nz, ux: (c[0] - a[0]) / L, uz: (c[1] - a[1]) / L, score: L * (1 + road) + open });
    }
    if (!walls.length) continue;
    walls.sort((p, q) => q.score - p.score);
    const use = [walls[0]]; const w2 = walls.find(w => w !== walls[0] && w.nx * walls[0].nx + w.nz * walls[0].nz < -0.9 && w.L > walls[0].L * 0.8 && Math.abs(sArea(P)) > 60); if (w2) use.push(w2);
    const gy = Math.min(...P.map(p => H.ground(p[0], p[1])));
    for (const W of use) {
      const k = Math.max(1, Math.floor((W.L - 0.3) / 2.75)), pitch = W.L / k, dw = Math.min(2.4, pitch - 0.35), dh = Math.min(2.15, B.h - 0.35);
      for (let j = 0; j < k; j++) {
        const t = pitch * (j + 0.5), cx = W.a[0] + W.ux * t + W.nx * 0.03, cz = W.a[1] + W.uz * t + W.nz * 0.03, y0 = H.ground(cx, cz), col = COL(LS_DOOR_COLS[Math.floor(LS_HASH(cx, cz, 'porta') * LS_DOOR_COLS.length)]);
        const i = doors.p.length / 3, ex = W.ux * dw / 2, ez = W.uz * dw / 2;
        vtx(doors, cx - ex, y0, cz - ez, W.nx, 0, W.nz, 0, 0, col); vtx(doors, cx + ex, y0, cz + ez, W.nx, 0, W.nz, 1, 0, col); vtx(doors, cx + ex, y0 + dh, cz + ez, W.nx, 0, W.nz, 1, 1, col); vtx(doors, cx - ex, y0 + dh, cz - ez, W.nx, 0, W.nz, 0, 1, col);
        doors.i.push(i, i + 1, i + 2, i, i + 2, i + 3, i, i + 2, i + 1, i, i + 3, i + 2);
        box(dw + 0.16, 0.08, 0.06, cx, y0 + dh + 0.04, cz, '#6b6e72', Math.atan2(W.ux, W.uz) + Math.PI / 2);
      }
    }
    void gy;
  }
  yield 'garage';
  // ---- greenhouses: glass walls and roof on a light frame, rows of plants inside; a plastic tunnel where the DBGT greenhouse is one
  // (B.mm.k 'tunnel', dbgt_manufatti.py _modello: the photo, or a narrow rectangle)
  for (const B of T.bld) {
    if (B.g !== 2 || B.lm) continue;
    if (B.mm && B.mm.k === 'tunnel') { lsTunnel(B, film, solid, box); continue; }
    const P = B.pts, n = P.length, gys = P.map(p => H.ground(p[0], p[1])), g0 = Math.min(...gys), Ax = lsAxis(P);
    const ridge0 = n <= 5 && isConvex(P), rh0 = ridge0 ? Math.min(1.6, (Ax.v1 - Ax.v0) * 0.25) : 0, top = Math.max(...gys) + Math.max(2.2, B.h - (B.mm ? rh0 : 0)); /* a DBGT greenhouse: B.h is the ridge */
    for (let i = 0; i < n; i++) {
      const a = P[i], c = P[(i + 1) % n], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.2) continue; const j = glass.p.length / 3;
      vtx(glass, a[0], g0 - 0.3, a[1], 0, 0, 1, 0, 0); vtx(glass, c[0], g0 - 0.3, c[1], 0, 0, 1, 0, 0); vtx(glass, c[0], top, c[1], 0, 0, 1, 0, 0); vtx(glass, a[0], top, a[1], 0, 0, 1, 0, 0); glass.i.push(j, j + 1, j + 2, j, j + 2, j + 3);
      for (let t = 0; t <= L; t += 2.2) { const x = a[0] + (c[0] - a[0]) * t / L, z = a[1] + (c[1] - a[1]) * t / L; box(0.06, top - g0 + 0.3, 0.06, x, (top + g0 - 0.3) / 2, z, '#dfe3e4'); }
    }
    // the roof: a ridge down the long axis when the plan is a plain box, flat otherwise
    const ridge = ridge0, rh = rh0;
    try { if (!ridge) { const rb = Buf(); polyFill(rb, P, [], top, 10, null); const j0 = glass.p.length / 3; for (let q = 0; q < rb.p.length; q += 3) vtx(glass, rb.p[q], rb.p[q + 1], rb.p[q + 2], 0, 1, 0, 0, 0); for (const q of rb.i) glass.i.push(j0 + q); }
      else { const vm = (Ax.v0 + Ax.v1) / 2; for (const vv of [Ax.v0, Ax.v1]) { const [ax, az] = Ax.at(Ax.s0, vv), [bx, bz] = Ax.at(Ax.s1, vv), [cx, cz] = Ax.at(Ax.s1, vm), [ex, ez] = Ax.at(Ax.s0, vm), j = glass.p.length / 3;
        vtx(glass, ax, top, az, 0, 1, 0, 0, 0); vtx(glass, bx, top, bz, 0, 1, 0, 0, 0); vtx(glass, cx, top + rh, cz, 0, 1, 0, 0, 0); vtx(glass, ex, top + rh, ez, 0, 1, 0, 0, 0); glass.i.push(j, j + 1, j + 2, j, j + 2, j + 3); }
        for (const ss of [Ax.s0, Ax.s1]) { const [ax, az] = Ax.at(ss, Ax.v0), [bx, bz] = Ax.at(ss, Ax.v1), [cx, cz] = Ax.at(ss, vm), j = glass.p.length / 3; vtx(glass, ax, top, az, 0, 0, 1, 0, 0); vtx(glass, bx, top, bz, 0, 0, 1, 0, 0); vtx(glass, cx, top + rh, cz, 0, 0, 1, 0, 0); glass.i.push(j, j + 1, j + 2); }
        const [p1x, p1z] = Ax.at(Ax.s0, vm), [p2x, p2z] = Ax.at(Ax.s1, vm); box(hyp(p2x - p1x, p2z - p1z), 0.08, 0.08, (p1x + p2x) / 2, top + rh, (p1z + p2z) / 2, '#dfe3e4', Math.atan2(Ax.ux, Ax.uz) - Math.PI / 2); } } catch (e) { }
    for (let v = Ax.v0 + 1.2; v < Ax.v1 - 0.8; v += 1.6) for (const [a, b] of lsSpans(Ax.Q, v)) if (b - a > 2) { const [x1, z1] = Ax.at((a + b) / 2, v); box(b - a - 1.2, 0.5, 0.7, x1, g0 + 0.25, z1, '#4f7a35', Math.atan2(Ax.ux, Ax.uz) - Math.PI / 2); }
  }
  yield 'serre';
  // ---- the land
  const stadia = new Map(); for (const L0 of d.ls || []) if (L0.s.startsWith('pista')) { const P0 = dec(L0.p); stadia.set(L0, P0.length > 6 ? lsStadium(P0) : null); }
  const stadiaL = [...stadia.values()].filter(Boolean);
  for (const L0 of d.ls || []) {
    const P = dec(L0.p); if (P.length < 3) continue;
    const kind = L0.s, A = lsAxis(P), [cx, cz] = [A.cx, A.cz], h = LS_HASH(cx, cz, kind), area = Math.abs(sArea(P));
    if (kind === 'campo' || kind === 'prato') {
      if (kind === 'campo') { // furrows the long way: ploughed, green, ripe or stubble, the hash decides
        const pal = [['#8f6e4e', '#7d5f42'], ['#8fae5a', '#7c9a4b'], ['#d6bf72', '#c8b064'], ['#d9cf9e', '#cbbf8c']][Math.floor(h * 4)];
        for (let v = A.v0 + 1.4, k = 0; v < A.v1 - 0.7; v += 1.4, k++) for (const [a, b] of lsSpans(A.Q, v)) if (b - a > 1) lsStrip(drape, A, a + 0.4, b - 0.4, v, 1.42, COL(pal[k % 2]), 0.04);
      }
      if (h > (kind === 'campo' ? 0.6 : 0.75) && area > 1500) { // round bales left in the field
        const n = Math.min(10, Math.floor(area / 2500) + 2); let got = 0;
        for (let k = 0; k < n * 4 && got < n && bales.length < 40; k++) {
          const s = A.s0 + (A.s1 - A.s0) * LS_HASH(cx + k, cz, 'b'), v = A.v0 + (A.v1 - A.v0) * LS_HASH(cx, cz + k, 'b'), [x, z] = A.at(s, v);
          if (!inPoly(x, z, P) || !lsFreeAt(x, z, 3) || bales.some(([bx, bz]) => hyp(bx - x, bz - z) < 4)) continue;
          bales.push([x, z, LS_HASH(x, z, 'r') * TAU]); got++;
        }
      }
    } else if (kind === 'frutteto') lsOrchard(A, P, drape, ftrees, solidAt);
    else if (kind === 'vivaio') lsNursery(A, P, drape, pots, potPlants);
    else if (kind === 'orti') lsGarden(A, P, drape, solid, box, solidAt, crops, stakes, fruitG);
    else if (kind === 'cantiere') { // the hoarding round it (not across streets), containers, a sand heap, a tower crane on the big ones
      // L0.w: the walls and fences of the map along its edge, which the hoarding replaces on their own line (the build took them out, src/barriere.py
      // cantieri): drawn as they are, they already keep off the carriageway; L0.h: the rest of the edge, which gets the hoarding as before
      const runs = L0.w ? [...(L0.h || []).map(q => [dec(q), 1]), ...L0.w.map(q => [dec(q), 0])] : [[[...P, P[0]], 1]];
      for (const [R, filt] of runs) for (let i = 0; i + 1 < R.length; i++) {
        const a = R[i], c = R[i + 1], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < (filt ? 0.5 : 0.05)) continue;
        for (let t = 0; t < L; t += 2.5) {
          const t1 = Math.min(L, t + 2.5), x0 = a[0] + (c[0] - a[0]) * t / L, z0 = a[1] + (c[1] - a[1]) * t / L, x1 = a[0] + (c[0] - a[0]) * t1 / L, z1 = a[1] + (c[1] - a[1]) * t1 / L, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
          if (filt && (onAnyRoad(mx, mz, 0.6) || nearAsph(mx, mz, 0.3) || onAsph(x0, z0) || onAsph(x1, z1) || inBuilding(mx, mz, 0.3))) continue; /* the drawn carriageway too (AC_VEI), ends included */
          const g0 = H.ground(x0, z0); panels.push([x0, z0, x1, z1, h > 0.5 ? '#3d6a4a' : '#b8bcc0']); // a panel of its own: it goes over when rammed
          box(0.4, 0.15, 0.25, x0, g0 + 0.07, z0, '#c9c4b8');
        }
      }
      const spots = [];
      for (let k = 0; k < 40 && spots.length < 4; k++) { const s = A.s0 + 4 + (A.s1 - A.s0 - 8) * LS_HASH(cx + k, cz, 'c'), v = A.v0 + 4 + (A.v1 - A.v0 - 8) * LS_HASH(cx, cz + k, 'c'), [x, z] = A.at(s, v); if (inPoly(x, z, P) && lsFreeAt(x, z, 3.5) && !spots.some(([p, q]) => hyp(p - x, q - z) < 7)) spots.push([x, z]); }
      const ry = Math.atan2(A.ux, A.uz);
      spots.forEach(([x, z], k) => {
        const gy = H.ground(x, z);
        if (k === 0 && area > 1200) { // tower crane: lattice mast as a yellow column, jib and counter-jib, cab, counterweight
          // as tall as 22-32 m at most, most of them lower
          const Hmax = 22 + LS_HASH(x, z, 'gru') * 10, Hh = 12 + (Hmax - 12) * LS_HASH(x, z, 'altezza'), a = LS_HASH(x, z, 'brac') * TAU;
          box(1.6, Hh, 1.6, x, gy + Hh / 2, z, '#e8b520'); for (let y = 2; y < Hh; y += 2.5) box(1.7, 0.12, 1.7, x, gy + y, z, '#c99a10');
          box(42, 1.1, 1.1, x + Math.sin(a) * 12, gy + Hh + 0.6, z + Math.cos(a) * 12, '#e8b520', a + Math.PI / 2); box(2.4, 2.2, 2, x - Math.sin(a) * 9, gy + Hh - 0.2, z - Math.cos(a) * 9, '#8f949a', a);
          box(1.6, 1.6, 1.6, x + Math.sin(a) * 1.6, gy + Hh - 0.4, z + Math.cos(a) * 1.6, '#f2efe6', a); box(0.12, 0.12, 0.12, x, gy + Hh + 1.5, z, '#c8102e');
          solidAt(x, z, 1.2, Hh);
        } else if (k < 3) { const col = ['#c8762a', '#2a6fb0', '#8a8f94', '#5a6b3a'][Math.floor(LS_HASH(x, z, 'ct') * 4)]; box(6, 2.6, 2.4, x, gy + 1.3, z, col, ry + (k - 1) * 0.3); for (let q = -2.5; q <= 2.5; q += 0.5) box(0.04, 2.5, 2.42, x + Math.sin(ry + (k - 1) * 0.3 + Math.PI / 2) * q, gy + 1.3, z + Math.cos(ry + (k - 1) * 0.3 + Math.PI / 2) * q, col, ry + (k - 1) * 0.3); solidAt(x, z, 2.6, 2.6); }
        else { F0.geo(solid, new THREE.ConeGeometry(2.2, 1.6, 9).translate(x, gy + 0.8, z), null, COL('#c9b28a')); solidAt(x, z, 1.8, 1.6); }
      });
    } else if (kind === 'industria') { // the yards round the sheds: pallets, skips, containers by the walls that look onto open ground
      const ry = Math.atan2(A.ux, A.uz); let placed = 0;
      for (const B of T.bld) {
        if (B.t !== 2 || placed > 14) continue; const [bx, bz] = centroid(B.pts); if (!inPoly(bx, bz, P)) continue;
        const Pb = B.pts, Ab = sArea(Pb);
        for (let i = 0; i < Pb.length && placed <= 14; i++) {
          const a = Pb[i], c = Pb[(i + 1) % Pb.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 10) continue;
          let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (Ab < 0) { nx = -nx; nz = -nz; }
          for (let t = 5; t < L - 4; t += 16) {
            const x = a[0] + (c[0] - a[0]) * t / L + nx * 2.2, z = a[1] + (c[1] - a[1]) * t / L + nz * 2.2, hh = LS_HASH(x, z, 'yard'); if (hh < 0.35 || !lsFreeAt(x, z, 2) || !inPoly(x, z, P)) continue;
            const gy = H.ground(x, z), wr = Math.atan2(c[0] - a[0], c[1] - a[1]) + Math.PI / 2;
            if (hh < 0.6) { for (let q = 0; q < 3; q++) for (let s2 = 0; s2 < 2 + Math.floor(hh * 6) % 3; s2++) { box(1.2, 0.14, 0.8, x + Math.sin(wr) * (q - 1) * 1.3, gy + 0.07 + s2 * 0.16, z + Math.cos(wr) * (q - 1) * 1.3, '#b08a5a', wr); } solidAt(x, z, 1.6, 0.6); }
            else if (hh < 0.85) { const col = ['#2a5a8a', '#c8762a', '#5a6b3a', '#8a2a2a'][Math.floor(hh * 37) % 4]; box(5.5, 0.15, 2.3, x, gy + 0.2, z, col, wr); for (const sd of [-1, 1]) box(5.5, 1.4, 0.08, x + Math.sin(wr) * 1.12 * sd, gy + 0.9, z + Math.cos(wr) * 1.12 * sd, col, wr); for (const se of [-1, 1]) box(0.08, 1.4, 2.3, x + Math.cos(wr) * 2.72 * se, gy + 0.9, z - Math.sin(wr) * 2.72 * se, col, wr); solidAt(x, z, 2.4, 1.6); }
            else { const col = ['#c8762a', '#2a6fb0', '#8a8f94'][Math.floor(hh * 53) % 3]; box(6, 2.6, 2.4, x, gy + 1.3, z, col, wr); solidAt(x, z, 2.6, 2.6); }
            placed++;
          }
        }
      }
      void ry;
    } else if (kind === 'piscina') lsPool(P, A, drape, lines, solid);
    else if (kind === 'cani') { // a dog run: a mesh fence with a way in on the side nearest a street, a bench and a bin inside
      let gate = 0, gd = 1e9; P.forEach((p, i) => { const q = P[(i + 1) % P.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; let d = 1e9; ROADSEG.each(mx - 30, mz - 30, mx + 30, mz + 30, s => { d = Math.min(d, segDist(mx, mz, s.a[0], s.a[1], s.b[0], s.b[1])); }); if (d < gd && hyp(q[0] - p[0], q[1] - p[1]) > 3) { gd = d; gate = i; } });
      lsFence(net, solid, P, 1.2, gate, '#3e4a42');
      const [bx, bz] = A.at(A.s0 * 0.4, A.v0 * 0.4); if (inPoly(bx, bz, P)) { const gy = H.ground(bx, bz), ry = Math.atan2(A.ux, A.uz); const qx = bx + Math.sin(ry) * 1.4, qz = bz + Math.cos(ry) * 1.4; parkProps(G, 'panchina', [[bx, bz, ry, gy]]); parkProps(G, 'cestino', [[qx, qz, ry, H.ground(qx, qz)]]); } // knocked down like the street lamps (landmarks3.js)
    } else if (kind.startsWith('pista')) { if (!lsTrack(kind, P, area, stadia.get(L0), drape, lines)) window.__PISTE_NEUTRE = (window.__PISTE_NEUTRE || 0) + 1; /* no stadium and no straight of lanes in the outline: nothing drawn */
    } else if (kind === 'aiuola') { // a flower bed: dark soil, flowers in the colours of a garden centre
      try { polyFill(drape, P, [], 0.06, 10, COL('#5a4030')); } catch (e) { }
      const n = Math.min(140, Math.floor(area * 1.5));
      for (let k = 0; k < n * 2 && k < 400; k++) { const x = A.cx + (LS_HASH(cx + k, cz, 'fl') - 0.5) * (A.s1 - A.s0 + A.v1 - A.v0), z = A.cz + (LS_HASH(cx, cz + k, 'fl') - 0.5) * (A.s1 - A.s0 + A.v1 - A.v0); if (!inPoly(x, z, P)) continue; const gy = H.ground(x, z); F0.geo(solid, new THREE.IcosahedronGeometry(0.13, 0).translate(x, gy + 0.22, z), null, COL(['#c8331f', '#f2c230', '#f4a6b8', '#ffffff', '#8c6bb1', '#ff7a1e', '#3d6a2a'][Math.floor(LS_HASH(x, z, 'c') * 7)])); }
    } else if (kind === 'lavaggio') { if (area > 1500 || onAnyRoad(cx, cz, 0)) continue; lsWash(A, P, drape, solid, box, solidAt);
    } else if (kind.startsWith('torre_acqua')) { lsTower(solid, cx, cz, Math.sqrt(area / Math.PI), +kind.split(':')[1] || 28, solidAt);
    } else if (kind.startsWith('sport:skateboard')) lsSkate(A, P, drape, solid, box, solidAt);
    else if (kind.startsWith('sport:roller') || kind.startsWith('sport:ice')) lsRink(A, P, kind.startsWith('sport:ice'), drape, lines, solid, box, solidAt);
    else if (kind.startsWith('sport:shooting')) lsRange(A, P, solid, box, solidAt);
    else if (kind.startsWith('sport:equestrian')) { // a riding arena: sand, a wooden fence with a gate, two jumps
      try { polyFill(drape, P, [], 0.05, 10, COL('#d2bd8f')); } catch (e) { }
      lsRail(solid, P, 0, box);
      const ry = Math.atan2(A.ux, A.uz);
      for (const f of [-0.25, 0.25]) { const [x, z] = A.at((A.s0 + A.s1) / 2 + (A.s1 - A.s0) * f, (A.v0 + A.v1) / 2), gy = H.ground(x, z); for (const o of [-1.5, 1.5]) box(0.12, 1.3, 0.12, x + Math.cos(ry) * o, gy + 0.65, z - Math.sin(ry) * o, '#f4f2ea'); for (const y of [0.5, 0.9]) box(3, 0.08, 0.08, x, gy + y, z, y > 0.7 ? '#c8331f' : '#f4f2ea', ry + Math.PI / 2); }
    } else if (kind.startsWith('sport:baseball')) lsBaseball(P, drape, lines, net, solid, box, solidAt);
    else if (kind.startsWith('sport:')) lsPitch(A, P, kind.split(':')[1], kind.split(':')[2], lines, solid, box, cyl, G, solidAt, stadiaL);
  }
  // stands by the pitches: rows of steps up to a back wall, seats on them, a roof reaching out over the front
  for (const B of T.bld) {
    if (B.g !== 3 || B.lm) continue; const Ax = lsAxis(B.pts), gy = Math.min(...B.pts.map(p => H.ground(p[0], p[1])));
    let pitch = B.pt ? [B.pt[0] / 10, B.pt[1] / 10] : null, pd = 1e9; if (!pitch) for (const L0 of d.ls || []) if (L0.s.startsWith('sport')) { const Q = dec(L0.p), [qx, qz] = centroid(Q), dd = hyp(qx - Ax.cx, qz - Ax.cz); if (dd < pd) { pd = dd; pitch = [qx, qz]; } }
    const face = pitch && ((pitch[0] - Ax.cx) * Ax.nx + (pitch[1] - Ax.cz) * Ax.nz) < 0 ? -1 : 1, D_ = Ax.v1 - Ax.v0, rows = clamp(Math.floor(D_ / 0.85), 2, 14), Ls = Ax.s1 - Ax.s0, sm = (Ax.s0 + Ax.s1) / 2, ry = Math.atan2(Ax.ux, Ax.uz) - Math.PI / 2;
    const seat = ['#c8102e', '#1d4f9a', '#2a7a3a', '#e8b520', '#8f949a'][Math.floor(LS_HASH(Ax.cx, Ax.cz, 'seat') * 5)];
    for (let k = 0; k < rows; k++) { const v = face > 0 ? Ax.v1 - (k + 0.5) * D_ / rows : Ax.v0 + (k + 0.5) * D_ / rows, [x, z] = Ax.at(sm, v), hh = (k + 1) * 0.42; box(Ls, hh, D_ / rows, x, gy + hh / 2, z, '#b8b3a8', ry); box(Ls - 0.4, 0.12, 0.35, x, gy + hh + 0.06, z, seat, ry); }
    const top = rows * 0.42 + 2.6, vb = face > 0 ? Ax.v0 + 0.15 : Ax.v1 - 0.15, [wx, wz] = Ax.at(sm, vb); box(Ls, top, 0.3, wx, gy + top / 2, wz, '#a9a398', ry);
    const [rx_, rz_] = Ax.at(sm, (Ax.v0 + Ax.v1) / 2 + face * 0.6); box(Ls + 0.4, 0.2, D_ + 1.4, rx_, gy + top, rz_, '#8f949a', ry);
  }
  // water towers mapped as buildings (the DBGT one with what the photos say, B.mm)
  for (const B of T.bld) if (B.g === 4 && !B.lm) { const [x, z] = centroid(B.pts); lsTower(solid, x, z, Math.sqrt(Math.abs(sArea(B.pts)) / Math.PI), B.h, solidAt, B.mm); }
  // the cabins of the DBGT (electric, gas): their walls and roof here, the collision is the building's
  for (const B of T.bld) if (B.g === 5 && !B.lm) lsCabina(B, solid, box);
  // information boards: a map of the place on the board (the funny ones are in PANNELLI, to be written)
  const OI = OGG_KINDS.indexOf('pannello'), boards = (d.og || []).filter(o => o[0] === OI);
  if (boards.length) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 192 * Math.ceil(boards.length / 2); const g = cv.getContext('2d'), sb = Buf();
    boards.forEach((o, i) => {
      const x = o[1] / 10, z = o[2] / 10, a = o[3], col = i % 2, row = Math.floor(i / 2), X0 = col * 256, Y0 = row * 192, town = lsTown(x, z), txt = PANNELLI.length ? PANNELLI[Math.floor(LS_HASH(x, z, 'pan') * PANNELLI.length)] : null;
      g.save(); g.translate(X0, Y0); g.fillStyle = '#f2efe6'; g.fillRect(0, 0, 256, 192); g.fillStyle = '#2f4a3a'; g.fillRect(0, 0, 256, 34);
      ngText(g, town ? town.toUpperCase() : 'INFORMAZIONI', 128, 18, 236, 24, NG_FONT.sans, '#f2efe6');
      if (txt) { g.fillStyle = '#1a1a1a'; g.font = '15px Georgia, serif'; g.textAlign = 'left'; g.textBaseline = 'top'; const words = txt.split(' '); let line = '', y = 44; for (const w of words) { if (g.measureText(line + w).width > 230) { g.fillText(line, 12, y); y += 19; line = ''; } line += w + ' '; } g.fillText(line, 12, y); }
      else { g.fillStyle = '#d9e2c8'; g.fillRect(12, 44, 232, 136); g.strokeStyle = '#ffffff'; g.lineWidth = 5; for (let k = 0; k < 6; k++) { g.beginPath(); g.moveTo(12, 60 + LS_HASH(x + k, z, 'm') * 110); g.lineTo(244, 60 + LS_HASH(x, z + k, 'm') * 110); g.stroke(); } g.fillStyle = '#9ab8d0'; g.fillRect(150, 50, 60, 30); g.fillStyle = '#c8331f'; g.beginPath(); g.arc(128, 112, 7, 0, TAU); g.fill(); g.fillStyle = '#1a1a1a'; g.font = 'bold 13px Arial'; g.textAlign = 'center'; g.fillText('VOI SIETE QUI', 128, 134); }
      g.restore();
      const ux = Math.cos(a), uz = -Math.sin(a), fx = Math.sin(a), fz = Math.cos(a), cx0 = x + fx * 0.035, cz0 = z + fz * 0.035, gy = H.surface(x, z), u0 = col / 2 + 0.002, u1 = (col + 1) / 2 - 0.002, v1 = 1 - row * 192 / cv.height - 0.002, v0 = 1 - (row + 1) * 192 / cv.height + 0.002, j = sb.p.length / 3;
      vtx(sb, cx0 - ux * 0.62, gy + 1.1, cz0 - uz * 0.62, fx, 0, fz, u0, v0); vtx(sb, cx0 + ux * 0.62, gy + 1.1, cz0 + uz * 0.62, fx, 0, fz, u1, v0); vtx(sb, cx0 + ux * 0.62, gy + 2.0, cz0 + uz * 0.62, fx, 0, fz, u1, v1); vtx(sb, cx0 - ux * 0.62, gy + 2.0, cz0 - uz * 0.62, fx, 0, fz, u0, v1); sb.i.push(j, j + 1, j + 2, j, j + 2, j + 3);
    });
    const tex = new THREE.CanvasTexture(cv), mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    SIGN_MATS.push(mat); mkMesh(sb, mat, 10, false, G);
  }
  // town signs where a road crosses into the next comune: on the right of whoever arrives, the white sign with the name of the town ahead;
  // on its back, for those going the other way and leaving it, the same name struck through in red. Each one is a prop you can knock down
  // like the other road signs: a group with its foot on the ground (two legs, the panel, the two faces), down for good once hit
  if ((d.cl || []).length) {
    const signs = []; // [x, y, z, normal x, z, name]
    for (const [X, Z, ux, uz, w, fwd, back] of d.cl) {
      const x = X / 10, z = Z / 10, rx = -uz, rz = ux, off = w / 2 + 1.2;
      for (let [sx, sz, nx, nz, name, sd] of [[x - ux * 3 + rx * off, z - uz * 3 + rz * off, -ux, -uz, fwd, 1], [x + ux * 3 - rx * off, z + uz * 3 - rz * off, ux, uz, back, -1]]) {
        // the street can be drawn wider than its width in the data (via Padova: 13 m of asphalt for 7.2): out of the asphalt, half a metre at a time
        for (let k = 0; k < 12 && onAnyRoad(sx, sz, 0.4); k++) { sx += rx * sd * 0.5; sz += rz * sd * 0.5; }
        if (inBuilding(sx, sz, 0.3) || nearRail(sx, sz, 2.5) || onAnyRoad(sx, sz, 0.4)) continue;
        signs.push([sx, H.surface(sx, sz), sz, nx, nz, name]);
      }
    }
    if (signs.length) {
      const CW = 300, CH = 200, cv = document.createElement('canvas'); cv.width = CW * 2; cv.height = CH * signs.length; const g = cv.getContext('2d');
      const CL = (globalThis.__CL ||= { props: new Map(), legG: new THREE.BoxGeometry(0.06, 2.55, 0.06), panelG: new THREE.BoxGeometry(1.52, 1.02, 0.04), legM: new THREE.MeshLambertMaterial({ color: '#8f949a' }), panelM: new THREE.MeshLambertMaterial({ color: '#e8e6e0' }) });
      // the name in a plain sans, as big as it fits, broken between words over two or three lines when it is long
      const signLines = name => {
        const words = name.toUpperCase().split(/\s+/), F_ = s => `bold ${s}px Arial, Helvetica, sans-serif`; let best = null;
        for (let n = 1; n <= Math.min(3, words.length); n++) { // balanced breaks: every split, the one whose widest line is narrowest wins
          const splits = n === 1 ? [[]] : n === 2 ? words.slice(1).map((_, i) => [i + 1]) : words.slice(1).flatMap((_, i) => words.slice(i + 2).map((__, j) => [i + 1, i + 2 + j]));
          for (const sp of splits) { const b = [0, ...sp, words.length], ls = b.slice(1).map((e, k) => words.slice(b[k], e).join(' ')); g.font = F_(100); const w = Math.max(...ls.map(l => g.measureText(l).width)), size = Math.min(100 * (CW - 56) / w, (CH - 60) / (n * 1.15)); if (!best || size > best.size * 1.12) best = { size, ls }; }
        }
        return best;
      };
      // one row of the atlas per sign: the name on the left, struck through on the right for its back
      signs.forEach(([sx, gy, sz, nx, nz, name], i) => {
        const L = signLines(name);
        for (const end of [false, true]) {
          g.save(); g.translate(end ? CW : 0, i * CH); g.fillStyle = '#ffffff'; g.fillRect(0, 0, CW, CH); g.strokeStyle = '#111111'; g.lineWidth = 8; g.strokeRect(12, 12, CW - 24, CH - 24);
          g.fillStyle = '#111111'; g.font = `bold ${Math.floor(L.size)}px Arial, Helvetica, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
          L.ls.forEach((ln, k) => g.fillText(ln, CW / 2, CH / 2 + (k - (L.ls.length - 1) / 2) * L.size * 1.15 + L.size * 0.04));
          if (end) { g.strokeStyle = '#c8102e'; g.lineWidth = 14; g.beginPath(); g.moveTo(24, CH - 24); g.lineTo(CW - 24, 24); g.stroke(); }
          g.restore();
        }
      });
      const tex = new THREE.CanvasTexture(cv), mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05 }); SIGN_MATS.push(mat);
      signs.forEach(([sx, gy, sz, nx, nz], i) => {
        const root = new THREE.Group(); root.position.set(sx, gy, sz); root.rotation.y = Math.atan2(nx, nz); G.add(root); // local +z: towards whoever arrives
        for (const o of [-0.68, 0.68]) { const l = new THREE.Mesh(CL.legG, CL.legM); l.position.set(o, 1.27, -0.05); l.castShadow = true; root.add(l); }
        const pnl = new THREE.Mesh(CL.panelG, CL.panelM); pnl.position.set(0, 2.0, 0); pnl.castShadow = true; root.add(pnl);
        for (const [col, fz, ry] of [[0, 0.025, 0], [1, -0.025, Math.PI]]) {
          const pg = new THREE.PlaneGeometry(1.5, 1.0), uv = pg.attributes.uv, u0 = col / 2 + 0.003, u1 = (col + 1) / 2 - 0.003, v1 = 1 - i * CH / cv.height - 0.003, v0 = 1 - (i + 1) * CH / cv.height + 0.003;
          uv.setXY(0, u0, v1); uv.setXY(1, u1, v1); uv.setXY(2, u0, v0); uv.setXY(3, u1, v0);
          const f = new THREE.Mesh(pg, mat); f.position.set(0, 2.0, fz); f.rotation.y = ry; root.add(f);
        }
        const key = sx.toFixed(1) + ',' + sz.toFixed(1), pr = CL.props.get(key); // built again: what was knocked down stays down
        if (!pr) CL.props.set(key, addProp({ x: sx, z: sz, y: gy, r: 0.8, h: 3, obj: root })); else { pr.obj = root; if (pr.broken) root.rotation.x = -1.45; }
      });
    }
  }
  yield 'terreni';
  if (net.i.length) mkMesh(net, MAT.net, 10, false, G);
  yield 'terreni reti';
  if (drape.i.length) mkMesh(drape, MAT.mark, 2, false, G);
  yield 'terreni fondo';
  if (lines.i.length) mkMesh(lines, MAT.mark, 3, false, G);
  yield 'terreni linee';
  if (solid.i.length) mkMesh(solid, LMAT.trim, 10, 'cast', G);
  if (doors.i.length) mkMesh(doors, LS_DOOR_MAT, 10, false, G);
  if (glass.i.length) mkMesh(glass, LS_GLASS, 12, false, G);
  if (film.i.length) mkMesh(film, LS_FILM, 12, false, G);
  yield 'terreni pieni';
  const o3 = new THREE.Object3D(), inst = (geo, mat, list, sc, colOf) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); im.castShadow = true;
    list.forEach(([x, z, r], i) => { o3.position.set(x, H.ground(x, z), z); o3.rotation.set(0, r || 0, 0); const k = sc ? sc(x, z) : 1; o3.scale.set(k, k, k); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); if (colOf) im.setColorAt(i, COL(colOf(x, z))); });
    G.add(im); return im;
  };
  inst(LS_BALE_G, LS_BALE_M, bales);
  yield 'terreni balle';
  if (panels.length) { // building-site hoarding: one instance per panel, each knocked over on its own like the street lamps
    const im = new THREE.InstancedMesh(LS_PANEL_G, LS_PANEL_M, panels.length); im.castShadow = true;
    panels.forEach(([x0, z0, x1, z1, col], i) => {
      const L = hyp(x1 - x0, z1 - z0), x = (x0 + x1) / 2, z = (z0 + z1) / 2, gy = H.ground(x, z), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
      o3.position.set(x, gy, z); o3.rotation.set(0, ry, 0); o3.scale.set(L, 1, 1); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); im.setColorAt(i, COL(col));
      const id = T.t + ':' + i, p = LS_PANEL_PROPS.get(id);
      if (!p) LS_PANEL_PROPS.set(id, addProp({ x, z, y: gy, r: Math.min(1.1, L / 2), h: 2.1, inst: { meshes: [im], i, ry, base: gy, sx: L }, scav: true }));
      else { p.inst.meshes = [im]; if (p.broken) { o3.scale.set(0, 0, 0); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); } }
    });
    G.add(im);
  }
  yield 'terreni pannelli';
  lsOrchardMeshes(G, ftrees, H);
  yield 'terreni alberi';
  lsInstances(G, LS_POTP_G, pots); lsInstances(G, LS_BLOB_G, potPlants); lsInstances(G, LS_BLOB_G, crops); lsInstances(G, LS_STAKE_G, stakes); lsInstances(G, LS_FRUIT_G, fruitG.map(f => [f[0], f[1], f[2], 1.4, 1.4, 1.4, f[6]]));
  if (!T.lsDone) {
    for (const [x, z, r, hh] of solids) { const gy = H.ground(x, z); WALLS.add(x - r, z - r, x + r, z + r, { r, x, z, y0: gy - 3, y1: gy + hh }); }
    for (const [x, z] of bales) { const gy = H.ground(x, z); WALLS.add(x - 0.8, z - 0.8, x + 0.8, z + 0.8, { r: 0.75, x, z, y0: gy - 3, y1: gy + 1.5, sali: { rs: 0.55, top: gy + 1.5 } }); }
  }
  T.lsDone = true;
}
// a flat strip between two points, w wide, laid on the ground (a painted line, a dirt path)
function lsSeg(b, a, c, w, col, y) {
  const L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) return; const n = Math.max(1, Math.ceil(L / 3)), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L;
  for (let t = 0; t < n; t++) { const x0 = a[0] + (c[0] - a[0]) * t / n, z0 = a[1] + (c[1] - a[1]) * t / n, x1 = a[0] + (c[0] - a[0]) * (t + 1) / n, z1 = a[1] + (c[1] - a[1]) * (t + 1) / n, q = b.p.length / 3; for (const [px, pz, o] of [[x0, z0, -w], [x1, z1, -w], [x1, z1, w], [x0, z0, w]]) vtx(b, px - uz * o, y, pz + ux * o, 0, 1, 0, 0, 0, col); triUp(b, q, q + 1, q + 2); triUp(b, q, q + 2, q + 3); }
}
// a baseball field in the outline the map gives: the two long straight sides of the outline are the foul lines and meet at home plate; from there the
// diamond (27.4 m, shrunk if the lines are shorter), the infield in dirt with the grass inside, dirt round the bases and home, the mound, white
// lines, bases, and a backstop of mesh behind home
function lsBaseball(P, drape, lines, net, solid, box, solidAt) {
  const n = P.length, E = P.map((p, i) => { const c = P[(i + 1) % n]; return { i, L: hyp(c[0] - p[0], c[1] - p[1]) }; }).filter(e => e.L > 12).sort((a, b) => b.L - a.L);
  const e1 = E[0], e2 = E.find(e => e !== e1 && Math.abs(e.i - e1.i) > 1 && Math.abs(e.i - e1.i) < n - 1); if (!e1 || !e2) return;
  const dirOf = e => { const a = P[e.i], c = P[(e.i + 1) % n]; return [(c[0] - a[0]) / e.L, (c[1] - a[1]) / e.L, a, c]; };
  const [ax, az, a0, a1] = dirOf(e1), [bx, bz, b0, b1] = dirOf(e2), den = ax * bz - az * bx; if (Math.abs(den) < 0.2) return;
  const t = ((b0[0] - a0[0]) * bz - (b0[1] - a0[1]) * bx) / den, Hm = [a0[0] + ax * t, a0[1] + az * t]; /* the lines of the two sides meet at home */
  const far1 = hyp(a0[0] - Hm[0], a0[1] - Hm[1]) > hyp(a1[0] - Hm[0], a1[1] - Hm[1]) ? a0 : a1, far2 = hyp(b0[0] - Hm[0], b0[1] - Hm[1]) > hyp(b1[0] - Hm[0], b1[1] - Hm[1]) ? b0 : b1;
  let d1 = [far1[0] - Hm[0], far1[1] - Hm[1]], d2 = [far2[0] - Hm[0], far2[1] - Hm[1]]; const l1 = hyp(...d1), l2 = hyp(...d2); d1 = [d1[0] / l1, d1[1] / l1]; d2 = [d2[0] / l2, d2[1] / l2];
  const cosA = d1[0] * d2[0] + d1[1] * d2[1]; if (cosA > 0.5 || cosA < -0.5 || Math.min(l1, l2) < 14) return; /* about a right angle */
  const D = Math.min(27.43, 0.95 * Math.min(l1, l2)), sc = D / 27.43, bis = [d1[0] + d2[0], d1[1] + d2[1]], bl = hyp(...bis), u = [bis[0] / bl, bis[1] / bl];
  const at = (a, b) => [Hm[0] + d1[0] * a + d2[0] * b, Hm[1] + d1[1] * a + d2[1] * b], B1 = at(D, 0), B3 = at(0, D), B2 = at(D, D), M = [Hm[0] + u[0] * 18.44 * sc, Hm[1] + u[1] * 18.44 * sc];
  const DIRT = COL('#b88a5c'), WHITE = COL('#f4f2ea'), Rs = 24.5 * sc;
  /* the skin: from home, along every direction between the two lines, as far as the circle of 24.5 m round the mound */
  const a1_ = Math.atan2(d1[1], d1[0]); let da = Math.atan2(d2[1], d2[0]) - a1_; while (da > Math.PI) da -= TAU; while (da < -Math.PI) da += TAU;
  const skin = [[Hm[0] - u[0] * 4, Hm[1] - u[1] * 4]]; /* a little dirt behind home too */
  for (let k = 0; k <= 24; k++) { const th = a1_ + da * k / 24, dx = Math.cos(th), dz = Math.sin(th), px = Hm[0] - M[0], pz = Hm[1] - M[1], bq = px * dx + pz * dz, cq = px * px + pz * pz - Rs * Rs, r = -bq + Math.sqrt(Math.max(0, bq * bq - cq)); skin.push([Hm[0] + dx * r, Hm[1] + dz * r]); }
  const C = [(Hm[0] + B2[0]) / 2, (Hm[1] + B2[1]) / 2], toC = (p, d) => { const dx = C[0] - p[0], dz = C[1] - p[1], l = hyp(dx, dz) || 1; return [p[0] + dx / l * d, p[1] + dz / l * d]; };
  const hole = [toC(Hm, 6.5 * sc), toC(B1, 3.3 * sc), toC(B2, 3.3 * sc), toC(B3, 3.3 * sc)];
  const disc = (c, r, k = 14) => Array.from({ length: k }, (_, i) => [c[0] + Math.cos(i / k * TAU) * r, c[1] + Math.sin(i / k * TAU) * r]);
  try { polyFill(drape, skin, [hole], 0.05, 10, DIRT); polyFill(drape, disc(M, 2.74), [], 0.055, 10, DIRT); polyFill(drape, disc(Hm, 3.3 * sc + 0.4), [], 0.055, 10, DIRT); } catch (e) { return; }
  const ext1 = [Hm[0] + d1[0] * l1, Hm[1] + d1[1] * l1], ext2 = [Hm[0] + d2[0] * l2, Hm[1] + d2[1] * l2];
  lsSeg(lines, Hm, ext1, 0.07, WHITE, 0.07); lsSeg(lines, Hm, ext2, 0.07, WHITE, 0.07);
  for (const B of [B1, B2, B3]) box(0.5, 0.09, 0.5, B[0], H.ground(B[0], B[1]) + 0.045, B[1], '#f4f2ea', Math.atan2(u[0], u[1]));
  box(0.43, 0.09, 0.43, Hm[0], H.ground(Hm[0], Hm[1]) + 0.045, Hm[1], '#f4f2ea', Math.atan2(u[0], u[1]));
  box(0.6, 0.08, 0.15, M[0], H.ground(M[0], M[1]) + 0.1, M[1], '#f4f2ea', Math.atan2(u[0], u[1]) + Math.PI / 2);
  /* the backstop: an arc of mesh 4 m high, 6 m behind home, on posts every 2 m */
  const F0 = lmFrame(new THREE.Matrix4()), h = 4, R = 6, pts = []; for (let k = 0; k <= 8; k++) { const th = Math.atan2(-u[1], -u[0]) + (k / 8 - 0.5) * 2.4; pts.push([Hm[0] + Math.cos(th) * R, Hm[1] + Math.sin(th) * R]); }
  let acc = 0; for (let i = 0; i + 1 < pts.length; i++) { const p = pts[i], c = pts[i + 1], L = hyp(c[0] - p[0], c[1] - p[1]), g0 = H.ground(p[0], p[1]), g1 = H.ground(c[0], c[1]), j = net.p.length / 3, nx = (c[1] - p[1]) / L, nz = -(c[0] - p[0]) / L;
    vtx(net, p[0], g0, p[1], nx, 0, nz, acc / 2.6, 0); vtx(net, c[0], g1, c[1], nx, 0, nz, (acc + L) / 2.6, 0); vtx(net, c[0], g1 + h, c[1], nx, 0, nz, (acc + L) / 2.6, 1); vtx(net, p[0], g0 + h, p[1], nx, 0, nz, acc / 2.6, 1); net.i.push(j, j + 1, j + 2, j, j + 2, j + 3);
    F0.geo(solid, lmBox(0.1, h + 0.1, 0.1, p[0], g0 + h / 2, p[1]), null, COL('#3e4a42')); solidAt(p[0], p[1], 0.2, h);
    for (let t = 0.5; t < L; t += 0.5) solidAt(p[0] + (c[0] - p[0]) * t / L, p[1] + (c[1] - p[1]) * t / L, 0.15, h); acc += L; }
  { const q = pts[pts.length - 1]; F0.geo(solid, lmBox(0.1, h + 0.1, 0.1, q[0], H.ground(q[0], q[1]) + h / 2, q[1]), null, COL('#3e4a42')); solidAt(q[0], q[1], 0.2, h); }
}
// a skate park on its outline: a concrete floor, a quarter pipe at each end (the real curve, a deck on top, a steel coping), a fun box with two
// bevelled sides, a ledge, a rail on two legs, a short flight of steps; everything is solid (a ramp by the discs of its footprint, as high as it is there)
function lsSkate(A, P, drape, solid, box, solidAt) {
  const F0 = lmFrame(new THREE.Matrix4()), CON = '#a9a8a2', CON2 = '#b8b6ae', STEEL = '#8f949a', ry = Math.atan2(A.ux, A.uz);
  try { polyFill(drape, P, [], 0.05, 10, COL(CON)); } catch (e) { return; }
  const W = A.v1 - A.v0, L = A.s1 - A.s0, wv = Math.max(3, Math.min(8, W - 2.4)), vm = (A.v0 + A.v1) / 2, R = clamp(L * 0.09, 1.0, 1.6), DK = 1.2;
  const W3 = (s, v, y) => { const [x, z] = A.at(s, v); return [x, H.ground(x, z) + y, z]; };
  const both = (b, q, col) => { F0.face(b, q, 2, col); F0.face(b, q.slice().reverse(), 2, col); };
  for (const e of [-1, 1]) { /* e > 0: the ramp at the far end, its vertical face towards the end line */
    const sb = (e > 0 ? A.s1 : A.s0) - e * (R + DK + 0.5), N = 8, prof = [];
    for (let j = 0; j <= N; j++) { const f = j / N * Math.PI / 2; prof.push([sb + e * R * Math.sin(f), R - R * Math.cos(f)]); }
    for (let j = 0; j < N; j++) { const a = prof[j], c = prof[j + 1]; both(solid, [W3(a[0], vm - wv / 2, a[1]), W3(c[0], vm - wv / 2, c[1]), W3(c[0], vm + wv / 2, c[1]), W3(a[0], vm + wv / 2, a[1])], COL(CON2)); }
    for (const v of [vm - wv / 2, vm + wv / 2]) for (let j = 0; j < N; j++) { const a = prof[j], c = prof[j + 1]; both(solid, [W3(a[0], v, 0), W3(c[0], v, 0), W3(c[0], v, c[1]), W3(a[0], v, a[1])], COL(CON)); } /* the cheeks of the ramp */
    const [dx, dz] = A.at(sb + e * (R + DK / 2), vm); box(DK, R, wv, dx, H.ground(dx, dz) + R / 2, dz, CON2, ry - Math.PI / 2); /* the deck on top, solid down to the ground */
    lsRod(solid, W3(sb + e * R, vm - wv / 2 - 0.05, R + 0.03), W3(sb + e * R, vm + wv / 2 + 0.05, R + 0.03), 0.045, STEEL, 8); /* the coping */
    for (let v = vm - wv / 2 + 0.4; v <= vm + wv / 2 - 0.3; v += 0.8) {
      for (const [k, hh] of [[0.15, R * 0.12], [0.45, R * 0.35], [0.7, R * 0.7]]) { const [x, z] = A.at(sb + e * R * (1 - k), v); solidAt(x, z, 0.5, hh + 0.2); }
      const [x, z] = A.at(sb + e * (R + DK / 2), v); solidAt(x, z, 0.7, R);
    }
  }
  const fs = (A.s0 + A.s1) / 2, fv = vm + (W > 8 ? W * 0.12 : 0), [fx, fz] = A.at(fs, fv), fy = H.ground(fx, fz); /* the fun box */
  box(2.6, 0.45, 2.6, fx, fy + 0.225, fz, CON2, ry);
  for (const e of [-1, 1]) { const g = new THREE.BoxGeometry(1.6, 0.06, 2.6).rotateZ(e * 0.28).rotateY(ry - Math.PI / 2).translate(fx + Math.sin(ry) * e * 2.0, fy + 0.2, fz + Math.cos(ry) * e * 2.0); F0.geo(solid, g, null, COL(CON2)); }
  for (const o of [-1.3, 0, 1.3]) for (const t of [-1.3, 0, 1.3]) solidAt(fx + Math.sin(ry) * o + Math.cos(ry) * t, fz + Math.cos(ry) * o - Math.sin(ry) * t, 0.7, 0.45);
  const ls = A.s0 + L * 0.2, [lx0, lz0] = A.at(ls, A.v0 + 1.2), [lx1, lz1] = A.at(ls + 4.8, A.v0 + 1.2); /* a ledge */
  box(hyp(lx1 - lx0, lz1 - lz0), 0.42, 0.4, (lx0 + lx1) / 2, H.ground((lx0 + lx1) / 2, (lz0 + lz1) / 2) + 0.21, (lz0 + lz1) / 2, CON, ry + Math.PI / 2);
  for (let t = 0.4; t <= 4.5; t += 0.7) { const [x, z] = A.at(ls + t, A.v0 + 1.2); solidAt(x, z, 0.35, 0.45); }
  const [rx0, rz0] = A.at(ls + 8.5, A.v1 - 1.4), [rx1, rz1] = A.at(ls + 12.5, A.v1 - 1.4); /* a rail on two legs */
  if (inPoly(rx0, rz0, P) && inPoly(rx1, rz1, P)) {
    lsRod(solid, [rx0, H.ground(rx0, rz0) + 0.5, rz0], [rx1, H.ground(rx1, rz1) + 0.5, rz1], 0.035, STEEL, 8);
    for (const [x, z] of [[rx0, rz0], [rx1, rz1]]) lsRod(solid, [x, H.ground(x, z), z], [x, H.ground(x, z) + 0.5, z], 0.03, STEEL, 6);
    for (let k = 0; k <= 8; k++) solidAt(rx0 + (rx1 - rx0) * k / 8, rz0 + (rz1 - rz0) * k / 8, 0.12, 0.55);
  }
  for (let k = 0; k < 3; k++) { const [x, z] = A.at(A.s1 - L * 0.28 - k * 0.6, A.v0 + W * 0.3), hh = 0.18 * (3 - k); box(0.6, hh, 2.4, x, H.ground(x, z) + hh / 2, z, CON2, ry - Math.PI / 2); solidAt(x, z, 1.2, hh + 0.05); } /* three steps, solid */
}
// a skating rink (roller or ice) on its outline: a smooth floor, a white line inside, boards a metre high all round with a way in on the side nearest a street
function lsRink(A, P, ice, drape, lines, solid, box, solidAt) {
  try { polyFill(drape, P, [], 0.05, 10, COL(ice ? '#dcecf2' : '#a39b92')); } catch (e) { return; }
  const WH = COL(ice ? '#f4f2ea' : '#d9d6cf'); let gate = 0, gd = 1e9;
  P.forEach((p, i) => { const q = P[(i + 1) % P.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; let d = 1e9; ROADSEG.each(mx - 30, mz - 30, mx + 30, mz + 30, s => { d = Math.min(d, segDist(mx, mz, s.a[0], s.a[1], s.b[0], s.b[1])); }); if (d < gd && hyp(q[0] - p[0], q[1] - p[1]) > 3) { gd = d; gate = i; } });
  const In = lsGrow(P, -0.5); for (let i = 0; i < In.length; i++) lsSeg(lines, In[i], In[(i + 1) % In.length], 0.05, WH, 0.07);
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.2) continue;
    for (const [t0, t1] of i === gate && L > 3.2 ? [[0, L / 2 - 0.8], [L / 2 + 0.8, L]] : [[0, L]]) {
      if (t1 - t0 < 0.1) continue;
      const x0 = a[0] + (c[0] - a[0]) * t0 / L, z0 = a[1] + (c[1] - a[1]) * t0 / L, x1 = a[0] + (c[0] - a[0]) * t1 / L, z1 = a[1] + (c[1] - a[1]) * t1 / L, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, gy = H.ground(mx, mz), ry = Math.atan2(c[0] - a[0], c[1] - a[1]) - Math.PI / 2;
      box(t1 - t0, 0.5, 0.07, mx, gy + 0.25, mz, ice ? '#2f5f9a' : '#9a9690', ry); box(t1 - t0, 0.6, 0.07, mx, gy + 0.8, mz, '#e9e7e0', ry); box(t1 - t0 + 0.04, 0.06, 0.12, mx, gy + 1.13, mz, '#3a3d40', ry); /* a coloured kick plate, the white board, the rail on top */
      const n = Math.max(1, Math.ceil((t1 - t0) / 0.6)); for (let k = 0; k <= n; k++) solidAt(x0 + (x1 - x0) * k / n, z0 + (z1 - z0) * k / n, 0.2, 1.15);
    }
  }
}
// a shooting range on its outline (the long way is the way the shots go): at one end a roofed firing stand with a counter and low walls between the
// lanes, at the other a bank of earth across the field with a target frame at its foot per lane
function lsRange(A, P, solid, box, solidAt) {
  const L = A.s1 - A.s0, W = A.v1 - A.v0; if (L < 14 || W < 6) return;
  const ry = Math.atan2(A.ux, A.uz) - Math.PI / 2, lanes = clamp(Math.floor(W / 3), 2, 8), lw = (W - 1.6) / lanes, sS = A.s0 + 2.2, hS = 2.5, vm = (A.v0 + A.v1) / 2;
  const at = (s, v) => { const [x, z] = A.at(s, v); return [x, H.ground(x, z), z]; };
  { const [x, y, z] = at(sS + 1.2, vm); box(4.4, 0.18, W - 0.8, x, y + hS + 0.09, z, '#6b6e72', ry); } /* the roof */
  for (const v of [A.v0 + 0.6, A.v1 - 0.6]) for (const s of [sS - 0.8, sS + 3.2]) { const [x, y, z] = at(s, v); box(0.16, hS, 0.16, x, y + hS / 2, z, '#7d8288'); solidAt(x, z, 0.2, hS); } /* the posts */
  for (let k = 0; k <= lanes; k++) { const v = A.v0 + 0.8 + k * lw, [x, y, z] = at(sS + 1.0, v); box(2.8, 1.5, 0.08, x, y + 0.75, z, '#b8b3a8', ry + Math.PI / 2); for (let t = -1.2; t <= 1.2; t += 0.6) { const [qx, qz] = A.at(sS + 1.0 + t, v); solidAt(qx, qz, 0.2, 1.5); } } /* the walls between the lanes */
  { const [x, y, z] = at(sS - 0.1, vm); box(0.5, 1.05, W - 1.0, x, y + 0.525, z, '#8a6a4a', ry); for (let v = A.v0 + 1; v <= A.v1 - 1; v += 0.6) { const [qx, qz] = A.at(sS - 0.1, v); solidAt(qx, qz, 0.3, 1.05); } } /* the counter */
  const sE = A.s1 - 3.0; /* the bank of earth across the far end, in three steps up to 3 m */
  for (let j = 0; j < 3; j++) { const hh = [1.2, 2.2, 3.0][j], [x, y, z] = at(sE + 1.2, vm); box(2.4 - j * 0.5, hh, W - 0.4, x + A.ux * j * 0.45, y + hh / 2, z + A.uz * j * 0.45, j ? '#6d5a3e' : '#7a6444', ry); }
  for (let v = A.v0 + 0.8; v <= A.v1 - 0.8; v += 1.2) { const [qx, qz] = A.at(sE + 1.4, v); solidAt(qx, qz, 0.8, 2.6); }
  for (let k = 0; k < lanes; k++) { const v = A.v0 + 0.8 + (k + 0.5) * lw, [x, y, z] = at(sE - 1.0, v); box(0.05, 1.5, 0.05, x - 0.3, y + 0.75, z, '#7d8288'); box(0.05, 1.5, 0.05, x + 0.3, y + 0.75, z, '#7d8288'); box(0.04, 0.9, 0.62, x, y + 1.0, z, '#f4f2ea', ry + Math.PI / 2); box(0.045, 0.3, 0.3, x, y + 1.0, z, '#2a2d30', ry + Math.PI / 2); solidAt(x, z, 0.4, 1.5); } /* a target frame per lane */
}
// an outline moved d metres inward, with as many points as it had when it is a plain rectangle (mitred), else resampled and smoothed a little so the
// bends of a free-form shape do not fold; null when it has run out of room
function lsInset(P, d) {
  if (P.length <= 6) { const R = lsGrow(P, -d); return Math.abs(sArea(R)) > 0.15 * Math.abs(sArea(P)) && sArea(R) * sArea(P) > 0 && R.every(([x, z]) => inPoly(x, z, P)) ? R : null; }
  let S = lsResample(P, 1.2); for (let it = 0; it < 2; it++) S = S.map((p, i) => { const a = S[(i + S.length - 1) % S.length], c = S[(i + 1) % S.length]; return [(a[0] + 2 * p[0] + c[0]) / 4, (a[1] + 2 * p[1] + c[1]) / 4]; });
  const sg = sArea(S) < 0 ? -1 : 1, R = S.map((p, i) => { const a = S[(i + S.length - 1) % S.length], c = S[(i + 1) % S.length], tx = c[0] - a[0], tz = c[1] - a[1], l = hyp(tx, tz) || 1; return [p[0] - tz / l * sg * d, p[1] + tx / l * sg * d]; });
  return Math.abs(sArea(R)) > 0.1 * Math.abs(sArea(P)) && R.filter(([x, z]) => !inPoly(x, z, P)).length <= 0.03 * R.length ? R : null;
}
// a swimming pool: stone coping all round, the water in three bands going darker towards the middle, lane lines when it is long and straight, steel ladders
function lsPool(P, A, drape, lines, solid) {
  const F0 = lmFrame(new THREE.Matrix4()), area = Math.abs(sArea(P)), STONE = COL('#e9e4d6'); if (area < 4) return;
  const o0 = P.length <= 6 ? P : lsResample(P, 1.2), i0 = lsInset(P, 0.5); if (!i0) { try { polyFill(drape, P, [], 0.06, 10, COL('#4aa9cc')); } catch (e) { } return; }
  const ring = (R1, R2, col, y) => { const n = Math.min(R1.length, R2.length); for (let i = 0; i < n; i++) { const j = (i + 1) % n, q = drape.p.length / 3; for (const p of [R1[i], R1[j], R2[j], R2[i]]) vtx(drape, p[0], y, p[1], 0, 1, 0, 0, 0, col); drape.i.push(q, q + 1, q + 2, q, q + 2, q + 3, q, q + 2, q + 1, q, q + 3, q + 2); } };
  const outer = P.length <= 6 ? lsGrow(P, 0.35) : (lsInset(P, -0.35) || o0), polyOut = P.length <= 6 ? outer : outer;
  if (outer.length === i0.length) ring(outer, i0, STONE, 0.055);
  const bands = [[0.5, '#6cc6df', 0.058], [1.5, '#4aaed0', 0.061], [3.0, '#2f93bd', 0.064]]; let last = i0;
  try { polyFill(drape, i0, [], 0.058, 10, COL('#6cc6df')); } catch (e) { }
  for (const [d, col, y] of bands.slice(1)) { const r = lsInset(P, d); if (!r) break; try { polyFill(drape, r, [], y, 10, COL(col)); last = r; } catch (e) { break; } }
  void polyOut; void last;
  const rect = P.length <= 6 && isConvex(P), L = A.s1 - A.s0, W = A.v1 - A.v0; /* lane lines along a long straight pool */
  if (rect && L >= 18 && W >= 7) { const lanes = Math.floor((W - 1.2) / 2.2); for (let k = 1; k < lanes; k++) { const v = A.v0 + 0.6 + (W - 1.2) * k / lanes; lsSeg(lines, A.at(A.s0 + 0.9, v), A.at(A.s1 - 0.9, v), 0.07, COL('#1f5f8a'), 0.07); } for (let k = 0; k < lanes; k++) { const v = A.v0 + 0.6 + (W - 1.2) * (k + 0.5) / lanes; for (const s of [A.s0 + 0.9, A.s1 - 0.9]) lsSeg(lines, A.at(s - 0.0, v - 0.4), A.at(s - 0.0, v + 0.4), 0.06, COL('#1f5f8a'), 0.07); } }
  const nl = P.length, pick = rect ? [0, 2] : [0]; /* ladders at the middle of an edge */
  for (const e of pick) { const a = P[e % nl], c = P[(e + 1) % nl], L1 = hyp(c[0] - a[0], c[1] - a[1]); if (L1 < 1.5) continue; const ux = (c[0] - a[0]) / L1, uz = (c[1] - a[1]) / L1, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, gy = H.ground(mx, mz);
    for (const o of [-0.25, 0.25]) { const x = mx + ux * o, z = mz + uz * o; lsRod(solid, [x, gy + 0.9, z], [x, gy - 0.05, z], 0.022, '#d9dcde', 6); }
    for (const y of [0.2, 0.5, 0.8]) lsRod(solid, [mx - ux * 0.25, gy + y, mz - uz * 0.25], [mx + ux * 0.25, gy + y, mz + uz * 0.25], 0.015, '#d9dcde', 6); }
  void F0;
}
// a self-service car wash on its outline: a concrete slab, a back wall the length of the bays, a wall between the bays, a flat steel roof on posts over them,
// a lance post and a pay box in each bay (the lance on the back wall, the box by the wall at the side), a drain along the middle; open on the side towards the street
function lsWash(A, P, drape, solid, box, solidAt) {
  const L = A.s1 - A.s0, W = A.v1 - A.v0; if (L < 3.5 || W < 4) return;
  try { polyFill(drape, P, [], 0.05, 10, COL('#8d9094')); } catch (e) { return; }
  const ry = Math.atan2(A.ux, A.uz), n = clamp(Math.floor(L / 3.6), 1, 8), bw = Math.min(3.8, L / n), w = n * bw, s0 = (A.s0 + A.s1) / 2 - w / 2, dp = Math.min(6.2, W - 0.6);
  let dN = 1e9, dS = 1e9; for (const sg of [1, -1]) { const [x, z] = A.at((A.s0 + A.s1) / 2, (sg > 0 ? A.v1 : A.v0) + sg * 3); let d = 1e9; ROADSEG.each(x - 40, z - 40, x + 40, z + 40, s => { d = Math.min(d, segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1])); }); if (sg > 0) dN = d; else dS = d; }
  const front = dN < dS ? 1 : -1, vb = front > 0 ? A.v0 + 0.3 : A.v1 - 0.3, vf = vb + front * dp, vmid = (vb + vf) / 2; /* the open side is the one towards the street */
  const at = (s, v) => { const [x, z] = A.at(s, v); return [x, H.ground(x, z), z]; };
  const wallDisc = (s, v0, v1, h) => { const n2 = Math.max(1, Math.ceil(Math.abs(v1 - v0) / 0.6)); for (let k = 0; k <= n2; k++) { const [x, z] = A.at(s, v0 + (v1 - v0) * k / n2); solidAt(x, z, 0.2, h); } };
  { const [x, y, z] = at(s0 + w / 2, vb); box(w + 0.3, 3.0, 0.25, x, y + 1.5, z, '#c9c4b8', ry - Math.PI / 2); for (let s = s0; s <= s0 + w; s += 0.6) { const [qx, qz] = A.at(s, vb); solidAt(qx, qz, 0.25, 3.0); } } /* the back wall */
  for (let k = 0; k <= n; k++) { const s = s0 + k * bw, [x, y, z] = at(s, vb + front * dp * 0.35); box(0.2, 2.6, dp * 0.7, x, y + 1.3, z, '#d9dcde', ry); wallDisc(s, vb, vb + front * dp * 0.7, 2.6); /* a wall between bays, from the back */
    const [px, py, pz] = at(s, vf); box(0.22, 3.8, 0.22, px, py + 1.9, pz, '#7d8288'); solidAt(px, pz, 0.25, 3.8); } /* the post of the roof at the front */
  { const [x, y, z] = at(s0 + w / 2, vmid + front * 0.2); box(w + 0.6, 0.22, dp + 0.9, x, y + 3.85, z, '#e8e6e0', ry - Math.PI / 2); box(w + 0.62, 0.3, 0.12, ...(() => { const [fx, fy, fz] = at(s0 + w / 2, vf + front * 0.45); return [fx, fy + 3.78, fz]; })(), '#1d4f9a', ry - Math.PI / 2); } /* the roof and a coloured fascia at its edge */
  for (let k = 0; k < n; k++) {
    const sm = s0 + (k + 0.5) * bw, [dx, dy, dz] = at(sm, vmid); box(0.14, 0.02, dp * 0.8, dx, dy + 0.02, dz, '#3a3d40', ry); /* the drain */
    const [lx, ly, lz] = at(sm, vb + front * 0.5); box(0.5, 1.2, 0.2, lx, ly + 1.3, lz, '#3a3d40', ry - Math.PI / 2); lsRod(solid, [lx, ly + 2.4, lz], [lx, ly + 1.0, lz + A.uz * 0 + (front > 0 ? 0.25 : -0.25) * A.nz], 0.03, '#c9a227', 6); /* the panel on the back wall, the lance hanging from it */
    const [cx, cy, cz] = at(sm + bw / 2 - 0.4, vb + front * 1.6); box(0.5, 1.4, 0.3, cx, cy + 0.7, cz, '#8f949a', ry - Math.PI / 2); box(0.3, 0.25, 0.04, cx, cy + 1.15, cz, '#c9a227', ry - Math.PI / 2); solidAt(cx, cz, 0.3, 1.4); /* the pay box by the wall */
  }
  { const [x, y, z] = at(s0 + w + 1.4, vf - front * 0.6); if (inPoly(x, z, P)) { box(0.5, 1.8, 0.5, x, y + 0.9, z, '#8f949a'); solidAt(x, z, 0.4, 1.8); } } /* a vacuum post at the end */
}
// ---- athletics tracks. The outline of a track in the map is the oval and whatever hangs on it (run-ups, a straight of 100 m, jumping pits): the stadium
// (two straights and two half circles) is found in it by fitting two circles of the same radius to the points of the outline; what does not lie on them is
// ignored. A track that has no oval in it (a straight strip of lanes) is a rectangle of lanes. Nothing credible to draw: nothing drawn
const LS_LANE = 1.22, LS_LANES = 6;
function lsFitCircle(pts, idx) { /* least squares circle (Kasa) through the points idx */
  let sx = 0, sz = 0, n = idx.length; for (const i of idx) { sx += pts[i][0]; sz += pts[i][1]; } const mx = sx / n, mz = sz / n; let suu = 0, svv = 0, suv = 0, suuu = 0, svvv = 0, suvv = 0, svuu = 0;
  for (const i of idx) { const u = pts[i][0] - mx, v = pts[i][1] - mz; suu += u * u; svv += v * v; suv += u * v; suuu += u * u * u; svvv += v * v * v; suvv += u * v * v; svuu += v * u * u; }
  const det = suu * svv - suv * suv; if (Math.abs(det) < 1e-9) return null; const uc = (svv * (suuu + suvv) - suv * (svvv + svuu)) / (2 * det), vc = (suu * (svvv + svuu) - suv * (suuu + suvv)) / (2 * det);
  return { x: mx + uc, z: mz + vc, r: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) };
}
function lsStadium(P) { /* { c1, c2, r, ux, uz } or null */
  const pts = lsResample(P, 1.0); if (pts.length < 60) return null; let seed = Math.floor(Math.abs(P[0][0] * 7 + P[0][1] * 13) * 10) % 2147483647 || 1; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const find = (mask, rWant) => {
    let best = null; const ids = []; pts.forEach((_, i) => { if (mask[i]) ids.push(i); }); if (ids.length < 30) return null;
    for (let t = 0; t < 1500; t++) {
      const a = pts[ids[Math.floor(rnd() * ids.length)]], b = pts[ids[Math.floor(rnd() * ids.length)]], c = pts[ids[Math.floor(rnd() * ids.length)]];
      const d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1])); if (Math.abs(d) < 1e-6) continue;
      const ux = ((a[0] ** 2 + a[1] ** 2) * (b[1] - c[1]) + (b[0] ** 2 + b[1] ** 2) * (c[1] - a[1]) + (c[0] ** 2 + c[1] ** 2) * (a[1] - b[1])) / d, uz = ((a[0] ** 2 + a[1] ** 2) * (c[0] - b[0]) + (b[0] ** 2 + b[1] ** 2) * (a[0] - c[0]) + (c[0] ** 2 + c[1] ** 2) * (b[0] - a[0])) / d, r = hyp(a[0] - ux, a[1] - uz);
      if (r < 9 || r > 85 || (rWant && Math.abs(r - rWant) > 0.15 * rWant)) continue;
      let n = 0; for (const i of ids) if (Math.abs(hyp(pts[i][0] - ux, pts[i][1] - uz) - r) < 0.8) n++;
      if (!best || n > best.n) best = { x: ux, z: uz, r, n };
    }
    if (!best || best.n < 25) return null;
    const inl = ids.filter(i => Math.abs(hyp(pts[i][0] - best.x, pts[i][1] - best.z) - best.r) < 0.8), f = lsFitCircle(pts, inl); /* refined on its inliers */
    if (f && Math.abs(f.r - best.r) < 3) { best.x = f.x; best.z = f.z; best.r = f.r; }
    best.in = pts.map((p, i) => mask[i] && Math.abs(hyp(p[0] - best.x, p[1] - best.z) - best.r) < 1.0); return best;
  };
  const all = pts.map(() => true), c1 = find(all); if (!c1) return null;
  const m2 = pts.map((_, i) => !c1.in[i] && hyp(pts[i][0] - c1.x, pts[i][1] - c1.z) > c1.r * 0.5), c2 = find(m2, c1.r); if (!c2) return null;
  const d = hyp(c2.x - c1.x, c2.z - c1.z); if (d < 6) return null;
  const r = (c1.r + c2.r) / 2, ux = (c2.x - c1.x) / d, uz = (c2.z - c1.z) / d, S = { c1: [c1.x, c1.z], c2: [c2.x, c2.z], r, ux, uz, nx: -uz, nz: ux, d };
  let near = 0; for (const p of pts) { const s = clamp((p[0] - c1.x) * ux + (p[1] - c1.z) * uz, 0, d), px = c1.x + ux * s, pz = c1.z + uz * s; if (Math.abs(hyp(p[0] - px, p[1] - pz) - r) < 1.5) near++; }
  return near >= 0.55 * pts.length && r > LS_LANE * 2 + 3 ? S : null;
}
function lsInStadium(S, x, z, rho) { const s = clamp((x - S.c1[0]) * S.ux + (z - S.c1[1]) * S.uz, 0, S.d); return hyp(x - S.c1[0] - S.ux * s, z - S.c1[1] - S.uz * s) <= rho; }
function lsStadiumRing(S, rho, M = 18) { /* the stadium curve of radius rho: a half circle at c2, then one at c1; the straights are the closing edges */
  const out = []; for (const [c, a0] of [[S.c2, -Math.PI / 2], [S.c1, Math.PI / 2]]) for (let i = 0; i <= M; i++) { const a = a0 + Math.PI * i / M, ca = Math.cos(a), sa = Math.sin(a); out.push([c[0] + rho * (ca * S.ux + sa * S.nx), c[1] + rho * (ca * S.uz + sa * S.nz)]); }
  return out;
}
function lsTrack(kind, P, area, S, drape, lines) {
  const grass = kind.endsWith('grass'), RED = COL(grass ? '#6b8f3e' : '#b5543f'), Wc = COL('#f4f2ea');
  const quad = (a, b, c, d, col, y) => { const q = drape.p.length / 3; for (const p of [a, b, c, d]) vtx(drape, p[0], y, p[1], 0, 1, 0, 0, 0, col); drape.i.push(q, q + 1, q + 2, q, q + 2, q + 3, q, q + 2, q + 1, q, q + 3, q + 2); };
  const strip = (R1, R2, col, y) => { const n = R1.length; for (let i = 0; i < n; i++) { const j = (i + 1) % n, L = Math.max(hyp(R1[j][0] - R1[i][0], R1[j][1] - R1[i][1]), hyp(R2[j][0] - R2[i][0], R2[j][1] - R2[i][1])), k = Math.max(1, Math.ceil(L / 3)); for (let t = 0; t < k; t++) { const f0 = t / k, f1 = (t + 1) / k, mix = (A_, B_, f) => [A_[0] + (B_[0] - A_[0]) * f, A_[1] + (B_[1] - A_[1]) * f]; quad(mix(R1[i], R1[j], f0), mix(R1[i], R1[j], f1), mix(R2[i], R2[j], f1), mix(R2[i], R2[j], f0), col, y); } } };
  if (S) { /* the stadium: six lanes of constant width inside the outer radius */
    const lanes = Math.min(LS_LANES, Math.floor((S.r - 3) / LS_LANE)), rings = []; for (let k = 0; k <= lanes; k++) rings.push(lsStadiumRing(S, S.r - k * LS_LANE));
    for (let k = 0; k < lanes; k++) strip(rings[k], rings[k + 1], RED, 0.045);
    for (let k = 0; k <= lanes; k++) { const R_ = rings[k]; for (let i = 0; i < R_.length; i++) lsSeg(lines, R_[i], R_[(i + 1) % R_.length], k === 0 || k === lanes ? 0.06 : 0.04, Wc, 0.065); }
    const f = [S.c1[0] + S.ux * S.d * 0.5 + S.nx * (S.r), S.c1[1] + S.uz * S.d * 0.5 + S.nz * S.r], g = [S.c1[0] + S.ux * S.d * 0.5 + S.nx * (S.r - lanes * LS_LANE), S.c1[1] + S.uz * S.d * 0.5 + S.nz * (S.r - lanes * LS_LANE)]; lsSeg(lines, f, g, 0.08, Wc, 0.065); /* the finish line across the lanes, on the straight */
    return true;
  }
  const A = lsRect(P); if (!A) return false; const L = A.s1 - A.s0, W = A.v1 - A.v0; if (L < 20 || W < 2.4 || L < 2.5 * W) return false; /* a straight of lanes */
  const lanes = clamp(Math.round(W / LS_LANE), 1, 8), lw = W / lanes, c = (s, v) => A.at(s, v);
  /* the red in pieces of 3 m both ways: the mesh is draped by its vertices, one long quad would run flat under a rise of the ground (Carlo, 2/11: grass on the track at x -586 z -828) */
  for (let k = 0; k < lanes; k++) lsStrip(drape, A, A.s0, A.s1, A.v0 + lw * (k + 0.5), lw, RED, 0.045); /* lsStrip halves a piece where S rises over its chord */
  for (let k = 0; k <= lanes; k++) lsSeg(lines, c(A.s0, A.v0 + lw * k), c(A.s1, A.v0 + lw * k), k === 0 || k === lanes ? 0.06 : 0.04, Wc, 0.065);
  for (const s of [A.s0 + 0.15, A.s1 - 0.15]) lsSeg(lines, c(s, A.v0), c(s, A.v1), 0.06, Wc, 0.065);
  return true;
}
// ---- nurseries, allotments, orchards: small instanced models (one mesh per kind per tile), each instance [x, y, z, sx, sy, sz, colour]
const LS_BLOB_G = new THREE.IcosahedronGeometry(1, 1), LS_STAKE_G = (() => { const g = new THREE.CylinderGeometry(0.018, 0.018, 1, 5); g.translate(0, 0.5, 0); return g; })();
const LS_POTP_G = (() => { const g = new THREE.CylinderGeometry(0.17, 0.12, 0.28, 8); g.translate(0, 0.14, 0); return g; })(), LS_FRUIT_G = new THREE.IcosahedronGeometry(0.075, 0);
const LS_WHITE_M = new THREE.MeshLambertMaterial({ color: 0xffffff });
function lsInstances(G, geo, list, mat = LS_WHITE_M) {
  if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(); im.castShadow = true;
  list.forEach(([x, y, z, sx, sy, sz, col], i) => { o.position.set(x, y, z); o.rotation.set(0, (x * 12.9898 + z * 78.233) % TAU, 0); o.scale.set(sx, sy, sz); o.updateMatrix(); im.setMatrixAt(i, o.matrix); im.setColorAt(i, COL(col)); });
  G.add(im); return im;
}
const LS_FLOWERS = ['#e07aa0', '#f2c230', '#f4f2ea', '#8c6bb1', '#d94a3a'], LS_LEAFS = ['#4f7a35', '#5d8a3b', '#6b8f3e', '#47703a', '#7f9a45'];
// a nursery: gravel ground, beds of black fabric, two rows of potted shrubs on each (some in flower), a path between the beds
function lsNursery(A, P, drape, pots, potsPlants) {
  try { polyFill(drape, P, [], 0.04, 10, COL('#9a8f78')); } catch (e) { return; }
  for (let v = A.v0 + 1.4; v < A.v1 - 2.0; v += 2.5) for (const [a, b] of lsSpans(A.Q, v + 0.45)) {
    if (b - a < 3) continue; lsStrip(drape, A, a + 0.5, b - 0.5, v + 0.45, 1.8, COL('#34383a'), 0.05);
    for (let s = a + 0.9; s < b - 0.8; s += 0.62) for (const dv of [0, 0.9]) {
      const [x, z] = A.at(s, v + dv); if (pots.length >= 1400 || !lsFreeAt(x, z, 0.4) || !inPoly(x, z, P)) continue; const y = H.ground(x, z), h = LS_HASH(x, z, 'viv');
      pots.push([x, y, z, 1, 1, 1, '#b5603f']);
      const r = 0.24 + h * 0.2, flower = h > 0.82; potsPlants.push([x, y + 0.42 + r * 0.45, z, r, r * 0.85, r, flower ? LS_FLOWERS[Math.floor(LS_HASH(x, z, 'fl') * LS_FLOWERS.length)] : LS_LEAFS[Math.floor(h * 5) % 5]]);
    }
  }
}
// an allotment garden: the whole ground trodden earth, plots of 6 x 8 m with four raised beds each (cabbages, lettuces, tomatoes on stakes, beans on poles),
// a shed or a water butt in some
function lsGarden(A, P, drape, solid, box, solidAt, crops, stakes, fruit) {
  try { polyFill(drape, P, [], 0.04, 10, COL('#8f8465')); } catch (e) { }
  const soil = COL('#4f3a2a'), F0 = lmFrame(new THREE.Matrix4()), ry = Math.atan2(A.ux, A.uz);
  for (let s = A.s0 + 1; s < A.s1 - 6; s += 6.8) for (let v = A.v0 + 1; v < A.v1 - 7; v += 8.8) {
    const [mx, mz] = A.at(s + 3, v + 4); if (!inPoly(mx, mz, P) || !lsFreeAt(mx, mz, 3)) continue; const hp = LS_HASH(mx, mz, 'orto');
    for (let b = 0; b < 4; b++) {
      const v0 = v + 0.35 + b * 1.65, kind = Math.floor(LS_HASH(mx + b, mz, 'col') * 4), n = Math.floor(5.2 / [0.55, 0.32, 0.8, 0.7][kind]);
      lsStrip(drape, A, s + 0.3, s + 5.7, v0 + 0.5, 1.05, soil, 0.05);
      for (let k = 0; k < n; k++) {
        const t = s + 0.55 + k * 5 / n, [x, z] = A.at(t, v0 + 0.5), y = H.ground(x, z), hh = LS_HASH(x, z, 'pl');
        if (kind === 0) crops.push([x, y + 0.18, z, 0.24, 0.2, 0.24, ['#7d9b6b', '#5f8a4a', '#8fae7a'][Math.floor(hh * 3)]]);
        else if (kind === 1) crops.push([x, y + 0.08, z, 0.15, 0.08, 0.15, ['#9ac25a', '#b45f4a', '#7fb04a'][Math.floor(hh * 3)]]);
        else if (kind === 2) { stakes.push([x, y, z, 1, 1.5, 1, '#b79a6a']); crops.push([x, y + 0.75, z, 0.28, 0.45, 0.28, '#4f7a35']); if (hh > 0.3) fruit.push([x + 0.12, y + 0.35 + hh * 0.5, z + 0.05, 1, 1, 1, '#d33a2a'], [x - 0.1, y + 0.55 + hh * 0.4, z - 0.08, 1, 1, 1, '#d94a3a']); }
        else { stakes.push([x, y, z, 1, 1.9, 1, '#b79a6a']); crops.push([x, y + 1.05, z, 0.18, 0.75, 0.18, '#5d8a3b']); }
      }
    }
    const [px, pz] = A.at(s + 5.6, v + 7.6);
    if (hp > 0.6) { const col = ['#7a6a52', '#6b7a6b', '#8f949a', '#5a4a3a'][Math.floor(hp * 40) % 4]; box(1.8, 2.0, 1.4, px, H.ground(px, pz) + 1.0, pz, col, ry); box(2.1, 0.08, 1.7, px, H.ground(px, pz) + 2.05, pz, '#4a4d52', ry); solidAt(px, pz, 1.1, 2.1); }
    else if (hp > 0.35) { F0.geo(solid, new THREE.CylinderGeometry(0.5, 0.5, 1.1, 12).translate(px, H.ground(px, pz) + 0.55, pz), null, COL('#2a6fb0')); solidAt(px, pz, 0.55, 1.1); }
  }
}
// an orchard: rows of small fruit trees (the small-tree model, its plain stem, so no branch shows through a narrow crown), a disc of bare earth under each,
// and the fruit hanging low on the crown
function lsOrchard(A, P, drape, ftrees, solidAt) {
  const pal = [['#c0261c', '#d8452e', '#e0b13a'], ['#e8821e', '#f0a030', '#d96a1a'], ['#b9c43e', '#cdd04a', '#a5b832'], ['#7a1f2e', '#a02a3a', '#c24a52']][Math.floor(LS_HASH(A.cx, A.cz, 'pal') * 4)];
  for (let v = A.v0 + 2.8; v < A.v1 - 2; v += 5.2) for (const [a, b] of lsSpans(A.Q, v)) for (let s = a + 2.6; s < b - 2; s += 3.6) {
    const [x, z] = A.at(s, v); if (ftrees.length >= 360 || !lsFreeAt(x, z, 1.2) || !inPoly(x, z, P)) continue; const h = LS_HASH(x, z, 'ft');
    ftrees.push({ x, z, th: 3.0 + h * 1.0, v: Math.floor(LS_HASH(x, z, 'fv') * 3), g: Math.floor(LS_HASH(x, z, 'fg') * 3), pal, nf: 12 + Math.floor(h * 10) }); solidAt(x, z, 0.22, 3);
    try { const d = Array.from({ length: 10 }, (_, i) => [x + Math.cos(i / 10 * TAU) * 1.0, z + Math.sin(i / 10 * TAU) * 1.0]); polyFill(drape, d, [], 0.045, 10, COL('#6a5640')); } catch (e) { }
  }
}
function lsOrchardMeshes(G, ftrees, H) {
  if (!ftrees.length) return; const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), fruits = [];
  for (let v = 0; v < 3; v++) {
    const list = ftrees.filter(t => t.v === v); if (!list.length) continue;
    const probe = new THREE.Mesh(TREE_G.crownS[v], new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })); probe.matrixAutoUpdate = false; /* the real crown, to throw rays at */
    const leafA = TREE_LEAF.image, leafAt = u => { const x = Math.min(leafA.width - 1, Math.max(0, Math.floor(u.x * leafA.width))), y = Math.min(leafA.height - 1, Math.max(0, Math.floor(u.y * leafA.height))); return leafA.data[(y * leafA.width + x) * 4 + 3]; }; /* alpha of the leaf atlas at a uv */
    const ray = new THREE.Raycaster(), ro = new THREE.Vector3(), rd = new THREE.Vector3(), FR = 0.075 * 2; /* a fruit is 0.15 m across */
    const tr = new THREE.InstancedMesh(TREE_G.trunkS, MAT.trunk, list.length), cr = new THREE.InstancedMesh(TREE_G.crownS[v], MAT.crown, list.length);
    list.forEach((t, j) => {
      const gy = H.ground(t.x, t.z), th = t.th, yb = Math.max(0.7, 0.3 * th), hc = th - yb, D = th + 0.8, sx = D / 5.4, sy = hc / 4.5, yc = th - 2.5 * sy;
      q.identity(); m.compose(p.set(t.x, gy, t.z), q, s.set(0.5, yb + 0.65 * hc, 0.5)); tr.setMatrixAt(j, m);
      m.compose(p.set(t.x, gy + yc, t.z), q, s.set(sx, sy, sx)); cr.setMatrixAt(j, m); cr.setColorAt(j, COL(GREENS[t.g]));
      probe.matrix.copy(m); probe.matrixWorld.copy(m); ro.set(t.x, gy + yc, t.z);
      for (let k = 0; k < t.nf; k++) { /* a fruit: a ray from the middle of the crown outward, against the real crown with this instance's matrix; the farthest hit on a visible leaf (not a clear corner of a card) is the surface, and the fruit sits half its width plus 5 cm in from it, half inside the leaves */
        const ly = -0.78 + LS_HASH(t.x + k, t.z, 'fr') * 1.0, rr = Math.sqrt(1 - ly * ly), ph = LS_HASH(t.x, t.z + k, 'ph') * TAU; rd.set(Math.cos(ph) * rr * sx, ly * sy, Math.sin(ph) * rr * sx).normalize(); ray.set(ro, rd);
        const hits = ray.intersectObject(probe, false); let hit = null; for (let h = hits.length - 1; h >= 0; h--) if (!hits[h].uv || leafAt(hits[h].uv) >= 128) { hit = hits[h]; break; } if (!hit) continue;
        const d = Math.max(0, hit.distance - FR / 2 - 0.05); fruits.push([ro.x + rd.x * d, ro.y + rd.y * d, ro.z + rd.z * d, 1, 1, 1, t.pal[k % 3]]); }
    });
    tr.castShadow = cr.castShadow = true; cr.receiveShadow = true; cr.customDepthMaterial = TREE_DEPTH; G.add(tr, cr);
  }
  lsInstances(G, LS_FRUIT_G, fruits);
}
// a net that is a net: thin pale threads on clear cloth (goals, hoops, tennis and volleyball), unlike the dark fence mesh
const LS_RETE = new THREE.MeshLambertMaterial({ map: canvasTex(32, 32, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#eceff0'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); }), alphaTest: 0.12, side: THREE.DoubleSide, color: 0xffffff });
// ---- pitches: the lines of the game the map says, and the gear of that game in its place (frame = the minimum rectangle of the polygon):
// goals at the middle of the two SHORT sides, on the end line, net behind them and inside the polygon; hoops on the short sides too;
// a net across the middle of a tennis or volleyball court. Only the sport the map names (the first of a list), nothing mixed on top of it
function lsPitch(A0, P, sport, surface, lines, solid, box, cyl, G, solidAt, stadiaL = []) {
  let A = lsRect(P); if (!A) return;
  for (const S of stadiaL) if (lsInStadium(S, A.cx, A.cz, S.r)) { /* a pitch inside a track stays inside its lanes: shrunk until its corners are */
    const rho = S.r - LS_LANES * LS_LANE - 1.4; let k = 1; for (; k > 0.45; k -= 0.02) { const hs = (A.s1 - A.s0) / 2 * k, hv = (A.v1 - A.v0) / 2 * k; if ([[-hs, -hv], [hs, -hv], [hs, hv], [-hs, hv], [0, -hv], [0, hv]].every(([a, b]) => { const [x, z] = A.at(a, b); return lsInStadium(S, x, z, rho); })) break; }
    if (k < 1) A = { ...A, s0: A.s0 * k, s1: A.s1 * k, v0: A.v0 * k, v1: A.v1 * k }; break; }
  const W = COL('#f4f2ea'), Ls = A.s1 - A.s0, Wv = A.v1 - A.v0, sm = 0, vm = 0;
  if (Ls < 6 || Wv < 4) return;
  const S = (a, b) => A.at(sm + a, vm + b), line = (a0, b0, a1, b1, w = 0.1) => lsLine(lines, A, sm + a0, vm + b0, sm + a1, vm + b1, w, W);
  const rect = (hl, hw) => { line(-hl, -hw, hl, -hw); line(hl, -hw, hl, hw); line(hl, hw, -hl, hw); line(-hl, hw, -hl, -hw); };
  const circle = (a, b, r, from = 0, to = TAU) => { const n = Math.max(8, Math.ceil(r * 3)); for (let k = 0; k < n; k++) { const t0 = from + (to - from) * k / n, t1 = from + (to - from) * (k + 1) / n; line(a + Math.cos(t0) * r, b + Math.sin(t0) * r, a + Math.cos(t1) * r, b + Math.sin(t1) * r, 0.08); } };
  const gyAt = (a, b) => { const [x, z] = S(a, b); return [x, H.ground(x, z), z]; };
  /* the floor: what the map says (grass stays grass, the pitch of a game on grass has none to draw); a game that is played on a hard court gets paving when the map does not say, never the grass under it (Carlo, 2/11) */
  const SURF = { clay: '#c0663f', sand: '#e2cf9a', artificial_turf: '#5e9a4a', asphalt: '#6e7378', concrete: '#9a9a96', paved: '#9a9a96', 'paving_stones': '#9a9a96', tartan: '#b5523c', acrylic: '#3f6e9a', rubber: '#a8503c', dirt: '#a98d6a', ground: '#a98d6a', unpaved: '#a98d6a', compacted: '#a98d6a', gravel: '#b2a58c', fine_gravel: '#b2a58c', wood: '#b88a52', carpet: '#5e9a4a' };
  const HARD = new Set(['basketball', 'multi', 'tennis', 'volleyball', 'futsal', 'handball', 'five-a-side', 'netball', 'badminton', 'table_tennis', 'padel', 'skateboard', 'roller_skating']), SANDY = new Set(['beachvolleyball']);
  const surf = surface === 'grass' ? null : SURF[surface] || (HARD.has(sport) ? '#6e7378' : SANDY.has(sport) ? '#e2cf9a' : (sport === 'boules' || sport === 'bowls') ? '#c2aa82' : null);
  if (surf) { try { const sb = VBuf(); polyFill(sb, P, [], 0.05, 10, COL(surf)); mkMesh(sb, MAT.mark, 2, false, G); } catch (e) { } }
  const rec = window.__CAMPI ? { sport, surface, P, rc: [A.cx, A.cz, A.ux, A.uz, A.s1, A.v1], it: [] } : null; if (rec) window.__CAMPI.push(rec);
  const F0 = lmFrame(new THREE.Matrix4()), gnet = Buf(), V3 = THREE.Vector3, Y = new V3(0, 1, 0);
  const geo = (g, col) => F0.geo(solid, g, null, COL(col));
  const tube = (p, q, r, col, seg = 6) => { const dx = q[0] - p[0], dy = q[1] - p[1], dz = q[2] - p[2], L = Math.hypot(dx, dy, dz); if (L < 1e-3) return; const g = new THREE.CylinderGeometry(r, r, L, seg); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(Y, new V3(dx / L, dy / L, dz / L)))); g.translate((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, (p[2] + q[2]) / 2); geo(g, col); };
  const quad = (a, b, c, d) => { /* a net panel: corners in order, the thread grid laid by metres (cell 0.2 m) */
    const i = gnet.p.length / 3, e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]], e2 = [d[0] - a[0], d[1] - a[1], d[2] - a[2]];
    let nx = e1[1] * e2[2] - e1[2] * e2[1], ny = e1[2] * e2[0] - e1[0] * e2[2], nz = e1[0] * e2[1] - e1[1] * e2[0]; const nl = Math.hypot(nx, ny, nz) || 1; nx /= nl; ny /= nl; nz /= nl;
    const dist = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1], q[2] - p[2]) / 0.2, wb = dist(a, b), wc = dist(d, c), hh = dist(a, d);
    vtx(gnet, a[0], a[1], a[2], nx, ny, nz, 0, 0); vtx(gnet, b[0], b[1], b[2], nx, ny, nz, wb, 0); vtx(gnet, c[0], c[1], c[2], nx, ny, nz, wc, hh); vtx(gnet, d[0], d[1], d[2], nx, ny, nz, 0, hh); gnet.i.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  const free = (x, z) => inPoly(x, z, P) && !onAnyRoad(x, z, 0.2);
  /* a goal on the end line at (s, 0): its back points away from the pitch; w wide, h high, d0 deep at the foot, d1 deep at the top */
  const goal = (e, s, w, h, d0, d1, r) => {
    const [cx, , cz] = gyAt(s, 0), bx = A.ux * e, bz = A.uz * e, ax = A.nx, az = A.nz, hw_ = w / 2;
    const at = (o, back, y) => { const x = cx + ax * o + bx * back, z = cz + az * o + bz * back; return [x, H.ground(x, z) + y, z]; };
    const chk = [at(-hw_, 0, 0), at(hw_, 0, 0), at(-hw_, d0, 0), at(hw_, d0, 0), at(0, d0, 0)];
    if (!chk.every(p => free(p[0], p[2]))) return false;
    const pl = at(-hw_, 0, 0), pr = at(hw_, 0, 0), plt = at(-hw_, 0, h), prt = at(hw_, 0, h), tl = at(-hw_, d1, h), tr = at(hw_, d1, h), bl = at(-hw_, d0, 0), br = at(hw_, d0, 0);
    const BAR = '#f4f2ea', RAIL = '#d3d7da', rr = r * 0.55;
    tube(pl, plt, r, BAR, 8); tube(pr, prt, r, BAR, 8); tube(plt, prt, r, BAR, 8); /* two posts and the crossbar, round and white */
    tube(plt, tl, rr, RAIL); tube(prt, tr, rr, RAIL); tube(tl, tr, rr, RAIL); /* the top frame going back */
    tube(tl, bl, rr, RAIL); tube(tr, br, rr, RAIL); /* the back stays, down to the ground */
    tube(pl, bl, rr, RAIL); tube(pr, br, rr, RAIL); tube(bl, br, rr, RAIL); /* the ground frame */
    quad(pl, plt, tl, bl); quad(pr, prt, tr, br); quad(tl, tr, br, bl); quad(plt, prt, tr, tl); /* the net: two sides, the back, the roof */
    solidAt(pl[0], pl[2], r + 0.05, h); solidAt(pr[0], pr[2], r + 0.05, h);
    /* the net is a wall too (Carlo, 25/10: "niente di attraversabile"): the two sides and the back stop a car or a person, little discs every 0.4 m;
       the mouth stays open, the frame stops what goes in */
    const wall = (p, q, hh) => { const n = Math.max(1, Math.ceil(Math.hypot(q[0] - p[0], q[2] - p[2]) / 0.4)); for (let k = 1; k <= n; k++) { const t = k / n; solidAt(p[0] + (q[0] - p[0]) * t, p[2] + (q[2] - p[2]) * t, 0.12, hh); } };
    wall(pl, bl, h); wall(pr, br, h); wall(bl, br, h);
    lsAud(rec, 'porta', cx, cz); return true;
  };
  const hw = Wv / 2 - 0.6;
  if (sport === 'soccer' || sport === 'five-a-side' || sport === 'futsal' || sport === 'handball') {
    /* goals by the pitch width: 11-a-side 7.32 x 2.44 from 45 m, 7-a-side 6 x 2 from 25 m, five-a-side 3 x 2 below */
    const big = sport === 'soccer' && Wv >= 45, seven = sport === 'soccer' && !big && Wv >= 25;
    const gw = Math.min(big ? 7.32 : seven ? 6 : 3, Wv * 0.5), gh = big ? 2.44 : 2, d0 = big ? 2.0 : seven ? 1.5 : 1.1, d1 = big ? 0.9 : seven ? 0.7 : 0.5, hl = Ls / 2 - 0.5 - d0;
    if (hl < 3) return;
    rect(hl, hw); line(0, -hw, 0, hw); circle(0, 0, Math.min(9.15, hw * 0.3));
    const pd = Math.min(16.5, hl * 0.3), pw = Math.min(20.15, hw * 0.6);
    for (const e of [-1, 1]) {
      line(e * hl, -pw, e * (hl - pd), -pw); line(e * (hl - pd), -pw, e * (hl - pd), pw); line(e * (hl - pd), pw, e * hl, pw);
      for (let k = 0; k < 4; k++) if (goal(e, e * (hl - 0.5 * k), gw, gh, d0, d1, big ? 0.06 : 0.05)) break; /* if the back falls outside the polygon, the goal moves in a little */
    }
  } else if (sport === 'basketball' || sport === 'multi') { /* a generic multi-sport court gets just the two hoops */
    const cl = Math.min(14, Ls / 2 - 1.5 - 1.0), cw = Math.min(7.5, hw); if (cl < 4) return;
    rect(cl, cw); line(0, -cw, 0, cw); circle(0, 0, 1.8);
    for (const e of [-1, 1]) {
      line(e * cl, -2.45, e * (cl - 5.8), -2.45); line(e * (cl - 5.8), -2.45, e * (cl - 5.8), 2.45); line(e * (cl - 5.8), 2.45, e * cl, 2.45); circle(e * (cl - 5.8), 0, 1.8, e > 0 ? Math.PI / 2 : -Math.PI / 2, e > 0 ? Math.PI * 1.5 : Math.PI / 2);
      const [px, py, pz] = gyAt(e * (cl + 1.0), 0), [bx, , bz] = gyAt(e * (cl - 1.2), 0), [rx, , rz] = gyAt(e * (cl - 1.6), 0);
      if (!free(px, pz) || !free(bx, bz)) continue;
      cyl(0.08, 3.5, px, py + 1.75, pz, '#3a3d40', 8); /* the pole behind the baseline */
      tube([px, py + 3.3, pz], [bx, py + 3.3, bz], 0.04, '#3a3d40'); /* the arm to the board */
      box(1.8, 1.05, 0.05, bx, py + 3.45, bz, '#f4f2ea', Math.atan2(-A.ux, -A.uz)); /* the board faces along the court: wide across it, thin along it */
      geo(new THREE.TorusGeometry(0.23, 0.02, 6, 16).rotateX(Math.PI / 2).translate(rx, py + 3.05, rz), '#e86a2a'); /* the rim */
      for (let k = 0; k < 10; k++) { const t0 = k / 10 * TAU, t1 = (k + 1) / 10 * TAU; quad([rx + Math.cos(t0) * 0.23, py + 3.05, rz + Math.sin(t0) * 0.23], [rx + Math.cos(t1) * 0.23, py + 3.05, rz + Math.sin(t1) * 0.23], [rx + Math.cos(t1) * 0.14, py + 2.65, rz + Math.sin(t1) * 0.14], [rx + Math.cos(t0) * 0.14, py + 2.65, rz + Math.sin(t0) * 0.14]); } /* the cord net under it */
      solidAt(px, pz, 0.15, 3.5); lsAud(rec, 'canestro', px, pz);
    }
  } else if (sport === 'tennis' || sport === 'volleyball' || sport === 'beachvolleyball') {
    const ten = sport === 'tennis', cl = Math.min(ten ? 11.885 : 9, Ls / 2 - 0.6), cw = Math.min(ten ? 5.485 : 4.5, hw);
    if (ten) { const sw = cw * 4.115 / 5.485; rect(cl, cw); line(-cl, -sw, cl, -sw); line(-cl, sw, cl, sw); for (const e of [-1, 1]) line(e * cl * 6.4 / 11.885, -sw, e * cl * 6.4 / 11.885, sw); line(-cl * 6.4 / 11.885, 0, cl * 6.4 / 11.885, 0); }
    else { rect(cl, cw); line(0, -cw, 0, cw); }
    /* the net across the middle of the court, from one post to the other, dividing it in two halves: 0.914 m at the centre and 1.07 m at the posts for tennis, 2.43 m for volleyball */
    const half = Math.min(cw + (ten ? 0.9 : 0.6), Wv / 2 - 0.2), post = ten ? 1.07 : 2.55, N_ = 8, top = t => ten ? 0.914 + (1.07 - 0.914) * (t / half) ** 2 : 2.43, bot = t => ten ? 0.03 : 2.43 - 1.0;
    const pt = (t, y) => { const [x, z] = S(0, t); return [x, H.ground(x, z) + y, z]; };
    if (free(...S(0, -half)) && free(...S(0, half))) {
      for (const o of [-half, half]) { const [x, , z] = pt(o, 0); tube(pt(o, 0), pt(o, post), 0.05, '#3a3d40', 8); solidAt(x, z, 0.1, post); lsAud(rec, 'rete', x, z); }
      { const n = Math.ceil(2 * half / 0.4); for (let k = 1; k < n; k++) { const [x, , z] = pt(-half + 2 * half * k / n, 0); solidAt(x, z, 0.1, ten ? 0.95 : 2.43); } } /* the net itself stops what goes into it (Carlo: niente di attraversabile) */
      for (let k = 0; k < N_; k++) { const t0 = -half + 2 * half * k / N_, t1 = -half + 2 * half * (k + 1) / N_; quad(pt(t0, bot(t0)), pt(t1, bot(t1)), pt(t1, top(t1)), pt(t0, top(t0))); tube(pt(t0, top(t0)), pt(t1, top(t1)), 0.025, '#f4f2ea'); }
    }
  } else if (sport === 'boules' || sport === 'bowls') { /* the boards round a bocce court */
    const hl = Ls / 2 - 0.6;
    for (const a of [-hl * 0.5, 0, hl * 0.5]) line(a, -hw, a, hw); /* the lines across the court (the jack line, the middle) */
    for (const [a0, b0, a1, b1] of [[-hl, -hw, hl, -hw], [-hl, hw, hl, hw], [-hl, -hw, -hl, hw], [hl, -hw, hl, hw]]) { const [x0, y0, z0] = gyAt(a0, b0), [x1, , z1] = gyAt(a1, b1); box(hyp(x1 - x0, z1 - z0) + 0.2, 0.3, 0.12, (x0 + x1) / 2, y0 + 0.15, (z0 + z1) / 2, '#8a6a4a', Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2); }
  }
  if (gnet.i.length) mkMesh(gnet, LS_RETE, 11, false, G);
}
// what the information boards say: write the lines here (one string per board, picked by place); empty, they show a map of the town
const PANNELLI = [];
function lsTown(x, z) { let best = null, bd = 1e18; for (const p of PLACES) if (p.k === 'town' || p.k === 'village') { const d = hyp(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.n; } } return best; }
// a mesh fence round a polygon, a 1.4 m way in on edge `gate`, posts every 2.5 m (net: the fence texture, both sides)
function lsFence(net, solid, P, h, gate, postCol) {
  const F0 = lmFrame(new THREE.Matrix4()); let acc = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.1) continue;
    const parts = i === gate ? [[0, L / 2 - 0.7], [L / 2 + 0.7, L]] : [[0, L]];
    for (const [t0, t1] of parts) {
      if (t1 - t0 < 0.1) continue; const x0 = a[0] + (c[0] - a[0]) * t0 / L, z0 = a[1] + (c[1] - a[1]) * t0 / L, x1 = a[0] + (c[0] - a[0]) * t1 / L, z1 = a[1] + (c[1] - a[1]) * t1 / L, g0 = H.ground(x0, z0), g1 = H.ground(x1, z1), j = net.p.length / 3, nx = (z1 - z0) / (t1 - t0), nz = -(x1 - x0) / (t1 - t0);
      vtx(net, x0, g0, z0, nx, 0, nz, (acc + t0) / 2.6, 0); vtx(net, x1, g1, z1, nx, 0, nz, (acc + t1) / 2.6, 0); vtx(net, x1, g1 + h, z1, nx, 0, nz, (acc + t1) / 2.6, 1); vtx(net, x0, g0 + h, z0, nx, 0, nz, (acc + t0) / 2.6, 1); net.i.push(j, j + 1, j + 2, j, j + 2, j + 3);
      for (let t = t0; t <= t1 + 0.01; t += 2.5) { const x = a[0] + (c[0] - a[0]) * Math.min(t, t1) / L, z = a[1] + (c[1] - a[1]) * Math.min(t, t1) / L; F0.geo(solid, lmBox(0.06, h + 0.05, 0.06, x, H.ground(x, z) + h / 2, z), null, COL(postCol)); }
    }
    acc += L;
  }
}
// a wooden post-and-rail fence round a polygon, open on edge `gate`
function lsRail(solid, P, gate, box) {
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.5 || i === gate && L < 4) continue; const ry = Math.atan2(c[0] - a[0], c[1] - a[1]) - Math.PI / 2;
    for (const [t0, t1] of i === gate ? [[0, L / 2 - 1.5], [L / 2 + 1.5, L]] : [[0, L]]) {
      const x0 = a[0] + (c[0] - a[0]) * t0 / L, z0 = a[1] + (c[1] - a[1]) * t0 / L, x1 = a[0] + (c[0] - a[0]) * t1 / L, z1 = a[1] + (c[1] - a[1]) * t1 / L, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, gy = H.ground(mx, mz);
      for (const y of [0.55, 1.1]) box(t1 - t0, 0.1, 0.06, mx, gy + y, mz, '#8a6a4a', ry);
      for (let t = t0; t <= t1; t += 2.5) { const x = a[0] + (c[0] - a[0]) * t / L, z = a[1] + (c[1] - a[1]) * t / L; box(0.12, 1.3, 0.12, x, H.ground(x, z) + 0.65, z, '#6b4f3a'); }
    }
  }
}
// a water tower: a shaft, the tank on it shaped like a bowl ("a fungo") widening to r, a short band, the low cone of its roof; r is the radius
// of the tank, h the height. The tower of Meda (MN_IND 12, x -336 z -1775) after the 2015 and 2018-19 orthophotos: the tank is a disc of 16 m
// (its shadow too, barely longer: a bowl, no tall drum), the roof a low cone of white and red segments (mm.s), the shaft's shadow 3 m wide
// (mm.f). Colours not seen (shaft, tank) stay a plain concrete
function lsTower(solid, x, z, r, h, solidAt, mm) {
  const F0 = lmFrame(new THREE.Matrix4()), gy = H.ground(x, z), R = clamp(r, 2.5, 9), rs = mm && mm.f ? mm.f / 2 : Math.max(1.2, R * 0.24);
  const yb = h * 0.7, yc = h * 0.86, rise = Math.min(3, R * 0.3), yr = h - rise, CONC = '#c9c4b8', geo = (g, col) => F0.geo(solid, g, null, COL(col));
  geo(new THREE.CylinderGeometry(rs, rs * 1.06, yb + 0.5, 16).translate(x, gy + yb / 2 - 0.25, z), CONC);
  geo(new THREE.CylinderGeometry(R, rs, yc - yb, 28, 1, true).translate(x, gy + (yb + yc) / 2, z), '#c2bdb1');
  geo(new THREE.CylinderGeometry(R, R, yr - yc, 28, 1, true).translate(x, gy + (yc + yr) / 2, z), '#d2cdc1');
  geo(new THREE.CylinderGeometry(R * 1.03, R * 1.03, 0.35, 28, 1, true).translate(x, gy + yr - 0.1, z), '#b9b4a9');
  const S = mm && mm.s, n = S ? S[2] : 1;
  for (let i = 0; i < n; i++) geo(new THREE.CylinderGeometry(0.5, R * 1.03, rise, Math.max(2, Math.ceil(28 / n)), 1, true, i * TAU / n, TAU / n).translate(x, gy + yr + rise / 2, z), S ? S[i % 2] : '#8f8b84');
  geo(new THREE.CylinderGeometry(0.5, 0.5, 0.6, 10).translate(x, gy + h + 0.3, z), '#8f8b84');
  geo(lmBox(1.0, 2.2, 0.12, x, gy + 1.1, z + rs * 1.04), '#5d6166');
  solidAt(x, z, rs * 1.06, h);
}
// a rod of r between two points in world coordinates (tubes of the greenhouses, rails)
function lsRod(b, a, c, r, col, seg = 4) {
  const v = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = v.length(); if (L < 0.01) return;
  const g = new THREE.CylinderGeometry(r, r, L, seg).translate(0, L / 2, 0);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize())));
  lmFrame(new THREE.Matrix4()).geo(b, g.translate(a[0], a[1], a[2]), null, COL(col));
}
// a plastic tunnel on the rectangle of a DBGT greenhouse (MN_IND 13, mm.k 'tunnel'): hoops of galvanised tube every metre and a half, the
// film over them (milky, or the colour the photo shows, mm.c), a door frame in each end, rows of plants inside. As high as the DSM saw it,
// no higher than its width allows (the typical 3.3 m was too tall for the 3 m tunnels of the allotments)
function lsTunnel(B, film, solid, box) {
  const P = B.pts, A = lsAxis(P), gys = P.map(p => H.ground(p[0], p[1])), base = Math.min(...gys), W = A.v1 - A.v0, vm = (A.v0 + A.v1) / 2, NA = 12;
  const hT = clamp(Math.max(...gys) + B.h - base, 1.6, 0.7 * W + 0.6), FC = COL(B.mm.c || '#e9eeeb'), TUBE = '#c9cdd0', y0 = base - 0.15;
  const arc = []; for (let j = 0; j <= NA; j++) { const t = Math.PI * j / NA; arc.push([vm - Math.cos(t) * W / 2, Math.sin(t) * hT, -Math.cos(t) / (W / 2), Math.sin(t) / hT]); }
  const W3 = (s, v, y) => { const [x, z] = A.at(s, v); return [x, y0 + y, z]; };
  for (let j = 0; j < NA; j++) {
    const a = arc[j], c = arc[j + 1], nv = (a[2] + c[2]) / 2, ny = (a[3] + c[3]) / 2, l = hyp(nv, ny) || 1, nx = A.nx * nv / l, nz = A.nz * nv / l, i = film.p.length / 3;
    for (const [s, q] of [[A.s0, a], [A.s1, a], [A.s1, c], [A.s0, c]]) { const p = W3(s, q[0], q[1]); vtx(film, p[0], p[1], p[2], nx, ny / l, nz, 0, 0, FC); }
    film.i.push(i, i + 1, i + 2, i, i + 2, i + 3);
  }
  for (const [s, sg] of [[A.s0, -1], [A.s1, 1]]) {
    const c0 = W3(s, vm, 0), i0 = film.p.length / 3; vtx(film, c0[0], c0[1], c0[2], A.ux * sg, 0, A.uz * sg, 0, 0, FC);
    for (const q of arc) { const p = W3(s, q[0], q[1]); vtx(film, p[0], p[1], p[2], A.ux * sg, 0, A.uz * sg, 0, 0, FC); }
    for (let j = 0; j < NA; j++) film.i.push(i0, i0 + 1 + j, i0 + 2 + j);
    for (const o of [-0.6, 0.6]) lsRod(solid, W3(s, vm + o, 0), W3(s, vm + o, Math.min(2.0, hT * 0.85)), 0.03, TUBE);
    lsRod(solid, W3(s, vm - 0.6, Math.min(2.0, hT * 0.85)), W3(s, vm + 0.6, Math.min(2.0, hT * 0.85)), 0.03, TUBE);
  }
  const L = A.s1 - A.s0, k = Math.max(1, Math.round(L / 1.5));
  for (let q = 0; q <= k; q++) { const s = A.s0 + L * q / k; for (let j = 0; j < NA; j += 2) lsRod(solid, W3(s, arc[j][0], arc[j][1]), W3(s, arc[j + 2][0], arc[j + 2][1]), 0.025, TUBE); }
  lsRod(solid, W3(A.s0, vm, hT), W3(A.s1, vm, hT), 0.025, TUBE);
  for (let v = A.v0 + 0.9; v < A.v1 - 0.6; v += 1.3) if (A.s1 - A.s0 > 2.5) { const [x1, z1] = A.at((A.s0 + A.s1) / 2, v); box(A.s1 - A.s0 - 1.6, 0.45, 0.6, x1, base + 0.22, z1, '#4f7a35', Math.atan2(A.ux, A.uz) - Math.PI / 2); }
}
// a polygon grown by d (mitred corners, at most 3 d)
function lsGrow(P, d) {
  const sg = sArea(P) < 0 ? -1 : 1, n = P.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = P[(i + n - 1) % n], b = P[i], c = P[(i + 1) % n], l1 = hyp(b[0] - a[0], b[1] - a[1]) || 1, l2 = hyp(c[0] - b[0], c[1] - b[1]) || 1;
    const n1 = [(b[1] - a[1]) / l1 * sg, -(b[0] - a[0]) / l1 * sg], n2 = [(c[1] - b[1]) / l2 * sg, -(c[0] - b[0]) / l2 * sg], mx = n1[0] + n2[0], mz = n1[1] + n2[1], ml = hyp(mx, mz) || 1;
    const k = Math.min(3, 1 / Math.max(0.33, (mx * n1[0] + mz * n1[1]) / ml)) * d; out.push([b[0] + mx / ml * k, b[1] + mz / ml * k]);
  }
  return out;
}
// a cabin of the DBGT (MN_IND 01 electric, 02 water, 03 gas; dbgt_manufatti.py _modello), after the 2018-19 orthophoto: plastered prefab
// walls, a grey door of sheet metal and louvred grilles on the side that looks onto open ground, the roof colour the photo shows (mm.t) or
// the type's (most of the roofs of Meda are grey). 'el' the low box with a flat slab; 'torre' the tall ENEL tower (6-12 m on 10-40 m2):
// a low hipped roof, louvres high up, the medium-voltage line coming in through three insulators on a bracket under the eaves (in the
// photos the lines reach some of them); 'gas' a box under a low pitched roof of sheet metal, louvres in a row along both long walls
function lsCabina(B, solid, box) {
  const P = B.pts, n = P.length, mm = B.mm || {}, k = mm.k || 'el', A = sArea(P), area = Math.abs(A), F0 = lmFrame(new THREE.Matrix4());
  const gys = P.map(p => H.ground(p[0], p[1])), g0 = Math.min(...gys), top = Math.max(...gys) + B.h, Ax = lsAxis(P);
  const rect = n <= 6 && isConvex(P) && area > 0.85 * (Ax.s1 - Ax.s0) * (Ax.v1 - Ax.v0);
  const kind = k === 'gas' && !rect ? 'el' : k, rise = kind === 'torre' ? Math.min(1.1, 0.22 * Math.sqrt(area)) : kind === 'gas' ? Math.min(0.8, 0.09 * (Ax.v1 - Ax.v0)) : 0;
  const eave = kind === 'el' ? top - 0.25 : top - rise, WALL = COL(mm.m || '#d5cfc2'), BASE = COL('#a9a59c');
  const ROOF = mm.t || (kind === 'torre' ? '#8b8d8f' : kind === 'gas' ? '#a7a9a9' : '#727478'), METAL = '#7d8288', GRILLE = '#55595e';
  const walls = [];
  for (let i = 0; i < n; i++) {
    const a = P[i], c = P[(i + 1) % n], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
    F0.face(solid, [[a[0], g0 - 0.3, a[1]], [c[0], g0 - 0.3, c[1]], [c[0], g0 + 0.3, c[1]], [a[0], g0 + 0.3, a[1]]], 2, BASE);
    F0.face(solid, [[a[0], g0 + 0.3, a[1]], [c[0], g0 + 0.3, c[1]], [c[0], eave, c[1]], [a[0], eave, a[1]]], 2, WALL);
    let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (A < 0) { nx = -nx; nz = -nz; }
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, open = !inBuilding(mx + nx * 1.5, mz + nz * 1.5) && !inBuilding(mx + nx * 3, mz + nz * 3);
    let road = 0; ROADSEG.each(mx - 20, mz - 20, mx + 20, mz + 20, s => { if (atGrade(s) && segDist(mx + nx * 3, mz + nz * 3, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + 10) road = 1; });
    walls.push({ a, c, L, nx, nz, ux: (c[0] - a[0]) / L, uz: (c[1] - a[1]) / L, ry: Math.atan2(c[0] - a[0], c[1] - a[1]) - Math.PI / 2, score: L * (open ? 2 : 0.5) + (open ? 3 * road : 0) });
  }
  if (!walls.length) return;
  // a thing on a wall: centred at t along it, y above the ground, d out of it
  const on = (W, t, y, w, h, d, col) => { const x = W.a[0] + W.ux * t + W.nx * d / 2, z = W.a[1] + W.uz * t + W.nz * d / 2; box(w, h, d, x, g0 + y, z, col, W.ry); };
  const grille = (W, t, y, w, h) => { on(W, t, y, w, h, 0.05, GRILLE); for (let q = 1; q < 4; q++) on(W, t, y - h / 2 + h * q / 4, w * 0.92, 0.035, 0.08, '#8a8f94'); };
  const front = walls.slice().sort((p, q) => q.score - p.score)[0], wallH = eave - g0;
  // the roof
  if (kind === 'el') {
    const G = lsGrow(P, 0.12), RC = COL(ROOF), EDGE = COL('#b9b4a8');
    try { polyFill(solid, G, [], top, 10, RC); } catch (e) { }
    for (let i = 0; i < G.length; i++) { const a = G[i], c = G[(i + 1) % G.length]; F0.face(solid, [[a[0], eave, a[1]], [c[0], eave, c[1]], [c[0], top, c[1]], [a[0], top, a[1]]], 2, EDGE); }
  } else if (kind === 'torre') {
    const G = lsGrow(P, 0.25), [cx, cz] = centroid(P), RC = COL(ROOF);
    for (let i = 0; i < G.length; i++) { const a = G[i], c = G[(i + 1) % G.length]; F0.face(solid, [[a[0], eave, a[1]], [c[0], eave, c[1]], [cx, top, cz]], 2, RC); }
    F0.geo(solid, new THREE.CylinderGeometry(0.05, 0.12, 0.6, 6).translate(cx, top + 0.25, cz), null, COL('#5d6166'));
  } else {
    const G = lsGrow([Ax.at(Ax.s0, Ax.v0), Ax.at(Ax.s1, Ax.v0), Ax.at(Ax.s1, Ax.v1), Ax.at(Ax.s0, Ax.v1)], 0.2), vm = (Ax.v0 + Ax.v1) / 2, RC = COL(ROOF);
    const r0 = Ax.at(Ax.s0 - 0.2, vm), r1 = Ax.at(Ax.s1 + 0.2, vm);
    F0.face(solid, [[G[0][0], eave, G[0][1]], [G[1][0], eave, G[1][1]], [r1[0], top, r1[1]], [r0[0], top, r0[1]]], 2, RC);
    F0.face(solid, [[G[2][0], eave, G[2][1]], [G[3][0], eave, G[3][1]], [r0[0], top, r0[1]], [r1[0], top, r1[1]]], 2, RC);
    for (const ss of [Ax.s0, Ax.s1]) { const p = Ax.at(ss, Ax.v0), q = Ax.at(ss, Ax.v1), m = Ax.at(ss, vm); F0.face(solid, [[p[0], eave, p[1]], [q[0], eave, q[1]], [m[0], top - 0.05, m[1]]], 2, WALL); }
  }
  // doors and grilles
  if (kind === 'torre') {
    on(front, front.L / 2, 1.1, Math.min(1.1, front.L - 0.6), 2.2, 0.06, METAL);
    for (const W of walls) if (W.L > 1.5) grille(W, W.L / 2, wallH - 1.2, 0.7, 0.9);
    const back = walls.slice().sort((p, q) => (p.nx * front.nx + p.nz * front.nz) - (q.nx * front.nx + q.nz * front.nz))[0], y = wallH - 0.5;
    if (back.L > 2) {
      on(back, back.L / 2, y, Math.min(2.4, back.L - 0.4), 0.12, 0.7, METAL);
      for (const o of [-0.8, 0, 0.8]) { const t = back.L / 2 + o * Math.min(1, (back.L - 0.6) / 2.4), x = back.a[0] + back.ux * t + back.nx * 0.6, z = back.a[1] + back.uz * t + back.nz * 0.6; F0.geo(solid, new THREE.CylinderGeometry(0.07, 0.09, 0.4, 6).translate(x, g0 + y + 0.26, z), null, COL('#d9d4c8')); }
    }
  } else if (kind === 'gas') {
    const ends = walls.filter(W => Math.abs(W.ux * Ax.ux + W.uz * Ax.uz) < 0.5).sort((p, q) => q.score - p.score);
    if (ends.length) on(ends[0], ends[0].L / 2, 1.05, Math.min(1.8, ends[0].L - 0.6), 2.1, 0.06, METAL);
    for (const W of walls) if (Math.abs(W.ux * Ax.ux + W.uz * Ax.uz) > 0.5 && W.L > 2) { const m = Math.floor((W.L - 0.6) / 1.6); for (let q = 0; q < m; q++) grille(W, (W.L - m * 1.6) / 2 + 0.8 + q * 1.6, wallH - 0.5, 0.8, 0.45); }
  } else {
    const nd = front.L >= 4.5 ? 2 : 1;
    for (let q = 0; q < nd; q++) { const t = front.L * (q + 0.5) / nd; on(front, t, 1.1, Math.min(1.2, front.L / nd - 0.5), 2.2, 0.06, METAL); grille(front, t, 1.55, Math.min(0.9, front.L / nd - 0.7), 0.5); }
    for (const W of walls) if (W !== front && W.L > 1.8 && wallH > 2.2) grille(W, W.L / 2, wallH - 0.45, 0.9, 0.4);
  }
}
