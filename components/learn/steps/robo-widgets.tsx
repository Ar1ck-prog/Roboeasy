'use client'

/**
 * Interactive robotics tasks with their own automatic check: gears, wheel and
 * distance, regulators, repeatability, match strategy, lever and bracing.
 * The maths lives in lib/learn/widgets.ts (tested); here are the drawings
 * and controls. Motion is CSS/SVG and respects reduced motion (.ill-anim).
 */

import { type CSSProperties, type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { Check, Play, RotateCcw, X } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import type { ClientStep } from '@/lib/learn/content'
import {
  type Brace,
  GAIN_RANGES,
  GEAR_TEETH,
  LEVER,
  ONOFF_REACH_S,
  REGULATOR,
  REGULATOR_GOALS,
  type RegulatorRun,
  SCATTER_TARGET_CM,
  WHEELS,
  braceSolved,
  gearRatio,
  gearsSolved,
  leverSolved,
  leverState,
  regulatorSolved,
  runRegulator,
  scatterRuns,
  scatterSolved,
  strategySolved,
  strategyTotals,
  wheelDistanceCm,
  wheelSolved,
} from '@/lib/learn/widgets'
import { cn } from '@/lib/utils'

import type { StepDone } from './simple-steps'

type Lang = 'ru' | 'kk' | 'en'
type Robo = Extract<ClientStep, { type: 'widget'; widget: 'gears' | 'wheel' | 'pid' | 'scatter' | 'strategy' | 'lever' | 'brace' }>
type Props<W extends Robo['widget']> = { step: Extract<Robo, { widget: W }>; lang: Lang; done: boolean; onDone: (d: StepDone) => void }

const INK = '#1b1f2a'
const PAPER = '#fff9ee'
const YELLOW = '#ffc531'
const BLUE = '#4a86f7'
const GREEN = '#2bb673'
const RED = '#e5484d'

const T = {
  ru: {
    driver: 'Ведущая шестерня (на моторе)',
    driven: 'Ведомая шестерня (на колесе)',
    teeth: '{n} зуб.',
    slower: 'Выход крутится в {r} раза медленнее',
    faster: 'Выход крутится в {r} раза быстрее',
    same: 'Выход крутится с той же скоростью',
    goalSlower: 'Цель: в {r} раза медленнее (и сильнее)',
    goalFaster: 'Цель: в {r} раза быстрее',
    wheel: 'Колесо',
    rotations: 'Обороты мотора',
    go: 'Поехали',
    again: 'Ещё раз',
    drove: 'Робот проехал {cm} см',
    target: 'Нужно {cm} см (±{tol})',
    strength: 'Сила поворота, %',
    run: 'Запустить робота',
    overshoot: 'Перелёт за линию: {mm} мм',
    settle: 'Успокоился за: {s} с',
    settleNever: 'Так и не успокоился на линии',
    never: 'До линии не доехал',
    wobble: 'Размах виляния: {mm} мм',
    reach: 'Доехал до линии за {s} с',
    goal: 'Цель',
    goalSettle: 'успокоиться за {s} с',
    goalOvershoot: 'перелёт не больше {mm} мм',
    goalWobble: 'доехать за {s} с и вилять не больше {mm} мм',
    line: 'линия',
    speed: 'Скорость, %',
    gyro: 'Держать курс по гироскопу',
    fiveRuns: '5 заездов',
    inside: 'В цели: {n} из 5',
    seconds: 'Время: {s} из {limit} с',
    points: 'Очки: {p} (нужно {target})',
    tooLong: 'Не успеть: план длиннее матча.',
    fulcrum: 'Где опора (отверстие {n})',
    lift: 'Поднять груз',
    stall: 'Мотор не справляется — груз слишком тяжёлый для этого плеча.',
    low: 'Поднял, но слишком низко: груз должен подняться хотя бы на {h}.',
    lifted: 'Груз поднят!',
    load: 'груз',
    motor: 'мотор',
    braces: 'Добавь балки в раму',
    diag1: 'Диагональ ↗',
    diag2: 'Диагональ ↘',
    middle: 'Перекладина посередине',
    push: 'Толкнуть раму',
    wobbles: 'Рама шатается: прямоугольник легко перекосить.',
    holds: 'Рама держится: диагональ сделала треугольники.',
    solved: 'Получилось!',
    cm: 'см',
    mm: 'мм',
    sec: 'с',
    pts: 'очк.',
  },
  kk: {
    driver: 'Жетекші тісті доңғалақ (моторда)',
    driven: 'Жетектегі тісті доңғалақ (дөңгелекте)',
    teeth: '{n} тіс',
    slower: 'Шығыс {r} есе баяу айналады',
    faster: 'Шығыс {r} есе жылдам айналады',
    same: 'Шығыс сол жылдамдықпен айналады',
    goalSlower: 'Мақсат: {r} есе баяу (әрі күшті)',
    goalFaster: 'Мақсат: {r} есе жылдам',
    wheel: 'Дөңгелек',
    rotations: 'Мотор айналымдары',
    go: 'Жүрдік',
    again: 'Тағы бір рет',
    drove: 'Робот {cm} см жүрді',
    target: '{cm} см керек (±{tol})',
    strength: 'Бұрылу күші, %',
    run: 'Роботты іске қосу',
    overshoot: 'Сызықтан асып кетті: {mm} мм',
    settle: 'Тынышталды: {s} с',
    settleNever: 'Сызықта тынышталмады',
    never: 'Сызыққа жетпеді',
    wobble: 'Бұлғаңдау ауқымы: {mm} мм',
    reach: 'Сызыққа {s} с-та жетті',
    goal: 'Мақсат',
    goalSettle: '{s} с ішінде тынышталу',
    goalOvershoot: '{mm} мм-ден аспай асу',
    goalWobble: '{s} с-та жетіп, {mm} мм-ден аспай бұлғаңдау',
    line: 'сызық',
    speed: 'Жылдамдық, %',
    gyro: 'Бағытты гироскоппен ұстау',
    fiveRuns: '5 жүріс',
    inside: 'Мақсатта: 5-тен {n}',
    seconds: 'Уақыт: {limit} с-тан {s}',
    points: 'Ұпай: {p} ({target} керек)',
    tooLong: 'Үлгермейсің: жоспар матчтан ұзын.',
    fulcrum: 'Тірек қайда ({n}-тесік)',
    lift: 'Жүкті көтеру',
    stall: 'Мотор шамасы жетпейді — бұл иін үшін жүк тым ауыр.',
    low: 'Көтерді, бірақ тым төмен: жүк кемінде {h} көтерілуі керек.',
    lifted: 'Жүк көтерілді!',
    load: 'жүк',
    motor: 'мотор',
    braces: 'Жақтауға арқалықтар қос',
    diag1: 'Диагональ ↗',
    diag2: 'Диагональ ↘',
    middle: 'Ортадағы көлденең арқалық',
    push: 'Жақтауды итеру',
    wobbles: 'Жақтау шайқалады: тіктөртбұрышты қисайту оңай.',
    holds: 'Жақтау берік: диагональ үшбұрыштар жасады.',
    solved: 'Шықты!',
    cm: 'см',
    mm: 'мм',
    sec: 'с',
    pts: 'ұп.',
  },
  en: {
    driver: 'Driving gear (on the motor)',
    driven: 'Driven gear (on the wheel)',
    teeth: '{n} teeth',
    slower: 'The output turns {r} times slower',
    faster: 'The output turns {r} times faster',
    same: 'The output turns at the same speed',
    goalSlower: 'Goal: {r} times slower (and stronger)',
    goalFaster: 'Goal: {r} times faster',
    wheel: 'Wheel',
    rotations: 'Motor rotations',
    go: 'Go',
    again: 'Again',
    drove: 'The robot drove {cm} cm',
    target: 'Needed: {cm} cm (±{tol})',
    strength: 'Steering strength, %',
    run: 'Run the robot',
    overshoot: 'Overshoot past the line: {mm} mm',
    settle: 'Settled after: {s} s',
    settleNever: 'Never settled on the line',
    never: 'Never reached the line',
    wobble: 'Wobble: {mm} mm',
    reach: 'Reached the line after {s} s',
    goal: 'Goal',
    goalSettle: 'settle within {s} s',
    goalOvershoot: 'overshoot at most {mm} mm',
    goalWobble: 'reach the line within {s} s and wobble at most {mm} mm',
    line: 'line',
    speed: 'Speed, %',
    gyro: 'Hold the heading with the gyro',
    fiveRuns: '5 runs',
    inside: 'On target: {n} of 5',
    seconds: 'Time: {s} of {limit} s',
    points: 'Points: {p} (need {target})',
    tooLong: 'No time: the plan is longer than the match.',
    fulcrum: 'Fulcrum position (hole {n})',
    lift: 'Lift the load',
    stall: 'The motor stalls — the load is too heavy for this arm.',
    low: 'It lifts, but too little: the load must rise at least {h}.',
    lifted: 'Load lifted!',
    load: 'load',
    motor: 'motor',
    braces: 'Add beams to the frame',
    diag1: 'Diagonal ↗',
    diag2: 'Diagonal ↘',
    middle: 'Crossbar in the middle',
    push: 'Push the frame',
    wobbles: 'The frame wobbles: a rectangle is easy to skew.',
    holds: 'The frame holds: the diagonal made triangles.',
    solved: 'You did it!',
    cm: 'cm',
    mm: 'mm',
    sec: 's',
    pts: 'pts',
  },
} satisfies Record<Lang, Record<string, string>>

const round = (v: number, d = 1) => Math.round(v * 10 ** d) / 10 ** d

/** Calls onDone once, the first time `solved` becomes true; `tries` counts checks before that. */
function useSolved(solved: boolean, done: boolean, tries: number, onDone: (d: StepDone) => void) {
  const fired = useRef(done)
  useEffect(() => {
    if (solved && !fired.current) {
      fired.current = true
      onDone({ firstTry: tries <= 1, hints: 0 })
    }
  }, [solved, tries, onDone])
}

function Chips<V extends string | number>({ label, values, value, onChange, render }: { label: string; values: readonly V[]; value: V; onChange: (v: V) => void; render: (v: V) => ReactNode }) {
  return (
    <fieldset className="m-0 grid gap-2 border-0 p-0">
      <legend className="mb-1 text-sm font-extrabold">{label}</legend>
      <div className="flex flex-wrap gap-2">
        {values.map((v) => (
          <button key={v} type="button" aria-pressed={v === value} className={buttonVariants({ size: 'sm', variant: v === value ? 'primary' : 'secondary' })} onClick={() => onChange(v)}>
            {render(v)}
          </button>
        ))}
      </div>
    </fieldset>
  )
}

function Slider({ label, value, min, max, step, onChange, suffix = '' }: { label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void; suffix?: string }) {
  return (
    <label className="grid gap-1 text-sm font-extrabold">
      <span className="flex justify-between gap-2">
        {label}
        <span className="font-mono">
          {round(value, 2)}
          {suffix}
        </span>
      </span>
      <input type="range" className="w-full accent-(--primary)" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </label>
  )
}

function Status({ ok, children }: { ok: boolean; children: ReactNode }) {
  return (
    <p className={cn('alert m-0 flex items-center gap-2', ok && 'alert-ok')} role="status">
      {ok ? <Check className="size-5 shrink-0" aria-hidden="true" /> : <X className="size-5 shrink-0" aria-hidden="true" />}
      <span>{children}</span>
    </p>
  )
}

function Stage({ children, height = 200 }: { children: ReactNode; height?: number }) {
  return (
    <svg viewBox={`0 0 360 ${height}`} className="ill-anim mx-auto w-full max-w-2xl rounded-(--radius-md) border-(length:--stroke-thin) border-outline" aria-hidden="true">
      <rect width="360" height={height} fill={PAPER} />
      {children}
    </svg>
  )
}

function gearPath(r: number, teeth: number): string {
  const pts: string[] = []
  const depth = Math.max(3, Math.min(6, r * 0.18))
  const step = (Math.PI * 2) / teeth
  for (let i = 0; i < teeth; i++) {
    const a = i * step
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

// ── Gears ───────────────────────────────────────────────────────────────

export function GearsWidget({ step, lang, done, onDone }: Props<'gears'>) {
  const t = T[lang]
  const [driver, setDriver] = useState<number>(GEAR_TEETH[2])
  const [driven, setDriven] = useState<number>(GEAR_TEETH[2])
  const [tries, setTries] = useState(0)
  const solved = gearsSolved(step.goal, step.ratio, driver, driven)
  useSolved(solved, done, tries, onDone)
  const r = gearRatio(driver, driven)
  const size = (n: number) => 10 + n * 1.45
  const r1 = size(driver)
  const r2 = size(driven)
  const x1 = 30 + r1
  const x2 = x1 + r1 + r2 + 1
  const base = 2.4
  const spin = (seconds: number, reverse: boolean) => ({ animation: `${reverse ? 'r-spin-rev' : 'ai-spin'} ${seconds}s linear infinite`, transformBox: 'fill-box' as const, transformOrigin: 'center' })
  const readout = Math.abs(r - 1) < 0.01 ? t.same : fill(r > 1 ? t.slower : t.faster, { r: round(r > 1 ? r : 1 / r, 2) })
  const pick = (set: (n: number) => void) => (n: number) => (set(n), setTries((k) => k + 1))
  return (
    <div className="grid gap-4">
      <p className="m-0 font-extrabold">{fill(step.goal === 'slower' ? t.goalSlower : t.goalFaster, { r: step.ratio })}</p>
      <Stage height={170}>
        <g transform={`translate(${Math.min(x1, 330)} 85)`}>
          <g style={spin(base, false)}>
            <path d={gearPath(r1, driver)} fill={YELLOW} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            <circle r={6} fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cy={-r1 + 10} r={3} fill={RED} />
          </g>
        </g>
        <g transform={`translate(${Math.min(x2, 360 - 10)} 85)`}>
          <g style={spin(base * r, true)}>
            <path d={gearPath(r2, driven)} fill={BLUE} stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
            <circle r={6} fill={PAPER} stroke={INK} strokeWidth="2" />
            <circle cy={-r2 + 10} r={3} fill={RED} />
          </g>
        </g>
      </Stage>
      <p className="m-0 text-lg font-extrabold">{readout}</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Chips label={t.driver} values={GEAR_TEETH} value={driver} onChange={pick(setDriver)} render={(n) => fill(t.teeth, { n })} />
        <Chips label={t.driven} values={GEAR_TEETH} value={driven} onChange={pick(setDriven)} render={(n) => fill(t.teeth, { n })} />
      </div>
      {solved && <Status ok>{t.solved}</Status>}
    </div>
  )
}

// ── Wheel and distance ──────────────────────────────────────────────────

export function WheelWidget({ step, lang, done, onDone }: Props<'wheel'>) {
  const t = T[lang]
  const [wheel, setWheel] = useState<number>(WHEELS[0])
  const [rotations, setRotations] = useState(1)
  const [shot, setShot] = useState<{ cm: number; key: number } | null>(null)
  const [tries, setTries] = useState(0)
  const solved = shot !== null && wheelSolved(step.targetCm, step.toleranceCm, wheel, rotations)
  useSolved(solved, done, tries, onDone)
  const scale = 300 / Math.max(step.targetCm * 1.6, 40)
  const go = () => {
    setShot({ cm: wheelDistanceCm(wheel, rotations), key: Date.now() })
    setTries((k) => k + 1)
  }
  const dist = shot ? Math.min(330, shot.cm * scale) : 0
  const rWheel = wheel / 4
  return (
    <div className="grid gap-4">
      <p className="m-0 font-extrabold">{fill(t.target, { cm: step.targetCm, tol: step.toleranceCm })}</p>
      <Stage height={150}>
        <path d="M14 112 H350" stroke={INK} strokeWidth="2.5" />
        {Array.from({ length: Math.floor(330 / (10 * scale)) + 1 }, (_, i) => (
          <path key={i} d={`M${20 + i * 10 * scale} 112 v${i % 5 === 0 ? 10 : 5}`} stroke={INK} strokeWidth="1.5" />
        ))}
        <path d={`M${20 + step.targetCm * scale} 40 V122`} stroke={GREEN} strokeWidth="3" strokeDasharray="6 4" />
        <text x={20 + step.targetCm * scale} y={34} textAnchor="middle" fontSize="12" fontWeight="800" fill={INK}>
          {step.targetCm} {t.cm}
        </text>
        <g key={shot?.key ?? 0} style={shot ? ({ animation: 'r-go 1.6s ease-in-out', '--r-d': `${dist}px`, transform: `translateX(${dist}px)` } as CSSProperties) : undefined}>
          <g transform={`translate(20 ${112 - rWheel})`}>
            <g
              style={
                shot
                  ? ({ animation: 'r-turn 1.6s ease-in-out', '--r-a': `${rotations * 360}deg`, transform: `rotate(${rotations * 360}deg)`, transformBox: 'fill-box', transformOrigin: 'center' } as CSSProperties)
                  : undefined
              }
            >
              <circle r={rWheel} fill={INK} />
              <circle r={rWheel * 0.6} fill="#fff" stroke={INK} strokeWidth="2" />
              <circle cy={-rWheel * 0.78} r={3} fill={RED} />
            </g>
          </g>
        </g>
      </Stage>
      <div className="grid gap-3 sm:grid-cols-2">
        <Chips label={t.wheel} values={WHEELS} value={wheel} onChange={(v) => (setWheel(v), setShot(null))} render={(d) => `${d} ${t.mm}`} />
        <Slider label={t.rotations} value={rotations} min={0} max={10} step={0.05} onChange={(v) => (setRotations(v), setShot(null))} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={go}>
          <Play aria-hidden="true" />
          {shot ? t.again : t.go}
        </button>
        {shot && <span className="font-extrabold">{fill(t.drove, { cm: round(shot.cm) })}</span>}
      </div>
      {solved && <Status ok>{t.solved}</Status>}
    </div>
  )
}

// ── Regulators ──────────────────────────────────────────────────────────

export function PidWidget({ step, lang, done, onDone }: Props<'pid'>) {
  const t = T[lang]
  const mode = step.mode
  const [kp, setKp] = useState(mode === 'onoff' ? 90 : 0.2)
  const [kd, setKd] = useState(0)
  const [ki, setKi] = useState(0)
  const [run, setRun] = useState<{ result: RegulatorRun; key: number } | null>(null)
  const [tries, setTries] = useState(0)
  const solved = run !== null && regulatorSolved(mode, run.result)
  useSolved(solved, done, tries, onDone)
  const goal = REGULATOR_GOALS[mode]
  const start = () => {
    setRun({ result: runRegulator(mode, { kp, kd, ki }), key: Date.now() })
    setTries((k) => k + 1)
  }
  const reset = () => setRun(null)
  const W = 340
  const H = 160
  const mid = H / 2
  const k = (mid - 12) / REGULATOR.startOffsetMm
  const pathD = run ? run.result.path.map((v, i) => `${i ? 'L' : 'M'}${(10 + (i / (run.result.path.length - 1)) * (W - 10)).toFixed(1)} ${(mid - Math.max(-mid + 4, Math.min(mid - 4, v * k))).toFixed(1)}`).join('') : ''
  const goalText =
    mode === 'onoff'
      ? fill(t.goalWobble, { s: ONOFF_REACH_S, mm: goal.wobble ?? 0 })
      : `${fill(t.goalSettle, { s: goal.settle })}, ${fill(t.goalOvershoot, { mm: goal.overshoot })}`
  const reached = run ? run.result.path.findIndex((v) => Math.abs(v) < 10) : -1
  return (
    <div className="grid gap-4">
      <p className="m-0 font-extrabold">
        {t.goal}: {goalText}
      </p>
      <Stage height={H}>
        <path d={`M10 ${mid} H${W + 10}`} stroke={INK} strokeWidth="10" opacity="0.85" />
        <text x={W} y={H - 10} textAnchor="end" fontSize="11" fontWeight="800" fill={INK}>
          ▬ {t.line}
        </text>
        {run && (
          <path
            key={run.key}
            d={pathD}
            fill="none"
            stroke={solved ? GREEN : RED}
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="2000"
            style={{ animation: 'r-draw 2.4s ease-out' }}
          />
        )}
        {!run && <circle cx={10} cy={mid - REGULATOR.startOffsetMm * k} r="7" fill={YELLOW} stroke={INK} strokeWidth="2.5" />}
      </Stage>
      <div className="grid gap-3 sm:grid-cols-3">
        {mode === 'onoff' ? (
          <Slider label={t.strength} value={kp} min={GAIN_RANGES.strength[0]} max={GAIN_RANGES.strength[1]} step={GAIN_RANGES.strength[2]} onChange={(v) => (setKp(v), reset())} />
        ) : (
          <Slider label="Kp" value={kp} min={GAIN_RANGES.kp[0]} max={GAIN_RANGES.kp[1]} step={GAIN_RANGES.kp[2]} onChange={(v) => (setKp(v), reset())} />
        )}
        {mode === 'pid' && <Slider label="Ki" value={ki} min={GAIN_RANGES.ki[0]} max={GAIN_RANGES.ki[1]} step={GAIN_RANGES.ki[2]} onChange={(v) => (setKi(v), reset())} />}
        {(mode === 'pd' || mode === 'pid') && <Slider label="Kd" value={kd} min={GAIN_RANGES.kd[0]} max={GAIN_RANGES.kd[1]} step={GAIN_RANGES.kd[2]} onChange={(v) => (setKd(v), reset())} />}
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={start}>
          <Play aria-hidden="true" />
          {t.run}
        </button>
      </div>
      {run && (
        <ul className="m-0 grid list-none gap-1 p-0 text-sm font-bold">
          {mode === 'onoff' ? (
            <>
              <li>{reached >= 0 ? fill(t.reach, { s: round(reached * run.result.dt) }) : t.never}</li>
              <li>{fill(t.wobble, { mm: round(run.result.wobble) })}</li>
            </>
          ) : (
            <>
              <li>{fill(t.overshoot, { mm: round(run.result.overshoot) })}</li>
              <li>{run.result.settle === null ? t.settleNever : fill(t.settle, { s: round(run.result.settle) })}</li>
            </>
          )}
        </ul>
      )}
      {run && <Status ok={solved}>{solved ? t.solved : goalText}</Status>}
    </div>
  )
}

// ── Repeatability ───────────────────────────────────────────────────────

export function ScatterWidget({ step, lang, done, onDone }: Props<'scatter'>) {
  const t = T[lang]
  const [speed, setSpeed] = useState(80)
  const [gyro, setGyro] = useState(false)
  const [shot, setShot] = useState<number | null>(null)
  const [tries, setTries] = useState(0)
  const runs = useMemo(() => scatterRuns(step.distanceCm, speed, gyro), [step.distanceCm, speed, gyro])
  const solved = shot !== null && scatterSolved(step.distanceCm, speed, gyro)
  useSolved(solved, done, tries, onDone)
  const inside = runs.filter((p) => Math.hypot(p.x - step.distanceCm, p.y) <= SCATTER_TARGET_CM).length
  const zoom = 18
  const cx = 230
  const cy = 90
  return (
    <div className="grid gap-4">
      <Stage height={180}>
        <path d={`M20 ${cy} H${cx}`} stroke={INK} strokeWidth="2" strokeDasharray="6 5" />
        <g transform={`translate(20 ${cy})`}>
          <rect x={-12} y={-10} width={24} height={20} rx="5" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
        </g>
        <circle cx={cx} cy={cy} r={SCATTER_TARGET_CM * zoom} fill="#e9f8ef" stroke={GREEN} strokeWidth="3" strokeDasharray="6 4" />
        {shot !== null &&
          runs.map((p, i) => {
            const ok = Math.hypot(p.x - step.distanceCm, p.y) <= SCATTER_TARGET_CM
            return (
              <circle
                key={`${shot}-${i}`}
                cx={cx + (p.x - step.distanceCm) * zoom}
                cy={cy - p.y * zoom}
                r="6"
                fill={ok ? BLUE : RED}
                stroke={INK}
                strokeWidth="2"
                style={{ animation: `ai-pop-1 0.6s ease-out ${i * 0.25}s backwards` }}
              />
            )
          })}
      </Stage>
      <div className="grid gap-3 sm:grid-cols-2 sm:items-end">
        <Slider label={t.speed} value={speed} min={20} max={100} step={10} onChange={(v) => (setSpeed(v), setShot(null))} />
        <label className="flex cursor-pointer items-center gap-3 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 px-3 py-2 font-bold">
          <input type="checkbox" className="size-5 accent-(--success)" checked={gyro} onChange={(e) => (setGyro(e.target.checked), setShot(null))} />
          {t.gyro}
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={() => (setShot(Date.now()), setTries((k) => k + 1))}>
          <Play aria-hidden="true" />
          {t.fiveRuns}
        </button>
        {shot !== null && <span className="font-extrabold">{fill(t.inside, { n: inside })}</span>}
      </div>
      {solved && <Status ok>{t.solved}</Status>}
    </div>
  )
}

// ── Strategy ────────────────────────────────────────────────────────────

export function StrategyWidget({ step, lang, done, onDone }: Props<'strategy'>) {
  const t = T[lang]
  const [picked, setPicked] = useState<number[]>([])
  const [tries, setTries] = useState(0)
  const totals = strategyTotals(step.missions, picked)
  const solved = strategySolved(step.missions, picked, step.seconds, step.target)
  useSolved(solved, done, tries, onDone)
  const over = totals.seconds > step.seconds
  const colors = [YELLOW, BLUE, GREEN, RED, '#b26ef0', '#f06fb4', '#ff9f1c', '#8b90a0']
  let x = 0
  return (
    <div className="grid gap-4">
      <ul className="m-0 grid list-none gap-2 p-0">
        {step.missions.map((m, i) => (
          <li key={i}>
            <label className="flex cursor-pointer items-center gap-3 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card px-3 py-2 font-bold">
              <input
                type="checkbox"
                className="size-5 accent-(--success)"
                checked={picked.includes(i)}
                onChange={(e) => (setPicked((p) => (e.target.checked ? [...p, i] : p.filter((v) => v !== i))), setTries((k) => k + 1))}
              />
              <span className="size-3 shrink-0 rounded-full border-2 border-outline" style={{ background: colors[i % colors.length] }} />
              <span className="flex-1">{m.name[lang]}</span>
              <span className="font-mono text-sm">
                {m.points} {t.pts} · {m.seconds} {t.sec}
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="grid gap-1">
        <div className="relative h-8 overflow-hidden rounded-full border-(length:--stroke-thin) border-outline bg-surface-2" aria-hidden="true">
          {picked.map((i) => {
            const w = (step.missions[i].seconds / Math.max(step.seconds, totals.seconds)) * 100
            const left = x
            x += w
            return <span key={i} className="absolute inset-y-0 border-r-2 border-outline transition-all" style={{ left: `${left}%`, width: `${w}%`, background: colors[i % colors.length] }} />
          })}
          {over && <span className="absolute inset-y-0 border-l-4 border-destructive" style={{ left: `${(step.seconds / totals.seconds) * 100}%` }} />}
        </div>
        <p className="m-0 flex flex-wrap justify-between gap-2 text-sm font-extrabold">
          <span className={cn(over && 'text-destructive')}>{fill(t.seconds, { s: totals.seconds, limit: step.seconds })}</span>
          <span>{fill(t.points, { p: totals.points, target: step.target })}</span>
        </p>
      </div>
      {over && <Status ok={false}>{t.tooLong}</Status>}
      {solved && <Status ok>{t.solved}</Status>}
    </div>
  )
}

// ── Lever ───────────────────────────────────────────────────────────────

export function LeverWidget({ lang, done, onDone }: Props<'lever'>) {
  const t = T[lang]
  const [fulcrum, setFulcrum] = useState(5)
  const [tried, setTried] = useState<number | null>(null)
  const [tries, setTries] = useState(0)
  const state = leverState(fulcrum)
  const solved = tried === fulcrum && leverSolved(fulcrum)
  useSolved(solved, done, tries, onDone)
  const unit = 30
  const x0 = 30
  const fx = x0 + fulcrum * unit
  const angle = tried === fulcrum && state.lifts ? 14 : 0
  return (
    <div className="grid gap-4">
      <Stage height={170}>
        <path d={`M${fx - 16} 150 L${fx} 116 L${fx + 16} 150 Z`} fill="#8b90a0" stroke={INK} strokeWidth="2.5" />
        <g style={{ transform: `rotate(${angle}deg)`, transformOrigin: `${fx}px 112px`, transition: 'transform 0.9s ease-in-out' }}>
          <rect x={x0 - 10} y={106} width={LEVER.length * unit + 20} height={12} rx="6" fill={YELLOW} stroke={INK} strokeWidth="2.5" />
          {Array.from({ length: LEVER.length + 1 }, (_, i) => (
            <circle key={i} cx={x0 + i * unit} cy={112} r="3.5" fill={PAPER} stroke={INK} strokeWidth="1.5" />
          ))}
          <rect x={x0 - 18} y={70} width={36} height={36} rx="5" fill={RED} stroke={INK} strokeWidth="2.5" />
          <text x={x0} y={64} textAnchor="middle" fontSize="11" fontWeight="800" fill={INK}>
            {t.load}
          </text>
          <path d={`M${x0 + LEVER.length * unit} 150 V120`} stroke={BLUE} strokeWidth="5" />
          <text x={x0 + LEVER.length * unit} y={164} textAnchor="middle" fontSize="11" fontWeight="800" fill={INK}>
            {t.motor}
          </text>
        </g>
      </Stage>
      <Slider label={fill(t.fulcrum, { n: fulcrum })} value={fulcrum} min={1} max={LEVER.length - 1} step={1} onChange={(v) => (setFulcrum(v), setTried(null))} />
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={() => (setTried(fulcrum), setTries((k) => k + 1))}>
          <Play aria-hidden="true" />
          {t.lift}
        </button>
      </div>
      {tried === fulcrum && (
        <Status ok={solved}>{!state.lifts ? t.stall : state.height < LEVER.minLift ? fill(t.low, { h: LEVER.minLift }) : t.lifted}</Status>
      )}
    </div>
  )
}

// ── Bracing ─────────────────────────────────────────────────────────────

export function BraceWidget({ lang, done, onDone }: Props<'brace'>) {
  const t = T[lang]
  const [braces, setBraces] = useState<Brace[]>([])
  const [pushed, setPushed] = useState<number | null>(null)
  const [tries, setTries] = useState(0)
  const strong = braceSolved(braces)
  const solved = pushed !== null && strong
  useSolved(solved, done, tries, onDone)
  const toggle = (b: Brace) => (setBraces((list) => (list.includes(b) ? list.filter((v) => v !== b) : [...list, b])), setPushed(null))
  return (
    <div className="grid gap-4">
      <Stage height={190}>
        <g key={pushed ?? 0} style={pushed !== null && !strong ? { animation: 'r-wobble 0.5s ease-in-out 3', transformBox: 'fill-box', transformOrigin: 'bottom' } : undefined}>
          <rect x={110} y={30} width={140} height={140} fill="none" stroke={BLUE} strokeWidth="10" strokeLinejoin="round" />
          {braces.includes('diag1') && <path d="M110 170 L250 30" stroke={GREEN} strokeWidth="9" strokeLinecap="round" />}
          {braces.includes('diag2') && <path d="M110 30 L250 170" stroke={GREEN} strokeWidth="9" strokeLinecap="round" />}
          {braces.includes('middle') && <path d="M110 100 H250" stroke="#ff9f1c" strokeWidth="9" strokeLinecap="round" />}
          {[
            [110, 30],
            [250, 30],
            [110, 170],
            [250, 170],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="7" fill={PAPER} stroke={INK} strokeWidth="2.5" />
          ))}
        </g>
        {pushed !== null && <path d="M40 60 H96 M84 50 L96 60 L84 70" fill="none" stroke={RED} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />}
      </Stage>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className="mb-1 text-sm font-extrabold">{t.braces}</legend>
        <div className="flex flex-wrap gap-2">
          {(['diag1', 'diag2', 'middle'] as const).map((b) => (
            <button key={b} type="button" aria-pressed={braces.includes(b)} className={buttonVariants({ size: 'sm', variant: braces.includes(b) ? 'primary' : 'secondary' })} onClick={() => toggle(b)}>
              {t[b]}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="flex flex-wrap gap-3">
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={() => (setPushed(Date.now()), setTries((k) => k + 1))}>
          <Play aria-hidden="true" />
          {t.push}
        </button>
        {pushed !== null && (
          <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => (setBraces([]), setPushed(null))}>
            <RotateCcw aria-hidden="true" />
          </button>
        )}
      </div>
      {pushed !== null && <Status ok={strong}>{strong ? t.holds : t.wobbles}</Status>}
    </div>
  )
}

const ROBO_KINDS: readonly string[] = ['gears', 'wheel', 'pid', 'scatter', 'strategy', 'lever', 'brace'] satisfies Robo['widget'][]

export function isRoboWidget(step: Extract<ClientStep, { type: 'widget' }>): step is Robo {
  return ROBO_KINDS.includes(step.widget)
}

export function RoboWidget({ step, lang, done, onDone }: { step: Robo; lang: Lang; done: boolean; onDone: (d: StepDone) => void }) {
  switch (step.widget) {
    case 'gears':
      return <GearsWidget step={step} lang={lang} done={done} onDone={onDone} />
    case 'wheel':
      return <WheelWidget step={step} lang={lang} done={done} onDone={onDone} />
    case 'pid':
      return <PidWidget step={step} lang={lang} done={done} onDone={onDone} />
    case 'scatter':
      return <ScatterWidget step={step} lang={lang} done={done} onDone={onDone} />
    case 'strategy':
      return <StrategyWidget step={step} lang={lang} done={done} onDone={onDone} />
    case 'lever':
      return <LeverWidget step={step} lang={lang} done={done} onDone={onDone} />
    case 'brace':
      return <BraceWidget step={step} lang={lang} done={done} onDone={onDone} />
  }
}
