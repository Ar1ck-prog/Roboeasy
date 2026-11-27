'use client'

import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Box, Check, Circle, Code2, Eraser, Grid3x3, Lightbulb, Maximize2, Minimize2, Play, Plus, RotateCcw, RotateCw, SlidersHorizontal, Square, Terminal, Trash2, Unplug, Volume2, VolumeX, Wand2 } from 'lucide-react'
import { toast } from 'sonner'

import { Bench, type Selection, removeSelection } from '@/components/electronics/bench'
import { Bench3D } from '@/components/electronics/bench3d'
import { CodeEditor } from '@/components/electronics/code-editor'
import { PartArt, formatOhms } from '@/components/electronics/part-art'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { BB, BENCH, BOARD_IDS, type BoardId, type CircuitDoc, DEFAULT_PROPS, P, LED_COLORS, type LedColor, MODULES, PART_TYPES, type Part, type PartType, RESISTOR_VALUES, boardOf } from '@/lib/electronics/board'
import { MISSION_IDS, type MissionId, createChecker, getMission } from '@/lib/electronics/missions'
import { type Fault, type FrameState, Simulation } from '@/lib/electronics/sim'
import { CodeError } from '@/lib/electronics/lang'
import { loadProgress, saveProgress } from '@/lib/electronics/progress'
import type { Locale } from '@/lib/i18n/config'
import type { ElectronicsText } from '@/lib/i18n/electronics'
import { cn } from '@/lib/utils'

type Workspace = { code: string; doc: CircuitDoc }
type Status = 'stopped' | 'running' | 'error' | 'shorted'

const ESP32_START = `void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT); // GPIO2
}

void loop() {
  digitalWrite(LED_BUILTIN, HIGH);
  delay(500);
  digitalWrite(LED_BUILTIN, LOW);
  delay(500);
}
`
const FREE_START: Record<BoardId, Workspace> = {
  uno: { code: getMission('blink').starter.code, doc: { board: 'uno', parts: [], wires: [] } },
  esp32: { code: ESP32_START, doc: { board: 'esp32', parts: [], wires: [] } },
}
/** Where a workspace is saved: each mission, and the free build of each board. */
const workKey = (mission: MissionId | 'free', board: BoardId) => (mission === 'free' ? (board === 'uno' ? 'free' : `free:${board}`) : mission)

const fill = (text: string, params: Record<string, string | number>) => text.replace(/\{(\w+)\}/g, (_, k: string) => String(params[k] ?? ''))

export function errorText(e: CodeError, t: ElectronicsText): string {
  const params = { ...e.params }
  if (params.what === 'name') params.what = t.errors.name
  const errors = t.errors as Record<string, string>
  // Pin errors have a version for each board.
  const boardKey = params.board && params.board !== 'uno' ? `${e.code}_${params.board}` : null
  const key = e.code === 'expected' && !params.got ? 'expectedEnd' : boardKey && errors[boardKey] ? boardKey : e.code
  return fill(errors[key] ?? e.code, params)
}

export function faultText(f: Fault, t: ElectronicsText): string {
  return fill(t.faults[f.code], { ma: f.ma ?? '', pin: f.pin ?? '' })
}

/** What each part covers on the bench at rotation 0, from its first leg: [left, top, right, bottom] in px. */
const FOOTPRINT: Record<PartType, [number, number, number, number]> = {
  led: [-6, -30, 16, 4],
  resistor: [-2, -10, 42, 10],
  button: [-6, -2, 26, 32],
  pot: [-6, -32, 26, 4],
  ldr: [-4, -24, 24, 4],
  buzzer: [-2, -34, 32, 2],
  rgb: [-6, -34, 36, 6],
  servo: [-52, -6, 60, 124],
  ultrasonic: [-62, -90, 92, 4],
  pir: [-44, -108, 64, 4],
  dht: [-16, -80, 36, 4],
  lcd: [-34, -104, 184, 4],
  joystick: [-18, -146, 58, 4],
}

