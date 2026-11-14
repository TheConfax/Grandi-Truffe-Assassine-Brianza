// ---------------------------------------------------------------- lights of the evening (realismo 2, fase B)
// A lamp, a headlight are a hundred times brighter than the wall they light: drawn at the wall's brightness they looked like painted white boxes. Their bulbs are
// now as bright as they are (above white: the tone mapping keeps them white and the glow of post3.js spreads them, a halo as in a photo or the eye).
// The headlights and tail lights of the cars far away keep a few pixels of glare (in the distance one sees the lights before the car), and the lit
// windows are not all the same: most a warm yellow, some the cool white of LED lamps, a few the blue of a television (WIN_TINTA, on the three window shaders)
const SERA = { lamp: 6.5, head: 5.5, tail: 2.2, minHead: 4.5, minTail: 3.5, minLamp: 3 };
{
  const udnS = updDayNight;
  updDayNight = function (dt) { // after the day's own values, every frame: the bulbs above white (only at night: by day they are off, as before)
    udnS(dt); const on = LIGHTS.on;
    MAT.lampHead.emissiveIntensity = 0.3 + SERA.lamp * on; M_HEAD.emissiveIntensity = 0.6 + SERA.head * on; M_TAIL.emissiveIntensity = 0.5 + SERA.tail * on;
  };
  const minPx = (m, px) => { // the halo of a light keeps px pixels however far it is (fog still fades it: glowFog)
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (s, r) => { if (prev) prev.call(m, s, r); s.vertexShader = s.vertexShader.replace('#include <logdepthbuf_vertex>', 'gl_PointSize = max( gl_PointSize, ' + px.toFixed(1) + ' );\n#include <logdepthbuf_vertex>'); };
    const ck = m.customProgramCacheKey ? m.customProgramCacheKey() : ''; m.customProgramCacheKey = () => ck + '|min' + px; m.needsUpdate = true;
  };
  minPx(CARGLOW[0].material, SERA.minHead); minPx(CARGLOW[1].material, SERA.minTail); minPx(LAMPGLOW_MAT, SERA.minLamp);
}
// the colour of a lit window from its own hash wh: 70% warm (as the emissive), 20% cool white, 10% television blue
const WIN_TINTA = wh => `( fract( ${wh} * 13.7 ) < 0.7 ? vec3( 1.0 ) : fract( ${wh} * 13.7 ) < 0.9 ? vec3( 0.8, 0.95, 1.3 ) : vec3( 0.5, 0.72, 1.45 ) )`;
