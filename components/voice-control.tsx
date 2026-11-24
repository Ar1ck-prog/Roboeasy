'use client'

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CircleHelp, Mic, MicOff, RotateCcw, Send } from 'lucide-react'

import { BlockStack } from '@/components/block-stack'
import { OpenPythonInFll } from '@/components/fll/open-python'
import { DictateAssignment } from '@/components/studio/dictate-assignment'
import { RobotPanel } from '@/components/robot-link'
import { SimView } from '@/components/sim/sim-view'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { PROMPT_MAX } from '@/lib/api-types'
import { programToPython } from '@/lib/dsl/compile-python'
import { DEFAULT_ROBOT, type Program, type Step } from '@/lib/dsl/types'
import { type Locale, fill } from '@/lib/i18n/config'
import type { LearnText } from '@/lib/i18n/learn'
import { getPythonWorkflowText } from '@/lib/i18n/python-workflow'
import type { Dictionary } from '@/lib/i18n/ru'
import type { VoiceText } from '@/lib/i18n/voice'
import { useHydrated } from '@/lib/learn/store'
import { savedRobot } from '@/lib/saved-robot'
import { canListen, createSpeechRecognition, VOICE_ASSIGNMENT_KEY } from '@/lib/speech'
import type { SimField } from '@/lib/sim/field'
import { simulate } from '@/lib/sim/interpreter'
import { runOnHub, stopHub, useHub } from '@/lib/spike/ble'
import { programForHub } from '@/lib/spike/telemetry'
import { cn } from '@/lib/utils'
import { parseVoice } from '@/lib/voice/parse'

/** An empty 160 × 120 cm mat; the robot starts in the middle, facing up. */
const FIELD = {
  width: 1600,
  height: 1200,
  start: { x: 800, y: 500, heading: 90 },
  border: true,
  lines: [],
  zones: [],
  walls: [],
  points: [],
} as unknown as SimField

/** A session keeps adding commands; past this the oldest are dropped (the robot starts over). */
const MAX_STEPS = 80

type Said = { id: number; text: string; ok: boolean }
type ErrorKey = keyof VoiceText['errors']

