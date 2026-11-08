'use client'

import { useState } from 'react'
import { Lightbulb, Loader2, MessageCircleQuestion, Send, X } from 'lucide-react'

import { AnimIcon } from '@/components/ui/anim-icon'
import { buttonVariants } from '@/components/ui/button'
import type { Step } from '@/lib/dsl/types'
import { fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { MentorResponse } from '@/lib/learn/mentor'

interface MentorProps {
  lessonId: string
  stepId: string
  lang: 'ru' | 'kk' | 'en'
  t: LearnText
  lessonHints: string[]
  getContext: () => { steps: Step[]; failed: string[] }
}

interface Message {
  from: 'me' | 'mentor'
  text: string
  level?: number
}

/** AI mentor: graded hints (question → what to look at → a fragment), never the solution. */
export function Mentor({ lessonId, stepId, lang, t, lessonHints, getContext }: MentorProps) {
  const [open, setOpen] = useState(false)
  const [level, setLevel] = useState(0)
  const [question, setQuestion] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])

  const ask = async (nextLevel: number, q?: string) => {
    setBusy(true)
    if (q) setMessages((m) => [...m, { from: 'me', text: q }])
    const { steps, failed } = getContext()
    let text = lessonHints[Math.min(nextLevel, lessonHints.length) - 1] ?? t.mentor.offline
    try {
      const res = await fetch('/api/learn/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, stepId, lang, level: nextLevel, question: q, program: steps, failed }),
      })
      const data = (await res.json()) as MentorResponse
      if (data.ok) text = data.hint
      else if (data.error === 'daily_limit') text = t.mentor.limit
    } catch {
      text = `${t.mentor.offline} ${text}`
    }
    setMessages((m) => [...m, { from: 'mentor', text, level: q ? undefined : nextLevel }])
    setLevel(nextLevel)
    setBusy(false)
  }

  if (!open)
    return (
      <button type="button" className={buttonVariants({ variant: 'secondary', size: 'sm', className: 'justify-self-start' })} onClick={() => setOpen(true)}>
        <MessageCircleQuestion aria-hidden="true" />
        {t.mentor.open}
      </button>
    )

  return (
    <section className="grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-3" aria-label={t.mentor.title}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="m-0 flex items-center gap-2 text-lg">
          <span className="grid size-8 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
            <Lightbulb className="size-4" aria-hidden="true" />
          </span>
          {t.mentor.title}
        </h3>
        <button type="button" className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })} aria-label={t.mentor.close} onClick={() => setOpen(false)}>
          <X aria-hidden="true" />
        </button>
      </div>
      <p className="m-0 text-sm text-muted-foreground">
        {t.mentor.intro} <AnimIcon name="smile" />
      </p>
      <ol className="m-0 grid max-h-64 list-none gap-2 overflow-auto p-0" aria-live="polite">
        {messages.map((m, i) => (
          <li
            key={i}
            className={
              m.from === 'me'
                ? 'max-w-[85%] justify-self-end rounded-(--radius-sm) bg-surface-2 px-3 py-2 font-bold'
                : 'max-w-[92%] rounded-(--radius-sm) border-(length:--stroke-thin) border-outline px-3 py-2'
            }
          >
            {m.level && <span className="block text-xs font-extrabold text-muted-foreground">{fill(t.mentor.level, { n: m.level })}</span>}
            {m.text}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={buttonVariants({ variant: 'primary', size: 'sm' })} disabled={busy || level >= 3} onClick={() => void ask(level + 1)}>
          {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Lightbulb aria-hidden="true" />}
          {level === 0 ? t.lesson.hint : t.mentor.more}
        </button>
      </div>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          const q = question.trim()
          if (!q || busy) return
          setQuestion('')
          void ask(Math.max(1, level), q)
        }}
      >
        <label className="sr-only" htmlFor={`mentor-${stepId}`}>
          {t.mentor.placeholder}
        </label>
        <input
          id={`mentor-${stepId}`}
          className="input"
          value={question}
          maxLength={300}
          placeholder={t.mentor.placeholder}
          onChange={(e) => setQuestion(e.target.value)}
        />
        <button type="submit" className={buttonVariants({ size: 'icon' })} aria-label={t.mentor.ask} disabled={busy || !question.trim()}>
          {busy ? <Loader2 className="spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
        </button>
      </form>
    </section>
  )
}
