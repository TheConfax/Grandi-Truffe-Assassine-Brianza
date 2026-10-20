// ---------------------------------------------------------------- terrain (TINITALY 10 m, INGV)
const TER = D.terrain;
const TH = (() => { const bin = atob(TER.h16), n = bin.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 10; return f; })();
// the bank the covered stair between the Diaz and the Anna Frank climbs: the 10 m model smooths it into a gentle slope, so the field at its
// foot is dug a few metres lower, fading out within twenty metres and never across the road to the south
{
  const A = [-578.8, -718.1], B = [-549.3, -727.1], DROP = 3.2, ex = B[0] - A[0], ez = B[1] - A[1], L2 = ex * ex + ez * ez, Ln = Math.sqrt(L2);
  for (let j = 0; j < TER.nz; j++) for (let i = 0; i < TER.nx; i++) {
    const x = TER.x0 + i * TER.step, z = TER.z0 + j * TER.step; if (Math.abs(x - A[0]) > 60 || Math.abs(z - A[1]) > 60) continue;
    const t = ((x - A[0]) * ex + (z - A[1]) * ez) / L2, side = ((x - A[0]) * ez - (z - A[1]) * ex) / Ln, tc = Math.max(0, Math.min(1, t));
    const d = Math.hypot(x - A[0] - ex * tc, z - A[1] - ez * tc), reach = side < 0 ? 8 : 22; // side < 0: towards the road
    const k = Math.max(0, 1 - d / reach) * Math.max(0, 1 - Math.max(0, t) * 1.15);
    TH[j * TER.nx + i] -= DROP * k * k * (3 - 2 * k);
  }
}
function groundH(x, z) {
  const fx = clamp((x - TER.x0) / TER.step, 0, TER.nx - 1.001), fz = clamp((z - TER.z0) / TER.step, 0, TER.nz - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * TER.nx + i;
  // same two triangles per cell as the terrain mesh, so cars, roads and the visible ground agree exactly
  const h00 = TH[k], h10 = TH[k + 1], h01 = TH[k + TER.nx], h11 = TH[k + TER.nx + 1];
  return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
}
const FBuf = () => Object.assign(Buf(), { drape: true });
const VBuf = () => Object.assign(Buf(), { drape: true, vis: true }); // drapes on the visible (river-carved) terrain
const RIVG = new Grid(24), RIV_D = 2.4;
for (const td of D.tiles) for (const r of td.rv || []) { const pts = dec(r.p); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], m = r.w + 1; RIVG.add(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, { a, b, w: r.w, ca: k === 1 && !!(r.e && r.e[0]), cb: k === pts.length - 1 && !!(r.e && r.e[1]) }); } }
function riverCut(x, z) {
  let c = 0;
  RIVG.each(x, z, x, z, s => {
    const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1, t0 = ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2;
    if ((t0 < 0 && s.ca) || (t0 > 1 && s.cb)) return; // square end at a culvert / bridge mouth
    const t = clamp(t0, 0, 1), d = hyp(x - s.a[0] - ex * t, z - s.a[1] - ez * t);
    if (d < s.w + 0.4) c = Math.max(c, d < s.w ? RIV_D : RIV_D * (s.w + 0.4 - d) / 0.4);
  });
  return c;
}
const visH = (x, z) => groundH(x, z) - riverCut(x, z);
// coarse backdrop terrain for the far distance (fine patches are built per tile)
{
  const S = 4, b = Buf(), nx = Math.floor((TER.nx - 1) / S) + 1, nz = Math.floor((TER.nz - 1) / S) + 1;
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) { const x = TER.x0 + i * S * TER.step, z = TER.z0 + j * S * TER.step; vtx(b, x, TH[j * S * TER.nx + i * S] - 0.7, z, 0, 1, 0, x / 10, z / 10); }
  for (let j = 0; j < nz - 1; j++) for (let i = 0; i < nx - 1; i++) { const k = j * nx + i; triUp(b, k, k + 1, k + nx + 1); triUp(b, k, k + nx + 1, k + nx); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setIndex(b.i); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ map: groundTex, depthWrite: false })); m.renderOrder = -3; m.receiveShadow = true; scene.add(m);
  const dm = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ colorWrite: false, stencilWrite: true, stencilRef: 1, stencilFunc: THREE.NotEqualStencilFunc })); dm.position.y = -3.2; // not where a pit is dug (stencil 1) dm.renderOrder = -1; scene.add(dm);
}

// ---------------------------------------------------------------- tiles & static data
const TS = META.tile, NTX = META.ntx, NTZ = META.ntz;
const TILES = D.tiles.map((d, t) => ({ t, d, cx: -META.hw + (t % NTX + 0.5) * TS, cz: -META.hh + (Math.floor(t / NTX) + 0.5) * TS, built: false, group: null, parked: null, bld: [], fe: [], tr: [], sd: [] }));
const tileOf = (x, z) => clamp(Math.floor((x + META.hw) / TS), 0, NTX - 1) + NTX * clamp(Math.floor((z + META.hh) / TS), 0, NTZ - 1);
const BUILDINGS = [];
const SIDEG = new Grid(24), DECKG = new Grid(16), ROADSEG = new Grid(24), STREETS = new Grid(24), NODEG = new Grid(40);
const SIDE_H = 0.15;
const PLATG = new Grid(24), PLAT_H = 0.55; // railway platforms (banchine), raised above the rails
function onAnyRoad(x, z, m) { let f = false; ROADSEG.each(x - 12, z - 12, x + 12, z + 12, s => { if (!f && !s.r.d && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + m) f = true; }); return f; }
function segDist(px, pz, ax, az, bx, bz) { const ex = bx - ax, ez = bz - az, L2 = ex * ex + ez * ez || 1; const t = clamp(((px - ax) * ex + (pz - az) * ez) / L2, 0, 1); return hyp(px - ax - ex * t, pz - az - ez * t); }
function resample(pts, step) {
  const o = [pts[0]];
  for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], n = Math.max(1, Math.ceil(hyp(b[0] - a[0], b[1] - a[1]) / step)); for (let i = 1; i <= n; i++) o.push([lerp(a[0], b[0], i / n), lerp(a[1], b[1], i / n)]); }
  return o;
}
const bbox = pts => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const [x, z] of pts) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (z < z0) z0 = z; if (z > z1) z1 = z; } return [x0, z0, x1, z1]; };
// places the map fills with trees that are open ground: playing fields
const NO_TREES = [
  [[-408.6, 279.7], [-378.5, 452.1], [-276.1, 434.2], [-306.2, 261.8]], // Stadio Mino Favini
  [[-1835.9, 1110.2], [-1797.9, 1281.0], [-1702.2, 1259.7], [-1740.2, 1088.9]], // Stadio comunale di Seveso
  [[-741.4, 767.4], [-684.8, 778.6], [-697.6, 837.8], [-754.3, 826.0]], // the cloister of the Seminario di Seveso: its own four trees
];
// hedges the map draws where a landmark lays out its own garden
const NO_HEDGES = [
  [[-741.4, 767.4], [-684.8, 778.6], [-697.6, 837.8], [-754.3, 826.0]], // the cloister of the Seminario di Seveso
];
// buildings in the map that are not there (mostly from Overture): dropped by the centroid of their footprint
const GHOSTS = [
  [1243.7, -553.8], [1261.4, -549.6], // a house and a shed across the Curie drive from via Marie Curie
];
// walls missing from the map, as barriers of the tile their first point falls in: { p, t (1 wall, 2 low wall with railing, 3 hedge), h }
const EXTRA_BARRIERS = [
  { p: [[-566.2, 870.2], [-570.0, 888.0], [-573.9, 906.5]], t: 1, h: 1.7 }, // the Seminario park wall along via Verga, between the two pieces OSM has
];
for (const e of EXTRA_BARRIERS) { const d = TILES[tileOf(e.p[0][0], e.p[0][1])].d, enc = []; let px = 0, pz = 0; for (const [x, z] of e.p) { const X = Math.round(x * 10), Z = Math.round(z * 10); enc.push(X - px, Z - pz); px = X; pz = Z; } (d.ba || (d.ba = [])).push({ p: enc, t: e.t, h: e.h }); }
for (const T of TILES) {
  const d = T.d;
  for (const B of d.b || []) {
    const outer = dec(B.p); if (outer.length < 3) continue;
    { const [gx, gz] = centroid(outer); if (GHOSTS.some(([x, z]) => hyp(gx - x, gz - z) < 1.5)) continue; }
    const holes = (B.k || []).map(dec).filter(h => h.length >= 3), bb = bbox(outer);
    const rec = { pts: outer, holes, h: B.h, t: B.t, bb, g: B.g }; // g: 1 garages, 2 greenhouse (paesaggio3.js)
    T.bld.push(rec);
    if (B.t === 9) { for (const [x, z] of outer.length <= 10 ? outer : []) { const gy = groundH(x, z); WALLS.add(x - 0.2, z - 0.2, x + 0.2, z + 0.2, { r: 0.15, x, z, y0: gy - 3, y1: gy + B.h + 2 }); } continue; }
    BUILDINGS.push(rec); BLD.add(bb[0], bb[1], bb[2], bb[3], rec);
    const gys = outer.map(p => groundH(p[0], p[1])), by0 = Math.min(...gys) - 3, by1 = Math.max(...gys) + B.h + 3;
    for (const [ring, isHole] of [[outer, false], ...holes.map(h => [h, true])]) {
      const A = sArea(ring);
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], L = hyp(dx, dz); if (L < 0.05) continue;
        let nx = dz / L, nz = -dx / L; if ((A < 0) !== isHole) { nx = -nx; nz = -nz; }
        WALLS.add(a[0], a[1], c[0], c[1], { ax: a[0], az: a[1], bx: c[0], bz: c[1], nx, nz, y0: by0, y1: by1 });
      }
    }
  }
  for (const f of d.fe || []) T.fe.push(resample(dec(f.p), 3)); // fences follow the ground every 3 m (walls and collisions are built later)
  for (const [X, Z] of d.tr || []) { const x = X / 10, z = Z / 10, gy = groundH(x, z); if (NO_TREES.some(q => inPoly(x, z, q))) continue; T.tr.push([x, z]); WALLS.add(x - 0.4, z - 0.4, x + 0.4, z + 0.4, { r: 0.4, x, z, y0: gy - 3, y1: gy + 5 }); }
  for (const br of d.ba || []) {
    if (br.t === 3 && NO_HEDGES.some(q => dec(br.p).every(([x, z]) => inPoly(x, z, q)))) continue; // drawn by the landmark, symmetrical
    const pts = resample(dec(br.p), 4); (T.ba || (T.ba = [])).push({ pts, t: br.t, h: br.h }); // follow the ground, not long chords
    for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], c = pts[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue; const gy = groundH((a[0] + c[0]) / 2, (a[1] + c[1]) / 2); WALLS.add(a[0], a[1], c[0], c[1], { ax: a[0], az: a[1], bx: c[0], bz: c[1], nx: (c[1] - a[1]) / L, nz: -(c[0] - a[0]) / L, two: true, y0: gy - 3, y1: gy + Math.max(1.2, br.h) }); }
  }
  for (const q of d.sd || []) {
    const o = dec(q.p), k = q.k.map(dec), bb = bbox(o); if (o.length < 3) continue;
    let per = 0; for (let i = 0; i < o.length; i++) per += hyp(o[(i + 1) % o.length][0] - o[i][0], o[(i + 1) % o.length][1] - o[i][1]);
    const A = Math.abs(sArea(o)); if (A < 10 || A / per < 0.45) continue; // shards and slivers left between junctions are not sidewalks
    const rec = { o, k, bb }; T.sd.push(rec); SIDEG.add(bb[0], bb[1], bb[2], bb[3], rec);
  }
  for (const q of d.a || []) if (q.t === 5) { const o = dec(q.p); if (o.length < 3) continue; const rec = { o, k: (q.k || []).map(dec), bb: bbox(o) }; (T.pf || (T.pf = [])).push(rec); PLATG.add(rec.bb[0], rec.bb[1], rec.bb[2], rec.bb[3], rec); }
}
function inBuilding(x, z, m = 0) {
  let f = false;
  BLD.each(x - m, z - m, x + m, z + m, b => { if (!f && x >= b.bb[0] - m && x <= b.bb[2] + m && z >= b.bb[1] - m && z <= b.bb[3] + m && inPoly(x, z, b.pts) && !b.holes.some(h => inPoly(x, z, h))) f = true; });
  if (!f && m > 0) WALLS.each(x - m, z - m, x + m, z + m, s => { if (!s.r && !s.two && !s.deckw && segDist(x, z, s.ax, s.az, s.bx, s.bz) < m) f = true; });
  return f;
}
function onFoot(x, z) { let f = false; ROADSEG.each(x - 6, z - 6, x + 6, z + 6, s => { if (!f && s.r.c === 6 && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + 0.5) f = true; }); return f; }
function onPlatform(x, z) { let f = false; PLATG.each(x, z, x, z, s => { if (!f && x >= s.bb[0] && x <= s.bb[2] && z >= s.bb[1] && z <= s.bb[3] && inPoly(x, z, s.o) && !s.k.some(h => inPoly(x, z, h))) f = true; }); return f; }
function onSide(x, z) {
  let f = false;
  SIDEG.each(x, z, x, z, s => { if (!f && x >= s.bb[0] && x <= s.bb[2] && z >= s.bb[1] && z <= s.bb[3] && inPoly(x, z, s.o) && !s.k.some(h => inPoly(x, z, h))) f = true; });
  return f;
}

