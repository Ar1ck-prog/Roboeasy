/**
 * 2D simulator: runs the same DSL programs the compilers turn into SPIKE
 * files, on a virtual differential-drive robot, with a fixed 10 ms step.
 *
 * The result (trace + events) is deterministic for a given program and
 * field, so lessons can check it automatically. Optional seeded noise
 * imitates wheel slip for "why robots miss" lessons.
 *
 * Approximations (TODO: проверить against the official LEGO Education
 * specs before quoting numbers in lessons): top speed, motor speed, sensor
 * ranges and reflection values below.
 */

import { arcPlan } from '../dsl/arcs'
import {
  type Condition,
  DEFAULT_ROBOT,
  type Expr,
  type Port,
  type ProgramFunction,
  type RobotProfile,
  type Step,
  imagePixels,
  toMatrixText,
} from '../dsl/types'
import { pointInPolygon, polygonsIntersect } from '../fll/geometry'
import type { Point } from '../fll/season'
import type { Rect, SimField } from './field'
import { ROBOT_SHAPE } from './robot'

export const DT = 0.01
/** Drive speed at 100 %, mm/s (approximate). */
export const MAX_SPEED_MM_S = 500
/** Single-motor speed at 100 %, degrees/s (approximate). */
export const MAX_MOTOR_DEG_S = 1000
export const DEFAULT_MOVE_SPEED = 50
export const DEFAULT_MOTOR_SPEED = 75
/** Longest simulated run, s. */
export const MAX_TIME = 60
/** The distance sensor sees up to this far, mm (approximate). */
export const DISTANCE_RANGE_MM = 2000
/** Stalled against a wall this long → the move command gives up. */
const STALL_S = 1

export interface Pose {
  x: number
  y: number
  heading: number
}
export interface TracePoint extends Pose {
  t: number
}

export type SimEvent =
  | { t: number; kind: 'step'; path: string }
  | { t: number; kind: 'beep'; note: number; seconds: number }
  | { t: number; kind: 'display'; pixels: string | null; text?: string }
  | { t: number; kind: 'light'; color: string }
  | { t: number; kind: 'collision'; x: number; y: number }
  | { t: number; kind: 'bump'; x: number; y: number }
  | { t: number; kind: 'sensor'; sensor: Condition['sensor']; path: string; x: number; y: number }
  | { t: number; kind: 'wait'; seconds: number; x: number; y: number }

export interface SimResult {
  trace: TracePoint[]
  events: SimEvent[]
  final: TracePoint
  /** Total angle turned by each single motor, degrees (signed: clockwise +). */
  motorAngles: Partial<Record<Port, number>>
  collisions: number
  /** The program was still running at MAX_TIME (expected for "forever"). */
  timedOut: boolean
  distanceTravelled: number
  sensorsUsed: Condition['sensor'][]
}

export interface SimOptions {
  robot?: RobotProfile
  /** 0 = ideal robot; 1 = noticeable wheel slip (seeded). */
  noise?: number
  seed?: number
  maxTime?: number
  /** The program's own blocks, for "call" steps. */
  functions?: ProgramFunction[]
}

type Drive = { kind: 'distance'; remaining: number } | { kind: 'turn'; remaining: number } | { kind: 'time'; remaining: number } | { kind: 'continuous' }

const REFLECTION: Record<string, number> = { white: 95, yellow: 80, azure: 70, red: 55, green: 45, violet: 40, blue: 35, black: 8, none: 0 }

/** Seeded PRNG (mulberry32) and a normal sample, for reproducible noise. */
function rng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let r = Math.imul(a ^ (a >>> 15), 1 | a)
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  return () => {
    const u = Math.max(1e-9, next())
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * next())
  }
}

const RAD = Math.PI / 180
const rectPoly = (r: Rect): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.w, y: r.y },
  { x: r.x + r.w, y: r.y + r.h },
  { x: r.x, y: r.y + r.h },
]

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Distance from `o` along unit direction `d` to segment a–b, or Infinity. */
function rayToSegment(o: Point, d: Point, a: Point, b: Point): number {
  const ex = b.x - a.x
  const ey = b.y - a.y
  const den = d.x * ey - d.y * ex
  if (Math.abs(den) < 1e-9) return Infinity
  const t = ((a.x - o.x) * ey - (a.y - o.y) * ex) / den
  const u = ((a.x - o.x) * d.y - (a.y - o.y) * d.x) / den
  return t >= 0 && u >= 0 && u <= 1 ? t : Infinity
}

