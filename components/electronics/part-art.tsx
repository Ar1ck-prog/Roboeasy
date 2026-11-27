'use client'

import { memo } from 'react'

import { type LedColor, P, type Part } from '@/lib/electronics/board'

/** Drawings of the parts in their own coordinates: the first leg at (0, 0), not rotated. */

const LED_FILL: Record<LedColor, { off: string; on: string }> = {
  red: { off: '#b3443b', on: '#ff4d3d' },
  yellow: { off: '#c9a227', on: '#ffe14d' },
  green: { off: '#3f8f4f', on: '#5dff7a' },
  blue: { off: '#3a62b8', on: '#5aa2ff' },
  white: { off: '#d9d9d9', on: '#ffffff' },
}

const BAND = ['#000000', '#8b4513', '#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa', '#9e9e9e', '#ffffff']

/** Colour bands of a resistor: two digits, the multiplier and gold tolerance. */
export function resistorBands(ohms: number): string[] {
  const exp = Math.max(0, Math.floor(Math.log10(Math.max(ohms, 10))) - 1)
  const digits = Math.round(ohms / 10 ** exp)
  return [BAND[Math.floor(digits / 10) % 10], BAND[digits % 10], BAND[exp] ?? BAND[0], '#c9a227']
}

export function formatOhms(ohms: number): string {
  if (ohms >= 1_000_000) return `${ohms / 1_000_000} MΩ`
  if (ohms >= 1000) return `${ohms / 1000} kΩ`
  return `${ohms} Ω`
}

const Leg = ({ x1, y1, x2, y2 }: { x1: number; y1: number; x2: number; y2: number }) => (
  <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9aa0a6" strokeWidth={1.6} strokeLinecap="round" />
)

interface ArtProps {
  part: Part
  /** Live values from the simulation. */
  brightness?: number
  burned?: boolean
  angle?: number
  sounding?: boolean
  /** "cm" in the page language. */
  cm?: string
  /** RGB LED channel brightness. */
  rgb?: [number, number, number]
  /** What a display shows (null: no power or not wired). */
  lcd?: { lines: [string, string]; backlight: boolean } | null
  /** A motion sensor that sees motion. */
  active?: boolean
}

