/**
 * Geometry of the workbench: the Arduino Uno, the breadboard and the parts.
 * One grid step (P) is the 2.54 mm pin pitch; every hole, header socket and
 * leg sits on that grid, so a leg "goes into" a hole when their points match.
 */

export const P = 10

export type PartType = 'led' | 'resistor' | 'button' | 'pot' | 'ldr' | 'buzzer' | 'servo' | 'ultrasonic'
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
}

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

// ── Arduino Uno ─────────────────────────────────────────────────────────

/** Where the Uno sits on the bench. Its size is that of the real board (68.6 × 53.3 mm). */
export const UNO = { x: 20, y: 50, w: 270, h: 210 }

export interface Header {
  terminal: string
  label: string
  x: number
  y: number
}

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

/** Terminals that are one wire on the board itself. */
export const UNO_BONDS: [string, string][] = [
  ['uno.GND.1', 'uno.GND.2'],
  ['uno.GND.1', 'uno.GND.3'],
  ['uno.SDA', 'uno.A4'],
  ['uno.SCL', 'uno.A5'],
  ['uno.IOREF', 'uno.5V'],
]

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

/** Everything a leg can be pushed into: breadboard holes and the Uno's header sockets. */
export const SOCKETS: { terminal: string; x: number; y: number }[] = [...BB_HOLES, ...UNO_HEADERS]
const socketAt = new Map(SOCKETS.map((s) => [`${s.x},${s.y}`, s.terminal]))
export const socketAtPoint = (x: number, y: number) => socketAt.get(`${x},${y}`) ?? null

export const BENCH = { w: 680, h: 420 }

/** Where a terminal is drawn, for wires. */
export function terminalPoint(terminal: string, parts: Part[]): Point | null {
  const s = SOCKETS.find((x) => x.terminal === terminal)
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
  for (const h of BB_HOLES) union(h.terminal, h.strip)
  for (const h of UNO_HEADERS) find(h.terminal)
  for (const [a, b] of UNO_BONDS) union(a, b)
  for (const part of doc.parts) {
    for (const leg of legPoints(part)) {
      const socket = socketAtPoint(leg.x, leg.y)
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
