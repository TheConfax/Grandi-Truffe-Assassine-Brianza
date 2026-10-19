// ---------------------------------------------------------------- day & night
let TOD = 17.2; // ore del giorno, 1 ora di gioco = 1 minuto reale
const WX = { cloud: 0.12, rain: 0, fog: 0, wet: 0, flash: 0 }; // weather mix, driven by weather3.js
const HEADPOOL_MAT = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,236,190,0.9)', 'rgba(255,236,190,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const LAMPPOOL_MAT = new THREE.MeshBasicMaterial({ map: radialTex('rgba(255,214,150,0.85)', 'rgba(255,214,150,0)'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 });
const WIN_EMI = (kind) => canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffd890'; if (kind === 'old') g.fillRect(48, 32, 32, 54); else if (kind === 'modern') { g.fillRect(16, 28, 44, 52); g.fillStyle = '#c99a50'; g.fillRect(68, 28, 44, 52); } });
const WIN_LIT = { value: 0 }; // share of windows lit, each window decides by its own hash
const WIN_SKY = { value: new THREE.Color(0) }; // sky mirrored by the panes, each window at its own angle
for (const [k, kind] of [['old', 'old'], ['mod', 'modern']]) {
  MAT[k].emissiveMap = WIN_EMI(kind); MAT[k].emissive = new THREE.Color(0xffc870); MAT[k].emissiveIntensity = 0;
  MAT[k].onBeforeCompile = sh => {
    sh.uniforms.uLit = WIN_LIT; sh.uniforms.uSky = WIN_SKY;
    sh.fragmentShader = 'uniform float uLit;\nuniform vec3 uSky;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  float wh = fract(sin(dot(floor(vUv) + 0.37, vec2(12.9898, 78.233))) * 43758.5453);\n  totalEmissiveRadiance *= step(wh, uLit) * (0.7 + 0.6 * fract(wh * 7.13));\n  totalEmissiveRadiance += uSky * emissiveColor.r * (0.45 + 0.8 * fract(wh * 3.71)) * (0.75 + 0.25 * vUv.y - 0.25 * floor(vUv.y));');
  };
  MAT[k].needsUpdate = true;
}
// share of lit windows through a Brianza evening: people come home, dinner, then lights go off one by one
const LIT_KEYS = [[0, 0.3], [1, 0.16], [3, 0.06], [5.5, 0.05], [6.5, 0.18], [7.5, 0.22], [8.5, 0.04], [17, 0.04], [18.5, 0.25], [20, 0.55], [21.5, 0.6], [23, 0.45], [24, 0.3]];
const litAt = h => { for (let i = 1; i < LIT_KEYS.length; i++) if (h <= LIT_KEYS[i][0]) { const [a, va] = LIT_KEYS[i - 1], [b, vb] = LIT_KEYS[i]; return va + (vb - va) * (h - a) / (b - a); } return 0.3; };
MAT.lampHead.emissive = new THREE.Color(0xffd890);
const headSpot = new THREE.SpotLight(0xfff0d0, 0, 70, 0.55, 0.6, 1.2); headSpot.castShadow = false; scene.add(headSpot, headSpot.target);
// glare: halos round street lamps and car lights (brake and reverse lights too), stars, moon and the sun's glow
const haloTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); [[0, 1], [0.1, 0.9], [0.3, 0.3], [0.6, 0.08], [1, 0]].forEach(([t, a]) => gr.addColorStop(t, `rgba(255,255,255,${a})`)); g.fillStyle = gr; g.fillRect(0, 0, w, h); }, false);
const glowMat = (size, col, extra) => new THREE.PointsMaterial(Object.assign({ map: haloTex, size, color: col, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }, extra));
const LAMPGLOW_MAT = glowMat(5, 0xffd49a);
const CARGLOW = [2.4, 1.5].map(size => { // [heads, tails]: one Points each, refilled every frame from the cars on screen
  const g = new THREE.BufferGeometry(), n = 800; g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3)); g.setDrawRange(0, 0);
  const p = new THREE.Points(g, glowMat(size, 0xffffff, { vertexColors: true, opacity: 1 })); p.frustumCulled = false; p.renderOrder = 14; scene.add(p); p.n = n; return p;
});
const SKY_R = 6200, STARS = (() => {
  const p = [], c = []; for (let i = 0; i < 1100; i++) { const u = 0.04 + srnd() * 0.96, a = srnd() * Math.PI * 2, r = Math.sqrt(1 - u * u), k = 0.35 + srnd() ** 3 * 0.65; p.push(Math.cos(a) * r * SKY_R, u * SKY_R, Math.sin(a) * r * SKY_R); c.push(k, k, k * (0.9 + srnd() * 0.2)); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3));
  const s = new THREE.Points(g, new THREE.PointsMaterial({ size: 2, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0, depthWrite: false, fog: false })); s.frustumCulled = false; s.renderOrder = -3; scene.add(s); return s;
})();
const skySprite = (tex, size, extra) => { const s = new THREE.Sprite(new THREE.SpriteMaterial(Object.assign({ map: tex, transparent: true, opacity: 0, depthWrite: false, fog: false }, extra))); s.scale.setScalar(size); s.renderOrder = -2; s.frustumCulled = false; scene.add(s); return s; };
const MOON = skySprite(canvasTex(64, 64, (g) => { g.fillStyle = '#eef0f4'; g.beginPath(); g.arc(32, 32, 30, 0, 7); g.fill(); g.fillStyle = 'rgba(150,158,175,0.45)'; for (const [x, y, r] of [[22, 24, 7], [38, 20, 5], [40, 38, 9], [24, 42, 4], [30, 30, 3]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); } }, false), 150);
const MOONHALO = skySprite(haloTex, 900, { blending: THREE.AdditiveBlending, color: 0x8ea4d8 });
const SUNGLOW = skySprite(haloTex, 1800, { blending: THREE.AdditiveBlending });
const LIGHTS = { on: 0 }, _gv = new THREE.Vector3();
function skyAt(s, x, y, z) { s.position.set(camera.position.x + x * SKY_R * 0.97, camera.position.y + y * SKY_R * 0.97, camera.position.z + z * SKY_R * 0.97); }
function updGlow() {
  const L = lightTones(), on = LIGHTS.on;
  STARS.position.copy(camera.position); const clear = (1 - WX.cloud * 0.95) * (1 - WX.fog); STARS.material.opacity = clamp((-L.elDeg - 3) / 9, 0, 1) * clear;
  skyAt(MOON, -L.E, -L.U, L.Nn); skyAt(MOONHALO, -L.E, -L.U, L.Nn); // full moon: right across the sky from the sun
  MOON.material.opacity = clamp(-L.U * 12 + 0.2, 0, 1) * clamp(0.25 + L.night, 0, 1); MOON.material.opacity *= clear; MOONHALO.material.opacity = MOON.material.opacity * 0.35 * L.night;
  skyAt(SUNGLOW, L.E, L.U, -L.Nn); SUNGLOW.material.opacity = clamp(L.U * 10 + 0.3, 0, 1) * (0.32 + 0.4 * L.dusk) * clear; SUNGLOW.material.color.setRGB(1, 0.86 - 0.28 * L.dusk, 0.62 - 0.4 * L.dusk);
  LAMPGLOW_MAT.opacity = 0.85 * on;
  const [H, T] = CARGLOW, hp = H.geometry.attributes.position, hc = H.geometry.attributes.color, tp = T.geometry.attributes.position, tc = T.geometry.attributes.color; let nh = 0, nt = 0;
  for (const v of VEH) {
    const ud = v.m.body.userData; if (!ud.tl) continue;
    const live = !!v.driver && v.health > 0 && !v.exploded && !v.fallen, fs = v.fwdSpeed, brk = live && v.inp.brk > 0, rev = brk && fs < -0.5, stop = brk && !rev;
    ud.tail.emissiveIntensity = M_TAIL.emissiveIntensity + (stop ? 2.2 : 0);
    if (!v.m.g.visible) continue;
    const kh = live ? on : 0, kt = live ? 0.45 * on + (stop ? 0.85 : 0) : 0; if (kh < 0.02 && kt < 0.02 && !rev) continue;
    v.m.g.updateMatrixWorld(true); const mw = v.m.body.matrixWorld;
    const cx = camera.position.x - v.x, cz = camera.position.z - v.z, cl = hyp(cx, cz) || 1, face = (Math.sin(v.h) * cx + Math.cos(v.h) * cz) / cl; // lamps shine forward/backward: glare only towards the camera
    const fh = clamp(face * 1.6 + 0.1, 0, 1), ft = clamp(-face * 1.6 + 0.35, 0, 1);
    if (kh * fh >= 0.02) for (const q of ud.hl) { if (nh >= H.n) break; _gv.set(q[0], q[1], q[2]).applyMatrix4(mw); hp.setXYZ(nh, _gv.x, _gv.y, _gv.z); hc.setXYZ(nh++, kh * fh, kh * fh * 0.93, kh * fh * 0.78); }
    for (const q of ud.tl) { if (nt >= T.n) break; _gv.set(q[0], q[1], q[2]).applyMatrix4(mw); tp.setXYZ(nt, _gv.x, _gv.y, _gv.z); if (rev) tc.setXYZ(nt++, 0.75 * ft, 0.75 * ft, 0.72 * ft); else tc.setXYZ(nt++, kt * ft, kt * ft * 0.1, kt * ft * 0.06); }
  }
  H.geometry.setDrawRange(0, nh); T.geometry.setDrawRange(0, nt); hp.needsUpdate = hc.needsUpdate = tp.needsUpdate = tc.needsUpdate = true;
}
const SKY_C = {
  day: ['#5e8fd0', '#a9c3e0', '#f1dcb6', '#f6d7a8'], dusk: ['#2c3e74', '#b0708a', '#f39a5a', '#ffb070'], night: ['#0a1022', '#16234a', '#2a3a66', '#3a4570'],
};
const SKY_OVC = { day: ['#7f8893', '#9aa2ac', '#b2b8be', '#bcc0c4'], night: ['#11141b', '#181c24', '#20242c', '#262a32'] }; // overcast
function skyWeather(c, i, L) { // grey under cloud, white-grey in the fog
  c.lerp(mixHex(SKY_OVC.night[i], SKY_OVC.day[i], L.day), clamp((WX.cloud - 0.3) / 0.6, 0, 1) * 0.92);
  return c.lerp(mixHex(0x262a33, 0xc3c7cb, L.day), WX.fog * (0.55 + 0.15 * i));
}
const skyCanvas = scene.background.image, skyCtx = skyCanvas.getContext('2d');
const mixHex = (a, b, t) => { const A = new THREE.Color(a), B = new THREE.Color(b); return A.lerp(B, t); };
let skyT = -1, nightK = 0;
const LATR = 45.66 * Math.PI / 180, SOLAR_NOON = 12.52;
function lightTones() {
  const H = (TOD - SOLAR_NOON) * 15 * Math.PI / 180, E = -Math.sin(H), Nn = -Math.sin(LATR) * Math.cos(H), U = Math.cos(LATR) * Math.cos(H);
  const elDeg = Math.asin(U) * 180 / Math.PI, day = clamp((elDeg + 4) / 12, 0, 1), dusk = Math.exp(-(((elDeg - 1) / 6) ** 2));
  return { E, Nn, U, elDeg, elev: U, day, night: 1 - day, dusk };
}
function updDayNight(dt) {
  TOD = (TOD + dt / 60) % 24;
  const L = lightTones(); nightK = L.night;
  // sun runs east -> south -> west, moon light when it is down
  if (L.U > 0) SUN_DIR.set(L.E, Math.max(0.12, L.U), -L.Nn).normalize(); else SUN_DIR.set(0.3, 0.8, 0.45).normalize(); // night: soft moonlight from high up
  sun.intensity = 0.3 + 0.8 * L.day;
  sun.color.copy(mixHex(0x8fa6d8, 0xffdcae, L.day)).lerp(new THREE.Color(0xff9356), L.dusk * 0.6);
  hemi.intensity = 0.5 + 0.12 * L.day; hemi.color.copy(mixHex(0x5a6fa8, 0xdbe8ff, L.day)); hemi.groundColor.copy(mixHex(0x2a2a36, 0x8a7f6a, L.day));
  const fog = mixHex(0x1f2a44, 0xebd9ba, L.day).lerp(new THREE.Color(0xe39a72), L.dusk * 0.55); scene.fog.color.copy(fog); scene.fog.far = 560 + 160 * L.day;
  _far.material.color.setScalar(0.18 + 0.82 * L.day); _near.material.color.setScalar(0.15 + 0.85 * L.day);
  const skyW = WX.cloud + WX.fog * 2;
  if (Math.abs(TOD - skyT) > 0.04 || skyT < 0 || Math.abs(skyW - (updDayNight.w ?? -1)) > 0.015) { // redraw the 4x256 sky gradient now and then
    skyT = TOD; updDayNight.w = skyW; const g = skyCtx, h = skyCanvas.height, gr = g.createLinearGradient(0, 0, 0, h), stops = [0, 0.55, 0.8, 1];
    stops.forEach((s, i) => { const c = mixHex(SKY_C.night[i], SKY_C.day[i], L.day).lerp(new THREE.Color(SKY_C.dusk[i]), L.dusk * 0.75); gr.addColorStop(s, '#' + skyWeather(c, i, L).getHexString()); });
    g.fillStyle = gr; g.fillRect(0, 0, skyCanvas.width, h); scene.background.needsUpdate = true;
  }
  // street lamps, windows, car lights
  const lampsOn = clamp((3 - L.elDeg) / 7 + 0.35 * Math.max(WX.rain, WX.fog) + 0.1 * WX.cloud, 0, 1); WIN_LIT.value = litAt(TOD); LIGHTS.on = lampsOn; // lights on early under a dark sky
  WIN_SKY.value.copy(mixHex(SKY_C.night[1], SKY_C.day[1], L.day)).lerp(new THREE.Color(SKY_C.dusk[2]), L.dusk * 0.5).multiplyScalar(0.12 + 0.3 * L.day);
  for (const m of SIGN_MATS) m.emissiveIntensity = 0.05 + 0.75 * lampsOn;
  for (const g of LM_GLOW) g.m.emissiveIntensity = g.a + g.b * lampsOn;
  MAT.lampHead.emissiveIntensity = 0.3 + 2.4 * lampsOn; LAMPPOOL_MAT.opacity = 0.75 * lampsOn;
  MAT.old.emissiveIntensity = MAT.mod.emissiveIntensity = 0.55 * lampsOn;
  M_HEAD.emissiveIntensity = 0.6 + 2.0 * lampsOn; M_TAIL.emissiveIntensity = 0.5 + 1.4 * lampsOn; HEADPOOL_MAT.opacity = 0.5 * lampsOn;
  const v = P.mode === 'car' ? P.car : null;
  headSpot.intensity = v && v.health > 0 ? 2.4 * lampsOn : 0;
  if (v) { const fx = Math.sin(v.h), fz = Math.cos(v.h); headSpot.position.set(v.x + fx * 2, v.y + 1.0, v.z + fz * 2); headSpot.target.position.set(v.x + fx * 22, v.y - 0.5, v.z + fz * 22); }
  const mm = Math.floor(TOD * 60); if (mm !== updDayNight.mm) { updDayNight.mm = mm; const el2 = $('clock'); if (el2) el2.textContent = String((mm / 60) | 0).padStart(2, '0') + ':' + String(mm % 60).padStart(2, '0') + ' ' + (WX.icon || ''); }
}
function skipTime(h) { TOD = (TOD + h) % 24; skyT = -1; updDayNight(0); toast('Ora: ' + String(TOD | 0).padStart(2, '0') + ':' + String(Math.floor((TOD % 1) * 60)).padStart(2, '0')); }

