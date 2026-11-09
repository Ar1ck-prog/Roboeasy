/**
 * SPIKE App 3 MicroPython: a deterministic DSL → Python compiler (the same
 * commands that become word blocks) and the checks applied to Python the AI
 * writes in "free Python" mode.
 *
 * API reference: SPIKE 3 hub modules — hub (port, light_matrix, sound,
 * light, button, motion_sensor), runloop, motor, motor_pair,
 * distance_sensor, color_sensor, force_sensor, color.
 */

import {
  type Condition,
  type Expr,
  type Program,
  type RobotProfile,
  type Step,
  DEFAULT_ROBOT,
  GYRO_CHUNK,
  MOVEMENT_OPS,
  childLists,
  effectiveCmPerRotation,
  conditionsOf,
  imagePixels,
  programSteps,
  usesOp,
  variablesOf,
} from './types'
import { arcPlan } from './arcs'

const COLOR_CONST: Record<string, string> = {
  black: 'BLACK',
  violet: 'MAGENTA',
  blue: 'BLUE',
  azure: 'AZURE',
  green: 'GREEN',
  yellow: 'YELLOW',
  orange: 'ORANGE',
  red: 'RED',
  white: 'WHITE',
  none: 'UNKNOWN',
  off: 'BLACK',
}

const fmt = (n: number) => String(Math.round(n * 100) / 100)

const POSITION_DIRECTION = { shortest: 'SHORTEST_PATH', clockwise: 'CLOCKWISE', counterclockwise: 'COUNTERCLOCKWISE' } as const

/** Gyro turn helper emitted into programs that turn: slows down near the target to avoid overshooting. */
const TURN_HELPER = (factor: number) => [
  `TURN_FACTOR = ${fmt(factor)}  # calibration: commanded / measured angle`,
  '',
  '',
  'async def turn(degrees, velocity):',
  '    # Spin in place using the hub gyro (yaw): + turns right, - turns left.',
  '    direction = 1 if degrees > 0 else -1',
  '    remaining = abs(degrees) * TURN_FACTOR',
  '    while remaining > 0.5:',
  `        target = min(remaining, ${GYRO_CHUNK})  # yaw wraps at +-180 degrees`,
  '        motion_sensor.reset_yaw(0)',
  '        await runloop.sleep_ms(10)',
  '        while True:',
  '            turned = abs(motion_sensor.tilt_angles()[0]) / 10  # decidegrees -> degrees',
  '            left = target - turned',
  '            if left <= 0.5:',
  '                break',
  '            v = int(max(80, min(abs(velocity), left * 10)))  # slow down near the target',
  '            motor_pair.move_tank(motor_pair.PAIR_1, direction * v, -direction * v)',
  '            await runloop.sleep_ms(5)',
  '        motor_pair.stop(motor_pair.PAIR_1)',
  '        remaining -= target',
  '',
]

/** Movement speed in % → velocity in degrees per second (100% ≈ 1000 °/s). */
const velocity = (percent: number) => Math.round(percent * 10)

/** MIDI note → frequency in Hz, like SPIKE's beep block. */
export function noteToHz(note: number): number {
  return Math.round(440 * 2 ** ((note - 69) / 12))
}

function pyString(s: string): string {
  return JSON.stringify(s)
}

interface Ctx {
  robot: RobotProfile
  cm: number
  lines: string[]
}

function exprPy(e: Expr): string {
  if ('num' in e) return fmt(e.num)
  if ('var' in e) return e.var
  return `(${exprPy(e.a)} ${e.op} ${exprPy(e.b)})`
}

const AXIS_INDEX = { yaw: 0, pitch: 1, roll: 2 } as const

/** Tilt in degrees. TODO: проверить знак на настоящем хабе: yaw здесь растёт при повороте вправо, как в словесных блоках. */
function axisExpr(axis: keyof typeof AXIS_INDEX): string {
  return `${axis === 'yaw' ? '-' : ''}motion_sensor.tilt_angles()[${AXIS_INDEX[axis]}] / 10`
}