export function VoiceControl({ lang, t, blocks, sim: simText }: { lang: Locale; t: VoiceText; blocks: Dictionary['blocks']; sim: LearnText['sim'] }) {
  const router = useRouter()
  const workflow = getPythonWorkflowText(lang)
  const hydrated = useHydrated()
  const hub = useHub()
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<ErrorKey | null>(null)
  const [typed, setTyped] = useState('')
  const [assignment, setAssignment] = useState('')
  const [transferError, setTransferError] = useState(false)
  const [last, setLast] = useState<{ text: string; steps: Step[]; unknown: string[]; stop: boolean } | null>(null)
  const [history, setHistory] = useState<Said[]>([])
  // Everything said since the last reset: simulated as one program, played from the new part.
  const [session, setSession] = useState<Step[]>([])
  const [from, setFrom] = useState(0)
  const [auto, setAuto] = useState(true)
  const [robot, setRobot] = useState(DEFAULT_ROBOT)
  const recognition = useRef<ReturnType<typeof createSpeechRecognition>>(null)
  const assignmentDetails = useRef<HTMLDetailsElement>(null)
  const simBox = useRef<HTMLElement>(null)
  const nextId = useRef(1)
  const supported = hydrated && canListen()
  const linked = hub.status !== 'idle' && hub.status !== 'connecting'

  useEffect(() => setRobot(savedRobot()), [])
  useEffect(() => {
    const openAssignment = () => {
      const details = assignmentDetails.current
      if (details && window.location.hash === '#voice-assignment') {
        details.open = true
        details.scrollIntoView({ block: 'start' })
      }
    }
    openAssignment()
    window.addEventListener('hashchange', openAssignment)
    return () => window.removeEventListener('hashchange', openAssignment)
  }, [])
  useEffect(() => {
    const cancel = () => {
      const rec = recognition.current
      recognition.current = null
      rec?.abort()
    }
    const onPageHide = () => {
      cancel()
      setListening(false)
      setInterim('')
    }
    window.addEventListener('pagehide', onPageHide)
    return () => {
      window.removeEventListener('pagehide', onPageHide)
      cancel()
    }
  }, [])

  const result = useMemo(() => (session.length ? simulate(session, FIELD, { robot }) : null), [session, robot])

  function execute(text: string) {
    const said = text.trim()
    if (!said) return
    const parsed = parseVoice(said)
    setLast({ text: said, ...parsed })
    setHistory((h) => [{ id: nextId.current++, text: said, ok: parsed.stop || parsed.steps.length > 0 }, ...h].slice(0, 12))
    if (parsed.stop) {
      if (hub.status === 'running') void stopHub()
      return
    }
    if (!parsed.steps.length) return
    // The new commands continue from where the robot stopped.
    const kept = session.length + parsed.steps.length > MAX_STEPS ? [] : session
    setFrom(kept.length && result ? result.final.t : 0)
    setSession([...kept, ...parsed.steps])
    // On a phone the simulator is below the microphone: bring it into view to watch the robot.
    const box = simBox.current?.getBoundingClientRect()
    if (box && window.matchMedia('(max-width: 1023px)').matches && (box.top > window.innerHeight * 0.5 || box.bottom < 0)) {
      simBox.current?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' })
    }
    if (auto && linked) {
      const program: Program = { title: said.slice(0, 40), description: '', steps: parsed.steps }
      void runOnHub(programForHub(programToPython(program, robot)))
    }
  }

  function listen() {
    if (listening) {
      recognition.current?.stop()
      return
    }
    const rec = createSpeechRecognition(lang)
    if (!rec) return
    rec.interimResults = true
    rec.onresult = (e) => {
      if (recognition.current !== rec) return
      let finalText = ''
      let partial = ''
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const r = e.results[i]
        if (r.isFinal) finalText += r[0].transcript
        else partial += r[0].transcript
      }
      setInterim(partial || finalText)
      if (finalText) execute(finalText)
    }
    rec.onerror = (e) => {
      if (recognition.current !== rec || e.error === 'aborted') return
      setError(
        e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'not-allowed' : e.error === 'no-speech' || e.error === 'network' ? e.error : 'failed',
      )
    }
    rec.onend = () => {
      if (recognition.current !== rec) return
      setListening(false)
      setInterim('')
      recognition.current = null
    }
    recognition.current = rec
    setError(null)
    setInterim('')
    setListening(true)
    try {
      rec.start()
    } catch {
      recognition.current = null
      setListening(false)
      setError('failed')
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    execute(typed)
    setTyped('')
  }

  function reset() {
    setSession([])
    setFrom(0)
    setLast(null)
  }

  function sendAssignment(e: FormEvent) {
    e.preventDefault()
    if (!assignment.trim()) return
    try {
      sessionStorage.setItem(VOICE_ASSIGNMENT_KEY, assignment)
      router.push(`/${lang}/sandbox?voiceAssignment`)
      setTransferError(false)
    } catch {
      setTransferError(true)
    }
  }

  const lastProgram: Program | null = last?.steps.length ? { title: '', description: '', steps: last.steps } : null

  return (
    <div className="container grid gap-6 py-6 pb-24 sm:py-10">
      <header className="grid gap-2">
        <h1 className="m-0 font-display text-3xl font-extrabold sm:text-5xl">{t.title}</h1>
        <p className="m-0 max-w-3xl text-muted-foreground">{t.intro}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start">
        <div className="grid min-w-0 gap-5">
          <Card className="items-center gap-4 p-5 text-center sm:p-7">
            <button
              type="button"
              onClick={listen}
              disabled={!supported}
              aria-pressed={listening}
              aria-label={listening ? t.stopListening : t.listen}
              className={cn(
                'voice-mic relative grid size-32 place-items-center rounded-full border-(length:--stroke) border-outline shadow-(--shadow-hard) transition-transform active:translate-y-0.5 disabled:opacity-50 sm:size-36',
                listening ? 'bg-destructive text-white' : 'bg-primary text-primary-foreground',
              )}
              data-listening={listening || undefined}
            >
              {listening && (
                <>
                  <span aria-hidden="true" className="voice-ring" />
                  <span aria-hidden="true" className="voice-ring voice-ring-2" />
                </>
              )}
              {supported || !hydrated ? <Mic className="relative size-14" aria-hidden="true" /> : <MicOff className="relative size-14" aria-hidden="true" />}
            </button>
            <p className="m-0 font-display text-xl font-extrabold" role="status">
              {listening ? t.listening : t.listen}
            </p>
            {/* Live words while speaking, then what was heard last. */}
            <p className="m-0 min-h-7 max-w-md text-lg font-bold break-words" aria-live="polite">
              {interim ? `«${interim}»` : last ? `${t.heard}: «${last.text}»` : ''}
            </p>
            {voiceBars(listening)}
            {hydrated && !supported && <p className="alert alert-warn m-0 text-left text-sm">{t.unsupported}</p>}
            {error && (
              <p className="alert alert-warn m-0 text-left text-sm" role="alert">
                {t.errors[error]}
              </p>
            )}
            {supported && !error && <p className="m-0 text-sm text-muted-foreground">{t.hint}</p>}
          </Card>

          <form onSubmit={submit} className="grid gap-2">
            <label htmlFor="voice-typed" className="font-bold">
              {t.typeLabel}
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id="voice-typed"
                className="input min-w-0 sm:flex-1"
                value={typed}
                placeholder={t.typePlaceholder}
                onChange={(e) => setTyped(e.target.value)}
                autoComplete="off"
              />
              <button type="submit" className={buttonVariants({ variant: 'primary' })} disabled={!typed.trim()}>
                <Send aria-hidden="true" />
                {t.run}
              </button>
            </div>
          </form>

          <details id="voice-assignment" ref={assignmentDetails}
            className="scroll-mt-[calc(var(--header-h)+1rem)] rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4">
            <summary className="cursor-pointer font-bold">{workflow.generator}</summary>
            <form onSubmit={sendAssignment} className="mt-3 grid gap-3">
              <DictateAssignment lang={lang} onText={(text) => setAssignment((previous) => [previous.trimEnd(), text].filter(Boolean).join(' ').slice(0, PROMPT_MAX))} />
              <textarea className="textarea" aria-label={workflow.voiceToStudio} value={assignment}
                maxLength={PROMPT_MAX} onChange={(e) => setAssignment(e.target.value)} />
              <button type="submit" className={buttonVariants()} disabled={!assignment.trim()}>{workflow.voiceToStudio}</button>
              {transferError && <p role="alert" className="alert alert-warn m-0 text-sm">{workflow.voiceTransferError}</p>}
            </form>
          </details>

          <div className="grid gap-2">
            <p className="m-0 text-sm font-bold">{t.examples}</p>
            <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
              {t.exampleList.map((example) => (
                <li key={example}>
                  <button
                    type="button"
                    className="rounded-full border-(length:--stroke-thin) border-outline bg-card px-3 py-1.5 text-sm font-bold shadow-(--shadow-press) transition-colors hover:bg-surface-2"
                    onClick={() => execute(example)}
                  >
                    «{example}»
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <details className="rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4">
            <summary className="flex cursor-pointer items-center gap-2 font-bold">
              <CircleHelp className="size-4" aria-hidden="true" />
              {t.help}
            </summary>
            <ul className="mt-3 mb-0 grid gap-1.5 pl-5 text-sm">
              {t.helpList.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </details>
        </div>

        <div className="grid min-w-0 gap-5">
          <Card className="min-w-0 gap-3" data-testid="voice-understood">
            <CardTitle>{t.understood}</CardTitle>
            {last?.stop ? (
              <p className="m-0 font-bold text-destructive">{t.stopped}</p>
            ) : lastProgram ? (
              <div className="canvas">
                <BlockStack program={lastProgram} labels={blocks} robot={robot} animate />
              </div>
            ) : (
              <p className="m-0 text-muted-foreground">{t.nothing}</p>
            )}
            {last?.unknown.map((u) => (
              <p key={u} className="alert alert-warn m-0 text-sm">
                {fill(t.unknown, { text: u })}
              </p>
            ))}
          </Card>

          <section ref={simBox} className="grid scroll-mt-20 gap-2" aria-label={t.sim}>
            <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
              <h2 className="m-0 text-xl whitespace-nowrap">{t.sim}</h2>
              <button type="button" className={buttonVariants({ size: 'sm', variant: 'ghost' })} onClick={reset} disabled={!session.length}>
                <RotateCcw aria-hidden="true" />
                {t.reset}
              </button>
            </div>
            <SimView field={FIELD} result={result} from={from} lang={lang} labels={simText} />
            {session.length > 0 && (
              <OpenPythonInFll lang={lang} name={workflow.voiceName}
                code={programToPython({ title: workflow.voiceName, description: '', steps: session }, robot)} />
            )}
          </section>

          <RobotPanel lang={lang}>
            <label className="flex items-start gap-2 text-sm font-bold">
              <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
              <span>
                {t.auto}
                <span className="block font-normal text-muted-foreground">{t.autoNote}</span>
              </span>
            </label>
          </RobotPanel>

          {history.length > 0 && (
            <section className="grid gap-2" aria-labelledby="voice-history">
              <h2 id="voice-history" className="m-0 text-xl">
                {t.history}
              </h2>
              <ol className="m-0 grid list-none gap-1.5 p-0">
                {history.map((h) => (
                  <li key={h.id} className="flex items-center gap-2 text-sm">
                    <span aria-hidden="true" className={cn('size-2 shrink-0 rounded-full', h.ok ? 'bg-success' : 'bg-destructive')} />
                    <button type="button" className="text-left underline-offset-4 hover:underline" onClick={() => execute(h.text)}>
                      «{h.text}»
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>
      </div>
    </div>
  )
}

/** A small equaliser under the microphone: moves while listening, flat otherwise. */
function voiceBars(active: boolean) {
  return (
    <svg viewBox="0 0 120 28" className="h-7 w-32" aria-hidden="true">
      {Array.from({ length: 11 }, (_, i) => (
        <rect
          key={i}
          x={i * 11 + 2}
          y={active ? 2 : 12}
          width="6"
          height={active ? 24 : 4}
          rx="3"
          className={cn('fill-current text-outline/40', active && 'voice-bar text-destructive')}
          style={active ? { animationDelay: `${(i % 5) * 0.12}s` } : undefined}
        />
      ))}
    </svg>
  )
}
