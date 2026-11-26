'use client'

/**
 * The WeDo scene: our own simple drawings of the rover, spinner, crane and
 * barrier, the Smarthub with its light in the corner, the tablet screen and
 * a sound mark underneath. Runs the program live (WedoRunner, 10 ms ticks)
 * either with the lesson's scenario (automatic check, predictions) or with
 * the child's own sensor buttons.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Flag, Hand, Pause, Play, RotateCcw, Volume2 } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import type { WedoText } from '@/lib/i18n/wedo'
import { LEVEL_MM, ROVER_LENGTH, type SensorInput, type WedoFrame, type WedoResult, WedoRunner, outputsAt } from '@/lib/wedo/sim'
import type { ScenarioEvent, TiltState, WedoColor, WedoScene, WedoStep } from '@/lib/wedo/types'
import { cn } from '@/lib/utils'

import { LIGHT_HEX } from './blocks'
import { TiltPad } from './tilt-pad'
import { playWedoSound } from './wedo-audio'

type Lang = 'ru' | 'kk' | 'en'

export interface WedoSimViewProps {
  scene: WedoScene
  program: WedoStep[]
  scenario?: ScenarioEvent[]
  /** Change it to start a new run (0: nothing has run yet). */
  runKey: number
  /** 'live': the child's sensor buttons; 'scripted': the lesson's scenario. */
  mode: 'live' | 'scripted'
  t: WedoText
  lang: Lang
  onStep?: (path: string | null) => void
  onEnd?: (r: WedoResult) => void
}

const W = 640
const H = 280
const GROUND = 236

function usePrefersReducedMotion() {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const m = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduce(m.matches)
    const on = () => setReduce(m.matches)
    m.addEventListener('change', on)
    return () => m.removeEventListener('change', on)
  }, [])
  return reduce
}

/** Where a toy car or a hand is: it glides between "far" and "near" over 0.6 s after the sensor changes. */
function approach(runner: WedoRunner | null, t: number, motion: 'near' | 'far'): number {
  if (!runner) return motion === 'near' ? 1 : 0
  const changes = runner.events.filter((e) => e.kind === 'sensor' && e.sensor === 'motion')
  const last = changes[changes.length - 1]
  if (!last) return motion === 'near' ? 1 : 0
  const k = Math.min(1, (t - last.t) / 0.6)
  return motion === 'near' ? k : 1 - k
}

function Hub({ light, label }: { light: WedoColor; label: string }) {
  return (
    <g aria-label={label} role="img">
      <rect x="12" y="12" width="92" height="58" rx="12" fill="var(--surface)" stroke="var(--outline)" strokeWidth="3" />
      <circle cx="40" cy="41" r="15" fill={LIGHT_HEX[light]} stroke="var(--outline)" strokeWidth="2.5" opacity={light === 'off' ? 0.45 : 1} />
      {light !== 'off' && <circle cx="40" cy="41" r="21" fill="none" stroke={LIGHT_HEX[light]} strokeWidth="3" opacity="0.5" />}
      <rect x="66" y="24" width="26" height="12" rx="3" fill="var(--surface-3)" stroke="var(--outline)" strokeWidth="1.5" />
      <rect x="66" y="44" width="26" height="12" rx="3" fill="var(--surface-3)" stroke="var(--outline)" strokeWidth="1.5" />
      <text x="79" y="34" fontSize="9" fontWeight="800" textAnchor="middle" fill="var(--text)">A</text>
      <text x="79" y="54" fontSize="9" fontWeight="800" textAnchor="middle" fill="var(--text)">B</text>
    </g>
  )
}

const TILT_ROTATION: Partial<Record<TiltState, number>> = { up: 0, right: 90, down: 180, left: 270 }

