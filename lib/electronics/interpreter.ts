/**
 * Runs a parsed Arduino sketch against a virtual board.
 *
 * Arithmetic follows the AVR compiler: `int` is 16 bits on the Uno (so
 * 200 * 200 overflows as on the real board), `long` 32, integer division
 * truncates. Time is virtual (µs): every statement costs a little,
 * `delay` moves the clock. The interpreter is a generator that yields when
 * the clock reaches `hw.deadline`, so the page can run it frame by frame.
 */

import { CodeError, type Expr, type Func, type Kind, type Program, type Stmt, parse } from './lang'

export type T = 'f' | 'i16' | 'u16' | 'i32' | 'u32' | 's'
type Value = number | string

export const PIN_MODES = { INPUT: 0, OUTPUT: 1, INPUT_PULLUP: 2 } as const
export type PinMode = 0 | 1 | 2

/** What the sketch can do to the board. Implemented by the simulator (and by tests). */
export interface Hardware {
  /** Virtual time, µs. */
  now: number
  /** The interpreter pauses (yields) once `now` reaches this. */
  deadline: number
  /** Board id, for messages (`uno`, `esp32`). */
  boardId: string
  /** Width of `int`: 16 on the Uno, 32 on the ESP32. */
  intBits: 16 | 32
  /** Names of pins the sketch may use: LED_BUILTIN, A0… */
  constants: Record<string, number>
  validPin(pin: number): boolean
  /** The pin analogRead(n) reads, or null. */
  analogPin(n: number): number | null
  pinMode(pin: number, mode: PinMode): void
  digitalWrite(pin: number, value: number): void
  digitalRead(pin: number): number
  analogRead(pin: number): number
  analogWrite(pin: number, value: number): void
  tone(pin: number, frequency: number, durationMs?: number): void
  noTone(pin: number): void
  /** Length of the next pulse at `level` on `pin`, µs, or 0 on timeout; `waited` is the time it took. */
  pulseIn(pin: number, level: number, timeoutUs: number): { us: number; waited: number }
  serialBegin(baud: number): void
  serialWrite(text: string): void
  serialAvailable(): number
  /** Next byte of input, or -1. */
  serialRead(): number
  serialPeek(): number
  servoAttach(id: number, pin: number): void
  servoWrite(id: number, angle: number): void
  servoDetach(id: number): void
  /** A LiquidCrystal_I2C call: init, backlight, clear, setCursor, print… */
  lcd(id: number, op: string, args: (number | string)[]): void
  /** A DHT reading from the sensor on `pin`, or NaN when nothing answers. */
  dhtRead(id: number, pin: number, what: 'temp' | 'humidity', type: number): number
  random(): number
}

interface Var {
  kind: Kind
  value: Value
  arr?: Value[]
  isConst: boolean
  servo?: { id: number; angle: number; pin: number | null }
  /** A display or a temperature sensor object. */
  obj?: { id: number; pin: number; type: number }
}

type Scope = Map<string, Var>

const enum Flow {
  Normal,
  Break,
  Continue,
  Return,
}

/** Builtin functions: [min args, max args, result type]. `int` means the board's int. */
const BUILTINS: Record<string, [number, number, T | 'int' | 'arg' | 'void']> = {
  pinMode: [2, 2, 'void'],
  digitalWrite: [2, 2, 'void'],
  digitalRead: [1, 1, 'int'],
  analogRead: [1, 1, 'int'],
  analogWrite: [2, 2, 'void'],
  delay: [1, 1, 'void'],
  delayMicroseconds: [1, 1, 'void'],
  millis: [0, 0, 'u32'],
  micros: [0, 0, 'u32'],
  tone: [2, 3, 'void'],
  noTone: [1, 1, 'void'],
  pulseIn: [2, 3, 'u32'],
  map: [5, 5, 'i32'],
  constrain: [3, 3, 'arg'],
  min: [2, 2, 'arg'],
  max: [2, 2, 'arg'],
  abs: [1, 1, 'arg'],
  sq: [1, 1, 'arg'],
  sqrt: [1, 1, 'f'],
  pow: [2, 2, 'f'],
  sin: [1, 1, 'f'],
  cos: [1, 1, 'f'],
  tan: [1, 1, 'f'],
  atan2: [2, 2, 'f'],
  exp: [1, 1, 'f'],
  log: [1, 1, 'f'],
  floor: [1, 1, 'f'],
  ceil: [1, 1, 'f'],
  round: [1, 1, 'i32'],
  radians: [1, 1, 'f'],
  degrees: [1, 1, 'f'],
  random: [1, 2, 'i32'],
  randomSeed: [1, 1, 'void'],
  bitRead: [2, 2, 'int'],
  bitSet: [2, 2, 'arg'],
  bitClear: [2, 2, 'arg'],
  bitWrite: [3, 3, 'arg'],
  highByte: [1, 1, 'int'],
  lowByte: [1, 1, 'int'],
}

const SERIAL_METHODS: Record<string, [number, number, T | 'int' | 'void']> = {
  begin: [1, 2, 'void'],
  end: [0, 0, 'void'],
  print: [1, 2, 'u32'],
  println: [0, 2, 'u32'],
  write: [1, 1, 'u32'],
  available: [0, 0, 'int'],
  read: [0, 0, 'int'],
  peek: [0, 0, 'int'],
  parseInt: [0, 0, 'i32'],
  parseFloat: [0, 0, 'f'],
  readString: [0, 0, 's'],
  readStringUntil: [1, 1, 's'],
  flush: [0, 0, 'void'],
  setTimeout: [1, 1, 'void'],
}

const SERVO_METHODS: Record<string, [number, number, T | 'int' | 'void']> = {
  attach: [1, 3, 'int'],
  write: [1, 1, 'void'],
  writeMicroseconds: [1, 1, 'void'],
  read: [0, 0, 'int'],
  attached: [0, 0, 'int'],
  detach: [0, 0, 'void'],
}

const LCD_METHODS: Record<string, [number, number, T | 'int' | 'void']> = {
  init: [0, 0, 'void'],
  begin: [0, 2, 'void'],
  backlight: [0, 0, 'void'],
  noBacklight: [0, 0, 'void'],
  clear: [0, 0, 'void'],
  home: [0, 0, 'void'],
  setCursor: [2, 2, 'void'],
  print: [1, 2, 'int'],
  display: [0, 0, 'void'],
  noDisplay: [0, 0, 'void'],
}

