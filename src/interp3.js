// ---------------------------------------------------------------- smooth motion between physics steps
// The physics runs at a fixed 60 steps a second, the screen at whatever the phone manages (120, 50, 26...): some frames get two steps, some none,
// and drawn as they are the cars jerk back and forth against the smoothly following camera, the more the faster they go. So before every step the
// state of what moves is kept, and each frame is drawn at the point between the last two steps that the leftover time asks for (a = 0..1), then
// the true state is put back for the next step. The arrays are reused: garbage made 60 times a second makes the phone stop now and then to sweep it
const INTERP_VEH = ['x', 'y', 'z', 'h', 'slope', 'roll', 'pitch', 'ap', 'ar'], INTERP_KEYS = ['x', 'y', 'z', 'h'], INTERP_DONE = [];
function snapOf(o, keys) { const p = o._p || (o._p = new Array(keys.length)); for (let i = 0; i < keys.length; i++) p[i] = o[keys[i]]; o._pk = keys; }
function interpSnap() {
  for (const v of VEH) snapOf(v, INTERP_VEH);
  for (const p of PEDS) snapOf(p, INTERP_KEYS);
  snapOf(P, INTERP_KEYS);
}
function interpMix(o, a) {
  const p = o._p, keys = o._pk; if (!p) return;
  if (hyp(o.x - p[0], o.z - p[2]) > 8) return; // a teleport (respawn, a new car): no in-between
  const c = o._c || (o._c = new Array(keys.length));
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i], cur = o[k]; c[i] = cur; if (p[i] === undefined || cur === undefined) continue;
    o[k] = k === 'h' ? p[i] + wrapA(cur - p[i]) * a : p[i] + (cur - p[i]) * a;
  }
  INTERP_DONE.push(o);
}
function interpBegin(a) {
  INTERP_DONE.length = 0;
  for (const v of VEH) interpMix(v, a);
  for (const p of PEDS) interpMix(p, a);
  interpMix(P, a);
  return INTERP_DONE;
}
function interpEnd(done) { for (const o of done) { const c = o._c, keys = o._pk; for (let i = 0; i < keys.length; i++) o[keys[i]] = c[i]; } done.length = 0; }
