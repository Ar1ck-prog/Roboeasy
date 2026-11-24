'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, Volume2 } from 'lucide-react'

import { FieldFrame, Label } from '@/components/fll/field-shapes'
import { buttonVariants } from '@/components/ui/button'
import { svgPoints } from '@/lib/fll/geometry'
import { AnimIcon } from '@/components/ui/anim-icon'
import { colorHex, stickerIcon } from '@/lib/learn/shop'
import type { Point } from '@/lib/fll/season'
import type { SimField } from '@/lib/sim/field'
import { ROBOT_SHAPE } from '@/lib/sim/robot'
import type { Port } from '@/lib/dsl/types'
import { type SimResult, displayAt, motorAnglesAt, poseAt, stepAt } from '@/lib/sim/interpreter'
import { cn } from '@/lib/utils'

const SENSOR_FILL: Record<string, string> = {
  black: '#1b1f2a',
  violet: '#8e44ad',
  blue: '#2f6fed',
  azure: '#3fc6e8',
  green: '#2bb673',
  yellow: '#ffc531',
  red: '#e8442e',
  white: '#ffffff',
  none: 'transparent',
}

/** Zone captions sit just outside the zone (above it, or below when at the top edge), so the robot never covers them. */
function zoneLabelY(z: { y: number; h: number }, height: number) {
  if (z.y + z.h + 50 <= height) return z.y + z.h + 28
  if (z.y >= 50) return z.y - 28
  return z.y + z.h - 26
}

export interface PathOverlay {
  points: Point[]
  color: string
  label: string
  active?: boolean
}

interface SimViewProps {
  field: SimField
  /** The run to play; null shows the robot at the start. */
  result: SimResult | null
  lang: 'ru' | 'kk' | 'en'
  /** Candidate paths (predict steps). */
  paths?: PathOverlay[]
  /** Called with the running step path ("2.0") during playback, null at the end. */
  onStep?: (path: string | null) => void
  onEnd?: () => void
  autoPlay?: boolean
  robotColor?: string
  sticker?: string
  /** classic | offroad | racing | gold (lib/learn/shop.ts) */
  wheels?: string
  labels: { play: string; pause: string; restart: string; speed: string; time: string }
  /** Attachment motors the program uses: drawn as dials even before the run. */
  motors?: Port[]
  /** Playback starts here (seconds): a run that continues an earlier one shows only the new part. */
  from?: number
  className?: string
}

