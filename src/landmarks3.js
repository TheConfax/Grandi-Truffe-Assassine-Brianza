// ---------------------------------------------------------------- landmarks (monumenti): hand-made models for a few real buildings, in place of the generic box
// Meda: the Chiesa prepositurale di Santa Maria Nascente (Paolo Mezzanotte, 1939-1956: exposed brick, a giant arch with the Annunciation mosaic,
// a 22.4 m dome on a drum with 20 pink windows, the cross at about 43 m), the Palazzo del Comune in piazza Municipio (1870-1885, three floors,
// plain string courses, wooden eaves) and piazza Vittorio Veneto: Villa Antona Traversi (the Benedictine monastery of San Vittore turned into
// a neoclassical villa by Leopold Pollack), the church of San Vittore with its barocchetto facade and the Santuario del Santo Crocifisso
// (the old parish church, facade of 1893 with protiro and four statues, bell tower finished in 1920); San Pietro Martire on the Seveso border
// (Camillo Fari, consecrated 1969, rhomboid plan in yellow brick with white bands, the entrance tower with its concrete screen and the saint
// in bronze by Giancarlo Fontana on a corbel). Footprints and collisions stay the OSM ones.
// f: the two facade corners; the model's x runs from the second to the first, i.e. left to right for someone facing the facade
const LANDMARKS = [
  { n: 'Chiesa di Santa Maria Nascente', x: 33.3, z: -331.6, f: [64.0, -378.0, 80.0, -362.6], build: buildChiesaMeda },
  { n: 'Municipio di Meda', x: 200.9, z: -532.2, build: buildPalazzo, o: { style: 'municipio', portal: 'door', balcony: 'iron', flags: true, sign: 'M U N I C I P I O' } },
  { n: 'Villa Antona Traversi', x: 112.8, z: -780.5, build: buildPalazzo, o: { style: 'villa', h: 14.5, front: [138.1, -741.3], portal: 'portico', arches: 5, balcony: 'stone', belv: { w: 13, d: 9, h: 3.65 } } },
  { n: 'Chiesa di San Vittore', x: 99.9, z: -755.1, f: [83.9, -763.5, 94.0, -772.2], build: buildSanVittore },
  { n: 'Santuario del Santo Crocefisso', x: 93.3, z: -822.4, f: [89.0, -801.2, 71.6, -815.9], tower: [67.5, -825.0], build: buildCrocifisso },
  { n: 'Chiesa di San Pietro Martire', x: -736.7, z: 466.7, build: buildSanPietroMeda }, // via San Carlo, by the level crossing on the Seveso border
  { n: 'Santi Nazaro e Celso', x: -755.6, z: 199.2, f: [-760.3, 202.5, -760.2, 195.8], build: buildNazaroCelso },
  { n: 'Santuario di San Pietro Martire', x: -737.4, z: 743.4, f: [-761.6, 744.4, -756.9, 724.6], also: [[-758.8, 748.8]], build: buildChiesaNeo, // Seveso, with the seminary; the 41 m tower is its own footprint
    o: { col: '#e3d9c6', trim: '#f3eee4', E: 15, E1: 9.5, UH: 6.5, uw: 5.5, niches: true, tower: { at: [-758.8, 748.8], w: 5.6, h: 32, clock: true, top: 'dome' } } },
  { n: 'Chiesa dei Santi Gervaso e Protaso', x: -1246.5, z: 1553.4, f: [-1276.2, 1558.7, -1275.9, 1546.7], build: buildChiesaNeo,
    o: { col: '#f2f0ea', trim: '#c9c4b8', E: 12, E1: 10, UH: 7, uw: 5.2, rose: true, obelisks: true, tower: { at: [-1263.0, 1567.0], w: 4.5, h: 24, clock: true, top: 'drum' } } },
  { n: 'Chiesa della Beata Vergine Immacolata', x: 881.5, z: 1959.8, f: [878.5, 1942.5, 886.8, 1944.5], build: buildChiesaRom, o: { col: '#e2bf6a', trim: '#efe2c0', E: 11, recess: '#d6b05c' } }, // Baruccana
  { n: 'Chiesa di San Giacomo', x: 1181.3, z: -451.7, f: [1186.7, -433.3, 1163.8, -443.5], len: 29.2, build: buildSanGiacomo },
  { n: 'Cappella di San Pietro da Verona Martire', x: -1707.0, z: 680.5, ry: 0.6, build: buildCappellaSPM },
  { n: 'Villa Bianca', x: -1611.1, z: 936.5, build: buildVillaBianca },
  { n: 'Liceo Marie Curie', x: 1273.1, z: -500.1, build: buildModern, // the H of the Provincia (1988) on via Cialdini: white, ribbon windows; three-floor wings, a two-floor link
    // under a glass vault, an open court on each side of it; the drive from via Marie Curie runs between the school and the gym under two glazed bridges, the name on the first
    o: { wall: '#eeeeea', h: 8.6, floors: 2, wings: [{ pts: [[1238.9, -491.0], [1250.3, -485.7], [1273.3, -535.1], [1262.0, -540.3]], h: 12.4, floors: 3 }, { pts: [[1276.4, -474.5], [1287.5, -469.3], [1310.8, -519.0], [1299.6, -524.2]], h: 12.4, floors: 3 }],
      courts: [[[1258.9, -486.3], [1266.1, -502.5], [1279.7, -496.6], [1272.0, -480.5]], [[1280.8, -531.8], [1274.2, -518.7], [1288.0, -513.3], [1292.7, -525.7]]], spine: [[1273.0, -499.3], [1280.8, -516.1]], planters: [[1269.0, -490.8], [1283.8, -522.5]],
      bridges: [{ a: [1276.3, -548.4], b: [1270.5, -536.1], sign: 'Liceo Marie Curie\nScientifico e Classico' }, { a: [1300.0, -537.7], b: [1293.9, -524.8] }] } },
  { n: 'Scuola primaria "Armando Diaz"', x: -644.2, z: -801.8, build: buildModern, // the long two-floor block on via degli Angeli Custodi, the classrooms stepped out towards the street, skylights all over the dark roof
    o: { wall: '#f0f0ec', h: 7.2, floors: 2, glass: '#3b4652', roof: '#6c6e70', sky: 28 } },
  { n: 'Scuola secondaria di primo grado "Anna Frank"', x: -510.5, z: -815.3, build: buildModern, // white cubes round a lower hall: the gym on the west with the red court, the steps up between
    // the blocks, ribbons of red blinds; the covered walkway from via Papa Giovanni XXIII comes down the slope towards the Diaz
    o: { wall: '#f3f2ee', h: 4.4, floors: 1, glass: '#a9483a', roof: '#d8d5ce', sky: 60,
      base: [[-534.9, -815.6], [-519.3, -824.2], [-503.1, -832.2], [-498.4, -828.9], [-489.9, -812.8], [-493.2, -808.2], [-509.6, -802.2], [-521.2, -798.6], [-528.2, -813.3]],
      wings: [{ pts: [[-558.4, -832.2], [-545.6, -838.0], [-534.4, -815.9], [-547.3, -809.0]], h: 8.6, floors: 2, kind: 'gym' },
        { pts: [[-539.3, -834.6], [-526.8, -840.5], [-519.3, -824.2], [-532.0, -818.3]], h: 8.4, floors: 2 }, { pts: [[-526.8, -840.5], [-510.9, -847.8], [-503.6, -832.8], [-519.3, -824.2]], h: 8.4, floors: 2 },
        { pts: [[-528.2, -813.3], [-504.7, -825.0], [-496.8, -810.4], [-521.2, -798.6]], h: 7.0, floors: 2 },
        { pts: [[-498.9, -828.9], [-483.3, -835.3], [-475.4, -819.0], [-490.3, -812.8]], h: 8.4, floors: 2 }, { pts: [[-483.3, -835.3], [-471.8, -841.5], [-463.4, -824.7], [-475.4, -819.0]], h: 8.4, floors: 2 },
        { pts: [[-509.6, -802.2], [-493.2, -808.2], [-486.6, -792.1], [-503.1, -785.3]], h: 8.4, floors: 2 }, { pts: [[-503.1, -785.3], [-486.6, -792.1], [-481.9, -778.1], [-498.4, -771.0]], h: 8.4, floors: 2 }],
      steps: [{ pts: [[-535.5, -807.6], [-528.7, -810.4], [-523.3, -797.8], [-532.7, -793.6]], n: 8, h: 2.4 }],
      walkway: [[-578.8, -718.1], [-549.3, -727.1], [-544.3, -722.0], [-515.0, -741.3]] } },
  { n: 'Medateca', x: 501.6, z: -451.3, build: buildMedateca, o: { h: 14.9, front: [506.9, -458.5], side: [509.5, -445.5], gate: [520.8, -460.7, 0.919] } }, // the civic library on via Yuri Gagarin
  { n: 'Palazzo delle banche', x: 479.1, z: -438.3, build: buildModern, // on the roundabout: a podium in exposed-aggregate concrete, a ribbon of windows, the bank counters glazed behind round
    // columns; over it the block in reflecting glass; the Auxologico rehabilitation centre has the podium on via Gagarin
    o: { wall: '#a69d8d', glass: '#8fa6bb', roof: '#6d6f71', h: 7.2, floors: 2, portico: true, round: true, ribbon: 0.42, base: [[471.6, -462.3], [488.3, -450.0], [504.2, -438.3], [482.1, -408.6], [449.5, -432.5]],
      wings: [{ inset: 3.0, h: 22.4, floors: 7 }], curtain: true, hvac: 6, signs: [{ at: [484.0, -453.5], text: 'Auxologico Meda Riabilitazione', w: 14, h: 1.0, y: 6.7, bg: '#4a4e52', fg: '#f2f2ee' }] } },
  { n: 'Auxologico Meda', x: 585.6, z: -601.3, build: buildModern, // the low white clinic on via Umberto Pace: terracotta entrances and louvres, a light well, solar panels all over the roof
    o: { wall: '#f1f0ec', glass: '#34414a', roof: '#a8a59f', h: 8.4, floors: 2, punched: true, porch: true, solar: 0.75, hvac: 9,
      wells: [[[548.95, -584.16], [546.45, -585.82], [553.05, -595.84], [555.55, -594.18]]] } },
  { n: 'Residenza di via Gagarin', x: 559.1, z: -544.7, build: buildModern, // the new block by the park: taupe walls, white balconies wrapping round every floor, panels on the roof
    o: { wall: '#8e7e6f', glass: '#3a4148', roof: '#d9d8d4', h: 19.5, floors: 6, balc: true, solar: 0.5, hvac: 2, ribbon: 0.62 } },
  { n: 'Oratorio e Istituto Milani', x: 227.0, z: -327.4, build: buildMilani, o: { // via Generale Cantore: the bar of the oratorio and the Milani's branch in the brick wings
    o: [239.6, -275.7], ua: [0.632, -0.775], ub: [-0.779, -0.628],
    wings: [{ ab: [48, 62, 0, 50], h: 8.2, floors: 2, roof: 'hip', pts: [[269.9, -312.9], [278.8, -323.8], [239.8, -355.1], [231.0, -344.3]] }, { ab: [14, 48, 37, 50], h: 8.0, floors: 2, roof: 'ribbed', pts: [[219.6, -309.8], [241.1, -336.1], [231.0, -344.3], [209.5, -317.9]] }], hall: { ab: [21, 46, 1, 21], h: 9.5 }, canopy: { ab: [0, 15, 0, 50], h: 4.4 },
    trees: [[-16, 6], [-11, 10], [-20, 14], [-17, 26], [-15, 31], [-12, -44], [-25, -42], [-35, -42], [-45, -42], [-55, -42], [-25, 36], [-35, 37], [-45, 37], [-55, 37], [22, -44], [35, -44], [50, -44]], slide: [-12, 11],
    base: [[252.1, -292.6], [267.9, -312.0], [252.3, -324.5], [236.5, -305.2]] } },
  { n: 'Stadio Mino Favini', x: -408.1, z: 378.3, also: [[-418.6, 340.5], [-403.8, 421.8], [-422.9, 394.4]], build: buildStadio, o: { // Meda, the municipal stadium by the SportVillage
    o: [-384, 316], ua: [0.172, 0.985], pitch: [0, 105, 0, 65], curves: [15, 88, 32.5], rin: 36, rout: 43.5, sprint: 126, mats: [[13, -10], [78, -10], [112, 57], [118, 18]], dugouts: [38, 66],
    towers: [[-28, -14], [130, -16], [-28, 82], [128, 84]],
    stands: [{ ab: [35, 80, -42.7, -25.6], h: 9, roof: 3.2, segs: 4 }, { ab: [1.5, 31.5, -40.8, -26.8], h: 4.5, roof: 2.6, segs: 2 }, { ab: [85.5, 115.5, -41.2, -26.6], h: 4.5, roof: 2.6, segs: 2 }] } },
  { n: 'Stadio comunale di Seveso', x: -1826.0, z: 1194.7, build: buildStadio, o: { // on the edge of the Groane woods below via Monte Rosa, from the 3D views: the stand with four raised canopies
    o: [-1809, 1139], ua: [0.2172, 0.9761], pitch: [0, 110, -3, 62], curves: [16.5, 90.5, 28.5], rin: 37.5, rout: 47.5, sprint: 90.5, apron: [10, 50, '#a8503c'], mats: [[114, 32], [118, 45]], dugouts: [41, 61],
    towers: [[-36, -16], [140, -14], [-36, 76], [138, 78]],
    stands: [{ ab: [28, 78, -40, -21], h: 7.5, roof: 3.4, segs: 3 }, { ab: [8, 28, -36, -21], h: 4, roof: 2.4, segs: 1 }, { ab: [78, 100, -36, -21], h: 4, roof: 2.4, segs: 1 }] } },
  { n: 'Scuola primaria e secondaria di primo grado "Pier Giorgio Frassati"', x: -719.0, z: 679.9, build: buildCasa, o: { wall: '#e6d7b8', h: 7.6, floors: 2, metal: '#6a6763', trim: '#d9cdb3', solar: true } }, // Seveso, by the Santuario: beige, panels on the roof
  // the oratorio of San Carlo on the Altopiano (via Sant'Ambrogio and via delle Groane): the church and its wings, light walls under light metal roofs with
  // a teal trim, the little bell gable on the long wing; the court with the fountain, the basket court, the playground
  { n: 'Chiesa di San Carlo Borromeo', x: -1975.4, z: 1550.8, build: buildCasa, o: { wall: '#e4dccb', h: 8.5, floors: 2, metal: '#e2e4e4', trim: '#4f9a8d', bell: [-1976.5, 1542] } },
  { n: 'Oratorio San Carlo', x: -1985.7, z: 1564.9, build: buildCasa, o: { wall: '#e8e2d2', h: 7.0, floors: 2, metal: '#e2e4e4', trim: '#4f9a8d' } },
  { n: 'Oratorio San Carlo, ala nord', x: -1995.6, z: 1532.1, build: buildCasa, o: { wall: '#e8e2d2', h: 7.0, floors: 2, metal: '#e2e4e4', trim: '#4f9a8d' } },
  { n: 'Oratorio San Carlo, salone', x: -1994.3, z: 1524.5, build: buildCasa, o: { wall: '#d9d2c0', h: 6.0, floors: 1, metal: '#d8dada', trim: '#4f9a8d' } },
  { n: 'Oratorio San Carlo, portico', x: -2013.9, z: 1532.1, build: buildCasa, o: { wall: '#d9d2c0', h: 4.5, floors: 1, metal: '#d8dada', trim: '#4f9a8d' } },
  // the oratorio of San Pietro Martire, Seveso (via San Giovanni Bosco): long wings under coppi along the courts, the old block with the dark roof by the street
  { n: 'Oratorio della parrocchia San Pietro Martire', x: -590.9, z: 961.1, build: buildCasa, o: { wall: '#e6dccb', h: 7.2, floors: 2 } },
  { n: 'Oratorio San Pietro Martire, ala sud', x: -600.9, z: 998.6, build: buildCasa, o: { wall: '#e9dfcd', h: 7.6, floors: 2 } },
  { n: 'Oratorio San Pietro Martire, casa vecchia', x: -606.4, z: 1012.5, build: buildCasa, o: { wall: '#cfc6b6', h: 7.6, floors: 2, metal: '#5c574f', trim: '#cfc6b6' } },
  { n: 'Palazzo Buzzi', x: 339.9, z: -446.4, build: buildPalazzo, o: { style: 'buzzi', h: 16.4, front: [344.2, -451.8], balcony: 'stone', balconyW: 9 } }, // ex S.A.L.D.A., Junior B and f.lli Buzzi on the ground floor
  { n: 'Kino', x: 407.0, z: -375.3, build: buildKino, o: { // the bistro at via Indipendenza 34 in the front of the white block
    kino: { front: [[411.3, -381.3], [422.6, -372.7]], d: 9, h: 8.4 }, rest: { pts: [[398.4, -379.3], [401.0, -382.7], [408.2, -377.2], [405.8, -374.1], [417.1, -365.5], [413.1, -359.6], [394.3, -374.0]], h: 12.8, floors: 4, wall: '#efece4', glass: '#3c4248', roof: '#bdbab3', balc: true, ribbon: 0.5 },
    yard: [[413.8, -383.8], [422.9, -373.0], [431.0, -383.6], [424.5, -392.0], [421.5, -393.3]], trees: [[417.5, -383.5], [423.0, -380.0], [427.5, -385.5], [421.0, -388.5]], tables: [[420.0, -385.5], [425.0, -383.0], [423.5, -389.0]], planters: [[415.8, -386.6], [417.6, -389.0], [419.4, -391.3]] } },
  { n: 'Portici di corso della Resistenza', x: 426.4, z: -486.9, build: buildPortici, o: { h: 10.4, floors: 2 } }, // with the Gala ice-cream parlour on the corner of via Pace
  // the towers of the seventies between the Medateca and the railway: bare grey concrete, a balcony slab round every floor
  { n: 'Torre di via Gagarin', x: 518.6, z: -480.3, build: buildModern, o: { wall: '#a8a49b', glass: '#3a3f44', roof: '#8d8a84', h: 28.8, floors: 9, balc: true, ribbon: 0.55, hvac: 2 } },
  { n: 'Torre di via Pace', x: 483.7, z: -491.9, build: buildModern, o: { wall: '#b3afa5', glass: '#3a3f44', roof: '#8d8a84', h: 21.7, floors: 7, balc: true, ribbon: 0.55, hvac: 2 } },
  { n: 'Torre della stazione', x: 470.8, z: -541.8, build: buildModern, o: { wall: '#ddd5c2', glass: '#3a3f44', roof: '#8d8a84', h: 21.0, floors: 7, balc: true, ribbon: 0.55, hvac: 2 } },
  { n: 'Palestra del Curie', x: 1306.5, z: -552.4, build: buildPalestra, o: { h: 10.4, white: true } }, // white, a metal roof, little ochre windows along the bottom
  { n: 'Scuola Statale Primaria San Giorgio', x: 1235.1, z: -398.8, build: buildModern, o: { brick: true, h: 7.6, floors: 2 } }, // Vico Magistretti and Gae Aulenti (1968-74): exposed brick, flat roof
  { n: 'Liceo paritario "Pier Giorgio Frassati"', x: 1152.1, z: 2092.8, build: buildPalazzo, o: { style: 'scuolaocra', h: 9.2, front: [1145.0, 2104.0] } }, // Baruccana, via Colombo: L-shaped, two floors on a basement
  { n: 'Palestra Frassati', x: 1155.1, z: 2049.8, build: buildPalestra, o: { h: 6.8 } }, // the prefabricated gym in red panels
  { n: 'Seminario di Seveso', x: -717.1, z: 837.0, build: buildPalazzo, // Seminario Arcivescovile, now Centro Pastorale Ambrosiano: Quadrio's convent, enlarged by the Pollacks
    o: { style: 'seminario', cloister: true, passages: true, h: 12.7, front: [-780.7, 832.5], portal: 'arch', sign: 'SEMINARIO ARCIVESCOVILE DI MILANO', signW: 8.6, signCol: '#55524b', signY: 8.15, fence: 7, lantern: { at: [-763.0, 818.0], w: 5.6, h: 4.5 } } },
  { n: 'Secondaria I grado “Traversi”', x: 544.4, z: -384.8, build: buildPalazzo, // the Palazzo delle Scuole Professionali (Aldo Vicini, 1932) on via Indipendenza
    o: { style: 'traversi', front: [516.1, -360.2], portal: 'door', balcony: 'stone', porch: true, attic: { w: 15, h: 1.9 }, sign: 'S C V O L E    P R O F E S S I O N A L I', signW: 13, signCol: '#6a655b', fence: 6.5 } },
  { n: 'Stazione di Meda', x: 377.5, z: -540.5, build: buildPalazzo, o: { style: 'stazione', h: 8.8, front: [375.9, -545.1], sign: 'M E D A', signW: 3.2, signCol: '#5f6266', canopy: [[388.6, -548.6], [403.5, -563.2], 7.5] } }, // the 2023 makeover: white, green shutters, the steel-tree canopy
  { n: 'Villa Dho', x: -1619.6, z: 1642.0, build: buildPalazzo, o: { style: 'dho', h: 11, front: [-1600.5, 1643.9], portal: 'portico', arches: 3, ped: { w: 9, h: 2.4 }, belv: { w: 4.6, d: 4.6, h: 6.5, flat: true } } },
  { n: 'Villa Besana', x: 326.2, z: -551.4, build: buildPalazzo, o: { style: 'besana', portal: 'door', balcony: 'stone', balconyW: 11, flat: true } },
  { n: 'Casa Ferrario', x: 475.7, z: -957.0, build: buildPalazzo, o: { style: 'ferrario', h: 8.2, portal: 'door', tower: { at: [479.6, -963.0], w: 4.2, h: 6.0 } } },
];
const LM_GLOW = []; // { m, a, b }: emissive a by day, a + b once the street lamps are on
for (const L of LANDMARKS) {
  for (const T of TILES) for (const b of T.bld) {
    const [cx, cz] = centroid(b.pts); if (hyp(cx - L.x, cz - L.z) < 2) { b.lm = L; L.b = b; L.t = T.t; }
    for (const [ax, az] of L.also || []) if (hyp(cx - ax, cz - az) < 2) b.lm = L; // extra footprints the model replaces, e.g. a bell tower mapped on its own
  }
  const p = D.pois.find(q => q.n === L.n); if (p) p.lm = L; // no generic shop sign on it
}
// collisions follow the model: where a landmark has its own plan (o.base and o.wings) the footprint's walls are swapped for the walls of its volumes;
// everything else it stands on the ground outside them (towers, columns, porches, fences, canopies, steps) is found in its meshes the first time
// it is built, see lmMeshColl
function gridDrop(Gd, x0, z0, x1, z1, pred) { const c = Gd.cs; for (let i = Math.floor(Math.min(x0, x1) / c); i <= Math.floor(Math.max(x0, x1) / c); i++) for (let j = Math.floor(Math.min(z0, z1) / c); j <= Math.floor(Math.max(z0, z1) / c); j++) { const a = Gd.m.get(Gd.k(i, j)); if (a) Gd.m.set(Gd.k(i, j), a.filter(s => !pred(s))); } }
function lmRingWalls(ring, y0, y1) {
  const A = sArea(ring);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], L = hyp(c[0] - a[0], c[1] - a[1]); if (L < 0.05) continue;
    let nx = (c[1] - a[1]) / L, nz = -(c[0] - a[0]) / L; if (A < 0) { nx = -nx; nz = -nz; }
    WALLS.add(a[0], a[1], c[0], c[1], { ax: a[0], az: a[1], bx: c[0], bz: c[1], nx, nz, y0, y1 });
  }
}
for (const L of LANDMARKS) {
  const o = L.o || {}, B = L.b; if (!B) continue;
  const gy = Math.min(...B.pts.map(p => groundH(p[0], p[1])));
  const cl = lmCloister(L);
  if (cl) { // cut the passages through the walls of the footprint, line them with walls of their own; the hedges stop you like a low wall
    for (const ps of cl.passages) for (const [px, pz] of [ps.a, ps.b]) for (const [ring, isHole] of [[B.pts, false], ...B.holes.map(h => [h, true])]) {
      const A = sArea(ring);
      for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.05 || segDist(px, pz, a[0], a[1], c[0], c[1]) > 0.6) continue;
        gridDrop(WALLS, a[0], a[1], c[0], c[1], sg => sg.ax === a[0] && sg.az === a[1] && sg.bx === c[0] && sg.bz === c[1]);
        const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, sp = (px - a[0]) * ex + (pz - a[1]) * ez; let nx = ez, nz = -ex; if ((A < 0) !== isHole) { nx = -nx; nz = -nz; }
        for (const [s0, s1] of [[0, sp - ps.w / 2], [sp + ps.w / 2, Ln]]) if (s1 - s0 > 0.05) { const x0 = a[0] + ex * s0, z0 = a[1] + ez * s0, x1 = a[0] + ex * s1, z1 = a[1] + ez * s1; WALLS.add(x0, z0, x1, z1, { ax: x0, az: z0, bx: x1, bz: z1, nx, nz, y0: gy - 3, y1: gy + 40 }); } }
    }
    for (const ps of cl.passages) for (const sd of [-1, 1]) { const ox = -ps.uz * sd * ps.w / 2, oz = ps.ux * sd * ps.w / 2, x0 = ps.a[0] + ox, z0 = ps.a[1] + oz, x1 = ps.b[0] + ox, z1 = ps.b[1] + oz; WALLS.add(x0, z0, x1, z1, { ax: x0, az: z0, bx: x1, bz: z1, nx: -ps.uz * sd, nz: ps.ux * sd, two: true, y0: gy - 3, y1: gy + 40 }); }
    for (const [x, z] of cl.trees) WALLS.add(x - 0.5, z - 0.5, x + 0.5, z + 0.5, { r: 0.35, x, z, y0: gy - 3, y1: gy + 5 });
    for (const hd of cl.hedges) for (let k = 1; k < hd.length; k++) { const [x0, z0] = hd[k - 1], [x1, z1] = hd[k], L2 = hyp(x1 - x0, z1 - z0); WALLS.add(x0, z0, x1, z1, { ax: x0, az: z0, bx: x1, bz: z1, nx: (z1 - z0) / L2, nz: -(x1 - x0) / L2, two: true, y0: gy - 3, y1: gy + 1.0 }); }
  }
  if (o.base) {
    for (const ring of [B.pts, ...B.holes]) for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length]; gridDrop(WALLS, a[0], a[1], c[0], c[1], s => s.ax === a[0] && s.az === a[1] && s.bx === c[0] && s.bz === c[1]); }
    B.noSign = true; // signs go on the walls of its volumes
    for (const r of [o.base, ...(o.wings || []).map(w => w.pts)].filter(Boolean)) { lmRingWalls(r, gy - 3, gy + 15); const rec = { pts: r, holes: [], bb: bbox(r), lm: L, h: o.h || B.h }; BLD.add(rec.bb[0], rec.bb[1], rec.bb[2], rec.bb[3], rec); }
  }
}
// ---------------------------------------------------------------- piazze: paving drawn over the car park of the map, no stalls, no lamp posts
// Piazza del mercato (piazza Aurelio Dozio, Meda): terracotta paving, a band of grey herringbone round an elongated octagon, a plain terracotta
// rectangle in the middle, grey herringbone across the east end; a row of trees on the west side. p: SW, NW, NE, SE corners
const PIAZZE = [{ n: 'Piazza del mercato', p: [[-450.4, -679.2], [-477.2, -732.9], [-406.4, -768.0], [-378.4, -715.0]], trees: 1 }];
const inPiazza = (x, z) => PIAZZE.some(q => inPoly(x, z, q.p)) || YARDS.some(q => inPoly(x, z, q.p)); // no stalls drawn there
const piazzaTex = canvasTex(1024, 768, (g, w, h) => { // u along SW -> SE... laid out as v: SW->NW (60 m), u: NW->NE (79 m)
  const PINK = '#c58a72', GREY = '#8d8a86';
  g.fillStyle = PINK; g.fillRect(0, 0, w, h); noise(g, w, h, 9000, 0.12, ['#b07460', '#d39c84', '#a8705c']);
  const herring = (clip) => { g.save(); clip(); g.clip(); g.fillStyle = GREY; g.fillRect(0, 0, w, h); g.strokeStyle = 'rgba(60,58,55,.55)'; g.lineWidth = 1.2;
    for (let y = -h; y < 2 * h; y += 9) for (let x = 0; x < w; x += 18) { g.beginPath(); g.moveTo(x, y); g.lineTo(x + 9, y + 9); g.lineTo(x + 18, y); g.stroke(); }
    noise(g, w, h, 6000, 0.15, ['#76736f', '#a3a09b']); g.restore(); };
  const oct = (x0, y0, x1, y1, c) => { g.beginPath(); g.moveTo(x0 + c, y0); g.lineTo(x1 - c, y0); g.lineTo(x1, y0 + c); g.lineTo(x1, y1 - c); g.lineTo(x1 - c, y1); g.lineTo(x0 + c, y1); g.lineTo(x0, y1 - c); g.lineTo(x0, y0 + c); g.closePath(); };
  herring(() => { oct(70, 80, 900, 690, 150); g.rect(990, 0, 34, h); });
  g.save(); g.beginPath(); g.rect(250, 230, 470, 310); g.clip(); g.fillStyle = PINK; g.fillRect(0, 0, w, h); noise(g, w, h, 4000, 0.12, ['#b07460', '#d39c84']);
  g.strokeStyle = 'rgba(90,50,40,.35)'; g.lineWidth = 1; for (let x = 250; x < 720; x += 24) { g.beginPath(); g.moveTo(x, 230); g.lineTo(x, 540); g.stroke(); } for (let y = 230; y < 540; y += 24) { g.beginPath(); g.moveTo(250, y); g.lineTo(720, y); g.stroke(); } g.restore();
  g.strokeStyle = '#e8e2d6'; g.lineWidth = 3; oct(70, 80, 900, 690, 150); g.stroke(); g.strokeRect(250, 230, 470, 310); // white stone kerbs round the patterns
});
// small squares in the parks: a round of beaten gravel, a stone basin in the middle with a pole and its weathervane, curved stone benches in a ring,
// round shrubs on the street side; c, r, benches, shrubs (the angle from the centre they gather around), trees: a row of conifers [[x, z]...]
const PLAZAS = [
  { n: 'Oratorio San Carlo, la fontana', c: [-2010.0, 1552.0], r: 3.0, benches: 0, shrubs: 0, trees: [] },
  { n: 'Parco Fusetti', c: [565.2, -426.1], r: 6.6, benches: 5, shrubs: -0.9, trees: [[500.9, -386.4], [504.2, -390.8], [507.5, -395.2], [510.8, -399.6], [514.1, -404.0], [517.4, -408.4], [520.7, -412.8], [524.0, -417.2], [527.3, -421.6], [530.6, -426.0]] },
];
const nearPlaza = (x, z, m = 2) => PLAZAS.some(q => hyp(x - q.c[0], z - q.c[1]) < q.r + m);
function buildPlazas(T, G) {
  const F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), yb = VBuf(), STONE = COL('#bdb7ab');
  for (const q of PLAZAS) {
    const [cx, cz] = q.c; if (tileOf(cx, cz) !== T.t) continue; const gy = groundH(cx, cz), circ = n => Array.from({ length: n }, (_, i) => [cx + Math.cos(i / n * TAU) * q.r, cz + Math.sin(i / n * TAU) * q.r]);
    try { polyFill(yb, circ(40), [], 0.04, 6, COL('#b6a88e')); } catch (e) { }
    F.geo(Bs.trim, new THREE.CylinderGeometry(1.0, 1.1, 0.45, 20).translate(cx, gy + 0.22, cz), null, STONE); F.geo(Bs.trim, new THREE.CylinderGeometry(0.78, 0.78, 0.05, 20).translate(cx, gy + 0.43, cz), null, COL('#6f8f98'));
    F.geo(Bs.trim, new THREE.CylinderGeometry(0.05, 0.06, 3.4, 6).translate(cx, gy + 1.9, cz), null, COL('#3a3c3e'));
    F.geo(Bs.trim, lmBox(1.1, 0.05, 0.05, cx, gy + 3.6, cz), null, COL('#dcdcd8')); F.geo(Bs.trim, lmBox(0.05, 0.05, 1.1, cx, gy + 3.6, cz).rotateY(0), null, COL('#dcdcd8')); // the vane
    for (let k = 0; k < q.benches; k++) { // each bench three blocks on the arc
      const a0 = k / q.benches * TAU + 0.3;
      for (let j = -1; j <= 1; j++) { const a = a0 + j * 0.14, x = cx + Math.cos(a) * (q.r - 1.2), z = cz + Math.sin(a) * (q.r - 1.2); F.geo(Bs.trim, lmBox(0.75, 0.45, 0.5, 0, 0, 0).rotateY(-a + Math.PI / 2).translate(x, groundH(x, z) + 0.22, z), null, STONE); if (!q.coll) WALLS.add(x - 0.4, z - 0.4, x + 0.4, z + 0.4, { r: 0.35, x, z, y0: gy - 3, y1: gy + 0.5 }); }
    }
    for (let k = 0; k < 6; k++) { const a = q.shrubs + (k - 2.5) * 0.32, d = q.r + 0.6 + (k % 2) * 0.8, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d; F.geo(Bs.trim, new THREE.IcosahedronGeometry(0.75, 0).scale(1, 0.8, 1).translate(x, groundH(x, z) + 0.55, z), null, COL(k % 2 ? '#3f6e34' : '#4b7a3c')); }
    for (const [x, z] of q.trees || []) { const y = groundH(x, z); F.geo(Bs.trim, new THREE.CylinderGeometry(0.15, 0.2, 1.6, 6).translate(x, y + 0.8, z), null, COL('#4f3c2a')); F.geo(Bs.trim, new THREE.ConeGeometry(1.7, 8.5, 7).translate(x, y + 5.6, z), null, COL('#2f5a33')); if (!q.coll) WALLS.add(x - 0.4, z - 0.4, x + 0.4, z + 0.4, { r: 0.3, x, z, y0: y - 3, y1: y + 5 }); }
    if (!q.coll) WALLS.add(cx - 1.2, cz - 1.2, cx + 1.2, cz + 1.2, { r: 1.1, x: cx, z: cz, y0: gy - 3, y1: gy + 0.5 });
    q.coll = true;
  }
  if (yb.i.length) { mkMesh(yb, LMAT.yard, 2, false, G); }
  lmFlush(Bs, G);
}
// school yards: the map paints the whole school ground as one paved area, the game draws it as lawn; these are the hard surfaces seen from above
const YARDS = [
  { p: [[-664.5, -741.4], [-617.3, -742.6], [-603.1, -705.0], [-651.5, -700.3]], col: '#b9b6ae', roads: true }, // the Diaz playground with its road-safety course (mapped as a car park)
  { p: [[-586.1, -831.9], [-578.3, -833.5], [-532.9, -731.6], [-539.3, -729.2]], col: '#9a4a3c', lanes: 4 }, // the running track between the Diaz and the Anna Frank
  { p: [[-580.6, -833.0], [-561.7, -834.2], [-552.3, -807.2], [-566.5, -801.3]], col: '#c0604a', court: true }, // the red court by the Anna Frank gym
  { p: [[231.3, -205.3], [255.9, -235.6], [203.0, -278.3], [178.3, -248.0]], col: '#d8d2c4' }, { p: [[283.4, -266.1], [309.9, -298.6], [279.6, -323.1], [253.0, -290.6]], col: '#cfc6b2' }, // the oratorio's gravel fields
  { p: [[258.1, -235.1], [268.9, -248.3], [241.6, -270.2], [230.9, -257.1]], col: '#4f86c6', court: true }, { p: [[269.5, -249.0], [283.4, -266.1], [256.1, -288.1], [242.2, -271.0]], col: '#9a8370', court: true }, // basket court and the old tennis court
  { p: [[232.7, -300.5], [253.6, -326.1], [241.1, -336.1], [220.3, -310.6]], col: '#bdb8ae' }, // the court of the Milani
  { p: [[-2012, 1500], [-1985, 1500], [-1985, 1518], [-2012, 1518]], col: '#a9aca8', court: true }, // the basket court of the Altopiano oratorio
  { p: [[-598, 948], [-583, 945], [-581, 1000], [-596, 1002]], col: '#c49a86', court: true }, { p: [[-577, 966], [-534, 966], [-532, 1022], [-577, 1024]], col: '#c4bdb0' }, // San Pietro: the courts and the gravel field
  { p: [[538.4, -410.7], [515.6, -380.3], [536.4, -364.7], [559.2, -395.1]], col: '#4f8a6c' }, { p: [[536.2, -401.1], [524.2, -385.1], [535.4, -376.7], [547.4, -392.7]], col: '#b4553f', court: true }, // the Traversi court
  { p: [[1231.0, -555.6], [1236.1, -566.5], [1336.1, -520.5], [1330.6, -508.7]], col: '#a9a8a3' }, // the Curie drive from via Marie Curie, under the bridges
  { p: [[1258.9, -486.3], [1266.1, -502.5], [1279.7, -496.6], [1272.0, -480.5]], col: '#c2bdb2' }, { p: [[1280.8, -531.8], [1274.2, -518.7], [1288.0, -513.3], [1292.7, -525.7]], col: '#c2bdb2' }, // its two courts
];
// park paths drawn from the satellite where the map's are too rough: red gravel strips and triangles of pale paving round a bed of grass
const PARK_PATHS = [ // the park of via Pace (Cesare Tagliabue) between the Medateca towers, the Auxologico and the railway
  { pts: [[480.3, -591.8], [485.2, -578.7], [499.7, -566.6], [520.6, -550.4], [516.5, -533.2], [524.1, -516.1], [558.1, -505.6], [561.9, -501.2]], w: 2.6, col: '#a2533f' },
  { pts: [[499.7, -566.6], [521.5, -568.1], [524.6, -564.2], [520.6, -550.4]], tri: true, w: 3.0, col: '#cdbb9a' },
  { pts: [[516.5, -533.2], [510.6, -516.7], [524.1, -516.1]], tri: true, w: 3.0, col: '#cdbb9a' },
];
function buildPiazze(T, G) {
  const yb = VBuf(), WH = COL('#eeeeea'), strip = (a, b, w, col, y = 0.07) => { const L = hyp(b[0] - a[0], b[1] - a[1]) || 1, nx = -(b[1] - a[1]) / L * w / 2, nz = (b[0] - a[0]) / L * w / 2, i0 = yb.p.length / 3; for (const [x, z] of [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]) vtx(yb, x, y, z, 0, 1, 0, 0, 0, col); yb.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2, i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); };
  for (const q of PARK_PATHS) {
    const [cx, cz] = centroid(q.pts); if (tileOf(cx, cz) !== T.t) continue; const col = COL(q.col), P = q.tri ? [...q.pts, q.pts[0]] : q.pts;
    for (let k = 1; k < P.length; k++) { strip(P[k - 1], P[k], q.w, col, 0.06); const [x, z] = P[k]; for (let i = 0; i < 8; i++) { const a0 = i / 8 * TAU, a1 = (i + 1) / 8 * TAU; const i0 = yb.p.length / 3; vtx(yb, x, 0.06, z, 0, 1, 0, 0, 0, col); vtx(yb, x + Math.cos(a0) * q.w / 2, 0.06, z + Math.sin(a0) * q.w / 2, 0, 1, 0, 0, 0, col); vtx(yb, x + Math.cos(a1) * q.w / 2, 0.06, z + Math.sin(a1) * q.w / 2, 0, 1, 0, 0, 0, col); yb.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 1); } } // round joints
  }
  const line = (a, b, w) => { const L = hyp(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L * w / 2, nz = (b[0] - a[0]) / L * w / 2, i0 = yb.p.length / 3; for (const [x, z] of [[a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], [b[0] - nx, b[1] - nz], [a[0] - nx, a[1] - nz]]) vtx(yb, x, 0.07, z, 0, 1, 0, 0, 0, WH); yb.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2, i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); }; // both windings: seen from above whichever way the line runs
  for (const y of YARDS) {
    const [cx, cz] = centroid(y.p); if (Math.abs(cx - T.cx) > TS / 2 || Math.abs(cz - T.cz) > TS / 2) continue;
    try { polyFill(yb, y.p, [], 0.035, 10, COL(y.col)); } catch (e) { }
    const [p0, p1, p2, p3] = y.p, L2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    if (y.lanes) for (let k = 0; k <= y.lanes; k++) line(L2(p0, p1, k / y.lanes), L2(p3, p2, k / y.lanes), 0.08);
    if (y.roads) { // a roundabout in the middle and four little roads off it, with their stop lines
      const [cx, cz] = centroid(y.p), M = (t, k) => L2(y.p[k], y.p[(k + 1) % 4], t);
      for (let k = 0; k < 24; k++) for (const r of [3.2, 6.0]) { const a0 = k / 24 * TAU, a1 = (k + 1) / 24 * TAU; line([cx + Math.cos(a0) * r, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, cz + Math.sin(a1) * r], 0.12); }
      for (const [a, b] of [[M(0.5, 0), M(0.5, 2)], [M(0.5, 1), M(0.5, 3)]]) for (const sd of [-1.6, 1.6]) { const L = hyp(b[0] - a[0], b[1] - a[1]), nx = -(b[1] - a[1]) / L * sd, nz = (b[0] - a[0]) / L * sd; line([a[0] + nx, a[1] + nz], [b[0] + nx, b[1] + nz], 0.12); }
    }
    if (y.court) { for (let k = 0; k < 4; k++) line(L2(y.p[k], y.p[(k + 1) % 4], 0), L2(y.p[k], y.p[(k + 1) % 4], 1), 0.08); line(L2(p0, p3, 0.5), L2(p1, p2, 0.5), 0.08); }
  }
  if (yb.i.length) { mkMesh(yb, LMAT.yard, 2, false, G); }
  for (const q of PIAZZE) {
    const [sw, nw, ne, se] = q.p, [cx, cz] = centroid(q.p); if (Math.abs(cx - T.cx) > TS / 2 || Math.abs(cz - T.cz) > TS / 2) continue;
    const b = VBuf(), NU = 40, NV = 30, P = (u, v) => [nw[0] + (ne[0] - nw[0]) * u + (sw[0] - nw[0]) * v + ((se[0] - sw[0]) - (ne[0] - nw[0])) * u * v, nw[1] + (ne[1] - nw[1]) * u + (sw[1] - nw[1]) * v + ((se[1] - sw[1]) - (ne[1] - nw[1])) * u * v];
    for (let j = 0; j <= NV; j++) for (let i = 0; i <= NU; i++) { const [x, z] = P(i / NU, j / NV); vtx(b, x, 0.045, z, 0, 1, 0, i / NU, 1 - j / NV); }
    for (let j = 0; j < NV; j++) for (let i = 0; i < NU; i++) { const k = j * (NU + 1) + i; triUp(b, k, k + 1, k + NU + 2); triUp(b, k, k + NU + 2, k + NU + 1); }
    LMAT.piazza = LMAT.piazza || new THREE.MeshLambertMaterial({ map: piazzaTex, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }); mkMesh(b, LMAT.piazza, 1, false, G);
    if (q.trees) { const F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), L = hyp(nw[0] - sw[0], nw[1] - sw[1]); // the row of trees along the west side
      for (let s = 4; s < L - 2; s += 7.5) { const t = s / L, x = sw[0] + (nw[0] - sw[0]) * t - (ne[0] - nw[0]) / 79 * 2, z = sw[1] + (nw[1] - sw[1]) * t - (ne[1] - nw[1]) / 79 * 2, y = groundH(x, z);
        if (!q.coll) WALLS.add(x - 0.4, z - 0.4, x + 0.4, z + 0.4, { r: 0.3, x, z, y0: y - 3, y1: y + 5 }); // the trunk
        F.geo(Bs.trim, new THREE.CylinderGeometry(0.14, 0.2, 3.2, 6).translate(x, y + 1.6, z), null, COL('#5a4632')); F.geo(Bs.trim, new THREE.IcosahedronGeometry(2.0, 0).scale(1, 1.15, 1).translate(x, y + 4.6, z), null, COL(s % 15 < 7.5 ? '#5f8a44' : '#6b9450')); }
      lmFlush(Bs, G); q.coll = true; }
  }
}
// a cloister laid out symmetrically on its court (the footprint's light well): a passage through the building from the middle of each side of the
// court straight out to the street, and the garden as four identical beds round a cross of paths, each with a low hedge along the paths
function lmCloister(L) {
  if (L._cl !== undefined) return L._cl; const B = L.b, o = L.o || {};
  if (!o.cloister || !B || !B.holes.length) return (L._cl = null);
  const q = B.holes.reduce((m, h) => Math.abs(sArea(h)) > Math.abs(sArea(m)) ? h : m), C = lmSimplify(q, 0.5);
  if (C.length !== 4) return (L._cl = null);
  const P = (u, v) => [0, 1].map(k => C[0][k] + (C[1][k] - C[0][k]) * u + (C[3][k] - C[0][k]) * v + (C[0][k] - C[1][k] + C[2][k] - C[3][k]) * u * v);
  const [qx, qz] = centroid(C), passages = [], hedges = [];
  if (o.passages) for (let i = 0; i < 4; i++) {
    const a = C[i], c = C[(i + 1) % 4], m = [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2], Ln = hyp(c[0] - a[0], c[1] - a[1]);
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if ((qx - m[0]) * nx + (qz - m[1]) * nz > 0) { nx = -nx; nz = -nz; } // away from the court
    let best = 1e9; const ring = B.pts;
    for (let j = 0; j < ring.length; j++) { const p0 = ring[j], p1 = ring[(j + 1) % ring.length], ex = p1[0] - p0[0], ez = p1[1] - p0[1], den = nx * ez - nz * ex; if (Math.abs(den) < 1e-9) continue;
      const t = ((p0[0] - m[0]) * ez - (p0[1] - m[1]) * ex) / den, u = ((p0[0] - m[0]) * nz - (p0[1] - m[1]) * nx) / den; if (t > 0.5 && u >= 0 && u <= 1 && t < best) best = t; }
    if (best < 30) passages.push({ a: m, b: [m[0] + nx * best, m[1] + nz * best], ux: nx, uz: nz, w: 3.0, h: 3.6 });
  }
  const bed = [[0.03, 0.46], [0.33, 0.46], [0.46, 0.33], [0.46, 0.03]], lawn = [[0, 0], [0.47, 0], [0.47, 0.335], [0.335, 0.47], [0, 0.47]], beds = []; // one quarter, mirrored into the other three
  const trees = []; for (const [fu, fv] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const M = ([u, v]) => P(fu ? 1 - u : u, fv ? 1 - v : v); hedges.push(bed.map(M)); beds.push(lawn.map(M)); trees.push(M([0.22, 0.22])); } // a tree in the middle of each lawn
  return (L._cl = { court: C, passages, hedges, beds, trees });
}
function buildLandmarks(T, G) {
  for (const L of LANDMARKS) if (L.t === T.t) {
    const n0 = G.children.length; L.build(L, L.b, G); const ms = G.children.slice(n0).filter(m => m.isMesh); for (const m of ms) m.updateMatrixWorld();
    if (!L.coll) { L.coll = true; lmMeshColl(L, ms); }
    drawSigns(signList().filter(s => s.b.lm === L), G, ms); // the shop signs on it, in front of the model
  }
}
// the solid parts of a model outside its footprint, from its own triangles: the upright faces that cross the band a person walks in (0.4 to 1.9 m
// above the ground) are marked on a 0.4 m grid, and every marked cell on the edge of a blob becomes a little round post. Floors, treads and
// landings (meshes flagged walk) are left out, so steps can still be climbed
function lmMeshColl(L, meshes) {
  const C = 0.4, cells = new Map(), key = (i, j) => i * 100000 + j, o = L.o || {};
  const rings = o.base ? [o.base, ...(o.wings || []).map(w => w.pts).filter(Boolean)] : [L.b.pts];
  for (const m of meshes) {
    if (!m.isMesh || m.userData.walk) continue;
    const P = m.geometry.attributes.position.array, I = m.geometry.index ? m.geometry.index.array : null, nT = (I ? I.length : P.length / 3) / 3, v = k => I ? I[k] : k;
    for (let t = 0; t < nT; t++) {
      const a = v(3 * t) * 3, b = v(3 * t + 1) * 3, c = v(3 * t + 2) * 3;
      const ux = P[b] - P[a], uy = P[b + 1] - P[a + 1], uz = P[b + 2] - P[a + 2], wx = P[c] - P[a], wy = P[c + 1] - P[a + 1], wz = P[c + 2] - P[a + 2];
      const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx, nl = Math.hypot(nx, ny, nz); if (nl < 1e-9 || Math.abs(ny) / nl > 0.5) continue; // upright faces only
      const cx = (P[a] + P[b] + P[c]) / 3, cz = (P[a + 2] + P[b + 2] + P[c + 2]) / 3, g = groundH(cx, cz), y0 = Math.min(P[a + 1], P[b + 1], P[c + 1]) - g, y1 = Math.max(P[a + 1], P[b + 1], P[c + 1]) - g;
      if (y1 < 0.4 || y0 > 1.9) continue;
      for (const [p, q] of [[a, b], [b, c], [c, a]]) { const n = Math.ceil(hyp(P[q] - P[p], P[q + 2] - P[p + 2]) / (C / 2)) || 1; for (let k = 0; k <= n; k++) { const x = P[p] + (P[q] - P[p]) * k / n, z = P[p + 2] + (P[q + 2] - P[p + 2]) * k / n; cells.set(key(Math.floor(x / C), Math.floor(z / C)), 1); } }
    }
  }
  const inside = (x, z) => rings.some(r => { if (inPoly(x, z, r)) return true; for (let i = 0; i < r.length; i++) { const p = r[i], q = r[(i + 1) % r.length]; if (segDist(x, z, p[0], p[1], q[0], q[1]) < 0.45) return true; } return false; });
  const W = o.walkway || [], onWalk = (x, z) => W.some((p, k) => k && segDist(x, z, W[k - 1][0], W[k - 1][1], p[0], p[1]) < 0.8); // keep the way through the covered stair clear at its bends
  for (const k of cells.keys()) {
    const i = Math.round(k / 100000), j = k - i * 100000; if (cells.has(key(i - 1, j)) && cells.has(key(i + 1, j)) && cells.has(key(i, j - 1)) && cells.has(key(i, j + 1))) continue;
    const x = (i + 0.5) * C, z = (j + 0.5) * C; if (inside(x, z) || onWalk(x, z)) continue; const g = groundH(x, z);
    WALLS.add(x - 0.3, z - 0.3, x + 0.3, z + 0.3, { r: 0.3, x, z, y0: g - 3, y1: g + 2.2 });
  }
}

