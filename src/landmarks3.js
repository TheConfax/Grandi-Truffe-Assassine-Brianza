// ---------------------------------------------------------------- landmarks (monumenti): hand-made models for a few real buildings, in place of the generic box
// Meda: the Chiesa prepositurale di Santa Maria Nascente (Paolo Mezzanotte, 1939-1956: exposed brick, a giant arch with the Annunciation mosaic,
// a 22.4 m dome on a drum with 20 pink windows, the cross at about 43 m), the Palazzo del Comune in piazza Municipio (1870-1885, three floors,
// plain string courses, wooden eaves) and piazza Vittorio Veneto: Villa Antona Traversi (the Benedictine monastery of San Vittore turned into
// a neoclassical villa by Leopold Pollack), the church of San Vittore with its barocchetto facade and the Santuario del Santo Crocifisso
// (the old parish church, facade of 1893 with protiro and four statues, bell tower finished in 1920); San Pietro Martire on the Seveso border
// (Camillo Fari, consecrated 1969, rhomboid plan in yellow brick with white bands, the entrance tower with its concrete screen and the saint
// in bronze by Giancarlo Fontana on a corbel). Footprints and collisions stay the OSM ones.
// f: the two facade corners; the model's x runs from the second to the first, i.e. left to right for someone facing the facade
const LANDMARKS = [
  { n: 'Chiesa di Santa Maria Nascente', x: 33.3, z: -331.6, f: [64.0, -378.0, 80.0, -362.6], build: buildChiesaMeda },
  { n: 'Municipio di Meda', x: 200.9, z: -532.2, build: buildPalazzo, o: { style: 'municipio', portal: 'door', balcony: 'iron', flags: true, sign: 'M U N I C I P I O' } },
  { n: 'Villa Antona Traversi', x: 112.8, z: -780.5, build: buildPalazzo, o: { style: 'villa', h: 14.5, front: [138.1, -741.3], portal: 'portico', arches: 5, balcony: 'stone', belv: { w: 13, d: 9, h: 3.65 } } },
  { n: 'Chiesa di San Vittore', x: 99.9, z: -755.1, f: [83.9, -763.5, 94.0, -772.2], build: buildSanVittore },
  { n: 'Santuario del Santo Crocefisso', x: 93.3, z: -822.4, f: [89.0, -801.2, 71.6, -815.9], tower: [67.5, -825.0], build: buildCrocifisso },
  { n: 'Chiesa di San Pietro Martire', x: -736.7, z: 466.7, build: buildSanPietroMeda }, // via San Carlo, by the level crossing on the Seveso border
  { n: 'Santi Nazaro e Celso', x: -755.6, z: 199.2, f: [-760.3, 202.5, -760.2, 195.8], build: buildNazaroCelso },
  { n: 'Santuario di San Pietro Martire', x: -737.4, z: 743.4, f: [-761.6, 744.4, -756.9, 724.6], also: [[-758.8, 748.8]], build: buildChiesaNeo, // Seveso, with the seminary; the 41 m tower is its own footprint
    o: { col: '#e3d9c6', trim: '#f3eee4', E: 15, E1: 9.5, UH: 6.5, uw: 5.5, niches: true, tower: { at: [-758.8, 748.8], w: 5.6, h: 32, clock: true, top: 'dome' } } },
  { n: 'Chiesa dei Santi Gervaso e Protaso', x: -1246.5, z: 1553.4, f: [-1276.2, 1558.7, -1275.9, 1546.7], build: buildChiesaNeo,
    o: { col: '#f2f0ea', trim: '#c9c4b8', E: 12, E1: 10, UH: 7, uw: 5.2, rose: true, obelisks: true, tower: { at: [-1263.0, 1567.0], w: 4.5, h: 24, clock: true, top: 'drum' } } },
  { n: 'Chiesa della Beata Vergine Immacolata', x: 881.5, z: 1959.8, f: [878.5, 1942.5, 886.8, 1944.5], build: buildChiesaRom, o: { col: '#e2bf6a', trim: '#efe2c0', E: 11, recess: '#d6b05c' } }, // Baruccana
  { n: 'Chiesa di San Giacomo', x: 1181.3, z: -451.7, f: [1186.7, -433.3, 1163.8, -443.5], len: 29.2, build: buildSanGiacomo },
  { n: 'Cappella di San Pietro da Verona Martire', x: -1707.0, z: 680.5, ry: 0.6, build: buildCappellaSPM },
  { n: 'Villa Bianca', x: -1611.1, z: 936.5, build: buildVillaBianca },
  { n: 'Secondaria I grado “Traversi”', x: 544.4, z: -384.8, build: buildPalazzo, // the Palazzo delle Scuole Professionali (Aldo Vicini, 1932) on via Indipendenza
    o: { style: 'traversi', front: [516.1, -360.2], portal: 'door', balcony: 'stone', porch: true, attic: { w: 15, h: 1.9 }, sign: 'S C V O L E    P R O F E S S I O N A L I', signW: 13, signCol: '#6a655b', fence: 6.5 } },
  { n: 'Stazione di Meda', x: 377.5, z: -540.5, build: buildPalazzo, o: { style: 'stazione', h: 8.8, front: [375.9, -545.1], sign: 'M E D A', signW: 3.2, signCol: '#5f6266', canopy: [[388.6, -548.6], [403.5, -563.2], 7.5] } }, // the 2023 makeover: white, green shutters, the steel-tree canopy
  { n: 'Villa Dho', x: -1619.6, z: 1642.0, build: buildPalazzo, o: { style: 'dho', h: 11, front: [-1600.5, 1643.9], portal: 'portico', arches: 3, ped: { w: 9, h: 2.4 }, belv: { w: 4.6, d: 4.6, h: 6.5, flat: true } } },
  { n: 'Villa Besana', x: 326.2, z: -551.4, build: buildPalazzo, o: { style: 'besana', portal: 'door', balcony: 'stone', balconyW: 11, flat: true } },
  { n: 'Casa Ferrario', x: 475.7, z: -957.0, build: buildPalazzo, o: { style: 'ferrario', h: 8.2, portal: 'door', tower: { at: [479.6, -963.0], w: 4.2, h: 6.0 } } },
];
const LM_GLOW = []; // { m, a, b }: emissive a by day, a + b once the street lamps are on
for (const L of LANDMARKS) {
  for (const T of TILES) for (const b of T.bld) {
    const [cx, cz] = centroid(b.pts); if (hyp(cx - L.x, cz - L.z) < 2) { b.lm = L; L.b = b; L.t = T.t; }
    for (const [ax, az] of L.also || []) if (hyp(cx - ax, cz - az) < 2) b.lm = L; // extra footprints the model replaces, e.g. a bell tower mapped on its own
  }
  const p = D.pois.find(q => q.n === L.n); if (p) p.lm = L; // no generic shop sign on it
}
function buildLandmarks(T, G) { for (const L of LANDMARKS) if (L.t === T.t) L.build(L, L.b, G); }

