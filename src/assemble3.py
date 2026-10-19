import re
import os
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
s = open(os.path.join(HERE, 'game.src.html'), encoding='utf-8').read()
def rep(old, new, cnt=1):
    global s
    assert s.count(old) == cnt, (s.count(old), old[:100])
    s = s.replace(old, new)
def cut(a, b, new):
    global s
    i = s.index(a); j = s.index(b, i)
    s = s[:i] + new + s[j:]

# ---- module script + async data load with progress
rep('<script id="mapdata" type="application/json">/*__MAP__*/</script>\n', '')
rep("""<script>
'use strict';""", """<script type="module">""")
rep("const D = JSON.parse(document.getElementById('mapdata').textContent);", """const goBtn = document.getElementById('go');
goBtn.disabled = true; goBtn.textContent = 'CARICO LA BRIANZA…';
const D = await (async () => {
  const res = await fetch('brianza.json'); const total = +res.headers.get('content-length') || 0;
  if (!res.body || !total) return res.json();
  const rd = res.body.getReader(), chunks = []; let got = 0;
  for (;;) { const { done, value } = await rd.read(); if (done) break; chunks.push(value); got += value.length; goBtn.textContent = `CARICO LA BRIANZA… ${Math.round(got / total * 100)}%`; }
  const all = new Uint8Array(got); let o = 0; for (const c of chunks) { all.set(c, o); o += c.length; }
  return JSON.parse(new TextDecoder().decode(all));
})();
goBtn.textContent = 'COSTRUISCO LE STRADE…';
await new Promise(r => setTimeout(r, 30));""")
rep("const LIM_X = D.hw + 95, LIM_Z = D.hh + 95;", "const META = D.meta, LIM_X = META.hw - 4, LIM_Z = META.hh - 4;")
rep("const N = D.nodes;", """const N = [], NHt = [];
for (let i = 0; i < D.nodes.length; i += 3) { N.push([D.nodes[i] / 10, D.nodes[i + 1] / 10]); NHt.push(D.nodes[i + 2] === -32768 ? null : D.nodes[i + 2] / 10); }
const dec = a => { const o = []; let x = 0, z = 0; for (let i = 0; i < a.length; i += 2) { x += a[i]; z += a[i + 1]; o.push([x / 10, z / 10]); } return o; };""")
rep("const STREETS = new Grid(24); // named road segments\nconst JUNC = new Grid(16);\n", "")
rep("""function mkMesh(b, mat, ro, shadow) {""", """function mkMesh(b, mat, ro, shadow, parent = scene) {""")
rep("  if (b.drape) for (let i = 0; i < b.p.length; i += 3) b.p[i + 1] += groundH(b.p[i], b.p[i + 2]);", "  if (b.drape) for (let i = 0; i < b.p.length; i += 3) b.p[i + 1] += b.vis ? visH(b.p[i], b.p[i + 2]) : groundH(b.p[i], b.p[i + 2]);")
rep("""  scene.add(m); return m;
}
const flatMat""", """  parent.add(m); return m;
}
const flatMat""")

