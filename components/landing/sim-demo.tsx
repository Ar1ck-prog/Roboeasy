'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Check, Play, RotateCcw } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * The landing's virtual robot: a tiny program drives the robot around a
 * wall to the finish, highlighting each block as it runs. Frames are drawn
 * with requestAnimationFrame by writing SVG attributes directly (no React
 * render per frame); it plays once when scrolled into view and again on the play button.
 */

export interface SimDemoCopy {
  title: string
  run: string
  again: string
  done: string
  start: string
  finish: string
  /** Block labels, in program order (6). */
  blocks: string[]
}

type Pt = readonly [number, number]
const P: Pt[] = [
  [58, 160],
  [58, 42],
  [262, 42],
  [262, 160],
]
const SPEED = 150 // units per second
const TURN = 0.45 // seconds per 90° turn

type Seg =
  | { kind: 'pause'; dur: number; block: number }
  | { kind: 'move'; dur: number; block: number; a: Pt; b: Pt }
  | { kind: 'turn'; dur: number; block: number; at: Pt; from: number; to: number }

const dist = (a: Pt, b: Pt) => Math.hypot(b[0] - a[0], b[1] - a[1])
const SEGS: Seg[] = [
  { kind: 'pause', dur: 0.45, block: 0 },
  { kind: 'move', dur: dist(P[0], P[1]) / SPEED, block: 1, a: P[0], b: P[1] },
  { kind: 'turn', dur: TURN, block: 2, at: P[1], from: -90, to: 0 },
  { kind: 'move', dur: dist(P[1], P[2]) / SPEED, block: 3, a: P[1], b: P[2] },
  { kind: 'turn', dur: TURN, block: 4, at: P[2], from: 0, to: 90 },
  { kind: 'move', dur: dist(P[2], P[3]) / SPEED, block: 5, a: P[2], b: P[3] },
]
const TOTAL = SEGS.reduce((s, x) => s + x.dur, 0)
const LENGTH = dist(P[0], P[1]) + dist(P[1], P[2]) + dist(P[2], P[3])
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Robot pose, distance travelled and active block at time t (seconds). */
function frame(t: number): { x: number; y: number; h: number; travelled: number; block: number } {
  let left = Math.max(0, t)
  let travelled = 0
  let pose = { x: P[0][0], y: P[0][1], h: -90 }
  for (const s of SEGS) {
    const k = Math.min(1, left / s.dur)
    const e = ease(k)
    if (s.kind === 'move') {
      pose = { x: s.a[0] + (s.b[0] - s.a[0]) * e, y: s.a[1] + (s.b[1] - s.a[1]) * e, h: pose.h }
      travelled += dist(s.a, s.b) * e
    } else if (s.kind === 'turn') pose = { x: s.at[0], y: s.at[1], h: s.from + (s.to - s.from) * e }
    if (left <= s.dur) return { ...pose, travelled, block: s.block }
    left -= s.dur
  }
  return { ...pose, travelled, block: SEGS[SEGS.length - 1].block }
}

const BLOCK_COLORS = ['var(--blk-events)', 'var(--blk-move)', 'var(--blk-motor)', 'var(--blk-move)', 'var(--blk-motor)', 'var(--blk-move)']

