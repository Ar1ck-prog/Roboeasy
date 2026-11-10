/**
 * RoboEasy DSL: the small, validated command language the AI produces.
 * The AI never writes Scratch JSON or (by default) Python itself: our
 * deterministic compilers turn these commands into LEGO SPIKE App 3 word
 * blocks (./compile-blocks.ts) and SPIKE 3 MicroPython (./compile-python.ts).
 *
 * The AI output is untrusted: `parseProgram` in ./schema.ts validates it
 * (strict structure, clamped numbers), so whatever reaches the file
 * generator is always a structurally valid program.
 */

export const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type Port = (typeof PORTS)[number]

/** Bump when programs change meaning: cached answers from older versions stop being used. */
export const DSL_VERSION = 2

export type MoveUnit = 'cm' | 'inches' | 'rotations' | 'degrees' | 'seconds'
export type MotorUnit = 'rotations' | 'degrees' | 'seconds'
export type Comparator = '<' | '>' | '='
export type MotorDirection = 'clockwise' | 'counterclockwise'
export type PositionDirection = 'shortest' | 'clockwise' | 'counterclockwise'

/** Colors the SPIKE color sensor reports, with their SPIKE App field values. */
export const SENSOR_COLORS = {
  black: '0',
  violet: '1',
  blue: '3',
  azure: '4',
  green: '6',
  yellow: '7',
  red: '9',
  white: '10',
  none: '-1',
} as const
export type SensorColor = keyof typeof SENSOR_COLORS

/** Colors of the hub's power-button light (same numbering as the sensor). */
export const LIGHT_COLORS = {
  off: '0',
  violet: '1',
  blue: '3',
  azure: '4',
  green: '6',
  yellow: '7',
  orange: '8',
  red: '9',
  white: '10',
} as const
export type LightColor = keyof typeof LIGHT_COLORS

/** Named 5x5 images (brightness 0-9 per pixel, row by row). */
export const IMAGES = {
  smile: '9909999099000009000909990',
  sad: '9909999099000000999090009',
  heart: '0909099999999990999000900',
  heart_small: '0000009090099900090000000',
  surprised: '0909000000009000909000900',
  arrow_up: '0090009990909090090000900',
  arrow_down: '0090000900909090999000900',
  arrow_left: '0090009000999990900000900',
  arrow_right: '0090000090999990009000900',
  yes: '0000000009000909090009000',
  no: '9000909090009000909090009',
  square: '9999990009900099000999999',
  diamond: '0090009090900090909000900',
} as const
export type ImageName = keyof typeof IMAGES

export type Condition =
  | { sensor: 'distance'; port: Port; comparator: Comparator; value: number; unit: 'cm' | 'inches' | '%' }
  | { sensor: 'color'; port: Port; color: SensorColor }
  | { sensor: 'reflection'; port: Port; comparator: Comparator; value: number }
  | { sensor: 'force'; port: Port; state: 'pressed' | 'released' | 'hardpressed' }
  | { sensor: 'button'; button: 'left' | 'right'; state: 'pressed' | 'released' }
  /** Hub tilt in degrees; yaw grows when the robot turns right. */
  | { sensor: 'gyro'; axis: 'yaw' | 'pitch' | 'roll'; comparator: Comparator; value: number }
  | { sensor: 'var'; name: string; comparator: Comparator; value: number }

/** A number computed while the program runs. */
export type Expr = { num: number } | { var: string } | { op: '+' | '-' | '*' | '/'; a: Expr; b: Expr }

