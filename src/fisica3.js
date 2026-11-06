// ---------------------------------------------------------------- the physics of a car over the ground (Carlo, 31/10: "manca la verticalita", "il motore fisico")
// The driving on the ground (grip, steering, brakes, speeds: Vehicle.step) is untouched. This is what the body does in height: speed vy under
// gravity, a spring and a damper on every wheel, each wheel on the ground under it. A wheel pushes only while its spring is loaded, so where the
// ground drops away faster than the car falls the wheels leave it by themselves: no speed limit, no shadow, no floating. In the air the stick
// turns the nose and the roll, the speed over the ground stays. Every parameter is here. The player's vehicle runs this (and any vehicle thrown by
// an explosion, or left by the player until it stops); the traffic keeps a plain height that follows the ground (Vehicle.collide).
// Off its wheels a car is a rigid hull (fisRig): it turns over if it has way on, and if it stops on its roof it is finished (v.ko, Carlo 1/11): no engine, no controls, he gets out.
// While it has way on it can be saved (Carlo, 1/11): the player's stick works on the ground too, and a car touching down crooked with the stick pushed takes a hop to finish the turn.
const FIS = {
  g: 13.5,          // m/s2 on a car off the ground: 9.81 at this camera and these speeds looked floaty (Carlo); 1.4 times it falls like GTA
  airMin: 0.05,     // m over the full droop of the springs, or...
  airT: 0.1,        // ...seconds with no wheel on the ground: then it is "in the air" (no grip). A wheel light for an instant over a wave keeps its grip
  rampMax: 0.4,     // rise over run of the ground under a wheel in a step: steeper is a step (a kerb, a deck joint), it lifts the car and does not launch it
  bankMax: 0.25,    // side slope the body follows, rise over run: past it is no road but the bank of S beside one (outside Meda, the old ground), the wheels take it as this
  launch: 0.32,     // vy at take-off, at most this share of the speed
  rightK: 40, rightP: 0.5, // on any wheel, a body leaning past what the ground asks (bankMax + 0.15, or rightP from its slope) comes back with this: nothing tips over on its springs
  spinMax: 1,       // rad/s of nose and roll a car takes off with, at most: what the springs give in the last instant on the ground is not a somersault
  latMax: 11, lonMax: 12, // m/s2 of the arcade grip (up to 30) and brakes (21) that reach the body: beyond it the springs have no more to give
  stopE: 0.22,      // what a wheel gives back on its bump stop: the bounce of a hard or crooked landing
  stopPos: 0.35,    // share of the overrun taken back in a step at the bump stop (as the old height followed the ground)
  stopMax: 0.22,    // m past the bump stop the body may go, never more: it does not sink into the ground
  airPitch: 1.8, airRoll: 2.4, airAcc: 7, // stick in the air: rad/s of nose and of roll, rad/s2 to get there
  airK: 4, airD: 3, airNose: 0.6, airLim: 1.35, // stick free: the body drifts back level, the nose towards its way down (share airNose). The pull grows up to airLim rad off level and fades to nothing at 180 degrees, so it never snaps round. No stop on the angle: whole turns are free
  // off its wheels (a car, fisRig): "up" is the body's up over the world's, 1 on the wheels, -1 on the roof. Past tipIn the springs no longer mean anything and the body is a rigid hull on the ground
  tipIn: 0.6, tipOut: 0.75, tipLand: 0.85, // up under which the hull takes over; up over which the springs take back, in the air and on the ground
  pivHi: 0.95, pivLo: 0.6, // it turns round its waist, not round the point under the wheels: nothing at pivHi (an ordinary jump looks as it did), all of it at pivLo
  rigMu: 0.7, rigE: 0.2, rigDamp: 1.5, // grip of the hull on the ground, what a blow gives back, rad/s lost per s touching
  flipV: 9, flipUp: 0.3, flipMax: 6, flipPop: 0.22, popMax: 5, flipKeep: 0.85, // landing crooked (up under flipUp) with over flipV m/s: a hop of flipPop of the speed, at most popMax, and a turn back towards the wheels, at most flipMax rad/s; flipKeep of the speed goes on
  rigPitch: 3.2, rigRoll: 3.6, rigAcc: 16, saveK: 2, saveMax: 5.5, // the player's stick on a hull off its wheels, touching the ground or in a hop: rad/s of nose and of roll, rad/s2 to get there; touching crooked with the stick pushed: a hop of saveK of the speed, at most saveMax, for the time to finish the turn. Free of the stick nothing of this happens
  nudge: 6, nudgeV: 6, // rad/s2 on a body slower than nudgeV on its side or its nose, growing with the time it takes: it does not stay in the balance
  koUp: -0.8, koV: 0.5, koT: 0.4, stuckT: 5, // on the roof (up under koUp), slower than koV for koT s: finished (v.ko), for good. Nothing lies crooked longer than stuckT s
  tipNear: 0.5,     // m under the full droop: a body this near the ground under its wheels is over or not as the ground is, not as the world (Carlo, 6/11: a car standing on a bank of 50 degrees is not over)
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
  const T = FIS.tipi[v.kind] || FIS.tipi.panda, W = v.m.wheels, n = W.length, om = 2 * Math.PI * T.f, F = v.F = { T, n, om, k: om * om / n, c: 2 * T.z * om / n, droop: FIS.g / (om * om), sx: [], sz: [], g: [], gf: [], dg: [], x: [], off: [], lx: v.x, lz: v.z, lh: v.h, lf: v.fwdSpeed, off0: 0, Ir: 0, Ip: 0, mid: vehMaxTop(v) / 2, rig: false };
  for (let i = 0; i < n; i++) { const p = W[i].piv.position; F.sx.push(p.x); F.sz.push(p.z); F.Ir += p.x * p.x / n; F.Ip += p.z * p.z / n; F.dg.push(0); F.x.push(0); F.off.push(0); F.g.push(0); F.gf.push(0); }
  F.Ir = Math.max(F.Ir, 0.2); F.Ip = Math.max(F.Ip, 0.2); F.kr = T.rollG / 9.81 * om * om; F.kp = T.pitchG / 9.81 * om * om; /* what holds rollG, pitchG rad at 1 g against springs of frequency om */
  v.ap = v.slope; v.ar = 0; v.wp = v.wr = 0; if (!(v.vy > 2)) v.vy = 0; if (!v.exploded && !v.spec.two) v.roll = 0; if (!v.spec.two) v.pitch = 0; F.kick = v.vy > 2; fisGround(v, 0, true);
  v.m.body.position.y = v.spec.two ? v.m.body.position.y : 0;
}
function fisGround(v, mv, first, yf, yb) { // the ground under each wheel: F.gf follows a ramp at once and a step in a few frames, F.dg is how fast it rises under the wheel, never for a step
  const F = v.F, s = Math.sin(v.h), c = Math.cos(v.h), dt = 1 / 60, lim = FIS.rampMax * mv + 0.002;
  let kerb = 0;
  for (let i = 0; i < F.n; i++) {
    let g = H.surface(v.x + s * F.sz[i] + c * F.sx[i], v.z + c * F.sz[i] - s * F.sx[i], v.y);
    if (v.lev) g = Math.max(g, v.lev[F.sz[i] > 0 ? 0 : 1]); /* resting on a thing it came down on (vehAppoggio) */
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
  if (mv > 8 && !F.rig) { v.y = ty; v.vy = 0; v.wp = v.wr = 0; v.ap = gs; v.ar = 0; v.air = false; F.lx = v.x; F.lz = v.z; F.lh = v.h; F.lf = fs; fisGround(v, 0, true, yf, yb); return; } /* a teleport */
  const yawR = wrapA(v.h - F.lh) / dt, aLon = clamp((fs - F.lf) / dt, -FIS.lonMax, FIS.lonMax), aLat = FIS.latMax * Math.tanh(yawR * fs / FIS.latMax);
  F.lx = v.x; F.lz = v.z; F.lh = v.h; F.lf = fs;
  if (F.rig) { fisRig(v, yf, yb, ty, fs); return; }
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
    if (Math.abs(ln) > 0.08) v.wp += clamp(-ln * FIS.airPitch - v.wp, -A, A); else v.wp += (FIS.airK * fisLevel(wrapA(nose - v.ap)) - FIS.airD * v.wp) * dt;
    if (Math.abs(st) > 0.08) v.wr += clamp(-st * FIS.airRoll - v.wr, -A, A); else v.wr += (FIS.airK * fisLevel(-v.ar) - FIS.airD * v.wr) * dt;
  } else if (on) { v.wr += (tr * cr / F.Ir + F.kr * aLat) * dt; v.wp += (-tp * cp / F.Ip - F.kp * aLon) * dt; } /* the springs against what the turn and the brakes ask of the body */
  else { v.wr += (FIS.airK * fisLevel(-v.ar) - FIS.airD * v.wr) * dt; v.wp += (FIS.airK * fisLevel(wrapA(gs - v.ap)) * 0.5 - FIS.airD * v.wp) * dt; }
  if (on) { const la = FIS.bankMax + 0.15, or = Math.abs(v.ar) - la, op = Math.abs(v.ap - gs) - FIS.rightP; if (or > 0) { v.wr -= Math.sign(v.ar) * or * FIS.rightK * dt; v.wr *= 1 - 4 * dt; } if (op > 0) { v.wp -= Math.sign(v.ap - gs) * op * FIS.rightK * dt; v.wp *= 1 - 4 * dt; } }
  v.vy += (sF - G) * dt; v.y += v.vy * dt; v.ar = wrapA(v.ar + v.wr * dt); v.ap = wrapA(v.ap + v.wp * dt);
  if (v.spec.two && !v.air) { v.ar = lerp(v.ar, 0, 0.15); v.wr = 0; } /* two wheels stand on their lean, not on their springs */
  if (v.fallen && !v.air) { v.ar *= 0.8; v.ap = gs + wrapA(v.ap - gs) * 0.8; v.wr = v.wp = 0; } /* the bike lies down on the ground, whatever way it came */
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
  if (!v.spec.two) fisScocca(v); /* the body never in the ground */
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
      if (v.spec.two && !v.fallen && (Math.cos(v.ar) * Math.cos(v.ap) < FIS.tipIn || Math.cos(v.ap) < 0)) { if (v.driver) throwRider(v, Math.max(9, v.speed)); else { v.fallen = true; v.fallSide = rnd() < 0.5 ? -1 : 1; } } /* two wheels landing crooked: the rider goes, the bike lies down. It never lies on its back */
    }
  }
  v.fpBusy = Math.abs(v.vy) > 0.05 || Math.abs(v.wp) > 0.02 || Math.abs(v.wr) > 0.02 || !!v.air || (!!v.fallen && Math.abs(v.ar) + Math.abs(v.ap - gs) > 0.02);
  if (!v.spec.two && (on || F.x.some(x => x > -F.droop - FIS.tipNear) ? Math.cos(v.ar - Math.atan(pendioTan(v)[1])) * Math.cos(v.ap - gs) : Math.cos(v.ar) * Math.cos(v.ap)) < FIS.tipIn) fisRigIn(v); /* on its wheels, over as the ground under it is: on a steep bank a car standing on it is not over */
}
function fisLevel(d) { const a = Math.abs(d), L = FIS.airLim; return a <= L ? d : Math.sign(d) * L * (Math.PI - a) / (Math.PI - L); } // the stick-free pull back level, for an angle within 180 degrees
function fisPivot(F, up) { const t = clamp((FIS.pivHi - up) / (FIS.pivHi - FIS.pivLo), 0, 1); return F.mid * t * t * (3 - 2 * t); } // height over the point under the wheels the body turns round
// ---- a car off its wheels: a rigid hull on the ground, its wheels, its waist (where the side is widest, at the height of the middle: on the side it balances on an edge) and its roof.
// No grip, no engine, no brakes (Vehicle.stepAir): the ground only pushes up and rubs, at the points that touch it. Three numbers of the body and one vertical: speeds y, ar, ap.
// Where a point goes when each of them moves is J below (the turn is yaw, then nose ap, then roll ar, as drawn), so a blow off centre turns the body by itself and gravity tips it off an edge
function fisRigIn(v) {
  const F = v.F; F.rig = true; F.free = false; F.restT = F.koT = 0; F.rest = false; F.way = true;
  if (F.ha) return;
  const S = v.spec, hw = S.W / 2, hl = S.L / 2, [cw, cz, cl] = S.ape ? [hw * 0.8, 0, hl * 0.8] : vehUpper(v), top = vehMaxTop(v); F.ha = []; F.hb = []; F.hd = [];
  const add = (a, b, d) => { F.ha.push(a); F.hb.push(b); F.hd.push(d); };
  for (let i = 0; i < F.n; i++) add(F.sx[i], 0, F.sz[i]);
  for (const a of [-1, 1]) for (const d of [-1, 1]) { add(a * hw, F.mid, d * hl); add(a * Math.min(cw, hw * 0.9), top, cz + d * Math.min(cl, hl)); }
  const m = F.ha.length; for (const k of ['cd', 'jyr', 'jyp', 'jzr', 'jzp', 'jxr', 'an', 'af', 'al']) F[k] = new Array(m).fill(0);
}
function fisKo(v) { const F = v.F; v.ko = F.rest = true; v.vx = v.vz = v.vy = v.wr = v.wp = 0; v.boost = false; v.fpBusy = false; } // finished, for good
function fisRigOut(v, yf, yb) { // back on the springs
  const F = v.F; F.rig = false; F.free = false;
  if (Math.cos(v.ap) < 0) { v.h = wrapA(v.h + Math.PI); v.ap = wrapA(Math.PI - v.ap); v.ar = wrapA(v.ar + Math.PI); v.wp = -v.wp; const p = v._p; if (p) { p[3] = v.h; p[7] = v.ap; p[8] = v.ar; } } /* over on both axes is the same as turned round: the springs want it told that way */
  if (!v.air) { v.air = true; v.airT = 0; v.airTop = 0; v.air0 = [v.x, v.z]; }
  F.lh = v.h; F.lf = v.fwdSpeed; F.off0 = 0; v.wr = clamp(v.wr, -4, 4); v.wp = clamp(v.wp, -4, 4); fisGround(v, 0, true, yf, yb);
}
function fisRig(v, yf, yb, ty, fs) {
  const dt = 1 / 60, F = v.F, G = FIS.g;
  if (F.rest) { if (v.speed < 0.2 && v.vy < 1) { v.vx = v.vz = 0; v.fpBusy = false; return; } F.rest = false; } /* finished on its roof: nothing to do until something shoves it */
  const live = !v.ko && v.health > 0, me = live && v === P.car, i = v.inp, ln = clamp(i.lean || 0, -1, 1), st = clamp(i.steer || 0, -1, 1), lnOn = me && Math.abs(ln) > 0.08, stOn = me && Math.abs(st) > 0.08, way = F.way = v.speed > FIS.koV && (v.air || F.way); /* the player's stick; the traffic has none on the ground. Way on is what it had when it came down: once it has stopped, the rub of a turn of the stick does not count as way on */
  if (me && !v.air && way) { const A = FIS.rigAcc * dt; if (lnOn) v.wp += clamp(-ln * FIS.rigPitch - v.wp, -A, A); if (stOn) v.wr += clamp(-st * FIS.rigRoll - v.wr, -A, A); } /* on the ground, while it moves: the same stick */
  else if (v.air && live) { // the stick as ever (in a hop, as quick as on the ground); free of it, a hop keeps its turn and anything else drifts back level as ever; with the stick pushed one way the other way drifts back level, or the turn would never close
    const q = me && F.free, drift = !F.free || lnOn || stOn, A = (q ? FIS.rigAcc : FIS.airAcc) * dt;
    if (Math.abs(ln) > 0.08) v.wp += clamp(-ln * (q ? FIS.rigPitch : FIS.airPitch) - v.wp, -A, A); else if (drift) v.wp += (FIS.airK * fisLevel(wrapA(Math.atan2(-v.vy, Math.max(6, Math.abs(fs))) * Math.sign(fs || 1) * FIS.airNose - v.ap)) - FIS.airD * v.wp) * dt;
    if (Math.abs(st) > 0.08) v.wr += clamp(-st * (q ? FIS.rigRoll : FIS.airRoll) - v.wr, -A, A); else if (drift) v.wr += (FIS.airK * fisLevel(-v.ar) - FIS.airD * v.wr) * dt;
  }
  v.vy -= G * dt; v.y += v.vy * dt; v.ar = wrapA(v.ar + v.wr * dt); v.ap = wrapA(v.ap + v.wp * dt);
  const sa = Math.sin(v.ar), ca = Math.cos(v.ar), sp = Math.sin(v.ap), cp = Math.cos(v.ap), sh = Math.sin(v.h), ch = Math.cos(v.h), up = ca * cp, k = fisPivot(F, up), Ir = F.Ir, Ip = F.Ip, N = F.ha.length;
  let m = 0, deep = 0, hit = 0;
  for (let j = 0; j < N; j++) { // which points are on the ground
    const a = F.ha[j], b = F.hb[j] - k, d = F.hd[j], yz = a * sa + b * ca, xb = a * ca - b * sa, y = yz * cp - d * sp, z = yz * sp + d * cp, wy = v.y + k + y;
    if (wy > ty + 1.2) continue;
    const g = H.surface(v.x + xb * ch + z * sh, v.z - xb * sh + z * ch, wy + 0.5); if (g <= wy) continue;
    F.cd[m] = g - wy; if (g - wy > deep) deep = g - wy; F.jyr[m] = xb * cp; F.jyp[m] = -z; F.jzr[m] = xb * sp; F.jzp[m] = y; F.jxr[m] = -yz; F.an[m] = F.af[m] = F.al[m] = 0;
    const vn = v.vy + F.jyr[m] * v.wr + F.jyp[m] * v.wp; if (-vn > hit) hit = -vn; m++;
  }
  if (m) {
    let fw = v.vx * sh + v.vz * ch, la = v.vx * ch - v.vz * sh;
    for (let it = 0; it < 4; it++) for (let q = 0; q < m; q++) { // the push and the rub, all together, a few rounds
      const jyr = F.jyr[q], jyp = F.jyp[q], jzr = F.jzr[q], jzp = F.jzp[q], jxr = F.jxr[q], vn = v.vy + jyr * v.wr + jyp * v.wp, w = 1 + jyr * jyr / Ir + jyp * jyp / Ip;
      const an = Math.max(0, F.an[q] - vn * (1 + (it === 0 && vn < -2 ? FIS.rigE : 0)) / w), dn = an - F.an[q]; F.an[q] = an; v.vy += dn; v.wr += dn * jyr / Ir; v.wp += dn * jyp / Ip;
      const lim = FIS.rigMu * an, af = clamp(F.af[q] - (fw + jzr * v.wr + jzp * v.wp) / (1 + jzr * jzr / Ir + jzp * jzp / Ip), -lim, lim), df = af - F.af[q]; F.af[q] = af; fw += df; v.wr += df * jzr / Ir; v.wp += df * jzp / Ip;
      const al = clamp(F.al[q] - (la + jxr * v.wr) / (1 + jxr * jxr / Ir), -lim, lim), dl = al - F.al[q]; F.al[q] = al; la += dl; v.wr += dl * jxr / Ir;
    }
    v.vx = fw * sh + la * ch; v.vz = fw * ch - la * sh;
    { const e = 1, gx = (H.surface(v.x + e, v.z, v.y + 1) - H.surface(v.x - e, v.z, v.y + 1)) / (2 * e), gz = (H.surface(v.x, v.z + e, v.y + 1) - H.surface(v.x, v.z - e, v.y + 1)) / (2 * e), gl = hyp(gx, gz), th = Math.atan(gl), a = PENDIO.g * (Math.sin(th) - FIS.rigMu * Math.cos(th)) * Math.cos(th); if (a > 0) { v.vx -= gx / gl * a * dt; v.vz -= gz / gl * a * dt; } } /* the ground pushes the hull up only: on a slope steeper than its rub it slides down (Carlo, 6/11) */
    v.y += deep > 0.4 ? deep : Math.max(0, deep - 0.01) * 0.5; const dm = 1 - FIS.rigDamp * dt; v.wr *= dm; v.wp *= dm;
    F.off0 = 0;
    if (v.air) { // down
      v.air = false; F.free = false; v.lastJump = { t: v.airT, h: v.airTop, d: hyp(v.x - v.air0[0], v.z - v.air0[1]), hit, v: v.speed, ap: v.ap, ar: v.ar, up };
      if (v === P.car) { shake = Math.max(shake, Math.min(0.9, hit / FIS.hitShake)); if (hit > FIS.hitSfx && hit <= 7) sfxCrash(hit); }
      if (hit > 10) v.impact(hit * 0.7); /* as it was */
      const sd = v.speed;
      if (!v.ko && up < FIS.flipUp && sd > FIS.flipV && !lnOn && !stOn) { // with way on, it does not stay there: a hop, and round towards the wheels
        const byR = Math.abs(v.ar) >= Math.abs(v.ap), a = byR ? v.ar : v.ap, w = byR ? v.wr : v.wp, tw = byR ? -Math.sign(la) : Math.sign(fw), s = Math.abs(a) < 2.2 ? -Math.sign(a) : Math.abs(w) > 0.5 ? Math.sign(w) : tw || 1;
        const vy = Math.min(FIS.popMax, FIS.flipPop * sd), T = 2 * vy / G, dist = (((-a * s) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI), om = s * Math.min(FIS.flipMax, dist / T * (0.85 + rnd() * 0.3));
        v.vy = Math.max(v.vy, vy); if (byR) v.wr = om; else v.wp = om; v.vx *= FIS.flipKeep; v.vz *= FIS.flipKeep; F.free = true; F.freeT = 0.25; v.y += 0.02;
      }
    }
    else if (F.free && (F.freeT -= dt) < 0) F.free = false; /* a hop that never left the ground */
    if ((lnOn || stOn) && way && !F.free && up < FIS.flipUp) { v.vy = Math.max(v.vy, Math.min(FIS.saveMax, FIS.saveK * v.speed)); F.free = true; F.freeT = 0.25; v.y += 0.02; } /* crooked, with way on and the stick pushed: a hop, the stick does the turn; the slower, the smaller */
    const slow = Math.abs(v.wr) < 0.6 && Math.abs(v.wp) < 0.6 && Math.abs(v.vy) < 0.6 && v.speed < FIS.koV;
    if (!F.free && slow && (up < FIS.koUp || v.ko)) { F.koT += dt; if (F.koT > FIS.koT) { fisKo(v); return; } } else F.koT = 0;
    if (!F.free && !v.ko && v.speed < FIS.nudgeV) { // on its side or its nose it does not stay: down the nearer way, on the wheels or on the roof, or the way the stick says (once stopped, only towards the wheels: else not at all), harder the longer it takes
      F.restT += dt; const nd = FIS.nudge * (1 + 2 * F.restT) * dt;
      if (Math.abs(ca) < 0.85) { const dir = stOn ? -Math.sign(st) : (Math.abs(v.ar) < Math.PI / 2 ? -1 : 1) * (Math.sign(v.ar) || 1); if ((!stOn || way || dir === -Math.sign(v.ar)) && v.wr * dir < 2) v.wr += dir * nd; }
      if (Math.abs(cp) < 0.85) { const dir = lnOn ? -Math.sign(ln) : (Math.abs(v.ap) < Math.PI / 2 ? -1 : 1) * (Math.sign(v.ap) || 1); if ((!lnOn || way || dir === -Math.sign(v.ap)) && v.wp * dir < 2) v.wp += dir * nd; }
      if (F.restT > FIS.stuckT && slow) { if (up < 0) { fisKo(v); return; } fisRigOut(v, yf, yb); v.fpBusy = true; return; }
    } else F.restT = 0;
    if (!v.ko && up > FIS.tipLand && Math.abs(v.wr) < 3 && Math.abs(v.wp) < 3) { fisRigOut(v, yf, yb); v.fpBusy = true; return; } /* on the wheels */
    if (!v.ko && ca * Math.cos(v.ap - Math.atan2(yb - yf, v.co * 2)) > FIS.tipLand && Math.abs(v.wr) < 3 && Math.abs(v.wp) < 3) { fisRigOut(v, yf, yb); v.fpBusy = true; return; } /* on the wheels, on a steep bank */
  } else {
    F.off0 += dt;
    if (!v.air && F.off0 > FIS.airT) { v.air = true; v.airT = F.off0; v.airTop = 0; v.air0 = [v.x, v.z]; }
    if (v.air) { v.airT += dt; v.airTop = Math.max(v.airTop, v.y - ty); }
    if (!v.ko && up > FIS.tipOut) { fisRigOut(v, yf, yb); v.fpBusy = true; return; } /* the right way up in the air: as any jump from here */
  }
  for (let i = 0; i < F.n; i++) { F.x[i] = -F.droop; F.off[i] = lerp(F.off[i], -Math.min(F.droop, 0.2), 0.5); }
  v.fpBusy = true;
}
// where he gets out: the side as ever if it is free, else the first free place round the car, on this side of any wall. A car on its roof against a wall lets him out too
function exitSpot(v) {
  const S = v.spec, sh = Math.sin(v.h), ch = Math.cos(v.h), L = [[1.6, 0], [-1.6, 0]], hl = S.L / 2 + 0.45;
  for (const q of [[1.6, 1.2], [-1.6, 1.2], [1.6, -1.2], [-1.6, -1.2], [0, hl], [0, -hl]]) L.push(q);
  for (let r = Math.max(2.4, hl); r < 14; r += 1) for (let n = 0; n < 16; n++) L.push([Math.cos(n * Math.PI / 8) * r, Math.sin(n * Math.PI / 8) * r]);
  for (let pass = 0; pass < 2; pass++) for (const [lx, lz] of L) {
    const x = v.x + lx * ch + lz * sh, z = v.z - lx * sh + lz * ch, feet = H.surface(x, z, v.y + 0.5);
    if (pass === 0 && (Math.abs(feet - v.y) > 2.5 || rayCam(v.x, v.z, x, z, feet + 1) < 1)) continue;
    if (inBuilding(x, z, 0.4)) continue;
    const c = capsuleFree(x, z, feet, 0.3, 0.4); if (!c || (pass === 1 && c === 'suolo')) return [x, z];
  }
  return [v.x + ch * 1.6, v.z - sh * 1.6];
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

// ---------------------------------------------------------------- slopes and walls of the ground, and what a car comes down on (Carlo, 6/11)
// The same for every vehicle and every place. Gravity pulls along the slope whole. Up to PENDIO.presa degrees the wheels hold (engine, brakes,
// steering, grip across); from there to presa + sfuma they lose it, and past that the car is a sled: no engine, no brakes, it slides down the
// way the ground falls. Ground rising steeper than PENDIO.muro in front of the car, over its floor, is a wall: it stops it as the walls do.
// A thing the car comes down on from above (its underside was over its top) is a floor: the car rests on it, it does not push it sideways; the
// barriers whose wall for cars is higher than drawn (yv: guardrails, the low fences) are never a floor, they push it off.
const PENDIO = {
  g: 9.81,         // m/s2 of gravity along the slope (it was 0.6 of it)
  presa: 35, sfuma: 5, // degrees: the wheels hold up to presa, none past presa + sfuma
  muro: 60,        // degrees: steeper ground ahead is a wall...
  passo: 0.3,      // ...read over this many m in front of the car's outline
  gradino: 0.3,    // m: and only where it rises over the car's floor by this (a kerb is climbed, as ever)
  appoggio: 0.6,   // a thing is a floor under a circle of the car when it is within this share of its radius from the centre (else it pushes it off)
};
function pendioTan(v) { // rise over run of the ground under the car: [along it, front up = +; across it, its right side up = +]. The player's vehicle reads it under each wheel
  const F = v.F; let tp = -Math.tan(v.slope || 0), tr = 0;
  if (F && !F.rig && F.n >= 4) {
    let gf = 0, nf = 0, gb = 0, nb = 0, zf = 0, zb = 0, gr = 0, nr = 0, gl = 0, nl = 0, xr = 0, xl = 0;
    for (let i = 0; i < F.n; i++) { const g = F.g[i]; if (F.sz[i] > 0) { gf += g; zf += F.sz[i]; nf++; } else { gb += g; zb += F.sz[i]; nb++; } if (F.sx[i] > 0) { gr += g; xr += F.sx[i]; nr++; } else { gl += g; xl += F.sx[i]; nl++; } }
    if (nf && nb && zf / nf - zb / nb > 0.3) tp = (gf / nf - gb / nb) / (zf / nf - zb / nb);
    if (nr && nl && xr / nr - xl / nl > 0.3) tr = (gr / nr - gl / nl) / (xr / nr - xl / nl);
  }
  return [tp, tr];
}
function pendioPresa(v) { // the share of grip the wheels have on this slope, 1 to 0; v.pendLat: the pull of gravity across the car that the wheels no longer hold (m/s2, to its right +)
  const [tp, tr] = pendioTan(v), deg = Math.atan(Math.hypot(tp, tr)) * 180 / Math.PI, t = clamp((deg - PENDIO.presa) / PENDIO.sfuma, 0, 1), k = 1 - t * t * (3 - 2 * t);
  v.pendLat = -PENDIO.g * Math.sin(Math.atan(tr)) * (1 - k); v.presa = k; return k;
}
function pendioMuro(v, x0, z0) { // the ground as a wall, on the car's way (x0, z0: where it was before the step). Takes the move into it back; the outward normal, or null
  const dx = v.x - x0, dz = v.z - z0, d = hyp(dx, dz); if (!(d > 1e-4) || d > 8) return null;
  const ux = dx / d, uz = dz / d, p = PENDIO.passo, tg = Math.tan(PENDIO.muro * Math.PI / 180) * p, cy = v.y + 0.5; let out = null;
  const fx = Math.sin(v.h), fz = Math.cos(v.h), sd = fx * ux + fz * uz >= 0 ? 1 : -1, hl = v.spec.L / 2 * sd, hw = v.spec.W / 2, lead = v.circles().map(c => [c[0] + ux * v.rad, c[1] + uz * v.rad]);
  for (const k of [-1, 1]) lead.push([v.x + fx * hl + fz * hw * k, v.z + fz * hl - fx * hw * k]); /* and the two corners in front, the way it goes */
  for (const [lx, lz] of lead) {
    const g0 = H.surface(lx, lz, cy), g1 = H.surface(lx + ux * p, lz + uz * p, cy);
    if (g1 - g0 < tg || g1 < v.y + PENDIO.gradino) continue;
    const e = 0.2, mx = lx + ux * p / 2, mz = lz + uz * p / 2, gx = H.surface(mx + e, mz, cy) - H.surface(mx - e, mz, cy), gz = H.surface(mx, mz + e, cy) - H.surface(mx, mz - e, cy), gl = hyp(gx, gz) || 1;
    let nx = -gx / gl, nz = -gz / gl; if (nx * ux + nz * uz > -0.2) { nx = -ux; nz = -uz; } /* the face looks back at the car */
    const into = (v.x - x0) * nx + (v.z - z0) * nz; if (into < 0) { v.x -= nx * into; v.z -= nz * into; }
    out = [nx, nz];
  }
  if (out) v.muri = (v.muri || 0) + 1;
  return out;
}
// what the car comes down on: the colliders under its circles that its underside was over. They are left out of the push (skip) and their tops
// raise the ground of the axle over them (lev[0] front, lev[1] back), so the springs take the car on them as on a step of the ground
function vehAppoggio(v) {
  const belly = v.spec.wr * 0.9, under = v.y + belly, cs = v.circles(), lev = [-Infinity, -Infinity], was = v.appoggi; let skip = null;
  for (let k = 0; k < 2; k++) {
    const [x, z] = cs[k], R = v.rad;
    WALLS.each(x - R - 1, z - R - 1, x + R + 1, z + R + 1, s => {
      if (s.off || (s.dyn && !s.on) || s.y1 === undefined || s.yv !== undefined) return;
      if ((under < s.y1 - 0.05 && !(was && was.has(s))) || v.y + vehMaxTop(v) < s.y0) return; // (it was not over it, nor resting on it)
      const d = s.r ? hyp(x - s.x, z - s.z) - s.r : segDist(x, z, s.ax, s.az, s.bx, s.bz); if (d >= R) return;
      if (d < R * PENDIO.appoggio) { lev[k] = Math.max(lev[k], s.y1 - belly); (skip || (skip = new Set())).add(s); }
    });
  }
  v.appoggi = skip; v.lev = skip ? lev : null; // fisGround: the wheels of an axle over it stand on it
  return { skip, lev };
}

// the body never goes into the ground (Carlo, 6/11: on a steep bank the car went into it): the four corners of its underside, at the bumpers,
// are stops of their own. A corner under the ground lifts the body there at once, all of it, and takes the speed into the ground away: the
// car rests on its bumper or its floor and turns about it, as the springs do on a wheel at the end of its travel
const SCOCCA = { largo: 0.95, gioco: 0.01, giri: 2 }; // share of the width the corners are at; m a corner may be in the ground; rounds
function fisScocca(v) {
  const F = v.F, S = v.spec, belly = S.wr * 0.9, hw = S.W / 2 * SCOCCA.largo, hl = S.L / 2, sh = Math.sin(v.h), ch = Math.cos(v.h);
  for (let it = 0; it < SCOCCA.giri; it++) {
    let any = false;
    for (const sx of [-hw, hw]) for (const sz of [-hl, hl]) {
      const sr = Math.sin(v.ar), cr = Math.cos(v.ar), sp = Math.sin(v.ap), cp = Math.cos(v.ap), X = sx * cr - belly * sr, Y1 = sx * sr + belly * cr, Z = Y1 * sp + sz * cp; /* the corner as drawn (yaw, nose, roll: YXZ) */
      const x = v.x + ch * X + sh * Z, z = v.z - sh * X + ch * Z, py = v.y + Y1 * cp - sz * sp, over = H.surface(x, z, py + 0.5) - py;
      if (over <= SCOCCA.gioco) continue; any = true;
      const w = 1 + sx * sx / F.Ir + sz * sz / F.Ip, rel = -(v.vy + sx * v.wr - sz * v.wp);
      if (rel > 0) { const j = rel / w; v.vy += j; v.wr += j * sx / F.Ir; v.wp -= j * sz / F.Ip; }
      const q = over / w; v.y += q; v.ar += q * sx / F.Ir; v.ap -= q * sz / F.Ip;
    }
    if (!any) break;
  }
}
