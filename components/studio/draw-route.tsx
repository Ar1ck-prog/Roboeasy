'use client'

import { type PointerEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Eraser, Play, Route as RouteIcon } from 'lucide-react'

import { BlockStack } from '@/components/block-stack'
import { CodeView } from '@/components/code-view'
import { RobotPanel, SendToRobot } from '@/components/robot-link'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { programToPython } from '@/lib/dsl/compile-python'
import { saveDrivePorts, savedRobot } from '@/lib/saved-robot'
import { DEFAULT_ROBOT, PORTS, type Port, type Program, countSteps } from '@/lib/dsl/types'
import { type Locale, fill } from '@/lib/i18n/config'
import type { DrawText } from '@/lib/i18n/draw'
import type { Dictionary } from '@/lib/i18n/ru'
import { type Point, type Primitive, traceRoute } from '@/lib/route/trace'
import type { SimField } from '@/lib/sim/field'
import { type SimResult, poseAt, simulate } from '@/lib/sim/interpreter'
import { ROBOT_SHAPE } from '@/lib/sim/robot'

const WIDTH = 1200
const HEIGHT = 800
const GRID = 100

/** An empty mat in the simulator's own format. */
const FIELD: SimField = {
  width: WIDTH,
  height: HEIGHT,
  start: { x: 150, y: 150, heading: 0 },
  border: true,
  lines: [],
  zones: [],
  walls: [],
  points: [],
} as unknown as SimField

/** SVG draws downward; the field's y axis goes up. */
const sy = (y: number) => HEIGHT - y

function primitivePath(p: Primitive): string {
  if (p.kind === 'line') return `M${p.from.x} ${sy(p.from.y)}L${p.to.x} ${sy(p.to.y)}`
  // A full turn cannot be one SVG arc: it is drawn in two halves through the opposite point.
  const large = Math.abs(p.sweep) > Math.PI ? 1 : 0
  const sweepFlag = p.sweep > 0 ? 0 : 1
  if (Math.abs(p.sweep) > 5.8) {
    const mx = 2 * p.center.x - p.from.x
    const my = 2 * p.center.y - p.from.y
    return `M${p.from.x} ${sy(p.from.y)}A${p.radius} ${p.radius} 0 1 ${sweepFlag} ${mx} ${sy(my)}A${p.radius} ${p.radius} 0 1 ${sweepFlag} ${p.to.x} ${sy(p.to.y)}`
  }
  return `M${p.from.x} ${sy(p.from.y)}A${p.radius} ${p.radius} 0 ${large} ${sweepFlag} ${p.to.x} ${sy(p.to.y)}`
}