function conditionExpr(c: Condition): string {
  switch (c.sensor) {
    case 'distance': {
      const unit = c.unit === 'cm' ? 'distance_cm' : c.unit === 'inches' ? 'distance_inches' : 'distance_percent'
      const op = c.comparator === '=' ? '==' : c.comparator
      return `${unit}(port.${c.port}) ${op} ${fmt(c.value)}`
    }
    case 'color':
      return `color_sensor.color(port.${c.port}) == color.${COLOR_CONST[c.color]}`
    case 'reflection': {
      const op = c.comparator === '=' ? '==' : c.comparator
      return `color_sensor.reflection(port.${c.port}) ${op} ${fmt(c.value)}`
    }
    case 'force':
      if (c.state === 'released') return `not force_sensor.pressed(port.${c.port})`
      if (c.state === 'hardpressed') return `force_sensor.force(port.${c.port}) > 80`
      return `force_sensor.pressed(port.${c.port})`
    case 'button': {
      const b = `button.pressed(button.${c.button.toUpperCase()})`
      return c.state === 'released' ? `${b} == 0` : `${b} > 0`
    }
    case 'gyro':
      return `${axisExpr(c.axis)} ${c.comparator === '=' ? '==' : c.comparator} ${fmt(c.value)}`
    case 'var':
      return `${c.name} ${c.comparator === '=' ? '==' : c.comparator} ${fmt(c.value)}`
  }
}

function moveDegrees(value: number, unit: string, ctx: Ctx): number {
  switch (unit) {
    case 'cm':
      return Math.round((value / ctx.cm) * 360)
    case 'inches':
      return Math.round(((value * 2.54) / ctx.cm) * 360)
    case 'rotations':
      return Math.round(value * 360)
    default:
      return Math.round(value)
  }
}

