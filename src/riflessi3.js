// ---------------------------------------------------------------- reflections for everything (Carlo, 6/11: only the water and the panes of the houses mirrored the sky)
// One technique for all, each with its own roughness, added to the light of the material (Lambert) in its fragment shader, no extra mesh, no texture:
//  - the sky: the colour at the horizon and overhead (FOTO_FAC.uSkyH / uSkyZ, the same the panes of the houses mirror) by the reflected direction, the more
//    at a grazing angle (Schlick Fresnel, softened by the roughness as in the filmic models), blurred towards the average of the sky as the surface gets rougher;
//  - the sun: a lobe (Blinn-Phong normalised, with Fresnel and the geometry term) that is a pin point on a pane and a wide sheen on rough asphalt, off in the shade
//    (it takes the shadow mask the Lambert lighting already computed, no second lookup);
//  - the metals tint what they mirror with their own colour.
// The kinds (RIF_KIND): paint (car bodies), glass (car panes), shop (shop windows), metal (guardrails, lamp posts, railings, gates, rails), asphalt.
// RIF.wet: 0 dry .. 1 soaked, for the day it rains: the asphalt then darkens and goes smoother (sharper, stronger reflections). NOT connected to anything now, it stays 0
// (the weather has WX.wet: when Carlo wants the wet roads, RIF.wet.value = WX.wet in updVisuals is all that is needed).
const RIF = { wet: { value: 0 }, pre: [], cache: {} };
const RIF_KIND = {
  paint: { f0: 0.055, rough: 0.28, k: 1.25, sun: 1.0, metal: 0, wet: 0 },
  glass: { f0: 0.06, rough: 0.07, k: 1.45, sun: 1.0, metal: 0, wet: 0 },
  shop: { f0: 0.06, rough: 0.05, k: 2.0, sun: 1.0, metal: 0, wet: 0 },
  metal: { f0: 0.05, rough: 0.42, k: 1.0, sun: 0.9, metal: 1, wet: 0 },
  asphalt: { f0: 0.04, rough: 0.62, k: 0.8, sun: 0.9, metal: 0, wet: 1, far: 1 }, /* far: only where it is seen at a grazing angle (the shader does nothing above 30 degrees: it would be under 2% of the light) */
};
const RIF_VERT_DECL = 'varying vec3 vRfP;\nvarying vec3 vRfN;';
const RIF_FRAG_DECL = `uniform vec3 uRfH;
uniform vec3 uRfZ;
uniform vec3 uRfD;
uniform vec3 uRfC;
uniform float uRfWet;
varying vec3 vRfP;
varying vec3 vRfN;
vec3 rfSky(vec3 d, float rough) {
  vec3 s = d.y > 0.0 ? mix(uRfH, uRfZ, smoothstep(0.0, 0.55, d.y)) : uRfH * 0.3; /* under the horizon: the ground and the walls, dark */
  return mix(s, mix(uRfH, uRfZ, 0.45), rough * rough * 0.7);
}
`;
function rifFrag(q) {
  const F0 = q.f0.toFixed(4), RO = q.rough.toFixed(3), K = q.k.toFixed(3), SU = q.sun.toFixed(3), ME = q.metal.toFixed(3), WE = q.wet ? '1' : '0';
  return `{
  vec3 rfVv = normalize(vRfP); vec3 rfNv = normalize(vRfN); if (dot(rfNv, -rfVv) < 0.0) rfNv = -rfNv;
  float rfWet = ${WE}.0 * uRfWet;
  float rfNdv = clamp(dot(rfNv, -rfVv), 0.001, 1.0);
  ${q.far ? 'if (rfNdv < 0.5) {' : '{'}
  float rfR = ${RO} * (1.0 - 0.75 * rfWet);
  float rfF0 = ${F0} + 0.03 * rfWet;
  vec3 rfFv0 = mix(vec3(rfF0), clamp(diffuseColor.rgb * 0.95, 0.0, 1.0), ${ME});
  vec3 rfFr = rfFv0 + (max(vec3(1.0 - rfR), rfFv0) - rfFv0) * pow(1.0 - rfNdv, 5.0);
  vec3 rfRw = inverseTransformDirection(reflect(rfVv, rfNv), viewMatrix);
  vec3 rfVw = inverseTransformDirection(rfVv, viewMatrix), rfNw = inverseTransformDirection(rfNv, viewMatrix), rfLw = normalize(uRfD);
  vec3 rfAdd = rfSky(rfRw, rfR) * rfFr * ${K};
  float rfNl = max(dot(rfNw, rfLw), 0.0);
  if (rfNl > 0.0 && rfSh > 0.0) {
    vec3 rfHw = normalize(rfLw - rfVw); float rfNh = max(dot(rfNw, rfHw), 0.0), rfLh = max(dot(rfLw, rfHw), 0.0);
    float rfSp = clamp(2.0 / max(rfR * rfR * rfR * rfR, 0.0004) - 2.0, 4.0, 2500.0);
    float rfD = (rfSp + 2.0) * 0.1592 * pow(rfNh, rfSp);
    float rfKg = (rfR + 1.0) * (rfR + 1.0) * 0.125, rfV = 0.25 / ((rfNl * (1.0 - rfKg) + rfKg) * (rfNdv * (1.0 - rfKg) + rfKg));
    vec3 rfFh = rfFv0 + (1.0 - rfFv0) * pow(1.0 - rfLh, 5.0);
    rfAdd += uRfC * rfFh * (rfD * rfV * rfNl * rfSh * ${SU});
  }
  ${q.far ? 'rfAdd *= smoothstep(0.5, 0.3, rfNdv);' : ''}
  totalEmissiveRadiance += rfAdd;
  }
  ${q.wet ? 'float rfDk = mix(1.0, 0.6, rfWet); reflectedLight.directDiffuse *= rfDk; reflectedLight.indirectDiffuse *= rfDk;' : ''}
}
`;
}
function rifShader(s, q) {
  s.uniforms.uRfH = FOTO_FAC.uSkyH; s.uniforms.uRfZ = FOTO_FAC.uSkyZ; s.uniforms.uRfD = FOTO_FAC.uSunD; s.uniforms.uRfC = FOTO_FAC.uSunC; s.uniforms.uRfWet = RIF.wet;
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\n' + RIF_VERT_DECL).replace('#include <project_vertex>', '#include <project_vertex>\nvRfP = mvPosition.xyz; vRfN = transformedNormal;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\n' + RIF_FRAG_DECL).replace('void main() {', 'void main() {\n  float rfSh = 1.0;')
    .replace('* getShadowMask();', '* (rfSh = getShadowMask());').replace('vec3 outgoingLight =', rifFrag(q) + '  vec3 outgoingLight =');
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
