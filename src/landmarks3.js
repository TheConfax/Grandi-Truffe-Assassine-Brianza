// ---------------------------------------------------------------- materials and generators shared by the game (banchine, parcheggi, arredi dei parchi)
// Until 24/10/2026 this file held the hand-made models of 48 real buildings (LANDMARKS), the squares, school yards, park paths, the stairwells of
// the station underpass and the other pieces placed by hand. Carlo, 24/10: "i nostri pezzi a mano erano delle investigazioni, che terremo presente
// per poi rifare bene tutto, ma prima voglio la versione dbgt+osm": they are switched off and kept, not assembled, in src/_vecchi/
// (landmarks_modelli.js, pezzi_a_mano.js, with what each did and where it came from). What is left here works on the data of the whole map:
// railway platforms from OSM, parking stalls on the car parks, benches and lamps along the paths in the parks, and the helpers other files use
// (LM_GLOW for what lights up at night, lmFrame and lmBox to model in a local frame, LMAT.trim/warm)
const LM_GLOW = []; // { m, a, b }: emissive a by day, a + b once the street lamps are on
const LMAT = {
  trim: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  warm: new THREE.MeshLambertMaterial({ color: 0x2f3036, emissive: 0xffc77a, emissiveIntensity: 0, side: THREE.DoubleSide }), // windows lit from inside at night
};
LM_GLOW.push({ m: LMAT.warm, a: 0, b: 0.8 });