// ---------------------------------------------------------------- damage: dents, scorched paint, fire and explosion
const CHAR = new THREE.Color(0x1d1b19);
function dentCar(v, sev, nx, nz) {
  const m = v.m; if (!m.bm || sev <= 0) return;
  if (!m.own) { // own paint so that only this car gets scorched
    const pm = m.paint.clone(); m.body.traverse(o => { if (o.material === m.paint) o.material = pm; }); m.paint = pm; m.own = true; m.base = pm.color.clone();
  }
  // contact point in the car's frame: opposite to the push normal
  const c = Math.cos(v.h), s = Math.sin(v.h), lx = -nx * c + nz * s, lz = -nx * s - nz * c; // world -> local (x right, z forward)
  const geo = m.bm.geometry, pos = geo.attributes.position, org = m.org || (m.org = pos.array.slice()), S = v.spec;
  const cx = lx * S.W / 2 * 1.2, cz = lz * S.L / 2 * 1.2, R = 1.25;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i), d = hyp(x - cx, z - cz), w = Math.max(0, 1 - d / R); if (!w) continue;
    const ox = org[i * 3], oz = org[i * 3 + 2], k = sev * w * w;
    let nx2 = x - lx * k, nz2 = z - lz * k;
    if (Math.abs(nx2) < Math.abs(ox) * 0.55) nx2 = Math.sign(ox) * Math.abs(ox) * 0.55; if (Math.abs(nz2) < Math.abs(oz) * 0.6) nz2 = Math.sign(oz) * Math.abs(oz) * 0.6;
    pos.setXYZ(i, nx2, y - k * 0.25 * (y > 0 ? 1 : 0), nz2);
  }
  pos.needsUpdate = true; geo.computeVertexNormals();
}
function scorch(v) { const m = v.m; if (!m.own || !m.base) return; m.paint.color.copy(m.base).lerp(CHAR, v.exploded ? 0.9 : clamp((100 - v.health) / 100, 0, 1) * 0.55); }
function updWrecks(dt) {
  for (const v of VEH) {
    if (v.exploded) { v.roll = lerp(v.roll, v.flip * 0.45, 0.08); continue; }
    if (v.health > 0 || v.spec.pedal) continue; // a bicycle has nothing to burn
    v.burn = (v.burn || 0) + dt;
    if (rnd() < 0.7) { const hl = v.spec.L / 2 - 0.5; puff(v.x + Math.sin(v.h) * hl + (rnd() - 0.5), v.y + 1.0, v.z + Math.cos(v.h) * hl + (rnd() - 0.5), rnd() < 0.5 ? '#ff7a1e' : '#ffc23a', 0.8 + rnd() * 0.6, 0.45, 2.2); }
    if (v === P.car && !v.warned) { v.warned = true; toast('L\'auto va a fuoco! Scendi subito!'); }
    if (v.burn > 6) explodeCar(v);
  }
}
function boom(x, y, z, k = 1, src = null) {
  for (let i = 0; i < 26 * k; i++) puff(x + (rnd() - 0.5) * 3 * k, y + rnd() * 2, z + (rnd() - 0.5) * 3 * k, i % 3 ? '#ff9a2e' : '#ffd25a', (2.4 + rnd() * 2) * k, 0.9 + rnd() * 0.6, 3 + rnd() * 3);
  for (let i = 0; i < 14 * k; i++) puff(x + (rnd() - 0.5) * 4 * k, y + 0.5 + rnd() * 2, z + (rnd() - 0.5) * 4 * k, '#2a2624', (3 + rnd() * 2) * k, 3 + rnd() * 2, 2.5);
  try { sfxCrash(30); } catch (e) { } const dp = hyp(x - P.x, z - P.z), R = 9 * k; shake = Math.max(shake, clamp(1.2 - dp / 40, 0, 1));
  if (P.mode === 'foot' && dp < R * 0.9 && P.knock <= 0) { P.knock = 1.8; P.vx = (P.x - x) / (dp || 1) * 9; P.vz = (P.z - z) / (dp || 1) * 9; P.vy = 5; P.hp -= 45 * (1 - dp / R); }
  for (const o of VEH) { if (o === src) continue; const d = hyp(o.x - x, o.z - z); if (d < R) { o.vx += (o.x - x) / (d || 1) * (R - d) * 1.5; o.vz += (o.z - z) / (d || 1) * (R - d) * 1.5; o.sleep = false; o.health = Math.max(0, o.health - (R - d) * 6); scorch(o); } }
  for (const p of PEDS) { const d = hyp(p.x - x, p.z - z); if (d < R && p.state !== 'dead') { p.state = 'flee'; p.t = 5; } }
  if (W.stars || cops().some(c => hyp(c.x - x, c.z - z) < 80)) crime(1, 'Esplosione in pieno centro!');
}
function explodeCar(v) {
  v.exploded = true; scorch(v);
  v.vy = 7; v.flip = (rnd() < 0.5 ? -1 : 1) * (1.5 + rnd());
  if (P.car === v) { P.hp = 0; }
  boom(v.x, v.y + 0.5, v.z, 1, v);
}

