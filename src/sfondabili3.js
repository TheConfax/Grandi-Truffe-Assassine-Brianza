// ---------------------------------------------------------------- barriers a car breaks through, as in GTA (Carlo, 26/10)
// What counts is what the game draws (the kinds of src/barriere.py), not the DBGT code: 5 wire mesh, 7 post and rail break one
// panel at a time (the 2-3 m piece you hit), which flies off with a few bits; 3 a hedge opens only where the car passes, a hole as wide as the
// car, and slows it; 1 wall, 2 low wall with railings, 4 retaining wall, 6 railway fence (drawn as a concrete kerb with mesh panels on top: it looks like a low wall with railings) never. Every break slows the car and does it a little harm. The broken
// pieces stay broken while their tile is built: a tile built again (you went away and came back) has them all whole. The railway corridor
// fences of OSM (T.fe: a 0.9 m concrete wall under the net) stay solid, the gates and the building-site panels as they were.
// The collision segments are those of world3.js (one per drawn segment, in WALLS); a broken one is off (s.off, skipped by collideStatic and
// rayWalls). The mesh stays one per material per tile: a broken piece knows its index ranges and has them zeroed.
const BAR_PANEL = { 5: { len: 2.6, slow: 0.86, dmg: 2, bit: 0x6f8a6f }, 7: { len: 2.5, slow: 0.88, dmg: 1.5, bit: 0x8a6a4a } };
const BAR_HEDGE = { slowPerM: 0.12, dmgPerM: 0.4, bit: 0x4f7a3a };
const BAR_MIN_P = 3, BAR_VN_P = 1.2, BAR_MIN_H = 2.5, BAR_VN_H = 0.8; // m/s: speed of the car and towards the barrier needed to break it
const BAR_KEYS = ['wl', 'ft', 'hd', 'wlP0', 'wlP1', 'bars', 'mesh', 'rly', 'wood'];
const BAR_CAST = { wl: 'cast', hd: 'cast', wlP0: 'cast', wlP1: 'cast', wood: 'cast' };
const barMats = () => ({ wl: MAT.wall, ft: MAT.railing, hd: MAT.hedge, wlP0: MAT.wallPlaster, wlP1: MAT.wallOchre, bars: MAT.bars, mesh: MAT.mesh, rly: MAT.railPanel, wood: MAT.wood });
const BARG = new Grid(8), BAR_FLY = [], BAR_DOWN = [];
const barBufs = () => { const B = { posts: [] }; for (const k of BAR_KEYS) B[k] = Buf(); return B; };

// the pieces of one barrier of tile T (rec as world3.js keeps it in T.ba, segs[k - 1] the collision segment of its segment k or null)
function barPieces(T, rec, segs) {
  const sp = BAR_PANEL[rec.t], pts = rec.pts; rec.pc = [];
  const add = pc => { let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (const s of pc.segs) { x0 = Math.min(x0, s.ax, s.bx); z0 = Math.min(z0, s.az, s.bz); x1 = Math.max(x1, s.ax, s.bx); z1 = Math.max(z1, s.az, s.bz); }
    pc.gy = H.ground((x0 + x1) / 2, (z0 + z1) / 2); BARG.add(x0 - 0.5, z0 - 0.5, x1 + 0.5, z1 + 0.5, pc); (T.barPc || (T.barPc = [])).push(pc); for (let k = pc.k0; k <= pc.k1; k++) rec.pc[k] = pc; };
  if (!sp) { // a hedge: each segment on its own, cut where the car passes
    for (let k = 1; k < pts.length; k++) if (segs[k - 1]) add({ T, rec, t: 3, hedge: true, k0: k, k1: k, segs: [segs[k - 1]], seg: segs[k - 1], cut: [], subs: [] });
    return;
  }
  let cur = null, len = 0;
  for (let k = 1; k < pts.length; k++) {
    const s = segs[k - 1]; if (!s) continue; const L = hyp(s.bx - s.ax, s.bz - s.az);
    if (cur && len >= 1.5 && len + L > 3.0) { add(cur); cur = null; }
    if (!cur) { cur = { T, rec, t: rec.t, k0: k, k1: k, segs: [] }; len = 0; }
    cur.segs.push(s); cur.k1 = k; len += L;
  }
  if (cur) add(cur);
}

