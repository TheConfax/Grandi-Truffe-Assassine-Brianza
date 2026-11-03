// ---------------------------------------------------------------- foto: photographic surfaces (ramo fotorealismo)
// the drawn textures of the ground surfaces get the grain of real photos (Poly Haven, CC0), recoloured to the same mean colour
// (tex/*.jpg, made from the originals by the script in the commit): same palette, real asphalt cracks, blades of grass, paving joints.
// The texture object stays the same, so every material using it follows; repeat turns the UV scale the surface was drawn with
// (metres per repeat) into the size of the photo (metres)
/* asfalto: three candidate photos (all CC0), chosen in the link with &asfalto=1|2|3 (default 1); metres a photo covers: 1 ambientCG Asphalt015 and 3 Asphalt031
   (the site declares no size: 2 m assumed), 2 Poly Haven asphalt_04 (4.04 m declared). &asfsh=0 turns the asphalt details off (for the cost measure) */
const ASF_N = (/[?&]asfalto=([123])/.exec(location.search) || [0, '1'])[1], ASF_FILE = 'asfalto_' + ASF_N, ASF_M = [0, 2, 4.04, 2][+ASF_N];
const ASF_U = { value: /[?&]asfsh=0/.test(location.search) ? 0 : 1 }; window.__ASFU = ASF_U;
const FOTO_TEX = [[asphaltTex, 'asfalto', 9 / 3], [grassTex, 'prato', 9 / 2], [groundTex, 'terreno', 10 / 2], [sidewalkTex, 'marciapiede', 4 / 2], [porfidoTex, 'porfido', 4 / 1], [ciottoliTex, 'ciottoli', 4 / 4]];
{
  const ld = new THREE.TextureLoader();
  for (const [t, f, r] of FOTO_TEX) ld.load('tex/' + (t === asphaltTex ? ASF_FILE : f) + '.jpg', img => { t.image = img.image; t.repeat.set(t === asphaltTex ? 9 / ASF_M : r, t === asphaltTex ? 9 / ASF_M : r); t.needsUpdate = true; });
}
// no repeating patterns (shaders only, no extra mesh). The photo of the pavement is a regular grid: 20 rows of 25.6 px (the first joint at 25 px), blocks 51.2 px wide in a
// running bond, the row's phase in BLK_PH (fitted on the joints of tex/marciapiede.jpg, 512 px = 2 m). Every block takes the face of another
// block of the photo, picked by a hash of the block in the world (its row, its column and the tile its centre lies in), sometimes turned 180
// degrees: the sample goes to the donor block at the same offset from its centre, so the joints stay straight and aligned. On top of it a tone
// per block (lighter or darker, towards pale pink or nearly brown), and a slow variation of 15-45 m in world coordinates (paler, dirtier, damp
// zones). Far away, where a block is a few pixels, the plain photo takes over (no flicker). The asphalt is as in dev (its texture is chosen with
// Carlo). Paint, kerbs and the rest are not touched
const BLK_PH = [25.4, 0.2, 25.2, 0.4, 26.0, 0.6, 26.0, 0.2, 25.8, 0.6, 26.0, 0.6, 26.0, 0.6, 26.0, 0.4, 25.4, 50.6, 25.2, 0.0];
const VAR_GLSL = `
varying vec3 vWp;
float h21(vec2 p) { vec3 q = fract(vec3(p.xyx) * .1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vn(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float slowN(vec2 p, float k) { return vn(p / (17. * k) + 3.7) * .55 + vn(p / (29. * k) + 11.3) * .45; }
`;
const VAR_VERT = s => { s.vertexShader = 'varying vec3 vWp;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vWp = (modelMatrix * vec4(transformed, 1.0)).xyz;'); };
MAT.side.onBeforeCompile = s => {
  VAR_VERT(s); s.uniforms.uPh = { value: BLK_PH };
  s.fragmentShader = 'uniform float uPh[20];\n' + VAR_GLSL + s.fragmentShader.replace('#include <map_fragment>', `
  vec4 texelColor = texture2D( map, vUv );
  { vec2 dx = dFdx(vUv), dy = dFdy(vUv);
    float fw = max(length(dx), length(dy)), amp = 1. - smoothstep(.012, .05, fw), a2 = 1. - smoothstep(.008, .03, fw); /* the blocks fade into the plain photo when they are a few pixels */
    vec2 P = vec2(vUv.x, 1. - vUv.y) * 512.; /* pixels of the photo */
    float r = floor(mod(P.y - 25., 512.) / 25.6), ph = uPh[int(r)], j = floor(mod(P.x - ph, 512.) / 51.2);
    vec2 cen = vec2(ph + 51.2 * (j + .5), 25. + 25.6 * (r + .5)), rel = mod(P - cen + 256., 512.) - 256.;
    vec2 cell = floor(vec2(vUv.x - rel.x / 512., vUv.y + rel.y / 512.)); /* the tile the block's centre lies in: one block, one id, also across the edge of the photo */
    vec2 sd = vec2(r * 13. + j + 1., cell.x * 3.17 + cell.y * 5.31 + 1.7);
    float hb = h21(sd), hc = h21(sd + 17.1), hd = h21(sd + 31.7), he = h21(sd + 47.3), hf = h21(sd + 63.9);
    float rd = min(floor(hd * 20.), 19.), jd = min(floor(he * 10.), 9.), rot = hf > .5 ? -1. : 1.;
    vec2 cen2 = vec2(uPh[int(rd)] + 51.2 * (jd + .5), 25. + 25.6 * (rd + .5)), P2 = cen2 + rel * rot, uv2 = vec2(P2.x, 512. - P2.y) / 512.;
#if __VERSION__ >= 300
    vec4 face = textureGrad( map, uv2, dx * rot, dy * rot );
#else
    vec4 face = texelColor;
#endif
    texelColor = mapTexelToLinear( mix(texelColor, face, a2) );
    float lum = 1. + (hb - .5) * .60 * amp, tn = (hc - .5) * amp; /* tn > 0: pale pink, < 0: nearly brown */
    texelColor.rgb *= lum * vec3(1. + .12 * tn, 1. + .38 * tn, 1. + .6 * tn);
    float n = slowN(vWp.xz, 1.5), dirty = smoothstep(.5, .72, n), damp = smoothstep(.55, .75, slowN(vWp.xz + 40., 1.2));
    float g = dot(texelColor.rgb, vec3(.3, .59, .11));
    texelColor.rgb = mix(texelColor.rgb, vec3(g * 1.12), .22 * dirty);          /* faded, paler */
    texelColor.rgb *= 1. - .10 * damp - .06 * dirty * (1. - damp);                 /* damp and dirty: darker */
  }
  diffuseColor *= texelColor;`);
};
MAT.side.customProgramCacheKey = () => 'marciapiede-var'; MAT.side.needsUpdate = true;
// incolti: the grass photo dried out (half its green gone, towards straw), large soft patches a bit greener or paler, the ground photo
// turned brown through irregular blotches (bare earth), a few dark tufts; composed once on a canvas when both photos are in, 16 m a repeat
Promise.all(['prato', 'terreno'].map(f => new Promise(ok => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => ok(null); i.src = 'tex/' + f + '.jpg'; }))).then(([pr, te]) => {
  if (!pr || !te) return;
  const N = 1024, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'); let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  const W9 = [[0, 0], [N, 0], [-N, 0], [0, N], [0, -N], [N, N], [N, -N], [-N, N], [-N, -N]]; /* every blotch drawn with its copies across the edges: the texture tiles seamlessly */
  const blob = (c, n, r0, r1, a) => { for (let k = 0; k < n; k++) { const x = r() * N, y = r() * N, rad = r0 + r() * (r1 - r0), ry = rad * (.45 + r() * .55), rot = r() * 3; for (const [dx, dy] of W9) { c.save(); c.translate(x + dx, y + dy); c.rotate(rot); c.scale(1, ry / rad); const gr = c.createRadialGradient(0, 0, rad * .15, 0, 0, rad); gr.addColorStop(0, 'rgba(0,0,0,' + a + ')'); gr.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = gr; c.fillRect(-rad, -rad, 2 * rad, 2 * rad); c.restore(); } } };
  const masked = (fill, mask) => { const e = document.createElement('canvas'); e.width = e.height = N; const eg = e.getContext('2d'); fill(eg); eg.globalCompositeOperation = 'destination-in'; eg.drawImage(mask, 0, 0); return e; };
  const maskOf = (...b) => { const m = document.createElement('canvas'); m.width = m.height = N; const mg = m.getContext('2d'); blob(mg, ...b); return m; };
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) g.drawImage(pr, i * N / 8, j * N / 8, N / 8, N / 8); /* the grass photo is 2 m: eight times across the 16 m */
  g.globalCompositeOperation = 'saturation'; g.globalAlpha = .5; g.fillStyle = '#808080'; g.fillRect(0, 0, N, N); /* dried: half the green gone */
  g.globalCompositeOperation = 'multiply'; g.globalAlpha = 1; g.fillStyle = '#ead9a6'; g.fillRect(0, 0, N, N); g.globalCompositeOperation = 'source-over'; /* towards straw */
  const tone = (n, r0, r1, a, col, op) => { const t = masked(c => { c.fillStyle = col; c.fillRect(0, 0, N, N); }, maskOf(n, r0, r1, a)); g.globalCompositeOperation = op; g.drawImage(t, 0, 0); g.globalCompositeOperation = 'source-over'; };
  tone(9, 160, 320, .25, '#a7b06a', 'multiply'); /* large patches a bit greener: no even carpet (paler ones showed the 16 m repeat from above) */
  const earth = masked(c => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) c.drawImage(te, i * N / 4, j * N / 4, N / 4, N / 4); c.globalCompositeOperation = 'color'; c.fillStyle = '#7a6640'; c.fillRect(0, 0, N, N); }, maskOf(55, 16, 90, .95));
  g.drawImage(earth, 0, 0); /* bare earth in the blotches (the ground photo, 4 m, turned brown), blended at the edges; some straw still shows through */
  g.globalAlpha = .2; g.strokeStyle = '#4d5226'; g.lineWidth = 1.2; for (let k = 0; k < 3000; k++) { const x = r() * N, y = r() * N, a = r() * 6.3, l = 2 + r() * 4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke(); } g.globalAlpha = 1; /* tufts */
  incoltoTex.image = cv; incoltoTex.repeat.set(.75, .75); incoltoTex.needsUpdate = true; /* 16 m a repeat (UV every 12 m) */
});
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
  return { s, probe, ps, rt: new THREE.WebGLRenderTarget(8, 2), cam: new THREE.PerspectiveCamera(12, 4, 1, SKY_R * 2), px: new Uint8Array(64), att: [], pbo: [], col: new THREE.Color(0xc9ced4), zen: new THREE.Color(0x6f8fbf), t: -1e9, tod: -1, yaw: 0, a: 0 };
})();
function fotoSkyHorizon() { // the mean colour of the sky just over the horizon ahead (linear, before the filmic curve: as the fog needs it)
  const F = FOTO_SKY, d = camera.getWorldDirection(_fotoV), yaw = Math.atan2(d.x, d.z);
  F.probe.position.copy(camera.position); F.cam.position.copy(camera.position); F.cam.lookAt(camera.position.x + d.x, camera.position.y + Math.tan(0.05) * Math.hypot(d.x, d.z), camera.position.z + d.z);
  const gl = renderer.getContext(), asinc = renderer.capabilities.isWebGL2 && F.t > 0, leggi = (c, px) => { let r = 0, g = 0, b = 0; for (let i = 0; i < 16; i++) { r += px[i * 4]; g += px[i * 4 + 1]; b += px[i * 4 + 2]; } c.setRGB(r / 4080, g / 4080, b / 4080); };
  if (asinc && F.att.length) { F.t = performance.now(); return; } /* the last answer has not come yet: no second question on top of it */
  const was = renderer.getRenderTarget(), read = c => { renderer.setRenderTarget(F.rt); renderer.render(F.ps, F.cam);
    if (!asinc) { renderer.readRenderTargetPixels(F.rt, 0, 0, 8, 2, F.px); leggi(c, F.px); return; } /* the first of all, before the first frame: it can wait */
    /* a read from the GPU waits for all the GPU has yet to draw, 20 ms and more twice a second: asked here, the answer is picked up a frame or two later (fotoSkyArrivi) */
    const pbo = F.pbo.pop() || gl.createBuffer(); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, pbo); gl.bufferData(gl.PIXEL_PACK_BUFFER, 64, gl.STREAM_READ); gl.readPixels(0, 0, 8, 2, gl.RGBA, gl.UNSIGNED_BYTE, 0); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null);
    F.att.push({ c, pbo, s: gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0), leggi }); gl.flush(); };
  read(F.col);
  F.cam.lookAt(camera.position.x + d.x * 0.6, camera.position.y + 1, camera.position.z + d.z * 0.6); read(F.zen); // and higher up, for the panes
  renderer.setRenderTarget(was); F.t = performance.now(); F.tod = TOD; F.yaw = yaw;
}
function fotoSkyArrivi() { // the answers that have come: the colours, a frame or two after the question
  const F = FOTO_SKY, A = F.att; if (!A.length) return; const gl = renderer.getContext();
  while (A.length) { const q = A[0], st = gl.clientWaitSync(q.s, 0, 0); if (st !== gl.ALREADY_SIGNALED && st !== gl.CONDITION_SATISFIED) return; gl.deleteSync(q.s); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, q.pbo); gl.getBufferSubData(gl.PIXEL_PACK_BUFFER, 0, F.px); gl.bindBuffer(gl.PIXEL_PACK_BUFFER, null); q.leggi(q.c, F.px); F.pbo.push(q.pbo); A.shift(); }
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
      if (F.s.visible) { fotoSkyArrivi();
        const d = camera.getWorldDirection(_fotoV), yaw = Math.atan2(d.x, d.z), dy = Math.abs(((yaw - F.yaw + 3 * Math.PI) % (2 * Math.PI)) - Math.PI);
        if (performance.now() - F.t > 500 || Math.abs(TOD - F.tod) > 0.05 || dy > 0.4) fotoSkyHorizon();
      }
    }
    scene.fog.color.lerp(FOTO_FOGGREY, 0.45 * L.day * (1 - (F ? F.a : 0))); if (F && F.a > 0) scene.fog.color.lerp(F.col, F.a * 0.85);
    { // what the panes mirror: the haze at the horizon, the sky overhead (darker than the haze where the new sky is off), the sun
      const U = FOTO_FAC; U.uSkyH.value.copy(scene.fog.color); U.uSkyZ.value.copy(scene.fog.color).multiplyScalar(0.7); if (F && F.a > 0) U.uSkyZ.value.lerp(F.zen, F.a);
      U.uSkyH.value.multiplyScalar(0.45 + 0.55 * L.day); U.uSkyZ.value.multiplyScalar(0.45 + 0.55 * L.day); // at night the haze is lit by the town, the panes far less
      U.uSunD.value.set(L.E, L.U, -L.Nn).normalize(); U.uSunC.value.copy(sun.color).multiplyScalar(sun.intensity * clamp(L.elDeg / 5, 0, 1) * (1 - WX.cloud * WX.cloud));
      WIN_SKY.value.setRGB(0, 0, 0);
    }
    for (const T of VIVI) if (T.sill) T.sill.visible = T.dist < 180; // the sills only round the player: thousands of them in a town
    _far.material.color.convertSRGBToLinear(); _near.material.color.convertSRGBToLinear(); // the mountains' shade is set as a plain number
  };
}
if (FOTO_SKY) { // the old glow round the sun gives way to the sky's own
  const ug = updGlow;
  updGlow = function () { ug(); SUNGLOW.material.opacity *= 1 - 0.7 * FOTO_SKY.a; SUNGLOW.material.visible = SUNGLOW.material.opacity > 0.01; };
}
// facades: the plaster gets the grain of a real render (tex/intonaco.jpg: Poly Haven "White Stucco 02", CC0, 1.8 m a side, grey round
// 128 so the house keeps its colour; only where the drawing is plaster, not on panes and shutters), and the panes mirror the sky:
// the colour at the horizon and overhead (read from the sky, see fotoSkyHorizon) by the reflected direction, more at a grazing
// angle (Fresnel), each pane set a little askew, and the sun's glint. This takes the place of the flat sky colour of extras.js
const FOTO_FAC = {
  uPlaster: { value: new THREE.TextureLoader().load('tex/intonaco.jpg', t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); }) },
  uSkyH: { value: new THREE.Color() }, uSkyZ: { value: new THREE.Color() }, uSunD: { value: new THREE.Vector3(0, 1, 0) }, uSunC: { value: new THREE.Color(0) },
};
const FOTO_FACADE = (s, tile) => {
  Object.assign(s.uniforms, FOTO_FAC, { uTileU: { value: tile } });
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vWNrm = normalize( mat3( modelMatrix ) * objectNormal );');
  s.fragmentShader = 'uniform sampler2D uPlaster;\nuniform float uTileU;\nuniform vec3 uSkyH;\nuniform vec3 uSkyZ;\nuniform vec3 uSunD;\nuniform vec3 uSunC;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;\n' + s.fragmentShader
    .replace('#include <map_fragment>', `#include <map_fragment>
  diffuseColor.rgb *= 1.0 + ( texture2D( uPlaster, vUv * vec2( uTileU, 3.1 ) / 1.8 ).r - 0.5 ) * 1.1 * smoothstep( 0.5, 0.8, dot( texelColor.rgb, vec3( 0.3333 ) ) );`)
    .replace('vec3 outgoingLight =', `#ifdef USE_EMISSIVEMAP
  float paneM = texture2D( emissiveMap, vUv ).r;
  if ( paneM > 0.01 ) {
    float paneH = fract( sin( dot( floor( vUv ) + 0.37, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    vec3 Vd = normalize( vWPos - cameraPosition ), Np = normalize( vWNrm + vec3( 0.0, ( paneH - 0.5 ) * 0.14, ( fract( paneH * 7.1 ) - 0.5 ) * 0.1 ) ), Rd = reflect( Vd, Np );
    float fres = 0.04 + 0.96 * pow( 1.0 - clamp( dot( -Vd, Np ), 0.0, 1.0 ), 5.0 );
    vec3 seen = Rd.y > 0.0 ? mix( uSkyH, uSkyZ, smoothstep( 0.0, 0.5, Rd.y ) ) : uSkyH * 0.3;
    totalEmissiveRadiance += paneM * ( seen * ( 0.3 + 0.7 * fres ) + uSunC * pow( max( dot( Rd, uSunD ), 0.0 ), 600.0 ) * 8.0 );
  }
#endif
  vec3 outgoingLight =`);
};
// ambient occlusion on the walls (AO_WALL in world3.js) and the facades, after the patch that lights the windows; then only whole windows (FAC_WALL)
for (const [k, m, tile] of [['old', MAT.old, 3.4], ['mod', MAT.mod, 4.2], ['plain', MAT.plain, 4]]) {
  const before = m.onBeforeCompile; m.onBeforeCompile = s => { before.call(m, s); AO_WALL(s); FOTO_FACADE(s, tile); if (k !== 'plain') FAC_WALL(s); }; m.customProgramCacheKey = () => 'foto-' + k; m.needsUpdate = true;
}

