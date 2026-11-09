'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Check, ClipboardCheck, LogOut, MessageCircleQuestion, Puzzle, Trophy } from 'lucide-react'

import { useCloudModule, CLOUD_CONFIGURED } from '@/components/learn/use-cloud'
import { CodeStep } from '@/components/learn/steps/code-step'
import type { StepDone } from '@/components/learn/steps/simple-steps'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type Locale, fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import type { PilotText } from '@/lib/i18n/pilot'
import type { Dictionary } from '@/lib/i18n/ru'
import { useLearn } from '@/lib/learn/store'
import type { ClientPilotTask, ClientQuestion } from '@/lib/pilot/content'
import {
  PilotError,
  type PilotErrorCode,
  type StudentStatus,
  joinClass,
  leaveClass,
  markAttendance,
  recordTask,
  studentStatus,
  submitSurvey,
  submitTest,
} from '@/lib/pilot/client'

interface Props {
  lang: Locale
  t: PilotText
  learn: LearnText
  blocks: Dictionary['blocks']
  questions: ClientQuestion[]
  tasks: ClientPilotTask[]
}

type View = 'home' | 'pre' | 'post' | 'tasks' | 'survey'

export function StudentClass({ lang, t, learn, blocks, questions, tasks }: Props) {
  const mod = useCloudModule()
  const state = useLearn()
  const [status, setStatus] = useState<StudentStatus | null | undefined>(undefined)
  const [view, setView] = useState<View>('home')
  const lessons = state.events.filter((e) => e.kind === 'lesson_done').length
  const marked = useRef<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await studentStatus())
    } catch {
      setStatus(null)
    }
  }, [])

  useEffect(() => {
    if (mod) void refresh()
  }, [mod, refresh])

  useEffect(() => {
    if (!status || marked.current === status.member_id) return
    marked.current = status.member_id
    void markAttendance(status.member_id, lessons)
  }, [status, lessons])

  if (!CLOUD_CONFIGURED) return <p className="container alert alert-warn my-10">{t.unavailable}</p>
  if (!mod || status === undefined) return <Skeleton className="container my-10 h-96" />
  if (!status) return <JoinForm lang={lang} t={t} onJoined={refresh} />

  const back = () => {
    setView('home')
    void refresh()
  }

  if (view === 'pre' || view === 'post') return <TestRunner lang={lang} t={t} kind={view} member={status.member_id} questions={questions} onBack={back} />
  if (view === 'tasks') return <Tasks lang={lang} t={t} learn={learn} blocks={blocks} tasks={tasks} status={status} onBack={back} />
  if (view === 'survey') return <Survey t={t} member={status.member_id} onBack={back} />
  return <Home lang={lang} t={t} status={status} taskTotal={tasks.length} open={setView} onLeft={refresh} />
}

function JoinForm({ lang, t, onJoined }: { lang: Locale; t: PilotText; onJoined: () => Promise<void> }) {
  const [code, setCode] = useState('')
  const [nickname, setNickname] = useState('')
  const [pin, setPin] = useState('')
  const [consent, setConsent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<PilotErrorCode | null>(null)

  useEffect(() => {
    const fromLink = new URLSearchParams(window.location.search).get('code')
    if (fromLink) setCode(fromLink.toUpperCase().slice(0, 6))
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await joinClass(code, nickname, pin)
      await onJoined()
    } catch (err) {
      setError(err instanceof PilotError ? err.code : 'failed')
    }
    setBusy(false)
  }

  return (
    <div className="container grid max-w-xl gap-6 py-10">
      <header className="grid gap-2">
        <h1 className="m-0 text-4xl">{t.join.title}</h1>
        <p className="m-0 text-lg text-muted-foreground">{t.join.lead}</p>
      </header>
      <Card>
        <form className="grid gap-4" onSubmit={submit}>
          <label className="grid gap-1 font-bold">
            {t.join.code}
            <input className="input uppercase" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} maxLength={6} required autoComplete="off" />
          </label>
          <label className="grid gap-1 font-bold">
            {t.join.nickname}
            <input className="input" value={nickname} onChange={(e) => setNickname(e.target.value)} maxLength={24} required autoComplete="off" />
            <small className="font-normal text-muted-foreground">{t.join.nicknameHint}</small>
          </label>
          <label className="grid gap-1 font-bold">
            {t.join.pin}
            <input
              className="input"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
              inputMode="numeric"
              pattern="[0-9]{4}"
              required
              autoComplete="off"
            />
            <small className="font-normal text-muted-foreground">{t.join.pinHint}</small>
          </label>
          <label className="flex items-start gap-2">
            <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} required />
            <span>
              {t.join.consent}.{' '}
              <Link className="underline" href={`/${lang}/parents/consent`} target="_blank">
                {t.join.consentLink}
              </Link>
            </span>
          </label>
          {error && (
            <p className="alert m-0" role="alert">
              {t.errors[error]}
            </p>
          )}
          <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={busy}>
            {t.join.submit}
          </button>
        </form>
      </Card>
    </div>
  )
}

