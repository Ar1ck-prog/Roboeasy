'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, Check, Circle, Lightbulb, Play, RotateCcw, RotateCw, Square, Trash2 } from 'lucide-react'

import { Bench, type Selection, removeSelection } from '@/components/electronics/bench'
import { CodeEditor } from '@/components/electronics/code-editor'
import { PartInspector, PartPreview, SerialOutput, errorText, faultText } from '@/components/electronics/lab'
import { RichText } from '@/components/learn/rich-text'
import { Button } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { type CircuitDoc, DEFAULT_PROPS, type Part, type PartType } from '@/lib/electronics/board'
import { CodeError } from '@/lib/electronics/lang'
import { type GoalLabel, createCircuitChecker } from '@/lib/electronics/lesson-checks'
import { type Fault, type FrameState, Simulation } from '@/lib/electronics/sim'
import type { Locale } from '@/lib/i18n/config'
import { type ElectronicsText, getElectronicsText } from '@/lib/i18n/electronics'
import type { ClientStep } from '@/lib/learn/content'
import { cn } from '@/lib/utils'

import type { StepDone } from './simple-steps'

type CircuitData = Extract<ClientStep, { type: 'circuit' }>
type Status = 'stopped' | 'running' | 'error' | 'shorted'

const fill = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))

function goalText(label: GoalLabel, t: ElectronicsText): string {
  const g = t.goals
  const p = label.params
  switch (label.key) {
    case 'ledLit':
      return p.color ? fill(g.ledLitColor, { color: t.colors[p.color as keyof ElectronicsText['colors']] }) : g.ledLit
    case 'ledMaxMa':
      return fill(g.ledMaxMa, p)
    case 'noBurned':
      return g.noBurned
    case 'blinks':
      return label.builtin ? g.blinksBuiltin : g.blinks
    case 'blinkPeriod':
      return fill(g.blinkPeriod, p)
    case 'buttonLed':
      return p.phase === 'press' ? g.buttonPress : g.buttonRelease
    case 'ledLevels':
      return g.ledLevels
    case 'serialLines':
      return g.serialLines
    case 'serialNumbers':
      return p.atLeast !== '' ? fill(g.serialNumbersAtLeast, p) : g.serialNumbers
    case 'fault':
      return fill(g.fault, { fault: g.faultNames[String(p.code)] ?? String(p.code) })
    case 'missionGoal':
      return t.missions[String(p.id)]?.goals[Number(p.index)] ?? ''
    default:
      return ''
  }
}