const DHT_METHODS: Record<string, [number, number, T | 'int' | 'void']> = {
  begin: [0, 0, 'void'],
  readTemperature: [0, 1, 'f'],
  readHumidity: [0, 0, 'f'],
}

const STRING_METHODS: Record<string, [number, number, T | 'int']> = {
  length: [0, 0, 'int'],
  toInt: [0, 0, 'i32'],
  toFloat: [0, 0, 'f'],
  charAt: [1, 1, 'int'],
  substring: [1, 2, 's'],
  indexOf: [1, 2, 'int'],
  equals: [1, 1, 'int'],
  toUpperCase: [0, 0, 'void' as 'int'],
  toLowerCase: [0, 0, 'void' as 'int'],
  trim: [0, 0, 'void' as 'int'],
  startsWith: [1, 1, 'int'],
  endsWith: [1, 1, 'int'],
}

const BLOCKING = new Set(['delay', 'delayMicroseconds', 'pulseIn'])
const BLOCKING_SERIAL = new Set(['parseInt', 'parseFloat', 'readString', 'readStringUntil'])

/** Rough cost of builtins on a 16 MHz AVR, µs. analogRead really takes ~112 µs. */
const COST: Record<string, number> = { digitalWrite: 4, digitalRead: 4, analogRead: 112, analogWrite: 6, pinMode: 3, print: 8, println: 8 }

const RANK: Record<Exclude<T, 'f' | 's'>, number> = { i16: 0, u16: 1, i32: 2, u32: 3 }

export function wrap(v: number, t: T): number {
  if (t === 'f') return v
  const n = Number.isFinite(v) ? Math.trunc(v) : 0
  switch (t) {
    case 'i16':
      return (n << 16) >> 16
    case 'u16':
      return n & 0xffff
    case 'i32':
      return n | 0
    case 'u32':
      return n >>> 0
    default:
      return n
  }
}

/** Formats a number the way Serial.print does. */
export function formatNumber(v: number, t: T, arg?: number): string {
  if (t === 'f') {
    if (Number.isNaN(v)) return 'nan'
    if (!Number.isFinite(v)) return v > 0 ? 'inf' : '-inf'
    return v.toFixed(arg === undefined ? 2 : Math.max(0, Math.min(10, arg)))
  }
  const base = arg ?? 10
  if (base === 10) return String(v)
  // Other bases print the unsigned 32-bit pattern (a negative int becomes FFFF…).
  return (v >>> 0).toString(base === 16 || base === 2 || base === 8 ? base : 10).toUpperCase()
}

interface Frame {
  scopes: Scope[]
  fn: Func | null
}

export interface InterpreterOptions {
  intBits?: 16 | 32
}

export class Interpreter {
  readonly program: Program
  readonly intT: T
  private readonly intBits: 16 | 32
  private globals: Scope = new Map()
  private frame: Frame = { scopes: [], fn: null }
  private depth = 0
  private retVal: Value = 0
  private servoCount = 0
  private objCount = 0
  private steps = 0
  private readonly types = new WeakMap<Expr, T>()
  private readonly blocking = new WeakMap<Expr, boolean>()
  /** Line of the statement being run, for runtime errors and the editor. */
  line = 0
  private serialTimeoutMs = 1000

  constructor(
    source: string | Program,
    private readonly hw: Hardware,
    options: InterpreterOptions = {},
  ) {
    this.intBits = options.intBits ?? hw.intBits ?? 16
    this.intT = this.intBits === 16 ? 'i16' : 'i32'
    this.program = typeof source === 'string' ? parse(source, this.intBits) : source
    this.check()
  }

  // ── Static check ("compile") ──────────────────────────────────────────

  private constants(): Record<string, T> {
    const names: Record<string, T> = {
      HIGH: this.intT, LOW: this.intT, INPUT: this.intT, OUTPUT: this.intT, INPUT_PULLUP: this.intT, INPUT_PULLDOWN: this.intT,
      DEC: this.intT, HEX: this.intT, BIN: this.intT, OCT: this.intT, PI: 'f', HALF_PI: 'f', TWO_PI: 'f', true: this.intT, false: this.intT,
      DHT11: this.intT, DHT22: this.intT, DHT21: this.intT,
    }
    for (const name of Object.keys(this.hw.constants)) names[name] = this.intT
    return names
  }

  private constantValue(name: string): number | undefined {
    switch (name) {
      case 'HIGH':
        return 1
      case 'LOW':
        return 0
      case 'INPUT':
        return 0
      case 'OUTPUT':
        return 1
      case 'INPUT_PULLUP':
        return 2
      case 'INPUT_PULLDOWN':
        return 0
      case 'DEC':
        return 10
      case 'HEX':
        return 16
      case 'BIN':
        return 2
      case 'OCT':
        return 8
      case 'DHT11':
        return 11
      case 'DHT22':
        return 22
      case 'DHT21':
        return 21
      case 'PI':
        return Math.PI
      case 'HALF_PI':
        return Math.PI / 2
      case 'TWO_PI':
        return Math.PI * 2
    }
    return this.hw.constants[name]
  }

