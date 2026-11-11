import _sim
import _simapi
from pybricks.parameters import Color


class _IMU:
    def heading(self):
        _simapi.cost()
        return _sim.imu()[0]

    def reset_heading(self, angle=0):
        _sim.imu_reset(angle)

    def tilt(self):
        _simapi.cost()
        h, yaw, pitch, roll = _sim.imu()
        return (round(pitch), round(roll))

    def angular_velocity(self, axis=None):
        return 0 if axis is not None else (0, 0, 0)

    def acceleration(self, axis=None):
        return 9810 if axis is not None else (0, 0, 9810)

    def up(self):
        return "TOP"

    def ready(self):
        return True

    def stationary(self):
        return True


class _Display:
    def text(self, text, on=500, off=50):
        _sim.display(str(text))

    def number(self, number):
        _sim.display(str(number))

    def char(self, char):
        _sim.display(str(char))

    def icon(self, icon):
        _sim.display(str(icon))

    def off(self):
        _sim.display("")

    def pixel(self, row, column, brightness=100):
        pass

    def orientation(self, up):
        pass


class _Light:
    def on(self, color=Color.WHITE):
        _sim.light(0)

    def off(self):
        pass

    def blink(self, color, durations):
        pass

    def animate(self, colors, interval):
        pass


class _Speaker:
    def beep(self, frequency=500, duration=100):
        _sim.beep(frequency, duration)
        _simapi.wait_ms(duration)

    def play_notes(self, notes, tempo=120):
        for _ in notes:
            _simapi.wait_ms(int(60000 / tempo / 4))

    def volume(self, volume=None):
        return 100


class _Buttons:
    def pressed(self):
        return set()


class _Battery:
    def voltage(self):
        return 8000

    def current(self):
        return 150


class _System:
    def set_stop_button(self, button):
        pass

    def name(self):
        return "SIM"


class PrimeHub:
    def __init__(self, top_side=None, front_side=None):
        self.imu = _IMU()
        self.display = _Display()
        self.light = _Light()
        self.speaker = _Speaker()
        self.buttons = _Buttons()
        self.battery = _Battery()
        self.system = _System()


InventorHub = PrimeHub
EssentialHub = PrimeHub
TechnicHub = PrimeHub
