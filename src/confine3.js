// the two barriers you can see (src/confine_dbgt.py -> confine_dbgt.json), simple coloured signals for now: the red one where the playable zone ends (data/confine_gioco/confine_gioco.kml),
// the yellow one where the high quality zone ends (DBGT of an active comune with LiDAR DTM and DSM, from the data). You see them from far and you go through them, on foot and in a car: they are not solid,
// by decision of Carlo; what stops you is the limit of the zone (ZONA). The same lines go on the minimap and on the big map (assemble3.py)
const CONF_LINEE = await (async () => {
  let j = {}; try { const r = await fetch('confine_dbgt.json', { cache: 'no-cache' }); if (r.ok) j = await r.json(); } catch (e) { /* no barriers */ }
  return [{ col: 0xff2a1a, css: 'rgba(255,60,40,.9)', anelli: j.rossa || [] }, { col: 0xffd400, css: 'rgba(255,212,0,.9)', anelli: j.gialla || [] }];
})();
// the heights come from the bake (COT.confine, the ground of all the map), one list per line, one per ring
function confineQuote() { return CONF_LINEE.map(L => L.anelli.map(c => c.map(q => Math.round(H.ground(q[0], q[1]) * 1000)))); }
// one mesh per barrier, always there, whatever tile is loaded: it never appears in jerks under your nose, it follows the ground, a few thousand triangles and one draw each with a plain material
function confineMuri() {
  const SOTTO = 5, BANDA = 12, ALTO = 150, A0 = 0.5, A1 = 0.1, Q = COT && COT.confine ? COT.confine : confineQuote(); // from under the ground (no gap on the slopes), the band that reads up to BANDA, fading up to ALTO
  CONF_LINEE.forEach((L, li) => {
    const pos = [], col = [], idx = [], c = new THREE.Color(L.col);
    L.anelli.forEach((p, ci) => {
      const v0 = pos.length / 3, n = p.length;
      for (let i = 0; i < n; i++) {
        const y = Q[li][ci][i] / 1000;
        for (const [d, a] of [[-SOTTO, A0], [BANDA, A0], [ALTO, A1]]) { pos.push(p[i][0], y + d, p[i][1]); col.push(c.r, c.g, c.b, a); }
        const k = v0 + i * 3, h = v0 + ((i + 1) % n) * 3;
        idx.push(k, h, h + 1, k, h + 1, k + 1, k + 1, h + 1, h + 2, k + 1, h + 2, k + 2);
      }
    });
    if (!pos.length) return;
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 4)); g.setIndex(idx);
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, side: THREE.DoubleSide, depthWrite: false, fog: false, toneMapped: false }));
    m.renderOrder = 20; m.frustumCulled = false; m.name = 'barriera' + li; scene.add(m);
  });
}
if (!TUTTO) confineMuri();
function confineTile(T) { }
function confineMesh(T, G) { }