// ---------------------------------------------------------------- roads, decks (sopraelevate), graphs
const RIVER_RAILS = [];
const nodeY = i => NHt[i] !== null ? NHt[i] : groundH(N[i][0], N[i][1]);
const NODE_DEG = new Array(N.length).fill(0);
for (const r of D.roads) if (r.c <= 4) { const g = r.g; for (let k = 0; k < g.length; k++) NODE_DEG[g[k]] += (k === 0 || k === g.length - 1) ? 1 : 2; }
N.forEach(([x, z], i) => NODEG.add(x, z, x, z, { i }));
D.roads.forEach((r, ri) => {
  r.lane = r.o ? 0 : Math.min(r.w * 0.24, r.mh * 0.5); r.walk = r.wk; r.long = r.t && true;
  for (let k = 1; k < r.g.length; k++) {
    const a = N[r.g[k - 1]], b = N[r.g[k]];
    ROADSEG.add(a[0], a[1], b[0], b[1], { a, b, r, ia: r.g[k - 1], ib: r.g[k] });
    if (r.n >= 0 && r.c <= 5) STREETS.add(a[0], a[1], b[0], b[1], { a, b, n: D.names[r.n], w: r.w });
    if (r.d) { const ya = nodeY(r.g[k - 1]), yb = nodeY(r.g[k]), hw = r.w / 2, m = hw + (r.b ? 0 : 14); DECKG.add(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, { ax: a[0], az: a[1], bx: b[0], bz: b[1], ya, yb, hw, r, emb: !r.b }); }
  }
});
function roadBelow(x, z, y, m, self) { let f = false; ROADSEG.each(x - 14, z - 14, x + 14, z + 14, s => { if (f || s.r === self) return; const d = segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]); if (d >= s.r.w / 2 + m) return; if (!s.r.d) { f = true; return; } const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2, 0, 1); if (lerp(nodeY(s.ia), nodeY(s.ib), t) < y - 2) f = true; }); return f; }
function nearLowRail(x, z, m) { let f = false; LOWRAILG.each(x - m, z - m, x + m, z + m, s => { if (!f && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < m) f = true; }); return f; }
function nearRail(x, z, m) { let f = false; RAILG.each(x - m, z - m, x + m, z + m, s => { if (!f && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < m) f = true; }); return f; }
const RAILG = new Grid(24), LOWRAILG = new Grid(24);
for (const td of D.tiles) for (const f of td.rl || []) { if (f.h) continue; const pts = dec(f.p); for (let k = 1; k < pts.length; k++) LOWRAILG.add(Math.min(pts[k - 1][0], pts[k][0]), Math.min(pts[k - 1][1], pts[k][1]), Math.max(pts[k - 1][0], pts[k][0]), Math.max(pts[k - 1][1], pts[k][1]), { a: pts[k - 1], b: pts[k] }); }
for (const td of D.tiles) for (const f of td.rl || []) { const pts = dec(f.p); for (let k = 1; k < pts.length; k++) RAILG.add(Math.min(pts[k - 1][0], pts[k][0]), Math.min(pts[k - 1][1], pts[k][1]), Math.max(pts[k - 1][0], pts[k][0]), Math.max(pts[k - 1][1], pts[k][1]), { a: pts[k - 1], b: pts[k] }); }
// guardrails along ground-level expressways (both sides; links and junctions stay open)
const FLAT_RAILS = [];
for (const r of D.roads) if (r.x && !r.d && !r.t && r.c === 0) {
  for (let k = 1; k < r.g.length; k++) {
    const a = N[r.g[k - 1]], b = N[r.g[k]], L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 1) continue;
    if (NODE_DEG[r.g[k - 1]] >= 3 && NODE_DEG[r.g[k]] >= 3 && L < 30) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, rx = -uz, rz = ux;
    for (let s0 = 0; s0 < L; s0 += 4) {
      const s1 = Math.min(L, s0 + 4), x0 = a[0] + ux * s0, z0 = a[1] + uz * s0, x1 = a[0] + ux * s1, z1 = a[1] + uz * s1;
      if ((NODE_DEG[r.g[k - 1]] >= 3 && s0 < 25) || (NODE_DEG[r.g[k]] >= 3 && s1 > L - 25)) continue;
      for (const sd of [1, -1]) {
        const w = r.w / 2 + 0.4, gx = (x0 + x1) / 2 + rx * sd * w, gz = (z0 + z1) / 2 + rz * sd * w;
        let other = false; ROADSEG.each(gx - 4, gz - 4, gx + 4, gz + 4, o => { if (!other && o.r !== r && o.r.c <= 5 && segDist(gx, gz, o.a[0], o.a[1], o.b[0], o.b[1]) < o.r.w / 2 + 0.3) other = true; });
        if (other) continue;
        const y0 = groundH(x0 + rx * sd * w, z0 + rz * sd * w), y1 = groundH(x1 + rx * sd * w, z1 + rz * sd * w);
        const seg = { ax: x0 + rx * sd * w, az: z0 + rz * sd * w, bx: x1 + rx * sd * w, bz: z1 + rz * sd * w, nx: -rx * sd, nz: -rz * sd, two: true, y0: Math.min(y0, y1) - 2, y1: Math.max(y0, y1) + 2.5, deckw: true };
        WALLS.add(seg.ax, seg.az, seg.bx, seg.bz, seg); FLAT_RAILS.push({ x0: seg.ax, z0: seg.az, x1: seg.bx, z1: seg.bz, y0, y1 });
      }
    }
  }
}
// collisions for elevated roads: guardrails on top, embankment toes and pillars below
const DECK_SOLIDS = [];
for (const r of D.roads) if (r.d) {
  const pts = r.g.map(i => [N[i][0], N[i][1], nodeY(i)]);
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], b = pts[k], L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 0.2) continue;
    const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, rx = -uz, rz = ux, n = Math.max(1, Math.ceil(L / 4));
    for (let s = 0; s < n; s++) {
      const t0 = s / n, t1 = (s + 1) / n, x0 = lerp(a[0], b[0], t0), z0 = lerp(a[1], b[1], t0), x1 = lerp(a[0], b[0], t1), z1 = lerp(a[1], b[1], t1);
      const y0 = lerp(a[2], b[2], t0), y1 = lerp(a[2], b[2], t1), ym = (y0 + y1) / 2, off = ym - groundH((x0 + x1) / 2, (z0 + z1) / 2);
      if (off < 0.6) continue;
      for (const sd of [1, -1]) {
        const ex = rx * sd, ez = rz * sd, gx = (x0 + x1) / 2 + ex * (r.w / 2 + 0.3), gz = (z0 + z1) / 2 + ez * (r.w / 2 + 0.3);
        let shared = false; DECKG.each(gx - 3, gz - 3, gx + 3, gz + 3, o => { if (o.r !== r && segDist(gx, gz, o.ax, o.az, o.bx, o.bz) < o.hw - 0.3) shared = true; });
        if (off >= 1.4 && !shared) {
          const w = r.w / 2 + 0.3, seg = { ax: x0 + ex * w, az: z0 + ez * w, bx: x1 + ex * w, bz: z1 + ez * w, nx: -ex, nz: -ez, two: true, y0: ym - 0.7, y1: ym + 3, deckw: true };
          WALLS.add(seg.ax, seg.az, seg.bx, seg.bz, seg); DECK_SOLIDS.push({ k: 'rail', r, x0: seg.ax, z0: seg.az, x1: seg.bx, z1: seg.bz, y0, y1 });
        }
      }
    }
    if (r.b) for (let s = 12; s < L - 4; s += 24) {
      const x = a[0] + ux * s, z = a[1] + uz * s, y = lerp(a[2], b[2], s / L), off = y - groundH(x, z);
      if (off < 2.5) continue;
      for (const o of r.w > 9 ? [-r.w / 3, r.w / 3] : [0]) { const px = x + rx * o, pz = z + rz * o; if (roadBelow(px, pz, y, 1.4, r) || nearRail(px, pz, 3.5)) continue; WALLS.add(px - 0.5, pz - 0.5, px + 0.5, pz + 0.5, { r: 0.45, x: px, z: pz, y0: -1e4, y1: y - 1.5, deckw: true }); DECK_SOLIDS.push({ k: 'pillar', x: px, z: pz, y }); }
    }
  }
}
// railway fences: solid, following the ground, never across the track
for (const T of TILES) {
  T.fe = T.fe.map(pts => pts.filter((p, i) => true)).map(pts => { const out = [], cur = []; for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], c = pts[k], mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; if (nearLowRail(mx, mz, 2.0)) { if (cur.length > 1) out.push(cur.slice()); cur.length = 0; continue; } if (!cur.length) cur.push(a); cur.push(c); } if (cur.length > 1) out.push(cur); return out; }).flat();
  for (const pts of T.fe) for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], c = pts[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue; const gy = groundH((a[0] + c[0]) / 2, (a[1] + c[1]) / 2); WALLS.add(a[0], a[1], c[0], c[1], { ax: a[0], az: a[1], bx: c[0], bz: c[1], nx: (c[1] - a[1]) / L, nz: -(c[0] - a[0]) / L, two: true, y0: gy - 3, y1: gy + 2.2 }); }
}
// elevated railway: the embankment / viaduct sides are solid (open where a street passes underneath)
for (const td of D.tiles) for (const r of td.rl || []) {
  if (!r.h) continue; const p0 = dec(r.p), hs = r.h.map((v, i) => v === -32768 ? groundH(p0[i][0], p0[i][1]) : v / 10);
  for (let k = 1; k < p0.length; k++) {
    const A = p0[k - 1], B = p0[k], L = hyp(B[0] - A[0], B[1] - A[1]); if (L < 0.1) continue;
    const n = Math.max(1, Math.ceil(L / 3)), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L, rx = -uz, rz = ux;
    for (let s = 0; s < n; s++) {
      const x0 = lerp(A[0], B[0], s / n), z0 = lerp(A[1], B[1], s / n), x1 = lerp(A[0], B[0], (s + 1) / n), z1 = lerp(A[1], B[1], (s + 1) / n), mx = (x0 + x1) / 2, mz = (z0 + z1) / 2;
      const y = lerp(hs[k - 1], hs[k], (s + 0.5) / n), g = groundH(mx, mz); if (y - g < 1.0 || onAnyRoad(mx, mz, 3.0) || nearLowRail(mx, mz, 4.5)) continue;
      for (const sd of [1, -1]) { const ax = x0 + rx * 2.3 * sd, az = z0 + rz * 2.3 * sd, bx = x1 + rx * 2.3 * sd, bz = z1 + rz * 2.3 * sd; WALLS.add(ax, az, bx, bz, { ax, az, bx, bz, nx: rx * sd, nz: rz * sd, two: true, y0: g - 3, y1: y + 1 }); }
    }
  }
}
for (const td of D.tiles) for (const r of td.rv || []) {
  const pts = dec(r.p), W = r.w + 0.25;
  for (let k = 1; k < pts.length; k++) {
    const a = pts[k - 1], c = pts[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
    const nx = -(c[1] - a[1]) / L, nz = (c[0] - a[0]) / L;
    for (const sd of [1, -1]) {
      const ax = a[0] + nx * W * sd, az = a[1] + nz * W * sd, bx = c[0] + nx * W * sd, bz = c[1] + nz * W * sd, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      if (onAnyRoad(mx, mz, 1.5)) continue; const gy = groundH(mx, mz);
      WALLS.add(ax, az, bx, bz, { ax, az, bx, bz, nx: nx * sd, nz: nz * sd, two: true, y0: gy - 4, y1: gy + 1.1 });
    }
  }
  for (const [ei, E, F] of [[0, pts[0], pts[1]], [1, pts[pts.length - 1], pts[pts.length - 2]]]) {
    if (!r.e || !r.e[ei] || !F) continue;
    const L = hyp(F[0] - E[0], F[1] - E[1]) || 1, ux = (F[0] - E[0]) / L, uz = (F[1] - E[1]) / L, nx = -uz, nz = ux, gy = groundH(E[0], E[1]), Wc = r.w + 0.3;
    const ax = E[0] - nx * Wc, az = E[1] - nz * Wc, bx = E[0] + nx * Wc, bz = E[1] + nz * Wc;
    WALLS.add(ax, az, bx, bz, { ax, az, bx, bz, nx: ux, nz: uz, two: true, y0: gy - 4, y1: gy + 1.1 });
  }
}
function surfAt(x, z, cy) { // ground or deck under (x,z), never more than a kerb above the current height
  const rc = riverCut(x, z);
  let y = groundH(x, z) - (rc > 0 && !onAnyRoad(x, z, 0.3) ? rc : 0) + (onSide(x, z) ? SIDE_H : onPlatform(x, z) ? PLAT_H : bumpAt(x, z));
  if (cy === undefined) return y;
  let under;
  DECKG.each(x, z, x, z, s => {
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - s.ax) * ex + (z - s.az) * ez) / L2, 0, 1), d = hyp(x - s.ax - ex * t, z - s.az - ez * t);
    // an embankment is solid earth: nothing can be inside it, except a street or railway passing through an opening
    const solid = () => under === undefined ? (under = onAnyRoad(x, z, 0.6) || nearLowRail(x, z, 3)) : under;
    if (d <= s.hw + 0.4) { const dy = lerp(s.ya, s.yb, t) + 0.06; if (dy > y && (dy <= cy + 0.8 || (s.emb && !solid()))) y = dy; return; }
    const dy0 = lerp(s.ya, s.yb, t) + 0.06;
    if (d <= s.hw + 4.5 && dy0 > y && dy0 <= cy + 0.8) { // gore: squeezed between this deck and another one at the same height
      let gore = false; DECKG.each(x, z, x, z, o => { if (gore || o.r === s.r) return; const oex = o.bx - o.ax, oez = o.bz - o.az, oL = oex * oex + oez * oez || 1, ot = clamp(((x - o.ax) * oex + (z - o.az) * oez) / oL, 0, 1), od = hyp(x - o.ax - oex * ot, z - o.az - oez * ot); if (od <= o.hw + 4.5 && Math.abs(lerp(o.ya, o.yb, ot) + 0.06 - dy0) < 1.0 && (d - s.hw) + (od - o.hw) < 6) gore = true; });
      if (gore) { y = dy0; return; }
    }
    if (s.emb && !solid()) { // grassy embankment slope (1 : 1.3) you can drive up; it stops short of any street beside it
      const dy = dy0, off = dy - groundH(x, z), wmax = Math.min(14, 1.3 * off);
      if (off > 0.2 && d < s.hw + wmax) {
        const ex = (x - s.ax - (s.bx - s.ax) * t) / (d || 1), ez = (z - s.az - (s.bz - s.az) * t) / (d || 1), bx0 = s.ax + (s.bx - s.ax) * t + ex * s.hw, bz0 = s.az + (s.bz - s.az) * t + ez * s.hw;
        let w = wmax; for (let k = 1; k < wmax; k += 1) if (onAnyRoad(bx0 + ex * k, bz0 + ez * k, 0.3)) { w = Math.max(0.4, k - 1); break; }
        if (d < s.hw + w) { const sy = dy - (d - s.hw) / w * off; if (sy > y) y = sy; }
      }
    }
  });
  return y;
}
function streetAt(x, z) {
  let best = null, bd = 16;
  STREETS.each(x - 16, z - 16, x + 16, z + 16, s => { const d = segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) - s.w / 2; if (d < bd) { bd = d; best = s.n; } });
  return best;
}
const PLACES = D.places;
function placeAt(x, z) {
  let best = null, bd = 1e18;
  for (const p of PLACES) { const w = p.k === 'town' ? 0.55 : p.k === 'village' ? 0.7 : 1, d = hyp(p.x - x, p.z - z) * w; if (d < bd) { bd = d; best = p.n; } }
  return best;
}
function nearestRoadPoint(x, z, maxC = 5, R = 60) {
  let best = null, bd = 1e9;
  ROADSEG.each(x - R, z - R, x + R, z + R, s => {
    if (s.r.c > maxC || s.r.d || s.r.t) return; const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2, 0, 1);
    const px = s.a[0] + ex * t, pz = s.a[1] + ez * t, d = hyp(px - x, pz - z);
    if (d < bd && !inBuilding(px, pz, 0)) { bd = d; best = { x: px, z: pz, r: { minHalf: s.r.mh }, d }; }
  });
  return best;
}
const nearJunction = (x, z, r) => { let f = false; NODEG.each(x - r, z - r, x + r, z + r, ({ i }) => { if (!f && NODE_DEG[i] >= 3 && hyp(N[i][0] - x, N[i][1] - z) < r) f = true; }); return f; };
const clearance = (x, z, dx, dz, max) => rayWalls(x, z, x + dx * max, z + dz * max, true) * max;

// ---------------------------------------------------------------- level crossings (passaggi a livello)
const RAILPTS = [];
for (const T of TILES) for (const f of T.d.rl || []) { const p = dec(f.p); p.hs = f.h ? f.h.map(v => v === -32768 ? null : v / 10) : null; RAILPTS.push(p); }
const LX = [];
{
  const segInt = (a, b, c, d) => {
    const r1x = b[0] - a[0], r1z = b[1] - a[1], r2x = d[0] - c[0], r2z = d[1] - c[1], den = r1x * r2z - r1z * r2x; if (Math.abs(den) < 1e-9) return null;
    const t = ((c[0] - a[0]) * r2z - (c[1] - a[1]) * r2x) / den, u = ((c[0] - a[0]) * r1z - (c[1] - a[1]) * r1x) / den;
    return t >= -0.001 && t <= 1.001 && u >= 0 && u <= 1 ? [a[0] + r1x * t, a[1] + r1z * t] : null;
  };
  for (const rp of RAILPTS) for (let j = 1; j < rp.length; j++) {
    const c = rp[j - 1], d = rp[j];
    if (rp.hs && ((rp.hs[j - 1] !== null && rp.hs[j - 1] - groundH(c[0], c[1]) > 1) || (rp.hs[j] !== null && rp.hs[j] - groundH(d[0], d[1]) > 1))) continue;
    ROADSEG.each(Math.min(c[0], d[0]), Math.min(c[1], d[1]), Math.max(c[0], d[0]), Math.max(c[1], d[1]), s => {
      const r = s.r; if (r.c > 6 || r.d || r.t || r.u) return;
      const p = segInt(s.a, s.b, c, d); if (!p || !inLim(p[0], p[1], 5)) return;
      const L = hyp(s.b[0] - s.a[0], s.b[1] - s.a[1]) || 1;
      let g = LX.find(g => hyp(g.cx - p[0], g.cz - p[1]) < (g.r === r ? 18 : 6));
      if (!g) LX.push(g = { r, pts: [], ux: (s.b[0] - s.a[0]) / L, uz: (s.b[1] - s.a[1]) / L, cx: p[0], cz: p[1] });
      if (r.c < g.r.c) { g.r = r; g.ux = (s.b[0] - s.a[0]) / L; g.uz = (s.b[1] - s.a[1]) / L; }
      if (!g.pts.some(q => hyp(q[0] - p[0], q[1] - p[1]) < 0.5)) g.pts.push(p);
    });
  }
  for (const g of LX) {
    g.x = g.pts.reduce((s, p) => s + p[0], 0) / g.pts.length; g.z = g.pts.reduce((s, p) => s + p[1], 0) / g.pts.length;
    g.ext = Math.max(...g.pts.map(p => Math.abs((p[0] - g.x) * g.ux + (p[1] - g.z) * g.uz))) + 3.4;
    g.hw = Math.min(g.r.w / 2, g.r.mh + 0.2); g.drive = g.r.c <= 4; g.ang = 1; g.closed = false;
  }
}

// ---------------------------------------------------------------- graphs (traffic keeps right; long tunnels are off-limits)
const TRAF = N.map(() => []), DRIVE = N.map(() => []), WALK = N.map(() => []);
for (const r of D.roads) {
  if (r.t) continue;
  for (let k = 1; k < r.g.length; k++) {
    const a = r.g[k - 1], b = r.g[k], L = hyp(N[b][0] - N[a][0], N[b][1] - N[a][1]);
    const ok = inLim(N[a][0], N[a][1], 2) && inLim(N[b][0], N[b][1], 2), open = r.d || !inBuilding((N[a][0] + N[b][0]) / 2, (N[a][1] + N[b][1]) / 2, 0);
    if (r.c <= 6 && ok && !r.x) { WALK[a].push({ to: b, L, off: r.walk }); WALK[b].push({ to: a, L, off: r.walk }); }
    if (r.c <= 5 && ok && open) { DRIVE[a].push({ to: b, L }); DRIVE[b].push({ to: a, L }); }
    if (r.c <= 3 && ok && open) { TRAF[a].push({ to: b, L, off: r.lane, sp: r.sp || 10, w: r.w, o: !!r.o, x: !!r.x }); if (!r.o) TRAF[b].push({ to: a, L, off: r.lane, sp: r.sp || 10, w: r.w, o: false, x: !!r.x }); }
  }
}
const nodesWith = adj => N.map((_, i) => i).filter(i => adj[i].length);
const TRAF_NODES = nodesWith(TRAF), DRIVE_NODES = nodesWith(DRIVE), WALK_NODES = nodesWith(WALK);
const ADJ_OF = new Map([[TRAF_NODES, TRAF], [DRIVE_NODES, DRIVE], [WALK_NODES, WALK]]);
function nearestNode(list, x, z) {
  const adj = ADJ_OF.get(list);
  for (const R of [25, 60, 150, 400, 1200, 6000]) {
    let b = -1, bd = 1e18;
    NODEG.each(x - R, z - R, x + R, z + R, ({ i }) => { if (adj && !adj[i].length) return; const d = (N[i][0] - x) ** 2 + (N[i][1] - z) ** 2; if (d < bd) { bd = d; b = i; } });
    if (b >= 0) return b;
  }
  return list[0];
}
function nodeInRing(list, x, z, r0, r1, notVisible) {
  const adj = ADJ_OF.get(list), set = adj ? null : new Set(list), c = [];
  NODEG.each(x - r1, z - r1, x + r1, z + r1, ({ i }) => { if (adj ? !adj[i].length : !set.has(i)) return; const d = hyp(N[i][0] - x, N[i][1] - z); if (d > r0 && d < r1 && inLim(N[i][0], N[i][1], 20)) c.push(i); });
  for (let k = 0; k < 14 && c.length; k++) { const i = pick(c); if (!notVisible || !onScreen(N[i][0], N[i][1])) return i; }
  return c.length ? pick(c) : null;
}
const _v3 = new THREE.Vector3();
function onScreen(x, z) { // only within drawing distance: something 2 km ahead of the camera is not "on screen" (it pinned peds and cars there forever)
  if (Math.abs(x - camera.position.x) > 280 || Math.abs(z - camera.position.z) > 280) return false;
  _v3.set(x, groundH(x, z) + 1.5, z).project(camera); return Math.abs(_v3.x) < 1.1 && Math.abs(_v3.y) < 1.1 && _v3.z < 1; }
function edgePts(a, b, off) {
  const [ax, az] = N[a], [bx, bz] = N[b], dx = bx - ax, dz = bz - az, L = hyp(dx, dz) || 1, rx = -dz / L, rz = dx / L;
  return [[ax + rx * off, az + rz * off], [bx + rx * off, bz + rz * off]];
}

