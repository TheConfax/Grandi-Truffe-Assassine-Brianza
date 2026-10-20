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
function lsSpans(Q, v) { // where the line across at v runs inside the polygon (in axis coordinates)
  const xs = []; for (let i = 0; i < Q.length; i++) { const a = Q[i], b = Q[(i + 1) % Q.length]; if ((a[1] > v) !== (b[1] > v)) xs.push(a[0] + (v - a[1]) / (b[1] - a[1]) * (b[0] - a[0])); }
  xs.sort((p, q) => p - q); const out = []; for (let i = 0; i + 1 < xs.length; i += 2) out.push([xs[i], xs[i + 1]]); return out;
}
// a flat strip laid on the ground (draped, so y is the height above it), from (s0,v) to (s1,v) in the frame A, w wide, in pieces of 6 m
function lsStrip(b, A, s0, s1, v, w, col, dy = 0.05) {
  const n = Math.max(1, Math.ceil((s1 - s0) / 6));
  for (let k = 0; k < n; k++) {
    const a = s0 + (s1 - s0) * k / n, c = s0 + (s1 - s0) * (k + 1) / n, i = b.p.length / 3;
    for (const [s, t] of [[a, v - w / 2], [c, v - w / 2], [c, v + w / 2], [a, v + w / 2]]) { const [x, z] = A.at(s, t); vtx(b, x, dy, z, 0, 1, 0, 0, 0, col); }
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
// what landmarks3.js already draws by hand: the school yards and courts (YARDS), the stadiums inside their four floodlight towers
const LS_SKIP = (x, z) => YARDS.some(y => inPoly(x, z, y.p)) || LANDMARKS.some(L => {
  if (L.build !== buildStadio) return false; const o = L.o, dx = x - o.o[0], dz = z - o.o[1], a = dx * o.ua[0] + dz * o.ua[1], b = dx * o.ua[1] - dz * o.ua[0];
  const ta = o.towers.map(t => t[0]), tb = o.towers.map(t => t[1]); return a >= Math.min(...ta) && a <= Math.max(...ta) && b >= Math.min(...tb) && b <= Math.max(...tb);
});
const lsFreeAt = (x, z, r) => !onAnyRoad(x, z, r) && !inBuilding(x, z, r) && !nearRail(x, z, 3) && !ngInPark(x, z, r);
// up-and-over doors: a pressed-steel texture, tinted per door
const LS_DOOR_MAT = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1, map: canvasTex(64, 64, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let x = 2; x < w; x += 6) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(x, 4, 1, h - 8); g.fillStyle = 'rgba(255,255,255,.6)'; g.fillRect(x + 1, 4, 1, h - 8); }
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, w, 3); g.fillRect(0, h - 3, w, 3); g.fillRect(0, 0, 2, h); g.fillRect(w - 2, 0, 2, h); g.fillStyle = '#555'; g.fillRect(w / 2 - 3, h * 0.55, 6, 3); }, false) });
const LS_DOOR_COLS = ['#c9ccd1', '#9da1a6', '#b8ad95', '#6b7a6b', '#8a6a52', '#d9d6cf', '#7d8ea0'];
const LS_GLASS = new THREE.MeshLambertMaterial({ color: 0xe4f0ee, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide });
const LS_BALE_G = (() => { const g = new THREE.CylinderGeometry(0.75, 0.75, 1.2, 12); g.rotateZ(Math.PI / 2); g.translate(0, 0.75, 0); return g; })(), LS_BALE_M = lam(0xc9ab62);
const LS_POT_G = (() => { const g = new THREE.IcosahedronGeometry(0.32, 0); g.translate(0, 0.45, 0); return g; })();