  /** Finds unknown names, wrong argument counts and a missing setup/loop before running. */
  private check() {
    const { functions, globals } = this.program
    if (!functions.has('setup')) throw new CodeError('no_setup', 1)
    if (!functions.has('loop')) throw new CodeError('no_loop', 1)
    const constants = this.constants()
    type Entry = { kind: Kind; isConst: boolean }
    const global = new Map<string, Entry>()
    const scopes: Map<string, Entry>[] = [global]
    const entry = (name: string) => {
      for (let i = scopes.length - 1; i >= 0; i--) {
        const k = scopes[i].get(name)
        if (k) return k
      }
      return null
    }
    const find = (name: string) => entry(name)?.kind ?? null
    const declare = (name: string, kind: Kind, isConst: boolean, line: number) => {
      const scope = scopes[scopes.length - 1]
      if (scope.has(name)) throw new CodeError('duplicate', line, { name })
      scope.set(name, { kind, isConst })
    }
    const expr = (e: Expr | undefined): void => {
      if (!e) return
      switch (e.t) {
        case 'id':
          if (!find(e.name) && !(e.name in constants)) throw new CodeError('unknown_name', e.line, { name: e.name })
          return
        case 'assign':
          expr(e.target)
          expr(e.value)
          if (e.target.t === 'id' && entry(e.target.name)?.isConst) throw new CodeError('const_assign', e.line, { name: e.target.name })
          return
        case 'bin':
          expr(e.a)
          expr(e.b)
          return
        case 'un':
        case 'cast':
          expr(e.a)
          return
        case 'upd':
          expr(e.target)
          if (e.target.t !== 'id' && e.target.t !== 'index') throw new CodeError('not_assignable', e.line)
          return
        case 'cond':
          expr(e.test)
          expr(e.a)
          expr(e.b)
          return
        case 'index':
          expr(e.array)
          expr(e.index)
          return
        case 'call': {
          e.args.forEach(expr)
          const fn = functions.get(e.name)
          if (fn) {
            if (e.args.length !== fn.params.length) throw new CodeError('wrong_args', e.line, { name: e.name, n: fn.params.length })
            return
          }
          const b = BUILTINS[e.name]
          if (!b) throw new CodeError(find(e.name) ? 'not_a_function' : 'unknown_function', e.line, { name: e.name })
          if (e.args.length < b[0] || e.args.length > b[1]) throw new CodeError('wrong_args', e.line, { name: e.name, n: b[0] === b[1] ? b[0] : `${b[0]}–${b[1]}` })
          return
        }
        case 'method': {
          e.args.forEach(expr)
          const kind = e.object === 'Serial' ? 'serial' : find(e.object)
          if (!kind) throw new CodeError('unknown_name', e.line, { name: e.object })
          const table = kind === 'serial' ? SERIAL_METHODS : kind === 'servo' ? SERVO_METHODS : kind === 'lcd' ? LCD_METHODS : kind === 'dht' ? DHT_METHODS : kind === 'str' ? STRING_METHODS : null
          const m = table?.[e.method]
          if (!m) throw new CodeError('unknown_method', e.line, { name: `${e.object}.${e.method}` })
          if (e.args.length < m[0] || e.args.length > m[1]) throw new CodeError('wrong_args', e.line, { name: `${e.object}.${e.method}`, n: m[0] === m[1] ? m[0] : `${m[0]}–${m[1]}` })
          return
        }
        default:
          return
      }
    }
    const stmt = (s: Stmt | undefined, inLoop: boolean, inSwitch: boolean): void => {
      if (!s) return
      switch (s.t) {
        case 'decl':
          for (const d of s.items) {
            expr(d.size ?? undefined)
            expr(d.init)
            d.list?.forEach(expr)
            declare(d.name, s.kind, s.isConst, d.line)
          }
          return
        case 'expr':
          expr(s.e)
          return
        case 'block':
          scopes.push(new Map())
          s.body.forEach((x) => stmt(x, inLoop, inSwitch))
          scopes.pop()
          return
        case 'if':
          expr(s.test)
          stmt(s.then, inLoop, inSwitch)
          stmt(s.else, inLoop, inSwitch)
          return
        case 'while':
        case 'do':
          expr(s.test)
          stmt(s.body, true, inSwitch)
          return
        case 'for':
          scopes.push(new Map())
          stmt(s.init, inLoop, inSwitch)
          expr(s.test)
          expr(s.update)
          stmt(s.body, true, inSwitch)
          scopes.pop()
          return
        case 'switch':
          expr(s.test)
          scopes.push(new Map())
          for (const c of s.cases) {
            expr(c.test ?? undefined)
            c.body.forEach((x) => stmt(x, inLoop, true))
          }
          scopes.pop()
          return
        case 'break':
          if (!inLoop && !inSwitch) throw new CodeError('break_outside', s.line, { word: 'break' })
          return
        case 'continue':
          if (!inLoop) throw new CodeError('break_outside', s.line, { word: 'continue' })
          return
        case 'return':
          expr(s.value)
          return
        default:
          return
      }
    }
    for (const g of globals) stmt(g, false, false)
    for (const fn of functions.values()) {
      if (global.has(fn.name)) throw new CodeError('duplicate', fn.line, { name: fn.name })
      scopes.push(new Map(fn.params.map((p) => [p.name, { kind: p.kind, isConst: false }])))
      stmt(fn.body, false, false)
      scopes.pop()
    }
  }

  // ── Variables ─────────────────────────────────────────────────────────

  private lookup(name: string, line: number): Var {
    const scopes = this.frame.scopes
    for (let i = scopes.length - 1; i >= 0; i--) {
      const v = scopes[i].get(name)
      if (v) return v
    }
    const g = this.globals.get(name)
    if (g) return g
    throw new CodeError('unknown_name', line, { name })
  }

  private findVar(name: string): Var | undefined {
    const scopes = this.frame.scopes
    for (let i = scopes.length - 1; i >= 0; i--) {
      const v = scopes[i].get(name)
      if (v) return v
    }
    return this.globals.get(name)
  }

  kindT(kind: Kind): T {
    switch (kind) {
      case 'f':
        return 'f'
      case 'str':
        return 's'
      case 'i32':
        return 'i32'
      case 'u32':
        return 'u32'
      case 'u16':
        return this.intBits === 16 ? 'u16' : 'i32'
      default:
        return this.intT
    }
  }

  /** Converts a value for storing in a variable of `kind`. */
  store(kind: Kind, v: Value, from: T): Value {
    if (kind === 'str') return typeof v === 'string' ? v : formatNumber(v, from)
    const n = typeof v === 'string' ? Number.parseFloat(v) || 0 : v
    switch (kind) {
      case 'f':
        return n
      case 'bool':
        return n ? 1 : 0
      case 'i8':
      case 'char':
        return ((wrap(n, 'i32') << 24) >> 24)
      case 'u8':
        return wrap(n, 'i32') & 0xff
      case 'i16':
        return wrap(n, 'i16')
      case 'u16':
        return wrap(n, 'u16')
      case 'i32':
        return wrap(n, 'i32')
      case 'u32':
        return wrap(n, 'u32')
      default:
        return n
    }
  }

  // ── Types ─────────────────────────────────────────────────────────────

  private common(a: T, b: T): T {
    if (a === 's' || b === 's') return 's'
    if (a === 'f' || b === 'f') return 'f'
    return RANK[a] >= RANK[b] ? a : b
  }

  typeOf(e: Expr): T {
    const cached = this.types.get(e)
    if (cached) return cached
    const t = this.computeType(e)
    this.types.set(e, t)
    return t
  }

