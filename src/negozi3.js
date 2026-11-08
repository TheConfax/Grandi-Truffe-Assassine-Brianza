// ---------------------------------------------------------------- shop fronts by class (negozi)
// build_data.py sorts every shop, bar, restaurant, workshop, office and surgery mapped in OSM into a class (D.ng: [x dm, z dm, class, OSM subtype, name]).
// Each class has five or six models of front: how the sign is made and lettered, the frame, the door, the awning, what hangs on the wall and what stands
// on the pavement. A hash of the place picks the model, so the class reads at a glance (a pharmacy has its green cross) and no two neighbours look alike.
// What shows through the glass follows the subtype (a butcher's shows meat, a baker's bread): six themes per class, drawn once into a small atlas
// that lights up at night. Shops without a name get what they are on the sign: PARRUCCHIERE, AUTOFFICINA, FARMACIA
const NG_CLASSES = ['mobili', 'bellezza', 'officina', 'auto', 'bar', 'ristorante', 'pizzeria', 'gelateria', 'alimentari', 'supermercato', 'moda', 'farmacia', 'banca', 'ufficio',
  'medico', 'tabacchi', 'bottega', 'artigiano', 'sfitto'];
const NG_HASH = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 13; h = Math.imul(h, 0x5bd1e995); h ^= h >>> 15; return (h >>> 0) / 4294967296; };
const NG_FONT = { sans: 'bold %px Arial, Helvetica, sans-serif', serif: 'bold %px Georgia, "Times New Roman", serif', slab: 'bold %px Rockwell, "Courier New", serif',
  script: 'italic bold %px "Brush Script MT", "Segoe Script", Georgia, cursive', black: '900 %px "Arial Black", Impact, Arial, sans-serif', cond: 'bold %px "Arial Narrow", Impact, "Helvetica Neue", sans-serif' };
const NG_LABEL = { furniture: 'MOBILI', kitchen: 'CUCINE', interior_decoration: 'ARREDAMENTI', bathroom_furnishing: 'ARREDOBAGNO', curtain: 'TENDAGGI', bed: 'MATERASSI', lighting: 'ILLUMINAZIONE',
  carpet: 'TAPPETI', antiques: 'ANTIQUARIATO', flooring: 'PAVIMENTI', tiles: 'CERAMICHE', doors: 'PORTE', windows: 'SERRAMENTI', houseware: 'CASALINGHI',
  hairdresser: 'PARRUCCHIERE', beauty: 'CENTRO ESTETICO', cosmetics: 'PROFUMERIA', perfumery: 'PROFUMERIA', massage: 'MASSAGGI', tattoo: 'TATTOO', nail_salon: 'NAIL BAR', pet_grooming: 'TOELETTATURA',
  car_repair: 'AUTOFFICINA', tyres: 'GOMMISTA', motorcycle_repair: 'MOTO OFFICINA', car_parts: 'RICAMBI AUTO', car_wash: 'AUTOLAVAGGIO', car: 'AUTO', motorcycle: 'MOTO', caravan: 'CAMPER', truck: 'VEICOLI INDUSTRIALI',
  cafe: 'BAR', bar: 'BAR', pub: 'PUB', biergarten: 'BIRRERIA', restaurant: 'RISTORANTE', ice_cream: 'GELATERIA', pizza: 'PIZZERIA', kebab: 'KEBAB', burger: 'BURGER', sushi: 'SUSHI', chinese: 'RISTORANTE CINESE',
  japanese: 'SUSHI', italian: 'TRATTORIA', regional: 'TRATTORIA', fast_food: 'TAVOLA CALDA', sandwich: 'PANINOTECA', coffee_shop: 'CAFFETTERIA',
  bakery: 'PANETTERIA', pastry: 'PASTICCERIA', butcher: 'MACELLERIA', greengrocer: 'FRUTTA E VERDURA', convenience: 'ALIMENTARI', deli: 'GASTRONOMIA', cheese: 'FORMAGGI', wine: 'ENOTECA',
  beverages: 'BEVANDE', seafood: 'PESCHERIA', confectionery: 'DOLCIUMI', coffee: 'TORREFAZIONE', pasta: 'PASTA FRESCA', alcohol: 'ENOTECA', chocolate: 'CIOCCOLATERIA', farm: 'PRODOTTI TIPICI',
  supermarket: 'SUPERMERCATO', clothes: 'ABBIGLIAMENTO', shoes: 'CALZATURE', jewelry: 'GIOIELLERIA', optician: 'OTTICA', bag: 'PELLETTERIA', boutique: 'BOUTIQUE', fabric: 'TESSUTI', tailor: 'SARTORIA',
  watches: 'OROLOGERIA', gift: 'ARTICOLI REGALO', toys: 'GIOCATTOLI', sports: 'SPORT', baby_goods: 'PRIMA INFANZIA', second_hand: 'USATO', leather: 'PELLETTERIA',
  pharmacy: 'FARMACIA', chemist: 'DROGHERIA', medical_supply: 'SANITARIA', herbalist: 'ERBORISTERIA', bank: 'BANCA', bureau_de_change: 'CAMBIO VALUTE', money_transfer: 'MONEY TRANSFER',
  estate_agent: 'IMMOBILIARE', insurance: 'ASSICURAZIONI', lawyer: 'STUDIO LEGALE', accountant: 'COMMERCIALISTA', notary: 'NOTAIO', architect: 'ARCHITETTURA', travel_agency: 'AGENZIA VIAGGI',
  driving_school: 'AUTOSCUOLA', employment_agency: 'AGENZIA PER IL LAVORO', it: 'INFORMATICA', government: 'UFFICI', company: 'UFFICI', tax_advisor: 'CONSULENZA FISCALE',
  doctors: 'STUDIO MEDICO', doctor: 'STUDIO MEDICO', dentist: 'STUDIO DENTISTICO', clinic: 'POLIAMBULATORIO', physiotherapist: 'FISIOTERAPIA', psychotherapist: 'PSICOTERAPIA', veterinary: 'VETERINARIO',
  laboratory: 'ANALISI CLINICHE', centre: 'CENTRO MEDICO', optometrist: 'OPTOMETRIA', podiatrist: 'PODOLOGIA', audiologist: 'APPARECCHI ACUSTICI', rehabilitation: 'RIABILITAZIONE',
  tobacco: 'TABACCHI', newsagent: 'EDICOLA', kiosk: 'EDICOLA', lottery: 'LOTTO', 'e-cigarette': 'SVAPO', books: 'LIBRERIA', stationery: 'CARTOLERIA',
  hardware: 'FERRAMENTA', florist: 'FIORI', pet: 'ANIMALI', bicycle: 'CICLI', dry_cleaning: 'TINTORIA', laundry: 'LAVANDERIA', mobile_phone: 'TELEFONIA', computer: 'COMPUTER', electronics: 'ELETTRONICA',
  locksmith: 'CHIAVI', funeral_directors: 'ONORANZE FUNEBRI', copyshop: 'COPISTERIA', paint: 'COLORI', doityourself: 'FAI DA TE', garden_centre: 'GARDEN', photo: 'FOTO', variety_store: 'TUTTO PER LA CASA',
  appliance: 'ELETTRODOMESTICI', music: 'MUSICA', travel: 'VIAGGI', sewing: 'MERCERIA', frame: 'CORNICI', games: 'GIOCHI', art: 'BELLE ARTI',
  electrician: 'IMPIANTI ELETTRICI', plumber: 'IDRAULICA', joiner: 'FALEGNAMERIA', carpenter: 'FALEGNAMERIA', upholsterer: 'TAPPEZZERIA', window_construction: 'SERRAMENTI', glaziery: 'VETRERIA',
  dressmaker: 'SARTORIA', painter: 'IMBIANCHINO', metal_construction: 'CARPENTERIA METALLICA', shoemaker: 'CALZOLAIO', key_cutter: 'CHIAVI', photographer: 'FOTOGRAFO', vacant: 'AFFITTASI' };
const NG_CLASS_LABEL = { mobili: 'ARREDAMENTI', bellezza: 'ESTETICA', officina: 'AUTOFFICINA', auto: 'AUTOSALONE', bar: 'BAR', ristorante: 'RISTORANTE', pizzeria: 'PIZZERIA', gelateria: 'GELATERIA',
  alimentari: 'ALIMENTARI', supermercato: 'SUPERMERCATO', moda: 'MODA', farmacia: 'FARMACIA', banca: 'BANCA', ufficio: 'UFFICI', medico: 'STUDIO MEDICO', tabacchi: 'TABACCHI', bottega: 'NEGOZIO',
  artigiano: 'LABORATORIO', sfitto: 'AFFITTASI' };
