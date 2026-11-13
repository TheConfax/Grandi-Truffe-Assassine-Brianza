// ---------------------------------------------------------------- street furniture you can knock down: street lamps, traffic lights, level-crossing barriers
// Each prop is a post in the collision grid (dyn, so it can be switched off) plus a way to draw it falling: an Object3D whose origin is at its foot,
// or one instance of a per-tile InstancedMesh. Ram it hard enough and it tips over away from you, the car loses a little speed, a lamp goes dark.
// One collision per object, the same for the walker, every vehicle and the helicopter: its posts in WALLS. What a vehicle does to it depends on
// the blow (speed times the vehicle's mass, propForza) and on the group of the object (Carlo, 8/11): FORZA.leggero (signs, bollards, meters,
// bins, benches, columns, the fuel totem) goes at a gentle knock, FORZA.medio (lamp posts, bus shelters, bales, concrete blocks)
// needs speed and mass; what is never broken has no prop, only its wall. A weaker blow stops the vehicle; on foot nothing breaks.
// Knocked down, it stays solid as it falls and loses its walls only lying still on the ground (cadutaNuova, below).
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
const FALL = { kick: 0.22, kickMax: 3, spinta: 0.5, attrito: 6, attritoSteso: 20, rimbalzo: 0.2, fermo: 0.6, steso: Math.PI / 2 - 0.04 }; /* attritoSteso: lying, the whole of it grinds on the ground */
function breakProp(p, v, F) {
  if (p.broken) return; p.broken = true; p.wall.on = false; for (const w of p.pw || []) w.on = false; /* its standing walls: from now on its walls are those of the fall (cadutaNuova) */
  let o = p.obj, m0 = null;
  if (!o && p.inst) { o = new THREE.Object3D(); o.position.set(p.x, p.inst.base, p.z); o.updateMatrix(); m0 = propMatrici(p); } // a pivot at its foot: each instance turns about it from the matrix it had
  const L = clamp(p.h || 3, 0.8, 9);
  if (o) cadutaNuova(o, v, F, FORZA[p.forza || 'leggero'], L, propPezzi(p, o, L), m0, p);
  if (p.onBreak) p.onBreak();
  if (v) propUrto(v);
}
/* the pieces of a prop that falls, from the pivot at its foot: its post and its other posts, standing, and what else goes with it (p.pezzi: a level crossing's arm) */
function propPezzi(p, o, L) {
  const ox = o.position.x, oz = o.position.z, q = [[p.x - ox, 0, p.z - oz, p.x - ox, L, p.z - oz, p.r]];
  for (const w of p.pw || []) q.push([w.x - ox, 0, w.z - oz, w.x - ox, L, w.z - oz, w.r]);
  if (p.pezzi) q.push(...p.pezzi());
  return q;
}
/* WHAT FALLS STAYS SOLID UNTIL IT LIES ON THE GROUND (Carlo, 9/11: "cadono come burro, dovrebbero perdere la collisione solo quando sono completamente a terra").
   One way for everything knocked down (breakProp, a gate's leaf torn off): the body is a few straight pieces [x0, y0, z0, x1, y1, z1, r] from the pivot
   at its foot, turned with it; the part of each under CADUTA.alto is in WALLS where it is at that moment, circles at its two ends and a segment between
   (two along its sides when it is thick), so the walker, every vehicle and the helicopter meet it as any wall. A vehicle meets only the part under
   CADUTA.auto (its roof): over that the body leans on it (cadutaDentro), the walker meets it up to CADUTA.alto. The vehicle that knocked it down, and any
   other over its threshold, push it instead (cadutaUrti): the body takes the vehicle's speed along the push and goes on falling ahead of it, the vehicle
   goes on (it lost its share once, propUrto). Falling or pushed, it stops against a wall or a vehicle (cadutaBloccata) and leans there. Its walls go only
   once it lies still on the ground (giu) */