/** The tilt sensor drawn as a small box with an arrow for its state. */
function TiltMark({ x, y, state }: { x: number; y: number; state: TiltState }) {
  const rot = TILT_ROTATION[state]
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-16" y="-16" width="32" height="32" rx="7" fill="var(--blk-control)" stroke="var(--outline)" strokeWidth="2.5" />
      {state === 'flat' && <rect x="-9" y="-2" width="18" height="4" rx="2" fill="#14110a" />}
      {state === 'shake' && <path d="M-10 0 L-5 -6 L0 6 L5 -6 L10 0" fill="none" stroke="#14110a" strokeWidth="3" strokeLinejoin="round" />}
      {rot !== undefined && <path d="M0 -10 L8 2 L3 2 L3 10 L-3 10 L-3 2 L-8 2 Z" fill="#14110a" transform={`rotate(${rot})`} />}
    </g>
  )
}

function HandMark({ x, y, k }: { x: number; y: number; k: number }) {
  return (
    <g transform={`translate(${x + (1 - k) * 90} ${y})`} opacity={0.35 + 0.65 * k}>
      <circle r="18" fill="var(--surface-2)" stroke="var(--outline)" strokeWidth="2" />
      <path d="M-6 8 L-6 -6 M-2 8 L-2 -10 M2 8 L2 -9 M6 8 L6 -5 M-6 8 Q0 14 6 8" stroke="var(--text)" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  )
}

function MotionSensor({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-14" y="-12" width="28" height="24" rx="6" fill="var(--blk-control)" stroke="var(--outline)" strokeWidth="2.5" />
      <circle cx="-5" cy="0" r="4" fill="#14110a" />
      <circle cx="5" cy="0" r="4" fill="#14110a" />
    </g>
  )
}

