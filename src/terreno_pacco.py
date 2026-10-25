# Avvio veloce: i .bin.gz di terreno/ in un file solo (terreno/pacco.bin = i gzip uno dopo l'altro, ognuno intero e decomprimibile da solo).
# Il gioco scarica indice.json e pacco.bin insieme a brianza.json e decomprime i tile in parallelo; i dati del terreno sono gli stessi byte di prima.
# indice.json ottiene  pacco: {file, tile: {"tx_tz": [offset, lunghezza]}}.  Senza 'pacco' il gioco legge i singoli <tx>_<tz>.bin.gz come prima.
#   python src/terreno_pacco.py [cartella terreno]      (lo chiama anche terreno_gioco.py a fine corsa)
import os, sys, json, glob, re

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)


def impacchetta(out, togli=True):
    fs = sorted((int(m.group(1)), int(m.group(2)), f) for f in glob.glob(os.path.join(out, '*.bin.gz')) for m in [re.match(r'(\d+)_(\d+)\.bin\.gz$', os.path.basename(f))] if m)
    tile, pos, blob = {}, 0, bytearray()
    for tx, tz, f in fs:
        b = open(f, 'rb').read(); assert b[:2] == b'\x1f\x8b', f
        tile['%d_%d' % (tx, tz)] = [pos, len(b)]; blob += b; pos += len(b)
    open(os.path.join(out, 'pacco.bin'), 'wb').write(bytes(blob))
    fi = os.path.join(out, 'indice.json'); ind = json.load(open(fi, encoding='utf-8'))
    ind['pacco'] = dict(file='pacco.bin', tile=tile)
    open(fi, 'w', encoding='utf-8').write(json.dumps(ind, ensure_ascii=False, separators=(',', ':')))
    if togli:
        for _, _, f in fs: os.remove(f)
    print('pacco.bin: %d tile, %.2f MB' % (len(tile), pos / 1e6))


if __name__ == '__main__':
    impacchetta(sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'terreno'))
