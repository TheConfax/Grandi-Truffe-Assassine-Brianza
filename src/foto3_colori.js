// ---------------------------------------------------------------- foto: light computed in linear space (ramo fotorealismo)
// every colour of the game is written in sRGB (0xrrggbb, '#rrggbb', canvas textures), but light only adds up right in linear space.
// On r128 this file converted hex and css colours by hand; three.js 0.186 does it by itself (ColorManagement), and doing it twice made the
// whole town near black. What is left: the canvas textures are drawn in sRGB, so they are decoded (colorSpace, r128's encoding)
{
  const CT = THREE.CanvasTexture;
  THREE.CanvasTexture = class extends CT { constructor(...a) { super(...a); this.colorSpace = THREE.SRGBColorSpace; } };
}
