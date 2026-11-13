// I nastri delle carreggiate (docs/nastri.md passo 1, src/nastri.py): con &nastri=1 nel link i due bordi di ogni nastro disegnati alla loro quota, il colore dice la sede
// (giallo a raso, magenta ponte, azzurro galleria, arancio trincea). Con &nastri=1 si vedono attraverso tutto (per guardarli da sopra e da sotto un ponte), con &nastri=2
// stanno dietro a quello che li copre. Senza il parametro niente si carica e niente si disegna: il gioco non cambia.
const NASTRI = { on: +((/[?&]nastri=([12])/.exec(location.search) || [0, 0])[1]), dati: null, mesh: null, COL: [0xffd400, 0xff2bd6, 0x00e5ff, 0xff7a00], ALZA: 0.1, LARGO: 0.24 };
async function nastriCarica() { /* mappa/nastri.bin: per ogni nastro le stazioni { x, z, y, lx, lz, rx, rz, s } */
  if (NASTRI.dati) return NASTRI.dati;
  const r = await fetch('mappa/nastri.bin?v=' + D.ver, FRESCO); if (!r.ok) throw new Error('nastri.bin HTTP ' + r.status);
  const j = JSON.parse(PZ_DEC.decode(await gunzip(await r.arrayBuffer())));
  for (const n of j.nastri) { const a = n.a, p = n.p = []; for (let k = 0; k < a.length; k += 7) p.push({ x: a[k] / 100, z: a[k + 1] / 100, y: a[k + 2] / 100, lx: a[k + 3] / 100, lz: a[k + 4] / 100, rx: a[k + 5] / 100, rz: a[k + 6] / 100, s: +n.s[k / 7] }); n.a = null; }
  return NASTRI.dati = j;
}
function nastriDisegna(j) { /* ogni bordo una fettuccia piatta larga LARGO, ALZA sopra la quota del nastro */
  const pos = [], col = [], idx = [], c = new THREE.Color(), H2 = NASTRI.LARGO / 2;
  for (const n of j.nastri) for (const [kx, kz] of [['lx', 'lz'], ['rx', 'rz']]) {
    let v0 = -1;
    for (let k = 0; k < n.p.length; k++) {
      const q = n.p[k]; let ux = q[kx] - q.x, uz = q[kz] - q.z; const L = Math.hypot(ux, uz); if (L < 0.05) { v0 = -1; continue; } ux /= L; uz /= L; /* senza bordo misurato: niente */
      const v = pos.length / 3, y = q.y + NASTRI.ALZA; pos.push(q[kx] - ux * H2, y, q[kz] - uz * H2, q[kx] + ux * H2, y, q[kz] + uz * H2);
      c.setHex(NASTRI.COL[q.s] || 0xffffff); col.push(c.r, c.g, c.b, c.r, c.g, c.b);
      if (v0 >= 0) idx.push(v0, v0 + 1, v, v0 + 1, v + 1, v);
      v0 = v;
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false, toneMapped: false, depthTest: NASTRI.on === 2, depthWrite: false, transparent: true }));
  m.frustumCulled = false; m.renderOrder = 999; scene.add(m); NASTRI.mesh = m;
}
if (NASTRI.on) nastriCarica().then(nastriDisegna).catch(e => console.warn('nastri:', e.message));
window.__NASTRI = { NASTRI, carica: nastriCarica, TILES, buildTile, freeTile }; /* the tiles and their meshes too, for the check of the levels (src/controllo_livelli.mjs) */