function emit(steps: Step[], depth: number, ctx: Ctx) {
  const pad = '    '.repeat(depth)
  const line = (s: string) => ctx.lines.push(pad + s)
  const block = (body: Step[], loop: boolean) => {
    const before = ctx.lines.length
    emit(body, depth + 1, ctx)
    if (ctx.lines.length === before) ctx.lines.push('    '.repeat(depth + 1) + (loop ? 'await runloop.sleep_ms(10)' : 'pass'))
    else if (loop) ctx.lines.push('    '.repeat(depth + 1) + 'await runloop.sleep_ms(10)')
  }

  for (const s of steps) {
    switch (s.op) {
      case 'move': {
        const v = s.direction === 'back' ? '-speed' : 'speed'
        if (s.unit === 'seconds') line(`await motor_pair.move_for_time(motor_pair.PAIR_1, ${Math.round(s.value * 1000)}, 0, velocity=${v})`)
        else line(`await motor_pair.move_for_degrees(motor_pair.PAIR_1, ${moveDegrees(s.value, s.unit, ctx)}, 0, velocity=${v})`)
        break
      }
      case 'turn':
        line(`await turn(${s.direction === 'right' ? '' : '-'}${fmt(s.degrees)}, speed)`)
        break
      case 'reset_yaw':
        line('motion_sensor.reset_yaw(0)')
        break
      case 'set_movement_motors':
        line('motor_pair.unpair(motor_pair.PAIR_1)')
        line(`motor_pair.pair(motor_pair.PAIR_1, port.${s.left}, port.${s.right})`)
        break
      case 'steer':
        if (s.unit === 'seconds') line(`await motor_pair.move_for_time(motor_pair.PAIR_1, ${Math.round(s.value * 1000)}, ${fmt(s.steering)}, velocity=speed)`)
        else line(`await motor_pair.move_for_degrees(motor_pair.PAIR_1, ${moveDegrees(s.value, s.unit, ctx)}, ${fmt(s.steering)}, velocity=speed)`)
        break
      case 'start_move': {
        const steering = s.direction === 'left' ? -100 : s.direction === 'right' ? 100 : 0
        line(`motor_pair.move(motor_pair.PAIR_1, ${steering}, velocity=${s.direction === 'back' ? '-speed' : 'speed'})`)
        break
      }
      case 'start_steer':
        line(`motor_pair.move(motor_pair.PAIR_1, ${fmt(s.steering)}, velocity=speed)`)
        break
      case 'stop_move':
        line('motor_pair.stop(motor_pair.PAIR_1)')
        break
      case 'set_speed':
        line(`speed = ${velocity(s.speed)}  # ${fmt(s.speed)}%`)
        break
      case 'motor_run': {
        const v = `${s.direction === 'counterclockwise' ? '-' : ''}motor_speed['${s.port}']`
        if (s.unit === 'seconds') line(`await motor.run_for_time(port.${s.port}, ${Math.round(s.value * 1000)}, ${v})`)
        else line(`await motor.run_for_degrees(port.${s.port}, ${Math.round(s.unit === 'rotations' ? s.value * 360 : s.value)}, ${v})`)
        break
      }
      case 'motor_start':
        line(`motor.run(port.${s.port}, ${s.direction === 'counterclockwise' ? '-' : ''}motor_speed['${s.port}'])`)
        break
      case 'motor_stop':
        line(`motor.stop(port.${s.port})`)
        break
      case 'motor_speed':
        line(`motor_speed['${s.port}'] = ${velocity(s.speed)}  # ${fmt(s.speed)}%`)
        break
      case 'motor_to_position':
        line(
          `await motor.run_to_absolute_position(port.${s.port}, ${fmt(s.position)}, motor_speed['${s.port}'], direction=motor.${POSITION_DIRECTION[s.direction]})`,
        )
        break
      case 'show_image': {
        const px = imagePixels(s.image)
          .split('')
          .map((d) => Math.round((Number(d) * 100) / 9))
        if (s.image.length !== 25) line(`# ${s.image}`)
        line('light_matrix.show([')
        for (let r = 0; r < 5; r++) line(`    ${px.slice(r * 5, r * 5 + 5).join(', ')},`)
        line('])')
        if (s.seconds !== undefined) {
          line(`await runloop.sleep_ms(${Math.round(s.seconds * 1000)})`)
          line('light_matrix.clear()')
        }
        break
      }
      case 'write':
        line(`await light_matrix.write(${pyString(s.text)})`)
        break
      case 'clear_display':
        line('light_matrix.clear()')
        break
      case 'beep':
        line(`await sound.beep(${noteToHz(s.note)}, ${Math.round(s.seconds * 1000)}, 100)`)
        break
      case 'button_light':
        line(`light.color(light.POWER, color.${COLOR_CONST[s.color]})`)
        break
      case 'wait':
        line(`await runloop.sleep_ms(${Math.round(s.seconds * 1000)})`)
        break
      case 'wait_until':
        line(`await runloop.until(lambda: ${conditionExpr(s.condition)})`)
        break
      case 'repeat':
        line(`for _ in range(${s.times}):`)
        block(s.steps, false)
        break
      case 'forever':
        line('while True:')
        block(s.steps, true)
        break
      case 'repeat_until':
        line(`while not (${conditionExpr(s.condition)}):`)
        block(s.steps, true)
        break
      case 'while':
        line(`while ${conditionExpr(s.condition)}:`)
        block(s.steps, true)
        break
      case 'arc':
      case 'circle': {
        const degrees = (s.op === 'circle' ? 360 * s.turns : s.degrees) * ctx.robot.turnFactor
        const plan = arcPlan(s.direction, s.radius, degrees, ctx.robot)
        const inner = `int(speed * ${Math.round(plan.ratio * 1000) / 1000})`
        const [left, right] = s.direction === 'right' ? ['speed', inner] : [inner, 'speed']
        line(`await motor_pair.move_tank_for_degrees(motor_pair.PAIR_1, ${moveDegrees(plan.outerCm, 'cm', ctx)}, ${left}, ${right})`)
        break
      }
      case 'tank': {
        const [left, right] = [velocity(s.leftSpeed), velocity(s.rightSpeed)]
        if (s.unit === 'seconds') line(`await motor_pair.move_tank_for_time(motor_pair.PAIR_1, ${left}, ${right}, ${Math.round(s.value * 1000)})`)
        else line(`await motor_pair.move_tank_for_degrees(motor_pair.PAIR_1, ${moveDegrees(s.value, s.unit, ctx)}, ${left}, ${right})`)
        break
      }
      case 'move_expr': {
        const v = s.direction === 'back' ? '-speed' : 'speed'
        const value = exprPy(s.expr)
        if (s.unit === 'seconds') line(`await motor_pair.move_for_time(motor_pair.PAIR_1, int(abs(${value}) * 1000), 0, velocity=${v})`)
        else line(`await motor_pair.move_for_degrees(motor_pair.PAIR_1, int(abs(${value}) * ${fmt(moveDegrees(1000, s.unit, ctx) / 1000)}), 0, velocity=${v})`)
        break
      }
      case 'set_var':
        line(`${s.name} = ${exprPy(s.expr)}`)
        break
      case 'change_var':
        line(`${s.name} += ${exprPy(s.expr)}`)
        break
      case 'write_var':
        line(`await light_matrix.write(str(${s.name}))`)
        break
      case 'call':
        line(`await ${s.name}()`)
        break
      case 'if':
        line(`if ${conditionExpr(s.condition)}:`)
        block(s.then, false)
        if (s.else?.length) {
          line('else:')
          block(s.else, false)
        }
        break
    }
  }
}

