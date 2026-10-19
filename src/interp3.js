// ---------------------------------------------------------------- smooth motion between physics steps
// The physics runs at a fixed 60 steps a second, the screen at whatever the phone manages (120, 50, 26...): some frames get two steps, some none,
// and drawn as they are the cars jerk back and forth against the smoothly following camera, the more the faster they go. So before every step the
// state of what moves is kept, and each frame is drawn at the point between the last two steps that the leftover time asks for (a = 0..1), then
// the true state is put back for the next step.
const INTERP_KEYS = ['x', 'y', 'z', 'h'], INTERP_ANG = { h: true };
function interpSnap() {
  for (const v of VEH) v._p = [v.x, v.y, v.z, v.h, v.slope, v.roll, v.pitch];
  for (const p of PEDS) p._p = [p.x, p.y, p.z, p.h];
  P._p = [P.x, P.y, P.z, P.h];
}
function interpBegin(a) {
  const done = [];
  const mix = (o, keys) => {
    if (!o._p) return; const cur = keys.map(k => o[k]);
    if (hyp(cur[0] - o._p[0], cur[2] - o._p[2]) > 8) return; // a teleport (respawn, a new car): no in-between
    o._c = cur; keys.forEach((k, i) => { const p = o._p[i], c = cur[i]; if (p === undefined || c === undefined) return; o[k] = INTERP_ANG[k] ? p + wrapA(c - p) * a : p + (c - p) * a; });
    done.push([o, keys]);
  };
  for (const v of VEH) mix(v, ['x', 'y', 'z', 'h', 'slope', 'roll', 'pitch']);
  for (const p of PEDS) mix(p, INTERP_KEYS);
  mix(P, INTERP_KEYS);
  return done;
}
function interpEnd(done) { for (const [o, keys] of done) { keys.forEach((k, i) => { o[k] = o._c[i]; }); o._c = null; } }
