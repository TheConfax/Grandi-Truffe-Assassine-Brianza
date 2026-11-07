"""Una volta sola, fuori dal gioco: ritaglia i singoli cubetti (porfido) o ciottoli (ciottoli) di tex/<nome>.jpg
e scrive tex/<nome>_id.png: R + 256*G = numero del pezzo, B = 255 se il pezzo tocca il bordo della tessera
(la tessera si ripete: un pezzo a cavallo del bordo non puo avere un tono per tessera).
Uso: python src/cubetti_mappa.py porfido|ciottoli [anteprima.png]"""
import sys, numpy as np
from PIL import Image
from scipy import ndimage as ndi
from skimage.segmentation import watershed
from skimage.feature import peak_local_max
from skimage.filters import gaussian, threshold_local

nome = sys.argv[1]
N = 512
img = np.asarray(Image.open(f'tex/{nome}.jpg').convert('RGB')).astype(float) / 255
lum = img @ [.3, .59, .11]
T = np.tile(lum, (3, 3))
if nome == 'porfido':
    sm = gaussian(T, 1.5)
    loc = threshold_local(sm, 61, offset=-0.0)
    solid = sm > loc
    solid = ndi.binary_opening(solid, iterations=2)
    dist = ndi.distance_transform_edt(solid)
    dist = gaussian(dist, 2)
    from skimage.morphology import h_maxima
    hm = ndi.label(h_maxima(dist, 3.5))[0]
    pk = np.array([[int(v) for v in ndi.center_of_mass(hm == i)] for i in range(1, hm.max() + 1)])
else:
    sm = gaussian(T, 1.2)
    loc = threshold_local(sm, 25, offset=0)
    solid = sm > loc
    solid = ndi.binary_opening(solid, iterations=1)
    dist = gaussian(ndi.distance_transform_edt(solid), 1)
    pk = peak_local_max(dist, min_distance=4, labels=ndi.label(solid)[0], exclude_border=False)
mk = np.zeros(T.shape, int)
for i, (y, x) in enumerate(pk): mk[y, x] = i + 1
lab = watershed(-dist, mk)
# pezzo di fondo (nessun marker) non esiste: watershed riempie tutto. Identita canonica: centroide modulo N
n = lab.max() + 1
ys, xs = np.mgrid[0:3 * N, 0:3 * N]
cnt = np.bincount(lab.ravel(), minlength=n).astype(float) + 1e-9
cy = np.bincount(lab.ravel(), ys.ravel(), n) / cnt
cx = np.bincount(lab.ravel(), xs.ravel(), n) / cnt
key = {}
canon = np.zeros(n, int)
for l in range(1, n):
    k = (int(round(cy[l])) % N, int(round(cx[l])) % N)
    if k not in key: key[k] = len(key)
    canon[l] = key[k]
c = canon[lab[N:2 * N, N:2 * N]]
L = lab[N:2 * N, N:2 * N]
# pezzi che toccano il bordo (con tolleranza: nella tessera centrale)
edge = np.zeros(len(key) + 1, bool)
for sl in (c[0, :], c[-1, :], c[:, 0], c[:, -1]): edge[np.unique(sl)] = True
print(nome, 'pezzi', len(key), 'di bordo', int(edge.sum()))
assert len(key) < 65536
out = np.zeros((N, N, 3), np.uint8)
out[..., 0] = c % 256; out[..., 1] = c // 256; out[..., 2] = np.where(edge[c], 255, 0)
Image.fromarray(out).save(f'tex/{nome}_id.png', optimize=True)
if len(sys.argv) > 2:
    rng = np.random.default_rng(3)
    col = rng.integers(40, 255, (len(key) + 1, 3)).astype(np.uint8)
    pv = (col[c] * .6 + (img * 255) * .4).astype(np.uint8)
    b = (np.abs(np.diff(L, axis=0, prepend=L[:1])) + np.abs(np.diff(L, axis=1, prepend=L[:, :1]))) > 0
    pv[b] = 0
    Image.fromarray(pv).resize((1024, 1024), Image.NEAREST).save(sys.argv[2])
