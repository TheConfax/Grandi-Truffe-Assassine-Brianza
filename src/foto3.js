// ---------------------------------------------------------------- foto: photographic surfaces (ramo fotorealismo)
// the drawn textures of the ground surfaces get the grain of real photos (Poly Haven, CC0), recoloured to the same mean colour
// (tex/*.jpg, made from the originals by the script in the commit): same palette, real asphalt cracks, blades of grass, paving joints.
// The texture object stays the same, so every material using it follows; repeat turns the UV scale the surface was drawn with
// (metres per repeat) into the size of the photo (metres)
const FOTO_TEX = [[asphaltTex, 'asfalto', 9 / 3], [grassTex, 'prato', 9 / 2], [groundTex, 'terreno', 10 / 2], [sidewalkTex, 'marciapiede', 4 / 1.8], [porfidoTex, 'porfido', 4 / 1]];
{
  const ld = new THREE.TextureLoader();
  for (const [t, f, r] of FOTO_TEX) ld.load('tex/' + f + '.jpg', img => { t.image = img.image; t.repeat.set(r, r); t.needsUpdate = true; });
}
// output in sRGB, through a filmic curve: highlights roll off instead of clipping
renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
// in linear light the sky's fill counts for less than in the old sums, and the fog took the curve's warm cast: more fill in the
// shadows, a cooler and greyer haze by day. On top of what updDayNight sets every frame
const FOTO_HEMI = 1.3, FOTO_SUN = 1.1, FOTO_FOGGREY = new THREE.Color(0xc9ced4);
{
  const udn = updDayNight;
  updDayNight = function (dt) {
    udn(dt); hemi.intensity *= FOTO_HEMI; sun.intensity *= FOTO_SUN; scene.fog.color.lerp(FOTO_FOGGREY, 0.45 * lightTones().day);
    _far.material.color.convertSRGBToLinear(); _near.material.color.convertSRGBToLinear(); // the mountains' shade is set as a plain number
  };
}
// ambient occlusion on the walls (AO_WALL in world3.js), after the patch that lights the windows
for (const [k, m] of Object.entries({ old: MAT.old, mod: MAT.mod, plain: MAT.plain })) {
  const before = m.onBeforeCompile; m.onBeforeCompile = s => { before.call(m, s); AO_WALL(s); }; m.customProgramCacheKey = () => 'ao-' + k; m.needsUpdate = true;
}
