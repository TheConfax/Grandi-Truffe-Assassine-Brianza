// ---------------------------------------------------------------- street furniture you can knock down: street lamps, traffic lights, level-crossing barriers
// Each prop is a post in the collision grid (dyn, so it can be switched off) plus a way to draw it falling: an Object3D whose origin is at its foot,
// or one instance of a per-tile InstancedMesh. Ram it hard enough and it tips over away from you, the car loses a little speed, a lamp goes dark.
// One collision per object, the same for the walker, every vehicle and the helicopter: its posts in WALLS. What a vehicle does to it depends on
// the blow (speed times the vehicle's mass, propForza) and on the group of the object (Carlo, 8/11): FORZA.leggero (signs, bollards, meters,
// bins, benches, columns, the fuel totem) goes at a gentle knock, FORZA.medio (lamp posts, bus shelters, bales, concrete blocks)
// needs speed and mass; what is never broken has no prop, only its wall. A weaker blow stops the vehicle; on foot nothing breaks.
// via: the object is not knocked over but moves (bales roll away, blocks slide) and stands again where it stops, still solid.
const PROPS = [], PROPG = new Grid(16), PROP_FALL = [], PROP_MOVE = [];
const FORZA = { leggero: 8.3, medio: 16.7 }; // m/s of a car of mass 1 (a hatchback): 30 and 60 km/h (Carlo, 8/11); a two-wheeler weighs a quarter of it (as in the crashes between vehicles)
const propMassa = v => isTwo(v) ? 0.25 : clamp(v.spec.L * v.spec.W / 7.39, 0.5, 3);
const propForza = v => v.speed * propMassa(v);
/* MASSA DELL'ELICOTTERO, in compatte (1 = un'auto compatta di circa 1,1 t): 2,5 t (Carlo, 8/11), piu di un furgone (1,4). Il solo posto dove sta:
   i pesi di tutti i veicoli si rifanno col rifacimento dei veicoli */
const HELI_MASSA = 2.3;
const heliMassa = () => HELI_MASSA;
function addProp(p) { // { x, z, r, obj | inst: { meshes, i, ry, base }, onBreak, forza, via, parts: [[x, z, r]], wall (already in WALLS) }
  if (!p.wall) {
    p.wall = { r: p.r, x: p.x, z: p.z, dyn: true, on: true, y0: p.y - 3, y1: p.y + (p.h || 6) };
    if (p.sali) p.wall.sali = { rs: p.sali.rs, top: p.y + p.sali.dy }; if (p.scav) p.wall.scav = true; // climbing on foot (salto3.js): stand on it, go over it
    WALLS.add(p.x - p.r - 0.2, p.z - p.r - 0.2, p.x + p.r + 0.2, p.z + p.r + 0.2, p.wall);
  }
  p.pw = (p.parts || []).map(([x, z, r]) => { const w = { r, x, z, dyn: true, on: p.wall.on, y0: p.y - 3, y1: p.y + (p.h || 6) }; WALLS.add(x - r - 0.2, z - r - 0.2, x + r + 0.2, z + r + 0.2, w); return w; }); // the other posts of one object: they go with it
  PROPS.push(p); PROPG.add(p.x - 3, p.z - 3, p.x + 3, p.z + 3, p); return p;
}
const SFONDA = { slow: 0.86, dmg: 2 }; // what a vehicle loses of its speed and its health breaking a thing (the graves have their own, sfondabili3.js TOMBE)
/* The fall of a rigid body (Carlo, 8/11: "sembrano foglie"): it turns about its foot the way the blow went, gravity alone speeding it up as for a
   rod of its height (angular acceleration 3g/2L times the sine of the tilt), from the turn the blow gave it (FALL.kick times the speed over the
   height); it hits the ground, bounces a little, damped, and lies still. A blow over its threshold also throws its foot forward, a share of the
   vehicle's speed growing with the excess (FALL.spinta), the foot sliding to a stop on the ground (FALL.attrito). One way for everything knocked down */