const brickTexOf = (mortar, cs, dirt) => canvasTex(256, 256, (g, w, h) => { // 2 m x 2 m of running bond
  g.fillStyle = mortar; g.fillRect(0, 0, w, h);
  for (let r = 0; r < 32; r++) for (let c = -1; c < 8; c++) { g.fillStyle = cs[(rnd() * cs.length) | 0]; g.fillRect(c * 32 + (r % 2) * 16 + 1, r * 8 + 1, 30, 6); }
  noise(g, w, h, 3000, 0.22, dirt);
});
const brickTex = brickTexOf('#b9a58f', ['#9b5a3f', '#a6634a', '#8f5038', '#b06e50', '#94553d', '#a85e44', '#86492f', '#7c4430'], ['#5e3020', '#c98a68', '#6f3a28']);
const buffTex = brickTexOf('#d8cbb2', ['#cdb183', '#c4a676', '#d6bb8e', '#bfa071', '#d0b789', '#c9ab7c'], ['#9c8460', '#e6d6b4', '#a88f68']); // the yellow brick of the sixties
const latticeTex = canvasTex(64, 128, (g, w, h) => { g.fillStyle = '#2c2a2b'; g.fillRect(0, 0, w, h); g.fillStyle = '#e8e2d6'; for (let y = 0; y < h; y += 16) for (let x = 0; x < w; x += 16) { g.fillRect(x, y, 16, 3); g.fillRect(x, y, 3, 16); g.beginPath(); g.arc(x + 9, y + 9, 3, 0, TAU); g.fill(); } }); // concrete screen
const louvreTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#2a2a2c'; g.fillRect(0, 0, w, h); for (let y = 2; y < h; y += 8) { g.fillStyle = '#e4ded2'; g.fillRect(0, y, w, 4); g.fillStyle = '#9a958c'; g.fillRect(0, y + 4, w, 1); } }, false);
const stoneTex = canvasTex(128, 128, (g, w, h) => { // 2 m: slabs of 1 m x 0.5 m
  g.fillStyle = '#d6cfbf'; g.fillRect(0, 0, w, h); noise(g, w, h, 2200, 0.22, ['#b5ad9c', '#ebe6da', '#c4bba8']);
  g.fillStyle = 'rgba(95,85,70,.3)'; for (let r = 0; r < 4; r++) { g.fillRect(0, r * 32, w, 1); for (let c = 0; c < 2; c++) g.fillRect(c * 64 + (r % 2) * 32, r * 32, 1, 32); }
});
const coppiTex = canvasTex(128, 128, (g, w, h) => { // 2 m of coppi running down the slope
  g.fillStyle = '#8e4630'; g.fillRect(0, 0, w, h);
  for (let c = 0; c < 8; c++) { const gr = g.createLinearGradient(c * 16, 0, c * 16 + 16, 0); gr.addColorStop(0, '#7a3a26'); gr.addColorStop(0.5, '#c06a48'); gr.addColorStop(1, '#7f3e2a'); g.fillStyle = gr; g.fillRect(c * 16 + 1, 0, 14, h); }
  g.fillStyle = 'rgba(40,15,8,.35)'; for (let r = 0; r < 4; r++) for (let c = 0; c < 8; c++) g.fillRect(c * 16 + 1, r * 32 + (c % 2) * 16, 14, 2);
  noise(g, w, h, 1200, 0.25, ['#5a2a1a', '#d08060', '#6b4a3a']);
});
// the Annunciation of the lunette (Italo Peresson's workshop): gold tesserae, the angel on the left, Mary on the right, the dove between them
const mosaicTex = canvasTex(512, 280, (g, w, h) => {
  for (let y = 0; y < h; y += 6) for (let x = 0; x < w; x += 6) { const k = rnd(); g.fillStyle = k < 0.5 ? '#c9a043' : k < 0.8 ? '#ddb85a' : k < 0.95 ? '#b48a35' : '#f0d27a'; g.fillRect(x, y, 6, 6); }
  const P = (col, pts) => { g.fillStyle = col; g.beginPath(); g.moveTo(pts[0], pts[1]); for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]); g.closePath(); g.fill(); };
  const halo = (x, y, r) => { g.fillStyle = '#f3dc8c'; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill(); g.strokeStyle = '#8a6420'; g.lineWidth = 3; g.stroke(); };
  g.fillStyle = 'rgba(255,240,190,.55)'; for (let i = 0; i < 9; i++) { const a = 0.5 + i * 0.13; g.save(); g.translate(262, 72); g.rotate(a); g.fillRect(0, -2, 150, 4); g.restore(); } // rays from the dove
  P('#7c1f24', [300, 30, 420, 90, 455, 280, 425, 280, 395, 120]); // curtain behind Mary
  P('#a8323a', [404, 92, 428, 140, 446, 280, 362, 280, 380, 140]); // Mary: red dress, blue mantle
  P('#27457f', [392, 96, 418, 104, 440, 180, 452, 280, 410, 280, 404, 190, 372, 280, 352, 280, 370, 170]);
  halo(398, 84, 22); g.fillStyle = '#e9c9a5'; g.beginPath(); g.arc(398, 86, 13, 0, TAU); g.fill(); P('#27457f', [382, 80, 398, 66, 414, 80, 412, 104, 384, 104]);
  g.fillStyle = '#e9c9a5'; g.fillRect(386, 140, 16, 9);
  P('#e5d3a0', [140, 110, 70, 60, 40, 70, 70, 120, 50, 140, 112, 160, 150, 150]); // the angel: wings, white robe kneeling, arm towards Mary
  P('#b58b3c', [140, 120, 80, 80, 60, 88, 92, 128, 140, 140]);
  P('#f2efe6', [150, 112, 182, 118, 200, 190, 230, 236, 234, 280, 120, 280, 136, 200]);
  P('#e2c6c9', [182, 118, 200, 190, 232, 236, 234, 280, 214, 280, 196, 220, 176, 150]);
  P('#f2efe6', [176, 132, 252, 120, 256, 132, 182, 150]); g.fillStyle = '#e9c9a5'; g.fillRect(250, 118, 12, 12);
  halo(164, 96, 22); g.fillStyle = '#e9c9a5'; g.beginPath(); g.arc(166, 98, 13, 0, TAU); g.fill(); g.fillStyle = '#9a6a30'; g.beginPath(); g.arc(162, 92, 12, Math.PI, TAU); g.fill();
  g.strokeStyle = '#4f7a35'; g.lineWidth = 4; g.beginPath(); g.moveTo(240, 280); g.lineTo(276, 150); g.stroke(); // the lily
  g.fillStyle = '#ffffff'; for (const [x, y] of [[276, 146], [268, 170], [282, 176], [262, 200]]) { g.beginPath(); g.arc(x, y, 7, 0, TAU); g.fill(); }
  P('#ffffff', [262, 60, 290, 66, 300, 58, 296, 74, 268, 80, 240, 66]); // the dove
  g.fillStyle = 'rgba(70,45,15,.28)'; for (let i = 0; i <= w; i += 6) g.fillRect(i, 0, 1, h); for (let i = 0; i <= h; i += 6) g.fillRect(0, i, w, 1); // grout
}, false);
const MUN_H = 12.7; // the facade drawing is laid out for these metres to the eaves and stretched to the real height
const PAL_STYLE = {
  municipio: { wall: '#e3be78', trim: '#efe3c9', shut: '#4f6b4c', plinth: '#aaa397', light: ['#c9a462', '#f0d494'], bugnato: true, ped: true },
  villa: { wall: '#eee5cf', trim: '#fbf8ef', shut: '#5d7a55', plinth: '#c9c1b0', light: ['#d9cfb8', '#f8f2e4'], gShut: true },
  dho: { wall: '#dfbb63', trim: '#f4ead2', shut: '#3f5a3c', plinth: '#b9b09c', light: ['#c9a654', '#ecd08a'], gShut: true },
  besana: { wall: '#d8c391', trim: '#c4bfb2', shut: '#9c978c', plinth: '#a9a397', light: ['#bfa977', '#e6d4a4'], gShut: true, ped: true },
  traversi: { wall: '#d3d2cc', trim: '#e9e8e3', shut: '#ddd8cc', plinth: '#b8b2a5', light: ['#cfcabd', '#eeeae2'], H: 11.1, floors: 2, noShut: true, blinds: true, lesene: true, archedUp: true },
  scuolaocra: { wall: '#d4922c', trim: '#e6eae6', shut: '#d4922c', plinth: '#b38a4a', light: ['#c4852a', '#e0a23e'], H: 9.2, floors: 2, noShut: true, tapp: 0.55, basement: true },
  seminario: { wall: '#ece5d4', trim: '#f7f3ea', shut: '#ece5d4', plinth: '#b9b4a8', light: ['#ddd4c0', '#f6f0e2'], noShut: true },
  stazione: { wall: '#f1efe9', trim: '#dedad1', shut: '#2f5a3a', plinth: '#9d9b96', light: ['#dcd9d2', '#ffffff'], H: 8.8, floors: 2, arched: true },
  buzzi: { wall: '#d9d8d3', trim: '#efeeea', shut: '#9a9890', plinth: '#b9b6ae', light: ['#c9c8c2', '#ecebe6'], H: 16.4, floors: 4, gShut: false, shops: true, ornate: true },
  ferrario: { wall: '#c23b2a', trim: '#e2b25a', shut: '#c23b2a', plinth: '#d9cfc0', light: ['#a83324', '#d4513c'], noShut: true },
};
const palTex = (st, lit) => canvasTex(128, 512, (g, w, h) => { // one bay, pavement to eaves; lit: the emissive map (lit windows only)
  const HH = st.H || MUN_H, Y = m => h - m / HH * h, R = (x0, m0, x1, m1, col) => { g.fillStyle = col; g.fillRect(x0, Y(m1), x1 - x0, Y(m0) - Y(m1)); };
  const CREAM = st.trim, GLASS = st.blinds ? '#7d7a73' : '#2b3038';
  if (lit) { R(0, 0, w, HH, '#000'); R(46, 5.45, 82, 7.75, '#ffd890'); return; } // at night only the piano nobile
  R(0, 0, w, HH, st.wall); noise(g, w, h, 2500, 0.12, st.light);
  R(0, 0, w, 0.5, st.plinth); // stone plinth
  if (st.bugnato) for (let m = 1.2; m < 4.4; m += 0.5) { R(0, m - 0.04, w, m, 'rgba(110,75,35,.45)'); R(0, m, w, m + 0.03, 'rgba(255,240,200,.35)'); }
  R(0, 4.36, w, 4.4, 'rgba(0,0,0,.2)'); R(0, 4.4, w, 4.8, CREAM); R(0, 8.76, w, 8.8, 'rgba(0,0,0,.2)'); if (st.floors !== 2) R(0, 8.8, w, 9.05, CREAM); R(0, HH - 0.6, w, HH, CREAM); R(0, HH - 0.64, w, HH - 0.6, 'rgba(0,0,0,.2)');
  const blinds = (x0, m0, x1, m1) => { if (st.blinds) for (let m = m0 + 0.1; m < m1; m += 0.14) R(x0, m, x1, m + 0.04, 'rgba(255,255,255,.22)'); };
  const win = (x0, m0, x1, m1, bars) => { R(x0 - 4, m0 - 0.15, x1 + 4, m1 + 0.15, CREAM); R(x0, m0, x1, m1, GLASS); blinds(x0, m0, x1, m1); if (st.tapp) { const mt = m1 - (m1 - m0) * st.tapp; R(x0, mt, x1, m1, '#d8cdb4'); for (let m = mt + 0.06; m < m1; m += 0.09) R(x0, m, x1, m + 0.02, 'rgba(0,0,0,.12)'); } /* roller blinds half down */ if (!st.blinds) { R(62, m0, 66, m1, CREAM); R(x0, (m0 + m1) / 2 + 0.3, x1, (m0 + m1) / 2 + 0.36, CREAM); } if (bars) for (let x = x0 + 4; x < x1; x += 7) R(x, m0, x + 1.5, m1, '#15171a'); };
  const archWin = (x0, m0, x1, m1) => { const r = (x1 - x0) / 2, cx = (x0 + x1) / 2, top = Y(m1) + r; g.fillStyle = CREAM; g.fillRect(x0 - 4, top, x1 - x0 + 8, Y(m0 - 0.15) - top); g.beginPath(); g.arc(cx, top, r + 4, Math.PI, 0); g.fill(); g.fillStyle = GLASS; g.fillRect(x0, top, x1 - x0, Y(m0) - top); g.beginPath(); g.arc(cx, top, r, Math.PI, 0); g.fill(); blinds(x0, m0, x1, m1 - r * HH / h); };
  if (st.lesene) for (const x of [0, w - 10]) { R(x, 0.5, x + 10, HH - 0.6, CREAM); R(x ? x : 9, 0.5, (x ? x : 9) + 1, HH - 0.6, 'rgba(0,0,0,.14)'); } // giant pilasters between the bays
  const shutters = (m0, m1) => { if (st.noShut) return; for (const x of [18, 88]) { R(x, m0, x + 22, m1, st.shut); for (let m = m0 + 0.08; m < m1; m += 0.12) R(x + 2, m, x + 20, m + 0.04, 'rgba(0,0,0,.25)'); } };
  if (st.shops) { R(22, 0.35, 106, 3.9, '#3a2e26'); R(27, 0.45, 101, 3.0, '#2b3038'); R(27, 3.1, 101, 3.75, '#4a3a30'); R(62, 0.45, 66, 3.0, '#3a2e26'); } // a shop window under its fascia
  else if (st.gShut) shutters(1.3, 3.5); if (!st.shops) win(46, 1.3, 82, 3.5, !st.gShut); if (st.bugnato) R(58, 3.65, 70, 3.95, CREAM); // ground floor: grated with a keystone, or shuttered
  if (st.basement) for (const x of [40, 70]) R(x, 0.12, x + 18, 0.5, '#3a3a38'); /* the little basement windows */
  shutters(5.45, 7.75); if (st.archedUp) archWin(44, 5.45, 84, 8.3); else win(46, 5.45, 82, 7.75); R(36, 5.1, 92, 5.3, '#e6d8bb'); R(34, 7.95, 94, 8.1, CREAM); // piano nobile: sill and cornice, a pediment on the municipio
  if (st.ped) { g.fillStyle = CREAM; g.beginPath(); g.moveTo(34, Y(8.1)); g.lineTo(94, Y(8.1)); g.lineTo(64, Y(8.62)); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(34, Y(8.1), 60, 2); }
  if (st.floors !== 2) { shutters(9.75, 11.45); win(46, 9.75, 82, 11.45); R(40, 9.5, 88, 9.62, '#e6d8bb'); }
  if (st.floors === 4) { R(0, 12.3, w, 12.55, CREAM); shutters(13.1, 14.8); win(46, 13.1, 82, 14.8); R(40, 12.85, 88, 12.97, '#e6d8bb'); }
  if (st.ornate) { // the eclectic dress: a little pediment or a cornice over every upper window, a balustrade under the piano nobile, brackets under the eaves
    const ped = m => { g.fillStyle = CREAM; g.beginPath(); g.moveTo(38, Y(m)); g.lineTo(90, Y(m)); g.lineTo(64, Y(m + 0.55)); g.closePath(); g.fill(); g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(38, Y(m), 52, 2); };
    ped(7.95); R(36, 11.6, 92, 11.85, CREAM); if (st.floors === 4) ped(14.95);
    R(30, 4.8, 98, 5.35, CREAM); for (let x = 33; x < 96; x += 6) R(x, 4.85, x + 3, 5.3, 'rgba(0,0,0,.22)');
    for (let x = 6; x < w; x += 20) R(x, HH - 1.0, x + 6, HH - 0.6, CREAM);
  }
  if (st.arched) { R(44, 1.0, 84, 3.6, st.wall); g.fillStyle = CREAM; g.beginPath(); g.moveTo(44, Y(0.1)); g.lineTo(44, Y(2.9)); g.arc(64, Y(2.9), 20, Math.PI, 0); g.lineTo(84, Y(0.1)); g.fill(); R(48, 0.1, 80, 2.9, '#2b3a33'); g.fillStyle = '#2b3a33'; g.beginPath(); g.arc(64, Y(2.9), 16, Math.PI, 0); g.fill(); } // arched doors on the ground floor
});
const plasterTex = canvasTex(128, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h); noise(g, w, h, 2600, 0.16, ['#d8d8d8', '#c8c8c8', '#f0f0f0']); }); // tinted by vertex colour
const tondoTex = canvasTex(128, 128, (g, w, h) => { // San Vittore on his rearing horse, the relief over the portal
  g.fillStyle = '#cbbfa6'; g.fillRect(0, 0, w, h); noise(g, w, h, 700, 0.2, ['#a99d86', '#e0d6c2']);
  g.fillStyle = '#8f846f'; g.beginPath(); g.ellipse(62, 76, 30, 14, -0.5, 0, TAU); g.fill(); g.fillRect(36, 84, 6, 26); g.fillRect(76, 60, 6, 26); g.fillRect(56, 88, 6, 24);
  g.beginPath(); g.ellipse(92, 46, 9, 15, 0.6, 0, TAU); g.fill(); g.beginPath(); g.ellipse(58, 50, 9, 16, 0, 0, TAU); g.fill(); g.beginPath(); g.arc(58, 30, 7, 0, TAU); g.fill(); g.fillRect(64, 20, 3, 34);
  g.strokeStyle = '#6f6655'; g.lineWidth = 6; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.stroke();
}, false);
const clockTex = canvasTex(128, 128, (g, w, h) => {
  g.fillStyle = '#f4f1ea'; g.beginPath(); g.arc(64, 64, 62, 0, TAU); g.fill(); g.fillStyle = '#1d1d1f';
  for (let i = 0; i < 12; i++) { const a = i / 12 * TAU; g.save(); g.translate(64 + Math.sin(a) * 50, 64 - Math.cos(a) * 50); g.rotate(a); g.fillRect(-2, -7, 4, 14); g.restore(); }
  g.lineWidth = 5; g.strokeStyle = '#1d1d1f'; g.beginPath(); g.moveTo(64, 64); g.lineTo(64 + 28, 64 - 14); g.moveTo(64, 64); g.lineTo(64 - 6, 64 - 44); g.stroke();
}, false);
const LMAT = {
  brick: new THREE.MeshLambertMaterial({ map: brickTex, side: THREE.DoubleSide }), stone: new THREE.MeshLambertMaterial({ map: stoneTex, side: THREE.DoubleSide }),
  sand: new THREE.MeshLambertMaterial({ map: stoneTex, color: 0xcbbfa6, side: THREE.DoubleSide }), plaster: new THREE.MeshLambertMaterial({ map: plasterTex, vertexColors: true, side: THREE.DoubleSide }),
  buff: new THREE.MeshLambertMaterial({ map: buffTex, side: THREE.DoubleSide }), louvre: new THREE.MeshLambertMaterial({ map: louvreTex, side: THREE.DoubleSide }),
  lattice: new THREE.MeshLambertMaterial({ map: latticeTex, emissiveMap: latticeTex, emissive: 0xffc77a, emissiveIntensity: 0, side: THREE.DoubleSide }),
  coppi: new THREE.MeshLambertMaterial({ map: coppiTex, side: THREE.DoubleSide }), trim: new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }),
  glass: new THREE.MeshLambertMaterial({ color: 0x3b3340, emissive: 0xffa6c0, emissiveIntensity: 0.06, side: THREE.DoubleSide }),
  warm: new THREE.MeshLambertMaterial({ color: 0x2f3036, emissive: 0xffc77a, emissiveIntensity: 0, side: THREE.DoubleSide }), // plain church windows, lit from inside at night
  mosaic: new THREE.MeshLambertMaterial({ map: mosaicTex, emissiveMap: mosaicTex, emissive: 0xffffff, emissiveIntensity: 0.1, side: THREE.DoubleSide }),
  tondo: new THREE.MeshLambertMaterial({ map: tondoTex }), clock: new THREE.MeshLambertMaterial({ map: clockTex, emissiveMap: clockTex, emissive: 0xfff2d0, emissiveIntensity: 0, side: THREE.DoubleSide }),
};
// painted ground (yards, courts, lawns, park paths, the stadiums): flat like the land use under it, never writing depth, so the roads drawn after it
// (renderOrder 5) always come out on top and nothing pokes through the asphalt
LMAT.yard = new THREE.MeshLambertMaterial({ vertexColors: true, depthWrite: false });
for (const k in PAL_STYLE) { const t = palTex(PAL_STYLE[k], false), e = palTex(PAL_STYLE[k], true); t.wrapT = e.wrapT = THREE.ClampToEdgeWrapping; LMAT[k] = new THREE.MeshLambertMaterial({ map: t, emissiveMap: e, emissive: 0xffc870, emissiveIntensity: 0 }); LM_GLOW.push({ m: LMAT[k], a: 0, b: 0.3 }); }
LM_GLOW.push({ m: LMAT.lattice, a: 0, b: 0.5 }, { m: LMAT.glass, a: 0.06, b: 0.9 }, { m: LMAT.warm, a: 0, b: 0.8 }, { m: LMAT.mosaic, a: 0.1, b: 0.4 }, { m: LMAT.clock, a: 0, b: 0.6 });