// ---------------------------------------------------------------- tile builder
const AREA_COL = { 15: '#d6e2b4', 16: '#d2e2b2', 1: '#ffffff', 2: '#e8f0dc', 3: '#cfe8c8', 4: '#7b7c7a', 5: '#b3ada2', 6: '#3f6f8c', 7: '#a88f6c', 8: '#9d978c', 9: '#a9a398', 10: '#ffffff', 11: '#7d9a6a', 12: '#c9d7a8', 13: '#e2dca0', 14: '#c3cdb6' };
const PAL_OLD = ['#dfae62', '#e8c98a', '#dba08a', '#ece4d3', '#d99060', '#c7c9a6', '#e3b98f', '#f0dcb0'];
const PAL_MOD = ['#dcd7cd', '#cbc4b7', '#bdb5a8', '#e6e0d5', '#c9b9a0', '#d5cbbb'];
const PAL_IND = ['#aaa69d', '#9d998f', '#b6ae9e', '#8f949a'];
const ROOF_COTTO = ['#b0523a', '#a24a35', '#bd6443', '#9a4733', '#b85a3d'];
const ROOF_FLAT = ['#8f8b84', '#7c7973', '#999286', '#6f6c68'];
const fenceTex = canvasTex(128, 64, (g, w, h) => {
  g.clearRect(0, 0, w, h); g.strokeStyle = 'rgba(70,82,74,1)'; g.lineWidth = 2.5;
  for (let x = -64; x < w + 64; x += 12) { g.beginPath(); g.moveTo(x, 6); g.lineTo(x + 52, h - 4); g.stroke(); g.beginPath(); g.moveTo(x + 52, 6); g.lineTo(x, h - 4); g.stroke(); }
  g.fillStyle = '#3e4a42'; g.fillRect(0, 0, w, 5);
});
const concreteTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#b3aea4'; g.fillRect(0, 0, w, h); noise(g, w, h, 1400, 0.3, ['#8f8a80', '#cbc6bb', '#9d988d']); g.fillStyle = 'rgba(60,55,50,.35)'; g.fillRect(0, 0, 2, h); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, 0, w, 4); });
const MAT = {
  terrain: new THREE.MeshLambertMaterial({ map: groundTex, depthWrite: false }), depth: new THREE.MeshBasicMaterial({ colorWrite: false }),
  grass: flatMat({ map: grassTex, vertexColors: true }), paved: flatMat({ vertexColors: true, map: asphaltTex }), piazza: flatMat({ map: porfidoTex }), water: flatMat({ color: 0x45738c }), bank: flatMat({ color: 0x6d7d55 }),
  foot: flatMat({ color: 0xc8b89c }), asph: flatMat({ map: asphaltTex }), mark: flatMat({ vertexColors: true }), side: new THREE.MeshLambertMaterial({ map: sidewalkTex }), kerb: new THREE.MeshLambertMaterial({ color: 0xa29c90, side: THREE.DoubleSide }),
  ballast: flatMat({ map: ballastTex }), steel: flatMat({ color: 0xc9ccd1 }),
  old: new THREE.MeshLambertMaterial({ map: TEX_OLD, vertexColors: true }), mod: new THREE.MeshLambertMaterial({ map: TEX_MOD, vertexColors: true }), plain: new THREE.MeshLambertMaterial({ map: TEX_PLAIN, vertexColors: true }),
  roof: new THREE.MeshLambertMaterial({ vertexColors: true }), canopy: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  wall: new THREE.MeshLambertMaterial({ map: concreteTex }), net: new THREE.MeshLambertMaterial({ map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide }), post: lam(0x3e4a42),
  deck: new THREE.MeshLambertMaterial({ map: asphaltTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }), deckSide: new THREE.MeshLambertMaterial({ map: concreteTex, side: THREE.DoubleSide }),
  embank: new THREE.MeshLambertMaterial({ map: grassTex, side: THREE.DoubleSide }), rail: new THREE.MeshLambertMaterial({ color: 0xb9bec4, side: THREE.DoubleSide }), deckMark: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
  railing: new THREE.MeshLambertMaterial({ map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide, color: 0x2a2d30 }), hedge: new THREE.MeshLambertMaterial({ map: grassTex, color: 0x4f7a3a }), median: new THREE.MeshLambertMaterial({ map: concreteTex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  trunk: new THREE.MeshLambertMaterial({ color: 0x5a4636 }), crown: new THREE.MeshLambertMaterial({ color: 0xffffff }), lamp: lam(0x4a4d52), lampHead: lam(0xf4f1e6, { emissive: 0x6a6040, emissiveIntensity: 0.4 }),
};
// the kinds of divider the DBGT adds (build_data.py): plastered low walls, railings with vertical bars, green wire mesh, railway panels, wood
const barsTex = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#26292c'; for (let x = 4; x < w; x += 10) g.fillRect(x, 0, 3, h); g.fillRect(0, 0, w, 5); g.fillRect(0, h - 6, w, 6); });
Object.assign(MAT, {
  wallPlaster: new THREE.MeshLambertMaterial({ map: concreteTex, color: 0xf2e6cc }), wallOchre: new THREE.MeshLambertMaterial({ map: concreteTex, color: 0xe6c48e }),
  bars: new THREE.MeshLambertMaterial({ map: barsTex, alphaTest: 0.4, side: THREE.DoubleSide }), mesh: new THREE.MeshLambertMaterial({ map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide, color: 0x6fa86f }),
  railPanel: new THREE.MeshLambertMaterial({ map: fenceTex, alphaTest: 0.35, side: THREE.DoubleSide, color: 0xb8bcc0 }), wood: new THREE.MeshLambertMaterial({ color: 0x8a6a4a }),
});
const TREE_G = (() => { const t = new THREE.CylinderGeometry(0.17, 0.26, 2.8, 6); t.translate(0, 1.4, 0); return { trunk: t, crown: new THREE.IcosahedronGeometry(2.1, 0) }; })();
const GREENS = ['#4f7a35', '#5d8a3b', '#6b8f3e', '#47703a', '#7f9a45', '#a08d3c'];
function addBox(b, x, y, z, w, h, d, col, ry = 0) { // axis box rotated about y, into a buffer
  const c = Math.cos(ry), s = Math.sin(ry), P = (dx, dy, dz) => [x + dx * c + dz * s, y + dy, z - dx * s + dz * c];
  const F = [[[0, 1, 0], [[-1, 1, -1], [1, 1, -1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, 1], [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [[0, 0, -1], [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]],
    [[1, 0, 0], [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [[-1, 0, 0], [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]]];
  for (const [n, vs] of F) {
    const base = b.p.length / 3, nn = [n[0] * c + n[2] * s, n[1], -n[0] * s + n[2] * c];
    for (const v of vs) { const p = P(v[0] * w / 2, v[1] * h / 2, v[2] * d / 2); vtx(b, p[0], p[1], p[2], nn[0], nn[1], nn[2], 0, 0, col); }
    b.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
  }
}
let srndT = 1;
const tRnd = () => { srndT = (srndT * 16807) % 2147483647; return srndT / 2147483647; };
// street lamps every ~30 m along the streets of the towns (OSM maps only a handful): one side on narrow streets, staggered on wide ones
function genLamps(T, d, osm) {
  const out = [];
  for (const ri of d.rp || []) {
    const r = D.roads[ri]; if (r.c > 3 || r.x || r.d || r.t || r.w < 5) continue;
    if (!r.cum) { r.cum = [0]; for (let k = 1; k < r.g.length; k++) { const a = N[r.g[k - 1]], b = N[r.g[k]]; r.cum.push(r.cum[k - 1] + hyp(b[0] - a[0], b[1] - a[1])); } }
    const len = r.cum[r.cum.length - 1], wide = r.w >= 9.5, SP = wide ? 24 : 30, side = ri % 2 ? 1 : -1;
    for (let s = 6 + ((ri * 7919) % 97) / 97 * SP, n = 0; s < len - 6; s += SP, n++) {
      let k = 1; while (k < r.cum.length - 1 && r.cum[k] < s) k++;
      const a = N[r.g[k - 1]], b = N[r.g[k]], L = r.cum[k] - r.cum[k - 1] || 1, f = (s - r.cum[k - 1]) / L, ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L;
      const sd = wide ? (n % 2 ? 1 : -1) : side, off = r.w / 2 + 0.9, x = a[0] + (b[0] - a[0]) * f - uz * off * sd, z = a[1] + (b[1] - a[1]) * f + ux * off * sd;
      if (tileOf(x, z) !== T.t || onAnyRoad(x, z, 0.3) || inBuilding(x, z, 0.4) || nearRail(x, z, 4) || osm.some(o => hyp(o[0] - x, o[1] - z) < 14)) continue;
      let town = 0; BLD.each(x - 30, z - 30, x + 30, z + 30, () => { town++; }); if (town < 2) continue; // only where there are houses
      out.push([x, z, Math.atan2(ux * sd, uz * sd)]); // arm towards the middle of the road
    }
  }
  return out;
}
// a tile is built a slice at a time (a generator that yields between its parts), so driving into new ground never freezes the game for the
// tenth of a second a whole tile takes; it stays hidden until it is complete. buildTile runs one to the end in one go (start, respawn)
function buildTile(T) { const g = T.gen || buildTileGen(T); T.gen = null; while (!g.next().done); }
function* buildTileGen(T) {
  if (T.built) return; T.built = true; T.ready = false; srndT = 1000 + T.t * 7919;
  T.tex0 = new THREE.Texture().id; // textures newer than this were made for this tile: freed with it
  const G = new THREE.Group(); G.visible = false; scene.add(G); T.group = G;
  const put = (b, mat, ro, shadow) => { if (b.i.length) mkMesh(b, mat, ro, shadow, G); };
  const pc = a => COL(a[Math.floor(tRnd() * a.length)]), d = T.d, x0 = T.cx - TS / 2, z0 = T.cz - TS / 2;
  // terrain patch
  {
    const st = (d.rv || []).length ? 2 : TER.step, nn = Math.round(TS / st), b = Buf(), w = nn + 1;
    for (let j = 0; j <= nn; j++) for (let i = 0; i <= nn; i++) { const x = x0 + i * st, z = z0 + j * st; vtx(b, x, visH(x, z), z, 0, 1, 0, x / 10, z / 10); }
    for (let j = 0; j < nn; j++) for (let i = 0; i < nn; i++) { const k = j * w + i; triUp(b, k, k + 1, k + w + 1); triUp(b, k, k + w + 1, k + w); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(b.uv, 2)); g.setIndex(b.i); g.computeVertexNormals();
    const m = new THREE.Mesh(g, MAT.terrain); m.renderOrder = -2; m.receiveShadow = true; G.add(m);
    const dm = new THREE.Mesh(g, MAT.depth); dm.position.y = -0.5; dm.renderOrder = -1; G.add(dm); // just under the ground: hides what is buried (walls go a metre down), roads now follow the terrain
  }
  yield 'landuse';
  // land use
  {
    const gB = VBuf(), pB = VBuf(), zB = FBuf(), wB = VBuf();
    for (const a of d.a || []) {
      const outer = dec(a.p), holes = a.k.map(dec); if (outer.length < 3 || a.t === 5) continue; // platforms are built raised, with their furniture
      try {
        if (a.t <= 3 || a.t >= 11) polyFill(gB, outer, holes, 0.02, 9, COL(AREA_COL[a.t] || '#ffffff'));
        else if (a.t === 4 && inPiazza(...centroid(outer))) { } // a square or a school yard mapped as a car park: drawn by buildPiazze
        else if (a.t === 6) polyFill(wB, outer, holes, 0.03, 9);
        else if (a.t === 10) polyFill(zB, outer, holes, 0.05, 4);
        else polyFill(pB, outer, holes, a.t === 8 || a.t === 9 ? 0.015 : 0.025, 10, COL(AREA_COL[a.t]));
      } catch (e) { }
    }
    put(gB, MAT.grass, 1); put(pB, MAT.paved, 1); put(zB, MAT.piazza, 4); put(wB, MAT.water, 2);
    const rv = Buf(), wallsR = Buf(), rail = Buf();
    for (const r of d.rv || []) {
      const p = resample(dec(r.p), 3);
      for (let k = 1; k < p.length; k++) {
        const a = p[k - 1], c = p[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
        const nx = -(c[1] - a[1]) / L, nz = (c[0] - a[0]) / L, ga = groundH(a[0], a[1]), gc = groundH(c[0], c[1]), wa = ga - RIV_D + 0.5, wc = gc - RIV_D + 0.5;
        const i0 = rv.p.length / 3; // water
        vtx(rv, a[0] - nx * r.w, wa, a[1] - nz * r.w, 0, 1, 0, 0, 0); vtx(rv, a[0] + nx * r.w, wa, a[1] + nz * r.w, 0, 1, 0, 0, 0); vtx(rv, c[0] + nx * r.w, wc, c[1] + nz * r.w, 0, 1, 0, 0, 0); vtx(rv, c[0] - nx * r.w, wc, c[1] - nz * r.w, 0, 1, 0, 0, 0);
        triUp(rv, i0, i0 + 1, i0 + 2); triUp(rv, i0, i0 + 2, i0 + 3);
        for (const sd of [1, -1]) {
          const ax = a[0] + nx * r.w * sd, az = a[1] + nz * r.w * sd, cx = c[0] + nx * r.w * sd, cz = c[1] + nz * r.w * sd, b0 = wallsR.p.length / 3;
          vtx(wallsR, ax, ga - RIV_D - 0.2, az, -nx * sd, 0, -nz * sd, 0, 0); vtx(wallsR, cx, gc - RIV_D - 0.2, cz, -nx * sd, 0, -nz * sd, L / 2, 0); vtx(wallsR, cx, gc + 0.25, cz, -nx * sd, 0, -nz * sd, L / 2, 1); vtx(wallsR, ax, ga + 0.25, az, -nx * sd, 0, -nz * sd, 0, 1);
          wallsR.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
          if (!onAnyRoad((ax + cx) / 2, (az + cz) / 2, 1.5)) { const r0 = rail.p.length / 3; vtx(rail, ax, ga + 0.75, az, nx, 0, nz, 0, 0); vtx(rail, cx, gc + 0.75, cz, nx, 0, nz, 0, 0); vtx(rail, cx, gc + 1.05, cz, nx, 0, nz, 0, 0); vtx(rail, ax, ga + 1.05, az, nx, 0, nz, 0, 0); rail.i.push(r0, r0 + 1, r0 + 2, r0, r0 + 2, r0 + 3); }
        }
      }
    }
    const head = Buf(), mouth = Buf(), apron = Buf();
    const quadV = (b, x0, z0, x1, z1, y0, y1, nx, nz) => { const i = b.p.length / 3, L = hyp(x1 - x0, z1 - z0); vtx(b, x0, y0, z0, nx, 0, nz, 0, 0); vtx(b, x1, y0, z1, nx, 0, nz, L / 2, 0); vtx(b, x1, y1, z1, nx, 0, nz, L / 2, (y1 - y0) / 2); vtx(b, x0, y1, z0, nx, 0, nz, 0, (y1 - y0) / 2); b.i.push(i, i + 1, i + 2, i, i + 2, i + 3); };
    for (const r of d.rv || []) {
      const raw = dec(r.p);
      for (const [ei, E, F] of [[0, raw[0], raw[1]], [1, raw[raw.length - 1], raw[raw.length - 2]]]) {
        if (!r.e || !r.e[ei] || !F) continue;
        const L = hyp(F[0] - E[0], F[1] - E[1]) || 1, ux = (F[0] - E[0]) / L, uz = (F[1] - E[1]) / L, nx = -uz, nz = ux, g = groundH(E[0], E[1]), W = r.w + 0.3;
        quadV(head, E[0] - nx * W, E[1] - nz * W, E[0] + nx * W, E[1] + nz * W, g - RIV_D - 0.2, g + 0.25, ux, uz);
        const ow = r.w * 0.78, wy = g - RIV_D + 0.42, mx = E[0] + ux * 0.03, mz = E[1] + uz * 0.03;
        quadV(mouth, mx - nx * ow, mz - nz * ow, mx + nx * ow, mz + nz * ow, wy, wy + Math.min(1.5, RIV_D - 0.75), ux, uz);
        const i = apron.p.length / 3, bx = E[0] - ux * 2.4, bz = E[1] - uz * 2.4; // covers the terrain dip behind the headwall
        vtx(apron, E[0] - nx * W, g + 0.03, E[1] - nz * W, 0, 1, 0, 0, 0); vtx(apron, E[0] + nx * W, g + 0.03, E[1] + nz * W, 0, 1, 0, 1, 0); vtx(apron, bx + nx * W, groundH(bx, bz) + 0.03, bz + nz * W, 0, 1, 0, 1, 1); vtx(apron, bx - nx * W, groundH(bx, bz) + 0.03, bz - nz * W, 0, 1, 0, 0, 1);
        triUp(apron, i, i + 1, i + 2); triUp(apron, i, i + 2, i + 3);
        const par = new THREE.Mesh(boxG(2 * W + 0.3, 0.8, 0.3), lam(0xa9a397)); par.position.set(E[0] - ux * 0.15, g + 0.4 + 0.25, E[1] - uz * 0.15); par.rotation.y = Math.atan2(-nz, nx); par.castShadow = true; G.add(par);
      }
    }
    put(head, lam(0x8f8a80, { side: THREE.DoubleSide }), 10, 'cast'); put(mouth, lam(0x0c0d0e, { side: THREE.DoubleSide }), 11); put(apron, lam(0x9a958b), 4);
    put(rv, MAT.water, 2); put(wallsR, MAT.deckSide, 10, 'cast'); put(rail, MAT.rail, 10);
  }
  yield 'streets';
  // street surfaces
  {
    const asp = FBuf(), por = FBuf(), foot = FBuf(), sw = FBuf(), kerb = FBuf(), mark = FBuf(), white = COL('#f1efe6');
    const fill = (list, b, y, sc) => { for (const q of list || []) { try { polyFill(b, dec(q.p), q.k.map(dec), y, sc); } catch (e) { } } };
    fill(d.as, asp, 0.06, 9); fill(d.pz, por, 0.06, 4); fill(d.ft, foot, 0.045, 4);
    for (const q of T.sd) {
      try { polyFill(sw, q.o, q.k, SIDE_H, 4); } catch (e) { }
      for (const ring of [q.o, ...q.k]) for (let i = 0; i < ring.length; i++) {
        const a = ring[i], c = ring[(i + 1) % ring.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.02) continue;
        const nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L, base = kerb.p.length / 3;
        vtx(kerb, a[0], 0, a[1], nx, 0, nz, 0, 0); vtx(kerb, c[0], 0, c[1], nx, 0, nz, L / 4, 0); vtx(kerb, c[0], SIDE_H, c[1], nx, 0, nz, L / 4, 1); vtx(kerb, a[0], SIDE_H, a[1], nx, 0, nz, 0, 1);
        kerb.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }
    for (const [X, Z, dx, dz, w] of d.cr || []) {
      const x = X / 10, z = Z / 10, nx = -dz, nz = dx;
      for (let s = -w / 2 + 0.5; s <= w / 2 - 0.4; s += 1.0) quad(mark, x + nx * s, z + nz * s, dx, dz, nx, nz, 3.2, 0.5, 0.085, white);
    }
    // markings and elevated roads
    const deck = Buf(), dside = Buf(), emb = Buf(), grail = Buf(), dmark = Buf(), pil = Buf();
    for (const ri of d.rp || []) {
      const r = D.roads[ri];
      for (let k = 1; k < r.g.length; k++) {
        const A = N[r.g[k - 1]], B = N[r.g[k]];
        if (tileOf((A[0] + B[0]) / 2, (A[1] + B[1]) / 2) !== T.t) continue;
        const L = hyp(B[0] - A[0], B[1] - A[1]); if (L < 0.1) continue;
        const ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L, hw = r.w / 2;
        if (r.t) continue;
        if (r.d) {
          const ya = nodeY(r.g[k - 1]), yb = nodeY(r.g[k]), n = Math.max(1, Math.ceil(L / 3));
          const pts = []; for (let s = 0; s <= n; s++) { const x = lerp(A[0], B[0], s / n), z = lerp(A[1], B[1], s / n), yy = lerp(ya, yb, s / n), g = groundH(x, z); pts.push([x, z, yy - g < 0.5 ? Math.max(yy, g + 0.02) : yy]); } // decks at grade never sink under the ground
          const rx = -uz, rz = ux;
          for (let s = 1; s < pts.length; s++) {
            const p = pts[s - 1], q = pts[s], gp = groundH(p[0], p[1]), gq = groundH(q[0], q[1]);
            // road surface
            const i0 = deck.p.length / 3;
            vtx(deck, p[0] - rx * hw, p[2] + 0.06, p[1] - rz * hw, 0, 1, 0, (p[0] - rx * hw) / 9, (p[1] - rz * hw) / 9); vtx(deck, p[0] + rx * hw, p[2] + 0.06, p[1] + rz * hw, 0, 1, 0, (p[0] + rx * hw) / 9, (p[1] + rz * hw) / 9);
            vtx(deck, q[0] - rx * hw, q[2] + 0.06, q[1] - rz * hw, 0, 1, 0, (q[0] - rx * hw) / 9, (q[1] - rz * hw) / 9); vtx(deck, q[0] + rx * hw, q[2] + 0.06, q[1] + rz * hw, 0, 1, 0, (q[0] + rx * hw) / 9, (q[1] + rz * hw) / 9);
            triUp(deck, i0, i0 + 1, i0 + 3); triUp(deck, i0, i0 + 3, i0 + 2);
            const offP = p[2] - gp, offQ = q[2] - gq;
            if (Math.max(offP, offQ) < 0.25) continue;
            for (const sd of [1, -1]) {
              const ex = rx * sd, ez = rz * sd, e1x = p[0] + ex * hw, e1z = p[1] + ez * hw, e2x = q[0] + ex * hw, e2z = q[1] + ez * hw;
              { // gore fill towards a neighbouring deck at the same height
                const gapAt = (cx, cz, cy) => { for (let k = 0.5; k <= 4.5; k += 0.5) { let hit = false; DECKG.each(cx + ex * k, cz + ez * k, cx + ex * k, cz + ez * k, o => { if (hit || o.r === r) return; const oex = o.bx - o.ax, oez = o.bz - o.az, oL = oex * oex + oez * oez || 1, px = cx + ex * k, pz = cz + ez * k, ot = clamp(((px - o.ax) * oex + (pz - o.az) * oez) / oL, 0, 1); if (hyp(px - o.ax - oex * ot, pz - o.az - oez * ot) <= o.hw && Math.abs(lerp(o.ya, o.yb, ot) - cy) < 1) hit = true; }); if (hit) return k; } return 0; };
                const k1 = gapAt(e1x, e1z, p[2]), k2 = gapAt(e2x, e2z, q[2]);
                if (k1 || k2) { const a1 = k1 || k2, a2 = k2 || k1, i0 = deck.p.length / 3; vtx(deck, e1x, p[2] + 0.055, e1z, 0, 1, 0, e1x / 9, e1z / 9); vtx(deck, e2x, q[2] + 0.055, e2z, 0, 1, 0, e2x / 9, e2z / 9); vtx(deck, e2x + ex * (a2 + 0.3), q[2] + 0.055, e2z + ez * (a2 + 0.3), 0, 1, 0, (e2x + ex * a2) / 9, (e2z + ez * a2) / 9); vtx(deck, e1x + ex * (a1 + 0.3), p[2] + 0.055, e1z + ez * (a1 + 0.3), 0, 1, 0, (e1x + ex * a1) / 9, (e1z + ez * a1) / 9); triUp(deck, i0, i0 + 1, i0 + 2); triUp(deck, i0, i0 + 2, i0 + 3); }
              }
              const slab = r.b || nearLowRail((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, r.w / 2 + 3); // over a railway: open slab, not an embankment
              if (slab) { // bridge slab: side faces + underside
                const b0 = dside.p.length / 3;
                vtx(dside, e1x, p[2] - 0.9, e1z, ex, 0, ez, 0, 0); vtx(dside, e2x, q[2] - 0.9, e2z, ex, 0, ez, 1, 0); vtx(dside, e2x, q[2] + 0.1, e2z, ex, 0, ez, 1, 1); vtx(dside, e1x, p[2] + 0.1, e1z, ex, 0, ez, 0, 1);
                dside.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
              } else { // embankment slope down to the ground
                const clipW = (ex0, ez0, w) => { for (let k = 1; k < w; k += 1) if (onAnyRoad(ex0 + ex * k, ez0 + ez * k, 0.3)) return Math.max(0.4, k - 1); return w; };
                const w1 = clipW(e1x, e1z, Math.min(14, 1.3 * Math.max(0, offP))), w2 = clipW(e2x, e2z, Math.min(14, 1.3 * Math.max(0, offQ))), b0 = emb.p.length / 3;
                vtx(emb, e1x, p[2] + 0.05, e1z, ex * 0.6, 0.8, ez * 0.6, 0, 0); vtx(emb, e2x, q[2] + 0.05, e2z, ex * 0.6, 0.8, ez * 0.6, 0.4, 0);
                vtx(emb, e2x + ex * w2, groundH(e2x + ex * w2, e2z + ez * w2) - 0.2, e2z + ez * w2, ex * 0.6, 0.8, ez * 0.6, 0.4, 1); vtx(emb, e1x + ex * w1, groundH(e1x + ex * w1, e1z + ez * w1) - 0.2, e1z + ez * w1, ex * 0.6, 0.8, ez * 0.6, 0, 1);
                emb.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
              }
            }
            if (r.b || nearLowRail((p[0] + q[0]) / 2, (p[1] + q[1]) / 2, r.w / 2 + 3)) { const b0 = dside.p.length / 3; vtx(dside, p[0] - rx * hw, p[2] - 0.9, p[1] - rz * hw, 0, -1, 0, 0, 0); vtx(dside, p[0] + rx * hw, p[2] - 0.9, p[1] + rz * hw, 0, -1, 0, 1, 0); vtx(dside, q[0] + rx * hw, q[2] - 0.9, q[1] + rz * hw, 0, -1, 0, 1, 1); vtx(dside, q[0] - rx * hw, q[2] - 0.9, q[1] - rz * hw, 0, -1, 0, 0, 1); dside.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
          }
          if (r.w >= 6.5) { // lane dashes on the deck
            for (let s = 1.5; s < L - 3; s += 9) { const x = A[0] + ux * s, z = A[1] + uz * s, y = lerp(ya, yb, s / L) + 0.09; const i0 = dmark.p.length / 3, wv = COL('#f1efe6'); for (const [a, b] of [[0, -0.08], [3, -0.08], [3, 0.08], [0, 0.08]]) vtx(dmark, x + ux * a - uz * b, y + (lerp(ya, yb, (s + a) / L) - lerp(ya, yb, s / L)), z + uz * a + ux * b, 0, 1, 0, 0, 0, wv); triUp(dmark, i0, i0 + 1, i0 + 2); triUp(dmark, i0, i0 + 2, i0 + 3); }
          }
          // junction cap: a round patch of asphalt where the deck meets other roads, so ramps and splits have no wedge-shaped holes
          for (const gi of k === r.g.length - 1 ? [r.g[0], r.g[r.g.length - 1]] : []) {
            const C = N[gi]; if (tileOf(C[0], C[1]) !== T.t || NODE_DEG[gi] < 2) continue;
            const y = nodeY(gi) + 0.055, R = r.w / 2 + 0.35, c0 = deck.p.length / 3;
            vtx(deck, C[0], y, C[1], 0, 1, 0, C[0] / 9, C[1] / 9);
            for (let q = 0; q <= 18; q++) { const a = q / 18 * Math.PI * 2, x = C[0] + Math.cos(a) * R, z = C[1] + Math.sin(a) * R; vtx(deck, x, y, z, 0, 1, 0, x / 9, z / 9); }
            for (let q = 0; q < 18; q++) triUp(deck, c0, c0 + 1 + q, c0 + 2 + q);
          }
          continue;
        }
        // flat road: centre / lane dashes
        const twoWay = !r.o && r.c <= 2 && r.mh * 2 >= 5.5, lanes = r.o && r.c <= 1 && r.mh * 2 >= 6.6;
        if (!twoWay && !lanes) continue;
        const ja = NODE_DEG[r.g[k - 1]] >= 3 ? hw + 4 : 0, jb = NODE_DEG[r.g[k]] >= 3 ? hw + 4 : 0;
        for (let s = ja + 0.5; s + 3 < L - jb; s += 7.5) quad(mark, A[0] + ux * (s + 1.5), A[1] + uz * (s + 1.5), ux, uz, -uz, ux, 3, 0.16, 0.08, white);
      }
    }
    for (const sp of DECK_SOLIDS) if (sp.k === 'pillar' && tileOf(sp.x, sp.z) === T.t) { const g0 = groundH(sp.x, sp.z), h = sp.y - 0.9 - g0; if (h > 0.5) addBox(pil, sp.x, g0 + h / 2, sp.z, 0.9, h, 0.9, null); }
    for (const sp of DECK_SOLIDS.concat(FLAT_RAILS.map(f => ({ k: 'rail', ...f })))) if (sp.k === 'rail' && tileOf((sp.x0 + sp.x1) / 2, (sp.z0 + sp.z1) / 2) === T.t) {
      const b0 = grail.p.length / 3, nx = sp.z1 - sp.z0, nz = -(sp.x1 - sp.x0), L = hyp(nx, nz) || 1;
      vtx(grail, sp.x0, sp.y0 + 0.4, sp.z0, nx / L, 0, nz / L, 0, 0); vtx(grail, sp.x1, sp.y1 + 0.4, sp.z1, nx / L, 0, nz / L, 0, 0); vtx(grail, sp.x1, sp.y1 + 0.85, sp.z1, nx / L, 0, nz / L, 0, 0); vtx(grail, sp.x0, sp.y0 + 0.85, sp.z0, nx / L, 0, nz / L, 0, 0);
      grail.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3);
    }
    put(asp, MAT.asph, 5); put(por, MAT.piazza, 5); put(foot, MAT.foot, 3); put(mark, MAT.mark, 6);
    put(sw, MAT.side, 9); put(kerb, MAT.kerb, 9);
    put(deck, MAT.deck, 9, 'cast'); put(dside, MAT.deckSide, 10, 'cast'); put(emb, MAT.embank, 8); put(grail, MAT.rail, 10); put(dmark, MAT.deckMark, 10); put(pil, MAT.deckSide, 10, 'cast');
  }
  yield 'walls';
  // walls, fences, hedges and the expressway median
  {
    const wl = Buf(), ft = Buf(), hd = Buf(), md = Buf(), posts = [], wlP = [Buf(), Buf()], bars = Buf(), mesh = Buf(), rly = Buf(), wood = Buf();
    for (const br of T.ba || []) {
      const pts = br.pts; let acc = 0;
      // the same divider keeps one look along its length: plaster or concrete, a higher or lower base, bars or mesh on top
      const hv = (Math.sin(pts[0][0] * 12.9898 + pts[0][1] * 78.233) * 43758.5453) % 1, hh = Math.abs(hv), base = br.t === 2 ? 0.35 + (hh * 7 % 1) * 0.6 : 0.5;
      const wallB = br.t === 2 && hh < 0.6 ? wlP[hh < 0.3 ? 0 : 1] : wl, railB = br.t === 2 && (hh * 13 % 1) < 0.55 ? bars : ft;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], c = pts[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
        const ga = groundH(a[0], a[1]), gc = groundH(c[0], c[1]), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, nx = uz, nz = -ux;
        const slab = (b, th, y0a, y0c, y1a, y1c) => { // thin vertical slab, both faces + cap
          for (const sd of [1, -1]) { const b0 = b.p.length / 3, ox = nx * th * sd, oz = nz * th * sd; vtx(b, a[0] + ox, y0a, a[1] + oz, nx * sd, 0, nz * sd, acc / 2, 0); vtx(b, c[0] + ox, y0c, c[1] + oz, nx * sd, 0, nz * sd, (acc + L) / 2, 0); vtx(b, c[0] + ox, y1c, c[1] + oz, nx * sd, 0, nz * sd, (acc + L) / 2, 1); vtx(b, a[0] + ox, y1a, a[1] + oz, nx * sd, 0, nz * sd, acc / 2, 1); b.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2); }
          const b0 = b.p.length / 3; vtx(b, a[0] + nx * th, y1a, a[1] + nz * th, 0, 1, 0, 0, 1); vtx(b, c[0] + nx * th, y1c, c[1] + nz * th, 0, 1, 0, 0, 1); vtx(b, c[0] - nx * th, y1c, c[1] - nz * th, 0, 1, 0, 0, 1); vtx(b, a[0] - nx * th, y1a, a[1] - nz * th, 0, 1, 0, 0, 1); triUp(b, b0, b0 + 1, b0 + 2); triUp(b, b0, b0 + 2, b0 + 3);
        };
        const panel = (b, y0, y1, rep) => { const b0 = b.p.length / 3; vtx(b, a[0], ga + y0, a[1], nx, 0, nz, acc / rep, 0); vtx(b, c[0], gc + y0, c[1], nx, 0, nz, (acc + L) / rep, 0); vtx(b, c[0], gc + y1, c[1], nx, 0, nz, (acc + L) / rep, 1); vtx(b, a[0], ga + y1, a[1], nx, 0, nz, acc / rep, 1); b.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); };
        const postsEvery = (step, y0) => { for (let s0 = 0; s0 < L; s0 += step) posts.push([a[0] + ux * s0, a[1] + uz * s0, ga + (gc - ga) * s0 / L + y0, br.h - y0]); };
        if (br.t === 1 || br.t === 4) slab(wl, 0.14, ga - 0.3, gc - 0.3, ga + br.h, gc + br.h);
        else if (br.t === 3) slab(hd, 0.45, ga - 0.2, gc - 0.2, ga + br.h, gc + br.h);
        else if (br.t === 5) { panel(mesh, 0, br.h, 2.6); postsEvery(2.5, 0); } // wire mesh on posts, from the ground
        else if (br.t === 6) { slab(wl, 0.1, ga - 0.3, gc - 0.3, ga + 0.3, gc + 0.3); panel(rly, 0.3, br.h, 2.6); postsEvery(2.5, 0.3); } // by the railway: a concrete kerb, tall panels
        else if (br.t === 7) { for (const y of [0.45, 0.95]) slab(wood, 0.04, ga + y, gc + y, ga + y + 0.12, gc + y + 0.12); for (let s0 = 0; s0 < L; s0 += 2.5) { const x = a[0] + ux * s0, z = a[1] + uz * s0, gy = ga + (gc - ga) * s0 / L; addBox(wood, x, gy + 0.6, z, 0.12, 1.2, 0.12, null); } } // post and rail
        else { // muretto + cancellata, the Brianza classic
          slab(wallB, 0.12, ga - 0.3, gc - 0.3, ga + base, gc + base);
          panel(railB, base, br.h, railB === bars ? 1.2 : 2.6);
          postsEvery(2.6, base);
        }
        acc += L;
      }
    }
    for (const q of d.md || []) { // median between the two carriageways: at deck height where elevated
      { const o0 = dec(q.p); if (o0.length < 3) continue; let per = 0; for (let i = 0; i < o0.length; i++) per += hyp(o0[(i + 1) % o0.length][0] - o0[i][0], o0[(i + 1) % o0.length][1] - o0[i][1]); const A = Math.abs(sArea(o0)), c = centroid(o0);
        if (A < 30 || A / per < 0.6) continue; let local = false; ROADSEG.each(c[0] - 8, c[1] - 8, c[0] + 8, c[1] + 8, s => { if (!local && !s.r.x && s.r.c <= 5 && segDist(c[0], c[1], s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + 0.5) local = true; }); if (local) continue; } // junction leftovers are not medians
      const o = dec(q.p), k = q.k.map(dec), yAt = (x, z) => { let best = null, bd = 1e9; DECKG.each(x - 8, z - 8, x + 8, z + 8, s => { const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - s.ax) * ex + (z - s.az) * ez) / L2, 0, 1), dd = hyp(x - s.ax - ex * t, z - s.az - ez * t); if (dd < bd && dd < s.hw + 7) { bd = dd; best = lerp(s.ya, s.yb, t); } }); return best === null ? groundH(x, z) : best; };
      try { const base = md.p.length / 3; polyFill(md, densify(o, 4), k.map(h => densify(h, 4)), 0, 4); for (let i = base * 3; i < md.p.length; i += 3) md.p[i + 1] = yAt(md.p[i], md.p[i + 2]) + 0.12; } catch (e) { }
    }
    put(wl, MAT.wall, 10, 'cast'); put(ft, MAT.railing, 10); put(hd, MAT.hedge, 10, 'cast'); put(md, MAT.median, 9);
    put(wlP[0], MAT.wallPlaster, 10, 'cast'); put(wlP[1], MAT.wallOchre, 10, 'cast'); put(bars, MAT.bars, 10); put(mesh, MAT.mesh, 10); put(rly, MAT.railPanel, 10); put(wood, MAT.wood, 10, 'cast');
    if (posts.length) { // [x, z, foot, length]
      const pg = new THREE.BoxGeometry(0.06, 1, 0.06); pg.translate(0, 0.5, 0);
      const pm = new THREE.InstancedMesh(pg, MAT.post, posts.length), mtx = new THREE.Matrix4(), sc = new THREE.Vector3(), qq = new THREE.Quaternion(), pp = new THREE.Vector3();
      posts.forEach(([x, z, y, h], i) => { mtx.compose(pp.set(x, y, z), qq, sc.set(1, Math.max(0.1, h), 1)); pm.setMatrixAt(i, mtx); }); G.add(pm);
    }
  }
  yield 'railway';
  // railway & fences
  {
    const bal = FBuf(), steel = FBuf();
    const ebal = Buf(), esteel = Buf(), eside = Buf();
    for (const r of d.rl || []) {
      const p0 = dec(r.p); if (p0.length < 2) continue;
      if (!r.h) { const p = resample(p0, 4); ribbon(bal, p, -1.9, 1.9, 0.07, 2.4, 'along'); ribbon(steel, p, -0.8, -0.68, 0.11, 9, 'world'); ribbon(steel, p, 0.68, 0.8, 0.11, 9, 'world'); continue; }
      // elevated track: absolute heights, bridge slab or embankment
      const hs = r.h.map((v, i) => v === -32768 ? groundH(p0[i][0], p0[i][1]) : v / 10);
      for (let k = 1; k < p0.length; k++) {
        const A = p0[k - 1], B = p0[k], L = hyp(B[0] - A[0], B[1] - A[1]); if (L < 0.1) continue;
        const n = Math.max(1, Math.ceil(L / 3)), ux = (B[0] - A[0]) / L, uz = (B[1] - A[1]) / L, rx = -uz, rz = ux;
        for (let s = 0; s < n; s++) {
          const t0 = s / n, t1 = (s + 1) / n, x0 = lerp(A[0], B[0], t0), z0 = lerp(A[1], B[1], t0), x1 = lerp(A[0], B[0], t1), z1 = lerp(A[1], B[1], t1), y0 = lerp(hs[k - 1], hs[k], t0), y1 = lerp(hs[k - 1], hs[k], t1);
          const quadA = (b, a0, a1, d0, d1) => { const i0 = b.p.length / 3; vtx(b, x0 + rx * a0, y0 + d0, z0 + rz * a0, 0, 1, 0, 0, t0 * L / 2.4); vtx(b, x0 + rx * a1, y0 + d0, z0 + rz * a1, 0, 1, 0, 1, t0 * L / 2.4); vtx(b, x1 + rx * a1, y1 + d1, z1 + rz * a1, 0, 1, 0, 1, t1 * L / 2.4); vtx(b, x1 + rx * a0, y1 + d1, z1 + rz * a0, 0, 1, 0, 0, t1 * L / 2.4); triUp(b, i0, i0 + 1, i0 + 2); triUp(b, i0, i0 + 2, i0 + 3); };
          quadA(ebal, -2.2, 2.2, 0.07, 0.07); quadA(esteel, -0.8, -0.68, 0.12, 0.12); quadA(esteel, 0.68, 0.8, 0.12, 0.12);
          const g0 = groundH(x0, z0), g1 = groundH(x1, z1);
          if (Math.max(y0 - g0, y1 - g1) < 0.4) continue;
          const over = onAnyRoad((x0 + x1) / 2, (z0 + z1) / 2, 2.5) || nearLowRail((x0 + x1) / 2, (z0 + z1) / 2, 4); // a street or another line passes underneath: bridge slab only, open below
          if (over) { const b0 = eside.p.length / 3; vtx(eside, x0 - rx * 2.2, y0 - 1.2, z0 - rz * 2.2, 0, -1, 0, 0, 0); vtx(eside, x0 + rx * 2.2, y0 - 1.2, z0 + rz * 2.2, 0, -1, 0, 1, 0); vtx(eside, x1 + rx * 2.2, y1 - 1.2, z1 + rz * 2.2, 0, -1, 0, 1, 1); vtx(eside, x1 - rx * 2.2, y1 - 1.2, z1 - rz * 2.2, 0, -1, 0, 0, 1); eside.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
          for (const sd of [1, -1]) { const ex = rx * sd * 2.2, ez = rz * sd * 2.2, b0 = eside.p.length / 3; vtx(eside, x0 + ex, over ? y0 - 1.2 : Math.min(y0 - 1.2, g0 - 0.3), z0 + ez, rx * sd, 0, rz * sd, 0, 0); vtx(eside, x1 + ex, over ? y1 - 1.2 : Math.min(y1 - 1.2, g1 - 0.3), z1 + ez, rx * sd, 0, rz * sd, 1, 0); vtx(eside, x1 + ex, y1 + 0.9, z1 + ez, rx * sd, 0, rz * sd, 1, 1); vtx(eside, x0 + ex, y0 + 0.9, z0 + ez, rx * sd, 0, rz * sd, 0, 1); eside.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); }
        }
      }
    }
    if (ebal.i.length) { const m1 = new THREE.MeshLambertMaterial({ map: ballastTex }); put(ebal, m1, 9); put(esteel, MAT.rail, 10); put(eside, MAT.deckSide, 10, 'cast'); }
    put(bal, MAT.ballast, 7); put(steel, MAT.steel, 8);
    const wall = FBuf(), net = FBuf(), WH = 0.9, NH = 2.0, TK = 0.13, posts = [];
    for (const pts of T.fe) {
      let acc = 0, nextPost = 0;
      for (let k = 1; k < pts.length; k++) {
        const a = pts[k - 1], c = pts[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
        const ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, nx = uz, nz = -ux, u0 = acc / 2, u1 = (acc + L) / 2;
        for (const sd of [1, -1]) {
          const ox = nx * TK * sd, oz = nz * TK * sd, base = wall.p.length / 3;
          vtx(wall, a[0] + ox, 0, a[1] + oz, nx * sd, 0, nz * sd, u0, 0); vtx(wall, c[0] + ox, 0, c[1] + oz, nx * sd, 0, nz * sd, u1, 0);
          vtx(wall, c[0] + ox, WH, c[1] + oz, nx * sd, 0, nz * sd, u1, 0.9); vtx(wall, a[0] + ox, WH, a[1] + oz, nx * sd, 0, nz * sd, u0, 0.9);
          wall.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
        }
        { const base = wall.p.length / 3; vtx(wall, a[0] + nx * TK, WH, a[1] + nz * TK, 0, 1, 0, u0, 1); vtx(wall, c[0] + nx * TK, WH, c[1] + nz * TK, 0, 1, 0, u1, 1); vtx(wall, c[0] - nx * TK, WH, c[1] - nz * TK, 0, 1, 0, u1, 0.95); vtx(wall, a[0] - nx * TK, WH, a[1] - nz * TK, 0, 1, 0, u0, 0.95); triUp(wall, base, base + 1, base + 2); triUp(wall, base, base + 2, base + 3); }
        { const base = net.p.length / 3; vtx(net, a[0], WH, a[1], nx, 0, nz, acc / 2.6, 0); vtx(net, c[0], WH, c[1], nx, 0, nz, (acc + L) / 2.6, 0); vtx(net, c[0], NH, c[1], nx, 0, nz, (acc + L) / 2.6, 1); vtx(net, a[0], NH, a[1], nx, 0, nz, acc / 2.6, 1); net.i.push(base, base + 1, base + 2, base, base + 2, base + 3); }
        while (nextPost <= acc + L) { const t = (nextPost - acc) / L; posts.push([a[0] + (c[0] - a[0]) * t, a[1] + (c[1] - a[1]) * t]); nextPost += 2.6; }
        acc += L;
      }
    }
    put(wall, MAT.wall, 10, 'cast'); put(net, MAT.net, 10);
    if (posts.length) {
      const pg = new THREE.BoxGeometry(0.07, NH - WH, 0.07); pg.translate(0, (NH + WH) / 2, 0);
      const pm = new THREE.InstancedMesh(pg, MAT.post, posts.length), mtx = new THREE.Matrix4();
      posts.forEach(([x, z], i) => { mtx.makeTranslation(x, groundH(x, z), z); pm.setMatrixAt(i, mtx); }); pm.castShadow = true; G.add(pm);
    }
  }
  yield 'buildings';
  // buildings
  {
    const wb = { old: Buf(), mod: Buf(), plain: Buf() }, roofB = Buf(), canopyB = Buf(), postB = Buf();
    let nb = 0;
    for (const B of T.bld) {
      if (B.lm || B.big || B.g >= 2) continue; // modelled by hand in landmarks3.js, a whole supermarket (negozi3.js), greenhouse, stand, water tower (paesaggio3.js)
      if ((++nb & 31) === 0) { const s = srndT; yield 'buildings'; srndT = s; } // other code may draw random numbers meanwhile
      const outer = B.pts, holes = B.holes, area = Math.abs(sArea(outer)), h = B.h, t = B.t;
      const gys = outer.map(p => groundH(p[0], p[1])), gmin = Math.min(...gys), gmax = Math.max(...gys), top = gmax + h, bot = gmin - 0.6;
      if (t === 9) {
        const ch = gmax + Math.max(h, 3.8);
        try { polyFill(canopyB, outer, holes, ch, 10, COL('#8d8a84')); } catch (e) { }
        if (outer.length <= 10) for (const [x, z] of outer) { const gy = groundH(x, z); addBox(postB, x, (gy + ch) / 2, z, 0.18, ch - gy, 0.18, COL('#6a6c70')); }
        continue;
      }
      let kind, wallCol;
      if (t === 1 || t === 2) { kind = 'plain'; wallCol = pc(PAL_IND); }
      else if (t === 7) { kind = 'plain'; wallCol = COL('#eadcc0'); }
      else if (t === 10) { kind = 'old'; wallCol = pc(['#f2e6cf', '#ece4d3', '#f0dcb0', '#e8c98a', '#e3b98f', '#dba08a', '#f5efe4', '#d9c7a3']); }
      else if (t === 11) { kind = 'mod'; wallCol = pc(['#efc65a', '#e8b84a', '#f2d483', '#e6c06e']); } // schools: the classic Brianza yellow
      else if (t === 4 || t === 3 || (t === 0 && area > 380) || t === 8) { kind = 'mod'; wallCol = pc(t === 8 ? ['#dcb98b', '#d6c09a'] : PAL_MOD); }
      else { kind = 'old'; wallCol = pc(PAL_OLD); }
      if (h < 4.2) kind = 'plain';
      const b = wb[kind], tile = kind === 'old' ? 3.4 : kind === 'mod' ? 4.2 : 4;
      for (const [ring, isHole] of [[outer, false], ...holes.map(hh => [hh, true])]) {
        const A = sArea(ring); let acc = 0;
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], L = hyp(dx, dz); if (L < 0.05) continue;
          let nx = dz / L, nz = -dx / L; if ((A < 0) !== isHole) { nx = -nx; nz = -nz; }
          const u0 = acc / tile, u1 = (acc + L) / tile; acc += L;
          const v1 = h / 3.1, v0 = (bot - gmax) / 3.1, base = b.p.length / 3;
          vtx(b, a[0], bot, a[1], nx, 0, nz, u0, v0, wallCol); vtx(b, c[0], bot, c[1], nx, 0, nz, u1, v0, wallCol);
          vtx(b, c[0], top, c[1], nx, 0, nz, u1, v1, wallCol); vtx(b, a[0], top, a[1], nx, 0, nz, u0, v1, wallCol);
          if (nx * (-dz) + nz * dx > 0) b.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else b.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
        }
      }
      const pitched = !holes.length && outer.length <= (t === 10 ? 12 : 8) && area < 650 && area > 25 && (isConvex(outer) || (t === 10 && outer.length <= 6)) && (t === 0 || t === 5 || t === 6 || t === 10 || (t === 4 && area < 450)) && h >= 5;
      if (pitched) {
        const [cx, cz] = centroid(outer), rh = Math.min(3.2, 0.9 + Math.sqrt(area) * 0.12), col = pc(ROOF_COTTO);
        for (let i = 0; i < outer.length; i++) {
          const a = outer[i], c = outer[(i + 1) % outer.length];
          const v1 = new THREE.Vector3(a[0], top, a[1]), v2 = new THREE.Vector3(c[0], top, c[1]), v3 = new THREE.Vector3(cx, top + rh, cz);
          const n = new THREE.Vector3().subVectors(v2, v1).cross(new THREE.Vector3().subVectors(v3, v1)).normalize(); if (n.y < 0) n.negate();
          const base = roofB.p.length / 3;
          vtx(roofB, v1.x, v1.y, v1.z, n.x, n.y, n.z, 0, 0, col); vtx(roofB, v2.x, v2.y, v2.z, n.x, n.y, n.z, 0, 0, col); vtx(roofB, v3.x, v3.y, v3.z, n.x, n.y, n.z, 0, 0, col);
          triUp(roofB, base, base + 1, base + 2);
        }
      } else { try { polyFill(roofB, outer, holes, top, 10, pc(t === 4 || t === 0 ? ROOF_FLAT.concat(ROOF_COTTO.slice(0, 1)) : ROOF_FLAT)); } catch (e) { } }
    }
    put(wb.old, MAT.old, 10, 'cast'); put(wb.mod, MAT.mod, 10, 'cast'); put(wb.plain, MAT.plain, 10, 'cast'); put(roofB, MAT.roof, 10, 'cast'); put(canopyB, MAT.canopy, 10, 'cast'); put(postB, MAT.roof, 10, 'cast');
  }
  for (const f of [buildSignals, buildSegnali, buildGates, buildFountains, buildSigns, buildNegozi, buildPaesaggio, buildFuel, buildCaserme, buildCemetery, buildLandmarks, buildPiazze, buildPlazas, buildStairwells, buildPlatforms, buildParkingLines, buildParkFurniture, buildOggetti]) {
    const s = srndT; yield f.name; srndT = s; const r = f(T, G);
    if (r && r.next) for (const v of r) { const s = srndT; yield v || f.name; srndT = s; }
  }
  { const s = srndT; yield 'trees'; srndT = s; }
  // trees and street lamps
  T.tr = T.tr.filter(([x, z]) => !nearRail(x, z, 4));
  if (T.tr.length) {
    const n = T.tr.length, trunks = new THREE.InstancedMesh(TREE_G.trunk, MAT.trunk, n), crowns = new THREE.InstancedMesh(TREE_G.crown, MAT.crown, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
    T.tr.forEach(([x, z], i) => {
      const k = 0.75 + tRnd() * 0.6, gy = groundH(x, z);
      q.identity(); m.compose(p.set(x, gy, z), q, s.set(k, k, k)); trunks.setMatrixAt(i, m);
      q.setFromEuler(e.set(tRnd(), tRnd() * 3, 0)); m.compose(p.set(x, gy + 3.4 * k + 1.2, z), q, s.set(k * (0.9 + tRnd() * 0.3), k * (1 + tRnd() * 0.4), k)); crowns.setMatrixAt(i, m);
      crowns.setColorAt(i, COL(GREENS[Math.floor(tRnd() * GREENS.length)]));
    });
    trunks.castShadow = crowns.castShadow = true; crowns.receiveShadow = true; G.add(trunks, crowns);
  }
  const LPS = (d.lp || []).map(([X, Z]) => [X / 10, Z / 10, 0]); LPS.push(...genLamps(T, d, LPS)); // [x, z, arm direction]
  if (LPS.length) { // one instance per lamp, so each can be knocked down on its own: pole and arm, head; the light pool and the glare go with it
    const pole = Buf(), head = Buf(); addBox(pole, 0, 3.6, 0, 0.14, 7.2, 0.14, null); addBox(pole, 0.6, 7.15, 0, 1.3, 0.1, 0.12, null); addBox(head, 1.15, 7.0, 0, 0.5, 0.14, 0.3, null);
    const geo = b => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setIndex(b.i); return g; };
    const n = LPS.length, pm = new THREE.InstancedMesh(geo(pole), MAT.lamp, n), hm = new THREE.InstancedMesh(geo(head), MAT.lampHead, n), o = new THREE.Object3D(), pool = Buf(), gp = [];
    pm.castShadow = true; pm.renderOrder = hm.renderOrder = 10;
    LPS.forEach(([x, z, ry], i) => {
      const gy = surfAt(x, z, 1e4), c = Math.cos(ry), s = Math.sin(ry), hx = x + c * 1.15, hz = z - s * 1.15; // the arm reaches out along local +x
      o.position.set(x, gy, z); o.rotation.set(0, ry, 0); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); hm.setMatrixAt(i, o.matrix);
      const py = surfAt(hx, hz, 1e4) + 0.14, k = pool.p.length / 3, R = 7; // warm light pool on the street at night
      vtx(pool, hx - R, py, hz - R, 0, 1, 0, 0, 0); vtx(pool, hx + R, py, hz - R, 0, 1, 0, 1, 0); vtx(pool, hx + R, py, hz + R, 0, 1, 0, 1, 1); vtx(pool, hx - R, py, hz + R, 0, 1, 0, 0, 1); triUp(pool, k, k + 1, k + 2); triUp(pool, k, k + 2, k + 3);
      gp.push(hx, gy + 6.82, hz); // glare under the lamp head
      if (!T.lampsDone) addProp({ x, z, y: gy, r: 0.22, h: 7, inst: { meshes: [pm, hm], i, ry, base: gy }, tile: T, li: i });
      else for (const p of PROPS) if (p.tile === T && p.li === i) { p.inst.meshes = [pm, hm]; if (p.broken) { o.scale.set(0, 0, 0); o.updateMatrix(); pm.setMatrixAt(i, o.matrix); hm.setMatrixAt(i, o.matrix); o.scale.set(1, 1, 1); } } // built again: the lamps knocked down stay down
    });
    G.add(pm, hm); const poolM = pool.i.length ? mkMesh(pool, LAMPPOOL_MAT, 12, false, G) : null;
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
    const glare = new THREE.Points(pg, LAMPGLOW_MAT); glare.renderOrder = 14; G.add(glare);
    for (const p of PROPS) if (p.tile === T) p.onBreak = () => { // the lamp goes dark: its pool and its glare drop out of sight
      if (poolM) { const a = poolM.geometry.attributes.position; for (let q = p.li * 4; q < p.li * 4 + 4; q++) a.setY(q, -9999); a.needsUpdate = true; }
      pg.attributes.position.setY(p.li, -9999); pg.attributes.position.needsUpdate = true; };
    for (const p of PROPS) if (p.tile === T && p.broken && p.onBreak) p.onBreak(); // and dark
    T.lampsDone = true;
  }
  T.ready = true; G.visible = T.dist < 860;
}
// tiles far behind are taken apart (their geometry and their sign textures freed) and built again if you come back
function freeTile(T) {
  const G = T.group; if (!G) return; scene.remove(G);
  const own = t => t && t.id > T.tex0 && !segTexIs(t);
  G.traverse(m => { if (m.geometry) m.geometry.dispose(); const mt = m.material; if (!mt || Array.isArray(mt)) return;
    if (own(mt.map) || own(mt.emissiveMap)) { const k = SIGN_MATS.indexOf(mt); if (k >= 0) SIGN_MATS.splice(k, 1); for (const t of [mt.map, mt.emissiveMap]) if (own(t)) t.dispose(); mt.dispose(); } });
  T.group = null; T.built = false; T.ready = false; T.gen = null;
}
function tileTick(px, pz, budgetMs, force) {
  const t0 = performance.now(), cand = [];
  for (const T of TILES) { const dd = hyp(T.cx - px, T.cz - pz); T.dist = dd; if (!T.built && dd < 760) cand.push(T); if (T.group) T.group.visible = T.ready && dd < 860; if (T.ready && dd > 1150 && !force) freeTile(T); }
  cand.sort((a, b) => a.dist - b.dist);
  if (force) { for (const T of cand) { buildTile(T); if (T.dist > force) break; } if (tileTick.cur) { buildTile(tileTick.cur); tileTick.cur = null; } return; }
  // a slice at a time within the budget, the nearest tile first
  while (performance.now() - t0 < budgetMs) {
    let T = tileTick.cur;
    if (!T || !T.gen) { T = cand.shift(); if (!T) break; T.gen = buildTileGen(T); tileTick.cur = T; }
    if (T.gen.next().done) { T.gen = null; tileTick.cur = null; }
  }
}

// ---------------------------------------------------------------- gates (cancelli): closed ones can be rammed open
const GATES = [], GATEG = new Grid(16), GATE_FLY = [], GATE_OPEN = new Set();
const GATE_TEX = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d'); x.fillStyle = '#fff'; for (let i = 0; i < 4; i++) x.fillRect(i * 16 + 6, 0, 4, 128); x.fillRect(0, 0, 64, 9); x.fillRect(0, 119, 64, 9); x.fillRect(0, 54, 64, 6); const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
const ARM_TEX = (() => { const c = document.createElement('canvas'); c.width = 64; c.height = 8; const x = c.getContext('2d'); for (let i = 0; i < 4; i++) { x.fillStyle = i % 2 ? '#f2f2ee' : '#d22a1e'; x.fillRect(i * 16, 0, 16, 8); } const t = new THREE.CanvasTexture(c); t.wrapS = THREE.RepeatWrapping; return t; })();
const GATE_MAT = new THREE.MeshLambertMaterial({ color: 0x33413a, map: GATE_TEX, alphaTest: 0.5, side: THREE.DoubleSide });
for (const [X0, Z0, X1, Z1, k, h, auto] of D.gates || []) {
  const ax = X0 / 10, az = Z0 / 10, bx = X1 / 10, bz = Z1 / 10, W = hyp(bx - ax, bz - az); if (W < 0.5) continue;
  const ux = (bx - ax) / W, uz = (bz - az) / W, gy = Math.min(groundH(ax, az), groundH(bx, bz));
  const g = { ax, az, bx, bz, ux, uz, W, k, h, gy, broken: false, auto: !!auto, open: false, oa: 0, hinges: [] };
  if (k !== 'o') { g.seg = { ax, az, bx, bz, nx: -uz, nz: ux, two: true, dyn: true, on: true, y0: gy - 2, y1: gy + h + 0.4 }; WALLS.add(ax, az, bx, bz, g.seg); }
  GATES.push(g); GATEG.add(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), g);
}
function buildGates(T, G) {
  for (const g of GATES) {
    if (tileOf((g.ax + g.bx) / 2, (g.az + g.bz) / 2) !== T.t) continue;
    const th = Math.atan2(-g.uz, g.ux);
    if (g.k !== 'l') for (const [x, z] of [[g.ax, g.az], [g.bx, g.bz]]) { const p = new THREE.Mesh(boxG(0.32, g.h + 0.25, 0.32), lam(0x8d877c)); p.position.set(x, groundH(x, z) + (g.h + 0.25) / 2, z); p.castShadow = true; G.add(p); }
    else { const p = new THREE.Mesh(boxG(0.25, 1.15, 0.25), lam(0xd9d6cf)); p.position.set(g.ax, groundH(g.ax, g.az) + 0.57, g.az); G.add(p); }
    if (g.broken && g.k !== 'o') continue; // already rammed
    const outer = new THREE.Group(), inner = new THREE.Group(); outer.add(inner); G.add(outer); g.outer = outer; g.inner = inner;
    if (g.k === 'l') { // lift-gate arm, hinged at a
      outer.position.set(g.ax, g.gy, g.az); outer.rotation.y = th;
      const geo = new THREE.BoxGeometry(g.W, 0.09, 0.09); geo.translate(g.W / 2, 1.0, 0); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * g.W / 1.6);
      const m = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: ARM_TEX })); m.castShadow = true; inner.add(m);
    } else { // gate leaf (two leaves when wide), hinged at the posts
      const leaves = g.W > 3.2 && g.k !== 'o' ? [[0, g.W / 2, 1], [g.W, g.W / 2, -1]] : [[0, g.W, 1]];
      outer.position.set(g.ax, g.gy, g.az); outer.rotation.y = th;
      for (const [x0, w, dir] of leaves) {
        const hinge = new THREE.Group(); hinge.position.x = x0; inner.add(hinge); g.hinges.push([hinge, dir]);
        const geo = new THREE.PlaneGeometry(w - 0.3, g.h); geo.translate(dir * (w / 2), g.h / 2 + 0.05, 0); const uv = geo.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * (w - 0.3) / 0.75);
        const m = new THREE.Mesh(geo, GATE_MAT); m.castShadow = true; hinge.add(m);
        if (g.k === 'o') hinge.rotation.y = -1.35 * dir; // footpath gates stand open
      }
    }
  }
}
function gateHits(v) {
  if (v.speed < 0.6) return;
  GATEG.each(v.x - 4, v.z - 4, v.x + 4, v.z + 4, g => {
    if (g.broken || g.open || g.k === 'o' || Math.abs(v.y - g.gy) > 2.5) return;
    const ai = v.driver === 'ai', reach = ai && g.auto ? v.rad + 4 : v.rad + 0.3;
    for (const c of v.circles()) if (segDist(c[0], c[1], g.ax, g.az, g.bx, g.bz) < reach) { if (ai && g.auto) openGate(g); else if (v.speed > 3 || ai) breakGate(g, v); return; }
  });
}
function openGate(g) { g.open = true; g.openT = 5; if (g.seg) g.seg.on = false; GATE_OPEN.add(g); }
function breakGate(g, v) {
  g.broken = true; if (g.seg) g.seg.on = false;
  const sp = v.speed; v.vx *= 0.82; v.vz *= 0.82; v.health = Math.max(0, v.health - 1.5);
  if (v === P.car) { sfxCrash(Math.min(14, sp)); shake = Math.max(shake, 0.35); }
  if (!g.outer) return;
  const vn = v.vx * -g.uz + v.vz * g.ux; // push side, in the gate's local z
  g.fall = Math.sign(vn) || 1; g.vx = v.vx * 0.55; g.vz = v.vz * 0.55; g.t = 0; GATE_FLY.push(g);
}
function updGates(dt) {
  // pedestrians open the small gates instead of walking through them
  for (const p of PEDS) { if (p.state === 'dead') continue; GATEG.each(p.x - 2, p.z - 2, p.x + 2, p.z + 2, g => { if (!g.broken && !g.open && g.k === 'g' && segDist(p.x, p.z, g.ax, g.az, g.bx, g.bz) < 1.6) openGate(g); }); }
  // honk in front of a gate on a residential street and it opens for you too
  if (P.car && (K.horn || GP.horn > 0.5)) GATEG.each(P.car.x - 12, P.car.z - 12, P.car.x + 12, P.car.z + 12, g => { if (g.auto && !g.broken && !g.open && segDist(P.car.x, P.car.z, g.ax, g.az, g.bx, g.bz) < 12) openGate(g); });
  for (const g of GATE_OPEN) {
    if (g.broken) { GATE_OPEN.delete(g); continue; }
    if (g.open && (g.openT -= dt) <= 0) {
      const mx = (g.ax + g.bx) / 2, mz = (g.az + g.bz) / 2; let busy = hyp(P.x - mx, P.z - mz) < 5;
      if (!busy) for (const v of VEH) if (Math.abs(v.x - mx) < 7 && Math.abs(v.z - mz) < 7 && hyp(v.x - mx, v.z - mz) < 6.5) { busy = true; break; }
      if (busy) g.openT = 1; else { g.open = false; if (g.seg) g.seg.on = true; }
    }
    g.oa = lerp(g.oa, g.open ? 1 : 0, 1 - Math.exp(-3 * dt));
    if (g.k === 'l') { if (g.inner) g.inner.rotation.z = 1.35 * g.oa; } else for (const [hn, dir] of g.hinges) hn.rotation.y = -1.45 * dir * g.oa;
    if (!g.open && g.oa < 0.01) { g.oa = 0; GATE_OPEN.delete(g); }
  }
  for (let i = GATE_FLY.length - 1; i >= 0; i--) {
    const g = GATE_FLY[i]; g.t += dt; const o = g.outer, k = Math.exp(-2.5 * dt);
    o.position.x += g.vx * dt; o.position.z += g.vz * dt; g.vx *= k; g.vz *= k;
    if (g.k === 'l') { g.inner.rotation.z = Math.min(1.2, g.inner.rotation.z + dt * 6); g.inner.rotation.x += g.fall * dt * 4; o.position.y = g.gy + Math.max(-0.95, -g.t * g.t * 6); }
    else { g.inner.rotation.x = lerp(g.inner.rotation.x, g.fall * Math.PI * 0.49, 1 - Math.exp(-7 * dt)); o.position.y = groundH(o.position.x, o.position.z) + 0.02; }
    if (g.t > 2.5) GATE_FLY.splice(i, 1);
  }
}

