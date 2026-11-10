# SPIKE 3 runloop: runs async functions cooperatively inside the simulation.
import _simapi
from _simapi import Op


def run(*coros):
    tasks = list(coros)
    while tasks:
        for t in list(tasks):
            try:
                t.send(None)
            except StopIteration:
                tasks.remove(t)
        if tasks:
            _simapi.step()


def sleep_ms(ms):
    end = _simapi.time_ms() + ms
    return Op(lambda: _simapi.time_ms() >= end)


def until(function, timeout=0):
    start = _simapi.time_ms()
    return Op(lambda: function() or (timeout and _simapi.time_ms() - start >= timeout))
