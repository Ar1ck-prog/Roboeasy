/**
 * Geometry of the workbench: the Arduino Uno, the breadboard and the parts.
 * One grid step (P) is the 2.54 mm pin pitch; every hole, header socket and
 * leg sits on that grid, so a leg "goes into" a hole when their points match.
 */

export const P = 10

export type PartType = 'led' | 'resistor' | 'button' | 'pot' | 'ldr' | 'buzzer' | 'servo' | 'ultrasonic' | 'rgb' | 'pir' | 'dht' | 'lcd' | 'joystick'
export const PART_TYPES: PartType[] = ['led', 'resistor', 'button', 'pot', 'ldr', 'buzzer', 'rgb', 'joystick', 'servo', 'ultrasonic', 'pir', 'dht', 'lcd']
export type LedColor = 'red' | 'yellow' | 'green' | 'blue' | 'white'
export const LED_COLORS: LedColor[] = ['red', 'yellow', 'green', 'blue', 'white']
export const RESISTOR_VALUES = [100, 220, 330, 1000, 4700, 10000] as const

export interface PartProps {
  color?: LedColor
  ohms?: number
  /** Button held down. */
  pressed?: boolean
  /** Potentiometer knob, 0…1. */
  pos?: number
  /** Light on the photoresistor, 0 (dark) … 1 (bright). */
  light?: number
  /** Distance to the obstacle in front of the ultrasonic sensor, cm. */
  distance?: number
  /** Something moves in front of the motion sensor. */
  motion?: boolean
  /** Air around the DHT11: °C and % humidity. */
  temp?: number
  humidity?: number
  /** Joystick stick position, 0…1 on each axis (0.5 is the middle). */
  jx?: number
  jy?: number
}

export interface Part {
  id: string
  type: PartType
  /** Position of the first leg, px. */
  x: number
  y: number
  /** Quarter turns clockwise. */
  rot: 0 | 1 | 2 | 3
  props: PartProps
}

export interface Wire {
  id: string
  a: string
  b: string
  color: string
}

export interface CircuitDoc {
  /** Which board is on the bench (Arduino Uno when missing). */
  board?: BoardId
  parts: Part[]
  wires: Wire[]
}

export interface Point {
  x: number
  y: number
}

// ── Parts ───────────────────────────────────────────────────────────────

/** Legs in grid steps from the first leg, before rotation. */
export const LEGS: Record<PartType, { id: string; dx: number; dy: number }[]> = {
  led: [
    { id: 'a', dx: 0, dy: 0 },
    { id: 'k', dx: 1, dy: 0 },
  ],
  resistor: [
    { id: '1', dx: 0, dy: 0 },
    { id: '2', dx: 4, dy: 0 },
  ],
  // A 6 mm tact switch across the channel: legs above and below the gap are one contact.
  button: [
    { id: '1a', dx: 0, dy: 0 },
    { id: '2a', dx: 2, dy: 0 },
    { id: '1b', dx: 0, dy: 3 },
    { id: '2b', dx: 2, dy: 3 },
  ],
  pot: [
    { id: 'l', dx: 0, dy: 0 },
    { id: 'w', dx: 1, dy: 0 },
    { id: 'r', dx: 2, dy: 0 },
  ],
  ldr: [
    { id: '1', dx: 0, dy: 0 },
    { id: '2', dx: 2, dy: 0 },
  ],
  buzzer: [
    { id: 'p', dx: 0, dy: 0 },
    { id: 'n', dx: 3, dy: 0 },
  ],
  servo: [
    { id: 'gnd', dx: 0, dy: 0 },
    { id: 'vcc', dx: 1, dy: 0 },
    { id: 'sig', dx: 2, dy: 0 },
  ],
  ultrasonic: [
    { id: 'vcc', dx: 0, dy: 0 },
    { id: 'trig', dx: 1, dy: 0 },
    { id: 'echo', dx: 2, dy: 0 },
    { id: 'gnd', dx: 3, dy: 0 },
  ],
  // Common-cathode RGB LED: the long leg (second) is the minus.
  rgb: [
    { id: 'r', dx: 0, dy: 0 },
    { id: 'k', dx: 1, dy: 0 },
    { id: 'g', dx: 2, dy: 0 },
    { id: 'b', dx: 3, dy: 0 },
  ],
  pir: [
    { id: 'vcc', dx: 0, dy: 0 },
    { id: 'out', dx: 1, dy: 0 },
    { id: 'gnd', dx: 2, dy: 0 },
  ],
  dht: [
    { id: 'vcc', dx: 0, dy: 0 },
    { id: 'data', dx: 1, dy: 0 },
    { id: 'gnd', dx: 2, dy: 0 },
  ],
  // The I²C backpack of a 16×2 LCD.
  lcd: [
    { id: 'gnd', dx: 0, dy: 0 },
    { id: 'vcc', dx: 1, dy: 0 },
    { id: 'sda', dx: 2, dy: 0 },
    { id: 'scl', dx: 3, dy: 0 },
  ],
  joystick: [
    { id: 'gnd', dx: 0, dy: 0 },
    { id: 'vcc', dx: 1, dy: 0 },
    { id: 'vrx', dx: 2, dy: 0 },
    { id: 'vry', dx: 3, dy: 0 },
    { id: 'sw', dx: 4, dy: 0 },
  ],
}

