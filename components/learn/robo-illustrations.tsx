'use client'

/**
 * Animated drawings for the robotics tracks (build, blocks, sensors,
 * navigation, Python, mechanisms, FLL). Our own schematic artwork in the
 * style of ai-illustrations.tsx: a light card with dark lines in both themes,
 * CSS-only motion (r-* and ai-* keyframes in globals.css) that stops for
 * learners who ask for reduced motion. No LEGO or FIRST imagery.
 */

import type { CSSProperties, ReactNode } from 'react'

import type { RoboIllustration } from '@/lib/learn/illustration-names'

type Lang = 'ru' | 'kk' | 'en'
type Words = Record<Lang, string>

const INK = '#1b1f2a'
const CARD = '#ffffff'
const SOFT = '#fff1d6'
const BACKDROP = '#fff9ee'
const YELLOW = '#ffc531'
const GREEN = '#2bb673'
const BLUE = '#4a86f7'
const RED = '#e5484d'
const VIOLET = '#b26ef0'
const GREY = '#8b90a0'
const TEXT = { fill: INK, fontWeight: 800, fontFamily: 'var(--font-body), sans-serif' } as const
const MUTED = { fill: '#454b5c', fontWeight: 700, fontFamily: 'var(--font-body), sans-serif' } as const

/** A looping CSS animation; `vars` feeds the keyframes (e.g. --r-d distance). */
function anim(name: string, seconds = 2, opts: { delay?: number; linear?: boolean; origin?: string; vars?: Record<string, string> } = {}): CSSProperties {
  return {
    animation: `${name} ${seconds}s ${opts.linear ? 'linear' : 'ease-in-out'} ${opts.delay ?? 0}s infinite`,
    transformBox: 'fill-box',
    transformOrigin: opts.origin ?? 'center',
    ...(opts.vars as CSSProperties),
  }
}

const W = {
  beam: { ru: 'балка', kk: 'арқалық', en: 'beam' },
  frame: { ru: 'рама', kk: 'жақтау', en: 'frame' },
  holes: { ru: 'отверстия через 8 мм', kk: 'тесіктер 8 мм сайын', en: 'holes every 8 mm' },
  pin: { ru: 'штифт', kk: 'штифт', en: 'pin' },
  axle: { ru: 'ось', kk: 'ось', en: 'axle' },
  spins: { ru: 'крутится', kk: 'айналады', en: 'spins' },
  holds: { ru: 'держит', kk: 'ұстайды', en: 'holds' },
  bush: { ru: 'втулка', kk: 'төлке', en: 'bush' },
  connector: { ru: 'соединитель', kk: 'қосқыш', en: 'connector' },
  tire: { ru: 'шина', kk: 'шина', en: 'tire' },
  rim: { ru: 'диск', kk: 'дөңгелек', en: 'rim' },
  strong: { ru: 'прочно', kk: 'берік', en: 'strong' },
  wobbly: { ru: 'шатается', kk: 'шайқалады', en: 'wobbly' },
  single: { ru: 'одна балка', kk: 'бір арқалық', en: 'one beam' },
  double: { ru: 'двойная', kk: 'қос', en: 'double' },
  weak: { ru: 'слабое место', kk: 'әлсіз жер', en: 'weak spot' },
  driver: { ru: 'ведущая', kk: 'жетекші', en: 'driver' },
  driven: { ru: 'ведомая', kk: 'жетектегі', en: 'driven' },
  slower: { ru: 'медленнее, но сильнее', kk: 'баяу, бірақ күшті', en: 'slower but stronger' },
  worm: { ru: 'червяк', kk: 'бұрама', en: 'worm' },
  oneTooth: { ru: '1 оборот = 1 зуб', kk: '1 айналым = 1 тіс', en: '1 turn = 1 tooth' },
  hub: { ru: 'хаб', kk: 'хаб', en: 'hub' },
  motor: { ru: 'мотор', kk: 'мотор', en: 'motor' },
  caster: { ru: 'опора', kk: 'тірек', en: 'caster' },
  circumference: { ru: '1 оборот = π × диаметр', kk: '1 айналым = π × диаметр', en: '1 turn = π × diameter' },
  repeat: { ru: 'повторить', kk: 'қайталау', en: 'repeat' },
  times: { ru: 'раза', kk: 'рет', en: 'times' },
  forever: { ru: 'всегда', kk: 'әрдайым', en: 'forever' },
  until: { ru: 'пока не', kk: 'дейін', en: 'until' },
  wall: { ru: 'стена', kk: 'қабырға', en: 'wall' },
  yes: { ru: 'да', kk: 'иә', en: 'yes' },
  no: { ru: 'нет', kk: 'жоқ', en: 'no' },
  pressed: { ru: 'нажато?', kk: 'басылды ма?', en: 'pressed?' },
  waitUntil: { ru: 'ждать, пока…', kk: 'күту, әзірге…', en: 'wait until…' },
  speed: { ru: 'скорость', kk: 'жылдамдық', en: 'speed' },
  laps: { ru: 'круги', kk: 'айналымдар', en: 'laps' },
  myBlock: { ru: 'мой блок', kk: 'менің блогым', en: 'my block' },
  call: { ru: 'выполнить', kk: 'орындау', en: 'run' },
  sees: { ru: 'видит цвет', kk: 'түсті көреді', en: 'sees colour' },
  light: { ru: 'светло', kk: 'ашық', en: 'light' },
  dark: { ru: 'темно', kk: 'қараңғы', en: 'dark' },
  echo: { ru: 'эхо', kk: 'жаңғырық', en: 'echo' },
  bumper: { ru: 'бампер', kk: 'бампер', en: 'bumper' },
  yaw: { ru: 'угол поворота', kk: 'бұрылу бұрышы', en: 'yaw angle' },
  tilt: { ru: 'наклон', kk: 'көлбеу', en: 'tilt' },
  left: { ru: 'левее', kk: 'солға', en: 'left of it' },
  right: { ru: 'правее', kk: 'оңға', en: 'right of it' },
  crossing: { ru: 'перекрёсток', kk: 'қиылыс', en: 'crossing' },
  plan: { ru: 'план', kk: 'жоспар', en: 'plan' },
  real: { ru: 'на самом деле', kk: 'шын мәнінде', en: 'real path' },
  target: { ru: 'цель', kk: 'мақсат', en: 'target' },
  measure: { ru: 'измерь', kk: 'өлше', en: 'measure' },
  error: { ru: 'ошибка', kk: 'қате', en: 'error' },
  fix: { ru: 'поправка', kk: 'түзету', en: 'correction' },
  time: { ru: 'время', kk: 'уақыт', en: 'time' },
  blocks: { ru: 'блоки', kk: 'блоктар', en: 'blocks' },
  python: { ru: 'Python', kk: 'Python', en: 'Python' },
  waits: { ru: 'ждёт и не мешает', kk: 'күтеді, кедергі жасамайды', en: 'waits politely' },
  inside: { ru: 'внутри', kk: 'ішінде', en: 'inside' },
  grab: { ru: 'захват', kk: 'қармауыш', en: 'gripper' },
  lift: { ru: 'подъёмник', kk: 'көтергіш', en: 'lift' },
  fulcrum: { ru: 'опора', kk: 'тірек', en: 'fulcrum' },
  load: { ru: 'груз', kk: 'жүк', en: 'load' },
  push: { ru: 'толкатель', kk: 'итергіш', en: 'pusher' },
  swap: { ru: 'смена за 5 с', kk: '5 с-та ауыстыру', en: 'swap in 5 s' },
  values: { ru: 'ценности', kk: 'құндылықтар', en: 'Core Values' },
  project: { ru: 'проект', kk: 'жоба', en: 'project' },
  design: { ru: 'робот', kk: 'робот', en: 'robot design' },
  game: { ru: 'игра', kk: 'ойын', en: 'robot game' },
  points: { ru: 'очки', kk: 'ұпай', en: 'points' },
  builder: { ru: 'сборщик', kk: 'құрастырушы', en: 'builder' },
  coder: { ru: 'программист', kk: 'бағдарламашы', en: 'coder' },
  driverRole: { ru: 'пилот', kk: 'ұшқыш', en: 'driver' },
  captain: { ru: 'капитан', kk: 'капитан', en: 'captain' },
  notebook: { ru: 'инженерная книга', kk: 'инженерлік кітап', en: 'engineering notebook' },
  judges: { ru: 'судьи', kk: 'төрешілер', en: 'judges' },
} satisfies Record<string, Words>

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg viewBox="0 0 360 200" className="ill-anim w-full" aria-hidden="true">
      <rect width="360" height="200" rx="16" fill={BACKDROP} />
      {children}
    </svg>
  )
}

