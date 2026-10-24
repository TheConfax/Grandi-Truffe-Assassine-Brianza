// ---------------------------------------------------------------- street objects from OSM (build_data.py: og per tile, pw for the wires)
// pylons with their wires, poles, bumps and raised tables, bollards, blocks, hydrants, glass bells, chargers, masts, benches, bins, drinking
// fountains, playgrounds, cameras, vending machines, bike racks, post boxes. One InstancedMesh per kind per tile; the small ones fall over when
// rammed (like the street lamps), the big ones are solid. Bumps are part of the street: surfAt rises over them, so the car pitches and jolts
const OGG_KINDS = ['traliccio', 'palo', 'dosso', 'rallentatore', 'piattaforma', 'paletto', 'blocco', 'idrante', 'campana', 'ricarica', 'antenna',
  'panchina', 'cestino', 'fontanella', 'giochi', 'telecamera', 'distributore', 'rastrelliera', 'cassetta',
  'armadietti', 'pannello', 'picnic', 'fitness', 'torre_acqua', 'lavaggio'];
const OGG_MAT = new THREE.MeshLambertMaterial({ vertexColors: true }), WIRE_MAT = new THREE.LineBasicMaterial({ color: 0x2b2d30 });
// collision: r radius, h height, knock (falls over) or solid; tall ones are scaled from their modelled height to the mapped one
const OGG_SPEC = {
  traliccio: { r: 2.6, h: 30, scale: 30 }, palo: { r: 0.16, h: 9, knock: true }, paletto: { r: 0.1, h: 0.9, knock: true }, blocco: { r: 0.65, h: 0.8 },
  idrante: { r: 0.15, h: 0.8, knock: true }, campana: { r: 0.8, h: 1.9, knock: true }, ricarica: { r: 0.3, h: 1.4, knock: true }, antenna: { r: 0.6, h: 25, scale: 25 },
  panchina: { r: 0.8, h: 0.9, knock: true }, cestino: { r: 0.25, h: 1, knock: true }, fontanella: { r: 0.2, h: 1.2, knock: true }, giochi: {},
  telecamera: { r: 0.1, h: 4, knock: true }, distributore: { r: 0.55, h: 1.8, knock: true }, rastrelliera: {}, cassetta: { r: 0.22, h: 1.2, knock: true },
  armadietti: { r: 1.0, h: 2.1 }, pannello: { r: 0.4, h: 2.3 }, picnic: { r: 0.9, h: 0.8, knock: true }, fitness: { r: 0.8, h: 2.3 }, torre_acqua: { r: 3.2, h: 28, scale: 28 }, lavaggio: {},
};
const OGG_GEO = (() => {
  const F = lmFrame(new THREE.Matrix4()), up = new THREE.Vector3(0, 1, 0);
  const box = (b, w, h, d, x, y, z, col, ry = 0) => F.geo(b, lmBox(w, h, d, x, y, z, ry), null, COL(col));
  const cyl = (b, rt, rb, h, x, y, z, col, seg = 8) => F.geo(b, new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z), null, COL(col));
  const rod = (b, a, c, r, col) => { const v = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = v.length(); const g = new THREE.CylinderGeometry(r, r, L, 4).translate(0, L / 2, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, v.normalize()))); /* r128: no applyQuaternion on geometries */ F.geo(b, g.translate(a[0], a[1], a[2]), null, COL(col)); };
  const M = {
    traliccio(b) { // a lattice pylon 30 m high: four legs leaning in, rings and crosses, two cross arms for the wires
      const G = '#8b9196', leg = (y, sx, sz) => { const w = 3 - 2.3 * y / 30; return [sx * w, y, sz * w]; }, C = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
      for (const [sx, sz] of C) rod(b, leg(0, sx, sz), leg(30, sx, sz), 0.13, G);
      for (let y = 0; y < 30; y += 6) for (let i = 0; i < 4; i++) {
        const [ax, az] = C[i], [cx, cz] = C[(i + 1) % 4];
        rod(b, leg(y + 6, ax, az), leg(y + 6, cx, cz), 0.06, G); rod(b, leg(y, ax, az), leg(y + 6, cx, cz), 0.05, G); rod(b, leg(y, cx, cz), leg(y + 6, ax, az), 0.05, G);
      }
      box(b, 14, 0.5, 0.7, 0, 22, 0, G); box(b, 10, 0.5, 0.7, 0, 26.5, 0, G); cyl(b, 0.05, 0.5, 2, 0, 31, 0, G, 4);
      for (const x of [-6.5, 6.5, -4.5, 4.5]) cyl(b, 0.14, 0.14, 1.4, x, x * x > 30 ? 21 : 25.5, 0, '#d9d4c8', 6); // insulators
    },
    palo(b) { cyl(b, 0.11, 0.16, 9, 0, 4.5, 0, '#8c877d'); box(b, 1.7, 0.12, 0.12, 0, 8.4, 0, '#6b6862'); for (const x of [-0.7, 0, 0.7]) cyl(b, 0.05, 0.06, 0.25, x, 8.6, 0, '#e2ddd2', 6); },
    paletto(b) { cyl(b, 0.07, 0.08, 0.9, 0, 0.45, 0, '#3c4046'); cyl(b, 0.075, 0.075, 0.08, 0, 0.76, 0, '#e8e6df'); },
    blocco(b) { box(b, 1.2, 0.55, 0.6, 0, 0.275, 0, '#b8b3a8'); box(b, 1.2, 0.25, 0.3, 0, 0.67, 0, '#b0aba0'); },
    idrante(b) { cyl(b, 0.16, 0.18, 0.08, 0, 0.04, 0, '#8f1a1e'); cyl(b, 0.11, 0.12, 0.65, 0, 0.4, 0, '#b52126'); cyl(b, 0.04, 0.13, 0.12, 0, 0.78, 0, '#b52126'); box(b, 0.42, 0.1, 0.1, 0, 0.5, 0, '#9a1c20'); },
    campana(b) { // the green glass bell
      cyl(b, 0.75, 0.8, 1.35, 0, 0.675, 0, '#3e7a46', 12); F.geo(b, new THREE.SphereGeometry(0.75, 12, 5, 0, TAU, 0, Math.PI / 2).translate(0, 1.35, 0), null, COL('#3e7a46'));
      box(b, 0.12, 0.25, 0.12, 0, 2.2, 0, '#6d6f71'); box(b, 0.5, 0.35, 0.03, 0, 1.0, 0.78, '#e9e6dc');
      for (const a of [0.6, -0.6]) { const g = new THREE.CylinderGeometry(0.11, 0.11, 0.05, 10).rotateX(Math.PI / 2).translate(Math.sin(a) * 0.68, 1.6, Math.cos(a) * 0.68); F.geo(b, g, null, COL('#1d2a22')); }
    },
    ricarica(b) { box(b, 0.45, 1.4, 0.3, 0, 0.7, 0, '#eef1f3'); box(b, 0.3, 0.25, 0.02, 0, 1.12, 0.16, '#1d2a33'); box(b, 0.46, 0.06, 0.31, 0, 1.36, 0, '#1f9d55'); box(b, 0.12, 0.2, 0.08, 0.12, 0.75, 0.18, '#2b2f33'); },
    antenna(b) { // a telephone mast: tapered pole, a ring platform, the panels on top and a red light
      cyl(b, 0.22, 0.45, 25, 0, 12.5, 0, '#9aa0a6'); cyl(b, 1.3, 1.3, 0.15, 0, 20, 0, '#80868c', 10);
      for (let i = 0; i < 3; i++) { const a = i * TAU / 3; box(b, 0.35, 1.8, 0.14, Math.sin(a) * 0.9, 22.5, Math.cos(a) * 0.9, '#e3e5e6', a); }
      cyl(b, 0.12, 0.12, 0.2, 0, 25.1, 0, '#d0312d', 6);
    },
    panchina(b) { // facing +z, the street
      box(b, 1.8, 0.07, 0.42, 0, 0.45, 0, '#7a5a3c'); box(b, 1.8, 0.36, 0.06, 0, 0.78, -0.2, '#7a5a3c');
      for (const x of [-0.75, 0.75]) { box(b, 0.07, 0.45, 0.45, x, 0.22, 0, '#2e3236'); box(b, 0.07, 0.5, 0.06, x, 0.75, -0.21, '#2e3236'); }
    },
    cestino(b) { cyl(b, 0.04, 0.04, 1.0, 0, 0.5, -0.24, '#2e3236', 6); cyl(b, 0.22, 0.19, 0.6, 0, 0.6, 0, '#3d5a3a', 10); },
    fontanella(b) { // the Milanese "vedovella", cast-iron green
      cyl(b, 0.2, 0.22, 0.1, 0, 0.05, 0, '#28503a'); cyl(b, 0.15, 0.17, 1.0, 0, 0.6, 0, '#2f5e3a'); cyl(b, 0.06, 0.16, 0.14, 0, 1.17, 0, '#2f5e3a');
      box(b, 0.05, 0.05, 0.22, 0, 0.82, 0.2, '#b9a35a'); box(b, 0.4, 0.04, 0.3, 0, 0.12, 0.3, '#3a3d40');
    },
    giochi(b) { // a swing and a slide
      const R = '#c8392b', Y = '#e8b520', B = '#2a6fb0';
      for (const x of [-1.6, 1.6]) { rod(b, [x, 0, -0.9], [x, 2.3, 0], 0.05, R); rod(b, [x, 0, 0.9], [x, 2.3, 0], 0.05, R); }
      rod(b, [-1.6, 2.3, 0], [1.6, 2.3, 0], 0.06, R);
      for (const x of [-0.7, 0.7]) { rod(b, [x - 0.2, 2.3, 0], [x - 0.2, 0.45, 0], 0.012, '#555'); rod(b, [x + 0.2, 2.3, 0], [x + 0.2, 0.45, 0], 0.012, '#555'); box(b, 0.5, 0.05, 0.2, x, 0.43, 0, Y); }
      box(b, 0.7, 0.08, 0.7, 3.4, 1.5, 0, B); for (const [x, z] of [[3.1, -0.3], [3.7, -0.3], [3.1, 0.3], [3.7, 0.3]]) cyl(b, 0.04, 0.04, 1.5, x, 0.75, z, B, 5);
      rod(b, [3.05, 0, 0.6], [3.05, 1.5, 0.3], 0.03, Y); rod(b, [3.75, 0, 0.6], [3.75, 1.5, 0.3], 0.03, Y);
      const sl = new THREE.BoxGeometry(0.55, 0.05, 2.6); sl.rotateX(-0.62); F.geo(b, sl.translate(3.4, 0.82, -1.35), null, COL(Y));
    },
    telecamera(b) { cyl(b, 0.06, 0.08, 4, 0, 2, 0, '#7d8389', 6); box(b, 0.06, 0.06, 0.3, 0, 3.9, 0.12, '#7d8389'); box(b, 0.16, 0.15, 0.36, 0, 3.85, 0.35, '#ececec'); box(b, 0.12, 0.1, 0.02, 0, 3.85, 0.54, '#1b1d20'); },
    distributore(b) { box(b, 0.9, 1.8, 0.75, 0, 0.9, 0, '#b8322a'); box(b, 0.55, 1.15, 0.02, -0.1, 1.05, 0.38, '#20262c'); box(b, 0.16, 0.5, 0.03, 0.3, 1.2, 0.38, '#cfd3d6'); box(b, 0.5, 0.15, 0.03, -0.1, 0.3, 0.38, '#111'); },
    rastrelliera(b) { for (let i = -2; i <= 2; i++) { const x = i * 0.7; rod(b, [x, 0, -0.35], [x, 0.75, -0.35], 0.025, '#8f969c'); rod(b, [x, 0, 0.35], [x, 0.75, 0.35], 0.025, '#8f969c'); rod(b, [x, 0.75, -0.35], [x, 0.75, 0.35], 0.025, '#8f969c'); } },
    armadietti(b) { // a wall of parcel lockers, the screen in the middle column
      box(b, 2.4, 2.0, 0.6, 0, 1.0, 0, '#5a5f66'); box(b, 2.5, 0.1, 0.7, 0, 2.05, 0, '#3e4248');
      for (let c = 0; c < 5; c++) for (let r = 0; r < 5; r++) { if (c === 2 && r >= 2 && r <= 3) continue; box(b, 0.44, 0.36, 0.02, -0.96 + c * 0.48, 0.26 + r * 0.39, 0.31, r % 2 ? '#c9ccd1' : '#d9dcde'); }
      box(b, 0.36, 0.5, 0.03, 0, 1.2, 0.32, '#1b2a33');
    },
    pannello(b) { box(b, 0.08, 2.2, 0.08, -0.62, 1.1, 0, '#3e4248'); box(b, 0.08, 2.2, 0.08, 0.62, 1.1, 0, '#3e4248'); box(b, 1.3, 0.95, 0.06, 0, 1.55, 0, '#2f4a3a'); box(b, 1.4, 0.08, 0.3, 0, 2.08, 0.05, '#3e4248'); },
    picnic(b) { box(b, 1.8, 0.05, 0.75, 0, 0.74, 0, '#8a6a4a'); for (const z of [-0.6, 0.6]) box(b, 1.8, 0.05, 0.28, 0, 0.44, z, '#8a6a4a'); for (const x of [-0.7, 0.7]) { box(b, 0.08, 0.74, 0.08, x, 0.37, 0, '#6b4f3a'); box(b, 0.08, 0.08, 1.5, x, 0.4, 0, '#6b4f3a'); } },
    fitness(b) { // a pull-up bar and parallel bars
      for (const x of [-0.6, 0.6]) cyl(b, 0.05, 0.05, 2.3, x, 1.15, -0.4, '#2f6b3a', 6); rod(b, [-0.6, 2.2, -0.4], [0.6, 2.2, -0.4], 0.03, '#c9ccd1');
      for (const [x, z] of [[-0.3, 0.3], [0.3, 0.3], [-0.3, 0.9], [0.3, 0.9]]) cyl(b, 0.04, 0.04, 1.1, x, 0.55, z, '#2f6b3a', 6);
      rod(b, [-0.3, 1.1, 0.3], [-0.3, 1.1, 0.9], 0.03, '#c9ccd1'); rod(b, [0.3, 1.1, 0.3], [0.3, 1.1, 0.9], 0.03, '#c9ccd1');
    },
    torre_acqua(b) { // a concrete shaft carrying a wide tank, 28 m modelled, scaled to the mapped height
      cyl(b, 1.6, 2.0, 20, 0, 10, 0, '#c9c4b8', 12); F.geo(b, new THREE.CylinderGeometry(5.5, 1.6, 3, 16).translate(0, 21.5, 0), null, COL('#bdb7a9')); cyl(b, 5.5, 5.5, 3.5, 0, 24.75, 0, '#d4cfc3', 16);
      F.geo(b, new THREE.CylinderGeometry(1.2, 5.6, 1.2, 16).translate(0, 27.1, 0), null, COL('#8f8b84')); box(b, 0.9, 2.2, 0.1, 0, 1.1, 2.0, '#4a4d52');
    },
    lavaggio(b) { // a car wash gantry with its two brushes: drive through it
      for (const x of [-1.9, 1.9]) box(b, 0.3, 3.2, 1.2, x, 1.6, 0, '#e8e6e0'); box(b, 4.1, 0.5, 1.4, 0, 3.25, 0, '#1d4f9a');
      for (const x of [-1.2, 1.2]) cyl(b, 0.42, 0.42, 2.6, x, 1.6, 0, x < 0 ? '#e86a2a' : '#2a6fb0', 10);
    },
    cassetta(b) { cyl(b, 0.05, 0.05, 0.85, 0, 0.42, 0, '#2e3236', 6); box(b, 0.38, 0.5, 0.26, 0, 1.08, 0, '#c8102e'); box(b, 0.4, 0.06, 0.28, 0, 1.36, 0, '#a50d26'); box(b, 0.2, 0.025, 0.02, 0, 1.2, 0.14, '#1a1a1a'); },
  };
  const out = {};
  for (const k in M) {
    const b = Buf(); M[k](b); const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.setIndex(b.i);
    g.computeBoundingSphere(); out[k] = g;
  }
  return out;
})();

