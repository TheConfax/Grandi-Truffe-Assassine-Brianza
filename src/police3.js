// ---------------------------------------------------------------- caserme: parked volanti and agents on foot
// Polizia Locale: light blue shirt, dark trousers, white cap; Carabinieri: black uniform, red stripe on the trousers, white bandolier, cap with a red band
function makeAgent(cc, vest) {
  const m = cc ? makePed('#161a26', '#161a26', pick(SKIN), pick(HAIR)) : makePed('#b9d0e8', '#1f2a44', pick(SKIN), pick(HAIR));
  const add = (geo, hex, x, y, z, parent = m.inner) => { const o = new THREE.Mesh(geo, lam(hex)); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };
  add(boxG(0.29, 0.1, 0.3), cc ? 0x161a26 : 0xf4f5f2, 0, 1.81, 0);                        // cap
  add(boxG(0.28, 0.06, 0.29), cc ? 0xb0121b : 0x1f2a44, 0, 1.76, 0);                       // band
  add(boxG(0.24, 0.03, 0.11), 0x0e0f12, 0, 1.745, 0.17);                                    // visor
  add(boxG(0.47, 0.07, 0.27), cc ? 0xf2f2ee : 0x1b1d22, 0, 0.9, 0);                         // belt
  add(boxG(0.08, 0.16, 0.12), 0x1b1d22, cc ? 0.26 : -0.26, 0.82, 0.02);                     // holster
  if (cc) {
    const b = add(boxG(0.06, 0.78, 0.275), 0xf2f2ee, 0, 1.17, 0); b.rotation.z = 0.62;      // bandoliera
    for (const [leg, s] of [[m.L, -1], [m.R, 1]]) add(boxG(0.025, 0.8, 0.06), 0xb0121b, s * 0.088, -0.41, 0, leg); // the red stripe moves with the leg
  }
  if (vest) { add(boxG(0.48, 0.5, 0.28), 0xd7f23a, 0, 1.2, 0); add(boxG(0.485, 0.05, 0.285), 0xd9dde2, 0, 1.08, 0); add(boxG(0.485, 0.05, 0.285), 0xd9dde2, 0, 1.3, 0); }
  return m;
}
const CC_NAME = 'una gazzella dei Carabinieri', PL_NAME = 'un\'auto della Polizia Locale';
function parkCaserme(T) {
  for (const st of CASERME) {
    if (tileOf(st.x, st.z) !== T.t) continue;
    let n = 0;
    for (const sp of st.spots) {
      if (n >= 3) break;
      const fx = Math.sin(sp.h) * 1.3, fz = Math.cos(sp.h) * 1.3, y = H.surface(sp.x, sp.z), free = (x, z) => collideStatic({ x, z }, 1.05, y + 0.4) === null && !inBuilding(x, z, 0.4);
      if (!free(sp.x + fx, sp.z + fz) || !free(sp.x - fx, sp.z - fz) || (!sp.kerb && onAnyRoad(sp.x, sp.z, 0.6))) continue;
      if (VEH.some(v => hyp(v.x - sp.x, v.z - sp.z) < 4.2)) { n++; continue; } // a volante already sits here
      const v = new Vehicle('police', st.cc ? CC_COL : '#f4f5f7', sp.x, sp.z, sp.h); v.parkedTile = T; v.caserma = st; v.y = y; v.sync(); T.parked.push(v); n++;
    }
  }
}
function launchVolante(v) { // out of the yard and after you
  v.driver = 'ai'; v.sleep = false; v.moved = true; v.taken = true;
  v.ai = { cop: true, node: nearestNode(DRIVE_NODES, v.x, v.z), prev: -1, q: [], blocked: 0, ignore: 0, cruise: 10 };
}
function spawnCop(st, post) {
  const [x, z] = st.at(post.lx, post.lz), m = makeAgent(st.cc, !st.cc && !!post.beat);
  const p = { x, z, h: Math.atan2(st.nx, st.nz), y: H.surface(x, z), vx: 0, vz: 0, vy: 0, side: 1, prev: -1, cur: -1, q: [], m, state: 'walk', t: 0, phase: 0, spd: 1.2, cop: true, st, post, alert: 0, dir: 1 };
  PEDS.push(p); st.cops.push(p); return p;
}
const copsOnFoot = () => PEDS.filter(p => p.cop && p.state !== 'dead');
function footCopNear(R) { return copsOnFoot().some(p => hyp(p.x - P.x, p.z - P.z) < R); }
function footCopClose() { const R = P.mode === 'car' ? 2.9 : 1.7; return copsOnFoot().some(p => hyp(p.x - P.x, p.z - P.z) < R); }
// one agent on foot: on guard at the door or walking the front; with stars he runs after you (sprinting gets you away), or to a volante to come after you
function copStep(p, dt) {
  const st = p.st, inCar = P.mode === 'car', tx = inCar ? P.car.x : P.x, tz = inCar ? P.car.z : P.z, d = hyp(tx - p.x, tz - p.z);
  const sees = W.stars > 0 && !W.busted && d < 55 && rayWalls(p.x, p.z, tx, tz) >= 1;
  if (sees) { p.alert = 6; W.seen = true; } else p.alert -= dt;
  let gx = null, gz = null, run = false, face = null;
  if (p.board) {
    const v = p.board;
    if (!VEH.includes(v) || v.driver || v === P.car || W.stars === 0) { v.reserved = false; p.board = null; }
    else { const rx = Math.cos(v.h), rz = -Math.sin(v.h); gx = v.x - rx * 1.35; gz = v.z - rz * 1.35; run = true; // driver's door, on the left
      if (hyp(gx - p.x, gz - p.z) < 0.9 || (p.boardT -= dt) < 0) { launchVolante(v); removePed(p); return -1; } }
  }
  const home = st.at(p.post.lx, p.post.lz), far = hyp(p.x - st.x, p.z - st.z) > 90;
  if (gx === null && W.stars > 0 && p.alert > 0 && !far) {
    if (d > (inCar ? 2.4 : 1.1)) { gx = tx; gz = tz; run = true; } else face = Math.atan2(tx - p.x, tz - p.z);
  }
  if (gx === null && face === null) {
    if (p.post.beat && hyp(p.x - home[0], p.z - home[1]) < 25) { // walk the front from one end to the other
      const end = st.at(p.post.lx + p.post.beat * p.dir, p.post.lz);
      if (hyp(end[0] - p.x, end[1] - p.z) < 0.5) { p.dir = -p.dir; p.t = 2 + rnd() * 3; }
      if (p.t > 0) { p.t -= dt; face = Math.atan2(st.nx, st.nz); } else { gx = end[0]; gz = end[1]; }
    } else if (hyp(home[0] - p.x, home[1] - p.z) > 0.4) { gx = home[0]; gz = home[1]; run = W.stars > 0; }
    else face = Math.atan2(st.nx, st.nz);
  }
  let spd = 0;
  if (gx !== null) {
    const dx = gx - p.x, dz = gz - p.z, L = hyp(dx, dz) || 1; spd = Math.min(run ? 6 : 1.2, L / Math.max(dt, 1e-3));
    const pp = { x: p.x + dx / L * spd * dt, z: p.z + dz / L * spd * dt }; collideStatic(pp, 0.35, p.y + 0.4); p.x = pp.x; p.z = pp.z;
    p.h = p.h + wrapA(Math.atan2(dx, dz) - p.h) * Math.min(1, dt * 10);
  } else { p.h = p.h + wrapA(face - p.h) * Math.min(1, dt * 4); p.phase = 0; }
  p.state = run ? 'flee' : 'walk'; // 'flee' only picks the running stride
  return spd;
}
// per caserma: agents appear out of sight when you come close, volanti leave the yard when you are wanted nearby
function updCaserme2(dt) {
  for (const st of CASERME) {
    const d = hyp(st.x - P.x, st.z - P.z);
    st.cops = st.cops.filter(p => PEDS.includes(p));
    if (!st.cops.length) st.manned = false; // all gone (out of range, hit, or away in a volante): a new shift, later and out of sight
    if (!st.manned && d < 175 && (now > st.next || st.force) && (d > 150 || st.force || !onScreen(st.x, st.z))) { st.force = false; st.manned = true; for (const post of st.posts) spawnCop(st, post); }
    if (st.cops.some(p => p.state === 'dead')) st.next = Math.max(st.next, now + 90);
    if (W.stars > 0 && d < 150 && now > (st.launch || 0) && cops().length < [0, 1, 2, 3, 4, 6][W.stars] + 1) {
      const v = VEH.find(o => o.caserma === st && !o.driver && !o.moved && !o.reserved && o !== P.car && o.health > 0);
      if (v) {
        st.launch = now + 7;
        const c = st.cops.filter(p => p.state !== 'dead' && !p.board).sort((a, b) => hyp(a.x - v.x, a.z - v.z) - hyp(b.x - v.x, b.z - v.z))[0];
        if (c && hyp(c.x - v.x, c.z - v.z) < 25) { c.board = v; c.boardT = 7; v.reserved = true; st.next = Math.max(st.next, now + 40); } else launchVolante(v);
      }
    }
  }
}
