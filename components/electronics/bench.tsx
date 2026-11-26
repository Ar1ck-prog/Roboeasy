'use client'

import { memo, useCallback, useMemo, useRef, useState } from 'react'

import { PartArt } from '@/components/electronics/part-art'
import {
  BB,
  BB_HOLES,
  BB_ROW_Y,
  BENCH,
  type BoardProfile,
  type CircuitDoc,
  ESP32,
  ESP32_HEADERS,
  P,
  type Part,
  PWM_PINS,
  UNO,
  UNO_HEADERS,
  type Wire,
  bbColX,
  boardOf,
  boardPin,
  legPoints,
  pinNumber,
  socketAtPoint,
  terminalPoint,
} from '@/lib/electronics/board'
import type { FrameState } from '@/lib/electronics/sim'
import type { ElectronicsText } from '@/lib/i18n/electronics'

export type Selection = { kind: 'part'; id: string } | { kind: 'wire'; id: string } | null

const WIRE_COLORS = ['#e8710a', '#f9ab00', '#188038', '#1a73e8', '#9334e6', '#00838f']
const RED = '#d93025'
const BLACK = '#202124'

/** A sensible colour for a new wire: red for power, black for ground, otherwise the next colour. */
export function wireColorFor(a: string, b: string, count: number): string {
  const power = (t: string) => /(uno|esp)\.(5V|3V3|VIN)$|bb\.(tp|bp)\d+$/.test(t)
  const ground = (t: string) => /(uno|esp)\.GND|bb\.(tn|bn)\d+$/.test(t)
  if (power(a) || power(b)) return RED
  if (ground(a) || ground(b)) return BLACK
  return WIRE_COLORS[count % WIRE_COLORS.length]
}

// ── Static layers ───────────────────────────────────────────────────────

