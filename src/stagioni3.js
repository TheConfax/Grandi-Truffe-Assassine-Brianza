// ---------------------------------------------------------------- the seasons on the map (fase 3): the leaves of the trees and the grass follow the day of the year
// The day is the true date (as the shops' clock and the light of luce3.js), or the link: ?stagione=primavera|estate|autunno|inverno or ?data=GG-MM (any day),
// or the codes ESTATE, INVERNO, PRIMAVERA, AUTUNNO during the game (STAGIONE goes back to the true date). All goes day by day, not in four steps. Brianza's broadleaves:
// from mid-September the crowns turn, each tree on its own (yellow, orange, a few red), at their fullest in late October; in November the leaves fall, from
// December to the end of March the crowns are bare twigs (a few oaks keep some dry brown leaves), in April-May the new leaves are a light yellow-green.
// The cypresses keep their green (MAT.crownSemp). The grass goes duller and yellower in autumn and winter, fresher in spring. Shader only, nothing rebuilt
const STAG_GIORNI = { primavera: 110, estate: 196, autunno: 298, inverno: 15 }; // a day in the middle of each season, for the link and the codes
const stagOggi = () => { const now = new Date(); return Math.round((now - new Date(now.getFullYear(), 0, 0)) / 864e5 - 0.5); }; /* round: the hour of daylight saving */
let STAG_DOY = (() => {
  const q = new URLSearchParams(location.search), st = (q.get('stagione') || '').toLowerCase(), dm = /^(\d{1,2})-(\d{1,2})$/.exec(q.get('data') || '');
  if (dm) { const y = new Date().getFullYear(); return Math.round((new Date(y, +dm[2] - 1, +dm[1]) - new Date(y, 0, 0)) / 864e5); } /* ?data=GG-MM */
  return STAG_GIORNI[st] ?? stagOggi();
})();
const STAG = { aut: 0, bare: 0, spring: 0, u: { value: new THREE.Vector3() } };
// ---- the bare trees of winter (realismo 2, fase A). Before, the crown's cards drew dashes in the shader where the leaves had gone: from near they floated
// round a bare trunk like scraps. Now a bare tree is what one sees in Brianza in January: the limbs out of the trunk, the branches out of the limbs, the
// thinner branches out to the edge of the crown (RAMI_G, real 3D, in the crown's own space, so it takes the crown's place and size: the same instance matrices),
// and at the edge the fine twigs as a haze (TWIG_TEX on the crown's cards, where the leaves fell; seen from far the haze stays, a grey-brown veil, as a real one).
// Shown only when the leaves are gone (STAG.bare): in summer the branches are not drawn at all
const RAMI_G = (() => {
  const EX = 2.55, EY = 2.2, EC = 0.2; // the crown's envelope in its own space (TREE_G: 5.4 m across, 4.5 m high, its bottom 2 m under its origin)
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const mk = (seed, nP, nCh, nTw) => {
    let sd = seed; const r = () => (sd = sd * 16807 % 2147483647) / 2147483647;
    const P = [], N = [];
    const env = (p, d) => { // how far from p along d the envelope is
      const px = p.x / EX, py = (p.y - EC) / EY, pz = p.z / EX, dx = d.x / EX, dy = d.y / EY, dz = d.z / EX;
      const A = dx * dx + dy * dy + dz * dz, B = 2 * (px * dx + py * dy + pz * dz), C = px * px + py * py + pz * pz - 1, D = B * B - 4 * A * C;
      return D < 0 ? 0 : Math.max(0, (-B + Math.sqrt(D)) / (2 * A));
    };
    const tube = (a, b, r0, r1, n) => { // an open tapered tube a -> b, n sides, normals out from its axis
      const d = b.clone().sub(a).normalize(), u = (Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(d).normalize(), w = d.clone().cross(u), ring = [];
      for (let k = 0; k <= n; k++) { const t = k / n * TAU, c = Math.cos(t), s = Math.sin(t); ring.push(u.clone().multiplyScalar(c).addScaledVector(w, s)); }
      for (let k = 0; k < n; k++) {
        const A0 = a.clone().addScaledVector(ring[k], r0), A1 = a.clone().addScaledVector(ring[k + 1], r0), B0 = b.clone().addScaledVector(ring[k], r1), B1 = b.clone().addScaledVector(ring[k + 1], r1);
        for (const [p, nn] of [[A0, ring[k]], [B0, ring[k]], [B1, ring[k + 1]], [A0, ring[k]], [B1, ring[k + 1]], [A1, ring[k + 1]]]) { P.push(p.x, p.y, p.z); N.push(nn.x, nn.y, nn.z); }
      }
    };
    const veer = (d, a) => { // d turned by about a radians, a random way, a little upwards (branches reach for the light)
      const u = (Math.abs(d.y) < 0.9 ? V(0, 1, 0) : V(1, 0, 0)).cross(d).normalize(), w = d.clone().cross(u), t = r() * TAU;
      return d.clone().multiplyScalar(Math.cos(a)).addScaledVector(u, Math.sin(a) * Math.cos(t)).addScaledVector(w, Math.sin(a) * Math.sin(t)).add(V(0, 0.18, 0)).normalize();
    };
    // a branch of level lev from p along d, length len, radius r0: bent once, with nc side branches, each to the envelope
    const branch = (p, d, len, r0, lev) => {
      const segs = lev < 2 ? 2 : 1, pts = [p.clone()], rs = [r0]; let q = p.clone(), dir = d.clone();
      for (let s = 0; s < segs; s++) { if (s) dir = veer(dir, 0.22); const e = q.clone().addScaledVector(dir, len / segs), r1 = r0 * (1 - 0.62 * (s + 1) / segs); tube(q, e, rs[s], r1, lev === 0 ? 5 : lev === 1 ? 4 : 3); pts.push(e); rs.push(r1); q = e; }
      const nc = lev === 0 ? nCh : lev === 1 ? nTw : 0;
      for (let c = 0; c < nc; c++) {
        const f = (c + 1) / (nc + 0.6) + (r() - 0.5) * 0.12, at = Math.min(segs - 0.001, f * segs), si = Math.floor(at), ft = at - si;
        const o = pts[si].clone().lerp(pts[si + 1], ft), rr = rs[si] + (rs[si + 1] - rs[si]) * ft, cd = veer(pts[si + 1].clone().sub(pts[si]).normalize(), 0.55 + r() * 0.45);
        branch(o, cd, env(o, cd) * (0.82 + r() * 0.14), Math.max(0.006, rr * 0.62), lev + 1);
      }
    };
    const base = V(0, -2.05, 0), up = V((r() - 0.5) * 0.1, 1, (r() - 0.5) * 0.1).normalize();
    branch(base, up, env(base, up) * 0.86, 0.095, 1); // the leader, on from the trunk to near the top
    for (let i = 0; i < nP; i++) { // the limbs, all round, rising
      const az = (i + r() * 0.6) / nP * TAU, el = 0.55 + r() * 0.45, d = V(Math.cos(el) * Math.cos(az), Math.sin(el), Math.cos(el) * Math.sin(az)), o = base.clone().addScaledVector(up, 0.25 + 0.95 * i / nP);
      branch(o, d, env(o, d) * (0.72 + r() * 0.12), 0.08 - 0.02 * i / nP, 0);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.computeBoundingSphere(); return g;
  };
  return { big: mk(11, 6, 3, 3), small: mk(29, 4, 3, 2) }; // the small trees and the woods: fewer limbs and twigs (there are many of them)
})();
// the fine twigs: three sprays in the leaf atlas's three tuft cells (TREE_LEAF's layout; the fourth, the crown's core, stays empty)
const TWIG_TEX = (() => {
  const S = 512, C = S / 2, c = document.createElement('canvas'); c.width = c.height = S; const g = c.getContext('2d'); let sd = 5; const r = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  g.strokeStyle = '#fff'; g.lineCap = 'round';
  const twig = (x, y, a, L, w, lev) => { // a twig in three slightly bent pieces, then two or three thinner ones out of it
    let px = x, py = y; for (let k = 0; k < 3; k++) { a += (r() - 0.5) * 0.35; const nx = px + Math.cos(a) * L / 3, ny = py + Math.sin(a) * L / 3; g.lineWidth = Math.max(0.9, w * (1 - 0.18 * k)); g.beginPath(); g.moveTo(px, py); g.lineTo(nx, ny); g.stroke(); px = nx; py = ny; }
    if (lev >= 3) return; const n = 2 + (r() < 0.4 ? 1 : 0);
    for (let k = 0; k < n; k++) { const f = 0.35 + 0.6 * (k + r() * 0.5) / n, sx = x + (px - x) * f, sy = y + (py - y) * f; twig(sx, sy, a + (r() < 0.5 ? -1 : 1) * (0.35 + r() * 0.45), L * (0.5 + r() * 0.2) * (1.1 - f * 0.4), w * 0.66, lev + 1); }
  };
  for (let cell = 0; cell < 3; cell++) { const cx = (cell % 2) * C + C / 2, cy = (cell >> 1) * C + C / 2; for (let k = 0; k < 6; k++) twig(cx + (r() - 0.5) * 10, cy + (r() - 0.5) * 10, (k + r() * 0.7) / 6 * TAU, C * (0.2 + r() * 0.08), 2.6, 0); }
  const t = new THREE.CanvasTexture(c); t.flipY = false; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); return t; /* flipY off: the same rows as TREE_LEAF, a DataTexture */
})();
const TWIG_U = { uTwig: { value: TWIG_TEX }, uTwigK: { value: 2.6 } }; // uTwigK: how much the far twigs (small mip levels, thin lines averaged away) are made denser
MAT.rami = new THREE.MeshLambertMaterial({ color: 0x55473c }); MAT.rami.visible = false;
function ramiAggiungi(G, crowns, small) { // the bare branches of a set of crowns: the same instances (the same matrix buffer), drawn only when the leaves are gone
  const m = new THREE.InstancedMesh(small ? RAMI_G.small : RAMI_G.big, MAT.rami, crowns.count); m.instanceMatrix = crowns.instanceMatrix; m.castShadow = m.receiveShadow = true; G.add(m); return m;
}
function stagCalcola() { // the leaves and the grass of the day STAG_DOY
  const d = STAG_DOY, ramp = (a, b) => clamp((d - a) / (b - a), 0, 1);
  STAG.aut = ramp(255, 292) * (1 - ramp(316, 336)); STAG.bare = Math.max(ramp(310, 336), 1 - ramp(78, 108)); STAG.spring = ramp(92, 108) * (1 - ramp(140, 168));
  STAG.u.value.set(STAG.aut, STAG.bare, STAG.spring); MAT.rami.visible = STAG.bare > 0.02;
  // the grass: duller and yellower in autumn and winter, fresher in spring (a tint on the photo, the same on every lawn)
  const t = new THREE.Color(1, 1, 1).lerp(new THREE.Color(1.08, 0.9, 0.66), STAG.aut * 0.8).lerp(new THREE.Color(1.12, 0.8, 0.5), STAG.bare * 0.9).lerp(new THREE.Color(1.05, 1.12, 0.72), STAG.spring);
  for (const M of [MAT, RO_MAT]) for (const k in M) { const m = M[k]; if (m && m.isMaterial && m.map === grassTex && k !== 'hedge') { if (!m.userData.stagBase) m.userData.stagBase = m.color.clone(); m.color.copy(m.userData.stagBase).multiply(t); } }
}
stagCalcola();
// during the game: the codes ESTATE, INVERNO, PRIMAVERA, AUTUNNO (nome) and STAGIONE (null: the true date); light (luce3.js), map and snow chance follow at once
function stagioneImposta(nome) {
  STAG_DOY = nome ? STAG_GIORNI[nome] : stagOggi(); stagCalcola(); luceCalcola(); WX_NEXT.nuvoloso.neve = STAG_DOY < 60 || STAG_DOY > 340 ? 0.5 : 0; skyT = -1;
  const p = n => String(n).padStart(2, '0'), g = new Date(new Date().getFullYear(), 0, STAG_DOY);
  toast((nome ? 'Stagione: ' + nome : 'Stagione vera: ' + LUCE.nome) + ' (' + p(g.getDate()) + '/' + p(g.getMonth() + 1) + ')');
}
const STAG_VERT = s => s.replace('#include <common>', '#include <common>\nvarying float vStH;').replace('#include <begin_vertex>', `#include <begin_vertex>
#ifdef USE_INSTANCING
  vStH = fract( sin( dot( instanceMatrix[ 3 ].xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
#else
  vStH = 0.5;
#endif`);
const STAG_FRAG_DECL = '\nuniform vec3 uStag;\nvarying float vStH;\nuniform sampler2D uTwig;\nuniform float uTwigK;\n';
// the leaves that are gone (autumn's fall, winter's bare crowns): the same cut in the colour pass and in the shadow pass. Where a leaf has gone the card shows the
// fine twigs (TWIG_TEX) in its place, never on the crown's solid core (it would be a ball). stTwig tells the later lines of the shader which it is
const STAG_FALL = `
  bool stTwig = false;
#ifdef USE_MAP
  vec4 sampledDiffuseColor = texture2D( map, vMapUv );
  { vec2 stTs = vMapUv * 512.0, stDx = dFdx( stTs ), stDy = dFdy( stTs ); float stLod = max( 0.0, 0.5 * log2( max( dot( stDx, stDx ), dot( stDy, stDy ) ) ) );
    float stTa = texture2D( uTwig, vMapUv ).a;
    float stF = uStag.y * ( vStH > 0.86 ? 0.9 : 1.0 ); vec2 stQ = vMapUv * 48.0; float stC = fract( sin( dot( floor( stQ ) + vStH * 17.0, vec2( 7.13, 3.71 ) ) ) * 91.37 );
    if ( stC < stF ) { /* this leaf has fallen: the twigs (denser far away, where the mip levels thin the lines out) */
      if ( vMapUv.x > 0.5 && vMapUv.y > 0.5 ) discard;
      sampledDiffuseColor = vec4( 1.0, 1.0, 1.0, min( 1.0, stTa * mix( 1.0, uTwigK, clamp( stLod / 4.0, 0.0, 1.0 ) ) ) * smoothstep( 0.3, 0.7, uStag.y ) ); stTwig = true;
    } }
  diffuseColor *= sampledDiffuseColor;
#endif`;
const STAG_TWIG_ALPHA = `if ( stTwig ) { if ( diffuseColor.a < 0.04 ) discard; } else {
#include <alphatest_fragment>
}`; // the twigs keep their thin alpha (alpha to coverage makes it a veil), the leaves are cut as before
function stagCrown(m, sempre) {
  const prev = m.onBeforeCompile;
  m.onBeforeCompile = (s, r) => {
    if (prev) prev.call(m, s, r); if (sempre) return;
    s.uniforms.uStag = STAG.u; Object.assign(s.uniforms, TWIG_U); s.vertexShader = STAG_VERT(s.vertexShader);
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + STAG_FRAG_DECL).replace('#include <map_fragment>', STAG_FALL).replace('#include <alphatest_fragment>', STAG_TWIG_ALPHA).replace('#include <color_fragment>', `#include <color_fragment>
  { float stL = dot( diffuseColor.rgb, vec3( 0.2126, 0.7152, 0.0722 ) ), stT = vStH;
    float stA = uStag.x * smoothstep( 0.0, 0.4, uStag.x * 1.25 - stT * 0.25 ); /* some trees turn later than others */
    vec3 stAu = stT < 0.5 ? vec3( 0.92, 0.66, 0.14 ) : stT < 0.82 ? vec3( 0.93, 0.40, 0.08 ) : vec3( 0.70, 0.15, 0.06 );
    diffuseColor.rgb = mix( diffuseColor.rgb, stAu * stL * 2.1, stA * 0.88 );
    diffuseColor.rgb = mix( diffuseColor.rgb, diffuseColor.rgb * vec3( 1.2, 1.38, 0.6 ), uStag.z ); /* spring: the new leaves, light and yellower */
    if ( stT > 0.86 ) diffuseColor.rgb = mix( diffuseColor.rgb, vec3( 0.42, 0.27, 0.13 ) * ( 0.6 + stL ), uStag.y ); /* winter: the dry leaves some oaks keep */
    if ( stTwig ) diffuseColor.rgb = vec3( 0.085, 0.072, 0.062 ) * 1.8; /* the twigs: grey-brown bark (MAT.crown's colour is 1.8) */
  }`);
  };
  const ck = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; m.customProgramCacheKey = () => ck + (sempre ? '|semp' : '|stag2'); m.needsUpdate = true;
}
function stagDepth(m) { // the shadow of a crown loses the same leaves and keeps the twigs
  m.onBeforeCompile = s => { s.uniforms.uStag = STAG.u; Object.assign(s.uniforms, TWIG_U); s.vertexShader = STAG_VERT(s.vertexShader); s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>' + STAG_FRAG_DECL).replace('#include <map_fragment>', STAG_FALL); };
  m.customProgramCacheKey = () => 'stag-depth2'; m.needsUpdate = true;
}
MAT.crown.alphaToCoverage = true; // the edges of the leaves and the twigs smooth with the multisampling (post3.js draws with it, or the canvas does)
// the cypresses (evergreen) get a crown and a shadow of their own, untouched
MAT.crownSemp = MAT.crown.clone(); MAT.crownSemp.onBeforeCompile = MAT.crown.onBeforeCompile; stagCrown(MAT.crownSemp, true);
const TREE_DEPTH_SEMP = TREE_DEPTH.clone();
stagCrown(MAT.crown, false); stagDepth(TREE_DEPTH);
