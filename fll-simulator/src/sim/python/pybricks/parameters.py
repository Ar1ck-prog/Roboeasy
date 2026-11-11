class Port:
    A = "A"
    B = "B"
    C = "C"
    D = "D"
    E = "E"
    F = "F"


class Direction:
    CLOCKWISE = 1
    COUNTERCLOCKWISE = -1


class Stop:
    COAST = "coast"
    COAST_SMART = "coast"
    BRAKE = "brake"
    HOLD = "hold"
    NONE = "continue"


class Color:
    def __init__(self, h, s=100, v=100, name=None):
        self.h = h
        self.s = s
        self.v = v
        self.name = name

    def __eq__(self, other):
        if not isinstance(other, Color):
            return False
        if self.name and other.name:
            return self.name == other.name
        return (self.h, self.s, self.v) == (other.h, other.s, other.v)

    def __hash__(self):
        return hash(self.name or (self.h, self.s, self.v))

    def __repr__(self):
        return "Color." + self.name if self.name else "Color(h=%d, s=%d, v=%d)" % (self.h, self.s, self.v)


Color.BLACK = Color(0, 0, 10, "BLACK")
Color.GRAY = Color(0, 0, 50, "GRAY")
Color.WHITE = Color(0, 0, 100, "WHITE")
Color.RED = Color(0, 100, 100, "RED")
Color.ORANGE = Color(30, 100, 100, "ORANGE")
Color.BROWN = Color(30, 100, 50, "BROWN")
Color.YELLOW = Color(60, 100, 100, "YELLOW")
Color.GREEN = Color(120, 100, 100, "GREEN")
Color.CYAN = Color(180, 100, 100, "CYAN")
Color.BLUE = Color(240, 100, 100, "BLUE")
Color.VIOLET = Color(270, 100, 100, "VIOLET")
Color.MAGENTA = Color(300, 100, 100, "MAGENTA")
Color.NONE = Color(0, 0, 0, "NONE")

_COLOR_BY_NAME = {
    "black": Color.BLACK, "gray": Color.GRAY, "white": Color.WHITE, "red": Color.RED, "orange": Color.ORANGE,
    "brown": Color.BROWN, "yellow": Color.YELLOW, "green": Color.GREEN, "azure": Color.CYAN, "blue": Color.BLUE,
    "violet": Color.VIOLET, "magenta": Color.MAGENTA, "none": Color.NONE,
}


class Button:
    LEFT = "LEFT"
    RIGHT = "RIGHT"
    CENTER = "CENTER"
    BLUETOOTH = "BLUETOOTH"


class Side:
    TOP = "TOP"
    BOTTOM = "BOTTOM"
    FRONT = "FRONT"
    BACK = "BACK"
    LEFT = "LEFT"
    RIGHT = "RIGHT"


class Axis:
    X = (1, 0, 0)
    Y = (0, 1, 0)
    Z = (0, 0, 1)


class Icon:
    HAPPY = "☺"
    SAD = "☹"
    HEART = "♥"
    UP = "↑"
    DOWN = "↓"
    LEFT = "←"
    RIGHT = "→"
