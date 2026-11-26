/**
 * The virtual Arduino Uno on the workbench: pins, the circuit around them,
 * the serial port, servos, the ultrasonic sensor and the buzzer.
 *
 * The sketch changes pins; the circuit is solved when the sketch reads a pin
 * and once per animation frame. A pin that switches within a frame (PWM,
 * fast blinking) is averaged over the frame by solving the circuit at
 * several phases, so a dimmed LED looks dimmer, as it does to the eye.
 */

import { type CircuitDoc, type LedColor, type Part, PWM_PINS, UNO_PINS, buildNets, legPoints } from './board'
import { type Element, type Solution, diodeFor, solve } from './circuit'
import { type Hardware, Interpreter, type PinMode } from './interpreter'
import { CodeError } from './lang'

/** Forward voltage at 10 mA. */
export const LED_VF: Record<LedColor, number> = { red: 1.9, yellow: 2.0, green: 2.1, blue: 2.9, white: 2.9 }
const LED_FULL_A = 0.01
const LED_BURN_A = 0.05
const PIN_MAX_A = 0.04
const SHORT_A = 0.5
const PIN_OHMS = 25
const PULLUP_OHMS = 35_000
const SERVO_DEG_PER_S = 500
const PHASES = 8

export type FaultCode = 'led_burned' | 'led_reversed' | 'pin_overcurrent' | 'short' | 'servo_unpowered' | 'sensor_unpowered' | 'serial_not_begun' | 'no_ground'

export interface Fault {
  code: FaultCode
  part?: string
  pin?: string
  ma?: number
}

export interface FrameState {
  /** Virtual time at the end of the frame, ms. */
  t: number
  /** LED brightness 0…1 by part id. */
  leds: Record<string, number>
  /** Average LED current, mA. */
  ledMa: Record<string, number>
  burned: string[]
  /** The Uno's own "L" LED on pin 13 and the TX LED. */
  builtin: number
  tx: boolean
  servos: Record<string, number>
  tones: { part: string; freq: number }[]
  /** Volts per terminal, for the probe. */
  volts: (terminal: string) => number | null
  faults: Fault[]
  /** 0/1 level and duty per pin for checks. */
  pins: { mode: PinMode; level: number; duty: number }[]
}

const pinTerminal = (p: number) => `uno.${UNO_PINS[p]}`

export class Board implements Hardware {
  now = 0
  deadline = 0
  readonly pinCount = 20
  readonly analogBase = 14

  private nets: Map<string, string>
  private ground: string
  private net5v: string
  readonly mode: PinMode[] = Array(20).fill(0)
  readonly level: number[] = Array(20).fill(0)
  private pwm: number[] = Array(20).fill(-1)
  private toneFreq: number[] = Array(20).fill(0)
  private toneEnd: number[] = Array(20).fill(Infinity)
  private highTime: number[] = Array(20).fill(0)
  private lastChange: number[] = Array(20).fill(0)
  private toggled: boolean[] = Array(20).fill(false)
  private trigAt: number[] = Array(20).fill(-Infinity)
  private lastRead: number[] = Array(20).fill(0)
  private frameStart = 0
  private solution: Solution | null = null
  private driven: Set<string> | null = null
  private dirty = true
  private burned = new Set<string>()
  private servoPin = new Map<number, number>()
  private servoTarget = new Map<number, number>()
  private servoAngle = new Map<string, number>()
  private serialBegun = false
  private serialIn = ''
  serialOut = ''
  private txFrame = false
  private faultsSeen = new Set<string>()
  private pendingFaults: Fault[] = []
  shorted = false

  constructor(private doc: CircuitDoc) {
    this.nets = buildNets(doc)
    this.ground = this.net('uno.GND.1')
    this.net5v = this.net('uno.5V')
    for (const p of doc.parts) if (p.type === 'servo') this.servoAngle.set(p.id, 90)
  }

  /** The workbench changed while running (a knob turned, a button pressed, a wire added). */
  setDoc(doc: CircuitDoc) {
    this.doc = doc
    this.nets = buildNets(doc)
    this.ground = this.net('uno.GND.1')
    this.net5v = this.net('uno.5V')
    for (const p of doc.parts) if (p.type === 'servo' && !this.servoAngle.has(p.id)) this.servoAngle.set(p.id, 90)
    this.dirty = true
  }

