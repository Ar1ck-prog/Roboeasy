'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Check, Gauge, RotateCcw, X } from 'lucide-react'

import { type PracticeAnswer, PracticeRunner } from '@/components/learn/practice-runner'
import { buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { Dictionary } from '@/lib/i18n/ru'
import type { PracticeItem } from '@/lib/learn/content'
import { COURSE, findLessonRef } from '@/lib/learn/course'
import { PLACEMENT, UNIT_TEST_PASS, placementResult } from '@/lib/learn/placement'
import { nextLesson, placementAvailable } from '@/lib/learn/progress'
import type { Skill } from '@/lib/learn/schema'
import { completedLessons } from '@/lib/learn/state'
import { record, useLearn } from '@/lib/learn/store'
import { useLearningPath } from '@/lib/learn/use-progress'

type Lang = 'ru' | 'kk' | 'en'

interface Common {
  lang: Lang
  t: LearnText
  app: LearnAppText
  blocksT: Dictionary['blocks']
  items: PracticeItem[]
}

function Score({ answers, app }: { answers: PracticeAnswer[]; app: LearnAppText }) {
  const correct = answers.filter((a) => a.correct).length
  return (
    <div className="grid gap-3">
      <p className="m-0 font-display text-5xl font-extrabold">
        {correct}/{answers.length}
      </p>
      <p className="m-0 font-bold">{fill(app.test.score, { correct, total: answers.length })}</p>
      <ol className="m-0 flex list-none flex-wrap gap-1 p-0" aria-hidden="true">
        {answers.map((a) => (
          <li key={a.key} className={'grid size-8 place-items-center rounded-full border-(length:--stroke-thin) border-outline ' + (a.correct ? 'bg-success text-background' : 'bg-surface-2')}>
            {a.correct ? <Check size={16} /> : <X size={16} />}
          </li>
        ))}
      </ol>
    </div>
  )
}

/** "I already know this": the unit's quiz and predict questions; 80 % marks its lessons as known. */
export function UnitTest({ lang, t, app, blocksT, items, trackId, unitId }: Common & { trackId: string; unitId: string }) {
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro')
  const [answers, setAnswers] = useState<PracticeAnswer[]>([])
  const [run, setRun] = useState(0)
  const track = COURSE.tracks.find((tr) => tr.id === trackId)!
  const unit = track.units.find((u) => u.id === unitId)!
  const need = Math.ceil(items.length * UNIT_TEST_PASS)
  const passed = answers.filter((a) => a.correct).length >= need
  const back = `/${lang}/learn/${trackId}`

  const finish = (a: PracticeAnswer[]) => {
    setAnswers(a)
    setPhase('result')
    if (a.filter((x) => x.correct).length >= need) {
      const lessons = unit.lessons.filter((l) => l.status === 'ready').map((l) => l.id)
      const skills = [...new Set(unit.lessons.flatMap((l) => l.skills))] as Skill[]
      record([{ kind: 'known', lessons, skills, source: 'unit' }])
    }
  }

  return (
    <div className="container grid max-w-3xl gap-6 py-8 md:py-12">
      <Link href={back} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'justify-self-start' })}>
        <ArrowLeft aria-hidden="true" />
        {track.title[lang]}
      </Link>
      <h1 className="m-0 text-3xl md:text-4xl">{fill(app.test.unitTitle, { unit: unit.title[lang] })}</h1>
      {items.length === 0 ? (
        <p className="m-0">{app.test.noItems}</p>
      ) : phase === 'intro' ? (
        <Card className="gap-4">
          <p className="m-0 text-lg">{fill(app.test.unitLead, { n: items.length, need })}</p>
          <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'justify-self-start' })} onClick={() => setPhase('run')}>
            {app.test.begin}
            <ArrowRight aria-hidden="true" />
          </button>
        </Card>
      ) : phase === 'run' ? (
        <PracticeRunner key={run} items={items} lang={lang} t={t} app={app} blocksT={blocksT} onFinish={finish} />
      ) : (
        <Card className={'gap-4 ' + (passed ? 'bg-(--ok-bg)' : '')} role="status">
          <Score answers={answers} app={app} />
          <p className="m-0 text-lg font-bold">{passed ? app.test.unitPassed : app.test.unitFailed}</p>
          <div className="flex flex-wrap gap-2">
            <Link className={buttonVariants({ variant: 'primary' })} href={back}>
              {app.test.toTrack}
              <ArrowRight aria-hidden="true" />
            </Link>
            {!passed && (
              <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => (setRun((r) => r + 1), setPhase('run'))}>
                <RotateCcw aria-hidden="true" />
                {app.test.retry}
              </button>
            )}
          </div>
        </Card>
      )}
    </div>
  )
}