function* buildPaesaggio(T, G) {
  const d = T.d, solid = Buf(), drape = VBuf(), lines = VBuf(), doors = Buf(), glass = Buf(), F0 = lmFrame(new THREE.Matrix4());
  const box = (w, h, dd, x, y, z, col, ry = 0) => F0.geo(solid, lmBox(w, h, dd, x, y, z, ry), null, COL(col));
  const cyl = (r, h, x, y, z, col, seg = 10) => F0.geo(solid, new THREE.CylinderGeometry(r, r, h, seg).translate(x, y, z), null, COL(col));
  const solids = [], bales = [], trees = [], pots = [];
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
      let road = 0; ROADSEG.each(mx - 25, mz - 25, mx + 25, mz + 25, s => { if (!s.r.d && segDist(mx + nx * 6, mz + nz * 6, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + 12) road = 1; });
      walls.push({ a, c, L, nx, nz, ux: (c[0] - a[0]) / L, uz: (c[1] - a[1]) / L, score: L * (1 + road) + open });
    }
    if (!walls.length) continue;
    walls.sort((p, q) => q.score - p.score);
    const use = [walls[0]]; const w2 = walls.find(w => w !== walls[0] && w.nx * walls[0].nx + w.nz * walls[0].nz < -0.9 && w.L > walls[0].L * 0.8 && Math.abs(sArea(P)) > 60); if (w2) use.push(w2);
    const gy = Math.min(...P.map(p => groundH(p[0], p[1])));
    for (const W of use) {
      const k = Math.max(1, Math.floor((W.L - 0.3) / 2.75)), pitch = W.L / k, dw = Math.min(2.4, pitch - 0.35), dh = Math.min(2.15, B.h - 0.35);
      for (let j = 0; j < k; j++) {
        const t = pitch * (j + 0.5), cx = W.a[0] + W.ux * t + W.nx * 0.03, cz = W.a[1] + W.uz * t + W.nz * 0.03, y0 = groundH(cx, cz), col = COL(LS_DOOR_COLS[Math.floor(LS_HASH(cx, cz, 'porta') * LS_DOOR_COLS.length)]);
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
    const P = B.pts, n = P.length, gys = P.map(p => groundH(p[0], p[1])), g0 = Math.min(...gys), top = Math.max(...gys) + Math.max(2.4, B.h), Ax = lsAxis(P);
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
    if (LS_SKIP(cx, cz)) continue;
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
        const gy = groundH(mx, mz), [px, pz] = A.at(s + 5, v + 7.3), ry = Math.atan2(A.ux, A.uz);
        if (hp > 0.6) { box(1.8, 2.0, 1.4, px, groundH(px, pz) + 1.0, pz, ['#7a6a52', '#6b7a6b', '#8f949a', '#5a4a3a'][Math.floor(hp * 40) % 4], ry); box(2.1, 0.08, 1.7, px, groundH(px, pz) + 2.05, pz, '#4a4d52', ry); solidAt(px, pz, 1.1, 2.1); }
        else if (hp > 0.35) { cyl(0.5, 1.1, px, groundH(px, pz) + 0.55, pz, '#2a6fb0'); solidAt(px, pz, 0.55, 1.1); }
        void gy;
      }
    } else if (kind === 'cantiere') { // the hoarding round it (not across streets), containers, a sand heap, a tower crane on the big ones
      for (let i = 0; i < P.length; i++) {
        const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.5) continue;
        for (let t = 0; t < L; t += 2.5) {
          const t1 = Math.min(L, t + 2.5), x0 = a[0] + (c[0] - a[0]) * t / L, z0 = a[1] + (c[1] - a[1]) * t / L, x1 = a[0] + (c[0] - a[0]) * t1 / L, z1 = a[1] + (c[1] - a[1]) * t1 / L, mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
          if (onAnyRoad(mx, mz, 0.6) || inBuilding(mx, mz, 0.3)) continue;
          const g0 = groundH(x0, z0), g1 = groundH(x1, z1), j = solid.p.length / 3, col = COL(h > 0.5 ? '#3d6a4a' : '#b8bcc0'), nx = (z1 - z0) / (t1 - t || 1), nz = -(x1 - x0) / (t1 - t || 1);
          vtx(solid, x0, g0, z0, nx, 0, nz, 0, 0, col); vtx(solid, x1, g1, z1, nx, 0, nz, 0, 0, col); vtx(solid, x1, g1 + 2, z1, nx, 0, nz, 0, 0, col); vtx(solid, x0, g0 + 2, z0, nx, 0, nz, 0, 0, col); solid.i.push(j, j + 1, j + 2, j, j + 2, j + 3);
          box(0.06, 2.1, 0.06, x0, g0 + 1.05, z0, '#8f949a'); box(0.4, 0.15, 0.25, x0, g0 + 0.07, z0, '#c9c4b8');
        }
      }
      const spots = [];
      for (let k = 0; k < 40 && spots.length < 4; k++) { const s = A.s0 + 4 + (A.s1 - A.s0 - 8) * LS_HASH(cx + k, cz, 'c'), v = A.v0 + 4 + (A.v1 - A.v0 - 8) * LS_HASH(cx, cz + k, 'c'), [x, z] = A.at(s, v); if (inPoly(x, z, P) && lsFreeAt(x, z, 3.5) && !spots.some(([p, q]) => hyp(p - x, q - z) < 7)) spots.push([x, z]); }
      const ry = Math.atan2(A.ux, A.uz);
      spots.forEach(([x, z], k) => {
        const gy = groundH(x, z);
        if (k === 0 && area > 1200) { // tower crane: lattice mast as a yellow column, jib and counter-jib, cab, counterweight
          const H = 22 + LS_HASH(x, z, 'gru') * 10, a = LS_HASH(x, z, 'brac') * TAU;
          box(1.6, H, 1.6, x, gy + H / 2, z, '#e8b520'); for (let y = 2; y < H; y += 2.5) box(1.7, 0.12, 1.7, x, gy + y, z, '#c99a10');
          box(42, 1.1, 1.1, x + Math.sin(a) * 12, gy + H + 0.6, z + Math.cos(a) * 12, '#e8b520', a + Math.PI / 2); box(2.4, 2.2, 2, x - Math.sin(a) * 9, gy + H - 0.2, z - Math.cos(a) * 9, '#8f949a', a);
          box(1.6, 1.6, 1.6, x + Math.sin(a) * 1.6, gy + H - 0.4, z + Math.cos(a) * 1.6, '#f2efe6', a); box(0.12, 0.12, 0.12, x, gy + H + 1.5, z, '#c8102e');
          solidAt(x, z, 1.2, H);
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
            const gy = groundH(x, z), wr = Math.atan2(c[0] - a[0], c[1] - a[1]) + Math.PI / 2;
            if (hh < 0.6) { for (let q = 0; q < 3; q++) for (let s2 = 0; s2 < 2 + Math.floor(hh * 6) % 3; s2++) { box(1.2, 0.14, 0.8, x + Math.sin(wr) * (q - 1) * 1.3, gy + 0.07 + s2 * 0.16, z + Math.cos(wr) * (q - 1) * 1.3, '#b08a5a', wr); } solidAt(x, z, 1.6, 0.6); }
            else if (hh < 0.85) { const col = ['#2a5a8a', '#c8762a', '#5a6b3a', '#8a2a2a'][Math.floor(hh * 37) % 4]; box(5.5, 0.15, 2.3, x, gy + 0.2, z, col, wr); for (const sd of [-1, 1]) box(5.5, 1.4, 0.08, x + Math.sin(wr) * 1.12 * sd, gy + 0.9, z + Math.cos(wr) * 1.12 * sd, col, wr); for (const se of [-1, 1]) box(0.08, 1.4, 2.3, x + Math.cos(wr) * 2.72 * se, gy + 0.9, z - Math.sin(wr) * 2.72 * se, col, wr); solidAt(x, z, 2.4, 1.6); }
            else { const col = ['#c8762a', '#2a6fb0', '#8a8f94'][Math.floor(hh * 53) % 3]; box(6, 2.6, 2.4, x, gy + 1.3, z, col, wr); solidAt(x, z, 2.6, 2.6); }
            placed++;
          }
        }
      }
      void ry;
    } else if (kind === 'piscina') { // the stone round the water and a ladder
      const gy = Math.min(...P.map(p => groundH(p[0], p[1])));
      try { const wb = Buf(); polyFill(wb, P, [], gy + 0.06, 10, COL('#5fb8d6')); mkMesh(wb, MAT.mark, 6, false, G); } catch (e) { }
      const Ap = sArea(P);
      for (let i = 0; i < P.length; i++) {
        const a = P[i], c = P[(i + 1) % P.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.1) continue; let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (Ap < 0) { nx = -nx; nz = -nz; }
        box(L + 0.9, 0.12, 0.45, (a[0] + c[0]) / 2 + nx * 0.22, gy + 0.08, (a[1] + c[1]) / 2 + nz * 0.22, '#e8e2d4', Math.atan2(c[0] - a[0], c[1] - a[1]) - Math.PI / 2);
      }
      const [lx0, lz0] = P[0], [lx1, lz1] = P[1], lm = [(lx0 + lx1) / 2, (lz0 + lz1) / 2];
      for (const o of [-0.25, 0.25]) { const ux = (lx1 - lx0) / (hyp(lx1 - lx0, lz1 - lz0) || 1), uz = (lz1 - lz0) / (hyp(lx1 - lx0, lz1 - lz0) || 1); cyl(0.025, 1.0, lm[0] + ux * o, gy + 0.6, lm[1] + uz * o, '#d9dcde', 6); }
    } else if (kind.startsWith('sport:')) lsPitch(A, P, kind.split(':')[1], kind.split(':')[2], lines, solid, box, cyl, G, solidAt);
  }
  yield 'terreni';
  if (drape.i.length) mkMesh(drape, MAT.mark, 2, false, G);
  if (lines.i.length) mkMesh(lines, MAT.mark, 3, false, G);
  if (solid.i.length) mkMesh(solid, LMAT.trim, 10, 'cast', G);
  if (doors.i.length) mkMesh(doors, LS_DOOR_MAT, 10, false, G);
  if (glass.i.length) mkMesh(glass, LS_GLASS, 12, false, G);
  const o3 = new THREE.Object3D(), inst = (geo, mat, list, sc, colOf) => {
    if (!list.length) return null; const im = new THREE.InstancedMesh(geo, mat, list.length); im.castShadow = true;
    list.forEach(([x, z, r], i) => { o3.position.set(x, groundH(x, z), z); o3.rotation.set(0, r || 0, 0); const k = sc ? sc(x, z) : 1; o3.scale.set(k, k, k); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); if (colOf) im.setColorAt(i, COL(colOf(x, z))); });
    G.add(im); return im;
  };
  inst(LS_BALE_G, LS_BALE_M, bales);
  inst(TREE_G.trunk, MAT.trunk, trees, () => 0.55);
  const crowns = inst(TREE_G.crown, MAT.crown, trees); // small fruit trees: the crown low on a short trunk
  if (crowns) trees.forEach(([x, z], i) => { o3.position.set(x, groundH(x, z) + 3.4 * 0.55 + 0.6, z); o3.rotation.set(0, 0, 0); o3.scale.set(0.6, 0.6, 0.6); o3.updateMatrix(); crowns.setMatrixAt(i, o3.matrix); crowns.setColorAt(i, COL(GREENS[Math.floor(LS_HASH(x, z, 'f') * 3)])); });
  inst(LS_POT_G, lam(0x4f7a35), pots, (x, z) => 0.7 + LS_HASH(x, z, 'p') * 0.6);
  if (!T.lsDone) {
    for (const [x, z, r, hh] of solids) { const gy = groundH(x, z); WALLS.add(x - r, z - r, x + r, z + r, { r, x, z, y0: gy - 3, y1: gy + hh }); }
    for (const [x, z] of bales) { const gy = groundH(x, z); WALLS.add(x - 0.8, z - 0.8, x + 0.8, z + 0.8, { r: 0.75, x, z, y0: gy - 3, y1: gy + 1.5 }); }
  }
  T.lsDone = true;
}
// ---- pitches: the lines of the game the map says, goals, hoops, a net; clay courts go red, sand goes sand
function lsPitch(A, P, sport, surface, lines, solid, box, cyl, G, solidAt) {
  const W = COL('#f4f2ea'), Ls = A.s1 - A.s0, Wv = A.v1 - A.v0, sm = (A.s0 + A.s1) / 2, vm = (A.v0 + A.v1) / 2, ry = Math.atan2(A.ux, A.uz);
  if (Ls < 6 || Wv < 4) return;
  const S = (a, b) => A.at(sm + a, vm + b), line = (a0, b0, a1, b1, w = 0.1) => lsLine(lines, A, sm + a0, vm + b0, sm + a1, vm + b1, w, W);
  const rect = (hl, hw) => { line(-hl, -hw, hl, -hw); line(hl, -hw, hl, hw); line(hl, hw, -hl, hw); line(-hl, hw, -hl, -hw); };
  const circle = (a, b, r, from = 0, to = TAU) => { const n = Math.max(8, Math.ceil(r * 3)); for (let k = 0; k < n; k++) { const t0 = from + (to - from) * k / n, t1 = from + (to - from) * (k + 1) / n; line(a + Math.cos(t0) * r, b + Math.sin(t0) * r, a + Math.cos(t1) * r, b + Math.sin(t1) * r, 0.08); } };
  const gyAt = (a, b) => { const [x, z] = S(a, b); return [x, groundH(x, z), z]; };
  const surf = { clay: '#c0663f', sand: '#e2cf9a', grass: null, artificial_turf: '#5e9a4a', asphalt: '#6e7378', concrete: '#9a9a96', tartan: '#b5523c' }[surface];
  if (surf) { try { const sb = VBuf(); polyFill(sb, P, [], 0.05, 10, COL(surf)); mkMesh(sb, MAT.mark, 2, false, G); } catch (e) { } }
  const hl = Ls / 2 - 0.6, hw = Wv / 2 - 0.6;
  if (sport === 'soccer' || sport === 'five-a-side') {
    rect(hl, hw); line(0, -hw, 0, hw); circle(0, 0, Math.min(9.15, hw * 0.3));
    const pd = Math.min(16.5, hl * 0.3), pw = Math.min(20.15, hw * 0.6), gw = Math.min(7.32, Math.max(3, hw * 0.35)), gh = gw > 5 ? 2.44 : 2;
    for (const e of [-1, 1]) {
      line(e * hl, -pw, e * (hl - pd), -pw); line(e * (hl - pd), -pw, e * (hl - pd), pw); line(e * (hl - pd), pw, e * hl, pw);
      const [gx, gy, gz] = gyAt(e * (hl + 0.05), 0), side = [Math.sin(ry), Math.cos(ry)], across = [Math.sin(ry + Math.PI / 2), Math.cos(ry + Math.PI / 2)];
      for (const o of [-1, 1]) { box(0.12, gh, 0.12, gx + across[0] * o * gw / 2, gy + gh / 2, gz + across[1] * o * gw / 2, '#f4f2ea'); box(0.06, gh, 0.06, gx + across[0] * o * gw / 2 + side[0] * e * 1.5, gy + gh / 2, gz + across[1] * o * gw / 2 + side[1] * e * 1.5, '#d9dcde'); solidAt(gx + across[0] * o * gw / 2, gz + across[1] * o * gw / 2, 0.12, gh); }
      box(gw + 0.12, 0.12, 0.12, gx, gy + gh, gz, '#f4f2ea', ry + Math.PI / 2); box(gw, 0.05, 1.5, gx + side[0] * e * 0.75, gy + gh, gz + side[1] * e * 0.75, '#e8e8e8', ry + Math.PI / 2);
      const net = Buf(); for (const [p0, p1] of [[[-gw / 2, 0], [gw / 2, 0]]]) { const off = 1.5 * e, j = 0; void p0; void p1; void j; const pts = [[-gw / 2, 0], [gw / 2, 0], [gw / 2, gh], [-gw / 2, gh]].map(([o, y]) => [gx + across[0] * o + side[0] * off, gy + y, gz + across[1] * o + side[1] * off]); const i = net.p.length / 3; for (const p of pts) vtx(net, p[0], p[1], p[2], side[0], 0, side[1], (p[0] - gx) / 1, p[1] / 1); net.i.push(i, i + 1, i + 2, i, i + 2, i + 3); }
      mkMesh(net, MAT.net, 11, false, G);
    }
  } else if (sport === 'basketball' || sport === 'multi') {
    const cl = Math.min(14, hl), cw = Math.min(7.5, hw); rect(cl, cw); line(0, -cw, 0, cw); circle(0, 0, 1.8);
    for (const e of [-1, 1]) {
      line(e * cl, -2.45, e * (cl - 5.8), -2.45); line(e * (cl - 5.8), -2.45, e * (cl - 5.8), 2.45); line(e * (cl - 5.8), 2.45, e * cl, 2.45); circle(e * (cl - 5.8), 0, 1.8, e > 0 ? Math.PI / 2 : -Math.PI / 2, e > 0 ? Math.PI * 1.5 : Math.PI / 2);
      const [px, py, pz] = gyAt(e * (cl + 1.0), 0), [bx, , bz] = gyAt(e * (cl - 1.2), 0), [rx, , rz] = gyAt(e * (cl - 1.6), 0);
      cyl(0.08, 3.4, px, py + 1.7, pz, '#3a3d40', 8); box(0.1, 0.1, 2.2, (px + bx) / 2, py + 3.3, (pz + bz) / 2, '#3a3d40', ry); box(0.05, 1.05, 1.8, bx, py + 3.4, bz, '#f4f2ea', ry);
      F0geo(solid, new THREE.TorusGeometry(0.23, 0.02, 6, 16).rotateX(Math.PI / 2).translate(rx, py + 3.05, rz), '#e86a2a'); solidAt(px, pz, 0.15, 3.5);
    }
  } else if (sport === 'tennis') {
    const cl = Math.min(11.885, hl), cw = Math.min(5.485, hw), sw = cw * 4.115 / 5.485; rect(cl, cw); line(-cl, -sw, cl, -sw); line(-cl, sw, cl, sw);
    for (const e of [-1, 1]) line(e * cl * 6.4 / 11.885, -sw, e * cl * 6.4 / 11.885, sw); line(-cl * 6.4 / 11.885, 0, cl * 6.4 / 11.885, 0);
    lsNet(A, sm, vm, cw + 0.9, 1.07, 0.95, G, box);
  } else if (sport === 'volleyball' || sport === 'beachvolleyball') {
    const cl = Math.min(9, hl), cw = Math.min(4.5, hw); rect(cl, cw); line(0, -cw, 0, cw); lsNet(A, sm, vm, cw + 0.6, 2.43, 1.0, G, box);
  } else if (sport === 'boules' || sport === 'bowls') { // the boards round a bocce court
    const [ax, , az] = gyAt(0, 0); void ax; void az;
    for (const [a0, b0, a1, b1] of [[-hl, -hw, hl, -hw], [-hl, hw, hl, hw], [-hl, -hw, -hl, hw], [hl, -hw, hl, hw]]) { const [x0, y0, z0] = gyAt(a0, b0), [x1, , z1] = gyAt(a1, b1); box(hyp(x1 - x0, z1 - z0) + 0.2, 0.3, 0.12, (x0 + x1) / 2, y0 + 0.15, (z0 + z1) / 2, '#8a6a4a', Math.atan2(x1 - x0, z1 - z0) - Math.PI / 2); }
  }
  function F0geo(b, g, col) { lmFrame(new THREE.Matrix4()).geo(b, g, null, COL(col)); }
}
function lsNet(A, sm, vm, half, postH, netH, G, box, y0 = 0) { // posts at the sides, the net across the middle
  const ry = Math.atan2(A.ux, A.uz), [ax, az] = A.at(sm, vm - half), [bx, bz] = A.at(sm, vm + half), ga = groundH(ax, az), gb = groundH(bx, bz);
  box(0.08, postH + y0, 0.08, ax, ga + (postH + y0) / 2, az, '#3a3d40'); box(0.08, postH + y0, 0.08, bx, gb + (postH + y0) / 2, bz, '#3a3d40');
  const net = Buf(), top = Math.min(ga, gb) + y0 + postH, i = 0; void i; void ry;
  vtx(net, ax, top - netH, az, A.ux, 0, A.uz, 0, 0); vtx(net, bx, top - netH, bz, A.ux, 0, A.uz, half * 2, 0); vtx(net, bx, top, bz, A.ux, 0, A.uz, half * 2, netH); vtx(net, ax, top, az, A.ux, 0, A.uz, 0, netH); net.i.push(0, 1, 2, 0, 2, 3);
  mkMesh(net, MAT.net, 11, false, G); box(0.03, 0.06, half * 2, (ax + bx) / 2, top, (az + bz) / 2, '#f4f2ea', ry);
}
