// Example robot programs for the default "Робот-база FLL" (ports: A left wheel, B right wheel,
// C arm, E/F colour sensors; wheels 56 mm, axle track 136 mm).

export const EXAMPLES = [
  {
    id: 'pb-basic',
    name: 'Pybricks: езда и поворот',
    code: `# Pybricks-стиль (как на настоящем SPIKE Prime с прошивкой Pybricks)
from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction, Stop
from pybricks.robotics import DriveBase
from pybricks.tools import wait

hub = PrimeHub()
left = Motor(Port.A, Direction.COUNTERCLOCKWISE)   # левый мотор зеркальный
right = Motor(Port.B)
arm = Motor(Port.C, Direction.COUNTERCLOCKWISE)    # + = поднять руку

robot = DriveBase(left, right, wheel_diameter=56, axle_track=136)
robot.settings(straight_speed=300, turn_rate=150)
robot.use_gyro(True)

hub.display.text("GO")
robot.straight(300)      # мм вперёд (на север)
robot.turn(90)           # градусов по часовой (теперь смотрим на восток)
arm.run_angle(400, 60)   # поднять руку на 60°
robot.straight(150)
arm.run_angle(400, -60)  # опустить руку
print("Курс:", hub.imu.heading(), "Путь:", robot.distance(), "мм")
`,
  },
  {
    id: 'spike3-basic',
    name: 'SPIKE 3: motor_pair + runloop',
    code: `# Официальный Python из приложения LEGO Education SPIKE (SPIKE 3)
from hub import port, motion_sensor, light_matrix
import motor, motor_pair, runloop

async def main():
    motion_sensor.reset_yaw(0)
    motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)   # левый, правый

    light_matrix.write("Hi")
    # 360° колеса = 17.6 см (колесо 56 мм)
    await motor_pair.move_for_degrees(motor_pair.PAIR_1, 720, 0, velocity=500)
    # разворот на месте: steering = 100
    await motor_pair.move_for_degrees(motor_pair.PAIR_1, 280, 100, velocity=300)
    # рука на порту C: -90° = вверх (по часовой = вниз)
    await motor.run_for_degrees(port.C, 90, -400)
    await runloop.sleep_ms(300)
    await motor.run_for_degrees(port.C, 90, 400)
    print("yaw =", motion_sensor.tilt_angles()[0] / 10, "°")

runloop.run(main())
`,
  },
  {
    id: 'pb-line',
    name: 'Pybricks: езда по линии',
    code: `# Езда по чёрной линии одним датчиком цвета (пропорциональный регулятор).
# Поставьте робота так, чтобы левый датчик (порт E) был у края чёрной линии.
from pybricks.pupdevices import Motor, ColorSensor
from pybricks.parameters import Port, Direction
from pybricks.robotics import DriveBase
from pybricks.tools import wait, StopWatch

left = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right = Motor(Port.B)
sensor = ColorSensor(Port.E)
robot = DriveBase(left, right, 56, 136)

TARGET = 50          # середина между чёрным и белым
KP = 1.6
timer = StopWatch()
while timer.time() < 6000:
    error = sensor.reflection() - TARGET
    robot.drive(120, KP * error)
    wait(10)
robot.stop()
print("Готово, отражение:", sensor.reflection())
`,
  },
  {
    id: 'pb-sensors',
    name: 'Pybricks: показания датчиков',
    code: `# Едем вперёд и печатаем цвет под датчиками
from pybricks.pupdevices import Motor, ColorSensor
from pybricks.parameters import Port, Direction, Color
from pybricks.robotics import DriveBase
from pybricks.tools import wait

robot = DriveBase(Motor(Port.A, Direction.COUNTERCLOCKWISE), Motor(Port.B), 56, 136)
le, ri = ColorSensor(Port.E), ColorSensor(Port.F)

robot.drive(150, 0)
for i in range(15):
    print(i, "L:", le.color(), le.reflection(), "%   R:", ri.color(), ri.reflection(), "%")
    if le.color() == Color.BLACK or ri.color() == Color.BLACK:
        print("Нашли чёрную линию!")
        break
    wait(200)
robot.stop()
`,
  },
  {
    id: 'pb-mission',
    name: 'Миссия M11 «Окно в прошлое»',
    code: `# Пример выезда: из левой базы к M11 «Окно в прошлое».
# Крюк руки толкает рычаг-защёлку слева от модели -> крышка корней падает на мат (+20).
# Старт: левая зона запуска (позиция по умолчанию), робот смотрит на север.
# Коридор между M02 и LiDAR-картой узкий (~18 см), поэтому едем с гироскопом.
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction
from pybricks.robotics import DriveBase

robot = DriveBase(Motor(Port.A, Direction.COUNTERCLOCKWISE), Motor(Port.B), 56, 136)
robot.settings(straight_speed=350, turn_rate=160)
robot.use_gyro(True)

robot.straight(230)           # на север, в коридор
robot.turn(90)                # на восток
robot.straight(1050)
robot.turn(-90)               # на север: рычаг M11 прямо перед крюком
robot.settings(straight_speed=150)
robot.straight(110)           # толкаем рычаг
robot.straight(-100)
print("Готово! M11 должна дать 20 очков (протокол справа)")
`,
  },
  {
    id: 'cooper-start',
    name: 'Cooper 2.0: старт (SPIKE 3, порты B/F, насадки D/C)',
    code: `# Старт для шаблона «Cooper 2.0 — Platinum Pizzeria» (Конструктор робота → Шаблон…)
# Колёса 62,4 мм: B — левое, F — правое. Насадки: D — левая, C — правая. Датчик цвета: A.
from hub import port, motion_sensor
import motor, motor_pair, runloop, math

WHEEL_CM = 6.24
LEFT, RIGHT = port.B, port.F
ATT_LEFT, ATT_RIGHT = port.D, port.C
motor_pair.pair(motor_pair.PAIR_1, LEFT, RIGHT)

def yaw():
    # motion_sensor отдаёт десятые доли градуса; по часовой стрелке yaw уменьшается
    return -motion_sensor.tilt_angles()[0] / 10

async def drive(cm, speed=500):
    """Прямо на cm сантиметров (минус — назад), курс держим по гироскопу."""
    target = abs(cm) / (math.pi * WHEEL_CM) * 360
    heading = yaw()
    motor.reset_relative_position(LEFT, 0)
    sign = 1 if cm > 0 else -1
    while abs(motor.relative_position(LEFT)) < target:
        left_deg = target - abs(motor.relative_position(LEFT))
        v = speed if left_deg > 90 else 150            # последние ~5 см медленно — точная остановка
        steer = int((heading - yaw()) * 3) * sign
        motor_pair.move(motor_pair.PAIR_1, max(-100, min(100, steer)), velocity=v * sign)
        await runloop.sleep_ms(10)
    motor_pair.stop(motor_pair.PAIR_1)

async def turn(deg, speed=200):
    """Разворот на месте: плюс — направо (по часовой), минус — налево."""
    goal = yaw() + deg
    s = 1 if deg > 0 else -1
    motor_pair.move_tank(motor_pair.PAIR_1, speed * s, -speed * s)
    await runloop.until(lambda: (yaw() - goal) * s >= 0)
    motor_pair.stop(motor_pair.PAIR_1)

async def main():
    motion_sensor.reset_yaw(0)
    await drive(30)                                  # 30 см вперёд
    await turn(90)                                   # направо
    await motor.run_for_degrees(ATT_RIGHT, 180, 600) # правая насадка (C)
    await motor.run_for_degrees(ATT_LEFT, -180, 600) # левая насадка (D)
    await turn(-90)
    await drive(-20)                                 # 20 см назад
    print("курс", round(yaw()), "°")

runloop.run(main())
`,
  },
  {
    id: 'frontgear-start',
    name: 'Робот с насадкой спереди: старт (Pybricks, A/B, насадка C)',
    code: `# Старт для шаблона «Робот с насадкой спереди» (Конструктор робота → Шаблон…)
# Колёса 56 мм: A — левое (зеркальное), B — правое. Насадка с шестерёнкой 20z: C.
from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction
from pybricks.robotics import DriveBase

hub = PrimeHub()
left = Motor(Port.A, Direction.COUNTERCLOCKWISE)
right = Motor(Port.B)
gear = Motor(Port.C)

robot = DriveBase(left, right, wheel_diameter=56, axle_track=136)
robot.settings(straight_speed=300, turn_rate=150)
robot.use_gyro(True)

robot.straight(250)        # 25 см вперёд
robot.turn(-90)            # налево
gear.run_angle(500, 360)   # один оборот шестерёнки насадки
robot.straight(150)
robot.turn(90)
print("Курс:", hub.imu.heading(), "Путь:", robot.distance(), "мм")
`,
  },
];

export const DEFAULT_PROGRAM = EXAMPLES[0].code;