  private computeType(e: Expr): T {
    switch (e.t) {
      case 'num':
        if (e.float) return 'f'
        if (e.long || e.unsigned) return e.unsigned ? (e.long || this.intBits === 32 ? 'u32' : 'u16') : 'i32'
        return this.intT
      case 'str':
        return 's'
      case 'char':
        return this.intT
      case 'id': {
        const v = this.findVar(e.name)
        if (v) return this.kindT(v.kind)
        return e.name === 'PI' || e.name === 'HALF_PI' || e.name === 'TWO_PI' ? 'f' : this.intT
      }
      case 'assign':
      case 'upd':
        return this.typeOf(e.target)
      case 'bin':
        if (e.op === ',') return this.typeOf(e.b)
        if (['==', '!=', '<', '>', '<=', '>=', '&&', '||'].includes(e.op)) return this.intT
        if (e.op === '<<' || e.op === '>>') return this.typeOf(e.a)
        return this.common(this.typeOf(e.a), this.typeOf(e.b))
      case 'un':
        return e.op === '!' ? this.intT : this.typeOf(e.a)
      case 'cond':
        return this.common(this.typeOf(e.a), this.typeOf(e.b))
      case 'index': {
        const arr = e.array.t === 'id' ? this.findVar(e.array.name) : undefined
        if (arr?.kind === 'str' && !arr.arr) return this.intT
        return arr ? this.kindT(arr.kind) : this.intT
      }
      case 'cast':
        return this.kindT(e.kind)
      case 'call': {
        const fn = this.program.functions.get(e.name)
        if (fn) return fn.ret === 'void' ? this.intT : this.kindT(fn.ret)
        const r = BUILTINS[e.name]?.[2]
        if (r === 'arg') return e.args.map((a) => this.typeOf(a)).reduce((a, b) => this.common(a, b))
        if (r === 'int' || r === 'void' || !r) return this.intT
        return r
      }
      case 'method': {
        const v = e.object === 'Serial' ? null : this.findVar(e.object)
        const table = e.object === 'Serial' ? SERIAL_METHODS : v?.kind === 'servo' ? SERVO_METHODS : v?.kind === 'lcd' ? LCD_METHODS : v?.kind === 'dht' ? DHT_METHODS : STRING_METHODS
        const r = table[e.method]?.[2]
        if (r === 'int' || r === 'void' || !r) return this.intT
        return r
      }
    }
  }

  private isBlocking(e: Expr): boolean {
    const cached = this.blocking.get(e)
    if (cached !== undefined) return cached
    let b: boolean
    switch (e.t) {
      case 'call':
        b = this.program.functions.has(e.name) || BLOCKING.has(e.name) || e.args.some((a) => this.isBlocking(a))
        break
      case 'method':
        b = (e.object === 'Serial' && BLOCKING_SERIAL.has(e.method)) || e.args.some((a) => this.isBlocking(a))
        break
      case 'assign':
        b = this.isBlocking(e.target) || this.isBlocking(e.value)
        break
      case 'bin':
        b = this.isBlocking(e.a) || this.isBlocking(e.b)
        break
      case 'un':
      case 'cast':
        b = this.isBlocking(e.a)
        break
      case 'upd':
        b = this.isBlocking(e.target)
        break
      case 'cond':
        b = this.isBlocking(e.test) || this.isBlocking(e.a) || this.isBlocking(e.b)
        break
      case 'index':
        b = this.isBlocking(e.array) || this.isBlocking(e.index)
        break
      default:
        b = false
    }
    this.blocking.set(e, b)
    return b
  }

  // ── Running ───────────────────────────────────────────────────────────

  /** setup() once, then loop() forever. Yields whenever the virtual clock reaches the deadline. */
  *run(): Generator<void, void, void> {
    for (const g of this.program.globals) yield* this.exec(g, true)
    yield* this.callUser(this.program.functions.get('setup')!, [], 0)
    const loop = this.program.functions.get('loop')!
    for (;;) {
      yield* this.callUser(loop, [], loop.line)
      // A loop() that does nothing still takes time on the board.
      this.spend(1)
      if (this.hw.now >= this.hw.deadline) yield
    }
  }

  private spend(us: number) {
    this.hw.now += us
  }

  private *sleep(us: number): Generator<void, void, void> {
    const end = this.hw.now + Math.max(0, us)
    while (this.hw.now < end) {
      if (end <= this.hw.deadline) this.hw.now = end
      else {
        this.hw.now = this.hw.deadline
        yield
      }
    }
  }

  private *exec(s: Stmt, global = false): Generator<void, Flow, void> {
    this.line = s.line
    this.spend(1)
    if (this.hw.now >= this.hw.deadline || ++this.steps >= 20000) {
      this.steps = 0
      yield
    }
    switch (s.t) {
      case 'decl': {
        const scope = global ? this.globals : this.frame.scopes[this.frame.scopes.length - 1]
        for (const d of s.items) {
          const v: Var = { kind: s.kind, value: s.kind === 'str' ? '' : 0, isConst: s.isConst }
          if (s.kind === 'servo') v.servo = { id: this.servoCount++, angle: 90, pin: null }
          if (s.kind === 'lcd' || s.kind === 'dht') {
            // DHT dht(pin, DHT11); LiquidCrystal_I2C lcd(0x27, 16, 2);
            const args: number[] = []
            for (const a of d.args ?? []) args.push(Number(yield* this.ev(a)))
            v.obj = { id: this.objCount++, pin: s.kind === 'dht' ? (args[0] ?? -1) : -1, type: s.kind === 'dht' ? (args[1] ?? 11) : 0 }
          }
          if (d.size !== undefined || d.list) {
            const size = d.size ? Number(yield* this.ev(d.size)) : (d.list?.length ?? 0)
            v.arr = new Array(Math.max(0, size)).fill(s.kind === 'str' ? '' : 0)
            if (d.list) {
              for (let i = 0; i < d.list.length && i < v.arr.length; i++) {
                const e = d.list[i]
                v.arr[i] = this.store(s.kind, yield* this.ev(e), this.typeOf(e))
              }
            }
            if (d.init?.t === 'str' && s.kind === 'char') {
              // char text[] = "abc"
              const text = d.init.value
              v.arr = Array.from({ length: Math.max(size, text.length + 1) }, (_, i) => text.charCodeAt(i) || 0)
            }
          } else if (d.init) {
            v.value = this.store(s.kind, yield* this.ev(d.init), this.typeOf(d.init))
          }
          scope.set(d.name, v)
        }
        return Flow.Normal
      }
      case 'expr':
        yield* this.ev(s.e)
        return Flow.Normal
      case 'block': {
        this.frame.scopes.push(new Map())
        try {
          for (const x of s.body) {
            const f = yield* this.exec(x)
            if (f !== Flow.Normal) return f
          }
          return Flow.Normal
        } finally {
          this.frame.scopes.pop()
        }
      }
      case 'if':
        if (this.truthy(yield* this.ev(s.test))) return yield* this.exec(s.then)
        if (s.else) return yield* this.exec(s.else)
        return Flow.Normal
      case 'while':
        while (this.truthy(yield* this.ev(s.test))) {
          const f = yield* this.exec(s.body)
          if (f === Flow.Break) break
          if (f === Flow.Return) return f
        }
        return Flow.Normal
      case 'do':
        do {
          const f = yield* this.exec(s.body)
          if (f === Flow.Break) break
          if (f === Flow.Return) return f
        } while (this.truthy(yield* this.ev(s.test)))
        return Flow.Normal
      case 'for': {
        this.frame.scopes.push(new Map())
        try {
          if (s.init) yield* this.exec(s.init)
          for (;;) {
            if (s.test && !this.truthy(yield* this.ev(s.test))) break
            const f = yield* this.exec(s.body)
            if (f === Flow.Break) break
            if (f === Flow.Return) return f
            if (s.update) yield* this.ev(s.update)
          }
          return Flow.Normal
        } finally {
          this.frame.scopes.pop()
        }
      }
      case 'switch': {
        const value = yield* this.ev(s.test)
        let start = -1
        for (let i = 0; i < s.cases.length && start < 0; i++) {
          const c = s.cases[i]
          if (c.test && (yield* this.ev(c.test)) === value) start = i
        }
        if (start < 0) start = s.cases.findIndex((c) => c.test === null)
        if (start < 0) return Flow.Normal
        this.frame.scopes.push(new Map())
        try {
          for (let i = start; i < s.cases.length; i++) {
            for (const x of s.cases[i].body) {
              const f = yield* this.exec(x)
              if (f === Flow.Break) return Flow.Normal
              if (f !== Flow.Normal) return f
            }
          }
          return Flow.Normal
        } finally {
          this.frame.scopes.pop()
        }
      }
      case 'break':
        return Flow.Break
      case 'continue':
        return Flow.Continue
      case 'return': {
        const fn = this.frame.fn
        if (s.value) {
          const v = yield* this.ev(s.value)
          this.retVal = fn && fn.ret !== 'void' ? this.store(fn.ret, v, this.typeOf(s.value)) : v
        } else this.retVal = 0
        return Flow.Return
      }
      case 'empty':
        return Flow.Normal
    }
  }