function Home({
  lang: _lang,
  t,
  status,
  taskTotal,
  open,
  onLeft,
}: {
  lang: Locale
  t: PilotText
  status: StudentStatus
  taskTotal: number
  open: (v: View) => void
  onLeft: () => Promise<void>
}) {
  const s = status
  const preDone = s.pre_score !== null
  const postDone = s.post_score !== null
  const score = (n: number | null) => (n === null ? '' : fill(t.home.score, { score: n, total: s.total }))

  const rows: { key: View; icon: typeof Trophy; title: string; done: boolean; note: string; enabled: boolean }[] = [
    { key: 'pre', icon: ClipboardCheck, title: t.home.pre, done: preDone, note: score(s.pre_score), enabled: !preDone },
    {
      key: 'tasks',
      icon: Puzzle,
      title: t.home.tasks,
      done: s.tasks_done.length >= taskTotal,
      note: fill(t.home.tasksDone, { n: s.tasks_done.length, total: taskTotal }),
      enabled: preDone,
    },
    {
      key: 'post',
      icon: Trophy,
      title: t.home.post,
      done: postDone,
      note: postDone ? score(s.post_score) : !preDone ? t.home.needPre : s.post_open ? '' : t.home.postClosed,
      enabled: preDone && s.post_open && !postDone,
    },
    { key: 'survey', icon: MessageCircleQuestion, title: t.home.survey, done: s.survey_done, note: '', enabled: postDone && !s.survey_done },
  ]

  return (
    <div className="container grid max-w-2xl gap-6 py-10">
      <h1 className="m-0 text-3xl">{fill(t.home.hello, { name: s.nickname, cls: s.class_name })}</h1>
      <Card className="gap-3">
        <CardTitle>{t.home.steps}</CardTitle>
        <ul className="m-0 grid list-none gap-3 p-0">
          {rows.map((r) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3">
              <r.icon className="size-6 shrink-0" aria-hidden="true" />
              <span className="min-w-40 flex-1">
                <strong>{r.title}</strong>
                {r.note && <small className="block text-muted-foreground">{r.note}</small>}
              </span>
              {r.done ? (
                <span className="inline-flex items-center gap-1 font-bold text-success">
                  <Check className="size-4" aria-hidden="true" />
                  {t.home.done}
                </span>
              ) : (
                <button
                  type="button"
                  className={buttonVariants({ variant: 'primary', size: 'sm' })}
                  disabled={!r.enabled}
                  aria-label={`${t.home.start}: ${r.title}`}
                  onClick={() => open(r.key)}
                >
                  {t.home.start}
                </button>
              )}
            </li>
          ))}
        </ul>
      </Card>
      <button
        type="button"
        className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'justify-self-start' })}
        onClick={async () => {
          if (!window.confirm(t.home.leaveConfirm)) return
          await leaveClass(s.member_id)
          await onLeft()
        }}
      >
        <LogOut aria-hidden="true" />
        {t.home.leave}
      </button>
    </div>
  )
}

function BackLink({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <button type="button" className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'justify-self-start' })} onClick={onBack}>
      <ArrowLeft aria-hidden="true" />
      {label}
    </button>
  )
}

