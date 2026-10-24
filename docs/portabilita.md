# Portabilità dei DBGT: i sette comuni vicini confrontati con Meda

Controllo del 24/10/2026, fatto solo leggendo i dati: il gioco e la build non sono stati toccati. I sette zip scaricati il 23/10 sono estratti in `data/dbt/<Comune>/estratto/` (dentro: `dbgt.gpkg`, `base_dbt_per_pianificazione.gpkg`, `Isoipse.zip`, `leggimi.txt`). Gli zip sono rimasti al loro posto. La build di oggi legge solo `data/dbt/<Comune>/dbgt.gpkg` (`build_data.py` r. 213, `build.py` r. 31), quindi `estratto/` non entra ancora nella mappa. Entrerà quando la build leggerà anche `estratto/dbgt.gpkg`, come chiede `docs/motore.md` §7 ("Codice generico per comune").

Come è stato fatto: per ogni gpkg ho letto `gpkg_contents`, `gpkg_geometry_columns` e i campi di ogni tabella, ho contato i codici di ogni campo a dominio e ho preso le quote Z di ogni vertice. La copertura viene dal poligono `copertura_completa` di `base_dbt_per_pianificazione.gpkg`, confrontato con il confine OSM. Poi ho fatto girare `src/dbgt_quote.py` (fase 1, sola lettura, rapporto fuori dal repo) su ogni comune, per avere l'offset DBGT − LiDAR e la pulizia delle quote che il motore applicherebbe.

## In breve

- **Il formato è lo stesso.** Tutti gli otto comuni sono in EPSG:7791 e hanno lo stesso schema GeoPackage, le stesse tabelle di sottoarea (`*_SUP_SR`, `*_TRA_SG`, `CLASSREF` → `CLASSID`), gli stessi nomi e tipi di campo e le quote Z nelle geometrie. Unica differenza nei campi: Barlassina e Cabiate hanno `COD_CONS` (data di consegna, 2023) al posto di `DATA_CONS`, e `DATA_FIN` nelle sottotabelle. Nessun campo usato dal codice manca.
- **Lo strato `COMUNE` non serve come confine.** Manca in 5 comuni su 8. A Meda è fatto di 13 schegge per 0,02 km² (il comune ne misura 8,3), a Mariano di 2 schegge per 0,026 km². È completo solo a Lentate (13,9 km²). Lo stesso vale per `LIM_COM`. Il piano di §7 ("il perimetro di ogni comune dal suo strato `COMUNE`") così non funziona. Al suo posto va l'unione di `copertura_completa` (in `base_dbt_per_pianificazione.gpkg`, che sta in ogni zip): sovrapposta al confine OSM dà un IoU di 0,985-0,999.
- **Il riquadro è coperto quasi tutto.** Gli otto DBGT coprono il 99,7% del riquadro della mappa (29,46 km²); restano fuori 0,08 km², soprattutto Cogliate. Le sovrapposizioni tra comuni vicini sono trascurabili (3,3 m² Cabiate/Mariano, 1,3 m² Cesano/Seveso).
- **Le quote vanno bene.** L'offset DBGT − LiDAR sugli assi a raso sta tra +0,03 e +0,25 m, tutti sotto la soglia di 0,3 m del controllo C2. Il cordolo AC_PED − AC_VEI ha mediana 0 ovunque, come a Meda.
- **Il codice di Meda va cambiato in quattro punti.** (1) La soglia fissa `ZMIN = 200` m: Cesano scende a 189 m e Seveso a 199. (2) La sede `SED = 03` (in galleria), che a Meda non c'è: il codice la tratta come un ponte. (3) `AR_STR_SED = 95` ("altro"), anch'esso preso per un ponte. (4) I cortili `AC_VEI ZON 0307`, che negli altri rilievi quasi non ci sono.
- **Le date nei dati non sono gli anni della Regione.** Cesano ha `DATA_INI` 2005 (non 2022) e Mariano 2019 (non 2015). Barlassina, Cabiate e Lentate hanno `DATA_INI` vuota.

## Tabella riassuntiva