const CADUTA = { auto: 1.5, alto: 2.0, passo: 0.5, grosso: 0.3, urto: 0, margine: 0.05, basso: 0.6 }; /* basso: held still with its top under this (on a kerb, a low wall), it lies on the ground */
function cadutaNuova(o, v, F, soglia, L, pezzi, m0, p) {
  let dx = v ? v.vx : 1, dz = v ? v.vz : 0; const l = hyp(dx, dz) || 1; dx /= l; dz /= l; // tips over along the vehicle's way
  const sp = v ? v.speed : 0, ecc = F ? clamp(F / soglia - 1, 0, 1) : 0, mk = r => ({ r, x: 0, z: 0, dyn: true, on: true, y0: 0, y1: 0, bb: null }), ms = () => ({ ax: 0, az: 0, bx: 0, bz: 0, nx: 0, nz: 0, two: true, dyn: true, on: true, y0: 0, y1: 0, bb: null });
  const f = { o, p, axis: new THREE.Vector3(dz, 0, -dx), m0, L, a: 0, w: Math.min(FALL.kickMax, FALL.kick * sp / L) + 0.1, vx: dx * sp * FALL.spinta * ecc, vz: dz * sp * FALL.spinta * ecc, x0: o.position.x, y0: o.position.y, z0: o.position.z, giu: false, t: 0,
    dx, dz, soglia, urtati: new Set(v ? [v.chi || v] : []), attivo: true, muri: [], mie: new Set() };
  for (const q of pezzi) { const m = { q, ws: [mk(q[6]), mk(q[6]), ms(), ms(), mk(q[6]), mk(q[6]), ms(), ms()] }; f.muri.push(m); for (const w of m.ws) f.mie.add(w); }
  PROP_FALL.push(f); cadutaMuri(f); return f;
}
function cadRuota(f, x, y, z, ca, sa) { /* a point of the body, from its pivot, turned by the fall: [x, y, z] from the pivot */
  const s = x * f.dx + z * f.dz, t = -x * f.dz + z * f.dx, s2 = s * ca + y * sa;
  return [f.dx * s2 - f.dz * t, y * ca - s * sa, f.dz * s2 + f.dx * t];
}
function cadMuro(w, on, x0, z0, x1, z1) { /* a wall of a falling body in and out of WALLS, where it is now */
  if (w.bb) { WALLS.del(w.bb[0], w.bb[1], w.bb[2], w.bb[3], w); w.bb = null; }
  w.on = on; if (on) { w.bb = [x0, z0, x1, z1]; WALLS.add(x0, z0, x1, z1, w); }
}
function cadutaMuri(f) {
  const o = f.o.position, ca = Math.cos(f.a), sa = Math.sin(f.a);
  for (const m of f.muri) {
    if (!f.attivo) { for (const w of m.ws) cadMuro(w, false); continue; }
    const q = m.q, A = cadRuota(f, q[0], q[1], q[2], ca, sa), B = cadRuota(f, q[3], q[4], q[5], ca, sa);
    cadBanda(o, q[6], A, B, -0.5, CADUTA.auto, m.ws.slice(0, 4), false); cadBanda(o, q[6], A, B, CADUTA.auto, CADUTA.alto, m.ws.slice(4), true);
  }
}
/* the part of a piece (A to B from the pivot o) between heights H0 and H1, in WALLS: circles at its ends, a segment between (two when it is thick).
   sopra: over the roof of a vehicle, the walker meets it and a vehicle does not (yv under the height a vehicle checks, collideStatic) */
