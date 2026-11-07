# Campione di 30 cancelli della regola dei varchi

Totale cancelli dalla regola (build di origin/dev con etichetta d'origine): 2926 su 12775 cancelli finali in tutta la mappa; per sottotipo {'passo_carraio': 255, 'rampa': 8, 'varco': 1770, 'capo_recinzione': 893}.
In Meda e Seveso: 2400; per comune e sottotipo {'Meda passo_carraio': 150, 'Seveso passo_carraio': 105, 'Meda rampa': 8, 'Meda varco': 645, 'Seveso varco': 627, 'Seveso capo_recinzione': 484, 'Meda capo_recinzione': 381}.
Pool: etichettati in Meda/Seveso e presenti anche nei dati di dev (8013), esclusi i tre casi noti. Seme 20261107. Quote per sottotipo: {'passo_carraio': 3, 'varco': 14, 'capo_recinzione': 10, 'rampa': 3}.

Criteri (si = il dato rispetta il criterio): a = nessuna recinzione/edificio fra cancello e strada; b = recinzioni ai lati parallele alla linea del cancello (entro 25 gradi); c = dietro ingresso/passo carraio/edificio/parcheggio; d = nessuna via o sentiero OSM attraversa il cancello; e = larghezza 2.5-7.5 m. n.d. = dato non calcolabile (capo su edificio o senza strada).

1. [varco] Meda, Via del Cimitero, larghezza 4.4 m
   link http://127.0.0.1:8013/?x=521.0&z=-273.2&debug=1   (cancello a x 517.5 z -275.2)
   lati: DBGT 95 | edificio; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a si; b NO; c NO; d si; e si
2. [varco] Seveso, Via Antonio Rosmini, larghezza 3.9 m
   link http://127.0.0.1:8013/?x=586.8&z=1329.2&debug=1   (cancello a x 589.0 z 1325.8)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: suolo senza classe, a 8 m: edificio
   a si; b NO; c si (passo carraio DBGT); d si; e si
3. [capo_recinzione] Meda, Via Como, larghezza 2.5 m
   link http://127.0.0.1:8013/?x=541.6&z=-1180.5&debug=1   (cancello a x 544.0 z -1177.2)
   lati: DBGT 95/edificio | DBGT 95; dietro a 3 m: edificio, a 8 m: edificio
   a NO (DBGT 95); b NO; c si (passo carraio DBGT, edificio subito dietro); d si; e si
4. [varco] Meda, Via San Giorgio, larghezza 7.8 m
   link http://127.0.0.1:8013/?x=1615.5&z=-596.0&debug=1   (cancello a x 1616.7 z -599.9)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: verde DBGT 01, a 8 m: OSM landuse=industrial
   a si; b si; c NO; d si; e NO
5. [capo_recinzione] Seveso, Via Udine, larghezza 4.8 m
   link http://127.0.0.1:8013/?x=-2272.0&z=1865.9&debug=1   (cancello a x -2269.5 z 1862.8)
   lati: DBGT 95 | DBGT 95/edificio; dietro a 3 m: suolo senza classe, a 8 m: verde DBGT 01
   a si; b NO; c si (ingresso DBGT, passo carraio DBGT); d si; e si
6. [passo_carraio] Meda, Via San Giuseppe, larghezza 11.6 m
   link http://127.0.0.1:8013/?x=458.8&z=-1108.0&debug=1   (cancello a x 462.8 z -1107.9)
   lati: edificio | edificio; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a si; b n.d.; c si (ingresso DBGT, passo carraio DBGT); d si; e NO
7. [capo_recinzione] Seveso, Via Asiago, larghezza 11.0 m
   link http://127.0.0.1:8013/?x=-285.3&z=1911.1&debug=1   (cancello a x -281.7 z 1909.3)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: verde DBGT 01, a 8 m: edificio
   a NO (DBGT 95); b NO; c si (ingresso DBGT, passo carraio DBGT); d si; e NO
8. [passo_carraio] Seveso, Via Vico Necchi, larghezza 7.6 m
   link http://127.0.0.1:8013/?x=-8.7&z=1998.1&debug=1   (cancello a x -12.6 z 1997.2)
   lati: DBGT 13 | DBGT 95; dietro a 3 m: OSM landuse=residential, a 8 m: OSM landuse=residential
   a si; b NO; c si (ingresso DBGT, passo carraio DBGT); d si; e NO
9. [varco] Seveso, Via Sondrio, larghezza 4.3 m
   link http://127.0.0.1:8013/?x=1595.0&z=1416.7&debug=1   (cancello a x 1599.0 z 1416.3)
   lati: edificio | DBGT 95; dietro a 3 m: verde DBGT 01, a 8 m: verde DBGT 01
   a NO (DBGT 95); b NO; c NO; d si; e si
10. [varco] Seveso, Via Ada Negri, larghezza 4.3 m
   link http://127.0.0.1:8013/?x=-353.4&z=897.9&debug=1   (cancello a x -353.8 z 901.9)
   lati: DBGT 95 | edificio; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a NO (DBGT 95); b NO; c NO; d si; e si
11. [capo_recinzione] Meda, Via Santa Maria, larghezza 11.3 m
   link http://127.0.0.1:8013/?x=-328.1&z=-2163.9&debug=1   (cancello a x -324.8 z -2166.1)
   lati: DBGT 13 | edificio; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a NO (DBGT 95); b si; c NO; d si; e NO
12. [varco] Meda, (senza nome, unclassified), larghezza 8.4 m
   link http://127.0.0.1:8013/?x=1752.0&z=-1008.8&debug=1   (cancello a x 1748.1 z -1009.9)
   lati: DBGT 18 | DBGT 18; dietro a 3 m: suolo senza classe, a 8 m: OSM landuse=industrial
   a si; b NO; c NO; d si; e NO
13. [varco] Meda, Via Consorziale dei boschi, larghezza 2.9 m
   link http://127.0.0.1:8013/?x=870.9&z=64.5&debug=1   (cancello a x 870.8 z 60.5)
   lati: edificio | DBGT 95; dietro a 3 m: verde DBGT 01, a 8 m: OSM landuse=residential
   a NO (DBGT 95); b NO; c si (ingresso DBGT, passo carraio DBGT); d si; e si
14. [varco] Meda, Via Michelangelo Buonarroti, larghezza 2.9 m
   link http://127.0.0.1:8013/?x=881.7&z=-188.2&debug=1   (cancello a x 878.5 z -190.7)
   lati: DBGT 95 | edificio; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a NO (DBGT 95); b NO; c NO; d si; e si
15. [capo_recinzione] Seveso, Via Trapani, larghezza 2.5 m
   link http://127.0.0.1:8013/?x=-2657.5&z=1705.8&debug=1   (cancello a x -2653.6 z 1706.2)
   lati: OSM hedge | DBGT 95/OSM fence; dietro a 3 m: OSM landuse=residential, a 8 m: edificio
   a NO (DBGT 95, OSM fence, OSM hedge); b NO; c NO; d NO (('footway', '')); e si
16. [rampa] Meda, Via Bernardino Luini, larghezza 3.7 m
   link http://127.0.0.1:8013/?x=980.6&z=-378.8&debug=1   (cancello a x 977.9 z -375.9)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: OSM landuse=residential, a 8 m: OSM landuse=residential
   a NO (DBGT 95); b NO; c NO; d si; e si
17. [varco] Meda, Via Como, larghezza 5.7 m
   link http://127.0.0.1:8013/?x=729.1&z=-1656.7&debug=1   (cancello a x 725.2 z -1657.5)
   lati: DBGT 95 | edificio; dietro a 3 m: edificio, a 8 m: edificio
   a NO (DBGT 95); b si; c si (ingresso DBGT, passo carraio DBGT, edificio subito dietro); d si; e si
18. [capo_recinzione] Meda, Via Consorziale dei boschi, larghezza 12.0 m
   link http://127.0.0.1:8013/?x=965.7&z=240.3&debug=1   (cancello a x 962.0 z 241.9)
   lati: DBGT 95 | edificio; dietro a 3 m: OSM landuse=residential, a 8 m: edificio
   a NO (DBGT 95); b si; c si (ingresso DBGT, passo carraio DBGT); d si; e NO
19. [capo_recinzione] Seveso, Via degli Aceri, larghezza 2.3 m
   link http://127.0.0.1:8013/?x=-2062.9&z=1796.0&debug=1   (cancello a x -2064.1 z 1792.2)
   lati: OSM fence | DBGT 95/OSM fence; dietro a 3 m: verde DBGT 01, a 8 m: verde DBGT 01
   a si; b NO; c NO; d si; e NO
20. [varco] Seveso, Via Luigi Bizzozzero, larghezza 4.0 m
   link http://127.0.0.1:8013/?x=-1329.4&z=975.0&debug=1   (cancello a x -1332.3 z 977.7)
   lati: DBGT 95 | edificio; dietro a 3 m: OSM landuse=residential, a 8 m: verde DBGT 01
   a NO (DBGT 95); b si; c si (passo carraio DBGT); d si; e si
21. [capo_recinzione] Meda, Via Asiago, larghezza 4.8 m
   link http://127.0.0.1:8013/?x=1491.0&z=-814.0&debug=1   (cancello a x 1495.0 z -813.5)
   lati: DBGT 95 | DBGT 18/edificio; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a si; b NO; c si (ingresso DBGT, passo carraio DBGT); d si; e si
22. [capo_recinzione] Seveso, Via dei Castagni, larghezza 3.2 m
   link http://127.0.0.1:8013/?x=-1708.3&z=1888.6&debug=1   (cancello a x -1704.3 z 1888.2)
   lati: DBGT 13 | DBGT 13; dietro a 3 m: suolo senza classe, a 8 m: suolo senza classe
   a NO (DBGT 95, OSM fence); b si; c NO; d NO (('track', '')); e si
23. [rampa] Meda, Via Po, larghezza 8.3 m
   link http://127.0.0.1:8013/?x=1318.7&z=853.7&debug=1   (cancello a x 1320.0 z 850.0)
   lati: DBGT 95/edificio | nessuno; dietro a 3 m: OSM landuse=residential, a 8 m: OSM landuse=residential
   a si; b NO; c si (ingresso DBGT); d si; e NO
24. [rampa] Meda, Via Antonio Rosmini, larghezza 15.2 m
   link http://127.0.0.1:8013/?x=-764.2&z=-1208.6&debug=1   (cancello a x -760.8 z -1210.8)
   lati: edificio | DBGT 95; dietro a 3 m: suolo senza classe, a 8 m: verde DBGT 01
   a NO (DBGT 95); b NO; c si (ingresso DBGT); d si; e NO
25. [passo_carraio] Seveso, Via delle Fornaci, larghezza 1.5 m
   link http://127.0.0.1:8013/?x=-1624.5&z=1536.6&debug=1   (cancello a x -1628.0 z 1534.8)
   lati: DBGT 95 | DBGT 02/DBGT 95; dietro a 3 m: OSM landuse=residential, a 8 m: OSM landuse=residential
   a si; b si; c si (ingresso DBGT, passo carraio DBGT); d si; e NO
26. [varco] Seveso, Via Acquedotto, larghezza 10.9 m
   link http://127.0.0.1:8013/?x=-1671.2&z=1477.1&debug=1   (cancello a x -1672.4 z 1473.3)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: verde DBGT 01, a 8 m: verde DBGT 01
   a si; b NO; c si (passo carraio DBGT); d si; e NO
27. [capo_recinzione] Meda, Via Colombara, larghezza 8.0 m
   link http://127.0.0.1:8013/?x=-281.5&z=-1073.5&debug=1   (cancello a x -277.8 z -1074.8)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: verde DBGT 01, a 8 m: verde DBGT 01
   a si; b si; c si (ingresso DBGT, passo carraio DBGT); d si; e NO
28. [varco] Seveso, Via Contardo Ferrini, larghezza 9.8 m
   link http://127.0.0.1:8013/?x=77.8&z=1963.2&debug=1   (cancello a x 74.0 z 1962.0)
   lati: edificio | edificio; dietro a 3 m: OSM landuse=residential, a 8 m: OSM landuse=residential
   a si; b n.d.; c NO; d si; e NO
29. [varco] Meda, Via Adria, larghezza 2.6 m
   link http://127.0.0.1:8013/?x=1372.5&z=665.4&debug=1   (cancello a x 1374.3 z 661.9)
   lati: DBGT 95/edificio | DBGT 95; dietro a 3 m: OSM landuse=residential, a 8 m: verde DBGT 01
   a si; b si; c si (passo carraio DBGT); d si; e si
30. [varco] Seveso, Via delle Grigne, larghezza 12.8 m
   link http://127.0.0.1:8013/?x=496.9&z=2172.2&debug=1   (cancello a x 497.1 z 2176.2)
   lati: DBGT 95 | DBGT 95; dietro a 3 m: edificio, a 8 m: edificio
   a si; b si; c si (edificio subito dietro); d si; e NO

Note: tipi DBGT dei divisori: 02 ringhiera, 04 filo spinato, 13 rete, 17 steccato, 18 paletti e traversi, 19 siepe, 95 altro. "verde DBGT 01" = area verde generica del DBGT. Il link porta a 2,5-6 m davanti al cancello, verso la strada. I criteri sono calcolati dai dati grezzi (DBGT + OSM), non dalla geometria finale del gioco: (a) puo dare NO per un divisore che in gioco e stato tolto o spostato.
