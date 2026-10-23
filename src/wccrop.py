# Ritaglia ESA WorldCover sull'area del gioco: data/worldcover/ESA_WorldCover_...tif -> data/worldcover/wc/wc.npy + wc_meta.txt
import tifffile, numpy as np, sys, os
DATA = os.path.join(os.environ.get('GTA_DATA', os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data')), 'worldcover')
os.makedirs(os.path.join(DATA, 'wc'), exist_ok=True)
f = os.path.join(DATA, 'ESA_WorldCover_10m_2021_v200_N45E009_Map.tif')
with tifffile.TiffFile(f) as t:
    p=t.pages[0]; print(p.shape, p.dtype, p.is_tiled, p.tilewidth, p.tilelength, p.compression)
    tags={'ModelPixelScaleTag':p.tags[33550].value,'ModelTiepointTag':p.tags[33922].value}; print(tags)
    sx=tags['ModelPixelScaleTag'][0]; lon0=tags['ModelTiepointTag'][3]; lat0=tags['ModelTiepointTag'][4]
    W,S,E,N=9.105,45.625,9.203,45.690
    c0,c1=int((W-lon0)/sx),int((E-lon0)/sx)+1; r0,r1=int((lat0-N)/sx),int((lat0-S)/sx)+1
    tw,th=p.tilewidth,p.tilelength; ntx=(p.shape[1]+tw-1)//tw
    out=np.zeros((r1-r0,c1-c0),np.uint8)
    fh=t.filehandle
    for ty in range(r0//th, (r1-1)//th+1):
        for tx in range(c0//tw, (c1-1)//tw+1):
            i=ty*ntx+tx; fh.seek(p.dataoffsets[i]); data=fh.read(p.databytecounts[i])
            tile=p.decode(data,i)[0].reshape(th,tw)
            y0,x0=ty*th,tx*tw
            ys,ye=max(r0,y0),min(r1,y0+th); xs,xe=max(c0,x0),min(c1,x0+tw)
            out[ys-r0:ye-r0, xs-c0:xe-c0]=tile[ys-y0:ye-y0, xs-x0:xe-x0]
    np.save(os.path.join(DATA, 'wc', 'wc.npy'),out); print(out.shape, np.unique(out,return_counts=True), 'origin', lon0+c0*sx, lat0-r0*sx, sx)
    open(os.path.join(DATA, 'wc', 'wc_meta.txt'),'w').write(f"{lon0+c0*sx} {lat0-r0*sx} {sx}")
