"""Realismo 3, fase A: rilievo e lucidita' dei materiali (una volta sola, fuori dal gioco).

Scrive tex/<nome>_nr.jpg, 512 px, 4:4:4: R e G = normale (convenzione OpenGL, la z si ricava: z = sqrt(1 - x^2 - y^2)),
B = ruvidita' relativa (128 = la media del materiale; il gioco la moltiplica per la ruvidita' del tipo, riflessi3.js RIF_KIND).
Per il tetto scrive anche tex/tegole.jpg: il colore delle tegole diviso per la media (128 = 1), cosi' il colore del tetto resta quello dell'edificio.

Fonti (CC0, Poly Haven, i file 1k scaricati da dl.polyhaven.org in una cartella a parte, primo argomento):
  asfalto      asphalt_04         nor_gl + arm (G = ruvidita')    stessa foto di tex/asfalto.jpg (4,04 m)
  intonaco     white_stucco_02    nor_gl + arm                    stessa foto di tex/intonaco.jpg (1,8 m)
  pavimento    concrete_floor_02  nor_gl + arm                    tex/pavimento.jpg
  ghiaia       gravel_floor_02    nor_gl + arm                    tex/ghiaia.jpg
  terra        brown_mud_dry      nor_gl + arm                    tex/terra.jpg
  tegole       clay_roof_tiles_02 diff + nor_gl + arm             coppi, 2,5 m
Ricavati dalle nostre foto (la loro fonte non ha un rilievo che combaci):
  marciapiede  le fughe della griglia dei masselli (BLK_PH in foto3.js) + la grana della foto
  porfido, ciottoli  le fughe fra i cubetti di tex/<nome>_id.png + la grana della foto
  prato, terreno     la grana della foto
Uso: python src/tex_pbr.py <cartella dei file Poly Haven>
"""
import os, sys
import numpy as np
from PIL import Image
from scipy import ndimage

SRC = sys.argv[1]
TEX = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'tex')
N = 512


def load(path, mode='RGB', size=N):
    return np.asarray(Image.open(path).convert(mode).resize((size, size), Image.LANCZOS)).astype(np.float64) / 255


def save_nr(name, nx, ny, rough_rel):
    """nx, ny in -1..1 (GL); rough_rel: ruvidita' / media"""
    out = np.stack([nx * .5 + .5, ny * .5 + .5, np.clip(rough_rel * .5, 0, 1)], -1)
    Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)).save(os.path.join(TEX, name + '_nr.jpg'), quality=90, subsampling=0)


def from_ph(name, ph, strength=1.0):
    n = load(os.path.join(SRC, ph + '_nor_gl.jpg')) * 2 - 1
    r = load(os.path.join(SRC, ph + '_arm.jpg'))[..., 1]
    nx, ny = n[..., 0] * strength, n[..., 1] * strength
    save_nr(name, nx, ny, r / max(r.mean(), 1e-3))


def wrap_grad(h, px_m):
    """gradiente di un'altezza in metri su una tessera che si ripete; px_m: metri per pixel"""
    gx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) / (2 * px_m)
    gy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) / (2 * px_m)
    return gx, gy


def normal_from_h(h, px_m, k=1.0):
    gx, gy = wrap_grad(h, px_m)
    nx, ny, nz = -gx * k, gy * k, np.ones_like(h)  # GL: la riga dell'immagine scende, la v sale
    l = np.sqrt(nx * nx + ny * ny + nz * nz)
    return nx / l, ny / l


def grain(img_l, sigma=1.0, depth=0.002):
    """la grana della foto come altezza: il chiaro sta un poco piu' in alto (passa-alto, metri)"""
    hp = img_l - ndimage.gaussian_filter(img_l, 6, mode='wrap')
    return ndimage.gaussian_filter(hp, sigma, mode='wrap') * depth / max(hp.std(), 1e-6)


def rough_from(img_l, joint=None, k=0.25):
    """ruvidita' relativa: lo scuro (sporco, fughe) un poco piu' ruvido"""
    r = 1 + k * (img_l.mean() - img_l) / max(img_l.std(), 1e-6) * .5
    if joint is not None: r = r + joint
    return r / r.mean()


