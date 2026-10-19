// ---------------------------------------------------------------- weather: sereno, nuvoloso, pioggia, temporale, nebbia
// WX (in extras.js) holds the current mix; the targets change every few minutes. Wet asphalt grips less and turns dark,
// clouds cover the sky and the stars, rain falls round the camera, thunder rolls, the Brianza fog swallows the town
const WX_STATES = {
  sereno: { cloud: 0.12, rain: 0, fog: 0, icon: '☀️', msg: 'Si apre il cielo' },
  nuvoloso: { cloud: 0.72, rain: 0, fog: 0, icon: '⛅', msg: 'Si annuvola' },
  pioggia: { cloud: 0.95, rain: 0.6, fog: 0, icon: '🌧', msg: 'Comincia a piovere: strada bagnata, frena prima' },
  temporale: { cloud: 1, rain: 1, fog: 0, icon: '⛈', msg: 'Temporale sulla Brianza!' },
  nebbia: { cloud: 0.5, rain: 0, fog: 1, icon: '🌫', msg: 'Nebbia in Brianza: non si vede a un palmo dal naso' },
};
const WX_NEXT = { // where the weather goes next, by weight
  sereno: { sereno: 3, nuvoloso: 5, nebbia: 1.5 }, nuvoloso: { sereno: 4, nuvoloso: 1, pioggia: 4, temporale: 1 },
  pioggia: { nuvoloso: 5, pioggia: 3, temporale: 2 }, temporale: { pioggia: 6, nuvoloso: 4 }, nebbia: { sereno: 5, nuvoloso: 5 },
};
Object.assign(WX, { state: 'sereno', icon: WX_STATES.sereno.icon, t: 300, drift: 0, thunderT: 15, sky: -1 });
function setWeather(st, now_) {
  WX.state = st; WX.t = 240 + rnd() * 360; const S = WX_STATES[st]; WX.icon = S.icon;
  if (now_) { WX.cloud = S.cloud; WX.rain = S.rain; WX.fog = S.fog; WX.wet = S.rain ? 1 : 0; skyT = -1; }
  if (running) toast(S.icon + ' ' + S.msg);
}
function updWeather(dt) {
  if ((WX.t -= dt) <= 0) {
    const opts = Object.entries(WX_NEXT[WX.state]).map(([k, w]) => [k, k === 'nebbia' && TOD > 11 && TOD < 19 ? 0 : w]); // fog comes at night and in the morning
    let r = rnd() * opts.reduce((a, o) => a + o[1], 0), nx = opts[0][0]; for (const [k, w] of opts) { if ((r -= w) <= 0) { nx = k; break; } }
    if (nx === WX.state) WX.t = 180 + rnd() * 240; else setWeather(nx);
  }
  const S = WX_STATES[WX.state], ap = (v, to, k) => v + (to - v) * (1 - Math.exp(-k * dt));
  WX.cloud = ap(WX.cloud, S.cloud, 1 / 40);
  WX.rain = ap(WX.rain, WX.cloud > 0.8 ? S.rain : 0, 1 / 25); // no rain before the sky is grey
  WX.fog = ap(WX.fog, S.fog, 1 / 45);
  WX.wet = WX.rain > 0.05 ? Math.min(1, WX.wet + dt / 50) : Math.max(0, WX.wet - dt / 200); // soaked in under a minute, dry in a few
  WX.flash = Math.max(0, WX.flash - dt * 4);
  if (WX.rain > 0.85 && (WX.thunderT -= dt) <= 0) { WX.thunderT = 12 + rnd() * 35; WX.flash = 1; const d = 0.8 + rnd() * 4; setTimeout(() => thunder(d), d * 1000); }
  // light: a grey sky softens the sun and the shadows
  const L = lightTones(), cov = WX.cloud * WX.cloud, grey = hexC(0x9aa0a8);
  sun.intensity *= 1 - 0.8 * cov - 0.15 * WX.fog; sun.color.lerp(grey, cov * 0.6);
  hemi.intensity *= 1 + 0.12 * cov - 0.25 * WX.rain * L.day; hemi.color.lerp(hexC(L.day > 0.5 ? 0xc9ced6 : 0x3a4150), cov * 0.7);
  hemi.intensity += WX.flash * 2.2; sun.intensity += WX.flash * 0.8;
  // fog: grey haze, rain curtain, then the real nebbia
  const fogC = mixHex(0x262a33, 0xc3c7cb, L.day);
  scene.fog.color.lerp(fogC, Math.max(cov * 0.6, WX.fog, WX.rain * 0.7));
  scene.fog.far = lerp(lerp(scene.fog.far, 330, WX.rain), 95, WX.fog); scene.fog.near = lerp(lerp(160, 40, WX.rain), 2, WX.fog);
  const hide = Math.max(WX.fog, WX.rain * 0.8, cov * 0.35); for (const m of [_far, _near]) { m.material.opacity = 1 - hide; m.visible = hide < 0.98; }
  // wet streets: darker asphalt, brighter light pools
  LAMPPOOL_MAT.opacity *= 1 + 0.8 * WX.wet; HEADPOOL_MAT.opacity *= 1 + 0.8 * WX.wet;
  WX.wetT = (WX.wetT || 0) - dt;
  if (Math.abs(WX.wet - (WX.wetShown ?? -1)) > 0.02 || (WX.wet > 0 && WX.wetT <= 0)) { WX.wetShown = WX.wet; WX.wetT = 3; wetPaint(WX.wet); } // again now and then for tiles built since
}
// every material painted with asphalt, porfido or sidewalk tiles darkens in the wet
const WET_MAPS = new Set([asphaltTex, porfidoTex, sidewalkTex]);
function wetPaint(w) {
  const k = 1 - 0.4 * w;
  scene.traverse(o => { const m = o.material; if (m && !Array.isArray(m) && (WET_MAPS.has(m.map) || m === MAT.kerb)) m.color.setScalar(k); });
}
for (const m of [_far, _near]) m.material.transparent = true; // the Prealpi fade out behind rain and fog