function RoverScene({ scene, f, lang }: { scene: Extract<WedoScene, { model: 'rover' }>; f: WedoFrame; lang: Lang }) {
  const X0 = 30
  const span = W - 60
  const s = span / scene.length
  const px = (mm: number) => X0 + mm * s
  const bodyW = ROVER_LENGTH * s
  const cx = px(f.x)
  const ticks = Array.from({ length: Math.floor(scene.length / 100) + 1 }, (_, i) => i * 100)
  return (
    <g>
      <rect x={X0} y={GROUND} width={span} height="8" rx="4" fill="var(--surface-3)" stroke="var(--outline)" strokeWidth="2" />
      {ticks.map((mm) => (
        <g key={mm}>
          <line x1={px(mm)} x2={px(mm)} y1={GROUND + 8} y2={GROUND + (mm % 200 === 0 ? 18 : 13)} stroke="var(--text-3)" strokeWidth="1.5" />
          {mm % 200 === 0 && (
            <text x={px(mm)} y={GROUND + 30} fontSize="10" textAnchor="middle" fill="var(--text-2)">
              {mm / 10}
            </text>
          )}
        </g>
      ))}
      {scene.zones.map((z) => (
        <g key={z.id}>
          <rect x={px(z.from)} y={GROUND - 70} width={(z.to - z.from) * s} height="70" fill="var(--wedo-accent)" opacity="0.28" />
          <rect x={px(z.from)} y={GROUND - 70} width={(z.to - z.from) * s} height="70" fill="none" stroke="var(--wedo-ink)" strokeWidth="2" strokeDasharray="6 4" />
          <line x1={px((z.from + z.to) / 2)} x2={px((z.from + z.to) / 2)} y1={GROUND - 70} y2={GROUND - 100} stroke="var(--text)" strokeWidth="2.5" />
          <path d={`M${px((z.from + z.to) / 2)} ${GROUND - 100} l18 6 l-18 6 z`} fill="var(--wedo-accent)" stroke="var(--outline)" strokeWidth="1.5" />
          <text x={px((z.from + z.to) / 2)} y={GROUND - 106} fontSize="12" fontWeight="800" textAnchor="middle" fill="var(--text)">
            {z.label?.[lang] ?? z.id}
          </text>
        </g>
      ))}
      {scene.obstacles.map((o) => (
        <g key={o.id}>
          <rect x={px(o.at)} y={GROUND - 64} width="20" height="64" fill="var(--blk-move)" stroke="var(--outline)" strokeWidth="2.5" />
          <path d={`M${px(o.at)} ${GROUND - 44} h20 M${px(o.at)} ${GROUND - 22} h20 M${px(o.at) + 10} ${GROUND - 64} v20 M${px(o.at) + 10} ${GROUND - 22} v22`} stroke="var(--outline)" strokeWidth="1.5" />
          {o.label && (
            <text x={px(o.at) + 10} y={GROUND - 72} fontSize="11" fontWeight="700" textAnchor="middle" fill="var(--text)">
              {o.label[lang]}
            </text>
          )}
        </g>
      ))}
      <line x1={px(scene.start)} x2={px(scene.start)} y1={GROUND - 4} y2={GROUND + 10} stroke="var(--wedo-ink)" strokeWidth="3" />
      {/* Zip the rover */}
      <g transform={`translate(${cx} ${GROUND})`}>
        <rect x={-bodyW / 2} y="-34" width={bodyW} height="24" rx="8" fill="var(--wedo-accent)" stroke="var(--outline)" strokeWidth="2.5" />
        <rect x={-bodyW / 2 + 4} y="-46" width={bodyW * 0.45} height="14" rx="5" fill="var(--surface)" stroke="var(--outline)" strokeWidth="2" />
        <circle cx={-bodyW / 2 + 9} cy="-8" r="8" fill="var(--ink-900, #1b1f2a)" stroke="var(--outline)" strokeWidth="2" />
        <circle cx={bodyW / 2 - 9} cy="-8" r="8" fill="var(--ink-900, #1b1f2a)" stroke="var(--outline)" strokeWidth="2" />
        {scene.sensor === 'motion' && (
          <g transform={`translate(${bodyW / 2 - 2} -24)`}>
            <rect x="-2" y="-8" width="12" height="16" rx="4" fill="var(--blk-control)" stroke="var(--outline)" strokeWidth="2" />
            <circle cx="4" cy="-3" r="2" fill="#14110a" />
            <circle cx="4" cy="3" r="2" fill="#14110a" />
          </g>
        )}
        {scene.sensor === 'tilt' && <TiltMark x={bodyW * 0.2} y={-58} state={f.tilt} />}
      </g>
    </g>
  )
}

function SpinnerScene({ scene, f }: { scene: Extract<WedoScene, { model: 'spinner' }>; f: WedoFrame }) {
  const cx = 400
  const cy = 130
  return (
    <g>
      <rect x="200" y="112" width="70" height="44" rx="10" fill="var(--blk-motor)" stroke="var(--outline)" strokeWidth="2.5" />
      <text x="235" y="139" fontSize="12" fontWeight="800" textAnchor="middle" fill="#14110a">
        A
      </text>
      <line x1="270" y1="134" x2={cx} y2={cy} stroke="var(--outline)" strokeWidth="5" />
      <rect x="300" y="116" width="44" height="34" rx="8" fill="var(--surface-2)" stroke="var(--outline)" strokeWidth="2" />
      <text x="322" y="138" fontSize="13" fontWeight="800" textAnchor="middle" fill="var(--text)">
        ×{scene.ratio}
      </text>
      <rect x={cx - 6} y={cy} width="12" height={GROUND - cy} fill="var(--surface-3)" stroke="var(--outline)" strokeWidth="2" />
      <g transform={`rotate(${f.angle} ${cx} ${cy})`}>
        {[0, 90, 180, 270].map((a, i) => (
          <rect
            key={a}
            x={cx - 9}
            y={cy - 78}
            width="18"
            height="70"
            rx="9"
            transform={`rotate(${a} ${cx} ${cy})`}
            fill={i === 0 ? 'var(--blk-events)' : 'var(--wedo-accent)'}
            stroke="var(--outline)"
            strokeWidth="2.5"
          />
        ))}
        <circle cx={cx} cy={cy} r="12" fill="var(--surface)" stroke="var(--outline)" strokeWidth="2.5" />
      </g>
    </g>
  )
}

