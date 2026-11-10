'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowRight, Check, Copy, Download, Boxes, Hand, Home, ImageUp, Loader2, Minus, Play, Plus, RotateCcw, Square, Timer, Trophy } from 'lucide-react'

import { ArrowMarker, FieldFrame, LaunchAreaShape, MatBase, MissionShape } from '@/components/fll/field-shapes'
import { RobotPanel, SendToRobot } from '@/components/robot-link'
import { BackgroundControls, useFieldBackground } from '@/components/fll/background'
import type { CameraKind, Field3D } from '@/components/fll/field-3d'
import { AnimIcon } from '@/components/ui/anim-icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { type ReadResult } from '@/lib/blockly/convert'
import { programToPython } from '@/lib/dsl/compile-python'
import { DEFAULT_ROBOT, type RobotProfile, type Step, type StepOp } from '@/lib/dsl/types'
import { type Answers, MAX_SCORE, SCORE_SHEET, type ScoreGroup, scoreBreakdown, startAnswers } from '@/lib/fll/bioglow-score'
import { pointInPolygon, svgPoints, zonePolygon } from '@/lib/fll/geometry'
import { buildRun } from '@/lib/fll/run'
import { type Season, localize } from '@/lib/fll/season'
import { fill } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/ru'
import type { SimulatorText } from '@/lib/i18n/simulator'
import { colorHex } from '@/lib/learn/shop'
import { useLearn } from '@/lib/learn/store'
import { type Pose, type SimResult, poseAt, simulate, stepAt } from '@/lib/sim/interpreter'
import { parseField } from '@/lib/sim/field'
import { ROBOT_SHAPE } from '@/lib/sim/robot'
import { loadRobot } from '@/lib/studio-state'
import { cn } from '@/lib/utils'

const BlocklyEditor = dynamic(() => import('@/components/learn/blockly-editor'), {
  ssr: false,
  loading: () => <div className="h-[420px] animate-pulse rounded-(--radius-md) bg-surface-2" />,
})

type Lang = 'ru' | 'kk' | 'en'
type Mode = 'training' | 'match'
type Source = 'missions' | 'blocks' | 'python'

const MATCH_SECONDS = 150
const SPEEDS = [0.25, 0.5, 1, 2, 4] as const
const TOOLBOX: StepOp[] = [
  'move',
  'turn',
  'steer',
  'set_speed',
  'start_move',
  'stop_move',
  'motor_run',
  'motor_to_position',
  'wait',
  'wait_until',
  'repeat',
  'if',
  'beep',
  'reset_yaw',
]
/** Manual driving: mm/s and degrees/s (Shift: slower). */
const DRIVE_SPEED = 380
const TURN_SPEED = 140

interface Run {
  result: SimResult
  t: number
  /** Finished or stopped: the robot stays where it is, the trail stays drawn. */
  done: boolean
  /** Distance travelled by each trace sample (for drawing the trail). */
  cum: number[]
}

const fmtTime = (s: number) => `${Math.floor(Math.max(0, s) / 60)}:${String(Math.floor(Math.max(0, s) % 60)).padStart(2, '0')}`

function travelled(trace: Pose[]): number[] {
  const cum = [0]
  for (let i = 1; i < trace.length; i++) cum.push(cum[i - 1] + Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y))
  return cum
}

interface Props {
  lang: Lang
  t: SimulatorText
  season: Season
  bgT: Dictionary['fll']['background']
  blocksT: Dictionary['blocks']
}

/**
 * Our FLL field simulator: the season field (the team's mat picture or the
 * schematic), a robot that runs DSL programs through the same interpreter as
 * the lessons, manual driving, a 2:30 match clock and the season's score
 * sheet. Frames are drawn by writing SVG attributes in requestAnimationFrame;
 * React only re-renders a few times a second for the clock.
 */