# ---- world: replace everything from "the world" to "audio" with the tiled world + level-aware collisions
world = open(os.path.join(HERE, 'world3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'landmarks3.js'), encoding='utf-8').read()
coll = """
// ---------------------------------------------------------------- collisions (walls can be limited to a height band: guardrails, embankments, pillars)
function collideStatic(p, r, y) {
  let nx = 0, nz = 0, hit = false;
  WALLS.each(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1, s => {
    if (s.y0 !== undefined && (y === undefined || y < s.y0 || y > s.y1)) return;
    if (s.r) { const dx = p.x - s.x, dz = p.z - s.z, d = hyp(dx, dz), R = r + s.r; if (d < R && d > 1e-6) { const k = (R - d) / d; p.x += dx * k; p.z += dz * k; nx += dx / d; nz += dz / d; hit = true; } return; }
    if (s.dyn && !s.on) return;
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez; if (L2 < 1e-6) return;
    let t = ((p.x - s.ax) * ex + (p.z - s.az) * ez) / L2, cl = false; if (t < 0) { t = 0; cl = true; } else if (t > 1) { t = 1; cl = true; }
    const cx = s.ax + ex * t, cz = s.az + ez * t, dx = p.x - cx, dz = p.z - cz, d = hyp(dx, dz);
    if (s.two || dx * s.nx + dz * s.nz >= 0 || cl) { if (d < r && d > 1e-6) { const k = (r - d) / d; p.x += dx * k; p.z += dz * k; nx += dx / d; nz += dz / d; hit = true; } }
    else if (d < r) { p.x += s.nx * (r + d); p.z += s.nz * (r + d); nx += s.nx; nz += s.nz; hit = true; }
  });
  if (!hit) return null; const l = hyp(nx, nz) || 1; return [nx / l, nz / l];
}
function rayWalls(ax, az, bx, bz, solidOnly) {
  let best = 1; const dx = bx - ax, dz = bz - az;
  WALLS.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), s => {
    if (s.r || s.dyn || s.deckw || (solidOnly && s.two)) return; const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return;
    const t = ((s.ax - ax) * ez - (s.az - az) * ex) / den, u = ((s.ax - ax) * dz - (s.az - az) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < best) best = t;
  });
  return best;
}
"""
cut("// ---------------------------------------------------------------- the world\n", "// ---------------------------------------------------------------- audio\n",
    "// ---------------------------------------------------------------- the world\nconst ground = new THREE.Mesh(new THREE.PlaneGeometry(12000, 12000), new THREE.MeshLambertMaterial({ map: groundTex, depthWrite: false }));\ngroundTex.repeat.set(1200, 1200); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; ground.receiveShadow = true; ground.renderOrder = -4; scene.add(ground);\n" + coll + world + "\n")
# ---- trains
cut("// ---------------------------------------------------------------- train (Ferrovia Milano-Asso)\n", "// ---------------------------------------------------------------- spawning helpers\n", open(os.path.join(HERE, 'trains3.js'), encoding='utf-8').read() + "\n")
rep("if (TR) for (const c of TR.circ) check(c[0], c[1]);", "for (const c of TRAIN_CIRC) check(c[0], c[1]);")
rep("if (TR) for (const [cx, cz, tvx, tvz] of TR.circ) {\n    for (const v of VEH)", "for (const [cx, cz, tvx, tvz] of TRAIN_CIRC) {\n    for (const v of VEH)")
rep("if (TR && p.state !== 'dead') for (const [cx, cz, tvx, tvz] of TR.circ)", "if (p.state !== 'dead') for (const [cx, cz, tvx, tvz] of TRAIN_CIRC)")
rep("if (TR) for (const [cx, cz, tvx, tvz] of TR.circ) { const dx = P.x - cx", "for (const [cx, cz, tvx, tvz] of TRAIN_CIRC) { const dx = P.x - cx")

# ---- heights on several levels
rep("const [cf, cb] = this.circles(), yf = surfY(cf[0], cf[1]), yb = surfY(cb[0], cb[1]), ty = (yf + yb) / 2;", "const [cf, cb] = this.circles(), yf = surfAt(cf[0], cf[1], this.y), yb = surfAt(cb[0], cb[1], this.y), ty = (yf + yb) / 2;")
rep("const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad);", "const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad, this.y + 0.4);")
rep("const fl = surfY(p.x, p.z); p.t += dt;", "const fl = surfAt(p.x, p.z, p.y); p.t += dt;")
rep("p.phase += spd * dt * 3.2; p.y = surfY(p.x, p.z);", "p.phase += spd * dt * 3.2; p.y = surfAt(p.x, p.z, p.y);")
rep("const fl = surfY(P.x, P.z); P.y = Math.max(fl,", "const fl = surfAt(P.x, P.z, P.y); P.y = Math.max(fl,")
rep("P.y = surfY(P.x, P.z); P.h = wrapA(P.h + steerIn * 2.8 * dt);", "P.y = surfAt(P.x, P.z, P.y); P.h = wrapA(P.h + steerIn * 2.8 * dt);")
rep("const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4);", "const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4, P.y + 0.4);")
rep("const pp = { x: p.x + p.fx * spd * dt, z: p.z + p.fz * spd * dt }; collideStatic(pp, 0.35);", "const pp = { x: p.x + p.fx * spd * dt, z: p.z + p.fz * spd * dt }; collideStatic(pp, 0.35, p.y + 0.4);")

# ---- traffic speeds per road class + spawn heights
rep("v.driver = 'ai'; v.ai = { prev: a, cur: e.to, q: [[q1[0], q1[1], e.to]], cruise: Math.min(v.maxV * 0.8, base * mood), blocked: 0, ignore: 0 }; v.sleep = false;",
    "v.driver = 'ai'; v.ai = { prev: a, cur: e.to, q: [[q1[0], q1[1], e.to, e.sp]], cruise: Math.min(v.maxV * 0.8, base * mood), mood, kind, blocked: 0, ignore: 0 }; v.sleep = false; v.y = nodeY(a); v.sync();")
rep("ai.q.push([p0[0], p0[1], -1], [p1[0], p1[1], e.to]);", "ai.q.push([p0[0], p0[1], -1, e.sp], [p1[0], p1[1], e.to, e.sp]);")
rep("  let cruise = ai.cruise;\n", "  let cruise = ai.kind !== undefined ? Math.min(v.maxV * 0.85, (ai.q[0][3] || 10) * (ai.kind === 'ape' ? 0.55 : ai.kind === 'van' ? 0.9 : 1) * ai.mood) : ai.cruise;\n")
rep("const p = { x: p0[0], z: p0[1], h: 0, y: 0,", "const p = { x: p0[0], z: p0[1], h: 0, y: nodeY(a),")
# police field limited radius
rep("while (heap.length) { const [d, u] = pop(); if (d > dist[u]) continue;", "while (heap.length) { const [d, u] = pop(); if (d > dist[u] || d > 2500) continue;")

# ---- parked cars: spawned per tile around the player
a = s.index("function spawnParked() {"); b = s.index("// ---------------------------------------------------------------- wanted level & police")
s = s[:a] + """function parkTile(T) {
  T.parked = []; srndT = 77 + T.t * 131;
  const add = (m, x, z, h) => { const v = new Vehicle(m, colorFor(m, tRnd), x, z, h); v.parkedTile = T; v.y = surfAt(x, z); v.sync(); T.parked.push(v); };
  for (const a of T.d.a || []) if (a.t === 4) {
    const o = dec(a.p), ar = Math.abs(sArea(o)); if (ar < 120) continue;
    let le = 0, ang = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length], l = hyp(q[0] - p[0], q[1] - p[1]); if (l > le) { le = l; ang = Math.atan2(q[0] - p[0], q[1] - p[1]); } }
    const n = Math.min(4, Math.floor(ar / 160)), [cx, cz] = centroid(o); let placed = 0;
    for (let k = 0; k < 30 && placed < n; k++) {
      const x = cx + (tRnd() - 0.5) * Math.sqrt(ar) * 1.2, z = cz + (tRnd() - 0.5) * Math.sqrt(ar) * 1.2;
      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;
      add(pickModel(PARKED_MIX, tRnd), x, z, ang + Math.PI / 2 + (tRnd() < 0.5 ? Math.PI : 0)); placed++;
    }
  }
  let kerb = 0;
  for (const ri of T.d.rp || []) {
    const r = D.roads[ri]; if (r.c !== 2 || r.d || r.b) continue;
    for (let k = 1; k < r.g.length && kerb < 8; k++) {
      const a = N[r.g[k - 1]], b = N[r.g[k]], L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 22 || tRnd() > 0.22) continue;
      if (tileOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) !== T.t) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, rx = -uz, rz = ux, s = 6 + tRnd() * (L - 12), side = tRnd() < 0.5 ? 1 : -1;
      const cx0 = a[0] + ux * s, cz0 = a[1] + uz * s, free = clearance(cx0, cz0, rx * side, rz * side, 12), half = Math.min(r.w / 2, free - 0.3), off = half + 0.35;
      if (free < half + 1.35 || off < r.lane + 1.9) continue;
      const x = cx0 + rx * off * side, z = cz0 + rz * off * side;
      if (!inLim(x, z, 10) || inBuilding(x, z, 2.6) || nearJunction(x, z, 12) || VEH.some(v => hyp(v.x - x, v.z - z) < 6)) continue;
      const m = pickModel(PARKED_MIX, tRnd); if (m === 'van' || m === 'suv') continue;
      add(m, x, z, Math.atan2(ux, uz) + (side < 0 ? Math.PI : 0)); kerb++;
    }
  }
}
function parkTick() {
  for (const T of TILES) {
    if (!T.parked && T.built && T.dist < 260) parkTile(T);
    else if (T.parked && T.dist > 480) {
      for (const v of T.parked) if (v.driver === null && v !== P.car && v.speed < 0.1 && VEH.includes(v) && !(v.moved)) v.remove();
      T.parked = null;
    }
  }
}

""" + s[b:]

# ---- minimap drawn live from vector data, big map pre-rendered small
a = s.index("// minimap source canvas (1 px = 1 m)"); b = s.index("const mm = $('minimap'), mg = mm.getContext('2d');")
s = s[:a] + """// big map pre-rendered at 0.32 px/m
const BIG_S = 0.32, BIGC = document.createElement('canvas'), BOX = Math.ceil(META.hw * BIG_S), BOZ = Math.ceil(META.hh * BIG_S);
BIGC.width = BOX * 2; BIGC.height = BOZ * 2;
{
  const g = BIGC.getContext('2d'); g.fillStyle = '#20232b'; g.fillRect(0, 0, BIGC.width, BIGC.height); g.translate(BOX, BOZ); g.scale(BIG_S, BIG_S);
  for (const T of TILES) for (const a of T.d.a || []) if (a.t <= 3 || a.t >= 11) { const o = dec(a.p); g.beginPath(); o.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.fillStyle = a.t === 11 ? '#2b4428' : a.t === 13 ? '#3a3f2c' : '#2f4a2c'; g.fill(); }
  g.fillStyle = '#3a3e49'; for (const b of BUILDINGS) { g.beginPath(); b.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1, 2]) for (const r of D.roads) {
    if (pass === 0 && r.c === 6) { g.strokeStyle = '#4b4f58'; g.lineWidth = 2; } else if (pass === 1 && r.c >= 2 && r.c <= 5) { g.strokeStyle = r.c === 5 ? '#9b8676' : '#a7a49c'; g.lineWidth = r.w + 2; } else if (pass === 2 && r.c <= 1) { g.strokeStyle = r.d ? '#f0c27a' : '#d8cfbd'; g.lineWidth = r.w + 4; } else continue;
    g.beginPath(); r.g.forEach((i, k) => k ? g.lineTo(N[i][0], N[i][1]) : g.moveTo(N[i][0], N[i][1])); g.stroke();
  }
  g.setLineDash([12, 10]); g.strokeStyle = '#c96b4a'; g.lineWidth = 4; for (const r of RAILPTS) { g.beginPath(); r.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); } g.setLineDash([]);
}
""" + s[b:]
a = s.index("function drawMinimap() {"); b = s.index("function drawBig() {")
s = s[:a] + """function drawMinimap() {
  const S = mm.width, R = S / 2, zoom = P.mode === 'car' ? 1.25 - clamp(P.car.speed / 60, 0, 0.55) : 1.6, h = camMode === 1 ? Math.PI : (P.mode === 'car' ? P.car.h : P.h);
  const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z, RM = R / zoom * 1.05;
  mg.save(); mg.clearRect(0, 0, S, S); mg.beginPath(); mg.arc(R, R, R, 0, TAU); mg.clip();
  mg.fillStyle = '#1d2028'; mg.fillRect(0, 0, S, S);
  mg.translate(R, R); mg.rotate(h - Math.PI); mg.scale(zoom, zoom); mg.translate(-px, -pz);
  mg.fillStyle = '#3a3e49'; BLD.each(px - RM, pz - RM, px + RM, pz + RM, b => { mg.beginPath(); b.pts.forEach((p, i) => i ? mg.lineTo(p[0], p[1]) : mg.moveTo(p[0], p[1])); mg.fill(); });
  mg.lineCap = 'round';
  const segs = []; ROADSEG.each(px - RM, pz - RM, px + RM, pz + RM, sg => segs.push(sg));
  for (const pass of [0, 1]) for (const sg of segs) {
    const r = sg.r; if (pass === 0 ? r.c !== 6 : r.c === 6) continue;
    mg.strokeStyle = r.c === 6 ? '#4b4f58' : r.d ? '#f0c27a' : r.c <= 1 ? '#d8cfbd' : r.c === 5 ? '#9b8676' : '#a7a49c'; mg.lineWidth = r.c === 6 ? 1.6 : r.w + (r.c <= 1 ? 2 : 0.5);
    mg.beginPath(); mg.moveTo(sg.a[0], sg.a[1]); mg.lineTo(sg.b[0], sg.b[1]); mg.stroke();
  }
  mg.setTransform(1, 0, 0, 1, 0, 0);
  const tr = (x, z) => { const dx = (x - px) * zoom, dz = (z - pz) * zoom, a = h - Math.PI, c = Math.cos(a), s = Math.sin(a); return [dx * c - dz * s, dx * s + dz * c]; };
  mg.translate(R, R);
  for (const v of VEH) if (v.kind === 'police' && v.driver === 'ai' && W.stars > 0) { const [x, y] = tr(v.x, v.z); if (hyp(x, y) < R + 30) drawBlip(mg, x, y, (now * 4 | 0) % 2 ? '#4d86ff' : '#e0453a', 7, true, R); }
  const tgt = MS.state === 'pickup' ? MS.from : MS.state === 'deliver' ? MS.to : null;
  if (tgt) { const [x, y] = tr(tgt.x, tgt.z); drawBlip(mg, x, y, MS.state === 'pickup' ? '#f0b23c' : '#7fd18b', 10, true, R); }
  const ah = camMode === 1 ? (P.mode === 'car' ? P.car.h : P.h) - Math.PI : 0;
  mg.rotate(ah); mg.fillStyle = '#fbf5e6'; mg.strokeStyle = '#0f1116'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(0, -14); mg.lineTo(10, 11); mg.lineTo(0, 5); mg.lineTo(-10, 11); mg.closePath(); mg.stroke(); mg.fill();
  mg.restore();
  mg.save(); mg.translate(R, R); mg.rotate(h - Math.PI); mg.fillStyle = '#f0b23c'; mg.font = '800 26px "Barlow Condensed", sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.translate(0, -(R - 20)); mg.rotate(-(h - Math.PI)); mg.fillText('N', 0, 0); mg.restore();
}
""" + s[b:]
rep("const g = c.getContext('2d'), sc = Math.min(c.width / (LIM_X * 2), c.height / (LIM_Z * 2)) * 0.94;", "const g = c.getContext('2d'), sc = Math.min(c.width / (META.hw * 2), c.height / (META.hh * 2)) * 0.96;")
rep("g.drawImage(MAPC, -MOX, -MOZ);", "g.drawImage(BIGC, -META.hw, -META.hh, META.hw * 2, META.hh * 2);")
rep("for (const p of D.pois) if (['stazione', 'chiesa', 'polizia', 'parco', 'monumento'].includes(p.k) && p.n.length < 30 && !p.n.startsWith('Grotta')) {",
    "for (const p of [...PLACES.filter(p => (p.k === 'town' || p.k === 'village') && Math.abs(p.x) < META.hw - 150 && Math.abs(p.z) < META.hh - 60).map(p => ({ ...p, big: 1 })), ...D.pois.filter(p => ['stazione', 'chiesa', 'parco'].includes(p.k))]) if (p.n.length < 30 && !p.n.startsWith('Grotta')) {")
rep("lab(p, '#c9bfa8', 5 * dpr); g.fillStyle = '#e8e0cc'; g.fillText(p.n, p.x + 8 * dpr / sc, p.z + 5 * dpr / sc);",
    "if (p.big) { g.save(); g.font = `400 ${20 * dpr / sc}px Bungee, Impact, sans-serif`; g.fillStyle = '#f0b23c'; g.fillText(p.n.toUpperCase(), p.x, p.z); g.restore(); } else { lab(p, '#c9bfa8', 5 * dpr); g.fillStyle = '#e8e0cc'; g.fillText(p.n, p.x + 8 * dpr / sc, p.z + 5 * dpr / sc); }")
rep("<div class=\"cap\">MEDA<span>Premi M per tornare in strada</span></div>", "<div class=\"cap\">BRIANZA<span>Premi M per tornare in strada</span></div>")

# ---- HUD place name, respawn spots, start
rep("$('street').textContent = (st || 'Meda') + (TER ? ` · ${Math.round(TER.base + groundH(P.x, P.z))} m` : '');",
    "$('street').textContent = (st ? st + ' · ' : '') + (placeAt(P.x, P.z) || 'Brianza') + ` · ${Math.round(TER.base + (P.mode === 'car' ? P.car.y : P.y))} m`;")
rep("const spot = D.pois.find(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')) || { x: 0, z: 0 };",
    "const cands = D.pois.filter(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')), spot = cands.sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0] || STATION;")
rep("banner(kind === 'busted' ? 'Polizia Locale' : 'Stazione di Meda', 'DI NUOVO IN STRADA');", "banner(spot.n || 'Meda', 'DI NUOVO IN STRADA');")
rep("const STATION = D.pois.find(p => p.k === 'stazione') || { x: 0, z: 0 };", "const STATION = D.pois.find(p => p.n === 'Stazione di Meda') || D.pois.find(p => p.k === 'stazione') || { x: 0, z: 0, n: 'Meda' };")
rep("""function setupWorld(saved) {
  spawnParked();""", """function setupWorld(saved) {
  tileTick(STATION.x, STATION.z, 0, 420);
  for (const T of TILES) T.dist = hyp(T.cx - STATION.x, T.cz - STATION.z);
  parkTick();""")
rep("P.h = h; P.y = surfY(P.x, P.z); for (const v of VEH) { v.y = surfY(v.x, v.z); v.sync(); }", "P.h = h; P.y = surfAt(P.x, P.z); mine.y = surfAt(mine.x, mine.z); mine.sync();")
rep("""  updVisuals(running && !paused ? dt : 0);""", """  { const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z; tileTick(px, pz, running ? 7 : 12); if (running && ((now * 2) | 0) !== frame.pk) { frame.pk = (now * 2) | 0; parkTick(); } }
  updVisuals(running && !paused ? dt : 0);""")
rep("function boot(saved) { setupWorld(saved || {}); requestAnimationFrame(frame); }", "function boot(saved) { setupWorld(saved || {}); requestAnimationFrame(frame); goBtn.disabled = false; goBtn.textContent = 'ACCENDI IL MOTORE'; }")
rep("window.__G = { D, LX, MODELS, Vehicle,", "window.__G = { tileTick, D, LX, MODELS, Vehicle, TILES, TRAINS, surfAt, groundH, nodeY,")
rep("enterExit, startGame, TR };", "enterExit, startGame, pollPad, GATES, WALLS, N, DRIVE, TRAF, WALK, DRIVE_NODES, TRAF_NODES, WALK_NODES, nearestNode, nodeInRing, cops, crime, spawnPolice, spawnPed, spawnTraffic, policeField, rayWalls, inBuilding, placeAt, streetAt, BLD, pedTarget, STATIC, RADIO };")
rep("const mine = new Vehicle('panda', '#c8332b', p0[0] + Math.sin(h) * 4, p0[1] + Math.cos(h) * 4, h);", "const mine = new Vehicle('panda', '#c8332b', p0[0] + Math.sin(h) * 4, p0[1] + Math.cos(h) * 4, h); mine.moved = true;")
# a moved parked car is no longer recycled
rep("        a.impact(-rv * 0.8); b.impact(-rv * 0.8);", "        a.impact(-rv * 0.8); b.impact(-rv * 0.8); a.moved = b.moved = true;")
rep("best.driver = 'player'; best.sleep = false; P.car = best;", "best.driver = 'player'; best.sleep = false; best.moved = true; P.car = best;")
# texts
rep("Le vie vere di Meda, dalla stazione a Piazza della Chiesa. Ruba un'auto, fai le consegne per i locali del centro e semina la Polizia Locale.",
    "Meda, Seveso, Barlassina, Baruccana e Cabiate con le loro strade vere, i dislivelli veri e la Milano-Meda sopraelevata. Ruba un'auto, fai le consegne per i locali e semina la Polizia Locale.")
rep("banner('Stazione di Meda', 'MEDA · BRIANZA');", "banner('Stazione di Meda', 'BRIANZA');")
# ---- driving model: arcade by default (real top speeds), G toggles a realistic model
rep("const S = this.spec, dead = this.health <= 0, thr = dead ? 0 : i.thr, bst = this.boost && thr > 0, acc = S.acc * (bst ? 1.7 : 1), top = this.maxV * (bst ? 1.15 : 1);",
    "const S = this.spec, arc = DRIVE_MODE === 'arcade', dead = this.health <= 0, thr = dead ? 0 : i.thr, bst = this.boost && thr > 0, acc = (arc ? Math.min(12, S.acc * 2.1) : S.acc) * (bst ? 1.7 : 1), top = this.maxV * (bst ? 1.15 : 1);")
rep("if (i.brk > 0) { if (v > 0.5) v -= 11 * dt * i.brk;", "if (i.brk > 0) { if (v > 0.5) v -= (arc ? 21 : 11) * dt * i.brk;")
rep("const drag = (0.15 + (thr ? 0 : 0.45 + 0.0004 * v * v)) * dt + (i.hand ? 7 * dt : 0);", "const drag = (0.15 + (thr ? 0 : (arc ? 1.6 : 0.45) + 0.0004 * v * v)) * dt + (i.hand ? 7 * dt : 0);")
rep("const yawMax = (i.hand ? 22 : 13 + S.grip * 0.4) / Math.max(4, Math.abs(v));", "const yawMax = (i.hand ? 26 : arc ? 30 : 13 + S.grip * 0.4) / Math.max(4, Math.abs(v));")
rep("v += 9.81 * Math.sin(this.slope) * dt; // gravity on hills", "v += 9.81 * Math.sin(this.slope) * (arc ? 0.6 : 1) * dt; // gravity on hills")
rep("if (ty > this.y + 0.08 && this === P.car && this.speed > 6) shake = Math.max(shake, 0.12);", "if (ty - this.y > 0.09 && ty - this.y < 0.2 && this === P.car && this.speed > 6) shake = Math.max(shake, 0.12);")
rep("const VEH = [];", "const VEH = [];\nlet DRIVE_MODE = 'arcade';\ntry { DRIVE_MODE = localStorage.getItem('medaDrive') || 'arcade'; } catch (e) { }")
rep("  if (e.code === 'KeyU') {", "  if (e.code === 'KeyG') { DRIVE_MODE = DRIVE_MODE === 'arcade' ? 'real' : 'arcade'; try { localStorage.setItem('medaDrive', DRIVE_MODE); } catch (er) { } toast(DRIVE_MODE === 'arcade' ? 'Guida arcade' : 'Guida realistica'); }\n  if (e.code === 'KeyU') {")
rep("<p><kbd>C</kbd> visuale · <kbd>M</kbd> mappa · <kbd>H</kbd> clacson · <kbd>U</kbd> audio</p>", "<p><kbd>C</kbd> visuale · <kbd>M</kbd> mappa · <kbd>G</kbd> guida arcade/realistica · <kbd>H</kbd> clacson · <kbd>U</kbd> audio</p>")
rep("      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>", "      <div><kbd>G</kbd> guida arcade / realistica</div>\n      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>")
rep("acc = (arc ? Math.min(12, S.acc * 2.1) : S.acc) * (bst ? 1.7 : 1), top = this.maxV * (bst ? 1.15 : 1);", "acc = (arc ? Math.min(12, S.acc * 2.1) : S.acc) * (bst ? 2.4 : 1), top = this.maxV * (bst ? 1.3 : 1);")
rep("P.nitro = Math.max(0, P.nitro - 30 * dt);", "P.nitro = Math.max(0, P.nitro - 24 * dt);")
# expressways get more traffic
rep("  const a = near ? nodeInRing(TRAF_NODES, P.x, P.z, 90, 260, true) : pick(TRAF_NODES);", "  const a = near ? nodeInRing(rnd() < 0.35 ? EXPRESS_NODES : TRAF_NODES, P.x, P.z, 90, 300, true) : pick(TRAF_NODES);")
rep("const TRAF_NODES = nodesWith(TRAF),", "const EXPRESS_NODES = [...new Set(D.roads.filter(r => r.x && !r.t).flatMap(r => r.g))].filter(i => TRAF[i].length && inLim(N[i][0], N[i][1], 20)), TRAF_NODES = nodesWith(TRAF),")
rep("const ADJ_OF = new Map([[TRAF_NODES, TRAF], [DRIVE_NODES, DRIVE], [WALK_NODES, WALK]]);", "const ADJ_OF = new Map([[TRAF_NODES, TRAF], [DRIVE_NODES, DRIVE], [WALK_NODES, WALK]]);")
rep("if (traffic.length < 22 && rnd() < dt * 2) spawnTraffic(true);", "if (traffic.length < 28 && rnd() < dt * 2.5) spawnTraffic(true);")
# trains ride on the elevated track
rep("  const pts = dec(td.p); if (pts.length < 2) return null;", "  const pts = dec(td.p); if (pts.length < 2) return null;\n  const hs = (td.h || []).map((v, i) => v === -32768 ? null : v / 10);")
rep("const i = lo, a = pts[i - 1], b = pts[i], f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1); return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), Math.atan2(b[0] - a[0], b[1] - a[1])]; };",
    "const i = lo, a = pts[i - 1], b = pts[i], f = (s - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), x = lerp(a[0], b[0], f), z = lerp(a[1], b[1], f), ha = hs[i - 1] ?? groundH(a[0], a[1]), hb = hs[i] ?? groundH(b[0], b[1]); return [x, z, Math.atan2(b[0] - a[0], b[1] - a[1]), (hs[i - 1] == null && hs[i] == null) ? groundH(x, z) : lerp(ha, hb, f)]; };")
rep("const s = T.s - T.dir * (k * 22.4 + 11); const [x, z, h] = T.at(s); g.position.set(x, groundH(x, z) + 0.15, z); g.rotation.y = h;", "const s = T.s - T.dir * (k * 22.4 + 11); const [x, z, h, y] = T.at(s); g.position.set(x, y + 0.15, z); g.rotation.y = h; g.userData.y = y;")
# AI stops at red lights
rep("    for (const g of LX) if (g.bars && (g.closed || g.ang < 0.7)) for (const b of g.bars) for (const [x, z] of b.probe) check(x, z);",
    "    for (const g of LX) if (g.bars && (g.closed || g.ang < 0.7)) for (const b of g.bars) for (const [x, z] of b.probe) check(x, z);\n    if (v.ai && !v.ai.cop) SIGG.each(v.x - 30, v.z - 30, v.x + 30, v.z + 30, sg => { if (sigState(axisOf(fx, fz)) === 'g') return; const ox = sg.x - v.x, oz = sg.z - v.z, ahead = ox * fx + oz * fz, side = Math.abs(ox * fz - oz * fx); if (ahead > sg.w / 2 + 3 && ahead < 32 && side < sg.w / 2 + 4) block = Math.min(block, ahead - sg.w / 2 - 1); });")
rep("  updTrain(dt); updCrossings(dt);", "  updTrain(dt); updCrossings(dt); updSignals(); updGates(dt); updFountains();")
rep("    v.step(dt); v.collide();", "    v.step(dt); gateHits(v); fuelHits(v); v.collide();")
# no spawning on top of the player; tougher cars
rep("  const e = pick(TRAF[a]); if (!e) return null; const [p0, p1] = edgePts(a, e.to, e.off);", "  if (a == null || VEH.some(o => hyp(o.x - N[a][0], o.z - N[a][1]) < 9)) return null;\n  const e = pick(TRAF[a]); if (!e) return null; const [p0, p1] = edgePts(a, e.to, e.off);")
rep("  const e = pick(WALK[a]); if (!e) return; const side", "  if (a == null) return; const e = pick(WALK[a]); if (!e) return; const side")
rep("    if (v > 4) { this.health = Math.max(0, this.health - (v - 4) * 2.2); }", "    if (v > 7) { this.health = Math.max(0, this.health - (v - 7) * 1.1); }")
rep("      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;", "      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || hyp(P.x - x, P.z - z) < 45 || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;")
rep("      if (!inLim(x, z, 10) || inBuilding(x, z, 2.6) || nearJunction(x, z, 12) || VEH.some(v => hyp(v.x - x, v.z - z) < 6)) continue;", "      if (!inLim(x, z, 10) || inBuilding(x, z, 2.6) || nearJunction(x, z, 12) || hyp(P.x - x, P.z - z) < 45 || VEH.some(v => hyp(v.x - x, v.z - z) < 6)) continue;")
# ---- gamepad (Xbox / PlayStation layout): RT gas, LT brake, left stick steer, RB handbrake, A turbo/run, Y get in/out, B camera, X horn, View map, Start pause
rep("// ---------------------------------------------------------------- player actions", """const GP = { steer: 0, thr: 0, brk: 0, hand: 0, turbo: 0, horn: 0, fwd: 0, prev: [] };
function pollPad() {
  let pads = []; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return; }
  const g = [...pads].find(p => p && p.connected); if (!g) { GP.steer = GP.thr = GP.brk = GP.hand = GP.turbo = GP.horn = GP.fwd = 0; return; }
  const dz = v => Math.abs(v) < 0.15 ? 0 : v, b = i => g.buttons[i] ? g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0) : 0;
  const edge = i => { const now = b(i) > 0.5, was = GP.prev[i]; GP.prev[i] = now; return now && !was; };
  // cross/A handbrake, circle/B turbo, square/X horn, triangle/Y get in-out, R1/RB or R3 camera
  GP.steer = dz(g.axes[0] || 0); GP.fwd = -dz(g.axes[1] || 0); GP.thr = b(7); GP.brk = b(6); GP.hand = b(0); GP.turbo = b(1); GP.horn = b(2);
  if (edge(3)) K.use = true;
  if (edge(5)) camMode = (camMode + 1) % 2;
  if (edge(11)) reportSpot();
  if (edge(8)) toggleBig();
  if (edge(9)) togglePause();
  if (!GP.seen) {
    GP.seen = true; GP.ps = /dualsense|dualshock|wireless controller|054c|playstation/i.test(g.id);
    const L = GP.ps ? { t: 'R2', b: 'L2', h: '✕', o: '○', s: '□', y: '△', c: 'R1', m: 'Create', p: 'Options', r: 'R3' } : { t: 'RT', b: 'LT', h: 'A', o: 'B', s: 'X', y: 'Y', c: 'RB', m: 'View', p: 'Menu', r: 'R3' };
    const txt = `${L.t} gas · ${L.b} freno · ${L.h} freno a mano · ${L.o} turbo · ${L.s} clacson · ${L.y} sali/scendi · ${L.c} visuale · ${L.r} segnala punto · ${L.m} mappa · ${L.p} pausa`;
    toast((GP.ps ? 'DualSense' : 'Controller') + ' collegato: ' + txt); const pl = document.getElementById('padline'); if (pl) { pl.hidden = false; pl.textContent = 'Controller: ' + txt; }
  }
}
addEventListener('gamepadconnected', () => { GP.seen = false; });

// ---------------------------------------------------------------- player actions""")
rep("  const steerIn = (K.left ? 1 : 0) - (K.right ? 1 : 0);", "  const steerIn = clamp((K.left ? 1 : 0) - (K.right ? 1 : 0) - GP.steer, -1, 1);")
rep("    const v = P.car; v.inp.thr = K.up ? 1 : 0; v.inp.brk = K.down ? 1 : 0; v.inp.steer = steerIn; v.inp.hand = K.hand ? 1 : 0; v.sleep = false;",
    "    const v = P.car; v.inp.thr = Math.max(K.up ? 1 : 0, GP.thr); v.inp.brk = Math.max(K.down ? 1 : 0, GP.brk); v.inp.steer = steerIn; v.inp.hand = K.hand || GP.hand > 0.5 ? 1 : 0; v.sleep = false;")
rep("    const want = K.turbo && K.up && v.health > 0 && P.nitro > 1;", "    const want = (K.turbo || GP.turbo > 0.5) && v.inp.thr > 0.3 && v.health > 0 && P.nitro > 1 && !v.spec.pedal;")
rep("const sp = (K.up ? 1 : K.down ? -0.5 : 0) * (K.hand || K.turbo ? 7.2 : 4.2);", "const fwdIn = K.up ? 1 : K.down ? -0.5 : GP.fwd > 0.3 || GP.thr > 0.3 ? Math.max(GP.fwd, GP.thr) : GP.fwd < -0.3 ? -0.5 : 0, sp = fwdIn * (K.hand || K.turbo || GP.turbo > 0.5 ? 7.2 : 4.2);")
rep("((K.horn && P.mode === 'car') ? 0.12", "(((K.horn || GP.horn > 0.5) && P.mode === 'car') ? 0.12")
rep("  if (running && !paused) { acc += dt;", "  pollPad();\n  if (running && !paused) { acc += dt;")
rep("      <div><kbd>G</kbd> guida arcade / realistica</div>", "      <div><kbd>G</kbd> guida arcade / realistica</div>\n      <div><kbd>PAD</kbd> controller DualSense o Xbox</div>")
rep("<p>Premi <kbd>P</kbd> per riprendere</p>", "<p id=\"padline\" hidden></p><p>Premi <kbd>P</kbd> per riprendere</p>")
# get out at any speed: you tumble out and the car rolls on
rep("    const v = P.car; if (v.speed > 5) { toast('Frena prima di scendere'); return; }", "    const v = P.car, fast = v.speed > 6;")
rep("    P.x = x; P.z = z; P.h = v.h; P.mode = 'foot'; P.model.g.visible = true; v.driver = null; v.boost = false;",
    "    P.x = x; P.z = z; P.h = v.h; P.mode = 'foot'; P.model.g.visible = true; v.driver = null; v.boost = false;\n    if (fast) { P.y = v.y + 0.5; P.knock = 1.3; P.vx = v.vx * 0.55; P.vz = v.vz * 0.55; P.vy = 2; P.hp -= Math.min(25, v.speed * 0.6); }")
rep("v.inp = { thr: 0, brk: 0, steer: 0, hand: 1 }; P.car = null;\n  }", "v.inp = { thr: 0, brk: 0, steer: 0, hand: fast ? 0 : 1 }; P.car = null;\n  }")
# new name: Grandi Truffe Assassine · Brianza
rep("<title>Meda Bandita</title>", "<title>Grandi Truffe Assassine Brianza</title>")
rep("    <h1>MEDA<span>BANDITA</span></h1>", "    <h1><b>G</b>RANDI <b>T</b>RUFFE<span><b>A</b>SSASSINE</span><em>BRIANZA</em></h1>")
rep("#start h1 span { color: var(--ocra); display: block; }", "#start h1 span { color: var(--ocra); display: block; }\n#start h1 b { color: var(--cotto); font-weight: inherit; text-shadow: 0 6px 0 #5b1d10, 0 10px 30px rgba(0,0,0,.5); }\n#start h1 em { display: block; font-style: normal; font-size: .34em; letter-spacing: .5em; color: var(--ink); margin-top: .35em; text-shadow: 0 3px 0 var(--cotto); }")
rep("font-size: clamp(46px, 11vw, 124px); line-height: .86;", "font-size: clamp(38px, 8.4vw, 104px); line-height: .9;")
rep("//  MEDA BANDITA · open-world", "//  GRANDI TRUFFE ASSASSINE · BRIANZA · open-world")
# start with a red sports car
rep("  const mine = new Vehicle('panda', '#c8332b',", "  const mine = new Vehicle('sport', '#d0141a',")
rep("toast('Premi F vicino alla Panda rossa per salire')", "toast('Entra nella Ferari! (' + (GP.seen ? (GP.ps ? '△' : 'Y') : 'F') + ')')")
rep("  // start next to the station with a little Panda waiting", "  // start next to the station with a red Ferari waiting")
# start in the parking on via Yuri Gagarin (behind the station), facing the fountain
rep("""  const n = nearestNode(TRAF_NODES, STATION.x, STATION.z), e = TRAF[n][0], [p0, p1] = edgePts(n, e.to, e.off + 0.9);
  const h = Math.atan2(p1[0] - p0[0], p1[1] - p0[1]);
  const mine = new Vehicle('sport', '#d0141a', p0[0] + Math.sin(h) * 4, p0[1] + Math.cos(h) * 4, h); mine.moved = true;""",
"""  const LL = (la, lo) => [(lo - META.lon0) * 111320 * Math.cos(META.lat0 * Math.PI / 180), -(la - META.lat0) * 110540];
  const [sx, sz] = LL(45.661706, 9.161211), FO = (D.fountains || []).map(f => [f[0] / 10, f[1] / 10]).sort((a, b) => hyp(a[0] - sx, a[1] - sz) - hyp(b[0] - sx, b[1] - sz))[0] || [STATION.x, STATION.z];
  const h = Math.atan2(FO[0] - sx, FO[1] - sz);
  const mine = new Vehicle('sport', '#d0141a', sx, sz, h); mine.moved = true;""")
rep("  tileTick(STATION.x, STATION.z, 0, 420);\n  for (const T of TILES) T.dist = hyp(T.cx - STATION.x, T.cz - STATION.z);", "  tileTick(STATION.x + 190, STATION.z + 66, 0, 420);\n  for (const T of TILES) T.dist = hyp(T.cx - STATION.x - 190, T.cz - STATION.z - 66);")
# title: everything yellow, only G T A in red
rep("#start h1 em { display: block; font-style: normal; font-size: .34em; letter-spacing: .5em; color: var(--ink);", "#start h1 em { display: block; font-style: normal; font-size: .34em; letter-spacing: .5em; color: var(--ocra);")
rep("#start h1 { font-family: var(--display);", "#start h1 { color: var(--ocra) !important; font-family: var(--display);")
# ---- day & night, car damage
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'extras.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("updSignals(); updGates(dt); updFountains();", "updSignals(); updGates(dt); updFountains(); updDayNight(dt); updWrecks(dt); updFuel(dt);")
rep("    add(boxG(S.W, S.bh, S.L), paint, 0, by, 0);", "    var bm = add(new THREE.BoxGeometry(S.W, S.bh, S.L, 3, 2, 6), paint, 0, by, 0);")
rep("  scene.add(g);\n  return { g, body, wheels, rider, crew };", "  if (!S.ape) { const hp = new THREE.Mesh(makeCar.hp || (makeCar.hp = new THREE.PlaneGeometry(3.4, 9).rotateX(-Math.PI / 2)), HEADPOOL_MAT); hp.position.set(0, 0.14, hl + 4.4); if (S.two) hp.scale.set(0.6, 1, 0.75); hp.renderOrder = 12; g.add(hp); }\n  scene.add(g);\n  return { g, body, wheels, rider, crew, bm: typeof bm !== 'undefined' ? bm : null, paint };")
rep("""  impact(v) {
    if (v > 7) { this.health = Math.max(0, this.health - (v - 7) * 1.1); }""", """  impact(v, nx, nz) {
    if (v > 7) { this.health = Math.max(0, this.health - (v - 7) * 1.1); }
    if (v > 5 && nx !== undefined) { dentCar(this, Math.min(0.32, (v - 5) * 0.03), nx, nz); scorch(this); }""")
rep("this.vx *= 0.92; this.vz *= 0.92; this.impact(-vn); }", "this.vx *= 0.92; this.vz *= 0.92; this.impact(-vn, hitN[0], hitN[1]); }")
rep("a.impact(-rv * 0.8); b.impact(-rv * 0.8);", "a.impact(-rv * 0.8, -nx, -nz); b.impact(-rv * 0.8, nx, nz);")
rep("  remove() { scene.remove(this.m.g);", "  remove() { scene.remove(this.m.g); if (this.m.bm) this.m.bm.geometry.dispose();")
rep('<div id="nitro"', '<div id="clock">18:00</div><div id="nitro"')
rep("#health i {", "#clock { font-family: var(--display); font-size: 20px; letter-spacing: .06em; color: var(--ink); opacity: .9; margin-top: 4px; text-shadow: 0 2px 0 rgba(0,0,0,.4); }\n#health i {")
rep("  if (e.code === 'KeyG') {", "  if (e.code === 'KeyN') skipTime(2);\n  if (e.code === 'KeyG') {")
rep("      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>", "      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>\n      <div><kbd>N</kbd> avanti di 2 ore</div>")
rep("<kbd>H</kbd> clacson · <kbd>U</kbd> audio</p>", "<kbd>H</kbd> clacson · <kbd>N</kbd> +2 ore · <kbd>U</kbd> audio</p>")
rep("  if (edge(8)) toggleBig();", "  if (edge(8)) toggleBig();\n  if (edge(4)) skipTime(2);")
rep("${L.m} mappa · ${L.p} pausa`", "${L.m} mappa · ${L.p} pausa · ${GP.ps ? 'L1' : 'LB'} +2 ore`")
rep("banner('Stazione di Meda', 'BRIANZA')", "banner('Via Yuri Gagarin', 'MEDA')")
# open land defaults to Brianza meadow, not grey-white
rep("const groundTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#a4a396'; g.fillRect(0, 0, w, h); noise(g, w, h, 7000, 0.3, ['#8b8c7c', '#b7b5a8', '#8f9a74', '#7d8a5e']); });",
    "const groundTex = canvasTex(256, 256, (g, w, h) => { g.fillStyle = '#7b8f4e'; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.4, ['#6a7f40', '#8ea05c', '#94875a', '#5f7438', '#a39a68']); });")
# ---- R3 / B: mark the spot where something is broken (saved in the artifact database, Claude reads it back)
rep("function updVisuals(dt) {", """// ---------------------------------------------------------------- bug reports: R3 on the pad, B on the keyboard
let spotDb = null, spotN = 0; (async () => { try { spotDb = await window.claude?.use?.('db'); } catch (e) { spotDb = null; } })();
async function reportSpot() {
  const v = P.mode === 'car' ? P.car : null, x = v ? v.x : P.x, z = v ? v.z : P.z, y = v ? v.y : P.y;
  const lat = META.lat0 - z / 110540, lon = META.lon0 + x / (111320 * Math.cos(META.lat0 * Math.PI / 180));
  const rec = { x: +x.toFixed(1), z: +z.toFixed(1), y: +y.toFixed(1), suolo: +groundH(x, z).toFixed(1), lat: +lat.toFixed(6), lon: +lon.toFixed(6), via: streetAt(x, z) || '', zona: placeAt(x, z) || '', direzione: Math.round(((v ? v.h : P.h) * 180 / Math.PI + 360) % 360), modo: P.mode, velocita: v ? Math.round(v.speed * 3.6) : 0, cam: camMode, ora: $('clock') ? $('clock').textContent : '', quando: new Date().toISOString(), versione: 'v16' };
  spotN++; try { sfxBlip(660, 990, 0.12); } catch (e) { }
  let saved = false; if (spotDb) { try { await spotDb.collection('segnalazioni').add(rec); saved = true; } catch (e) { saved = false; } }
  if (!saved) { try { const a = JSON.parse(localStorage.getItem('gtaSpots') || '[]'); a.push(rec); localStorage.setItem('gtaSpots', JSON.stringify(a)); } catch (e) { } }
  toast('📍 Punto ' + spotN + ' segnalato' + (rec.via ? ': ' + rec.via : '') + (saved ? '' : ' (solo in locale)'));
}
function updVisuals(dt) {""")
rep("  if (e.code === 'KeyN') skipTime(2);", "  if (e.code === 'KeyN') skipTime(2);\n  if (e.code === 'KeyB') reportSpot();")
rep("      <div><kbd>N</kbd> avanti di 2 ore</div>", "      <div><kbd>N</kbd> avanti di 2 ore</div>\n      <div><kbd>B</kbd> / <kbd>R3</kbd> segnala un punto rotto</div>")
rep("<kbd>N</kbd> +2 ore · <kbd>U</kbd> audio</p>", "<kbd>N</kbd> +2 ore · <kbd>B</kbd> segnala punto · <kbd>U</kbd> audio</p>")
# respawn after "wasted": nearest hospital, medical centre or church
rep("const cands = D.pois.filter(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')), spot = cands.sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0] || STATION;",
    "const cands = D.pois.filter(p => kind === 'busted' ? p.k === 'polizia' : (p.k === 'ospedale' || p.k === 'chiesa')), spot = cands.sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0] || STATION; setTimeout(() => toast((kind === 'busted' ? 'Rilasciato: ' : 'Ti risvegli: ') + (spot.n || 'Meda')), 400);")
# radio: R / d-pad up toggles; N is only the time skip now
rep("KeyN: 'turbo', KeyH: 'horn' };", "KeyH: 'horn', KeyQ: 'back', KeyE: 'fwdw' };")
# two-wheelers: weight back (Q / left stick pulled) or forward (E / stick pushed) for wheelies and stoppies
rep("v.inp.hand = K.hand || GP.hand > 0.5 ? 1 : 0; v.sleep = false;", "v.inp.hand = K.hand || GP.hand > 0.5 ? 1 : 0; v.sleep = false; v.inp.lean = clamp((K.back ? 1 : 0) - (K.fwdw ? 1 : 0) - GP.fwd, -1, 1);")
rep("  if (e.code === 'KeyN') skipTime(2);", "  if (e.code === 'KeyN') skipTime(2);\n  if (e.code === 'KeyR') toggleRadio();")
rep("  if (edge(4)) skipTime(2);", "  if (edge(4)) skipTime(2);\n  if (edge(12)) toggleRadio();")

rep("  updVisuals(running && !paused ? dt : 0);", "  updVisuals(running && !paused ? dt : 0); updRadio(dt);")
rep("      <div><kbd>N</kbd> avanti di 2 ore</div>", "      <div><kbd>N</kbd> avanti di 2 ore</div>\n      <div><kbd>R</kbd> radio on/off (Discoradio, Radio Maria in volante)</div>")
rep("<kbd>N</kbd> +2 ore · <kbd>B</kbd> segnala punto", "<kbd>N</kbd> +2 ore · <kbd>R</kbd> radio · <kbd>B</kbd> segnala punto")
rep("${GP.ps ? 'L1' : 'LB'} +2 ore`", "${GP.ps ? 'L1' : 'LB'} +2 ore · freccia su radio`")
rep("CC BY 4.0.</p>", "CC BY 4.0. Edifici aggiuntivi e altezze: <a href=\"https://overturemaps.org\" target=\"_blank\" rel=\"noopener\">Overture Maps Foundation</a>, ODbL. Copertura del suolo: © ESA WorldCover project 2021, contiene dati Copernicus Sentinel modificati (2021) elaborati dal consorzio ESA WorldCover, CC BY 4.0. Radio: <a href=\"https://www.discoradio.it\" target=\"_blank\" rel=\"noopener\">Discoradio</a>, stream ufficiale; <a href=\"https://www.radiomaria.it\" target=\"_blank\" rel=\"noopener\">Radio Maria</a>.</p>")

# ---- debug mode (code DEBUG in the pause menu, or ?debug in the URL): bug reports, coordinates HUD, export
rep("async function reportSpot() {", """let DEBUG = false; try { const q = new URLSearchParams(location.search); if (q.has('debug')) localStorage.setItem('gtaDebug', q.get('debug') === '0' ? '0' : '1'); DEBUG = localStorage.getItem('gtaDebug') === '1'; } catch (e) { }
function spotsLocal() { try { return JSON.parse(localStorage.getItem('gtaSpots') || '[]'); } catch (e) { return []; } }
function setDebug(on) { DEBUG = on; try { localStorage.setItem('gtaDebug', on ? '1' : '0'); } catch (e) { } document.body.classList.toggle('debug', on); updDbgMenu(); toast(on ? '🛠 Modalità debug attiva' : '🛠 Modalità debug spenta'); }
function updDbgMenu() { const b = document.getElementById('dbgdl'); if (b) b.textContent = '⬇ Scarica segnalazioni (' + spotsLocal().length + ')'; }
function exportSpots() {
  const a = spotsLocal(); if (!a.length) { toast('Nessuna segnalazione salvata'); return; }
  const txt = JSON.stringify(a, null, 1);
  try { const u = URL.createObjectURL(new Blob([txt], { type: 'application/json' })); const l = document.createElement('a'); l.href = u; l.download = 'segnalazioni-' + new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-') + '.json'; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); } catch (e) { }
  toast('⬇ ' + a.length + ' segnalazioni scaricate'); try { navigator.clipboard.writeText(txt).then(() => toast('📋 ' + a.length + ' segnalazioni scaricate e copiate negli appunti')).catch(() => { }); } catch (e) { }
}
function clearSpots() { try { localStorage.removeItem('gtaSpots'); } catch (e) { } spotN = 0; updDbgMenu(); toast('🗑 Segnalazioni svuotate'); }
let dbgT = 0, dbgFps = 60;
function updDebugHud(dt) {
  const el = document.getElementById('dbghud'); if (!el) return; if (!DEBUG) { el.hidden = true; return; } el.hidden = false;
  if (dt > 0) dbgFps = dbgFps * 0.95 + 0.05 / dt; if ((dbgT -= dt) > 0) return; dbgT = 0.25;
  const v = P.mode === 'car' ? P.car : null, x = v ? v.x : P.x, z = v ? v.z : P.z, y = v ? v.y : P.y;
  const lat = META.lat0 - z / 110540, lon = META.lon0 + x / (111320 * Math.cos(META.lat0 * Math.PI / 180));
  el.textContent = 'DEBUG · ' + lat.toFixed(5) + ', ' + lon.toFixed(5) + ' · x ' + x.toFixed(0) + ' z ' + z.toFixed(0) + ' y ' + y.toFixed(1) + ' · ' + (streetAt(x, z) || '-') + ' · ' + dbgFps.toFixed(0) + ' fps · segnalazioni ' + spotsLocal().length;
}
async function reportSpot() {
  if (!DEBUG) return;""")
rep("  if (!saved) { try { const a = JSON.parse(localStorage.getItem('gtaSpots') || '[]'); a.push(rec); localStorage.setItem('gtaSpots', JSON.stringify(a)); } catch (e) { } }",
    "  try { const a = spotsLocal(); a.push(rec); localStorage.setItem('gtaSpots', JSON.stringify(a)); } catch (e) { } updDbgMenu();")
rep("(saved ? '' : ' (solo in locale)')", "(saved ? ' (anche su claude.ai)' : '')")
rep("updVisuals(running && !paused ? dt : 0); updRadio(dt);", "updVisuals(running && !paused ? dt : 0); updRadio(dt); updDebugHud(running && !paused ? dt : 0);")
rep("      <div><kbd>B</kbd> / <kbd>R3</kbd> segnala un punto rotto</div>", "      <div class=\"dbg\"><kbd>B</kbd> / <kbd>R3</kbd> segnala un punto rotto</div>")
rep("<kbd>B</kbd> segnala punto · ", "<span class=\"dbg\"><kbd>B</kbd> segnala punto · </span>")
rep("${L.r} segnala punto · ", "${DEBUG ? L.r + ' segnala punto · ' : ''}")
rep("<p id=\"padline\" hidden></p>", "<p id=\"padline\" hidden></p><p class=\"dbgline\"><span class=\"dbg\"><button id=\"dbgdl\" type=\"button\">⬇ Scarica segnalazioni</button> <button id=\"dbgclr\" type=\"button\">🗑 Svuota</button> </span><input id=\"dbgcode\" type=\"text\" spellcheck=\"false\" autocomplete=\"off\" placeholder=\"codice\" maxlength=\"12\"></p>")
rep("#pause p { font-size: 19px; margin: 6px 0; }", "#pause p { font-size: 19px; margin: 6px 0; }\nbody:not(.debug) .dbg { display: none !important; }\n#pause .dbgline { margin-top: 14px; font-size: 14px; } #pause .dbgline button { font: 600 14px system-ui; padding: 6px 12px; border-radius: 4px; border: 0; background: var(--ocra); color: #15161c; cursor: pointer; margin: 2px; } #dbgcode { width: 110px; font: 14px system-ui; padding: 5px 8px; border-radius: 4px; border: 1px solid rgba(255,255,255,.25); background: #15161c; color: #fff; text-align: center; }\n#dbghud { position: fixed; left: 50%; transform: translateX(-50%); bottom: 6px; z-index: 8; font: 12px ui-monospace, monospace; color: #fff; background: rgba(0,0,0,.55); padding: 3px 8px; border-radius: 4px; pointer-events: none; white-space: nowrap; max-width: calc(100vw - 32px); overflow: hidden; text-overflow: ellipsis; }")
rep("<div id=\"pause\" hidden>", "<div id=\"dbghud\" hidden></div><div id=\"pause\" hidden>")
rep("function updVisuals(dt) {", """(() => { document.body.classList.toggle('debug', DEBUG); updDbgMenu();
  const c = document.getElementById('dbgcode'); if (!c) return;
  ['keydown', 'keyup', 'keypress'].forEach(k => c.addEventListener(k, e => { e.stopPropagation(); if (k === 'keydown' && (e.key === 'Enter' || e.key === 'Escape')) c.blur(); }));
  c.addEventListener('change', () => { const v = c.value.trim().toUpperCase(); c.value = ''; if (v === 'DEBUG') setDebug(!DEBUG); else if (v) toast('Codice sconosciuto'); });
  document.getElementById('dbgdl').onclick = exportSpots; document.getElementById('dbgclr').onclick = clearSpots; })();
function updVisuals(dt) {""")
# ---- sounds: footsteps, tyres, passing cars, ambience
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'sound3.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("  if (running) { updHud(dt); updAudio(); }", "  if (running) { updHud(dt); updAudio(); updSfx(dt); }")
# help for wheelies and stoppies
rep("      <div><kbd>R</kbd> radio on/off (Discoradio, Radio Maria in volante)</div>", "      <div><kbd>R</kbd> radio on/off (Discoradio, Radio Maria in volante)</div>\n      <div><kbd>Q</kbd> / <kbd>E</kbd> in moto: peso indietro (impennata col gas) / avanti (stoppie in frenata)</div>")
rep("<kbd>R</kbd> radio · ", "<kbd>R</kbd> radio · <kbd>Q</kbd>/<kbd>E</kbd> peso in moto · ")
# ---- version: hash and date of the last commit on main, in the start screen and the pause menu
# read from the GitHub API at load: the commit that ships this index.html doesn't exist yet when it's assembled
rep("#start .credit { font-size: 15px; color: var(--ink-dim); margin: 0; }", "#start .credit { font-size: 15px; color: var(--ink-dim); margin: 0; }\n.ver { font: 13px ui-monospace, monospace !important; color: var(--ink-dim); margin: 0; opacity: .75; } #pause .ver { margin-top: 14px; }")
rep("<p>Premi <kbd>P</kbd> per riprendere</p></div></div>", "<p>Premi <kbd>P</kbd> per riprendere</p><p class=\"ver\" id=\"pver\" hidden></p></div></div>")
rep("""  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>""", """    <p class="ver" id="ver" hidden></p>
  </div>
</div>

<script>
fetch('https://api.github.com/repos/TheConfax/Grandi-Truffe-Assassine-Brianza/commits/main').then(r => r.ok ? r.json() : Promise.reject(r.status)).then(c => {
  const d = new Date(c.commit.committer.date), p = n => String(n).padStart(2, '0');
  const txt = 'versione ' + c.sha.slice(0, 7) + ' · ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  const v = document.getElementById('ver'), a = document.createElement('a'); a.href = c.html_url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = txt; v.append(a); v.hidden = false;
  const pv = document.getElementById('pver'); pv.textContent = txt; pv.hidden = false;
}).catch(() => { }); // offline or inside claude.ai: no version line
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>""")

# ---- cheat codes in the pause menu: RESPAWN back to the start in Meda with the Ferari, FERARI spawns one
rep("""function setupWorld(saved) {""", """function startSpot() { // the parking on via Yuri Gagarin in Meda, facing the fountain
  const LL = (la, lo) => [(lo - META.lon0) * 111320 * Math.cos(META.lat0 * Math.PI / 180), -(la - META.lat0) * 110540];
  const [sx, sz] = LL(45.661706, 9.161211), FO = (D.fountains || []).map(f => [f[0] / 10, f[1] / 10]).sort((a, b) => hyp(a[0] - sx, a[1] - sz) - hyp(b[0] - sx, b[1] - sz))[0] || [STATION.x, STATION.z];
  return [sx, sz, Math.atan2(FO[0] - sx, FO[1] - sz)];
}
function setupWorld(saved) {""")
rep("""  const LL = (la, lo) => [(lo - META.lon0) * 111320 * Math.cos(META.lat0 * Math.PI / 180), -(la - META.lat0) * 110540];
  const [sx, sz] = LL(45.661706, 9.161211), FO = (D.fountains || []).map(f => [f[0] / 10, f[1] / 10]).sort((a, b) => hyp(a[0] - sx, a[1] - sz) - hyp(b[0] - sx, b[1] - sz))[0] || [STATION.x, STATION.z];
  const h = Math.atan2(FO[0] - sx, FO[1] - sz);
  const mine""", """  const [sx, sz, h] = startSpot();
  const mine""")
rep("""let last = performance.now(), acc = 0;
function frame(t) {""", """// ---------------------------------------------------------------- cheat codes, typed in the pause menu
function ferari(x, z, h) { // a red Ferari at (x,z), clearing whatever is parked on that spot
  for (const o of VEH.slice()) if (o !== P.car && hyp(o.x - x, o.z - z) < 5) o.remove();
  const v = new Vehicle('sport', '#d0141a', x, z, h); v.moved = true; v.y = surfAt(x, z); v.sync(); return v;
}
function cheatRespawn() { // back to the start: via Yuri Gagarin, on foot next to the Ferari, no stars
  if (P.car) { P.car.driver = null; P.car.boost = false; P.car.inp = { thr: 0, brk: 0, steer: 0, hand: 1 }; P.car = null; }
  const [sx, sz, h] = startSpot(); tileTick(sx, sz, 0, 420);
  const mine = ferari(sx, sz, h);
  P.x = mine.x + Math.cos(h) * 2.4; P.z = mine.z - Math.sin(h) * 2.4; if (inBuilding(P.x, P.z, 0.5)) { P.x = mine.x - Math.cos(h) * 2.4; P.z = mine.z + Math.sin(h) * 2.4; }
  P.h = h; P.y = surfAt(P.x, P.z); P.mode = 'foot'; P.model.g.visible = true; P.hp = 100; P.knock = 0; P.vx = P.vz = P.vy = 0;
  W.heat = 0; W.stars = 0; W.busted = 0; W.bustT = 0;
  camInit = false; banner('Via Yuri Gagarin', 'MEDA');
}
function cheatFerari() { // on foot: a Ferari right in front of you; driving: whatever you are in turns into one
  if (P.car) {
    const o = P.car; o.driver = null; o.boost = false; P.car = null; o.remove();
    const v = ferari(o.x, o.z, o.h); v.driver = 'player'; v.sleep = false; P.car = v;
  } else {
    const fx = Math.sin(P.h), fz = Math.cos(P.h); let x = P.x + fx * 4, z = P.z + fz * 4;
    if (inBuilding(x, z, 1.2)) { x = P.x - fx * 4; z = P.z - fz * 4; }
    ferari(x, z, P.h);
  }
  toast('🏎 Ferari!');
}
const CHEATS = { RESPAWN: cheatRespawn, FERARI: cheatFerari };
let last = performance.now(), acc = 0;
function frame(t) {""")
rep("if (v === 'DEBUG') setDebug(!DEBUG); else if (v) toast('Codice sconosciuto');", "if (v === 'DEBUG') setDebug(!DEBUG); else if (CHEATS[v]) CHEATS[v](); else if (v) toast('Codice sconosciuto');")

open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(s)
print('assembled', len(s) // 1024, 'KB')
left = [m.start() for m in re.finditer(r'surfY\(|TR\.circ|D\.(areas|rails|rivers|train|trees|surf|fences|crossings|buildings|hw|hh)\b|MAPC|MOX', s)]
print('leftover refs', [s[i:i + 40] for i in left])

