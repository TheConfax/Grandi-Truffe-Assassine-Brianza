// ---------------------------------------------------------------- foto: light computed in linear space (ramo fotorealismo)
// every colour of the game is written in sRGB (0xrrggbb, '#rrggbb', canvas textures), but light only adds up right in linear space:
// hex and css colours are converted on the way in, read back in sRGB (canvas styles made from them), canvas textures are decoded,
// and the renderer encodes the image at the end. three.js does all this by itself from r152; this is r128
{
  const C = THREE.Color.prototype, sh = C.setHex, ss = C.setStyle, gh = C.getHex, gs = C.getStyle, tmp = new THREE.Color(); let inStyle = false;
  C.setHex = function (h) { sh.call(this, h); return inStyle ? this : this.convertSRGBToLinear(); };
  C.setStyle = function (s) { inStyle = true; try { ss.call(this, s); } finally { inStyle = false; } return this.convertSRGBToLinear(); }; // a colour name goes through setHex: once only
  C.getHex = function () { return gh.call(tmp.copy(this).convertLinearToSRGB()); };
  C.getStyle = function () { return gs.call(tmp.copy(this).convertLinearToSRGB()); };
  const CT = THREE.CanvasTexture;
  THREE.CanvasTexture = class extends CT { constructor(...a) { super(...a); this.encoding = THREE.sRGBEncoding; } };
}
