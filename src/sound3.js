// ---------------------------------------------------------------- sounds: footsteps, screeching tyres, passing cars, Meda ambience
// all synthesised like the engine: wind, leaves, birds by day, crickets at night, the far hum of the Milano-Meda, church bells at 7, 12 and 19
const SFX = { on: false, stepK: 0, green: 0.3, greenT: 0, birdT: 3, crT: 1, hour: -1 };
function sfxInit() {
  if (SFX.on || !AU.on) return; const C = AU.ctx, sr = C.sampleRate;
  SFX.white = C.createBuffer(1, sr * 2, sr); { const d = SFX.white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  SFX.brown = C.createBuffer(1, sr * 4, sr); { // brown noise, tilted so the loop joins without a click
    const d = SFX.brown.getChannelData(0); let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; }
    const n = d.length - 1, j = d[n] - d[0]; for (let i = 0; i <= n; i++) d[i] -= j * i / n;
  }
  SFX.amb = C.createGain(); SFX.amb.gain.value = 0; SFX.amb.connect(AU.master); // ambience bus, muffled inside a car
  const loop = (buf, type, f, q, dest) => {
    const s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain(); s.buffer = buf; s.loop = true;
    fl.type = type; fl.frequency.value = f; fl.Q.value = q; g.gain.value = 0; s.connect(fl); fl.connect(g); g.connect(dest); s.start(0, Math.random() * buf.duration); return { f: fl, g };
  };
  SFX.wind = loop(SFX.brown, 'lowpass', 420, 0.5, SFX.amb);
  SFX.leaves = loop(SFX.white, 'bandpass', 4200, 0.7, SFX.amb);
  SFX.hum = loop(SFX.brown, 'lowpass', 170, 0.6, SFX.amb);
  // the loudest car nearby: tyre roar + engine, panned and doppler-shifted
  SFX.car = C.createGain(); SFX.car.gain.value = 0; SFX.carPan = C.createStereoPanner(); SFX.car.connect(SFX.carPan); SFX.carPan.connect(AU.master);
  SFX.carRoar = loop(SFX.white, 'bandpass', 700, 0.8, SFX.car); SFX.carRoar.g.gain.value = 0.7;
  SFX.carEng = C.createOscillator(); SFX.carEng.type = 'sawtooth'; const el = C.createBiquadFilter(); el.type = 'lowpass'; el.frequency.value = 380; const eg = C.createGain(); eg.gain.value = 0.5;
  SFX.carEng.connect(el); el.connect(eg); eg.connect(SFX.car); SFX.carEng.start();
  // tyre screech: a wobbling squeal over a hiss
  SFX.skid = C.createGain(); SFX.skid.gain.value = 0; SFX.skid.connect(AU.master);
  SFX.skidO = C.createOscillator(); SFX.skidO.type = 'triangle'; SFX.skidO.frequency.value = 1050; const sb = C.createBiquadFilter(); sb.type = 'bandpass'; sb.frequency.value = 1200; sb.Q.value = 3;
  SFX.skidO.connect(sb); sb.connect(SFX.skid); SFX.skidO.start();
  SFX.skidN = loop(SFX.white, 'bandpass', 2600, 2.5, SFX.skid); SFX.skidN.g.gain.value = 0.9;
  SFX.on = true;
}
// listener = the player, ears turned like the camera
function sfxPan(x, z) {
  const e = camera.matrixWorld.elements, dx = x - (P.mode === 'car' ? P.car.x : P.x), dz = z - (P.mode === 'car' ? P.car.z : P.z), d = hyp(dx, dz) || 1;
  return clamp((dx * e[0] + dz * e[2]) / (d * (hyp(e[0], e[2]) || 1)), -1, 1) * 0.8;
}
function sfxOut(pan, dest) { const C = AU.ctx, p = C.createStereoPanner(); p.pan.value = pan; p.connect(dest || SFX.amb); return p; }
function sfxTone(t0, dur, f0, f1, vol, out, type = 'sine') {
  const C = AU.ctx, o = C.createOscillator(), g = C.createGain(); o.type = type;
  o.frequency.setValueAtTime(f0, t0); o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + Math.min(0.012, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(out); o.start(t0); o.stop(t0 + dur + 0.02);
}
function sfxNoise(t0, dur, type, f, q, vol, rate, out) {
  const C = AU.ctx, s = C.createBufferSource(), fl = C.createBiquadFilter(), g = C.createGain();
  s.buffer = SFX.white; s.playbackRate.value = rate; fl.type = type; fl.frequency.value = f; fl.Q.value = q;
  g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(fl); fl.connect(g); g.connect(out); s.start(t0, Math.random() * 1.5, dur + 0.05);
}
function sfxStep(run) {
  const C = AU.ctx, t = C.currentTime, r = 0.9 + Math.random() * 0.2, hard = onAnyRoad(P.x, P.z, 3), k = run ? 1.4 : 1;
  if (hard) { sfxNoise(t, 0.06, 'bandpass', 1900 * r, 1.4, 0.11 * k, r, AU.master); sfxNoise(t + 0.012, 0.04, 'highpass', 3500, 0.7, 0.03 * k, r, AU.master); } // heel and scuff on asphalt
  else { sfxNoise(t, 0.13, 'lowpass', 1100 * r, 0.8, 0.12 * k, r, AU.master); sfxNoise(t + 0.02, 0.1, 'bandpass', 3200 * r, 1.5, 0.04 * k, r, AU.master); } // grass and dirt
  sfxTone(t, 0.07, 110 * r, 55, 0.12 * k, AU.master);
}
// birds of a Brianza garden: sparrows, great tits, blackbirds, collared doves, crows
function sfxBird() {
  const C = AU.ctx, t = C.currentTime + 0.05, a = Math.random() * Math.PI * 2, R = 12 + Math.random() * 45, px = P.x + Math.sin(a) * R, pz = P.z + Math.cos(a) * R;
  const out = sfxOut(sfxPan(px, pz)), v = 0.11 * (1 - R / 70), pick = Math.random();
  if (pick < 0.32) { const n = 2 + (Math.random() * 4 | 0), f = 3600 + Math.random() * 900; for (let i = 0; i < n; i++) sfxTone(t + i * (0.11 + Math.random() * 0.06), 0.055, f * 1.15, f * 0.85, v, out); } // passero: cip cip
  else if (pick < 0.52) { const hi = 4400 + Math.random() * 600, n = 3 + (Math.random() * 3 | 0); for (let i = 0; i < n; i++) { sfxTone(t + i * 0.24, 0.09, hi, hi * 0.97, v * 0.8, out); sfxTone(t + i * 0.24 + 0.11, 0.1, hi * 0.72, hi * 0.7, v * 0.8, out); } } // cinciallegra: ti-tu ti-tu
  else if (pick < 0.72) { let f = 1700 + Math.random() * 600, tt = t; const n = 4 + (Math.random() * 4 | 0); for (let i = 0; i < n; i++) { const d = 0.08 + Math.random() * 0.16, f1 = clamp(f * (0.8 + Math.random() * 0.45), 1300, 3200); sfxTone(tt, d, f, f1, v * 0.9, out); f = f1; tt += d + 0.03 + Math.random() * 0.05; } } // merlo
  else if (pick < 0.9) { const f = 480 + Math.random() * 60, w = v * 1.3; sfxTone(t, 0.22, f, f * 0.98, w, out); sfxTone(t + 0.32, 0.6, f * 1.04, f * 0.96, w, out); sfxTone(t + 1.05, 0.32, f * 0.92, f * 0.88, w, out); } // tortora: tu-tuuu-tu
  else { const n = 2 + (Math.random() * 2 | 0); for (let i = 0; i < n; i++) { sfxTone(t + i * 0.42, 0.28, 720, 560, v * 0.35, out, 'sawtooth'); sfxNoise(t + i * 0.42, 0.25, 'bandpass', 1400, 2, v * 0.6, 1, out); } } // cornacchia: craa
}
function sfxCrickets() {
  const C = AU.ctx, t = C.currentTime + 0.03, a = Math.random() * Math.PI * 2, R = 4 + Math.random() * 25, out = sfxOut(sfxPan(P.x + Math.sin(a) * R, P.z + Math.cos(a) * R));
  const f = 4300 + Math.random() * 500, v = 0.035 * (1 - R / 32), reps = 2 + (Math.random() * 3 | 0);
  for (let r = 0; r < reps; r++) for (let i = 0; i < 4; i++) sfxTone(t + r * 0.32 + i * 0.022, 0.016, f, f * 0.99, v, out);
}
// campane a concerto: three bells from the nearest church, a few rounds of pattern ringing
function sfxBells() {
  const ch = D.pois.filter(p => p.k === 'chiesa').sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0]; if (!ch) return;
  const C = AU.ctx, d = hyp(ch.x - P.x, ch.z - P.z), vol = 0.14 * clamp(1 - d / 2500, 0.15, 1), out = sfxOut(sfxPan(ch.x, ch.z));
  const lp = C.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = clamp(5000 - d * 3, 900, 5000); lp.connect(out); // far bells lose their shine
  const notes = [392, 330, 262], pat = [0, 1, 2, 0, 2, 1, 0, 1, 2, 2, 1, 0], t0 = C.currentTime + 0.1;
  for (let r = 0; r < 3; r++) pat.forEach((n, i) => {
    const t = t0 + (r * pat.length + i) * 0.62, f = notes[n];
    for (const [m, a, dec] of [[0.5, 0.5, 3.2], [1, 1, 2.4], [1.19, 0.45, 1.6], [1.5, 0.3, 1.2], [2, 0.35, 1.0], [2.66, 0.12, 0.6]]) {
      const o = C.createOscillator(), g = C.createGain(); o.frequency.value = f * m; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol * a / 3, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + dec);
      o.connect(g); g.connect(lp); o.start(t); o.stop(t + dec + 0.05);
    }
  });
}
// how busy the roads are at this hour
const busyAt = h => h < 5 ? 0.15 : h < 7.5 ? 0.15 + (h - 5) * 0.32 : h < 20 ? 0.95 : 0.95 - (h - 20) * 0.2;
function updSfx(dt) {
  if (!AU.on) return; if (!SFX.on) sfxInit(); if (!SFX.on) return;
  const C = AU.ctx, t = C.currentTime, live = !AU.muted && !paused, m = live ? 1 : 0, car = P.mode === 'car' ? P.car : null, L = lightTones();
  const lx = car ? car.x : P.x, lz = car ? car.z : P.z;
  // trees around: more leaves, more birds
  SFX.greenT -= dt; if (SFX.greenT <= 0) { SFX.greenT = 0.5; let n = 0; WALLS.each(lx - 30, lz - 30, lx + 30, lz + 30, s => { if (s.r === 0.4 && hyp(s.x - lx, s.z - lz) < 30) n++; }); SFX.green = lerp(SFX.green, clamp(0.12 + n / 14, 0, 1), 0.5); }
  const gust = clamp(0.45 + 0.3 * Math.sin(now * 0.13) + 0.2 * Math.sin(now * 0.41 + 1) + 0.15 * Math.sin(now * 1.3 + 2), 0, 1);
  SFX.amb.gain.setTargetAtTime(m * (car ? 0.3 : 1), t, 0.3);
  SFX.wind.g.gain.setTargetAtTime(0.03 + 0.09 * gust * gust, t, 0.4); SFX.wind.f.frequency.setTargetAtTime(280 + 320 * gust, t, 0.4);
  SFX.leaves.g.gain.setTargetAtTime(SFX.green * (0.004 + 0.05 * gust * gust * gust), t, 0.3); SFX.leaves.f.frequency.setTargetAtTime(3400 + 1800 * gust, t, 0.3);
  SFX.hum.g.gain.setTargetAtTime(0.05 + 0.1 * busyAt(TOD), t, 1);
  // the loudest moving car within 50 m
  let best = null, bs = 0;
  for (const v of VEH) { if (v === car || v.speed < 1.5 || v.spec.pedal /* bicycles have no engine */) continue; const d = hyp(v.x - lx, v.z - lz); if (d > 50) continue; const s = v.speed / Math.max(4, d); if (s > bs) { bs = s; best = v; } }
  if (best) {
    const dx = best.x - lx, dz = best.z - lz, d = hyp(dx, dz) || 1, lvx = car ? car.vx : P.vx || 0, lvz = car ? car.vz : P.vz || 0;
    const vr = ((best.vx - lvx) * dx + (best.vz - lvz) * dz) / d, dop = clamp(343 / (343 + vr), 0.8, 1.25), sp = best.speed;
    SFX.car.gain.setTargetAtTime(m * clamp(sp / 14, 0.35, 1) * Math.pow(1 - d / 50, 2) * (car ? 0.12 : 0.22), t, 0.08);
    SFX.carEng.frequency.setTargetAtTime((38 + sp * 3.2 * best.spec.snd) * dop, t, 0.08); SFX.carRoar.f.frequency.setTargetAtTime((380 + sp * 28) * dop, t, 0.08);
    SFX.carPan.pan.setTargetAtTime(sfxPan(best.x, best.z), t, 0.08);
  } else SFX.car.gain.setTargetAtTime(0, t, 0.2);
  // screeching tyres: sliding sideways, handbrake turns, panic braking (quiet on grass)
  let sk = 0;
  if (car && car.health > 0) {
    const s = car.speed; sk = clamp((car.drift - 2.2) / 5, 0, 1) * clamp(s / 8, 0, 1);
    if (car.inp.hand && s > 6) sk = Math.max(sk, clamp(s / 18, 0.3, 0.9));
    if (car.inp.brk > 0 && car.fwdSpeed > 9) sk = Math.max(sk, clamp((car.fwdSpeed - 9) / 20, 0, 0.6));
    if (sk > 0 && !onAnyRoad(car.x, car.z, 2)) sk *= 0.15;
  }
  SFX.skid.gain.setTargetAtTime(m * sk * 0.13, t, 0.05); SFX.skidO.frequency.setTargetAtTime(900 + sk * 300 + (Math.random() - 0.5) * 120, t, 0.03);
  if (!live) return;
  // footsteps: one per stride half, when the swinging leg comes down
  if (!car && P.knock <= 0) { const k = Math.floor(P.phase / Math.PI); if (k !== SFX.stepK) { SFX.stepK = k; if (Math.abs(P.speedNow || 0) > 0.5) sfxStep(Math.abs(P.speedNow) > 5); } }
  else SFX.stepK = Math.floor(P.phase / Math.PI);
  // birds by day, louder in the dawn chorus; crickets on warm nights
  const birds = L.day * (1 + 1.6 * Math.exp(-(((TOD - 6.6) / 1.1) ** 2))) * (0.35 + 0.65 * SFX.green) * (car ? 0.4 : 1);
  SFX.birdT -= dt; if (SFX.birdT <= 0) { SFX.birdT = (1.2 + Math.random() * 4.5) / Math.max(0.12, birds); if (birds > 0.06) sfxBird(); }
  const crick = clamp((L.night - 0.5) * 2, 0, 1) * (0.3 + 0.7 * SFX.green) * (car ? 0.3 : 1);
  SFX.crT -= dt; if (SFX.crT <= 0) { SFX.crT = 0.25 + Math.random() * 0.9; if (crick > 0.1 && Math.random() < crick) sfxCrickets(); }
  // church bells at 7, 12 and 19 (not when the clock is skipped forward)
  const h = TOD | 0; if (h !== SFX.hour) { const was = SFX.hour; SFX.hour = h; if (was >= 0 && (h === (was + 1) % 24) && (h === 7 || h === 12 || h === 19)) sfxBells(); }
}