// real chains keep their colours on the sign
const NG_BRANDS = [[/esselunga/i, ['#1a5aa6', '#ffffff']], [/carrefour/i, ['#1e4fa3', '#ffffff']], [/eurospin/i, ['#1d3f8f', '#f5c400']], [/famila/i, ['#e30613', '#ffffff']], [/migross/i, ['#e2001a', '#ffffff']],
  [/^md\b/i, ['#ffde00', '#c8102e']], [/lidl/i, ['#0050aa', '#fff000']], [/conad/i, ['#e2001a', '#ffffff']], [/\bcoop\b/i, ['#e2001a', '#ffffff']], [/sigma/i, ['#e2001a', '#ffffff']], [/crai/i, ['#e2001a', '#ffffff']],
  [/prix/i, ['#e30613', '#ffffff']], [/unes|^u2\b/i, ['#d7001d', '#ffffff']], [/iperal/i, ['#c8102e', '#ffffff']], [/in's/i, ['#e30613', '#ffffff']], [/di per d/i, ['#e2001a', '#ffffff']],
  [/maxigross|c\+c/i, ['#00553a', '#ffffff']], [/aldi/i, ['#00005f', '#ffffff']], [/tigros/i, ['#e2001a', '#ffffff']], [/intesa/i, ['#00843d', '#ffffff']], [/unicredit/i, ['#e2001a', '#ffffff']], [/bpm/i, ['#0a3f8a', '#ffffff']],
  [/agricole/i, ['#007a6e', '#ffffff']], [/sondrio/i, ['#0b4b8a', '#ffffff']], [/desio/i, ['#1d3a6b', '#ffffff']], [/\bbcc\b|credito cooperativo/i, ['#00835b', '#ffffff']], [/tecnocasa/i, ['#1d4f9a', '#ffffff']],
  [/unipol/i, ['#003a70', '#ffffff']], [/generali/i, ['#c8102e', '#ffffff']], [/acqua & sapone/i, ['#e5007e', '#ffffff']], [/unieuro/i, ['#00529b', '#ffffff']], [/poste/i, ['#f2c230', '#163a7a']]];

// ---- the models. s: sign (pan board, cas lightbox, fas painted band, let letters on the wall, ten on the awning's valance, tar brass plaques only, none);
// c: [background, letters] (background null for bare letters); f: font; k: frame colour; fs: frame (thin, steel, wood, portal);
// d: door (c centre, l left, r right, 2 two, v glass front with sliding doors, g open workshop bay, p street door, x shutter down);
// a: awning ([strip, c1, c2], [flat, c], [cap, c] rounded, [pen] glass canopy); p: what stands outside; x: on the wall (ban sign sticking out,
// croce green cross, T tobacconist, palo barber's pole, atm, app wall lamps, menu, neon APERTO, targ plaque, tot totem, band flags); w: width; sub: the trade under the name
const NG_MODELS = {
  mobili: [
    { s: 'let', c: [null, '#2b2b2b'], f: 'serif', k: '#2b2b2b', fs: 'thin', d: 'v', w: 11, x: ['tot', 'app'], sub: 1 },
    { s: 'cas', c: ['#1f2a44', '#f2efe6'], f: 'sans', k: '#1f2a44', fs: 'steel', d: 'v', w: 9, a: ['pen'], x: ['ban'] },
    { s: 'fas', c: ['#7a5a3c', '#f6eedf'], f: 'serif', k: '#5a3e28', fs: 'wood', d: 'c', w: 7, a: ['flat', '#5a3e28'], p: ['pol', 'vas'] },
    { s: 'pan', c: ['#f2efe6', '#8a1f1f'], f: 'slab', k: '#8a1f1f', fs: 'portal', d: '2', w: 9, x: ['app'], p: ['vas', 'vas'], sub: 1 },
    { s: 'let', c: [null, '#b08d57'], f: 'black', k: '#3a3d40', fs: 'steel', d: 'v', w: 13, x: ['band', 'tot'] },
    { s: 'cas', c: ['#e8e4da', '#1e5a4c'], f: 'cond', k: '#3a3d40', fs: 'thin', d: 'l', w: 6, a: ['strip', '#1e5a4c', '#e8e4da'], p: ['pol'] },
  ],
  bellezza: [
    { s: 'pan', c: ['#f4c6cf', '#5a1f33'], f: 'script', k: '#d9a0ad', fs: 'thin', d: 'c', w: 4.5, p: ['vas'] },
    { s: 'fas', c: ['#141414', '#d8b46a'], f: 'serif', k: '#141414', fs: 'steel', d: 'l', w: 5, x: ['ban', 'app'] },
    { s: 'cas', c: ['#1d2f4f', '#ffffff'], f: 'slab', k: '#1d2f4f', fs: 'wood', d: 'r', w: 4, x: ['palo'], a: ['strip', '#1d2f4f', '#f2f2ee'], p: ['pan'] },
    { s: 'let', c: [null, '#3a3a3a'], f: 'cond', k: '#e8e6e0', fs: 'thin', d: 'c', w: 5, p: ['vas', 'vas'], x: ['neon'], sub: 1 },
    { s: 'pan', c: ['#2f8f8a', '#ffffff'], f: 'sans', k: '#2f8f8a', fs: 'thin', d: 'l', w: 4.5, a: ['flat', '#2f8f8a'], sub: 1 },
    { s: 'cas', c: ['#8c6bb1', '#ffffff'], f: 'script', k: '#5e4580', fs: 'portal', d: 'c', w: 5, x: ['ban'], sub: 1 },
  ],
  officina: [
    { s: 'pan', c: ['#c8102e', '#ffffff'], f: 'black', k: '#6b6e72', fs: 'steel', d: 'g', w: 7, p: ['pne', 'bid'] },
    { s: 'pan', c: ['#1d4f9a', '#ffd200'], f: 'black', k: '#3a3d40', fs: 'steel', d: 'g', w: 8, p: ['pne', 'pne'], x: ['ban'] },
    { s: 'fas', c: ['#f2c230', '#1a1a1a'], f: 'cond', k: '#4a4d52', fs: 'steel', d: 'g', w: 6, p: ['bid', 'pne'], sub: 1 },
    { s: 'cas', c: ['#ffffff', '#c8102e'], f: 'black', k: '#8f949a', fs: 'steel', d: 'g', w: 9, a: ['pen'], p: ['pne'], x: ['tot'] },
    { s: 'pan', c: ['#2b2f33', '#ff7a1e'], f: 'slab', k: '#2b2f33', fs: 'steel', d: 'g', w: 6, p: ['bid', 'pne', 'bid'] },
    { s: 'let', c: [null, '#1d4f9a'], f: 'black', k: '#d9d6cf', fs: 'thin', d: 'g', w: 7, x: ['ban'], sub: 1 },
  ],
  auto: [
    { s: 'cas', c: ['#1a1a1a', '#ffffff'], f: 'cond', k: '#c9ccd1', fs: 'steel', d: 'v', w: 14, x: ['band', 'tot'], a: ['pen'] },
    { s: 'let', c: [null, '#c8102e'], f: 'black', k: '#8f949a', fs: 'thin', d: 'v', w: 12, x: ['band'] },
    { s: 'pan', c: ['#0055a5', '#ffffff'], f: 'sans', k: '#0055a5', fs: 'steel', d: 'v', w: 10, x: ['tot'] },
    { s: 'fas', c: ['#e4e4e0', '#1a1a1a'], f: 'black', k: '#3a3d40', fs: 'steel', d: 'v', w: 12, x: ['band'] },
    { s: 'cas', c: ['#2a6f3a', '#ffffff'], f: 'slab', k: '#2a6f3a', fs: 'thin', d: 'v', w: 9, a: ['pen'], x: ['tot'], sub: 1 },
  ],
  bar: [
    { s: 'pan', c: ['#1f4d3a', '#f4e7c4'], f: 'serif', k: '#1f4d3a', fs: 'wood', d: 'c', w: 5, a: ['strip', '#1f4d3a', '#f4e7c4'], p: ['tav', 'tav', 'omb'], x: ['app', 'menu'] },
    { s: 'cas', c: ['#7a1f1a', '#ffffff'], f: 'sans', k: '#3a2a20', fs: 'wood', d: 'l', w: 5, a: ['flat', '#7a1f1a'], p: ['tav', 'tav', 'lav'], x: ['ban'] },
    { s: 'let', c: [null, '#f2d27e'], f: 'script', k: '#1a1a1a', fs: 'steel', d: 'c', w: 6, p: ['tav', 'fio', 'tav', 'fio'], x: ['app', 'neon'] },
    { s: 'ten', c: ['#2a4d7a', '#ffffff'], f: 'slab', k: '#2a4d7a', fs: 'thin', d: 'r', w: 5, a: ['flat', '#2a4d7a'], p: ['tav', 'lav'] },
    { s: 'fas', c: ['#e8b520', '#2b1a10'], f: 'black', k: '#5a3a22', fs: 'portal', d: 'c', w: 6, p: ['tav', 'tav', 'omb'], x: ['ban'] },
    { s: 'pan', c: ['#f2efe6', '#1a1a1a'], f: 'cond', k: '#1a1a1a', fs: 'steel', d: 'l', w: 4.5, a: ['strip', '#1a1a1a', '#f2efe6'], p: ['tav', 'fio'], x: ['menu'] },
  ],
  ristorante: [
    { s: 'fas', c: ['#7a1f1a', '#f6e6c8'], f: 'serif', k: '#4a2a1a', fs: 'wood', d: 'c', w: 6, a: ['flat', '#7a1f1a'], p: ['fio', 'tav', 'fio'], x: ['app', 'menu'] },
    { s: 'let', c: [null, '#f6e6c8'], f: 'script', k: '#2b2b2b', fs: 'portal', d: 'c', w: 7, x: ['app', 'menu'], p: ['vas', 'vas'] },
    { s: 'pan', c: ['#1f3b2c', '#e8d9a8'], f: 'serif', k: '#1f3b2c', fs: 'wood', d: 'l', w: 6, a: ['strip', '#1f3b2c', '#e8d9a8'], p: ['tav', 'tav', 'lav'] },
    { s: 'ten', c: ['#5a1f3a', '#ffffff'], f: 'serif', k: '#3a2a20', fs: 'wood', d: 'c', w: 6, a: ['cap', '#5a1f3a'], p: ['lav', 'vas'], x: ['menu'] },
    { s: 'cas', c: ['#c8331f', '#ffe08a'], f: 'slab', k: '#2b2b2b', fs: 'steel', d: 'r', w: 5, x: ['ban'], p: ['fio', 'tav'] },
    { s: 'pan', c: ['#e9e2cf', '#4a2a1a'], f: 'serif', k: '#8a6a4a', fs: 'portal', d: '2', w: 8, a: ['flat', '#4a2a1a'], p: ['tav', 'tav', 'tav'], x: ['app'] },
  ],
  pizzeria: [
    { s: 'pan', c: ['#c8331f', '#ffffff'], f: 'black', k: '#2a6f3a', fs: 'thin', d: 'c', w: 5, a: ['strip', '#2a6f3a', '#f2efe6'], p: ['tav', 'lav'], x: ['ban'] },
    { s: 'cas', c: ['#2a6f3a', '#ffffff'], f: 'script', k: '#2a6f3a', fs: 'wood', d: 'l', w: 5, a: ['flat', '#c8331f'], p: ['lav'] },
    { s: 'ten', c: ['#c8331f', '#ffffff'], f: 'black', k: '#c8331f', fs: 'steel', d: 'c', w: 4.5, a: ['flat', '#c8331f'], p: ['tav', 'tav'] },
    { s: 'let', c: [null, '#ffd27a'], f: 'script', k: '#3a2a20', fs: 'portal', d: 'c', w: 6, x: ['neon', 'app'], p: ['fio'] },
    { s: 'pan', c: ['#1a1a1a', '#ffd200'], f: 'cond', k: '#1a1a1a', fs: 'steel', d: 'r', w: 4, x: ['ban'], p: ['lav'], sub: 1 },
  ],
  gelateria: [
    { s: 'pan', c: ['#e9a6b9', '#4a1f2c'], f: 'script', k: '#e9a6b9', fs: 'thin', d: 'c', w: 4.5, a: ['strip', '#e9a6b9', '#ffffff'], p: ['con', 'tav'] },
    { s: 'cas', c: ['#7fcfc4', '#1d3a3a'], f: 'sans', k: '#4aa79a', fs: 'thin', d: 'l', w: 4.5, a: ['flat', '#7fcfc4'], p: ['tav', 'tav'], x: ['ban'] },
    { s: 'fas', c: ['#6b3a2a', '#f6e6c8'], f: 'script', k: '#6b3a2a', fs: 'wood', d: 'c', w: 5, p: ['con', 'vas'], x: ['neon'] },
    { s: 'ten', c: ['#f2c230', '#5a3a10'], f: 'black', k: '#f2c230', fs: 'steel', d: 'r', w: 4, a: ['cap', '#f2c230'], p: ['con', 'lav'] },
    { s: 'fas', c: ['#f6e6c8', '#c8331f'], f: 'serif', k: '#c8331f', fs: 'thin', d: 'c', w: 5, p: ['tav', 'tav', 'omb'] },
  ],
  alimentari: [
    { s: 'pan', c: ['#f2efe6', '#7a1f1a'], f: 'serif', k: '#5a3e28', fs: 'wood', d: 'c', w: 5, a: ['strip', '#7a1f1a', '#f2efe6'], p: ['lav'], sub: 1 },
    { s: 'fas', c: ['#2a5a2a', '#f6eedf'], f: 'slab', k: '#2a5a2a', fs: 'thin', d: 'l', w: 5, a: ['flat', '#2a5a2a'], p: ['lav'] },
    { s: 'cas', c: ['#c8331f', '#ffffff'], f: 'sans', k: '#4a4d52', fs: 'steel', d: 'r', w: 5, x: ['ban'], p: ['lav'], sub: 1 },
    { s: 'let', c: [null, '#5a3e28'], f: 'script', k: '#e8dcc0', fs: 'portal', d: 'c', w: 5, x: ['app'], p: ['vas', 'vas'], sub: 1 },
    { s: 'ten', c: ['#1d4f9a', '#ffffff'], f: 'slab', k: '#1d4f9a', fs: 'thin', d: 'c', w: 4.5, a: ['flat', '#1d4f9a'] },
    { s: 'pan', c: ['#e8b520', '#3a2a10'], f: 'cond', k: '#3a3d40', fs: 'steel', d: 'l', w: 4, a: ['strip', '#e8b520', '#ffffff'], p: ['lav'], sub: 1 },
  ],
  supermercato: [
    { s: 'cas', c: ['#c8102e', '#ffffff'], f: 'black', k: '#d9d6cf', fs: 'steel', d: 'v', w: 14, a: ['pen'], p: ['car'], x: ['tot'] },
    { s: 'cas', c: ['#1d5aa8', '#ffffff'], f: 'sans', k: '#1d5aa8', fs: 'steel', d: 'v', w: 12, p: ['car', 'car'], x: ['ban'] },
    { s: 'fas', c: ['#f2c230', '#1d3a8a'], f: 'black', k: '#3a3d40', fs: 'steel', d: 'v', w: 12, a: ['pen'], p: ['car'] },
    { s: 'let', c: [null, '#2a7a3a'], f: 'black', k: '#e8e6e0', fs: 'thin', d: 'v', w: 10, p: ['car'], x: ['tot'] },
    { s: 'cas', c: ['#ff7a1e', '#ffffff'], f: 'cond', k: '#4a4d52', fs: 'steel', d: 'v', w: 14, a: ['pen'], p: ['car', 'car'] },
  ],
  moda: [
    { s: 'let', c: [null, '#1a1a1a'], f: 'serif', k: '#1a1a1a', fs: 'steel', d: 'c', w: 6, x: ['app'] },
    { s: 'fas', c: ['#1a1a1a', '#e8d9a8'], f: 'cond', k: '#1a1a1a', fs: 'thin', d: 'l', w: 5, a: ['flat', '#1a1a1a'], x: ['ban'] },
    { s: 'pan', c: ['#f2efe6', '#5a1f33'], f: 'script', k: '#d9cfc0', fs: 'portal', d: 'c', w: 5, p: ['vas', 'vas'] },
    { s: 'cas', c: ['#2a4d7a', '#ffffff'], f: 'sans', k: '#2a4d7a', fs: 'steel', d: 'r', w: 5, a: ['cap', '#2a4d7a'], sub: 1 },
    { s: 'ten', c: ['#6b2a3a', '#f2efe6'], f: 'serif', k: '#6b2a3a', fs: 'thin', d: 'c', w: 5, a: ['flat', '#6b2a3a'], x: ['app'] },
    { s: 'let', c: [null, '#b08d57'], f: 'black', k: '#2b2b2b', fs: 'steel', d: '2', w: 8, x: ['ban'] },
  ],
  farmacia: [
    { s: 'pan', c: ['#1d8f4e', '#ffffff'], f: 'sans', k: '#1d8f4e', fs: 'thin', d: 'c', w: 6, x: ['croce'] },
    { s: 'cas', c: ['#ffffff', '#1d8f4e'], f: 'serif', k: '#2b2b2b', fs: 'portal', d: 'c', w: 6, x: ['croce', 'app'] },
    { s: 'let', c: [null, '#1d8f4e'], f: 'serif', k: '#e8e2d0', fs: 'portal', d: '2', w: 8, x: ['croce'], a: ['flat', '#1d8f4e'] },
    { s: 'fas', c: ['#1d8f4e', '#ffffff'], f: 'cond', k: '#1d8f4e', fs: 'steel', d: 'v', w: 8, x: ['croce'], a: ['pen'] },
    { s: 'ten', c: ['#1d6f3e', '#ffffff'], f: 'serif', k: '#5a3e28', fs: 'wood', d: 'c', w: 5, a: ['flat', '#1d6f3e'], x: ['croce'] },
  ],
  banca: [
    { s: 'cas', c: ['#183a6b', '#ffffff'], f: 'sans', k: '#c9ccd1', fs: 'steel', d: 'c', w: 7, x: ['atm'] },
    { s: 'let', c: [null, '#183a6b'], f: 'serif', k: '#d9d0bc', fs: 'portal', d: 'c', w: 8, x: ['atm', 'targ'] },
    { s: 'fas', c: ['#00843d', '#ffffff'], f: 'sans', k: '#3a3d40', fs: 'steel', d: 'l', w: 7, x: ['atm', 'ban'] },
    { s: 'pan', c: ['#e2001a', '#ffffff'], f: 'black', k: '#8f949a', fs: 'steel', d: 'r', w: 7, x: ['atm'] },
    { s: 'cas', c: ['#0a2f5a', '#d8b46a'], f: 'serif', k: '#0a2f5a', fs: 'portal', d: 'c', w: 8, x: ['atm'] },
  ],
  ufficio: [
    { s: 'tar', c: ['#c9a85a', '#2a1f10'], f: 'serif', k: '#5a3e28', fs: 'portal', d: 'p', w: 3 },
    { s: 'pan', c: ['#1d4f9a', '#ffffff'], f: 'sans', k: '#1d4f9a', fs: 'thin', d: 'l', w: 5, sub: 1 },
    { s: 'let', c: [null, '#2b2b2b'], f: 'cond', k: '#8f949a', fs: 'steel', d: 'c', w: 5, x: ['targ'], sub: 1 },
    { s: 'cas', c: ['#f2c230', '#1a1a1a'], f: 'black', k: '#3a3d40', fs: 'steel', d: 'r', w: 5, x: ['ban'] },
    { s: 'fas', c: ['#2a2d33', '#ffffff'], f: 'sans', k: '#2a2d33', fs: 'thin', d: 'c', w: 5, a: ['flat', '#2a2d33'], sub: 1 },
    { s: 'tar', c: ['#d9d6cf', '#1a1a1a'], f: 'sans', k: '#3a3d40', fs: 'steel', d: 'c', w: 3.5, x: ['app'] },
  ],
  medico: [
    { s: 'tar', c: ['#c9a85a', '#2a1f10'], f: 'serif', k: '#e8e2d0', fs: 'portal', d: 'p', w: 3, x: ['app'] },
    { s: 'pan', c: ['#ffffff', '#1d6fb8'], f: 'sans', k: '#1d6fb8', fs: 'thin', d: 'c', w: 5, sub: 1, icon: 1 },
    { s: 'cas', c: ['#1d6fb8', '#ffffff'], f: 'sans', k: '#c9ccd1', fs: 'steel', d: 'v', w: 8, x: ['tot'], a: ['pen'], sub: 1 },
    { s: 'let', c: [null, '#2a8f8a'], f: 'cond', k: '#e8e6e0', fs: 'thin', d: 'l', w: 5, x: ['targ'], p: ['vas', 'vas'], sub: 1 },
    { s: 'fas', c: ['#2a8f8a', '#ffffff'], f: 'sans', k: '#2a8f8a', fs: 'steel', d: 'c', w: 6, x: ['ban'], sub: 1, icon: 1 },
  ],
  tabacchi: [
    { s: 'pan', c: ['#1d3a8a', '#ffffff'], f: 'sans', k: '#3a3d40', fs: 'steel', d: 'c', w: 4, x: ['T'], p: ['gio'] },
    { s: 'cas', c: ['#1a1a1a', '#ffffff'], f: 'cond', k: '#1a1a1a', fs: 'thin', d: 'l', w: 4, a: ['flat', '#1d3a8a'], x: ['T'] },
    { s: 'ten', c: ['#1d3a8a', '#ffffff'], f: 'black', k: '#1d3a8a', fs: 'thin', d: 'r', w: 4, a: ['flat', '#1d3a8a'], x: ['T'], p: ['lav'] },
    { s: 'fas', c: ['#f2efe6', '#1d3a8a'], f: 'slab', k: '#5a3e28', fs: 'wood', d: 'c', w: 4.5, x: ['T', 'ban'] },
    { s: 'let', c: [null, '#c8102e'], f: 'black', k: '#2b2b2b', fs: 'steel', d: 'c', w: 4, x: ['T'], p: ['gio'] },
  ],
  bottega: [
    { s: 'pan', c: ['#25303f', '#f2f2ee'], f: 'sans', k: '#25303f', fs: 'thin', d: 'c', w: 5, a: ['flat', '#25303f'], sub: 1 },
    { s: 'cas', c: ['#e8e6e0', '#c8331f'], f: 'black', k: '#4a4d52', fs: 'steel', d: 'l', w: 5, x: ['ban'], p: ['lav'] },
    { s: 'fas', c: ['#2a5a4a', '#ffffff'], f: 'slab', k: '#2a5a4a', fs: 'thin', d: 'r', w: 4.5, a: ['strip', '#2a5a4a', '#e8e6e0'] },
    { s: 'let', c: [null, '#3a3a3a'], f: 'cond', k: '#c9ccd1', fs: 'steel', d: 'c', w: 5, p: ['vas'], sub: 1 },
    { s: 'ten', c: ['#c8331f', '#ffffff'], f: 'sans', k: '#c8331f', fs: 'thin', d: 'c', w: 4.5, a: ['flat', '#c8331f'] },
    { s: 'pan', c: ['#f2c230', '#1a1a1a'], f: 'cond', k: '#3a3d40', fs: 'portal', d: 'l', w: 5, x: ['ban'], sub: 1 },
  ],
  artigiano: [
    { s: 'pan', c: ['#e8e6e0', '#1d4f9a'], f: 'black', k: '#6b6e72', fs: 'steel', d: 'g', w: 5, p: ['bnc'], sub: 1 },
    { s: 'fas', c: ['#5a3e28', '#f6eedf'], f: 'slab', k: '#5a3e28', fs: 'wood', d: 'g', w: 5, p: ['bnc', 'bid'] },
    { s: 'cas', c: ['#1d4f9a', '#ffffff'], f: 'sans', k: '#3a3d40', fs: 'steel', d: 'l', w: 5, sub: 1 },
    { s: 'let', c: [null, '#2b2b2b'], f: 'cond', k: '#a9a398', fs: 'thin', d: 'g', w: 6, p: ['bid'], sub: 1 },
    { s: 'pan', c: ['#f2c230', '#1a1a1a'], f: 'black', k: '#4a4d52', fs: 'steel', d: 'g', w: 5, x: ['ban'], p: ['bnc'] },
  ],
  sfitto: [
    { s: 'none', k: '#8f949a', fs: 'steel', d: 'x', w: 4 },
    { s: 'pan', c: ['#b8b3a8', '#9a958b'], f: 'sans', k: '#7d7a73', fs: 'thin', d: 'c', w: 4.5, old: 1 },
    { s: 'none', k: '#5a3e28', fs: 'wood', d: 'c', w: 4 },
    { s: 'none', k: '#3a3d40', fs: 'steel', d: 'x', w: 5 },
    { s: 'fas', c: ['#cfc9bd', '#a8a297'], f: 'serif', k: '#a9a398', fs: 'portal', d: 'l', w: 4.5, old: 1 },
  ],
};
// what the trade puts outside, whatever the model
const NG_SUBPROP = { florist: ['sec', 'sec', 'vas'], garden_centre: ['vas', 'sec', 'vas'], greengrocer: ['cas', 'cas'], farm: ['cas'], newsagent: ['gio', 'gio'], kiosk: ['gio'], tyres: ['pne', 'pne', 'pne'],
  bicycle: ['bic', 'bic'], joiner: ['bnc'], carpenter: ['bnc'], hardware: ['bid'], ice_cream: ['con'], car_wash: ['bid'] };
// what shows through the glass: theme by subtype where the trade changes the window, else by model
const NG_SUBTHEME = {
  mobili: { kitchen: 1, bathroom_furnishing: 1, bed: 2, interior_decoration: 3, antiques: 3, lighting: 4, curtain: 5, carpet: 5 },
  bellezza: { tattoo: 1, cosmetics: 4, perfumery: 4, pet_grooming: 5 },
  officina: { motorcycle_repair: 5 }, auto: { motorcycle: 5 },
  alimentari: { bakery: 0, pastry: 1, confectionery: 1, chocolate: 1, butcher: 2, deli: 2, cheese: 2, seafood: 2, pasta: 1, greengrocer: 3, farm: 3, wine: 4, beverages: 4, alcohol: 4, coffee: 4 },
  moda: { clothes: 0, boutique: 0, fashion_accessories: 0, tailor: 0, fabric: 0, sports: 0, second_hand: 0, shoes: 1, jewelry: 2, watches: 2, optician: 3, bag: 4, leather: 4, gift: 5, toys: 5, baby_goods: 5 },
  ufficio: { estate_agent: 0, travel_agency: 1, insurance: 4, driving_school: 5 },
  medico: { dentist: 1, veterinary: 2, physiotherapist: 3, rehabilitation: 3, laboratory: 4 },
  tabacchi: { tobacco: 0, lottery: 0, newsagent: 1, kiosk: 1, books: 2, stationery: 3, 'e-cigarette': 5 },
  bottega: { florist: 0, garden_centre: 0, hardware: 1, doityourself: 1, paint: 1, trade: 1, locksmith: 1, bicycle: 2, laundry: 3, dry_cleaning: 3, mobile_phone: 4, computer: 4, electronics: 4, appliance: 4, hifi: 4, video_games: 4, photo: 4 },
};
const NG_DEFTHEME = { alimentari: () => 5, moda: () => 0, ufficio: mi => 2 + mi % 2, medico: mi => mi % 2 ? 5 : 0, tabacchi: () => 0, bottega: () => 5, officina: mi => mi % 5, auto: mi => mi % 5 };

// ---- near and far (vetrine HQ, Carlo 8/11: "sembrano adesivi 2D"). Within 75 m of the camera a front is drawn whole: set 20-30 cm into the wall,
// with its reveal, stone sill and step, the frame with its mullions, the door with its handle, the shutter in its guides under its box. Further off a
// plain version, flat on the wall, as the fronts were before. Each vertex knows its front (ngC: centre x, z and the outward normal) and its version
// (ngL: 0 both, 1 near, 2 far): the vertex shader drops the triangles of the other one, so the switch costs no draw call and no work on the CPU.
// The sun's pass uses the same rule (uNgCam is the player's camera there too). The wall itself is not cut (world3.js draws it whole): an invisible
// plug on the opening, drawn after the inside of the opening and before the walls (renderOrder 8, 9, walls 10), keeps the wall from covering it.
// The inside of the opening takes the sun's shadow 35 cm out of the wall (push), where the facade has it: otherwise the wall would shade it always
const NG_U = { cam: { value: new THREE.Vector3(0, -1e5, 0) }, R2: { value: 75 * 75 }, lamps: { value: 0 } };
function ngLodVS(s, push) {
  s.uniforms.uNgCam = NG_U.cam; s.uniforms.uNgR2 = NG_U.R2;
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 ngC;\nattribute float ngL;\nuniform vec3 uNgCam;\nuniform float uNgR2;')
    .replace('#include <project_vertex>', '#include <project_vertex>\n  { vec2 ngD = ngC.xy - uNgCam.xz; bool ngNear = dot(ngD, ngD) < uNgR2; if ((ngL > 0.5 && ngL < 1.5 && !ngNear) || (ngL > 1.5 && ngNear)) gl_Position = vec4(0.0, 0.0, -2.0, 1.0); }');
  if (push) s.vertexShader = s.vertexShader.replace('#include <shadowmap_vertex>', '#ifdef USE_SHADOWMAP\n  worldPosition.xyz += vec3(ngC.z, 0.0, ngC.w) * ' + push.toFixed(2) + ';\n#endif\n#include <shadowmap_vertex>');
}
/* a material of the fronts: the rule of near and far, then its own changes (extra); key: its own program */
function ngLodMat(m, key, push = 0, extra = null) {
  const b0 = m.onBeforeCompile; m.onBeforeCompile = (s, r) => { if (b0) b0.call(m, s, r); ngLodVS(s, push); if (extra) extra(s); };
  m.customProgramCacheKey = () => 'ng-' + key; m.needsUpdate = true; return m;
}
/* the shadow of the fronts (what is in the sun's map follows the same rule), and of the signs (the letters cut out of their board) */
const NG_DEPTH = ngLodMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking }), 'depth');
const ngDepthMap = tex => ngLodMat(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: tex, alphaTest: 0.5 }), 'depthmap');
// ---- what shows through the glass: a room behind it (interior mapping). One atlas for all: the back wall of each class and theme (the 128 px
// pictures below, as before), and one layer per kind of shop that stands in the room, 1.4 m in (a counter, a desk, mannequins): the eye sees
// the counter move against the shelves as it walks. Floor, ceiling with its lights and side walls in the colours of the picture's room.
// Columns of 16 cells of 128 px; class c, theme th at c * 6 + th, the layers from 114
// The room: vUv is where the eye meets the glass across the opening (0..1), vNgV the way it looks in the frame of the wall (x along, y up, z in),
// ngR (width, height, cell, layer), ngW (side walls, depth), ngF (floor). The ray goes on to the first wall of the box; the back wall repeats the
// picture every 2.4 m or so; the layer is a plane at 38% of the depth
const NG_ROOM_GLSL = `
vec4 ngAt(vec2 cell, vec2 q, vec2 gx, vec2 gy) {
  vec2 uv = vec2((cell.x + 0.03 + q.x * 0.94) / 16.0, 1.0 - (cell.y + 0.97 - q.y * 0.94) / 8.0);
#if __VERSION__ >= 300
  return mapTexelToLinear(textureGrad(map, uv, gx, gy));
#else
  return mapTexelToLinear(texture2D(map, uv));
#endif
}
vec3 ngRoom() {
  vec3 d = vNgV; d.z = max(d.z, 1e-3);
  float Wm = max(vNgR.x, 0.3), Hm = max(vNgR.y, 0.3), Dm = vNgW.w;
  vec3 dn = d / vec3(Wm, Hm, Dm);
  vec2 p0 = clamp(vUv, 0.0, 1.0);
  float tx = dn.x > 1e-6 ? (1.0 - p0.x) / dn.x : (dn.x < -1e-6 ? -p0.x / dn.x : 1e9);
  float ty = dn.y > 1e-6 ? (1.0 - p0.y) / dn.y : (dn.y < -1e-6 ? -p0.y / dn.y : 1e9);
  float tz = 1.0 / dn.z;
  float t = min(min(tx, ty), tz);
  vec3 h = vec3(p0, 0.0) + dn * t;
  vec3 hm = h * vec3(Wm, Hm, Dm);
  float nrep = max(1.0, floor(Wm / 2.4 + 0.5));
  float ngCi = floor(vNgR.z + 0.5); /* the cell number is a whole number carried by a varying: interpolated it jitters by a hair, and at 80.0 mod() gave 0 or 15.99999 pixel by pixel: the black stipple on the glass (Carlo 8/11) */
  vec2 cell = vec2(mod(ngCi, 16.0), floor(ngCi / 16.0));
  vec2 gs = vec2(nrep * 0.94 / 16.0, 0.94 / 8.0) * 0.6;
  vec2 gx = dFdx(vUv) * gs, gy = dFdy(vUv) * gs;
  vec3 col;
  bool ngHz = tz <= tx && tz <= ty, ngHy = !ngHz && ty <= tx; /* which wall the ray meets, decided by comparing the three, not by asking min() back for its own value: on some GPUs t == tz fails by a hair and the pixel is drawn as a side wall (the black stipple on the glass, Carlo 8/11) */
  if (ngHz) col = ngAt(cell, vec2(fract(h.x * nrep), h.y), gx, gy).rgb;
  else if (ngHy && dn.y < 0.0) { vec2 f = fract(hm.xz / 0.6); col = vNgF * mix(0.78, 1.0, step(0.05, f.x) * step(0.05, f.y)); }
  else if (ngHy) { vec2 f = fract(vec2(hm.x / 1.6, hm.z / 1.3)) - 0.5; float l = 1.0 - smoothstep(0.1, 0.16, length(f * vec2(1.6, 1.3))); col = mix(vec3(0.62, 0.61, 0.58), vec3(2.6, 2.4, 2.0), l * (0.25 + 0.75 * vNgOn)); }
  else col = vNgW.rgb * (0.6 + 0.2 * h.y);
  if (vNgR.w > -0.5) {
    float tm = 0.38 / dn.z;
    if (tm < t) {
      vec2 pm = p0 + dn.xy * tm;
      if (pm.x > 0.0 && pm.x < 1.0 && pm.y > 0.0 && pm.y < 1.0) { float mi = 114.0 + floor(vNgR.w + 0.5); vec4 m = ngAt(vec2(mod(mi, 16.0), floor(mi / 16.0 + 0.001)), vec2(fract(pm.x * nrep + 0.37), pm.y), gx, gy); if (m.a > 0.5) col = m.rgb; }
    }
  }
  return col * mix(1.0, 0.68, h.z);
}`;
const NG_MID = { bar: 0, gelateria: 0, pizzeria: 0, ristorante: 1, farmacia: 2, banca: 3, alimentari: 4, supermercato: 4, moda: 5, ufficio: 6, medico: 6, bottega: 7, bellezza: 7 };
const NG_WIN = (() => {
  const shade = (hex, k) => '#' + new THREE.Color(hex).multiplyScalar(k).getHexString();
  const F = (g, c, x, y, w, h) => { g.fillStyle = c; g.fillRect(x, y, w, h); };
  const O = (g, c, x, y, r) => { g.fillStyle = c; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); };
  let lastRoom = null; // the colours of the room the picture drew: the floor and the side walls take them
  const room = (g, wall, floor, lit = 1) => { lastRoom = [wall, floor];
    F(g, wall, 0, 0, 128, 96); F(g, floor, 0, 96, 128, 32);
    const gr = g.createLinearGradient(0, 0, 0, 96); gr.addColorStop(0, `rgba(255,250,235,${0.25 * lit})`); gr.addColorStop(1, 'rgba(0,0,0,0.12)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 96);
    for (const x of [24, 64, 104]) F(g, `rgba(255,250,230,${0.8 * lit})`, x - 8, 2, 16, 3);
  };
  const shelves = (g, R, x0, x1, y0, y1, rows, pal, sc = '#8a7a66') => {
    const rh = (y1 - y0) / rows;
    for (let r = 0; r < rows; r++) { const y = y0 + (r + 1) * rh; F(g, sc, x0, y - 2, x1 - x0, 3); for (let x = x0 + 1; x < x1 - 3;) { const w = 3 + R() * 6, h = rh * (0.4 + R() * 0.45); F(g, pal[Math.floor(R() * pal.length)], x, y - 2 - h, Math.min(w, x1 - x), h); x += w + 0.5 + R() * 1.5; } }
  };
  const sofa = (g, x, y, w, c) => { F(g, c, x, y - 26, w, 14); F(g, shade(c, 0.85), x, y - 13, w, 9); F(g, shade(c, 0.7), x - 4, y - 20, 6, 16); F(g, shade(c, 0.7), x + w - 2, y - 20, 6, 16); F(g, '#2a2420', x, y - 4, 3, 4); F(g, '#2a2420', x + w - 3, y - 4, 3, 4); };
  const table = (g, x, y, w, top, leg = '#3a2e26') => { F(g, top, x, y - 20, w, 4); F(g, leg, x + 2, y - 16, 3, 16); F(g, leg, x + w - 5, y - 16, 3, 16); };
  const chair = (g, x, y, c) => { F(g, c, x, y - 24, 3, 24); F(g, c, x, y - 12, 10, 3); F(g, c, x + 8, y - 12, 2, 12); };
  const manq = (g, x, y, c, c2) => { O(g, '#e9dccb', x, y - 58, 5); F(g, c, x - 8, y - 52, 16, 22); F(g, c2, x - 7, y - 30, 6, 24); F(g, c2, x + 1, y - 30, 6, 24); F(g, '#555', x - 1, y - 6, 2, 6); F(g, '#555', x - 8, y - 2, 16, 2); };
  const car = (g, x, y, w, c) => {
    g.fillStyle = c; g.beginPath(); g.moveTo(x, y - 8); g.lineTo(x + 2, y - 18); g.lineTo(x + w * 0.25, y - 20); g.lineTo(x + w * 0.38, y - 31); g.lineTo(x + w * 0.72, y - 31); g.lineTo(x + w * 0.86, y - 20); g.lineTo(x + w, y - 17); g.lineTo(x + w, y - 8); g.fill();
    F(g, 'rgba(180,210,230,.85)', x + w * 0.41, y - 28, w * 0.13, 8); F(g, 'rgba(180,210,230,.85)', x + w * 0.57, y - 28, w * 0.13, 8);
    O(g, '#1a1a1a', x + w * 0.22, y - 7, 7); O(g, '#1a1a1a', x + w * 0.8, y - 7, 7); O(g, '#9aa', x + w * 0.22, y - 7, 3); O(g, '#9aa', x + w * 0.8, y - 7, 3);
  };
  const poster = (g, x, y, w, h, bg, fg, txt, fs = 12) => { F(g, bg, x, y, w, h); g.fillStyle = fg; g.font = `bold ${fs}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, x + w / 2, y + h / 2, w - 4); };
  const frost = (g, y0, y1, a = 0.75) => { F(g, `rgba(236,238,236,${a})`, 0, y0, 128, y1 - y0); F(g, 'rgba(255,255,255,.5)', 0, y0, 128, 1); F(g, 'rgba(255,255,255,.5)', 0, y1 - 1, 128, 1); };
  const lamp = (g, x, y, c = '#2b2b2b') => { F(g, '#333', x, 0, 1, y); g.fillStyle = c; g.beginPath(); g.moveTo(x - 7, y + 8); g.lineTo(x + 8, y + 8); g.lineTo(x + 4, y); g.lineTo(x - 3, y); g.fill(); O(g, 'rgba(255,230,160,.9)', x + 0.5, y + 9, 3); };
  const plant = (g, x, y) => { F(g, '#b5653a', x - 5, y - 10, 10, 10); for (let i = 0; i < 6; i++) O(g, i % 2 ? '#4f7a35' : '#3d6a2a', x - 6 + (i % 3) * 6, y - 16 - Math.floor(i / 3) * 7, 5); };
  const cross = (g, x, y, s, c) => { F(g, c, x - s / 6, y - s / 2, s / 3, s); F(g, c, x - s / 2, y - s / 6, s, s / 3); };
  const counter = (g, y, c, top = '#d9d6cf') => { F(g, c, 0, y, 128, 128 - y); F(g, top, 0, y - 3, 128, 4); };
  const glassOver = g => {
    const gr = g.createLinearGradient(0, 0, 128, 128); gr.addColorStop(0, 'rgba(255,255,255,0.20)'); gr.addColorStop(0.32, 'rgba(255,255,255,0.03)'); gr.addColorStop(0.55, 'rgba(255,255,255,0.13)'); gr.addColorStop(0.62, 'rgba(255,255,255,0.02)'); gr.addColorStop(1, 'rgba(200,220,235,0.06)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128); g.strokeStyle = 'rgba(0,0,0,.3)'; g.lineWidth = 3; g.strokeRect(0, 0, 128, 128);
  };
  const D = {
    mobili(g, th, R) {
      const wall = ['#efe8dc', '#f4f1ea', '#e8e0d4', '#ded6ca', '#2f2b28', '#e9e4dc'][th]; room(g, wall, th === 4 ? '#3a332e' : '#c9b79c');
      const sc = ['#6b4f3a', '#3d5a6b', '#a33a2a', '#d9cbb0', '#4a6b4a', '#8a6b9a'][Math.floor(R() * 6)];
      if (th === 0 || th === 5) { F(g, '#b8a68a', 10, 108, 108, 10); sofa(g, 22, 108, 60, sc); F(g, '#8a7a66', 96, 50, 2, 58); g.fillStyle = '#efe0c0'; g.fillRect(90, 42, 14, 10); F(g, shade(wall, 0.8), 36, 30, 34, 22); F(g, '#7a9ab0', 38, 32, 30, 18); if (th === 5) { F(g, '#7a2a3a', 0, 0, 12, 100); F(g, '#7a2a3a', 116, 0, 12, 100); } }
      else if (th === 1) { F(g, sc, 6, 74, 116, 34); for (let x = 8; x < 120; x += 19) F(g, shade(sc, 0.7), x + 13, 80, 2, 10); F(g, '#e8e4dc', 4, 72, 120, 4); F(g, shade(sc, 1.1), 6, 14, 60, 30); F(g, '#c9ccd1', 80, 20, 30, 16); F(g, '#2a2a2a', 84, 58, 20, 14); }
      else if (th === 2) { F(g, shade(sc, 0.8), 20, 48, 88, 30); F(g, '#f2efe6', 18, 76, 92, 20); F(g, sc, 18, 84, 92, 14); F(g, '#5a4636', 4, 80, 14, 18); F(g, '#5a4636', 110, 80, 14, 18); O(g, '#ffe6a8', 11, 74, 5); O(g, '#ffe6a8', 117, 74, 5); }
      else if (th === 3) { table(g, 30, 108, 68, '#8a6a4a'); for (const x of [14, 44, 74, 104]) chair(g, x, 110, '#4a3a2e'); lamp(g, 64, 40, '#c9a85a'); }
      else { for (let i = 0; i < 7; i++) lamp(g, 10 + i * 18, 18 + R() * 40, ['#c9a85a', '#e8e4dc', '#2b2b2b', '#a33a2a'][i % 4]); F(g, '#5a4a3a', 20, 100, 88, 8); }
    },
    bellezza(g, th, R) {
      const wall = ['#f6d6dc', '#1d1b1f', '#f4f4f2', '#d6efec', '#e6dcf0', '#f2e6d6'][th]; room(g, wall, th === 1 ? '#2a2a2a' : '#d9d6cf');
      if (th === 4) { shelves(g, R, 6, 122, 10, 90, 4, ['#e5007e', '#f2c230', '#ffffff', '#1d6fb8', '#c9a85a', '#8c6bb1'], '#e8e4dc'); counter(g, 100, '#f2efe6'); return; }
      for (const x of [14, 54, 94]) { F(g, th === 1 ? '#c9a85a' : '#bfb8ae', x - 2, 18, 24, 44); F(g, '#cfe0ea', x, 20, 20, 40); F(g, '#1d1d1f', x + 4, 74, 14, 14); F(g, '#1d1d1f', x + 2, 64, 18, 12); F(g, '#555', x + 9, 88, 3, 20); }
      if (th === 5) { O(g, '#c9a07a', 40, 100, 9); F(g, '#7fb0d0', 70, 92, 30, 14); } else plant(g, 118, 110);
    },
    officina(g, th, R) {
      const wall = ['#4a4d52', '#3a3d40', '#55575b', '#40464d', '#4d4a45'][th % 5]; room(g, wall, '#5a5c5e', 0.6);
      F(g, '#2a2c2e', 4, 14, 50, 36); for (let i = 0; i < 18; i++) F(g, ['#c8102e', '#8f949a', '#e8b520', '#1d4f9a'][i % 4], 7 + (i % 6) * 8, 18 + Math.floor(i / 6) * 11, 3, 8);
      if (th === 5) { O(g, '#1a1a1a', 74, 104, 9); O(g, '#1a1a1a', 108, 104, 9); F(g, '#c8102e', 76, 86, 28, 10); F(g, '#333', 92, 76, 4, 12); return; }
      F(g, '#c9a82a', 60, 70, 4, 40); F(g, '#c9a82a', 118, 70, 4, 40); F(g, '#8f949a', 56, 70, 70, 4);
      car(g, 58, 70, 66, ['#c8102e', '#1d4f9a', '#e8e6e0', '#2b2b2b', '#6b6e72'][th % 5]);
      for (let i = 0; i < 3; i++) { O(g, '#1a1a1a', 18, 118 - i * 9, 9); O(g, '#3a3a3a', 18, 118 - i * 9, 4); }
    },
    auto(g, th, R) {
      room(g, '#f4f4f2', '#d9dbdd'); F(g, 'rgba(255,255,255,.4)', 0, 98, 128, 6);
      if (th === 5) { for (const x of [30, 90]) { O(g, '#1a1a1a', x - 14, 108, 8); O(g, '#1a1a1a', x + 14, 108, 8); F(g, ['#c8102e', '#1a1a1a'][x > 50 ? 1 : 0], x - 14, 92, 28, 8); } return; }
      const cols = [['#c8102e', '#2b2b2b'], ['#e8e6e0', '#1d4f9a'], ['#6b6e72', '#f2c230'], ['#1a1a1a', '#e8e6e0'], ['#2a6f3a', '#c9ccd1']][th % 5];
      car(g, 4, 112, 64, cols[0]); car(g, 66, 112, 60, cols[1]); poster(g, 40, 14, 48, 22, '#c8102e', '#fff', 'PROMO', 13);
    },
    bar(g, th, R) {
      const wall = ['#7a4a2a', '#2a3a2f', '#e8dcc0', '#1d2a3a', '#8a2a1f', '#f0e6d0'][th]; room(g, wall, '#5a4636');
      shelves(g, R, 6, 122, 12, 56, 3, ['#2a6f3a', '#8a1f1f', '#e8b520', '#c9ccd1', '#3a2a1a', '#f2efe6'], '#c9a85a');
      counter(g, 84, ['#5a3a22', '#1f2a24', '#8a6a4a', '#2a2d33', '#3a2a20', '#a08a6a'][th], '#e8e4dc');
      F(g, '#c9ccd1', 14, 66, 22, 18); F(g, '#8f949a', 18, 70, 14, 8); for (const x of [50, 76, 102]) { O(g, '#2b2b2b', x, 98, 6); F(g, '#555', x - 1, 98, 2, 24); }
    },
    ristorante(g, th, R) {
      const wall = ['#e8d9b8', '#3a2a24', '#d9e2d0', '#f2e6d6', '#8a1f1f', '#efe6d8'][th]; room(g, wall, '#6b4f3a');
      const cloth = ['#ffffff', '#c8331f', '#f2efe6', '#2a5a3a', '#ffffff', '#e8d9a8'][th];
      F(g, shade(wall, 0.75), 20, 22, 26, 18); F(g, shade(wall, 0.75), 80, 22, 26, 18);
      for (const x of [8, 70]) { table(g, x, 112, 50, cloth); if (th === 1) for (let i = 0; i < 5; i++) F(g, '#fff', x + i * 10, 92, 5, 4); chair(g, x - 6, 114, '#3a2a1a'); chair(g, x + 50, 114, '#3a2a1a'); O(g, '#ffe6a8', x + 25, 86, 2); }
      if (th === 4) for (let i = 0; i < 6; i++) O(g, 'rgba(255,215,140,.9)', 12 + i * 21, 8, 3);
    },
    pizzeria(g, th, R) {
      const wall = ['#f2e6d6', '#e8d9b8', '#ffffff', '#3a2a24', '#f6d06a', '#d9e2d0'][th]; room(g, wall, '#8a6a4a');
      if (th === 4) { counter(g, 76, '#c9ccd1', '#f2efe6'); for (let i = 0; i < 4; i++) { F(g, '#d9a050', 6 + i * 31, 66, 28, 9); for (let k = 0; k < 4; k++) O(g, ['#c8331f', '#2a6f3a', '#f2efe6'][k % 3], 10 + i * 31 + k * 6, 70, 2); } poster(g, 30, 12, 68, 26, '#1a1a1a', '#ffd200', 'AL TAGLIO', 12); return; }
      g.fillStyle = '#9a4733'; g.beginPath(); g.arc(80, 74, 34, Math.PI, 0); g.fill(); F(g, '#9a4733', 46, 74, 68, 14); g.fillStyle = '#ff8a2a'; g.beginPath(); g.arc(80, 76, 12, Math.PI, 0); g.fill(); O(g, 'rgba(255,190,90,.5)', 80, 70, 18);
      counter(g, 92, ['#2a6f3a', '#c8331f', '#3a3d40', '#5a3a22', '#2a6f3a', '#c8331f'][th], '#f2efe6'); poster(g, 6, 14, 30, 40, '#1a1a1a', '#fff', 'MENU', 9);
    },
    gelateria(g, th, R) {
      const wall = ['#fbe3ea', '#d9f2ee', '#f6e6c8', '#fff4c8', '#f2efe6', '#e8f0fb'][th]; room(g, wall, '#d9d6cf');
      F(g, '#c9ccd1', 0, 74, 128, 54); F(g, 'rgba(220,240,250,.8)', 4, 60, 120, 16);
      const tubs = ['#9ac46a', '#f4a6b8', '#6b3a2a', '#f6e27a', '#f6efd8', '#5ab4e6', '#e8a050', '#c8331f', '#3a2a1a', '#ffffff'];
      for (let i = 0; i < 10; i++) F(g, tubs[(i + th) % tubs.length], 6 + i * 12, 66, 10, 8);
      g.fillStyle = '#d9a050'; g.beginPath(); g.moveTo(100, 50); g.lineTo(112, 50); g.lineTo(106, 20 + 40); g.fill(); O(g, tubs[th], 106, 44, 7); poster(g, 10, 12, 50, 20, '#e9a6b9', '#fff', 'GELATI', 11);
    },
    alimentari(g, th, R) {
      const wall = ['#f2e2c4', '#fbeae0', '#f4f4f2', '#eef2e6', '#3a2a24', '#f4f1ea'][th]; room(g, wall, '#b9b0a2');
      if (th === 0) { shelves(g, R, 6, 122, 10, 70, 3, ['#c9893a', '#a8652a', '#e0b060', '#8a5a2a'], '#8a6a4a'); counter(g, 88, '#8a6a4a'); for (let i = 0; i < 6; i++) { g.fillStyle = '#c9893a'; g.beginPath(); g.ellipse(14 + i * 20, 82, 8, 4, 0, 0, TAU); g.fill(); } }
      else if (th === 1) { counter(g, 70, '#e8e4dc', '#c9ccd1'); F(g, 'rgba(220,240,250,.7)', 0, 52, 128, 18); for (let i = 0; i < 14; i++) O(g, ['#f4a6b8', '#f6efd8', '#6b3a2a', '#c8331f', '#e8c070'][i % 5], 6 + (i % 7) * 18, 58 + Math.floor(i / 7) * 8, 4); shelves(g, R, 6, 122, 6, 44, 2, ['#e8c070', '#f2efe6', '#c9a85a'], '#d9cfc0'); }
      else if (th === 2) { counter(g, 72, '#f2efe6', '#c9ccd1'); F(g, 'rgba(220,240,250,.7)', 0, 54, 128, 18); for (let i = 0; i < 8; i++) F(g, ['#b8323a', '#d06a6a', '#f2d8c8', '#e8c070'][i % 4], 4 + i * 15, 60, 12, 10); for (let i = 0; i < 6; i++) F(g, '#8a3a2a', 10 + i * 20, 8, 6, 26); }
      else if (th === 3) { for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) { const x = 4 + c * 31, y = 50 + r * 24; F(g, '#a8784a', x, y + 10, 28, 12); const fc = ['#c8331f', '#f2a020', '#9ac46a', '#f6e27a', '#6b2a6a', '#2a7a3a'][(r * 4 + c) % 6]; for (let k = 0; k < 6; k++) O(g, fc, x + 4 + (k % 3) * 9, y + 8 - Math.floor(k / 3) * 5, 4); } }
      else if (th === 4) { shelves(g, R, 4, 124, 6, 112, 5, ['#2a4a2a', '#5a1f2a', '#3a2a1a', '#c9a85a', '#1d3a2a'], '#6b4f3a'); }
      else { shelves(g, R, 4, 124, 8, 96, 4, ['#c8331f', '#f2c230', '#1d4f9a', '#2a7a3a', '#f2efe6', '#e86a2a'], '#c9ccd1'); counter(g, 104, '#c9ccd1'); }
    },
    supermercato(g, th, R) {
      room(g, '#f4f4f2', '#d9dbdd', 1.2);
      for (let k = 0; k < 3; k++) { const x0 = 4 + k * 42; shelves(g, R, x0, x0 + 36, 40, 106, 4, ['#c8331f', '#f2c230', '#1d4f9a', '#2a7a3a', '#f2efe6', '#e86a2a', '#8a1f6a'], '#9aa0a6'); }
      const p = [['#f2c230', '#c8102e', 'OFFERTE'], ['#c8102e', '#ffffff', '-30%'], ['#2a7a3a', '#ffffff', 'FRESCO'], ['#1d4f9a', '#ffffff', 'SCONTI'], ['#ff7a1e', '#ffffff', '3x2'], ['#f2c230', '#1d3a8a', 'PROMO']][th];
      poster(g, 8, 8, 52, 26, p[0], p[1], p[2], 13); poster(g, 68, 8, 52, 26, p[1], p[0], ['1,99', '0,89', 'KM 0', '2,49', '-50%', '4,99'][th], 14);
    },
    moda(g, th, R) {
      const wall = ['#f2efe6', '#e8e4dc', '#1d1b1f', '#f4f4f2', '#d9cfc0', '#e8f0fb'][th]; room(g, wall, th === 2 ? '#141414' : '#d9d0c4');
      if (th === 0) { const pals = [['#1a1a1a', '#3a3d55'], ['#c8331f', '#2b2b2b'], ['#e8d9a8', '#6b4f3a'], ['#2a4d7a', '#d9d6cf']]; for (let i = 0; i < 3; i++) { const p = pals[Math.floor(R() * 4)]; manq(g, 24 + i * 40, 116, p[0], p[1]); } }
      else if (th === 1) { for (let r = 0; r < 4; r++) { F(g, '#c9ccd1', 6, 28 + r * 22, 116, 2); for (let c = 0; c < 6; c++) F(g, ['#1a1a1a', '#6b3a2a', '#c8331f', '#e8e4dc', '#2a4d7a'][Math.floor(R() * 5)], 10 + c * 19, 20 + r * 22, 12, 8); } }
      else if (th === 2) { for (let i = 0; i < 4; i++) { F(g, '#3a1f2a', 8 + i * 30, 60, 24, 40); for (let k = 0; k < 4; k++) O(g, ['#f2d27e', '#e8e6e0', '#c9ccd1'][k % 3], 14 + i * 30 + (k % 2) * 10, 72 + Math.floor(k / 2) * 12, 2.5); } for (let i = 0; i < 9; i++) O(g, 'rgba(255,255,255,.8)', R() * 128, R() * 50, 1); }
      else if (th === 3) { for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++) { const x = 10 + c * 23, y = 16 + r * 18; g.strokeStyle = ['#1a1a1a', '#6b3a2a', '#c8331f', '#2a4d7a'][(r + c) % 4]; g.lineWidth = 2; g.strokeRect(x, y, 7, 5); g.strokeRect(x + 10, y, 7, 5); } }
      else if (th === 4) { for (let r = 0; r < 3; r++) { F(g, '#8a7a66', 6, 44 + r * 28, 116, 2); for (let c = 0; c < 4; c++) { const col = ['#6b3a2a', '#1a1a1a', '#c9a07a', '#8a1f2a', '#2a4d7a'][Math.floor(R() * 5)]; F(g, col, 12 + c * 29, 28 + r * 28, 20, 16); g.strokeStyle = col; g.lineWidth = 2; g.beginPath(); g.arc(22 + c * 29, 28 + r * 28, 6, Math.PI, 0); g.stroke(); } } }
      else shelves(g, R, 6, 122, 10, 108, 4, ['#c8331f', '#f2c230', '#1d6fb8', '#2a9a4a', '#e5007e', '#ff7a1e'], '#e8e4dc');
    },
    farmacia(g, th, R) {
      room(g, ['#f4f4f2', '#eef4ee', '#f2efe6', '#f4f4f2', '#eef2f6', '#f2efe6'][th], '#d9d6cf', 1.1);
      shelves(g, R, 6, 122, 8, 84, 4, ['#ffffff', '#1d6fb8', '#1d8f4e', '#e8e6e0', '#c8331f', '#f2c230'], '#c9ccd1'); counter(g, 96, ['#1d8f4e', '#e8e6e0', '#6b4f3a', '#3a3d40', '#1d8f4e', '#8a6a4a'][th], '#f2efe6');
      F(g, 'rgba(255,255,255,.85)', 44, 30, 40, 40); cross(g, 64, 50, 30, '#1d8f4e');
    },
    banca(g, th, R) {
      room(g, '#e8e6e0', '#b9b0a2'); F(g, '#6b4f3a', 20, 88, 60, 20); F(g, '#2a2d33', 34, 74, 20, 14); plant(g, 104, 110);
      frost(g, 26, 70); F(g, ['#183a6b', '#00843d', '#e2001a', '#0a2f5a', '#1d4f9a', '#00835b'][th], 0, 44, 128, 6);
    },
    ufficio(g, th, R) {
      room(g, ['#f4f4f2', '#e8f0fb', '#eceae4', '#f2efe6', '#f4f4f2', '#eef2f6'][th], '#a9a398');
      if (th === 0) { for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) { const x = 6 + c * 41, y = 8 + r * 38; F(g, '#ffffff', x, y, 36, 34); F(g, ['#9ab8d0', '#c9b79c', '#9ac46a', '#d0a080'][(r + c) % 4], x + 3, y + 3, 30, 16); for (let k = 0; k < 3; k++) F(g, '#5a5a5a', x + 3, y + 22 + k * 4, 22 + (k % 2) * 6, 2); } }
      else if (th === 1) { F(g, '#5ab4e6', 6, 8, 116, 70); F(g, '#1d7ab8', 6, 54, 116, 24); F(g, '#f2e2b0', 6, 70, 116, 8); F(g, '#3a2a1a', 96, 22, 3, 40); for (let i = 0; i < 4; i++) O(g, '#2a7a3a', 92 + i * 4, 22, 6); poster(g, 18, 14, 60, 18, 'rgba(0,0,0,0)', '#ffffff', 'VACANZE', 14); }
      else if (th === 2 || th === 3) { F(g, '#d9d6cf', 10, 84, 108, 6); for (const x of [18, 76]) { F(g, '#1d1d1f', x, 64, 30, 20); F(g, '#5ab4e6', x + 2, 66, 26, 15); } chair(g, 50, 116, '#2a2d33'); if (th === 3) frost(g, 30, 70); }
      else if (th === 4) { poster(g, 14, 10, 100, 64, '#003a70', '#ffffff', 'PROTEGGI', 15); g.strokeStyle = '#ffffff'; g.lineWidth = 3; g.beginPath(); g.arc(64, 64, 16, Math.PI, 0); g.stroke(); F(g, '#fff', 63, 64, 2, 8); }
      else { poster(g, 10, 10, 108, 30, '#1d4f9a', '#ffffff', 'PATENTI A B C', 13); car(g, 30, 96, 68, '#c8331f'); }
    },
    medico(g, th, R) {
      room(g, ['#eef4f6', '#f4f4f2', '#f2efe6', '#eef4ee', '#f4f4f2', '#f6f2ea'][th], '#c9c6bd', 1.1);
      for (const x of [16, 40, 64]) { F(g, '#1d6fb8', x, 92, 18, 4); F(g, '#1d6fb8', x, 80, 3, 14); } plant(g, 108, 112);
      frost(g, 22, 72, 0.82); const col = ['#1d6fb8', '#2a8f8a', '#2a7a3a', '#1d6fb8', '#8c6bb1', '#2a8f8a'][th];
      if (th === 1) { g.fillStyle = col; g.beginPath(); g.moveTo(52, 34); g.quadraticCurveTo(64, 28, 76, 34); g.lineTo(72, 62); g.lineTo(66, 50); g.lineTo(62, 50); g.lineTo(56, 62); g.fill(); }
      else if (th === 2) { O(g, col, 64, 52, 8); for (const [dx, dy] of [[-10, -9], [-4, -14], [4, -14], [10, -9]]) O(g, col, 64 + dx, 52 + dy, 3.5); }
      else if (th === 4) { for (let i = 0; i < 3; i++) { F(g, col, 46 + i * 14, 34, 6, 18); O(g, col, 49 + i * 14, 56, 6); } }
      else cross(g, 64, 47, 26, col);
    },
    tabacchi(g, th, R) {
      room(g, ['#e8e4dc', '#f2efe6', '#efe6d8', '#f4f4f2', '#e8e4dc', '#1d1b1f'][th], '#b9b0a2');
      if (th === 1) { for (let r = 0; r < 4; r++) for (let c = 0; c < 5; c++) { F(g, '#f2f0ea', 6 + c * 24, 10 + r * 28, 20, 24); F(g, '#1a1a1a', 8 + c * 24, 13 + r * 28, 16, 3); F(g, ['#c8102e', '#9ab8d0', '#c9b79c'][(r + c) % 3], 8 + c * 24, 19 + r * 28, 16, 9); } return; }
      if (th === 2) { shelves(g, R, 4, 124, 6, 112, 5, ['#8a1f1f', '#1d3a6b', '#2a5a3a', '#e8d9a8', '#3a2a1a', '#c9a85a', '#f2efe6'], '#6b4f3a'); return; }
      if (th === 3) { shelves(g, R, 4, 124, 6, 100, 4, ['#e5007e', '#f2c230', '#1d6fb8', '#2a9a4a', '#ff7a1e', '#8c6bb1'], '#d9d6cf'); return; }
      if (th === 5) { shelves(g, R, 4, 124, 20, 90, 3, ['#5ab4e6', '#e5007e', '#9ac46a', '#c9ccd1'], '#2a2a2a'); poster(g, 20, 4, 88, 14, '#1d1b1f', '#5ab4e6', 'VAPE', 11); return; }
      shelves(g, R, 6, 122, 30, 90, 4, ['#f2efe6', '#c8102e', '#1a1a1a', '#c9a85a', '#1d3a8a', '#e8e4dc'], '#6b4f3a'); counter(g, 100, '#5a4636');
      poster(g, 10, 6, 50, 18, '#2a7a3a', '#fff', 'LOTTO', 11); poster(g, 68, 6, 50, 18, '#f2c230', '#c8102e', 'GRATTA', 10);
    },
    bottega(g, th, R) {
      room(g, ['#eef2e6', '#e8e4dc', '#f4f4f2', '#eef4f6', '#ffffff', '#efe9dd'][th], '#b9b0a2');
      if (th === 0) { for (let i = 0; i < 18; i++) { const x = 8 + (i % 6) * 20, y = 60 + Math.floor(i / 6) * 20; F(g, '#9aa0a6', x - 6, y + 2, 12, 12); for (let k = 0; k < 4; k++) O(g, ['#c8331f', '#f2c230', '#f4a6b8', '#ffffff', '#8c6bb1', '#ff7a1e'][(i + k) % 6], x - 4 + (k % 2) * 8, y - 2 - Math.floor(k / 2) * 6, 4); for (let k = 0; k < 3; k++) O(g, '#3d6a2a', x - 6 + k * 6, y - 10, 3); } shelves(g, R, 6, 122, 6, 40, 2, ['#3d6a2a', '#4f7a35', '#c8331f'], '#8a7a66'); }
      else if (th === 1) { F(g, '#c9b79c', 4, 8, 120, 80); for (let i = 0; i < 40; i++) O(g, '#8a7a66', 10 + (i % 10) * 12, 14 + Math.floor(i / 10) * 18, 1); for (let i = 0; i < 14; i++) F(g, ['#c8331f', '#1a1a1a', '#e8b520', '#1d4f9a', '#8f949a'][i % 5], 12 + (i % 7) * 16, 18 + Math.floor(i / 7) * 36, 4, 22); counter(g, 100, '#6b4f3a'); }
      else if (th === 2) { for (const x of [30, 90]) { g.strokeStyle = '#1a1a1a'; g.lineWidth = 3; g.beginPath(); g.arc(x - 16, 100, 12, 0, TAU); g.arc(x + 16, 100, 12, 0, TAU); g.stroke(); g.strokeStyle = ['#c8331f', '#1d4f9a'][x > 50 ? 1 : 0]; g.beginPath(); g.moveTo(x - 16, 100); g.lineTo(x - 4, 80); g.lineTo(x + 12, 80); g.lineTo(x + 16, 100); g.lineTo(x - 2, 100); g.lineTo(x - 4, 80); g.stroke(); } shelves(g, R, 6, 122, 6, 50, 2, ['#1a1a1a', '#c8331f', '#f2c230', '#c9ccd1'], '#c9ccd1'); }
      else if (th === 3) { for (let i = 0; i < 4; i++) { F(g, '#f2f2f0', 4 + i * 31, 52, 28, 46); O(g, '#9aa0a6', 18 + i * 31, 76, 10); O(g, '#bcd8ea', 18 + i * 31, 76, 7); } F(g, '#5a5c5e', 0, 98, 128, 30); }
      else if (th === 4) { for (let r = 0; r < 3; r++) for (let c = 0; c < 6; c++) { F(g, '#1d1d1f', 8 + c * 20, 18 + r * 30, 12, 22); F(g, ['#5ab4e6', '#e5007e', '#9ac46a', '#f2c230'][(r + c) % 4], 9 + c * 20, 20 + r * 30, 10, 17); } counter(g, 106, '#ffffff', '#e8e6e0'); }
      else { shelves(g, R, 4, 124, 6, 100, 4, ['#c8331f', '#f2c230', '#1d4f9a', '#2a7a3a', '#f2efe6', '#8a6a4a'], '#8a7a66'); counter(g, 106, '#8a6a4a'); }
    },
    artigiano(g, th, R) {
      room(g, ['#5a5045', '#4a4d52', '#6b5a45', '#55575b', '#4d4a45', '#5a5c5e'][th], '#6b6862', 0.6);
      for (let i = 0; i < 10; i++) F(g, ['#c9a070', '#b08a5a', '#d9b88a'][i % 3], 4 + i * 6, 10, 4, 70); F(g, '#8a6a4a', 64, 76, 60, 6); F(g, '#5a4636', 70, 82, 4, 26); F(g, '#5a4636', 114, 82, 4, 26);
      F(g, '#2a2c2e', 70, 20, 50, 30); for (let i = 0; i < 8; i++) F(g, ['#c8102e', '#8f949a', '#e8b520'][i % 3], 74 + (i % 4) * 12, 24 + Math.floor(i / 4) * 13, 3, 10);
    },
    sfitto(g, th, R) {
      if (th === 1) { F(g, '#e8e4dc', 0, 0, 128, 128); for (let i = 0; i < 16; i++) { F(g, '#f6f4ee', (i % 4) * 32, Math.floor(i / 4) * 32, 31, 31); for (let k = 0; k < 6; k++) F(g, '#9a958b', (i % 4) * 32 + 3, Math.floor(i / 4) * 32 + 4 + k * 4, 24, 1.5); } }
      else if (th === 2 || th === 4) { room(g, '#8a857c', '#6b6862', 0.25); F(g, 'rgba(0,0,0,.35)', 0, 0, 128, 128); }
      else { F(g, '#dcd8d0', 0, 0, 128, 128); for (let i = 0; i < 40; i++) { g.strokeStyle = `rgba(255,255,255,${0.3 + R() * 0.4})`; g.lineWidth = 4 + R() * 6; g.beginPath(); const x = R() * 128, y = R() * 128; g.moveTo(x, y); g.quadraticCurveTo(x + 20, y - 15, x + 40, y + 5); g.stroke(); } }
      if (th !== 5) poster(g, 24, 38, 80, 36, '#f2c230', '#c8102e', th === 2 ? 'VENDESI' : th === 3 ? 'CEDESI' : 'AFFITTASI', 13);
    },
  };
  // what stands in the room, 1.4 m in, on a clear ground: the floor of the room is the bottom of the cell
  const MID = [
    g => { /* bar: the counter, the coffee machine, the taps, stools */ F(g, '#5a3a22', 0, 80, 128, 48); F(g, '#3a2414', 0, 80, 128, 3); F(g, '#e8e4dc', 0, 76, 128, 5); for (let x = 8; x < 128; x += 16) F(g, '#4a2e1a', x, 88, 2, 38);
      F(g, '#c9ccd1', 14, 54, 30, 22); F(g, '#8f949a', 18, 58, 22, 8); F(g, '#1d1d1f', 22, 68, 3, 8); F(g, '#1d1d1f', 33, 68, 3, 8); for (const x of [66, 76, 86]) { F(g, '#c9a85a', x, 60, 3, 16); O(g, '#f2efe6', x + 1.5, 59, 2.5); }
      for (const x of [12, 46, 82, 114]) { O(g, '#2b2b2b', x, 102, 7); F(g, '#55575b', x - 1, 102, 3, 24); F(g, '#55575b', x - 6, 124, 13, 3); } },
    g => { /* restaurant: laid tables and chairs */ for (const x of [8, 72]) { F(g, '#ffffff', x, 92, 48, 6); F(g, '#e8e4dc', x + 2, 98, 44, 10); F(g, '#3a2e26', x + 4, 98, 3, 30); F(g, '#3a2e26', x + 41, 98, 3, 30); O(g, '#f2efe6', x + 16, 90, 3); O(g, '#f2efe6', x + 32, 90, 3); F(g, '#7a1f1a', x + 23, 82, 2, 8);
      for (const cx of [x - 4, x + 46]) { F(g, '#4a3a2e', cx, 78, 4, 50); F(g, '#4a3a2e', cx - 2, 104, 10, 3); } } },
    g => { /* pharmacy: the counter with its green front and a display stand */ F(g, '#f2efe6', 6, 84, 116, 44); F(g, '#1d8f4e', 6, 92, 116, 30); F(g, '#d9d6cf', 4, 80, 120, 5); F(g, '#1d1d1f', 30, 66, 18, 14); F(g, '#5ab4e6', 32, 68, 14, 9);
      F(g, '#ffffff', 84, 60, 26, 20); F(g, '#1d8f4e', 95, 63, 4, 14); F(g, '#1d8f4e', 90, 68, 14, 4); },
    g => { /* bank: the tellers behind glass */ F(g, '#d9d0bc', 0, 86, 128, 42); F(g, '#8a6a4a', 0, 82, 128, 5); F(g, 'rgba(190,215,225,0.85)', 0, 40, 128, 42); for (let x = 0; x <= 128; x += 32) F(g, '#8f949a', x - 1, 40, 3, 46);
      for (const x of [14, 46, 78, 110]) { F(g, '#1d1d1f', x - 6, 66, 14, 12); F(g, '#5ab4e6', x - 5, 67, 12, 9); } },
    g => { /* food: the chilled counter */ F(g, '#e8e6e0', 0, 92, 128, 36); F(g, '#c9ccd1', 0, 88, 128, 5); F(g, 'rgba(210,235,245,0.9)', 0, 66, 128, 22); F(g, '#8f949a', 0, 64, 128, 3);
      for (let i = 0; i < 9; i++) F(g, ['#b8323a', '#e8c070', '#f2d8c8', '#9ac46a', '#d06a6a', '#f6efd8'][i % 6], 4 + i * 14, 76, 11, 10); },
    g => { /* clothes: mannequins and a rail */ const manq = (x, c, c2) => { O(g, '#e9dccb', x, 38, 6); F(g, c, x - 10, 45, 20, 30); F(g, c2, x - 9, 75, 8, 34); F(g, c2, x + 1, 75, 8, 34); F(g, '#555', x - 1, 109, 2, 14); F(g, '#555', x - 9, 123, 18, 3); };
      manq(22, '#1a1a1a', '#3a3d55'); manq(104, '#c8331f', '#2b2b2b'); F(g, '#8f949a', 40, 50, 46, 3); F(g, '#8f949a', 41, 50, 2, 76); F(g, '#8f949a', 83, 50, 2, 76);
      for (let i = 0; i < 9; i++) F(g, ['#2a4d7a', '#e8d9a8', '#6b3a2a', '#1a1a1a', '#c8331f'][i % 5], 43 + i * 4.6, 53, 4, 30 + (i % 3) * 6); },
    g => { /* office: desks with screens, chairs */ for (const x of [6, 70]) { F(g, '#d9d6cf', x, 86, 52, 5); F(g, '#8f949a', x + 3, 91, 3, 37); F(g, '#8f949a', x + 46, 91, 3, 37); F(g, '#1d1d1f', x + 14, 66, 24, 18); F(g, '#5ab4e6', x + 16, 68, 20, 13); F(g, '#1d1d1f', x + 24, 84, 4, 3);
      F(g, '#2a2d33', x + 18, 92, 16, 14); F(g, '#2a2d33', x + 20, 76, 12, 18); F(g, '#55575b', x + 25, 106, 2, 18); } },
    g => { /* a shop: a low table with goods, a stand */ F(g, '#8a6a4a', 20, 96, 88, 5); F(g, '#6b4f3a', 24, 101, 4, 27); F(g, '#6b4f3a', 100, 101, 4, 27); for (let i = 0; i < 8; i++) F(g, ['#c8331f', '#f2c230', '#1d4f9a', '#2a7a3a', '#f2efe6'][i % 5], 24 + i * 10, 86 + (i % 2) * 3, 8, 10 - (i % 2) * 3);
      F(g, '#c9ccd1', 110, 50, 3, 78); for (let r = 0; r < 4; r++) { F(g, '#c9ccd1', 104, 56 + r * 18, 16, 2); F(g, ['#e5007e', '#1d6fb8', '#f2c230', '#2a9a4a'][r], 106, 48 + r * 18, 12, 8); } },
  ];
  // one atlas: 16 x 8 cells of 128 px. The back walls, as they were, without the glass drawn over (the glass now mirrors for real)
  const cv = document.createElement('canvas'); cv.width = 2048; cv.height = 1024; const g = cv.getContext('2d'), col = [];
  NG_CLASSES.forEach((cls, c) => {
    for (let th = 0; th < 6; th++) {
      const i = c * 6 + th; let s = 1 + th * 7919 + cls.length * 104729; const R = () => (s = (s * 16807) % 2147483647) / 2147483647; lastRoom = null;
      g.save(); g.translate((i % 16) * 128, Math.floor(i / 16) * 128); g.beginPath(); g.rect(0, 0, 128, 128); g.clip(); D[cls](g, th, R); g.restore();
      const rc = lastRoom || ['#dcd8d0', '#9a958b']; col[i] = [new THREE.Color(rc[0]), new THREE.Color(rc[1])];
    }
  });
  MID.forEach((f, k) => { const i = 114 + k; g.save(); g.translate((i % 16) * 128, Math.floor(i / 16) * 128); g.beginPath(); g.rect(0, 0, 128, 128); g.clip(); f(g); g.restore(); });
  const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = ngLodMat(new THREE.MeshLambertMaterial({ map: tex, color: 0x0e1215 }), 'glass', 0.35, s => {
    s.uniforms.uNgLamps = NG_U.lamps;
    s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec4 ngR;\nattribute vec4 ngW;\nattribute vec3 ngF;\nattribute float ngOn;\nvarying vec3 vNgV;\nvarying vec4 vNgR;\nvarying vec4 vNgW;\nvarying vec3 vNgF;\nvarying float vNgOn;')
      .replace('#include <project_vertex>', '#include <project_vertex>\n  { vec4 ngWp = modelMatrix * vec4(transformed, 1.0); vec3 ngN = normalize(vec3(ngC.z, 0.0, ngC.w) + vec3(1e-6, 0.0, 0.0)), ngT = vec3(ngN.z, 0.0, -ngN.x), ngVv = ngWp.xyz - uNgCam;\n    vNgV = vec3(dot(ngVv, ngT), ngVv.y, -dot(ngVv, ngN)); vNgR = ngR; vNgW = ngW; vNgF = ngF; vNgOn = ngOn; }');
    s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNgLamps;\nvarying vec3 vNgV;\nvarying vec4 vNgR;\nvarying vec4 vNgW;\nvarying vec3 vNgF;\nvarying float vNgOn;')
      .replace('void main() {', NG_ROOM_GLSL + '\nvoid main() {')
      .replace('#include <map_fragment>', 'vec3 ngIn = ngRoom();\n  float ngCos = clamp(normalize(vNgV).z, 0.0, 1.0);\n  float ngLev = mix(mix(0.12, 0.42, vNgOn), mix(0.01, 1.0, vNgOn), uNgLamps) * (0.3 + 0.7 * ngCos);')
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance += ngIn * ngLev;');
  });
  return { tex, mat: { all: mat }, col, ci: (cls, th) => NG_CLASSES.indexOf(cls) * 6 + th };
})();
// lit bits: the pharmacy's green cross, wall lamps, the cash machine's screen
const NG_NEON = { green: ngLodMat(new THREE.MeshLambertMaterial({ color: 0x1d8f4e, emissive: 0x2bff7a, emissiveIntensity: 0.5 }), 'n-green'), warm: ngLodMat(new THREE.MeshLambertMaterial({ color: 0xf4e6c8, emissive: 0xffd28a, emissiveIntensity: 0.05 }), 'n-warm'),
  screen: ngLodMat(new THREE.MeshLambertMaterial({ color: 0x1b2a33, emissive: 0x6fb6ff, emissiveIntensity: 0.35 }), 'n-screen') };
LM_GLOW.push({ m: NG_NEON.green, a: 0.45, b: 0.8 }, { m: NG_NEON.warm, a: 0.05, b: 0.95 }, { m: NG_NEON.screen, a: 0.35, b: 0.3 });
// the frames, sills, doors, signs' bodies, awnings (vertex colours); the plug that keeps the wall off the opening; the shutters; the light on the pavement at night
const NG_SOLID = ngLodMat(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'solid', 0.35);
const NG_PLUG = ngLodMat(new THREE.MeshBasicMaterial({ colorWrite: false }), 'plug');
const NG_POOL = ngLodMat(new THREE.MeshBasicMaterial({ color: 0xffc98a, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
  map: canvasTex(64, 64, (g, w, h) => { /* brightest at the wall, fading out over the pavement and softly at the two ends */ const im = g.createImageData(w, h), sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const u = (x + 0.5) / w, v = (y + 0.5) / h, k = Math.pow(1 - v, 1.7) * sm(0, 0.2, u) * sm(0, 0.2, 1 - u), i = (y * w + x) * 4; im.data[i] = im.data[i + 1] = im.data[i + 2] = Math.round(255 * k); im.data[i + 3] = 255; } g.putImageData(im, 0, 0); }, false) }), 'pool', 0, s => {
  s.uniforms.uNgLamps = NG_U.lamps;
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute float ngOn;\nvarying float vNgOn;').replace('#include <project_vertex>', '#include <project_vertex>\n  vNgOn = ngOn;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uNgLamps;\nvarying float vNgOn;').replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= vNgOn * uNgLamps * 0.55;');
});
/* the signs of a tile: their own texture; dim (the back layers of the letters standing off the wall) and how much each part glows at night, when the shop is open */
const ngSignMat = mat => ngLodMat(mat, 'sign', 0, s => {
  s.vertexShader = s.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 ngS;\nattribute float ngOn;\nvarying vec2 vNgS;\nvarying float vNgOn;').replace('#include <project_vertex>', '#include <project_vertex>\n  vNgS = ngS; vNgOn = ngOn;');
  s.fragmentShader = s.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec2 vNgS;\nvarying float vNgOn;').replace('#include <map_fragment>', '#include <map_fragment>\n  diffuseColor.rgb *= vNgS.x;')
    .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n  totalEmissiveRadiance *= vNgS.x * vNgS.y * mix(0.08, 1.0, vNgOn);');
});

// ---- things on the pavement: one geometry per kind (and colour), modelled facing +z (the street), foot at the origin
const NG_PSPEC = { vas: { r: 0.3, h: 1 }, lav: { r: 0.3, h: 1 }, cas: { r: 0.65, h: 1, w: 1.3 }, sec: { r: 0.5, h: 0.9, w: 1.1 }, gio: { r: 0.4, h: 1.4, w: 0.9 }, pne: { r: 0.4, h: 0.9 }, bid: { r: 0.32, h: 0.9 },
  bic: { r: 0.45, h: 1, w: 1.7 }, bnc: { r: 0.65, h: 0.7, w: 1.3 }, pol: { r: 0.5, h: 0.9, w: 1 }, con: { r: 0.3, h: 1.7 }, tav: { r: 0.6, h: 1, w: 1.5 }, omb: { r: 0.25, h: 2.5, w: 2.6 },
  fio: { r: 0.55, h: 1, w: 1.1 }, car: { r: 0.9, h: 1.1, w: 2.4 }, bdr: { r: 0.15, h: 6, w: 1 }, pan: { r: 0.8, h: 0.9, w: 1.9 } };
const NG_PGEO = {};
function ngPropGeo(key) {
  if (NG_PGEO[key]) return NG_PGEO[key];
  const [k, c0] = key.split(':'), b = Buf(), F = lmFrame(new THREE.Matrix4()), up = new THREE.Vector3(0, 1, 0);
  const box = (w, h, d, x, y, z, col, rx = 0, ry = 0) => { const g = new THREE.BoxGeometry(w, h, d); if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); F.geo(b, g.translate(x, y, z), null, COL(col)); };
  const cyl = (rt, rb, h, x, y, z, col, seg = 10) => F.geo(b, new THREE.CylinderGeometry(rt, rb, h, seg).translate(x, y, z), null, COL(col));
  const ball = (r, x, y, z, col) => F.geo(b, new THREE.IcosahedronGeometry(r, 0).translate(x, y, z), null, COL(col));
  const ring = (R, r, x, y, z, col, flat = true) => { const g = new THREE.TorusGeometry(R, r, 6, 14); if (flat) g.rotateX(Math.PI / 2); else g.rotateY(Math.PI / 2); F.geo(b, g.translate(x, y, z), null, COL(col)); };
  const rod = (a, c, r, col) => { const v = new THREE.Vector3(c[0] - a[0], c[1] - a[1], c[2] - a[2]), L = v.length(); const g = new THREE.CylinderGeometry(r, r, L, 5).translate(0, L / 2, 0); g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(up, v.normalize()))); F.geo(b, g.translate(a[0], a[1], a[2]), null, COL(col)); };
  const M = {
    vas() { cyl(0.24, 0.18, 0.45, 0, 0.225, 0, '#b5653a'); ball(0.36, 0, 0.78, 0, '#3d6a2a'); ball(0.24, 0.12, 1.0, 0.05, '#4f7a35'); },
    lav() { box(0.55, 0.85, 0.03, 0, 0.42, 0.12, '#24302a', -0.22); box(0.55, 0.85, 0.03, 0, 0.42, -0.12, '#24302a', 0.22); box(0.6, 0.05, 0.05, 0, 0.83, 0, '#7a5a3c'); box(0.4, 0.05, 0.01, 0, 0.6, 0.215, '#f2efe6', -0.22); box(0.32, 0.04, 0.01, 0, 0.48, 0.24, '#f2efe6', -0.22); },
    cas() { box(1.3, 0.06, 0.7, 0, 0.72, 0, '#8a6a4a', -0.25); for (const [x, y] of [[-0.6, 0.35], [0.6, 0.35]]) box(0.05, 0.7, 0.6, x, y, 0, '#5a4636'); for (let i = 0; i < 3; i++) { const fc = ['#c8331f', '#f2a020', '#9ac46a', '#f6e27a', '#6b2a6a'][(i * 2 + (c0 ? 1 : 0)) % 5]; box(0.38, 0.16, 0.5, -0.42 + i * 0.42, 0.85, 0, '#b08a5a', -0.25); for (let k = 0; k < 4; k++) ball(0.07, -0.5 + i * 0.42 + (k % 2) * 0.16, 0.96 - Math.floor(k / 2) * 0.05, -0.08 + Math.floor(k / 2) * 0.18, fc); } },
    sec() { for (let i = 0; i < 3; i++) { const x = -0.38 + i * 0.38; cyl(0.15, 0.12, 0.35, x, 0.17, 0, '#9aa0a6'); for (let k = 0; k < 3; k++) ball(0.1, x + (k - 1) * 0.07, 0.48 + (k % 2) * 0.08, (k % 2) * 0.05, ['#c8331f', '#f2c230', '#f4a6b8', '#ffffff', '#8c6bb1'][(i + k) % 5]); ball(0.12, x, 0.42, -0.05, '#3d6a2a'); } },
    gio() { box(0.85, 1.3, 0.05, 0, 0.75, -0.1, '#3a3d40'); for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) box(0.24, 0.32, 0.02, -0.27 + c * 0.27, 0.35 + r * 0.38, -0.06, ['#f2f0ea', '#c8102e', '#f2f0ea', '#9ab8d0'][(r + c) % 4]); for (const x of [-0.4, 0.4]) box(0.04, 1.4, 0.3, x, 0.7, -0.05, '#3a3d40'); },
    pne() { for (let i = 0; i < 4; i++) ring(0.27, 0.11, 0, 0.11 + i * 0.21, 0, '#1d1d1f'); },
    bid() { cyl(0.29, 0.29, 0.88, 0, 0.44, 0, c0 || '#1d4f9a', 12); for (const y of [0.3, 0.6]) cyl(0.3, 0.3, 0.03, 0, y, 0, '#2b2f33', 12); },
    bic() { for (const x of [-0.52, 0.52]) ring(0.33, 0.025, x, 0.34, 0, '#1a1a1a', false); const C = c0 || '#c8331f'; rod([-0.52, 0.34, 0], [-0.05, 0.36, 0], 0.025, C); rod([-0.05, 0.36, 0], [0.38, 0.7, 0], 0.025, C); rod([-0.52, 0.34, 0], [-0.3, 0.72, 0], 0.025, C); rod([-0.3, 0.72, 0], [0.38, 0.7, 0], 0.025, C); rod([-0.05, 0.36, 0], [-0.3, 0.72, 0], 0.025, C); rod([0.52, 0.34, 0], [0.42, 0.85, 0], 0.025, C); box(0.04, 0.03, 0.45, 0.42, 0.87, 0, '#1a1a1a'); box(0.22, 0.05, 0.1, -0.32, 0.76, 0, '#1a1a1a'); },
    bnc() { for (let i = 0; i < 4; i++) { const y = 0.07 + i * 0.15; box(1.2, 0.025, 0.8, 0, y + 0.06, 0, '#c9a070'); for (const z of [-0.35, 0, 0.35]) box(1.2, 0.09, 0.1, 0, y, z, '#b08a5a'); } },
    pol() { const C = c0 || '#6b4f3a'; box(0.8, 0.22, 0.7, 0, 0.32, 0, C); box(0.8, 0.5, 0.15, 0, 0.62, -0.28, C); for (const x of [-0.36, 0.36]) box(0.12, 0.3, 0.7, x, 0.55, 0, C); for (const [x, z] of [[-0.35, -0.3], [0.35, -0.3], [-0.35, 0.3], [0.35, 0.3]]) box(0.05, 0.2, 0.05, x, 0.1, z, '#2a2420'); },
    con() { cyl(0.04, 0.04, 0.8, 0, 0.4, 0, '#8f949a', 6); F.geo(b, new THREE.ConeGeometry(0.22, 0.6, 10).rotateX(Math.PI).translate(0, 1.1, 0), null, COL('#d9a050')); ball(0.24, 0, 1.45, 0, '#f4a6b8'); ball(0.16, 0.05, 1.63, 0, '#9ac46a'); },
    tav() { const C = c0 === 'w' ? '#7a5a3c' : '#2b2f33'; cyl(0.35, 0.35, 0.04, 0, 0.74, 0, c0 === 'w' ? '#a08060' : '#d9d6cf', 14); cyl(0.03, 0.03, 0.72, 0, 0.37, 0, C, 6); cyl(0.22, 0.24, 0.03, 0, 0.015, 0, C, 10);
      for (const s of [-1, 1]) { const x = s * 0.6; box(0.4, 0.04, 0.4, x, 0.45, 0, C); box(0.04, 0.42, 0.4, x + s * 0.2, 0.68, 0, C); for (const [dx, dz] of [[-0.17, -0.17], [0.17, -0.17], [-0.17, 0.17], [0.17, 0.17]]) box(0.03, 0.45, 0.03, x + dx, 0.22, dz, C); } },
    omb() { cyl(0.025, 0.025, 2.4, 0, 1.2, 0, '#d9d6cf', 6); cyl(0.25, 0.28, 0.1, 0, 0.05, 0, '#55575b', 10); F.geo(b, new THREE.ConeGeometry(1.35, 0.42, 8).translate(0, 2.3, 0), null, COL(c0 || '#f2efe6')); F.geo(b, new THREE.CylinderGeometry(1.35, 1.35, 0.14, 8, 1, true).translate(0, 2.03, 0), null, COL(c0 || '#f2efe6')); },
    fio() { box(1.0, 0.42, 0.45, 0, 0.21, 0, '#8a857c'); box(0.95, 0.42, 0.4, 0, 0.6, 0, '#3d6a2a'); },
    car() { box(2.3, 0.05, 1.1, 0, 0.025, 0, '#8f949a'); for (const x of [-1.15, 1.15]) box(0.04, 1.0, 1.1, x, 0.5, 0, '#8f949a'); box(2.34, 0.05, 0.05, 0, 1.0, -0.55, '#c8102e'); box(2.34, 0.05, 0.05, 0, 1.0, 0.55, '#c8102e');
      for (let i = 0; i < 5; i++) { const x = -0.85 + i * 0.36; box(0.5, 0.45, 0.9, x, 0.62, 0, '#c9ccd1'); box(0.04, 0.5, 0.04, x + 0.24, 0.3, 0.42, '#8f949a'); box(0.48, 0.03, 0.04, x, 0.95, 0.47, '#1d4f9a'); } },
    bdr() { cyl(0.05, 0.06, 6, 0, 3, 0, '#e8e6e0', 6); box(0.03, 2.4, 0.75, 0, 4.6, 0.42, c0 || '#c8102e'); box(0.03, 0.03, 0.8, 0, 5.8, 0.4, '#8f949a'); },
    pan() { box(1.8, 0.07, 0.42, 0, 0.45, 0, '#7a5a3c'); box(1.8, 0.36, 0.06, 0, 0.78, -0.2, '#7a5a3c'); for (const x of [-0.75, 0.75]) { box(0.07, 0.45, 0.45, x, 0.22, 0, '#2e3236'); box(0.07, 0.5, 0.06, x, 0.75, -0.21, '#2e3236'); } },
  };
  M[k](); const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(b.p, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(b.n, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(b.c, 3)); g.setIndex(b.i);
  g.computeBoundingSphere(); return (NG_PGEO[key] = g);
}

// ---- where each front goes: the wall of the building the shop is in (or the nearest one) that looks onto a street; shops sharing a wall split it
function ngRoad(x, z, m) { let f = false; ROADSEG.each(x - 12, z - 12, x + 12, z + 12, s => { if (!f && atGrade(s) && s.r.c <= 5 && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + m) f = true; }); return f; }
// how far in front of a wall the first real street is (not a service road or a driveway), up to 26 m: a shop set back behind its front
// garden opens onto the street, not onto the yard behind (Billy's in via Vespucci faced its back lane)
// returns how far it is, the road's class and whether it is the street of the shop's address (Mikka, via Indipendenza 174, faced a side street)
function ngStreetAhead(mx, mz, nx, nz, street) {
  for (let t = 2; t <= 26; t += 2) { const x = mx + nx * t, z = mz + nz * t; let f = null; ROADSEG.each(x - 10, z - 10, x + 10, z + 10, s => { if (!s.r.d && s.r.c <= 3 && segDist(x, z, s.a[0], s.a[1], s.b[0], s.b[1]) < s.r.w / 2 + 0.5 && (!f || s.r.c < f.c)) f = { t, c: s.r.c, own: !!street && (D.names[s.r.n] || '').toLowerCase() === street }; }); if (f) return f; }
  return null;
}
// the walls of a DBGT volume as the street sees them: consecutive edges in a line (within 12 degrees, the vertices within 0.25 m of it) and on the
// same side of a party wall joined into one. The DBGT puts a vertex wherever the next building meets the facade: walls of 2-6 m, and 73 shops
// had no room for their front (Farmacia Centrale and Istanbul kebap on the same 6.4 m). A curved facade is one wall too: edges turning less than
// 12 degrees at a time, always the same way and less than 45 degrees in all. The run keeps its edges (es) and where each starts (cl): a point
// on the wall is found by the length along it (ngAt) and a front takes the direction of its own stretch (ngPlace)
function ngRuns(b) {
  if (b._runs) return b._runs;
  const P = b.pts, E = [], C12 = Math.cos(12 * Math.PI / 180), R12 = 12 * Math.PI / 180, R45 = 45 * Math.PI / 180;
  for (let i = 0; i < P.length; i++) {
    const a = P[i], c = P[(i + 1) % P.length], dx = c[0] - a[0], dz = c[1] - a[1], L = hyp(dx, dz); if (L < 0.05) continue;
    const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; let nx = dz / L, nz = -dx / L; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, P)) { nx = -nx; nz = -nz; }
    E.push({ a, c, L, ux: dx / L, uz: dz / L, nx, nz, party: inPoly(mx + nx * 0.3, mz + nz * 0.3, P) || inBuilding(mx + nx * 0.7, mz + nz * 0.7) });
  }
  if (!E.length) return (b._runs = []);
  const turn = (p, q) => Math.atan2(p.ux * q.uz - p.uz * q.ux, p.ux * q.ux + p.uz * q.uz);
  const straight = (r, e) => r.party === e.party && r.ux * e.ux + r.uz * e.uz > C12 && Math.abs((e.c[0] - r.a[0]) * r.nx + (e.c[1] - r.a[1]) * r.nz) < 0.25;
  const bends = (r, e) => { if (r.party !== e.party) return null; const last = r.es[r.es.length - 1], da = turn(last, e), tot = r.tot + da; if (Math.abs(da) >= R12 || Math.abs(tot) >= R45) return null; const sg = Math.abs(da) > 0.017 ? Math.sign(da) : 0; if (sg && r.sg && sg !== r.sg) return null; return { tot, sg: sg || r.sg }; };
  const one = e => ({ ...e, es: [e], tot: 0, sg: 0 });
  const joins = (r, e) => straight(r, e) || bends(r, e);
  let s = 0; for (let i = 0; i < E.length; i++) if (!joins(one(E[(i - 1 + E.length) % E.length]), E[i])) { s = i; break; }
  const runs = []; let cur = null;
  for (let k = 0; k < E.length; k++) {
    const e = E[(s + k) % E.length];
    let j = cur && (straight(cur, e) ? { tot: cur.tot + turn(cur.es[cur.es.length - 1], e), sg: cur.sg } : bends(cur, e));
    if (j) {
      cur.c = e.c; cur.es.push(e); cur.tot = j.tot; cur.sg = j.sg; const dx = cur.c[0] - cur.a[0], dz = cur.c[1] - cur.a[1], L = hyp(dx, dz) || 1e-6; let nx = dz / L, nz = -dx / L; if (nx * cur.nx + nz * cur.nz < 0) { nx = -nx; nz = -nz; }
      Object.assign(cur, { ux: dx / L, uz: dz / L, nx, nz });
    } else { if (cur) runs.push(cur); cur = one(E[(s + k) % E.length]); }
  }
  if (cur) runs.push(cur);
  for (const r of runs) { let acc = 0; r.cl = r.es.map(e => { const o = acc; acc += e.L; return o; }); r.L = acc; r.curved = Math.abs(r.tot) > 0.05 || r.es.some(e => Math.abs(turn(r.es[0], e)) > 0.05); delete r.tot; delete r.sg; }
  return (b._runs = runs);
}
/* a point on a wall by the length s along it, with the direction and the outward normal of the edge there */
function ngAt(W, s) {
  const es = W.es; if (!es) return { x: W.a[0] + W.ux * s, z: W.a[1] + W.uz * s, ux: W.ux, uz: W.uz, nx: W.nx, nz: W.nz };
  s = Math.max(0, Math.min(W.L, s)); let i = es.length - 1; while (i > 0 && W.cl[i] > s) i--;
  const e = es[i], t = Math.min(e.L, s - W.cl[i]); return { x: e.a[0] + e.ux * t, z: e.a[1] + e.uz * t, ux: e.ux, uz: e.uz, nx: e.nx, nz: e.nz };
}
/* how far a point is from a wall and where along it the nearest point is */
function ngProj(W, x, z) {
  if (!W.es) { const along = (x - W.a[0]) * W.ux + (z - W.a[1]) * W.uz; return { s: clamp(along, 0, W.L), d: segDist(x, z, W.a[0], W.a[1], W.c[0], W.c[1]) }; }
  let best = { s: 0, d: 1e9 };
  W.es.forEach((e, i) => { const d = segDist(x, z, e.a[0], e.a[1], e.c[0], e.c[1]); if (d < best.d) best = { s: W.cl[i] + clamp((x - e.a[0]) * e.ux + (z - e.a[1]) * e.uz, 0, e.L), d }; });
  return best;
}
/* puts a front of width w at length t along its wall: the centre and the direction of that stretch of the wall */
function ngPlace(r, t, w) {
  if (!r.es) { r.cx = r.a[0] + r.ux * t; r.cz = r.a[1] + r.uz * t; return; }
  if (!r.curved) { const q = ngAt(r, t); r.cx = q.x; r.cz = q.z; return; }
  const p0 = ngAt(r, t - w / 2), p1 = ngAt(r, t + w / 2), m = ngAt(r, t), dx = p1.x - p0.x, dz = p1.z - p0.z, L = hyp(dx, dz) || 1e-6; let nx = dz / L, nz = -dx / L; if (nx * m.nx + nz * m.nz < 0) { nx = -nx; nz = -nz; }
  r.ux = dx / L; r.uz = dz / L; r.nx = nx; r.nz = nz; r.cx = (p0.x + p1.x) / 2; r.cz = (p0.z + p1.z) / 2;
}
const ngKey = W => W.a[0].toFixed(1) + ',' + W.a[1].toFixed(1) + ',' + W.c[0].toFixed(1) + ',' + W.c[1].toFixed(1);
function ngWall(x, z, only, street, need = 0, use = null, skip = null, want = 0) {
  let host = only, best = null; const cands = []; street = (street || '').toLowerCase();
  if (!host) BLD.each(x, z, x, z, b => { if (!host && b.h >= 2.6 && inPoly(x, z, b.pts) && !b.holes.some(h => inPoly(x, z, h))) host = b; });
  const scan = b => {
    if (b.h < 2.6 || b.noSign) return; const pts = b.pts;
    const one = (a, c, L, nx, nz, ux, uz, run) => {
      let mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2, d = segDist(x, z, a[0], a[1], c[0], c[1]), Le = L;
      if (run) { /* a DBGT wall: the nearest point of its edges; if it bends, judged where the shop is, on a stretch of 12 m with its own direction */
        const pr = ngProj(run, x, z); d = pr.d;
        if (run.curved) { Le = Math.min(L, 12); const s0 = clamp(pr.s - Le / 2, 0, L - Le), p0 = ngAt(run, s0), p1 = ngAt(run, s0 + Le), q = ngAt(run, s0 + Le / 2), dx = p1.x - p0.x, dz = p1.z - p0.z, l = hyp(dx, dz) || 1e-6; ux = dx / l; uz = dz / l; nx = dz / l; nz = -dx / l; if (nx * q.nx + nz * q.nz < 0) { nx = -nx; nz = -nz; } mx = (p0.x + p1.x) / 2; mz = (p0.z + p1.z) / 2; }
      }
      const road = ngRoad(mx + nx * 7, mz + nz * 7, 3), sa = ngStreetAhead(mx, mz, nx, nz, street);
      const sv = sa ? sa.t * 0.3 - (sa.own ? 5 : 0) - (sa.c === 0 ? 2 : sa.c === 1 ? 1 : 0) : null; // its own street first, then the more important one
      /* the way to the wall counts first (the front goes where the shop is); the length of the wall only breaks a tie; a wall that looks onto no street comes last */
      let score = host ? d + (sv != null ? sv : road ? 6 : 30) - Math.min(L, 20) * 0.02 : d + (sv != null ? sv * 0.7 : road ? 4 : 8);
      if (b.big && L < 10) return;
      if (b.big) { // a supermarket opens onto its car park: how much of the 20 m in front is parking counts first, then the street, then length
        let park = 0; for (let t = 2; t <= 20; t += 2) if (ngInPark(mx + nx * t, mz + nz * t, 0)) park++;
        score = d * 0.3 - park * 2 - (road ? 6 : 0) - Math.min(L, 40) * 0.1; // the OSM point is often at the door
      }
      if (b.e !== undefined) { // a DBGT wall: room for a front
        if (L < 4) score += 3;
      }
      if (L < need) score += 20; /* too short for the front */
      let blk = 0; if (b !== host && host && !(host.e !== undefined && b.e === host.e)) score += 2; // the wall of a volume built onto the shop's building (an annex along its facade)
      { // nothing right in front of the wall (a garden wall, the next volume, an annex along the facade), or the shop is lost (Flou in via Cadorna: a DBGT strip 1 m deep along its OSM building)
        let nb = 0, ns = 0; for (const f of [-0.4, -0.2, 0, 0.2, 0.4]) for (const dd of [0.6, 1.1, 1.45]) { const px = mx + ux * Le * f + nx * dd, pz = mz + uz * Le * f + nz * dd; let bl = inBuilding(px, pz); if (!bl) WALLS.each(px - 0.3, pz - 0.3, px + 0.3, pz + 0.3, q => { if (!bl && q.two && segDist(px, pz, q.ax, q.az, q.bx, q.bz) < 0.25) bl = true; }); ns++; if (bl) nb++; }
        score += 12 * nb / ns; blk = nb / ns;
      }
      if (skip && skip.has(ngKey({ a, c }))) return; // a wall already tried for this shop
      if (host || d < 15) { const W = { score, a, c, L, nx, nz, b, ux, uz, blk, d, es: run && run.es, cl: run && run.cl, curved: run && run.curved }; cands.push(W); if (!best || score < best.score) best = W; }
    };
    if (b.e !== undefined) { for (const r of ngRuns(b)) if (!r.party && r.L >= 2.6) one(r.a, r.c, r.L, r.nx, r.nz, r.ux, r.uz, r); return; }
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], c = pts[(i + 1) % pts.length], dx = c[0] - a[0], dz = c[1] - a[1], L = hyp(dx, dz); if (L < 2.6) continue;
      const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      let nx = dz / L, nz = -dx / L; if (inPoly(mx + nx * 0.3, mz + nz * 0.3, b.pts)) { nx = -nx; nz = -nz; }
      if (inPoly(mx + nx * 0.3, mz + nz * 0.3, b.pts) || inBuilding(mx + nx * 0.7, mz + nz * 0.7)) continue; // a party wall
      one(a, c, L, nx, nz, dx / L, dz / L);
    }
  };
  if (host && host.e !== undefined && EDIF.has(host.e)) for (const v of EDIF.get(host.e)) scan(v); // a DBGT building is several volumes: the front can be on any of them
  else if (host) scan(host); else BLD.each(x - 15, z - 15, x + 15, z + 15, scan);
  if (host && (!best || best.blk > 0.3)) { // its best wall has something right in front: the volumes built onto it (within 0.6 m all round), whose outer wall is the facade there
    const own = host.e !== undefined && EDIF.has(host.e) ? EDIF.get(host.e) : [host], bb = host.bb;
    BLD.each(bb[0] - 1, bb[1] - 1, bb[2] + 1, bb[3] + 1, b => { if (own.includes(b) || b.zb !== undefined || (host.e !== undefined && b.e === host.e)) return; if (own.some(o => ngTouch(o, b, 0.6))) scan(b); });
  }
  /* too far from the shop's point while another wall is close enough: that one (the limit is 15 m, or 10 m more than the nearest wall when even that is further, as in a big shed with the point in the middle) */
  if (best && host) { const lim = Math.max(15, Math.min(...cands.map(q => q.d)) + 10); if (best.d > lim) { let alt = null; for (const q of cands) if (q.d <= lim && (!alt || q.score < alt.score)) alt = q; if (alt) best = alt; } }
  return best;
}
function ngTouch(a, b, m) { // two footprints within m of each other somewhere
  if (a.bb[0] > b.bb[2] + m || b.bb[0] > a.bb[2] + m || a.bb[1] > b.bb[3] + m || b.bb[1] > a.bb[3] + m) return false;
  for (const [P, Q] of [[a.pts, b.pts], [b.pts, a.pts]]) for (const p of P) for (let i = 0; i < Q.length; i++) { const q = Q[i], r = Q[(i + 1) % Q.length]; if (segDist(p[0], p[1], q[0], q[1], r[0], r[1]) < m) return true; }
  return false;
}
const ngUseAdd = (use, key, w) => { const u = use.get(key) || { n: 0, w: 0 }; u.n++; u.w += w; use.set(key, u); };
let NG_LIST = null; const NG_SKIP = []; // the shops left without a front and why (the checks of docs/motore.md 7)
const NG_NAMED = new Map(); // name -> shops, so the plain signs (signList) leave these to their fronts
for (const e of D.ng || []) if (e[4]) { const k = e[4].toLowerCase(); if (!NG_NAMED.has(k)) NG_NAMED.set(k, []); NG_NAMED.get(k).push([e[0] / 10, e[1] / 10]); }
const ngHas = p => (NG_NAMED.get((p.n || '').toLowerCase()) || []).some(([x, z]) => hyp(x - p.x, z - p.z) < 40);
// ---- big supermarkets: a low building of their own (Unes, Carrefour, Iperal...) becomes a whole supermarket, built like the fuel stations,
// instead of a shop front on a generic block. The supermarket in a block of flats keeps its front
const NG_SUPER_PAL = [['#c8102e', '#ffffff'], ['#1d5aa8', '#ffffff'], ['#2a7a3a', '#ffffff'], ['#ff7a1e', '#ffffff'], ['#f2c230', '#1d3a8a']];
function ngSuperTutti() { for (const e of D.ng || []) { // (the bake: T.d.sup in the game)
  if (NG_CLASSES[e[2]] !== 'supermercato') continue;
  const x = e[0] / 10, z = e[1] / 10, ok = b => !b.lm && !b.big && !b.noSign && Math.abs(sArea(b.pts)) >= 700 && b.h <= (b.t === 3 ? 14 : 10.5);
  let host = null, inside = null, bd = 25;
  BLD.each(x, z, x, z, b => { if (!inside && inPoly(x, z, b.pts)) inside = b; });
  if (inside) host = ok(inside) ? inside : null;
  else BLD.each(x - 25, z - 25, x + 25, z + 25, b => { if (!ok(b)) return; for (let i = 0; i < b.pts.length; i++) { const p = b.pts[i], q = b.pts[(i + 1) % b.pts.length], d = segDist(x, z, p[0], p[1], q[0], q[1]); if (d < bd) { bd = d; host = b; } } });
  if (!host) continue;
  const name = e[4] || 'Supermercato', h0 = NG_HASH('super|' + name + '|' + e[0]);
  let pal = NG_SUPER_PAL[Math.floor(h0 * NG_SUPER_PAL.length)]; for (const [re, c] of NG_BRANDS) if (re.test(name)) { pal = c; break; }
  host.big = { e, x, z, name, pal, h0, v: Math.floor(h0 * 997) % 4 }; host.h = clamp(host.h, 6.8, 10);
} }
/* the gates ('g' and 'w') that stand on a wall, as [from, to] lengths along it */
let NG_GATES = null;
function ngGatesOn(W) {
  if (!NG_GATES) NG_GATES = (D.gates || []).filter(g => g[4] === 'w' || g[4] === 'g').map(g => [g[0] / 10, g[1] / 10, g[2] / 10, g[3] / 10]);
  const x0 = Math.min(W.a[0], W.c[0]) - 1.5, x1 = Math.max(W.a[0], W.c[0]) + 1.5, z0 = Math.min(W.a[1], W.c[1]) - 1.5, z1 = Math.max(W.a[1], W.c[1]) + 1.5, out = [];
  for (const g of NG_GATES) {
    if (Math.max(g[0], g[2]) < x0 || Math.min(g[0], g[2]) > x1 || Math.max(g[1], g[3]) < z0 || Math.min(g[1], g[3]) > z1) continue;
    const p = ngProj(W, g[0], g[1]), q = ngProj(W, g[2], g[3]); if (p.d > 0.9 || q.d > 0.9) continue; out.push([Math.min(p.s, q.s), Math.max(p.s, q.s)]);
  }
  return out;
}
function ngList() {
  if (NG_LIST) return NG_LIST; NG_LIST = []; const walls = new Map(), use = new Map(), retry = []; // use: the width the shops already on a DBGT wall take
  /* the shops closest to their wall choose first, so that the ones far from it do not take the room of the near ones */
  const dOf = new Map(); for (const e of D.ng || []) {
    const x = e[0] / 10, z = e[1] / 10, ms = NG_MODELS[NG_CLASSES[e[2]]]; if (!ms) continue;
    let big = null; BLD.each(x - 25, z - 25, x + 25, z + 25, b => { if (b.big && b.big.e === e) big = b; });
    if (big) { dOf.set(e, -1); continue; }
    const W0 = ngWall(x, z, null, e[6], Math.min(...ms.map(m => m.w)) * 0.55 + 0.4, null); dOf.set(e, W0 ? W0.d : 1e9);
  }
  for (const e of [...(D.ng || [])].sort((p, q) => (dOf.get(p) ?? 0) - (dOf.get(q) ?? 0))) {
    const x = e[0] / 10, z = e[1] / 10, cls = NG_CLASSES[e[2]], sub = e[3] || '', name = e[4] || '', ms = NG_MODELS[cls]; if (!ms) continue;
    let big = null; BLD.each(x - 25, z - 25, x + 25, z + 25, b => { if (b.big && b.big.e === e) big = b; });
    const need = big ? 0 : Math.min(...ms.map(m => m.w)) * 0.55 + 0.4, want = big ? 0 : ms[Math.floor(NG_HASH(cls + '|' + sub + '|' + name + '|' + e[0] + ',' + e[1]) * ms.length)].w, W = ngWall(x, z, big, e[6], need, use, null, want); if (!W || W.b.lm) { NG_SKIP.push([name, x, z, W ? 'modello' : 'nessun muro']); continue; }
    if (big) { // the supermarket's own glass front: it takes its share of the wall, the other shops on it move aside
      const w = clamp(W.L * 0.6, Math.min(8, W.L - 1), Math.min(28, W.L - 1)), along = (x - W.a[0]) * W.ux + (z - W.a[1]) * W.uz;
      const rec = { big: big.big, name, ...W, t: clamp(inPoly(x, z, big.pts) ? W.L / 2 : along, w / 2 + 0.5, W.L - w / 2 - 0.5), w };
      const key = ngKey(W);
      if (!walls.has(key)) walls.set(key, []); walls.get(key).push(rec); continue;
    }
    const h0 = NG_HASH(cls + '|' + sub + '|' + name + '|' + e[0] + ',' + e[1]), fit = ms.filter(m => m.w * 0.55 <= W.L - 0.4); if (!fit.length) { NG_SKIP.push([name, x, z, 'muro corto ' + W.L.toFixed(1)]); continue; }
    const m = fit[Math.floor(h0 * fit.length)], mi = ms.indexOf(m), along = ngProj(W, x, z).s, w = Math.min(m.w, W.L - 0.4);
    let pal = m.c; for (const [re, c] of NG_BRANDS) if (re.test(name)) { pal = m.c && m.c[0] ? c : [null, c[0]]; break; }
    const th = (NG_SUBTHEME[cls] || {})[sub] ?? (NG_DEFTHEME[cls] ? NG_DEFTHEME[cls](mi) : mi % 6);
    const rec = { x, z, cls, sub, name, label: NG_LABEL[sub] || NG_CLASS_LABEL[cls], m, mi, th, pal, h0, ohs: e[5] || '', ...W, t: clamp(along, w / 2 + 0.2, W.L - w / 2 - 0.2), w };
    const key = ngKey(W);
    if (!walls.has(key)) walls.set(key, []); walls.get(key).push(rec); ngUseAdd(use, key, w);
  }
  for (const list of walls.values()) {
    list.sort((p, q) => p.t - q.t); const L = list[0].L, n = list.length, sw = list.reduce((s, r) => s + r.w, 0), k = (L - 0.4 - 0.3 * (n - 1)) / sw;
    if (k < 1) for (const r of list) r.w *= k;
    let end = 0.2; for (const r of list) { r.t = Math.max(r.t, end + r.w / 2); end = r.t + r.w / 2 + 0.3; }
    let st = L - 0.2; for (let i = n - 1; i >= 0; i--) { const r = list[i]; r.t = Math.min(r.t, st - r.w / 2); st = r.t - r.w / 2 - 0.3; }
    // then each front widens into the free wall beside it, so a ground floor of shops reads as one: up to the middle of the gap to the next
    // front (all of it if that one stays as it is), and right to the end of the wall when it gets close; never round an inner corner
    const grows = r => !r.big && r.m.d !== 'p' && r.w >= 2.2;
    const wallEnd = (r, side) => { const s0 = side ? L - 0.35 : 0.35, q = ngAt(r, s0), x = q.x + q.nx * 1.7, z = q.z + q.nz * 1.7; return inBuilding(x, z) ? (side ? L - 1.9 : 1.9) : s0; };
    const span = list.map((r, i) => {
      let a = r.t - r.w / 2, b = r.t + r.w / 2; if (!grows(r)) return [a, b];
      const p = list[i - 1], q = list[i + 1];
      const lo = !p ? wallEnd(r, 0) : grows(p) ? (p.t + p.w / 2 + a) / 2 + 0.15 : p.t + p.w / 2 + 0.3, hi = !q ? wallEnd(r, 1) : grows(q) ? (b + q.t - q.w / 2) / 2 - 0.15 : q.t - q.w / 2 - 0.3;
      if (hi - lo <= r.w) return [a, b];
      const maxW = Math.min(18, Math.max(r.m.w * 2.2, 8)), g = Math.min(maxW, hi - lo) - r.w;
      a -= g / 2; b += g / 2; if (a < lo) { b += lo - a; a = lo; } if (b > hi) { a -= b - hi; b = hi; } a = Math.max(a, lo);
      if (a - lo < 2 && b - lo <= maxW + 2) a = lo; if (hi - b < 2 && hi - a <= maxW + 2) b = hi;
      return [a, b];
    });
    list.forEach((r, i) => { r.t = (span[i][0] + span[i][1]) / 2; r.w = span[i][1] - span[i][0]; });
    // the door of an androne wins over a shop window (Carlo 8/11): a front that falls on a gate of the wall moves beside it, or goes if there is no room
    { const gs = ngGatesOn(list[0]);
      for (const r of list) for (const [s0, s1] of gs) {
        if (r.t - r.w / 2 >= s1 + 0.15 || r.t + r.w / 2 <= s0 - 0.15) continue;
        const lo = r.w / 2 + 0.2, hi = r.L - r.w / 2 - 0.2, c = [s1 + 0.3 + r.w / 2, s0 - 0.3 - r.w / 2].filter(t => t >= lo && t <= hi && !list.some(q => q !== r && Math.abs(q.t - t) < (q.w + r.w) / 2 + 0.3));
        if (c.length) r.t = c.sort((p, q) => Math.abs(p - r.t) - Math.abs(q - r.t))[0]; else r.w = 0;
      } }
    for (const r of list) {
      if (r.w < 2.2) { if (!r.big) retry.push(r); NG_SKIP.push([r.name, r.x, r.z, 'senza posto sul muro ' + r.L.toFixed(1)]); continue; }
      ngPlace(r, r.t, r.w); r.tile = tileOf(r.cx, r.cz);
      if (r.big) { delete r.es; delete r.cl; delete r.d; r.big.front = r; continue; }
      if (ngDepth(r) < 1.5 && r.bdist < 1.5 && r.b.e !== undefined) { // a DBGT wall with a garden wall or a shed in front of part of it: the front moves along it to a free stretch
        const t0 = r.t, others = list.filter(q => q !== r && q.w >= 2.2);
        for (let dt = 0.5; dt < r.L; dt += 0.5) { let ok = false; for (const sg of [1, -1]) { const t = t0 + sg * dt; if (t < r.w / 2 + 0.2 || t > r.L - r.w / 2 - 0.2 || others.some(q => Math.abs(q.t - t) < (q.w + r.w) / 2 + 0.3)) continue;
          r.t = t; ngPlace(r, t, r.w); delete r.depth; if (!(ngDepth(r) < 1.5 && r.bdist < 1.5)) { ok = true; break; } }
          if (ok) break; }
        if (ngDepth(r) < 1.5 && r.bdist < 1.5) { r.t = t0; ngPlace(r, t0, r.w); delete r.depth; ngDepth(r); }
        r.tile = tileOf(r.cx, r.cz);
      }
      if (ngDepth(r) < 1.5 && r.bdist < (r.b.e !== undefined ? 1.0 : 1.5)) { if (!r.big) retry.push(r); NG_SKIP.push([r.name, r.x, r.z, 'qualcosa davanti a ' + r.bdist.toFixed(2)]); continue; } // another building right in front: no shop window there
      if (r.b.gtop === undefined) r.b.gtop = bldTop(r.b);
      delete r.es; delete r.cl; delete r.d; NG_LIST.push(r);
    }
  }
  // a DBGT shop left without a front (its wall full, or a garden wall right in front) tries the next walls of its building, one at a time
  for (const r of retry) {
    const skip = new Set([ngKey(r)]), e = D.ng.find(q => q[4] === r.name && Math.abs(q[0] / 10 - r.x) < 0.05 && Math.abs(q[1] / 10 - r.z) < 0.05); if (!e) continue;
    for (let k = 0; k < 4; k++) {
      const W = ngWall(r.x, r.z, null, e[6], r.m.w * 0.55 + 0.4, use, skip, r.m.w); if (!W) break; skip.add(ngKey(W));
      const w = Math.min(r.m.w, W.L - 0.4), taken = NG_LIST.filter(q => ngKey(q) === ngKey(W)), along = ngProj(W, r.x, r.z).s;
      const q = { ...r, ...W, w, depth: undefined, bdist: undefined }; let ok = false;
      for (let dt = 0; dt < W.L && !ok; dt += 0.5) for (const sg of dt ? [1, -1] : [1]) {
        const t = clamp(along, w / 2 + 0.2, W.L - w / 2 - 0.2) + sg * dt; if (t < w / 2 + 0.2 || t > W.L - w / 2 - 0.2 || taken.some(o => Math.abs(o.t - t) < (o.w + w) / 2 + 0.3)) continue;
        q.t = t; ngPlace(q, t, w); delete q.depth; if (!(ngDepth(q) < 1.5 && q.bdist < (W.b.e !== undefined ? 1.0 : 1.5))) { ok = true; break; } }
      if (!ok || w < 2.2) continue;
      q.tile = tileOf(q.cx, q.cz); if (q.b.gtop === undefined) q.b.gtop = bldTop(q.b); delete q.es; delete q.cl; delete q.d; NG_LIST.push(q); ngUseAdd(use, ngKey(W), w);
      const i = NG_SKIP.findIndex(sk => sk[0] === r.name && sk[1] === r.x && sk[2] === r.z); if (i >= 0) NG_SKIP.splice(i, 1);
      break;
    }
  }
  // opening hours: mapped ones as they are; the others copy the nearest shop of the same class that has them (any class if none),
  // moved by up to half an hour in steps of a quarter, so a street does not shut all at the same minute
  for (const r of NG_LIST) { r.oh = ngHours(r.ohs); r.noShut = NG_NOSHUT.has(r.cls); r.litNight =NG_LIT.has(r.cls) && NG_HASH('luci' + r.h0) < 0.5; }
  const known = NG_LIST.filter(r => r.oh);
  for (const r of NG_LIST) if (!r.oh && r.cls !== 'sfitto' && known.length) {
    let best = null, bd = 1e18;
    for (const q of known) { const d = (q.x - r.x) ** 2 + (q.z - r.z) ** 2 + (q.cls === r.cls ? 0 : 4e6); if (d < bd) { bd = d; best = q; } }
    r.oh = best.oh; r.ohA = (Math.floor(r.h0 * 5) - 2) * 15; r.ohB = (Math.floor(NG_HASH('chiude' + r.h0) * 5) - 2) * 15; // opens and shuts each up to half an hour off, by quarters
  }
  return NG_LIST;
}
// opening_hours, the part that shops use: "Mo-Fr 08:30-12:30,15:00-19:30; Sa 09:00-12:00; Su off", "24/7", nights past midnight.
// Holidays, months and anything rarer are skipped. A week is seven lists of [from, to] in minutes, Monday first
const NG_DAYK = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
// these trades have no shutters: when shut, about half of them (never the banks) leave the window lit to show the goods, the others switch it off.
// Everyone else pulls the shutter down
const NG_NOSHUT = new Set(['moda', 'mobili', 'auto', 'supermercato', 'banca']), NG_LIT = new Set(['moda', 'mobili', 'auto', 'supermercato']);
function ngHours(str) {
  const s = (str || '').trim(); if (!s) return null; if (/^24\/7/.test(s)) return { all: true };
  const D_ = '(?:Mo|Tu|We|Th|Fr|Sa|Su)', week = [[], [], [], [], [], [], []]; let any = false;
  for (let rule of s.split(new RegExp(`;|\\|\\||,\\s*(?=${D_}(?:-${D_})?\\s+\\d)`))) {
    rule = rule.trim(); if (!rule) continue;
    const m = rule.match(new RegExp(`^(${D_}(?:-${D_})?(?:\\s*,\\s*${D_}(?:-${D_})?)*)?\\s*(.*)$`)), ds = m[1], rest = m[2].trim();
    if (!ds && /^[A-Za-z]/.test(rest) && !/^(off|closed)$/i.test(rest)) continue; // PH, SH, months, weeks
    let days = [0, 1, 2, 3, 4, 5, 6];
    if (ds) { days = []; for (const part of ds.split(/\s*,\s*/)) { const [a, b] = part.split('-').map(d => NG_DAYK.indexOf(d)); if (b === undefined) days.push(a); else for (let d = a; ; d = (d + 1) % 7) { days.push(d); if (d === b) break; } } }
    if (/^(off|closed)$/i.test(rest)) { for (const d of days) week[d] = []; any = true; continue; }
    const rs = [...rest.matchAll(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/g)].map(t => [+t[1] * 60 + +t[2], +t[3] * 60 + +t[4]]); if (!rs.length) continue;
    for (const d of days) { week[d] = []; for (const [a, b] of rs) { if (b > a) week[d].push([a, b]); else { week[d].push([a, 1440]); week[(d + 1) % 7].push([0, b]); } } }
    any = true;
  }
  return any ? { week } : null;
}
function ngIsOpen(s, day, min) {
  const o = s.oh; if (!o) return true; if (o.all) return true; const ka = s.ohA || 0, kb = s.ohB || 0;
  return o.week[day].some(([a, b]) => min >= (a === 0 ? 0 : a + ka) && min < (b === 1440 ? 1440 : b + kb));
}
// the game's clock: the hour is TOD (extras.js), the day starts from today's and moves on at midnight
const NG_CLOCK = { day: (new Date().getDay() + 6) % 7, last: -1 };
const ngTOD = () => { try { return TOD; } catch (e) { return 12; } };
// the shutters: steel slats, about 9 cm each, lit from above (one repeat a metre: u and v in metres)
const NG_SHUT_MAT = ngLodMat(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide, map: canvasTex(64, 128, (g, w, h) => {
  for (let y = 0; y < h; y += 12) { const gr = g.createLinearGradient(0, y, 0, y + 12); gr.addColorStop(0, '#d2d6da'); gr.addColorStop(0.35, '#b9bdc2'); gr.addColorStop(0.8, '#9ea2a7'); gr.addColorStop(1, '#6e7276'); g.fillStyle = gr; g.fillRect(0, y, w, 12); g.fillStyle = 'rgba(30,32,36,.55)'; g.fillRect(0, y + 11, w, 1); }
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(80,70,60,${0.03 + (i % 5) * 0.012})`; g.fillRect((i * 37) % w, (i * 53) % h, 3 + (i % 4), 1); } }) }), 'shut', 0.35);
// The shutters and the lights, per tile (T.ngShut: the meshes and the fronts). A front: { s, sh: its shutters, u: 0 rolled up .. 1 down, on: lit or not,
// rng: the vertices its light reaches in glass, signs and pool }. Each second a front looks at its hours; a shutter that has to move rolls in 7 s when
// the player is within 70 m (Carlo: "le serrande si animano quando si chiudono e si aprono"), otherwise it is just where it has to be.
// The light goes off when the shutter is down and on as it starts to go up. Shops without shutters (NG_NOSHUT) only switch the light
const NG_ANIM = new Set();
function ngShutSet(D, f, u) {
  f.u = u; if (!D.shut) return; const pos = D.shut.geometry.attributes.position, uv = D.shut.geometry.attributes.uv;
  for (const it of f.sh) { const yb = it.yUp + (it.yDown - it.yUp) * u; for (const i of it.bot) pos.setY(i, yb); for (const i of it.top) uv.setY(i, it.yTop - yb); for (const [i, dy] of it.bar) pos.setY(i, yb + dy); }
  pos.needsUpdate = true; uv.needsUpdate = true;
}
function ngOnSet(D, f, on) {
  f.on = on;
  for (const [k, a, b] of f.rng) { const m = D[k], at = m && m.geometry.attributes.ngOn; if (!at || b <= a) continue; at.array.fill(on, a, b); at.needsUpdate = true; }
}
function ngLightOf(f, open) { return f.s.cls === 'sfitto' ? 0 : open || (f.s.noShut && f.s.litNight) ? 1 : 0; }
function ngTickTile(T, first) {
  const D = T.ngShut; if (!D) return; const min = ngTOD() * 60, cx = camera.position.x, cz = camera.position.z;
  for (const f of D.fronts) {
    const open = ngIsOpen(f.s, NG_CLOCK.day, min), want = f.sh.length && f.s.oh && !f.fixed ? (open ? 0 : 1) : f.fixed ? 1 : 0;
    if (first) { f.want = want; ngShutSet(D, f, want); ngOnSet(D, f, want === 1 && f.sh.length ? 0 : ngLightOf(f, open)); continue; }
    if (f.want !== want) {
      f.want = want;
      if (hyp(f.s.cx - cx, f.s.cz - cz) < 70) { f.anim = { D, to: want }; NG_ANIM.add(f); if (want === 0) ngOnSet(D, f, ngLightOf(f, open)); }
      else { if (f.anim) { NG_ANIM.delete(f); f.anim = null; } ngShutSet(D, f, want); }
    }
    if (!f.anim) { const on = want === 1 && f.sh.length ? 0 : ngLightOf(f, open); if (on !== f.on) ngOnSet(D, f, on); }
  }
}
let ngTick = 0;
function updNegozi(dt) {
  if (!NG_U.hook) { /* the camera of each render (and of its sun's pass) for near and far and for the rooms behind the glass: three.js gives cameraPosition only to some materials */
    NG_U.hook = true; const prev = scene.onBeforeRender; scene.onBeforeRender = function (r, sc, cam, rt) { NG_U.cam.value.setFromMatrixPosition(cam.matrixWorld); return prev ? prev.call(this, r, sc, cam, rt) : undefined; };
  }
  NG_U.lamps.value = LIGHTS.on || 0;
  for (const f of NG_ANIM) {
    const a = f.anim; if (!a || a.D.T.ngShut !== a.D) { NG_ANIM.delete(f); if (f.anim) f.anim = null; continue; }
    const st = Math.sign(a.to - f.u) * dt / 7; let u = f.u + st, done = false; if (st >= 0 ? u >= a.to : u <= a.to) { u = a.to; done = true; }
    ngShutSet(a.D, f, u); if (done) { NG_ANIM.delete(f); f.anim = null; if (a.to === 1) ngOnSet(a.D, f, 0); }
  }
  ngTick -= dt; if (ngTick > 0) return; ngTick = 1;
  const h = ngTOD(); if (NG_CLOCK.last >= 0 && h < NG_CLOCK.last - 12) NG_CLOCK.day = (NG_CLOCK.day + 1) % 7; NG_CLOCK.last = h;
  for (const T of VIVI) if (T.ngShut && T.group) ngTickTile(T, false);
}
// ---- modelling in a wall's own frame: x along the wall, y up from the pavement, z out of the wall
// a box straight into the buffer, its six faces turned outwards (a BoxGeometry for each of the hundreds of boxes of a street of shops cost a third of the time)
const NG_BOXF = [[1, 0, 0, [[1, -1, 1], [1, -1, -1], [1, 1, -1], [1, 1, 1]]], [-1, 0, 0, [[-1, -1, -1], [-1, -1, 1], [-1, 1, 1], [-1, 1, -1]]], [0, 1, 0, [[-1, 1, 1], [1, 1, 1], [1, 1, -1], [-1, 1, -1]]],
  [0, -1, 0, [[-1, -1, -1], [1, -1, -1], [1, -1, 1], [-1, -1, 1]]], [0, 0, 1, [[-1, -1, 1], [1, -1, 1], [1, 1, 1], [-1, 1, 1]]], [0, 0, -1, [[1, -1, -1], [-1, -1, -1], [-1, 1, -1], [1, 1, -1]]]], NG_UV4 = [[0, 0], [1, 0], [1, 1], [0, 1]];
