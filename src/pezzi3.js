// ---------------------------------------------------------------- the map in pieces (docs/motore.md "Caricamento a pezzi"; src/pezzi.py writes them)
// A tile of the grid goes up three steps, each asking the one before on itself and on the 8 round it, so what it reads across its edges is always there:
//   l0  its piece has arrived: T.d, S, decks, ramps, water, the step layer (nothing needed: a tile without a file is bare ground, l0 at once)
//   lw  laid out: buildings, trees, barriers, gates... in the grids the physics and the build read (tileLay)
//   built: its meshes (buildTileGen). What is not there yet the physics takes from the ground of mappa/suolo.bin (H.* old engine): it never falls into nothing.
// The steps come down in the opposite order, farther out. The tile objects stay (TILES), and with them what was broken: BAR_ROTTE, GATE_ROTTI, the props.
const R_MESH = 760, R_FREE = 1150, R_STESO = 1150, R_TOGLI = 1550, R_PEZZO = 1530, R_BUTTA = 1950;
const PZ = { vola: 0, MAX: 12, arrivi: [], vx: 0, vz: 0, lx: null, lz: 0, lt: 0, presi: 0, byte: 0, falliti: 0, usa: { arrivo: 0, stesura: 0, mesh: 0 }, fette: {} };
const RLT = new Map(), RVT = new Map(); for (const [t, r] of D.rl) { let l = RLT.get(t); if (!l) RLT.set(t, l = []); l.push(r); } for (const [t, r] of D.rv) { let l = RVT.get(t); if (!l) RVT.set(t, l = []); l.push(r); }
const FOUNT_T = new Map(), FUEL_T = new Map(); for (const f of FOUNT) { const t = tileOf(f.x, f.z); let l = FOUNT_T.get(t); if (!l) FOUNT_T.set(t, l = []); l.push(f); } for (const f of FUEL) { const t = tileOf(f.x, f.z); let l = FUEL_T.get(t); if (!l) FUEL_T.set(t, l = []); l.push(f); }

const vicini = T => T.vic || (T.vic = (() => { const i = T.t % NTX, j = Math.floor(T.t / NTX), o = []; for (let b = -1; b <= 1; b++) for (let a = -1; a <= 1; a++) { const I = i + a, J = j + b; if (I >= 0 && J >= 0 && I < NTX && J < NTZ) o.push(TILES[I + NTX * J]); } return o; })());

// ---- step l0
function pzChiedi(T) {
  T.vola = true; PZ.vola++;
  fetch(`mappa/p/${T.t % NTX}_${Math.floor(T.t / NTX)}.bin?v=${D.ver}`).then(r => { if (!r.ok) throw new Error('HTTP ' + r.status); return r.arrayBuffer(); }).then(ab => { PZ.byte += ab.byteLength; PZ.presi++; return gunzip(ab); }).then(b => { PZ.arrivi.push([T, b]); })
    .catch(e => { PZ.falliti++; T.riprova = performance.now() + 3000; console.warn('pezzo ' + T.t + ': ' + e.message); }).finally(() => { T.vola = false; PZ.vola--; });
}
function tileBase(T) { // the sidewalks and platforms the old engine and the step layer stand on
  const d = T.d; T.sd = []; T.pf = null;
  for (const q of d.sd || []) {
    const o = dec(q.p), k = q.k.map(dec), bb = bbox(o); if (o.length < 3) continue;
    let per = 0; for (let i = 0; i < o.length; i++) per += hyp(o[(i + 1) % o.length][0] - o[i][0], o[(i + 1) % o.length][1] - o[i][1]);
    const A = Math.abs(sArea(o)); if (A < 10 || A / per < 0.45) continue; // shards and slivers left between junctions are not sidewalks
    const rec = { o, k, bb }; T.sd.push(rec); SIDEG.add(bb[0], bb[1], bb[2], bb[3], rec);
  }
  for (const q of d.a || []) if (q.t === 5) { const o = dec(q.p); if (o.length < 3) continue; const rec = { o, k: (q.k || []).map(dec), bb: bbox(o) }; (T.pf || (T.pf = [])).push(rec); PLATG.add(rec.bb[0], rec.bb[1], rec.bb[2], rec.bb[3], rec); }
  if (!TUTTO && H.tile(T.t)) stepsAdd(T, d.mds || []);
}
function pzArriva(T, b) {
  const jl = new DataView(b.buffer, b.byteOffset, 4).getUint32(0, true), d = JSON.parse(PZ_DEC.decode(b.subarray(4, 4 + jl))), s = b.subarray(4 + jl);
  T.d = d; T.reg0 = []; GRID_REC = T.reg0;
  try { H.dentro(T.t, d, s); tileBase(T); } finally { GRID_REC = null; }
  T.l0 = true; VIVI.add(T);
}
function pzVia(T) { // the whole piece out
  if (T.reg0) disfaGriglie(T.reg0); T.reg0 = null; H.fuori(T.t, T.d);
  T.d = NOD; T.sd = []; T.pf = null; T.l0 = false; T.asG = T.apG = T.sfP = T.hardP = undefined; T.ngr = null; T.sgr = null;
  if (!T.group && !T.lw) VIVI.delete(T);
}

