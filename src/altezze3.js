// ---------------------------------------------------------------- heights (docs/motore.md 3): one surface S, drawn and asked with the same numbers
// H.* is the only reader of the terrain grid, of the tiles terreno/<tx>_<tz>.bin.gz, of the decks and (phase 5) of step. Where a tile has its
// .bin (Meda, phase 4) the ground is S itself: the terrain mesh of the tile is built from H.onTri with the grid nodes as they are, the same two
// triangles per cell (diagonal u >= v), so H.base is the drawn ground to the float32 rounding (H.check). Elsewhere, and in a tile of Meda
// until its .bin has arrived, the old engine answers: the 10 m grid with the trenches of D.cut and the river cut (they go in phase 6)
const TER = D.terrain;
const TH = (() => { const bin = atob(TER.h16), n = bin.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 10; return f; })();
// the bank the covered stair between the Diaz and the Anna Frank climbs: the 10 m model smooths it into a gentle slope, so the field at its
// foot is dug a few metres lower, fading out within twenty metres and never across the road to the south (old engine only: S has the bank)
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
// trenches (trincee), old engine: where the DBGT has a road below the terrain model, the ground is dug down to it. Each piece of road is a
// segment [ax, az, bx, bz, depth at a, depth at b, half width] in decimetres: full depth across the carriageway, then a grassy bank at
// 1 : CUT_S up to the field. The same formula is in build_data.py (ground_cut): keep them equal
const CUTG = new Grid(24), CUT_S = 1.2, CUTS = (D.cut || []).map(c => c.map(v => v / 10)), CUTB = [1e9, 1e9, -1e9, -1e9];
for (const [ax, az, bx, bz, da, db, hw] of CUTS) {
  const m = hw + Math.max(da, db) * CUT_S, s = { ax, az, bx, bz, da, db, hw, m };
  CUTG.add(Math.min(ax, bx) - m, Math.min(az, bz) - m, Math.max(ax, bx) + m, Math.max(az, bz) + m, s);
  CUTB[0] = Math.min(CUTB[0], ax - m, bx - m); CUTB[1] = Math.min(CUTB[1], az - m, bz - m); CUTB[2] = Math.max(CUTB[2], ax + m, bx + m); CUTB[3] = Math.max(CUTB[3], az + m, bz + m);
}
function trenchCut(x, z) {
  if (x < CUTB[0] || z < CUTB[1] || x > CUTB[2] || z > CUTB[3]) return 0;
  let c = 0;
  CUTG.each(x, z, x, z, s => {
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - s.ax) * ex + (z - s.az) * ez) / L2, 0, 1), d = hyp(x - s.ax - ex * t, z - s.az - ez * t);
    const D = s.da + (s.db - s.da) * t; c = Math.max(c, Math.min(D, D - (d - s.hw) / CUT_S));
  });
  return c;
}
// the deepest trench within r of (x, z): how far down the coarse depth mask has to go there
function trenchNear(x, z, r) { let c = 0; CUTG.each(x - r, z - r, x + r, z + r, s => { if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < r + s.m) c = Math.max(c, s.da, s.db); }); return c; }
// does the edge a-b come within reach of a trench? (draped surfaces split such edges down to 4 m, or they bridge the hollow)
function cutTouches(ax, az, bx, bz) {
  if (!CUTS.length || Math.max(ax, bx) < CUTB[0] || Math.max(az, bz) < CUTB[1] || Math.min(ax, bx) > CUTB[2] || Math.min(az, bz) > CUTB[3]) return false;
  let f = false;
  CUTG.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), s => { if (!f && segSegDist(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz) < s.m) f = true; });
  return f;
}
function segSegDist(ax, az, bx, bz, cx, cz, dx, dz) {
  const o = (px, pz, qx, qz, rx, rz) => Math.sign((qx - px) * (rz - pz) - (qz - pz) * (rx - px));
  if (o(ax, az, bx, bz, cx, cz) * o(ax, az, bx, bz, dx, dz) < 0 && o(cx, cz, dx, dz, ax, az) * o(cx, cz, dx, dz, bx, bz) < 0) return 0;
  return Math.min(segDist(ax, az, cx, cz, dx, dz), segDist(bx, bz, cx, cz, dx, dz), segDist(cx, cz, ax, az, bx, bz), segDist(dx, dz, ax, az, bx, bz));
}
function farH(x, z) { // the old ground: the coarse grid, same two triangles per cell, minus the trenches
  const fx = clamp((x - TER.x0) / TER.step, 0, TER.nx - 1.001), fz = clamp((z - TER.z0) / TER.step, 0, TER.nz - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * TER.nx + i;
  const h00 = TH[k], h10 = TH[k + 1], h01 = TH[k + TER.nx], h11 = TH[k + TER.nx + 1];
  return (u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01)) - (CUTS.length ? trenchCut(x, z) : 0);
}
const RIVG = new Grid(24), RIV_D = 2.4;
for (const td of D.tiles) for (const r of td.rv || []) { const pts = dec(r.p); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], m = r.w + 1; RIVG.add(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, { a, b, w: r.w, ca: k === 1 && !!(r.e && r.e[0]), cb: k === pts.length - 1 && !!(r.e && r.e[1]) }); } }
function riverCut(x, z) { // old engine: the river bed is dug RIV_D into the drawn ground (S has the bed in it)
  let c = 0;
  RIVG.each(x, z, x, z, s => {
    const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L2 = ex * ex + ez * ez || 1, t0 = ((x - s.a[0]) * ex + (z - s.a[1]) * ez) / L2;
    if ((t0 < 0 && s.ca) || (t0 > 1 && s.cb)) return; // square end at a culvert / bridge mouth
    const t = clamp(t0, 0, 1), d = hyp(x - s.a[0] - ex * t, z - s.a[1] - ez * t);
    if (d < s.w + 0.4) c = Math.max(c, d < s.w ? RIV_D : RIV_D * (s.w + 0.4 - d) / 0.4);
  });
  return c;
}
// the new engine's files: which tiles have a .bin, the decks, the pits and the water level (terreno/indice.json, src/terreno_gioco.py);
// without it the whole map runs on the old engine
const TERRENO = await (async () => { try { const r = await fetch('terreno/indice.json'); if (!r.ok) return null; const j = await r.json(); return j && j.ver === 1 ? j : null; } catch (e) { return null; } })();
const H = (() => {
  const TSZ = META.tile, HW = META.hw, HHt = META.hh, NX = META.ntx, NZ = META.ntz, B0 = TER.base, LOAD_R = 1150;
  const STEP = new Uint8Array(NX * NZ), FT = new Array(NX * NZ).fill(null), LS = new Uint8Array(NX * NZ); // LS: 0 not asked, 1 coming, 2 here, 3 failed
  if (TERRENO) for (const k in TERRENO.tiles) { const [tx, tz] = k.split('_').map(Number); if (tx >= 0 && tz >= 0 && tx < NX && tz < NZ) STEP[tx + NX * tz] = TERRENO.tiles[k]; }
  const tx0 = t => -HW + (t % NX) * TSZ, tz0 = t => -HHt + Math.floor(t / NX) * TSZ;
  const onLoad = [];
  async function load(t) {
    LS[t] = 1; const tx = t % NX, tz = Math.floor(t / NX);
    try {
      const r = await fetch(`terreno/${tx}_${tz}.bin.gz`); if (!r.ok) throw new Error('HTTP ' + r.status);
      let b = new Uint8Array(await r.arrayBuffer());
      if (b[0] === 0x1f && b[1] === 0x8b) b = new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
      const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
      if (b[0] !== 71 || b[1] !== 84 || b[2] !== 65 || b[3] !== 83 || b[4] !== 1) throw new Error('non è un GTAS 1');
      const st = b[5], n = dv.getUint16(6, true), base = dv.getFloat32(8, true), y = new Float32Array(n * n), x0 = tx0(t), z0 = tz0(t);
      if (Math.round(TSZ / st) + 1 !== n || b.length < 12 + 2 * n * n) throw new Error('misure sbagliate');
      for (let k = 0; k < n * n; k++) { const q = dv.getUint16(12 + 2 * k, true); y[k] = q === 65535 ? farH(x0 + (k % n) * st, z0 + Math.floor(k / n) * st) : (base * 100 + q) / 100 - B0; } // 65535: empty, the old ground
      const mo = 12 + 2 * n * n, m = b.length >= mo + (n - 1) * (n - 1) ? b.slice(mo, mo + (n - 1) * (n - 1)) : null;
      FT[t] = { t, st, n, x0, z0, y, m }; LS[t] = 2;
      for (const f of onLoad) f(t);
    } catch (e) { LS[t] = 3; console.warn('terreno ' + tx + '_' + tz + ': ' + e.message + ' (resta il motore vecchio)'); }
  }
  // the loaded tile under (x, z); a point on the edge of a tile without .bin takes the neighbour's, so the old tiles meet S without a crack
  function fineAt(x, z) {
    const fx = (x + HW) / TSZ, fz = (z + HHt) / TSZ, i = Math.floor(fx), j = Math.floor(fz);
    if (i >= 0 && j >= 0 && i < NX && j < NZ) { const F = FT[i + NX * j]; if (F) return F; }
    const e = 1e-3 / TSZ, di = fx - i < e ? -1 : i + 1 - fx < e ? 1 : 0, dj = fz - j < e ? -1 : j + 1 - fz < e ? 1 : 0;
    if (!di && !dj) return null;
    for (const [a, c] of [[di, 0], [0, dj], [di, dj]]) { if (!a && !c) continue; const I = i + a, J = j + c; if (I >= 0 && J >= 0 && I < NX && J < NZ && FT[I + NX * J]) return FT[I + NX * J]; }
    return null;
  }
  function onF(F, x, z) { // linear on the triangle of the cell, diagonal u >= v: the mesh's own triangles
    const n = F.n, u = clamp((x - F.x0) / F.st, 0, n - 1), v = clamp((z - F.z0) / F.st, 0, n - 1);
    let i = Math.floor(u), j = Math.floor(v); if (i > n - 2) i = n - 2; if (j > n - 2) j = n - 2;
    const fu = u - i, fv = v - j, k = j * n + i, Y = F.y, h00 = Y[k], h10 = Y[k + 1], h01 = Y[k + n], h11 = Y[k + n + 1];
    return fu >= fv ? h00 + fu * (h10 - h00) + fv * (h11 - h10) : h00 + fv * (h01 - h00) + fu * (h11 - h01);
  }
  // the old engine beside S (transitional, until phase 8 brings S everywhere): within FADE_R of a tile of S the old heights are pulled to S,
  // fully at the shared edge, smoothly back to the old engine at FADE_R. Without it the edge of Meda was a step up to 4.6 m in 2 m in the
  // ground, and 6.7 m on the Milano-Meda west of Meda, where the old engine has a viaduct that S does not have. Each tile of S within reach
  // gives the difference (target - old) at its nearest point; they are mixed with weights 1/d^2 (exact at the edge, continuous at the corners)
  const FADE_R = 80;
  function fade(x, z, yOld, target, old) { // target(F, px, pz), old(px, pz): the heights at the edge point
    const i = Math.floor((x + HW) / TSZ), j = Math.floor((z + HHt) / TSZ); let sw = 0, sc = 0, dmin = FADE_R;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const I = i + a, J = j + b; if (I < 0 || J < 0 || I >= NX || J >= NZ) continue; const F = FT[I + NX * J]; if (!F) continue;
      const px = clamp(x, F.x0, F.x0 + TSZ), pz = clamp(z, F.z0, F.z0 + TSZ), d = hyp(x - px, z - pz); if (d >= FADE_R) continue;
      const c = target(F, px, pz) - old(px, pz); if (d < 1e-6) return yOld + c;
      sw += 1 / (d * d); sc += c / (d * d); if (d < dmin) dmin = d;
    }
    if (!sw) return yOld;
    const t = 1 - dmin / FADE_R; return yOld + t * t * (3 - 2 * t) * sc / sw;
  }
  const oldG = (x, z) => fade(x, z, farH(x, z), onF, farH); // the old ground, meeting S
  function onDeck(F, x, z, y0) { // something of the old engine at height y0 over S: the deck of the new engine nearest y0 (within 3 m), else S
    const g = onF(F, x, z); let best = null;
    for (const o of deckAt(x, z)) if (o.tipo !== 'copertura' && Math.abs(o.top - y0) < 3 && (best === null || Math.abs(o.top - y0) < Math.abs(best - y0))) best = o.top;
    return best !== null && best > g ? best : g;
  }
  const step = (x, z) => 0; // phase 5: the kerbs, platforms and medians of tiles[t].st; until then H.surface adds them the old way
  // decks (docs/motore.md 1.5): triangles of the top in game heights, indexed on a 16 m grid
  const DECKS = [], DKG = new Grid(16);
  for (const d of TERRENO ? TERRENO.decks : []) {
    const tri = new Float64Array(d.tri.length); for (let i = 0; i < tri.length; i += 3) { tri[i] = d.tri[i]; tri[i + 1] = d.tri[i + 1]; tri[i + 2] = d.tri[i + 2] - B0; }
    const free = d.tipo !== 'copertura' && !(d.sotto && (d.sotto.strade || d.sotto.ferrovia)); // nothing passes under it but water or field
    const o = { id: d.id, tipo: d.tipo, fonte: d.fonte, sp: d.sp, luce: d.luce - B0, tri, imp: d.imp, nucleo: d.nucleo || null, spalle: d.spalle || [], ra: d.ra || [], free };
    DECKS.push(o);
    for (let i = 0; i < tri.length; i += 9) { const xs = [tri[i], tri[i + 3], tri[i + 6]], zs = [tri[i + 1], tri[i + 4], tri[i + 7]]; DKG.add(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs), { d: o, i }); }
  }
  function deckAt(x, z) { // [{id, top, bot, tipo}] of the decks over (x, z)
    const out = [];
    DKG.each(x, z, x, z, ({ d, i }) => {
      if (out.some(o => o.id === d.id)) return;
      const T = d.tri, ax = T[i], az = T[i + 1], bx = T[i + 3], bz = T[i + 4], cx = T[i + 6], cz = T[i + 7];
      const den = (bz - cz) * (ax - cx) + (cx - bx) * (az - cz); if (Math.abs(den) < 1e-12) return;
      const l1 = ((bz - cz) * (x - cx) + (cx - bx) * (z - cz)) / den, l2 = ((cz - az) * (x - cx) + (ax - cx) * (z - cz)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) return;
      const top = l1 * T[i + 2] + l2 * T[i + 5] + l3 * T[i + 8]; out.push({ id: d.id, top, bot: top - d.sp, tipo: d.tipo, d });
    });
    return out;
  }
  // water level (docs/motore.md 1.3): zw along the DBGT river axes, every 2 m; elsewhere the lowest S across an OSM river + 0.3
  const WG = new Grid(16), WMAX = 12;
  for (const a of TERRENO ? TERRENO.acqua : []) { const p = a.p, zw = a.zw; for (let k = 1; k < zw.length; k++) { const ax = p[2 * k - 2], az = p[2 * k - 1], bx = p[2 * k], bz = p[2 * k + 1]; WG.add(Math.min(ax, bx) - WMAX, Math.min(az, bz) - WMAX, Math.max(ax, bx) + WMAX, Math.max(az, bz) + WMAX, { ax, az, bx, bz, ya: zw[k - 1] - B0, yb: zw[k] - B0 }); } }
  function water(x, z) {
    let best = null, bd = WMAX;
    WG.each(x, z, x, z, s => { const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez || 1, t = clamp(((x - s.ax) * ex + (z - s.az) * ez) / L2, 0, 1), d = hyp(x - s.ax - ex * t, z - s.az - ez * t); if (d < bd) { bd = d; best = s.ya + (s.yb - s.ya) * t; } });
    if (best !== null) return best;
    let w = null;
    RIVG.each(x, z, x, z, s => {
      const ex = s.b[0] - s.a[0], ez = s.b[1] - s.a[1], L = hyp(ex, ez) || 1, t = clamp(((x - s.a[0]) * ex + (z - s.a[1]) * ez) / (L * L), 0, 1), px = s.a[0] + ex * t, pz = s.a[1] + ez * t;
      if (w !== null || hyp(x - px, z - pz) > s.w) return;
      const F = fineAt(px, pz); if (!F) { w = oldG(px, pz) - RIV_D + 0.5; return; }
      let lo = 1e9; for (let q = -1; q <= 1.001; q += 0.25) { const qx = px - ez / L * s.w * q, qz = pz + ex / L * s.w * q, Fq = fineAt(qx, qz); lo = Math.min(lo, Fq ? onF(Fq, qx, qz) : oldG(qx, qz)); }
      w = lo + 0.3;
    });
    return w;
  }
  const KIND = [null, 'road', 'side', 'green', 'river', 'slope', 'rail'];
  const H = {
    B0, DECKS, onLoad, farH, deckAt, water,
    fine: t => !!FT[t], tile: t => FT[t], has: t => STEP[t] > 0,
    fineAt: (x, z) => !!fineAt(x, z),
    base(x, z) { const F = fineAt(x, z); return F ? onF(F, x, z) : oldG(x, z); },
    ground(x, z) { const F = fineAt(x, z); return F ? onF(F, x, z) + step(x, z) : oldG(x, z); },
    vis(x, z) { const F = fineAt(x, z); return F ? onF(F, x, z) : oldG(x, z) - riverCut(x, z); }, // the old drawn ground cut the river into the grid
    // what the street surfaces drape on: S, or the top of a deck nothing but water or field passes under (the asphalt of a bridge over the
    // Seveso stays on the bridge). Transitional: phase 5 clips them on the grid and on the decks
    street(x, z) { const F = fineAt(x, z); if (!F) return oldG(x, z); const g = onF(F, x, z); for (const o of deckAt(x, z)) if (o.d.free && o.top > g) return o.top; return g; },
    surface(x, z, cy) {
      const F = fineAt(x, z); if (!F) return H.oldSurface(x, z, cy);
      let y = onF(F, x, z) + step(x, z) + (onSide(x, z) ? SIDE_H : onPlatform(x, z) ? PLAT_H : bumpAt(x, z));
      if (cy === undefined) return y;
      for (const o of deckAt(x, z)) if (o.top > y && o.top <= cy + 0.8) y = o.top;
      return y;
    },
    oldSurface: null, // world3.js: surfAt of the old engine (DECKG, the embankments, the river cut)
    node(i) { // a road node: on the deck it runs over (the one nearest its old height, within 3 m), else on S
      const [x, z] = N[i], F = fineAt(x, z), y0 = NHt[i];
      if (!F) return y0 === null ? oldG(x, z) : fade(x, z, y0, (G, px, pz) => onDeck(G, px, pz, y0), () => y0); // an old deck beside S comes down (or up) to it
      return y0 === null ? onF(F, x, z) : onDeck(F, x, z, y0);
    },
    kind(x, z) {
      if (onPlatform(x, z)) return 'plat'; if (onSide(x, z)) return 'side';
      const F = fineAt(x, z);
      if (F && F.m) { const n = F.n, i = clamp(Math.floor((x - F.x0) / F.st), 0, n - 2), j = clamp(Math.floor((z - F.z0) / F.st), 0, n - 2), k = KIND[F.m[j * (n - 1) + i]]; if (k) return k; }
      if (!F && riverCut(x, z) > 0) return 'river';
      return onAnyRoad(x, z, 0) ? 'road' : nearLowRail(x, z, 1.9) ? 'rail' : 'green';
    },
    range(ring) { // [min, max] of H.ground on the ring and on the grid nodes inside it
      let lo = 1e9, hi = -1e9; const add = y => { if (y < lo) lo = y; if (y > hi) hi = y; };
      for (const [x, z] of ring) add(H.ground(x, z));
      const [x0, z0, x1, z1] = bbox(ring), F = fineAt((x0 + x1) / 2, (z0 + z1) / 2), st = F ? F.st : TER.step, ox = F ? F.x0 : TER.x0, oz = F ? F.z0 : TER.z0;
      if ((x1 - x0) * (z1 - z0) / (st * st) < 40000) for (let x = ox + Math.ceil((x0 - ox) / st) * st; x <= x1; x += st) for (let z = oz + Math.ceil((z0 - oz) / st) * st; z <= z1; z += st) if (inPoly(x, z, ring)) add(H.ground(x, z));
      return [lo, hi];
    },
    onTri(t, cb) { // every triangle of the grid of tile t: cb(ax, ay, az, bx, by, bz, cx, cy, cz, a, b, c), a b c the node numbers; false without .bin
      const F = FT[t]; if (!F) return false;
      const n = F.n, st = F.st, Y = F.y;
      for (let j = 0; j < n - 1; j++) for (let i = 0; i < n - 1; i++) {
        const k = j * n + i, x = F.x0 + i * st, z = F.z0 + j * st, x1 = x + st, z1 = z + st;
        cb(x, Y[k], z, x1, Y[k + 1], z, x1, Y[k + n + 1], z1, k, k + 1, k + n + 1); // u >= v
        cb(x, Y[k], z, x1, Y[k + n + 1], z1, x, Y[k + n], z1, k, k + n + 1, k + n);
      }
      return true;
    },
    // loading (tileTick): the .bin within LOAD_R. They all come at the start (below) and are never given back: what the world builds once
    // at the start (guardrails, pillars and walls of the old roads, the old decks of surfAt) must see S wherever S is, not only near the
    // station (it left invisible pillars of the old viaduct by PONTE 20); Meda's 202 tiles are 16 MB in memory
    tick(px, pz) {
      for (let t = 0; t < NX * NZ; t++) if (STEP[t] && !LS[t] && hyp(tx0(t) + TSZ / 2 - px, tz0(t) + TSZ / 2 - pz) < LOAD_R) load(t);
    },
    ready(t) { for (const u of near(t)) if (STEP[u] && LS[u] !== 2 && LS[u] !== 3) { if (!LS[u]) load(u); return false; } return true; }, // a tile is built once its .bin and its neighbours' are here
    nearFine: t => near(t).some(u => FT[u]),
    async preload(x, z, R) { const w = []; for (let t = 0; t < NX * NZ; t++) if (STEP[t] && !LS[t] && hyp(tx0(t) + TSZ / 2 - x, tz0(t) + TSZ / 2 - z) < R) w.push(load(t)); await Promise.all(w); },
    stato: () => ({ con_bin: STEP.reduce((a, v) => a + (v > 0), 0), caricate: FT.filter(Boolean).length, fallite: LS.reduce((a, v) => a + (v === 3), 0), impalcati: DECKS.length }),
    // G1 (docs/motore.md 5): on every built tile with a .bin, the drawn mesh against H.base on 1000 random points (the mesh's own triangle,
    // read back from its index and float32 positions) and on 20 vertical rays; expected 0.000 m
    check() {
      const res = [], ray = new THREE.Raycaster(), dn = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(); let rnd2 = 12345;
      const R = () => { rnd2 = (rnd2 * 16807) % 2147483647; return rnd2 / 2147483647; };
      for (const T of TILES) {
        const F = FT[T.t], m = T.terrMesh; if (!F || !m || !T.ready) continue;
        const P = m.geometry.attributes.position.array, I = m.geometry.index.array, n = F.n; let mx = 0, mr = 0, nr = 0;
        for (let q = 0; q < 1000; q++) {
          const x = F.x0 + R() * TSZ, z = F.z0 + R() * TSZ, i = clamp(Math.floor((x - F.x0) / F.st), 0, n - 2), j = clamp(Math.floor((z - F.z0) / F.st), 0, n - 2), c = (j * (n - 1) + i) * 6;
          let y = null;
          for (const s of [c, c + 3]) {
            const a = I[s] * 3, b = I[s + 1] * 3, e = I[s + 2] * 3, den = (P[b + 2] - P[e + 2]) * (P[a] - P[e]) + (P[e] - P[b]) * (P[a + 2] - P[e + 2]);
            const l1 = ((P[b + 2] - P[e + 2]) * (x - P[e]) + (P[e] - P[b]) * (z - P[e + 2])) / den, l2 = ((P[e + 2] - P[a + 2]) * (x - P[e]) + (P[a] - P[e]) * (z - P[e + 2])) / den, l3 = 1 - l1 - l2;
            if (l1 >= -1e-5 && l2 >= -1e-5 && l3 >= -1e-5) { y = l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[e + 1]; break; }
          }
          if (y === null) { mx = Infinity; continue; }
          mx = Math.max(mx, Math.abs(y - H.base(x, z)));
        }
        m.updateMatrixWorld();
        for (let q = 0; q < 20; q++) { const x = F.x0 + R() * TSZ, z = F.z0 + R() * TSZ; ray.set(o.set(x, 1e4, z), dn); const h = ray.intersectObject(m, false)[0]; if (h) { mr = Math.max(mr, Math.abs(h.point.y - H.base(x, z))); nr++; } }
        res.push({ tile: (T.t % NX) + '_' + Math.floor(T.t / NX), passo: F.st, punti: 1000, scarto_max_m: +mx.toFixed(4), raggi: nr, scarto_raggi_m: +mr.toFixed(4) });
      }
      const max = res.reduce((a, r) => Math.max(a, r.scarto_max_m), 0), maxr = res.reduce((a, r) => Math.max(a, r.scarto_raggi_m), 0);
      console.table(res); console.log(`H.check (G1): ${res.length} tile, scarto massimo mesh - H.base ${max.toFixed(3)} m, sui raggi ${maxr.toFixed(3)} m`);
      return { tile: res.length, scarto_max_m: max, scarto_raggi_m: maxr, righe: res };
    },
  };
  function near(t) { const i = t % NX, j = Math.floor(t / NX), o = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const I = i + a, J = j + b; if (I >= 0 && J >= 0 && I < NX && J < NZ) o.push(I + NX * J); } return o; }
  return H;
})();
// every tile of S is here before the world is built (see H.tick)
if (TERRENO) await H.preload(0, 0, 1e9);
// the old height functions stay one phase as aliases of H.* (docs/motore.md 3.1), with a console.warn once per call site; the stack is read
// on the first calls and then one call in 1024, so the cost stays small
const ALIAS_SEEN = new Set(); let aliasN = 0;
function aliasWarn(name) {
  if (++aliasN > 4000 && (aliasN & 1023)) return;
  const st = ((new Error().stack || '').split('\n')[3] || '?').trim(), k = name + ' ' + st; if (ALIAS_SEEN.has(k)) return; ALIAS_SEEN.add(k);
  console.warn(name + ' è un alias di H.* (docs/motore.md 3.1): ' + st);
}
function groundH(x, z) { aliasWarn('groundH'); return H.ground(x, z); }
function visH(x, z) { aliasWarn('visH'); return H.vis(x, z); }
function surfAt(x, z, cy) { aliasWarn('surfAt'); return H.surface(x, z, cy); }
function nodeY(i) { aliasWarn('nodeY'); return H.node(i); }
const streetH = (x, z) => H.street(x, z);
