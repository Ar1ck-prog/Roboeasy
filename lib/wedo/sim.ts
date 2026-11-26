/**
 * WeDo 2.0 simulator: runs a WeDo program on one of the lesson scenes
 * (rover, spinner, crane, barrier) with a fixed 10 ms step. Same idea as
 * the SPIKE simulator (lib/sim/interpreter.ts), separate code: nothing here
 * imports the SPIKE DSL.
 *
 * The program runs as a generator: every `yield` lets one tick pass, so the
 * same code serves the automatic check (scripted sensor events, always the
 * same result) and the live mode where the child brings a hand close or
 * tilts the sensor.
 */

import type { MotorDir, ScenarioEvent, TiltState, WedoColor, WedoScene, WedoStep } from './types'

export const DT = 0.01
/** Longest run, s; `repeat forever` stops here. */
export const MAX_TIME = 30

// Approximate numbers (приблизительно): close to a real WeDo 2.0 build, not measured.
/** Rover speed per power unit, mm/s (приблизительно). */
export const ROVER_MM_S_PER_POWER = 25
/** Medium motor speed per power unit, turns per minute (приблизительно). */
export const MOTOR_RPM_PER_POWER = 30
/** The motion sensor says "near" at this distance or closer, mm (приблизительно). */
export const NEAR_MM = 100
/** …and "far" beyond this distance, mm; in between it keeps what it said (приблизительно). */
export const FAR_MM = 150
/** Rover body length, mm (the sensor sits at the front). */
export const ROVER_LENGTH = 120
/** Height between crane levels, mm. */
export const LEVEL_MM = 100
/** Barrier arm degrees per motor degree (a slow worm drive, приблизительно). */
export const GATE_RATIO = 0.05
/** A sound block plays this long before the next block starts, s. */
export const SOUND_SECONDS = 0.5
/** A shake lasts this long, then the tilt sensor is flat again, s. */
export const SHAKE_SECONDS = 0.5
/** After the program ends, a blocked motor gives up after this long, s. */
const STALL_SECONDS = 0.3
const MAX_EVENTS = 4000

export const DEFAULT_POWER = 8

export interface WedoFrame {
  t: number
  /** Rover: middle of the body, mm from the left end of the track. */
  x: number
  /** Spinner angle, degrees (grows in the "this" direction). */
  angle: number
  /** Crane hook height, mm. */
  height: number
  /** Barrier arm, 0 (closed) … 90 (open) degrees. */
  gate: number
  motor: boolean
  motion: 'near' | 'far'
  tilt: TiltState
}

export type WedoEvent =
  | { t: number; kind: 'motor'; on: boolean; power: number; dir: MotorDir }
  | { t: number; kind: 'light'; color: WedoColor }
  | { t: number; kind: 'sound'; sound: number }
  | { t: number; kind: 'display'; mode: 'text' | 'number'; value: string }
  | { t: number; kind: 'sensor'; sensor: 'motion'; state: 'near' | 'far' }
  | { t: number; kind: 'sensor'; sensor: 'tilt'; state: TiltState }
  | { t: number; kind: 'step'; path: string }
  | { t: number; kind: 'crash'; x: number }

export interface WedoEnd {
  t: number
  x: number
  angle: number
  height: number
  gate: number
  crashed: boolean
  /** The program reached its end (not stopped by the time limit). */
  finished: boolean
  timedOut: boolean
  light: WedoColor
  display: string | null
  /** Seconds the motor ran with power above 0, per direction. */
  motorSeconds: Record<MotorDir, number>
  /** Spinner turns per direction. */
  spinTurns: Record<MotorDir, number>
  /** Rover: farthest distance from the start, mm. */
  maxAway: number
}

export interface WedoResult {
  trace: WedoFrame[]
  events: WedoEvent[]
  end: WedoEnd
}

export interface SensorInput {
  motion?: 'near' | 'far'
  tilt?: TiltState
}

export interface WedoOptions {
  /** Scripted sensor events (the automatic check uses the lesson's scenario). */
  scenario?: ScenarioEvent[]
  maxTime?: number
}

