import _simapi
from _simapi import Op


def wait(time):
    _simapi.wait_ms(time)


class StopWatch:
    def __init__(self):
        self._start = _simapi.time_ms()
        self._paused = None

    def time(self):
        now = self._paused if self._paused is not None else _simapi.time_ms()
        return int(now - self._start)

    def pause(self):
        if self._paused is None:
            self._paused = _simapi.time_ms()

    def resume(self):
        if self._paused is not None:
            self._start += _simapi.time_ms() - self._paused
            self._paused = None

    def reset(self):
        self._start = _simapi.time_ms()
        if self._paused is not None:
            self._paused = self._start


def multitask(*coros, race=False):
    tasks = list(coros)

    def gen():
        while tasks:
            for t in list(tasks):
                try:
                    t.send(None)
                except StopIteration:
                    tasks.remove(t)
                    if race:
                        return
            if tasks:
                yield
    g = gen()

    class _M:
        def __await__(self):
            return (yield from g)
    return _M()


def run_task(coro):
    import runloop
    runloop.run(coro)


def hub_menu(*symbols):
    return symbols[0] if symbols else None