export const UnoBoard = memo(function UnoBoard({ builtin, tx, on }: { builtin: number; tx: boolean; on: boolean }) {
  const { x, y, w, h } = UNO
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={8} fill="#0e7c86" stroke="#075b63" strokeWidth={1.5} />
      {/* Mounting holes */}
      {[
        [x + 14, y + 12],
        [x + 14, y + h - 12],
        [x + w - 12, y + 30],
        [x + w - 12, y + h - 30],
      ].map(([cx, cy]) => (
        <circle key={`${cx}${cy}`} cx={cx} cy={cy} r={4.5} fill="var(--bench-bg, #f4f1ea)" stroke="#c9b26a" strokeWidth={1.5} />
      ))}
      {/* USB-B and the power jack stick out on the left */}
      <rect x={x - 10} y={y + 28} width={46} height={40} rx={2} fill="#c0c4c8" stroke="#80868b" />
      <rect x={x - 6} y={y + 36} width={30} height={24} rx={1} fill="#9aa0a6" />
      <rect x={x - 10} y={y + 150} width={52} height={36} rx={3} fill="#202124" />
      <circle cx={x + 2} cy={y + 168} r={7} fill="#3c4043" />
      {/* Reset button */}
      <rect x={x + 44} y={y + 22} width={16} height={16} rx={2} fill="#dadce0" />
      <circle cx={x + 52} cy={y + 30} r={5} fill="#c5221f" />
      {/* Regulator, crystal, the USB bridge chip */}
      <rect x={x + 54} y={y + 150} width={22} height={20} fill="#3c4043" />
      <rect x={x + 54} y={y + 146} width={22} height={5} fill="#9aa0a6" />
      <rect x={x + 106} y={y + 100} width={22} height={10} rx={5} fill="#dadce0" stroke="#9aa0a6" />
      <rect x={x + 62} y={y + 60} width={22} height={22} fill="#202124" transform={`rotate(45 ${x + 73} ${y + 71})`} />
      {/* ATmega328P in its socket */}
      <rect x={x + 120} y={y + 128} width={130} height={34} rx={2} fill="#2d2d2d" />
      {Array.from({ length: 14 }, (_, i) => (
        <g key={i}>
          <rect x={x + 125 + i * 9} y={y + 123} width={4} height={6} fill="#c0c4c8" />
          <rect x={x + 125 + i * 9} y={y + 161} width={4} height={6} fill="#c0c4c8" />
        </g>
      ))}
      <rect x={x + 124} y={y + 132} width={122} height={26} rx={1} fill="#1b1b1b" />
      <text x={x + 185} y={y + 149} fontSize={8} fill="#c9c9c9" textAnchor="middle" fontWeight={700} letterSpacing={0.5}>
        ATMEGA328P
      </text>
      {/* Board label */}
      <text x={x + 205} y={y + 92} fontSize={30} fill="#fff" fontWeight={900} fontStyle="italic" textAnchor="middle" opacity={0.92}>
        UNO
      </text>
      <text x={x + 205} y={y + 108} fontSize={8} fill="#d2f1f4" textAnchor="middle" fontWeight={700} letterSpacing={2}>
        R3 · RoboEasy
      </text>
      {/* LEDs: L on pin 13, TX, RX and ON */}
      {[
        { label: 'L', cx: x + 98, cy: y + 42, color: '#ffb300', lit: builtin },
        { label: 'TX', cx: x + 98, cy: y + 58, color: '#ffb300', lit: tx ? 1 : 0 },
        { label: 'RX', cx: x + 98, cy: y + 70, color: '#ffb300', lit: 0 },
        { label: 'ON', cx: x + 250, cy: y + 112, color: '#34a853', lit: on ? 1 : 0 },
      ].map((l) => (
        <g key={l.label}>
          {l.lit > 0.02 && <circle cx={l.cx} cy={l.cy} r={4 + 6 * l.lit} fill={l.color} opacity={0.3 * l.lit + 0.15} />}
          <rect x={l.cx - 3.5} y={l.cy - 2} width={7} height={4} rx={1} fill={l.lit > 0.02 ? l.color : '#e8eaed'} opacity={l.lit > 0.02 ? 0.5 + 0.5 * l.lit : 0.9} />
          <text x={l.cx + 7} y={l.cy + 2.5} fontSize={6} fill="#fff" fontWeight={700}>
            {l.label}
          </text>
        </g>
      ))}
      {/* Header strips with their sockets and labels */}
      <rect x={x + 75} y={y + 4} width={100} height={12} fill="#1d1d1f" />
      <rect x={x + 185} y={y + 4} width={90} height={12} fill="#1d1d1f" />
      <rect x={x + 105} y={y + h - 16} width={70} height={12} fill="#1d1d1f" />
      <rect x={x + 185} y={y + h - 16} width={60} height={12} fill="#1d1d1f" />
      {UNO_HEADERS.map((hd) => {
        const top = hd.y < y + h / 2
        const pin = pinNumber(hd.terminal)
        const label = (pin !== null && PWM_PINS.has(pin) ? '~' : '') + hd.label.replace(/^D/, '')
        return (
          <g key={hd.terminal}>
            <rect x={hd.x - 2.5} y={hd.y - 2.5} width={5} height={5} fill="#000" />
            <text
              x={hd.x}
              y={top ? hd.y + 10 : hd.y - 10}
              fontSize={5.6}
              fill="#fff"
              fontWeight={700}
              textAnchor={top ? 'end' : 'start'}
              transform={`rotate(-90 ${hd.x} ${top ? hd.y + 10 : hd.y - 10})`}
              dominantBaseline="middle"
            >
              {label}
            </text>
          </g>
        )
      })}
      <text x={x + 140} y={y + 46} fontSize={7} fill="#fff" fontWeight={800} letterSpacing={1}>
        DIGITAL (PWM ~)
      </text>
      <text x={x + 120} y={y + h - 40} fontSize={7} fill="#fff" fontWeight={800} letterSpacing={1}>
        POWER
      </text>
      <text x={x + 195} y={y + h - 40} fontSize={7} fill="#fff" fontWeight={800} letterSpacing={1}>
        ANALOG IN
      </text>
    </g>
  )
})


