# Builds src/segnaletica.json from OSM API extracts of the game area (t*.xml in the working directory): stop, give way, speed limits, no entry, roundabout islands, signs mapped one by one
import xml.etree.ElementTree as ET, glob, math, json, re, collections
lat0,lon0=45.6575,9.154;k=111320*math.cos(math.radians(lat0)); HW,HH=2878.8-30,2542.4-30
XY=lambda la,lo:((lo-lon0)*k, -(la-lat0)*110540)
nodes={}; ntags={}; ways={}
CAR={'motorway':0,'trunk':0,'primary':1,'secondary':2,'tertiary':3,'unclassified':4,'residential':4,'living_street':5,'service':6,'motorway_link':0,'trunk_link':0,'primary_link':1,'secondary_link':2,'tertiary_link':3}
for f in glob.glob('t*.xml'):
  r=ET.parse(f).getroot()
  for n in r.iter('node'):
    nodes[n.get('id')]=XY(float(n.get('lat')),float(n.get('lon')))
    t={x.get('k'):x.get('v') for x in n.iter('tag')}
    if t: ntags[n.get('id')]=t
  for w in r.iter('way'):
    t={x.get('k'):x.get('v') for x in w.iter('tag')}
    if t.get('highway') in CAR and t.get('area')!='yes' and t.get('access') not in ('private','no'):
      ways[w.get('id')]=(t,[n.get('ref') for n in w.iter('nd')])
at=collections.defaultdict(list)
for wid,(t,nd) in ways.items():
  for i,n in enumerate(nd): at[n].append((wid,i))
inside=lambda p: abs(p[0])<HW and abs(p[1])<HH
deg=lambda n: sum(2 if 0<i<len(ways[w][1])-1 else 1 for w,i in at[n])
out=[]
def unit(a,b):
  dx,dz=b[0]-a[0],b[1]-a[1]; l=math.hypot(dx,dz) or 1; return dx/l,dz/l
def add(kind,p,d,extra=None): # d: direction of the traffic the sign is for
  if inside(p): out.append([kind,round(p[0],1),round(p[1],1),round(d[0],3),round(d[1],3)]+([extra] if extra is not None else []))
oneway=lambda t: 1 if t.get('oneway') in ('yes','1','true') or t.get('junction')=='roundabout' else (-1 if t.get('oneway')=='-1' else 0)
# stop / give way
for nid,t in ntags.items():
  kind={'stop':'stop','give_way':'dare'}.get(t.get('highway'))
  if not kind or nid not in at: continue
  p=nodes[nid]
  if deg(nid)>=3: # mapped on the junction: the minor ways meeting there
    best=max(CAR[ways[w][0]['highway']] for w,i in at[nid])
    for w,i in at[nid]:
      wt,nd=ways[w]
      if CAR[wt['highway']]!=best: continue
      for j in (i-1,i+1):
        if 0<=j<len(nd) and nd[j] in nodes:
          q=nodes[nd[j]]; d=unit(q,p); L=math.hypot(p[0]-q[0],p[1]-q[1]); s=min(5,L*0.6)
          add(kind,(p[0]-d[0]*s,p[1]-d[1]*s),d)
    continue
  w,i=at[nid][0]; wt,nd=ways[w]
  dirn=t.get('direction')
  cands=[]
  for step in (1,-1):
    j=i
    while 0<=j+step<len(nd):
      j+=step
      if deg(nd[j])>=3: cands.append((step,j)); break
  if not cands: continue
  if dirn=='forward': cands=[c for c in cands if c[0]==1] or cands
  elif dirn=='backward': cands=[c for c in cands if c[0]==-1] or cands
  else: cands.sort(key=lambda c: math.hypot(nodes[nd[c[1]]][0]-p[0],nodes[nd[c[1]]][1]-p[1]))
  step,j=cands[0]; q=nodes[nd[i+step]] if 0<=i+step<len(nd) else nodes[nd[j]]
  add(kind,p,unit(p,q))
# speed limits where they change, for the traffic entering the way
def ms(t):
  m=re.match(r'\d+',t.get('maxspeed','')); return int(m.group()) if m else None
for wid,(t,nd) in ways.items():
  v=ms(t)
  if not v or len(nd)<2 or CAR[t['highway']]>=6: continue
  ow=oneway(t)
  for end,inner,into in ((0,1,1),(len(nd)-1,len(nd)-2,-1)):
    if (ow==1 and end!=0) or (ow==-1 and end==0): continue
    n=nd[end]; others=[w for w,i in at[n] if w!=wid]
    if not others or all(ms(ways[w][0])==v for w in others): continue
    a=nodes[n]; b=nodes[nd[inner]]; d=unit(a,b); L=math.hypot(b[0]-a[0],b[1]-a[1])
    if L<12 and len(nd)==2: continue
    s=min(10,L*0.5); add('limite',(a[0]+d[0]*s,a[1]+d[1]*s),d,v)
# no entry at the wrong end of one-way streets, one way at the right one
for wid,(t,nd) in ways.items():
  ow=oneway(t)
  if not ow or t.get('junction')=='roundabout' or CAR[t['highway']]<=1 or CAR[t['highway']]>=6 or len(nd)<2: continue
  seq=nd if ow==1 else nd[::-1]
  e=seq[-1]; others=[(w,i) for w,i in at[e] if w!=wid]
  # skip where the street just goes on as the same one-way
  cont=[1 for w,i in others if oneway(ways[w][0]) and ((oneway(ways[w][0])==1 and i==0) or (oneway(ways[w][0])==-1 and i==len(ways[w][1])-1))]
  if others and not cont:
    a=nodes[e]; b=nodes[seq[-2]]; d=unit(a,b); L=math.hypot(b[0]-a[0],b[1]-a[1]); s=min(5,L*0.5)
    add('vietato',(a[0]+d[0]*s,a[1]+d[1]*s),d)
