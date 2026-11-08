'use client'

import { type FormEvent, useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bot, Loader2, Send, X } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import type { Locale } from '@/lib/i18n/config'
import type { SiteMentorText } from '@/lib/i18n/site-mentor'
import { getMentorProgram } from '@/lib/learn/mentor-context'
import type { SiteMentorResponse } from '@/lib/learn/site-mentor'
import { cn } from '@/lib/utils'

const MAX_QUESTION = 300
const MAX_HISTORY = 8
const MAX_PROGRAM = 6000
/** Lessons have their own mentor and a footer in this corner; the others are not for learners. */
const HIDDEN = /^\/[a-z]{2}\/(learn\/[^/]+\/[^/]+|preview|design|admin|cert)(\/|$)/

interface Message {
  from: 'me' | 'mentor'
  text: string
  /** Shown to the learner, not sent back to the AI. */
  failed?: boolean
}

/** The mentor chat, in the corner of every page. Messages live only in this tab until it is closed. */
export function SiteMentor({ lang, t }: { lang: Locale; t: SiteMentorText }) {
  const pathname = usePathname() ?? `/${lang}`
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const listRef = useRef<HTMLOListElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const launcherRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (open) inputRef.current?.focus()
  }, [open])

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, busy])

  // On the document: focus can be nowhere, e.g. after a suggestion button disappears.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setOpen(false)
      requestAnimationFrame(() => launcherRef.current?.focus())
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (HIDDEN.test(pathname)) return null

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => launcherRef.current?.focus())
  }

  const ask = async (question: string) => {
    if (busy) return
    const mine: Message = { from: 'me', text: question }
    const history = [...messages.filter((m) => !m.failed), mine].slice(-MAX_HISTORY).map(({ from, text }) => ({ from, text }))
    setMessages((m) => [...m, mine])
    setInput('')
    inputRef.current?.focus()
    setBusy(true)
    let reply: Message
    try {
      const res = await fetch('/api/mentor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lang, page: pathname, messages: history, program: getMentorProgram()?.slice(0, MAX_PROGRAM) }),
      })
      const data = (await res.json()) as SiteMentorResponse
      reply = data.ok ? { from: 'mentor', text: data.answer } : { from: 'mentor', text: t.errors[data.error], failed: true }
    } catch {
      reply = { from: 'mentor', text: t.errors.offline, failed: true }
    }
    setMessages((m) => [...m, reply])
    setBusy(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const question = input.trim()
    if (question) void ask(question)
  }

  // Above the phone tab bar, in the corner on larger screens.
  const corner = 'fixed right-4 bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-50 md:right-6 md:bottom-6'

  if (!open)
    return (
      <button
        ref={launcherRef}
        type="button"
        className={cn(buttonVariants({ variant: 'primary' }), corner, 'size-14 rounded-full p-0 md:w-auto md:px-5')}
        aria-label={t.open}
        onClick={() => setOpen(true)}
      >
        <Bot className="size-6" aria-hidden="true" />
        <span className="hidden md:inline">{t.title}</span>
      </button>
    )

  return (
    <section
      className={cn(
        corner,
        'grid h-[min(34rem,calc(100dvh-7.5rem))] w-[min(24rem,calc(100vw-2rem))] grid-rows-[auto_minmax(0,1fr)_auto] rounded-(--radius-md) border-(length:--stroke) border-outline bg-card shadow-(--shadow-hard)',
      )}
      aria-label={t.title}
      data-testid="site-mentor"
    >
      <header className="flex items-center justify-between gap-2 border-b-(length:--stroke-thin) border-outline px-3 py-2">
        <h2 className="m-0 flex items-center gap-2 text-lg">
          <span className="grid size-8 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-primary text-primary-foreground">
            <Bot className="size-4" aria-hidden="true" />
          </span>
          {t.title}
        </h2>
        <button type="button" className={buttonVariants({ size: 'icon-sm', variant: 'ghost' })} aria-label={t.close} onClick={close}>
          <X aria-hidden="true" />
        </button>
      </header>

      <ol ref={listRef} className="m-0 grid list-none content-start gap-2 overflow-y-auto p-3" aria-live="polite">
        <li className="max-w-[92%] rounded-(--radius-sm) border-(length:--stroke-thin) border-outline px-3 py-2">{t.hello}</li>
        {messages.map((m, i) => (
          <li
            key={i}
            className={cn(
              'rounded-(--radius-sm) px-3 py-2 break-words whitespace-pre-wrap',
              m.from === 'me' ? 'max-w-[85%] justify-self-end bg-surface-2 font-bold' : 'max-w-[92%] border-(length:--stroke-thin) border-outline',
              m.failed && 'text-muted-foreground',
            )}
          >
            {m.text}
          </li>
        ))}
        {busy && (
          <li className="flex items-center gap-2 px-1 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t.thinking}
          </li>
        )}
      </ol>

      <div className="grid gap-2 border-t-(length:--stroke-thin) border-outline p-3">
        {messages.length === 0 && (
          <div className="flex flex-wrap gap-1.5">
            {t.suggestions.map((s) => (
              <button
                key={s}
                type="button"
                className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'min-h-8 border-(length:--stroke-thin) border-outline px-2.5 text-sm' })}
                onClick={() => void ask(s)}
              >
                {s}
              </button>
            ))}
          </div>
        )}
        <form className="flex gap-2" onSubmit={submit}>
          <label className="sr-only" htmlFor="site-mentor-input">
            {t.placeholder}
          </label>
          <input
            ref={inputRef}
            id="site-mentor-input"
            className="input"
            value={input}
            maxLength={MAX_QUESTION}
            placeholder={t.placeholder}
            autoComplete="off"
            onChange={(e) => setInput(e.target.value)}
          />
          <button type="submit" className={buttonVariants({ size: 'icon' })} aria-label={t.send} disabled={busy || !input.trim()}>
            <Send aria-hidden="true" />
          </button>
        </form>
        <p className="m-0 text-xs text-muted-foreground">{t.note}</p>
      </div>
    </section>
  )
}
