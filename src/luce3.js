// ---------------------------------------------------------------- daylight as it is (three.js 0.186, fase 2): sun, sky, bounce, haze and exposure from the sun's height
// The sun's light comes through the air: the longer the path (air mass, low sun) the less light and the warmer, blue going first (Rayleigh), the haze (aerosol,
// LUCE.tau) taking all colours a little. The sky gives a soft blue light from everywhere, about a fifth of the whole on a clear noon (so the shadows are a fifth of the sun);
// the ground sends back some of what falls on it (albedo 0.2, warm grey). The camera adapts in part, like an eye or a photo: a winter noon is darker than a summer one,
// but not as much as the light. The season comes from the true date (the shops' clock does the same), or from the link: ?stagione=primavera|estate|autunno|inverno.
// The hours of the day stay the game's (sunrise and sunset as before): the season changes how high the sun climbs, the colour of the light and the haze
const LUCE = (() => {
  const doy = STAG_DOY; /* stagioni3.js: the true date or ?stagione= */
  const D = Math.PI / 180, lat = 45.66 * D, decl = 23.44 * D * Math.sin(2 * Math.PI * (284 + doy) / 365);
  const e = 0.5 + 0.5 * Math.sin(decl) / Math.sin(23.44 * D); // 0 at the winter solstice, 1 at the summer one
  const aut = Math.max(0, Math.sin(2 * Math.PI * (doy - 200) / 365)); // late summer and autumn: the low golden haze of September-November
  const nome = doy < 80 || doy >= 355 ? 'inverno' : doy < 172 ? 'primavera' : doy < 266 ? 'estate' : 'autunno';
  return {
    doy, nome, e,
    alto: Math.sin(Math.PI / 2 - lat + decl) / Math.sin(Math.PI / 2 - lat), // how high the noon sun is against the equinox one (sin of the height)
    tau: 0.1 + 0.16 * e + 0.04 * aut, // aerosol depth: clear cold winter air, hazy Po-valley summer
    // the colour of the season's light, on sun and sky by day: winter cold and pale, summer warm, autumn golden, spring neutral and fresh
    wb: new THREE.Color().setRGB(0.93, 0.975, 1.09).lerp(new THREE.Color().setRGB(1.06, 1.0, 0.91), e).lerp(new THREE.Color().setRGB(1.09, 1.0, 0.84), 0.7 * aut),
    fredda: 1 - e, // winter light: bluer sky light and shadows
    exp: 1, key: 1, day: 1, ghi: 0, dhi: 0, _c: new THREE.Color(), _s: new THREE.Color(), _g: new THREE.Color(),
  };
})();
const LUCE_K = 2.0, LUCE_RAY = [0.042, 0.072, 0.15], LUCE_AER = [1, 1.08, 1.2]; // overall scale (r128's units, see three186.js), Rayleigh and aerosol depth per colour
const _luceWb = new THREE.Color();
function luceGiorno(L) {
  const el = L.elDeg, D = Math.PI / 180, s = Math.max(0, Math.sin(el * D)), ep = Math.max(el, 0);
  const m = 1 / (Math.sin(ep * D) + 0.50572 * Math.pow(ep + 6.07995, -1.6364)); // Kasten-Young air mass
  const up = clamp((el + 0.6) / 1.6, 0, 1), tau = LUCE.tau;
  const c = LUCE._c.setRGB(Math.exp(-m * (LUCE_RAY[0] + tau * LUCE_AER[0])), Math.exp(-m * (LUCE_RAY[1] + tau * LUCE_AER[1])), Math.exp(-m * (LUCE_RAY[2] + tau * LUCE_AER[2])));
  const dni = c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722; c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, 1e-4));
  // the sky's light on the flat: grows with the sun, more in haze; dusk keeps a glow for a while after sunset; the night has the moon and the town
  const tw = 0.05 * Math.exp(Math.min(el, 4) / 2.4) * clamp((el + 10) / 6, 0, 1);
  const dhi = (0.07 + 0.55 * tau) * Math.pow(s, 0.8) + tw;
  const day = clamp((el + 2) / 8, 0, 1), nightI = 1 - day;
  sun.intensity = LUCE_K * dni * up * day + 0.33 * nightI; LUCE.day = day; // under the horizon the "sun" is the moon (high, as before)
  sun.color.copy(c).multiply(LUCE.wb).lerp(hexC(0x8fa6d8), nightI);
  // sky light: blue by day (bluer in winter, whiter in haze), violet-blue at dusk, dark blue at night
  const sk = LUCE._s.setRGB(0.62 + 0.25 * tau, 0.76 + 0.12 * tau, 1);
  sk.lerp(hexC(0x8a86b8), L.dusk * 0.5); if (LUCE.fredda > 0) sk.b *= 1 + 0.06 * LUCE.fredda;
  hemi.intensity = LUCE_K * dhi * day + 0.65 * nightI; /* the night as before */ hemi.color.copy(sk).multiply(LUCE.wb).lerp(hexC(0x5a6fa8), nightI);
  // the ground's bounce, on what faces down and on the walls in shade: what falls on the ground times its albedo, as a share of the sky light
  const ghi = dni * up * s + dhi, gr = LUCE._g.setRGB(0.24, 0.21, 0.17).multiplyScalar(clamp(ghi / Math.max(dhi, 0.02), 0, 6) * 0.9);
  hemi.groundColor.copy(gr).lerp(hexC(0x2a2a36), nightI);
  LUCE.ghi = LUCE_K * ghi * day; LUCE.dhi = LUCE_K * dhi * day;
  // haze: warm-white in summer, a little bluer in winter; the visibility shorter in the summer haze
  scene.fog.color.copy(mixHex(0x1f2a44, 0xd9dbd6, L.day)).lerp(hexC(0xe8dcc4), L.day * (0.25 + 0.4 * LUCE.e)).lerp(hexC(0xe39a72), L.dusk * 0.55);
  scene.fog.far = (560 + 160 * L.day) * Math.pow(0.2 / tau, 0.7 * L.day); scene.fog.color.multiply(_luceWb.copy(LUCE.wb).lerp(hexC(0xffffff), 1 - L.day));
}
// the exposure, after the weather: about the square root of the light on the flat (an eye adapts in part), never under the night's floor
function luceEsp() {
  const key = Math.max(0.1, (sun.intensity - WX.flash * 0.8) * Math.max(0, SUN_DIR.y) + hemi.intensity - WX.flash * 2.2);
  LUCE.key = key; LUCE.exp = lerp(1.1, clamp(1.1 * Math.pow(1.3 / key, 0.38), 0.85, 1.6), LUCE.day); renderer.toneMappingExposure = LUCE.exp; /* the night keeps its exposure: the lamps were made for it */
}
