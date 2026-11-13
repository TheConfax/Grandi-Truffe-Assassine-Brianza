// Il metro dei livelli (docs/nastri.md, passo 0; Carlo 13/11: "il gioco non è 2D"). Conta, nel gioco stesso (headless, ?tutto), le cose disegnate a un livello
// che non è il loro. Il riferimento sono i nastri (src/nastri.py, mappa/nastri.bin): ogni carreggiata con la sua quota e i suoi due bordi.
//   Le cose della strada (righe, cordoli, spartitraffico, guardrail, parapetti dei ponti): ogni triangolo disegnato (per i parapetti ogni tratto) che cade
//   in pianta sopra un nastro (entro i suoi bordi più il margine della famiglia) e corre lungo di lui (|cos| sopra 0,87, cioè entro 30 gradi; i triangoli senza un lato in pianta di almeno mezzo metro, i paletti, non si guardano: le strisce pedonali, le linee
//   d'arresto e ciò che attraversa restano fuori, non si sa di chi sono) appartiene a quel nastro; se più nastri lo coprono e corrono con lui, a quello
//   più vicino in quota. È sbagliato se sta sotto o sopra la quota del suo nastro oltre la tolleranza della famiglia.
//   Le recinzioni e i muri (i piedi delle linee del tile): sbagliati se il piede (dal lato basso al lato alto, dove stanno su un muro di sostegno) non sta sul piano che ha sotto (oltre 0,6 m sopra o sotto H.surface).
//   Gli alberi: sbagliati se sopra di loro, entro la loro altezza, c'è un impalcato.
//   Si guardano solo i posti a più livelli: entro 25 m da un impalcato, una fossa, una galleria o un tratto di nastro che non è a raso.
//   I campioni sbagliati di una famiglia si raccolgono in casi (celle di 8 m). Il numero del metro è la somma dei casi.
//   A parte, su tutta la mappa: la strada fuori quota, i tratti (almeno 4 m) in cui sull'asse del nastro nessun piano del gioco sta entro 0,6 m dalla quota
//   del nastro (la strada disegnata e guidata non è dove dice il DBGT: le conche sui corsi d'acqua, i capi dei ponti, le bocche dei sottopassi).
// Nessuna correzione: è il metro, si rilancia a ogni passo. Scrive report_livelli.json accanto ai dati.
//   node src/controllo_livelli.mjs [http://127.0.0.1:8013/] [report_livelli.json] [--elenco]     pezzi.py lo chiama dopo la cottura
//   PLAYWRIGHT=<path of playwright/index.mjs> se non è installato qui; CHROME=<path of chrome.exe>; LINK=<base dei link stampati, di default l'indirizzo dato>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { trovaChrome } from './chrome.mjs';
const arg = process.argv.slice(2).filter(a => !a.startsWith('--')), url = arg[0] || 'http://127.0.0.1:8013/', out = arg[1] || 'report_livelli.json', base = process.env.LINK || url;
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT)).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || trovaChrome(), args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url + '?tutto');
await page.waitForFunction(() => { const b = document.getElementById('go'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click()); await page.waitForFunction(() => window.__G && __G.P && window.__NASTRI, null, { timeout: 180000 });
await page.waitForFunction(() => __G.H.DECKS.length && __G.H.DECKS.every(d => d.pronto || d.tipo === 'copertura'), null, { timeout: 400000, polling: 1000 }).catch(() => {});
const tiles = await page.evaluate(async () => {
  const H = __G.H, N = await __NASTRI.carica(), TILES = __NASTRI.TILES, R = v => Math.round(v * 10) / 10;
  // the families: m the margin past the edges of the ribbon, lo and hi how far under and over the ribbon its foot may be
  const FAM = { righe: { m: 0.3, lo: 0.5, hi: 0.5 }, cordoli: { m: 1.0, lo: 0.5, hi: 0.8 }, spartitraffico: { m: 1.5, lo: 0.5, hi: 1.6 }, guardrail: { m: 2.0, lo: 0.6, hi: 1.6 }, parapetti: { m: 6.0, lo: 0.8, hi: 0.8 } };
  // the ribbons: the stretches between two stations, in a grid
  const CELL = 12, SG = new Map(), K = (i, j) => i + ',' + j;
  for (const n of N.nastri) for (let k = 1; k < n.p.length; k++) {
    const a = n.p[k - 1], b = n.p[k], L = Math.hypot(b.x - a.x, b.z - a.z); if (L < 1e-6) continue;
    const s = { n, a, b, L, tx: (b.x - a.x) / L, tz: (b.z - a.z) / L, wla: Math.hypot(a.lx - a.x, a.lz - a.z), wlb: Math.hypot(b.lx - b.x, b.lz - b.z), wra: Math.hypot(a.rx - a.x, a.rz - a.z), wrb: Math.hypot(b.rx - b.x, b.rz - b.z) };
    if (s.wla + s.wra < 0.1 && s.wlb + s.wrb < 0.1) continue; // no carriageway measured
    const xs = [a.x, b.x, a.lx, b.lx, a.rx, b.rx], zs = [a.z, b.z, a.lz, b.lz, a.rz, b.rz], i0 = Math.floor((Math.min(...xs) - 3) / CELL), i1 = Math.floor((Math.max(...xs) + 3) / CELL), j0 = Math.floor((Math.min(...zs) - 3) / CELL), j1 = Math.floor((Math.max(...zs) + 3) / CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) { const k_ = K(i, j); (SG.get(k_) || SG.set(k_, []).get(k_)).push(s); }
  }
  const sopra = (x, z, m) => { // the ribbons over (x, z), m past their edges: [{ n, y, tx, tz, sede }]
    const o = [];
    for (const s of SG.get(K(Math.floor(x / CELL), Math.floor(z / CELL))) || []) {
      const px = x - s.a.x, pz = z - s.a.z, u = (px * s.tx + pz * s.tz) / s.L; if (u < -0.5 / s.L || u > 1 + 0.5 / s.L) continue;
      const uc = Math.max(0, Math.min(1, u)), d = px * s.tz - pz * s.tx; // d: to the left of the way
      if (d > s.wla + (s.wlb - s.wla) * uc + m || d < -(s.wra + (s.wrb - s.wra) * uc + m) || o.some(c => c.n === s.n)) continue;
      o.push({ n: s.n, y: s.a.y + (s.b.y - s.a.y) * uc, tx: s.tx, tz: s.tz, sede: s.b.s });
    }
    return o;
  };
  // the places on more than one level
  const ZC = 25, Z = new Set(), segna = (x0, z0, x1, z1) => { for (let i = Math.floor((x0 - ZC) / ZC); i <= Math.floor((x1 + ZC) / ZC); i++) for (let j = Math.floor((z0 - ZC) / ZC); j <= Math.floor((z1 + ZC) / ZC); j++) Z.add(K(i, j)); };
  for (const dk of H.DECKS) { const xs = dk.imp.map(p => p[0]), zs = dk.imp.map(p => p[1]); segna(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)); }
  for (const p of [...(H.PITS || []), ...(H.GALL || [])]) { const q = [...(p.sx || []), ...(p.dx || [])]; if (!q.length) q.push(p.c); const xs = q.map(v => v[0]), zs = q.map(v => v[1]); segna(Math.min(...xs), Math.min(...zs), Math.max(...xs), Math.max(...zs)); }
  for (const n of N.nastri) for (const q of n.p) if (q.s) segna(q.x, q.z, q.x, q.z);
  const inZona = (x, z) => Z.has(K(Math.floor(x / ZC), Math.floor(z / ZC)));
  const res = {}, fam = f => res[f] || (res[f] = { guardati: 0, senza_nastro: 0, di_traverso: 0, sbagliati: [] });
  const piano = (x, z, y) => { const s = H.surface(x, z, y - 0.5); return Math.abs(s - y) < 0.3 ? 'appoggiato su un piano a quota ' + R(s) : 'su nessun piano (sotto ha ' + R(s) + ')'; };
  const guarda = (f, x, z, y, ux, uz) => {
    const F = FAM[f], r = fam(f); r.guardati++;
    const cov = sopra(x, z, F.m); if (!cov.length) { r.senza_nastro++; return; }
    const lungo = cov.filter(c => Math.abs(c.tx * ux + c.tz * uz) > 0.87); if (!lungo.length) { r.di_traverso++; return; }
    let o = lungo[0]; for (const c of lungo) if (Math.abs(y - c.y) < Math.abs(y - o.y)) o = c;
    const dy = y - o.y; if (dy < -F.lo || dy > F.hi) r.sbagliati.push({ x: R(x), z: R(z), y: R(y), dy: R(dy), nastro: o.n.i, nome: o.n.n, sede: N.sedi[o.sede], dove: piano(x, z, y) });
  };
  window.__LV = { H, N, TILES, R, inZona, guarda, fam, res, sopra };
  const T0 = TILES[0], TS = Math.abs(TILES[1].cx - T0.cx) || 250, celle = [...Z].map(k => k.split(',').map(Number));
  return TILES.filter(T => T.lw && celle.some(([i, j]) => (i + 1) * ZC > T.cx - TS / 2 && i * ZC < T.cx + TS / 2 && (j + 1) * ZC > T.cz - TS / 2 && j * ZC < T.cz + TS / 2)).map(T => T.t);
});
let fatti = 0;
for (const t of tiles) {
  const e = await page.evaluate(t => {
    const { H, TILES, R, inZona, guarda, fam } = __LV, T = TILES[t], era = T.built;
    try { const tt = __G.tileTick; if (tt.cur && tt.cur !== T) { __NASTRI.buildTile(tt.cur); tt.cur = null; } /* the tile the frames left half built first, as tileTick does (pezzi3.js) */ if (!era || !T.ready) __NASTRI.buildTile(T); if (tt.cur === T) tt.cur = null; } catch (e) { return 'tile ' + t + ': ' + e.message; }
    if (!T.group) return null;
    T.group.updateMatrixWorld(true);
    T.group.traverse(m => {
      const f = m.userData && m.userData.fam; if (!f || !m.geometry || !m.geometry.index) return;
      const P = m.geometry.attributes.position.array, I = m.geometry.index.array, e = m.matrixWorld.elements, V = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
      for (let i = 0; i + 2 < I.length; i += 3) {
        if (I[i] === I[i + 1] || I[i + 1] === I[i + 2]) continue; // a piece broken through (barHide)
        for (let k = 0; k < 3; k++) { const o = I[i + k] * 3, x = P[o], y = P[o + 1], z = P[o + 2]; V[k][0] = e[0] * x + e[4] * y + e[8] * z + e[12]; V[k][1] = e[1] * x + e[5] * y + e[9] * z + e[13]; V[k][2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
        const cx = (V[0][0] + V[1][0] + V[2][0]) / 3, cz = (V[0][2] + V[1][2] + V[2][2]) / 3; if (!inZona(cx, cz)) continue;
        let ux = 0, uz = 0, L = 0; for (let k = 0; k < 3; k++) { const a = V[k], b = V[(k + 1) % 3], l = Math.hypot(b[0] - a[0], b[2] - a[2]); if (l > L) { L = l; ux = (b[0] - a[0]) / l; uz = (b[2] - a[2]) / l; } }
        if (L < (f === 'righe' ? 0.3 : 0.5)) continue; /* a post, a cap: no direction to tell whose it is */
        guarda(f, cx, cz, f === 'righe' ? (V[0][1] + V[1][1] + V[2][1]) / 3 : Math.min(V[0][1], V[1][1], V[2][1]), ux, uz);
      }
    });
    // fences and walls: every foot on the plane under it
    const rc = fam('recinzioni'), piede = p => {
      if (!inZona(p[0], p[1])) return; if (p.fy === undefined) { rc.senza_nastro++; return; } rc.guardati++;
      const s = H.surface(p[0], p[1], p.fy + 0.8), lo = Math.min(p.fy, p.lo === undefined ? p.fy : p.lo), dy = s > p.fy ? p.fy - s : s < lo ? lo - s : 0; /* lo: the foot on the low side, where it stands on a retaining wall */ if (Math.abs(dy) > 0.6) rc.sbagliati.push({ x: R(p[0]), z: R(p[1]), y: R(p.fy), dy: R(dy), dove: 'il piano sotto è a ' + R(s) });
    };
    for (const q of T.feQ || []) for (const p of q) piede(p);
    for (const [, q] of T.baQ || []) for (const p of q) piede(p);
    // trees: no deck within their height
    const al = fam('alberi');
    for (const [x, z, th] of T.tr || []) {
      if (!inZona(x, z)) continue; al.guardati++; const gy = H.ground(x, z);
      for (const o of H.deckAt(x, z)) if (o.top > gy + 1 && o.bot < gy + (th || 6)) { al.sbagliati.push({ x: R(x), z: R(z), y: R(gy), dy: R(o.bot - gy), dove: 'sotto l\'impalcato ' + o.d.fonte }); break; }
    }
    if (!era) __NASTRI.freeTile(T);
    return null;
  }, t);
  if (e) errs.push(e); fatti++;
}
const r = await page.evaluate(() => {
  const { H, N, R, guarda, res, fam } = __LV, link = (x, z) => '?x=' + Math.round(x) + '&z=' + Math.round(z) + '&debug=1';
  // the parapets of the decks
  for (const dk of H.DECKS) { if (!dk.bar) continue; for (const q of dk.bar.rails) { const L = Math.hypot(q[3] - q[0], q[4] - q[1]); if (L < 0.05) continue; guarda('parapetti', (q[0] + q[3]) / 2, (q[1] + q[4]) / 2, (q[2] + q[5]) / 2, (q[3] - q[0]) / L, (q[4] - q[1]) / L); } }
  // the cases: the wrong samples of a family in cells of 8 m
  const per = {}; let numero = 0;
  for (const f of ['righe', 'cordoli', 'spartitraffico', 'guardrail', 'parapetti', 'recinzioni', 'alberi']) {
    const r_ = fam(f), C = new Map();
    for (const b of r_.sbagliati) { const k = Math.floor(b.x / 8) + ',' + Math.floor(b.z / 8), c = C.get(k); if (c) { c.n++; if (Math.abs(b.dy) > Math.abs(c.dy)) c.dy = b.dy; } else C.set(k, { ...b, n: 1, link: link(b.x, b.z) }); }
    const posti = [...C.values()].sort((a, b) => b.n - a.n); numero += posti.length;
    per[f] = { guardati: r_.guardati, senza_nastro: r_.senza_nastro, di_traverso: r_.di_traverso, sbagliati: r_.sbagliati.length, casi: posti.length, posti };
  }
  // the road off its height: along every ribbon every 2 m, the plane of the game nearest to the height of the ribbon
  const fq = { stazioni: 0, fuori: 0, m: 0, tratti: 0, posti: [] }, PASSO = 2, TOL = 0.6;
  const vicino = (x, z, y) => { let b = H.ground(x, z); for (const c of [H.surface(x, z, y - 0.8), H.surface(x, z, y), H.surface(x, z, y + 2), H.surface(x, z, y + 6)]) if (Math.abs(c - y) < Math.abs(b - y)) b = c; return b; };
  for (const n of N.nastri) {
    let run = null; const chiudi = () => { if (run && run.m >= 4) { fq.tratti++; fq.m += run.m; fq.posti.push({ nastro: n.i, nome: n.n, sede: N.sedi[run.sede], m: run.m, dy: R(run.dy), x: R(run.x), z: R(run.z), link: link(run.x, run.z) }); } run = null; };
    for (let k = 1; k < n.p.length; k++) {
      const a = n.p[k - 1], b = n.p[k], L = Math.hypot(b.x - a.x, b.z - a.z), q = Math.max(1, Math.round(L / PASSO));
      for (let i = 0; i < q; i++) {
        const u = (i + 0.5) / q, x = a.x + (b.x - a.x) * u, z = a.z + (b.z - a.z) * u, y = a.y + (b.y - a.y) * u, s = vicino(x, z, y), dy = s - y; fq.stazioni++;
        if (!(Math.abs(dy) <= TOL)) { fq.fuori++; if (!run) run = { m: 0, dy: 0, x, z, sede: b.s }; run.m += L / q; if (Math.abs(dy) > Math.abs(run.dy)) { run.dy = dy; run.x = x; run.z = z; } } else chiudi();
      }
    }
    chiudi();
  }
  fq.m = Math.round(fq.m); fq.posti.sort((a, b) => Math.abs(b.dy) * b.m - Math.abs(a.dy) * a.m);
  return { numero, per_famiglia: per, strada_fuori_quota: fq };
});
r.definizione = 'il metro dei livelli (docs/nastri.md passo 0): cose della strada disegnate sotto o sopra il nastro a cui appartengono, recinzioni col piede fuori dal piano che hanno sotto, alberi sotto un impalcato, nei posti a più livelli; numero = somma dei casi (celle di 8 m per famiglia). strada_fuori_quota: tratti di nastro senza un piano del gioco entro 0,6 m dalla sua quota, su tutta la mappa';
r.tolleranze = 'righe 0,5 m; cordoli da -0,5 a +0,8; spartitraffico e guardrail da -0,5/-0,6 a +1,6; parapetti 0,8; recinzioni 0,6'; r.tile_guardati = fatti; r.errori = errs.slice(0, 5);
fs.writeFileSync(out, JSON.stringify(r, null, 1));
const P = r.per_famiglia, fq = r.strada_fuori_quota;
console.log('metro dei livelli: %d casi (%s) in %d tile; strada fuori quota: %d tratti, %d m%s', r.numero, Object.keys(P).map(f => f + ' ' + P[f].casi).join(', '), fatti, fq.tratti, fq.m, errs.length ? '; ERRORI: ' + errs.slice(0, 3).join(' | ') : '');
if (process.argv.includes('--elenco')) {
  for (const f of Object.keys(P)) for (const c of P[f].posti) console.log('   %s  %d campioni  dy %s m  %s  %s%s  %s', f, c.n, c.dy, c.nome || '', base, c.link, c.dove || '');
  for (const c of fq.posti) console.log('   strada fuori quota  %d m  dy %s m  %s (%s)  %s%s', Math.round(c.m), c.dy, c.nome || '', c.sede, base, c.link);
}
await browser.close();