export function DrawRoute({ lang, t, labels }: { lang: Locale; t: DrawText; labels: Dictionary['blocks'] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drawing = useRef(false)
  const [points, setPoints] = useState<Point[]>([])
  const [precision, setPrecision] = useState(60)
  const [sim, setSim] = useState<SimResult | null>(null)
  const [time, setTime] = useState(0)
  const [view, setView] = useState<'blocks' | 'python'>('blocks')

  const route = useMemo(() => (points.length > 1 ? traceRoute(points, FIELD.start, precision) : null), [points, precision])
  const program: Program | null = route && route.steps.length ? { title: t.programTitle, description: '', steps: route.steps } : null
  // The robot's own ports and calibration from the studio (motors on C and D drive too).
  const [robot, setRobot] = useState(DEFAULT_ROBOT)
  useEffect(() => setRobot(savedRobot()), [])
  const code = useMemo(() => (program ? programToPython(program, robot) : ''), [program, robot])

  // Any change to the route means it has not been driven yet.
  useEffect(() => {
    setSim(null)
    setTime(0)
  }, [route])

  const toField = (e: PointerEvent<SVGSVGElement>): Point => {
    const box = (svgRef.current as SVGSVGElement).getBoundingClientRect()
    const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
    return { x: clamp(((e.clientX - box.left) / box.width) * WIDTH, WIDTH), y: clamp(HEIGHT - ((e.clientY - box.top) / box.height) * HEIGHT, HEIGHT) }
  }

  const start = (e: PointerEvent<SVGSVGElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    drawing.current = true
    setPoints([toField(e)])
  }
  const move = (e: PointerEvent<SVGSVGElement>) => {
    if (drawing.current) setPoints((p) => [...p, toField(e)])
  }
  const end = () => {
    drawing.current = false
  }

  const drive = () => {
    if (!program) return
    const result = simulate(program.steps, FIELD)
    setSim(result)
    const finish = result.final.t
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return setTime(finish)
    setTime(0)
    const began = performance.now()
    const tick = (now: number) => {
      const t2 = Math.min(finish, (now - began) / 1000)
      setTime(t2)
      if (t2 < finish) requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  }

  // Picking the other motor's port swaps the two motors.
  function pickMotor(side: 'leftMotor' | 'rightMotor', port: Port) {
    const { leftMotor, rightMotor } = robot
    if (side === 'leftMotor') setRobot(saveDrivePorts(port, port === rightMotor ? leftMotor : rightMotor))
    else setRobot(saveDrivePorts(port === leftMotor ? rightMotor : leftMotor, port))
  }

  const pose = sim ? poseAt(sim.trace, time) : { ...FIELD.start }
  const driven = sim ? sim.trace.filter((p) => p.t <= time) : []
  const hitWall = sim !== null && sim.collisions > 0
  const hl = ROBOT_SHAPE.length / 2
  const hw = ROBOT_SHAPE.width / 2

  return (
    <div className="container grid gap-6 py-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="grid content-start gap-4" aria-labelledby="draw-title">
        <header className="grid gap-1">
          <h1 id="draw-title" className="m-0 text-3xl">
            {t.title}
          </h1>
          <p className="m-0 text-muted-foreground">{t.lead}</p>
        </header>

        <svg
          ref={svgRef}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t.fieldLabel}
          data-testid="draw-field"
          className="block w-full cursor-crosshair touch-none rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card select-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerCancel={end}
        >
          {Array.from({ length: Math.floor(WIDTH / GRID) - 1 }, (_, i) => (
            <line key={`v${i}`} x1={(i + 1) * GRID} x2={(i + 1) * GRID} y1={0} y2={HEIGHT} stroke="var(--border)" strokeWidth={1} />
          ))}
          {Array.from({ length: Math.floor(HEIGHT / GRID) - 1 }, (_, i) => (
            <line key={`h${i}`} y1={(i + 1) * GRID} y2={(i + 1) * GRID} x1={0} x2={WIDTH} stroke="var(--border)" strokeWidth={1} />
          ))}
          {points.length > 1 && (
            <polyline
              points={points.map((p) => `${p.x},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke="var(--text-3)"
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={0.45}
            />
          )}
          {route?.primitives.map((p, i) => (
            <path key={i} d={primitivePath(p)} fill="none" stroke="var(--link)" strokeWidth={7} strokeLinecap="round" data-testid="route-piece" />
          ))}
          {driven.length > 1 && (
            <polyline
              points={driven.map((p) => `${p.x},${sy(p.y)}`).join(' ')}
              fill="none"
              stroke="var(--accent)"
              strokeWidth={9}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          <g transform={`translate(${pose.x} ${sy(pose.y)}) rotate(${-pose.heading})`}>
            <rect x={-hl} y={-hw} width={hl * 2} height={hw * 2} rx={18} fill="var(--accent)" stroke="var(--outline)" strokeWidth={6} />
            <path d={`M${hl - 12} 0L${hl - 44} -24L${hl - 44} 24Z`} fill="var(--on-accent)" />
          </g>
        </svg>

        <label className="grid gap-1 font-bold">
          {t.precision}
          <input type="range" min={0} max={100} step={5} value={precision} onChange={(e) => setPrecision(Number(e.target.value))} />
          <span className="flex justify-between text-sm font-normal text-muted-foreground">
            <span>{t.fewer}</span>
            <span>{t.closer}</span>
          </span>
        </label>

        {/* Drive motors of this robot: saved with the studio's robot settings, so both use the same ports. */}
        <div
          role="group"
          aria-labelledby="drive-motors"
          className="grid gap-2.5 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-3 sm:p-4"
        >
          <p id="drive-motors" className="m-0 font-bold">
            {t.motorsTitle}
          </p>
          {(['leftMotor', 'rightMotor'] as const).map((side) => {
            const label = side === 'leftMotor' ? t.leftMotor : t.rightMotor
            const other = side === 'leftMotor' ? robot.rightMotor : robot.leftMotor
            return (
              <div key={side} role="radiogroup" aria-label={label} className="grid items-center gap-1.5 sm:grid-cols-[7.5rem_minmax(0,1fr)] sm:gap-3">
                <span className="text-sm font-bold">{label}</span>
                <div className="grid grid-cols-6 gap-1 rounded-(--radius-sm) bg-surface-2 p-1">
                  {PORTS.map((port) => {
                    const on = robot[side] === port
                    return (
                      <button
                        key={port}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        aria-label={`${label}: ${port}`}
                        title={port === other ? t.swap : undefined}
                        onClick={() => pickMotor(side, port)}
                        className={cn(
                          'relative min-h-10 rounded-[10px] border-(length:--stroke-thin) font-display font-extrabold transition-colors',
                          on
                            ? 'border-outline bg-primary text-primary-foreground shadow-(--shadow-press)'
                            : 'border-transparent text-muted-foreground hover:bg-card',
                        )}
                      >
                        {port}
                        {port === other && <span aria-hidden="true" className="absolute top-1 right-1.5 size-1.5 rounded-full bg-muted-foreground/60" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
          <p className="m-0 text-sm text-muted-foreground">{t.motorsNote}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonVariants({ variant: 'primary' })} disabled={!program} onClick={drive}>
            <Play aria-hidden="true" />
            {t.drive}
          </button>
          <button type="button" className={buttonVariants()} disabled={points.length === 0} onClick={() => setPoints([])}>
            <Eraser aria-hidden="true" />
            {t.clear}
          </button>
        </div>
        {hitWall && (
          <p className="alert alert-warn m-0" role="status">
            {t.hitWall}
          </p>
        )}
      </section>

      {/* minmax(0,1fr): long code lines scroll inside their box instead of widening the page. */}
      <section className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-4" aria-label={t.resultLabel}>
        {!program ? (
          <Card className="items-start gap-2">
            <RouteIcon className="size-7" aria-hidden="true" />
            <p className="m-0 text-muted-foreground">{t.empty}</p>
          </Card>
        ) : (
          <>
            <Card className="min-w-0 gap-3">
              <CardTitle>{fill(t.commands, { n: countSteps(program.steps) })}</CardTitle>
              <div className="segmented" role="group" aria-label={t.viewLabel}>
                <button type="button" aria-pressed={view === 'blocks'} onClick={() => setView('blocks')}>
                  <strong>{t.blocks}</strong>
                </button>
                <button type="button" aria-pressed={view === 'python'} onClick={() => setView('python')}>
                  <strong>Python</strong>
                </button>
              </div>
              {view === 'blocks' ? (
                <div className="canvas">
                  <BlockStack program={program} labels={labels} />
                </div>
              ) : (
                <CodeView code={code} label="Python" />
              )}
            </Card>
            <RobotPanel lang={lang}>
              {!sim && <p className="m-0 text-sm font-bold text-muted-foreground">{t.driveFirst}</p>}
              <SendToRobot lang={lang} code={code} size="md" />
            </RobotPanel>
          </>
        )}
      </section>
    </div>
  )
}