// local frame helpers: everything is modelled in metres around (0,0,0) and moved into place by M while it goes into the buffers
function lmFrame(M) {
  const nm = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3(), n = new THREE.Vector3();
  const put = (b, x, y, z, nx, ny, nz, u, w, col) => { v.set(x, y, z).applyMatrix4(M); n.set(nx, ny, nz).applyMatrix3(nm).normalize(); vtx(b, v.x, v.y, v.z, n.x, n.y, n.z, u, w, col); };
  return {
    v: put, // one vertex in local coordinates
    face(b, pts, S = 2, col) { // planar polygon [[x,y,z]...]; uv in metres / S along its level and up-slope axes
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let ax = nz, az = -nx; const al = hyp(ax, az); if (al < 1e-3) { ax = 1; az = 0; } else { ax /= al; az /= al; }
      const bx = ny * az, by = nz * ax - nx * az, bz = -ny * ax, base = b.p.length / 3;
      const flat = pts.map(p => new THREE.Vector2(p[0] * ax + p[2] * az, p[0] * bx + p[1] * by + p[2] * bz));
      for (let i = 0; i < pts.length; i++) put(b, pts[i][0], pts[i][1], pts[i][2], nx, ny, nz, flat[i].x / S, flat[i].y / S, col);
      const tris = THREE.ShapeUtils.triangulateShape(flat, []), cw = THREE.ShapeUtils.isClockWise(flat);
      for (const t of tris) if (cw) b.i.push(base + t[0], base + t[2], base + t[1]); else b.i.push(base + t[0], base + t[1], base + t[2]);
    },
    geo(b, g, uvf, col) { // any THREE geometry already placed in the local frame; uvf(p, n, uv) -> [u, v], else its own uv
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, base = b.p.length / 3, p = new THREE.Vector3(), q = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); q.fromBufferAttribute(nor, i); const t0 = uv ? [uv.getX(i), uv.getY(i)] : [0, 0], t = uvf ? uvf(p, q, t0) : t0; put(b, p.x, p.y, p.z, q.x, q.y, q.z, t[0], t[1], col); }
      if (g.index) for (let i = 0; i < g.index.count; i++) b.i.push(base + g.index.getX(i)); else for (let i = 0; i < pos.count; i++) b.i.push(base + i);
      g.dispose();
    },
  };
}
const boxUV = S => (p, n) => Math.abs(n.y) > 0.7 ? [p.x / S, p.z / S] : Math.abs(n.x) > Math.abs(n.z) ? [p.z / S, p.y / S] : [p.x / S, p.y / S];
const wrapUV = (S, len, vlen) => (p, n, t) => [t[0] * len / S, vlen ? t[1] * vlen / S : p.y / S]; // cylinders, cones, domes: their own uv stretched to metres
const lmBox = (w, h, d, x, y, z, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);
// ---------------------------------------------------------------- railway platforms (banchine): raised slabs with the white edge and the yellow line, and near each station
// the canopies on posts, the stairs down to the underpass, the blue name boards, benches and lamps
const PLAT_STATIONS = D.pois.filter(p => p.k === 'stazione');
const PLAT_MAT = { top: new THREE.MeshLambertMaterial({ map: sidewalkTex, color: 0xd8d4cc }), side: new THREE.MeshLambertMaterial({ map: concreteTex }), line: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
const STATION_SIGN = {};
function stationSignMat(name) { // the blue Ferrovienord board with the station's name
  if (STATION_SIGN[name]) return STATION_SIGN[name];
  const t = canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1f3f8c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 56; g.font = `bold ${fs}px Arial, sans-serif`; while (g.measureText(name).width > w - 40 && fs > 20) { fs -= 2; g.font = `bold ${fs}px Arial, sans-serif`; } g.fillText(name, w / 2, h / 2 + 3); }, false);
  return (STATION_SIGN[name] = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
}
// across-section of a polygon on the line through (cx,cz)+u*s, perpendicular to u: the [vmin, vmax] where it is inside
function lmSection(poly, cx, cz, ux, uz, s) {
  const ox = cx + ux * s, oz = cz + uz * s; let lo = 1e9, hi = -1e9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], sa = (a[0] - ox) * ux + (a[1] - oz) * uz, sc = (c[0] - ox) * ux + (c[1] - oz) * uz;
    if ((sa > 0) === (sc > 0)) continue; const t = sa / (sa - sc), x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t, v = (x - ox) * -uz + (z - oz) * ux;
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  return hi > lo ? [lo, hi] : null;
}
function buildPlatforms(T, G) {
  if (!T.pf) return;
  const top = FBuf(), side = Buf(), line = FBuf(), F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf(), warm: Buf() }, boards = new Map();
  const WHITE = COL('#f2f0ea'), YELLOW = COL('#f2c230'), METAL = COL('#7d858d'), POST = COL('#5d646b'), DARK = COL('#1f2022'), WOOD = COL('#8a6a48');
  for (const P of T.pf) {
    try { polyFill(top, P.o, P.k, PLAT_H, 4); } catch (e) { }
    const A = sArea(P.o);
    for (const [ring, hole] of [[P.o, false], ...P.k.map(h => [h, true])]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.05) continue;
      let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if ((A < 0) !== hole) { nx = -nx; nz = -nz; }
      const ga = H.base(a[0], a[1]), gc = H.base(c[0], c[1]), b0 = side.p.length / 3; // the sides of the step itself: from S
      vtx(side, a[0], ga - 0.3, a[1], nx, 0, nz, 0, 0); vtx(side, c[0], gc - 0.3, c[1], nx, 0, nz, Ln / 2, 0); vtx(side, c[0], gc + PLAT_H, c[1], nx, 0, nz, Ln / 2, 0.4); vtx(side, a[0], ga + PLAT_H, a[1], nx, 0, nz, 0, 0.4);
      side.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
      if (hole || !nearRail((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 4.5)) continue; // track side: white edge and the yellow line inside it
      for (const [d0, d1, col] of [[0, 0.32, WHITE], [0.85, 0.97, YELLOW]]) { const l0 = line.p.length / 3; for (const [p, d] of [[a, d0], [c, d0], [c, d1], [a, d1]]) vtx(line, p[0] - nx * d, PLAT_H + 0.012, p[1] - nz * d, 0, 1, 0, 0, 0, col); line.i.push(l0, l0 + 1, l0 + 2, l0, l0 + 2, l0 + 3, l0, l0 + 2, l0 + 1, l0, l0 + 3, l0 + 2); }
    }
    // furniture, only on the platforms of a station: along the platform's long axis
    const [cx, cz] = centroid(P.o), st = PLAT_STATIONS.slice().sort((p, q) => hyp(p.x - cx, p.z - cz) - hyp(q.x - cx, q.z - cz))[0];
    if (!st || hyp(st.x - cx, st.z - cz) > 220) continue;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P.o) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang), proj = P.o.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), s0 = Math.min(...proj) + 2, s1 = Math.max(...proj) - 2;
    const name = (st.n || '').replace(/^Stazione di /, '').toUpperCase(), ry = Math.atan2(-uz, ux);
    const at = (s, v) => [cx + ux * s - uz * v, cz + uz * s + ux * v];
    let lastPost = null, stairs = false;
    for (let s = s0; s <= s1; s += 1) {
      const sec = lmSection(P.o, cx, cz, ux, uz, s); if (!sec) continue; const wd = sec[1] - sec[0]; if (wd < 2.6) continue;
      const vm = (sec[0] + sec[1]) / 2, [x, z] = at(s, vm), gy = H.ground(x, z), dst = hyp(x - st.x, z - st.z), si = Math.round(s - s0);
      const covered = dst < 60;
      if (covered && si % 7 === 0) { // canopy: posts down the middle, a metal roof between them, lights underneath
        F.geo(Bs.trim, lmBox(0.22, 3.4, 0.22, x, gy + 1.7, z), null, POST);
        if (lastPost && s - lastPost.s <= 7.5) { const cw = Math.min(wd - 0.6, 4.4), mx = (x + lastPost.x) / 2, mz = (z + lastPost.z) / 2, my = (gy + lastPost.gy) / 2 + 3.5; F.geo(Bs.trim, lmBox(s - lastPost.s + 0.1, 0.16, cw, mx, my, mz, ry), null, METAL); F.geo(Bs.warm, lmBox(s - lastPost.s - 0.6, 0.05, 0.25, mx, my - 0.11, mz, ry)); F.geo(Bs.trim, lmBox(s - lastPost.s + 0.1, 0.3, 0.12, mx, my - 0.2, mz, ry), null, POST); }
        lastPost = { s, x, z, gy };
      }
      if (covered && si % 14 === 3 && wd > 3.4) { // bench
        F.geo(Bs.trim, lmBox(1.8, 0.08, 0.45, x, gy + 0.45, z, ry), null, WOOD); F.geo(Bs.trim, lmBox(1.8, 0.4, 0.06, 0, 0, 0, 0).translate(0, gy + 0.75, -0.22).rotateY(ry).translate(x, 0, z), null, WOOD);
        for (const e of [-0.75, 0.75]) F.geo(Bs.trim, lmBox(0.08, 0.45, 0.4, 0, gy + 0.22, 0).translate(e, 0, 0).rotateY(ry).translate(x, 0, z), null, POST);
      }
      if (!covered && si % 15 === 7) { F.geo(Bs.trim, lmBox(0.14, 4.6, 0.14, x, gy + 2.3, z), null, POST); F.geo(Bs.warm, lmBox(0.6, 0.12, 0.25, x, gy + 4.55, z, ry)); } // platform lamp
      if (si % 40 === 20 && name) { // name board on two posts, readable from the trains
        for (const e of [-1.4, 1.4]) { const [px, pz] = [x + ux * e, z + uz * e]; F.geo(Bs.trim, lmBox(0.1, 3.0, 0.1, px, gy + 1.5, pz), null, POST); }
        const b = boards.get(name) || Buf(); boards.set(name, b); const i0 = b.p.length / 3, nx2 = -uz, nz2 = ux;
        for (const [e, yy, u, v] of [[-1.5, 2.2, 0, 0], [1.5, 2.2, 1, 0], [1.5, 2.85, 1, 1], [-1.5, 2.85, 0, 1]]) vtx(b, x + ux * e + nx2 * 0.06, gy + yy, z + uz * e + nz2 * 0.06, nx2, 0, nz2, u, v);
        b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      }
      if (!stairs && dst < 25 && wd > 4.2 && si > 8 && s < s1 - 8) { // stairs down to the underpass: railed opening, a little glass roof
        stairs = true; const L2 = 6.5, W2 = 0.9;
        F.geo(Bs.trim, lmBox(L2, 0.04, 2 * W2, x, gy + 0.03, z, ry), null, DARK);
        for (const e of [-1, 1]) F.geo(Bs.trim, lmBox(L2, 0.06, 0.06, 0, gy + 1.05, e * (W2 + 0.05)).rotateY(ry).translate(x, 0, z), null, COL('#9aa1a8'));
        for (let k = 0; k <= 4; k++) for (const e of [-1, 1]) F.geo(Bs.trim, lmBox(0.05, 1.05, 0.05, 0, gy + 0.52, 0).translate(-L2 / 2 + k * L2 / 4, 0, e * (W2 + 0.05)).rotateY(ry).translate(x, 0, z), null, COL('#9aa1a8'));
        F.geo(Bs.trim, lmBox(0.06, 1.05, 2 * W2, 0, gy + 0.52, 0).translate(L2 / 2, 0, 0).rotateY(ry).translate(x, 0, z), null, COL('#9aa1a8'));
        F.geo(Bs.trim, lmBox(L2 + 0.6, 0.08, 2 * W2 + 0.8, x, gy + 2.6, z, ry), null, COL('#bcd0da'));
        for (const e of [-1, 1]) F.geo(Bs.trim, lmBox(0.08, 2.6, 0.08, 0, gy + 1.3, 0).translate(e * L2 / 2, 0, W2 + 0.3).rotateY(ry).translate(x, 0, z), null, POST);
      }
    }
  }
  mkMesh(top, PLAT_MAT.top, 9, false, G); mkMesh(side, PLAT_MAT.side, 9, false, G); mkMesh(line, PLAT_MAT.line, 10, false, G);
  mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); if (Bs.warm.i.length) mkMesh(Bs.warm, LMAT.warm, 10, false, G);
  for (const [n, b] of boards) mkMesh(b, stationSignMat(n), 10, false, G);
}