// ---- step lw
function tileLay(T) {
  T.reg1 = []; GRID_REC = T.reg1;
  try {
    for (const q of T.d.dk || []) { const dk = H.deck(q.ord); deckInit(dk); rampPaint(dk, T); }
    H.gradini = false; tileLinee(T); layMuri(T); H.gradini = true; layResto(T);
  } finally { H.gradini = true; GRID_REC = null; }
  T.lw = true;
}
function layStrade(T) {
  for (const ri of T.d.rp || []) {
    const r = D.roads[ri];
    if (r.d) { laySolidi(T, r); for (let k = 1; k < r.g.length; k++) { const a = N[r.g[k - 1]], b = N[r.g[k]]; if (tileOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) !== T.t) continue; const ya = H.node(r.g[k - 1]), yb = H.node(r.g[k]), hw = r.w / 2, m = hw + (r.b ? 0 : 14); DECKG.add(Math.min(a[0], b[0]) - m, Math.min(a[1], b[1]) - m, Math.max(a[0], b[0]) + m, Math.max(a[1], b[1]) + m, { ax: a[0], az: a[1], bx: b[0], bz: b[1], ya, yb, hw, r, emb: !r.b }); } }
    if (r.x && !r.t && r.c === 0) layFlat(T, r);
  }
}
function layResto(T) { // what the world used to lay out at the start with the step layer already in place
  layStrade(T); layFence(T);
  for (const r of RLT.get(T.t) || []) layRilevati(r);
  for (const r of RVT.get(T.t) || []) layFiume(r);
  layCancelli(T); layPorte(T);
  for (const f of FOUNT_T.get(T.t) || []) layFontana(f);
  for (const f of FUEL_T.get(T.t) || []) layPompe(f);
  tettiFuel(T); layDossi(T); layParcheggi(T);
  if (!COTTURA) for (const [bi, big, h] of T.d.sup || []) { const B = T.bld[bi]; if (B) { B.big = big; B.h = h; } }
  { const r0 = GRID_REC; GRID_REC = null; for (const g of LX) if (g.drive && !g.bars && tileOf(g.x, g.z) === T.t) lxSbarre(g); GRID_REC = r0; }
  confineTile(T);
}
function tileUnlay(T) {
  if (T.reg1) disfaGriglie(T.reg1); T.reg1 = null; T.lw = false;
  for (const pc of T.barPc || []) if (pc.subs) for (const q of pc.subs) WALLS.del(pc.seg.ax, pc.seg.az, pc.seg.bx, pc.seg.bz, q); // the pieces of a hedge a car has cut
  T.bld = []; T.fe = []; T.tr = []; T.ba = null; T.barPc = null; T.flat = null; T.solidi = null; T.gates = null; T.doors = null; T.ngr = null; T.sgr = null;
}

// ---- what the bake decided, ready for a tile: fronts of the shops and plain signs
const bldDi = ([t, i]) => TILES[t].bld[i];
function ngDelTile(T) {
  if (COTTURA) return ngList().filter(s => s.tile === T.t);
  if (T.ngr) return T.ngr;
  T.ngr = (T.d.ngf || []).map(r => { const q = { ...r, b: bldDi(r.b), m: NG_MODELS[r.cls][r.mi] }; if (q.b.gtop === undefined) q.b.gtop = bldTop(q.b); return q; });
  for (const B of T.bld) if (B.big && B.big.front && Array.isArray(B.big.front.b)) B.big.front.b = bldDi(B.big.front.b);
  return T.ngr;
}
function signDelTile(T) {
  if (COTTURA) return signList().filter(s => tileOf(s.p.x, s.p.z) === T.t && !s.b.lm);
  return T.sgr || (T.sgr = (T.d.sgf || []).map(s => ({ ...s, p: D.pois[s.p], b: bldDi(s.b) })));
}