function ArtImpl({ part, brightness = 0, burned = false, angle = 90, sounding = false, cm = 'cm', rgb, lcd, active = false }: ArtProps) {
  const { props } = part
  switch (part.type) {
    case 'led': {
      const c = LED_FILL[props.color ?? 'red']
      const b = burned ? 0 : brightness
      return (
        <g>
          <Leg x1={0} y1={-8} x2={0} y2={0} />
          <Leg x1={P} y1={-8} x2={P} y2={0} />
          {/* The anode is the long leg: a small bend marks it. */}
          <path d="M0 -8 l-2 -2" stroke="#9aa0a6" strokeWidth={1.2} fill="none" />
          {b > 0.02 && <circle cx={P / 2} cy={-17} r={9 + 9 * b} fill={c.on} opacity={0.18 + 0.35 * b} />}
          <rect x={-2.5} y={-11} width={P + 5} height={3.5} rx={1} fill={burned ? '#555' : c.off} stroke="rgba(0,0,0,.35)" strokeWidth={0.6} />
          <path
            d={`M${-1.5} -10 L${-1.5} -18 A6.5 6.5 0 0 1 ${P + 1.5} -18 L${P + 1.5} -10 Z`}
            fill={burned ? '#4a4a4a' : b > 0.02 ? c.on : c.off}
            fillOpacity={burned ? 1 : 0.55 + 0.45 * b}
            stroke="rgba(0,0,0,.35)"
            strokeWidth={0.7}
          />
          <ellipse cx={P / 2 - 2} cy={-19} rx={1.6} ry={3} fill="#fff" opacity={0.55} />
          {burned && <path d="M3 -26 q3 -4 0 -8 q-3 -4 1 -8" stroke="#777" strokeWidth={1.4} fill="none" opacity={0.7} />}
        </g>
      )
    }
    case 'resistor': {
      const bands = resistorBands(props.ohms ?? 220)
      return (
        <g>
          <Leg x1={0} y1={0} x2={9} y2={0} />
          <Leg x1={31} y1={0} x2={4 * P} y2={0} />
          <rect x={8} y={-4.5} width={24} height={9} rx={4} fill="#e2c799" stroke="#a88a5c" strokeWidth={0.8} />
          {bands.map((color, i) => (
            <rect key={i} x={12 + i * 4 + (i === 3 ? 2 : 0)} y={-4.5} width={2.2} height={9} fill={color} />
          ))}
        </g>
      )
    }
    case 'button': {
      const pressed = props.pressed
      return (
        <g>
          {[
            [0, 0],
            [2 * P, 0],
            [0, 3 * P],
            [2 * P, 3 * P],
          ].map(([x, y]) => (
            <Leg key={`${x}${y}`} x1={x} y1={y === 0 ? 4 : 3 * P - 4} x2={x} y2={y} />
          ))}
          <rect x={-3} y={3} width={2 * P + 6} height={3 * P - 6} rx={2} fill="#2b2f33" stroke="#111" strokeWidth={0.8} />
          <circle cx={P} cy={1.5 * P} r={pressed ? 6 : 7} fill={pressed ? '#7a1f1f' : '#c62828'} stroke="#111" strokeWidth={0.8} />
          <circle cx={P - 2} cy={1.5 * P - 2} r={2} fill="#fff" opacity={pressed ? 0.15 : 0.35} />
        </g>
      )
    }
    case 'pot': {
      const pos = props.pos ?? 0.5
      const a = (-135 + 270 * pos) * (Math.PI / 180)
      return (
        <g>
          {[0, P, 2 * P].map((x) => (
            <Leg key={x} x1={x} y1={-4} x2={x} y2={0} />
          ))}
          <rect x={-4} y={-30} width={2 * P + 8} height={27} rx={3} fill="#1f5fae" stroke="#123" strokeWidth={0.8} />
          <circle cx={P} cy={-16.5} r={10} fill="#e8e8e8" stroke="#555" strokeWidth={0.8} />
          <line x1={P} y1={-16.5} x2={P + Math.sin(a) * 8} y2={-16.5 - Math.cos(a) * 8} stroke="#333" strokeWidth={2.2} strokeLinecap="round" />
        </g>
      )
    }
    case 'ldr': {
      const light = props.light ?? 0.5
      return (
        <g>
          <Leg x1={0} y1={-6} x2={0} y2={0} />
          <Leg x1={2 * P} y1={-6} x2={2 * P} y2={0} />
          {light > 0.05 && <circle cx={P} cy={-13} r={10 + 6 * light} fill="#ffe14d" opacity={0.15 + 0.35 * light} />}
          <circle cx={P} cy={-13} r={8} fill="#d9a066" stroke="#7a4f22" strokeWidth={0.8} />
          <path d={`M${P - 5} -16 h10 M${P - 5} -13 h10 M${P - 5} -10 h10`} stroke="#8b2f1c" strokeWidth={1.1} />
        </g>
      )
    }
    case 'buzzer':
      return (
        <g>
          <Leg x1={0} y1={-4} x2={0} y2={0} />
          <Leg x1={3 * P} y1={-4} x2={3 * P} y2={0} />
          <circle cx={1.5 * P} cy={-17} r={15} fill="#1d1d1f" stroke="#000" strokeWidth={0.8} />
          <circle cx={1.5 * P} cy={-17} r={2.5} fill="#444" />
          <text x={-1} y={-25} fontSize={7} fill="#fff" fontWeight={800}>
            +
          </text>
          {sounding &&
            [20, 26, 32].map((r, i) => (
              <path
                key={r}
                d={`M${1.5 * P + r * 0.7} ${-17 - r * 0.7} A${r} ${r} 0 0 1 ${1.5 * P + r * 0.7} ${-17 + r * 0.7}`}
                stroke="var(--color-primary, #f9c80e)"
                strokeWidth={1.8}
                fill="none"
                opacity={0.9 - i * 0.25}
                className="motion-safe:animate-pulse"
              />
            ))}
        </g>
      )
    case 'servo': {
      const rad = ((angle - 90) * Math.PI) / 180
      return (
        <g>
          {/* Leads from the connector down to the body. */}
          <path d="M0 4 C0 14 -6 16 -6 26" stroke="#6d3a1f" strokeWidth={2} fill="none" />
          <path d={`M${P} 4 C${P} 14 4 16 4 26`} stroke="#d93025" strokeWidth={2} fill="none" />
          <path d={`M${2 * P} 4 C${2 * P} 14 14 16 14 26`} stroke="#e8710a" strokeWidth={2} fill="none" />
          <rect x={-4} y={-4} width={2 * P + 8} height={8} rx={1.5} fill="#1d1d1f" />
          <rect x={-30} y={26} width={80} height={36} rx={4} fill="#1f5fae" stroke="#0d3366" strokeWidth={1} />
          <rect x={-38} y={38} width={96} height={6} rx={2} fill="#1f5fae" stroke="#0d3366" strokeWidth={1} />
          <text x={-24} y={56} fontSize={8} fill="#cfe0ff" fontWeight={700}>
            SG90
          </text>
          <circle cx={30} cy={40} r={9} fill="#f2f2f2" stroke="#777" strokeWidth={0.8} />
          <g transform={`translate(30 40) rotate(${(rad * 180) / Math.PI})`}>
            <rect x={-3.5} y={-28} width={7} height={30} rx={3.5} fill="#f7f7f7" stroke="#888" strokeWidth={0.8} />
            <circle cx={0} cy={-22} r={1.3} fill="#888" />
            <circle cx={0} cy={-14} r={1.3} fill="#888" />
          </g>
          <circle cx={30} cy={40} r={2.5} fill="#bbb" />
        </g>
      )
    }
    case 'rgb': {
      const [r, g, b] = rgb ?? [0, 0, 0]
      const lit = Math.max(r, g, b)
      const mix = `rgb(${Math.round(120 + 135 * r)}, ${Math.round(120 + 135 * g)}, ${Math.round(120 + 135 * b)})`
      return (
        <g>
          {[0, P, 2 * P, 3 * P].map((x, i) => (
            <Leg key={x} x1={x} y1={-9} x2={x} y2={i === 1 ? 0 : 0} />
          ))}
          {lit > 0.02 && <circle cx={1.5 * P} cy={-20} r={10 + 10 * lit} fill={mix} opacity={0.2 + 0.4 * lit} />}
          <rect x={-2} y={-12} width={3 * P + 4} height={3.5} rx={1} fill="#e8eaed" stroke="rgba(0,0,0,.3)" strokeWidth={0.6} />
          <path d={`M0 -11 L0 -21 A${1.5 * P} 9 0 0 1 ${3 * P} -21 L${3 * P} -11 Z`} fill={lit > 0.02 ? mix : '#f1f3f4'} fillOpacity={0.75 + 0.25 * lit} stroke="rgba(0,0,0,.3)" strokeWidth={0.7} />
          <ellipse cx={1.5 * P - 6} cy={-22} rx={2.5} ry={3} fill="#fff" opacity={0.6} />
          <text x={0} y={6} fontSize={4} fill="#d93025" textAnchor="middle" fontWeight={800}>R</text>
          <text x={2 * P} y={6} fontSize={4} fill="#188038" textAnchor="middle" fontWeight={800}>G</text>
          <text x={3 * P} y={6} fontSize={4} fill="#1a73e8" textAnchor="middle" fontWeight={800}>B</text>
        </g>
      )
    }
    case 'pir':
      return (
        <g>
          {[0, P, 2 * P].map((x) => (
            <Leg key={x} x1={x} y1={-8} x2={x} y2={0} />
          ))}
          <rect x={-40} y={-104} width={100} height={96} rx={4} fill="#1e7a3c" stroke="#0d4a22" strokeWidth={1} />
          <circle cx={P} cy={-56} r={34} fill="#f4f4f2" stroke="#c9c9c4" strokeWidth={1.2} />
          {[0, 1, 2, 3].map((i) => (
            <circle key={i} cx={P} cy={-56} r={8 + i * 7} fill="none" stroke="#dcdcd6" strokeWidth={1} />
          ))}
          <circle cx={-30} cy={-96} r={3.5} fill={active ? '#ff3b30' : '#5f1a16'} />
          {active && <circle cx={-30} cy={-96} r={8} fill="#ff3b30" opacity={0.35} />}
          {['VCC', 'OUT', 'GND'].map((label, i) => (
            <text key={label} x={i * P} y={-12} fontSize={4.5} fill="#cfe9d6" textAnchor="middle" fontWeight={700}>
              {label}
            </text>
          ))}
        </g>
      )
    case 'dht':
      return (
        <g>
          {[0, P, 2 * P].map((x) => (
            <Leg key={x} x1={x} y1={-8} x2={x} y2={0} />
          ))}
          <rect x={-12} y={-30} width={44} height={22} rx={2} fill="#1d1d1f" />
          <rect x={-8} y={-76} width={36} height={48} rx={3} fill="#3b82f6" stroke="#1e4fa8" strokeWidth={1} />
          {Array.from({ length: 5 }, (_, r) =>
            Array.from({ length: 4 }, (_, c) => <rect key={`${r}${c}`} x={-3 + c * 7.5} y={-70 + r * 8} width={4.5} height={5} rx={1} fill="#1e4fa8" />),
          )}
          <text x={P} y={-20} fontSize={5} fill="#e8eaed" textAnchor="middle" fontWeight={700}>
            {`${Math.round(props.temp ?? 24)}°C ${Math.round(props.humidity ?? 45)}%`}
          </text>
        </g>
      )
    case 'lcd': {
      const on = lcd && lcd.backlight
      return (
        <g>
          {[0, P, 2 * P, 3 * P].map((x) => (
            <Leg key={x} x1={x} y1={-8} x2={x} y2={0} />
          ))}
          {['GND', 'VCC', 'SDA', 'SCL'].map((label, i) => (
            <text key={label} x={i * P} y={-11} fontSize={4} fill="#cfe9d6" textAnchor="middle" fontWeight={700}>
              {label}
            </text>
          ))}
          <rect x={-30} y={-100} width={210} height={84} rx={4} fill="#1e7a3c" stroke="#0d4a22" strokeWidth={1} />
          <rect x={-16} y={-90} width={182} height={60} rx={2} fill="#1d1d1f" />
          <rect x={-10} y={-84} width={170} height={48} rx={1.5} fill={on ? '#7fd1ff' : lcd ? '#2a4f66' : '#22313a'} />
          {lcd &&
            lcd.lines.map((line, row) => (
              <text key={row} x={-6} y={-66 + row * 20} fontSize={15} fontFamily="ui-monospace, monospace" fill={on ? '#0b2a4a' : '#9fc5dc'} letterSpacing={0.6}>
                {line}
              </text>
            ))}
        </g>
      )
    }
    case 'joystick': {
      const x = ((props.jx ?? 0.5) - 0.5) * 16
      const y = ((props.jy ?? 0.5) - 0.5) * 16
      return (
        <g>
          {[0, P, 2 * P, 3 * P, 4 * P].map((xx) => (
            <Leg key={xx} x1={xx} y1={-8} x2={xx} y2={0} />
          ))}
          <rect x={-14} y={-92} width={68} height={84} rx={4} fill="#202124" stroke="#000" strokeWidth={1} />
          <rect x={-2} y={-80} width={44} height={44} rx={4} fill="#3c4043" />
          <circle cx={2 * P + x} cy={-58 + y} r={14} fill={props.pressed ? '#5f6368' : '#1d1d1f'} stroke="#000" strokeWidth={1} />
          <circle cx={2 * P + x} cy={-58 + y} r={9} fill="#3c4043" />
          {['GND', '+5V', 'VRx', 'VRy', 'SW'].map((label, i) => (
            <text key={label} x={i * P} y={-12} fontSize={3.8} fill="#e8eaed" textAnchor="middle" fontWeight={700}>
              {label}
            </text>
          ))}
        </g>
      )
    }
    case 'ultrasonic':
      return (
        <g>
          {[0, P, 2 * P, 3 * P].map((x) => (
            <Leg key={x} x1={x} y1={-8} x2={x} y2={0} />
          ))}
          <rect x={-60} y={-78} width={150} height={70} rx={4} fill="#1f5fae" stroke="#0d3366" strokeWidth={1} />
          {[-22, 52].map((cx) => (
            <g key={cx}>
              <circle cx={cx} cy={-45} r={24} fill="#c9ccd1" stroke="#7d8288" strokeWidth={1.2} />
              <circle cx={cx} cy={-45} r={17} fill="#2b2f33" />
              <circle cx={cx} cy={-45} r={13} fill="none" stroke="#5f6368" strokeWidth={0.8} strokeDasharray="2 2" />
            </g>
          ))}
          <text x={4} y={-68} fontSize={8} fill="#cfe0ff" fontWeight={800}>
            HC-SR04
          </text>
          {['VCC', 'TRIG', 'ECHO', 'GND'].map((label, i) => (
            <text key={label} x={i * P} y={-12} fontSize={4.5} fill="#cfe0ff" textAnchor="middle" fontWeight={700}>
              {label}
            </text>
          ))}
          <text x={15} y={-86} fontSize={9} fill="currentColor" textAnchor="middle" fontWeight={800}>
            {`↑ ${props.distance ?? 30} ${cm}`}
          </text>
        </g>
      )
  }
}

export const PartArt = memo(ArtImpl)
