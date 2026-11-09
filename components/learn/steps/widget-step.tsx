'use client'

import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Check, Hand, Loader2, Sparkles } from 'lucide-react'

import { RobotPanel } from '@/components/robot-link'
import { RichText } from '@/components/learn/rich-text'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { KnnModel, type Prediction, type Vector, pixelsToVector } from '@/lib/ai-school/knn'
import { SAMPLE_GAME, type VibeResponse, sandboxedDocument } from '@/lib/ai-school/vibe'
import { deviceHeaders } from '@/lib/device-id'
import { programToPython } from '@/lib/dsl/compile-python'
import type { Step } from '@/lib/dsl/types'
import { type Locale, fill } from '@/lib/i18n/config'
import { getAiSchoolText } from '@/lib/i18n/ai-school'
import type { ClientStep } from '@/lib/learn/content'
import { runOnHub, stopHub, useBluetoothAvailable, useHub } from '@/lib/spike/ble'
import type { DeviceUpdate } from '@/lib/spike/ble-protocol'

import type { StepDone } from './simple-steps'

type WidgetData = Extract<ClientStep, { type: 'widget' }>
type Text = ReturnType<typeof getAiSchoolText>

const program = (steps: Step[]) => programToPython({ title: 'RoboEasy', description: '', steps })
const DRIVE = program([
  { op: 'start_move', direction: 'forward' },
  { op: 'forever', steps: [{ op: 'wait', seconds: 1 }] },
])
const PUSH_RIGHT = program([
  { op: 'motor_run', port: 'F', direction: 'clockwise', value: 90, unit: 'degrees' },
  { op: 'motor_to_position', port: 'F', position: 0, direction: 'shortest' },
])
const PUSH_LEFT = program([
  { op: 'motor_run', port: 'F', direction: 'counterclockwise', value: 90, unit: 'degrees' },
  { op: 'motor_to_position', port: 'F', position: 0, direction: 'shortest' },
])

export default function WidgetStep({ step, lang, done, onDone }: { step: WidgetData; lang: Locale; done: boolean; onDone: (d: StepDone) => void }) {
  const t = getAiSchoolText(lang)
  return (
    <Card className="gap-4">
      <CardTitle>{step.title[lang]}</CardTitle>
      <RichText text={step.task[lang]} />
      {step.widget === 'vibe' && <VibeWidget lang={lang} t={t} done={done} onDone={onDone} />}
      {step.widget === 'gesture' && <GestureWidget lang={lang} t={t} done={done} onDone={onDone} target={20} />}
      {step.widget === 'few-examples' && <GestureWidget lang={lang} t={t} done={done} onDone={onDone} target={3} few />}
      {step.widget === 'color' && <ColorWidget lang={lang} t={t} done={done} onDone={onDone} />}
      {done && (
        <p className="alert alert-ok m-0 flex items-center gap-2" role="status">
          <Check className="size-5" aria-hidden="true" />
          {t.done}
        </p>
      )}
    </Card>
  )
}

// ── Vibe coding ─────────────────────────────────────────────────────────

