/**
 * Builds the Scratch 3 `project.json` that the LEGO SPIKE App 3 stores inside
 * `scratch.sb3` for word-block projects.
 *
 * Opcodes, input/field names, shadow blocks and menu values follow the
 * SPIKE App 3 block definitions (`flippermove_*`, `flippermotor_*`, …) and
 * the layout of projects saved by the app itself. Custom SPIKE fields are
 * always a shadow block `<extension>_<field-type>` holding a single field
 * `field_<that opcode>`.
 */

import {
  type Comparator,
  type Condition,
  type Expr,
  type Program,
  type RobotProfile,
  type Step,
  DEFAULT_ROBOT,
  LIGHT_COLORS,
  MOVEMENT_OPS,
  SENSOR_COLORS,
  SPIKE_DEFAULT_CM_PER_ROTATION,
  effectiveCmPerRotation,
  imagePixels,
  gyroChunks,
  programSteps,
  usesOp,
} from './types'
import { arcPlan, tankAsSteering } from './arcs'

/** The asset SPIKE writes for its empty costume/backdrop (md5 of an empty file). */
export const EMPTY_SVG_ASSET = 'd41d8cd98f00b204e9800998ecf8427e'

type Primitive = [number, string]
/** A variable used as a value: Scratch's compact form. */
type VariablePrimitive = [12, string, string]
type Input = [1, string | Primitive] | [2, string] | [3, string | VariablePrimitive, Primitive]
type Mutation = { tagName: 'mutation'; children: []; proccode: string; argumentids: string; argumentnames?: string; argumentdefaults?: string; warp: string }

export interface ScratchBlock {
  opcode: string
  next: string | null
  parent: string | null
  inputs: Record<string, Input>
  fields: Record<string, [string, string | null]>
  shadow: boolean
  topLevel: boolean
  x?: number
  y?: number
  mutation?: Mutation
}

export interface ScratchProject {
  targets: Record<string, unknown>[]
  monitors: unknown[]
  extensions: string[]
  meta: { semver: string; vm: string; agent: string }
}

const ID_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'

export function randomId(length = 20): string {
  const bytes = new Uint8Array(length)
  globalThis.crypto.getRandomValues(bytes)
  let id = ''
  for (const b of bytes) id += ID_CHARS[b % ID_CHARS.length]
  return id
}

/** Scratch stores numbers as strings; keep them short and without float noise. */
export function numStr(n: number): string {
  return String(Math.round(n * 100) / 100)
}

const NUMBER = 4
const POSITIVE_NUMBER = 5
const WHOLE_NUMBER = 6
const TEXT = 10

const OPERATOR = { '+': 'operator_add', '-': 'operator_subtract', '*': 'operator_multiply', '/': 'operator_divide' } as const
const COMPARATOR = { '<': 'operator_lt', '>': 'operator_gt', '=': 'operator_equals' } as const

class Builder {
  blocks: Record<string, ScratchBlock> = {}
  variables = new Map<string, string>()
  private count = 0
  /** The movement speed set so far: a "tank" block changes it and must put it back. */
  private speed = 50

  constructor(private robot: RobotProfile) {}

  /** Block ids only need to be unique within the project: a counter can never collide. */
  private nextId(): string {
    this.count += 1
    return `rb${this.count.toString().padStart(4, '0')}`
  }

  add(opcode: string, parent: string | null, extra: Partial<ScratchBlock> = {}): string {
    const id = this.nextId()
    this.blocks[id] = { opcode, next: null, parent, inputs: {}, fields: {}, shadow: false, topLevel: false, ...extra }
    return id
  }

  /** A custom SPIKE field lives in its own shadow block. */
  shadow(parent: string, opcode: string, value: string): Input {
    const id = this.nextId()
    this.blocks[id] = {
      opcode,
      next: null,
      parent,
      inputs: {},
      fields: { [`field_${opcode}`]: [value, null] },
      shadow: true,
      topLevel: false,
    }
    return [1, id]
  }

  variable(name: string): VariablePrimitive {
    let id = this.variables.get(name)
    if (!id) this.variables.set(name, (id = `var${(this.variables.size + 1).toString().padStart(4, '0')}`))
    return [12, name, id]
  }

  /** A numeric input holding a constant, a variable or arithmetic. */
  expr(parent: string, e: Expr, kind = NUMBER): Input {
    if ('num' in e) return [1, [kind, numStr(e.num)]]
    if ('var' in e) return [3, this.variable(e.var), [kind, '']]
    const id = this.add(OPERATOR[e.op], parent)
    this.blocks[id].inputs.NUM1 = this.expr(id, e.a)
    this.blocks[id].inputs.NUM2 = this.expr(id, e.b)
    return [3, id, [kind, '']]
  }

