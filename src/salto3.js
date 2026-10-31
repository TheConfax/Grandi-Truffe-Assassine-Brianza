// ---------------------------------------------------------------- jumping and climbing on foot (Carlo, 31/10)
// The square button jumps; near something low enough it goes over it or up on it instead, never without the press. What can be climbed comes from
// what the world already knows (WALLS, VEH), with no places written anywhere: a two-sided barrier up to SALTO.maxBar over the ground the walker
// stands on, a stopped car, and the street objects tagged in their spec (sali: stand on it; scav: go over it). Everything else stays a wall:
// buildings, doors, bridge parapets, ramps, and walls higher than maxBar (the data have no holds on walls, so those are not climbed).
// A climb is planned before it starts and only if its whole path is free: capsuleFree is asked at every step of the rise, of the way across and of
// the drop, against all that stops the walker, at the height the feet will have there. So nothing has to be excepted: a barrier is passed because
// the feet are above it. If no path is free the press is a plain jump.
// Every number of the jump and of the climb is here.
const SALTO = {
  grav: 14, jumpH: 1.05, carry: 0.92, airAcc: 7, buffer: 0.14, // m/s2 (22 was the knock-down, 9.81 looks slow in a game), apex in m, speed kept at take-off, control in the air, how long a press waits for the ground
  stepUp: 0.45, dropOff: 0.35, // on foot: what is walked up onto a perch at once; a drop over this is a fall, under it the feet follow the ground
  landT: 0.24, landDip: 0.14, landSlow: 0.45, heavyV: 6, // the bend at landing: time, how far the body goes down, the speed lost after a fall faster than heavyV m/s
  maxBar: 2.6, reach: 1.15, reachV: 0.16, cone: 0.5, // highest barrier or perch over the ground (m, "about 2.5"); how far an obstacle is taken at a standstill, plus per m/s of run-up; cosine of the half cone ahead
  camV: 15, camHold: 0.4, airPush: 0.4, // the camera during a gesture and just after it moves round him at most camV m/s; a push in the air moves him at most airPush m a step
  roofKmh: 30, // on a car's roof he stays up to this speed (km/h); over it he is thrown off to the side, no damage (Carlo, 31/10)
  vehMaxV: 1.5, boxR: 0.32, lip: 0.3, // a car moving faster than this is not climbed
  gap: 0.42, landL: [0.55, 0.8, 1.1, 1.5], clear: 0.06, r: 0.3, rLand: 0.4, head: 1.75, // where the hands go from, how far past it he comes down (first free), over the top by, body radius on the way and landing, body height
  lowH: 1.35, hoist: 2.0, // up to lowH a hop with the hands on top; over it a jump to hang from the top by the hands (feet hoist m under it), then a pull up
  tHopMin: 0.16, tHopK: 0.11, tJump: 0.2, tHold: 0.1, tPullK: 0.3, tOver: 0.22, tStand: 0.16, vOver: 5.5, fastK: 0.8, exitV: 1.5, exitK: 0.6, // seconds; with a run-up everything takes fastK of the time; speed off the far side
};
function isBarrier(s) { return s.ax !== undefined && s.two && !s.off && !s.deckw && !s.door && !s.mf && s.pit === undefined && (!s.dyn || s.on); }

