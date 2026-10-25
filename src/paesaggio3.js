// ---------------------------------------------------------------- the land by kind (paesaggio)
// build_data.py hands each tile its pieces of land with what they are (D tile key ls: { p, s }): fields, meadows, orchards, allotments, building
// sites, industrial yards, nurseries, pools, pitches by sport and surface. Each gets dressed for what it is: furrows and bales, rows of fruit trees,
// plots with sheds, a fenced site with containers and a crane, pallets and skips round the sheds, stone round the pool, lines, goals, hoops and nets.
// Garages get their up-and-over doors on the side you drive up to, greenhouses are glass. Variety comes from a hash of the place, never from
// what a real place looks like: nothing here pretends to know more than the map says
const LS_HASH = (x, z, k = '') => NG_HASH(k + Math.round(x * 10) + ',' + Math.round(z * 10));
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
const LS_BALE_G = (() => { const g = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 12); g.rotateZ(Math.PI / 2); g.translate(0, 0.75, 0); return g; })(), LS_BALE_M = lam(0xc9ab62);
// a hoarding panel 1 m long (stretched to its length along x), 2 m high, with its post at one end; the colour comes per instance
const LS_PANEL_G = (() => { const b = Buf(), F = lmFrame(new THREE.Matrix4()); F.geo(b, lmBox(1, 2, 0.05, 0, 1, 0), null, COL('#ffffff')); F.geo(b, lmBox(0.05, 2.1, 0.07, -0.5, 1.05, 0), null, COL('#8f949a'));
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.setIndex(b.i); return g; })();
const LS_PANEL_M = new THREE.MeshLambertMaterial({ vertexColors: true }), LS_PANEL_PROPS = new Map();
const LS_POT_G = (() => { const g = new THREE.IcosahedronGeometry(0.32, 0); g.translate(0, 0.45, 0); return g; })();

