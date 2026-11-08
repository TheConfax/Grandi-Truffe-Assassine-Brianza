// ---------------------------------------------------------------- facciate 2.0 (Carlo 8/11: "gli edifici si assomigliano tutti")
// Eight families from the data (build: src/famiglie.py, b.fa; the public ones b.pu, src/pubblici.py), the epoch of construction (b.ep, CENED) and three
// variants per family and epoch (picked by the building's number). Each variant is a set of cells of one atlas: a cell is one bay by one floor, drawn
// once on a canvas (colour) and on a twin canvas of masks (r: glass, b: how much of the wall colour it takes). A wall carries the codes of its cells:
// U the floors, G the lowest floor, P the bare wall (no window there); front walls (looking onto a street) and the others may use different cells.
// Near the player (FAC_R) the windows are 3D: the wall opens where the window is (the shader drops those pixels) and behind it stand the reveal, the
// frame and the glass; the shutters, the sills, the roller blinds stand on and in it; the balconies are 3D a little further (FAC_RB). Further away the
// painted cell, as before. The 3D parts are instanced: every few metres the windows round the camera are written into one mesh per part
const FAC_R = 72, FAC_RB = 150, FAC_FL = 3.1;
const FAC_COLS = 8, FAC_ROWS = 16, FAC_CPX = 256, FAC_PAD = 8, FAC_IN = FAC_CPX - 2 * FAC_PAD;
const FAC_EP_NOMI = ['A', 'B', 'C', 'D'];
// ---- the windows, the balconies, the materials of the cells. Sizes in metres; u in the bay 0..1 (centre of the window), lo/hi over the floor
const FW = (o = {}) => Object.assign({ u: 0.5, w: 1.0, lo: 0.95, hi: 2.35, fr: '#ece9e2', sh: 'no', shc: '#3f6a4a', sill: '#dcd6c8', mul: true }, o);
const FB = (o = {}) => Object.assign({ u0: 0, u1: 1, d: 1.2, rail: 'fe', rc: '#2b2d2f' }, o);
const VERDE = '#3f6a4a', MARRONE = '#5b3a26', LEGNO = '#6b4a2e', ANTR = '#2e3133', BIANCO = '#ece9e2', PIETRA = '#e2dccd', MATT = '#a65a3e';
// a style: tile (bay width), pal (wall colours), f: front cells {U, G, P}, b: back cells (default f); ang: balconies on the corner bays of the front;
// bc: small stone balconies on the first floor, one bay out of two
const FAC_STILI = (() => {
  const pl = (o = {}) => Object.assign({ base: 'pl' }, o);
  const PAL = {
    corte: ['#e8c98a', '#dfae62', '#e3b98f', '#dba08a', '#f0dcb0', '#d99060', '#ece4d3', '#e6c9a0', '#c7c9a6'],
    vilB: ['#efe6d2', '#e9dcc0', '#f2e2b8', '#e6d0b0', '#ddd6c8', '#f0d8c0', '#e8e0cc'], vilC: ['#f3e9d8', '#efd9c4', '#f2e0c8', '#e9d8c6', '#f5efe4', '#ead2b8'],
    vilD1: ['#f6f5f1', '#f2f1ec', '#eeede8'], vilD2: ['#bfc0bd', '#a9aba8', '#cfd0cc', '#b4b2ad'], vilD3: ['#f4f3ef', '#e8e6e0', '#d8d6d0'],
    palB: ['#e8dcc4', '#ddd2ba', '#d6cbb4', '#e4d8be', '#cfc6b2', '#e9d6b8', '#d8cfc0'], palC: ['#efe2cc', '#ecd6c0', '#e8d4b8', '#f0e6d6', '#e2cdb4'], palD: ['#f5f4f0', '#efeeea', '#e4e2dc', '#d9d8d3'],
    altC: ['#e6ddcc', '#ddd3c0', '#e9e1d1', '#d8cfbf'], altD: ['#f2f1ed', '#e6e5e1', '#d4d6d6'],
    lam: ['#a9adb0', '#9aa3a8', '#b8bcbc', '#8e979c', '#c4c1b8'], cem: ['#c8c3b8', '#bab5aa', '#d2cdc2'], box: ['#d8d2c4', '#cfc9bb', '#bdb7aa', '#e0dbd0'], com: ['#d9d9d6', '#c8cacb', '#e6e4de']
  };
  const S = {};
  // casa in linea / di corte: before 1945 only
  S.corte = { A: [
    { tile: 3.4, pal: PAL.corte, f: { U: pl({ w: [FW({ sh: 'pe', shc: VERDE, sill: PIETRA })] }), G: pl({ w: [FW({ lo: 1.0, sh: 'pe', shc: VERDE, sill: PIETRA })] }) },
      b: { U: pl({ w: [FW({ w: 0.9, lo: 0.04, hi: 2.3, sh: 'pe', shc: VERDE, sill: null, bal: FB({ d: 1.25, rc: '#2a2c2e' }) })] }), G: pl({ w: [FW({ lo: 1.0, sh: 'pe', shc: VERDE, sill: PIETRA })] }) }, door: 'leg' },
    { tile: 3.2, pal: PAL.corte, f: { U: pl({ w: [FW({ w: 0.95, sh: 'pe', shc: MARRONE, fr: LEGNO, sill: PIETRA })] }), G: pl({ w: [FW({ w: 0.95, lo: 1.0, sh: 'pe', shc: MARRONE, fr: LEGNO, sill: PIETRA })] }) }, door: 'leg' },
    { tile: 3.6, pal: PAL.corte, bc: { d: 0.6, rail: 'pi', rc: '#e6e0d0' }, f: { U: pl({ mp: '#ece6d6', w: [FW({ w: 1.1, lo: 0.8, hi: 2.55, sh: 'pe', shc: '#4d5b4a', sill: '#ece6d6', cor: '#ece6d6' })] }),
      G: { base: 'bu', w: [FW({ w: 1.0, lo: 1.0, hi: 2.4, fr: LEGNO, sill: '#ece6d6', cor: '#ece6d6' })] }, P: pl({ mp: '#ece6d6' }) }, door: 'leg' },
  ] };
  S.vil = {
    B: [
      { tile: 3.6, pal: PAL.vilB, f: { U: pl({ w: [FW({ w: 1.2, lo: 0.04, hi: 2.3, sh: 'ta', shc: '#d9cfb8', sill: null, bal: FB({ u0: 0.12, u1: 0.88, d: 0.9, rc: ANTR }) })] }), G: pl({ w: [FW({ w: 1.2, hi: 2.3, sh: 'ta', shc: '#d9cfb8', sill: '#d8d4ca' })] }) },
        b: { U: pl({ w: [FW({ w: 1.2, hi: 2.3, sh: 'ta', shc: '#d9cfb8', sill: '#d8d4ca' })] }) }, door: 'vil' },
      { tile: 3.6, pal: PAL.vilB, ang: { d: 1.2, rail: 'fe', rc: ANTR }, f: { U: pl({ w: [FW({ w: 1.1, sh: 'pe', shc: LEGNO, fr: LEGNO })] }), G: pl({ w: [FW({ w: 1.1, sh: 'pe', shc: LEGNO, fr: LEGNO })] }) }, door: 'vil' },
      { tile: 3.6, pal: PAL.vilB, f: { U: pl({ w: [FW({ w: 1.2, hi: 2.3, sh: 'ta', shc: '#8a6a4a', fr: LEGNO })] }), G: pl({ gar: { w: 2.4, h: 2.2, col: '#cfccc4' } }) },
        b: { U: pl({ w: [FW({ w: 1.2, hi: 2.3, sh: 'ta', shc: '#8a6a4a', fr: LEGNO })] }), G: pl({ w: [FW({ w: 0.8, lo: 1.2, hi: 2.2, sh: 'no', fr: LEGNO })] }) }, door: 'vil', steps: 3 },
    ],
    C: [
      { tile: 3.6, pal: PAL.vilC, f: { U: pl({ w: [FW({ w: 1.1, sh: 'pe', shc: LEGNO, fr: LEGNO, sill: '#d8d2c4' })] }), G: { base: 'br', arc: 1 } }, b: { G: { base: 'br', w: [FW({ w: 1.1, sh: 'pe', shc: LEGNO, fr: LEGNO, sill: '#d8d2c4' })] } }, door: 'vil' },
      { tile: 3.6, pal: PAL.vilC, f: { U: pl({ w: [FW({ w: 1.1, lo: 0.04, hi: 2.3, sh: 'pe', shc: '#7a5232', fr: '#7a5232', sill: null, bal: FB({ u0: 0.1, u1: 0.9, d: 1.0, rail: 'le', rc: '#7a5232' }) })] }),
        G: pl({ w: [FW({ w: 1.1, sh: 'pe', shc: '#7a5232', fr: '#7a5232' })] }) }, b: { U: pl({ w: [FW({ w: 1.1, sh: 'pe', shc: '#7a5232', fr: '#7a5232' })] }) }, door: 'vil' },
      { tile: 3.6, pal: PAL.vilC, f: { U: pl({ w: [FW({ w: 1.2, sh: 'ta', shc: '#c9c0ad', fr: '#f0eee8' })] }), G: pl({ gar: { w: 2.5, h: 2.25, col: '#d9d6cf' } }) },
        b: { G: pl({ w: [FW({ w: 1.2, sh: 'ta', shc: '#c9c0ad', fr: '#f0eee8' })] }) }, door: 'vil' },
    ],
    D: [
      { tile: 3.8, pal: PAL.vilD1, f: { U: pl({ w: [FW({ w: 1.4, lo: 0.7, hi: 2.4, fr: ANTR, sill: '#3a3d40' })] }), G: pl({ w: [FW({ w: 1.6, lo: 0.1, hi: 2.4, fr: ANTR, sill: null })] }) }, door: 'vil' },
      { tile: 3.6, pal: PAL.vilD2, f: { U: pl({ wood: [0.0, 0.32], w: [FW({ u: 0.64, w: 1.0, lo: 0.8, hi: 2.3, fr: ANTR, sill: '#3a3d40' })] }), G: pl({ wood: [0.0, 0.32], w: [FW({ u: 0.64, w: 1.0, lo: 0.8, hi: 2.3, fr: ANTR, sill: '#3a3d40' })] }) }, door: 'vil' },
      { tile: 3.8, pal: PAL.vilD3, f: { U: pl({ w: [FW({ w: 1.3, lo: 0.8, hi: 2.3, sh: 've', shc: '#8a8d90', fr: ANTR, sill: '#3a3d40' })] }), G: pl({ w: [FW({ w: 3.0, lo: 0.08, hi: 2.55, fr: ANTR, sill: null, fins: 1 })] }) },
        b: { G: pl({ w: [FW({ w: 1.3, lo: 0.8, hi: 2.3, sh: 've', shc: '#8a8d90', fr: ANTR, sill: '#3a3d40' })] }) }, door: 'vil' },
    ] };
  const nastro = (o, b) => pl(Object.assign({ w: [FW(Object.assign({ lo: 0.04, hi: 2.35, sill: null, bal: FB(b) }, o))] }));
  S.pal = {
    B: [
      { tile: 3.4, pal: PAL.palB, f: { U: nastro({ sh: 'ta', shc: '#d4cbb7', fr: '#e8e5de' }, {}), G: pl({ w: [FW({ w: 1.1, sh: 'ta', shc: '#d4cbb7', fr: '#e8e5de' })] }) }, door: 'all' },
      { tile: 6.6, pal: PAL.palB, f: { U: { base: 'gr', w: [FW({ u: 0.27, lo: 0.04, sh: 'ta', shc: '#cbbfa6', sill: null, bal: FB({ u0: 0.07, u1: 0.47, d: 1.1 }) }), FW({ u: 0.75, w: 1.1, sh: 'ta', shc: '#cbbfa6' })] },
        G: { base: 'gr', w: [FW({ u: 0.27, w: 1.1, sh: 'ta', shc: '#cbbfa6' }), FW({ u: 0.75, w: 1.1, sh: 'ta', shc: '#cbbfa6' })] }, P: { base: 'gr' } }, door: 'all' },
      { tile: 3.4, pal: PAL.palB, f: { U: pl({ w: [FW({ w: 1.1, sh: 'ta', shc: '#d4cbb7' })] }), G: pl({ w: [FW({ w: 1.1, sh: 'ta', shc: '#d4cbb7' })] }) },
        b: { U: nastro({ w: 0.9, sh: 'ta', shc: '#d4cbb7' }, { d: 1.4 }) }, door: 'all' },
    ],
    C: [
      { tile: 3.4, pal: PAL.palC, f: { U: { base: 'br', w: [FW({ lo: 0.04, hi: 2.3, sh: 'ta', shc: '#7a5a40', fr: MARRONE, sill: null, bal: FB({ rail: 'pi', rc: MATT }) })] },
        G: { base: 'br', w: [FW({ w: 1.1, hi: 2.3, sh: 'ta', shc: '#7a5a40', fr: MARRONE, sill: '#cfc8b8' })] }, P: { base: 'br' } }, door: 'all' },
      { tile: 3.4, pal: PAL.palC, f: { U: pl({ two: 1, lg: { w: 2.5, d: 1.3, rail: 'pi', rc: null } }), G: pl({ two: 1, w: [FW({ w: 1.1, sh: 'ta', shc: '#bfb5a2' })] }), P: pl({ two: 1 }) }, door: 'all' },
      { tile: 3.4, pal: PAL.palC, f: { U: pl({ w: [FW({ w: 1.2, sh: 'ta', shc: '#bcb3a0', bow: 1 })] }), G: { base: 'br', w: [FW({ w: 1.1, sh: 'ta', shc: '#bcb3a0', sill: '#cfc8b8' })] } }, door: 'all' },
    ],
    D: [
      { tile: 3.6, pal: PAL.palD, f: { U: nastro({ w: 1.4, hi: 2.45, fr: ANTR }, { d: 1.5, rail: 've', rc: '#9fb3b8' }), G: pl({ w: [FW({ w: 1.4, lo: 0.5, hi: 2.45, fr: ANTR, sill: '#3a3d40' })] }) }, door: 'all' },
      { tile: 3.6, pal: PAL.palD, f: { U: pl({ lg: { w: 2.8, d: 1.8, rail: 'me', rc: '#3a3d40' } }), G: pl({ w: [FW({ w: 1.4, lo: 0.5, hi: 2.45, fr: ANTR, sill: '#3a3d40' })] }) }, door: 'all' },
      { tile: 3.6, pal: PAL.palD, f: { U: { base: 'pn', w: [FW({ w: 3.6, lo: 0.9, hi: 2.3, fr: '#8a8d90', sill: '#8a8d90', rib: 1 })] }, G: { base: 'pn', w: [FW({ w: 3.6, lo: 0.6, hi: 2.4, fr: '#8a8d90', sill: null, rib: 1 })] }, P: { base: 'pn' } }, door: 'all' },
    ] };
  S.alto = {
    C: [
      { tile: 3.3, pal: PAL.altC, f: { U: nastro({ sh: 'ta', shc: '#cfc6b3' }, { d: 1.3, rail: 'pi', rc: null }), G: pl({ w: [FW({ w: 1.1, sh: 'ta', shc: '#cfc6b3' })] }) }, door: 'all' },
      { tile: 3.3, pal: PAL.altC, f: { U: pl({ lg: { w: 2.4, d: 1.4, rail: 'fe', rc: '#2b2d2f' } }), G: pl({ w: [FW({ w: 1.1, sh: 'ta', shc: '#cfc6b3' })] }) }, door: 'all' },
      { tile: 3.3, pal: PAL.altC, ang: { d: 1.5, rail: 'pi', rc: MATT }, f: { U: { base: 'br', w: [FW({ sh: 'ta', shc: '#7a5a40', fr: MARRONE, sill: '#cfc8b8' })] }, G: { base: 'br', w: [FW({ sh: 'ta', shc: '#7a5a40', fr: MARRONE, sill: '#cfc8b8' })] }, P: { base: 'br' } }, door: 'all' },
    ],
    D: [
      { tile: 3.6, pal: PAL.altD, f: { U: nastro({ w: 1.6, hi: 2.5, fr: ANTR }, { d: 1.6, rail: 've', rc: '#9fb3b8' }), G: pl({ w: [FW({ w: 1.6, lo: 0.4, hi: 2.5, fr: ANTR, sill: null })] }) }, door: 'all' },
      { tile: 3.6, pal: PAL.altD, f: { U: pl({ lg: { w: 2.8, d: 1.8, rail: 'me', rc: '#3a3d40' } }), G: pl({ w: [FW({ w: 1.6, lo: 0.4, hi: 2.5, fr: ANTR, sill: null })] }) }, door: 'all' },
      { tile: 3.6, pal: PAL.altD, f: { U: { base: 'pn', w: [FW({ w: 3.6, lo: 0.9, hi: 2.3, fr: '#8a8d90', sill: '#8a8d90', rib: 1 })] }, G: { base: 'pn', w: [FW({ w: 3.6, lo: 0.4, hi: 2.4, fr: '#8a8d90', sill: null, rib: 1 })] }, P: { base: 'pn' } }, door: 'all' },
    ] };
  S.cap = { X: [
    { tile: 4, pal: PAL.lam, f: { P: { base: 'lm' } }, door: 'met' },
    { tile: 4, pal: PAL.cem, f: { P: { base: 'cm' } }, door: 'met' },
    { tile: 3.0, pal: PAL.com, f: { U: { base: 'pn', w: [FW({ w: 3.0, lo: 0.9, hi: 2.3, fr: '#8a8d90', sill: '#8a8d90', rib: 1 })] }, G: { base: 'pn', w: [FW({ w: 3.0, lo: 0.9, hi: 2.3, fr: '#8a8d90', sill: '#8a8d90', rib: 1 })] }, P: { base: 'pn' } }, b: { U: null, G: null, P: { base: 'lm' } }, door: 'met' },
  ] };
  S.com = { X: [
    { tile: 3.0, pal: PAL.com, f: { U: { base: 'pn', w: [FW({ w: 3.0, lo: 0.95, hi: 2.4, fr: '#7d8085', sill: '#7d8085', rib: 1 })] }, G: { base: 'pn', w: [FW({ w: 3.0, lo: 0.3, hi: 2.6, fr: '#7d8085', sill: null, rib: 1 })] }, P: { base: 'pn' } }, door: 'all' },
    { tile: 3.0, pal: PAL.com, f: { U: { base: 'pl', cw: 1, w: [FW({ w: 3.0, lo: 0.0, hi: 3.1, fr: '#5d6166', sill: null, rib: 1, cw: 1 })] }, G: { base: 'pl', cw: 1, w: [FW({ w: 3.0, lo: 0.0, hi: 3.1, fr: '#5d6166', sill: null, rib: 1, cw: 1 })] } }, door: 'all' },
    { tile: 3.4, pal: PAL.com, f: { U: pl({ w: [FW({ w: 1.6, lo: 0.8, hi: 2.5, fr: ANTR, sill: '#3a3d40' })] }), G: pl({ w: [FW({ w: 2.2, lo: 0.3, hi: 2.6, fr: ANTR, sill: null })] }) }, door: 'all' },
  ] };
  S.box = { X: [{ tile: 4, pal: PAL.box, f: { P: pl() }, door: 'met' }, { tile: 4, pal: PAL.box, f: { P: { base: 'cb' } }, door: 'met' }, { tile: 4, pal: PAL.box, f: { P: { base: 'br' } }, door: 'met' }] };
  S.pub = { W: [{ tile: 3.6, pal: ['#ff1fa8'], f: { U: pl({ w: [FW({ w: 1.3, lo: 0.9, hi: 2.4, fr: '#f2f0ea', sill: '#e8e4dc' })] }), G: pl({ w: [FW({ w: 1.3, lo: 0.9, hi: 2.4, fr: '#f2f0ea', sill: '#e8e4dc' })] }) }, door: 'all' }],
    N: [{ tile: 3.6, pal: ['#ff1fa8'], f: { P: pl() }, door: 'leg' }] };
  S.rud = { X: [{ tile: 4, pal: ['#a39a8b', '#9c9284', '#aaa08e'], f: { P: { base: 'pl' } }, door: 'met' }] };
  return S;
})();
// ---- the atlas: every distinct cell once
const FAC_CELLS = [], FAC_CELL_KEY = new Map();
function facCell(spec, tile) {
  if (!spec) return -1;
  const key = JSON.stringify(spec) + '|' + tile; if (FAC_CELL_KEY.has(key)) return FAC_CELL_KEY.get(key);
  const id = FAC_CELLS.length; FAC_CELLS.push({ spec, tile }); FAC_CELL_KEY.set(key, id); return id;
}
// every style gets its cells, its window shapes (fw for the bays of world3.js) and its codes per side
(() => {
  for (const fam in FAC_STILI) for (const band in FAC_STILI[fam]) for (const st of FAC_STILI[fam][band]) {
    st.fam = fam; st.band = band;
    for (const side of ['f', 'b']) {
      const src = side === 'f' ? st.f : Object.assign({}, st.f, st.b || {}), P = src.P || { base: (src.U || src.G || { base: 'pl' }).base, mp: (src.U || {}).mp, two: (src.U || {}).two };
      const U = src.U === undefined ? null : src.U, G = src.G === undefined ? U : src.G;
      const cP = facCell(P, st.tile), cU = U ? facCell(U, st.tile) : -1, cG = G ? facCell(G, st.tile) : cU;
      const win = (U || G) ? ((U || G).w || []) : [], lg = (U || G) ? (U || G).lg : null;
      /* fw for the bays: window bottom and top over the floor, its sides in the bay (with the shutters): the first window, or the loggia */
      let fw = null;
      if (win.length) { const w0 = win[0], k = w0.sh === 'pe' ? 1 : 0.5, half = Math.min(0.5, w0.w * (0.5 + 0.5 * k) / st.tile); fw = [w0.lo, w0.hi, Math.max(0, w0.u - half), Math.min(1, w0.u + half)]; if (win.length > 1) { fw[2] = 0.05; fw[3] = 0.95; } }
      else if (lg) fw = [0.0, 2.6, 0.5 - lg.w / 2 / st.tile, 0.5 + lg.w / 2 / st.tile];
      st[side] = Object.assign({}, src); st[side + 'c'] = { P: cP, U: cU < 0 ? cP : cU, G: cG < 0 ? cP : cG, fw, code: (cU < 0 ? cP : cU) + 128 * (cG < 0 ? cP : cG) + 16384 * cP, spU: U, spG: G };
    }
  }
})();
// ---- drawing a cell: content of FAC_IN px for one bay (tile m) by one floor (3.1 m); col and mask canvases side by side
function facDraw(c, m, spec, tile) {
  const W = FAC_IN, Hh = FAC_IN, X = u => u * W, Xm = mm => mm / tile * W, Y = mm => (1 - mm / FAC_FL) * Hh;
  let sd = 1 + facHashStr(JSON.stringify(spec)) * 1e6 | 0; const r = () => (sd = sd * 16807 % 2147483647) / 2147483647;
  const both = (col, mk, f) => { c.fillStyle = col; m.fillStyle = mk; f(c); f(m); };
  const rect = (x0, y0, x1, y1, col, mk) => both(col, mk, g => g.fillRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0)));
  const T1 = 'rgb(0,0,255)', TH = 'rgb(0,0,128)', T0 = 'rgb(0,0,0)', GL = 'rgb(255,0,0)';
  // the wall
  const base = spec.base || 'pl';
  rect(0, 0, W, Hh, '#ffffff', T1);
  const speck = (n, a, cols, mk = null) => { for (let i = 0; i < n; i++) { c.fillStyle = cols[i % cols.length]; c.globalAlpha = a * (0.4 + r() * 0.6); const x = r() * W, y = r() * Hh, s = 1 + r() * 2; c.fillRect(x, y, s, s); } c.globalAlpha = 1; };
  if (base === 'pl' || base === 'bu') speck(900, 0.12, ['#cfcfcf', '#e9e9e9']);
  if (base === 'gr') speck(4200, 0.22, ['#c4c4c4', '#f4f4f4', '#d6d6d6']);
  if (base === 'bu') for (let y = 0; y < FAC_FL; y += 0.42) rect(0, Y(y) - 1.5, W, Y(y) + 1.5, '#b8b8b8', T1);
  if (base === 'br') { rect(0, 0, W, Hh, '#a65a3e', T0); const rh = 0.077, bw = 0.25; for (let y = 0, k = 0; y < FAC_FL; y += rh, k++) { rect(0, Y(y) - 0.8, W, Y(y) + 0.8, '#d9cfc0', T0); for (let x = (k % 2) * bw / 2; x < tile; x += bw) rect(Xm(x) - 0.6, Y(y), Xm(x) + 0.6, Y(y + rh), '#d9cfc0', T0); }
    for (let i = 0; i < 600; i++) { c.globalAlpha = 0.25; c.fillStyle = ['#8e4a32', '#b86a4a', '#7a3e2a'][i % 3]; c.fillRect(r() * W, r() * Hh, 4 + r() * 6, 3); } c.globalAlpha = 1; }
  if (base === 'lm') for (let x = 0; x < tile; x += 0.2) { rect(Xm(x), 0, Xm(x + 0.06), Hh, '#c9c9c9', T1); rect(Xm(x + 0.06), 0, Xm(x + 0.09), Hh, '#f4f4f4', T1); }
  if (base === 'pn' || base === 'cm') { const st = base === 'pn' ? 1.2 : tile / 2; for (let x = 0; x <= tile + 0.01; x += st) rect(Xm(x) - 1, 0, Xm(x) + 1, Hh, '#8a8a8a', T1); rect(0, Y(0) - 2, W, Y(0), '#8a8a8a', T1); if (base === 'cm') { rect(0, Y(1.55) - 1, W, Y(1.55) + 1, '#8a8a8a', T1); speck(1800, 0.18, ['#bdbdbd', '#ededed']); } }
  if (base === 'cb') for (let y = 0, k = 0; y < FAC_FL; y += 0.2, k++) { rect(0, Y(y) - 0.7, W, Y(y) + 0.7, '#a8a8a8', T1); for (let x = (k % 2) * 0.2; x < tile; x += 0.4) rect(Xm(x) - 0.7, Y(y), Xm(x) + 0.7, Y(y + 0.2), '#a8a8a8', T1); }
  if (spec.two) rect(0, Y(1.05), W, Hh, '#ffffff', TH); /* two colours: the lower band of each floor darker */
  if (spec.mp) { rect(0, Y(0.22), W, Hh, spec.mp, T0); rect(0, Y(0.22) - 1, W, Y(0.22) + 1, '#bdb6a6', T0); } /* marcapiano */
  if (spec.wood) { const [a, b] = spec.wood; rect(X(a), 0, X(b), Hh, '#9a6b45', T0); for (let x = a * tile; x < b * tile; x += 0.14) rect(Xm(x) - 0.6, 0, Xm(x) + 0.6, Hh, '#6e4a2e', T0); }
  if (spec.arc) { const aw = Math.min(2.4, tile * 0.7), x0 = W / 2 - Xm(aw / 2), x1 = W / 2 + Xm(aw / 2), yb = Y(0), yt = Y(2.3), rr = (x1 - x0) / 2;
    both('#5a3a22', T0, g => { g.beginPath(); g.moveTo(x0, yb); g.lineTo(x0, yt + rr * 0.6); g.ellipse((x0 + x1) / 2, yt + rr * 0.6, rr, rr * 0.6, 0, Math.PI, 0); g.lineTo(x1, yb); g.closePath(); g.fill(); });
    /* the wooden door in the arch (androni-3, Carlo 8/11): two leaves with planks, rails and raised panels, the shadow of the reveal at the sides and under the arch */
    c.save(); c.beginPath(); c.moveTo(x0, yb); c.lineTo(x0, yt + rr * 0.6); c.ellipse((x0 + x1) / 2, yt + rr * 0.6, rr, rr * 0.6, 0, Math.PI, 0); c.lineTo(x1, yb); c.closePath(); c.clip();
    for (let x = x0; x < x1; x += Xm(0.14)) { c.fillStyle = (Math.round((x - x0) / Xm(0.14)) % 2) ? '#68442a' : '#5a3a22'; c.fillRect(x, yt - rr, Xm(0.14), yb - yt + rr); c.fillStyle = '#3a2515'; c.fillRect(x, yt - rr, 1.2, yb - yt + rr); }
    c.fillStyle = '#46301c'; for (const yy of [0.35, 1.2, 2.0]) c.fillRect(x0, Y(yy) - 3, x1 - x0, 6);
    c.fillStyle = 'rgba(255,255,255,.07)'; for (const [a0, a1] of [[0.5, 1.1], [1.3, 1.9]]) { c.fillRect(x0 + 5, Y(a1), (x1 - x0) / 2 - 8, Y(a0) - Y(a1)); c.fillRect((x0 + x1) / 2 + 3, Y(a1), (x1 - x0) / 2 - 8, Y(a0) - Y(a1)); }
    c.fillStyle = '#1e140a'; c.fillRect((x0 + x1) / 2 - 1.5, yt - rr, 3, yb - yt + rr);
    c.fillStyle = '#8a6b2c'; c.fillRect((x0 + x1) / 2 - 9, Y(1.0), 5, 9); c.fillRect((x0 + x1) / 2 + 4, Y(1.0), 5, 9);
    const sh = c.createLinearGradient(0, yt - rr, 0, yt + rr * 0.9); sh.addColorStop(0, 'rgba(0,0,0,.55)'); sh.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = sh; c.fillRect(x0, yt - rr, x1 - x0, rr * 1.9);
    for (const [ga, gb] of [[x0, x0 + 7], [x1 - 7, x1]]) { const sg = c.createLinearGradient(ga, 0, gb, 0); sg.addColorStop(ga === x0 ? 0 : 1, 'rgba(0,0,0,.5)'); sg.addColorStop(ga === x0 ? 1 : 0, 'rgba(0,0,0,0)'); c.fillStyle = sg; c.fillRect(ga, yt - rr, gb - ga, yb - yt + rr); }
    c.restore(); }
  if (spec.gar) { const { w, h, col } = spec.gar; rect(X(0.5) - Xm(w / 2) - 3, Y(h) - 3, X(0.5) + Xm(w / 2) + 3, Y(0), '#9a958b', T0); rect(X(0.5) - Xm(w / 2), Y(h), X(0.5) + Xm(w / 2), Y(0), col, T0);
    for (let y = 0.25; y < h; y += 0.5) rect(X(0.5) - Xm(w / 2), Y(y) - 1, X(0.5) + Xm(w / 2), Y(y) + 1, 'rgba(0,0,0,.18)', T0); }
  if (spec.lg) { const { w, rail, rc } = spec.lg, x0 = X(0.5) - Xm(w / 2), x1 = X(0.5) + Xm(w / 2);
    rect(x0, Y(2.6), x1, Y(0), '#3a3a3c', T0); rect(x0 + Xm(0.5), Y(2.3), x1 - Xm(0.5), Y(0.05), '#384450', GL); rect(x0, Y(0.16), x1, Y(0), '#b8b4aa', T0);
    facRailPaint(rect, x0, x1, Y(0.16), Y(1.16), rail, rc, Xm); }
  for (const w of spec.w || []) {
    const cx = X(w.u), hw = w.rib ? W / 2 : Xm(w.w / 2), x0 = cx - hw, x1 = cx + hw, y0 = Y(w.hi), y1 = Y(w.lo), fb = w.rib ? 3 : 4;
    if (w.cor) rect(x0 - Xm(0.14), y0 - Xm(0.16), x1 + Xm(0.14), y1 + 2, w.cor, T0);
    if (w.sh === 'pe') { const lw = Xm(w.w / 2); for (const [a, b] of [[x0 - lw, x0], [x1, x1 + lw]]) { rect(a, y0, b, y1, w.shc, T0); for (let y = y0 + 3; y < y1 - 2; y += 4) rect(a + 1, y, b - 1, y + 1.4, 'rgba(0,0,0,.28)', T0); } }
    rect(x0, y0, x1, y1, w.fr, T0);
    const gx0 = x0 + fb, gx1 = x1 - fb, gy0 = y0 + fb, gy1 = y1 - fb;
    rect(gx0, gy0, gx1, gy1, w.cw ? '#3d5566' : '#3a4652', GL);
    const gr = c.createLinearGradient(0, gy0, 0, gy1); gr.addColorStop(0, 'rgba(255,255,255,.10)'); gr.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = gr; c.fillRect(gx0, gy0, gx1 - gx0, gy1 - gy0);
    if (w.rib) { const n = Math.max(1, Math.round(w.w / 1.2)); for (let i = 0; i <= n; i++) rect(gx0 + (gx1 - gx0) * i / n - 1.5, gy0, gx0 + (gx1 - gx0) * i / n + 1.5, gy1, w.fr, T0); if (w.cw) rect(gx0, Y(1.0) - 1.5, gx1, Y(1.0) + 1.5, w.fr, T0); }
    else if (w.mul && w.w > 0.75) rect(cx - 1.5, gy0, cx + 1.5, gy1, w.fr, T0);
    if (w.sh === 'ta') { const lv = 0.25 + r() * 0.2, yb = gy0 + (gy1 - gy0) * lv; rect(gx0, gy0, gx1, yb, w.shc, T0); for (let y = gy0 + 2; y < yb; y += 3) rect(gx0, y, gx1, y + 0.8, 'rgba(0,0,0,.2)', T0); }
    if (w.sh === 've') { const yb = gy0 + (gy1 - gy0) * 0.35; rect(gx0, gy0, gx1, yb, w.shc, T0); for (let y = gy0 + 2; y < yb; y += 2.5) rect(gx0, y, gx1, y + 0.8, 'rgba(0,0,0,.25)', T0); }
    if (w.fins) for (let x = gx0 + 6; x < gx1; x += Xm(0.3)) rect(x - 1.5, gy0, x + 1.5, gy1, '#4a4d50', T0);
    if (w.bow) { rect(x0 - 4, y0 - 4, x1 + 4, y0, '#9a958b', T0); rect(x0 - 4, y1, x1 + 4, y1 + 5, '#9a958b', T0); }
    if (w.sill) rect(x0 - Xm(0.06), y1, x1 + Xm(0.06), y1 + Math.max(2, Xm(0.05) * 1.4), w.sill, T0);
    if (w.bal) { const b = w.bal; rect(X(b.u0), Y(0.16), X(b.u1), Y(0), '#b8b4aa', T0); rect(X(b.u0), Y(0.16) - 1, X(b.u1), Y(0.16) + 1, 'rgba(0,0,0,.25)', T0); facRailPaint(rect, X(b.u0), X(b.u1), Y(0.16), Y(1.16), b.rail, b.rc, Xm); }
  }
}
function facRailPaint(rect, x0, x1, yb, yt, rail, rc, Xm) {
  const T0 = 'rgb(0,0,0)', TH = 'rgb(0,0,128)';
  if (rail === 'pi') { rect(x0, yt, x1, yb, rc || '#ffffff', rc ? T0 : TH); rect(x0, yt, x1, yt + 2, 'rgba(0,0,0,.2)', rc ? T0 : TH); return; }
  if (rail === 've') { rect(x0, yt, x1, yb, '#8fa4aa', T0); rect(x0, yt - 2, x1, yt + 1, '#9a9da0', T0); return; }
  const col = rc || '#2b2d2f'; rect(x0, yt - 1.5, x1, yt + 1.5, col, T0); rect(x0, yb - 2, x1, yb, col, T0);
  const st = rail === 'me' ? Xm(0.07) : rail === 'le' ? Xm(0.12) : Xm(0.11), bw = rail === 'le' ? Xm(0.07) : 1.2;
  for (let x = x0 + st / 2; x < x1; x += st) rect(x - bw / 2, yt, x + bw / 2, yb, col, T0);
}
function facHashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
const FAC_ATLAS = (() => {
  const Wt = FAC_COLS * FAC_CPX, Ht = FAC_ROWS * FAC_CPX, mk = () => { const cv = document.createElement('canvas'); cv.width = Wt; cv.height = Ht; return cv; };
  const C = mk(), M = mk(), gc = C.getContext('2d'), gm = M.getContext('2d'); gm.fillStyle = '#0000ff'; gm.fillRect(0, 0, Wt, Ht);
  const tc = document.createElement('canvas'), tm = document.createElement('canvas'); tc.width = tm.width = tc.height = tm.height = FAC_IN;
  const meta = new Float32Array(8 * FAC_ROWS * FAC_COLS * 4); /* per cell 8 texels: open0, open1, dec0, dec1, bal (u0, u1, v0, v1 in the cell) */
  FAC_CELLS.forEach((cl, id) => {
    if (id >= FAC_COLS * FAC_ROWS) return;
    const c = tc.getContext('2d'), m = tm.getContext('2d'); c.clearRect(0, 0, FAC_IN, FAC_IN); m.clearRect(0, 0, FAC_IN, FAC_IN);
    facDraw(c, m, cl.spec, cl.tile);
    const col = id % FAC_COLS, row = id / FAC_COLS | 0, sx = col * FAC_CPX, sy = (FAC_ROWS - 1 - row) * FAC_CPX; /* the texture is flipped: row 0 at the bottom */
    for (const [g, src] of [[gc, tc], [gm, tm]]) { g.save(); g.beginPath(); g.rect(sx, sy, FAC_CPX, FAC_CPX); g.clip(); for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) g.drawImage(src, sx + FAC_PAD + dx * FAC_IN, sy + FAC_PAD + dy * FAC_IN); g.restore(); }
    const put = (k, r) => { const o = (id * 8 + k) * 4; meta[o] = r[0]; meta[o + 1] = r[1]; meta[o + 2] = r[2]; meta[o + 3] = r[3]; };
    for (let k = 0; k < 5; k++) put(k, [2, -2, 2, -2]);
    const sp = cl.spec, t = cl.tile, v = mm => mm / FAC_FL;
    (sp.w || []).slice(0, 2).forEach((w, i) => {
      const hw = w.rib ? 0.5 : w.w / 2 / t; put(i, [w.u - hw + 0.004, w.u + hw - 0.004, v(w.lo) + 0.004, v(w.hi) - 0.004]);
      const sw = w.sh === 'pe' ? w.w / t : hw; put(2 + i, [w.u - sw - 0.01, w.u + sw + 0.01, v(w.lo - (w.sill ? 0.09 : 0.02)), v(w.hi + 0.03)]);
      if (w.bal) put(4, [w.bal.u0 - 0.01, w.bal.u1 + 0.01, -0.01, v(1.22)]);
      if (w.bow) put(2 + i, [w.u - hw - 0.03, w.u + hw + 0.03, v(w.lo - 0.1), v(w.hi + 0.1)]);
    });
    if (sp.lg) put(0, [0.5 - sp.lg.w / 2 / t + 0.004, 0.5 + sp.lg.w / 2 / t - 0.004, 0.004, v(2.6)]);
  });
  const tex = new THREE.CanvasTexture(C); tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const msk = new THREE.CanvasTexture(M); msk.encoding = THREE.LinearEncoding; msk.anisotropy = tex.anisotropy;
  const mt = new THREE.DataTexture(meta, 8, FAC_ROWS * FAC_COLS, THREE.RGBAFormat, THREE.FloatType); mt.minFilter = mt.magFilter = THREE.NearestFilter; mt.needsUpdate = true;
  return { tex, msk, meta: mt, n: FAC_CELLS.length };
})();
if (FAC_ATLAS.n > FAC_COLS * FAC_ROWS) console.warn('facciate: celle oltre l\'atlante', FAC_ATLAS.n);
// ---- the material of all facades
const FAC_U = { uNearR: { value: FAC_R }, uBalR: { value: FAC_RB }, uMeta: { value: FAC_ATLAS.meta }, uLit: WIN_LIT };
MAT.fac = new THREE.MeshLambertMaterial({ map: FAC_ATLAS.tex, emissiveMap: FAC_ATLAS.msk, emissive: new THREE.Color(0xffc870), emissiveIntensity: 0, vertexColors: true });
MAT.fac.onBeforeCompile = s => {
  Object.assign(s.uniforms, FOTO_FAC, FAC_U);
  AO_WALL(s);
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 facD;\nvarying vec4 vFac;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFac = facD;')
    .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz; vWNrm = normalize( mat3( modelMatrix ) * objectNormal );');
  s.fragmentShader = `uniform sampler2D uPlaster;\nuniform vec3 uSkyH;\nuniform vec3 uSkyZ;\nuniform vec3 uSunD;\nuniform vec3 uSunC;\nuniform float uNearR;\nuniform float uBalR;\nuniform float uLit;\nuniform highp sampler2D uMeta;
varying vec4 vFac;\nvarying vec3 vWPos;\nvarying vec3 vWNrm;
const vec2 FAC_CS = vec2(${(1 / FAC_COLS).toFixed(6)}, ${(1 / FAC_ROWS).toFixed(6)}); const float FAC_PF = ${(FAC_PAD / FAC_CPX).toFixed(6)};
vec2 facAt(float c, vec2 f) { return (vec2(mod(c, ${FAC_COLS}.0), floor(c / ${FAC_COLS}.0)) + FAC_PF + f * (1.0 - 2.0 * FAC_PF)) * FAC_CS; }
float facIgn(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }
bool facIn(vec2 f, int c, int k) {
#if __VERSION__ >= 300
  vec4 r = texelFetch(uMeta, ivec2(k, c), 0); return f.x > r.x && f.x < r.y && f.y > r.z && f.y < r.w;
#else
  return false;
#endif
}
` + s.fragmentShader
    .replace('#include <map_fragment>', `
  float facF = floor( vUv.y );
  float facW = step( vFac.x - 0.5, facF ) * step( facF, vFac.y + 0.5 ) * step( vFac.z, vUv.y );
  float facCode = vFac.w + 0.5, facCP = floor( facCode / 16384.0 ), facR0 = facCode - facCP * 16384.0, facCG = floor( facR0 / 128.0 ), facCU = floor( facR0 - facCG * 128.0 );
  float facCell = facW < 0.5 ? facCP : ( facF < floor( vFac.z ) + 0.5 ? facCG : facCU );
  vec2 facFr = fract( vUv );
  float facD = distance( vWPos, cameraPosition ), facDi = facIgn( gl_FragCoord.xy );
  if ( facW > 0.5 ) {
    int ci = int( facCell + 0.5 );
    bool nW = facDi < clamp( ( uNearR - facD ) / 6.0, 0.0, 1.0 ), nB = facDi < clamp( ( uBalR - facD ) / 8.0, 0.0, 1.0 );
    if ( nW && ( facIn( facFr, ci, 0 ) || facIn( facFr, ci, 1 ) ) ) discard;
    if ( ( nW && ( facIn( facFr, ci, 2 ) || facIn( facFr, ci, 3 ) ) ) || ( nB && facIn( facFr, ci, 4 ) ) ) facCell = facCP;
  }
  vec2 facUV = facAt( facCell, facFr ), facGx = dFdx( vUv ) * FAC_CS * ( 1.0 - 2.0 * FAC_PF ), facGy = dFdy( vUv ) * FAC_CS * ( 1.0 - 2.0 * FAC_PF );
#if __VERSION__ >= 300
  vec4 texelColor = textureGrad( map, facUV, facGx, facGy ); vec4 facM = textureGrad( emissiveMap, facUV, facGx, facGy );
#else
  vec4 texelColor = texture2D( map, facUV ); vec4 facM = texture2D( emissiveMap, facUV );
#endif
  texelColor = mapTexelToLinear( texelColor );
  diffuseColor *= texelColor;`)
    .replace('#include <color_fragment>', `
#ifdef USE_COLOR
  { float tm = facM.b; vec3 tc = mix( vec3( 1.0 ), vColor, clamp( tm * 2.0, 0.0, 1.0 ) ); tc *= 1.0 - 0.18 * step( 0.25, tm ) * ( 1.0 - clamp( abs( tm - 0.5 ) * 2.0, 0.0, 1.0 ) ); diffuseColor.rgb *= tc; }
#endif
  { vec3 tg = normalize( vec3( -vWNrm.z, 0.0, vWNrm.x ) + 1e-5 ); vec2 puv = vec2( dot( vWPos, tg ), vWPos.y ) / 1.8;
    diffuseColor.rgb *= 1.0 + ( texture2D( uPlaster, puv ).r - 0.5 ) * 1.1 * clamp( facM.b * 2.0 - 0.6, 0.0, 1.0 ); }
  diffuseColor.rgb *= vUv.y < vFac.z ? 0.7 : 1.0;`)
    .replace('#include <emissivemap_fragment>', `
  float paneM = facM.r * facW;
  { float wh = fract( sin( dot( floor( vUv ) + 0.37, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 ); totalEmissiveRadiance *= paneM * step( wh, uLit ) * ( 0.7 + 0.6 * fract( wh * 7.13 ) ); }`)
    .replace('vec3 outgoingLight =', `
  if ( paneM > 0.01 ) {
    float paneH = fract( sin( dot( floor( vUv ) + 0.37, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
    vec3 Vd = normalize( vWPos - cameraPosition ), Np = normalize( vWNrm + vec3( 0.0, ( paneH - 0.5 ) * 0.14, ( fract( paneH * 7.1 ) - 0.5 ) * 0.1 ) ), Rd = reflect( Vd, Np );
    float fres = 0.04 + 0.96 * pow( 1.0 - clamp( dot( -Vd, Np ), 0.0, 1.0 ), 5.0 );
    vec3 seen = Rd.y > 0.0 ? mix( uSkyH, uSkyZ, smoothstep( 0.0, 0.5, Rd.y ) ) : uSkyH * 0.3;
    totalEmissiveRadiance += paneM * ( seen * ( 0.3 + 0.7 * fres ) + uSunC * pow( max( dot( Rd, uSunD ), 0.0 ), 600.0 ) * 8.0 );
  }
  vec3 outgoingLight =`);
};
MAT.fac.customProgramCacheKey = () => 'facciate2';
// ---- which style a building takes
const FAC_FAM_KEY = ['box', 'vil', 'corte', 'pal', 'alto', 'cap', 'com'];
function facBand(fam, ep) {
  if (fam === 'corte') return 'A';
  if (fam === 'vil' || fam === 'pal') return ep <= 3 ? 'B' : ep <= 5 ? 'C' : 'D';
  if (fam === 'alto') return ep <= 5 ? 'C' : 'D';
  return 'X';
}
const facHashB = (B, k = 0) => { const s = B.e !== undefined ? B.e * 7.31 + 0.5 : B.pts[0][0] * 3.7 + B.pts[0][1] * 11.3; return hashRnd(s * 1.618 + k * 97.13); };
/* the family of a building with no fa (old data): as famiglie.py, without the neighbours */
function facFamOf(B, area, hw) { const t = B.t, nf = hw / FAC_FL; if (t === 1 || t === 9 || (area < 45 && hw < 4.5)) return 0; if (t === 2) return 5; if (t === 3) return 6; if (nf >= 6.6) return 4; if (nf >= 3.7) return 3; if (t === 10 || (area < 300 && hw < 10.5)) return 1; return 2; }
function facStyleOf(B, area, hw) {
  if (B.st) return { S: FAC_STILI.rud.X[0], col: COL(FAC_STILI.rud.X[0].pal[Math.floor(facHashB(B, 1) * 3)]), ep: null };
  if (B.pu !== undefined) { const S = FAC_PUB_LISCI.has(B.pu) ? FAC_STILI.pub.N[0] : FAC_STILI.pub.W[0]; return { S, col: COL('#ff1fa8'), pink: true, ep: null }; }
  const fa = B.fa !== undefined ? B.fa : facFamOf(B, area, hw), fam = FAC_FAM_KEY[fa];
  let ep = B.ep; if (ep === undefined || ep === null) ep = fam === 'corte' ? 0 : fam === 'alto' ? 4 : fam === 'pal' && hw / FAC_FL >= 4.6 ? 4 : 3;
  const band = facBand(fam, ep), list = FAC_STILI[fam][band] || FAC_STILI[fam][Object.keys(FAC_STILI[fam])[0]], S = list[Math.floor(facHashB(B) * list.length) % list.length];
  return { S, col: COL(S.pal[Math.floor(facHashB(B, 1) * S.pal.length) % S.pal.length]), ep, fam };
}
const FAC_PUB_GRUPPI = ['CAPPELLA', 'CHIESA', 'SCUOLA', 'SCUOLA SUPERIORE', 'ASILO', 'SPORT', 'SANITÀ', 'COMUNE', 'CARABINIERI', 'POLIZIA LOCALE', 'POSTE', 'STAZIONE', 'CULTURA', 'TRIBUNA', 'ALTRO'];
const FAC_PUB_LISCI = new Set([0, 1, 13]); /* chapels and churches stay smooth, no windows (Carlo 8/11); the stands are a solid block */
// is this point (just out of a wall, at height y) inside another building?
function facCoperto(B, x, z, y) {
  let c = false;
  BLD.each(x, z, x, z, b => { if (c || b === B || b.t === 9 || b.g >= 2) return; if (b.gtop === undefined) b.gtop = bldTop(b); const lo = b.zb !== undefined ? b.zb : -1e9; if (y < b.gtop - 0.3 && y > lo && inPoly(x, z, b.pts) && !(b.holes || []).some(h => inPoly(x, z, h))) c = true; });
  return c;
}
// does this wall look onto a street? (front cells); a courtyard (a hole of the plan) never does
function facFronte(ax, az, cx, cz, nx, nz) {
  for (const f of [0.25, 0.5, 0.75]) { const mx = ax + (cx - ax) * f, mz = az + (cz - az) * f; for (const d of [3, 7, 11, 15]) if (onAnyRoad(mx + nx * d, mz + nz * d, 1.0)) return true; }
  return false;
}
// ---- the 3D records of a tile, filled by the building loop of world3.js
function facWinRecs(T, R, e, B, sty, side, j, k, s0, bw, F0, FL, sc, wallCol, gro) {
  /* one bay (j) on one floor (k) of run R; e: its side [dx, dz, L, nx, nz]; s0: the bay's start along the run */
  const cells = sty.S[side + 'c'], spec = gro ? cells.spG : cells.spU; if (!spec) return;
  const nx = e[3], nz = e[4], yF = F0 + FL * k, out = T.fwin || (T.fwin = []), bal = T.fbal || (T.fbal = []), det = T.fdet || (T.fdet = []);
  const h0 = hashRnd((B.e !== undefined ? B.e * 13.1 : B.pts[0][0]) + j * 7.7 + k * 3.3 + side.length);
  const at = s => { const p = R.at(s); return p; };
  const fam = sty.S.fam, fr = (c, d) => c || d;
  if (spec.lg) {
    const lg = spec.lg, w = lg.w * bw / sty.S.tile, p = at(s0 + bw / 2);
    out.push({ x: p[0], y: yF, z: p[1], nx, nz, w, h: 2.6 * sc, D: lg.d, lg: 1, fr: COL(ANTR), wc: wallCol, rail: lg.rail, rc: lg.rc ? COL(lg.rc) : wallCol.clone().multiplyScalar(0.85), lit: h0 });
    if (h0 < 0.3) det.push({ k: 'pot', x: p[0] + nz * (w * 0.3) + nx * (-0.4), y: yF, z: p[1] - nx * (w * 0.3) + nz * (-0.4), nx, nz, R: FAC_R });
    return;
  }
  for (const w of spec.w || []) {
    const ww = (w.rib ? sty.S.tile : w.w) * bw / sty.S.tile, p = at(s0 + w.u * bw), lo = w.lo * sc, hi = w.hi * sc;
    const st = w.sh === 'pe' ? (h0 < 0.12 ? 1 : h0 < 0.2 ? 2 : 0) : 0;
    out.push({ x: p[0], y: yF + lo, z: p[1], nx, nz, w: ww, h: hi - lo, D: w.cw ? 0.07 : 0.18, fr: COL(w.fr), wc: wallCol, sh: w.sh, shc: COL(w.shc || '#888'), st, tl: 0.15 + hashRnd(h0 * 91) * 0.55,
      sill: w.sill ? COL(w.sill) : null, mul: !w.rib && w.w > 0.75, rib: !!w.rib, fins: !!w.fins, bow: !!w.bow, lit: hashRnd(h0 * 17 + 3) });
    const ux = nz, uz = -nx;
    if (w.bal && !gro) {
      const b = w.bal, bx0 = s0 + b.u0 * bw, bx1 = s0 + b.u1 * bw, q = at((bx0 + bx1) / 2), nastro = b.u0 <= 0.001 && b.u1 >= 0.999;
      bal.push({ x: q[0], y: yF, z: q[1], nx, nz, w: bx1 - bx0, d: b.d, rail: b.rail, rc: b.rc ? COL(b.rc) : wallCol.clone().multiplyScalar(0.85), sl: !nastro || j === 0, sr: !nastro || j === R.n - 1 });
      const hb = hashRnd(h0 * 53 + 1);
      if (hb < 0.35) det.push({ k: 'pot', x: q[0] + ux * (bx1 - bx0) * (hashRnd(hb * 7) - 0.5) * 0.8 + nx * (b.d - 0.3), y: yF, z: q[1] + uz * (bx1 - bx0) * (hashRnd(hb * 7) - 0.5) * 0.8 + nz * (b.d - 0.3), nx, nz, R: FAC_R });
      if ((fam === 'pal' || fam === 'alto' || fam === 'vil') && sty.S.band !== 'D' && hb > 0.82) det.push({ k: 'awn', x: p[0], y: yF + hi + 0.25, z: p[1], nx, nz, w: Math.min(bx1 - bx0, ww + 1.2), d: Math.min(b.d, 1.2), c: hashRnd(hb * 13), R: FAC_RB });
      if ((fam === 'pal' || fam === 'alto') && hb > 0.7 && hb < 0.76) det.push({ k: 'dish', x: q[0] + ux * (bx1 - bx0) * 0.4 + nx * (b.d - 0.05), y: yF + 1.15, z: q[1] + uz * (bx1 - bx0) * 0.4 + nz * (b.d - 0.05), nx, nz, R: FAC_RB });
    } else if (!gro || fam !== 'corte') {
      const ha = hashRnd(h0 * 29 + 5), pAC = fam === 'pal' || fam === 'alto' ? (sty.S.band === 'D' ? 0.02 : 0.08) : fam === 'vil' || fam === 'corte' ? 0.04 : 0.03;
      if (ha < pAC && !w.rib && !w.cw) { const sd = ha < pAC / 2 ? 1 : -1, off = ww / 2 + (w.sh === 'pe' ? ww / 2 : 0) + 0.55; det.push({ k: 'ac', x: p[0] + ux * off * sd, y: yF + lo + 0.25, z: p[1] + uz * off * sd, nx, nz, R: FAC_R }); }
      else if (fam === 'corte' && w.sill && ha > 0.85) det.push({ k: 'pot', x: p[0] + nx * 0.06, y: yF + lo, z: p[1] + nz * 0.06, nx, nz, s: 0.6, R: FAC_R });
      if ((fam === 'pal' || fam === 'alto') && sty.S.band !== 'D' && ha > 0.975) det.push({ k: 'dish', x: p[0] + ux * (ww / 2 + 0.6), y: yF + hi - 0.2, z: p[1] + uz * (ww / 2 + 0.6), nx, nz, R: FAC_RB });
    }
  }
}
function facExtraBal(T, R, e, sty, k, s0, bw, F0, FL, wallCol, j, kind) {
  /* the balconies of the corner bays (ang) and the small stone ones of the piano nobile (bc): 3D only */
  const o = kind === 'ang' ? sty.S.ang : sty.S.bc, p = R.at(s0 + bw / 2), bal = T.fbal || (T.fbal = []);
  const w = kind === 'ang' ? bw * 0.86 : Math.min(bw * 0.5, 1.8);
  bal.push({ x: p[0], y: F0 + FL * k, z: p[1], nx: e[3], nz: e[4], w, d: o.d, rail: o.rail, rc: COL(o.rc || '#e6e0d0'), sl: true, sr: true });
}
// ---- the instanced parts
const FAC_IGN = 'float facIgn2(vec2 p) { return fract(52.9829189 * fract(dot(p, vec2(0.06711056, 0.00583715)))); }\n';
function facFadeMat(mat, R, extraV = '', extraF = '') { /* the parts that stand out of the wall fade in and out with the hole in it */
  const U = { uFR: { value: R } }; mat.userData.fr = U;
  mat.onBeforeCompile = s => {
    s.uniforms.uFR = U.uFR;
    s.vertexShader = 'varying vec3 vFWP;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n{ vec4 fwp = vec4( transformed, 1.0 );\n#ifdef USE_INSTANCING\n fwp = instanceMatrix * fwp;\n#endif\n vFWP = ( modelMatrix * fwp ).xyz; }' + extraV);
    s.fragmentShader = 'varying vec3 vFWP;\nuniform float uFR;\n' + FAC_IGN + s.fragmentShader.replace('void main() {', 'void main() {\n  if ( uFR > 0.0 && facIgn2( gl_FragCoord.xy ) >= clamp( ( uFR - distance( vFWP, cameraPosition ) ) / 6.0, 0.0, 1.0 ) ) discard;' + extraF);
  };
  mat.customProgramCacheKey = () => 'facfade' + (R > 0 ? 1 : 0) + extraV.length + extraF.length;
  return mat;
}
const FAC_SLAT = canvasTex(64, 256, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 10) { g.fillStyle = 'rgba(0,0,0,.32)'; g.fillRect(0, y, w, 2.5); g.fillStyle = 'rgba(255,255,255,.5)'; g.fillRect(0, y + 3, w, 1); } g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, 3, h); g.fillRect(w - 3, 0, 3, h); });
const FAC_TAPP = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 4) { g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(0, y, w, 1); } });
const FAC_BARS = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let x = 3; x < w; x += 16) g.fillRect(x, 0, 3, h); g.fillRect(0, 0, w, 5); g.fillRect(0, h - 4, w, 4); });
const FAC_BARS2 = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let x = 2; x < w; x += 8) g.fillRect(x, 0, 2, h); g.fillRect(0, 0, w, 4); g.fillRect(0, h - 3, w, 3); });
const FAC_WOOD = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#ffffff'; for (let x = 0; x < w; x += 16) g.fillRect(x, 0, 10, h); g.fillRect(0, 0, w, 7); });
const FAC_AWN = canvasTex(64, 64, (g, w, h) => { for (let x = 0; x < w; x += 16) { g.fillStyle = '#ffffff'; g.fillRect(x, 0, 8, h); g.fillStyle = '#9a9a9a'; g.fillRect(x + 8, 0, 8, h); } });
const FAC_ACT = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#e8e8e4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#8a8d90'; g.lineWidth = 2; g.beginPath(); g.arc(40, 32, 20, 0, Math.PI * 2); g.stroke(); for (let a = 0; a < 6; a++) { g.beginPath(); g.moveTo(40, 32); g.lineTo(40 + Math.cos(a) * 18, 32 + Math.sin(a) * 18); g.stroke(); } g.fillStyle = '#c9c9c4'; g.fillRect(4, 8, 12, 48); });
const FAC_GEO = (() => {
  const G = {};
  const quads = list => { const p = [], n = [], uv = []; for (const [a, b, c, d, nn] of list) { for (const v of [a, b, c, a, c, d]) p.push(...v); for (let i = 0; i < 6; i++) n.push(...nn); uv.push(0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(n, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); return g; };
  /* the reveal: unit opening (x -0.5..0.5, y 0..1), depth 1 into the wall (z 0..-1) */
  G.reveal = quads([[[-0.5, 0, 0], [-0.5, 0, -1], [-0.5, 1, -1], [-0.5, 1, 0], [1, 0, 0]], [[0.5, 0, -1], [0.5, 0, 0], [0.5, 1, 0], [0.5, 1, -1], [-1, 0, 0]],
    [[-0.5, 1, 0], [-0.5, 1, -1], [0.5, 1, -1], [0.5, 1, 0], [0, -1, 0]], [[-0.5, 0, -1], [-0.5, 0, 0], [0.5, 0, 0], [0.5, 0, -1], [0, 1, 0]]]);
  G.back = quads([[[-0.5, 0, 0], [0.5, 0, 0], [0.5, 1, 0], [-0.5, 1, 0], [0, 0, 1]]]);
  G.glass = G.back;
  /* the frame: a ring 7% / 5% of the opening, 5 cm deep, with the middle post (frameM) or without (frame) */
  const ring = (bx, by, mul) => { const L = [], f = (x0, x1, y0, y1) => { L.push([[x0, y0, 0], [x1, y0, 0], [x1, y1, 0], [x0, y1, 0], [0, 0, 1]]); L.push([[x1, y0, 0], [x1, y0, -0.05], [x1, y1, -0.05], [x1, y1, 0], [1, 0, 0]]); L.push([[x0, y0, -0.05], [x0, y0, 0], [x0, y1, 0], [x0, y1, -0.05], [-1, 0, 0]]); L.push([[x0, y1, 0], [x1, y1, 0], [x1, y1, -0.05], [x0, y1, -0.05], [0, 1, 0]]); L.push([[x0, y0, -0.05], [x1, y0, -0.05], [x1, y0, 0], [x0, y0, 0], [0, -1, 0]]); };
    f(-0.5, -0.5 + bx, 0, 1); f(0.5 - bx, 0.5, 0, 1); f(-0.5 + bx, 0.5 - bx, 1 - by, 1); f(-0.5 + bx, 0.5 - bx, 0, by); if (mul) f(-bx * 0.4, bx * 0.4, by, 1 - by); return quads(L); };
  G.frameM = ring(0.07, 0.05, true); G.frame = ring(0.05, 0.04, false);
  const box = (x0, x1, y0, y1, z0, z1) => { const g = new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0); g.translate((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2); return g; };
  G.sill = box(-0.5, 0.5, -1, 0, -1, 0); /* scaled: (w + 0.12, 0.05, D + 0.05) */
  G.leaf = box(0, 1, 0, 1, 0, 0.035); /* a shutter leaf, hinged at x 0 */
  G.tapp = quads([[[-0.5, -1, 0], [0.5, -1, 0], [0.5, 0, 0], [-0.5, 0, 0], [0, 0, 1]]]);
  G.slab = box(-0.5, 0.5, -1, 0, 0, 1); /* scaled: (w, 0.16, d) */
  G.rail = quads([[[-0.5, 0, 0], [0.5, 0, 0], [0.5, 1, 0], [-0.5, 1, 0], [0, 0, 1]]]);
  G.wall = box(-0.5, 0.5, 0, 1, -0.5, 0.5); /* a solid parapet, scaled (w, 1.05, 0.1) */
  G.fin = box(-0.5, 0.5, 0, 1, 0, 1);
  G.bow = (() => { const L = []; L.push([[-0.5, 0, 1], [0.5, 0, 1], [0.5, 1, 1], [-0.5, 1, 1], [0, 0, 1]]); L.push([[0.5, 0, 1], [0.5, 0, 0], [0.5, 1, 0], [0.5, 1, 1], [1, 0, 0]]); L.push([[-0.5, 0, 0], [-0.5, 0, 1], [-0.5, 1, 1], [-0.5, 1, 0], [-1, 0, 0]]); return quads(L); })();
  G.bowBox = box(-0.5, 0.5, 0, 1, 0, 1);
  G.ac = box(-0.4, 0.4, 0, 0.55, 0, 0.28);
  G.pot = (() => { const a = box(-0.15, 0.15, 0, 0.28, -0.15, 0.15), b = new THREE.IcosahedronGeometry(0.22, 0); b.scale(1, 0.8, 1); b.translate(0, 0.42, 0);
    const col = (g, c) => { const n = g.attributes.position.count, arr = []; for (let i = 0; i < n; i++) arr.push(...c); g.setAttribute('color', new THREE.Float32BufferAttribute(arr, 3)); return g.index ? g.toNonIndexed() : g; };
    const A = col(a.toNonIndexed(), [0.62, 0.3, 0.2]), Bg = col(b, [0.22, 0.42, 0.18]), out = new THREE.BufferGeometry();
    for (const k of ['position', 'normal', 'color']) out.setAttribute(k, new THREE.Float32BufferAttribute([...A.attributes[k].array, ...Bg.attributes[k].array], k === 'uv' ? 2 : 3)); return out; })();
  G.awn = quads([[[-0.5, 0, 0], [0.5, 0, 0], [0.5, -0.55, 1], [-0.5, -0.55, 1], [0, 0.88, 0.48]], [[-0.5, -0.55, 1], [0.5, -0.55, 1], [0.5, -0.8, 1], [-0.5, -0.8, 1], [0, 0, 1]]]);
  G.dish = (() => { const c = new THREE.SphereGeometry(0.32, 10, 4, 0, Math.PI * 2, 0, 0.75); c.scale(1, 1, 0.5); c.rotateX(Math.PI / 2); c.translate(0, 0, 0.32); const a = box(-0.02, 0.02, -0.02, 0.02, 0, 0.3); const out = new THREE.BufferGeometry(), C = c.toNonIndexed(), A = a.toNonIndexed();
    for (const k of ['position', 'normal']) out.setAttribute(k, new THREE.Float32BufferAttribute([...C.attributes[k].array, ...A.attributes[k].array], 3)); return out; })();
  return G;
})();
const FAC_PARTS = (() => {
  const lam = o => new THREE.MeshLambertMaterial(o), P = {};
  const glassMat = lam({ color: 0x27313b, emissive: new THREE.Color(0xffc870), emissiveIntensity: 0 });
  glassMat.onBeforeCompile = s => {
    Object.assign(s.uniforms, FOTO_FAC, { uLit: WIN_LIT });
    s.vertexShader = 'attribute float aLit;\nvarying float vLit;\nvarying vec3 vGW;\nvarying vec3 vGN;\n' + s.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\nvLit = aLit; { vec4 gw = vec4( transformed, 1.0 ); vec3 gn = objectNormal;\n#ifdef USE_INSTANCING\n gw = instanceMatrix * gw; gn = mat3( instanceMatrix ) * gn;\n#endif\n vGW = ( modelMatrix * gw ).xyz; vGN = normalize( mat3( modelMatrix ) * gn ); }');
    s.fragmentShader = 'uniform vec3 uSkyH;\nuniform vec3 uSkyZ;\nuniform vec3 uSunD;\nuniform vec3 uSunC;\nuniform float uLit;\nvarying float vLit;\nvarying vec3 vGW;\nvarying vec3 vGN;\n' + s.fragmentShader
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= step( vLit, uLit ) * ( 0.7 + 0.6 * fract( vLit * 7.13 ) );')
      .replace('vec3 outgoingLight =', `{ vec3 Vd = normalize( vGW - cameraPosition ), Np = normalize( vGN + vec3( 0.0, ( vLit - 0.5 ) * 0.1, 0.0 ) ), Rd = reflect( Vd, Np );
    float fres = 0.04 + 0.96 * pow( 1.0 - clamp( dot( -Vd, Np ), 0.0, 1.0 ), 5.0 );
    vec3 seen = Rd.y > 0.0 ? mix( uSkyH, uSkyZ, smoothstep( 0.0, 0.5, Rd.y ) ) : uSkyH * 0.3;
    totalEmissiveRadiance += seen * ( 0.3 + 0.7 * fres ) + uSunC * pow( max( dot( Rd, uSunD ), 0.0 ), 600.0 ) * 8.0; }
  vec3 outgoingLight =`);
  };
  glassMat.customProgramCacheKey = () => 'facvetro';
  const glassRail = facFadeMat(lam({ color: 0x8fb3bb, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }), FAC_RB);
  const mk = (name, geo, mat, cap, o = {}) => {
    const m = new THREE.InstancedMesh(geo, mat, cap); m.instanceMatrix.setUsage(THREE.DynamicDrawUsage); m.count = 0; m.frustumCulled = false; m.castShadow = !!o.cast; m.receiveShadow = true;
    if (!o.noCol) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(cap * 3).fill(1), 3);
    if (o.lit) { geo.setAttribute('aLit', new THREE.InstancedBufferAttribute(new Float32Array(cap), 1)); }
    if (o.ro !== undefined) m.renderOrder = o.ro;
    scene.add(m); P[name] = { m, cap, n: 0, lit: o.lit ? geo.attributes.aLit : null };
  };
  /* recessed parts: no fade (only seen through the hole) */
  mk('reveal', FAC_GEO.reveal, lam({}), 6000);
  mk('back', FAC_GEO.back, lam({}), 1500);
  mk('glass', FAC_GEO.glass.clone(), glassMat, 6000, { noCol: true, lit: true });
  mk('frameM', FAC_GEO.frameM, lam({}), 6000);
  mk('frame', FAC_GEO.frame, lam({}), 3000);
  mk('tapp', FAC_GEO.tapp, lam({ map: FAC_TAPP }), 6000);
  /* parts on and out of the wall: they fade with the hole */
  mk('sill', FAC_GEO.sill, facFadeMat(lam({}), FAC_R), 6000);
  mk('leaf', FAC_GEO.leaf, facFadeMat(lam({ map: FAC_SLAT }), FAC_R), 12000);
  mk('fin', FAC_GEO.fin, facFadeMat(lam({}), FAC_R), 3000);
  mk('bow', FAC_GEO.bow, facFadeMat(lam({ color: 0x27313b }), FAC_R), 1500, { noCol: true });
  mk('bowBox', FAC_GEO.bowBox, facFadeMat(lam({}), FAC_R), 3000);
  mk('slab', FAC_GEO.slab, facFadeMat(lam({}), FAC_RB), 8000, { cast: true });
  mk('railFe', FAC_GEO.rail, facFadeMat(lam({ map: FAC_BARS, alphaTest: 0.5, side: THREE.DoubleSide }), FAC_RB), 16000, { cast: true });
  mk('railMe', FAC_GEO.rail, facFadeMat(lam({ map: FAC_BARS2, alphaTest: 0.5, side: THREE.DoubleSide }), FAC_RB), 8000, { cast: true });
  mk('railLe', FAC_GEO.rail, facFadeMat(lam({ map: FAC_WOOD, alphaTest: 0.5, side: THREE.DoubleSide }), FAC_RB), 4000, { cast: true });
  mk('railVe', FAC_GEO.rail, glassRail, 8000, { noCol: true, ro: 12 });
  mk('railPi', FAC_GEO.wall, facFadeMat(lam({}), FAC_RB), 16000, { cast: true });
  mk('top', FAC_GEO.wall, facFadeMat(lam({}), FAC_RB), 8000);
  mk('ac', FAC_GEO.ac, facFadeMat(lam({ map: FAC_ACT }), FAC_R), 2000, { noCol: true });
  mk('pot', FAC_GEO.pot, facFadeMat(lam({ vertexColors: true }), FAC_R), 4000, { noCol: true });
  mk('awn', FAC_GEO.awn, facFadeMat(lam({ map: FAC_AWN, side: THREE.DoubleSide }), FAC_RB), 2000, { cast: true });
  mk('dish', FAC_GEO.dish, facFadeMat(lam({ color: 0xdcdcd8 }), FAC_RB), 1000, { noCol: true });
  return P;
})();
const FAC_PRE = Object.values(FAC_PARTS).map(p => p.m);
// ---- writing the instances round the camera
const _facC = new THREE.Color();
function facPut(name, x, y, z, Xx, Xz, Zx, Zz, sx, sy, sz, col, lit) {
  Zx = -Xz; Zz = Xx; /* always right-handed: Z = X x up */
  const P = FAC_PARTS[name]; if (P.n >= P.cap) return; const i = P.n++, a = P.m.instanceMatrix.array, o = i * 16;
  a[o] = Xx * sx; a[o + 1] = 0; a[o + 2] = Xz * sx; a[o + 3] = 0; a[o + 4] = 0; a[o + 5] = sy; a[o + 6] = 0; a[o + 7] = 0;
  a[o + 8] = Zx * sz; a[o + 9] = 0; a[o + 10] = Zz * sz; a[o + 11] = 0; a[o + 12] = x; a[o + 13] = y; a[o + 14] = z; a[o + 15] = 1;
  if (col && P.m.instanceColor) { const c = P.m.instanceColor.array; c[i * 3] = col.r; c[i * 3 + 1] = col.g; c[i * 3 + 2] = col.b; }
  if (P.lit) P.lit.array[i] = lit;
}
const FAC_STATO = { x: 1e9, y: 0, z: 1e9, t: 0, nT: -1, wins: 0, bals: 0 };
const FAC_SHUT_C = new THREE.Color();
function facWin(r) {
  const nx = r.nx, nz = r.nz, Xx = nz, Xz = -nx, w = r.w, h = r.h, D = r.D, x = r.x, y = r.y, z = r.z;
  const wd = _facC.copy(r.wc).multiplyScalar(0.86);
  if (r.lg) { /* a loggia: deep reveal, the back wall with its French window, the parapet at the front */
    facPut('reveal', x, y, z, Xx, Xz, nx, nz, w, h, D, wd);
    facPut('back', x - nx * D, y, z - nz * D, Xx, Xz, nx, nz, w, h, 1, wd);
    const gw = Math.min(w * 0.5, 1.6), bx = x - nx * (D - 0.02), bz = z - nz * (D - 0.02);
    facPut('glass', bx, y + 0.05, bz, Xx, Xz, nx, nz, gw, 2.3, 1, null, r.lit); facPut('frameM', bx + nx * 0.01, y + 0.05, bz + nz * 0.01, Xx, Xz, nx, nz, gw, 2.3, 1, r.fr);
    facRail(r.rail, r.rc, x, y, z, Xx, Xz, nx, nz, w, -0.02); return;
  }
  facPut('reveal', x, y, z, Xx, Xz, nx, nz, w, h, D, wd);
  const gz = D - 0.05, gx = x - nx * gz, gzz = z - nz * gz;
  facPut('glass', gx, y, gzz, Xx, Xz, nx, nz, w, h, 1, null, r.lit);
  facPut(r.mul ? 'frameM' : 'frame', gx + nx * 0.05, y, gzz + nz * 0.05, Xx, Xz, nx, nz, w, h, 1, r.fr);
  if (r.sill) facPut('sill', x + nx * 0.05, y, z + nz * 0.05, Xx, Xz, nx, nz, w + 0.12, 0.05, D + 0.05, r.sill);
  else facPut('sill', x + nx * 0.02, y, z + nz * 0.02, Xx, Xz, nx, nz, w, 0.03, D + 0.02, r.fr);
  if (r.sh === 'ta' || r.sh === 've') facPut('tapp', x - nx * 0.06, y + h, z - nz * 0.06, Xx, Xz, nx, nz, w - 0.02, h * (r.sh === 've' ? 0.3 : r.tl), 1, r.shc);
  if (r.sh === 'pe') {
    const lw = w / 2;
    if (r.st === 0) { /* open against the wall: the right leaf from the right edge on, the left one turned round (its back to the wall) */
      facPut('leaf', x + Xx * lw + nx * 0.004, y, z + Xz * lw + nz * 0.004, Xx, Xz, nx, nz, lw, h, 1, r.shc);
      facPut('leaf', x - Xx * lw + nx * 0.039, y, z - Xz * lw + nz * 0.039, -Xx, -Xz, -nx, -nz, lw, h, 1, r.shc);
    } else if (r.st === 1) { /* closed */
      facPut('leaf', x - Xx * lw - nx * 0.05, y, z - Xz * lw - nz * 0.05, Xx, Xz, nx, nz, lw, h, 1, r.shc);
      facPut('leaf', x + Xx * lw - nx * 0.015, y, z + Xz * lw - nz * 0.015, -Xx, -Xz, -nx, -nz, lw, h, 1, r.shc);
    } else { /* one open, one half shut */
      facPut('leaf', x + Xx * lw + nx * 0.004, y, z + Xz * lw + nz * 0.004, Xx, Xz, nx, nz, lw, h, 1, r.shc);
      const c = Math.cos(0.7), sn = Math.sin(0.7), ax = Xx * c + nx * sn, az = Xz * c + nz * sn; /* the left one turned 40 degrees out of the opening */
      facPut('leaf', x - Xx * lw + nx * 0.01, y, z - Xz * lw + nz * 0.01, ax, az, 0, 0, lw, h, 1, r.shc);
    }
  }
  if (r.fins) for (let f = -w / 2 + 0.15; f < w / 2; f += 0.3) facPut('fin', x + Xx * f + nx * 0.12, y - 0.05, z + Xz * f + nz * 0.12, Xx, Xz, nx, nz, 0.04, h + 0.1, 0.22, FAC_SHUT_C.setRGB(0.29, 0.3, 0.31));
  if (r.bow) { /* a bow window: a glazed box 0.55 m out round the window */
    facPut('bow', x, y - 0.1, z, Xx, Xz, nx, nz, w + 0.3, h + 0.2, 0.55);
    facPut('bowBox', x, y - 0.25, z, Xx, Xz, nx, nz, w + 0.4, 0.15, 0.62, wd); facPut('bowBox', x, y + h + 0.1, z, Xx, Xz, nx, nz, w + 0.4, 0.15, 0.62, wd);
  }
}
function facRail(kind, rc, x, y, z, Xx, Xz, nx, nz, w, d, sl = false, sr = false) {
  /* the front of the railing at d from the wall; the sides if asked */
  const pieces = [[x + nx * d, z + nz * d, Xx, Xz, w]]; const hd = Math.max(0.1, d);
  if (sl) pieces.push([x - Xx * w / 2 + nx * d / 2, z - Xz * w / 2 + nz * d / 2, nx, nz, hd]);
  if (sr) pieces.push([x + Xx * w / 2 + nx * d / 2, z + Xz * w / 2 + nz * d / 2, nx, nz, hd]);
  for (const [px, pz, ax, az, L] of pieces) {
    if (kind === 'pi') facPut('railPi', px, y, pz, ax, az, az, -ax, L, 1.05, 0.12, rc);
    else if (kind === 've') { facPut('railVe', px, y + 0.05, pz, ax, az, az, -ax, L, 0.95, 1); facPut('top', px, y + 1.0, pz, ax, az, az, -ax, L, 0.05, 0.06, FAC_SHUT_C.setRGB(0.6, 0.62, 0.63)); }
    else facPut(kind === 'me' ? 'railMe' : kind === 'le' ? 'railLe' : 'railFe', px, y, pz, ax, az, az, -ax, L, 1.02, 1, rc);
  }
}
function facBal(r) {
  const Xx = r.nz, Xz = -r.nx;
  facPut('slab', r.x, r.y, r.z, Xx, Xz, r.nx, r.nz, r.w, 0.16, r.d, _facC.setRGB(0.72, 0.71, 0.68));
  facRail(r.rail, r.rc, r.x, r.y, r.z, Xx, Xz, r.nx, r.nz, r.w, r.d - 0.04, r.sl, r.sr);
}
function facDet(r) {
  const Xx = r.nz, Xz = -r.nx;
  if (r.k === 'ac') facPut('ac', r.x, r.y, r.z, Xx, Xz, r.nx, r.nz, 1, 1, 1);
  else if (r.k === 'pot') facPut('pot', r.x, r.y, r.z, Xx, Xz, r.nx, r.nz, r.s || 1, r.s || 1, r.s || 1);
  else if (r.k === 'awn') { const cs = [[0.18, 0.42, 0.25], [0.75, 0.35, 0.15], [0.2, 0.3, 0.55], [0.72, 0.6, 0.38]][Math.floor(r.c * 4) % 4]; facPut('awn', r.x, r.y, r.z, Xx, Xz, r.nx, r.nz, r.w, 1, r.d, _facC.setRGB(cs[0], cs[1], cs[2])); }
  else if (r.k === 'dish') facPut('dish', r.x, r.y, r.z, Xx, Xz, r.nx, r.nz, 1, 1, 1);
}
function facAggiorna(force) {
  const cp = camera.position, S = FAC_STATO, nT = VIVI.size;
  if (!force && hyp(cp.x - S.x, cp.z - S.z) < 2.5 && Math.abs(cp.y - S.y) < 2.5 && nT === S.nT && now - S.t < 1.5) return;
  S.x = cp.x; S.y = cp.y; S.z = cp.z; S.nT = nT; S.t = now;
  for (const k in FAC_PARTS) FAC_PARTS[k].n = 0;
  const RW = FAC_R + 8, RB = FAC_RB + 10; let nw = 0, nb = 0;
  for (const T of VIVI) {
    if (!T.fwin && !T.fbal && !T.fdet) continue; if (T.dist > RB + 150 || !T.group || !T.ready) continue;
    for (const r of T.fwin || []) { const d = Math.hypot(r.x - cp.x, r.y + r.h / 2 - cp.y, r.z - cp.z); if (d < RW) { facWin(r); nw++; } }
    for (const r of T.fbal || []) { const d = Math.hypot(r.x - cp.x, r.y - cp.y, r.z - cp.z); if (d < RB) { facBal(r); nb++; } }
    for (const r of T.fdet || []) { const d = Math.hypot(r.x - cp.x, r.y - cp.y, r.z - cp.z); if (d < (r.R || FAC_R) + 8) facDet(r); }
  }
  for (const k in FAC_PARTS) { const P = FAC_PARTS[k]; P.m.count = P.n; P.m.visible = P.n > 0; P.m.instanceMatrix.needsUpdate = true; if (P.m.instanceColor) P.m.instanceColor.needsUpdate = true; if (P.lit) P.lit.needsUpdate = true; }
  S.wins = nw; S.bals = nb;
}
function facTick() {
  MAT.fac.emissiveIntensity = MAT.old.emissiveIntensity; FAC_PARTS.glass.m.material.emissiveIntensity = MAT.old.emissiveIntensity;
  facAggiorna(false);
}
// ---- the doors of the houses by epoch (Carlo 8/11): wood in two leaves in a stone frame (old houses), aluminium and glass with the entry phone
// (blocks of flats), a single door with its step (villette); the brass knob and the plaques stay to the offices (negozi3.js)
const FAC_DOOR_MAT = new THREE.MeshLambertMaterial({ vertexColors: true }), FAC_DOOR_COL = {};
function facDoor(F, d) {
  const n = { x: -d.uz, z: d.ux }, cx = (d.ax + d.bx) / 2, cz = (d.az + d.bz) / 2, th = Math.atan2(-d.uz, d.ux), y0 = d.gy;
  const bx = (w, h, dp, lx, ly, lz, col, cast = false) => { /* one vertex-coloured buffer for all the doors of the tile: one draw call, not one per colour */
    const B = F.buf(FAC_DOOR_MAT, cast).b, [k0, k1] = addGeo(B, boxG(w, h, dp), matTRy(cx + d.ux * lx + n.x * lz, y0 + ly, cz + d.uz * lx + n.z * lz, th)), c = FAC_DOOR_COL[col] || (FAC_DOOR_COL[col] = new THREE.Color(col));
    while (B.c.length < k0 * 3) B.c.push(1, 1, 1); for (let i = k0; i < k1; i++) B.c.push(c.r, c.g, c.b); };
  const k = d.sty || 'gen', W = d.W, h = d.h;
  if (k === 'leg') {
    const hh = Math.max(h, 2.6), lw = W / 2 - 0.02;
    bx(0.24, hh + 0.28, 0.16, -W / 2 - 0.12, (hh + 0.28) / 2, 0.06, 0xd9d2c0, true); bx(0.24, hh + 0.28, 0.16, W / 2 + 0.12, (hh + 0.28) / 2, 0.06, 0xd9d2c0, true);
    bx(W + 0.72, 0.3, 0.2, 0, hh + 0.13, 0.08, 0xd9d2c0, true); bx(W + 0.5, 0.14, 0.42, 0, 0.07, 0.2, 0xcfc8b6, false);
    for (const sx of [-1, 1]) { bx(lw, hh, 0.08, sx * (lw / 2 + 0.01), hh / 2, 0.0, 0x5a3a22, true); for (const yy of [0.7, 1.75]) bx(lw - 0.22, 0.75, 0.03, sx * (lw / 2 + 0.01), yy, 0.05, 0x4a2f1b); bx(0.05, 0.05, 0.06, sx * 0.1, 1.15, 0.07, 0x2a2a2a); }
    bx(0.03, hh, 0.03, 0, hh / 2, 0.05, 0x2a1f10);
  } else if (k === 'all') {
    const hh = Math.max(h, 2.3);
    bx(W + 0.14, hh + 0.08, 0.08, 0, (hh + 0.08) / 2, 0.02, 0x3a3d40, true); bx(W - 0.1, hh - 0.18, 0.03, 0, (hh - 0.18) / 2 + 0.05, 0.06, 0x26313a);
    bx(W - 0.1, 0.05, 0.05, 0, hh * 0.72, 0.07, 0x3a3d40); bx(0.03, 0.9, 0.05, W / 2 - 0.16, 1.1, 0.1, 0xc9ccd1);
    bx(0.18, 0.32, 0.04, W / 2 + 0.28, 1.4, 0.02, 0xc9ccd1); for (let i = 0; i < 4; i++) bx(0.12, 0.035, 0.02, W / 2 + 0.28, 1.31 + i * 0.05, 0.045, 0x2b2f33);
    bx(W + 0.4, 0.12, 0.4, 0, 0.06, 0.2, 0xb8b3a8);
  } else if (k === 'vil') {
    const dw = Math.min(W, 1.0), hh = Math.max(h, 2.15), col = d.col || 0x6b4a2e, ns = d.steps || 1;
    bx(dw + 0.12, hh + 0.06, 0.06, 0, (hh + 0.06) / 2, 0.02, 0xece9e2, true); bx(dw - 0.04, hh - 0.04, 0.06, 0, (hh - 0.04) / 2, 0.04, col, true);
    bx(dw - 0.3, 0.6, 0.02, 0, hh * 0.68, 0.08, 0x3a4652); bx(0.03, 0.2, 0.05, dw / 2 - 0.12, 1.05, 0.09, 0xc9ccd1);
    for (let s = 0; s < ns; s++) bx(dw + 0.5, 0.17, 0.35 * (ns - s), 0, 0.085 + 0.17 * s - 0.17 * (ns - 1), 0.175 * (ns - s), 0xbcb6aa);
  } else if (k === 'met') {
    const hh = Math.max(h, 2.1); bx(W + 0.1, hh + 0.05, 0.06, 0, (hh + 0.05) / 2, 0.02, 0x6a6e72, true); bx(W - 0.04, hh - 0.04, 0.05, 0, (hh - 0.04) / 2, 0.05, 0x8f949a);
    for (let y = 0.3; y < hh; y += 0.4) bx(W - 0.1, 0.02, 0.02, 0, y, 0.08, 0x7a7e82); bx(0.12, 0.03, 0.05, W / 2 - 0.15, 1.05, 0.09, 0x2b2f33);
  } else return false;
  return true;
}
// ---- the pink public buildings: TIPO in black above, the name in white under it, all round (Carlo 8/11)
const FAC_PINK_TEX = new Map();
function facPinkTex(tipo, nome) {
  const key = tipo + '|' + (nome || ''); if (FAC_PINK_TEX.has(key)) return FAC_PINK_TEX.get(key);
  const Wc = 2048, rows = nome ? 2 : 1, Hc = 128 * rows, cv = document.createElement('canvas'); cv.width = Wc; cv.height = Hc; const g = cv.getContext('2d');
  const line = (txt, y, fill, stroke) => {
    g.font = 'bold 96px Arial, Helvetica, sans-serif'; const one = txt + '     ', w1 = g.measureText(one).width, n = Math.max(1, Math.round(Wc / w1)), k = Wc / (n * w1);
    g.save(); g.scale(k, 1); g.textBaseline = 'middle'; g.fillStyle = fill; if (stroke) { g.strokeStyle = stroke; g.lineWidth = 8; }
    for (let i = 0; i < n; i++) { if (stroke) g.strokeText(one, i * w1, y); g.fillText(one, i * w1, y); } g.restore();
  };
  line(tipo, 66, '#111111', null); if (nome) line(nome, 128 + 66, '#ffffff', 'rgba(60,0,40,.55)');
  const t = new THREE.CanvasTexture(cv); t.wrapS = THREE.RepeatWrapping; t.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
  const m = new THREE.MeshLambertMaterial({ map: t, transparent: true, alphaTest: 0.35, emissive: 0x404040, emissiveMap: t, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const r = { m, rows }; FAC_PINK_TEX.set(key, r); return r;
}
function facPinkBand(T, B, rings, top, F0) {
  /* a band 1.3 m a row, its top under the eaves or over the ground floor, on every wall of the outer ring longer than 2.5 m */
  if (B.pu === undefined) return;
  const tipo = FAC_PUB_GRUPPI[B.pu] || 'ALTRO', nome = (B.pn || '').toUpperCase(), tx = facPinkTex(tipo, nome), rh = 0.9, Hb = rh * tx.rows, rep = rh * 2048 / 128;
  const yTop = Math.min(top - 0.35, F0 + 2.55 + Hb), yBot = yTop - Hb; if (yBot < F0 - 0.5) return;
  const L = T.pinkB || (T.pinkB = new Map()); let b = L.get(tx.m); if (!b) L.set(tx.m, b = Buf());
  const ring = rings[0]; if (!ring) return; const { ring: P, E } = ring; let acc = 0;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], [dx, dz, Le, nx, nz] = E[i]; if (Le < 0.05) continue;
    const c = [a[0] + dx, a[1] + dz], o = 0.03, base = b.p.length / 3, u0 = acc / rep, u1 = (acc + Le) / rep;
    vtx(b, a[0] + nx * o, yBot, a[1] + nz * o, nx, 0, nz, u0, 0); vtx(b, c[0] + nx * o, yBot, c[1] + nz * o, nx, 0, nz, u1, 0);
    vtx(b, c[0] + nx * o, yTop, c[1] + nz * o, nx, 0, nz, u1, 1); vtx(b, a[0] + nx * o, yTop, a[1] + nz * o, nx, 0, nz, u0, 1);
    if (nx * (-dz) + nz * dx > 0) b.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else b.i.push(base, base + 2, base + 1, base, base + 3, base + 2);
    acc += Le;
  }
}
{ const udnF = updDayNight; updDayNight = function (dt) { udnF(dt); facTick(); }; } /* every frame, after the light of the day: the 3D windows round the camera */