// ---- cars as solids and floors: the boxes makeCar draws. Heights over v.y
function vehLocal(v, x, z) { const dx = x - v.x, dz = z - v.z, s = Math.sin(v.h), c = Math.cos(v.h); return [dx * c - dz * s, dx * s + dz * c]; } // [side, along]
function vehWorld(v, lx, lz) { const s = Math.sin(v.h), c = Math.cos(v.h); return [v.x + lx * c + lz * s, v.z - lx * s + lz * c]; }
function vehUpper(v) { const S = v.spec; return S.van ? [S.W / 2, -0.475, S.L / 2 - 0.475] : [S.cab[0] / 2, S.cab[3], S.cab[2] / 2]; } // the cab: half side, centre along, half along
function vehCan(v) { return !v.spec.two && !v.spec.ape && !v.air; }
function vehMinTop(v) { const S = v.spec; return S.two ? 1 : S.ape ? 1.2 : S.van ? 1.23 : S.wr * 0.9 + S.bh; }
function vehMaxTop(v) { const S = v.spec; return S.two ? 1.2 : S.ape ? 1.7 : S.van ? 2.19 : S.wr * 0.9 + S.bh + S.cab[1]; }
function vehTopAt(v, lx, lz) { // the top under a point of the car, else null
  const S = v.spec; if (S.two || S.ape || Math.abs(lx) > S.W / 2 || Math.abs(lz) > S.L / 2) return null;
  if (S.van) return lz > S.L / 2 - 0.95 ? 1.23 : 2.19;
  const b = S.wr * 0.9 + S.bh, [cw, ch, cl, cz] = S.cab; return Math.abs(lx) < cw / 2 && Math.abs(lz - cz) < cl / 2 ? b + ch : b;
}
// the boxes of a car, a body and a cab (makeCar): the one that the height y is inside and the point within r of, as [half side, centre along, half along], else null
function vehBox(v, x, z, y, r) {
  const S = v.spec, [lx, lz] = vehLocal(v, x, z), hw = S.W / 2, hl = S.L / 2;
  if (S.two || S.ape) return y < v.y + vehMaxTop(v) && Math.abs(lx) < hw + r && Math.abs(lz) < hl + r ? [hw, 0, hl] : null;
  if (y < v.y + vehMinTop(v) && Math.abs(lx) < hw + r && Math.abs(lz) < hl + r) return [hw, 0, hl];
  const [cw, cz, cl] = vehUpper(v);
  return y < v.y + vehMaxTop(v) && Math.abs(lx) < cw + r && Math.abs(lz - cz) < cl + r ? [cw, cz, cl] : null;
}
function footVehBoxes() { // the circles of the car are rounder than the car: its corners and its cab push him out too
  for (const v of VEH) {
    if (Math.abs(v.x - P.x) > 5 || Math.abs(v.z - P.z) > 5 || P.y + 1.7 < v.y) continue;
    const b = vehBox(v, P.x, P.z, P.y + 0.05, SALTO.boxR); if (!b) continue;
    const [lx, lz] = vehLocal(v, P.x, P.z), px = b[0] + SALTO.boxR - Math.abs(lx), pz = b[2] + SALTO.boxR - Math.abs(lz - b[1]);
    const [x, z] = px < pz ? vehWorld(v, Math.sign(lx || 1) * (b[0] + SALTO.boxR), lz) : vehWorld(v, lx, b[1] + Math.sign(lz - b[1] || 1) * (b[2] + SALTO.boxR)); P.x = x; P.z = z;
  }
}
function saltoAbove(v) { return v === P.onV || (P.climb && P.climb.v === v) || P.y >= v.y + vehMinTop(v) - 0.1; } // over it: the car does not push him

// ---- is a body with its feet at this height free here? null if so, else what is in the way. tol: walls lower than that over the feet do not count, as for the walker
function capsuleFree(x, z, feet, r = SALTO.r, tol = 0.02, head = SALTO.head) {
  if (Math.abs(x) > LIM_X || Math.abs(z) > LIM_Z) return 'limite';
  if (H.surface(x, z) > feet + Math.max(tol, 0.02) + 0.02) return 'suolo';
  let hit = null;
  WALLS.each(x - r - 1, z - r - 1, x + r + 1, z + r + 1, s => {
    if (hit || s.off || (s.dyn && !s.on)) return;
    if (s.y0 !== undefined && (feet + tol >= s.y1 || feet + head <= s.y0)) return;
    if (s.r) { if (hyp(x - s.x, z - s.z) < r + s.r) hit = s; return; }
    if (segDist(x, z, s.ax, s.az, s.bx, s.bz) < r) hit = s;
  });
  if (hit) return hit;
  if (inBuilding(x, z, 0)) return 'edificio';
  if (ceilAbove(x, z, feet - 0.1) < feet + head) return 'soffitto';
  for (const o of H.deckAt(x, z)) if (o.top > feet + Math.max(tol, 0.3) && (o.bot !== undefined ? o.bot : o.top - 0.6) < feet + head) return 'soletta';
  for (const v of VEH) if (Math.abs(v.x - x) < 6 && Math.abs(v.z - z) < 6 && feet + head > v.y && vehBox(v, x, z, feet + tol, r)) return v;
  return null;
}

