// ---------------------------------------------------------------- the seasons on the map (fase 3): the leaves of the trees and the grass follow the day of the year
// The day is the true date (as the shops' clock and the light of luce3.js), or the link: ?stagione=primavera|estate|autunno|inverno. Brianza's broadleaves:
// from mid-September the crowns turn, each tree on its own (yellow, orange, a few red), at their fullest in late October; in November the leaves fall, from
// December to the end of March the crowns are bare twigs (a few oaks keep some dry brown leaves), in April-May the new leaves are a light yellow-green.
// The cypresses keep their green (MAT.crownSemp). The grass goes duller and yellower in autumn and winter, fresher in spring. Shader only, nothing rebuilt
const STAG_DOY = (() => {
  const st = (new URLSearchParams(location.search).get('stagione') || '').toLowerCase(), now = new Date();
  return { primavera: 110, estate: 196, autunno: 298, inverno: 15 }[st] ?? Math.floor((now - new Date(now.getFullYear(), 0, 0)) / 864e5);
})();
const STAG = (() => {
  const d = STAG_DOY, ramp = (a, b) => clamp((d - a) / (b - a), 0, 1);
  const aut = ramp(255, 292) * (1 - ramp(316, 336)), bare = Math.max(ramp(310, 336), 1 - ramp(78, 108)), spring = ramp(92, 108) * (1 - ramp(140, 168));
  return { aut, bare, spring, u: { value: new THREE.Vector3(aut, bare, spring) } };
})();
const STAG_VERT = s => s.replace('#include <common>', '#include <common>\nvarying float vStH;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vStH = fract( sin( dot( instanceMatrix[ 3 ].xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
#else
  vStH = 0.5;
#endif`);
const STAG_FRAG_DECL = '\nuniform vec3 uStag;\nvarying float vStH;\n';
// the leaves that are gone (autumn's fall, winter's bare twigs): the same cut in the colour pass and in the shadow pass
const STAG_FALL = `
#ifdef USE_MAP
  { float stF = uStag.y * ( vStH > 0.86 ? 0.6 : 1.0 ); vec2 stQ = vMapUv * 26.0; float stC = fract( sin( dot( floor( stQ ) + vStH * 17.0, vec2( 7.13, 3.71 ) ) ) * 91.37 );
    vec2 stR = fract( stQ ) - 0.5; float stTw = step( abs( stR.x + stR.y * ( stC - 0.5 ) * 1.6 ), 0.09 ); /* a twig across the cell, at a random slant */
    if ( stC < stF * 0.93 || ( uStag.y > 0.5 && vStH <= 0.86 && stTw < 0.5 ) ) discard; }
#endif`;
function stagCrown(m, sempre) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => {
    if (prev) prev.call(m, s, r); if (sempre) return;
    s.uniforms.uStag = STAG.u; s.vertexShader = STAG_VERT(s.vertexShader);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + STAG_FRAG_DECL).replace('#include <color_fragment>', `#include <color_fragment>
  { float stL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), stT = vStH;
    float stA = uStag.x * smoothstep( 0.0, 0.4, uStag.x * 1.25 - stT * 0.25 ); /* some trees turn later than others */
    vec3 stAu = stT < 0.5 ? vec3( 0.92, 0.66, 0.14 ) : stT < 0.82 ? vec3( 0.93, 0.40, 0.08 ) : vec3( 0.70, 0.15, 0.06 );
    diffuseColor.rgb = mix( diffuseColor.rgb, stAu * stL * 2.1, stA * 0.88 );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.2, 1.38, 0.6 ), uStag.z ); /* spring: the new leaves, light and yellower */
    diffuseColor.rgb = mix( diffuseColor.rgb, stT > 0.86 ? vec3( 0.42, 0.27, 0.13 ) * ( 0.6 + stL ) : vec3( 0.09, 0.075, 0.06 ), uStag.y ); /* winter: twigs, and the dry leaves of some oaks */
  }` + STAG_FALL);
  };
  const ck = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; m.customProgramCacheKey = () => ck + (sempre ? '|semp' : '|stag'); m.needsUpdate = true;
}
function stagDepth(m) { // the shadow of a crown loses the same leaves
  m.onBeforeCompile = s => { s.uniforms.uStag = STAG.u; s.vertexShader = STAG_VERT(s.vertexShader); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + STAG_FRAG_DECL).replace('#include <alphatest_fragment>', '#include <alphatest_fragment>' + STAG_FALL); };
  m.customProgramCacheKey = () => 'stag-depth'; m.needsUpdate = true;
}
// the cypresses (evergreen) get a crown and a shadow of their own, untouched
MAT.crownSemp = MAT.crown.clone(); MAT.crownSemp.onBeforeCompile = MAT.crown.onBeforeCompile; stagCrown(MAT.crownSemp, true);
const TREE_DEPTH_SEMP = TREE_DEPTH.clone();
stagCrown(MAT.crown, false); stagDepth(TREE_DEPTH);
// the grass: duller and yellower in autumn and winter, fresher in spring (a tint on the photo, the same on every lawn)
{
  const t = new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.08, 0.9, 0.66), STAG.aut * 0.8).lerp(new THREE.Color(1.12, 0.8, 0.5), STAG.bare * 0.9).lerp(new THREE.Color(1.05, 1.12, 0.72), STAG.spring);
  for (const M of [MAT, RO_MAT]) for (const k in M) { const m = M[k]; if (m && m.isMaterial && m.map === grassTex && k !== 'hedge') m.color.multiply(t); }
}