// local frame helpers: everything is modelled in metres around (0,0,0) and moved into place by M while it goes into the buffers
function lmFrame(M) {
  const nm = new THREE.Matrix3().getNormalMatrix(M), v = new THREE.Vector3(), n = new THREE.Vector3();
  const put = (b, x, y, z, nx, ny, nz, u, w, col) => { v.set(x, y, z).applyMatrix4(M); n.set(nx, ny, nz).applyMatrix3(nm).normalize(); vtx(b, v.x, v.y, v.z, n.x, n.y, n.z, u, w, col); };
  return {
    v: put, // one vertex in local coordinates
    face(b, pts, S = 2, col) { // planar polygon [[x,y,z]...]; uv in metres / S along its level and up-slope axes
      let nx = 0, ny = 0, nz = 0;
      for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; nx += (p[1] - q[1]) * (p[2] + q[2]); ny += (p[2] - q[2]) * (p[0] + q[0]); nz += (p[0] - q[0]) * (p[1] + q[1]); }
      const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
      let ax = nz, az = -nx; const al = hyp(ax, az); if (al < 1e-3) { ax = 1; az = 0; } else { ax /= al; az /= al; }
      const bx = ny * az, by = nz * ax - nx * az, bz = -ny * ax, base = b.p.length / 3;
      const flat = pts.map(p => new THREE.Vector2(p[0] * ax + p[2] * az, p[0] * bx + p[1] * by + p[2] * bz));
      for (let i = 0; i < pts.length; i++) put(b, pts[i][0], pts[i][1], pts[i][2], nx, ny, nz, flat[i].x / S, flat[i].y / S, col);
      const tris = THREE.ShapeUtils.triangulateShape(flat, []), cw = THREE.ShapeUtils.isClockWise(flat);
      for (const t of tris) if (cw) b.i.push(base + t[0], base + t[2], base + t[1]); else b.i.push(base + t[0], base + t[1], base + t[2]);
    },
    geo(b, g, uvf, col) { // any THREE geometry already placed in the local frame; uvf(p, n, uv) -> [u, v], else its own uv
      const pos = g.attributes.position, nor = g.attributes.normal, uv = g.attributes.uv, base = b.p.length / 3, p = new THREE.Vector3(), q = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) { p.fromBufferAttribute(pos, i); q.fromBufferAttribute(nor, i); const t0 = uv ? [uv.getX(i), uv.getY(i)] : [0, 0], t = uvf ? uvf(p, q, t0) : t0; put(b, p.x, p.y, p.z, q.x, q.y, q.z, t[0], t[1], col); }
      if (g.index) for (let i = 0; i < g.index.count; i++) b.i.push(base + g.index.getX(i)); else for (let i = 0; i < pos.count; i++) b.i.push(base + i);
      g.dispose();
    },
  };
}
const boxUV = S => (p, n) => Math.abs(n.y) > 0.7 ? [p.x / S, p.z / S] : Math.abs(n.x) > Math.abs(n.z) ? [p.z / S, p.y / S] : [p.x / S, p.y / S];
const wrapUV = (S, len, vlen) => (p, n, t) => [t[0] * len / S, vlen ? t[1] * vlen / S : p.y / S]; // cylinders, cones, domes: their own uv stretched to metres
const lmBox = (w, h, d, x, y, z, ry = 0) => new THREE.BoxGeometry(w, h, d).rotateY(ry).translate(x, y, z);
function archShape(w, y0, y1) { const s = new THREE.Shape(), r = w / 2; s.moveTo(-r, y0); s.lineTo(r, y0); s.lineTo(r, y1 - r); s.absarc(0, y1 - r, r, 0, Math.PI, false); s.lineTo(-r, y0); return s; }
// an arched window on a wall: frame and glass, facing the local direction ry (0 = +z), at (x, z) on the wall face; o: { frame, glass, col } buffers and frame colour
function lmWindow(F, Bs, w, y0, y1, x, z, ry, out = 0.03, o = {}) {
  const fr = new THREE.ShapeGeometry(archShape(w + 0.36, y0 - 0.18, y1 + 0.18), 12).translate(0, 0, out).rotateY(ry).translate(x, 0, z);
  const gl = new THREE.ShapeGeometry(archShape(w, y0, y1), 12).translate(0, 0, out + 0.03).rotateY(ry).translate(x, 0, z);
  F.geo(Bs[o.frame || 'stone'], fr, o.col ? null : boxUV(2), o.col); F.geo(Bs[o.glass || 'glass'], gl);
}
// church frame from L.f: x across the facade, +z out of it towards the square, y up from the pavement in front
function lmChurchFrame(L) {
  const [ax, az, bx, bz] = L.f, cx = (ax + bx) / 2, cz = (az + bz) / 2, W = hyp(bx - ax, bz - az), ux = (bz - az) / W, uz = -(bx - ax) / W, ry = Math.atan2(ux, uz);
  const M = new THREE.Matrix4().makeRotationY(ry).setPosition(cx, groundH(cx + ux * 2, cz + uz * 2), cz);
  return { M, F: lmFrame(M), W2: W / 2, ry };
}
function lmStatue(F, b, x, y, z, s, col) { // a stone saint on a plinth: robe, shoulders, arms folded forward, head
  F.geo(b, lmBox(0.7 * s, 0.35 * s, 0.6 * s, x, y + 0.175 * s, z), null, col);
  F.geo(b, new THREE.CylinderGeometry(0.17 * s, 0.32 * s, 1.35 * s, 8).translate(x, y + 1.025 * s, z), null, col);
  F.geo(b, new THREE.SphereGeometry(0.2 * s, 8, 6).scale(1.5, 0.75, 0.9).translate(x, y + 1.68 * s, z), null, col);
  for (const sd of [-1, 1]) F.geo(b, new THREE.CylinderGeometry(0.06 * s, 0.07 * s, 0.62 * s, 6).rotateX(-0.5).rotateZ(sd * 0.35).translate(x + sd * 0.19 * s, y + 1.4 * s, z + 0.12 * s), null, col);
  F.geo(b, new THREE.SphereGeometry(0.13 * s, 8, 6).translate(x, y + 1.93 * s, z), null, col);
}
const URN = [[0, 0], [0.25, 0], [0.25, 0.15], [0.12, 0.25], [0.3, 0.6], [0.28, 0.85], [0.1, 1.0], [0.06, 1.15], [0.14, 1.3], [0, 1.45]];
function lmUrn(F, b, x, y, z, s, col) { F.geo(b, new THREE.LatheGeometry(URN.map(([r, h]) => new THREE.Vector2(r * s, h * s)), 10).translate(x, y, z), null, col); }
function lmCross(F, b, x, y, z, s, col) { F.geo(b, lmBox(0.12 * s, 1.4 * s, 0.12 * s, x, y + 0.7 * s, z), null, col); F.geo(b, lmBox(0.8 * s, 0.12 * s, 0.12 * s, x, y + 1.0 * s, z), null, col); }

function buildChiesaMeda(L, B, G) {
  // local frame: x across the facade, +z out of it towards the piazza (the church runs to -z), y up from the pavement in front
  const [ax, az, bx, bz] = L.f, cx = (ax + bx) / 2, cz = (az + bz) / 2, W2 = hyp(bx - ax, bz - az) / 2, ux = (bz - az) / (2 * W2), uz = -(bx - ax) / (2 * W2);
  const M = new THREE.Matrix4().makeRotationY(Math.atan2(ux, uz)).setPosition(cx, groundH(cx + ux * 2, cz + uz * 2), cz), F = lmFrame(M);
  const Bs = { brick: Buf(), stone: Buf(), coppi: Buf(), trim: Buf(), glass: Buf(), mosaic: Buf() };
  const brick = (g, uvf = boxUV(2)) => F.geo(Bs.brick, g, uvf), stone = (g, uvf = boxUV(2)) => F.geo(Bs.stone, g, uvf), trim = (g, hex) => F.geo(Bs.trim, g, null, COL(hex));
  const wallX = (x, z0, z1, y0, y1) => { F.face(Bs.brick, [[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]]); const o = x + Math.sign(x) * 0.05; F.face(Bs.stone, [[o, y0, z0], [o, y0, z1], [o, 0.95, z1], [o, 0.95, z0]]); };
  const wallZ = (z, x0, x1, y0, y1) => { F.face(Bs.brick, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]]); const o = z + Math.sign(z) * 0.05; F.face(Bs.stone, [[x0, y0, o], [x1, y0, o], [x1, 0.95, o], [x0, 0.95, o]]); };
  const FL = 0.45, BOT = -1.6, FE = 23.2, FA = 28.2, AR = 6.55, AS = 15.6, DEP = 1.4; // floor, wall foot, facade eaves and apex, giant arch radius and springing, facade depth
  // facade: brick screen with the giant arch cut out of it
  {
    const s = new THREE.Shape(); s.moveTo(-W2, BOT); s.lineTo(-AR, BOT); s.lineTo(-AR, AS); s.absarc(0, AS, AR, Math.PI, 0, true); s.lineTo(AR, BOT); s.lineTo(W2, BOT); s.lineTo(W2, FE); s.lineTo(0, FA); s.lineTo(-W2, FE); s.lineTo(-W2, BOT);
    brick(new THREE.ExtrudeGeometry(s, { depth: DEP, bevelEnabled: false, curveSegments: 20 }).translate(0, 0, -DEP));
    const Z = -DEP + 0.02; // inside the arch: stone wall, two registers, the lunette
    F.face(Bs.stone, [[-AR, BOT, Z], [AR, BOT, Z], [AR, 15.0, Z], [-AR, 15.0, Z]]);
    const ms = new THREE.Shape(); ms.moveTo(-AR, 15.0); ms.lineTo(AR, 15.0); ms.lineTo(AR, AS); ms.absarc(0, AS, AR, 0, Math.PI, false); ms.lineTo(-AR, 15.0);
    F.geo(Bs.mosaic, new THREE.ShapeGeometry(ms, 24).translate(0, 0, Z + 0.01), p => [(p.x + AR) / (2 * AR), (p.y - 15.0) / (AS + AR - 15.0)]);
    stone(lmBox(2 * AR, 0.45, 0.4, 0, 14.78, Z + 0.2)); stone(lmBox(2 * AR, 0.55, 0.26, 0, 8.75, Z + 0.13));
    for (const [x, w] of [[-5.98, 1.15], [-2.25, 1.3], [2.25, 1.3], [5.98, 1.15]]) stone(lmBox(w, 14.55 - BOT, 0.24, x, (BOT + 14.55) / 2, Z + 0.12));
    for (const x of [-4.15, 0, 4.15]) lmWindow(F, Bs, 1.6, 9.6, 13.8, x, Z, 0);
    for (const [x, hw, top, tr] of [[0, 1.35, 6.4, 4.7], [-4.15, 1.0, 5.75, 4.3], [4.15, 1.0, 5.75, 4.3]]) { // bronze doors with a glazed transom
      F.face(Bs.stone, [[x - hw - 0.25, FL, Z + 0.02], [x + hw + 0.25, FL, Z + 0.02], [x + hw + 0.25, top + 0.25, Z + 0.02], [x - hw - 0.25, top + 0.25, Z + 0.02]]);
      trim(lmBox(2 * hw, tr - FL, 0.08, x, (FL + tr) / 2, Z + 0.07), '#4a3a2a'); trim(lmBox(0.06, tr - FL, 0.1, x, (FL + tr) / 2, Z + 0.08), '#2a2018');
      F.face(Bs.trim, [[x - hw, tr + 0.12, Z + 0.05], [x + hw, tr + 0.12, Z + 0.05], [x + hw, top, Z + 0.05], [x - hw, top, Z + 0.05]], 2, COL('#262c33'));
    }
    for (const sd of [-1, 1]) { // string course at the springing, stone plinth, the two plaques
      const xm = sd * (AR + W2) / 2, wl = W2 - AR;
      stone(lmBox(wl, 0.32, 0.16, xm, AS, 0.08)); stone(lmBox(wl, 1.1 - BOT, 0.06, xm, (BOT + 1.1) / 2, 0.03));
      F.face(Bs.stone, [[sd * 8.45, 2.4, 0.03], [sd * 9.35, 2.4, 0.03], [sd * 9.35, 3.5, 0.03], [sd * 8.45, 3.5, 0.03]]);
      const sl = hyp(W2, FA - FE), ang = Math.atan2(FA - FE, W2); // gable coping
      stone(new THREE.BoxGeometry(sl + 0.3, 0.32, DEP + 0.2).rotateZ(-sd * ang).translate(sd * W2 / 2, (FE + FA) / 2 + 0.16, -DEP / 2));
    }
    for (let k = 0; k < 3; k++) { const d = 1.5 - 0.5 * k; stone(lmBox(27, FL / 3 * (k + 1) - BOT, d, 0, (BOT + FL / 3 * (k + 1)) / 2, d / 2)); } // sagrato steps
  }
  // nave
  const NE = 22.2, NR = 27.3, NZ = -29.3;
  for (const sd of [-1, 1]) {
    wallX(sd * W2, -DEP, NZ, BOT, NE);
    for (const z of [-DEP - 0.6, -10.7, -20.0, NZ + 0.6]) brick(lmBox(0.4, NE - BOT, 1.2, sd * (W2 + 0.2), (BOT + NE) / 2, z)); // lesene
    for (const z of [-6.05, -15.35, -24.65]) lmWindow(F, Bs, 2.2, 13.0, 19.1, sd * W2, z, sd * Math.PI / 2, 0.05);
    stone(lmBox(0.6, 0.38, -NZ - DEP, sd * (W2 + 0.25), NE - 0.2, (NZ - DEP) / 2));
    F.face(Bs.coppi, [[sd * (W2 + 0.45), NE - 0.05, -1.2], [0, NR, -1.2], [0, NR, NZ - 0.3], [sd * (W2 + 0.45), NE - 0.05, NZ - 0.3]]);
  }
  F.face(Bs.brick, [[-W2, NE, NZ], [W2, NE, NZ], [0, NR - 0.1, NZ]]);
  // the dome block: transept with its two apsidioles, crossing, drum, dome, lantern
  const XW = 17.1, ZB = -69.7, ZC = -49.5, BE = 22.2, BR = 23.9, AP = 10.5;
  for (const sd of [-1, 1]) {
    wallX(sd * XW, NZ, ZB, BOT, BE); wallZ(NZ, sd * W2, sd * XW, BOT, BE); wallZ(ZB, sd * AP, sd * XW, BOT, BE);
    for (const z of [NZ - 0.6, -41.5, -57.5, ZB + 0.6]) brick(lmBox(0.4, BE - BOT, 1.2, sd * (XW + 0.2), (BOT + BE) / 2, z));
    for (const z of [-35.4, -63.6]) lmWindow(F, Bs, 2.0, 9.0, 15.5, sd * XW, z, sd * Math.PI / 2, 0.05);
    lmWindow(F, Bs, 1.6, 12.0, 16.4, sd * (W2 + XW) / 2, NZ, 0, 0.03);
    stone(new THREE.RingGeometry(2.1, 2.55, 24).rotateY(sd * Math.PI / 2).translate(sd * (XW + 0.04), 16.8, ZC)); // oculus over the apsidiole
    F.geo(Bs.glass, new THREE.CircleGeometry(2.1, 24).rotateY(sd * Math.PI / 2).translate(sd * (XW + 0.06), 16.8, ZC));
    stone(lmBox(0.6, 0.38, -(ZB - NZ) + 0.6, sd * (XW + 0.25), BE - 0.2, (NZ + ZB) / 2)); stone(lmBox(XW - W2, 0.38, 0.6, sd * (XW + W2) / 2, BE - 0.2, NZ + 0.25)); stone(lmBox(XW - AP, 0.38, 0.6, sd * (XW + AP) / 2, BE - 0.2, ZB - 0.25));
    // apsidiole: half cylinder and half dome
    const r = 4.5, t0 = sd > 0 ? 0 : Math.PI;
    brick(new THREE.CylinderGeometry(r, r, 10.8 - BOT, 18, 1, true, t0, Math.PI).translate(sd * XW, (BOT + 10.8) / 2, ZC), wrapUV(2, Math.PI * r));
    stone(new THREE.CylinderGeometry(r + 0.05, r + 0.05, 0.95 - BOT, 18, 1, true, t0, Math.PI).translate(sd * XW, (BOT + 0.95) / 2, ZC), wrapUV(2, Math.PI * r));
    stone(new THREE.CylinderGeometry(r + 0.25, r + 0.25, 0.35, 18, 1, false, t0, Math.PI).translate(sd * XW, 10.8, ZC));
    F.geo(Bs.coppi, new THREE.SphereGeometry(r + 0.3, 18, 6, sd > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI, 0, Math.PI / 2).scale(1, 0.55, 1).translate(sd * XW, 10.95, ZC), wrapUV(2, Math.PI * r, Math.PI / 2 * r));
    lmWindow(F, Bs, 1.1, 4.0, 7.6, sd * (XW + r), ZC, sd * Math.PI / 2, 0.02);
  }
  { // block roof: low hips up to the drum
    const o = [[-XW - 0.4, NZ + 0.4], [XW + 0.4, NZ + 0.4], [XW + 0.4, ZB - 0.4], [-XW - 0.4, ZB - 0.4]], i = [[-13.6, NZ - 3.6], [13.6, NZ - 3.6], [13.6, ZB + 3.6], [-13.6, ZB + 3.6]];
    for (let k = 0; k < 4; k++) { const a = o[k], b = o[(k + 1) % 4], c = i[(k + 1) % 4], d = i[k]; F.face(Bs.coppi, [[a[0], BE - 0.05, a[1]], [b[0], BE - 0.05, b[1]], [c[0], BR, c[1]], [d[0], BR, d[1]]]); }
    F.face(Bs.coppi, i.map(p => [p[0], BR, p[1]]));
  }
  { // apse: half cylinder, cornice, half-cone roof, five tall windows
    brick(new THREE.CylinderGeometry(AP, AP, 17.6 - BOT, 30, 1, true, Math.PI / 2, Math.PI).translate(0, (BOT + 17.6) / 2, ZB), wrapUV(2, Math.PI * AP));
    stone(new THREE.CylinderGeometry(AP + 0.05, AP + 0.05, 0.95 - BOT, 30, 1, true, Math.PI / 2, Math.PI).translate(0, (BOT + 0.95) / 2, ZB), wrapUV(2, Math.PI * AP));
    stone(new THREE.CylinderGeometry(AP + 0.28, AP + 0.28, 0.38, 30, 1, false, Math.PI / 2, Math.PI).translate(0, 17.5, ZB));
    F.geo(Bs.coppi, new THREE.ConeGeometry(AP + 0.5, 3.4, 30, 1, true, Math.PI / 2, Math.PI).translate(0, 17.6 + 1.7, ZB), wrapUV(2, Math.PI * (AP + 0.5), hyp(AP + 0.5, 3.4)));
    for (let k = 1; k <= 5; k++) { const a = Math.PI / 2 + Math.PI * k / 6; lmWindow(F, Bs, 1.3, 5.0, 14.2, Math.sin(a) * AP, ZB + Math.cos(a) * AP, a, 0.04); }
  }
  { // drum with its 20 windows of pink glass, the dome (22.4 m inside), the lantern and the cross at about 43 m
    const R = 12.6, D0 = BR, D1 = 30.5, DY = 30.7, DS = 0.62;
    brick(new THREE.CylinderGeometry(R, R, D1 - D0 + 0.4, 60, 1, true).translate(0, (D0 + D1) / 2 - 0.2, ZC), wrapUV(2, TAU * R));
    for (let k = 0; k < 20; k++) {
      const a = (k + 0.5) * TAU / 20, b = k * TAU / 20;
      lmWindow(F, Bs, 1.3, 25.2, 28.9, Math.sin(a) * R, ZC + Math.cos(a) * R, a, 0.04);
      brick(lmBox(0.55, D1 - D0, 0.3, 0, (D0 + D1) / 2, R + 0.1).rotateY(b).translate(0, 0, ZC));
    }
    stone(new THREE.CylinderGeometry(R + 0.45, R + 0.45, 0.5, 60).translate(0, D1, ZC)); stone(new THREE.CylinderGeometry(R + 0.2, R + 0.2, 0.4, 60).translate(0, D0 + 0.2, ZC));
    trim(new THREE.SphereGeometry(R + 0.15, 56, 14, 0, TAU, 0, Math.PI / 2).scale(1, DS, 1).translate(0, DY, ZC), '#6f9783');
    const rib = Buf(), rr = R + 0.22; // copper ribs
    for (let k = 0; k < 16; k++) {
      const ph = k * TAU / 16, tx = Math.sin(ph), tz = Math.cos(ph), i0 = rib.p.length / 3; let n = 0;
      for (let j = 0; j <= 12; j++) {
        const th = j / 12 * Math.PI / 2; if (rr * Math.sin(th) < 1.6) break;
        const sx = -Math.cos(ph) * Math.sin(th), sz = Math.sin(ph) * Math.sin(th), sy = Math.cos(th), px = sx * rr, py = DY + sy * rr * DS, pz = ZC + sz * rr;
        for (const s of [-0.17, 0.17]) vtx(rib, px + tx * s, py, pz + tz * s, sx, sy, sz, 0, 0, COL('#a9c4b4'));
        n++;
      }
      for (let j = 0; j < n - 1; j++) { const q = i0 + j * 2; rib.i.push(q, q + 1, q + 3, q, q + 3, q + 2); }
    }
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rib.p, 3)); rg.setAttribute('normal', new THREE.Float32BufferAttribute(rib.n, 3)); rg.setIndex(rib.i); trim(rg, '#a9c4b4');
    const LY = DY + R * DS - 0.4;
    stone(new THREE.CylinderGeometry(2.0, 2.1, 2.4, 16).translate(0, LY + 1.2, ZC));
    for (let k = 0; k < 8; k++) trim(lmBox(0.55, 1.5, 0.2, 0, LY + 1.25, 2.0).rotateY(k * TAU / 8).translate(0, 0, ZC), '#2a2a2e');
    trim(new THREE.ConeGeometry(2.4, 0.9, 16).translate(0, LY + 2.85, ZC), '#6f9783'); trim(new THREE.SphereGeometry(0.32, 10, 8).translate(0, LY + 3.45, ZC), '#c9a54a');
    trim(lmBox(0.16, 1.6, 0.16, 0, LY + 4.5, ZC), '#c9a54a'); trim(lmBox(0.9, 0.14, 0.14, 0, LY + 4.85, ZC), '#c9a54a');
  }
  mkMesh(Bs.brick, LMAT.brick, 10, 'cast', G); mkMesh(Bs.stone, LMAT.stone, 10, 'cast', G); mkMesh(Bs.coppi, LMAT.coppi, 10, 'cast', G);
  mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.glass, LMAT.glass, 10, false, G); mkMesh(Bs.mosaic, LMAT.mosaic, 10, false, G);
}