  private truthy(v: Value) {
    return typeof v === 'string' ? v.length > 0 : v !== 0 && !Number.isNaN(v)
  }

  private *callUser(fn: Func, args: Expr[], line: number): Generator<void, Value, void> {
    if (this.depth > 200) throw new CodeError('too_deep', line, { name: fn.name })
    const scope: Scope = new Map()
    for (let i = 0; i < fn.params.length; i++) {
      const p = fn.params[i]
      const a = args[i]
      if ((p.array || p.ref) && a.t === 'id') {
        scope.set(p.name, this.lookup(a.name, line))
        continue
      }
      const value = yield* this.ev(a)
      scope.set(p.name, { kind: p.kind, value: this.store(p.kind, value, this.typeOf(a)), isConst: false })
    }
    const saved = this.frame
    const savedLine = this.line
    this.frame = { scopes: [scope], fn }
    this.depth++
    this.retVal = 0
    try {
      const f = yield* this.exec(fn.body)
      const ret = f === Flow.Return ? this.retVal : 0
      return ret
    } finally {
      this.depth--
      this.frame = saved
      this.line = savedLine
    }
  }

  // ── Expressions ───────────────────────────────────────────────────────

  /** Evaluates without the generator machinery when nothing inside can wait. */
  private *ev(e: Expr): Generator<void, Value, void> {
    if (!this.isBlocking(e)) return this.evs(e)
    switch (e.t) {
      case 'call': {
        const fn = this.program.functions.get(e.name)
        if (fn) return yield* this.callUser(fn, e.args, e.line)
        const args: Value[] = []
        for (const a of e.args) args.push(yield* this.ev(a))
        return yield* this.blockingBuiltin(e.name, args.map(Number), e.line)
      }
      case 'method': {
        const args: Value[] = []
        for (const a of e.args) args.push(yield* this.ev(a))
        if (e.object === 'Serial' && BLOCKING_SERIAL.has(e.method)) return yield* this.serialWait(e.method, args)
        return this.method(e, args)
      }
      case 'assign': {
        const value = yield* this.ev(e.value)
        if (e.target.t === 'index') {
          const idx = Number(yield* this.ev(e.target.index))
          return this.assign(e, value, idx)
        }
        return this.assign(e, value)
      }
      case 'bin': {
        if (e.op === '&&') return (this.truthy(yield* this.ev(e.a)) && this.truthy(yield* this.ev(e.b))) ? 1 : 0
        if (e.op === '||') return (this.truthy(yield* this.ev(e.a)) || this.truthy(yield* this.ev(e.b))) ? 1 : 0
        const a = yield* this.ev(e.a)
        const b = yield* this.ev(e.b)
        return this.binary(e, a, b)
      }
      case 'un':
        return this.unary(e, yield* this.ev(e.a))
      case 'cast':
        return this.cast(e, yield* this.ev(e.a))
      case 'cond':
        return this.truthy(yield* this.ev(e.test)) ? yield* this.ev(e.a) : yield* this.ev(e.b)
      case 'index': {
        const idx = Number(yield* this.ev(e.index))
        return this.readIndex(e, idx)
      }
      case 'upd': {
        const idx = e.target.t === 'index' ? Number(yield* this.ev(e.target.index)) : undefined
        return this.update(e, idx)
      }
      default:
        return this.evs(e)
    }
  }

  /** Synchronous evaluation of an expression that cannot wait. */
  private evs(e: Expr): Value {
    switch (e.t) {
      case 'num':
        return e.value
      case 'str':
        return e.value
      case 'char':
        return e.value
      case 'id': {
        const v = this.findVar(e.name)
        if (v) {
          if (v.arr) return 0
          return v.value
        }
        const c = this.constantValue(e.name)
        if (c !== undefined) return c
        if (e.name === 'true') return 1
        if (e.name === 'false') return 0
        throw new CodeError('unknown_name', e.line, { name: e.name })
      }
      case 'assign': {
        const value = this.evs(e.value)
        if (e.target.t === 'index') return this.assign(e, value, Number(this.evs(e.target.index)))
        return this.assign(e, value)
      }
      case 'upd':
        return this.update(e, e.target.t === 'index' ? Number(this.evs(e.target.index)) : undefined)
      case 'bin':
        if (e.op === '&&') return this.truthy(this.evs(e.a)) && this.truthy(this.evs(e.b)) ? 1 : 0
        if (e.op === '||') return this.truthy(this.evs(e.a)) || this.truthy(this.evs(e.b)) ? 1 : 0
        return this.binary(e, this.evs(e.a), this.evs(e.b))
      case 'un':
        return this.unary(e, this.evs(e.a))
      case 'cast':
        return this.cast(e, this.evs(e.a))
      case 'cond':
        return this.truthy(this.evs(e.test)) ? this.evs(e.a) : this.evs(e.b)
      case 'index':
        return this.readIndex(e, Number(this.evs(e.index)))
      case 'call':
        return this.builtin(e.name, e.args.map((a) => this.evs(a)), e)
      case 'method':
        return this.method(e, e.args.map((a) => this.evs(a)))
    }
  }

