# "Is there a point closer than r?" on a list that only grows, without going through the whole list each time (build più veloce, 3/11).
# The build asked any(math.dist(p, m(x)) < r for x in lista) for every candidate: thousands of candidates on thousands of gates.
# Here the points sit in square cells; a question looks only in the cells the square of side 2r round p touches, and it makes the
# same comparison math.dist(p, m(x)) < r on the same numbers: the answer is the same, true or false, as the loop on the whole list.
# The list may grow between questions (gate_out.append): the new elements are put in their cells at the next question. It must not
# change otherwise (no element removed, replaced or reordered) while the index is in use.
import math


class PuntiVicini:
    def __init__(s, lista, punto=lambda x: x, cella=4.0):
        s.l = lista; s.f = punto; s.c = float(cella); s.n = 0; s.d = {}

    def _sync(s):
        l, f, c, d = s.l, s.f, s.c, s.d
        while s.n < len(l):
            p = f(l[s.n]); d.setdefault((math.floor(p[0] / c), math.floor(p[1] / c)), []).append(p); s.n += 1

    def entro(s, p, r):
        """any(math.dist(p, punto(x)) < r for x in lista)"""
        s._sync(); c, d = s.c, s.d; R = r + 1e-6   # the cells a hair wider than r: no rounding can leave a point within r outside them
        for i in range(math.floor((p[0] - R) / c), math.floor((p[0] + R) / c) + 1):
            for j in range(math.floor((p[1] - R) / c), math.floor((p[1] + R) / c) + 1):
                for m in d.get((i, j), ()):
                    if math.dist(p, m) < r: return True
        return False