/* asphalt details (shader only, no extra mesh): stochastic tiling of the photo (4 samples with random offset and rotation per cell, blended, contrast kept), a slow
   tone variation over 20-40 m, rare sealed cracks (edges of a Voronoi net, 12 m cells, only some edges kept, warped to wander, 2-4 cm wide), rare patches
   (rectangles of 1-4 m, a little turned, darker and blacker, sharp edge). All in world coordinates. The wheel tracks are not done: the asphalt UVs do not know the road direction */
const ASF_GLSL = `
uniform float uAsf;
vec2 h22(vec2 p) { vec3 q = fract(vec3(p.xyx) * vec3(.1031, .1030, .0973)); q += dot(q, q.yzx + 33.33); return fract((q.xx + q.yz) * q.zy); }
`;
const ASF_FRAG = `
  vec4 texelColor;
  { vec2 uv = vUv; vec2 dx = dFdx(uv), dy = dFdy(uv);
    vec2 ci = floor(uv), cf = fract(uv); vec2 w2 = cf * cf * (3. - 2. * cf);
    vec3 acc = vec3(0.); float ws = 0., wq = 0.; vec3 mean = vec3(.5);
#if __VERSION__ >= 300
    mean = textureLod(map, uv, 9.).rgb;
#endif
    for (int k = 0; k < 4; k++) {
      vec2 o = vec2(float(k - k / 2 * 2), float(k / 2)), c = ci + o;
      float w = (o.x > .5 ? w2.x : 1. - w2.x) * (o.y > .5 ? w2.y : 1. - w2.y);
      vec2 r = h22(c + 7.3); float a = r.x * 6.2832, ca = cos(a), sa = sin(a);
      mat2 R = mat2(ca, sa, -sa, ca);
      vec2 u2 = R * (uv - c) + r.yx * 13.7;
#if __VERSION__ >= 300
      vec3 t = textureGrad(map, u2, R * dx, R * dy).rgb;
#else
      vec3 t = texture2D(map, u2).rgb;
#endif
      acc += t * w; ws += w; wq += w * w;
    }
    vec3 tc = mean + (acc - mean) / sqrt(wq); /* variance of the photo kept in the blended zones */
    texelColor = vec4(tc, 1.);
  }
  texelColor = mapTexelToLinear(texelColor);
  if (uAsf > .5) {
    vec2 P = vWp.xz; float px = max(length(dFdx(P)), length(dFdy(P))) + 1e-4;
    float far = 1. - smoothstep(.12, .4, px); /* cracks fade out when a pixel is wider than 12-40 cm */
    texelColor.rgb *= 1. + .13 * (slowN(P + 91., 1.4) - .5) * 2.;    /* slow tone, 20-40 m */
    /* sealed cracks */
    { vec2 Q = P + vec2(vn(P / 3.1 + 5.), vn(P / 3.1 + 17.)) * 1.8 + vec2(vn(P / .45 + 3.), vn(P / .45 + 9.)) * .05;
      vec2 ig = floor(Q / 12.), fg = Q / 12. - ig; float d1 = 9., d2 = 9.; vec2 id1 = vec2(0.), id2 = vec2(0.);
      for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j)), cell = ig + g, pt = g + .15 + .7 * h22(cell + 3.1); float d = length(pt - fg);
        if (d < d1) { d2 = d1; id2 = id1; d1 = d; id1 = cell; } else if (d < d2) { d2 = d; id2 = cell; } }
      float keep = step(.7, h21(id1 + id2 + 11.)); /* a few edges only */
      float wd = (.02 + .02 * vn(P / 2.7 + 40.)) * .5; /* half width in metres, 2-4 cm */
      float dm = (d2 - d1) * .5 * 12.; /* about the metres to the edge */
      float cr = (1. - smoothstep(wd - px, wd + px, dm)) * min(1., wd * 2. / px) * keep * far;
      texelColor.rgb = mix(texelColor.rgb, texelColor.rgb * .22, cr * .9); }
    /* patches */
    { vec2 gc = floor(P / 16.), lp = P - gc * 16.; vec2 r1 = h22(gc + 21.), r2 = h22(gc + 33.), r3 = h22(gc + 45.);
      if (r3.x < .22) {
        vec2 cen = 4. + 8. * r1, hs = (.5 + 1.5 * r2) * vec2(1., .5 + r3.y); float a = (r2.x - .5) * .8 + 1.5708 * floor(r1.x * 2.), ca = cos(a), sa = sin(a);
        vec2 d = lp - cen; vec2 e = abs(vec2(ca * d.x + sa * d.y, -sa * d.x + ca * d.y)) - hs;
        float m = (1. - smoothstep(-px, px + .01, max(e.x, e.y))) * far;
        float g = dot(texelColor.rgb, vec3(.3, .59, .11));
        texelColor.rgb = mix(texelColor.rgb, vec3(g) * .5 * (.85 + .3 * r3.y), m * .9); } }
  }
  diffuseColor *= texelColor;`;
const ASF_PATCH = s => {
  VAR_VERT(s); s.uniforms.uAsf = ASF_U;
  s.fragmentShader = ASF_GLSL + VAR_GLSL + s.fragmentShader.replace('#include <map_fragment>', ASF_FRAG);
};
for (const k of ['asph', 'asphS', 'paved', 'pavedS', 'deck']) { MAT[k].onBeforeCompile = ASF_PATCH; MAT[k].customProgramCacheKey = () => 'asfalto-var'; MAT[k].needsUpdate = true; }