const round = (v: number, d = 3) => Math.round(v * 10 ** d) / 10 ** d

/**
 * A program running on a scene, one tick at a time. `simulateWedo` runs it
 * to the end; the live view calls `tick` from animation frames with the
 * child's own sensor input.
 */
export class WedoRunner {
  readonly trace: WedoFrame[] = []
  readonly events: WedoEvent[] = []
  t = 0
  done = false

  private x: number
  private angle = 0
  private height = 0
  private gate = 0
  private motorOn = false
  private power = DEFAULT_POWER
  private dir: MotorDir = 'this'
  private motion: 'near' | 'far' = 'far'
  private tilt: TiltState = 'flat'
  private shakeUntil = -1
  private light: WedoColor = 'off'
  private display: string | null = null
  private crashed = false
  private touching = false
  private finished = false
  private stalled = 0
  private motorSeconds: Record<MotorDir, number> = { this: 0, that: 0 }
  private spinDeg: Record<MotorDir, number> = { this: 0, that: 0 }
  private maxAway = 0
  private scenario: ScenarioEvent[]
  private nextScenario = 0
  private program: Generator<void, void, void>
  private readonly maxTime: number

  constructor(
    steps: WedoStep[],
    readonly scene: WedoScene,
    options: WedoOptions = {},
  ) {
    this.x = scene.model === 'rover' ? scene.start : 0
    this.scenario = [...(options.scenario ?? [])].sort((a, b) => a.at - b.at)
    this.maxTime = Math.min(MAX_TIME, options.maxTime ?? MAX_TIME)
    this.program = this.exec(steps, '')
    if (scene.model === 'rover' && scene.sensor === 'motion') this.motion = this.roverDistance() <= NEAR_MM ? 'near' : 'far'
    this.record()
  }

  /** One tick: sensors, then the program, then the motor moves the model. Returns false once the run is over. */
  tick(input: SensorInput = {}): boolean {
    if (this.done) return false
    this.updateSensors(input)
    if (!this.finished) {
      const r = this.program.next()
      if (r.done) {
        this.finished = true
        this.emit({ t: this.t, kind: 'step', path: '' })
      }
    }
    const moved = this.physics()
    this.t = round(this.t + DT)
    this.record()
    if (this.finished) {
      if (!this.motorOn || this.power === 0) return this.stop()
      this.stalled = moved ? 0 : this.stalled + DT
      if (this.stalled >= STALL_SECONDS) return this.stop()
    }
    if (this.t >= this.maxTime - 1e-9) return this.stop()
    return true
  }

  result(): WedoResult {
    return {
      trace: this.trace,
      events: this.events,
      end: {
        t: this.t,
        x: round(this.x, 1),
        angle: round(this.angle, 1),
        height: round(this.height, 1),
        gate: round(this.gate, 1),
        crashed: this.crashed,
        finished: this.finished,
        timedOut: !this.finished,
        light: this.light,
        display: this.display,
        motorSeconds: { this: round(this.motorSeconds.this, 2), that: round(this.motorSeconds.that, 2) },
        spinTurns: { this: round(this.spinDeg.this / 360, 2), that: round(this.spinDeg.that / 360, 2) },
        maxAway: round(this.maxAway, 1),
      },
    }
  }

  // ── Program ─────────────────────────────────────────────────────────

  private *sleep(seconds: number): Generator<void, void, void> {
    const ticks = Math.max(1, Math.round(seconds / DT))
    for (let i = 0; i < ticks; i++) yield
  }

  private *until(ready: () => boolean): Generator<void, void, void> {
    while (!ready()) yield
  }

