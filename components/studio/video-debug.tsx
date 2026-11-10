'use client'

import { type ChangeEvent, useEffect, useState } from 'react'
import { Camera, Lightbulb, Loader2, Send } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { deviceHeaders } from '@/lib/device-id'
import { programToPython } from '@/lib/dsl/compile-python'
import { type Locale, fill } from '@/lib/i18n/config'
import type { VideoText } from '@/lib/i18n/video'
import { type HistoryItem, loadHistory } from '@/lib/studio-state'
import type { VideoResponse } from '@/lib/video/debug'
import { VideoError, type VideoFrame, extractFrames } from '@/lib/video/frames'

const programText = (item: HistoryItem) => {
  const r = item.result
  if (r.format === 'blocks') return r.python
  return r.program ? programToPython(r.program) : r.code
}

export function VideoDebug({ lang, t }: { lang: Locale; t: VideoText }) {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [chosen, setChosen] = useState('')
  const [expected, setExpected] = useState('')
  const [frames, setFrames] = useState<VideoFrame[] | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [sending, setSending] = useState(false)
  const [problem, setProblem] = useState('')
  const [answer, setAnswer] = useState<Extract<VideoResponse, { ok: true }> | null>(null)
  const [hintOpen, setHintOpen] = useState(false)

  useEffect(() => {
    const items = loadHistory()
    setHistory(items)
    if (items[0]) setChosen(items[0].id)
  }, [])

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setProblem('')
    setAnswer(null)
    setFrames(null)
    setPreparing(true)
    try {
      setFrames(await extractFrames(file))
    } catch (error) {
      setProblem(error instanceof VideoError ? t.errors[error.code] : t.errors.unreadable)
    }
    setPreparing(false)
  }

  const send = async () => {
    const item = history.find((h) => h.id === chosen)
    if (!frames || !item) return
    setSending(true)
    setProblem('')
    setAnswer(null)
    setHintOpen(false)
    try {
      const res = await fetch('/api/video-debug', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...deviceHeaders() },
        body: JSON.stringify({ lang, expected, program: programText(item).slice(0, 6000), frames }),
      })
      const data = (await res.json()) as VideoResponse
      if (data.ok) setAnswer(data)
      else setProblem(fill(t.errors[data.error], { m: Math.max(1, Math.ceil((data.retryAfter ?? 60) / 60)) }))
    } catch {
      setProblem(t.errors.offline)
    }
    setSending(false)
  }

  const ready = frames !== null && chosen !== '' && expected.trim().length >= 3 && !sending

  return (
    <div className="container grid max-w-3xl gap-6 py-6">
      <header className="grid gap-1">
        <h1 className="m-0 text-3xl">{t.title}</h1>
        <p className="m-0 text-muted-foreground">{t.lead}</p>
      </header>

      <p className="alert alert-warn m-0" role="note">
        {t.privacy}
      </p>

      <Card className="gap-4">
        <label className={buttonVariants({ variant: 'primary', className: 'cursor-pointer justify-self-start' })}>
          {preparing ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Camera aria-hidden="true" />}
          {t.choose}
          <input type="file" accept="video/*" capture="environment" className="sr-only" data-testid="video-input" onChange={(e) => void pick(e)} />
        </label>
        {frames && (
          <p className="m-0 text-sm font-bold text-success" role="status">
            {fill(t.ready, { n: frames.length })}
          </p>
        )}

        <label className="grid gap-1 font-bold">
          {t.program}
          {history.length ? (
            <select className="select" value={chosen} onChange={(e) => setChosen(e.target.value)}>
              {history.map((h) => (
                <option key={h.id} value={h.id}>
                  {h.result.title}
                </option>
              ))}
            </select>
          ) : (
            <span className="font-normal text-muted-foreground">{t.noPrograms}</span>
          )}
        </label>

        <label className="grid gap-1 font-bold">
          {t.expected}
          <textarea className="textarea" rows={2} maxLength={300} value={expected} onChange={(e) => setExpected(e.target.value)} placeholder={t.expectedHint} />
        </label>

        <button type="button" className={buttonVariants({ variant: 'primary', className: 'justify-self-start' })} disabled={!ready} onClick={() => void send()}>
          {sending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Send aria-hidden="true" />}
          {sending ? t.sending : t.send}
        </button>
        <p className="m-0 text-sm text-muted-foreground">{t.limit}</p>
        {problem && (
          <p className="alert m-0" role="alert">
            {problem}
          </p>
        )}
      </Card>

      {answer && (
        <Card className="gap-3" data-testid="video-answer">
          <CardTitle>{t.answerTitle}</CardTitle>
          {answer.observed && <p className="m-0">{answer.observed}</p>}
          <p className="m-0 text-lg font-bold">{answer.question}</p>
          {answer.hint &&
            (hintOpen ? (
              <p className="alert m-0 flex gap-2">
                <Lightbulb className="size-5 shrink-0" aria-hidden="true" />
                {answer.hint}
              </p>
            ) : (
              <button type="button" className={buttonVariants({ size: 'sm', className: 'justify-self-start' })} onClick={() => setHintOpen(true)}>
                <Lightbulb aria-hidden="true" />
                {t.showHint}
              </button>
            ))}
          <p className="m-0 text-sm text-muted-foreground">{fill(t.remaining, { n: answer.remaining })}</p>
        </Card>
      )}
    </div>
  )
}