  private net(terminal: string): string {
    return this.nets.get(terminal) ?? terminal
  }

  private legNet(part: Part, leg: string) {
    return this.net(`${part.id}.${leg}`)
  }

  private fault(f: Fault, once = true) {
    const key = `${f.code}:${f.part ?? ''}:${f.pin ?? ''}`
    if (once && this.faultsSeen.has(key)) return
    this.faultsSeen.add(key)
    this.pendingFaults.push(f)
  }

  // ── The circuit ──────────────────────────────────────────────────────

  private elements(levels: number[]): Element[] {
    const els: Element[] = [
      { t: 'src', n: this.net5v, volts: 5, ohms: 0.05, id: 'v5' },
      { t: 'src', n: this.net('uno.3V3'), volts: 3.3, ohms: 1, id: 'v33' },
    ]
    for (let p = 0; p < 20; p++) {
      const n = this.net(pinTerminal(p))
      if (this.mode[p] === 1) els.push({ t: 'src', n, volts: levels[p] ? 5 : 0, ohms: PIN_OHMS, id: `pin${p}` })
      else if (this.mode[p] === 2) els.push({ t: 'src', n, volts: 5, ohms: PULLUP_OHMS, id: `pu${p}` })
    }
    for (const part of this.doc.parts) {
      const id = part.id
      switch (part.type) {
        case 'resistor':
          els.push({ t: 'r', a: this.legNet(part, '1'), b: this.legNet(part, '2'), ohms: part.props.ohms ?? 220, id })
          break
        case 'led':
          if (!this.burned.has(id)) els.push({ t: 'd', a: this.legNet(part, 'a'), k: this.legNet(part, 'k'), id, ...diodeFor(LED_VF[part.props.color ?? 'red']) })
          break
        case 'button':
          if (part.props.pressed) els.push({ t: 'r', a: this.legNet(part, '1a'), b: this.legNet(part, '2a'), ohms: 0.05 })
          break
        case 'pot': {
          const pos = Math.max(0, Math.min(1, part.props.pos ?? 0.5))
          els.push({ t: 'r', a: this.legNet(part, 'l'), b: this.legNet(part, 'w'), ohms: 50 + pos * 10_000 })
          els.push({ t: 'r', a: this.legNet(part, 'w'), b: this.legNet(part, 'r'), ohms: 50 + (1 - pos) * 10_000 })
          break
        }
        case 'ldr': {
          const light = Math.max(0, Math.min(1, part.props.light ?? 0.5))
          els.push({ t: 'r', a: this.legNet(part, '1'), b: this.legNet(part, '2'), ohms: 10 ** (6 - 3.3 * light) })
          break
        }
        case 'servo':
          els.push({ t: 'r', a: this.legNet(part, 'vcc'), b: this.legNet(part, 'gnd'), ohms: 470, id: `${id}.p` })
          break
        case 'ultrasonic':
          els.push({ t: 'r', a: this.legNet(part, 'vcc'), b: this.legNet(part, 'gnd'), ohms: 2000, id: `${id}.p` })
          if (this.sensorPowered(part)) els.push({ t: 'src', n: this.legNet(part, 'echo'), volts: 0, ohms: 100, id: `${id}.echo` })
          break
        default:
          break
      }
    }
    return els
  }

  private sensorPowered(part: Part) {
    return this.legNet(part, 'vcc') === this.net5v && this.legNet(part, 'gnd') === this.ground
  }

  /** Nets with a resistive path to ground or to a source; the rest float. */
  private drivenNets(els: Element[]): Set<string> {
    const adj = new Map<string, string[]>()
    const link = (a: string, b: string) => {
      ;(adj.get(a) ?? adj.set(a, []).get(a)!).push(b)
      ;(adj.get(b) ?? adj.set(b, []).get(b)!).push(a)
    }
    const roots: string[] = [this.ground]
    for (const e of els) {
      if (e.t === 'r' && e.ohms < 1e7) link(e.a, e.b)
      else if (e.t === 'src') roots.push(e.n)
    }
    const seen = new Set<string>(roots)
    const stack = [...roots]
    while (stack.length) {
      const n = stack.pop()!
      for (const m of adj.get(n) ?? []) if (!seen.has(m)) (seen.add(m), stack.push(m))
    }
    return seen
  }

