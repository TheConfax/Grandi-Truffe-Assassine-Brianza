# Stato della notte (8/11/2026)

Foglio per ripartire se Claude si ferma (finestra di 5 ore esaurita, sessione chiusa, agente interrotto). Si aggiorna a ogni passo. Piano deciso con Carlo: `todo.md`, voce "NOTTE 8/11". Regole: `CLAUDE.md` (`nightly` è il ramo di Claude; in `dev` solo ciò che Carlo autorizza).

## Come ripartire
1. `get_usage`: se la finestra di 5 ore è esaurita, aspetta l'azzeramento. La settimana non va mai oltre l'80%.
2. Leggi la tabella qui sotto: per ogni lavoro "in corso" guarda il suo ramo (`git log origin/<ramo>`) e la sua cartella di lavoro.
3. Agente interrotto: riprendilo con SendMessage al suo id (riparte dal suo trascritto). Se non risponde o la sessione è nuova, lancia un agente nuovo con: "continua il lavoro sul ramo `<ramo>`, cartella `<worktree>`, compito in todo.md NOTTE 8/11; guarda `git log` e `git status` della cartella per capire dove eri arrivato". I file non committati restano sul disco nella cartella.
4. Ogni agente committa e pusha sul suo ramo a ogni passo che funziona: si perde al massimo l'ultimo passo.
5. Server spenti (PC riavviato): `.venv/Scripts/python.exe src/server_segnala.py <cartella> segnalazioni_<porta>.jsonl <porta>` in background, per 8013 (cartella principale) e per ogni snapshot.
6. Playwright per la cottura dei pezzi fuori dalla cartella principale: `PLAYWRIGHT` deve puntare a `.../c3338f54-9d75-4a4f-9c91-975529f565b8/scratchpad/prove/node_modules/playwright/index.mjs`.

Cartelle: `S=C:/Users/theco/AppData/Local/Temp/claude/645585d1e8c08b81/7a2efc23-998d-4868-8a7c-f0a557ad88a4/scratchpad`.

## Lavori
| Lavoro | Ramo | Cartella | Porta | Agente | Stato |
|---|---|---|---|---|---|
| Vetrine 2.0, terzo giro (insegne doppie, vuote, via taglio 40 lettere, con build) | `vetrine-2` | `$S/vet2` | 8088 | ab0afbf820f8750d0 | in corso |
| Epoca degli edifici dal CENED | `epoca-edifici` | `$S/epoca` | 8089 | a109aa865b73fc4a3 | in corso |
| Merge edifici-piccoli in dev | — | principale | 8013 | — | FATTO (1fc245be) |
| nightly/snap1 = dev + vetrine-2 + epoca, build sola | `nightly` | `$S/snap1` | 8090 | — | da fare dopo i due sopra |
| Facciate 2.0 (Opus) da snap1 | `facciate-2` | `$S/fac2` | 8093 | — | da lanciare dopo le 6:00 |
| Vetrine HQ (Opus) da snap1 | `vetrine-hq` | `$S/vhq` | 8094 | — | da lanciare dopo le 6:00 |
| Androni secondo giro (Sonnet) da snap1 | `androni` (rifatto su snap1) | `$S/andr2` | 8095 | — | da lanciare dopo le 6:00 |

Snapshot (fermi, giocabili, non si toccano finché Carlo non li ha giocati): snap1 8090, poi 8091, 8092, … nell'ordine in cui i lavori si uniscono in `nightly`.

## Snapshot fatti
(nessuno)
