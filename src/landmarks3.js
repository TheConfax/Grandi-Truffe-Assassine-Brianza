// ---------------------------------------------------------------- landmarks (monumenti): hand-made models for a few real buildings, in place of the generic box
// Meda: the Chiesa prepositurale di Santa Maria Nascente (Paolo Mezzanotte, 1939-1956: exposed brick, a giant arch with the Annunciation mosaic,
// a 22.4 m dome on a drum with 20 pink windows, the cross at about 43 m) and the Palazzo del Comune in piazza Municipio (1870-1885, three floors,
// plain string courses, wooden eaves). Footprints and collisions stay the OSM ones.
const LANDMARKS = [
  { n: 'Chiesa di Santa Maria Nascente', x: 33.3, z: -331.6, f: [64.0, -378.0, 80.0, -362.6], build: buildChiesaMeda }, // f: facade corners, left to right from the piazza
  { n: 'Municipio di Meda', x: 200.9, z: -532.2, build: buildMunicipioMeda },
];
const LM_GLOW = []; // { m, a, b }: emissive a by day, a + b once the street lamps are on
for (const L of LANDMARKS) {
  for (const T of TILES) for (const b of T.bld) { const [cx, cz] = centroid(b.pts); if (hyp(cx - L.x, cz - L.z) < 2) { b.lm = L; L.b = b; L.t = T.t; } }
  const p = D.pois.find(q => q.n === L.n); if (p) p.lm = L; // no generic shop sign on it
}
function buildLandmarks(T, G) { for (const L of LANDMARKS) if (L.t === T.t) L.build(L, L.b, G); }