  private cast(e: Expr & { t: 'cast' }, v: Value): Value {
    const from = this.typeOf(e.a)
    if (e.kind === 'str') return typeof v === 'string' ? v : formatNumber(v, from)
    return this.store(e.kind, v, from)
  }

  private unary(e: Expr & { t: 'un' }, v: Value): Value {
    const t = this.typeOf(e)
    const n = typeof v === 'string' ? Number(v) || 0 : v
    switch (e.op) {
      case '-':
        return wrap(-n, t)
      case '+':
        return n
      case '!':
        return this.truthy(v) ? 0 : 1
      case '~':
        return wrap(~n, t)
      default:
        return n
    }
  }

  private binary(e: Expr & { t: 'bin' }, a: Value, b: Value): Value {
    if (e.op === ',') return b
    const ta = this.typeOf(e.a)
    const tb = this.typeOf(e.b)
    const t = this.common(ta, tb)
    if (t === 's') {
      const sa = typeof a === 'string' ? a : this.isCharExpr(e.a) ? String.fromCharCode(a) : formatNumber(a, ta)
      const sb = typeof b === 'string' ? b : this.isCharExpr(e.b) ? String.fromCharCode(b) : formatNumber(b, tb)
      switch (e.op) {
        case '+':
          return sa + sb
        case '==':
          return sa === sb ? 1 : 0
        case '!=':
          return sa !== sb ? 1 : 0
        case '<':
          return sa < sb ? 1 : 0
        case '>':
          return sa > sb ? 1 : 0
        case '<=':
          return sa <= sb ? 1 : 0
        case '>=':
          return sa >= sb ? 1 : 0
        default:
          return 0
      }
    }
    let x = Number(a)
    let y = Number(b)
    // Comparing signed with unsigned converts both to unsigned in C; mixed int types share the wider one.
    if (t !== 'f') {
      x = wrap(x, t)
      y = wrap(y, t)
    }
    switch (e.op) {
      case '==':
        return x === y ? 1 : 0
      case '!=':
        return x !== y ? 1 : 0
      case '<':
        return x < y ? 1 : 0
      case '>':
        return x > y ? 1 : 0
      case '<=':
        return x <= y ? 1 : 0
      case '>=':
        return x >= y ? 1 : 0
    }
    const rt = this.typeOf(e)
    return this.arith(e.op, x, y, rt, e.line)
  }

  private arith(op: string, x: number, y: number, t: T, line: number): number {
    if (t === 'f') {
      switch (op) {
        case '+':
          return x + y
        case '-':
          return x - y
        case '*':
          return x * y
        case '/':
          return x / y
        case '%':
          return x % y
        default:
          return wrap(this.arith(op, wrap(x, 'i32'), wrap(y, 'i32'), 'i32', line), 'i32')
      }
    }
    switch (op) {
      case '+':
        return wrap(x + y, t)
      case '-':
        return wrap(x - y, t)
      case '*':
        return t === 'i32' || t === 'u32' ? wrap(Math.imul(x, y), t) : wrap(x * y, t)
      case '/':
        if (y === 0) throw new CodeError('division_by_zero', line)
        return wrap(x / y, t)
      case '%':
        if (y === 0) throw new CodeError('division_by_zero', line)
        return wrap(x % y, t)
      case '&':
        return wrap(x & y, t)
      case '|':
        return wrap(x | y, t)
      case '^':
        return wrap(x ^ y, t)
      case '<<':
        return y >= 32 ? 0 : wrap(x << y, t)
      case '>>':
        return y >= 32 ? (x < 0 ? -1 : 0) : t === 'u32' ? x >>> y : wrap(x >> y, t)
      default:
        return 0
    }
  }

  private isCharExpr(e: Expr): boolean {
    if (e.t === 'char') return true
    if (e.t === 'cast') return e.kind === 'char'
    if (e.t === 'id') return this.findVar(e.name)?.kind === 'char'
    if (e.t === 'index' && e.array.t === 'id') {
      const v = this.findVar(e.array.name)
      return v?.kind === 'char' || (v?.kind === 'str' && !v.arr)
    }
    if (e.t === 'method') return e.method === 'charAt'
    return false
  }

  private target(e: Expr, line: number): Var {
    const name = e.t === 'id' ? e.name : e.t === 'index' && e.array.t === 'id' ? e.array.name : null
    if (!name) throw new CodeError('not_assignable', line)
    return this.lookup(name, line)
  }

  private element(v: Var, idx: number, name: string, line: number) {
    if (!v.arr) {
      if (v.kind === 'str' && typeof v.value === 'string') return
      throw new CodeError('not_an_array', line, { name })
    }
    if (!Number.isInteger(idx) || idx < 0 || idx >= v.arr.length) throw new CodeError('index_out_of_range', line, { name, index: idx, size: v.arr.length })
  }

  private readIndex(e: Expr & { t: 'index' }, idx: number): Value {
    const name = e.array.t === 'id' ? e.array.name : '?'
    const v = this.target(e, e.line)
    this.element(v, idx, name, e.line)
    if (!v.arr) {
      const s = v.value as string
      return idx >= 0 && idx < s.length ? s.charCodeAt(idx) : 0
    }
    return v.arr[idx]
  }

