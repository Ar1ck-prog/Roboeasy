# SPIKE 3 `motor_pair` module. The left motor is mirrored (like the SPIKE driving base).
import _sim
import _simapi
from _simapi import Op
import motor as _motor

PAIR_1 = 0
PAIR_2 = 1
PAIR_3 = 2
_pairs = {}


def pair(pair, left_motor, right_motor):
    _pairs[pair] = (_simapi.port_name(left_motor), _simapi.port_name(right_motor))


def unpair(pair):
    _pairs.pop(pair, None)


def _get(p):
    if p not in _pairs:
        raise RuntimeError("motor_pair: сначала вызовите motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)")
    return _pairs[p]


def _steer(steering, velocity):
    s = max(-100, min(100, steering))
    if s >= 0:
        return velocity, velocity * (1 - s / 50.0)
    return velocity * (1 + s / 50.0), velocity


def move(pair, steering, *, velocity=360, acceleration=1000):
    l, r = _get(pair)
    vl, vr = _steer(steering, velocity)
    _sim.pair_run(l, r, -vl, vr, acceleration)


def move_tank(pair, left_velocity, right_velocity, *, acceleration=1000):
    l, r = _get(pair)
    _sim.pair_run(l, r, -left_velocity, right_velocity, acceleration)


def _deg_move(pair, degrees, vl, vr, stop, acceleration, deceleration):
    l, r = _get(pair)
    fast = max(abs(vl), abs(vr), 1)
    dl = degrees * vl / fast
    dr = degrees * vr / fast
    cid = _sim.pair_move(l, r, -dl, dr, fast, acceleration, deceleration, _motor._STOP.get(stop, "brake"))
    return Op(lambda: _sim.pair_done(cid))


def move_for_degrees(pair, degrees, steering, *, velocity=360, stop=_motor.BRAKE, acceleration=1000, deceleration=1000):
    vl, vr = _steer(steering, velocity)
    if velocity < 0:
        degrees = -abs(degrees)
        vl, vr = -vl, -vr
    return _deg_move(pair, abs(degrees), vl, vr, stop, acceleration, deceleration)


def move_tank_for_degrees(pair, degrees, left_velocity, right_velocity, *, stop=_motor.BRAKE, acceleration=1000, deceleration=1000):
    return _deg_move(pair, degrees, left_velocity, right_velocity, stop, acceleration, deceleration)


def move_for_time(pair, duration, steering, *, velocity=360, stop=_motor.BRAKE, acceleration=1000, deceleration=1000):
    move(pair, steering, velocity=velocity, acceleration=acceleration)
    end = _simapi.time_ms() + duration
    l, r = _get(pair)

    def done():
        if _simapi.time_ms() >= end:
            _sim.pair_stop(l, r, _motor._STOP.get(stop, "brake"))
            return True
        return False

    return Op(done)


def move_tank_for_time(pair, left_velocity, right_velocity, duration, *, stop=_motor.BRAKE, acceleration=1000, deceleration=1000):
    move_tank(pair, left_velocity, right_velocity, acceleration=acceleration)
    end = _simapi.time_ms() + duration
    l, r = _get(pair)

    def done():
        if _simapi.time_ms() >= end:
            _sim.pair_stop(l, r, _motor._STOP.get(stop, "brake"))
            return True
        return False

    return Op(done)


def stop(pair, *, stop=_motor.BRAKE):
    l, r = _get(pair)
    _sim.pair_stop(l, r, _motor._STOP.get(stop, "brake"))