// polygon helpers for the palazzo: drop collinear points, and offset inwards (d > 0) or outwards with mitred corners
function lmSimplify(ring, tol) {
  const r = ring.slice(); let ch = true;
  while (ch && r.length > 3) { ch = false; for (let i = 0; i < r.length; i++) { const a = r[(i + r.length - 1) % r.length], c = r[(i + 1) % r.length]; if (segDist(r[i][0], r[i][1], a[0], a[1], c[0], c[1]) < tol) { r.splice(i, 1); ch = true; break; } } }
  return r;
}
function lmOffset(ring, d) {
  const s = sArea(ring) > 0 ? 1 : -1, n = r => r.length;
  return ring.map((p, i) => {
    const a = ring[(i + n(ring) - 1) % n(ring)], c = ring[(i + 1) % n(ring)], l1 = hyp(p[0] - a[0], p[1] - a[1]) || 1, l2 = hyp(c[0] - p[0], c[1] - p[1]) || 1;
    const n1 = [-(p[1] - a[1]) / l1 * s, (p[0] - a[0]) / l1 * s], n2 = [-(c[1] - p[1]) / l2 * s, (c[0] - p[0]) / l2 * s], k = 1 + n1[0] * n2[0] + n1[1] * n2[1];
    return [p[0] + d * (n1[0] + n2[0]) / k, p[1] + d * (n1[1] + n2[1]) / k];
  });
}
function lmInsetOK(r, q) { for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length; if ((r[j][0] - r[i][0]) * (q[j][0] - q[i][0]) + (r[j][1] - r[i][1]) * (q[j][1] - q[i][1]) <= 0) return false; } return true; }
// the palazzo of the old towns: walls drawn bay by bay, cornice on wooden brackets, a hipped roof of coppi round the courtyards; L.o picks the front:
// style, h (eaves height if the map's is a guess), front (a point on the main wall, else the POI), portal 'door' | 'portico' with arches, balcony 'iron' | 'stone',
// flags, sign, belv (a belvedere on the roof over the middle of the front: { w, d, h })
function buildPalazzo(L, B, G) {
  const o = L.o, st = PAL_STYLE[o.style], H = o.h || B.h, k = H / (st.H || MUN_H);
  const outer = lmSimplify(B.pts, 0.35), holes = B.holes.filter(q => Math.abs(sArea(q)) > 120).map(q => lmSimplify(q, 0.35)); // light wells stay under the roof
  const poi = D.pois.find(q => q.lm === L), [fx, fz] = o.front || (poi ? [poi.x, poi.z] : [L.x, L.z]), n = outer.length;
  let fi = 0, fd = 1e9; for (let i = 0; i < n; i++) { const a = outer[i], c = outer[(i + 1) % n], d = segDist(fx, fz, a[0], a[1], c[0], c[1]); if (d < fd) { fd = d; fi = i; } }
  const gF = groundH(fx, fz), gmin = Math.min(...outer.map(p => groundH(p[0], p[1]))), top = gF + H, bot = gmin - 0.6;
  const wall = Buf(), trim = Buf(), roof = Buf(), flag = Buf(), sign = Buf(), CL = lmCloister(L);
  const CREAM = COL(st.trim), WOOD = COL('#5e4128'), IRON = COL('#26282b'), STONE = COL('#cfc6b2'), DOOR = COL('#4a3324');
  const bayOf = (Ln, odd, bl = 3.7) => { let b = Math.max(1, Math.round(Ln / bl)); if (odd && b % 2 === 0) b++; return b; };
  const walls = (ring, hole, y0, y1, front, bl) => { // the drawing ends at the eaves y1; cornice and brackets (mensole) along the top
    const A = sArea(ring);
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], dx = c[0] - a[0], dz = c[1] - a[1], Ln = hyp(dx, dz); if (Ln < 0.05) continue;
      let nx = dz / Ln, nz = -dx / Ln; if ((A < 0) !== hole) { nx = -nx; nz = -nz; }
      const [u0, u1] = Ln < 2.6 ? [0.02, 0.12] : [0, bayOf(Ln, i === front, bl)], vb = 1 - (y1 - y0) / H;
      const piece = (s0, s1, ya, yb) => { const base = wall.p.length / 3, U = t => u0 + (u1 - u0) * t / Ln, V = y => vb + (y - y0) / (y1 - y0) * (1 - vb);
        vtx(wall, a[0] + dx / Ln * s0, ya, a[1] + dz / Ln * s0, nx, 0, nz, U(s0), V(ya)); vtx(wall, a[0] + dx / Ln * s1, ya, a[1] + dz / Ln * s1, nx, 0, nz, U(s1), V(ya)); vtx(wall, a[0] + dx / Ln * s1, yb, a[1] + dz / Ln * s1, nx, 0, nz, U(s1), V(yb)); vtx(wall, a[0] + dx / Ln * s0, yb, a[1] + dz / Ln * s0, nx, 0, nz, U(s0), V(yb));
        if (nx * (-dz) + nz * dx > 0) wall.i.push(base, base + 1, base + 2, base, base + 2, base + 3); else wall.i.push(base, base + 2, base + 1, base, base + 3, base + 2); };
      const cuts = []; for (const ps of CL ? CL.passages : []) for (const [px, pz] of [ps.a, ps.b]) if (segDist(px, pz, a[0], a[1], c[0], c[1]) < 0.6) cuts.push([(px - a[0]) * dx / Ln + (pz - a[1]) * dz / Ln, ps]);
      if (!cuts.length) piece(0, Ln, y0, y1);
      else { cuts.sort((p, q) => p[0] - q[0]); let s = 0; for (const [sp, ps] of cuts) { const gyP = groundH(...ps.a); piece(s, sp - ps.w / 2, y0, y1); piece(sp - ps.w / 2, sp + ps.w / 2, gyP + ps.h, y1); s = sp + ps.w / 2; } piece(s, Ln, y0, y1); }
      const ry = Math.atan2(-dz / Ln, dx / Ln), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      addBox(trim, mx + nx * 0.15, y1 - 0.16, mz + nz * 0.15, Ln + 0.3, 0.28, 0.32, CREAM, ry);
      for (let s = 0.45; s < Ln - 0.2; s += 0.9) addBox(trim, a[0] + dx / Ln * s + nx * 0.45, y1 - 0.1, a[1] + dz / Ln * s + nz * 0.45, 0.12, 0.2, 0.9, WOOD, ry);
    }
  };
  const hip = (rings, y, d) => { // coppi from the eaves (0.9 m out) up to a crest d in; rings: [[ring, isCourtyard]]
    const yr = y + 0.42 * (d + 0.9), crest = [];
    for (const [ring, hole] of rings) {
      const oo = lmOffset(ring, hole ? 0.9 : -0.9), r = lmOffset(ring, hole ? -d : d), m = ring.length; crest.push(r);
      for (let i = 0; i < m; i++) {
        const j = (i + 1) % m, P = [[oo[i][0], y, oo[i][1]], [oo[j][0], y, oo[j][1]], [r[j][0], yr, r[j][1]], [r[i][0], yr, r[i][1]]];
        const ex = P[1][0] - P[0][0], ez = P[1][2] - P[0][2], el = hyp(ex, ez) || 1, sx = P[3][0] - P[0][0], sy = P[3][1] - P[0][1], sz = P[3][2] - P[0][2];
        let nx = -ez * sy, ny = ez * sx - ex * sz, nz = ex * sy; if (ny < 0) { nx = -nx; ny = -ny; nz = -nz; } // eaves x up-slope, facing the sky
        const nl = Math.hypot(nx, ny, nz) || 1, base = roof.p.length / 3, along = q => ((q[0] - P[0][0]) * ex + (q[2] - P[0][2]) * ez) / el, up = q => Math.hypot(q[0] - P[0][0] - ex / el * along(q), q[1] - y, q[2] - P[0][2] - ez / el * along(q));
        for (const q of P) vtx(roof, q[0], q[1], q[2], nx / nl, ny / nl, nz / nl, along(q) / 2, up(q) / 2);
        roof.i.push(base, base + 1, base + 2, base, base + 2, base + 3, base, base + 2, base + 1, base, base + 3, base + 2);
        const sb = trim.p.length / 3; // soffit
        for (const q of [ring[i], ring[j], oo[j], oo[i]]) vtx(trim, q[0], y - 0.02, q[1], 0, -1, 0, 0, 0, WOOD);
        trim.i.push(sb, sb + 1, sb + 2, sb, sb + 2, sb + 3, sb, sb + 2, sb + 1, sb, sb + 3, sb + 2);
      }
    }
    try { polyFill(roof, crest[0], crest.slice(1), yr, 2); } catch (e) { }
  };
  const rings = [[outer, false], ...holes.map(q => [q, true])];
  let d = 0.8; for (const t of [4.5, 3.5, 2.5, 1.5]) if (rings.every(([r, hole]) => lmInsetOK(r, lmOffset(r, hole ? -t : t)))) { d = t; break; }
  walls(outer, false, bot, top, fi); for (const q of holes) walls(q, true, bot, top, -1);
  const flatTop = (ring, y) => { // flat roof behind a parapet
    try { polyFill(trim, ring, [], y + 0.02, 2, COL('#8d8a84')); } catch (e) { }
    for (let i = 0; i < ring.length; i++) { const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln > 0.1) addBox(trim, (a[0] + c[0]) / 2, y + 0.45, (a[1] + c[1]) / 2, Ln + 0.25, 0.9, 0.25, CREAM, Math.atan2(-(c[1] - a[1]) / Ln, (c[0] - a[0]) / Ln)); }
  };
  if (o.flat) flatTop(outer, top); else hip(rings, top, d);
  // the front, in its own frame: x to the right of someone facing it, z out of the wall, y up from the pavement; centred on the bay of the entrance
  const a = outer[fi], c = outer[(fi + 1) % n], Ln = hyp(c[0] - a[0], c[1] - a[1]), ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln;
  let nx = ez, nz = -ex; if (sArea(outer) < 0) { nx = -nx; nz = -nz; }
  const bays = bayOf(Ln, true), bw = Ln / bays, s0 = (Math.floor(clamp(((fx - a[0]) * ex + (fz - a[1]) * ez) / Ln, 0, 0.999) * bays) + 0.5) * bw;
  const M = new THREE.Matrix4().makeBasis(new THREE.Vector3(nz, 0, -nx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)).setPosition(a[0] + ex * s0, gF, a[1] + ez * s0), F = lmFrame(M);
  const box = (x, y, z, w, h, dd, col) => F.geo(trim, lmBox(w, h, dd, x, y, z), null, col);
  if (o.portal === 'arch') { // a grey stone frontispiece: rusticated base, the big arch with its fan light, pilasters, the frieze with the name
    const SG = COL('#c9c6bf'), SD = COL('#a9a59d'), w2 = Math.min(bw * 1.4, 6.2);
    box(0, 4.6, 0.12, 2 * w2, 9.2, 0.24, SG); box(0, 8.2, 0.3, 2 * w2 + 0.4, 1.3, 0.3, COL('#d6d3cc')); box(0, 9.05, 0.38, 2 * w2 + 0.8, 0.35, 0.6, SG);
    for (const x of [-w2 + 0.4, -2.2, 2.2, w2 - 0.4]) box(x, 3.8, 0.32, 0.6, 7.6, 0.2, SD);
    for (let y = 0.6; y < 3.2; y += 0.55) box(0, y, 0.25, 2 * w2, 0.05, 0.05, SD);
    F.geo(trim, new THREE.ShapeGeometry(archShape(3.0, 0, 5.4), 14).translate(0, 0, 0.26), null, COL('#2c2a27'));
    F.geo(trim, new THREE.RingGeometry(1.5, 1.85, 16, 1, 0, Math.PI).translate(0, 3.9, 0.27), null, SD);
    for (let k = 1; k < 8; k++) F.geo(trim, lmBox(0.05, 1.4, 0.04, 0, 0.7, 0).rotateZ(Math.PI / 2 - k * Math.PI / 8).translate(0, 3.9, 0.29), null, COL('#4a4844')); // the fan light
    for (const x of [-1.75, 1.75]) box(x, 1.95, 0.3, 0.08, 3.9, 0.08, COL('#26282b'));
    for (const sd of [-1, 1]) F.geo(trim, new THREE.ShapeGeometry(archShape(1.2, 1.4, 3.6), 10).translate(sd * (w2 - 1.6), 0, 0.26), null, COL('#3a4048'));
    box(0, 0.08, 1.8, 2 * w2 + 1, 0.16, 3.0, STONE);
  } else if (o.portal === 'door') { // stone portal with a keystone
    box(0, 1.95, 0.05, 2.4, 3.9, 0.1, DOOR); box(0, 1.95, 0.08, 0.06, 3.9, 0.1, COL('#2e2018'));
    for (const x of [-1.45, 1.45]) box(x, 2.1, 0.18, 0.5, 4.2, 0.36, STONE);
    box(0, 4.15, 0.2, 3.5, 0.5, 0.42, STONE); box(0, 4.15, 0.42, 0.45, 0.62, 0.1, CREAM); box(0, 0.06, 0.6, 4.2, 0.16, 1.2, STONE);
  } else if (o.portal === 'portico') { // the arcade of the garden front: arches on pilasters, green doors inside
    const na = o.arches, w = Math.min(2.4, bw - 0.9), yt = 4.0 * k;
    for (let i = 0; i < na; i++) {
      const x = (i - (na - 1) / 2) * bw;
      F.geo(trim, new THREE.ShapeGeometry(archShape(w, 0, yt), 10).translate(x, 0, 0.04), null, COL('#4e6b52'));
      F.geo(trim, new THREE.ShapeGeometry(archShape(w + 0.5, 0, yt + 0.25), 10).translate(x, 0, 0.02), null, CREAM);
      box(x, (yt - w / 2) / 2, 0.06, 0.06, yt - w / 2, 0.06, COL('#33463a'));
    }
    for (let i = 0; i <= na; i++) box((i - na / 2) * bw, yt / 2, 0.15, 0.55, yt, 0.3, CREAM);
    box(0, yt + 0.25, 0.18, na * bw + 0.6, 0.35, 0.36, CREAM); box(0, 0.06, 1.2, na * bw + 1.6, 0.16, 2.4, STONE);
  }
  const by = 4.8 * k + 0.12, bwid0 = o.balconyW || (o.portal === 'portico' ? o.arches * bw + 0.4 : 4.4), bwid = bwid0; // balcony on the piano nobile string course
  if (o.porch) for (const x of [-1.9, 1.9]) { F.geo(trim, new THREE.CylinderGeometry(0.24, 0.27, by - 0.1, 14).translate(x, (by - 0.1) / 2, 1.0), null, CREAM); box(x, 0.12, 1.0, 0.7, 0.24, 0.7, STONE); box(x, by - 0.25, 1.0, 0.65, 0.25, 0.65, CREAM); }
  if (o.balcony) {
    box(0, by, 0.6, bwid, 0.22, 1.2, STONE);
    for (let x = -bwid / 2 + 0.3; x <= bwid / 2 - 0.29; x += o.portal === 'portico' ? bw : 1.6) box(x, by - 0.35, 0.4, 0.3, 0.5, 0.8, STONE);
    if (o.balcony === 'iron') {
      box(0, by + 1.05, 1.15, 4.4, 0.06, 0.08, IRON); box(0, by + 0.2, 1.15, 4.4, 0.05, 0.06, IRON);
      for (const x of [-2.15, 2.15]) { box(x, by + 1.05, 0.62, 0.06, 0.06, 1.1, IRON); for (let t = 0.05; t < 1.0; t += 0.16) box(x, by + 0.62, 0.6 + t * 0.5, 0.025, 0.86, 0.025, IRON); }
      for (let x = -2.15; x <= 2.16; x += 0.16) box(x, by + 0.62, 1.15, 0.025, 0.86, 0.025, IRON);
    } else { // stone balustrade
      box(0, by + 0.95, 1.08, bwid, 0.12, 0.28, CREAM); box(0, by + 0.17, 1.08, bwid, 0.1, 0.28, CREAM);
      for (let x = -bwid / 2 + 0.2; x <= bwid / 2 - 0.2; x += 0.26) F.geo(trim, new THREE.CylinderGeometry(0.06, 0.09, 0.68, 6).translate(x, by + 0.56, 1.08), null, CREAM);
      for (const sd of [-1, 1]) box(sd * (bwid / 2 - 0.1), by + 0.56, 0.62, 0.2, 0.86, 1.1, CREAM);
    }
  }
  if (o.flags) for (const [x, off] of [[-1.9, 0], [1.9, 0.5]]) { // the tricolore and Europe on poles out of the railing, hanging down along the pole
    const dx = Math.sign(x) * 0.25, dy = 0.69, dz = 0.68, dl = Math.hypot(dx, dy, dz), py = by + 1.0, tip = t => [x + dx / dl * t, py + dy / dl * t, 1.1 + dz / dl * t];
    F.geo(trim, new THREE.CylinderGeometry(0.03, 0.03, 2.6, 6).translate(0, 1.3, 0).applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(dx / dl, dy / dl, dz / dl)))).translate(x, py, 1.1), null, COL('#d8d8d2'));
    const NI = 5, NJ = 4, base = flag.p.length / 3;
    for (let i = 0; i <= NI; i++) for (let j = 0; j <= NJ; j++) { const q = tip(1.0 + 1.5 * i / NI), w = Math.sin(i * 1.3 + j * 0.9) * 0.07 * j / NJ; F.v(flag, q[0] + w, q[1] - 1.45 * j / NJ, q[2], 0, 0, 1, off + 0.5 * j / NJ, i / NI); }
    for (let i = 0; i < NI; i++) for (let j = 0; j < NJ; j++) { const q = base + i * (NJ + 1) + j; flag.i.push(q, q + 1, q + NJ + 2, q, q + NJ + 2, q + NJ + 1); }
  }
  if (o.attic) { const { w, h } = o.attic; box(0, H + h / 2 - 0.1, 0.2, w, h, 0.5, CREAM); box(0, H + h + 0.05, 0.25, w + 0.5, 0.22, 0.75, CREAM); for (const sd of [-1, 1]) lmUrn(F, trim, sd * (w / 2 - 0.3), H + h + 0.15, 0.25, 1.2, CREAM); }
  if (o.sign) { const w = o.signW || 6.4, hh = o.attic ? 0.75 : 0.4, y = o.signY || (o.attic ? H + o.attic.h / 2 - 0.1 : ((st.H || MUN_H) - 0.5) * k), sz = o.attic ? 0.47 : o.portal === 'arch' ? 0.46 : 0.05, i0 = sign.p.length / 3; for (const [x, yy, u, v] of [[-w / 2, y - hh / 2, 0, 0], [w / 2, y - hh / 2, 1, 0], [w / 2, y + hh / 2, 1, 1], [-w / 2, y + hh / 2, 0, 1]]) F.v(sign, x, yy, sz, 0, 0, 1, u, v); sign.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); }
  if (o.fence) { // garden railing along the front: low wall, pillars with stone vases, iron bars, the gate on the entrance
    const xa = -(Ln - s0) - 2, xb = s0 + 2, IRONF = COL('#2f3133'), PIL = COL('#cfc9bc'), W3 = (x, z) => new THREE.Vector3(x, 0, z).applyMatrix4(M);
    let zf = o.fence; while (zf > 1.5 && [xa, (xa + xb) / 2, xb].some(x => { const v = W3(x, zf); return onAnyRoad(v.x, v.z, 1.2); })) zf -= 0.5; // pulled back to the edge of the street
    box((xa + xb) / 2, 0.3, zf, xb - xa, 0.6, 0.4, PIL);
    for (let x = xa; x <= xb + 0.01; x += (xb - xa) / Math.round((xb - xa) / 3.4)) { box(x, 0.95, zf, 0.5, 1.9, 0.5, PIL); lmUrn(F, trim, x, 1.9, zf, 0.75, PIL); }
    for (let x = xa + 0.3; x < xb - 0.2; x += 0.16) if (Math.abs(x) > 1.6) box(x, 1.15, zf, 0.03, 1.1, 0.03, IRONF);
    box((xa + xb) / 2, 1.68, zf, xb - xa, 0.05, 0.05, IRONF); for (let x = -1.5; x <= 1.5; x += 0.2) box(x, 1.0, zf, 0.03, 2.0, 0.03, IRONF); box(0, 2.0, zf, 3.0, 0.06, 0.06, IRONF);
  }
  if (o.belv) { // belvedere: a room on the roof with the top-floor windows, its own hipped roof and brackets
    const { w, d: bd, h } = o.belv, sb = 1.0, P = (x, z) => { const v = new THREE.Vector3(x, 0, z).applyMatrix4(M); return [v.x, v.z]; };
    const ring = [P(-w / 2, -sb), P(w / 2, -sb), P(w / 2, -sb - bd), P(-w / 2, -sb - bd)];
    walls(ring, false, top - 0.4, top + h, -1, 2.6); if (o.belv.flat) flatTop(ring, top + h); else hip([[ring, false]], top + h, bd / 2 - 0.05);
  }
  if (o.ped) { // pediment over the middle of the front, with an oculus
    const { w, h } = o.ped; F.face(trim, [[-w / 2, H - 0.1, 0.06], [w / 2, H - 0.1, 0.06], [0, H + h, 0.06]], 2, COL(st.wall)); F.geo(trim, new THREE.CircleGeometry(0.55, 14).translate(0, H + h * 0.38, 0.1), null, COL('#2b3038'));
    for (const sd of [-1, 1]) F.geo(trim, new THREE.BoxGeometry(hyp(w / 2, h) + 0.4, 0.3, 0.6).rotateZ(-sd * Math.atan2(h, w / 2)).translate(sd * w / 4, H + h / 2, 0.2), null, CREAM);
  }
  if (o.lantern) { // a square tower over the roof crowned by an octagonal lantern and a little dome
    const { at: [tx, tz], w, h } = o.lantern, q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [tx + (ex * u + nx * v) * w / 2, tz + (ez * u + nz * v) * w / 2]), ty = top + 2.4;
    walls(q, false, top - 0.4, ty + h, -1, 2.0); hip([[q, false]], ty + h, w / 2 - 0.3);
    const yc = ty + h + 0.42 * (w / 2 + 0.6), WL = lmFrame(new THREE.Matrix4().makeTranslation(tx, yc, tz));
    WL.geo(trim, new THREE.CylinderGeometry(w * 0.3, w * 0.32, 2.4, 8).translate(0, 1.2, 0), null, CREAM);
    for (let k2 = 0; k2 < 8; k2++) WL.geo(trim, lmBox(0.45, 1.3, 0.1, 0, 1.25, w * 0.3).rotateY((k2 + 0.5) * Math.PI / 4), null, COL('#2c2e31'));
    WL.geo(trim, new THREE.CylinderGeometry(w * 0.36, w * 0.36, 0.25, 8).translate(0, 2.45, 0), null, CREAM);
    WL.geo(trim, new THREE.SphereGeometry(w * 0.32, 8, 5, 0, TAU, 0, Math.PI / 2).scale(1, 0.9, 1).translate(0, 2.55, 0), null, COL('#a24a35'));
    WL.geo(trim, new THREE.CylinderGeometry(0.35, 0.45, 0.8, 8).translate(0, 2.55 + w * 0.29 + 0.3, 0), null, CREAM); lmCross(WL, trim, 0, 3.2 + w * 0.29, 0, 1.0, COL('#3c3c40'));
  }
  if (o.tower) { // a corner tower with battlements
    const { at: [tx, tz], w, h } = o.tower, q = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [tx + (ex * u + nx * v) * w / 2, tz + (ez * u + nz * v) * w / 2]); // square to the front wall
    walls(q, false, bot, top, -1, 2.0); walls(q, false, top, top + h, -1, 2.0); try { polyFill(trim, q, [], top + h + 0.02, 2, COL('#8d8a84')); } catch (e) { }
    for (let i = 0; i < 4; i++) { const a = q[i], c = q[(i + 1) % 4]; for (let t = 0; t < 4; t++) { const u = (t + 0.5) / 4; addBox(trim, lerp(a[0], c[0], u), top + h + 0.45, lerp(a[1], c[1], u), 0.6, 0.9, 0.6, COL(st.wall)); } }
  }
  if (o.canopy) { // modern canopy over the platform: steel trees holding a tilted roof of glass and metal
    const [[ax, az], [bx, bz], cw] = o.canopy, Lc = hyp(bx - ax, bz - az), ux = (bx - ax) / Lc, uz = (bz - az) / Lc, gc = groundH(ax, az) + PLAT_H, STEEL = COL('#a7abb0');
    let px = -uz, pz = ux; if (inBuilding(ax + px * 3, az + pz * 3)) { px = -px; pz = -pz; } // across, away from the building
    const C = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(px, 0, pz)).setPosition(ax, gc, az));
    for (let s = 2.5; s < Lc; s += 6) { C.geo(trim, new THREE.CylinderGeometry(0.16, 0.2, 3.6, 8).translate(s, 1.8, cw / 2), null, STEEL); for (const a of [-0.6, 0.6]) for (const b of [-0.5, 0.5]) C.geo(trim, new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6).translate(0, 0.8, 0).rotateZ(a).rotateX(b).translate(s, 3.5, cw / 2), null, STEEL); }
    C.geo(trim, lmBox(Lc + 1.0, 0.18, cw + 0.6, Lc / 2, 0, cw / 2).rotateX(0.0).translate(0, 4.35, 0).applyMatrix4(new THREE.Matrix4().makeRotationX(-0.06)), null, COL('#7f868d'));
    C.geo(trim, lmBox(Lc + 1.0, 0.04, cw + 0.6, Lc / 2, 4.22, cw / 2), null, COL('#c9d6de'));
  }
  const flagTex = canvasTex(256, 64, (g, w, h) => {
    for (const [i, col] of [[0, '#009246'], [1, '#f1f2f1'], [2, '#ce2b37']]) { g.fillStyle = col; g.fillRect(i * w / 6, 0, w / 6 + 1, h); } // u runs from the pole (hoist) to the fly
    g.fillStyle = '#003399'; g.fillRect(w / 2, 0, w / 2, h); g.fillStyle = '#ffcc00';
    for (let i = 0; i < 12; i++) { const an = i / 12 * TAU; g.beginPath(); g.arc(w * 0.75 + Math.cos(an) * 20, h / 2 + Math.sin(an) * 20, 2.6, 0, TAU); g.fill(); }
  }, false);
  if (CL) { // the cloister: a white arcade on piers all round the court at the ground floor, the walk behind it in shade, an odd number of arches a side
    // so the middle one lines up with the passage; the passages, vaulted, plastered, paved; the hedges round the four beds
    const q = CL.court, [qx, qz] = centroid(q);
    for (let i = 0; i < 4; i++) {
      const a = q[i], c = q[(i + 1) % 4], Ln = hyp(c[0] - a[0], c[1] - a[1]); let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if ((qx - a[0]) * nx + (qz - a[1]) * nz < 0) { nx = -nx; nz = -nz; } // into the court
      const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, nb = Math.round(Ln / 3.6) | 1, bw = Ln / nb, gy = Math.min(groundH(a[0], a[1]), groundH(c[0], c[1])), AH = 4.2 * k;
      const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ex, 0, ez), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)).setPosition(a[0] + nx * 0.06, gy, a[1] + nz * 0.06));
      const gap = CL.passages.some(ps => segDist(ps.a[0], ps.a[1], a[0], a[1], c[0], c[1]) < 0.6) ? [Ln / 2 - 1.6, Ln / 2 + 1.6] : null;
      for (const [s0, s1] of gap ? [[0, gap[0]], [gap[1], Ln]] : [[0, Ln]]) T.geo(trim, lmBox(s1 - s0, AH, 0.06, (s0 + s1) / 2, AH / 2, -0.05), null, COL('#3a3632')); // the dark walk behind
      for (let b = 0; b < nb; b++) { const sh = new THREE.Shape(), r = (bw - 0.7) / 2, cx = bw / 2, hp = new THREE.Path(); sh.moveTo(0, 0); sh.lineTo(bw, 0); sh.lineTo(bw, AH); sh.lineTo(0, AH); sh.lineTo(0, 0);
        hp.moveTo(cx - r, 0); hp.lineTo(cx + r, 0); hp.lineTo(cx + r, AH - 0.6 - r); hp.absarc(cx, AH - 0.6 - r, r, 0, Math.PI, false); hp.lineTo(cx - r, 0); sh.holes.push(hp);
        T.geo(trim, new THREE.ShapeGeometry(sh, 10).translate(b * bw, 0, 0.05), null, COL('#f4f1ea')); }
    }
    for (const ps of CL.passages) { // the passage: plastered sides, a barrel vault, stone paving, an arched stone frame on the street front
      const L2 = hyp(ps.b[0] - ps.a[0], ps.b[1] - ps.a[1]), gy = groundH(...ps.a), w = ps.w, hh = ps.h;
      const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ps.uz, 0, -ps.ux), new THREE.Vector3(0, 1, 0), new THREE.Vector3(ps.ux, 0, ps.uz)).setPosition(ps.a[0], gy, ps.a[1])); // x across, z out to the street
      for (const sd of [-1, 1]) T.geo(trim, lmBox(0.1, hh - w / 2 + 0.05, L2, sd * w / 2, (hh - w / 2) / 2, L2 / 2), null, COL('#d9d1c0'));
      for (let k = 0; k < 12; k++) { const a0 = k / 12 * Math.PI, a1 = (k + 1) / 12 * Math.PI, yc = hh - w / 2, P = (a, z) => [Math.cos(a) * w / 2, yc + Math.sin(a) * w / 2, z]; T.face(trim, [P(a0, 0), P(a1, 0), P(a1, L2), P(a0, L2)], 2, COL('#cfc7b5')); T.face(trim, [P(a0, 0), P(a0, L2), P(a1, L2), P(a1, 0)], 2, COL('#cfc7b5')); } // the barrel vault, both faces
      T.geo(trim, lmBox(w, 0.06, L2, 0, 0.03, L2 / 2), null, COL('#9d968a'));
      const fr = new THREE.Shape(), o2 = w / 2 + 0.45, fh = new THREE.Path(); fr.moveTo(-o2, 0); fr.lineTo(o2, 0); fr.lineTo(o2, hh + 0.45); fr.lineTo(-o2, hh + 0.45); fr.lineTo(-o2, 0);
      fh.moveTo(-w / 2, 0); fh.lineTo(w / 2, 0); fh.lineTo(w / 2, hh - w / 2); fh.absarc(0, hh - w / 2, w / 2, 0, Math.PI, false); fh.lineTo(-w / 2, 0); fr.holes.push(fh);
      T.geo(trim, new THREE.ShapeGeometry(fr, 12).translate(0, 0, L2 + 0.05), null, STONE);
    }
    { const g = VBuf(); try { polyFill(g, q, [], 0.1, 3, COL('#b3ab9c')); for (const bd of CL.beds) polyFill(g, bd, [], 0.17, 3, COL('#567f3c')); } catch (e) { } // gravel walks, the four lawns over them
      mkMesh(g, LMAT.yard, 2, false, G); }
    for (const [x, z] of CL.trees) { const y = groundH(x, z); addBox(trim, x, y + 1.6, z, 0.4, 3.2, 0.4, COL('#5a4632')); const tg = new THREE.IcosahedronGeometry(3.2, 0).scale(1, 1.1, 1).translate(x, y + 5.6, z), F2 = lmFrame(new THREE.Matrix4()); F2.geo(trim, tg, null, COL('#3f6a34')); }
    for (const hd of CL.hedges) for (let j = 1; j < hd.length; j++) { const [x0, z0] = hd[j - 1], [x1, z1] = hd[j], Lh = hyp(x1 - x0, z1 - z0), y = groundH((x0 + x1) / 2, (z0 + z1) / 2);
      addBox(trim, (x0 + x1) / 2, y + 0.45, (z0 + z1) / 2, Lh + 0.7, 0.9, 0.7, COL('#3d6a32'), Math.atan2(-(z1 - z0), x1 - x0)); }
  }
  mkMesh(wall, LMAT[o.style], 10, 'cast', G); mkMesh(trim, MAT.roof, 10, 'cast', G); mkMesh(roof, LMAT.coppi, 10, 'cast', G);
  if (o.flags) mkMesh(flag, new THREE.MeshLambertMaterial({ map: flagTex, side: THREE.DoubleSide }), 10, false, G);
  if (o.sign) {
    const signTex = canvasTex(512, 32, (g, w, h) => { g.fillStyle = o.signCol || '#4a3c2a'; g.font = 'bold 30px Georgia, "Times New Roman", serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.save(); g.translate(w / 2, h / 2 + 1); g.scale(Math.min(3, w * 0.94 / g.measureText(o.sign).width), 1); g.fillText(o.sign, 0, 0); g.restore(); }, false);
    mkMesh(sign, new THREE.MeshLambertMaterial({ map: signTex, transparent: true, alphaTest: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 10, false, G);
  }
}

// San Vittore: the monastery church, a single plastered hall; the barocchetto facade in stone up a staircase, San Vittore on horseback in the tondo over
// the portal, Aimo and Vermondo in the upper niches beside the big window, urns on the corners
function buildSanVittore(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), Bs = { sand: Buf(), plaster: Buf(), coppi: Buf(), trim: Buf(), warm: Buf(), tondo: Buf() };
  const SAND = COL('#d2c6ad'), PALE = COL('#e2d8c4'), WALL = COL('#d9c8a5'), DOOR = COL('#4a3426'), NICHE = COL('#a39782');
  const sand = g => F.geo(Bs.sand, g, boxUV(2)), trim = (g, c) => F.geo(Bs.trim, g, null, c), box = (w, h, d, x, y, z, c) => trim(lmBox(w, h, d, x, y, z), c);
  const FL = 1.7, BOT = -1.2, LEN = 42.0, E = 15.5, RD = 19.4; // floor at the top of the staircase, wall foot, hall length, eaves, ridge
  for (const sd of [-1, 1]) {
    F.face(Bs.plaster, [[sd * W2, BOT, 0], [sd * W2, BOT, -LEN], [sd * W2, E, -LEN], [sd * W2, E, 0]], 2, WALL);
    F.face(Bs.coppi, [[sd * (W2 + 0.5), E - 0.1, -0.4], [0, RD, -0.4], [0, RD, -LEN - 0.5], [sd * (W2 + 0.5), E - 0.1, -LEN - 0.5]]);
    box(0.5, 0.4, LEN - 0.4, sd * (W2 + 0.2), E - 0.2, -LEN / 2 - 0.2, PALE);
    for (const z of [-3.5, -10.5, -17.5, -24.5, -31.5, -38.5]) box(0.2, E - BOT, 0.9, sd * (W2 + 0.1), (E + BOT) / 2, z, WALL); // lesene
    for (const z of [-7, -14, -21, -28, -35]) { // the oculi of the upper band
      trim(new THREE.RingGeometry(0.95, 1.3, 20).rotateY(sd * Math.PI / 2).translate(sd * (W2 + 0.03), 12.6, z), PALE);
      F.geo(Bs.warm, new THREE.CircleGeometry(0.95, 20).rotateY(sd * Math.PI / 2).translate(sd * (W2 + 0.05), 12.6, z));
    }
  }
  F.face(Bs.plaster, [[-W2, BOT, -LEN], [W2, BOT, -LEN], [W2, E, -LEN], [0, RD, -LEN], [-W2, E, -LEN]], 2, WALL);
  // facade: two orders of pilasters, volutes, pediment
  const U0 = FL + 9.6, U1 = U0 + 1.0, T0 = U1 + 7.2, T1 = T0 + 0.8, AP = T1 + 3.0, UW = 5.3;
  F.face(Bs.sand, [[-W2, BOT, 0], [W2, BOT, 0], [W2, U0, 0], [-W2, U0, 0]]); F.face(Bs.sand, [[-UW, U0, 0], [UW, U0, 0], [UW, T1, 0], [-UW, T1, 0]]); F.face(Bs.sand, [[-UW - 0.3, T1, 0], [UW + 0.3, T1, 0], [0, AP, 0]]);
  for (const x of [-W2 + 0.55, -2.9, 2.9, W2 - 0.55]) { sand(lmBox(1.0, U0 - FL, 0.4, x, (FL + U0) / 2, 0.2)); box(1.25, 0.6, 0.55, x, FL + 0.3, 0.27, PALE); box(1.25, 0.5, 0.55, x, U0 - 0.25, 0.27, PALE); }
  box(2.2, 4.2, 0.08, 0, FL + 2.1, 0.06, DOOR); box(0.05, 4.2, 0.1, 0, FL + 2.1, 0.08, COL('#2a1d14'));
  for (const x of [-1.28, 1.28]) box(0.35, 4.6, 0.25, x, FL + 2.3, 0.12, PALE);
  box(3.0, 0.45, 0.3, 0, FL + 4.5, 0.15, PALE); box(3.4, 0.25, 0.5, 0, FL + 4.9, 0.25, PALE);
  F.geo(Bs.tondo, new THREE.CircleGeometry(1.05, 24).translate(0, FL + 6.6, 0.1)); trim(new THREE.RingGeometry(1.05, 1.32, 24).translate(0, FL + 6.6, 0.09), PALE);
  for (const sd of [-1, 1]) { box(0.5, 0.9, 0.2, sd * 1.5, FL + 6.4, 0.1, PALE); box(0.6, 0.3, 0.25, sd * 0.9, FL + 7.9, 0.12, PALE); } // scrolls round the tondo
  for (const sd of [-1, 1]) { // lower niches, statues, cartouches
    const x = sd * 4.6;
    trim(new THREE.ShapeGeometry(archShape(1.35, FL + 1.9, FL + 5.6), 10).translate(x, 0, 0.02), NICHE); lmStatue(F, Bs.trim, x, FL + 2.0, 0.28, 1.55, PALE);
    box(1.3, 0.5, 0.2, x, FL + 1.45, 0.1, PALE); box(1.7, 0.25, 0.4, x, FL + 5.95, 0.2, PALE);
  }
  box(2 * W2 + 0.5, 1.0, 0.7, 0, U0 + 0.5, 0.35, SAND); box(2 * W2 + 0.8, 0.25, 0.95, 0, U1 - 0.05, 0.45, PALE);
  for (const x of [-UW + 0.4, -2.4, 2.4, UW - 0.4]) { sand(lmBox(0.8, T0 - U1, 0.35, x, (U1 + T0) / 2, 0.18)); box(1.0, 0.45, 0.5, x, T0 - 0.22, 0.25, PALE); }
  trim(new THREE.ShapeGeometry(archShape(2.4, U1 + 1.15, U1 + 5.85), 12).translate(0, 0, 0.03), PALE); F.geo(Bs.warm, new THREE.ShapeGeometry(archShape(1.9, U1 + 1.4, U1 + 5.6), 12).translate(0, 0, 0.05));
  box(2.9, 0.3, 0.4, 0, U1 + 6.2, 0.2, PALE); box(0.8, 0.6, 0.3, 0, U1 + 6.6, 0.15, PALE);
  for (const sd of [-1, 1]) {
    const x = sd * 3.85;
    trim(new THREE.ShapeGeometry(archShape(1.15, U1 + 1.2, U1 + 4.6), 10).translate(x, 0, 0.02), NICHE); lmStatue(F, Bs.trim, x, U1 + 1.3, 0.26, 1.35, PALE);
    const v = new THREE.Shape(); v.moveTo(sd * UW, U1); v.lineTo(sd * (W2 - 0.15), U1); v.quadraticCurveTo(sd * (UW + 0.25), U1 + 0.5, sd * UW, U1 + 3.4); v.lineTo(sd * UW, U1); // volute down to the lower order
    sand(new THREE.ExtrudeGeometry(v, { depth: 0.5, bevelEnabled: false, curveSegments: 10 }));
    lmUrn(F, Bs.trim, sd * (W2 - 0.3), U1, 0.3, 1.1, PALE); lmUrn(F, Bs.trim, sd * UW, T1, 0.3, 1.3, PALE);
    const sl = hyp(UW + 0.3, AP - T1), ang = Math.atan2(AP - T1, UW + 0.3); // pediment coping
    trim(new THREE.BoxGeometry(sl + 0.4, 0.3, 0.7).rotateZ(-sd * ang).translate(sd * (UW + 0.3) / 2, (T1 + AP) / 2 + 0.15, 0.2), PALE);
  }
  box(2 * UW + 0.5, 0.8, 0.6, 0, T0 + 0.4, 0.3, SAND); box(2 * UW + 0.8, 0.22, 0.85, 0, T1 - 0.05, 0.4, PALE);
  trim(new THREE.CircleGeometry(0.7, 16).scale(1, 1.3, 1).translate(0, T1 + 1.25, 0.08), PALE); box(0.5, 0.4, 0.5, 0, AP + 0.1, 0.1, PALE); lmCross(F, Bs.trim, 0, AP + 0.3, 0.1, 1.2, COL('#5b5c60'));
  for (let k = 0; k < 10; k++) { const t = FL / 10 * (k + 1), d = 3.2 - 0.32 * k; sand(lmBox(10, t - BOT, d, 0, (BOT + t) / 2, d / 2)); } // the eighteenth-century staircase
  mkMesh(Bs.sand, LMAT.sand, 10, 'cast', G); mkMesh(Bs.plaster, LMAT.plaster, 10, 'cast', G); mkMesh(Bs.coppi, LMAT.coppi, 10, 'cast', G);
  mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.warm, LMAT.warm, 10, false, G); mkMesh(Bs.tondo, LMAT.tondo, 10, false, G);
}

// Santuario del Santo Crocifisso: three naves, the 1893 facade with its protiro, four saints in niches (Antonio abate, Aimo, Vermondo, Giovanni
// Oldrati), curved wings over the aisles, statues on the pediment; the tall bell tower (1920) with clock, open belfry, balustrade and a lead dome
function buildCrocifisso(L, B, G) {
  const { F, W2, ry } = lmChurchFrame(L), Bs = { plaster: Buf(), coppi: Buf(), trim: Buf(), warm: Buf(), clock: Buf() };
  const CREAM = COL('#dcbf98'), WHITE = COL('#f1ebe0'), STAT = COL('#e6e2da'), DOOR = COL('#5a3b26'), COPPER = COL('#6f8f80'), PANEL = COL('#e3d4b8'), LEAD = COL('#5d6168'), GOLD = COL('#c9a54a');
  const wallP = (pts, c = CREAM) => F.face(Bs.plaster, pts, 2, c), trim = (g, c) => F.geo(Bs.trim, g, null, c), box = (w, h, d, x, y, z, c) => trim(lmBox(w, h, d, x, y, z), c);
  const BOT = -1.4, NW = 5.0, NE = 17.6, NR = 21.2, AE = 10.6, LEN = 40, ALEN = 36; // nave half width, nave eaves and ridge, aisle eaves, nave and aisle length
  for (const sd of [-1, 1]) { // nave over the aisle roofs with half-moon windows, aisles under lean-to roofs
    wallP([[sd * NW, AE - 0.5, -0.5], [sd * NW, AE - 0.5, -LEN], [sd * NW, NE, -LEN], [sd * NW, NE, -0.5]]);
    wallP([[sd * W2, BOT, 0], [sd * W2, BOT, -ALEN], [sd * W2, AE, -ALEN], [sd * W2, AE, 0]]);
    wallP([[sd * NW, BOT, -ALEN], [sd * W2, BOT, -ALEN], [sd * W2, AE, -ALEN], [sd * NW, AE + 2.4, -ALEN]]);
    F.face(Bs.coppi, [[sd * (W2 + 0.4), AE - 0.15, -0.3], [sd * NW, AE + 2.4, -0.3], [sd * NW, AE + 2.4, -ALEN - 0.3], [sd * (W2 + 0.4), AE - 0.15, -ALEN - 0.3]]);
    F.face(Bs.coppi, [[sd * (NW + 0.45), NE - 0.1, -0.3], [0, NR, -0.3], [0, NR, -LEN - 0.4], [sd * (NW + 0.45), NE - 0.1, -LEN - 0.4]]);
    box(0.5, 0.35, LEN, sd * (NW + 0.2), NE - 0.2, -LEN / 2, WHITE); box(0.5, 0.35, ALEN, sd * (W2 + 0.2), AE - 0.2, -ALEN / 2, WHITE);
    for (const z of [-8, -16, -24, -32]) {
      trim(new THREE.RingGeometry(1.5, 1.8, 16, 1, 0, Math.PI).rotateY(sd * Math.PI / 2).translate(sd * (NW + 0.03), 13.4, z), WHITE);
      F.geo(Bs.warm, new THREE.CircleGeometry(1.5, 16, 0, Math.PI).rotateY(sd * Math.PI / 2).translate(sd * (NW + 0.05), 13.4, z));
      lmWindow(F, Bs, 1.3, 3.6, 7.6, sd * W2, z, sd * Math.PI / 2, 0.04, { frame: 'trim', glass: 'warm', col: WHITE });
    }
  }
  wallP([[-NW, BOT, -LEN], [NW, BOT, -LEN], [NW, NE, -LEN], [0, NR, -LEN], [-NW, NE, -LEN]]);
  F.geo(Bs.plaster, new THREE.CylinderGeometry(4.2, 4.2, 13 - BOT, 20, 1, true, Math.PI / 2, Math.PI).translate(0, (BOT + 13) / 2, -LEN), wrapUV(2, Math.PI * 4.2), CREAM); // apse
  F.geo(Bs.coppi, new THREE.ConeGeometry(4.6, 2.2, 20, 1, true, Math.PI / 2, Math.PI).translate(0, 14.1, -LEN), wrapUV(2, Math.PI * 4.6, hyp(4.6, 2.2)));
  { const x = -(W2 - 3.0), z = -4.4; // the round chapel at the front corner
    F.geo(Bs.plaster, new THREE.CylinderGeometry(3.3, 3.3, 9.4 - BOT, 22, 1, true).translate(x, (BOT + 9.4) / 2, z), wrapUV(2, TAU * 3.3), CREAM);
    box(7.2, 0.3, 7.2, x, 9.4, z, WHITE); F.geo(Bs.coppi, new THREE.ConeGeometry(3.7, 1.8, 22).translate(x, 10.45, z), wrapUV(2, TAU * 3.7, hyp(3.7, 1.8)));
  }
  // facade, lower order: pilasters, side doors with pediments and relief panels, niches with saints, the portal under the protiro
  wallP([[-W2, BOT, 0], [W2, BOT, 0], [W2, AE, 0], [-W2, AE, 0]]);
  for (const x of [-W2 + 0.4, -5.7, -3.3, 3.3, 5.7, W2 - 0.4]) { box(0.8, AE, 0.3, x, AE / 2, 0.15, WHITE); box(1.0, 0.5, 0.45, x, 0.25, 0.22, WHITE); box(1.0, 0.4, 0.45, x, AE - 0.2, 0.22, WHITE); }
  const tri = (w, y0, h, x, z, c) => { const s = new THREE.Shape(); s.moveTo(-w / 2, y0); s.lineTo(w / 2, y0); s.lineTo(0, y0 + h); s.lineTo(-w / 2, y0); trim(new THREE.ShapeGeometry(s).translate(x, 0, z), c); };
  for (const sd of [-1, 1]) {
    const x = sd * 8.4;
    box(1.8, 3.6, 0.08, x, 1.8, 0.05, DOOR); for (const e of [-1, 1]) box(0.25, 3.9, 0.2, x + e * 1.02, 1.95, 0.1, WHITE); box(2.4, 0.3, 0.25, x, 3.9, 0.12, WHITE); tri(2.7, 4.05, 0.75, x, 0.14, WHITE);
    box(2.4, 1.4, 0.06, x, 6.9, 0.04, PANEL); box(2.7, 0.15, 0.12, x, 7.67, 0.06, WHITE); box(2.7, 0.15, 0.12, x, 6.13, 0.06, WHITE);
    const xn = sd * 4.5; trim(new THREE.ShapeGeometry(archShape(1.1, 1.8, 4.9), 10).translate(xn, 0, 0.02), PANEL); lmStatue(F, Bs.trim, xn, 1.9, 0.3, 1.35, STAT); tri(1.6, 5.1, 0.5, xn, 0.06, WHITE);
  }
  box(2.6, 5.0, 0.08, 0, 2.5, 0.05, DOOR); box(0.05, 5.0, 0.1, 0, 2.5, 0.08, COL('#2e2016')); box(3.6, 0.9, 0.08, 0, 8.9, 0.05, WHITE);
  for (const x of [-1.9, 1.9]) for (const z of [0.6, 3.2]) { trim(new THREE.CylinderGeometry(0.27, 0.3, 5.1, 12).translate(x, 2.85, z), WHITE); box(0.75, 0.3, 0.75, x, 0.15, z, WHITE); box(0.75, 0.35, 0.75, x, 5.55, z, WHITE); }
  box(4.6, 0.6, 3.6, 0, 6.0, 1.9, WHITE); tri(4.9, 6.3, 1.2, 0, 3.72, WHITE);
  for (const sd of [-1, 1]) F.face(Bs.trim, [[sd * 2.6, 6.25, 3.85], [0, 7.6, 3.85], [0, 7.6, 0.02], [sd * 2.6, 6.25, 0.02]], 2, COPPER);
  for (let k = 0; k < 3; k++) box(6.2 + 0.8 * (2 - k), 0.15 * (k + 1) + 0.4, 4.6 - 0.45 * k, 0, (0.15 * (k + 1) - 0.4) / 2, 2.3 - 0.22 * k, COL('#cfc6b2'));
  box(2 * W2 + 0.5, 0.9, 0.6, 0, AE + 0.45, 0.3, WHITE);
  // upper order, curved wings, pediment with three statues
  const U1 = AE + 0.9, T0 = U1 + 8.0, T1 = T0 + 0.8, AP = T1 + 3.1, UW = 5.6;
  wallP([[-UW, U1, 0], [UW, U1, 0], [UW, T1, 0], [-UW, T1, 0]]); wallP([[-UW - 0.4, T1, 0], [UW + 0.4, T1, 0], [0, AP, 0]]);
  for (const x of [-UW + 0.35, -2.9, 2.9, UW - 0.35]) { box(0.7, T0 - U1, 0.28, x, (U1 + T0) / 2, 0.14, WHITE); box(0.9, 0.35, 0.4, x, T0 - 0.18, 0.2, WHITE); }
  box(3.6, 4.6, 0.06, 0, U1 + 3.9, 0.04, PANEL); for (const y of [U1 + 1.55, U1 + 6.25]) box(3.9, 0.15, 0.12, 0, y, 0.06, WHITE);
  for (const sd of [-1, 1]) {
    const xn = sd * 4.1; trim(new THREE.ShapeGeometry(archShape(1.0, U1 + 1.6, U1 + 5.0), 10).translate(xn, 0, 0.02), PANEL); lmStatue(F, Bs.trim, xn, U1 + 1.7, 0.26, 1.3, STAT);
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12 * Math.PI / 2; pts.push([sd * (W2 - 0.5 - (W2 - 0.5 - UW) * Math.cos(t)), T0 - (T0 - U1 - 0.3) * Math.sin(t)]); } // concave sweep down over the aisle
    const w = new THREE.Shape(); w.moveTo(sd * UW, U1); w.lineTo(sd * (W2 - 0.5), U1); for (let i = pts.length - 1; i >= 0; i--) w.lineTo(pts[i][0], pts[i][1]);
    trim(new THREE.ShapeGeometry(w).translate(0, 0, 0.01), CREAM);
    trim(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, y + 0.1, 0.12))), 16, 0.17, 6), WHITE);
    trim(new THREE.CylinderGeometry(0.45, 0.45, 0.3, 12).rotateX(Math.PI / 2).translate(sd * (W2 - 0.7), U1 + 0.6, 0.2), WHITE); lmUrn(F, Bs.trim, sd * (W2 - 0.3), U1, 0.3, 1.0, WHITE);
    const sl = hyp(UW + 0.4, AP - T1), ang = Math.atan2(AP - T1, UW + 0.4);
    trim(new THREE.BoxGeometry(sl + 0.4, 0.3, 0.7).rotateZ(-sd * ang).translate(sd * (UW + 0.4) / 2, (T1 + AP) / 2 + 0.15, 0.2), WHITE);
    lmStatue(F, Bs.trim, sd * (UW + 0.1), T1, 0.2, 1.2, STAT); trim(new THREE.CylinderGeometry(0.05, 0.12, 1.1, 6).rotateZ(-sd * 1.0).translate(sd * (UW - 0.45), T1 + 2.1, 0.45), GOLD); // angels with trumpets
  }
  box(2 * UW + 0.5, 0.8, 0.6, 0, T0 + 0.4, 0.3, WHITE); box(2 * UW + 0.9, 0.22, 0.85, 0, T1 - 0.05, 0.4, WHITE);
  trim(new THREE.CircleGeometry(0.75, 16).translate(0, T1 + 1.25, 0.06), WHITE); lmStatue(F, Bs.trim, 0, AP - 0.2, 0.1, 1.4, STAT); lmCross(F, Bs.trim, 0.55, AP + 1.2, 0.1, 1.3, COL('#5b5c60'));
  // the bell tower, square and plastered: lesene, string courses, clock faces, open belfry with a bell, balustrade with urns, lantern, lead dome, cross
  {
    const [tx, tz] = L.tower, T = lmFrame(new THREE.Matrix4().makeRotationY(ry).setPosition(tx, groundH(tx, tz), tz)), H0 = 23, CK = 27.3, BL = 32.8;
    const tw = (g, c) => T.geo(Bs.trim, g, null, c), CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
    T.geo(Bs.plaster, lmBox(5.6, H0 - BOT, 5.6, 0, (BOT + H0) / 2, 0), boxUV(2), CREAM); T.geo(Bs.plaster, lmBox(5.8, CK - H0, 5.8, 0, (H0 + CK) / 2, 0), boxUV(2), CREAM);
    for (const [x, z] of CORN) tw(lmBox(0.7, CK - BOT, 0.7, x * 2.65, (BOT + CK) / 2, z * 2.65), WHITE);
    for (const y of [8, 16, H0]) tw(lmBox(6.1, 0.35, 6.1, 0, y, 0), WHITE);
    for (let k = 0; k < 4; k++) {
      const a = k * Math.PI / 2;
      tw(new THREE.ShapeGeometry(archShape(0.9, 17.5, 20.3), 8).translate(0, 0, 2.83).rotateY(a), COL('#8d826c'));
      T.geo(Bs.clock, new THREE.CircleGeometry(1.05, 24).translate(0, 25.2, 2.96).rotateY(a)); tw(new THREE.RingGeometry(1.05, 1.25, 24).translate(0, 25.2, 2.94).rotateY(a), GOLD);
      tw(lmBox(3.6, 1.0, 0.6, 0, BL - 0.5, 2.35).rotateY(a), CREAM); // arch heads of the belfry
      for (let x = -1.5; x <= 1.5; x += 0.3) tw(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6).translate(x, CK + 0.95, 2.6).rotateY(a), WHITE);
      for (let x = -2.7; x <= 2.7; x += 0.3) tw(new THREE.CylinderGeometry(0.06, 0.09, 0.7, 6).translate(x, BL + 0.95, 3.0).rotateY(a), WHITE);
      tw(lmBox(1.6, 0.7, 0.3, 0, BL + 4.2, 1.9).rotateY(a), WHITE); tw(new THREE.ShapeGeometry(archShape(0.8, BL + 1.4, BL + 3.4), 8).translate(0, 0, 1.92).rotateY(a), COL('#3a3632'));
    }
    tw(lmBox(6.7, 0.6, 6.7, 0, CK + 0.3, 0), WHITE); tw(lmBox(5.4, 0.12, 5.4, 0, CK + 1.35, 0), WHITE);
    for (const [x, z] of CORN) tw(lmBox(1.3, BL - CK - 0.6, 1.3, x * 2.25, (CK + 0.6 + BL) / 2, z * 2.25), CREAM);
    tw(lmBox(3.2, BL - CK - 0.6, 3.2, 0, (CK + 0.6 + BL) / 2, 0), COL('#2a2826'));
    tw(new THREE.LatheGeometry([[0, 0], [0.75, 0], [0.7, 0.2], [0.5, 0.7], [0.45, 1.1], [0, 1.2]].map(([r, h]) => new THREE.Vector2(r, h)), 12).translate(0, BL - 2.6, 1.7), COL('#5a4a32')); // a bell
    tw(lmBox(6.7, 0.6, 6.7, 0, BL + 0.3, 0), WHITE); tw(lmBox(6.2, 0.12, 6.2, 0, BL + 1.35, 0), WHITE);
    for (const [x, z] of CORN) lmUrn(T, Bs.trim, x * 3.0, BL + 0.6, z * 3.0, 0.9, WHITE);
    T.geo(Bs.plaster, lmBox(3.8, 3.6, 3.8, 0, BL + 0.6 + 1.8, 0), boxUV(2), CREAM); tw(lmBox(4.3, 0.4, 4.3, 0, BL + 4.4, 0), WHITE);
    tw(new THREE.SphereGeometry(2.1, 16, 8, 0, TAU, 0, Math.PI / 2).scale(1, 0.85, 1).translate(0, BL + 4.6, 0), LEAD);
    tw(new THREE.SphereGeometry(0.3, 8, 6).translate(0, BL + 6.55, 0), GOLD); lmCross(T, Bs.trim, 0, BL + 6.8, 0, 1.1, COL('#3c3c40'));
  }
  mkMesh(Bs.plaster, LMAT.plaster, 10, 'cast', G); mkMesh(Bs.coppi, LMAT.coppi, 10, 'cast', G); mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  mkMesh(Bs.warm, LMAT.warm, 10, false, G); mkMesh(Bs.clock, LMAT.clock, 10, false, G);
}

