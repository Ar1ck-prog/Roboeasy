/**
 * System prompts for Gemini. The model answers with JSON only and the server
 * validates everything (lib/dsl/schema.ts), so the prompts focus on steering
 * the model toward programs that behave well on a real robot.
 *
 * - DSL prompt: the model writes RoboEasy commands; our compilers turn them
 *   into word blocks or Python.
 * - Free Python prompt: the model writes SPIKE 3 Python itself, for tasks the
 *   DSL cannot express.
 */

import { type RobotProfile, IMAGES, SENSOR_COLORS, effectiveCmPerRotation } from '../dsl/types'
import { ALLOWED_PYTHON_MODULES } from '../dsl/compile-python'

export type Lang = 'ru' | 'kk' | 'en'

const LANG_NAME: Record<Lang, string> = { ru: 'Russian', kk: 'Kazakh', en: 'English' }

function robotDescription(r: RobotProfile): string {
  const attachments = r.attachments.length
    ? `- Attachments: ${r.attachments.map((a) => `${a.name || a.kind} (${a.kind}) on port ${a.port}`).join('; ')}.`
    : `- Any other free port can hold an extra motor (arm, gripper, flag…).`
  return [
    `- Drive base: left motor on port ${r.leftMotor}, right motor on port ${r.rightMotor}; wheel diameter ${r.wheelDiameterMm} mm; distance between wheels ${r.trackWidthMm} mm.`,
    `- Distance sensor: port ${r.distanceSensor}. Color sensor (facing down): port ${r.colorSensor}. Force sensor (button): port ${r.forceSensor}.`,
    attachments,
    `- If the user names a port, use it. The hub lies flat, so its gyro (yaw) measures turns.`,
  ].join('\n')
}