class Engine {
  t = 0
  pose: Pose
  speed = DEFAULT_MOVE_SPEED
  vl = 0
  vr = 0
  drive: Drive | null = null
  blockedFor = 0
  contact = false
  bumped = false
  yawRef: number
  motorSpeed: Partial<Record<Port, number>> = {}
  motorVel: Partial<Record<Port, number>> = {}
  motorTarget: Partial<Record<Port, number>> = {}
  motorAngle: Partial<Record<Port, number>> = {}
  events: SimEvent[] = []
  trace: TracePoint[] = []
  travelled = 0
  sensors = new Set<Condition['sensor']>()
  variables = new Map<string, number>()
  functions = new Map<string, Step[]>()
  private tick = 0
  private wasMoving = false
  private readonly walls: Point[][]
  private readonly normal: () => number

  constructor(
    readonly field: SimField,
    readonly robot: RobotProfile,
    readonly noise: number,
    seed: number,
  ) {
    this.pose = { ...field.start }
    this.yawRef = field.start.heading
    this.walls = field.walls.map(rectPoly)
    this.normal = rng(seed)
    this.record()
  }

  get circumference() {
    return Math.PI * this.robot.wheelDiameterMm
  }

  record() {
    this.trace.push({ t: Math.round(this.t * 1000) / 1000, x: this.pose.x, y: this.pose.y, heading: this.pose.heading })
  }

  body(pose: Pose): Point[] {
    const c = Math.cos(pose.heading * RAD)
    const s = Math.sin(pose.heading * RAD)
    const hl = ROBOT_SHAPE.length / 2
    const hw = ROBOT_SHAPE.width / 2
    return [
      [hl, hw],
      [hl, -hw],
      [-hl, -hw],
      [-hl, hw],
    ].map(([a, b]) => ({ x: pose.x + a * c - b * s, y: pose.y + a * s + b * c }))
  }

  ahead(mm: number, pose: Pose = this.pose): Point {
    return { x: pose.x + Math.cos(pose.heading * RAD) * mm, y: pose.y + Math.sin(pose.heading * RAD) * mm }
  }

  blocked(pose: Pose): boolean {
    const body = this.body(pose)
    if (this.field.border && body.some((p) => p.x < 0 || p.y < 0 || p.x > this.field.width || p.y > this.field.height)) return true
    return this.walls.some((w) => polygonsIntersect(body, w))
  }

  /** Noise factor for one command (1 = exact). */
  slip(spread: number) {
    return this.noise > 0 ? 1 + this.normal() * spread * this.noise : 1
  }

  // ── Sensors ─────────────────────────────────────────────────────────