function Label({ x, y, children, size = 13, muted = false, anchor = 'middle' }: { x: number; y: number; children: ReactNode; size?: number; muted?: boolean; anchor?: 'start' | 'middle' | 'end' }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} style={muted ? MUTED : TEXT}>
      {children}
    </text>
  )
}

/** A LEGO-free schematic beam with round holes. */
function Beam({ x, y, holes, color = BLUE, vertical = false, style }: { x: number; y: number; holes: number; color?: string; vertical?: boolean; style?: CSSProperties }) {
  const len = holes * 20
  return (
    <g transform={`translate(${x} ${y})${vertical ? ' rotate(90)' : ''}`} style={style}>
      <rect x={-10} y={-10} width={len} height={20} rx="10" fill={color} stroke={INK} strokeWidth="2.5" />
      {Array.from({ length: holes }, (_, i) => (
        <circle key={i} cx={i * 20} cy={0} r="5" fill={BACKDROP} stroke={INK} strokeWidth="2" />
      ))}
    </g>
  )
}

function gearPath(r: number, teeth: number): string {
  const pts: string[] = []
  const depth = Math.max(4, r * 0.16)
  for (let i = 0; i < teeth; i++) {
    const a = (i / teeth) * Math.PI * 2
    const step = (Math.PI * 2) / teeth
    for (const [da, rr] of [
      [0, r - depth],
      [step * 0.2, r],
      [step * 0.5, r],
      [step * 0.7, r - depth],
    ] as const)
      pts.push(`${(Math.cos(a + da) * rr).toFixed(1)},${(Math.sin(a + da) * rr).toFixed(1)}`)
  }
  return `M${pts.join('L')}Z`
}

/** A gear centred at (x, y); `seconds` per turn, negative = counter-clockwise. */
function Gear({ x, y, r, teeth, color = YELLOW, seconds = 4 }: { x: number; y: number; r: number; teeth: number; color?: string; seconds?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={anim(seconds > 0 ? 'ai-spin' : 'r-spin-rev', Math.abs(seconds), { linear: true })}>
        <path d={gearPath(r, teeth)} fill={color} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
        <circle r={r * 0.28} fill={BACKDROP} stroke={INK} strokeWidth="2.5" />
        <rect x={-2} y={-r * 0.2} width={4} height={r * 0.4} fill={INK} />
        <rect x={-r * 0.2} y={-2} width={r * 0.4} height={4} fill={INK} />
      </g>
    </g>
  )
}

/** A top-down robot facing right at (x, y). */
function Bot({ x, y, color = YELLOW, scale = 1, style }: { x: number; y: number; color?: string; scale?: number; style?: CSSProperties }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <g style={style}>
        <rect x={-16} y={-24} width={22} height={8} rx="3" fill={INK} />
        <rect x={-16} y={16} width={22} height={8} rx="3" fill={INK} />
        <rect x={-22} y={-18} width={44} height={36} rx="9" fill={color} stroke={INK} strokeWidth="3" />
        <rect x={-10} y={-10} width={18} height={20} rx="4" fill={CARD} stroke={INK} strokeWidth="2" />
        <path d="M22 -6 L32 0 L22 6 Z" fill={INK} />
      </g>
    </g>
  )
}

/** A block like in the editor: coloured rounded rectangle with a label. */
function Block({ x, y, w, color, children, style }: { x: number; y: number; w: number; color: string; children: ReactNode; style?: CSSProperties }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={26} rx="8" fill={color} stroke={INK} strokeWidth="2.5" />
      <text x={x + 10} y={y + 18} fontSize="12" style={TEXT}>
        {children}
      </text>
    </g>
  )
}

function Arrow({ x1, y1, x2, y2, style }: { x1: number; y1: number; x2: number; y2: number; style?: CSSProperties }) {
  const a = Math.atan2(y2 - y1, x2 - x1)
  const hx = (d: number, s: number) => (x2 - Math.cos(a) * d + Math.cos(a + Math.PI / 2) * s).toFixed(1)
  const hy = (d: number, s: number) => (y2 - Math.sin(a) * d + Math.sin(a + Math.PI / 2) * s).toFixed(1)
  return (
    <g style={style}>
      <path d={`M${x1} ${y1} L${hx(8, 0)} ${hy(8, 0)}`} stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
      <path d={`M${hx(12, -7)} ${hy(12, -7)} L${x2} ${y2} L${hx(12, 7)} ${hy(12, 7)} Z`} fill={INK} />
    </g>
  )
}