function LiftScene({ scene, f, t }: { scene: Extract<WedoScene, { model: 'lift' }>; f: WedoFrame; t: WedoText }) {
  const top = 54
  const pxPerMm = (GROUND - 30 - top) / (scene.levels * LEVEL_MM)
  const hookY = GROUND - 30 - f.height * pxPerMm
  return (
    <g>
      {Array.from({ length: scene.levels + 1 }, (_, i) => {
        const y = GROUND - 30 - i * LEVEL_MM * pxPerMm
        return (
          <g key={i}>
            <line x1="150" x2="380" y1={y + 30} y2={y + 30} stroke="var(--text-3)" strokeWidth="1.5" strokeDasharray="5 5" />
            <text x="146" y={y + 34} fontSize="11" fontWeight="800" textAnchor="end" fill="var(--text-2)">
              {fill(t.sim.level, { n: i })}
            </text>
          </g>
        )
      })}
      <rect x="420" y={top - 14} width="18" height={GROUND - top + 14} fill="var(--blk-events)" stroke="var(--outline)" strokeWidth="2.5" />
      <rect x="250" y={top - 14} width="200" height="14" fill="var(--blk-events)" stroke="var(--outline)" strokeWidth="2.5" />
      <rect x="440" y={top + 4} width="40" height="30" rx="7" fill="var(--blk-motor)" stroke="var(--outline)" strokeWidth="2.5" />
      <line x1="270" x2="270" y1={top} y2={hookY} stroke="var(--outline)" strokeWidth="2.5" />
      <g transform={`translate(270 ${hookY})`}>
        <path d="M0 0 v8 a7 7 0 1 1 -7 7" fill="none" stroke="var(--outline)" strokeWidth="3" />
        <rect x="-20" y="16" width="40" height="28" rx="5" fill="var(--wedo-accent)" stroke="var(--outline)" strokeWidth="2.5" />
      </g>
    </g>
  )
}

function GateScene({ f, k }: { f: WedoFrame; k: number }) {
  const px = 400
  const py = GROUND - 56
  const carX = 60 + k * 190
  return (
    <g>
      <rect x="30" y={GROUND} width={W - 60} height="8" rx="4" fill="var(--surface-3)" stroke="var(--outline)" strokeWidth="2" />
      <rect x={px - 10} y={py - 6} width="20" height={GROUND - py + 6} fill="var(--surface-2)" stroke="var(--outline)" strokeWidth="2.5" />
      <g transform={`rotate(${-f.gate} ${px} ${py})`}>
        <rect x={px - 170} y={py - 7} width="170" height="14" rx="7" fill="#ffffff" stroke="var(--outline)" strokeWidth="2.5" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x={px - 160 + i * 40} y={py - 7} width="20" height="14" fill="var(--blk-move)" />
        ))}
      </g>
      <circle cx={px} cy={py} r="8" fill="var(--surface)" stroke="var(--outline)" strokeWidth="2.5" />
      <MotionSensor x={px - 24} y={GROUND - 22} />
      <g transform={`translate(${carX} ${GROUND})`}>
        <rect x="-36" y="-34" width="72" height="24" rx="8" fill="var(--blk-sound)" stroke="var(--outline)" strokeWidth="2.5" />
        <rect x="-20" y="-48" width="38" height="16" rx="6" fill="var(--surface)" stroke="var(--outline)" strokeWidth="2" />
        <circle cx="-20" cy="-8" r="8" fill="#1b1f2a" stroke="var(--outline)" strokeWidth="2" />
        <circle cx="20" cy="-8" r="8" fill="#1b1f2a" stroke="var(--outline)" strokeWidth="2" />
      </g>
    </g>
  )
}

