# SPIKE 3 `color_sensor` module
import _sim
import _simapi
import color as _color


def _read(port):
    _simapi.cost()
    return _sim.color(_simapi.port_name(port))


def color(port):
    return _color._FROM_NAME.get(_read(port)[0], _color.UNKNOWN)


def reflection(port):
    return int(_read(port)[1])


def rgbi(port):
    r = _read(port)
    return (int(r[6] * 1024), int(r[7] * 1024), int(r[8] * 1024), int(r[1] * 10.24))
