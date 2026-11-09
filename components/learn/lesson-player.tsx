'use client'

import { Skeleton } from '@/components/ui/skeleton'
import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Bot, Clock, Lock, PartyPopper, RotateCcw, Target, X } from 'lucide-react'

import { RichText } from '@/components/learn/rich-text'
import { CodeStep } from '@/components/learn/steps/code-step'
import { PredictStep } from '@/components/learn/steps/predict-step'
import { QuizStep } from '@/components/learn/steps/quiz-step'
import { BuildStep, RealRobotStep, type StepDone, TheoryStep } from '@/components/learn/steps/simple-steps'
import { AnimIcon } from '@/components/ui/anim-icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { LearnAppText } from '@/lib/i18n/learn-app'
import type { Dictionary } from '@/lib/i18n/ru'
import type { ClientLesson } from '@/lib/learn/content'
import { COURSE } from '@/lib/learn/course'
import { lessonStates, trackLessons } from '@/lib/learn/progress'
import { completedLessons, doneSteps } from '@/lib/learn/state'
import { record, useHydrated, useLearn } from '@/lib/learn/store'
import { ledger } from '@/lib/learn/economy'
import { CoinIcon } from '@/components/learn/coin'
import { cn } from '@/lib/utils'

// Camera and model code load only for the lessons that use them.
const WidgetStep = dynamic(() => import('@/components/learn/steps/widget-step'), { ssr: false, loading: () => <Skeleton className="h-80" /> })

type Lang = 'ru' | 'kk' | 'en'

interface PlayerProps {
  lesson: ClientLesson
  lang: Lang
  t: LearnText
  blocksT: Dictionary['blocks']
  trackTitle: string
  unitTitle: string
  isProject: boolean
  next: { href: string; title: string } | null
  mapHref: string
  lockedT: LearnAppText['locked']
}