  colorAt(p: Point): string {
    if (p.x < 0 || p.y < 0 || p.x > this.field.width || p.y > this.field.height) return 'none'
    for (let i = this.field.lines.length - 1; i >= 0; i--) {
      const line = this.field.lines[i]
      for (let j = 1; j < line.points.length; j++) {
        const [ax, ay] = line.points[j - 1]
        const [bx, by] = line.points[j]
        if (distToSegment(p, { x: ax, y: ay }, { x: bx, y: by }) <= line.width / 2) return line.color
      }
    }
    for (let i = this.field.zones.length - 1; i >= 0; i--) {
      const z = this.field.zones[i]
      if (z.color && p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return z.color
    }
    return 'white'
  }

  color() {
    return this.colorAt(this.ahead(ROBOT_SHAPE.colorSensorAhead))
  }

  /** Distance to the nearest wall straight ahead, mm, or null when nothing is in range. */
  distance(): number | null {
    const o = this.ahead(ROBOT_SHAPE.distanceSensorAhead)
    const d = { x: Math.cos(this.pose.heading * RAD), y: Math.sin(this.pose.heading * RAD) }
    let best = Infinity
    const edges = (poly: Point[]) => poly.forEach((a, i) => (best = Math.min(best, rayToSegment(o, d, a, poly[(i + 1) % poly.length]))))
    this.walls.forEach(edges)
    if (this.field.border) edges(rectPoly({ x: 0, y: 0, w: this.field.width, h: this.field.height }))
    return best <= DISTANCE_RANGE_MM ? best : null
  }

  check(c: Condition): boolean {
    this.sensors.add(c.sensor)
    const cmp = (v: number, op: string, x: number, tol: number) => (op === '<' ? v < x : op === '>' ? v > x : Math.abs(v - x) <= tol)
    switch (c.sensor) {
      case 'distance': {
        const mm = this.distance()
        if (mm === null) return false
        const v = c.unit === 'inches' ? mm / 25.4 : c.unit === '%' ? (mm / DISTANCE_RANGE_MM) * 100 : mm / 10
        return cmp(v, c.comparator, c.value, 1)
      }
      case 'color':
        return this.color() === c.color
      case 'reflection':
        return cmp(REFLECTION[this.color()] ?? 0, c.comparator, c.value, 2)
      case 'force':
        return c.state === 'released' ? !this.bumped : this.bumped
      case 'button':
        return c.state === 'released'
      case 'gyro': {
        if (c.axis !== 'yaw') return cmp(0, c.comparator, c.value, 2)
        const yaw = ((((this.yawRef - this.pose.heading) % 360) + 540) % 360) - 180
        return cmp(yaw, c.comparator, c.value, 2)
      }
      case 'var':
        return cmp(this.variables.get(c.name) ?? 0, c.comparator, c.value, 0.001)
    }
  }

  evaluate(e: Expr): number {
    if ('num' in e) return e.num
    if ('var' in e) return this.variables.get(e.var) ?? 0
    const a = this.evaluate(e.a)
    const b = this.evaluate(e.b)
    if (e.op === '+') return a + b
    if (e.op === '-') return a - b
    if (e.op === '*') return a * b
    return b === 0 ? 0 : a / b
  }

  // ── Physics ─────────────────────────────────────────────────────────

  step() {
    let frac = 1
    const d = this.drive
    const vMax = Math.max(Math.abs(this.vl), Math.abs(this.vr))
    const omega = (this.vr - this.vl) / this.robot.trackWidthMm / RAD // deg/s
    if (d?.kind === 'distance' && vMax > 0) frac = Math.min(1, d.remaining / (vMax * DT))
    if (d?.kind === 'turn' && omega !== 0) frac = Math.min(1, d.remaining / (Math.abs(omega) * DT))
    if (d?.kind === 'time') frac = Math.min(1, d.remaining / DT)
    const dt = DT * Math.max(0, frac)

    const v = (this.vl + this.vr) / 2
    const heading = this.pose.heading + omega * dt
    const mid = (this.pose.heading + heading) / 2
    const next: Pose = { x: this.pose.x + Math.cos(mid * RAD) * v * dt, y: this.pose.y + Math.sin(mid * RAD) * v * dt, heading }
    const moving = v !== 0 || omega !== 0
    // Pin the pose where motion starts, so playback holds still during pauses.
    if (moving && !this.wasMoving) this.record()

    if (moving && this.blocked(next)) {
      if (!this.contact) {
        this.events.push({ t: this.t, kind: 'collision', x: this.pose.x, y: this.pose.y })
        const front = this.ahead(ROBOT_SHAPE.bumperAhead + 4, next)
        if (
          this.walls.some((w) => pointInPolygon(front, w)) ||
          (this.field.border && (front.x < 0 || front.y < 0 || front.x > this.field.width || front.y > this.field.height))
        ) {
          this.bumped = true
          this.events.push({ t: this.t, kind: 'bump', x: this.pose.x, y: this.pose.y })
        }
      }
      this.contact = true
      this.blockedFor += DT
      if (d && d.kind !== 'continuous' && this.blockedFor >= STALL_S) this.stopDrive()
    } else {
      if (moving) {
        this.contact = false
        this.bumped = false
        this.blockedFor = 0
      }
      this.travelled += Math.abs(v * dt)
      this.pose = next
      if (d?.kind === 'distance') d.remaining -= vMax * dt
      if (d?.kind === 'turn') d.remaining -= Math.abs(omega) * dt
    }
    if (d?.kind === 'time') d.remaining -= dt
    if (d && d.kind !== 'continuous' && d.remaining <= 1e-6) this.stopDrive()

    for (const port of Object.keys(this.motorVel) as Port[]) {
      const vel = this.motorVel[port] ?? 0
      if (!vel) continue
      let delta = vel * DT
      const target = this.motorTarget[port]
      if (target !== undefined) {
        const left = target - (this.motorAngle[port] ?? 0)
        if (Math.abs(delta) >= Math.abs(left)) {
          delta = left
          this.motorVel[port] = 0
          delete this.motorTarget[port]
        }
      }
      this.motorAngle[port] = (this.motorAngle[port] ?? 0) + delta
    }

    this.t += DT
    this.tick++
    if ((moving && this.tick % 2 === 0) || moving !== this.wasMoving) this.record()
    this.wasMoving = moving
  }

  stopDrive() {
    this.drive = null
    this.vl = 0
    this.vr = 0
  }

  // ── Commands (generators: each `yield` is one physics step) ───────

  wheel(direction: 'forward' | 'back') {
    return ((direction === 'forward' ? 1 : -1) * this.speed * MAX_SPEED_MM_S) / 100
  }

  *waitDrive(): Generator<void> {
    while (this.drive) yield
  }

  distanceMm(value: number, unit: string): number {
    switch (unit) {
      case 'cm':
        return value * 10
      case 'inches':
        return value * 25.4
      case 'rotations':
        return value * this.circumference
      case 'degrees':
        return (value / 360) * this.circumference
      default:
        return 0
    }
  }

  *exec(steps: Step[], path: string): Generator<void> {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const here = path ? `${path}.${i}` : String(i)
      this.events.push({ t: this.t, kind: 'step', path: here })
      yield* this.one(s, here)
    }
  }

