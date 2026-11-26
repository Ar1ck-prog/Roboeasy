'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Check, Circle, Eraser, Lightbulb, Play, RotateCcw, RotateCw, Square, Trash2, Volume2, VolumeX, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Bench, type Selection, removeSelection } from '@/components/electronics/bench'
import { CodeEditor } from '@/components/electronics/code-editor'
import { PartArt, formatOhms } from '@/components/electronics/part-art'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { type CircuitDoc, DEFAULT_PROPS, LED_COLORS, type LedColor, type Part, type PartType, RESISTOR_VALUES } from '@/lib/electronics/board'
import { MISSION_IDS, type MissionId, createChecker, getMission } from '@/lib/electronics/missions'
import { type Fault, type FrameState, Simulation } from '@/lib/electronics/sim'
import { CodeError } from '@/lib/electronics/lang'
import { loadProgress, saveProgress } from '@/lib/electronics/progress'
import type { Locale } from '@/lib/i18n/config'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

type Workspace = { code: string; doc: CircuitDoc }
type Status = 'stopped' | 'running' | 'error' | 'shorted'

const PART_TYPES: PartType[] = ['led', 'resistor', 'button', 'pot', 'ldr', 'buzzer', 'servo', 'ultrasonic']
const FREE_START: Workspace = { code: getMission('blink').starter.code, doc: { parts: [], wires: [] } }

const fill = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))

export function errorText(e: CodeError, t: ElectronicsText): string {
  const params = { ...e.params }
  if (params.what === 'name') params.what = t.errors.name
  const key = e.code === 'expected' && !params.got ? 'expectedEnd' : e.code
  return fill((t.errors as Record<string, string>)[key] ?? e.code, params)
}

export function faultText(f: Fault, t: ElectronicsText): string {
  return fill(t.faults[f.code], { ma: f.ma ?? '', pin: f.pin ?? '' })
}

/** Where to put a new part: the free strip under the breadboard, left to right. */
function parkingSpot(doc: CircuitDoc, type: PartType): { x: number; y: number } {
  const big = type === 'servo' || type === 'ultrasonic'
  const y = big ? 340 : 300
  for (let x = big ? 400 : 340; x < 640; x += big ? 120 : 60) {
    if (!doc.parts.some((p) => Math.abs(p.x - x) < (big ? 100 : 50) && Math.abs(p.y - y) < 30)) return { x, y }
  }
  return { x: 340, y }
}

interface LabProps {
  lang: Locale
  t: ElectronicsText
}

const start = (id: MissionId | 'free'): Workspace => (id === 'free' ? FREE_START : structuredClone(getMission(id).starter))
const isMission = (id: string | null): id is MissionId => (MISSION_IDS as readonly string[]).includes(id ?? '')