// ---- the floor under the feet: the ground and the decks (H.surface), a car, a street object with a top. reach: how far above the feet a top is taken
let saltoFV = null;
function footFloor(x, z, feet, reach, inAir) {
  let y = H.surface(x, z, inAir ? feet - 0.5 : feet); saltoFV = null;
  WALLS.each(x - 1.5, z - 1.5, x + 1.5, z + 1.5, s => { const q = s.sali; if (q && !s.off && (!s.dyn || s.on) && q.top <= feet + reach && q.top > y && hyp(x - s.x, z - s.z) < q.rs) y = q.top; });
  for (const v of VEH) {
    if (Math.abs(v.x - x) > 4 || Math.abs(v.z - z) > 4 || !vehCan(v)) continue;
    const [lx, lz] = vehLocal(v, x, z), S = v.spec, m = SALTO.lip; // past the edge by less than the body's own width the feet are still on it: he does not slip into a gap he would not fit in
    if (Math.abs(lx) > S.W / 2 + m || Math.abs(lz) > S.L / 2 + m) continue;
    const low = v.y + vehMinTop(v); if (low > y && low <= feet + reach) { y = low; saltoFV = v; }
    const [cw, cz, cl] = vehUpper(v), up = v.y + vehMaxTop(v); if (Math.abs(lx) < cw + m && Math.abs(lz - cz) < cl + m && up > y && up <= feet + reach) { y = up; saltoFV = v; }
  }
  return y;
}
function ceilOver(x, z, feet) { // the head meets something
  if (ceilAbove(x, z, feet + 0.5) < feet + SALTO.head) return true;
  for (const o of H.deckAt(x, z)) if (o.top > feet + 0.3 && (o.bot !== undefined ? o.bot : o.top - 0.6) < feet + SALTO.head) return true;
  return false;
}

// ---- the plan
function saltoAcross(ax, az, bx, bz, y, r) { // free all the way at height y? null or what stops it
  const L = hyp(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.15));
  for (let i = 0; i <= n; i++) { const q = capsuleFree(ax + (bx - ax) * i / n, az + (bz - az) * i / n, y, r); if (q) return q; }
  return null;
}
function saltoRise(x, z, y0, y1, r) { for (let y = y0 + 0.02; ; y += 0.3) { const yy = Math.min(y, y1), q = capsuleFree(x, z, yy, r, y0 === yy - 0.02 ? 0.4 : 0.02); if (q) return q; if (yy >= y1) return null; } }
// from the walker to the place the hands go from: is it free?
function saltoStart(c) {
  const d = hyp(c.sx - P.x, c.sz - P.z); if (d < 0.02) return true; if (P.air && d > 0.9) return false;
  return !saltoAcrossTol(P.x, P.z, c.sx, c.sz, P.y);
}
function saltoAcrossTol(ax, az, bx, bz, y) { const L = hyp(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / 0.15)); for (let i = 0; i <= n; i++) { const qx = ax + (bx - ax) * i / n, qz = az + (bz - az) * i / n; if (capsuleFree(qx, qz, Math.max(y, H.surface(qx, qz, y)), SALTO.r, 0.4)) return true; } return false; }

