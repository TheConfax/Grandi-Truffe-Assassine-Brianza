// ---------------------------------------------------------------- street furniture you can knock down: street lamps, traffic lights, level-crossing barriers
// Each prop is a post in the collision grid (dyn, so it can be switched off) plus a way to draw it falling: an Object3D whose origin is at its foot,
// or one instance of a per-tile InstancedMesh. Ram it fast enough and it tips over away from you, the car loses a little speed, a lamp goes dark.
const PROPS = [], PROPG = new Grid(16), PROP_FALL = [];
function addProp(p) { // { x, z, r, obj | inst: { meshes, i, ry, base }, onBreak }
  p.wall = { r: p.r, x: p.x, z: p.z, dyn: true, on: true, y0: p.y - 3, y1: p.y + (p.h || 6) };
  if (p.sali) p.wall.sali = { rs: p.sali.rs, top: p.y + p.sali.dy }; if (p.scav) p.wall.scav = true; // climbing on foot (salto3.js): stand on it, go over it
  WALLS.add(p.x - p.r - 0.2, p.z - p.r - 0.2, p.x + p.r + 0.2, p.z + p.r + 0.2, p.wall);
  PROPS.push(p); PROPG.add(p.x - 2, p.z - 2, p.x + 2, p.z + 2, p); return p;
}
function breakProp(p, v) {
  if (p.broken) return; p.broken = true; p.wall.on = false;
  let dx = v ? v.vx : 1, dz = v ? v.vz : 0; const l = hyp(dx, dz) || 1; dx /= l; dz /= l;
  const axis = new THREE.Vector3(dz, 0, -dx); // tips over along the car's way
  let o = p.obj;
  if (!o && p.inst) { o = new THREE.Object3D(); o.position.set(p.x, p.inst.base, p.z); o.rotation.y = p.inst.ry; if (p.inst.sx) o.scale.set(p.inst.sx, 1, 1); o.updateMatrix(); } // sx: a panel stretched to its length
  if (o) PROP_FALL.push({ o, p, axis, a: 0, w: 0.6 + (v ? Math.min(2.5, v.speed * 0.08) : 0), max: 1.42 + Math.random() * 0.12 });
  if (p.onBreak) p.onBreak();
  if (v) { const sp = v.speed; v.vx *= 0.86; v.vz *= 0.86; v.health = Math.max(0, v.health - 2); if (v === P.car) { sfxCrash(Math.min(10, sp)); shake = Math.max(shake, 0.25); } }
}
function propHits(v) {
  if (v.speed < 3.5) return;
  PROPG.each(v.x - 4, v.z - 4, v.x + 4, v.z + 4, p => {
    if (p.broken || Math.abs(v.y - p.y) > 3) return;
    for (const c of v.circles()) if (hyp(c[0] - p.x, c[1] - p.z) < v.rad + p.r + 0.15) { breakProp(p, v); return; }
  });
  // a lowered level-crossing arm across the road snaps off and flies
  for (const g of LX) if (g.bars && Math.abs(g.x - v.x) < 14 && Math.abs(g.z - v.z) < 14) for (const b of g.bars) {
    if (b.broken || b.armGone || !b.seg.on) continue;
    for (const c of v.circles()) if (segDist(c[0], c[1], b.seg.ax, b.seg.az, b.seg.bx, b.seg.bz) < v.rad + 0.2) { snapArm(b, v); break; }
  }
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
    const f = PROP_FALL[i]; f.w += 7 * Math.sin(Math.max(0.15, f.a)) * dt; const da = Math.min(f.max - f.a, f.w * dt); f.a += da;
    f.o.rotateOnWorldAxis(f.axis, da);
    if (f.p.inst) { f.o.updateMatrix(); for (const m of f.p.inst.meshes) { m.setMatrixAt(f.p.inst.i, f.o.matrix); m.instanceMatrix.needsUpdate = true; } }
    if (f.a >= f.max - 1e-4) PROP_FALL.splice(i, 1);
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
