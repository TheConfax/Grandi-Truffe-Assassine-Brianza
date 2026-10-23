# usage: python src/foto3_intonaco.py white_stucco_02_diff_1k.jpg tex/intonaco.jpg (the 1k diffuse jpg from polyhaven.com)
# grain of the plaster for the facades: Poly Haven "White Stucco 02" (Dimitrios Savva, CC0), 1.8 m a side.
# Grey, centred on 128 (= leave the wall's colour as it is), with the large-scale blotches taken out so that only the grain remains
import sys
from PIL import Image, ImageFilter, ImageStat
src, dst = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('L').resize((512, 512), Image.LANCZOS)
low = im.filter(ImageFilter.GaussianBlur(24))  # blotches bigger than ~8 cm
px, lp = im.load(), low.load()
out = Image.new('L', im.size)
op = out.load()
for y in range(512):
    for x in range(512):
        op[x, y] = max(0, min(255, int(128 + (px[x, y] - lp[x, y]) * 1.6)))
print('media', ImageStat.Stat(out).mean, 'dev', ImageStat.Stat(out).stddev)
out.save(dst, quality=90)