// clouds: big soft sprites on the dome round the camera, more of them as the sky fills up, drifting with the wind
const CLOUD_TEX = canvasTex(256, 128, (g, w, h) => { // an opaque grey mask (alphaMap): see glowTex for why not canvas alpha
  g.fillStyle = '#000'; g.fillRect(0, 0, w, h); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const x = 40 + srnd() * 176, y = 52 + srnd() * 40 - Math.abs(x - 128) * 0.12, r = 18 + srnd() * 30, gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgb(150,150,150)'); gr.addColorStop(0.6, 'rgb(70,70,70)'); gr.addColorStop(1, '#000'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
}, false);
const CLOUDS = []; for (let i = 0; i < 34; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ alphaMap: CLOUD_TEX, transparent: true, opacity: 0, depthWrite: false, fog: false })), k = 0.7 + srnd() * 0.8;
  s.scale.set(2200 * k, 900 * k, 1); s.renderOrder = -2; s.frustumCulled = false; scene.add(s);
  CLOUDS.push({ s, a: srnd() * Math.PI * 2, e: (0.1 + srnd() * 0.35), o: 0.6 + srnd() * 0.4 });
}
// rain: streaks in a box that travels with the camera
const RAIN_N = matchMedia('(pointer: coarse)').matches ? 1300 : 2200, RAIN_BOX = [70, 34, 70], RAIN_P = new Float32Array(RAIN_N * 3);
for (let i = 0; i < RAIN_N; i++) { RAIN_P[i * 3] = (srnd() - 0.5) * RAIN_BOX[0]; RAIN_P[i * 3 + 1] = srnd() * RAIN_BOX[1]; RAIN_P[i * 3 + 2] = (srnd() - 0.5) * RAIN_BOX[2]; }
const RAIN = (() => {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(RAIN_N * 6), 3)); g.setDrawRange(0, 0);
  const l = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc4ccd6, transparent: true, opacity: 0, depthWrite: false })); l.frustumCulled = false; l.renderOrder = 13; scene.add(l); return l;
})();
function updSkyFx(dt) {
  const L = lightTones(), cp = camera.position;
  WX.drift += dt * 0.004;
  const cov = 0.22 + 0.78 * WX.cloud, col = mixHex(0x2a3045, 0xffffff, L.day).lerp(hexC(0xffb48a), L.dusk * 0.6).lerp(hexC(L.day > 0.5 ? 0x9aa0a8 : 0x1c2028), WX.cloud * WX.cloud * 0.8);
  CLOUDS.forEach((c, i) => {
    const show = i / CLOUDS.length < cov, a = c.a + WX.drift, ce = Math.cos(c.e), R = SKY_R * 0.9;
    c.s.visible = show && WX.fog < 0.95 && c.o * (1 - WX.fog) > 0.02; if (!c.s.visible) return;
    c.s.position.set(cp.x + Math.sin(a) * ce * R, cp.y + Math.sin(c.e) * R, cp.z + Math.cos(a) * ce * R);
    c.s.material.opacity = c.o * (0.55 + 0.45 * WX.cloud) * (1 - WX.fog); c.s.material.color.copy(col).multiplyScalar(1 + WX.flash);
  });
  // rain streaks, slanted by the wind and stretched by the car's own speed
  const n = Math.round(RAIN_N * Math.min(1, WX.rain * 1.4)); RAIN.geometry.setDrawRange(0, n * 2); RAIN.material.opacity = 0.32 + 0.2 * WX.rain;
  RAIN.visible = n > 0; if (!n) return;
  // drops live in world space, wrapped into the box round the camera; a streak points back along the drop's speed relative to the car
  const v = P.mode === 'car' ? P.car : null, wx = (v ? v.vx : 0) - 2.2, wz = (v ? v.vz : 0) - 1.0, fall = 16 * dt, a = RAIN.geometry.attributes.position, A = a.array;
  const wrap = (q, B) => ((q % B) + B) % B - B / 2;
  for (let i = 0; i < n; i++) {
    let y = RAIN_P[i * 3 + 1] - fall; if (y < 0) y += RAIN_BOX[1]; RAIN_P[i * 3 + 1] = y;
    RAIN_P[i * 3] += 2.2 * dt; RAIN_P[i * 3 + 2] += 1.0 * dt; // wind
    const x = cp.x + wrap(RAIN_P[i * 3] - cp.x, RAIN_BOX[0]), z = cp.z + wrap(RAIN_P[i * 3 + 2] - cp.z, RAIN_BOX[2]), yy = cp.y - 12 + y;
    A[i * 6] = x; A[i * 6 + 1] = yy; A[i * 6 + 2] = z; A[i * 6 + 3] = x + wx * 0.05; A[i * 6 + 4] = yy + 0.85; A[i * 6 + 5] = z + wz * 0.05;
  }
  a.needsUpdate = true;
  updRainSound();
}
// rain on the street and drumming on the roof; thunder far away
const RS = { on: false };
function updRainSound() {
  if (!AU || !AU.on) return; const C = AU.ctx;
  if (!RS.on) {
    const sr = C.sampleRate, b = C.createBuffer(1, sr * 2, sr), d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (Math.random() < 0.002 ? 3 : 1);
    const mk = (type, f, q) => { const s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain(); s.buffer = b; s.loop = true; fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(AU.master); s.start(0, Math.random() * 2); return g; };
    RS.hiss = mk('highpass', 2600, 0.5); RS.patter = mk('bandpass', 900, 0.8); RS.roof = mk('lowpass', 520, 0.7); RS.on = true; RS.buf = b;
  }
  const t = C.currentTime, r = WX.rain, car = P.mode === 'car' && !isTwo(P.car);
  RS.hiss.gain.setTargetAtTime(r * (car ? 0.05 : 0.16), t, 0.3); RS.patter.gain.setTargetAtTime(r * (car ? 0.05 : 0.12), t, 0.3); RS.roof.gain.setTargetAtTime(car ? r * 0.5 : 0, t, 0.3);
}
function thunder(dist) {
  if (!AU || !AU.on || !RS.on) return; const C = AU.ctx, t = C.currentTime, s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain();
  s.buffer = RS.buf; s.playbackRate.value = 0.12; fl.type = 'lowpass'; fl.frequency.value = 260 / (0.6 + dist * 0.25); const v = 1.1 / (0.6 + dist * 0.3);
  g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + 0.08 + dist * 0.05); g.gain.setTargetAtTime(v * 0.5, t + 0.4, 0.5); g.gain.setTargetAtTime(0.0001, t + 1.6, 1.2);
  s.connect(fl); fl.connect(g); g.connect(AU.master); s.start(t, 0, 7); s.stop(t + 7);
}
window.__setWeather = setWeather;
window.__FX = { headSpot, CLOUDS, RAIN, STARS, CARGLOW, LAMPGLOW_MAT, LAMPPOOL_MAT, HEADPOOL_MAT, updDayNight, updWeather, updSkyFx, updGlow, wetPaint, setTOD: h => { TOD = h; skyT = -1; } }; // for the test scripts
