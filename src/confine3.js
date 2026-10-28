// the edge of the area drawn from the DBGT (docs/motore.md, section 7): a tall red see-through wall along the boundary of every active comune,
// like the border of a Minecraft world, so you can tell when you leave the part made properly; the same line goes on the minimap and on the
// big map (assemble3.py). The rings come from the COMUNE layer of each active DBGT (src/confine_dbgt.py -> confine_dbgt.json)
const CONFINE = await (async () => { try { const r = await fetch('confine_dbgt.json', { cache: 'no-cache' }); if (!r.ok) return []; const j = await r.json(); return j && j.ver === 1 ? j.comuni : []; } catch (e) { return []; } })();
{
  const WALL_H = 150, mat = new THREE.MeshBasicMaterial({ color: 0xff2a1a, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false, fog: false });
  for (const c of CONFINE) {
    const p = c.p, pos = [];
    for (let i = 0; i < p.length; i++) {
      const a = p[i], b = p[(i + 1) % p.length], ya = H.ground(a[0], a[1]) - 5, yb = H.ground(b[0], b[1]) - 5; // from under the ground: no gap on the slopes
      pos.push(a[0], ya, a[1], b[0], yb, b[1], b[0], yb + WALL_H, b[1], a[0], ya, a[1], b[0], yb + WALL_H, b[1], a[0], ya + WALL_H, a[1]);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    const m = new THREE.Mesh(g, mat); m.renderOrder = 20; m.frustumCulled = false; scene.add(m);
  }
}