  private *exec(steps: WedoStep[], path: string): Generator<void, void, void> {
    for (let i = 0; i < steps.length; i++) {
      const s = steps[i]
      const here = path ? `${path}.${i}` : `${i}`
      this.emit({ t: this.t, kind: 'step', path: here })
      switch (s.op) {
        case 'motor_on_for':
          this.setMotor(true)
          yield* this.sleep(s.seconds)
          this.setMotor(false)
          break
        case 'motor_on':
          this.setMotor(true)
          break
        case 'motor_off':
          this.setMotor(false)
          break
        case 'motor_power':
          this.power = s.power
          if (this.motorOn) this.emitMotor()
          break
        case 'motor_direction':
          this.dir = s.dir
          if (this.motorOn) this.emitMotor()
          break
        case 'light':
          this.light = s.color
          this.emit({ t: this.t, kind: 'light', color: s.color })
          break
        case 'sound':
          this.emit({ t: this.t, kind: 'sound', sound: s.sound })
          yield* this.sleep(SOUND_SECONDS)
          break
        case 'display':
          this.display = s.value
          this.emit({ t: this.t, kind: 'display', mode: s.kind, value: s.value })
          break
        case 'wait':
          yield* this.sleep(s.seconds)
          break
        case 'wait_motion': {
          // "near" and "far" wait until the sensor says so (now or later); "change" waits for a new reading.
          const before = this.motion
          yield* this.until(() => (s.event === 'change' ? this.motion !== before : this.motion === s.event))
          break
        }
        case 'wait_tilt':
          yield* this.until(() => this.tilt === s.state)
          break
        case 'repeat':
          for (let k = 0; s.times === 'forever' || k < s.times; k++) {
            const t0 = this.t
            yield* this.exec(s.steps, here)
            // A loop of instant blocks still takes a tick per round, so time always moves on.
            if (this.t === t0) yield
          }
          break
      }
    }
  }

  // ── Motor, sensors, physics ─────────────────────────────────────────

  private setMotor(on: boolean) {
    if (this.motorOn === on) return
    this.motorOn = on
    this.emitMotor()
  }

  private emitMotor() {
    this.emit({ t: this.t, kind: 'motor', on: this.motorOn, power: this.power, dir: this.dir })
  }

  /** Step highlights are capped separately, so a fast loop never pushes out the events the checks read. */
  private emit(e: WedoEvent) {
    if (e.kind === 'step') {
      if (this.stepEvents >= MAX_EVENTS) return
      this.stepEvents++
    } else if (this.events.length - this.stepEvents >= MAX_EVENTS * 5) return
    this.events.push(e)
  }
  private stepEvents = 0

  /** Distance from the rover's nose to the nearest obstacle ahead, mm. */
  private roverDistance(): number {
    if (this.scene.model !== 'rover') return Infinity
    const front = this.x + ROVER_LENGTH / 2
    const ahead = this.scene.obstacles.filter((o) => o.at >= front - 1).map((o) => o.at - front)
    return ahead.length ? Math.max(0, Math.min(...ahead)) : Infinity
  }

  private setMotion(state: 'near' | 'far') {
    if (state === this.motion) return
    this.motion = state
    this.emit({ t: this.t, kind: 'sensor', sensor: 'motion', state })
  }

  private setTilt(state: TiltState) {
    if (state === this.tilt) return
    this.tilt = state
    this.shakeUntil = state === 'shake' ? this.t + SHAKE_SECONDS : -1
    this.emit({ t: this.t, kind: 'sensor', sensor: 'tilt', state })
  }

  private updateSensors(input: SensorInput) {
    while (this.nextScenario < this.scenario.length && this.scenario[this.nextScenario].at <= this.t + 1e-9) {
      const e = this.scenario[this.nextScenario++]
      if ('motion' in e && this.scene.sensor === 'motion' && this.scene.model !== 'rover') this.setMotion(e.motion)
      if ('tilt' in e && this.scene.sensor === 'tilt') this.setTilt(e.tilt)
    }
    if (this.tilt === 'shake' && this.shakeUntil >= 0 && this.t >= this.shakeUntil - 1e-9) this.setTilt('flat')
    if (input.motion && this.scene.sensor === 'motion' && this.scene.model !== 'rover') this.setMotion(input.motion)
    if (input.tilt && this.scene.sensor === 'tilt') this.setTilt(input.tilt)
    if (this.scene.model === 'rover' && this.scene.sensor === 'motion') {
      const d = this.roverDistance()
      if (d <= NEAR_MM) this.setMotion('near')
      else if (d > FAR_MM) this.setMotion('far')
    }
  }

