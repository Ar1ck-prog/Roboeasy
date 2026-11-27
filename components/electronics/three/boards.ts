/**
 * The boards in 3D, assembled from the procedural kit: Arduino Uno R3 and
 * ESP32 DevKit V1. Positions are millimetres from the board's left and top
 * edges, as on a drawing; `place()` turns them into world coordinates.
 * Each named part is its own Group, so it can be picked, lit up and lifted.
 */

import type * as THREE_NS from 'three'

import { type Kit, PITCH } from './kit'

type Three = typeof THREE_NS

export type Board3DId = 'uno' | 'esp32'

export interface Built {
  root: THREE_NS.Group
  /** Named, clickable parts. */
  parts: Map<string, THREE_NS.Group>
  /** Where each part's label points (world). */
  anchors: Map<string, THREE_NS.Vector3>
  /** How far each part rises when the board is taken apart. */
  lift: Map<string, number>
  /** Part ids of LEDs that blink like a running Blink sketch. */
  blink: string[]
  size: { L: number; W: number }
  /** Lowest point (pins under the board), for the shadow plane. */
  floor: number
  /** Taking apart lifts the whole board by this much too (parts with a negative lift stay down). */
  baseLift?: number
  /** One header pin, as a bench terminal and its spot on the board (x, z from the centre): the lab lines the board up with the bench by it. */
  pinRef: { terminal: string; local: [number, number] }
  /** Height of the tops of the header pins or sockets, where wires plug in. */
  socketY: number
  /** Camera positions for the views. */
  views: Record<'iso' | 'top' | 'front', [number, number, number]>
}

/** A tiny seeded random generator, so the traces look the same every time. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0
    return seed / 2 ** 32
  }
}

interface ArtSpec {
  L: number
  W: number
  base: string
  trace: string
  silk: string
  /** Pads (gold) as [x, z, w, d, round]. */
  pads: [number, number, number, number, boolean][]
  /** Silkscreen texts: [text, x, z, size(mm), rotation, weight, align, italic]. */
  texts: [string, number, number, number, number?, number?, CanvasTextAlign?, boolean?][]
  /** Silkscreen outlines: [x, z, w, d]. */
  outlines: [number, number, number, number][]
  holes: [number, number, number][]
  seed: number
  traces: number
  extra?: (g: CanvasRenderingContext2D, s: number) => void
}