// ---- every frame, a slice: pieces asked for and opened, tiles laid out, meshes built, what is far taken away
function tileTick(px, pz, budgetMs, force, soloDati) {
  const t0 = performance.now();
  if (PZ.lx !== null && t0 > PZ.lt) { const dt = (t0 - PZ.lt) / 1000; if (dt > 0.03) { PZ.vx = PZ.vx * 0.8 + 0.2 * clamp((px - PZ.lx) / dt, -120, 120); PZ.vz = PZ.vz * 0.8 + 0.2 * clamp((pz - PZ.lz) / dt, -120, 120); PZ.lx = px; PZ.lz = pz; PZ.lt = t0; } } else { PZ.lx = px; PZ.lz = pz; PZ.lt = t0; }
  _far.position.z = _near.position.z = Math.min(0, pz + META.dati.hh); _far.position.x = _near.position.x = Math.max(0, px - META.dati.hw) + Math.min(0, px + META.dati.hw); // the Prealpi stay on the horizon past where they were drawn
  const ax = px + PZ.vx * 3, az = pz + PZ.vz * 3, cand = [], stend = []; let chiedi = [];
  if (!TUTTO) {
    const i0 = clamp(Math.floor((px - R_BUTTA + META.hw) / TS), 0, NTX - 1), i1 = clamp(Math.floor((px + R_BUTTA + META.hw) / TS), 0, NTX - 1), j0 = clamp(Math.floor((pz - R_BUTTA + META.hh) / TS), 0, NTZ - 1), j1 = clamp(Math.floor((pz + R_BUTTA + META.hh) / TS), 0, NTZ - 1);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const T = TILES[i + NTX * j], dd = hyp(T.cx - px, T.cz - pz); T.dist = dd;
      if (T.l0) { if (!T.lw && dd < R_STESO) stend.push(T); continue; }
      if (T.vola || (dd >= R_PEZZO && hyp(T.cx - ax, T.cz - az) >= R_PEZZO)) continue;
      if (D.pezzi[T.t] === undefined) { T.d = NOD; T.sd = []; T.l0 = true; VIVI.add(T); if (dd < R_STESO) stend.push(T); continue; } // bare ground: nothing to ask for
      if (!T.riprova || t0 > T.riprova) chiedi.push(T);
    }
    if (chiedi.length && PZ.vola < PZ.MAX) { chiedi.sort((a, b) => hyp(a.cx - ax, a.cz - az) - hyp(b.cx - ax, b.cz - az)); for (const T of chiedi) { if (PZ.vola >= PZ.MAX) break; pzChiedi(T); } }
  }
  for (const T of VIVI) {
    const dd = hyp(T.cx - px, T.cz - pz); T.dist = dd;
    if (!T.built && T.lw && dd < R_MESH && vicini(T).every(u => u.lw)) cand.push(T);
    if (T.group) T.group.visible = T.ready && dd < 860;
    if (TUTTO) continue;
    if (T.ready && dd > R_FREE && !force) freeTile(T);
    else if (T.lw && !T.built && dd > R_TOGLI && !vicini(T).some(u => u.built)) tileUnlay(T);
    else if (T.l0 && !T.lw && dd > R_BUTTA && !vicini(T).some(u => u.lw)) { if (T.d === NOD) { T.l0 = false; VIVI.delete(T); } else pzVia(T); }
  }
  // the nearest tile not yet built is inside the ring it should have been built at: this frame may spend more, up to 4 times at 300 m (at speed in a town the front runs ahead of the budget; standing still nothing changes)
  cand.sort((a, b) => a.dist - b.dist); stend.sort((a, b) => a.dist - b.dist);
  // while the front is on time a quarter of the frame is enough, whatever the frame rate: at 7 ms a frame the tiles alone would take the whole of a 165 Hz frame
  const dtF = PZ.tf ? t0 - PZ.tf : 16; PZ.tf = t0;
  const fuori = cand.length ? Math.max(0, R_MESH - 110 - cand[0].dist) : 0, bud = force || soloDati ? budgetMs : fuori > 0 || budgetMs > 7 ? budgetMs * (1 + Math.min(3, fuori / 117)) : clamp(dtF * 0.25, 1.2, budgetMs);
  // the pieces that have arrived: one at least per frame
  let k = 0;
  while (PZ.arrivi.length && (k++ === 0 || performance.now() - t0 < bud * 0.5)) { const [T, b] = PZ.arrivi.shift(), t1 = performance.now(); if (!T.l0) { try { pzArriva(T, b); } catch (e) { GRID_REC = null; console.error('pezzo ' + T.t, e); T.riprova = performance.now() + 3000; } } PZ.usa.arrivo += performance.now() - t1; }
  // laid out when the 8 round have their pieces and the tiles of its decks too
  k = 0;
  for (const T of stend) {
    if (k && performance.now() - t0 >= bud * 0.8) break; if (!vicini(T).every(u => u.l0)) continue;
    let ok = true; for (const q of T.d.dk || []) { const dk = H.deck(q.ord); if (dk.pronto) continue; for (const u of q.tiles) { const U = TILES[u]; if (!U.l0) { ok = false; if (!U.vola && D.pezzi[u] !== undefined) pzChiedi(U); } } } if (!ok) continue;
    const t1 = performance.now(); tileLay(T); PZ.usa.stesura += performance.now() - t1; k++;
  }
  if (soloDati) return;
  /* the tile left half built by the frames first: a tile finished gives back all the blocks in use (blocchi3.js), those of the half built one too, which then went on writing into blocks no longer its own */
  if (force) { if (tileTick.cur) { buildTile(tileTick.cur); tileTick.cur = null; } for (const T of cand) { if (T.dist > force) break; buildTile(T); } return; }
  // the meshes: a slice at a time within the budget, the nearest tile first
  const t2 = performance.now();
  while (performance.now() - t0 < bud) {
    let T = tileTick.cur;
    if (!T || !T.gen) { T = cand.shift(); if (!T) break; T.gen = buildTileGen(T); tileTick.cur = T; }
    if (DEBUG) { const a = performance.now(), r = passoTile(T.gen), b = performance.now() - a, k = T.fetta || 'inizio', e = PZ.fette[k] || (PZ.fette[k] = [0, 0, 0]); e[0]++; e[1] += b; if (b > e[2]) { e[2] = b; e[3] = T.t; } T.fetta = r.value; if (r.done) { T.gen = null; tileTick.cur = null; T.fetta = null; } continue; } /* the slices, in the debug numbers */
    if (passoTile(T.gen).done) { T.gen = null; tileTick.cur = null; }
  }
  PZ.usa.mesh += performance.now() - t2;
}
// everything needed to build the tiles within R of (x, z) is here
async function mondoPronto(x, z, R) {
  if (TUTTO) return;
  for (let n = 0; ; n++) {
    tileTick(x, z, 40, 0, true);
    let ok = true; const i0 = clamp(Math.floor((x - R + META.hw) / TS), 0, NTX - 1), i1 = clamp(Math.floor((x + R + META.hw) / TS), 0, NTX - 1), j0 = clamp(Math.floor((z - R + META.hh) / TS), 0, NTZ - 1), j1 = clamp(Math.floor((z + R + META.hh) / TS), 0, NTZ - 1);
    for (let j = j0; j <= j1 && ok; j++) for (let i = i0; i <= i1; i++) { const T = TILES[i + NTX * j]; if (hyp(T.cx - x, T.cz - z) < R && !vicini(T).every(u => u.lw)) { ok = false; break; } }
    if (ok) return;
    await new Promise(r => setTimeout(r, PZ.arrivi.length ? 0 : 8));
  }
}
const partenza = () => START !== STATION ? [START.x, START.z] : [STATION.x + 190, STATION.z + 66];

