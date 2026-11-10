import Link from 'next/link'
import { Check, Clock, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

export type NodeState = 'done' | 'current' | 'open' | 'locked' | 'soon'

export interface TrailNode {
  label: string
  state: NodeState
  /** Makes the node a link (done, current and open lessons). */
  href?: string
}

/** Horizontal offsets of the winding trail (fractions of the half-width). */
const SWING = [0, 0.45, 0.7, 0.45, 0, -0.45, -0.7, -0.45]
const ROW = 104
const WIDTH = 320

/**
 * A winding trail of lesson nodes (done ✓, current, open, locked) with a
 * station title. Pure markup, so it renders on the server; used as the
 * landing illustration now and as the track map later.
 */
export function PathTrail({
  nodes,
  station,
  className,
  stateLabels,
}: {
  nodes: TrailNode[]
  station?: string
  className?: string
  stateLabels?: Partial<Record<NodeState, string>>
}) {
  const height = nodes.length * ROW + 40
  const points = nodes.map((_, i) => ({ x: WIDTH / 2 + SWING[i % SWING.length] * (WIDTH / 2 - 56), y: 72 + i * ROW }))
  const d = points.reduce((acc, p, i) => {
    if (i === 0) return `M${p.x} ${p.y}`
    const prev = points[i - 1]
    const my = (prev.y + p.y) / 2
    return `${acc} C${prev.x} ${my} ${p.x} ${my} ${p.x} ${p.y}`
  }, '')
  const doneUntil = nodes.findIndex((n) => n.state !== 'done')

  return (
    <div className={cn('relative mx-auto w-full max-w-[340px]', className)} style={{ aspectRatio: `${WIDTH} / ${height}` }}>
      <svg className="absolute inset-0 size-full" viewBox={`0 0 ${WIDTH} ${height}`} aria-hidden="true">
        <path d={d} fill="none" stroke="var(--outline)" strokeWidth="16" strokeLinecap="round" opacity="0.12" />
        <path d={d} fill="none" stroke="var(--border-strong)" strokeWidth="6" strokeLinecap="round" strokeDasharray="2 14" />
        {doneUntil !== 0 && (
          <path
            d={d}
            fill="none"
            stroke="var(--success)"
            strokeWidth="6"
            strokeLinecap="round"
            pathLength={100}
            strokeDasharray={`${(Math.max(0, doneUntil === -1 ? nodes.length - 1 : doneUntil) / Math.max(1, nodes.length - 1)) * 100} 100`}
          />
        )}
      </svg>

      {station && (
        <span className="absolute top-0 left-1/2 -translate-x-1/2 rounded-full border-(length:--stroke-thin) border-outline bg-primary px-3 py-1 font-display text-sm font-extrabold whitespace-nowrap text-primary-foreground shadow-(--shadow-press)">
          {station}
        </span>
      )}

      <ol className="m-0 list-none p-0">
        {nodes.map((n, i) => {
          const p = points[i]
          // Label on the side with more room: nodes in the middle or on the left get it on the right.
          const left = p.x <= WIDTH / 2 + 1
          return (
            <li
              key={i}
              className="absolute flex -translate-x-1/2 -translate-y-1/2 items-center"
              style={{ left: `${(p.x / WIDTH) * 100}%`, top: `${(p.y / height) * 100}%` }}
              aria-label={n.href ? undefined : stateLabels?.[n.state] ? `${n.label} — ${stateLabels[n.state]}` : n.label}
            >
              {n.href ? (
                <Link href={n.href} className="rounded-full" aria-label={stateLabels?.[n.state] ? `${n.label} — ${stateLabels[n.state]}` : n.label}>
                  <span
                    className={cn(
                      'relative grid size-14 shrink-0 place-items-center rounded-full border-(length:--stroke) border-outline font-display text-lg font-extrabold',
                      n.state === 'done' && 'bg-success text-background shadow-(--shadow-hard-sm)',
                      n.state === 'current' && 'bg-primary text-primary-foreground shadow-(--shadow-hard)',
                      n.state === 'open' && 'bg-card text-foreground shadow-(--shadow-hard-sm)',
                      (n.state === 'locked' || n.state === 'soon') && 'border-dashed bg-surface-2 text-muted-foreground',
                      n.href && 'transition-transform hover:-translate-y-0.5',
                    )}
                  >
                    {n.state === 'current' && (
                      <span
                        aria-hidden="true"
                        className="absolute -inset-2 animate-ping rounded-full border-(length:--stroke-thin) border-(--accent) opacity-60 motion-reduce:hidden"
                      />
                    )}
                    {n.state === 'done' ? (
                      <Check className="size-6" strokeWidth={3} aria-hidden="true" />
                    ) : n.state === 'locked' ? (
                      <Lock className="size-5" aria-hidden="true" />
                    ) : n.state === 'soon' ? (
                      <Clock className="size-5" aria-hidden="true" />
                    ) : (
                      i + 1
                    )}
                  </span>
                </Link>
              ) : (
                <span
                  className={cn(
                    'relative grid size-14 shrink-0 place-items-center rounded-full border-(length:--stroke) border-outline font-display text-lg font-extrabold',
                    n.state === 'done' && 'bg-success text-background shadow-(--shadow-hard-sm)',
                    n.state === 'current' && 'bg-primary text-primary-foreground shadow-(--shadow-hard)',
                    n.state === 'open' && 'bg-card text-foreground shadow-(--shadow-hard-sm)',
                    (n.state === 'locked' || n.state === 'soon') && 'border-dashed bg-surface-2 text-muted-foreground',
                    n.href && 'transition-transform hover:-translate-y-0.5',
                  )}
                >
                  {n.state === 'current' && (
                    <span
                      aria-hidden="true"
                      className="absolute -inset-2 animate-ping rounded-full border-(length:--stroke-thin) border-(--accent) opacity-60 motion-reduce:hidden"
                    />
                  )}
                  {n.state === 'done' ? (
                    <Check className="size-6" strokeWidth={3} aria-hidden="true" />
                  ) : n.state === 'locked' ? (
                    <Lock className="size-5" aria-hidden="true" />
                  ) : n.state === 'soon' ? (
                    <Clock className="size-5" aria-hidden="true" />
                  ) : (
                    i + 1
                  )}
                </span>
              )}
              <span
                className={cn(
                  'absolute top-1/2 w-max max-w-32 min-[400px]:max-w-36 -translate-y-1/2 rounded-(--radius-xs) bg-card px-2 py-1 text-[0.8125rem] leading-tight font-bold shadow-(--shadow-press) border-(length:--stroke-thin) border-outline',
                  left ? 'left-[calc(100%+10px)]' : 'right-[calc(100%+10px)] text-right',
                  (n.state === 'locked' || n.state === 'soon') && 'text-muted-foreground',
                )}
              >
                {n.label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