// the look of a barrier: one per property (br.v, from the build: the building the divider belongs to), else per divider; plaster or concrete,
// a higher or lower base, bars or mesh on top
function barLook(br) {
  const pts = br.pts, hv = br.v != null ? br.v : (Math.sin(pts[0][0] * 12.9898 + pts[0][1] * 78.233) * 43758.5453) % 1, hh = Math.abs(hv), base = br.t === 2 ? 0.35 + (hh * 7 % 1) * 0.6 : 0.5;
  return { base, wallK: br.t === 2 && hh < 0.6 ? (hh < 0.3 ? 'wlP0' : 'wlP1') : 'wl', railK: br.t === 2 && (hh * 13 % 1) < 0.55 ? 'bars' : 'ft' };
}
// one segment a→c of a barrier into the buffers B (acc: the length drawn before it, for the texture). cap: 1 its end at a closed, 2 at c (the
// two ends of a barrier and the sides of a hole: a thick slab open at its end showed its empty inside, Carlo 26/10)
function barDraw(B, br, lk, a, c, acc, cap = 0) {
  const L = hyp(c[0] - a[0], c[1] - a[1]), ga = H.ground(a[0], a[1]), gc = H.ground(c[0], c[1]), ux = (c[0] - a[0]) / L, uz = (c[1] - a[1]) / L, nx = uz, nz = -ux;
  const slab = (b, th, y0a, y0c, y1a, y1c, cp = cap) => { // thin vertical slab, both faces + cap
    for (const sd of [1, -1]) { const b0 = b.p.length / 3, ox = nx * th * sd, oz = nz * th * sd; vtx(b, a[0] + ox, y0a, a[1] + oz, nx * sd, 0, nz * sd, acc / 2, 0); vtx(b, c[0] + ox, y0c, c[1] + oz, nx * sd, 0, nz * sd, (acc + L) / 2, 0); vtx(b, c[0] + ox, y1c, c[1] + oz, nx * sd, 0, nz * sd, (acc + L) / 2, 1); vtx(b, a[0] + ox, y1a, a[1] + oz, nx * sd, 0, nz * sd, acc / 2, 1); b.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2); }
    const b0 = b.p.length / 3; vtx(b, a[0] + nx * th, y1a, a[1] + nz * th, 0, 1, 0, 0, 1); vtx(b, c[0] + nx * th, y1c, c[1] + nz * th, 0, 1, 0, 0, 1); vtx(b, c[0] - nx * th, y1c, c[1] - nz * th, 0, 1, 0, 0, 1); vtx(b, a[0] - nx * th, y1a, a[1] - nz * th, 0, 1, 0, 0, 1); triUp(b, b0, b0 + 1, b0 + 2); triUp(b, b0, b0 + 2, b0 + 3);
    for (const [e, p, y0, y1, sg] of [[1, a, y0a, y1a, -1], [2, c, y0c, y1c, 1]]) if (cp & e) { const q = b.p.length / 3, ex = ux * sg, ez = uz * sg; vtx(b, p[0] + nx * th, y0, p[1] + nz * th, ex, 0, ez, 0, 0); vtx(b, p[0] - nx * th, y0, p[1] - nz * th, ex, 0, ez, th, 0); vtx(b, p[0] - nx * th, y1, p[1] - nz * th, ex, 0, ez, th, 1); vtx(b, p[0] + nx * th, y1, p[1] + nz * th, ex, 0, ez, 0, 1); b.i.push(q, q + 1, q + 2, q, q + 2, q + 3, q, q + 2, q + 1, q, q + 3, q + 2); } // both windings: whichever way round the ring goes
  };
  const panel = (b, y0, y1, rep) => { const b0 = b.p.length / 3; vtx(b, a[0], ga + y0, a[1], nx, 0, nz, acc / rep, 0); vtx(b, c[0], gc + y0, c[1], nx, 0, nz, (acc + L) / rep, 0); vtx(b, c[0], gc + y1, c[1], nx, 0, nz, (acc + L) / rep, 1); vtx(b, a[0], ga + y1, a[1], nx, 0, nz, acc / rep, 1); b.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3); };
  const postsEvery = (step, y0) => { for (let s0 = 0; s0 < L; s0 += step) B.posts.push([a[0] + ux * s0, a[1] + uz * s0, ga + (gc - ga) * s0 / L + y0, br.h - y0]); };
  if (br.t === 1 || br.t === 4) slab(B.wl, 0.14, ga - 0.3, gc - 0.3, ga + br.h, gc + br.h);
  else if (br.t === 3) slab(B.hd, 0.45, ga - 0.2, gc - 0.2, ga + br.h, gc + br.h);
  else if (br.t === 5) { panel(B.mesh, 0, br.h, 2.6); postsEvery(2.5, 0); } // wire mesh on posts, from the ground
  else if (br.t === 6) { slab(B.wl, 0.1, ga - 0.3, gc - 0.3, ga + 0.3, gc + 0.3, 3); panel(B.rly, 0.3, br.h, 2.6); postsEvery(2.5, 0.3); } // by the railway: a concrete kerb, tall panels
  else if (br.t === 7) { for (const y of [0.45, 0.95]) slab(B.wood, 0.04, ga + y, gc + y, ga + y + 0.12, gc + y + 0.12); for (let s0 = 0; s0 < L; s0 += 2.5) { const x = a[0] + ux * s0, z = a[1] + uz * s0, gy = ga + (gc - ga) * s0 / L; addBox(B.wood, x, gy + 0.6, z, 0.12, 1.2, 0.12, null); } } // post and rail
  else { // muretto + cancellata, the Brianza classic
    const wb = B[lk.wallK], rb = B[lk.railK];
    slab(wb, 0.12, ga - 0.3, gc - 0.3, ga + lk.base, gc + lk.base);
    panel(rb, lk.base, br.h, lk.railK === 'bars' ? 1.2 : 2.6);
    postsEvery(2.6, lk.base);
  }
}
// where a piece starts and ends in the buffers: its index ranges, its posts
const barMark = B => BAR_KEYS.map(k => B[k].i.length).concat(B.posts.length);
function barMarkEnd(B, m) { const r = []; BAR_KEYS.forEach((k, j) => { if (B[k].i.length > m[j]) r.push([k, m[j], B[k].i.length]); }); return { r, p0: m[BAR_KEYS.length], p1: B.posts.length }; }