export type Step =
  | { op: 'move'; direction: 'forward' | 'back'; value: number; unit: MoveUnit }
  /** Spin in place by an angle, controlled by the hub's gyro (yaw). */
  | { op: 'turn'; direction: 'left' | 'right'; degrees: number }
  | { op: 'reset_yaw' }
  | { op: 'set_movement_motors'; left: Port; right: Port }
  | { op: 'steer'; steering: number; value: number; unit: MoveUnit }
  | { op: 'start_move'; direction: 'forward' | 'back' | 'left' | 'right' }
  | { op: 'start_steer'; steering: number }
  | { op: 'stop_move' }
  | { op: 'set_speed'; speed: number }
  | { op: 'motor_run'; port: Port; direction: MotorDirection; value: number; unit: MotorUnit }
  | { op: 'motor_start'; port: Port; direction: MotorDirection }
  | { op: 'motor_stop'; port: Port }
  | { op: 'motor_speed'; port: Port; speed: number }
  /** Single motor to an absolute position (0-359°). */
  | { op: 'motor_to_position'; port: Port; position: number; direction: PositionDirection }
  | { op: 'show_image'; image: string; seconds?: number }
  | { op: 'write'; text: string }
  | { op: 'clear_display' }
  | { op: 'beep'; note: number; seconds: number }
  | { op: 'button_light'; color: LightColor }
  | { op: 'wait'; seconds: number }
  | { op: 'wait_until'; condition: Condition }
  | { op: 'repeat'; times: number; steps: Step[] }
  | { op: 'forever'; steps: Step[] }
  | { op: 'repeat_until'; condition: Condition; steps: Step[] }
  | { op: 'if'; condition: Condition; then: Step[]; else?: Step[] }
  /** Drive along part of a circle; the wheel speeds are computed from the track width. */
  | { op: 'arc'; direction: 'left' | 'right'; radius: number; degrees: number }
  | { op: 'circle'; direction: 'left' | 'right'; radius: number; turns: number }
  /** Separate speeds (%) for the left and right drive motors. */
  | { op: 'tank'; leftSpeed: number; rightSpeed: number; value: number; unit: MoveUnit }
  /** "move" with a distance computed while the program runs. */
  | { op: 'move_expr'; direction: 'forward' | 'back'; expr: Expr; unit: MoveUnit }
  | { op: 'while'; condition: Condition; steps: Step[] }
  | { op: 'set_var'; name: string; expr: Expr }
  | { op: 'change_var'; name: string; expr: Expr }
  | { op: 'write_var'; name: string }
  /** Runs one of the program's own blocks ("My Blocks"). */
  | { op: 'call'; name: string }

export type StepOp = Step['op']

/** A named block of commands, like "My Blocks" in the SPIKE App. */
export interface ProgramFunction {
  name: string
  steps: Step[]
}

export interface Program {
  title: string
  description: string
  steps: Step[]
  functions?: ProgramFunction[]
}

export const ATTACHMENT_KINDS = ['arm', 'lift', 'gripper', 'pusher', 'other'] as const
export type AttachmentKind = (typeof ATTACHMENT_KINDS)[number]

/** A motorized attachment (FLL tool) on one port. */
export interface Attachment {
  port: Port
  kind: AttachmentKind
  name: string
}

/** The robot the programs are compiled for. Stored in localStorage (see lib/studio-state.ts). */
export interface RobotProfile {
  leftMotor: Port
  rightMotor: Port
  distanceSensor: Port
  colorSensor: Port
  forceSensor: Port
  /** Wheel diameter in mm (SPIKE Prime standard wheel: 56). */
  wheelDiameterMm: number
  /** Distance between the two drive wheels in mm. */
  trackWidthMm: number
  /** Calibration: commanded ÷ measured distance (1 = drives exactly). */
  distanceFactor: number
  /** Calibration: commanded ÷ measured turn angle (1 = turns exactly). */
  turnFactor: number
  attachments: Attachment[]
}

export const DEFAULT_ROBOT: RobotProfile = {
  leftMotor: 'A',
  rightMotor: 'B',
  distanceSensor: 'C',
  colorSensor: 'D',
  forceSensor: 'E',
  wheelDiameterMm: 56,
  trackWidthMm: 112,
  distanceFactor: 1,
  turnFactor: 1,
  attachments: [],
}

/** SPIKE's own default for "set 1 motor rotation to … cm moved". */
export const SPIKE_DEFAULT_CM_PER_ROTATION = 17.5

export const LIMITS = {
  maxSteps: 60,
  maxDepth: 4,
  maxTitle: 60,
  maxDescription: 400,
  maxText: 40,
  maxVariables: 8,
  maxFunctions: 6,
}

/** Names that would clash with the compiled Python: its keywords, modules and our own helpers. */
export const RESERVED_NAMES: ReadonlySet<string> = new Set([
  'False',
  'None',
  'True',
  'and',
  'as',
  'assert',
  'async',
  'await',
  'break',
  'class',
  'continue',
  'def',
  'del',
  'elif',
  'else',
  'except',
  'finally',
  'for',
  'from',
  'global',
  'if',
  'import',
  'in',
  'is',
  'lambda',
  'nonlocal',
  'not',
  'or',
  'pass',
  'raise',
  'return',
  'try',
  'while',
  'with',
  'yield',
  'abs',
  'int',
  'str',
  'min',
  'max',
  'range',
  'print',
  'main',
  'turn',
  'speed',
  'motor_speed',
  'port',
  'hub',
  'runloop',
  'motor',
  'motor_pair',
  'distance_sensor',
  'color_sensor',
  'color',
  'force_sensor',
  'light_matrix',
  'light',
  'sound',
  'button',
  'motion_sensor',
  'distance_mm',
  'distance_cm',
  'distance_inches',
  'distance_percent',
  'TURN_FACTOR',
])

