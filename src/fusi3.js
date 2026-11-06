// ---------------------------------------------------------------- cars and people drawn together (docs/motore.md "Caricamento a pezzi", FPS): each stays the tree of objects the game has always moved, turned, lit, dented and hidden, but the renderer no longer draws its parts one by one.
// Every frame, after the matrices and before the renderer walks the scene, the parts of what the camera or the sun can see go into one instanced mesh per kind of geometry and material. A part fused leaves the renderer's sight by its layer: its matrix is still worked out, and nothing else changes.
// Boxes share one unit box scaled to size. The plain lit materials share one material, their colour read each frame per part (a car that scorches, a new paint); a lit one (lamps, brake lights, sirens) has its own batch with its own material, so what the game does to it shows. Not fused, and drawn as ever: what is see-through or has a map (the cab of the police, the pool of the headlights) and a dented body, whose geometry is its own (geo.fFuori).
const FUSI = { n: 0, sf: new THREE.Sphere(new THREE.Vector3(), 9), gu: {}, lista: [], opaca: new THREE.MeshLambertMaterial({ color: 0xffffff }), slot: new Map(), mask: 1 << 20, ogg: new THREE.Matrix4() };
FUSI.slot.set(FUSI.opaca, 0); const FUSI_MAT = [FUSI.opaca], FUSI_COL = [true], FUSI_RIF = {}; /* FUSI_COL[s]: the batch reads the colour of each part; FUSI_RIF: one white material per kind of reflection (riflessi3.js), the colour per part as for the plain one */
// The matrices: what is hidden needs none (it has them the frame it shows again), and a parked car that has not moved has the ones it had, some twenty parts each, every frame
const _fusiUMW = THREE.Object3D.prototype.updateMatrixWorld;
function fusiMatrici(force) {
  if (!this.visible) return; const v = this.fVeh;
  if (v && !force) { const q = this.fQ || (this.fQ = [NaN, 0, 0, 0, 0, 0, 0, 0]); if (v.sleep && !v.driver && !v.F && q[0] === v.x && q[1] === v.y && q[2] === v.z && q[3] === v.h && q[4] === v.roll && q[5] === v.pitch && q[6] === v.spin && q[7] === v.steer) return; q[0] = v.x; q[1] = v.y; q[2] = v.z; q[3] = v.h; q[4] = v.roll; q[5] = v.pitch; q[6] = v.spin; q[7] = v.steer; }
  _fusiUMW.call(this, force);
}
function fusiSlot(M) { // 0: the shared plain material; n: a batch with M itself; -1: drawn as ever
  let s = FUSI.slot.get(M); if (s !== undefined) return s;
  if (!M.isMeshLambertMaterial || M.transparent || M.map || M.alphaMap || M.emissiveMap || M.vertexColors || M.side !== THREE.FrontSide || M.alphaTest || M.polygonOffset || M.opacity !== 1 || !M.fog || !M.depthWrite || !M.depthTest || !M.colorWrite) s = -1;
  else if (M.userData.rif) { const k = M.userData.rif; s = FUSI_RIF[k]; if (s === undefined) { s = FUSI_RIF[k] = FUSI_MAT.length; FUSI_MAT.push(rifMat(new THREE.MeshLambertMaterial({ color: 0xffffff }), k)); FUSI_COL[s] = true; } }
  else if (M.emissive.r || M.emissive.g || M.emissive.b) { s = FUSI_MAT.length; FUSI_MAT.push(M); } else s = 0;
  FUSI.slot.set(M, s); return s;
}
function fusiLotto(g, s, c) { // the batch of a geometry, a material, cast or not
  const k = s * 2 + (c ? 1 : 0); return (g.fL || (g.fL = []))[k] || (g.fL[k] = fusiNuovo(g, s, c, FUSI_COL[s] ? 512 : 64));
}
function fusiNuovo(g, s, c, cap) {
  const m = new THREE.InstancedMesh(g, FUSI_MAT[s], cap); m.castShadow = c; m.receiveShadow = false; m.frustumCulled = false; m.matrixAutoUpdate = false; m.visible = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const l = { m, n: 0, cap, mt: m.instanceMatrix.array, col: null, g, s, c };
  if (FUSI_COL[s]) { m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3), 3); m.instanceColor.setUsage(THREE.DynamicDrawUsage); l.col = m.instanceColor.array; }
  scene.add(m); FUSI.lista.push(l); FUSI.n++; return l;
}
function fusiCresci(l) { // a batch too small: the next size up; what is in it stays
  const q = fusiNuovoSenza(l); q.mt.set(l.mt); if (l.col) q.col.set(l.col); q.n = l.n; scene.remove(l.m); l.m.dispose(); l.m = q.m; l.mt = q.mt; l.col = q.col; l.cap = q.cap;
}
function fusiNuovoSenza(l) { const q = fusiNuovo(l.g, l.s, l.c, l.cap * 2); FUSI.lista.pop(); return q; }
function fusiGeo(g) { // what a part's geometry draws: the unit box (fU = size) or itself
  const u = g.fU; if (!u) return g; const k = u[3] ? 'b' + u[3] : 's'; return FUSI.gu[k] || (FUSI.gu[k] = u[3] ? new THREE.BoxGeometry(1, 1, 1, u[3], u[4], u[5]) : new THREE.BoxGeometry(1, 1, 1));
}
function fusiParte(o) {
  const M = o.material, gg = o.geometry, s = gg.fFuori ? -1 : fusiSlot(M); if (s < 0) { o.layers.mask = 1; return; }
  o.layers.mask = FUSI.mask;
  const u = gg.fU, l = fusiLotto(fusiGeo(gg), s, o.castShadow); if (l.n === l.cap) fusiCresci(l);
  const e = o.matrixWorld.elements, a = l.mt, k = l.n * 16;
  if (u) { const sx = u[0], sy = u[1], sz = u[2]; a[k] = e[0] * sx; a[k + 1] = e[1] * sx; a[k + 2] = e[2] * sx; a[k + 3] = 0; a[k + 4] = e[4] * sy; a[k + 5] = e[5] * sy; a[k + 6] = e[6] * sy; a[k + 7] = 0; a[k + 8] = e[8] * sz; a[k + 9] = e[9] * sz; a[k + 10] = e[10] * sz; a[k + 11] = 0; a[k + 12] = e[12]; a[k + 13] = e[13]; a[k + 14] = e[14]; a[k + 15] = 1; }
  else for (let q = 0; q < 16; q++) a[k + q] = e[q];
  if (l.col) { const c = M.color, j = l.n * 3; l.col[j] = c.r; l.col[j + 1] = c.g; l.col[j + 2] = c.b; }
  l.n++;
}
function fusiGiro(o) { const K = o.children; for (let i = 0; i < K.length; i++) { const c = K[i]; if (!c.visible) continue; if (c.isMesh) fusiParte(c); if (c.children.length) fusiGiro(c); } }
function fusiDisegna(F, SF) { // F, SF: what the camera and the sun see (pezzi3.js)
  const L = FUSI.lista, K = scene.children, sf = FUSI.sf; for (let i = 0; i < L.length; i++) L[i].n = 0;
  for (let i = 0; i < K.length; i++) { const c = K[i]; if (!c.fRadice || !c.visible) continue; sf.center.setFromMatrixPosition(c.matrixWorld); if (!F.intersectsSphere(sf) && !(SF && SF.intersectsSphere(sf))) continue; fusiGiro(c); }
  for (let i = 0; i < L.length; i++) { const l = L[i], m = l.m; m.count = l.n; m.visible = l.n > 0; if (!l.n) continue; const a = m.instanceMatrix; a.updateRange.count = l.n * 16; a.needsUpdate = true; if (l.col) { const b = m.instanceColor; b.updateRange.count = l.n * 3; b.needsUpdate = true; } }
}