/** The top of a board drawn on a canvas: mask, copper traces, vias, pads, silkscreen. */
function drawArt(spec: ArtSpec): HTMLCanvasElement {
  const s = 26 // px per mm
  const c = document.createElement('canvas')
  c.width = Math.round(spec.L * s)
  c.height = Math.round(spec.W * s)
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, c.width, c.height)
  grad.addColorStop(0, spec.base)
  grad.addColorStop(1, spec.base)
  g.fillStyle = grad
  g.fillRect(0, 0, c.width, c.height)
  const r = rng(spec.seed)
  g.strokeStyle = spec.trace
  g.lineCap = 'round'
  g.lineJoin = 'round'
  for (let i = 0; i < spec.traces; i++) {
    let x = (5 + r() * (spec.L - 10)) * s
    let y = (4 + r() * (spec.W - 8)) * s
    g.lineWidth = (0.18 + r() * 0.3) * s
    g.beginPath()
    g.moveTo(x, y)
    const steps = 2 + Math.floor(r() * 3)
    for (let k = 0; k < steps; k++) {
      const len = (2 + r() * 10) * s
      const dir = Math.floor(r() * 8) * (Math.PI / 4)
      x = Math.max(3 * s, Math.min((spec.L - 3) * s, x + Math.cos(dir) * len))
      y = Math.max(3 * s, Math.min((spec.W - 3) * s, y + Math.sin(dir) * len))
      g.lineTo(x, y)
    }
    g.stroke()
    // A via at the end of the trace
    g.fillStyle = '#c9a54a'
    g.beginPath()
    g.arc(x, y, 0.42 * s, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = spec.base
    g.beginPath()
    g.arc(x, y, 0.18 * s, 0, Math.PI * 2)
    g.fill()
  }
  for (const [hx, hz, hr] of spec.holes) {
    g.fillStyle = '#d0ad55'
    g.beginPath()
    g.arc(hx * s, hz * s, (hr + 1.1) * s, 0, Math.PI * 2)
    g.fill()
  }
  for (const [x, z, w, d, round] of spec.pads) {
    g.fillStyle = '#d6b45a'
    if (round) {
      g.beginPath()
      g.arc(x * s, z * s, (w / 2) * s, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#3a3324'
      g.beginPath()
      g.arc(x * s, z * s, (w / 4) * s, 0, Math.PI * 2)
      g.fill()
    } else g.fillRect((x - w / 2) * s, (z - d / 2) * s, w * s, d * s)
  }
  g.strokeStyle = spec.silk
  g.lineWidth = 0.15 * s
  for (const [x, z, w, d] of spec.outlines) g.strokeRect((x - w / 2) * s, (z - d / 2) * s, w * s, d * s)
  g.fillStyle = spec.silk
  g.textBaseline = 'middle'
  for (const [text, x, z, size, rot = 0, weight = 700, align = 'center', italic = false] of spec.texts) {
    g.save()
    g.translate(x * s, z * s)
    g.rotate(rot)
    g.textAlign = align
    g.font = `${italic ? 'italic ' : ''}${weight} ${size * s}px system-ui, "Segoe UI", sans-serif`
    g.fillText(text, 0, 0)
    g.restore()
  }
  spec.extra?.(g, s)
  return c
}

const SMD_SPOTS = (seed: number, n: number, area: [number, number, number, number], avoid: [number, number, number, number][]) => {
  const r = rng(seed)
  const out: { x: number; z: number; rot: boolean; kind: 'r' | 'c' }[] = []
  for (let i = 0; out.length < n && i < n * 30; i++) {
    const x = area[0] + r() * (area[2] - area[0])
    const z = area[1] + r() * (area[3] - area[1])
    if (avoid.some(([ax, az, aw, ad]) => Math.abs(x - ax) < aw / 2 + 1.5 && Math.abs(z - az) < ad / 2 + 1.5)) continue
    if (out.some((o) => Math.hypot(o.x - x, o.z - z) < 2.6)) continue
    out.push({ x, z, rot: r() > 0.5, kind: r() > 0.55 ? 'c' : 'r' })
  }
  return out
}

function frame(T: Three, L: number, W: number) {
  const root = new T.Group()
  const parts = new Map<string, THREE_NS.Group>()
  const anchors = new Map<string, THREE_NS.Vector3>()
  const lift = new Map<string, number>()
  const wx = (mm: number) => mm - L / 2
  const wz = (mm: number) => mm - W / 2
  /** Adds a part (or decoration) at x/z mm on the board top. */
  const place = (obj: THREE_NS.Object3D, x: number, z: number, y: number, rotY = 0) => {
    obj.position.set(wx(x), y, wz(z))
    obj.rotation.y = rotY
    return obj
  }
  const part = (id: string, up: number, anchor: [number, number, number]) => {
    let g = parts.get(id)
    if (!g) {
      g = new T.Group()
      g.userData.part = id
      parts.set(id, g)
      root.add(g)
      lift.set(id, up)
      anchors.set(id, new T.Vector3(wx(anchor[0]), anchor[1], wz(anchor[2])))
    }
    return g
  }
  return { root, parts, anchors, lift, wx, wz, place, part }
}

// ── Arduino Uno R3 ──────────────────────────────────────────────────────

export function buildUno(T: Three, kit: Kit): Built {
  const L = 68.6
  const W = 53.3
  const thick = 1.6
  const top = thick + 0.12
  const { root, parts, anchors, lift, place, part } = frame(T, L, W)

  // Header positions match the bench (lib/electronics/board.ts: UNO_HEADERS), on the 2.54 mm grid.
  const X_TOP10 = 20.32
  const X_TOP8 = 48.26
  const X_POWER = 25.4
  const X_ANALOG = 48.26
  const Z_TOP = 2.54
  const Z_BOTTOM = W - 2.54
  const holes: [number, number, number][] = [
    [14, 2.5, 1.6],
    [15.2, W - 2.5, 1.6],
    [66, 7.6, 1.6],
    [66, 35.5, 1.6],
  ]
  const pinPads = (x0: number, n: number, z: number) => Array.from({ length: n }, (_, i) => [x0 + i * PITCH, z, 1.7, 1.7, true] as [number, number, number, number, boolean])
  const art = drawArt({
    L,
    W,
    base: '#0f7d87',
    trace: '#14929c',
    silk: '#f4f7f8',
    seed: 11,
    traces: 120,
    holes,
    pads: [
      ...pinPads(X_TOP10, 10, Z_TOP),
      ...pinPads(X_TOP8, 8, Z_TOP),
      ...pinPads(X_POWER, 8, Z_BOTTOM),
      ...pinPads(X_ANALOG, 6, Z_BOTTOM),
    ],
    outlines: [
      [50, 40, 39, 11],
      [19, 17, 7, 7],
      [64.6, 29, 6.2, 8.6],
      [23, 6, 6.2, 4],
    ],
    texts: [
      ...['SCL', 'SDA', 'AREF', 'GND', '13', '12', '~11', '~10', '~9', '8'].map((t, i) => [t, X_TOP10 + i * PITCH, Z_TOP + 3.1, 1.05, -Math.PI / 2, 700, 'right'] as ArtSpec['texts'][number]),
      ...['7', '~6', '~5', '4', '~3', '2', 'TX→1', 'RX←0'].map((t, i) => [t, X_TOP8 + i * PITCH, Z_TOP + 3.1, 1.05, -Math.PI / 2, 700, 'right'] as ArtSpec['texts'][number]),
      ...['', 'IOREF', 'RESET', '3.3V', '5V', 'GND', 'GND', 'VIN'].map((t, i) => [t, X_POWER + i * PITCH, Z_BOTTOM - 3.1, 1.05, -Math.PI / 2, 700, 'left'] as ArtSpec['texts'][number]),
      ...['A0', 'A1', 'A2', 'A3', 'A4', 'A5'].map((t, i) => [t, X_ANALOG + i * PITCH, Z_BOTTOM - 3.1, 1.05, -Math.PI / 2, 700, 'left'] as ArtSpec['texts'][number]),
      ['DIGITAL (PWM~)', 46, 11.8, 1.45, 0, 800],
      ['POWER', 36.5, W - 11.2, 1.45, 0, 800],
      ['ANALOG IN', 57.2, W - 11.2, 1.45, 0, 800],
      ['UNO', 50.5, 23.5, 7, 0, 900, 'center', true],
      ['R3 · RoboEasy', 50.5, 28.8, 1.5, 0, 700],
      ['L', 27.2, 11, 1.1],
      ['TX', 27.2, 16, 1],
      ['RX', 27.2, 18.2, 1],
      ['ON', 62.3, 19, 1],
      ['RESET', 7, 9, 1],
      ['ICSP', 64.6, 23.7, 1],
      ['MADE FOR LEARNING', 50, 49.5, 1.1, 0, 600],
    ],
  })
  root.add(kit.pcb(L, W, thick, 0x0c6a73, art, holes, 1.8))

  // USB-B sticks out of the left edge; the power jack below it.
  place(part('usb', 22, [4, 13, 15]).add(kit.usbB()), 1.7, 15.5, top)
  place(part('jack', 22, [5, 13, 45]).add(kit.barrelJack()), 5.2, 45, top)
  // Regulator and the two electrolytic capacitors by the jack
  place(part('regulator', 16, [19, 4, 46]).add(kit.sot223()), 19, 46, top)
  const caps = part('caps', 18, [26, 8, 41])
  caps.add(place(kit.electrolytic(3.1, 5.2), 26.5, 37.5, top))
  caps.add(place(kit.electrolytic(3.1, 5.2), 26.5, 46.8, top))
  // USB bridge chip and its crystal
  place(part('bridge', 14, [19, 3, 17]).add(kit.flatChip(5, 8, '16U2', false)), 19, 17, top, Math.PI / 4)
  place(part('crystal', 16, [36, 6, 33]).add(kit.crystal()), 36, 33, top)
  // Reset button
  place(part('reset', 16, [7, 5, 4.6]).add(kit.tactile(6, 0xc62828)), 7, 4.6, top)
  // The ATmega328P in its socket
  place(part('mcu', 26, [50, 8, 40]).add(kit.dip(28, 'ATMEGA328P')), 50, 40, top)
  // Female headers
  const digital = part('digital', 12, [40, 10, Z_TOP])
  digital.add(place(kit.femaleHeader(10), X_TOP10 + 4.5 * PITCH, Z_TOP, top))
  digital.add(place(kit.femaleHeader(8), X_TOP8 + 3.5 * PITCH, Z_TOP, top))
  place(part('power', 12, [36, 10, Z_BOTTOM]).add(kit.femaleHeader(8)), X_POWER + 3.5 * PITCH, Z_BOTTOM, top)
  place(part('analog', 12, [57, 10, Z_BOTTOM]).add(kit.femaleHeader(6)), X_ANALOG + 2.5 * PITCH, Z_BOTTOM, top)
  // ICSP headers (main chip on the right, the USB chip at the top)
  const icsp = part('icsp', 14, [64.6, 9, 29])
  icsp.add(place(kit.maleHeader(2, 3, 6), 64.6, 29, top, Math.PI / 2))
  icsp.add(place(kit.maleHeader(3, 2, 6), 23, 6, top))
  // Op-amp that drives LED L, the polyfuse by the USB jack
  root.add(place(kit.smallChip(4.9, 3.9, 4), 31, 25.5, top))
  const fuse = place(kit.smd('c'), 8, 26, top, Math.PI / 2)
  fuse.scale.set(2, 1.4, 1.8)
  root.add(fuse)
  // LEDs
  const led = (id: string, x: number, z: number, color: number) => {
    const g = part(id, 10, [x, 3, z])
    const l = kit.smd('led', color)
    g.add(place(l, x, z, top))
  }
  led('led', 29.7, 11, 0xffa000)
  const txrx = part('txrx', 10, [29.7, 3, 17])
  for (const z of [16, 18.2]) {
    const l = kit.smd('led', 0xffa000)
    txrx.add(place(l, 29.7, z, top))
  }
  led('on', 60, 19, 0x34c759)
  // A scatter of SMD resistors and capacitors where there is room
  const avoid: [number, number, number, number][] = [
    [50, 40, 40, 12],
    [19, 17, 8, 8],
    [36, 33, 12, 6],
    [19, 46, 8, 7],
    [26.5, 42, 8, 16],
    [7, 4.6, 7, 7],
    [9, 15.5, 18, 14],
    [5, 45, 16, 12],
    [64.6, 29, 8, 9],
    [23, 6, 9, 6],
    [31, 25.5, 7, 6],
    [29.7, 14, 3, 10],
    [60, 19, 3, 3],
    [50.5, 26, 22, 12],
    [46, 11.8, 34, 4],
    [40, 2.4, 60, 6],
    [42, W - 2.4, 50, 6],
    [46, W - 11.2, 32, 4],
  ]
  for (const p of SMD_SPOTS(5, 26, [12, 6, 64, 48], avoid)) root.add(place(kit.smd(p.kind), p.x, p.z, top, p.rot ? Math.PI / 2 : 0))

  return {
    root,
    parts,
    anchors,
    lift,
    blink: ['led'],
    size: { L, W },
    floor: -0.2,
    views: { iso: [-46, 52, 62], top: [0, 92, 0.01], front: [0, 22, 92] },
    pinRef: { terminal: 'uno.SCL', local: [X_TOP10 - L / 2, Z_TOP - W / 2] },
    socketY: top + 8.5,
  }
}

// ── ESP32 DevKit V1 ─────────────────────────────────────────────────────

/** `labPins`: the header pins point up (the lab plugs wires onto them), not down into a breadboard. */
export function buildEsp32(T: Three, kit: Kit, opts: { labPins?: boolean } = {}): Built {
  const L = 51.4
  const W = 28.3
  const thick = 1.6
  const top = thick + 0.12
  const { root, parts, anchors, lift, place, part } = frame(T, L, W)
  const X0 = 7.3
  // Rows 25.4 mm apart, as on the bench.
  const Z_TOP = 1.45
  const Z_BOTTOM = W - 1.45
  const topLabels = ['VIN', 'GND', 'D13', 'D12', 'D14', 'D27', 'D26', 'D25', 'D33', 'D32', 'D35', 'D34', 'VN', 'VP', 'EN']
  const bottomLabels = ['3V3', 'GND', 'D15', 'D2', 'D4', 'RX2', 'TX2', 'D5', 'D18', 'D19', 'D21', 'RX0', 'TX0', 'D22', 'D23']
  const holes: [number, number, number][] = [
    [1.8, 1.8, 0.9],
    [1.8, W - 1.8, 0.9],
  ]
  const art = drawArt({
    L,
    W,
    base: '#1a1d24',
    trace: '#232833',
    silk: '#eef1f4',
    seed: 23,
    traces: 60,
    holes,
    pads: [...topLabels.map((_, i) => [X0 + i * PITCH, Z_TOP, 1.7, 1.7, true] as [number, number, number, number, boolean]), ...bottomLabels.map((_, i) => [X0 + i * PITCH, Z_BOTTOM, 1.7, 1.7, true] as [number, number, number, number, boolean])],
    outlines: [
      [11, W / 2, 6.5, 6.5],
      [4.2, 6, 5, 5],
      [4.2, W - 6, 5, 5],
    ],
    texts: [
      ...topLabels.map((t, i) => [t, X0 + i * PITCH, Z_TOP + 2.1, 0.95, -Math.PI / 2, 700, 'right'] as ArtSpec['texts'][number]),
      ...bottomLabels.map((t, i) => [t, X0 + i * PITCH, Z_BOTTOM - 2.1, 0.95, -Math.PI / 2, 700, 'left'] as ArtSpec['texts'][number]),
      ['EN', 4.2, 9.3, 0.95],
      ['BOOT', 4.2, W - 9.3, 0.95],
      ['ESP32 DEVKIT V1', 19.6, W / 2 + 3.4, 1, 0, 800],
      ['RoboEasy', 19.6, W / 2 + 5.4, 0.9, 0, 700],
    ],
  })
  root.add(kit.pcb(L, W, thick, 0x16181e, art, holes, 1.2))

  // The WROOM module with its antenna over the board's right end
  const antennaArt = (() => {
    const s = 30
    const c = document.createElement('canvas')
    c.width = Math.round(25.5 * s)
    c.height = Math.round(18 * s)
    const g = c.getContext('2d')!
    g.fillStyle = '#15171c'
    g.fillRect(0, 0, c.width, c.height)
    g.strokeStyle = '#c9a54a'
    g.lineWidth = 0.55 * s
    g.lineJoin = 'miter'
    g.beginPath()
    let x = 19.2 * s
    g.moveTo(x, 2 * s)
    for (let i = 0; i < 6; i++) {
      g.lineTo(x, 15.5 * s)
      x += 0.9 * s
      g.lineTo(x, 15.5 * s)
      g.lineTo(x, 3 * s)
      x += 0.9 * s
      g.lineTo(x, 3 * s)
    }
    g.stroke()
    return c
  })()
  const module = part('module', 18, [35, 6, W / 2])
  module.add(place(kit.wroom(antennaArt), 38.6, W / 2, top))
  // An invisible box over the antenna so it can be picked on its own
  const antenna = part('antenna', 18, [48, 3, W / 2])
  const hit = kit.box(6, 0.9, 17, new T.MeshBasicMaterial({ visible: false }))
  antenna.add(place(hit, 48.2, W / 2, top))

  place(part('usb', 14, [2, 6, W / 2]).add(kit.microUsb()), 1.6, W / 2, top)
  place(part('bridge', 12, [11, 3, W / 2]).add(kit.flatChip(5, 7, 'CP2102', false)), 11, W / 2, top)
  place(part('regulator', 14, [18.5, 4, 7.2]).add(kit.sot223()), 18.5, 7.2, top, Math.PI)
  place(part('en', 12, [4.2, 5, 6]).add(kit.tactile(4, 0x2b2b2b, 1.1)), 4.2, 6, top)
  place(part('boot', 12, [4.2, 5, W - 6]).add(kit.tactile(4, 0x2b2b2b, 1.1)), 4.2, W - 6, top)
  const led = (id: string, x: number, z: number, color: number) => {
    const g = part(id, 10, [x, 3, z])
    const l = kit.smd('led', color)
    g.add(place(l, x, z, top))
  }
  led('pwr', 9.5, 8.6, 0xff3b30)
  led('led', 9.5, W - 8.6, 0x2f7bff)
  // Two rows of pins pointing down under the board
  // The pins point down, so taking the board apart drops them.
  const pins = part('gpio', -12, [25, 4, Z_TOP])
  const down = !opts.labPins
  pins.add(place(kit.maleHeader(15, 1, 6, down), X0 + 7 * PITCH, Z_TOP, down ? 0 : top))
  pins.add(place(kit.maleHeader(15, 1, 6, down), X0 + 7 * PITCH, Z_BOTTOM, down ? 0 : top))
  // Small parts
  const avoid: [number, number, number, number][] = [
    [38.6, W / 2, 27, 19],
    [11, W / 2, 7, 7],
    [18.5, 7.2, 8, 6],
    [4.2, 6, 6, 6],
    [4.2, W - 6, 6, 6],
    [2, W / 2, 7, 9],
    [9.5, 8.6, 3, 3],
    [9.5, W - 8.6, 3, 3],
    [25, Z_TOP, 44, 7],
    [25, Z_BOTTOM, 44, 7],
    [19.6, W / 2 + 4.4, 12, 4],
  ]
  for (const p of SMD_SPOTS(9, 14, [6, 6, 25, W - 6], avoid)) root.add(place(kit.smd(p.kind), p.x, p.z, top, p.rot ? Math.PI / 2 : 0))

  return {
    root,
    parts,
    anchors,
    lift,
    blink: ['led'],
    size: { L, W },
    floor: -10.5,
    // The board rises off its pins, which stay standing on the mat.
    baseLift: 12,
    views: { iso: [-34, 40, 46], top: [0, 70, 0.01], front: [0, 14, 70] },
    pinRef: { terminal: 'esp.VIN', local: [X0 - L / 2, Z_TOP - W / 2] },
    socketY: opts.labPins ? top + 7 : top,
  }
}

export const BUILDERS: Record<Board3DId, (T: Three, kit: Kit, opts?: { labPins?: boolean }) => Built> = { uno: buildUno, esp32: buildEsp32 }
