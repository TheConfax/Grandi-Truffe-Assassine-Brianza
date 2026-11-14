// ---------------------------------------------------------------- realismo 3, fase E: the street lived in, with no people (Carlo 13/11). Walkers and cars are not touched
//  - bicycles in the bike racks of the data (OSM bicycle_parking): one to four each, of a few colours; they fall over when hit, like the other street objects;
//  - the wheelie bins of the blocks of flats (Brianza collects door to door: no big street bins): two or three beside the entrance of some palazzine and condomini
//    (family 3 and 4 of famiglie.py, a door of the data), against the wall, never on a carriageway; they tip over too;
//  - the drop wires from the poles (OSM and Mapillary poles) to the nearest houses, sagging;
//  - TV antennas on the roofs of the houses, by the chimney, and here and there a dish turned to the satellite (south, 37 degrees up): kit3.js kitAntenne.
// &strada=0 turns them off
const STRADA3 = window.__STRADA3 = { on: !/[?&]strada=0/.test(location.search), bici: 0, bidoni: 0, cavi: 0, antenne: 0, parabole: 0 };
{
  const F = lmFrame(new THREE.Matrix4()), up = new THREE.Vector3(0, 1, 0);
  const box = (b, w, h, d, x, y, z, col, ry = 0) => F.geo(b, lmBox(w, h, d, x, y, z, ry), null, COL(col));
  const rod = (b, a, c, r, col) => { const v = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = v.length(); const g = new THREE.CylinderGeometry(r, r, L, 4).translate(0, L / 2, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, v.normalize()))); F.geo(b, g.translate(a[0], a[1], a[2]), null, COL(col)); };
  const mk = f => { const b = Buf(); f(b); const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.setIndex(b.i); g.computeBoundingSphere(); return g; };
  /* a city bike, 1.75 m long along x, wheels of 0.68 m: two rings of rods, the frame, saddle, bars, a basket on some */
  const bici = (col, cesto) => b => {
    for (const cx of [-0.53, 0.53]) for (let k = 0; k < 14; k++) { const a0 = k / 14 * TAU, a1 = (k + 1) / 14 * TAU; rod(b, [cx + Math.cos(a0) * 0.34, 0.34 + Math.sin(a0) * 0.34, 0], [cx + Math.cos(a1) * 0.34, 0.34 + Math.sin(a1) * 0.34, 0], 0.018, '#1e1f21'); }
    const P = { bb: [0, 0.34, 0], sd: [-0.12, 0.85, 0], hd: [0.45, 0.82, 0], fr: [0.53, 0.34, 0], rr: [-0.53, 0.34, 0] };
    for (const [a, c] of [['bb', 'sd'], ['bb', 'hd'], ['sd', 'hd'], ['bb', 'rr'], ['sd', 'rr'], ['hd', 'fr']]) rod(b, P[a], P[c], 0.02, col);
    box(b, 0.24, 0.05, 0.1, -0.14, 0.9, 0, '#1b1b1b'); rod(b, [0.45, 0.82, 0], [0.42, 1.0, 0], 0.016, '#9a9ea3'); rod(b, [0.42, 1.0, -0.27], [0.42, 1.0, 0.27], 0.014, '#9a9ea3');
    if (cesto) box(b, 0.3, 0.2, 0.34, 0.62, 0.92, 0, '#3a3b3d');
  };
  const BICI_COL = ['#2c4f7a', '#7a2a2a', '#d8d4cb', '#1f1f22', '#3f6a4a', '#8a8f94'];
  BICI_COL.forEach((c, i) => { const k = 'bici' + i; OGG_KINDS.push(k); OGG_GEO[k] = mk(bici(c, i % 3 === 1)); OGG_SPEC[k] = { r: 0.3, h: 1.0, knock: true }; });
  /* a 240 l wheelie bin, 0.58 x 0.73 m, 1.07 m high: body, lid, two wheels behind; the colours of the door-to-door collection */
  const bidone = (col) => b => { box(b, 0.56, 0.95, 0.7, 0, 0.5, 0, col); box(b, 0.6, 0.06, 0.76, 0, 1.0, 0.01, col); box(b, 0.6, 0.05, 0.06, 0, 0.98, 0.39, '#2a2b2d'); for (const x of [-0.24, 0.24]) box(b, 0.06, 0.2, 0.2, x, 0.1, -0.38, '#1e1f21'); };
  const BID_COL = ['#5d6166', '#6b4a2e', '#2f5d8a', '#2e6b3a', '#c9a227'];
  BID_COL.forEach((c, i) => { const k = 'bidone' + i; OGG_KINDS.push(k); OGG_GEO[k] = mk(bidone(c)); OGG_SPEC[k] = { r: 0.42, h: 1.05, knock: true }; });
}
/* the new things go into the tile's list of street objects (T.d.og, once per load of the tile): buildOggetti draws them, with their collisions and their falls */
function strada3Aggiungi(T) {
  const d = T.d; if (!STRADA3.on || !d || d === NOD || d._r3e) return; d._r3e = true;
  const og = d.og || (d.og = []), K = k => OGG_KINDS.indexOf(k), rack = K('rastrelliera'), add = (k, x, z, a) => og.push([K(k), Math.round(x * 10), Math.round(z * 10), a, 0]);
  const n0 = og.length;
  for (let i = 0; i < n0; i++) { const o = og[i]; if (o[0] !== rack) continue; const x = o[1] / 10, z = o[2] / 10, a = o[3] || 0, nb = 1 + Math.floor(trHash(x, z) * 4);
    for (let s = 0; s < nb; s++) { const slot = -2 + Math.floor(trHash(x + s, z - s) * 5), dx = slot * 0.7 + 0.35 * (slot < 2 ? 1 : -1); add('bici' + Math.floor(trHash(z + s, x) * 6), x + dx * Math.cos(a), z - dx * Math.sin(a), a + Math.PI / 2 + (trHash(s, x) - 0.5) * 0.15); STRADA3.bici++; } }
  /* the bins of the blocks of flats: by some doors of the data (dr: X0, Z0, X1, Z1, kind, height) */
  for (const [X0, Z0, X1, Z1] of d.dr || []) {
    const ax = X0 / 10, az = Z0 / 10, bx = X1 / 10, bz = Z1 / 10, L = hyp(bx - ax, bz - az); if (L < 0.5) continue;
    const ux = (bx - ax) / L, uz = (bz - az) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2; let nx = -uz, nz = ux; if (inBuilding(mx + nx * 0.6, mz + nz * 0.6, 0)) { nx = -nx; nz = -nz; }
    const B = T.bld.find(q => q.bb && inPlan(q, mx - nx * 0.4, mz - nz * 0.4)); if (!B || (B.fa !== 3 && B.fa !== 4) || trHash(mx * 1.3, mz * 0.7) > 0.4) continue;
    const sd = trHash(mz, mx) < 0.5 ? -1 : 1, nb = 2 + Math.floor(trHash(mx + 7, mz) * 2);
    for (let s = 0; s < nb; s++) { const off = L / 2 + 0.9 + s * 0.72, x = mx + ux * off * sd + nx * 0.5, z = mz + uz * off * sd + nz * 0.5;
      if (onAnyRoad(x, z, 0.3) || inBuilding(x, z, 0.1)) break; add('bidone' + [0, 1, 2, 3, 4][Math.floor(trHash(x * 3, z) * 5)], x, z, Math.atan2(nx, nz) + Math.PI); STRADA3.bidoni++; } /* the lid's hinge to the wall */
  }
}
{ const bo = buildOggetti; buildOggetti = function (T, G) { strada3Aggiungi(T); return bo(T, G); }; }
// the drop wires: from the top of each pole to the nearest one or two houses within 18 m, sagging 4%
const CAVI_MAT = new THREE.LineBasicMaterial({ color: 0x26282a });
function buildCavi(T, G) {
  if (!STRADA3.on || !T.d.og) return; const palo = OGG_KINDS.indexOf('palo'), wp = [];
  const blds = [T, ...vicini(T)].flatMap(U => U && U.bld ? U.bld : []);
  for (const o of T.d.og) {
    if (o[0] !== palo) continue; const x = o[1] / 10, z = o[2] / 10, gy = H.surface(x, z), y0 = gy + 8.4; const got = [];
    for (const B of blds) { if (!B.pts || B.st === 2 || B.fa === 5 || B.fa === 0) continue; let best = null;
      for (let i = 0; i < B.pts.length; i++) { const p = B.pts[i], q = B.pts[(i + 1) % B.pts.length], ex = q[0] - p[0], ez = q[1] - p[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - p[0]) * ex + (z - p[1]) * ez) / L2, 0.15, 0.85), cx = p[0] + ex * t, cz = p[1] + ez * t, dd = hyp(cx - x, cz - z); if (dd > 3 && dd < 18 && (!best || dd < best[2])) best = [cx, cz, dd]; }
      if (best) got.push([best, B]); }
    got.sort((a, b) => a[0][2] - b[0][2]);
    for (const [[cx, cz, dd], B] of got.slice(0, trHash(x, z) < 0.5 ? 1 : 2)) {
      const y1 = Math.min(bldTop(B) - 0.6, H.ground(cx, cz) + 6.5); if (y1 < gy + 3) continue; const sag = 0.04 * dd;
      let px = x, py = y0, pz = z; for (let k = 1; k <= 8; k++) { const t = k / 8, qx = x + (cx - x) * t, qz = z + (cz - z) * t, qy = y0 + (y1 - y0) * t - sag * 4 * t * (1 - t); wp.push(px, py, pz, qx, qy, qz); px = qx; py = qy; pz = qz; }
      STRADA3.cavi++;
    }
  }
  if (wp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); G.add(new THREE.LineSegments(g, CAVI_MAT)); }
}