# --- Poly Haven, la stessa foto del colore
from_ph('asfalto', 'asphalt_04', 1.0)
from_ph('intonaco', 'white_stucco_02', 0.8)
from_ph('pavimento', 'concrete_floor_02', 1.0)
from_ph('ghiaia', 'gravel_floor_02', 1.0)
from_ph('terra', 'brown_mud_dry', 1.0)
from_ph('tegole', 'clay_roof_tiles_02', 1.0)
# il colore delle tegole come rapporto con la media (lineare), 128 = 1
d = load(os.path.join(SRC, 'clay_roof_tiles_02_diff.jpg')) ** 2.2
rat = d / d.reshape(-1, 3).mean(0)
rat = np.clip(.5 + (rat - 1) * .5 * .9, 0, 1)  # un poco meno contrasto della foto: il colore lo da' la casa
Image.fromarray((rat * 255 + .5).astype(np.uint8)).save(os.path.join(TEX, 'tegole.jpg'), quality=88)

# --- marciapiede: masselli 20x10 cm a correre (la griglia di foto3.js), 512 px = 2 m
img = load(os.path.join(TEX, 'marciapiede.jpg'), 'L')
PH = [25.4, 0.2, 25.2, 0.4, 26.0, 0.6, 26.0, 0.2, 25.8, 0.6, 26.0, 0.6, 26.0, 0.6, 26.0, 0.4, 25.4, 50.6, 25.2, 0.0]
yy, xx = np.mgrid[0:N, 0:N] + .5
r = np.floor(np.mod(yy - 25, 512) / 25.6).astype(int)
ph = np.array(PH)[r]
ly = np.mod(yy - 25, 25.6)  # dentro la riga
lx = np.mod(xx - ph, 51.2)  # dentro il blocco
de = np.minimum(np.minimum(ly, 25.6 - ly), np.minimum(lx, 51.2 - lx))  # pixel dal bordo del blocco
h = -0.006 * np.exp(-(de / 2.2) ** 2) + 0.0015 * (1 - np.exp(-(de / 6) ** 2)) + grain(img, 1.0, 0.0006)  # fuga 6 mm, bordo smussato
nx, ny = normal_from_h(h, 2 / N)
save_nr('marciapiede', nx, ny, rough_from(img, 0.25 * np.exp(-(de / 2.5) ** 2)))

# --- porfido (1 m) e ciottoli (4 m)
for name, size_m, wpx, dep, gd in [('porfido', 1.0, 3.0, 0.008, 0.0012), ('ciottoli', 4.0, 1.6, 0.012, 0.002)]:
    img = load(os.path.join(TEX, name + '.jpg'), 'L')
    q = np.asarray(Image.open(os.path.join(TEX, name + '_id.png')).convert('RGB')).astype(np.int64)
    ids = q[..., 0] + 256 * q[..., 1]
    edge = np.zeros(ids.shape, bool)
    for ax in (0, 1):
        for s in (1, -1):
            edge |= ids != np.roll(ids, s, ax)
    de = ndimage.distance_transform_edt(~edge)
    dome = 1 - np.exp(-(de / (wpx * 3)) ** 2)  # il cubetto un poco bombato
    h = -dep * np.exp(-(de / wpx) ** 2) + dep * .25 * dome + grain(img, 1.0, gd)
    nx, ny = normal_from_h(h, size_m / N)
    save_nr(name, nx, ny, rough_from(img, 0.3 * np.exp(-(de / wpx) ** 2)))

# --- prato (2 m) e terreno (2 m): la grana
for name, size_m, gd in [('prato', 2.0, 0.006), ('terreno', 2.0, 0.004)]:
    img = load(os.path.join(TEX, name + '.jpg'), 'L')
    h = grain(img, 0.8, gd)
    nx, ny = normal_from_h(h, size_m / N)
    save_nr(name, nx, ny, rough_from(img))
print('ok')

