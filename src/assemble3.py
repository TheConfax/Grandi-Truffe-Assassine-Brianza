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
rep("  if (b.drape) for (let i = 0; i < b.p.length; i += 3) b.p[i + 1] += groundH(b.p[i], b.p[i + 2]);", "  if (b.drape) { clipDrape(b, b.hf || (b.vis ? H.vis : H.base), ro, mat); if (H.anyFine() && !mat.polygonOffset) { mat.polygonOffset = true; mat.polygonOffsetFactor = -1; mat.polygonOffsetUnits = -4; } } /* b.hf: altezze3.js, the ground the buffer drapes on; in a tile of S cut on its cells (world3.js clipDrape), off the ground that writes its depth by polygonOffset */")
# draped polygons split their edges on the ground they drape on (old engine only: over a tile of S polyFill cuts them on its cells, clipFill)
rep("    const mid = new Map(), gh = [], G = i => gh[i] !== undefined ? gh[i] : (gh[i] = groundH(all[i][0], all[i][1]));", "    const hf = b.hf || H.base, mid = new Map(), gh = [], G = i => gh[i] !== undefined ? gh[i] : (gh[i] = hf(all[i][0], all[i][1]));")
rep("for (const t of [0.25, 0.5, 0.75]) { const e = groundH(all[i][0] + (all[j][0] - all[i][0]) * t, all[i][1] + (all[j][1] - all[i][1]) * t)", "for (const t of [0.25, 0.5, 0.75]) { const e = hf(all[i][0] + (all[j][0] - all[i][0]) * t, all[i][1] + (all[j][1] - all[i][1]) * t)")
rep("if (cutTouches(all[i][0], all[i][1], all[j][0], all[j][1])) r = l; else for (const t of [0.25, 0.5, 0.75])", "for (const t of [0.25, 0.5, 0.75])") # the trenches of D.cut are in S (fase 6)
rep("function polyFill(b, outer, holes, y, vScale, col) {", "function polyFill(b, outer, holes, y, vScale, col) {\n  if (b.drape && clipFill(b, outer, holes, y, vScale, col)) return; /* docs/motore.md 3: on the cells of S, no drape */")
rep("      if (mx <= 16 || tris.length + stack.length > 60000) { tris.push([a, c, d]); continue; }", "      if (!mx || tris.length + stack.length > 60000) { tris.push([a, c, d]); continue; } /* L2 is 0 or the squared length of an edge to split */")
rep("""  scene.add(m); return m;
}
const flatMat""", """  parent.add(m); return m;
}
const flatMat""")