  /** A comparison block with a reporter on the left. */
  compare(parent: string, comparator: Comparator, left: (id: string) => Input, value: number): string {
    const id = this.add(COMPARATOR[comparator], parent)
    this.blocks[id].inputs.OPERAND1 = left(id)
    this.blocks[id].inputs.OPERAND2 = [1, [TEXT, numStr(value)]]
    return id
  }

  /** Steer block used by arcs, circles and "tank". */
  steer(parent: string, steering: number, value: number, unit: string): string {
    const id = this.add('flippermove_steer', parent)
    const b = this.blocks[id]
    b.inputs.STEERING = this.shadow(id, 'flippermove_rotation-wheel', numStr(steering))
    b.inputs.VALUE = [1, [NUMBER, numStr(value)]]
    b.fields.UNIT = [unit, null]
    return id
  }

  movementSpeed(parent: string, speed: number): string {
    const id = this.add('flippermove_movementSpeed', parent)
    this.blocks[id].inputs.SPEED = [1, [NUMBER, numStr(speed)]]
    return id
  }

  /** Chains steps under `parent`; returns the id of the first block (or null). */
  stack(steps: Step[], parent: string): string | null {
    let first: string | null = null
    let prev: string | null = null
    for (const step of steps) {
      // One DSL step can become several blocks (a gyro turn); link them in order.
      for (const id of this.step(step, prev ?? parent)) {
        this.blocks[id].parent = prev ?? parent
        if (prev) this.blocks[prev].next = id
        first ??= id
        prev = id
      }
    }
    return first
  }

  substack(block: string, name: 'SUBSTACK' | 'SUBSTACK2', steps: Step[]) {
    const first = this.stack(steps, block)
    if (first) this.blocks[block].inputs[name] = [2, first]
  }

  condition(block: string, condition: Condition) {
    this.blocks[block].inputs.CONDITION = [2, this.bool(condition, block)]
  }

