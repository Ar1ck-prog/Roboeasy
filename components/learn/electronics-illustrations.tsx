'use client'

/**
 * Drawings for the electronics tracks (Arduino, ESP32): current as water,
 * circuits, LEDs, resistors, the breadboard, boards and signals. Same style
 * as robo-illustrations.tsx: a light card with dark lines in both themes and
 * CSS-only motion (keyframes in globals.css) that stops for reduced motion.
 */

import type { CSSProperties, ReactNode } from 'react'

import { Esp32Board, UnoBoard } from '@/components/electronics/bench'
import { PartArt } from '@/components/electronics/part-art'
import { DEFAULT_PROPS, type Part, type PartType } from '@/lib/electronics/board'

type Lang = 'ru' | 'kk' | 'en'

const INK = '#1b1f2a'
const BACKDROP = '#fff9ee'
const YELLOW = '#ffc531'
const GREEN = '#2bb673'
const BLUE = '#4a86f7'
const RED = '#e5484d'
const GREY = '#8b90a0'
const TEXT = { fill: INK, fontWeight: 800, fontFamily: 'var(--font-body), sans-serif' } as const
const MUTED = { fill: '#454b5c', fontWeight: 700, fontFamily: 'var(--font-body), sans-serif' } as const

function anim(name: string, seconds = 2, opts: { delay?: number; linear?: boolean; origin?: string } = {}): CSSProperties {
  return {
    animation: `${name} ${seconds}s ${opts.linear ? 'linear' : 'ease-in-out'} ${opts.delay ?? 0}s infinite`,
    transformBox: 'fill-box',
    transformOrigin: opts.origin ?? 'center',
  }
}

const W = {
  tank: { ru: 'напряжение — как высота воды', kk: 'кернеу — су биіктігі сияқты', en: 'voltage is like the water height' },
  flow: { ru: 'ток — поток', kk: 'ток — ағын', en: 'current is the flow' },
  narrow: { ru: 'сопротивление — узкая труба', kk: 'кедергі — тар құбыр', en: 'resistance is a narrow pipe' },
  closed: { ru: 'цепь замкнута — ток идёт', kk: 'тізбек тұйық — ток жүреді', en: 'closed circuit: current flows' },
  open: { ru: 'разрыв — тока нет', kk: 'үзіліс — ток жоқ', en: 'a gap: no current' },
  long: { ru: 'длинная ножка: анод (+)', kk: 'ұзын аяқ: анод (+)', en: 'long leg: anode (+)' },
  short: { ru: 'короткая: катод (−)', kk: 'қысқа: катод (−)', en: 'short leg: cathode (−)' },
  flat: { ru: 'срез у катода', kk: 'катод жағы тегіс', en: 'flat side at the cathode' },
  bands: { ru: 'красный-красный-коричневый = 220 Ом', kk: 'қызыл-қызыл-қоңыр = 220 Ом', en: 'red-red-brown = 220 Ω' },
  ohm: { ru: 'закрой то, что ищешь', kk: 'іздегеніңді жап', en: 'cover what you look for' },
  rows: { ru: 'пять отверстий в столбике соединены', kk: 'бағандағы бес тесік қосылған', en: 'five holes in a column are connected' },
  rails: { ru: 'шины + и − идут вдоль всей платы', kk: '+ және − шиналар бүкіл тақта бойымен', en: 'the + and − rails run the whole length' },
  press: { ru: 'нажал — цепь замкнулась', kk: 'бастың — тізбек тұйықталды', en: 'pressed: the circuit closes' },
  usb: { ru: 'USB: программа и питание', kk: 'USB: бағдарлама және қорек', en: 'USB: program and power' },
  pins: { ru: 'пины: сюда подключают детали', kk: 'пиндер: бөлшектер осында қосылады', en: 'pins: parts connect here' },
  brain: { ru: 'микроконтроллер — мозг', kk: 'микроконтроллер — ми', en: 'the microcontroller is the brain' },
  once: { ru: 'один раз при включении', kk: 'қосқанда бір рет', en: 'once at power-on' },
  forever: { ru: 'снова и снова', kk: 'қайта-қайта', en: 'again and again' },
  high: { ru: 'HIGH = 5 В', kk: 'HIGH = 5 В', en: 'HIGH = 5 V' },
  low: { ru: 'LOW = 0 В', kk: 'LOW = 0 В', en: 'LOW = 0 V' },
  dim: { ru: 'тускло', kk: 'күңгірт', en: 'dim' },
  half: { ru: 'наполовину', kk: 'жартылай', en: 'half' },
  bright: { ru: 'ярко', kk: 'жарық', en: 'bright' },
  knob: { ru: 'крутишь ручку → меняется число', kk: 'тұтқаны бұрайсың → сан өзгереді', en: 'turn the knob → the number changes' },
  pullup: { ru: 'подтяжка держит HIGH, кнопка тянет в LOW', kk: 'тартқыш HIGH ұстайды, түйме LOW-ға тартады', en: 'the pull-up holds HIGH, the button pulls to LOW' },
  computer: { ru: 'компьютер', kk: 'компьютер', en: 'computer' },
  board: { ru: 'плата', kk: 'тақта', en: 'board' },
  angle: { ru: 'угол от 0° до 180°', kk: '0°-тан 180°-қа дейін бұрыш', en: 'an angle from 0° to 180°' },
  echo: { ru: 'звук туда и обратно: 58 мкс на 1 см', kk: 'дыбыс барып-қайтады: 1 см-ге 58 мкс', en: 'sound there and back: 58 µs per cm' },
  wifi: { ru: 'Wi-Fi и Bluetooth', kk: 'Wi-Fi және Bluetooth', en: 'Wi-Fi and Bluetooth' },
  uno5: { ru: 'Arduino Uno: 5 В', kk: 'Arduino Uno: 5 В', en: 'Arduino Uno: 5 V' },
  esp33: { ru: 'ESP32: 3,3 В', kk: 'ESP32: 3,3 В', en: 'ESP32: 3.3 V' },
  danger: { ru: '5 В на пин ESP32 — опасно!', kk: 'ESP32 пиніне 5 В — қауіпті!', en: '5 V on an ESP32 pin: danger!' },
}
type WordKey = keyof typeof W

