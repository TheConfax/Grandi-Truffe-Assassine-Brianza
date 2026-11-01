"""Il riquadro della mappa, in un posto solo: lo leggono build.py, superficie.py e dbgt_manufatti.py.
L'origine del gioco (LAT0, LON0) è il centro del riquadro e non si sposta mai: tutte le coordinate scritte a mano (ritocchi, rotonde, segnaletica, prove fisse) dipendono da lei.
Il gioco vuole un riquadro simmetrico attorno all'origine (META.hw, META.hh), quindi per coprire Seveso a ovest si allarga anche a est.
L'allargamento è un multiplo esatto della tile (250 m): i tile e il reticolo da 2 e 10 m restano sugli stessi punti di prima, cambia solo il numero del tile (tx + 3)."""
import math

LAT0, LON0 = 45.6575, 9.154
KX = 111320 * math.cos(math.radians(LAT0))
ALLARGA_X = 750.0   # m per lato, oltre i 2878,8 m di prima. Seveso arriva a x -3611,2 (lon 9,1076)
S, N = 45.6345, 45.6805
W, E = 9.117 - ALLARGA_X / KX, 9.191 + ALLARGA_X / KX
BBOX = (S, N, W, E)
