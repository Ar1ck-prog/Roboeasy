# SPIKE 3 `force_sensor` module
import _sim
import _simapi


def force(port):
    """Force in decinewtons (0-100)."""
    _simapi.cost()
    return int(round(_sim.force(_simapi.port_name(port)) * 10))


def pressed(port):
    return force(port) > 5


def raw(port):
    return force(port) * 10
