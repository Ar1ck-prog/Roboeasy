'use client'

import { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, Check, CircleHelp, X } from 'lucide-react'

import { Illustration } from '@/components/learn/illustrations'
import { RichText } from '@/components/learn/rich-text'
import { buttonVariants } from '@/components/ui/button'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { QuizStep as Quiz } from '@/lib/learn/schema'
import { cn } from '@/lib/utils'

import type { StepDone } from './simple-steps'

type Lang = 'ru' | 'kk' | 'en'

/**
 * Deterministic shuffle (same on server and client). By default never the
 * original order (for "put in order" tasks); `allowSame` for answer options,
 * where any order is fine but must not always put the right one first.
 */
export function shuffled<T>(items: T[], seed: string, allowSame = false): T[] {
  let h = 2166136261
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619)
  const out = items.map((item, i) => ({ item, k: (Math.imul(h ^ (i + 1) * 2654435761, 2246822519) >>> 0) / 4294967296 }))
  out.sort((a, b) => a.k - b.k)
  const res = out.map((o) => o.item)
  if (!allowSame && res.length > 1 && res.every((v, i) => v === items[i])) res.push(res.shift() as T)
  return res
}

/** `once`: a test question (placement, review) — one attempt, then the right answer is shown. */
export function QuizStep({ step, lang, t, done, once = false, onDone, onMistake }: { step: Quiz; lang: Lang; t: LearnText; done: boolean; once?: boolean; onDone: (d: StepDone) => void; onMistake: () => void }) {
  const [wrong, setWrong] = useState(0)
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct' | 'revealed' | 'missed'>(done ? 'correct' : 'idle')
  // Answers per kind
  const [picked, setPicked] = useState<number[]>([])
  const orderStart = useMemo(() => (step.kind === 'order' ? shuffled(step.items.map((_, i) => i), step.id) : []), [step])
  const [order, setOrder] = useState<number[]>(orderStart)
  const rights = useMemo(() => (step.kind === 'match' ? shuffled(step.pairs.map((_, i) => i), step.id) : []), [step])
  const [matches, setMatches] = useState<(number | null)[]>(() => (step.kind === 'match' ? step.pairs.map(() => null) : []))
  const [numberText, setNumberText] = useState('')
  const [gaps, setGaps] = useState<(number | null)[]>(() => (step.kind === 'fill' ? step.blanks.map(() => null) : []))
  // Options are authored with the right answer anywhere; shown in a stable mixed order.
  const choiceOrder = useMemo(() => (step.kind === 'choice' ? shuffled(step.options.map((_, i) => i), `${step.id}:options`, true) : []), [step])

  const finished = status === 'correct' || status === 'revealed' || status === 'missed'

  const isCorrect = (): boolean => {
    switch (step.kind) {
      case 'choice':
        return picked.length === step.correct.length && step.correct.every((c) => picked.includes(c))
      case 'order':
        return order.every((v, i) => v === i)
      case 'match':
        return matches.every((m, i) => m === i)
      case 'number': {
        const n = Number(numberText.replace(',', '.'))
        return numberText.trim() !== '' && Number.isFinite(n) && Math.abs(n - step.answer) <= step.tolerance
      }
      case 'fill':
        return step.blanks.every((b, i) => gaps[i] === b.correct)
    }
  }

  const check = () => {
    if (isCorrect()) {
      setStatus('correct')
      onDone({ firstTry: wrong === 0, hints: 0 })
    } else if (once) {
      onMistake()
      showAnswer()
      setStatus('missed')
      onDone({ firstTry: false, hints: 0 })
    } else {
      setWrong((w) => w + 1)
      setStatus('wrong')
      onMistake()
    }
  }

  const showAnswer = () => {
    if (step.kind === 'choice') setPicked(step.correct)
    if (step.kind === 'order') setOrder(step.items.map((_, i) => i))
    if (step.kind === 'match') setMatches(step.pairs.map((_, i) => i))
    if (step.kind === 'number') setNumberText(String(step.answer))
    if (step.kind === 'fill') setGaps(step.blanks.map((b) => b.correct))
  }

  const reveal = () => {
    showAnswer()
    setStatus('revealed')
    onDone({ firstTry: false, hints: 1 })
  }

  const multi = step.kind === 'choice' && step.correct.length > 1
  const ready =
    step.kind === 'choice'
      ? picked.length > 0
      : step.kind === 'match'
        ? matches.every((m) => m !== null)
        : step.kind === 'number'
          ? numberText.trim() !== ''
          : step.kind === 'fill'
            ? gaps.every((g) => g !== null)
            : true

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <h2 className="m-0 flex items-start gap-2 text-2xl">
        <CircleHelp className="mt-1 size-6 shrink-0" aria-hidden="true" />
        {step.question[lang]}
      </h2>

      {/* Optional picture for younger learners (WeDo lessons). */}
      {step.illustration && (
        <div className="mx-auto w-full max-w-sm rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2 p-3">
          <Illustration name={step.illustration} lang={lang} />
        </div>
      )}

      {step.kind === 'choice' && (
        <div role={multi ? 'group' : 'radiogroup'} className="grid gap-2">
          {choiceOrder.map((i, pos) => {
            const o = step.options[i]
            const on = picked.includes(i)
            return (
              <button
                key={i}
                type="button"
                role={multi ? 'checkbox' : 'radio'}
                aria-checked={on}
                disabled={finished}
                onClick={() => {
                  setStatus((s) => (s === 'wrong' ? 'idle' : s))
                  setPicked((p) => (multi ? (on ? p.filter((x) => x !== i) : [...p, i]) : [i]))
                }}
                className={cn(
                  'flex min-h-14 items-center gap-3 rounded-(--radius-sm) border-(length:--stroke) border-outline bg-card px-4 text-left text-lg font-bold shadow-(--shadow-press) transition-colors',
                  on && 'bg-primary text-primary-foreground',
                  finished && step.correct.includes(i) && 'bg-(--ok-bg) text-success',
                )}
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card font-display text-foreground">{String.fromCharCode(65 + pos)}</span>
                {o[lang]}
              </button>
            )
          })}
        </div>
      )}

      {step.kind === 'order' && (
        <ol className="m-0 grid list-none gap-2 p-0">
          {order.map((item, pos) => (
            <li key={item} className="flex items-center gap-2 rounded-(--radius-sm) border-(length:--stroke) border-outline bg-card px-3 py-2 text-lg font-bold">
              <span className="grid size-8 place-items-center rounded-full bg-surface-2 font-display">{pos + 1}</span>
              <span className="flex-1">{step.items[item][lang]}</span>
              <button
                type="button"
                className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
                aria-label={`${t.lesson.moveUp}: ${step.items[item][lang]}`}
                disabled={pos === 0 || finished}
                onClick={() => (setStatus('idle'), setOrder((o) => o.map((v, j) => (j === pos - 1 ? item : j === pos ? o[pos - 1] : v))))}
              >
                <ArrowUp aria-hidden="true" />
              </button>
              <button
                type="button"
                className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })}
                aria-label={`${t.lesson.moveDown}: ${step.items[item][lang]}`}
                disabled={pos === order.length - 1 || finished}
                onClick={() => (setStatus('idle'), setOrder((o) => o.map((v, j) => (j === pos + 1 ? item : j === pos ? o[pos + 1] : v))))}
              >
                <ArrowDown aria-hidden="true" />
              </button>
            </li>
          ))}
        </ol>
      )}

      {step.kind === 'match' && (
        <div className="grid gap-2">
          {step.pairs.map((pair, i) => (
            <label key={i} className="grid items-center gap-2 rounded-(--radius-sm) border-(length:--stroke) border-outline bg-card px-3 py-2 font-bold sm:grid-cols-[1fr_1fr]">
              <span className="text-lg">{pair.left[lang]}</span>
              <select
                className="select"
                aria-label={fill(t.lesson.pick, { left: pair.left[lang] })}
                value={matches[i] ?? ''}
                disabled={finished}
                onChange={(e) => (setStatus('idle'), setMatches((m) => m.map((v, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : v))))}
              >
                <option value="">—</option>
                {rights.map((r) => (
                  <option key={r} value={r}>
                    {step.pairs[r].right[lang]}
                  </option>
                ))}
              </select>
            </label>
          ))}
        </div>
      )}

      {step.kind === 'number' && (
        <label className="flex flex-wrap items-center gap-3 text-lg font-bold">
          <span className="sr-only">{t.lesson.number}</span>
          <input
            className="input max-w-40 text-2xl"
            inputMode="decimal"
            value={numberText}
            disabled={finished}
            onChange={(e) => (setStatus('idle'), setNumberText(e.target.value))}
            onKeyDown={(e) => e.key === 'Enter' && ready && !finished && check()}
            placeholder="?"
            aria-label={t.lesson.number}
          />
          {step.unit && <span>{step.unit[lang]}</span>}
        </label>
      )}

      {step.kind === 'fill' && (
        <pre className="code m-0 whitespace-pre-wrap" aria-label={t.lesson.codeGaps}>
          <code>
            {step.code.split(/(\[\[\d\]\])/g).map((part, k) => {
              const m = /^\[\[(\d)\]\]$/.exec(part)
              if (!m) return <span key={k}>{part}</span>
              const i = Number(m[1])
              const blank = step.blanks[i]
              const right = finished && gaps[i] === blank.correct
              return (
                <select
                  key={k}
                  className={cn(
                    'mx-0.5 inline-block cursor-pointer rounded-md border-2 border-dashed border-[#ffd76a] bg-[#2a3042] px-1.5 py-0.5 font-mono text-[#ffd76a]',
                    gaps[i] !== null && 'border-solid',
                    right && 'border-[#2bb673] text-[#a8e6c4]',
                  )}
                  aria-label={fill(t.lesson.gap, { n: i + 1 })}
                  value={gaps[i] ?? ''}
                  disabled={finished}
                  onChange={(e) => (setStatus('idle'), setGaps((g) => g.map((v, j) => (j === i ? (e.target.value === '' ? null : Number(e.target.value)) : v))))}
                >
                  <option value="">___</option>
                  {blank.options.map((o, j) => (
                    <option key={j} value={j}>
                      {o}
                    </option>
                  ))}
                </select>
              )
            })}
          </code>
        </pre>
      )}

      <div aria-live="polite" className="grid gap-3">
        {status === 'wrong' && (
          <p className="alert m-0" role="status">
            <X size={18} aria-hidden="true" />
            <span>{t.lesson.wrong}</span>
          </p>
        )}
        {finished && (
          <div className={cn('alert m-0 grid gap-1', status !== 'missed' && 'alert-ok')} role="status">
            <span className="flex items-center gap-2 font-extrabold">
              {status === 'missed' ? <X size={18} aria-hidden="true" /> : <Check size={18} aria-hidden="true" />}
              {status === 'correct' ? t.lesson.correct : t.lesson.answer}
            </span>
            <RichText text={step.explanation[lang]} className="font-medium text-foreground" />
          </div>
        )}
      </div>

      {!finished && (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={buttonVariants({ variant: 'primary', size: 'lg' })} disabled={!ready} onClick={check}>
            <Check aria-hidden="true" />
            {t.lesson.check}
          </button>
          {wrong >= 2 && (
            <button type="button" className={buttonVariants({ variant: 'ghost', size: 'lg' })} onClick={reveal}>
              {t.lesson.showAnswer}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