export function WedoSimView({ scene, program, scenario, runKey, mode, t, lang, onStep, onEnd }: WedoSimViewProps) {
  const reduce = usePrefersReducedMotion()
  const [, setTick] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const runner = useRef<WedoRunner | null>(null)
  const pending = useRef<SensorInput>({})
  const [hand, setHand] = useState<'near' | 'far'>('far')
  const lastSound = useRef(-1)
  const onEndRef = useRef(onEnd)
  const onStepRef = useRef(onStep)
  onEndRef.current = onEnd
  onStepRef.current = onStep

  // The picture before any run: the program's first frame.
  const idle = useMemo(() => new WedoRunner(program, scene).trace[0], [program, scene])

  const start = useCallback(() => {
    runner.current = new WedoRunner(program, scene, mode === 'scripted' ? { scenario } : {})
    if (mode === 'live' && hand === 'near') pending.current = { motion: 'near' }
    lastSound.current = -1
    setPlaying(true)
    setTick((n) => n + 1)
  }, [program, scene, scenario, mode, hand])

  useEffect(() => {
    if (runKey > 0) start()
    // Only a new runKey starts a run.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runKey])

  // A changed program or scene shows the idle picture again.
  useEffect(() => {
    runner.current = null
    setPlaying(false)
    onStepRef.current?.(null)
  }, [program, scene])

  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    let acc = 0
    const loop = (now: number) => {
      const r = runner.current
      if (!r) return
      acc += Math.min(100, now - last) * speed
      last = now
      let alive = true
      while (acc >= 10 && alive) {
        acc -= 10
        const input = pending.current
        pending.current = {}
        alive = r.tick(input)
      }
      // Sounds play as they happen (the Run click allowed audio).
      const sounds = r.events.filter((e) => e.kind === 'sound' && e.t > lastSound.current)
      for (const s of sounds) if (s.kind === 'sound') ((lastSound.current = s.t), playWedoSound(s.sound))
      const out = outputsAt(r.events, r.t)
      onStepRef.current?.(alive ? out.step : null)
      setTick((n) => n + 1)
      if (!alive) {
        setPlaying(false)
        onEndRef.current?.(r.result())
        return
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [playing, speed])

  const r = runner.current
  const frame = r ? r.trace[r.trace.length - 1] : idle
  const out = r ? outputsAt(r.events, r.t) : { light: 'off' as WedoColor, display: null, soundAt: null, step: null }
  const soundOn = out.soundAt !== null && r !== null && r.t - out.soundAt < 0.4
  const crashed = r?.events.some((e) => e.kind === 'crash') ?? false
  const k = scene.sensor === 'motion' && scene.model !== 'rover' ? approach(r, r?.t ?? 0, frame.motion) : 0
  const liveSensors = mode === 'live' && scene.sensor !== undefined && !(scene.model === 'rover' && scene.sensor === 'motion')

  const sendMotion = (m: 'near' | 'far') => {
    setHand(m)
    pending.current = { ...pending.current, motion: m }
  }
  const sendTilt = (s: TiltState) => {
    pending.current = { ...pending.current, tilt: s }
    if (!playing) setTick((n) => n + 1)
  }

  return (
    <div className={cn('grid gap-3', reduce && '[&_*]:transition-none')}>
      <div className="overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-[radial-gradient(var(--dots)_1.4px,transparent_1.8px)] bg-(--wedo-accent-soft) bg-size-[18px_18px]">
        <svg viewBox={`0 0 ${W} ${H}`} className="block h-auto w-full" role="img" aria-label={t.sim.scene}>
          <Hub light={out.light} label={`${t.sim.hub}: ${t.colors[out.light]}`} />
          {scene.model === 'rover' && <RoverScene scene={scene} f={frame} lang={lang} />}
          {scene.model === 'spinner' && <SpinnerScene scene={scene} f={frame} />}
          {scene.model === 'lift' && <LiftScene scene={scene} f={frame} t={t} />}
          {scene.model === 'gate' && <GateScene f={frame} k={k} />}
          {scene.model !== 'rover' && scene.model !== 'gate' && scene.sensor === 'tilt' && <TiltMark x={150} y={41} state={frame.tilt} />}
          {scene.model !== 'rover' && scene.model !== 'gate' && scene.sensor === 'motion' && (
            <g>
              <MotionSensor x={150} y={41} />
              <HandMark x={190} y={41} k={k} />
            </g>
          )}
          {scene.model === 'spinner' && (
            <text x={W - 16} y="30" fontSize="14" fontWeight="800" textAnchor="end" fill="var(--text)">
              {fill(t.sim.turns, { n: (Math.abs(frame.angle) / 360).toFixed(1) })}
            </text>
          )}
          <text x={W - 16} y={H - 8} fontSize="12" fontFamily="var(--font-mono, monospace)" textAnchor="end" fill="var(--text-2)">
            {frame.t.toFixed(1)} s
          </text>
        </svg>
      </div>

      <div className="flex flex-wrap items-stretch gap-3">
        <div className="grid min-w-40 flex-1 gap-1 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-3" aria-live="polite">
          <span className="text-xs font-extrabold text-muted-foreground">{t.sim.screen}</span>
          <span className="min-h-9 font-mono text-3xl font-extrabold tracking-wider">{out.display ?? ''}</span>
        </div>
        <div className={cn('grid min-w-24 place-items-center gap-1 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-3', soundOn && 'bg-(--wedo-accent-soft)')}>
          <Volume2 className={cn('size-7', soundOn ? 'text-(--wedo-ink)' : 'opacity-40')} aria-hidden="true" />
          <span className="text-xs font-extrabold">{t.sim.sound}</span>
        </div>
      </div>

      {crashed && (
        <p className="alert alert-warn m-0" role="status">
          {t.sim.crash}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'lg' })} onClick={() => (r && !r.done ? setPlaying((p) => !p) : start())}>
          {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          {playing ? t.sim.pause : t.sim.run}
        </button>
        <button type="button" className={buttonVariants({ variant: 'ghost', size: 'lg' })} onClick={() => ((runner.current = null), setPlaying(false), onStep?.(null), setTick((n) => n + 1))}>
          <RotateCcw aria-hidden="true" />
          {t.sim.reset}
        </button>
        <div className="tab-tray" role="group" aria-label={t.sim.speed}>
          {([1, 2] as const).map((s) => (
            <button key={s} type="button" className="inline-flex min-h-9 cursor-pointer items-center rounded-(--radius-xs) px-3.5 font-extrabold aria-pressed:bg-card aria-pressed:shadow-(--shadow-press)" aria-pressed={speed === s} onClick={() => setSpeed(s)}>
              ×{s}
            </button>
          ))}
        </div>
      </div>

      {liveSensors && (
        <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-dashed border-outline p-3">
          <p className="m-0 flex items-center gap-2 font-extrabold">
            <Flag className="size-5" aria-hidden="true" />
            {t.sim.live}
          </p>
          <p className="m-0 text-sm text-muted-foreground">{t.sim.liveHint}</p>
          {scene.sensor === 'motion' && (
            <div className="flex flex-wrap gap-2" role="group" aria-label={t.sim.hand}>
              {(['near', 'far'] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  aria-pressed={hand === m}
                  className={buttonVariants({ variant: hand === m ? 'primary' : 'secondary', size: 'lg' })}
                  onClick={() => sendMotion(m)}
                >
                  <Hand aria-hidden="true" />
                  {m === 'near' ? t.sim.handNear : t.sim.handFar}
                </button>
              ))}
            </div>
          )}
          {scene.sensor === 'tilt' && <TiltPad value={frame.tilt} onTilt={sendTilt} t={t} />}
        </div>
      )}
    </div>
  )
}
