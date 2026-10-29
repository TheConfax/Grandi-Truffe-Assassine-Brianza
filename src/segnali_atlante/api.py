import urllib.request, urllib.parse, json, sys
UA='GTA-Brianza-game/1.0 (carlo.confalonieri@websim.it) python-urllib'
def api(**p):
    p['format']='json'; u='https://commons.wikimedia.org/w/api.php?'+urllib.parse.urlencode(p)
    return json.load(urllib.request.urlopen(urllib.request.Request(u,headers={'User-Agent':UA})))
if __name__=='__main__':
    for cat in sys.argv[1:]:
        r=api(action='query',list='categorymembers',cmtitle=cat,cmlimit=500)
        for m in r['query']['categorymembers']: print(m['title'])