function cadBanda(o, r, A, B, H0, H1, ws, sopra) {
  const [c0, c1, s0, s1] = ws, dh = B[1] - A[1]; let t0 = 0, t1 = 1;
  if (Math.abs(dh) < 1e-6) { if (A[1] < H0 || A[1] > H1) t1 = -1; }
  else { let u0 = (H0 - A[1]) / dh, u1 = (H1 - A[1]) / dh; if (u0 > u1) { const k = u0; u0 = u1; u1 = k; } t0 = Math.max(0, u0); t1 = Math.min(1, u1); }
  if (t1 < t0) { for (const w of ws) cadMuro(w, false); return; } /* none of it in this band */
  const ax = o.x + A[0] + (B[0] - A[0]) * t0, az = o.z + A[2] + (B[2] - A[2]) * t0, bx = o.x + A[0] + (B[0] - A[0]) * t1, bz = o.z + A[2] + (B[2] - A[2]) * t1;
  const y0 = o.y - 3, y1 = o.y + Math.max(A[1] + dh * t0, A[1] + dh * t1) + 0.25, L = hyp(bx - ax, bz - az);
  for (const w of ws) { w.y0 = y0; w.y1 = y1; if (sopra) w.yv = o.y + 0.2; }
  c0.x = ax; c0.z = az; cadMuro(c0, true, ax - r - 0.2, az - r - 0.2, ax + r + 0.2, az + r + 0.2);
  if (L < 0.05) { cadMuro(c1, false); cadMuro(s0, false); cadMuro(s1, false); return; }
  c1.x = bx; c1.z = bz; cadMuro(c1, true, bx - r - 0.2, bz - r - 0.2, bx + r + 0.2, bz + r + 0.2);
  const nx = -(bz - az) / L, nz = (bx - ax) / L, e = r < CADUTA.grosso ? 0 : r;
  for (const [w, k] of [[s0, 1], [s1, -1]]) {
    if (k < 0 && !e) { cadMuro(w, false); continue; }
    w.ax = ax + nx * e * k; w.az = az + nz * e * k; w.bx = bx + nx * e * k; w.bz = bz + nz * e * k; w.nx = nx * k; w.nz = nz * k;
    cadMuro(w, true, Math.min(w.ax, w.bx), Math.min(w.az, w.bz), Math.max(w.ax, w.bx), Math.max(w.az, w.bz));
  }
}
/* points along the body with its pivot at (x, z) and turned by a: [x, z, y, r] */
function cadutaPunti(f, x, z, a) {
  const ca = Math.cos(a), sa = Math.sin(a), gy = f.y0 + H.ground(x, z) - H.ground(f.x0, f.z0), out = [];
  for (const m of f.muri) {
    const q = m.q, n = Math.max(2, Math.ceil(hyp(q[3] - q[0], q[4] - q[1], q[5] - q[2]) / CADUTA.passo) + 1), r = Math.min(q[6], CADUTA.grosso);
    for (let i = 0; i < n; i++) { const t = i / (n - 1), P = cadRuota(f, q[0] + (q[3] - q[0]) * t, q[1] + (q[4] - q[1]) * t, q[2] + (q[5] - q[2]) * t, ca, sa); out.push([x + P[0], z + P[2], gy + P[1], r]); }
  }
  return out;
}
const cadutaMuro = (f, P) => !!collideStatic({ x: P[0], z: P[1] }, P[3], P[2], false, f.mie); /* a point of the body inside a wall, not its own */
function cadutaDentro(P, vs) { /* how deep a point of the body is in a vehicle (not one pushing it): its box, up to its roof there (salto3.js vehTopAt); 0 outside */
  let d = 0;
  for (const v of vs) {
    const S = v.spec, sh = Math.sin(v.h), ch = Math.cos(v.h), ex = P[0] - v.x, ez = P[1] - v.z, lz = ex * sh + ez * ch, lx = ex * ch - ez * sh;
    const a = S.W / 2 + P[3] - Math.abs(lx), b = S.L / 2 + P[3] - Math.abs(lz); if (a <= 0 || b <= 0 || P[2] < v.y - 0.1) continue;
    const t = vehTopAt(v, clamp(lx, -S.W / 2, S.W / 2), clamp(lz, -S.L / 2, S.L / 2)), c = v.y + (t === null ? vehMaxTop(v) : t) - P[2]; if (c > 0) d = Math.max(d, Math.min(a, b, c));
  }
  return d;
}
/* moving the pivot to (x, z) and turning it to a, the body goes into a wall it was not in already, or deeper into a vehicle */
function cadutaBloccata(f, x, z, a) {
  const o = f.o.position, R = f.L + 6, vs = VEH.filter(v => !v.heli && !f.urtati.has(v) && Math.abs(v.x - x) < R && Math.abs(v.z - z) < R);
  const B = cadutaPunti(f, x, z, a); let A = null;
  for (let i = 0; i < B.length; i++) {
    const m = cadutaMuro(f, B[i]), d = vs.length ? cadutaDentro(B[i], vs) : 0; if (!m && d <= 0) continue;
    if (!A) A = cadutaPunti(f, o.x, o.z, f.a);
    if (m && !cadutaMuro(f, A[i]) || d > 0 && d > cadutaDentro(A[i], vs) + 1e-4) return true;
  }
  return false;
}
function cadutaSposta(f, x, z) { const o = f.o.position; o.x = x; o.z = z; o.y = f.y0 + H.ground(x, z) - H.ground(f.x0, f.z0); cadutaMuri(f); }
/* how far the discs [x, z, r] of a vehicle between heights ya and yb are in a falling body's walls: [depth, nx, nz] towards the body, or null */
function cadutaContatto(f, dischi, ya, yb, q, veh) {
  let best = 0, nx = 0, nz = 0;
  for (const m of f.muri) for (const w of m.ws) {
    if (!w.bb || yb < w.y0 || ya > (veh && w.yv !== undefined ? w.yv : w.y1)) continue;
    for (const [cx, cz, r] of dischi) {
      let px, pz, R = r + CADUTA.margine;
      if (w.r !== undefined) { px = w.x; pz = w.z; R += w.r; }
      else { const ex = w.bx - w.ax, ez = w.bz - w.az, t = clamp(((cx - w.ax) * ex + (cz - w.az) * ez) / (ex * ex + ez * ez || 1), 0, 1); px = w.ax + ex * t; pz = w.az + ez * t; }
      const dx = px - cx, dz = pz - cz, d = hyp(dx, dz), pen = R - d; if (pen <= best) continue;
      best = pen; if (d > 1e-6) { nx = dx / d; nz = dz / d; } else { const l = hyp(q.vx, q.vz) || 1; nx = q.vx / l; nz = q.vz / l; }
    }
  }
  return best > 0 ? [best, nx, nz] : null;
}
/* a vehicle (chi; q its speed, F its blow) against the bodies falling: the one that knocked it down and any other over its threshold push it away,
   at their speed along the push; one under it meets it as a wall (collideStatic, heliPush). Pinned against something, it is a wall for all */
