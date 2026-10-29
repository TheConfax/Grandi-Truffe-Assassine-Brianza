import time, json, os, urllib.request, re, html
from api import api, UA
P='Italian traffic signs - '
F={'stop':'fermarsi e dare precedenza - stop','dare':'dare precedenza','vietato':'senso vietato','transito':'divieto di transito','destra':'passaggio obbligatorio a destra',
 'rotatoria':'rotatoria','sosta':'divieto di sosta','fermata':'divieto di fermata','dritto':'direzione obbligatoria dritto','pesanti':'divieto di transito ai veicoli da trasporto',
 'pedoni':'attraversamento pedonale','parcheggio':'parcheggio (figura II 76)','unico_dx':'senso unico (a destra)','unico_sx':'senso unico (a sinistra)'}
for v in (10,20,30,40,50,60,70,80,90,100,110,120,130): F['limite%d'%v]='limite di velocità %d'%v
os.makedirs('svg',exist_ok=True); meta={}
items=list(F.items())
for i in range(0,len(items),10):
    ch=items[i:i+10]; t='|'.join('File:'+P+n+'.svg' for k,n in ch)
    r=api(action='query',titles=t,prop='imageinfo',iiprop='url|extmetadata|size',iiextmetadatafilter='LicenseShortName|Artist|Credit|LicenseUrl|Copyrighted|UsageTerms')
    byt={p['title']:p for p in r['query']['pages'].values()}
    for k,n in ch:
        p=byt.get('File:'+P+n+'.svg')
        if not p or 'imageinfo' not in p: print('MANCA',k,n); continue
        ii=p['imageinfo'][0]; em=ii['extmetadata']; g=lambda x: html.unescape(re.sub('<[^>]+>','',em.get(x,{}).get('value','')))
        meta[k]=dict(file=p['title'],url=ii['url'],w=ii['width'],h=ii['height'],lic=g('LicenseShortName'),artist=g('Artist')[:120],copy=g('Copyrighted'))
        if os.path.exists('svg/%s.svg'%k): continue
        for tr in range(8):
            try: d=urllib.request.urlopen(urllib.request.Request(ii['url'],headers={'User-Agent':UA})).read(); break
            except Exception as e: print('retry',k,e); time.sleep(20)
        open('svg/%s.svg'%k,'wb').write(d); time.sleep(3)
json.dump(meta,open('meta.json','w'),ensure_ascii=False,indent=1)
for k,m in meta.items(): print(k,m['w'],m['h'],m['lic'],'|',m['artist'])
