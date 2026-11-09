// ---------------------------------------------------------------- real lights at night (fase 3): the street lamps and the headlights light the street, the walls and the cars
// On r128 the Lambert lit per vertex: a light on a road of big triangles did nothing, so the pools of light were painted (LAMPPOOL, HEADPOOL). three 0.186 lights per pixel:
// a fixed set of spot lights (always the same number, so no shader is ever compiled again) is given every frame to what is nearest the camera: LUCI_N_LAMP street lamps
// and LUCI_N_AUTO cars with their lights on, beside the player's headlight (headSpot). Each fades out towards the edge of its range, so a lamp that changes hands never jumps;
// the painted pools fade out where the real light takes over (near the camera) and stay further away. ?luci=0 turns them off (the painted pools as before), for the fps
const LUCI_ON = !/[?&]luci=0/.test(location.search), LUCI_N_LAMP = LUCI_ON ? 6 : 0, LUCI_N_AUTO = LUCI_ON ? 3 : 0, LUCI_R_LAMP = 60, LUCI_R_AUTO = 70;
const LUCI = { kl: 1, ka: 1, init: false, lamp: [], auto: [], _c: [], near: { value: LUCI_ON ? 40 : -1 } };
for (let i = 0; i < LUCI_N_LAMP; i++) { const s = new THREE.SpotLight(0xffd6a0, 0, 26, 1.15, 0.85, 2); s.castShadow = false; s.target.position.set(0, -1, 0); scene.add(s, s.target); LUCI.lamp.push(s); }
for (let i = 0; i < LUCI_N_AUTO; i++) { const s = new THREE.SpotLight(0xfff0d8, 0, 55, 0.5, 0.55, 2); s.castShadow = false; scene.add(s, s.target); LUCI.auto.push(s); }
function luciInit() { // at the first frame: headSpot and the pools are made in extras.js, after this file
  LUCI.init = true; if (!LUCI_ON) return; // the player's headlight: a low beam from the bumper, that reaches about 40 m with the physical fall-off
  Object.assign(headSpot, { distance: 75, angle: 0.52, penumbra: 0.55, decay: 2 });
  for (const M of [LAMPPOOL_MAT]) M.onBeforeCompile = s => { // the painted pool fades out near the camera, where the lamp's own light is
    s.uniforms.uLuciNear = LUCI.near;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying float vLuciD;').replace('#include <project_vertex>', '#include <project_vertex>\nvLuciD = length( mvPosition.xyz );');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vLuciD;\nuniform float uLuciNear;').replace('#include <opaque_fragment>', '#include <opaque_fragment>\ngl_FragColor.a *= uLuciNear < 0.0 ? 1.0 : smoothstep( uLuciNear, uLuciNear + 18.0, vLuciD );');
  };
}
function luciAggiorna(on) {
  if (!LUCI.init) luciInit(); if (!LUCI_ON) return;
  const cx = camera.position.x, cz = camera.position.z, k = on > 0.02 ? on : 0, C = LUCI._c; C.length = 0;
  if (k) for (const T of VIVI) { if (!T.lampL || T.dist > 300) continue; for (const l of T.lampL) { if (l.off) continue; const d = Math.hypot(l.x - cx, l.z - cz); if (d < LUCI_R_LAMP) C.push(d, l); } }
  const pick = [];
  for (let i = 0; i < C.length; i += 2) { pick.push(i); } pick.sort((a, b) => C[a] - C[b]);
  LUCI.lamp.forEach((s, i) => {
    const j = pick[i]; if (j === undefined) { s.intensity = 0; return; }
    const l = C[j + 1], d = C[j]; s.position.set(l.x, l.y, l.z); s.target.position.set(l.x, l.y - 7, l.z); s.target.updateMatrixWorld();
    s.intensity = 110 * LUCI.kl * k * clamp((LUCI_R_LAMP - d) / 15, 0, 1);
  });
  // the cars: the nearest with someone at the wheel and the lights on, the player's own has headSpot
  const A = []; if (k) for (const v of VEH) { if (v === P.car || !v.driver || v.health <= 0 || v.exploded || v.fallen || v.heli || v.spec.pedal || !v.m.g.visible) continue; const d = Math.hypot(v.x - cx, v.z - cz); if (d < LUCI_R_AUTO) A.push([d, v]); }
  A.sort((a, b) => a[0] - b[0]);
  LUCI.auto.forEach((s, i) => {
    const e = A[i]; if (!e) { s.intensity = 0; return; }
    const v = e[1], fx = Math.sin(v.h), fz = Math.cos(v.h), hl = v.spec.L / 2; s.position.set(v.x + fx * hl, v.y + 0.75, v.z + fz * hl); s.target.position.set(v.x + fx * (hl + 20), v.y - 0.6, v.z + fz * (hl + 20)); s.target.updateMatrixWorld();
    s.intensity = 70 * LUCI.ka * k * clamp((LUCI_R_AUTO - e[0]) / 20, 0, 1);
  });
}