/** The footprint of a placed part, turned with it. */
function footprintOf(p: Pick<Part, 'type' | 'x' | 'y' | 'rot'>): [number, number, number, number] {
  let [l, t, r, b] = FOOTPRINT[p.type]
  for (let i = 0; i < p.rot; i++) [l, t, r, b] = [-b, l, -t, r]
  return [p.x + l, p.y + t, p.x + r, p.y + b]
}

/** Where to put a new part: the free spot nearest to the breadboard that overlaps nothing. */
function parkingSpot(doc: CircuitDoc, type: PartType): { x: number; y: number } {
  const board = boardOf(doc).rect
  const taken: [number, number, number, number][] = [
    [board.x - 6, board.y - 6, board.x + board.w + 6, board.y + board.h + 6],
    [BB.x - 6, BB.y - 6, BB.x + BB.w + 6, BB.y + BB.h + 6],
    ...doc.parts.map((p) => {
      const [l, t, r, b] = footprintOf(p)
      return [l - 6, t - 6, r + 6, b + 6] as [number, number, number, number]
    }),
  ]
  let best: { x: number; y: number; d: number } | null = null
  for (let y = 0; y <= BENCH.h; y += P) {
    for (let x = 0; x <= BENCH.w; x += P) {
      const [l, t, r, b] = footprintOf({ type, x, y, rot: 0 })
      if (l < 4 || t < 4 || r > BENCH.w - 4 || b > BENCH.h - 4) continue
      if (taken.some(([L, T, R, B]) => l < R && r > L && t < B && b > T)) continue
      const d = Math.hypot(x - (BB.x + BB.w / 2), (y - (BB.y + BB.h)) * 1.4)
      if (!best || d < best.d) best = { x, y, d }
    }
  }
  if (best) return { x: best.x, y: best.y }
  // The bench is full: stack it a little to the side of the last part.
  const n = doc.parts.length
  return { x: 340 + (n % 6) * 40, y: Math.min(BENCH.h - 20, 300 + Math.floor(n / 6) * 30) }
}

interface LabProps {
  lang: Locale
  t: ElectronicsText
}

const start = (id: MissionId | 'free', board: BoardId = 'uno'): Workspace => structuredClone(id === 'free' ? FREE_START[board] : getMission(id).starter)
const isMission = (id: string | null): id is MissionId => (MISSION_IDS as readonly string[]).includes(id ?? '')
const isBoard = (id: string | null): id is BoardId => (BOARD_IDS as readonly string[]).includes(id ?? '')

