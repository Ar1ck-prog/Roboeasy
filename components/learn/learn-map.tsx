'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Check, Clock, Cpu, Gauge, Lock, PlayCircle, Sparkles } from 'lucide-react'

import { TrackIcon } from '@/components/learn/track-icon'
import { PathPicker } from '@/components/wedo/path-picker'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fill } from '@/lib/i18n/config'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { WedoText } from '@/lib/i18n/wedo'
import { COURSE, type Track, tracksOf } from '@/lib/learn/course'
import {
  type LearningPath,
  nextLesson,
  placementAvailable,
  spikeLockedByWedo,
  trackHasContent,
  trackNextLesson,
  trackProgress,
  wedoComplete,
  wedoProgress,
} from '@/lib/learn/progress'
import type { TrackFamily } from '@/lib/learn/schema'
import { setLearningPath, useHydrated } from '@/lib/learn/store'
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

const FAMILIES = ['wedo', 'spike', 'general', 'arduino', 'esp32'] as const satisfies readonly TrackFamily[]
const isFamily = (f: string | null): f is TrackFamily => (FAMILIES as readonly string[]).includes(f ?? '')
/** Families of the electronics tracks: no SPIKE/WeDo path is needed for them. */
const ELECTRONICS: readonly TrackFamily[] = ['arduino', 'esp32']

/** One track's card: its number within the tab, progress, lock badge and a link into the next lesson. */
function TrackCard({ track, n, lang, app, done, path }: { track: Track; n: number; lang: Lang; app: LearnAppText; done: Set<string>; path: LearningPath }) {
  const p = trackProgress(done, track, COURSE, path)
  const hasContent = trackHasContent(track)
  const byWedo = spikeLockedByWedo(done, track, COURSE, path)
  const prereqs = byWedo ? 'WeDo 2.0' : track.prerequisites.map((id) => COURSE.tracks.find((t) => t.id === id)?.title[lang] ?? id).join(', ')
  const href = `/${lang}/learn/${track.id}`
  const state = !hasContent ? 'soon' : p.complete ? 'complete' : !p.unlocked ? 'locked' : p.done > 0 ? 'continue' : 'start'
  const lesson = state === 'start' || state === 'continue' ? trackNextLesson(done, track, COURSE, path) : null
  return (
    <li>
      <Card className={cn('relative h-full gap-3', (state === 'locked' || state === 'soon') && 'shadow-none', track.family === 'wedo' && 'bg-(--wedo-accent-soft)')}>
        {/* Wraps on a phone: a long "first: …" badge moves under the title instead of pushing the page wider. */}
        <div className="flex flex-wrap items-start gap-3">
          <TrackIcon icon={track.icon} color={track.color} className={cn((state === 'locked' || state === 'soon') && 'opacity-60')} />
          <div className="min-w-[9rem] flex-1">
            <p className="m-0 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{String(n).padStart(2, '0')}</p>
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
            <Badge variant="outline" className="max-w-full whitespace-normal leading-tight">
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
          {state === 'start' || state === 'continue' ? (
            // A real link straight into the lesson, above the card's stretched title link.
            <Link
              href={lesson ? `${href}/${lesson}` : href}
              className={buttonVariants({
                variant: state === 'continue' ? 'primary' : 'secondary',
                size: 'sm',
                className: 'relative z-10 mt-1 justify-self-start',
              })}
            >
              {state === 'continue' ? app.map.continue : app.map.start}
              <ArrowRight aria-hidden="true" />
            </Link>
          ) : (
            // Keeps every card the same height.
            <span className={buttonVariants({ size: 'sm', className: 'invisible mt-1 justify-self-start' })} aria-hidden="true">
              {app.map.start}
              <ArrowRight aria-hidden="true" />
            </span>
          )}
        </div>
      </Card>
    </li>
  )
}