const brickTex = canvasTex(256, 256, (g, w, h) => { // 2 m x 2 m of running bond
  g.fillStyle = '#b9a58f'; g.fillRect(0, 0, w, h);
  const cs = ['#9b5a3f', '#a6634a', '#8f5038', '#b06e50', '#94553d', '#a85e44', '#86492f', '#7c4430'];
  for (let r = 0; r < 32; r++) for (let c = -1; c < 8; c++) { g.fillStyle = cs[(rnd() * cs.length) | 0]; g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 8 + 1, 30, 6); }
  noise(g, w, h, 3000, 0.22, ['#5e3020', '#c98a68', '#6f3a28']);
});
const stoneTex = canvasTex(128, 128, (g, w, h) => { // 2 m: slabs of 1 m x 0.5 m
  g.fillStyle = '#d6cfbf'; g.fillRect(0, 0, w, h); noise(g, w, h, 2200, 0.22, ['#b5ad9c', '#ebe6da', '#c4bba8']);
  g.fillStyle = 'rgba(95,85,70,.3)'; for (let r = 0; r < 4; r++) { g.fillRect(0, r * 32, w, 1); for (let c = 0; c < 2; c++) g.fillRect(c * 64 + (r % 2) * 32, r * 32, 1, 32); }
});
const coppiTex = canvasTex(128, 128, (g, w, h) => { // 2 m of coppi running down the slope
  g.fillStyle = '#8e4630'; g.fillRect(0, 0, w, h);
  for (let c = 0; c < 8; c++) { const gr = g.createLinearGradient(c * 16, 0, c * 16 + 16, 0); gr.addColorStop(0, '#7a3a26'); gr.addColorStop(0.5, '#c06a48'); gr.addColorStop(1, '#7f3e2a'); g.fillStyle = gr; g.fillRect(c * 16 + 1, 0, 14, h); }
  g.fillStyle = 'rgba(40,15,8,.35)'; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) g.fillRect(c * 16 + 1, r * 32 + (c % 2) * 16, 14, 2);
  noise(g, w, h, 1200, 0.25, ['#5a2a1a', '#d08060', '#6b4a3a']);
});
// the Annunciation of the lunette (Italo Peresson's workshop): gold tesserae, the angel on the left, Mary on the right, the dove between them
const mosaicTex = canvasTex(512, 280, (g, w, h) => {
  for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) { const k = rnd(); g.fillStyle = k < 0.5 ? '#c9a043' : k < 0.8 ? '#ddb85a' : k < 0.95 ? '#b48a35' : '#f0d27a'; g.fillRect(x, y, 6, 6); }
  const P = (col, pts) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const halo = (x, y, r) => { g.fillStyle = '#f3dc8c'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#8a6420'; g.lineWidth = 3; g.stroke(); };
  g.fillStyle = 'rgba(255,240,190,.55)'; for (let i = 0; i < 9; i++) { const a = 0.5 + i * 0.13; g.save(); g.translate(262, 72); g.rotate(a); g.fillRect(0, -2, 150, 4); g.restore(); } // rays from the dove
  P('#7c1f24', [300, 30, 420, 90, 455, 280, 425, 280, 395, 120]); // curtain behind Mary
  P('#a8323a', [404, 92, 428, 140, 446, 280, 362, 280, 380, 140]); // Mary: red dress, blue mantle
  P('#27457f', [392, 96, 418, 104, 440, 180, 452, 280, 410, 280, 404, 190, 372, 280, 352, 280, 370, 170]);
  halo(398, 84, 22); g.fillStyle = '#e9c9a5'; g.beginPath(); g.arc(398, 86, 13, 0, TAU); g.fill(); P('#27457f', [382, 80, 398, 66, 414, 80, 412, 104, 384, 104]);
  g.fillStyle = '#e9c9a5'; g.fillRect(386, 140, 16, 9);
  P('#e5d3a0', [140, 110, 70, 60, 40, 70, 70, 120, 50, 140, 112, 160, 150, 150]); // the angel: wings, white robe kneeling, arm towards Mary
  P('#b58b3c', [140, 120, 80, 80, 60, 88, 92, 128, 140, 140]);
  P('#f2efe6', [150, 112, 182, 118, 200, 190, 230, 236, 234, 280, 120, 280, 136, 200]);
  P('#e2c6c9', [182, 118, 200, 190, 232, 236, 234, 280, 214, 280, 196, 220, 176, 150]);
  P('#f2efe6', [176, 132, 252, 120, 256, 132, 182, 150]); g.fillStyle = '#e9c9a5'; g.fillRect(250, 118, 12, 12);
  halo(164, 96, 22); g.fillStyle = '#e9c9a5'; g.beginPath(); g.arc(166, 98, 13, 0, TAU); g.fill(); g.fillStyle = '#9a6a30'; g.beginPath(); g.arc(162, 92, 12, Math.PI, TAU); g.fill();
  g.strokeStyle = '#4f7a35'; g.lineWidth = 4; g.beginPath(); g.moveTo(240, 280); g.lineTo(276, 150); g.stroke(); // the lily
  g.fillStyle = '#ffffff'; for (const [x, y] of [[276, 146], [268, 170], [282, 176], [262, 200]]) { g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
  P('#ffffff', [262, 60, 290, 66, 300, 58, 296, 74, 268, 80, 240, 66]); // the dove
  g.fillStyle = 'rgba(70,45,15,.28)'; for (let i = 0; i <= w; i += 6) g.fillRect(i, 0, 1, h); for (let i = 0; i <= h; i += 6) g.fillRect(0, i, w, 1); // grout
}, false);
const MUN_H = 12.7; // the facade drawing is laid out for these metres to the eaves and stretched to the real height
const munTex = lit => canvasTex(128, 512, (g, w, h) => { // one bay, pavement to eaves; lit: the emissive map (lit windows only)
  const Y = m => h - m / MUN_H * h, R = (x0, m0, x1, m1, col) => { g.fillStyle = col; g.fillRect(x0, Y(m1), x1 - x0, Y(m0) - Y(m1)); };
  const CREAM = '#efe3c9', GLASS = '#2b3038', SHUT = '#4f6b4c';
  if (lit) { R(0, 0, w, MUN_H, '#000'); R(46, 5.45, 82, 7.75, '#ffd890'); return; } // at night only the piano nobile
  R(0, 0, w, MUN_H, '#e3be78'); noise(g, w, h, 2500, 0.12, ['#c9a462', '#f0d494']);
  R(0, 0, w, 0.5, '#aaa397'); // stone plinth
  for (let m = 1.2; m < 4.4; m += 0.5) { R(0, m - 0.04, w, m, 'rgba(110,75,35,.45)'); R(0, m, w, m + 0.03, 'rgba(255,240,200,.35)'); } // bugnato
  R(0, 4.36, w, 4.4, 'rgba(0,0,0,.2)'); R(0, 4.4, w, 4.8, CREAM); R(0, 8.76, w, 8.8, 'rgba(0,0,0,.2)'); R(0, 8.8, w, 9.05, CREAM); R(0, 12.1, w, MUN_H, CREAM); R(0, 12.06, w, 12.1, 'rgba(0,0,0,.2)');
  const win = (x0, m0, x1, m1, bars) => { R(x0 - 4, m0 - 0.15, x1 + 4, m1 + 0.15, CREAM); R(x0, m0, x1, m1, GLASS); R(62, m0, 66, m1, CREAM); R(x0, (m0 + m1) / 2 + 0.3, x1, (m0 + m1) / 2 + 0.36, CREAM); if (bars) for (let x = x0 + 4; x < x1; x += 7) R(x, m0, x + 1.5, m1, '#15171a'); };
  const shutters = (m0, m1) => { for (const x of [18, 88]) { R(x, m0, x + 22, m1, SHUT); for (let m = m0 + 0.08; m < m1; m += 0.12) R(x + 2, m, x + 20, m + 0.04, 'rgba(0,0,0,.25)'); } };
  win(46, 1.3, 82, 3.5, true); R(58, 3.65, 70, 3.95, CREAM); // ground floor: grated, keystone
  shutters(5.45, 7.75); win(46, 5.45, 82, 7.75); R(36, 5.1, 92, 5.3, '#e6d8bb'); R(34, 7.95, 94, 8.1, CREAM); // piano nobile: sill and pediment
  g.fillStyle = CREAM; g.beginPath(); g.moveTo(34, Y(8.1)); g.lineTo(94, Y(8.1)); g.lineTo(64, Y(8.62)); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(34, Y(8.1), 60, 2);
  shutters(9.75, 11.45); win(46, 9.75, 82, 11.45); R(40, 9.5, 88, 9.62, '#e6d8bb');
});
const LMAT = {
  brick: new THREE.MeshLambertMaterial({ map: brickTex, side: THREE.DoubleSide }), stone: new THREE.MeshLambertMaterial({ map: stoneTex, side: THREE.DoubleSide }),
  coppi: new THREE.MeshLambertMaterial({ map: coppiTex, side: THREE.DoubleSide }), trim: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  glass: new THREE.MeshLambertMaterial({ color: 0x3b3340, emissive: 0xffa6c0, emissiveIntensity: 0.06, side: THREE.DoubleSide }),
  mosaic: new THREE.MeshLambertMaterial({ map: mosaicTex, emissiveMap: mosaicTex, emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.DoubleSide }),
  mun: (() => { const t = munTex(false), e = munTex(true); t.wrapT = e.wrapT = THREE.ClampToEdgeWrapping; return new THREE.MeshLambertMaterial({ map: t, emissiveMap: e, emissive: 0xffc870, emissiveIntensity: 0 }); })(),
};
LM_GLOW.push({ m: LMAT.glass, a: 0.06, b: 0.9 }, { m: LMAT.mosaic, a: 0.1, b: 0.4 }, { m: LMAT.mun, a: 0, b: 0.3 });

// local frame helpers: everything is modelled in metres around (0,0,0) and moved into place by M while it goes into the buffers
function lmFrame(M) {
  const nm = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3(), n = new THREE.Vector3();
  const put = (b, x, y, z, nx, ny, nz, u, w, col) => { v.set(x, y, z).applyMatrix4(M); n.set(nx, ny, nz).applyMatrix3(nm).normalize(); vtx(b, v.x, v.y, v.z, n.x, n.y, n.z, u, w, col); };
  return {
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
    geo(b, g, uvf, col) { // any THREE geometry already placed in the local frame; uvf(p, n, uv) -> [u, v]
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, base = b.p.length / 3, p = new THREE.Vector3(), q = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); q.fromBufferAttribute(nor, i); const t = uvf ? uvf(p, q, uv ? [uv.getX(i), uv.getY(i)] : [0, 0]) : [0, 0]; put(b, p.x, p.y, p.z, q.x, q.y, q.z, t[0], t[1], col); }
      if (g.index) for (let i = 0; i < g.index.count; i++) b.i.push(base + g.index.getX(i)); else for (let i = 0; i < pos.count; i++) b.i.push(base + i);
      g.dispose();
    },
  };
}
const boxUV = S => (p, n) => Math.abs(n.y) > 0.7 ? [p.x / S, p.z / S] : Math.abs(n.x) > Math.abs(n.z) ? [p.z / S, p.y / S] : [p.x / S, p.y / S];
const wrapUV = (S, len, vlen) => (p, n, t) => [t[0] * len / S, vlen ? t[1] * vlen / S : p.y / S]; // cylinders, cones, domes: their own uv stretched to metres
const lmBox = (w, h, d, x, y, z, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);
function archShape(w, y0, y1) { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, y0); s.lineTo(r, y0); s.lineTo(r, y1 - r); s.absarc(0, y1 - r, r, 0, Math.PI, false); s.lineTo(-r, y0); return s; }
// an arched window on a wall: stone frame and glass, facing the local direction ry (0 = +z), at (x, z) on the wall face
function lmWindow(F, Bs, w, y0, y1, x, z, ry, out = 0.03) {
  const fr = new THREE.ShapeGeometry(archShape(w + 0.36, y0 - 0.18, y1 + 0.18), 12).translate(0, 0, out).rotateY(ry).translate(x, 0, z);
  const gl = new THREE.ShapeGeometry(archShape(w, y0, y1), 12).translate(0, 0, out + 0.03).rotateY(ry).translate(x, 0, z);
  F.geo(Bs.stone, fr, boxUV(2)); F.geo(Bs.glass, gl);
}

