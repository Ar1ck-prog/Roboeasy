'use client'

import { useCallback, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, FileDown, Lightbulb, Play, RotateCcw, Sparkles, X } from 'lucide-react'

import { CodeView } from '@/components/code-view'
import { Mentor } from '@/components/learn/mentor'
import { RichText } from '@/components/learn/rich-text'
import { SimView } from '@/components/sim/sim-view'
import { AnimIcon } from '@/components/ui/anim-icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { tabTriggerClass } from '@/components/ui/tabs'
import type { ReadResult } from '@/lib/blockly/convert'
import { variantFor } from '@/lib/flags'
import { programToPython } from '@/lib/dsl/compile-python'
import { DEFAULT_ROBOT, countSteps } from '@/lib/dsl/types'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { Dictionary } from '@/lib/i18n/ru'
import { type CheckReport, runChecks } from '@/lib/learn/checks'
import type { ClientStep } from '@/lib/learn/content'
import { useLearn } from '@/lib/learn/store'
import { type SimResult, simulate } from '@/lib/sim/interpreter'
import { cn } from '@/lib/utils'

import { type StepDone, downloadProgram } from './simple-steps'

const BlocklyEditor = dynamic(() => import('@/components/learn/blockly-editor'), {
  ssr: false,
  loading: () => <Skeleton className="h-[360px] w-full" />,
})

type Lang = 'ru' | 'kk' | 'en'
type CodeStepData = Extract<ClientStep, { type: 'code' | 'debug' | 'project' }>

interface CodeStepProps {
  lessonId: string
  step: CodeStepData
  lang: Lang
  t: LearnText
  blocksT: Dictionary['blocks']
  robotColor: string
  sticker: string
  wheels?: string
  /** The AI mentor needs a lesson to read; weekly challenges go without it. */
  mentor?: boolean
  done: boolean
  onDone: (d: StepDone) => void
  onMistake: () => void
}

