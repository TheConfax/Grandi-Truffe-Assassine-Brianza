"""Giro del verde (Carlo 14/11): le foto del prato e dei campi (una volta sola, fuori dal gioco).

Scrive in tex/ le foto viste dall'alto che il gioco mescola in verde3.js (prato vero per tipo, campi):
  prato_g.jpg  1024 px  prato rasato, verde fitto            ambientCG Grass004
  prato_e.jpg  1024 px  prato con trifoglio e terra rada     ambientCG Grass007
  prato_s.jpg   512 px  erba secca e rada, giallina, verde oliva   Poly Haven grass_ground (Charlotte Baglioni)
  prato_t.jpg   512 px  terra con erba rada (terra che affiora) ambientCG Ground037
  zolle.jpg     512 px  terra arata a zolle                  Poly Haven farm_soil (Amal Kumar)
  zolle_nr.jpg  512 px  il suo rilievo (R, G normale GL; B ruvidita' relativa, come tex_pbr.py)
  paglia.jpg    512 px  paglia (rotoballe, stoppie)          Poly Haven reed_roof_03 (la parte di paglia, ritagliata)
Tutti CC0. Uso: python src/tex_verde.py <cartella dei file scaricati>: dentro i 1K di ambientCG scompattati nelle loro cartelle
(<Id>/<Id>_1K-JPG_Color.jpg) e i 1k di Poly Haven (<nome>_diff.jpg, <nome>_nor_gl.jpg, <nome>_arm.jpg).
"""
import os, sys
import numpy as np
from PIL import Image

SRC = sys.argv[1]
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tex')


def img(path, size, box=None):
    im = Image.open(path).convert('RGB')
    if box: im = im.crop(box)
    return im.resize((size, size), Image.LANCZOS)


def save(im, name, q=88):
    im.save(os.path.join(TEX, name), quality=q, subsampling=0)


def seamless(im):
    """a crop of a photo made to repeat: the edges blended with the opposite side over a band of 1/8"""
    a = np.asarray(im).astype(np.float64); n = a.shape[0]; b = n // 8
    w = np.clip(np.arange(n) / b, 0, 1)[:, None, None] * np.clip((n - 1 - np.arange(n)) / b, 0, 1)[:, None, None]
    r = np.roll(a, n // 2, 0); a = a * w + r * (1 - w)
    w2 = np.transpose(w, (1, 0, 2)); r = np.roll(a, n // 2, 1); a = a * w2 + r * (1 - w2)
    return Image.fromarray(np.clip(a + .5, 0, 255).astype(np.uint8))


acg = lambda i: os.path.join(SRC, 'acg', i, i + '_1K-JPG_Color.jpg')
save(img(acg('Grass004'), 1024), 'prato_g.jpg')
save(img(acg('Grass007'), 1024), 'prato_e.jpg')
save(img(os.path.join(SRC, 'grass_ground_diff.jpg'), 512), 'prato_s.jpg')
save(img(acg('Ground037'), 512), 'prato_t.jpg')
save(img(os.path.join(SRC, 'farm_soil_diff.jpg'), 512), 'zolle.jpg')
# the relief of the ploughed soil, as tex_pbr.py from_ph
n = np.asarray(img(os.path.join(SRC, 'farm_soil_nor_gl.jpg'), 512)).astype(np.float64) / 255 * 2 - 1
r = np.asarray(img(os.path.join(SRC, 'farm_soil_arm.jpg'), 512)).astype(np.float64)[..., 1] / 255
out = np.stack([n[..., 0] * .5 + .5, n[..., 1] * .5 + .5, np.clip(r / max(r.mean(), 1e-3) * .5, 0, 1)], -1)
Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)).save(os.path.join(TEX, 'zolle_nr.jpg'), quality=90, subsampling=0)
# straw: the thatch of reed_roof_03 without its top band (the binding), made to repeat
p = Image.open(os.path.join(SRC, 'reed_roof_03_diff.jpg')); W, Hh = p.size
save(seamless(img(os.path.join(SRC, 'reed_roof_03_diff.jpg'), 512, (0, int(Hh * .3), W, Hh))), 'paglia.jpg')
print('fatto')