// ---------------------------------------------------------------- fountains
const FOUNT = (D.fountains || []).map(([X, Z, R]) => ({ x: X / 10, z: Z / 10, r: R }));
for (const f of FOUNT) { f.gy = groundH(f.x, f.z); WALLS.add(f.x - f.r - 0.5, f.z - f.r - 0.5, f.x + f.r + 0.5, f.z + f.r + 0.5, { r: f.r + 0.35, x: f.x, z: f.z, y0: f.gy - 3, y1: f.gy + 0.9 }); }
const SPRAY_MAT = new THREE.PointsMaterial({ color: 0xe6f2fb, size: 0.13, transparent: true, opacity: 0.8, depthWrite: false });
function buildFountains(T, G) {
  for (const f of FOUNT) {
    if (tileOf(f.x, f.z) !== T.t) continue;
    const root = new THREE.Group(); root.position.set(f.x, f.gy, f.z); G.add(root);
    const stone = lam(0xd2c9b6), R = f.r;
    const outer = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.35, R + 0.42, 0.6, 48, 1, true), stone); outer.position.y = 0.3; outer.castShadow = true; root.add(outer);
    const inner = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.6, 48, 1, true), lam(0xb9b09d, { side: THREE.BackSide })); inner.position.y = 0.3; root.add(inner);
    const top = new THREE.Mesh(new THREE.RingGeometry(R, R + 0.35, 48), lam(0xe0d8c6, { side: THREE.DoubleSide })); top.rotation.x = -Math.PI / 2; top.position.y = 0.6; root.add(top);
    const water = new THREE.Mesh(new THREE.CircleGeometry(R, 48), new THREE.MeshLambertMaterial({ color: 0x4f93ad, emissive: 0x0c2a36, transparent: true, opacity: 0.88 })); water.rotation.x = -Math.PI / 2; water.position.y = 0.45; root.add(water);
    let jy = 0.6;
    if (R >= 2) {
      const ped = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(0.5, R * 0.15), Math.min(0.65, R * 0.2), 1.2, 16), stone); ped.position.y = 0.6; root.add(ped);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(1.6, R * 0.38), Math.min(0.7, R * 0.18), 0.35, 24), stone); bowl.position.y = 1.35; bowl.castShadow = true; root.add(bowl);
      jy = 1.55;
    }
    const N = Math.round(Math.min(420, 120 + R * 40)), pos = new Float32Array(N * 3), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const pts = new THREE.Points(geo, SPRAY_MAT); pts.frustumCulled = false; root.add(pts);
    const P_ = [];
    for (let i = 0; i < N; i++) { // central plume plus, in big basins, a ring of jets arching inwards
      const ring = R >= 3.5 && i % 3 === 0, a = Math.random() * Math.PI * 2, T0 = 0.8 + Math.random() * 0.35;
      if (ring) { const j = Math.floor(Math.random() * 10) / 10 * Math.PI * 2, r0 = R * 0.82; P_.push({ x: Math.cos(j) * r0, z: Math.sin(j) * r0, y: 0.5, vx: -Math.cos(j) * R * 0.3 / T0, vz: -Math.sin(j) * R * 0.3 / T0, vy: 9.8 * T0 / 2, T: T0, o: Math.random() * T0 }); }
      else { const hs = (0.2 + Math.random() * 0.8) * Math.min(R * 0.55, 3) / (T0 * 1.25); P_.push({ x: 0, z: 0, y: jy, vx: Math.cos(a) * hs, vz: Math.sin(a) * hs, vy: 9.8 * T0 * 1.25 / 2 + Math.random(), T: T0 * 1.25, o: Math.random() * T0 * 1.25 }); }
    }
    f.spray = { pos, geo, P: P_, root };
  }
}
function updFountains() {
  for (const f of FOUNT) {
    const s = f.spray; if (!s || !s.root.parent || !s.root.parent.visible || hyp(f.x - camera.position.x, f.z - camera.position.z) > 260) continue;
    for (let i = 0; i < s.P.length; i++) { const p = s.P[i], t = (now + p.o) % p.T; s.pos[i * 3] = p.x + p.vx * t; s.pos[i * 3 + 1] = Math.max(0.45, p.y + p.vy * t - 4.9 * t * t); s.pos[i * 3 + 2] = p.z + p.vz * t; }
    s.geo.attributes.position.needsUpdate = true;
  }
}