function VibeWidget({ lang, t, done, onDone }: { lang: Locale; t: Text; done: boolean; onDone: (d: StepDone) => void }) {
  const [prompt, setPrompt] = useState('')
  const [html, setHtml] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [problem, setProblem] = useState('')
  const finished = useRef(done)

  const finish = () => {
    if (finished.current) return
    finished.current = true
    onDone({ firstTry: true, hints: 0 })
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setProblem('')
    try {
      const res = await fetch('/api/vibe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...deviceHeaders() },
        body: JSON.stringify({ lang, prompt, previous: html ?? undefined }),
      })
      const data = (await res.json()) as VibeResponse
      if (data.ok) {
        setHtml(data.html)
        setPrompt('')
        finish()
      } else setProblem(fill(t.vibe.errors[data.error], { m: Math.max(1, Math.ceil((data.retryAfter ?? 60) / 60)) }))
    } catch {
      setProblem(t.vibe.errors.unavailable)
    }
    setBusy(false)
  }

  return (
    <div className="grid gap-3">
      <form className="grid gap-2" onSubmit={submit}>
        <label className="grid gap-1 font-bold">
          {html ? t.vibe.change : t.vibe.describe}
          <textarea
            className="textarea"
            rows={3}
            maxLength={400}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder={t.vibe.placeholder}
            required
          />
        </label>
        <button type="submit" className={buttonVariants({ variant: 'primary', className: 'justify-self-start' })} disabled={busy || prompt.trim().length < 3}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
          {busy ? t.vibe.building : html ? t.vibe.apply : t.vibe.build}
        </button>
      </form>
      <p className="m-0 text-sm text-muted-foreground">{t.vibe.note}</p>
      {problem && (
        <>
          <p className="alert m-0" role="alert">
            {problem}
          </p>
          {!html && (
            <button
              type="button"
              className={buttonVariants({ className: 'justify-self-start' })}
              onClick={() => {
                setHtml(SAMPLE_GAME)
                finish()
              }}
            >
              {t.vibe.sample}
            </button>
          )}
        </>
      )}
      {html && (
        <iframe
          title={t.vibe.frame}
          sandbox="allow-scripts"
          srcDoc={sandboxedDocument(html)}
          className="h-[400px] w-full rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-white"
          data-testid="vibe-frame"
        />
      )}
    </div>
  )
}

// ── Gestures: camera frames train a model on this device ───────────────

type Gesture = 'palm' | 'fist'
const GRID = { width: 32, height: 24 }
const STABLE_FRAMES = 4