export function Lab({ lang, t }: LabProps) {
  const [mission, setMission] = useState<MissionId | 'free'>('free')
  const [work, setWork] = useState<Workspace>(FREE_START.uno)
  const board: BoardId = work.doc.board ?? 'uno'
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
  const [view, setView] = useState<'3d' | '2d'>('3d')
  const [tab, setTab] = useState<'code' | 'part'>('code')
  const [full, setFull] = useState(false)
  const workspace = useRef<HTMLDivElement>(null)
  /** The 3D bench draws every simulation frame itself; React state follows at 20 Hz (every frame for the 2D schematic). */
  const push3d = useRef<((f: FrameState | null, running: boolean) => void) | null>(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const editCode = useCallback((code: string) => setWork((w) => ({ ...w, code })), [])

  const sim = useRef<Simulation | null>(null)
  const raf = useRef(0)
  const checker = useRef<ReturnType<typeof createChecker> | null>(null)
  const docRef = useRef(work.doc)
  const serialRef = useRef('')
  const audio = useRef<{ ctx: AudioContext; osc: OscillatorNode | null; gain: GainNode } | null>(null)
  const soundRef = useRef(sound)
  const missionRef = useRef(mission)
  const boardRef = useRef(board)
  boardRef.current = board
  docRef.current = work.doc
  soundRef.current = sound
  missionRef.current = mission

  // The mission comes from ?mission= (the page itself is static); saved work and finished missions live in this browser.
  useEffect(() => {
    const query = new URLSearchParams(window.location.search)
    const param = query.get('mission')
    const id = isMission(param) ? param : 'free'
    const b = id === 'free' && isBoard(query.get('board')) ? (query.get('board') as BoardId) : 'uno'
    const saved = loadProgress()
    setDone(new Set(saved.done))
    setMission(id)
    setWork(saved.work[workKey(id, b)] ?? start(id, b))
    setLoaded(true)
  }, [])

  useEffect(() => {
    if (!loaded) return
    const key = workKey(mission, board)
    const id = window.setTimeout(() => saveProgress((p) => ({ ...p, work: { ...p.work, [key]: work } })), 400)
    return () => window.clearTimeout(id)
  }, [work, mission, board, loaded])

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

  // Full screen covers the three panels; Esc (handled by the browser) leaves it.
  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === workspace.current && workspace.current !== null)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])
  const toggleFull = () => {
    if (document.fullscreenElement) void document.exitFullscreen()
    else void workspace.current?.requestFullscreen?.().catch(() => {})
  }

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
    let lastUi = 0
    const tick = (now: number) => {
      const current = sim.current
      if (!current) return
      const dt = Math.min(50, Math.max(1, now - last))
      last = now
      const f = current.step(dt)
      push3d.current?.(f, true)
      if (viewRef.current === '2d' || now - lastUi >= 50) {
        lastUi = now
        setFrame(f)
      }
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
    const saved = loadProgress().work[workKey(id, 'uno')]
    setWork(saved ?? start(id))
    const url = new URL(window.location.href)
    url.searchParams.delete('board')
    if (id === 'free') url.searchParams.delete('mission')
    else url.searchParams.set('mission', id)
    window.history.replaceState(null, '', url)
  }

  /** The free build has its own bench for each board. */
  const chooseBoard = (b: BoardId) => {
    if (b === board) return
    stop()
    setStatus('stopped')
    setError(null)
    setSelection(null)
    saveProgress((p) => ({ ...p, work: { ...p.work, [workKey('free', board)]: work } }))
    setWork(loadProgress().work[workKey('free', b)] ?? start('free', b))
    const url = new URL(window.location.href)
    if (b === 'uno') url.searchParams.delete('board')
    else url.searchParams.set('board', b)
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

  const running = status === 'running'
  const metGoals = goals.filter(Boolean).length
  const toolBtn = 'inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-(--radius-sm) px-2.5 text-sm font-bold text-foreground transition-colors hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-40'

  return (
    <div className="mx-auto grid w-full max-w-[1680px] grid-cols-[minmax(0,1fr)] gap-4 px-3 py-5 sm:px-5 md:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-1.5">
          <Link href={`/${lang}/electronics`} className="inline-flex w-fit items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="size-4" aria-hidden="true" />
            {t.lab.backToHub}
          </Link>
          <h1 className="m-0 text-3xl md:text-4xl">{t.lab.title}</h1>
        </div>
        <nav aria-label={t.lab.missions} className="-mx-1 flex max-w-full gap-2 overflow-x-auto px-1 pb-1">
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
        <Card flat className="gap-3 p-4" data-testid="mission-card">
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
          <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-start">
            <div>
              <div className="mb-2 flex items-center gap-3">
                <h3 className="m-0 text-sm font-extrabold tracking-wide text-muted-foreground uppercase">{t.lab.goals}</h3>
                <div className="h-2 max-w-48 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
                  <div className="h-full rounded-full bg-success transition-[width] duration-500" style={{ width: `${(metGoals / missionText.goals.length) * 100}%` }} />
                </div>
                <span className="font-mono text-sm font-bold tabular-nums">
                  {metGoals}/{missionText.goals.length}
                </span>
              </div>
              <ul className="m-0 grid list-none gap-x-6 gap-y-1.5 p-0 lg:grid-cols-2">
                {missionText.goals.map((g, i) => (
                  <li key={g} className="flex items-start gap-2" data-goal={i} data-met={goals[i] ? 'true' : 'false'}>
                    {goals[i] ? <Check className="mt-0.5 size-5 shrink-0 text-success" aria-hidden="true" /> : <Circle className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />}
                    <span className={goals[i] ? 'font-bold' : undefined}>{g}</span>
                  </li>
                ))}
              </ul>
            </div>
            <details className="text-sm md:max-w-80">
              <summary className="inline-flex cursor-pointer items-center gap-1.5 font-bold">
                <Lightbulb className="size-4" aria-hidden="true" />
                {t.lab.hint}
              </summary>
              <p className="m-0 mt-2 text-muted-foreground">{missionText.hint}</p>
            </details>
          </div>
        </Card>
      )}

      <div
        ref={workspace}
        className={cn(
          'grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[236px_minmax(0,1fr)_minmax(340px,420px)]',
          full ? 'h-dvh overflow-auto bg-background p-3 xl:overflow-hidden' : 'xl:h-[min(80vh,780px)] xl:min-h-[600px]',
        )}
        data-testid="lab-workspace"
      >
        {/* ── Left: the board and the parts box ── */}
        <aside className="grid min-h-0 min-w-0 content-start gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-border bg-card p-3 xl:grid-rows-[auto_minmax(0,1fr)]" aria-label={t.lab.parts}>
          <div className="grid gap-2" role="group" aria-label={t.lab.board}>
            <h2 className="m-0 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{t.lab.board}</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {(mission === 'free' ? BOARD_IDS : [board]).map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() => chooseBoard(b)}
                  aria-pressed={board === b}
                  disabled={mission !== 'free'}
                  className={cn(
                    'grid cursor-pointer justify-items-center gap-1 rounded-(--radius-sm) border-(length:--stroke-thin) px-2 py-2 text-xs font-extrabold transition-colors disabled:cursor-default',
                    board === b ? 'border-primary bg-primary/10 text-foreground' : 'border-border hover:bg-surface-2',
                  )}
                  data-board={b}
                >
                  <BoardIcon id={b} />
                  {t.lab.boards[b]}
                </button>
              ))}
            </div>
          </div>
          <div className="grid min-h-0 content-start gap-2">
            <h2 className="m-0 text-xs font-extrabold tracking-wide text-muted-foreground uppercase">{t.lab.components}</h2>
            <div className="-mx-1 flex min-h-0 gap-1.5 overflow-x-auto px-1 pb-1 xl:grid xl:grid-cols-1 xl:gap-1 xl:overflow-x-visible xl:overflow-y-auto xl:pb-0">
              {PART_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => addPart(type)}
                  className="grid w-[88px] shrink-0 cursor-pointer justify-items-center gap-1 rounded-(--radius-sm) border-(length:--stroke-thin) border-border bg-background p-1.5 text-center xl:w-auto text-[11px] leading-tight font-bold transition-colors hover:border-outline hover:bg-surface-2 xl:flex xl:items-center xl:gap-2.5 xl:border-transparent xl:bg-transparent xl:px-2 xl:py-1 xl:text-left xl:text-[13px]"
                  aria-label={fill(t.lab.addPart, { name: t.parts[type] })}
                  title={fill(t.lab.addPart, { name: t.parts[type] })}
                  data-add={type}
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-(--radius-xs) bg-surface-2/70 xl:size-11">
                    <PartPreview type={type} />
                  </span>
                  <span className="line-clamp-2">{t.parts[type]}</span>
                  <Plus className="ml-auto size-4 shrink-0 text-muted-foreground max-xl:hidden" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* ── Centre: the toolbar and the bench ── */}
        <section className="flex min-h-0 min-w-0 flex-col gap-2" aria-label={t.lab.bench}>
          <div className="flex flex-wrap items-center gap-1 rounded-(--radius-md) border-(length:--stroke-thin) border-border bg-card p-1.5">
            {running ? (
              <Button size="sm" variant="primary" onClick={() => (stop(), setStatus('stopped'))}>
                <Square aria-hidden="true" />
                {t.lab.stop}
              </Button>
            ) : (
              <Button size="sm" variant="primary" onClick={run} data-testid="run">
                <Play aria-hidden="true" />
                {t.lab.run}
              </Button>
            )}
            <button type="button" className={toolBtn} onClick={run} disabled={status === 'stopped' || status === 'error'} aria-label={t.lab.restart} title={t.lab.restart}>
              <RotateCcw className="size-4" aria-hidden="true" />
              <span className="max-md:hidden">{t.lab.restart}</span>
            </button>
            <span className={cn('ml-1 rounded-(--radius-pill) px-3 py-1 text-xs font-extrabold', statusChip.cls)} role="status" data-testid="status">
              {statusChip.text}
            </span>
            {frame && (
              <span className="px-1 font-mono text-xs text-muted-foreground tabular-nums" aria-label={t.lab.time}>
                {(frame.t / 1000).toFixed(1)} s
              </span>
            )}
            <span className="flex-1" />
            <div className="inline-flex rounded-(--radius-sm) bg-surface-2 p-0.5" role="group" aria-label={t.lab.viewLabel}>
              {(['3d', '2d'] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  aria-pressed={view === v}
                  className={cn('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-(--radius-xs) px-2.5 text-xs font-extrabold transition-colors', view === v ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                  data-testid={`view-${v}`}
                >
                  {v === '3d' ? <Box className="size-4" aria-hidden="true" /> : <Grid3x3 className="size-4" aria-hidden="true" />}
                  {v === '3d' ? t.lab.view3d : t.lab.view2d}
                </button>
              ))}
            </div>
            <button
              type="button"
              className={toolBtn}
              onClick={() => {
                if (work.doc.wires.length && window.confirm(t.lab.confirmClearWires)) {
                  changeDoc({ ...work.doc, wires: [] })
                  setSelection(null)
                }
              }}
              disabled={!work.doc.wires.length}
              aria-label={t.lab.clearWires}
              title={t.lab.clearWires}
            >
              <Unplug className="size-4" aria-hidden="true" />
              <span className="max-2xl:hidden">{t.lab.clearWires}</span>
            </button>
            <button
              type="button"
              className={toolBtn}
              onClick={() => {
                if (window.confirm(t.lab.confirmClear)) {
                  changeDoc({ ...work.doc, parts: [], wires: [] })
                  setSelection(null)
                }
              }}
              aria-label={t.lab.clearBench}
              title={t.lab.clearBench}
            >
              <Eraser className="size-4" aria-hidden="true" />
            </button>
            <button type="button" className={toolBtn} onClick={() => setSound((v) => !v)} aria-pressed={sound} aria-label={t.lab.sound} title={t.lab.sound}>
              {sound ? <Volume2 className="size-4" aria-hidden="true" /> : <VolumeX className="size-4" aria-hidden="true" />}
            </button>
            <button type="button" className={toolBtn} onClick={toggleFull} aria-pressed={full} aria-label={full ? t.lab.exitFullscreen : t.lab.fullscreen} title={full ? t.lab.exitFullscreen : t.lab.fullscreen}>
              {full ? <Minimize2 className="size-4" aria-hidden="true" /> : <Maximize2 className="size-4" aria-hidden="true" />}
            </button>
          </div>

          {error && (
            <p className="m-0 flex items-start gap-2 rounded-(--radius-sm) border-(length:--stroke-thin) border-destructive bg-(--danger-bg) p-2.5 text-sm font-bold text-destructive" role="alert" data-testid="code-error">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {fill(t.lab.errorLine, { line: error.line, text: errorText(error, t) })}
            </p>
          )}
          {uniqueFaults.length > 0 && (
            <ul className="m-0 grid max-h-28 list-none gap-1.5 overflow-y-auto p-0" aria-label={t.lab.faults} data-testid="faults">
              {uniqueFaults.map((f) => (
                <li key={`${f.code}${f.part}${f.pin}`} className="flex items-start gap-2 rounded-(--radius-sm) bg-(--warn-bg) p-2 text-sm font-bold text-(--warn-text)" data-fault={f.code}>
                  <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  {faultText(f, t)}
                </li>
              ))}
            </ul>
          )}

          <div className="min-h-0 flex-1">
            {view === '3d' ? (
              <Bench3D doc={work.doc} onChange={changeDoc} frame={frame} running={running} selection={selection} onSelect={setSelection} onInspect={() => setTab('part')} t={t} pushRef={push3d} fill />
            ) : (
              <div className="h-full overflow-auto">
                <Bench doc={work.doc} onChange={changeDoc} frame={frame} running={running} selection={selection} onSelect={setSelection} t={t} />
              </div>
            )}
          </div>
          <p className="m-0 text-xs text-muted-foreground">{view === '3d' ? t.lab.howTo3d : t.lab.howTo}</p>
        </section>

        {/* ── Right: code and serial monitor, or the selected part ── */}
        <section className="flex min-h-0 min-w-0 flex-col gap-2 rounded-(--radius-md) border-(length:--stroke-thin) border-border bg-card p-2" aria-label={t.lab.code}>
          <div className="flex gap-1 rounded-(--radius-sm) bg-surface-2 p-0.5" role="tablist" aria-label={t.lab.code}>
            {(['code', 'part'] as const).map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={cn('relative inline-flex h-8 flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-(--radius-xs) text-sm font-extrabold transition-colors', tab === id ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}
                data-testid={`tab-${id}`}
              >
                {id === 'code' ? <Code2 className="size-4" aria-hidden="true" /> : <SlidersHorizontal className="size-4" aria-hidden="true" />}
                {id === 'code' ? t.lab.code : t.lab.partTab}
                {id === 'part' && selection && tab !== 'part' && <span className="size-2 rounded-full bg-primary" aria-hidden="true" />}
              </button>
            ))}
          </div>

          <div className={cn('min-h-0 flex-1 flex-col gap-2', tab === 'code' ? 'flex' : 'hidden')} role="tabpanel">
            <div className="h-[420px] min-h-0 xl:h-auto xl:flex-1">
              <CodeEditor value={work.code} onChange={editCode} errorLine={error?.line ?? null} label={t.lab.code} loading={t.lab.loadingEditor} />
            </div>
            <div className="grid gap-1.5">
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 inline-flex items-center gap-1.5 text-sm">
                  <Terminal className="size-4" aria-hidden="true" />
                  {t.lab.serial}
                </h2>
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
              <SerialOutput text={serial} empty={t.lab.serialEmpty} className="h-36" />
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault()
                  send()
                }}
              >
                <input
                  className="min-h-9 min-w-0 flex-1 rounded-(--radius-sm) border-(length:--stroke-thin) border-border bg-background px-3 font-mono text-sm"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={t.lab.sendPlaceholder}
                  aria-label={t.lab.sendPlaceholder}
                  disabled={!running}
                />
                <Button size="sm" type="submit" disabled={!running || !input}>
                  {t.lab.send}
                </Button>
              </form>
            </div>
          </div>

          <div className={cn('min-h-0 flex-1 content-start gap-2 overflow-y-auto p-1', tab === 'part' ? 'grid' : 'hidden')} role="tabpanel" data-testid="inspector">
            {selectedPart ? (
              <PartInspector part={selectedPart} frame={frame} t={t} setProps={setProps} running={running} />
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
        </section>
      </div>
    </div>
  )
}

