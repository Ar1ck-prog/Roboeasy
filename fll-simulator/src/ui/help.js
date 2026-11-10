// Help page: how to use the simulator, robot API reference and a short rules summary.

export function renderHelp(el) {
  el.innerHTML = `
<h1>📘 Справка симулятора FLL BIOGLOW</h1>
<p>Симулятор воспроизводит поле <b>BIOGLOW Founders Edition</b> (сезон 2026/27): мат 202×114 см, бортики, две базы с зонами запуска,
15 миссий с работающими механизмами (физика Rapier), подсчёт очков по официальным формулам (Excel-калькулятор + обновление 01) и робота SPIKE Prime,
которого можно собрать из деталей и запрограммировать на Python.</p>

<h2>Как пользоваться</h2>
<ol>
  <li><b>🔧 Конструктор робота</b> — соберите робота из деталей SPIKE Prime или возьмите шаблон «Робот-база FLL». Детали соединяются штифтами и осями в отверстиях. Нажмите <b>«Применить на поле»</b>.</li>
  <li><b>🏁 Поле и код</b> — напишите программу (слева), поставьте робота в зону запуска (перетащите мышью, колесо мыши — поворот) и нажмите <b>▶ Запуск</b> (Ctrl+Enter).</li>
  <li><b>🏋 Тренировка / 🏁 Матч 2:30</b> — переключатель режима над полем. В режиме матча поле сбрасывается, проходит осмотр оборудования (робот целиком в одной зоне запуска и ниже 30,5 см = 20 очков), таймер 2:30 запускается кнопкой <b>⏱ Старт 2:30</b> или сам с первым запуском. Когда время выходит, справа вверху появляется итог: фолы, выполненные задания и баллы.</li>
  <li>Между запусками робот должен вернуться на базу. <b>✋ Прервать</b> — взять робота руками: если он (или то, что он везёт) вне базы — минус жетон точности, а подобранные вне базы модели отдаются судье.</li>
  <li><b>■ Стоп</b> — остановить программу на месте без штрафа (робот остаётся где стоит).</li>
  <li><b>🏠 На старт</b> — поставить робота в стартовую позицию базы, в которой он стоит (между выездами). В свободном режиме выбор «Левая/Правая база» сразу переносит робота.</li>
</ol>

<h2>Готовые выезды на 380 очков</h2>
<p>В меню <b>«Примеры…» → «Готовые выезды»</b> есть 5 программ для «Робота-базы FLL», а пункт <b>«⚡ Загрузить все выезды сразу»</b> добавит их по одной на вкладку.
Перед каждым выездом нажимайте <b>🏠 На старт</b>.</p>
<table>
<tr><th>Выезд</th><th>База</th><th>Миссии</th><th>Очки</th></tr>
<tr><td>1</td><td>левая</td><td>M01 — дрон взлетает, LiDAR-карта переворачивается</td><td>30</td></tr>
<tr><td>2</td><td>левая</td><td>M02 — стручок разбрасывает семена</td><td>30</td></tr>
<tr><td>3</td><td>левая → правая</td><td>M03 камень, M05 корни, M09 платформа и фотоловушка, M08 лиана; финиш в правой базе</td><td>90</td></tr>
<tr><td>4</td><td>правая</td><td>M11 крышка корней; M15 навес, люк-окно и люк компоста (док «Город»)</td><td>60</td></tr>
<tr><td>5</td><td>правая</td><td>M12 трость, M07 мицелий, M06 муравей и 4 листка</td><td>80</td></tr>
</table>
<p>Вместе с осмотром (20), жетонами точности (50) и нетронутыми домиками M10 (20) получается <b>380 очков</b>. Сами выезды занимают около 1:30 из 2:30 — остаётся время на перестановку робота.
Программы рассчитаны на стандартную расстановку доков (M15 в доке «Город»).</p>
<p>Чего нет в готовых выездах и почему. Для этих миссий одного крюка мало — нужна своя насадка, соберите её в конструкторе:</p>
<ul>
  <li><b>M04</b> — крюку доступен только юго-восточный лист (два других закрыты гнездом и бортом), его маленькую петлю крюк не держит, а кузнечик стоит в случайном месте;</li>
  <li><b>M13</b> — ключевой вид надо привезти через всё поле и поставить на платформу по крутому пандусу; крюком робот его тащит, но не может надёжно завезти на пандус и отпустить;</li>
  <li><b>M14</b> — семена M02 разлетаются случайно, их нужно собрать ковшом;</li>
  <li><b>семя M09</b> лежит на полочке вплотную к стволу и при толчке падает на подставку дерева, <b>стяжка M12</b> — кольцо, которое надо снять с крючка и надеть на столбик, а <b>бонус M03</b> требует вернуть свободно крутящийся камень точно назад.</li>
</ul>
<h3>Ручное управление (тест механики)</h3>
<p>Щёлкните по полю: <code>W A S D</code> / стрелки — ехать, <code>R</code>/<code>F</code> — мотор C (рука) вверх/вниз, <code>T</code>/<code>G</code> — мотор D, <code>Shift</code> — медленно.
Колёса — моторы A (левый) и B (правый).</p>

<h2>Робот по умолчанию «Робот-база FLL»</h2>
<table>
<tr><th>Порт</th><th>Устройство</th><th>Заметки</th></tr>
<tr><td>A</td><td>Средний мотор — левое колесо</td><td>зеркальный: в Pybricks <code>Direction.COUNTERCLOCKWISE</code></td></tr>
<tr><td>B</td><td>Средний мотор — правое колесо</td><td>колёса Ø56 мм, колея 136 мм</td></tr>
<tr><td>C</td><td>Средний мотор — рука с крюком спереди</td><td>с <code>COUNTERCLOCKWISE</code>: + = поднять</td></tr>
<tr><td>E, F</td><td>Датчики цвета (левый, правый)</td><td>смотрят вниз, 4 мм над матом</td></tr>
</table>

<h2>Python: стиль Pybricks</h2>
<pre>from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor, ForceSensor
from pybricks.parameters import Port, Direction, Stop, Color
from pybricks.robotics import DriveBase
from pybricks.tools import wait, StopWatch

hub = PrimeHub()
robot = DriveBase(Motor(Port.A, Direction.COUNTERCLOCKWISE), Motor(Port.B), 56, 136)
robot.settings(straight_speed=300, straight_acceleration=750, turn_rate=180, turn_acceleration=720)
robot.use_gyro(True)        # держать курс по гироскопу
robot.straight(500)         # мм (минус — назад)
robot.turn(90)              # градусы, + по часовой
robot.curve(200, 90)        # дуга радиусом 200 мм на 90°
robot.drive(200, 30)        # ехать непрерывно: мм/с, °/с
robot.stop() / robot.brake()
robot.distance(), robot.angle(), robot.reset()
hub.imu.heading(), hub.imu.reset_heading(0)
hub.display.text("Hi"), hub.speaker.beep()</pre>
<table>
<tr><th>Motor</th><td><code>run(speed)</code>, <code>run_angle(speed, angle, then=Stop.HOLD, wait=True)</code>, <code>run_target(speed, target)</code>, <code>run_time(speed, ms)</code>,
<code>run_until_stalled(speed)</code>, <code>angle()</code>, <code>reset_angle(0)</code>, <code>speed()</code>, <code>stop()</code>, <code>brake()</code>, <code>hold()</code>, <code>dc(duty)</code>, <code>stalled()</code></td></tr>
<tr><th>ColorSensor</th><td><code>color()</code> → <code>Color.BLACK/WHITE/GREEN/…</code>, <code>reflection()</code> 0–100 %, <code>hsv()</code>, <code>ambient()</code></td></tr>
<tr><th>UltrasonicSensor</th><td><code>distance()</code> мм (2000 если ничего нет)</td></tr>
<tr><th>ForceSensor</th><td><code>force()</code> Н, <code>pressed(force=3)</code>, <code>touched()</code></td></tr>
</table>

<h2>Python: официальный SPIKE 3 (LEGO Education SPIKE App)</h2>
<pre>from hub import port, motion_sensor, light_matrix, sound
import motor, motor_pair, color_sensor, distance_sensor, force_sensor, color, runloop

async def main():
    motor_pair.pair(motor_pair.PAIR_1, port.A, port.B)
    await motor_pair.move_for_degrees(motor_pair.PAIR_1, 720, 0, velocity=500)
    await motor_pair.move_tank_for_degrees(motor_pair.PAIR_1, 300, 300, -300)
    await motor.run_for_degrees(port.C, 90, -400)
    if color_sensor.color(port.E) == color.BLACK: ...
    print(motion_sensor.tilt_angles()[0])   # yaw в десятых долях градуса (+ против часовой)
    await runloop.sleep_ms(500)

runloop.run(main())</pre>
<p><b>motor_pair</b>: <code>move</code>, <code>move_for_degrees</code>, <code>move_for_time</code>, <code>move_tank</code>, <code>move_tank_for_degrees</code>, <code>move_tank_for_time</code>, <code>stop</code>.
<b>motor</b>: <code>run</code>, <code>run_for_degrees</code>, <code>run_for_time</code>, <code>run_to_relative_position</code>, <code>run_to_absolute_position</code>, <code>stop</code>, <code>relative_position</code>, <code>reset_relative_position</code>, <code>velocity</code>.
Без <code>await</code> команда стартует и программа идёт дальше (как на настоящем хабе).</p>
<p>Каждое чтение датчика занимает немного «времени хаба», поэтому цикл <code>while</code> без <code>wait()</code> не замораживает симуляцию.
Совсем бесконечный цикл без обращений к роботу можно остановить кнопкой ■ Стоп.</p>

<h2>Миссии и очки (кратко)</h2>
<table>
<tr><th>№</th><th>Миссия</th><th>Очки</th></tr>
<tr><td>—</td><td>Осмотр: всё оборудование в одной зоне запуска, высота ≤ 30,5 см</td><td>20</td></tr>
<tr><td>01</td><td>Разведка дроном: дрон не касается мата 20; + LiDAR-карта перевёрнута в зоне съёмки 10 🚫🧱</td><td>30</td></tr>
<tr><td>02</td><td>Взрывающиеся семена: 10 за каждое семя, не касающееся стебля (спусковой рычаг)</td><td>30</td></tr>
<tr><td>03</td><td>Переверни камень: флаг опущен 20; + камень возвращён 10</td><td>30</td></tr>
<tr><td>04</td><td>Счастливые листья: 1 лист 10; + 2-й лист и кузнечик на месте весь матч 20 (кузнечик случайный!) 🚫🧱</td><td>30</td></tr>
<tr><td>05</td><td>Тянущиеся корни: частично 10 / полностью 20 🚫🧱</td><td>20</td></tr>
<tr><td>06</td><td>Муравьи: муравей касается гнезда → 10 за каждый листок в гнезде (быстро толкать — листки падают!)</td><td>40</td></tr>
<tr><td>07</td><td>Огромный гриб: мицелий выдвинут 20; +10 за соединение с корнем соперника (до 2) 🚫🧱</td><td>40</td></tr>
<tr><td>08</td><td>Лиана касается мата</td><td>30</td></tr>
<tr><td>09</td><td>Платформа поднята 10, фотоловушка 10, семя упало с дерева 10 🚫🧱</td><td>30</td></tr>
<tr><td>10</td><td>Домики паука и улитки не сдвинуты (по 10) 🚫🧱</td><td>20</td></tr>
<tr><td>11</td><td>Крышка корней опущена на мат (рычаг-защёлка слева)</td><td>20</td></tr>
<tr><td>12</td><td>Трость поднята к дереву 20; стяжка (кольцо) на столбике 10 🚫🧱</td><td>30</td></tr>
<tr><td>13</td><td>Ключевой вид (из базы) на платформе + деревца подняты</td><td>30</td></tr>
<tr><td>14</td><td>Семена (из M02 и M09) в станции 5 + касаются мата 5 (каждое)</td><td>40</td></tr>
<tr><td>15</td><td>Навес 10, люк-окно 10, люк компоста 10 + экобонус дока 10 (Шахта→навес, Город→окно, Ферма→компост) 🚫🧱</td><td>40</td></tr>
<tr><td>★</td><td>Жетоны точности: 6→50, 5→50, 4→35, 3→25, 2→15, 1→10</td><td>50</td></tr>
</table>
<p>🚫🧱 — «ограничение без оборудования»: модель не приносит очков, если в конце матча касается робота/оборудования. Максимум — <b>530</b> очков.</p>
<p>Источники: Robot Game Rulebook, Challenge Updates (2 сентября 2026), официальный Excel-калькулятор и протокол из папки <code>Manual/</code>.</p>
`;
}
