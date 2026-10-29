import json, os
from PIL import Image
ORD=['stop','dare','vietato','transito','destra','rotatoria','sosta','fermata','dritto','pesanti','pedoni','parcheggio']+['limite%d'%v for v in (10,20,30,40,50,60,70,80,90,100,110,120,130)]
C=256; A=Image.new('RGBA',(5*C,5*C+64),(0,0,0,0)); idx={}
def fit(im,W,H):
    im=im.crop(im.getbbox()); s=min(W/im.width,H/im.height); im=im.resize((max(1,round(im.width*s)),max(1,round(im.height*s))),Image.LANCZOS); return im
for i,k in enumerate(ORD):
    im=fit(Image.open('png/%s.png'%k).convert('RGBA'),C-4,C-4); x,y=(i%5)*C,(i//5)*C
    A.paste(im,(x+2,y+2)); idx[k]=[x+2,y+2,im.width,im.height]
for j,k in enumerate(['unico_dx','unico_sx']):
    im=fit(Image.open('png/%s.png'%k).convert('RGBA'),C-4,60); x,y=j*C,5*C
    A.paste(im,(x+2,y+2)); idx[k]=[x+2,y+2,im.width,im.height]
os.makedirs('../../tex',exist_ok=True)
Q=A.quantize(colors=48,method=Image.FASTOCTREE,dither=Image.NONE)
Q.save('../../tex/segnali.png',optimize=True)
A.save('atlante_rgba.png')
print(json.dumps(idx)); print(os.path.getsize('../../tex/segnali.png'),os.path.getsize('atlante_rgba.png'))