const brickTexOf = (mortar, cs, dirt) => canvasTex(256, 256, (g, w, h) => { // 2 m x 2 m of running bond
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 32; r++) for (let c = -1; c < 8; c++) { g.fillStyle = cs[(rnd() * cs.length) | 0]; g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 8 + 1, 30, 6); }
  noise(g, w, h, 3000, 0.22, dirt);
});
const brickTex = brickTexOf('#b9a58f', ['#9b5a3f', '#a6634a', '#8f5038', '#b06e50', '#94553d', '#a85e44', '#86492f', '#7c4430'], ['#5e3020', '#c98a68', '#6f3a28']);
const buffTex = brickTexOf('#d8cbb2', ['#cdb183', '#c4a676', '#d6bb8e', '#bfa071', '#d0b789', '#c9ab7c'], ['#9c8460', '#e6d6b4', '#a88f68']); // the yellow brick of the sixties
const latticeTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#2c2a2b'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d6'; for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillRect(x, y, 16, 3); g.fillRect(x, y, 3, 16); g.beginPath(); g.arc(x + 9, y + 9, 3, 0, TAU); g.fill(); } }); // concrete screen
const louvreTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#2a2a2c'; g.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 8) { g.fillStyle = '#e4ded2'; g.fillRect(0, y, w, 4); g.fillStyle = '#9a958c'; g.fillRect(0, y + 4, w, 1); } }, false);
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
  dho: { wall: '#dfbb63', trim: '#f4ead2', shut: '#3f5a3c', plinth: '#b9b09c', light: ['#c9a654', '#ecd08a'], gShut: true },
  besana: { wall: '#d8c391', trim: '#c4bfb2', shut: '#9c978c', plinth: '#a9a397', light: ['#bfa977', '#e6d4a4'], gShut: true, ped: true },
  traversi: { wall: '#d3d2cc', trim: '#e9e8e3', shut: '#ddd8cc', plinth: '#b8b2a5', light: ['#cfcabd', '#eeeae2'], H: 11.1, floors: 2, noShut: true, blinds: true, lesene: true, archedUp: true },
  stazione: { wall: '#f1efe9', trim: '#dedad1', shut: '#2f5a3a', plinth: '#9d9b96', light: ['#dcd9d2', '#ffffff'], H: 8.8, floors: 2, arched: true },
  ferrario: { wall: '#c23b2a', trim: '#e2b25a', shut: '#c23b2a', plinth: '#d9cfc0', light: ['#a83324', '#d4513c'], noShut: true },
};
const palTex = (st, lit) => canvasTex(128, 512, (g, w, h) => { // one bay, pavement to eaves; lit: the emissive map (lit windows only)
  const HH = st.H || MUN_H, Y = m => h - m / HH * h, R = (x0, m0, x1, m1, col) => { g.fillStyle = col; g.fillRect(x0, Y(m1), x1 - x0, Y(m0) - Y(m1)); };
  const CREAM = st.trim, GLASS = st.blinds ? '#7d7a73' : '#2b3038';
  if (lit) { R(0, 0, w, HH, '#000'); R(46, 5.45, 82, 7.75, '#ffd890'); return; } // at night only the piano nobile
  R(0, 0, w, HH, st.wall); noise(g, w, h, 2500, 0.12, st.light);
  R(0, 0, w, 0.5, st.plinth); // stone plinth
  if (st.bugnato) for (let m = 1.2; m < 4.4; m += 0.5) { R(0, m - 0.04, w, m, 'rgba(110,75,35,.45)'); R(0, m, w, m + 0.03, 'rgba(255,240,200,.35)'); }
  R(0, 4.36, w, 4.4, 'rgba(0,0,0,.2)'); R(0, 4.4, w, 4.8, CREAM); R(0, 8.76, w, 8.8, 'rgba(0,0,0,.2)'); if (st.floors !== 2) R(0, 8.8, w, 9.05, CREAM); R(0, HH - 0.6, w, HH, CREAM); R(0, HH - 0.64, w, HH - 0.6, 'rgba(0,0,0,.2)');
  const blinds = (x0, m0, x1, m1) => { if (st.blinds) for (let m = m0 + 0.1; m < m1; m += 0.14) R(x0, m, x1, m + 0.04, 'rgba(255,255,255,.22)'); };
  const win = (x0, m0, x1, m1, bars) => { R(x0 - 4, m0 - 0.15, x1 + 4, m1 + 0.15, CREAM); R(x0, m0, x1, m1, GLASS); blinds(x0, m0, x1, m1); if (!st.blinds) { R(62, m0, 66, m1, CREAM); R(x0, (m0 + m1) / 2 + 0.3, x1, (m0 + m1) / 2 + 0.36, CREAM); } if (bars) for (let x = x0 + 4; x < x1; x += 7) R(x, m0, x + 1.5, m1, '#15171a'); };
  const archWin = (x0, m0, x1, m1) => { const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, top = Y(m1) + r; g.fillStyle = CREAM; g.fillRect(x0 - 4, top, x1 - x0 + 8, Y(m0 - 0.15) - top); g.beginPath(); g.arc(cx, top, r + 4, Math.PI, 0); g.fill(); g.fillStyle = GLASS; g.fillRect(x0, top, x1 - x0, Y(m0) - top); g.beginPath(); g.arc(cx, top, r, Math.PI, 0); g.fill(); blinds(x0, m0, x1, m1 - r * HH / h); };
  if (st.lesene) for (const x of [0, w - 10]) { R(x, 0.5, x + 10, HH - 0.6, CREAM); R(x ? x : 9, 0.5, (x ? x : 9) + 1, HH - 0.6, 'rgba(0,0,0,.14)'); } // giant pilasters between the bays
  const shutters = (m0, m1) => { if (st.noShut) return; for (const x of [18, 88]) { R(x, m0, x + 22, m1, st.shut); for (let m = m0 + 0.08; m < m1; m += 0.12) R(x + 2, m, x + 20, m + 0.04, 'rgba(0,0,0,.25)'); } };
  if (st.gShut) shutters(1.3, 3.5); win(46, 1.3, 82, 3.5, !st.gShut); if (st.bugnato) R(58, 3.65, 70, 3.95, CREAM); // ground floor: grated with a keystone, or shuttered
  shutters(5.45, 7.75); if (st.archedUp) archWin(44, 5.45, 84, 8.3); else win(46, 5.45, 82, 7.75); R(36, 5.1, 92, 5.3, '#e6d8bb'); R(34, 7.95, 94, 8.1, CREAM); // piano nobile: sill and cornice, a pediment on the municipio
  if (st.ped) { g.fillStyle = CREAM; g.beginPath(); g.moveTo(34, Y(8.1)); g.lineTo(94, Y(8.1)); g.lineTo(64, Y(8.62)); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(34, Y(8.1), 60, 2); }
  if (st.floors !== 2) { shutters(9.75, 11.45); win(46, 9.75, 82, 11.45); R(40, 9.5, 88, 9.62, '#e6d8bb'); }
  if (st.arched) { R(44, 1.0, 84, 3.6, st.wall); g.fillStyle = CREAM; g.beginPath(); g.moveTo(44, Y(0.1)); g.lineTo(44, Y(2.9)); g.arc(64, Y(2.9), 20, Math.PI, 0); g.lineTo(84, Y(0.1)); g.fill(); R(48, 0.1, 80, 2.9, '#2b3a33'); g.fillStyle = '#2b3a33'; g.beginPath(); g.arc(64, Y(2.9), 16, Math.PI, 0); g.fill(); } // arched doors on the ground floor
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
  buff: new THREE.MeshLambertMaterial({ map: buffTex, side: THREE.DoubleSide }), louvre: new THREE.MeshLambertMaterial({ map: louvreTex, side: THREE.DoubleSide }),
  lattice: new THREE.MeshLambertMaterial({ map: latticeTex, emissiveMap: latticeTex, emissive: 0xffc77a, emissiveIntensity: 0, side: THREE.DoubleSide }),
  coppi: new THREE.MeshLambertMaterial({ map: coppiTex, side: THREE.DoubleSide }), trim: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  glass: new THREE.MeshLambertMaterial({ color: 0x3b3340, emissive: 0xffa6c0, emissiveIntensity: 0.06, side: THREE.DoubleSide }),
  warm: new THREE.MeshLambertMaterial({ color: 0x2f3036, emissive: 0xffc77a, emissiveIntensity: 0, side: THREE.DoubleSide }), // plain church windows, lit from inside at night
  mosaic: new THREE.MeshLambertMaterial({ map: mosaicTex, emissiveMap: mosaicTex, emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.DoubleSide }),
  tondo: new THREE.MeshLambertMaterial({ map: tondoTex }), clock: new THREE.MeshLambertMaterial({ map: clockTex, emissiveMap: clockTex, emissive: 0xfff2d0, emissiveIntensity: 0, side: THREE.DoubleSide }),
};
for (const k in PAL_STYLE) { const t = palTex(PAL_STYLE[k], false), e = palTex(PAL_STYLE[k], true); t.wrapT = e.wrapT = THREE.ClampToEdgeWrapping; LMAT[k] = new THREE.MeshLambertMaterial({ map: t, emissiveMap: e, emissive: 0xffc870, emissiveIntensity: 0 }); LM_GLOW.push({ m: LMAT[k], a: 0, b: 0.3 }); }
LM_GLOW.push({ m: LMAT.lattice, a: 0, b: 0.5 }, { m: LMAT.glass, a: 0.06, b: 0.9 }, { m: LMAT.warm, a: 0, b: 0.8 }, { m: LMAT.mosaic, a: 0.1, b: 0.4 }, { m: LMAT.clock, a: 0, b: 0.6 });

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
  const o = L.o, st = PAL_STYLE[o.style], H = o.h || B.h, k = H / (st.H || MUN_H);
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
  walls(outer, false, bot, top, fi); for (const q of holes) walls(q, true, bot, top, -1);
  const flatTop = (ring, y) => { // flat roof behind a parapet
    try { polyFill(trim, ring, [], y + 0.02, 2, COL('#8d8a84')); } catch (e) { }
    for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln > 0.1) addBox(trim, (a[0] + c[0]) / 2, y + 0.45, (a[1] + c[1]) / 2, Ln + 0.25, 0.9, 0.25, CREAM, Math.atan2(-(c[1] - a[1]) / Ln, (c[0] - a[0]) / Ln)); }
  };
  if (o.flat) flatTop(outer, top); else hip(rings, top, d);
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
  const by = 4.8 * k + 0.12, bwid0 = o.balconyW || (o.portal === 'portico' ? o.arches * bw + 0.4 : 4.4), bwid = bwid0; // balcony on the piano nobile string course
  if (o.porch) for (const x of [-1.9, 1.9]) { F.geo(trim, new THREE.CylinderGeometry(0.24, 0.27, by - 0.1, 14).translate(x, (by - 0.1) / 2, 1.0), null, CREAM); box(x, 0.12, 1.0, 0.7, 0.24, 0.7, STONE); box(x, by - 0.25, 1.0, 0.65, 0.25, 0.65, CREAM); }
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
  if (o.attic) { const { w, h } = o.attic; box(0, H + h / 2 - 0.1, 0.2, w, h, 0.5, CREAM); box(0, H + h + 0.05, 0.25, w + 0.5, 0.22, 0.75, CREAM); for (const sd of [-1, 1]) lmUrn(F, trim, sd * (w / 2 - 0.3), H + h + 0.15, 0.25, 1.2, CREAM); }
  if (o.sign) { const w = o.signW || 6.4, hh = o.attic ? 0.75 : 0.4, y = o.attic ? H + o.attic.h / 2 - 0.1 : ((st.H || MUN_H) - 0.5) * k, sz = o.attic ? 0.47 : 0.05, i0 = sign.p.length / 3; for (const [x, yy, u, v] of [[-w / 2, y - hh / 2, 0, 0], [w / 2, y - hh / 2, 1, 0], [w / 2, y + hh / 2, 1, 1], [-w / 2, y + hh / 2, 0, 1]]) F.v(sign, x, yy, sz, 0, 0, 1, u, v); sign.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); }
  if (o.fence) { // garden railing along the front: low wall, pillars with stone vases, iron bars, the gate on the entrance
    const zf = o.fence, xa = -(Ln - s0) - 2, xb = s0 + 2, IRONF = COL('#2f3133'), PIL = COL('#cfc9bc');
    box((xa + xb) / 2, 0.3, zf, xb - xa, 0.6, 0.4, PIL);
    for (let x = xa; x <= xb + 0.01; x += (xb - xa) / Math.round((xb - xa) / 3.4)) { box(x, 0.95, zf, 0.5, 1.9, 0.5, PIL); lmUrn(F, trim, x, 1.9, zf, 0.75, PIL); }
    for (let x = xa + 0.3; x < xb - 0.2; x += 0.16) if (Math.abs(x) > 1.6) box(x, 1.15, zf, 0.03, 1.1, 0.03, IRONF);
    box((xa + xb) / 2, 1.68, zf, xb - xa, 0.05, 0.05, IRONF); for (let x = -1.5; x <= 1.5; x += 0.2) box(x, 1.0, zf, 0.03, 2.0, 0.03, IRONF); box(0, 2.0, zf, 3.0, 0.06, 0.06, IRONF);
  }
  if (o.belv) { // belvedere: a room on the roof with the top-floor windows, its own hipped roof and brackets
    const { w, d: bd, h } = o.belv, sb = 1.0, P = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(M); return [v.x, v.z]; };
    const ring = [P(-w / 2, -sb), P(w / 2, -sb), P(w / 2, -sb - bd), P(-w / 2, -sb - bd)];
    walls(ring, false, top - 0.4, top + h, -1, 2.6); if (o.belv.flat) flatTop(ring, top + h); else hip([[ring, false]], top + h, bd / 2 - 0.05);
  }
  if (o.ped) { // pediment over the middle of the front, with an oculus
    const { w, h } = o.ped; F.face(trim, [[-w / 2, H - 0.1, 0.06], [w / 2, H - 0.1, 0.06], [0, H + h, 0.06]], 2, COL(st.wall)); F.geo(trim, new THREE.CircleGeometry(0.55, 14).translate(0, H + h * 0.38, 0.1), null, COL('#2b3038'));
    for (const sd of [-1, 1]) F.geo(trim, new THREE.BoxGeometry(hyp(w / 2, h) + 0.4, 0.3, 0.6).rotateZ(-sd * Math.atan2(h, w / 2)).translate(sd * w / 4, H + h / 2, 0.2), null, CREAM);
  }
  if (o.tower) { // a corner tower with battlements
    const { at: [tx, tz], w, h } = o.tower, q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [tx + (ex * u + nx * v) * w / 2, tz + (ez * u + nz * v) * w / 2]); // square to the front wall
    walls(q, false, bot, top, -1, 2.0); walls(q, false, top, top + h, -1, 2.0); try { polyFill(trim, q, [], top + h + 0.02, 2, COL('#8d8a84')); } catch (e) { }
    for (let i = 0; i < 4; i++) { const a = q[i], c = q[(i + 1) % 4]; for (let t = 0; t < 4; t++) { const u = (t + 0.5) / 4; addBox(trim, lerp(a[0], c[0], u), top + h + 0.45, lerp(a[1], c[1], u), 0.6, 0.9, 0.6, COL(st.wall)); } }
  }
  if (o.canopy) { // modern canopy over the platform: steel trees holding a tilted roof of glass and metal
    const [[ax, az], [bx, bz], cw] = o.canopy, Lc = hyp(bx - ax, bz - az), ux = (bx - ax) / Lc, uz = (bz - az) / Lc, gc = groundH(ax, az) + PLAT_H, STEEL = COL('#a7abb0');
    let px = -uz, pz = ux; if (inBuilding(ax + px * 3, az + pz * 3)) { px = -px; pz = -pz; } // across, away from the building
    const C = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(px, 0, pz)).setPosition(ax, gc, az));
    for (let s = 2.5; s < Lc; s += 6) { C.geo(trim, new THREE.CylinderGeometry(0.16, 0.2, 3.6, 8).translate(s, 1.8, cw / 2), null, STEEL); for (const a of [-0.6, 0.6]) for (const b of [-0.5, 0.5]) C.geo(trim, new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6).translate(0, 0.8, 0).rotateZ(a).rotateX(b).translate(s, 3.5, cw / 2), null, STEEL); }
    C.geo(trim, lmBox(Lc + 1.0, 0.18, cw + 0.6, Lc / 2, 0, cw / 2).rotateX(0.0).translate(0, 4.35, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.06)), null, COL('#7f868d'));
    C.geo(trim, lmBox(Lc + 1.0, 0.04, cw + 0.6, Lc / 2, 4.22, cw / 2), null, COL('#c9d6de'));
  }
  const flagTex = canvasTex(256, 64, (g, w, h) => {
    for (const [i, col] of [[0, '#009246'], [1, '#f1f2f1'], [2, '#ce2b37']]) { g.fillStyle = col; g.fillRect(i * w / 6, 0, w / 6 + 1, h); } // u runs from the pole (hoist) to the fly
    g.fillStyle = '#003399'; g.fillRect(w / 2, 0, w / 2, h); g.fillStyle = '#ffcc00';
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.beginPath(); g.arc(w * 0.75 + Math.cos(an) * 20, h / 2 + Math.sin(an) * 20, 2.6, 0, TAU); g.fill(); }
  }, false);
  mkMesh(wall, LMAT[o.style], 10, 'cast', G); mkMesh(trim, MAT.roof, 10, 'cast', G); mkMesh(roof, LMAT.coppi, 10, 'cast', G);
  if (o.flags) mkMesh(flag, new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }), 10, false, G);
  if (o.sign) {
    const signTex = canvasTex(512, 32, (g, w, h) => { g.fillStyle = o.signCol || '#4a3c2a'; g.font = 'bold 30px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2 + 1); g.scale(Math.min(3, w * 0.94 / g.measureText(o.sign).width), 1); g.fillText(o.sign, 0, 0); g.restore(); }, false);
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

// San Pietro Martire, Meda: the rhomboid hall in yellow brick banded in white concrete under a low copper roof; at the west tip the tall entrance
// tower: piers with curved heads, the concrete screen up the middle, louvred belfry, green spire, the bronze saint on his corbel over the door
function buildSanPietroMeda(L, B, G) {
  const ring = lmSimplify(B.pts, 0.6), F = lmFrame(new THREE.Matrix4()), Bs = { buff: Buf(), trim: Buf(), lattice: Buf(), louvre: Buf() };
  const xs = ring.map(p => p[0]), xW = Math.min(...xs), w = ring[xs.indexOf(xW)], gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), bot = gy - 0.8, top = gy + 10.0, A = sArea(ring);
  const WHITE = COL('#ece7dc'), COPPER = COL('#6f9a86'), BRONZE = COL('#4e3d2c'), DARK = COL('#2c2b2d');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, ry = Math.atan2(-ez, ex), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    F.face(Bs.buff, [[a[0], bot, a[1]], [c[0], bot, c[1]], [c[0], top, c[1]], [a[0], top, a[1]]]);
    for (let y = gy + 1.6; y < top - 0.5; y += 1.65) F.geo(Bs.trim, lmBox(Ln, 0.16, 0.06, 0, y, 0).rotateY(ry).translate(mx + nx * 0.03, 0, mz + nz * 0.03), null, WHITE); // white bands
    F.geo(Bs.trim, lmBox(Ln + 0.6, 0.45, 0.5, 0, top - 0.1, 0).rotateY(ry).translate(mx + nx * 0.2, 0, mz + nz * 0.2), null, WHITE);
    const nb = Math.max(1, Math.round(Ln / 4.2)), bw = Ln / nb; // white concrete fins, a tall strip of concrete screen in every bay
    for (let k = 0; k <= nb; k++) F.geo(Bs.trim, lmBox(0.35, top - gy, 0.3, 0, (gy + top) / 2, 0).rotateY(ry).translate(a[0] + ex * k * bw + nx * 0.15, 0, a[1] + ez * k * bw + nz * 0.15), null, WHITE);
    for (let k = 0; k < nb; k++) { const cx = a[0] + ex * (k + 0.5) * bw + nx * 0.07, cz = a[1] + ez * (k + 0.5) * bw + nz * 0.07; F.face(Bs.lattice, [[cx - ex * 0.45, gy + 1.0, cz - ez * 0.45], [cx + ex * 0.45, gy + 1.0, cz + ez * 0.45], [cx + ex * 0.45, top - 0.9, cz + ez * 0.45], [cx - ex * 0.45, top - 0.9, cz - ez * 0.45]]); }
  }
  { // low copper roof, hipped up from the eaves
    let d = 1; for (const t of [6, 4.5, 3, 2]) if (lmInsetOK(ring, lmOffset(ring, t))) { d = t; break; }
    const o = lmOffset(ring, -0.5), r = lmOffset(ring, d), yr = top + 0.22 * (d + 0.5);
    for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; F.face(Bs.trim, [[o[i][0], top + 0.1, o[i][1]], [o[j][0], top + 0.1, o[j][1]], [r[j][0], yr, r[j][1]], [r[i][0], yr, r[i][1]]], 2, COPPER); }
    F.face(Bs.trim, r.map(p => [p[0], yr, p[1]]), 2, COPPER);
    const cx = ring.reduce((t, p) => t + p[0], 0) / ring.length, cz = ring.reduce((t, p) => t + p[1], 0) / ring.length; // the copper lantern with flared sides over the hall
    const prof = [[5.2, 0], [3.6, 0.8], [2.4, 1.9], [1.5, 3.2], [1.0, 4.6], [0.9, 5.4]].map(([r0, h]) => new THREE.Vector2(r0, h));
    F.geo(Bs.trim, new THREE.LatheGeometry(prof, 4).translate(cx, yr - 0.1, cz), null, COPPER);
    F.geo(Bs.trim, lmBox(1.3, 1.1, 1.3, cx, yr + 5.95, cz).rotateY(Math.PI / 4), null, WHITE); F.geo(Bs.trim, new THREE.ConeGeometry(1.0, 0.9, 4).translate(cx, yr + 6.95, cz), null, COPPER);
  }
  // the entrance tower at the west tip, in its own frame: x across its front, +z out towards via San Carlo
  const gw = groundH(w[0] - 2, w[1]), T = lmFrame(new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(w[0] - 1.0, gw, w[1]));
  const tb = g => T.geo(Bs.buff, g, boxUV(2)), tt = (g, c) => T.geo(Bs.trim, g, null, c), CW = 2.7, PW = 1.9, D = 7.0, H = 23.5;
  tb(lmBox(2 * CW, H + 0.8, D, 0, (H - 0.8) / 2, -D / 2));
  for (const sd of [-1, 1]) { // piers rising past the core, their heads curving in
    const x0 = sd * CW, x1 = sd * (CW + PW);
    tb(lmBox(PW, H + 0.8, D + 0.6, (x0 + x1) / 2, (H - 0.8) / 2, -D / 2 + 0.3));
    const hd = new THREE.Shape(); hd.moveTo(x0, H); hd.lineTo(x1, H); hd.lineTo(x1, H + 3.6); hd.quadraticCurveTo(x0 + sd * 0.2, H + 3.4, x0, H + 1.4); hd.lineTo(x0, H);
    tb(new THREE.ExtrudeGeometry(hd, { depth: D + 0.6, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -D + 0.3));
    for (let y = 2.6; y < H; y += 2.6) tt(lmBox(PW + 0.02, 0.18, 0.05, (x0 + x1) / 2, y, 0.62), WHITE);
  }
  tt(lmBox(3.6, 5.5, 0.08, 0, 2.6, 0.04), WHITE); tt(lmBox(3.0, 5.0, 0.1, 0, 2.5, 0.1), DARK); tt(lmBox(0.05, 5.0, 0.12, 0, 2.5, 0.12), COL('#4a3b2c')); tt(lmBox(4.0, 0.3, 1.6, 0, 5.45, 0.8), WHITE); // door under its canopy
  T.geo(Bs.lattice, new THREE.PlaneGeometry(1.6, 10.5).translate(0, 13.6, 0.07)); tt(lmBox(2.0, 10.9, 0.06, 0, 13.6, 0.0), WHITE); // the screen up the front
  T.geo(Bs.louvre, new THREE.PlaneGeometry(3.0, 3.4).translate(0, H - 1.6, 0.05)); T.geo(Bs.louvre, new THREE.PlaneGeometry(3.0, 3.4).rotateY(Math.PI).translate(0, H - 1.6, -D - 0.05));
  tt(lmBox(3.4, 0.25, 0.3, 0, H - 3.4, 0.15), WHITE); tt(lmBox(2 * CW + 0.1, 0.3, D + 0.1, 0, H + 0.95, -D / 2), WHITE);
  tt(new THREE.ConeGeometry(1.1, 3.4, 4).rotateY(Math.PI / 4).translate(0, H + 2.8, -1.4), COPPER); tt(new THREE.SphereGeometry(0.2, 8, 6).translate(0, H + 4.6, -1.4), COPPER);
  for (const sd of [-1, 1]) { // louvres and a column of small windows on the flanks, green canopies at the foot
    const xf = sd * (CW + PW + 0.06);
    T.geo(Bs.louvre, new THREE.PlaneGeometry(2.6, 4.2).rotateY(sd * Math.PI / 2).translate(xf, H - 2.4, -D / 2 - 0.4));
    for (let y = 7.5; y < H - 5; y += 2.0) tt(lmBox(0.06, 0.55, 0.55, xf, y, -1.2), DARK);
    tt(lmBox(3.4, 0.18, 1.6, sd * (CW + PW + 1.7), 3.4, -D + 1.2), COPPER);
  }
  tt(lmBox(1.0, 0.35, 0.8, -(CW + PW / 2), 7.8, 0.75), WHITE); lmStatue(T, Bs.trim, -(CW + PW / 2), 7.95, 0.75, 1.15, BRONZE); // San Pietro Martire, Giancarlo Fontana
  for (let k = 0; k < 4; k++) tt(lmBox(14 - 2 * k, 0.15, 1.2 + 0.0 * k, 0, 0.15 * k - 0.05, 2.0 + 1.2 * (3 - k) / 2), COL('#cfc8b8')); // the sagrato steps
  mkMesh(Bs.buff, LMAT.buff, 10, 'cast', G); mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.lattice, LMAT.lattice, 10, false, G); mkMesh(Bs.louvre, LMAT.louvre, 10, false, G);
}