  private assign(e: Expr & { t: 'assign' }, value: Value, idx?: number): Value {
    const v = this.target(e.target, e.line)
    if (v.isConst) throw new CodeError('const_assign', e.line, { name: e.target.t === 'id' ? e.target.name : '' })
    const tt = this.typeOf(e.target)
    const tv = this.typeOf(e.value)
    let next: Value
    if (e.op === '=') next = value
    else {
      const current = idx === undefined ? v.value : (this.element(v, idx, '', e.line), v.arr ? v.arr[idx] : 0)
      const op = e.op.slice(0, -1)
      if (tt === 's' || typeof current === 'string') {
        const add = typeof value === 'string' ? value : this.isCharExpr(e.value) ? String.fromCharCode(value) : formatNumber(value, tv)
        next = op === '+' ? String(current) + add : current
      } else {
        const t = this.common(tt, tv)
        next = this.arith(op, Number(current), Number(value), t, e.line)
      }
    }
    if (idx !== undefined) {
      const name = e.target.t === 'index' && e.target.array.t === 'id' ? e.target.array.name : ''
      this.element(v, idx, name, e.line)
      if (!v.arr) return next
      v.arr[idx] = this.store(v.kind, next, e.op === '=' ? tv : this.common(tt, tv))
      return v.arr[idx]
    }
    if (v.arr) throw new CodeError('not_assignable', e.line)
    v.value = this.store(v.kind, next, e.op === '=' ? tv : this.common(tt, tv))
    return v.value
  }

  private update(e: Expr & { t: 'upd' }, idx?: number): Value {
    const v = this.target(e.target, e.line)
    if (v.isConst) throw new CodeError('const_assign', e.line, { name: e.target.t === 'id' ? e.target.name : '' })
    const name = e.target.t === 'index' && e.target.array.t === 'id' ? e.target.array.name : ''
    if (idx !== undefined) this.element(v, idx, name, e.line)
    const old = Number(idx !== undefined && v.arr ? v.arr[idx] : v.value)
    const t = this.typeOf(e.target)
    const next = this.store(v.kind, e.op === '++' ? old + 1 : old - 1, t)
    if (idx !== undefined && v.arr) v.arr[idx] = next
    else v.value = next
    return e.prefix ? next : old
  }

  // ── Builtins ──────────────────────────────────────────────────────────

  private pin(n: number, line: number): number {
    if (!Number.isInteger(n) || !this.hw.validPin(n)) throw new CodeError('bad_pin', line, { pin: n, board: this.hw.boardId })
    return n
  }

  private builtin(name: string, raw: Value[], e: Expr & { t: 'call' }): Value {
    const a = raw.map((v) => (typeof v === 'string' ? Number.parseFloat(v) || 0 : v))
    const line = e.line
    this.spend(COST[name] ?? 1)
    switch (name) {
      case 'pinMode':
        this.hw.pinMode(this.pin(a[0], line), (a[1] === 1 ? 1 : a[1] === 2 ? 2 : 0) as PinMode)
        return 0
      case 'digitalWrite':
        this.hw.digitalWrite(this.pin(a[0], line), a[1] ? 1 : 0)
        return 0
      case 'digitalRead':
        return this.hw.digitalRead(this.pin(a[0], line))
      case 'analogRead': {
        const p = Number.isInteger(a[0]) ? this.hw.analogPin(a[0]) : null
        if (p === null) throw new CodeError('bad_analog_pin', line, { pin: a[0], board: this.hw.boardId })
        return this.hw.analogRead(p)
      }
      case 'analogWrite':
        this.hw.analogWrite(this.pin(a[0], line), Math.max(0, Math.min(255, Math.trunc(a[1]))))
        return 0
      case 'millis':
        return wrap(Math.floor(this.hw.now / 1000), 'u32')
      case 'micros':
        return wrap(Math.floor(this.hw.now), 'u32')
      case 'tone':
        this.hw.tone(this.pin(a[0], line), a[1], a[2])
        return 0
      case 'noTone':
        this.hw.noTone(this.pin(a[0], line))
        return 0
      case 'map': {
        const [x, inMin, inMax, outMin, outMax] = a.map((v) => wrap(v, 'i32'))
        if (inMax === inMin) throw new CodeError('division_by_zero', line)
        return wrap(Math.trunc(((x - inMin) * (outMax - outMin)) / (inMax - inMin)) + outMin, 'i32')
      }
      case 'constrain':
        return a[0] < a[1] ? a[1] : a[0] > a[2] ? a[2] : a[0]
      case 'min':
        return Math.min(a[0], a[1])
      case 'max':
        return Math.max(a[0], a[1])
      case 'abs':
        return Math.abs(a[0])
      case 'sq':
        return a[0] * a[0]
      case 'sqrt':
        return Math.sqrt(a[0])
      case 'pow':
        return a[0] ** a[1]
      case 'sin':
        return Math.sin(a[0])
      case 'cos':
        return Math.cos(a[0])
      case 'tan':
        return Math.tan(a[0])
      case 'atan2':
        return Math.atan2(a[0], a[1])
      case 'exp':
        return Math.exp(a[0])
      case 'log':
        return Math.log(a[0])
      case 'floor':
        return Math.floor(a[0])
      case 'ceil':
        return Math.ceil(a[0])
      case 'round':
        return Math.round(a[0])
      case 'radians':
        return (a[0] * Math.PI) / 180
      case 'degrees':
        return (a[0] * 180) / Math.PI
      case 'random': {
        const [lo, hi] = a.length === 1 ? [0, a[0]] : [a[0], a[1]]
        if (hi <= lo) return lo
        return Math.floor(lo + this.hw.random() * (hi - lo))
      }
      case 'randomSeed':
        return 0
      case 'bitRead':
        return (a[0] >> a[1]) & 1
      case 'bitSet':
        return a[0] | (1 << a[1])
      case 'bitClear':
        return a[0] & ~(1 << a[1])
      case 'bitWrite':
        return a[2] ? a[0] | (1 << a[1]) : a[0] & ~(1 << a[1])
      case 'highByte':
        return (a[0] >> 8) & 0xff
      case 'lowByte':
        return a[0] & 0xff
      default:
        throw new CodeError('unknown_function', line, { name })
    }
  }

  private *blockingBuiltin(name: string, a: number[], line: number): Generator<void, Value, void> {
    switch (name) {
      case 'delay':
        yield* this.sleep(Math.max(0, a[0]) * 1000)
        return 0
      case 'delayMicroseconds':
        yield* this.sleep(Math.max(0, a[0]))
        return 0
      case 'pulseIn': {
        const r = this.hw.pulseIn(this.pin(a[0], line), a[1] ? 1 : 0, a[2] ?? 1_000_000)
        yield* this.sleep(r.waited)
        return r.us
      }
      default:
        return this.builtin(name, a, { t: 'call', name, args: [], line })
    }
  }