// ---- what neither the camera nor the sun can see costs nothing: a tile out of both is switched off before the renderer walks it, the instanced meshes get a sphere of their own.
// An InstancedMesh is born with frustumCulled = false, because the sphere of its geometry says nothing of where its copies are: each one of them, trees and lamps by the hundred, was drawn in both passes wherever it stood.
{ const io = THREE.Frustum.prototype.intersectsObject; THREE.Frustum.prototype.intersectsObject = function (o) { return o.cullS ? this.intersectsSphere(o.cullS) : io.call(this, o); }; }
const CULL_MARGINE = 25; // what falls or flies stays by its tile: a lamp, a gate, a panel of a barrier
function tileLimiti(T, G) {
  G.updateMatrixWorld(true);
  // the group of the tile and the meshes drawn where they stand (no position of their own, nothing under them) never move: no matrix to work out each frame. What flies off later is a new object under a new group
  scene.matrixAutoUpdate = false; G.matrixAutoUpdate = false;
  for (const o of G.children) if (o.isMesh && !o.children.length && !o.position.x && !o.position.y && !o.position.z && !o.rotation.x && !o.rotation.y && !o.rotation.z && o.scale.x === 1 && o.scale.y === 1 && o.scale.z === 1) o.matrixAutoUpdate = false;
  const B = T.box || (T.box = new THREE.Box3()), v = new THREE.Vector3(), S = new THREE.Sphere(); B.makeEmpty();
  G.traverse(o => {
    const g = o.geometry; if (!g || !g.attributes || !g.attributes.position || !g.attributes.position.count) return;
    if (!g.boundingSphere) g.computeBoundingSphere();
    if (o.isInstancedMesh) {
      const a = o.instanceMatrix.array, r = g.boundingSphere.radius, c = g.boundingSphere.center; let n = 0, mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9], rr = 0;
      for (let i = 0; i < o.count; i++) { const k = i * 16, sx = Math.hypot(a[k], a[k + 1], a[k + 2]), sy = Math.hypot(a[k + 4], a[k + 5], a[k + 6]), sz = Math.hypot(a[k + 8], a[k + 9], a[k + 10]), ms = Math.max(sx, sy, sz); if (ms === 0 && a[k + 12] === 0 && a[k + 14] === 0) continue;
        v.set(c.x, c.y, c.z).applyMatrix4({ elements: a.subarray(k, k + 16) }); n++; if (v.x < mn[0]) mn[0] = v.x; if (v.y < mn[1]) mn[1] = v.y; if (v.z < mn[2]) mn[2] = v.z; if (v.x > mx[0]) mx[0] = v.x; if (v.y > mx[1]) mx[1] = v.y; if (v.z > mx[2]) mx[2] = v.z; if (ms * r > rr) rr = ms * r; }
      if (!n) return;
      const Q = new THREE.Sphere(new THREE.Vector3((mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2), Math.hypot(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2 + rr + CULL_MARGINE); Q.applyMatrix4(o.matrixWorld);
      o.cullS = Q; o.frustumCulled = true; S.copy(Q);
    } else S.copy(g.boundingSphere).applyMatrix4(o.matrixWorld);
    if (S.radius > 2000 || S.center.y < -2000) return; // a lamp already knocked down keeps its pool at -9999: not a place
    B.expandByPoint(v.copy(S.center).addScalar(S.radius)); B.expandByPoint(v.copy(S.center).addScalar(-S.radius));
  });
  B.expandByScalar(CULL_MARGINE);
}
const _vistaF = new THREE.Frustum(), _vistaM = new THREE.Matrix4();
scene.onBeforeRender = (r, sc, cam) => { // after the matrices of the frame, before the renderer walks the scene
  _vistaF.setFromProjectionMatrix(_vistaM.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse));
  const om = sun.castShadow && sun.visible; let SF = null; if (om) { sun.shadow.updateMatrices(sun); SF = sun.shadow.getFrustum(); }
  for (const T of VIVI) { const G = T.group; if (!G || !T.ready || !T.box || T.dist >= 860 || T.box.isEmpty()) continue; G.visible = _vistaF.intersectsBox(T.box) || (om && SF.intersectsBox(T.box)); }
  fusiDisegna(_vistaF, om ? SF : null);
};