// ---------------------------------------------------------------- shop signs (insegne) from the real shops, bars and restaurants
const SIGN_MATS = [], SIGN_EDGES = new Map(); // how many signs already hang on each wall
const SIGN_STYLE = { scuola: ['#1f4f9a', '#ffffff'], oratorio: ['#6b3a8c', '#ffffff'], municipio: ['#2f3b4c', '#f2d27e'], biblioteca: ['#5a3d22', '#f6e6c8'], ospedale: ['#c8102e', '#ffffff'], stazione: ['#1f6b3a', '#ffffff'], bar: ['#1f4d3a', '#f4e7c4'], ristorante: ['#7a1f1a', '#f6e6c8'], 'fast food': ['#c8331f', '#ffe08a'], gelateria: ['#e9a6b9', '#4a1f2c'], farmacia: ['#1d8f4e', '#ffffff'], banca: ['#183a6b', '#ffffff'], poste: ['#f2c230', '#163a7a'], benzinaio: ['#c8102e', '#ffffff'], negozio: ['#25303f', '#f2f2ee'] };
// every sign is placed once, on the wall of the nearest building that faces a road; signs on a hand-made landmark are drawn with the landmark
// (buildLandmarks), pushed out of whatever its model puts in front of the wall: pillars, awnings, fins, porches
let SIGN_LIST = null;
function signList() {
  if (SIGN_LIST) return SIGN_LIST; SIGN_LIST = [];
  for (const p of D.pois) {
    if (!p.n || p.lm || !SIGN_STYLE[p.k]) continue;
    let best = null;
    BLD.each(p.x - 12, p.z - 12, p.x + 12, p.z + 12, b => {
      if (b.noSign) return; const pts = b.pts;
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i], c = pts[(i + 1) % pts.length], dx = c[0] - a[0], dz = c[1] - a[1], L = hyp(dx, dz); if (L < 2.5) continue;
        const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, d = segDist(p.x, p.z, a[0], a[1], c[0], c[1]);
        let nx = dz / L, nz = -dx / L; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, pts)) { nx = -nx; nz = -nz; } // outward, whatever the winding
        if (inPoly(mx + nx * 0.3, mz + nz * 0.3, pts)) continue;
        const score = d + (onAnyRoad(mx + nx * 7, mz + nz * 7, 3) ? 0 : 6);
        if (d < 12 && (!best || score < best.score)) best = { score, a, c, L, nx, nz, b, ux: dx / L, uz: dz / L };
      }
    });
    if (best && !best.b.lm && ngHas(p)) continue; // a shop with its own front (negozi3.js)
    if (best) { const key = best.a[0].toFixed(1) + ',' + best.a[1].toFixed(1) + ',' + best.c[0].toFixed(1); best.slot = SIGN_EDGES.get(key) || 0; SIGN_EDGES.set(key, best.slot + 1); SIGN_LIST.push({ p, ...best }); }
  }
  return SIGN_LIST;
}
function buildSigns(T, G) { drawSigns(signList().filter(s => tileOf(s.p.x, s.p.z) === T.t && !s.b.lm), G); }
const SIGN_RAY = new THREE.Raycaster();
// fit: the landmark's meshes; each sign looks for what stands in front of its wall over its own width and height, tries a little lower (not under
// 2.1 m) when something overhangs it, and is set just in front of the outermost surface left
function drawSigns(list, G, fit) {
  if (!list.length) return;
  const rows = list.length, cv = document.createElement('canvas'); cv.width = 512; cv.height = 64 * rows; const g = cv.getContext('2d');
  const buf = Buf();
  list.forEach((s, i) => {
    const [bg, fg] = SIGN_STYLE[s.p.k], name = s.p.n.toUpperCase().slice(0, 28);
    g.fillStyle = bg; g.fillRect(0, i * 64, 512, 64); g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(0, i * 64, 512, 4);
    g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 40; g.font = `bold ${fs}px Arial, sans-serif`; while (g.measureText(name).width > 480 && fs > 14) { fs -= 2; g.font = `bold ${fs}px Arial, sans-serif`; }
    g.fillText(name, 256, i * 64 + 33);
    let w = Math.min(s.L * 0.85, Math.max(2.2, 0.75 + name.length * 0.33), 8); const h = w / 8 * 1.0 + 0.35;
    // several shops on one wall: side by side while there is room, then stacked below
    let along = 0, drop = 0;
    if (s.slot) { const per = Math.max(1, Math.floor(s.L * 0.9 / (w + 0.4))); if (s.slot < per) { const k = Math.ceil(s.slot / 2) * (s.slot % 2 ? 1 : -1); along = k * (w + 0.4); if (Math.abs(along) + w / 2 > s.L * 0.48) { along = 0; drop = s.slot * (h + 0.25); } } else drop = (s.slot - per + 1) * (h + 0.25); }
    const wx = (s.a[0] + s.c[0]) / 2 + s.ux * along, wz = (s.a[1] + s.c[1]) / 2 + s.uz * along;
    const gy = Math.min(groundH(s.a[0], s.a[1]), groundH(s.c[0], s.c[1]));
    let y = gy + Math.min(3.3, Math.max(2.4, s.b.h - 1.2)) - drop, out = 0.09;
    if (s.fit) [y, out] = s.fit; // worked out the first time the tile was built
    else if (fit && fit.length) {
      const need = yc => { let m = -1; for (const fa of [-0.47, -0.2, 0.2, 0.47]) for (const fy of [-0.45, 0, 0.45]) {
        SIGN_RAY.set(new THREE.Vector3(wx + s.ux * w * fa + s.nx * 4, yc + h * fy, wz + s.uz * w * fa + s.nz * 4), new THREE.Vector3(-s.nx, 0, -s.nz)); SIGN_RAY.far = 4.3;
        const hit = SIGN_RAY.intersectObjects(fit, false)[0]; if (hit) m = Math.max(m, 4 - hit.distance); } return m; };
      let bestY = y, bestN = need(y);
      for (let yc = y - 0.3; bestN > 0.12 && yc - h / 2 >= gy + 2.1; yc -= 0.3) { const n = need(yc); if (n < bestN) { bestN = n; bestY = yc; } }
      y = bestY; out = Math.max(0.09, bestN + 0.06); s.fit = [y, out];
    }
    const cx = wx + s.nx * out, cz = wz + s.nz * out;
    const v0 = 1 - (i * 64 + 2) / cv.height, v1 = 1 - (i * 64 + 62) / cv.height, i0 = buf.p.length / 3;
    // quad facing outward (nx, nz); u runs along the wall so the text reads left to right from the street
    const lx = s.nz, lz = -s.nx; // the viewer's right when facing the wall
    vtx(buf, cx - lx * w / 2, y - h / 2, cz - lz * w / 2, s.nx, 0, s.nz, 0, v1); vtx(buf, cx + lx * w / 2, y - h / 2, cz + lz * w / 2, s.nx, 0, s.nz, 1, v1);
    vtx(buf, cx + lx * w / 2, y + h / 2, cz + lz * w / 2, s.nx, 0, s.nz, 1, v0); vtx(buf, cx - lx * w / 2, y + h / 2, cz - lz * w / 2, s.nx, 0, s.nz, 0, v0);
    buf.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
    if (out > 0.3) { // standing off the wall: a bracket at each end back to it
      for (const e of [-0.45, 0.45]) { const bx = wx + s.ux * w * e + s.nx * out / 2, bz = wz + s.uz * w * e + s.nz * out / 2; const k0 = buf.uv.length; addBox(buf, bx, y + h / 2 - 0.05, bz, Math.abs(s.nx) * out + Math.abs(s.ux) * 0.06, 0.06, Math.abs(s.nz) * out + Math.abs(s.uz) * 0.06, null); for (let q = k0; q < buf.uv.length; q += 2) { buf.uv[q] = 0.01; buf.uv[q + 1] = v1 + 0.005; } } // coloured like the board's edge
    }
  });
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
  const mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  SIGN_MATS.push(mat); mkMesh(buf, mat, 10, false, G);
}