function GestureWidget({
  lang,
  t,
  done,
  onDone,
  target,
  few = false,
}: {
  lang: Locale
  t: Text
  done: boolean
  onDone: (d: StepDone) => void
  target: number
  few?: boolean
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const model = useRef(new KnnModel<Gesture>())
  const holding = useRef<ReturnType<typeof setInterval> | null>(null)
  const seen = useRef(new Set<Gesture>())
  const predictions = useRef(0)
  const stable = useRef<{ label: Gesture | null; run: number; sent: Gesture | null }>({ label: null, run: 0, sent: null })
  const finished = useRef(done)
  const [cameraOn, setCameraOn] = useState(false)
  const [denied, setDenied] = useState(false)
  const [counts, setCounts] = useState<Record<Gesture, number>>({ palm: 0, fist: 0 })
  const [prediction, setPrediction] = useState<Prediction<Gesture> | null>(null)
  const [drive, setDrive] = useState(false)
  const driveRef = useRef(false)
  const bluetooth = useBluetoothAvailable()

  const frame = useCallback((): Vector | null => {
    const video = videoRef.current
    const canvas = canvasRef.current
    const context = canvas?.getContext('2d', { willReadFrequently: true })
    if (!video || !context || video.readyState < 2) return null
    context.drawImage(video, 0, 0, GRID.width, GRID.height)
    return pixelsToVector(context.getImageData(0, 0, GRID.width, GRID.height).data)
  }, [])

  const stop = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setCameraOn(false)
  }, [])

  // The camera is switched off when the learner leaves this step.
  useEffect(() => stop, [stop])

  const start = async () => {
    setDenied(false)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 320, height: 240 }, audio: false })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setCameraOn(true)
    } catch {
      setDenied(true)
    }
  }

  const complete = useCallback(() => {
    if (finished.current) return
    finished.current = true
    onDone({ firstTry: true, hints: 0 })
  }, [onDone])

  const addExample = useCallback(
    (label: Gesture) => {
      const vector = frame()
      if (!vector || model.current.count(label) >= (few ? target : 60)) return
      model.current.add(label, vector)
      setCounts((c) => ({ ...c, [label]: model.current.count(label) }))
    },
    [frame, few, target],
  )

  const stopHold = () => {
    if (holding.current) clearInterval(holding.current)
    holding.current = null
  }
  const startHold = (label: Gesture) => {
    addExample(label)
    stopHold()
    holding.current = setInterval(() => addExample(label), 150)
  }
  useEffect(() => stopHold, [])

  const ready = few ? counts.palm >= 1 && counts.fist >= 1 : counts.palm >= target && counts.fist >= target

  // Live test: compare the camera with the examples a few times a second.
  useEffect(() => {
    if (!cameraOn || !ready) return
    const timer = setInterval(() => {
      const vector = frame()
      if (!vector) return
      const p = model.current.predict(vector, 5)
      setPrediction(p)
      if (!p) return
      predictions.current += 1
      seen.current.add(p.label)
      if (few ? predictions.current >= 15 : seen.current.size === 2) complete()

      const s = stable.current
      s.run = s.label === p.label ? s.run + 1 : 1
      s.label = p.label
      if (driveRef.current && s.run >= STABLE_FRAMES && p.confidence > 0.7 && s.sent !== p.label) {
        s.sent = p.label
        if (p.label === 'palm') void runOnHub(DRIVE)
        else void stopHub()
      }
    }, 200)
    return () => clearInterval(timer)
  }, [cameraOn, ready, frame, complete, few])

  const names: Record<Gesture, string> = { palm: t.gesture.palm, fist: t.gesture.fist }

  return (
    <div className="grid gap-3">
      <p className="m-0 text-sm font-bold">{t.gesture.privacy}</p>
      <div className="grid gap-3 sm:grid-cols-[320px_1fr]">
        <div className="relative aspect-[4/3] w-full max-w-[320px] overflow-hidden rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-surface-2">
          <video ref={videoRef} muted playsInline className="block h-full w-full -scale-x-100 object-cover" data-testid="camera" />
          {!cameraOn && (
            <button
              type="button"
              className={buttonVariants({ variant: 'primary', className: 'absolute inset-0 m-auto h-fit w-fit' })}
              onClick={() => void start()}
            >
              <Camera aria-hidden="true" />
              {t.gesture.camera}
            </button>
          )}
        </div>
        <canvas ref={canvasRef} width={GRID.width} height={GRID.height} className="hidden" />
        <div className="grid content-start gap-3">
          {(['palm', 'fist'] as const).map((g) => (
            <div key={g} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className={buttonVariants({ className: 'touch-none select-none' })}
                disabled={!cameraOn}
                onPointerDown={() => startHold(g)}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && addExample(g)}
              >
                <Hand aria-hidden="true" />
                {fill(t.gesture.add, { name: names[g] })}
              </button>
              <span className="font-bold tabular-nums" data-testid={`count-${g}`}>
                {counts[g]} / {target}
              </span>
            </div>
          ))}
          <p className="m-0 text-sm text-muted-foreground">{few ? t.gesture.fewHint : t.gesture.hint}</p>
          {prediction ? (
            <div className="grid gap-1" data-testid="prediction">
              <p className="m-0 text-xl font-bold">{names[prediction.label]}</p>
              <div className="h-3 rounded-full bg-surface-2">
                <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(prediction.confidence * 100)}%` }} />
              </div>
              <p className="m-0 text-sm tabular-nums text-muted-foreground">{fill(t.gesture.confidence, { n: Math.round(prediction.confidence * 100) })}</p>
            </div>
          ) : null}
          {bluetooth && !few && (
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={drive}
                onChange={(e) => {
                  setDrive(e.target.checked)
                  driveRef.current = e.target.checked
                  stable.current.sent = null
                }}
              />
              {t.gesture.drive}
            </label>
          )}
        </div>
      </div>
      {denied && (
        <p className="alert m-0" role="alert">
          {t.gesture.denied}
        </p>
      )}
      {bluetooth && !few && <RobotPanel lang={lang} />}
      {!done && (
        <button
          type="button"
          className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'justify-self-start' })}
          onClick={() => onDone({ firstTry: false, hints: 0 })}
        >
          {t.gesture.skip}
        </button>
      )}
    </div>
  )
}

// ── Colours: readings of the sensor, or sample swatches without a robot ─

type Colour = 'red' | 'blue'
const SWATCHES: { name: string; rgb: [number, number, number] }[] = [
  { name: 'A', rgb: [230, 40, 50] },
  { name: 'B', rgb: [190, 30, 80] },
  { name: 'C', rgb: [40, 70, 220] },
  { name: 'D', rgb: [30, 120, 210] },
  { name: 'E', rgb: [140, 50, 170] },
  { name: 'F', rgb: [240, 90, 40] },
]
const NEED_EXAMPLES = 3
const NEED_CHECKS = 3

function ColorWidget({ lang, t, done, onDone }: { lang: Locale; t: Text; done: boolean; onDone: (d: StepDone) => void }) {
  const model = useRef(new KnnModel<Colour>())
  const finished = useRef(done)
  const hub = useHub()
  const bluetooth = useBluetoothAvailable()
  const [sample, setSample] = useState<number[] | null>(null)
  const [counts, setCounts] = useState<Record<Colour, number>>({ red: 0, blue: 0 })
  const [prediction, setPrediction] = useState<Prediction<Colour> | null>(null)
  const [checks, setChecks] = useState(0)
  const [sort, setSort] = useState(false)
  const reading = Object.values(hub.devices).find((d): d is Extract<DeviceUpdate, { kind: 'color' }> => d.kind === 'color')
  const ready = counts.red >= NEED_EXAMPLES && counts.blue >= NEED_EXAMPLES
  const names: Record<Colour, string> = { red: t.color.red, blue: t.color.blue }

  const choose = (rgb: number[]) => {
    setSample(rgb)
    if (!ready) return setPrediction(null)
    const p = model.current.predict(rgb, 3)
    setPrediction(p)
    if (sort && p) void runOnHub(p.label === 'red' ? PUSH_RIGHT : PUSH_LEFT)
    const next = checks + 1
    setChecks(next)
    if (next >= NEED_CHECKS && !finished.current) {
      finished.current = true
      onDone({ firstTry: true, hints: 0 })
    }
  }

  const teach = (label: Colour) => {
    if (!sample) return
    model.current.add(label, sample)
    setCounts((c) => ({ ...c, [label]: model.current.count(label) }))
    setSample(null)
  }

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={t.color.swatches}>
        {SWATCHES.map((s) => (
          <button
            key={s.name}
            type="button"
            aria-label={fill(t.color.swatch, { name: s.name })}
            className="size-14 rounded-(--radius-md) border-(length:--stroke-thin) border-outline"
            style={{ background: `rgb(${s.rgb.join(' ')})` }}
            onClick={() => choose(s.rgb)}
          />
        ))}
        {reading && (
          <button type="button" className={buttonVariants()} onClick={() => choose([...reading.rgb])}>
            {t.color.read}
          </button>
        )}
      </div>
      {sample && !ready && (
        <div className="flex flex-wrap gap-2">
          {(['red', 'blue'] as const).map((c) => (
            <button key={c} type="button" className={buttonVariants({ variant: 'primary', size: 'sm' })} onClick={() => teach(c)}>
              {fill(t.color.teach, { name: names[c] })}
            </button>
          ))}
        </div>
      )}
      <p className="m-0 tabular-nums" data-testid="color-counts">
        {names.red}: {counts.red} / {NEED_EXAMPLES} · {names.blue}: {counts.blue} / {NEED_EXAMPLES}
      </p>
      <p className="m-0 text-sm text-muted-foreground">{ready ? fill(t.color.test, { n: Math.max(0, NEED_CHECKS - checks) }) : t.color.hint}</p>
      {prediction && (
        <p className="m-0 text-xl font-bold" data-testid="color-prediction">
          {fill(t.color.result, { name: names[prediction.label], n: Math.round(prediction.confidence * 100) })}
        </p>
      )}
      {bluetooth && (
        <>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-0.5" checked={sort} onChange={(e) => setSort(e.target.checked)} />
            {t.color.sort}
          </label>
          <RobotPanel lang={lang} />
        </>
      )}
    </div>
  )
}
