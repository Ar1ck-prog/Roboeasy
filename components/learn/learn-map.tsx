'use client'

import Link from 'next/link'
import { ArrowRight, Check, Clock, Gauge, Lock, PlayCircle } from 'lucide-react'

import { TrackIcon } from '@/components/learn/track-icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fill } from '@/lib/i18n/config'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import { COURSE } from '@/lib/learn/course'
import { nextLesson, trackHasContent, trackProgress } from '@/lib/learn/progress'
import { useHydrated } from '@/lib/learn/store'
import { useProgress } from '@/lib/learn/use-progress'
import { cn } from '@/lib/utils'

type Lang = 'ru' | 'kk' | 'en'

export function ProgressBar({ value, label, className }: { value: number; label: string; className?: string }) {
  return (
    <div
      className={cn('h-3 overflow-hidden rounded-full border-(length:--stroke-thin) border-outline bg-surface-2', className)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(value * 100)}
    >
      <div
        className="h-full rounded-full bg-success transition-[width] duration-500 motion-reduce:transition-none"
        style={{ width: `${Math.round(value * 100)}%` }}
      />
    </div>
  )
}

/** /learn: every track with its progress and lock state. */
export function LearnMap({ lang, app }: { lang: Lang; app: LearnAppText }) {
  const hydrated = useHydrated()
  const { done, state: learn } = useProgress()
  const tookPlacement = learn.events.some((e) => e.kind === 'known' && e.source === 'placement')
  const next = nextLesson(done, COURSE)

  return (
    <div className="container grid gap-8 py-8 md:py-12">
      <header className="grid gap-3">
        <h1 className="m-0 text-4xl md:text-5xl">{app.map.title}</h1>
        <p className="m-0 max-w-2xl text-lg text-muted-foreground">{app.map.lead}</p>
      </header>

      {/* One slot, same size for everyone, so nothing shifts after the progress loads: the test for new learners, the next lesson otherwise. */}
      {!hydrated || (done.size === 0 && !tookPlacement) ? (
        <Card className="flex-row flex-wrap items-center gap-4 bg-(--ok-bg)">
          <Gauge className="size-8 shrink-0" aria-hidden="true" />
          {/* At least this wide: on a phone the button moves below instead of squeezing the text. */}
          <div className="min-w-[min(100%,14rem)] flex-1">
            <h2 className="m-0 text-xl">{app.map.placementTitle}</h2>
            <p className="m-0 text-muted-foreground">{app.map.placementText}</p>
          </div>
          <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/learn/placement`}>
            {app.map.placementCta}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Card>
      ) : (
        <Card className="flex-row flex-wrap items-center gap-4 bg-primary text-primary-foreground">
          <PlayCircle className="size-8 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-xl">{next ? next.title[lang] : app.map.complete}</h2>
            <p className="m-0 opacity-80">{next ? next.track.title[lang] : app.path.allDone}</p>
          </div>
          {next && (
            <Link className={buttonVariants({ variant: 'secondary' })} href={`/${lang}/learn/${next.track.id}/${next.id}`}>
              {app.map.continue}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </Card>
      )}

      <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
        {COURSE.tracks.map((track, i) => {
          const p = trackProgress(done, track, COURSE)
          const hasContent = trackHasContent(track)
          const prereqs = track.prerequisites.map((id) => COURSE.tracks.find((t) => t.id === id)?.title[lang] ?? id).join(', ')
          const href = `/${lang}/learn/${track.id}`
          const state = !hasContent ? 'soon' : p.complete ? 'complete' : !p.unlocked ? 'locked' : p.done > 0 ? 'continue' : 'start'
          return (
            <li key={track.id}>
              <Card className={cn('relative h-full gap-3', (state === 'locked' || state === 'soon') && 'shadow-none')}>
                <div className="flex items-start gap-3">
                  <TrackIcon icon={track.icon} color={track.color} className={cn((state === 'locked' || state === 'soon') && 'opacity-60')} />
                  <div className="min-w-0 flex-1">
                    <p className="m-0 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{String(i + 1).padStart(2, '0')}</p>
                    <h2 className="m-0 text-2xl">
                      <Link href={href} className="after:absolute after:inset-0 hover:underline">
                        {track.title[lang]}
                      </Link>
                    </h2>
                  </div>
                  {state === 'complete' && (
                    <Badge variant="success">
                      <Check aria-hidden="true" />
                      {app.map.complete}
                    </Badge>
                  )}
                  {state === 'soon' && (
                    <Badge>
                      <Clock aria-hidden="true" />
                      {app.map.soon}
                    </Badge>
                  )}
                  {state === 'locked' && (
                    <Badge variant="outline">
                      <Lock aria-hidden="true" />
                      {fill(app.map.locked, { tracks: prereqs })}
                    </Badge>
                  )}
                </div>
                <p className="m-0 text-muted-foreground">{track.description[lang]}</p>
                <div className="mt-auto grid gap-2">
                  {/* Rendered on the server with empty progress, so the card keeps its size when progress loads. */}
                  <div className="flex flex-wrap justify-between gap-2 text-sm font-bold">
                    <span>{fill(app.map.progress, { done: p.done, total: p.total })}</span>
                    {p.ready < p.total && <span className="text-muted-foreground">{fill(app.map.readySoon, { ready: p.ready, total: p.total })}</span>}
                  </div>
                  <ProgressBar value={p.total ? p.done / p.total : 0} label={track.title[lang]} />
                  <span
                    className={buttonVariants({
                      variant: state === 'continue' ? 'primary' : 'secondary',
                      size: 'sm',
                      className: cn('relative z-0 mt-1 justify-self-start', state !== 'start' && state !== 'continue' && 'invisible'),
                    })}
                    aria-hidden={state !== 'start' && state !== 'continue'}
                  >
                    {state === 'continue' ? app.map.continue : app.map.start}
                    <ArrowRight aria-hidden="true" />
                  </span>
                </div>
              </Card>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