// parking stalls: white lines across the long side of every car park, one or two rows depending on its width, never over the aisles (OSM service
// roads) or a building; one yellow stall with the wheelchair per row of eight or more; T.stalls keeps every stall for the parked cars (parkTile);
// on the bigger car parks lamp posts down the middle, a parking meter and the blue P sign
const PSIGN_MAT = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#fff'; g.font = 'bold 46px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', w / 2, h / 2 + 3); }, false), side: THREE.DoubleSide });
/* Rows of stalls drawn by hand from the aerial photo (Regione Lombardia orthophoto) where the rule below, working on the whole OSM/DBGT area, got them wrong: via Isonzo (the piazzetta and the car park to the north), foto aerea, Carlo 29/10.
   a, b: the back of the row (kerb, wall), first to last stall; lato: +1 the stalls are on the side (-uz, ux) of a->b, -1 on the other; n: stalls, 2.5 m wide, 4.8 deep, nose to the back, counted from a; ln: stalls that keep their line on the side of a left-out one; sin: stalls left out (the beds of the square stand there: the row is made of the stalls between them); dis: the stall of the disabled (-1 none). An area holding a row of these gets no stalls of the rule. */
const PARK_A_MANO = [
  { a: [555.3, -233.1], b: [544.4, -216.3], lato: 1, n: 8, dis: 1 }, /* piazzetta of via Isonzo, row against the bed along the street (east) */
  { a: [545.7, -247.7], b: [534.0, -231.4], lato: -1, n: 8, sin: [2, 3, 6], ln: [1], dis: 5 }, /* piazzetta of via Isonzo, row against the edge of the square with the beds (west) */
  { a: [569.4, -265.5], b: [560.5, -253.5], lato: -1, n: 6, dis: -1 }, /* east side of the building of Muzic Planet */
  { a: [548.4, -294.7], b: [567.8, -278.95], lato: 1, n: 10, dis: 1 }, /* north, along via Indipendenza, against the green strip */
];
const PARK_A_MANO_STALLS = PARK_A_MANO.flatMap(r => {
  const [a, b] = r.lato < 0 ? [r.b, r.a] : [r.a, r.b], L = Math.hypot(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux, out = [];
  for (let k = 0; k < r.n; k++) { const s = 2.5 * k + 1.25, ix = j => r.lato < 0 ? r.n - 1 - j : j, out0 = (r.sin || []).includes.bind(r.sin || []); if (out0(ix(k))) continue; out.push({ x: a[0] + ux * s + nx * 2.4, z: a[1] + uz * s + nz * 2.4, ux, uz, h: Math.atan2(uz, -ux), dis: ix(k) === r.dis, l0: k === 0 || (r.ln || []).includes(ix(k)), l1: !out0(ix(k + 1)), y1: ix(k) === r.dis || ix(k + 1) === r.dis }); } /* each line drawn once, by the stall before it (yellow if either side is the disabled one); none on the side of a left-out stall, the bed is there */
  return out;
});
function buildParkingLines(T, G) {
  const b = FBuf(), W = COL('#e9e7df'), Y = COL('#f2c230'), BLUE = COL('#2c5aa8'), F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf() }, lamps = Buf(), heads = Buf(), sign = Buf();
  T.stalls = []; T.streetStalls = [];
  const quad = (x, z, ux, uz, a0, a1, w0, w1, col) => { const nx = -uz, nz = ux;
    if (H.fineAt(x, z)) { // a tile of S: thin paint on a flat car park, in pieces of at most 2.5 m along it, each corner 5 cm over S (b.noclip: cut on the cells it would cost four times the triangles)
      b.noclip = true; const L = Math.max(Math.abs(a1 - a0), Math.abs(w1 - w0)), along = Math.abs(a1 - a0) >= Math.abs(w1 - w0), m = Math.max(1, Math.ceil(L / 2.5));
      for (let k = 0; k < m; k++) { const i0 = b.p.length / 3, f0 = k / m, f1 = (k + 1) / m, A0 = along ? a0 + (a1 - a0) * f0 : a0, A1 = along ? a0 + (a1 - a0) * f1 : a1, W0 = along ? w0 : w0 + (w1 - w0) * f0, W1 = along ? w1 : w0 + (w1 - w0) * f1;
        for (const [s, v] of [[A0, W0], [A1, W0], [A1, W1], [A0, W1]]) vtx(b, x + ux * s + nx * v, 0.05, z + uz * s + nz * v, 0, 1, 0, 0, 0, col); triUp(b, i0, i0 + 1, i0 + 2); triUp(b, i0, i0 + 2, i0 + 3); }
      return;
    }
    const i0 = b.p.length / 3; for (const [s, v] of [[a0, w0], [a1, w0], [a1, w1], [a0, w1]]) vtx(b, x + ux * s + nx * v, 0.05, z + uz * s + nz * v, 0, 1, 0, 0, 0, col); b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); };
  const outline = (x, z, ux, uz, l, w, col) => { quad(x, z, ux, uz, -l / 2, l / 2, -w / 2 - 0.06, -w / 2 + 0.06, col); quad(x, z, ux, uz, -l / 2, l / 2, w / 2 - 0.06, w / 2 + 0.06, col); quad(x, z, ux, uz, -l / 2 - 0.06, -l / 2 + 0.06, -w / 2, w / 2, col); quad(x, z, ux, uz, l / 2 - 0.06, l / 2 + 0.06, -w / 2, w / 2, col); };
  for (const st of PARK_A_MANO_STALLS) { /* the rows by hand: each stall in the tile its centre falls in; first in T.stalls, so the cars of the tile (at most 14) park here before elsewhere */
    if (tileOf(st.x, st.z) !== T.t) continue; const col = st.dis ? Y : W;
    if (st.l0) quad(st.x, st.z, st.ux, st.uz, -1.31, -1.19, -2.4, 2.4, col); if (st.l1) quad(st.x, st.z, st.ux, st.uz, 1.19, 1.31, -2.4, 2.4, st.y1 ? Y : W);
    if (st.dis) quad(st.x, st.z, st.ux, st.uz, -0.5, 0.5, -0.5, 0.5, BLUE);
    T.stalls.push({ x: st.x, z: st.z, h: st.h, dis: st.dis });
  }
  // the spaces OSM maps one by one: white lines, yellow with the blue square for the disabled
  const real = (T.d.ps || []).map(([X, Z, ang, L, Wd, kind]) => ({ x: X / 10, z: Z / 10, ang, L: clamp(L, 4, 7), W: clamp(Wd, 1.8, 3.5), kind }));
  for (const sp of real) {
    const ux = Math.sin(sp.ang), uz = Math.cos(sp.ang), col = sp.kind === 1 ? Y : W;
    quad(sp.x, sp.z, ux, uz, -sp.L / 2, sp.L / 2, -sp.W / 2 - 0.06, -sp.W / 2 + 0.06, col); quad(sp.x, sp.z, ux, uz, -sp.L / 2, sp.L / 2, sp.W / 2 - 0.06, sp.W / 2 + 0.06, col);
    if (sp.kind === 1) quad(sp.x, sp.z, ux, uz, -0.5, 0.5, -0.5, 0.5, BLUE);
    T.stalls.push({ x: sp.x, z: sp.z, h: sp.ang + ((Math.round(sp.x * 3 + sp.z * 7) & 1) ? Math.PI : 0), dis: sp.kind === 1, real: true });
  }
  // parking along the streets where OSM says so: parallel, angled or nose-in, just off the carriageway; blue lines where you pay
  for (const ri of T.d.rp || []) {
    const r = D.roads[ri]; if (!r.pk || r.d || r.b || r.t) continue;
    for (let k = 1; k < r.g.length; k++) {
      const A = N[r.g[k - 1]], C = N[r.g[k]], L = hyp(C[0] - A[0], C[1] - A[1]); if (L < 10 || tileOf((A[0] + C[0]) / 2, (A[1] + C[1]) / 2) !== T.t) continue;
      const ux = (C[0] - A[0]) / L, uz = (C[1] - A[1]) / L, rx = -uz, rz = ux;
      for (const [si, side] of [[0, -1], [1, 1]]) {
        const v = r.pk[si]; if (!v) continue; const kind = v & 3 || 1, paid = v >= 4, step = kind === 1 ? 6 : kind === 2 ? 3.4 : 2.6, depth = kind === 1 ? 2.1 : 4.8;
        for (let s = 4 + step / 2; s < L - 4; s += step) {
          const cx0 = A[0] + ux * s, cz0 = A[1] + uz * s, free = clearance(cx0, cz0, rx * side, rz * side, 14), half = Math.min(r.w / 2, free - 0.3), off = half + depth / 2 + 0.1;
          if (free < half + depth + 0.2 || half < r.lane + 0.8) continue;
          const x = cx0 + rx * off * side, z = cz0 + rz * off * side; if (inBuilding(x, z, 0.4) || nearJunction(x, z, 10)) continue;
          { const lu = step >= depth, a = Math.abs(step - depth) / 2, rr = Math.min(step, depth) / 2 + 0.4, dx = lu ? ux : rx * side, dz = lu ? uz : rz * side; if (treeNear(x + dx * a, z + dz * a, rr) || treeNear(x - dx * a, z - dz * a, rr)) continue; } /* a street tree in the stall: left free */
          outline(x, z, ux, uz, step - 0.25, depth, paid ? BLUE : W);
          const h = kind === 1 ? Math.atan2(ux, uz) + (side < 0 ? Math.PI : 0) : kind === 3 ? Math.atan2(rx * side, rz * side) : Math.atan2(rx * side + ux, rz * side + uz);
          T.streetStalls.push({ x, z, h, kind, paid });
        }
      }
    }
  }
  for (const a of (T.d.a || []).filter(a => a.t === 4 && !a.ns).concat(T.d.pk || [])) { // OSM car parks, and the DBGT ones (AC_VEI 0301, tiles[t].pk) in place of those they cover (ns)
    const P = dec(a.p); if (P.length < 3) continue; if (PARK_A_MANO_STALLS.some(st => inPoly(st.x, st.z, P))) continue; /* a row drawn by hand: no stalls of the rule in this area */
    const [cx, cz] = centroid(P);
    // a car park mapped space by space keeps only those; otherwise the stalls drawn here never go past the capacity OSM gives
    const inLot = real.filter(r => inPoly(r.x, r.z, P)), capE = (T.d.pc || []).find(p => inPoly(p[0] / 10, p[1] / 10, P)), budget = inLot.length >= 3 ? 0 : capE ? Math.max(0, capE[2] - inLot.length) : 1e9;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang), nx = -uz, nz = ux, proj = P.map(([x, z]) => (x - cx) * ux + (z - cz) * uz);
    const S0 = Math.min(...proj) + 1.0, S1 = Math.max(...proj) - 1.0, lot = [];
    const ok = (s, v) => { const x = cx + ux * s + nx * v, z = cz + uz * s + nz * v; return inPoly(x, z, P) && !inBuilding(x, z, 0.3) && !onAnyRoad(x, z, -0.4) && !real.some(r => hyp(r.x - x, r.z - z) < 3); };
    /* a stall only where it is free: no wall, hedge or kerb of a bed on its rectangle, no pavement under it (the porfido of an entrance), and a free aisle (3 m) in front of it, inside the lot or on a street (via del Cimitero, Carlo 29/10: stalls in a passage between two beds, ending on the porfido of the door) */
    const barNear = (x, z, r) => { let f = false; WALLS.each(x - r - 1, z - r - 1, x + r + 1, z + r + 1, o => { if (!f && o.ax !== undefined && o.y1 - o.y0 > 0.4 && segDist(x, z, o.ax, o.az, o.bx, o.bz) < r) f = true; }); return f; };
    const stallFree = (s, v0, v1, row) => {
      const at = v => [cx + ux * s + nx * v, cz + uz * s + nz * v], vm = (v0 + v1) / 2;
      for (const ds of [-0.9, 0, 0.9]) for (const v of [v0 + 1.0, vm, v1 - 1.0]) { const x = cx + ux * (s + ds) + nx * v, z = cz + uz * (s + ds) + nz * v; if (barNear(x, z, 0.45)) return false; } /* not the ends: a fence closing the lot behind the stall is where cars park nose-in (Carlo 29/10) */
      /* no check of the kind of ground in front: a strip of pavement or a kerb between the row and the lane emptied whole rows (via Gagarin, Carlo 29/10) */
      /* but a stall boxed in, with a wall at one end and a bed or wall within 3 m past the other, has no way out (piazzetta of via Isonzo, Carlo 29/10) */
      const barAt = (v, r) => [-0.9, 0, 0.9].some(ds => barNear(cx + ux * (s + ds) + nx * v, cz + uz * (s + ds) + nz * v, r));
      const boxed = (vb, vf, d) => barAt(vb, 0.8) && [0.3, 1.3, 2.3].some(k => barAt(vf + d * k, 0.6));
      if (boxed(v0, v1, 1) || boxed(v1, v0, -1)) return false;
      return true;
    };
    const runs = [];
    for (const row of [0, 1]) {
      let run = [];
      const flush = () => { if (run.length > 1) runs.push(run); run = []; }; /* a lone stall wedged at a corner is not a car park (piazzetta of via Isonzo, Carlo 29/10) */
      for (let s = S0 + 1.25; s <= S1 - 1.25; s += 2.5) {
        const sec = lmSection(P, cx, cz, ux, uz, s), sa = lmSection(P, cx, cz, ux, uz, s - 1.2), sb = lmSection(P, cx, cz, ux, uz, s + 1.2);
        if (!sec || !sa || !sb) { flush(); continue; }
        const lo = Math.max(sec[0], sa[0], sb[0]), hi = Math.min(sec[1], sa[1], sb[1]), w = hi - lo;
        if (w < 5 || (row === 1 && w < 10.5)) { flush(); continue; }
        const v0 = row ? hi - 4.8 : lo + 0.2, v1 = row ? hi - 0.2 : lo + 4.8, vm = (v0 + v1) / 2;
        if (!ok(s, vm) || !ok(s - 0.9, vm) || !ok(s + 0.9, vm) || !stallFree(s, v0, v1, row)) { flush(); continue; }
        { const at = v => [cx + ux * s + nx * v, cz + uz * s + nz * v]; if (treeNear(...at(v0 + 1.2), 1.75) || treeNear(...at(v1 - 1.2), 1.75)) { flush(); continue; } } /* a tree of the car park in the stall: left free */
        const x = cx + ux * s + nx * vm, z = cz + uz * s + nz * vm;
        run.push({ s, v0, v1, x, z, h: Math.atan2(nx, nz) + (row ? 0 : Math.PI) }); // nose towards the aisle in the middle
      }
      flush();
    }
    let left = budget; // runs of free stalls side by side, up to the capacity: the lines between them, the yellow one every eighth
    for (const run0 of runs) {
      if (left <= 0) break; const run = run0.slice(0, left); left -= run.length; const yi = run.length >= 8 ? 1 : -1;
      run.forEach((st, k) => { const col = k === yi ? Y : W; quad(cx, cz, ux, uz, st.s - 1.31, st.s - 1.19, st.v0, st.v1, col); quad(cx, cz, ux, uz, st.s + 1.19, st.s + 1.31, st.v0, st.v1, col); if (k === yi) { quad(cx, cz, ux, uz, st.s - 0.5, st.s + 0.5, (st.v0 + st.v1) / 2 - 0.5, (st.v0 + st.v1) / 2 + 0.5, BLUE); st.dis = true; } lot.push(st); });
    }
    T.stalls.push(...lot);
    if (inLot.length >= 10) lot.push(...inLot); // the furniture below goes on the lots mapped space by space too
    if (lot.length >= 10) { // furniture on the bigger lots: lamps along the middle, the meter and the P sign at one end
      const mid = (S0 + S1) / 2, sec = lmSection(P, cx, cz, ux, uz, mid);
      for (let s = S0 + 6; s < S1 - 3; s += 22) { const sc = lmSection(P, cx, cz, ux, uz, s); if (!sc) continue; const v = (sc[0] + sc[1]) / 2, x = cx + ux * s + nx * v, z = cz + uz * s + nz * v; if (onAnyRoad(x, z, 0.5) && !onFoot(x, z) || inBuilding(x, z, 0.5)) continue; const gy = H.ground(x, z); addBox(lamps, x, gy + 3.8, z, 0.15, 7.6, 0.15, null); addBox(heads, x + ux * 0.5, gy + 7.55, z + uz * 0.5, 1.2, 0.18, 0.35, null); addBox(heads, x - ux * 0.5, gy + 7.55, z - uz * 0.5, 1.2, 0.18, 0.35, null); }
      const e = lmSection(P, cx, cz, ux, uz, S0 + 0.5);
      if (e) { const x = cx + ux * (S0 + 0.3) + nx * e[0] - nx * -0.6, z = cz + uz * (S0 + 0.3) + nz * e[0] + nz * 0.6, gy = H.ground(x, z), ry = Math.atan2(-uz, ux);
        F.geo(Bs.trim, lmBox(0.08, 2.6, 0.08, x, gy + 1.3, z), null, COL('#8a8f95'));
        const i0 = sign.p.length / 3; for (const [dx, dy, u, v] of [[-0.35, 2.2, 0, 0], [0.35, 2.2, 1, 0], [0.35, 2.9, 1, 1], [-0.35, 2.9, 0, 1]]) vtx(sign, x + nx * dx, gy + dy, z + nz * dx, ux, 0, uz, u, v); sign.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        const mx = x + nx * 1.5, mz = z + nz * 1.5; F.geo(Bs.trim, lmBox(0.3, 1.5, 0.25, 0, 0, 0).rotateY(ry).translate(mx, gy + 0.75, mz), null, COL('#3c4650')); F.geo(Bs.trim, lmBox(0.32, 0.25, 0.27, 0, 0, 0).rotateY(ry).translate(mx, gy + 1.5, mz), null, COL('#e2b436')); } // parking meter
    }
  }
  if (b.i.length) mkMesh(b, PLAT_MAT.line, 5, false, G);
  if (Bs.trim.i.length) mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  if (lamps.i.length) { mkMesh(lamps, MAT.lamp, 10, 'cast', G); mkMesh(heads, MAT.lampHead, 10, false, G); }
  if (sign.i.length) mkMesh(sign, PSIGN_MAT, 10, false, G);
}
// the benches and bins of the parks: one instance each, the models of oggetti3.js, knocked down like the street lamps; built again, a fallen one
// stays down (as the lamps)
const PARK_PROPS = new Map();
function parkProps(G, k, list) {
  if (!list.length) return;
  const S = OGG_SPEC[k], im = new THREE.InstancedMesh(OGG_GEO[k], OGG_MAT, list.length), o3 = new THREE.Object3D(); im.castShadow = true; im.receiveShadow = true;
  list.forEach(([x, z, a, gy], i) => {
    o3.position.set(x, gy, z); o3.rotation.set(0, a, 0); o3.scale.set(1, 1, 1); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix);
    const key = k + ':' + x.toFixed(1) + ',' + z.toFixed(1), p = PARK_PROPS.get(key);
    if (!p) PARK_PROPS.set(key, addProp({ x, z, y: gy, r: S.r, h: S.h, inst: { meshes: [im], i, ry: a, base: gy } }));
    else { p.inst.meshes = [im]; p.inst.i = i; if (p.broken) { o3.scale.set(0, 0, 0); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); } }
  });
  G.add(im);
}
// park furniture: along the footpaths inside parks and gardens, benches every so often (on alternate sides) and lamp posts, a bin by each bench;
// a flower bed fills the middle of a small round plaza where paths meet
function buildParkFurniture(T, G) {
  const parks = (T.d.a || []).filter(a => a.t === 2).map(a => { const o = dec(a.p); return { o, bb: bbox(o) }; }).filter(p => p.o.length >= 3);
  if (!parks.length) return;
  const inPark = (x, z, m = 8) => parks.some(p => { // inside a park or garden, or along its edge
    if (x < p.bb[0] - m || x > p.bb[2] + m || z < p.bb[1] - m || z > p.bb[3] + m) return false; if (inPoly(x, z, p.o)) return true;
    for (let i = 0; i < p.o.length; i++) { const A = p.o[i], C = p.o[(i + 1) % p.o.length]; if (segDist(x, z, A[0], A[1], C[0], C[1]) < m) return true; } return false; });
  const F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf() }, lamps = Buf(), heads = Buf(), benches = [], bins = [];
  const x0 = T.cx - TS / 2, z0 = T.cz - TS / 2;
  for (const r of D.roads) {
    if (r.c !== 6 || r.d || r.t) continue;
    let acc = 0, k = 0;
    for (let i = 1; i < r.g.length; i++) {
      const A = N[r.g[i - 1]], C = N[r.g[i]], Ln = hyp(C[0] - A[0], C[1] - A[1]); if (Ln < 0.5) continue;
      const ux = (C[0] - A[0]) / Ln, uz = (C[1] - A[1]) / Ln, nx = -uz, nz = ux, ry = Math.atan2(-uz, ux);
      for (let s = (12 - acc % 12); s < Ln; s += 12) {
        const x = A[0] + ux * s, z = A[1] + uz * s; k++;
        if (x < x0 || x >= x0 + TS || z < z0 || z >= z0 + TS || !inPark(x, z)) continue;
        const sd = k % 2 ? 1 : -1, off = r.w / 2 + 0.9, bx = x + nx * off * sd, bz = z + nz * off * sd, gy = H.ground(bx, bz);
        if (inBuilding(bx, bz, 1.2) || onAnyRoad(bx, bz, 0.2) && !onFoot(bx, bz)) continue;
        if (k % 3) { // bench facing the path, a bin beside it: both knocked down like the street lamps (parkProps)
          const R = ry + (sd > 0 ? Math.PI : 0), qx = bx + Math.cos(R) * 1.4, qz = bz - Math.sin(R) * 1.4;
          benches.push([bx, bz, R, gy]); bins.push([qx, qz, R, H.ground(qx, qz)]);
        } else { addBox(lamps, bx, gy + 2.0, bz, 0.11, 4.0, 0.11, null); addBox(heads, bx, gy + 4.05, bz, 0.42, 0.22, 0.42, null); } // park lamp
      }
      acc += Ln;
    }
  }
  for (const r of D.roads) { // small closed loops of path (a round plaza): a raised bed of flowers inside
    if (r.c !== 6 || r.g.length < 8 || r.g[0] !== r.g[r.g.length - 1]) continue;
    const pts = r.g.map(i => N[i]), [cx, cz] = centroid(pts.slice(0, -1)), rad = Math.min(...pts.map(p => hyp(p[0] - cx, p[1] - cz))) - r.w / 2 - 0.3;
    if (rad < 1.5 || rad > 9 || tileOf(cx, cz) !== T.t || !inPark(cx, cz, 14) || onAnyRoad(cx, cz, 0) && !onFoot(cx, cz)) continue;
    const gy = H.ground(cx, cz);
    F.geo(Bs.trim, new THREE.CylinderGeometry(rad, rad, 0.4, 28).translate(cx, gy + 0.2, cz), null, COL('#bcb6aa'));
    F.geo(Bs.trim, new THREE.CylinderGeometry(rad - 0.25, rad - 0.25, 0.1, 28).translate(cx, gy + 0.42, cz), null, COL('#5d4632'));
    for (let i = 0; i < 40; i++) { const a = i * 2.4, d = (rad - 0.6) * Math.sqrt((i + 0.5) / 40); F.geo(Bs.trim, new THREE.IcosahedronGeometry(0.28, 0).translate(cx + Math.cos(a) * d, gy + 0.6, cz + Math.sin(a) * d), null, COL(['#d8364a', '#f0c23a', '#e87ab0', '#ffffff', '#5f8f3a'][i % 5])); }
  }
  parkProps(G, 'panchina', benches); parkProps(G, 'cestino', bins);
  if (Bs.trim.i.length) mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  if (lamps.i.length) { mkMesh(lamps, MAT.lamp, 10, 'cast', G); mkMesh(heads, MAT.lampHead, 10, false, G); }
}