  *loopBody(steps: Step[], path: string): Generator<void> {
    yield* this.exec(steps, path)
    yield // every iteration takes at least one step, so loops always advance time
  }

  *one(s: Step, path: string): Generator<void> {
    switch (s.op) {
      case 'move': {
        const v = this.wheel(s.direction)
        this.vl = this.vr = v
        if (s.unit === 'seconds') this.drive = { kind: 'time', remaining: s.value }
        else this.drive = { kind: 'distance', remaining: this.distanceMm(s.value, s.unit) * this.slip(0.03) }
        yield* this.waitDrive()
        return
      }
      case 'turn': {
        const v = (this.speed * MAX_SPEED_MM_S) / 100
        const sign = s.direction === 'left' ? 1 : -1
        this.vl = -v * sign
        this.vr = v * sign
        this.drive = { kind: 'turn', remaining: s.degrees * this.slip(0.04) }
        yield* this.waitDrive()
        return
      }
      case 'steer': {
        const outer = (this.speed * MAX_SPEED_MM_S) / 100
        const inner = outer * (1 - Math.abs(s.steering) / 50)
        if (s.steering >= 0) [this.vl, this.vr] = [outer, inner]
        else [this.vl, this.vr] = [inner, outer]
        if (s.unit === 'seconds') this.drive = { kind: 'time', remaining: s.value }
        else this.drive = { kind: 'distance', remaining: this.distanceMm(s.value, s.unit) * this.slip(0.03) }
        yield* this.waitDrive()
        return
      }
      case 'start_move': {
        const v = (this.speed * MAX_SPEED_MM_S) / 100
        if (s.direction === 'forward') [this.vl, this.vr] = [v, v]
        else if (s.direction === 'back') [this.vl, this.vr] = [-v, -v]
        else if (s.direction === 'left') [this.vl, this.vr] = [-v, v]
        else [this.vl, this.vr] = [v, -v]
        this.drive = { kind: 'continuous' }
        return
      }
      case 'start_steer': {
        const outer = (this.speed * MAX_SPEED_MM_S) / 100
        const inner = outer * (1 - Math.abs(s.steering) / 50)
        ;[this.vl, this.vr] = s.steering >= 0 ? [outer, inner] : [inner, outer]
        this.drive = { kind: 'continuous' }
        return
      }
      case 'stop_move':
        this.stopDrive()
        return
      case 'set_speed':
        this.speed = s.speed
        if (this.drive?.kind === 'continuous') {
          const k = s.speed / Math.max(1, Math.max(Math.abs(this.vl), Math.abs(this.vr)) / (MAX_SPEED_MM_S / 100))
          this.vl *= k
          this.vr *= k
        }
        return
      case 'reset_yaw':
        this.yawRef = this.pose.heading
        return
      case 'set_movement_motors':
        return
      case 'motor_run':
      case 'motor_start': {
        const pct = this.motorSpeed[s.port] ?? DEFAULT_MOTOR_SPEED
        const vel = ((s.direction === 'clockwise' ? 1 : -1) * pct * MAX_MOTOR_DEG_S) / 100
        if (this.isDrive(s.port)) {
          // A single drive wheel: the robot pivots around the other one.
          const forward = s.port === this.robot.rightMotor ? vel > 0 : vel < 0
          const mm = (Math.abs(vel) / 360) * this.circumference * (forward ? 1 : -1)
          if (s.port === this.robot.leftMotor) this.vl = mm
          else this.vr = mm
        }
        this.motorVel[s.port] = vel
        if (s.op === 'motor_start') return
        const now = this.motorAngle[s.port] ?? 0
        if (s.unit === 'seconds') {
          const end = this.t + s.value
          while (this.t < end - 1e-9) yield
          this.motorVel[s.port] = 0
        } else {
          const deg = s.unit === 'rotations' ? s.value * 360 : s.value
          this.motorTarget[s.port] = now + Math.sign(vel) * deg
          if (this.isDrive(s.port)) this.drive = { kind: 'distance', remaining: (deg / 360) * this.circumference }
          while (this.motorTarget[s.port] !== undefined) yield
        }
        if (this.isDrive(s.port)) this.stopDrive()
        return
      }
      case 'motor_stop':
        this.motorVel[s.port] = 0
        delete this.motorTarget[s.port]
        if (this.isDrive(s.port)) this.stopDrive()
        return
      case 'motor_speed':
        this.motorSpeed[s.port] = s.speed
        return
      case 'motor_to_position': {
        const now = this.motorAngle[s.port] ?? 0
        const pos = ((now % 360) + 360) % 360
        let delta = s.position - pos
        if (s.direction === 'clockwise') delta = ((delta % 360) + 360) % 360
        else if (s.direction === 'counterclockwise') delta = -(((-delta % 360) + 360) % 360)
        else if (delta > 180) delta -= 360
        else if (delta < -180) delta += 360
        if (Math.abs(delta) < 0.5) return
        const pct = this.motorSpeed[s.port] ?? DEFAULT_MOTOR_SPEED
        this.motorVel[s.port] = (Math.sign(delta) * pct * MAX_MOTOR_DEG_S) / 100
        this.motorTarget[s.port] = now + delta
        while (this.motorTarget[s.port] !== undefined) yield
        return
      }
      case 'show_image':
        this.events.push({ t: this.t, kind: 'display', pixels: imagePixels(s.image) })
        if (s.seconds) {
          yield* this.waitTime(s.seconds)
          this.events.push({ t: this.t, kind: 'display', pixels: null })
        }
        return
      case 'write':
        this.events.push({ t: this.t, kind: 'display', pixels: null, text: toMatrixText(s.text) })
        return
      case 'clear_display':
        this.events.push({ t: this.t, kind: 'display', pixels: null })
        return
      case 'beep':
        this.events.push({ t: this.t, kind: 'beep', note: s.note, seconds: s.seconds })
        yield* this.waitTime(s.seconds)
        return
      case 'button_light':
        this.events.push({ t: this.t, kind: 'light', color: s.color })
        return
      case 'wait':
        this.events.push({ t: this.t, kind: 'wait', seconds: s.seconds, x: this.pose.x, y: this.pose.y })
        yield* this.waitTime(s.seconds)
        return
      case 'wait_until':
        while (!this.check(s.condition)) yield
        this.sensorEvent(s.condition, path)
        return
      case 'repeat':
        for (let i = 0; i < s.times; i++) yield* this.loopBody(s.steps, path)
        return
      case 'forever':
        for (;;) yield* this.loopBody(s.steps, path)
      case 'repeat_until':
        while (!this.check(s.condition)) yield* this.loopBody(s.steps, path)
        this.sensorEvent(s.condition, path)
        return
      case 'while':
        while (this.check(s.condition)) yield* this.loopBody(s.steps, path)
        this.sensorEvent(s.condition, path)
        return
      case 'arc':
      case 'circle': {
        const plan = arcPlan(s.direction, s.radius, s.op === 'circle' ? 360 * s.turns : s.degrees, this.robot)
        const outer = (this.speed * MAX_SPEED_MM_S) / 100
        const inner = outer * (1 - Math.abs(plan.steering) / 50)
        ;[this.vl, this.vr] = s.direction === 'right' ? [outer, inner] : [inner, outer]
        this.drive = { kind: 'distance', remaining: plan.steeringOuterCm * 10 * this.slip(0.03) }
        yield* this.waitDrive()
        return
      }
      case 'tank': {
        this.vl = (s.leftSpeed * MAX_SPEED_MM_S) / 100
        this.vr = (s.rightSpeed * MAX_SPEED_MM_S) / 100
        if (s.unit === 'seconds') this.drive = { kind: 'time', remaining: s.value }
        else this.drive = { kind: 'distance', remaining: this.distanceMm(s.value, s.unit) * this.slip(0.03) }
        yield* this.waitDrive()
        return
      }
      case 'move_expr': {
        const v = this.wheel(s.direction)
        this.vl = this.vr = v
        const value = Math.abs(this.evaluate(s.expr))
        if (s.unit === 'seconds') this.drive = { kind: 'time', remaining: value }
        else this.drive = { kind: 'distance', remaining: this.distanceMm(value, s.unit) * this.slip(0.03) }
        yield* this.waitDrive()
        return
      }
      case 'set_var':
        this.variables.set(s.name, this.evaluate(s.expr))
        return
      case 'change_var':
        this.variables.set(s.name, (this.variables.get(s.name) ?? 0) + this.evaluate(s.expr))
        return
      case 'write_var':
        this.events.push({ t: this.t, kind: 'display', pixels: null, text: String(this.variables.get(s.name) ?? 0) })
        return
      case 'call':
        yield* this.exec(this.functions.get(s.name) ?? [], `${path}.call`)
        return
      case 'if':
        if (this.check(s.condition)) {
          this.sensorEvent(s.condition, path)
          yield* this.exec(s.then, `${path}.then`)
        } else if (s.else) yield* this.exec(s.else, `${path}.else`)
        return
    }
  }