// ---- the shaders of the whole map, compiled at the start and kept: a shader seen for the first time at speed stopped the game 80 to 200 ms, and one whose last user went with its tile was compiled again the next time.
// One small material per kind found on the map (type; m map, a alphaMap, e emissiveMap, v vertex colours, t transparent, n no fog, i instanced, c instance colours; side; alphaTest). Never drawn. A kind missing here only costs its stop, as before.
const VETRINA = [['B', 'mt', 0, 0], ['B', 'vt', 0, 0], ['B', 'vtn', 2, 0], ['B', 't', 0, 0], ['B', '', 0, 0], ['B', 'tn', 2, 0], ['S', 'mtn', 0, 0], ['S', 'atn', 0, 0], ['S', 'at', 0, 0], ['P', 'mvtn', 0, 0], ['P', 'mtn', 0, 0], ['P', 'vtn', 0, 0], ['P', 't', 0, 0], ['K', '', 0, 0], ['K', 't', 0, 0],
  ['L', 'me', 0, 0.5], ['L', 'me', 0, 0], ['L', 'me', 2, 0], ['L', 'mv', 0, 0], ['L', 'mvic', 2, 0.5], ['L', 'mv', 2, 0], ['L', 'mt', 0, 0], ['L', 'm', 0, 0.5], ['L', 'mic', 0, 0], ['L', 'mi', 0, 0], ['L', 'm', 0, 0], ['L', 'm', 2, 0.12], ['L', 'm', 2, 0.35], ['L', 'm', 2, 0.4], ['L', 'm', 2, 0.5], ['L', 'm', 2, 0],
  ['L', 'vic', 0, 0], ['L', 'vi', 0, 0], ['L', 'v', 0, 0], ['L', 'vt', 2, 0], ['L', 'v', 2, 0], ['L', 't', 0, 0], ['L', 'i', 0, 0], ['L', 'ic', 0, 0], ['L', '', 0, 0], ['L', '', 1, 0], ['L', 't', 2, 0], ['L', '', 2, 0]];