/** ESP32 DevKit V1 from above: USB on the left, the WROOM module with its antenna on the right. */
export const Esp32Board = memo(function Esp32Board({ builtin, tx, on }: { builtin: number; tx: boolean; on: boolean }) {
  const { x, y, w, h } = ESP32
  const cy = y + h / 2
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx={6} fill="#1b1e24" stroke="#0b0d10" strokeWidth={1.5} />
      <rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} rx={4} fill="none" stroke="#2b3038" strokeWidth={1} />
      {/* micro-USB */}
      <rect x={x - 8} y={cy - 12} width={24} height={24} rx={2} fill="#c4c8cc" stroke="#80868b" />
      <rect x={x - 8} y={cy - 6} width={6} height={12} rx={1} fill="#5f6368" />
      {/* BOOT and EN buttons */}
      {[
        { label: 'EN', by: y + 26 },
        { label: 'BOOT', by: y + h - 40 },
      ].map((b) => (
        <g key={b.label}>
          <rect x={x + 18} y={b.by} width={16} height={14} rx={2} fill="#dadce0" />
          <rect x={x + 21} y={b.by + 3} width={10} height={8} rx={1.5} fill="#202124" />
          <text x={x + 26} y={b.by - 3} fontSize={5.5} fill="#e8eaed" textAnchor="middle" fontWeight={700}>
            {b.label}
          </text>
        </g>
      ))}
      {/* CP2102 USB bridge and the AMS1117 regulator */}
      <rect x={x + 44} y={cy - 9} width={18} height={18} fill="#111" transform={`rotate(45 ${x + 53} ${cy})`} />
      <rect x={x + 70} y={cy - 16} width={24} height={14} fill="#2a2a2a" />
      <rect x={x + 74} y={cy - 22} width={16} height={6} fill="#9aa0a6" />
      {/* LEDs: red power and blue GPIO2 */}
      {[
        { label: 'PWR', cx: x + 74, cy: cy + 14, color: '#ff3b30', lit: on ? 1 : 0 },
        { label: 'D2', cx: x + 74, cy: cy + 26, color: '#2f7bff', lit: builtin },
        { label: 'TX', cx: x + 92, cy: cy + 14, color: '#ffb300', lit: tx ? 1 : 0 },
      ].map((l) => (
        <g key={l.label}>
          {l.lit > 0.02 && <circle cx={l.cx} cy={l.cy} r={4 + 6 * l.lit} fill={l.color} opacity={0.3 * l.lit + 0.2} />}
          <rect x={l.cx - 3.5} y={l.cy - 2} width={7} height={4} rx={1} fill={l.lit > 0.02 ? l.color : '#e8eaed'} opacity={l.lit > 0.02 ? 0.55 + 0.45 * l.lit : 0.85} />
          <text x={l.cx + 6} y={l.cy + 2.2} fontSize={5} fill="#e8eaed" fontWeight={700}>
            {l.label}
          </text>
        </g>
      ))}
      {/* The WROOM module: its own board, a metal shield and the antenna that sticks out */}
      <rect x={x + 128} y={y + 22} width={w - 112} height={h - 44} rx={2} fill="#262a31" stroke="#0b0d10" />
      <rect x={x + 134} y={y + 28} width={w - 152} height={h - 56} rx={3} fill="#c9cdd2" stroke="#8a9096" />
      <rect x={x + 134} y={y + 28} width={w - 152} height={h - 56} rx={3} fill="url(#shield)" opacity={0.7} />
      <text x={x + 134 + (w - 152) / 2} y={cy - 4} fontSize={7.5} fill="#3c4043" textAnchor="middle" fontWeight={800}>
        ESP32-WROOM-32
      </text>
      <text x={x + 134 + (w - 152) / 2} y={cy + 7} fontSize={5.5} fill="#5f6368" textAnchor="middle" fontWeight={700}>
        Wi-Fi · Bluetooth
      </text>
      <path
        d={`M${x + w - 14} ${y + 28} v12 h6 v8 h-6 v8 h6 v8 h-6 v8 h6 v8 h-6 v8 h6 v8`}
        fill="none"
        stroke="#c9a227"
        strokeWidth={1.6}
      />
      {/* Male pins along both sides with their labels */}
      {ESP32_HEADERS.map((hd) => {
        const top = hd.y < cy
        return (
          <g key={hd.terminal}>
            <rect x={hd.x - 3} y={hd.y - 3} width={6} height={6} fill="#111" />
            <rect x={hd.x - 1.4} y={hd.y - 1.4} width={2.8} height={2.8} fill="#d4af37" />
            <text
              x={hd.x}
              y={top ? hd.y + 8 : hd.y - 8}
              fontSize={5}
              fill="#e8eaed"
              fontWeight={700}
              textAnchor={top ? 'end' : 'start'}
              transform={`rotate(-90 ${hd.x} ${top ? hd.y + 8 : hd.y - 8})`}
              dominantBaseline="middle"
            >
              {hd.label}
            </text>
          </g>
        )
      })}
    </g>
  )
})

