import re
import os
import subprocess as _sp, datetime as _dt
_git = lambda *a: (_sp.run(['git', '-C', os.path.dirname(os.path.dirname(os.path.abspath(__file__))), *a], capture_output=True, text=True).stdout.strip() or '?')
BUILD_BR, BUILD_SHA, BUILD_AT = os.environ.get('GTA_RAMO') or _git('rev-parse', '--abbrev-ref', 'HEAD'),_git('rev-parse', '--short', 'HEAD'), _dt.datetime.now().strftime('%d/%m %H:%M')  # the local version line
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
/* the world comes in pieces (pezzi3.js, docs/motore.md "Caricamento a pezzi"): at the start only what must be whole, mappa/globale.bin (the road graph, names, points of interest,
   railways, what the bake decided on the whole map) and mappa/suolo.bin (the 10 m ground of all the playable zone). They are always checked with the server (cache 'no-cache');
   the pieces carry the version in their address, so the browser can keep them without ever showing an old one */
const QS = new URLSearchParams(location.search), COTTURA = QS.has('cuoci'), TUTTO = COTTURA || QS.has('tutto'); /* ?cuoci: the bake, src/cuoci.mjs; ?tutto: the whole map laid out, as the checks of the whole map need */
const FRESCO = { cache: 'no-cache' }, PZ_DEC = new TextDecoder();
const gunzip = async ab => new Uint8Array(await new Response(new Blob([ab]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
const leggiGz = async u => { const r = await fetch(u, FRESCO); if (!r.ok) throw new Error(u + ': HTTP ' + r.status); return gunzip(await r.arrayBuffer()); };
goBtn.disabled = true; goBtn.textContent = 'CARICO LA BRIANZA…';
const [D, SUOLO] = await Promise.all([leggiGz('mappa/globale.bin').then(b => JSON.parse(PZ_DEC.decode(b))), leggiGz('mappa/suolo.bin').then(b => new Int16Array(b.buffer, b.byteOffset, b.byteLength >> 1))]);
if (COTTURA) D.ng = (await (await fetch('mappa/solo_cottura.json', FRESCO)).json()).ng;
const COT = TUTTO ? null : D.cotta;
goBtn.textContent = 'COSTRUISCO LE STRADE…';
await new Promise(r => setTimeout(r, 30));""")
rep("const LIM_X = D.hw + 95, LIM_Z = D.hh + 95;", "const META = D.meta, LIM_X = META.dati.hw - 4, LIM_Z = META.dati.hh - 4, ZONA = META.zona; /* LIM: where the data of the build reach (the graphs and what stands on them stop there, inLim); ZONA: how far you can go, all the playable zone */")
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
world = open(os.path.join(HERE, 'altezze3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'interp3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'props3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'sfondabili3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'segnali3.js'), encoding='utf-8').read().replace('/*__SEGN__*/[]', open(os.path.join(HERE, 'segnaletica.json'), encoding='utf-8').read()) + '\n' + open(os.path.join(HERE, 'world3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'rotonde3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'landmarks3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'oggetti3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'negozi3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'acqua3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'paesaggio3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'confine3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'pezzi3.js'), encoding='utf-8').read() + '\n' + open(os.path.join(HERE, 'gps3.js'), encoding='utf-8').read()
coll = """
// ---------------------------------------------------------------- collisions (walls can be limited to a height band: guardrails, embankments, pillars)
function collideStatic(p, r, y, veh, skip) { /* skip: what a car rests on (fisica3.js vehAppoggio) */
  let nx = 0, nz = 0, hit = false, fx = 0, fz = 0, pinch = false; const one = (x, z) => { if (!hit) { fx = x; fz = z; } else if (x * fx + z * fz < -0.2) pinch = true; }; /* pinch: pushed from two opposite sides (between two posts narrower than it) */
  WALLS.each(p.x - r - 1, p.z - r - 1, p.x + r + 1, p.z + r + 1, s => {
    if (s.off || (skip && skip.has(s)) || s.y0 !== undefined && (y === undefined || y < s.y0 || y > (veh ? (s.yv !== undefined ? s.yv : s.y1) : s.yp ? s.yp.max : s.y1))) return; /* yv: the top a vehicle meets (at least 1.2 m on a low barrier, y1 is the drawn one for the walker); s.off: a barrier piece broken through (sfondabili3.js) */
    if (s.dyn && !s.on) return;
    if (s.r) { const dx = p.x - s.x, dz = p.z - s.z, d = hyp(dx, dz), R = r + s.r; if (d < R && d > 1e-6) { const k = (R - d) / d; p.x += dx * k; p.z += dz * k; nx += dx / d; nz += dz / d; one(dx / d, dz / d); hit = true; } return; }
    if (s.dyn && !s.on) return;
    const ex = s.bx - s.ax, ez = s.bz - s.az, L2 = ex * ex + ez * ez; if (L2 < 1e-6) return;
    let t = ((p.x - s.ax) * ex + (p.z - s.az) * ez) / L2, cl = false; if (t < 0) { t = 0; cl = true; } else if (t > 1) { t = 1; cl = true; }
    if (!veh && s.yp && y > wallTopP(s, t)) return; /* on foot a building's wall stands up to its roof, not over it: the walker on a roof walks off its edge (world3.js wallTopP) */
    const cx = s.ax + ex * t, cz = s.az + ez * t, dx = p.x - cx, dz = p.z - cz, d = hyp(dx, dz);
    if (s.two || dx * s.nx + dz * s.nz >= 0 || cl) { if (d < r && d > 1e-6) { const k = (r - d) / d; p.x += dx * k; p.z += dz * k; nx += dx / d; nz += dz / d; one(dx / d, dz / d); hit = true; } }
    else if (d < r) { p.x += s.nx * (r + d); p.z += s.nz * (r + d); nx += s.nx; nz += s.nz; one(s.nx, s.nz); hit = true; }
  });
  if (!hit) return null; const l = hyp(nx, nz) || 1, out = [nx / l, nz / l]; out.pinch = pinch; return out;
}
function rayWalls(ax, az, bx, bz, solidOnly) {
  let best = 1; const dx = bx - ax, dz = bz - az;
  WALLS.each(Math.min(ax, bx), Math.min(az, bz), Math.max(ax, bx), Math.max(az, bz), s => {
    if (s.r || s.dyn || s.off || s.deckw || (solidOnly && s.two)) return; const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex; if (Math.abs(den) < 1e-9) return;
    const t = ((s.ax - ax) * ez - (s.az - az) * ex) / den, u = ((s.ax - ax) * dz - (s.az - az) * dx) / den;
    if (t >= 0 && t <= 1 && u >= 0 && u <= 1 && t < best) best = t;
  });
  return best;
}
"""
cut("// ---------------------------------------------------------------- the world\n", "// ---------------------------------------------------------------- audio\n",
    "// ---------------------------------------------------------------- the world\nconst ground = new THREE.Mesh(new THREE.PlaneGeometry(14000, 14000), new THREE.MeshLambertMaterial({ map: groundTex, depthWrite: false }));\ngroundTex.repeat.set(1400, 1400); ground.rotation.x = -Math.PI / 2; ground.position.y = -1.5; ground.receiveShadow = true; ground.renderOrder = -4; scene.add(ground);\n" + coll + world + "\n")
# ---- trains
cut("// ---------------------------------------------------------------- train (Ferrovia Milano-Asso)\n", "// ---------------------------------------------------------------- spawning helpers\n", open(os.path.join(HERE, 'trains3.js'), encoding='utf-8').read() + "\n")
rep("if (TR) for (const c of TR.circ) check(c[0], c[1]);", "for (const c of TRAIN_CIRC) check(c[0], c[1]);")
rep("if (TR) for (const [cx, cz, tvx, tvz] of TR.circ) {\n    for (const v of VEH)", "for (const [cx, cz, tvx, tvz] of TRAIN_CIRC) {\n    for (const v of VEH)")
rep("if (TR && p.state !== 'dead') for (const [cx, cz, tvx, tvz] of TR.circ)", "if (p.state !== 'dead') for (const [cx, cz, tvx, tvz] of TRAIN_CIRC)")
rep("if (TR) for (const [cx, cz, tvx, tvz] of TR.circ) { const dx = P.x - cx", "for (const [cx, cz, tvx, tvz] of TRAIN_CIRC) { const dx = P.x - cx")

# ---- heights on several levels
rep("const [cf, cb] = this.circles(), yf = surfY(cf[0], cf[1]), yb = surfY(cb[0], cb[1]), ty = (yf + yb) / 2;", "const [cf, cb] = this.circles(), yf = H.surface(cf[0], cf[1], this.y), yb = H.surface(cb[0], cb[1], this.y), ty = (yf + yb) / 2;")
rep("const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad);", "const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad, this.y + 0.4, true);")
rep("const fl = surfY(p.x, p.z); p.t += dt;", "const fl = H.surface(p.x, p.z, p.y); p.t += dt;")
rep("p.phase += spd * dt * 3.2; p.y = surfY(p.x, p.z);", "p.phase += spd * dt * 3.2; p.y = H.surface(p.x, p.z, p.y);")
rep("const fl = surfY(P.x, P.z); P.y = Math.max(fl,", "const fl = H.surface(P.x, P.z, P.y); P.y = Math.max(fl,")
rep("P.y = surfY(P.x, P.z); P.h = wrapA(P.h + steerIn * 2.8 * dt);", "P.y = H.surface(P.x, P.z, P.y); P.h = wrapA(P.h + ((K.left ? 1 : 0) - (K.right ? 1 : 0)) * 2.8 * dt);")
rep("const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4);", "const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4, P.y + 0.4);")
rep("const pp = { x: p.x + p.fx * spd * dt, z: p.z + p.fz * spd * dt }; collideStatic(pp, 0.35);", "const pp = { x: p.x + p.fx * spd * dt, z: p.z + p.fz * spd * dt }; collideStatic(pp, 0.35, p.y + 0.4);")

# ---- traffic speeds per road class + spawn heights
rep("const v = new Vehicle(kind, col, q0[0], q0[1], Math.atan2(q1[0] - q0[0], q1[1] - q0[1]));", "if (!carFree(MODELS[kind], q0[0], q0[1], Math.atan2(q1[0] - q0[0], q1[1] - q0[1]), H.node(a))) return null; /* not born in a wall (parkTile) */ const v = new Vehicle(kind, col, q0[0], q0[1], Math.atan2(q1[0] - q0[0], q1[1] - q0[1]));")
rep("v.driver = 'ai'; v.ai = { prev: a, cur: e.to, q: [[q1[0], q1[1], e.to]], cruise: Math.min(v.maxV * 0.8, base * mood), blocked: 0, ignore: 0 }; v.sleep = false;",
    "v.driver = 'ai'; v.ai = { prev: a, cur: e.to, q: [[q1[0], q1[1], e.to, e.sp]], cruise: Math.min(v.maxV * 0.8, base * mood), mood, kind, blocked: 0, ignore: 0 }; v.sleep = false; v.y = H.node(a); v.sync();")
rep("ai.q.push([p0[0], p0[1], -1], [p1[0], p1[1], e.to]);", "ai.q.push([p0[0], p0[1], -1, e.sp], [p1[0], p1[1], e.to, e.sp]);")
rep("  let cruise = ai.cruise;\n", "  let cruise = ai.kind !== undefined ? Math.min(v.maxV * 0.85, (ai.q[0][3] || 10) * (ai.kind === 'ape' ? 0.55 : ai.kind === 'van' ? 0.9 : 1) * ai.mood) : ai.cruise;\n")
# police field limited radius
rep("while (heap.length) { const [d, u] = pop(); if (d > dist[u]) continue;", "while (heap.length) { const [d, u] = pop(); if (d > dist[u] || d > 2500) continue;")

# ---- parked cars: spawned per tile around the player
a = s.index("function spawnParked() {"); b = s.index("// ---------------------------------------------------------------- wanted level & police")
s = s[:a] + """// a car standing still (parked, or just spawned in the traffic) keeps 0.2 m from every wall that does not move: the walls of buildings, the
// fences and walls of the DBGT on the edge of the carriageway (src/barriere.py), guardrails, and 0.1 m from posts and trunks. Gates and the pieces broken through (sfondabili3.js) open
function carFree(spec, x, z, h, y) {
  const rad = spec.W / 2 + 0.02, co = Math.max(0.2, spec.L / 2 - rad), fx = Math.sin(h) * co, fz = Math.cos(h) * co, yy = y + 0.4, cs = [[x + fx, z + fz], [x - fx, z - fz]]; let ok = true;
  WALLS.each(x - co - rad - 1.5, z - co - rad - 1.5, x + co + rad + 1.5, z + co + rad + 1.5, s => {
    if (!ok || s.dyn || s.off || (s.y0 !== undefined && (yy < s.y0 || yy > (s.yv !== undefined ? s.yv : s.y1)))) return;
    for (const c of cs) if (s.r ? hyp(c[0] - s.x, c[1] - s.z) < s.r + rad + 0.1 : segDist(c[0], c[1], s.ax, s.az, s.bx, s.bz) < rad + 0.2) { ok = false; return; }
  });
  return ok;
}
// the cars of the tiles around one just built checked again against what it brought (its posts, benches, pillars): one that stands in them goes
function parkCheck(T) {
  const x0 = T.cx - TS / 2 - 8, x1 = T.cx + TS / 2 + 8, z0 = T.cz - TS / 2 - 8, z1 = T.cz + TS / 2 + 8;
  for (const v of VEH.slice()) if (v.parkedTile && v.parkedTile !== T && v.driver === null && !v.moved && v !== P.car && v.speed < 0.1 && v.x > x0 && v.x < x1 && v.z > z0 && v.z < z1 && !carFree(v.spec, v.x, v.z, v.h, v.y)) v.remove();
}
function parkTile(T) {
  T.parked = []; srndT = 77 + T.seme * 131;
  const add = (m, x, z, h, src) => { if (H.inPit(x, z, 1.5) || [0, 2.5, -2.5].some(d => H.gallAt(x + Math.sin(h) * d, z + Math.cos(h) * d))) return false; /* (nor in the covered part of an underpass: H.surface there is the ground over it, the car came out of the front wall, Carlo 3/11) */ const y = H.surface(x, z); if (!carFree(MODELS[m], x, z, h, y)) return false; const v = new Vehicle(m, colorFor(m, tRnd), x, z, h); v.parkedTile = T; v.src = src; v.y = y; v.sync(); T.parked.push(v); return true; };
  // car parks with painted stalls: about half of them taken, a car in each and never in the yellow one; lots without stalls keep a few loose cars
  let inStalls = 0;
  for (const st of T.stalls || []) {
    if (st.dis || inStalls >= 14 || tRnd() > 0.45 || VEH.some(v => hyp(v.x - st.x, v.z - st.z) < 2.2)) continue;
    let m = pickModel(PARKED_MIX, tRnd); if (m === 'ape' || m === 'bici') m = 'hatch';
    if (add(m, st.x + (tRnd() - 0.5) * 0.25, st.z + (tRnd() - 0.5) * 0.25, st.h + (tRnd() - 0.5) * 0.05, 'stallo')) inStalls++;
  }
  for (const a of T.d.a || []) if (a.t === 4) {
    const o = dec(a.p), ar = Math.abs(sArea(o)); if (ar < 120) continue;
    if ((T.stalls || []).some(st => inPoly(st.x, st.z, o))) continue;
    let le = 0, ang = 0; for (let i = 0; i < o.length; i++) { const p = o[i], q = o[(i + 1) % o.length], l = hyp(q[0] - p[0], q[1] - p[1]); if (l > le) { le = l; ang = Math.atan2(q[0] - p[0], q[1] - p[1]); } }
    const n = Math.min(4, Math.floor(ar / 160)), [cx, cz] = centroid(o); let placed = 0;
    for (let k = 0; k < 30 && placed < n; k++) {
      const x = cx + (tRnd() - 0.5) * Math.sqrt(ar) * 1.2, z = cz + (tRnd() - 0.5) * Math.sqrt(ar) * 1.2;
      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;
      if (add(pickModel(PARKED_MIX, tRnd), x, z, ang + Math.PI / 2 + (tRnd() < 0.5 ? Math.PI : 0), 'piazzale')) placed++;
    }
  }
  // along the streets where OSM maps the parking: about half the spaces taken
  let inStreet = 0;
  for (const st of T.streetStalls || []) {
    if (inStreet >= 16 || tRnd() > 0.5 || VEH.some(v => hyp(v.x - st.x, v.z - st.z) < 2.5)) continue;
    let m = pickModel(PARKED_MIX, tRnd); if (m === 'ape' || m === 'bici' || (st.kind === 1 && (m === 'van' || m === 'suv'))) m = 'hatch';
    if (add(m, st.x, st.z, st.h + (tRnd() - 0.5) * 0.04, 'via')) inStreet++;
  }
  let kerb = 0;
  for (const ri of T.d.rp || []) {
    const r = D.roads[ri]; if (r.c !== 2 || r.d || r.b || r.pk) continue; // streets with mapped parking are done above
    for (let k = 1; k < r.g.length && kerb < 8; k++) {
      const a = N[r.g[k - 1]], b = N[r.g[k]], L = hyp(b[0] - a[0], b[1] - a[1]); if (L < 22 || tRnd() > 0.22) continue;
      if (tileOf((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) !== T.t) continue;
      const ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, rx = -uz, rz = ux, s = 6 + tRnd() * (L - 12), side = tRnd() < 0.5 ? 1 : -1;
      const cx0 = a[0] + ux * s, cz0 = a[1] + uz * s, free = clearance(cx0, cz0, rx * side, rz * side, 12), half = Math.min(r.w / 2, free - 0.3);
      /* half on the sidewalk; where a fence or a wall stands on the edge of the carriageway (src/barriere.py), on the road along it, 0.25 m off */
      const fence = rayWalls(cx0, cz0, cx0 + rx * side * 12, cz0 + rz * side * 12, false) * 12, lane = Math.max(r.lane, ...(side > 0 ? (r.lf ? [r.lf[k - 1] / 100, r.lf[k] / 100] : []) : (r.lb ? [r.lb[k - 1] / 100, r.lb[k] / 100] : [])));
      const m = pickModel(PARKED_MIX, tRnd); if (m === 'van' || m === 'suv') continue;
      const off = Math.min(half + 0.35, fence - MODELS[m].W / 2 - 0.27);
      if (free < half + 1.35 || off < lane + 1.9) continue;
      const x = cx0 + rx * off * side, z = cz0 + rz * off * side;
      if (!inLim(x, z, 10) || inBuilding(x, z, 2.6) || nearJunction(x, z, 12) || VEH.some(v => hyp(v.x - x, v.z - z) < 6)) continue;
      if (add(m, x, z, Math.atan2(ux, uz) + (side < 0 ? Math.PI : 0), 'bordo')) kerb++;
    }
  }
  parkCaserme(T);
}
function parkTick() {
  for (const T of VIVI) {
    if (T.ready && T.pkChk !== T.group) { T.pkChk = T.group; parkCheck(T); } /* built again: its posts and benches are back in WALLS */
    if (!T.parked && T.ready && T.dist < 260) parkTile(T);
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
// the bake draws it from the whole world (mappa/grande.png); the game takes the picture the first time the map opens
const BIG_S = 0.32, BOX = Math.ceil(META.hw * BIG_S), BOZ = Math.ceil(META.hh * BIG_S); let BIGC = null;
function bigLoad() { if (BIGC) return; BIGC = new Image(); BIGC.onload = () => { if (bigOpen) drawBig(); }; BIGC.src = 'mappa/grande.webp?v=' + D.ver; }
function bigCanvas() {
  const C = document.createElement('canvas'); C.width = BOX * 2; C.height = BOZ * 2;
  const g = C.getContext('2d'); g.fillStyle = '#20232b'; g.fillRect(0, 0, C.width, C.height); g.translate(BOX, BOZ); g.scale(BIG_S, BIG_S);
  for (const T of TILES) for (const a of T.d.a || []) if (a.t <= 3 || a.t >= 11) { const o = dec(a.p); g.beginPath(); o.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.fillStyle = a.t === 11 ? '#2b4428' : a.t === 13 ? '#3a3f2c' : '#2f4a2c'; g.fill(); }
  g.fillStyle = '#3a3e49'; for (const b of BUILDINGS) { g.beginPath(); b.pts.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.fill(); }
  g.lineCap = 'round'; g.lineJoin = 'round';
  for (const pass of [0, 1, 2]) for (const r of D.roads) {
    if (pass === 0 && r.c === 6) { g.strokeStyle = '#4b4f58'; g.lineWidth = 2; } else if (pass === 1 && r.c >= 2 && r.c <= 5) { g.strokeStyle = r.c === 5 ? '#9b8676' : '#a7a49c'; g.lineWidth = r.w + 2; } else if (pass === 2 && r.c <= 1) { g.strokeStyle = r.x ? '#f39a1e' : '#d8cfbd'; g.lineWidth = r.w + 4; } else continue;
    g.beginPath(); r.g.forEach((i, k) => k ? g.lineTo(N[i][0], N[i][1]) : g.moveTo(N[i][0], N[i][1])); g.stroke();
  }
  g.setLineDash([12, 10]); g.strokeStyle = '#c96b4a'; g.lineWidth = 4; for (const r of RAILPTS) { g.beginPath(); r.forEach((p, i) => i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1])); g.stroke(); } g.setLineDash([]);
  return C;
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
    mg.strokeStyle = r.c === 6 ? '#4b4f58' : r.x ? '#f39a1e' : r.c <= 1 ? '#d8cfbd' : r.c === 5 ? '#9b8676' : '#a7a49c'; mg.lineWidth = r.c === 6 ? 1.6 : r.w + (r.c <= 1 ? 2 : 0.5);
    mg.beginPath(); mg.moveTo(sg.a[0], sg.a[1]); mg.lineTo(sg.b[0], sg.b[1]); mg.stroke();
  }
  gpsDraw(mg, 6 / zoom); /* the GPS route: above the roads, under the icons */
  mg.lineWidth = 4 / zoom; for (const L of CONF_LINEE) { mg.strokeStyle = L.css; for (const c of L.anelli) { mg.beginPath(); c.forEach((q, i) => i ? mg.lineTo(q[0], q[1]) : mg.moveTo(q[0], q[1])); mg.closePath(); mg.stroke(); } } /* the two barriers (confine3.js) */
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

# ---- HUD place name, respawn spots, start
rep("$('street').textContent = (st || 'Meda') + (TER ? ` · ${Math.round(TER.base + groundH(P.x, P.z))} m` : '');",
    "$('street').textContent = (st ? st + ' · ' : '') + (placeAt(P.x, P.z) || 'Brianza') + ` · ${Math.round(TER.base + (P.mode === 'car' ? P.car.y : P.y))} m`;")
rep("const spot = D.pois.find(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')) || { x: 0, z: 0 };",
    "const cands = D.pois.filter(p => p.k === (kind === 'busted' ? 'polizia' : 'stazione')), spot = cands.sort((a, b) => hyp(a.x - P.x, a.z - P.z) - hyp(b.x - P.x, b.z - P.z))[0] || STATION;")
rep("banner(kind === 'busted' ? 'Polizia Locale' : 'Stazione di Meda', 'DI NUOVO IN STRADA');", "banner(spot.n || 'Brianza', 'DI NUOVO IN STRADA');")
rep("const STATION = D.pois.find(p => p.k === 'stazione') || { x: 0, z: 0 };", "const STATION = D.pois.find(p => p.n === META.partenza.stazione) || D.pois.find(p => p.k === 'stazione') || { x: 0, z: 0, n: 'Brianza' };\nconst START = (() => { try { const q = new URLSearchParams(location.search), x = parseFloat(q.get('x')), z = parseFloat(q.get('z')); if (isFinite(x) && isFinite(z) && x > ZONA[0] && x < ZONA[2] && z > ZONA[1] && z < ZONA[3]) return { x, z, n: 'Punto', piedi: q.has('piedi'), mezzo: q.get('mezzo') }; } catch (e) { } return null; })() || STATION; /* ?x=..&z=.. in the address starts the game there (links in the reports and for the collaudo) */")
rep("""function setupWorld(saved) {
  spawnParked();""", """function setupWorld(saved) {
  tileTick(STATION.x, STATION.z, 0, 420);
  for (const T of TILES) T.dist = hyp(T.cx - STATION.x, T.cz - STATION.z);
  parkTick();""")
rep("P.h = h; P.y = surfY(P.x, P.z); for (const v of VEH) { v.y = surfY(v.x, v.z); v.sync(); }", "P.h = h; P.y = H.surface(P.x, P.z); mine.y = H.surface(mine.x, mine.z); mine.sync();")
rep("""  updVisuals(running && !paused ? dt : 0);""", """  { const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z; tileTick(px, pz, running ? 7 : 12); if (running && ((now * 2) | 0) !== frame.pk) { frame.pk = (now * 2) | 0; parkTick(); } }
  updVisuals(running && !paused ? dt : 0);""")
rep("function boot(saved) { setupWorld(saved || {}); requestAnimationFrame(frame); }", "function boot(saved) { setupWorld(saved || {}); vetrinaShader(); requestAnimationFrame(frame); goBtn.disabled = false; goBtn.textContent = 'ACCENDI IL MOTORE'; }")
rep("window.__G = { D, LX, MODELS, Vehicle,", "window.__G = { VIVI, PZ, tileLay, mondoPronto, FUEL, FUEL_ROOFS: () => FUEL_ROOFS, WALLS, MAT, LMAT, H, tileTick, buildTileGen, ngList, ngWall, NG_SKIP: () => NG_SKIP, BLD, EDIF, BUILDINGS, NG_CLASSES, updNegozi, updCamera, interpSnap, interpBegin, interpEnd, D, LX, MODELS, Vehicle, TILES, TRAINS, DECK_BAR: { get rails() { return H.DECKS.flatMap(d => d.bar ? d.bar.rails : []); }, get pillars() { return H.DECKS.flatMap(d => d.bar ? d.bar.pillars : []); } }, ROAD_BAR, GUARD, roadBarriers, collideStatic, PROPS, BARG, BAR_FLY, PARK_PROPS, barHits, BUSH_G, onAsph, nearAsph, onAnyRoad, tileOf, SEGN, SIGNALS,")
rep("enterExit, startGame, TR };", "enterExit, startGame, pollPad, GP, getCam: () => camMode, getVA: () => camVA, setCam: v => { camMode = v; }, aiTraffic, extendRoute, edgePts, get GATES() { return TILES.flatMap(T => T.gates || []); }, WALLS, N, DRIVE, TRAF, WALK, DRIVE_NODES, TRAF_NODES, WALK_NODES, nearestNode, nodeInRing, cops, crime, spawnPolice, spawnPed, pedPick, pedPickZona, inZona, pedNext, pedLine, pedCross, pedZones, zebraNear, spawnTraffic, policeField, rayWalls, inBuilding, placeAt, streetAt, BLD, pedTarget, STATIC, RADIO, CASERME, RW, ORDER, STATIONS, HLS, radioStartFor, stationFor, radioNext, radioWheelStick, radioWheelCancel, RC, curStation, radioCtx, getRadio: () => ({ on: radioOn, st: radioSt, err: radioErr }), setRadioOn: v => { radioOn = v; } };")
rep("const mine = new Vehicle('panda', '#c8332b', p0[0] + Math.sin(h) * 4, p0[1] + Math.cos(h) * 4, h);", "const mine = new Vehicle('panda', '#c8332b', p0[0] + Math.sin(h) * 4, p0[1] + Math.cos(h) * 4, h); mine.moved = true;")
# a moved parked car is no longer recycled
rep("        a.impact(-rv * 0.8); b.impact(-rv * 0.8);", "        a.impact(-rv * 0.8); b.impact(-rv * 0.8); a.moved = b.moved = true;")
rep("best.driver = 'player'; best.sleep = false; P.car = best;", "best.driver = 'player'; best.sleep = false; best.moved = true; P.car = best;")
# texts
rep("Le vie vere di Meda, dalla stazione a Piazza della Chiesa. Ruba un'auto, fai le consegne per i locali del centro e semina la Polizia Locale.",
    "Meda, Seveso, Barlassina, Baruccana e Cabiate con le loro strade vere, i dislivelli veri e la Milano-Meda sopraelevata. Ruba un'auto, fai le consegne per i locali e semina la Polizia Locale.")
rep("banner('Stazione di Meda', 'MEDA · BRIANZA');", "banner('Stazione di Meda', 'BRIANZA');")
# ---- driving model: one, the arcade one (real top speeds); the realistic model and its G key are gone (Carlo, 25/10)
rep("const S = this.spec, dead = this.health <= 0, thr = dead ? 0 : i.thr, bst = this.boost && thr > 0, acc = S.acc * (bst ? 1.7 : 1), top = this.maxV * (bst ? 1.15 : 1);",
    "const S = this.spec, dead = this.health <= 0, thr = dead ? 0 : i.thr, bst = this.boost && thr > 0, acc = Math.min(12, S.acc * 2.1) * (this.accMul || 1) * (bst ? 2.4 : 1), top = this.maxV * (bst ? 1.3 : 1);")
rep("if (i.brk > 0) { if (v > 0.5) v -= 11 * dt * i.brk;", "if (i.brk > 0) { if (v > 0.5) v -= 21 * dt * i.brk;")
rep("const drag = (0.15 + (thr ? 0 : 0.45 + 0.0004 * v * v)) * dt + (i.hand ? 7 * dt : 0);", "const drag = (0.15 + (thr ? 0 : 1.6 + 0.0004 * v * v)) * dt + (i.hand ? 7 * dt : 0);")
rep("const yawMax = (i.hand ? 22 : 13 + S.grip * 0.4) / Math.max(4, Math.abs(v));", "const yawMax = (i.hand ? 26 : 30) / Math.max(4, Math.abs(v));")
rep("v += 9.81 * Math.sin(this.slope) * dt; // gravity on hills", "v += 9.81 * Math.sin(this.slope) * 0.6 * dt; // gravity on hills")
rep("if (ty > this.y + 0.08 && this === P.car && this.speed > 6) shake = Math.max(shake, 0.12);", "if (ty - this.y > 0.09 && ty - this.y < 0.2 && this === P.car && this.speed > 6) shake = Math.max(shake, 0.12);")
rep("      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>", "      <div><kbd>PAD</kbd> controller DualSense o Xbox · START o ✕/A per iniziare</div>\n      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>")
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
rep("    v.step(dt); v.collide();", "    v.step(dt); gateHits(v); fuelHits(v); propHits(v); barHits(v); v.collide();")
# no spawning on top of the player; tougher cars
rep("  const e = pick(TRAF[a]); if (!e) return null; const [p0, p1] = edgePts(a, e.to, e.off, e);", "  if (a == null || VEH.some(o => hyp(o.x - N[a][0], o.z - N[a][1]) < 9)) return null;\n  const e = pick(outward(a, TRAF[a])); if (!e) return null; const [p0, p1] = edgePts(a, e.to, e.off, e);")
rep("    if (v > 4) { this.health = Math.max(0, this.health - (v - 4) * 2.2); }", "    if (v > 7) { this.health = Math.max(0, this.health - (v - 7) * 1.1); }")
rep("      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;", "      if (!inPoly(x, z, o) || inBuilding(x, z, 2.6) || hyp(P.x - x, P.z - z) < 45 || VEH.some(v => hyp(v.x - x, v.z - z) < 5)) continue;")
rep("      if (!inLim(x, z, 10) || inBuilding(x, z, 2.6) || nearJunction(x, z, 12) || VEH.some(v => hyp(v.x - x, v.z - z) < 6)) continue;", "      if (!inLim(x, z, 10) || inBuilding(x, z, 2.6) || nearJunction(x, z, 12) || hyp(P.x - x, P.z - z) < 45 || VEH.some(v => hyp(v.x - x, v.z - z) < 6)) continue;")
# ---- gamepad (Xbox / PlayStation layout): RT gas, LT brake, left stick steer, RB handbrake, A turbo/run, Y get in/out, B camera, X horn, View map, Start pause
rep("// ---------------------------------------------------------------- player actions", """const GP = { steer: 0, thr: 0, brk: 0, hand: 0, turbo: 0, horn: 0, fwd: 0, lookx: 0, looky: 0, back: 0, sprint: 0, prev: [], blk: [], hold: [], t0: 0, mode: '', l3: 0, l3d: false };
/* which layout applies: on foot, car (and anything else with four wheels), motorbike or scooter, bicycle */
const padKind = () => P.mode !== 'car' || !P.car ? 'foot' : P.car.spec.pedal ? 'bici' : P.car.spec.two ? 'moto' : 'car';
const padNames = () => GP.ps ? { x: '✕', o: '○', s: '□', t: '△', l1: 'L1', r1: 'R1', l2: 'L2', r2: 'R2', l3: 'L3', r3: 'R3', cr: 'Create', op: 'Options', tp: 'Touchpad' }
  : { x: 'A', o: 'B', s: 'X', t: 'Y', l1: 'LB', r1: 'RB', l2: 'LT', r2: 'RT', l3: 'LS', r3: 'RS', cr: 'View', op: 'Menu', tp: 'Guide' };
function bigHint() {
  const n = padNames(), el = document.getElementById('bighint'); if (!el) return;
  el.textContent = (GP.seen ? `${n.x} segnaposto (di nuovo: lo toglie) · ${n.r2} ${n.l2} zoom · levetta sinistra sposta · ${n.o} o ${n.tp} chiude
` : '') + 'Mouse: rotella o due dita zoom · trascina sposta · clic segnaposto · M o Esc chiude';
}
function padHelp(kind) {
  const n = padNames(), com = `${n.r3} ${kind === 'foot' ? 'ricentra la camera' : 'guarda dietro'} · ${n.cr} visuale · ${n.tp} mappa · ${n.op} pausa${DEBUG ? ' · croce su segnala punto' : ''}`;
  if (kind === 'foot') return `levetta sinistra cammina (piena: corsetta) · ${n.x} premuto ripetutamente: scatto · ${n.t} sali sul mezzo · ${com}`;
  if (kind === 'bici') return `${n.r2} pedala · ${n.x} ripetuto: scatto · ${n.l2} freno · ${n.r1} freno a mano · levetta sinistra sposta il peso · ${n.t} scendi · ${com}`;
  return `${n.r2} gas · ${n.l2} freno e retro · ${n.r1} o ${n.x} freno a mano · ${n.o} turbo · ${n.l3} clacson · ${n.t} sali/scendi · croce sinistra radio${kind === 'moto' ? ' · levetta sinistra sposta il peso' : ''} · ${com}`;
}
/* tap or hold on one button: tap fires on release, hold fires once after 0.45 s */
function padTap(i, down, dt, onTap, onHold) {
  const h = GP.hold[i] || (GP.hold[i] = { t: 0, on: false, done: false });
  if (down) { if (h.block) return; if (!h.on) { h.on = true; h.t = 0; h.done = false; } h.t += dt; if (!h.done && h.t >= 0.45) { h.done = true; if (onHold) onHold(); } }
  else { h.block = false; if (h.on) { h.on = false; if (!h.done && onTap) onTap(); } }
}
function pollPad() {
  let pads = []; try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { return; }
  const g = [...pads].find(p => p && p.connected); if (!g) { GP.steer = GP.thr = GP.brk = GP.hand = GP.turbo = GP.horn = GP.fwd = GP.lookx = GP.looky = GP.back = 0; return; }
  const tn = performance.now(), dt = Math.min(0.1, (tn - (GP.t0 || tn)) / 1000); GP.t0 = tn;
  const dz = v => Math.abs(v) < 0.15 ? 0 : v, b0 = i => g.buttons[i] ? g.buttons[i].value || (g.buttons[i].pressed ? 1 : 0) : 0, b = i => { if (!GP.blk[i]) return b0(i); if (b0(i) > 0.5) return 0; GP.blk[i] = false; return b0(i); }, down = i => b(i) > 0.5;
  /* opening or closing the map: what is held down at that moment counts for nothing until it is let go (R2 held while closing must not be gas) */
  const blkAll = () => { for (let i = 0; i < 18; i++) if (b0(i) > 0.5) GP.blk[i] = true; };
  const edge = i => { const now = down(i), was = GP.prev[i]; GP.prev[i] = now; return now && !was; };
  const E = []; for (let i = 0; i < 18; i++) E[i] = edge(i);
  const first = !GP.seen; if (first) { GP.seen = true; GP.ps = /dualsense|dualshock|wireless controller|054c|playstation/i.test(g.id); }
  const kind = padKind(), veh = kind !== 'foot', tpad = GP.ps ? 17 : 16;
  if (first || kind !== GP.mode) {
    GP.mode = kind; const txt = padHelp(kind);
    if (first) toast((GP.ps ? 'DualSense' : 'Controller') + ' collegato: ' + txt);
    const pl = document.getElementById('padline'); if (pl) { pl.hidden = false; pl.textContent = 'Controller: ' + txt; }
  }
  const none = () => { GP.steer = GP.thr = GP.brk = GP.hand = GP.turbo = GP.horn = GP.fwd = GP.lookx = GP.looky = GP.back = 0; };
  /* title screen: Options or cross/A start the game like Enter */
  if (!running) { none(); if ((E[9] || E[0]) && !goBtn.disabled) startGame(); return; }
  if (E[9] && !bigOpen) togglePause(); /* Options does nothing on the big map */
  if (paused && !bigOpen) { radioWheelCancel(); none(); return; }
  /* big map: touchpad opens it, touchpad or circle closes it; the game is paused and nothing reaches the driving. Left stick = cursor (the map scrolls at the edge), R2 zoom in, L2 zoom out, cross = waypoint (a second one on the same spot takes it away); right stick and Options: nothing */
  if (E[tpad] || (bigOpen && E[1])) { toggleBig(); blkAll(); radioWheelCancel(); none(); return; }
  if (bigOpen) { radioWheelCancel(); none(); bigPad(dz(g.axes[0] || 0), dz(g.axes[1] || 0), b(7), b(6), dt); if (E[0]) bigMark(); return; }
  const ni = s => toast(s + ' non implementato');
  GP.steer = dz(g.axes[0] || 0); GP.lookx = dz(g.axes[2] || 0); GP.looky = dz(g.axes[3] || 0); GP.back = b(11); GP.fwd = -dz(g.axes[1] || 0);
  GP.thr = veh ? b(7) : 0; GP.brk = veh ? b(6) : 0;
  GP.hand = kind === 'bici' ? b(5) : veh ? Math.max(b(0), b(5)) : 0;
  GP.turbo = kind === 'car' || kind === 'moto' ? b(1) : 0;
  GP.horn = kind === 'car' || kind === 'moto' ? b(10) : 0;
  /* sprint: each cross/A press adds a push that fades away, so the faster it is mashed the closer to the top it gets; 4.8 m/s over the jog = 9 m/s */
  GP.sprint *= Math.exp(-1.2 * dt); if (E[0] && (!veh || kind === 'bici')) GP.sprint = Math.min(4.8, GP.sprint + 1.5);
  if (E[8] && P.mode === 'car') camMode = camMode === 0 ? 2 : 0; /* third person <-> first person; the top view is gone from the pad */
  if (E[12]) reportSpot();
  if (E[13]) ni('Zoom della minimappa');
  /* radio wheel: the right stick picks the slice, the camera does not move, the car keeps being driven; letting go of the d-pad confirms */
  if (RW.open && !down(14)) radioWheelRelease();
  if (RW.open) radioWheelStick(g.axes[2] || 0, g.axes[3] || 0);
  if (RW.open || RW.lock) { if (!RW.open && !down(14) && Math.hypot(g.axes[2] || 0, g.axes[3] || 0) < 0.15) RW.lock = false; else GP.lookx = GP.looky = 0; }
  /* d-pad left: radio. d-pad right: lights (vehicles), use item (on foot) */
  padTap(14, down(14), dt, radioNext, radioWheelOpen);
  if (veh) padTap(15, down(15), dt, () => ni(kind === 'bici' ? 'Fanale' : 'Fari'), () => ni(kind === 'bici' ? 'Fanale' : 'Abbaglianti')); else if (E[15]) ni('Usa oggetto');
  if (veh) {
    if (E[3]) { K.use = true; (GP.hold[3] || (GP.hold[3] = { t: 0, on: false, done: false })).block = true; } /* getting out ends this press: on foot it must not count as a tap that gets in again */
    if (E[2]) ni('Cambio arma');
    if (E[4]) ni('Sparare');
    if (kind === 'bici') { if (E[1]) ni('Bunny hop'); if (E[10]) ni('Campanello'); }
    else if (down(10)) {
      /* police car: horn up to 0.8 s, past that the horn stops and the siren flips (v.siren, no sound yet); other cars and bikes: horn while held */
      GP.l3 += dt;
      if (kind === 'car' && P.car.kind === 'police') { if (GP.l3 >= 0.8) { GP.horn = 0; if (!GP.l3d) { GP.l3d = true; P.car.siren = !P.car.siren; toast('Sirena non implementata'); } } }
    } else { GP.l3 = 0; GP.l3d = false; }
  } else {
    padTap(3, down(3), dt, () => { K.use = true; }, () => ni('Scasso'));
    if (E[2]) P.jumpReq = SALTO.buffer; /* square: jump, or over and up what is ahead (salto3.js) */
    if (E[1]) ni('Pugno');
    if (E[4]) ni('Ruota delle armi');
    if (E[5]) ni('Riparo');
    if (E[6]) ni('Mira');
    if (E[7]) ni('Sparare');
    if (E[10]) ni('Accovacciarsi');
  }
}
addEventListener('gamepadconnected', () => { GP.seen = false; });

// ---------------------------------------------------------------- player actions""")
rep("  const steerIn = (K.left ? 1 : 0) - (K.right ? 1 : 0);", "  const steerIn = clamp((K.left ? 1 : 0) - (K.right ? 1 : 0) - GP.steer, -1, 1);")
rep("    const v = P.car; v.inp.thr = K.up ? 1 : 0; v.inp.brk = K.down ? 1 : 0; v.inp.steer = steerIn; v.inp.hand = K.hand ? 1 : 0; v.sleep = false;",
    "    const v = P.car; v.inp.thr = Math.max(K.up ? 1 : 0, GP.thr); v.inp.brk = Math.max(K.down ? 1 : 0, GP.brk); v.inp.steer = steerIn; v.inp.hand = K.hand || GP.hand > 0.5 ? 1 : 0; v.sleep = false; if (v.spec.pedal) { const sk_ = GP.sprint / 4.8; v.maxV = v.spec.maxV + (BICI_SPRINT_MAX - v.spec.maxV) * sk_; v.accMul = 1 + 0.6 * sk_; }")
rep("    const want = K.turbo && K.up && v.health > 0 && P.nitro > 1;", "    const want = (K.turbo || GP.turbo > 0.5) && v.inp.thr > 0.3 && v.health > 0 && P.nitro > 1 && !v.spec.pedal;")
rep("(S.two ? 4.5 : 10) * dt)", "(S.two ? (TWO_STEER[this.kind] || 4.5) : 10) * dt)")
rep("this.whv += (28 * (tgt - this.wh) - 7 * this.whv) * dt;", "this.whv += (28 * (tgt - this.wh) - 7 * this.whv + (this.wh > S.whMax * WHEEL.bal ? WHEEL.kov * (this.wh - S.whMax * WHEEL.bal) : 0) - (this.wh < -S.whMax * STOP.bal ? STOP.kov * Math.min(5, v / STOP.v0) * (-this.wh - S.whMax * STOP.bal) : 0)) * dt;")
rep("    if (this.wh > S.whMax * 0.9 && lb > 0.9 && thr > 0) this.whHold += dt; else this.whHold = Math.max(0, this.whHold - dt * 2);\n", "    this.whHold = 0;\n")
rep("    else if (i.brk > 0 && lb < -0.1 && v > 4) tgt = -0.55 * S.whMax * -lb * i.brk;", "    else if (i.brk > 0 && lb < -0.1 && v > 4) tgt = -STOP.max * S.whMax * -lb * i.brk * Math.min(5, v / STOP.v0);")
rep("(this.whHold > 2.2 || this.wh < -0.72)", "(this.wh > S.whMax * WHEEL.fall || this.wh < -S.whMax * STOP.fall)")
rep("    if (S.two) this.roll = lerp(this.roll, clamp(-Math.atan(yaw * v / 9.81), -0.85, 0.85), 0.14); // lean into the bend",
    "    if (S.two) { const ln_ = LEAN[this.kind] || LEAN.moto, tg_ = clamp(-Math.atan(yaw * v / 9.81), -0.85, 0.85) * ln_.k, ms_ = 0.85 * ln_.k / ln_.t * dt; this.roll = lerp(this.roll, this.roll + clamp(tg_ - this.roll, -ms_, ms_), 0.5); } /* lean into the bend, rate-limited */")
rep("const sp = (K.up ? 1 : K.down ? -0.5 : 0) * (K.hand || K.turbo ? 7.2 : 4.2);", "let sp = (K.up ? 1 : K.down ? -0.5 : 0) * (K.hand || K.turbo ? 7.2 : 4.2);\n"
    "      /* pad on foot (Carlo, 31/10): the left stick is a direction in the world as the camera sees it; the walker turns towards it with a soft curve and walks the way he faces, never backwards. Half stick = a walk of about 2 m/s, full = the jog of 4.2, cross/A mashed adds up to 4.8 m/s. The keyboard keeps its own way (turn on the spot, up/down) */\n"
    "      if (!(K.up || K.down) && Math.hypot(GP.steer, GP.fwd) > 0.15) {\n"
    "        const m_ = Math.min(1, Math.hypot(GP.steer, GP.fwd)), va_ = camVA, dx_ = GP.fwd * Math.sin(va_) - GP.steer * Math.cos(va_), dz_ = GP.fwd * Math.cos(va_) + GP.steer * Math.sin(va_);\n        /* the direction is fixed in the world while the stick holds still: the camera swinging round behind him must not drag it along (no endless circling); a new stick position or the right stick sets it again */\n        if (!padLat || Math.hypot(GP.steer - pSx, GP.fwd - pSy) > 0.04 || Math.abs(GP.lookx || 0) > 0.12) { padTgt = Math.atan2(dx_, dz_); pSx = GP.steer; pSy = GP.fwd; padLat = true; }\n"
    "        const dh_ = wrapA(padTgt - P.h), tn_ = clamp(dh_ * (1 - Math.exp(-PAD_TURN * dt)), -PAD_MAXTURN * dt, PAD_MAXTURN * dt);\n"
    "        P.h = wrapA(P.h + tn_); sp = clamp(m_ / 0.9, 0, 1) * (4.2 + GP.sprint) * (0.45 + 0.55 * Math.max(0, Math.cos(dh_)));\n"
    "      }")
rep("((K.horn && P.mode === 'car') ? 0.12", "(((K.horn || GP.horn > 0.5) && P.mode === 'car') ? 0.12")
rep("  if (running && !paused && !TELE) { acc += dt;", "  pollPad();\n  if (running && !paused && !TELE) { acc += dt;")
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
  const [sx, sz] = LL(META.partenza.lat, META.partenza.lon), FO = (D.fountains || []).map(f => [f[0] / 10, f[1] / 10]).sort((a, b) => hyp(a[0] - sx, a[1] - sz) - hyp(b[0] - sx, b[1] - sz))[0] || [STATION.x, STATION.z];
  const h = Math.atan2(FO[0] - sx, FO[1] - sz);
  const mine = new Vehicle('sport', '#d0141a', sx, sz, h); mine.moved = true;""")
rep("  tileTick(STATION.x, STATION.z, 0, 420);\n  for (const T of TILES) T.dist = hyp(T.cx - STATION.x, T.cz - STATION.z);", "  { const [p0x, p0z] = partenza(); tileTick(p0x, p0z, 0, 260); for (const T of TILES) T.dist = hyp(T.cx - p0x, T.cz - p0z); } /* avvio veloce: solo i tile attorno alla partenza prima del pulsante, gli altri entro 420 m si costruiscono sotto la schermata iniziale (12 ms a fotogramma) */")
# title: everything yellow, only G T A in red
rep("#start h1 em { display: block; font-style: normal; font-size: .34em; letter-spacing: .5em; color: var(--ink);", "#start h1 em { display: block; font-style: normal; font-size: .34em; letter-spacing: .5em; color: var(--ocra);")
rep("#start h1 { font-family: var(--display);", "#start h1 { color: var(--ocra) !important; font-family: var(--display);")
# ---- day & night, car damage
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'extras.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("updSignals(); updGates(dt); updFountains();", "updSignals(); updGates(dt); updFountains(); updDayNight(dt); updWrecks(dt); updFuel(dt); updProps(dt); updOggetti(dt);")
rep("  updCamera(running ? dt : dt * 0.4);", "  updCamera(running ? dt : dt * 0.4); updGlow();")
rep("    add(boxG(S.W, S.bh, S.L), paint, 0, by, 0);", "    var bm = add(new THREE.BoxGeometry(S.W, S.bh, S.L, 3, 2, 6), paint, 0, by, 0);")
rep("  scene.add(g);\n  return { g, body, wheels, rider, crew };", "  if (!S.ape) { const hp = new THREE.Mesh(makeCar.hp || (makeCar.hp = new THREE.PlaneGeometry(3.4, 9).rotateX(-Math.PI / 2)), HEADPOOL_MAT); hp.position.set(0, 0.14, hl + 4.4); if (S.two) hp.scale.set(0.6, 1, 0.75); hp.renderOrder = 12; g.add(hp); body.userData.hp = hp; }\n  scene.add(g);\n  return { g, body, wheels, rider, crew, bm: typeof bm !== 'undefined' ? bm : null, paint };")
rep("""  impact(v) {
    if (v > 7) { this.health = Math.max(0, this.health - (v - 7) * 1.1); }""", """  impact(v, nx, nz) {
    if (v > 7) { this.health = Math.max(0, this.health - (v - 7) * 1.1); }
    if (v > 5 && nx !== undefined) { dentCar(this, Math.min(0.32, (v - 5) * 0.03), nx, nz); scorch(this); }""")
rep("this.vx *= 0.92; this.vz *= 0.92; this.impact(-vn); }", "this.vx *= 0.92; this.vz *= 0.92; this.impact(-vn, hitN[0], hitN[1]); }")
rep("a.impact(-rv * 0.8); b.impact(-rv * 0.8);", "a.impact(-rv * 0.8, -nx, -nz); b.impact(-rv * 0.8, nx, nz);")
rep("  remove() { scene.remove(this.m.g);", "  remove() { scene.remove(this.m.g); if (this.m.bm) this.m.bm.geometry.dispose();")
rep('<div id="nitro"', '<div id="clock">18:00</div><div id="nitro"')
rep("#health i {", "#clock { font-family: var(--display); font-size: 20px; letter-spacing: .06em; color: var(--ink); opacity: .9; margin-top: 4px; text-shadow: 0 2px 0 rgba(0,0,0,.4); }\n#health i {")
rep("  if (e.code === 'KeyU') {", "  if (e.code === 'KeyN') skipTime(2);\n  if (e.code === 'KeyU') {")
rep("      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>", "      <div><kbd>H</kbd> clacson · <kbd>P</kbd> pausa</div>\n      <div><kbd>N</kbd> avanti di 2 ore</div>")
rep("<kbd>H</kbd> clacson · <kbd>U</kbd> audio</p>", "<kbd>H</kbd> clacson · <kbd>N</kbd> +2 ore · <kbd>U</kbd> audio</p>")
rep("banner('Stazione di Meda', 'BRIANZA')", "banner(META.partenza.via, META.partenza.comune)")
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
  let foto = ''; try { renderer.render(scene, camera); foto = canvas.toDataURL('image/jpeg', 0.85); } catch (e) { } /* photo of what Carlo sees, taken before the toast and in the same task as the render (no preserveDrawingBuffer) */
  spotN++; try { sfxBlip(660, 990, 0.12); } catch (e) { }
  let saved = false; if (spotDb) { try { await spotDb.collection('segnalazioni').add(rec); saved = true; } catch (e) { saved = false; } }
  if (!saved && /^(localhost|127\\.0\\.0\\.1)$/.test(location.hostname)) { try { const r = await fetch('/segnala', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(foto ? Object.assign({}, rec, { fotob64: foto }) : rec) }); saved = r.ok; } catch (e) { } } /* local game: straight to the dev server, Claude reads it live */
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

rep("  updVisuals(running && !paused ? dt : 0);", "  updVisuals(running && !paused ? dt : 0); updRadio(dt);")
rep("      <div><kbd>N</kbd> avanti di 2 ore</div>", "      <div><kbd>N</kbd> avanti di 2 ore</div>\n      <div><kbd>R</kbd> radio on/off (Discoradio, Radio Maria in volante)</div>")
rep("<kbd>N</kbd> +2 ore · <kbd>B</kbd> segnala punto", "<kbd>N</kbd> +2 ore · <kbd>R</kbd> radio · <kbd>B</kbd> segnala punto")
rep("CC BY 4.0.</p>", "CC BY 4.0. Edifici aggiuntivi e altezze: <a href=\"https://overturemaps.org\" target=\"_blank\" rel=\"noopener\">Overture Maps Foundation</a>, ODbL. Copertura del suolo: © ESA WorldCover project 2021, contiene dati Copernicus Sentinel modificati (2021) elaborati dal consorzio ESA WorldCover, CC BY 4.0. Radio: <a href=\"https://www.discoradio.it\" target=\"_blank\" rel=\"noopener\">Discoradio</a>, stream ufficiale; <a href=\"https://www.radiomaria.it\" target=\"_blank\" rel=\"noopener\">Radio Maria</a>. Cartelli stradali: disegni del Codice della Strada italiano su <a href=\"https://commons.wikimedia.org/wiki/Category:Diagrams_of_road_signs_of_Italy\" target=\"_blank\" rel=\"noopener\">Wikimedia Commons</a> (pubblico dominio; stop, passaggio obbligatorio, rotatoria, divieto di fermata e direzione obbligatoria: Flanker, CC BY-SA 3.0). Posizione di cartelli, lampioni e pali: <a href=\"https://www.mapillary.com\" target=\"_blank\" rel=\"noopener\">Mapillary</a> e i suoi contributori, CC BY-SA 4.0. Foto delle superfici (asfalto, prato, pavimenti, ghiaia, terra, ciottoli, intonaco): <a href=\"https://polyhaven.com\" target=\"_blank\" rel=\"noopener\">Poly Haven</a> e <a href=\"https://ambientcg.com\" target=\"_blank\" rel=\"noopener\">ambientCG</a>, CC0.</p>")

# ---- debug mode (code DEBUG in the pause menu, or ?debug in the URL): bug reports, coordinates HUD, export
rep("async function reportSpot() {", """let DEBUG = false; try { const q = new URLSearchParams(location.search); if (q.has('debug')) localStorage.setItem('gtaDebug', q.get('debug') === '0' ? '0' : '1'); DEBUG = localStorage.getItem('gtaDebug') === '1'; } catch (e) { }
function spotsLocal() { try { return JSON.parse(localStorage.getItem('gtaSpots') || '[]'); } catch (e) { return []; } }
function setDebug(on) { DEBUG = on; try { localStorage.setItem('gtaDebug', on ? '1' : '0'); } catch (e) { } document.body.classList.toggle('debug', on); if (on) { W.offPrima = W.off; setPolizia(true, false); } else setPolizia(W.offPrima, false); updDbgMenu(); toast(on ? '🛠 Modalità debug attiva' : '🛠 Modalità debug spenta'); }
function setPolizia(off, msg) { W.off = off; if (off) { W.heat = 0; W.stars = 0; W.unseen = 0; W.bustT = 0; } if (msg) toast(off ? '🚓 Polizia spenta' : '🚓 Polizia accesa'); }
if (DEBUG) { W.offPrima = false; setPolizia(true, false); }
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
  if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { /* played locally: the branch and commit this page was assembled from, not what main serves */
    const txt = 'locale · ramo """ + BUILD_BR + """ · dopo """ + BUILD_SHA + """ · assemblato """ + BUILD_AT + """ · porta ' + location.port;
    for (const id of ['ver', 'pver']) { const v = document.getElementById(id); v.textContent = txt; v.hidden = false; } return;
  }
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
rep("P.x = N[n][0]; P.z = N[n][1];", "P.x = N[n][0]; P.z = N[n][1]; const cz = kind === 'busted' && CASERME.find(c => c.p === spot); if (cz) { [P.x, P.z] = cz.at(0, 2.4); P.h = Math.atan2(cz.nx, cz.nz); cz.force = true; }")

# ---- cheat codes in the pause menu: RESPAWN back to the start in Meda with the Ferari, FERARI spawns one
rep("""function setupWorld(saved) {""", """function startSpot() { // the parking on via Yuri Gagarin in Meda, facing the fountain
  const LL = (la, lo) => [(lo - META.lon0) * 111320 * Math.cos(META.lat0 * Math.PI / 180), -(la - META.lat0) * 110540];
  const [sx, sz] = LL(META.partenza.lat, META.partenza.lon), FO = (D.fountains || []).map(f => [f[0] / 10, f[1] / 10]).sort((a, b) => hyp(a[0] - sx, a[1] - sz) - hyp(b[0] - sx, b[1] - sz))[0] || [STATION.x, STATION.z];
  return [sx, sz, Math.atan2(FO[0] - sx, FO[1] - sz)];
}
function setupWorld(saved) {""")
rep("""  const LL = (la, lo) => [(lo - META.lon0) * 111320 * Math.cos(META.lat0 * Math.PI / 180), -(la - META.lat0) * 110540];
  const [sx, sz] = LL(META.partenza.lat, META.partenza.lon), FO = (D.fountains || []).map(f => [f[0] / 10, f[1] / 10]).sort((a, b) => hyp(a[0] - sx, a[1] - sz) - hyp(b[0] - sx, b[1] - sz))[0] || [STATION.x, STATION.z];
  const h = Math.atan2(FO[0] - sx, FO[1] - sz);
  const mine""", """  const [sx, sz, h] = startSpot();
  const mine""")
rep("""let last = performance.now(), acc = 0;
function frame(t) {""", """// ---------------------------------------------------------------- cheat codes, typed in the pause menu
function ferari(x, z, h) { // a red Ferari at (x,z), clearing whatever is parked on that spot
  for (const o of VEH.slice()) if (o !== P.car && hyp(o.x - x, o.z - z) < 5) o.remove();
  const v = new Vehicle('sport', '#d0141a', x, z, h); v.moved = true; v.y = H.surface(x, z); v.sync(); return v;
}
async function cheatRespawn() { // back to the start: via Yuri Gagarin, on foot next to the Ferari, no stars
  const [sx, sz, h] = startSpot(); await teletrasporto(sx, sz, 420);
  const mine = ferari(sx, sz, h);
  P.x = mine.x + Math.cos(h) * 2.4; P.z = mine.z - Math.sin(h) * 2.4; if (inBuilding(P.x, P.z, 0.5)) { P.x = mine.x - Math.cos(h) * 2.4; P.z = mine.z + Math.sin(h) * 2.4; }
  P.h = h; P.y = H.surface(P.x, P.z); P.hp = 100; P.knock = 0; P.vx = P.vz = P.vy = 0;
  W.heat = 0; W.stars = 0; W.busted = 0; W.bustT = 0;
  camInit = false; banner(META.partenza.via, META.partenza.comune);
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
rep("function updVisuals(dt) {", open(os.path.join(HERE, 'foto3.js'), encoding='utf-8').read() + "\n" + open(os.path.join(HERE, 'pattern3.js'), encoding='utf-8').read() + "\n" + open(os.path.join(HERE, 'riflessi3.js'), encoding='utf-8').read() + "\nfunction updVisuals(dt) {")
rep("// ---------------------------------------------------------------- renderer\n", open(os.path.join(HERE, 'foto3_colori.js'), encoding='utf-8').read() + "\n// ---------------------------------------------------------------- renderer\n")
rep('<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>', '<script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>\n<script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/objects/Sky.js"></script>')  # the sky of foto3.js
rep("updDayNight(dt);", "updDayNight(dt); updWeather(dt);")
rep("lat *= Math.exp(-(i.hand ? 1.1 : S.grip) * dt);", "lat *= Math.exp(-(i.hand ? 1.1 : S.grip * (1 - 0.3 * WX.wet)) * dt);")
rep("v -= 21 * dt * i.brk;", "v -= 21 * (1 - 0.25 * WX.wet) * dt * i.brk;") # wet brakes
rep("updGlow();", "updGlow(); updSkyFx(running && !paused ? dt : 0);")
rep("const CHEATS = { RESPAWN: cheatRespawn, FERARI: cheatFerari };", "const CHEATS = { RESPAWN: cheatRespawn, FERARI: cheatFerari, POLIZIA: () => setPolizia(!W.off, true), SOLE: () => setWeather('sereno', true), NUVOLE: () => setWeather('nuvoloso', true), PIOGGIA: () => setWeather('pioggia', true), TEMPORALE: () => setWeather('temporale', true), NEBBIA: () => setWeather('nebbia', true), HELI: cheatHeli };")

open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(s)
print('assembled', len(s) // 1024, 'KB')
left = [m.start() for m in re.finditer(r'surfY\(|TR\.circ|D\.(areas|rails|rivers|train|trees|surf|fences|crossings|buildings|hw|hh)\b|MAPC|MOX', s)]
print('leftover refs', [s[i:i + 40] for i in left])


# ---- draw each frame between the last two physics steps (interp3.js)
rep("while (acc >= 1 / 60 && n < 5) { step(1 / 60); acc -= 1 / 60; n++; } if (n === 5) acc = 0; }", "while (acc >= 1 / 60 && n < 5) { interpSnap(); step(1 / 60); acc -= 1 / 60; n++; } if (n === 5) acc = 0; }")
# camera (Carlo, 31/10): the right stick turns the view round the walker or the car, up and down too, and it stays where it is left; walking or driving on it eases back behind, slowly and after a pause
rep("let toastT = 0, bannerT = 0,", "let camW = 0, camSgn = 0, camR3 = false, camRecT = 0, padTgt = 0, padLat = false, pSx = 0, pSy = 0, fpDone = false, camA = 0, camFree = false, camIdle = 9, camVA = 0, camPitch = 0, camBack = false, toastT = 0, bannerT = 0,")
rep("function updCamera(dt) {", """/* free-camera tuning (change here): view turn speed rad/s at full stick, tilt speed, pause before easing back (s), easing back rate (1/s), walker turn rate towards the stick (1/s) and its cap (rad/s) */
/* on foot with the pad (Carlo, 31/10: "troppo dura"): the view follows his heading from 0.3 s after the last touch of the right stick, proportionally to the error and to how fast he runs, with its own angular speed eased in and out; R3 recentres behind him in about 0.25 s. CAMF.* on foot, CAMV.* in vehicles (pace set by the speed: k = CAMV.k * speed) */
const CAMF = { delay: 0.3, kBase: 3.5, kSpeed: 2.2, minW: 0.6, tau: 0.06, hyst: 2.7, hystOff: 2.0, recT: 0.35, recK: 18, posK: 14 };
/* two-wheeler look (Carlo, 31/10): the visible lean is a fraction of the physical one and builds up over about LEAN.<kind>.t seconds (moto 0.15, scooter 0.2, bici 0.35) from upright to full; the physics (steering, wheelie, stoppie) is untouched. BICI_SPRINT_MAX: top speed of the bike with the cross mashed (m/s, 55 km/h), base stays 10.8 */
const LEAN = { moto: { k: 0.667, t: 0.15 }, scooter: { k: 0.667, t: 0.2 }, bici: { k: 0.8, t: 0.35 } }, BICI_SPRINT_MAX = 15.3;
/* handlebar filter of the two-wheelers (1/s, game.src.html steer lerp): the car's rack is 10, the old two-wheeler value 4.5 felt like a lorry (Carlo, 31/10); moto and scooter answer faster, the bike keeps 4.5 */
/* wheelie (Carlo, 31/10): up to bal x whMax it is stable (the angle follows the stick and the gas); above it the bike tips over backwards unless the stick is eased, so the balance point is held with small corrections (kov = how fast it runs away, 1/s^2 per rad); past fall x whMax (moto 0.8 -> 1.04 rad) the rider falls back. Stoppie unchanged */
const WHEEL = { bal: 0.55, fall: 1.4, kov: 32 };
/* stoppie: the angle it is pulled to grows with speed and brake x stick (max x whMax x speed/v0 x brake x stick, so 0.55 whMax at 15 m/s as before and 2 whMax at 55 m/s); above bal x whMax the push over the bars grows with speed (kov x speed/v0: stable below about 28/kov x v0, i.e. 26 m/s); past fall x whMax the rider goes over the bars. The brake alone, without the stick forward, does no stoppie */
const STOP = { max: 0.55, v0: 15, bal: 0.4, kov: 16, fall: 0.9 };
const TWO_STEER = { moto: 24, scooter: 18 };
const CAMV = { delay: 0.25, k: 0.12, minW: 0.1, tau: 0.15 };
const CAM_WALL = 16, FP_ZOOM = 9, CAM_VEL = 3.4, CAM_VELP = 2.4, CAM_DELAY = 1.2, CAM_RE = 1.3, PAD_TURN = 14, PAD_MAXTURN = 14;
function camSteer(dt, inCar, hb, moving) { /* hb = the heading the camera sits behind by default; camA = where the view points in the world */
  const lx = Math.abs(GP.lookx || 0) > 0.12 ? -GP.lookx : 0, ly = Math.abs(GP.looky || 0) > 0.12 ? GP.looky : 0, fp = camMode === 2;
  const lim = fp ? 0.7 : 1.3, lo = fp ? -0.7 : -0.45;
  if (!inCar && (K.up || K.down || K.left || K.right)) camFree = false; /* the keyboard keeps the old camera: always straight behind */
  else if (lx || ly || (!inCar && Math.hypot(GP.steer, GP.fwd) > 0.15)) { if (!camFree) { camFree = true; camA = hb; camIdle = 0; } }
  if (!camFree) { camA = hb; camPitch *= Math.exp(-2.5 * dt); return; }
  if (lx || ly) camIdle = 0; else camIdle += dt;
  const sh = v => v * (0.5 + 0.5 * Math.abs(v));
  if (lx) camA = wrapA(camA + sh(lx) * CAM_VEL * dt);
  if (ly) camPitch = clamp(camPitch + sh(ly) * CAM_VELP * dt, lo, lim);
  camPitch = clamp(camPitch, lo, lim);
  if (!inCar) { /* on foot: recentre on R3, otherwise follow his heading, fast and proportional, never when he stands still */
    const r3 = GP.back > 0.5; if (r3 && !camR3) camRecT = CAMF.recT; camR3 = r3;
    if (camRecT > 0) { camRecT -= dt; const kk = 1 - Math.exp(-CAMF.recK * dt); camA = wrapA(camA + wrapA(hb - camA) * kk); camPitch *= 1 - kk; camW = 0; camIdle = 0.1; return; }
    if (moving && !fp && camIdle > CAMF.delay) { const sn = clamp(Math.abs(P.speedNow || 0) / 4.2, 0, 2.2), k = CAMF.kBase + CAMF.kSpeed * sn; camEase(dt, hb, k, CAMF.minW * (0.5 + sn), CAMF.tau); } else { camW *= Math.exp(-dt / CAMF.tau); camSgn = 0; }
    return;
  }
  /* vehicles: back behind at a pace set by the speed (still: stays; walking pace: slow; normal: decided; fast: a few moments), after a short wait; not while reversing */
  { const s_ = Math.abs(P.car.speed), rev = P.car.fwdSpeed < -2;
    if (camIdle > CAMV.delay && s_ > 0.5 && !rev) { const k = CAMV.k * s_; camEase(dt, hb, k, CAMV.minW * s_, CAMV.tau); camPitch *= Math.exp(-k * dt); if (Math.abs(wrapA(hb - camA)) < 0.02 && Math.abs(camPitch) < 0.02) { camFree = false; camA = hb; camPitch = 0; camW = 0; } }
    else { camW *= Math.exp(-dt / CAMV.tau); camSgn = 0; } }
}
function camEase(dt, hb, k, minW, tau) { /* angular speed proportional to the error with a floor, eased in and out; near 180 degrees the side is chosen once and kept */
  let d = wrapA(hb - camA);
  if (Math.abs(d) > CAMF.hyst) { if (!camSgn) camSgn = camW > 0.2 ? 1 : camW < -0.2 ? -1 : (d >= 0 ? 1 : -1); if (Math.sign(d) !== camSgn) d += camSgn * TAU; } else if (Math.abs(d) < CAMF.hystOff) camSgn = 0; else if (camSgn && Math.sign(d) !== camSgn) d += camSgn * TAU;
  let want = d * k; if (Math.abs(d) > 0.08) want = Math.sign(d) * Math.max(Math.abs(want), minW);
  camW += (want - camW) * (1 - Math.exp(-dt / tau)); let st = camW * dt; if (Math.abs(st) > Math.abs(d)) st = d; camA = wrapA(camA + st);
}
function updCamera(dt) {""")
# up and down: on foot the camera orbits on a sphere round his chest; in the car the chase height changes (R3 behind stays)
rep("want = new THREE.Vector3(cx, Math.max(gy, groundH(cx, cz)) + ht + lift, cz);",
    "want = new THREE.Vector3(cx, H.camCap(cx, cz, gy, Math.max(gy, H.camG(cx, cz, gy)) + Math.max(0.6, ht + lift + (inCar ? camPitch * 6 : 0))), cz);")
rep("const two = inCar && isTwo(P.car), dist = inCar ? (two ? 6 : 8.8) + sp * 0.06 : 5.2; let ht = inCar ? (two ? 2.7 : 3.6) + sp * 0.025 : 2.5;",
    "const two = inCar && isTwo(P.car); let dist = inCar ? (two ? 6 : 8.8) + sp * 0.06 : 5.2, ht = inCar ? (two ? 2.7 : 3.6) + sp * 0.025 : 2.5;\n"
    "    if (!inCar && camPitch) { const ph_ = Math.atan2(1, 5.2) + camPitch; dist = 5.3 * Math.cos(ph_); ht = 1.5 + 5.3 * Math.sin(ph_); } /* sphere of radius 5.3 round his chest: camPitch 0 is the old view */")
rep("    let hx = fx, hz = fz; if (inCar && P.car.fwdSpeed < -2) { hx = -fx; hz = -fz; }",
    "    let hx = fx, hz = fz; if (inCar && P.car.fwdSpeed < -2) { hx = -fx; hz = -fz; }\n"
    "    camSteer(dt, inCar, Math.atan2(hx, hz), inCar ? P.car.speed > 3 : Math.abs(P.speedNow || 0) > 0.5); hx = Math.sin(camA); hz = Math.cos(camA);\n"
    "    { const bk_ = GP.back > 0.5 && inCar; if (bk_) { hx = -hx; hz = -hz; } if (bk_ !== camBack) { camBack = bk_; camInit = false; } camVA = Math.atan2(hx, hz); } /* looking back and forward again is a cut, not a swing round */")
# while the stick turns it the camera goes where it is pushed at once
rep("  const k = 1 - Math.exp(-(camMode === 1 ? 5 : 7.5) * dt);",
    "  const k = camMode === 2 && fpDone ? 1 : 1 - Math.exp(-(camMode === 2 ? FP_ZOOM : camMode === 1 ? 5 : (Math.abs(GP.lookx || 0) > 0.12 || Math.abs(GP.looky || 0) > 0.12) ? 40 : !inCar && camFree ? CAMF.posK : 7.5) * dt);")
rep("camPos.lerp(want, k); camLook.lerp(look, 1 - Math.exp(-12 * dt));", "camPos.lerp(want, k); camLook.lerp(look, camMode === 2 && fpDone ? 1 : 1 - Math.exp(-12 * dt));\n  /* going into first person is a soft zoom in, as coming out is a zoom out; once the camera is at the eyes it is locked on with no delay */\n  if (camMode !== 2) fpDone = false; else if (!fpDone && camPos.distanceTo(want) < 0.12 && camLook.distanceTo(look) < 0.3) fpDone = true;")
rep("if (g < 1) { const dd = hyp(camPos.x - px, camPos.z - pz) || 1, kk = Math.max(0.05, g - 0.5 / dd); camPos.x = px + (camPos.x - px) * kk; camPos.z = pz + (camPos.z - pz) * kk; }",
    "if (g < 1) { const dd = hyp(camPos.x - px, camPos.z - pz) || 1, kk = Math.max(0.05, g - 0.5 / dd), tx_ = px + (camPos.x - px) * kk, tz_ = pz + (camPos.z - pz) * kk, sl_ = hyp(tx_ - camPos.x, tz_ - camPos.z) > 0.4 ? 1 - Math.exp(-CAM_WALL * dt) : 1; /* a small correction is exact; a big one (the walker jumped past a wall edge) is a quick glide, not a jump */ camPos.x += (tx_ - camPos.x) * sl_; camPos.z += (tz_ - camPos.z) * sl_; }")
# a third view, first person (Carlo, 24/10): the walker's eyes, or just above the bonnet; the right stick looks about, R3 behind
rep("camMode = (camMode + 1) % 2", "camMode = P.mode === 'car' ? (camMode + 1) % 3 : camMode", 2)
rep("  if (camMode === 1) {\n    const ht = inCar ? 58 + sp * 0.9 : 36,",
    "  if (!inCar) P.model.g.visible = !((camMode === 2 && fpDone) || (hyp(camPos.x - px, camPos.z - pz) < 0.9 && camPos.y - P.y < 2.2)); /* the body is hidden only once the camera is close to the eyes */\n"
    "  if (camMode === 2) {\n"
    "    camSteer(dt, inCar, h, inCar ? P.car.speed > 3 : Math.abs(P.speedNow || 0) > 0.5);\n"
    "    let hx = Math.sin(camA), hz = Math.cos(camA); if (GP.back > 0.5 && inCar) { hx = -hx; hz = -hz; } camVA = Math.atan2(hx, hz);\n"
    "    const ey = inCar ? P.car.y + 1.25 : P.y + 1.62, fo = inCar ? 1.1 : 0.15;\n"
    "    want = new THREE.Vector3(px + fx * fo, ey, pz + fz * fo); look = new THREE.Vector3(want.x + hx * 10, ey - camPitch * 7, want.z + hz * 10);\n"
    "  } else if (camMode === 1) {\n    camVA = Math.PI;\n    const ht = inCar ? 58 + sp * 0.9 : 36,")
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
    "    const lontano = hyp(q0[0] - START.x, q0[1] - START.z) > 150; /* out on the bare ground, no lane near: the car at the exact point */\n"
    "    mine.x = lontano ? START.x : q0[0]; mine.z = lontano ? START.z : q0[1]; mine.h = h2; P.x = mine.x + Math.cos(h2) * 2.4; P.z = mine.z - Math.sin(h2) * 2.4; P.h = h2;\n"
    "    tileTick(START.x, START.z, 0, 420); for (const T of TILES) T.dist = hyp(T.cx - START.x, T.cz - START.z);\n"
    "    if (START.piedi) { P.x = START.x; P.z = START.z; } /* &piedi: on foot at the exact point, the car stays on the nearest lane */\n"
    "    P.y = H.surface(P.x, P.z); mine.y = H.surface(mine.x, mine.z); mine.sync();\n"
    "    if (START.mezzo && !START.piedi && MODELS[START.mezzo] && START.mezzo !== mine.kind) { /* &mezzo=<key of MODELS>: the start vehicle is that one (moto, bici, scooter, police...); an unknown key does nothing */\n"
    "      const cl_ = MODEL_COLS[START.mezzo], m2 = new Vehicle(START.mezzo, cl_ ? cl_[0] : '#c8332b', mine.x, mine.z, mine.h); m2.y = mine.y; m2.moved = true; mine.remove(); m2.sync();\n"
    "    }\n"
    "  }\n}")
rep("function startGame() {\n  if (running) return; running = true;",
    "function startGame() {\n  if (running) return; running = true; if (START !== STATION && !START.piedi) setTimeout(() => { if (P.mode === 'foot') enterExit(); }, 50); /* started from a link: already in the car (with &piedi: on foot) */")
# ---- the physics of the car in height (Carlo, 31/10: "manca la verticalita", "il motore fisico"): fisica3.js, every parameter is in FIS there. It replaces the jumps of 25/10
# (a ballistic shadow on the bed): the player's vehicle stands on springs on its wheels and leaves the ground by itself; the driving on the ground, Vehicle.step, stays. The traffic keeps a plain height. docs/motore.md, "Salti"
rep("const VEH = [];", """const VEH = [];
try { localStorage.removeItem('medaDrive'); } catch (e) { } /* the realistic driving model is gone, so is its saved switch */
""" + open(os.path.join(HERE, 'fisica3.js'), encoding='utf-8').read())
rep("    const i = this.inp, fx = Math.sin(this.h), fz = Math.cos(this.h), rx = fz, rz = -fx;\n",
    "    if (this.air) { this.stepAir(dt); return; }\n    const i = this.inp, fx = Math.sin(this.h), fz = Math.cos(this.h), rx = fz, rz = -fx;\n")
rep("    if (ty - this.y > 0.09 && ty - this.y < 0.2 && this === P.car && this.speed > 6) shake = Math.max(shake, 0.12);\n", "")
rep("    this.y = lerp(this.y, ty, 0.35); this.slope = lerp(this.slope, Math.atan2(yb - yf, this.co * 2), 0.35);",
    "    if (!this.F && (this === P.car || this.vy > 2)) fisInit(this); /* the player's vehicle, or one thrown up by an explosion */\n    if (this.F) fisVert(this, cf, cb, yf, yb, ty); else { this.y = lerp(this.y, ty, 0.35); this.slope = lerp(this.slope, Math.atan2(yb - yf, this.co * 2), 0.35); } /* the traffic follows the ground */")
rep("  wheelie(dt, v, thr, i) {", """  stepAir(dt) { // off its wheels: no grip, no engine, no brakes, the speed it took off with less a little air drag; the stick turns the body (fisVert), not its way
    const i = this.inp, k = 1 - 0.0004 * this.speed * dt;
    this.steer = lerp(this.steer, i.steer, 1 - Math.exp(-10 * dt)); this.vx *= k; this.vz *= k;
    this.x += this.vx * dt; this.z += this.vz * dt;
    this.spin += (this.fwdSpeed + (i.thr > 0 && this.health > 0 ? 8 : 0)) * dt / this.spec.wr; this.drift = 0;
    this.roll = lerp(this.roll, 0, 0.04);
  }
  wheelie(dt, v, thr, i) {""")
rep("    else this.roll = lerp(this.roll, clamp(-yaw * v * 0.004, -0.08, 0.08), 0.1);\n    this.pitch = lerp(this.pitch, clamp((thr - i.brk) * -0.025, -0.04, 0.04), 0.1);",
    "    else if (!this.F) this.roll = lerp(this.roll, clamp(yaw * v * 0.004, -0.08, 0.08), 0.1); /* a car leans out of the bend; the player's vehicle does it on its springs */\n    if (!this.F) this.pitch = lerp(this.pitch, clamp((thr - i.brk) * -0.025, -0.04, 0.04), 0.1);")
rep("m.g.rotation.y = this.h; m.g.rotation.x = this.slope;", "m.g.rotation.y = this.h; m.g.rotation.x = this.F ? this.ap : this.slope; m.g.rotation.z = this.F ? this.ar : 0;")
rep("    for (const w of m.wheels) { w.w.rotation.x = this.spin; if (w.front) w.piv.rotation.y = this.steer * 0.5; }",
    "    for (const w of m.wheels) { w.w.rotation.x = this.spin; if (w.front) w.piv.rotation.y = this.steer * 0.5; }\n    if (this.F && !this.spec.two) for (let i = 0; i < m.wheels.length; i++) m.wheels[i].piv.position.y = this.spec.wr + this.F.off[i]; /* each wheel on its ground */")
rep("    v.step(dt); gateHits(v); fuelHits(v); propHits(v); barHits(v); v.collide();", "    const x0_ = v.x, z0_ = v.z; v.step(dt); vehSweep(v, x0_, z0_); gateHits(v); fuelHits(v); propHits(v); barHits(v); v.collide();")
rep("if (v.driver === null && v.speed < 0.05 && !v.inp.thr)", "if (v.driver === null && v.speed < 0.05 && !v.inp.thr && !v.air && !(v.vy > 1) && !v.fpBusy)")
rep("if (Math.abs(v.x - p.x) > 4 || Math.abs(v.z - p.z) > 4) continue;", "if (Math.abs(v.x - p.x) > 4 || Math.abs(v.z - p.z) > 4 || v.y - p.y > 1.4) continue; /* a car flying over, or on the bridge above */")
rep("if (Math.abs(v.x - P.x) > 4 || Math.abs(v.z - P.z) > 4) continue;", "if (Math.abs(v.x - P.x) > 4 || Math.abs(v.z - P.z) > 4 || v.y - P.y > 1.4) continue;")
rep("const a = VEH[i], b = VEH[j]; if (a.sleep && b.sleep) continue;", "const a = VEH[i], b = VEH[j]; if (a.sleep && b.sleep) continue; if (Math.abs(a.y - b.y) > 1.5) continue; /* one over the other: in the air, or on a bridge over the road */")
# ---- jumping and climbing on foot (Carlo, 31/10): salto3.js. The foot branch of the step, gravity, the guard against moves through a wall, the pose, the camera over low barriers
rep("function step(dt) {", open(os.path.join(HERE, 'salto3.js'), encoding='utf-8').read() + "\nfunction step(dt) {", 1)
rep("  if (P.mode === 'foot') {\n    if (P.knock > 0) { P.knock -= dt;", "  if (P.mode === 'foot') {\n    if (P.knock > 0) { P.climb = null; P.air = false; P.onV = null; }\n    footRide(); const x0_ = P.x, y0_ = P.y, z0_ = P.z; let mx_, mz_;\n    if (P.knock > 0) { P.knock -= dt;")
rep("    else {\n      P.y = H.surface(P.x, P.z, P.y); P.h = wrapA(P.h + ((K.left ? 1 : 0) - (K.right ? 1 : 0)) * 2.8 * dt);",
    "    else if (P.climb) climbStep(dt);\n    else if ((footVert(dt), P.climb)) { /* the press started a climb */ }\n    else {\n      P.h = wrapA(P.h + ((K.left ? 1 : 0) - (K.right ? 1 : 0)) * 2.8 * dt);")
rep("      P.vx = Math.sin(P.h) * sp; P.vz = Math.cos(P.h) * sp; P.x += P.vx * dt; P.z += P.vz * dt; P.phase += Math.abs(sp) * dt * 3;",
    "      if (P.land > 0 && P.heavy) sp *= 1 - SALTO.landSlow * P.land / SALTO.landT;\n"
    "      if (P.air) { if (Math.abs(sp) > 0.1) { const a_ = SALTO.airAcc * dt; P.vx += clamp(Math.sin(P.h) * sp - P.vx, -a_, a_); P.vz += clamp(Math.cos(P.h) * sp - P.vz, -a_, a_); } P.x += P.vx * dt; P.z += P.vz * dt; }\n"
    "      else { P.vx = Math.sin(P.h) * sp; P.vz = Math.cos(P.h) * sp; P.x += P.vx * dt; P.z += P.vz * dt; P.phase += Math.abs(sp) * dt * 3; }")
rep("    const pp = { x: P.x, z: P.z }; collideStatic(pp, 0.4, P.y + 0.4); P.x = clamp(pp.x, -LIM_X, LIM_X); P.z = clamp(pp.z, -LIM_Z, LIM_Z);",
    "    mx_ = P.x; mz_ = P.z; if (!P.climb) footCollide();")
rep("if (Math.abs(v.x - P.x) > 4 || Math.abs(v.z - P.z) > 4 || v.y - P.y > 1.4) continue;", "if (Math.abs(v.x - P.x) > 4 || Math.abs(v.z - P.z) > 4 || v.y - P.y > 1.4 || saltoAbove(v)) continue;")
rep("else { P.x = cx + dx / d * 2.2; P.z = cz + dz / d * 2.2; } } }\n  } else {\n    P.x = P.car.x;", "else { P.x = cx + dx / d * 2.2; P.z = cz + dz / d * 2.2; } } }\n    if (!P.climb) footGuard(x0_, y0_, z0_, mx_, mz_); else { const g_ = H.surface(P.x, P.z); if (P.y < g_) P.y = g_; } if (!P.air && !P.climb) P.yg = P.y; footRideEnd();\n  } else {\n    P.air = false; P.climb = null; P.onV = null; P.land = 0; P.jumpReq = 0;\n    P.x = P.car.x;")
rep("else { pm.inner.rotation.x = 0; pm.inner.position.y = 0; animPed(pm, P.phase, K.hand ? 0.9 : 0.55); }", "else saltoPose(pm, dt, K.hand ? 0.9 : 0.55);")
rep("    P.x = x; P.z = z; P.h = v.h; P.mode = 'foot'; P.model.g.visible = true; v.driver = null; v.boost = false;\n", "    P.x = x; P.z = z; P.h = v.h; P.mode = 'foot'; P.model.g.visible = true; v.driver = null; v.boost = false; P.y = ey_; /* on the ground, or on the roof he stopped on (fisica3.js exitSpot) */\n")
rep("if (s.r || s.dyn || s.y0 > cy) return; const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex;", "if (s.r || s.dyn || s.y0 > cy || s.off || (P.mode === 'foot' && saltoLowBar(s))) return; /* on foot the camera goes over the barriers he can climb (updCamera), it does not stop at them */ const ex = s.bx - s.ax, ez = s.bz - s.az, den = dx * ez - dz * ex;")
rep("    const f = rayCam(px, pz, cx, cz, wy);", "    if (!inCar) { const tb_ = barTopOnRay(px, pz, cx, cz), wy0_ = wy; if (tb_ + 0.8 > wy0_) { ht += tb_ + 0.8 - wy0_; wy = tb_ + 0.8; } } /* over a barrier he can climb the camera looks over it */\n    const f = rayCam(px, pz, cx, cz, wy);")
rep("    const wy = Math.max(fy, H.ground(cx, cz)) + ht;", "    let wy = H.camCap(cx, cz, fy, Math.max(fy, H.camG(cx, cz, fy)) + ht);")
rep("  camera.position.copy(camPos);\n  if (shake > 0)", "  if (!inCar) { const C_ = updCamera; if (P.climb || P.air || P.land > 0) C_.hold = SALTO.camHold; else C_.hold = Math.max(0, (C_.hold || 0) - dt); const rx_ = camPos.x - px, ry_ = camPos.y - suby, rz_ = camPos.z - pz; if (C_.hold > 0 && C_.rel && camMode !== 2) { const ex_ = rx_ - C_.rel[0], ey_ = ry_ - C_.rel[1], ez_ = rz_ - C_.rel[2], el_ = Math.hypot(ex_, ey_, ez_), cap_ = SALTO.camV * dt; if (el_ > cap_) { const q_ = cap_ / el_; camPos.set(px + C_.rel[0] + ex_ * q_, suby + C_.rel[1] + ey_ * q_, pz + C_.rel[2] + ez_ * q_); } } C_.rel = [camPos.x - px, camPos.y - suby, camPos.z - pz]; } else updCamera.rel = null; /* no cuts during a gesture: round him the camera only glides */\n  camera.position.copy(camPos);\n  if (shake > 0)")
rep("window.__G = { VIVI,", "window.__G = { FIS, VIVI, step, exitSpot, walkGround, bldFloorAt, bldRoofY, inBuildingAt, updVisuals, BAR_ROTTE, GATE_ROTTI, barBreak, breakGate, breakProp, hedgeHit, cheatRespawn, cheatFerari, endRun, teletrasporto, toggleBig, reportSpot, SALTO, capsuleFree, tryClimb, footFloor, isBarrier, saltoCrosses, vehMaxTop, FUEL,")
# ---- a car off its wheels (Carlo, 1/11): fisica3.js. It steps with no grip, it turns round its waist, on its roof it is finished, he always gets out in a free place
rep("    if (this.air) { this.stepAir(dt); return; }\n", "    if (this.air || (this.F && this.F.rig)) { this.stepAir(dt); return; }\n")
rep("    const i = this.inp, k = 1 - 0.0004 * this.speed * dt;\n", "    const i = this.ko ? KO_INP : this.inp, k = 1 - 0.0004 * this.speed * dt;\n")
rep("class Vehicle {\n", "const KO_INP = { thr: 0, brk: 0, steer: 0, hand: 0, lean: 0 }; /* a car finished on its roof: the controls do nothing */\nclass Vehicle {\n")
rep("m.g.rotation.z = this.F ? this.ar : 0;\n", "m.g.rotation.z = this.F ? this.ar : 0;\n    if (this.F && this.F.rig) { const ca_ = Math.cos(this.ar), cp_ = Math.cos(this.ap), up_ = ca_ * cp_; if (up_ < FIS.pivHi) { const k_ = fisPivot(this.F, up_), lx_ = k_ * Math.sin(this.ar), lz_ = -k_ * ca_ * Math.sin(this.ap), sh_ = Math.sin(this.h), ch_ = Math.cos(this.h); m.g.position.x += lx_ * ch_ + lz_ * sh_; m.g.position.z += lz_ * ch_ - lx_ * sh_; m.g.position.y += k_ * (1 - up_); } } /* a body well over turns round its waist; on its wheels (a steep bank, a jump) round the point under them, as fisVert turns it (Carlo 6/11: the car went into the bank) */\n")
rep("let x = v.x + fz * 1.6, z = v.z - fx * 1.6; if (inBuilding(x, z, 0.4)) { x = v.x - fz * 1.6; z = v.z + fx * 1.6; }", "const [x, z, ey_] = exitSpot(v);")
rep("    toast(`${best.stolen ? (isTwo(best)", "    if (!best.ko) toast(`${best.stolen ? (isTwo(best)")
rep("v.inp.thr > 0.3 && v.health > 0 && P.nitro > 1 && !v.spec.pedal;", "v.inp.thr > 0.3 && v.health > 0 && P.nitro > 1 && !v.spec.pedal && !v.ko;")
rep("const live = !!v.driver && v.health > 0 && !v.exploded && !v.fallen,", "const live = (!!v.driver || v.fariFino > now) && v.health > 0 && !v.exploded && !v.fallen && !v.ko,") # (FARI: a little after he gets out)
rep("  const v = P.mode === 'car' ? P.car : null;\n  if (v) { const s = Math.abs(v.fwdSpeed), gs = v.maxV / 4.2,", "  const v = P.mode === 'car' && !P.car.ko ? P.car : null; /* finished on its roof: no engine to hear */\n  if (v) { const s = Math.abs(v.fwdSpeed), gs = v.maxV / 4.2,")
# ---- less garbage per frame: Math.hypot boxes its arguments on every call, and it is called everywhere (same numbers to the last bits or so). The train against the traffic: a look at the distance first, no two circles of every car for every coach, every step
rep("const hyp = Math.hypot;", "function hyp(a, b, c) { return c === undefined ? Math.sqrt(a * a + b * b) : Math.hypot(a, b, c); }")
rep("    for (const v of VEH) for (const c of v.circles()) { const dx = c[0] - cx, dz = c[1] - cz, d = hyp(dx, dz), RT = 1.75 + v.rad;", "    for (const v of VEH) if (Math.abs(v.x - cx) <= 1.75 + v.rad + v.co && Math.abs(v.z - cz) <= 1.75 + v.rad + v.co) for (const c of v.circles()) { const dx = c[0] - cx, dz = c[1] - cz, d = hyp(dx, dz), RT = 1.75 + v.rad;")
# ---- the blocks a tile is built in (blocchi3.js)
rep("const Buf = () => ({ p: [], n: [], uv: [], c: [], i: [] });", open(os.path.join(HERE, 'blocchi3.js'), encoding='utf-8').read())
# ---- cars and people drawn together (fusi3.js)
rep("const _geo = {};\nconst boxG = (w, h, l) => { const k = w + ',' + h + ',' + l; return _geo[k] || (_geo[k] = new THREE.BoxGeometry(w, h, l)); };", open(os.path.join(HERE, 'fusi3.js'), encoding='utf-8').read() + "\nconst _geo = {};\nconst boxG = (w, h, l) => { const k = w + ',' + h + ',' + l; if (_geo[k]) return _geo[k]; const g = new THREE.BoxGeometry(w, h, l); g.fU = [w, h, l]; return _geo[k] = g; };")
rep("var bm = add(new THREE.BoxGeometry(S.W, S.bh, S.L, 3, 2, 6), paint, 0, by, 0);", "var bm = add(new THREE.BoxGeometry(S.W, S.bh, S.L, 3, 2, 6), paint, 0, by, 0); bm.geometry.fU = [S.W, S.bh, S.L, 3, 2, 6];")
rep("  scene.add(g);\n  return { g, body, wheels, rider, crew,", "  scene.add(g); g.fRadice = true; g.updateMatrixWorld = fusiMatrici;\n  return { g, body, wheels, rider, crew,")
rep("  scene.add(g); return { g, inner, L, R, AL, AR };", "  scene.add(g); g.fRadice = true; g.updateMatrixWorld = fusiMatrici; return { g, inner, L, R, AL, AR };")
rep("  const geo = m.bm.geometry, pos = geo.attributes.position, org = m.org", "  const geo = m.bm.geometry; geo.fFuori = true; /* dented: its own shape, drawn on its own (fusi3.js) */ const pos = geo.attributes.position, org = m.org")
rep("    VEH.push(this); this.sync();", "    this.m.g.fVeh = this; VEH.push(this); this.sync();")
# ---- frame timing (debug only): misure3.js, row #dbgmis. Nothing runs with debug off.
rep("async function reportSpot() {", open(os.path.join(HERE, 'misure3.js'), encoding='utf-8').read() + "\nasync function reportSpot() {")
rep("  let dt = Math.min(0.1, (t - last) / 1000); last = t;\n  pollPad();", "  const m_ = DEBUG ? dbgBegin(t) : null;\n  let dt = Math.min(0.1, (t - last) / 1000); last = t;\n  pollPad();")
rep("  { const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z; tileTick(px, pz, running ? 7 : 12); if (running &&", "  if (m_) dbgMk(m_, 'sim');\n  { const px = P.mode === 'car' ? P.car.x : P.x, pz = P.mode === 'car' ? P.car.z : P.z; tileTick(px, pz, running ? 7 : 12); if (m_) dbgMk(m_, 'tile'); if (running &&")
rep("  const ipol = running && !paused ? interpBegin(", "  if (m_) dbgMk(m_, 'sim');\n  const ipol = running && !paused ? interpBegin(")
rep("  renderer.render(scene, camera);\n  if (ipol) interpEnd(ipol);\n}", "  if (m_) dbgMk(m_, 'vis');\n  const g_ = m_ ? dbgGpuBegin() : 0;\n  renderer.render(scene, camera);\n  if (m_) { dbgGpuEnd(g_); dbgMk(m_, 'draw'); }\n  if (ipol) interpEnd(ipol);\n  if (m_) dbgEnd(m_);\n}")
rep("if (!DEBUG) { el.hidden = true; return; }", "if (!DEBUG) { el.hidden = true; if (MIS.el && !MIS.el.hidden) dbgOff(); return; }")
rep("  spotN++; try { sfxBlip(660, 990, 0.12); } catch (e) { }", "  rec.misure = MIS.txt; spotN++; try { sfxBlip(660, 990, 0.12); } catch (e) { }")
rep("  if (e.code === 'KeyB') reportSpot();", "  if (e.code === 'KeyB') reportSpot();\n  if (e.code === 'KeyK' && DEBUG) dbgCopy();")
rep("window.__G = { FIS, VIVI,", "window.__G = { acquaIn, POOLS, GPS, BIGV, drawBig, gpsCalc, gpsGraph, gpsSnap, gpsAStar, setWay: (x, z) => { WAYPT = x == null ? null : { x, z }; gpsTick(0); }, MIS, openGate, PROPS, FIS, VIVI,")
# ---- GPS (gps3.js): the route follows the waypoint, drawn above the roads on the big map too
rep("  // places and landmarks\n", "  gpsDraw(g, px_(6)); /* the GPS route: above the roads, under the icons */\n  // places and landmarks\n")
rep("toast(had ? 'Segnaposto tolto' : 'Segnaposto messo'); drawBig();", "toast(had ? 'Segnaposto tolto' : 'Segnaposto messo'); gpsTick(0); drawBig();")
rep("  drawMinimap();\n  hudT -= dt;", "  if (P.mode !== 'car' && camMode === 2) camMode = 0; /* no first person on foot (Carlo, 3/11) */\n  gpsTick(dt); drawMinimap();\n  hudT -= dt;")
# ---- slopes, ground walls and floors (Carlo, 6/11): fisica3.js PENDIO (cars), salto3.js SALITA (on foot). The same rules for every vehicle and every place
rep("    if (thr > 0) { if (v < -0.5) v += 24 * dt; else v += thr * acc * Math.max(", "    const tk_ = pendioPresa(this); /* the grip the slope leaves the wheels: engine, brakes, steering, grip across */\n    if (thr > 0) { if (v < -0.5) v += 24 * tk_ * dt; else v += thr * acc * tk_ * Math.max(")
rep("if (i.brk > 0) { if (v > 0.5) v -= 21 * (1 - 0.25 * WX.wet) * dt * i.brk; else if (!dead) v = Math.max(-11, v - 7 * dt * i.brk); }", "if (i.brk > 0) { if (v > 0.5) v -= 21 * (1 - 0.25 * WX.wet) * tk_ * dt * i.brk; else if (!dead && v > -11) v = Math.max(-11, v - 7 * tk_ * dt * i.brk); }")
rep("    v += 9.81 * Math.sin(this.slope) * 0.6 * dt; // gravity on hills\n    const drag = (0.15 + (thr ? 0 : 1.6 + 0.0004 * v * v)) * dt + (i.hand ? 7 * dt : 0);",
    "    v += PENDIO.g * Math.sin(this.slope) * dt; // gravity on hills, whole\n    const drag = (0.15 + (thr ? 0 : 1.6 * tk_ + 0.0004 * v * v)) * dt + (i.hand ? 7 * tk_ * dt : 0);")
rep("    this.h = wrapA(this.h + yaw * dt);\n    lat *= Math.exp(-(i.hand ? 1.1 : S.grip * (1 - 0.3 * WX.wet)) * dt);",
    "    this.h = wrapA(this.h + yaw * tk_ * dt);\n    lat += this.pendLat * dt; lat *= Math.exp(-(i.hand ? 1.1 : S.grip * (1 - 0.3 * WX.wet)) * tk_ * dt);")
rep("  collide() {\n    let hitN = null;\n    for (const c of this.circles()) {\n      const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad, this.y + 0.4, true);\n      if (n) { this.x += p.x - c[0]; this.z += p.z - c[1]; hitN = n; }\n    }\n",
    "  collide(x0, z0) {\n    let hitN = null, pinch_ = false; const ap_ = this.F && !this.F.rig ? vehAppoggio(this) : null; /* what it comes down on is a floor, not a push (fisica3.js) */\n    for (const c of this.circles()) {\n      const p = { x: c[0], z: c[1] }; const n = collideStatic(p, this.rad, this.y + 0.4, true, ap_ && ap_.skip);\n      if (n) { this.x += p.x - c[0]; this.z += p.z - c[1]; hitN = n; if (n.pinch) pinch_ = true; }\n    }\n    if (pinch_ && x0 !== undefined) { const dx_ = this.x - x0, dz_ = this.z - z0, d_ = hyp(dx_, dz_); this.x = x0; this.z = z0; if (d_ > 1e-6) hitN = [-dx_ / d_, -dz_ / d_]; } /* squeezed between two things narrower than it: it does not go in, it stays where it was (no shaking from one to the other) */\n    if (x0 !== undefined) { const m_ = pendioMuro(this, x0, z0); if (m_) hitN = m_; } /* the ground steeper than a wall */\n")
rep("const [cf, cb] = this.circles(), yf = H.surface(cf[0], cf[1], this.y), yb = H.surface(cb[0], cb[1], this.y), ty = (yf + yb) / 2;",
    "const [cf, cb] = this.circles(), yf = Math.max(H.surface(cf[0], cf[1], this.y), ap_ ? ap_.lev[0] : -Infinity), yb = Math.max(H.surface(cb[0], cb[1], this.y), ap_ ? ap_.lev[1] : -Infinity), ty = (yf + yb) / 2;")
rep("propHits(v); barHits(v); v.collide();", "propHits(v); barHits(v); v.collide(x0_, z0_);")
rep("      else { P.vx = Math.sin(P.h) * sp; P.vz = Math.cos(P.h) * sp; P.x += P.vx * dt;", "      else { P.vx = Math.sin(P.h) * sp; P.vz = Math.cos(P.h) * sp; footSlope(dt); P.x += P.vx * dt;")
rep("    P.air = false; P.climb = null; P.onV = null; P.land = 0; P.jumpReq = 0;\n", "    P.air = false; P.climb = null; P.onV = null; P.land = 0; P.jumpReq = 0; P.slx = P.slz = 0;\n")
rep("v.driver = null; v.boost = false; P.y = ey_;", "v.driver = null; v.boost = false; P.y = ey_; if (v.speed > FARI.minV) v.fariFino = now + FARI.dopo; /* the lights stay on a little (extras.js FARI) */")
rep("window.__G = { acquaIn,", "window.__G = { FARI, PENDIO, SALITA, pendioPresa, pendioTan, footSlope, TOMBE, acquaIn,")
# ---- the helicopter (Carlo, 7/11): elicottero3.js. Only the pad; flown it is P.car (P.mode 'car'), so camera, radio, map and HUD follow it; its physics is its own
rep("function step(dt) {", open(os.path.join(HERE, 'elicottero3.js'), encoding='utf-8').read() + "\nfunction step(dt) {")
rep("  if (P.mode === 'car') {\n    const v = P.car; v.inp.thr = Math.max(", "  if (P.mode === 'car' && P.car.heli) heliInput(P.car);\n  else if (P.mode === 'car') {\n    const v = P.car; v.inp.thr = Math.max(")
rep("  // ----- train\n", "  heliStep(dt);\n  // ----- train\n")
rep("    if (P.knock > 0) return;\n    let best = null, bd = 4.2;", "    if (P.knock > 0) return;\n    if (heliEnter()) return;\n    let best = null, bd = 4.2;")
rep("  } else {\n    const v = P.car, fast = v.speed > 6;", "  } else if (P.car.heli) heliExit();\n  else {\n    const v = P.car, fast = v.speed > 6;")
rep("  if (v) { const s = Math.abs(v.fwdSpeed), gs = v.maxV / 4.2,", "  if (v && v.heli) heliSound(v, t, m);\n  else if (v) { const s = Math.abs(v.fwdSpeed), gs = v.maxV / 4.2,")
rep("    if (!inCar && camPitch) {", "    if (inCar && P.car.heli) { const d0_ = 12 + sp * 0.08, h0_ = 3.4 + sp * 0.03, R_ = hyp(d0_, h0_), ph_ = Math.min(HELI.camZen, Math.atan2(h0_, d0_) + camPitch); dist = R_ * Math.cos(ph_); ht = R_ * Math.sin(ph_); } /* the helicopter: farther and higher, the rotor in view; the right stick turns the view on a sphere round it, down to straight over it (Carlo 7/11) */\n    if (!inCar && camPitch) {")
# the camera of the helicopter (Carlo 7/11): moving it looks the way it goes (the stick held diagonally, it flies diagonally), still or nearly behind the nose; never from the front when it flies backwards
rep("let hx = fx, hz = fz; if (inCar && P.car.fwdSpeed < -2) { hx = -fx; hz = -fz; }", "let hx = fx, hz = fz; if (inCar && !P.car.heli && P.car.fwdSpeed < -2) { hx = -fx; hz = -fz; }\n    if (inCar && P.car.heli) { const a_ = heliCamDir(P.car); hx = Math.sin(a_); hz = Math.cos(a_); }")
rep("rev = P.car.fwdSpeed < -2;", "rev = !P.car.heli && P.car.fwdSpeed < -2;")
rep("  { const s_ = Math.abs(P.car.speed),", "  { const s_ = P.car.heli ? heliCamPace(P.car) : Math.abs(P.car.speed),")
rep("camPitch *= Math.exp(-k * dt);", "camPitch *= Math.exp(-(P.car.heli ? HELI.camPitchK : k) * dt);")
rep("!inCar && camFree ? CAMF.posK : 7.5", "!inCar && camFree ? CAMF.posK : inCar && P.car.heli ? HELI.camK : 7.5")
rep("(inCar ? camPitch * 6 : 0)", "(inCar && !P.car.heli ? camPitch * 6 : 0)")
rep("look = new THREE.Vector3(px + hx * (inCar ? 5 : 2), gy + (inCar ? 1.3 : 1.5), pz + hz * (inCar ? 5 : 2));", "const ld_ = inCar ? (P.car.heli ? 5 * clamp(1 - camPitch / 1.2, 0, 1) : 5) : 2; look = new THREE.Vector3(px + hx * ld_, gy + (inCar ? 1.3 : 1.5), pz + hz * ld_);")
rep("  camera.lookAt(camLook);", "  camera.lookAt(camLook);\n  if (inCar && P.car.heli && camMode === 0) camera.rotateZ(-heliCamLean(P.car)); /* banking, the view leans a little with it; still, it does not (elicottero3.js heliCamLean) */")
# fog thins out with the height of the view (Carlo 7/11: from the helicopter everything went dark past a kilometre while the lights showed through)
rep("scene.fog.near = lerp(lerp(160, 40, WX.rain), 2, WX.fog);", "scene.fog.near = lerp(lerp(160, 40, WX.rain), 2, WX.fog);\n  { const k_ = nebbiaQuota(); scene.fog.far *= k_; scene.fog.near *= k_; }")
rep("  snapOf(P, INTERP_KEYS);\n}", "  snapOf(P, INTERP_KEYS);\n  for (const e of HELIS) snapOf(e, INTERP_HELI);\n}")
rep("  interpMix(P, a);\n  return INTERP_DONE;", "  interpMix(P, a);\n  for (const e of HELIS) interpMix(e, a);\n  return INTERP_DONE;")
rep("const INTERP_VEH = [", "const INTERP_HELI = ['x', 'y', 'z', 'h', 'pitch', 'roll'], INTERP_VEH = [")
rep("function updVisuals(dt) {\n  const cx = camera.position.x, cz = camera.position.z;", "function updVisuals(dt) {\n  heliDraw(dt);\n  const cx = camera.position.x, cz = camera.position.z;")
rep("m2.y = mine.y; m2.moved = true; mine.remove(); m2.sync();\n    }\n  }\n}", "m2.y = mine.y; m2.moved = true; mine.remove(); m2.sync();\n    }\n  }\n  heliSetup();\n}")
rep("const slow = P.mode === 'foot' || P.car.speed < 2;", "const slow = P.mode === 'foot' || (P.car.speed < 2 && !(P.car.heli && P.car.alto > 2)); /* hovering up in the air nobody arrests him */")
rep("headSpot.intensity = v && v.health > 0 ?", "headSpot.intensity = v && v.health > 0 && !v.heli ?")
rep("interpSnap(); step(1 / 60); if (DEBUG) for (const v of VEH) if (v.health < 100) v.health = 100;", "interpSnap(); step(1 / 60); if (DEBUG) for (const v of [...VEH, ...HELIS]) if (v.health < 100 && !v.exploded) v.health = 100;")
# the pad in the helicopter: R2 up, L2 down, L1/R1 turn, left stick tilts, square fires (not yet), d-pad right the searchlight (not yet), cross and circle free
rep("const padKind = () => P.mode !== 'car' || !P.car ? 'foot' :", "const padKind = () => P.mode !== 'car' || !P.car ? 'foot' : P.car.heli ? 'heli' :")
rep("  return `${n.r2} gas ·", "  if (kind === 'heli') return `${n.r2} sale · ${n.l2} scende · levetta sinistra inclina (avanti, indietro, di lato) · ${n.l1} ${n.r1} gira · ${n.t} sali/scendi · croce sinistra radio · ${com}`;\n  return `${n.r2} gas ·")
rep("GP.lookx = GP.looky = GP.back = 0;", "GP.lookx = GP.looky = GP.back = GP.yaw = 0;", 2)
rep("  GP.horn = kind === 'car' || kind === 'moto' ? b(10) : 0;", "  GP.horn = kind === 'car' || kind === 'moto' ? b(10) : 0;\n  GP.yaw = kind === 'heli' ? b(4) - b(5) : 0;")
rep("  if (E[8] && P.mode === 'car')", "  if (E[8] && P.mode === 'car' && kind !== 'heli')")
rep("  if (veh) padTap(15, down(15), dt, () => ni(kind === 'bici' ? 'Fanale' : 'Fari')", "  if (kind === 'heli') padTap(15, down(15), dt, () => ni('Faro'), () => ni('Faro')); else if (veh) padTap(15, down(15), dt, () => ni(kind === 'bici' ? 'Fanale' : 'Fari')")
rep("  if (veh) {\n    if (E[3]) { K.use = true;", "  if (kind === 'heli') {\n    if (E[3]) { K.use = true; (GP.hold[3] || (GP.hold[3] = { t: 0, on: false, done: false })).block = true; }\n    if (E[2]) ni('Sparare');\n  } else if (veh) {\n    if (E[3]) { K.use = true;")
# the camera behind the helicopter: a wall whose top is under both the helicopter and the camera is not between them (rayCam looked at the plan only, and over the town it kept pulling the view in and letting it go, Carlo 7/11)
rep("function rayCam(ax, az, bx, bz, cy) { /* like rayWalls, but walls that start above the camera (the sides of a raised portico) do not count */\n  let best = 1;", "function rayCam(ax, az, bx, bz, cy) { /* like rayWalls, but walls that start above the camera (the sides of a raised portico) do not count */\n  const lo_ = P.mode === 'car' && P.car && P.car.heli ? Math.min(cy, P.car.y + 0.5) : -Infinity; /* from the helicopter: the walls whose top is under both ends do not count */\n  let best = 1;")
rep("if (s.r || s.dyn || s.y0 > cy || s.off || (P.mode === 'foot' && saltoLowBar(s))) return;", "if (s.r || s.dyn || s.y0 > cy || s.off || (s.y0 !== undefined && (s.bt ? s.y1 - 3 : s.y1) < lo_) || (P.mode === 'foot' && saltoLowBar(s))) return;")
rep("window.__G = { FARI,", "window.__G = { HELIS, HELI, heliStep, cheatHeli, camPosOf: () => camera.position, camOf: () => camera, fogOf: () => scene.fog, FARI,")
rep("const v = P.mode === 'car' ? P.car : null; if (!v || bumpT > 0 || v.speed < 7) return;", "const v = P.mode === 'car' ? P.car : null; if (!v || v.heli || bumpT > 0 || v.speed < 7) return;")
open(os.path.join(ROOT, 'index.html'), 'w', encoding='utf-8').write(s)
