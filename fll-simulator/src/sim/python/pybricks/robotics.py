import _sim
import _simapi
from pybricks.parameters import Stop


class DriveBase:
    def __init__(self, left_motor, right_motor, wheel_diameter, axle_track):
        self._id = _sim.drive_new(left_motor._p, left_motor._dir, right_motor._p, right_motor._dir, wheel_diameter, axle_track)
        self.distance_control = None
        self.heading_control = None

    def _go(self, kind, a, b, then, wait):
        cid = _sim.drive_cmd(self._id, kind, a, b, then)
        if wait:
            while not _sim.drive_done(self._id, cid):
                _simapi.step()

    def straight(self, distance, then=Stop.HOLD, wait=True):
        self._go("straight", distance, 0, then, wait)

    def turn(self, angle, then=Stop.HOLD, wait=True):
        self._go("turn", angle, 0, then, wait)

    def curve(self, radius, angle, then=Stop.HOLD, wait=True):
        self._go("curve", radius, angle, then, wait)

    def arc(self, radius, angle=None, distance=None, then=Stop.HOLD, wait=True):
        if angle is None:
            import math
            angle = distance / radius * 180 / math.pi if radius else 0
        self._go("curve", radius, angle, then, wait)

    def drive(self, speed, turn_rate):
        _sim.drive_drive(self._id, speed, turn_rate)

    def stop(self):
        _sim.drive_stop(self._id, "coast")

    def brake(self):
        _sim.drive_stop(self._id, "brake")

    def distance(self):
        _simapi.cost()
        return int(round(_sim.drive_state(self._id)[0]))

    def angle(self):
        _simapi.cost()
        return int(round(_sim.drive_state(self._id)[2]))

    def state(self):
        s = _sim.drive_state(self._id)
        return (int(s[0]), int(s[1]), int(s[2]), int(s[3]))

    def reset(self, distance=0, angle=0):
        _sim.drive_reset(self._id, distance, angle)

    def settings(self, straight_speed=None, straight_acceleration=None, turn_rate=None, turn_acceleration=None):
        r = _sim.drive_settings(self._id, straight_speed, straight_acceleration, turn_rate, turn_acceleration)
        if straight_speed is None and straight_acceleration is None and turn_rate is None and turn_acceleration is None:
            return tuple(int(x) for x in r)

    def use_gyro(self, use_gyro):
        _sim.drive_gyro(self._id, bool(use_gyro))

    def done(self):
        return _sim.drive_done(self._id, -1)

    def stalled(self):
        return _sim.drive_stalled(self._id)


class GyroDriveBase(DriveBase):
    def __init__(self, *a):
        DriveBase.__init__(self, *a)
        self.use_gyro(True)