function Svg({ children, viewBox = '0 0 360 200' }: { children: ReactNode; viewBox?: string }) {
  return (
    <svg viewBox={viewBox} className="ill-anim w-full" aria-hidden="true">
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

/** A part from the lab, drawn larger at (x, y). */
function P({ type, x, y, scale = 2, props = {}, brightness, rot = 0 }: { type: PartType; x: number; y: number; scale?: number; props?: Part['props']; brightness?: number; rot?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale}) rotate(${rot})`}>
      <PartArt part={{ id: `ill-${type}`, type, x: 0, y: 0, rot: 0, props: { ...DEFAULT_PROPS[type], ...props } }} brightness={brightness} />
    </g>
  )
}

/** A wire loop with moving dashes for current. */
function Flow({ d, on = true, color = BLUE }: { d: string; on?: boolean; color?: string }) {
  return (
    <>
      <path d={d} fill="none" stroke={INK} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={on ? color : GREY} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      {on && <path d={d} fill="none" stroke="#fff" strokeWidth="3" strokeDasharray="6 14" strokeLinecap="round" style={anim('r-dash', 0.8, { linear: true })} />}
    </>
  )
}

function Battery({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x={-18} y={-34} width={36} height={68} rx="6" fill={YELLOW} stroke={INK} strokeWidth="3" />
      <rect x={-8} y={-42} width={16} height={8} rx="2" fill={INK} />
      <text x={0} y={-12} textAnchor="middle" fontSize="18" style={TEXT}>
        +
      </text>
      <text x={0} y={24} textAnchor="middle" fontSize="20" style={TEXT}>
        −
      </text>
    </g>
  )
}

export function ElectronicsIllustration({ name, lang }: { name: string; lang: Lang }) {
  const w = (k: WordKey) => W[k][lang]
  switch (name) {
    case 'e-water':
      return (
        <Svg>
          <rect x={22} y={40} width={70} height={110} rx="6" fill="#fff" stroke={INK} strokeWidth="3" />
          <rect x={25} y={70} width={64} height={77} rx="3" fill={BLUE} opacity={0.75} />
          <path d="M92 132 H180" stroke={INK} strokeWidth="22" strokeLinecap="round" />
          <path d="M92 132 H180" stroke={BLUE} strokeWidth="16" strokeLinecap="round" opacity={0.75} />
          <path d="M180 132 H250" stroke={INK} strokeWidth="10" strokeLinecap="round" />
          <path d="M180 132 H250" stroke={BLUE} strokeWidth="5" strokeLinecap="round" />
          <path d="M250 132 H330" stroke={INK} strokeWidth="22" strokeLinecap="round" />
          <path d="M250 132 H330" stroke={BLUE} strokeWidth="16" strokeLinecap="round" opacity={0.75} />
          <path d="M98 132 H326" stroke="#fff" strokeWidth="3" strokeDasharray="5 14" style={anim('r-dash', 0.9, { linear: true })} />
          <Label x={58} y={30} size={11}>
            {w('tank')}
          </Label>
          <Label x={140} y={168} size={11}>
            {w('flow')}
          </Label>
          <Label x={250} y={100} size={11}>
            {w('narrow')}
          </Label>
          <path d="M215 106 V122" stroke={INK} strokeWidth="2" markerEnd="none" />
        </Svg>
      )
    case 'e-circuit':
    case 'e-open': {
      const on = name === 'e-circuit'
      return (
        <Svg>
          <Battery x={60} y={100} />
          <Flow on={on} d={on ? 'M60 58 V30 H300 V170 H60 V142' : 'M60 58 V30 H170 M200 30 H300 V170 H60 V142'} />
          {!on && (
            <g>
              <circle cx={170} cy={30} r={5} fill={INK} />
              <circle cx={200} cy={30} r={5} fill={INK} />
              <path d="M170 30 L196 12" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            </g>
          )}
          <P type="led" x={300} y={86} scale={2.6} rot={90} brightness={on ? 1 : 0} />
          <P type="resistor" x={140} y={170} scale={1.6} />
          <Label x={168} y={110} size={13}>
            {on ? w('closed') : w('open')}
          </Label>
        </Svg>
      )
    }
    case 'e-led':
      return (
        <Svg>
          <g transform="translate(150 150) scale(5)">
            <PartArt part={{ id: 'ill-led', type: 'led', x: 0, y: 0, rot: 0, props: { color: 'red' } }} brightness={0.9} />
          </g>
          <path d="M150 152 V188" stroke="#9aa0a6" strokeWidth="6" />
          <path d="M200 152 V172" stroke="#9aa0a6" strokeWidth="6" />
          <Label x={120} y={194} size={12} anchor="end">
            {w('long')}
          </Label>
          <Label x={212} y={180} size={12} anchor="start">
            {w('short')}
          </Label>
          <Label x={250} y={70} size={11} anchor="start" muted>
            {w('flat')}
          </Label>
          <path d="M248 74 L214 92" stroke={INK} strokeWidth="2" />
        </Svg>
      )
    case 'e-resistor':
      return (
        <Svg>
          <P type="resistor" x={60} y={95} scale={6} props={{ ohms: 220 }} />
          <Label x={180} y={160} size={13}>
            {w('bands')}
          </Label>
          <Label x={180} y={40} size={22}>
            220 Ω
          </Label>
        </Svg>
      )
    case 'e-ohm':
      return (
        <Svg>
          <path d="M180 22 L300 170 H60 Z" fill="#fff" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <path d="M100 118 H260" stroke={INK} strokeWidth="3" />
          <path d="M180 118 V170" stroke={INK} strokeWidth="3" />
          <Label x={180} y={95} size={34}>
            U
          </Label>
          <Label x={130} y={155} size={30}>
            I
          </Label>
          <Label x={230} y={155} size={30}>
            R
          </Label>
          <Label x={316} y={60} size={13} anchor="end">
            U = I × R
          </Label>
          <Label x={316} y={80} size={13} anchor="end">
            R = U ÷ I
          </Label>
          <Label x={50} y={60} size={11} anchor="start" muted>
            {w('ohm')}
          </Label>
        </Svg>
      )
    case 'e-breadboard':
      return (
        <Svg>
          <rect x={30} y={28} width={300} height={150} rx="10" fill="#f6f3ec" stroke={INK} strokeWidth="3" />
          <line x1={40} y1={42} x2={320} y2={42} stroke={BLUE} strokeWidth="2" />
          <line x1={40} y1={54} x2={320} y2={54} stroke={RED} strokeWidth="2" />
          <rect x={40} y={100} width={280} height={10} rx="3" fill="#e6e0d2" />
          {Array.from({ length: 14 }, (_, c) =>
            [0, 1, 2, 3, 4].map((r) => <rect key={`${c}-${r}`} x={52 + c * 20} y={66 + r * 7} width={5} height={5} rx="1" fill={INK} opacity={0.8} />),
          )}
          {Array.from({ length: 14 }, (_, c) =>
            [0, 1, 2, 3, 4].map((r) => <rect key={`b${c}-${r}`} x={52 + c * 20} y={118 + r * 7} width={5} height={5} rx="1" fill={INK} opacity={0.8} />),
          )}
          <rect x={128} y={62} width={13} height={38} rx="5" fill="none" stroke={GREEN} strokeWidth="3" style={anim('ai-pulse', 1.6)} />
          <rect x={44} y={37} width={272} height={10} rx="5" fill="none" stroke={BLUE} strokeWidth="2.5" strokeDasharray="6 4" />
          <Label x={180} y={192} size={11}>
            {w('rows')}
          </Label>
          <Label x={180} y={24} size={11}>
            {w('rails')}
          </Label>
        </Svg>
      )
    case 'e-button':
      return (
        <Svg>
          <Battery x={60} y={100} />
          <Flow d="M60 58 V30 H300 V170 H60 V142" />
          <g transform="translate(160 6) scale(2)" style={anim('r-climb', 2)}>
            <PartArt part={{ id: 'ill-btn', type: 'button', x: 0, y: 0, rot: 0, props: { pressed: true } }} />
          </g>
          <P type="led" x={300} y={86} scale={2.6} rot={90} brightness={1} />
          <Label x={168} y={120} size={13}>
            {w('press')}
          </Label>
        </Svg>
      )
    case 'e-uno':
      return (
        <Svg>
          <g transform="translate(55 6) scale(0.82)">
            <UnoBoard builtin={1} tx={false} on />
          </g>
          <Label x={40} y={60} size={10} anchor="start">
            {w('usb')}
          </Label>
          <Label x={200} y={20} size={10}>
            {w('pins')}
          </Label>
          <Label x={210} y={195} size={10}>
            {w('brain')}
          </Label>
        </Svg>
      )
    case 'e-sketch':
      return (
        <Svg>
          <rect x={30} y={30} width={130} height={56} rx="12" fill={GREEN} stroke={INK} strokeWidth="3" />
          <Label x={95} y={56} size={16}>
            setup()
          </Label>
          <Label x={95} y={74} size={10}>
            {w('once')}
          </Label>
          <path d="M160 58 H200" stroke={INK} strokeWidth="3" />
          <path d="M194 52 L204 58 L194 64" fill="none" stroke={INK} strokeWidth="3" />
          <ellipse cx={270} cy={110} rx={70} ry={52} fill="none" stroke={INK} strokeWidth="3" strokeDasharray="8 6" />
          <g style={anim('ai-spin', 3, { linear: true, origin: '270px 110px' })}>
            <circle cx={340} cy={110} r={7} fill={YELLOW} stroke={INK} strokeWidth="2" />
          </g>
          <rect x={215} y={88} width={110} height={44} rx="12" fill={YELLOW} stroke={INK} strokeWidth="3" />
          <Label x={270} y={110} size={16}>
            loop()
          </Label>
          <Label x={270} y={125} size={10}>
            {w('forever')}
          </Label>
        </Svg>
      )
    case 'e-digital':
      return (
        <Svg>
          <path d="M30 150 H70 V50 H140 V150 H200 V50 H270 V150 H330" fill="none" stroke={INK} strokeWidth="5" strokeLinejoin="round" />
          <path d="M30 150 H70 V50 H140 V150 H200 V50 H270 V150 H330" fill="none" stroke={GREEN} strokeWidth="2.5" strokeLinejoin="round" strokeDasharray="2000" style={anim('r-draw', 3, { linear: true })} />
          <Label x={105} y={40} size={13}>
            {w('high')}
          </Label>
          <Label x={170} y={172} size={13}>
            {w('low')}
          </Label>
          <P type="led" x={92} y={120} scale={1.6} brightness={1} />
          <P type="led" x={160} y={120} scale={1.6} brightness={0} />
        </Svg>
      )
    case 'e-pwm':
      return (
        <Svg>
          {[
            { y: 60, duty: 0.2, label: w('dim'), b: 0.35 },
            { y: 115, duty: 0.5, label: w('half'), b: 0.65 },
            { y: 170, duty: 0.85, label: w('bright'), b: 1 },
          ].map((row) => {
            let d = `M30 ${row.y}`
            for (let k = 0; k < 4; k++) {
              const x = 30 + k * 50
              d += ` V${row.y - 30} H${x + 50 * row.duty} V${row.y} H${x + 50}`
            }
            return (
              <g key={row.y}>
                <path d={d} fill="none" stroke={INK} strokeWidth="3" strokeLinejoin="round" />
                <P type="led" x={264} y={row.y + 2} scale={1.5} brightness={row.b} />
                <Label x={300} y={row.y - 10} size={12} anchor="start">
                  {row.label}
                </Label>
                <Label x={30} y={row.y - 34} size={10} anchor="start" muted>
                  {`${Math.round(row.duty * 100)}%`}
                </Label>
              </g>
            )
          })}
        </Svg>
      )
    case 'e-analog':
      return (
        <Svg>
          <P type="pot" x={60} y={150} scale={3} props={{ pos: 0.6 }} />
          <rect x={170} y={60} width={160} height={24} rx="12" fill="#fff" stroke={INK} strokeWidth="3" />
          <rect x={172} y={62} width={96} height={20} rx="10" fill={GREEN} style={anim('r-fill', 3)} />
          <Label x={170} y={104} size={12} anchor="start">
            0
          </Label>
          <Label x={330} y={104} size={12} anchor="end">
            1023
          </Label>
          <Label x={250} y={140} size={12}>
            {w('knob')}
          </Label>
          <Label x={250} y={48} size={14}>
            analogRead(A0)
          </Label>
        </Svg>
      )
    case 'e-pullup':
      return (
        <Svg>
          <Flow d="M70 30 V80" color={RED} />
          <P type="resistor" x={70} y={80} scale={1.4} rot={90} />
          <Flow d="M70 136 V150 H200" />
          <g transform="translate(200 132) scale(1.4)">
            <PartArt part={{ id: 'ill-pb', type: 'button', x: 0, y: 0, rot: 0, props: {} }} />
          </g>
          <Flow d="M228 150 H300 V180" color={GREY} on={false} />
          <Label x={70} y={22} size={12}>
            5V
          </Label>
          <Label x={300} y={196} size={12}>
            GND
          </Label>
          <Label x={130} y={140} size={12}>
            D2
          </Label>
          <Label x={230} y={70} size={11}>
            {w('pullup')}
          </Label>
        </Svg>
      )
    case 'e-serial':
      return (
        <Svg>
          <rect x={24} y={40} width={120} height={84} rx="8" fill="#1b1f2a" stroke={INK} strokeWidth="3" />
          <rect x={64} y={124} width={40} height={10} fill={INK} />
          <text x={36} y={66} fontSize="11" fill="#b8e986" fontFamily="var(--font-mono), monospace">
            Hello!
          </text>
          <text x={36} y={84} fontSize="11" fill="#b8e986" fontFamily="var(--font-mono), monospace">
            512
          </text>
          <text x={36} y={102} fontSize="11" fill="#b8e986" fontFamily="var(--font-mono), monospace" style={anim('r-step-3', 2)}>
            513
          </text>
          <path d="M144 82 C190 82 200 120 236 120" fill="none" stroke={INK} strokeWidth="5" />
          <path d="M144 82 C190 82 200 120 236 120" fill="none" stroke="#fff" strokeWidth="2" strokeDasharray="5 9" style={anim('r-dash', 0.8, { linear: true })} />
          <g transform="translate(232 72) scale(0.42)">
            <UnoBoard builtin={0} tx on />
          </g>
          <Label x={84} y={156} size={12}>
            {w('computer')}
          </Label>
          <Label x={300} y={180} size={12}>
            {w('board')}
          </Label>
          <Label x={190} y={30} size={13}>
            Serial.println()
          </Label>
        </Svg>
      )
    case 'e-servo':
      return (
        <Svg>
          <g transform="translate(150 70) scale(2)">
            <PartArt part={{ id: 'ill-servo', type: 'servo', x: 0, y: 0, rot: 0, props: {} }} angle={150} />
          </g>
          <path d="M210 150 A60 60 0 0 1 330 150" fill="none" stroke={INK} strokeWidth="2" strokeDasharray="5 5" />
          <Label x={210} y={170} size={11}>
            0°
          </Label>
          <Label x={330} y={170} size={11}>
            180°
          </Label>
          <Label x={100} y={30} size={12}>
            {w('angle')}
          </Label>
        </Svg>
      )
    case 'e-sonar':
      return (
        <Svg>
          <g transform="translate(90 160) scale(0.9)">
            <PartArt part={{ id: 'ill-us', type: 'ultrasonic', x: 0, y: 0, rot: 0, props: { distance: 30 } }} />
          </g>
          <rect x={300} y={40} width={22} height={120} rx="4" fill={GREY} stroke={INK} strokeWidth="3" />
          {[0, 1, 2].map((i) => (
            <path key={i} d="M190 100 Q200 80 190 60" transform={`translate(${i * 30} 0)`} fill="none" stroke={BLUE} strokeWidth="3" style={anim('r-ping', 1.5, { delay: i * 0.3 })} />
          ))}
          <Label x={200} y={186} size={11}>
            {w('echo')}
          </Label>
        </Svg>
      )
    case 'e-esp32':
      return (
        <Svg>
          <defs>
            <linearGradient id="shield" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#ffffff" stopOpacity={0.9} />
              <stop offset="0.5" stopColor="#ffffff" stopOpacity={0} />
              <stop offset="1" stopColor="#5f6368" stopOpacity={0.5} />
            </linearGradient>
          </defs>
          <g transform="translate(18 -20) scale(1.05)">
            <Esp32Board builtin={1} tx={false} on />
          </g>
          {[0, 1, 2].map((i) => (
            <path key={i} d={`M${300 + i * 14} ${70 - i * 6} q14 30 0 60`} fill="none" stroke={BLUE} strokeWidth="4" strokeLinecap="round" style={anim('ai-pulse', 1.6, { delay: i * 0.25 })} />
          ))}
          <Label x={180} y={190} size={13}>
            {w('wifi')}
          </Label>
        </Svg>
      )
    case 'e-3v3':
      return (
        <Svg>
          <rect x={50} y={150 - 110} width={60} height={110} rx="6" fill={YELLOW} stroke={INK} strokeWidth="3" />
          <rect x={150} y={150 - 73} width={60} height={73} rx="6" fill={GREEN} stroke={INK} strokeWidth="3" />
          <line x1={30} y1={150} x2={330} y2={150} stroke={INK} strokeWidth="3" />
          <Label x={80} y={170} size={11}>
            {w('uno5')}
          </Label>
          <Label x={180} y={170} size={11}>
            {w('esp33')}
          </Label>
          <g style={anim('ai-pulse', 1.4)}>
            <path d="M282 50 L312 104 H252 Z" fill={RED} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
            <Label x={282} y={96} size={22}>
              !
            </Label>
          </g>
          <Label x={282} y={128} size={10}>
            {w('danger')}
          </Label>
        </Svg>
      )
    default:
      return null
  }
}