function buildChiesaMeda(L, B, G) {
  // local frame: x across the facade, +z out of it towards the piazza (the church runs to -z), y up from the pavement in front
  const [ax, az, bx, bz] = L.f, cx = (ax + bx) / 2, cz = (az + bz) / 2, W2 = hyp(bx - ax, bz - az) / 2, ux = (bz - az) / (2 * W2), uz = -(bx - ax) / (2 * W2);
  const M = new THREE.Matrix4().makeRotationY(Math.atan2(ux, uz)).setPosition(cx, groundH(cx + ux * 2, cz + uz * 2), cz), F = lmFrame(M);
  const Bs = { brick: Buf(), stone: Buf(), coppi: Buf(), trim: Buf(), glass: Buf(), mosaic: Buf() };
  const brick = (g, uvf = boxUV(2)) => F.geo(Bs.brick, g, uvf), stone = (g, uvf = boxUV(2)) => F.geo(Bs.stone, g, uvf), trim = (g, hex) => F.geo(Bs.trim, g, null, COL(hex));
  const wallX = (x, z0, z1, y0, y1) => { F.face(Bs.brick, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]); const o = x + Math.sign(x) * 0.05; F.face(Bs.stone, [[o, y0, z0], [o, y0, z1], [o, 0.95, z1], [o, 0.95, z0]]); };
  const wallZ = (z, x0, x1, y0, y1) => { F.face(Bs.brick, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]); const o = z + Math.sign(z) * 0.05; F.face(Bs.stone, [[x0, y0, o], [x1, y0, o], [x1, 0.95, o], [x0, 0.95, o]]); };
  const FL = 0.45, BOT = -1.6, FE = 23.2, FA = 28.2, AR = 6.55, AS = 15.6, DEP = 1.4; // floor, wall foot, facade eaves and apex, giant arch radius and springing, facade depth
  // facade: brick screen with the giant arch cut out of it
  {
    const s = new THREE.Shape(); s.moveTo(-W2, BOT); s.lineTo(-AR, BOT); s.lineTo(-AR, AS); s.absarc(0, AS, AR, Math.PI, 0, true); s.lineTo(AR, BOT); s.lineTo(W2, BOT); s.lineTo(W2, FE); s.lineTo(0, FA); s.lineTo(-W2, FE); s.lineTo(-W2, BOT);
    brick(new THREE.ExtrudeGeometry(s, { depth: DEP, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -DEP));
    const Z = -DEP + 0.02; // inside the arch: stone wall, two registers, the lunette
    F.face(Bs.stone, [[-AR, BOT, Z], [AR, BOT, Z], [AR, 15.0, Z], [-AR, 15.0, Z]]);
    const ms = new THREE.Shape(); ms.moveTo(-AR, 15.0); ms.lineTo(AR, 15.0); ms.lineTo(AR, AS); ms.absarc(0, AS, AR, 0, Math.PI, false); ms.lineTo(-AR, 15.0);
    F.geo(Bs.mosaic, new THREE.ShapeGeometry(ms, 24).translate(0, 0, Z + 0.01), p => [(p.x + AR) / (2 * AR), (p.y - 15.0) / (AS + AR - 15.0)]);
    stone(lmBox(2 * AR, 0.45, 0.4, 0, 14.78, Z + 0.2)); stone(lmBox(2 * AR, 0.55, 0.26, 0, 8.75, Z + 0.13));
    for (const [x, w] of [[-5.98, 1.15], [-2.25, 1.3], [2.25, 1.3], [5.98, 1.15]]) stone(lmBox(w, 14.55 - BOT, 0.24, x, (BOT + 14.55) / 2, Z + 0.12));
    for (const x of [-4.15, 0, 4.15]) lmWindow(F, Bs, 1.6, 9.6, 13.8, x, Z, 0);
    for (const [x, hw, top, tr] of [[0, 1.35, 6.4, 4.7], [-4.15, 1.0, 5.75, 4.3], [4.15, 1.0, 5.75, 4.3]]) { // bronze doors with a glazed transom
      F.face(Bs.stone, [[x - hw - 0.25, FL, Z + 0.02], [x + hw + 0.25, FL, Z + 0.02], [x + hw + 0.25, top + 0.25, Z + 0.02], [x - hw - 0.25, top + 0.25, Z + 0.02]]);
      trim(lmBox(2 * hw, tr - FL, 0.08, x, (FL + tr) / 2, Z + 0.07), '#4a3a2a'); trim(lmBox(0.06, tr - FL, 0.1, x, (FL + tr) / 2, Z + 0.08), '#2a2018');
      F.face(Bs.trim, [[x - hw, tr + 0.12, Z + 0.05], [x + hw, tr + 0.12, Z + 0.05], [x + hw, top, Z + 0.05], [x - hw, top, Z + 0.05]], 2, COL('#262c33'));
    }
    for (const sd of [-1, 1]) { // string course at the springing, stone plinth, the two plaques
      const xm = sd * (AR + W2) / 2, wl = W2 - AR;
      stone(lmBox(wl, 0.32, 0.16, xm, AS, 0.08)); stone(lmBox(wl, 1.1 - BOT, 0.06, xm, (BOT + 1.1) / 2, 0.03));
      F.face(Bs.stone, [[sd * 8.45, 2.4, 0.03], [sd * 9.35, 2.4, 0.03], [sd * 9.35, 3.5, 0.03], [sd * 8.45, 3.5, 0.03]]);
      const sl = hyp(W2, FA - FE), ang = Math.atan2(FA - FE, W2); // gable coping
      stone(new THREE.BoxGeometry(sl + 0.3, 0.32, DEP + 0.2).rotateZ(-sd * ang).translate(sd * W2 / 2, (FE + FA) / 2 + 0.16, -DEP / 2));
    }
    for (let k = 0; k < 3; k++) { const d = 1.5 - 0.5 * k; stone(lmBox(27, FL / 3 * (k + 1) - BOT, d, 0, (BOT + FL / 3 * (k + 1)) / 2, d / 2)); } // sagrato steps
  }
  // nave
  const NE = 22.2, NR = 27.3, NZ = -29.3;
  for (const sd of [-1, 1]) {
    wallX(sd * W2, -DEP, NZ, BOT, NE);
    for (const z of [-DEP - 0.6, -10.7, -20.0, NZ + 0.6]) brick(lmBox(0.4, NE - BOT, 1.2, sd * (W2 + 0.2), (BOT + NE) / 2, z)); // lesene
    for (const z of [-6.05, -15.35, -24.65]) lmWindow(F, Bs, 2.2, 13.0, 19.1, sd * W2, z, sd * Math.PI / 2, 0.05);
    stone(lmBox(0.6, 0.38, -NZ - DEP, sd * (W2 + 0.25), NE - 0.2, (NZ - DEP) / 2));
    F.face(Bs.coppi, [[sd * (W2 + 0.45), NE - 0.05, -1.2], [0, NR, -1.2], [0, NR, NZ - 0.3], [sd * (W2 + 0.45), NE - 0.05, NZ - 0.3]]);
  }
  F.face(Bs.brick, [[-W2, NE, NZ], [W2, NE, NZ], [0, NR - 0.1, NZ]]);
  // the dome block: transept with its two apsidioles, crossing, drum, dome, lantern
  const XW = 17.1, ZB = -69.7, ZC = -49.5, BE = 22.2, BR = 23.9, AP = 10.5;
  for (const sd of [-1, 1]) {
    wallX(sd * XW, NZ, ZB, BOT, BE); wallZ(NZ, sd * W2, sd * XW, BOT, BE); wallZ(ZB, sd * AP, sd * XW, BOT, BE);
    for (const z of [NZ - 0.6, -41.5, -57.5, ZB + 0.6]) brick(lmBox(0.4, BE - BOT, 1.2, sd * (XW + 0.2), (BOT + BE) / 2, z));
    for (const z of [-35.4, -63.6]) lmWindow(F, Bs, 2.0, 9.0, 15.5, sd * XW, z, sd * Math.PI / 2, 0.05);
    lmWindow(F, Bs, 1.6, 12.0, 16.4, sd * (W2 + XW) / 2, NZ, 0, 0.03);
    stone(new THREE.RingGeometry(2.1, 2.55, 24).rotateY(sd * Math.PI / 2).translate(sd * (XW + 0.04), 16.8, ZC)); // oculus over the apsidiole
    F.geo(Bs.glass, new THREE.CircleGeometry(2.1, 24).rotateY(sd * Math.PI / 2).translate(sd * (XW + 0.06), 16.8, ZC));
    stone(lmBox(0.6, 0.38, -(ZB - NZ) + 0.6, sd * (XW + 0.25), BE - 0.2, (NZ + ZB) / 2)); stone(lmBox(XW - W2, 0.38, 0.6, sd * (XW + W2) / 2, BE - 0.2, NZ + 0.25)); stone(lmBox(XW - AP, 0.38, 0.6, sd * (XW + AP) / 2, BE - 0.2, ZB - 0.25));
    // apsidiole: half cylinder and half dome
    const r = 4.5, t0 = sd > 0 ? 0 : Math.PI;
    brick(new THREE.CylinderGeometry(r, r, 10.8 - BOT, 18, 1, true, t0, Math.PI).translate(sd * XW, (BOT + 10.8) / 2, ZC), wrapUV(2, Math.PI * r));
    stone(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.95 - BOT, 18, 1, true, t0, Math.PI).translate(sd * XW, (BOT + 0.95) / 2, ZC), wrapUV(2, Math.PI * r));
    stone(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.35, 18, 1, false, t0, Math.PI).translate(sd * XW, 10.8, ZC));
    F.geo(Bs.coppi, new THREE.SphereGeometry(r + 0.3, 18, 6, sd > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2).scale(1, 0.55, 1).translate(sd * XW, 10.95, ZC), wrapUV(2, Math.PI * r, Math.PI / 2 * r));
    lmWindow(F, Bs, 1.1, 4.0, 7.6, sd * (XW + r), ZC, sd * Math.PI / 2, 0.02);
  }
  { // block roof: low hips up to the drum
    const o = [[-XW - 0.4, NZ + 0.4], [XW + 0.4, NZ + 0.4], [XW + 0.4, ZB - 0.4], [-XW - 0.4, ZB - 0.4]], i = [[-13.6, NZ - 3.6], [13.6, NZ - 3.6], [13.6, ZB + 3.6], [-13.6, ZB + 3.6]];
    for (let k = 0; k < 4; k++) { const a = o[k], b = o[(k + 1) % 4], c = i[(k + 1) % 4], d = i[k]; F.face(Bs.coppi, [[a[0], BE - 0.05, a[1]], [b[0], BE - 0.05, b[1]], [c[0], BR, c[1]], [d[0], BR, d[1]]]); }
    F.face(Bs.coppi, i.map(p => [p[0], BR, p[1]]));
  }
  { // apse: half cylinder, cornice, half-cone roof, five tall windows
    brick(new THREE.CylinderGeometry(AP, AP, 17.6 - BOT, 30, 1, true, Math.PI / 2, Math.PI).translate(0, (BOT + 17.6) / 2, ZB), wrapUV(2, Math.PI * AP));
    stone(new THREE.CylinderGeometry(AP + 0.05, AP + 0.05, 0.95 - BOT, 30, 1, true, Math.PI / 2, Math.PI).translate(0, (BOT + 0.95) / 2, ZB), wrapUV(2, Math.PI * AP));
    stone(new THREE.CylinderGeometry(AP + 0.28, AP + 0.28, 0.38, 30, 1, false, Math.PI / 2, Math.PI).translate(0, 17.5, ZB));
    F.geo(Bs.coppi, new THREE.ConeGeometry(AP + 0.5, 3.4, 30, 1, true, Math.PI / 2, Math.PI).translate(0, 17.6 + 1.7, ZB), wrapUV(2, Math.PI * (AP + 0.5), hyp(AP + 0.5, 3.4)));
    for (let k = 1; k <= 5; k++) { const a = Math.PI / 2 + Math.PI * k / 6; lmWindow(F, Bs, 1.3, 5.0, 14.2, Math.sin(a) * AP, ZB + Math.cos(a) * AP, a, 0.04); }
  }
  { // drum with its 20 windows of pink glass, the dome (22.4 m inside), the lantern and the cross at about 43 m
    const R = 12.6, D0 = BR, D1 = 30.5, DY = 30.7, DS = 0.62;
    brick(new THREE.CylinderGeometry(R, R, D1 - D0 + 0.4, 60, 1, true).translate(0, (D0 + D1) / 2 - 0.2, ZC), wrapUV(2, TAU * R));
    for (let k = 0; k < 20; k++) {
      const a = (k + 0.5) * TAU / 20, b = k * TAU / 20;
      lmWindow(F, Bs, 1.3, 25.2, 28.9, Math.sin(a) * R, ZC + Math.cos(a) * R, a, 0.04);
      brick(lmBox(0.55, D1 - D0, 0.3, 0, (D0 + D1) / 2, R + 0.1).rotateY(b).translate(0, 0, ZC));
    }
    stone(new THREE.CylinderGeometry(R + 0.45, R + 0.45, 0.5, 60).translate(0, D1, ZC)); stone(new THREE.CylinderGeometry(R + 0.2, R + 0.2, 0.4, 60).translate(0, D0 + 0.2, ZC));
    trim(new THREE.SphereGeometry(R + 0.15, 56, 14, 0, TAU, 0, Math.PI / 2).scale(1, DS, 1).translate(0, DY, ZC), '#6f9783');
    const rib = Buf(), rr = R + 0.22; // copper ribs
    for (let k = 0; k < 16; k++) {
      const ph = k * TAU / 16, tx = Math.sin(ph), tz = Math.cos(ph), i0 = rib.p.length / 3; let n = 0;
      for (let j = 0; j <= 12; j++) {
        const th = j / 12 * Math.PI / 2; if (rr * Math.sin(th) < 1.6) break;
        const sx = -Math.cos(ph) * Math.sin(th), sz = Math.sin(ph) * Math.sin(th), sy = Math.cos(th), px = sx * rr, py = DY + sy * rr * DS, pz = ZC + sz * rr;
        for (const s of [-0.17, 0.17]) vtx(rib, px + tx * s, py, pz + tz * s, sx, sy, sz, 0, 0, COL('#a9c4b4'));
        n++;
      }
      for (let j = 0; j < n - 1; j++) { const q = i0 + j * 2; rib.i.push(q, q + 1, q + 3, q, q + 3, q + 2); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rib.p, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(rib.n, 3)); rg.setIndex(rib.i); trim(rg, '#a9c4b4');
    const LY = DY + R * DS - 0.4;
    stone(new THREE.CylinderGeometry(2.0, 2.1, 2.4, 16).translate(0, LY + 1.2, ZC));
    for (let k = 0; k < 8; k++) trim(lmBox(0.55, 1.5, 0.2, 0, LY + 1.25, 2.0).rotateY(k * TAU / 8).translate(0, 0, ZC), '#2a2a2e');
    trim(new THREE.ConeGeometry(2.4, 0.9, 16).translate(0, LY + 2.85, ZC), '#6f9783'); trim(new THREE.SphereGeometry(0.32, 10, 8).translate(0, LY + 3.45, ZC), '#c9a54a');
    trim(lmBox(0.16, 1.6, 0.16, 0, LY + 4.5, ZC), '#c9a54a'); trim(lmBox(0.9, 0.14, 0.14, 0, LY + 4.85, ZC), '#c9a54a');
  }
  mkMesh(Bs.brick, LMAT.brick, 10, 'cast', G); mkMesh(Bs.stone, LMAT.stone, 10, 'cast', G); mkMesh(Bs.coppi, LMAT.coppi, 10, 'cast', G);
  mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.glass, LMAT.glass, 10, false, G); mkMesh(Bs.mosaic, LMAT.mosaic, 10, false, G);
}