// the tile's barriers drawn (world3.js): the meshes, and every piece whole again
function barTile(T, B, G) {
  const M = {}, MT = barMats();
  for (const k of BAR_KEYS) if (B[k].i.length) M[k] = mkMesh(B[k], MT[k], 10, BAR_CAST[k], G);
  if (B.posts.length) { // [x, z, foot, length]
    const pg = new THREE.BoxGeometry(0.06, 1, 0.06); pg.translate(0, 0.5, 0);
    const pm = new THREE.InstancedMesh(pg, MAT.post, B.posts.length), mtx = new THREE.Matrix4(), sc = new THREE.Vector3(), qq = new THREE.Quaternion(), pp = new THREE.Vector3();
    B.posts.forEach(([x, z, y, h], i) => { mtx.compose(pp.set(x, y, z), qq, sc.set(1, Math.max(0.1, h), 1)); pm.setMatrixAt(i, mtx); }); G.add(pm); M.posts = pm;
  }
  for (const pc of T.barPc || []) {
    pc.M = M; pc.off = false; for (const s of pc.segs) s.off = false;
    if (pc.hedge) { pc.cut = []; pc.rep = null; pc.hid = false; pc.ext = 0; for (const s of pc.subs) s.off = true; }
  }
  for (let i = BAR_FLY.length - 1; i >= 0; i--) if (BAR_FLY[i].T === T) BAR_FLY.splice(i, 1);
  for (let i = BAR_DOWN.length - 1; i >= 0; i--) if (BAR_DOWN[i].T === T) BAR_DOWN.splice(i, 1);
}
function barHide(pc) { // its triangles out of the tile's meshes, its posts out of the instances
  for (const [k, i0, i1] of pc.r || []) { const m = pc.M[k]; if (!m) continue; const ix = m.geometry.index; ix.array.fill(0, i0, i1); ix.needsUpdate = true; }
  const pm = pc.M.posts; if (pm && pc.p1 > pc.p0) { const z = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = pc.p0; i < pc.p1; i++) pm.setMatrixAt(i, z); pm.instanceMatrix.needsUpdate = true; }
}