/** Translates a block program to SPIKE App 3 MicroPython. */
export function programToPython(program: Program, robot: RobotProfile = DEFAULT_ROBOT): string {
  const ctx: Ctx = { robot, cm: effectiveCmPerRotation(robot), lines: [] }
  const allSteps = programSteps(program)
  const drive = usesOp(allSteps, (s) => MOVEMENT_OPS.has(s.op))
  const has = (op: Step['op'] | Step['op'][]) => usesOp(allSteps, (s) => (Array.isArray(op) ? op.includes(s.op) : s.op === op))
  const sensors = new Set(conditionsOf(allSteps).map((c) => c.sensor))
  const motorPorts = new Set<string>()
  const collect = (steps: Step[]) => {
    for (const s of steps) {
      if (s.op === 'motor_run' || s.op === 'motor_start' || s.op === 'motor_stop' || s.op === 'motor_speed' || s.op === 'motor_to_position') {
        motorPorts.add(s.port)
      }
      childLists(s).forEach(collect)
    }
  }
  collect(allSteps)

  const hubImports = ['port']
  if (has(['show_image', 'write', 'clear_display', 'write_var'])) hubImports.push('light_matrix')
  if (has('beep')) hubImports.push('sound')
  if (has('button_light')) hubImports.push('light')
  if (sensors.has('button')) hubImports.push('button')
  const gyro = has(['turn', 'reset_yaw']) || sensors.has('gyro')
  if (gyro) hubImports.push('motion_sensor')

  const modules = ['runloop']
  if (drive) modules.push('motor_pair')
  if (motorPorts.size) modules.push('motor')
  if (sensors.has('distance')) modules.push('distance_sensor')
  if (sensors.has('color') || sensors.has('reflection')) modules.push('color_sensor')
  if (sensors.has('color') || has('button_light')) modules.push('color')
  if (sensors.has('force')) modules.push('force_sensor')

  const out: string[] = []
  out.push(`# ${program.title}`)
  if (program.description) out.push(`# ${program.description}`)
  out.push('# RoboEasy AI · LEGO SPIKE App 3 (Python)')
  out.push('')
  out.push(`from hub import ${hubImports.join(', ')}`)
  out.push(`import ${modules.join(', ')}`)
  out.push('')

  if (sensors.has('distance')) {
    out.push('')
    out.push('def distance_mm(p):')
    out.push('    d = distance_sensor.distance(p)')
    out.push('    return 2000 if d < 0 else d  # -1 = nothing in sight')
    out.push('')
    out.push('def distance_cm(p):')
    out.push('    return distance_mm(p) / 10')
    out.push('')
    out.push('def distance_inches(p):')
    out.push('    return distance_mm(p) / 25.4')
    out.push('')
    out.push('def distance_percent(p):')
    out.push('    return min(100, distance_mm(p) / 20)')
    out.push('')
  }

  if (has('turn')) {
    out.push('')
    out.push(...TURN_HELPER(robot.turnFactor))
  }

  out.push('')
  out.push('async def main():')
  // A leading "set speed" becomes the initial value instead of a second assignment.
  const lead = program.steps[0]?.op === 'set_speed' ? program.steps[0] : null
  const steps = lead ? program.steps.slice(1) : program.steps
  if (drive) {
    out.push(`    motor_pair.pair(motor_pair.PAIR_1, port.${robot.leftMotor}, port.${robot.rightMotor})`)
    const percent = lead?.op === 'set_speed' ? lead.speed : 50
    out.push(`    speed = ${velocity(percent)}  # ${fmt(percent)}%, degrees per second`)
  }
  if (motorPorts.size) out.push(`    motor_speed = {${[...motorPorts].map((p) => `'${p}': 750`).join(', ')}}  # 75%`)
  for (const name of variablesOf(allSteps)) out.push(`    ${name} = 0`)

  // The program's own blocks live inside main(), so they share its speed and variables.
  for (const fn of program.functions ?? []) {
    const assigned = new Set<string>()
    const walk = (list: Step[]) => {
      for (const s of list) {
        if (s.op === 'set_var' || s.op === 'change_var') assigned.add(s.name)
        if (s.op === 'set_speed') assigned.add('speed')
        childLists(s).forEach(walk)
      }
    }
    walk(fn.steps)
    ctx.lines.push('', `    async def ${fn.name}():`)
    if (assigned.size) ctx.lines.push(`        nonlocal ${[...assigned].join(', ')}`)
    emit(fn.steps, 2, ctx)
    ctx.lines.push('')
  }

  emit(steps, 1, ctx)
  out.push(...ctx.lines)
  if (!ctx.lines.length && !drive && !motorPorts.size) out.push('    pass')

  out.push('')
  out.push('')
  out.push('runloop.run(main())')
  out.push('')
  return out.join('\n')
}