/** Ops that run the drive base; used to decide whether to emit the motor-pair setup. */
export const MOVEMENT_OPS: ReadonlySet<StepOp> = new Set([
  'move',
  'turn',
  'steer',
  'start_move',
  'start_steer',
  'stop_move',
  'set_speed',
  'set_movement_motors',
  'arc',
  'circle',
  'tank',
  'move_expr',
])

/** Largest angle turned in one gyro step: the yaw reading wraps at ±180°. */
export const GYRO_CHUNK = 90

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function cmPerRotation(robot: RobotProfile): number {
  return Math.round(((Math.PI * robot.wheelDiameterMm) / 10) * 10) / 10
}

/**
 * Distance per wheel rotation the program actually uses, calibration
 * included: SPIKE's default (17.5 cm) unless the wheel or the calibration is
 * noticeably different, in which case the block program sets it explicitly.
 * Python uses the same value.
 */
export function effectiveCmPerRotation(robot: RobotProfile): number {
  const cm = Math.round((cmPerRotation(robot) / robot.distanceFactor) * 10) / 10
  return Math.abs(cm - SPIKE_DEFAULT_CM_PER_ROTATION) < 0.2 ? SPIKE_DEFAULT_CM_PER_ROTATION : cm
}

/** Gyro targets for one turn: calibrated angle split into steps of at most GYRO_CHUNK degrees. */
export function gyroChunks(degrees: number, robot: RobotProfile): number[] {
  let left = Math.round(degrees * robot.turnFactor * 10) / 10
  const chunks: number[] = []
  while (left > 0.05) {
    const chunk = Math.min(GYRO_CHUNK, left)
    chunks.push(Math.round(chunk * 10) / 10)
    left -= chunk
  }
  return chunks
}

export function imagePixels(image: string): string {
  return image in IMAGES ? IMAGES[image as ImageName] : image
}

/** Every top-level list of a program: the main one and those of its own blocks. */
export function programSteps(program: Pick<Program, 'steps' | 'functions'>): Step[] {
  return [...program.steps, ...(program.functions ?? []).flatMap((f) => f.steps)]
}

export function countSteps(steps: Step[]): number {
  let n = 0
  for (const step of steps) {
    n += 1
    for (const child of childLists(step)) n += countSteps(child)
  }
  return n
}

export function childLists(step: Step): Step[][] {
  switch (step.op) {
    case 'repeat':
    case 'forever':
    case 'repeat_until':
    case 'while':
      return [step.steps]
    case 'if':
      return step.else ? [step.then, step.else] : [step.then]
    default:
      return []
  }
}

export function usesOp(steps: Step[], predicate: (step: Step) => boolean): boolean {
  return steps.some((s) => predicate(s) || childLists(s).some((c) => usesOp(c, predicate)))
}

export function conditionsOf(steps: Step[]): Condition[] {
  const out: Condition[] = []
  const walk = (list: Step[]) => {
    for (const s of list) {
      if (s.op === 'wait_until' || s.op === 'repeat_until' || s.op === 'if' || s.op === 'while') out.push(s.condition)
      childLists(s).forEach(walk)
    }
  }
  walk(steps)
  return out
}

/** Variable names an expression reads. */
export function exprVars(e: Expr): string[] {
  if ('var' in e) return [e.var]
  return 'op' in e ? [...exprVars(e.a), ...exprVars(e.b)] : []
}

/** Every variable a list of steps reads or writes. */
export function variablesOf(steps: Step[]): string[] {
  const names = new Set<string>()
  const walk = (list: Step[]) => {
    for (const s of list) {
      if (s.op === 'set_var' || s.op === 'change_var' || s.op === 'write_var') names.add(s.name)
      if (s.op === 'set_var' || s.op === 'change_var' || s.op === 'move_expr') exprVars(s.expr).forEach((n) => names.add(n))
      childLists(s).forEach(walk)
    }
  }
  walk(steps)
  for (const c of conditionsOf(steps)) if (c.sensor === 'var') names.add(c.name)
  return [...names]
}

// ---------------------------------------------------------------------------
// Display text
// ---------------------------------------------------------------------------

const CYRILLIC_TO_LATIN: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'e',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'i',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'h',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'sch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  ә: 'a',
  ғ: 'g',
  қ: 'q',
  ң: 'n',
  ө: 'o',
  ұ: 'u',
  ү: 'u',
  һ: 'h',
  і: 'i',
}

/** The hub's 5x5 display only has Latin glyphs, so Cyrillic text is transliterated. */
export function toMatrixText(s: string): string {
  let out = ''
  for (const ch of s) {
    const lower = ch.toLowerCase()
    const mapped = CYRILLIC_TO_LATIN[lower]
    if (mapped === undefined) out += ch
    else out += ch === lower ? mapped : mapped.charAt(0).toUpperCase() + mapped.slice(1)
  }
  // Keep printable ASCII only.
  return out
    .replace(/[^\x20-\x7e]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}
