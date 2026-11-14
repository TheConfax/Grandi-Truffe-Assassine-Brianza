// I nastri delle carreggiate (docs/nastri.md, src/nastri.py): ogni carreggiata con l'asse in quota, i due bordi e la sede. Si caricano all'avvio con il resto di
// ciò che deve essere intero (mappa/nastri.bin). Dal passo 3 le cose della strada portano scritto il numero del loro nastro e chiedono a lui la quota (nastroY,
// nastroPiano): niente più regole diverse per indovinare se una riga o un guardrail sta sopra o sotto un ponte.
// Con &nastri=1 nel link i due bordi di ogni nastro si disegnano alla loro quota, il colore dice la sede (giallo a raso, magenta ponte, azzurro galleria, arancio
// sotto); con &nastri=1 si vedono attraverso tutto (per guardarli da sopra e da sotto un ponte), con &nastri=2 stanno dietro a quello che li copre.
const NASTRI = { on: +((/[?&]nastri=([12])/.exec(location.search) || [0, 0])[1]), dati: null, per: new Map(), mesh: null, COL: [0xffd400, 0xff2bd6, 0x00e5ff, 0xff7a00], ALZA: 0.1, LARGO: 0.24 };
function nastriPrepara(j) { /* per ogni nastro le stazioni { x, z, y, lx, lz, rx, rz, s } e il suo riquadro */
  for (const n of j.nastri) { const a = n.a, p = n.p = []; let x0 = 1e9, z0 = 1e9, x1 = -1e9, z1 = -1e9; for (let k = 0; k < a.length; k += 7) { const q = { x: a[k] / 100, z: a[k + 1] / 100, y: a[k + 2] / 100, lx: a[k + 3] / 100, lz: a[k + 4] / 100, rx: a[k + 5] / 100, rz: a[k + 6] / 100, s: +n.s[k / 7] }; p.push(q); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); z0 = Math.min(z0, q.z); z1 = Math.max(z1, q.z); } n.a = null; n.bb = [x0, z0, x1, z1]; NASTRI.per.set(n.i, n); }
  NASTRI.dati = j; return j;
}
async function nastriCarica() { /* (i controlli lo chiamano ancora: i nastri ci sono già dall'avvio) */
  if (NASTRI.dati) return NASTRI.dati;
  const r = await fetch('mappa/nastri.bin?v=' + D.ver, FRESCO); if (!r.ok) throw new Error('nastri.bin HTTP ' + r.status);
  return nastriPrepara(JSON.parse(PZ_DEC.decode(await gunzip(await r.arrayBuffer()))));
}
if (typeof NASTRI_J !== 'undefined' && NASTRI_J) nastriPrepara(NASTRI_J);
// the height of the ribbons ns (their numbers) at the point of their axes nearest (x, z), within R m: [y, x of that point, z, distance, sede] or null
function nastroY(ns, x, z, R = 25) {
  let b = null;
  for (const i of ns || []) {
    const n = NASTRI.per.get(i); if (!n || x < n.bb[0] - R || x > n.bb[2] + R || z < n.bb[1] - R || z > n.bb[3] + R) continue;
    for (let k = 1; k < n.p.length; k++) { const A = n.p[k - 1], B = n.p[k], ex = B.x - A.x, ez = B.z - A.z, L2 = ex * ex + ez * ez || 1, t = Math.max(0, Math.min(1, ((x - A.x) * ex + (z - A.z) * ez) / L2)), px = A.x + ex * t, pz = A.z + ez * t, d = Math.hypot(x - px, z - pz); if (d < R && (!b || d < b[3])) b = [A.y + (B.y - A.y) * t, px, pz, d, B.s]; }
  }
  return b;
}
// the plane something of the ribbons ns lies on at (x, z): the top of the deck there at the height of its ribbon (within NASTRO_DZ), else null (the ground S); undefined when it has no ribbon here
const NASTRO_DZ = 1.2;
function nastroPiano(ns, x, z) {
  const q = nastroY(ns, x, z); if (!q) return undefined;
  let y = null; for (const o of H.deckAt(x, z)) if (o.tipo !== 'copertura' && Math.abs(o.top - q[0]) < NASTRO_DZ && (y === null || Math.abs(o.top - q[0]) < Math.abs(y - q[0]))) y = o.top;
  return y;
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
window.__NASTRI = { NASTRI, carica: nastriCarica, TILES, buildTile, freeTile, nastroY }; /* the tiles and their meshes too, for the check of the levels (src/controllo_livelli.mjs) */
