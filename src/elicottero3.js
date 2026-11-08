// ---------------------------------------------------------------- the helicopter (a test one, Carlo 7/11): only the pad, stabilised flight
// The pad (pollPad): triangle in and out, R2 up, L2 down, L1/R1 turn on the spot, left stick tilts it (up = nose down, it goes forward; sideways it
// rolls and slides that way), right stick the camera, R3 looks back, d-pad left the radio as in the car. With the stick let go it levels by itself
// and tilts against its drift until it stands still in the air (hover); with no collective it holds its height. The physics is its own: the cars
// and the walkers keep theirs. It meets the ground, the roofs, the walls and the trees (the rotor too); a hard crash breaks it as a car breaks:
// smoke, fire, after a few seconds the explosion. It lands where it is level; on a slope it slides off. Object of P.car while flown (P.mode 'car'),
// so the camera, the radio, the map and the HUD follow it as they follow a car; it is not in VEH (traffic, police and the car physics do not see it)
const HELI = {
  spinUp: 3.5, spinDown: 7,          /* seconds for the rotor to reach full speed, and to stop */
  /* the numbers of a real light twin, the Airbus H135 of the air ambulances (Carlo 7/11: "un po' lento per essere un elicottero"): fast cruise 254 km/h = 70.5 m/s
     at full weight, climb 7.6 m/s (1500 ft/min) (airbus.com, H135 technical information; LPR, the Polish air ambulance). The sink is not in the data sheets: 6 m/s */
  tilt: 0.45, tiltK: 3.2,            /* most tilt from the stick (rad, 26 degrees: g tan = 4.7 m/s2 at the start), how fast the body follows it (1/s) */
  hold: 0.06, holdMax: 0.52,         /* stick let go: tilt against the drift (rad per m/s) and its cap: 30 degrees nose up, a quick stop (Carlo 7/11: it slid on for far too long) */
  drag1: 0.015, drag2: 0.00074,      /* air drag, linear and quadratic: full stick ends at 70.5 m/s, the H135's fast cruise */
  climb: 7.6, sink: 6, vyK: 1.8,     /* climb and sink speed at full R2/L2 (m/s), how fast the vertical speed follows (1/s) */
  yawRate: 1.4, yawK: 4,             /* turn on the spot with L1/R1 (rad/s) and its ease (1/s) */
  bankV0: 2, bankV1: 7, bankVmin: 5, /* autotimone (Carlo 7/11): banked, the nose goes into the turn in full (g tan(roll) / speed) from bankV0 to bankV1 m/s forward; bankVmin keeps the rate sane when slow */
  bankHi: 2, bankHiV0: 15, bankHiV1: 45, /* fast, the nose turns up to bankHi times the coordinated rate (half the radius at 45 m/s, Carlo 7/11), growing smoothly between these speeds (m/s forward); slow flight as before */
  grip: 4, gripV0: 4, gripV1: 10,   /* grip on the air: the speed across the nose dies at grip 1/s (2 % left after a second), from none at gripV0 to full at gripV1 m/s forward; the speed goes along the nose */
  skid: 5,                           /* on the ground the skids stop it (1/s) */
  landSafe: 5.5, landHs: 10,         /* touch down faster than this (m/s, down / across) and it gets damaged */
  rotorR: 4.8, rotorY: 2.35,         /* rotor radius, height of the rotor over the skids */
  flat: 0.55,                        /* highest minus lowest point under the skids (m) past which it slides off */
  maxAlt: 600,                       /* ceiling over terrain.base 0 */
  camK: 10, camS: 30, camPitchK: 0.8, /* camera: how fast it follows (1/s), the pace it goes back behind after the right stick (as a car at camS m/s), how fast the tilt from the right stick goes back (1/s) */
  camRoll: 0.3, camZen: 1.52,        /* the share of the bank the view leans with, the highest view (rad over the horizon: 87 degrees, straight over it) */
  camW0: 2, camW1: 10,               /* the view turns from the nose to the way it goes between these speeds (m/s) */
  fogAlt: 50,                        /* the fog's reach grows by one time its own every fogAlt metres of the view over the ground (past the first 15) */
  home: [[507.4, -479.2, 0]],        /* unico elicottero, punto scelto da Carlo il 7/11; i punti di spawn veri sono ancora da definire (behind the Medateca, via Gagarin, Meda; heading 0) */
};
const HELI_ZERO = { col: 0, yaw: 0, fwd: 0, side: 0 };
const HELIS = [];
const HELI_MAT = {
  body: new THREE.MeshLambertMaterial({ color: 0xe8e6e0 }), stripe: new THREE.MeshLambertMaterial({ color: 0x2c3e66 }),
  glass: new THREE.MeshLambertMaterial({ color: 0x1c2a36, emissive: 0x05080c }), dark: new THREE.MeshLambertMaterial({ color: 0x2a2a2a }),
  metal: new THREE.MeshLambertMaterial({ color: 0x8a8d90 }), disc: new THREE.MeshBasicMaterial({ color: 0x202020, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }),
};
/* the shape in blocks, as the cars: forward is +z, the skids touch y = 0 */
function heliMesh() {
  const g = new THREE.Group(); g.rotation.order = 'YXZ';
  const own = {}; for (const k in HELI_MAT) own[k] = HELI_MAT[k].clone(); /* its own paint: a wreck goes black alone */
  const box = (w, h, l, m, x, y, z, sh = true) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), m); o.position.set(x, y, z); o.castShadow = sh; g.add(o); return o; };
  box(1.5, 1.35, 2.5, own.body, 0, 1.25, 0);              /* cabin */
  box(1.42, 0.9, 0.9, own.glass, 0, 1.38, 1.55);          /* nose glass */
  box(1.3, 0.45, 0.85, own.body, 0, 0.78, 1.5);           /* chin */
  box(1.52, 0.18, 2.52, own.stripe, 0, 0.95, 0);          /* stripe */
  box(1.52, 0.6, 1.0, own.glass, 0, 1.55, 0.35);          /* side windows */
  box(1.1, 0.5, 1.4, own.body, 0, 2.1, -0.35);            /* engine fairing */
  box(0.34, 0.34, 4.4, own.body, 0, 1.55, -3.4);          /* tail boom */
  box(0.08, 1.05, 0.62, own.stripe, 0, 1.95, -5.45);      /* fin */
  box(1.3, 0.06, 0.4, own.stripe, 0, 1.55, -4.9);         /* stabiliser */
  for (const sx of [-0.78, 0.78]) {
    box(0.09, 0.09, 3.0, own.metal, sx, 0.05, 0.25);      /* skids */
    for (const sz of [-0.75, 0.95]) box(0.07, 0.6, 0.07, own.metal, sx * 0.9, 0.35, sz);
  }
  box(0.14, 0.3, 0.14, own.dark, 0, 2.45, 0, false);       /* mast */
  const rotor = new THREE.Group(); rotor.position.set(0, HELI.rotorY + 0.18, 0); g.add(rotor);
  for (const a of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(HELI.rotorR * 2, 0.05, 0.26), own.dark); b.rotation.y = a; b.castShadow = true; rotor.add(b); }
  const disc = new THREE.Mesh(new THREE.CircleGeometry(HELI.rotorR, 32).rotateX(-Math.PI / 2), own.disc); disc.position.y = HELI.rotorY + 0.18; g.add(disc);
  const tail = new THREE.Group(); tail.position.set(0.12, 1.9, -5.55); g.add(tail);
  for (const a of [0, Math.PI / 2]) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.3, 0.12), own.dark); b.rotation.x = a; tail.add(b); }
  scene.add(g);
  return { g, body: g, rotor, tail, disc, own };
}
function heliNew(x, z, h) {
  const e = {
    heli: true, kind: 'heli', spec: { name: 'Elicottero', two: false, pedal: false, L: 4, W: 1.6, snd: 1 },
    x, z, h, y: H.surface(x, z), vx: 0, vy: 0, vz: 0, yr: 0, pitch: 0, roll: 0, gp: 0, gr: 0, rs: 0, rotA: 0, tailA: 0,
    speed: 0, fwdSpeed: 0, health: 100, maxV: 70, drift: 0, boost: false, ko: false, driver: null, ground: true, alto: 0,
    inp: { thr: 0, brk: 0, steer: 0, hand: 0, col: 0, yaw: 0, fwd: 0, side: 0 }, home: [x, z, h], walls: [], wset: new Set(), rad: 1.3, co: 0,
    circles() { return [[this.x, this.z]]; }, /* what a car's code may ask of P.car */
  };
  e.m = heliMesh();
  /* what the others meet: four discs along the body (cars, walkers, the place to get out); the helicopter itself does not meet them */
  for (const [lz, r] of [[0.5, 1.0], [-1.0, 1.0], [-3.2, 0.45], [-5.0, 0.5]]) { const w = { r, x, z, y0: 0, y1: 0, lz, heliW: e, bb: null }; e.walls.push(w); e.wset.add(w); }
  heliWalls(e); HELIS.push(e); return e;
}
function heliWalls(e) {
  const fx = Math.sin(e.h), fz = Math.cos(e.h), rec0 = GRID_REC; GRID_REC = null;
  for (const w of e.walls) {
    if (w.bb) WALLS.del(w.bb[0], w.bb[1], w.bb[2], w.bb[3], w);
    if (e.gone) { w.bb = null; continue; }
    w.x = e.x + fx * w.lz; w.z = e.z + fz * w.lz; w.y0 = e.y - 0.3; w.y1 = e.y + 2.4;
    w.bb = [w.x - w.r, w.z - w.r, w.x + w.r, w.z + w.r]; WALLS.add(w.bb[0], w.bb[1], w.bb[2], w.bb[3], w);
  }
  GRID_REC = rec0;
}
function heliSetup() {
  for (const [x, z, h] of HELI.home) heliNew(x, z, h);
  /* a link that starts by a helicopter (?x=&z= within 40 m): on foot beside it, facing it, not in the car on the lane */
  if (START !== STATION) for (const e of HELIS) if (hyp(START.x - e.x, START.z - e.z) < 40) {
    const a = e.h + Math.PI * 0.75; P.x = e.x + Math.sin(a) * 7; P.z = e.z + Math.cos(a) * 7; P.y = H.surface(P.x, P.z); P.h = Math.atan2(e.x - P.x, e.z - P.z); START.piedi = true; break;
  }
}
/* the walls of the buildings near: their top is the roof (the walls stand 3 m over it so that nobody on foot climbs a roof), the helicopter meets the roof */
function heliTagBld(x, z, r) { BLD.each(x - r, z - r, x + r, z + r, b => { if (b.walls && !b._hw) { b._hw = true; for (const w of b.walls) w.bt = true; } }); }
/* a disc of radius r between heights ya and yb against the walls (as collideStatic, with each wall's real top), the trees with their crown */
function heliPush(p, r, ya, yb, skip) {
  let nx = 0, nz = 0, hit = false;
  WALLS.each(p.x - r - 2.5, p.z - r - 2.5, p.x + r + 2.5, p.z + r + 2.5, s => {
    if (s.off || (s.dyn && !s.on) || skip.has(s)) return;
    const top = s.y0 === undefined ? Infinity : s.bt ? s.y1 - 3 : s.y1, bot = s.y0 === undefined ? -Infinity : s.y0; if (yb < bot || ya > top) return;
    if (s.r) { const R = r + (s.tree ? 1.8 : s.r), dx = p.x - s.x, dz = p.z - s.z, d = hyp(dx, dz); if (d < R && d > 1e-6) { const k = (R - d) / d; p.x += dx * k; p.z += dz * k; nx += dx / d; nz += dz / d; hit = true; } return; }
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez; if (L2 < 1e-6) return;
    let t = ((p.x - s.ax) * ex + (p.z - s.az) * ez) / L2, cl = false; if (t < 0) { t = 0; cl = true; } else if (t > 1) { t = 1; cl = true; }
    const cx = s.ax + ex * t, cz = s.az + ez * t, dx = p.x - cx, dz = p.z - cz, d = hyp(dx, dz);
    if (s.two || dx * s.nx + dz * s.nz >= 0 || cl) { if (d < r && d > 1e-6) { const k = (r - d) / d; p.x += dx * k; p.z += dz * k; nx += dx / d; nz += dz / d; hit = true; } }
    else if (d < r) { p.x += s.nx * (r + d); p.z += s.nz * (r + d); nx += s.nx; nz += s.nz; hit = true; }
  });
  if (!hit) return null; const l = hyp(nx, nz) || 1; return [nx / l, nz / l];
}
/* what is under one point: the ground and the decks, a roof, a tree's crown, a car's roof; y = the height of the skids */
function heliFloorAt(x, z, y) {
  let f = H.surface(x, z, y + 0.6), k = 'suolo';
  { const t = bldFloorAt(x, z, y + 1.0); if (t > f) { f = t; k = 'tetto'; } } /* roofs, pitches and canopies as the walker sees them (world3.js bldRoofY) */
  WALLS.each(x - 2, z - 2, x + 2, z + 2, s => { if (s.tree && s.y1 <= y + 1.0 && s.y1 > f && hyp(x - s.x, z - s.z) < 2) { f = s.y1; k = 'albero'; } });
  for (const v of VEH) if (Math.abs(v.x - x) < 4 && Math.abs(v.z - z) < 4) { const t = v.y + (v.spec.two ? 1.1 : 1.45); if (t <= y + 1.0 && t > f) for (const c of v.circles()) if (hyp(c[0] - x, c[1] - z) < v.rad) { f = t; k = 'auto'; break; } }
  return [f, k];
}
const HELI_SKID = [[0.78, 1.6], [-0.78, 1.6], [0.78, -1.1], [-0.78, -1.1]]; /* [left, forward] of the four ends of the skids */
function heliFloor(e, x, z, y) {
  const fx = Math.sin(e.h), fz = Math.cos(e.h); let hi = -Infinity, lo = Infinity, kind = 'suolo'; const ys = [];
  for (const [lx, lz] of HELI_SKID) { const [f, k] = heliFloorAt(x + lx * fz + lz * fx, z - lx * fx + lz * fz, y); ys.push(f); if (f > hi) { hi = f; kind = k; } if (f < lo) lo = f; }
  const front = (ys[0] + ys[1]) / 2, back = (ys[2] + ys[3]) / 2, left = (ys[0] + ys[2]) / 2, right = (ys[1] + ys[3]) / 2;
  return { y: hi, steep: hi - lo > HELI.flat || kind === 'albero' || kind === 'auto', gp: clamp(Math.atan2(back - front, 2.7), -0.3, 0.3), gr: clamp(Math.atan2(left - right, 1.56), -0.3, 0.3), df: (front - back) / 2.7, dl: (left - right) / 1.56, kind };
}
function heliHurt(e, d) { if (d <= 0 || e.health <= 0) return; e.health = Math.max(0, e.health - d); if (e.health <= 0 && e === P.car) toast("L'elicottero è distrutto! Scendi subito!"); }
function heliInput(e) { e.inp.col = clamp((GP.thr || 0) - (GP.brk || 0), -1, 1); e.inp.yaw = clamp(GP.yaw || 0, -1, 1); e.inp.fwd = clamp(GP.fwd || 0, -1, 1); e.inp.side = clamp(GP.steer || 0, -1, 1); }
function heliStep(dt) {
  for (const e of HELIS) heliStep1(e, dt);
}
function heliStep1(e, dt) {
  if (e.driver === 'player' && P.car !== e) e.driver = null; /* wasted, busted, the cheats: he is no longer in it */
  if (e.gone) return;
  if (e.exploded) {
    e.wreckT += dt;
    if (e.wreckT > 25 && hyp(P.x - e.home[0], P.z - e.home[1]) > 40 && P.car !== e) { /* the wreck goes, a new one stands at home */
      scene.remove(e.m.g); e.gone = true; heliWalls(e); HELIS.splice(HELIS.indexOf(e), 1); heliNew(e.home[0], e.home[1], e.home[2]); return;
    }
  }
  const me = e.driver === 'player', alive = e.health > 0, I = me && alive ? e.inp : HELI_ZERO;
  const col = I.col || 0, yaw = I.yaw || 0, sf = I.fwd || 0, ss = I.side || 0;
  e.rs = clamp(e.rs + (me && alive ? dt / HELI.spinUp : -dt / HELI.spinDown), 0, 1);
  const lift = clamp((e.rs - 0.55) / 0.45, 0, 1), fx = Math.sin(e.h), fz = Math.cos(e.h), rx = -fz, rz = fx;
  const vf = e.vx * fx + e.vz * fz, vs = e.vx * rx + e.vz * rz, sp = hyp(e.vx, e.vz);
  /* turning: L1/R1, and in a banked turn at speed the nose follows the bank */
  let yT = yaw * HELI.yawRate * (e.ground ? 0.6 * lift : 1);
  if (!e.ground) {
    const hi = clamp((vf - HELI.bankHiV0) / (HELI.bankHiV1 - HELI.bankHiV0), 0, 1);
    yT -= 9.81 * Math.tan(e.roll) / Math.max(sp, HELI.bankVmin) * clamp((vf - HELI.bankV0) / (HELI.bankV1 - HELI.bankV0), 0, 1) * (1 + (HELI.bankHi - 1) * hi * hi * (3 - 2 * hi));
  }
  e.yr += (yT - e.yr) * (1 - Math.exp(-HELI.yawK * dt)); e.h = wrapA(e.h + e.yr * dt);
  /* tilt: the stick, or with the stick let go against the drift (hover); on the ground the slope under the skids */
  let pT = e.gp, rT = e.gr;
  if (!e.ground) {
    /* the brake against the drift only with the stick let go; the stick held only sideways keeps the speed it has (the nose down just enough against the drag) */
    pT = Math.abs(sf) > 0.05 ? sf * HELI.tilt : Math.abs(ss) > 0.05 ? clamp(Math.atan((HELI.drag1 + HELI.drag2 * sp) * vf / (9.81 * Math.max(lift, 0.1))), -HELI.tilt, HELI.tilt) : clamp(-vf * HELI.hold, -HELI.holdMax, HELI.holdMax);
    rT = Math.abs(ss) > 0.05 ? ss * HELI.tilt : clamp(-vs * HELI.hold, -HELI.holdMax, HELI.holdMax);
    if (!alive) { pT = 0.25; rT = Math.sin(now * 1.7) * 0.3; } /* broken: it tumbles */
  }
  const kt = 1 - Math.exp(-HELI.tiltK * dt); e.pitch += (pT - e.pitch) * kt; e.roll += (rT - e.roll) * kt;
  /* across: the rotor's thrust tilted with the body, less the drag */
  if (!e.ground) {
    const g = 9.81 * lift, af = g * Math.tan(e.pitch), as = g * Math.tan(e.roll), dr = HELI.drag1 + HELI.drag2 * sp;
    e.vx += (fx * af + rx * as - e.vx * dr) * dt; e.vz += (fz * af + rz * as - e.vz * dr) * dt;
    if (Math.abs(sf) < 0.05 && Math.abs(ss) < 0.05 && sp < 0.4) { const k = Math.exp(-3 * dt); e.vx *= k; e.vz *= k; }
    /* grip on the air: going forward, the speed across the nose turns into speed along it (no sliding as on ice); slow, it slides freely as before */
    const gw = heliGrip(e, fx, fz);
    if (gw > 0) {
      const f1 = e.vx * fx + e.vz * fz, s1 = e.vx * rx + e.vz * rz, s2 = s1 * Math.exp(-HELI.grip * gw * dt), f2 = Math.sqrt(Math.max(0, f1 * f1 + s1 * s1 - s2 * s2));
      e.vx = fx * f2 + rx * s2; e.vz = fz * f2 + rz * s2;
    }
  } else { const k = Math.exp(-HELI.skid * dt); e.vx *= k; e.vz *= k; }
  /* up and down: R2/L2 set the vertical speed, nothing held keeps the height; with no rotor it falls */
  const vyT = me && alive ? (col > 0 ? col * HELI.climb : col * HELI.sink) : -4;
  e.vy += (vyT - e.vy) * (1 - Math.exp(-HELI.vyK * dt)) * lift - 9.81 * (1 - lift) * dt;
  if (e.ground && e.vy < 0) e.vy = 0;
  /* move, then the walls (the body low, the rotor high) */
  const x0 = e.x, z0 = e.z; e.x += e.vx * dt; e.z += e.vz * dt; e.y += e.vy * dt;
  e.x = clamp(e.x, ZONA[0] + 5, ZONA[2] - 5); e.z = clamp(e.z, ZONA[1] + 5, ZONA[3] - 5); if (e.y > HELI.maxAlt) { e.y = HELI.maxAlt; e.vy = Math.min(e.vy, 0); }
  heliTagBld(e.x, e.z, 40); /* the roofs round it and between it and the camera (rayCam) */
  let hb = null, hr = null;
  propHitsElicottero(e, [[e.x + fx * 0.3, e.z + fz * 0.3, 1.3], [e.x - fx * 4.4, e.z - fz * 4.4, 0.6]], e.y + 0.15, e.y + 2.1); propHitsElicottero(e, [[e.x, e.z, HELI.rotorR]], e.y + HELI.rotorY, e.y + HELI.rotorY + 0.3); /* what it knocks down it does not bump into (props3.js) */
  for (const [lz, r] of [[0.3, 1.3], [-4.4, 0.6]]) { const cx = e.x + fx * lz, cz = e.z + fz * lz, p = { x: cx, z: cz }, n = heliPush(p, r, e.y + 0.15, e.y + 2.1, e.wset); if (n) { e.x += p.x - cx; e.z += p.z - cz; hb = n; } }
  { const p = { x: e.x, z: e.z }, n = heliPush(p, HELI.rotorR, e.y + HELI.rotorY, e.y + HELI.rotorY + 0.3, e.wset); if (n) { e.x = p.x; e.z = p.z; hr = n; } }
  for (const [n, rot] of [[hb, false], [hr, true]]) {
    if (!n) continue; const vn = e.vx * n[0] + e.vz * n[1]; if (vn >= 0) continue;
    e.vx -= 1.3 * vn * n[0]; e.vz -= 1.3 * vn * n[1]; const imp = -vn;
    if (rot && e.rs > 0.3) { heliHurt(e, (imp - 2) * 10); e.yr += (rnd() - 0.5) * imp * 0.3; } else heliHurt(e, (imp - 4) * 6);
    if (e === P.car && imp > 1.5) { sfxCrash(Math.min(12, imp)); shake = Math.max(shake, Math.min(0.9, imp / 12)); }
  }
  /* a ceiling over it: a deck, a raised volume */
  { let c = ceilAbove(e.x, e.z, e.y + 0.4); for (const o of H.deckAt(e.x, e.z)) { const b = o.bot !== undefined ? o.bot : o.top - 0.6; if (o.top > e.y + 0.4 && b < c) c = b; }
    if (c < e.y + HELI.rotorY + 0.35) { e.y = Math.max(e.y - 0.5, c - HELI.rotorY - 0.35); if (e.vy > 0) { if (e.rs > 0.3) heliHurt(e, (e.vy - 1.5) * 12); if (e === P.car) { sfxCrash(Math.min(12, 3 + e.vy)); shake = Math.max(shake, 0.4); } e.vy = 0; } } }
  /* the floor: it touches down on the highest point under the skids */
  const fl = heliFloor(e, e.x, e.z, e.y);
  if (e.y <= fl.y || (e.ground && e.y - fl.y < 0.3 && e.vy <= 0.01)) {
    if (!e.ground) {
      const down = -e.vy, across = hyp(e.vx, e.vz);
      if (down > HELI.landSafe) heliHurt(e, (down - HELI.landSafe) * 14);
      if (across > HELI.landHs) heliHurt(e, (across - HELI.landHs) * 5);
      if (e === P.car && down > 2) { sfxCrash(Math.min(12, down)); shake = Math.max(shake, Math.min(0.8, down / 10)); }
    }
    e.y = fl.y; if (e.vy < 0) e.vy = 0; e.ground = true; e.gp = fl.gp; e.gr = fl.gr;
    if (fl.steep) { /* not level: it slides off, downhill */
      e.vx += (-(fl.df * fx) + fl.dl * rx) * 9.81 * 0.6 * dt; e.vz += (-(fl.df * fz) + fl.dl * rz) * 9.81 * 0.6 * dt;
      if (fl.kind === 'albero' || fl.kind === 'auto') { const a = rnd() * TAU; e.vx += Math.sin(a) * 3 * dt; e.vz += Math.cos(a) * 3 * dt; }
      if (e === P.car && !e.steepTold) { e.steepTold = true; toast('Qui non è piano: cerca un posto in piano per atterrare'); }
    } else e.steepTold = false;
  } else if (e.y > fl.y + 0.05) e.ground = false;
  e.alto = e.y - fl.y;
  e.speed = hyp(e.vx, e.vz); e.fwdSpeed = e.vx * fx + e.vz * fz;
  heliWalls(e);
  if (me) { P.y = e.y; }
  /* broken: it burns, after six seconds it blows up (as a car) */
  if (!alive && !e.exploded) {
    e.burn = (e.burn || 0) + dt;
    if (rnd() < 0.7) puff(e.x - fx * 0.6 + (rnd() - 0.5), e.y + 2.1, e.z - fz * 0.6 + (rnd() - 0.5), rnd() < 0.5 ? '#ff7a1e' : '#ffc23a', 0.9 + rnd() * 0.6, 0.45, 2.2);
    if (e.burn > 6) heliBoom(e);
  }
}
function heliBoom(e) {
  e.exploded = true; e.wreckT = 0; e.health = 0; e.rs = 0;
  for (const k of ['body', 'stripe', 'glass', 'metal', 'dark']) e.m.own[k].color.lerp(CHAR, 0.85);
  if (P.car === e) P.hp = 0;
  boom(e.x, e.y + 1, e.z, 1.2, null);
}
function heliEnter() {
  if (P.mode !== 'foot') return false;
  let best = null, bd = 4.6;
  for (const e of HELIS) { if (e.gone || e.exploded) continue; const d = hyp(e.x - P.x, e.z - P.z); if (d < bd && Math.abs(e.y - P.y) < 2.5) { bd = d; best = e; } }
  if (!best) return false;
  for (const v of VEH) if (hyp(v.x - P.x, v.z - P.z) < Math.min(bd, 4.2)) return false; /* a car nearer than the helicopter: that one */
  best.driver = 'player'; best.inp = { thr: 0, brk: 0, steer: 0, hand: 0, col: 0, yaw: 0, fwd: 0, side: 0 }; P.car = best; P.mode = 'car'; P.model.g.visible = false;
  toast(best.health > 0 ? 'Elicottero · R2 sale, L2 scende, levetta sinistra lo inclina, L1 R1 lo girano' : "L'elicottero è distrutto");
  return true;
}
function heliExit() {
  const e = P.car, [x, z, ey] = exitSpot(e), alto = e.alto; /* ey: the feet there, a roof as well as the ground */
  P.x = x; P.z = z; P.h = e.h; P.mode = 'foot'; P.model.g.visible = true; e.driver = null; P.car = null; P.vx = P.vz = P.vy = 0;
  if (alto > 1.5) { P.y = e.y + 0.3; P.air = true; P.onV = null; P.land = 0; P.vx = e.vx; P.vz = e.vz; P.vy = e.vy; } /* out in the air: he falls as any walker falls (salto3.js footVert); what a fall does to him is the walker's physics, not the helicopter's (Carlo 7/11) */
  else P.y = ey;
}
/* drawn each frame between the physics steps: the body, the rotors turning, the blur of the rotor, the smoke of a damaged one */
function heliDraw(dt) {
  const cx = camera.position.x, cz = camera.position.z;
  for (const e of HELIS) {
    const m = e.m; m.g.visible = Math.abs(e.x - cx) < 600 && Math.abs(e.z - cz) < 600; if (!m.g.visible) continue;
    m.g.position.set(e.x, e.y, e.z); m.g.rotation.set(e.pitch, e.h, e.roll);
    e.rotA += e.rs * TAU * 4.5 * dt; e.tailA += e.rs * TAU * 22 * dt;
    m.rotor.rotation.y = e.rotA; m.tail.rotation.x = e.tailA; m.own.disc.opacity = e.rs > 0.3 ? 0.16 * (e.rs - 0.3) / 0.7 : 0;
    if (dt > 0 && e.health < 35 && !e.exploded && rnd() < 0.3) puff(e.x - Math.sin(e.h) * 0.6, e.y + 2.3, e.z - Math.cos(e.h) * 0.6, '#3a3a3a', 1.4, 1.6);
    if (dt > 0 && e.exploded && rnd() < 0.15) puff(e.x, e.y + 1.5, e.z, '#2b2b2b', 1.6, 2);
  }
}
/* the engine: the car's own oscillators, low and with the beat of the blades */
function heliSound(v, t, m) {
  const r = v.rs, beat = 0.6 + 0.4 * Math.pow(Math.abs(Math.cos(v.rotA)), 6);
  AU.eng.o1.frequency.setTargetAtTime(24 + r * 30 + (v.inp.col || 0) * 4, t, 0.1); AU.eng.o2.frequency.setTargetAtTime(24 + r * 30, t, 0.1);
  AU.eng.lp.frequency.setTargetAtTime(220 + r * 380, t, 0.1); AU.eng.eg.gain.setTargetAtTime(m * (v.health > 0 ? (0.05 + 0.13 * r) * beat : 0), t, 0.012);
}
/* how much the air grips it: 0 under gripV0 m/s forward, 1 over gripV1, smooth between */
function heliGrip(e, fx, fz) { const t = clamp((e.vx * fx + e.vz * fz - HELI.gripV0) / (HELI.gripV1 - HELI.gripV0), 0, 1); return t * t * (3 - 2 * t); }
/* where the camera looks from behind the helicopter: the nose when still, the way it goes when it moves slowly (the stick held diagonally: diagonally),
   behind the nose again at speed, where the grip makes the nose and the way it goes one; going backwards it stays behind the nose */
function heliCamDir(e) {
  const sp = hyp(e.vx, e.vz); if (sp < 0.3) return e.h;
  const d = wrapA(Math.atan2(e.vx, e.vz) - e.h), w = clamp((sp - HELI.camW0) / (HELI.camW1 - HELI.camW0), 0, 1) * clamp((Math.cos(d) + 0.35) / 0.7, 0, 1) * (1 - heliGrip(e, Math.sin(e.h), Math.cos(e.h)));
  return wrapA(e.h + d * w);
}
/* the fog thins out with the height of the view over the ground: from up high one sees far, as the lights do */
function nebbiaQuota() { const c = camera.position, a = c.y - H.ground(c.x, c.z) - 15; return a > 0 ? 1 + a / HELI.fogAlt : 1; }
