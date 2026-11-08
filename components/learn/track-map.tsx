'use client'

import Link from 'next/link'
import { ArrowLeft, Check, Lock, Sparkles } from 'lucide-react'

import { CertificateCta } from '@/components/learn/certificate-cta'
import { ProgressBar } from '@/components/learn/learn-map'
import { PathTrail } from '@/components/learn/path-trail'
import { TrackIcon } from '@/components/learn/track-icon'
import { AnimIcon } from '@/components/ui/anim-icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { fill } from '@/lib/i18n/config'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import { COURSE } from '@/lib/learn/course'
import { lessonStates, trackProgress } from '@/lib/learn/progress'
import { useHydrated } from '@/lib/learn/store'
import { useProgress } from '@/lib/learn/use-progress'

type Lang = 'ru' | 'kk' | 'en'

/** /learn/[track]: units as winding trails of lessons. `testUnits`: units that have an "I already know this" test. */
export function TrackMap({ trackId, lang, app, testUnits }: { trackId: string; lang: Lang; app: LearnAppText; testUnits: string[] }) {
  const hydrated = useHydrated()
  const { done } = useProgress()
  const track = COURSE.tracks.find((t) => t.id === trackId)!
  const progress = trackProgress(done, track, COURSE)
  const states = lessonStates(done, track, COURSE)
  const prereqs = track.prerequisites.map((id) => COURSE.tracks.find((t) => t.id === id)?.title[lang] ?? id).join(', ')
  let number = 0

  return (
    <div className="container grid gap-8 py-8 md:py-12">
      <Link href={`/${lang}/learn`} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'justify-self-start' })}>
        <ArrowLeft aria-hidden="true" />
        {app.track.all}
      </Link>

      <header className="flex flex-wrap items-start gap-4">
        <TrackIcon icon={track.icon} color={track.color} className="size-16 [&_svg]:size-8" />
        <div className="grid min-w-0 flex-1 gap-2">
          <h1 className="m-0 text-4xl md:text-5xl">{track.title[lang]}</h1>
          <p className="m-0 max-w-2xl text-lg text-muted-foreground">{track.description[lang]}</p>
          {hydrated ? (
            <div className="grid max-w-md gap-1">
              <span className="text-sm font-bold">{fill(app.map.progress, { done: progress.done, total: progress.total })}</span>
              <ProgressBar value={progress.total ? progress.done / progress.total : 0} label={track.title[lang]} />
            </div>
          ) : (
            <Skeleton className="h-8 max-w-md" />
          )}
        </div>
      </header>

      {hydrated && !progress.unlocked && (
        <p className="alert alert-warn m-0" role="note">
          <Lock size={18} aria-hidden="true" />
          <span>{fill(app.track.locked, { tracks: prereqs })}</span>
        </p>
      )}

      {hydrated && progress.complete && (
        <Card className="flex-row flex-wrap items-center gap-4 bg-(--ok-bg)">
          <Sparkles className="size-8 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h2 className="m-0 text-xl">
              {app.track.certTitle} <AnimIcon name="party" />
            </h2>
            <p className="m-0 text-muted-foreground">{app.track.certText}</p>
          </div>
          <CertificateCta trackId={track.id} lang={lang} app={app} />
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {track.units.map((unit) => {
          const ready = unit.lessons.filter((l) => l.status === 'ready')
          const unitDone = ready.length > 0 && ready.every((l) => done.has(l.id))
          const canTest = hydrated && testUnits.includes(unit.id) && !unitDone
          const nodes = unit.lessons.map((l) => {
            number++
            const state = hydrated ? (states.get(l.id) ?? 'locked') : 'locked'
            const linkable = state === 'done' || state === 'current' || state === 'open'
            return {
              label: `${number}. ${l.title[lang]}${l.kit ? ` (${app.track.kit})` : ''}`,
              state,
              href: linkable ? `/${lang}/learn/${track.id}/${l.id}` : undefined,
            }
          })
          return (
            <Card key={unit.id} flat className="gap-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="m-0 text-2xl">{unit.title[lang]}</h2>
                {unitDone && (
                  <Badge variant="success">
                    <Check aria-hidden="true" />
                    {app.track.unitDone}
                  </Badge>
                )}
              </div>
              <PathTrail nodes={nodes} stateLabels={app.track.states} />
              {canTest && (
                <div className="grid gap-1 border-t-(length:--stroke-thin) border-dashed border-outline pt-4">
                  <Link
                    className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'justify-self-start' })}
                    href={`/${lang}/learn/${track.id}/check/${unit.id}`}
                  >
                    {app.track.know}
                  </Link>
                  <p className="m-0 text-sm text-muted-foreground">{app.track.knowHint}</p>
                </div>
              )}
            </Card>
          )
        })}
      </div>
    </div>
  )
}
