import json,math,sys,sqlite3,collections
import xml.etree.ElementTree as ET
sys.path.insert(0,'../snap5/src'); sys.path.insert(0,'.')
import pubblici as P
from shapely.geometry import Polygon,Point
from shapely.ops import unary_union
from shapely.strtree import STRtree
lat0,lon0=45.6575,9.154
KX,KZ=111320*math.cos(math.radians(lat0)),110540
proj=lambda la,lo:((lo-lon0)*KX,-(la-lat0)*KZ)
allb=json.load(open('allb.json'))
conf=Polygon(json.load(open('../snap5/confine_dbgt.json'))['comuni'][0]['p']).buffer(0)
# DBGT ed list
D='C:/Users/theco/GitHub/GTA-Brianza/data/dbt/%s/dbgt.gpkg'
ed=[]
for com in ('Meda','Seveso'):
    con=sqlite3.connect(D%com); uso=collections.defaultdict(list)
    for cid,u in con.execute('select CLASSREF, EDIFC_USO from EDIFC_EDIFC_USO'): uso[cid].append(u or '')
    for kind,tab,cols in (('E','EDIFC','EDIFC_TY, EDIFC_STAT'),('M','EDI_MIN','EDI_MIN_TY, EDI_MIN_ST')):
        for cid,ty,st in con.execute('select CLASSID, %s from %s'%(cols,tab)):
            ed.append(dict(kind=kind,ty=ty or '',uso=uso.get(cid,[]),com=com))
# OSM
nodes={};ntags={};ways={}
for ev,el in ET.iterparse('C:/Users/theco/GitHub/GTA-Brianza/data/osm/maplarge.osm'):
    if el.tag=='node':
        nodes[el.get('id')]=proj(float(el.get('lat')),float(el.get('lon')))
        t={x.get('k'):x.get('v') for x in el.findall('tag')}
        if t: ntags[el.get('id')]=t
        el.clear()
    elif el.tag=='way':
        refs=[n.get('ref') for n in el.findall('nd')]
        t={x.get('k'):x.get('v') for x in el.findall('tag')}
        ways[el.get('id')]=(refs,t); el.clear()
# buildings groups
grp=collections.defaultdict(list)
for i,b in enumerate(allb):
    k=('e',b['e']) if b.get('e') is not None else ('o',i)
    grp[k].append(b)
B=[]
for k,vs in grp.items():
    geos=[Polygon(v['pts']).buffer(0) for v in vs]
    u=unary_union(geos); c=u.centroid
    if not conf.contains(c): continue
    B.append(dict(k=k,vs=vs,geo=u,c=c,area=sum(g.area for g in geos),h=max(v['h'] for v in vs),pu=[v['pu'] for v in vs if 'pu' in v],pn=[v['pn'] for v in vs if 'pn' in v],fa=collections.Counter(v.get('fa') for v in vs).most_common(1)[0][0]))
print(len(B),'buildings in Meda+Seveso total', sum(1 for b in B if b['pu']),'public')
Bs=[b for b in B]
tr=STRtree([b['geo'] for b in Bs])
# OSM building ways with tags, and POIs
osmb=[]
for wid,(refs,t) in ways.items():
    if 'building' in t and len(refs)>=4 and refs[0]==refs[-1] and all(r in nodes for r in refs):
        try:
            g=Polygon([nodes[r] for r in refs]).buffer(0)
            if conf.buffer(50).contains(g.centroid): osmb.append((g,t,wid))
        except: pass
otr=STRtree([x[0] for x in osmb])
pois=[]
for r,t in ntags.items():
    if r in nodes and any(k in t for k in P.POI_K) and t.get('leisure')!='pitch': pois.append((t,Point(nodes[r]),None))
for wid,(refs,t) in ways.items():
    if 'building' in t or not any(k in t for k in P.POI_K) or len(refs)<4 or refs[0]!=refs[-1]: continue
    if not all(r in nodes for r in refs): continue
    try: pg=Polygon([nodes[r] for r in refs]).buffer(0)
    except: continue
    if not pg.is_empty and pg.area>0 and t.get('leisure')!='pitch': pois.append((t,None,pg))
# addr nodes too (housenumbers not needed)
inside=collections.defaultdict(list)
for t,pt,pg in pois:
    if pt is not None:
        js=[j for j in tr.query(pt) if Bs[j]['geo'].contains(pt)]
        near=False
        if not js:
            q=[j for j in tr.query(pt.buffer(12)) if Bs[j]['geo'].distance(pt)<12]
            if q: js=[min(q,key=lambda j:Bs[j]['geo'].distance(pt))];near=True
    else:
        js=[j for j in tr.query(pg) if Bs[j]['geo'].area>=60 and Bs[j]['geo'].intersection(pg).area>0.5*Bs[j]['geo'].area]
        near=False
    for j in js: inside[j].append((t,'punto' if pt is not None else 'area',near))
def desc(t):
    return {k:v for k,v in t.items() if k in ('name','amenity','shop','office','craft','leisure','healthcare','tourism','building','man_made','railway','public_transport','emergency','historic','government','building:levels','operator')}
res=[]
for j,b in enumerate(Bs):
    if not b['pu']: continue
    gi=collections.Counter(b['pu']).most_common(1)[0][0]
    ids=sorted({v['e'] for v in b['vs'] if v.get('e') is not None})
    dbg=[]
    for e in ids:
        x=ed[e]; dbg.append(dict(kind=x['kind'],ty=x['ty'],uso=x['uso'],lab=P.lab_dbgt(x['kind'],x['ty'],x['uso']),com=x['com']))
    obs=[]
    for q in otr.query(b['geo']):
        g,t,wid=osmb[q]
        if g.intersection(b['geo']).area>0.5*min(g.area,b['geo'].area): obs.append(dict(wid=wid,**desc(t),lab=P.lab_bld(t)))
    ps=[]
    for t,kind,near in inside[j]:
        ps.append(dict(**desc(t),lab=P.lab_poi(t),forma=kind,vicino=near))
    c=b['c']
    res.append(dict(idx=j,e=ids,gruppo=P.GRUPPI[gi],nome=(b['pn'] or [''])[0],x=round(c.x,1),z=round(c.y,1),area=round(b['geo'].area),area_vol=round(b['area']),h=b['h'],piani=round(b['h']/3.1,1),fa=b['fa'],dbgt=dbg,osm_bld=obs,poi=ps,nvol=len(b['vs']),bounds=[round(v,1) for v in b['geo'].bounds]))
json.dump(res,open('raw.json','w'),ensure_ascii=False,indent=1)
print(len(res),collections.Counter(r['gruppo'] for r in res))