  private print(e: Expr, v: Value, arg?: number): string {
    if (typeof v === 'string') return v
    if (this.isCharExpr(e)) return String.fromCharCode(v)
    return formatNumber(v, this.typeOf(e), arg)
  }

  private method(e: Expr & { t: 'method' }, raw: Value[]): Value {
    const line = e.line
    if (e.object === 'Serial') {
      this.spend(COST[e.method] ?? 2)
      switch (e.method) {
        case 'begin':
          this.hw.serialBegin(Number(raw[0]))
          return 0
        case 'end':
        case 'flush':
          return 0
        case 'setTimeout':
          this.serialTimeoutMs = Number(raw[0])
          return 0
        case 'print':
        case 'println': {
          const text = (raw.length ? this.print(e.args[0], raw[0], raw.length > 1 ? Number(raw[1]) : undefined) : '') + (e.method === 'println' ? '\r\n' : '')
          this.hw.serialWrite(text)
          return text.length
        }
        case 'write': {
          const v = raw[0]
          const text = typeof v === 'string' ? v : String.fromCharCode(Number(v) & 0xff)
          this.hw.serialWrite(text)
          return text.length
        }
        case 'available':
          return this.hw.serialAvailable()
        case 'read':
          return this.hw.serialRead()
        case 'peek':
          return this.hw.serialPeek()
      }
      throw new CodeError('unknown_method', line, { name: `Serial.${e.method}` })
    }
    const v = this.lookup(e.object, line)
    if (v.kind === 'lcd' && v.obj) {
      this.spend(e.method === 'print' ? 400 : 100)
      const args = e.method === 'print' ? [this.print(e.args[0], raw[0], raw.length > 1 ? Number(raw[1]) : undefined)] : raw
      this.hw.lcd(v.obj.id, e.method, args)
      return e.method === 'print' ? String(args[0]).length : 0
    }
    if (v.kind === 'dht' && v.obj) {
      if (e.method === 'begin') return 0
      // A DHT reading takes a few milliseconds of bit-banging on the real sensor.
      this.spend(5000)
      const pin = this.pin(v.obj.pin, line)
      return this.hw.dhtRead(v.obj.id, pin, e.method === 'readHumidity' ? 'humidity' : 'temp', v.obj.type)
    }
    if (v.kind === 'servo' && v.servo) {
      const s = v.servo
      switch (e.method) {
        case 'attach':
          s.pin = this.pin(Number(raw[0]), line)
          this.hw.servoAttach(s.id, s.pin)
          this.hw.servoWrite(s.id, s.angle)
          return 1
        case 'write': {
          const n = Number(raw[0])
          // Values above 544 are pulse widths in µs, as in the Servo library.
          s.angle = n >= 544 ? Math.round(((Math.min(2400, n) - 544) / (2400 - 544)) * 180) : Math.max(0, Math.min(180, Math.trunc(n)))
          if (s.pin !== null) this.hw.servoWrite(s.id, s.angle)
          return 0
        }
        case 'writeMicroseconds': {
          const us = Math.max(544, Math.min(2400, Number(raw[0])))
          s.angle = Math.round(((us - 544) / (2400 - 544)) * 180)
          if (s.pin !== null) this.hw.servoWrite(s.id, s.angle)
          return 0
        }
        case 'read':
          return s.angle
        case 'attached':
          return s.pin === null ? 0 : 1
        case 'detach':
          s.pin = null
          this.hw.servoDetach(s.id)
          return 0
      }
    }
    if (v.kind === 'str') {
      const s = String(v.value)
      switch (e.method) {
        case 'length':
          return s.length
        case 'toInt':
          return wrap(Number.parseInt(s, 10) || 0, 'i32')
        case 'toFloat':
          return Number.parseFloat(s) || 0
        case 'charAt':
          return s.charCodeAt(Number(raw[0])) || 0
        case 'substring':
          return s.substring(Number(raw[0]), raw.length > 1 ? Number(raw[1]) : undefined)
        case 'indexOf':
          return s.indexOf(typeof raw[0] === 'string' ? raw[0] : String.fromCharCode(Number(raw[0])), raw.length > 1 ? Number(raw[1]) : 0)
        case 'equals':
          return s === String(raw[0]) ? 1 : 0
        case 'startsWith':
          return s.startsWith(String(raw[0])) ? 1 : 0
        case 'endsWith':
          return s.endsWith(String(raw[0])) ? 1 : 0
        case 'toUpperCase':
          v.value = s.toUpperCase()
          return 0
        case 'toLowerCase':
          v.value = s.toLowerCase()
          return 0
        case 'trim':
          v.value = s.trim()
          return 0
      }
    }
    throw new CodeError('unknown_method', line, { name: `${e.object}.${e.method}` })
  }

  /** Serial.parseInt and friends wait for input up to the timeout, like the real library. */
  private *serialWait(method: string, args: Value[]): Generator<void, Value, void> {
    const end = this.hw.now + this.serialTimeoutMs * 1000
    const take = (): string => {
      let s = ''
      while (this.hw.serialAvailable() > 0) s += String.fromCharCode(this.hw.serialRead())
      return s
    }
    if (method === 'parseInt' || method === 'parseFloat') {
      let text = ''
      let started = false
      for (;;) {
        while (this.hw.serialAvailable() > 0) {
          const c = String.fromCharCode(this.hw.serialPeek())
          const ok = /[0-9]/.test(c) || (!started && c === '-') || (method === 'parseFloat' && c === '.')
          if (ok) {
            started = true
            text += c
            this.hw.serialRead()
          } else if (started) return method === 'parseInt' ? wrap(Number.parseInt(text, 10) || 0, 'i32') : Number.parseFloat(text) || 0
          else this.hw.serialRead() // skip what is not a number
        }
        if (this.hw.now >= end) return method === 'parseInt' ? wrap(Number.parseInt(text, 10) || 0, 'i32') : Number.parseFloat(text) || 0
        yield* this.sleep(1000)
      }
    }
    if (method === 'readStringUntil') {
      const stop = typeof args[0] === 'string' ? args[0] : String.fromCharCode(Number(args[0]))
      let text = ''
      for (;;) {
        while (this.hw.serialAvailable() > 0) {
          const c = String.fromCharCode(this.hw.serialRead())
          if (c === stop) return text
          text += c
        }
        if (this.hw.now >= end) return text
        yield* this.sleep(1000)
      }
    }
    // readString: everything that arrives until the line goes quiet.
    let text = take()
    while (this.hw.now < end) {
      yield* this.sleep(1000)
      const more = take()
      if (!more && text) break
      text += more
    }
    return text
  }
}