const Breadboard = memo(function Breadboard() {
  return (
    <g>
      <rect x={BB.x} y={BB.y} width={BB.w} height={BB.h} rx={6} fill="#f6f3ec" stroke="#d6cfbf" strokeWidth={1.5} />
      {/* Power rails: red is +, blue is − */}
      {[
        { y: BB_ROW_Y.tn - 6, color: '#1a73e8' },
        { y: BB_ROW_Y.tp + 6, color: RED },
        { y: BB_ROW_Y.bp - 6, color: RED },
        { y: BB_ROW_Y.bn + 6, color: '#1a73e8' },
      ].map((r) => (
        <line key={r.y} x1={BB.x + 6} y1={r.y} x2={BB.x + BB.w - 6} y2={r.y} stroke={r.color} strokeWidth={1.2} />
      ))}
      {[
        ['−', BB_ROW_Y.tn],
        ['+', BB_ROW_Y.tp],
        ['+', BB_ROW_Y.bp],
        ['−', BB_ROW_Y.bn],
      ].map(([s, ry]) => (
        <text key={`${s}${ry}`} x={BB.x + 2} y={Number(ry) + 2.5} fontSize={7} fill={s === '+' ? RED : '#1a73e8'} fontWeight={800}>
          {s}
        </text>
      ))}
      {/* The channel in the middle */}
      <rect x={BB.x + 4} y={BB_ROW_Y.e + 8} width={BB.w - 8} height={BB_ROW_Y.f - BB_ROW_Y.e - 16} rx={2} fill="#e6e0d2" />
      {BB_HOLES.map((h) => (
        <rect key={h.terminal} x={h.x - 2} y={h.y - 2} width={4} height={4} rx={0.8} fill="#4a4a4a" />
      ))}
      {Array.from({ length: BB.cols }, (_, i) => i + 1)
        .filter((c) => c === 1 || c % 5 === 0)
        .map((c) => (
          <g key={c}>
            <text x={bbColX(c)} y={BB_ROW_Y.a - 7} fontSize={5.5} fill="#80868b" textAnchor="middle">
              {c}
            </text>
            <text x={bbColX(c)} y={BB_ROW_Y.j + 11} fontSize={5.5} fill="#80868b" textAnchor="middle">
              {c}
            </text>
          </g>
        ))}
      {['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j'].map((r) => (
        <text key={r} x={BB.x + 3} y={BB_ROW_Y[r] + 2} fontSize={5.5} fill="#80868b">
          {r}
        </text>
      ))}
    </g>
  )
})

// ── The bench ───────────────────────────────────────────────────────────

interface BenchProps {
  doc: CircuitDoc
  onChange: (doc: CircuitDoc) => void
  frame: FrameState | null
  running: boolean
  selection: Selection
  onSelect: (s: Selection) => void
  t: ElectronicsText
}

interface Drag {
  id: string
  dx: number
  dy: number
  x: number
  y: number
  sx: number
  sy: number
  moved: boolean
  pointer: number
}

const snap = (v: number) => Math.round(v / P) * P

/** Short name of a terminal for the tooltip. */
function terminalLabel(terminal: string, doc: CircuitDoc, t: ElectronicsText, board: BoardProfile): string {
  if (terminal.startsWith(`${board.prefix}.`)) {
    const header = board.headers.find((h) => h.terminal === terminal)
    const pin = boardPin(board, terminal)
    const label = header?.label ?? terminal.slice(board.prefix.length + 1)
    return board.id === 'esp32' && pin !== null && `D${pin}` !== label ? `${label} · GPIO${pin}` : label
  }
  if (terminal.startsWith('bb.')) {
    const name = terminal.slice(3)
    const rail = /^(t|b)(p|n)\d+$/.exec(name)
    if (rail) return t.rail[rail[2] === 'p' ? '+' : '-']
    return t.hole.replace('{name}', name)
  }
  const [id, leg] = terminal.split('.')
  const part = doc.parts.find((p) => p.id === id)
  if (!part) return terminal
  return `${t.parts[part.type]}: ${t.legs[`${part.type}.${leg}`] ?? leg}`
}