function ngBoxV(F, b, w, h, d, x, y, z, col) {
  const hx = w / 2, hy = h / 2, hz = d / 2;
  for (const [nx, ny, nz, P] of NG_BOXF) { const i0 = b.p.length / 3; for (let k = 0; k < 4; k++) { const c = P[k]; F.v(b, x + c[0] * hx, y + c[1] * hy, z + c[2] * hz, nx, ny, nz, NG_UV4[k][0], NG_UV4[k][1], col); } b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); }
}
function ngKit(C, cx, gy, cz, nx, nz) {
  const F = lmFrame(new THREE.Matrix4().makeRotationY(Math.atan2(nx, nz)).setPosition(cx, gy, cz));
  const lx = (x, z) => [cx + nz * x + nx * z, cz - nx * x + nz * z]; // local (x, z) -> world
  /* on a curved wall the front is cut in pieces of C.chunk metres, so that the bend (ngBend) can follow the wall */
  const nCh = w => Math.min(60, Math.max(1, Math.ceil(w / (C.chunk || 1e9))));
  const box = (w, h, d, x, y, z, col, b = C.solid) => { const n = nCh(w), cc = col === null ? null : COL(col); for (let j = 0; j < n; j++) ngBoxV(F, b, w / n, h, d, x - w / 2 + (j + 0.5) * w / n, y, z, cc); };
  const faceX = (b, P, S, col) => { const n = nCh(Math.abs(P[1][0] - P[0][0])); for (let j = 0; j < n; j++) { const xa = P[0][0] + (P[1][0] - P[0][0]) * j / n, xb = P[0][0] + (P[1][0] - P[0][0]) * (j + 1) / n; F.face(b, [[xa, P[0][1], P[0][2]], [xb, P[1][1], P[1][2]], [xb, P[2][1], P[2][2]], [xa, P[3][1], P[3][2]]], S, col); } };
  let qzn = 1; /* how many quads the last qz made */
  const neon = (k, w, h, d, x, y, z) => F.geo(C.neon[k] || (C.neon[k] = Buf()), lmBox(w, h, d, x, y, z), null, null);
  // a quad facing +z (or +x / -x for signs sticking out), uv 0..1 in its cell; cells are packed into the tile's sign texture afterwards
  const quad = (b, P, n, uvs = [[0, 0], [1, 0], [1, 1], [0, 1]]) => { qzn = 1; const i0 = b.p.length / 3; P.forEach((p, i) => F.v(b, p[0], p[1], p[2], n[0], n[1], n[2], uvs[i][0], uvs[i][1])); b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); return i0; };
  const qz = (b, x0, y0, x1, y1, z) => { const n = nCh(x1 - x0); let first = -1;
    for (let j = 0; j < n; j++) { const a0 = j / n, a1 = (j + 1) / n, xa = x0 + (x1 - x0) * a0, xb = x0 + (x1 - x0) * a1, i0 = quad(b, [[xa, y0, z], [xb, y0, z], [xb, y1, z], [xa, y1, z]], [0, 0, 1], [[a0, 0], [a1, 0], [a1, 1], [a0, 1]]); if (!j) first = i0; }
    qzn = n; return first; };
  const qx = (b, z0, y0, z1, y1, x, sgn) => sgn > 0 ? quad(b, [[x, y0, z1], [x, y0, z0], [x, y1, z0], [x, y1, z1]], [1, 0, 0]) : quad(b, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], [-1, 0, 0]);
  const cell = (wm, hm, draw) => { const pw = Math.min(1000, Math.max(48, Math.round(wm * 180))), ph = Math.min(512, Math.max(16, Math.round(hm * pw / wm))); const c = { pw, ph, draw }; C.cells.push(c); return c; };
  const sign = (c, i0) => { const n = qzn; for (let j = 0; j < n; j++) C.sq.push([i0 + 4 * j, c]); };
  /* a quad with a colour at each corner (the shade deep in the opening), turned to face n; cut along x on a curved wall */
  const quadC = (b, P, n, cols) => {
    const k = Math.abs(P[1][0] - P[0][0]) > 0.01 ? nCh(Math.abs(P[1][0] - P[0][0])) : 1, L = (p, q, t) => p.map((v, i) => v + (q[i] - v) * t), LC = (p, q, t) => new THREE.Color().copy(p).lerp(q, t);
    for (let j = 0; j < k; j++) {
      const t0 = j / k, t1 = (j + 1) / k, Q = [L(P[0], P[1], t0), L(P[0], P[1], t1), L(P[3], P[2], t1), L(P[3], P[2], t0)], Cc = [LC(cols[0], cols[1], t0), LC(cols[0], cols[1], t1), LC(cols[3], cols[2], t1), LC(cols[3], cols[2], t0)];
      const i0 = b.p.length / 3; Q.forEach((p, i) => F.v(b, p[0], p[1], p[2], n[0], n[1], n[2], 0, 0, Cc[i]));
      const e1 = [Q[1][0] - Q[0][0], Q[1][1] - Q[0][1], Q[1][2] - Q[0][2]], e2 = [Q[2][0] - Q[0][0], Q[2][1] - Q[0][1], Q[2][2] - Q[0][2]], cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      if (cr[0] * n[0] + cr[1] * n[1] + cr[2] * n[2] >= 0) b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); else b.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
    }
  };
  /* a pane: the room R behind it (xa..xb, ya..yb in the frame of the wall, its picture and layer, colours, depth) seen through the quad */
  const glass = (R, xa, ya, xb, yb, z) => {
    if (xb - xa < 0.02 || yb - ya < 0.02) return; const b = C.glassB, i0 = qz(b, xa, ya, xb, yb, z), n = 4 * qzn, rw = R.xb - R.xa, rh = R.yb - R.ya;
    for (let k = 0; k < n; k++) { const q = (i0 + k) * 2, xl = xa + (xb - xa) * b.uv[q], yl = ya + (yb - ya) * b.uv[q + 1]; b.uv[q] = (xl - R.xa) / rw; b.uv[q + 1] = (yl - R.ya) / rh; b.R.push(rw, rh, R.cell, R.mid); b.W.push(R.wc.r, R.wc.g, R.wc.b, R.dp); b.Fc.push(R.fc.r, R.fc.g, R.fc.b); }
  };
  const mode = m => { ngFill(C); C.mode = m; }, sk = (d, k) => { ngFill(C); C.sk = [d, k]; };
  return { F, lx, box, neon, quad, qz, qx, cell, sign, faceX, quadC, glass, mode, sk, nq: () => qzn };
}
// the attributes of near and far (ngL, ngC), of the light (ngOn) and of the signs (ngS) for the vertices made since the last call: as things were when they were made
function ngFill(C) {
  for (const b of ngBufs(C)) { const n = b.p.length / 3, L = b.L || (b.L = []), cc = b.cc || (b.cc = []), on = b.on || (b.on = []); while (L.length < n) { L.push(C.mode); cc.push(C.fc[0], C.fc[1], C.fc[2], C.fc[3]); on.push(1); } }
  const S = C.sign.S || (C.sign.S = []), n2 = C.sign.p.length / 3 * 2; while (S.length < n2) S.push(C.sk[0], C.sk[1]);
}
// the opening hours of OSM as the sticker on the door has them (only the real ones: the copied ones are not written anywhere)
const NG_DAYIT = { Mo: 'LUN', Tu: 'MAR', We: 'MER', Th: 'GIO', Fr: 'VEN', Sa: 'SAB', Su: 'DOM', PH: 'FESTIVI' };
function ngOhText(str) {
  const s = (str || '').trim(); if (/^24\/7/.test(s)) return ['SEMPRE APERTO'];
  return s.split(';').map(r => r.trim().replace(/\b(Mo|Tu|We|Th|Fr|Sa|Su|PH)\b/g, d => NG_DAYIT[d]).replace(/\b(off|closed)\b/gi, 'CHIUSO').replace(/\b0(\d):/g, '$1:').replace(/\s*,\s*/g, '  ')).filter(Boolean).slice(0, 6);
}
// ---- one front
function ngText(g, txt, cx, cy, maxW, maxH, font, col) {
  let fs = Math.max(6, Math.floor(maxH)); const f = s => font.replace('%', s); g.font = f(fs);
  while (g.measureText(txt).width > maxW && fs > 6) { fs = Math.floor(fs * 0.92); g.font = f(fs); }
  g.fillStyle = col; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, cx, cy);
}
// the front is drawn flat on the chord between the ends of the facade, but the real wall bends (an arcade, a curved corner, a run of short edges).
// ngProfile measures how far the wall is from that plane (out = positive) every 10 cm along the front; ngBend then moves everything the front drew
// along the wall, piece by piece, so glass, sign and frame stay on the wall with no gap and none of it sinks into it
function ngProfile(s) {
  const n = Math.max(2, Math.ceil(s.w / 0.1)), hw = s.w / 2, out = [];
  for (let i = 0; i <= n; i++) {
    const x = -hw + s.w * i / n, px = s.cx + s.ux * x, pz = s.cz + s.uz * x; let off = 0;
    if (inBuilding(px, pz)) { let k = 0.02; while (k <= 0.8 && inBuilding(px + s.nx * k, pz + s.nz * k)) k += 0.02; off = k > 0.8 ? 0 : k - 0.01; }
    else { let k = 0.02; while (k <= 0.8 && !inBuilding(px - s.nx * k, pz - s.nz * k)) k += 0.02; off = k > 0.8 ? 0 : -(k - 0.01); }
    out.push(Math.max(-0.6, Math.min(0.6, off)));
  }
  return out;
}
const ngOffAt = (prof, w, x) => { const n = prof.length - 1, f = Math.max(0, Math.min(n, (x + w / 2) / w * n)), i = Math.min(n - 1, Math.floor(f)); return prof[i] + (prof[i + 1] - prof[i]) * (f - i); };
function ngBufs(C) { return [C.solid, C.sign, C.shut, C.plug, C.glassB, C.pool, ...Object.values(C.neon)]; }
function ngFront(s, C) {
  ngFill(C); C.fc = [s.cx, s.cz, s.nx, s.nz]; C.mode = 0; C.sk = [1, 0.6];
  const prof = ngProfile(s), n = prof.length - 1, a0 = prof[0], da = prof[n] - a0; let dev = 0, big = 0;
  for (let i = 0; i <= n; i++) { dev = Math.max(dev, Math.abs(prof[i] - a0 - da * i / n)); big = Math.max(big, Math.abs(prof[i])); }
  const bend = big > 0.012; C.chunk = dev > 0.02 ? 0.8 : 0; C.nBend = (C.nBend || 0) + (dev > 0.02 ? 1 : 0);
  const from = new Map(ngBufs(C).map(b => [b, b.p.length / 3]));
  const f = { s, sh: [], u: 0, on: 1, rng: null, fixed: false }; C.cur = f;
  const c0 = C.cells.length; ngFront0(s, C); for (let i = c0; i < C.cells.length; i++) C.cells[i].nm = !!s.name;
  ngFill(C); C.mode = 0;
  f.rng = [['glass', from.get(C.glassB), C.glassB.p.length / 3], ['sign', from.get(C.sign), C.sign.p.length / 3], ['pool', from.get(C.pool), C.pool.p.length / 3]];
  C.fronts.push(f);
  if (!bend) return;
  for (const b of ngBufs(C)) for (let v = from.get(b) || 0, N = b.p.length / 3; v < N; v++) {
    const X = b.p[v * 3], Z = b.p[v * 3 + 2], xl = (X - s.cx) * s.nz - (Z - s.cz) * s.nx, d = ngOffAt(prof, s.w, xl) + 0.01;
    b.p[v * 3] = X + s.nx * d; b.p[v * 3 + 2] = Z + s.nz * d;
  }
}
const ngShade = (hex, k) => new THREE.Color(hex).multiplyScalar(k);
function ngFront0(s, C) {
  const m = s.m, cls = s.cls, W = s.w, hw = W / 2, gy = H.ground(s.cx + s.nx * 0.6, s.cz + s.nz * 0.6), top = s.b.gtop - gy;
  if (top < 2.7) return;
  const gl = Math.min(H.ground(s.cx - s.ux * hw, s.cz - s.uz * hw), H.ground(s.cx + s.ux * hw, s.cz + s.uz * hw)) - gy - 0.35;
  const { F, lx, box, neon, qz, qx, cell, sign, faceX, quadC, glass, mode, sk, nq } = ngKit(C, s.cx, gy, s.cz, s.nx, s.nz);
  const pal = s.pal || ['#25303f', '#f2f2ee'], bg = pal[0], fg = pal[1], kc = m.k, font = NG_FONT[m.f || 'sans'];
  const caseOf = t => (m.f === 'script' || m.f === 'serif') && s.name ? t : t.toUpperCase();
  const main = caseOf(s.name || s.label), sub = s.name && m.sub ? s.label : '';
  const drawSign = (g, w, h, bgc, fgc, opt = {}) => {
    if (bgc) { g.fillStyle = bgc; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.14)'; g.fillRect(0, 0, w, Math.max(2, h * 0.06)); if (m.old) { g.fillStyle = 'rgba(90,80,70,.35)'; for (let i = 0; i < 30; i++) g.fillRect((i * 37) % w, (i * 13) % h, 8, 3); } }
    let x0 = 0; const ic = opt.icon && h > 20;
    if (ic) { const sz = h * 0.62; g.fillStyle = fgc; g.fillRect(h * 0.5 - sz / 6, h * 0.19, sz / 3, sz); g.fillRect(h * 0.5 - sz / 2, h * 0.5 - sz / 6, sz, sz / 3); x0 = h * 0.9; }
    const mx = (x0 + w) / 2, mw = (w - x0) * 0.9;
    if (opt.sub && h > 18) { ngText(g, opt.main, mx, h * 0.38, mw, h * 0.52, font, fgc); ngText(g, opt.sub, mx, h * 0.8, mw, h * 0.22, NG_FONT.sans, fgc); }
    else ngText(g, opt.main, mx, h * 0.53, mw, h * 0.7, font, fgc);
  };
  // heights: the glass up to Hv (not H: that is the height API of altezze3.js, used above), the sign above it up to the floor above (the building may be low)
  const bay = m.d === 'g', Hv = bay ? clamp(top - 1.0, 2.6, 3.6) : clamp(top - 1.2, 2.3, 2.9);
  let sh = clamp(top - Hv - 0.35, 0, m.s === 'cas' || m.s === 'pan' ? 0.75 : 0.7), stype = m.s;
  const ext = new Set(m.x || []);
  if (stype === 'ten' && !(m.a && C.depth(s) >= 1.1)) stype = 'pan';
  if (sh < 0.32 && ['pan', 'cas', 'fas', 'let'].includes(stype)) { stype = 'none'; ext.add('ban'); }
  const fw = { thin: 0.07, steel: 0.1, wood: 0.15, portal: 0.32 }[m.fs] || 0.08, y0 = m.fs === 'wood' ? 0.55 : 0.32, x0 = -hw + fw, x1 = hw - fw;
  // the openings, left to right
  const segs = [], dw = 1.05;
  const at = (a, b) => { if (a > x0 + 0.05) segs.push(['glass', x0, a]); };
  if (m.d === 'c') { at(-dw / 2); segs.push(['door', -dw / 2, dw / 2]); if (dw / 2 < x1 - 0.05) segs.push(['glass', dw / 2, x1]); }
  else if (m.d === 'l') { segs.push(['door', x0, x0 + dw]); segs.push(['glass', x0 + dw, x1]); }
  else if (m.d === 'r') { segs.push(['glass', x0, x1 - dw]); segs.push(['door', x1 - dw, x1]); }
  else if (m.d === '2') { const a = -W / 4, b = W / 4; segs.push(['glass', x0, a - dw / 2], ['door', a - dw / 2, a + dw / 2], ['glass', a + dw / 2, b - dw / 2], ['door', b - dw / 2, b + dw / 2], ['glass', b + dw / 2, x1]); }
  else if (m.d === 'v') { const sd = W > 8 ? 1.1 : 0.8; segs.push(['glass', x0, -sd], ['slide', -sd, sd], ['glass', sd, x1]); }
  else if (m.d === 'g') { const bw = Math.min(W - 1.4, 4.2); if (bw < 2.4) segs.push(['bay', x0, x1]); else { segs.push(['bay', x0, x0 + bw]); if (x1 - x0 - bw > 1.6) segs.push(['door', x0 + bw + 0.1, x0 + bw + 1.1], ['glass', x0 + bw + 1.1, x1]); else segs.push(['door', x0 + bw + 0.1, x1]); } }
  else if (m.d === 'p') { segs.push(['wall', x0, -0.75], ['port', -0.75, 0.75], ['wall', 0.75, x1]); }
  else segs.push(['shut', x0, x1]);
  if (ext.has('atm')) { const i = segs.map(q => q[0]).lastIndexOf('glass'); if (i >= 0 && segs[i][2] - segs[i][1] >= 1.7) { const e = segs[i][2]; segs[i][2] = e - 0.95; segs.splice(i + 1, 0, ['atm', e - 0.95, e]); } }
  const stone = m.fs === 'wood' ? kc : m.fs === 'portal' ? '#9a958b' : '#4a4d52', doors = segs.filter(q => ['door', 'slide', 'bay', 'port'].includes(q[0])).map(q => [q[1], q[2]]);
  // the frame by the age of the building (Carlo 8/11): wood in the old town and the old houses (CENED epoch 0-1, before 1945), dark aluminium in the newer ones
  const ep = s.b.ep, wood = ep !== undefined && ep !== null ? ep <= 1 : m.fs === 'wood', hs = NG_HASH('serr|' + s.h0);
  const sc = wood ? ['#4a2f1c', '#5a3a22', '#3b2a1e', '#2f4536'][Math.floor(hs * 4)] : ['#2b2e33', '#3a3d42', '#1f2124', '#45484d'][Math.floor(hs * 4)];
  const hc = wood ? '#c9a85a' : '#c9ccd1', fr = wood ? 0.085 : 0.055, Dp = wood ? 0.27 : 0.22; // the handle, the profile of the frame, how deep the opening is
  const sillC = m.fs === 'portal' || wood ? '#cdc7ba' : '#b8b3a8', revC = m.fs === 'portal' ? '#d6d0c2' : m.fs === 'wood' ? kc : '#cfc9bd';
  const yS = (ep !== undefined && ep !== null && ep <= 1 && hs < 0.55) || gl < -0.5 ? 0.15 : 0.03; // the shop's floor: a step in the old houses and where the pavement falls away
  const yT = Hv - 0.08, yG = yS + (bay ? 0 : wood ? 0.5 : 0.28), zb = -Dp + 0.05; // the top of the opening (under the lintel), the bottom of the glass, the plane of the frames
  const ci = NG_WIN.ci(cls, s.th), cc = NG_WIN.col[ci] || [COL('#dcd8d0'), COL('#9a958b')];
  const room = { xa: x0, xb: x1, ya: yS, yb: yT, cell: ci, mid: NG_MID[cls] ?? -1, wc: cc[0], fc: cc[1], dp: bay ? 6 : 3.6 }, roomF = { ...room, ya: 0, yb: Hv - 0.06 };
  const shutters = !s.noShut && m.d !== 'p', shutCol = '#9da1a6';
  /* a shutter (near or far): the curtain from yTopS down to yBot at z, the bar at its foot; it rolls (ngShutSet) */
  const curtain = (a, b, yBot, yTopS, z) => {
    const bS = C.shut, i0 = qz(bS, a, yBot, b, yTopS, z), n = nq(), it = { bot: [], top: [], bar: [], yUp: gy + yTopS, yDown: gy + yBot, yTop: gy + yTopS };
    for (let j = 0; j < n; j++) { const v = i0 + 4 * j; it.bot.push(v, v + 1); it.top.push(v + 2, v + 3); for (let k = 0; k < 4; k++) { const q = (v + k) * 2; bS.uv[q] = a + (b - a) * bS.uv[q]; bS.uv[q + 1] = k < 2 ? 0 : yTopS - yBot; } }
    const v0 = bS.p.length / 3; box(b - a, 0.06, 0.05, (a + b) / 2, yBot + 0.03, z, null, bS); for (let v = v0, v1 = bS.p.length / 3; v < v1; v++) it.bar.push([v, bS.p[v * 3 + 1] - (gy + yBot)]);
    C.cur.sh.push(it);
  };
  if (m.d === 'x') C.cur.fixed = true;

  // ================= near: the opening set into the wall
  mode(1);
  const opens = m.d === 'p' ? segs.filter(q => q[0] === 'port').map(q => [q[1], q[2], Math.min(2.7, Hv)]) : [[x0, x1, yT]];
  for (const [oa, ob, ot] of opens) {
    const ow = ob - oa, oc = (oa + ob) / 2, rv = COL(m.d === 'p' ? '#cdc7ba' : revC), rk = rv.clone().multiplyScalar(0.55), dz = -Dp - 0.02;
    quadC(C.solid, [[oa, yS, 0.03], [oa, yS, dz], [oa, ot, dz], [oa, ot, 0.03]], [1, 0, 0], [rv, rk, rk, rv]); // the reveals, darker deep in
    quadC(C.solid, [[ob, yS, dz], [ob, yS, 0.03], [ob, ot, 0.03], [ob, ot, dz]], [-1, 0, 0], [rk, rv, rv, rk]);
    quadC(C.solid, [[oa, ot, 0.03], [ob, ot, 0.03], [ob, ot, dz], [oa, ot, dz]], [0, -1, 0], [rv.clone().multiplyScalar(0.8), rv.clone().multiplyScalar(0.8), rk.clone().multiplyScalar(0.8), rk.clone().multiplyScalar(0.8)]); // the soffit
    quadC(C.solid, [[oa, yS, dz], [ob, yS, dz], [ob, ot, dz], [oa, ot, dz]], [0, 0, 1], [COL('#15171a'), COL('#15171a'), COL('#15171a'), COL('#15171a')]); // the back: nothing shows behind
    box(ow + 0.06, 0.06, Dp + 0.09, oc, yS - 0.03, (dz + 0.07) / 2, sillC); // the stone sill, 4 cm proud of the wall
    if (yS - 0.06 - gl > 0.02) box(ow + 0.06, yS - 0.06 - gl, 0.06, oc, (yS - 0.06 + gl) / 2, 0.04, sillC);
    qz(C.plug, oa, yS, ob, ot, 0.03); // the plug: from here on the wall does not cover the opening
  }
  for (const [t, a, b] of segs) {
    const w = b - a, c = (a + b) / 2;
    if (t === 'glass') {
      if (yG > yS + 0.05) { box(w, yG - yS, 0.07, c, (yS + yG) / 2, zb - 0.01, wood ? sc : '#4d5055'); if (wood && w > 0.5) box(w - 0.22, yG - yS - 0.16, 0.02, c, (yS + yG) / 2, zb + 0.035, ngShade(sc, 1.3)); } // the plinth: a panel of wood, or of metal
      const n = Math.max(1, Math.round(w / 1.6)), pw = w / n;
      glass(room, a, yG, b, yT, zb - 0.005);
      for (let i = 0; i <= n; i++) { const xm = i === 0 ? a + fr / 2 : i === n ? b - fr / 2 : a + i * pw; box(fr, yT - yG, 0.09, xm, (yT + yG) / 2, zb, sc); } // jambs and mullions
      box(w, fr, 0.09, c, yT - fr / 2, zb, sc); box(w, fr * 1.3, 0.1, c, yG + fr * 0.65, zb + 0.005, sc);
      if (wood && yT - yG > 2.0) box(w, fr * 0.8, 0.08, c, yT - 0.55, zb, sc); // the transom of the old wooden fronts
    } else if (t === 'door' || t === 'slide') {
      const dh = Math.min(t === 'slide' ? 2.5 : 2.3, yT - yS - 0.12), dT = yS + dh, la = a + fr, lb = b - fr, lw = lb - la, lz = zb + 0.015;
      box(fr, yT - yS, 0.1, a + fr / 2, (yT + yS) / 2, zb, sc); box(fr, yT - yS, 0.1, b - fr / 2, (yT + yS) / 2, zb, sc); box(w, fr, 0.1, c, dT + fr / 2, zb, sc); box(w, fr, 0.1, c, yT - fr / 2, zb, sc);
      if (yT - fr - (dT + fr) > 0.12) glass(room, la, dT + fr, lb, yT - fr, zb - 0.005); // the light over the door
      if (t === 'slide') { // two leaves of glass that slide apart, thin frames, the sensor over them
        for (const [p, q] of [[la, (la + lb) / 2], [(la + lb) / 2, lb]]) { glass(room, p + 0.04, yS + 0.08, q - 0.04, dT - 0.04, lz); box(0.045, dh, 0.06, p + 0.0225, yS + dh / 2, lz, sc); box(0.045, dh, 0.06, q - 0.0225, yS + dh / 2, lz, sc); box(q - p, 0.08, 0.06, (p + q) / 2, yS + 0.04, lz, sc); box(q - p, 0.045, 0.06, (p + q) / 2, dT - 0.0225, lz, sc); }
        box(0.28, 0.06, 0.07, c, dT + fr + 0.04, zb + 0.06, '#2b2e33');
      } else { // the leaf: stiles and rails round a pane (wood: a panel at the foot); the handle away from the hinges
        const st = wood ? 0.11 : 0.065, br = wood ? 0.42 : 0.15, hx = lb - st - 0.07;
        box(st, dh, 0.06, la + st / 2, yS + dh / 2, lz, sc); box(st, dh, 0.06, lb - st / 2, yS + dh / 2, lz, sc); box(lw, br, 0.06, (la + lb) / 2, yS + br / 2, lz, sc); box(lw, st, 0.06, (la + lb) / 2, dT - st / 2, lz, sc);
        if (wood) box(lw - 2 * st - 0.08, br - 0.13, 0.02, (la + lb) / 2, yS + br / 2, lz + 0.035, ngShade(sc, 1.3));
        glass(room, la + st, yS + br, lb - st, dT - st, lz);
        if (wood) { box(0.05, 0.17, 0.015, hx, yS + 1.05, lz + 0.037, hc); box(0.03, 0.03, 0.05, hx, yS + 1.09, lz + 0.06, hc); box(0.14, 0.024, 0.024, hx - 0.06, yS + 1.09, lz + 0.085, hc); box(0.02, 0.05, 0.012, hx, yS + 0.98, lz + 0.045, '#2a1f10'); }
        else { box(0.026, 0.95, 0.026, hx, yS + 1.05, lz + 0.085, hc); for (const dy of [-0.42, 0.42]) box(0.02, 0.02, 0.06, hx, yS + 1.05 + dy, lz + 0.05, hc); }
        // what hangs on the glass of the door: the card OPEN, the hours of OSM (only where OSM has them)
        if (NG_HASH('aperto|' + s.h0) < 0.6 && cls !== 'sfitto' && lw > 0.6) {
          const ac = cell(0.3, 0.12, (g, w2, h2) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w2, h2); g.fillStyle = '#c8102e'; g.fillRect(2, 2, w2 - 4, h2 - 4); ngText(g, 'APERTO', w2 / 2, h2 / 2, w2 * 0.86, h2 * 0.62, NG_FONT.black, '#ffffff'); });
          sk(1, 0); const xa = (la + lb) / 2 - 0.15; sign(ac, qz(C.sign, xa, yS + 1.58, xa + 0.3, yS + 1.7, lz + 0.006));
        }
        if (s.ohs && lw > 0.6) {
          const lines = ngOhText(s.ohs); if (lines.length) {
            const oc = cell(0.2, 0.06 + lines.length * 0.035, (g, w2, h2) => { g.fillStyle = '#f6f4ee'; g.fillRect(0, 0, w2, h2); const lh = h2 / (lines.length + 1.6); ngText(g, 'ORARI', w2 / 2, lh * 0.8, w2 * 0.8, lh * 0.9, NG_FONT.black, '#1a1a1a'); lines.forEach((l, i) => ngText(g, l, w2 / 2, lh * (2.05 + i), w2 * 0.92, lh * 0.75, NG_FONT.cond, '#2b2b2b')); });
            sk(1, 0); const xa = la + st + 0.03, hh = 0.06 + lines.length * 0.035; sign(oc, qz(C.sign, xa, yS + 1.3 - hh, xa + 0.2, yS + 1.3, lz + 0.006));
          }
        }
        sk(1, 0.6);
      }
      if (yS > 0.1) box(w + 0.3, yS - gl, 0.36, c, (yS + gl) / 2, 0.22, sillC); // the step outside
    } else if (t === 'bay') { // the workshop's door rolled up in its box at the top, the workshop seen through
      glass({ ...room, xa: a, xb: b, ya: yS, yb: yT - 0.4, dp: 6 }, a, yS, b, yT - 0.4, -Dp + 0.03);
      box(w, 0.4, Dp - 0.02, c, yT - 0.2, -Dp / 2 - 0.01, '#8f949a'); for (let k = 0; k < 4; k++) box(w, 0.012, 0.01, c, yT - 0.08 - k * 0.09, -0.015, '#6b6e72');
    } else if (t === 'port') { // the street door of the offices: wooden leaves set back in the stone, the brass knob in the middle, the plates beside it
      const ph = Math.min(2.7, Hv), lz = -0.17, lc = m.k === '#e8e2d0' ? '#2f4a3a' : '#5a3e28', pc = m.k === '#e8e2d0' ? '#263d30' : '#4a3220';
      box(w, ph - yS, 0.08, c, (ph + yS) / 2, lz, lc);
      for (const sx of [-1, 1]) for (const [yy, hh] of [[yS + 0.55, 0.62], [yS + 1.5, 0.95]]) { box(w / 2 - 0.2, hh, 0.03, c + sx * w / 4, yy, lz + 0.055, pc); box(w / 2 - 0.28, hh - 0.1, 0.02, c + sx * w / 4, yy, lz + 0.075, lc); }
      box(0.035, ph - yS, 0.03, c, (ph + yS) / 2, lz + 0.055, '#2a1f10');
      F.geo(C.solid, new THREE.SphereGeometry(0.05, 10, 7).translate(c, yS + 1.15, lz + 0.12), null, COL('#d4af5a')); box(0.12, 0.12, 0.015, c, yS + 1.15, lz + 0.05, '#c9a85a'); // the gilded knob
      box(0.24, 0.05, 0.012, c, yS + 0.95, lz + 0.05, '#c9a85a'); // the letter slot
    } else if (t === 'atm') { // the cash machine in a stone panel flush with the wall, its face 13 cm in
      const pc = '#d9d6cf', na = c - 0.3, nb = c + 0.3, ny0 = yS + 0.92, ny1 = yS + 1.72, zf = -0.02;
      box(w, ny0 - yS, 0.06, c, (ny0 + yS) / 2, zf, pc); box(w, yT - ny1, 0.06, c, (yT + ny1) / 2, zf, pc); box(na - a, ny1 - ny0, 0.06, (a + na) / 2, (ny0 + ny1) / 2, zf, pc); box(b - nb, ny1 - ny0, 0.06, (nb + b) / 2, (ny0 + ny1) / 2, zf, pc);
      box(0.6, 0.8, 0.02, c, (ny0 + ny1) / 2, -0.16, '#3a3d40'); for (const xs of [na + 0.01, nb - 0.01]) box(0.02, 0.8, 0.14, xs, (ny0 + ny1) / 2, -0.09, '#8f949a'); for (const ys of [ny0 + 0.01, ny1 - 0.01]) box(0.6, 0.02, 0.14, c, ys, -0.09, '#8f949a');
      neon('screen', 0.3, 0.22, 0.02, c, ny0 + 0.52, -0.145); box(0.28, 0.1, 0.08, c, ny0 + 0.18, -0.12, '#2b2f33'); box(0.2, 0.015, 0.03, c, ny0 + 0.34, -0.14, '#111');
      const hc2 = cell(0.6, 0.15, (g, w2, h2) => { g.fillStyle = '#1d6fb8'; g.fillRect(0, 0, w2, h2); ngText(g, 'BANCOMAT', w2 / 2, h2 / 2, w2 * 0.9, h2 * 0.75, NG_FONT.sans, '#fff'); });
      sk(1, 1); sign(hc2, qz(C.sign, c - 0.3, ny1 + 0.06, c + 0.3, ny1 + 0.21, zf + 0.032)); sk(1, 0.6);
    }
    if (shutters && ['glass', 'door', 'slide', 'bay', 'shut'].includes(t)) { // the shutter: guides in the reveal, the box under the lintel, the curtain behind the face of the wall
      const yTopS = t === 'bay' ? yT - 0.4 : yT - 0.3;
      for (const xg of [a + 0.03, b - 0.03]) box(0.05, yTopS - yS, 0.06, xg, (yTopS + yS) / 2, -0.045, '#8a8e93');
      if (t !== 'bay') box(w, 0.3, Dp - 0.03, c, yT - 0.15, -Dp / 2 - 0.02, shutCol);
      curtain(a + 0.055, b - 0.055, yS, yTopS, -0.045);
    }
  }
  if (m.d === 'x') { /* the vacant shop: nothing to see but the shutter */ }

  // ================= far: as the fronts were, flat on the wall
  mode(2);
  for (const [t, a, b] of segs) {
    const w = b - a, c = (a + b) / 2;
    if (t === 'glass') {
      box(w, y0 - gl, 0.1, c, (y0 + gl) / 2, 0.05, stone);
      const n = Math.max(1, Math.round(w / 1.9)), pw = w / n;
      glass(roomF, a + 0.03, y0, b - 0.03, Hv - 0.06, 0.035); for (let i = 1; i < n; i++) box(0.06, Hv - y0, 0.08, a + i * pw, (Hv + y0) / 2, 0.05, kc);
      box(w, 0.05, 0.14, c, y0 + 0.02, 0.07, kc);
    } else if (t === 'door' || t === 'slide') {
      const dh = Math.min(t === 'slide' ? 2.5 : 2.35, Hv - 0.12);
      glass(roomF, a + 0.04, 0.02, b - 0.04, dh, 0.04); box(0.06, dh, 0.09, a + 0.03, dh / 2, 0.05, sc); box(0.06, dh, 0.09, b - 0.03, dh / 2, 0.05, sc); box(w, 0.08, 0.09, c, dh + 0.04, 0.05, sc);
      if (t === 'slide') box(0.03, dh, 0.06, c, dh / 2, 0.06, sc); else box(0.03, 0.55, 0.05, b - 0.16, 1.05, 0.08, hc);
      if (Hv - 0.06 - dh - 0.08 > 0.15) box(w, Hv - 0.06 - dh - 0.08, 0.07, c, (Hv - 0.06 + dh + 0.08) / 2, 0.04, kc);
      box(w + 0.2, 0.12 - gl, 0.4, c, 0.06 + gl / 2, 0.2, '#b8b3a8');
    } else if (t === 'bay') {
      glass({ ...roomF, xa: a, xb: b, yb: Hv - 0.45, dp: 6 }, a, 0.0, b, Hv - 0.45, 0.02);
      box(w + 0.1, 0.34, 0.34, c, Hv - 0.2, 0.17, '#8f949a');
      for (let y = Hv - 0.37, k = 0; k < 6; y -= 0.07, k++) box(w, 0.07, 0.03, c, y - 0.035, 0.05, k % 2 ? '#a9adb2' : '#bfc3c8');
      box(w, 0.04, 0.06, c, Hv - 0.81, 0.06, '#6b6e72'); box(w + 0.1, 0.02 - gl, 0.6, c, (0.02 + gl) / 2, 0.3, '#8a857c');
    } else if (t === 'port') {
      const ph = Math.min(2.7, Hv); box(w, ph, 0.12, c, ph / 2, 0.02, m.k === '#e8e2d0' ? '#2f4a3a' : '#5a3e28');
      for (const sx of [-1, 1]) for (const yy of [0.6, 1.6]) box(w / 2 - 0.2, 0.7, 0.03, c + sx * w / 4, yy, 0.09, m.k === '#e8e2d0' ? '#263d30' : '#4a3220');
      box(0.04, ph, 0.03, c, ph / 2, 0.09, '#2a1f10'); box(0.06, 0.18, 0.06, c + 0.12, 1.1, 0.12, '#c9a85a');
      box(w + 0.3, 0.14 - gl, 0.5, c, 0.07 + gl / 2, 0.25, '#b8b3a8');
    } else if (t === 'atm') {
      box(w, Hv - 0.06 - gl, 0.1, c, (Hv - 0.06 + gl) / 2, 0.05, '#d9d6cf'); neon('screen', 0.34, 0.26, 0.04, c, 1.4, 0.12); box(0.3, 0.2, 0.08, c, 1.08, 0.12, '#2b2f33'); box(0.5, 0.75, 0.04, c, 1.28, 0.105, '#55575b');
      const hc2 = cell(0.8, 0.2, (g, w2, h2) => { g.fillStyle = '#1d6fb8'; g.fillRect(0, 0, w2, h2); ngText(g, 'BANCOMAT', w2 / 2, h2 / 2, w2 * 0.9, h2 * 0.75, NG_FONT.sans, '#fff'); });
      sk(1, 1); sign(hc2, qz(C.sign, c - 0.38, 1.85, c + 0.38, 2.04, 0.105)); sk(1, 0.6);
    }
    if (shutters && ['glass', 'door', 'slide', 'bay', 'shut'].includes(t)) {
      const yTf = t === 'bay' ? Hv - 0.37 : Hv - 0.06;
      if (t !== 'bay') box(b - a, 0.18, 0.16, c, Hv - 0.13, 0.1, shutCol);
      curtain(a, b, 0, yTf, 0.12);
    }
  }
  // ================= both: the vacant shop's notice, the frame, the sign, the awning, what hangs on the wall and stands outside
  if (m.d === 'x') for (const [near, z] of [[1, -0.04], [2, 0.15]]) { mode(near); const pc = cell(0.8, 0.4, (g, w2, h2) => { g.fillStyle = '#f2c230'; g.fillRect(0, 0, w2, h2); ngText(g, 'AFFITTASI', w2 / 2, h2 / 2, w2 * 0.9, h2 * 0.55, NG_FONT.black, '#c8102e'); }); sk(1, 0); sign(pc, qz(C.sign, -0.4, 1.35, 0.4, 1.75, z + 0.008)); sk(1, 0.6); }
  mode(0);
  for (const [t, a, b] of segs) if (t === 'wall') box(b - a, 0.25 - gl, 0.05, (a + b) / 2, (0.25 + gl) / 2, 0.025, '#8a857c');
  // the frame (a street door has its own stone surround)
  if (m.d !== 'p') {
    box(fw, Hv - gl, m.fs === 'portal' ? 0.16 : 0.11, -hw + fw / 2, (Hv + gl) / 2, 0.055, kc); box(fw, Hv - gl, m.fs === 'portal' ? 0.16 : 0.11, hw - fw / 2, (Hv + gl) / 2, 0.055, kc);
    box(W, 0.1, 0.12, 0, Hv - 0.03, 0.06, kc);
  } else for (const [t, a, b] of segs) if (t === 'port') { // the stone round the street door
    const w = b - a, c = (a + b) / 2, ph = Math.min(2.7, Hv);
    box(w + 0.5, 0.25, 0.2, c, ph + 0.12, 0.08, '#b8b3a8'); for (const sx of [-1, 1]) box(0.25, ph - gl, 0.18, c + sx * (w / 2 + 0.12), (ph + gl) / 2, 0.06, '#b8b3a8');
  }
  // the sign: a lightbox has its depth and an aluminium rim round its face; letters stand off the wall (layers 6 mm apart, the back ones darker)
  const sy = Hv + 0.08, scy = sy + sh / 2;
  if (stype === 'pan' || stype === 'cas') {
    const d = stype === 'cas' ? 0.22 : 0.06, sw = W - 0.12; box(sw, sh, d, 0, scy, d / 2 + 0.01, kc);
    if (stype === 'cas') { const rc = '#8f949a'; box(sw, 0.045, 0.035, 0, sy + sh - 0.0225, d + 0.0185, rc); box(sw, 0.045, 0.035, 0, sy + 0.0225, d + 0.0185, rc); for (const sx of [-1, 1]) box(0.055, sh, 0.035, sx * (sw / 2 - 0.0275), scy, d + 0.0185, rc); }
    const c = cell(sw - 0.1, sh - 0.08, (g, w, h) => drawSign(g, w, h, bg, fg, { main, sub, icon: m.icon }));
    sk(1, stype === 'cas' ? 1 : 0.45); sign(c, qz(C.sign, -sw / 2 + 0.05, sy + 0.04, sw / 2 - 0.05, sy + sh - 0.04, d + 0.012)); sk(1, 0.6);
  } else if (stype === 'fas' || stype === 'let') {
    const lw = stype === 'fas' ? W : Math.min(W - 0.2, Math.max(1.6, (main.length * 0.42 + 0.6) * sh));
    const c = cell(lw, sh, (g, w, h) => { if (stype === 'let') g.clearRect(0, 0, w, h); drawSign(g, w, h, stype === 'fas' ? bg : null, bg && stype === 'let' ? bg : fg, { main, sub, icon: m.icon }); });
    if (stype === 'let') { for (let k = 0; k < 7; k++) { sk(k === 6 ? 1 : 0.42, k === 6 ? 0.9 : 0.25); sign(c, qz(C.sign, -lw / 2, sy, lw / 2, sy + sh, 0.035 + k * 0.006)); } }
    else { sk(1, 0.25); sign(c, qz(C.sign, -lw / 2, sy, lw / 2, sy + sh, 0.03)); }
    sk(1, 0.6);
  }
  if (stype === 'tar' || ext.has('targ')) {
    // flat on the facade beside the door, clear of the stone pilaster of a street door (0.25 m wide, 0.12 m off the leaf): the plaque must not sink into it.
    // Off the wall (on the glass) it goes on the glass of the near front
    const gap = m.d === 'p' ? 0.48 : 0.3, dx = doors.length ? doors[0][1] + gap : 0.6, xx = dx + 0.25 > hw + (m.d === 'p' ? 0.4 : 0) ? (doors.length ? doors[0][0] - gap : -0.6) : dx, n = stype === 'tar' ? 2 : 1;
    const onGlass = m.d !== 'p' && xx > x0 && xx < x1;
    for (const [md, z] of onGlass ? [[1, zb + 0.06], [2, 0.11]] : [[0, 0.11]]) {
      mode(md);
      for (let i = 0; i < n; i++) {
        const c = cell(0.42, 0.3, (g, w, h) => { g.fillStyle = bg || '#c9a85a'; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4); ngText(g, i ? s.label : main, w / 2, h * 0.42, w * 0.85, h * 0.3, NG_FONT.serif, fg); if (!i) ngText(g, s.label, w / 2, h * 0.75, w * 0.85, h * 0.16, NG_FONT.sans, fg); });
        sk(1, 0.05); sign(c, qz(C.sign, xx - 0.21, 1.35 - i * 0.36, xx + 0.21, 1.65 - i * 0.36, z)); sk(1, 0.6); box(0.44, 0.32, 0.02, xx, 1.5 - i * 0.36, z - 0.01, '#8a6a3a');
        if (m.d === 'p') for (const [px, py] of [[-0.19, 0.13], [0.19, 0.13], [-0.19, -0.13], [0.19, -0.13]]) box(0.018, 0.018, 0.01, xx + px, 1.5 - i * 0.36 + py, z + 0.004, '#8a6a2a'); // the brass screws
      }
    }
    mode(0);
  }
  if (m.fs === 'portal' && m.d !== 'p' && top > sy + sh + 0.35) { box(W + 0.3, 0.14, 0.24, 0, sy + sh + 0.12, 0.12, kc); for (const sx of [-1, 1]) box(fw, sh + 0.2, 0.16, sx * (hw - fw / 2), sy + sh / 2, 0.08, kc); }
  // the awning on its folding arms out of its box, the valance cut in scallops (or the glass canopy)
  const depth = C.depth(s), aw = m.a;
  if (aw && depth >= 1.1) {
    const D_ = Math.min(aw[0] === 'pen' ? 1.6 : 1.4, depth - 0.35), yT_ = Hv + 0.06, drop = aw[0] === 'pen' ? 0 : 0.42 * D_ / 1.4, val = 0.24, xa = -hw + 0.04, xb = hw - 0.04;
    if (aw[0] === 'pen') { // over the sign when the wall is high enough, so it never hides it
      const yC = stype !== 'none' && stype !== 'tar' && top > sy + sh + 0.9 ? sy + sh + 0.1 : yT_, yR = Math.min(yC + 0.9, top - 0.1);
      box(W - 0.1, 0.07, D_, 0, yC + 0.05, D_ / 2, '#c9d6dc'); box(W - 0.1, 0.12, 0.06, 0, yC + 0.05, D_, kc);
      for (const sx of [-1, 1]) { const g2 = new THREE.CylinderGeometry(0.015, 0.015, 1, 4); const a = new THREE.Vector3(sx * (hw - 0.4), yR, 0.02), b = new THREE.Vector3(sx * (hw - 0.4), yC + 0.08, D_ - 0.05), v = b.clone().sub(a), L = v.length(); g2.translate(0, 0.5, 0).scale(1, L, 1).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()))).translate(a.x, a.y, a.z); F.geo(C.solid, g2, null, COL('#8f949a')); }
    } else {
      const c1 = aw[1], c2 = aw[0] === 'strip' ? aw[2] : shade2(aw[1]), prof = aw[0] === 'cap' ? [0, 0.25, 0.5, 0.75, 1].map(f => [D_ * Math.sin(f * Math.PI / 2), yT_ - drop + (drop + 0.35) * Math.cos(f * Math.PI / 2)]) : [[0.05, yT_], [D_, yT_ - drop]];
      const n = aw[0] === 'strip' ? Math.max(2, Math.round((xb - xa) / 0.32)) : 1, sw2 = (xb - xa) / n;
      for (let i = 0; i < n; i++) { const xA = xa + i * sw2, xB = xA + sw2, col = i % 2 ? c2 : c1; for (let k = 1; k < prof.length; k++) { const [zA, yA] = prof[k - 1], [zB, yB] = prof[k]; faceX(C.solid, [[xA, yA, zA], [xB, yA, zA], [xB, yB, zB], [xA, yB, zB]], 2, COL(col)); } }
      const [zE, yE] = prof[prof.length - 1];
      for (const xs of [xa, xb]) F.face(C.solid, [...prof.map(([z, y]) => [xs, y, z]), [xs, yE - val, zE]], 2, COL(c1));
      if (aw[0] !== 'cap') { // the box it rolls into, the bar at its edge, the arms
        box(W - 0.06, 0.1, 0.17, 0, yT_ - 0.03, 0.09, shade2(c1)); box(xb - xa, 0.05, 0.05, 0, yE - 0.02, zE - 0.025, '#d9d6cf');
        for (const sx of [-1, 1]) { const a = new THREE.Vector3(sx * (hw - 0.35), yT_ - 0.75, 0.03), b = new THREE.Vector3(sx * (hw - 0.35), yE - 0.04, zE - 0.06), v = b.clone().sub(a), L = v.length(); F.geo(C.solid, new THREE.CylinderGeometry(0.022, 0.022, 1, 5).translate(0, 0.5, 0).scale(1, L, 1).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v.normalize()))).translate(a.x, a.y, a.z), null, COL('#c9ccd1')); box(0.06, 0.12, 0.05, sx * (hw - 0.35), yT_ - 0.75, 0.025, '#8f949a'); }
      }
      if (stype === 'ten') { const c = cell(W - 0.1, val, (g, w, h) => drawSign(g, w, h, c1, fg, { main })); sk(1, 0.15); sign(c, qz(C.sign, xa, yE - val, xb, yE, zE + 0.005)); sk(1, 0.6); box(W - 0.08, val, 0.015, 0, yE - val / 2, zE - 0.004, c1); }
      else { // the valance: scallops about 30 cm wide, a stripe each on a striped awning
        const nv = aw[0] === 'strip' ? n : Math.max(2, Math.round((xb - xa) / 0.3)), vw = (xb - xa) / nv;
        for (let i = 0; i < nv; i++) { const xA = xa + i * vw, xB = xA + vw, col = aw[0] === 'strip' ? (i % 2 ? c2 : c1) : c1, P = [[xA, yE, zE], [xB, yE, zE], [xB, yE - val * 0.72, zE]]; for (let k = 1; k < 6; k++) { const f = k / 6; P.push([xB - vw * f, yE - val * (0.72 + 0.28 * Math.sin(f * Math.PI)), zE]); } P.push([xA, yE - val * 0.72, zE]); F.face(C.solid, P, 2, COL(col)); }
      }
    }
  }
  // on the wall
  const hsY = Math.max(Hv + 0.45, 2.75), side = m.d === 'r' ? -1 : 1;
  if (ext.has('ban') && top > hsY + 0.4) {
    const bx = side * (hw - 0.3), c = cell(0.7, 0.7, (g, w, h) => { g.fillStyle = bg || kc; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, w, 4); const words = main.split(' ').slice(0, 3); words.forEach((wd, i) => ngText(g, wd, w / 2, h * (i + 0.5) / words.length, w * 0.86, h * 0.8 / words.length, font, bg ? fg : '#fff')); });
    box(0.12, 0.76, 0.76, bx, hsY, 0.66, kc); box(0.05, 0.05, 0.32, bx, hsY + 0.38, 0.16, '#55575b'); box(0.04, 0.04, 0.3, bx, hsY - 0.25, 0.15, '#55575b');
    sk(1, 1); sign(c, qx(C.sign, 0.31, hsY - 0.35, 1.01, hsY + 0.35, bx + 0.062, 1)); sign(c, qx(C.sign, 0.31, hsY - 0.35, 1.01, hsY + 0.35, bx - 0.062, -1)); sk(1, 0.6);
  }
  if (ext.has('croce') && top > hsY + 0.5) { // the green cross: a grey body with its arms, the green faces lit, a rim of 3 cm round them
    const bx = -side * (hw - 0.3), cz0 = 0.74; box(0.06, 0.06, 0.4, bx, hsY, 0.2, '#55575b'); box(0.14, 0.9, 0.31, bx, hsY, cz0, '#5d6166'); box(0.14, 0.31, 0.9, bx, hsY, cz0, '#5d6166');
    neon('green', 0.152, 0.84, 0.25, bx, hsY, cz0); neon('green', 0.152, 0.25, 0.84, bx, hsY, cz0);
  }
  if (ext.has('T') && (s.sub === 'tobacco' || s.sub === 'lottery') && top > hsY + 0.45) {
    const bx = -side * (hw - 0.25), c = cell(0.55, 0.7, (g, w, h) => { g.fillStyle = '#1d3a8a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(4, 4, w - 8, h - 8); ngText(g, 'T', w / 2, h * 0.55, w * 0.8, h * 0.8, NG_FONT.serif, '#fff'); });
    box(0.1, 0.72, 0.57, bx, hsY, 0.6, '#1d3a8a'); box(0.05, 0.05, 0.32, bx, hsY + 0.36, 0.16, '#55575b');
    sk(1, 1); sign(c, qx(C.sign, 0.325, hsY - 0.35, 0.875, hsY + 0.35, bx + 0.052, 1)); sign(c, qx(C.sign, 0.325, hsY - 0.35, 0.875, hsY + 0.35, bx - 0.052, -1)); sk(1, 0.6);
  }
  if (ext.has('palo')) { const bx = side * (hw - 0.22), cols = ['#c8102e', '#f2f2ee', '#1d4f9a', '#f2f2ee']; for (let i = 0; i < 8; i++) F.geo(C.solid, new THREE.CylinderGeometry(0.09, 0.09, 0.09, 10).translate(bx, 1.75 + i * 0.09, 0.2), null, COL(cols[i % 4])); for (const y of [1.68, 2.5]) F.geo(C.solid, new THREE.SphereGeometry(0.1, 10, 5).translate(bx, y, 0.2), null, COL('#c9ccd1')); box(0.04, 0.04, 0.15, bx, 2.1, 0.08, '#8f949a'); }
  if (ext.has('app')) { const ly = top > sy + sh + 0.45 ? sy + sh + 0.18 : Hv - 0.35; for (const sx of [-1, 1]) { const x = sx * (hw - 0.3); box(0.04, 0.04, 0.35, x, ly + 0.05, 0.17, '#2b2b2b'); neon('warm', 0.16, 0.1, 0.18, x, ly, 0.33); } }
  // in the window: the menu, the neon OPEN (near on the glass set back in the wall, far as before)
  if (ext.has('menu') && doors.length) { const x = doors[0][1] + 0.35 < hw - 0.2 ? doors[0][1] + 0.35 : doors[0][0] - 0.35; for (const [md, z] of [[1, zb + 0.06], [2, 0.07]]) { mode(md); box(0.46, 0.62, 0.06, x, 1.45, z, '#2b2b2b'); neon('warm', 0.38, 0.52, 0.02, x, 1.45, z + 0.035); } mode(0); }
  if (ext.has('neon')) { const g0 = segs.find(q => q[0] === 'glass'); if (g0 && g0[2] - g0[1] > 0.9) { const x = (g0[1] + g0[2]) / 2, c = cell(0.72, 0.24, (g, w, h) => { g.fillStyle = '#120a0a'; g.fillRect(0, 0, w, h); g.shadowColor = '#ff3a3a'; g.shadowBlur = 6; ngText(g, 'APERTO', w / 2, h / 2, w * 0.85, h * 0.7, NG_FONT.script, '#ff5a4a'); g.shadowBlur = 0; });
    sk(1, 1); for (const [md, z] of [[1, zb + 0.04], [2, 0.06]]) { mode(md); sign(c, qz(C.sign, x - 0.36, Hv - 0.62, x + 0.36, Hv - 0.38, z)); } sk(1, 0.6); mode(0); } }
  // the light of an open shop on the pavement at night (NG_POOL): from the wall out to 3 m, as wide as the front and a bit more
  if (m.d !== 'p' && cls !== 'sfitto') {
    const dz = clamp(depth - 0.15, 0.8, 3.2), xa = -hw - 0.4, xb = hw + 0.4, n = Math.max(1, Math.ceil((xb - xa) / 1.5)), pb = C.pool;
    const zs = [0.05, dz / 2, dz], Y = []; for (let j = 0; j <= n; j++) { const x = xa + (xb - xa) * j / n; Y.push(zs.map(z => { const [wx, wz] = lx(x, z); return H.surface(wx, wz) - gy + 0.035; })); }
    for (let j = 0; j < n; j++) for (let r = 0; r < 2; r++) {
      const p = xa + (xb - xa) * j / n, q = xa + (xb - xa) * (j + 1) / n, za = zs[r], zc = zs[r + 1], i0 = pb.p.length / 3;
      for (const [x, z, y] of [[p, za, Y[j][r]], [q, za, Y[j + 1][r]], [q, zc, Y[j + 1][r + 1]], [p, zc, Y[j][r + 1]]]) F.v(pb, x, y, z, 0, 1, 0, (x - xa) / (xb - xa), 1 - z / dz);
      pb.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2);
    }
  }
  // standing on the pavement: worked out once (what stands there stays, even when the tile is built again). Off the asphalt as drawn too
  // (nearAsph: in Meda the carriageways, parking lanes and car parks AC_VEI, wider than the axis band of ngRoad; unione di strade e verde,
  // 24/10: 34 pots, tables and bins of the shops stood on them)
  if (!s.items) {
    s.items = []; const here = [];
    const free = (x, z, r) => {
      const [wx, wz] = lx(x, z); if (z + r > depth - 0.15 || ngRoad(wx, wz, r + 0.3) || nearAsph(wx, wz, r) || inBuilding(wx, wz, r * 0.7) || nearRail(wx, wz, 3) || ngInPark(wx, wz, r + 0.2)) return null;
      if (here.some(([hx, hz, hr]) => hyp(hx - wx, hz - wz) < hr + r + 0.15)) return null;
      let hit = false; WALLS.each(wx - r - 1, wz - r - 1, wx + r + 1, wz + r + 1, q => { if (!hit && q.r && !(q.dyn && !q.on) && hyp(q.x - wx, q.z - wz) < q.r + r + 0.2) hit = true; }); if (hit) return null;
      PROPG.each(wx - 1, wz - 1, wx + 1, wz + 1, p => { if (!hit && hyp(p.x - wx, p.z - wz) < p.r + r + 0.3) hit = true; }); if (hit) return null;
      NG_PG.each(wx - 2, wz - 2, wx + 2, wz + 2, p => { if (!hit && hyp(p[0] - wx, p[1] - wz) < p[2] + r + 0.2) hit = true; }); if (hit) return null;
      return [wx, wz];
    };
    const put = (key, x, z, rot = 0) => { const k = key.split(':')[0], S = NG_PSPEC[k], p = free(x, z, S.r); if (!p) return false; here.push([p[0], p[1], S.r]); NG_PG.add(p[0] - S.r, p[1] - S.r, p[0] + S.r, p[1] + S.r, [p[0], p[1], S.r]); s.items.push({ key, x: p[0], z: p[1], a: Math.atan2(s.nx, s.nz) + rot, knock: true, r: S.r, h: S.h }); return true; };
    const wallX = [], blocked = doors.map(([a, b]) => [a - 0.15, b + 0.15]);
    for (let x = -hw + 0.6; x <= hw - 0.6; x += 0.5) if (!blocked.some(([a, b]) => x > a - 0.4 && x < b + 0.4)) wallX.push(x);
    const want = [...(NG_SUBPROP[s.sub] || []), ...(m.p || []), ...(ext.has('band') ? ['bdr'] : [])], used = [];
    // two pots by the door of some shops (vetrine HQ, approved by Carlo 8/11), where the pavement is wide enough
    if (!want.includes('vas') && NG_VASI.has(cls) && depth >= 2.2 && NG_HASH('vasi|' + s.h0) < 0.35) want.push('vas', 'vas');
    const omb = (m.a && m.a[1]) || bg || '#f2efe6', tav = s.h0 > 0.5 ? 'w' : 'm';
    let row = 0;
    for (const k0 of want) {
      const S = NG_PSPEC[k0], key = k0 === 'omb' ? 'omb:' + omb : k0 === 'tav' ? 'tav:' + tav : k0 === 'bid' ? 'bid:' + (s.cls === 'officina' ? '#c8102e' : '#1d4f9a') : k0 === 'pol' ? 'pol:' + (kc === '#2b2b2b' ? '#6b4f3a' : kc) : k0 === 'bic' ? 'bic:' + ['#c8331f', '#1d4f9a', '#2a7a3a'][used.length % 3] : k0 === 'cas' ? 'cas:' + (used.length % 2 ? 'x' : '') : k0;
      if (k0 === 'tav' || k0 === 'omb' || k0 === 'fio') { // the dehors: a row in front, if the pavement is deep enough
        const z = depth >= 3.4 ? 2.0 : 1.05; if (k0 === 'omb' && depth < 3.6) continue;
        const xs = [-hw * 0.55, hw * 0.55, 0, -hw * 0.85, hw * 0.85].map(x => x + (row % 2 ? 0.3 : 0)); let ok = false;
        for (const x of xs) if (!used.some(u => Math.abs(u[0] - x) < (u[1] + (S.w || 1)) / 2 && u[2] === 'd')) { if (put(key, x, z, k0 === 'tav' ? (s.h0 - 0.5) * 0.6 : 0)) { used.push([x, S.w || 1, 'd']); ok = true; break; } }
        row++; continue;
      }
      if (k0 === 'car' || k0 === 'bdr') { const z = Math.min(depth - (k0 === 'car' ? 0.7 : 0.5), k0 === 'car' ? 1.8 : 3); for (const x of k0 === 'car' ? [hw * 0.6, -hw * 0.6] : [-hw + 0.8, 0, hw - 0.8]) { if (put(key === 'bdr' ? 'bdr:' + ngFlag(bg, fg) : key, x, z, k0 === 'bdr' ? Math.PI / 2 : 0) && k0 === 'car') break; } continue; }
      // against the wall, beside the doors
      const w = S.w || 0.7;
      for (const x of wallX.slice().sort((a, b) => Math.abs(a) - Math.abs(b)).sort((a, b) => (doors.some(([p, q]) => Math.abs(a - p) < 1.2 || Math.abs(a - q) < 1.2) ? 0 : 1) - (doors.some(([p, q]) => Math.abs(b - p) < 1.2 || Math.abs(b - q) < 1.2) ? 0 : 1))) {
        if (x - w / 2 < -hw + 0.1 || x + w / 2 > hw - 0.1 || used.some(u => Math.abs(u[0] - x) < (u[1] + w) / 2 + 0.1 && u[2] === 'w')) continue;
        if (put(key, x, Math.max(0.45, S.r + 0.12), k0 === 'bic' ? Math.PI / 2 : 0)) { used.push([x, w, 'w']); break; }
      }
    }
    // the totem by the kerb, edge-on to the street so drivers read it
    if (ext.has('tot') && depth >= 1.9) {
      for (const x of [-hw + 0.5, hw - 0.5]) { const z = clamp(depth - 0.9, 1.0, 2.4), p = free(x, z, 0.45); if (p) { s.tot = { x, z }; here.push([p[0], p[1], 0.45]); NG_PG.add(p[0] - 0.5, p[1] - 0.5, p[0] + 0.5, p[1] + 0.5, [p[0], p[1], 0.45]); s.items.push({ tot: true, x: p[0], z: p[1], r: 0.45 }); break; } }
    }
  }
  if (s.tot) {
    const { x, z } = s.tot, th = 2.7, c = cell(0.62, 2.0, (g, w, h) => { g.fillStyle = bg || kc; g.fillRect(0, 0, w, h); g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(0, 0, w, 5); const words = main.split(' ').slice(0, 4); words.forEach((wd, i) => ngText(g, wd, w / 2, h * 0.12 + i * h * 0.16, w * 0.88, h * 0.11, font, bg ? fg : '#fff')); ngText(g, s.label, w / 2, h * 0.9, w * 0.88, h * 0.05, NG_FONT.sans, bg ? fg : '#fff'); });
    box(0.25, th, 0.72, x, th / 2, z, kc); box(0.4, 0.12 - gl, 0.85, x, 0.06 + gl / 2, z, '#8a857c');
    sk(1, 0.8); sign(c, qx(C.sign, z - 0.31, th - 2.1, z + 0.31, th - 0.08, x + 0.127, 1)); sign(c, qx(C.sign, z - 0.31, th - 2.1, z + 0.31, th - 0.08, x - 0.127, -1)); sk(1, 0.6);
  }
  for (const it of s.items) if (!it.tot) C.props.push(it); else C.solids.push(it);
}
const NG_VASI = new Set(['bar', 'ristorante', 'gelateria', 'moda', 'farmacia', 'banca', 'bellezza', 'alimentari', 'mobili']);
const shade2 = hex => '#' + new THREE.Color(hex).multiplyScalar(0.78).getHexString();
const ngLum = hex => { const c = new THREE.Color(hex); return 0.3 * c.r + 0.59 * c.g + 0.11 * c.b; };
const ngFlag = (bg, fg) => bg && ngLum(bg) > 0.15 ? bg : fg && ngLum(fg) > 0.15 && ngLum(fg) < 0.9 ? fg : '#c8102e'; // a flag is never black
const NG_PG = new Grid(8); // what the fronts put on the pavement, so neighbours do not stack things
function ngDepth(s) { // free pavement in front: up to the carriageway, a building, the railway
  if (s.depth !== undefined) return s.depth; let best = 8; s.bdist = 9;
  for (const f of [-0.35, 0, 0.35]) { const x0 = s.cx + s.ux * s.w * f, z0 = s.cz + s.uz * s.w * f; for (let t = 0.3; t < best; t += 0.25) { const x = x0 + s.nx * t, z = z0 + s.nz * t; let b = inBuilding(x, z); if (!b) WALLS.each(x - 0.3, z - 0.3, x + 0.3, z + 0.3, q => { if (!b && q.two && segDist(x, z, q.ax, q.az, q.bx, q.bz) < 0.2) b = true; }); if (b) s.bdist = Math.min(s.bdist, t); if (ngRoad(x, z, 0.1) || b || nearRail(x, z, 2.5)) { best = t; break; } } }
  return (s.depth = best);
}
// car parks: nothing of the shops' goes on them (the parked cars would land on the tables)
const NG_PARK = new Grid(24);
function layParcheggi(T) { for (const a of T.d.a || []) if (a.t === 4) { const o = dec(a.p); if (o.length < 3) continue; const bb = bbox(o); NG_PARK.add(bb[0], bb[1], bb[2], bb[3], { o, bb }); } }
const ngInPark = (x, z, r) => { let f = false; NG_PARK.each(x - r, z - r, x + r, z + r, q => { if (!f && x >= q.bb[0] - r && x <= q.bb[2] + r && z >= q.bb[1] - r && z <= q.bb[3] + r && (inPoly(x, z, q.o) || q.o.some(p => hyp(p[0] - x, p[1] - z) < r))) f = true; }); return f; };
// ---- the whole supermarket: clad walls with a band in the chain's colour all round, the name big on it, a glass front with sliding doors under
// a canopy, a loading bay at the back, plant on the roof, a trolley shelter by the door and the pylon by the road
const NG_PANEL = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, map: canvasTex(64, 128, (g, w, h) => {
  g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 32) { g.fillStyle = 'rgba(0,0,0,.16)'; g.fillRect(0, y, w, 2); g.fillStyle = 'rgba(255,255,255,.7)'; g.fillRect(0, y + 2, w, 1); }
  g.fillStyle = 'rgba(0,0,0,.1)'; g.fillRect(0, 0, 2, h); }) });