// ---- bumps: a profile across the street, read by surfAt for every wheel and every walker
var OGG_BUMPS = null; // var: surfAt may run before this file's turn
const BUMP_SHAPE = { dosso: { half: 0.45, h: 0.06 }, rallentatore: { half: 1.9, h: 0.08 }, piattaforma: { half: 4.2, h: 0.1, ramp: 1.5 } };
function bumpProfile(k, s) { // height at s metres along the street from the middle
  const B = BUMP_SHAPE[k], a = Math.abs(s); if (a >= B.half) return 0;
  if (B.ramp) return a < B.half - B.ramp ? B.h : B.h * (B.half - a) / B.ramp;
  const c = Math.cos(Math.PI / 2 * a / B.half); return B.h * c * c;
}
function bumpAt(x, z) {
  if (!OGG_BUMPS) return 0; let y = 0;
  OGG_BUMPS.each(x, z, x, z, u => { const dx = x - u.x, dz = z - u.z, s = dx * u.ux + dz * u.uz, c = dx * u.uz - dz * u.ux; if (Math.abs(c) < u.w / 2) y = Math.max(y, bumpProfile(u.k, s)); });
  return y;
}
OGG_BUMPS = new Grid(16);
for (const T of TILES) for (const o of T.d.og || []) {
  const k = OGG_KINDS[o[0]]; if (!BUMP_SHAPE[k]) continue;
  const x = o[1] / 10, z = o[2] / 10, ux = Math.sin(o[3]), uz = Math.cos(o[3]), w = Math.max(3, Math.min(14, o[4] || 6)), R = Math.max(BUMP_SHAPE[k].half, w / 2) + 0.5;
  OGG_BUMPS.add(x - R, z - R, x + R, z + R, { k, x, z, ux, uz, w });
}
let bumpT = 0;
function updOggetti(dt) { // a jolt in the car when you take a bump fast
  bumpT -= dt; const v = P.mode === 'car' ? P.car : null; if (!v || bumpT > 0 || v.speed < 7) return;
  const [cf] = v.circles(); if (bumpAt(cf[0], cf[1]) > 0.02) { shake = Math.max(shake, Math.min(0.7, 0.12 + v.speed * 0.025)); bumpT = 0.5; if (v.speed > 14) sfxCrash(2); }
}