# the signs mapped one by one
for nid,t in ntags.items():
  ts=t.get('traffic_sign'); 
  if not ts or nid not in nodes: continue
  p=nodes[nid]; dirs=[x for x in re.split(r';',t.get('direction','')) if re.match(r'^\d+$',x)]
  kinds=[]
  for s in ts.split(';'):
    if 'Senso vietato' in s: kinds.append(('vietato',None))
    elif s=='maxspeed': kinds.append(('limite',ms(t) or 50))
    elif s=='city_limit': kinds.append(('paese',t.get('name','')))
    elif 'Nome strada' in s:
      m=re.search(r'cartello su palo "([^"]+)"',t.get('description',''))
      if m: kinds.append(('via',m.group(1).split(' "')[0][:28]))
    elif 'Divieto di transito' in s: kinds.append(('transito',None))
    elif 'Senso unico' in s: kinds.append(('unico',None))
  for i,(kd,ex) in enumerate(kinds):
    if dirs: th=math.radians(float(dirs[min(i,len(dirs)-1)])); f=(math.sin(th),-math.cos(th)); d=(-f[0],-f[1])
    else: d=(0,0) # the game finds the road
    add(kd,p,d,ex)
c=collections.Counter(o[0] for o in out); print(c, len(out))
json.dump(out,open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'segnaletica.json'),'w'),separators=(',',':'))

# ---- roundabout splitter islands: the nose where a two-way road splits into the oneway lane into the roundabout and the one out of it
ring=set(); 
for wid,(t,nd) in ways.items():
  if t.get('junction') in ('roundabout','circular'): ring.update(nd)
def touches(nd): return nd[-1] in ring or nd[0] in ring
isl=0
for wid,(t,nd) in ways.items():
  if oneway(t)!=1 or t.get('junction') or len(nd)<2 or nd[-1] not in ring: continue # an entry lane
  F=nd[0]
  for w2,(t2,n2) in ways.items():
    if w2==wid or oneway(t2)!=1 or t2.get('junction') or n2[-1]!=F or n2[0] not in ring: continue # the exit lane ending where the entry starts
    p=nodes[F]; a=unit(p,nodes[nd[1]]); b=unit(p,nodes[n2[-2]])
    bx,bz=a[0]+b[0],a[1]+b[1]; l=math.hypot(bx,bz)
    if l<0.2: continue
    bx/=l; bz/=l
    # the island itself: where the two lanes are far enough apart (centre lines more than 6 m, so 1.4 m of kerb between two 2.3 m half lanes),
    # from there along both lanes towards the roundabout, each side pulled in by half a lane; the post goes on its nose
    def samples(seq):
      pts=[]; acc=0
      for k in range(1,len(seq)):
        A=nodes[seq[k-1]]; B=nodes[seq[k]]; L=math.hypot(B[0]-A[0],B[1]-A[1]) or 1; ux,uz=(B[0]-A[0])/L,(B[1]-A[1])/L
        for i_ in range(int(L/1.5)+1):
          s_=i_*1.5; pts.append((A[0]+ux*s_,A[1]+uz*s_,ux,uz,acc+s_))
        acc+=L
        if seq[k] in ring: pts=[q for q in pts if acc-q[4]>4.5]; break
      return pts
    def dpoly(x,z,seq):
      best=1e9
      for k in range(1,len(seq)):
        A=nodes[seq[k-1]]; B=nodes[seq[k]]; ex,ez=B[0]-A[0],B[1]-A[1]; L2=ex*ex+ez*ez or 1; t_=max(0,min(1,((x-A[0])*ex+(z-A[1])*ez)/L2)); best=min(best,math.hypot(x-A[0]-ex*t_,z-A[1]-ez*t_))
      return best
    cr=a[0]*b[1]-a[1]*b[0]
    def side(seq,other,sgn):
      out_=[]
      for x,z,ux,uz,dd in samples(seq):
        if dpoly(x,z,other)<6.0: 
          if out_: break
          continue
        out_.append((x-uz*sgn*2.3,z+ux*sgn*2.3))
      return out_
    sin_=side(nd,n2,1 if cr>0 else -1); sout=side(n2[::-1],nd,-1 if cr>0 else 1)
    if len(sin_)<2 or len(sout)<2: continue # no room for an island: the lanes just run side by side
    nx_,nz_=(sin_[0][0]+sout[0][0])/2,(sin_[0][1]+sout[0][1])/2
    poly=[(round(x,1),round(z,1)) for x,z in sin_]+[(round(x,1),round(z,1)) for x,z in sout[::-1]]
    add('isola',(nx_+bx*0.9,nz_+bz*0.9),(bx,bz),poly); isl+=1
    break
print('islands',isl)
noses=[o for o in out if o[0]=='isola']
out=[o for o in out if not (o[0]=='vietato' and any(math.hypot(o[1]-n[1],o[2]-n[2])<9 for n in noses))] # the island post carries the no entry for the exit lane
c=collections.Counter(o[0] for o in out); print(c, len(out))
json.dump(out,open(__import__('os').path.join(__import__('os').path.dirname(__file__), 'segnaletica.json'),'w'),separators=(',',':'))