export const DEFAULT_PROPS: Record<PartType, PartProps> = {
  led: { color: 'red' },
  resistor: { ohms: 220 },
  button: { pressed: false },
  pot: { pos: 0.5 },
  ldr: { light: 0.5 },
  buzzer: {},
  servo: {},
  ultrasonic: { distance: 30 },
  rgb: {},
  pir: { motion: false },
  dht: { temp: 24, humidity: 45 },
  lcd: {},
  joystick: { jx: 0.5, jy: 0.5, pressed: false },
}

/** Parts that are modules on their own little board (they sit beside the breadboard and take wires). */
export const MODULES = new Set<PartType>(['servo', 'ultrasonic', 'pir', 'dht', 'lcd', 'joystick'])

export function rotate(dx: number, dy: number, rot: number): [number, number] {
  switch (rot & 3) {
    case 1:
      return [-dy, dx]
    case 2:
      return [-dx, -dy]
    case 3:
      return [dy, -dx]
    default:
      return [dx, dy]
  }
}

export function legPoints(part: Part): { id: string; terminal: string; x: number; y: number }[] {
  return LEGS[part.type].map((l) => {
    const [dx, dy] = rotate(l.dx, l.dy, part.rot)
    return { id: l.id, terminal: `${part.id}.${l.id}`, x: part.x + dx * P, y: part.y + dy * P }
  })
}

// ── Boards ──────────────────────────────────────────────────────────────

export type BoardId = 'uno' | 'esp32'
export const BOARD_IDS: BoardId[] = ['uno', 'esp32']

export interface Header {
  terminal: string
  label: string
  x: number
  y: number
}

/** Everything the bench and the simulator need to know about a board. */
export interface BoardProfile {
  id: BoardId
  /** Terminal prefix: `uno.D13`, `esp.G2`. */
  prefix: string
  /** Where the board is drawn on the bench. */
  rect: { x: number; y: number; w: number; h: number }
  headers: Header[]
  /** Terminals that are one conductor on the board itself. */
  bonds: [string, string][]
  /** Pin number → terminal name without the prefix; null where there is no such pin. */
  pinNames: (string | null)[]
  pwm: (pin: number) => boolean
  /** Pins that can only read (ESP32 GPIO 34–39). */
  inputOnly: Set<number>
  /** Logic level, volts: 5 on the Uno, 3.3 on the ESP32. */
  logicV: number
  /** Inputs read HIGH above `vih` and LOW below `vil`. */
  vih: number
  vil: number
  pinOhms: number
  pullupOhms: number
  maxPinA: number
  /** Supply terminals (without prefix) with their voltage and internal resistance. */
  supplies: { name: string; volts: number; ohms: number }[]
  /** One of the ground terminals (without prefix). */
  ground: string
  intBits: 16 | 32
  /** analogRead() range: 1023 on the Uno, 4095 on the ESP32. */
  adcMax: number
  builtinLed: number
  /** Names the sketch can use for pins: LED_BUILTIN, A0… */
  constants: Record<string, number>
  /** The pin analogRead(n) reads, or null when n is not an analog input. */
  analogPin: (n: number) => number | null
  defaultBaud: number
  /** I²C pins (SDA, SCL) for displays. */
  i2c: { sda: number; scl: number }
}