// San Pietro Martire, Meda: the rhomboid hall in yellow brick banded in white concrete under a low copper roof; at the west tip the tall entrance
// tower: piers with curved heads, the concrete screen up the middle, louvred belfry, green spire, the bronze saint on his corbel over the door
function buildSanPietroMeda(L, B, G) {
  const ring = lmSimplify(B.pts, 0.6), F = lmFrame(new THREE.Matrix4()), Bs = { buff: Buf(), trim: Buf(), lattice: Buf(), louvre: Buf() };
  const xs = ring.map(p => p[0]), xW = Math.min(...xs), w = ring[xs.indexOf(xW)], gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), bot = gy - 0.8, top = gy + 10.0, A = sArea(ring);
  const WHITE = COL('#ece7dc'), COPPER = COL('#6f9a86'), BRONZE = COL('#4e3d2c'), DARK = COL('#2c2b2d');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, ry = Math.atan2(-ez, ex), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
    F.face(Bs.buff, [[a[0], bot, a[1]], [c[0], bot, c[1]], [c[0], top, c[1]], [a[0], top, a[1]]]);
    for (let y = gy + 1.6; y < top - 0.5; y += 1.65) F.geo(Bs.trim, lmBox(Ln, 0.16, 0.06, 0, y, 0).rotateY(ry).translate(mx + nx * 0.03, 0, mz + nz * 0.03), null, WHITE); // white bands
    F.geo(Bs.trim, lmBox(Ln + 0.6, 0.45, 0.5, 0, top - 0.1, 0).rotateY(ry).translate(mx + nx * 0.2, 0, mz + nz * 0.2), null, WHITE);
    const nb = Math.max(1, Math.round(Ln / 4.2)), bw = Ln / nb; // white concrete fins, a tall strip of concrete screen in every bay
    for (let k = 0; k <= nb; k++) F.geo(Bs.trim, lmBox(0.35, top - gy, 0.3, 0, (gy + top) / 2, 0).rotateY(ry).translate(a[0] + ex * k * bw + nx * 0.15, 0, a[1] + ez * k * bw + nz * 0.15), null, WHITE);
    for (let k = 0; k < nb; k++) { const cx = a[0] + ex * (k + 0.5) * bw + nx * 0.07, cz = a[1] + ez * (k + 0.5) * bw + nz * 0.07; F.face(Bs.lattice, [[cx - ex * 0.45, gy + 1.0, cz - ez * 0.45], [cx + ex * 0.45, gy + 1.0, cz + ez * 0.45], [cx + ex * 0.45, top - 0.9, cz + ez * 0.45], [cx - ex * 0.45, top - 0.9, cz - ez * 0.45]]); }
  }
  { // low copper roof, hipped up from the eaves
    let d = 1; for (const t of [6, 4.5, 3, 2]) if (lmInsetOK(ring, lmOffset(ring, t))) { d = t; break; }
    const o = lmOffset(ring, -0.5), r = lmOffset(ring, d), yr = top + 0.22 * (d + 0.5);
    for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; F.face(Bs.trim, [[o[i][0], top + 0.1, o[i][1]], [o[j][0], top + 0.1, o[j][1]], [r[j][0], yr, r[j][1]], [r[i][0], yr, r[i][1]]], 2, COPPER); }
    F.face(Bs.trim, r.map(p => [p[0], yr, p[1]]), 2, COPPER);
    const cx = ring.reduce((t, p) => t + p[0], 0) / ring.length, cz = ring.reduce((t, p) => t + p[1], 0) / ring.length; // the copper lantern with flared sides over the hall
    const prof = [[5.2, 0], [3.6, 0.8], [2.4, 1.9], [1.5, 3.2], [1.0, 4.6], [0.9, 5.4]].map(([r0, h]) => new THREE.Vector2(r0, h));
    F.geo(Bs.trim, new THREE.LatheGeometry(prof, 4).translate(cx, yr - 0.1, cz), null, COPPER);
    F.geo(Bs.trim, lmBox(1.3, 1.1, 1.3, cx, yr + 5.95, cz).rotateY(Math.PI / 4), null, WHITE); F.geo(Bs.trim, new THREE.ConeGeometry(1.0, 0.9, 4).translate(cx, yr + 6.95, cz), null, COPPER);
  }
  // the entrance tower at the west tip, in its own frame: x across its front, +z out towards via San Carlo
  const gw = groundH(w[0] - 2, w[1]), T = lmFrame(new THREE.Matrix4().makeRotationY(-Math.PI / 2).setPosition(w[0] - 1.0, gw, w[1]));
  const tb = g => T.geo(Bs.buff, g, boxUV(2)), tt = (g, c) => T.geo(Bs.trim, g, null, c), CW = 2.7, PW = 1.9, D = 7.0, H = 23.5;
  tb(lmBox(2 * CW, H + 0.8, D, 0, (H - 0.8) / 2, -D / 2));
  for (const sd of [-1, 1]) { // piers rising past the core, their heads curving in
    const x0 = sd * CW, x1 = sd * (CW + PW);
    tb(lmBox(PW, H + 0.8, D + 0.6, (x0 + x1) / 2, (H - 0.8) / 2, -D / 2 + 0.3));
    const hd = new THREE.Shape(); hd.moveTo(x0, H); hd.lineTo(x1, H); hd.lineTo(x1, H + 3.6); hd.quadraticCurveTo(x0 + sd * 0.2, H + 3.4, x0, H + 1.4); hd.lineTo(x0, H);
    tb(new THREE.ExtrudeGeometry(hd, { depth: D + 0.6, bevelEnabled: false, curveSegments: 8 }).translate(0, 0, -D + 0.3));
    for (let y = 2.6; y < H; y += 2.6) tt(lmBox(PW + 0.02, 0.18, 0.05, (x0 + x1) / 2, y, 0.62), WHITE);
  }
  tt(lmBox(3.6, 5.5, 0.08, 0, 2.6, 0.04), WHITE); tt(lmBox(3.0, 5.0, 0.1, 0, 2.5, 0.1), DARK); tt(lmBox(0.05, 5.0, 0.12, 0, 2.5, 0.12), COL('#4a3b2c')); tt(lmBox(4.0, 0.3, 1.6, 0, 5.45, 0.8), WHITE); // door under its canopy
  T.geo(Bs.lattice, new THREE.PlaneGeometry(1.6, 10.5).translate(0, 13.6, 0.07)); tt(lmBox(2.0, 10.9, 0.06, 0, 13.6, 0.0), WHITE); // the screen up the front
  T.geo(Bs.louvre, new THREE.PlaneGeometry(3.0, 3.4).translate(0, H - 1.6, 0.05)); T.geo(Bs.louvre, new THREE.PlaneGeometry(3.0, 3.4).rotateY(Math.PI).translate(0, H - 1.6, -D - 0.05));
  tt(lmBox(3.4, 0.25, 0.3, 0, H - 3.4, 0.15), WHITE); tt(lmBox(2 * CW + 0.1, 0.3, D + 0.1, 0, H + 0.95, -D / 2), WHITE);
  tt(new THREE.ConeGeometry(1.1, 3.4, 4).rotateY(Math.PI / 4).translate(0, H + 2.8, -1.4), COPPER); tt(new THREE.SphereGeometry(0.2, 8, 6).translate(0, H + 4.6, -1.4), COPPER);
  for (const sd of [-1, 1]) { // louvres and a column of small windows on the flanks, green canopies at the foot
    const xf = sd * (CW + PW + 0.06);
    T.geo(Bs.louvre, new THREE.PlaneGeometry(2.6, 4.2).rotateY(sd * Math.PI / 2).translate(xf, H - 2.4, -D / 2 - 0.4));
    for (let y = 7.5; y < H - 5; y += 2.0) tt(lmBox(0.06, 0.55, 0.55, xf, y, -1.2), DARK);
    tt(lmBox(3.4, 0.18, 1.6, sd * (CW + PW + 1.7), 3.4, -D + 1.2), COPPER);
  }
  tt(lmBox(1.0, 0.35, 0.8, -(CW + PW / 2), 7.8, 0.75), WHITE); lmStatue(T, Bs.trim, -(CW + PW / 2), 7.95, 0.75, 1.15, BRONZE); // San Pietro Martire, Giancarlo Fontana
  for (let k = 0; k < 4; k++) tt(lmBox(14 - 2 * k, 0.15, 1.2 + 0.0 * k, 0, 0.15 * k - 0.05, 2.0 + 1.2 * (3 - k) / 2), COL('#cfc8b8')); // the sagrato steps
  mkMesh(Bs.buff, LMAT.buff, 10, 'cast', G); mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); mkMesh(Bs.lattice, LMAT.lattice, 10, false, G); mkMesh(Bs.louvre, LMAT.louvre, 10, false, G);
}

// ---------------------------------------------------------------- generic pieces for the smaller churches: body on the footprint, facades, bell towers
const skelTex = canvasTex(64, 128, (g, w, h) => { // the danse macabre panels of Santi Nazaro e Celso: a white skeleton on red ochre
  g.fillStyle = '#c4785c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#efe6d6'; g.fillStyle = '#efe6d6'; g.lineWidth = 3;
  g.beginPath(); g.arc(32, 22, 8, 0, TAU); g.fill(); g.beginPath(); g.moveTo(32, 30); g.lineTo(32, 76); g.moveTo(20, 40); g.lineTo(44, 40); g.moveTo(22, 48); g.lineTo(42, 48); g.moveTo(24, 56); g.lineTo(40, 56);
  g.moveTo(20, 40); g.lineTo(14, 70); g.moveTo(44, 40); g.lineTo(52, 66); g.moveTo(32, 76); g.lineTo(22, 116); g.moveTo(32, 76); g.lineTo(42, 116); g.moveTo(52, 30); g.lineTo(52, 100); g.stroke();
  g.strokeStyle = '#8a3a2a'; g.lineWidth = 4; g.strokeRect(2, 2, w - 4, h - 4);
}, false);
const madonnaTex = canvasTex(128, 64, (g, w, h) => { g.fillStyle = '#d9c19a'; g.fillRect(0, 0, w, h); g.fillStyle = '#2f4f86'; g.beginPath(); g.moveTo(64, 14); g.lineTo(84, 64); g.lineTo(44, 64); g.fill(); g.fillStyle = '#e8c9a4'; g.beginPath(); g.arc(64, 14, 7, 0, TAU); g.fill(); g.strokeStyle = '#c9a54a'; g.lineWidth = 2; g.beginPath(); g.arc(64, 14, 10, 0, TAU); g.stroke(); g.fillStyle = '#7a2a2a'; g.fillRect(20, 30, 14, 34); g.fillRect(94, 30, 14, 34); }, false);
LMAT.skel = new THREE.MeshLambertMaterial({ map: skelTex }); LMAT.madonna = new THREE.MeshLambertMaterial({ map: madonnaTex });
// walls on the footprint ring (plaster or brick), cornice, hipped roof of coppi from the eaves to a crest; returns the crest height
function lmBody(F, Bs, ring, y0, E, o = {}) {
  const A = sArea(ring), wb = Bs[o.wall || 'plaster'];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.2) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    F.face(wb, [[a[0], y0, a[1]], [c[0], y0, c[1]], [c[0], E, c[1]], [a[0], E, a[1]]], 2, o.col);
    if (o.trim) F.geo(Bs.trim, lmBox(Ln + 0.3, 0.35, 0.4, 0, E - 0.18, 0).rotateY(Math.atan2(-(c[1] - a[1]) / Ln, (c[0] - a[0]) / Ln)).translate((a[0] + c[0]) / 2 + nx * 0.15, 0, (a[1] + c[1]) / 2 + nz * 0.15), null, o.trim);
  }
  let d = 0.6; for (const t of [o.d || 5, 4, 3, 2, 1.2]) if (lmInsetOK(ring, lmOffset(ring, t))) { d = t; break; }
  const oo = lmOffset(ring, -(o.over || 0.6)), r = lmOffset(ring, d), yr = E + (o.slope || 0.45) * (d + (o.over || 0.6)), rb = Bs[o.roof || 'coppi'];
  for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; F.face(rb, [[oo[i][0], E, oo[i][1]], [oo[j][0], E, oo[j][1]], [r[j][0], yr, r[j][1]], [r[i][0], yr, r[i][1]]], 2, o.roofCol); }
  try { F.face(rb, r.map(p => [p[0], yr, p[1]]), 2, o.roofCol); } catch (e) { }
  return yr;
}
// a plastered bell tower in its own frame: lesene, string courses, clock faces, open belfry, cornice, then a lead dome, a drum with a little dome, or a spire
function lmTower(T, Bs, o) {
  const w = o.w, h = o.h, col = COL(o.col), tr = COL(o.trim), tw = (g, c) => T.geo(Bs.trim, g, null, c), BT = h + 4.2, CORN = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  T.geo(Bs.plaster, lmBox(w, h + 1.5, w, 0, (h - 1.5) / 2, 0), boxUV(2), col);
  for (const [x, z] of CORN) tw(lmBox(0.55, h + 1.5, 0.55, x * (w / 2 - 0.15), (h - 1.5) / 2, z * (w / 2 - 0.15)), tr);
  for (let y = h / 3; y < h; y += h / 3) tw(lmBox(w + 0.25, 0.3, w + 0.25, 0, y, 0), tr);
  tw(lmBox(w + 0.6, 0.5, w + 0.6, 0, h + 0.25, 0), tr);
  for (const [x, z] of CORN) tw(lmBox(1.0, BT - h - 0.5, 1.0, x * (w / 2 - 0.5), (h + 0.5 + BT) / 2, z * (w / 2 - 0.5)), col);
  tw(lmBox(w - 1.6, BT - h - 0.5, w - 1.6, 0, (h + 0.5 + BT) / 2, 0), COL('#2a2826'));
  for (let k = 0; k < 4; k++) {
    const a = k * Math.PI / 2; tw(lmBox(w - 0.2, 0.8, 0.4, 0, BT - 0.4, w / 2 - 0.2).rotateY(a), col);
    if (o.clock) { T.geo(Bs.clock, new THREE.CircleGeometry(w * 0.2, 20).translate(0, h - w * 0.35, w / 2 + 0.03).rotateY(a)); tw(new THREE.RingGeometry(w * 0.2, w * 0.24, 20).translate(0, h - w * 0.35, w / 2 + 0.02).rotateY(a), tr); }
  }
  tw(lmBox(w + 0.6, 0.5, w + 0.6, 0, BT + 0.25, 0), tr);
  let y = BT + 0.5;
  if (o.top === 'drum') { T.geo(Bs.plaster, new THREE.CylinderGeometry(w * 0.32, w * 0.34, 2.2, 12).translate(0, y + 1.1, 0), boxUV(2), col); y += 2.2; tw(new THREE.SphereGeometry(w * 0.36, 12, 6, 0, TAU, 0, Math.PI / 2).translate(0, y, 0), COL('#8b8d92')); y += w * 0.36; }
  else if (o.top === 'spire') { tw(new THREE.ConeGeometry(w * 0.62, w * 1.4, 4).rotateY(Math.PI / 4).translate(0, y + w * 0.7, 0), COL(o.spire || '#a24a35')); y += w * 1.4; }
  else { tw(new THREE.SphereGeometry(w * 0.5, 14, 7, 0, TAU, 0, Math.PI / 2).scale(1, 0.8, 1).translate(0, y, 0), COL('#5d6168')); y += w * 0.4; }
  tw(new THREE.SphereGeometry(0.22, 8, 6).translate(0, y + 0.15, 0), COL('#c9a54a')); lmCross(T, Bs.trim, 0, y + 0.3, 0, 1.0, COL('#3c3c40'));
}
const lmBuffers = () => ({ walk: Buf(), plaster: Buf(), coppi: Buf(), trim: Buf(), warm: Buf(), clock: Buf(), brick: Buf(), skel: Buf(), madonna: Buf() });
function lmFlush(Bs, G) {
  for (const [k, m, sh] of [['walk', LMAT.trim, 'cast'], ['plaster', LMAT.plaster, 'cast'], ['coppi', LMAT.coppi, 'cast'], ['trim', LMAT.trim, 'cast'], ['brick', LMAT.brick, 'cast'], ['warm', LMAT.warm, false], ['clock', LMAT.clock, false], ['skel', LMAT.skel, false], ['madonna', LMAT.madonna, false]]) if (Bs[k] && Bs[k].i.length) { const me = mkMesh(Bs[k], m, 10, sh, G); if (k === 'walk') me.userData.walk = true; }
}

// neoclassical two-order facade of the Brianza parish churches: pilasters, portal, niches with saints, upper order with a window or a rose,
// pediment with statues and urns; L.o: { col, trim, E1 (lower order top), UH (upper order height), uw (its half width), rose, niches, obelisks, tower }
function buildChiesaNeo(L, B, G) {
  const { F, W2, ry } = lmChurchFrame(L), o = L.o, Bs = lmBuffers(), F0 = lmFrame(new THREE.Matrix4());
  const ring = lmSimplify(B.pts, 0.5), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), COLW = COL(o.col), TRIM = COL(o.trim), STAT = COL('#ece8e0'), DOOR = COL('#4a3426');
  lmBody(F0, Bs, ring, gy - 1, gy + o.E, { col: COLW, trim: TRIM, d: 4 });
  const box = (w, h, d, x, y, z, c = TRIM) => F.geo(Bs.trim, lmBox(w, h, d, x, y, z), null, c), wallP = pts => F.face(Bs.plaster, pts, 2, COLW);
  const E1 = o.E1, U1 = E1 + 0.9, T0 = U1 + o.UH, T1 = T0 + 0.8, uw = o.uw, AP = T1 + uw * 0.5;
  wallP([[-W2, -1.5, 0.02], [W2, -1.5, 0.02], [W2, E1, 0.02], [-W2, E1, 0.02]]); wallP([[-uw, U1 - 0.1, 0.02], [uw, U1 - 0.1, 0.02], [uw, T1, 0.02], [-uw, T1, 0.02]]); wallP([[-uw - 0.3, T1, 0.02], [uw + 0.3, T1, 0.02], [0, AP, 0.02]]);
  const px = [-W2 + 0.4, -uw + 0.4, -1.9, 1.9, uw - 0.4, W2 - 0.4].filter((x, i, a) => a.findIndex(y => Math.abs(y - x) < 0.9) === i);
  for (const x of px) { box(0.8, E1, 0.3, x, E1 / 2, 0.17); box(1.0, 0.45, 0.45, x, 0.22, 0.22); box(1.0, 0.4, 0.45, x, E1 - 0.2, 0.22); }
  box(2 * W2 + 0.5, 0.9, 0.6, 0, E1 + 0.45, 0.3);
  for (const x of [-uw + 0.35, -1.6, 1.6, uw - 0.35]) { box(0.7, T0 - U1, 0.28, x, (U1 + T0) / 2, 0.16); box(0.9, 0.35, 0.4, x, T0 - 0.18, 0.2); }
  box(2 * uw + 0.5, 0.8, 0.6, 0, T0 + 0.4, 0.3); box(2 * uw + 0.9, 0.22, 0.85, 0, T1 - 0.05, 0.4);
  // portal: arched door in a frame under a small pediment
  F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(3.1, 0, 6.0), 12).translate(0, 0, 0.05), null, TRIM); box(2.5, 4.6, 0.1, 0, 2.3, 0.08, DOOR);
  F.geo(Bs.madonna, new THREE.CircleGeometry(1.15, 14, 0, Math.PI).translate(0, 4.65, 0.1)); box(3.8, 0.3, 0.5, 0, 6.3, 0.25);
  if (o.niches) for (const sd of [-1, 1]) { const x = sd * (uw > 4.2 ? 3.6 : W2 - 1.6); F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(1.1, 2.0, 5.2), 10).translate(x, 0, 0.04), null, COL('#cfc4ae')); lmStatue(F, Bs.trim, x, 2.1, 0.3, 1.3, STAT); }
  if (o.rose) { F.geo(Bs.warm, new THREE.CircleGeometry(1.6, 20).translate(0, (U1 + T0) / 2, 0.06)); F.geo(Bs.trim, new THREE.RingGeometry(1.6, 2.1, 24).translate(0, (U1 + T0) / 2, 0.05), null, TRIM); for (let k = 0; k < 8; k++) F.geo(Bs.trim, lmBox(0.08, 3.2, 0.06, 0, 0, 0).rotateZ(k * Math.PI / 8).translate(0, (U1 + T0) / 2, 0.08), null, TRIM); }
  else { F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(1.9, U1 + 1.2, U1 + 4.6), 10).translate(0, 0, 0.04), null, TRIM); F.geo(Bs.warm, new THREE.ShapeGeometry(archShape(1.4, U1 + 1.45, U1 + 4.35), 10).translate(0, 0, 0.06)); }
  for (const sd of [-1, 1]) {
    if (W2 > uw + 0.6) { const v = new THREE.Shape(); v.moveTo(sd * uw, U1 - 0.1); v.lineTo(sd * (W2 - 0.2), U1 - 0.1); v.quadraticCurveTo(sd * (uw + 0.3), U1 + 0.4, sd * uw, U1 + Math.min(3.2, o.UH * 0.6)); v.lineTo(sd * uw, U1 - 0.1); F.geo(Bs.trim, new THREE.ShapeGeometry(v, 8).translate(0, 0, 0.03), null, COLW); lmUrn(F, Bs.trim, sd * (W2 - 0.4), U1 - 0.1, 0.3, 1.0, TRIM); }
    const sl = hyp(uw + 0.3, AP - T1), ang = Math.atan2(AP - T1, uw + 0.3);
    F.geo(Bs.trim, new THREE.BoxGeometry(sl + 0.4, 0.3, 0.7).rotateZ(-sd * ang).translate(sd * (uw + 0.3) / 2, (T1 + AP) / 2 + 0.15, 0.2), null, TRIM);
    lmStatue(F, Bs.trim, sd * uw, T1, 0.25, 1.2, STAT);
    if (o.obelisks) F.geo(Bs.trim, new THREE.ConeGeometry(0.45, 3.2, 4).rotateY(Math.PI / 4).translate(sd * (W2 - 0.5), E1 + 0.9 + 1.6, 0.3), null, TRIM);
  }
  F.geo(Bs.trim, new THREE.CircleGeometry(0.6, 14).translate(0, T1 + 1.0, 0.05), null, TRIM); box(0.5, 0.4, 0.5, 0, AP + 0.1, 0.1); lmCross(F, Bs.trim, 0, AP + 0.3, 0.1, 1.3, COL('#5b5c60'));
  for (let k = 0; k < 3; k++) box(2 * W2 + 1.6 - k * 0.8, 0.15 * (k + 1) + 0.4, 2.6 - 0.8 * k, 0, (0.15 * (k + 1) - 0.4) / 2, 1.3 - 0.4 * k, COL('#cfc6b2'));
  if (o.tower) { const [tx, tz] = o.tower.at; lmTower(lmFrame(new THREE.Matrix4().makeRotationY(ry).setPosition(tx, groundH(tx, tz), tz)), Bs, { col: o.col, trim: o.trim, ...o.tower }); }
  lmFlush(Bs, G);
}
// Santi Nazaro e Celso: the little church of the old Farga, gable roof on wide wooden eaves, skeletons and the Madonna painted on the front, a glazed lantern for a bell
function buildNazaroCelso(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), Bs = lmBuffers(), ring = lmSimplify(B.pts, 0.3), F0 = lmFrame(new THREE.Matrix4()), gy = Math.min(...ring.map(p => groundH(p[0], p[1])));
  const W = COL('#ddb48e'), ED = COL('#c27a5a'), WOOD = COL('#4b3a2c'), E = 4.6, R = 6.9, LEN = 8.3;
  lmBody(F0, Bs, ring, gy - 1, gy + E, { col: COL('#e8d7bd'), d: 3, over: 0.9, slope: 0.55 });
  F.face(Bs.plaster, [[-W2, -1, 0.02], [W2, -1, 0.02], [W2, E, 0.02], [0, R, 0.02], [-W2, E, 0.02]], 2, W);
  for (const sd of [-1, 1]) { // wide eaves over the front, rafters showing
    F.face(Bs.coppi, [[sd * (W2 + 0.8), E - 0.35, 1.2], [0, R + 0.15, 1.2], [0, R + 0.15, -LEN], [sd * (W2 + 0.8), E - 0.35, -LEN]]);
    F.geo(Bs.trim, new THREE.BoxGeometry(hyp(W2 + 0.8, R - E + 0.5) + 0.2, 0.35, 0.25).rotateZ(-sd * Math.atan2(R - E + 0.5, W2 + 0.8)).translate(sd * (W2 + 0.8) / 2, (R + E) / 2 - 0.15, 1.1), null, WOOD);
    F.geo(Bs.skel, new THREE.PlaneGeometry(1.3, 2.6).translate(sd * 2.0, 2.6, 0.05)); F.geo(Bs.trim, lmBox(0.1, E, 0.06, sd * (W2 - 0.25), E / 2, 0.04), null, ED);
  }
  F.geo(Bs.trim, lmBox(1.6, 2.8, 0.1, 0, 1.4, 0.06), null, COL('#3c5654')); F.geo(Bs.trim, lmBox(2.0, 3.1, 0.06, 0, 1.55, 0.03), null, COL('#bcb3a2'));
  F.geo(Bs.madonna, new THREE.CircleGeometry(1.0, 14, 0, Math.PI).translate(0, 3.35, 0.05)); F.geo(Bs.trim, lmBox(1.6, 0.5, 0.06, 0, 5.3, 0.04), null, COL('#e2c9a0'));
  for (let k = 0; k < 2; k++) F.geo(Bs.trim, lmBox(4.0 - k, 0.15, 1.2 - 0.5 * k, 0, 0.07 + 0.15 * k - 0.05, 0.6 - 0.25 * k), null, COL('#a9a397'));
  // the glazed bell lantern at the front of the ridge
  F.geo(Bs.trim, lmBox(1.0, 0.25, 1.0, 0, R + 0.15, -1.0), null, WOOD); F.geo(Bs.warm, new THREE.CylinderGeometry(0.45, 0.45, 0.8, 6).translate(0, R + 0.7, -1.0));
  F.geo(Bs.trim, new THREE.ConeGeometry(0.75, 0.55, 6).translate(0, R + 1.35, -1.0), null, COL('#2f3d38')); lmCross(F, Bs.trim, 0, R + 1.6, -1.0, 0.9, COL('#2b2b2e'));
  lmFlush(Bs, G);
}
// a neo-romanesque front: plain gable with hanging arches, a great arch round the portal and the three lancets, a little bell spire on the apex
function buildChiesaRom(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), o = L.o, Bs = lmBuffers(), ring = lmSimplify(B.pts, 0.5), F0 = lmFrame(new THREE.Matrix4()), gy = Math.min(...ring.map(p => groundH(p[0], p[1])));
  const W = COL(o.col), TR = COL(o.trim), E = o.E, AP = o.E + W2 * 0.75;
  lmBody(F0, Bs, ring, gy - 1, gy + E - 1.5, { col: W, trim: TR, d: 4 });
  F.face(Bs.plaster, [[-W2, -1, 0.02], [W2, -1, 0.02], [W2, E, 0.02], [0, AP, 0.02], [-W2, E, 0.02]], 2, W);
  for (const sd of [-1, 1]) {
    F.geo(Bs.trim, lmBox(0.7, E, 0.35, sd * (W2 - 0.35), E / 2, 0.18), null, W);
    const sl = hyp(W2, AP - E), ang = Math.atan2(AP - E, W2); F.geo(Bs.trim, new THREE.BoxGeometry(sl + 0.3, 0.3, 0.5).rotateZ(-sd * ang).translate(sd * W2 / 2, (E + AP) / 2 + 0.1, 0.2), null, TR);
    for (let t = 0.08; t < 0.95; t += 0.09) F.geo(Bs.trim, new THREE.RingGeometry(0.22, 0.32, 8, 1, Math.PI, Math.PI).translate(sd * W2 * (1 - t), E + (AP - E) * t - 0.45, 0.05), null, TR); // archetti pensili
  }
  const aw = Math.min(5.2, W2 * 1.2), atop = E + 1.4;
  F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(aw + 0.6, 0, atop + 0.3), 14).translate(0, 0, 0.03), null, TR); F.geo(Bs.plaster, new THREE.ShapeGeometry(archShape(aw, 0, atop), 14).translate(0, 0, 0.06), null, COL(o.recess || o.col));
  F.geo(Bs.trim, new THREE.ShapeGeometry(archShape(2.6, 0, 4.6), 10).translate(0, 0, 0.08), null, TR); F.geo(Bs.trim, lmBox(2.0, 3.6, 0.08, 0, 1.8, 0.12), null, COL('#4a3426'));
  F.geo(Bs.madonna, new THREE.CircleGeometry(0.95, 12, 0, Math.PI).translate(0, 3.65, 0.12)); F.geo(Bs.trim, lmBox(aw - 0.4, 0.25, 0.3, 0, 5.4, 0.15), null, TR);
  for (const x of [-0.85, 0, 0.85]) F.geo(Bs.warm, new THREE.ShapeGeometry(archShape(0.5, 6.0, x ? 8.4 : 8.9), 6).translate(x, 0, 0.1));
  F.geo(Bs.trim, lmBox(0.8, 0.8, 0.8, 0, AP + 0.3, -0.2), null, TR); F.geo(Bs.trim, new THREE.ConeGeometry(0.5, 2.2, 6).translate(0, AP + 1.8, -0.2), null, COL('#8c8a86')); lmCross(F, Bs.trim, 0, AP + 2.8, -0.2, 0.8, COL('#2b2b2e'));
  for (let k = 0; k < 2; k++) F.geo(Bs.trim, lmBox(aw + 2 - k, 0.15, 1.8 - 0.6 * k, 0, 0.07 + 0.15 * k - 0.05, 0.9 - 0.3 * k), null, COL('#bdb6a8'));
  lmFlush(Bs, G);
}
// San Giacomo, Meda: a long brick hall under one metal slope that climbs from the low wall on via Emilia to the high east corner, where the cross
// stands; a lower wing leans the other way beside it; the big round window of louvres on the south end, tall slit windows down the low side
function buildSanGiacomo(L, B, G) {
  const { F, W2 } = lmChurchFrame(L), Bs = lmBuffers(), LEN = L.len, ROOF = COL('#55595e'), GREY = COL('#d9d6cf'), FRAME = COL('#e8e4dc');
  const mono = (x0, x1, y0, y1) => { // walls and a single roof slope from height y0 at x0 to y1 at x1
    F.face(Bs.brick, [[x0, -1, 0], [x0, -1, -LEN], [x0, y0, -LEN], [x0, y0, 0]]); F.face(Bs.brick, [[x1, -1, 0], [x1, -1, -LEN], [x1, y1, -LEN], [x1, y1, 0]]);
    for (const z of [0, -LEN]) F.face(Bs.brick, [[x0, -1, z], [x1, -1, z], [x1, y1, z], [x0, y0, z]]);
    const k = (y1 - y0) / (x1 - x0), e = Math.sign(x1 - x0) * 0.45;
    F.face(Bs.trim, [[x0 - e, y0 - k * e + 0.05, 0.45], [x1 + e, y1 + k * e + 0.05, 0.45], [x1 + e, y1 + k * e + 0.05, -LEN - 0.45], [x0 - e, y0 - k * e + 0.05, -LEN - 0.45]], 2, ROOF);
    for (const z of [0.47, -LEN - 0.47]) F.geo(Bs.trim, new THREE.BoxGeometry(hyp(x1 - x0, y1 - y0) + 1.0, 0.25, 0.1).rotateZ(Math.atan2(y1 - y0, x1 - x0)).translate((x0 + x1) / 2, (y0 + y1) / 2 + 0.12, z), null, FRAME);
  };
  const XH = 1.5; mono(-W2, XH, 4.8, 12.0); mono(XH, W2, 8.0, 4.6);
  for (let z = -4; z > -LEN + 3; z -= 4.5) { F.geo(Bs.trim, lmBox(0.06, 3.1, 0.8, -W2 - 0.04, 2.3, z), null, FRAME); F.geo(Bs.warm, new THREE.PlaneGeometry(0.55, 2.8).rotateY(-Math.PI / 2).translate(-W2 - 0.08, 2.3, z)); } // slit windows on the low side
  F.geo(Bs.trim, lmBox(0.08, 2.5, 1.5, -W2 - 0.05, 1.25, -LEN + 6), null, COL('#9aa0a6'));
  const cx = -4.3, wy = 6.0; // the round window of louvres on the south end
  F.geo(Bs.trim, new THREE.CircleGeometry(2.1, 28).translate(cx, wy, 0.06), null, GREY); F.geo(Bs.trim, new THREE.RingGeometry(2.1, 2.35, 28).translate(cx, wy, 0.07), null, FRAME);
  for (let k = 0; k < 10; k++) { const y = -1.8 + k * 0.4; F.geo(Bs.trim, lmBox(2 * Math.sqrt(Math.max(0, 4.4 - y * y)) - 0.3, 0.13, 0.08, 0, 0, 0).rotateZ(0.5).translate(cx, wy + y, 0.1), null, COL('#6d7075')); }
  F.geo(Bs.trim, lmBox(1.6, 2.5, 0.1, -W2 + 2.6, 1.25, 0.06), null, COL('#9aa0a6'));
  F.geo(Bs.trim, lmBox(0.7, 4.8, 0.08, XH - 0.8, 3.0, 0.06), null, COL('#b9bdc1')); // glazed strip at the high corner
  F.geo(Bs.trim, lmBox(0.18, 4.6, 0.18, XH - 0.3, 12.0 + 2.1, -0.3), null, COL('#3a3a3c')); F.geo(Bs.trim, lmBox(1.9, 0.16, 0.16, XH - 0.3, 15.2, -0.3), null, COL('#3a3a3c')); // the cross over the high corner
  lmFlush(Bs, G);
}
// the Cappella di San Pietro da Verona at the edge of Seveso: a white cube under a pyramid of coppi, a grated round window and door in stone frames
function buildCappellaSPM(L, B, G) {
  const ring = lmSimplify(B.pts, 0.3), F0 = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), [cx, cz] = centroid(ring);
  lmBody(F0, Bs, ring, gy - 1, gy + 4.4, { col: COL('#f0eee8'), trim: COL('#e6e2da'), d: 3.2, over: 0.5, slope: 0.62 });
  const T = lmFrame(new THREE.Matrix4().makeRotationY(L.ry).setPosition(cx, gy, cz)), STONE = COL('#bdb6a8');
  T.geo(Bs.trim, new THREE.ShapeGeometry(archShape(1.2, 1.9, 3.3), 10).translate(0, 0, 3.05), null, STONE); T.geo(Bs.trim, new THREE.ShapeGeometry(archShape(0.9, 2.05, 3.15), 10).translate(0, 0, 3.08), null, COL('#2c2a28'));
  T.geo(Bs.trim, lmBox(1.3, 2.4, 0.1, 0, 1.2, 0).translate(3.05, 0, 0).rotateY(0), null, STONE); T.geo(Bs.trim, lmBox(0.1, 2.2, 1.0, 3.1, 1.1, 0), null, COL('#3a3027'));
  lmFlush(Bs, G);
}
// Villa Bianca, Seveso (Giuseppe Terragni, 1937): white rationalist volumes, ribbon windows, the thin roof slab flying out over the terraces
function buildVillaBianca(L, B, G) {
  const ring = lmSimplify(B.pts, 0.4), F0 = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), A = sArea(ring);
  const WHITE = COL('#f2f1ec'), GLASS = COL('#38424c'), TOP = gy + 7.6;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    F0.face(Bs.plaster, [[a[0], gy - 1, a[1]], [c[0], gy - 1, c[1]], [c[0], TOP, c[1]], [a[0], TOP, a[1]]], 2, WHITE);
    if (Ln > 3) for (const [y0, y1] of [[gy + 1.1, gy + 2.6], [gy + 4.6, gy + 6.4]]) { const m = 0.6, ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln; F0.face(Bs.trim, [[a[0] + ex * m + nx * 0.04, y0, a[1] + ez * m + nz * 0.04], [c[0] - ex * m + nx * 0.04, y0, c[1] - ez * m + nz * 0.04], [c[0] - ex * m + nx * 0.04, y1, c[1] - ez * m + nz * 0.04], [a[0] + ex * m + nx * 0.04, y1, a[1] + ez * m + nz * 0.04]], 2, GLASS); }
  }
  const o = lmOffset(ring, -1.8); F0.face(Bs.trim, o.map(p => [p[0], TOP + 0.6, p[1]]), 2, WHITE); F0.face(Bs.trim, o.map(p => [p[0], TOP + 0.3, p[1]]), 2, COL('#d8d6d0'));
  for (let i = 0; i < o.length; i++) { const j = (i + 1) % o.length; F0.face(Bs.trim, [[o[i][0], TOP + 0.3, o[i][1]], [o[j][0], TOP + 0.3, o[j][1]], [o[j][0], TOP + 0.6, o[j][1]], [o[i][0], TOP + 0.6, o[i][1]]], 2, WHITE); }
  for (const p of ring) F0.geo(Bs.trim, lmBox(0.3, 0.6, 0.3, p[0], TOP + 0.3, p[1]), null, WHITE);
  lmFlush(Bs, G);
}

