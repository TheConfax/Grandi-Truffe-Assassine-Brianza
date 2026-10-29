// ---------------------------------------------------------------- road signs and road markings (segnaletica) from OpenStreetMap and Mapillary (tile list sm)
// SEGN (src/segnaletica.json, made from the OSM nodes and ways of the area): [kind, x, z, dx, dz, extra] where (dx, dz) is the way the traffic the sign
// talks to is going (0, 0: along the nearest road). stop and dare (give way) where OSM maps them, limite where the maxspeed of the street changes,
// vietato at the wrong end of one-way streets, and the signs mapped one by one (paese, via, transito, unico). Each stands on the right of the road
// facing the drivers, on a post you can knock down; stop and give way get their line across the lane and STOP painted on the asphalt.
const SEGN = /*__SEGN__*/[];
const SEGN_DONE = new Set();
const segTex = {}; const segTexIs = t => Object.values(segTex).some(p => p.some(m => m.map === t)); // shared across tiles: never freed
// The real signs of the Italian Codice della Strada: tex/segnali.png, one atlas, rasterised from the SVG drawings of Wikimedia Commons (credits in docs/dati.md and in the credits line).
// SEG_AT: name -> [x, y, w, h] in the atlas. A kind or a speed with no drawing there keeps the hand-drawn plate below.
const SEG_AT = {"stop": [2, 2, 252, 252], "dare": [258, 2, 252, 222], "vietato": [514, 2, 252, 252], "transito": [770, 2, 252, 252], "destra": [1026, 2, 252, 252], "rotatoria": [2, 258, 252, 252], "sosta": [258, 258, 252, 252], "fermata": [514, 258, 252, 252], "dritto": [770, 258, 252, 252], "pesanti": [1026, 258, 252, 252], "pedoni": [2, 514, 252, 252], "parcheggio": [258, 514, 252, 252], "limite10": [514, 514, 252, 252], "limite20": [770, 514, 252, 252], "limite30": [1026, 514, 252, 252], "limite40": [2, 770, 252, 252], "limite50": [258, 770, 252, 252], "limite60": [514, 770, 252, 252], "limite70": [770, 770, 252, 252], "limite80": [1026, 770, 252, 252], "limite90": [2, 1026, 252, 252], "limite100": [258, 1026, 252, 252], "limite110": [514, 1026, 252, 252], "limite120": [770, 1026, 252, 252], "limite130": [1026, 1026, 252, 252], "unico_dx": [2, 1282, 240, 60], "unico_sx": [258, 1282, 240, 60]};
const SEG_ATLAS = { img: null, redo: [] };
{ const im = new Image(); im.onload = () => { SEG_ATLAS.img = im; SEG_ATLAS.redo.forEach(f => f()); }; im.src = 'tex/segnali.png'; }
function segAtName(kind, extra) { const n = kind === 'limite' ? 'limite' + extra : kind === 'unico' ? (extra === 'sx' ? 'unico_sx' : 'unico_dx') : kind; return SEG_AT[n] ? n : null; }
function segDims(kind, extra) { // width and height of the plate in metres (a real urban plate: 60 cm; the triangle 90 cm side; the one-way plate 90 cm wide)
  const n = segAtName(kind, extra); if (!n) { const wide = kind === 'paese' || kind === 'via' || kind === 'unico'; return [kind === 'paese' ? 1.5 : kind === 'via' ? 1.3 : kind === 'unico' ? 0.9 : 0.75, kind === 'paese' ? 0.56 : kind === 'via' ? 0.48 : kind === 'unico' ? 0.45 : 0.75]; }
  const [, , w, h] = SEG_AT[n], pw = kind === 'dare' ? 0.95 : kind === 'unico' ? 0.9 : 0.65; return [pw, pw * h / w];
}
function segTexOf(kind, extra) {
  const key = kind + '|' + (extra || ''); if (segTex[key]) return segTex[key];
  const an = segAtName(kind, extra);
  if (an) { // the real plate: a canvas the size of its cell, filled from the atlas as soon as it is loaded
    const [sx, sy, sw, sh] = SEG_AT[an];
    const paint = (g, back) => { g.clearRect(0, 0, sw, sh); if (!SEG_ATLAS.img) return; g.drawImage(SEG_ATLAS.img, sx, sy, sw, sh, 0, 0, sw, sh); if (back) { g.globalCompositeOperation = 'source-in'; g.fillStyle = '#8d9094'; g.fillRect(0, 0, sw, sh); g.globalCompositeOperation = 'source-over'; } }; /* the back: the same outline, bare grey metal */
    const t = canvasTex(sw, sh, g => paint(g, false), false), bk = canvasTex(sw, sh, g => paint(g, true), false);
    SEG_ATLAS.redo.push(() => { paint(t.image.getContext('2d'), false); t.needsUpdate = true; paint(bk.image.getContext('2d'), true); bk.needsUpdate = true; });
    return (segTex[key] = [new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 }), new THREE.MeshLambertMaterial({ map: bk, alphaTest: 0.5 })]);
  }
  const wide = kind === 'paese' || kind === 'via' || kind === 'unico', W = wide ? 256 : 128, H = wide ? (kind === 'unico' ? 128 : 96) : 128;
  const t = canvasTex(W, H, (g, w, h) => {
    g.clearRect(0, 0, w, h); const cx = w / 2, cy = h / 2, R = 60;
    const circ = (r, col) => { g.fillStyle = col; g.beginPath(); g.arc(cx, cy, r, 0, TAU); g.fill(); };
    const txt = (s, size, col, y = cy, font = 'bold') => { g.fillStyle = col; g.font = `${font} ${size}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; let f = size; while (g.measureText(s).width > w - 14 && f > 10) { f -= 2; g.font = `${font} ${f}px Arial, sans-serif`; } g.fillText(s, cx, y + 2); };
    if (kind === 'stop') { const oct = r => { g.beginPath(); for (let i = 0; i < 8; i++) { const a = (i + 0.5) / 8 * TAU; g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); } g.closePath(); g.fill(); };
      g.fillStyle = '#ffffff'; oct(63); g.fillStyle = '#c8102e'; oct(57); txt('STOP', 38, '#ffffff'); }
    else if (kind === 'dare') { const tri = (k, col) => { const c0 = [64, 49], P = [[6, 12], [122, 12], [64, 122]].map(([x, y]) => [c0[0] + (x - c0[0]) * k, c0[1] + (y - c0[1]) * k]); g.fillStyle = col; g.beginPath(); g.moveTo(...P[0]); g.lineTo(...P[1]); g.lineTo(...P[2]); g.closePath(); g.fill(); };
      tri(1, '#c8102e'); tri(0.62, '#ffffff'); } // pointing down
    else if (kind === 'vietato') { circ(R + 3, '#ffffff'); circ(R, '#c8102e'); g.fillStyle = '#ffffff'; g.fillRect(cx - 42, cy - 10, 84, 20); }
    else if (kind === 'limite' || kind === 'transito') { circ(R + 3, '#ffffff'); circ(R, '#c8102e'); circ(R - 12, '#ffffff'); if (kind === 'limite') txt(String(extra), extra >= 100 ? 40 : 52, '#111111'); }
    else if (kind === 'destra') { circ(R + 3, '#ffffff'); circ(R, '#1f4fa0'); g.save(); g.translate(cx, cy); g.rotate(-Math.PI / 4); g.fillStyle = '#ffffff'; g.fillRect(-9, -34, 18, 40); g.beginPath(); g.moveTo(-26, 4); g.lineTo(26, 4); g.lineTo(0, 36); g.closePath(); g.fill(); g.restore(); } // passaggio obbligatorio a destra: the arrow pointing down to the right
    else if (kind === 'rotatoria') { circ(R + 3, '#ffffff'); circ(R, '#1f4fa0'); g.strokeStyle = '#ffffff'; g.fillStyle = '#ffffff'; g.lineWidth = 9; // three arrows chasing each other anticlockwise
      for (let k = 0; k < 3; k++) { const a0 = k * TAU / 3 + 0.35, a1 = a0 + 1.45, r = 32; g.beginPath(); g.arc(cx, cy, r, -a1, -a0); g.stroke(); const hx = cx + Math.cos(-a1) * r, hy = cy + Math.sin(-a1) * r, tx = -Math.sin(-a1), ty = Math.cos(-a1);
        g.beginPath(); g.moveTo(hx - tx * 14 + Math.cos(-a1) * 11, hy - ty * 14 + Math.sin(-a1) * 11); g.lineTo(hx - tx * 14 - Math.cos(-a1) * 11, hy - ty * 14 - Math.sin(-a1) * 11); g.lineTo(hx + tx * 6, hy + ty * 6); g.closePath(); g.fill(); } }
    else if (kind === 'sosta' || kind === 'fermata') { circ(R + 3, '#ffffff'); circ(R, '#c8102e'); circ(R - 10, '#1f4fa0'); g.save(); g.beginPath(); g.arc(cx, cy, R - 10, 0, TAU); g.clip(); g.translate(cx, cy); g.fillStyle = '#c8102e'; /* no parking: one stripe; no stopping: a cross */
      for (const a of kind === 'sosta' ? [-Math.PI / 4] : [-Math.PI / 4, Math.PI / 4]) { g.save(); g.rotate(a); g.fillRect(-70, -6, 140, 12); g.restore(); } g.restore(); }
    else if (kind === 'dritto') { circ(R + 3, '#ffffff'); circ(R, '#1f4fa0'); g.fillStyle = '#ffffff'; g.fillRect(cx - 7, cy - 4, 14, 38); g.beginPath(); g.moveTo(cx - 22, cy - 2); g.lineTo(cx + 22, cy - 2); g.lineTo(cx, cy - 34); g.closePath(); g.fill(); }
    else if (kind === 'pesanti') { circ(R + 3, '#ffffff'); circ(R, '#c8102e'); circ(R - 12, '#ffffff'); g.fillStyle = '#111111'; g.fillRect(cx - 30, cy - 14, 36, 24); g.fillRect(cx + 9, cy - 5, 21, 15); g.beginPath(); g.arc(cx - 16, cy + 13, 6, 0, TAU); g.arc(cx + 19, cy + 13, 6, 0, TAU); g.fill(); }
    else if (kind === 'pedoni') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f4fa0'; g.fillRect(5, 5, w - 10, h - 10); g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(64, 16); g.lineTo(112, 108); g.lineTo(16, 108); g.closePath(); g.fill();
      g.fillStyle = g.strokeStyle = '#1f4fa0'; g.lineWidth = 7; g.lineCap = 'round'; g.beginPath(); g.arc(64, 50, 7, 0, TAU); g.fill(); g.beginPath(); g.moveTo(64, 60); g.lineTo(64, 82); g.moveTo(64, 82); g.lineTo(54, 100); g.moveTo(64, 82); g.lineTo(76, 100); g.moveTo(64, 66); g.lineTo(52, 78); g.moveTo(64, 66); g.lineTo(76, 76); g.stroke(); } // the blue square with the white triangle and the walking figure
    else if (kind === 'parcheggio') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f4fa0'; g.fillRect(5, 5, w - 10, h - 10); txt('P', 88, '#ffffff'); }
    else if (kind === 'unico') { g.save(); if (extra === 'sx') { g.translate(w, 0); g.scale(-1, 1); } g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f4fa0'; g.fillRect(5, 5, w - 10, h - 10); g.fillStyle = '#ffffff'; g.fillRect(40, cy - 12, w - 110, 24); g.beginPath(); g.moveTo(w - 70, cy - 36); g.lineTo(w - 30, cy); g.lineTo(w - 70, cy + 36); g.fill(); g.restore(); }
    else if (kind === 'paese') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#111111'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12); txt(String(extra || '').toUpperCase(), 40, '#111111'); }
    else if (kind === 'via') { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2a2a2a'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); txt(String(extra || ''), 30, '#1d1d1d', cy, '600'); }
  }, false);
  const back = canvasTex(t.image.width, t.image.height, (g, w, h) => { g.drawImage(t.image, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = '#8d9094'; g.fillRect(0, 0, w, h); }, false); // the plate seen from behind: the same outline, bare grey metal
  return (segTex[key] = [new THREE.MeshLambertMaterial({ map: t, alphaTest: 0.5 }), new THREE.MeshLambertMaterial({ map: back, alphaTest: 0.5 })]);
}
const SEG_POLE = new THREE.MeshLambertMaterial({ color: 0x9a9da1 });
const SEG_MARK = { line: null, stop: null };
function inPolyAny(x, z) { const T = TILES[tileOf(x, z)]; return !!T && (T.d.md || []).some(q => q.g && inPoly(x, z, dec(q.p))); } // inside an island of the DBGT
function dbgtIsland(x, z, R) { // the nearest point 0.5 m inside an island of the DBGT (tiles[t].md with g) within R m, or null
  let best = null, bd = R;
  for (const T of TILES) { if (Math.abs(T.cx - x) > TS / 2 + R || Math.abs(T.cz - z) > TS / 2 + R) continue;
    for (const q of T.d.md || []) { if (!q.g) continue; const o = dec(q.p); let cx = 0, cz = 0; for (const p of o) { cx += p[0]; cz += p[1]; } cx /= o.length; cz /= o.length;
      for (let i = 0; i < o.length; i++) { const a = o[i], b = o[(i + 1) % o.length], ex = b[0] - a[0], ez = b[1] - a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - a[0]) * ex + (z - a[1]) * ez) / L2, 0, 1), px = a[0] + ex * t, pz = a[1] + ez * t, d = hyp(px - x, pz - z);
        if (d < bd) { const L = hyp(cx - px, cz - pz) || 1, k = Math.min(0.5, L / 2), qx = px + (cx - px) / L * k, qz = pz + (cz - pz) / L * k; if (inPoly(qx, qz, o)) { bd = d; best = [qx, qz]; } } } } }
  return best;
}
function segPlace(s) { // the post on the right of the lane, the plate facing the drivers
  if (s.place) return s.place;
  let [kind, x, z, dx, dz] = s, best = null, bd = 1e9;
  if (kind === 'isola') { // on the nose of the splitter island, as computed. Where the DBGT has an island (MAN_TR) within 8 m: on it, without the OSM island over or beside it; else on the drawn carriageway none (verifica 24/10: 31 of 89 lost)
    const q = dbgtIsland(x, z, 8); if (q) { s[5] = null; if (!inPolyAny(x, z)) { x = q[0]; z = q[1]; } } else if (nearAsph(x, z, 0.1)) s.skip = true;
    return (s.place = { px: x, pz: z, dx, dz, hw: 0 });
  }
  ROADSEG.each(x - 15, z - 15, x + 15, z + 15, g => { if (g.r.c > 5 || !atGrade(g) || g.r.t) return; const L = hyp(g.b[0] - g.a[0], g.b[1] - g.a[1]) || 1, al = (dx || dz) ? Math.abs((g.b[0] - g.a[0]) * dx + (g.b[1] - g.a[1]) * dz) / L : 1, d = segDist(x, z, g.a[0], g.a[1], g.b[0], g.b[1]) + (al < 0.6 ? 8 : 0); if (d < bd) { bd = d; best = g; } }); // the road the sign talks to: near, and running its way
  if (best) bd = segDist(x, z, best.a[0], best.a[1], best.b[0], best.b[1]);
  let hw = best ? best.r.w / 2 : 3, px = x, pz = z;
  if (best) {
    const ex = best.b[0] - best.a[0], ez = best.b[1] - best.a[1], L2 = ex * ex + ez * ez || 1, t = clamp(((x - best.a[0]) * ex + (z - best.a[1]) * ez) / L2, 0, 1), L = Math.sqrt(L2);
    const cx = best.a[0] + ex * t, cz = best.a[1] + ez * t;
    if (!dx && !dz) { dx = ex / L; dz = ez / L; if ((x - cx) * -dz + (z - cz) * dx < 0) { dx = -dx; dz = -dz; } } // the side of the road it was mapped on is its right
    else { const k = dx * ex / L + dz * ez / L; if (Math.abs(k) > 0.5) { dx = ex / L * Math.sign(k); dz = ez / L * Math.sign(k); } } // squared up with the road
    if (bd < hw + 0.6) { px = cx - dz * (hw + 0.9); pz = cz + dx * (hw + 0.9); } // off the asphalt, on the right
    for (let k = 0; k < 8 && (onAnyRoad(px, pz, 0.25) || nearAsph(px, pz, 0.25)); k++) { px -= dz * 0.6; pz += dx * 0.6; } // still on a road (a junction, a parallel lane, the drawn carriageway past its 0.5 m grid): a little further out
    if (onAnyRoad(px, pz, 0.25) || nearAsph(px, pz, 0.1)) { // the corner of a wide junction of the DBGT: a few metres back along the road, before the junction
      let ok = false; for (const al of [1, 2, 3, 4, 6, 8]) { for (let k = 0; k <= 6 && !ok; k++) { const qx = px - dx * al - dz * 0.6 * k, qz = pz - dz * al + dx * 0.6 * k; if (!onAnyRoad(qx, qz, 0.25) && !nearAsph(qx, qz, 0.25)) { px = qx; pz = qz; ok = true; } } if (ok) break; }
      if (!ok) s.skip = true; // nowhere to stand: better no sign than one in the middle of the road
    }
    s.lane = { cx, cz, hw };
  }
  return (s.place = { px, pz, dx, dz, hw });
}
function segLine(s, kind, dx, dz, hw, mk, lettering, WH) { // the stop line (teeth for give way) and the STOP across the right half of the road
  if ((kind === 'stop' || kind === 'dare' || (kind === 'rotatoria' && s[5] === 'dare')) && s.lane) { // across the right half of the road, where the sign is: the line (teeth for give way), STOP before it
    const { cx, cz } = s.lane, rx = -dz, rz = dx, Q = (a, b, c, d, col, buf = mk, uv) => { const i = buf.p.length / 3; [a, b, c, d].forEach((p, k) => vtx(buf, p[0], 0.085, p[1], 0, 1, 0, uv ? uv[k][0] : 0, uv ? uv[k][1] : 0, col)); buf.i.push(i, i + 2, i + 1, i, i + 3, i + 2, i, i + 1, i + 2, i, i + 2, i + 3); };
    const at = (along, side) => [cx + dx * along + rx * side, cz + dz * along + rz * side];
    if (kind === 'stop') Q(at(-0.25, 0.1), at(0.25, 0.1), at(0.25, hw - 0.2), at(-0.25, hw - 0.2), WH);
    else for (let t = 0.3; t < hw - 0.4; t += 0.8) Q(at(0, t), at(0, t + 0.5), at(-0.6, t + 0.25), at(-0.6, t + 0.25), WH); // the teeth point at the driver
    if (kind === 'stop' && hw > 2.2) { const m = hw / 2 + 0.05, l = Math.min(2.2, hw - 0.6); Q(at(-4.6, m - l / 2), at(-4.6, m + l / 2), at(-2.0, m + l / 2), at(-2.0, m - l / 2), WH, lettering, [[0, 0], [1, 0], [1, 1], [0, 1]]); } // read by the driver coming up to it: the top of the letters towards the line
  }
}
function buildSegnali(T, G) {
  const mk = FBuf(), lettering = FBuf(), WH = COL('#f2f0e8');
  if (T.d.sm && !T.d.smo) T.d.smo = T.d.sm.map((r, i) => { const s = r.slice(); s.i = i; s.place = { px: r[1], pz: r[2], dx: r[3], dz: r[4], hw: 0 }; return s; }); // the signs of Mapillary come with their place (src/mapillary_obj.py): on the kerb, facing the drivers
  const LIST = SEGN.map((s, i) => [s, i]); for (const s of T.d.smo || []) LIST.push([s, 'm' + T.t + '_' + s.i]);
  LIST.forEach(([s, idx]) => {
    const [kind, x, z] = s; if (tileOf(x, z) !== T.t) return;
    const { px, pz, dx, dz, hw } = segPlace(s); if (s.skip || inBuilding(px, pz, 0.3)) { segLine(s, kind, dx, dz, hw, mk, lettering, WH); return; } // a one-way lane through a courtyard: no post in the wall; no room for the post (the corner of a junction of the DBGT): the line and the STOP on the road all the same
    const gy = H.ground(px, pz), wide = kind === 'paese' || kind === 'via' || kind === 'unico';
    const root = new THREE.Group(); root.position.set(px, gy, pz); root.rotation.y = Math.atan2(-dx, -dz); G.add(root);
    if (kind === 'isola') { // the splitter island at a roundabout: a low post with the no entry for the exit lane and, on its right, keep right
      const root = new THREE.Group(); root.position.set(px, gy, pz); root.rotation.y = Math.atan2(-dx, -dz); G.add(root);
      for (const [k2, ox] of [['vietato', -0.33], ['destra', 0.33]]) { const [front, rear] = segTexOf(k2);
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.35, 8), SEG_POLE); pole.position.set(ox, 0.67, 0); root.add(pole);
        const pl = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), front); pl.position.set(ox, 1.05, 0.06); root.add(pl);
        const bk = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.6), rear); bk.position.set(ox, 1.05, -0.06); bk.rotation.y = Math.PI; bk.scale.x = -1; root.add(bk); }
      if (s[5] && s[5].length >= 3) { // the island: a raised kerb all round, paved in porphyry
        const ring = s[5], top = FBuf(), side = FBuf(), KB = COL('#d9d5ca');
        try { polyFill(top, ring, [], 0.16, 3, COL('#9b8f86')); } catch (e) { }
        for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length], k = side.p.length / 3; for (const [q, y] of [[a, -0.05], [c, -0.05], [c, 0.17], [a, 0.17]]) vtx(side, q[0], y, q[1], 0, 1, 0, 0, 0, KB); side.i.push(k, k + 1, k + 2, k, k + 2, k + 3, k, k + 2, k + 1, k, k + 3, k + 2); }
        mkMesh(top, MAT.mark, 7, false, G); mkMesh(side, MAT.mark, 7, false, G);
      }
      if (!SEGN_DONE.has(idx)) { SEGN_DONE.add(idx); s.prop = addProp({ x: px, z: pz, y: gy, r: 0.25, h: 1.6, obj: root }); } else if (s.prop) { s.prop.obj = root; if (s.prop.broken) root.rotation.x = -1.45; }
      return;
    }
    const top = wide ? 2.5 : 2.3, [pw, ph] = segDims(kind, s[5]);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, top + ph / 2, 8), SEG_POLE); pole.position.y = (top + ph / 2) / 2; pole.castShadow = true; root.add(pole);
    const [front, rear] = segTexOf(kind, s[5]), plate = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), front); plate.position.set(0, top, 0.06); root.add(plate);
    if (kind === 'rotatoria' && s[5] === 'dare') { const [f2, r2] = segTexOf('dare'), [pw2, ph2] = segDims('dare'), y2 = top + ph / 2 + ph2 / 2 + 0.06, p2 = new THREE.Mesh(new THREE.PlaneGeometry(pw2, ph2), f2); p2.position.set(0, y2, 0.06); root.add(p2); const b2 = new THREE.Mesh(new THREE.PlaneGeometry(pw2, ph2), r2); b2.position.set(0, y2, -0.06); b2.rotation.y = Math.PI; b2.scale.x = -1; root.add(b2); pole.scale.y = (y2 + ph2 / 2) / (top + ph / 2); pole.position.y = (y2 + ph2 / 2) / 2; } /* give way on top, roundabout under it */
    const back = new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), rear); back.position.set(0, top, -0.06); back.rotation.y = Math.PI; back.scale.x = -1; root.add(back); // mirrored, so the outline lines up with the front
    if (!SEGN_DONE.has(idx)) { SEGN_DONE.add(idx); s.prop = addProp({ x: px, z: pz, y: gy, r: 0.1, h: 3, obj: root }); } else if (s.prop) { s.prop.obj = root; if (s.prop.broken) root.rotation.x = -1.45; }
    segLine(s, kind, dx, dz, hw, mk, lettering, WH);
  });
  if (mk.i.length) mkMesh(mk, MAT.mark, 7, false, G);
  if (lettering.i.length) { SEG_MARK.stop = SEG_MARK.stop || new THREE.MeshLambertMaterial({ map: canvasTex(256, 128, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#f2f0e8'; g.font = 'bold 120px Arial Narrow, Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2); g.scale(1, 1); g.fillText('STOP', 0, 6); g.restore(); }, false), transparent: true, depthWrite: false }); mkMesh(lettering, SEG_MARK.stop, 7, false, G); }
}