function* buildPaesaggio(T, G) {
  const d = T.d, solid = Buf(), drape = Object.assign(VBuf(), { noclip: !!H.tile(T.t) }), lines = VBuf(), doors = Buf(), glass = Buf(), net = Buf(), F0 = lmFrame(new THREE.Matrix4());
  const box = (w, h, dd, x, y, z, col, ry = 0) => F0.geo(solid, lmBox(w, h, dd, x, y, z, ry), null, COL(col));
  const cyl = (r, h, x, y, z, col, seg = 10) => F0.geo(solid, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z), null, COL(col));
  const solids = [], bales = [], trees = [], pots = [], panels = [];
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
  // ---- greenhouses: glass walls and roof on a light frame, rows of plants inside
  for (const B of T.bld) {
    if (B.g !== 2 || B.lm) continue;
    const P = B.pts, n = P.length, gys = P.map(p => H.ground(p[0], p[1])), g0 = Math.min(...gys), top = Math.max(...gys) + Math.max(2.4, B.h), Ax = lsAxis(P);
    for (let i = 0; i < n; i++) {
      const a = P[i], c = P[(i + 1) % n], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.2) continue; const j = glass.p.length / 3;
      vtx(glass, a[0], g0 - 0.3, a[1], 0, 0, 1, 0, 0); vtx(glass, c[0], g0 - 0.3, c[1], 0, 0, 1, 0, 0); vtx(glass, c[0], top, c[1], 0, 0, 1, 0, 0); vtx(glass, a[0], top, a[1], 0, 0, 1, 0, 0); glass.i.push(j, j + 1, j + 2, j, j + 2, j + 3);
      for (let t = 0; t <= L; t += 2.2) { const x = a[0] + (c[0] - a[0]) * t / L, z = a[1] + (c[1] - a[1]) * t / L; box(0.06, top - g0 + 0.3, 0.06, x, (top + g0 - 0.3) / 2, z, '#dfe3e4'); }
    }
    // the roof: a ridge down the long axis when the plan is a plain box, flat otherwise
    const ridge = n <= 5 && isConvex(P), rh = ridge ? Math.min(1.6, (Ax.v1 - Ax.v0) * 0.25) : 0;
    try { if (!ridge) { const rb = Buf(); polyFill(rb, P, [], top, 10, null); const j0 = glass.p.length / 3; for (let q = 0; q < rb.p.length; q += 3) vtx(glass, rb.p[q], rb.p[q + 1], rb.p[q + 2], 0, 1, 0, 0, 0); for (const q of rb.i) glass.i.push(j0 + q); }
      else { const vm = (Ax.v0 + Ax.v1) / 2; for (const vv of [Ax.v0, Ax.v1]) { const [ax, az] = Ax.at(Ax.s0, vv), [bx, bz] = Ax.at(Ax.s1, vv), [cx, cz] = Ax.at(Ax.s1, vm), [ex, ez] = Ax.at(Ax.s0, vm), j = glass.p.length / 3;
        vtx(glass, ax, top, az, 0, 1, 0, 0, 0); vtx(glass, bx, top, bz, 0, 1, 0, 0, 0); vtx(glass, cx, top + rh, cz, 0, 1, 0, 0, 0); vtx(glass, ex, top + rh, ez, 0, 1, 0, 0, 0); glass.i.push(j, j + 1, j + 2, j, j + 2, j + 3); }
        for (const ss of [Ax.s0, Ax.s1]) { const [ax, az] = Ax.at(ss, Ax.v0), [bx, bz] = Ax.at(ss, Ax.v1), [cx, cz] = Ax.at(ss, vm), j = glass.p.length / 3; vtx(glass, ax, top, az, 0, 0, 1, 0, 0); vtx(glass, bx, top, bz, 0, 0, 1, 0, 0); vtx(glass, cx, top + rh, cz, 0, 0, 1, 0, 0); glass.i.push(j, j + 1, j + 2); }
        const [p1x, p1z] = Ax.at(Ax.s0, vm), [p2x, p2z] = Ax.at(Ax.s1, vm); box(hyp(p2x - p1x, p2z - p1z), 0.08, 0.08, (p1x + p2x) / 2, top + rh, (p1z + p2z) / 2, '#dfe3e4', Math.atan2(Ax.ux, Ax.uz) - Math.PI / 2); } } catch (e) { }
    for (let v = Ax.v0 + 1.2; v < Ax.v1 - 0.8; v += 1.6) for (const [a, b] of lsSpans(Ax.Q, v)) if (b - a > 2) { const [x1, z1] = Ax.at((a + b) / 2, v); box(b - a - 1.2, 0.5, 0.7, x1, g0 + 0.25, z1, '#4f7a35', Math.atan2(Ax.ux, Ax.uz) - Math.PI / 2); }
  }
  yield 'serre';
  // ---- the land
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
    } else if (kind === 'frutteto') { // trees in rows
      for (let v = A.v0 + 2.5; v < A.v1 - 2; v += 4.5) for (const [a, b] of lsSpans(A.Q, v)) for (let s = a + 2.5; s < b - 2; s += 4.5) { const [x, z] = A.at(s, v); if (trees.length < 400 && lsFreeAt(x, z, 1)) trees.push([x, z]); }
    } else if (kind === 'vivaio') {
      for (let v = A.v0 + 1.5; v < A.v1 - 1; v += 1.4) for (const [a, b] of lsSpans(A.Q, v)) for (let s = a + 1.5; s < b - 1; s += 0.9) { const [x, z] = A.at(s, v); if (pots.length < 900 && lsFreeAt(x, z, 0.4)) pots.push([x, z]); }
    } else if (kind === 'orti') { // plots 6 x 8 m: rows of vegetables, a shed or a water tank in some
      const soil = COL('#7a5a3c'), greens = ['#5d8a3b', '#6b8f3e', '#4f7a35', '#8fae5a'];
      for (let s = A.s0 + 1; s < A.s1 - 6; s += 6.6) for (let v = A.v0 + 1; v < A.v1 - 7; v += 8.6) {
        const [mx, mz] = A.at(s + 3, v + 4); if (!inPoly(mx, mz, P) || !lsFreeAt(mx, mz, 3)) continue; const hp = LS_HASH(mx, mz, 'orto');
        for (let r = 0; r < 6; r++) { lsStrip(drape, A, s, s + 6, v + 0.7 + r * 1.2, 0.9, soil, 0.04); if (hp > 0.15) lsStrip(drape, A, s + 0.3, s + 5.7, v + 0.7 + r * 1.2, 0.35, COL(greens[(r + Math.floor(hp * 9)) % 4]), 0.06); }
        const gy = H.ground(mx, mz), [px, pz] = A.at(s + 5, v + 7.3), ry = Math.atan2(A.ux, A.uz);
        if (hp > 0.6) { box(1.8, 2.0, 1.4, px, H.ground(px, pz) + 1.0, pz, ['#7a6a52', '#6b7a6b', '#8f949a', '#5a4a3a'][Math.floor(hp * 40) % 4], ry); box(2.1, 0.08, 1.7, px, H.ground(px, pz) + 2.05, pz, '#4a4d52', ry); solidAt(px, pz, 1.1, 2.1); }
        else if (hp > 0.35) { cyl(0.5, 1.1, px, H.ground(px, pz) + 0.55, pz, '#2a6fb0'); solidAt(px, pz, 0.55, 1.1); }
        void gy;
      }
    } else if (kind === 'cantiere') { // the hoarding round it (not across streets), containers, a sand heap, a tower crane on the big ones
      for (let i = 0; i < P.length; i++) {
        const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.5) continue;
        for (let t = 0; t < L; t += 2.5) {
          const t1 = Math.min(L, t + 2.5), x0 = a[0] + (c[0] - a[0]) * t / L, z0 = a[1] + (c[1] - a[1]) * t / L, x1 = a[0] + (c[0] - a[0]) * t1 / L, z1 = a[1] + (c[1] - a[1]) * t1 / L, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
          if (onAnyRoad(mx, mz, 0.6) || nearAsph(mx, mz, 0.3) || onAsph(x0, z0) || onAsph(x1, z1) || inBuilding(mx, mz, 0.3)) continue; // the drawn carriageway too (AC_VEI), ends included
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
    } else if (kind === 'piscina') { // the stone round the water and a ladder
      const gy = Math.min(...P.map(p => H.ground(p[0], p[1])));
      try { const wb = Buf(); polyFill(wb, P, [], gy + 0.06, 10, COL('#5fb8d6')); mkMesh(wb, MAT.mark, 6, false, G); } catch (e) { }
      const Ap = sArea(P);
      for (let i = 0; i < P.length; i++) {
        const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.1) continue; let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (Ap < 0) { nx = -nx; nz = -nz; }
        box(L + 0.9, 0.12, 0.45, (a[0] + c[0]) / 2 + nx * 0.22, gy + 0.08, (a[1] + c[1]) / 2 + nz * 0.22, '#e8e2d4', Math.atan2(c[0] - a[0], c[1] - a[1]) - Math.PI / 2);
      }
      const [lx0, lz0] = P[0], [lx1, lz1] = P[1], lm = [(lx0 + lx1) / 2, (lz0 + lz1) / 2];
      for (const o of [-0.25, 0.25]) { const ux = (lx1 - lx0) / (hyp(lx1 - lx0, lz1 - lz0) || 1), uz = (lz1 - lz0) / (hyp(lx1 - lx0, lz1 - lz0) || 1); cyl(0.025, 1.0, lm[0] + ux * o, gy + 0.6, lm[1] + uz * o, '#d9dcde', 6); }
    } else if (kind === 'cani') { // a dog run: a mesh fence with a way in on the side nearest a street, a bench and a bin inside
      let gate = 0, gd = 1e9; P.forEach((p, i) => { const q = P[(i + 1) % P.length], mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; let d = 1e9; ROADSEG.each(mx - 30, mz - 30, mx + 30, mz + 30, s => { d = Math.min(d, segDist(mx, mz, s.a[0], s.a[1], s.b[0], s.b[1])); }); if (d < gd && hyp(q[0] - p[0], q[1] - p[1]) > 3) { gd = d; gate = i; } });
      lsFence(net, solid, P, 1.2, gate, '#3e4a42');
      const [bx, bz] = A.at(A.s0 * 0.4, A.v0 * 0.4); if (inPoly(bx, bz, P)) { const gy = H.ground(bx, bz), ry = Math.atan2(A.ux, A.uz); const qx = bx + Math.sin(ry) * 1.4, qz = bz + Math.cos(ry) * 1.4; parkProps(G, 'panchina', [[bx, bz, ry, gy]]); parkProps(G, 'cestino', [[qx, qz, ry, H.ground(qx, qz)]]); } // knocked down like the street lamps (landmarks3.js)
    } else if (kind.startsWith('pista')) { // an athletics track: six red lanes inside the oval, white lines between them
      if (area < 1500 || !isConvex(P)) continue;
      const ring = k => P.map(([x, z]) => { const dx = cx - x, dz = cz - z, l = hyp(dx, dz) || 1; return [x + dx / l * k * 1.22, z + dz / l * k * 1.22]; }), outer = ring(0), inner = ring(6), RED = COL(kind.endsWith('grass') ? '#6b8f3e' : '#b5543f');
      for (let i = 0; i < P.length; i++) { const j = (i + 1) % P.length, q = drape.p.length / 3; for (const p of [outer[i], outer[j], inner[j], inner[i]]) vtx(drape, p[0], 0.05, p[1], 0, 1, 0, 0, 0, RED); drape.i.push(q, q + 1, q + 2, q, q + 2, q + 3, q, q + 2, q + 1, q, q + 3, q + 2); }
      for (let k = 0; k <= 6; k++) { const R_ = ring(k); for (let i = 0; i < R_.length; i++) { const a = R_[i], c = R_[(i + 1) % R_.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue; const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, q = lines.p.length / 3, Wc = COL('#f4f2ea'); for (const [s, o] of [[0, -0.04], [L, -0.04], [L, 0.04], [0, 0.04]]) vtx(lines, a[0] + ux * s - uz * o, 0.07, a[1] + uz * s + ux * o, 0, 1, 0, 0, 0, Wc); triUp(lines, q, q + 1, q + 2); triUp(lines, q, q + 2, q + 3); } }
    } else if (kind === 'aiuola') { // a flower bed: dark soil, flowers in the colours of a garden centre
      try { polyFill(drape, P, [], 0.06, 10, COL('#5a4030')); } catch (e) { }
      const n = Math.min(140, Math.floor(area * 1.5));
      for (let k = 0; k < n * 2 && k < 400; k++) { const x = A.cx + (LS_HASH(cx + k, cz, 'fl') - 0.5) * (A.s1 - A.s0 + A.v1 - A.v0), z = A.cz + (LS_HASH(cx, cz + k, 'fl') - 0.5) * (A.s1 - A.s0 + A.v1 - A.v0); if (!inPoly(x, z, P)) continue; const gy = H.ground(x, z); F0.geo(solid, new THREE.IcosahedronGeometry(0.13, 0).translate(x, gy + 0.22, z), null, COL(['#c8331f', '#f2c230', '#f4a6b8', '#ffffff', '#8c6bb1', '#ff7a1e', '#3d6a2a'][Math.floor(LS_HASH(x, z, 'c') * 7)])); }
    } else if (kind === 'lavaggio') { // a self-service car wash: bays under one roof, walls between them, the coin box at the back of each
      if (area > 1500 || onAnyRoad(cx, cz, 0)) continue;
      const n = clamp(Math.floor((A.s1 - A.s0) / 4.5), 1, 6), w = n * 4.5, s0 = (A.s0 + A.s1) / 2 - w / 2, dp = Math.min(6, A.v1 - A.v0), vm = (A.v0 + A.v1) / 2, ry = Math.atan2(A.ux, A.uz), gy = H.ground(cx, cz);
      const [rcx, rcz] = A.at(s0 + w / 2, vm); box(w + 0.4, 0.3, dp + 0.6, rcx, gy + 3.6, rcz, '#1d4f9a', ry - Math.PI / 2); box(w + 0.42, 0.12, dp + 0.62, rcx, gy + 3.4, rcz, '#e8e6e0', ry - Math.PI / 2);
      for (let k = 0; k <= n; k++) { const [x, z] = A.at(s0 + k * 4.5, vm); box(0.15, 2.4, dp * 0.85, x, gy + 1.2, z, '#d9dcde', ry - Math.PI / 2); box(0.2, 3.5, 0.2, ...(() => { const [px, pz] = A.at(s0 + k * 4.5, vm + dp / 2); return [px, gy + 1.75, pz]; })(), '#8f949a'); solidAt(x, z, 0.3, 2.4); }
      for (let k = 0; k < n; k++) { const [x, z] = A.at(s0 + k * 4.5 + 2.25, vm - dp / 2 + 0.4); box(0.6, 1.5, 0.4, x, gy + 0.75, z, '#3a3d40', ry); }
    } else if (kind.startsWith('torre_acqua')) { lsTower(solid, cx, cz, Math.sqrt(area / Math.PI), +kind.split(':')[1] || 28, solidAt);
    } else if (kind.startsWith('sport:skateboard') || kind.startsWith('sport:roller')) { // concrete, a quarter pipe at each end, a fun box in the middle
      try { polyFill(drape, P, [], 0.05, 10, COL('#a9a8a2')); } catch (e) { }
      const ry = Math.atan2(A.ux, A.uz), wv = Math.min(8, A.v1 - A.v0 - 1);
      for (const e of [-1, 1]) for (let k = 0; k < 4; k++) { const [x, z] = A.at((e > 0 ? A.s1 : A.s0) - e * (0.6 + k * 0.5), (A.v0 + A.v1) / 2), gy = H.ground(x, z), h = [1.6, 1.0, 0.55, 0.22][k]; box(0.5, h, wv, x, gy + h / 2, z, '#b8b6ae', ry - Math.PI / 2); }
      const [fx, fz] = A.at((A.s0 + A.s1) / 2, (A.v0 + A.v1) / 2), fy = H.ground(fx, fz); box(2.4, 0.5, 2.4, fx, fy + 0.25, fz, '#b8b6ae', ry); for (const e of [-1, 1]) { const g = new THREE.BoxGeometry(1.6, 0.06, 2.4).rotateZ(e * 0.3).rotateY(ry - Math.PI / 2).translate(fx + Math.sin(ry) * e * 2, fy + 0.24, fz + Math.cos(ry) * e * 2); F0.geo(solid, g, null, COL('#b8b6ae')); }
    } else if (kind.startsWith('sport:equestrian')) { // a riding arena: sand, a wooden fence with a gate, two jumps
      try { polyFill(drape, P, [], 0.05, 10, COL('#d2bd8f')); } catch (e) { }
      lsRail(solid, P, 0, box);
      const ry = Math.atan2(A.ux, A.uz);
      for (const f of [-0.25, 0.25]) { const [x, z] = A.at((A.s0 + A.s1) / 2 + (A.s1 - A.s0) * f, (A.v0 + A.v1) / 2), gy = H.ground(x, z); for (const o of [-1.5, 1.5]) box(0.12, 1.3, 0.12, x + Math.cos(ry) * o, gy + 0.65, z - Math.sin(ry) * o, '#f4f2ea'); for (const y of [0.5, 0.9]) box(3, 0.08, 0.08, x, gy + y, z, y > 0.7 ? '#c8331f' : '#f4f2ea', ry + Math.PI / 2); }
    } else if (kind.startsWith('sport:')) lsPitch(A, P, kind.split(':')[1], kind.split(':')[2], lines, solid, box, cyl, G, solidAt);
  }
  // stands by the pitches: rows of steps up to a back wall, seats on them, a roof reaching out over the front
  for (const B of T.bld) {
    if (B.g !== 3 || B.lm) continue; const Ax = lsAxis(B.pts), gy = Math.min(...B.pts.map(p => H.ground(p[0], p[1])));
    let pitch = null, pd = 1e9; for (const L0 of d.ls || []) if (L0.s.startsWith('sport')) { const Q = dec(L0.p), [qx, qz] = centroid(Q), dd = hyp(qx - Ax.cx, qz - Ax.cz); if (dd < pd) { pd = dd; pitch = [qx, qz]; } }
    const face = pitch && ((pitch[0] - Ax.cx) * Ax.nx + (pitch[1] - Ax.cz) * Ax.nz) < 0 ? -1 : 1, D_ = Ax.v1 - Ax.v0, rows = clamp(Math.floor(D_ / 0.85), 2, 14), Ls = Ax.s1 - Ax.s0, sm = (Ax.s0 + Ax.s1) / 2, ry = Math.atan2(Ax.ux, Ax.uz) - Math.PI / 2;
    const seat = ['#c8102e', '#1d4f9a', '#2a7a3a', '#e8b520', '#8f949a'][Math.floor(LS_HASH(Ax.cx, Ax.cz, 'seat') * 5)];
    for (let k = 0; k < rows; k++) { const v = face > 0 ? Ax.v1 - (k + 0.5) * D_ / rows : Ax.v0 + (k + 0.5) * D_ / rows, [x, z] = Ax.at(sm, v), hh = (k + 1) * 0.42; box(Ls, hh, D_ / rows, x, gy + hh / 2, z, '#b8b3a8', ry); box(Ls - 0.4, 0.12, 0.35, x, gy + hh + 0.06, z, seat, ry); }
    const top = rows * 0.42 + 2.6, vb = face > 0 ? Ax.v0 + 0.15 : Ax.v1 - 0.15, [wx, wz] = Ax.at(sm, vb); box(Ls, top, 0.3, wx, gy + top / 2, wz, '#a9a398', ry);
    const [rx_, rz_] = Ax.at(sm, (Ax.v0 + Ax.v1) / 2 + face * 0.6); box(Ls + 0.4, 0.2, D_ + 1.4, rx_, gy + top, rz_, '#8f949a', ry);
  }
  // water towers mapped as buildings
  for (const B of T.bld) if (B.g === 4 && !B.lm) { const [x, z] = centroid(B.pts); lsTower(solid, x, z, Math.sqrt(Math.abs(sArea(B.pts)) / Math.PI), B.h, solidAt); }
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
  if (drape.i.length) mkMesh(drape, MAT.mark, 2, false, G);
  if (lines.i.length) mkMesh(lines, MAT.mark, 3, false, G);
  if (solid.i.length) mkMesh(solid, LMAT.trim, 10, 'cast', G);
  if (doors.i.length) mkMesh(doors, LS_DOOR_MAT, 10, false, G);
  if (glass.i.length) mkMesh(glass, LS_GLASS, 12, false, G);
  const o3 = new THREE.Object3D(), inst = (geo, mat, list, sc, colOf) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); im.castShadow = true;
    list.forEach(([x, z, r], i) => { o3.position.set(x, H.ground(x, z), z); o3.rotation.set(0, r || 0, 0); const k = sc ? sc(x, z) : 1; o3.scale.set(k, k, k); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); if (colOf) im.setColorAt(i, COL(colOf(x, z))); });
    G.add(im); return im;
  };
  inst(LS_BALE_G, LS_BALE_M, bales);
  if (panels.length) { // building-site hoarding: one instance per panel, each knocked over on its own like the street lamps
    const im = new THREE.InstancedMesh(LS_PANEL_G, LS_PANEL_M, panels.length); im.castShadow = true;
    panels.forEach(([x0, z0, x1, z1, col], i) => {
      const L = hyp(x1 - x0, z1 - z0), x = (x0 + x1) / 2, z = (z0 + z1) / 2, gy = H.ground(x, z), ry = Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2;
      o3.position.set(x, gy, z); o3.rotation.set(0, ry, 0); o3.scale.set(L, 1, 1); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); im.setColorAt(i, COL(col));
      const id = T.t + ':' + i, p = LS_PANEL_PROPS.get(id);
      if (!p) LS_PANEL_PROPS.set(id, addProp({ x, z, y: gy, r: Math.min(1.1, L / 2), h: 2.1, inst: { meshes: [im], i, ry, base: gy, sx: L } }));
      else { p.inst.meshes = [im]; if (p.broken) { o3.scale.set(0, 0, 0); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); } }
    });
    G.add(im);
  }
  inst(TREE_G.trunk, MAT.trunk, trees, () => 0.55);
  const crowns = inst(TREE_G.crown, MAT.crown, trees); // small fruit trees: the crown low on a short trunk
  if (crowns) crowns.customDepthMaterial = TREE_DEPTH;
  if (crowns) trees.forEach(([x, z], i) => { o3.position.set(x, H.ground(x, z) + 3.4 * 0.55 + 0.6, z); o3.rotation.set(0, LS_HASH(x, z, 'r') * TAU, 0); o3.scale.set(0.6, 0.6, 0.6); o3.updateMatrix(); crowns.setMatrixAt(i, o3.matrix); crowns.setColorAt(i, COL(GREENS[Math.floor(LS_HASH(x, z, 'f') * 3)])); });
  inst(LS_POT_G, lam(0x4f7a35), pots, (x, z) => 0.7 + LS_HASH(x, z, 'p') * 0.6);
  if (!T.lsDone) {
    for (const [x, z, r, hh] of solids) { const gy = H.ground(x, z); WALLS.add(x - r, z - r, x + r, z + r, { r, x, z, y0: gy - 3, y1: gy + hh }); }
    for (const [x, z] of bales) { const gy = H.ground(x, z); WALLS.add(x - 0.8, z - 0.8, x + 0.8, z + 0.8, { r: 0.75, x, z, y0: gy - 3, y1: gy + 1.5 }); }
  }
  T.lsDone = true;
}
// a net that is a net: thin pale threads on clear cloth (goals, hoops, tennis and volleyball), unlike the dark fence mesh
const LS_RETE = new THREE.MeshLambertMaterial({ map: canvasTex(32, 32, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#eceff0'; g.fillRect(0, 0, w, 3); g.fillRect(0, 0, 3, h); }), alphaTest: 0.12, side: THREE.DoubleSide, color: 0xffffff });
// ---- pitches: the lines of the game the map says, and the gear of that game in its place (frame = the minimum rectangle of the polygon):
// goals at the middle of the two SHORT sides, on the end line, net behind them and inside the polygon; hoops on the short sides too;
// a net across the middle of a tennis or volleyball court. Only the sport the map names (the first of a list), nothing mixed on top of it
function lsPitch(A0, P, sport, surface, lines, solid, box, cyl, G, solidAt) {
  const A = lsRect(P); if (!A) return;
  const W = COL('#f4f2ea'), Ls = A.s1 - A.s0, Wv = A.v1 - A.v0, sm = 0, vm = 0;
  if (Ls < 6 || Wv < 4) return;
  const S = (a, b) => A.at(sm + a, vm + b), line = (a0, b0, a1, b1, w = 0.1) => lsLine(lines, A, sm + a0, vm + b0, sm + a1, vm + b1, w, W);
  const rect = (hl, hw) => { line(-hl, -hw, hl, -hw); line(hl, -hw, hl, hw); line(hl, hw, -hl, hw); line(-hl, hw, -hl, -hw); };
  const circle = (a, b, r, from = 0, to = TAU) => { const n = Math.max(8, Math.ceil(r * 3)); for (let k = 0; k < n; k++) { const t0 = from + (to - from) * k / n, t1 = from + (to - from) * (k + 1) / n; line(a + Math.cos(t0) * r, b + Math.sin(t0) * r, a + Math.cos(t1) * r, b + Math.sin(t1) * r, 0.08); } };
  const gyAt = (a, b) => { const [x, z] = S(a, b); return [x, H.ground(x, z), z]; };
  const surf = { clay: '#c0663f', sand: '#e2cf9a', grass: null, artificial_turf: '#5e9a4a', asphalt: '#6e7378', concrete: '#9a9a96', tartan: '#b5523c' }[surface];
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
    lsAud(rec, 'porta', cx, cz); return true;
  };
  const hw = Wv / 2 - 0.6;
  if (sport === 'soccer' || sport === 'five-a-side' || sport === 'futsal' || sport === 'handball') {
    const big = sport === 'soccer' && Wv >= 45, gw = Math.min(big ? 7.32 : 3, Wv * 0.5), gh = big ? 2.44 : 2, d0 = big ? 2.0 : 1.1, d1 = big ? 0.9 : 0.5, hl = Ls / 2 - 0.5 - d0;
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
      for (let k = 0; k < N_; k++) { const t0 = -half + 2 * half * k / N_, t1 = -half + 2 * half * (k + 1) / N_; quad(pt(t0, bot(t0)), pt(t1, bot(t1)), pt(t1, top(t1)), pt(t0, top(t0))); tube(pt(t0, top(t0)), pt(t1, top(t1)), 0.025, '#f4f2ea'); }
    }
  } else if (sport === 'boules' || sport === 'bowls') { /* the boards round a bocce court */
    const hl = Ls / 2 - 0.6;
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
// a water tower: shaft, a cone up to the tank, the tank, its roof; r is the radius of the tank, h the height
function lsTower(solid, x, z, r, h, solidAt) {
  const F0 = lmFrame(new THREE.Matrix4()), gy = H.ground(x, z), R = clamp(r, 2.5, 9), Hs = h * 0.72;
  F0.geo(solid, new THREE.CylinderGeometry(R * 0.3, R * 0.36, Hs, 14).translate(x, gy + Hs / 2, z), null, COL('#c9c4b8'));
  F0.geo(solid, new THREE.CylinderGeometry(R, R * 0.3, h * 0.1, 18).translate(x, gy + Hs + h * 0.05, z), null, COL('#bdb7a9'));
  F0.geo(solid, new THREE.CylinderGeometry(R, R, h * 0.14, 18).translate(x, gy + Hs + h * 0.17, z), null, COL('#d4cfc3'));
  F0.geo(solid, new THREE.CylinderGeometry(R * 0.2, R * 1.02, h * 0.05, 18).translate(x, gy + h * 0.985, z), null, COL('#8f8b84'));
  solidAt(x, z, R * 0.36, h);
}