// ---- the vehicles: before v.collide(), as the gates and the props
function barHits(v) {
  if (v.speed < BAR_MIN_H) return;
  const cs = v.circles(), R = v.rad + 0.15;
  BARG.each(v.x - 5, v.z - 5, v.x + 5, v.z + 5, pc => {
    if (pc.off || !pc.M || !pc.T.ready || Math.abs(v.y - pc.gy) > 2.5) return;
    if (pc.hedge) { hedgeHit(pc, v, cs, R); return; }
    if (v.speed < BAR_MIN_P) return;
    for (const s of pc.segs) for (const c of cs) if (segDist(c[0], c[1], s.ax, s.az, s.bx, s.bz) < R && Math.abs(v.vx * s.nx + v.vz * s.nz) > BAR_VN_P) { barBreak(pc, v); return; }
  });
}
function barBreak(pc, v) {
  pc.off = true; for (const s of pc.segs) s.off = true; barHide(pc);
  const sp = BAR_PANEL[pc.t], speed = v.speed;
  v.vx *= sp.slow; v.vz *= sp.slow; v.health = Math.max(0, v.health - sp.dmg);
  if (v === P.car) { sfxCrash(Math.min(9, speed)); shake = Math.max(shake, 0.3); }
  if (window.__BAR_LOG) __BAR_LOG.push({ t: pc.t, v0: speed, v1: v.speed, dmg: sp.dmg, d: v.driver, k: v.kind, x: v.x, z: v.z, ai: v.ai && v.ai.state });
  barFly(pc, v, speed);
}
// the panel goes over away from the car, about its own foot, and is thrown along when the car was fast; then it lies where it fell
function barFly(pc, v, speed) {
  const G = pc.T.group; if (!G) return;
  const B = barBufs(), pts = pc.rec.pts, lk = barLook(pc.rec); let acc = pc.acc0 || 0;
  for (let k = pc.k0; k <= pc.k1; k++) { const a = pts[k - 1], c = pts[k], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue; barDraw(B, pc.rec, lk, a, c, acc, (k === pc.k0 ? 1 : 0) | (k === pc.k1 ? 2 : 0)); acc += L; }
  const A = pts[pc.k0 - 1], C = pts[pc.k1], cx = (A[0] + C[0]) / 2, cz = (A[1] + C[1]) / 2, gy = H.ground(cx, cz), Lp = hyp(C[0] - A[0], C[1] - A[1]) || 1, ux = (C[0] - A[0]) / Lp, uz = (C[1] - A[1]) / Lp;
  const o = new THREE.Group(), inner = new THREE.Group(), MT = barMats(); inner.position.set(-cx, -gy, -cz); o.add(inner); o.position.set(cx, gy, cz);
  for (const k of BAR_KEYS) if (B[k].i.length) mkMesh(B[k], MT[k], 10, BAR_CAST[k], inner);
  if (B.posts.length) { const pb = Buf(); for (const [x, z, y, h] of B.posts) addBox(pb, x, y + h / 2, z, 0.06, h, 0.06, null); mkMesh(pb, MAT.post, 10, 'cast', inner); }
  G.add(o);
  const side = v.vx * -uz + v.vz * ux >= 0 ? 1 : -1, axis = new THREE.Vector3(ux * side, 0, uz * side); // the top goes towards the car's way
  const k = 0.35 + Math.min(0.35, speed * 0.015);
  BAR_FLY.push({ o, T: pc.T, axis, a: 0, w: 1.2 + speed * 0.2, max: 1.5 + Math.random() * 0.05, vx: v.vx * k, vz: v.vz * k, vy: speed > 6 ? 0.4 + speed * 0.09 : 0, yaw: (Math.random() - 0.5) * speed * 0.05, t: 0 });
  BAR_DOWN.push({ o, T: pc.T }); while (BAR_DOWN.length > 80) { const d = BAR_DOWN.shift(); if (d.o.parent) d.o.parent.remove(d.o); d.o.traverse(m => { if (m.geometry) m.geometry.dispose(); }); }
  barBits(cx, gy + 0.8, cz, v, BAR_PANEL[pc.t].bit, 6);
}