export function Bench({ doc, onChange, frame, running, selection, onSelect, t }: BenchProps) {
  const board = boardOf(doc)
  const svgRef = useRef<SVGSVGElement>(null)
  const [drag, setDrag] = useState<Drag | null>(null)
  const [wiringFrom, setWiringFrom] = useState<string | null>(null)
  const [pointer, setPointer] = useState<{ x: number; y: number } | null>(null)
  const [hover, setHover] = useState<string | null>(null)

  const toSvg = useCallback((e: { clientX: number; clientY: number }) => {
    const svg = svgRef.current
    if (!svg) return { x: 0, y: 0 }
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    const m = svg.getScreenCTM()
    if (!m) return { x: 0, y: 0 }
    const p = pt.matrixTransform(m.inverse())
    return { x: p.x, y: p.y }
  }, [])

  // Parts as drawn: the one being dragged follows the pointer.
  const parts = useMemo(() => doc.parts.map((p) => (drag && p.id === drag.id ? { ...p, x: drag.x, y: drag.y } : p)), [doc.parts, drag])

  /** Legs that are not in a hole: wires attach to them directly. */
  const freeLegs = useMemo(() => {
    const list: { terminal: string; x: number; y: number }[] = []
    for (const p of parts) for (const leg of legPoints(p)) if (!socketAtPoint(leg.x, leg.y, board.id)) list.push({ terminal: leg.terminal, x: leg.x, y: leg.y })
    return list
  }, [parts, board.id])
  const terminals = useMemo(() => [...board.headers, ...BB_HOLES, ...freeLegs], [freeLegs, board.headers])

  const updatePart = (id: string, change: Partial<Part>) => onChange({ ...doc, parts: doc.parts.map((p) => (p.id === id ? { ...p, ...change } : p)) })
  const setProps = (id: string, props: Part['props']) => onChange({ ...doc, parts: doc.parts.map((p) => (p.id === id ? { ...p, props: { ...p.props, ...props } } : p)) })

  const onPartDown = (e: React.PointerEvent, part: Part) => {
    e.stopPropagation()
    if (wiringFrom) return
    // While running, a button is pressed rather than moved.
    if (running && part.type === 'button') {
      ;(e.currentTarget as Element).setPointerCapture?.(e.pointerId)
      setProps(part.id, { pressed: true })
      onSelect({ kind: 'part', id: part.id })
      return
    }
    const p = toSvg(e)
    svgRef.current?.setPointerCapture?.(e.pointerId)
    setDrag({ id: part.id, dx: p.x - part.x, dy: p.y - part.y, x: part.x, y: part.y, sx: p.x, sy: p.y, moved: false, pointer: e.pointerId })
  }

  const onPartUp = (e: React.PointerEvent, part: Part) => {
    if (running && part.type === 'button' && part.props.pressed) {
      e.stopPropagation()
      setProps(part.id, { pressed: false })
    }
  }

  const onMove = (e: React.PointerEvent) => {
    const p = toSvg(e)
    if (drag) {
      const moved = drag.moved || Math.hypot(p.x - drag.sx, p.y - drag.sy) > 3
      setDrag({ ...drag, moved, x: p.x - drag.dx, y: p.y - drag.dy })
    } else if (wiringFrom) setPointer(p)
  }

  const onUp = () => {
    if (!drag) return
    if (drag.moved) {
      const x = Math.max(0, Math.min(BENCH.w, snap(drag.x)))
      const y = Math.max(0, Math.min(BENCH.h, snap(drag.y)))
      updatePart(drag.id, { x, y })
    }
    onSelect({ kind: 'part', id: drag.id })
    setDrag(null)
  }

  const onTerminal = (e: React.PointerEvent, terminal: string) => {
    e.stopPropagation()
    if (!wiringFrom) {
      setWiringFrom(terminal)
      setPointer(toSvg(e))
      return
    }
    if (terminal !== wiringFrom && !doc.wires.some((w) => (w.a === wiringFrom && w.b === terminal) || (w.b === wiringFrom && w.a === terminal))) {
      const wire: Wire = { id: `w${Date.now().toString(36)}${doc.wires.length}`, a: wiringFrom, b: terminal, color: wireColorFor(wiringFrom, terminal, doc.wires.length) }
      onChange({ ...doc, wires: [...doc.wires, wire] })
      onSelect({ kind: 'wire', id: wire.id })
    }
    setWiringFrom(null)
    setPointer(null)
  }

  const onWheel = (e: React.WheelEvent, part: Part) => {
    const step = e.deltaY < 0 ? 1 : -1
    if (part.type === 'pot') setProps(part.id, { pos: Math.max(0, Math.min(1, Math.round(((part.props.pos ?? 0.5) + step * 0.05) * 100) / 100)) })
    else if (part.type === 'ldr') setProps(part.id, { light: Math.max(0, Math.min(1, Math.round(((part.props.light ?? 0.5) + step * 0.05) * 100) / 100)) })
    else if (part.type === 'ultrasonic') setProps(part.id, { distance: Math.max(2, Math.min(450, (part.props.distance ?? 30) + step * 2)) })
  }

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setWiringFrom(null)
      setPointer(null)
      onSelect(null)
      return
    }
    if (!selection) return
    if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      onChange(removeSelection(doc, selection))
      onSelect(null)
    } else if ((e.key === 'r' || e.key === 'R' || e.key === 'к' || e.key === 'К') && selection.kind === 'part') {
      const part = doc.parts.find((p) => p.id === selection.id)
      if (part) updatePart(part.id, { rot: ((part.rot + 1) % 4) as Part['rot'] })
    }
  }

  const wirePath = (w: Wire) => {
    const a = terminalPoint(w.a, parts, board.id)
    const b = terminalPoint(w.b, parts, board.id)
    if (!a || !b) return null
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    const sag = Math.min(40, len * 0.18)
    const mx = (a.x + b.x) / 2
    const my = (a.y + b.y) / 2 + sag
    return `M${a.x} ${a.y} Q${mx} ${my} ${b.x} ${b.y}`
  }

  const hit = (term: { terminal: string; x: number; y: number }) => (
    <circle
      key={term.terminal}
      cx={term.x}
      cy={term.y}
      r={4.2}
      fill={term.terminal === wiringFrom ? '#1a73e8' : 'transparent'}
      stroke={hover === term.terminal ? '#1a73e8' : 'none'}
      strokeWidth={1.5}
      className="cursor-crosshair"
      onPointerDown={(e) => onTerminal(e, term.terminal)}
      onPointerEnter={() => setHover(term.terminal)}
      onPointerLeave={() => setHover((h) => (h === term.terminal ? null : h))}
      data-terminal={term.terminal}
    />
  )
  const sockets = useMemo(() => [...board.headers, ...BB_HOLES], [board.headers])

  const hoverPoint = hover ? terminals.find((x) => x.terminal === hover) : null
  const hoverVolts = hover && frame && running ? frame.volts(hover) : null
  const wiringStart = wiringFrom ? terminalPoint(wiringFrom, parts, board.id) : null

  return (
    <div className="relative overflow-x-auto rounded-(--radius-md) border-(length:--stroke-thin) border-border bg-[var(--bench-bg)] [--bench-bg:#f1ede4] dark:[--bench-bg:#2a2d31]">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${BENCH.w} ${BENCH.h}`}
        className="block w-full min-w-[640px] touch-none select-none outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="application"
        aria-label={t.lab.bench}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerDown={() => {
          setWiringFrom(null)
          setPointer(null)
          onSelect(null)
        }}
        onKeyDown={onKey}
        data-testid="bench"
      >
        <defs>
          <pattern id="mat-dots" width={P} height={P} patternUnits="userSpaceOnUse">
            <circle cx={P / 2} cy={P / 2} r={0.7} fill="currentColor" opacity={0.18} />
          </pattern>
          <linearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity={0.9} />
            <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
            <stop offset="1" stopColor="#5f6368" stopOpacity={0.5} />
          </linearGradient>
        </defs>
        {/* A work mat with a dot grid, then the board and the breadboard casting soft shadows. */}
        <rect width={BENCH.w} height={BENCH.h} fill="url(#mat-dots)" className="text-foreground" />
        <g style={{ filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.28))' }}>
          {board.id === 'esp32' ? (
            <Esp32Board builtin={frame?.builtin ?? 0} tx={Boolean(frame?.tx)} on={running} />
          ) : (
            <UnoBoard builtin={frame?.builtin ?? 0} tx={Boolean(frame?.tx)} on={running} />
          )}
        </g>
        <g style={{ filter: 'drop-shadow(0 3px 5px rgba(0,0,0,.2))' }}>
          <Breadboard />
        </g>

        {/* Sockets under the parts: a part covers the holes it sits on. */}
        {sockets.map(hit)}

        {parts.map((part) => {
          const selected = selection?.kind === 'part' && selection.id === part.id
          return (
            <g
              key={part.id}
              transform={`translate(${part.x} ${part.y}) rotate(${part.rot * 90})`}
              className={running && part.type === 'button' ? 'cursor-pointer' : 'cursor-grab'}
              onPointerDown={(e) => onPartDown(e, part)}
              onPointerUp={(e) => onPartUp(e, part)}
              onWheel={(e) => onWheel(e, part)}
              data-part={part.id}
              data-type={part.type}
              style={{ color: 'var(--color-foreground)' }}
            >
              <g style={{ filter: selected ? 'drop-shadow(0 0 3px #1a73e8)' : 'drop-shadow(0 2px 1.5px rgba(0,0,0,.3))' }}>
                <PartArt
                  part={part}
                  brightness={frame?.leds[part.id]}
                  burned={frame?.burned.includes(part.id)}
                  angle={frame?.servos[part.id]}
                  sounding={frame?.tones.some((x) => x.part === part.id)}
                  cm={t.lab.cm}
                />
              </g>
            </g>
          )
        })}

        {doc.wires.map((w) => {
          const d = wirePath(w)
          if (!d) return null
          const selected = selection?.kind === 'wire' && selection.id === w.id
          return (
            <g
              key={w.id}
              className="cursor-pointer"
              onPointerDown={(e) => {
                e.stopPropagation()
                if (wiringFrom) return
                onSelect({ kind: 'wire', id: w.id })
              }}
              data-wire={w.id}
            >
              {/* Drawn lines do not take clicks: only the middle hit area above does, so pins next to a wire's end stay clickable. */}
              {selected && <path d={d} stroke="#8ab4f8" strokeWidth={7} fill="none" strokeLinecap="round" opacity={0.8} pointerEvents="none" />}
              <path d={d} stroke="rgba(0,0,0,.35)" strokeWidth={4.2} fill="none" strokeLinecap="round" pointerEvents="none" />
              <path d={d} stroke={w.color} strokeWidth={3} fill="none" strokeLinecap="round" pointerEvents="none" />
              {/* Only the middle of a wire is clickable, so a new wire can start where one ends. */}
              <path d={d} stroke="transparent" strokeWidth={9} fill="none" pathLength={100} strokeDasharray="0 12 76 12" />
            </g>
          )
        })}
        {doc.wires.map((w) =>
          [w.a, w.b].map((end) => {
            const p = terminalPoint(end, parts, board.id)
            return p ? <circle key={`${w.id}${end}`} cx={p.x} cy={p.y} r={2.4} fill={w.color} stroke="rgba(0,0,0,.4)" strokeWidth={0.6} pointerEvents="none" /> : null
          }),
        )}

        {wiringStart && pointer && (
          <line x1={wiringStart.x} y1={wiringStart.y} x2={pointer.x} y2={pointer.y} stroke="#1a73e8" strokeWidth={2.4} strokeDasharray="5 4" pointerEvents="none" />
        )}

        {freeLegs.map(hit)}

        {hover && hoverPoint && !drag && (
          <g pointerEvents="none">
            {(() => {
              const text = terminalLabel(hover, doc, t, board) + (hoverVolts !== null ? ` · ${t.lab.voltage.replace('{v}', hoverVolts.toFixed(2))}` : '')
              const width = Math.max(30, text.length * 4.6 + 10)
              const x = Math.min(BENCH.w - width - 4, Math.max(4, hoverPoint.x - width / 2))
              const y = hoverPoint.y > 40 ? hoverPoint.y - 26 : hoverPoint.y + 10
              return (
                <>
                  <rect x={x} y={y} width={width} height={15} rx={4} fill="#202124" opacity={0.92} />
                  <text x={x + width / 2} y={y + 10.5} fontSize={8} fill="#fff" textAnchor="middle" fontWeight={700}>
                    {text}
                  </text>
                </>
              )
            })()}
          </g>
        )}
      </svg>
      {wiringFrom && <p className="pointer-events-none absolute top-2 left-1/2 m-0 -translate-x-1/2 rounded-(--radius-pill) bg-foreground px-3 py-1 text-xs font-bold text-background">{t.lab.wiring}</p>}
    </div>
  )
}

/** Removes the selected part (with its wires) or wire. */
export function removeSelection(doc: CircuitDoc, selection: NonNullable<Selection>): CircuitDoc {
  if (selection.kind === 'wire') return { ...doc, wires: doc.wires.filter((w) => w.id !== selection.id) }
  const prefix = `${selection.id}.`
  return {
    parts: doc.parts.filter((p) => p.id !== selection.id),
    wires: doc.wires.filter((w) => !w.a.startsWith(prefix) && !w.b.startsWith(prefix)),
  }
}
