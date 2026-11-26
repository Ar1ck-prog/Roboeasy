'use client'

/**
 * The start of learning: LEGO WeDo 2.0 (6–9) or LEGO SPIKE Prime (9+). Two
 * big cards, one under the other on a phone. Our own drawings, no LEGO art.
 * `asRadio`: inside the onboarding form (radio buttons); otherwise a tap
 * picks the path right away.
 */

import { Check, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { WedoText } from '@/lib/i18n/wedo'
import type { AgeRange, LearningPathChoice } from '@/lib/learn/state'
import { cn } from '@/lib/utils'

/** A small friendly rover with a round hub (WeDo). */
function WedoArt() {
  return (
    <svg viewBox="0 0 160 100" className="h-24 w-auto" aria-hidden="true">
      <rect x="22" y="40" width="96" height="34" rx="12" fill="var(--wedo-accent)" stroke="var(--outline)" strokeWidth="3" />
      <rect x="34" y="22" width="44" height="24" rx="8" fill="var(--surface)" stroke="var(--outline)" strokeWidth="3" />
      <circle cx="48" cy="34" r="6" fill="var(--blk-sensors)" stroke="var(--outline)" strokeWidth="2" />
      <rect x="116" y="46" width="18" height="20" rx="6" fill="var(--blk-control)" stroke="var(--outline)" strokeWidth="3" />
      <circle cx="125" cy="52" r="2.5" fill="#14110a" />
      <circle cx="125" cy="60" r="2.5" fill="#14110a" />
      <circle cx="42" cy="78" r="12" fill="#1b1f2a" stroke="var(--outline)" strokeWidth="3" />
      <circle cx="98" cy="78" r="12" fill="#1b1f2a" stroke="var(--outline)" strokeWidth="3" />
    </svg>
  )
}

/** A bigger robot car with a square hub and a screen (SPIKE). */
function SpikeArt() {
  return (
    <svg viewBox="0 0 160 100" className="h-24 w-auto" aria-hidden="true">
      <rect x="18" y="44" width="124" height="30" rx="6" fill="var(--blk-motor)" stroke="var(--outline)" strokeWidth="3" />
      <rect x="48" y="12" width="56" height="38" rx="6" fill="var(--surface)" stroke="var(--outline)" strokeWidth="3" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} x={62 + c * 10} y={20 + r * 9} width="6" height="6" rx="1" fill={(r + c) % 2 ? 'var(--blk-events)' : 'var(--surface-3)'} />))}
      <rect x="140" y="50" width="12" height="18" rx="3" fill="var(--blk-sensors)" stroke="var(--outline)" strokeWidth="3" />
      <circle cx="40" cy="80" r="14" fill="#1b1f2a" stroke="var(--outline)" strokeWidth="3" />
      <circle cx="120" cy="80" r="14" fill="#1b1f2a" stroke="var(--outline)" strokeWidth="3" />
    </svg>
  )
}

export function PathPicker({
  wt,
  ageRange,
  value,
  onPick,
  asRadio = false,
  name = 'learning-path',
  showHeader = true,
}: {
  wt: WedoText
  ageRange?: AgeRange | null
  value?: LearningPathChoice | null
  onPick: (path: LearningPathChoice) => void
  asRadio?: boolean
  name?: string
  showHeader?: boolean
}) {
  const t = wt.picker
  const cards = [
    { id: 'wedo' as const, title: t.wedoTitle, text: t.wedoText, art: <WedoArt />, tint: 'bg-(--wedo-accent-soft)', recommend: ageRange === 'under-10' },
    { id: 'spike' as const, title: t.spikeTitle, text: t.spikeText, art: <SpikeArt />, tint: 'bg-card', recommend: false },
  ]

  return (
    <div className="grid gap-4">
      {showHeader && (
        <header className="grid gap-2">
          <h2 className="m-0 text-3xl md:text-4xl">{t.title}</h2>
          <p className="m-0 text-lg text-muted-foreground">{t.lead}</p>
        </header>
      )}
      <div className="grid gap-4 md:grid-cols-2" role={asRadio ? 'radiogroup' : undefined} aria-label={asRadio ? t.title : undefined}>
        {cards.map((c) => {
          const chosen = value === c.id
          const inner = (
            <>
              <div className="flex flex-wrap items-start justify-between gap-2">
                {c.art}
                {c.recommend && (
                  <Badge variant="success">
                    <Sparkles aria-hidden="true" />
                    {t.startHere}
                  </Badge>
                )}
              </div>
              <span className="font-display text-2xl font-extrabold md:text-3xl">{c.title}</span>
              <span className="text-lg">{c.text}</span>
              <span className={cn('mt-auto inline-flex min-h-12 items-center gap-2 justify-self-start rounded-(--radius-sm) border-(length:--stroke) border-outline px-5 font-extrabold shadow-(--shadow-press)', chosen ? 'bg-primary text-primary-foreground' : 'bg-card')}>
                {chosen && <Check className="size-5" aria-hidden="true" />}
                {chosen ? t.chosen : t.choose}
              </span>
            </>
          )
          const cls = cn(
            'grid min-h-64 cursor-pointer gap-3 rounded-(--radius-xl) border-(length:--stroke) border-outline p-5 text-left shadow-(--shadow-hard) transition-transform duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-6',
            c.tint,
            chosen && 'ring-4 ring-(--focus)',
          )
          return asRadio ? (
            <label key={c.id} className={cn(cls, 'has-focus-visible:ring-4 has-focus-visible:ring-(--focus)')} data-testid={`path-${c.id}`}>
              <input type="radio" name={name} value={c.id} checked={chosen} onChange={() => onPick(c.id)} className="sr-only" />
              {inner}
            </label>
          ) : (
            <button key={c.id} type="button" className={cn(cls, 'focus-visible:ring-4 focus-visible:ring-(--focus) focus-visible:outline-none')} onClick={() => onPick(c.id)} data-testid={`path-${c.id}`}>
              {inner}
            </button>
          )
        })}
      </div>
      <p className="m-0 text-sm text-muted-foreground">{t.note}</p>
    </div>
  )
}
