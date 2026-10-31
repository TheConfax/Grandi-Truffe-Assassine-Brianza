// ---------------------------------------------------------------- the physics of a car over the ground (Carlo, 31/10: "manca la verticalita", "il motore fisico")
// The driving on the ground (grip, steering, brakes, speeds: Vehicle.step) is untouched. This is what the body does in height: speed vy under
// gravity, a spring and a damper on every wheel, each wheel on the ground under it. A wheel pushes only while its spring is loaded, so where the
// ground drops away faster than the car falls the wheels leave it by themselves: no speed limit, no shadow, no floating. In the air the stick
// turns the nose and the roll, the speed over the ground stays. Every parameter is here. The player's vehicle runs this (and any vehicle thrown by
// an explosion, or left by the player until it stops); the traffic keeps a plain height that follows the ground (Vehicle.collide).
const FIS = {
  g: 13.5,          // m/s2 on a car off the ground: 9.81 at this camera and these speeds looked floaty (Carlo); 1.4 times it falls like GTA
  airMin: 0.05,     // m over the full droop of the springs, or...
  airT: 0.1,        // ...seconds with no wheel on the ground: then it is "in the air" (no grip). A wheel light for an instant over a wave keeps its grip
  rampMax: 0.4,     // rise over run of the ground under a wheel in a step: steeper is a step (a kerb, a deck joint), it lifts the car and does not launch it
  humpMax: 0.33,    // rise over run of the ground under the car, over a few metres: steeper is a hump of S no street has
  stickT: 0.5,      // s the car keeps to the ground after such a hump (a street over an embankment it should pass under: no ski jump)
  bankMax: 0.25,    // side slope the body follows, rise over run: past it is no road but the bank of S beside one (outside Meda, the old ground), the wheels take it as this
  launch: 0.32,     // vy at take-off, at most this share of the speed
  rightK: 40, rightP: 0.5, // on any wheel, a body leaning past what the ground asks (bankMax + 0.15, or rightP from its slope) comes back with this: nothing here tips over
  spinMax: 1,       // rad/s of nose and roll a car takes off with, at most: what the springs give in the last instant on the ground is not a somersault
  latMax: 11, lonMax: 12, // m/s2 of the arcade grip (up to 30) and brakes (21) that reach the body: beyond it the springs have no more to give
  stopE: 0.22,      // what a wheel gives back on its bump stop: the bounce of a hard or crooked landing
  stopPos: 0.35,    // share of the overrun taken back in a step at the bump stop (as the old height followed the ground)
  stopMax: 0.22,    // m past the bump stop the body may go, never more: it does not sink into the ground
  airPitch: 1.8, airRoll: 2.4, airAcc: 7, // stick in the air: rad/s of nose and of roll, rad/s2 to get there
  airK: 4, airD: 3, airNose: 0.6, airLim: 1.35, // stick free: the body drifts back level, the nose towards its way down (share airNose); at most airLim rad either way
  hitShake: 14, hitSfx: 2.5, // landing speed m/s for the full shake, speed from which it is heard
  // f: Hz of the body on its springs, z: damping (0.7: one soft overshoot, no bouncing), up: m of travel to the bump stop, rollG / pitchG: rad of body per g of side / brake or gas
  tipi: {
    panda:  { f: 1.5,  z: 0.7, up: 0.13, rollG: 0.075, pitchG: 0.05 },
    hatch:  { f: 1.55, z: 0.7, up: 0.13, rollG: 0.065, pitchG: 0.045 },
    sedan:  { f: 1.5,  z: 0.7, up: 0.14, rollG: 0.06,  pitchG: 0.045 },
    wagon:  { f: 1.45, z: 0.7, up: 0.14, rollG: 0.065, pitchG: 0.05 },
    suv:    { f: 1.3,  z: 0.7, up: 0.17, rollG: 0.095, pitchG: 0.06 },
    sport:  { f: 1.9,  z: 0.75, up: 0.09, rollG: 0.035, pitchG: 0.028 },
    van:    { f: 1.25, z: 0.7, up: 0.17, rollG: 0.115, pitchG: 0.07 },
    ape:    { f: 1.5,  z: 0.7, up: 0.12, rollG: 0.1,   pitchG: 0.05 },
    police: { f: 1.6,  z: 0.72, up: 0.13, rollG: 0.055, pitchG: 0.04 },
    scooter: { f: 1.8, z: 0.7, up: 0.09, rollG: 0, pitchG: 0.02 }, // two wheels: the lean, the wheelie and the stoppie are theirs (Vehicle.step)
    moto:   { f: 1.9,  z: 0.7, up: 0.11, rollG: 0, pitchG: 0.02 },
    bici:   { f: 2.1,  z: 0.7, up: 0.06, rollG: 0, pitchG: 0.015 },
  },
};
function fisInit(v) {
  const T = FIS.tipi[v.kind] || FIS.tipi.panda, W = v.m.wheels, n = W.length, om = 2 * Math.PI * T.f, F = v.F = { T, n, om, k: om * om / n, c: 2 * T.z * om / n, droop: FIS.g / (om * om), sx: [], sz: [], g: [], gf: [], dg: [], x: [], off: [], lx: v.x, lz: v.z, lh: v.h, lf: v.fwdSpeed, off0: 0, Ir: 0, Ip: 0 };
  for (let i = 0; i < n; i++) { const p = W[i].piv.position; F.sx.push(p.x); F.sz.push(p.z); F.Ir += p.x * p.x / n; F.Ip += p.z * p.z / n; F.dg.push(0); F.x.push(0); F.off.push(0); F.g.push(0); F.gf.push(0); }
  F.Ir = Math.max(F.Ir, 0.2); F.Ip = Math.max(F.Ip, 0.2); F.kr = T.rollG / 9.81 * om * om; F.kp = T.pitchG / 9.81 * om * om; /* what holds rollG, pitchG rad at 1 g against springs of frequency om */
  v.ap = v.slope; v.ar = 0; v.wp = v.wr = 0; if (!(v.vy > 2)) v.vy = 0; if (!v.exploded && !v.spec.two) v.roll = 0; if (!v.spec.two) v.pitch = 0; F.stick = 0; F.sl = 0; F.lty = v.y; F.kick = v.vy > 2; fisGround(v, 0, true);
  v.m.body.position.y = v.spec.two ? v.m.body.position.y : 0;
}
function fisGround(v, mv, first, yf, yb) { // the ground under each wheel: F.gf follows a ramp at once and a step in a few frames, F.dg is how fast it rises under the wheel, never for a step
  const F = v.F, s = Math.sin(v.h), c = Math.cos(v.h), dt = 1 / 60, lim = FIS.rampMax * mv + 0.002;
  let kerb = 0;
  for (let i = 0; i < F.n; i++) {
    let g = H.surface(v.x + s * F.sz[i] + c * F.sx[i], v.z + c * F.sz[i] - s * F.sx[i], v.y);
    if (yf !== undefined) { const ga = lerp(yb, yf, clamp(0.5 + F.sz[i] / (2 * v.co), 0, 1)), lm = FIS.bankMax * Math.abs(F.sx[i]) + 0.02; g = clamp(g, ga - lm, ga + lm); } /* the axle's own ground is the mean of the two ways the wheels may lie */
    if (first) { F.g[i] = F.gf[i] = g; F.dg[i] = 0; continue; }
    const d = g - F.g[i], st = mv < 0.02 || Math.abs(d) > lim; F.g[i] = g; if (st && d > kerb) kerb = d;
    if (!st) F.gf[i] += d; F.gf[i] = lerp(F.gf[i], g, 0.35); F.dg[i] = lerp(F.dg[i], st ? 0 : d / dt, 0.5);
  }
  return kerb;
}
function fisVert(v, cf, cb, yf, yb, ty) { // once a step from Vehicle.collide, after the move and the walls
  const dt = 1 / 60, F = v.F, T = F.T, n = F.n, fs = v.fwdSpeed, G = FIS.g, gs = Math.atan2(yb - yf, v.co * 2), mv = hyp(v.x - F.lx, v.z - F.lz);
  v.slope = lerp(v.slope, gs, 0.35); /* what the hills do to the speed in Vehicle.step, as it was */
  if (mv > 8) { v.y = ty; v.vy = 0; v.wp = v.wr = 0; v.ap = gs; v.ar = 0; v.air = false; F.lx = v.x; F.lz = v.z; F.lh = v.h; F.lf = fs; F.sl = 0; fisGround(v, 0, true, yf, yb); F.lty = ty; return; } /* a teleport */
  const yawR = wrapA(v.h - F.lh) / dt, aLon = clamp((fs - F.lf) / dt, -FIS.lonMax, FIS.lonMax), aLat = FIS.latMax * Math.tanh(yawR * fs / FIS.latMax);
  F.lx = v.x; F.lz = v.z; F.lh = v.h; F.lf = fs;
  const rise = ty - F.lty; F.lty = ty; if (mv > 0.01 && Math.abs(rise) < 1.5) F.sl += (rise / mv - F.sl) * Math.min(1, mv / 3); if (Math.abs(F.sl) > FIS.humpMax && (F.sl > 0 || F.stick > 0 || onAnyRoad(v.x, v.z, 1))) F.stick = FIS.stickT; else if (F.stick > 0) F.stick -= dt; /* up the hump and down it; a street does not drop like this, the bank of S beside it does: off the road it falls */
  const kerb = fisGround(v, mv, false, yf, yb); if (kerb > 0.09 && kerb < 0.25 && v === P.car && v.speed > 6) shake = Math.max(shake, 0.12);
  let sF = 0, tr = 0, tp = 0, on = 0, hit = 0; const sr = Math.sin(v.ar), sp = Math.sin(v.ap), cr = Math.cos(v.ar), cp = Math.cos(v.ap);
  for (let i = 0; i < n; i++) {
    const sx = F.sx[i], sz = F.sz[i], x = F.gf[i] - (v.y + sx * sr - sz * sp); F.x[i] = x; if (x < -F.droop) continue;
    on++; const rel = F.dg[i] - (v.vy + sx * cr * v.wr - sz * cp * v.wp); if (rel > hit) hit = rel;
    const f = Math.max(0, G / n + F.k * x + F.c * rel); sF += f; tr += f * sx; tp += f * sz;
  }
  const dead = v.health <= 0 || v.fallen;
  if (v.air && on === 0 && !dead) { // the stick, in the air: forward the nose down, back the nose up, sideways the roll towards that side
    const i = v.inp, ln = clamp(i.lean || 0, -1, 1), st = clamp(i.steer || 0, -1, 1), A = FIS.airAcc * dt, nose = Math.atan2(-v.vy, Math.max(6, Math.abs(fs))) * Math.sign(fs || 1) * FIS.airNose;
    if (Math.abs(ln) > 0.08) v.wp += clamp(-ln * FIS.airPitch - v.wp, -A, A); else v.wp += (FIS.airK * (nose - v.ap) - FIS.airD * v.wp) * dt;
    if (Math.abs(st) > 0.08) v.wr += clamp(-st * FIS.airRoll - v.wr, -A, A); else v.wr += (FIS.airK * -v.ar - FIS.airD * v.wr) * dt;
  } else if (on) { v.wr += (tr * cr / F.Ir + F.kr * aLat) * dt; v.wp += (-tp * cp / F.Ip - F.kp * aLon) * dt; } /* the springs against what the turn and the brakes ask of the body */
  else { v.wr += (FIS.airK * -v.ar - FIS.airD * v.wr) * dt; v.wp += (FIS.airK * (gs - v.ap) * 0.5 - FIS.airD * v.wp) * dt; }
  if (on) { const la = FIS.bankMax + 0.15, or = Math.abs(v.ar) - la, op = Math.abs(v.ap - gs) - FIS.rightP; if (or > 0) { v.wr -= Math.sign(v.ar) * or * FIS.rightK * dt; v.wr *= 1 - 4 * dt; } if (op > 0) { v.wp -= Math.sign(v.ap - gs) * op * FIS.rightK * dt; v.wp *= 1 - 4 * dt; } }
  v.vy += (sF - G) * dt; v.y += v.vy * dt; v.ar = clamp(v.ar + v.wr * dt, -FIS.airLim, FIS.airLim); v.ap = clamp(v.ap + v.wp * dt, -FIS.airLim, FIS.airLim);
  if (Math.abs(v.ar) === FIS.airLim) v.wr = 0; if (Math.abs(v.ap) === FIS.airLim) v.wp = 0;
  if (v.spec.two && !v.air) { v.ar = lerp(v.ar, 0, 0.15); v.wr = 0; } /* two wheels stand on their lean, not on their springs */
  // the bump stops: a wheel at the end of its travel takes the body with it, by the point it touches: a crooked landing turns it and gives a little back
  for (let it = 0; it < 3; it++) { // all together, so a flat landing stays flat
    let dv = 0, dr = 0, dp = 0, dy = 0, da = 0, db = 0, m = 0;
    for (let i = 0; i < n; i++) if (F.gf[i] - (v.y + F.sx[i] * Math.sin(v.ar) - F.sz[i] * Math.sin(v.ap)) > T.up) m++;
    if (!m) break;
    for (let i = 0; i < n; i++) {
      const sx = F.sx[i], sz = F.sz[i], x = F.gf[i] - (v.y + sx * Math.sin(v.ar) - sz * Math.sin(v.ap)), over = x - T.up; if (over <= 0) continue;
      const w = (1 + sx * sx / F.Ir + sz * sz / F.Ip) * (m > 1 ? 0.6 * m : 1), rel = F.dg[i] - (v.vy + sx * v.wr - sz * v.wp);
      if (rel > 0) { const j = rel * (1 + (rel > 1.5 && it === 0 ? FIS.stopE : 0)) / w; dv += j; dr += j * sx / F.Ir; dp -= j * sz / F.Ip; }
      if (it === 0) { const q = (Math.max(over - FIS.stopMax, 0) + Math.min(over, FIS.stopMax) * FIS.stopPos) / w; dy += q; da += q * sx / F.Ir; db -= q * sz / F.Ip; }
    }
    v.vy += dv; v.wr += dr; v.wp += dp; v.y += dy; v.ar += da; v.ap += db;
  }
  if (F.stick > 0 && !v.air) { const y0 = v.y; if (v.y > ty) v.y = lerp(v.y, ty, 0.35); v.vy = Math.min(v.y === y0 ? v.vy : (v.y - y0) / dt, FIS.humpMax * v.speed); v.ap = lerp(v.ap, gs, 0.35); v.ar = lerp(v.ar, 0, 0.2); v.wp = v.wr = 0; on = Math.max(on, 1); } /* a hump of S: as the old height, on the ground */
  // the wheels as drawn: on the ground, at most the full droop below the body
  for (let i = 0; i < n; i++) { const x = F.gf[i] - (v.y + F.sx[i] * Math.sin(v.ar) - F.sz[i] * Math.sin(v.ap)); F.x[i] = x; F.off[i] = lerp(F.off[i], clamp(x, -Math.min(F.droop, 0.2), T.up), 0.5); }
  // on the wheels or in the air
  if (on === 0) {
    F.off0 += dt; let top = -1e9; for (let i = 0; i < n; i++) if (F.x[i] > top) top = F.x[i];
    if (!v.air && (F.off0 > FIS.airT || top < -F.droop - FIS.airMin)) { v.air = true; v.airT = F.off0; v.airTop = 0; v.air0 = [v.x, v.z]; v.jumps = (v.jumps || 0) + 1; if (!v.exploded && !F.kick) v.vy = Math.min(v.vy, FIS.launch * v.speed); v.wp = clamp(v.wp, -FIS.spinMax, FIS.spinMax); v.wr = clamp(v.wr, -FIS.spinMax, FIS.spinMax); }
    if (v.air) { v.airT += dt; v.airTop = Math.max(v.airTop, v.y - ty); }
  } else {
    F.off0 = 0;
    if (v.air) { // down: the springs have taken it
      v.air = false; F.kick = false; v.lastJump = { t: v.airT, h: v.airTop, d: hyp(v.x - v.air0[0], v.z - v.air0[1]), hit, v: v.speed, ap: v.ap, ar: v.ar };
      if (v === P.car) { shake = Math.max(shake, Math.min(0.9, hit / FIS.hitShake)); if (hit > FIS.hitSfx && hit <= 7) sfxCrash(hit); }
      if (hit > 10) v.impact(hit * 0.7); /* as it was: a fall from high up counts as a crash. No new damage from landing crooked: the damage system is to be redone */
    }
  }
  v.fpBusy = Math.abs(v.vy) > 0.05 || Math.abs(v.wp) > 0.02 || Math.abs(v.wr) > 0.02 || !!v.air;
}
// the whole way of the frame, not only where it ends: at high speed a thin pole or a sign falls between two frames (Carlo, 30/10)
function vehSweep(v, x0, z0) {
  const dx = v.x - x0, dz = v.z - z0, d = hyp(dx, dz), st = Math.max(0.35, v.rad * 0.7); if (d <= st || d > 8) return;
  const xe = v.x, ze = v.z, m = Math.min(32, Math.ceil(d / st));
  for (let k = 1; k < m; k++) {
    v.x = x0 + dx * k / m; v.z = z0 + dz * k / m; gateHits(v); fuelHits(v); propHits(v); barHits(v);
    for (const c of v.circles()) if (collideStatic({ x: c[0], z: c[1] }, v.rad, v.y + 0.4, true)) return; /* stops here: Vehicle.collide takes it from this point */
  }
  v.x = xe; v.z = ze;
}