const VETRINA_TIENI = [];
function vetrinaShader() {
  const tex = new THREE.Texture(), geo = new THREE.BufferGeometry(), cl = { L: THREE.MeshLambertMaterial, B: THREE.MeshBasicMaterial, S: THREE.SpriteMaterial, P: THREE.PointsMaterial, K: THREE.LineBasicMaterial }, oggetti = [];
  geo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0, 0, 0, 0, 0, 0], 3));
  for (const [t, f, side, alphaTest] of VETRINA) {
    const has = c => f.includes(c), o = { transparent: has('t') }; if (has('m')) o.map = tex; if (has('a')) o.alphaMap = tex; if (has('e')) o.emissiveMap = tex; if (has('v')) o.vertexColors = true; if (has('n')) o.fog = false; if (t !== 'S') o.side = side; if (alphaTest) o.alphaTest = alphaTest;
    const m = new cl[t](o); let q;
    if (has('i')) { q = new THREE.InstancedMesh(geo, m, 1); if (has('c')) q.setColorAt(0, new THREE.Color()); } else q = new THREE.Mesh(geo, m);
    oggetti.push(q); VETRINA_TIENI.push(m);
  }
  for (const k of ['old', 'mod', 'plain', 'fac']) if (MAT[k]) oggetti.push(new THREE.Mesh(geo, MAT[k]));
  try { for (const m of FAC_PRE) { const q = new THREE.InstancedMesh(geo, m.material, 1); if (m.instanceColor) q.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(3), 3); oggetti.push(q); } } catch (e) { } /* the 3D windows (facciate3.js) */
  for (const [m, ins] of RIF.pre) oggetti.push(ins ? new THREE.InstancedMesh(geo, m, 1) : new THREE.Mesh(geo, m)); /* the reflections of riflessi3.js: their shaders too, and those of the fused cars (fusi3.js: the paint and the panes read the colour of each part) */
  for (const m of [M_GLASS, rifPaint('#ffffff')]) { const s = fusiSlot(m); if (s > 0 && FUSI_COL[s]) { const q = new THREE.InstancedMesh(geo, FUSI_MAT[s], 1); q.setColorAt(0, new THREE.Color()); oggetti.push(q); } }
  const g = new THREE.Group(); g.visible = false; g.add(...oggetti); scene.add(g); renderer.compile(scene, camera); scene.remove(g);
}