/** Placement test (docs/curriculum.md): levels in order, known lessons recorded. */
export function PlacementTest({ lang, t, app, blocksT, items }: Common) {
  const learn = useLearn()
  const [phase, setPhase] = useState<'intro' | 'run' | 'result'>('intro')
  const [answers, setAnswers] = useState<PracticeAnswer[]>([])
  const [known, setKnown] = useState<string[]>([])
  const already = learn.events.some((e) => e.kind === 'known' && e.source === 'placement')
  const path = useLearningPath()
  // On the WeDo path the SPIKE placement test waits until every WeDo lesson is done.
  const blocked = !placementAvailable(completedLessons(learn), COURSE, path)

  const finish = (a: PracticeAnswer[]) => {
    const result = placementResult(new Set(a.filter((x) => x.correct).map((x) => x.key)))
    setAnswers(a)
    setKnown(result.lessons)
    // Recorded even when empty: the path then knows the test was taken.
    record([{ kind: 'known', lessons: result.lessons, skills: result.skills, source: 'placement' }])
    setPhase('result')
  }

  const next = phase === 'result' ? nextLesson(completedLessons(learn), COURSE, path) : null
  const nextRef = next ? findLessonRef(next.id) : null

  return (
    <div className="container grid max-w-3xl gap-6 py-8 md:py-12">
      <h1 className="m-0 flex items-center gap-3 text-3xl md:text-4xl">
        <Gauge className="size-9" aria-hidden="true" />
        {app.placement.title}
      </h1>
      {blocked && phase === 'intro' ? (
        <Card className="gap-4" data-testid="placement-later">
          <p className="m-0 text-lg">{app.wedo.placementLater}</p>
          <Link className={buttonVariants({ variant: 'primary', className: 'justify-self-start' })} href={`/${lang}/learn?family=wedo`}>
            {app.wedo.toWedo}
            <ArrowRight aria-hidden="true" />
          </Link>
        </Card>
      ) : phase === 'intro' ? (
        <Card className="gap-4">
          <p className="m-0 text-lg">{app.placement.lead}</p>
          <ol className="m-0 grid gap-1 pl-5 text-muted-foreground">
            {PLACEMENT.map((l) => (
              <li key={l.id}>
                {app.placement.levels[l.id as keyof typeof app.placement.levels]} · {fill(app.common.lessons, { n: l.lessons.length })}
              </li>
            ))}
          </ol>
          {already && <p className="alert m-0">{app.placement.already}</p>}
          <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'justify-self-start' })} onClick={() => setPhase('run')}>
            {app.test.begin}
            <ArrowRight aria-hidden="true" />
          </button>
        </Card>
      ) : phase === 'run' ? (
        <PracticeRunner items={items} lang={lang} t={t} app={app} blocksT={blocksT} onFinish={finish} />
      ) : (
        <Card className="gap-4" role="status">
          <Score answers={answers} app={app} />
          <p className="m-0 text-lg font-bold">{known.length ? fill(app.placement.resultKnown, { n: known.length }) : app.placement.resultNone}</p>
          <div className="flex flex-wrap gap-2">
            {next && nextRef && (
              <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/learn/${nextRef.track.id}/${next.id}`}>
                {fill(app.placement.startFrom, { lesson: next.title[lang] })}
                <ArrowRight aria-hidden="true" />
              </Link>
            )}
            <Link className={buttonVariants({ variant: 'secondary' })} href={`/${lang}/path`}>
              {app.placement.toPath}
            </Link>
          </div>
        </Card>
      )}
    </div>
  )
}