// ---------------------------------------------------------------- railway platforms (banchine): raised slabs with the white edge and the yellow line, and near each station
// the canopies on posts, the stairs down to the underpass, the blue name boards, benches and lamps
const PLAT_STATIONS = D.pois.filter(p => p.k === 'stazione');
const PLAT_MAT = { top: new THREE.MeshLambertMaterial({ map: sidewalkTex, color: 0xd8d4cc }), side: new THREE.MeshLambertMaterial({ map: concreteTex }), line: new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }) };
const STATION_SIGN = {};
function stationSignMat(name) { // the blue Ferrovienord board with the station's name
  if (STATION_SIGN[name]) return STATION_SIGN[name];
  const t = canvasTex(512, 96, (g, w, h) => { g.fillStyle = '#1f3f8c'; g.fillRect(0, 0, w, h); g.strokeStyle = '#ffffff'; g.lineWidth = 4; g.strokeRect(6, 6, w - 12, h - 12); g.fillStyle = '#ffffff'; g.textAlign = 'center'; g.textBaseline = 'middle'; let fs = 56; g.font = `bold ${fs}px Arial, sans-serif`; while (g.measureText(name).width > w - 40 && fs > 20) { fs -= 2; g.font = `bold ${fs}px Arial, sans-serif`; } g.fillText(name, w / 2, h / 2 + 3); }, false);
  return (STATION_SIGN[name] = new THREE.MeshLambertMaterial({ map: t, side: THREE.DoubleSide }));
}
// across-section of a polygon on the line through (cx,cz)+u*s, perpendicular to u: the [vmin, vmax] where it is inside
function lmSection(poly, cx, cz, ux, uz, s) {
  const ox = cx + ux * s, oz = cz + uz * s; let lo = 1e9, hi = -1e9;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], c = poly[(i + 1) % poly.length], sa = (a[0] - ox) * ux + (a[1] - oz) * uz, sc = (c[0] - ox) * ux + (c[1] - oz) * uz;
    if ((sa > 0) === (sc > 0)) continue; const t = sa / (sa - sc), x = a[0] + (c[0] - a[0]) * t, z = a[1] + (c[1] - a[1]) * t, v = (x - ox) * -uz + (z - oz) * ux;
    lo = Math.min(lo, v); hi = Math.max(hi, v);
  }
  return hi > lo ? [lo, hi] : null;
}
function buildPlatforms(T, G) {
  if (!T.pf) return;
  const top = FBuf(), side = Buf(), line = FBuf(), F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf(), warm: Buf() }, boards = new Map();
  const WHITE = COL('#f2f0ea'), YELLOW = COL('#f2c230'), METAL = COL('#7d858d'), POST = COL('#5d646b'), DARK = COL('#1f2022'), WOOD = COL('#8a6a48');
  for (const P of T.pf) {
    try { polyFill(top, P.o, P.k, PLAT_H, 4); } catch (e) { }
    const A = sArea(P.o);
    for (const [ring, hole] of [[P.o, false], ...P.k.map(h => [h, true])]) for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.05) continue;
      let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if ((A < 0) !== hole) { nx = -nx; nz = -nz; }
      const ga = groundH(a[0], a[1]), gc = groundH(c[0], c[1]), b0 = side.p.length / 3;
      vtx(side, a[0], ga - 0.3, a[1], nx, 0, nz, 0, 0); vtx(side, c[0], gc - 0.3, c[1], nx, 0, nz, Ln / 2, 0); vtx(side, c[0], gc + PLAT_H, c[1], nx, 0, nz, Ln / 2, 0.4); vtx(side, a[0], ga + PLAT_H, a[1], nx, 0, nz, 0, 0.4);
      side.i.push(b0, b0 + 1, b0 + 2, b0, b0 + 2, b0 + 3, b0, b0 + 2, b0 + 1, b0, b0 + 3, b0 + 2);
      if (hole || !nearRail((a[0] + c[0]) / 2, (a[1] + c[1]) / 2, 4.5)) continue; // track side: white edge and the yellow line inside it
      for (const [d0, d1, col] of [[0, 0.32, WHITE], [0.85, 0.97, YELLOW]]) { const l0 = line.p.length / 3; for (const [p, d] of [[a, d0], [c, d0], [c, d1], [a, d1]]) vtx(line, p[0] - nx * d, PLAT_H + 0.012, p[1] - nz * d, 0, 1, 0, 0, 0, col); line.i.push(l0, l0 + 1, l0 + 2, l0, l0 + 2, l0 + 3, l0, l0 + 2, l0 + 1, l0, l0 + 3, l0 + 2); }
    }
    // furniture, only on the platforms of a station: along the platform's long axis
    const [cx, cz] = centroid(P.o), st = PLAT_STATIONS.slice().sort((p, q) => hyp(p.x - cx, p.z - cz) - hyp(q.x - cx, q.z - cz))[0];
    if (!st || hyp(st.x - cx, st.z - cz) > 220) continue;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P.o) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang), proj = P.o.map(([x, z]) => (x - cx) * ux + (z - cz) * uz), s0 = Math.min(...proj) + 2, s1 = Math.max(...proj) - 2;
    const name = (st.n || '').replace(/^Stazione di /, '').toUpperCase(), ry = Math.atan2(-uz, ux);
    const at = (s, v) => [cx + ux * s - uz * v, cz + uz * s + ux * v];
    let lastPost = null, stairs = false;
    for (let s = s0; s <= s1; s += 1) {
      const sec = lmSection(P.o, cx, cz, ux, uz, s); if (!sec) continue; const wd = sec[1] - sec[0]; if (wd < 2.6) continue;
      const vm = (sec[0] + sec[1]) / 2, [x, z] = at(s, vm), gy = groundH(x, z) + PLAT_H, dst = hyp(x - st.x, z - st.z), si = Math.round(s - s0);
      const covered = dst < 60;
      if (covered && si % 7 === 0) { // canopy: posts down the middle, a metal roof between them, lights underneath
        F.geo(Bs.trim, lmBox(0.22, 3.4, 0.22, x, gy + 1.7, z), null, POST);
        if (lastPost && s - lastPost.s <= 7.5) { const cw = Math.min(wd - 0.6, 4.4), mx = (x + lastPost.x) / 2, mz = (z + lastPost.z) / 2, my = (gy + lastPost.gy) / 2 + 3.5; F.geo(Bs.trim, lmBox(s - lastPost.s + 0.1, 0.16, cw, mx, my, mz, ry), null, METAL); F.geo(Bs.warm, lmBox(s - lastPost.s - 0.6, 0.05, 0.25, mx, my - 0.11, mz, ry)); F.geo(Bs.trim, lmBox(s - lastPost.s + 0.1, 0.3, 0.12, mx, my - 0.2, mz, ry), null, POST); }
        lastPost = { s, x, z, gy };
      }
      if (covered && si % 14 === 3 && wd > 3.4) { // bench
        F.geo(Bs.trim, lmBox(1.8, 0.08, 0.45, x, gy + 0.45, z, ry), null, WOOD); F.geo(Bs.trim, lmBox(1.8, 0.4, 0.06, 0, 0, 0, 0).translate(0, gy + 0.75, -0.22).rotateY(ry).translate(x, 0, z), null, WOOD);
        for (const e of [-0.75, 0.75]) F.geo(Bs.trim, lmBox(0.08, 0.45, 0.4, 0, gy + 0.22, 0).translate(e, 0, 0).rotateY(ry).translate(x, 0, z), null, POST);
      }
      if (!covered && si % 15 === 7) { F.geo(Bs.trim, lmBox(0.14, 4.6, 0.14, x, gy + 2.3, z), null, POST); F.geo(Bs.warm, lmBox(0.6, 0.12, 0.25, x, gy + 4.55, z, ry)); } // platform lamp
      if (si % 40 === 20 && name) { // name board on two posts, readable from the trains
        for (const e of [-1.4, 1.4]) { const [px, pz] = [x + ux * e, z + uz * e]; F.geo(Bs.trim, lmBox(0.1, 3.0, 0.1, px, gy + 1.5, pz), null, POST); }
        const b = boards.get(name) || Buf(); boards.set(name, b); const i0 = b.p.length / 3, nx2 = -uz, nz2 = ux;
        for (const [e, yy, u, v] of [[-1.5, 2.2, 0, 0], [1.5, 2.2, 1, 0], [1.5, 2.85, 1, 1], [-1.5, 2.85, 0, 1]]) vtx(b, x + ux * e + nx2 * 0.06, gy + yy, z + uz * e + nz2 * 0.06, nx2, 0, nz2, u, v);
        b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
      }
      if (!stairs && dst < 25 && wd > 4.2 && si > 8 && s < s1 - 8) { // stairs down to the underpass: railed opening, a little glass roof
        stairs = true; const L2 = 6.5, W2 = 0.9;
        F.geo(Bs.trim, lmBox(L2, 0.04, 2 * W2, x, gy + 0.03, z, ry), null, DARK);
        for (const e of [-1, 1]) F.geo(Bs.trim, lmBox(L2, 0.06, 0.06, 0, gy + 1.05, e * (W2 + 0.05)).rotateY(ry).translate(x, 0, z), null, COL('#9aa1a8'));
        for (let k = 0; k <= 4; k++) for (const e of [-1, 1]) F.geo(Bs.trim, lmBox(0.05, 1.05, 0.05, 0, gy + 0.52, 0).translate(-L2 / 2 + k * L2 / 4, 0, e * (W2 + 0.05)).rotateY(ry).translate(x, 0, z), null, COL('#9aa1a8'));
        F.geo(Bs.trim, lmBox(0.06, 1.05, 2 * W2, 0, gy + 0.52, 0).translate(L2 / 2, 0, 0).rotateY(ry).translate(x, 0, z), null, COL('#9aa1a8'));
        F.geo(Bs.trim, lmBox(L2 + 0.6, 0.08, 2 * W2 + 0.8, x, gy + 2.6, z, ry), null, COL('#bcd0da'));
        for (const e of [-1, 1]) F.geo(Bs.trim, lmBox(0.08, 2.6, 0.08, 0, gy + 1.3, 0).translate(e * L2 / 2, 0, W2 + 0.3).rotateY(ry).translate(x, 0, z), null, POST);
      }
    }
  }
  mkMesh(top, PLAT_MAT.top, 9, false, G); mkMesh(side, PLAT_MAT.side, 9, false, G); mkMesh(line, PLAT_MAT.line, 10, false, G);
  mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G); if (Bs.warm.i.length) mkMesh(Bs.warm, LMAT.warm, 10, false, G);
  for (const [n, b] of boards) mkMesh(b, stationSignMat(n), 10, false, G);
}

// parking stalls: white lines across the long side of every car park, one or two rows depending on its width, never over the aisles (OSM service
// roads) or a building; one yellow stall with the wheelchair per row of eight or more; T.stalls keeps every stall for the parked cars (parkTile);
// on the bigger car parks lamp posts down the middle, a parking meter and the blue P sign
const PSIGN_MAT = new THREE.MeshLambertMaterial({ map: canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#1f4fa8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 3; g.strokeRect(3, 3, w - 6, h - 6); g.fillStyle = '#fff'; g.font = 'bold 46px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', w / 2, h / 2 + 3); }, false), side: THREE.DoubleSide });
function buildParkingLines(T, G) {
  const b = FBuf(), W = COL('#e9e7df'), Y = COL('#f2c230'), BLUE = COL('#2c5aa8'), F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf() }, lamps = Buf(), heads = Buf(), sign = Buf();
  T.stalls = [];
  const quad = (x, z, ux, uz, a0, a1, w0, w1, col) => { const nx = -uz, nz = ux, i0 = b.p.length / 3; for (const [s, v] of [[a0, w0], [a1, w0], [a1, w1], [a0, w1]]) vtx(b, x + ux * s + nx * v, 0.05, z + uz * s + nz * v, 0, 1, 0, 0, 0, col); b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3, i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2); };
  for (const a of T.d.a || []) {
    if (a.t !== 4) continue; const P = dec(a.p); if (P.length < 3) continue; const [cx, cz] = centroid(P); if (inPiazza(cx, cz)) continue;
    let sxx = 0, szz = 0, sxz = 0; for (const [x, z] of P) { sxx += (x - cx) ** 2; szz += (z - cz) ** 2; sxz += (x - cx) * (z - cz); }
    const ang = 0.5 * Math.atan2(2 * sxz, sxx - szz), ux = Math.cos(ang), uz = Math.sin(ang), nx = -uz, nz = ux, proj = P.map(([x, z]) => (x - cx) * ux + (z - cz) * uz);
    const S0 = Math.min(...proj) + 1.0, S1 = Math.max(...proj) - 1.0, lot = [];
    const ok = (s, v) => { const x = cx + ux * s + nx * v, z = cz + uz * s + nz * v; return inPoly(x, z, P) && !inBuilding(x, z, 0.3) && !onAnyRoad(x, z, -0.4); };
    for (const row of [0, 1]) {
      let run = [];
      const flush = () => { // a run of free stalls side by side: the lines between them, the yellow one every eighth
        if (run.length) { const yi = run.length >= 8 ? 1 : -1; run.forEach((st, k) => { const col = k === yi ? Y : W; quad(cx, cz, ux, uz, st.s - 1.31, st.s - 1.19, st.v0, st.v1, col); quad(cx, cz, ux, uz, st.s + 1.19, st.s + 1.31, st.v0, st.v1, col); if (k === yi) { quad(cx, cz, ux, uz, st.s - 0.5, st.s + 0.5, (st.v0 + st.v1) / 2 - 0.5, (st.v0 + st.v1) / 2 + 0.5, BLUE); st.dis = true; } lot.push(st); }); }
        run = [];
      };
      for (let s = S0 + 1.25; s <= S1 - 1.25; s += 2.5) {
        const sec = lmSection(P, cx, cz, ux, uz, s), sa = lmSection(P, cx, cz, ux, uz, s - 1.2), sb = lmSection(P, cx, cz, ux, uz, s + 1.2);
        if (!sec || !sa || !sb) { flush(); continue; }
        const lo = Math.max(sec[0], sa[0], sb[0]), hi = Math.min(sec[1], sa[1], sb[1]), w = hi - lo;
        if (w < 5 || (row === 1 && w < 10.5)) { flush(); continue; }
        const v0 = row ? hi - 4.8 : lo + 0.2, v1 = row ? hi - 0.2 : lo + 4.8, vm = (v0 + v1) / 2;
        if (!ok(s, vm) || !ok(s - 0.9, vm) || !ok(s + 0.9, vm)) { flush(); continue; }
        const x = cx + ux * s + nx * vm, z = cz + uz * s + nz * vm;
        run.push({ s, v0, v1, x, z, h: Math.atan2(nx, nz) + (row ? 0 : Math.PI) }); // nose towards the aisle in the middle
      }
      flush();
    }
    T.stalls.push(...lot);
    if (lot.length >= 10) { // furniture on the bigger lots: lamps along the middle, the meter and the P sign at one end
      const mid = (S0 + S1) / 2, sec = lmSection(P, cx, cz, ux, uz, mid);
      for (let s = S0 + 6; s < S1 - 3; s += 22) { const sc = lmSection(P, cx, cz, ux, uz, s); if (!sc) continue; const v = (sc[0] + sc[1]) / 2, x = cx + ux * s + nx * v, z = cz + uz * s + nz * v; if (onAnyRoad(x, z, 0.5) && !onFoot(x, z) || inBuilding(x, z, 0.5)) continue; const gy = groundH(x, z); addBox(lamps, x, gy + 3.8, z, 0.15, 7.6, 0.15, null); addBox(heads, x + ux * 0.5, gy + 7.55, z + uz * 0.5, 1.2, 0.18, 0.35, null); addBox(heads, x - ux * 0.5, gy + 7.55, z - uz * 0.5, 1.2, 0.18, 0.35, null); }
      const e = lmSection(P, cx, cz, ux, uz, S0 + 0.5);
      if (e) { const x = cx + ux * (S0 + 0.3) + nx * e[0] - nx * -0.6, z = cz + uz * (S0 + 0.3) + nz * e[0] + nz * 0.6, gy = groundH(x, z), ry = Math.atan2(-uz, ux);
        F.geo(Bs.trim, lmBox(0.08, 2.6, 0.08, x, gy + 1.3, z), null, COL('#8a8f95'));
        const i0 = sign.p.length / 3; for (const [dx, dy, u, v] of [[-0.35, 2.2, 0, 0], [0.35, 2.2, 1, 0], [0.35, 2.9, 1, 1], [-0.35, 2.9, 0, 1]]) vtx(sign, x + nx * dx, gy + dy, z + nz * dx, ux, 0, uz, u, v); sign.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
        const mx = x + nx * 1.5, mz = z + nz * 1.5; F.geo(Bs.trim, lmBox(0.3, 1.5, 0.25, 0, 0, 0).rotateY(ry).translate(mx, gy + 0.75, mz), null, COL('#3c4650')); F.geo(Bs.trim, lmBox(0.32, 0.25, 0.27, 0, 0, 0).rotateY(ry).translate(mx, gy + 1.5, mz), null, COL('#e2b436')); } // parking meter
    }
  }
  if (b.i.length) mkMesh(b, PLAT_MAT.line, 5, false, G);
  if (Bs.trim.i.length) mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  if (lamps.i.length) { mkMesh(lamps, MAT.lamp, 10, 'cast', G); mkMesh(heads, MAT.lampHead, 10, false, G); }
  if (sign.i.length) mkMesh(sign, PSIGN_MAT, 10, false, G);
}
// park furniture: along the footpaths inside parks and gardens, benches every so often (on alternate sides) and lamp posts, a bin by each bench;
// a flower bed fills the middle of a small round plaza where paths meet
function buildParkFurniture(T, G) {
  const parks = (T.d.a || []).filter(a => a.t === 2).map(a => { const o = dec(a.p); return { o, bb: bbox(o) }; }).filter(p => p.o.length >= 3);
  if (!parks.length) return;
  const inPark = (x, z, m = 8) => parks.some(p => { // inside a park or garden, or along its edge
    if (x < p.bb[0] - m || x > p.bb[2] + m || z < p.bb[1] - m || z > p.bb[3] + m) return false; if (inPoly(x, z, p.o)) return true;
    for (let i = 0; i < p.o.length; i++) { const A = p.o[i], C = p.o[(i + 1) % p.o.length]; if (segDist(x, z, A[0], A[1], C[0], C[1]) < m) return true; } return false; });
  const F = lmFrame(new THREE.Matrix4()), Bs = { trim: Buf() }, lamps = Buf(), heads = Buf();
  const WOOD = COL('#7a5a3c'), IRON = COL('#2e3236'), BIN = COL('#3d5a3a'), x0 = T.cx - TS / 2, z0 = T.cz - TS / 2;
  for (const r of D.roads) {
    if (r.c !== 6 || r.d || r.t) continue;
    let acc = 0, k = 0;
    for (let i = 1; i < r.g.length; i++) {
      const A = N[r.g[i - 1]], C = N[r.g[i]], Ln = hyp(C[0] - A[0], C[1] - A[1]); if (Ln < 0.5) continue;
      const ux = (C[0] - A[0]) / Ln, uz = (C[1] - A[1]) / Ln, nx = -uz, nz = ux, ry = Math.atan2(-uz, ux);
      for (let s = (12 - acc % 12); s < Ln; s += 12) {
        const x = A[0] + ux * s, z = A[1] + uz * s; k++;
        if (x < x0 || x >= x0 + TS || z < z0 || z >= z0 + TS || !inPark(x, z)) continue;
        const sd = k % 2 ? 1 : -1, off = r.w / 2 + 0.9, bx = x + nx * off * sd, bz = z + nz * off * sd, gy = groundH(bx, bz);
        if (inBuilding(bx, bz, 1.2) || onAnyRoad(bx, bz, 0.2) && !onFoot(bx, bz) || nearPlaza(bx, bz)) continue;
        if (k % 3) { // bench facing the path, a bin beside it
          const R = ry + (sd > 0 ? Math.PI : 0), at = (dx, dz) => [bx + Math.cos(R) * dx + Math.sin(R) * dz, bz - Math.sin(R) * dx + Math.cos(R) * dz];
          F.geo(Bs.trim, lmBox(1.8, 0.07, 0.42, 0, gy + 0.45, 0).rotateY(R).translate(bx, 0, bz), null, WOOD);
          F.geo(Bs.trim, lmBox(1.8, 0.36, 0.06, 0, gy + 0.78, -0.2).rotateY(R).translate(bx, 0, bz), null, WOOD);
          for (const e of [-0.75, 0.75]) { const [px, pz] = at(e, 0); F.geo(Bs.trim, lmBox(0.07, 0.45, 0.45, 0, 0, 0).rotateY(R).translate(px, gy + 0.22, pz), null, IRON); }
          const [qx, qz] = at(1.4, 0); F.geo(Bs.trim, new THREE.CylinderGeometry(0.22, 0.2, 0.75, 10).translate(qx, gy + 0.37, qz), null, BIN);
        } else { addBox(lamps, bx, gy + 2.0, bz, 0.11, 4.0, 0.11, null); addBox(heads, bx, gy + 4.05, bz, 0.42, 0.22, 0.42, null); } // park lamp
      }
      acc += Ln;
    }
  }
  for (const r of D.roads) { // small closed loops of path (a round plaza): a raised bed of flowers inside
    if (r.c !== 6 || r.g.length < 8 || r.g[0] !== r.g[r.g.length - 1]) continue;
    const pts = r.g.map(i => N[i]), [cx, cz] = centroid(pts.slice(0, -1)), rad = Math.min(...pts.map(p => hyp(p[0] - cx, p[1] - cz))) - r.w / 2 - 0.3;
    if (rad < 1.5 || rad > 9 || nearPlaza(cx, cz) || tileOf(cx, cz) !== T.t || !inPark(cx, cz, 14) || onAnyRoad(cx, cz, 0) && !onFoot(cx, cz)) continue;
    const gy = groundH(cx, cz);
    F.geo(Bs.trim, new THREE.CylinderGeometry(rad, rad, 0.4, 28).translate(cx, gy + 0.2, cz), null, COL('#bcb6aa'));
    F.geo(Bs.trim, new THREE.CylinderGeometry(rad - 0.25, rad - 0.25, 0.1, 28).translate(cx, gy + 0.42, cz), null, COL('#5d4632'));
    for (let i = 0; i < 40; i++) { const a = i * 2.4, d = (rad - 0.6) * Math.sqrt((i + 0.5) / 40); F.geo(Bs.trim, new THREE.IcosahedronGeometry(0.28, 0).translate(cx + Math.cos(a) * d, gy + 0.6, cz + Math.sin(a) * d), null, COL(['#d8364a', '#f0c23a', '#e87ab0', '#ffffff', '#5f8f3a'][i % 5])); }
  }
  if (Bs.trim.i.length) mkMesh(Bs.trim, LMAT.trim, 10, 'cast', G);
  if (lamps.i.length) { mkMesh(lamps, MAT.lamp, 10, 'cast', G); mkMesh(heads, MAT.lampHead, 10, false, G); }
}

// the Medateca on via Yuri Gagarin: a red box; on the street front the glazed ground floor, a red band with a slit window and, above, white fins
// in front of dark glass up to the red parapet; the side on the garden red with scattered square windows and a band of glass over the ground floor;
// a glazed lantern on the roof. o.front, o.side: points by the street front and by the garden side
function buildMedateca(L, B, G) {
  const o = L.o, ring = lmSimplify(B.pts, 0.4), F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), H = gy + o.h, A = sArea(ring);
  const lettering = [], RED = COL('#b23a2c'), DARK = COL('#2d3a40'), FIN = COL('#e3e3df'), GL = COL('#5d7d86'), near = (q, a, c) => segDist(q[0], q[1], a[0], a[1], c[0], c[1]);
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, ry = Math.atan2(-ez, ex), P = (s, y, q) => [a[0] + ex * s + nx * q, y, a[1] + ez * s + nz * q];
    const quad = (s0, s1, y0, y1, q, col) => F.face(Bs.trim, [P(s0, y0, q), P(s1, y0, q), P(s1, y1, q), P(s0, y1, q)], 2, col);
    const front = near(o.front, a, c) < 3, side = near(o.side, a, c) < 3;
    F.face(Bs.plaster, [P(0, gy - 1, 0), P(Ln, gy - 1, 0), P(Ln, H, 0), P(0, H, 0)], 2, RED);
    F.geo(Bs.trim, lmBox(Ln + 0.3, 0.6, 0.35, 0, 0, 0).rotateY(ry).translate((a[0] + c[0]) / 2 + nx * 0.12, H + 0.3, (a[1] + c[1]) / 2 + nz * 0.12), null, RED);
    if (front) {
      quad(0.7, Ln - 0.7, gy + 0.1, gy + 3.3, 0.06, GL); lettering.push([P(Ln / 2, gy + 2.3, 0.1), ex, ez, nx, nz, Ln - 2]); for (let t = 0.7; t <= Ln - 0.6; t += 1.7) F.geo(Bs.trim, lmBox(0.1, 3.2, 0.1, 0, 0, 0).translate(...[P(t, 0, 0.1)].map(q => [q[0], gy + 1.7, q[2]])[0]), null, DARK);
      quad(1.5, Ln - 1.5, gy + 3.9, gy + 4.4, 0.04, DARK); // the slit window in the red band
      quad(0.7, Ln - 0.7, gy + 5.0, H - 1.2, 0.04, DARK);
      for (let t = 1.0; t < Ln - 0.8; t += 0.62) F.geo(Bs.trim, lmBox(0.14, H - 1.2 - gy - 5.0, 0.55, 0, 0, 0).rotateY(ry).translate(a[0] + ex * t + nx * 0.35, (gy + 5.0 + H - 1.2) / 2, a[1] + ez * t + nz * 0.35), null, FIN);
    } else if (side) { // towards the garden: the double-height glazed bay by the fins, a red box standing out with its tall window, slits and little
      // square windows, a ribbon of windows over the ground floor, glass under it towards the street
      quad(0, Ln * 0.42, gy + 0.1, gy + 3.0, 0.05, GL);
      quad(0.8, Ln - 1.0, gy + 3.7, gy + 4.6, 0.05, DARK); for (let t = 0.8; t < Ln - 0.9; t += 0.55) F.geo(Bs.trim, lmBox(0.06, 0.9, 0.08, 0, 0, 0).translate(...[P(t, 0, 0.09)].map(q => [q[0], gy + 4.15, q[2]])[0]), null, FIN);
      quad(0.3, Ln * 0.26, gy + 5.4, H - 1.0, 0.05, GL); quad(0.3, Ln * 0.26, gy + 8.9, gy + 9.3, 0.08, DARK); // the glazed bay, a dark transom halfway
      for (let t = 0.3; t <= Ln * 0.26 + 0.01; t += (Ln * 0.26 - 0.3) / 3) F.geo(Bs.trim, lmBox(0.08, H - 1.0 - gy - 5.4, 0.08, 0, 0, 0).translate(...[P(t, 0, 0.09)].map(q => [q[0], (gy + 5.4 + H - 1.0) / 2, q[2]])[0]), null, FIN);
      const b0 = Ln * 0.3, b1 = Ln * 0.42; // the box standing out half a metre, its tall window
      F.geo(Bs.trim, lmBox(b1 - b0, H - 2.4 - gy - 5.0, 0.6, 0, 0, 0).rotateY(ry).translate(...[P((b0 + b1) / 2, 0, 0.3)].map(q => [q[0], (gy + 5.0 + H - 2.4) / 2, q[2]])[0]), null, RED);
      quad(b0 + 0.4, b1 - 0.4, gy + 5.6, H - 3.2, 0.62, GL);
      for (const [t, y0, y1] of [[0.5, 6.6, 8.6], [0.56, 6.6, 8.6], [0.68, 6.0, 7.6], [0.8, 6.0, 7.6], [0.53, 9.6, 11.4], [0.66, 10.2, 11.8], [0.86, 9.6, 11.4]]) quad(Ln * t - 0.22, Ln * t + 0.22, gy + y0, gy + y1, 0.05, DARK);
      for (const t of [0.45, 0.62, 0.72, 0.9]) quad(Ln * t - 0.3, Ln * t + 0.3, H - 2.0, H - 1.4, 0.05, DARK);
    }
  }
  try { polyFill(Bs.trim, ring, [], H + 0.02, 2, COL('#7f7a74')); } catch (e) { }
  const [cx, cz] = centroid(ring), bx = cx + (o.side[0] - cx) * 0.35, bz = cz + (o.side[1] - cz) * 0.35, ry = Math.atan2(-(o.side[1] - cz), o.side[0] - cx);
  F.geo(Bs.trim, lmBox(7.5, 2.0, 6.5, 0, 0, 0).rotateY(ry).translate(bx, H + 1.0, bz), null, COL('#e2e0da')); // the lantern on the roof, glazed on top
  F.geo(Bs.trim, lmBox(5.5, 0.4, 4.5, 0, 0, 0).rotateY(ry).translate(bx, H + 2.15, bz), null, GL);
  if (o.gate) { // next door, on the street, the gate of the flats at via Gagarin 15: two piers in exposed-aggregate concrete under a dark slab, the
    // iron gates between them, a low wall with its railing along the garden towards the tower, a short wall on the other side
    const [gx, gz, gr] = o.gate, AG = COL('#a39a89'), y = groundH(gx, gz), ux = Math.cos(gr), uz = -Math.sin(gr);
    for (const sd of [-1, 1]) F.geo(Bs.trim, lmBox(0.8, 2.6, 3.2, 0, 0, 0).rotateY(gr).translate(gx + ux * sd * 1.7, y + 1.3, gz + uz * sd * 1.7), null, AG);
    F.geo(Bs.trim, lmBox(4.8, 0.35, 3.8, 0, 0, 0).rotateY(gr).translate(gx, y + 2.75, gz), null, COL('#3b3d40'));
    for (let k = -1.2; k <= 1.2; k += 0.15) F.geo(Bs.trim, lmBox(0.04, 2.0, 0.04, 0, 0, 0).translate(gx + ux * k, y + 1.0, gz + uz * k), null, COL('#4a4c4e'));
    for (let k = 2.6; k < 9; k += 0.14) F.geo(Bs.trim, lmBox(0.04, 1.3, 0.04, 0, 0, 0).translate(gx + ux * k, y + 1.25, gz + uz * k), null, COL('#6c7074'));
    F.geo(Bs.trim, lmBox(6.4, 0.6, 0.35, 0, 0, 0).rotateY(gr).translate(gx + ux * 5.8, y + 0.3, gz + uz * 5.8), null, AG);
    F.geo(Bs.trim, lmBox(6.4, 0.06, 0.06, 0, 0, 0).rotateY(gr).translate(gx + ux * 5.8, y + 1.9, gz + uz * 5.8), null, COL('#6c7074'));
    F.geo(Bs.trim, lmBox(3.0, 1.5, 0.35, 0, 0, 0).rotateY(gr).translate(gx - ux * 3.6, y + 0.75, gz - uz * 3.6), null, AG); // the wall on the Medateca side
    F.geo(Bs.trim, lmBox(0.5, 0.6, 0.08, 0, 0, 0).rotateY(gr).translate(gx + ux * 1.25 + Math.sin(gr) * 0.45, y + 1.5, gz + uz * 1.25 + Math.cos(gr) * 0.45), null, COL('#c9c6bd')); // the doorbells
  }
  lmFlush(Bs, G);
  for (const [[x, y, z], ex, ez, nx, nz, w] of lettering) { // MEDATECA repeated on the glass of the ground floor
    const g = Buf(); lmLetters(g, x, y, z, nx, nz, w, 0.7);
    const tex = canvasTex(1024, 64, (cg, W, Hh) => { cg.clearRect(0, 0, W, Hh); cg.fillStyle = 'rgba(235,238,236,.85)'; cg.font = '600 40px Arial, sans-serif'; cg.textBaseline = 'middle'; for (let k = 0, x0 = 10; x0 < W; k++, x0 += cg.measureText('MEDATECA  ').width) cg.fillText('MEDATECA  ', x0, Hh / 2); }, false);
    mkMesh(g, new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide }), 11, false, G);
  }
}