"Del comune nel riquadro" è la parte del territorio (da `copertura_completa`) che sta nel riquadro lat 45,6345-45,6805, lon 9,117-9,191. "Del riquadro" è la parte del riquadro che quel comune occupa.

| Comune | Anno (Regione) | `DATA_INI` nei dati | Del comune nel riquadro | Del riquadro | Tabelle | Strati usati che mancano | Differenze che contano | Quote |
|---|---|---|---|---|---|---|---|---|
| Meda | 2015 | 2015-03-28 (77 940 oggetti) | 96,7% (8,04 di 8,31 km²) | 27,3% | 106 | (riferimento) `COMUNE` a schegge | — | offset +0,07 m |
| Barlassina | 2018 | vuota; `COD_CONS` 2023-07-11 | 80,8% (2,21 di 2,74) | 7,5% | 100 | `ACC_INT`, `ALVEO`, `ARGINE`, `GALLER`, `INVASO`, `COMUNE`, `LIM_COM`, `SV_FER` | campi `COD_CONS`; `*_LIV` vuoti (`' '`); `AR_STR` in 48 pezzi grandi; muri quasi tutti `17`; in più `MU_SOS` (394), `MU_DIV`, `SV_STR`, `ACC_PC_TY` | offset +0,25 m (il più alto); `ALVEO_A` a quota 0 |
| Cabiate | 2021 | vuota; `COD_CONS` 2023-06-13 | 77,1% (2,47 di 3,21) | 8,4% | 100 | `ACC_PC_ACC_PC_POS` (nessun passo carraio), `ACC_INT`, `ALVEO`, `GALLER`, `INVASO`, `COMUNE`, `LIM_COM`, `SV_FER` | campi `COD_CONS`; `*_LIV` vuoti; `AR_STR` in 20 pezzi; muri `02` e `95`; `MU_SOS` (99) | offset +0,17 m |
| Cesano Maderno | 2022 (`docs/dati.md`: 2005) | 2005-04-30 (71 411), 2007-07-05 (9 291) | 18,0% (2,05 di 11,44) | 7,0% | 93 | `ALVEO`, `EL_CIC`, `FIL_AL`, `GALLER`, `INVASO`, `COMUNE`, `LIM_COM`, `CV_LIV` | muri quasi tutti `18`; `AR_STR_SED 95`; 37% dei volumi senza altezza; cortili `0307` quasi assenti (21) | terreno fino a 189 m: con `ZMIN = 200` il 34% dei vertici degli assi resta senza quota (fuori dal riquadro); offset +0,12 m; 91% degli `ALBERO` a quota 0 |
| Lentate sul Seveso | 2021 | vuota (109 206 oggetti) | 28,1% (3,96 di 14,11) | 13,4% | 111 | `ALVEO`, `ARGINE` (tutti), `PONTE_USO` | `SED 03` (12 assi in galleria); `AR_STR` in 39 pezzi; muri quasi tutti `17`; `MU_SOS` (421), `SV_STR` (72); unico `COMUNE` completo | offset +0,03 m; un vertice a 64 m |
| Mariano Comense | 2015 | 2019-01-01 (74 579), 2999-12-31 (5 068) | 7,2% (0,99 di 13,80) | 3,4% | 99 | `ACC_INT`, `ALVEO`, `ARGINE`, `SV_FER`; solo 7 passi carrai | `*_LIV` con valori veri (`02`, `01`); `UN_VOL_QE` quota assoluta; 2 683 siepi `19`; `EL_STR_CF/CL -99991` (613); 145 edifici senza `EDIFC_CR_EDF_IS` | offset +0,10 m; `UN_VOL_AV` negativa (−10 m) o ≤ 1 in 406 volumi |
| Seregno | 2007 | 2007-07-05 (143 579) | 20,8% (2,68 di 12,86) | 9,1% | 94 | `EL_IDR` (nessun corso d'acqua), `ALVEO`, `ARGINE`, `INVASO`, `COMUNE`, `LIM_COM`, `CV_LIV` | `SED 03`; `AR_STR_SED 95` (48); muri `18`/`95`; cortili `0307` quasi assenti (3) | offset +0,10 m; 320 volumi con altezza 0 |
| Seveso | 2015 | 2015-03-28 (76 731) | 94,6% (6,98 di 7,38) | 23,7% | 96 | `ALVEO_ALVEO_SUP`, `COMUNE`, `LIM_COM`, `CV_LIV` | `SED 03` (6 assi); `AR_STR_SED 95` (9); cortili `0307` come Meda (2 463) | offset +0,17 m; `ALVEO_A` a quota 0 (31 alvei su 33); una galleria a 105,8 m; terreno fino a 199 m |

## Cosa hanno in comune

- **Riferimento.** Tutte le tabelle con geometria sono in SRS 7791 (RDN2008 / UTM 32N). `gpkg_geometry_columns.z = 1` ovunque, tranne gli strati 2D (`EDIFC_CR_EDF_ME`, `EDI_MIN_CR_EDF_ME`, `COMUNE`, `LIM_COM`, `SV_FER`, `SV_STR`), come a Meda.
- **Campi.** Sugli strati usati dal motore i nomi e i tipi dei campi sono gli stessi di Meda in tutti i sette comuni. L'unica eccezione è quella dei campi di consegna di Barlassina e Cabiate. Le query di `dbgt_quote.py`, `build_data.py`, `dbgt_strade.py` e `dbgt_verde.py` girano senza modifiche; le tabelle che mancano sono già gestite (`OperationalError` → strato assente).
- **Join `CLASSREF = CLASSID`.** Sono completi ovunque, tranne qualche sottoarea orfana a Barlassina e Cabiate (17 e 19 `AR_VRD`, 2 e 5 `CL_AGR`, 2 `MAN_TR`, 1 e 4 `EDIFC_CR_EDF_IS`), che un `join` fa sparire.
- **Dove stanno i dati.** I dati di ogni comune stanno dentro il suo territorio: nessun asse o edificio esce di più di 5 m dalla sua `copertura_completa`. Unire più comuni non crea doppioni ai confini.
- **Cosa è `AR_STR`.** È la "area stradale complessiva" in tutti gli otto comuni: contiene tutta la carreggiata `AC_VEI` (escluse le ZON 0301/0307) e buona parte dei marciapiedi. Quello che resta fuori da `AC_VEI` + `AC_PED` (isole, aiuole, banchine) va da 0,7 ha (Seveso) a 6,7 ha (Seregno); a Meda sono 1,7 ha. Cambia solo il taglio: a Meda, Seveso, Cesano e Seregno ci sono pezzi di 330-390 m², a Barlassina, Cabiate e Lentate pochi pezzi da 0,7-2,5 ha (Cabiate: 20 pezzi con 37 773 vertici).

### Offset e pulizia delle quote (`dbgt_quote.py`, fase 1)

| Comune | Offset C2 (m) | Assi `EL_STR` > 1,5 m dal LiDAR | Vertici `EL_STR` senza quota | `AC_VEI` z = 0 | Note |
|---|---|---|---|---|---|
| Meda | +0,073 | 69 | 0 | 187 | |
| Barlassina | +0,248 | 27 | 0 | 109 | vicino alla soglia di 0,3 m |
| Cabiate | +0,169 | 0 | 0 | 130 | |
| Cesano Maderno | +0,117 | 85 | 4 515 | 75 | i vertici senza quota sono quelli sotto 200 m fuori dal LiDAR (sud del comune) |
| Lentate sul Seveso | +0,025 | 43 | 0 | 96 | |
| Mariano Comense | +0,102 | 13 | 3 | 753 | |
| Seregno | +0,103 | 34 | 0 | 302 | |
| Seveso | +0,166 | 68 | 0 | 72 | galleria: 30 vertici senza quota (quella a 105,8 m) |

Due comuni confinanti possono avere offset diversi fino a 0,22 m (Barlassina +0,25, Lentate +0,03). Se ognuno toglie il suo, al confine resta uno scalino: va raccordato, oppure si toglie un offset solo.

## Codici: le differenze rispetto a Meda

Solo i codici che il codice di oggi legge o che cambiano il disegno. Tra parentesi gli oggetti; "nuovo" vuol dire che a Meda non c'è.

**Sede e livello.**
- `*_SED 03` (in galleria, specifica p. 1942) è nuovo: `EL_STR` Lentate 12, Seregno 4, Seveso 6; `AC_VEI` Lentate 4, Seregno 6, Seveso 3; `AR_STR` Lentate 4, Seregno 6, Seveso 3; `AC_CIC` Lentate 1, Seregno 2.
- `AR_STR_SED 95` (altro) è nuovo: Cesano 25, Seregno 48, Seveso 9, Mariano 1. Il codice lo prende per un ponte.
- `EL_FER_SED` e `EL_FER_LIV` sono `None` a Cesano (24 e 34 tratti).
- `*_LIV` delle aree: a Meda vale `-99991` (non compilato) quasi ovunque. A Barlassina e Cabiate è vuoto (`' '`). A Mariano ha i valori veri: `AC_VEI` 2 793 `02` (non in sottopasso), 60 `01` (in sottopasso). `EL_STR_LIV 01` (in sottopasso) manca a Barlassina e Cabiate.

**`AC_VEI_ZON`.**
- Cortili `0307`: Meda 4 258, Seveso 2 463, Mariano 983, Lentate 173, Cabiate 62, Barlassina 43, Cesano 21, Seregno 3. Fuori da Meda, Seveso e Mariano i cortili e gli accessi privati non sono rilevati come `AC_VEI`.
- Carreggiata generica: Meda, Seveso e Mariano usano `01` (923, 883, 1 060), gli altri `0101`.
- Codici nuovi: `0204` piazza (Cabiate 2, Cesano 5, Lentate 3, Seregno 5, Seveso 2), `02`/`03` senza sottocodice (Cesano 1, Seregno 7+6, Mariano 18), `0103` (Lentate 4), `06` fermata bus (Lentate 2).
- Corsie di sosta `04`: Barlassina 263, Cabiate 194, Lentate 319, Seregno 371, contro 1 a Meda. Banchine `07`: Lentate 462, Barlassina 143.
- `05` (piazzola) c'è quasi solo a Meda (295) e Seveso (360).

**`AC_PED_ZON`.** `03` (salvagente) è nuovo a Cabiate (5) e Lentate (2): è già in `PED_STEP`. `04` (portici) manca a Cesano, Mariano e Seregno, `06` a Cesano, Lentate e Seregno.

**`EL_STR`.**
- `EL_STR_TY` ha i nuovi `02`, `0204`, `0103`, `03`, `04`, `95`.
- `EL_STR_CF` (classifica): `04` urbana di scorrimento è nuovo e frequente (Cesano 2 538, Seregno 2 431, Barlassina 187), a Mariano c'è `-99991` su 613 tratti.
- `EL_STR_CL` (classe di larghezza): a Meda prevale `03` (oltre 7 m, 2 213 su 2 935), negli altri `02` (3,5-7 m). Sono abitudini del rilevatore: non servono per abbinare le vie OSM.

**Muri `EL_DIV_TY`.** `17` prevale a Barlassina (3 422) e Lentate (9 577); `18` a Cesano (11 733) e Seregno (9 982); `02` a Cabiate (3 693), Mariano (4 228) e Seveso (3 943); `19` siepi solo a Mariano (2 683); `04` filo spinato è nuovo a Cabiate (3). Tutti stanno nell'elenco di `build_data.py` r. 220 e in `barriere.py`. In più ci sono muri come poligoni: `MU_SOS` (muri di sostegno: Barlassina 394, Cabiate 99, Lentate 421, Mariano 47, Seveso 17) e `MU_DIV` (Barlassina 11, Lentate 9, Seregno 289). Il codice non li legge.

**Edifici.**
- `EDIFC_TY` ha i nuovi `03`, `09`, `14`, `95` (Mariano 161), `-99991`.
- `EDI_MIN_TY` ha i nuovi `02`, `03`, `05`, `13` (Seregno 101), `15`, `16`, `95`.
- `EDIFC_USO` è molto più dettagliato altrove: 15-25 codici a sei cifre nuovi per comune (`0303`, `0101`, `1202`, `030101`, `060301`...).
- `EDIFC_CR_EDF_IS` (impronta con quota) manca per 145 edifici di Mariano, che hanno solo `EDIFC_CR_EDF_ME`.

**Altezze `UN_VOL`.**
- `UN_VOL_AV` è 0 in 5 153 volumi su 14 093 a Cesano (37%) e in 320 a Seregno. A Mariano è 0 in 127 volumi e ≤ 1 in 406, con un minimo di −10 m. A Meda è sempre > 1.
- `UN_VOL_QE` non vuol dire la stessa cosa ovunque: a Meda, Cesano, Seregno e Seveso è uguale ad `AV`, a Barlassina, Cabiate e Lentate è 0, a Mariano è la quota assoluta di estrusione (`UN_VOL_EX 01`, mediana 260 m). Il codice usa solo `AV`.
- `UN_VOL_POR 06` (Barlassina, Cabiate, Lentate) e `95` (Seregno) sono nuovi.

**Verde e attrezzature.**
- Già coperti dalle tabelle di `dbgt_verde.py`: `AR_VRD_TY 95`/`07`; `BOSCO_TY 03`/`04`; `CL_AGR_TY 01`, `02`, `05`, `06`, `09`, `95`; `FIL_AL_TY 02` (siepi), che prevale a Barlassina (305), Cabiate (261) e Lentate (370).
- Non coperti: `ATTR_SP_TY` usa i sottocodici `0201`-`0204` dappertutto, che vanno bene, ma `0805` (Lentate 3), `15` (Mariano 2) e `02` senza sottocodice (Barlassina, Lentate, Mariano) non sono in `SPORT_DBGT`.
- `MAN_TR_TY` ha i nuovi `09` (Mariano 128), `12`, `07`, `95`, `None`. `MAN_TR_VRD` (verde sulle isole), vuoto a Meda, a Mariano ha valori veri (`01` 237, `02` 164).
- Altri codici nuovi: `PAR_AR_TY` `04`, `08`, `09`, `11`; `MN_IND_TY` `0703`, `0701`, `070202`, `02`, `06`, `08`, `09`, `95`; `TRAL_TY` `08`, `10`, `-99991`; `SP_ACQ_TY` `02`, `03`; `GALLER_TY -99991` (Seregno 2).

**Accessi.**
- `ACC_PC` (passi carrai): Cabiate non ne ha, Mariano 7. Barlassina ha in più `ACC_PC_TY` (`01` 95, `02` 199).
- `ACC_INT` (accessi interni): solo a Meda (3 731) e Seveso (3 313).
- Le quote dei punti `ACC_PC`/`ACC_INT` sono 0 ovunque tranne a Barlassina, come a Meda.

**Ponti.** I campi numerici di `PONTE` (`PONTE_LL`, `*_QE`) sono vuoti o 0 ovunque. `PONTE_MAT` e `PONTE_STRU` hanno valori veri solo a Barlassina, Cabiate, Lentate e Mariano.

**Punti quotati.** `PT_QUO_Q` è 0 a Barlassina (tutti), Cabiate (12 627 su 12 631) e Lentate (24 102 su 24 141). La quota buona è la Z della geometria.

## Quote: dove sono 0 o sbagliate

- **Sotto i 200 m.** Cesano: assi `EL_STR` da 190,5 m, `AC_VEI` da 190,5, edifici da 189. In tutto il comune la soglia `ZMIN = 200` scarterebbe 4 571 vertici di assi su 13 574, 20 045 di `AC_VEI`, 27 660 di `AR_STR` e 44 533 di `UN_VOL`. Dentro il riquadro sono pochi: il minimo è 198,9-199,7 m, con 1 vertice di `AC_VEI`, 15 di edifici, 22 di volumi e 43 di verde sotto i 200. Seveso nel riquadro: minimo 198,9 m, 25 vertici di volumi e 6 di verde. Oggi si perde poco, ma la soglia non regge se la mappa si allarga (fase 8).
- **Quota 0.**
  - `ALVEO_A` di Seveso: 2 285 vertici su 2 342 (31 alvei su 33). Anche quelli di Barlassina (1) e Cesano (4) sono tutti a 0.
  - `ALBERO` di Cesano: 17 431 su 19 046.
  - `TR_ELE` quasi ovunque.
  - `AC_VEI` a Mariano 774 vertici (0,6%), Seregno 306; `AR_STR` a Cabiate 426, Mariano 789. A Meda erano 192.
  - Il motore li tratta già come buchi (`SC_Z0`).
- **Quote sbagliate isolate**, che la soglia oggi scarta:
  - una galleria di Seveso a 105,8 m (30 vertici);
  - `AC_PED`/`AR_STR` a 8,5 m (Seveso);
  - `AC_VEI`/`AR_STR` a 64 m (Lentate);
  - `AATT` a 107,7 m, edifici a 130,9 m e `CL_AGR` a 67,5 m (Seregno).
  - A Meda: `AC_VEI` a 112,7 m, `BOSCO` a 26,3 m, `ALVEO` a 109,5 m.
- **Sopra i 450 m e negativi:** nessuno. Il massimo è 351 m (Mariano, `SCARPT`).

## Comune per comune: cosa costringerebbe a cambiare il codice scritto per Meda

**Barlassina (2018, 7,5% del riquadro).**
- `*_LIV` vuoto (`' '`) invece di `-99991`: chi confronta con `-99991` o `None` deve accettare anche il vuoto.
- Passi carrai con tipo (`ACC_PC_TY`) e con quota; niente `ACC_INT`, quindi gli ingressi pedonali non vengono dal DBGT.
- Muri quasi tutti `17`; 397 muri di sostegno `MU_SOS` come poligoni.
- `AR_STR` in 48 pezzi grandi (media 6 700 m²): un algoritmo che lavora "per pezzo di `AR_STR`" vede un pezzo per quartiere.
- Cortili `0307` quasi assenti (43): niente pavimentazione dei cortili dal DBGT.
- L'offset più alto (+0,25 m) e un alveo a quota 0.

**Cabiate (2021, 8,4%).**
- Nessun passo carraio: i cancelli carrai non vengono dal DBGT.
- `*_LIV` vuoto; `AR_STR` in 20 pezzi da 2 ha; cortili quasi assenti (62).
- Muri `02` (cancellate, 3 693); `EL_DIV_TY 04` nuovo.
- `FIL_AL` quasi tutte siepi (`02`).
- Join con qualche sottoarea orfana (19 `AR_VRD`, 5 `CL_AGR`).

**Cesano Maderno (rilievo 2005 nei dati, 7,0%).**
- `ZMIN = 200` fisso: il terreno scende a 189 m.
- `AR_STR_SED 95` (25), preso per un ponte.
- `UN_VOL_AV` = 0 nel 37% dei volumi: l'altezza va da DSM − DTM, da OSM o dal tipo.
- Niente `EL_CIC` (piste ciclabili solo come 1 area), niente `FIL_AL`.
- Cortili quasi assenti (21); `ALBERO` a quota 0 (gli alberi vanno appoggiati al terreno, come già fa il gioco).
- Classifica `EL_STR_CF 04` su metà delle vie.
- Rilievo vecchio: vale la regola 3 di `docs/fonti.md` (OSM vince su quello che il DBGT non ha).

**Lentate sul Seveso (2021, 13,4%).**
- 12 assi `EL_STR` e 4 aree `AC_VEI` in galleria (`SED 03`): vanno sotto terra, non su un impalcato. Oggi `dbgt_quote.is_deck` e `impalcati.py` li tratterebbero come ponti.
- Niente `ALVEO` né `ARGINE`: il Seveso a Lentate ha solo `EL_IDR`, quindi letto e sponde vengono dal LiDAR e da OSM.
- Muri quasi tutti `17`, 421 `MU_SOS`, 72 `SV_STR`.
- `AR_STR` in 39 pezzi da 2,5 ha.
- Unico comune con `COMUNE` e `LIM_COM` completi.

**Mariano Comense (2015 per la Regione, 2019 nei dati, 3,4%).**
- Le aree hanno `*_LIV` compilato: `01` = in sottopasso su 60 `AC_VEI`. Il motore può usarlo per i sottopassi, ma deve accettare anche questi valori.
- `UN_VOL_QE` è una quota assoluta (`UN_VOL_EX 01`): non è un'altezza.
- `UN_VOL_AV` negativa o ≤ 1 in 406 volumi; 145 edifici solo con `EDIFC_CR_EDF_ME`.
- 2 683 siepi come `EL_DIV 19`; `MAN_TR_VRD` compilato.
- `DATA_INI 2999-12-31` su 5 068 oggetti: data fittizia, non va letta come una data vera.
- Solo 7 passi carrai, niente `ACC_INT`.
- Nel riquadro ci sono solo 0,99 km² (709 assi, 528 edifici).

**Seregno (2007, 9,1%).**
- Nessun corso d'acqua (`EL_IDR`, `ALVEO`, `ARGINE` assenti): il codice dell'acqua deve funzionare senza.
- `SED 03` (4 assi, 6 aree) e `AR_STR_SED 95` (48).
- `UN_VOL_AV` = 0 in 320 volumi.
- Cortili praticamente assenti (3).
- `EL_STR_CF 04` su metà delle vie; muri `18`/`95`; 289 `MU_DIV`.
- Rilievo del 2007: OSM vince sul nuovo.

**Seveso (2015, 23,7%).** È il più simile a Meda: stessa data di rilievo (2015-03-28), cortili `0307` (2 463), `ACC_INT` (3 313), muri `95`.
- `SED 03` su 6 assi e 3 aree; `AR_STR_SED 95` su 9.
- Gli alvei `ALVEO_A` sono a quota 0 (31 su 33): il letto del Seveso viene dal LiDAR.
- Una galleria (`GALLER`) ha la quota sbagliata (105,8 m): `impalcati.py` la troverebbe senza quota.
- Terreno fino a 199 m, vicino alla soglia.

## Cosa va reso generico nel codice

Righe del ramo `motore` al 24/10 (`cec6fb1`) e dei rami di lavoro dove indicato.

**Percorsi e nome di Meda nella build del terreno (motore nuovo).**
- `src/dbgt_quote.py:398`: `--gpkg` di default è `data/dbt/Meda/dbgt.gpkg` (anche nell'uso, r. 4).
- `src/superficie.py:306`, `:926`, `:937`, `:1228`: `comune='Meda'` di default. `:308`: un solo gpkg per volta, `data/dbt/<comune>/dbgt.gpkg`, che non vede `estratto/`. Una `Superficie` lavora su un comune solo e il raccordo tra comuni (anche dell'offset) non c'è. `:1208`: `S_meda.png`.
- `src/impalcati.py:772`, `:784`: `comune='Meda'` di default. `:8`, `:782`, `:816`, `:817`, `:840`: file `decks_meda.json` e `impalcati_meda.png`.
- `src/terreno_gioco.py:27`: `--comune` di default Meda. `:3`, `:25`, `:43`: legge `decks_meda.json`. `indice.json` porta un solo `comune`.
- `src/mondo/terreno_unico.py:67`: percorso di Meda scritto nel codice.
- `src/build.py:20`: il DBGT di Meda è tra i file obbligatori. `:31`: elenca solo `data/dbt/*/dbgt.gpkg`, non `estratto/`.
- `src/build_data.py:212-215`: legge solo `data/dbt/<cartella>/dbgt.gpkg` e vuole che il nome della cartella coincida con un confine OSM (`confini_comuni.json`). È già multi-comune, ma non vede `estratto/` e prende il confine da OSM, non dal DBGT.
- Rami di lavoro: `src/dbgt_verde.py:398` (`origin/motore-verde`) chiama `confine_comune('Meda')` nel `main`, e alla r. 97 legge solo `<cartella>/dbgt.gpkg`. `src/build_data.py:515` (`origin/motore-strade`) costruisce l'elenco dei gpkg allo stesso modo.

**Regole che valgono solo per i dati di Meda.**
- `src/dbgt_quote.py:18` e `src/mondo/terreno_unico.py:21`: `ZMIN = 200` m fisso. Per i buchi conviene una soglia relativa al LiDAR o al terreno del comune (es. |Z − LiDAR| > 30 m, oppure Z < minimo del DTM − 10 m), più lo 0 esplicito.
- `src/dbgt_quote.py:158` (`is_deck`): ogni `SED` diverso da `01` e `None` è un impalcato. Va scritto per codice: `02` ponte, `03` galleria (sotto terra, non impalcato), `04` diga, `95`, `' '` e `-99991` = sconosciuto, cioè a raso. Lo stesso in `src/impalcati.py:270` e `:273`, che mettono `02` e `03` insieme tra gli assi "sopra" un impalcato, e in `src/superficie.py:176` (`sed_ok`).
- `src/dbgt_quote.py:311` e `:353`: offset e cordolo solo su `SED == '01'`. Va bene, ma l'offset si misura per comune e va raccordato al confine.
- `*_LIV`: chi lo legge (`src/impalcati.py:269-271`, `liv == '01'`) deve trattare `-99991`, `' '` e `None` come "non so", non come "non in sottopasso". A Mariano `LIV` è compilato anche sulle aree.
- Cortili `AC_VEI ZON 0307`: `src/superficie.py:406` e `:411`, e nei rami `dbgt_strade.py:32` (`CORTILE`), `:401` (`NON_CARR`) e `dbgt_verde.py` (`NO_TREE`, r. 65 e il filtro su `'0307'` alla r. 130). Funzionano, ma altrove i cortili non sono nel DBGT: per i cortili da `AC_VEI` (che in §7 sostituiscono `YARDS`) serve un ripiego dove il comune ne ha pochi (Barlassina, Cabiate, Cesano, Seregno).
- `dbgt_strade.py:400` (`TRONCO`): va bene con `01` e `0101`. `0204`, `02`, `03`, `06` finiscono in asfalto non tronco: da decidere se `0204` (piazza) va con le piazze.
- `src/build_data.py:226`: `UN_VOL_AV <= 1` scartato. A Cesano è il 37% dei volumi, a Mariano ci sono altezze negative. Serve un ripiego (DSM − DTM, OSM, tipo di edificio) e la riga nel rapporto. Non usare `UN_VOL_QE` come altezza: a Mariano è una quota assoluta.
- `src/build_data.py:220` (`EL_DIV_TY`) e `src/barriere.py`: i codici bastano per tutti. In più ci sono `MU_SOS` e `MU_DIV` come poligoni, che il codice non legge.
- Ramo verde, `dbgt_verde.py:39` (`SPORT_DBGT`): mancano `0805`, `15` e `02` senza sottocodice. `dbgt_verde.py:57` (`SURF`): mancano le superfici che a Meda non ci sono (`MU_SOS_MSOS_SUP`, `MU_DIV_MU_DIV_SUP`, `FOR_PC_FOR_PC_SUP`, `F_NTER_F_NTER_SU`, `OP_REG_OP_REG_SUP`).
- Ramo strade, `dbgt_strade.py:551`: "`MAN_TR_VRD` is empty at Meda". A Mariano è compilato e si può usare dove c'è.
- Confine del comune: non dallo strato `COMUNE` (vedi sopra), ma dall'unione di `copertura_completa` del `base_dbt_per_pianificazione.gpkg` dello stesso zip, oppure da OSM come oggi (`dbgt_quote.confine_comune`, `build_data.py` r. 206-210). Le due fonti coincidono con un IoU di 0,985-0,999.
- Date: `DATA_INI` è vuota in tre comuni e vale 2999-12-31 su migliaia di oggetti a Mariano. L'anno del rilievo per la regola "OSM più recente vince" va preso dalla tabella della Regione (`docs/dati.md`), non dai dati.

**Nel gioco** (non dipende dal DBGT, ma ha "Meda" scritto nel codice).
- `src/world3.js:1658`: `townOf` ripiega su `'Meda'`.
- `src/altezze3.js:3-4`, `:18`, `:463`: i commenti parlano dei `.bin` "solo a Meda". La logica guarda la tile, non il comune, ed è già generica.
- `src/landmarks3.js` (modelli e coordinate a mano di Meda) esce comunque in `src/_vecchi/` secondo §7.
- Titoli, banner e punto di partenza in `src/assemble3.py` (r. 220-247, 318-322, 359, 382, 483-507) e `src/game.src.html` (r. 10, 121-147, 1692, 1803, 1838) sono nomi di luoghi e testi: possono restare.