const OGG_ON_ROAD_K = new Set(['dosso', 'rallentatore', 'piattaforma', 'traliccio', 'antenna', 'torre_acqua', 'lavaggio']); // as build_data.py OGG_ON_ROAD
function buildOggetti(T, G) {
  const list = T.d.og || [], by = {};
  for (let i = 0; i < list.length; i++) { const o = list[i], k = OGG_KINDS[o[0]]; if (!k) continue; (by[k] = by[k] || []).push([o[1] / 10, o[2] / 10, o[3], o[4], i]); }
  // bumps and tables: painted strips that follow their own profile, yellow and black rubber or asphalt with white teeth
  const bm = Buf(), YEL = COL('#e8b81c'), BLK = COL('#222326'), ASP = COL('#55575b'), WHT = COL('#efeee8');
  for (const k of ['dosso', 'rallentatore', 'piattaforma']) for (const [x, z, a, w0] of by[k] || []) {
    const ux = Math.sin(a), uz = Math.cos(a), nx = uz, nz = -ux, w = Math.max(3, Math.min(14, w0 || 6)), B = BUMP_SHAPE[k], n = k === 'piattaforma' ? 12 : 8, stripes = Math.max(4, Math.round(w / 0.5));
    for (let j = 0; j < stripes; j++) {
      const c0 = -w / 2 + j * w / stripes, c1 = c0 + w / stripes;
      for (let i = 0; i < n; i++) {
        const s0 = -B.half + i * 2 * B.half / n, s1 = s0 + 2 * B.half / n, sm = (s0 + s1) / 2;
        const ramp = k !== 'dosso' && Math.abs(sm) > B.half - (B.ramp || B.half * 0.6), col = k === 'dosso' ? (j % 2 ? BLK : YEL) : ramp && (j % 2) ? WHT : ASP;
        const P4 = [[s0, c0], [s1, c0], [s1, c1], [s0, c1]].map(([s, c]) => { const px = x + ux * s + nx * c, pz = z + uz * s + nz * c; return [px, H.surface(px, pz) + 0.035, pz]; });
        const base = bm.p.length / 3; for (const p of P4) vtx(bm, p[0], p[1], p[2], 0, 1, 0, 0, 0, col); triUp(bm, base, base + 1, base + 2); triUp(bm, base, base + 2, base + 3);
      }
    }
  }
  if (bm.i.length) mkMesh(bm, LMAT.trim, 6, false, G);
  // everything else: one instance each
  const o3 = new THREE.Object3D();
  for (const k in OGG_GEO) {
    let items = (by[k] || []).filter(([x, z]) => k === 'traliccio' || !inBuilding(x, z, 0));
    if (T.fine && !OGG_ON_ROAD_K.has(k)) items = items.map(it => { const q = offRoad(it[0], it[1]); return q ? [q[0], q[1], ...it.slice(2)] : null; }).filter(Boolean); // in a tile of S: off the asphalt of the ways the old engine had up in the air
    if (!items.length) continue;
    const S = OGG_SPEC[k], im = new THREE.InstancedMesh(OGG_GEO[k], OGG_MAT, items.length); im.castShadow = true; im.receiveShadow = true;
    items.forEach(([x, z, a, ex, oi], i) => {
      const gy = H.surface(x, z), sy = S.scale ? Math.max(0.4, Math.min(2, (ex || S.scale) / S.scale)) : 1;
      o3.position.set(x, gy, z); o3.rotation.set(0, a, 0); o3.scale.set(1, sy, 1); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix);
      if (!S.r) return;
      if (S.knock) {
        if (!T.ogDone) addProp({ x, z, y: gy, r: S.r, h: S.h, inst: { meshes: [im], i, ry: a, base: gy }, ogTile: T, og: oi });
        else for (const p of PROPS) if (p.ogTile === T && p.og === oi) { p.inst.meshes = [im]; if (p.broken) { o3.scale.set(0, 0, 0); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); } } // built again: what was knocked down stays down
      } else if (!T.ogDone) WALLS.add(x - S.r, z - S.r, x + S.r, z + S.r, { r: S.r, x, z, y0: gy - 3, y1: gy + S.h * sy });
    });
    G.add(im);
  }
  // wires between the pylons (and the poles): three on a big line, two on a small one
  const wp = [];
  for (const L of T.d.pw || []) {
    const pts = dec(L.p), big = L.h > 15, offs = big ? [[-6.5, -8], [6.5, -8], [-4.5, -3.5], [4.5, -3.5]] : [[-0.7, -0.6], [0.7, -0.6]];
    for (let i = 1; i < pts.length; i++) {
      const A = pts[i - 1], C = pts[i], l = hyp(C[0] - A[0], C[1] - A[1]); if (l < 0.5) continue;
      const nx = -(C[1] - A[1]) / l, nz = (C[0] - A[0]) / l, ya = H.ground(A[0], A[1]) + L.h, yc = H.ground(C[0], C[1]) + L.h;
      for (const [o, dy] of offs) wp.push(A[0] + nx * o, ya + dy, A[1] + nz * o, C[0] + nx * o, yc + dy, C[1] + nz * o);
    }
  }
  if (wp.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); G.add(new THREE.LineSegments(g, WIRE_MAT)); }
  T.ogDone = true;
}
