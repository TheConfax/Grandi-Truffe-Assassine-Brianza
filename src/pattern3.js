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
    tc *= 1. + (hA - .5) * .05;`}
    texelColor = vec4(tc, 1.);
    float ORGK = ${org ? "1.08" : "1."};
    vec2 P = vWp.xz; float sn = slowN(P + 53., 1.6), sm = slowN(P + 191., 2.1);
    texelColor.rgb *= ORGK * (1. + ${org ? '.24' : '.10'} * (sn - .5)) * vec3(1. + .09 * (sm - .5), 1. + .05 * (sm - .5), 1. - .12 * (sm - .5));
  }
  texelColor = mapTexelToLinear(texelColor);
  diffuseColor *= texelColor;`;
const PAT_PATCH = org => s => { VAR_VERT(s); s.fragmentShader = VAR_GLSL + PAT_GLSL + s.fragmentShader.replace('#include <map_fragment>', PAT_FRAG(org)); };
{
  const org = new Set([grassTex, groundTex, incoltoTex]), set = new Set([porfidoTex, ciottoliTex]);
  for (const M of [MAT, typeof RO_MAT !== 'undefined' ? RO_MAT : {}]) for (const k in M) {
    const m = M[k]; if (!m || !m.isMaterial || k === 'hedge') continue;
    const o = org.has(m.map), p = set.has(m.map); if (!o && !p) continue;
    m.onBeforeCompile = PAT_PATCH(o); m.customProgramCacheKey = () => 'pattern-' + (o ? 'org' : 'set'); m.needsUpdate = true;
  }
}
