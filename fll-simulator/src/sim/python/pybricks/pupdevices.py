import _sim
import _simapi
from pybricks.parameters import Direction, Stop, Color, _COLOR_BY_NAME


def _port(p):
    return _simapi.port_name(p)


class _Lights:
    def on(self, *a):
        pass

    def off(self):
        pass


class Motor:
    def __init__(self, port, positive_direction=Direction.CLOCKWISE, gears=None, reset_angle=True, profile=None):
        self._p = _port(port)
        if not _sim.motor_exists(self._p):
            raise OSError("На порту %s нет мотора (проверьте порты в конструкторе)" % self._p)
        self._dir = positive_direction
        self._ratio = 1.0
        if gears:
            g = gears[0] if isinstance(gears[0], (list, tuple)) else gears
            self._ratio = g[-1] / g[0]
        if reset_angle:
            _sim.motor_reset(self._p, 0)

    def _u(self, physical):
        return physical * self._dir / self._ratio

    def angle(self):
        _simapi.cost()
        return int(round(self._u(_sim.motor_rel(self._p))))

    def speed(self, window=100):
        _simapi.cost()
        return int(round(self._u(_sim.motor_speed(self._p))))

    def reset_angle(self, angle=None):
        _sim.motor_reset(self._p, 0 if angle is None else angle * self._dir * self._ratio)

    def stop(self):
        _sim.motor_stop(self._p, "coast")

    def brake(self):
        _sim.motor_stop(self._p, "brake")

    def hold(self):
        _sim.motor_stop(self._p, "hold")

    def run(self, speed):
        _sim.motor_run(self._p, speed * self._dir * self._ratio, 0)

    def dc(self, duty):
        _sim.motor_dc(self._p, duty * self._dir / 100.0)

    def _wait(self, cid, wait):
        if wait:
            while not _sim.motor_done(self._p, cid):
                _simapi.step()

    def run_time(self, speed, time, then=Stop.HOLD, wait=True):
        cid = _sim.motor_run_time(self._p, speed * self._dir * self._ratio, time, then, 0)
        self._wait(cid, wait)

    def run_angle(self, speed, rotation_angle, then=Stop.HOLD, wait=True):
        cid = _sim.motor_run_angle(self._p, speed * self._dir * self._ratio, rotation_angle * self._ratio, then, 0, 0)
        self._wait(cid, wait)

    def run_target(self, speed, target_angle, then=Stop.HOLD, wait=True):
        cid = _sim.motor_run_target(self._p, abs(speed) * self._ratio, target_angle * self._dir * self._ratio, then, 0, 0)
        self._wait(cid, wait)

    def run_until_stalled(self, speed, then=Stop.COAST, duty_limit=None):
        _sim.motor_run(self._p, speed * self._dir * self._ratio, 0)
        _simapi.wait_ms(60)
        while not _sim.motor_stalled(self._p):
            _simapi.step()
        _sim.motor_stop(self._p, then)
        return self.angle()

    def track_target(self, target_angle):
        _sim.motor_hold_at(self._p, target_angle * self._dir * self._ratio)

    def done(self):
        return _sim.motor_done(self._p, -1)

    def stalled(self):
        return _sim.motor_stalled(self._p)

    def load(self):
        return 0


DCMotor = Motor


class ColorSensor:
    def __init__(self, port):
        self._p = _port(port)
        if _sim.sensor_type(self._p) != "color":
            raise OSError("На порту %s нет датчика цвета" % self._p)
        self.lights = _Lights()
        self._colors = None

    def _r(self):
        _simapi.cost()
        return _sim.color(self._p)

    def color(self, surface=True):
        r = self._r()
        if self._colors:
            h, s, v = r[3], r[4], r[5]
            best = min(self._colors, key=lambda c: (min(abs(c.h - h), 360 - abs(c.h - h)) * c.s / 100) ** 2 + (c.s - s) ** 2 + (c.v - v) ** 2)
            return best
        return _COLOR_BY_NAME.get(r[0], Color.NONE)

    def reflection(self):
        return int(self._r()[1])

    def ambient(self):
        return int(self._r()[2])

    def hsv(self, surface=True):
        r = self._r()
        return Color(int(r[3]), int(r[4]), int(r[5]))

    def detectable_colors(self, colors=None):
        if colors is None:
            return self._colors
        self._colors = list(colors)


class UltrasonicSensor:
    def __init__(self, port):
        self._p = _port(port)
        if _sim.sensor_type(self._p) != "distance":
            raise OSError("На порту %s нет датчика расстояния" % self._p)
        self.lights = _Lights()

    def distance(self):
        _simapi.cost()
        d = _sim.distance(self._p)
        return 2000 if d < 0 else int(d)

    def presence(self):
        return False


class ForceSensor:
    def __init__(self, port):
        self._p = _port(port)
        if _sim.sensor_type(self._p) != "force":
            raise OSError("На порту %s нет датчика силы" % self._p)

    def force(self):
        _simapi.cost()
        return round(_sim.force(self._p), 1)

    def distance(self):
        return min(8.0, self.force())

    def pressed(self, force=3):
        return self.force() >= force

    def touched(self):
        return self.force() > 0.3
