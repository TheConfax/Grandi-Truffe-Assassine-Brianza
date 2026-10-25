// ---------------------------------------------------------------- the aiuole of the roundabouts (docs/rotonde.md, src/rotonde.py)
// tiles[t].ro, one per roundabout of Meda that has something over the plain island: the ring (cobbles from a CC0 photo, Poly Haven
// rock_embedded_concrete, recoloured to the cobbles in Carlo's photo of via Cadorna; or concrete), the lawn behind its low inner kerb, the
// crescent beds edged in white stone (red flowers, low shrubs or bare soil), round bushes, or a stone paving. Drawn only in the tiles of S,
// over the island the walls pass draws (kerb + top at MED_H, world3.js): the physics stays the island's
const RO_RAISE = 0.12; // the lawn behind the inner kerb, over the top of the island (Carlo's photo: a low kerb, the lawn a hand over the cobbles)
const ciottoliTex = canvasTex(8, 8, (g, w, h) => { g.fillStyle = '#a08f76'; g.fillRect(0, 0, w, h); }); // tex/ciottoli.jpg in its place (foto3.js), 4 m a repeat
const fioriTex = canvasTex(128, 128, (g, w, h) => { // begonias: leaves and red flowers in the colours of Carlo's photo (leaves #2f4a1c, flowers #a5322a)
  g.fillStyle = '#2f4a1c'; g.fillRect(0, 0, w, h); let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 260; k++) { g.fillStyle = ['#3d5a22', '#27401a', '#46662a'][k % 3]; g.beginPath(); g.arc(r() * w, r() * h, 2 + r() * 4, 0, 7); g.fill(); }
  for (let k = 0; k < 420; k++) { g.fillStyle = ['#a5322a', '#8a2620', '#c23d30', '#b5362c'][k % 4]; g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 3, 0, 7); g.fill(); }
});
const fogliaTex = canvasTex(128, 128, (g, w, h) => { /* leaves in greys: the colour is the material's, or each bush's */ g.fillStyle = '#c8c8c8'; g.fillRect(0, 0, w, h); let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647; for (let k = 0; k < 700; k++) { g.fillStyle = ['#ffffff', '#9a9a9a', '#e0e0e0', '#7c7c7c'][k % 4]; g.beginPath(); g.arc(r() * w, r() * h, 1.5 + r() * 3.5, 0, 7); g.fill(); } });
const RO_MAT = {
  ciottoli: flatMat({ map: ciottoliTex }), fiori: new THREE.MeshLambertMaterial({ map: fioriTex, side: THREE.DoubleSide }),
  bordo: new THREE.MeshLambertMaterial({ color: 0xe6e2d8, side: THREE.DoubleSide }), terra: new THREE.MeshLambertMaterial({ map: groundTex, color: 0x8a6e55 }),
  cespuglio: new THREE.MeshLambertMaterial({ map: fogliaTex }),
  fascia: flatMat({ map: concreteTex, color: 0xe2ded4 }), prato: new THREE.MeshLambertMaterial({ map: grassTex }) // the band of worked concrete of the base; the lawn of its dome
};
// the base (model B, docs/rotonde.md): the lawn a low dome, rings of the outline scaled towards its middle, cu m higher there than at the edge
// (3 cm over the band); a point's height over the island top, for the shrubs on it
function roDome(o, cu, b) {
  let cx = 0, cz = 0; for (const p of o) { cx += p[0]; cz += p[1]; } cx /= o.length; cz /= o.length;
  const Rm = Math.sqrt(Math.abs(sArea(o)) / Math.PI), N = Math.max(3, Math.ceil(Rm / 1.5)), up = s => 0.03 + cu * (1 - s * s), d = densify(o, 1.5), nd = d.length;
  if (b) {
    const i0 = b.p.length / 3;
    for (let k = 0; k < N; k++) {
      const s = 1 - k / N;
      for (const p of d) { const x = cx + (p[0] - cx) * s, z = cz + (p[1] - cz) * s, L = hyp(p[0] - cx, p[1] - cz) || 1, g = 2 * cu * s / Rm, nx = g * (p[0] - cx) / L, nz = g * (p[1] - cz) / L, nl = Math.hypot(nx, 1, nz); vtx(b, x, streetY(x, z) + MED_H + up(s), z, nx / nl, 1 / nl, nz / nl, x / 9, z / 9); }
    }
    const ic = b.p.length / 3; vtx(b, cx, streetY(cx, cz) + MED_H + up(0), cz, 0, 1, 0, cx / 9, cz / 9);
    for (let k = 0; k < N; k++) for (let j = 0; j < nd; j++) {
      const a = i0 + k * nd + j, a2 = i0 + k * nd + (j + 1) % nd;
      if (k === N - 1) triUp(b, a, a2, ic); else { const c1 = a + nd, c2 = a2 + nd; triUp(b, a, a2, c2); triUp(b, a, c2, c1); }
    }
  }
  return (x, z) => up(Math.min(1, hyp(x - cx, z - cz) / Rm));
}
function rotondeTile(T, put, G) {
  if (!T.fine || !T.d.ro) return;
  const an = FBuf(), cem = FBuf(), fa = FBuf(), cu = Buf(), pr = FBuf(), pv = FBuf(), kb = Buf(), bo = Buf(), boT = FBuf(), fiT = FBuf(), fiS = Buf(), te = FBuf(), bush = [];
  const top = (x, z) => streetY(x, z) + MED_H, onLawn = (x, z) => top(x, z) + RO_RAISE, white = COL('#ffffff');
  for (const r of T.d.ro) {
    const raised = !!(r.pr && r.pr.length) && !r.cu, base = raised ? MED_H + RO_RAISE : MED_H; let yb = raised ? onLawn : top;
    try {
      for (const q of r.an || []) polyFill(r.am === 2 ? cem : an, dec(q.p), q.k.map(dec), MED_H, 4);
      for (const q of r.fa || []) polyFill(fa, dec(q.p), q.k.map(dec), MED_H, 3);
      if (r.cu) for (const q of r.pr || []) { const h = roDome(dec(q.p), r.cu, cu); yb = (x, z) => top(x, z) + h(x, z); } // the base: a dome behind the band, no kerb
      else for (const q of r.pr || []) { const o = dec(q.p); polyFill(pr, o, q.k.map(dec), MED_H + RO_RAISE, 9, white); kerbRing(kb, o, RO_RAISE, top); } // the lawn behind its kerb
      for (const q of r.pv || []) polyFill(pv, dec(q.p), q.k.map(dec), MED_H, 4);
      for (const q of r.mz || []) { // a crescent: the white stone edge, inside it flowers, shrubs or soil
        const o = dec(q.p), ins = (q.i || []).map(dec), hb = q.t === 'f' ? 0.1 : 0.18; /* the edge: its outer face and its top, 0.2 m wide (the white arcs of the aerial photo) */
        kerbRing(bo, o, hb, yb); polyFill(boT, o, ins, base + hb, 4);
        for (const n of ins) {
          if (q.t === 'f') { polyFill(fiT, n, [], base + 0.25, 1.2); kerbRing(fiS, n, 0.25, yb); }
          else { polyFill(te, n, [], base + 0.06, 3); kerbRing(bo, n, hb, yb); } /* soil under the edge (its inner face shows); the shrubs on it are in r.cs */
        }
      }
    } catch (e) { }
    for (const c of r.cs || []) { const x = c[0] / 10, z = c[1] / 10; bush.push([x, yb(x, z), z, c[2] / 10, c[3] / 10, c[4]]); }
  }
  put(an, RO_MAT.ciottoli, 10); put(fa, RO_MAT.fascia, 10); put(cu, RO_MAT.prato, 10, 'cast'); put(cem, MAT.median, 10); put(pr, MAT.grass, 10); put(pv, MAT.piazza, 10); put(kb, MAT.kerb, 10);
  put(bo, RO_MAT.bordo, 10, 'cast'); put(boT, RO_MAT.bordo, 10); put(fiT, RO_MAT.fiori, 10); put(fiS, RO_MAT.fiori, 10); put(te, RO_MAT.terra, 10);
  if (bush.length) { // round bushes: a squashed ball each, sunk a little into the lawn
    const geo = new THREE.IcosahedronGeometry(1, 2), im = new THREE.InstancedMesh(geo, RO_MAT.cespuglio, bush.length), m4 = new THREE.Matrix4(), qq = new THREE.Quaternion(), p = new THREE.Vector3(), sc = new THREE.Vector3();
    bush.forEach(([x, y, z, hw, h, col], i) => { m4.compose(p.set(x, y + h * 0.42, z), qq, sc.set(hw, h / 2, hw)); im.setMatrixAt(i, m4); im.setColorAt(i, COL(col)); });
    im.castShadow = true; im.receiveShadow = true; G.add(im);
  }
}
