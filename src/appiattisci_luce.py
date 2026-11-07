"""Una volta sola: toglie dalla foto del porfido e dei ciottoli le zone chiare e scure grandi (luce non uniforme).
Sfoca la tessera in modo periodico (raggio grande, wrap ai bordi), divide l'originale per la sfocata e riporta alla media.
Uso: python src/appiattisci_luce.py porfido|ciottoli  (sovrascrive tex/<nome>.jpg; l'originale resta in tex/<nome>_orig.jpg)"""
import sys, os, numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter
nome = sys.argv[1]; sigma = {'porfido': 40, 'ciottoli': 30}[nome]
orig = f'tex/{nome}_orig.jpg'
if not os.path.exists(orig): os.replace(f'tex/{nome}.jpg', orig)
img = np.asarray(Image.open(orig).convert('RGB')).astype(float) / 255
lum = img @ [.3, .59, .11]
blur = gaussian_filter(lum, sigma, mode='wrap')
out = img * (lum.mean() / np.maximum(blur, 1e-3))[..., None]
Image.fromarray((np.clip(out, 0, 1) * 255 + .5).astype(np.uint8)).save(f'tex/{nome}.jpg', quality=93)
print(nome, 'lum min/max blur', blur.min(), blur.max())
