'use client'

import { type ReactNode, useEffect, useState } from 'react'
import { Check, FileDown, Hammer, SkipForward } from 'lucide-react'

import { BlockStack } from '@/components/block-stack'
import { Illustration } from '@/components/learn/illustrations'
import { RichText } from '@/components/learn/rich-text'
import { RobotPanel, SendToRobot } from '@/components/robot-link'
import { AnimIcon } from '@/components/ui/anim-icon'
import { buttonVariants } from '@/components/ui/button'
import { compilerFor } from '@/lib/compilers'
import { programToPython } from '@/lib/dsl/compile-python'
import { DEFAULT_ROBOT, type Step } from '@/lib/dsl/types'
import type { Dictionary } from '@/lib/i18n/ru'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { LessonStep } from '@/lib/learn/schema'
import { XP_RULES } from '@/lib/learn/xp'

type Lang = 'ru' | 'kk' | 'en'
export interface StepDone {
  firstTry: boolean
  hints: number
  blocks?: number
  /** For real_robot: the learner did it on a real robot (not skipped). */
  real?: boolean
  /** The solution of a code step. */
  program?: Step[]
}

export async function downloadProgram(name: string, steps: Step[]) {
  const spike = compilerFor('spike')
  if (!spike) return
  const blob = await spike.pack(name, { title: name, description: '', steps }, DEFAULT_ROBOT, 'blocks')
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${
    name
      .replace(/[^\p{L}\p{N}_\- ]+/gu, '')
      .trim()
      .replace(/\s+/g, '_') || 'RoboEasy'
  }.llsp3`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function TheoryStep({
  step,
  lang,
  blocksT,
  onDone,
}: {
  step: Extract<LessonStep, { type: 'theory' }>
  lang: Lang
  blocksT: Dictionary['blocks']
  onDone: (d: StepDone) => void
}) {
  useEffect(() => onDone({ firstTry: true, hints: 0 }), [onDone])
  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-start">
      <div>
        <h2 className="m-0 text-2xl">{step.title[lang]}</h2>
        <RichText text={step.body[lang]} className="text-lg" />
      </div>
      {(step.illustration || step.example) && (
        <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 p-4">
          {step.illustration && <Illustration name={step.illustration} lang={lang} />}
          {step.example && (
            <div className="canvas">
              <BlockStack program={{ steps: step.example }} labels={blocksT} robot={DEFAULT_ROBOT} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function BuildStep({
  step,
  lang,
  t,
  onDone,
}: {
  step: Extract<LessonStep, { type: 'build' }>
  lang: Lang
  t: LearnText
  onDone: (d: StepDone) => void
}) {
  useEffect(() => onDone({ firstTry: true, hints: 0 }), [onDone])
  return (
    <div className="grid gap-4">
      <h2 className="m-0 flex items-center gap-2 text-2xl">
        <Hammer className="size-6" aria-hidden="true" />
        {step.title[lang]}
      </h2>
      <RichText text={step.intro[lang]} className="text-lg" />
      <p className="m-0 text-sm text-muted-foreground">{t.lesson.buildNote}</p>
      <ol className="m-0 grid list-none gap-3 p-0">
        {step.instructions.map((ins, i) => (
          <li
            key={i}
            className="grid gap-2 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4 sm:grid-cols-[auto_1fr_160px] sm:items-center"
          >
            <span className="grid size-9 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary font-display font-extrabold text-primary-foreground">
              {i + 1}
            </span>
            <RichText text={ins.text[lang]} />
            {ins.illustration && <Illustration name={ins.illustration} lang={lang} />}
          </li>
        ))}
      </ol>
    </div>
  )
}

export function RealRobotStep({
  step,
  lang,
  t,
  done,
  onDone,
}: {
  step: Extract<LessonStep, { type: 'real_robot' }>
  lang: Lang
  t: LearnText
  done: boolean
  onDone: (d: StepDone) => void
}) {
  const [checked, setChecked] = useState<boolean[]>(() => step.checklist.map(() => done))
  return (
    <div className="grid gap-4 md:grid-cols-[1.2fr_1fr] md:items-start">
      <div className="grid gap-3">
        <h2 className="m-0 flex items-center gap-2 text-2xl">
          <AnimIcon name="robot" />
          {step.title[lang]}
        </h2>
        <RichText text={step.task[lang]} className="text-lg" />
        <p className="m-0 font-bold text-success">{fill(t.lesson.bonus, { xp: XP_RULES.realRobot })}</p>
      </div>
      <div className="grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4">
        {step.program && (
          <button
            type="button"
            className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'justify-self-start' })}
            onClick={() => void downloadProgram(step.title[lang], step.program!)}
          >
            <FileDown aria-hidden="true" />
            {t.lesson.download}
          </button>
        )}
        {step.program && (
          <>
            <RobotPanel lang={lang} />
            <SendToRobot
              lang={lang}
              code={() => programToPython({ title: step.title[lang], description: '', steps: step.program! }, DEFAULT_ROBOT)}
              className="justify-self-start"
            />
          </>
        )}
        <ul className="m-0 grid list-none gap-2 p-0">
          {step.checklist.map((c, i) => (
            <li key={i}>
              <label className="flex cursor-pointer items-center gap-3 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-surface-2 px-3 py-2 font-bold">
                <input
                  type="checkbox"
                  className="size-5 accent-(--success)"
                  checked={checked[i]}
                  onChange={(e) => setChecked((cs) => cs.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                {c[lang]}
              </label>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={buttonVariants({ variant: 'primary' })}
            disabled={!checked.every(Boolean)}
            onClick={() => onDone({ firstTry: true, hints: 0, real: true })}
          >
            <Check aria-hidden="true" />
            {t.lesson.did}
          </button>
          <button type="button" className={buttonVariants({ variant: 'ghost' })} onClick={() => onDone({ firstTry: true, hints: 0, real: false })}>
            <SkipForward aria-hidden="true" />
            {t.lesson.skip}
          </button>
        </div>
      </div>
    </div>
  )
}
