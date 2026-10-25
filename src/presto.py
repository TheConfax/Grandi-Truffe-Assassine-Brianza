# The build on all the cores (docs/dati.md). The heavy calls of the build are GEOS (union, buffer, difference of geometries as big as the
# whole street network) and qhull, and both release the GIL: on threads they run on all the cores with no copy of the data (the machine
# has 16 GB and the build shares them). Each call stays the same call on the same arguments, it is only started earlier, or at the same
# time as others: the result does not change, byte for byte.
# The rules for using it:
#   - presto(fn) starts fn when every input is final: nothing may change them before the result is taken
#   - fn never changes shared state (no appends to the build's lists, no reports, no logs): it returns its result
#   - the result is taken (.result()) where the old code computed it, so the order of everything else stays the same
#   - in_parallelo(fn, items) is [fn(x) for x in items] with the items at the same time, in order: each item on its own
import os
from concurrent.futures import ThreadPoolExecutor

NT = max(2, min(16, os.cpu_count() or 4))
# a few at a time, in the order they are started (first in, first out): a dozen unions of the whole street network at once took more
# memory than the machine had free (GEOS bad allocation with another build running), and the main thread waits for the first ones. A job may wait for a job started before it (it is running or done): never for a
# later one, or the pool could stall
_POOL = ThreadPoolExecutor(max_workers=max(2, min(4, NT // 2)), thread_name_prefix='presto')


def presto(fn, *a, **k):
    """fn(*a, **k) started now on a thread; .result() gives its value (and raises its exception)"""
    return _POOL.submit(fn, *a, **k)


def in_parallelo(fn, items, nt=NT):
    """[fn(x) for x in items] on nt threads, in order"""
    items = list(items)
    if len(items) < 2 or nt < 2: return [fn(x) for x in items]
    with ThreadPoolExecutor(nt) as ex: return list(ex.map(fn, items))