  private instantLevels(): number[] {
    return this.level.map((l, p) => (this.pwm[p] >= 0 ? (this.pwm[p] >= 0.5 ? 1 : 0) : l))
  }

  private current(): Solution {
    if (!this.solution || this.dirty) {
      const els = this.elements(this.instantLevels())
      this.solution = solve(els, this.ground, this.solution?.v)
      this.driven = this.drivenNets(els)
      this.dirty = false
    }
    return this.solution
  }

  private pinVolts(p: number): { v: number; floating: boolean } {
    const s = this.current()
    const n = this.net(pinTerminal(p))
    return { v: s.v.get(n) ?? 0, floating: !this.driven!.has(n) }
  }

  // ── Hardware ─────────────────────────────────────────────────────────

  private noise() {
    return Math.random()
  }

  private account(pin: number) {
    if (this.level[pin]) this.highTime[pin] += this.now - Math.max(this.lastChange[pin], this.frameStart)
    this.lastChange[pin] = this.now
  }

  pinMode(pin: number, mode: PinMode) {
    this.mode[pin] = mode
    this.dirty = true
  }

  digitalWrite(pin: number, value: number) {
    // Writing HIGH to an input turns on its pull-up, as on the AVR.
    if (this.mode[pin] !== 1) {
      this.mode[pin] = value ? 2 : 0
      this.dirty = true
      return
    }
    this.pwm[pin] = -1
    if (this.level[pin] === value) return
    this.account(pin)
    this.level[pin] = value
    this.toggled[pin] = true
    if (value) this.trigAt[pin] = this.now
    this.dirty = true
  }

  digitalRead(pin: number): number {
    if (this.mode[pin] === 1) return this.level[pin]
    const { v, floating } = this.pinVolts(pin)
    if (floating) {
      // A floating input picks up noise from your hand and the mains: it reads random values.
      const r = Math.sin(this.now / 9_000 + pin) + (this.noise() - 0.5) * 0.6 > 0 ? 1 : 0
      this.lastRead[pin] = r
      return r
    }
    const r = v >= 3 ? 1 : v <= 1.5 ? 0 : this.lastRead[pin]
    this.lastRead[pin] = r
    return r
  }

  analogRead(pin: number): number {
    const { v, floating } = this.pinVolts(pin)
    if (floating) return Math.round(350 + 150 * Math.sin(this.now / 40_000 + pin) + (this.noise() - 0.5) * 60)
    return Math.max(0, Math.min(1023, Math.round((v / 5) * 1023 + (this.noise() < 0.2 ? 1 : this.noise() > 0.8 ? -1 : 0))))
  }

  analogWrite(pin: number, value: number) {
    if (this.mode[pin] !== 1) this.mode[pin] = 1
    if (!PWM_PINS.has(pin) || value === 0 || value === 255) {
      this.pwm[pin] = -1
      const level = PWM_PINS.has(pin) ? (value === 255 ? 1 : 0) : value >= 128 ? 1 : 0
      if (this.level[pin] !== level) {
        this.account(pin)
        this.level[pin] = level
        this.toggled[pin] = true
      }
    } else {
      this.account(pin)
      this.pwm[pin] = value / 255
    }
    this.dirty = true
  }

  tone(pin: number, frequency: number, durationMs?: number) {
    this.mode[pin] = 1
    this.toneFreq[pin] = Math.max(31, Math.min(65535, frequency))
    this.toneEnd[pin] = durationMs ? this.now + durationMs * 1000 : Infinity
    this.pwm[pin] = 0.5
    this.dirty = true
  }

  noTone(pin: number) {
    this.toneFreq[pin] = 0
    this.pwm[pin] = -1
    this.level[pin] = 0
    this.dirty = true
  }

  pulseIn(pin: number, level: number, timeoutUs: number) {
    const n = this.net(pinTerminal(pin))
    for (const part of this.doc.parts) {
      if (part.type !== 'ultrasonic' || this.legNet(part, 'echo') !== n || level !== 1) continue
      if (!this.sensorPowered(part)) {
        this.fault({ code: 'sensor_unpowered', part: part.id })
        continue
      }
      const trig = this.legNet(part, 'trig')
      const p = this.level.findIndex((_, i) => this.net(pinTerminal(i)) === trig && this.now - this.trigAt[i] < 100_000)
      if (p < 0) continue
      this.trigAt[p] = -Infinity
      const cm = part.props.distance ?? 30
      // Sound goes there and back: 58.3 µs per cm. Beyond 4 m the sensor gives up after 38 ms.
      const us = cm > 400 ? 38_000 : Math.round(cm * 58.3 + (this.noise() - 0.5) * 20)
      if (us > timeoutUs) return { us: 0, waited: timeoutUs }
      return { us, waited: 470 + us }
    }
    return { us: 0, waited: timeoutUs }
  }

