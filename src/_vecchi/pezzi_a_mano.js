// ================================================================ MESSI DA PARTE il 24/10/2026 (docs/motore.md 7): le tabelle di luoghi scritte a mano
// che erano nel gioco fuori da landmarks3.js (quelle di landmarks3.js sono in landmarks_modelli.js). Non assemblato. Dove i dati non dicono
// niente, niente: il verde, i muri e gli edifici vengono dal DBGT (a Meda) e da OSM.
//
// world3.js, NO_TREES: posti che la mappa riempiva di alberi e sono campi da gioco (i due stadi, il chiostro del Seminario con i suoi quattro
//   alberi del modello). Ora i campi sportivi sono ATTR_SP (DBGT) o OSM, e nessun albero ci cade sopra (src/dbgt_verde.py)
// world3.js, NO_HEDGES: le siepi del chiostro del Seminario, che il modello disegnava simmetriche
// world3.js, GHOSTS: due edifici di Overture che non ci sono (una casa e un capanno davanti al vialetto del Curie, visti sul posto). Ora
//   Overture conta solo fuori dal DBGT, e il DBGT di Meda non li ha
// world3.js, EXTRA_BARRIERS: il muro del parco del Seminario lungo via Verga, fra i due pezzi che OSM ha (Seveso, fuori dal DBGT)
// paesaggio3.js: la gru del cantiere vista dalla partenza dietro Junior B e Amplifon (x 384,6 z -359,9) teneva l'altezza massima; ora è come
//   le altre gru (altezza dal codice del posto)
// impalcati.py: le fosse del sottopasso della stazione si leggevano da STAIRWELLS in landmarks3.js (profondità 3,6 m scritta a mano); ora
//   build_pits() non trova niente e non fa fosse (terreno/indice.json le tiene fino alla prossima rigenerazione del terreno)
const NO_TREES = [
  [[-408.6, 279.7], [-378.5, 452.1], [-276.1, 434.2], [-306.2, 261.8]], // Stadio Mino Favini
  [[-1835.9, 1110.2], [-1797.9, 1281.0], [-1702.2, 1259.7], [-1740.2, 1088.9]], // Stadio comunale di Seveso
  [[-741.4, 767.4], [-684.8, 778.6], [-697.6, 837.8], [-754.3, 826.0]], // the cloister of the Seminario di Seveso: its own four trees
];
const NO_HEDGES = [
  [[-741.4, 767.4], [-684.8, 778.6], [-697.6, 837.8], [-754.3, 826.0]], // the cloister of the Seminario di Seveso
];
const GHOSTS = [
  [1243.7, -553.8], [1261.4, -549.6], // a house and a shed across the Curie drive from via Marie Curie
];
const EXTRA_BARRIERS = [
  { p: [[-566.2, 870.2], [-570.0, 888.0], [-573.9, 906.5]], t: 1, h: 1.7 }, // the Seminario park wall along via Verga, between the two pieces OSM has
];
const CRANE_SPAWN = [384.6, -359.9]; // paesaggio3.js: the crane seen from the spawn kept its full height