const FALL = { kick: 0.22, kickMax: 3, spinta: 0.5, attrito: 6, rimbalzo: 0.2, fermo: 0.6, steso: Math.PI / 2 - 0.04 };
function breakProp(p, v, F) {
  if (p.broken) return; p.broken = true; p.wall.on = false; for (const w of p.pw || []) w.on = false;
  let dx = v ? v.vx : 1, dz = v ? v.vz : 0; const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
  const axis = new THREE.Vector3(dz, 0, -dx); // tips over along the car's way
  let o = p.obj, m0 = null;
  if (!o && p.inst) { o = new THREE.Object3D(); o.position.set(p.x, p.inst.base, p.z); o.updateMatrix(); m0 = propMatrici(p); } // a pivot at its foot: each instance turns about it from the matrix it had
  const L = clamp(p.h || 3, 0.8, 9), sp = v ? v.speed : 0, ecc = F ? clamp(F / FORZA[p.forza || 'leggero'] - 1, 0, 1) : 0;
  if (o) PROP_FALL.push({ o, p, axis, m0, L, a: 0, w: Math.min(FALL.kickMax, FALL.kick * sp / L) + 0.1, vx: dx * sp * FALL.spinta * ecc, vz: dz * sp * FALL.spinta * ecc, x0: o.position.x, y0: o.position.y, z0: o.position.z, giu: false, t: 0 });
  if (p.onBreak) p.onBreak();
  if (v) propUrto(v);
}
function propUrto(v) { const sp = v.speed; v.vx *= SFONDA.slow; v.vz *= SFONDA.slow; v.health = Math.max(0, v.health - SFONDA.dmg); if (v === P.car) { sfxCrash(Math.min(10, sp)); shake = Math.max(shake, 0.25); } }
function propMatrici(p) { return p.inst.meshes.map(m => { const M = new THREE.Matrix4(); m.getMatrixAt(p.inst.i, M); return M; }); }
const _pm = new THREE.Matrix4(), _pt = new THREE.Matrix4();
function propScrivi(p, o, m0, x0, y0, z0) { /* each instance: the pivot's matrix times the way from where the pivot was to the instance as it was */
  o.updateMatrix(); _pt.makeTranslation(-x0, -y0, -z0);
  p.inst.meshes.forEach((m, j) => { _pm.copy(o.matrix).multiply(_pt).multiply(m0[j]); m.setMatrixAt(p.inst.i, _pm); m.instanceMatrix.needsUpdate = true; });
}
/* a tile built again: its instances of what was knocked down hide, what was moved stands where it stopped */
function propRifai(p, meshes, i) {
  p.inst.meshes = meshes; p.inst.i = i; const M = new THREE.Matrix4();
  if (p.broken) { M.makeScale(0, 0, 0); for (const m of meshes) m.setMatrixAt(i, M); }
  else if (p.inst.mf) meshes.forEach((m, j) => m.setMatrixAt(i, p.inst.mf[j] || p.inst.mf[0]));
}
function propSpingi(p, v) { // pushed: it takes the vehicle's way at part of its speed (a bale more, a block less), the vehicle loses some
  const l = hyp(v.vx, v.vz) || 1, k = p.via === 'rotola' ? 0.8 : 0.6;
  p.vx = v.vx / l * v.speed * k; p.vz = v.vz / l * v.speed * k;
  if (!p.moving) { p.moving = true; PROP_MOVE.push(p); if (p.inst) { p.mo = new THREE.Object3D(); p.mo.position.set(p.x, p.y, p.z); p.mo.updateMatrix(); p.m0 = propMatrici(p); p.p0 = [p.x, p.y, p.z]; } }
  propUrto(v);
}
function propHits(v) {
  tombHits(v);
  const F = propForza(v); if (F < FORZA.leggero) return;
  PROPG.each(v.x - 4, v.z - 4, v.x + 4, v.z + 4, p => {
    if (p.broken || Math.abs(v.y - p.y) > 3 || F < FORZA[p.forza || 'leggero']) return;
    for (const c of v.circles()) if (hyp(c[0] - p.x, c[1] - p.z) < v.rad + p.r + 0.15 || (p.pw || []).some(w => hyp(c[0] - w.x, c[1] - w.z) < v.rad + w.r + 0.15)) { if (p.via) { if (!p.moving || hyp(p.vx, p.vz) < v.speed * 0.5) propSpingi(p, v); } else breakProp(p, v, F); return; }
  });
  // a lowered level-crossing arm across the road snaps off and flies
  for (const g of LX) if (g.bars && Math.abs(g.x - v.x) < 14 && Math.abs(g.z - v.z) < 14) for (const b of g.bars) {
    if (b.broken || b.armGone || !b.seg.on) continue;
    for (const c of v.circles()) if (segDist(c[0], c[1], b.seg.ax, b.seg.az, b.seg.bx, b.seg.bz) < v.rad + 0.2) { snapArm(b, v); break; }
  }
}
/* the helicopter against the props: the same rule as the vehicles. Discs [x, z, r] between heights ya and yb; over the threshold it knocks them
   down or pushes them (and loses some speed), under it heliPush stops it on their walls. Its damage is not touched here */