// a hedge: the cut intervals of a segment (fractions 0..1, sorted, apart); returns the new length cut
function hedgeCut(pc, t0, t1) {
  const c = pc.cut, before = c.reduce((s, [a, b]) => s + b - a, 0); c.push([t0, t1]); c.sort((p, q) => p[0] - q[0]);
  const m = []; for (const iv of c) { const l = m[m.length - 1]; if (l && iv[0] <= l[1] + 1e-4) l[1] = Math.max(l[1], iv[1]); else m.push([iv[0], iv[1]]); }
  pc.cut = m; return m.reduce((s, [a, b]) => s + b - a, 0) - before;
}
function hedgeHit(pc, v, cs, R) {
  const s = pc.seg, ex = s.bx - s.ax, ez = s.bz - s.az, L = hyp(ex, ez); if (L < 0.05) return;
  if (Math.abs(v.vx * s.nx + v.vz * s.nz) < BAR_VN_H) return; // along it, not into it
  let got = 0;
  for (const c of cs) {
    const t = ((c[0] - s.ax) * ex + (c[1] - s.az) * ez) / (L * L), d = Math.abs((c[0] - s.ax) * ez - (c[1] - s.az) * ex) / L; if (d >= R) continue;
    const hw = Math.sqrt(R * R - d * d) / L, t0 = Math.max(0, t - hw), t1 = Math.min(1, t + hw); if (t1 <= t0) continue;
    got += hedgeCut(pc, t0, t1) * L;
  }
  if (got < 0.01) return;
  hedgeRedraw(pc);
  for (const [nb, at, e] of [[pc.rec.pc[pc.k0 - 1], 0, 2], [pc.rec.pc[pc.k0 + 1], 1, 1]]) // cut to its end: the next piece of hedge closed on that side
    if (nb && nb.hedge && nb !== pc && !(nb.ext & e) && pc.cut.some(([a, b]) => at ? b > 1 - 1e-6 : a < 1e-6)) { nb.ext |= e; hedgeRedraw(nb); }
  const f = Math.exp(-BAR_HEDGE.slowPerM * got), speed = v.speed; v.vx *= f; v.vz *= f; v.health = Math.max(0, v.health - BAR_HEDGE.dmgPerM * got);
  if (v === P.car) { if (got > 0.3) sfxCrash(Math.min(4, 2 + speed * 0.1)); shake = Math.max(shake, 0.12); }
  if (window.__BAR_LOG) __BAR_LOG.push({ t: 3, v0: speed, v1: v.speed, dmg: BAR_HEDGE.dmgPerM * got, m: got, d: v.driver, k: v.kind, x: v.x, z: v.z, ai: v.ai && (v.ai.state || v.ai.mode), vn: Math.abs(v.vx * pc.seg.nx + v.vz * pc.seg.nz), h: v.h });
  const mx = (cs[0][0] + cs[1][0]) / 2, mz = (cs[0][1] + cs[1][1]) / 2; barBits(mx, pc.gy + 1, mz, v, BAR_HEDGE.bit, Math.min(6, 1 + Math.round(got * 3)));
}
function hedgeRedraw(pc) { // the segment drawn again without its cuts; its collision the pieces left
  if (!pc.hid) { barHide(pc); pc.hid = true; pc.seg.off = true; }
  const s = pc.seg, rec = pc.rec, L = hyp(s.bx - s.ax, s.bz - s.az), keep = []; let u = 0;
  for (const [a, b] of pc.cut) { if (a - u > 0.1 / L) keep.push([u, a]); u = b; } if (1 - u > 0.1 / L) keep.push([u, 1]);
  if (pc.rep) { if (pc.rep.parent) pc.rep.parent.remove(pc.rep); pc.rep.geometry.dispose(); pc.rep = null; }
  const b = Buf(), lk = barLook(rec), A = rec.pts[pc.k0 - 1], C = rec.pts[pc.k0], at = t => [A[0] + (C[0] - A[0]) * t, A[1] + (C[1] - A[1]) * t];
  keep.forEach(([t0, t1], i) => {
    const a = at(t0), c = at(t1), B = { hd: b, posts: [] }; barDraw(B, rec, lk, a, c, (pc.acc0 || 0) + t0 * L, (t0 > 0 || ((pc.cap | pc.ext) & 1) ? 1 : 0) | (t1 < 1 || ((pc.cap | pc.ext) & 2) ? 2 : 0));
    let q = pc.subs[i]; if (!q) { q = { two: true, nx: s.nx, nz: s.nz, y0: s.y0, y1: s.y1, off: true }; pc.subs.push(q); WALLS.add(s.ax, s.az, s.bx, s.bz, q); }
    q.ax = a[0]; q.az = a[1]; q.bx = c[0]; q.bz = c[1]; q.off = false;
  });
  for (let i = keep.length; i < pc.subs.length; i++) pc.subs[i].off = true;
  if (b.i.length && pc.T.group) pc.rep = mkMesh(b, MAT.hedge, 10, 'cast', pc.T.group);
}