function ngLogo(g, w, h, name, bg, fg, badge = true) {
  g.fillStyle = bg; g.fillRect(0, 0, w, h); let x0 = 0;
  if (badge && w > h * 2.5) { const s = h * 0.7, x = h * 0.2, y = (h - s) / 2; g.fillStyle = fg; g.beginPath(); g.moveTo(x + s * 0.2, y); g.arcTo(x + s, y, x + s, y + s, s * 0.2); g.arcTo(x + s, y + s, x, y + s, s * 0.2); g.arcTo(x, y + s, x, y, s * 0.2); g.arcTo(x, y, x + s, y, s * 0.2); g.fill(); ngText(g, name[0].toUpperCase(), x + s / 2, y + s * 0.54, s * 0.8, s * 0.8, NG_FONT.black, bg); x0 = h; }
  ngText(g, name.toUpperCase(), (x0 + w) / 2, h * 0.54, (w - x0) * 0.9, h * 0.62, NG_FONT.black, fg);
}
function ngBig(B, C) {
  const S = B.big, f = S.front, pts = B.pts, A = sArea(pts), gys = pts.map(p => H.ground(p[0], p[1])), gmin = Math.min(...gys), gmax = Math.max(...gys), top = B.zt !== undefined ? bldTop(B) : gmax + B.h, bot = gmin - 0.6;
  const v = S.v, wallCol = COL(['#eceae4', '#d9dbdd', '#e3d9c6', '#e8e6e0'][v]), fasc = S.pal[0], fg = S.pal[1], fcol = COL(fasc), fh = [1.4, 1.1, 1.6, 1.25][v], low = COL(v === 3 ? '#3a3d40' : '#5a5c5e');
  const pb = C.panel || (C.panel = Buf()), off = 0.12, n = pts.length;
  const nrm = i => { const a = pts[i], c = pts[(i + 1) % n], L = hyp(c[0] - a[0], c[1] - a[1]) || 1; let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (A < 0) { nx = -nx; nz = -nz; } return [nx, nz, L]; };
  const N_ = pts.map((_, i) => nrm(i)), O = pts.map((p, i) => { // the band stands out of the wall, mitred at the corners
    const [ax, az] = N_[(i - 1 + n) % n], [bx, bz] = N_[i]; let mx = ax + bx, mz = az + bz; const l = hyp(mx, mz) || 1; mx /= l; mz /= l; const k = Math.min(3, 1 / Math.max(0.3, mx * bx + mz * bz)); return [p[0] + mx * off * k, p[1] + mz * off * k]; });
  const wq = (a, c, nx, nz, y0, y1, col, u0, u1) => { const i = pb.p.length / 3; vtx(pb, a[0], y0, a[1], nx, 0, nz, u0, y0 / 2, col); vtx(pb, c[0], y0, c[1], nx, 0, nz, u1, y0 / 2, col); vtx(pb, c[0], y1, c[1], nx, 0, nz, u1, y1 / 2, col); vtx(pb, a[0], y1, a[1], nx, 0, nz, u0, y1 / 2, col); pb.i.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  const hq = (p0, p1, p2, p3, y, ny, col) => { const i = pb.p.length / 3; for (const p of [p0, p1, p2, p3]) vtx(pb, p[0], y, p[1], 0, ny, 0, p[0] / 4, p[1] / 4, col); pb.i.push(i, i + 1, i + 2, i, i + 2, i + 3); };
  let acc = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i], c = pts[(i + 1) % n], [nx, nz, L] = N_[i], u0 = acc / 4, u1 = (acc + L) / 4; acc += L;
    wq(a, c, nx, nz, bot, gmax + 0.9, low, u0, u1); wq(a, c, nx, nz, gmax + 0.9, top - fh, wallCol, u0, u1); wq(a, c, nx, nz, top - fh, top + 0.35, wallCol, u0, u1);
    const oa = O[i], oc = O[(i + 1) % n];
    wq(oa, oc, nx, nz, top - fh, top + 0.35, fcol, u0, u1); hq(a, c, oc, oa, top - fh, -1, fcol); hq(oa, oc, [c[0] - nx * 0.25, c[1] - nz * 0.25], [a[0] - nx * 0.25, a[1] - nz * 0.25], top + 0.35, 1, fcol);
  }
  try { polyFill(C.roof || (C.roof = Buf()), pts, B.holes, top, 10, COL('#8d8a84')); } catch (e) { }
  // plant on the roof
  const F0 = lmFrame(new THREE.Matrix4()), [ccx, ccz] = centroid(pts), R = Math.sqrt(Math.abs(A)) * 0.35;
  for (let k = 0; k < 5; k++) { const x = ccx + (NG_HASH(S.name + k) - 0.5) * R * 2, z = ccz + (NG_HASH(k + S.name) - 0.5) * R * 2; if (!inPoly(x, z, pts) || pts.some((p, i) => segDist(x, z, p[0], p[1], pts[(i + 1) % n][0], pts[(i + 1) % n][1]) < 3)) continue;
    F0.geo(C.solid, lmBox(2.4, 1.2, 1.5, x, top + 0.6, z), null, COL('#c9ccd1')); F0.geo(C.solid, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12).translate(x - 0.55, top + 1.23, z), null, COL('#2b2f33')); F0.geo(C.solid, new THREE.CylinderGeometry(0.45, 0.45, 0.06, 12).translate(x + 0.55, top + 1.23, z), null, COL('#2b2f33')); }
  if (!f) return;
  // the glass front with its doors
  const gy = H.ground(f.cx + f.nx * 0.6, f.cz + f.nz * 0.6), K = ngKit(C, f.cx, gy, f.cz, f.nx, f.nz), topL = top - gy, w = f.w, hw = w / 2, gl = gmin - gy - 0.3;
  const Hg = clamp(topL - fh - 0.9, 3.0, 4.2), doors = w >= 16 ? [-w * 0.22, w * 0.22] : [0], dw = 2.4, th = Math.floor(S.h0 * 6), dark = '#3a3d40';
  K.box(w + 0.2, 0.3 - gl, 0.14, 0, (0.3 + gl) / 2, 0.07, dark); K.box(w + 0.2, 0.25, 0.2, 0, Hg + 0.08, 0.1, dark);
  for (const sx of [-1, 1]) K.box(0.14, Hg - gl, 0.16, sx * (hw + 0.03), (Hg + gl) / 2, 0.08, dark);
  const cuts = [-hw, ...doors.flatMap(d => [d - dw / 2, d + dw / 2]), hw];
  for (let i = 0; i < cuts.length; i += 2) { const a = cuts[i], b = cuts[i + 1], np = Math.max(1, Math.round((b - a) / 1.6)), pw = (b - a) / np; const ci = NG_WIN.ci('supermercato', th), R = { xa: a, xb: b, ya: 0.3, yb: Hg - 0.05, cell: ci, mid: 4, wc: NG_WIN.col[ci][0], fc: NG_WIN.col[ci][1], dp: 6 }; for (let k = 0; k < np; k++) { K.glass(R, a + k * pw + 0.04, 0.3, a + (k + 1) * pw - 0.04, Hg - 0.05, 0.04); K.box(0.08, Hg - 0.3, 0.12, a + k * pw, (Hg + 0.3) / 2, 0.06, dark); } }
  for (const d of doors) { K.box(dw - 0.1, 2.5, 0.04, d, 1.25, 0.05, '#28303a'); K.box(0.05, 2.5, 0.07, d, 1.25, 0.07, '#c9ccd1'); K.box(dw, 0.12, 0.12, d, 2.56, 0.07, dark); K.box(dw - 0.1, Hg - 2.62, 0.04, d, (Hg + 2.62) / 2, 0.05, '#2b3238'); K.box(dw + 1.2, 0.08 - gl, 1.6, d, (0.08 + gl) / 2, 0.8, '#b8b3a8'); }
  // the canopy over the doors, its edge lettered, lights under it
  const depth = ngDepth(f), Dc = clamp(depth - 0.6, 1.8, 4), Wc = Math.min(w + 0.4, doors.length > 1 ? doors[1] - doors[0] + 5 : 6.5), yc = Hg + 0.45, ccol = v % 2 ? fasc : '#e8e6e0';
  K.box(Wc, 0.35, Dc, 0, yc, Dc / 2, ccol); K.box(Wc + 0.04, 0.7, 0.1, 0, yc, Dc, fasc);
  const cl = K.cell(Wc - 0.2, 0.62, (g, W2, H2) => ngLogo(g, W2, H2, S.name, fasc, fg, false)); K.sign(cl, K.qz(C.sign, -Wc / 2 + 0.1, yc - 0.31, Wc / 2 - 0.1, yc + 0.31, Dc + 0.052));
  for (let x = -Wc / 2 + 1; x < Wc / 2 - 0.5; x += 1.6) for (let z = 0.8; z < Dc - 0.3; z += 1.4) K.neon('warm', 0.5, 0.04, 0.5, x, yc - 0.19, z);
  if (yc + 1.9 < topL - fh) for (const sx of [-1, 1]) { const a = new THREE.Vector3(sx * (Wc / 2 - 0.4), yc + 1.9, 0.05), b = new THREE.Vector3(sx * (Wc / 2 - 0.4), yc + 0.15, Dc - 0.1), dv = b.clone().sub(a), Ln = dv.length(); K.F.geo(C.solid, new THREE.CylinderGeometry(0.03, 0.03, 1, 5).translate(0, 0.5, 0).scale(1, Ln, 1).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dv.normalize()))).translate(a.x, a.y, a.z), null, COL('#8f949a')); }
  // the name, big on the band over the front, and again on a long side that looks onto a street
  const logo = (Kk, L0, t0, yTop) => { const lw = Math.min(L0 - 1.5, Math.max(5, (S.name.length * 0.62 + 1.8) * (fh + 0.1))), xc = clamp(0, -t0 + lw / 2 + 0.6, L0 - t0 - lw / 2 - 0.6), c = Kk.cell(lw, fh + 0.15, (g, W2, H2) => ngLogo(g, W2, H2, S.name, fasc, fg)); Kk.sign(c, Kk.qz(C.sign, xc - lw / 2, yTop - fh + 0.1, xc + lw / 2, yTop + 0.25, off + 0.006)); };
  if (f.L > 5) logo(K, f.L, f.t, topL);
  let side = null; for (let i = 0; i < n; i++) { const a = pts[i], c = pts[(i + 1) % n], [nx, nz, L] = N_[i]; if (L < 15 || (Math.abs(a[0] - f.a[0]) < 0.01 && Math.abs(a[1] - f.a[1]) < 0.01) || nx * f.nx + nz * f.nz > 0.7) continue; const mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; if (ngRoad(mx + nx * 12, mz + nz * 12, 6) && (!side || L > side.L)) side = { a, c, mx, mz, nx, nz, L }; }
  if (side) { const g2 = H.ground(side.mx, side.mz), K2 = ngKit(C, side.mx, g2, side.mz, side.nx, side.nz); logo(K2, side.L, side.L / 2, top - g2); }
  // the loading bay round the back
  let back = null; for (let i = 0; i < n; i++) { const a = pts[i], c = pts[(i + 1) % n], [nx, nz, L] = N_[i], mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2; if (L >= 8 && nx * f.nx + nz * f.nz < -0.6 && !inBuilding(mx + nx * 1.5, mz + nz * 1.5) && (!back || L > back.L)) back = { mx, mz, nx, nz, L }; }
  if (back) {
    const g3 = H.ground(back.mx, back.mz), K3 = ngKit(C, back.mx, g3, back.mz, back.nx, back.nz), dh = Math.min(3.3, top - g3 - fh - 0.4);
    for (const x of back.L >= 16 ? [-2.3, 2.3] : [0]) {
      for (let y = 0, k = 0; y < dh; y += 0.12, k++) K3.box(3.0, Math.min(0.12, dh - y), 0.04, x, y + 0.06, 0.04, k % 2 ? '#9da1a6' : '#b4b8bd');
      for (const sx of [-1, 1]) { K3.box(0.25, dh + 0.25, 0.3, x + sx * 1.62, (dh + 0.25) / 2, 0.15, '#1d1d1f'); K3.box(0.28, 0.35, 0.22, x + sx * 1.3, 1.15, 0.12, '#e8b520'); }
      K3.box(3.5, 0.25, 0.3, x, dh + 0.12, 0.15, '#1d1d1f'); K3.box(3.9, 0.12, 1.4, x, dh + 0.5, 0.7, '#8f949a');
    }
  }
  // the trolley shelter by the front and the pylon by the road: chosen once, where it is free (not on the street, not on the car park)
  if (!S.items) {
    S.items = [];
    const freeAt = (x, z, r) => { const [wx, wz] = K.lx(x, z); if (ngRoad(wx, wz, r) || ngInPark(wx, wz, r) || inBuilding(wx, wz, r) || nearRail(wx, wz, 3)) return null; let hit = false; WALLS.each(wx - r - 1, wz - r - 1, wx + r + 1, wz + r + 1, q => { if (!hit && q.r && hyp(q.x - wx, q.z - wz) < q.r + r) hit = true; }); NG_PG.each(wx - 3, wz - 3, wx + 3, wz + 3, p => { if (!hit && hyp(p[0] - wx, p[1] - wz) < p[2] + r) hit = true; }); return hit ? null : [wx, wz]; };
    for (const x of [hw + 3.2, -hw - 3.2, Wc / 2 + 3, -Wc / 2 - 3]) {
      if (x - 2.4 < -f.t + 0.4 || x + 2.4 > f.L - f.t - 0.4) continue;
      const corners = [[-2.3, 0.4], [2.3, 0.4], [-2.3, 2.6], [2.3, 2.6], [0, 1.5]].map(([dx, dz]) => freeAt(x + dx, dz, 0.3));
      if (corners.every(Boolean)) { S.items.push({ k: 'shelter', x, z: 1.5 }); for (const p of corners) NG_PG.add(p[0] - 1.2, p[1] - 1.2, p[0] + 1.2, p[1] + 1.2, [p[0], p[1], 1.2]); break; }
    }
    pylon: for (const s0 of [0, -10, 10, -18, 18]) {
      let prev = null;
      for (let d = 4; d < 45; d += 1) { const [wx, wz] = K.lx(s0, d); if (inBuilding(wx, wz)) break; if (ngRoad(wx, wz, 1.8)) { if (prev) { const p = freeAt(s0, prev, 1.2); if (p) { S.items.push({ k: 'pylon', x: s0, z: prev, wx: p[0], wz: p[1] }); NG_PG.add(p[0] - 1.2, p[1] - 1.2, p[0] + 1.2, p[1] + 1.2, [p[0], p[1], 1.2]); break pylon; } } break; } prev = d - 0.5; }
    }
    S.walls = false;
  }
  for (const it of S.items) {
    if (it.k === 'shelter') {
      const { x, z } = it; for (const [dx, dz] of [[-2.2, -1], [2.2, -1], [-2.2, 1], [2.2, 1]]) K.box(0.1, dz < 0 ? 2.5 : 2.2, 0.1, x + dx, dz < 0 ? 1.25 : 1.1, z + dz, '#8f949a');
      K.F.face(C.solid, [[x - 2.35, 2.55, z - 1.1], [x + 2.35, 2.55, z - 1.1], [x + 2.35, 2.25, z + 1.1], [x - 2.35, 2.25, z + 1.1]], 2, COL(v % 2 ? fasc : '#c9d6dc'));
      K.box(4.6, 0.25, 0.04, x, 2.35, z + 1.12, fasc);
      for (let k = 0; k < 7; k++) { K.box(0.52, 0.5, 0.95, x - 1.8 + k * 0.6, 0.75, z, '#c9ccd1'); K.box(0.5, 0.04, 0.04, x - 1.8 + k * 0.6, 1.0, z + 0.48, fasc); }
      if (!S.walls) for (const dx of [-1.5, 0, 1.5]) { const [wx, wz] = K.lx(x + dx, z); WALLS.add(wx - 1, wz - 1, wx + 1, wz + 1, { r: 0.9, x: wx, z: wz, y0: gy - 3, y1: gy + 3 }); }
    } else {
      const { x, z } = it, py = H.ground(it.wx, it.wz) - gy;
      K.box(0.6, 0.6, 2.2, x, py + 0.3, z, '#8a857c'); K.box(0.45, 6.4, 1.9, x, py + 3.4, z, fasc); K.box(0.5, 0.15, 2.0, x, py + 6.65, z, '#3a3d40');
      const c1 = K.cell(1.8, 1.8, (g, W2, H2) => { g.fillStyle = fasc; g.fillRect(0, 0, W2, H2); g.fillStyle = fg; const s = W2 * 0.5; g.fillRect(W2 / 2 - s / 2, H2 * 0.08, s, s); ngText(g, S.name[0].toUpperCase(), W2 / 2, H2 * 0.08 + s * 0.54, s * 0.8, s * 0.8, NG_FONT.black, fasc); const words = S.name.toUpperCase().split(' ').slice(0, 2); words.forEach((wd, i) => ngText(g, wd, W2 / 2, H2 * (0.7 + i * 0.17), W2 * 0.9, H2 * 0.15, NG_FONT.black, fg)); });
      const c2 = K.cell(1.8, 0.9, (g, W2, H2) => { g.fillStyle = '#f2f2ee'; g.fillRect(0, 0, W2, H2); ngText(g, 'P', W2 * 0.2, H2 / 2, W2 * 0.3, H2 * 0.7, NG_FONT.black, '#1d4f9a'); ngText(g, 'PARCHEGGIO CLIENTI', W2 * 0.62, H2 / 2, W2 * 0.68, H2 * 0.25, NG_FONT.sans, '#1a1a1a'); });
      for (const sg of [1, -1]) { K.sign(c1, K.qx(C.sign, z - 0.9, py + 4.4, z + 0.9, py + 6.3, x + sg * 0.228, sg)); K.sign(c2, K.qx(C.sign, z - 0.9, py + 3.2, z + 0.9, py + 4.1, x + sg * 0.228, sg)); }
      if (!S.walls) WALLS.add(it.wx - 1.2, it.wz - 1.2, it.wx + 1.2, it.wz + 1.2, { r: 1.1, x: it.wx, z: it.wz, y0: gy + py - 3, y1: gy + py + 7 });
    }
  }
  S.walls = true;
}
function* buildNegozi(T, G) { // a generator: the tile builder yields between slices, so a street of shops never stalls a frame
  const list = ngDelTile(T), bigs = T.bld.filter(B => B.big); if (!list.length && !bigs.length) return;
  const C = { solid: Buf(), sign: Buf(), shut: Buf(), plug: Buf(), glassB: Buf(), pool: Buf(), sq: [], cells: [], neon: {}, props: [], solids: [], depth: ngDepth, mode: 0, fc: [0, 0, 1, 0], sk: [1, 0.6], fronts: [], cur: null };
  C.glassB.R = []; C.glassB.W = []; C.glassB.Fc = [];
  T.ngShut = null;
  for (const B of bigs) { const f = B.big.front; ngFill(C); C.mode = 0; C.fc = f ? [f.cx, f.cz, f.nx, f.nz] : [0, 0, 1, 0]; try { ngBig(B, C); } catch (e) { console.warn('supermercato', B.big.name, e); } ngFill(C); yield 'negozi'; }
  if (C.panel) mkMesh(C.panel, NG_PANEL, 10, 'cast', G);
  if (C.roof) mkMesh(C.roof, MAT.roof, 10, 'cast', G);
  let n = 0;
  for (const s of list) { try { ngFront(s, C); } catch (e) { console.warn('negozio', s.name, e); } n++; yield 'negozi'; } /* a front a slice: the fronts HQ are three times what they were */
  ngFill(C);
  yield 'negozi';
  // the meshes: each with its front and version per vertex (ngC, ngL); the inside of the openings before the plugs, the plugs before the walls (renderOrder 8, 9, 10)
  const F32 = (a, k) => new THREE.Float32BufferAttribute(a, k);
  const mk = (b, mat, ro, cast, extra) => { if (!b.i.length) return null; const me = mkMesh(b, mat, ro, cast, G), g = me.geometry; g.setAttribute('ngC', F32(b.cc, 4)); g.setAttribute('ngL', F32(b.L, 1)); if (extra) extra(g, b); me.userData.ng = true; return me; };
  const D = { T, fronts: C.fronts };
  D.solid = mk(C.solid, NG_SOLID, 8, 'cast'); if (D.solid) D.solid.customDepthMaterial = NG_DEPTH;
  D.plug = mk(C.plug, NG_PLUG, 9, false);
  D.glass = mk(C.glassB, NG_WIN.mat.all, 8, false, (g, b) => { g.setAttribute('ngR', F32(b.R, 4)); g.setAttribute('ngW', F32(b.W, 4)); g.setAttribute('ngF', F32(b.Fc, 3)); g.setAttribute('ngOn', F32(b.on, 1)); });
  D.shut = mk(C.shut, NG_SHUT_MAT, 8, false); if (D.shut) D.shut.frustumCulled = false; /* its curtains move: the box of the mesh was measured once */
  D.pool = mk(C.pool, NG_POOL, 11, false, (g, b) => g.setAttribute('ngOn', F32(b.on, 1)));
  for (const k in C.neon) mk(C.neon[k], NG_NEON[k], 8, false);
  yield 'negozi';
  // the signs: one texture per tile, cells packed in shelves 1024 px wide
  if (C.cells.length) {
    /* the cells fill shelves of one texture 4096 px high; if they do not fit, all of them shrink a little (before, the last ones, the wide low signs, stayed blank) */
    const pack = () => { const order = C.cells.slice().sort((a, b) => b.ph - a.ph); let x = 0, y = 0, rh = 0; for (const c of order) { if (x + c.pw > 1024) { x = 0; y += rh + 2; rh = 0; } c.x = x; c.y = y; x += c.pw + 2; rh = Math.max(rh, c.ph); } return y + rh; };
    let need = pack(); for (let k = 0; need > 4096 && k < 12 && !window.NG_NOSHRINK; k++) { for (const c of C.cells) { c.pw = Math.max(16, Math.floor(c.pw * 0.88)); c.ph = Math.max(8, Math.floor(c.ph * 0.88)); } need = pack(); }
    const Hh = Math.min(4096, need), cv = document.createElement('canvas'); cv.width = 1024; cv.height = Hh; const g = cv.getContext('2d');
    const vu = { celle: 0, con_nome: 0 }; for (const c of C.cells) { if (c.y + c.ph > Hh) { vu.celle++; if (c.nm) vu.con_nome++; continue; } g.save(); g.translate(c.x, c.y); g.beginPath(); g.rect(0, 0, c.pw, c.ph); g.clip(); c.draw(g, c.pw, c.ph); g.restore(); }
    (window.NG_VUOTE || (window.NG_VUOTE = {}))[T.t] = vu;
    for (const [i0, c] of C.sq) for (let k = 0; k < 4; k++) { const q = (i0 + k) * 2, u = C.sign.uv[q], v = C.sign.uv[q + 1]; C.sign.uv[q] = (c.x + 0.5 + u * (c.pw - 1)) / 1024; C.sign.uv[q + 1] = 1 - (c.y + 0.5 + (1 - v) * (c.ph - 1)) / Hh; }
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 4;
    const mat = ngSignMat(new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, alphaTest: 0.5, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    SIGN_MATS.push(mat); D.sign = mk(C.sign, mat, 8, 'cast', /* before the plugs too: some signs hang in the opening (the hours, OPEN, the plates on the glass) */ (g, b) => { g.setAttribute('ngS', F32(b.S, 2)); g.setAttribute('ngOn', F32(b.on, 1)); }); if (D.sign) D.sign.customDepthMaterial = ngDepthMap(tex);
    yield 'negozi';
  }
  T.ngShut = D; ngTickTile(T, true);
  if (!T.ngDone) for (const it of C.solids) { const gy = H.ground(it.x, it.z); WALLS.add(it.x - it.r, it.z - it.r, it.x + it.r, it.z + it.r, { r: it.r, x: it.x, z: it.z, y0: gy - 3, y1: gy + 3 }); }
  // the things outside: one instanced mesh per kind, knocked over like the bins and the benches
  const by = {}; C.props.forEach((it, i) => { it.id = it.id ?? i; (by[it.key] = by[it.key] || []).push(it); });
  const o3 = new THREE.Object3D();
  for (const key in by) {
    const items = by[key], im = new THREE.InstancedMesh(ngPropGeo(key), OGG_MAT, items.length); im.castShadow = true; im.receiveShadow = true;
    items.forEach((it, i) => {
      const gy = H.surface(it.x, it.z); o3.position.set(it.x, gy, it.z); o3.rotation.set(0, it.a, 0); o3.scale.set(1, 1, 1); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix);
      if (!it.prop) it.prop = addProp({ x: it.x, z: it.z, y: gy, r: it.r, h: it.h, inst: { meshes: [im], i, ry: it.a, base: gy } });
      else { it.prop.inst.meshes = [im]; it.prop.inst.i = i; if (it.prop.broken) { o3.scale.set(0, 0, 0); o3.updateMatrix(); im.setMatrixAt(i, o3.matrix); } }
    });
    G.add(im);
  }
  T.ngDone = true;
}
