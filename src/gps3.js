// ---------------------------------------------------------------- GPS (Carlo, 3/11): route from the player to the waypoint (WAYPT) on the road graph D.roads / N, A* with a cost per metre by class.
// Cars follow the one-ways (r.o: the road runs along r.g); on foot one-ways do not count and footways / paths (c 6, 5) can be used, motorways (r.x) cannot.
const GPS_COST_AUTO = { x: 0.5, main: 0.7, local: 1, service: 2.5 }; /* motorway/trunk and ramps; primary, secondary, tertiary; residential, unclassified, living street; service, driveways, car parks */
const GPS_COST_PIEDI = { via: 1, sentiero: 0.8 };
const GPS_FUORI = 25, GPS_TEMPO = 1.5; /* m from the route, and s there before a new route is worked out */
const GPS = { route: null, fuori: 0, ms: 0, lastKey: '', graph: null };
function gpsCostoAuto(r) { /* null: cars cannot use it */
  if (r.c >= 5) return null; if (r.x) return GPS_COST_AUTO.x; if (r.c <= 1) return GPS_COST_AUTO.main; if (r.c <= 3) return GPS_COST_AUTO.local; return GPS_COST_AUTO.service;
}
function gpsCostoPiedi(r) { if (r.x) return null; return r.c >= 5 ? GPS_COST_PIEDI.sentiero : GPS_COST_PIEDI.via; }
function gpsGraph() {
  if (GPS.graph) return GPS.graph;
  const nn = N.length, CELL = 40, segs = [], G = { nn, segs, grid: new Map(), cell: CELL, adj: [null, null] };
  for (let ri = 0; ri < D.roads.length; ri++) {
    const r = D.roads[ri];
    for (let k = 1; k < r.g.length; k++) {
      const a = r.g[k - 1], b = r.g[k]; if (a === b) continue;
      const L = Math.hypot(N[b][0] - N[a][0], N[b][1] - N[a][1]), si = segs.length;
      segs.push({ a, b, L, o: !!r.o, ca: gpsCostoAuto(r), cp: gpsCostoPiedi(r) });
      const x0 = Math.floor(Math.min(N[a][0], N[b][0]) / CELL), x1 = Math.floor(Math.max(N[a][0], N[b][0]) / CELL), z0 = Math.floor(Math.min(N[a][1], N[b][1]) / CELL), z1 = Math.floor(Math.max(N[a][1], N[b][1]) / CELL);
      for (let cx = x0; cx <= x1; cx++) for (let cz = z0; cz <= z1; cz++) { const key = cx * 100003 + cz; let l = G.grid.get(key); if (!l) G.grid.set(key, l = []); l.push(si); }
    }
  }
  for (const foot of [0, 1]) { /* adjacency: for each node the outgoing triples [to, cost, seg] */
    const adj = new Array(nn);
    for (let si = 0; si < segs.length; si++) {
      const s = segs[si], c = foot ? s.cp : s.ca; if (c === null) continue;
      (adj[s.a] || (adj[s.a] = [])).push(s.b, s.L * c, si);
      if (foot || !s.o) (adj[s.b] || (adj[s.b] = [])).push(s.a, s.L * c, si);
    }
    G.adj[foot] = adj;
  }
  return GPS.graph = G;
}
/* the closest point of an allowed road to (x, z): { si, x, z, t, d } with t = 0..1 along the stretch a->b */
function gpsSnap(G, x, z, foot) {
  let best = null;
  for (const R of [1, 4, 16]) {
    const cx = Math.floor(x / G.cell), cz = Math.floor(z / G.cell);
    for (let i = cx - R; i <= cx + R; i++) for (let j = cz - R; j <= cz + R; j++) {
      const l = G.grid.get(i * 100003 + j); if (!l) continue;
      for (const si of l) {
        const s = G.segs[si]; if ((foot ? s.cp : s.ca) === null) continue;
        const A = N[s.a], B = N[s.b], ex = B[0] - A[0], ez = B[1] - A[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - A[0]) * ex + (z - A[1]) * ez) / L2)), qx = A[0] + ex * t, qz = A[1] + ez * t, d = Math.hypot(x - qx, z - qz);
        if (!best || d < best.d) best = { si, x: qx, z: qz, t, d };
      }
    }
    if (best && best.d < R * G.cell) break;
  }
  return best;
}
/* A* from the snap point s to the snap point e; returns the polyline [[x, z], ...] or null */
function gpsAStar(G, s, e, foot) {
  const adj = G.adj[foot], nn = G.nn, S = G.segs, minC = foot ? 0.8 : 0.5;
  const ss = S[s.si], es = S[e.si], cs = foot ? ss.cp : ss.ca, ce = foot ? es.cp : es.ca;
  if (s.si === e.si && (foot || !ss.o || e.t >= s.t)) return [[s.x, s.z], [e.x, e.z]]; /* both on the same stretch */
  const g = new Float64Array(nn).fill(Infinity), from = new Int32Array(nn).fill(-1), done = new Uint8Array(nn), heap = [];
  const push = (n, f) => { let i = heap.length; heap.push([f, n]); while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
  const h = n => Math.hypot(N[n][0] - e.x, N[n][1] - e.z) * minC;
  const seed = (n, c) => { if (c < g[n]) { g[n] = c; from[n] = -2; push(n, c + h(n)); } };
  /* start: along the stretch to its end b, and back to a (only where it is not one-way) */
  seed(ss.b, ss.L * (1 - s.t) * cs); if (foot || !ss.o) seed(ss.a, ss.L * s.t * cs);
  /* end: entering the stretch from a (towards b), and from b (only where it is not one-way) */
  const tail = new Map(); tail.set(es.a, es.L * e.t * ce); if (foot || !es.o) tail.set(es.b, es.L * (1 - e.t) * ce);
  let bestTotal = Infinity, bestN = -1;
  while (heap.length) {
    const [f, n] = pop(); if (done[n]) continue; done[n] = 1;
    if (f >= bestTotal) break;
    if (tail.has(n)) { const tot = g[n] + tail.get(n); if (tot < bestTotal) { bestTotal = tot; bestN = n; } }
    const a = adj[n]; if (!a) continue;
    for (let i = 0; i < a.length; i += 3) { const m = a[i], c = g[n] + a[i + 1]; if (c < g[m]) { g[m] = c; from[m] = n; push(m, c + h(m)); } }
  }
  if (bestN < 0) return null;
  const nodes = []; for (let n = bestN; n >= 0; n = from[n]) nodes.push(n); nodes.reverse();
  const pts = [[s.x, s.z]]; for (const n of nodes) pts.push([N[n][0], N[n][1]]); pts.push([e.x, e.z]);
  return pts;
}
function gpsCalc(px, pz, foot) {
  const t0 = performance.now(), G = gpsGraph(), s = gpsSnap(G, px, pz, foot), e = gpsSnap(G, WAYPT.x, WAYPT.z, foot);
  let route = null;
  if (s && e) { const m = gpsAStar(G, s, e, foot); if (m) route = { main: m, d0: [[px, pz], [s.x, s.z]], d1: [[e.x, e.z], [WAYPT.x, WAYPT.z]] }; }
  GPS.ms = performance.now() - t0; return route;
}
function gpsDist(route, px, pz) { /* the distance from the player to the route (dashed bits included) */
  let best = 1e9;
  for (const pl of [route.d0, route.main, route.d1]) for (let i = 1; i < pl.length; i++) {
    const A = pl[i - 1], B = pl[i], ex = B[0] - A[0], ez = B[1] - A[1], L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((px - A[0]) * ex + (pz - A[1]) * ez) / L2));
    const d = Math.hypot(px - (A[0] + ex * t), pz - (A[1] + ez * t)); if (d < best) best = d;
  }
  return best;
}
function gpsTick(dt) {
  if (!WAYPT) { if (GPS.route || GPS.lastKey) { GPS.route = null; GPS.lastKey = ''; if (bigOpen) drawBig(); } return; }
  const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z, foot = GPS.modo !== undefined ? GPS.modo : P.mode !== 'car' ? 1 : 0, key = WAYPT.x.toFixed(1) + ',' + WAYPT.z.toFixed(1) + ',' + foot;
  if (key !== GPS.lastKey) GPS.fuori = 99;
  else if (GPS.route) GPS.fuori = gpsDist(GPS.route, px, pz) > GPS_FUORI ? GPS.fuori + dt : 0;
  if (GPS.fuori >= GPS_TEMPO) { GPS.lastKey = key; GPS.fuori = 0; GPS.route = gpsCalc(px, pz, foot); if (bigOpen) drawBig(); }
}
/* g is in world coordinates; w is the line width in world units */
function gpsDraw(g, w) {
  const R = GPS.route; if (!R || !WAYPT) return;
  g.save(); g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#FF00FF'; g.lineWidth = w;
  g.beginPath(); R.main.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke();
  g.setLineDash([w * 1.6, w * 1.4]); g.lineCap = 'butt';
  for (const pl of [R.d0, R.d1]) { g.beginPath(); g.moveTo(pl[0][0], pl[0][1]); g.lineTo(pl[1][0], pl[1][1]); g.stroke(); }
  g.restore();
}
setTimeout(() => { try { gpsGraph(); } catch (e) { } }, 5000); /* the graph is built once, a few seconds after the start, not at the first waypoint */