// ---------------------------------------------------------------------------
// Python written by the AI
// ---------------------------------------------------------------------------

/** Removes Markdown fences and normalizes line endings/indentation. */
export function cleanPython(code: string): string {
  let c = code.replace(/\r\n?/g, '\n')
  const fenced = c.match(/```(?:python|py)?\s*\n([\s\S]*?)```/i)
  if (fenced) c = fenced[1]
  c = c.replace(/\t/g, '    ')
  return c.replace(/[ \t]+$/gm, '').trim() + '\n'
}

/** Modules a SPIKE App 3 program may import (hub firmware + MicroPython built-ins). */
export const ALLOWED_PYTHON_MODULES = [
  'hub',
  'runloop',
  'motor',
  'motor_pair',
  'distance_sensor',
  'color_sensor',
  'color',
  'force_sensor',
  'color_matrix',
  'device',
  'orientation',
  'math',
  'random',
  'time',
] as const

/** Root module names imported by the code (`import a.b as c`, `from x.y import z`). */
export function importedModules(code: string): string[] {
  const found = new Set<string>()
  for (const line of code.split('\n')) {
    const from = line.match(/^\s*from\s+([\w.]+)\s+import\b/)
    if (from) found.add(from[1].split('.')[0])
    const imp = line.match(/^\s*import\s+(.+)$/)
    if (imp) for (const part of imp[1].split(',')) found.add(part.trim().split(/\s+/)[0].split('.')[0])
  }
  return [...found].filter(Boolean)
}

/** Finds problems that would stop the code from running on a SPIKE App 3 hub. */
export function checkPython(code: string): string[] {
  const issues: string[] = []
  const allowed: readonly string[] = ALLOWED_PYTHON_MODULES
  const unknown = importedModules(code).filter((m) => !allowed.includes(m))
  if (unknown.length) issues.push(`imports modules that are not available on the hub: ${unknown.join(', ')}`)
  const legacy = [
    [/\bfrom\s+spike\b|\bimport\s+spike\b/, 'uses the SPIKE 2 `spike` module'],
    [/\bfrom\s+mindstorms\b|\bimport\s+mindstorms\b/, 'uses the MINDSTORMS `mindstorms` module'],
    [/\bPrimeHub\s*\(|\bMotorPair\s*\(/, 'uses SPIKE 2 classes (PrimeHub/MotorPair)'],
    [/\bhub\.port\.[A-F]\b/, 'uses the legacy `hub.port.X` API'],
  ] as const
  for (const [re, message] of legacy) if (re.test(code)) issues.push(message)
  if (!/runloop\.run\s*\(\s*main\s*\(\s*\)\s*\)/.test(code)) issues.push('does not start the program with runloop.run(main())')
  if (!/\basync\s+def\s+\w+\s*\(/.test(code)) issues.push('has no async main function')
  if (/\binput\s*\(/.test(code)) issues.push('uses input(), which is not available on the hub')
  if (/\btime\.sleep\s*\(/.test(code)) issues.push('uses time.sleep, which blocks the hub; use await runloop.sleep_ms')

  let depth = 0
  const stripped = code.replace(/#.*$/gm, '').replace(/("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*')/g, '""')
  for (const ch of stripped) {
    if ('([{'.includes(ch)) depth++
    else if (')]}'.includes(ch)) depth--
    if (depth < 0) break
  }
  if (depth !== 0) issues.push('has unbalanced brackets')
  return issues
}
