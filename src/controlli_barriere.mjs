// The checks of the barriers (lisciatore, phase 2, docs/motore.md): the foot of every barrier of the map as the game draws it, measured in the game itself (headless) every 2 m
// along the lines. They go in report_barriere.json, next to the holes towards the tracks the build wrote there (src/barriere.py varchi_binari).
//   node src/controlli_barriere.mjs [http://127.0.0.1:8093/] [report_barriere.json]
//   PLAYWRIGHT=<path of playwright/index.mjs> if it is not installed here; CHROME=<path of chrome.exe>; prima: PAGINA=<a page with the old game> OUT=<another file>
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
const url = process.argv[2] || 'http://127.0.0.1:8013/', out = process.env.OUT || process.argv[3] || 'report_barriere.json';
const { chromium } = await import(process.env.PLAYWRIGHT ? pathToFileURL(path.resolve(process.env.PLAYWRIGHT)).href : 'playwright');
const LIM = { dente_oltre_15cm_km: 0.5, fondo_sospeso_oltre_10cm_km: 0, salgono_oltre_50cm_sotto_20m: 800, sepolte_oltre_25cm_km: 1.5, varchi_da_chiudere: 0 };
const browser = await chromium.launch({ executablePath: process.env.CHROME || undefined, args: ['--use-angle=d3d11', '--ignore-gpu-blocklist', '--enable-gpu'] });
const page = await browser.newPage({ viewport: { width: 640, height: 360 } }); const errs = [];
page.on('pageerror', e => errs.push(e.message));
await page.goto(url + (process.env.PAGINA || ''));
await page.waitForFunction(() => { const b = document.getElementById('go'); return b && !b.disabled; }, null, { timeout: 180000 });
await page.evaluate(() => document.getElementById('go').click()); await page.waitForFunction(() => window.__G && __G.P, null, { timeout: 180000 });
const r = await page.evaluate(() => {
  const G = __G, H = G.H, ST = 2, R = v => Math.round(v * 100) / 100;
  const nw = { linee: 0, m: 0, d15: 0, d30: 0, s25: 0, s50: 0, r25: 0, c25: 0, r50: 0, c50: 0, fl: 0, bu: 0 }, ti = {}, ld = [], ls = [];
  const each = (pts, t) => {
    let Ln = 0; const S = [0]; for (let k = 1; k < pts.length; k++) { Ln += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); S.push(Ln); }
    nw.linee++; nw.m += Ln; if (Ln < 2) return; const q = ti[t] || (ti[t] = { m: 0, d15: 0, s50: 0 }); q.m += Ln;
    const net = t === 5 || t === 7, nuovo = pts[0].pl !== undefined; // the nets: on a retaining wall along a true bank, or down to the ground; the game of before: a plinth by segment
    const n = Math.floor(Ln / ST), Y = [], X = [], Z = [], B = []; let j = 0;
    for (let i = 0; i <= n; i++) {
      const u = i * ST; while (j < pts.length - 2 && S[j + 1] < u) j++; const d = S[j + 1] - S[j], f = d > 1e-6 ? Math.min(1, (u - S[j]) / d) : 0, a = pts[j], c = pts[j + 1];
      Y.push(a.fy + (c.fy - a.fy) * f); X.push(a[0] + (c[0] - a[0]) * f); Z.push(a[1] + (c[1] - a[1]) * f);
      const la = Math.min(a.lo, a.fy), lc = Math.min(c.lo, c.fy); let ba = la - 0.3, bc = lc - 0.3;
      if (net) { if (nuovo) { if (!(a.pl || c.pl)) { ba = Math.min(a.fy, la - 0.1); bc = Math.min(c.fy, lc - 0.1); } } else if (!(a.fy - la > 0.25 || c.fy - lc > 0.25)) { ba = a.fy; bc = c.fy; } }
      B.push(ba + (bc - ba) * f);
    }
    for (let i = 1; i < n; i++) { const a = Y[i] - Y[i - 1], b = Y[i + 1] - Y[i], D = Math.abs(Y[i] - (Y[i - 1] + Y[i + 1]) / 2); if (a * b < 0 && D > 0.15) { nw.d15 += ST; q.d15 += ST; if (ld.length < 400) ld.push([Math.round(X[i]), Math.round(Z[i]), R(D), t]); if (D > 0.3) nw.d30 += ST; } }
    for (let i = 0; i <= n; i++) { const g = H.ground(X[i], Z[i]); if (B[i] - g > 0.1) nw.fl += ST; if (Y[i] - g < -0.25) nw.bu += ST; }
    for (const [th, sk, rk, ck] of [[0.25, 's25', 'r25', 'c25'], [0.5, 's50', 'r50', 'c50']]) { let run = 0; const end = i => { if (run > 0) { nw[rk]++; if (run < 20) nw[ck]++; if (th === 0.5 && ls.length < 800) ls.push([Math.round(X[Math.max(0, i - 1)]), Math.round(Z[Math.max(0, i - 1)]), run, t]); } run = 0; }; for (let i = 0; i <= n; i++) { const up = Y[i] - H.ground(X[i], Z[i]) > th; if (up) { run += ST; nw[sk] += ST; if (th === 0.5) q.s50 += ST; } else end(i); } end(n + 1); }
  };
  // the ground on the two sides of the railway fences, 0.5 m from the line: the teeth where a street or the rail bed meets the wall
  let bm = 0, bd = 0; const suolo = pts => { let Ln = 0; const S = [0]; for (let k = 1; k < pts.length; k++) { Ln += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]); S.push(Ln); } const n = Math.floor(Ln / ST); if (n < 2) return; for (const sg of [1, -1]) { const y = []; let j = 0; for (let i = 0; i <= n; i++) { const u = i * ST; while (j < pts.length - 2 && S[j + 1] < u) j++; const d = S[j + 1] - S[j], f = d > 1e-6 ? Math.min(1, (u - S[j]) / d) : 0, a = pts[j], c = pts[j + 1], L = d || 1; y.push(H.ground(a[0] + (c[0] - a[0]) * f + (c[1] - a[1]) / L * 0.5 * sg, a[1] + (c[1] - a[1]) * f - (c[0] - a[0]) / L * 0.5 * sg)); } for (let i = 1; i < n; i++) { bm += ST; const p = y[i] - y[i - 1], q = y[i + 1] - y[i]; if (p * q < 0 && Math.abs(y[i] - (y[i - 1] + y[i + 1]) / 2) > 0.15) bd += ST; } } };
  for (const T of G.TILES) { for (const b of T.ba || []) each(b.pts, b.t); for (const p of T.fe) each(p, 'fe'); }
  for (const T of G.TILES) { for (const b of T.ba || []) if (b.t === 6) suolo(b.pts); for (const p of T.fe) suolo(p); }
  const km = v => R(v / 1000);
  return { definizione: 'la quota del piede come la disegna il gioco, ogni 2 m lungo la linea. Dente: un punto fuori dalla media dei vicini a 2 m oltre la soglia, e che sale e scende. Salgono: piede sopra il suolo. Sospeso: fondo del disegno sopra il suolo. Sepolte: piede sotto il suolo', linee: nw.linee, km: km(nw.m),
    dente_oltre_15cm_km: km(nw.d15), dente_oltre_30cm_km: km(nw.d30),
    salgono_oltre_25cm: { km: km(nw.s25), tratti: nw.r25, sotto_20m: nw.c25 }, salgono_oltre_50cm: { km: km(nw.s50), tratti: nw.r50, sotto_20m: nw.c50 },
    suolo_accanto_alle_recinzioni_ferroviarie: { km_lati: km(bm), dente_oltre_15cm_km: km(bd) },
    fondo_sospeso_oltre_10cm_km: km(nw.fl), sepolte_oltre_25cm_km: km(nw.bu),
    per_tipo: Object.fromEntries(Object.entries(ti).map(([k, v]) => [k, { km: km(v.m), dente_km: km(v.d15), salgono_oltre_50cm_km: km(v.s50) }])),
    tratti_sul_ciglio: window.__BAR_T || null, luoghi_dente: ld, luoghi_salgono_oltre_50cm: ls };
});
await browser.close();
const rep = fs.existsSync(out) ? JSON.parse(fs.readFileSync(out, 'utf-8')) : {};
const P = process.env.PRIMA && fs.existsSync(process.env.PRIMA) ? JSON.parse(fs.readFileSync(process.env.PRIMA, 'utf-8')).piedi : null;
rep.piedi = r; if (P) { const { tratti_sul_ciglio, luoghi_dente, luoghi_salgono_oltre_50cm, ...q } = P; rep.piedi_prima = q; }
const v = rep.varchi_verso_i_binari, c = rep.controlli = { limiti: LIM, errori_pagina: errs,
  dente_ok: r.dente_oltre_15cm_km <= LIM.dente_oltre_15cm_km, sospese_ok: r.fondo_sospeso_oltre_10cm_km <= LIM.fondo_sospeso_oltre_10cm_km, salgono_corti_ok: r.salgono_oltre_50cm.sotto_20m <= LIM.salgono_oltre_50cm_sotto_20m, sepolte_ok: r.sepolte_oltre_25cm_km <= LIM.sepolte_oltre_25cm_km,
  varchi_ok: !v || !v.da_chiudere };
c.ok = !errs.length && c.dente_ok && c.sospese_ok && c.salgono_corti_ok && c.sepolte_ok && c.varchi_ok;
fs.writeFileSync(out, JSON.stringify(rep, null, 0));
const { tratti_sul_ciglio, luoghi_dente, luoghi_salgono_oltre_50cm, definizione, ...stampa } = r; console.log(JSON.stringify(stampa)); console.log('ciglio', tratti_sul_ciglio && tratti_sul_ciglio.length, 'controlli', JSON.stringify(c));
