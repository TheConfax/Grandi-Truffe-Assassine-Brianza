// ---------------------------------------------------------------- realismo 3, fase D: the wet ground mirrors what stands on it (Carlo 13/11: "riflessi veri sul bagnato")
// While the ground is wet (RIF.wet, weather3.js), each frame the scene is drawn again, at half size, from the camera mirrored under the plane of the ground beneath it
// (the trick of the planar reflections: the near plane tilted onto the ground, so nothing under it gets in). riflessi3.js samples that picture where a wet
// surface faces up (asphalt, pavements, setts, puddles, the covers), bent by the relief and by the rings of the drops, blurred as much as the surface is rough:
// houses, lamps, headlights, tail lights and signs show in the puddles and on the wet asphalt, instead of the sky alone. Dry: nothing is drawn twice.
// &pozze=0 turns it off (back to the sky alone)
const BAGNATO = window.__BAGNATO = { on: !/[?&]pozze=0/.test(location.search), rt: null, cam: new THREE.PerspectiveCamera(), n: 0, dummy: new THREE.DataTexture(new Uint8Array([0, 0, 0, 255]), 1, 1), _p: new THREE.Plane(), _v: new THREE.Vector3(), _w: new THREE.Vector3(), _q: new THREE.Vector4(), _c: new THREE.Vector4(), _t: new THREE.Vector3() };
BAGNATO.dummy.needsUpdate = true; RIF.pr.tex.value = BAGNATO.dummy;
function bagnatoDisegna() {
  const B = BAGNATO, P = RIF.pr;
  if (!B.on || RIF.wet.value < 0.03 || !camera) { P.on.value = 0; return; }
  const sz = renderer.getDrawingBufferSize(B._v), w = Math.max(64, Math.round(sz.x / 2)), h = Math.max(64, Math.round(sz.y / 2));
  if (!B.rt || B.rt.width !== w || B.rt.height !== h) { if (B.rt) B.rt.dispose(); B.rt = new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, depthBuffer: true }); }
  const y0 = H.surface(camera.position.x, camera.position.z) + 0.02, C = B.cam; /* the plane of the ground under the camera */
  if (camera.position.y < y0 + 0.05) { P.on.value = 0; return; }
  camera.updateMatrixWorld();
  C.fov = camera.fov; C.aspect = camera.aspect; C.near = camera.near; C.far = camera.far; C.updateProjectionMatrix();
  C.position.set(camera.position.x, 2 * y0 - camera.position.y, camera.position.z);
  const d = camera.getWorldDirection(B._w); B._t.set(C.position.x + d.x, C.position.y - d.y, C.position.z + d.z); C.up.set(0, 1, 0); C.lookAt(B._t); C.updateMatrixWorld(); C.matrixWorldInverse.copy(C.matrixWorld).invert();
  /* the near plane on the ground (three's Reflector): nothing under the ground reaches the picture */
  B._p.setFromNormalAndCoplanarPoint(B._v.set(0, 1, 0), B._w.set(0, y0, 0)).applyMatrix4(C.matrixWorldInverse);
  const cp = B._c.set(B._p.normal.x, B._p.normal.y, B._p.normal.z, B._p.constant), pm = C.projectionMatrix, e = pm.elements, q = B._q;
  q.x = (Math.sign(cp.x) + e[8]) / e[0]; q.y = (Math.sign(cp.y) + e[9]) / e[5]; q.z = -1; q.w = (1 + e[10]) / e[14];
  cp.multiplyScalar(2 / cp.dot(q)); e[2] = cp.x; e[6] = cp.y; e[10] = cp.z + 1; e[14] = cp.w; C.projectionMatrixInverse.copy(pm).invert();
  /* the picture: the surfaces that read it see a black texel meanwhile (no texture read and written at once) */
  P.on.value = 0; P.tex.value = B.dummy;
  const was = renderer.getRenderTarget(), au = renderer.shadowMap.autoUpdate, cf = CIUFFI ? CIUFFI.im.visible : false, rv = RAIN.visible;
  renderer.shadowMap.autoUpdate = false; if (CIUFFI) CIUFFI.im.visible = false; RAIN.visible = false; /* not the drops nor the tufts: they would streak the mirror */
  renderer.setRenderTarget(B.rt); renderer.clear(); renderer.render(scene, C);
  renderer.setRenderTarget(was); renderer.shadowMap.autoUpdate = au; if (CIUFFI) CIUFFI.im.visible = cf; RAIN.visible = rv;
  P.mat.value.set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1).multiply(pm).multiply(C.matrixWorldInverse);
  P.tex.value = B.rt.texture; P.on.value = 1; B.n++;
}
{ const d0 = disegna; disegna = function () { bagnatoDisegna(); d0(); }; }