// ---------------------------------------------------------------- generic pieces for the smaller churches: body on the footprint, facades, bell towers
const skelTex = canvasTex(64, 128, (g, w, h) => { // the danse macabre panels of Santi Nazaro e Celso: a white skeleton on red ochre
  g.fillStyle = '#c4785c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#efe6d6'; g.fillStyle = '#efe6d6'; g.lineWidth = 3;
  g.beginPath(); g.arc(32, 22, 8, 0, TAU); g.fill(); g.beginPath(); g.moveTo(32, 30); g.lineTo(32, 76); g.moveTo(20, 40); g.lineTo(44, 40); g.moveTo(22, 48); g.lineTo(42, 48); g.moveTo(24, 56); g.lineTo(40, 56);
  g.moveTo(20, 40); g.lineTo(14, 70); g.moveTo(44, 40); g.lineTo(52, 66); g.moveTo(32, 76); g.lineTo(22, 116); g.moveTo(32, 76); g.lineTo(42, 116); g.moveTo(52, 30); g.lineTo(52, 100); g.stroke();
  g.strokeStyle = '#8a3a2a'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
}, false);
const madonnaTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#d9c19a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f4f86'; g.beginPath(); g.moveTo(64, 14); g.lineTo(84, 64); g.lineTo(44, 64); g.fill(); g.fillStyle = '#e8c9a4'; g.beginPath(); g.arc(64, 14, 7, 0, TAU); g.fill(); g.strokeStyle = '#c9a54a'; g.lineWidth = 2; g.beginPath(); g.arc(64, 14, 10, 0, TAU); g.stroke(); g.fillStyle = '#7a2a2a'; g.fillRect(20, 30, 14, 34); g.fillRect(94, 30, 14, 34); }, false);
LMAT.skel = new THREE.MeshLambertMaterial({ map: skelTex }); LMAT.madonna = new THREE.MeshLambertMaterial({ map: madonnaTex });
// walls on the footprint ring (plaster or brick), cornice, hipped roof of coppi from the eaves to a crest; returns the crest height
function lmBody(F, Bs, ring, y0, E, o = {}) {
  const A = sArea(ring), wb = Bs[o.wall || 'plaster'];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.2) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    F.face(wb, [[a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], E, c[1]], [a[0], E, a[1]]], 2, o.col);
    if (o.trim) F.geo(Bs.trim, lmBox(Ln + 0.3, 0.35, 0.4, 0, E - 0.18, 0).rotateY(Math.atan2(-(c[1] - a[1]) / Ln, (c[0] - a[0]) / Ln)).translate((a[0] + c[0]) / 2 + nx * 0.15, 0, (a[1] + c[1]) / 2 + nz * 0.15), null, o.trim);
  }
  let d = 0.6; for (const t of [o.d || 5, 4, 3, 2, 1.2]) if (lmInsetOK(ring, lmOffset(ring, t))) { d = t; break; }
  const oo = lmOffset(ring, -(o.over || 0.6)), r = lmOffset(ring, d), yr = E + (o.slope || 0.45) * (d + (o.over || 0.6)), rb = Bs[o.roof || 'coppi'];
  for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; F.face(rb, [[oo[i][0], E, oo[i][1]], [oo[j][0], E, oo[j][1]], [r[j][0], yr, r[j][1]], [r[i][0], yr, r[i][1]]], 2, o.roofCol); }
  try { F.face(rb, r.map(p => [p[0], yr, p[1]]), 2, o.roofCol); } catch (e) { }
  return yr;
}
// a plastered bell tower in its own frame: lesene, string courses, clock faces, open belfry, cornice, then a lead dome, a drum with a little dome, or a spire
function lmTower(T, Bs, o) {
  const w = o.w, h = o.h, col = COL(o.col), tr = COL(o.trim), tw = (g, c) => T.geo(Bs.trim, g, null, c), BT = h + 4.2, CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  T.geo(Bs.plaster, lmBox(w, h + 1.5, w, 0, (h - 1.5) / 2, 0), boxUV(2), col);
  for (const [x, z] of CORN) tw(lmBox(0.55, h + 1.5, 0.55, x * (w / 2 - 0.15), (h - 1.5) / 2, z * (w / 2 - 0.15)), tr);
  for (let y = h / 3; y < h; y += h / 3) tw(lmBox(w + 0.25, 0.3, w + 0.25, 0, y, 0), tr);
  tw(lmBox(w + 0.6, 0.5, w + 0.6, 0, h + 0.25, 0), tr);
  for (const [x, z] of CORN) tw(lmBox(1.0, BT - h - 0.5, 1.0, x * (w / 2 - 0.5), (h + 0.5 + BT) / 2, z * (w / 2 - 0.5)), col);
  tw(lmBox(w - 1.6, BT - h - 0.5, w - 1.6, 0, (h + 0.5 + BT) / 2, 0), COL('#2a2826'));
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2; tw(lmBox(w - 0.2, 0.8, 0.4, 0, BT - 0.4, w / 2 - 0.2).rotateY(a), col);
    if (o.clock) { T.geo(Bs.clock, new THREE.CircleGeometry(w * 0.2, 20).translate(0, h - w * 0.35, w / 2 + 0.03).rotateY(a)); tw(new THREE.RingGeometry(w * 0.2, w * 0.24, 20).translate(0, h - w * 0.35, w / 2 + 0.02).rotateY(a), tr); }
  }
  tw(lmBox(w + 0.6, 0.5, w + 0.6, 0, BT + 0.25, 0), tr);
  let y = BT + 0.5;
  if (o.top === 'drum') { T.geo(Bs.plaster, new THREE.CylinderGeometry(w * 0.32, w * 0.34, 2.2, 12).translate(0, y + 1.1, 0), boxUV(2), col); y += 2.2; tw(new THREE.SphereGeometry(w * 0.36, 12, 6, 0, TAU, 0, Math.PI / 2).translate(0, y, 0), COL('#8b8d92')); y += w * 0.36; }
  else if (o.top === 'spire') { tw(new THREE.ConeGeometry(w * 0.62, w * 1.4, 4).rotateY(Math.PI / 4).translate(0, y + w * 0.7, 0), COL(o.spire || '#a24a35')); y += w * 1.4; }
  else { tw(new THREE.SphereGeometry(w * 0.5, 14, 7, 0, TAU, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, y, 0), COL('#5d6168')); y += w * 0.4; }
  tw(new THREE.SphereGeometry(0.22, 8, 6).translate(0, y + 0.15, 0), COL('#c9a54a')); lmCross(T, Bs.trim, 0, y + 0.3, 0, 1.0, COL('#3c3c40'));
}
const lmBuffers = () => ({ plaster: Buf(), coppi: Buf(), trim: Buf(), warm: Buf(), clock: Buf(), brick: Buf(), skel: Buf(), madonna: Buf() });
function lmFlush(Bs, G) {
  for (const [k, m, sh] of [['plaster', LMAT.plaster, 'cast'], ['coppi', LMAT.coppi, 'cast'], ['trim', LMAT.trim, 'cast'], ['brick', LMAT.brick, 'cast'], ['warm', LMAT.warm, false], ['clock', LMAT.clock, false], ['skel', LMAT.skel, false], ['madonna', LMAT.madonna, false]]) if (Bs[k].i.length) mkMesh(Bs[k], m, 10, sh, G);
}