// the shops of corso della Resistenza: a portico on brown-red pillars with striped awnings, the shop windows set back, and over it two floors of
// beige panels standing out between bordeaux bays with the windows; o: { h, floors }
const awningTex = canvasTex(64, 32, (g, w, h) => { for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? '#f1ece2' : '#6b4a3c'; g.fillRect(x, 0, 8, h); } });
function buildPortici(L, B, G) {
  const o = L.o, ring = lmSimplify(B.pts, 0.4), F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), aw = Buf(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), H = gy + o.h, A = sArea(ring);
  const BEIGE = COL('#9a8a6c'), BORD = COL('#5c1a24'), PIL = COL('#6a3a30'), GL = COL('#4a5660'), PH = 3.6, fh = (o.h - PH) / o.floors;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, ry = Math.atan2(-ez, ex), P = (s, y, q) => [a[0] + ex * s + nx * q, y, a[1] + ez * s + nz * q];
    const quad = (b, s0, s1, y0, y1, q, col) => F.face(b, [P(s0, y0, q), P(s1, y0, q), P(s1, y1, q), P(s0, y1, q)], 2, col);
    quad(Bs.plaster, 0, Ln, gy + PH, H, 0, BORD); quad(Bs.plaster, 0, Ln, gy - 1, gy + PH, -2.4, COL('#9a948a')); // the bordeaux skin; the shop front 2.4 m back
    quad(Bs.trim, 0.2, Ln - 0.2, gy + 0.05, gy + PH - 0.5, -2.35, GL);
    F.face(Bs.trim, [P(0, gy + PH, 0), P(Ln, gy + PH, 0), P(Ln, gy + PH, -2.4), P(0, gy + PH, -2.4)], 2, COL('#5a4a42')); // the portico ceiling
    if (Ln < 4) continue;
    for (let t = 0.3; t < Ln; t += 4.2) F.geo(Bs.trim, lmBox(0.35, PH, 0.35, 0, 0, 0).rotateY(ry).translate(...[P(t, 0, -0.2)].map(q => [q[0], gy + PH / 2, q[2]])[0]), null, PIL);
    const k0 = aw.p.length / 3; for (const [s, y, q, u, v] of [[0, gy + PH - 0.1, 0.9, 0, 0], [Ln, gy + PH - 0.1, 0.9, Ln / 1.6, 0], [Ln, gy + PH + 0.5, -0.05, Ln / 1.6, 1], [0, gy + PH + 0.5, -0.05, 0, 1]]) { const q2 = P(s, y, q); vtx(aw, q2[0], q2[1], q2[2], nx * 0.6, 0.8, nz * 0.6, u, v); } aw.i.push(k0, k0 + 1, k0 + 2, k0, k0 + 2, k0 + 3, k0, k0 + 2, k0 + 1, k0, k0 + 3, k0 + 2); // the striped awning all along
    for (let t = 0.2; t < Ln - 1.0; t += 4.2) { // a beige panel standing out, then the bordeaux bay with its windows
      F.geo(Bs.trim, lmBox(Math.min(2.6, Ln - t), H - gy - PH - 0.2, 0.35, 0, 0, 0).rotateY(ry).translate(...[P(t + 1.3, 0, 0.18)].map(q => [q[0], (gy + PH + H) / 2, q[2]])[0]), null, BEIGE);
      if (t + 3.0 < Ln) for (let f = 0; f < o.floors; f++) { const y0 = gy + PH + f * fh; quad(Bs.trim, t + 2.8, t + 3.9, y0 + fh * 0.35, y0 + fh * 0.85, 0.04, GL); quad(Bs.trim, t + 2.8, t + 3.9, y0 + fh * 0.33, y0 + fh * 0.36, 0.06, COL('#d9d4c8')); }
    }
    F.geo(Bs.trim, lmBox(Ln + 0.3, 0.5, 0.45, 0, 0, 0).rotateY(ry).translate(...[P(Ln / 2, 0, 0.2)].map(q => [q[0], H + 0.25, q[2]])[0]), null, BEIGE);
  }
  try { polyFill(Bs.trim, ring, [], H + 0.02, 2, COL('#7f7a74')); } catch (e) { }
  lmFlush(Bs, G); mkMesh(aw, new THREE.MeshLambertMaterial({ map: awningTex, side: THREE.DoubleSide }), 10, false, G);
}

// a quad of lettering in world space facing (nx, nz), its u running to the right of someone reading it
function lmLetters(b, cx, cy, cz, nx, nz, w, h) {
  const lx = nz, lz = -nx, i0 = b.p.length / 3;
  for (const [s, t, u, v] of [[-1, -1, 0, 0], [1, -1, 1, 0], [1, 1, 1, 1], [-1, 1, 0, 1]]) vtx(b, cx + lx * w / 2 * s, cy + h / 2 * t, cz + lz * w / 2 * s, nx, 0, nz, u, v);
  b.i.push(i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
}
// the oratorio of Meda with the Istituto Milani on via Generale Cantore: brick wings round a court, two floors of windows in white frames and dark
// pitched roofs (the one along the street hipped, the long one ribbed), the hall in the corner with tall slit windows under its wavy roof, and
// towards the playing fields the long flat canopy on thin pillars you walk under. Laid out in its own frame: a from the south corner o towards
// the street, b towards the west; o.ua and o.ub the two directions
function buildMilani(L, B, G) {
  const o = L.o, [ox, oz] = o.o, gy = groundH(ox, oz), Bs = lmBuffers();
  const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(o.ua[0], 0, o.ua[1]), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-o.ub[0], 0, -o.ub[1])).setPosition(ox, gy, oz));
  const BRICK = COL('#b0573a'), WIN = COL('#2f3a44'), FR = COL('#e9e6de'), ROOF = COL('#55504c'), DARK = COL('#3d3b39');
  const q = (b, pts, col) => T.face(b, pts.map(([a, y, bb]) => [a, y, -bb]), 2, col); // faces in (a, y, b)
  const wing = (a0, a1, b0, b1, h, floors, roof) => {
    const C = [[a0, b0], [a1, b0], [a1, b1], [a0, b1]];
    for (let i = 0; i < 4; i++) {
      const [pa, pb] = C[i], [ca, cb] = C[(i + 1) % 4], L2 = hyp(ca - pa, cb - pb), ea = (ca - pa) / L2, eb = (cb - pb) / L2, na = eb, nb = -ea; // outward for this winding
      q(Bs.brick, [[pa, -1, pb], [ca, -1, cb], [ca, h, cb], [pa, h, pb]]);
      for (let f = 0; f < floors; f++) for (let t = 1.6; t < L2 - 1.2; t += 3.2) { const y0 = 0.9 + f * 3.4, m = 0.06, A0 = pa + ea * t, B0 = pb + eb * t;
        q(Bs.trim, [[A0 + na * m, y0 - 0.1, B0 + nb * m], [A0 + ea * 1.5 + na * m, y0 - 0.1, B0 + eb * 1.5 + nb * m], [A0 + ea * 1.5 + na * m, y0 + 1.9, B0 + eb * 1.5 + nb * m], [A0 + na * m, y0 + 1.9, B0 + nb * m]], FR);
        q(Bs.trim, [[A0 + ea * 0.12 + na * 0.09, y0, B0 + eb * 0.12 + nb * 0.09], [A0 + ea * 1.38 + na * 0.09, y0, B0 + eb * 1.38 + nb * 0.09], [A0 + ea * 1.38 + na * 0.09, y0 + 1.75, B0 + eb * 1.38 + nb * 0.09], [A0 + ea * 0.12 + na * 0.09, y0 + 1.75, B0 + eb * 0.12 + nb * 0.09]], WIN); }
    }
    const la = a1 - a0, lb = b1 - b0, ov = 0.6, rh = Math.min(la, lb) * 0.22, ma = (a0 + a1) / 2, mb = (b0 + b1) / 2;
    if (roof === 'hip') { const r = la > lb ? [[a0 + lb / 2, mb], [a1 - lb / 2, mb]] : [[ma, b0 + la / 2], [ma, b1 - la / 2]], E = [[a0 - ov, b0 - ov], [a1 + ov, b0 - ov], [a1 + ov, b1 + ov], [a0 - ov, b1 + ov]];
      const near = (p) => la > lb ? (p[0] < ma ? r[0] : r[1]) : (p[1] < mb ? r[0] : r[1]);
      for (let i = 0; i < 4; i++) { const p = E[i], c = E[(i + 1) % 4], rp = near(p), rc = near(c); if (rp === rc) q(Bs.trim, [[p[0], h, p[1]], [c[0], h, c[1]], [rp[0], h + rh, rp[1]]], ROOF); else q(Bs.trim, [[p[0], h, p[1]], [c[0], h, c[1]], [rc[0], h + rh, rc[1]], [rp[0], h + rh, rp[1]]], ROOF); } }
    else { // ribbed: a row of low pitched ridges across the long side
      const along = la > lb, n = Math.max(2, Math.round((along ? la : lb) / 4.5)), step = (along ? la : lb) / n;
      for (let k = 0; k < n; k++) { const s0 = (along ? a0 : b0) + k * step, s1 = s0 + step, sm = (s0 + s1) / 2, w0 = (along ? b0 : a0) - ov, w1 = (along ? b1 : a1) + ov, P3 = (s, w, y) => along ? [s, y, w] : [w, y, s];
        q(Bs.trim, [P3(s0, w0, h), P3(sm, w0, h + 1.0), P3(sm, w1, h + 1.0), P3(s0, w1, h)], ROOF); q(Bs.trim, [P3(sm, w0, h + 1.0), P3(s1, w0, h), P3(s1, w1, h), P3(sm, w1, h + 1.0)], DARK);
        for (const w of [w0, w1]) q(Bs.trim, [P3(s0, w, h), P3(s1, w, h), P3(sm, w, h + 1.0)], BRICK); }
    }
  };
  for (const w of o.wings) wing(...w.ab, w.h, w.floors, w.roof);
  { // the hall: chamfered corners, tall slit windows, a wavy roof of shallow vaults
    const [a0, a1, b0, b1] = o.hall.ab, H = o.hall.h, c = 3.5, ring = [[a0 + c, b0], [a1 - c, b0], [a1, b0 + c], [a1, b1 - c], [a1 - c, b1], [a0 + c, b1], [a0, b1 - c], [a0, b0 + c]];
    for (let i = 0; i < ring.length; i++) { const [pa, pb] = ring[i], [ca, cb] = ring[(i + 1) % ring.length], L2 = hyp(ca - pa, cb - pb), ea = (ca - pa) / L2, eb = (cb - pb) / L2, na = eb, nb = -ea;
      q(Bs.brick, [[pa, -1, pb], [ca, -1, cb], [ca, H, cb], [pa, H, pb]]);
      for (let t = 1.2; t < L2 - 0.8; t += 2.4) { const A0 = pa + ea * t, B0 = pb + eb * t; q(Bs.trim, [[A0 + na * 0.06, 1.2, B0 + nb * 0.06], [A0 + ea * 0.5 + na * 0.06, 1.2, B0 + eb * 0.5 + nb * 0.06], [A0 + ea * 0.5 + na * 0.06, H - 1.2, B0 + eb * 0.5 + nb * 0.06], [A0 + na * 0.06, H - 1.2, B0 + nb * 0.06]], WIN); } }
    const n = 5, wv = (b1 - b0 + 1.2) / n;
    for (let k = 0; k < n; k++) T.geo(Bs.trim, new THREE.CylinderGeometry(wv / 2, wv / 2, a1 - a0 + 1.2, 10, 1, true, -Math.PI / 2, Math.PI).rotateZ(Math.PI / 2).scale(1, 0.45, 1).translate((a0 + a1) / 2, H, -(b0 - 0.6 + wv * (k + 0.5))), null, ROOF);
    try { polyFill(Bs.trim, lmOffset(ring.map(([a, b]) => [ox + o.ua[0] * a + o.ub[0] * b, oz + o.ua[1] * a + o.ub[1] * b]), 0.2), [], gy + H - 0.05, 2, DARK); } catch (e) { }
  }
  { // the canopy towards the fields: a flat dark slab on thin pillars, paving under it
    const [a0, a1, b0, b1] = o.canopy.ab, H = o.canopy.h;
    T.geo(Bs.trim, lmBox(a1 - a0 + 0.8, 0.45, b1 - b0, (a0 + a1) / 2, H, -(b0 + b1) / 2), null, COL('#4a4c4e'));
    T.geo(Bs.trim, lmBox(a1 - a0 + 0.9, 0.12, b1 - b0 + 0.1, (a0 + a1) / 2, H + 0.25, -(b0 + b1) / 2), null, COL('#6c6e70'));
    for (let b = b0 + 2; b <= b1 - 1; b += 6) for (const a of [a0 + 0.6, (a0 + a1) / 2]) T.geo(Bs.trim, lmBox(0.25, H, 0.25, a, H / 2, -b), null, COL('#8d8f91'));
    T.geo(Bs.walk, lmBox(a1 - a0, 0.1, b1 - b0, (a0 + a1) / 2, 0.02, -(b0 + b1) / 2), null, COL('#a7a299'));
  }
  for (const [a, b] of o.trees || []) { const x = ox + o.ua[0] * a + o.ub[0] * b, z = oz + o.ua[1] * a + o.ub[1] * b, y = groundH(x, z) - gy; T.geo(Bs.trim, new THREE.CylinderGeometry(0.2, 0.28, 2.6, 6).translate(a, y + 1.3, -b), null, COL('#5a4632')); T.geo(Bs.trim, new THREE.IcosahedronGeometry(2.6, 0).scale(1, 0.9, 1).translate(a, y + 4.4, -b), null, COL(Math.abs(a * 7 + b) % 3 < 1.5 ? '#4f7a3a' : '#5d8a44')); }
  { const [a, b] = o.slide, x = ox + o.ua[0] * a + o.ub[0] * b, z = oz + o.ua[1] * a + o.ub[1] * b, y = groundH(x, z) - gy; // the playground: a slide under a yellow cone roof
    T.geo(Bs.trim, lmBox(1.4, 2.0, 1.4, a, y + 1.0, -b), null, COL('#3f7fc0')); T.geo(Bs.trim, new THREE.ConeGeometry(1.2, 1.0, 8).translate(a, y + 2.6, -b), null, COL('#f0c23a')); T.geo(Bs.trim, lmBox(0.8, 0.08, 3.2, a, y + 1.0, -b + 2.0).rotateX(0), null, COL('#3fa0d8')); }
  lmFlush(Bs, G);
}

// Stadio Mino Favini, Meda: the pitch inside a red athletics track (six lanes, the sprint straight running on past the bend), sand and blue mats for
// the jumps, two goals, the dugouts, four floodlight towers; on the west the main stand, seats stepping up under a roof of four cantilevered
// canopies, with a lower covered stand at each side. Laid out in its own frame: a along the pitch from the corner o, b across it
function buildStadio(L, B, G) {
  const o = L.o, [ox, oz] = o.o, [ux, uz] = o.ua, vx = uz, vz = -ux, W = (a, b) => [ox + ux * a + vx * b, oz + uz * a + vz * b], gy = groundH(...W(57, -34));
  const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(-vx, 0, -vz)).setPosition(ox, gy, oz)), Bs = lmBuffers(), g = VBuf();
  const box = (b, w, h, d, a, y, bb, col) => T.geo(b, lmBox(w, h, d, a, y, -bb), null, col);
  // the ground, cell by cell on a 1.5 m grid so it follows the terrain: track, sand of the jumps, the pitch mown in stripes, then the white lines
  const [c0, c1, bc] = o.curves, Ri = o.rin, Ro = o.rout, [p0, p1, q0, q1] = o.pitch, pm = (q0 + q1) / 2, am = (p0 + p1) / 2;
  const rOf = (a, b) => hyp(a - clamp(a, c0, c1), b - bc), TRACK = COL('#b5543f'), SAND = COL('#cdb58f'), G1 = COL('#4f8a3a'), G2 = COL('#5a9643'), GR = COL('#5a8a3f');
  const surf = (a, b) => { const r = rOf(a, b); if (r >= Ri && r <= Ro) return TRACK; if (a > c1 && a <= o.sprint && b - bc >= Ri && b - bc <= Ro) return TRACK;
    if (r < Ri) { if (a >= p0 && a <= p1 && b >= q0 && b <= q1) return Math.floor((a - p0) / 7.5) % 2 ? G1 : G2; const ap = o.apron || [-1e9, bc + 22, null]; return a > p1 && b > ap[0] && b < ap[1] ? (ap[2] ? COL(ap[2]) : SAND) : GR; } /* the run-ups and landing pits at the end of the pitch */ return null; };
  const S = 1.5;
  for (let a = c0 - Ro - S; a < Math.max(o.sprint, c1 + Ro) + S; a += S) for (let b = bc - Ro - S; b < bc + Ro + S; b += S) {
    const col = surf(a + S / 2, b + S / 2); if (!col) continue; const i0 = g.p.length / 3;
    for (const [da, db] of [[0, 0], [S, 0], [S, S], [0, S]]) { const [x, z] = W(a + da, b + db); vtx(g, x, 0.075, z, 0, 1, 0, 0, 0, col); }
    g.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2, i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3);
  }
  const strip = (A, Bp, w) => { const L2 = hyp(Bp[0] - A[0], Bp[1] - A[1]) || 1, n = Math.ceil(L2 / 2); for (let k = 0; k < n; k++) { const P0 = [A[0] + (Bp[0] - A[0]) * k / n, A[1] + (Bp[1] - A[1]) * k / n], P1 = [A[0] + (Bp[0] - A[0]) * (k + 1) / n, A[1] + (Bp[1] - A[1]) * (k + 1) / n], nx = -(Bp[1] - A[1]) / L2 * w / 2, nz = (Bp[0] - A[0]) / L2 * w / 2, i0 = g.p.length / 3;
    for (const [x, z] of [[P0[0] + nx, P0[1] + nz], [P1[0] + nx, P1[1] + nz], [P1[0] - nx, P1[1] - nz], [P0[0] - nx, P0[1] - nz]]) vtx(g, x, 0.11, z, 0, 1, 0, 0, 0, COL("#efece4")); g.i.push(i0, i0 + 2, i0 + 1, i0, i0 + 3, i0 + 2, i0, i0 + 1, i0 + 2, i0, i0 + 2, i0 + 3); } };
  const line = pts => { for (let k = 1; k < pts.length; k++) strip(pts[k - 1], pts[k], 0.12); };
  const oval = r => { const pts = []; for (let i = 0; i <= 24; i++) { const t = -Math.PI / 2 - i / 24 * Math.PI; pts.push(W(c0 + Math.cos(t) * r, bc + Math.sin(t) * r)); } for (let i = 0; i <= 24; i++) { const t = Math.PI / 2 - i / 24 * Math.PI; pts.push(W(c1 + Math.cos(t) * r, bc + Math.sin(t) * r)); } pts.push(pts[0]); return pts; };
  for (let k = 1; k < 6; k++) line(oval(Ri + (Ro - Ri) * k / 6)); // lanes
  line([W(p0, q0), W(p1, q0), W(p1, q1), W(p0, q1), W(p0, q0)]); line([W(am, q0), W(am, q1)]);
  const circ = (a, b, r, t0 = 0, t1 = TAU) => { const pts = []; for (let i = 0; i <= 24; i++) { const t = t0 + (t1 - t0) * i / 24; pts.push(W(a + Math.cos(t) * r, b + Math.sin(t) * r)); } return pts; }; line(circ(am, pm, 9.15));
  for (const [e, sg] of [[p0, 1], [p1, -1]]) { line([W(e, pm - 20.15), W(e + sg * 16.5, pm - 20.15), W(e + sg * 16.5, pm + 20.15), W(e, pm + 20.15)]); line([W(e, pm - 9.15), W(e + sg * 5.5, pm - 9.15), W(e + sg * 5.5, pm + 9.15), W(e, pm + 9.15)]); line(circ(e + sg * 11, pm, 9.15, sg > 0 ? -0.93 : Math.PI - 0.93, sg > 0 ? 0.93 : Math.PI + 0.93)); }
  mkMesh(g, LMAT.yard, 2, false, G);
  const hAt = (a, b) => groundH(...W(a, b)) - gy, WHITE = COL('#f2f2ee');
  for (const [e, sg] of [[p0, 1], [p1, -1]]) { const y = hAt(e, pm); for (const d of [-3.66, 3.66]) box(Bs.trim, 0.12, 2.44, 0.12, e, y + 1.22, pm + d, WHITE); box(Bs.trim, 0.12, 0.12, 7.44, e, y + 2.44, pm, WHITE); box(Bs.trim, 1.8, 0.04, 7.3, e - sg * 0.9, y + 2.2, pm, COL('#d8d8d4')); } // goals, the net on top
  for (const [a, b] of o.mats) box(Bs.trim, 5, 0.5, 4, a, hAt(a, b) + 0.25, b, COL('#2f5fb0')); // the mats of the high jump and pole vault
  for (const a of o.dugouts) { const b = q1 + 4.5, y = hAt(a, b); box(Bs.trim, 6, 0.1, 1.6, a, y + 2.1, b, COL('#cfd6dc')); box(Bs.trim, 6, 2.1, 0.08, a, y + 1.05, b + 0.8, COL('#9aa4ab')); box(Bs.trim, 5.6, 0.45, 0.5, a, y + 0.45, b + 0.3, COL('#2f5fb0')); }
  for (const [a, b] of o.towers) { const y = hAt(a, b); T.geo(Bs.trim, new THREE.CylinderGeometry(0.25, 0.4, 26, 8).translate(a, y + 13, -b), null, COL('#a9adb1')); box(Bs.trim, 4.2, 2.6, 0.4, a, y + 26.5, b, COL('#d9dcdf')); for (let i = 0; i < 6; i++) box(Bs.trim, 0.55, 0.5, 0.1, a - 1.5 + (i % 3) * 1.5, y + 26.0 + Math.floor(i / 3) * 1.1, b + (b < 30 ? 0.22 : -0.22), COL('#fff6d8')); }
  // the stands: concrete terraces from the front up to the back wall, the roof on columns at the back, cantilevered canopies over the seats
  for (const st of o.stands) {
    const [a0, a1, b0, b1] = st.ab, H = st.h, n = Math.round((b1 - b0) / 0.8), CON = COL('#b9b6ae'), SEAT = COL(st.seat || '#d6d8da');
    for (let i = 0; i < n; i++) { const bb = b1 - (i + 0.5) * (b1 - b0) / n, y = 0.4 + i * (H - 2.4) / n; box(Bs.walk, a1 - a0, y, (b1 - b0) / n + 0.02, (a0 + a1) / 2, y / 2, bb, CON); if (i % 1 === 0) box(Bs.trim, a1 - a0 - 0.6, 0.35, 0.35, (a0 + a1) / 2, y + 0.2, bb - 0.15, SEAT); }
    box(Bs.plaster, a1 - a0, H, 0.4, (a0 + a1) / 2, H / 2 - 0.5, b0 + 0.2, CON); for (const a of [a0, a1]) box(Bs.plaster, 0.4, H, b1 - b0, a, H / 2 - 0.5, (b0 + b1) / 2, CON);
    const segs = st.segs || 1, sw = (a1 - a0) / segs;
    for (let k = 0; k < segs; k++) { const am2 = a0 + sw * (k + 0.5); // a canopy sloping down to the front, its beam over the back
      T.geo(Bs.trim, lmBox(sw - 0.3, 0.3, b1 - b0 + 2.5, 0, 0, 0).rotateX(-0.08).translate(am2, H + st.roof, -((b0 + b1) / 2 + 1)), null, COL('#dfe1e3'));
      box(Bs.trim, 0.6, st.roof + 1.2, 0.6, a0 + sw * k + 0.3, H + st.roof / 2 - 0.2, b0 + 0.6, COL('#8d9094')); box(Bs.trim, 0.8, 1.2, b1 - b0 + 2.5, a0 + sw * k + 0.4, H + st.roof + 0.4, (b0 + b1) / 2 + 1, COL('#8d9094')); }
    box(Bs.trim, 0.6, st.roof + 1.2, 0.6, a1 - 0.3, H + st.roof / 2 - 0.2, b0 + 0.6, COL('#8d9094'));
    box(Bs.trim, a1 - a0, 1.0, 0.25, (a0 + a1) / 2, 0.5, b1, COL('#d9d6cf')); // the low wall in front
  }
  lmFlush(Bs, G);
}

// plain buildings of the oratori: plastered walls with windows in light frames on every floor and a roof on the footprint, of coppi or of light
// metal sheet with a coloured eaves trim; o: { wall, h, floors, metal (roof colour), trim, bell: [x, z] (a little bell gable on the ridge) }
function buildCasa(L, B, G) {
  const o = L.o, ring = lmSimplify(B.pts, 0.4), F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), H = gy + o.h, A = sArea(ring), fh = (o.h - 0.6) / o.floors;
  const yr = lmBody(F, Bs, ring, gy - 1, H, { col: COL(o.wall), trim: COL(o.trim || '#efe9dc'), roof: o.metal ? 'trim' : 'coppi', roofCol: o.metal ? COL(o.metal) : undefined, slope: o.metal ? 0.18 : 0.45, over: 0.5 });
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, ry = Math.atan2(-ez, ex), n = Math.max(1, Math.floor((Ln - 1.2) / 3.2)), st = Ln / n;
    for (let f = 0; f < o.floors; f++) for (let k = 0; k < n; k++) { const t = st * (k + 0.5), x = a[0] + ex * t, z = a[1] + ez * t, y = gy + 0.6 + f * fh + fh * 0.45;
      F.geo(Bs.trim, lmBox(1.3, 1.6, 0.08, 0, 0, 0).rotateY(ry).translate(x + nx * 0.03, y, z + nz * 0.03), null, COL(o.frame || '#ece8de'));
      F.geo(Bs.trim, lmBox(1.05, 1.35, 0.08, 0, 0, 0).rotateY(ry).translate(x + nx * 0.07, y, z + nz * 0.07), null, COL('#33393f')); }
  }
  if (o.solar) { const [cx, cz] = centroid(ring), inner = lmOffset(ring, 2.2); let le = 0, ux = 1, uz = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], l = hyp(q[0] - p[0], q[1] - p[1]); if (l > le) { le = l; ux = (q[0] - p[0]) / l; uz = (q[1] - p[1]) / l; } }
    for (let v = -30; v < 30; v += 1.9) for (let u = -30; u < 30; u += 1.1) { const x = cx + ux * u - uz * v, z = cz + uz * u + ux * v; if (!inPoly(x, z, inner) || (Math.round(u * 3 + v) & 3) === 0) continue; F.geo(Bs.trim, lmBox(1.0, 0.06, 1.7, 0, 0, 0).rotateY(Math.atan2(-uz, ux)).translate(x, H + 0.55, z), null, COL('#27334a')); } } // panels over the roof
  if (o.bell) { const [bx, bz] = o.bell, y = groundH(bx, bz) - groundH(bx, bz) + yr; // a little bell gable: a pier with an arched opening and a cross
    F.geo(Bs.plaster, lmBox(1.6, 2.6, 0.5, bx, y + 1.0, bz), null, COL(o.wall)); F.geo(Bs.trim, lmBox(0.7, 1.1, 0.55, bx, y + 1.3, bz), null, COL('#2b2a29'));
    F.geo(Bs.trim, new THREE.ConeGeometry(1.05, 0.7, 4).rotateY(Math.PI / 4).translate(bx, y + 2.65, bz), null, COL(o.metal || '#8e4630')); lmCross(F, Bs.trim, bx, y + 3.0, bz, 0.6, COL('#3c3c40')); }
  lmFlush(Bs, G);
}

// Kino on via Indipendenza: a dark grey frame round a glazed front two floors high, KINO in white letters across the glass, at the back of a paved
// yard with trees in wine barrels, box planters and tables; the rest of the block behind it white with balconies. o.kino: the front [a, b] and the
// depth; o.rest: the rest of the block for buildModern; o.yard: the yard's ring
function buildKino(L, B, G) {
  const o = L.o; buildModern({ x: L.x, z: L.z, o: o.rest }, { pts: o.rest.pts, holes: [], h: o.rest.h }, G);
  const F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), [[ax, az], [bx, bz]] = o.kino.front, W = hyp(bx - ax, bz - az), ux = (bx - ax) / W, uz = (bz - az) / W;
  let nx = -uz, nz = ux; if (!inPoly(ax + ux * W / 2 - nx * 2, az + uz * W / 2 - nz * 2, B.pts)) { nx = -nx; nz = -nz; } // out of the block, towards the yard
  const gy = groundH((ax + bx) / 2 + nx * 3, (az + bz) / 2 + nz * 3), H = o.kino.h, D = o.kino.d, GREY = COL('#3e4144'), GL = COL('#5d6d78');
  const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)).setPosition(ax + nx * 0.4, gy, az + nz * 0.4));
  T.geo(Bs.trim, lmBox(W, H + 1, D, W / 2, (H - 1) / 2, -D / 2), null, GREY); // the box
  T.geo(Bs.trim, lmBox(W - 2.6, H - 1.9, 0.08, W / 2, (H - 1.9) / 2 + 0.05, 0.02), null, GL); // the glass, set in the frame
  for (let x = 1.3; x <= W - 1.29; x += (W - 2.6) / 6) T.geo(Bs.trim, lmBox(0.1, H - 1.9, 0.12, x, (H - 1.9) / 2 + 0.05, 0.08), null, COL('#2a2c2e'));
  for (const y of [2.6, 4.3]) T.geo(Bs.trim, lmBox(W - 2.6, 0.1, 0.12, W / 2, y, 0.08), null, COL('#2a2c2e'));
  T.geo(Bs.trim, lmBox(W + 0.3, 0.3, D + 0.3, W / 2, H, -D / 2), null, COL('#35383b')); // the flat top
  try { polyFill(Bs.walk, o.yard, [], gy + 0.06, 1.2, COL('#8d8a85')); } catch (e) { }
  const yr = o.yard, [cx, cz] = centroid(yr);
  for (const [px, pz] of o.trees) { const y = groundH(px, pz); F.geo(Bs.trim, new THREE.CylinderGeometry(0.45, 0.4, 0.55, 10).translate(px, y + 0.27, pz), null, COL('#7a5434')); F.geo(Bs.trim, new THREE.CylinderGeometry(0.06, 0.08, 1.6, 6).translate(px, y + 1.2, pz), null, COL('#5a4632')); F.geo(Bs.trim, new THREE.IcosahedronGeometry(1.0, 0).scale(0.8, 1.4, 0.8).translate(px, y + 2.5, pz), null, COL('#9bbf3a')); }
  for (const [px, pz] of o.tables) { const y = groundH(px, pz); F.geo(Bs.trim, lmBox(1.1, 0.05, 0.8, 0, 0, 0).rotateY(Math.atan2(-uz, ux)).translate(px, y + 0.75, pz), null, COL('#c9cacc')); for (const [dx, dz] of [[-0.45, -0.3], [0.45, -0.3], [-0.45, 0.3], [0.45, 0.3]]) F.geo(Bs.trim, lmBox(0.04, 0.75, 0.04, 0, 0, 0).translate(px + ux * dx + nx * dz, y + 0.37, pz + uz * dx + nz * dz), null, COL('#9a9c9e')); }
  for (const [px, pz] of o.planters) { const y = groundH(px, pz); F.geo(Bs.trim, lmBox(0.7, 0.6, 0.7, px, y + 0.3, pz), null, COL('#3a3c3e')); F.geo(Bs.trim, new THREE.IcosahedronGeometry(0.42, 0).translate(px, y + 0.85, pz), null, COL('#3f6a34')); }
  lmFlush(Bs, G);
  const lt = Buf(); lmLetters(lt, (ax + bx) / 2 + nx * 0.55, gy + 3.55, (az + bz) / 2 + nz * 0.55, nx, nz, W * 0.6, 1.1);
  const tex = canvasTex(512, 96, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#f4f4f2'; g.font = '600 88px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('K I N O', w / 2, h / 2 + 4); }, false);
  const mat = new THREE.MeshLambertMaterial({ map: tex, transparent: true, depthWrite: false, side: THREE.DoubleSide, emissive: 0xffffff, emissiveMap: tex, emissiveIntensity: 0.2 }); SIGN_MATS.push(mat); mkMesh(lt, mat, 11, false, G);
}