function planOver(c, g) { // over something and down the far side. c: sx, sz the start, nx, nz the way across, span how far from the start to the far edge, top
  const Sx = c.sx, Sz = c.sz; let top = c.top;
  if (!saltoStart(c)) return null;
  for (const L of SALTO.landL) {
    const ex = Sx + c.nx * (c.span + L), ez = Sz + c.nz * (c.span + L);
    for (let k = 0; k < 4; k++) {
      const y = top + SALTO.clear;
      const q = saltoRise(Sx, Sz, Math.min(P.y, y), y, SALTO.r) || saltoAcross(Sx, Sz, ex, ez, y, SALTO.r);
      if (!q) {
        const fl = footFloor(ex, ez, y, 0.02, true), drop = saltoRise(ex, ez, fl, y, SALTO.rLand);
        if (drop || inWater(ex, ez, fl) || inBuilding(ex, ez, SALTO.rLand)) break;
        return { sx: Sx, sz: Sz, ex, ez, y, stand: false, gx: c.gx, gz: c.gz, top, h: Math.atan2(c.nx, c.nz), nx: c.nx, nz: c.nz, v: null };
      }
      if (q.ax !== undefined && isBarrier(q) && q.y1 > top && q.y1 - g <= SALTO.maxBar) { top = q.y1; continue; } // the next piece of the same barrier, a little higher
      break;
    }
  }
  return null;
}
function planOn(c, g) { // up onto something and stay there. c: sx, sz, ex, ez, top (the highest on the way), endY, v
  if (!saltoStart(c)) return null;
  const y = c.top + SALTO.clear;
  if (saltoRise(c.sx, c.sz, Math.min(P.y, y), y, SALTO.r) || saltoAcross(c.sx, c.sz, c.ex, c.ez, y, SALTO.r)) return null;
  if (capsuleFree(c.ex, c.ez, c.endY, SALTO.r, 0.05)) return null;
  const L = hyp(c.ex - c.sx, c.ez - c.sz) || 1;
  return { sx: c.sx, sz: c.sz, ex: c.ex, ez: c.ez, y, stand: true, endY: c.endY, gx: c.gx, gz: c.gz, top: c.top, h: Math.atan2(c.ex - c.sx, c.ez - c.sz), nx: (c.ex - c.sx) / L, nz: (c.ez - c.sz) / L, v: c.v || null };
}
// what is ahead and could be taken, best first
function tryClimb() {
  const S = SALTO, stick = Math.hypot(GP.steer, GP.fwd) > 0.15 && padLat, dh = stick ? padTgt : P.h, dx = Math.sin(dh), dz = Math.cos(dh), sp = hyp(P.vx, P.vz), reach = S.reach + sp * S.reachV, g = H.surface(P.x, P.z, P.y), cs = [], seen = new Set();
  const ahead = (qx, qz, d) => d < 0.15 ? 1 : ((qx - P.x) * dx + (qz - P.z) * dz) / d;
  WALLS.each(P.x - reach - 1, P.z - reach - 1, P.x + reach + 1, P.z + reach + 1, s => {
    if (seen.has(s)) return; seen.add(s);
    if (s.r) { // a street object
      if ((!s.sali && !s.scav) || s.off || (s.dyn && !s.on)) return;
      const top = s.sali ? s.sali.top : s.y1, d0 = hyp(s.x - P.x, s.z - P.z), d = d0 - s.r; if (d > reach || top - g > S.maxBar || top <= P.y + 0.1 || d0 < 1e-3) return;
      const dot = ahead(s.x, s.z, d0); if (dot < S.cone) return;
      const nx = (s.x - P.x) / d0, nz = (s.z - P.z) / d0, st = Math.min(d0, s.r + S.gap), sx = s.x - nx * st, sz = s.z - nz * st;
      cs.push({ d, dot, top, sx, sz, gx: s.x - nx * s.r * 0.6, gz: s.z - nz * s.r * 0.6, ...(s.sali ? { on: true, ex: s.x - nx * s.sali.rs * 0.4, ez: s.z - nz * s.sali.rs * 0.4, endY: top } : { nx, nz, span: st + s.r }) });
      return;
    }
    if (!isBarrier(s)) return;
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez; if (L2 < 1e-6) return;
    const t = clamp(((P.x - s.ax) * ex + (P.z - s.az) * ez) / L2, 0, 1), cx = s.ax + ex * t, cz = s.az + ez * t, d = hyp(cx - P.x, cz - P.z);
    if (d > reach || s.y1 - g > S.maxBar || s.y1 <= P.y + 0.1) return;
    const dot = ahead(cx, cz, d); if (dot < S.cone) return;
    const L = Math.sqrt(L2); let nx = ez / L, nz = -ex / L; if ((cx - P.x) * nx + (cz - P.z) * nz + (d < 0.05 ? dx * nx + dz * nz : 0) < 0) { nx = -nx; nz = -nz; }
    const st = Math.min(d, S.gap), sx = cx - nx * st, sz = cz - nz * st; // never a step back from where he stands
    cs.push({ d, dot, top: s.y1, sx: d < S.gap ? P.x : sx, sz: d < S.gap ? P.z : sz, gx: cx, gz: cz, nx, nz, span: st });
  });
  for (const v of VEH) { // a car: from the side onto the roof, from either end onto bonnet or boot
    if (Math.abs(v.x - P.x) > 8 || Math.abs(v.z - P.z) > 8 || !vehCan(v) || v.speed > S.vehMaxV || v === P.onV) continue;
    const Sp = v.spec, hw = Sp.W / 2, hl = Sp.L / 2, [lx, lz] = vehLocal(v, P.x, P.z), qx = clamp(lx, -hw, hw), qz = clamp(lz, -hl, hl), [wx, wz] = vehWorld(v, qx, qz), d = hyp(wx - P.x, wz - P.z);
    if (d > reach || v.y + vehMaxTop(v) - g > S.maxBar || v.y + vehMinTop(v) <= P.y + 0.1) continue;
    const dot = ahead(wx, wz, d); if (dot < S.cone) continue;
    const side = Math.abs(lx) > hw - 0.05 && Math.abs(lz) < hl - 0.05;
    let tx, tz; if (side) { tx = Math.sign(lx || 1) * Math.min(hw - 0.5, 0.3); tz = clamp(lz, -hl + 0.5, hl - 0.5); } else { tx = clamp(lx, -hw + 0.35, hw - 0.35); tz = Math.sign(lz || 1) * (hl - 0.55); }
    const endT = vehTopAt(v, tx, tz); if (endT === null) continue;
    const st = Math.min(d, S.gap), nx = d > 1e-3 ? (wx - P.x) / d : dx, nz = d > 1e-3 ? (wz - P.z) / d : dz, [ex, ez] = vehWorld(v, tx, tz), sx = d < S.gap ? P.x : wx - nx * st, sz = d < S.gap ? P.z : wz - nz * st;
    let topT = endT; for (let k = 0; k <= 6; k++) { const q = vehTopAt(v, qx + (tx - qx) * k / 6, qz + (tz - qz) * k / 6); if (q !== null && q > topT) topT = q; }
    cs.push({ d, dot, on: true, top: v.y + topT, sx, sz, ex, ez, endY: v.y + endT, gx: wx, gz: wz, v });
  }
  cs.sort((a, b) => (a.d - a.dot * 0.5) - (b.d - b.dot * 0.5));
  for (let i = 0; i < cs.length && i < 6; i++) { const p = cs[i].on ? planOn(cs[i], g) : planOver(cs[i], g); if (p) { saltoStartClimb(p, sp); return true; } }
  return false;
}
function saltoStartClimb(p, sp) {
  const S = SALTO, h = p.y - Math.min(P.y, p.y), fast = sp > 3 ? S.fastK : 1, low = p.top - P.y <= S.lowH;
  p.run = hyp(p.sx - P.x, p.sz - P.z) / Math.max(sp, 3.5);
  if (low) { p.tRise = (S.tHopMin + S.tHopK * h) * fast; p.tHold = 0; p.tPull = 0; p.yHang = null; }
  else { p.tRise = S.tJump * fast; p.tHold = S.tHold * fast; p.yHang = Math.max(P.y, p.y - S.hoist); p.tPull = S.tPullK * Math.max(0.4, p.y - p.yHang) * fast; }
  p.tOver = Math.max((p.stand ? S.tStand : S.tOver) * fast, hyp(p.ex - p.sx, p.ez - p.sz) / S.vOver); p.t = 0; p.sp = sp; p.x0 = P.x; p.z0 = P.z; p.y0 = P.y; p.h0 = P.h; p.low = low;
  if (p.v) { p.lv = vehLocal(p.v, p.ex, p.ez); }
  P.climb = p; P.air = false; P.vy = 0; P.onV = null; P.land = 0; P.jumpReq = 0; P.vx = P.vz = 0; P.speedNow = 0; P.climbN = (P.climbN || 0) + 1;
}
const smooth01 = t => t * t * (3 - 2 * t);
function climbStep(dt) {
  const S = SALTO, c = P.climb;
  if (c.v && (c.v.speed > S.vehMaxV + 0.5 || VEH.indexOf(c.v) < 0)) { P.climb = null; P.air = true; P.vy = 0; return; } // it drove off
  if (c.v) { const [ex, ez] = vehWorld(c.v, c.lv[0], c.lv[1]); c.ex = ex; c.ez = ez; }
  c.t += dt; P.h = wrapA(P.h + wrapA(c.h - P.h) * (1 - Math.exp(-14 * dt)));
  let t = c.t;
  if (t < c.run) { const k = t / c.run; P.x = c.x0 + (c.sx - c.x0) * k; P.z = c.z0 + (c.sz - c.z0) * k; if (c.y0 < H.surface(P.x, P.z, c.y0) + 0.4) P.y = H.surface(P.x, P.z, P.y); c.y0r = P.y; P.phase += c.sp * dt * 3; c.ph = 0; return; }
  if (c.y0r === undefined) c.y0r = P.y; t -= c.run; P.x = c.sx; P.z = c.sz;
  const y0 = c.y0r, T1 = c.tRise, T2 = T1 + c.tHold, T3 = T2 + c.tPull, T4 = T3 + c.tOver;
  if (t < T1) { c.ph = 1; P.y = y0 + ((c.yHang !== null ? c.yHang : c.y) - y0) * smooth01(t / T1); return; }
  if (t < T2) { c.ph = 2; P.y = c.yHang; return; }
  if (t < T3) { c.ph = 3; P.y = c.yHang + (c.y - c.yHang) * smooth01((t - T2) / c.tPull); return; }
  if (t < T4) { c.ph = 4; const k = smooth01((t - T3) / c.tOver); P.x = c.sx + (c.ex - c.sx) * k; P.z = c.sz + (c.ez - c.sz) * k; P.y = c.y + (c.stand ? (c.endY - c.y) * k : 0); return; }
  P.x = c.ex; P.z = c.ez; P.climb = null;
  if (c.stand) { P.y = c.endY; P.air = false; P.onV = c.v; P.land = S.landT * 0.6; P.landK = 0.6; P.vx = P.vz = 0; }
  else { const sp = Math.max(S.exitV, c.sp * S.exitK); P.air = true; P.vy = 0; P.vx = c.nx * sp; P.vz = c.nz * sp; }
}