# ---- world: replace everything from "the world" to "audio" with the tiled world + level-aware collisions
world = open(os.path.join(HERE, 'altezze3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'interp3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'props3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'segnali3.js'), encoding='utf-8').read().replace('/*__SEGN__*/[]', open(os.path.join(HERE, 'segnaletica.json'), encoding='utf-8').read()) + '\n' + open(os.path.join(HERE, 'world3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'landmarks3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'oggetti3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'negozi3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'paesaggio3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'confine3.js'), encoding='utf-8').read()
coll = """
// ---------------------------------------------------------------- collisions (walls can be limited to a height band: guardrails, embankments, pillars)
function collideStatic(p, r, y) {
  let nx = 0, nz = 0, hit = false;
  WALLS.each(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1, s => {
    if (s.y0 !== undefined && (y === undefined || y < s.y0 || y > s.y1)) return;
    if (s.dyn && !s.on) return;
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
rep("const [cf, cb] = this.circles(), yf = surfY(cf[0], cf[1]), yb = surfY(cb[0], cb[1]), ty = (yf + yb) / 2;", "const [cf, cb] = this.circles(), yf = H.surface(cf[0], cf[1], this.y), yb = H.surface(cb[0], cb[1], this.y), ty = (yf + yb) / 2;")
rep("const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad);", "const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad, this.y + 0.4);")
rep("const fl = surfY(p.x, p.z); p.t += dt;", "const fl = H.surface(p.x, p.z, p.y); p.t += dt;")
rep("p.phase += spd * dt * 3.2; p.y = surfY(p.x, p.z);", "p.phase += spd * dt * 3.2; p.y = H.surface(p.x, p.z, p.y);")
rep("const fl = surfY(P.x, P.z); P.y = Math.max(fl,", "const fl = H.surface(P.x, P.z, P.y); P.y = Math.max(fl,")
rep("P.y = surfY(P.x, P.z); P.h = wrapA(P.h + steerIn * 2.8 * dt);", "P.y = H.surface(P.x, P.z, P.y); P.h = wrapA(P.h + steerIn * 2.8 * dt);")
rep("const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4);", "const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4, P.y + 0.4);")
rep("const pp = { x: p.x + p.fx * spd * dt, z: p.z + p.fz * spd * dt }; collideStatic(pp, 0.35);", "const pp = { x: p.x + p.fx * spd * dt, z: p.z + p.fz * spd * dt }; collideStatic(pp, 0.35, p.y + 0.4);")

# ---- traffic speeds per road class + spawn heights
rep("v.driver = 'ai'; v.ai = { prev: a, cur: e.to, q: [[q1[0], q1[1], e.to]], cruise: Math.min(v.maxV * 0.8, base * mood), blocked: 0, ignore: 0 }; v.sleep = false;",
    "v.driver = 'ai'; v.ai = { prev: a, cur: e.to, q: [[q1[0], q1[1], e.to, e.sp]], cruise: Math.min(v.maxV * 0.8, base * mood), mood, kind, blocked: 0, ignore: 0 }; v.sleep = false; v.y = H.node(a); v.sync();")
rep("ai.q.push([p0[0], p0[1], -1], [p1[0], p1[1], e.to]);", "ai.q.push([p0[0], p0[1], -1, e.sp], [p1[0], p1[1], e.to, e.sp]);")
rep("  let cruise = ai.cruise;\n", "  let cruise = ai.kind !== undefined ? Math.min(v.maxV * 0.85, (ai.q[0][3] || 10) * (ai.kind === 'ape' ? 0.55 : ai.kind === 'van' ? 0.9 : 1) * ai.mood) : ai.cruise;\n")
rep("const p = { x: p0[0], z: p0[1], h: 0, y: 0,", "const p = { x: p0[0], z: p0[1], h: 0, y: H.node(a),")
# police field limited radius
rep("while (heap.length) { const [d, u] = pop(); if (d > dist[u]) continue;", "while (heap.length) { const [d, u] = pop(); if (d > dist[u] || d > 2500) continue;")

# ---- parked cars: spawned per tile around the player
a = s.index("function spawnParked() {"); b = s.index("// ---------------------------------------------------------------- wanted level & police")
s = s[:a] + """function parkTile(T) {
  T.parked = []; srndT = 77 + T.t * 131;
  const add = (m, x, z, h) => { const v = new Vehicle(m, colorFor(m, tRnd), x, z, h); v.parkedTile = T; v.y = H.surface(x, z); v.sync(); T.parked.push(v); };
  // car parks with painted stalls: about half of them taken, a car in each and never in the yellow one; lots without stalls keep a few loose cars
  let inStalls = 0;
  for (const st of T.stalls || []) {
    if (st.dis || inStalls >= 14 || tRnd() > 0.45 || VEH.some(v => hyp(v.x - st.x, v.z - st.z) < 2.2)) continue;
    let m = pickModel(PARKED_MIX, tRnd); if (m === 'ape' || m === 'bici') m = 'hatch';
    add(m, st.x + (tRnd() - 0.5) * 0.25, st.z + (tRnd() - 0.5) * 0.25, st.h + (tRnd() - 0.5) * 0.05); inStalls++;
  }
  for (const a of T.d.a || []) if (a.t === 4) {
    const o = dec(a.p), ar = Math.abs(sArea(o)); if (ar < 120 || inPiazza(...centroid(o))) continue; // squares and school yards mapped as car parks stay empty
    if ((T.stalls || []).some(st => inPoly(st.x, st.z, o))) continue;
    let le = 0, ang = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length], l = hyp(q[0] - p[0], q[1] - p[1]); if (l > le) { le = l; ang = Math.atan2(q[0] - p[0], q[1] - p[1]); } }
    const n = Math.min(4, Math.floor(ar / 160)), [cx, cz] = centroid(o); let placed = 0;
    for (let k = 0; k < 30 && placed < n; k++) {
      const x = cx + (tRnd() - 0.5) * Math.sqrt(ar) * 1.2, z = cz + (tRnd() - 0.5) * Math.sqrt(ar) * 1.2;
      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;
      add(pickModel(PARKED_MIX, tRnd), x, z, ang + Math.PI / 2 + (tRnd() < 0.5 ? Math.PI : 0)); placed++;
    }
  }
  // along the streets where OSM maps the parking: about half the spaces taken
  let inStreet = 0;
  for (const st of T.streetStalls || []) {
    if (inStreet >= 16 || tRnd() > 0.5 || VEH.some(v => hyp(v.x - st.x, v.z - st.z) < 2.5)) continue;
    let m = pickModel(PARKED_MIX, tRnd); if (m === 'ape' || m === 'bici' || (st.kind === 1 && (m === 'van' || m === 'suv'))) m = 'hatch';
    add(m, st.x, st.z, st.h + (tRnd() - 0.5) * 0.04); inStreet++;
  }
  let kerb = 0;
  for (const ri of T.d.rp || []) {
    const r = D.roads[ri]; if (r.c !== 2 || r.d || r.b || r.pk) continue; // streets with mapped parking are done above
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
  parkCaserme(T);
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
  g.strokeStyle = 'rgba(255,60,40,.9)'; g.lineWidth = 9; for (const c of CONFINE) { g.beginPath(); c.p.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.closePath(); g.stroke(); } /* the edge of the area drawn from the DBGT (confine3.js) */
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
  mg.strokeStyle = 'rgba(255,60,40,.9)'; mg.lineWidth = 4 / zoom; for (const c of CONFINE) { mg.beginPath(); c.p.forEach((q, i) => i ? mg.lineTo(q[0], q[1]) : mg.moveTo(q[0], q[1])); mg.closePath(); mg.stroke(); } /* the edge of the area drawn from the DBGT (confine3.js) */
  mg.setTransform(1, 0, 0, 1, 0, 0);
  const tr = (x, z) => { const dx = (x - px) * zoom, dz = (z - pz) * zoom, a = h - Math.PI, c = Math.cos(a), s = Math.sin(a); return [dx * c - dz * s, dx * s + dz * c]; };
  mg.translate(R, R);
  for (const v of VEH) if (v.kind === 'police' && v.driver === 'ai' && W.stars > 0) { const [x, y] = tr(v.x, v.z); if (hyp(x, y) < R + 30) drawBlip(mg, x, y, (now * 4 | 0) % 2 ? '#4d86ff' : '#e0453a', 7, true, R); }
  const tgt = MS.state === 'pickup' ? MS.from : MS.state === 'deliver' ? MS.to : null;
  if (tgt) { const [x, y] = tr(tgt.x, tgt.z); drawBlip(mg, x, y, MS.state === 'pickup' ? '#f0b23c' : '#7fd18b', 10, true, R); }
  if (WAYPT) { /* the waypoint: a cross, or a blip on the rim when it is off the minimap; gone once you get there */
    const [x, y] = tr(WAYPT.x, WAYPT.z);
    if (hyp(x, y) < R - 14) { mg.lineCap = 'round'; for (const [col, w] of [['#0f1116', 7], ['#e05adc', 4]]) { mg.strokeStyle = col; mg.lineWidth = w; mg.beginPath(); mg.moveTo(x - 8, y - 8); mg.lineTo(x + 8, y + 8); mg.moveTo(x + 8, y - 8); mg.lineTo(x - 8, y + 8); mg.stroke(); } }
    else drawBlip(mg, x, y, '#e05adc', 8, true, R);
    if (hyp(px - WAYPT.x, pz - WAYPT.z) < 12) { WAYPT = null; toast('Sei arrivato'); }
  }
  const ah = camMode === 1 ? (P.mode === 'car' ? P.car.h : P.h) - Math.PI : 0;
  mg.rotate(ah); mg.fillStyle = '#fbf5e6'; mg.strokeStyle = '#0f1116'; mg.lineWidth = 3; mg.beginPath(); mg.moveTo(0, -14); mg.lineTo(10, 11); mg.lineTo(0, 5); mg.lineTo(-10, 11); mg.closePath(); mg.stroke(); mg.fill();
  mg.restore();
  mg.save(); mg.translate(R, R); mg.rotate(h - Math.PI); mg.fillStyle = '#f0b23c'; mg.font = '800 26px "Barlow Condensed", sans-serif'; mg.textAlign = 'center'; mg.textBaseline = 'middle';
  mg.translate(0, -(R - 20)); mg.rotate(-(h - Math.PI)); mg.fillText('N', 0, 0); mg.restore();
}
""" + s[b:]
rep("for (const p of D.pois) if (['stazione', 'chiesa', 'polizia', 'parco', 'monumento'].includes(p.k) && p.n.length < 30 && !p.n.startsWith('Grotta')) {",
    "for (const p of [...PLACES.filter(p => (p.k === 'town' || p.k === 'village') && Math.abs(p.x) < META.hw - 150 && Math.abs(p.z) < META.hh - 60).map(p => ({ ...p, big: 1 })), ...D.pois.filter(p => ['stazione', 'chiesa', 'parco'].includes(p.k))]) if (p.n.length < 30 && !p.n.startsWith('Grotta')) {")
rep("lab(p, '#c9bfa8', 5 * dpr); g.fillStyle = '#e8e0cc'; g.fillText(p.n, p.x + 8 * dpr / sc, p.z + 5 * dpr / sc);",
    "if (p.big) { g.save(); g.font = `400 ${20 * dpr / sc}px Bungee, Impact, sans-serif`; g.fillStyle = '#f0b23c'; g.fillText(p.n.toUpperCase(), p.x, p.z); g.restore(); } else { lab(p, '#c9bfa8', 5 * dpr); g.fillStyle = '#e8e0cc'; g.fillText(p.n, p.x + 8 * dpr / sc, p.z + 5 * dpr / sc); }")
rep("<div class=\"cap\">MEDA<span>", "<div class=\"cap\">BRIANZA<span>")

# ---- HUD place name, respawn spots, start
rep("$('street').textContent = (st || 'Meda') + (TER ? ` · ${Math.round(TER.base + groundH(P.x, P.z))} m` : '');",
    "$('street').textContent = (st ? st + ' · ' : '') + (placeAt(P.x, P.z) || 'Brianza') + ` · ${Math.round(TER.base + (P.mode === 'car' ? P.car.y : P.y))} m`;")
rep("const spot = D.pois.find(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')) || { x: 0, z: 0 };",
    "const cands = D.pois.filter(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')), spot = cands.sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0] || STATION;")
rep("banner(kind === 'busted' ? 'Polizia Locale' : 'Stazione di Meda', 'DI NUOVO IN STRADA');", "banner(spot.n || 'Meda', 'DI NUOVO IN STRADA');")
rep("const STATION = D.pois.find(p => p.k === 'stazione') || { x: 0, z: 0 };", "const STATION = D.pois.find(p => p.n === 'Stazione di Meda') || D.pois.find(p => p.k === 'stazione') || { x: 0, z: 0, n: 'Meda' };\nconst START = (() => { try { const q = new URLSearchParams(location.search), x = parseFloat(q.get('x')), z = parseFloat(q.get('z')); if (isFinite(x) && isFinite(z) && Math.abs(x) < META.hw && Math.abs(z) < META.hh) return { x, z, n: 'Punto' }; } catch (e) { } return null; })() || STATION; /* ?x=..&z=.. in the address starts the game there (links in the reports and for the collaudo) */")
rep("""function setupWorld(saved) {
  spawnParked();""", """function setupWorld(saved) {
  tileTick(STATION.x, STATION.z, 0, 420);
  for (const T of TILES) T.dist = hyp(T.cx - STATION.x, T.cz - STATION.z);
  parkTick();""")
rep("P.h = h; P.y = surfY(P.x, P.z); for (const v of VEH) { v.y = surfY(v.x, v.z); v.sync(); }", "P.h = h; P.y = H.surface(P.x, P.z); mine.y = H.surface(mine.x, mine.z); mine.sync();")
rep("""  updVisuals(running && !paused ? dt : 0);""", """  { const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z; tileTick(px, pz, running ? 7 : 12); if (running && ((now * 2) | 0) !== frame.pk) { frame.pk = (now * 2) | 0; parkTick(); } }
  updVisuals(running && !paused ? dt : 0);""")
rep("function boot(saved) { setupWorld(saved || {}); requestAnimationFrame(frame); }", "function boot(saved) { setupWorld(saved || {}); requestAnimationFrame(frame); goBtn.disabled = false; goBtn.textContent = 'ACCENDI IL MOTORE'; }")
rep("window.__G = { D, LX, MODELS, Vehicle,", "window.__G = { MAT, LMAT, H, tileTick, buildTileGen, ngList, updNegozi, LANDMARKS, updCamera, interpSnap, interpBegin, interpEnd, D, LX, MODELS, Vehicle, TILES, TRAINS, DECK_BAR, ROAD_BAR, roadBarriers, collideStatic,")
rep("enterExit, startGame, TR };", "enterExit, startGame, pollPad, GATES, WALLS, N, DRIVE, TRAF, WALK, DRIVE_NODES, TRAF_NODES, WALK_NODES, nearestNode, nodeInRing, cops, crime, spawnPolice, spawnPed, spawnTraffic, policeField, rayWalls, inBuilding, placeAt, streetAt, BLD, pedTarget, STATIC, RADIO, CASERME };")
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
# (the heights of the trains are in trains3.js: trainProfile, fase 6)
# AI stops at red lights
rep("    for (const g of LX) if (g.bars && (g.closed || g.ang < 0.7)) for (const b of g.bars) for (const [x, z] of b.probe) check(x, z);",
    "    for (const g of LX) if (g.bars && (g.closed || g.ang < 0.7)) for (const b of g.bars) for (const [x, z] of b.probe) check(x, z);\n    if (v.ai && !v.ai.cop) SIGG.each(v.x - 30, v.z - 30, v.x + 30, v.z + 30, sg => { if (sigState(axisOf(fx, fz)) === 'g') return; const ox = sg.x - v.x, oz = sg.z - v.z, ahead = ox * fx + oz * fz, side = Math.abs(ox * fz - oz * fx); if (ahead > sg.w / 2 + 3 && ahead < 32 && side < sg.w / 2 + 4) block = Math.min(block, ahead - sg.w / 2 - 1); });")
rep("  updTrain(dt); updCrossings(dt);", "  updTrain(dt); updCrossings(dt); updSignals(); updGates(dt); updFountains();")
rep("    v.step(dt); v.collide();", "    v.step(dt); gateHits(v); fuelHits(v); propHits(v); v.collide();")
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
rep("updSignals(); updGates(dt); updFountains();", "updSignals(); updGates(dt); updFountains(); updDayNight(dt); updWrecks(dt); updFuel(dt); updProps(dt); updOggetti(dt);")
rep("  updCamera(running ? dt : dt * 0.4);", "  updCamera(running ? dt : dt * 0.4); updGlow();")
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
  const rec = { x: +x.toFixed(1), z: +z.toFixed(1), y: +y.toFixed(1), suolo: +H.ground(x, z).toFixed(1), lat: +lat.toFixed(6), lon: +lon.toFixed(6), via: streetAt(x, z) || '', zona: placeAt(x, z) || '', direzione: Math.round(((v ? v.h : P.h) * 180 / Math.PI + 360) % 360), modo: P.mode, velocita: v ? Math.round(v.speed * 3.6) : 0, cam: camMode, ora: $('clock') ? $('clock').textContent : '', quando: new Date().toISOString(), versione: 'v16' };
  spotN++; try { sfxBlip(660, 990, 0.12); } catch (e) { }
  let saved = false; if (spotDb) { try { await spotDb.collection('segnalazioni').add(rec); saved = true; } catch (e) { saved = false; } }
  if (!saved && /^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) { try { const r = await fetch('/segnala', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rec) }); saved = r.ok; } catch (e) { } } /* local game: straight to the dev server, Claude reads it live */
  if (!saved) { try { const a = JSON.parse(localStorage.getItem('gtaSpots') || '[]'); a.push(rec); localStorage.setItem('gtaSpots', JSON.stringify(a)); } catch (e) { } }
  toast('📍 Punto ' + spotN + ' segnalato' + (rec.via ? ': ' + rec.via : '') + (saved ? '' : ' (solo in locale)'));
}
function updVisuals(dt) {""")
rep("  if (e.code === 'KeyN') skipTime(2);", "  if (e.code === 'KeyN') skipTime(2);\n  if (e.code === 'KeyB') reportSpot();\n  if (e.code === 'KeyJ' && DEBUG) { const r = H.check(); toast('H.check: ' + r.tile + ' tile, scarto ' + r.scarto_max_m.toFixed(3) + ' m (raggi ' + r.scarto_raggi_m.toFixed(3) + ')'); }")
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
# ---- version: hash and date of the commit GitHub Pages is serving, in the start screen and the pause menu, plus the one still being
# published if there is one; read from the GitHub API at load: the commit that ships this index.html doesn't exist yet when it's assembled
rep("#start .credit { font-size: 15px; color: var(--ink-dim); margin: 0; }", "#start .credit { font-size: 15px; color: var(--ink-dim); margin: 0; }\n.ver { font: 13px ui-monospace, monospace !important; color: var(--ink-dim); margin: 0; opacity: .75; } #pause .ver { margin-top: 14px; }")
rep("<p>Premi <kbd>P</kbd> per riprendere</p></div></div>", "<p>Premi <kbd>P</kbd> per riprendere</p><p class=\"ver\" id=\"pver\" hidden></p></div></div>")
rep("""  </div>
</div>

<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>""", """    <p class="ver" id="ver" hidden></p>
  </div>
</div>

<script>
(async () => { // the commit GitHub Pages is serving now (the newest deployment that went through), not just the newest commit on main
  const API = 'https://api.github.com/repos/TheConfax/Grandi-Truffe-Assassine-Brianza', get = u => fetch(u).then(r => r.ok ? r.json() : Promise.reject(r.status));
  const deps = await get(API + '/deployments?environment=github-pages&per_page=4'); let live = null; // two calls when all is published: GitHub allows 60 an hour
  for (const d of deps) { const st = await get(d.statuses_url + '?per_page=1'); if (st[0] && st[0].state === 'success') { live = d; break; } }
  if (!live) return;
  const d = new Date(live.created_at), p = n => String(n).padStart(2, '0'), c = { html_url: 'https://github.com/TheConfax/Grandi-Truffe-Assassine-Brianza/commit/' + live.sha };
  let txt = 'versione ' + live.sha.slice(0, 7) + ' · ' + p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
  if (deps[0] !== live) txt += ' · in arrivo ' + deps[0].sha.slice(0, 7); // pushed but GitHub hasn't published it yet
  const v = document.getElementById('ver'), a = document.createElement('a'); a.href = c.html_url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = txt; v.append(a); v.hidden = false;
  const pv = document.getElementById('pver'); pv.textContent = txt; pv.hidden = false;
})().catch(() => { }); // offline or inside claude.ai: no version line
</script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>""")
# ---- caserme: parked volanti and agents on foot at the Carabinieri stations and Polizia Locale headquarters
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'police3.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("updWrecks(dt); updFuel(dt);", "updWrecks(dt); updFuel(dt); updCaserme(dt);")
rep("updProps(dt); updOggetti(dt);", "updProps(dt); updOggetti(dt); updNegozi(dt);")
rep("  missionStep(dt);\n}", "  updCaserme2(dt); missionStep(dt);\n}")
rep("    if (p.state === 'flee') { p.t -= dt; spd = 5;", "    if (p.cop) { spd = copStep(p, dt); if (spd < 0) continue; }\n    else if (p.state === 'flee') { p.t -= dt; spd = 5;")
rep("if (v === P.car) { crime(1, W.stars === 0 ? 'Pirata della strada! La Polizia Locale ti cerca.' : null);", "if (v === P.car) { crime(p.cop ? 2.5 : 1, p.cop ? 'Hai investito un agente!' : W.stars === 0 ? 'Pirata della strada! La Polizia Locale ti cerca.' : null);")
rep("let close = false; for (const c of cs) if (hyp(c.x - P.x, c.z - P.z) < 6.5 && c.speed < 4) close = true;", "let close = footCopClose(); for (const c of cs) if (hyp(c.x - P.x, c.z - P.z) < 6.5 && c.speed < 4) close = true;")
rep("if (wasCop) crime(2.5, 'Hai rubato un\\'auto della Polizia Locale!');", "if (wasCop) crime(2.5, 'Hai rubato ' + (best.color === CC_COL ? CC_NAME : PL_NAME) + '!');")
rep("else if (cops().some(c => hyp(c.x - P.x, c.z - P.z) < 50)) crime(", "else if (cops().some(c => hyp(c.x - P.x, c.z - P.z) < 50) || footCopNear(40)) crime(")
rep("    if (best.fallen) {", "    if (best.caserma && !best.taken && best.driver !== 'ai') { best.taken = true; crime(2, null); const msg = 'Hai rubato ' + (best.caserma.cc ? CC_NAME : PL_NAME) + ' davanti alla caserma!'; setTimeout(() => toast(msg), 1800); }\n    if (best.fallen) {")
rep("near.kind === 'police' ? 'ruba l\\'auto della Polizia' :", "near.kind === 'police' ? 'ruba ' + (near.color === CC_COL ? 'la gazzella dei Carabinieri' : 'l\\'auto della Polizia') :")
rep("${near.driver === 'ai' ? (", "${near.caserma && !near.taken && near.driver !== 'ai' ? 'ruba ' + (near.caserma.cc ? 'la gazzella dei Carabinieri' : 'l\\'auto della Polizia Locale') : near.driver === 'ai' ? (")
rep("}${best.spec.name} · fino a", "}${best.color === CC_COL ? 'Gazzella dei Carabinieri' : best.spec.name} · fino a")
# busted: you walk out of the door of the caserma
rep("const n = nearestNode(WALK_NODES, spot.x, spot.z); P.x = N[n][0]; P.z = N[n][1];", "const n = nearestNode(WALK_NODES, spot.x, spot.z); P.x = N[n][0]; P.z = N[n][1]; const cz = kind === 'busted' && CASERME.find(c => c.p === spot); if (cz) { [P.x, P.z] = cz.at(0, 2.4); P.h = Math.atan2(cz.nx, cz.nz); cz.force = true; }")

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
  const v = new Vehicle('sport', '#d0141a', x, z, h); v.moved = true; v.y = H.surface(x, z); v.sync(); return v;
}
function cheatRespawn() { // back to the start: via Yuri Gagarin, on foot next to the Ferari, no stars
  if (P.car) { P.car.driver = null; P.car.boost = false; P.car.inp = { thr: 0, brk: 0, steer: 0, hand: 1 }; P.car = null; }
  const [sx, sz, h] = startSpot(); tileTick(sx, sz, 0, 420);
  const mine = ferari(sx, sz, h);
  P.x = mine.x + Math.cos(h) * 2.4; P.z = mine.z - Math.sin(h) * 2.4; if (inBuilding(P.x, P.z, 0.5)) { P.x = mine.x - Math.cos(h) * 2.4; P.z = mine.z + Math.sin(h) * 2.4; }
  P.h = h; P.y = H.surface(P.x, P.z); P.mode = 'foot'; P.model.g.visible = true; P.hp = 100; P.knock = 0; P.vx = P.vz = P.vy = 0;
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

# ---- weather: clouds, rain, thunderstorms and fog; codes SOLE, NUVOLE, PIOGGIA, TEMPORALE, NEBBIA
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'weather3.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'foto3.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("// ---------------------------------------------------------------- renderer\n", open(os.path.join(HERE, 'foto3_colori.js'), encoding='utf-8').read() + "\n// ---------------------------------------------------------------- renderer\n")
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/objects/Sky.js"></script>')  # the sky of foto3.js
rep("updDayNight(dt);", "updDayNight(dt); updWeather(dt);")
rep("13 + S.grip * 0.4) / Math.max(4, Math.abs(v));", "13 + S.grip * (1 - 0.3 * WX.wet) * 0.4) / Math.max(4, Math.abs(v));") # wet tyres slide earlier
rep("lat *= Math.exp(-(i.hand ? 1.1 : S.grip) * dt);", "lat *= Math.exp(-(i.hand ? 1.1 : S.grip * (1 - 0.3 * WX.wet)) * dt);")
rep("v -= (arc ? 21 : 11) * dt * i.brk;", "v -= (arc ? 21 : 11) * (1 - 0.25 * WX.wet) * dt * i.brk;") # wet brakes
rep("updGlow();", "updGlow(); updSkyFx(running && !paused ? dt : 0);")
rep("const CHEATS = { RESPAWN: cheatRespawn, FERARI: cheatFerari };", "const CHEATS = { RESPAWN: cheatRespawn, FERARI: cheatFerari, SOLE: () => setWeather('sereno', true), NUVOLE: () => setWeather('nuvoloso', true), PIOGGIA: () => setWeather('pioggia', true), TEMPORALE: () => setWeather('temporale', true), NEBBIA: () => setWeather('nebbia', true) };")

open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(s)
print('assembled', len(s) // 1024, 'KB')
left = [m.start() for m in re.finditer(r'surfY\(|TR\.circ|D\.(areas|rails|rivers|train|trees|surf|fences|crossings|buildings|hw|hh)\b|MAPC|MOX', s)]
print('leftover refs', [s[i:i + 40] for i in left])


# ---- draw each frame between the last two physics steps (interp3.js)
rep("while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n++; } if (n === 5) acc = 0; }", "while (acc >= 1 / 60 && n < 5) { interpSnap(); step(1 / 60); acc -= 1 / 60; n++; } if (n === 5) acc = 0; }")
# right stick: the chase camera swings round the car (or the walker) to look about; let go and it eases back behind (Carlo, 24/10)
rep("let toastT = 0, bannerT = 0,", "let camYaw = 0, camPitch = 0, camBack = false, toastT = 0, bannerT = 0,")
rep("GP.steer = dz(g.axes[0] || 0);", "GP.steer = dz(g.axes[0] || 0); GP.lookx = dz(g.axes[2] || 0); GP.looky = dz(g.axes[3] || 0); GP.back = b(11);")
# holding the right stick down looks behind, as in GTA: the bug report moves from R3 to the d-pad down (B on the keyboard stays)
rep("  if (edge(11)) reportSpot();", "  if (edge(13)) reportSpot();")
# up and down: the camera drops to look up or rises to look down from above, and settles back the same way
rep("want = new THREE.Vector3(cx, Math.max(gy, groundH(cx, cz)) + ht + lift, cz);",
    "{ const p_ = Math.abs(GP.looky || 0) > 0.12 ? GP.looky : 0; if (p_) camPitch = clamp(camPitch + p_ * 3 * dt, -0.45, 1.3); else camPitch *= Math.exp(-2.5 * dt); }\n"
    "    want = new THREE.Vector3(cx, Math.max(gy, H.ground(cx, cz)) + Math.max(0.6, ht + lift + camPitch * (inCar ? 6 : 3.5)), cz);")
rep("    let hx = fx, hz = fz; if (inCar && P.car.fwdSpeed < -2) { hx = -fx; hz = -fz; }",
    "    let hx = fx, hz = fz; if (inCar && P.car.fwdSpeed < -2) { hx = -fx; hz = -fz; }\n"
    "    { const s_ = Math.abs(GP.lookx || 0) > 0.12 ? -GP.lookx : 0; if (s_) camYaw = clamp(camYaw + s_ * 4.5 * dt, -Math.PI, Math.PI); else camYaw *= Math.exp(-2.5 * dt); /* heading grows towards the left */\n"
    "      const c_ = Math.cos(camYaw), n_ = Math.sin(camYaw), rx_ = hx * c_ + hz * n_, rz_ = hz * c_ - hx * n_; hx = rx_; hz = rz_; const bk_ = GP.back > 0.5; if (bk_) { hx = -hx; hz = -hz; } if (bk_ !== camBack) { camBack = bk_; camInit = false; } } /* looking back and forward again is a cut, not a swing round */")
# while the stick turns it the camera goes where it is pushed at once: the follow smoothing is for the car's turns, on the stick it felt like butter
rep("  const k = 1 - Math.exp(-(camMode === 1 ? 5 : 7.5) * dt);",
    "  const k = camMode === 2 ? 1 : 1 - Math.exp(-(camMode === 1 ? 5 : (Math.abs(GP.lookx || 0) > 0.12 || Math.abs(GP.looky || 0) > 0.12) ? 40 : 7.5) * dt);")
rep("camPos.lerp(want, k); camLook.lerp(look, 1 - Math.exp(-12 * dt));", "camPos.lerp(want, k); camLook.lerp(look, camMode === 2 ? 1 : 1 - Math.exp(-12 * dt));")
# a third view, first person (Carlo, 24/10): the walker's eyes, or just above the bonnet; the right stick looks about, R3 behind
rep("camMode = (camMode + 1) % 2", "camMode = (camMode + 1) % 3", 3)
rep("  if (camMode === 1) {\n    const ht = inCar ? 58 + sp * 0.9 : 36,",
    "  if (!inCar) P.model.g.visible = camMode !== 2;\n"
    "  if (camMode === 2) {\n"
    "    let hx = fx, hz = fz; const s_ = Math.abs(GP.lookx || 0) > 0.12 ? -GP.lookx : 0, p_ = Math.abs(GP.looky || 0) > 0.12 ? GP.looky : 0;\n"
    "    if (s_) camYaw = clamp(camYaw + s_ * 4.5 * dt, -2.3, 2.3); else camYaw *= Math.exp(-4 * dt);\n"
    "    if (p_) camPitch = clamp(camPitch + p_ * 2 * dt, -0.7, 0.7); else camPitch *= Math.exp(-4 * dt);\n"
    "    const c_ = Math.cos(camYaw), n_ = Math.sin(camYaw), rx_ = hx * c_ + hz * n_, rz_ = hz * c_ - hx * n_; hx = rx_; hz = rz_; if (GP.back > 0.5) { hx = -hx; hz = -hz; }\n"
    "    const ey = inCar ? P.car.y + 1.25 : P.y + 1.62, fo = inCar ? 1.1 : 0.15;\n"
    "    want = new THREE.Vector3(px + fx * fo, ey, pz + fz * fo); look = new THREE.Vector3(want.x + hx * 10, ey - camPitch * 7, want.z + hz * 10);\n"
    "  } else if (camMode === 1) {\n    const ht = inCar ? 58 + sp * 0.9 : 36,")
# debug mode: cars never break (health back to full after every physics step, so nothing reaches zero and burns)
rep("interpSnap(); step(1 / 60);", "interpSnap(); step(1 / 60); if (DEBUG) for (const v of VEH) if (v.health < 100) v.health = 100;")
rep("  updVisuals(running && !paused ? dt : 0); updRadio(dt);", "  const ipol = running && !paused ? interpBegin(clamp(acc * 60, 0, 1)) : null;\n  updVisuals(running && !paused ? dt : 0); updRadio(dt);")
rep("  renderer.render(scene, camera);\n}", "  renderer.render(scene, camera);\n  if (ipol) interpEnd(ipol);\n}")
# ?x=..&z=.. in the address (START): the game starts there, on the nearest street, already at the wheel of the Ferari
rep("  for (const p of PEDS.slice()) if (hyp(p.x - P.x, p.z - P.z) < 5) removePed(p);\n}",
    "  for (const p of PEDS.slice()) if (hyp(p.x - P.x, p.z - P.z) < 5) removePed(p);\n"
    "  if (START !== STATION) { /* the start chosen in the address: the car on the nearest lane, the tiles around it first */\n"
    "    const n2 = nearestNode(TRAF_NODES, START.x, START.z), e2 = TRAF[n2][0], [q0, q1] = edgePts(n2, e2.to, e2.off + 0.9), h2 = Math.atan2(q1[0] - q0[0], q1[1] - q0[1]);\n"
    "    for (const v of VEH.slice()) if (v !== mine && hyp(v.x - q0[0], v.z - q0[1]) < 7) v.remove();\n"
    "    mine.x = q0[0]; mine.z = q0[1]; mine.h = h2; P.x = mine.x + Math.cos(h2) * 2.4; P.z = mine.z - Math.sin(h2) * 2.4; P.h = h2;\n"
    "    tileTick(START.x, START.z, 0, 420); for (const T of TILES) T.dist = hyp(T.cx - START.x, T.cz - START.z);\n"
    "    P.y = H.surface(P.x, P.z); mine.y = H.surface(mine.x, mine.z); mine.sync();\n"
    "  }\n}")
rep("function startGame() {\n  if (running) return; running = true;",
    "function startGame() {\n  if (running) return; running = true; if (START !== STATION) setTimeout(() => { if (P.mode === 'foot') enterExit(); }, 50); /* started from a link: already in the car */")
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(s)
