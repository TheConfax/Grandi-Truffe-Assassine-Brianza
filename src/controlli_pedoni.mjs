// The walkers' test (Carlo, 6/11): where the pedestrians of the game stand and walk, in all the DBGT zone (the yellow ring), measured in the game itself (headless, ?tutto).
//   node src/controlli_pedoni.mjs [http://127.0.0.1:8052/] [report_pedoni.json]     PLAYWRIGHT=<path of playwright/index.mjs>; CHROME=<path of chrome.exe>
// "Before": every walking line of the old graph (the sidewalk offset of each edge, both sides, a sample every 2.5 m). "After": every line pedLine lets through, and 6000 walkers
// started by pedPick and made to walk 60 hops by pedNext (the crossings between lines included), plus 1500 in the squares, paths and parks.
// Out of zone: on the carriageway of a road that is not a small street (c0-c2, wider than 6.5 m) for more than 7.5 m in a row (a shorter run is a crossing of a side street, and the
// crossings between lines are checked apart: asphalt more than 7.5 m only at a zebra), in a building or against a wall, in a trench, a ramp or a road underpass.
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const url = process.argv[2] || 'http://127.0.0.1:8052/', out = process.env.OUT || process.argv[3] || 'report_pedoni.json';
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT)).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url + '?tutto');
await page.waitForFunction(() => { const b = document.getElementById('go'); return b && !b.disabled; }, null, { timeout: 600000 });
await page.evaluate(() => document.getElementById('go').click()); await page.waitForFunction(() => window.__G && __G.P, null, { timeout: 600000 });
const r = await page.evaluate(async () => {
  const G = __G, H = G.H, D = G.D, F = __POSTF, N = G.N, hyp = Math.hypot, STEP = 2.5;
  const conf = await (await fetch('confine_dbgt.json')).json(), rings = conf.gialla || [];
  const inRing = (x, z) => rings.some(o => { let c = false; for (let i = 0, j = o.length - 1; i < o.length; j = i++) { const a = o[i], b = o[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; });
  const small = r => r.c >= 3 || (r.c === 2 && r.w <= 6.5);
  const cls = (x, z, r) => { // null if fine, 'asf' on the asphalt of a road that is not a small street
    if (!r.d) { const p = H.inPit(x, z, 0.3); if (p && !(p.src && p.src.pedonale)) return 'fossa'; const u = H.gallAt(x, z); if (u && !(u.p && u.p.src && u.p.src.pedonale)) return 'fossa'; }
    if (G.inBuilding(x, z, 0.15)) return 'edificio';
    if (r.c <= 3 && !small(r) && F.onAsph(x, z, r.d ? 'ap' : 'as')) return 'asf';
    return null;
  };
  /* a walker's run on the asphalt: the metres of the runs longer than 7.5 m are 'carreggiata' */
  const runner = (S, tag) => { let run = 0, last = null; return { push(c, st, x, z, tg) { if (c === 'asf') { run += st; last = [x, z, tg]; if (run > 7.5 && run - st <= 7.5) S.m.carreggiata = (S.m.carreggiata || 0) + 1, add(S, 'carreggiata', x, z, tg); } else run = 0; if (c && c !== 'asf') { S.m[c] = (S.m[c] || 0) + 1; add(S, c, x, z, tg); } } }; };
  const mk = () => ({ n: 0, m: {}, ex: {} });
  const add = (S, k, x, z, tag) => { const e = S.ex[k] || (S.ex[k] = []); if (e.length < 12 && !e.some(q => hyp(q[0] - x, q[1] - z) < 80)) e.push([Math.round(x), Math.round(z), tag]); };
  // ---- before: all the old lines; after: the lines pedLine gives (a sample every metre)
  const pre = mk(), post = mk(); let edgesPre = 0, edgesPost = 0, edgesLost = 0;
  const lineCheck = (S, a, b, o, r) => { const [q0, q1] = G.edgePts(a, b, o), L = hyp(q1[0] - q0[0], q1[1] - q0[1]), n = Math.max(1, Math.ceil(L)), st = L / n, rn = runner(S); let bad = false;
    for (let i = 0; i <= n; i++) { const x = q0[0] + (q1[0] - q0[0]) * i / n, z = q0[1] + (q1[1] - q0[1]) * i / n, c = cls(x, z, r); S.n++; if (c) bad = true; rn.push(c, st, x, z, r.n || ''); } return bad; };
  for (let ri = 0; ri < D.roads.length; ri++) {
    const r = D.roads[ri]; if (r.t || r.x || r.c > 6) continue;
    for (let k = 1; k < r.g.length; k++) {
      const a = r.g[k - 1], b = r.g[k]; if (!inRing((N[a][0] + N[b][0]) / 2, (N[a][1] + N[b][1]) / 2)) continue;
      const e = G.WALK[a].find(q => q.to === b && q.r === r); if (!e) continue;
      for (const side of [1, -1]) {
        edgesPre++; const before = lineCheck(pre, a, b, e.off * side, r);
        const pl = G.pedLine(a, e, side);
        if (pl === undefined) { post.unloaded = (post.unloaded || 0) + 1; continue; }
        if (pl === null) { if (!before) edgesLost++; continue; }
        edgesPost++; lineCheck(post, a, b, pl.o, r);
      }
    }
  }
  // ---- after: walkers started and walking
  const sim = mk(), simZ = mk(); let walkers = 0, killed = 0, hops = 0, crossBad = 0, crossOk = 0, zonaM = 0, edgeM = 0, unplaced = 0, zonaW = 0;
  const bumpZ = (rn, x, z) => { sim.n++; rn.push(F.onAsph(x, z) ? 'asf' : G.inBuilding(x, z, 0.4) ? 'edificio' : (H.inPit(x, z, 0.3) || H.gallAt(x, z)) ? 'fossa' : null, 1.5, x, z, 'zona'); };
  const nodes = G.WALK_NODES.filter(i => inRing(N[i][0], N[i][1]));
  const roadOfEdge = p => { const e = G.WALK[p.prev].find(q => q.to === p.cur); return e && e.r; };
  const pickIn = () => { for (let t = 0; t < 60; t++) { const q = G.pedPick(false); if (q && q.e && inRing(q.x, q.z)) return q; } return null; };
  for (let w = 0; w < 6000; w++) {
    const pk = pickIn(); if (!pk) { unplaced++; continue; }
    walkers++;
    const p = { x: pk.x, z: pk.z, side: pk.s, prev: pk.a, cur: pk.e.to, q: [pk.p1], free: false }, rn = runner(sim);
    rn.push(cls(p.x, p.z, pk.e.r), 1.5, p.x, p.z, pk.e.r.n || '');
    let lx = p.x, lz = p.z, rq = [{ r: pk.e.r }];
    for (let h = 0; h < 60; h++) {
      if (p.q.length < 2) { G.pedNext(p); if (p.kill) { killed++; break; } const rr = roadOfEdge(p) || rq[rq.length - 1].r; rq.push({ r: rr, conn: true }, { r: rr }); }
      const { r, conn } = rq.shift(), t0 = p.q.shift(), L = hyp(t0[0] - lx, t0[1] - lz), n = Math.max(1, Math.ceil(L / 1.5));
      for (let i = 1; i <= n; i++) { const x = lx + (t0[0] - lx) * i / n, z = lz + (t0[1] - lz) * i / n; sim.n++; const c = cls(x, z, r); rn.push(conn && c === 'asf' ? null : c, L / n, x, z, (r.n || '') + ' c' + r.c + ' w' + r.w + (conn ? ' conn' : '')); }
      lx = t0[0]; lz = t0[1]; hops++; edgeM += L;
    }
  }
  // crossings: every connector between two lines, over the asphalt more than a small street is wide
  for (let w = 0; w < 3000; w++) {
    const pk = pickIn(); if (!pk) continue;
    const p = { x: pk.x, z: pk.z, side: pk.s, prev: pk.a, cur: pk.e.to, q: [pk.p1], free: false };
    let lx = pk.p1[0], lz = pk.p1[1];
    for (let h = 0; h < 30; h++) {
      G.pedNext(p); if (p.kill) break; const p0 = p.q[1], p1 = p.q[2]; if (!p0 || !p1) break;
      const L = hyp(p0[0] - lx, p0[1] - lz), n = Math.ceil(L) || 1; let as = 0; for (let i = 0; i <= n; i++) if (F.onAsph(lx + (p0[0] - lx) * i / n, lz + (p0[1] - lz) * i / n)) as += L / n;
      if (as > 7.5) { if (G.zebraNear((lx + p0[0]) / 2, (lz + p0[1]) / 2, 5)) crossOk++; else { crossBad++; add(sim, 'attraversamento fuori strisce', lx, lz, ''); } }
      lx = p1[0]; lz = p1[1]; p.q.length = 0; p.x = lx; p.z = lz;
    }
  }
  // squares, paths, parks
  for (let w = 0; w < 1500; w++) {
    const c = nodes[Math.floor(Math.random() * nodes.length)], pk = G.pedPickZona(N[c][0], N[c][1], 0, 140, false); if (!pk) continue;
    zonaW++; const p = { x: pk.x, z: pk.z, zona: pk.zona, q: [] }, rn = runner(simZ); bumpZ(rn, p.x, p.z);
    for (let h = 0; h < 40; h++) { G.pedNext(p); const t = p.q.shift(); p.q.shift(); const L = hyp(t[0] - p.x, t[1] - p.z), n = Math.max(1, Math.ceil(L / 1.5)); for (let i = 1; i <= n; i++) bumpZ(rn, p.x + (t[0] - p.x) * i / n, p.z + (t[1] - p.z) * i / n); zonaM += L; p.x = t[0]; p.z = t[1]; }
  }
  let nz = 0; for (const T of G.TILES) if (T.l0) nz += G.pedZones(T).length;
  return { pre, post, sim, simZ, edgesPre, edgesPost, edgesLost, walkers, killed, hops, crossOk, crossBad, zonaW, zonaM: Math.round(zonaM), edgeM: Math.round(edgeM), unplaced, zone: nz };
});
fs.writeFileSync(out, JSON.stringify(r, null, 1));
const pc = (S, k) => (S.m[k] || 0);
console.log('LINEE PRIMA (%d campioni da 1 m, tratti di carreggiata oltre 7.5 m / fosse / edifici): %d / %d / %d', r.pre.n, pc(r.pre, 'carreggiata'), pc(r.pre, 'fossa'), pc(r.pre, 'edificio'));
console.log('LINEE DOPO  (%d campioni): %d / %d / %d; lati con linea %d -> %d (persi, erano gia buoni: %d)', r.post.n, pc(r.post, 'carreggiata'), pc(r.post, 'fossa'), pc(r.post, 'edificio'), r.edgesPre, r.edgesPost, r.edgesLost);
console.log('PEDONI SIMULATI %d (senza strada %d, fermati %d), tappe %d; fuori zona: carreggiata %d, fossa %d, edificio %d; attraversamenti con strisce %d, fuori strisce %d', r.walkers, r.unplaced, r.killed, r.hops, pc(r.sim, 'carreggiata'), pc(r.sim, 'fossa'), pc(r.sim, 'edificio'), r.crossOk, r.crossBad);
console.log('IN ZONA PEDONALE: %d pedoni, %d m su %d zone; fuori: carreggiata %d, fossa %d, edificio %d', r.zonaW, r.zonaM, r.zone, pc(r.simZ, 'carreggiata'), pc(r.simZ, 'fossa'), pc(r.simZ, 'edificio'));
console.log(errs.join(' | ') || 'nessun errore');
await browser.close();
