# Le aiuole delle rotonde

Idea di Carlo del 26/10: aiuole credibili nelle rotonde, da pochi modelli presi da foto vere, ripetuti dove la foto aerea mostra la stessa cosa. Vale solo a Meda; fuori non cambia niente.

## Da dove viene ogni cosa

- **L'isola** è il poligono `MAN_TR` del DBGT (tipi 01, 02, 03) che contiene il centro della rotonda. A via Cadorna, a largo Terragni e nella minirotonda a est del centro il DBGT disegna come `MAN_TR` solo l'anello di ciottoli e lascia il centro come buco, coperto da un `AR_VRD` aiuola. Nel gioco quel buco era a quota strada, con lo scalino solo sull'anello. Ora l'isola è piena: il buco entra nell'isola e quindi anche nello strato dei gradini (0,15 m sopra `S`), come il resto dell'isola. Come l'auto urta il cordolo non cambia.
- **Il modello** di ogni rotonda è scritto a mano in `src/rotonde.json`, dopo aver guardato la foto aerea 2018-19 della Regione (ImageServer `Ortofoto2018_2019`, ritagli di 56 m e di 28 m con sopra i `MAN_TR`, gli `AR_VRD` e gli `ALBERO`). Mapillary ha foto solo di via Cadorna (aprile 2018); per le altre rotonde l'API non ne restituisce nessuna.
- **Le misure** vengono dalla stessa foto: larghezza dell'anello (dove il DBGT non la dà già), angolo, apertura, raggio e larghezza delle mezzelune, posizione dei cespugli.
- **Gli alberi** sono solo quelli dei dati (DBGT `ALBERO` e quelli che il gioco ha già). A via Cadorna e a largo Terragni la foto mostra alberi che i dati non hanno, e non sono stati aggiunti.
- **I colori e le grane.** I ciottoli sono la foto CC0 *rock_embedded_concrete* di Poly Haven (2 m, ciottoli tondi nel cemento), ricolorata sul colore medio dei ciottoli nella foto di Carlo e stesa su 4 m, così i sassi vengono di 6-10 cm come nella foto: `tex/ciottoli.jpg`. Begonie (#a5322a su foglie #2f4a1c) e cespugli (#7a762b e #2f4a1c) prendono i colori medi misurati sulla foto di Carlo. Il bordo bianco delle mezzelune è quello della foto aerea.

## I modelli

| Modello | Cosa c'è | Preso da |
|---|---|---|
| **A** | anello di ciottoli, cordolo basso, prato rialzato di 12 cm, bordure a mezzaluna di begonie rosse, due cespugli tondi | la foto Street View di Carlo (via Cadorna, settembre 2026) e la foto aerea |
| **B** | solo prato con il cordolo, cioè l'isola com'era già | foto aerea; è anche la scelta quando non si capisce |
| **C** | prato con il cordolo e mezzelune bordate di pietra bianca, piantate ad arbusti bassi; alberi solo se ci sono nei dati | foto aerea delle due rotonde grandi |
| **D** | isola pavimentata in pietra (porfido) | foto aerea di piazza Volta |
| **E** | anello di ciottoli (o di cemento) con il cordolo interno e il prato rialzato, più le mezzelune quando ci sono | foto aerea |

Il quinto modello possibile, con un monumento o un'insegna, non serve: nelle foto aeree nessuna rotonda di Meda ne ha uno. A via Cadorna però c'è un cartello di legno marrone con scritto "Meda": si legge nella foto Mapillary dell'aprile 2018 e nella foto di Carlo si vede il suo palo, a sinistra. Per ora non è stato messo (vedi i problemi aperti in `todo.md`).

## Le rotonde di Meda

Rotonde trovate: gli anelli `AC_VEI` 0206 del DBGT con un'isola dentro, più le `junction=roundabout` di OSM dentro il confine. Sono 10 con un'isola centrale del DBGT. Tutte le coordinate sono x, z del gioco.

| Rotonda | x, z | Modello | Cosa si vede nella foto aerea |
|---|---|---|---|
| via Cadorna, all'uscita della Milano-Meda | 121, −8 | A | Anello di ciottoli di 1,6 m (è proprio il `MAN_TR`), cordolo interno, prato, due archi chiari dove nel 2026 ci sono le begonie, macchia d'alberi al centro (nessun albero nei dati). La foto di Carlo mostra le begonie e due cespugli tondi |
| largo Terragni | −491, −543 | E | Anello di ciottoli di 1,6 m (il `MAN_TR`), cordolo interno, prato, tre aiuole a mezzaluna bordate di bianco con terra scura, albero al centro che i dati non hanno |
| rotonda ovale a sud-ovest | −1096, −1523 | C | Prato tagliato a cerchi, nessun anello, macchia di alberi al centro (7 nel gioco), due mezzelune bianche con arbusti bassi |
| rotonda a est | 1936, −689 | E | Anello di ciottoli di circa 2,1 m, prato, albero grande al centro (3 `ALBERO`), tre mezzelune bianche con una siepe bassa dietro |
| rotonda a nord del centro | 251, 478 | B | Solo prato e cordolo, una chiazza di terra nuda |
| rotonda a nord-est | 1311, 682 | E | Anello grigio liscio di circa 1,9 m (cemento), prato, alberi al centro (3 `ALBERO`). Ci sono macchie bluastre che non si riconoscono, quindi restano prato |
| minirotonda a est del centro | 698, 180 | E | Anello di ciottoli di 1,7 m (il `MAN_TR`), prato al centro (`AR_VRD`) |
| rotonda grande a ovest | −550, −679 | C | Prato, macchia di alberi al centro (2 `ALBERO`), tre mezzelune bianche piantate ad arbusti chiari |
| piazzola di giro in fondo a una strada senza uscita | 1907, −651 | E | Anello di ciottoli di circa 1,8 m e prato |
| piazza Volta (minirotonda) | −77, −858 | D | Isoletta tonda di 6 m pavimentata in pietra color porfido. Le macchie scure in mezzo (paletti? vasi?) non si capiscono e non sono state messe |

Totale: A 1, B 1, C 2, D 1, E 5.

Rimaste come prima:
- **La piazzola di giro a x 1783, z −1049**: la foto mostra prato e cordolo, ma il DBGT lì non ha un'isola (il buco dell'anello `AC_VEI` è vuoto). Senza dati per lo scalino non si disegna niente.
- **La rotonda a x 1814, z 84**, sul confine: l'isola sta fuori dal DBGT di Meda.
- **Le isole piccole** (gocce agli ingressi, spartitraffico): cordolo e prato, oppure pavimentate, come prima.

## Nel gioco

- Build: `src/rotonde.py` legge la tabella, riempie le isole (`riempi`, prima di `Strade.push_tiles`) e scrive `tiles[t].ro` nella tile del centro. Il rapporto per rotonda è in `brianza.json`, `report.rotonde`.
- Gioco: `src/rotonde3.js`, `rotondeTile` (chiamata dal passo dei muri di `buildTileGen`) disegna sopra l'isola di sempre (cordolo e prato a `MED_H`). Gli strati, dal basso:
  - l'anello (ciottoli o cemento) a `MED_H`;
  - il prato rialzato a `MED_H + 0,12` con il suo cordolo;
  - le mezzelune, con un bordo di pietra bianca largo 0,2 m (alto 0,1 m per i fiori e 0,18 m per gli altri) e dentro begonie a 0,25 m, arbusti a 0,45 m o terra a 0,06 m;
  - i cespugli, istanziati.
  Tutto è tagliato sulle celle di `S` come le altre superfici (`polyFill` su `FBuf`) e c'è solo nelle tile di `S`.
- La fisica è quella dell'isola: lo scalino resta di 0,15 m. Il prato rialzato, le mezzelune e i cespugli sono solo disegno, e chi cammina sul prato ci affonda di 12 cm.
