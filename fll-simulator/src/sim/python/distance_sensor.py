# SPIKE 3 `distance_sensor` module
import _sim
import _simapi


def distance(port):
    """Distance in millimetres, -1 if nothing is detected."""
    _simapi.cost()
    return int(_sim.distance(_simapi.port_name(port)))


def show(port, pixels):
    pass


def clear(port):
    pass


def get_pixel(port, x, y):
    return 0


def set_pixel(port, x, y, intensity):
    pass