// ---------------------------------------------------------------- fuel stations (distributori): canopy, pumps that blow up, brand totem
const BRAND = { eni: ['#ffd200', '#1a1a1a'], agip: ['#ffd200', '#1a1a1a'], q8: ['#1d3f8f', '#f5c400'], esso: ['#e3001b', '#ffffff'], ip: ['#0055a5', '#ffffff'], tamoil: ['#f36f21', '#ffffff'], total: ['#e4002b', '#ffffff'], moro: ['#1f6b3a', '#ffffff'], retitalia: ['#00843d', '#ffffff'] };
const brandOf = n => { const k = (n || '').toLowerCase(); for (const b in BRAND) if (k.includes(b)) return BRAND[b]; return ['#2f3b4c', '#ffffff']; };
const FUEL = [];
for (const p of D.pois) {
  if (p.k !== 'benzinaio') continue;
  let ux = 1, uz = 0, bd = 1e9, bs = null; ROADSEG.each(p.x - 30, p.z - 30, p.x + 30, p.z + 30, sg => { if (sg.r.c > 3 || sg.r.d) return; const d = segDist(p.x, p.z, sg.a[0], sg.a[1], sg.b[0], sg.b[1]); if (d < bd) { bd = d; bs = sg; } });
  let x = p.x, z = p.z;
  if (bs) { const L = hyp(bs.b[0] - bs.a[0], bs.b[1] - bs.a[1]) || 1; ux = (bs.b[0] - bs.a[0]) / L; uz = (bs.b[1] - bs.a[1]) / L; let sx = -uz, sz = ux; if ((x - bs.a[0]) * sx + (z - bs.a[1]) * sz < 0) { sx = -sx; sz = -sz; } const want = bs.r.w / 2 + 9; if (bd < want) { const al = (x - bs.a[0]) * ux + (z - bs.a[1]) * uz; x = bs.a[0] + ux * al + sx * want; z = bs.a[1] + uz * al + sz * want; } var nx0 = sx, nz0 = sz; } else { var nx0 = 0, nz0 = 1; }
  const f = { p, x, z, ux, uz, nx: nx0, nz: nz0, gy: groundH(x, z), pumps: [] };
  for (const o of [-3.2, 3.2]) { const px = x + ux * o, pz = z + uz * o; const pump = { x: px, z: pz, alive: true, f }; f.pumps.push(pump); WALLS.add(px - 1.3, pz - 1.3, px + 1.3, pz + 1.3, pump.wall = { r: 1.0, x: px, z: pz, y0: f.gy - 2, y1: f.gy + 2 }); }
  for (const [a, b] of [[-6.5, -3.8], [6.5, -3.8], [-6.5, 3.8], [6.5, 3.8]]) { const qx = x + ux * a + nx0 * b, qz = z + uz * a + nz0 * b; WALLS.add(qx - 0.4, qz - 0.4, qx + 0.4, qz + 0.4, { r: 0.25, x: qx, z: qz, y0: f.gy - 2, y1: f.gy + 4 }); }
  FUEL.push(f);
}
function buildFuel(T, G) {
  for (const f of FUEL) {
    if (tileOf(f.x, f.z) !== T.t) continue;
    const [bg, fg] = brandOf(f.p.n), root = new THREE.Group(); root.position.set(f.x, f.gy, f.z); root.rotation.y = Math.atan2(f.ux, f.uz) - Math.PI / 2; G.add(root);
    // local frame: x along the road, z away from it
    const slab = new THREE.Mesh(boxG(15, 0.7, 9), lam(0xf2f2ee)); slab.position.y = 5.2; slab.castShadow = true; root.add(slab);
    for (const zz of [-4.52, 4.52]) { const band = new THREE.Mesh(boxG(15.04, 0.5, 0.06), lam(new THREE.Color(bg).getHex(), { emissive: new THREE.Color(bg).getHex(), emissiveIntensity: 0.15 })); band.position.set(0, 5.2, zz); root.add(band); SIGN_MATS.push(band.material); }
    for (const [a, b] of [[-6.5, -3.8], [6.5, -3.8], [-6.5, 3.8], [6.5, 3.8]]) { const c = new THREE.Mesh(boxG(0.35, 5, 0.35), lam(0xd9d6cf)); c.position.set(a, 2.5, -b); c.castShadow = true; root.add(c); }
    for (const pump of f.pumps) {
      const lx = (pump.x - f.x) * f.ux + (pump.z - f.z) * f.uz, g = new THREE.Group(); g.position.set(lx, 0, 0); root.add(g); pump.g = g;
      const isl = new THREE.Mesh(boxG(1.4, 0.25, 4.2), lam(0xb9b4aa)); isl.position.y = 0.12; g.add(isl);
      const body = new THREE.Mesh(boxG(0.7, 1.8, 1.0), lam(new THREE.Color(bg).getHex())); body.position.y = 1.15; body.castShadow = true; g.add(body); pump.body = body;
      const scr = new THREE.Mesh(boxG(0.72, 0.4, 0.5), lam(0x1d2128)); scr.position.y = 1.6; g.add(scr);
    }
    // brand totem by the road
    const cv = document.createElement('canvas'); cv.width = 128; cv.height = 256; const gg = cv.getContext('2d'); gg.fillStyle = bg; gg.fillRect(0, 0, 128, 256); gg.fillStyle = fg; gg.textAlign = 'center'; gg.textBaseline = 'middle'; let fs = 46; const nm = (f.p.n || 'CARBURANTI').toUpperCase(); gg.font = `bold ${fs}px Arial`; while (gg.measureText(nm).width > 118 && fs > 14) { fs -= 2; gg.font = `bold ${fs}px Arial`; } gg.fillText(nm, 64, 60);
    gg.fillStyle = 'rgba(0,0,0,.55)'; gg.fillRect(8, 120, 112, 120); gg.fillStyle = '#7dff9a'; gg.font = 'bold 22px monospace'; gg.textAlign = 'left'; gg.fillText('SELF 1.79', 14, 150); gg.fillText('DIES 1.69', 14, 185); gg.fillText('GPL  0.72', 14, 220);
    const tex = new THREE.CanvasTexture(cv), tm = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05 }); SIGN_MATS.push(tm);
    const tot = new THREE.Mesh(boxG(1.6, 4.4, 0.4), [lam(0x3a3d42), lam(0x3a3d42), lam(0x3a3d42), lam(0x3a3d42), tm, tm]); tot.position.set(9.5, 2.2, -(4.5 + 2)); tot.castShadow = true; root.add(tot);
  }
}
// a pump goes up, scorches black and catches fire; the blast sets off every other pump nearby, so the fire runs across the forecourt
function ignitePump(f, pump, k = 1.8) {
  if (!pump.alive) return;
  pump.alive = false; pump.burn = 14; if (pump.body) pump.body.material = lam(0x1d1b19);
  boom(pump.x, f.gy + 1, pump.z, k);
  for (const g of FUEL) for (const o of g.pumps) if (o.alive && hyp(o.x - pump.x, o.z - pump.z) < 11) ignitePump(g, o, 1.4);
}
function fuelHits(v) {
  if (v.speed < 3) return;
  for (const f of FUEL) { if (Math.abs(f.x - v.x) > 16 || Math.abs(f.z - v.z) > 16) continue;
    for (const pump of f.pumps) if (pump.alive && hyp(pump.x - v.x, pump.z - v.z) < v.rad + 2.6) { ignitePump(f, pump); v.health = Math.max(0, v.health - 35); } }
}
function updFuel(dt) { for (const f of FUEL) for (const pump of f.pumps) if (pump.burn > 0) { pump.burn -= dt; for (let i = 0; i < 2; i++) if (rnd() < 0.8) puff(pump.x + (rnd() - 0.5) * 1.4, f.gy + 1.5 + rnd(), pump.z + (rnd() - 0.5) * 1.4, rnd() < 0.5 ? '#ff7a1e' : '#ffc23a', 1.2 + rnd() * 1.2, 0.6, 3.0); } }

