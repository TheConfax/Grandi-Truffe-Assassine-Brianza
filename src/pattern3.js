// ---------------------------------------------------------------- no repeating patterns (Carlo, 6/11): grass, ground, earth, porfido, cobbles
// A texture that repeats every few metres shows its tiles from above and from far away. Shader only (no new texture, no extra mesh):
//  1. every tile of the texture takes a random mirror in u and in v (hash of the tile): the edge of a seamless tile is the same column on both sides, so the mirrored
//     tiles join exactly, and the joints of the porfido and the cobbles run on across the tiles; the sample uses textureGrad, so no seam of the mip level at the tile edges;
//  2. grass, ground and earth (mode 'org') also take a second sample, turned by 30 degrees and 2.6 times larger, with other random mirrors, and the two are mixed (the variance of the photo is kept);
//     porfido and cobbles (mode 'set') are not mixed (the joints would blur) and get a tone for each tile instead (+-8%);
//  3. over everything a slow variation in world coordinates, 20-60 m: paler or darker, a little warmer or greener.
// The asphalt (foto3.js, stochastic tiling of its own) and the pavement of the sidewalks (blocks of their own) are not touched; the water is in acqua3.js
const PAT_GLSL = `
vec3 patS(sampler2D m, vec2 uv, vec2 dx, vec2 dy, float salt, out float hh) {
  vec2 c = floor(uv), f = fract(uv); vec2 h = vec2(h21(c + salt), h21(c + salt + 31.7)); hh = h21(c + salt + 77.3);
  vec2 s = vec2(h.x > .5 ? -1. : 1., h.y > .5 ? -1. : 1.), u2 = f * s + (1. - s) * .5;
#if __VERSION__ >= 300
  return textureGrad(m, u2, dx * s, dy * s).rgb;
#else
  return texture2D(m, uv).rgb;
#endif
}
`;
/* porfido and cobbles: each cube (pebble) of the photo has a number in tex/<name>_id.png (src/cubetti_mappa.py), the same mirror as the colour sample; the tone comes from the
   number and the repetition of the tile the cube lies in (a cube on the edge of the tile, blue channel, has no tile: it keeps the same tone on both sides of the joint).
   Nearest filter, so a cube never has two tones. Far away, where a cube is a few pixels, the variation fades out (no flicker) */
const IDT_GLSL = `
uniform sampler2D uIdMap; uniform vec2 uIdFade;
vec3 idTone(vec2 uv, vec2 dx, vec2 dy, float salt) {
  vec2 c = floor(uv), f = fract(uv); vec2 h = vec2(h21(c + salt), h21(c + salt + 31.7));
  vec2 s = vec2(h.x > .5 ? -1. : 1., h.y > .5 ? -1. : 1.), u2 = f * s + (1. - s) * .5;
  vec4 q = texture2D(uIdMap, u2);
  float id = floor(q.r * 255. + .5) + 256. * floor(q.g * 255. + .5), tk = q.b > .5 ? 0. : c.x * 7.31 + c.y * 13.17 + 1.;
  float r1 = h21(vec2(id * .731 + 3.1, tk)), r2 = h21(vec2(id * .731 + 17.9, tk + 5.3)), r3 = h21(vec2(id * .731 + 41.3, tk + 11.7));
  float fade = 1. - smoothstep(uIdFade.x, uIdFade.y, max(length(dx), length(dy)));
  float v = (r1 - .5) * 2., w = (r2 - .5) * 2., g = (r3 - .5) * 2.;
  vec3 t = vec3(1. + .04 * w, 1., 1. - .055 * w) * (1. + .12 * v);
  t = mix(vec3(dot(t, vec3(.3, .59, .11))), t, 1. + .3 * g);
  return mix(vec3(1.), t, fade);
}
`;
const PAT_FRAG = org => `
  vec4 texelColor;
  { vec2 dx = dFdx(vUv), dy = dFdy(vUv); float hA, hB;
    vec3 tc = patS(map, vUv, dx, dy, 1.3, hA);
    ${org ? `
    const mat2 R2 = mat2(.866, -.5, .5, .866) * .385; /* 30 degrees, 2.6 times larger */
    vec3 tb = patS(map, R2 * vUv + vec2(.31, .77), R2 * dx, R2 * dy, 9.1, hB);
    vec3 mean = vec3(.5);
#if __VERSION__ >= 300
    mean = textureLod(map, vUv, 12.).rgb;
#endif
    tc = mean + (.7 * (tc - mean) + .3 * (tb - mean)) / .7616;` : `
    tc *= idTone(vUv, dx, dy, 1.3);`}
    texelColor = vec4(tc, 1.);
    float ORGK = ${org ? "1.08" : "1."};
    vec2 P = vWp.xz; float sn = slowN(P + 53., 1.6), sm = slowN(P + 191., 2.1);
    texelColor.rgb *= ORGK * (1. + ${org ? '.24' : '.10'} * (sn - .5)) * vec3(1. + .09 * (sm - .5), 1. + .05 * (sm - .5), 1. - .12 * (sm - .5));
  }
  texelColor = mapTexelToLinear(texelColor);
  diffuseColor *= texelColor;`;
const ID_TEX = {};
const idTex = f => ID_TEX[f] || (ID_TEX[f] = (() => {
  const t = new THREE.Texture(); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping;
  new THREE.TextureLoader().load('tex/' + f + '_id.png', img => { t.image = img.image; t.needsUpdate = true; });
  return t;
})());
const PAT_PATCH = (org, idf) => s => { VAR_VERT(s); if (!org) { s.uniforms.uIdMap = { value: idTex(idf) }; s.uniforms.uIdFade = { value: idf === 'porfido' ? new THREE.Vector2(.006, .016) : new THREE.Vector2(.003, .008) }; } s.fragmentShader = VAR_GLSL + (org ? '' : IDT_GLSL) + PAT_GLSL + s.fragmentShader.replace('#include <map_fragment>', PAT_FRAG(org)); };
{
  const org = new Set([grassTex, groundTex, incoltoTex]), set = new Set([porfidoTex, ciottoliTex]);
  for (const M of [MAT, typeof RO_MAT !== 'undefined' ? RO_MAT : {}]) for (const k in M) {
    const m = M[k]; if (!m || !m.isMaterial || k === 'hedge') continue;
    const o = org.has(m.map), p = set.has(m.map); if (!o && !p) continue;
    const idf = m.map === porfidoTex ? 'porfido' : 'ciottoli';
    m.onBeforeCompile = PAT_PATCH(o, idf); m.customProgramCacheKey = () => 'pattern-' + (o ? 'org' : 'set-' + idf); m.needsUpdate = true;
  }
}
