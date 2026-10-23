# Punti di collaudo del motore nuovo (segnalazioni di Carlo, 23/10/2026 sera, build LiDAR + cancelli)

Ogni punto: foto prima e dopo dalla stessa posizione e direzione; il motore non è finito finché non tornano tutti.

| # | Dove (x, z gioco) | Direzione | Cosa non va | Causa trovata |
|---|---|---|---|---|
| 1 | Via Milano sotto la ferrovia (-747, -26) | 151° | l'auto balla sotto il ponte | da capire: sottopasso (OSM tunnel) su terreno LiDAR |
| 2 | Rotonda di Via Milano (-492, -523) | 184° | rotonda tutta ballerina | metà anello "impalcato" a 29,4 m (DBGT 1 m sopra il LiDAR, soglia 0,8 m), il resto a terra a 28,4 |
| 3 | Svincolo Milano-Meda (108, 46) | 350° | tre cartelli in mezzo alla strada | nei dati c'è un "vietato" a (104, 46): da capire |
| 4-5 | Svincolo lato nord (97, 158) e (80, 263) | 357°, 4° | vialetto pedonale con pendenza assurda che sfonda sulla Milano-Meda | i vialetti sono drappeggiati sul terreno, che ora (LiDAR) ha la trincea vera di 6 m |
| 6-9 | Rampe dello svincolo lato Via Vignazzola (-134, 644), (-92, 630), (-136, 594), (-156, 566) | vari | rampe senza guard rail | il guard rail c'è solo sugli impalcati; col LiDAR le rampe sono tornate a terra |
| 10, 13, 23 | Via Vignazzola (-197, 703), (-420, 654); Via Milano (-760, 3) | | cartelli di paese GIUSTI: esempi da tenere | cartello sulla via stessa, orientato lungo la via |
| 11, 12, 14-16, 18-21 | Via Vignazzola (-307, 678) … (-792, 575); Puccini (-794, 531); Donizetti (-780, 383); Mascagni (-777, 310); San Celso (-773, 217) | | cartelli di paese in mezzo alla strada, troppi insieme | laterali che sboccano su una via che corre sul confine: il cartello della laterale cadeva sulla via. Corretto in build_data.py (23/10): spostati o tolti, niente cartelli sulle laterali di una via sul confine, uno per via ogni 250 m, solo strade principali (Carlo: "sulle vie minori forse non andrebbero messe") |
| 17 | Via della Repubblica, Seveso (-935, 1663) | | concessionaria Opel? | OSM: "Drive" (shop=car) senza marca; Nuova Mariani (Opel dal 1970, salone corso Isonzo 2, officina 9) in OSM solo come officina senza marca. Marca da prendere dai dati (OSM brand o Overture Places), non a mano |
| 22 | Milano-Meda (-768, 103) | 155° | la strada è crollata | gradino di 5,6 m in 10 m sul confine Meda/Seveso: DBGT di Meda (30,2 m) contro ponte stimato +6,6 m (35,8) dove il DBGT non c'è. Si chiude col DBGT di Seveso (fase 8) |
| 24 | Scuole Diaz e Anna Frank (-622, -727) e (-622, -738) | 202°, 59° | "pisello di autostrada con guardrail che spinge in mezzo alla scuola" | impalcato finto (auto 1,8 m sopra il suolo); nel motore nuovo nessun impalcato entro 60 m. Da togliere anche la pezza a mano in world3.js (scavo di 3,2 m ai piedi della scarpata tra le due scuole, fatto per TINITALY: il LiDAR la scarpata ce l'ha) |
| 25 | Via Seveso (-304, -342) | 41° | campana del vetro in mezzo alla strada | OSM la mappa sulla carreggiata: gli arredi che cadono in carreggiata vanno spostati al bordo (build_data.py, off_carriageway, 24/10) |
| 26 | Via Amerigo Vespucci (-304, -909) | 35° | dov'è finito il Billy's (pub in OSM, Via Vespucci 2) | da capire: è nei dati (ng), non si vede in gioco |
| 27 | Perticato (2267, -563) | 171° | fili dei tralicci bucati a metà campata | push_lines saltava le tile senza tralicci: corretto (24/10) |

Regole che ne vengono per il motore:
- Vialetti, marciapiedi e ciclabili bruciati nella superficie S alla quota DBGT (AC_PED, EL_CIC), mai drappeggiati
- Impalcato solo dove sotto passa qualcosa (PONTE, sede ponte, OSM bridge con una strada, ferrovia o acqua sotto); una strada a raso più alta del LiDAR alza la superficie, non diventa un ponte
- Guard rail dove una strada principale o una rampa ha accanto un salto di più di 1-1,5 m in S (rilevato o trincea) e sui ponti, più quelli mappati in OSM