/** "From absolute zero": the first lesson of an electronics tab, or (ESP32 before Arduino) the way to the Arduino tab. */
function ZeroCard({ family, lang, app, done, path, onArduino }: { family: TrackFamily; lang: Lang; app: LearnAppText; done: Set<string>; path: LearningPath; onArduino: () => void }) {
  const hydrated = useHydrated()
  const tracks = tracksOf(family)
  const course = { tracks }
  if (hydrated && tracks.some((t) => trackProgress(done, t, COURSE, path).done > 0)) return null
  const next = nextLesson(done, course, path)
  return (
    <Card className="flex-row flex-wrap items-center gap-4 bg-(--ok-bg)">
      <Sparkles className="size-8 shrink-0" aria-hidden="true" />
      <div className="min-w-[min(100%,14rem)] flex-1">
        <h3 className="m-0 text-xl">{app.map.zeroTitle}</h3>
        <p className="m-0 text-muted-foreground">{app.map.zeroText}</p>
      </div>
      {next ? (
        <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/learn/${next.track.id}/${next.id}`}>
          {app.map.start}
          <ArrowRight aria-hidden="true" />
        </Link>
      ) : (
        // ESP32 builds on Arduino: its first track opens after the Arduino one.
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={onArduino}>
          {fill(app.map.locked, { tracks: app.map.platforms.arduino })}
          <ArrowRight aria-hidden="true" />
        </button>
      )}
    </Card>
  )
}

/** /learn: the tracks in tabs (WeDo 2.0, SPIKE Prime, general, Arduino, ESP32), each numbered on its own; the path picker until a path is chosen. */
export function LearnMap({ lang, app, wt }: { lang: Lang; app: LearnAppText; wt: WedoText }) {
  const hydrated = useHydrated()
  const { done, state: learn, path } = useProgress()
  const [tab, setTab] = useState<TrackFamily | null>(null)
  const w = app.wedo

  // ?family=wedo opens that tab (the "All tracks" link of a WeDo track).
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    // ?platform= is the older name of the same tab.
    const f = query.get('family') ?? query.get('platform')
    if (isFamily(f)) setTab(f)
  }, [])

  const active: TrackFamily = tab ?? (path === 'wedo' ? 'wedo' : 'spike')
  const pick = (f: string) => {
    if (!isFamily(f)) return
    setTab(f)
    const url = new URL(window.location.href)
    url.searchParams.set('family', f)
    window.history.replaceState(null, '', url)
  }

  // Before a path is chosen the picker comes first; electronics needs no path and opens from a card under it.
  if (hydrated && path === null && !ELECTRONICS.includes(active))
    return (
      <div className="container grid max-w-4xl gap-6 py-8 md:py-12">
        <PathPicker wt={wt} ageRange={learn.profile?.ageRange} onPick={setLearningPath} />
        <Card className="flex-row flex-wrap items-center gap-4">
          <Cpu className="size-8 shrink-0" aria-hidden="true" />
          <div className="min-w-[min(100%,14rem)] flex-1">
            <h3 className="m-0 text-xl">{app.map.electronicsTitle}</h3>
            <p className="m-0 text-muted-foreground">{app.map.electronicsText}</p>
          </div>
          <button type="button" className={buttonVariants({ variant: 'secondary' })} onClick={() => pick('arduino')} data-testid="pick-electronics">
            {app.map.electronicsCta}
            <ArrowRight aria-hidden="true" />
          </button>
        </Card>
      </div>
    )

  const tookPlacement = learn.events.some((e) => e.kind === 'known' && e.source === 'placement')
  const spikeIds = new Set(tracksOf('spike').flatMap((t) => t.units.flatMap((u) => u.lessons.map((l) => l.id))))
  const spikeStarted = [...done].some((id) => spikeIds.has(id))
  const wedoDone = wedoComplete(done, COURSE)
  const wp = wedoProgress(done, COURSE)
  const next = nextLesson(done, COURSE, path)
  const onWedo = path === 'wedo' && !wedoDone
  const showContinue = hydrated && (onWedo || done.size > 0 || tookPlacement)
  const showPlacement = !hydrated || (placementAvailable(done, COURSE, path) && !spikeStarted && !tookPlacement)
  const leads: Record<TrackFamily, string> = { wedo: w.wedoLead, spike: w.spikeLead, general: w.generalLead, arduino: app.map.platformLead.arduino, esp32: app.map.platformLead.esp32 }
  const titles: Record<TrackFamily, string> = { wedo: w.wedoTitle, spike: w.spikeTitle, general: w.generalTitle, arduino: app.map.platforms.arduino, esp32: app.map.platforms.esp32 }
  const tabNames: Record<TrackFamily, string> = { wedo: w.tabWedo, spike: w.tabSpike, general: w.tabGeneral, arduino: app.map.platforms.arduino, esp32: app.map.platforms.esp32 }

  return (
    <div className="container grid gap-8 py-8 md:py-12">
      <header className="grid gap-3">
        <h1 className="m-0 text-4xl md:text-5xl">{app.map.title}</h1>
        <p className="m-0 max-w-2xl text-lg text-muted-foreground">{app.map.lead}</p>
      </header>

      {showContinue && (
        <Card className="flex-row flex-wrap items-center gap-4 bg-primary text-primary-foreground">
          <PlayCircle className="size-8 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-xl">{next ? next.title[lang] : app.map.complete}</h2>
            <p className="m-0 opacity-80">{next ? next.track.title[lang] : app.path.allDone}</p>
          </div>
          {next && (
            <Link className={buttonVariants({ variant: 'secondary' })} href={`/${lang}/learn/${next.track.id}/${next.id}`}>
              {onWedo ? w.continueWedo : app.map.continue}
              <ArrowRight aria-hidden="true" />
            </Link>
          )}
        </Card>
      )}

      <Tabs value={active} onValueChange={pick}>
        <TabsList aria-label={w.tabs} className="h-auto flex-wrap max-sm:w-full">
          {FAMILIES.map((f) => (
            <TabsTrigger key={f} value={f} className="min-h-11 max-sm:flex-1" data-testid={`tab-${f}`}>
              {tabNames[f]}
              {f === 'spike' && hydrated && onWedo && <Lock className="size-4" aria-hidden="true" />}
            </TabsTrigger>
          ))}
        </TabsList>
        {FAMILIES.map((f) => (
          <TabsContent key={f} value={f} className="grid gap-5">
            <div className="grid gap-1">
              <h2 className="m-0 text-3xl">{titles[f]}</h2>
              <p className="m-0 text-muted-foreground">{leads[f]}</p>
              {f === 'wedo' && hydrated && path === 'spike' && <p className="m-0 text-sm font-bold text-(--wedo-ink)">{w.optional}</p>}
            </div>

            {ELECTRONICS.includes(f) && <ZeroCard family={f} lang={lang} app={app} done={done} path={path} onArduino={() => pick('arduino')} />}

            {f === 'spike' && hydrated && onWedo && (
              <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke) border-dashed border-outline bg-surface-2 p-4" role="note" data-testid="spike-locked">
                <p className="m-0 flex items-center gap-2 text-lg font-extrabold">
                  <Lock className="size-5" aria-hidden="true" />
                  {w.lockedTitle}
                </p>
                <div className="grid max-w-md gap-1">
                  <span className="text-sm font-bold">{fill(w.lockedProgress, { done: wp.done, total: wp.ready })}</span>
                  <ProgressBar value={wp.ready ? wp.done / wp.ready : 0} label={w.lockedTitle} />
                </div>
              </div>
            )}

            {f === 'spike' && hydrated && path === 'wedo' && wedoDone && !spikeStarted && (
              <Card className="flex-row flex-wrap items-center gap-4 bg-(--wedo-accent-soft)">
                <Sparkles className="size-8 shrink-0" aria-hidden="true" />
                <div className="min-w-[min(100%,14rem)] flex-1">
                  <h3 className="m-0 text-xl">{w.readyTitle}</h3>
                  <p className="m-0 text-muted-foreground">{w.readyText}</p>
                </div>
                <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/learn/start/start-01`}>
                  {w.readyCta}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Card>
            )}

            {f === 'spike' && showPlacement && (
              <Card className="flex-row flex-wrap items-center gap-4 bg-(--ok-bg)">
                <Gauge className="size-8 shrink-0" aria-hidden="true" />
                {/* At least this wide: on a phone the button moves below instead of squeezing the text. */}
                <div className="min-w-[min(100%,14rem)] flex-1">
                  <h3 className="m-0 text-xl">{app.map.placementTitle}</h3>
                  <p className="m-0 text-muted-foreground">{app.map.placementText}</p>
                </div>
                <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/learn/placement`}>
                  {app.map.placementCta}
                  <ArrowRight aria-hidden="true" />
                </Link>
              </Card>
            )}

            <ol className="m-0 grid list-none gap-4 p-0 md:grid-cols-2">
              {tracksOf(f).map((track, i) => (
                <TrackCard key={track.id} track={track} n={i + 1} lang={lang} app={app} done={done} path={path} />
              ))}
            </ol>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}