// ---- the walker's vertical: called before he moves
function footVert(dt) {
  const S = SALTO;
  if (P.jumpReq > 0) {
    P.jumpReq -= dt;
    if (tryClimb()) return;
    if (!P.air) { P.jumpReq = 0; P.air = true; P.onV = null; P.land = 0; P.vy = Math.sqrt(2 * S.grav * S.jumpH); P.vx *= S.carry; P.vz *= S.carry; P.jumps = (P.jumps || 0) + 1; P.y += 0.001; }
  }
  if (P.air) {
    P.vy -= S.grav * dt; if (P.vy > 0 && ceilOver(P.x, P.z, P.y + P.vy * dt)) P.vy = 0;
    const fl = footFloor(P.x, P.z, P.y, 0.3, true), ny = P.y + P.vy * dt;
    if (ny <= fl && P.vy <= 0) { const hard = -P.vy > S.heavyV; P.y = fl; P.air = false; P.onV = saltoFV; P.land = S.landT; P.landK = hard ? 1 : Math.min(1, 0.4 + -P.vy / S.heavyV * 0.5); P.heavy = hard; P.vy = 0; P.speedAir = 0; }
    else P.y = Math.max(ny, H.surface(P.x, P.z));
  } else {
    if (P.land > 0) P.land = Math.max(0, P.land - dt);
    const fl = footFloor(P.x, P.z, P.y, S.stepUp, false);
    if (fl < P.y - S.dropOff) { P.air = true; P.vy = 0; P.onV = null; }
    else { const wasOn = P.onV; P.onV = saltoFV; P.y = P.onV && P.onV === wasOn ? P.y + clamp(fl - P.y, -5 * dt, 5 * dt) : fl; }
  }
}
// riding what he stands on: a stopped or moving car carries him. At the start of the step, from where he stood on it
function footRide() {
  const v = P.onV; if (!v) return;
  if (VEH.indexOf(v) < 0 || P.mode !== 'foot') { P.onV = null; if (P.mode === 'foot') { P.air = true; P.vy = 0; } return; }
  if (Math.abs(v.speed) * 3.6 > SALTO.roofKmh && footThrow(v)) return;
  if (P.onL) { const [x, z] = vehWorld(v, P.onL[0], P.onL[1]); P.x = x; P.z = z; P.h = wrapA(P.h + wrapA(v.h - P.onL[2])); }
}
function footThrow(v) { // too fast to stay on: down on the nearest free ground at the side of the car, falling from where he stood (no fall damage is done in the game)
  const [lx, lz] = vehLocal(v, P.x, P.z), S = v.spec, sd = Math.sign(lx || 1), al = clamp(lz, -S.L / 2, S.L / 2);
  for (let d = S.W / 2 + SALTO.rLand + 0.15; d < S.W / 2 + 3.5; d += 0.35) for (const q of [sd, -sd]) {
    const [x, z] = vehWorld(v, q * d, al), g = H.surface(x, z, P.y); if (g > P.y + 0.2 || inWater(x, z, g) || inBuilding(x, z, SALTO.rLand) || capsuleFree(x, z, g, SALTO.rLand, 0.05)) continue;
    P.x = x; P.z = z; P.air = true; P.vy = 0; P.vx = P.vz = 0; P.onV = null; P.onL = null; P.land = 0; P.thrown = (P.thrown || 0) + 1; return true;
  }
  return false;
}
function footRideEnd() { if (P.onV) { const [lx, lz] = vehLocal(P.onV, P.x, P.z); P.onL = [lx, lz, P.onV.h]; } else P.onL = null; }
// the move through a wall never happens, whoever asks for it (his steps, the push of a wall from behind, a car, a knock): between where he was and where he would be
function saltoCrosses(ax, az, bx, bz, y0, y1) {
  let hit = false; const dx = bx - ax, dz = bz - az; if (Math.abs(dx) + Math.abs(dz) < 1e-6) return false;
  WALLS.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), s => {
    if (hit || s.r || s.off || (s.dyn && !s.on)) return;
    if (s.y0 !== undefined && (y1 < s.y0 || y0 > s.y1)) return;
    const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return;
    const t = ((s.ax - ax) * ez - (s.az - az) * ex) / den, u = ((s.ax - ax) * dz - (s.az - az) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) hit = true;
  });
  return hit;
}
function footCollide() { // the walls push him out, feet and head when he is off the ground
  const pp = { x: P.x, z: P.z }; let air = P.air || P.knock > 0;
  for (let i = 0; i < 2; i++) { if (air) { collideStatic(pp, 0.4, P.y + 0.05); collideStatic(pp, 0.4, P.y + 1.7); } else collideStatic(pp, 0.4, P.y + 0.4); } // twice: in a sharp corner the second wall pushes him back into the first
  P.x = clamp(pp.x, -LIM_X, LIM_X); P.z = clamp(pp.z, -LIM_Z, LIM_Z);
}
const saltoLowBar = s => isBarrier(s) && s.y1 - (P.yg !== undefined ? P.yg : P.y) <= SALTO.maxBar + 0.8;
function footGuard(x0, y0, z0, mx, mz) { // last word of the step. x0, y0, z0 where he was, mx, mz where his own step took him before any push
  footVehBoxes(); footGuardXZ(x0, z0, mx, mz); const g = H.surface(P.x, P.z); if (P.y < g) P.y = g; // never under the ground he moved onto
  // and never in a solid he was not in: squeezed in a gap (a car and a tree, two cars) the pushes can only go round. Back where he was free, at this height or at the last one
  const tol = P.air || P.knock > 0 ? 0.06 : 0.4, inS = (x, z, y) => { const q = capsuleFree(x, z, y, 0.25, tol); return q && q !== 'suolo' && (P.air || P.knock > 0 || (q !== 'soffitto' && q !== 'soletta')) && q !== 'limite'; };
  if (!inS(P.x, P.z, P.y)) return;
  if (!inS(x0, z0, P.y)) { P.x = x0; P.z = z0; P.vx = P.vz = 0; P.guardN = (P.guardN || 0) + 1; }
  else if (!inS(x0, z0, y0)) { P.x = x0; P.z = z0; P.y = y0; P.vx = P.vz = P.vy = 0; P.guardN = (P.guardN || 0) + 1; }
}
function footGuardXZ(x0, z0, mx, mz) {
  const air = P.air || P.knock > 0, y0 = air ? P.y + 0.05 : P.y + 0.4, y1 = air ? P.y + 1.7 : y0, dd = hyp(P.x - mx, P.z - mz);
  if (air && dd > SALTO.airPush) { const k = SALTO.airPush / dd; P.x = mx + (P.x - mx) * k; P.z = mz + (P.z - mz) * k; } // in the air a push is a slide, not a pop
  const bad = (x, z) => saltoCrosses(x0, z0, x, z, y0, y1) || (inBuilding(x, z, 0) && !inBuilding(x0, z0, 0)) || (air && ceilOver(x, z, P.y) && !ceilOver(x0, z0, P.y)); // in the air also the edge of a deck, which has no wall
  if (!bad(P.x, P.z)) return;
  P.guardN = (P.guardN || 0) + 1;
  if (!bad(mx, mz)) { P.x = mx; P.z = mz; return; }
  P.x = x0; P.z = z0;
}
// the camera over a low barrier: rather than come in through the fence it looks over it, like a person would. The top of the barrier between him and the camera, else -Infinity
function barTopOnRay(ax, az, bx, bz) {
  let top = -Infinity; const dx = bx - ax, dz = bz - az;
  WALLS.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), s => {
    if (s.r || !saltoLowBar(s) || s.y1 <= top) return;
    const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return;
    const t = ((s.ax - ax) * ez - (s.az - az) * ex) / den, u = ((s.ax - ax) * dz - (s.az - az) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1) top = s.y1;
  });
  return top;
}