// a few bits thrown off: one pool of small boxes for the whole map
const BAR_BIT = { im: null, n: 96, next: 0, live: [] };
function barBits(x, y, z, v, col, n) {
  if (!BAR_BIT.im) {
    BAR_BIT.im = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), BAR_BIT.n); BAR_BIT.im.frustumCulled = false;
    const z0 = new THREE.Matrix4().makeScale(0, 0, 0); for (let i = 0; i < BAR_BIT.n; i++) { BAR_BIT.im.setMatrixAt(i, z0); BAR_BIT.im.setColorAt(i, new THREE.Color(0xffffff)); } scene.add(BAR_BIT.im);
  }
  const c = new THREE.Color(col);
  for (let j = 0; j < n; j++) {
    const i = BAR_BIT.next; BAR_BIT.next = (i + 1) % BAR_BIT.n; BAR_BIT.im.setColorAt(i, c);
    const old = BAR_BIT.live.findIndex(b => b.i === i); if (old >= 0) BAR_BIT.live.splice(old, 1);
    BAR_BIT.live.push({ i, x: x + (Math.random() - 0.5) * 1.2, y: y + (Math.random() - 0.5) * 0.6, z: z + (Math.random() - 0.5) * 1.2, vx: v.vx * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 3, vy: 1.5 + Math.random() * 3, vz: v.vz * (0.3 + Math.random() * 0.5) + (Math.random() - 0.5) * 3, s: 0.08 + Math.random() * 0.14, r: Math.random() * 6, w: (Math.random() - 0.5) * 14, t: 0 });
  }
  BAR_BIT.im.instanceColor.needsUpdate = true;
}
function updBarriere(dt) {
  for (let i = BAR_FLY.length - 1; i >= 0; i--) {
    const f = BAR_FLY[i], o = f.o; f.t += dt;
    if (f.a < f.max) { f.w += 7 * Math.sin(Math.max(0.15, f.a)) * dt; const da = Math.min(f.max - f.a, f.w * dt); f.a += da; o.rotateOnWorldAxis(f.axis, da); }
    if (f.yaw) o.rotateOnWorldAxis(_barUp, f.yaw * dt);
    o.position.x += f.vx * dt; o.position.z += f.vz * dt; f.vy -= 9.8 * dt; o.position.y += f.vy * dt;
    const gy = H.ground(o.position.x, o.position.z);
    if (o.position.y <= gy) { o.position.y = gy; f.vy = 0; const k = Math.exp(-5 * dt); f.vx *= k; f.vz *= k; f.yaw *= k; }
    if ((f.a >= f.max - 1e-4 && o.position.y <= gy + 1e-3 && hyp(f.vx, f.vz) < 0.2) || f.t > 6) BAR_FLY.splice(i, 1);
  }
  if (!BAR_BIT.live.length) return;
  const im = BAR_BIT.im, m = _barM, q = _barQ, z0 = _barZ;
  for (let j = BAR_BIT.live.length - 1; j >= 0; j--) {
    const b = BAR_BIT.live[j]; b.t += dt; b.vy -= 9.8 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt; b.r += b.w * dt;
    const gy = H.ground(b.x, b.z) + b.s / 2; if (b.y < gy) { b.y = gy; b.vy *= -0.3; b.vx *= 0.5; b.vz *= 0.5; b.w *= 0.5; }
    if (b.t > 3) { im.setMatrixAt(b.i, z0); BAR_BIT.live.splice(j, 1); continue; }
    q.setFromEuler(_barE.set(b.r, b.r * 0.7, 0)); m.compose(_barP.set(b.x, b.y, b.z), q, _barS.set(b.s, b.s * 0.5, b.s)); im.setMatrixAt(b.i, m);
  }
  im.instanceMatrix.needsUpdate = true;
}
const _barUp = new THREE.Vector3(0, 1, 0), _barM = new THREE.Matrix4(), _barQ = new THREE.Quaternion(), _barZ = new THREE.Matrix4().makeScale(0, 0, 0), _barE = new THREE.Euler(), _barP = new THREE.Vector3(), _barS = new THREE.Vector3();
