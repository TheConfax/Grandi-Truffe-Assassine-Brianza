// ---------------------------------------------------------------- trains (Milano-Asso, Saronno-Seregno, Milano-Chiasso)
const TRAINS = D.trains.map((td, ti) => {
  const pts = dec(td.p); if (pts.length < 2) return null;
  const cum = [0]; for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + hyp(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const L = cum[cum.length - 1];
  const at = s => { s = clamp(s, 0, L); let lo = 1, hi = cum.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (cum[m] < s) lo = m + 1; else hi = m; } const i = lo, a = pts[i - 1], b = pts[i], f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[0] - a[0], b[1] - a[1])]; };
  const cars = [];
  const livery = ti % 2 ? ['#e9ece8', '#2b6fb3', '#1f2833'] : ['#eef0ec', '#2f8f55', '#1f2833'];
  for (let k = 0; k < 3; k++) {
    const g = new THREE.Group();
    const add = (w, h, l, col, y, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), lam(col)); m.position.set(0, y, z); m.castShadow = true; g.add(m); return m; };
    add(2.9, 3.3, 21.6, livery[0], 2.25); add(2.94, 0.85, 20.6, livery[2], 2.75); add(2.94, 0.45, 21.7, livery[1], 1.1); add(2.94, 0.18, 21.7, '#2a62b0', 1.45); add(2.6, 0.3, 21, '#9ea4aa', 4.0);
    if (k !== 1) add(2.9, 2.2, 0.8, livery[1], 1.9, (k === 0 ? 1 : -1) * 11);
    scene.add(g); cars.push(g);
  }
  const stops = td.st.filter(s => s > 40 && s < L - 40).sort((a, b) => a - b);
  return { pts, L, at, s: 30 + ti * 200, dir: 1, v: 0, wait: 4 + ti * 9, stops, done: new Set(), cars, circ: [], name: td.stn.join(', ') };
}).filter(Boolean);
const TR = TRAINS[0] || null;
for (const g of LX) { // which train runs over each crossing
  let best = null;
  TRAINS.forEach((T, ti) => { let bd = 1e9, bs = 0; for (let s = 0; s < T.L; s += 2) { const [x, z] = T.at(s), d = hyp(x - g.x, z - g.z); if (d < bd) { bd = d; bs = s; } } if (bd < 8 && (!best || bd < best[0])) best = [bd, ti, bs]; });
  if (best) { g.train = best[1]; g.sT = best[2]; }
}
let bellT = 0;
function updCrossings(dt) {
  let ring = 1e9;
  for (const g of LX) {
    if (!g.bars) continue;
    let close = false;
    const T = g.train !== undefined ? TRAINS[g.train] : null;
    if (T) { const ahead = (g.sT - T.s) * T.dir, endWait = T.wait > 0 && T.atEnd; close = !endWait && ahead > -84 && ahead < 170; }
    g.closed = close; g.ang = clamp(g.ang + (close ? -0.55 : 0.4) * dt, 0, 1);
    for (const b of g.bars) { if (b.broken || b.armGone) continue; b.arm.rotation.z = g.ang * 1.42; b.seg.on = g.ang < 0.3; }
    const fl = (now * 2.4 | 0) % 2; g.lampA.emissiveIntensity = close ? (fl ? 2.2 : 0.05) : 0; g.lampB.emissiveIntensity = close ? (fl ? 0.05 : 2.2) : 0;
    if (close) ring = Math.min(ring, hyp(g.x - P.x, g.z - P.z));
  }
  bellT -= dt; if (ring < 110 && bellT <= 0) { bellT = 0.42; sfxBell(1 - ring / 110); }
}
function updTrain(dt) {
  const circ = [];
  for (const T of TRAINS) {
    if (T.wait > 0) { T.wait -= dt; T.v = 0; }
    else {
      T.atEnd = false;
      const next = T.stops.filter(s => !T.done.has(s) && (s - T.s) * T.dir > -0.5).sort((a, b) => (a - T.s) * T.dir - (b - T.s) * T.dir)[0];
      const toStop = next !== undefined ? (next - T.s) * T.dir : 1e9, toEnd = T.dir > 0 ? T.L - 30 - T.s : T.s - 30;
      let target = 22;
      if (toStop < 220) target = Math.max(1.2, Math.sqrt(2 * 0.9 * Math.max(0, toStop)));
      if (toEnd < 220) target = Math.min(target, Math.max(1.2, Math.sqrt(2 * 0.9 * Math.max(0, toEnd))));
      T.v = T.v < target ? Math.min(target, T.v + 0.8 * dt) : Math.max(target, T.v - 1.6 * dt);
      T.s += T.v * T.dir * dt;
      if (next !== undefined && toStop <= 0.6) { T.done.add(next); T.wait = 14; T.v = 0; }
      if (toEnd <= 0.6) { T.dir *= -1; T.done.clear(); T.wait = 25; T.atEnd = true; T.v = 0; }
    }
    T.circ = [];
    T.cars.forEach((g, k) => {
      const s = T.s - T.dir * (k * 22.4 + 11); const [x, z, h] = T.at(s); g.position.set(x, groundH(x, z) + 0.15, z); g.rotation.y = h;
      const fx = Math.sin(h), fz = Math.cos(h); for (const o of [-8.4, -2.8, 2.8, 8.4]) T.circ.push([x + fx * o, z + fz * o, fx * T.v * T.dir, fz * T.v * T.dir]);
    });
    for (const c of T.circ) circ.push(c);
  }
  TRAIN_CIRC = circ;
}
let TRAIN_CIRC = [];
