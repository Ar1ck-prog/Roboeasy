# SPIKE 3 `motor` module. Positive velocity = clockwise (looking at the motor output).
import _sim
import _simapi
from _simapi import Op

COAST = 0
BRAKE = 1
HOLD = 2
CONTINUE = 3
SMART_COAST = 4
SMART_BRAKE = 5
CLOCKWISE = 0
COUNTERCLOCKWISE = 1
SHORTEST_PATH = 2
LONGEST_PATH = 3
READY = 0
RUNNING = 1
STALLED = 2
CANCELED = 3
ERROR = 4
DISCONNECTED = 5

_STOP = {COAST: "coast", BRAKE: "brake", HOLD: "hold", CONTINUE: "continue", SMART_COAST: "coast", SMART_BRAKE: "brake"}


def _p(port):
    return _simapi.port_name(port)


def _op(port, cid):
    p = _p(port)
    return Op(lambda: _sim.motor_done(p, cid), lambda: STALLED if _sim.motor_stalled(p) else READY)


def run(port, velocity, *, acceleration=1000):
    _sim.motor_run(_p(port), velocity, acceleration)


def run_for_degrees(port, degrees, velocity, *, stop=BRAKE, acceleration=1000, deceleration=1000):
    sign = -1 if velocity < 0 else 1
    cid = _sim.motor_run_angle(_p(port), abs(velocity), sign * degrees, _STOP.get(stop, "brake"), acceleration, deceleration)
    return _op(port, cid)


def run_for_time(port, duration, velocity, *, stop=BRAKE, acceleration=1000, deceleration=1000):
    cid = _sim.motor_run_time(_p(port), velocity, duration, _STOP.get(stop, "brake"), acceleration)
    return _op(port, cid)


def run_to_relative_position(port, position, velocity, *, stop=BRAKE, acceleration=1000, deceleration=1000):
    cid = _sim.motor_run_target(_p(port), abs(velocity), position, _STOP.get(stop, "brake"), acceleration, deceleration)
    return _op(port, cid)


def run_to_absolute_position(port, position, velocity, *, direction=SHORTEST_PATH, stop=BRAKE, acceleration=1000, deceleration=1000):
    p = _p(port)
    cur = _sim.motor_angle(p)
    absolute = cur % 360
    delta = (position - absolute) % 360
    if direction == SHORTEST_PATH:
        if delta > 180:
            delta -= 360
    elif direction == COUNTERCLOCKWISE:
        delta = delta - 360 if delta > 0 else delta
    elif direction == LONGEST_PATH:
        if delta < 180:
            delta -= 360 if delta > 0 else 0
    cid = _sim.motor_run_target(p, abs(velocity), _sim.motor_rel(p) + delta, _STOP.get(stop, "brake"), acceleration, deceleration)
    return _op(port, cid)


def stop(port, *, stop=BRAKE):
    _sim.motor_stop(_p(port), _STOP.get(stop, "brake"))


def relative_position(port):
    _simapi.cost()
    return int(round(_sim.motor_rel(_p(port))))


def reset_relative_position(port, position):
    _sim.motor_reset(_p(port), position)


def absolute_position(port):
    _simapi.cost()
    a = int(round(_sim.motor_angle(_p(port)))) % 360
    return a - 360 if a > 180 else a


def velocity(port):
    _simapi.cost()
    return int(round(_sim.motor_speed(_p(port))))


def set_duty_cycle(port, pwm):
    _sim.motor_dc(_p(port), pwm / 100.0)


def get_duty_cycle(port):
    return 0