export function LessonPlayer({ lesson, lang, t, blocksT, trackTitle, unitTitle, isProject, next, mapHref, lockedT }: PlayerProps) {
  const learn = useLearn()
  const hydrated = useHydrated()
  const [forceOpen, setForceOpen] = useState(false)
  const done = useMemo(() => doneSteps(learn, lesson.id), [learn, lesson.id])
  const lessonDone = learn.events.some((e) => e.kind === 'lesson_done' && e.lesson === lesson.id)
  const [index, setIndex] = useState(-1)
  const [finished, setFinished] = useState(false)
  const [gained, setGained] = useState({ xp: 0, coins: 0 })
  const started = useRef<number | null>(null)
  const before = useRef({ xp: 0, coins: 0 })
  const cosmetics = learn.profile?.cosmetics ?? { color: 'sun', sticker: 'none', wheels: 'classic', sound: 'beep' }

  const step = index >= 0 ? lesson.steps[index] : null
  const stepDone = step ? done.has(step.id) : false
  const total = lesson.steps.length

  const begin = () => {
    started.current = Date.now()
    const l = ledger(learn)
    before.current = { xp: l.xp, coins: l.coins }
    record([{ kind: 'lesson_start', lesson: lesson.id }])
    const firstOpen = lesson.steps.findIndex((s) => !done.has(s.id))
    setIndex(firstOpen === -1 || lessonDone ? 0 : firstOpen)
  }

  const onDone = useCallback(
    (d: StepDone) => {
      if (!step) return
      const events: Parameters<typeof record>[0] = [
        {
          kind: 'step_done',
          lesson: lesson.id,
          step: step.id,
          stepType: step.type,
          firstTry: d.firstTry,
          hints: d.hints,
          blocks: d.blocks,
          referenceBlocks: 'referenceBlocks' in step ? step.referenceBlocks : undefined,
          skill: 'skill' in step ? step.skill : undefined,
          program: d.program,
        },
      ]
      if (d.real) events.push({ kind: 'real_robot', lesson: lesson.id, step: step.id })
      record(events)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [step?.id, lesson.id],
  )

  const onMistake = useCallback(() => {
    if (!step) return
    record([{ kind: 'mistake', lesson: lesson.id, step: step.id, skill: 'skill' in step ? step.skill : lesson.skills[0] }])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id, lesson.id])

  const finish = () => {
    const seconds = started.current ? Math.min(3600, Math.round((Date.now() - started.current) / 1000)) : 0
    record([
      { kind: 'lesson_done', lesson: lesson.id, track: lesson.track, unit: lesson.unit, project: isProject, seconds },
      { kind: 'time', seconds },
    ])
    setFinished(true)
  }

  // XP and coins gained in this session (computed after the events land; upgrades and quests included).
  useEffect(() => {
    if (!finished) return
    const l = ledger(learn)
    setGained({ xp: Math.max(0, l.xp - before.current.xp), coins: Math.max(0, l.coins - before.current.coins) })
  }, [finished, learn])

  useEffect(() => {
    if (index >= 0) window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [index])

  // A locked lesson (opened by URL) suggests the lesson to do first; "open anyway" is allowed.
  const track = COURSE.tracks.find((tr) => tr.id === lesson.track)
  const states = track && hydrated ? lessonStates(completedLessons(learn), track, COURSE) : null
  const firstOpen = track && states ? trackLessons(track).find(({ ref }) => states.get(ref.id) === 'current')?.ref : undefined
  const locked = !forceOpen && states?.get(lesson.id) === 'locked' && firstOpen

  // ── Intro ───────────────────────────────────────────────────────────
  if (index < 0 && !finished)
    return (
      <div className="container grid min-h-[70vh] place-items-center py-10">
        <div className="animate-in duration-300 fade-in-0 slide-in-from-bottom-3 motion-reduce:animate-none grid w-full max-w-xl gap-5 rounded-(--radius-xl) border-(length:--stroke) border-outline bg-card p-6 shadow-(--shadow-hard) sm:p-8">
          <Link href={mapHref} className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {trackTitle} · {unitTitle}
          </Link>
          <h1 className="m-0 text-(length:--text-3xl)">{lesson.title[lang]}</h1>
          <div className="flex gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-primary p-4 text-primary-foreground">
            <Target className="mt-0.5 size-6 shrink-0" aria-hidden="true" />
            <p className="m-0 text-lg font-bold">{lesson.goal[lang]}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Badge>
              <Clock aria-hidden="true" />
              {fill(t.lesson.minutes, { n: lesson.minutes })}
            </Badge>
            <Badge>{fill(t.lesson.step, { n: 1, total })}</Badge>
            {lesson.kit && (
              <Badge variant="warn">
                <Bot aria-hidden="true" />
                {t.lesson.kit}
              </Badge>
            )}
          </div>
          {locked ? (
            <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-dashed border-outline bg-surface-2 p-4">
              <p className="m-0 flex items-center gap-2 font-extrabold">
                <Lock className="size-5" aria-hidden="true" />
                {lockedT.title}
              </p>
              <p className="m-0">{fill(lockedT.text, { lesson: firstOpen.title[lang] })}</p>
              <div className="flex flex-wrap gap-2">
                <Link className={buttonVariants({ variant: 'primary' })} href={`/${lang}/learn/${lesson.track}/${firstOpen.id}`}>
                  {fill(lockedT.go, { lesson: firstOpen.title[lang] })}
                  <ArrowRight aria-hidden="true" />
                </Link>
                <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => setForceOpen(true)}>
                  {lockedT.anyway}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg' })} onClick={begin}>
              {done.size > 0 && !lessonDone ? t.lesson.resume : t.lesson.start}
              <ArrowRight aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    )

  // ── Summary ─────────────────────────────────────────────────────────
  if (finished)
    return (
      <div className="container grid min-h-[70vh] place-items-center py-10">
        <div className="animate-in duration-300 fade-in-0 zoom-in-95 motion-reduce:animate-none grid w-full max-w-xl justify-items-center gap-5 rounded-(--radius-xl) border-(length:--stroke) border-outline bg-card p-8 text-center shadow-(--shadow-hard)">
          <span className="grid size-20 place-items-center rounded-full border-(length:--stroke) border-outline bg-primary text-primary-foreground shadow-(--shadow-hard-sm)">
            <PartyPopper className="size-10" aria-hidden="true" />
          </span>
          <h1 className="m-0 text-(length:--text-3xl)">{t.lesson.done}</h1>
          <RichText text={lesson.summary[lang]} className="text-lg [&>p]:my-0" />
          {(gained.xp > 0 || gained.coins > 0) && (
            <span className="flex flex-wrap justify-center gap-2">
              {gained.xp > 0 && (
                <span className="animate-in delay-150 duration-300 fill-mode-backwards zoom-in-50 motion-reduce:animate-none rounded-full border-(length:--stroke-thin) border-outline bg-(--ok-bg) px-4 py-1.5 font-display text-2xl font-extrabold text-success">
                  {fill(t.lesson.xp, { xp: gained.xp })}
                </span>
              )}
              {gained.coins > 0 && (
                <span
                  className="animate-in delay-300 duration-300 fill-mode-backwards zoom-in-50 motion-reduce:animate-none inline-flex items-center gap-1.5 rounded-full border-(length:--stroke-thin) border-outline bg-[#fff3c4] px-4 py-1.5 font-display text-2xl font-extrabold text-[#8a5a00]"
                  data-testid="coins-gained"
                >
                  <CoinIcon className="size-6" />+{gained.coins}
                </span>
              )}
            </span>
          )}
          <div className="flex flex-wrap justify-center gap-2">
            {next ? (
              <Link className={buttonVariants({ variant: 'primary', size: 'lg' })} href={next.href}>
                {t.lesson.nextLesson}: {next.title}
                <ArrowRight aria-hidden="true" />
              </Link>
            ) : (
              <span className="font-display text-xl font-extrabold">
                {t.lesson.trackDone} <AnimIcon name="party" />
              </span>
            )}
            <Link className={buttonVariants({ size: 'lg' })} href={mapHref}>
              {t.lesson.toMap}
            </Link>
            <button type="button" className={buttonVariants({ variant: 'ghost', size: 'lg' })} onClick={() => (setFinished(false), setIndex(0))}>
              <RotateCcw aria-hidden="true" />
              {t.lesson.again}
            </button>
          </div>
        </div>
      </div>
    )

  // ── Steps ───────────────────────────────────────────────────────────
  return (
    <div className="grid min-h-[100dvh] grid-rows-[auto_1fr_auto]">
      <header className="sticky top-0 z-40 border-b-(length:--stroke) border-outline bg-background/95 backdrop-blur">
        <div className="container flex items-center gap-3 py-3">
          <Link href={mapHref} className={buttonVariants({ variant: 'ghost', size: 'icon-sm' })} aria-label={t.lesson.exit} title={t.lesson.exit}>
            <X aria-hidden="true" />
          </Link>
          <ol className="m-0 flex flex-1 list-none gap-1.5 p-0" aria-label={fill(t.lesson.step, { n: index + 1, total })}>
            {lesson.steps.map((s, i) => (
              <li key={s.id} className="flex-1">
                <button
                  type="button"
                  className={cn(
                    'block h-3.5 w-full cursor-pointer rounded-full border-(length:--stroke-thin) border-outline',
                    done.has(s.id) ? 'bg-success' : i === index ? 'bg-primary' : 'bg-surface-2',
                  )}
                  aria-label={`${i + 1}. ${t.lesson.stepTypes[s.type]}`}
                  aria-current={i === index ? 'step' : undefined}
                  disabled={!done.has(s.id) && i !== index && !(i > 0 && done.has(lesson.steps[i - 1].id))}
                  onClick={() => setIndex(i)}
                />
              </li>
            ))}
          </ol>
          <span className="hidden font-mono text-sm font-semibold sm:inline">
            {index + 1}/{total}
          </span>
        </div>
      </header>

      <main id="main" className="container py-6">
        <p className="mt-0 mb-3 text-sm font-bold text-muted-foreground">
          {lesson.title[lang]} · {t.lesson.stepTypes[step!.type]}
        </p>
        <div key={step!.id} className="animate-in duration-200 fade-in-0 slide-in-from-right-4 motion-reduce:animate-none">
          {step!.type === 'theory' && <TheoryStep step={step!} lang={lang} blocksT={blocksT} onDone={onDone} />}
          {step!.type === 'build' && <BuildStep step={step!} lang={lang} t={t} onDone={onDone} />}
          {step!.type === 'widget' && <WidgetStep key={step!.id} step={step!} lang={lang} done={stepDone} onDone={onDone} />}
          {step!.type === 'quiz' && <QuizStep key={step!.id} step={step!} lang={lang} t={t} done={stepDone} onDone={onDone} onMistake={onMistake} />}
          {step!.type === 'predict' && (
            <PredictStep
              key={step!.id}
              step={step!}
              lang={lang}
              t={t}
              blocksT={blocksT}
              robotColor={cosmetics.color}
              done={stepDone}
              onDone={onDone}
              onMistake={onMistake}
            />
          )}
          {step!.type === 'real_robot' && <RealRobotStep key={step!.id} step={step!} lang={lang} t={t} done={stepDone} onDone={onDone} />}
          {(step!.type === 'code' || step!.type === 'debug' || step!.type === 'project') && (
            <CodeStep
              key={step!.id}
              lessonId={lesson.id}
              step={step!}
              lang={lang}
              t={t}
              blocksT={blocksT}
              robotColor={cosmetics.color}
              sticker={cosmetics.sticker}
              wheels={cosmetics.wheels}
              done={stepDone}
              onDone={onDone}
              onMistake={onMistake}
            />
          )}
        </div>
      </main>

      <footer className="sticky bottom-0 z-30 border-t-(length:--stroke) border-outline bg-background/95 backdrop-blur">
        <div className="container flex items-center justify-between gap-3 py-3">
          <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => setIndex((i) => Math.max(0, i - 1))} disabled={index === 0}>
            <ArrowLeft aria-hidden="true" />
            {t.lesson.back}
          </button>
          <button
            type="button"
            className={buttonVariants({ variant: 'primary', size: 'lg' })}
            disabled={!stepDone}
            onClick={() => (index + 1 < total ? setIndex(index + 1) : finish())}
          >
            {index + 1 < total ? t.lesson.next : t.lesson.done}
            <ArrowRight aria-hidden="true" />
          </button>
        </div>
      </footer>
    </div>
  )
}