  /** Moves the model for one tick; false when the motor is on but the model cannot move. */
  private physics(): boolean {
    if (!this.motorOn || this.power === 0) {
      this.touching = false
      return false
    }
    const sign = this.dir === 'this' ? 1 : -1
    this.motorSeconds[this.dir] += DT
    const scene = this.scene
    const motorDegPerS = MOTOR_RPM_PER_POWER * this.power * 6
    switch (scene.model) {
      case 'rover': {
        const before = this.x
        let next = this.x + sign * ROVER_MM_S_PER_POWER * this.power * DT
        const half = ROVER_LENGTH / 2
        let hit = false
        if (sign > 0) {
          const front = this.x + half
          const walls = [scene.length, ...scene.obstacles.filter((o) => o.at >= front - 1e-6).map((o) => o.at)]
          const wall = Math.min(...walls)
          if (next + half >= wall) ((next = wall - half), (hit = true))
        } else if (next - half <= 0) ((next = half), (hit = true))
        this.x = next
        this.maxAway = Math.max(this.maxAway, Math.abs(this.x - scene.start))
        if (hit && !this.touching) {
          this.crashed = true
          this.emit({ t: this.t, kind: 'crash', x: round(this.x, 1) })
        }
        this.touching = hit
        return Math.abs(this.x - before) > 1e-9
      }
      case 'spinner': {
        const deg = motorDegPerS * scene.ratio * DT
        this.angle += sign * deg
        this.spinDeg[this.dir] += deg
        return true
      }
      case 'lift': {
        const top = scene.levels * LEVEL_MM
        const before = this.height
        this.height = Math.min(top, Math.max(0, this.height + (sign * motorDegPerS * scene.mmPerTurn * DT) / 360))
        return Math.abs(this.height - before) > 1e-9
      }
      case 'gate': {
        const before = this.gate
        this.gate = Math.min(90, Math.max(0, this.gate + sign * motorDegPerS * GATE_RATIO * DT))
        return Math.abs(this.gate - before) > 1e-9
      }
    }
  }

  private record() {
    this.trace.push({
      t: this.t,
      x: round(this.x, 2),
      angle: round(this.angle, 2),
      height: round(this.height, 2),
      gate: round(this.gate, 2),
      motor: this.motorOn && this.power > 0,
      motion: this.motion,
      tilt: this.tilt,
    })
  }

  private stop(): false {
    if (this.motorOn) {
      this.motorOn = false
      this.emitMotor()
    }
    this.done = true
    return false
  }
}

/** Runs a program to the end (or the time limit) with the scenario's sensor events. Deterministic. */
export function simulateWedo(steps: WedoStep[], scene: WedoScene, options: WedoOptions = {}): WedoResult {
  const runner = new WedoRunner(steps, scene, options)
  while (runner.tick()) {
    /* run */
  }
  return runner.result()
}

/** The state shown at time t (the last frame at or before t). */
export function frameAt(trace: WedoFrame[], t: number): WedoFrame {
  let lo = 0
  let hi = trace.length - 1
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1
    if (trace[mid].t <= t + 1e-9) lo = mid
    else hi = mid - 1
  }
  return trace[lo]
}

/** Light, screen text and the last sound at time t, from the events. */
export function outputsAt(events: WedoEvent[], t: number): { light: WedoColor; display: string | null; soundAt: number | null; step: string | null } {
  let light: WedoColor = 'off'
  let display: string | null = null
  let soundAt: number | null = null
  let step: string | null = null
  for (const e of events) {
    if (e.t > t + 1e-9) break
    if (e.kind === 'light') light = e.color
    if (e.kind === 'display') display = e.value
    if (e.kind === 'sound') soundAt = e.t
    if (e.kind === 'step') step = e.path || null
  }
  return { light, display, soundAt, step }
}