// polygon helpers for the palazzo: drop collinear points, and offset inwards (d > 0) or outwards with mitred corners
function lmSimplify(ring, tol) {
  const r = ring.slice(); let ch = true;
  while (ch && r.length > 3) { ch = false; for (let i = 0; i < r.length; i++) { const a = r[(i + r.length - 1) % r.length], c = r[(i + 1) % r.length]; if (segDist(r[i][0], r[i][1], a[0], a[1], c[0], c[1]) < tol) { r.splice(i, 1); ch = true; break; } } }
  return r;
}
function lmOffset(ring, d) {
  const s = sArea(ring) > 0 ? 1 : -1, n = r => r.length;
  return ring.map((p, i) => {
    const a = ring[(i + n(ring) - 1) % n(ring)], c = ring[(i + 1) % n(ring)], l1 = hyp(p[0] - a[0], p[1] - a[1]) || 1, l2 = hyp(c[0] - p[0], c[1] - p[1]) || 1;
    const n1 = [-(p[1] - a[1]) / l1 * s, (p[0] - a[0]) / l1 * s], n2 = [-(c[1] - p[1]) / l2 * s, (c[0] - p[0]) / l2 * s], k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [p[0] + d * (n1[0] + n2[0]) / k, p[1] + d * (n1[1] + n2[1]) / k];
  });
}
function buildMunicipioMeda(L, B, G) {
  const ring = lmSimplify(B.pts, 0.35), A = sArea(ring), H = B.h, n = ring.length;
  const poi = D.pois.find(q => q.lm === L) || { x: L.x, z: L.z };
  // main front: the wall with the entrance on it (the OSM point of the municipio)
  let fi = 0, fd = 1e9; for (let i = 0; i < n; i++) { const a = ring[i], c = ring[(i + 1) % n], d = segDist(poi.x, poi.z, a[0], a[1], c[0], c[1]); if (d < fd) { fd = d; fi = i; } }
  const gF = groundH(poi.x, poi.z), gmin = Math.min(...ring.map(p => groundH(p[0], p[1]))), top = gF + H, bot = gmin - 0.6;
  const wall = Buf(), trim = Buf(), roof = Buf(), flag = Buf(), sign = Buf(), F0 = lmFrame(new THREE.Matrix4());
  const CREAM = COL('#efe3c9'), WOOD = COL('#5e4128'), IRON = COL('#26282b'), STONE = COL('#cfc6b2'), DOOR = COL('#4a3324');
  for (let i = 0; i < n; i++) {
    const a = ring[i], c = ring[(i + 1) % n], dx = c[0] - a[0], dz = c[1] - a[1], Ln = hyp(dx, dz); if (Ln < 0.05) continue;
    let nx = dz / Ln, nz = -dx / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    let bays = Math.max(1, Math.round(Ln / 3.7)); if (i === fi && bays % 2 === 0) bays++; // the portal sits on the middle bay
    const [u0, u1] = Ln < 2.6 ? [0.02, 0.12] : [0, bays], v0 = (bot - gF) / H, base = wall.p.length / 3;
    vtx(wall, a[0], bot, a[1], nx, 0, nz, u0, v0); vtx(wall, c[0], bot, c[1], nx, 0, nz, u1, v0); vtx(wall, c[0], top, c[1], nx, 0, nz, u1, 1); vtx(wall, a[0], top, a[1], nx, 0, nz, u0, 1);
    if (nx * (-dz) + nz * dx > 0) wall.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else wall.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
    // cornice, wooden soffit and brackets (mensole) under the eaves
    const ry = Math.atan2(-dz / Ln, dx / Ln), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    addBox(trim, mx + nx * 0.15, top - 0.16, mz + nz * 0.15, Ln + 0.3, 0.28, 0.32, CREAM, ry);
    for (let s = 0.45; s < Ln - 0.2; s += 0.9) addBox(trim, a[0] + dx / Ln * s + nx * 0.45, top - 0.1, a[1] + dz / Ln * s + nz * 0.45, 0.12, 0.2, 0.9, WOOD, ry);
  }
  { // roof: hips of coppi from the eaves (0.9 m out) to a narrow crest 3.9 m in
    const o = lmOffset(ring, -0.9), r = lmOffset(ring, 3.9), ry = top + 0.42 * 4.8;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, P = [[o[i][0], top, o[i][1]], [o[j][0], top, o[j][1]], [r[j][0], ry, r[j][1]], [r[i][0], ry, r[i][1]]];
      const ex = P[1][0] - P[0][0], ez = P[1][2] - P[0][2], el = hyp(ex, ez) || 1, sx = P[3][0] - P[0][0], sy = P[3][1] - P[0][1], sz = P[3][2] - P[0][2];
      let nx = -ez * sy, nyy = ez * sx - ex * sz, nz = ex * sy; if (nyy < 0) { nx = -nx; nyy = -nyy; nz = -nz; } // eaves x up-slope, facing the sky
      const nl = Math.hypot(nx, nyy, nz) || 1, base = roof.p.length / 3, along = q => ((q[0] - P[0][0]) * ex + (q[2] - P[0][2]) * ez) / el, up = q => Math.hypot(q[0] - P[0][0] - ex / el * along(q), q[1] - top, q[2] - P[0][2] - ez / el * along(q));
      for (const q of P) vtx(roof, q[0], q[1], q[2], nx / nl, nyy / nl, nz / nl, along(q) / 2, up(q) / 2);
      roof.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
      const sb = trim.p.length / 3; // soffit
      for (const q of [ring[i], ring[j], o[j], o[i]]) vtx(trim, q[0], top - 0.02, q[1], 0, -1, 0, 0, 0, WOOD);
      trim.i.push(sb, sb + 1, sb + 2, sb, sb + 2, sb + 3, sb, sb + 2, sb + 1, sb, sb + 3, sb + 2);
    }
    try { polyFill(roof, r, [], ry, 2); } catch (e) { }
  }
  { // the front: stone portal, balcony on stone brackets with an iron railing, the flags, MUNICIPIO on the frieze
    const a = ring[fi], c = ring[(fi + 1) % n], Ln = hyp(c[0] - a[0], c[1] - a[1]), ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln;
    let nx = ez, nz = -ex; if (A < 0) { nx = -nx; nz = -nz; }
    const bays = Math.max(1, Math.round(Ln / 3.7)) | 1, s0 = (Math.floor(clamp(((poi.x - a[0]) * ex + (poi.z - a[1]) * ez) / Ln, 0, 0.999) * bays) + 0.5) * Ln / bays, ry = Math.atan2(-ez, ex);
    const at = (s, out) => [a[0] + ex * (s0 + s) + nx * out, a[1] + ez * (s0 + s) + nz * out];
    const fb = (s, up, out, w, h, d, col) => { const [x, z] = at(s, out); addBox(trim, x, gF + up, z, w, h, d, col, ry); };
    const k = H / MUN_H; // heights of the facade drawing, stretched like it
    fb(0, 1.95, 0.05, 2.4, 3.9, 0.1, DOOR); fb(0, 1.95, 0.08, 0.06, 3.9, 0.1, COL('#2e2018'));
    for (const s of [-1.45, 1.45]) fb(s, 2.1, 0.18, 0.5, 4.2, 0.36, STONE);
    fb(0, 4.15, 0.2, 3.5, 0.5, 0.42, STONE); fb(0, 4.15, 0.42, 0.45, 0.62, 0.1, CREAM); fb(0, 0.06, 0.6, 4.2, 0.16, 1.2, STONE);
    const by = 4.8 * k + 0.12; // balcony slab on the piano nobile string course
    fb(0, by, 0.6, 4.4, 0.22, 1.2, STONE); for (const s of [-1.6, 0, 1.6]) fb(s, by - 0.35, 0.4, 0.3, 0.5, 0.8, STONE);
    fb(0, by + 1.05, 1.15, 4.4, 0.06, 0.08, IRON); fb(0, by + 0.2, 1.15, 4.4, 0.05, 0.06, IRON);
    for (const s of [-2.15, 2.15]) fb(s, by + 1.05, 0.62, 0.06, 0.06, 1.1, IRON);
    for (let s = -2.15; s <= 2.16; s += 0.16) fb(s, by + 0.62, 1.15, 0.025, 0.86, 0.025, IRON);
    for (const s of [-1.05, 1.05]) for (let t = 0.05; t < 1.0; t += 0.16) fb(s * 2.05, by + 0.62, 0.6 + t * 0.5, 0.025, 0.86, 0.025, IRON);
    // flags on two poles out of the railing: the tricolore and Europe, hanging down along the pole
    for (const [s, off] of [[-1.9, 0], [1.9, 0.5]]) {
      const [px, pz] = at(s, 1.1), py = gF + by + 1.0, dx = nx * 0.68 + ex * Math.sign(s) * 0.25, dy = 0.69, dz = nz * 0.68 + ez * Math.sign(s) * 0.25, dl = Math.hypot(dx, dy, dz);
      const tip = t => [px + dx / dl * t, py + dy / dl * t, pz + dz / dl * t];
      F0.geo(trim, new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6).translate(0, 1.3, 0).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / dl, dy / dl, dz / dl)))).translate(px, py, pz), null, COL('#d8d8d2'));
      const NI = 5, NJ = 4, base = flag.p.length / 3;
      for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) {
        const q = tip(1.0 + 1.5 * i / NI), w = Math.sin(i * 1.3 + j * 0.9) * 0.07 * j / NJ;
        vtx(flag, q[0] + ex * w, q[1] - 1.45 * j / NJ, q[2] + ez * w, nx, 0, nz, off + 0.5 * j / NJ, i / NI);
      }
      for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const q = base + i * (NJ + 1) + j; flag.i.push(q, q + 1, q + NJ + 2, q, q + NJ + 2, q + NJ + 1); }
    }
    const [lx, lz] = at(0, 0.05), w = 6.4, hh = 0.4, y = gF + 12.2 * k, rx = nz, rz = -nx, i0 = sign.p.length / 3; // the viewer's right when facing the wall
    vtx(sign, lx - rx * w / 2, y - hh / 2, lz - rz * w / 2, nx, 0, nz, 0, 0); vtx(sign, lx + rx * w / 2, y - hh / 2, lz + rz * w / 2, nx, 0, nz, 1, 0);
    vtx(sign, lx + rx * w / 2, y + hh / 2, lz + rz * w / 2, nx, 0, nz, 1, 1); vtx(sign, lx - rx * w / 2, y + hh / 2, lz - rz * w / 2, nx, 0, nz, 0, 1);
    sign.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  const flagTex = canvasTex(256, 64, (g, w, h) => {
    for (const [i, col] of [[0, '#009246'], [1, '#f1f2f1'], [2, '#ce2b37']]) { g.fillStyle = col; g.fillRect(i * w / 6, 0, w / 6 + 1, h); } // u runs from the pole (hoist) to the fly
    g.fillStyle = '#003399'; g.fillRect(w / 2, 0, w / 2, h); g.fillStyle = '#ffcc00';
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.beginPath(); g.arc(w * 0.75 + Math.cos(an) * 20, h / 2 + Math.sin(an) * 20, 2.6, 0, TAU); g.fill(); }
  }, false);
  const signTex = canvasTex(512, 32, (g, w, h) => { g.fillStyle = '#4a3c2a'; g.font = 'bold 30px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; const t = 'M U N I C I P I O'; g.save(); g.translate(w / 2, h / 2 + 1); g.scale(Math.min(3, w * 0.94 / g.measureText(t).width), 1); g.fillText(t, 0, 0); g.restore(); }, false);
  mkMesh(wall, LMAT.mun, 10, 'cast', G); mkMesh(trim, MAT.roof, 10, 'cast', G); mkMesh(roof, LMAT.coppi, 10, 'cast', G);
  mkMesh(flag, new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }), 10, false, G);
  mkMesh(sign, new THREE.MeshLambertMaterial({ map: signTex, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 10, false, G);
}