updDayNight(0);
window.__setTOD = h => { TOD = h; skyT = -1; updDayNight(0); };

// ---------------------------------------------------------------- car radio: Discoradio live (official stream) only while driving; a police car is tuned to Radio Maria
// claude.ai artifacts allow no external audio (media-src/connect-src 'self'): there the radio stays off with a note
const STATIONS = {
  disco: { name: 'Discoradio', urls: ['https://icstream.rds.radio/disco'], hello: '📻 Discoradio · il ritmo della tua città' },
  maria: { name: 'Radio Maria', urls: ['https://dreamsiteradiocp2.com/proxy/rmitaly?mp=/stream', 'https://dreamsiteradiocp4.com/proxy/rmitaliamontecarlo?mp=/stream'], hello: '📻 Radio Maria · in volante si prega' }, // second url: same programme on another relay
};
const stationFor = v => v && v.kind === 'police' ? 'maria' : 'disco';
const RADIO = new Audio(); RADIO.preload = 'none';
const IN_CLAUDE = /claudeusercontent\.com|claude\.ai/.test(location.hostname);
let radioOn = true, radioVol = 0, radioErr = false, radioSt = 'disco', radioUrl = 0; const radioShown = {};
// static while the tuner looks for the station: band-passed hiss with crackles and a drifting whistle, until the stream plays (at least 0.9 s)
const STATIC = { g: null, t: 0, tuning: false };
function staticInit() {
  if (STATIC.g || !AU.on) return; const C = AU.ctx, len = C.sampleRate * 2, b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0);
  for (let i = 0, cr = 0; i < len; i++) { if (rnd() < 0.0005) cr = 1; cr *= 0.996; d[i] = (rnd() * 2 - 1) * (0.3 + cr * 1.7) * (rnd() < 0.0015 ? 3.5 : 1); }
  const s = C.createBufferSource(); s.buffer = b; s.loop = true;
  const f = C.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1700; f.Q.value = 0.6;
  const w = C.createOscillator(); w.type = 'sine'; w.frequency.value = 2200; const wg = C.createGain(); wg.gain.value = 0.06;
  const g = C.createGain(); g.gain.value = 0;
  s.connect(f); f.connect(g); w.connect(wg); wg.connect(g); g.connect(AU.master); s.start(); w.start();
  Object.assign(STATIC, { g, f, w });
}
function updStatic(dt, want) {
  staticInit(); if (!STATIC.g) return; const C = AU.ctx, t = C.currentTime;
  STATIC.t -= dt; if (STATIC.tuning && STATIC.t < -6) { STATIC.tuning = false; STATIC.quiet = true; } // a stream that never answers stops hissing (until the radio is switched again)
  const on = want && !radioErr && (STATIC.tuning || STATIC.t > 0);
  STATIC.g.gain.setTargetAtTime(on ? 0.6 : 0, t, on ? 0.03 : 0.12); // ~8 dB under a broadcast stream at radio volume 0.6: heard clearly before the music takes over
  if (on) { STATIC.w.frequency.setTargetAtTime(1500 + Math.sin(now * 2.3) * 700 + rnd() * 250, t, 0.08); STATIC.f.frequency.setTargetAtTime(1300 + rnd() * 900, t, 0.05); }
}
RADIO.addEventListener('playing', () => { STATIC.tuning = false; STATIC.quiet = false; });
RADIO.addEventListener('error', () => {
  if (!radioOn || !RADIO.getAttribute('src') || radioErr) return;
  const St = STATIONS[radioSt]; if (!IN_CLAUDE && radioUrl < St.urls.length - 1) { RADIO.src = St.urls[++radioUrl]; RADIO.play().catch(() => { }); return; } // try the next relay, still hissing
  STATIC.tuning = false; radioErr = true; toast(IN_CLAUDE ? '📻 Su claude.ai la radio è bloccata: gioca dalla versione su GitHub Pages' : `📻 ${St.name} non raggiungibile`); toastT = 6;
});
RADIO.addEventListener('playing', () => { radioErr = false; if (!radioShown[radioSt]) { radioShown[radioSt] = true; toast(STATIONS[radioSt].hello); } });
function stopRadio() { RADIO.pause(); RADIO.removeAttribute('src'); RADIO.load(); }
function updRadio(dt) {
  const want = radioOn && running && !paused && P.mode === 'car' && !(AU && AU.muted);
  if (P.mode === 'car' && stationFor(P.car) !== radioSt) { radioSt = stationFor(P.car); radioUrl = 0; radioErr = false; STATIC.quiet = false; if (!RADIO.paused) stopRadio(); } // another car, another station: retune
  if (want && RADIO.paused && !radioErr) { RADIO.src = STATIONS[radioSt].urls[radioUrl]; RADIO.volume = radioVol; RADIO.play().catch(() => { }); if (!STATIC.tuning && !STATIC.quiet) { STATIC.tuning = true; STATIC.t = 0.9; } } // fresh src = back to live, not to a stale buffer
  if (AU && AU.on) updStatic(dt, want);
  radioVol = lerp(radioVol, want ? 0.6 : 0, 1 - Math.exp(-3 * dt)); try { RADIO.volume = clamp(radioVol, 0, 1); } catch (e) { }
  if (!want && !RADIO.paused && radioVol < 0.02) stopRadio();
}
function toggleRadio() { radioOn = !radioOn; radioErr = false; radioUrl = 0; STATIC.quiet = false; toast(radioOn ? '📻 Radio accesa' : '📻 Radio spenta'); }
