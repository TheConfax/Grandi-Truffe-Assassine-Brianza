// ---------------------------------------------------------------- snow (fase 3): it comes with the weather, not with the season (in Brianza it snows a few days a winter)
// The weather 'neve' (weather3.js) lets the flakes fall round the camera and WX.neve grows: what faces up turns white (lawns and roofs first, the streets less, the
// traffic clears them), the faces that look sideways stay as they are. When it stops, the snow melts in some minutes (sooner under the rain). Shader only: every
// Lambert material of MAT and RO_MAT takes the same few lines, with its own share (NEVE_K). ?neve=1 in the link starts with snow falling and the town white
const NEVE = { u: { value: 0 } };
const NEVE_K = { asph: 0.42, asphS: 0.42, paved: 0.42, pavedS: 0.42, deck: 0.42, mark: 0.42, water: 0, crown: 0, crownSemp: 0, trunk: 0, lamp: 0, lampHead: 0, kerb: 0.6, side: 0.75 };
function neveMat(m, k) {
  if (!m || !m.isMeshLambertMaterial || m.userData.neve || k <= 0) return; m.userData.neve = k;
  const prev = m.onBeforeCompile, ck = m.customProgramCacheKey ? m.customProgramCacheKey() : '';
  m.onBeforeCompile = (s, r) => {
    if (prev) prev.call(m, s, r);
    s.uniforms.uNeve = NEVE.u;
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNeve;').replace('#include <color_fragment>', `#include <color_fragment>
  if ( uNeve > 0.0 ) { vec3 nvN = normalize( cross( dFdx( vViewPosition ), dFdy( vViewPosition ) ) ), nvU = normalize( ( viewMatrix * vec4( 0.0, 1.0, 0.0, 0.0 ) ).xyz );
    float nvF = smoothstep( 0.5, 0.85, dot( nvN, nvU ) ) * clamp( uNeve * ${k.toFixed(2)} * 1.25 - 0.25 * ( 1.0 - dot( diffuseColor.rgb, vec3( 0.33 ) ) ), 0.0, 1.0 );
    diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.86, 0.89, 0.93 ), nvF ); }`);
  };
  m.customProgramCacheKey = () => ck + '|neve'; m.needsUpdate = true;
}
for (const M of [MAT, RO_MAT]) for (const k in M) neveMat(M[k], NEVE_K[k] ?? 1);