export function Lab({ lang, t }: LabProps) {
  const [mission, setMission] = useState<MissionId | 'free'>('free')
  const [work, setWork] = useState<Workspace>(FREE_START)
  const [done, setDone] = useState<Set<string>>(new Set())
  const [selection, setSelection] = useState<Selection>(null)
  const [status, setStatus] = useState<Status>('stopped')
  const [error, setError] = useState<CodeError | null>(null)
  const [frame, setFrame] = useState<FrameState | null>(null)
  const [serial, setSerial] = useState('')
  const [faults, setFaults] = useState<Fault[]>([])
  const [goals, setGoals] = useState<boolean[]>([])
  const [sound, setSound] = useState(true)
  const [input, setInput] = useState('')
  const [loaded, setLoaded] = useState(false)

  const sim = useRef<Simulation | null>(null)
  const raf = useRef(0)
  const checker = useRef<ReturnType<typeof createChecker> | null>(null)
  const docRef = useRef(work.doc)
  const serialRef = useRef('')
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode | null; gain: GainNode } | null>(null)
  const soundRef = useRef(sound)
  const missionRef = useRef(mission)
  docRef.current = work.doc
  soundRef.current = sound
  missionRef.current = mission

  // The mission comes from ?mission= (the page itself is static); saved work and finished missions live in this browser.
  useEffect(() => {
    const param = new URLSearchParams(window.location.search).get('mission')
    const id = isMission(param) ? param : 'free'
    const saved = loadProgress()
    setDone(new Set(saved.done))
    setMission(id)
    setWork(saved.work[id] ?? start(id))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const id = window.setTimeout(() => saveProgress((p) => ({ ...p, work: { ...p.work, [mission]: work } })), 400)
    return () => window.clearTimeout(id)
  }, [work, mission, loaded])

  const silence = useCallback(() => {
    const a = audio.current
    if (a?.osc) {
      a.osc.stop()
      a.osc.disconnect()
      a.osc = null
    }
  }, [])

  const playTone = useCallback(
    (freq: number | null) => {
      const a = audio.current
      if (!a) return
      if (!freq || !soundRef.current) return silence()
      if (!a.osc) {
        a.osc = a.ctx.createOscillator()
        a.osc.type = 'square'
        a.osc.connect(a.gain)
        a.osc.start()
      }
      a.osc.frequency.setValueAtTime(freq, a.ctx.currentTime)
    },
    [silence],
  )

  const stop = useCallback(() => {
    cancelAnimationFrame(raf.current)
    sim.current = null
    silence()
    setFrame(null)
    setStatus((s) => (s === 'running' ? 'stopped' : s))
  }, [silence])

  useEffect(() => stop, [stop])

  const run = () => {
    stop()
    setError(null)
    setFaults([])
    setSerial('')
    serialRef.current = ''
    let s: Simulation
    try {
      s = new Simulation(work.code, docRef.current)
    } catch (e) {
      if (e instanceof CodeError) {
        setError(e)
        setStatus('error')
        return
      }
      throw e
    }
    sim.current = s
    checker.current = missionRef.current === 'free' ? null : createChecker(missionRef.current)
    setGoals([])
    if (!audio.current && typeof AudioContext !== 'undefined') {
      const ctx = new AudioContext()
      const gain = ctx.createGain()
      gain.gain.value = 0.04
      gain.connect(ctx.destination)
      audio.current = { ctx, osc: null, gain }
    }
    void audio.current?.ctx.resume()
    setStatus('running')
    let last = performance.now()
    const tick = (now: number) => {
      const current = sim.current
      if (!current) return
      const dt = Math.min(50, Math.max(1, now - last))
      last = now
      const f = current.step(dt)
      setFrame(f)
      const out = current.board.serialOut
      if (out) {
        current.board.serialOut = ''
        serialRef.current = (serialRef.current + out).slice(-8000)
        setSerial(serialRef.current)
      }
      if (f.faults.length) setFaults((list) => [...list, ...f.faults])
      playTone(f.tones[0]?.freq ?? null)
      if (checker.current) {
        const g = checker.current({ frame: f, doc: docRef.current, serial: serialRef.current })
        setGoals((prev) => (prev.length === g.length && prev.every((v, i) => v === g[i]) ? prev : g))
        const id = missionRef.current
        if (id !== 'free' && g.length && g.every(Boolean)) {
          checker.current = null
          setDone((d) => {
            if (d.has(id)) return d
            const next = new Set(d).add(id)
            saveProgress((p) => ({ ...p, done: [...next] }))
            toast.success(t.lab.missionDone, { description: t.missions[id].title })
            return next
          })
        }
      }
      if (current.status.kind === 'error') {
        setError(current.status.error)
        setStatus('error')
        silence()
        return
      }
      if (current.status.kind === 'shorted') {
        setStatus('shorted')
        silence()
        setFrame({ ...f, leds: {}, builtin: 0 })
        return
      }
      raf.current = requestAnimationFrame(tick)
    }
    raf.current = requestAnimationFrame(tick)
  }

  const changeDoc = (doc: CircuitDoc) => {
    setWork((w) => ({ ...w, doc }))
    sim.current?.board.setDoc(doc)
  }

  const chooseMission = (id: MissionId | 'free') => {
    if (id === mission) return
    stop()
    setStatus('stopped')
    setError(null)
    setSelection(null)
    setGoals([])
    setMission(id)
    const saved = loadProgress().work[id]
    setWork(saved ?? start(id))
    const url = new URL(window.location.href)
    if (id === 'free') url.searchParams.delete('mission')
    else url.searchParams.set('mission', id)
    window.history.replaceState(null, '', url)
  }

  const replaceWith = (next: Partial<Workspace>) => {
    if (!window.confirm(t.lab.confirmReplace)) return
    stop()
    setSelection(null)
    setWork((w) => ({ ...w, ...structuredClone(next) }))
  }

  const addPart = (type: PartType) => {
    const doc = docRef.current
    let n = doc.parts.length + 1
    while (doc.parts.some((p) => p.id === `${type}${n}`)) n++
    const part: Part = { id: `${type}${n}`, type, ...parkingSpot(doc, type), rot: 0, props: { ...DEFAULT_PROPS[type] } }
    changeDoc({ ...doc, parts: [...doc.parts, part] })
    setSelection({ kind: 'part', id: part.id })
  }

  const setProps = (id: string, props: Part['props']) => changeDoc({ ...work.doc, parts: work.doc.parts.map((p) => (p.id === id ? { ...p, props: { ...p.props, ...props } } : p)) })

  const send = () => {
    if (!input || !sim.current) return
    sim.current.board.send(`${input}\n`)
    setInput('')
  }

  const selectedPart = selection?.kind === 'part' ? work.doc.parts.find((p) => p.id === selection.id) : undefined
  const selectedWire = selection?.kind === 'wire' ? work.doc.wires.find((w) => w.id === selection.id) : undefined
  const missionText = mission === 'free' ? null : t.missions[mission]
  const uniqueFaults = useMemo(() => {
    const seen = new Set<string>()
    return faults.filter((f) => {
      const key = `${f.code}${f.part ?? ''}${f.pin ?? ''}`
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
  }, [faults])

  const statusChip = {
    stopped: { text: t.lab.stopped, cls: 'bg-surface-2 text-muted-foreground' },
    running: { text: t.lab.running, cls: 'bg-(--ok-bg) text-success' },
    error: { text: t.lab.error, cls: 'bg-(--danger-bg) text-destructive' },
    shorted: { text: t.lab.shorted, cls: 'bg-(--danger-bg) text-destructive' },
  }[status]

  return (
    <div className="container grid gap-5 py-6 md:py-8">
      <header className="grid gap-3">
        <Link href={`/${lang}/electronics`} className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {t.lab.backToHub}
        </Link>
        <h1 className="m-0 text-3xl md:text-4xl">{t.lab.title}</h1>
        <nav aria-label={t.lab.missions} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
          {(['free', ...MISSION_IDS] as const).map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => chooseMission(id)}
              aria-current={mission === id ? 'true' : undefined}
              className={cn(
                'inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-(--radius-pill) border-(length:--stroke-thin) border-outline px-3 py-1.5 text-sm font-bold transition-colors',
                mission === id ? 'bg-primary text-primary-foreground' : 'bg-card hover:bg-surface-2',
              )}
            >
              {id !== 'free' && done.has(id) && <Check className="size-4 text-success" aria-label={t.hub.done} />}
              {id === 'free' ? t.lab.free : t.missions[id].title}
            </button>
          ))}
        </nav>
      </header>

      {missionText && mission !== 'free' && (
        <Card flat className="gap-3 p-4 sm:p-5" data-testid="mission-card">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="grid min-w-0 flex-1 gap-1">
              <h2 className="m-0 text-xl">{missionText.title}</h2>
              <p className="m-0 text-muted-foreground">{missionText.story}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => replaceWith({ doc: getMission(mission).solution.doc })}>
                <Wand2 aria-hidden="true" />
                {t.lab.buildForMe}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => replaceWith({ code: getMission(mission).solution.code })}>
                {t.lab.showSolution}
              </Button>
            </div>
          </div>
          <div>
            <h3 className="m-0 mb-1.5 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{t.lab.goals}</h3>
            <ul className="m-0 grid list-none gap-1.5 p-0">
              {missionText.goals.map((g, i) => (
                <li key={g} className="flex items-start gap-2" data-goal={i} data-met={goals[i] ? 'true' : 'false'}>
                  {goals[i] ? <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                  <span className={goals[i] ? 'font-bold' : undefined}>{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <details className="text-sm">
            <summary className="inline-flex cursor-pointer items-center gap-1.5 font-bold">
              <Lightbulb className="size-4" aria-hidden="true" />
              {t.lab.hint}
            </summary>
            <p className="m-0 mt-2 text-muted-foreground">{missionText.hint}</p>
          </details>
        </Card>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <section className="grid min-w-0 gap-3" aria-label={t.lab.bench}>
          <div className="flex flex-wrap items-center gap-2">
            {status === 'running' ? (
              <Button variant="primary" onClick={() => (stop(), setStatus('stopped'))}>
                <Square aria-hidden="true" />
                {t.lab.stop}
              </Button>
            ) : (
              <Button variant="primary" onClick={run} data-testid="run">
                <Play aria-hidden="true" />
                {t.lab.run}
              </Button>
            )}
            <Button onClick={run} disabled={status === 'stopped' || status === 'error'} aria-label={t.lab.restart}>
              <RotateCcw aria-hidden="true" />
              <span className="max-sm:hidden">{t.lab.restart}</span>
            </Button>
            <span className={cn('rounded-(--radius-pill) px-3 py-1 text-sm font-extrabold', statusChip.cls)} role="status" data-testid="status">
              {statusChip.text}
            </span>
            {frame && (
              <span className="font-mono text-sm text-muted-foreground tabular-nums" aria-label={t.lab.time}>
                {(frame.t / 1000).toFixed(1)} s
              </span>
            )}
            <span className="flex-1" />
            <Button variant="ghost" size="icon-sm" onClick={() => setSound((v) => !v)} aria-pressed={sound} aria-label={t.lab.sound} title={t.lab.sound}>
              {sound ? <Volume2 aria-hidden="true" /> : <VolumeX aria-hidden="true" />}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => {
                if (window.confirm(t.lab.confirmClear)) changeDoc({ parts: [], wires: [] })
              }}
              aria-label={t.lab.clearBench}
              title={t.lab.clearBench}
            >
              <Eraser aria-hidden="true" />
            </Button>
          </div>

          {error && (
            <p className="m-0 flex items-start gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-destructive bg-(--danger-bg) p-3 text-sm font-bold text-destructive" role="alert" data-testid="code-error">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {fill(t.lab.errorLine, { line: error.line, text: errorText(error, t) })}
            </p>
          )}
          {uniqueFaults.length > 0 && (
            <ul className="m-0 grid list-none gap-1.5 p-0" aria-label={t.lab.faults} data-testid="faults">
              {uniqueFaults.map((f) => (
                <li key={`${f.code}${f.part}${f.pin}`} className="flex items-start gap-2 rounded-(--radius-sm) bg-(--warn-bg) p-2.5 text-sm font-bold text-(--warn-text)" data-fault={f.code}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {faultText(f, t)}
                </li>
              ))}
            </ul>
          )}

          <Bench doc={work.doc} onChange={changeDoc} frame={frame} running={status === 'running'} selection={selection} onSelect={setSelection} t={t} />
          <p className="m-0 text-sm text-muted-foreground">{t.lab.howTo}</p>

          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <div className="grid content-start gap-2">
              <h2 className="m-0 text-base">{t.lab.parts}</h2>
              <div className="grid grid-cols-4 gap-2">
                {PART_TYPES.map((type) => (
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
            <div className="grid content-start gap-2 rounded-(--radius-md) border-(length:--stroke-thin) border-border p-3" data-testid="inspector">
              {selectedPart ? (
                <PartInspector part={selectedPart} frame={frame} t={t} setProps={setProps} running={status === 'running'} />
              ) : selectedWire ? (
                <>
                  <h2 className="m-0 text-base">{t.lab.wire}</h2>
                  <label className="grid gap-1 text-sm font-bold">
                    {t.lab.wireColor}
                    <span className="flex flex-wrap gap-1.5">
                      {['#d93025', '#202124', '#e8710a', '#f9ab00', '#188038', '#1a73e8', '#9334e6', '#ffffff'].map((c) => (
                        <button
                          key={c}
                          type="button"
                          className={cn('size-7 cursor-pointer rounded-full border-2', selectedWire.color === c ? 'border-ring' : 'border-border')}
                          style={{ background: c }}
                          aria-label={c}
                          onClick={() => changeDoc({ ...work.doc, wires: work.doc.wires.map((w) => (w.id === selectedWire.id ? { ...w, color: c } : w)) })}
                        />
                      ))}
                    </span>
                  </label>
                </>
              ) : (
                <p className="m-0 text-sm text-muted-foreground">{t.lab.nothingSelected}</p>
              )}
              {selection && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {selectedPart && (
                    <Button size="sm" onClick={() => changeDoc({ ...work.doc, parts: work.doc.parts.map((p) => (p.id === selectedPart.id ? { ...p, rot: ((p.rot + 1) % 4) as Part['rot'] } : p)) })}>
                      <RotateCw aria-hidden="true" />
                      {t.lab.rotate}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => {
                      changeDoc(removeSelection(work.doc, selection))
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
        </section>

        <section className="grid min-w-0 gap-3" aria-label={t.lab.code}>
          <h2 className="m-0 text-base">{t.lab.code}</h2>
          <div className="h-[420px]">
            <CodeEditor value={work.code} onChange={(code) => setWork((w) => ({ ...w, code }))} errorLine={error?.line ?? null} label={t.lab.code} loading={t.lab.loadingEditor} />
          </div>
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <h2 className="m-0 text-base">{t.lab.serial}</h2>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  serialRef.current = ''
                  setSerial('')
                }}
              >
                {t.lab.clear}
              </Button>
            </div>
            <SerialOutput text={serial} empty={t.lab.serialEmpty} />
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault()
                send()
              }}
            >
              <input
                className="min-h-10 min-w-0 flex-1 rounded-(--radius-sm) border-(length:--stroke-thin) border-border bg-card px-3 font-mono text-sm"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={t.lab.sendPlaceholder}
                aria-label={t.lab.sendPlaceholder}
                disabled={status !== 'running'}
              />
              <Button size="sm" type="submit" disabled={status !== 'running' || !input}>
                {t.lab.send}
              </Button>
            </form>
          </div>
        </section>
      </div>
    </div>
  )
}

function SerialOutput({ text, empty }: { text: string; empty: string }) {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])
  return (
    <pre
      ref={ref}
      className="m-0 h-44 overflow-auto rounded-(--radius-md) border-(length:--stroke-thin) border-(--code-border) bg-(--code-bg) p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap"
      aria-live="off"
      data-testid="serial"
    >
      {text ? text.replace(/\r\n/g, '\n') : <span className="text-muted-foreground">{empty}</span>}
    </pre>
  )
}

function PartPreview({ type }: { type: PartType }) {
  const part: Part = { id: 'preview', type, x: 0, y: 0, rot: 0, props: DEFAULT_PROPS[type] }
  const box: Record<PartType, string> = {
    led: '-6 -30 22 34',
    resistor: '-2 -10 44 20',
    button: '-6 -2 32 34',
    pot: '-6 -32 32 36',
    ldr: '-4 -24 28 28',
    buzzer: '-2 -34 34 36',
    servo: '-40 -6 100 70',
    ultrasonic: '-62 -82 154 84',
  }
  return (
    <svg viewBox={box[type]} className="h-9 w-12" aria-hidden="true">
      <PartArt part={part} />
    </svg>
  )
}

function PartInspector({ part, frame, t, setProps, running }: { part: Part; frame: FrameState | null; t: ElectronicsText; setProps: (id: string, p: Part['props']) => void; running: boolean }) {
  const range = (label: string, value: number, min: number, max: number, step: number, onInput: (v: number) => void, shown: string) => (
    <label className="grid gap-1 text-sm font-bold">
      <span className="flex justify-between gap-2">
        {label}
        <span className="font-mono tabular-nums">{shown}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onInput(Number(e.target.value))} className="w-full accent-(--color-primary)" />
    </label>
  )
  return (
    <>
      <h2 className="m-0 text-base">
        {t.parts[part.type]}
        {frame?.burned.includes(part.id) && <span className="ml-2 text-sm text-destructive">· {t.lab.burned}</span>}
      </h2>
      {part.type === 'led' && (
        <>
          <label className="grid gap-1 text-sm font-bold">
            {t.lab.color}
            <select className="min-h-9 rounded-(--radius-sm) border-(length:--stroke-thin) border-border bg-card px-2" value={part.props.color} onChange={(e) => setProps(part.id, { color: e.target.value as LedColor })}>
              {LED_COLORS.map((c) => (
                <option key={c} value={c}>
                  {t.colors[c]}
                </option>
              ))}
            </select>
          </label>
          {running && frame && (
            <p className="m-0 text-sm">
              {t.lab.current}: <span className="font-mono">{(frame.ledMa[part.id] ?? 0).toFixed(1)} mA</span>
            </p>
          )}
        </>
      )}
      {part.type === 'resistor' && (
        <label className="grid gap-1 text-sm font-bold">
          {t.lab.resistance}
          <select className="min-h-9 rounded-(--radius-sm) border-(length:--stroke-thin) border-border bg-card px-2" value={part.props.ohms} onChange={(e) => setProps(part.id, { ohms: Number(e.target.value) })}>
            {RESISTOR_VALUES.map((v) => (
              <option key={v} value={v}>
                {formatOhms(v)}
              </option>
            ))}
          </select>
        </label>
      )}
      {part.type === 'button' && (
        <Button
          size="sm"
          className="w-fit"
          onPointerDown={() => setProps(part.id, { pressed: true })}
          onPointerUp={() => setProps(part.id, { pressed: false })}
          onPointerLeave={() => part.props.pressed && setProps(part.id, { pressed: false })}
          onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && setProps(part.id, { pressed: true })}
          onKeyUp={() => setProps(part.id, { pressed: false })}
          aria-pressed={Boolean(part.props.pressed)}
        >
          {t.lab.press}
        </Button>
      )}
      {part.type === 'pot' && range(t.lab.knob, part.props.pos ?? 0.5, 0, 1, 0.01, (v) => setProps(part.id, { pos: v }), `${Math.round((part.props.pos ?? 0.5) * 100)}%`)}
      {part.type === 'ldr' && range(t.lab.light, part.props.light ?? 0.5, 0, 1, 0.01, (v) => setProps(part.id, { light: v }), `${Math.round((part.props.light ?? 0.5) * 100)}%`)}
      {part.type === 'ultrasonic' &&
        range(t.lab.distance, part.props.distance ?? 30, 2, 450, 1, (v) => setProps(part.id, { distance: v }), `${part.props.distance ?? 30} ${t.lab.cm}`)}
    </>
  )
}