export function FieldSim({ lang, t, season, bgT, blocksT }: Props) {
  const { widthMm: W, heightMm: H } = season.field
  const bg = useFieldBackground(season.id)
  const learn = useLearn()
  const robotColor = colorHex(learn.profile?.cosmetics.color ?? 'sky')

  const [robot, setRobot] = useState<RobotProfile>(DEFAULT_ROBOT)
  const [base, setBase] = useState(season.launchAreas[0]?.id ?? 'left')
  const [mode, setMode] = useState<Mode>('training')
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1)
  const [source, setSource] = useState<Source>('missions')
  const [picked, setPicked] = useState<string[]>([])
  const [blockSteps, setBlockSteps] = useState<Step[]>([])
  const [blocksSeed, setBlocksSeed] = useState<{ steps: Step[]; key: number }>({ steps: [], key: 0 })
  const [running, setRunning] = useState(false)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [matchLeft, setMatchLeft] = useState(MATCH_SECONDS)
  const [matchOn, setMatchOn] = useState(false)
  const [matchOver, setMatchOver] = useState(false)
  const [answers, setAnswers] = useState<Answers>(startAnswers)
  const [copied, setCopied] = useState(false)
  const [view, setView] = useState<'3d' | 'map'>('3d')
  const [camera, setCamera] = useState<CameraKind>('orbit')
  const [ready3d, setReady3d] = useState(false)
  const [failed3d, setFailed3d] = useState(false)

  const svg = useRef<SVGSVGElement>(null)
  const robotEl = useRef<SVGGElement>(null)
  const trailEl = useRef<SVGPolylineElement>(null)
  const host3d = useRef<HTMLDivElement>(null)
  const view3d = useRef<Field3D | null>(null)
  const pose = useRef<Pose>({ x: 0, y: 0, heading: 90 })
  const run = useRef<Run | null>(null)
  const keys = useRef(new Set<string>())
  const drag = useRef<{ dx: number; dy: number } | null>(null)
  const speedRef = useRef(speed)
  const matchRef = useRef({ on: false, left: MATCH_SECONDS })
  speedRef.current = speed

  useEffect(() => {
    const saved = loadRobot()
    if (saved) setRobot(saved)
  }, [])

  const area = season.launchAreas.find((a) => a.id === base) ?? season.launchAreas[0]
  const start: Pose = area ? { x: area.start.x, y: area.start.y, heading: area.start.headingDeg } : { x: 200, y: 160, heading: 90 }

  // The program from the ticked missions (planner's route builder).
  const missionSteps = useMemo(() => {
    if (!picked.length) return []
    return buildRun(season, { name: 'Run', launchAreaId: base, missions: picked.map((id) => ({ id })), explanation: '' }, robot, lang).program.steps
  }, [season, base, picked, robot, lang])
  const steps = source === 'blocks' ? blockSteps : missionSteps
  const python = useMemo(() => programToPython({ title: 'BIOGLOW', description: '', steps }, robot), [steps, robot])

  // ── Drawing ───────────────────────────────────────────────────────────
  const draw = useCallback((teleport = false) => {
    const p = pose.current
    robotEl.current?.setAttribute('transform', `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${p.heading.toFixed(2)})`)
    view3d.current?.setRobot(p, teleport)
    const r = run.current
    if (!r) {
      trailEl.current?.setAttribute('stroke-dashoffset', '1e6')
      return
    }
    const total = r.cum[r.cum.length - 1] || 1
    const tr = r.result.trace
    let lo = 0
    let hi = tr.length - 1
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1
      if (tr[mid].t <= r.t) lo = mid
      else hi = mid
    }
    trailEl.current?.setAttribute('stroke-dasharray', `${total} ${total}`)
    trailEl.current?.setAttribute('stroke-dashoffset', String(total - r.cum[lo]))
    view3d.current?.setTrailProgress(lo)
  }, [])

  const place = useCallback(
    (p: Pose, teleport = false) => {
      pose.current = p
      draw(teleport)
    },
    [draw],
  )

  // Start in the chosen base.
  useEffect(() => {
    if (!run.current) place(start)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base])

  // ── The frame loop ────────────────────────────────────────────────────
  useEffect(() => {
    let raf = 0
    let last = performance.now()
    let lastUi = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      const s = speedRef.current
      const r = run.current
      if (r && !r.done) {
        r.t = Math.min(r.result.final.t, r.t + dt * s)
        pose.current = poseAt(r.result.trace, r.t)
        if (r.t >= r.result.final.t) {
          r.done = true
          setRunning(false)
          setHighlight(null)
        }
        draw()
      } else if (keys.current.size) {
        const k = keys.current
        const slow = k.has('Shift') ? 0.35 : 1
        const fwd = (k.has('w') || k.has('ArrowUp') ? 1 : 0) - (k.has('s') || k.has('ArrowDown') ? 1 : 0)
        const turn = (k.has('a') || k.has('ArrowLeft') ? 1 : 0) - (k.has('d') || k.has('ArrowRight') ? 1 : 0)
        const p = pose.current
        const heading = p.heading + turn * TURN_SPEED * slow * dt * s
        const rad = (heading * Math.PI) / 180
        const half = ROBOT_SHAPE.width / 2
        pose.current = {
          heading,
          x: Math.min(W - half, Math.max(half, p.x + Math.cos(rad) * fwd * DRIVE_SPEED * slow * dt * s)),
          y: Math.min(H - half, Math.max(half, p.y + Math.sin(rad) * fwd * DRIVE_SPEED * slow * dt * s)),
        }
        draw()
      }
      const m = matchRef.current
      if (m.on) {
        m.left = Math.max(0, m.left - dt * s)
        if (m.left === 0) {
          m.on = false
          if (run.current) run.current.done = true
          setRunning(false)
          setMatchOn(false)
          setMatchOver(true)
        }
      }
      if (now - lastUi > 100) {
        lastUi = now
        if (m.on) setMatchLeft(m.left)
        if (run.current && !run.current.done) setHighlight(stepAt(run.current.result.events, run.current.t))
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [draw, W, H])

  // ── Actions ───────────────────────────────────────────────────────────
  const canRun = mode === 'training' || matchOn
  const go = () => {
    if (!steps.length || !canRun) return
    const field = parseField({ width: W, height: H, start, border: true })
    const left = mode === 'match' ? matchRef.current.left : MATCH_SECONDS
    const result = simulate(steps, field, { robot, maxTime: Math.max(1, left) })
    run.current = { result, t: 0, done: false, cum: travelled(result.trace) }
    if (trailEl.current) trailEl.current.setAttribute('points', svgPoints(result.trace))
    view3d.current?.setTrail(result.trace)
    setRunning(true)
  }
  const stop = () => {
    if (run.current) run.current.done = true
    setRunning(false)
    setHighlight(null)
  }
  const inBase = () => !!area && pointInPolygon(pose.current, zonePolygon(area))
  /** Interrupt: the robot goes back to base; outside the base it costs a precision token. */
  const interrupt = () => {
    if (!inBase()) setAnswers((a) => ({ ...a, tokens: Math.max(0, Number(a.tokens) - 1) }))
    run.current = null
    view3d.current?.setTrail(null)
    setRunning(false)
    setHighlight(null)
    place(start, true)
  }
  const toStart = () => {
    run.current = null
    view3d.current?.setTrail(null)
    setRunning(false)
    place(start, true)
  }
  const startMatch = () => {
    matchRef.current = { on: true, left: MATCH_SECONDS }
    setMatchLeft(MATCH_SECONDS)
    setMatchOn(true)
    setMatchOver(false)
  }
  const newMatch = () => {
    matchRef.current = { on: false, left: MATCH_SECONDS }
    setMatchOn(false)
    setMatchOver(false)
    setMatchLeft(MATCH_SECONDS)
    setAnswers(startAnswers())
    view3d.current?.resetPieces()
    toStart()
  }
  const switchMode = (m: Mode) => {
    setMode(m)
    if (m === 'training') {
      matchRef.current.on = false
      setMatchOn(false)
    } else newMatch()
  }
  const toBlocks = () => {
    if (source !== 'blocks') setBlocksSeed((s) => ({ steps: blockSteps.length ? blockSteps : missionSteps, key: s.key + 1 }))
    setSource('blocks')
  }
  const togglePick = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  const downloadLlsp3 = async () => {
    const { createLlsp3 } = await import('@/lib/spike/llsp3')
    const blob = await createLlsp3('BIOGLOW', { format: 'blocks', program: { title: 'BIOGLOW', description: '', steps }, robot })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'BIOGLOW.llsp3'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  // ── The 3D field (three.js + Rapier, loaded on demand) ─────────────────
  const robotColorRef = useRef(robotColor)
  robotColorRef.current = robotColor
  const matRef = useRef(bg.url)
  matRef.current = bg.url
  useEffect(() => {
    if (view !== '3d' || !host3d.current) return
    let alive = true
    let made: Field3D | null = null
    setReady3d(false)
    import('@/components/fll/field-3d')
      .then(({ Field3D }) =>
        Field3D.create(host3d.current!, {
          season,
          matUrl: matRef.current,
          robotColor: robotColorRef.current,
          onDragRobot: (q) => {
            // Not while a program drives the robot.
            if (run.current && !run.current.done) return
            place({ ...pose.current, x: Math.min(W, Math.max(0, q.x)), y: Math.min(H, Math.max(0, q.y)) })
          },
          onPickMission: (id) => document.getElementById(`score-${id.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }),
        }),
      )
      .then((v) => {
        if (!alive) return v.dispose()
        made = v
        view3d.current = v
        v.setCamera(camera)
        if (run.current) v.setTrail(run.current.result.trace)
        draw(true)
        setReady3d(true)
      })
      .catch(() => alive && setFailed3d(true))
    return () => {
      alive = false
      made?.dispose()
      view3d.current = null
    }
    // Recreate only when the view or the season changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, season])
  useEffect(() => view3d.current?.setMat(bg.url), [bg.url])
  useEffect(() => view3d.current?.setRobotColor(robotColor), [robotColor])
  useEffect(() => view3d.current?.setCamera(camera), [camera])

  // ── Input on the field ────────────────────────────────────────────────
  const toField = (e: { clientX: number; clientY: number }) => {
    const ctm = svg.current?.getScreenCTM()
    if (!ctm) return null
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse())
    return { x: p.x, y: H - p.y }
  }
  const DRIVE_KEYS = new Set(['w', 'a', 's', 'd', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Shift'])
  const onKeyDown = (e: React.KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    const latin = { ц: 'w', ф: 'a', ы: 's', в: 'd' }[k] ?? k
    if (!DRIVE_KEYS.has(latin) || running) return
    e.preventDefault()
    keys.current.add(latin)
  }
  const onKeyUp = (e: React.KeyboardEvent) => {
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key
    keys.current.delete({ ц: 'w', ф: 'a', ы: 's', в: 'd' }[k] ?? k)
  }
  useEffect(() => {
    const el = svg.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      if (running || !(e.target as Element).closest('[data-robot]')) return
      e.preventDefault()
      place({ ...pose.current, heading: pose.current.heading - Math.sign(e.deltaY) * 5 })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [running, place])

  const score = scoreBreakdown(answers)
  const total = Object.values(score).reduce((a, b) => a + b, 0)
  const setAnswer = (key: string, v: boolean | number) => setAnswers((a) => ({ ...a, [key]: v }))
  const scrollToScore = (missionId: string) =>
    document.getElementById(`score-${missionId.toLowerCase()}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })

  return (
    <div className="container grid gap-6 py-8 md:py-10">
      <header className="grid max-w-3xl gap-3">
        <p className="eyebrow m-0">{t.eyebrow}</p>
        <h1 className="m-0 text-4xl md:text-5xl">{t.title}</h1>
        <p className="lead m-0">{t.lead}</p>
      </header>

      {/* Match bar */}
      <div className="flex flex-wrap items-center gap-3 rounded-(--radius-lg) border-(length:--stroke) border-outline bg-[#101626] p-3 text-white shadow-(--shadow-hard) sm:p-4">
        <div
          className="flex overflow-hidden rounded-(--radius-sm) border-(length:--stroke-thin) border-white/30"
          role="group"
          aria-label={`${t.training} / ${t.match}`}
        >
          {(['training', 'match'] as const).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mode === m}
              onClick={() => switchMode(m)}
              className={cn('px-3 py-2 text-sm font-extrabold', mode === m ? 'bg-primary text-primary-foreground' : 'text-white/80 hover:bg-white/10')}
            >
              {m === 'training' ? t.training : t.match}
            </button>
          ))}
        </div>
        {mode === 'match' && (
          <>
            <span
              className={cn('font-mono text-3xl font-bold tabular-nums', matchLeft <= 30 && matchOn && 'text-[#ff8a7a]')}
              aria-live="off"
              data-testid="match-clock"
            >
              {fmtTime(matchLeft)}
            </span>
            {matchOn ? null : matchOver ? (
              <button type="button" className={buttonVariants({ size: 'sm', variant: 'primary' })} onClick={newMatch}>
                <RotateCcw aria-hidden="true" />
                {t.newMatch}
              </button>
            ) : (
              <button type="button" className={buttonVariants({ size: 'sm', variant: 'primary' })} onClick={startMatch}>
                <Timer aria-hidden="true" />
                {t.startMatch}
              </button>
            )}
          </>
        )}
        <span className="ml-auto inline-flex items-baseline gap-1 font-display" data-testid="score-total">
          <Trophy className="size-5 self-center text-primary" aria-hidden="true" />
          <span className="text-3xl font-extrabold">{total}</span>
          <span className="text-white/60">/ {MAX_SCORE}</span>
        </span>
      </div>
      {matchOver && (
        <p className="alert alert-ok m-0" role="status">
          {t.timeUp} {t.final}: {total} / {MAX_SCORE}
        </p>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <div className="grid content-start gap-4">
          {/* Field */}
          <Card className="gap-3 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex gap-1" role="group" aria-label={t.base}>
                {season.launchAreas.map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    aria-pressed={base === a.id}
                    disabled={running}
                    onClick={() => setBase(a.id)}
                    className={buttonVariants({ size: 'sm', variant: base === a.id ? 'primary' : 'secondary' })}
                  >
                    {localize(a.name, lang)}
                  </button>
                ))}
              </div>
              <button type="button" className={buttonVariants({ size: 'sm' })} onClick={toStart} disabled={running}>
                <Home aria-hidden="true" />
                {t.toStart}
              </button>
              <div className="flex overflow-hidden rounded-(--radius-sm) border-(length:--stroke-thin) border-outline" role="group" aria-label={t.view}>
                {(['3d', 'map'] as const).map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => setView(v)}
                    className={cn('px-3 py-1.5 text-sm font-extrabold', view === v ? 'bg-primary text-primary-foreground' : 'bg-card')}
                  >
                    {v === '3d' ? '3D' : t.map}
                  </button>
                ))}
              </div>
              {!bg.url && (
                <label htmlFor="sim-mat-input" className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'cursor-pointer' })}>
                  <ImageUp aria-hidden="true" />
                  {t.matUpload}
                </label>
              )}
              <div className="ml-auto flex items-center gap-1 text-sm font-bold" role="group" aria-label={t.speed}>
                <span className="mr-1 text-muted-foreground max-sm:hidden">{t.speed}</span>
                {SPEEDS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={speed === s}
                    onClick={() => setSpeed(s)}
                    className={cn(
                      'rounded-(--radius-xs) border-(length:--stroke-thin) border-outline px-2 py-1',
                      speed === s ? 'bg-primary text-primary-foreground' : 'bg-card',
                    )}
                  >
                    {s === 0.25 ? '¼' : s === 0.5 ? '½' : s}×
                  </button>
                ))}
              </div>
            </div>

            {view === '3d' && (
              <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label={t.camera}>
                <span className="mr-1 text-sm font-bold text-muted-foreground">{t.camera}</span>
                {(['orbit', 'top', 'base', 'follow'] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={camera === c}
                    onClick={() => setCamera(c)}
                    className={cn(
                      'rounded-full border-(length:--stroke-thin) border-outline px-3 py-1 text-sm font-bold',
                      camera === c ? 'bg-[#101626] text-white' : 'bg-card',
                    )}
                  >
                    {t.cameras[c]}
                  </button>
                ))}
                <button
                  type="button"
                  className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'ml-auto' })}
                  onClick={() => view3d.current?.resetPieces()}
                >
                  <Boxes aria-hidden="true" />
                  {t.resetPieces}
                </button>
              </div>
            )}

            <div
              className="relative overflow-hidden rounded-(--radius-sm) border-(length:--stroke-thin) border-outline focus-visible:ring-3 focus-visible:ring-(--focus) focus-visible:outline-none"
              tabIndex={0}
              onKeyDown={onKeyDown}
              onKeyUp={onKeyUp}
              onBlur={() => keys.current.clear()}
              aria-label={`${t.field}. ${t.driveHint}`}
              data-testid="sim-field"
            >
              {view === '3d' && (
                <div
                  ref={host3d}
                  className="relative aspect-[16/9] max-h-[72dvh] w-full bg-[radial-gradient(var(--dots)_1.6px,transparent_2px)] bg-size-[20px_20px] bg-[#fdf6e8] dark:bg-[#151a2b]"
                  data-testid="sim-3d"
                >
                  {!ready3d && (
                    <div className="absolute inset-0 z-10 grid place-items-center text-center">
                      <p className="m-0 flex items-center gap-2 font-display text-lg font-extrabold">
                        {failed3d ? (
                          t.failed3d
                        ) : (
                          <>
                            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
                            {t.loading3d}
                          </>
                        )}
                      </p>
                    </div>
                  )}
                </div>
              )}
              <svg
                ref={svg}
                className={cn('fll-field touch-none', view === '3d' && 'hidden')}
                viewBox={`0 0 ${W} ${H}`}
                role="img"
                aria-label={t.field}
                onPointerMove={(e) => {
                  if (!drag.current) return
                  const p = toField(e)
                  if (p) place({ ...pose.current, x: Math.min(W, Math.max(0, p.x - drag.current.dx)), y: Math.min(H, Math.max(0, p.y - drag.current.dy)) })
                }}
                onPointerUp={() => (drag.current = null)}
                onPointerCancel={() => (drag.current = null)}
              >
                <defs>
                  <ArrowMarker />
                </defs>
                <MatBase
                  width={W}
                  height={H}
                  background={bg.url}
                  backgroundOpacity={bg.url ? 1 : undefined}
                  grid={bg.url ? 0 : 100}
                  unit={lang === 'en' ? 'mm' : 'мм'}
                />
                <FieldFrame height={H}>
                  {season.launchAreas.map((a) => (
                    <LaunchAreaShape key={a.id} area={a} label={bg.url ? '' : localize(a.name, lang)} />
                  ))}
                  {season.missions.map((m) => (
                    <g
                      key={m.id}
                      className="fll-mission"
                      data-selected={picked.includes(m.id)}
                      onClick={() => scrollToScore(m.id)}
                      aria-label={`${m.number}. ${localize(m.name, lang)}`}
                    >
                      <MissionShape mission={m} showZone={false} />
                    </g>
                  ))}
                  <polyline
                    ref={trailEl}
                    points=""
                    fill="none"
                    stroke="#ffc531"
                    strokeWidth="14"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeDashoffset="1e6"
                    opacity="0.9"
                  />
                  {/* The robot, drawn facing +x; the axle is at the origin. */}
                  <g
                    ref={robotEl}
                    data-robot
                    className={cn(!running && 'cursor-grab')}
                    onPointerDown={(e) => {
                      if (running) return
                      const p = toField(e)
                      if (!p) return
                      e.currentTarget.ownerSVGElement?.setPointerCapture(e.pointerId)
                      drag.current = { dx: p.x - pose.current.x, dy: p.y - pose.current.y }
                    }}
                  >
                    <rect x={-ROBOT_SHAPE.length / 2 + 20} y={-ROBOT_SHAPE.width / 2 - 14} width={70} height={22} rx={6} fill="#1b1f2a" />
                    <rect x={-ROBOT_SHAPE.length / 2 + 20} y={ROBOT_SHAPE.width / 2 - 8} width={70} height={22} rx={6} fill="#1b1f2a" />
                    <rect
                      x={-ROBOT_SHAPE.length / 2}
                      y={-ROBOT_SHAPE.width / 2}
                      width={ROBOT_SHAPE.length}
                      height={ROBOT_SHAPE.width}
                      rx={18}
                      fill={robotColor}
                      stroke="#1b1f2a"
                      strokeWidth={8}
                    />
                    <rect x={-30} y={-34} width={60} height={68} rx={10} fill="#1b1f2a" />
                    <circle cx={14} cy={-14} r={8} fill="#9ef0ff" />
                    <circle cx={14} cy={14} r={8} fill="#9ef0ff" />
                    <path d={`M${ROBOT_SHAPE.length / 2 - 6} -22 L${ROBOT_SHAPE.length / 2 + 26} 0 L${ROBOT_SHAPE.length / 2 - 6} 22 Z`} fill="#1b1f2a" />
                  </g>
                </FieldFrame>
              </svg>
              {running && (
                <span className="pointer-events-none absolute top-2 left-2 rounded-full border-(length:--stroke-thin) border-outline bg-card px-3 py-1 text-xs font-extrabold shadow-(--shadow-press)">
                  <AnimIcon name="play" /> {t.running}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={go} disabled={running || !steps.length || !canRun}>
                <Play aria-hidden="true" />
                {t.run}
              </button>
              <button type="button" className={buttonVariants()} onClick={stop} disabled={!running}>
                <Square aria-hidden="true" />
                {t.stop}
              </button>
              <button type="button" className={buttonVariants()} onClick={interrupt} title={t.interruptHint}>
                <Hand aria-hidden="true" />
                {t.interrupt}
              </button>
              <span className="text-sm text-muted-foreground">{!canRun ? t.outOfTime : view === '3d' ? `${t.orbitHint} ${t.driveHint}` : t.driveHint}</span>
            </div>
          </Card>

          {/* Program */}
          <Card className="gap-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{t.program}</CardTitle>
              <div className="flex gap-1" role="group" aria-label={t.program}>
                {(['missions', 'blocks', 'python'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={source === s}
                    onClick={() => (s === 'blocks' ? toBlocks() : setSource(s))}
                    className={buttonVariants({ size: 'sm', variant: source === s ? 'primary' : 'secondary' })}
                  >
                    {s === 'missions' ? t.fromMissions : s === 'blocks' ? t.blocks : t.python}
                  </button>
                ))}
              </div>
            </div>

            {source === 'missions' && (
              <>
                <p className="m-0 text-sm text-muted-foreground">{t.missionsHint}</p>
                <ul className="m-0 grid list-none gap-1.5 p-0 sm:grid-cols-2 lg:grid-cols-3" data-testid="sim-missions">
                  {season.missions.map((m) => {
                    const order = picked.indexOf(m.id)
                    return (
                      <li key={m.id}>
                        <label
                          className={cn(
                            'flex cursor-pointer items-center gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline px-2.5 py-2 text-sm font-bold',
                            order >= 0 ? 'bg-primary text-primary-foreground' : 'bg-card',
                          )}
                        >
                          <input type="checkbox" className="sr-only" checked={order >= 0} onChange={() => togglePick(m.id)} />
                          <span className="grid size-6 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card text-xs text-foreground">
                            {order >= 0 ? order + 1 : m.number}
                          </span>
                          <span className="min-w-0 flex-1 leading-tight">{localize(m.name, lang)}</span>
                          <span className="text-xs opacity-75">{m.points}</span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
                {!picked.length && <p className="m-0 text-sm font-bold">{t.noMissions}</p>}
              </>
            )}

            {source === 'blocks' && (
              <div className="h-[460px] overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2">
                <BlocklyEditor
                  lang={lang}
                  t={blocksT}
                  toolbox={TOOLBOX}
                  initial={blocksSeed.steps}
                  resetKey={blocksSeed.key}
                  highlight={highlight}
                  onChange={(r: ReadResult) => setBlockSteps(r.steps)}
                  label={t.blocks}
                />
              </div>
            )}

            {source === 'python' && (
              <div className="grid gap-2">
                <pre
                  className="m-0 max-h-[460px] overflow-auto rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-[#101626] p-4 font-mono text-xs leading-relaxed text-[#e6f1ff]"
                  data-testid="sim-python"
                >
                  {python}
                </pre>
                <button
                  type="button"
                  className={buttonVariants({ size: 'sm', className: 'justify-self-start' })}
                  onClick={() => {
                    void navigator.clipboard?.writeText(python)
                    setCopied(true)
                    setTimeout(() => setCopied(false), 1500)
                  }}
                >
                  {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                  {copied ? t.copied : t.copy}
                </button>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t-(length:--stroke-thin) border-dashed border-outline pt-3">
              <Badge variant="outline">{fill(t.steps, { n: steps.length })}</Badge>
              <button type="button" className={buttonVariants({ size: 'sm' })} onClick={() => void downloadLlsp3()} disabled={!steps.length}>
                <Download aria-hidden="true" />
                {t.download}
              </button>
              <SendToRobot lang={lang} code={python} disabled={!steps.length} />
            </div>
          </Card>

          {/* Mat picture (shared with the FLL coach) */}
          <RobotPanel lang={lang} />

          <Card className="gap-2" flat>
            <CardTitle>{t.matTitle}</CardTitle>
            <p className="m-0 text-sm text-muted-foreground">{bg.url ? t.matHas : t.matNone}</p>
            <BackgroundControls state={bg} field={season.field} t={bgT} inputId="sim-mat-input" />
          </Card>
        </div>

        {/* Score sheet */}
        <aside className="grid content-start gap-3 xl:sticky xl:top-20 xl:max-h-[calc(100dvh-6rem)] xl:overflow-y-auto xl:pr-1" aria-label={t.score}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="m-0 text-2xl">{t.score}</h2>
            <button type="button" className={buttonVariants({ size: 'sm', variant: 'ghost' })} onClick={() => setAnswers(startAnswers())}>
              <RotateCcw aria-hidden="true" />
              {t.resetField}
            </button>
          </div>
          <p className="m-0 text-sm text-muted-foreground">{t.scoreHint}</p>
          {SCORE_SHEET.map((g) => (
            <ScoreCard key={g.id} group={g} lang={lang} t={t} answers={answers} points={score[g.id] ?? 0} onChange={setAnswer} />
          ))}
        </aside>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Link className={buttonVariants({ className: 'max-w-full max-sm:h-auto max-sm:py-2 max-sm:whitespace-normal max-sm:text-center' })} href={`/${lang}/compete`}>
          {t.toPlanner}
          <ArrowRight aria-hidden="true" />
        </Link>
      </div>
      <p className="m-0 text-sm text-muted-foreground">{t.credit}</p>
    </div>
  )
}

function ScoreCard({
  group,
  lang,
  t,
  answers,
  points,
  onChange,
}: {
  group: ScoreGroup
  lang: Lang
  t: SimulatorText
  answers: Answers
  points: number
  onChange: (key: string, v: boolean | number) => void
}) {
  const L = (x: { ru: string; en: string; kk?: string }) => (lang === 'en' ? x.en : lang === 'kk' ? (x.kk ?? x.ru) : x.ru)
  return (
    <section
      id={`score-${group.id}`}
      className={cn('grid gap-2 rounded-(--radius-md) border-(length:--stroke-thin) border-outline p-3', points > 0 ? 'bg-(--ok-bg)' : 'bg-card')}
    >
      <header className="flex items-center gap-2">
        <span className="grid h-7 min-w-9 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary px-1.5 font-mono text-xs font-bold text-primary-foreground">
          {group.number}
        </span>
        <h3 className="m-0 min-w-0 flex-1 text-base leading-tight">{L(group.title)}</h3>
        {group.noEquipment && (
          <span title={t.noEquipment} aria-label={t.noEquipment}>
            <AnimIcon name="no" />
          </span>
        )}
        <strong className="font-display text-xl tabular-nums">{points}</strong>
      </header>
      {group.items.map((it) => {
        const v = answers[it.key]
        return (
          <div key={it.key} className="grid grid-cols-[1fr_auto] items-center gap-2 text-sm">
            <span className="leading-snug">
              {L(it.label)} <span className="text-xs font-bold text-muted-foreground">({L(it.pts)})</span>
            </span>
            {it.kind.type === 'yn' && (
              <button
                type="button"
                aria-pressed={v === true}
                aria-label={L(it.label)}
                onClick={() => onChange(it.key, v !== true)}
                className={cn(
                  'min-w-14 rounded-full border-(length:--stroke-thin) border-outline px-2.5 py-1 text-xs font-extrabold',
                  v === true ? 'bg-success text-white' : 'bg-surface-2',
                )}
              >
                {v === true ? t.yes : t.no}
              </button>
            )}
            {it.kind.type === 'count' && (
              <span className="inline-flex items-center gap-1" role="group" aria-label={L(it.label)}>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card"
                  aria-label="−"
                  onClick={() => onChange(it.key, Math.max(0, Number(v) - 1))}
                >
                  <Minus className="size-3.5" aria-hidden="true" />
                </button>
                <span className="w-5 text-center font-mono font-bold tabular-nums">{Number(v)}</span>
                <button
                  type="button"
                  className="grid size-7 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card"
                  aria-label="+"
                  onClick={() => onChange(it.key, Math.min(it.kind.type === 'count' ? it.kind.max : 0, Number(v) + 1))}
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                </button>
              </span>
            )}
            {it.kind.type === 'choice' && (
              <span className="inline-flex flex-wrap justify-end gap-1" role="group" aria-label={L(it.label)}>
                {it.kind.options.map((o, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={v === i}
                    onClick={() => onChange(it.key, i)}
                    className={cn(
                      'rounded-full border-(length:--stroke-thin) border-outline px-2 py-0.5 text-xs font-bold',
                      v === i ? 'bg-primary text-primary-foreground' : 'bg-card',
                    )}
                  >
                    {L(o)}
                  </button>
                ))}
              </span>
            )}
          </div>
        )
      })}
    </section>
  )
}