// stairs down to the underpasses: each flight runs from its top a to its bottom b, w wide; treads in porphyry going down, low concrete walls with a
// grey railing and a red handrail, the dark mouth of the tunnel at the bottom (the ground itself stays whole: the flight is drawn on it)
const STAIRWELLS = [
  { n: 'Sottopasso della stazione, via Indipendenza', flights: [[[372.6, -465.8], [356.5, -475.0], 4.5], [[371.0, -478.3], [357.0, -476.8], 4.5], [[364.8, -461.7], [355.8, -474.2], 4.0]], mouth: [[354.0, -476.5], [328.6, -497.7]] },
  { n: 'Sottopasso della stazione, via Umberto Pace', flights: [[[318.0, -506.9], [326.6, -499.4], 3.2]], mouth: [[328.6, -497.7], [354.0, -476.5]], box: true },
];
// the lamps of the square by the underpass: a grey pole with a ribbon twisting up round it and over into the head
const RIBBON_LAMPS = [[376.5, -455.0], [383.0, -461.5], [361.0, -452.5]];
function buildStairwells(T, G) {
  const F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), CON = COL('#a9a59c'), RAIL = COL('#6c7074'), RED = COL('#a3343a'), POR = COL('#8f7f78');
  for (const q of STAIRWELLS) {
    const [cx, cz] = q.flights[0][0]; if (tileOf(cx, cz) !== T.t) continue;
    for (const [a, b, w] of q.flights) {
      const L = hyp(b[0] - a[0], b[1] - a[1]), ux = (b[0] - a[0]) / L, uz = (b[1] - a[1]) / L, nx = -uz, nz = ux, y0 = groundH(a[0], a[1]), n = Math.round(L / 0.45), ry = Math.atan2(-uz, ux);
      const P = (s, t) => [a[0] + ux * s + nx * t, a[1] + uz * s + nz * t];
      for (let i = 0; i < n; i++) { const s0 = i * L / n, s1 = (i + 0.6) * L / n, c = i / n; const [p0, p1, p2, p3] = [P(s0, -w / 2), P(s1, -w / 2), P(s1, w / 2), P(s0, w / 2)]; const sh = new THREE.Color().copy(POR).multiplyScalar(1 - c * 0.75);
        F.face(Bs.walk, [[p0[0], y0 + 0.05, p0[1]], [p1[0], y0 + 0.05, p1[1]], [p2[0], y0 + 0.05, p2[1]], [p3[0], y0 + 0.05, p3[1]]], 2, sh);
        const [r0, r1, r2, r3] = [P(s1, -w / 2), P((i + 1) * L / n, -w / 2), P((i + 1) * L / n, w / 2), P(s1, w / 2)]; F.face(Bs.walk, [[r0[0], y0 + 0.05, r0[1]], [r1[0], y0 + 0.05, r1[1]], [r2[0], y0 + 0.05, r2[1]], [r3[0], y0 + 0.05, r3[1]]], 2, new THREE.Color(0x1d1d1f).lerp(sh, 0.35)); }
      for (const sd of [-1, 1]) { const [mx, mz] = P(L / 2, sd * (w / 2 + 0.15));
        F.geo(Bs.trim, lmBox(L, 0.55, 0.3, 0, 0, 0).rotateY(ry).translate(mx, y0 + 0.27, mz), null, CON);
        F.geo(Bs.trim, lmBox(L, 0.05, 0.05, 0, 0, 0).rotateY(ry).translate(mx, y0 + 1.5, mz), null, RAIL); F.geo(Bs.trim, lmBox(L, 0.06, 0.06, 0, 0, 0).rotateY(ry).translate(...[P(L / 2, sd * (w / 2 + 0.05))].map(p => [p[0], y0 + 1.05, p[1]])[0]), null, RED);
        for (let s = 0; s <= L; s += 0.18) { const [px, pz] = P(s, sd * (w / 2 + 0.15)); F.geo(Bs.trim, lmBox(0.03, 0.95, 0.03, px, y0 + 1.02, pz), null, RAIL); }
        if (!q.coll) { const [x0, z0] = P(0, sd * (w / 2 + 0.15)), [x1, z1] = P(L, sd * (w / 2 + 0.15)); WALLS.add(x0, z0, x1, z1, { ax: x0, az: z0, bx: x1, bz: z1, nx: nx * sd, nz: nz * sd, two: true, y0: y0 - 3, y1: y0 + 1.5 }); } }
      { const [ex, ez] = P(L + 0.2, 0); F.geo(Bs.trim, lmBox(w + 0.6, 2.2, 0.4, 0, 0, 0).rotateY(ry + Math.PI / 2).translate(ex, y0 - 0.2, ez), null, CON); // the end wall, the mouth dark in it
        F.geo(Bs.trim, lmBox(w - 0.6, 1.0, 0.1, 0, 0, 0).rotateY(ry + Math.PI / 2).translate(ex - ux * 0.22, y0 + 0.5, ez - uz * 0.22), null, COL('#141416'));
        if (!q.coll) { const [x0, z0] = P(L + 0.2, -w / 2), [x1, z1] = P(L + 0.2, w / 2); WALLS.add(x0, z0, x1, z1, { ax: x0, az: z0, bx: x1, bz: z1, nx: -ux, nz: -uz, two: true, y0: y0 - 3, y1: y0 + 1.5 }); } }
      if (q.box) { const [mx, mz] = P(L / 2, 0); F.geo(Bs.trim, lmBox(L + 1, 0.12, w + 0.9, 0, 0, 0).rotateY(ry).translate(mx, y0 + 1.6, mz), null, COL('#4d5a50')); } // the green net cover over the stair box
    }
    q.coll = true;
  }
  for (const [x, z] of RIBBON_LAMPS) {
    if (tileOf(x, z) !== T.t) continue; const y = groundH(x, z), GR = COL('#4b4f54');
    F.geo(Bs.trim, new THREE.CylinderGeometry(0.09, 0.11, 7.5, 8).translate(x, y + 3.75, z), null, GR);
    for (let i = 0; i < 24; i++) { const t = i / 23, a = t * 4.2, r = 0.25 + 0.15 * Math.sin(t * 3); F.geo(Bs.trim, lmBox(0.06, 0.45, 0.22, 0, 0, 0).rotateY(-a).translate(x + Math.cos(a) * r, y + 1.5 + t * 6.2, z + Math.sin(a) * r), null, GR); }
    for (let i = 0; i < 8; i++) { const t = i / 7; F.geo(Bs.trim, lmBox(0.32, 0.06, 0.2, 0, 0, 0).rotateZ(-0.4 + t * 0.6).translate(x + t * 2.2, y + 7.6 + Math.sin(t * Math.PI) * 0.5, z), null, GR); }
    F.geo(Bs.trim, new THREE.CylinderGeometry(0.35, 0.3, 0.12, 12).translate(x + 2.4, y + 7.75, z), null, COL('#d9d9d4'));
    WALLS.add(x - 0.3, z - 0.3, x + 0.3, z + 0.3, { r: 0.15, x, z, y0: y - 3, y1: y + 7 });
  }
  lmFlush(Bs, G);
}

// a school gym of the seventies: prefabricated panels in faded red, a band of windows under the eaves, a shallow metal roof
const gymTex = canvasTex(64, 64, (g, w, h) => { g.fillStyle = '#9c4a3a'; g.fillRect(0, 0, w, h); for (let x = 0; x < w; x += 8) { g.fillStyle = 'rgba(0,0,0,.18)'; g.fillRect(x, 0, 2, h); g.fillStyle = 'rgba(255,255,255,.08)'; g.fillRect(x + 2, 0, 1, h); } noise(g, w, h, 300, 0.15, ['#7d3a2c', '#b8604c']); });
LMAT.gym = new THREE.MeshLambertMaterial({ map: gymTex });
function buildPalestra(L, B, G) { // o.white: white render instead of the panels, with a row of little ochre-framed windows along the ground floor
  const o = L.o, ring = lmSimplify(B.pts, 0.4), F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gym = Buf(), gy = Math.min(...ring.map(p => groundH(p[0], p[1]))), H = gy + o.h, A = sArea(ring), WH = COL('#f1f0eb');
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
    let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
    if (o.white) F.face(Bs.plaster, [[a[0], gy - 1, a[1]], [c[0], gy - 1, c[1]], [c[0], H, c[1]], [a[0], H, a[1]]], 2, WH);
    else F.face(gym, [[a[0], gy - 1, a[1]], [c[0], gy - 1, c[1]], [c[0], H, c[1]], [a[0], H, a[1]]]);
    const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, m = 0.4, q = 0.04;
    F.face(Bs.trim, [[a[0] + ex * m + nx * q, H - 1.6, a[1] + ez * m + nz * q], [c[0] - ex * m + nx * q, H - 1.6, c[1] - ez * m + nz * q], [c[0] - ex * m + nx * q, H - 0.5, c[1] - ez * m + nz * q], [a[0] + ex * m + nx * q, H - 0.5, a[1] + ez * m + nz * q]], 2, COL('#2e3236'));
    for (let s = 1.2; s < Ln - 0.5; s += 1.5) F.geo(Bs.trim, lmBox(0.08, 1.1, 0.06, 0, 0, 0).translate(a[0] + ex * s + nx * 0.07, H - 1.05, a[1] + ez * s + nz * 0.07), null, COL('#6b6f73'));
    if (o.white) for (let s = 1.6; s < Ln - 1.2; s += 2.4) { const x = a[0] + ex * s, z = a[1] + ez * s, ry = Math.atan2(-ez, ex);
      F.geo(Bs.trim, lmBox(1.3, 0.95, 0.1, 0, 0, 0).rotateY(ry).translate(x + nx * 0.05, gy + 2.45, z + nz * 0.05), null, COL('#e0a63a'));
      F.geo(Bs.trim, lmBox(1.0, 0.7, 0.1, 0, 0, 0).rotateY(ry).translate(x + nx * 0.09, gy + 2.45, z + nz * 0.09), null, COL('#2f3a44')); }
  }
  lmBody(F, Bs, ring, H - 0.2, H, { col: COL(o.white ? '#f1f0eb' : '#9c4a3a'), roof: 'trim', roofCol: COL(o.white ? '#b9bdc1' : '#5a5e62'), slope: 0.12, over: 0.5, d: 6 });
  if (gym.i.length) mkMesh(gym, LMAT.gym, 10, 'cast', G); lmFlush(Bs, G);
}

// modern school blocks: flat roof behind a parapet, a ribbon of windows on every floor; o: { wall | brick, h, floors, bridges: [{ a, b, sign }],
// wings: [{ pts, h, floors }] (taller blocks over the footprint), courts: [ring] (glazed ground floor under an ochre band on the walls round them),
// spine: [a, b] (a glass barrel vault along the roof with arched glazed bays at both ends), planters: [[x, z]] (a bed with a little tree),
// base (a ring for the lower block instead of the footprint), glass, roof (colours), sky (one skylight every so many m2 of roof), wings[].kind 'gym' (a row of
// small windows along the top and the bottom instead of the ribbons), steps: [{ pts, n, h }] (an open-air flight from the first edge up to the third),
// walkway: [[x, z]...] (a covered path on posts, its barrel canopy stepping down with the ground, red ribs),
// ribbon (share of each floor the window ribbons take), punched (single windows instead of ribbons), portico (the ground floor of the base set back
// behind pillars), balc (balcony slabs on every floor, glass parapets), porch (terracotta entrances and louvres on the long sides), solar (share of
// the top roof under panels), hvac (plant boxes on the roof), wells: [quad] (glazed light wells in the roof); wings[].inset: a wing drawn on the
// footprint pulled in by that many metres, curtain (the top wing a skin of reflecting glass), round (round columns under the portico),
// signs: [{ at: [x, z], text, w, y, bg, fg }] boards on the wall nearest to at }
const bridgeSign = t => canvasTex(1024, 128, (g, w, h) => {
  g.fillStyle = '#f4f4f1'; g.fillRect(0, 0, w, h); g.fillStyle = '#1f2a44'; g.textAlign = 'center'; g.textBaseline = 'middle';
  const L = t.split('\n'); g.font = `${L.length > 1 ? 46 : 50}px Georgia, serif`; L.forEach((s, i) => g.fillText(s, w * 0.44, h / 2 + (i - (L.length - 1) / 2) * 50 + 3));
  g.fillStyle = '#2a8f3a'; g.fillRect(w - 250, 44, 40, 40); g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w - 230, 64, 11, 0, TAU); g.fill(); // the Regione Lombardia rose
  g.fillStyle = '#2a2f33'; g.font = '24px Arial, sans-serif'; g.textAlign = 'left'; g.fillText('Regione Lombardia', w - 202, 66);
}, false);
function buildModern(L, B, G) {
  const o = L.o, ring = lmSimplify(B.pts, 0.4), F = lmFrame(new THREE.Matrix4()), Bs = lmBuffers(), gy = Math.min(...ring.map(p => groundH(p[0], p[1])));
  let seed = Math.abs(L.x * 7 + L.z * 13) % 1 || 0.37; const rand = () => (seed = (seed * 9301 + 0.49297) % 1); // the same skylights every time
  const WALL = COL(o.wall || '#ffffff'), GLASS = COL(o.glass || '#2f3a44'), FRAME = COL('#c9ccd0'), CAP = COL(o.brick ? '#e8e6e0' : '#f6f6f3'), OCRA = COL('#dcae63');
  const block = (ring, h, floors, courts, kind) => {
    const top = gy + h, A = sArea(ring), fh = (h - 0.9) / floors;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i], c = ring[(i + 1) % ring.length], Ln = hyp(c[0] - a[0], c[1] - a[1]); if (Ln < 0.3) continue;
      let nx = (c[1] - a[1]) / Ln, nz = -(c[0] - a[0]) / Ln; if (A < 0) { nx = -nx; nz = -nz; }
      const ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, ry = Math.atan2(-ez, ex), mx = (a[0] + c[0]) / 2, mz = (a[1] + c[1]) / 2;
      const court = (courts || []).some(q => inPoly(mx + nx, mz + nz, q)), band = (y0, y1, q, col) => F.face(Bs.trim, [[a[0] + nx * q, y0, a[1] + nz * q], [c[0] + nx * q, y0, c[1] + nz * q], [c[0] + nx * q, y1, c[1] + nz * q], [a[0] + nx * q, y1, a[1] + nz * q]], 2, col);
      const skin = kind === 'top' && o.curtain;
      if (o.brick) F.face(Bs.brick, [[a[0], gy - 1, a[1]], [c[0], gy - 1, c[1]], [c[0], top, c[1]], [a[0], top, a[1]]]);
      else F.face(Bs.plaster, [[a[0], gy - 1, a[1]], [c[0], gy - 1, c[1]], [c[0], top, c[1]], [a[0], top, a[1]]], 2, skin ? COL('#9fb6cc') : WALL);
      if (skin) { // reflecting glass panels on a grid of grey mullions, a dark band where it sits on the podium
        band(gy + o.h, gy + o.h + 0.9, 0.08, COL('#55595e'));
        for (let t = 0; t <= Ln + 0.01; t += 1.8) F.geo(Bs.trim, lmBox(0.1, h - o.h - 0.9, 0.1, 0, 0, 0).translate(a[0] + ex * t + nx * 0.06, gy + (o.h + 0.9 + h) / 2, a[1] + ez * t + nz * 0.06), null, COL('#6b7178'));
        for (let y = gy + o.h + 0.9; y < top; y += (h - o.h - 0.9) / floors) F.geo(Bs.trim, lmBox(Ln, 0.1, 0.1, 0, 0, 0).rotateY(ry).translate(mx + nx * 0.06, y, mz + nz * 0.06), null, COL('#6b7178'));
        F.geo(Bs.trim, lmBox(Ln + 0.2, 0.7, 0.3, 0, 0, 0).rotateY(ry).translate(mx + nx * 0.1, top + 0.35, mz + nz * 0.1), null, COL('#6b7178'));
        continue;
      }
      F.geo(Bs.trim, lmBox(Ln + 0.2, 0.7, 0.3, 0, 0, 0).rotateY(ry).translate(mx + nx * 0.1, top + 0.35, mz + nz * 0.1), null, CAP); // parapet
      if (Ln < 3) continue;
      if (kind === 'gym') { // the gym: blind walls, a row of little windows high up and one low down
        for (let s = 1.0; s < Ln - 0.8; s += 1.6) for (const y of [h - 1.3, 1.1]) F.geo(Bs.trim, lmBox(0.7, 0.55, 0.1, 0, 0, 0).rotateY(ry).translate(a[0] + ex * s + nx * 0.06, gy + y, a[1] + ez * s + nz * 0.06), null, COL('#2f3a44'));
        continue;
      }
      if (o.porch && Ln > 25) { // terracotta at the entrance in the middle, terracotta louvres high up near the corners
        const s0 = Ln * 0.38, s1 = Ln * 0.6, P = (s, y, q) => [a[0] + ex * s + nx * q, y, a[1] + ez * s + nz * q];
        F.face(Bs.trim, [P(s0, gy, 0.08), P(s1, gy, 0.08), P(s1, gy + 3.8, 0.08), P(s0, gy + 3.8, 0.08)], 2, COL('#c0603e'));
        F.face(Bs.trim, [P(s0 + 1.5, gy, 0.12), P(s1 - 1.5, gy, 0.12), P(s1 - 1.5, gy + 2.8, 0.12), P(s0 + 1.5, gy + 2.8, 0.12)], 2, GLASS);
        for (const [t0, t1] of [[0.06, 0.2], [0.8, 0.94]]) for (let t = Ln * t0; t < Ln * t1; t += 0.55) F.geo(Bs.trim, lmBox(0.12, h - 4.6, 0.4, 0, 0, 0).rotateY(ry).translate(a[0] + ex * t + nx * 0.25, gy + (h + 3.6) / 2, a[1] + ez * t + nz * 0.25), null, COL('#c97b55'));
      }
      if (o.portico && !kind && h <= o.h) { // a portico all along: the ground floor glazed and set back, square pillars in front
        band(gy + 0.1, gy + 3.4, -1.6, GLASS); band(gy + 3.4, gy + 3.5, 0.02, COL('#5e6266'));
        for (let s = 1.2; s < Ln - 0.6; s += 4.5) F.geo(Bs.trim, (o.round ? new THREE.CylinderGeometry(0.3, 0.3, 3.4, 12) : lmBox(0.5, 3.4, 0.5, 0, 0, 0)).translate(a[0] + ex * s + nx * 0.2, gy + 1.7, a[1] + ez * s + nz * 0.2), null, COL('#b9bcbe'));
      }
      if (o.balc && Ln > 6) for (let f = 1; f < floors; f++) { // balconies on every floor: a white slab and a glass parapet
        const y = gy + 0.9 + f * fh - 0.15;
        F.geo(Bs.trim, lmBox(Ln + 1.2, 0.26, 1.5, 0, 0, 0).rotateY(ry).translate(mx + nx * 0.75, y, mz + nz * 0.75), null, COL('#f4f4f1'));
        F.face(Bs.trim, [[a[0] - ex * 0.6 + nx * 1.48, y + 0.13, a[1] - ez * 0.6 + nz * 1.48], [c[0] + ex * 0.6 + nx * 1.48, y + 0.13, c[1] + ez * 0.6 + nz * 1.48], [c[0] + ex * 0.6 + nx * 1.48, y + 1.1, c[1] + ez * 0.6 + nz * 1.48], [a[0] - ex * 0.6 + nx * 1.48, y + 1.1, a[1] - ez * 0.6 + nz * 1.48]], 2, COL('#a9bcc6'));
      }
      if (court) { // round the courts: the ground floor all glass between steel posts, an ochre band above it
        band(gy + 0.15, gy + 3.2, 0.06, GLASS); band(gy + 3.2, gy + 4.0, 0.12, OCRA);
        for (let s = 0.4; s <= Ln - 0.3; s += 2.2) F.geo(Bs.trim, lmBox(0.12, 3.05, 0.1, 0, 0, 0).translate(a[0] + ex * s + nx * 0.1, gy + 1.68, a[1] + ez * s + nz * 0.1), null, COL('#33383d'));
      }
      if (o.punched) { for (let f = 0; f < floors; f++) for (let s = 2.2; s < Ln - 1.8; s += 3.6) { if (o.porch && Ln > 25 && s > Ln * 0.36 && s < Ln * 0.62) continue; const y = gy + 0.9 + f * fh + fh * 0.4; F.geo(Bs.trim, lmBox(1.4, 1.3, 0.1, 0, 0, 0).rotateY(ry).translate(a[0] + ex * s + nx * 0.04, y, a[1] + ez * s + nz * 0.04), null, GLASS); } continue; }
      for (let f = court || (o.portico && !kind && h <= o.h) ? 1 : 0; f < floors; f++) { // ribbon window with mullions
        const y0 = gy + 0.9 + f * fh + 0.25, y1 = y0 + fh * (o.ribbon || 0.5), m = 0.8, q = 0.05;
        F.face(Bs.trim, [[a[0] + ex * m + nx * q, y0, a[1] + ez * m + nz * q], [c[0] - ex * m + nx * q, y0, c[1] - ez * m + nz * q], [c[0] - ex * m + nx * q, y1, c[1] - ez * m + nz * q], [a[0] + ex * m + nx * q, y1, a[1] + ez * m + nz * q]], 2, GLASS);
        for (let s = m; s <= Ln - m + 0.01; s += 1.6) F.geo(Bs.trim, lmBox(0.09, y1 - y0, 0.08, 0, 0, 0).translate(a[0] + ex * s + nx * 0.08, (y0 + y1) / 2, a[1] + ez * s + nz * 0.08), null, FRAME);
        F.geo(Bs.trim, lmBox(Ln - 2 * m, 0.08, 0.14, 0, 0, 0).rotateY(ry).translate(mx + nx * 0.1, y0 - 0.04, mz + nz * 0.1), null, FRAME);
      }
    }
    try { polyFill(Bs.trim, ring, [], top + 0.02, 2, COL(o.roof || '#8f8c86')); } catch (e) { }
    if (kind === 'top' || (!o.wings && kind !== 'gym')) { // roof plant: solar panels in rows along the longest side, plant boxes, light wells
      let le = 0, ux = 1, uz = 0; for (let i = 0; i < ring.length; i++) { const p = ring[i], q = ring[(i + 1) % ring.length], l = hyp(q[0] - p[0], q[1] - p[1]); if (l > le) { le = l; ux = (q[0] - p[0]) / l; uz = (q[1] - p[1]) / l; } }
      const inner = lmOffset(ring, 1.6), [cx, cz] = centroid(ring), R2 = Math.sqrt(Math.abs(A)), ry = Math.atan2(-uz, ux), wells = o.wells || [];
      if (o.solar) for (let v = -R2; v < R2; v += 2.0) for (let u = -R2; u < R2; u += 1.1) {
        const x = cx + ux * u - uz * v, z = cz + uz * u + ux * v; if (!inPoly(x, z, inner) || wells.some(w => inPoly(x, z, lmOffset(w, -1.2))) || rand() > o.solar) continue;
        F.geo(Bs.trim, lmBox(1.0, 0.08, 1.6, 0, 0, 0).rotateX(0.18).rotateY(ry).translate(x, top + 0.45, z), null, COL('#27334a'));
      }
      for (let k = 0; k < (o.hvac || 0); k++) { const u = (rand() - 0.5) * R2, v = (rand() - 0.5) * R2, x = cx + ux * u - uz * v, z = cz + uz * u + ux * v; if (inPoly(x, z, inner)) F.geo(Bs.trim, lmBox(1.6 + rand() * 2, 1.0 + rand(), 1.4 + rand(), 0, 0, 0).rotateY(ry).translate(x, top + 0.6, z), null, COL('#b9bcbf')); }
      for (const w of wells) { try { polyFill(Bs.trim, w, [], top + 0.05, 2, COL('#3d4f5a')); } catch (e) { } const A2 = sArea(w); for (let i = 0; i < w.length; i++) { const p = w[i], q = w[(i + 1) % w.length], l = hyp(q[0] - p[0], q[1] - p[1]); F.geo(Bs.trim, lmBox(l, 0.9, 0.12, 0, 0, 0).rotateY(Math.atan2(-(q[1] - p[1]), q[0] - p[0])).translate((p[0] + q[0]) / 2, top + 0.45, (p[1] + q[1]) / 2), null, COL('#e4e6e6')); } }
    }
    if (o.sky) { const [x0, z0, x1, z1] = bbox(ring); for (let k = Math.round(Math.abs(A) / o.sky); k > 0; k--) { const x = x0 + rand() * (x1 - x0), z = z0 + rand() * (z1 - z0); if (inPoly(x, z, lmOffset(ring, 1.2))) F.geo(Bs.trim, lmBox(0.9, 0.3, 0.9, x, top + 0.15, z), null, COL('#eef0f0')); } }
  };
  block(o.base || ring, o.h, o.floors, o.courts);
  for (const w of o.wings || []) block(w.inset ? lmOffset(ring, w.inset) : lmOffset(w.pts, -0.15), w.h, w.floors, null, w.kind || (w.inset ? 'top' : undefined)); // a hair proud of the lower block, so the faces don't fight
  for (const st of o.steps || []) { // a flight of steps: n treads from the first edge to the third, each with its riser
    const [p0, p1, p2, p3] = st.pts, sy = groundH((p0[0] + p2[0]) / 2, (p0[1] + p2[1]) / 2), L2 = (p, q, t) => [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t];
    for (let i = 0; i < st.n; i++) {
      const t0 = i / st.n, t1 = (i + 1) / st.n, y = sy + st.h * (st.n - i) / st.n, a = L2(p0, p3, t0), b = L2(p1, p2, t0), c = L2(p1, p2, t1), d = L2(p0, p3, t1);
      F.face(Bs.walk, [[a[0], y, a[1]], [b[0], y, b[1]], [c[0], y, c[1]], [d[0], y, d[1]]], 2, COL('#c9c4b8'));
      F.face(Bs.walk, [[c[0], y, c[1]], [b[0], y, b[1]], [b[0], sy - 0.5, b[1]], [c[0], sy - 0.5, c[1]]], 2, COL('#b5b0a5')); F.face(Bs.walk, [[a[0], y, a[1]], [d[0], y, d[1]], [d[0], sy - 0.5, d[1]], [a[0], sy - 0.5, a[1]]], 2, COL('#b5b0a5'));
      F.face(Bs.walk, [[d[0], y, d[1]], [c[0], y, c[1]], [c[0], y - st.h / st.n, c[1]], [d[0], y - st.h / st.n, d[1]]], 2, COL('#a9a397'));
    }
  }
  if (o.walkway) { // the covered stair between the schools: landings and flights of steps under a beige barrel on red ribs, the canopy stepping down
    // with them; at the top, on via Papa Giovanni XXIII, the red steel porch over the first flight, the low wall and the gate
    const W = o.walkway, CAN = COL('#e2cdb8'), RIB = COL('#a8322b'), PAV = COL('#a8a296'), RISE = 0.17, TREAD = 0.32, segs = [];
    for (let k = 1; k < W.length; k++) {
      const [ax, az] = W[k - 1], [bx, bz] = W[k], Ls = hyp(bx - ax, bz - az), n = Math.max(1, Math.round(Ls / 2.4));
      for (let i = 0; i < n; i++) segs.push({ ax, az, ux: (bx - ax) / Ls, uz: (bz - az) / Ls, s0: i * Ls / n, sl: Ls / n });
    }
    let lv = groundH(W[0][0], W[0][1]);
    for (const g of segs) { // each piece is a landing, or a flight when the ground has climbed more than a few steps above the last landing
      const cx = g.ax + g.ux * (g.s0 + g.sl / 2), cz = g.az + g.uz * (g.s0 + g.sl / 2), want = groundH(cx, cz), k = Math.min(Math.floor(g.sl / TREAD) - 1, Math.round((want - lv) / RISE));
      g.y0 = lv; g.steps = Math.abs(k) >= 3 ? k : 0; lv += g.steps * RISE; g.y1 = lv; g.cx = cx; g.cz = cz;
    }
    segs.forEach((g, i) => {
      const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(g.uz, 0, -g.ux), new THREE.Vector3(0, 1, 0), new THREE.Vector3(g.ux, 0, g.uz)).setPosition(g.cx, 0, g.cz)), h = g.sl / 2;
      const top = Math.max(g.y0, g.y1) + 2.3, last = i === segs.length - 1;
      if (g.steps) { const n = Math.abs(g.steps), d = (g.sl - 0.4) / n; for (let k = 0; k < n; k++) { const y = g.y0 + Math.sign(g.steps) * RISE * (k + 1); T.geo(Bs.walk, lmBox(1.9, y - g.y0 + 0.6, d + 0.02, 0, (y + g.y0 - 0.6) / 2, -h + 0.2 + d * (k + 0.5)), null, PAV); } T.geo(Bs.walk, lmBox(1.9, 0.6, 0.22, 0, g.y0 - 0.3, -h + 0.1), null, PAV); T.geo(Bs.walk, lmBox(1.9, g.y1 - Math.min(g.y0, g.y1) + 0.6, 0.2, 0, (g.y1 + Math.min(g.y0, g.y1) - 0.6) / 2, h - 0.1), null, PAV); }
      else T.geo(Bs.walk, lmBox(1.9, 0.7, g.sl + 0.05, 0, g.y0 - 0.33, 0), null, PAV);
      for (const sd of [-1, 1]) T.geo(Bs.trim, lmBox(0.18, 0.95, g.sl, sd * 1.05, Math.max(g.y0, g.y1) - 0.2, 0), null, COL('#8f8a80')); // the low side walls
      T.geo(Bs.trim, new THREE.CylinderGeometry(1.25, 1.25, g.sl + 0.25, 10, 1, true, Math.PI / 2, Math.PI).rotateX(Math.PI / 2).scale(1, 0.6, 1).translate(0, top, 0), null, last ? COL('#e9e6dc') : CAN);
      for (const z of last ? [-h, 0, h] : [-h]) { T.geo(Bs.trim, new THREE.TorusGeometry(1.27, last ? 0.09 : 0.05, 4, 10, Math.PI).scale(1, 0.6, 1).translate(0, top, z), null, RIB);
        for (const sd of [-1, 1]) T.geo(Bs.trim, lmBox(last ? 0.14 : 0.08, top - g.y0 + 0.5, last ? 0.14 : 0.08, sd * 1.2, (top + g.y0 - 0.5) / 2, z), null, RIB); }
      if (last) { // the gate and the low wall along the road
        T.geo(Bs.trim, lmBox(0.1, 1.9, 1.3, 1.35, g.y1 + 0.95, h - 0.7), null, COL('#2c2e30')); T.geo(Bs.trim, lmBox(0.1, 1.9, 1.3, -1.35, g.y1 + 0.95, h - 0.7), null, COL('#2c2e30'));
        T.geo(Bs.trim, lmBox(0.35, 1.0, 9, 1.6, g.y1 + 0.2, -h - 3.5), null, COL('#9a958b'));
      }
    });
  }
  for (const [px, pz] of o.planters || []) { // a raised bed of shrubs with a little tree, as in the courts
    const ry = o.spine ? Math.atan2(o.spine[1][0] - o.spine[0][0], o.spine[1][1] - o.spine[0][1]) : 0, y = groundH(px, pz);
    F.geo(Bs.trim, lmBox(7, 0.45, 2.4, 0, 0, 0).rotateY(ry + Math.PI / 2).translate(px, y + 0.22, pz), null, COL('#4a4a48'));
    for (let k = -3; k <= 3; k++) F.geo(Bs.trim, new THREE.IcosahedronGeometry(0.6 + (k & 1) * 0.15, 0).translate(px + Math.cos(ry) * k * 0.95, y + 0.75, pz - Math.sin(ry) * k * 0.95), null, COL(k & 1 ? '#4f7a3a' : '#5d8a44'));
    F.geo(Bs.trim, new THREE.CylinderGeometry(0.1, 0.14, 2.4, 6).translate(px, y + 1.6, pz), null, COL('#5a4632'));
    F.geo(Bs.trim, new THREE.IcosahedronGeometry(1.3, 0).scale(1, 0.85, 1).translate(px, y + 3.3, pz), null, COL('#6f8f45'));
  }
  const signs = [];
  for (const br of o.bridges || []) { // a glazed bridge on four columns over the drive, the school's name on its parapet (facing left of a -> b)
    const [[ax, az], [bx, bz]] = [br.a, br.b], Lb = hyp(bx - ax, bz - az), ux = (bx - ax) / Lb, uz = (bz - az) / Lb, nx = -uz, nz = ux;
    const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(ux, 0, uz), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)).setPosition(ax, gy, az)), D2 = 3.2, WH = COL('#f4f4f1');
    T.geo(Bs.trim, lmBox(Lb, 1.6, D2, Lb / 2, 4.2, -D2 / 2 + 0.6), null, WH); T.geo(Bs.trim, lmBox(Lb, 0.5, D2 + 0.2, Lb / 2, 7.55, -D2 / 2 + 0.6), null, WH);
    for (const z of [0.62, -D2 + 0.58]) { T.geo(Bs.trim, lmBox(Lb - 0.4, 2.3, 0.05, Lb / 2, 6.15, z), null, GLASS); for (let s = 0.4; s < Lb; s += 1.4) T.geo(Bs.trim, lmBox(0.1, 2.3, 0.08, s, 6.15, z + (z > 0 ? 0.03 : -0.03)), null, COL('#1d2125')); }
    for (const s of [1.2, Lb - 1.2]) for (const z of [0.2, -D2 + 1]) T.geo(Bs.trim, new THREE.CylinderGeometry(0.22, 0.22, 3.4, 12).translate(s, 1.7, z), null, COL('#b5b8bc'));
    if (!br.sign) continue;
    const sg = Buf(); for (const [x, y, u, v] of [[0.3, 3.55, 0, 0], [Lb - 0.3, 3.55, 1, 0], [Lb - 0.3, 4.85, 1, 1], [0.3, 4.85, 0, 1]]) T.v(sg, x, y, 0.62, 0, 0, 1, u, v); sg.i.push(0, 1, 2, 0, 2, 3);
    T.geo(Bs.trim, new THREE.CircleGeometry(0.42, 16).translate(Lb / 2, 5.2, 0.66), null, COL('#e0e0dc'));
    signs.push([sg, new THREE.MeshLambertMaterial({ map: bridgeSign(br.sign), polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })]);
  }
  for (const sg of o.signs || []) { // a board flat on the nearest wall of the base
    const r = o.base || ring; let best = null; for (let i = 0; i < r.length; i++) { const a = r[i], c = r[(i + 1) % r.length], d = segDist(sg.at[0], sg.at[1], a[0], a[1], c[0], c[1]); if (!best || d < best.d) best = { d, a, c }; }
    const { a, c } = best, Ln = hyp(c[0] - a[0], c[1] - a[1]), ex = (c[0] - a[0]) / Ln, ez = (c[1] - a[1]) / Ln, t = clamp((sg.at[0] - a[0]) * ex + (sg.at[1] - a[1]) * ez, sg.w / 2, Ln - sg.w / 2);
    let nx = ez, nz = -ex; if (inPoly(a[0] + ex * t + nx, a[1] + ez * t + nz, r)) { nx = -nx; nz = -nz; }
    const cx = a[0] + ex * t + nx * 0.14, cz = a[1] + ez * t + nz * 0.14, hh = sg.h || 0.9, ux = nx > 0 || (nx === 0 && nz < 0) ? 1 : 1, g = Buf();
    const T = lmFrame(new THREE.Matrix4().makeBasis(new THREE.Vector3(-nz, 0, nx), new THREE.Vector3(0, 1, 0), new THREE.Vector3(nx, 0, nz)).setPosition(cx, gy + sg.y, cz));
    for (const [x, y, u, v] of [[-sg.w / 2, -hh / 2, 0, 0], [sg.w / 2, -hh / 2, 1, 0], [sg.w / 2, hh / 2, 1, 1], [-sg.w / 2, hh / 2, 0, 1]]) T.v(g, x, y, 0, 0, 0, 1, u, v); g.i.push(0, 1, 2, 0, 2, 3);
    const tex = canvasTex(1024, Math.round(1024 * hh / sg.w / 4) * 4 || 64, (cg, w, h) => { cg.fillStyle = sg.bg; cg.fillRect(0, 0, w, h); cg.fillStyle = sg.fg; cg.textAlign = 'center'; cg.textBaseline = 'middle'; cg.font = `italic ${Math.round(h * 0.62)}px Georgia, serif`; cg.fillText(sg.text, w / 2, h / 2 + 2); }, false);
    signs.push([g, new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 })]);
  }
  lmFlush(Bs, G); for (const [g, m] of signs) mkMesh(g, m, 10, false, G);
}