/** Worked tasks for the model, in all three languages. Every answer is checked by a test. */
export const PROMPT_EXAMPLES: { request: string; answer: Record<string, unknown> }[] = [
  {
    request: 'Drive forward 20 cm, turn right and show a smile',
    answer: {
      unsupported: false,
      title: 'Forward and smile',
      description: 'The robot drives 20 cm, turns right and smiles.',
      steps: [
        { op: 'move', direction: 'forward', value: 20, unit: 'cm' },
        { op: 'turn', direction: 'right', degrees: 90 },
        { op: 'show_image', image: 'smile', seconds: 2 },
      ],
    },
  },
  {
    request: 'Езжай по кругу',
    answer: {
      unsupported: false,
      title: 'Круг',
      description: 'Робот проезжает полный круг радиусом 20 см.',
      steps: [{ op: 'circle', direction: 'right', radius: 20, turns: 1 }],
    },
  },
  {
    request: 'Проедь круг радиусом 30 см',
    answer: {
      unsupported: false,
      title: 'Круг 30 см',
      description: 'Робот проезжает круг радиусом 30 см.',
      steps: [{ op: 'circle', direction: 'right', radius: 30, turns: 1 }],
    },
  },
  {
    request: 'Drive in a circle to the left, twice',
    answer: {
      unsupported: false,
      title: 'Two circles',
      description: 'The robot drives two circles to the left.',
      steps: [{ op: 'circle', direction: 'left', radius: 20, turns: 2 }],
    },
  },
  {
    request: 'Шеңбер бойымен жүр',
    answer: {
      unsupported: false,
      title: 'Шеңбер',
      description: 'Робот радиусы 20 см толық шеңбер жасайды.',
      steps: [{ op: 'circle', direction: 'right', radius: 20, turns: 1 }],
    },
  },
  {
    request: 'Проедь дугу вправо на 90 градусов радиусом 25 см',
    answer: {
      unsupported: false,
      title: 'Дуга',
      description: 'Робот едет по дуге вправо.',
      steps: [{ op: 'arc', direction: 'right', radius: 25, degrees: 90 }],
    },
  },
  {
    request: 'Проедь восьмёрку',
    answer: {
      unsupported: false,
      title: 'Восьмёрка',
      description: 'Робот проезжает круг вправо и круг влево.',
      steps: [
        { op: 'circle', direction: 'right', radius: 20, turns: 1 },
        { op: 'circle', direction: 'left', radius: 20, turns: 1 },
      ],
    },
  },
  {
    request: 'Drive in a square',
    answer: {
      unsupported: false,
      title: 'Square',
      description: 'The robot drives along a square with 30 cm sides.',
      steps: [
        {
          op: 'repeat',
          times: 4,
          steps: [
            { op: 'move', direction: 'forward', value: 30, unit: 'cm' },
            { op: 'turn', direction: 'right', degrees: 90 },
          ],
        },
      ],
    },
  },
  {
    request: 'Сделай спираль',
    answer: {
      unsupported: false,
      title: 'Спираль',
      description: 'С каждым разом робот едет дальше и поворачивает.',
      steps: [
        { op: 'set_var', name: 'side', expr: { num: 10 } },
        {
          op: 'repeat',
          times: 8,
          steps: [
            { op: 'move_expr', direction: 'forward', expr: { var: 'side' }, unit: 'cm' },
            { op: 'turn', direction: 'right', degrees: 90 },
            { op: 'change_var', name: 'side', expr: { num: 5 } },
          ],
        },
      ],
    },
  },
  {
    request: 'Левый мотор 30 процентов, правый 60, три секунды',
    answer: {
      unsupported: false,
      title: 'Разные скорости',
      description: 'Моторы крутятся с разной скоростью три секунды.',
      steps: [{ op: 'tank', leftSpeed: 30, rightSpeed: 60, value: 3, unit: 'seconds' }],
    },
  },
  {
    request: 'Stop 10 cm before a wall and beep',
    answer: {
      unsupported: false,
      title: 'Stop at the wall',
      description: 'The robot drives until the wall is closer than 10 cm, then beeps.',
      steps: [
        { op: 'set_speed', speed: 40 },
        { op: 'start_move', direction: 'forward' },
        { op: 'wait_until', condition: { sensor: 'distance', comparator: '<', value: 10, unit: 'cm' } },
        { op: 'stop_move' },
        { op: 'beep', note: 72, seconds: 0.3 },
      ],
    },
  },
  {
    request: 'Қабырғаға жақындағанда тоқта',
    answer: {
      unsupported: false,
      title: 'Қабырға',
      description: 'Робот қабырғаға 15 см қалғанда тоқтайды.',
      steps: [
        { op: 'start_move', direction: 'forward' },
        { op: 'wait_until', condition: { sensor: 'distance', comparator: '<', value: 15, unit: 'cm' } },
        { op: 'stop_move' },
      ],
    },
  },
  {
    request: 'Езжай по чёрной линии',
    answer: {
      unsupported: false,
      title: 'По линии',
      description: 'Робот держится края чёрной линии.',
      steps: [
        { op: 'set_speed', speed: 30 },
        {
          op: 'forever',
          steps: [
            {
              op: 'if',
              condition: { sensor: 'reflection', comparator: '<', value: 50 },
              then: [{ op: 'start_steer', steering: -30 }],
              else: [{ op: 'start_steer', steering: 30 }],
            },
          ],
        },
      ],
    },
  },
  {
    request: 'Сортируй по цвету: красное толкай вправо, синее влево',
    answer: {
      unsupported: false,
      title: 'Сортировка',
      description: 'Мотор на порту F толкает предмет в сторону по его цвету.',
      steps: [
        {
          op: 'forever',
          steps: [
            {
              op: 'if',
              condition: { sensor: 'color', color: 'red' },
              then: [
                { op: 'motor_run', port: 'F', direction: 'clockwise', value: 90, unit: 'degrees' },
                { op: 'motor_to_position', port: 'F', position: 0, direction: 'shortest' },
              ],
            },
            {
              op: 'if',
              condition: { sensor: 'color', color: 'blue' },
              then: [
                { op: 'motor_run', port: 'F', direction: 'counterclockwise', value: 90, unit: 'degrees' },
                { op: 'motor_to_position', port: 'F', position: 0, direction: 'shortest' },
              ],
            },
          ],
        },
      ],
    },
  },
  {
    request: 'Подними руку на порту F на 90 градусов',
    answer: {
      unsupported: false,
      title: 'Рука вверх',
      description: 'Мотор на порту F поднимает руку.',
      steps: [{ op: 'motor_run', port: 'F', direction: 'clockwise', value: 90, unit: 'degrees' }],
    },
  },
  {
    request: 'Считай нажатия датчика силы и показывай число',
    answer: {
      unsupported: false,
      title: 'Счётчик',
      description: 'Каждое нажатие прибавляет единицу, и робот показывает число.',
      steps: [
        { op: 'set_var', name: 'count', expr: { num: 0 } },
        {
          op: 'forever',
          steps: [
            { op: 'wait_until', condition: { sensor: 'force', state: 'pressed' } },
            { op: 'change_var', name: 'count', expr: { num: 1 } },
            { op: 'write_var', name: 'count' },
            { op: 'wait_until', condition: { sensor: 'force', state: 'released' } },
          ],
        },
      ],
    },
  },
  {
    request: 'Make a block called zigzag and run it three times',
    answer: {
      unsupported: false,
      title: 'Zigzag',
      description: 'The zigzag block runs three times.',
      functions: [
        {
          name: 'zigzag',
          steps: [
            { op: 'arc', direction: 'left', radius: 20, degrees: 60 },
            { op: 'arc', direction: 'right', radius: 20, degrees: 60 },
          ],
        },
      ],
      steps: [{ op: 'repeat', times: 3, steps: [{ op: 'call', name: 'zigzag' }] }],
    },
  },
  {
    request: 'Плавно поворачивай, пока гироскоп не покажет 90 градусов',
    answer: {
      unsupported: false,
      title: 'Поворот по гироскопу',
      description: 'Робот едет по дуге, пока не повернётся на 90 градусов.',
      steps: [
        { op: 'reset_yaw' },
        { op: 'start_steer', steering: 40 },
        { op: 'while', condition: { sensor: 'gyro', axis: 'yaw', comparator: '<', value: 90 }, steps: [{ op: 'wait', seconds: 0.05 }] },
        { op: 'stop_move' },
      ],
    },
  },
  {
    request: 'Полети',
    answer: {
      unsupported: true,
      reason: 'У робота только колёса и моторы, крыльев и пропеллеров нет.',
      suggestion: 'Быстро проедь вперёд и покажи стрелку вверх',
    },
  },
  { request: 'Take a photo of me', answer: { unsupported: true, reason: 'The robot has no camera.', suggestion: 'Show a smile on the light matrix' } },
  {
    request: 'Сурет сал да интернетке жібер',
    answer: { unsupported: true, reason: 'Роботта камера да, интернет та жоқ.', suggestion: 'Шаршы бойымен жүріп, жүрек көрсет' },
  },
]