function Card({ x, y, w, h, fill = CARD, style, children }: { x: number; y: number; w: number; h: number; fill?: string; style?: CSSProperties; children?: ReactNode }) {
  return (
    <g style={style}>
      <rect x={x} y={y} width={w} height={h} rx="12" fill={fill} stroke={INK} strokeWidth="3" />
      {children}
    </g>
  )
}

function Person({ x, y, color, label, delay = 0 }: { x: number; y: number; color: string; label: string; delay?: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g style={anim('ai-bob', 2.4, { delay })}>
        <circle cy={-30} r="14" fill="#f5c9a0" stroke={INK} strokeWidth="2.5" />
        <rect x={-18} y={-14} width={36} height={34} rx="12" fill={color} stroke={INK} strokeWidth="2.5" />
      </g>
      <Label x={0} y={42} size={11}>
        {label}
      </Label>
    </g>
  )
}

export function RoboIllustration({ name, lang }: { name: string; lang: Lang }) {
  const w = (k: keyof typeof W) => W[k][lang]
  switch (name as RoboIllustration) {
    // ── Build ────────────────────────────────────────────────────────
    case 'r-beams':
      return (
        <Svg>
          <Beam x={40} y={50} holes={7} style={anim('ai-bob', 2.6)} />
          <Beam x={40} y={110} holes={5} color={RED} style={anim('ai-bob', 2.6, { delay: 0.4 })} />
          <g transform="translate(250 40)">
            <rect width="80" height="100" rx="12" fill={GREY} stroke={INK} strokeWidth="2.5" />
            <rect x="20" y="20" width="40" height="60" rx="6" fill={BACKDROP} stroke={INK} strokeWidth="2" />
          </g>
          <Label x={100} y={160}>
            {w('beam')}
          </Label>
          <Label x={290} y={160}>
            {w('frame')}
          </Label>
          <Label x={180} y={188} size={11} muted>
            {w('holes')}
          </Label>
        </Svg>
      )
    case 'r-pins':
      return (
        <Svg>
          <g transform="translate(90 80)">
            <g style={anim('ai-spin', 2.5, { linear: true })}>
              <circle r="30" fill={SOFT} stroke={INK} strokeWidth="2.5" />
              <path d="M-26 0 H26 M0 -26 V26" stroke={RED} strokeWidth="8" strokeLinecap="round" />
            </g>
          </g>
          <g transform="translate(260 80)">
            <circle r="30" fill={SOFT} stroke={INK} strokeWidth="2.5" />
            <circle r="12" fill={INK} />
          </g>
          <Label x={90} y={140}>{`${w('axle')} — ${w('spins')}`}</Label>
          <Label x={260} y={140}>{`${w('pin')} — ${w('holds')}`}</Label>
        </Svg>
      )
    case 'r-connectors':
      return (
        <Svg>
          <rect x={30} y={88} width={300} height={10} rx="5" fill={RED} stroke={INK} strokeWidth="2" />
          <g style={anim('r-drive', 3, { vars: { '--r-d': '60px' } })}>
            <rect x={60} y={74} width={22} height={38} rx="6" fill={GREY} stroke={INK} strokeWidth="2.5" />
          </g>
          <g transform="translate(250 93)">
            <g style={anim('ai-spin', 4, { linear: true })}>
              <rect x={-24} y={-24} width={48} height={48} rx="10" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
              <circle r="8" fill={BACKDROP} stroke={INK} strokeWidth="2" />
            </g>
          </g>
          <Label x={100} y={150}>
            {w('bush')}
          </Label>
          <Label x={250} y={150}>
            {w('connector')}
          </Label>
        </Svg>
      )
    case 'r-wheels':
      return (
        <Svg>
          <g transform="translate(110 95)">
            <g style={anim('ai-spin', 3, { linear: true })}>
              <circle r="58" fill={INK} />
              <circle r="38" fill={CARD} stroke={INK} strokeWidth="3" />
              {[0, 60, 120, 180, 240, 300].map((a) => (
                <circle key={a} cx={Math.cos((a * Math.PI) / 180) * 24} cy={Math.sin((a * Math.PI) / 180) * 24} r="6" fill={SOFT} stroke={INK} strokeWidth="2" />
              ))}
              <circle r="7" fill={RED} stroke={INK} strokeWidth="2" />
            </g>
          </g>
          <path d="M200 70 H240" stroke={INK} strokeWidth="3" />
          <Label x={248} y={75} anchor="start">
            {w('tire')}
          </Label>
          <path d="M160 110 H240" stroke={INK} strokeWidth="3" />
          <Label x={248} y={115} anchor="start">
            {w('rim')}
          </Label>
          <path d="M120 150 H240" stroke={INK} strokeWidth="3" />
          <Label x={248} y={155} anchor="start">
            {w('axle')}
          </Label>
        </Svg>
      )
    case 'r-triangle':
      return (
        <Svg>
          <g transform="translate(90 150)">
            <g style={anim('r-wobble', 1.6, { origin: 'bottom' })}>
              <rect x={-50} y={-100} width={100} height={100} fill="none" stroke={RED} strokeWidth="8" strokeLinejoin="round" />
            </g>
          </g>
          <path d="M210 150 L320 150 L265 50 Z" fill="none" stroke={GREEN} strokeWidth="8" strokeLinejoin="round" />
          <Label x={90} y={180}>
            {w('wobbly')}
          </Label>
          <Label x={265} y={180}>
            {w('strong')}
          </Label>
        </Svg>
      )
    case 'r-double-beam':
      return (
        <Svg>
          <g transform="translate(40 70)">
            <g style={anim('r-grip', 1.6, { origin: 'left', vars: { '--r-a': '8deg' } })}>
              <Beam x={10} y={0} holes={6} />
            </g>
          </g>
          <Beam x={210} y={60} holes={6} color={GREEN} />
          <Beam x={210} y={84} holes={6} color={GREEN} />
          <path d="M220 60 V84 M300 60 V84" stroke={INK} strokeWidth="6" />
          <Label x={100} y={150}>
            {w('single')}
          </Label>
          <Label x={260} y={150}>{`${w('double')} — ${w('strong')}`}</Label>
        </Svg>
      )
    case 'r-break':
      return (
        <Svg>
          <Beam x={40} y={100} holes={6} />
          <Beam x={200} y={100} holes={6} />
          <circle cx={170} cy={100} r="26" fill="none" stroke={RED} strokeWidth="4" strokeDasharray="6 5" style={anim('ai-pulse', 1.4)} />
          <path d="M160 70 L170 84 L178 72" stroke={RED} strokeWidth="3" fill="none" style={anim('ai-flash', 1.2)} />
          <Label x={170} y={160}>
            {w('weak')}
          </Label>
        </Svg>
      )
    case 'r-gears':
      return (
        <Svg>
          <Gear x={120} y={95} r={50} teeth={20} seconds={4} />
          <Gear x={225} y={95} r={50} teeth={20} color={BLUE} seconds={-4} />
          <Label x={120} y={178}>
            {w('driver')}
          </Label>
          <Label x={225} y={178}>
            {w('driven')}
          </Label>
        </Svg>
      )
    case 'r-ratio':
      return (
        <Svg>
          <Gear x={90} y={100} r={26} teeth={8} seconds={1.5} />
          <Gear x={163} y={100} r={64} teeth={24} color={BLUE} seconds={-4.5} />
          <Label x={90} y={150} size={12}>
            8
          </Label>
          <Label x={163} y={186} size={12}>
            24
          </Label>
          <Label x={300} y={90} size={12}>
            8 : 24
          </Label>
          <Label x={300} y={112} size={11} muted>
            = 1 : 3
          </Label>
          <Label x={300} y={150} size={11}>
            {w('slower')}
          </Label>
        </Svg>
      )
    case 'r-worm':
      return (
        <Svg>
          <g transform="translate(70 100)">
            <rect x={-40} y={-16} width={110} height={32} rx="10" fill={GREY} stroke={INK} strokeWidth="2.5" />
            {[0, 1, 2, 3, 4].map((i) => (
              <path key={i} d={`M${-30 + i * 20} -16 L${-20 + i * 20} 16`} stroke={INK} strokeWidth="3" style={anim('r-drive', 1, { linear: true, vars: { '--r-d': '10px' } })} />
            ))}
          </g>
          <Gear x={210} y={100} r={52} teeth={24} color={YELLOW} seconds={24} />
          <Label x={90} y={60}>
            {w('worm')}
          </Label>
          <Label x={210} y={185} size={12}>
            {w('oneTooth')}
          </Label>
        </Svg>
      )
    case 'r-chassis':
      return (
        <Svg>
          <rect x={110} y={50} width={140} height={100} rx="14" fill={SOFT} stroke={INK} strokeWidth="3" />
          <rect x={140} y={70} width={80} height={60} rx="10" fill={YELLOW} stroke={INK} strokeWidth="3" style={anim('ai-pulse', 2.2)} />
          <Label x={180} y={105} size={12}>
            {w('hub')}
          </Label>
          {[46, 154].map((y) => (
            <g key={y}>
              <rect x={86} y={y - 14} width={60} height={28} rx="8" fill={CARD} stroke={INK} strokeWidth="2.5" />
              <rect x={100} y={y < 100 ? y - 30 : y + 14} width={32} height={16} rx="4" fill={INK} />
            </g>
          ))}
          <Label x={60} y={55} size={11}>
            {w('motor')}
          </Label>
          <circle cx={262} cy={100} r="10" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <Label x={300} y={104} size={11}>
            {w('caster')}
          </Label>
        </Svg>
      )
    case 'r-wheel-distance':
      return (
        <Svg>
          <path d="M20 150 H340" stroke={INK} strokeWidth="3" />
          <g style={anim('r-drive', 3.5, { vars: { '--r-d': '176px' } })}>
            <g transform="translate(70 122)">
              <g style={anim('ai-spin', 1.75, { linear: true })}>
                <circle r="28" fill={INK} />
                <circle r="16" fill={CARD} stroke={INK} strokeWidth="2" />
                <circle cy={-22} r="4" fill={RED} />
              </g>
            </g>
          </g>
          <path d="M70 168 H246" stroke={RED} strokeWidth="4" strokeDasharray="8 6" />
          <Label x={158} y={190} size={12}>
            {w('circumference')}
          </Label>
        </Svg>
      )

    // ── Blocks ───────────────────────────────────────────────────────
    case 'r-loop':
      return (
        <Svg>
          <Block x={24} y={30} w={150} color="#ff9f1c">{`${w('repeat')} 4`}</Block>
          <Block x={44} y={58} w={130} color="#e8442e">
            ↑ 30
          </Block>
          <Block x={44} y={86} w={130} color="#e8442e">
            ↻ 90°
          </Block>
          <path d="M28 56 V116 H70" fill="none" stroke="#ff9f1c" strokeWidth="8" strokeLinecap="round" />
          <rect x={220} y={40} width={110} height={110} fill="none" stroke={INK} strokeWidth="2" strokeDasharray="6 6" />
          <g style={anim('r-dash', 1, { linear: true })}>
            <rect x={220} y={40} width={110} height={110} fill="none" stroke={GREEN} strokeWidth="5" strokeDasharray="20 20" />
          </g>
          <Label x={275} y={180}>{`4 ${w('times')}`}</Label>
        </Svg>
      )
    case 'r-forever':
      return (
        <Svg>
          <ellipse cx={180} cy={100} rx={120} ry={60} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="8 6" />
          <g style={anim('ai-spin', 4, { linear: true, origin: '180px 100px' })}>
            <g transform="translate(300 100) rotate(90)">
              <Bot x={0} y={0} scale={0.7} />
            </g>
          </g>
          <Label x={180} y={106} size={22}>
            ∞
          </Label>
          <Label x={180} y={186}>
            {w('forever')}
          </Label>
        </Svg>
      )
    case 'r-until':
      return (
        <Svg>
          <rect x={300} y={30} width={20} height={130} rx="4" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <Label x={310} y={182} size={11}>
            {w('wall')}
          </Label>
          <g style={anim('r-drive', 3, { vars: { '--r-d': '180px' } })}>
            <Bot x={70} y={95} />
          </g>
          <Label x={130} y={40}>{`${w('repeat')} … ${w('until')}`}</Label>
        </Svg>
      )
    case 'r-dance':
      return (
        <Svg>
          {[0, 1, 2].map((i) => (
            <g key={i} transform={`translate(${80 + i * 100} 100)`}>
              <g style={anim(i === 1 ? 'ai-spin' : 'r-tilt', i === 1 ? 2 : 1.2, { linear: i === 1, delay: i * 0.2 })}>
                <Bot x={0} y={0} color={[YELLOW, GREEN, BLUE][i]} />
              </g>
            </g>
          ))}
          <text x={180} y={40} textAnchor="middle" fontSize="26" style={{ ...TEXT, ...anim('ai-hop', 1.2) }}>
            ♪ ♫ ♪
          </text>
        </Svg>
      )
    case 'r-if':
      return (
        <Svg>
          <Card x={120} y={20} w={120} h={46} fill={GREEN}>
            <Label x={180} y={49}>
              {w('pressed')}
            </Label>
          </Card>
          <Arrow x1={180} y1={70} x2={180} y2={110} />
          <Card x={110} y={114} w={140} h={44} fill={YELLOW} style={anim('ai-pulse', 1.8)}>
            <Label x={180} y={142}>{`${w('yes')} → ■`}</Label>
          </Card>
          <Label x={300} y={150} size={11} muted>{`${w('no')} → …`}</Label>
        </Svg>
      )
    case 'r-if-else':
      return (
        <Svg>
          <Card x={120} y={16} w={120} h={42} fill={GREEN}>
            <Label x={180} y={43}>
              ?
            </Label>
          </Card>
          <Arrow x1={160} y1={60} x2={90} y2={110} />
          <Arrow x1={200} y1={60} x2={270} y2={110} />
          <Card x={30} y={114} w={120} h={42} fill={YELLOW} style={anim('r-step-1', 3)}>
            <Label x={90} y={141}>
              {w('yes')}
            </Label>
          </Card>
          <Card x={210} y={114} w={120} h={42} fill={BLUE} style={anim('r-step-3', 3)}>
            <Label x={270} y={141}>
              {w('no')}
            </Label>
          </Card>
        </Svg>
      )
    case 'r-wait-until':
      return (
        <Svg>
          <Bot x={80} y={100} />
          <g style={anim('ai-fade', 1.4)}>
            <Label x={80} y={50}>
              …
            </Label>
          </g>
          <g transform="translate(250 100)">
            <circle r="34" fill={SOFT} stroke={INK} strokeWidth="3" />
            <path d="M0 0 V-24" stroke={INK} strokeWidth="4" strokeLinecap="round" style={anim('ai-spin', 3, { linear: true, origin: '0px 0px' })} />
          </g>
          <Label x={180} y={180}>
            {w('waitUntil')}
          </Label>
        </Svg>
      )
    case 'r-variable':
      return (
        <Svg>
          <g transform="translate(110 70)">
            <path d="M-50 0 L0 -26 L50 0 L0 26 Z" fill={SOFT} stroke={INK} strokeWidth="2.5" />
            <rect x={-50} y={0} width={100} height={70} fill={YELLOW} stroke={INK} strokeWidth="3" />
            <Label x={0} y={46} size={24}>
              30
            </Label>
          </g>
          <Label x={110} y={170}>
            {w('speed')}
          </Label>
          <g style={anim('ai-bob', 1.8)}>
            <Card x={210} y={60} w={120} h={50} fill={CARD}>
              <Label x={270} y={91} size={14}>{`${w('speed')} = 30`}</Label>
            </Card>
          </g>
        </Svg>
      )
    case 'r-counter':
      return (
        <Svg>
          <rect x={40} y={40} width={110} height={110} rx="16" fill={INK} />
          {[1, 2, 3].map((n, i) => (
            <text key={n} x={95} y={118} textAnchor="middle" fontSize="60" style={{ ...TEXT, fill: '#ffd76a', ...anim(`r-step-${i + 1}`, 3) }}>
              {n}
            </text>
          ))}
          <ellipse cx={260} cy={100} rx={70} ry={50} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="8 6" />
          <g style={anim('ai-spin', 3, { linear: true, origin: '260px 100px' })}>
            <circle cx={330} cy={100} r="9" fill={RED} stroke={INK} strokeWidth="2.5" />
          </g>
          <Label x={260} y={180}>{`${w('laps')} +1`}</Label>
        </Svg>
      )
    case 'r-myblock':
      return (
        <Svg>
          <Card x={20} y={30} w={150} h={120} fill={SOFT} />
          <Block x={32} y={42} w={126} color="#f06fb4">
            {w('myBlock')}
          </Block>
          <Block x={44} y={74} w={114} color="#e8442e">
            ↑ 20
          </Block>
          <Block x={44} y={104} w={114} color="#e8442e">
            ↻ 90°
          </Block>
          {[0, 1, 2].map((i) => (
            <Block key={i} x={210} y={40 + i * 40} w={130} color="#f06fb4" style={anim(`r-step-${i + 1}`, 3)}>{`${w('call')} ▸`}</Block>
          ))}
        </Svg>
      )

    // ── Sensors ──────────────────────────────────────────────────────
    case 'r-color':
      return (
        <Svg>
          {[RED, GREEN, BLUE, YELLOW, INK].map((c, i) => (
            <rect key={c} x={30 + i * 62} y={130} width={56} height={40} rx="6" fill={c} stroke={INK} strokeWidth="2.5" />
          ))}
          <g style={anim('r-drive', 5, { vars: { '--r-d': '248px' } })}>
            <rect x={44} y={60} width={28} height={36} rx="6" fill={CARD} stroke={INK} strokeWidth="2.5" />
            <path d="M50 96 L44 126 M66 96 L72 126" stroke={YELLOW} strokeWidth="3" strokeDasharray="4 4" />
            <circle cx={58} cy={88} r="5" fill={GREEN} style={anim('ai-fade', 0.8)} />
          </g>
          <Label x={180} y={40}>
            {w('sees')}
          </Label>
        </Svg>
      )
    case 'r-reflection':
      return (
        <Svg>
          <defs>
            <linearGradient id="r-grad" x1="0" x2="1">
              <stop offset="0" stopColor="#ffffff" />
              <stop offset="1" stopColor={INK} />
            </linearGradient>
          </defs>
          <rect x={30} y={120} width={300} height={40} rx="8" fill="url(#r-grad)" stroke={INK} strokeWidth="2.5" />
          <g style={anim('r-drive', 4, { vars: { '--r-d': '240px' } })}>
            <rect x={44} y={70} width={28} height={30} rx="6" fill={CARD} stroke={INK} strokeWidth="2.5" />
            <path d="M58 100 V118" stroke={YELLOW} strokeWidth="4" />
          </g>
          <Label x={50} y={185} anchor="start">{`${w('light')} ≈ 100%`}</Label>
          <Label x={310} y={185} anchor="end">{`${w('dark')} ≈ 10%`}</Label>
        </Svg>
      )
    case 'r-distance':
      return (
        <Svg>
          <rect x={300} y={30} width={20} height={140} rx="4" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <Bot x={80} y={100} />
          {[0, 1, 2].map((i) => (
            <path key={i} d="M120 70 Q150 100 120 130" fill="none" stroke={BLUE} strokeWidth="4" style={anim('r-drive', 1.5, { delay: i * 0.5, linear: true, vars: { '--r-d': '160px' } })} />
          ))}
          <Label x={200} y={180}>
            {w('echo')}
          </Label>
        </Svg>
      )
    case 'r-force':
      return (
        <Svg>
          <rect x={300} y={30} width={20} height={140} rx="4" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <g style={anim('r-drive', 2.4, { vars: { '--r-d': '150px' } })}>
            <Bot x={110} y={100} />
            <rect x={146} y={86} width={12} height={28} rx="4" fill={RED} stroke={INK} strokeWidth="2.5" />
          </g>
          <Label x={130} y={50}>
            {w('bumper')}
          </Label>
        </Svg>
      )
    case 'r-gyro':
      return (
        <Svg>
          <g transform="translate(120 100)">
            <circle r="66" fill={SOFT} stroke={INK} strokeWidth="3" />
            {[0, 90, 180, 270].map((a) => (
              <text key={a} x={Math.cos(((a - 90) * Math.PI) / 180) * 50} y={Math.sin(((a - 90) * Math.PI) / 180) * 50 + 5} textAnchor="middle" fontSize="12" style={MUTED}>
                {a}°
              </text>
            ))}
            <g style={anim('r-grip', 3, { origin: '0px 0px', vars: { '--r-a': '90deg' } })}>
              <path d="M0 0 V-38" stroke={RED} strokeWidth="5" strokeLinecap="round" />
            </g>
            <circle r="6" fill={INK} />
          </g>
          <g transform="translate(270 100)">
            <g style={anim('r-grip', 3, { vars: { '--r-a': '90deg' } })}>
              <g transform="rotate(-90)">
                <Bot x={0} y={0} />
              </g>
            </g>
          </g>
          <Label x={180} y={190}>
            {w('yaw')}
          </Label>
        </Svg>
      )
    case 'r-tilt':
      return (
        <Svg>
          <g transform="translate(180 120)">
            <g style={anim('r-tilt', 2.4)}>
              <rect x={-120} y={-4} width={240} height={8} rx="4" fill={GREY} stroke={INK} strokeWidth="2" />
              <g transform="translate(0 -26)">
                <rect x={-34} y={-18} width={68} height={36} rx="8" fill={YELLOW} stroke={INK} strokeWidth="3" />
                <circle cx={-20} cy={22} r="8" fill={INK} />
                <circle cx={20} cy={22} r="8" fill={INK} />
              </g>
            </g>
          </g>
          <Label x={180} y={180}>
            {w('tilt')}
          </Label>
        </Svg>
      )
    case 'r-line':
      return (
        <Svg>
          <path d="M20 100 H340" stroke={INK} strokeWidth="14" />
          <g style={anim('r-drive', 5, { vars: { '--r-d': '220px' } })}>
            <g transform="translate(60 100)">
              <g style={anim('r-zig', 0.9)}>
                <Bot x={0} y={0} scale={0.8} />
              </g>
            </g>
          </g>
          <Label x={70} y={50} size={12}>
            {w('left')}
          </Label>
          <Label x={70} y={160} size={12}>
            {w('right')}
          </Label>
        </Svg>
      )
    case 'r-crossing':
      return (
        <Svg>
          <path d="M20 110 H340 M120 20 V190 M250 20 V190" stroke={INK} strokeWidth="12" />
          <circle cx={120} cy={110} r="18" fill="none" stroke={RED} strokeWidth="4" style={anim('r-step-1', 3)} />
          <circle cx={250} cy={110} r="18" fill="none" stroke={RED} strokeWidth="4" style={anim('r-step-3', 3)} />
          <g style={anim('r-drive', 3, { vars: { '--r-d': '250px' } })}>
            <Bot x={40} y={110} scale={0.7} />
          </g>
          <Label x={300} y={40} size={12}>
            {w('crossing')}
          </Label>
        </Svg>
      )

    // ── Navigation ───────────────────────────────────────────────────
    case 'r-slip':
      return (
        <Svg>
          <path d="M40 100 H320" stroke={GREEN} strokeWidth="4" strokeDasharray="10 8" />
          <path d="M40 100 Q180 100 320 140" stroke={RED} strokeWidth="4" fill="none" style={anim('ai-fade', 2)} />
          <Bot x={40} y={100} scale={0.8} />
          <Label x={240} y={80} size={12}>
            {w('plan')}
          </Label>
          <Label x={260} y={170} size={12}>
            {w('real')}
          </Label>
        </Svg>
      )
    case 'r-scatter':
      return (
        <Svg>
          <circle cx={260} cy={100} r="34" fill="none" stroke={GREEN} strokeWidth="4" strokeDasharray="6 5" />
          <Label x={260} y={160} size={12}>
            {w('target')}
          </Label>
          {[
            [250, 92],
            [272, 104],
            [262, 84],
            [244, 112],
            [292, 70],
          ].map(([x, y], i) => (
            <g key={i} style={anim('ai-fade', 2.5, { delay: i * 0.4 })}>
              <path d={`M60 100 L${x} ${y}`} stroke={GREY} strokeWidth="1.5" strokeDasharray="3 4" />
              <circle cx={x} cy={y} r="6" fill={i === 4 ? RED : BLUE} stroke={INK} strokeWidth="2" />
            </g>
          ))}
          <Bot x={60} y={100} scale={0.8} />
        </Svg>
      )
    case 'r-calibrate':
      return (
        <Svg>
          <rect x={40} y={130} width={280} height={24} fill={YELLOW} stroke={INK} strokeWidth="2.5" />
          {Array.from({ length: 11 }, (_, i) => (
            <path key={i} d={`M${40 + i * 28} 130 v${i % 5 === 0 ? 14 : 8}`} stroke={INK} strokeWidth="2" />
          ))}
          <Label x={40} y={176} size={11}>
            0
          </Label>
          <Label x={320} y={176} size={11}>
            50
          </Label>
          <g style={anim('r-drive', 3, { vars: { '--r-d': '262px' } })}>
            <Bot x={40} y={100} scale={0.8} />
          </g>
          <Label x={180} y={50}>
            {w('measure')}
          </Label>
        </Svg>
      )
    case 'r-p-control':
      return (
        <Svg>
          <path d="M20 70 H340" stroke={INK} strokeWidth="10" />
          <path d="M40 150 C120 150 140 75 200 72 S300 70 330 70" fill="none" stroke={BLUE} strokeWidth="4" strokeDasharray="300" style={anim('r-fill', 3, { origin: 'left' })} />
          <path d="M60 150 V76" stroke={RED} strokeWidth="3" strokeDasharray="5 4" />
          <Label x={70} y={120} size={11} anchor="start">
            {w('error')}
          </Label>
          <Label x={220} y={120} size={12}>{`${w('fix')} = Kp × ${w('error')}`}</Label>
        </Svg>
      )
    case 'r-pid':
      return (
        <Svg>
          <path d="M30 70 H340" stroke={GREEN} strokeWidth="3" strokeDasharray="6 5" />
          <path d="M30 160 C70 20 100 20 130 110 S180 50 210 80 S260 70 340 70" fill="none" stroke={RED} strokeWidth="3" opacity="0.6" />
          <path d="M30 160 C90 160 110 72 160 70 S300 70 340 70" fill="none" stroke={BLUE} strokeWidth="5" style={anim('ai-fade', 2.4)} />
          <Label x={300} y={50} size={12}>
            {w('target')}
          </Label>
          <Label x={50} y={190} size={11} anchor="start" muted>
            P · I · D
          </Label>
        </Svg>
      )
    case 'r-coordinates':
      return (
        <Svg>
          <path d="M40 170 H330 M40 170 V24" stroke={INK} strokeWidth="3" />
          {[1, 2, 3, 4].map((i) => (
            <path key={i} d={`M${40 + i * 70} 170 V24 M40 ${170 - i * 35} H330`} stroke={SOFT} strokeWidth="2" />
          ))}
          <circle cx={250} cy={65} r="8" fill={RED} stroke={INK} strokeWidth="2.5" style={anim('ai-pulse', 1.4)} />
          <Label x={262} y={56} anchor="start" size={12}>
            (600, 300)
          </Label>
          <Label x={330} y={190} size={11}>
            {lang === 'en' ? 'x, mm' : 'x, мм'}
          </Label>
          <Label x={30} y={18} size={11} anchor="start">
            y
          </Label>
          <g style={anim('r-drive', 3, { vars: { '--r-d': '180px' } })}>
            <Bot x={70} y={140} scale={0.6} />
          </g>
        </Svg>
      )

    // ── Python ───────────────────────────────────────────────────────
    case 'r-python':
      return (
        <Svg>
          <Block x={20} y={50} w={130} color="#ff9f1c">{`${w('repeat')} 4`}</Block>
          <Block x={40} y={80} w={110} color="#e8442e">
            ↑ 30
          </Block>
          <Arrow x1={160} y1={90} x2={196} y2={90} style={anim('ai-nudge', 1.6)} />
          <Card x={204} y={40} w={140} h={100} fill={INK}>
            <text x={216} y={74} fontSize="13" style={{ ...TEXT, fill: '#ffd76a', fontFamily: 'var(--font-code), monospace' }}>
              for i in range(4):
            </text>
            <text x={232} y={100} fontSize="13" style={{ ...TEXT, fill: '#a8e6c4', fontFamily: 'var(--font-code), monospace' }}>
              await move(30)
            </text>
          </Card>
          <Label x={85} y={160} size={12}>
            {w('blocks')}
          </Label>
          <Label x={274} y={160} size={12}>
            {w('python')}
          </Label>
        </Svg>
      )
    case 'r-await':
      return (
        <Svg>
          <path d="M30 150 H330" stroke={INK} strokeWidth="3" />
          {[0, 1, 2].map((i) => (
            <rect key={i} x={40 + i * 100} y={110} width={90} height={30} rx="8" fill={[YELLOW, GREEN, BLUE][i]} stroke={INK} strokeWidth="2.5" style={anim(`r-step-${i + 1}`, 3)} />
          ))}
          <Label x={85} y={130} size={12}>
            move
          </Label>
          <Label x={185} y={130} size={12}>
            turn
          </Label>
          <Label x={285} y={130} size={12}>
            beep
          </Label>
          <Label x={180} y={60} size={14}>
            await
          </Label>
          <Label x={180} y={84} size={11} muted>
            {w('waits')}
          </Label>
          <Label x={180} y={178} size={11} muted>
            {w('time')} →
          </Label>
        </Svg>
      )
    case 'r-indent':
      return (
        <Svg>
          <Card x={30} y={30} w={300} h={140} fill={INK} />
          {[
            [48, 'while True:', '#ffd76a'],
            [76, 'if dist < 10:', '#ffd76a'],
            [104, 'stop()', '#a8e6c4'],
          ].map(([x, line, color], i) => (
            <text key={i} x={Number(x)} y={70 + i * 32} fontSize="15" style={{ ...TEXT, fill: String(color), fontFamily: 'var(--font-code), monospace' }}>
              {line}
            </text>
          ))}
          <rect x={48} y={84} width={26} height={8} rx="3" fill={RED} style={anim('ai-fade', 1.2)} />
          <rect x={48} y={116} width={54} height={8} rx="3" fill={RED} style={anim('ai-fade', 1.2, { delay: 0.3 })} />
          <Label x={180} y={190} size={11} muted>
            {w('inside')} = 4 ␣
          </Label>
        </Svg>
      )

    // ── Mechanisms ───────────────────────────────────────────────────
    case 'r-gripper':
      return (
        <Svg>
          <rect x={150} y={20} width={60} height={40} rx="8" fill={CARD} stroke={INK} strokeWidth="3" />
          <g style={anim('r-grip', 2.4, { origin: 'top', vars: { '--r-a': '18deg' } })}>
            <path d="M160 60 L140 130 L160 140" fill="none" stroke={BLUE} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <g style={anim('r-grip', 2.4, { origin: 'top', vars: { '--r-a': '-18deg' } })}>
            <path d="M200 60 L220 130 L200 140" fill="none" stroke={BLUE} strokeWidth="10" strokeLinecap="round" strokeLinejoin="round" />
          </g>
          <rect x={164} y={112} width={32} height={32} rx="4" fill={RED} stroke={INK} strokeWidth="2.5" />
          <Label x={180} y={185}>
            {w('grab')}
          </Label>
        </Svg>
      )
    case 'r-lift':
      return (
        <Svg>
          <rect x={100} y={20} width={14} height={150} rx="4" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <rect x={150} y={20} width={14} height={150} rx="4" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <g style={anim('r-climb', 3, { vars: { '--r-d': '-80px' } })}>
            <rect x={90} y={140} width={84} height={14} rx="4" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
            <rect x={116} y={116} width={30} height={24} rx="4" fill={RED} stroke={INK} strokeWidth="2.5" />
          </g>
          <Gear x={260} y={110} r={34} teeth={16} color={BLUE} seconds={3} />
          <Label x={260} y={175}>
            {w('lift')}
          </Label>
        </Svg>
      )
    case 'r-lever':
      return (
        <Svg>
          <path d="M150 150 L170 120 L190 150 Z" fill={GREY} stroke={INK} strokeWidth="2.5" />
          <g transform="translate(170 118)">
            <g style={anim('r-tilt', 2.6)}>
              <rect x={-140} y={-5} width={280} height={10} rx="5" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
              <rect x={-136} y={-37} width={32} height={32} rx="4" fill={RED} stroke={INK} strokeWidth="2.5" />
              <path d="M120 -40 V-8" stroke={INK} strokeWidth="4" />
              <path d="M112 -18 L120 -6 L128 -18" fill={INK} />
            </g>
          </g>
          <Label x={50} y={180} size={12}>
            {w('load')}
          </Label>
          <Label x={170} y={180} size={12}>
            {w('fulcrum')}
          </Label>
        </Svg>
      )
    case 'r-pusher':
      return (
        <Svg>
          <rect x={230} y={60} width={110} height={80} rx="8" fill={SOFT} stroke={GREEN} strokeWidth="3" strokeDasharray="6 5" />
          <g style={anim('r-drive', 2.6, { vars: { '--r-d': '120px' } })}>
            <Bot x={60} y={100} />
            <rect x={96} y={78} width={10} height={44} rx="3" fill={BLUE} stroke={INK} strokeWidth="2" />
            <rect x={108} y={86} width={28} height={28} rx="4" fill={RED} stroke={INK} strokeWidth="2.5" />
          </g>
          <Label x={180} y={180}>
            {w('push')}
          </Label>
        </Svg>
      )
    case 'r-swap':
      return (
        <Svg>
          <Bot x={110} y={100} scale={1.4} />
          {[BLUE, GREEN, RED].map((c, i) => (
            <rect key={c} x={160} y={78} width={18} height={44} rx="4" fill={c} stroke={INK} strokeWidth="2.5" style={anim(`r-step-${i + 1}`, 3)} />
          ))}
          <g transform="translate(270 95)">
            <circle r="34" fill={CARD} stroke={INK} strokeWidth="3" />
            <path d="M0 0 V-24" stroke={RED} strokeWidth="4" strokeLinecap="round" style={anim('ai-spin', 5, { linear: true, origin: '0px 0px' })} />
          </g>
          <Label x={270} y={160} size={12}>
            {w('swap')}
          </Label>
        </Svg>
      )

    // ── FLL ──────────────────────────────────────────────────────────
    case 'r-fll-parts':
      return (
        <Svg>
          {[
            [w('values'), RED],
            [w('project'), BLUE],
            [w('design'), GREEN],
            [w('game'), YELLOW],
          ].map(([label, color], i) => (
            <Card key={i} x={14 + i * 86} y={50} w={78} h={90} fill={color} style={anim('ai-bob', 2.4, { delay: i * 0.3 })}>
              <Label x={53 + i * 86} y={100} size={11}>
                {label}
              </Label>
            </Card>
          ))}
        </Svg>
      )
    case 'r-fll-table':
      return (
        <Svg>
          <rect x={30} y={40} width={300} height={130} rx="10" fill={GREEN} stroke={INK} strokeWidth="3" opacity="0.85" />
          <rect x={40} y={130} width={60} height={30} fill={CARD} stroke={INK} strokeWidth="2" />
          <g style={anim('r-drive', 4, { vars: { '--r-d': '160px' } })}>
            <Bot x={70} y={145} scale={0.6} />
          </g>
          {[
            [150, 80],
            [240, 70],
            [280, 140],
          ].map(([x, y], i) => (
            <rect key={i} x={x} y={y} width={22} height={22} rx="4" fill={[YELLOW, RED, BLUE][i]} stroke={INK} strokeWidth="2" />
          ))}
          <Card x={250} y={10} w={90} h={34} fill={INK}>
            <text x={295} y={34} textAnchor="middle" fontSize="18" style={{ ...TEXT, fill: '#ffd76a' }}>
              2:30
            </text>
          </Card>
        </Svg>
      )
    case 'r-strategy':
      return (
        <Svg>
          <path d="M40 160 H330 M40 160 V30" stroke={INK} strokeWidth="3" />
          {[
            [70, 60, GREEN],
            [130, 100, YELLOW],
            [190, 40, RED],
            [250, 120, BLUE],
          ].map(([x, h, c], i) => (
            <rect key={i} x={Number(x)} y={160 - Number(h)} width={36} height={Number(h)} rx="4" fill={String(c)} stroke={INK} strokeWidth="2" style={anim('ai-grow', 2.4, { delay: i * 0.25, origin: 'bottom' })} />
          ))}
          <Label x={30} y={24} size={11} anchor="start">
            {w('points')}
          </Label>
          <Label x={330} y={186} size={11} anchor="end">{`${w('points')} / ${w('time')}`}</Label>
        </Svg>
      )
    case 'r-team':
      return (
        <Svg>
          <Person x={60} y={110} color={YELLOW} label={w('captain')} />
          <Person x={140} y={110} color={BLUE} label={w('builder')} delay={0.3} />
          <Person x={220} y={110} color={GREEN} label={w('coder')} delay={0.6} />
          <Person x={300} y={110} color={RED} label={w('driverRole')} delay={0.9} />
        </Svg>
      )
    case 'r-notebook':
      return (
        <Svg>
          <rect x={90} y={24} width={180} height={150} rx="10" fill={CARD} stroke={INK} strokeWidth="3" />
          <path d="M180 24 V174" stroke={INK} strokeWidth="2" />
          {[0, 1, 2, 3].map((i) => (
            <rect key={i} x={104} y={50 + i * 26} width={62} height={8} rx="4" fill={SOFT} style={anim('r-fill', 3, { delay: i * 0.3, origin: 'left' })} />
          ))}
          <path d="M200 120 L220 80 L240 100 L256 60" fill="none" stroke={BLUE} strokeWidth="3" style={anim('ai-fade', 2)} />
          <Label x={180} y={194} size={12}>
            {w('notebook')}
          </Label>
        </Svg>
      )
    case 'r-judging':
      return (
        <Svg>
          <Person x={60} y={120} color={BLUE} label="" />
          <Person x={110} y={120} color={GREEN} label="" delay={0.3} />
          <rect x={160} y={60} width={40} height={50} rx="6" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
          <Person x={260} y={120} color={VIOLET} label={w('judges')} delay={0.6} />
          <Person x={310} y={120} color={GREY} label="" delay={0.9} />
          <g style={anim('ai-fade', 1.6)}>
            <Card x={210} y={20} w={60} h={30} fill={CARD}>
              <Label x={240} y={41} size={14}>
                ?
              </Label>
            </Card>
          </g>
        </Svg>
      )
    default:
      return null
  }
}