// neoclassical two-order facade of the Brianza parish churches: pilasters, portal, niches with saints, upper order with a window or a rose,
// pediment with statues and urns; L.o: { col, trim, E1 (lower order top), UH (upper order height), uw (its half width), rose, niches, obelisks, tower }
function buildChiesaNeo(L, B, G) {
  const { F, W2, ry } = lmChurchFrame(L), o = L.o, Bs = lmBuffers(), F0 = lmFrame(new THREE.Matrix4());
  const ring = lmSimplify(B.pts, 0.5), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), COLW = COL(o.col), TRIM = COL(o.trim), STAT = COL('#ece8e0'), DOOR = COL('#4a3426');
  lmBody(F0, Bs, ring, gy - 1, gy + o.E, { col: COLW, trim: TRIM, d: 4 });
  const box = (w, h, d, x, y, z, c = TRIM) => F.geo(Bs.trim, lmBox(w, h, d, x, y, z), null, c), wallP = pts => F.face(Bs.plaster, pts, 2, COLW);
  const E1 = o.E1, U1 = E1 + 0.9, T0 = U1 + o.UH, T1 = T0 + 0.8, uw = o.uw, AP = T1 + uw * 0.5;
  wallP([[-W2, -1.5, 0.02], [W2, -1.5, 0.02], [W2, E1, 0.02], [-W2, E1, 0.02]]); wallP([[-uw, U1 - 0.1, 0.02], [uw, U1 - 0.1, 0.02], [uw, T1, 0.02], [-uw, T1, 0.02]]); wallP([[-uw - 0.3, T1, 0.02], [uw + 0.3, T1, 0.02], [0, AP, 0.02]]);
  const px = [-W2 + 0.4, -uw + 0.4, -1.9, 1.9, uw - 0.4, W2 - 0.4].filter((x, i, a) => a.findIndex(y => Math.abs(y - x) < 0.9) === i);
  for (const x of px) { box(0.8, E1, 0.3, x, E1 / 2, 0.17); box(1.0, 0.45, 0.45, x, 0.22, 0.22); box(1.0, 0.4, 0.45, x, E1 - 0.2, 0.22); }
  box(2 * W2 + 0.5, 0.9, 0.6, 0, E1 + 0.45, 0.3);
  for (const x of [-uw + 0.35, -1.6, 1.6, uw - 0.35]) { box(0.7, T0 - U1, 0.28, x, (U1 + T0) / 2, 0.16); box(0.9, 0.35, 0.4, x, T0 - 0.18, 0.2); }
  box(2 * uw + 0.5, 0.8, 0.6, 0, T0 + 0.4, 0.3); box(2 * uw + 0.9, 0.22, 0.85, 0, T1 - 0.05, 0.4);
  // portal: arched door in a frame under a small pediment
  F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(3.1, 0, 6.0), 12).translate(0, 0, 0.05), null, TRIM); box(2.5, 4.6, 0.1, 0, 2.3, 0.08, DOOR);
  F.geo(Bs.madonna, new THREE.CircleGeometry(1.15, 14, 0, Math.PI).translate(0, 4.65, 0.1)); box(3.8, 0.3, 0.5, 0, 6.3, 0.25);
  if (o.niches) for (const sd of [-1, 1]) { const x = sd * (uw > 4.2 ? 3.6 : W2 - 1.6); F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(1.1, 2.0, 5.2), 10).translate(x, 0, 0.04), null, COL('#cfc4ae')); lmStatue(F, Bs.trim, x, 2.1, 0.3, 1.3, STAT); }
  if (o.rose) { F.geo(Bs.warm, new THREE.CircleGeometry(1.6, 20).translate(0, (U1 + T0) / 2, 0.06)); F.geo(Bs.trim, new THREE.RingGeometry(1.6, 2.1, 24).translate(0, (U1 + T0) / 2, 0.05), null, TRIM); for (let k = 0; k < 8; k++) F.geo(Bs.trim, lmBox(0.08, 3.2, 0.06, 0, 0, 0).rotateZ(k * Math.PI / 8).translate(0, (U1 + T0) / 2, 0.08), null, TRIM); }
  else { F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(1.9, U1 + 1.2, U1 + 4.6), 10).translate(0, 0, 0.04), null, TRIM); F.geo(Bs.warm, new THREE.ShapeGeometry(archShape(1.4, U1 + 1.45, U1 + 4.35), 10).translate(0, 0, 0.06)); }
  for (const sd of [-1, 1]) {
    if (W2 > uw + 0.6) { const v = new THREE.Shape(); v.moveTo(sd * uw, U1 - 0.1); v.lineTo(sd * (W2 - 0.2), U1 - 0.1); v.quadraticCurveTo(sd * (uw + 0.3), U1 + 0.4, sd * uw, U1 + Math.min(3.2, o.UH * 0.6)); v.lineTo(sd * uw, U1 - 0.1); F.geo(Bs.trim, new THREE.ShapeGeometry(v, 8).translate(0, 0, 0.03), null, COLW); lmUrn(F, Bs.trim, sd * (W2 - 0.4), U1 - 0.1, 0.3, 1.0, TRIM); }
    const sl = hyp(uw + 0.3, AP - T1), ang = Math.atan2(AP - T1, uw + 0.3);
    F.geo(Bs.trim, new THREE.BoxGeometry(sl + 0.4, 0.3, 0.7).rotateZ(-sd * ang).translate(sd * (uw + 0.3) / 2, (T1 + AP) / 2 + 0.15, 0.2), null, TRIM);
    lmStatue(F, Bs.trim, sd * uw, T1, 0.25, 1.2, STAT);
    if (o.obelisks) F.geo(Bs.trim, new THREE.ConeGeometry(0.45, 3.2, 4).rotateY(Math.PI / 4).translate(sd * (W2 - 0.5), E1 + 0.9 + 1.6, 0.3), null, TRIM);
  }
  F.geo(Bs.trim, new THREE.CircleGeometry(0.6, 14).translate(0, T1 + 1.0, 0.05), null, TRIM); box(0.5, 0.4, 0.5, 0, AP + 0.1, 0.1); lmCross(F, Bs.trim, 0, AP + 0.3, 0.1, 1.3, COL('#5b5c60'));
  for (let k = 0; k < 3; k++) box(2 * W2 + 1.6 - k * 0.8, 0.15 * (k + 1) + 0.4, 2.6 - 0.8 * k, 0, (0.15 * (k + 1) - 0.4) / 2, 1.3 - 0.4 * k, COL('#cfc6b2'));
  if (o.tower) { const [tx, tz] = o.tower.at; lmTower(lmFrame(new THREE.Matrix4().makeRotationY(ry).setPosition(tx, groundH(tx, tz), tz)), Bs, { col: o.col, trim: o.trim, ...o.tower }); }
  lmFlush(Bs, G);
}
// Santi Nazaro e Celso: the little church of the old Farga, gable roof on wide wooden eaves, skeletons and the Madonna painted on the front, a glazed lantern for a bell
function buildNazaroCelso(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), Bs = lmBuffers(), ring = lmSimplify(B.pts, 0.3), F0 = lmFrame(new THREE.Matrix4()), gy = Math.min(...ring.map(p => groundH(p[0], p[1])));
  const W = COL('#ddb48e'), ED = COL('#c27a5a'), WOOD = COL('#4b3a2c'), E = 4.6, R = 6.9, LEN = 8.3;
  lmBody(F0, Bs, ring, gy - 1, gy + E, { col: COL('#e8d7bd'), d: 3, over: 0.9, slope: 0.55 });
  F.face(Bs.plaster, [[-W2, -1, 0.02], [W2, -1, 0.02], [W2, E, 0.02], [0, R, 0.02], [-W2, E, 0.02]], 2, W);
  for (const sd of [-1, 1]) { // wide eaves over the front, rafters showing
    F.face(Bs.coppi, [[sd * (W2 + 0.8), E - 0.35, 1.2], [0, R + 0.15, 1.2], [0, R + 0.15, -LEN], [sd * (W2 + 0.8), E - 0.35, -LEN]]);
    F.geo(Bs.trim, new THREE.BoxGeometry(hyp(W2 + 0.8, R - E + 0.5) + 0.2, 0.35, 0.25).rotateZ(-sd * Math.atan2(R - E + 0.5, W2 + 0.8)).translate(sd * (W2 + 0.8) / 2, (R + E) / 2 - 0.15, 1.1), null, WOOD);
    F.geo(Bs.skel, new THREE.PlaneGeometry(1.3, 2.6).translate(sd * 2.0, 2.6, 0.05)); F.geo(Bs.trim, lmBox(0.1, E, 0.06, sd * (W2 - 0.25), E / 2, 0.04), null, ED);
  }
  F.geo(Bs.trim, lmBox(1.6, 2.8, 0.1, 0, 1.4, 0.06), null, COL('#3c5654')); F.geo(Bs.trim, lmBox(2.0, 3.1, 0.06, 0, 1.55, 0.03), null, COL('#bcb3a2'));
  F.geo(Bs.madonna, new THREE.CircleGeometry(1.0, 14, 0, Math.PI).translate(0, 3.35, 0.05)); F.geo(Bs.trim, lmBox(1.6, 0.5, 0.06, 0, 5.3, 0.04), null, COL('#e2c9a0'));
  for (let k = 0; k < 2; k++) F.geo(Bs.trim, lmBox(4.0 - k, 0.15, 1.2 - 0.5 * k, 0, 0.07 + 0.15 * k - 0.05, 0.6 - 0.25 * k), null, COL('#a9a397'));
  // the glazed bell lantern at the front of the ridge
  F.geo(Bs.trim, lmBox(1.0, 0.25, 1.0, 0, R + 0.15, -1.0), null, WOOD); F.geo(Bs.warm, new THREE.CylinderGeometry(0.45, 0.45, 0.8, 6).translate(0, R + 0.7, -1.0));
  F.geo(Bs.trim, new THREE.ConeGeometry(0.75, 0.55, 6).translate(0, R + 1.35, -1.0), null, COL('#2f3d38')); lmCross(F, Bs.trim, 0, R + 1.6, -1.0, 0.9, COL('#2b2b2e'));
  lmFlush(Bs, G);
}
// a neo-romanesque front: plain gable with hanging arches, a great arch round the portal and the three lancets, a little bell spire on the apex
function buildChiesaRom(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), o = L.o, Bs = lmBuffers(), ring = lmSimplify(B.pts, 0.5), F0 = lmFrame(new THREE.Matrix4()), gy = Math.min(...ring.map(p => groundH(p[0], p[1])));
  const W = COL(o.col), TR = COL(o.trim), E = o.E, AP = o.E + W2 * 0.75;
  lmBody(F0, Bs, ring, gy - 1, gy + E - 1.5, { col: W, trim: TR, d: 4 });
  F.face(Bs.plaster, [[-W2, -1, 0.02], [W2, -1, 0.02], [W2, E, 0.02], [0, AP, 0.02], [-W2, E, 0.02]], 2, W);
  for (const sd of [-1, 1]) {
    F.geo(Bs.trim, lmBox(0.7, E, 0.35, sd * (W2 - 0.35), E / 2, 0.18), null, W);
    const sl = hyp(W2, AP - E), ang = Math.atan2(AP - E, W2); F.geo(Bs.trim, new THREE.BoxGeometry(sl + 0.3, 0.3, 0.5).rotateZ(-sd * ang).translate(sd * W2 / 2, (E + AP) / 2 + 0.1, 0.2), null, TR);
    for (let t = 0.08; t < 0.95; t += 0.09) F.geo(Bs.trim, new THREE.RingGeometry(0.22, 0.32, 8, 1, Math.PI, Math.PI).translate(sd * W2 * (1 - t), E + (AP - E) * t - 0.45, 0.05), null, TR); // archetti pensili
  }
  const aw = Math.min(5.2, W2 * 1.2), atop = E + 1.4;
  F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(aw + 0.6, 0, atop + 0.3), 14).translate(0, 0, 0.03), null, TR); F.geo(Bs.plaster, new THREE.ShapeGeometry(archShape(aw, 0, atop), 14).translate(0, 0, 0.06), null, COL(o.recess || o.col));
  F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(2.6, 0, 4.6), 10).translate(0, 0, 0.08), null, TR); F.geo(Bs.trim, lmBox(2.0, 3.6, 0.08, 0, 1.8, 0.12), null, COL('#4a3426'));
  F.geo(Bs.madonna, new THREE.CircleGeometry(0.95, 12, 0, Math.PI).translate(0, 3.65, 0.12)); F.geo(Bs.trim, lmBox(aw - 0.4, 0.25, 0.3, 0, 5.4, 0.15), null, TR);
  for (const x of [-0.85, 0, 0.85]) F.geo(Bs.warm, new THREE.ShapeGeometry(archShape(0.5, 6.0, x ? 8.4 : 8.9), 6).translate(x, 0, 0.1));
  F.geo(Bs.trim, lmBox(0.8, 0.8, 0.8, 0, AP + 0.3, -0.2), null, TR); F.geo(Bs.trim, new THREE.ConeGeometry(0.5, 2.2, 6).translate(0, AP + 1.8, -0.2), null, COL('#8c8a86')); lmCross(F, Bs.trim, 0, AP + 2.8, -0.2, 0.8, COL('#2b2b2e'));
  for (let k = 0; k < 2; k++) F.geo(Bs.trim, lmBox(aw + 2 - k, 0.15, 1.8 - 0.6 * k, 0, 0.07 + 0.15 * k - 0.05, 0.9 - 0.3 * k), null, COL('#bdb6a8'));
  lmFlush(Bs, G);
}
// San Giacomo, Meda: a long brick hall under one metal slope that climbs from the low wall on via Emilia to the high east corner, where the cross
// stands; a lower wing leans the other way beside it; the big round window of louvres on the south end, tall slit windows down the low side
function buildSanGiacomo(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), Bs = lmBuffers(), LEN = L.len, ROOF = COL('#55595e'), GREY = COL('#d9d6cf'), FRAME = COL('#e8e4dc');
  const mono = (x0, x1, y0, y1) => { // walls and a single roof slope from height y0 at x0 to y1 at x1
    F.face(Bs.brick, [[x0, -1, 0], [x0, -1, -LEN], [x0, y0, -LEN], [x0, y0, 0]]); F.face(Bs.brick, [[x1, -1, 0], [x1, -1, -LEN], [x1, y1, -LEN], [x1, y1, 0]]);
    for (const z of [0, -LEN]) F.face(Bs.brick, [[x0, -1, z], [x1, -1, z], [x1, y1, z], [x0, y0, z]]);
    const k = (y1 - y0) / (x1 - x0), e = Math.sign(x1 - x0) * 0.45;
    F.face(Bs.trim, [[x0 - e, y0 - k * e + 0.05, 0.45], [x1 + e, y1 + k * e + 0.05, 0.45], [x1 + e, y1 + k * e + 0.05, -LEN - 0.45], [x0 - e, y0 - k * e + 0.05, -LEN - 0.45]], 2, ROOF);
    for (const z of [0.47, -LEN - 0.47]) F.geo(Bs.trim, new THREE.BoxGeometry(hyp(x1 - x0, y1 - y0) + 1.0, 0.25, 0.1).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2 + 0.12, z), null, FRAME);
  };
  const XH = 1.5; mono(-W2, XH, 4.8, 12.0); mono(XH, W2, 8.0, 4.6);
  for (let z = -4; z > -LEN + 3; z -= 4.5) { F.geo(Bs.trim, lmBox(0.06, 3.1, 0.8, -W2 - 0.04, 2.3, z), null, FRAME); F.geo(Bs.warm, new THREE.PlaneGeometry(0.55, 2.8).rotateY(-Math.PI / 2).translate(-W2 - 0.08, 2.3, z)); } // slit windows on the low side
  F.geo(Bs.trim, lmBox(0.08, 2.5, 1.5, -W2 - 0.05, 1.25, -LEN + 6), null, COL('#9aa0a6'));
  const cx = -4.3, wy = 6.0; // the round window of louvres on the south end
  F.geo(Bs.trim, new THREE.CircleGeometry(2.1, 28).translate(cx, wy, 0.06), null, GREY); F.geo(Bs.trim, new THREE.RingGeometry(2.1, 2.35, 28).translate(cx, wy, 0.07), null, FRAME);
  for (let k = 0; k < 10; k++) { const y = -1.8 + k * 0.4; F.geo(Bs.trim, lmBox(2 * Math.sqrt(Math.max(0, 4.4 - y * y)) - 0.3, 0.13, 0.08, 0, 0, 0).rotateZ(0.5).translate(cx, wy + y, 0.1), null, COL('#6d7075')); }
  F.geo(Bs.trim, lmBox(1.6, 2.5, 0.1, -W2 + 2.6, 1.25, 0.06), null, COL('#9aa0a6'));
  F.geo(Bs.trim, lmBox(0.7, 4.8, 0.08, XH - 0.8, 3.0, 0.06), null, COL('#b9bdc1')); // glazed strip at the high corner
  F.geo(Bs.trim, lmBox(0.18, 4.6, 0.18, XH - 0.3, 12.0 + 2.1, -0.3), null, COL('#3a3a3c')); F.geo(Bs.trim, lmBox(1.9, 0.16, 0.16, XH - 0.3, 15.2, -0.3), null, COL('#3a3a3c')); // the cross over the high corner
  lmFlush(Bs, G);
}
// the Cappella di San Pietro da Verona at the edge of Seveso: a white cube under a pyramid of coppi, a grated round window and door in stone frames
function buildCappellaSPM(L, B, G) {
  const ring = lmSimplify(B.pts, 0.3), F0 = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), [cx, cz] = centroid(ring);
  lmBody(F0, Bs, ring, gy - 1, gy + 4.4, { col: COL('#f0eee8'), trim: COL('#e6e2da'), d: 3.2, over: 0.5, slope: 0.62 });
  const T = lmFrame(new THREE.Matrix4().makeRotationY(L.ry).setPosition(cx, gy, cz)), STONE = COL('#bdb6a8');
  T.geo(Bs.trim, new THREE.ShapeGeometry(archShape(1.2, 1.9, 3.3), 10).translate(0, 0, 3.05), null, STONE); T.geo(Bs.trim, new THREE.ShapeGeometry(archShape(0.9, 2.05, 3.15), 10).translate(0, 0, 3.08), null, COL('#2c2a28'));
  T.geo(Bs.trim, lmBox(1.3, 2.4, 0.1, 0, 1.2, 0).translate(3.05, 0, 0).rotateY(0), null, STONE); T.geo(Bs.trim, lmBox(0.1, 2.2, 1.0, 3.1, 1.1, 0), null, COL('#3a3027'));
  lmFlush(Bs, G);
}
// Villa Bianca, Seveso (Giuseppe Terragni, 1937): white rationalist volumes, ribbon windows, the thin roof slab flying out over the terraces
function buildVillaBianca(L, B, G) {
  const ring = lmSimplify(B.pts, 0.4), F0 = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), A = sArea(ring);
  const WHITE = COL('#f2f1ec'), GLASS = COL('#38424c'), TOP = gy + 7.6;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    F0.face(Bs.plaster, [[a[0], gy - 1, a[1]], [c[0], gy - 1, c[1]], [c[0], TOP, c[1]], [a[0], TOP, a[1]]], 2, WHITE);
    if (Ln > 3) for (const [y0, y1] of [[gy + 1.1, gy + 2.6], [gy + 4.6, gy + 6.4]]) { const m = 0.6, ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln; F0.face(Bs.trim, [[a[0] + ex * m + nx * 0.04, y0, a[1] + ez * m + nz * 0.04], [c[0] - ex * m + nx * 0.04, y0, c[1] - ez * m + nz * 0.04], [c[0] - ex * m + nx * 0.04, y1, c[1] - ez * m + nz * 0.04], [a[0] + ex * m + nx * 0.04, y1, a[1] + ez * m + nz * 0.04]], 2, GLASS); }
  }
  const o = lmOffset(ring, -1.8); F0.face(Bs.trim, o.map(p => [p[0], TOP + 0.6, p[1]]), 2, WHITE); F0.face(Bs.trim, o.map(p => [p[0], TOP + 0.3, p[1]]), 2, COL('#d8d6d0'));
  for (let i = 0; i < o.length; i++) { const j = (i + 1) % o.length; F0.face(Bs.trim, [[o[i][0], TOP + 0.3, o[i][1]], [o[j][0], TOP + 0.3, o[j][1]], [o[j][0], TOP + 0.6, o[j][1]], [o[i][0], TOP + 0.6, o[i][1]]], 2, WHITE); }
  for (const p of ring) F0.geo(Bs.trim, lmBox(0.3, 0.6, 0.3, p[0], TOP + 0.3, p[1]), null, WHITE);
  lmFlush(Bs, G);
}

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
      const ga = groundH(a[0], a[1]), gc = groundH(c[0], c[1]), b0 = side.p.length / 3;
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
      const vm = (sec[0] + sec[1]) / 2, [x, z] = at(s, vm), gy = groundH(x, z) + PLAT_H, dst = hyp(x - st.x, z - st.z), si = Math.round(s - s0);
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
function buildParkingLines(T, G) {
  const b = FBuf(), W = COL('#e9e7df'), Y = COL('#f2c230'), BLUE = COL('#2c5aa8'), F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf() }, lamps = Buf(), heads = Buf(), sign = Buf();
  T.stalls = [];
  const quad = (x, z, ux, uz, a0, a1, w0, w1, col) => { const nx = -uz, nz = ux, i0 = b.p.length / 3; for (const [s, v] of [[a0, w0], [a1, w0], [a1, w1], [a0, w1]]) vtx(b, x + ux * s + nx * v, 0.05, z + uz * s + nz * v, 0, 1, 0, 0, 0, col); b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); };
  for (const a of T.d.a || []) {
    if (a.t !== 4) continue; const P = dec(a.p); if (P.length < 3) continue; const [cx, cz] = centroid(P);
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang), nx = -uz, nz = ux, proj = P.map(([x, z]) => (x - cx) * ux + (z - cz) * uz);
    const S0 = Math.min(...proj) + 1.0, S1 = Math.max(...proj) - 1.0, lot = [];
    const ok = (s, v) => { const x = cx + ux * s + nx * v, z = cz + uz * s + nz * v; return inPoly(x, z, P) && !inBuilding(x, z, 0.3) && !onAnyRoad(x, z, -0.4); };
    for (const row of [0, 1]) {
      let run = [];
      const flush = () => { // a run of free stalls side by side: the lines between them, the yellow one every eighth
        if (run.length) { const yi = run.length >= 8 ? 1 : -1; run.forEach((st, k) => { const col = k === yi ? Y : W; quad(cx, cz, ux, uz, st.s - 1.31, st.s - 1.19, st.v0, st.v1, col); quad(cx, cz, ux, uz, st.s + 1.19, st.s + 1.31, st.v0, st.v1, col); if (k === yi) { quad(cx, cz, ux, uz, st.s - 0.5, st.s + 0.5, (st.v0 + st.v1) / 2 - 0.5, (st.v0 + st.v1) / 2 + 0.5, BLUE); st.dis = true; } lot.push(st); }); }
        run = [];
      };
      for (let s = S0 + 1.25; s <= S1 - 1.25; s += 2.5) {
        const sec = lmSection(P, cx, cz, ux, uz, s), sa = lmSection(P, cx, cz, ux, uz, s - 1.2), sb = lmSection(P, cx, cz, ux, uz, s + 1.2);
        if (!sec || !sa || !sb) { flush(); continue; }
        const lo = Math.max(sec[0], sa[0], sb[0]), hi = Math.min(sec[1], sa[1], sb[1]), w = hi - lo;
        if (w < 5 || (row === 1 && w < 10.5)) { flush(); continue; }
        const v0 = row ? hi - 4.8 : lo + 0.2, v1 = row ? hi - 0.2 : lo + 4.8, vm = (v0 + v1) / 2;
        if (!ok(s, vm) || !ok(s - 0.9, vm) || !ok(s + 0.9, vm)) { flush(); continue; }
        const x = cx + ux * s + nx * vm, z = cz + uz * s + nz * vm;
        run.push({ s, v0, v1, x, z, h: Math.atan2(nx, nz) + (row ? 0 : Math.PI) }); // nose towards the aisle in the middle
      }
      flush();
    }
    T.stalls.push(...lot);
    if (lot.length >= 10) { // furniture on the bigger lots: lamps along the middle, the meter and the P sign at one end
      const mid = (S0 + S1) / 2, sec = lmSection(P, cx, cz, ux, uz, mid);
      for (let s = S0 + 6; s < S1 - 3; s += 22) { const sc = lmSection(P, cx, cz, ux, uz, s); if (!sc) continue; const v = (sc[0] + sc[1]) / 2, x = cx + ux * s + nx * v, z = cz + uz * s + nz * v; if (onAnyRoad(x, z, 0.5) && !onFoot(x, z) || inBuilding(x, z, 0.5)) continue; const gy = groundH(x, z); addBox(lamps, x, gy + 3.8, z, 0.15, 7.6, 0.15, null); addBox(heads, x + ux * 0.5, gy + 7.55, z + uz * 0.5, 1.2, 0.18, 0.35, null); addBox(heads, x - ux * 0.5, gy + 7.55, z - uz * 0.5, 1.2, 0.18, 0.35, null); }
      const e = lmSection(P, cx, cz, ux, uz, S0 + 0.5);
      if (e) { const x = cx + ux * (S0 + 0.3) + nx * e[0] - nx * -0.6, z = cz + uz * (S0 + 0.3) + nz * e[0] + nz * 0.6, gy = groundH(x, z), ry = Math.atan2(-uz, ux);
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
// park furniture: along the footpaths inside parks and gardens, benches every so often (on alternate sides) and lamp posts, a bin by each bench;
// a flower bed fills the middle of a small round plaza where paths meet
function buildParkFurniture(T, G) {
  const parks = (T.d.a || []).filter(a => a.t === 2).map(a => { const o = dec(a.p); return { o, bb: bbox(o) }; }).filter(p => p.o.length >= 3);
  if (!parks.length) return;
  const inPark = (x, z, m = 8) => parks.some(p => { // inside a park or garden, or along its edge
    if (x < p.bb[0] - m || x > p.bb[2] + m || z < p.bb[1] - m || z > p.bb[3] + m) return false; if (inPoly(x, z, p.o)) return true;
    for (let i = 0; i < p.o.length; i++) { const A = p.o[i], C = p.o[(i + 1) % p.o.length]; if (segDist(x, z, A[0], A[1], C[0], C[1]) < m) return true; } return false; });
  const F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf() }, lamps = Buf(), heads = Buf();
  const WOOD = COL('#7a5a3c'), IRON = COL('#2e3236'), BIN = COL('#3d5a3a'), x0 = T.cx - TS / 2, z0 = T.cz - TS / 2;
  for (const r of D.roads) {
    if (r.c !== 6 || r.d || r.t) continue;
    let acc = 0, k = 0;
    for (let i = 1; i < r.g.length; i++) {
      const A = N[r.g[i - 1]], C = N[r.g[i]], Ln = hyp(C[0] - A[0], C[1] - A[1]); if (Ln < 0.5) continue;
      const ux = (C[0] - A[0]) / Ln, uz = (C[1] - A[1]) / Ln, nx = -uz, nz = ux, ry = Math.atan2(-uz, ux);
      for (let s = (12 - acc % 12); s < Ln; s += 12) {
        const x = A[0] + ux * s, z = A[1] + uz * s; k++;
        if (x < x0 || x >= x0 + TS || z < z0 || z >= z0 + TS || !inPark(x, z)) continue;
        const sd = k % 2 ? 1 : -1, off = r.w / 2 + 0.9, bx = x + nx * off * sd, bz = z + nz * off * sd, gy = groundH(bx, bz);
        if (inBuilding(bx, bz, 1.2) || onAnyRoad(bx, bz, 0.2) && !onFoot(bx, bz)) continue;
        if (k % 3) { // bench facing the path, a bin beside it
          const R = ry + (sd > 0 ? Math.PI : 0), at = (dx, dz) => [bx + Math.cos(R) * dx + Math.sin(R) * dz, bz - Math.sin(R) * dx + Math.cos(R) * dz];
          F.geo(Bs.trim, lmBox(1.8, 0.07, 0.42, 0, gy + 0.45, 0).rotateY(R).translate(bx, 0, bz), null, WOOD);
          F.geo(Bs.trim, lmBox(1.8, 0.36, 0.06, 0, gy + 0.78, -0.2).rotateY(R).translate(bx, 0, bz), null, WOOD);
          for (const e of [-0.75, 0.75]) { const [px, pz] = at(e, 0); F.geo(Bs.trim, lmBox(0.07, 0.45, 0.45, 0, 0, 0).rotateY(R).translate(px, gy + 0.22, pz), null, IRON); }
          const [qx, qz] = at(1.4, 0); F.geo(Bs.trim, new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10).translate(qx, gy + 0.37, qz), null, BIN);
        } else { addBox(lamps, bx, gy + 2.0, bz, 0.11, 4.0, 0.11, null); addBox(heads, bx, gy + 4.05, bz, 0.42, 0.22, 0.42, null); } // park lamp
      }
      acc += Ln;
    }
  }
  for (const r of D.roads) { // small closed loops of path (a round plaza): a raised bed of flowers inside
    if (r.c !== 6 || r.g.length < 8 || r.g[0] !== r.g[r.g.length - 1]) continue;
    const pts = r.g.map(i => N[i]), [cx, cz] = centroid(pts.slice(0, -1)), rad = Math.min(...pts.map(p => hyp(p[0] - cx, p[1] - cz))) - r.w / 2 - 0.3;
    if (rad < 1.5 || rad > 9 || tileOf(cx, cz) !== T.t || !inPark(cx, cz, 14) || onAnyRoad(cx, cz, 0) && !onFoot(cx, cz)) continue;
    const gy = groundH(cx, cz);
    F.geo(Bs.trim, new THREE.CylinderGeometry(rad, rad, 0.4, 28).translate(cx, gy + 0.2, cz), null, COL('#bcb6aa'));
    F.geo(Bs.trim, new THREE.CylinderGeometry(rad - 0.25, rad - 0.25, 0.1, 28).translate(cx, gy + 0.42, cz), null, COL('#5d4632'));
    for (let i = 0; i < 40; i++) { const a = i * 2.4, d = (rad - 0.6) * Math.sqrt((i + 0.5) / 40); F.geo(Bs.trim, new THREE.IcosahedronGeometry(0.28, 0).translate(cx + Math.cos(a) * d, gy + 0.6, cz + Math.sin(a) * d), null, COL(['#d8364a', '#f0c23a', '#e87ab0', '#ffffff', '#5f8f3a'][i % 5])); }
  }
  if (Bs.trim.i.length) mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  if (lamps.i.length) { mkMesh(lamps, MAT.lamp, 10, 'cast', G); mkMesh(heads, MAT.lampHead, 10, false, G); }
}
