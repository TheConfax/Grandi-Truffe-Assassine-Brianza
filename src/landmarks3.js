// ---------------------------------------------------------------- landmarks (monumenti): hand-made models for a few real buildings, in place of the generic box
// Meda: the Chiesa prepositurale di Santa Maria Nascente (Paolo Mezzanotte, 1939-1956: exposed brick, a giant arch with the Annunciation mosaic,
// a 22.4 m dome on a drum with 20 pink windows, the cross at about 43 m), the Palazzo del Comune in piazza Municipio (1870-1885, three floors,
// plain string courses, wooden eaves) and piazza Vittorio Veneto: Villa Antona Traversi (the Benedictine monastery of San Vittore turned into
// a neoclassical villa by Leopold Pollack), the church of San Vittore with its barocchetto facade and the Santuario del Santo Crocifisso
// (the old parish church, facade of 1893 with protiro and four statues, bell tower finished in 1920); San Pietro Martire on the Seveso border
// (Camillo Fari, consecrated 1969, rhomboid plan, the saint in bronze by Giancarlo Fontana outside). Footprints and collisions stay the OSM ones.
// f: the two facade corners; the model's x runs from the second to the first, i.e. left to right for someone facing the facade
const LANDMARKS = [
  { n: 'Chiesa di Santa Maria Nascente', x: 33.3, z: -331.6, f: [64.0, -378.0, 80.0, -362.6], build: buildChiesaMeda },
  { n: 'Municipio di Meda', x: 200.9, z: -532.2, build: buildPalazzo, o: { style: 'municipio', portal: 'door', balcony: 'iron', flags: true, sign: 'M U N I C I P I O' } },
  { n: 'Villa Antona Traversi', x: 112.8, z: -780.5, build: buildPalazzo, o: { style: 'villa', h: 14.5, front: [138.1, -741.3], portal: 'portico', arches: 5, balcony: 'stone', belv: { w: 13, d: 9, h: 3.65 } } },
  { n: 'Chiesa di San Vittore', x: 99.9, z: -755.1, f: [83.9, -763.5, 94.0, -772.2], build: buildSanVittore },
  { n: 'Santuario del Santo Crocefisso', x: 93.3, z: -822.4, f: [89.0, -801.2, 71.6, -815.9], tower: [67.5, -825.0], build: buildCrocifisso },
  { n: 'Chiesa di San Pietro Martire', x: -736.7, z: 466.7, build: buildSanPietroMeda }, // via San Carlo, by the level crossing on the Seveso border
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
const PAL_STYLE = {
  municipio: { wall: '#e3be78', trim: '#efe3c9', shut: '#4f6b4c', plinth: '#aaa397', light: ['#c9a462', '#f0d494'], bugnato: true, ped: true },
  villa: { wall: '#eee5cf', trim: '#fbf8ef', shut: '#5d7a55', plinth: '#c9c1b0', light: ['#d9cfb8', '#f8f2e4'], gShut: true },
};
const palTex = (st, lit) => canvasTex(128, 512, (g, w, h) => { // one bay, pavement to eaves; lit: the emissive map (lit windows only)
  const Y = m => h - m / MUN_H * h, R = (x0, m0, x1, m1, col) => { g.fillStyle = col; g.fillRect(x0, Y(m1), x1 - x0, Y(m0) - Y(m1)); };
  const CREAM = st.trim, GLASS = '#2b3038';
  if (lit) { R(0, 0, w, MUN_H, '#000'); R(46, 5.45, 82, 7.75, '#ffd890'); return; } // at night only the piano nobile
  R(0, 0, w, MUN_H, st.wall); noise(g, w, h, 2500, 0.12, st.light);
  R(0, 0, w, 0.5, st.plinth); // stone plinth
  if (st.bugnato) for (let m = 1.2; m < 4.4; m += 0.5) { R(0, m - 0.04, w, m, 'rgba(110,75,35,.45)'); R(0, m, w, m + 0.03, 'rgba(255,240,200,.35)'); }
  R(0, 4.36, w, 4.4, 'rgba(0,0,0,.2)'); R(0, 4.4, w, 4.8, CREAM); R(0, 8.76, w, 8.8, 'rgba(0,0,0,.2)'); R(0, 8.8, w, 9.05, CREAM); R(0, 12.1, w, MUN_H, CREAM); R(0, 12.06, w, 12.1, 'rgba(0,0,0,.2)');
  const win = (x0, m0, x1, m1, bars) => { R(x0 - 4, m0 - 0.15, x1 + 4, m1 + 0.15, CREAM); R(x0, m0, x1, m1, GLASS); R(62, m0, 66, m1, CREAM); R(x0, (m0 + m1) / 2 + 0.3, x1, (m0 + m1) / 2 + 0.36, CREAM); if (bars) for (let x = x0 + 4; x < x1; x += 7) R(x, m0, x + 1.5, m1, '#15171a'); };
  const shutters = (m0, m1) => { for (const x of [18, 88]) { R(x, m0, x + 22, m1, st.shut); for (let m = m0 + 0.08; m < m1; m += 0.12) R(x + 2, m, x + 20, m + 0.04, 'rgba(0,0,0,.25)'); } };
  if (st.gShut) shutters(1.3, 3.5); win(46, 1.3, 82, 3.5, !st.gShut); if (st.bugnato) R(58, 3.65, 70, 3.95, CREAM); // ground floor: grated with a keystone, or shuttered
  shutters(5.45, 7.75); win(46, 5.45, 82, 7.75); R(36, 5.1, 92, 5.3, '#e6d8bb'); R(34, 7.95, 94, 8.1, CREAM); // piano nobile: sill and cornice, a pediment on the municipio
  if (st.ped) { g.fillStyle = CREAM; g.beginPath(); g.moveTo(34, Y(8.1)); g.lineTo(94, Y(8.1)); g.lineTo(64, Y(8.62)); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(34, Y(8.1), 60, 2); }
  shutters(9.75, 11.45); win(46, 9.75, 82, 11.45); R(40, 9.5, 88, 9.62, '#e6d8bb');
});
const plasterTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); noise(g, w, h, 2600, 0.16, ['#d8d8d8', '#c8c8c8', '#f0f0f0']); }); // tinted by vertex colour
const tondoTex = canvasTex(128, 128, (g, w, h) => { // San Vittore on his rearing horse, the relief over the portal
  g.fillStyle = '#cbbfa6'; g.fillRect(0, 0, w, h); noise(g, w, h, 700, 0.2, ['#a99d86', '#e0d6c2']);
  g.fillStyle = '#8f846f'; g.beginPath(); g.ellipse(62, 76, 30, 14, -0.5, 0, TAU); g.fill(); g.fillRect(36, 84, 6, 26); g.fillRect(76, 60, 6, 26); g.fillRect(56, 88, 6, 24);
  g.beginPath(); g.ellipse(92, 46, 9, 15, 0.6, 0, TAU); g.fill(); g.beginPath(); g.ellipse(58, 50, 9, 16, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(58, 30, 7, 0, TAU); g.fill(); g.fillRect(64, 20, 3, 34);
  g.strokeStyle = '#6f6655'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.stroke();
}, false);
const clockTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.fillStyle = '#1d1d1f';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.translate(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.rotate(a); g.fillRect(-2, -7, 4, 14); g.restore(); }
  g.lineWidth = 5; g.strokeStyle = '#1d1d1f'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 28, 64 - 14); g.moveTo(64, 64); g.lineTo(64 - 6, 64 - 44); g.stroke();
}, false);
const LMAT = {
  brick: new THREE.MeshLambertMaterial({ map: brickTex, side: THREE.DoubleSide }), stone: new THREE.MeshLambertMaterial({ map: stoneTex, side: THREE.DoubleSide }),
  sand: new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xcbbfa6, side: THREE.DoubleSide }), plaster: new THREE.MeshLambertMaterial({ map: plasterTex, vertexColors: true, side: THREE.DoubleSide }),
  coppi: new THREE.MeshLambertMaterial({ map: coppiTex, side: THREE.DoubleSide }), trim: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  glass: new THREE.MeshLambertMaterial({ color: 0x3b3340, emissive: 0xffa6c0, emissiveIntensity: 0.06, side: THREE.DoubleSide }),
  warm: new THREE.MeshLambertMaterial({ color: 0x2f3036, emissive: 0xffc77a, emissiveIntensity: 0, side: THREE.DoubleSide }), // plain church windows, lit from inside at night
  mosaic: new THREE.MeshLambertMaterial({ map: mosaicTex, emissiveMap: mosaicTex, emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.DoubleSide }),
  tondo: new THREE.MeshLambertMaterial({ map: tondoTex }), clock: new THREE.MeshLambertMaterial({ map: clockTex, emissiveMap: clockTex, emissive: 0xfff2d0, emissiveIntensity: 0, side: THREE.DoubleSide }),
};
for (const k in PAL_STYLE) { const t = palTex(PAL_STYLE[k], false), e = palTex(PAL_STYLE[k], true); t.wrapT = e.wrapT = THREE.ClampToEdgeWrapping; LMAT[k] = new THREE.MeshLambertMaterial({ map: t, emissiveMap: e, emissive: 0xffc870, emissiveIntensity: 0 }); LM_GLOW.push({ m: LMAT[k], a: 0, b: 0.3 }); }
LM_GLOW.push({ m: LMAT.glass, a: 0.06, b: 0.9 }, { m: LMAT.warm, a: 0, b: 0.8 }, { m: LMAT.mosaic, a: 0.1, b: 0.4 }, { m: LMAT.clock, a: 0, b: 0.6 });

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
function archShape(w, y0, y1) { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, y0); s.lineTo(r, y0); s.lineTo(r, y1 - r); s.absarc(0, y1 - r, r, 0, Math.PI, false); s.lineTo(-r, y0); return s; }
// an arched window on a wall: frame and glass, facing the local direction ry (0 = +z), at (x, z) on the wall face; o: { frame, glass, col } buffers and frame colour
function lmWindow(F, Bs, w, y0, y1, x, z, ry, out = 0.03, o = {}) {
  const fr = new THREE.ShapeGeometry(archShape(w + 0.36, y0 - 0.18, y1 + 0.18), 12).translate(0, 0, out).rotateY(ry).translate(x, 0, z);
  const gl = new THREE.ShapeGeometry(archShape(w, y0, y1), 12).translate(0, 0, out + 0.03).rotateY(ry).translate(x, 0, z);
  F.geo(Bs[o.frame || 'stone'], fr, o.col ? null : boxUV(2), o.col); F.geo(Bs[o.glass || 'glass'], gl);
}
// church frame from L.f: x across the facade, +z out of it towards the square, y up from the pavement in front
function lmChurchFrame(L) {
  const [ax, az, bx, bz] = L.f, cx = (ax + bx) / 2, cz = (az + bz) / 2, W = hyp(bx - ax, bz - az), ux = (bz - az) / W, uz = -(bx - ax) / W, ry = Math.atan2(ux, uz);
  const M = new THREE.Matrix4().makeRotationY(ry).setPosition(cx, groundH(cx + ux * 2, cz + uz * 2), cz);
  return { M, F: lmFrame(M), W2: W / 2, ry };
}
function lmStatue(F, b, x, y, z, s, col) { // a stone saint on a plinth: robe, shoulders, arms folded forward, head
  F.geo(b, lmBox(0.7 * s, 0.35 * s, 0.6 * s, x, y + 0.175 * s, z), null, col);
  F.geo(b, new THREE.CylinderGeometry(0.17 * s, 0.32 * s, 1.35 * s, 8).translate(x, y + 1.025 * s, z), null, col);
  F.geo(b, new THREE.SphereGeometry(0.2 * s, 8, 6).scale(1.5, 0.75, 0.9).translate(x, y + 1.68 * s, z), null, col);
  for (const sd of [-1, 1]) F.geo(b, new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 0.62 * s, 6).rotateX(-0.5).rotateZ(sd * 0.35).translate(x + sd * 0.19 * s, y + 1.4 * s, z + 0.12 * s), null, col);
  F.geo(b, new THREE.SphereGeometry(0.13 * s, 8, 6).translate(x, y + 1.93 * s, z), null, col);
}
const URN = [[0, 0], [0.25, 0], [0.25, 0.15], [0.12, 0.25], [0.3, 0.6], [0.28, 0.85], [0.1, 1.0], [0.06, 1.15], [0.14, 1.3], [0, 1.45]];
function lmUrn(F, b, x, y, z, s, col) { F.geo(b, new THREE.LatheGeometry(URN.map(([r, h]) => new THREE.Vector2(r * s, h * s)), 10).translate(x, y, z), null, col); }
function lmCross(F, b, x, y, z, s, col) { F.geo(b, lmBox(0.12 * s, 1.4 * s, 0.12 * s, x, y + 0.7 * s, z), null, col); F.geo(b, lmBox(0.8 * s, 0.12 * s, 0.12 * s, x, y + 1.0 * s, z), null, col); }

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
function lmInsetOK(r, q) { for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length; if ((r[j][0] - r[i][0]) * (q[j][0] - q[i][0]) + (r[j][1] - r[i][1]) * (q[j][1] - q[i][1]) <= 0) return false; } return true; }
// the palazzo of the old towns: walls drawn bay by bay, cornice on wooden brackets, a hipped roof of coppi round the courtyards; L.o picks the front:
// style, h (eaves height if the map's is a guess), front (a point on the main wall, else the POI), portal 'door' | 'portico' with arches, balcony 'iron' | 'stone',
// flags, sign, belv (a belvedere on the roof over the middle of the front: { w, d, h })
function buildPalazzo(L, B, G) {
  const o = L.o, st = PAL_STYLE[o.style], H = o.h || B.h, k = H / MUN_H;
  const outer = lmSimplify(B.pts, 0.35), holes = B.holes.filter(q => Math.abs(sArea(q)) > 120).map(q => lmSimplify(q, 0.35)); // light wells stay under the roof
  const poi = D.pois.find(q => q.lm === L), [fx, fz] = o.front || (poi ? [poi.x, poi.z] : [L.x, L.z]), n = outer.length;
  let fi = 0, fd = 1e9; for (let i = 0; i < n; i++) { const a = outer[i], c = outer[(i + 1) % n], d = segDist(fx, fz, a[0], a[1], c[0], c[1]); if (d < fd) { fd = d; fi = i; } }
  const gF = groundH(fx, fz), gmin = Math.min(...outer.map(p => groundH(p[0], p[1]))), top = gF + H, bot = gmin - 0.6;
  const wall = Buf(), trim = Buf(), roof = Buf(), flag = Buf(), sign = Buf();
  const CREAM = COL(st.trim), WOOD = COL('#5e4128'), IRON = COL('#26282b'), STONE = COL('#cfc6b2'), DOOR = COL('#4a3324');
  const bayOf = (Ln, odd, bl = 3.7) => { let b = Math.max(1, Math.round(Ln / bl)); if (odd && b % 2 === 0) b++; return b; };
  const walls = (ring, hole, y0, y1, front, bl) => { // the drawing ends at the eaves y1; cornice and brackets (mensole) along the top
    const A = sArea(ring);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], Ln = hyp(dx, dz); if (Ln < 0.05) continue;
      let nx = dz / Ln, nz = -dx / Ln; if ((A < 0) !== hole) { nx = -nx; nz = -nz; }
      const [u0, u1] = Ln < 2.6 ? [0.02, 0.12] : [0, bayOf(Ln, i === front, bl)], vb = 1 - (y1 - y0) / H, base = wall.p.length / 3;
      vtx(wall, a[0], y0, a[1], nx, 0, nz, u0, vb); vtx(wall, c[0], y0, c[1], nx, 0, nz, u1, vb); vtx(wall, c[0], y1, c[1], nx, 0, nz, u1, 1); vtx(wall, a[0], y1, a[1], nx, 0, nz, u0, 1);
      if (nx * (-dz) + nz * dx > 0) wall.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else wall.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
      const ry = Math.atan2(-dz / Ln, dx / Ln), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      addBox(trim, mx + nx * 0.15, y1 - 0.16, mz + nz * 0.15, Ln + 0.3, 0.28, 0.32, CREAM, ry);
      for (let s = 0.45; s < Ln - 0.2; s += 0.9) addBox(trim, a[0] + dx / Ln * s + nx * 0.45, y1 - 0.1, a[1] + dz / Ln * s + nz * 0.45, 0.12, 0.2, 0.9, WOOD, ry);
    }
  };
  const hip = (rings, y, d) => { // coppi from the eaves (0.9 m out) up to a crest d in; rings: [[ring, isCourtyard]]
    const yr = y + 0.42 * (d + 0.9), crest = [];
    for (const [ring, hole] of rings) {
      const oo = lmOffset(ring, hole ? 0.9 : -0.9), r = lmOffset(ring, hole ? -d : d), m = ring.length; crest.push(r);
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m, P = [[oo[i][0], y, oo[i][1]], [oo[j][0], y, oo[j][1]], [r[j][0], yr, r[j][1]], [r[i][0], yr, r[i][1]]];
        const ex = P[1][0] - P[0][0], ez = P[1][2] - P[0][2], el = hyp(ex, ez) || 1, sx = P[3][0] - P[0][0], sy = P[3][1] - P[0][1], sz = P[3][2] - P[0][2];
        let nx = -ez * sy, ny = ez * sx - ex * sz, nz = ex * sy; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; } // eaves x up-slope, facing the sky
        const nl = Math.hypot(nx, ny, nz) || 1, base = roof.p.length / 3, along = q => ((q[0] - P[0][0]) * ex + (q[2] - P[0][2]) * ez) / el, up = q => Math.hypot(q[0] - P[0][0] - ex / el * along(q), q[1] - y, q[2] - P[0][2] - ez / el * along(q));
        for (const q of P) vtx(roof, q[0], q[1], q[2], nx / nl, ny / nl, nz / nl, along(q) / 2, up(q) / 2);
        roof.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
        const sb = trim.p.length / 3; // soffit
        for (const q of [ring[i], ring[j], oo[j], oo[i]]) vtx(trim, q[0], y - 0.02, q[1], 0, -1, 0, 0, 0, WOOD);
        trim.i.push(sb, sb + 1, sb + 2, sb, sb + 2, sb + 3, sb, sb + 2, sb + 1, sb, sb + 3, sb + 2);
      }
    }
    try { polyFill(roof, crest[0], crest.slice(1), yr, 2); } catch (e) { }
  };
  const rings = [[outer, false], ...holes.map(q => [q, true])];
  let d = 0.8; for (const t of [4.5, 3.5, 2.5, 1.5]) if (rings.every(([r, hole]) => lmInsetOK(r, lmOffset(r, hole ? -t : t)))) { d = t; break; }
  walls(outer, false, bot, top, fi); for (const q of holes) walls(q, true, bot, top, -1); hip(rings, top, d);
  // the front, in its own frame: x to the right of someone facing it, z out of the wall, y up from the pavement; centred on the bay of the entrance
  const a = outer[fi], c = outer[(fi + 1) % n], Ln = hyp(c[0] - a[0], c[1] - a[1]), ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln;
  let nx = ez, nz = -ex; if (sArea(outer) < 0) { nx = -nx; nz = -nz; }
  const bays = bayOf(Ln, true), bw = Ln / bays, s0 = (Math.floor(clamp(((fx - a[0]) * ex + (fz - a[1]) * ez) / Ln, 0, 0.999) * bays) + 0.5) * bw;
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(nz, 0, -nx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)).setPosition(a[0] + ex * s0, gF, a[1] + ez * s0), F = lmFrame(M);
  const box = (x, y, z, w, h, dd, col) => F.geo(trim, lmBox(w, h, dd, x, y, z), null, col);
  if (o.portal === 'door') { // stone portal with a keystone
    box(0, 1.95, 0.05, 2.4, 3.9, 0.1, DOOR); box(0, 1.95, 0.08, 0.06, 3.9, 0.1, COL('#2e2018'));
    for (const x of [-1.45, 1.45]) box(x, 2.1, 0.18, 0.5, 4.2, 0.36, STONE);
    box(0, 4.15, 0.2, 3.5, 0.5, 0.42, STONE); box(0, 4.15, 0.42, 0.45, 0.62, 0.1, CREAM); box(0, 0.06, 0.6, 4.2, 0.16, 1.2, STONE);
  } else if (o.portal === 'portico') { // the arcade of the garden front: arches on pilasters, green doors inside
    const na = o.arches, w = Math.min(2.4, bw - 0.9), yt = 4.0 * k;
    for (let i = 0; i < na; i++) {
      const x = (i - (na - 1) / 2) * bw;
      F.geo(trim, new THREE.ShapeGeometry(archShape(w, 0, yt), 10).translate(x, 0, 0.04), null, COL('#4e6b52'));
      F.geo(trim, new THREE.ShapeGeometry(archShape(w + 0.5, 0, yt + 0.25), 10).translate(x, 0, 0.02), null, CREAM);
      box(x, (yt - w / 2) / 2, 0.06, 0.06, yt - w / 2, 0.06, COL('#33463a'));
    }
    for (let i = 0; i <= na; i++) box((i - na / 2) * bw, yt / 2, 0.15, 0.55, yt, 0.3, CREAM);
    box(0, yt + 0.25, 0.18, na * bw + 0.6, 0.35, 0.36, CREAM); box(0, 0.06, 1.2, na * bw + 1.6, 0.16, 2.4, STONE);
  }
  const by = 4.8 * k + 0.12, bwid = o.portal === 'portico' ? o.arches * bw + 0.4 : 4.4; // balcony on the piano nobile string course
  if (o.balcony) {
    box(0, by, 0.6, bwid, 0.22, 1.2, STONE);
    for (let x = -bwid / 2 + 0.3; x <= bwid / 2 - 0.29; x += o.portal === 'portico' ? bw : 1.6) box(x, by - 0.35, 0.4, 0.3, 0.5, 0.8, STONE);
    if (o.balcony === 'iron') {
      box(0, by + 1.05, 1.15, 4.4, 0.06, 0.08, IRON); box(0, by + 0.2, 1.15, 4.4, 0.05, 0.06, IRON);
      for (const x of [-2.15, 2.15]) { box(x, by + 1.05, 0.62, 0.06, 0.06, 1.1, IRON); for (let t = 0.05; t < 1.0; t += 0.16) box(x, by + 0.62, 0.6 + t * 0.5, 0.025, 0.86, 0.025, IRON); }
      for (let x = -2.15; x <= 2.16; x += 0.16) box(x, by + 0.62, 1.15, 0.025, 0.86, 0.025, IRON);
    } else { // stone balustrade
      box(0, by + 0.95, 1.08, bwid, 0.12, 0.28, CREAM); box(0, by + 0.17, 1.08, bwid, 0.1, 0.28, CREAM);
      for (let x = -bwid / 2 + 0.2; x <= bwid / 2 - 0.2; x += 0.26) F.geo(trim, new THREE.CylinderGeometry(0.06, 0.09, 0.68, 6).translate(x, by + 0.56, 1.08), null, CREAM);
      for (const sd of [-1, 1]) box(sd * (bwid / 2 - 0.1), by + 0.56, 0.62, 0.2, 0.86, 1.1, CREAM);
    }
  }
  if (o.flags) for (const [x, off] of [[-1.9, 0], [1.9, 0.5]]) { // the tricolore and Europe on poles out of the railing, hanging down along the pole
    const dx = Math.sign(x) * 0.25, dy = 0.69, dz = 0.68, dl = Math.hypot(dx, dy, dz), py = by + 1.0, tip = t => [x + dx / dl * t, py + dy / dl * t, 1.1 + dz / dl * t];
    F.geo(trim, new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6).translate(0, 1.3, 0).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / dl, dy / dl, dz / dl)))).translate(x, py, 1.1), null, COL('#d8d8d2'));
    const NI = 5, NJ = 4, base = flag.p.length / 3;
    for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) { const q = tip(1.0 + 1.5 * i / NI), w = Math.sin(i * 1.3 + j * 0.9) * 0.07 * j / NJ; F.v(flag, q[0] + w, q[1] - 1.45 * j / NJ, q[2], 0, 0, 1, off + 0.5 * j / NJ, i / NI); }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const q = base + i * (NJ + 1) + j; flag.i.push(q, q + 1, q + NJ + 2, q, q + NJ + 2, q + NJ + 1); }
  }
  if (o.sign) { const w = 6.4, hh = 0.4, y = 12.2 * k, i0 = sign.p.length / 3; for (const [x, yy, u, v] of [[-w / 2, y - hh / 2, 0, 0], [w / 2, y - hh / 2, 1, 0], [w / 2, y + hh / 2, 1, 1], [-w / 2, y + hh / 2, 0, 1]]) F.v(sign, x, yy, 0.05, 0, 0, 1, u, v); sign.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); }
  if (o.belv) { // belvedere: a room on the roof with the top-floor windows, its own hipped roof and brackets
    const { w, d: bd, h } = o.belv, sb = 1.0, P = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(M); return [v.x, v.z]; };
    const ring = [P(-w / 2, -sb), P(w / 2, -sb), P(w / 2, -sb - bd), P(-w / 2, -sb - bd)];
    walls(ring, false, top - 0.4, top + h, -1, 2.6); hip([[ring, false]], top + h, bd / 2 - 0.05);
  }
  const flagTex = canvasTex(256, 64, (g, w, h) => {
    for (const [i, col] of [[0, '#009246'], [1, '#f1f2f1'], [2, '#ce2b37']]) { g.fillStyle = col; g.fillRect(i * w / 6, 0, w / 6 + 1, h); } // u runs from the pole (hoist) to the fly
    g.fillStyle = '#003399'; g.fillRect(w / 2, 0, w / 2, h); g.fillStyle = '#ffcc00';
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.beginPath(); g.arc(w * 0.75 + Math.cos(an) * 20, h / 2 + Math.sin(an) * 20, 2.6, 0, TAU); g.fill(); }
  }, false);
  mkMesh(wall, LMAT[o.style], 10, 'cast', G); mkMesh(trim, MAT.roof, 10, 'cast', G); mkMesh(roof, LMAT.coppi, 10, 'cast', G);
  if (o.flags) mkMesh(flag, new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }), 10, false, G);
  if (o.sign) {
    const signTex = canvasTex(512, 32, (g, w, h) => { g.fillStyle = '#4a3c2a'; g.font = 'bold 30px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2 + 1); g.scale(Math.min(3, w * 0.94 / g.measureText(o.sign).width), 1); g.fillText(o.sign, 0, 0); g.restore(); }, false);
    mkMesh(sign, new THREE.MeshLambertMaterial({ map: signTex, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 10, false, G);
  }
}

// San Vittore: the monastery church, a single plastered hall; the barocchetto facade in stone up a staircase, San Vittore on horseback in the tondo over
// the portal, Aimo and Vermondo in the upper niches beside the big window, urns on the corners
function buildSanVittore(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), Bs = { sand: Buf(), plaster: Buf(), coppi: Buf(), trim: Buf(), warm: Buf(), tondo: Buf() };
  const SAND = COL('#d2c6ad'), PALE = COL('#e2d8c4'), WALL = COL('#d9c8a5'), DOOR = COL('#4a3426'), NICHE = COL('#a39782');
  const sand = g => F.geo(Bs.sand, g, boxUV(2)), trim = (g, c) => F.geo(Bs.trim, g, null, c), box = (w, h, d, x, y, z, c) => trim(lmBox(w, h, d, x, y, z), c);
  const FL = 1.7, BOT = -1.2, LEN = 42.0, E = 15.5, RD = 19.4; // floor at the top of the staircase, wall foot, hall length, eaves, ridge
  for (const sd of [-1, 1]) {
    F.face(Bs.plaster, [[sd * W2, BOT, 0], [sd * W2, BOT, -LEN], [sd * W2, E, -LEN], [sd * W2, E, 0]], 2, WALL);
    F.face(Bs.coppi, [[sd * (W2 + 0.5), E - 0.1, -0.4], [0, RD, -0.4], [0, RD, -LEN - 0.5], [sd * (W2 + 0.5), E - 0.1, -LEN - 0.5]]);
    box(0.5, 0.4, LEN - 0.4, sd * (W2 + 0.2), E - 0.2, -LEN / 2 - 0.2, PALE);
    for (const z of [-3.5, -10.5, -17.5, -24.5, -31.5, -38.5]) box(0.2, E - BOT, 0.9, sd * (W2 + 0.1), (E + BOT) / 2, z, WALL); // lesene
    for (const z of [-7, -14, -21, -28, -35]) { // the oculi of the upper band
      trim(new THREE.RingGeometry(0.95, 1.3, 20).rotateY(sd * Math.PI / 2).translate(sd * (W2 + 0.03), 12.6, z), PALE);
      F.geo(Bs.warm, new THREE.CircleGeometry(0.95, 20).rotateY(sd * Math.PI / 2).translate(sd * (W2 + 0.05), 12.6, z));
    }
  }
  F.face(Bs.plaster, [[-W2, BOT, -LEN], [W2, BOT, -LEN], [W2, E, -LEN], [0, RD, -LEN], [-W2, E, -LEN]], 2, WALL);
  // facade: two orders of pilasters, volutes, pediment
  const U0 = FL + 9.6, U1 = U0 + 1.0, T0 = U1 + 7.2, T1 = T0 + 0.8, AP = T1 + 3.0, UW = 5.3;
  F.face(Bs.sand, [[-W2, BOT, 0], [W2, BOT, 0], [W2, U0, 0], [-W2, U0, 0]]); F.face(Bs.sand, [[-UW, U0, 0], [UW, U0, 0], [UW, T1, 0], [-UW, T1, 0]]); F.face(Bs.sand, [[-UW - 0.3, T1, 0], [UW + 0.3, T1, 0], [0, AP, 0]]);
  for (const x of [-W2 + 0.55, -2.9, 2.9, W2 - 0.55]) { sand(lmBox(1.0, U0 - FL, 0.4, x, (FL + U0) / 2, 0.2)); box(1.25, 0.6, 0.55, x, FL + 0.3, 0.27, PALE); box(1.25, 0.5, 0.55, x, U0 - 0.25, 0.27, PALE); }
  box(2.2, 4.2, 0.08, 0, FL + 2.1, 0.06, DOOR); box(0.05, 4.2, 0.1, 0, FL + 2.1, 0.08, COL('#2a1d14'));
  for (const x of [-1.28, 1.28]) box(0.35, 4.6, 0.25, x, FL + 2.3, 0.12, PALE);
  box(3.0, 0.45, 0.3, 0, FL + 4.5, 0.15, PALE); box(3.4, 0.25, 0.5, 0, FL + 4.9, 0.25, PALE);
  F.geo(Bs.tondo, new THREE.CircleGeometry(1.05, 24).translate(0, FL + 6.6, 0.1)); trim(new THREE.RingGeometry(1.05, 1.32, 24).translate(0, FL + 6.6, 0.09), PALE);
  for (const sd of [-1, 1]) { box(0.5, 0.9, 0.2, sd * 1.5, FL + 6.4, 0.1, PALE); box(0.6, 0.3, 0.25, sd * 0.9, FL + 7.9, 0.12, PALE); } // scrolls round the tondo
  for (const sd of [-1, 1]) { // lower niches, statues, cartouches
    const x = sd * 4.6;
    trim(new THREE.ShapeGeometry(archShape(1.35, FL + 1.9, FL + 5.6), 10).translate(x, 0, 0.02), NICHE); lmStatue(F, Bs.trim, x, FL + 2.0, 0.28, 1.55, PALE);
    box(1.3, 0.5, 0.2, x, FL + 1.45, 0.1, PALE); box(1.7, 0.25, 0.4, x, FL + 5.95, 0.2, PALE);
  }
  box(2 * W2 + 0.5, 1.0, 0.7, 0, U0 + 0.5, 0.35, SAND); box(2 * W2 + 0.8, 0.25, 0.95, 0, U1 - 0.05, 0.45, PALE);
  for (const x of [-UW + 0.4, -2.4, 2.4, UW - 0.4]) { sand(lmBox(0.8, T0 - U1, 0.35, x, (U1 + T0) / 2, 0.18)); box(1.0, 0.45, 0.5, x, T0 - 0.22, 0.25, PALE); }
  trim(new THREE.ShapeGeometry(archShape(2.4, U1 + 1.15, U1 + 5.85), 12).translate(0, 0, 0.03), PALE); F.geo(Bs.warm, new THREE.ShapeGeometry(archShape(1.9, U1 + 1.4, U1 + 5.6), 12).translate(0, 0, 0.05));
  box(2.9, 0.3, 0.4, 0, U1 + 6.2, 0.2, PALE); box(0.8, 0.6, 0.3, 0, U1 + 6.6, 0.15, PALE);
  for (const sd of [-1, 1]) {
    const x = sd * 3.85;
    trim(new THREE.ShapeGeometry(archShape(1.15, U1 + 1.2, U1 + 4.6), 10).translate(x, 0, 0.02), NICHE); lmStatue(F, Bs.trim, x, U1 + 1.3, 0.26, 1.35, PALE);
    const v = new THREE.Shape(); v.moveTo(sd * UW, U1); v.lineTo(sd * (W2 - 0.15), U1); v.quadraticCurveTo(sd * (UW + 0.25), U1 + 0.5, sd * UW, U1 + 3.4); v.lineTo(sd * UW, U1); // volute down to the lower order
    sand(new THREE.ExtrudeGeometry(v, { depth: 0.5, bevelEnabled: false, curveSegments: 10 }));
    lmUrn(F, Bs.trim, sd * (W2 - 0.3), U1, 0.3, 1.1, PALE); lmUrn(F, Bs.trim, sd * UW, T1, 0.3, 1.3, PALE);
    const sl = hyp(UW + 0.3, AP - T1), ang = Math.atan2(AP - T1, UW + 0.3); // pediment coping
    trim(new THREE.BoxGeometry(sl + 0.4, 0.3, 0.7).rotateZ(-sd * ang).translate(sd * (UW + 0.3) / 2, (T1 + AP) / 2 + 0.15, 0.2), PALE);
  }
  box(2 * UW + 0.5, 0.8, 0.6, 0, T0 + 0.4, 0.3, SAND); box(2 * UW + 0.8, 0.22, 0.85, 0, T1 - 0.05, 0.4, PALE);
  trim(new THREE.CircleGeometry(0.7, 16).scale(1, 1.3, 1).translate(0, T1 + 1.25, 0.08), PALE); box(0.5, 0.4, 0.5, 0, AP + 0.1, 0.1, PALE); lmCross(F, Bs.trim, 0, AP + 0.3, 0.1, 1.2, COL('#5b5c60'));
  for (let k = 0; k < 10; k++) { const t = FL / 10 * (k + 1), d = 3.2 - 0.32 * k; sand(lmBox(10, t - BOT, d, 0, (BOT + t) / 2, d / 2)); } // the eighteenth-century staircase
  mkMesh(Bs.sand, LMAT.sand, 10, 'cast', G); mkMesh(Bs.plaster, LMAT.plaster, 10, 'cast', G); mkMesh(Bs.coppi, LMAT.coppi, 10, 'cast', G);
  mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.warm, LMAT.warm, 10, false, G); mkMesh(Bs.tondo, LMAT.tondo, 10, false, G);
}

// Santuario del Santo Crocifisso: three naves, the 1893 facade with its protiro, four saints in niches (Antonio abate, Aimo, Vermondo, Giovanni
// Oldrati), curved wings over the aisles, statues on the pediment; the tall bell tower (1920) with clock, open belfry, balustrade and a lead dome
function buildCrocifisso(L, B, G) {
  const { F, W2, ry } = lmChurchFrame(L), Bs = { plaster: Buf(), coppi: Buf(), trim: Buf(), warm: Buf(), clock: Buf() };
  const CREAM = COL('#dcbf98'), WHITE = COL('#f1ebe0'), STAT = COL('#e6e2da'), DOOR = COL('#5a3b26'), COPPER = COL('#6f8f80'), PANEL = COL('#e3d4b8'), LEAD = COL('#5d6168'), GOLD = COL('#c9a54a');
  const wallP = (pts, c = CREAM) => F.face(Bs.plaster, pts, 2, c), trim = (g, c) => F.geo(Bs.trim, g, null, c), box = (w, h, d, x, y, z, c) => trim(lmBox(w, h, d, x, y, z), c);
  const BOT = -1.4, NW = 5.0, NE = 17.6, NR = 21.2, AE = 10.6, LEN = 40, ALEN = 36; // nave half width, nave eaves and ridge, aisle eaves, nave and aisle length
  for (const sd of [-1, 1]) { // nave over the aisle roofs with half-moon windows, aisles under lean-to roofs
    wallP([[sd * NW, AE - 0.5, -0.5], [sd * NW, AE - 0.5, -LEN], [sd * NW, NE, -LEN], [sd * NW, NE, -0.5]]);
    wallP([[sd * W2, BOT, 0], [sd * W2, BOT, -ALEN], [sd * W2, AE, -ALEN], [sd * W2, AE, 0]]);
    wallP([[sd * NW, BOT, -ALEN], [sd * W2, BOT, -ALEN], [sd * W2, AE, -ALEN], [sd * NW, AE + 2.4, -ALEN]]);
    F.face(Bs.coppi, [[sd * (W2 + 0.4), AE - 0.15, -0.3], [sd * NW, AE + 2.4, -0.3], [sd * NW, AE + 2.4, -ALEN - 0.3], [sd * (W2 + 0.4), AE - 0.15, -ALEN - 0.3]]);
    F.face(Bs.coppi, [[sd * (NW + 0.45), NE - 0.1, -0.3], [0, NR, -0.3], [0, NR, -LEN - 0.4], [sd * (NW + 0.45), NE - 0.1, -LEN - 0.4]]);
    box(0.5, 0.35, LEN, sd * (NW + 0.2), NE - 0.2, -LEN / 2, WHITE); box(0.5, 0.35, ALEN, sd * (W2 + 0.2), AE - 0.2, -ALEN / 2, WHITE);
    for (const z of [-8, -16, -24, -32]) {
      trim(new THREE.RingGeometry(1.5, 1.8, 16, 1, 0, Math.PI).rotateY(sd * Math.PI / 2).translate(sd * (NW + 0.03), 13.4, z), WHITE);
      F.geo(Bs.warm, new THREE.CircleGeometry(1.5, 16, 0, Math.PI).rotateY(sd * Math.PI / 2).translate(sd * (NW + 0.05), 13.4, z));
      lmWindow(F, Bs, 1.3, 3.6, 7.6, sd * W2, z, sd * Math.PI / 2, 0.04, { frame: 'trim', glass: 'warm', col: WHITE });
    }
  }
  wallP([[-NW, BOT, -LEN], [NW, BOT, -LEN], [NW, NE, -LEN], [0, NR, -LEN], [-NW, NE, -LEN]]);
  F.geo(Bs.plaster, new THREE.CylinderGeometry(4.2, 4.2, 13 - BOT, 20, 1, true, Math.PI / 2, Math.PI).translate(0, (BOT + 13) / 2, -LEN), wrapUV(2, Math.PI * 4.2), CREAM); // apse
  F.geo(Bs.coppi, new THREE.ConeGeometry(4.6, 2.2, 20, 1, true, Math.PI / 2, Math.PI).translate(0, 14.1, -LEN), wrapUV(2, Math.PI * 4.6, hyp(4.6, 2.2)));
  { const x = -(W2 - 3.0), z = -4.4; // the round chapel at the front corner
    F.geo(Bs.plaster, new THREE.CylinderGeometry(3.3, 3.3, 9.4 - BOT, 22, 1, true).translate(x, (BOT + 9.4) / 2, z), wrapUV(2, TAU * 3.3), CREAM);
    box(7.2, 0.3, 7.2, x, 9.4, z, WHITE); F.geo(Bs.coppi, new THREE.ConeGeometry(3.7, 1.8, 22).translate(x, 10.45, z), wrapUV(2, TAU * 3.7, hyp(3.7, 1.8)));
  }
  // facade, lower order: pilasters, side doors with pediments and relief panels, niches with saints, the portal under the protiro
  wallP([[-W2, BOT, 0], [W2, BOT, 0], [W2, AE, 0], [-W2, AE, 0]]);
  for (const x of [-W2 + 0.4, -5.7, -3.3, 3.3, 5.7, W2 - 0.4]) { box(0.8, AE, 0.3, x, AE / 2, 0.15, WHITE); box(1.0, 0.5, 0.45, x, 0.25, 0.22, WHITE); box(1.0, 0.4, 0.45, x, AE - 0.2, 0.22, WHITE); }
  const tri = (w, y0, h, x, z, c) => { const s = new THREE.Shape(); s.moveTo(-w / 2, y0); s.lineTo(w / 2, y0); s.lineTo(0, y0 + h); s.lineTo(-w / 2, y0); trim(new THREE.ShapeGeometry(s).translate(x, 0, z), c); };
  for (const sd of [-1, 1]) {
    const x = sd * 8.4;
    box(1.8, 3.6, 0.08, x, 1.8, 0.05, DOOR); for (const e of [-1, 1]) box(0.25, 3.9, 0.2, x + e * 1.02, 1.95, 0.1, WHITE); box(2.4, 0.3, 0.25, x, 3.9, 0.12, WHITE); tri(2.7, 4.05, 0.75, x, 0.14, WHITE);
    box(2.4, 1.4, 0.06, x, 6.9, 0.04, PANEL); box(2.7, 0.15, 0.12, x, 7.67, 0.06, WHITE); box(2.7, 0.15, 0.12, x, 6.13, 0.06, WHITE);
    const xn = sd * 4.5; trim(new THREE.ShapeGeometry(archShape(1.1, 1.8, 4.9), 10).translate(xn, 0, 0.02), PANEL); lmStatue(F, Bs.trim, xn, 1.9, 0.3, 1.35, STAT); tri(1.6, 5.1, 0.5, xn, 0.06, WHITE);
  }
  box(2.6, 5.0, 0.08, 0, 2.5, 0.05, DOOR); box(0.05, 5.0, 0.1, 0, 2.5, 0.08, COL('#2e2016')); box(3.6, 0.9, 0.08, 0, 8.9, 0.05, WHITE);
  for (const x of [-1.9, 1.9]) for (const z of [0.6, 3.2]) { trim(new THREE.CylinderGeometry(0.27, 0.3, 5.1, 12).translate(x, 2.85, z), WHITE); box(0.75, 0.3, 0.75, x, 0.15, z, WHITE); box(0.75, 0.35, 0.75, x, 5.55, z, WHITE); }
  box(4.6, 0.6, 3.6, 0, 6.0, 1.9, WHITE); tri(4.9, 6.3, 1.2, 0, 3.72, WHITE);
  for (const sd of [-1, 1]) F.face(Bs.trim, [[sd * 2.6, 6.25, 3.85], [0, 7.6, 3.85], [0, 7.6, 0.02], [sd * 2.6, 6.25, 0.02]], 2, COPPER);
  for (let k = 0; k < 3; k++) box(6.2 + 0.8 * (2 - k), 0.15 * (k + 1) + 0.4, 4.6 - 0.45 * k, 0, (0.15 * (k + 1) - 0.4) / 2, 2.3 - 0.22 * k, COL('#cfc6b2'));
  box(2 * W2 + 0.5, 0.9, 0.6, 0, AE + 0.45, 0.3, WHITE);
  // upper order, curved wings, pediment with three statues
  const U1 = AE + 0.9, T0 = U1 + 8.0, T1 = T0 + 0.8, AP = T1 + 3.1, UW = 5.6;
  wallP([[-UW, U1, 0], [UW, U1, 0], [UW, T1, 0], [-UW, T1, 0]]); wallP([[-UW - 0.4, T1, 0], [UW + 0.4, T1, 0], [0, AP, 0]]);
  for (const x of [-UW + 0.35, -2.9, 2.9, UW - 0.35]) { box(0.7, T0 - U1, 0.28, x, (U1 + T0) / 2, 0.14, WHITE); box(0.9, 0.35, 0.4, x, T0 - 0.18, 0.2, WHITE); }
  box(3.6, 4.6, 0.06, 0, U1 + 3.9, 0.04, PANEL); for (const y of [U1 + 1.55, U1 + 6.25]) box(3.9, 0.15, 0.12, 0, y, 0.06, WHITE);
  for (const sd of [-1, 1]) {
    const xn = sd * 4.1; trim(new THREE.ShapeGeometry(archShape(1.0, U1 + 1.6, U1 + 5.0), 10).translate(xn, 0, 0.02), PANEL); lmStatue(F, Bs.trim, xn, U1 + 1.7, 0.26, 1.3, STAT);
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI / 2; pts.push([sd * (W2 - 0.5 - (W2 - 0.5 - UW) * Math.cos(t)), T0 - (T0 - U1 - 0.3) * Math.sin(t)]); } // concave sweep down over the aisle
    const w = new THREE.Shape(); w.moveTo(sd * UW, U1); w.lineTo(sd * (W2 - 0.5), U1); for (let i = pts.length - 1; i >= 0; i--) w.lineTo(pts[i][0], pts[i][1]);
    trim(new THREE.ShapeGeometry(w).translate(0, 0, 0.01), CREAM);
    trim(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y + 0.1, 0.12))), 16, 0.17, 6), WHITE);
    trim(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12).rotateX(Math.PI / 2).translate(sd * (W2 - 0.7), U1 + 0.6, 0.2), WHITE); lmUrn(F, Bs.trim, sd * (W2 - 0.3), U1, 0.3, 1.0, WHITE);
    const sl = hyp(UW + 0.4, AP - T1), ang = Math.atan2(AP - T1, UW + 0.4);
    trim(new THREE.BoxGeometry(sl + 0.4, 0.3, 0.7).rotateZ(-sd * ang).translate(sd * (UW + 0.4) / 2, (T1 + AP) / 2 + 0.15, 0.2), WHITE);
    lmStatue(F, Bs.trim, sd * (UW + 0.1), T1, 0.2, 1.2, STAT); trim(new THREE.CylinderGeometry(0.05, 0.12, 1.1, 6).rotateZ(-sd * 1.0).translate(sd * (UW - 0.45), T1 + 2.1, 0.45), GOLD); // angels with trumpets
  }
  box(2 * UW + 0.5, 0.8, 0.6, 0, T0 + 0.4, 0.3, WHITE); box(2 * UW + 0.9, 0.22, 0.85, 0, T1 - 0.05, 0.4, WHITE);
  trim(new THREE.CircleGeometry(0.75, 16).translate(0, T1 + 1.25, 0.06), WHITE); lmStatue(F, Bs.trim, 0, AP - 0.2, 0.1, 1.4, STAT); lmCross(F, Bs.trim, 0.55, AP + 1.2, 0.1, 1.3, COL('#5b5c60'));
  // the bell tower, square and plastered: lesene, string courses, clock faces, open belfry with a bell, balustrade with urns, lantern, lead dome, cross
  {
    const [tx, tz] = L.tower, T = lmFrame(new THREE.Matrix4().makeRotationY(ry).setPosition(tx, groundH(tx, tz), tz)), H0 = 23, CK = 27.3, BL = 32.8;
    const tw = (g, c) => T.geo(Bs.trim, g, null, c), CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    T.geo(Bs.plaster, lmBox(5.6, H0 - BOT, 5.6, 0, (BOT + H0) / 2, 0), boxUV(2), CREAM); T.geo(Bs.plaster, lmBox(5.8, CK - H0, 5.8, 0, (H0 + CK) / 2, 0), boxUV(2), CREAM);
    for (const [x, z] of CORN) tw(lmBox(0.7, CK - BOT, 0.7, x * 2.65, (BOT + CK) / 2, z * 2.65), WHITE);
    for (const y of [8, 16, H0]) tw(lmBox(6.1, 0.35, 6.1, 0, y, 0), WHITE);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      tw(new THREE.ShapeGeometry(archShape(0.9, 17.5, 20.3), 8).translate(0, 0, 2.83).rotateY(a), COL('#8d826c'));
      T.geo(Bs.clock, new THREE.CircleGeometry(1.05, 24).translate(0, 25.2, 2.96).rotateY(a)); tw(new THREE.RingGeometry(1.05, 1.25, 24).translate(0, 25.2, 2.94).rotateY(a), GOLD);
      tw(lmBox(3.6, 1.0, 0.6, 0, BL - 0.5, 2.35).rotateY(a), CREAM); // arch heads of the belfry
      for (let x = -1.5; x <= 1.5; x += 0.3) tw(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6).translate(x, CK + 0.95, 2.6).rotateY(a), WHITE);
      for (let x = -2.7; x <= 2.7; x += 0.3) tw(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6).translate(x, BL + 0.95, 3.0).rotateY(a), WHITE);
      tw(lmBox(1.6, 0.7, 0.3, 0, BL + 4.2, 1.9).rotateY(a), WHITE); tw(new THREE.ShapeGeometry(archShape(0.8, BL + 1.4, BL + 3.4), 8).translate(0, 0, 1.92).rotateY(a), COL('#3a3632'));
    }
    tw(lmBox(6.7, 0.6, 6.7, 0, CK + 0.3, 0), WHITE); tw(lmBox(5.4, 0.12, 5.4, 0, CK + 1.35, 0), WHITE);
    for (const [x, z] of CORN) tw(lmBox(1.3, BL - CK - 0.6, 1.3, x * 2.25, (CK + 0.6 + BL) / 2, z * 2.25), CREAM);
    tw(lmBox(3.2, BL - CK - 0.6, 3.2, 0, (CK + 0.6 + BL) / 2, 0), COL('#2a2826'));
    tw(new THREE.LatheGeometry([[0, 0], [0.75, 0], [0.7, 0.2], [0.5, 0.7], [0.45, 1.1], [0, 1.2]].map(([r, h]) => new THREE.Vector2(r, h)), 12).translate(0, BL - 2.6, 1.7), COL('#5a4a32')); // a bell
    tw(lmBox(6.7, 0.6, 6.7, 0, BL + 0.3, 0), WHITE); tw(lmBox(6.2, 0.12, 6.2, 0, BL + 1.35, 0), WHITE);
    for (const [x, z] of CORN) lmUrn(T, Bs.trim, x * 3.0, BL + 0.6, z * 3.0, 0.9, WHITE);
    T.geo(Bs.plaster, lmBox(3.8, 3.6, 3.8, 0, BL + 0.6 + 1.8, 0), boxUV(2), CREAM); tw(lmBox(4.3, 0.4, 4.3, 0, BL + 4.4, 0), WHITE);
    tw(new THREE.SphereGeometry(2.1, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1).translate(0, BL + 4.6, 0), LEAD);
    tw(new THREE.SphereGeometry(0.3, 8, 6).translate(0, BL + 6.55, 0), GOLD); lmCross(T, Bs.trim, 0, BL + 6.8, 0, 1.1, COL('#3c3c40'));
  }
  mkMesh(Bs.plaster, LMAT.plaster, 10, 'cast', G); mkMesh(Bs.coppi, LMAT.coppi, 10, 'cast', G); mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  mkMesh(Bs.warm, LMAT.warm, 10, false, G); mkMesh(Bs.clock, LMAT.clock, 10, false, G);
}