function TestRunner({
  lang,
  t,
  kind,
  member,
  questions,
  onBack,
}: {
  lang: Locale
  t: PilotText
  kind: 'pre' | 'post'
  member: string
  questions: ClientQuestion[]
  onBack: () => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [score, setScore] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  const q = questions[index]
  const last = index === questions.length - 1

  const finish = async () => {
    setBusy(true)
    setFailed(false)
    try {
      setScore(await submitTest(member, kind, answers))
    } catch {
      setFailed(true)
    }
    setBusy(false)
  }

  if (score !== null)
    return (
      <div className="container grid max-w-2xl gap-6 py-10">
        <h1 className="m-0 text-3xl">{fill(t.test.result, { score, total: questions.length })}</h1>
        <BackLink label={t.home.back} onBack={onBack} />
      </div>
    )

  return (
    <div className="container grid max-w-2xl gap-6 py-10">
      <header className="grid gap-1">
        <h1 className="m-0 text-3xl">{t.test[kind]}</h1>
        <p className="m-0 text-muted-foreground">{t.test.note}</p>
      </header>
      <Card className="gap-4">
        <p className="m-0 text-sm font-bold text-muted-foreground">{fill(t.test.question, { n: index + 1, total: questions.length })}</p>
        <fieldset className="m-0 grid gap-2 border-0 p-0">
          <legend className="mb-2 p-0 text-lg font-bold">{q.question[lang]}</legend>
          {q.options.map((o, i) => (
            <label key={i} className="flex cursor-pointer items-center gap-2 rounded-(--radius-md) border-(length:--stroke-thin) border-border-strong p-3">
              <input type="radio" name={q.id} checked={answers[q.id] === i} onChange={() => setAnswers((a) => ({ ...a, [q.id]: i }))} />
              {o[lang]}
            </label>
          ))}
        </fieldset>
        {failed && (
          <p className="alert m-0" role="alert">
            {t.errors.failed}
          </p>
        )}
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', className: 'justify-self-end' })}
          disabled={answers[q.id] === undefined || busy}
          onClick={() => (last ? void finish() : setIndex((i) => i + 1))}
        >
          {last ? t.test.finish : t.test.next}
        </button>
      </Card>
    </div>
  )
}

function Tasks({
  lang,
  t,
  learn,
  blocks,
  tasks,
  status,
  onBack,
}: {
  lang: Locale
  t: PilotText
  learn: LearnText
  blocks: Dictionary['blocks']
  tasks: ClientPilotTask[]
  status: StudentStatus
  onBack: () => void
}) {
  const firstOpen = tasks.findIndex((x) => !status.tasks_done.includes(x.id))
  const [index, setIndex] = useState(firstOpen === -1 ? 0 : firstOpen)
  const [solved, setSolved] = useState<string[]>(status.tasks_done)
  const startedAt = useRef(Date.now())
  const mistakes = useRef(0)
  const task = tasks[index]
  const allDone = tasks.every((x) => solved.includes(x.id))

  const onDone = useCallback(
    (d: StepDone) => {
      setSolved((s) => [...new Set([...s, task.id])])
      void recordTask(status.member_id, task.id, {
        hints: d.hints,
        attempts: mistakes.current + 1,
        seconds: Math.round((Date.now() - startedAt.current) / 1000),
      })
    },
    [status.member_id, task.id],
  )
  const onMistake = useCallback(() => {
    mistakes.current += 1
  }, [])

  const go = (next: number) => {
    setIndex(next)
    startedAt.current = Date.now()
    mistakes.current = 0
  }

  return (
    <div className="container grid gap-6 py-8">
      <BackLink label={t.home.back} onBack={onBack} />
      <header className="grid gap-1">
        <h1 className="m-0 text-3xl">{t.tasks.title}</h1>
        <p className="m-0 text-muted-foreground">
          {fill(t.tasks.task, { n: index + 1, total: tasks.length })}. {t.tasks.lead}
        </p>
      </header>
      {allDone && (
        <p className="alert alert-ok m-0" role="status">
          {t.tasks.all}
        </p>
      )}
      <CodeStep
        key={task.id}
        lessonId="pilot"
        step={task}
        lang={lang}
        t={learn}
        blocksT={blocks}
        robotColor="sun"
        sticker="none"
        mentor={false}
        done={solved.includes(task.id)}
        onDone={onDone}
        onMistake={onMistake}
      />
      {index < tasks.length - 1 && solved.includes(task.id) && (
        <button type="button" className={buttonVariants({ variant: 'primary', className: 'justify-self-end' })} onClick={() => go(index + 1)}>
          {t.tasks.next}
        </button>
      )}
    </div>
  )
}

function Survey({ t, member, onBack }: { t: PilotText; member: string; onBack: () => void }) {
  const [clarity, setClarity] = useState<number | null>(null)
  const [sent, setSent] = useState(false)

  if (sent)
    return (
      <div className="container grid max-w-xl gap-6 py-10">
        <h1 className="m-0 text-3xl">{t.survey.thanks}</h1>
        <BackLink label={t.home.back} onBack={onBack} />
      </div>
    )

  return (
    <div className="container grid max-w-xl gap-6 py-10">
      <Card className="gap-4">
        <fieldset className="m-0 grid gap-3 border-0 p-0">
          <legend className="mb-2 p-0 text-xl font-bold">{t.survey.title}</legend>
          <div className="flex items-center justify-between gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <label key={n} className="grid cursor-pointer justify-items-center gap-1 font-bold">
                <input type="radio" name="clarity" checked={clarity === n} onChange={() => setClarity(n)} />
                {n}
              </label>
            ))}
          </div>
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t.survey.low}</span>
            <span>{t.survey.high}</span>
          </div>
        </fieldset>
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', className: 'justify-self-end' })}
          disabled={clarity === null}
          onClick={async () => {
            await submitSurvey(member, clarity as number)
            setSent(true)
          }}
        >
          {t.survey.send}
        </button>
      </Card>
    </div>
  )
}
