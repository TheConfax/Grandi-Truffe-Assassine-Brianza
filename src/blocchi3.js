// ---------------------------------------------------------------- the blocks of numbers a tile is built in (Buf): the same blocks again, tile after tile
// A plain array has to grow, and each size it passes through is rubbish: gigabytes a minute at speed, and from a certain size in the old generation of the memory, where the long cleanups come from (50 ms). A plain array cannot be emptied and kept either: JS gives its memory back.
// So during the building of a tile (BLOCCHI.on) Buf hands out typed arrays from a pool, one pool per size, that go back when the tile is finished. They read and write like the arrays they replace: [i], length, push. Doubles for the coordinates, so the numbers are the same to the last bit. One too small hands over to a bigger one, in its Buf: reach it through the Buf (b.p.push); a local copy of b.p is for reading. Outside the building (start of the game, a hedge cut by a car) Buf stays plain.
// Not on resizable buffers: tried, a push on them costs seven times as much once there are many.
const BLOCCHI = { on: false, F: new Map(), U: new Map(), usati: [], giro: 1, MIN: 1 << 12 };
const bloccoRendi = (P, a) => { let l = P.get(a.cap); if (!l) P.set(a.cap, l = []); if (l.length < (a.cap >= 1 << 19 ? 2 : a.cap >= 1 << 16 ? 6 : a.cap >= 1 << 13 ? 30 : 400)) l.push(a); }; /* the bigger, the fewer kept: the rest to the collector, once in a while */
const bloccoDa = (P, K, cap) => { const l = P.get(cap); let a = l && l.pop(); if (!a) { try { a = new K(cap); } catch (e) { BLOCCHI.F.clear(); BLOCCHI.U.clear(); a = new K(cap); } } a.n = 0; a.resa = false; a.dopo = null; BLOCCHI.usati.push(a); return a; };
const bloccoIdem = (a, P, K, k) => { let c = a.cap * 2; while (c < k) c *= 2; const q = bloccoDa(P, K, c); q.set(a.subarray(0, a.n)); q.n = a.n; q.own = a.own; q.key = a.key; a.own[a.key] = q; a.resa = true; a.dopo = q; a.n = a.cap; bloccoRendi(P, a); return q; }; /* a.dopo: a push through a local copy kept across the handover still lands in the right place */
// Two classes written out, not one made twice: each keeps its own push, or the speed of a push seen on both kinds of number goes
class BloccoF extends Float64Array {
  constructor(cap) { super(cap); this.n = 0; this.cap = cap; this.own = null; this.key = ''; this.resa = false; this.giro = 0; this.dopo = null; }
  static get [Symbol.species]() { return Float64Array; }
  get length() { return this.n; }
  fBlocco() { return this.subarray(0, this.n); }
  push(a, b, c) { const k = arguments.length, n = this.n; if (n + k > this.cap) { if (this.dopo) return this.dopo.push(...arguments); const q = bloccoIdem(this, BLOCCHI.F, BloccoF, n + k); for (let i = 0; i < k; i++) q[n + i] = arguments[i]; return q.n = n + k; } if (k === 3) { this[n] = a; this[n + 1] = b; this[n + 2] = c; } else if (k === 2) { this[n] = a; this[n + 1] = b; } else if (k === 1) this[n] = a; else for (let i = 0; i < k; i++) this[n + i] = arguments[i]; return this.n = n + k; }
  splice(s) { const a = s < 0 ? this.n + s : s, r = Array.from(this.subarray(a, this.n)); this.n = a; return r; } /* only "take the last ones", as the world uses it */
  slice(a, b) { return Array.from(this.subarray(0, this.n).slice(a, b)); }
  [Symbol.iterator]() { return this.subarray(0, this.n)[Symbol.iterator](); }
}
class BloccoU extends Uint32Array {
  constructor(cap) { super(cap); this.n = 0; this.cap = cap; this.own = null; this.key = ''; this.resa = false; this.giro = 0; this.dopo = null; }
  static get [Symbol.species]() { return Uint32Array; }
  get length() { return this.n; }
  fBlocco() { return this.subarray(0, this.n); }
  push(a, b, c, d, e, f) { const k = arguments.length, n = this.n; if (n + k > this.cap) { if (this.dopo) return this.dopo.push(...arguments); const q = bloccoIdem(this, BLOCCHI.U, BloccoU, n + k); for (let i = 0; i < k; i++) q[n + i] = arguments[i]; return q.n = n + k; } if (k === 3) { this[n] = a; this[n + 1] = b; this[n + 2] = c; } else if (k === 6) { this[n] = a; this[n + 1] = b; this[n + 2] = c; this[n + 3] = d; this[n + 4] = e; this[n + 5] = f; } else for (let i = 0; i < k; i++) this[n + i] = arguments[i]; return this.n = n + k; }
  splice(s) { const a = s < 0 ? this.n + s : s, r = Array.from(this.subarray(a, this.n)); this.n = a; return r; }
  slice(a, b) { return Array.from(this.subarray(0, this.n).slice(a, b)); }
  [Symbol.iterator]() { return this.subarray(0, this.n)[Symbol.iterator](); }
}
const Buf = () => { if (!BLOCCHI.on) return { p: [], n: [], uv: [], c: [], i: [] }; const m = BLOCCHI.MIN, b = { p: bloccoDa(BLOCCHI.F, BloccoF, m), n: bloccoDa(BLOCCHI.F, BloccoF, m), uv: bloccoDa(BLOCCHI.F, BloccoF, m), c: bloccoDa(BLOCCHI.F, BloccoF, m), i: bloccoDa(BLOCCHI.U, BloccoU, m) }; for (const k of ['p', 'n', 'uv', 'c', 'i']) { b[k].own = b; b[k].key = k; } return b; };
function blocchiResi() { // the tile is finished: nothing reads its buffers any more, the geometries have their own copy.
  const g = ++BLOCCHI.giro;
  for (const a of BLOCCHI.usati) { if (a.giro === g) continue; a.giro = g; a.own = null; a.dopo = null; if (a.resa) continue; a.resa = true; a.n = 0; bloccoRendi(a instanceof BloccoU ? BLOCCHI.U : BLOCCHI.F, a); }
  BLOCCHI.usati.length = 0;
}
{ // what makes a geometry out of a buffer takes the blocks too, at their real length
  const F0 = THREE.Float32BufferAttribute; THREE.Float32BufferAttribute = class extends F0 { constructor(a, k, nz) { super(a.fBlocco ? a.fBlocco() : a, k, nz); } };
  const si = THREE.BufferGeometry.prototype.setIndex; THREE.BufferGeometry.prototype.setIndex = function (x) { if (x && x.fBlocco) { const v = x.fBlocco(); let m = 0; for (let i = 0; i < v.length; i++) if (v[i] > m) m = v[i]; x = new (m > 65535 ? THREE.Uint32BufferAttribute : THREE.Uint16BufferAttribute)(v, 1); } return si.call(this, x); };
}
function passoTile(g) { BLOCCHI.on = true; try { const r = g.next(); if (r.done) blocchiResi(); return r; } finally { BLOCCHI.on = false; } } /* one slice of the building of a tile */
