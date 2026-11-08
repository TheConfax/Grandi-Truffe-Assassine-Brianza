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
| Vetrine 2.0, terzo giro (insegne doppie, vuote, via taglio 40 lettere, con build) | `vetrine-2` | `$S/vet2` | 8088 | ab0afbf820f8750d0 | FATTO 2c5c5a4c (server 8088 acceso, resta acceso) |
| Epoca degli edifici dal CENED | `epoca-edifici` | `$S/epoca` | 8089 | a109aa865b73fc4a3 | FATTO 23186bdc + 029ee9fb (server 8089 acceso, resta acceso) |
| Merge edifici-piccoli in dev | — | principale | 8013 | — | FATTO (1fc245be) |
| nightly/snap1 = dev + vetrine-2 + epoca, build sola | `nightly` | `$S/nightly` (lavoro), `$S/snap1` (fermo) | 8090 | a73fe46c21b7a4d66 | FATTO: nightly 24416bbd, tag nightly/snap1, server 8090 da `$S/snap1` |
| Facciate 2.0 (Opus) da snap1 | `facciate-2` | `$S/fac2` | 8093 | a51744e09502d7cce | in corso dalle 5:35 |
| Vetrine HQ (Opus) da snap1 | `vetrine-hq` | `$S/vhq` | 8094 | ad4d0c068713845b4 | in corso dalle 5:35 |
| Androni secondo giro (Sonnet) da snap1 | `androni-2` | `$S/andr2` | 8095 | af6e2726257285c2e | in corso dalle 5:35 |

Snapshot (fermi, giocabili, non si toccano finché Carlo non li ha giocati): snap1 8090, poi 8091, 8092, … nell'ordine in cui i lavori si uniscono in `nightly`.

## Snapshot fatti
- **snap1** (8090, `nightly/snap1`, 24416bbd): dev (con edifici piccoli, cavalcavia, altezze) + vetrine 2.0 (vetrine sul muro giusto, niente nomi tagliati, niente insegne vuote) + epoca degli edifici (`&epoca` per vederla). Link: http://127.0.0.1:8090/?x=1339&z=188&debug=1 · http://127.0.0.1:8090/?x=200&z=-532&debug=1&epoca · http://127.0.0.1:8090/?x=1037&z=-565&debug=1 (grotta)

Server dei rami singoli ancora accesi per confronto: 8088 (vetrine-2 da solo), 8089 (epoca da sola), 8013 (dev).