// ---------------------------------------------------------------- caserme: Carabinieri stations and Polizia Locale headquarters (door, sign, lantern, flags, parking)
const CASERME = [];
for (const p of D.pois) {
  if (p.k !== 'polizia') continue;
  const cc = /carabinier|compagnia/i.test(p.n || '');
  // the building: the one around the point, else a big one close by (the point is often the middle of the fenced compound)
  let B = null, bs = 1e9;
  BLD.each(p.x - 40, p.z - 40, p.x + 40, p.z + 40, b => {
    const inside = inPoly(p.x, p.z, b.pts); let d = 1e9;
    for (let i = 0; i < b.pts.length; i++) { const a = b.pts[i], c = b.pts[(i + 1) % b.pts.length]; d = Math.min(d, segDist(p.x, p.z, a[0], a[1], c[0], c[1])); }
    const s = (inside ? 0 : d) - Math.min(Math.sqrt(Math.abs(sArea(b.pts))), 30) * 0.3;
    if ((inside || d < 35) && b.h >= 3 && s < bs) { bs = s; B = b; }
  });
  if (!B) continue;
  // the front: a long wall looking onto a street, with nothing in between
  let F = null;
  for (let i = 0; i < B.pts.length; i++) {
    const a = B.pts[i], c = B.pts[(i + 1) % B.pts.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 5) continue;
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L;
    if (inPoly(mx + nx * 0.3, mz + nz * 0.3, B.pts)) { nx = -nx; nz = -nz; }
    if (inPoly(mx + nx * 0.3, mz + nz * 0.3, B.pts)) continue;
    let road = null;
    for (let t = 1; t <= 45 && !road; t += 0.75) {
      const x = mx + nx * t, z = mz + nz * t; if (t > 1.5 && inBuilding(x, z)) break;
      ROADSEG.each(x - 1, z - 1, x + 1, z + 1, s => { if (!road && s.r.c <= 5 && !s.r.d && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2) road = { t, s }; });
    }
    const score = (road ? road.t : 80) - Math.min(L, 24) * 0.5;
    if (!F || score < F.score) F = { score, a, c, L, mx, mz, nx, nz, road };
  }
  if (!F) continue;
  const ux = (F.c[0] - F.a[0]) / F.L, uz = (F.c[1] - F.a[1]) / F.L, depth = F.road ? F.road.t - 0.6 : 0;
  const st = { p, cc, b: B, x: F.mx, z: F.mz, ux, uz, nx: F.nx, nz: F.nz, L: F.L, depth, gy: groundH(F.mx, F.mz), spots: [], posts: [], flags: [], cops: [], next: 0 };
  // local frame, the same as the props group: lz out of the door, lx along the front
  st.at = (lx, lz) => [st.x + st.nz * lx + st.nx * lz, st.z - st.nx * lx + st.nz * lz];
  st.rx = st.nz; st.rz = -st.nx;
  // parking for the volanti: nose out in front of the building, parallel to the wall in a narrow yard, else at the kerb
  const out = Math.atan2(st.nx, st.nz), along = Math.atan2(st.rx, st.rz);
  if (depth >= 6.5) for (const k of [3.4, -3.4, 6.3, -6.3, 9.2, -9.2]) { if (Math.abs(k) > F.L / 2 + 3) continue; const [x, z] = st.at(k, 3.55); st.spots.push({ x, z, h: out }); }
  else if (depth >= 3.2) for (const k of [4.4, -4.4, 10, -10]) { if (Math.abs(k) > F.L / 2 + 2) continue; const [x, z] = st.at(k, 1.55); st.spots.push({ x, z, h: along }); }
  if (F.road && F.road.s.r.w >= 7 && F.road.s.r.c >= 2) { // kerb by the station: on the side of the building, along the road
    const s = F.road.s, sx = s.b[0] - s.a[0], sz = s.b[1] - s.a[1], SL = hyp(sx, sz) || 1, ex = sx / SL, ez = sz / SL;
    const t0 = (st.x - s.a[0]) * ex + (st.z - s.a[1]) * ez; let ox = -ez, oz = ex; if ((st.x - s.a[0]) * ox + (st.z - s.a[1]) * oz < 0) { ox = -ox; oz = -oz; }
    for (const k of [5.5, -5.5, 11]) { const t = t0 + k; if (t < 4 || t > SL - 4) continue; const off = s.r.w / 2 - 1.15; st.spots.push({ x: s.a[0] + ex * t + ox * off, z: s.a[1] + ez * t + oz * off, h: Math.atan2(ex, ez), kerb: true }); }
  }
  for (const k of [2.2, 5, 7.8]) for (const sd of [-1, 1]) { const [x, z] = st.at(sd * (F.L / 2 + k), 2.9); st.spots.push({ x, z, h: out }); } // beside the building, if that is a yard (checked when parking)
  // agents: one each side of the door, one walking up and down the front
  const pz = Math.min(1.25, Math.max(0.6, depth - 0.4));
  st.posts.push({ lx: -2.3, lz: pz }, { lx: 2.3, lz: pz }, { lx: 0, lz: Math.min(0.75, pz), beat: Math.max(2.5, Math.min(F.L / 2 - 1, 12)) });
  CASERME.push(st);
  for (const [lx, lz] of [[-1.55, 1.45], [1.55, 1.45]]) { const [x, z] = st.at(lx, lz); WALLS.add(x - 0.3, z - 0.3, x + 0.3, z + 0.3, { r: 0.1, x, z, y0: st.gy - 2, y1: st.gy + 3 }); } // canopy posts
}
const townOf = st => placeAt(st.x, st.z) || 'Meda';
function caserma2Lines(st) {
  const n = st.p.n || '', town = townOf(st);
  if (st.cc) return ['CARABINIERI', /compagnia/i.test(n) ? 'Comando Compagnia di ' + town : 'Stazione di ' + town];
  return ['POLIZIA LOCALE', /comando/i.test(n) ? 'Comando di ' + town : 'Comune di ' + town];
}
function flagTex(kind) {
  return canvasTex(96, 64, (g, w, h) => {
    if (kind === 'it') { g.fillStyle = '#119246'; g.fillRect(0, 0, w / 3, h); g.fillStyle = '#f4f5f0'; g.fillRect(w / 3, 0, w / 3, h); g.fillStyle = '#ce2b37'; g.fillRect(w * 2 / 3, 0, w / 3 + 1, h); }
    else if (kind === 'eu') { g.fillStyle = '#003399'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffcc00'; for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; g.beginPath(); g.arc(w / 2 + Math.cos(a) * 19, h / 2 + Math.sin(a) * 19, 2.6, 0, Math.PI * 2); g.fill(); } }
    else { g.fillStyle = '#f4f5f0'; g.fillRect(0, 0, w, h); g.fillStyle = '#119246'; g.strokeStyle = '#119246'; g.lineWidth = 3; // Lombardia: the green rosa camuna
      for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; g.beginPath(); g.arc(w / 2 + Math.cos(a) * 16, h / 2 + Math.sin(a) * 16, 4.2, 0, Math.PI * 2); g.fill(); }
      g.beginPath(); g.ellipse(w / 2, h / 2, 11, 9, 0, 0, Math.PI * 2); g.stroke(); }
  }, false);
}
const FLAG_TEX = {};
function buildCaserme(T, G) {
  for (const st of CASERME) {
    if (tileOf(st.x, st.z) !== T.t) continue;
    const root = new THREE.Group(); root.position.set(st.x, st.gy, st.z); root.rotation.y = Math.atan2(st.nx, st.nz); G.add(root); st.root = root;
    const put = (geo, mat, x, y, z, shadow = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = shadow; root.add(m); return m; };
    const blue = st.cc ? 0x14213d : 0x1d4fb8;
    // entrance: frame, glass door, step and canopy on two posts
    put(boxG(2.3, 2.8, 0.1), lam(0xd6d1c6), 0, 1.4, 0.02, false);
    put(boxG(1.9, 2.5, 0.12), lam(0x26313d), 0, 1.25, 0.05, false);
    put(boxG(0.06, 2.4, 0.13), lam(0x9aa3ad), 0, 1.25, 0.06, false);
    put(boxG(3.6, 0.16, 1.9), lam(0xbdb6aa), 0, 0.08, 0.95, false);
    put(boxG(3.6, 0.16, 1.7), lam(0x3c424b), 0, 2.98, 0.85);
    for (const x of [-1.55, 1.55]) put(boxG(0.1, 2.92, 0.1), lam(0x3c424b), x, 1.46, 1.45);
    if (st.cc) put(boxG(3.62, 0.08, 1.72), lam(0xc8102e), 0, 2.88, 0.85, false); // red edge under the canopy
    // sign over the door
    const [l1, l2] = caserma2Lines(st), W = clamp(st.L * 0.7, 4.6, 7.6), cv = document.createElement('canvas'); cv.width = 512; cv.height = 112; const g = cv.getContext('2d');
    g.fillStyle = st.cc ? '#14213d' : '#1d4fb8'; g.fillRect(0, 0, 512, 112);
    if (st.cc) { g.fillStyle = '#c8102e'; g.fillRect(0, 98, 512, 14); } else { g.fillStyle = '#f2f2ee'; g.fillRect(0, 100, 512, 4); g.fillStyle = '#119246'; g.fillRect(0, 104, 512, 8); }
    g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = 54; g.font = `bold ${fs}px ${st.cc ? 'Georgia, serif' : 'Arial, sans-serif'}`; while (g.measureText(l1).width > 490 && fs > 20) { fs -= 2; g.font = `bold ${fs}px ${st.cc ? 'Georgia, serif' : 'Arial, sans-serif'}`; }
    g.fillText(l1, 256, 40); g.font = `24px ${st.cc ? 'Georgia, serif' : 'Arial, sans-serif'}`; g.fillText(l2, 256, 82);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const sm = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05 }); SIGN_MATS.push(sm);
    const edge = lam(blue), sy = Math.max(3.65, Math.min(st.b.h - 0.7, 4.2));
    put(boxG(W, W * 112 / 512, 0.12), [edge, edge, edge, edge, sm, edge], 0, sy, 0.07, false);
    // the lantern by the door (the Carabinieri blue lamp; a blue POLIZIA LOCALE light box)
    const lv = document.createElement('canvas'); lv.width = 256; lv.height = 96; const lg = lv.getContext('2d');
    lg.fillStyle = st.cc ? '#1f46a8' : '#2a5cff'; lg.fillRect(0, 0, 256, 96); lg.fillStyle = '#ffffff'; lg.textAlign = 'center'; lg.textBaseline = 'middle';
    if (st.cc) { lg.font = 'bold 38px Georgia, serif'; lg.fillText('CARABINIERI', 128, 50); } else { lg.font = 'bold 34px Arial, sans-serif'; lg.fillText('POLIZIA', 128, 30); lg.fillText('LOCALE', 128, 70); }
    const lt = new THREE.CanvasTexture(lv), lm = new THREE.MeshLambertMaterial({ map: lt, emissiveMap: lt, emissive: 0xffffff, emissiveIntensity: 0.05 }); SIGN_MATS.push(lm);
    const lx = W / 2 + 0.95, dark = lam(0x1d1f22);
    put(boxG(0.09, 0.09, 0.7), dark, lx, 3.12, 0.35, false);
    put(boxG(1.3, 0.5, 0.5), [lm, lm, dark, dark, lm, lm], lx, 2.82, 0.75, false);
    put(boxG(1.4, 0.08, 0.58), dark, lx, 3.1, 0.75, false);
    if (st.cc) put(boxG(0.2, 0.26, 0.2), lam(0xc8102e), lx, 3.27, 0.75, false); // the flaming grenade on top, more or less
    // flags on poles leaning out of the facade, beside the sign (above it on a narrow front)
    const kinds = st.cc ? ['it', 'eu'] : ['it', 'lo', 'eu'], side = W / 2 + 0.55 + (kinds.length - 1) * 0.95 < st.L / 2 - 0.3, tilt = 0.85, PL = 2.6;
    const fy = side ? sy - 0.2 : sy + W * 56 / 512 + 0.35;
    kinds.forEach((k, i) => {
      const x = side ? -(W / 2 + 0.55 + i * 0.95) : (i - (kinds.length - 1) / 2) * 1.15;
      const tip = [x, fy + Math.cos(tilt) * PL, Math.sin(tilt) * PL];
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, PL, 6), lam(0xd9d6cf)); pole.position.set(x, fy + Math.cos(tilt) * PL / 2, Math.sin(tilt) * PL / 2); pole.rotation.x = tilt; root.add(pole);
      put(new THREE.SphereGeometry(0.07, 8, 6), lam(0xd8b24a), tip[0], tip[1], tip[2], false);
      // the cloth hangs from the upper part of the pole: hoist along the pole, fly end falling straight down
      const geo = new THREE.PlaneGeometry(1, 1, 6, 1), pos = geo.attributes.position, s0 = 0.55, s1 = 0.97, H = 1.6, base = [];
      for (let j = 0; j < pos.count; j++) { const u = pos.getX(j) + 0.5, v = pos.getY(j) + 0.5, s = lerp(s0, s1, v); base.push([x, fy + Math.cos(tilt) * PL * s - u * H, Math.sin(tilt) * PL * s + u * 0.08, u]); }
      const fm = new THREE.MeshLambertMaterial({ map: FLAG_TEX[k] || (FLAG_TEX[k] = flagTex(k)), side: THREE.DoubleSide });
      const mesh = new THREE.Mesh(geo, fm); mesh.castShadow = true; root.add(mesh);
      const uv = geo.attributes.uv; for (let j = 0; j < uv.count; j++) uv.setXY(j, base[j][3], uv.getY(j)); // canvas left (hoist) at the pole
      st.flags.push({ geo, base, ph: i * 1.7 });
    });
    updFlags(st, 0);
  }
}
function updFlags(st, t) {
  for (const f of st.flags) {
    const pos = f.geo.attributes.position;
    for (let j = 0; j < pos.count; j++) { const [x, y, z, u] = f.base[j], w = Math.sin(t * 2.6 + f.ph + u * 3.4) * 0.16 * u; pos.setXYZ(j, x + w, y, z + Math.abs(w) * 0.4); }
    pos.needsUpdate = true; f.geo.computeVertexNormals();
  }
}
function updCaserme(dt) { for (const st of CASERME) if (st.root && st.root.parent && st.root.parent.visible && hyp(st.x - camera.position.x, st.z - camera.position.z) < 160) updFlags(st, now); }

