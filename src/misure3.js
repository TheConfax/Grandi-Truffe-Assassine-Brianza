/* misure del fotogramma (debug, &debug=1): valori mediati su circa 1 secondo, nella riga #dbgmis sopra quella di debug.
   A debug spento non gira niente: frame() non chiama queste funzioni e le query GPU vengono tolte.
   Tasto K (solo debug): copia la riga negli appunti. Tasto B: la riga finisce nella segnalazione (campo "misure"). */
renderer.info.autoReset = false; /* three zeroes the counts at every render (scene, shadows, reflection, each pass): the row showed only the last pass (SMAA, 1 call). Zeroed once a frame at the top of frame() instead: calls and triangles of the whole frame */
const MIS = { log: null, f: { sim: 0, tile: 0, vis: 0, draw: 0 }, a: { sim: 0, tile: 0, vis: 0, draw: 0 }, n: 0, sum: 0, max: 0, prev: 0, t0: 0, t1: 0, gpuSum: 0, gpuN: 0, txt: 'misure: in raccolta…', out: null, el: null, gpu: undefined, qs: [], cur: null };
function dbgBegin(t) {
  const now_ = performance.now(); MIS.t0 = now_;
  if (!MIS.el) { const e = document.createElement('div'); e.id = 'dbgmis'; e.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:30px;z-index:8;font:12px ui-monospace,monospace;color:#9fe;background:rgba(0,0,0,.6);padding:3px 8px;border-radius:4px;pointer-events:none;white-space:pre;max-width:calc(100vw - 32px);overflow:hidden'; document.body.appendChild(e); MIS.el = e; }
  MIS.el.hidden = false;
  if (MIS.prev) { const d = t - MIS.prev; if (d > 0 && d < 2000) { MIS.n++; MIS.sum += d; if (d > MIS.max) MIS.max = d; } }
  MIS.prev = t; if (!MIS.t1) MIS.t1 = now_;
  return MIS;
}
function dbgMk(m, k) { const n = performance.now(); m.a[k] += n - m.t0; m.f[k] += n - m.t0; m.t0 = n; }
function dbgGpuBegin() {
  const M = MIS;
  if (M.gpu === undefined) { const gl = renderer.getContext(); M.gl = gl; M.ext = gl.createQuery && gl.getExtension('EXT_disjoint_timer_query_webgl2'); M.gpu = !!M.ext; }
  if (!M.gpu || M.qs.length >= 6) return 0;
  const q = M.gl.createQuery(); M.gl.beginQuery(M.ext.TIME_ELAPSED_EXT, q); M.cur = q; return 1;
}
function dbgGpuEnd(b) { if (!b) return; MIS.gl.endQuery(MIS.ext.TIME_ELAPSED_EXT); MIS.qs.push(MIS.cur); MIS.cur = null; }
function dbgEnd(m) {
  { const f = m.f; if (m.log) m.log.push([performance.now(), f.sim, f.tile, f.vis, f.draw, renderer.info.render.calls]); f.sim = f.tile = f.vis = f.draw = 0; } /* MIS.log = []: one row a frame, for the scripts */
  if (m.gpu) { const gl = m.gl; while (m.qs.length && gl.getQueryParameter(m.qs[0], gl.QUERY_RESULT_AVAILABLE)) { const q = m.qs.shift(); if (!gl.getParameter(m.ext.GPU_DISJOINT_EXT)) { m.gpuSum += gl.getQueryParameter(q, gl.QUERY_RESULT) / 1e6; m.gpuN++; } gl.deleteQuery(q); } }
  const now_ = performance.now(); if (now_ - m.t1 < 1000 || !m.n) return;
  const n = m.n, f = x => (x / n).toFixed(1), cpu = m.a.sim + m.a.tile + m.a.vis + m.a.draw, avg = m.sum / n, inf = renderer.info;
  let tr = 0, tv = 0; for (const T of TILES) if (T.ready) { tr++; if (T.group && T.group.visible) tv++; }
  let aw = 0; for (const v of VEH) if (!v.sleep) aw++; let pd = 0; for (const p of PEDS) if (p.state !== 'dead') pd++;
  const gpu = m.gpu ? (m.gpuN ? (m.gpuSum / m.gpuN).toFixed(1) + ' ms' : 'GPU in attesa') : 'GPU n/d';
  const o = m.out = { fps: +(1000 / avg).toFixed(1), ms: +avg.toFixed(2), msMax: +m.max.toFixed(1), cpu: +(cpu / n).toFixed(2), sim: +(m.a.sim / n).toFixed(2), tile: +(m.a.tile / n).toFixed(2), vis: +(m.a.vis / n).toFixed(2), draw: +(m.a.draw / n).toFixed(2), attesa: +Math.max(0, avg - cpu / n).toFixed(2), gpuMs: m.gpu && m.gpuN ? +(m.gpuSum / m.gpuN).toFixed(2) : null, chiamate: inf.render.calls, triangoli: inf.render.triangles, programmi: inf.programs ? inf.programs.length : 0, geometrie: inf.memory.geometries, texture: inf.memory.textures, tileMesh: tr, tileVisibili: tv, auto: VEH.length, autoSveglie: aw, pedoni: pd, modo: P.mode };
  m.txt = o.fps + ' fps · fotogramma ' + o.ms + ' ms (peggiore ' + o.msMax + ')\nCPU ' + o.cpu + ' ms = sim ' + f(m.a.sim) + ' + tile ' + f(m.a.tile) + ' + resto ' + f(m.a.vis) + ' + disegno ' + f(m.a.draw) + ' · attesa ' + o.attesa + ' · ' + (m.gpu ? (m.gpuN ? 'GPU ' + gpu : gpu) : gpu) + '\n' + o.chiamate + ' chiamate · ' + (o.triangoli / 1000).toFixed(0) + 'k triangoli · ' + o.programmi + ' programmi · tile ' + tr + ' (' + tv + ' visibili) · auto ' + aw + '/' + VEH.length + ' · pedoni ' + pd + ' · ' + o.modo;
  m.el.textContent = m.txt;
  m.a.sim = m.a.tile = m.a.vis = m.a.draw = 0; m.n = 0; m.sum = 0; m.max = 0; m.gpuSum = 0; m.gpuN = 0; m.t1 = now_;
}
function dbgOff() { /* debug spento: via le query GPU e la riga */
  const M = MIS; if (M.el) M.el.hidden = true; if (M.qs.length) { for (const q of M.qs) M.gl.deleteQuery(q); M.qs.length = 0; } M.prev = 0; M.t1 = 0; M.n = 0; M.sum = 0; M.max = 0; M.a.sim = M.a.tile = M.a.vis = M.a.draw = 0; M.gpuSum = 0; M.gpuN = 0;
}
function dbgCopy() { try { navigator.clipboard.writeText(MIS.txt).then(() => toast('📋 Misure copiate negli appunti')).catch(() => toast('Misure: copia non riuscita (B le salva nella segnalazione)')); } catch (e) { } }
