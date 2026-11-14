"""Scarica il LiDAR 1x1 (DTM e DSM First) dal portale sim.mase.gov.it per un riquadro.

Uso: python src/scarica_lidar.py LON0 LAT0 LON1 LAT1 CARTELLA_ZIP [--attesa MIN]
Esempio (prova, 1 tessera): python src/scarica_lidar.py 9.0701 45.6201 9.0799 45.6299 data/terreno/_zip_prova
Procedura in docs/dati.md ("LiDAR: cosa manca e come si riprende").
Stampa il carrello, gli eventi del polling e salva gli zip pronti. Esce con 2 se non arriva niente.
"""
import json, sys, time, os, urllib.request

BASE = 'https://sim.mase.gov.it/core/api/pst-ms'
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36')


def req(url, data=None, timeout=120):
    h = {'User-Agent': UA, 'Accept': 'application/json, */*'}
    if data is not None:
        data = json.dumps(data).encode()
        h['Content-Type'] = 'application/json'
    r = urllib.request.Request(url, data=data, headers=h)
    with urllib.request.urlopen(r, timeout=timeout) as f:
        return f.read()


def main():
    a = [x for x in sys.argv[1:] if not x.startswith('--')]
    lon0, lat0, lon1, lat1 = map(float, a[:4])
    out = a[4]
    attesa = 30
    if '--attesa' in sys.argv:
        attesa = float(sys.argv[sys.argv.index('--attesa') + 1])
    os.makedirs(out, exist_ok=True)
    poly = f'POLYGON(({lon0} {lat1}, {lon1} {lat1}, {lon1} {lat0}, {lon0} {lat0}, {lon0} {lat1}))'
    cart = json.loads(req(BASE + '/cart', [{'layer': 'pst:qu_lidar_1x1', 'polygon': poly}]))
    cid = cart['cart_id']
    print('cart', cid, flush=True)
    info = json.loads(req(f'{BASE}/cart/{cid}'))
    print(json.dumps(info)[:800], flush=True)
    t0 = time.time()
    visti = set()
    pronti = []
    seen_ev = 0
    while time.time() - t0 < attesa * 60:
        try:
            ev = json.loads(req(f'{BASE}/cart/{cid}/polling'))
        except Exception as e:
            print('polling errore', e, flush=True)
            time.sleep(15)
            continue
        evs = ev if isinstance(ev, list) else ev.get('events', [ev])
        for e in evs:
            s = json.dumps(e)
            if s in visti:
                continue
            visti.add(s)
            print(f'[{int(time.time()-t0)}s]', s[:400], flush=True)
            if 'layer-file-ready' in s:
                pronti.append(e)
            if 'layer-error' in s:
                print('ERRORE dal portale', flush=True)
        if pronti and time.time() - t0 > 60 and len(pronti) >= 1:
            # attende ancora un poco per gli altri prodotti, poi scarica
            time.sleep(20)
            try:
                ev = json.loads(req(f'{BASE}/cart/{cid}/polling'))
                evs = ev if isinstance(ev, list) else ev.get('events', [ev])
                for e in evs:
                    s = json.dumps(e)
                    if s not in visti:
                        visti.add(s); print(s[:400], flush=True)
                        if 'layer-file-ready' in s:
                            pronti.append(e)
            except Exception:
                pass
            break
        time.sleep(15)
    if not pronti:
        print('NIENTE layer-file-ready entro', attesa, 'min', flush=True)
        sys.exit(2)
    # aspetta che ci siano sia dtm_1x1 sia dsm_first_1x1 (il DSM Last non serve)
    def prodotti():
        return {e['layer'] for e in pronti}
    while not {'dtm_1x1', 'dsm_first_1x1'} <= prodotti() and time.time() - t0 < attesa * 60:
        time.sleep(15)
        ev = json.loads(req(f'{BASE}/cart/{cid}/polling'))
        for e in (ev if isinstance(ev, list) else ev.get('events', [ev])):
            sj = json.dumps(e)
            if sj not in visti:
                visti.add(sj); print(sj[:300], flush=True)
                if 'layer-file-ready' in sj:
                    pronti.append(e)
    json.dump(pronti, open(os.path.join(out, 'pronti.json'), 'w'), indent=1)
    import zipfile
    dest = {'dtm_1x1': 'dtm', 'dsm_first_1x1': 'dsm'}
    dirs = {'dtm': os.path.join(out, 'dtm'), 'dsm': os.path.join(out, 'dsm')}
    for k, d in dirs.items():
        os.makedirs(d, exist_ok=True)
    for e in pronti:
        if e['layer'] not in dest:
            continue
        k = dest[e['layer']]
        zp = os.path.join(out, f"{e['layer']}_{e['file_id']}.zip")
        if not os.path.exists(zp):
            data = req(f"{BASE}/download/{e['polygon_id']}/{e['file_id']}", timeout=1800)
            open(zp, 'wb').write(data)
        print('scaricato', zp, os.path.getsize(zp), flush=True)
        with zipfile.ZipFile(zp) as z:
            for n in z.namelist():
                if n.lower().endswith(('.tif', '.tiff')):
                    open(os.path.join(dirs[k], os.path.basename(n)), 'wb').write(z.read(n))
    print('fatto', flush=True)


if __name__ == '__main__':
    main()