/** A tiny drawing of each board for the board picker. */
function BoardIcon({ id }: { id: BoardId }) {
  if (id === 'esp32')
    return (
      <svg viewBox="0 0 48 30" className="h-7 w-11" aria-hidden="true">
        <rect x="4" y="5" width="40" height="20" rx="2" fill="#1d1f24" />
        <rect x="30" y="8" width="12" height="14" rx="1" fill="#b9bec7" />
        <path d="M34 10h6M34 13h6M34 16h6M34 19h6" stroke="#8a919c" strokeWidth="1" />
        {Array.from({ length: 10 }, (_, i) => (
          <g key={i}>
            <rect x={7 + i * 2.6} y="5.5" width="1.4" height="1.4" fill="#d9b44a" />
            <rect x={7 + i * 2.6} y="23" width="1.4" height="1.4" fill="#d9b44a" />
          </g>
        ))}
        <rect x="1" y="12" width="5" height="6" rx="1" fill="#c9ced6" />
      </svg>
    )
  return (
    <svg viewBox="0 0 48 30" className="h-7 w-11" aria-hidden="true">
      <rect x="3" y="3" width="42" height="25" rx="2.5" fill="#00878f" />
      <rect x="0" y="6" width="8" height="7" rx="1" fill="#c9ced6" />
      <rect x="0" y="19" width="7" height="6" rx="1" fill="#1d1f24" />
      <rect x="20" y="14" width="18" height="5" rx="1" fill="#1d1f24" />
      {Array.from({ length: 12 }, (_, i) => (
        <rect key={i} x={15 + i * 2.4} y="4.5" width="1.6" height="2" fill="#1d1f24" />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <rect key={i} x={19 + i * 2.4} y="24.5" width="1.6" height="2" fill="#1d1f24" />
      ))}
    </svg>
  )
}