// San Pietro Martire, Meda: the rhomboid hall under one sloping roof that climbs from the entrance tip (west) to the choir (east), brick walls
// with slit windows, concrete corners and fascia, a cross over the choir and the bronze saint at the door. No photo found yet: the shape follows the plan.
function buildSanPietroMeda(L, B, G) {
  const ring = lmSimplify(B.pts, 0.6), F = lmFrame(new THREE.Matrix4()), Bs = { brick: Buf(), trim: Buf(), warm: Buf() };
  const xs = ring.map(p => p[0]), xW = Math.min(...xs), xE = Math.max(...xs), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), bot = gy - 0.8;
  const roofY = x => gy + 7.5 + (x - xW) / (xE - xW) * 8.0, A = sArea(ring), CONC = COL('#b9b4aa'), ZINC = COL('#7f8389'), BRONZE = COL('#5b4632');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L2 = hyp(c[0] - a[0], c[1] - a[1]); if (L2 < 0.3) continue;
    let nx = (c[1] - a[1]) / L2, nz = -(c[0] - a[0]) / L2; if (A < 0) { nx = -nx; nz = -nz; }
    F.face(Bs.brick, [[a[0], bot, a[1]], [c[0], bot, c[1]], [c[0], roofY(c[0]), c[1]], [a[0], roofY(a[0]), a[1]]]);
    const ex = (c[0] - a[0]) / L2, ez = (c[1] - a[1]) / L2, n = Math.floor((L2 - 1.5) / 3.2); // slit windows of coloured glass
    for (let k = 0; k < n; k++) {
      const s0 = (L2 - (n - 1) * 3.2) / 2 + k * 3.2, x = a[0] + ex * s0 + nx * 0.05, z = a[1] + ez * s0 + nz * 0.05, top = roofY(x) - 1.2;
      if (top - gy < 3.5) continue;
      F.face(Bs.warm, [[x - ex * 0.28, gy + 1.4, z - ez * 0.28], [x + ex * 0.28, gy + 1.4, z + ez * 0.28], [x + ex * 0.28, top, z + ez * 0.28], [x - ex * 0.28, top, z - ez * 0.28]]);
    }
    const ry = Math.atan2(-ez, ex), ya = roofY(a[0]), yc = roofY(c[0]); // concrete fascia following the slope, pillar at the corner
    F.geo(Bs.trim, new THREE.BoxGeometry(L2 + 0.4, 0.7, 0.45).rotateZ(Math.atan2(yc - ya, L2)).rotateY(ry).translate((a[0] + c[0]) / 2 + nx * 0.15, (ya + yc) / 2 - 0.25, (a[1] + c[1]) / 2 + nz * 0.15), null, CONC);
    F.geo(Bs.trim, lmBox(0.6, ya - bot, 0.6, a[0], (bot + ya) / 2, a[1]), null, CONC);
  }
  F.face(Bs.trim, ring.map(p => [p[0], roofY(p[0]) + 0.08, p[1]]), 2, ZINC); // the one roof plane, in zinc
  // entrance at the west tip: concrete canopy on two posts, bronze doors; the cross over the choir; San Pietro Martire in bronze on his plinth
  const wi = xs.indexOf(xW), w = ring[wi], ei = xs.indexOf(xE), e = ring[ei], ux = 1, gw = groundH(w[0], w[1]);
  F.geo(Bs.trim, lmBox(4.2, 0.35, 9.0, w[0] - 1.6, gw + 4.0, w[1]), null, CONC);
  for (const dz of [-4.0, 4.0]) F.geo(Bs.trim, lmBox(0.35, 4.0, 0.35, w[0] - 3.4, gw + 2.0, w[1] + dz), null, CONC);
  F.geo(Bs.trim, lmBox(0.12, 3.2, 3.4, w[0] - 0.05, gw + 1.6, w[1]), null, COL('#4a3b2c'));
  F.face(Bs.warm, [[w[0] - 0.07, gw + 3.3, w[1] - 1.7], [w[0] - 0.07, gw + 3.3, w[1] + 1.7], [w[0] - 0.07, gw + 3.85, w[1] + 1.7], [w[0] - 0.07, gw + 3.85, w[1] - 1.7]]);
  lmCross(F, Bs.trim, e[0] - 1.5, roofY(e[0] - 1.5), (ring.reduce((t, p) => t + p[1], 0) / ring.length), 3.2, COL('#9a9ca0'));
  const sx = w[0] - 7.0 * ux, sz = w[1] + 5.5, sg = groundH(sx, sz);
  F.geo(Bs.trim, lmBox(1.1, 1.5, 1.1, sx, sg + 0.75, sz), null, COL('#cfc6b2')); lmStatue(F, Bs.trim, sx, sg + 1.5, sz, 1.25, BRONZE);
  mkMesh(Bs.brick, LMAT.brick, 10, 'cast', G); mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.warm, LMAT.warm, 10, false, G);
}