  *waitTime(seconds: number): Generator<void> {
    const end = this.t + seconds
    while (this.t < end - 1e-9) yield
  }

  sensorEvent(c: Condition, path: string) {
    this.events.push({ t: this.t, kind: 'sensor', sensor: c.sensor, path, x: this.pose.x, y: this.pose.y })
  }

  isDrive(port: Port) {
    return port === this.robot.leftMotor || port === this.robot.rightMotor
  }
}

/** Runs a program on the field and returns the full trace and events. */
export function simulate(steps: Step[], field: SimField, options: SimOptions = {}): SimResult {
  const robot = options.robot ?? DEFAULT_ROBOT
  const engine = new Engine(field, robot, options.noise ?? 0, options.seed ?? 1)
  for (const fn of options.functions ?? []) engine.functions.set(fn.name, fn.steps)
  const maxTime = options.maxTime ?? MAX_TIME
  const program = engine.exec(steps, '')
  let done = false
  let timedOut = false
  while (!done) {
    if (engine.t >= maxTime - 1e-9) {
      timedOut = true
      break
    }
    done = program.next().done === true
    if (!done) engine.step()
  }
  // The program ends: SPIKE stops the motors.
  engine.stopDrive()
  engine.record()
  const final = engine.trace[engine.trace.length - 1]
  return {
    trace: engine.trace,
    events: engine.events,
    final,
    motorAngles: engine.motorAngle,
    collisions: engine.events.filter((e) => e.kind === 'collision').length,
    timedOut,
    distanceTravelled: engine.travelled,
    sensorsUsed: [...engine.sensors],
  }
}

/** Pose at time t (linear interpolation along the trace), for playback. */
export function poseAt(trace: TracePoint[], t: number): Pose {
  if (t <= trace[0].t) return trace[0]
  const last = trace[trace.length - 1]
  if (t >= last.t) return last
  let lo = 0
  let hi = trace.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (trace[mid].t <= t) lo = mid
    else hi = mid
  }
  const a = trace[lo]
  const b = trace[hi]
  const k = (t - a.t) / (b.t - a.t || 1)
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, heading: a.heading + (b.heading - a.heading) * k }
}

/** What the hub's display shows at time t (null = blank). */
export function displayAt(events: SimEvent[], t: number): { pixels: string | null; text?: string } {
  let current: { pixels: string | null; text?: string } = { pixels: null }
  for (const e of events) {
    if (e.t > t) break
    if (e.kind === 'display') current = { pixels: e.pixels, text: e.text }
  }
  return current
}

/** The step running at time t, as a path like "2.0" (for highlighting). */
export function stepAt(events: SimEvent[], t: number): string | null {
  let current: string | null = null
  for (const e of events) {
    if (e.t > t) break
    if (e.kind === 'step') current = e.path
  }
  return current
}