// ---- the gesture, with the model there is: hands on the top, a push, the legs over; a bend at landing
function saltoPose(m, dt, walkAmp) {
  const k = 1 - Math.exp(-24 * dt), c = P.climb, S = SALTO; let L = 0, R = 0, AL = 0, AR = 0, tilt = 0, dip = 0, spread = 0;
  if (c) {
    if (c.ph === 0 && c.t < c.run) { const s = Math.sin(P.phase) * walkAmp; L = s; R = -s; AL = -s * 0.8; AR = s * 0.8; }
    else {
      const fx = Math.sin(P.h), fz = Math.cos(P.h), dz = (c.gx - P.x) * fx + (c.gz - P.z) * fz, dy = c.top - (P.y + 1.44), pin = -Math.atan2(dz, -dy); // the arm from the shoulder to the top, as long as he is at it
      AL = AR = pin;
      if (c.ph === 1 || !c.ph) { L = -1.0; R = -0.2; tilt = 0.12; }
      else if (c.ph === 2) { L = -0.15; R = 0.1; tilt = 0.05; }
      else if (c.ph === 3) { L = -0.9; R = 0.15; tilt = 0.25; }
      else { L = c.stand ? -0.5 : 0.6; R = c.stand ? 0.2 : 0.2; tilt = c.stand ? 0.25 : 0.75; }
    }
  } else if (P.air) {
    if (P.vy > 0.5) { L = -0.9; R = 0.35; AL = -0.4; AR = 0.5; tilt = 0.08; }
    else { L = -0.3; R = 0.25; AL = -1.3; AR = -1.3; spread = 0.5; tilt = 0.02; }
  } else if (P.land > 0) {
    const q = Math.sin(Math.PI * Math.min(1, 1 - P.land / S.landT + 0.15)) * (P.landK || 0.6);
    dip = S.landDip * q; L = -0.75 * q; R = 0.45 * q; AL = AR = -0.5 * q; tilt = 0.3 * q;
    const s = Math.sin(P.phase) * walkAmp * (1 - q); L += s; R -= s; AL -= s * 0.8; AR += s * 0.8;
  } else { const s = Math.sin(P.phase) * walkAmp; L = s; R = -s; AL = -s * 0.8; AR = s * 0.8; }
  m.L.rotation.x += (L - m.L.rotation.x) * k; m.R.rotation.x += (R - m.R.rotation.x) * k; m.AL.rotation.x += (AL - m.AL.rotation.x) * k; m.AR.rotation.x += (AR - m.AR.rotation.x) * k;
  m.AL.rotation.z += (-spread - m.AL.rotation.z) * k; m.AR.rotation.z += (spread - m.AR.rotation.z) * k;
  m.inner.rotation.x += (tilt - m.inner.rotation.x) * k; m.inner.position.y += (-dip - m.inner.position.y) * k;
}