/** A breadboard task inside a lesson: build the circuit (and the sketch), run it, meet the goals. */
export function CircuitStep({ step, lang, done, onDone }: { step: CircuitData; lang: Locale; done: boolean; onDone: (d: StepDone) => void }) {
  const t = getElectronicsText(lang)
  const [doc, setDoc] = useState<CircuitDoc>(() => structuredClone(step.start.doc) as CircuitDoc)
  const [code, setCode] = useState(step.start.code)
  const [selection, setSelection] = useState<Selection>(null)
  const [status, setStatus] = useState<Status>('stopped')
  const [error, setError] = useState<CodeError | null>(null)
  const [frame, setFrame] = useState<FrameState | null>(null)
  const [serial, setSerial] = useState('')
  const [faults, setFaults] = useState<Fault[]>([])
  const [goals, setGoals] = useState<boolean[]>([])
  const [hints, setHints] = useState(0)
  const [finished, setFinished] = useState(done)

  const labels = useMemo(() => createCircuitChecker(step.checks, (id) => t.missions[id]?.goals.length ?? 2).labels, [step.checks, t])
  const sim = useRef<Simulation | null>(null)
  const raf = useRef(0)
  const runs = useRef(0)
  const docRef = useRef(doc)
  const serialRef = useRef('')
  const finishedRef = useRef(done)
  docRef.current = doc

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    sim.current = null
    setFrame(null)
    setStatus((s) => (s === 'running' ? 'stopped' : s))
  }, [])
  useEffect(() => stop, [stop])

  const run = () => {
    stop()
    setError(null)
    setFaults([])
    setSerial('')
    serialRef.current = ''
    runs.current++
    let s: Simulation
    try {
      s = new Simulation(code, docRef.current)
    } catch (e) {
      if (e instanceof CodeError) {
        setError(e)
        setStatus('error')
        return
      }
      throw e
    }
    sim.current = s
    const checker = createCircuitChecker(step.checks, (id) => t.missions[id]?.goals.length ?? 2)
    setGoals([])
    setStatus('running')
    let last = performance.now()
    const tick = (now: number) => {
      const current = sim.current
      if (!current) return
      const dt = Math.min(50, Math.max(1, now - last))
      last = now
      const f = current.step(dt)
      setFrame(f)
      if (current.board.serialOut) {
        serialRef.current = (serialRef.current + current.board.serialOut).slice(-6000)
        current.board.serialOut = ''
        setSerial(serialRef.current)
      }
      if (f.faults.length) setFaults((list) => [...list, ...f.faults])
      const g = checker.check({ frame: f, doc: docRef.current, serial: serialRef.current })
      setGoals((prev) => (prev.length === g.length && prev.every((v, i) => v === g[i]) ? prev : g))
      if (g.length && g.every(Boolean) && !finishedRef.current) {
        finishedRef.current = true
        setFinished(true)
        onDone({ firstTry: runs.current <= 1 && hints === 0, hints })
      }
      if (current.status.kind === 'error') {
        setError(current.status.error)
        setStatus('error')
        return
      }
      if (current.status.kind === 'shorted') {
        setStatus('shorted')
        setFrame({ ...f, leds: {}, builtin: 0 })
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const changeDoc = (next: CircuitDoc) => {
    setDoc(next)
    sim.current?.board.setDoc(next)
  }
  const setProps = (id: string, props: Part['props']) => changeDoc({ ...docRef.current, parts: docRef.current.parts.map((p) => (p.id === id ? { ...p, props: { ...p.props, ...props } } : p)) })
  const addPart = (type: PartType) => {
    const d = docRef.current
    let n = d.parts.length + 1
    while (d.parts.some((p) => p.id === `${type}${n}`)) n++
    const big = type === 'servo' || type === 'ultrasonic'
    const y = big ? 340 : 300
    let x = big ? 400 : 340
    while (d.parts.some((p) => Math.abs(p.x - x) < (big ? 100 : 50) && Math.abs(p.y - y) < 30) && x < 620) x += big ? 120 : 60
    const part: Part = { id: `${type}${n}`, type, x, y, rot: 0, props: { ...DEFAULT_PROPS[type] } }
    changeDoc({ ...d, parts: [...d.parts, part] })
    setSelection({ kind: 'part', id: part.id })
  }
  const reset = () => {
    stop()
    setStatus('stopped')
    setError(null)
    setSelection(null)
    setDoc(structuredClone(step.start.doc) as CircuitDoc)
    setCode(step.start.code)
  }

  const selectedPart = selection?.kind === 'part' ? doc.parts.find((p) => p.id === selection.id) : undefined
  const uniqueFaults = faults.filter((f, i) => faults.findIndex((x) => x.code === f.code && x.part === f.part && x.pin === f.pin) === i)
  const statusText = { stopped: t.lab.stopped, running: t.lab.running, error: t.lab.error, shorted: t.lab.shorted }[status]

  return (
    <Card className="gap-4" data-testid="circuit-step">
      <CardTitle>{step.title[lang]}</CardTitle>
      <RichText text={step.task[lang]} />

      <ul className="m-0 grid list-none gap-1.5 rounded-(--radius-md) bg-surface-2 p-3" aria-label={t.lab.goals}>
        {labels.map((label, i) => (
          <li key={i} className="flex items-start gap-2" data-met={goals[i] || finished ? 'true' : 'false'}>
            {goals[i] || finished ? <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
            <span className={cn(goals[i] && 'font-bold')}>{goalText(label, t)}</span>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap items-center gap-2">
        {status === 'running' ? (
          <Button variant="primary" onClick={() => (stop(), setStatus('stopped'))}>
            <Square aria-hidden="true" />
            {t.lab.stop}
          </Button>
        ) : (
          <Button variant="primary" onClick={run} data-testid="circuit-run">
            <Play aria-hidden="true" />
            {t.goals.run}
          </Button>
        )}
        <span
          className={cn(
            'rounded-(--radius-pill) px-3 py-1 text-sm font-extrabold',
            status === 'running' ? 'bg-(--ok-bg) text-success' : status === 'stopped' ? 'bg-surface-2 text-muted-foreground' : 'bg-(--danger-bg) text-destructive',
          )}
          role="status"
          data-testid="circuit-status"
        >
          {statusText}
        </span>
        <span className="flex-1" />
        <Button size="sm" variant="ghost" onClick={reset} aria-label={t.lab.restart}>
          <RotateCcw aria-hidden="true" />
        </Button>
      </div>

      {error && (
        <p className="m-0 flex items-start gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-destructive bg-(--danger-bg) p-3 text-sm font-bold text-destructive" role="alert">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {fill(t.lab.errorLine, { line: error.line, text: errorText(error, t) })}
        </p>
      )}
      {uniqueFaults.length > 0 && (
        <ul className="m-0 grid list-none gap-1.5 p-0">
          {uniqueFaults.map((f) => (
            <li key={`${f.code}${f.part}${f.pin}`} className="flex items-start gap-2 rounded-(--radius-sm) bg-(--warn-bg) p-2.5 text-sm font-bold text-(--warn-text)" data-fault={f.code}>
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {faultText(f, t)}
            </li>
          ))}
        </ul>
      )}

      <div className={cn('grid grid-cols-[minmax(0,1fr)] gap-4', step.code === 'edit' && 'xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]')}>
        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-3">
          <Bench doc={doc} onChange={changeDoc} frame={frame} running={status === 'running'} selection={selection} onSelect={setSelection} t={t} />
          <div className={cn('grid gap-3', step.tray.length > 0 && 'md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]')}>
            {step.tray.length > 0 && (
              <div className="grid content-start gap-2">
                <h3 className="m-0 text-base">{t.lab.parts}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {step.tray.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => addPart(type)}
                      className="grid cursor-pointer justify-items-center gap-1 rounded-(--radius-sm) border-(length:--stroke-thin) border-border bg-card p-1.5 text-center text-[11px] leading-tight font-bold hover:border-outline hover:bg-surface-2"
                      aria-label={fill(t.lab.addPart, { name: t.parts[type] })}
                      data-add={type}
                    >
                      <PartPreview type={type} />
                      <span className="line-clamp-2">{t.parts[type]}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="grid content-start gap-2 rounded-(--radius-md) border-(length:--stroke-thin) border-border p-3">
              {selectedPart ? (
                <PartInspector part={selectedPart} frame={frame} t={t} setProps={setProps} running={status === 'running'} />
              ) : (
                <p className="m-0 text-sm text-muted-foreground">{t.lab.howTo}</p>
              )}
              {selection && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedPart && (
                    <Button size="sm" onClick={() => changeDoc({ ...doc, parts: doc.parts.map((p) => (p.id === selectedPart.id ? { ...p, rot: ((p.rot + 1) % 4) as Part['rot'] } : p)) })}>
                      <RotateCw aria-hidden="true" />
                      {t.lab.rotate}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      changeDoc(removeSelection(doc, selection))
                      setSelection(null)
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                    {t.lab.remove}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
        {step.code === 'edit' && (
          <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] content-start gap-3">
            <div className="h-[340px]">
              <CodeEditor value={code} onChange={setCode} errorLine={error?.line ?? null} label={t.lab.code} loading={t.lab.loadingEditor} />
            </div>
            <h3 className="m-0 text-base">{t.lab.serial}</h3>
            <SerialOutput text={serial} empty={t.lab.serialEmpty} />
          </div>
        )}
      </div>

      {!finished && (
        <div className="grid gap-2">
          {step.hints.slice(0, hints).map((h, i) => (
            <p key={i} className="m-0 flex items-start gap-2 rounded-(--radius-sm) bg-(--ok-bg) p-3 text-sm">
              <Lightbulb className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <RichText text={h[lang]} className="[&>p]:m-0" />
            </p>
          ))}
          {hints < step.hints.length && (
            <Button size="sm" variant="ghost" className="w-fit" onClick={() => setHints((n) => n + 1)}>
              <Lightbulb aria-hidden="true" />
              {t.goals.showHint}
            </Button>
          )}
        </div>
      )}
      {finished && (
        <p className="alert alert-ok m-0 flex items-center gap-2" role="status" data-testid="circuit-done">
          <Check className="size-5" aria-hidden="true" />
          {t.goals.done}
        </p>
      )}
    </Card>
  )
}
