// ---------------------------------------------------------------- the picture after the scene (realismo 2, fase A): what a camera does to the light before the photo
// The scene is drawn into a buffer of its own (half float, light above 1 kept), with 4 samples a pixel: the edges, and with alpha to coverage the leaves, the twigs
// and the fences, come out smooth. Then, in passes:
//  - ambient occlusion (GTAO of three, at half size, from the depth only): the light of the sky does not get into corners, under eaves, under cars and
//    between the trees of a wood. Close it is a soft shade, far away nothing (the radius is in metres);
//  - rays of the sun (fase B): with the sun low and in sight, the light through the gaps between houses and trees spreads in the haze (RAGGI);
//  - glow of the lights (fase B, UnrealBloomPass of three): what is brighter than white (bulbs, headlights, the sun) spreads a halo, as in a photo;
//  - tone mapping and sRGB (OutputPass: the same AgX and exposure luce3.js gives the renderer);
//  - SMAA on the finished picture, for what multisampling does not catch (lines drawn inside a texture, shine on thin things).
// ?post=0 draws straight to the canvas as before; ?ao=0, ?aa=0, ?smaa=0, ?bloom=0 one off (POST in game.src.html)
const POSTFX = (() => {
  if (!POST.on || !THREE.OutputPass) return null;
  const v = new THREE.Vector2(), dt = new THREE.DepthTexture(1, 1); dt.format = THREE.DepthStencilFormat; dt.type = THREE.UnsignedInt248Type; /* the pools of acqua3.js use the stencil */
  const rtS = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: POST.aa ? 4 : 0, depthTexture: dt, stencilBuffer: true });
  rtS.resolveStencilBuffer = false; /* the stencil is only needed while the scene is drawn (the pools); resolving it out of the 4 samples cost 5-6 ms of GPU a frame at 1080p on ANGLE/D3D11 (indagine FPS 14/11): colour and depth only */
  const rtA = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }), rtB = new THREE.WebGLRenderTarget(1, 1, { depthBuffer: false }); // rtB: the finished picture (sRGB, 8 bit), for SMAA
  let ao = null;
  if (POST.ao && THREE.GTAOPass) {
    ao = new THREE.GTAOPass(scene, camera, 1, 1); ao.setGBuffer(dt); /* the depth of the scene's own buffer: no second drawing of the scene for the normals */
    ao.updateGtaoMaterial({ radius: 1.1, distanceExponent: 1.6, thickness: 2.0, distanceFallOff: 1, scale: 1.15, samples: 12 });
    ao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 12 });
    ao.blendIntensity = 0.85;
  }
  const out = new THREE.OutputPass(), smaa = POST.smaa && THREE.SMAAPass ? new THREE.SMAAPass() : null;
  const bloom = POST.bloom && THREE.UnrealBloomPass ? new THREE.UnrealBloomPass(new THREE.Vector2(256, 256), 0.5, 0.45, 1.0) : null;
  const F = { rtS, rtA, rtB, ao, out, smaa, bloom, raggi: POST.raggi ? raggiFai(dt) : null, w: 0, h: 0 };
  F.size = () => {
    renderer.getDrawingBufferSize(v); if (v.x === F.w && v.y === F.h) return; F.w = v.x; F.h = v.y;
    rtS.setSize(v.x, v.y); rtA.setSize(v.x, v.y); rtB.setSize(v.x, v.y); if (smaa) smaa.setSize(v.x, v.y);
    if (ao) ao.setSize(Math.ceil(v.x / 2), Math.ceil(v.y / 2)); /* half size: the occlusion is soft, and four times cheaper */
    if (F.bloom) F.bloom.setSize(v.x, v.y); if (F.raggi) F.raggi.rt.setSize(Math.ceil(v.x / 2), Math.ceil(v.y / 2));
  };
  addEventListener('resize', F.size); F.size();
  return F;
})();
// the sun's cascades (game.src.html): three's SunLightShadow splits the distance halfway between even and logarithmic; here more of it logarithmic (SUN_LAMBDA),
// so the near cascade holds the first ~45 m and its shadows are as sharp as the old box's (the far one, to SUN_OMBRA m, is coarser: far away it does not show).
// The same code as three 0.186.1's SunLightShadow.updateMatrices, with that one number
const SUN_LAMBDA = 0.8;
if (sun.isSunLight) {
  const sh = sun.shadow, N = 2, V = () => new THREE.Vector3(), nearC = [V(), V(), V(), V()], farC = [V(), V(), V(), V()], cc = [V(), V(), V(), V(), V(), V(), V(), V()];
  const lo = new THREE.Matrix4(), v2l = new THREE.Matrix4(), ld = V(), up = V(), ce = V();
  sh.updateMatrices = function (light, vc) {
    if (vc === undefined) return;
    const insX = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.x), insY = Math.min(0.25, (Math.ceil(this.radius) + 1) / this.mapSize.y);
    for (let i = 0; i < N; i++) this._viewports[i].set(i + insX, insY, 1 - 2 * insX, 1 - 2 * insY);
    const resX = this.mapSize.x * (1 - 2 * insX), resY = this.mapSize.y * (1 - 2 * insY), res = Math.min(resX, resY), cam = this.camera;
    const cN = vc.near, cF = Math.max(cN + 1e-6, Math.min(cam.far, vc.far)), sp = this._cascadeSplits; sp[0] = cN;
    for (let i = 1; i < N; i++) { const a = i / N; sp[i] = (cN + (cF - cN) * a) * (1 - SUN_LAMBDA) + cN * Math.pow(cF / cN, a) * SUN_LAMBDA; }
    sp[N] = cF;
    ld.setFromMatrixPosition(light.matrixWorld).negate().normalize(); up.set(0, 1, 0); if (Math.abs(up.dot(ld)) > 0.99) up.set(0, 0, 1);
    lo.lookAt(ce.set(0, 0, 0), ld, up); v2l.copy(lo).transpose().multiply(vc.matrixWorld);
    const zN = vc.reversedDepth ? 1 : -1; let gMax = -Infinity;
    for (let i = 0; i < 4; i++) {
      const x = i === 0 || i === 1 ? 1 : -1, y = i === 0 || i === 3 ? 1 : -1, n = nearC[i].set(x, y, zN).applyMatrix4(vc.projectionMatrixInverse), f = farC[i];
      if (vc.isPerspectiveCamera === true) f.copy(n).multiplyScalar(cF / cN); else f.set(n.x, n.y, -cF);
      n.applyMatrix4(v2l); f.applyMatrix4(v2l); gMax = Math.max(gMax, n.z, f.z);
    }
    gMax += cF; const sN = cam.near;
    for (let i = 0; i < N; i++) {
      const cn = i === 0 ? sp[0] : this._cascadeData[i - 1].z, cf = sp[i + 1], fs = cf - 0.1 * (cf - sp[i]);
      this._cascadeData[i].set(i === 0 ? -1e10 : cn, cf, fs, 0);
      const na = (cn - cN) / (cF - cN), fa = (cf - cN) / (cF - cN); ce.set(0, 0, 0);
      for (let j = 0; j < 4; j++) { cc[j * 2].lerpVectors(nearC[j], farC[j], na); cc[j * 2 + 1].lerpVectors(nearC[j], farC[j], fa); ce.add(cc[j * 2]).add(cc[j * 2 + 1]); }
      ce.multiplyScalar(1 / 8); let r2 = 0, minZ = Infinity;
      for (let j = 0; j < 8; j++) { r2 = Math.max(r2, cc[j].distanceToSquared(ce)); minZ = Math.min(minZ, cc[j].z); }
      let rad = Math.sqrt(r2);
      if (res > 1) { rad /= 1 - 1 / res; const tx = 2 * rad / resX, ty = 2 * rad / resY; ce.x = Math.round(ce.x / tx) * tx; ce.y = Math.round(ce.y / ty) * ty; }
      ce.z = gMax + sN; ce.applyMatrix4(lo);
      const c = this._cameras[i]; c.position.copy(ce); c.quaternion.setFromRotationMatrix(lo);
      Object.assign(c, { left: -rad, right: rad, top: rad, bottom: -rad, near: sN, far: gMax - minZ + 2 * sN, coordinateSystem: cam.coordinateSystem }); c._reversedDepth = cam.reversedDepth;
      c.updateProjectionMatrix(); c.updateMatrixWorld(); this._updateMatrix(c, this._matrices[i], this._frustums[i], this._viewports[i]);
    }
  };
}
// ---- the rays of the sun: from each pixel (at half size) a march of RG_N steps towards the sun on the screen, adding the open sky it meets near the sun
// (depth = clear: nothing in front of it), each step a little less (decay): where a roof or a crown hides the sun, a darker shaft; where the sky is open,
// a light one. Strongest with the sun low (morning, evening), nothing at night, under cloud or with the sun behind the camera
function raggiFai(depth) {
  const VS = `varying vec2 vUv;
void main() { vUv = uv; gl_Position = vec4( position.xy, 0.0, 1.0 ); }`;
  const mR = new THREE.ShaderMaterial({ uniforms: { tCol: { value: null }, tDepth: { value: depth }, uSun: { value: new THREE.Vector2() }, uAsp: { value: 1 } }, vertexShader: VS, depthTest: false, depthWrite: false,
    fragmentShader: `uniform sampler2D tCol; uniform sampler2D tDepth; uniform vec2 uSun; uniform float uAsp; varying vec2 vUv;
void main() {
  const int RG_N = 40; vec2 st = ( uSun - vUv ) / float( RG_N ); float j = fract( sin( dot( gl_FragCoord.xy, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
  vec2 p = vUv + st * j; float sum = 0.0, w = 1.0;
  for ( int i = 0; i < RG_N; i ++ ) {
    float sky = step( 0.9999995, texture2D( tDepth, p ).x ), near = exp( - length( ( p - uSun ) * vec2( uAsp, 1.0 ) ) * 7.0 );
    sum += sky * near * min( dot( texture2D( tCol, p ).rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), 3.0 ) * w; w *= 0.955; p += st;
  }
  gl_FragColor = vec4( vec3( sum / float( RG_N ) ), 1.0 );
}` });
  const mC = new THREE.ShaderMaterial({ uniforms: { tRays: { value: null }, uCol: { value: new THREE.Color() } }, vertexShader: VS, depthTest: false, depthWrite: false, transparent: true, blending: THREE.AdditiveBlending,
    fragmentShader: `uniform sampler2D tRays; uniform vec3 uCol; varying vec2 vUv;
void main() { gl_FragColor = vec4( texture2D( tRays, vUv ).rgb * uCol, 1.0 ); }` });
  const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mR), sc = new THREE.Scene(); q.frustumCulled = false; sc.add(q);
  const rt = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, depthBuffer: false }); mC.uniforms.tRays.value = rt.texture;
  return { mR, mC, q, sc, rt, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), v: new THREE.Vector3(), d: new THREE.Vector3() };
}
function raggiDisegna(R, src) {
  const L = lightTones(), clear = (1 - WX.cloud * WX.cloud) * (1 - WX.fog) * (1 - WX.rain);
  const low = L.elDeg > -1 ? clamp((L.elDeg + 1) / 3, 0, 1) * (0.45 + 0.55 * Math.exp(-Math.max(0, L.elDeg) / 14)) : 0; /* low sun: long rays; high: faint */
  R.v.set(L.E, L.U, -L.Nn).normalize(); camera.getWorldDirection(R.d); const front = R.v.dot(R.d);
  R.v.multiplyScalar(1000).add(camera.position).project(camera); const ux = R.v.x * 0.5 + 0.5, uy = R.v.y * 0.5 + 0.5;
  const out = Math.max(0, Math.max(-ux, ux - 1, -uy, uy - 1)), k = low * clear * clamp(front * 3, 0, 1) * clamp(1 - out / 0.35, 0, 1);
  if (k < 0.01) return;
  R.mR.uniforms.tCol.value = src.texture; R.mR.uniforms.uSun.value.set(ux, uy); R.mR.uniforms.uAsp.value = camera.aspect;
  R.mC.uniforms.uCol.value.copy(sun.color).multiplyScalar(1.6 * k);
  R.q.material = R.mR; renderer.setRenderTarget(R.rt); renderer.render(R.sc, R.cam);
  const ac = renderer.autoClear; renderer.autoClear = false; R.q.material = R.mC; renderer.setRenderTarget(src); renderer.render(R.sc, R.cam); renderer.autoClear = ac;
}
function disegna() { // one frame: the scene, then the passes (or the scene alone, straight to the canvas, with ?post=0)
  const F = POSTFX; if (!F) { renderer.render(scene, camera); return; }
  F.size(); renderer.setRenderTarget(F.rtS); renderer.render(scene, camera);
  let src = F.rtS;
  if (F.ao) { F.ao.render(renderer, F.rtA, src); src = F.rtA; }
  if (F.raggi) raggiDisegna(F.raggi, src);
  if (F.bloom) { const on = LIGHTS.on || 0; F.bloom.strength = 0.22 + 0.5 * on; F.bloom.threshold = 1.0; F.bloom.radius = 0.4 + 0.2 * on; F.bloom.render(renderer, null, src); } /* adds onto src itself; by day only the sun and its glints are over the threshold */
  F.out.renderToScreen = !F.smaa; F.out.render(renderer, F.rtB, src);
  if (F.smaa) { F.smaa.renderToScreen = true; F.smaa.render(renderer, null, F.rtB); }
  renderer.setRenderTarget(null);
}
