# Server locale del gioco: serve la cartella come http.server e accetta POST /segnala, che aggiunge una riga a un registro JSONL.
# Se la segnalazione porta 'fotob64' (data URL JPEG dello schermo), la salva in <registro>_foto/<quando>.jpg e scrive nella riga il campo 'foto'.
# uso: server_segnala.py cartella registro.jsonl [porta]
import sys, os, re, json, base64, http.server, functools, datetime
root, log = sys.argv[1], sys.argv[2]; port = int(sys.argv[3]) if len(sys.argv) > 3 else 8000
fotodir = os.path.splitext(log)[0] + '_foto'
class H(http.server.SimpleHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/segnala': self.send_error(404); return
        n = int(self.headers.get('Content-Length') or 0); body = self.rfile.read(n)
        try: rec = json.loads(body)
        except ValueError: self.send_error(400); return
        b64 = rec.pop('fotob64', None)
        if b64:
            try:
                nome = re.sub(r'[^0-9A-Za-z-]+', '-', str(rec.get('quando') or datetime.datetime.now().isoformat())).strip('-') + '.jpg'
                os.makedirs(fotodir, exist_ok=True)
                with open(os.path.join(fotodir, nome), 'wb') as f: f.write(base64.b64decode(b64.split(',', 1)[-1]))
                rec['foto'] = os.path.relpath(os.path.join(fotodir, nome), os.path.dirname(os.path.abspath(log))).replace(os.sep, '/')
            except Exception: pass  # la foto non deve mai far perdere la segnalazione
        rec['ricevuta'] = datetime.datetime.now().strftime('%H:%M:%S')
        with open(log, 'a', encoding='utf-8') as f: f.write(json.dumps(rec, ensure_ascii=False) + '\n')
        self.send_response(204); self.end_headers()
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')  # il browser ricontrolla sempre: niente terreno vecchio dalla cache
        super().end_headers()
    def log_message(self, *a): pass
http.server.ThreadingHTTPServer.request_queue_size = 256  # la coda di 5 di socketserver: con molti pezzi e foto chiesti insieme Windows rifiutava le connessioni e le foto restavano disegnate
http.server.ThreadingHTTPServer(('127.0.0.1', port), functools.partial(H, directory=root)).serve_forever()