/** Field, robot and playback of a simulator run. */
export function SimView({
  field,
  result,
  lang,
  paths = [],
  onStep,
  onEnd,
  autoPlay = true,
  robotColor = 'sun',
  sticker,
  wheels = 'classic',
  labels,
  motors = [],
  from = 0,
  className,
}: SimViewProps) {
  const [t, setT] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [speed, setSpeed] = useState(1)
  const raf = useRef<number | null>(null)
  const last = useRef<number | null>(null)
  const end = result?.final.t ?? 0
  const onStepRef = useRef(onStep)
  const onEndRef = useRef(onEnd)
  useEffect(() => {
    onStepRef.current = onStep
    onEndRef.current = onEnd
  })

  // New run: rewind and (optionally) play.
  useEffect(() => {
    setT(Math.min(from, result?.final.t ?? 0))
    setPlaying(!!result && autoPlay)
    // `from` belongs to the run: it changes together with the result.
  }, [result, autoPlay])

  useEffect(() => {
    if (!playing || !result) return
    const tick = (now: number) => {
      const dt = last.current === null ? 0 : (now - last.current) / 1000
      last.current = now
      setT((prev) => {
        const next = Math.min(end, prev + dt * speed)
        if (next >= end) {
          setPlaying(false)
          onEndRef.current?.()
        }
        return next
      })
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
    return () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current)
      last.current = null
    }
  }, [playing, result, end, speed])

  useEffect(() => {
    if (!result) return
    onStepRef.current?.(t >= end && !playing ? null : stepAt(result.events, t))
  }, [t, result, end, playing])

  const pose = result ? poseAt(result.trace, t) : field.start
  const shown = result ? displayAt(result.events, t) : { pixels: null }
  const angles = result ? motorAnglesAt(result.events, t) : {}
  const dials = [...new Set([...motors, ...(Object.keys(angles) as Port[])])].sort()
  const beeping = !!result?.events.some((e) => e.kind === 'beep' && t >= e.t && t <= e.t + Math.max(0.25, e.seconds))
  const travelled = useMemo(() => (result ? result.trace.filter((p) => p.t <= t) : []), [result, t])

  const W = field.width
  const H = field.height
  const grid = 100
  const color = colorHex(robotColor)

  return (
    <div className={cn('grid gap-2', className)}>
      <div className="relative overflow-hidden rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-[#fbf7ef]">
        <svg viewBox={`-20 -20 ${W + 40} ${H + 40}`} className="block h-auto w-full" role="img" aria-label={labels.time}>
          <defs>
            <pattern id="sim-grid" width={grid} height={grid} patternUnits="userSpaceOnUse" y={H % grid}>
              <path d={`M${grid} 0H0V${grid}`} fill="none" stroke="#1b1f2a" strokeOpacity="0.09" strokeWidth="2" />
            </pattern>
            <pattern id="sim-hatch" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M0 0V28" stroke="#1b1f2a" strokeWidth="8" opacity="0.35" />
            </pattern>
          </defs>
          <rect x="0" y="0" width={W} height={H} fill="#ffffff" stroke="#1b1f2a" strokeWidth={field.border ? 8 : 2} rx="10" />
          <rect x="0" y="0" width={W} height={H} fill="url(#sim-grid)" />
          <FieldFrame height={H}>
            {field.zones.map((z) => (
              <g key={z.id}>
                <rect
                  x={z.x}
                  y={z.y}
                  width={z.w}
                  height={z.h}
                  rx="10"
                  fill={z.color ? SENSOR_FILL[z.color] : z.kind === 'target' ? 'rgba(43,182,115,0.16)' : 'rgba(47,111,237,0.12)'}
                  stroke={z.color ? 'none' : z.kind === 'target' ? '#157a47' : '#2560d8'}
                  strokeWidth="5"
                  strokeDasharray={z.color ? undefined : '18 12'}
                />
                {z.label && (
                  <Label
                    at={{ x: z.x + z.w / 2, y: zoneLabelY(z, H) }}
                    size={30}
                    className="fill-[#1b1f2a] stroke-[#fbf7ef] stroke-[10px] font-extrabold [paint-order:stroke]"
                  >
                    {z.label[lang]}
                  </Label>
                )}
              </g>
            ))}
            {field.lines.map((l, i) => (
              <polyline
                key={i}
                points={l.points.map(([x, y]) => `${x},${y}`).join(' ')}
                fill="none"
                stroke={SENSOR_FILL[l.color]}
                strokeWidth={l.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {field.walls.map((w, i) => (
              <g key={i}>
                <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="#e8442e" stroke="#1b1f2a" strokeWidth="5" rx="4" />
                <rect x={w.x} y={w.y} width={w.w} height={w.h} fill="url(#sim-hatch)" rx="4" />
              </g>
            ))}
            {field.points.map((p) => (
              <g key={p.id}>
                <circle cx={p.x} cy={p.y} r={p.r} fill="rgba(255,197,49,0.25)" stroke="#8a5a00" strokeWidth="5" strokeDasharray="12 9" />
                {p.label && (
                  <Label at={{ x: p.x, y: p.y }} size={34} className="fill-[#8a5a00] font-extrabold">
                    {p.label[lang]}
                  </Label>
                )}
              </g>
            ))}

            {paths.map((p, i) => (
              <g key={i} opacity={p.active === false ? 0.35 : 1}>
                <polyline
                  points={svgPoints(p.points)}
                  fill="none"
                  stroke={p.color}
                  strokeWidth="14"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={p.active ? undefined : '26 16'}
                />
                {p.points.length > 0 && (
                  <g>
                    <circle cx={p.points[p.points.length - 1].x} cy={p.points[p.points.length - 1].y} r="34" fill={p.color} stroke="#1b1f2a" strokeWidth="5" />
                    <Label at={p.points[p.points.length - 1]} size={34} className="fill-white font-extrabold">
                      {p.label}
                    </Label>
                  </g>
                )}
              </g>
            ))}

            {travelled.length > 1 && (
              <polyline
                points={svgPoints(travelled.concat([{ ...pose, t }]))}
                fill="none"
                stroke="#2560d8"
                strokeWidth="10"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.8"
              />
            )}

            {/* Robot: body, wheels, colour sensor, heading arrow */}
            <g transform={`translate(${pose.x} ${pose.y}) rotate(${pose.heading})`}>
              {[-1, 1].map((side) => {
                const big = wheels === 'offroad'
                const w = big ? 84 : 70
                const h = big ? 30 : 22
                const y = side < 0 ? -ROBOT_SHAPE.width / 2 - h + 4 : ROBOT_SHAPE.width / 2 - 4
                return (
                  <g key={side}>
                    <rect x={-ROBOT_SHAPE.length / 2 - (big ? 7 : 0)} y={y} width={w} height={h} rx="6" fill="#1b1f2a" />
                    {big && (
                      <path
                        d={Array.from({ length: 6 }, (_, i) => `M${-ROBOT_SHAPE.length / 2 + 4 + i * 13} ${y + 3}v${h - 6}`).join('')}
                        stroke="#5b6275"
                        strokeWidth="4"
                      />
                    )}
                    {(wheels === 'racing' || wheels === 'gold') && (
                      <rect
                        x={-ROBOT_SHAPE.length / 2 + 6}
                        y={y + h / 2 - 3}
                        width={w - 12}
                        height={6}
                        rx="3"
                        fill={wheels === 'gold' ? '#e9b949' : '#ffc531'}
                      />
                    )}
                  </g>
                )
              })}
              <rect
                x={-ROBOT_SHAPE.length / 2}
                y={-ROBOT_SHAPE.width / 2}
                width={ROBOT_SHAPE.length}
                height={ROBOT_SHAPE.width}
                rx="18"
                fill={color}
                stroke="#1b1f2a"
                strokeWidth="7"
              />
              <rect x={-30} y={-34} width={60} height={68} rx="10" fill="#fff7e8" stroke="#1b1f2a" strokeWidth="4" />
              {stickerIcon(sticker ?? 'none') && (
                <g transform="scale(1 -1)">
                  <AnimIcon name={stickerIcon(sticker ?? 'none')!} x={-24} y={-16} width={40} height={40} style={{ color: '#1b1f2a' }} />
                </g>
              )}
              {dials.slice(0, 2).map((port, i, all) => (
                <g key={port} transform={`translate(${-ROBOT_SHAPE.length / 2 + 30} ${all.length > 1 ? (i ? 30 : -30) : 0})`}>
                  <circle r="21" fill="#4a86f7" stroke="#1b1f2a" strokeWidth="4" />
                  {/* The field is drawn upside down (y up): minus keeps clockwise looking clockwise; at 0° the arm points forward. */}
                  <g transform={`rotate(${-(angles[port] ?? 0)})`}>
                    <rect x="-12" y="-6" width="40" height="12" rx="6" fill="#ffc531" stroke="#1b1f2a" strokeWidth="3.5" />
                    <circle cx="21" r="2.6" fill="#1b1f2a" />
                  </g>
                  <circle r="5" fill="#1b1f2a" />
                </g>
              ))}
              <circle cx={ROBOT_SHAPE.colorSensorAhead} cy={0} r="10" fill="#2bb673" stroke="#1b1f2a" strokeWidth="4" />
              <path d={`M${ROBOT_SHAPE.length / 2 - 6} -22 L${ROBOT_SHAPE.length / 2 + 26} 0 L${ROBOT_SHAPE.length / 2 - 6} 22 Z`} fill="#1b1f2a" />
            </g>
          </FieldFrame>
        </svg>

        {/* The hub's 5×5 display and sound */}
        <div className="pointer-events-none absolute top-2 right-2 flex items-center gap-2">
          {beeping && (
            <span className="grid size-8 place-items-center rounded-full border-2 border-[#1b1f2a] bg-[#f06fb4] text-[#14110a]">
              <Volume2 className="size-4" aria-hidden="true" />
            </span>
          )}
          <span className="grid grid-cols-5 gap-[2px] rounded-md border-2 border-[#1b1f2a] bg-[#1b1f2a] p-1" aria-hidden="true">
            {Array.from({ length: 25 }, (_, i) => {
              const v = shown.pixels ? Number(shown.pixels[i] ?? 0) : 0
              return (
                <i key={i} className="block size-2 rounded-[2px]" style={{ background: v > 0 ? `rgba(255,197,49,${0.25 + (v / 9) * 0.75})` : '#2a3042' }} />
              )
            })}
          </span>
        </div>
        {/* Attachment motors: a dial per port. The hand turns with the motor, the shaded part is how far
            it has turned in this turn, the badge counts full turns. */}
        {dials.length > 0 && (
          <div className="pointer-events-none absolute bottom-3 left-3 flex gap-2 sm:bottom-4 sm:left-4" aria-hidden="true">
            {dials.map((port) => {
              const angle = angles[port] ?? 0
              const turns = Math.trunc(Math.abs(angle) / 360)
              const part = Math.abs(angle) % 360
              const sweep = part === 0 && turns > 0 ? 360 : part
              const end = (Math.sign(angle) * sweep * Math.PI) / 180
              const arc =
                sweep >= 359.5
                  ? 'M0 0m-17 0a17 17 0 1 0 34 0a17 17 0 1 0 -34 0'
                  : `M0 0L0 -17A17 17 0 ${sweep > 180 ? 1 : 0} ${angle >= 0 ? 1 : 0} ${17 * Math.sin(end)} ${-17 * Math.cos(end)}Z`
              return (
                <span
                  key={port}
                  className="relative grid justify-items-center gap-1 rounded-xl border-2 border-[#1b1f2a] bg-white/95 px-2 pt-2 pb-1.5 shadow-[3px_3px_0_#1b1f2a]"
                >
                  <svg viewBox="-24 -24 48 48" className="size-12 sm:size-16">
                    <circle r="21" fill="#e6efff" stroke="#1b1f2a" strokeWidth="3" />
                    {sweep > 0 && <path d={arc} fill="#4a86f7" />}
                    {Array.from({ length: 12 }, (_, i) => (
                      <path
                        key={i}
                        d={i % 3 ? 'M0 -21 V-18.5' : 'M0 -21 V-16'}
                        stroke="#1b1f2a"
                        strokeWidth={i % 3 ? 1.5 : 2.5}
                        transform={`rotate(${i * 30})`}
                      />
                    ))}
                    <g transform={`rotate(${angle})`}>
                      <path d="M0 4 V-16" stroke="#1b1f2a" strokeWidth="7" strokeLinecap="round" />
                      <path d="M0 4 V-16" stroke="#ffc531" strokeWidth="4" strokeLinecap="round" />
                    </g>
                    <circle r="4.5" fill="#1b1f2a" />
                  </svg>
                  <span className="font-mono text-[11px] leading-none font-bold text-[#1b1f2a] tabular-nums sm:text-xs">
                    {port} · {Math.round(angle)}°
                  </span>
                  {turns > 0 && (
                    <span className="absolute -top-2 -right-2 rounded-full border-2 border-[#1b1f2a] bg-[#ffc531] px-1.5 font-mono text-[11px] leading-4 font-extrabold text-[#1b1f2a]">
                      ×{turns}
                    </span>
                  )}
                </span>
              )
            })}
          </div>
        )}
        {shown.text && <span className="absolute top-12 right-2 rounded bg-[#1b1f2a] px-2 py-0.5 font-mono text-xs text-[#ffc531]">{shown.text}</span>}
      </div>

      {result && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={buttonVariants({ size: 'icon-sm' })}
            aria-label={playing ? labels.pause : labels.play}
            title={playing ? labels.pause : labels.play}
            onClick={() => (t >= end ? (setT(0), setPlaying(true)) : setPlaying((p) => !p))}
          >
            {playing ? <Pause aria-hidden="true" /> : <Play aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
            aria-label={labels.restart}
            title={labels.restart}
            onClick={() => (setT(0), setPlaying(true))}
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <input
            type="range"
            min={0}
            max={end || 0.01}
            step={0.01}
            value={t}
            onChange={(e) => (setPlaying(false), setT(Number(e.target.value)))}
            aria-label={labels.time}
            className="min-w-24 flex-1 accent-(--link)"
          />
          <span className="font-mono text-sm font-semibold tabular-nums">{t.toFixed(1)} s</span>
          <button
            type="button"
            className={buttonVariants({ size: 'sm', variant: 'ghost' })}
            aria-label={labels.speed}
            onClick={() => setSpeed((s) => (s === 1 ? 2 : s === 2 ? 0.5 : 1))}
          >
            {speed}×
          </button>
        </div>
      )}
    </div>
  )
}
