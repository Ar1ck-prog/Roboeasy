/**
 * LEGO Education WeDo 2.0 programs, as the WeDo lessons use them.
 *
 * Kept apart from the SPIKE Prime DSL (lib/dsl) on purpose: WeDo has other
 * hardware (a Smarthub with two ports, one medium motor, a motion sensor and
 * a tilt sensor) and its programs are a row of icon blocks read left to
 * right after a Start block. No "if/else": logic is "wait for a sensor" and
 * "repeat", which suits 6–9 year olds. No zod here: the browser imports it.
 */

/** Smarthub light colours, in the order of the WeDo colour numbers 0..10. */
export const WEDO_COLORS = ['off', 'pink', 'violet', 'blue', 'azure', 'teal', 'green', 'yellow', 'orange', 'red', 'white'] as const
export type WedoColor = (typeof WEDO_COLORS)[number]

export const TILT_STATES = ['up', 'down', 'left', 'right', 'flat', 'shake'] as const
export type TiltState = (typeof TILT_STATES)[number]

/** What the motion sensor reports: something came near, went far, or the distance changed. */
export const MOTION_EVENTS = ['near', 'far', 'change'] as const
export type MotionEvent = (typeof MOTION_EVENTS)[number]

export type MotorDir = 'this' | 'that'

export type WedoStep =
  | { op: 'motor_on_for'; seconds: number }
  | { op: 'motor_on' }
  | { op: 'motor_off' }
  | { op: 'motor_power'; power: number }
  | { op: 'motor_direction'; dir: MotorDir }
  | { op: 'light'; color: WedoColor }
  | { op: 'sound'; sound: number }
  | { op: 'display'; kind: 'text' | 'number'; value: string }
  | { op: 'wait'; seconds: number }
  | { op: 'wait_motion'; event: MotionEvent }
  | { op: 'wait_tilt'; state: TiltState }
  | { op: 'repeat'; times: number | 'forever'; steps: WedoStep[] }

export type WedoOp = WedoStep['op']

export const WEDO_OPS = [
  'motor_on_for',
  'motor_on',
  'motor_off',
  'motor_power',
  'motor_direction',
  'light',
  'sound',
  'display',
  'wait',
  'wait_motion',
  'wait_tilt',
  'repeat',
] as const satisfies readonly WedoOp[]

/** Block categories: each has its own colour and icon shape in the editor (not colour alone). */
export type WedoCategory = 'motor' | 'look' | 'wait' | 'flow'
export const OP_CATEGORY: Record<WedoOp, WedoCategory> = {
  motor_on_for: 'motor',
  motor_on: 'motor',
  motor_off: 'motor',
  motor_power: 'motor',
  motor_direction: 'motor',
  light: 'look',
  sound: 'look',
  display: 'look',
  wait: 'wait',
  wait_motion: 'wait',
  wait_tilt: 'wait',
  repeat: 'flow',
}

/** Limits of a program (the schema clamps numbers into them). */
export const WEDO_LIMITS = {
  seconds: { min: 0.1, max: 10 },
  power: { min: 0, max: 10, default: 8 },
  sound: { min: 1, max: 20 },
  times: { min: 2, max: 10 },
  displayChars: 12,
  maxBlocks: 20,
  maxDepth: 2,
} as const

/** A fresh block with its default parameters (palette → program). */
export function defaultStep(op: WedoOp): WedoStep {
  switch (op) {
    case 'motor_on_for':
      return { op, seconds: 1 }
    case 'motor_power':
      return { op, power: WEDO_LIMITS.power.default }
    case 'motor_direction':
      return { op, dir: 'this' }
    case 'light':
      return { op, color: 'green' }
    case 'sound':
      return { op, sound: 1 }
    case 'display':
      return { op, kind: 'text', value: 'HI' }
    case 'wait':
      return { op, seconds: 1 }
    case 'wait_motion':
      return { op, event: 'near' }
    case 'wait_tilt':
      return { op, state: 'up' }
    case 'repeat':
      return { op, times: 2, steps: [] }
    default:
      return { op } as WedoStep
  }
}

/** Blocks in a program, without the Start block; a repeat counts as one plus its contents. */
export function wedoBlocks(steps: WedoStep[]): number {
  return steps.reduce((n, s) => n + 1 + (s.op === 'repeat' ? wedoBlocks(s.steps) : 0), 0)
}

/** How many times each op is used (repeats included). */
export function opCount(steps: WedoStep[], op: WedoOp): number {
  return steps.reduce((n, s) => n + (s.op === op ? 1 : 0) + (s.op === 'repeat' ? opCount(s.steps, op) : 0), 0)
}

/** Deepest repeat nesting (0: no repeat). */
export function repeatDepth(steps: WedoStep[]): number {
  return steps.reduce((d, s) => Math.max(d, s.op === 'repeat' ? 1 + repeatDepth(s.steps) : 0), 0)
}

// ── Scenes ──────────────────────────────────────────────────────────────

export interface Localized {
  ru: string
  kk: string
  en: string
}

/** A stretch of the rover's straight track, mm from the left end. */
export interface Zone1D {
  id: string
  from: number
  to: number
  label?: Localized
}

/** Something on the track (a wall, a box): `at` is its near face, mm from the left end. */
export interface Obstacle1D {
  id: string
  at: number
  label?: Localized
}

export type SensorKind = 'motion' | 'tilt'

export type WedoScene =
  /** A rover on a straight track; `start` is where its middle stands. */
  | { model: 'rover'; length: number; start: number; sensor?: SensorKind; zones: Zone1D[]; obstacles: Obstacle1D[] }
  /** A spinner or fan; `ratio` comes from the gears or pulleys (output turns per motor turn). */
  | { model: 'spinner'; ratio: number; sensor?: SensorKind }
  /** A crane: the hook goes up and down between level 0 and `levels`, stops hard at both ends. */
  | { model: 'lift'; levels: number; mmPerTurn: number; sensor?: SensorKind }
  /** A barrier 0..90°, a toy car comes up to the motion sensor. */
  | { model: 'gate'; sensor: 'motion' }

export type WedoModel = WedoScene['model']

/** A sensor event in a lesson's scenario (the automatic check always replays it the same way). */
export type ScenarioEvent = { at: number; motion: 'near' | 'far' } | { at: number; tilt: TiltState }