  serialBegin() {
    this.serialBegun = true
  }

  serialWrite(text: string) {
    if (!this.serialBegun) {
      this.fault({ code: 'serial_not_begun' })
      return
    }
    this.serialOut += text
    this.txFrame = true
  }

  /** Text typed into the serial monitor. */
  send(text: string) {
    this.serialIn += text
  }

  serialAvailable() {
    return this.serialIn.length
  }

  serialRead() {
    if (!this.serialIn) return -1
    const c = this.serialIn.charCodeAt(0)
    this.serialIn = this.serialIn.slice(1)
    return c
  }

  serialPeek() {
    return this.serialIn ? this.serialIn.charCodeAt(0) : -1
  }

  servoAttach(id: number, pin: number) {
    this.servoPin.set(id, pin)
    this.mode[pin] = 1
    this.dirty = true
  }

  servoWrite(id: number, angle: number) {
    this.servoTarget.set(id, angle)
  }

  servoDetach(id: number) {
    this.servoPin.delete(id)
  }

  random() {
    return Math.random()
  }

  // ── Frames ───────────────────────────────────────────────────────────

  /** Solves the circuit for the frame that just ended and reports what can be seen and heard. */
  frame(dtMs: number): FrameState {
    const span = Math.max(1, this.now - this.frameStart)
    for (let p = 0; p < 20; p++) if (this.toneFreq[p] && this.now >= this.toneEnd[p]) this.noTone(p)
    const duty = this.level.map((l, p) => {
      if (this.pwm[p] >= 0) return this.pwm[p]
      if (!this.toggled[p]) return l
      return Math.max(0, Math.min(1, (this.highTime[p] + (l ? this.now - Math.max(this.lastChange[p], this.frameStart) : 0)) / span))
    })
    const fractional = duty.some((d) => d > 0 && d < 1)
    const phases = fractional ? PHASES : 1
    const leds = this.doc.parts.filter((p) => p.type === 'led')
    const sumI = new Map<string, number>()
    const peakI = new Map<string, number>()
    let solution: Solution | null = null
    for (let k = 0; k < phases; k++) {
      const levels = duty.map((d) => ((k + 0.5) / phases < d ? 1 : 0))
      const els = this.elements(levels)
      const s = solve(els, this.ground, solution?.v ?? this.solution?.v)
      if (k === 0 || !solution) solution = s
      for (const [id, i] of s.i) {
        sumI.set(id, (sumI.get(id) ?? 0) + i / phases)
        peakI.set(id, Math.max(peakI.get(id) ?? 0, Math.abs(i)))
      }
      if (k === phases - 1) solution = s
    }
    this.solution = solution
    this.driven = null
    this.dirty = true

    // Faults: a burnt LED, an overloaded pin, a short circuit.
    if ((peakI.get('v5') ?? 0) > SHORT_A || [...Array(20).keys()].some((p) => (peakI.get(`pin${p}`) ?? 0) > 0.15)) {
      this.shorted = true
      this.fault({ code: 'short' })
    }
    for (let p = 0; p < 20; p++) {
      const i = peakI.get(`pin${p}`) ?? 0
      if (i > PIN_MAX_A && !this.shorted) this.fault({ code: 'pin_overcurrent', pin: UNO_PINS[p], ma: Math.round(i * 1000) })
    }
    const ledState: Record<string, number> = {}
    const ledMa: Record<string, number> = {}
    for (const led of leds) {
      const peak = peakI.get(led.id) ?? 0
      if (peak > LED_BURN_A) {
        this.burned.add(led.id)
        this.fault({ code: 'led_burned', part: led.id, ma: Math.round(peak * 1000) })
      }
      const avg = Math.max(0, sumI.get(led.id) ?? 0)
      ledMa[led.id] = Math.round(avg * 10_000) / 10
      ledState[led.id] = this.burned.has(led.id) ? 0 : Math.min(1, avg / LED_FULL_A) ** 0.6
      const a = solution!.v.get(this.legNet(led, 'a')) ?? 0
      const k = solution!.v.get(this.legNet(led, 'k')) ?? 0
      if (k - a > 1.5) this.fault({ code: 'led_reversed', part: led.id })
    }

    // Servos follow their pulse at a real servo's speed, if they have power.
    const servos: Record<string, number> = {}
    for (const part of this.doc.parts.filter((p) => p.type === 'servo')) {
      const powered = (solution!.v.get(this.legNet(part, 'vcc')) ?? 0) - (solution!.v.get(this.legNet(part, 'gnd')) ?? 0) > 4
      const sig = this.legNet(part, 'sig')
      let target: number | undefined
      for (const [id, pin] of this.servoPin) if (this.net(pinTerminal(pin)) === sig) target = this.servoTarget.get(id)
      let angle = this.servoAngle.get(part.id) ?? 90
      if (target !== undefined) {
        if (powered) {
          const step = (SERVO_DEG_PER_S * dtMs) / 1000
          angle = Math.abs(target - angle) <= step ? target : angle + Math.sign(target - angle) * step
        } else this.fault({ code: 'servo_unpowered', part: part.id })
      }
      this.servoAngle.set(part.id, angle)
      servos[part.id] = angle
    }

    // A piezo sounds when one leg gets a tone and the other is on ground (or another pin).
    const tones: { part: string; freq: number }[] = []
    for (const part of this.doc.parts.filter((p) => p.type === 'buzzer')) {
      const a = this.legNet(part, 'p')
      const b = this.legNet(part, 'n')
      for (let p = 0; p < 20; p++) {
        if (!this.toneFreq[p]) continue
        const n = this.net(pinTerminal(p))
        if ((n === a && b === this.ground) || (n === b && a === this.ground)) tones.push({ part: part.id, freq: this.toneFreq[p] })
      }
    }

    const volts = (terminal: string) => {
      const n = this.nets.get(terminal)
      if (!n) return null
      return solution!.v.get(n) ?? 0
    }

    const state: FrameState = {
      t: this.now / 1000,
      leds: ledState,
      ledMa,
      burned: [...this.burned],
      builtin: duty[13] && this.mode[13] === 1 ? Math.min(1, duty[13]) ** 0.6 : 0,
      tx: this.txFrame,
      servos,
      tones,
      volts,
      faults: this.pendingFaults,
      pins: this.mode.map((mode, p) => ({ mode, level: this.level[p], duty: duty[p] })),
    }
    this.pendingFaults = []
    this.txFrame = false
    this.frameStart = this.now
    this.highTime.fill(0)
    this.toggled.fill(false)
    for (let p = 0; p < 20; p++) this.lastChange[p] = this.now
    return state
  }

