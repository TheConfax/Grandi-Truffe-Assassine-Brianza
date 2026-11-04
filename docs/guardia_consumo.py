"""Guardia del consumo: chiede get_usage al monitor di Carlo (MCP stdio) senza passare da Claude.
Uso: python guardia_consumo.py [soglia=77] [minuti=20] [--una]
Esce (e stampa il motivo) quando seven_day è in rosso (vs_expected > 0) e used_percent >= soglia.
"""
import json, subprocess, sys, time, datetime

EXE = r"C:\ProgrammiNI\Usage-Monitor-For-Claude\UsageMonitorForClaude.exe"


def leggi():
    p = subprocess.Popen([EXE, "--mcp"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                         stderr=subprocess.DEVNULL, text=True, encoding="utf-8")
    def manda(m):
        p.stdin.write(json.dumps(m) + "\n"); p.stdin.flush()
    def ricevi(id_):
        while True:
            riga = p.stdout.readline()
            if not riga:
                raise RuntimeError("il monitor si è chiuso")
            m = json.loads(riga)
            if m.get("id") == id_:
                return m
    try:
        manda({"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
            "protocolVersion": "2024-11-05", "capabilities": {},
            "clientInfo": {"name": "guardia-consumo", "version": "1"}}})
        ricevi(1)
        manda({"jsonrpc": "2.0", "method": "notifications/initialized"})
        manda({"jsonrpc": "2.0", "id": 2, "method": "tools/call",
               "params": {"name": "get_usage", "arguments": {}}})
        r = ricevi(2)
        testo = r["result"]["content"][0]["text"]
        return json.loads(testo)
    finally:
        p.kill()


def main():
    argv = [a for a in sys.argv[1:] if not a.startswith("--")]
    soglia = float(argv[0]) if argv else 77
    minuti = float(argv[1]) if len(argv) > 1 else 20
    una = "--una" in sys.argv
    while True:
        ora = datetime.datetime.now().strftime("%H:%M")
        try:
            q = {x["field"]: x for x in leggi()["quotas"]}["seven_day"]
            usato, scarto = q["used_percent"], q["vs_expected"]
            print(f"{ora} seven_day {usato}% scarto {scarto:+}", flush=True)
            if scarto is not None and scarto > 0 and usato >= soglia:
                print(f"LIMITE: in rosso ({scarto:+}) e al {usato}% (soglia {soglia}): fermare gli agenti", flush=True)
                return
        except Exception as e:
            print(f"{ora} errore: {e}", flush=True)
        if una:
            return
        time.sleep(minuti * 60)


main()
