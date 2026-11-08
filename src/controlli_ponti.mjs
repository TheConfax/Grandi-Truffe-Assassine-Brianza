// Controllo delle barriere dei ponti (ramo ponti-spalle, Carlo 6/11: "ti sembra dritto?"). Nel gioco stesso (headless, ?tutto), su ogni impalcato: i parapetti
// (deckInit, dk.bar.rails) e i muri sotto (spalleNucleo, rampWalls, spalleCapi, world3.js). Conta, con i posti:
//   accavallati  m di parapetto che corrono paralleli a un altro parapetto a 0,05-0,8 m (due file una sull'altra)
//   scatti       angoli di un parapetto fra due tratti dritti piu corti di SCATTO m (la scaletta delle celle del reticolo)
//   in_strada    muri sotto i ponti in mezzo a una carreggiata (asfalto da tutti e due i lati, a meno di 1 m dal piede)
//   di_traverso  tratti di parapetto in mezzo alla carreggiata di una strada alla loro quota, di traverso (Carlo 8/11: il capo storto della Milano-Meda a x 355 z 2017)
// Soglia 0 per tutti e quattro. Scrive la chiave "barriere" in report_ponti.json (accanto al controllo dei capi di src/controlli_ponti.py).
//   node src/controlli_ponti.mjs [http://127.0.0.1:8013/] [report_ponti.json]      pezzi.py lo chiama dopo la cottura
//   PLAYWRIGHT=<path of playwright/index.mjs> se non è installato qui; CHROME=<path of chrome.exe>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { trovaChrome } from './chrome.mjs';
const url = process.argv[2] || 'http://127.0.0.1:8013/', out = process.argv[3] || 'report_ponti.json';
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT)).href : 'playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROME || trovaChrome(), args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url + '?tutto');
await page.waitForFunction(() => { const b = document.getElementById('go'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click()); await page.waitForFunction(() => window.__G && __G.P && window.__PONTI, null, { timeout: 180000 });
await page.waitForFunction(() => __G.H.DECKS.length && __G.H.DECKS.every(d => d.pronto || d.tipo === 'copertura'), null, { timeout: 400000, polling: 1000 }).catch(() => {});
const r = await page.evaluate(() => {
  const H = __G.H, P = window.__PONTI, SCATTO = 3.0, R = v => Math.round(v * 10) / 10, link = (x, z) => '?x=' + R(x) + '&z=' + R(z);
  const rails = [], acc = [], sc = [], ins = [], tot = { decks: 0, parapetti_m: 0, muri: 0 };
  for (const dk of H.DECKS) {
    if (dk.tipo === 'copertura' || !dk.bar) continue; tot.decks++;
    for (const q of dk.bar.rails) { rails.push({ dk, ax: q[0], az: q[1], ay: q[2], bx: q[3], bz: q[4], by: q[5] }); tot.parapetti_m += Math.hypot(q[3] - q[0], q[4] - q[1]); }
    // walls: their middle on a carriageway, asphalt on both sides of them, the foot on the ground there
    for (const [w, src] of [...P.spalleNucleo(dk).map(w => [w, 'spalla']), ...P.rampWalls(dk).map(w => [w, 'rampa']), ...P.spalleCapi(dk).map(w => [w, 'capo'])]) {
      tot.muri++; const [ax, az, ya0, , bx, bz] = w, L = Math.hypot(bx - ax, bz - az) || 1, nx = (bz - az) / L, nz = -(bx - ax) / L, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      const asf = s => H.mat(mx + nx * s, mz + nz * s) === 1 && Math.abs(H.base(mx + nx * s, mz + nz * s) - ya0 - 0.3) < 1.0;
      if (asf(0.8) && asf(-0.8)) ins.push({ fonte: dk.fonte + ' ' + src, x: R(mx), z: R(mz), link: link(mx, mz) });
    }
  }
  // two rows of parapets one on the other
  const G = new Map(), K = (x, z) => Math.floor(x / 4) + ',' + Math.floor(z / 4);
  rails.forEach((s, i) => { const k = K((s.ax + s.bx) / 2, (s.az + s.bz) / 2); (G.get(k) || G.set(k, []).get(k)).push(i); });
  const seen = new Set();
  rails.forEach((s, i) => {
    const mx = (s.ax + s.bx) / 2, mz = (s.az + s.bz) / 2, L = Math.hypot(s.bx - s.ax, s.bz - s.az) || 1, ux = (s.bx - s.ax) / L, uz = (s.bz - s.az) / L, gx = Math.floor(mx / 4), gz = Math.floor(mz / 4);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const j of G.get((gx + dx) + ',' + (gz + dz)) || []) {
      if (j === i) continue; const t = rails[j], Lt = Math.hypot(t.bx - t.ax, t.bz - t.az) || 1, vx = (t.bx - t.ax) / Lt, vz = (t.bz - t.az) / Lt;
      if (Math.abs(ux * vx + uz * vz) < 0.94) continue;
      const tx = (t.ax + t.bx) / 2 - mx, tz = (t.az + t.bz) / 2 - mz, d = Math.abs(-uz * tx + ux * tz), along = Math.abs(ux * tx + uz * tz);
      if (d < 0.05 || d > 0.8 || along > (L + Lt) / 2 - 0.2 || Math.abs((t.ay + t.by) / 2 - (s.ay + s.by) / 2) > 1.5) continue;
      if (!seen.has(i)) { seen.add(i); acc.push({ fonte: s.dk.fonte, x: R(mx), z: R(mz), m: L }); } break;
    }
  });
  // steps: the parapets of a deck joined end to end into runs of one direction; a corner between two runs both shorter than SCATTO
  for (const dk of H.DECKS) {
    if (!dk.bar || !dk.bar.rails.length) continue;
    const E = new Map(), key = (x, z) => x.toFixed(1) + ',' + z.toFixed(1), segs = dk.bar.rails.map(q => [q[0], q[1], q[3], q[4]]);
    segs.forEach((s, i) => { for (const [x, z] of [[s[0], s[1]], [s[2], s[3]]]) { const k = key(x, z); (E.get(k) || E.set(k, []).get(k)).push(i); } });
    const dir = s => { const L = Math.hypot(s[2] - s[0], s[3] - s[1]) || 1; return [(s[2] - s[0]) / L, (s[3] - s[1]) / L]; };
    const run = (i, from) => { // length of the straight run through segment i, away from the shared point
      let n = 0, cur = i, prev = from, Lr = 0; const d0 = dir(segs[i]);
      while (cur !== null && n++ < 50) {
        const s = segs[cur], d = dir(s); if (Math.abs(d[0] * d0[0] + d[1] * d0[1]) < 0.96) break; Lr += Math.hypot(s[2] - s[0], s[3] - s[1]);
        const far = key(s[0], s[1]) === prev ? key(s[2], s[3]) : key(s[0], s[1]); const nx = (E.get(far) || []).filter(j => j !== cur); prev = far; cur = nx.length === 1 ? nx[0] : null;
      }
      return Lr;
    };
    for (const [k, l] of E) {
      if (l.length !== 2) continue; const a = dir(segs[l[0]]), b = dir(segs[l[1]]), c = Math.abs(a[0] * b[0] + a[1] * b[1]);
      if (c > 0.87) continue; // under 30 degrees: a bend, not a corner
      if (run(l[0], k) < SCATTO && run(l[1], k) < SCATTO) { const [x, z] = k.split(',').map(Number); sc.push({ fonte: dk.fonte, x, z, link: link(x, z) }); }
    }
  }
  // across a road at its own level (Carlo 8/11, the Milano-Meda at x 355 z 2017: the parapets of the end of its deck cut the carriageways): a piece of
  // parapet whose middle lies on the carriageway of a road for cars (within w/2 of its axis), across it (over 30 degrees), the road there within
  // TRAVERSO_DY m of the parapet's foot (the roads under the deck stay out)
  const D = __G.D, ND = D.nodes, nx_ = i => ND[3 * i] / 10, nz_ = i => ND[3 * i + 1] / 10, TRAVERSO_DY = 1.0, tra = [], SG = new Map(), KS = (x, z) => Math.floor(x / 20) + ',' + Math.floor(z / 20);
  D.roads.forEach(r => { if (r.t || r.c > 6) return; for (let k = 1; k < r.g.length; k++) { const ia = r.g[k - 1], ib = r.g[k], s = { r, ia, ib, ax: nx_(ia), az: nz_(ia), bx: nx_(ib), bz: nz_(ib) };
    const L = Math.hypot(s.bx - s.ax, s.bz - s.az); if (L < 0.1) continue; for (let t = 0; t <= L; t += 10) { const x = s.ax + (s.bx - s.ax) * t / L, z = s.az + (s.bz - s.az) * t / L, k_ = KS(x, z); const l = SG.get(k_) || SG.set(k_, []).get(k_); if (!l.includes(s)) l.push(s); } } });
  for (const q of rails) {
    const mx = (q.ax + q.bx) / 2, mz = (q.az + q.bz) / 2, ql = Math.hypot(q.bx - q.ax, q.bz - q.az); if (ql < 0.05) continue; const cand = new Set();
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) for (const s of SG.get((Math.floor(mx / 20) + dx) + ',' + (Math.floor(mz / 20) + dz)) || []) cand.add(s);
    for (const s of cand) {
      const fx = s.bx - s.ax, fz = s.bz - s.az, fl = Math.hypot(fx, fz), u = Math.max(0, Math.min(1, ((mx - s.ax) * fx + (mz - s.az) * fz) / (fl * fl))), px = s.ax + fx * u, pz = s.az + fz * u;
      if (Math.hypot(mx - px, mz - pz) > s.r.w / 2 || Math.abs(((q.bx - q.ax) * fx + (q.bz - q.az) * fz) / (ql * fl)) > 0.87) continue;
      const yr = H.node(s.ia) + (H.node(s.ib) - H.node(s.ia)) * u; if (Math.abs(yr - (q.ay + q.by) / 2) > TRAVERSO_DY) continue;
      tra.push({ fonte: q.dk.fonte, x: R(mx), z: R(mz) }); break;
    }
  }
  const luoghi = (A, r = 6) => { const out = []; for (const a of A) { const o = out.find(q => Math.hypot(q.x - a.x, q.z - a.z) < r && q.fonte === a.fonte); if (o) o.n++; else out.push({ ...a, n: 1, link: link(a.x, a.z) }); } return out.sort((p, q) => q.n - p.n); };
  return { ...tot, parapetti_m: R(tot.parapetti_m), accavallati_m: R(acc.reduce((s, a) => s + a.m, 0)), scatti: sc.length, in_strada: ins.length, di_traverso: tra.length,
           posti_accavallati: luoghi(acc).slice(0, 30), posti_scatti: luoghi(sc).slice(0, 30), posti_in_strada: luoghi(ins).slice(0, 30), posti_di_traverso: luoghi(tra, 15).slice(0, 30) };
});
r.definizione = 'parapetti e muri dei ponti nel gioco: accavallati = m di parapetto paralleli a un altro a 0,05-0,8 m; scatti = angoli fra due tratti dritti sotto 3 m; in_strada = muri sotto i ponti con asfalto da tutti e due i lati; di_traverso = tratti di parapetto che tagliano l asse di una strada alla loro quota (entro 1 m)';
r.soglia = 'accavallati 0, scatti 0, in_strada 0, di_traverso 0'; r.ok = !r.accavallati_m && !r.scatti && !r.in_strada && !r.di_traverso; r.errori = errs.slice(0, 5);
let rep = {}; try { rep = JSON.parse(fs.readFileSync(out, 'utf8')); } catch (e) {}
rep.barriere = r; fs.writeFileSync(out, JSON.stringify(rep, null, 1));
console.log('barriere dei ponti: %d impalcati, parapetti %d m, accavallati %d m, scatti %d, muri in carreggiata %d, parapetti di traverso a una strada %d (%d ponti) %s', r.decks, r.parapetti_m, r.accavallati_m, r.scatti, r.in_strada, r.di_traverso, new Set(r.posti_di_traverso.map(p => p.fonte)).size,
  [...r.posti_accavallati.slice(0, 4), ...r.posti_scatti.slice(0, 4), ...r.posti_in_strada.slice(0, 4), ...r.posti_di_traverso.slice(0, 8)].map(p => p.fonte + ' ' + p.link).join(', '));
await browser.close();