// ---- the whole map at once. ?cuoci (src/cuoci.mjs): what depends on all the map, decided once by the same code, goes into mappa/ and the game stops there. ?tutto: the same and then the game goes on with
// nothing taken away, for the checks of the whole map (src/controlli_barriere.mjs)
async function cuoci() {
  const pz = {}, ogni = t => pz[t] || (pz[t] = {}), tutti = Object.keys(D.pezzi).map(Number).sort((a, b) => a - b);
  H.gradini = false; let dn = 0;
  await Promise.all(Array.from({ length: 16 }, async (_, w) => { for (let i = w; i < tutti.length; i += 16) { const T = TILES[tutti[i]], r = await fetch(`mappa/p/${T.t % NTX}_${Math.floor(T.t / NTX)}.bin?v=${D.ver}`, FRESCO); PZ.arrivi.push([T, await gunzip(await r.arrayBuffer())]); goBtn.textContent = 'COTTURA ' + (++dn) + '/' + tutti.length; } }));
  PZ.arrivi.sort((a, b) => a[0].t - b[0].t); for (const [T, b] of PZ.arrivi) pzArriva(T, b); PZ.arrivi.length = 0;
  for (const T of TILES) { if (!T.l0) { T.d = NOD; T.sd = []; T.l0 = true; } T.dist = 1e9; VIVI.add(T); }
  // in the order of the old start: the feet of the barriers, on the ground without the step layer
  const ndk = H.nodeDeckCalc(), linee = []; for (const T of TILES) { tileLinee(T); for (const q of T.feQ) linee.push(q); for (const [, q] of T.baQ) linee.push(q); } barFeetAll(linee);
  const mm = v => Math.round(v * 1000);
  for (const T of TILES) { const bf = []; for (const q of [...T.feQ, ...T.baQ.map(e => e[1])]) { const a = []; for (const p of q) { barFoot(p); a.push(mm(p.g0), mm(p.fy) - mm(p.g0), mm(p.g0) - mm(p.lo), p.pl ? 1 : 0); } bf.push(a); } if (bf.length) ogni(T.t).bf = bf; }
  // walls, trees, barriers: on the same ground
  for (const T of TILES) { const f = T.feQ, b = T.baQ; layMuri(T); T.feQ = f; T.baQ = b; }
  // the step layer, and whether a segment of road stands in a building: before the fuel stations take their roofs away
  H.gradini = true;
  for (const T of TILES) if (H.tile(T.t)) { const mds = stepsAdd(T); if (mds.length) ogni(T.t).mds = mds; }
  const nb = {}; D.roads.forEach((r, ri) => { if (r.t || r.d) return; const l = []; for (let k = 1; k < r.g.length; k++) { const a = N[r.g[k - 1]], b = N[r.g[k]]; if (inBuilding((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, 0)) l.push(k); } if (l.length) { nb[ri] = l; r.nb = l; } });
  for (const T of TILES) { for (const q of T.d.dk || []) { const dk = H.deck(q.ord); deckInit(dk); rampPaint(dk, T); } }
  lxTrova(); lxTreni();
  for (const T of TILES) { layResto(T); T.lw = true; }
  const glob = { ndk: [...ndk].map(([i, y]) => [i, mm(y)]), nb, lxno: [...LX_NO], treni: {}, confine: confineQuote() };
  for (const Tr of TRAINS) { Tr.at(0); glob.treni[Tr.ti] = Array.from(Tr.prof(), mm); }
  if (COTTURA) {
    // the big supermarkets, the shop fronts and the plain signs need all the buildings: their choices go in the tile of each
    ngSuperTutti(); const ref = b => [b.ti, b.bi];
    for (const r of ngList()) { const { b, m, big, ...q } = r; (ogni(r.tile).ngf || (ogni(r.tile).ngf = [])).push({ ...q, b: ref(b) }); (ogni(b.ti).ngw || (ogni(b.ti).ngw = [])).push([b.bi, Math.round(r.cx * 100) / 100, Math.round(r.cz * 100) / 100, Math.round(r.w * 100) / 100, Math.round(ngSignTop(m, r.b.gtop - H.ground(r.cx + r.nx * 0.6, r.cz + r.nz * 0.6)) * 100) / 100]); } /* ngw: the fronts on the buildings of each tile, for the facades (facciate 2.0: no window or door under a front) */
    for (const T of TILES) T.bld.forEach((B, i) => { if (!B.big) return; const { e, front, ...big } = B.big; let fr; if (front) { const { b, big: _b, ...f } = front; fr = { ...f, b: ref(b) }; } (ogni(T.t).sup || (ogni(T.t).sup = [])).push([i, { ...big, front: fr }, B.h]); });
    for (const s of signList()) { if (s.b.lm) continue; const t = tileOf(s.p.x, s.p.z); (ogni(t).sgf || (ogni(t).sgf = [])).push({ ...s, p: D.pois.indexOf(s.p), b: ref(s.b) }); }
    window.__COTTA = JSON.stringify({ pezzi: pz, globale: glob }); // the numbers as they are: a shop draws its look from h0
    window.__COTTA_GRANDE = bigCanvas().toDataURL('image/webp', 0.92);
    goBtn.textContent = 'COTTURA FINITA';
    await new Promise(() => { }); // the game stops here: src/cuoci.mjs takes the results
  }
  confineMuri();
}
