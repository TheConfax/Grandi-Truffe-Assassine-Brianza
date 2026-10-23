// ---------------------------------------------------------------- foto: photographic surfaces (ramo fotorealismo)
// the drawn textures of the ground surfaces get the grain of real photos (Poly Haven, CC0), recoloured to the same mean colour
// (tex/*.jpg, made from the originals by the script in the commit): same palette, real asphalt cracks, blades of grass, paving joints.
// The texture object stays the same, so every material using it follows; repeat turns the UV scale the surface was drawn with
// (metres per repeat) into the size of the photo (metres)
const FOTO_TEX = [[asphaltTex, 'asfalto', 9 / 3], [grassTex, 'prato', 9 / 2], [groundTex, 'terreno', 10 / 2], [sidewalkTex, 'marciapiede', 4 / 1.8], [porfidoTex, 'porfido', 4 / 1]];
{
  const ld = new THREE.TextureLoader();
  for (const [t, f, r] of FOTO_TEX) ld.load('tex/' + f + '.jpg', img => { t.image = img.image; t.repeat.set(r, r); t.needsUpdate = true; });
}
// output in sRGB, through a filmic curve: highlights roll off instead of clipping
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
// the sky: three's Preetham model (Sky.js r128, loaded beside three.min.js), with the sun's disc and the glow round it, the blue
// deepening overhead and paling to the horizon, red and orange at sunset. It is drawn first, over the old gradient, and fades out
// at night, under cloud and in fog, where the gradient (greyed by the weather) takes over. The haze takes the sky's colour at the
// horizon the camera faces: a strip of sky is rendered small and read back every half second
const FOTO_SKY = (() => {
  if (!THREE.Sky) return null; // the script did not load: the old sky stays
  const s = new THREE.Sky(), m = s.material;
  Object.assign(m.uniforms, { uSkyK: { value: 0.13 }, uSkyA: { value: 1 }, uSkyS: { value: 1.8 } }); // exposure, opacity, saturation (the filmic curve greys a bright sky)
  m.uniforms.turbidity.value = 2; m.uniforms.rayleigh.value = 2.5; m.uniforms.mieCoefficient.value = 0.003; m.uniforms.mieDirectionalG.value = 0.8;
  m.fragmentShader = m.fragmentShader.replace('const vec3 cameraPos = vec3( 0.0, 0.0, 0.0 );', '#define cameraPos cameraPosition\nuniform float uSkyK;\nuniform float uSkyA;\nuniform float uSkyS;') // the box goes with the camera
    .replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( max( mix( vec3( dot( retColor, vec3( 0.2126, 0.7152, 0.0722 ) ) ), retColor, uSkyS ), 0.0 ) * vec3( 0.86, 0.95, 1.16 ) * uSkyK, uSkyA );'); // saturated, the model leans to teal: the tint takes it back towards blue
  Object.assign(m, { blending: THREE.CustomBlending, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneMinusSrcAlphaFactor, fog: false }); // opaque list, drawn first, blended on the gradient
  s.scale.setScalar(SKY_R * 1.6); s.renderOrder = -100; s.frustumCulled = false; scene.add(s);
  const probe = new THREE.Mesh(s.geometry, Object.assign(m.clone(), { uniforms: m.uniforms, blending: THREE.NoBlending })); probe.scale.copy(s.scale); probe.frustumCulled = false;
  const ps = new THREE.Scene(); ps.add(probe);
  return { s, probe, ps, rt: new THREE.WebGLRenderTarget(8, 2), cam: new THREE.PerspectiveCamera(12, 4, 1, SKY_R * 2), px: new Uint8Array(64), col: new THREE.Color(0xc9ced4), t: -1e9, tod: -1, yaw: 0, a: 0 };
})();
function fotoSkyHorizon() { // the mean colour of the sky just over the horizon ahead (linear, before the filmic curve: as the fog needs it)
  const F = FOTO_SKY, d = camera.getWorldDirection(_fotoV), yaw = Math.atan2(d.x, d.z);
  F.probe.position.copy(camera.position); F.cam.position.copy(camera.position); F.cam.lookAt(camera.position.x + d.x, camera.position.y + Math.tan(0.05) * Math.hypot(d.x, d.z), camera.position.z + d.z);
  const was = renderer.getRenderTarget(); renderer.setRenderTarget(F.rt); renderer.render(F.ps, F.cam); renderer.readRenderTargetPixels(F.rt, 0, 0, 8, 2, F.px); renderer.setRenderTarget(was);
  let r = 0, g = 0, b = 0; for (let i = 0; i < 16; i++) { r += F.px[i * 4]; g += F.px[i * 4 + 1]; b += F.px[i * 4 + 2]; }
  F.col.setRGB(r / 4080, g / 4080, b / 4080); F.t = performance.now(); F.tod = TOD; F.yaw = yaw;
}
const _fotoV = new THREE.Vector3();
// in linear light the sky's fill counts for less than in the old sums, and the fog took the curve's warm cast: more fill in the
// shadows, a cooler and greyer haze by day. On top of what updDayNight sets every frame
const FOTO_HEMI = 1.3, FOTO_SUN = 1.1, FOTO_FOGGREY = new THREE.Color(0xc9ced4);
{
  const udn = updDayNight;
  updDayNight = function (dt) {
    udn(dt); hemi.intensity *= FOTO_HEMI; sun.intensity *= FOTO_SUN;
    const L = lightTones(), F = FOTO_SKY;
    if (F) {
      F.s.position.copy(camera.position); F.s.material.uniforms.sunPosition.value.set(L.E, L.U, -L.Nn); // the true sun, also under the horizon (SUN_DIR stops at the lighting's lowest)
      F.a = clamp((L.elDeg + 7) / 9, 0, 1) * (1 - 0.95 * clamp((WX.cloud - 0.25) / 0.55, 0, 1)) * (1 - WX.fog);
      F.s.material.uniforms.uSkyA.value = F.a; F.s.visible = F.a > 0.01;
      F.s.material.uniforms.uSkyS.value = 1.2 + 0.6 * clamp(L.elDeg / 15, 0, 1); // less boost with the sun low: twilight would turn teal
      if (F.s.visible) {
        const d = camera.getWorldDirection(_fotoV), yaw = Math.atan2(d.x, d.z), dy = Math.abs(((yaw - F.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (performance.now() - F.t > 500 || Math.abs(TOD - F.tod) > 0.05 || dy > 0.4) fotoSkyHorizon();
      }
    }
    scene.fog.color.lerp(FOTO_FOGGREY, 0.45 * L.day * (1 - (F ? F.a : 0))); if (F && F.a > 0) scene.fog.color.lerp(F.col, F.a * 0.85);
    _far.material.color.convertSRGBToLinear(); _near.material.color.convertSRGBToLinear(); // the mountains' shade is set as a plain number
  };
}
if (FOTO_SKY) { // the old glow round the sun gives way to the sky's own
  const ug = updGlow;
  updGlow = function () { ug(); SUNGLOW.material.opacity *= 1 - 0.7 * FOTO_SKY.a; SUNGLOW.material.visible = SUNGLOW.material.opacity > 0.01; };
}
// ambient occlusion on the walls (AO_WALL in world3.js), after the patch that lights the windows
for (const [k, m] of Object.entries({ old: MAT.old, mod: MAT.mod, plain: MAT.plain })) {
  const before = m.onBeforeCompile; m.onBeforeCompile = s => { before.call(m, s); AO_WALL(s); }; m.customProgramCacheKey = () => 'ao-' + k; m.needsUpdate = true;
}