function cadutaUrti(chi, dischi, q, F, ya, yb) {
  let hit = false;
  for (const f of PROP_FALL) {
    if (!f.attivo) continue;
    const o = f.o.position, mio = f.urtati.has(chi); if (!mio && F < f.soglia) continue;
    if (Math.abs(dischi[0][0] - o.x) > f.L + 8 || Math.abs(dischi[0][1] - o.z) > f.L + 8) continue;
    let nx = 0, nz = 0, tocco = false; const sp = hyp(q.vx, q.vz), vie = [null]; if (sp > 0.1) vie.push([q.vx / sp, q.vz / sp]);
    for (let k = 0; k < 4; k++) {
      const c = cadutaContatto(f, dischi, ya, yb, q, !chi.heli); if (!c) break;
      tocco = true; vie[0] = [c[1], c[2]]; let mosso = false;
      for (const [ux, uz] of vie) { /* away from the vehicle; held there (its edge along a fence), along the vehicle's way: it scrapes along */
        const kk = ux * c[1] + uz * c[2]; if (kk < 0.3) continue;
        const x = o.x + ux * c[0] / kk, z = o.z + uz * c[0] / kk; if (cadutaBloccata(f, x, z, f.a)) continue;
        cadutaSposta(f, x, z); nx = ux; nz = uz; mosso = true; break;
      }
      if (!mosso) break;
    }
    if (!tocco) continue;
    if (!mio) { f.urtati.add(chi); propUrto(q); hit = true; }
    const vr = (q.vx - f.vx) * nx + (q.vz - f.vz) * nz; if (vr > 0) { f.vx += nx * vr * (1 + CADUTA.urto); f.vz += nz * vr * (1 + CADUTA.urto); }
  }
  return hit;
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
function propSpingi(p, v) { // pushed: a block takes the vehicle's way at part of its speed; a bale (heavy, 300-500 kg) rolls only across its axis like a wheel, or grinds a little along it
  const l = hyp(v.vx, v.vz) || 1, prima = !p.moving;
  if (p.via === 'rotola') {
    const ry = p.inst ? p.inst.ry : 0, ax = Math.cos(ry), az = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry); /* axis of the cylinder, and the way it rolls (across it) */
    p.vx = p.vx || 0; p.vz = p.vz || 0;
    const vn = v.vx * nx + v.vz * nz, va = v.vx * ax + v.vz * az;
    let bn = p.vx * nx + p.vz * nz, ba = p.vx * ax + p.vz * az;
    const tn = clamp(vn * 0.7, -6, 6), ta = clamp(va * 0.25, -2, 2);
    if (Math.abs(tn) > Math.abs(bn)) bn = tn; if (Math.abs(ta) > Math.abs(ba)) ba = ta;
    p.vx = nx * bn + ax * ba; p.vz = nz * bn + az * ba;
  } else { const k = 0.6; p.vx = v.vx / l * v.speed * k; p.vz = v.vz / l * v.speed * k; }
  const cy = p.cy || 0;
  if (!p.moving) { p.moving = true; PROP_MOVE.push(p); if (p.inst) { p.mo = new THREE.Object3D(); p.mo.position.set(p.x, p.y + cy, p.z); p.mo.updateMatrix(); p.m0 = propMatrici(p); p.p0 = [p.x, p.y + cy, p.z]; } }
  if (prima || p.via !== 'rotola') propUrto(v); else { v.vx *= 0.985; v.vz *= 0.985; } /* one blow, then it is only pushed along */
}
function propHits(v) {
  tombHits(v);
  const F = propForza(v);
  propHitsDopo(v, F);
  if (PROP_FALL.length) cadutaUrti(v, v.circles().map(c => [c[0], c[1], v.rad]), v, F, v.y + 0.4, v.y + 0.4); /* what falls, after what it knocks down in the same step */
}
function propHitsDopo(v, F) {
  if (F < FORZA.leggero) return;
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
  const sp = hyp(e.vx, e.vz), F = sp * heliMassa();
  const q = { vx: e.vx, vz: e.vz, speed: sp, chi: e }; let hit = false;
  if (F >= FORZA.leggero) for (const [cx, cz, r] of dischi) PROPG.each(cx - r - 3, cz - r - 3, cx + r + 3, cz + r + 3, p => {
    if (p.broken || F < FORZA[p.forza || 'leggero'] || yb < p.wall.y0 || ya > p.wall.y1) return;
    if (hyp(cx - p.x, cz - p.z) < r + p.r + 0.15 || (p.pw || []).some(w => hyp(cx - w.x, cz - w.z) < r + w.r + 0.15)) { if (p.via) { if (!p.moving || hyp(p.vx, p.vz) < sp * 0.5) propSpingi(p, q); } else breakProp(p, q, F); hit = true; }
  });
  if (PROP_FALL.length && cadutaUrti(e, dischi, q, F, ya, yb)) hit = true;
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
    const o = f.o.position, sv = hyp(f.vx, f.vz);
    if (sv > 0) { /* its foot slides, to a stop; not into a wall or a vehicle */
      const k = Math.max(0, sv - (f.giu ? FALL.attritoSteso : FALL.attrito) * dt) / sv; f.vx *= k; f.vz *= k;
      const x = o.x + f.vx * dt, z = o.z + f.vz * dt;
      if (f.attivo && cadutaBloccata(f, x, z, f.a)) { f.vx = 0; f.vz = 0; } else { o.x = x; o.z = z; o.y = f.y0 + H.ground(o.x, o.z) - H.ground(f.x0, f.z0); }
    }
    if (!f.giu) {
      f.w += 1.5 * 9.81 / f.L * Math.sin(Math.max(0.02, f.a)) * dt; let da = f.w * dt, terra = false;
      if (f.a + da >= FALL.steso) { da = FALL.steso - f.a; terra = true; }
      if (da > 0 && f.attivo && cadutaBloccata(f, o.x, o.z, f.a + da)) { f.w = 0; if (f.L * Math.cos(f.a) < CADUTA.basso) f.giu = true; } /* against a wall or a vehicle: it leans there, as long as that stays; low and still, it lies */
      else {
        if (terra) { if (f.w > FALL.fermo) f.w = -f.w * FALL.rimbalzo; else { f.w = 0; f.giu = true; } } /* the ground: a small bounce, then still */
        f.a += da; f.o.rotateOnWorldAxis(f.axis, da);
      }
    }
    if (f.attivo) { if (f.giu) f.attivo = false; cadutaMuri(f); } /* lying still on the ground, it loses its walls */
    if (f.m0) propScrivi(f.p, f.o, f.m0, f.p.x, f.p.inst.base, f.p.z); else f.o.updateMatrix();
    if (f.giu && hyp(f.vx, f.vz) < 0.01 || f.giu && f.t > 30) PROP_FALL.splice(i, 1);
  }
  for (let i = PROP_MOVE.length - 1; i >= 0; i--) { // rolling and sliding: friction, the walls round it, its own wall going with it
    const p = PROP_MOVE[i]; let sp = hyp(p.vx, p.vz), ns, k;
    if (p.via === 'rotola') { /* rolling on grass stops soon (4.5 m/s2); grinding on its flat side stops at once (9) */
      const ry = p.inst ? p.inst.ry : 0, ax = Math.cos(ry), az = -Math.sin(ry), nx = Math.sin(ry), nz = Math.cos(ry);
      let bn = p.vx * nx + p.vz * nz, ba = p.vx * ax + p.vz * az;
      bn = Math.sign(bn) * Math.max(0, Math.abs(bn) - 4.5 * dt); ba = Math.sign(ba) * Math.max(0, Math.abs(ba) - 9 * dt);
      p.vx = nx * bn + ax * ba; p.vz = nz * bn + az * ba; ns = hyp(p.vx, p.vz); k = 1; p.nx = nx; p.nz = nz;
    } else { ns = Math.max(0, sp - 7 * dt); k = sp > 1e-6 ? ns / sp : 0; p.vx *= k; p.vz *= k; }
    const q = { x: p.x + p.vx * dt, z: p.z + p.vz * dt }, gq = H.ground(q.x, q.z);
    if (collideStatic(q, p.r, gq + 0.4, true, new Set([p.wall, ...(p.pw || [])]))) { p.vx *= 0.3; p.vz *= 0.3; }
    const mx = q.x - p.x, mz = q.z - p.z, w = p.wall, r = p.r + 0.2;
    WALLS.del(p.x - r, p.z - r, p.x + r, p.z + r, w); PROPG.del(p.x - 3, p.z - 3, p.x + 3, p.z + 3, p);
    p.x = q.x; p.z = q.z; const gy = H.ground(p.x, p.z), dy = gy - p.y; p.y = gy; w.x = p.x; w.z = p.z; w.y0 += dy; w.y1 += dy; if (w.sali) w.sali.top += dy;
    WALLS.add(p.x - r, p.z - r, p.x + r, p.z + r, w); PROPG.add(p.x - 3, p.z - 3, p.x + 3, p.z + 3, p);
    if (p.mo) {
      p.mo.position.set(p.x, p.y + (p.cy || 0), p.z); const dn = mx * (p.nx || 0) + mz * (p.nz || 0);
      if (p.via === 'rotola' && Math.abs(dn) > 1e-7) p.mo.rotateOnWorldAxis(new THREE.Vector3(p.nz, 0, -p.nx), dn / 0.75); /* turns about its own axis, as a wheel: only the way across it is rolling */
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