export function SimDemo({ t }: { t: SimDemoCopy }) {
  const root = useRef<HTMLDivElement>(null)
  const robot = useRef<SVGGElement>(null)
  const trail = useRef<SVGPathElement>(null)
  const blocks = useRef<(HTMLLIElement | null)[]>([])
  const raf = useRef(0)
  const [state, setState] = useState<'idle' | 'running' | 'done'>('idle')

  const draw = useCallback((time: number) => {
    const f = frame(time)
    robot.current?.setAttribute('transform', `translate(${f.x.toFixed(2)} ${f.y.toFixed(2)}) rotate(${f.h.toFixed(2)})`)
    trail.current?.setAttribute('stroke-dashoffset', (LENGTH - f.travelled).toFixed(2))
    blocks.current.forEach((el, i) => el?.toggleAttribute('data-active', time > 0 && i === f.block && time < TOTAL))
  }, [])

  const run = useCallback(() => {
    cancelAnimationFrame(raf.current)
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      draw(TOTAL)
      setState('done')
      return
    }
    setState('running')
    const start = performance.now()
    const tick = (now: number) => {
      const time = (now - start) / 1000
      draw(Math.min(time, TOTAL))
      if (time < TOTAL) raf.current = requestAnimationFrame(tick)
      else setState('done')
    }
    raf.current = requestAnimationFrame(tick)
  }, [draw])

  // First frame, then play once when the demo scrolls into view.
  useEffect(() => {
    draw(0)
    const el = root.current
    if (!el || !('IntersectionObserver' in window)) return
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect()
          run()
        }
      },
      { threshold: 0.6 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(raf.current)
    }
  }, [draw, run])

  return (
    <div ref={root} className="grid gap-4 md:grid-cols-[minmax(0,15rem)_1fr] md:items-start">
      <div className="order-2 grid gap-3 md:order-1">
        <ol className="m-0 grid list-none gap-1.5 p-0" aria-label={t.title}>
          {t.blocks.map((b, i) => (
            <li
              key={i}
              ref={(el) => {
                blocks.current[i] = el
              }}
              className={cn(
                'relative rounded-(--radius-xs) border-(length:--stroke-thin) border-outline px-3 py-2 text-sm font-extrabold text-(--blk-text) transition-transform duration-200 motion-reduce:transition-none',
                'data-[active]:translate-x-1.5 data-[active]:shadow-[0_0_0_3px_var(--focus)]',
                i > 0 && 'ml-3',
              )}
              style={{ background: BLOCK_COLORS[i] }}
            >
              {b}
            </li>
          ))}
        </ol>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={run} disabled={state === 'running'}>
            {state === 'done' ? <RotateCcw aria-hidden="true" /> : <Play aria-hidden="true" />}
            {state === 'done' ? t.again : t.run}
          </button>
          <span
            role="status"
            className={cn(
              'inline-flex items-center gap-1.5 rounded-full border-(length:--stroke-thin) border-outline bg-(--ok-bg) px-3 py-1.5 text-sm font-extrabold text-success transition-[opacity,transform] duration-300 motion-reduce:transition-none',
              state === 'done' ? 'scale-100 opacity-100' : 'pointer-events-none scale-75 opacity-0',
            )}
          >
            <Check className="size-4" aria-hidden="true" />
            {t.done}
          </span>
        </div>
      </div>

      <div className="relative order-1 overflow-hidden rounded-(--radius-md) md:order-2">
        <svg
          viewBox="0 0 320 200"
          className="block h-auto w-full rounded-(--radius-md) border-(length:--stroke) border-outline bg-[#fbf7ef]"
          role="img"
          aria-label={t.title}
        >
          <defs>
            <pattern id="demo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <path d="M20 0H0V20" fill="none" stroke="#1b1f2a" strokeOpacity="0.08" strokeWidth="1.5" />
            </pattern>
            <pattern id="demo-flag" width="10" height="10" patternUnits="userSpaceOnUse">
              <rect width="10" height="10" fill="#fff" />
              <rect width="5" height="5" fill="#1b1f2a" />
              <rect x="5" y="5" width="5" height="5" fill="#1b1f2a" />
            </pattern>
          </defs>
          <rect width="320" height="200" fill="url(#demo-grid)" />
          {/* Start, wall, finish */}
          <rect x="26" y="128" width="64" height="58" rx="8" fill="#4a86f71f" stroke="#4a86f7" strokeWidth="3" strokeDasharray="7 6" />
          <text x="58" y="196" textAnchor="middle" fontSize="10" fontWeight="800" fill="#2f63c9">
            {t.start}
          </text>
          <rect x="150" y="72" width="20" height="128" rx="5" fill="#e8442e" stroke="#1b1f2a" strokeWidth="3" />
          <path d="M150 92 L170 104 M150 116 L170 128 M150 140 L170 152 M150 164 L170 176" stroke="#1b1f2a" strokeOpacity="0.25" strokeWidth="3" />
          <rect x="230" y="128" width="64" height="58" rx="8" fill="#2bb6731f" stroke="#2bb673" strokeWidth="3" />
          <rect x="250" y="140" width="24" height="24" fill="url(#demo-flag)" stroke="#1b1f2a" strokeWidth="2" />
          <text x="262" y="196" textAnchor="middle" fontSize="10" fontWeight="800" fill="#1d8a57">
            {t.finish}
          </text>
          {/* Planned route (faint) and the trail drawn as the robot drives */}
          <path
            d={`M${P.map((p) => p.join(' ')).join(' L')}`}
            fill="none"
            stroke="#1b1f2a"
            strokeOpacity="0.15"
            strokeWidth="3"
            strokeDasharray="4 7"
            strokeLinecap="round"
          />
          <path
            ref={trail}
            d={`M${P.map((p) => p.join(' ')).join(' L')}`}
            fill="none"
            stroke="#ffc531"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={LENGTH}
            strokeDashoffset={LENGTH}
          />
          {/* The robot, drawn facing east (rotate 0) */}
          <g ref={robot} transform={`translate(${P[0][0]} ${P[0][1]}) rotate(-90)`}>
            <rect x="-17" y="-19" width="30" height="8" rx="3" fill="#1b1f2a" />
            <rect x="-17" y="11" width="30" height="8" rx="3" fill="#1b1f2a" />
            <rect x="-18" y="-14" width="34" height="28" rx="7" fill="#4a86f7" stroke="#1b1f2a" strokeWidth="3" />
            <rect x="-6" y="-8" width="14" height="16" rx="4" fill="#1b1f2a" />
            <circle cx="3" cy="-3" r="2.2" fill="#9ef0ff" />
            <circle cx="3" cy="3" r="2.2" fill="#9ef0ff" />
            <path d="M17 -6 L24 0 L17 6 Z" fill="#1b1f2a" />
          </g>
        </svg>
        {state === 'done' && (
          <div className="pointer-events-none absolute right-[8%] bottom-[22%]" aria-hidden="true">
            {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
              <span
                key={i}
                className="demo-confetti"
                style={{ ['--a' as string]: `${i * 45}deg`, background: ['#ffc531', '#4a86f7', '#2bb673', '#e8442e'][i % 4] }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
