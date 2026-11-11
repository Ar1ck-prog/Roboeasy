# Internal bridge between robot programs and the physics simulation (JS module `_sim`).
import _sim


class SimStop(BaseException):
    """Raised when the program is stopped or the match ends (not caught by `except Exception`)."""


_REASONS = {1: "Программа остановлена", 2: "Матч окончен (2:30)"}


def step():
    code = _sim.step()
    if code:
        raise SimStop(_REASONS.get(code, "stop"))


def cost():
    """Every sensor read takes a little simulated time (like a real hub loop)."""
    code = _sim.cost()
    if code:
        raise SimStop(_REASONS.get(code, "stop"))


def time_ms():
    return _sim.time_ms()


def wait_ms(ms):
    end = _sim.time_ms() + max(0, ms)
    while _sim.time_ms() < end:
        step()


def wait_until(fn):
    while not fn():
        step()


def port_name(p):
    if isinstance(p, int):
        return "ABCDEF"[p]
    return str(p)


class Op:
    """Awaitable operation (SPIKE 3 style). Starts immediately; `await` waits until it is done."""

    def __init__(self, done, result=0):
        self._done = done
        self._result = result

    def done(self):
        return self._done()

    def __await__(self):
        while not self._done():
            yield self
        return self._result() if callable(self._result) else self._result

    def wait(self):
        while not self._done():
            step()
        return self._result() if callable(self._result) else self._result
