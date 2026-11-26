'use client'

/**
 * "What will the robot do?" for WeDo: the program is shown read-only, the
 * child picks one of 2–3 answers, then watches the run (with the lesson's
 * scenario) and reads why.
 */

import { useMemo, useState } from 'react'
import { Check, Eye, RotateCcw, X } from 'lucide-react'

import { Illustration } from '@/components/learn/illustrations'
import { RichText } from '@/components/learn/rich-text'
import { shuffled } from '@/components/learn/steps/quiz-step'
import type { StepDone } from '@/components/learn/steps/simple-steps'
import { buttonVariants } from '@/components/ui/button'
import type { WedoText } from '@/lib/i18n/wedo'
import type { ClientStep } from '@/lib/learn/content'
import { cn } from '@/lib/utils'

import { WedoEditor } from './wedo-editor'
import { WedoSimView } from './wedo-sim-view'

type Lang = 'ru' | 'kk' | 'en'
type Step = Extract<ClientStep, { type: 'wedo_predict' }>

export function WedoPredictStep({ step, lang, wt, done, onDone, onMistake }: { step: Step; lang: Lang; wt: WedoText; done: boolean; onDone: (d: StepDone) => void; onMistake: () => void }) {
  const [choice, setChoice] = useState<number | null>(done ? step.correct : null)
  const [revealed, setRevealed] = useState(done)
  const [runKey, setRunKey] = useState(0)
  const [highlight, setHighlight] = useState<string | null>(null)
  const order = useMemo(() => shuffled(step.options.map((_, i) => i), `${step.id}:options`, true), [step])
  const right = choice === step.correct

  const reveal = () => {
    if (choice === null) return
    setRevealed(true)
    setRunKey((k) => k + 1)
    if (!right) onMistake()
    onDone({ firstTry: right, hints: 0 })
  }

  return (
    <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
      <div className="grid gap-3">
        <h2 className="m-0 text-2xl">{step.title[lang]}</h2>
        <RichText text={step.question[lang]} className="text-xl" />
        <WedoEditor program={step.program} palette={[]} t={wt} highlight={highlight} readOnly label={wt.editor.program} />
        <div role="radiogroup" aria-label={wt.step.predictPick} className="grid gap-2">
          {order.map((i) => {
            const o = step.options[i]
            return (
              <button
                key={i}
                type="button"
                role="radio"
                aria-checked={choice === i}
                disabled={revealed}
                onClick={() => setChoice(i)}
                className={cn(
                  'flex min-h-14 cursor-pointer items-center gap-3 rounded-(--radius-md) border-(length:--stroke) border-outline bg-card p-3 text-left text-lg font-bold shadow-(--shadow-press) focus-visible:ring-3 focus-visible:ring-(--focus) focus-visible:outline-none disabled:cursor-default',
                  choice === i && 'ring-3 ring-(--focus)',
                  revealed && i === step.correct && 'bg-(--ok-bg)',
                )}
              >
                {o.illustration && (
                  <span className="w-20 shrink-0">
                    <Illustration name={o.illustration} lang={lang} />
                  </span>
                )}
                <span>{o.label[lang]}</span>
                {revealed && i === step.correct && <Check className="ml-auto size-6 shrink-0 text-success" aria-hidden="true" />}
              </button>
            )
          })}
        </div>
        {!revealed ? (
          <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg', className: 'justify-self-start' })} disabled={choice === null} onClick={reveal}>
            <Eye aria-hidden="true" />
            {wt.step.check}
          </button>
        ) : (
          <div className={cn('alert m-0 grid gap-1', right && 'alert-ok')} role="status" aria-live="polite">
            <span className="flex items-center gap-2 text-lg font-extrabold">
              {right ? <Check size={20} aria-hidden="true" /> : <X size={20} aria-hidden="true" />}
              {right ? wt.step.predictRight : wt.step.predictWrong}
            </span>
            <RichText text={step.explanation[lang]} className="text-lg font-medium text-foreground" />
          </div>
        )}
      </div>
      <div className="grid gap-3">
        <WedoSimView scene={step.scene} program={step.program} scenario={step.scenario} runKey={runKey} mode="scripted" t={wt} lang={lang} onStep={setHighlight} />
        {revealed && (
          <button type="button" className={buttonVariants({ variant: 'ghost', className: 'justify-self-start' })} onClick={() => setRunKey((k) => k + 1)}>
            <RotateCcw aria-hidden="true" />
            {wt.step.predictReplay}
          </button>
        )}
      </div>
    </div>
  )
}
