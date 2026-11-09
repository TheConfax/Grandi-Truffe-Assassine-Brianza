import * as THREE_NS from 'three';
import { Sky as THREE_SKY } from 'three/addons/objects/Sky.js';
// three.js 0.186.1, loaded as a module through the import map (assemble3.py). The game was written on r128, where three was a global: THREE is a copy of
// the module's namespace (a module namespace is frozen, and foto3_colori.js swaps THREE.CanvasTexture), and window.THREE stays for the test scripts
const THREE = Object.assign({}, THREE_NS, { Sky: THREE_SKY }); window.THREE = THREE;
{
  // r128 made every InstancedMesh with frustumCulled = false; r186 culls it on a sphere round its instances computed once, so what moves after (objects knocked
  // down, pieces of barrier) would vanish. pezzi3.js puts its own culling sphere (cullS) on the tiles, as before
  const IM = THREE.InstancedMesh;
  THREE.InstancedMesh = class extends IM { constructor(...a) { super(...a); this.frustumCulled = false; } };
  // our shaders were written on r128's chunks: vUv (now vMapUv when only a map is used) and mapTexelToLinear (gone: the hardware decodes sRGB textures)
  THREE.ShaderChunk.common += '\n#define mapTexelToLinear( a ) a\n';
  // r128 lit without physicallyCorrectLights multiplied every light by π, then the Lambert divided by π: the intensities of the game are written for that.
  // r186 has no such mode, and the whole scene came out about three times darker (the wood black at noon): the Lambert keeps r128's scale
  THREE.ShaderChunk.lights_lambert_pars_fragment = THREE.ShaderChunk.lights_lambert_pars_fragment.replaceAll('BRDF_Lambert( material.diffuseColor )', 'material.diffuseColor');
  THREE.ShaderChunk.uv_pars_fragment += '\n#if defined( USE_MAP ) && !defined( USE_UV ) && !defined( USE_ANISOTROPY )\n#define vUv vMapUv\n#endif\n';
}