function propHitsElicottero(e, dischi, ya, yb) {
  const sp = hyp(e.vx, e.vz), F = sp * heliMassa(); if (F < FORZA.leggero) return;
  const q = { vx: e.vx, vz: e.vz, speed: sp }; let hit = false;
  for (const [cx, cz, r] of dischi) PROPG.each(cx - r - 3, cz - r - 3, cx + r + 3, cz + r + 3, p => {
    if (p.broken || F < FORZA[p.forza || 'leggero'] || yb < p.wall.y0 || ya > p.wall.y1) return;
    if (hyp(cx - p.x, cz - p.z) < r + p.r + 0.15 || (p.pw || []).some(w => hyp(cx - w.x, cz - w.z) < r + w.r + 0.15)) { if (p.via) { if (!p.moving || hyp(p.vx, p.vz) < sp * 0.5) propSpingi(p, q); } else breakProp(p, q, F); hit = true; }
  });
  if (hit) { e.vx = q.vx; e.vz = q.vz; if (e === P.car) { sfxCrash(Math.min(10, sp)); shake = Math.max(shake, 0.25); } }
}
const PROP_DEBRIS = [];
function snapArm(b, v) {
  b.armGone = true; b.seg.on = false; b.probe = [];
  const arm = b.arm, wp = new THREE.Vector3(), wq = new THREE.Quaternion(); arm.updateMatrixWorld(); arm.getWorldPosition(wp); arm.getWorldQuaternion(wq);
  arm.parent.remove(arm); scene.add(arm); arm.position.copy(wp); arm.quaternion.copy(wq);
  PROP_DEBRIS.push({ o: arm, vx: v.vx * 0.7, vy: 3 + v.speed * 0.12, vz: v.vz * 0.7, spin: new THREE.Vector3(Math.random() - 0.5, Math.random() * 2 - 1, Math.random() - 0.5).multiplyScalar(6), t: 0 });
  v.vx *= 0.93; v.vz *= 0.93; if (v === P.car) { sfxCrash(Math.min(8, v.speed)); shake = Math.max(shake, 0.2); }
}
function updProps(dt) {
  for (let i = PROP_FALL.length - 1; i >= 0; i--) {
    const f = PROP_FALL[i]; f.t += dt;
    const sv = hyp(f.vx, f.vz); if (sv > 0) { const k = Math.max(0, sv - FALL.attrito * dt) / sv; f.vx *= k; f.vz *= k; const o = f.o.position; o.x += f.vx * dt; o.z += f.vz * dt; o.y = f.y0 + H.ground(o.x, o.z) - H.ground(f.x0, f.z0); }
    if (!f.giu) {
      f.w += 1.5 * 9.81 / f.L * Math.sin(Math.max(0.02, f.a)) * dt; let da = f.w * dt;
      if (f.a + da >= FALL.steso) { da = FALL.steso - f.a; if (f.w > FALL.fermo) f.w = -f.w * FALL.rimbalzo; else { f.w = 0; f.giu = true; } } /* the ground: a small bounce, then still */
      f.a += da; f.o.rotateOnWorldAxis(f.axis, da);
    }
    if (f.m0) propScrivi(f.p, f.o, f.m0, f.p.x, f.p.inst.base, f.p.z); else f.o.updateMatrix();
    if (f.giu && f.vx === 0 && f.vz === 0 || f.giu && hyp(f.vx, f.vz) < 0.01 || f.t > 8) PROP_FALL.splice(i, 1);
  }
  for (let i = PROP_MOVE.length - 1; i >= 0; i--) { // rolling and sliding: friction, the walls round it, its own wall going with it
    const p = PROP_MOVE[i], sp = hyp(p.vx, p.vz), ns = Math.max(0, sp - (p.via === 'rotola' ? 5 : 7) * dt), k = sp > 1e-6 ? ns / sp : 0;
    p.vx *= k; p.vz *= k;
    const q = { x: p.x + p.vx * dt, z: p.z + p.vz * dt }, gq = H.ground(q.x, q.z);
    if (collideStatic(q, p.r, gq + 0.4, true, new Set([p.wall, ...(p.pw || [])]))) { p.vx *= 0.3; p.vz *= 0.3; }
    const mx = q.x - p.x, mz = q.z - p.z, w = p.wall, r = p.r + 0.2;
    WALLS.del(p.x - r, p.z - r, p.x + r, p.z + r, w); PROPG.del(p.x - 3, p.z - 3, p.x + 3, p.z + 3, p);
    p.x = q.x; p.z = q.z; const gy = H.ground(p.x, p.z), dy = gy - p.y; p.y = gy; w.x = p.x; w.z = p.z; w.y0 += dy; w.y1 += dy; if (w.sali) w.sali.top += dy;
    WALLS.add(p.x - r, p.z - r, p.x + r, p.z + r, w); PROPG.add(p.x - 3, p.z - 3, p.x + 3, p.z + 3, p);
    if (p.mo) {
      p.mo.position.set(p.x, p.y, p.z); const d = hyp(mx, mz);
      if (p.via === 'rotola' && d > 1e-6) p.mo.rotateOnWorldAxis(new THREE.Vector3(mz / d, 0, -mx / d), d / Math.max(0.3, p.r));
      propScrivi(p, p.mo, p.m0, p.p0[0], p.p0[1], p.p0[2]);
    }
    if (ns < 0.05) { p.moving = false; PROP_MOVE.splice(i, 1); if (p.inst) p.inst.mf = propMatrici(p); }
  }
  for (let i = PROP_DEBRIS.length - 1; i >= 0; i--) {
    const d = PROP_DEBRIS[i], o = d.o; d.t += dt; d.vy -= 9.8 * dt;
    o.position.x += d.vx * dt; o.position.y += d.vy * dt; o.position.z += d.vz * dt;
    o.rotateX(d.spin.x * dt); o.rotateY(d.spin.y * dt); o.rotateZ(d.spin.z * dt);
    const gy = H.ground(o.position.x, o.position.z) + 0.1;
    if (o.position.y < gy) { o.position.y = gy; d.vy *= -0.25; d.vx *= 0.6; d.vz *= 0.6; d.spin.multiplyScalar(0.5); }
    if (d.t > 4) PROP_DEBRIS.splice(i, 1);
  }
  updBarriere(dt); // the fence panels broken through and their bits (sfondabili3.js)
}