/** Where the Uno sits on the bench. Its size is that of the real board (68.6 × 53.3 mm). */
export const UNO = { x: 20, y: 50, w: 270, h: 210 }

/** Uno pins: D0–D13 are 0–13, A0–A5 are 14–19. */
export const UNO_PINS = [...Array.from({ length: 14 }, (_, i) => `D${i}`), ...Array.from({ length: 6 }, (_, i) => `A${i}`)]
export const PWM_PINS = new Set([3, 5, 6, 9, 10, 11])

export function pinNumber(terminal: string): number | null {
  const m = /^uno\.(D|A)(\d+)$/.exec(terminal)
  if (!m) return null
  const n = Number(m[2])
  return m[1] === 'D' ? (n < 14 ? n : null) : n < 6 ? 14 + n : null
}

/** Header sockets, left to right as on the real board with the USB jack on the left. */
export const UNO_HEADERS: Header[] = (() => {
  const top: string[] = ['SCL', 'SDA', 'AREF', 'GND.3', 'D13', 'D12', 'D11', 'D10', 'D9', 'D8', '', 'D7', 'D6', 'D5', 'D4', 'D3', 'D2', 'D1', 'D0']
  const bottom: string[] = ['', 'IOREF', 'RESET', '3V3', '5V', 'GND.1', 'GND.2', 'VIN', '', 'A0', 'A1', 'A2', 'A3', 'A4', 'A5']
  const list: Header[] = []
  top.forEach((name, i) => {
    if (!name) return
    list.push({ terminal: `uno.${name}`, label: name.replace(/\.\d$/, ''), x: UNO.x + 80 + i * P, y: UNO.y + 10 })
  })
  bottom.forEach((name, i) => {
    if (!name) return
    list.push({ terminal: `uno.${name}`, label: name.replace(/\.\d$/, ''), x: UNO.x + 100 + i * P, y: UNO.y + UNO.h - 10 })
  })
  return list
})()

export const UNO_BONDS: [string, string][] = [
  ['uno.GND.1', 'uno.GND.2'],
  ['uno.GND.1', 'uno.GND.3'],
  ['uno.SDA', 'uno.A4'],
  ['uno.SCL', 'uno.A5'],
  ['uno.IOREF', 'uno.5V'],
]

/** ESP32 DevKit V1 (30 pins), lying with the USB jack on the left and the antenna on the right. */
export const ESP32 = { x: 30, y: 110, w: 240, h: 120 }

/** Header pins of the DevKit: [terminal name, silkscreen label]. */
const ESP_TOP: [string, string][] = [
  ['VIN', 'VIN'], ['GND.1', 'GND'], ['G13', 'D13'], ['G12', 'D12'], ['G14', 'D14'], ['G27', 'D27'], ['G26', 'D26'], ['G25', 'D25'],
  ['G33', 'D33'], ['G32', 'D32'], ['G35', 'D35'], ['G34', 'D34'], ['G39', 'VN'], ['G36', 'VP'], ['EN', 'EN'],
]
const ESP_BOTTOM: [string, string][] = [
  ['3V3', '3V3'], ['GND.2', 'GND'], ['G15', 'D15'], ['G2', 'D2'], ['G4', 'D4'], ['G16', 'RX2'], ['G17', 'TX2'], ['G5', 'D5'],
  ['G18', 'D18'], ['G19', 'D19'], ['G21', 'D21'], ['G3', 'RX0'], ['G1', 'TX0'], ['G22', 'D22'], ['G23', 'D23'],
]

export const ESP32_HEADERS: Header[] = [
  ...ESP_TOP.map(([name, label], i) => ({ terminal: `esp.${name}`, label, x: ESP32.x + 50 + i * P, y: ESP32.y + 10 })),
  ...ESP_BOTTOM.map(([name, label], i) => ({ terminal: `esp.${name}`, label, x: ESP32.x + 50 + i * P, y: ESP32.y + ESP32.h - 10 })),
]

