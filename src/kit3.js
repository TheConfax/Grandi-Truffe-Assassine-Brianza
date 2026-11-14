// ---------------------------------------------------------------- realismo 3, fase B: the kit of the houses (Carlo 13/11: "case a scatola")
// Generic pieces by the kind of building (the family of src/famiglie.py, b.fa, and the epoch), never a style made up for one house:
//  - eaves: the pitches of the roof go on past the walls (overhang O, falling with the slope of the pitch; flat past a gable), with a fascia of thickness Th
//    and a soffit under it; not over a wall another building stands against. Old courtyard houses: wooden rafters, a deep overhang; villette and palazzine:
//    a plastered slab, a cornice on the palazzine; sheds and warehouses: a short sheet edge. A gutter along the eaves and a downpipe at the end of the long ones;
//  - chimneys on the pitched roofs of the houses (one per about 120 m2 of roof, near the ridge), plastered or brick, with a cap; solid for the walker on the roof;
//  - the flat roofs of houses and offices: a coping on the parapet.
// All in the buffer of the roofs (vertex colours, MAT.roof: the coppi of materiali3.js lie on the eaves too). &kit=0 turns it off
const KIT = window.__KIT = { on: !/[?&]kit=0/.test(location.search), gronde: 0, comignoli: 0, cimase: 0 };
const KIT_ST = { /* by family (famiglie.py): O overhang, Th fascia, fascia and soffit colours, gutter colour, chimneys per m2 (0: none) */
  0: { O: 0.25, Th: 0.1, fc: '#8d8a84', sc: '#7d7a74', gc: '#8f9294', ch: 0 },
  1: { O: 0.6, Th: 0.18, fc: null, sc: null, gc: '#6e5a48', ch: 1 / 120 },
  2: { O: 0.8, Th: 0.12, fc: '#5d4330', sc: '#4a3526', gc: '#7a5a40', ch: 1 / 90, brick: true },
  3: { O: 0.7, Th: 0.28, fc: null, sc: null, gc: '#8f9294', ch: 1 / 150 },
  4: { O: 0.6, Th: 0.28, fc: null, sc: null, gc: '#8f9294', ch: 1 / 200 },
  5: { O: 0.3, Th: 0.12, fc: '#9a9c9e', sc: '#8a8c8e', gc: '#9a9c9e', ch: 0 },
  6: { O: 0.35, Th: 0.2, fc: null, sc: null, gc: '#8f9294', ch: 0 },
};
const _kc = new THREE.Color();
function kitQuad(b, P, n, col) { const i0 = b.p.length / 3; for (const p of P) vtx(b, p[0], p[1], p[2], n[0], n[1], n[2], 0, 0, col); b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); }
function kitCasa(b, B, outer, holes, top, planes, pitched, t, wallCol, raised, roofCol) {
  if (!KIT.on || B.st === 2 || B.cu || !outer || outer.length < 3) return;
  const fa = B.fa !== undefined ? B.fa : t === 1 || t === 2 ? 5 : 1, st = KIT_ST[fa] || KIT_ST[1], hr = n => hashRnd((B.bi || 0) * 7.13 + (outer[0][0] * 0.37 + outer[0][1] * 1.13) + n * 3.71);
  const wc = wallCol ? wallCol.clone() : new THREE.Color(0xe8e2d6);
  const fcol = st.fc ? COL(st.fc) : wc.clone().lerp(new THREE.Color(1, 1, 1), 0.35), scol = st.sc ? COL(st.sc) : wc.clone().multiplyScalar(0.82), gcol = COL(st.gc);
  const n = outer.length, ccw = sArea(outer) > 0;
  const nrm = (a, c) => { const dx = c[0] - a[0], dz = c[1] - a[1], L = hyp(dx, dz) || 1; let nx = dz / L, nz = -dx / L; const mx = (a[0] + c[0]) / 2 + nx * 0.05, mz = (a[1] + c[1]) / 2 + nz * 0.05; if (inPoly(mx, mz, outer)) { nx = -nx; nz = -nz; } return [nx, nz, L, dx / L, dz / L]; };
  if (pitched || planes) {
    /* the height of the roof over a point, relative to top: the planes of the data (min of them), or the pyramid of the old engine (face by face) */
    const pl = planes ? roofPlanes(B) : null, rc = B.rc, cen = planes ? null : centroid(outer), rh = planes ? 0 : bldPitch(B);
    const raw = (x, z) => { let m = Infinity; for (const p of pl) m = Math.min(m, p[0] + p[1] * (x - rc[0]) + p[2] * (z - rc[1])); return m; };
    const E = []; for (let i = 0; i < n; i++) { const a = outer[i], c = outer[(i + 1) % n]; E.push(nrm(a, c)); }
    const rows = [], free = (x, z) => !inBuilding(x, z, 0) && !inPoly(x, z, outer);
    for (let i = 0; i < n; i++) {
      const a0 = outer[i], c0 = outer[(i + 1) % n], [nx, nz, L0, ux, uz] = E[i]; if (L0 < 1.2) { rows.push(null); continue; } /* a jog of the plan: no eave sticking out like a plank */
      /* the stretch of the edge whose eave stays in the air: from each end, while the eave's outer edge would go into another building (or this one, at an inside corner), it is cut back
         (Carlo 13/11: the bits of eave sticking into the junctions of two roofs) */
      const O = st.O, okAt = t => free(a0[0] + ux * L0 * t + nx * (O + 0.05), a0[1] + uz * L0 * t + nz * (O + 0.05)) && free(a0[0] + ux * L0 * t + nx * 0.25, a0[1] + uz * L0 * t + nz * 0.25);
      const stp = Math.min(0.5, L0 / 4) / L0; let t0 = 0, t1 = 1; while (t0 < 1 && !okAt(Math.min(t0 + 0.02, 1))) t0 += stp; while (t1 > t0 && !okAt(Math.max(t1 - 0.02, 0))) t1 -= stp;
      if ((t1 - t0) * L0 < 1.0 || !okAt((t0 + t1) / 2)) { rows.push(null); continue; }
      const a = [a0[0] + ux * L0 * t0, a0[1] + uz * L0 * t0], c = [a0[0] + ux * L0 * t1, a0[1] + uz * L0 * t1], L = (t1 - t0) * L0, mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      let ya, yc, s;
      if (pl) { ya = Math.max(0, raw(a[0], a[1])); yc = Math.max(0, raw(c[0], c[1])); s = clamp((raw(mx, mz) - raw(mx + nx * 0.5, mz + nz * 0.5)) / 0.5, 0, 2); }
      else { ya = yc = 0; const d0 = Math.abs((cen[0] - a[0]) * nx + (cen[1] - a[1]) * nz) || 1; s = rh / d0; }
      const dy = O * s, P = [[a[0], top + ya, a[1]], [c[0], top + yc, c[1]], [c[0] + nx * O, top + yc - dy, c[1] + nz * O], [a[0] + nx * O, top + ya - dy, a[1] + nz * O]];
      const ny = Math.hypot(s, 1), up = [nx * s / ny, 1 / ny, nz * s / ny];
      kitQuad(b, P, up, roofCol || COL('#b0523a')); /* the eave: the pitch going on, coppi and all */
      /* a gutter only along an eave line: the roof falls away from the wall (s) and the edge is level (not a gable, whose roof line climbs along it) */
      const gut = fa !== 0 && s > 0.12 && Math.abs(ya - yc) / L < 0.04;
      rows.push({ a, c, nx, nz, ux, uz, L, ya, yc, dy, s, P, gut, full0: t0 < 1e-6, full1: t1 > 1 - 1e-6 });
    }
    for (let i = 0; i < n; i++) { const r = rows[i]; if (!r) continue; KIT.gronde++;
      const [, , pc, pd] = r.P, Th = st.Th, O = st.O;
      kitQuad(b, [pd, pc, [pc[0], pc[1] - Th, pc[2]], [pd[0], pd[1] - Th, pd[2]]], [r.nx, 0, r.nz], fcol); /* fascia */
      kitQuad(b, [[pd[0], pd[1] - Th, pd[2]], [pc[0], pc[1] - Th, pc[2]], [r.c[0], top + r.yc - Th, r.c[1]], [r.a[0], top + r.ya - Th, r.a[1]]], [0, -1, 0], scol); /* soffit */
      if (!r.gut) continue;
      /* the gutter: hung just under the tiles at the outer edge of the eave, from end to end of it; at a corner it goes on to meet the next gutter only where an eave
         line turns round it (a hip), otherwise it stops where the eave stops. A downpipe at one end: down from the gutter to the wall corner and along it to the ground */
      const pv = rows[(i - 1 + n) % n], nx_ = rows[(i + 1) % n], cv = (r0, r1) => { const crs = r0.ux * r1.uz - r0.uz * r1.ux; return (ccw ? crs : -crs) > 0.05; };
      const e0 = pv && pv.gut && r.full0 && pv.full1 && cv(pv, r) ? O : 0, e1 = nx_ && nx_.gut && r.full1 && nx_.full0 && cv(r, nx_) ? O : 0, sh = (e1 - e0) / 2;
      const gy = (pc[1] + pd[1]) / 2 - 0.06, gx = (pc[0] + pd[0]) / 2 + r.nx * 0.05 + r.ux * sh, gz = (pc[2] + pd[2]) / 2 + r.nz * 0.05 + r.uz * sh;
      addBox(b, gx, gy, gz, r.L + e0 + e1, 0.1, 0.11, gcol, Math.atan2(-r.uz, r.ux)); KIT.grondaie = (KIT.grondaie || 0) + 1;
      if (r.L > 5 && !raised && !e0) { /* the downpipe at the end a, where the gutter ends (at a hip corner the next gutter's end takes it) */
        const wx = r.a[0] + r.nx * 0.1 + r.ux * 0.18, wz = r.a[1] + r.nz * 0.1 + r.uz * 0.18, g0 = H.ground(wx, wz), y1 = gy - 0.05;
        if (y1 - g0 > 1.5 && y1 - g0 < 40 && !inBuilding(wx, wz, 0)) {
          addBox(b, wx, (g0 + y1) / 2, wz, 0.08, y1 - g0, 0.08, gcol); /* down the wall */
          const ox = wx + r.nx * (O - 0.05) / 2, oz = wz + r.nz * (O - 0.05) / 2; addBox(b, ox, y1, oz, 0.08, 0.08, O - 0.05, gcol, Math.atan2(-r.uz, r.ux)); /* the elbow under the eave, out to the gutter */
          KIT.pluviali = (KIT.pluviali || 0) + 1;
        }
      }
    }
    /* the corners: the triangle between two eaves that meet outside, both whole to the corner */
    for (let i = 0; i < n; i++) { const r0 = rows[(i - 1 + n) % n], r1 = rows[i]; if (!r0 || !r1 || !r0.full1 || !r1.full0) continue; const crs = r0.ux * r1.uz - r0.uz * r1.ux; if ((ccw ? crs : -crs) <= 0.05) continue;
      const p = r1.P[0], q0 = r0.P[2], q1 = r1.P[3], i0 = b.p.length / 3, col = roofCol || COL('#b0523a');
      for (const v of [p, q0, q1]) vtx(b, v[0], v[1], v[2], 0, 1, 0, 0, 0, col); b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 1);
      kitQuad(b, [q0, q1, [q1[0], q1[1] - st.Th, q1[2]], [q0[0], q0[1] - st.Th, q0[2]]], [(r0.nx + r1.nx) / 2, 0, (r0.nz + r1.nz) / 2], fcol);
      const j0 = b.p.length / 3; for (const v of [[p[0], p[1] - st.Th, p[2]], [q0[0], q0[1] - st.Th, q0[2]], [q1[0], q1[1] - st.Th, q1[2]]]) vtx(b, v[0], v[1], v[2], 0, -1, 0, 0, 0, scol); b.i.push(j0, j0 + 1, j0 + 2, j0, j0 + 2, j0 + 1);
    }
    /* chimneys near the ridge */
    const area = Math.abs(sArea(outer));
    if (st.ch > 0 && area > 30) {
      const want = Math.min(4, Math.max(1, Math.round(area * st.ch))), bb = outer.reduce((q, p) => [Math.min(q[0], p[0]), Math.min(q[1], p[1]), Math.max(q[2], p[0]), Math.max(q[3], p[1])], [1e9, 1e9, -1e9, -1e9]);
      const yAt = (x, z) => pl ? Math.max(0, raw(x, z)) : (() => { let m = Infinity; for (let i = 0; i < n; i++) { const a = outer[i], [nx, nz] = E[i], d = -((x - a[0]) * nx + (z - a[1]) * nz), d0 = Math.abs((cen[0] - a[0]) * nx + (cen[1] - a[1]) * nz) || 1; m = Math.min(m, rh * d / d0); } return Math.max(0, m); })();
      const ymax = Math.max(...outer.map(() => 0), ...Array.from({ length: 9 }, (_, k) => yAt(bb[0] + (bb[2] - bb[0]) * (0.25 + 0.25 * (k % 3)), bb[1] + (bb[3] - bb[1]) * (0.25 + 0.25 * Math.floor(k / 3)))));
      const got = [];
      for (let k = 0; k < 24 && got.length < want; k++) {
        const x = bb[0] + (bb[2] - bb[0]) * hr(k * 2 + 1), z = bb[1] + (bb[3] - bb[1]) * hr(k * 2 + 2);
        if (!inPoly(x, z, outer) || holes.some(h => inPoly(x, z, h)) || outer.some((p, i) => segDist(x, z, p[0], p[1], outer[(i + 1) % n][0], outer[(i + 1) % n][1]) < 1.0)) continue;
        const y = yAt(x, z); if (ymax > 0.5 && y < ymax * 0.6) continue; if (got.some(([gx, gz]) => hyp(gx - x, gz - z) < 4)) continue;
        got.push([x, z]);
        const w = st.brick ? 0.62 : 0.5, y0 = top + y - 0.4, hgt = Math.max(0.9, ymax - y + 0.9) + 0.4, ry = Math.atan2(-E[0][4], E[0][3]), cc = st.brick && hr(k + 40) < 0.5 ? COL('#9a5a44') : wc.clone().multiplyScalar(0.92);
        addBox(b, x, y0 + hgt / 2, z, w, hgt, w, cc, ry); addBox(b, x, y0 + hgt + 0.1, z, w * 0.55, 0.2, w * 0.55, COL('#5a5652'), ry); addBox(b, x, y0 + hgt + 0.23, z, w + 0.16, 0.06, w + 0.16, cc.clone().multiplyScalar(0.85), ry);
        if (!B._kitW) WALLS.add(x - 0.5, z - 0.5, x + 0.5, z + 0.5, { r: w * 0.6, x, z, y0: y0, y1: y0 + hgt + 0.3 }); /* the walker on the roof stops against it */
        KIT.comignoli++;
      }
      if (fa >= 1 && fa <= 4) { const [ax, az] = got.length ? [got[0][0] + 0.8, got[0][1] + 0.3] : centroid(outer); if (inPoly(ax, az, outer)) kitAntenne(b, ax, az, top + yAt(ax, az), fa, hr(90), hr(91)); } /* the TV aerial by the chimney (realismo 3, fase E) */
    }
  } else if (fa >= 1 && fa !== 5) { /* a flat roof: the coping of the parapet */
    const cc = COL('#b8b6b0');
    for (let i = 0; i < n; i++) { const a = outer[i], c = outer[(i + 1) % n], [nx, nz, L, ux, uz] = nrm(a, c); if (L < 0.4) continue;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; if (inBuilding(mx + nx * 0.3, mz + nz * 0.3, 0)) continue;
      addBox(b, mx + nx * 0.03, top + 0.06, mz + nz * 0.03, L + 0.06, 0.12, 0.3, cc, Math.atan2(-uz, ux)); KIT.cimase++; }
    if (fa >= 1 && fa <= 4 && Math.abs(sArea(outer)) > 40) { const [ax, az] = centroid(outer); if (inPoly(ax, az, outer)) kitAntenne(b, ax, az, top, fa, hr(90), hr(91)); }
  }
  B._kitW = true;
}
// the plinth (zoccolo) in 3D: the band the facade paints darker under the plinth's top (FAC.ZH over the floor), 2.5 cm out of the wall, from under the ground to its top;
// not across the doors (R.dr) and the shop fronts (R.vt), not under a garage door (there the facade has no plinth). Old courtyard houses: stone; the others: the plaster, darker
function kitZoccolo(b, B, ax, az, cx, cz, nx, nz, s0, s1, yTop, R, wallCol) {
  if (!KIT.on || s1 - s0 < 0.3) return;
  const cut = []; for (const [sc, w] of R.dr || []) cut.push([sc - w / 2 - 0.08, sc + w / 2 + 0.08]); for (const v of R.vt || []) cut.push([v[0], v[1]]);
  cut.sort((p, q) => p[0] - q[0]); let segs = [[s0, s1]];
  for (const [c0, c1] of cut) segs = segs.flatMap(([p0, p1]) => c1 <= p0 || c0 >= p1 ? [[p0, p1]] : [[p0, Math.max(p0, c0)], [Math.min(p1, c1), p1]].filter(([q0, q1]) => q1 - q0 > 0.3));
  const col = B.fa === 2 ? COL('#b3ab9c') : (wallCol ? wallCol.clone().multiplyScalar(0.74) : COL('#a8a49a')), D = 0.025;
  for (const [p0, p1] of segs) {
    const t0 = (p0 - s0) / (s1 - s0), t1 = (p1 - s0) / (s1 - s0), A = [ax + (cx - ax) * t0, az + (cz - az) * t0], C = [ax + (cx - ax) * t1, az + (cz - az) * t1];
    const ga = H.ground(A[0], A[1]), gc = H.ground(C[0], C[1]); if (yTop - Math.max(ga, gc) < 0.12 || yTop - Math.min(ga, gc) > 2.5) continue; /* no plinth where the floor is at the ground (a garage door), none on a wall far over it */
    const Ao = [A[0] + nx * D, A[1] + nz * D], Co = [C[0] + nx * D, C[1] + nz * D];
    kitQuad(b, [[Ao[0], ga - 0.25, Ao[1]], [Co[0], gc - 0.25, Co[1]], [Co[0], yTop, Co[1]], [Ao[0], yTop, Ao[1]]], [nx, 0, nz], col);
    kitQuad(b, [[A[0], yTop, A[1]], [C[0], yTop, C[1]], [Co[0], yTop, Co[1]], [Ao[0], yTop, Ao[1]]], [0, 1, 0], col);
    KIT.zoccoli = (KIT.zoccoli || 0) + 1;
  }
}
// the TV aerial: a mast 2-3 m over the roof, one or two Yagi booms turned to the south-west (the transmitters of the Po valley side), and on some roofs a dish turned to
// the satellite (Hot Bird from Brianza: almost due south, 37 degrees up) on a short arm. Generic, as on most Italian roofs; &strada=0 off
function kitAntenne(b, x, z, y, fa, h1, h2) {
  if (typeof STRADA3 === 'undefined' || !STRADA3.on) return;
  const ant = COL('#9ea3a8'), hm = 2.0 + h1 * 1.2, az = Math.PI * 1.25 + (h2 - 0.5) * 0.4; /* boom direction: south-west, more or less */
  addBox(b, x, y + hm / 2 - 0.2, z, 0.045, hm + 0.4, 0.045, ant);
  const ux = Math.cos(az), uz = Math.sin(az), ry = Math.atan2(-uz, ux);
  for (const [yy, L] of h1 < 0.5 ? [[y + hm - 0.05, 1.5]] : [[y + hm - 0.05, 1.5], [y + hm - 0.75, 0.9]]) {
    addBox(b, x + ux * L * 0.3, yy, z + uz * L * 0.3, L, 0.025, 0.025, ant, ry);
    for (let k = 0; k < Math.round(L / 0.2); k++) { const t = -0.2 + k * 0.2, ex = x + ux * (t + L * 0.3 - L * 0.5 + 0.2), ez = z + uz * (t + L * 0.3 - L * 0.5 + 0.2), w = 0.48 - k * 0.025; addBox(b, ex, yy, ez, 0.015, 0.015, w, ant, ry); }
  }
  STRADA3.antenne++;
  if (h2 < (fa >= 3 ? 0.55 : 0.3)) { /* a dish */
    const dx = x + 0.7, dz = z + 0.4, dy = y + 0.9, n = new THREE.Vector3(0.07, 0.6, 0.8).normalize(), e1 = new THREE.Vector3().crossVectors(n, new THREE.Vector3(0, 1, 0)).normalize(), e2 = new THREE.Vector3().crossVectors(e1, n), R = 0.4, col = COL('#dcdcd8');
    addBox(b, dx, y + 0.45, dz, 0.04, 1.0, 0.04, ant);
    const c0 = b.p.length / 3; vtx(b, dx - n.x * 0.08, dy - n.y * 0.08, dz - n.z * 0.08, n.x, n.y, n.z, 0, 0, col);
    for (let k = 0; k <= 12; k++) { const a = k / 12 * TAU, px = dx + (e1.x * Math.cos(a) + e2.x * Math.sin(a)) * R, py = dy + (e1.y * Math.cos(a) + e2.y * Math.sin(a)) * R, pz = dz + (e1.z * Math.cos(a) + e2.z * Math.sin(a)) * R; vtx(b, px, py, pz, n.x, n.y, n.z, 0, 0, col); }
    for (let k = 0; k < 12; k++) b.i.push(c0, c0 + 1 + k, c0 + 2 + k, c0, c0 + 2 + k, c0 + 1 + k);
    addBox(b, dx + n.x * 0.35, dy + n.y * 0.35, dz + n.z * 0.35, 0.06, 0.06, 0.06, COL('#3a3b3d')); STRADA3.parabole++; /* the head */
  }
}