  /** Voltage of a terminal right now (without running a frame). */
  probe(terminal: string): number | null {
    const n = this.nets.get(terminal)
    if (!n) return null
    return this.current().v.get(n) ?? 0
  }

  legs(part: Part) {
    return legPoints(part)
  }
}

export type RunStatus = { kind: 'running' } | { kind: 'error'; error: CodeError } | { kind: 'shorted' }

/** A sketch running on a board, advanced frame by frame from requestAnimationFrame. */
export class Simulation {
  readonly board: Board
  private readonly gen: Generator<void, void, void>
  readonly interpreter: Interpreter
  status: RunStatus = { kind: 'running' }

  constructor(source: string, doc: CircuitDoc) {
    this.board = new Board(doc)
    this.interpreter = new Interpreter(source, this.board)
    this.gen = this.interpreter.run()
  }

  /** Runs `dtMs` of virtual time, spending at most `budgetMs` of real time. */
  step(dtMs: number, budgetMs = 12): FrameState {
    const b = this.board
    if (this.status.kind === 'running') {
      b.deadline = b.now + dtMs * 1000
      const start = performance.now()
      try {
        while (b.now < b.deadline) {
          const r = this.gen.next()
          if (r.done) break
          if (performance.now() - start > budgetMs) break
        }
      } catch (e) {
        if (e instanceof CodeError) this.status = { kind: 'error', error: e }
        else throw e
      }
    }
    const state = b.frame(dtMs)
    if (b.shorted && this.status.kind === 'running') this.status = { kind: 'shorted' }
    return state
  }
}