/** ESP32 pins the analog-to-digital converter can read. */
const ESP_ADC = new Set([0, 2, 4, 12, 13, 14, 15, 25, 26, 27, 32, 33, 34, 35, 36, 39])
const ESP_GPIO = new Set([...ESP_TOP, ...ESP_BOTTOM].map(([name]) => name).filter((n) => n.startsWith('G')))

export const BOARDS: Record<BoardId, BoardProfile> = {
  uno: {
    id: 'uno',
    prefix: 'uno',
    rect: UNO,
    headers: UNO_HEADERS,
    bonds: UNO_BONDS,
    pinNames: UNO_PINS,
    pwm: (p) => PWM_PINS.has(p),
    inputOnly: new Set(),
    logicV: 5,
    vih: 3,
    vil: 1.5,
    pinOhms: 25,
    pullupOhms: 35_000,
    maxPinA: 0.04,
    supplies: [
      { name: '5V', volts: 5, ohms: 0.05 },
      { name: '3V3', volts: 3.3, ohms: 1 },
    ],
    ground: 'GND.1',
    intBits: 16,
    adcMax: 1023,
    builtinLed: 13,
    constants: { LED_BUILTIN: 13, A0: 14, A1: 15, A2: 16, A3: 17, A4: 18, A5: 19 },
    analogPin: (n) => (n >= 0 && n < 6 ? 14 + n : n >= 14 && n < 20 ? n : null),
    defaultBaud: 9600,
    i2c: { sda: 18, scl: 19 },
  },
  esp32: {
    id: 'esp32',
    prefix: 'esp',
    rect: ESP32,
    headers: ESP32_HEADERS,
    bonds: [['esp.GND.1', 'esp.GND.2']],
    pinNames: Array.from({ length: 40 }, (_, g) => (ESP_GPIO.has(`G${g}`) ? `G${g}` : null)),
    pwm: () => true,
    inputOnly: new Set([34, 35, 36, 39]),
    logicV: 3.3,
    vih: 2.475,
    vil: 0.825,
    pinOhms: 30,
    pullupOhms: 45_000,
    maxPinA: 0.04,
    supplies: [
      { name: 'VIN', volts: 5, ohms: 0.05 },
      { name: '3V3', volts: 3.3, ohms: 0.5 },
    ],
    ground: 'GND.1',
    intBits: 32,
    adcMax: 4095,
    builtinLed: 2,
    constants: {
      LED_BUILTIN: 2, BUILTIN_LED: 2,
      A0: 36, A3: 39, A4: 32, A5: 33, A6: 34, A7: 35, A10: 4, A11: 0, A12: 2, A13: 15, A14: 13, A15: 12, A16: 14, A17: 27, A18: 25, A19: 26,
    },
    analogPin: (n) => (ESP_ADC.has(n) ? n : null),
    defaultBaud: 115200,
    i2c: { sda: 21, scl: 22 },
  },
}

export const boardOf = (doc: Pick<CircuitDoc, 'board'>): BoardProfile => BOARDS[doc.board ?? 'uno']

/** The board pin a header terminal is, or null for power pins. */
export function boardPin(board: BoardProfile, terminal: string): number | null {
  const name = terminal.slice(board.prefix.length + 1)
  const i = board.pinNames.indexOf(name)
  return i >= 0 ? i : null
}

// ── Breadboard ──────────────────────────────────────────────────────────

/** A half-size breadboard: 30 columns, rows a–j, two power rails on each side. */
export const BB = { x: 320, y: 40, cols: 30, w: 320, h: 230 }
const ROWS_TOP = ['a', 'b', 'c', 'd', 'e']
const ROWS_BOTTOM = ['f', 'g', 'h', 'i', 'j']

export interface Hole {
  terminal: string
  /** The strip this hole belongs to (everything in one strip is one wire). */
  strip: string
  x: number
  y: number
  rail?: '+' | '-'
}