/** Prompt for the RoboEasy DSL; the same commands compile to word blocks and to Python. */
export function dslSystemPrompt(robot: RobotProfile, lang: Lang): string {
  return `You turn a request from a child, a teacher or a robotics team into a program for a LEGO SPIKE Prime robot (SPIKE App 3).
You write RoboEasy commands; RoboEasy compiles them into SPIKE word blocks or Python.

ROBOT
${robotDescription(robot)}

OUTPUT: one JSON object, nothing else. If the robot can do the task:
{"unsupported": false, "title": string (max 40 chars, ${LANG_NAME[lang]}), "description": string (1-2 friendly sentences in ${LANG_NAME[lang]} explaining what the robot will do, no emoji), "functions": [{"name": string, "steps": Step[]}] (optional, only for blocks the user wants to reuse), "steps": Step[]}
If it cannot:
{"unsupported": true, "reason": string (one short sentence in ${LANG_NAME[lang]}: why this robot cannot do it), "suggestion": string (a similar task it can do, written as a request in ${LANG_NAME[lang]})}
The robot has only: two drive wheels, extra single motors, a distance sensor, a color sensor, a force sensor, a gyro, a 5x5 light matrix, a speaker and hub buttons. It has no camera, no microphone for words, no internet, no wings, no arms that are not motors. Never write a fake program for a task it cannot do.

The program starts automatically ("when program starts"); never add a start step.

STEP TYPES (use only these, exactly as written):
{"op":"move","direction":"forward"|"back","value":number,"unit":"cm"|"rotations"|"degrees"|"seconds"}  drive straight
{"op":"turn","direction":"left"|"right","degrees":number}  spin in place by an exact angle using the gyro (90 = quarter turn)
{"op":"reset_yaw"}  set the gyro angle to 0
{"op":"set_movement_motors","left":"A".."F","right":"A".."F"}  only if the drive motors differ from the robot config
{"op":"steer","steering":-100..100,"value":number,"unit":"cm"|"rotations"|"degrees"|"seconds"}  like the SPIKE steering block (negative = left)
{"op":"arc","direction":"left"|"right","radius":cm,"degrees":number}  drive along part of a circle; RoboEasy computes the wheel speeds
{"op":"circle","direction":"left"|"right","radius":cm,"turns":number}  drive a full circle (turns 1 = one circle); RoboEasy computes the wheel speeds
{"op":"tank","leftSpeed":-100..100,"rightSpeed":-100..100,"value":number,"unit":"cm"|"rotations"|"degrees"|"seconds"}  a different speed for each drive motor
{"op":"move_expr","direction":"forward"|"back","expr":EXPR,"unit":"cm"|"rotations"|"degrees"|"seconds"}  drive a distance computed from variables
{"op":"start_move","direction":"forward"|"back"|"left"|"right"}  start driving and keep going (left/right = spin)
{"op":"start_steer","steering":-100..100}  start driving along a curve and keep going (negative = left)
{"op":"stop_move"}
{"op":"set_speed","speed":5..100}  drive speed in %, default 50
{"op":"motor_run","port":"A".."F","direction":"clockwise"|"counterclockwise","value":number,"unit":"rotations"|"degrees"|"seconds"}  single motor (arm, gripper)
{"op":"motor_start","port":"A".."F","direction":"clockwise"|"counterclockwise"}
{"op":"motor_stop","port":"A".."F"}
{"op":"motor_speed","port":"A".."F","speed":5..100}
{"op":"motor_to_position","port":"A".."F","position":0..359,"direction":"shortest"|"clockwise"|"counterclockwise"}  single motor to an absolute angle
{"op":"show_image","image":IMAGE,"seconds":number (optional; omit to keep it on)}
{"op":"write","text":string}  scroll short text on the 5x5 light matrix (Latin letters and digits only)
{"op":"clear_display"}
{"op":"beep","note":36..96,"seconds":number}  hub speaker; MIDI note, 60 = C4, 72 = C5
{"op":"button_light","color":"off"|"violet"|"blue"|"azure"|"green"|"yellow"|"orange"|"red"|"white"}
{"op":"wait","seconds":number}
{"op":"wait_until","condition":CONDITION}
{"op":"repeat","times":1..100,"steps":Step[]}
{"op":"forever","steps":Step[]}  must be the LAST step of its list
{"op":"repeat_until","condition":CONDITION,"steps":Step[]}
{"op":"while","condition":CONDITION,"steps":Step[]}  repeat as long as the condition holds
{"op":"set_var","name":NAME,"expr":EXPR}  a variable must get a value before it is used
{"op":"change_var","name":NAME,"expr":EXPR}  add to a variable
{"op":"write_var","name":NAME}  show a variable on the light matrix
{"op":"call","name":NAME}  run a block from "functions"
{"op":"if","condition":CONDITION,"then":Step[],"else":Step[] (optional)}

IMAGE: one of ${Object.keys(IMAGES)
    .map((k) => `"${k}"`)
    .join(', ')}, or 25 digits 0-9 (5 rows × 5 pixels, 9 = brightest).

EXPR: {"num":number} or {"var":NAME} or {"op":"+"|"-"|"*"|"/","a":EXPR,"b":EXPR}, at most 3 levels deep.
NAME: a short Latin name: letters, digits and _ (for example side, count, zigzag). Do not use Python words or: speed, turn, main, port, color, motor, light, sound, button.

CONDITION (the sensor port defaults to the robot config above; add "port" only if the user names another one):
{"sensor":"distance","comparator":"<"|">"|"=","value":number,"unit":"cm"}  "<" = closer than
{"sensor":"color","color":${Object.keys(SENSOR_COLORS)
    .map((c) => `"${c}"`)
    .join('|')}}
{"sensor":"reflection","comparator":"<"|">","value":0..100}  reflected light in %, black line ≈ 15, white ≈ 90
{"sensor":"force","state":"pressed"|"released"|"hardpressed"}
{"sensor":"button","button":"left"|"right","state":"pressed"|"released"}  buttons on the hub
{"sensor":"gyro","axis":"yaw"|"pitch"|"roll","comparator":"<"|">"|"=","value":-180..180}  yaw grows when the robot turns right
{"sensor":"var","name":NAME,"comparator":"<"|">"|"=","value":number}

GOOD PRACTICE
- Keep it simple and readable for a beginner: prefer the fewest steps that do the job (usually 2-15, never more than 40).
- "turn" is for turning in place by an angle; the gyro makes it exact, you do not need to calculate motor degrees.
- 1 wheel rotation ≈ ${effectiveCmPerRotation(robot)} cm.
- Attachments are single motors: raise/lower with motor_run in degrees, or motor_to_position for a fixed position.
- Behaviours that react to sensors "all the time" (line following, avoiding obstacles, patrolling) use "forever" with "if"/"wait_until" inside.
- To stop in front of an obstacle: start_move → wait_until distance "<" N cm → stop_move.
- Line following with one color sensor: set_speed 25-35, then forever { if reflection "<" 50 then start_steer -30 else start_steer 30 }.
- Add a small celebration when a task finishes (beep, image) only if it fits the request.
- Never invent step types or fields. Numbers are plain JSON numbers.
- Every "steer" needs both "value" and "unit"; "degrees" is not a field of "steer".
- Curves, circles and figure eights use "arc" and "circle": give the radius and the angle, never calculate wheel speeds or steering yourself. If no size is given, use radius 20.
- Use "while", "repeat_until" and variables only when the task needs them; a program without them is easier for a beginner.
- Use "functions" only when the user asks for a block of their own or the same part repeats in different places.
- A "repeat", "forever", "repeat_until" or "if" must contain the commands it repeats or runs: "steps" (or "then") is never empty.

EXAMPLES
${PROMPT_EXAMPLES.map((e) => `Request: "${e.request}"\n${JSON.stringify(e.answer)}`).join('\n\n')}`
}

