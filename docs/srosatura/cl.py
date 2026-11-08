import json,sys,collections
sys.path.insert(0,'../snap5/src')
import pubblici as P
r=json.load(open('raw.json',encoding='utf8'))
INFRA={'parking','parking_entrance','parking_space','bicycle_parking','vending_machine','post_box','recycling','atm','bench','waste_basket','toilets','drinking_water','telephone','charging_station','bicycle_rental','fountain','shelter','public_bookcase','fuel','information','playground','pitch'}
PUBB_OSM={'school','kindergarten','church','chapel','hospital','civic','public','train_station','grandstand','parish','religious','cathedral','college','university'}
PRIV_OSM={'apartments','residential','house','detached','terrace','semidetached_house','commercial','retail','industrial','office','warehouse','dormitory'}
def publ_uso(u): return any(x.startswith(('02','03','05','0603','10','04')) for x in u)
def priv_uso(u): return [x for x in u if x[:2] in ('01','07','08','09','12','95')]
out=[]
for i,x in enumerate(r):
    ld=[a['lab'] for a in x['dbgt'] if a['lab']]
    lo=[a['lab'] for a in x['osm_bld'] if a['lab']]
    lp=[a['lab'] for a in x['poi'] if a['lab']]
    osm=lo+lp
    pri=[l for l in lo if l not in P.VAGUE] or [l for l in osm if l not in P.VAGUE]
    src=None
    if pri:
        best=collections.Counter(pri).most_common(1)[0][0]
        # source
        if best in lo and [l for l in lo if l not in P.VAGUE]: src='edificio OSM (building=%s)'%next(a.get('building') for a in x['osm_bld'] if a['lab']==best)
        else:
            q=[a for a in x['poi'] if a['lab']==best]
            src='area OSM' if any(a['forma']=='area' for a in q) else ('punto OSM vicino (<12 m)' if all(a['vicino'] for a in q) else 'punto OSM dentro')
    elif ld and ld[0] not in P.VAGUE: best=ld[0]; src='uso/tipo DBGT'
    elif osm: best=collections.Counter(osm).most_common(1)[0][0]; src='etichetta OSM vaga'
    elif ld: best=ld[0]; src='uso/tipo DBGT (vago)'
    else: best=x['gruppo'].lower(); src='non ricostruita (relazione OSM)'
    uso=[u for a in x['dbgt'] for u in a['uso']]
    tys=[(a['kind'],a['ty']) for a in x['dbgt']]
    obt=[a.get('building') for a in x['osm_bld']]
    others=[a for a in x['poi'] if a['lab']!=best and not any(a.get(k) in INFRA for k in ('amenity','leisure','tourism','man_made')) and not (a.get('amenity') is None and a.get('shop') is None and a.get('office') is None and a.get('craft') is None and a.get('healthcare') is None and a.get('leisure') is None) and a.get('railway') is None]
    CIV={'government','association','ngo','political_party','religion','foundation'}
    COMM={'restaurant','cafe','bar','fast_food','pub','bank','pharmacy','ice_cream','bureau_de_change','dentist','doctors','veterinary','car_wash','dance','driving_school','nightclub','cinema'}
    others=[a for a in others if a.get('shop') or a.get('craft') or (a.get('office') and a['office'] not in CIV) or a.get('amenity') in COMM or a.get('healthcare') in('doctor','dentist','physician','psychotherapist','physiotherapist','optometrist','alternative')]
    # evidence
    W=0; why=[]
    if publ_uso(uso): W+=3; why.append('uso DBGT pubblico '+','.join(sorted(set(u for u in uso if u[:2] in('02','03','05','06','10','04')))))
    if any(k=='M' and t in('18','04') for k,t in tys): W+=3; why.append('volume minore DBGT cappella/edicola funeraria')
    if any(t in('11','22','07') for k,t in tys): W+=3; why.append('tipo DBGT chiesa/campanile')
    if any(t=='19' for k,t in tys): W+=1; why.append('tipo DBGT 19 pubblico')
    if any(b in PUBB_OSM for b in obt): W+=3; why.append('building OSM '+'/'.join(sorted({b for b in obt if b in PUBB_OSM})))
    elif lo: W+=3; why.append('il poligono OSM dell edificio porta il tag del servizio')
    if src.startswith('non ricostruita'): W+=3; why.append('relazione OSM dell edificio con il tag del servizio')
    if src=='area OSM': W+=3; why.append('area OSM del servizio')
    M=0; mw=[]
    pv=priv_uso(uso)
    if pv and not publ_uso(uso): M+=1; mw.append('uso DBGT solo '+','.join(sorted(set(pv))))
    if any(b in PRIV_OSM for b in obt): M+=1; mw.append('building OSM '+'/'.join(sorted({b for b in obt if b in PRIV_OSM})))
    if len(others)>=2: M+=3; mw.append('%d altre attività private dentro'%len(others))
    elif len(others)==1: M+=2; mw.append('1 altra attività privata dentro')
    if x['piani']>=4 or x['fa'] in (3,4): M+=2; mw.append('palazzo: %.0f piani, famiglia %s'%(x['piani'],x['fa']))
    if W>=3 and M<=3: cl='a'
    elif W>=3: cl='c'
    elif M>=3: cl='b'
    else: cl='c'
    # general rule on gruppo cappella
    out.append(dict(n=i,gruppo=x['gruppo'],nome=x['nome'],x=x['x'],z=x['z'],piani=round(x['piani']),superficie=x['area'],h=x['h'],classe=cl,W=W,M=M,
        etichetta=best,fonte=src,perche='; '.join(why+['|']+mw),altre=[(a.get('name','?'),a.get('amenity') or a.get('shop') or a.get('office') or a.get('craft') or a.get('healthcare')) for a in others],uso=uso,osm=obt,
        tipo_dbgt=['%s%s'%t for t in tys],residenziale=bool('01' in uso or any(b in('apartments','residential','house') for b in obt)),bounds=x['bounds'],e=x['e']))
json.dump(out,open('cl.json','w'),ensure_ascii=False,indent=1)
print(collections.Counter(o['classe'] for o in out))
for o in out:
    if o['gruppo']=='CAPPELLA': continue
    print(o['n'],o['classe'],o['gruppo'][:5],o['nome'][:20],o['superficie'],o['piani'],'W%d M%d'%(o['W'],o['M']),o['fonte'],'|',o['perche'][:90],'|',[a[0][:12] for a in o['altre']][:4])