export const BB_ROW_Y: Record<string, number> = {
  tn: BB.y + 10,
  tp: BB.y + 20,
  a: BB.y + 50,
  b: BB.y + 60,
  c: BB.y + 70,
  d: BB.y + 80,
  e: BB.y + 90,
  f: BB.y + 120,
  g: BB.y + 130,
  h: BB.y + 140,
  i: BB.y + 150,
  j: BB.y + 160,
  bp: BB.y + 190,
  bn: BB.y + 200,
}

export const bbColX = (col: number) => BB.x + 10 + (col - 1) * P

export const BB_HOLES: Hole[] = (() => {
  const holes: Hole[] = []
  for (let c = 1; c <= BB.cols; c++) {
    const x = bbColX(c)
    for (const r of ROWS_TOP) holes.push({ terminal: `bb.${r}${c}`, strip: `bb:${c}top`, x, y: BB_ROW_Y[r] })
    for (const r of ROWS_BOTTOM) holes.push({ terminal: `bb.${r}${c}`, strip: `bb:${c}bot`, x, y: BB_ROW_Y[r] })
    for (const [r, rail] of [['tn', '-'], ['tp', '+'], ['bp', '+'], ['bn', '-']] as const)
      holes.push({ terminal: `bb.${r}${c}`, strip: `bb:${r}`, x, y: BB_ROW_Y[r], rail })
  }
  return holes
})()

/** Everything a leg can be pushed into: breadboard holes and the board's header sockets. */
const socketCache = new Map<BoardId, { list: { terminal: string; x: number; y: number }[]; at: Map<string, string> }>()
function sockets(board: BoardId) {
  let c = socketCache.get(board)
  if (!c) {
    const list = [...BB_HOLES, ...BOARDS[board].headers]
    c = { list, at: new Map(list.map((h) => [`${h.x},${h.y}`, h.terminal])) }
    socketCache.set(board, c)
  }
  return c
}
export const socketsFor = (board: BoardId = 'uno') => sockets(board).list
export const socketAtPoint = (x: number, y: number, board: BoardId = 'uno') => sockets(board).at.get(`${x},${y}`) ?? null

export const BENCH = { w: 780, h: 500 }

/** Where a terminal is drawn, for wires. */
export function terminalPoint(terminal: string, parts: Part[], board: BoardId = 'uno'): Point | null {
  const s = socketsFor(board).find((x) => x.terminal === terminal)
  if (s) return { x: s.x, y: s.y }
  const dot = terminal.indexOf('.')
  const part = parts.find((p) => p.id === terminal.slice(0, dot))
  if (!part) return null
  const leg = legPoints(part).find((l) => l.terminal === terminal)
  return leg ? { x: leg.x, y: leg.y } : null
}

// ── Nets ────────────────────────────────────────────────────────────────

/** Joins terminals that are one conductor: strips, the board's own bonds, legs in holes, wires. */
export function buildNets(doc: CircuitDoc): Map<string, string> {
  const parent = new Map<string, string>()
  const find = (a: string): string => {
    let r = parent.get(a) ?? a
    if (r !== a) {
      r = find(r)
      parent.set(a, r)
    }
    return r
  }
  const union = (a: string, b: string) => {
    const ra = find(a)
    const rb = find(b)
    if (ra !== rb) parent.set(ra, rb)
  }
  const board = boardOf(doc)
  for (const h of BB_HOLES) union(h.terminal, h.strip)
  for (const h of board.headers) find(h.terminal)
  for (const [a, b] of board.bonds) union(a, b)
  for (const part of doc.parts) {
    for (const leg of legPoints(part)) {
      const socket = socketAtPoint(leg.x, leg.y, board.id)
      if (socket) union(leg.terminal, socket)
      else find(leg.terminal)
    }
    if (part.type === 'button') {
      union(`${part.id}.1a`, `${part.id}.1b`)
      union(`${part.id}.2a`, `${part.id}.2b`)
    }
  }
  for (const w of doc.wires) union(w.a, w.b)
  const nets = new Map<string, string>()
  for (const key of parent.keys()) nets.set(key, find(key))
  return nets
}
