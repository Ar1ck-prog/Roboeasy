// Ready-made mission runs for the default "Робот-база FLL" (Pybricks style).
// Every run starts from the default pose of its home (button «🏠 На старт») and returns to it.

const HEADER = `from pybricks.pupdevices import Motor
from pybricks.parameters import Port, Direction, Stop
from pybricks.robotics import DriveBase
from pybricks.tools import wait

robot = DriveBase(Motor(Port.A, Direction.COUNTERCLOCKWISE), Motor(Port.B), 56, 136)
arm = Motor(Port.C, Direction.COUNTERCLOCKWISE)      # + = поднять руку с крюком
robot.settings(straight_speed=400, straight_acceleration=900, turn_rate=180, turn_acceleration=900)
robot.use_gyro(True)
`;

export const RUNS = [
  {
    id: 'run-m01',
    side: 'left',
    name: 'Выезд 1 (левая база): M01 Дрон',
    code: `# Выезд 1 — M01 «Разведка дроном» (до 30 очков)
# Старт: левая база, «🏠 На старт». Едем на восток в коридоре между лежащим дроном и LiDAR-картой,
# толкаем красную пусковую лопатку — дрон взлетает, а через секунду переворачивается карта.
${HEADER}
robot.straight(-19)          # встаём на линию коридора
robot.turn(90)               # лицом на восток
robot.straight(862)          # упираемся в лопатку и толкаем её ~3 см
robot.straight(-200)         # сразу отъезжаем: карта упадёт как раз сюда
robot.straight(-662)         # обратно на базу
robot.turn(-90)
robot.straight(19)
`,
  },
  {
    id: 'run-m02',
    side: 'left',
    name: 'Выезд 2 (левая база): M02 Взрывные семена',
    code: `# Выезд 2 — M02 «Взрывные семена» (30 очков)
# Старт: левая база, «🏠 На старт». Подъезжаем к стручку с юга, поднимаем крюк и толкаем
# спусковую лопатку. Через ~0.7 с стручок переворачивается и разбрасывает семена — успеваем отъехать.
${HEADER}
robot.turn(90)               # лицом на восток
robot.straight(362)          # вдоль стартовой линии до стручка
robot.turn(-90)              # лицом на север
arm.run_target(400, 50)      # крюк на высоту лопатки
robot.straight(257)          # толкаем лопатку
robot.straight(-150)         # быстро назад — стручок падает в нашу сторону
wait(1500)
robot.straight(-107)
arm.run_target(400, 0)
robot.turn(-90)              # лицом на запад
robot.straight(362)
robot.turn(90)
`,
  },
  {
    id: 'run-nw',
    side: 'left',
    name: 'Выезд 3 (левая → правая база): M03 Камень, M05 Корни, M09 Платформа, M08 Лиана',
    code: `# Выезд 3 — северо-запад: M03 «Переверни камень» (20), M05 «Тянущиеся корни» (20),
# M09 платформа и фотоловушка (20), M08 «Запутанная лиана» (30).
# Старт: левая база, «🏠 На старт». Финиш: ПРАВАЯ база.
# Едем на север вдоль левого края, потом работаем из «коридора» перед большим деревом.
${HEADER}
def push(distance, speed=150):
    # толкаем модель и возвращаемся точно в точку начала толчка (по энкодерам колёс)
    start = robot.distance()
    robot.settings(straight_speed=speed)
    robot.straight(distance)
    robot.settings(straight_speed=400)
    robot.straight(start - robot.distance())

robot.straight(409)          # на север, к камню M03
robot.turn(-90)              # на запад
arm.run_target(400, 100)     # крюк на высоту верха камня
robot.settings(straight_speed=200)
robot.straight(85)           # толкаем южную часть камня — он переворачивается, флаг падает на восток
robot.settings(straight_speed=400)
robot.straight(-117)         # отъезжаем на 3 см восточнее: дальше на север едем мимо упавшего флага
robot.turn(90)               # на север, к корням M05
robot.straight(313)
robot.turn(90)
robot.straight(100)
robot.turn(-90)
arm.run_target(500, 90)      # крюк на высоту корня
push(130, 200)               # корень перекидывается назад
robot.straight(-69)          # в «коридор» перед деревом
arm.run_target(500, 40)
robot.turn(90)
robot.straight(128)
robot.turn(-90)
push(80)                     # рычаг платформы — платформа поднимается
robot.turn(90)
robot.straight(136)
robot.turn(-90)
push(95)                     # фотоловушка откидывается вверх и фиксируется
robot.turn(-90)
arm.run_target(300, 56)      # крюк выше кольца лианы
robot.straight(62)
robot.turn(90)
robot.settings(straight_speed=200)
robot.straight(136)          # крюк точно над кольцом
arm.run_target(200, 37)      # опускаем крюк в кольцо
robot.settings(straight_speed=100)
robot.straight(-15)          # цепляем кольцо
arm.run_target(40, 62, wait=False)  # тянем и одновременно поднимаем крюк
robot.straight(-65)          # лиана соскакивает с дерева и падает на мат
robot.settings(straight_speed=400)
robot.straight(-31)
arm.run_target(300, 0)       # кольцо соскальзывает с крюка
robot.turn(90)               # на восток: переезд вдоль северной части поля, подальше от семян M02
robot.straight(1157)
robot.turn(90)               # на юг
robot.straight(651)          # финиш в ПРАВОЙ базе
`,
  },
  {
    id: 'run-m11-m15',
    side: 'right',
    name: 'Выезд 4 (правая база): M11 Окно в прошлое, M15 Архитектура',
    code: `# Выезд 4 — M11 «Окно в прошлое» (20) и M15 «Биоцентричная архитектура» в доке «Город» (40).
# Старт: правая база, «🏠 На старт». Сначала крюком давим рычаг M11, потом разворачиваемся
# к зданию: задвигаем световой люк, качаем рычаг навеса и последней жмём кнопку люка компоста.
${HEADER}
def push(distance, speed=150):
    # толкаем модель и возвращаемся точно в точку начала толчка (по энкодерам колёс)
    start = robot.distance()
    robot.settings(straight_speed=speed)
    robot.straight(distance)
    robot.settings(straight_speed=400)
    robot.straight(start - robot.distance())

robot.straight(210)          # на север, в коридор
robot.turn(-90)              # на запад
robot.straight(502)          # к «Окну в прошлое»
robot.turn(90)               # на север
arm.run_target(400, 30)      # крюк на высоту рычага
push(80)                     # рычаг M11 — крышка корней падает на мат
robot.straight(-111)         # к зданию M15
arm.run_target(400, 95)      # крюк на высоту крыши
robot.turn(180)              # лицом на юг, к зданию
push(85)                     # задвигаем световой люк
arm.run_target(400, 30)
robot.turn(-90)
robot.straight(81)
robot.turn(90)
push(40)                     # рычаг навеса — навес поднимается
arm.run_target(400, 50)
robot.turn(90)
robot.straight(102)
robot.turn(-90)
push(52)                     # кнопка — люк компоста откидывается на мат
arm.run_target(400, 0)
robot.turn(-90)              # на восток
robot.straight(462)
robot.turn(90)               # на юг
robot.straight(124)          # в правую базу
`,
  },
  {
    id: 'run-m12-m07-m06',
    side: 'right',
    name: 'Выезд 5 (правая база): M12 Трость, M07 Гриб, M06 Муравьи',
    code: `# Выезд 5 — M12 «Лесной старейшина»: трость (20), M07 «Огромный гриб» (20),
# M06 «Муравьи-листорезы» (40). Старт: правая база, «🏠 На старт».
# Передней гранью мотора руки поднимаем трость до дерева, потом одним толчком крюк опрокидывает
# мицелий, а левое колесо медленно задвигает рейку с муравьём в гнездо.
${HEADER}
def push(distance, speed=150):
    # толкаем модель и возвращаемся точно в точку начала толчка (по энкодерам колёс)
    start = robot.distance()
    robot.settings(straight_speed=speed)
    robot.straight(distance)
    robot.settings(straight_speed=400)
    robot.straight(start - robot.distance())

robot.turn(-90)              # на запад
robot.straight(50)
robot.turn(90)               # на север, вдоль края поля
robot.straight(571)          # на линию трости
robot.turn(90)               # на восток
arm.run_target(400, 110)     # рука вверх: толкаем гранью мотора — она шире крюка
robot.settings(straight_speed=200)
robot.straight(168)          # трость встаёт и ложится на дерево
robot.settings(straight_speed=400)
robot.straight(-172)
arm.run_target(400, 0)
robot.turn(-90)              # на север
robot.straight(112)
robot.turn(-90)              # на запад
robot.straight(153)
robot.turn(90)               # на север, к грибу и муравейнику
arm.run_target(400, 85)      # крюк на высоту ручки мицелия
push(140)                    # мицелий опрокидывается, колесо задвигает муравья
arm.run_target(400, 0)
robot.turn(90)               # на восток
robot.straight(144)
robot.turn(90)               # на юг
robot.straight(681)          # в правую базу
`,
  },
];