# --- tombini (realismo 3, fase A, rifatti su indicazione di Carlo 13/11): ambientCG, CC0, secondo argomento la cartella con i pacchetti scompattati.
# Atlante di 5 caselle da 128 px, tex/chiusini.png (colore e opacita') e tex/chiusini_nr.jpg:
#   0 chiusino della fogna, tondo, ghisa scura (ManholeCover006)    1 tondo piccolo dei servizi (ManholeCover003)
#   2 caditoia a fessure / griglia (Grate002)                        3 quadrato pieno a rombi dei servizi (DiamondPlate008A, ricolorato ghisa, con la cornice)
#   4 la toppa d'asfalto attorno al chiusino (la nostra foto dell'asfalto, schiarita, bordo irregolare)
if len(sys.argv) > 2:
    ACG = sys.argv[2]; S = 128; NS = 5
    col = Image.new('RGBA', (NS * S, S), (0, 0, 0, 0)); nr = np.zeros((S, NS * S, 3)); nr[..., 0] = nr[..., 1] = .5; nr[..., 2] = .5
    def put(i, c, o, n, r):
        w, h = c.size; k = S / max(w, h); W, Hh = max(1, round(w * k)), max(1, round(h * k)); x0, y0 = i * S + (S - W) // 2, (S - Hh) // 2
        rgba = c.resize((W, Hh), Image.LANCZOS).convert('RGBA'); rgba.putalpha(o.resize((W, Hh), Image.LANCZOS)); col.paste(rgba, (x0, y0))
        na = np.asarray(n.resize((W, Hh), Image.LANCZOS)).astype(float) / 255; ra = np.asarray(r.resize((W, Hh), Image.LANCZOS)).astype(float) / 255
        nr[y0:y0 + Hh, x0:x0 + W, 0] = na[..., 0]; nr[y0:y0 + Hh, x0:x0 + W, 1] = na[..., 1]; nr[y0:y0 + Hh, x0:x0 + W, 2] = np.clip(ra / max(ra.mean(), 1e-3) * .5, 0, 1)
        print('casella', i, 'pixel', W, Hh)
    for i, a in enumerate(['ManholeCover006', 'ManholeCover003', 'Grate002']):
        base = os.path.join(ACG, a, a + '_1K-PNG_')
        c = Image.open(base + 'Color.png').convert('RGB'); o = Image.open(base + 'Opacity.png').convert('L'); bb = o.point(lambda v: 255 if v > 128 else 0).getbbox()
        put(i, c.crop(bb), o.crop(bb), Image.open(base + 'NormalGL.png').convert('RGB').crop(bb), Image.open(base + 'Roughness.png').convert('L').crop(bb))
    # 3: diamond plate, a 45 cm square: a third of the 1K photo, cast iron (dark grey-brown), a frame of 6 px
    base = os.path.join(ACG, 'DiamondPlate008', 'DiamondPlate008A_1K-JPG_'); bb = (0, 0, 340, 340)
    c = Image.open(base + 'Color.jpg').convert('L').crop(bb); ca = np.asarray(c).astype(float) / 255; ca = .25 + .5 * (ca - ca.mean()) / max(ca.std(), 1e-3) * .12 + .0
    rgb = np.stack([ca * 1.05, ca * .97, ca * .9], -1); fr = np.zeros(ca.shape, bool); fr[:18] = fr[-18:] = True; fr[:, :18] = fr[:, -18:] = True; rgb[fr] *= .7
    nn = np.asarray(Image.open(base + 'NormalGL.jpg').convert('RGB').crop(bb)).copy(); nn[fr] = (128, 128, 255)
    put(3, Image.fromarray((np.clip(rgb, 0, 1) * 255).astype(np.uint8)), Image.new('L', c.size, 255), Image.fromarray(nn), Image.open(base + 'Roughness.jpg').convert('L').crop(bb))
    # 4: the patch: the asphalt photo paler and rougher in a square with a ragged edge
    a = Image.open(os.path.join(TEX, 'asfalto.jpg')).convert('RGB').resize((S, S), Image.LANCZOS); aa = np.asarray(a).astype(float) / 255  # our asphalt, a little paler
    aa = np.clip(aa * 1.22 + .02, 0, 1)
    yy, xx = np.mgrid[0:S, 0:S]; edge = np.minimum(np.minimum(xx, S - 1 - xx), np.minimum(yy, S - 1 - yy)).astype(float)
    rng = np.random.default_rng(3); noise = np.asarray(Image.fromarray((rng.random((16, 16)) * 255).astype(np.uint8)).resize((S, S), Image.BICUBIC)).astype(float) / 255
    alpha = ((edge - 3 - 5 * noise) > 0).astype(np.uint8) * 255
    put(4, Image.fromarray((aa * 255).astype(np.uint8)), Image.fromarray(alpha), Image.new('RGB', (S, S), (128, 128, 255)), Image.new('L', (S, S), 200))
    col.save(os.path.join(TEX, 'chiusini.png'), optimize=True)
    Image.fromarray((nr * 255 + .5).astype(np.uint8)).save(os.path.join(TEX, 'chiusini_nr.jpg'), quality=90, subsampling=0)