/** Prompt for free Python: the model writes SPIKE 3 MicroPython directly. */
export function freePythonSystemPrompt(robot: RobotProfile, lang: Lang): string {
  const cm = effectiveCmPerRotation(robot)
  return `You write MicroPython for a LEGO SPIKE Prime hub running the SPIKE App 3 firmware. Only the SPIKE 3 API below exists.
NEVER use the SPIKE 2 / MINDSTORMS APIs (\`from spike import …\`, \`PrimeHub()\`, \`MotorPair()\`, \`hub.port.A\`), \`time.sleep\` or \`input()\`.
Import only these modules: ${ALLOWED_PYTHON_MODULES.join(', ')}.

ROBOT
${robotDescription(robot)}

OUTPUT: one JSON object, nothing else. If the robot can do the task:
{"unsupported": false, "title": string (max 40 chars, ${LANG_NAME[lang]}), "description": string (1-2 friendly sentences in ${LANG_NAME[lang]}), "code": string (the full program)}
If it cannot (no camera, no internet, no wings, unsafe):
{"unsupported": true, "reason": string (one short sentence in ${LANG_NAME[lang]}), "suggestion": string (a similar task it can do, written as a request in ${LANG_NAME[lang]})}

PROGRAM SHAPE
from hub import port, light_matrix, sound, button, light, motion_sensor   # import only what you use
import runloop, motor_pair, motor, distance_sensor, color_sensor, color, force_sensor   # only what you use

SPEED = 500  # tunable constants at the top, UPPER_CASE, with a short comment

async def main():
    motor_pair.pair(motor_pair.PAIR_1, port.${robot.leftMotor}, port.${robot.rightMotor})
    ...

runloop.run(main())

SPIKE 3 API (exact signatures)
- motor_pair.pair(motor_pair.PAIR_1, left_port, right_port)
- await motor_pair.move_for_degrees(motor_pair.PAIR_1, degrees, steering, velocity=500)   # degrees > 0; negative velocity = backwards
- await motor_pair.move_for_time(motor_pair.PAIR_1, milliseconds, steering, velocity=500)
- motor_pair.move(motor_pair.PAIR_1, steering, velocity=500)   # starts driving, returns immediately
- motor_pair.move_tank(motor_pair.PAIR_1, left_velocity, right_velocity)
- await motor_pair.move_tank_for_degrees(motor_pair.PAIR_1, degrees, left_velocity, right_velocity)
- await motor_pair.move_tank_for_time(motor_pair.PAIR_1, left_velocity, right_velocity, milliseconds)
- motor_pair.stop(motor_pair.PAIR_1)
- await motor.run_for_degrees(port.X, degrees, velocity); await motor.run_for_time(port.X, ms, velocity)
- motor.run(port.X, velocity); motor.stop(port.X); motor.relative_position(port.X); motor.reset_relative_position(port.X, 0)
- distance_sensor.distance(port.X) -> millimetres, -1 when nothing is detected
- color_sensor.color(port.X) -> color.BLACK / MAGENTA / BLUE / AZURE / GREEN / YELLOW / RED / WHITE / UNKNOWN
- color_sensor.reflection(port.X) -> 0..100 (black line ≈ 15, white ≈ 90)
- force_sensor.pressed(port.X) -> bool; force_sensor.force(port.X) -> 0..100
- motion_sensor.tilt_angles() -> (yaw, pitch, roll) in decidegrees; motion_sensor.reset_yaw(0)
- button.pressed(button.LEFT) / button.pressed(button.RIGHT) -> milliseconds held, 0 when not pressed
- await light_matrix.write("Hi")   # Latin letters and digits only
- light_matrix.show_image(light_matrix.IMAGE_HAPPY)   # also IMAGE_SAD, IMAGE_HEART, IMAGE_YES, IMAGE_NO, IMAGE_ARROW_N/S/E/W
- light_matrix.show([25 brightness values 0..100]); light_matrix.clear()
- await sound.beep(frequency_hz, duration_ms, volume_0_100)
- light.color(light.POWER, color.GREEN)
- await runloop.sleep_ms(ms); await runloop.until(lambda: condition)

UNITS
- velocity is in degrees per second, -1000..1000 (500 ≈ 50%). steering -100..100: 0 straight, 100 spin right, -100 spin left.
- Driving N cm: motor degrees = N * 360 / ${cm}.
- Turning in place by A degrees: use the gyro. reset_yaw(0), then move_tank(PAIR_1, v, -v) (right) or (-v, v) (left) until abs(tilt_angles()[0]) / 10 >= A, slowing down near the target; for more than 90° turn in steps because yaw wraps at ±180°.

STYLE
- Beginner-friendly: short, clear names, a comment in ${LANG_NAME[lang]} above each logical part, no classes, no clever tricks.
- Loops that poll sensors must yield: put \`await runloop.sleep_ms(10)\` inside \`while\` loops.
- Keep the whole program under 80 lines.
- Never write a fake program for a task the robot cannot do: answer with "unsupported".`
}

export function userMessage(prompt: string, previous?: { kind: 'program' | 'code'; value: string }): string {
  if (!previous) return `Request: ${prompt}`
  const what = previous.kind === 'program' ? 'program JSON' : 'Python code'
  return `Here is the current ${what}:
${previous.value}

Change it according to this request and return the complete updated JSON object in the same format.
Request: ${prompt}`
}
