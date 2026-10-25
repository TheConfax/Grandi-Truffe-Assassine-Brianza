// ---------------------------------------------------------------- heights (docs/motore.md 3): one surface S, drawn and asked with the same numbers
// H.* is the only reader of the terrain grid, of the tiles terreno/<tx>_<tz>.bin.gz, of the decks and (phase 5) of step. Where a tile has its
// .bin (Meda, phase 4) the ground is S itself: the terrain mesh of the tile is built from H.onTri with the grid nodes as they are, the same two
// triangles per cell (diagonal u >= v), so H.base is the drawn ground to the float32 rounding (H.check). Elsewhere, and in a tile of Meda
// until its .bin has arrived, the old engine answers: the 10 m grid with the trenches of D.cut and the river cut (they go in phase 6)
const TER = D.terrain;
const TH = (() => { const bin = atob(TER.h16), n = bin.length >> 1, f = new Float32Array(n); for (let i = 0; i < n; i++) f[i] = (bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8)) / 10; return f; })();
// The DROP of the Diaz - Anna Frank stair (3.2 m dug into the coarse grid at the foot of the bank, made for TINITALY) and the trenches of D.cut
// (trenchCut, CUT_S) are gone (docs/motore.md 3.1, fase 6): S has the bank and the trenches, and all the trenches of D.cut lie in tiles of S.
// The old ground of the tiles without .bin is the coarse grid as it is
function farH(x, z) { // the old ground: the coarse grid, same two triangles per cell
  const fx = clamp((x - TER.x0) / TER.step, 0, TER.nx - 1.001), fz = clamp((z - TER.z0) / TER.step, 0, TER.nz - 1.001), i = fx | 0, j = fz | 0, u = fx - i, v = fz - j, k = j * TER.nx + i;
  const h00 = TH[k], h10 = TH[k + 1], h01 = TH[k + TER.nx], h11 = TH[k + TER.nx + 1];
  return u >= v ? h00 + u * (h10 - h00) + v * (h11 - h10) : h00 + v * (h01 - h00) + u * (h11 - h01);
}
const RIVG = new Grid(24), RIV_D = 2.4;
for (const td of D.tiles) for (const r of td.rv || []) { const pts = dec(r.p); for (let k = 1; k < pts.length; k++) { const a = pts[k - 1], b = pts[k], m = r.w + 1; RIVG.add(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, { a, b, w: r.w, ca: k === 1 && !!(r.e && r.e[0]), cb: k === pts.length - 1 && !!(r.e && r.e[1]) }); } }
function riverCut(x, z) { // old engine only (the tiles without .bin, outside Meda until phase 8): the river bed dug RIV_D into the drawn ground; S has the bed in it
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
const TERRENO = await TERR_IND.then(j => j && j.ver === 1 ? j : null); // started with brianza.json (assemble3.py)
const H = (() => {
  const TSZ = META.tile, HW = META.hw, HHt = META.hh, NX = META.ntx, NZ = META.ntz, B0 = TER.base, LOAD_R = 1150;
  const STEP = new Uint8Array(NX * NZ), FT = new Array(NX * NZ).fill(null), LS = new Uint8Array(NX * NZ); // LS: 0 not asked, 1 coming, 2 here, 3 failed
  if (TERRENO) for (const k in TERRENO.tiles) { const [tx, tz] = k.split('_').map(Number); if (tx >= 0 && tz >= 0 && tx < NX && tz < NZ) STEP[tx + NX * tz] = TERRENO.tiles[k]; }
  const tx0 = t => -HW + (t % NX) * TSZ, tz0 = t => -HHt + Math.floor(t / NX) * TSZ;
  const onLoad = [];
  async function load(t) {
    LS[t] = 1; const tx = t % NX, tz = Math.floor(t / NX);
    try {
      let b = null; const pk = await TERR_BIN, pm = pk && pk.get(tx + '_' + tz); // terreno/pacco.bin: already unpacked, in parallel
      if (pm) { const ab = await pm; if (ab) b = new Uint8Array(ab); }
      if (!b) { const r = await fetch(`terreno/${tx}_${tz}.bin.gz`); if (!r.ok) throw new Error('HTTP ' + r.status); b = new Uint8Array(await r.arrayBuffer()); } // one .bin.gz at a time, the old way
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
  // the old engine beside S (transitional, until phase 8 brings S everywhere): within FADE_R of a tile of S the old ground is pulled to S,
  // fully at the shared edge, smoothly back to the old engine at FADE_R. Each tile of S within reach gives the difference S - old ground at
  // its nearest point, mixed with weights 1/d^2 (exact at the edge, continuous at the corners). Without it the edge of Meda was a step of
  // up to 4.6 m in 2 m in the ground
  const FADE_R = 120, smooth = d => { const t = 1 - d / FADE_R; return t * t * (3 - 2 * t); };
  function oldG(x, z) {
    const y = farH(x, z), i = Math.floor((x + HW) / TSZ), j = Math.floor((z + HHt) / TSZ); let sw = 0, sc = 0, dmin = FADE_R;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const I = i + a, J = j + b; if (I < 0 || J < 0 || I >= NX || J >= NZ) continue; const F = FT[I + NX * J]; if (!F) continue;
      const px = clamp(x, F.x0, F.x0 + TSZ), pz = clamp(z, F.z0, F.z0 + TSZ), d = hyp(x - px, z - pz); if (d >= FADE_R) continue;
      const c = onF(F, px, pz) - farH(px, pz); if (d < 1e-6) return y + c;
      sw += 1 / (d * d); sc += c / (d * d); if (d < dmin) dmin = d;
    }
    return sw ? y + smooth(dmin) * sc / sw : y;
  }
  function dS(x, z) { // distance to the nearest loaded tile of S, FADE_R if none is nearer
    const i = Math.floor((x + HW) / TSZ), j = Math.floor((z + HHt) / TSZ); let dmin = FADE_R;
    for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) {
      const I = i + a, J = j + b; if (I < 0 || J < 0 || I >= NX || J >= NZ) continue; const F = FT[I + NX * J]; if (!F) continue;
      dmin = Math.min(dmin, hyp(x - clamp(x, F.x0, F.x0 + TSZ), z - clamp(z, F.z0, F.z0 + TSZ)));
    }
    return dmin;
  }
  const fadeW = (x, z) => { const d = dS(x, z); return d < FADE_R ? smooth(d) : 0; };
  // the old river cut (RIV_D into the old ground) fades out the same way: at the edge S has the bed in it
  const rivCut = (x, z) => { const c = riverCut(x, z); return c > 0 ? c * (1 - fadeW(x, z)) : 0; };
  // an old deck (a node with its own height) within FADE_R of S comes down, or up, to the height of S where its road crosses the edge (the
  // nearest crossing along the roads, within 2 FADE_R; else the ground), with the same weight as the ground, so the ramps of a junction
  // stay together. The old engine has viaducts that S does not have (the Milano-Meda west of Meda stood 6.7 m over S at the edge of
  // Meda). The decks of the new engine are all in Meda, farther in
  let NADJ = null; const NFADE = new Map();
  function oldDeck(i, y0) {
    const [x, z] = N[i], dmin = dS(x, z); if (dmin >= FADE_R) return y0;
    let f = NFADE.get(i);
    if (f === undefined) {
      if (!NADJ) { NADJ = new Map(); const add = (a, b) => { let l = NADJ.get(a); if (!l) NADJ.set(a, l = []); l.push(b); }; for (const r of D.roads) for (let k = 1; k < r.g.length; k++) { add(r.g[k - 1], r.g[k]); add(r.g[k], r.g[k - 1]); } }
      f = null; const dist = new Map([[i, 0]]), todo = [i];
      while (todo.length) { // shortest way along the roads to the first crossing into S, within FADE_R
        todo.sort((a, b) => dist.get(b) - dist.get(a)); const a = todo.pop(), da = dist.get(a); if (f && da >= f[1]) break;
        for (const b of NADJ.get(a) || []) {
          const [ax, az] = N[a], [bx, bz] = N[b], L = hyp(bx - ax, bz - az);
          if (fineAt(bx, bz)) { let lo = 0, hi = 1; for (let q = 0; q < 20; q++) { const m = (lo + hi) / 2; if (fineAt(ax + (bx - ax) * m, az + (bz - az) * m)) hi = m; else lo = m; } // where the segment enters S
            const d = da + L * hi; if (d < 2 * FADE_R && (!f || d < f[1])) f = [H.base(ax + (bx - ax) * hi, az + (bz - az) * hi), d]; continue; }
          const d = da + L; if (d < 2 * FADE_R && (!dist.has(b) || d < dist.get(b))) { dist.set(b, d); todo.push(b); }
        }
      }
      NFADE.set(i, f);
    }
    return y0 + smooth(dmin) * ((f ? f[0] : oldG(x, z)) - y0);
  }
  function onDeck(F, x, z, y0) { // something of the old engine at height y0 over S: the deck of the new engine nearest y0 (within 3 m), else S
    const g = onF(F, x, z); let best = null;
    for (const o of deckAt(x, z)) if (o.tipo !== 'copertura' && Math.abs(o.top - y0) < 3 && (best === null || Math.abs(o.top - y0) < Math.abs(best - y0))) best = o.top;
    return best !== null && best > g ? best : g;
  }
  // the step layer (docs/motore.md 1.4): polygons standing h over S (1 sidewalk, 2 platform, 3 median), indexed on a 10 m grid. Until the
  // build writes tiles[t].st (phases 7-8) world3.js fills it from the sidewalks, platforms and medians the tiles draw (H.addStep). It counts
  // only in the tiles of S: elsewhere the old engine adds onSide/onPlatform
  const STG = new Grid(10);
  function stepAt(x, z) { let r = null; STG.each(x, z, x, z, s => { if ((!r || s.h > r.h) && x >= s.bb[0] && x <= s.bb[2] && z >= s.bb[1] && z <= s.bb[3] && inPoly(x, z, s.o) && !s.k.some(q => inPoly(x, z, q))) r = s; }); return r; }
  const step = (x, z) => { const s = stepAt(x, z); return s ? s.h : 0; };
  // surfaces clipped on the grid (docs/motore.md 3, phase 5). A drawn surface in a tile of S is cut on the cells of its grid and on their
  // diagonal (u >= v, the mesh's own two triangles), so each piece is flat on one triangle of S and lies on it exactly; the terrain of a
  // tile of S writes its depth and the pieces win over it by polygonOffset, not by a few centimetres of height
  const half = (P, a, b, c) => { // Sutherland-Hodgman on the half-plane a x + b z + c >= 0 (keeps the winding)
    const o = [], n = P.length;
    for (let k = 0; k < n; k++) {
      const p = P[k], q = P[(k + 1) % n], dp = a * p[0] + b * p[1] + c, dq = a * q[0] + b * q[1] + c;
      if (dp >= 0) o.push(p);
      if ((dp >= 0) !== (dq >= 0)) { const t = dp / (dp - dq); o.push([p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]); }
    }
    return o;
  };
  const tidy = P => { const o = []; for (const p of P) { const q = o[o.length - 1]; if (!q || Math.abs(p[0] - q[0]) > 1e-7 || Math.abs(p[1] - q[1]) > 1e-7) o.push(p); } while (o.length > 1 && Math.abs(o[0][0] - o[o.length - 1][0]) < 1e-7 && Math.abs(o[0][1] - o[o.length - 1][1]) < 1e-7) o.pop(); let a = 0; for (let k = 0; k < o.length; k++) { const p = o[k], q = o[(k + 1) % o.length]; a += p[0] * q[1] - q[0] * p[1]; } return o.length >= 3 && Math.abs(a) > 2e-6 ? o : null; };
  const square = (P, x0, z0, x1, z1) => half(half(half(half(P, 1, 0, -x0), -1, 0, x1), 0, 1, -z0), 0, -1, z1);
  const clipSeg = (a, b, x0, z0, x1, z1) => { // Liang-Barsky: the part of the segment a-b inside the rectangle, or null
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dz = b[1] - a[1];
    for (const [p, q] of [[-dx, a[0] - x0], [dx, x1 - a[0]], [-dz, a[1] - z0], [dz, z1 - a[1]]]) {
      if (Math.abs(p) < 1e-12) { if (q < 0) return null; continue; }
      const r = q / p; if (p < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; }
    }
    return [[a[0] + dx * t0, a[1] + dz * t0], [a[0] + dx * t1, a[1] + dz * t1]];
  };
  // the convex piece P of tile F cut on the cells it covers (only those marked in mk, if given): emit([[x, z, y]...]) per cell triangle
  function overCells(F, P, emit, mk) {
    const st = F.st, n = F.n, c = n - 1, Y = F.y; let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
    for (const p of P) { if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0]; if (p[1] < z0) z0 = p[1]; if (p[1] > z1) z1 = p[1]; }
    const j0 = clamp(Math.floor((z0 - F.z0) / st), 0, c - 1), j1 = clamp(Math.floor((z1 - F.z0) / st), 0, c - 1);
    for (let j = j0; j <= j1; j++) { // row by row of cells (a long thin triangle only visits the cells along it)
      const Z0 = F.z0 + j * st, Rw = half(half(P, 0, 1, -Z0), 0, -1, Z0 + st); if (Rw.length < 3) continue;
      let rx0 = 1e9, rx1 = -1e9; for (const p of Rw) { if (p[0] < rx0) rx0 = p[0]; if (p[0] > rx1) rx1 = p[0]; }
      const i0 = clamp(Math.floor((rx0 - F.x0) / st), 0, c - 1), i1 = clamp(Math.floor((rx1 - F.x0) / st), 0, c - 1);
      for (let i = i0; i <= i1; i++) {
        if (mk && !mk[j * c + i]) continue;
        const X0 = F.x0 + i * st, Q = half(half(Rw, 1, 0, -X0), -1, 0, X0 + st); if (Q.length < 3) continue;
        const k = j * n + i, h00 = Y[k], h10 = Y[k + 1], h01 = Y[k + n], h11 = Y[k + n + 1];
        const A = tidy(half(Q, 1, -1, Z0 - X0)); // u >= v
        if (A) emit(A.map(([x, z]) => { const fu = (x - X0) / st, fv = (z - Z0) / st; return [x, z, h00 + fu * (h10 - h00) + fv * (h11 - h10)]; }), (j * c + i) * 2);
        const B = tidy(half(Q, -1, 1, X0 - Z0));
        if (B) emit(B.map(([x, z]) => { const fu = (x - X0) / st, fv = (z - Z0) / st; return [x, z, h00 + fv * (h01 - h00) + fu * (h11 - h01)]; }), (j * c + i) * 2 + 1);
      }
    }
  }
  // the height of S on one triangle of a cell (key = cell * 2 + 0 for u >= v, 1 for u < v), at any (x, z) of its plane
  function planeY(F, key, x, z) {
    const n = F.n, c = n - 1, w = key >> 1, i = w % c, j = (w - i) / c, st = F.st, k = j * n + i, Y = F.y, fu = (x - F.x0 - i * st) / st, fv = (z - F.z0 - j * st) / st;
    return key & 1 ? Y[k] + fv * (Y[k + n] - Y[k]) + fu * (Y[k + n + 1] - Y[k + n]) : Y[k] + fu * (Y[k + 1] - Y[k]) + fv * (Y[k + n + 1] - Y[k + 1]);
  }
  // the pieces of one polygon on one cell triangle (all on its plane) joined again: the edges two pieces share cancel, what is left is the
  // outline of the polygon inside the triangle, triangulated once (a cell the outline crosses costs 1-3 triangles, not one per piece of
  // every triangle of the polygon over it). null if the outline does not close cleanly: the pieces are drawn as they are
  function joinPieces(F, key, pieces) {
    const Q = 1e5, E = []; // directed edges [qa x, qa z, qb x, qb z, a, b] in 10 micron units; few per cell triangle, matched by a plain search
    for (let P of pieces) {
      let a = 0; for (let k = 0; k < P.length; k++) { const p = P[k], q = P[(k + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } if (a < 0) P = P.slice().reverse();
      for (let k = 0; k < P.length; k++) {
        const p = P[k], q = P[(k + 1) % P.length], ax = Math.round(p[0] * Q), az = Math.round(p[1] * Q), bx = Math.round(q[0] * Q), bz = Math.round(q[1] * Q); if (ax === bx && az === bz) continue;
        let m = -1; for (let e = 0; e < E.length; e++) { const f = E[e]; if (f && f[0] === bx && f[1] === bz && f[2] === ax && f[3] === az) { m = e; break; } }
        if (m >= 0) E[m] = null; else E.push([ax, az, bx, bz, p, q]);
      }
    }
    const L0 = E.filter(Boolean); if (L0.length < 3) return null;
    const used = new Uint8Array(L0.length), loops = [];
    for (let s0 = 0; s0 < L0.length; s0++) {
      if (used[s0]) continue; const L = []; let e = s0;
      for (let g = 0; g < L0.length + 1; g++) {
        used[e] = 1; L.push(L0[e][4]); const ex = L0[e][2], ez = L0[e][3];
        if (ex === L0[s0][0] && ez === L0[s0][1]) break;
        let nx = -1; for (let f = 0; f < L0.length; f++) if (!used[f] && L0[f][0] === ex && L0[f][1] === ez) { if (nx >= 0) return null; nx = f; } // two ways on: not a clean outline
        if (nx < 0) return null; e = nx;
      }
      const M = []; for (let k = 0; k < L.length; k++) { const p = L[(k + L.length - 1) % L.length], q = L[k], r = L[(k + 1) % L.length]; if (Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) > 1e-9) M.push(q); } // no points in a straight line
      if (M.length >= 3) loops.push(M);
    }
    const area = L => { let a = 0; for (let k = 0; k < L.length; k++) { const p = L[k], q = L[(k + 1) % L.length]; a += p[0] * q[1] - q[0] * p[1]; } return a / 2; };
    const outs = loops.filter(L => area(L) > 0), holes = loops.filter(L => area(L) < 0); if (!outs.length) return null;
    const tris = [], V = v => new THREE.Vector2(v[0], v[1]), Y = p => [p[0], p[1], planeY(F, key, p[0], p[1])];
    for (const o of outs) {
      const hs = holes.filter(h => outs.length === 1 || inPoly(h[0][0], h[0][1], o));
      let convex = !hs.length; for (let k = 0; convex && k < o.length; k++) { const p = o[k], q = o[(k + 1) % o.length], r = o[(k + 2) % o.length]; if ((q[0] - p[0]) * (r[1] - q[1]) - (q[1] - p[1]) * (r[0] - q[0]) < -1e-12) convex = false; }
      if (convex) { const y = o.map(Y); for (let k = 1; k < o.length - 1; k++) tris.push([y[0], y[k], y[k + 1]]); continue; } // most joins are convex: a fan
      const all = o.concat(...hs); let f; try { f = THREE.ShapeUtils.triangulateShape(o.map(V), hs.map(h => h.map(V))); } catch (e) { return null; }
      let sum = 0; for (const t of f) { const [p, q, r] = t.map(i => all[i]); sum += Math.abs((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / 2; }
      if (Math.abs(sum - area(o) - hs.reduce((a, h) => a + area(h), 0)) > 1e-4) return null; // earcut lost or doubled something
      for (const t of f) tris.push(t.map(i => Y(all[i])));
    }
    return tris;
  }
  // every cell a segment passes through (Amanatides-Woo, both neighbours at an exact corner), in cell coordinates of a c x c grid
  function walkCells(u0, v0, u1, v1, c, f) {
    let i = Math.floor(u0), j = Math.floor(v0); const du = u1 - u0, dv = v1 - v0, si = du > 0 ? 1 : du < 0 ? -1 : 0, sj = dv > 0 ? 1 : dv < 0 ? -1 : 0;
    const tdu = si ? Math.abs(1 / du) : Infinity, tdv = sj ? Math.abs(1 / dv) : Infinity;
    let tu = si > 0 ? (i + 1 - u0) * tdu : si < 0 ? (u0 - i) * tdu : Infinity, tv = sj > 0 ? (j + 1 - v0) * tdv : sj < 0 ? (v0 - j) * tdv : Infinity;
    const put = (a, b) => { if (a >= 0 && b >= 0 && a < c && b < c) f(a, b); };
    put(i, j);
    for (let g = 0; g < 8 * c + 16; g++) {
      if (Math.min(tu, tv) > 1) break;
      if (tu < tv) { i += si; tu += tdu; } else if (tv < tu) { j += sj; tv += tdv; } else { put(i + si, j); put(i, j + sj); i += si; j += sj; tu += tdu; tv += tdv; }
      put(i, j);
    }
  }
  const tileRange = (x0, z0, x1, z1) => [clamp(Math.floor((x0 + HW) / TSZ), 0, NX - 1), clamp(Math.floor((z0 + HHt) / TSZ), 0, NZ - 1), clamp(Math.floor((x1 + HW) / TSZ), 0, NX - 1), clamp(Math.floor((z1 + HHt) / TSZ), 0, NZ - 1)];
  // a polygon with holes on the grid: emit(piece, fine) with piece [[x, z, y]...] convex, y the height of S, in a tile of S; [[x, z]...]
  // and fine false over a tile without .bin (drape it the old way). The cells no edge crosses and whose middle is inside are whole: their two
  // triangles as they are; the others take the polygon's triangles cut on them. false when no tile of S is under the polygon
  // the cells of tile F (corner X0, Z0) a polygon covers whole: no edge of its rings crosses them (mk marks the crossed ones, walked cell by
  // cell) and their middle is inside (scanlines through the middles); cb(cell)
  function wholeCells(F, X0, Z0, rings, bz0, bz1, mk, cb) {
    const st = F.st, c = F.n - 1, j0 = clamp(Math.floor((bz0 - Z0) / st), 0, c - 1), j1 = clamp(Math.floor((bz1 - Z0) / st), 0, c - 1);
    for (let j = j0; j <= j1; j++) {
      const zc = Z0 + (j + 0.5) * st, xs = [];
      for (const r of rings) for (let k = 0; k < r.length; k++) { const a = r[k], b = r[(k + 1) % r.length]; if ((a[1] > zc) !== (b[1] > zc)) xs.push(a[0] + (zc - a[1]) * (b[0] - a[0]) / (b[1] - a[1])); }
      xs.sort((p, q) => p - q);
      for (let s = 0; s + 1 < xs.length; s += 2) {
        const ia = Math.max(0, Math.ceil((xs[s] - X0) / st - 0.5)), ib = Math.min(c - 1, Math.floor((xs[s + 1] - X0) / st - 0.5));
        for (let i = ia; i <= ib; i++) if (!mk[j * c + i]) cb(j * c + i);
      }
    }
  }
  function markOutline(F, X0, Z0, rings, mk, marked) {
    const st = F.st, c = F.n - 1;
    for (const r of rings) for (let k = 0; k < r.length; k++) {
      const S = clipSeg(r[k], r[(k + 1) % r.length], X0, Z0, X0 + TSZ, Z0 + TSZ); if (!S) continue; const [p, q] = S;
      walkCells((p[0] - X0) / st, (p[1] - Z0) / st, (q[0] - X0) / st, (q[1] - Z0) / st, c, (i, j) => { const w = j * c + i; if (!mk[w]) { mk[w] = 1; marked.push(w); } });
    }
  }
  // the cells of tile t a polygon covers whole (the build of a tile of S gives them to the layer on top, H.own)
  function coverCells(outer, holes, t, cb) {
    const F = FT[t]; if (!F) return; const rings = [outer, ...holes], [, bz0, , bz1] = bbox(outer), c = F.n - 1, mk = F.mk || (F.mk = new Uint8Array(c * c)), marked = [];
    markOutline(F, tx0(t), tz0(t), rings, mk, marked); wholeCells(F, tx0(t), tz0(t), rings, bz0, bz1, mk, cb); for (const w of marked) mk[w] = 0;
  }
  // a polygon with holes on the grid: emit(piece, fine) with piece [[x, z, y]...] convex, y the height of S, in a tile of S; [[x, z]...]
  // and fine false over a tile without .bin (drape it the old way). The cells no edge crosses and whose middle is inside are whole: their two
  // triangles as they are; the others take the polygon's triangles cut on them and joined again. With a rank (a surface layer of the tile,
  // H.own) the whole cells are left to the layer that owns them, which draws them in place of the ground, and the pieces on a cell owned
  // by a layer as high or higher are hidden under it. false when no tile of S is under the polygon
  function clipPoly(outer, holes, emit, rank) {
    const rings = [outer, ...holes], [bx0, bz0, bx1, bz1] = bbox(outer), [ti0, tj0, ti1, tj1] = tileRange(bx0, bz0, bx1, bz1);
    let any = false; for (let tj = tj0; tj <= tj1 && !any; tj++) for (let ti = ti0; ti <= ti1; ti++) if (FT[ti + NX * tj]) { any = true; break; }
    if (!any) return false;
    const V = v => new THREE.Vector2(v[0], v[1]), faces = THREE.ShapeUtils.triangulateShape(outer.map(V), holes.map(h => h.map(V))), all = outer.concat(...holes);
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const t = ti + NX * tj, F = FT[t], X0 = tx0(t), Z0 = tz0(t), X1 = X0 + TSZ, Z1 = Z0 + TSZ;
      const inT = f => { let a = 0, b = 0, c = 0, d = 0; for (const q of f) { const p = all[q]; if (p[0] >= X0 - 1e-6) a++; if (p[0] <= X1 + 1e-6) b++; if (p[1] >= Z0 - 1e-6) c++; if (p[1] <= Z1 + 1e-6) d++; } return a === 3 && b === 3 && c === 3 && d === 3; };
      if (!F) { for (const f of faces) { const Q = tidy(inT(f) ? f.map(q => all[q]) : square(f.map(q => all[q]), X0, Z0, X1, Z1)); if (Q) emit(Q, false); } continue; }
      const st = F.st, n = F.n, c = n - 1, mk = F.mk || (F.mk = new Uint8Array(c * c)), marked = [], Y = F.y, own = rank !== undefined ? F.own : null;
      markOutline(F, X0, Z0, rings, mk, marked);
      if (!own) wholeCells(F, X0, Z0, rings, bz0, bz1, mk, w => {
        const i = w % c, j = (w - i) / c, x = X0 + i * st, z = Z0 + j * st, k = j * n + i;
        emit([[x, z, Y[k]], [x + st, z, Y[k + 1]], [x + st, z + st, Y[k + n + 1]]], true); emit([[x, z, Y[k]], [x + st, z + st, Y[k + n + 1]], [x, z + st, Y[k + n]]], true);
      });
      const byKey = new Map(); // the cells on the outline: the polygon's triangles cut on them, then joined again cell triangle by cell triangle
      for (const f of faces) { const Q = inT(f) ? f.map(q => all[q]) : square(f.map(q => all[q]), X0, Z0, X1, Z1); if (Q.length >= 3) overCells(F, Q, (P, key) => { if (own && own[key >> 1] >= rank) return; const l = byKey.get(key); if (l) l.push(P); else byKey.set(key, [P]); }, mk); }
      for (const [key, l] of byKey) { const J = l.length > 1 ? joinPieces(F, key, l) : null; for (const P of J || l) emit(P, true); }
      for (const w of marked) mk[w] = 0;
    }
    return true;
  }
  // one triangle in plan cut the same way (what mkMesh does with the draped strips, ribbons and quads in a tile of S): emit(piece, fine, F, key)
  function clipTri(P, emit) {
    const [bx0, bz0, bx1, bz1] = bbox(P), [ti0, tj0, ti1, tj1] = tileRange(bx0, bz0, bx1, bz1);
    for (let tj = tj0; tj <= tj1; tj++) for (let ti = ti0; ti <= ti1; ti++) {
      const t = ti + NX * tj, F = FT[t], X0 = tx0(t), Z0 = tz0(t), Q = ti0 === ti1 && tj0 === tj1 ? P : square(P, X0, Z0, X0 + TSZ, Z0 + TSZ); if (Q.length < 3) continue;
      if (F) overCells(F, Q, (R, key) => emit(R, true, F, key)); else { const R = tidy(Q); if (R) emit(R, false); }
    }
  }
  // the points where a segment crosses the cell edges and diagonals of the tiles of S, with the height of S: between two of them S is a
  // straight line (kerbs follow it); over a tile without .bin only the ends
  function cutLine(ax, az, bx, bz, hf) {
    const ts = [0, 1], dx = bx - ax, dz = bz - az, F = fineAt((ax + bx) / 2, (az + bz) / 2);
    if (F) {
      const st = F.st, lines = (p0, d, o) => { if (Math.abs(d) < 1e-12) return; const a = (p0 - o) / st, b = (p0 + d - o) / st; for (let k = Math.ceil(Math.min(a, b)); k <= Math.floor(Math.max(a, b)); k++) { const t = (o + k * st - p0) / d; if (t > 1e-6 && t < 1 - 1e-6) ts.push(t); } };
      lines(ax, dx, F.x0); lines(az, dz, F.z0); lines(ax - az, dx - dz, F.x0 - F.z0);
      ts.sort((p, q) => p - q);
    }
    return ts.map(t => { const x = ax + dx * t, z = az + dz * t; return [x, z, hf(x, z)]; });
  }
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
  // the deck under road node i that one of its roads runs on (decks[].ra), its top there, or null; worked out once for all nodes
  let NDK = null;
  function nodeDeck(i) {
    if (!NDK) {
      NDK = new Map(); const on = new Map(); for (const d of DECKS) for (const r of d.ra) { let l = on.get(r); if (!l) on.set(r, l = []); l.push(d); }
      D.roads.forEach((r, ri) => { const l = on.get(ri); if (!l) return; for (const n of r.g) { if (NDK.has(n)) continue; const [x, z] = N[n]; for (const o of deckAt(x, z)) if (l.includes(o.d)) { NDK.set(n, o.top); break; } } });
    }
    const v = NDK.get(i); return v === undefined ? null : v;
  }
  // the step of the old engine (tiles without .bin): the sidewalks and platforms the tile draws raised; world3.js fills them in later
  const oldStep = (x, z) => { try { return onSide(x, z) ? SIDE_H : onPlatform(x, z) ? PLAT_H : 0; } catch (e) { return 0; } }; // (before world3.js has its grids: 0)
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
      const F = fineAt(px, pz); if (!F) { w = oldG(px, pz) - RIV_D * (1 - fadeW(px, pz)) + 0.5; return; }
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
    // the ground as drawn (docs/motore.md 3): S + step, the cover of a sidewalk, a platform or a median where the point is on one; in a tile
    // without .bin the old ground and its sidewalks and platforms (onSide, onPlatform of world3.js). What draws the step itself (the sides
    // of a platform, the kerbs) or drapes a surface takes H.base
    ground(x, z) { const F = fineAt(x, z); return F ? onF(F, x, z) + step(x, z) : oldG(x, z) + oldStep(x, z); },
    vis(x, z) { const F = fineAt(x, z); return F ? onF(F, x, z) : oldG(x, z) - rivCut(x, z); }, // the old drawn ground cut the river into the grid
    rivCut, fadeW, // the old engine near S: how deep its river cut is, how much of S it takes
    inRiver: (x, z) => riverCut(x, z) > 0, // within an OSM river (its axis and width), wherever: the tiles of S use it to find the water mapped in the bed
    // what the street surfaces drape on: S, or the top of a deck nothing but water or field passes under (the asphalt of a bridge over the
    // Seveso stays on the bridge). Transitional: phase 5 clips them on the grid and on the decks
    street(x, z) { const F = fineAt(x, z); if (!F) return oldG(x, z); const g = onF(F, x, z); for (const o of deckAt(x, z)) if (o.d.free && o.top > g) return o.top; return g; },
    // the top of a deck nothing but water or field passes under, where it stands over y (the street surfaces of a bridge over the Seveso)
    overFree(x, z, y) { for (const o of deckAt(x, z)) if (o.d.free && o.top > y) y = o.top; return y; },
    step, stepAt, clipPoly, clipTri, coverCells, cutLine, joinPieces, anyFine: () => !!TERRENO,
    anyFineIn(x0, z0, x1, z1) { const [i0, j0, i1, j1] = tileRange(x0, z0, x1, z1); for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) if (FT[i + NX * j]) return true; return false; }, // a tile of S under the box
    mat(x, z) { const F = fineAt(x, z); if (!F || !F.m) return 0; const n = F.n, i = clamp(Math.floor((x - F.x0) / F.st), 0, n - 2), j = clamp(Math.floor((z - F.z0) / F.st), 0, n - 2); return F.m[j * (n - 1) + i]; }, // material of the cell (1 asphalt ... 4 river bed)
    addStep(kind, h, o, k) { if (o.length < 3) return; const s = { kind, h, o, k: k || [], bb: bbox(o) }; STG.add(s.bb[0], s.bb[1], s.bb[2], s.bb[3], s); },
    surface(x, z, cy) {
      const F = fineAt(x, z); if (!F) return H.oldSurface(x, z, cy);
      const sh = step(x, z); let y = onF(F, x, z) + (sh || bumpAt(x, z)); // the step layer: the sidewalks, platforms and medians as drawn
      if (cy === undefined) return y;
      for (const o of deckAt(x, z)) if (o.top > y && o.top <= cy + 0.8) y = o.top;
      return y;
    },
    oldSurface: null, // world3.js: surfAt of the old engine (DECKG, the embankments, the river cut)
    // a road node (AI cars, walkers, police spawn): on the deck its road runs over (decks[].ra, the roads the build found on the deck), else
    // on the deck nearest its old height (within 3 m, the old elevated ways), else on S. Before phase 6 a node on a deck the old data did not
    // know (old height null) was put on S: a police car born on a bridge came out under it
    node(i) {
      const [x, z] = N[i], F = fineAt(x, z), y0 = NHt[i];
      if (!F) return y0 === null ? oldG(x, z) : oldDeck(i, y0);
      const d = nodeDeck(i); if (d !== null) return d;
      return y0 === null ? onF(F, x, z) : onDeck(F, x, z, y0);
    },
    nodeDeck: i => nodeDeck(i),
    kind(x, z) {
      const F = fineAt(x, z);
      if (F) { const s = stepAt(x, z); if (s) return s.kind === 2 ? 'plat' : 'side'; } else { if (onPlatform(x, z)) return 'plat'; if (onSide(x, z)) return 'side'; }
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
        const meshes = [m, ...(T.ownMeshes || [])], n = F.n; let mx = 0, mr = 0, nr = 0; // the cells a surface layer owns are drawn by its mesh (world3.js, H.own)
        for (let q = 0; q < 1000; q++) {
          const x = F.x0 + R() * TSZ, z = F.z0 + R() * TSZ, i = clamp(Math.floor((x - F.x0) / F.st), 0, n - 2), j = clamp(Math.floor((z - F.z0) / F.st), 0, n - 2), w = j * (n - 1) + i, M = meshes[T.cellMesh ? T.cellMesh[w] : 0], c = T.cellIdx ? T.cellIdx[w] : w * 6;
          const P = M.geometry.attributes.position.array, I = M.geometry.index.array;
          let y = null;
          for (const s of [c, c + 3]) {
            const a = I[s] * 3, b = I[s + 1] * 3, e = I[s + 2] * 3, den = (P[b + 2] - P[e + 2]) * (P[a] - P[e]) + (P[e] - P[b]) * (P[a + 2] - P[e + 2]);
            const l1 = ((P[b + 2] - P[e + 2]) * (x - P[e]) + (P[e] - P[b]) * (z - P[e + 2])) / den, l2 = ((P[e + 2] - P[a + 2]) * (x - P[e]) + (P[a] - P[e]) * (z - P[e + 2])) / den, l3 = 1 - l1 - l2;
            if (l1 >= -1e-3 && l2 >= -1e-3 && l3 >= -1e-3) { y = l1 * P[a + 1] + l2 * P[b + 1] + l3 * P[e + 1]; break; } /* 1e-3, not 1e-5: east of x 1000 the float32 positions are off by 1e-4 m and a point on the diagonal fell in neither triangle (collaudo 25/10: 6 tile "Infinity") */
          }
          if (y === null) { mx = Infinity; continue; }
          mx = Math.max(mx, Math.abs(y - H.base(x, z)));
        }
        for (const M of meshes) M.updateMatrixWorld();
        for (let q = 0; q < 20; q++) { const x = F.x0 + R() * TSZ, z = F.z0 + R() * TSZ; ray.set(o.set(x, 1e4, z), dn); const h = ray.intersectObjects(meshes, false)[0]; if (h) { mr = Math.max(mr, Math.abs(h.point.y - H.base(x, z))); nr++; } }
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
// the old height functions (groundH, visH, surfAt, nodeY) are gone (docs/motore.md 3.1, fase 6): every consumer asks H.* itself, and H.*
// answers with the old engine in the tiles without .bin (outside Meda until phase 8), so no alias is needed there either
const streetH = (x, z) => H.street(x, z);
