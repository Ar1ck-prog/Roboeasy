# SPIKE 3 `hub` module (simulated LEGO Education SPIKE Prime hub).
import _sim
import _simapi
from _simapi import Op


class _Port:
    A = 0
    B = 1
    C = 2
    D = 3
    E = 4
    F = 5


port = _Port()


class _MotionSensor:
    TOP = 0
    FRONT = 1
    RIGHT = 2
    BOTTOM = 3
    BACK = 4
    LEFT = 5

    def tilt_angles(self):
        """(yaw, pitch, roll) in decidegrees. Yaw grows when turning counter-clockwise."""
        _simapi.cost()
        h, yaw, pitch, roll = _sim.imu()
        return (int(round(yaw * 10)), int(round(pitch * 10)), int(round(roll * 10)))

    def reset_yaw(self, angle=0):
        _sim.imu_reset(-angle / 10.0)

    def angular_velocity(self, raw=False):
        return (0, 0, 0)

    def acceleration(self, raw=False):
        return (0, 0, 981)

    def up_face(self):
        return 0

    def stable(self):
        return True


motion_sensor = _MotionSensor()


class _LightMatrix:
    def write(self, text, intensity=100, time_per_character=500):
        _sim.display(str(text))
        return Op(lambda: True)

    def show_image(self, image):
        _sim.display("☺")

    def clear(self):
        _sim.display("")

    def set_pixel(self, x, y, intensity=100):
        pass


light_matrix = _LightMatrix()


class _Sound:
    def beep(self, freq=440, duration=500, volume=100, **kw):
        _sim.beep(freq, duration)
        end = _simapi.time_ms() + duration
        return Op(lambda: _simapi.time_ms() >= end)

    def stop(self):
        pass

    def volume(self, v):
        pass


sound = _Sound()


class _Light:
    POWER = 0
    CONNECT = 1

    def color(self, light, color):
        _sim.light(int(color))


light = _Light()


class _Button:
    LEFT = 1
    RIGHT = 2

    def pressed(self, button):
        return 0


button = _Button()


def device_uuid():
    return "SIM-HUB"


def hardware_id():
    return "SIM"


def power_off():
    pass