// ---------------------------------------------------------------- cemeteries: rows of graves, crosses and cypresses
const CYP_G = (() => { const g = new THREE.ConeGeometry(0.9, 9, 7); g.translate(0, 5.2, 0); return g; })(), TOMB_G = new THREE.BoxGeometry(0.95, 0.28, 2.0), STONE_G = new THREE.BoxGeometry(0.8, 1.0, 0.14);
function buildCemetery(T, G) {
  const tombs = [], cyps = [];
  for (const a of T.d.a || []) {
    if (a.t !== 14) continue;
    const outer = dec(a.p), holes = (a.k || []).map(dec), bb = bbox(outer);
    let ang = 0, best = 0; for (let i = 0; i < outer.length; i++) { const p = outer[i], q = outer[(i + 1) % outer.length], L = hyp(q[0] - p[0], q[1] - p[1]); if (L > best) { best = L; ang = Math.atan2(q[1] - p[1], q[0] - p[0]); } } // rows follow the longest wall
    const ux = Math.cos(ang), uz = Math.sin(ang), vx = -uz, vz = ux, cx = (bb[0] + bb[2]) / 2, cz = (bb[1] + bb[3]) / 2, R = hyp(bb[2] - bb[0], bb[3] - bb[1]) / 2;
    const inside = (x, z, m) => inPoly(x, z, outer) && !holes.some(h => inPoly(x, z, h)) && !inBuilding(x, z, m) && !onAnyRoad(x, z, 1.2) && !onFoot(x, z);
    for (let i = -R; i <= R; i += 1.6) for (let j = -R; j <= R; j += 3.2) {
      if (Math.abs((j / 3.2) % 5) < 0.01) continue; // a path every few rows
      const x = cx + ux * i + vx * j, z = cz + uz * i + vz * j; if (x < bb[0] || x > bb[2] || z < bb[1] || z > bb[3]) continue;
      if (inside(x, z, 1.2) && inside(x + vx * 1.2, z + vz * 1.2, 0.3) && inside(x - vx * 1.2, z - vz * 1.2, 0.3)) tombs.push([x, z, ang]);
    }
    for (let i = 0; i < outer.length; i++) { const p = outer[i], q = outer[(i + 1) % outer.length], L = hyp(q[0] - p[0], q[1] - p[1]); for (let s = 4; s < L - 2; s += 9) { const t = s / L, x = lerp(p[0], q[0], t), z = lerp(p[1], q[1], t), mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2; let nx = -(q[1] - p[1]) / L, nz = (q[0] - p[0]) / L; if (!inPoly(x + nx * 2, z + nz * 2, outer)) { nx = -nx; nz = -nz; } const X = x + nx * 2.2, Z = z + nz * 2.2; if (inside(X, Z, 1)) cyps.push([X, Z]); } }
  }
  if (!tombs.length && !cyps.length) return;
  const m = new THREE.Matrix4(), qq = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1), pp = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0);
  const mk = (geo, mat, list, f) => { if (!list.length) return; const im = new THREE.InstancedMesh(geo, mat, list.length); list.forEach((t, i) => { f(t, pp); qq.setFromAxisAngle(up, -t[2] || 0); m.compose(pp, qq, sc); im.setMatrixAt(i, m); }); im.castShadow = true; G.add(im); };
  mk(TOMB_G, lam(0xb8b4ac), tombs, (t, p) => p.set(t[0], groundH(t[0], t[1]) + 0.14, t[1]));
  mk(STONE_G, lam(0x8e8a84), tombs.map(t => [t[0] - Math.sin(t[2]) * 0.95, t[1] + Math.cos(t[2]) * 0.95, t[2]]), (t, p) => p.set(t[0], groundH(t[0], t[1]) + 0.5, t[1])); // headstone at the head end
  mk(CYP_G, lam(0x2f4a2a), cyps.map(c => [c[0], c[1], 0]), (t, p) => p.set(t[0], groundH(t[0], t[1]), t[1]));
}

// ---------------------------------------------------------------- traffic lights (semafori) and bus stops
const SIGG = new Grid(32), SIG_MAT = [0, 1].map(() => ({ r: new THREE.MeshLambertMaterial({ color: 0x3a0806, emissive: 0xff2a14, emissiveIntensity: 0 }), y: new THREE.MeshLambertMaterial({ color: 0x3a2a06, emissive: 0xffb020, emissiveIntensity: 0 }), g: new THREE.MeshLambertMaterial({ color: 0x063a12, emissive: 0x30ff70, emissiveIntensity: 0 }) }));
const SIGNALS = [];
const axisOf = (dx, dz) => Math.abs(dx) > Math.abs(dz) ? 1 : 0;
for (const i of D.signals || []) {
  let best = null;
  ROADSEG.each(N[i][0] - 1, N[i][1] - 1, N[i][0] + 1, N[i][1] + 1, sg => { if ((sg.ia === i || sg.ib === i) && sg.r.c <= 3 && (!best || sg.r.c < best.r.c)) best = sg; });
  if (!best) continue;
  const dx = best.b[0] - best.a[0], dz = best.b[1] - best.a[1], L = hyp(dx, dz) || 1;
  const sgn = { x: N[i][0], z: N[i][1], ux: dx / L, uz: dz / L, w: best.r.w, axis: axisOf(dx, dz) };
  SIGNALS.push(sgn); SIGG.add(sgn.x, sgn.z, sgn.x, sgn.z, sgn);
}
const SIG_CYCLE = 26;
function sigState(axis) { const t = now % SIG_CYCLE, a = axis ? (t + 13) % SIG_CYCLE : t; return a < 11 ? 'g' : a < 13 ? 'y' : 'r'; }
function updSignals() { for (const ax of [0, 1]) { const st = sigState(ax), m = SIG_MAT[ax]; m.r.emissiveIntensity = st === 'r' ? 2 : 0.02; m.y.emissiveIntensity = st === 'y' ? 2 : 0.02; m.g.emissiveIntensity = st === 'g' ? 2 : 0.02; } }
function buildSignals(T, G) {
  for (const sg of SIGNALS) {
    if (tileOf(sg.x, sg.z) !== T.t) continue;
    for (const sd of [1, -1]) { // one pole per direction, on the right-hand kerb, facing the oncoming traffic
      const rx = -sg.uz * sd, rz = sg.ux * sd, px = sg.x + rx * (sg.w / 2 + 1.2) - sg.ux * sd * 4, pz = sg.z + rz * (sg.w / 2 + 1.2) - sg.uz * sd * 4, gy = groundH(px, pz);
      const root = new THREE.Group(); root.position.set(px, gy, pz); root.rotation.y = Math.atan2(-sg.ux * sd, -sg.uz * sd); G.add(root);
      if (!sg.props) sg.props = []; if (sg.props.length < 2) sg.props.push(addProp({ x: px, z: pz, y: gy, r: 0.15, h: 3.5, obj: root })); else { const pr = sg.props[sd > 0 ? 0 : 1]; pr.obj = root; if (pr.broken) root.rotation.x = 1.45; }
      const pole = new THREE.Mesh(boxG(0.14, 3.4, 0.14), lam(0x3a3d42)); pole.position.y = 1.7; pole.castShadow = true; root.add(pole);
      const head = new THREE.Mesh(boxG(0.36, 1.0, 0.26), lam(0x1d1f22)); head.position.set(0, 3.0, 0.05); root.add(head);
      const m = SIG_MAT[sg.axis];
      [['r', 3.3], ['y', 3.0], ['g', 2.7]].forEach(([c, y]) => { const l = new THREE.Mesh(boxG(0.2, 0.2, 0.06), m[c]); l.position.set(0, y, 0.2); root.add(l); });
    }
  }
  for (const [X, Z, name] of D.bus || []) {
    let x = X / 10, z = Z / 10; if (tileOf(x, z) !== T.t) continue;
    let ux = 1, uz = 0, bd = 1e9, bs = null; ROADSEG.each(x - 15, z - 15, x + 15, z + 15, sg => { if (sg.r.c > 3) return; const d = segDist(x, z, sg.a[0], sg.a[1], sg.b[0], sg.b[1]); if (d < bd) { bd = d; bs = sg; const L = hyp(sg.b[0] - sg.a[0], sg.b[1] - sg.a[1]) || 1; ux = (sg.b[0] - sg.a[0]) / L; uz = (sg.b[1] - sg.a[1]) / L; } });
    if (bs && bd < bs.r.w / 2 + 1.4) { // push it out to the kerb, on the side it was drawn (right-hand side if dead centre)
      let sx = -uz, sz = ux; const side = (x - bs.a[0]) * sx + (z - bs.a[1]) * sz; if (side < -0.2) { sx = -sx; sz = -sz; }
      const want = bs.r.w / 2 + 1.6, along = (x - bs.a[0]) * ux + (z - bs.a[1]) * uz, cx = bs.a[0] + ux * along, cz = bs.a[1] + uz * along; x = cx + sx * want; z = cz + sz * want;
    }
    if (inBuilding(x, z, 0.6)) continue;
    const gy = surfAt(x, z), root = new THREE.Group(); root.position.set(x, gy, z); root.rotation.y = Math.atan2(ux, uz); G.add(root);
    const glass = new THREE.MeshLambertMaterial({ color: 0x9fb7c4, transparent: true, opacity: 0.45 });
    const roof = new THREE.Mesh(boxG(1.6, 0.08, 3.4), lam(0x5a6068)); roof.position.set(0, 2.45, 0); roof.castShadow = true; root.add(roof);
    const back = new THREE.Mesh(boxG(0.05, 2.0, 3.2), glass); back.position.set(-0.75, 1.3, 0); root.add(back);
    for (const zz of [-1.6, 1.6]) { const pst = new THREE.Mesh(boxG(0.08, 2.45, 0.08), lam(0x5a6068)); pst.position.set(-0.75, 1.22, zz); root.add(pst); }
    const bench = new THREE.Mesh(boxG(0.4, 0.08, 2.4), lam(0x7a5a3a)); bench.position.set(-0.5, 0.5, 0); root.add(bench);
    const sign = new THREE.Mesh(boxG(0.06, 0.5, 0.5), lam(0xf0b23c)); sign.position.set(0.7, 2.7, 1.9); root.add(sign);
    const sp = new THREE.Mesh(boxG(0.06, 2.7, 0.06), lam(0x5a6068)); sp.position.set(0.7, 1.35, 1.9); root.add(sp);
    // the shelter goes over when rammed, like the street lamps; built again, a fallen one stays down
    const key = X + ',' + Z, old = BUS_PROPS.get(key);
    if (!old) BUS_PROPS.set(key, addProp({ x: x - Math.cos(root.rotation.y) * 0.3, z: z + Math.sin(root.rotation.y) * 0.3, y: gy, r: 1.1, h: 2.6, obj: root }));
    else { old.obj = root; if (old.broken) root.visible = false; }
  }
}
const BUS_PROPS = new Map();

// ---------------------------------------------------------------- barriers (sbarre)
const armTex = canvasTex(256, 16, (g, w, h) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#f3f1ea' : '#d22c22'; g.fillRect(i * 32, 0, 32, h); } }, false);
for (const g of LX) if (g.drive) {
  const nx = -g.uz, nz = g.ux; g.bars = []; g.lampA = new THREE.MeshLambertMaterial({ color: 0x3a0806, emissive: 0xff2a14, emissiveIntensity: 0 }); g.lampB = g.lampA.clone();
  for (const s of [-1, 1]) {
    const cx = g.x + g.ux * g.ext * s, cz = g.z + g.uz * g.ext * s, px = cx + nx * (g.hw + 0.55) * s, pz = cz + nz * (g.hw + 0.55) * s, Lb = 2 * g.hw + 0.7;
    const root = new THREE.Group(); root.position.set(px, groundH(px, pz), pz); root.rotation.y = Math.atan2(s * nz, -s * nx); scene.add(root);
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, 0.22), lam(0x3c3f44)); post.position.y = 1.35; post.castShadow = true; root.add(post);
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.75, 0.42), lam(0x5d6168)); box.position.set(-0.05, 0.38, 0); root.add(box);
    for (const [k, m] of [[-0.18, g.lampA], [0.18, g.lampB]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.16, 0.12), m); l.position.set(k, 2.05, 0); root.add(l); }
    for (const rz of [0.79, -0.79]) { const c = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.95, 0.04), lam(0xf3f1ea)); c.position.set(0, 2.55, 0); c.rotation.z = rz; root.add(c); }
    const arm = new THREE.Group(); arm.position.set(0, 1.0, 0); root.add(arm);
    const geo = new THREE.BoxGeometry(Lb, 0.13, 0.11); geo.translate(Lb / 2, 0, 0);
    const beam = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ map: armTex })); beam.castShadow = true; arm.add(beam);
    const ex = px - s * nx * Lb, ez = pz - s * nz * Lb;
    const gy0 = groundH(px, pz), seg = { ax: px, az: pz, bx: ex, bz: ez, nx: g.ux, nz: g.uz, two: true, dyn: true, on: false, y0: gy0 - 3, y1: gy0 + 2.5 };
    WALLS.add(px, pz, ex, ez, seg);
    const probe = []; for (let t = 0.1; t <= 1; t += 0.2) probe.push([lerp(px, ex, t), lerp(pz, ez, t)]);
    const bar = { arm, seg, probe, root }; g.bars.push(bar);
    addProp({ x: px, z: pz, y: groundH(px, pz), r: 0.2, h: 3, obj: root, onBreak: () => { bar.broken = true; seg.on = false; bar.probe = []; } }); // the post knocked down takes its arm with it
  }
}

// Prealpi on the northern horizon (Resegone & Grigne)
{
  const mk = (z, hmin, hmax, col, snow) => {
    const b = Buf(); let prev = null;
    for (let x = -5200; x <= 5200; x += 130) {
      const big = Math.exp(-(((x - 1400) / 700) ** 2)) * 420 + Math.exp(-(((x + 900) / 900) ** 2)) * 300;
      const y = hmin + srnd() * (hmax - hmin) + big, zz = z + Math.abs(x) * 0.18;
      const top = vtx(b, x, y, zz, 0, 0, 1, 0, 0, COL(snow && y > 560 ? '#e9edf2' : col)), bot = vtx(b, x, -20, zz, 0, 0, 1, 0, 0, COL(col));
      if (prev) b.i.push(prev[1], bot, top, prev[1], top, prev[0]);
      prev = [top, bot];
    }
    const m = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ vertexColors: true, fog: false, side: THREE.DoubleSide }));
    m.geometry.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); m.geometry.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); m.geometry.setIndex(b.i);
    m.renderOrder = -1; scene.add(m); return m;
  };
  window._far = mk(-4300, 260, 520, '#9fb0c6', true);
  window._near = mk(-3300, 60, 210, '#a3ad9f', false);
}
