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

/**
 * One "steer" that drives a full circle. With steering S the inner wheel runs at
 * (1 - S/50) of the outer one, and the distance is measured on the outer wheel.
 */
export function circleStep(diameterCm: number, robot: RobotProfile): { op: 'steer'; steering: number; value: number; unit: 'cm' } {
  const track = robot.trackWidthMm / 10
  const steering = Math.max(1, Math.round((100 * track) / (diameterCm + track)))
  // From the rounded steering, so that the circle closes exactly.
  return { op: 'steer', steering, value: Math.round(((100 * Math.PI * track) / steering) * 10) / 10, unit: 'cm' }
}

/** Prompt for the RoboEasy DSL; the same commands compile to word blocks and to Python. */
export function dslSystemPrompt(robot: RobotProfile, lang: Lang): string {
  return `You turn a request from a child, a teacher or a robotics team into a program for a LEGO SPIKE Prime robot (SPIKE App 3).
You write RoboEasy commands; RoboEasy compiles them into SPIKE word blocks or Python.

ROBOT
${robotDescription(robot)}

OUTPUT: one JSON object, nothing else:
{"title": string (max 40 chars, ${LANG_NAME[lang]}), "description": string (1-2 friendly sentences in ${LANG_NAME[lang]} explaining what the robot will do, no emoji), "steps": Step[]}

The program starts automatically ("when program starts"); never add a start step.

STEP TYPES (use only these, exactly as written):
{"op":"move","direction":"forward"|"back","value":number,"unit":"cm"|"rotations"|"degrees"|"seconds"}  drive straight
{"op":"turn","direction":"left"|"right","degrees":number}  spin in place by an exact angle using the gyro (90 = quarter turn)
{"op":"reset_yaw"}  set the gyro angle to 0
{"op":"set_movement_motors","left":"A".."F","right":"A".."F"}  only if the drive motors differ from the robot config
{"op":"steer","steering":-100..100,"value":number,"unit":"cm"|"rotations"|"degrees"|"seconds"}  drive along a curve (negative = left)
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
{"op":"if","condition":CONDITION,"then":Step[],"else":Step[] (optional)}

IMAGE: one of ${Object.keys(IMAGES)
    .map((k) => `"${k}"`)
    .join(', ')}, or 25 digits 0-9 (5 rows × 5 pixels, 9 = brightest).

CONDITION (the sensor port defaults to the robot config above; add "port" only if the user names another one):
{"sensor":"distance","comparator":"<"|">"|"=","value":number,"unit":"cm"}  "<" = closer than
{"sensor":"color","color":${Object.keys(SENSOR_COLORS)
    .map((c) => `"${c}"`)
    .join('|')}}
{"sensor":"reflection","comparator":"<"|">","value":0..100}  reflected light in %, black line ≈ 15, white ≈ 90
{"sensor":"force","state":"pressed"|"released"|"hardpressed"}
{"sensor":"button","button":"left"|"right","state":"pressed"|"released"}  buttons on the hub

GOOD PRACTICE
- Keep it simple and readable for a beginner: prefer the fewest steps that do the job (usually 2-15, never more than 40).
- "turn" is for turning in place by an angle; the gyro makes it exact, you do not need to calculate motor degrees.
- 1 wheel rotation ≈ ${effectiveCmPerRotation(robot)} cm.
- Attachments are single motors: raise/lower with motor_run in degrees, or motor_to_position for a fixed position.
- Behaviours that react to sensors "all the time" (line following, avoiding obstacles, patrolling) use "forever" with "if"/"wait_until" inside.
- To stop in front of an obstacle: start_move → wait_until distance "<" N cm → stop_move.
- Line following with one color sensor: set_speed 25-35, then forever { if reflection "<" 50 then start_steer -30 else start_steer 30 }.
- Add a small celebration when a task finishes (beep, image) only if it fits the request.
- If the request is impossible for this robot or unsafe, return a harmless program that shows "no" and explain why in the description.
- Never invent step types or fields. Numbers are plain JSON numbers.
- Every "steer" needs both "value" and "unit"; "degrees" is not a field of "steer".
- A circle is one "steer". For diameter D cm and wheel track T = ${robot.trackWidthMm / 10} cm: S = round(100*T/(D+T)), steering = S to the right or -S to the left, value = 314*T/S, unit "cm". If no size is given, use D = 40.
- A "repeat", "forever", "repeat_until" or "if" must contain the commands it repeats or runs: "steps" (or "then") is never empty.

EXAMPLES
Request: "Drive forward 20 cm, turn right and show a smile"
{"title":"Forward and smile","description":"The robot drives 20 cm forward, turns right and smiles.","steps":[{"op":"move","direction":"forward","value":20,"unit":"cm"},{"op":"turn","direction":"right","degrees":90},{"op":"show_image","image":"smile","seconds":2}]}

Request: "Stop 10 cm before a wall and beep"
{"title":"Stop at the wall","description":"The robot drives forward until the wall is closer than 10 cm, then stops and beeps.","steps":[{"op":"set_speed","speed":40},{"op":"start_move","direction":"forward"},{"op":"wait_until","condition":{"sensor":"distance","comparator":"<","value":10,"unit":"cm"}},{"op":"stop_move"},{"op":"beep","note":72,"seconds":0.3}]}

Request: "Drive in a circle"
{"title":"Circle","description":"The robot drives one full circle 40 cm across.","steps":[${JSON.stringify(circleStep(40, robot))}]}

Request: "Drive in a square"
{"title":"Square","description":"The robot drives along a square with 30 cm sides.","steps":[{"op":"repeat","times":4,"steps":[{"op":"move","direction":"forward","value":30,"unit":"cm"},{"op":"turn","direction":"right","degrees":90}]}]}`
}

/** Prompt for free Python: the model writes SPIKE 3 MicroPython directly. */
export function freePythonSystemPrompt(robot: RobotProfile, lang: Lang): string {
  const cm = effectiveCmPerRotation(robot)
  return `You write MicroPython for a LEGO SPIKE Prime hub running the SPIKE App 3 firmware. Only the SPIKE 3 API below exists.
NEVER use the SPIKE 2 / MINDSTORMS APIs (\`from spike import …\`, \`PrimeHub()\`, \`MotorPair()\`, \`hub.port.A\`), \`time.sleep\` or \`input()\`.
Import only these modules: ${ALLOWED_PYTHON_MODULES.join(', ')}.

ROBOT
${robotDescription(robot)}

OUTPUT: one JSON object, nothing else:
{"title": string (max 40 chars, ${LANG_NAME[lang]}), "description": string (1-2 friendly sentences in ${LANG_NAME[lang]}), "code": string (the full program)}

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
- If the request is impossible for this robot or unsafe, write a harmless program and explain why in the description.`
}

export function userMessage(prompt: string, previous?: { kind: 'program' | 'code'; value: string }): string {
  if (!previous) return `Request: ${prompt}`
  const what = previous.kind === 'program' ? 'program JSON' : 'Python code'
  return `Here is the current ${what}:
${previous.value}

Change it according to this request and return the complete updated JSON object in the same format.
Request: ${prompt}`
}
