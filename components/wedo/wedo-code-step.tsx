'use client'

/**
 * A WeDo task: the icon editor on one side, the robot scene on the other
 * (tabs on a phone). "Run" tries the program with the sensor buttons, "Check"
 * replays the lesson's scenario and runs the automatic checks. Hints come
 * one at a time from the lesson; there is no AI mentor for learners under 10.
 * Reports done and mistakes like the SPIKE task, so XP, coins, streaks and
 * review keep working.
 */

import { useState } from 'react'
import { Check, Lightbulb, Play, X } from 'lucide-react'

import { RichText } from '@/components/learn/rich-text'
import type { StepDone } from '@/components/learn/steps/simple-steps'
import { AnimIcon } from '@/components/ui/anim-icon'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { tabTriggerClass } from '@/components/ui/tabs'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { WedoText } from '@/lib/i18n/wedo'
import type { ClientStep } from '@/lib/learn/content'
import { type WedoCheckReport, runWedoChecks } from '@/lib/wedo/checks'
import { type WedoStep, wedoBlocks } from '@/lib/wedo/types'
import { cn } from '@/lib/utils'

import { WedoEditor } from './wedo-editor'
import { WedoSimView } from './wedo-sim-view'

type Lang = 'ru' | 'kk' | 'en'
type Step = Extract<ClientStep, { type: 'wedo_code' }>

interface Props {
  step: Step
  lang: Lang
  t: LearnText
  wt: WedoText
  done: boolean
  onDone: (d: StepDone) => void
  onMistake: () => void
}

export function WedoCodeStep({ step, lang, t, wt, done, onDone, onMistake }: Props) {
  const [program, setProgram] = useState<WedoStep[]>(step.start)
  const [runKey, setRunKey] = useState(0)
  const [mode, setMode] = useState<'live' | 'scripted'>('live')
  const [highlight, setHighlight] = useState<string | null>(null)
  const [report, setReport] = useState<WedoCheckReport | null>(null)
  const [hintsShown, setHintsShown] = useState(0)
  const [failures, setFailures] = useState(0)
  const [solved, setSolved] = useState(done)
  const [panel, setPanel] = useState<'task' | 'code' | 'robot'>('code')

  const edit = (steps: WedoStep[]) => {
    setProgram(steps)
    setReport(null)
  }

  const run = () => {
    setReport(null)
    setMode('live')
    setRunKey((k) => k + 1)
    setPanel('robot')
  }

  const check = () => {
    const r = runWedoChecks(program, step.scene, step.checks, lang, step.scenario)
    setReport(r)
    setMode('scripted')
    setRunKey((k) => k + 1)
    setPanel('robot')
    if (r.ok) {
      if (!solved) onDone({ firstTry: failures === 0 && hintsShown === 0, hints: hintsShown, blocks: r.blocks })
      setSolved(true)
    } else {
      setFailures((f) => f + 1)
      // After the first miss the first hint opens by itself.
      setHintsShown((n) => Math.max(n, 1))
      onMistake()
    }
  }

  const shorter = report?.ok && step.referenceBlocks !== undefined && report.blocks < step.referenceBlocks

  const reportBox = report && (
    <div
      className={cn('grid gap-2 rounded-(--radius-md) border-(length:--stroke-thin) p-3', report.ok ? 'border-(--success) bg-(--ok-bg)' : 'border-outline bg-card')}
      role="status"
      aria-live="polite"
    >
      <p className="m-0 flex items-center gap-2 text-lg font-extrabold">
        {report.ok ? <Check className="size-6 text-success" aria-hidden="true" /> : <X className="size-6 text-destructive" aria-hidden="true" />}
        {report.ok ? wt.step.passed : wt.step.almost}
      </p>
      <ul className="m-0 grid list-none gap-1 p-0">
        {report.results.map((r, i) => (
          <li key={i} className="flex gap-2">
            {r.ok ? <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /> : <X className="mt-0.5 size-5 shrink-0 text-destructive" aria-hidden="true" />}
            <span>{r.message}</span>
          </li>
        ))}
      </ul>
      {report.results.find((r) => !r.ok)?.hint && (
        <p className="m-0 flex gap-2 font-bold">
          <Lightbulb className="size-5 shrink-0" aria-hidden="true" />
          {report.results.find((r) => !r.ok)!.hint}
        </p>
      )}
      {shorter && (
        <p className="m-0 flex items-center gap-2 font-extrabold">
          <AnimIcon name="party" />
          {wt.step.shorter}
        </p>
      )}
    </div>
  )

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-2xl">{step.title[lang]}</h2>
        <Badge variant="outline">{step.mode === 'project' ? t.lesson.stepTypes.project : step.mode === 'debug' ? t.lesson.stepTypes.debug : t.lesson.stepTypes.wedo_code}</Badge>
      </div>

      <div className="rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4">
        <RichText text={step.task[lang]} className="text-xl [&>p:first-child]:mt-0 [&>p:last-child]:mb-0" />
      </div>

      {hintsShown > 0 && (
        <ol className="m-0 grid list-none gap-2 p-0" aria-live="polite">
          {step.hints.slice(0, hintsShown).map((h, i) => (
            <li key={i} className="flex gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 p-3 text-lg">
              <Lightbulb className="mt-1 size-5 shrink-0" aria-hidden="true" />
              <span>
                <span className="block text-xs font-extrabold text-muted-foreground">{fill(wt.step.hintOf, { n: i + 1, total: step.hints.length })}</span>
                {h[lang]}
              </span>
            </li>
          ))}
        </ol>
      )}

      {/* Phones and small tablets: one area at a time */}
      <div className="tab-tray lg:hidden" role="group" aria-label={wt.step.tabs.task}>
        {(['code', 'robot'] as const).map((p) => (
          <button key={p} type="button" className={cn(tabTriggerClass, 'min-h-12 text-base')} aria-pressed={panel === p} onClick={() => setPanel(p)}>
            {wt.step.tabs[p]}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <div className={cn('grid gap-2', panel !== 'code' && 'max-lg:hidden')}>
          <div className="flex justify-end">
            <Badge>{fill(wt.step.blocksCount, { n: wedoBlocks(program) })}</Badge>
          </div>
          <WedoEditor program={program} onChange={edit} palette={step.palette} t={wt} highlight={highlight} initial={step.start} label={wt.editor.program} />
        </div>
        <div className={cn('grid gap-3', panel !== 'robot' && 'max-lg:hidden')}>
          <WedoSimView scene={step.scene} program={program} scenario={step.scenario} runKey={runKey} mode={mode} t={wt} lang={lang} onStep={setHighlight} />
          <div className="max-lg:hidden">{reportBox}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonVariants({ variant: 'secondary', size: 'lg' })} onClick={run}>
          <Play aria-hidden="true" />
          {wt.step.run}
        </button>
        <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg' })} onClick={check}>
          <Check aria-hidden="true" />
          {wt.step.check}
        </button>
        <button type="button" className={buttonVariants({ variant: 'ghost', size: 'lg' })} onClick={() => setHintsShown((n) => Math.min(step.hints.length, n + 1))} disabled={hintsShown >= step.hints.length}>
          <Lightbulb aria-hidden="true" />
          {wt.step.hint}
        </button>
      </div>
      <div className="lg:hidden">{reportBox}</div>
    </div>
  )
}
