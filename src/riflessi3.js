// ---------------------------------------------------------------- reflections for everything (Carlo, 6/11: only the water and the panes of the houses mirrored the sky)
// One technique for all, each with its own roughness, added to the light of the material (Lambert) in its fragment shader, no extra mesh, no texture:
//  - the sky: the colour at the horizon and overhead (FOTO_FAC.uSkyH / uSkyZ, the same the panes of the houses mirror) by the reflected direction, the more
//    at a grazing angle (Schlick Fresnel, softened by the roughness as in the filmic models), blurred towards the average of the sky as the surface gets rougher;
//  - the sun: a lobe (Blinn-Phong normalised, with Fresnel and the geometry term) that is a pin point on a pane and a wide sheen on rough asphalt, off in the shade
//    (it takes the shadow mask the Lambert lighting already computed, no second lookup);
//  - the metals tint what they mirror with their own colour.
// The kinds (RIF_KIND): paint (car bodies), glass (car panes), shop (shop windows), metal (guardrails, lamp posts, railings, gates, rails), asphalt.
// RIF.wet: 0 dry .. 1 soaked, for the day it rains: the asphalt then darkens and goes smoother (sharper, stronger reflections). It follows WX.wet (weather3.js, fase 3)
const RIF = { wet: { value: 0 }, t: { value: 0 }, rain: { value: 0 }, pre: [], cache: {}, pr: { tex: { value: null }, mat: { value: new THREE.Matrix4() }, on: { value: 0 } } }; /* pr: the planar reflection of the wet ground (bagnato3.js) */ // t, rain: the rings of the drops in the puddles (realismo 2, fase C)
// Realismo 2, fase C: what a body or a pane mirrors near the horizon is the town, not the sky: a skyline of houses all round (by direction, lit as a wall
// in the open, blurred with the roughness), so a car going by shows the houses sliding over its sides. And in the rain the asphalt gets puddles: where the
// ground is a little lower (a noise in metres, the same for all), they grow with the wet, mirror like water (smooth, dark under) and ring with the drops
{ const u = updDayNight; updDayNight = function (dt) { u(dt); RIF.t.value = (RIF.t.value + dt) % 1000; RIF.rain.value = WX.rain; }; }
const RIF_KIND = {
  paint: { f0: 0.055, rough: 0.28, k: 1.25, sun: 1.0, metal: 0, wet: 0 },
  glass: { f0: 0.06, rough: 0.07, k: 1.45, sun: 1.0, metal: 0, wet: 0 },
  shop: { f0: 0.06, rough: 0.05, k: 2.0, sun: 1.0, metal: 0, wet: 0 },
  metal: { f0: 0.05, rough: 0.42, k: 1.0, sun: 0.9, metal: 1, wet: 0 },
  asphalt: { f0: 0.04, rough: 0.62, k: 0.8, sun: 0.9, metal: 0, wet: 1, far: 1 },
  stone: { f0: 0.04, rough: 0.75, k: 0.6, sun: 0.7, metal: 0, wet: 1, far: 1 }, /* realismo 3: pavements, setts, concrete (materiali3.js) */ /* far: only where it is seen at a grazing angle (the shader does nothing above 30 degrees: it would be under 2% of the light) */
};
const RIF_VERT_DECL = 'varying vec3 vRfP;\nvarying vec3 vRfN;';
const RIF_FRAG_DECL = `uniform vec3 uRfH;
uniform vec3 uRfZ;
uniform vec3 uRfD;
uniform vec3 uRfC;
uniform float uRfWet;
uniform float uRfT;
uniform float uRfRain;
uniform sampler2D uPrTex;
uniform mat4 uPrMat;
uniform float uPrOn;
varying vec3 vRfP;
varying vec3 vRfN;
float rfHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float rfNoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(rfHash(i), rfHash(i + vec2(1.0, 0.0)), f.x), mix(rfHash(i + vec2(0.0, 1.0)), rfHash(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 rfSky(vec3 d, float rough, float city) {
  vec3 s = d.y > 0.0 ? mix(uRfH, uRfZ, smoothstep(0.0, 0.55, d.y)) : uRfH * 0.3; /* under the horizon: the ground and the walls, dark */
  float rfAz = atan(d.z, d.x) * 7.64, rfHb = 0.04 + 0.17 * rfHash(vec2(floor(rfAz), 3.7)), rfE = 0.012 + 0.2 * rough; /* the houses round: 48 of them all round, each its height */
  s = mix(s, uRfH * vec3(0.5, 0.47, 0.43), city * 0.85 * (1.0 - smoothstep(rfHb - rfE, rfHb + rfE, d.y)) * smoothstep(-0.3, -0.05, d.y));
  return mix(s, mix(uRfH, uRfZ, 0.45), rough * rough * 0.7);
}
vec2 rfRipple(vec2 p, float t) { /* the rings of the drops: two layers of cells of 40 cm, a ring each, growing and fading; the slope of the ring as a tilt of the normal */
  vec2 acc = vec2(0.0);
  for (int k = 0; k < 2; k++) {
    vec2 q = p * 2.5 + float(k) * 0.37, c = floor(q), f = fract(q) - 0.5; float h = rfHash(c + float(k) * 17.0);
    vec2 d = f - (vec2(fract(h * 13.1), fract(h * 7.7)) - 0.5) * 0.5; float ph = fract(t * 1.1 + h), dl = max(length(d), 1e-3), w = (dl - ph * 0.45) * 30.0;
    acc += d / dl * (abs(w) < 3.14159 ? sin(w) : 0.0) * (1.0 - ph);
  }
  return acc * 0.12;
}
`;
function rifFrag(q) {
  const F0 = q.f0.toFixed(4), RO = q.rough.toFixed(3), K = q.k.toFixed(3), SU = q.sun.toFixed(3), ME = q.metal.toFixed(3), WE = q.wet ? '1' : '0';
  return `{
  vec3 rfVv = normalize(vRfP); vec3 rfNv = normalize(vRfN); if (dot(rfNv, -rfVv) < 0.0) rfNv = -rfNv;
  vec3 rfNb = normalize(RF_NRM); if (dot(rfNb, -rfVv) < 0.0) rfNb = -rfNb; /* realismo 3: the normal bent by the relief (materiali3.js) for the lobes of the sun and the lamps; the sky's Fresnel keeps the surface's own */
  float rfWet = ${WE}.0 * uRfWet, rfPd = 0.0;
  ${q.wet ? `if (rfWet > 0.0) { vec3 rfWp = (vec4(vRfP, 0.0) * viewMatrix).xyz + cameraPosition; /* the puddles, on what lies flat */
    if (inverseTransformDirection(rfNv, viewMatrix).y > 0.9) {
      vec2 rfQ = rfWp.xz; float rfNs = rfNoise(rfQ * 0.3) * 0.5 + rfNoise(mat2(0.8, -0.6, 0.6, 0.8) * rfQ * 0.75 + 7.3) * 0.3 + rfNoise(mat2(0.28, 0.96, -0.96, 0.28) * rfQ * 1.8 + 3.1) * 0.2, rfTh = 1.0 - 0.25 * rfWet; /* three turned octaves: round puddles, not squares */ rfPd = smoothstep(rfTh, rfTh + 0.035, rfNs);
      if (rfPd > 0.0 && uRfRain > 0.0) { vec2 rfRp = rfRipple(rfWp.xz, uRfT) * min(uRfRain * 1.5, 1.0) * rfPd; rfNv = normalize(rfNv + (viewMatrix * vec4(rfRp.x, 0.0, rfRp.y, 0.0)).xyz); }
    } }` : ''}
  rfNb = normalize(mix(rfNv, rfNb, 0.5 * (1.0 - rfPd))); /* half the relief for the lobes (all of it lit the rough setts like glass at a grazing angle); a puddle is flat water */
  float rfNdv = clamp(dot(rfNv, -rfVv), 0.001, 1.0);
  ${q.far ? 'if (rfNdv < 0.5 + 0.35 * rfWet || rfPd > 0.0) {' : '{'} /* wet: the mirror is seen at steeper angles too (realismo 3) */
  float rfR = mix(clamp(${RO} * mix(1.0, r3R, 0.5), 0.04, 1.0) * (1.0 - 0.75 * rfWet), 0.03, rfPd);
  float rfF0 = ${F0} + 0.03 * rfWet - 0.05 * rfPd;
  vec3 rfFv0 = mix(vec3(rfF0), clamp(diffuseColor.rgb * 0.95, 0.0, 1.0), ${ME});
  vec3 rfFr = rfFv0 + (max(vec3(1.0 - rfR), rfFv0) - rfFv0) * pow(1.0 - rfNdv, 5.0);
  vec3 rfRw = inverseTransformDirection(reflect(rfVv, rfNv), viewMatrix);
  vec3 rfVw = inverseTransformDirection(rfVv, viewMatrix), rfNw = inverseTransformDirection(rfNb, viewMatrix), rfLw = normalize(uRfD);
  vec3 rfEnv = rfSky(rfRw, rfR, ${q.wet ? '0.0' : '1.0'}); /* the ground mirrors the sky only: a skyline drawn by direction would not match what stands round */
  ${q.wet ? `if (uPrOn > 0.5 && rfWet > 0.02) { /* realismo 3, fase D: what the wet ground really mirrors, the scene drawn from under the ground (bagnato3.js), bent by the relief and the rings */
    vec3 rfWq = (vec4(vRfP, 0.0) * viewMatrix).xyz + cameraPosition; vec4 rfPc = uPrMat * vec4(rfWq, 1.0);
    /* Carlo 13/11, "forse fin troppo forti": on the asphalt the mirror is weak, blurred and drawn out vertically towards the viewer (the grain breaks it), only the strong
       lights stand out of it (lamps, headlights, shop windows, lit windows); a sharp mirror only in the puddles */
    vec2 rfJ = (rfNb.xy - normalize(vRfN).xy) * mix(0.12, 0.03, rfPd) + vec2((rfNoise(rfWq.xz * 6.0) - 0.5) * 0.012 * (1.0 - rfPd), 0.0);
    vec2 rfPu = rfPc.xy / rfPc.w + rfJ;
    float rfIn = smoothstep(0.0, 0.03, min(min(rfPu.x, 1.0 - rfPu.x), min(rfPu.y, 1.0 - rfPu.y)));
    if (rfIn > 0.0) {
      vec3 rfPs = texture2D(uPrTex, rfPu).rgb, rfSt = vec3(0.0); float rfSv = 0.03 + 0.12 * rfR, rfSu = 0.006;
      for (int k = -3; k <= 3; k++) { float t = float(k) / 3.0; rfSt += texture2D(uPrTex, rfPu + vec2(rfSu * (k == 0 ? 0.0 : (fract(float(k) * 0.37) - 0.5)), rfSv * t)).rgb * (1.0 - 0.5 * abs(t)); }
      rfSt /= 4.0; /* the streak: seven taps up and down the picture, the middle ones weigh more */
      float rfLe = dot(rfEnv, vec3(0.2126, 0.7152, 0.0722)), rfLp = dot(rfSt, vec3(0.2126, 0.7152, 0.0722)), rfHl = smoothstep(rfLe * 1.3 + 0.02, rfLe * 4.0 + 0.1, rfLp);
      vec3 rfAs = mix(mix(rfEnv, rfSt, 0.65) * 0.6, rfSt * 1.1, 0.9 * rfHl); /* the asphalt: dull and dim, the bright lights through */
      rfEnv = mix(rfEnv, mix(rfAs, rfPs, rfPd), rfIn * clamp(rfWet * 1.6, 0.0, 1.0) * (1.0 - smoothstep(0.3, 0.75, rfR))); } }` : ''}
  vec3 rfAdd = rfEnv * rfFr * ${K} * ${q.wet ? '(1.0 - 0.3 * rfWet * (1.0 - rfPd))' : '1.0'}; /* wet: a little less of the sky's light at a grazing angle (the asphalt went nearly white, realismo 2) */
  float rfNl = max(dot(rfNw, rfLw), 0.0);
  if (rfNl > 0.0 && rfSh > 0.0) {
    vec3 rfHw = normalize(rfLw - rfVw); float rfNh = max(dot(rfNw, rfHw), 0.0), rfLh = max(dot(rfLw, rfHw), 0.0);
    float rfSp = clamp(2.0 / max(rfR * rfR * rfR * rfR, 0.0004) - 2.0, 4.0, 2500.0);
    float rfD = (rfSp + 2.0) * 0.1592 * pow(rfNh, rfSp);
    float rfKg = (rfR + 1.0) * (rfR + 1.0) * 0.125, rfV = 0.25 / ((rfNl * (1.0 - rfKg) + rfKg) * (rfNdv * (1.0 - rfKg) + rfKg));
    vec3 rfFh = rfFv0 + (1.0 - rfFv0) * pow(1.0 - rfLh, 5.0);
    rfAdd += uRfC * rfFh * (rfD * rfV * rfNl * rfSh * ${SU});
  }
  ${q.far ? 'rfAdd *= max(smoothstep(0.5 + 0.35 * rfWet, 0.3 * (1.0 - rfWet), rfNdv), rfPd) * (1.0 - 0.3 * rfPd);' : ''}
  totalEmissiveRadiance += rfAdd;
  }
  ${q.wet ? `#if NUM_SPOT_LIGHTS > 0
  if (rfWet > 0.0) { /* the lamps and the headlights mirrored by the wet ground and the puddles: the light's own lobe, long at a grazing angle */
    float rfR2 = mix(clamp(${RO} * mix(1.0, r3R, 0.5), 0.04, 1.0) * (1.0 - 0.75 * rfWet), 0.03, rfPd), rfSp2 = clamp(2.0 / max(rfR2 * rfR2 * rfR2 * rfR2, 0.0004) - 2.0, 4.0, 2500.0); vec3 rfS2 = vec3(0.0); IncidentLight rfIL;
    for (int i = 0; i < NUM_SPOT_LIGHTS; i++) {
      getSpotLightInfo(spotLights[i], geometryPosition, rfIL); float rfNl2 = max(dot(rfNb, rfIL.direction), 0.0); if (rfNl2 <= 0.0) continue;
      vec3 rfH2 = normalize(rfIL.direction - rfVv); float rfD2 = (rfSp2 + 2.0) * 0.1592 * pow(max(dot(rfNb, rfH2), 0.0), rfSp2);
      rfS2 += rfIL.color * (0.02 + 0.98 * pow(1.0 - max(dot(rfIL.direction, rfH2), 0.0), 5.0)) * rfD2 * 0.25 * rfNl2;
    }
    totalEmissiveRadiance += min(rfS2 * rfWet, vec3(30.0));
  }
  #endif` : ''}
  ${q.wet ? 'float rfDk = mix(1.0, 0.6, rfWet) * mix(1.0, 0.55, rfPd); reflectedLight.directDiffuse *= rfDk; reflectedLight.indirectDiffuse *= rfDk;' : ''}
}
`;
}
// the sun's shadow for the lobe (three 0.186): the Lambert lights per pixel and has no getShadowMask() any more; the shadow of the sun (the one directional light) is taken
// where three computes it for the lighting, the same lookup, so the sun no longer shines on the asphalt and the cars in the shade
const RIF_LFB = (() => {
  const c = THREE.ShaderChunk.lights_fragment_begin, a = ['directLight.color *= ( directLight.visible && receiveShadow ) ? getSunShadow( sunShadowMap[ i ]', 'directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ]'].find(t => c.includes(t)); /* the SunLight's cascades (realismo 2) or the old directional light */
  if (!a) return null;
  const i = c.indexOf(a), j = c.indexOf(';', i), sh = c.slice(i + 'directLight.color *= '.length, j);
  return c.slice(0, i) + '{ float rfS_ = ' + sh + '; directLight.color *= rfS_; rfSh = min( rfSh, rfS_ ); }' + c.slice(j + 1);
})();
function rifShader(s, q) {
  s.uniforms.uRfH = FOTO_FAC.uSkyH; s.uniforms.uRfZ = FOTO_FAC.uSkyZ; s.uniforms.uRfD = FOTO_FAC.uSunD; s.uniforms.uRfC = FOTO_FAC.uSunC; s.uniforms.uRfWet = RIF.wet; s.uniforms.uRfT = RIF.t; s.uniforms.uRfRain = RIF.rain; s.uniforms.uPrTex = RIF.pr.tex; s.uniforms.uPrMat = RIF.pr.mat; s.uniforms.uPrOn = RIF.pr.on;
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + RIF_VERT_DECL).replace('#include <project_vertex>', '#include <project_vertex>\nvRfP = mvPosition.xyz; vRfN = transformedNormal;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n#ifdef R3_NRM\n#define RF_NRM normal\n#else\n#define RF_NRM vRfN\n#endif\n' + RIF_FRAG_DECL).replace('void main() {', 'void main() {\n  float rfSh = 1.0;' + (/float r3R = /.test(s.fragmentShader) ? '' : '\n  vec3 r3N = vec3(0., 0., 1.); float r3R = 1.;')) /* RF_NRM, r3R: the normal bent by the relief and the roughness of the texel (materiali3.js, realismo 3) */
    .replace('#include <lights_fragment_begin>', RIF_LFB || '#include <lights_fragment_begin>').replace('vec3 outgoingLight =', rifFrag(q) + '  vec3 outgoingLight =');
}
// patches a Lambert material in place (the other patches of the material, e.g. the asphalt's, are kept and run first)
function rifMat(m, kind, instanced) {
  if (m.userData.rif) return m; m.userData.rif = kind; const q = RIF_KIND[kind], before = m.onBeforeCompile, prev = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (s, r) => { before.call(m, s, r); rifShader(s, q); };
  m.customProgramCacheKey = () => prev + '|rif-' + kind; m.needsUpdate = true; RIF.pre.push([m, !!instanced]); return m;
}
// the paint of a car: one material per colour (not the shared lam() ones: the same grey is also the colour of other things)
function rifPaint(color) { return RIF.cache[color] || (RIF.cache[color] = rifMat(new THREE.MeshLambertMaterial({ color }), 'paint')); }
function rifClone(m) { const c = m.clone(), kind = m.userData.rif; c.userData = {}; return kind ? rifMat(c, kind) : c; } /* a car's own paint when it starts to burn */
for (const k of ['asph', 'asphS', 'paved', 'pavedS', 'deck']) if (MAT[k]) rifMat(MAT[k], 'asphalt');
for (const k of ['rail', 'steel', 'railing', 'bars', 'railPanel']) if (MAT[k]) rifMat(MAT[k], 'metal');
rifMat(MAT.lamp, 'metal', true); rifMat(GATE_MAT, 'metal');
rifMat(M_GLASS, 'glass'); rifMat(M_GLASS_SEE, 'glass');
for (const k in NG_WIN.mat) rifMat(NG_WIN.mat[k], 'shop');