export function SerialOutput({ text, empty, className }: { text: string; empty: string; className?: string }) {
  const ref = useRef<HTMLPreElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [text])
  return (
    <pre
      ref={ref}
      className={cn('m-0 h-44 overflow-auto rounded-(--radius-md) border-(length:--stroke-thin) border-(--code-border) bg-(--code-bg) p-3 font-mono text-[#e6e9ef] text-sm leading-relaxed whitespace-pre-wrap', className)}
      aria-live="off"
      data-testid="serial"
    >
      {text ? text.replace(/\r\n/g, '\n') : <span className="text-muted-foreground">{empty}</span>}
    </pre>
  )
}

export const PartPreview = memo(function PartPreview({ type }: { type: PartType }) {
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
    rgb: '-6 -34 42 40',
    pir: '-44 -108 108 112',
    dht: '-16 -80 52 84',
    lcd: '-34 -104 218 108',
    joystick: '-18 -96 76 100',
  }
  return (
    <svg viewBox={box[type]} className="h-9 w-12" aria-hidden="true">
      <PartArt part={part} />
    </svg>
  )
})

export function PartInspector({ part, frame, t, setProps, running }: { part: Part; frame: FrameState | null; t: ElectronicsText; setProps: (id: string, p: Part['props']) => void; running: boolean }) {
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
      {part.type === 'pir' && (
        <label className="flex items-center gap-2 text-sm font-bold">
          <input type="checkbox" checked={Boolean(part.props.motion)} onChange={(e) => setProps(part.id, { motion: e.target.checked })} className="size-4 accent-(--color-primary)" />
          {t.lab.motion}
        </label>
      )}
      {part.type === 'dht' && (
        <>
          {range(t.lab.temp, part.props.temp ?? 24, -10, 50, 1, (v) => setProps(part.id, { temp: v }), `${part.props.temp ?? 24} °C`)}
          {range(t.lab.humidity, part.props.humidity ?? 45, 0, 100, 1, (v) => setProps(part.id, { humidity: v }), `${part.props.humidity ?? 45} %`)}
        </>
      )}
      {part.type === 'joystick' && (
        <>
          {range(t.lab.stickX, part.props.jx ?? 0.5, 0, 1, 0.01, (v) => setProps(part.id, { jx: v }), `${Math.round((part.props.jx ?? 0.5) * 100)}%`)}
          {range(t.lab.stickY, part.props.jy ?? 0.5, 0, 1, 0.01, (v) => setProps(part.id, { jy: v }), `${Math.round((part.props.jy ?? 0.5) * 100)}%`)}
          <Button
            size="sm"
            className="w-fit"
            onPointerDown={() => setProps(part.id, { pressed: true })}
            onPointerUp={() => setProps(part.id, { pressed: false })}
            onPointerLeave={() => part.props.pressed && setProps(part.id, { pressed: false })}
            aria-pressed={Boolean(part.props.pressed)}
          >
            {t.lab.press}
          </Button>
        </>
      )}
      {part.type === 'ultrasonic' &&
        range(t.lab.distance, part.props.distance ?? 30, 2, 450, 1, (v) => setProps(part.id, { distance: v }), `${part.props.distance ?? 30} ${t.lab.cm}`)}
    </>
  )
}