  bool(c: Condition, parent: string): string {
    switch (c.sensor) {
      case 'distance': {
        const id = this.add('flippersensors_isDistance', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippersensors_distance-sensor-selector', c.port)
        b.inputs.VALUE = [1, [NUMBER, numStr(c.value)]]
        b.fields.COMPARATOR = [c.comparator, null]
        b.fields.UNIT = [c.unit, null]
        return id
      }
      case 'color': {
        const id = this.add('flippersensors_isColor', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippersensors_color-sensor-selector', c.port)
        b.inputs.VALUE = this.shadow(id, 'flippersensors_color-selector', SENSOR_COLORS[c.color])
        return id
      }
      case 'reflection': {
        const id = this.add('flippersensors_isReflectivity', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippersensors_color-sensor-selector', c.port)
        b.inputs.VALUE = [1, [NUMBER, numStr(c.value)]]
        b.fields.COMPARATOR = [c.comparator, null]
        return id
      }
      case 'force': {
        const id = this.add('flippersensors_isPressed', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippersensors_force-sensor-selector', c.port)
        b.fields.OPTION = [c.state, null]
        return id
      }
      case 'button': {
        const id = this.add('flippersensors_buttonIsPressed', parent)
        const b = this.blocks[id]
        b.fields.BUTTON = [c.button, null]
        b.fields.EVENT = [c.state, null]
        return id
      }
      case 'gyro':
        return this.compare(
          parent,
          c.comparator,
          (id) => {
            const axis = this.add('flippersensors_orientationAxis', id)
            this.blocks[axis].fields.AXIS = [c.axis, null]
            return [3, axis, [TEXT, '']]
          },
          c.value,
        )
      case 'var':
        return this.compare(parent, c.comparator, () => [3, this.variable(c.name), [TEXT, '']], c.value)
    }
  }

  /** Adds the block for one step (with its inputs and nested stacks) and returns its id. */
  step(s: Step, parent: string): string[] {
    switch (s.op) {
      case 'move': {
        const id = this.add('flippermove_move', parent)
        const b = this.blocks[id]
        b.inputs.DIRECTION = this.shadow(id, 'flippermove_custom-icon-direction', s.direction)
        b.inputs.VALUE = [1, [NUMBER, numStr(s.value)]]
        b.fields.UNIT = [s.unit, null]
        return [id]
      }
      case 'turn':
        return this.gyroTurn(s.direction, s.degrees, parent)
      case 'reset_yaw':
        return [this.add('flippersensors_resetYaw', parent)]
      case 'set_movement_motors': {
        const id = this.add('flippermove_setMovementPair', parent)
        this.blocks[id].inputs.PAIR = this.shadow(id, 'flippermove_movement-port-selector', `${s.left}${s.right}`)
        return [id]
      }
      case 'steer': {
        const id = this.add('flippermove_steer', parent)
        const b = this.blocks[id]
        b.inputs.STEERING = this.shadow(id, 'flippermove_rotation-wheel', numStr(s.steering))
        b.inputs.VALUE = [1, [NUMBER, numStr(s.value)]]
        b.fields.UNIT = [s.unit, null]
        return [id]
      }
      case 'start_move': {
        if (s.direction === 'forward' || s.direction === 'back') {
          const id = this.add('flippermove_startMove', parent)
          this.blocks[id].inputs.DIRECTION = this.shadow(id, 'flippermove_custom-icon-direction', s.direction)
          return [id]
        }
        const id = this.add('flippermove_startSteer', parent)
        this.blocks[id].inputs.STEERING = this.shadow(id, 'flippermove_rotation-wheel', s.direction === 'right' ? '100' : '-100')
        return [id]
      }
      case 'start_steer': {
        const id = this.add('flippermove_startSteer', parent)
        this.blocks[id].inputs.STEERING = this.shadow(id, 'flippermove_rotation-wheel', numStr(s.steering))
        return [id]
      }
      case 'stop_move':
        return [this.add('flippermove_stopMove', parent)]
      case 'set_speed':
        this.speed = s.speed
        return [this.movementSpeed(parent, s.speed)]
      case 'motor_run': {
        const id = this.add('flippermotor_motorTurnForDirection', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippermotor_multiple-port-selector', s.port)
        b.inputs.DIRECTION = this.shadow(id, 'flippermotor_custom-icon-direction', s.direction)
        b.inputs.VALUE = [1, [NUMBER, numStr(s.value)]]
        b.fields.UNIT = [s.unit, null]
        return [id]
      }
      case 'motor_start': {
        const id = this.add('flippermotor_motorStartDirection', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippermotor_multiple-port-selector', s.port)
        b.inputs.DIRECTION = this.shadow(id, 'flippermotor_custom-icon-direction', s.direction)
        return [id]
      }
      case 'motor_stop': {
        const id = this.add('flippermotor_motorStop', parent)
        this.blocks[id].inputs.PORT = this.shadow(id, 'flippermotor_multiple-port-selector', s.port)
        return [id]
      }
      case 'motor_to_position': {
        const id = this.add('flippermotor_motorGoDirectionToPosition', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippermotor_multiple-port-selector', s.port)
        b.inputs.POSITION = this.shadow(id, 'flippermotor_custom-angle', numStr(s.position))
        b.fields.DIRECTION = [s.direction, null]
        return [id]
      }
      case 'motor_speed': {
        const id = this.add('flippermotor_motorSetSpeed', parent)
        const b = this.blocks[id]
        b.inputs.PORT = this.shadow(id, 'flippermotor_multiple-port-selector', s.port)
        b.inputs.SPEED = [1, [NUMBER, numStr(s.speed)]]
        return [id]
      }
      case 'show_image': {
        const timed = s.seconds !== undefined
        const id = this.add(timed ? 'flipperlight_lightDisplayImageOnForTime' : 'flipperlight_lightDisplayImageOn', parent)
        const b = this.blocks[id]
        b.inputs.MATRIX = this.shadow(id, 'flipperlight_matrix-5x5-brightness-image', imagePixels(s.image))
        if (timed) b.inputs.VALUE = [1, [NUMBER, numStr(s.seconds ?? 2)]]
        return [id]
      }
      case 'write': {
        const id = this.add('flipperlight_lightDisplayText', parent)
        this.blocks[id].inputs.TEXT = [1, [TEXT, s.text]]
        return [id]
      }
      case 'clear_display':
        return [this.add('flipperlight_lightDisplayOff', parent)]
      case 'beep': {
        const id = this.add('flippersound_beepForTime', parent)
        const b = this.blocks[id]
        b.inputs.NOTE = this.shadow(id, 'flippersound_custom-piano', numStr(s.note))
        b.inputs.DURATION = [1, [NUMBER, numStr(s.seconds)]]
        return [id]
      }
      case 'button_light': {
        const id = this.add('flipperlight_centerButtonLight', parent)
        this.blocks[id].inputs.COLOR = this.shadow(id, 'flipperlight_color-selector-vertical', LIGHT_COLORS[s.color])
        return [id]
      }
      case 'wait': {
        const id = this.add('control_wait', parent)
        this.blocks[id].inputs.DURATION = [1, [POSITIVE_NUMBER, numStr(s.seconds)]]
        return [id]
      }
      case 'wait_until': {
        const id = this.add('control_wait_until', parent)
        this.condition(id, s.condition)
        return [id]
      }
      case 'repeat': {
        const id = this.add('control_repeat', parent)
        this.blocks[id].inputs.TIMES = [1, [WHOLE_NUMBER, numStr(s.times)]]
        this.substack(id, 'SUBSTACK', s.steps)
        return [id]
      }
      case 'forever': {
        const id = this.add('control_forever', parent)
        this.substack(id, 'SUBSTACK', s.steps)
        return [id]
      }
      case 'repeat_until': {
        const id = this.add('control_repeat_until', parent)
        this.condition(id, s.condition)
        this.substack(id, 'SUBSTACK', s.steps)
        return [id]
      }
      case 'while': {
        // SPIKE has only "repeat until": "while X" is "repeat until not X".
        const id = this.add('control_repeat_until', parent)
        const not = this.add('operator_not', id)
        this.blocks[not].inputs.OPERAND = [2, this.bool(s.condition, not)]
        this.blocks[id].inputs.CONDITION = [2, not]
        this.substack(id, 'SUBSTACK', s.steps)
        return [id]
      }
      case 'arc':
      case 'circle': {
        const degrees = (s.op === 'circle' ? 360 * s.turns : s.degrees) * this.robot.turnFactor
        const plan = arcPlan(s.direction, s.radius, degrees, this.robot)
        return [this.steer(parent, plan.steering, plan.steeringOuterCm, 'cm')]
      }
      case 'tank': {
        const { steering, speed } = tankAsSteering(s.leftSpeed, s.rightSpeed)
        // TODO: проверить на настоящем хабе отрицательную скорость движения (обе колеи назад).
        return [this.movementSpeed(parent, speed), this.steer(parent, steering, s.value, s.unit), this.movementSpeed(parent, this.speed)]
      }
      case 'move_expr': {
        const id = this.add('flippermove_move', parent)
        const b = this.blocks[id]
        b.inputs.DIRECTION = this.shadow(id, 'flippermove_custom-icon-direction', s.direction)
        b.inputs.VALUE = this.expr(id, s.expr)
        b.fields.UNIT = [s.unit, null]
        return [id]
      }
      case 'set_var': {
        const id = this.add('data_setvariableto', parent)
        const [name, varId] = this.variable(s.name).slice(1) as [string, string]
        this.blocks[id].fields.VARIABLE = [name, varId]
        this.blocks[id].inputs.VALUE = this.expr(id, s.expr, TEXT)
        return [id]
      }
      case 'change_var': {
        const id = this.add('data_changevariableby', parent)
        const [name, varId] = this.variable(s.name).slice(1) as [string, string]
        this.blocks[id].fields.VARIABLE = [name, varId]
        this.blocks[id].inputs.VALUE = this.expr(id, s.expr)
        return [id]
      }
      case 'write_var': {
        const id = this.add('flipperlight_lightDisplayText', parent)
        this.blocks[id].inputs.TEXT = [3, this.variable(s.name), [TEXT, '']]
        return [id]
      }
      case 'call':
        return [this.add('procedures_call', parent, { mutation: { tagName: 'mutation', children: [], proccode: s.name, argumentids: '[]', warp: 'false' } })]
      case 'if': {
        const id = this.add(s.else?.length ? 'control_if_else' : 'control_if', parent)
        this.condition(id, s.condition)
        this.substack(id, 'SUBSTACK', s.then)
        if (s.else?.length) this.substack(id, 'SUBSTACK2', s.else)
        return [id]
      }
    }
  }

  /**
   * Spin in place until the hub's yaw says the robot turned far enough:
   * reset yaw → start turning → wait until |yaw| > angle → stop, repeated in
   * steps of at most GYRO_CHUNK degrees because yaw wraps at ±180°.
   */
  gyroTurn(direction: 'left' | 'right', degrees: number, parent: string): string[] {
    const ids: string[] = []
    for (const chunk of gyroChunks(degrees, this.robot)) {
      ids.push(this.add('flippersensors_resetYaw', parent))

      const start = this.add('flippermove_startSteer', parent)
      this.blocks[start].inputs.STEERING = this.shadow(start, 'flippermove_rotation-wheel', direction === 'right' ? '100' : '-100')
      ids.push(start)

      const wait = this.add('control_wait_until', parent)
      const gt = this.add('operator_gt', wait)
      const abs = this.add('operator_mathop', gt)
      const yaw = this.add('flippersensors_orientationAxis', abs)
      this.blocks[yaw].fields.AXIS = ['yaw', null]
      this.blocks[abs].inputs.NUM = [3, yaw, [NUMBER, '']]
      this.blocks[abs].fields.OPERATOR = ['abs', null]
      this.blocks[gt].inputs.OPERAND1 = [3, abs, [TEXT, '']]
      this.blocks[gt].inputs.OPERAND2 = [1, [TEXT, numStr(chunk)]]
      this.blocks[wait].inputs.CONDITION = [2, gt]
      ids.push(wait)

      ids.push(this.add('flippermove_stopMove', parent))
    }
    return ids
  }
}

/** Prefix of an opcode = the Scratch extension that defines it. */
export function extensionsOf(blocks: Record<string, ScratchBlock>): string[] {
  const core = new Set(['control', 'operator', 'data', 'event', 'procedures', 'argument', 'sensing', 'motion', 'looks', 'sound'])
  const ids = new Set<string>()
  for (const b of Object.values(blocks)) {
    const ext = b.opcode.split('_')[0]
    if (!core.has(ext)) ids.add(ext)
  }
  return [...ids].sort()
}

export function buildProject(program: Program, robot: RobotProfile = DEFAULT_ROBOT): ScratchProject {
  const b = new Builder(robot)
  const hat = b.add('flipperevents_whenProgramStarts', null, { topLevel: true, x: -130, y: 120 })

  let tail = hat
  const append = (id: string) => {
    b.blocks[id].parent = tail
    b.blocks[tail].next = id
    tail = id
  }

  // Configure the drive base first, as SPIKE's own templates do.
  if (usesOp(programSteps(program), (s) => MOVEMENT_OPS.has(s.op))) {
    const pair = b.add('flippermove_setMovementPair', tail)
    b.blocks[pair].inputs.PAIR = b.shadow(pair, 'flippermove_movement-port-selector', `${robot.leftMotor}${robot.rightMotor}`)
    append(pair)

    const cm = effectiveCmPerRotation(robot)
    if (cm !== SPIKE_DEFAULT_CM_PER_ROTATION) {
      const dist = b.add('flippermove_setDistance', tail)
      b.blocks[dist].inputs.DISTANCE = [1, [NUMBER, numStr(cm)]]
      b.blocks[dist].fields.UNIT = ['cm', null]
      append(dist)
    }
  }

  const first = b.stack(program.steps, tail)
  if (first) {
    b.blocks[tail].next = first
    b.blocks[first].parent = tail
  }

  // The program's own blocks ("My Blocks") are separate stacks next to the main one.
  ;(program.functions ?? []).forEach((fn, i) => {
    const definition = b.add('procedures_definition', null, { topLevel: true, x: 420, y: 120 + i * 320 })
    const prototype = b.add('procedures_prototype', definition, {
      shadow: true,
      mutation: { tagName: 'mutation', children: [], proccode: fn.name, argumentids: '[]', argumentnames: '[]', argumentdefaults: '[]', warp: 'false' },
    })
    b.blocks[definition].inputs.custom_block = [1, prototype]
    const body = b.stack(fn.steps, definition)
    if (body) b.blocks[definition].next = body
  })

  const costume = (name: string, x: number, y: number) => ({
    assetId: EMPTY_SVG_ASSET,
    name,
    bitmapResolution: 1,
    md5ext: `${EMPTY_SVG_ASSET}.svg`,
    dataFormat: 'svg',
    rotationCenterX: x,
    rotationCenterY: y,
  })

  const extensions = extensionsOf(b.blocks)

  return {
    targets: [
      {
        isStage: true,
        name: 'Stage',
        variables: Object.fromEntries([...b.variables].map(([name, id]) => [id, [name, 0]])),
        lists: {},
        broadcasts: {},
        blocks: {},
        comments: {},
        currentCostume: 0,
        costumes: [costume('backdrop1', 47, 55)],
        sounds: [],
        volume: 0,
        tempo: 60,
        videoTransparency: 50,
        videoState: 'on',
        textToSpeechLanguage: null,
      },
      {
        isStage: false,
        name: randomId(),
        variables: {},
        lists: {},
        broadcasts: {},
        blocks: b.blocks,
        comments: {},
        currentCostume: 0,
        costumes: [costume(randomId(), 240, 180)],
        sounds: [],
        volume: 100,
        visible: true,
        x: 0,
        y: 0,
        size: 100,
        direction: 90,
        draggable: false,
        rotationStyle: 'all around',
      },
    ],
    monitors: [],
    extensions,
    meta: { semver: '3.0.0', vm: '0.2.0', agent: 'RoboEasy' },
  }
}