export function CodeStep({ lessonId, step, lang, t, blocksT, robotColor, sticker, wheels, mentor = true, done, onDone, onMistake }: CodeStepProps) {
  const [program, setProgram] = useState<ReadResult>({ steps: step.start, ids: {}, detached: 0, missingConditions: 0 })
  const [resetKey, setResetKey] = useState(0)
  const [view, setView] = useState<'blocks' | 'python'>('blocks')
  const [result, setResult] = useState<SimResult | null>(null)
  const [report, setReport] = useState<CheckReport | null>(null)
  const [highlight, setHighlight] = useState<string | null>(null)
  const [hintsShown, setHintsShown] = useState(0)
  const [failures, setFailures] = useState(0)
  const [panel, setPanel] = useState<'task' | 'code' | 'robot'>('task')
  const [solved, setSolved] = useState(done)
  const autoHint = variantFor('auto-hint', useLearn().profile?.anonId) === 'after-first-fail'

  const zoneLabel = useCallback((id: string) => step.field.zones.find((z) => z.id === id)?.label?.[lang] ?? id, [step.field.zones, lang])
  const python = useMemo(
    () => (view === 'python' ? programToPython({ title: step.title[lang], description: '', steps: program.steps }, DEFAULT_ROBOT) : ''),
    [view, program.steps],
  )

  const run = () => {
    setReport(null)
    setResult(simulate(program.steps, step.field))
    setPanel('robot')
  }

  const check = () => {
    const r = runChecks(program.steps, step.field, step.checks, lang, zoneLabel)
    setReport(r)
    setResult(r.sim)
    setPanel('robot')
    if (r.ok) {
      if (!solved) onDone({ firstTry: failures === 0 && hintsShown === 0, hints: hintsShown, blocks: r.blocks, program: program.steps })
      setSolved(true)
    } else {
      setFailures((f) => f + 1)
      if (autoHint) setHintsShown((n) => Math.max(n, 1))
      onMistake()
    }
  }

  const failed = report?.results.filter((r) => !r.ok) ?? []
  const shorter = report?.ok && step.referenceBlocks !== undefined && report.blocks < step.referenceBlocks

  const reportBox = report && (
    <div
      className={cn(
        'grid gap-2 rounded-(--radius-md) border-(length:--stroke-thin) p-3',
        report.ok ? 'border-(--success) bg-(--ok-bg)' : 'border-outline bg-card',
      )}
      role="status"
      aria-live="polite"
    >
      <p className="m-0 flex items-center gap-2 font-extrabold">
        {report.ok ? <Check className="size-5 text-success" aria-hidden="true" /> : <X className="size-5 text-destructive" aria-hidden="true" />}
        {report.ok ? t.lesson.passed : t.lesson.almost}
      </p>
      <ul className="m-0 grid list-none gap-1 p-0 text-sm">
        {report.results.map((r, i) => (
          <li key={i} className={cn('flex gap-2', r.ok ? 'text-success' : 'text-destructive')}>
            <span aria-hidden="true">{r.ok ? '✓' : '✗'}</span>
            <span className="text-foreground">{r.message}</span>
          </li>
        ))}
      </ul>
      {failed[0]?.hint && (
        <p className="m-0 flex gap-2 text-sm font-bold">
          <Lightbulb className="size-4 shrink-0" aria-hidden="true" />
          {failed[0].hint}
        </p>
      )}
      {shorter && (
        <p className="m-0 flex items-center gap-2 font-extrabold">
          <AnimIcon name="party" />
          {t.lesson.shorter}
        </p>
      )}
    </div>
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-2xl">{step.title[lang]}</h2>
        <Badge variant="outline">{t.lesson.stepTypes[step.type]}</Badge>
      </div>

      {/* Phones and small tablets: one area at a time */}
      <div className="tab-tray lg:hidden" role="group" aria-label={t.lesson.task}>
        {(['task', 'code', 'robot'] as const).map((p) => (
          <button key={p} type="button" className={tabTriggerClass} aria-pressed={panel === p} onClick={() => setPanel(p)}>
            {t.lesson.tabs[p]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.8fr)_minmax(0,1.6fr)] lg:items-start">
        {/* Task, hints, results */}
        <section className={cn('grid gap-3', panel !== 'task' && 'max-lg:hidden')} aria-label={t.lesson.task}>
          <div className="rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4">
            <RichText text={step.task[lang]} className="text-lg [&>p:first-child]:mt-0 [&>p:last-child]:mb-0" />
          </div>

          {hintsShown > 0 && (
            <ol className="m-0 grid list-none gap-2 p-0" aria-live="polite">
              {step.hints.slice(0, hintsShown).map((h, i) => (
                <li key={i} className="flex gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 p-3">
                  <Lightbulb className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
                  <span>
                    <span className="block text-xs font-extrabold text-muted-foreground">{fill(t.lesson.hintOf, { n: i + 1, total: step.hints.length })}</span>
                    {h[lang]}
                  </span>
                </li>
              ))}
            </ol>
          )}

          {(program.detached > 0 || program.missingConditions > 0) && (
            <p className="alert alert-warn m-0 text-sm" role="note">
              {program.detached > 0 ? fill(t.lesson.detached, { n: program.detached }) : t.lesson.emptyCondition}
            </p>
          )}

          <div className="max-lg:hidden">{reportBox}</div>

          {mentor && (
            <Mentor
              lessonId={lessonId}
              stepId={step.id}
              lang={lang}
              t={t}
              lessonHints={step.hints.map((h) => h[lang])}
              getContext={() => ({ steps: program.steps, failed: failed.map((f) => f.message) })}
            />
          )}
        </section>

        {/* Editor and simulator */}
        <div className="grid min-w-0 gap-3">
          <section className={cn('grid gap-2', panel !== 'code' && 'max-lg:hidden')} aria-label={t.lesson.blocks}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="tab-tray" role="group" aria-label={t.lesson.blocks}>
                {(['blocks', 'python'] as const).map((v) => (
                  <button key={v} type="button" className={tabTriggerClass} aria-pressed={view === v} onClick={() => setView(v)}>
                    {t.lesson[v]}
                  </button>
                ))}
              </div>
              <Badge>{fill(t.lesson.blocksCount, { n: countSteps(program.steps) })}</Badge>
            </div>
            <div
              className={cn(
                'h-[360px] overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2',
                view !== 'blocks' && 'hidden',
              )}
            >
              <BlocklyEditor
                lang={lang}
                t={blocksT}
                toolbox={step.toolbox}
                initial={step.start}
                resetKey={resetKey}
                highlight={highlight}
                onChange={setProgram}
                label={t.lesson.blocks}
              />
            </div>
            {view === 'python' && (
              <div className="grid gap-2">
                <p className="m-0 text-sm text-muted-foreground">{t.lesson.pythonNote}</p>
                <CodeView code={python} label="Python" />
              </div>
            )}
          </section>

          <section className={cn(panel !== 'robot' && 'max-lg:hidden')} aria-label={t.sim.time}>
            <SimView
              field={step.field}
              result={result}
              lang={lang}
              robotColor={robotColor}
              sticker={sticker}
              wheels={wheels}
              labels={t.sim}
              onStep={setHighlight}
            />
          </section>

          <div className="flex flex-wrap gap-2">
            <button type="button" className={buttonVariants({ variant: 'secondary' })} onClick={run}>
              <Play aria-hidden="true" />
              {t.lesson.run}
            </button>
            <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={check}>
              <Check aria-hidden="true" />
              {t.lesson.checkCode}
            </button>
            <button
              type="button"
              className={buttonVariants({ variant: 'ghost' })}
              onClick={() => (setHintsShown((n) => Math.min(step.hints.length, n + 1)), setPanel('task'))}
              disabled={hintsShown >= step.hints.length}
            >
              <Lightbulb aria-hidden="true" />
              {t.lesson.hint}
            </button>
            <button
              type="button"
              className={buttonVariants({ variant: 'ghost' })}
              onClick={() => (setResetKey((k) => k + 1), setResult(null), setReport(null))}
            >
              <RotateCcw aria-hidden="true" />
              {t.lesson.reset}
            </button>
            <button
              type="button"
              className={buttonVariants({ variant: 'ghost', className: 'ml-auto' })}
              onClick={() => void downloadProgram(step.title[lang], program.steps)}
              disabled={program.steps.length === 0}
            >
              <FileDown aria-hidden="true" />
              {t.lesson.download}
            </button>
          </div>
          {/* Phones and tablets: results right under the buttons, whichever tab is open */}
          <div className="lg:hidden">{reportBox}</div>
        </div>
      </div>
    </div>
  )
}
