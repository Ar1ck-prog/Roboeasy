'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  Blocks,
  Check,
  ChevronDown,
  CircleDot,
  Code2,
  Copy,
  FileCode2,
  FileDown,
  History,
  Link2,
  Loader2,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
} from 'lucide-react'

import { toast } from 'sonner'

import { BlockStack } from '@/components/block-stack'
import { CodeView } from '@/components/code-view'
import { Badge } from '@/components/ui/badge'
import { EmptyState } from '@/components/ui/empty'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { type Format, type GenerateErrorCode, type GenerateResponse, PROMPT_MAX } from '@/lib/api-types'
import { type Locale, fill } from '@/lib/i18n/config'
import type { Dictionary } from '@/lib/i18n/ru'
import { DEFAULT_ROBOT, PORTS, type Port, type RobotProfile, countSteps } from '@/lib/dsl/types'
import { parseRobot } from '@/lib/dsl/schema'
import {
  type HistoryItem,
  type StudioResult,
  addToHistory,
  decodeShare,
  encodeShare,
  loadFormat,
  loadHistory,
  loadRobot,
  saveFormat,
  saveHistory,
  saveRobot,
} from '@/lib/studio-state'
import { RobotPanel, SendToRobot } from '@/components/robot-link'
import { setMentorProgram } from '@/lib/learn/mentor-context'
import { buttonVariants } from '@/components/ui/button'

type Status = 'idle' | 'loading' | 'error' | 'done'
type ErrorState = { code: GenerateErrorCode | 'network' | 'file'; retryAfter?: number; where: 'composer' | 'result' }

interface StudioProps {
  lang: Locale
  t: Dictionary['studio']
  labels: Dictionary['blocks']
}

function fileSafe(name: string) {
  return (
    name
      .replace(/[^\p{L}\p{N}_\- ]+/gu, '')
      .trim()
      .replace(/\s+/g, '_')
      .slice(0, 40) || 'RoboEasy'
  )
}

function saveFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function Studio({ lang, t, labels }: StudioProps) {
  const [format, setFormat] = useState<Format>('blocks')
  const [prompt, setPrompt] = useState('')
  const [robot, setRobot] = useState<RobotProfile>(DEFAULT_ROBOT)
  const [status, setStatus] = useState<Status>('idle')
  const [error, setError] = useState<ErrorState | null>(null)
  const [result, setResult] = useState<StudioResult | null>(null)
  const [lastPrompt, setLastPrompt] = useState('')
  const [view, setView] = useState<'blocks' | 'python'>('blocks')
  const [projectName, setProjectName] = useState('')
  const [refineText, setRefineText] = useState('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loadingStep, setLoadingStep] = useState(0)
  const [pendingFormat, setPendingFormat] = useState<Format>('blocks')
  const [announce, setAnnounce] = useState('')
  const [aiReady, setAiReady] = useState<boolean | null>(null)

  const abortRef = useRef<AbortController | null>(null)
  const resultRef = useRef<HTMLElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const showToast = useCallback((message: string) => {
    toast.success(message)
  }, [])

  const openResult = useCallback((r: StudioResult) => {
    setResult(r)
    setProjectName(r.title)
    setView(r.format === 'blocks' ? 'blocks' : 'python')
    setStatus('done')
    setError(null)
  }, [])

  // Restore saved settings, apply ?prompt=&format= and #r= share links.
  useEffect(() => {
    const savedRobot = loadRobot()
    if (savedRobot) setRobot(savedRobot)
    const savedFormat = loadFormat()
    if (savedFormat) setFormat(savedFormat)
    setHistory(loadHistory())

    const params = new URLSearchParams(window.location.search)
    const qp = params.get('prompt')
    if (qp) setPrompt(qp.slice(0, PROMPT_MAX))
    const qf = params.get('format')
    if (qf === 'blocks' || qf === 'python' || qf === 'python-free') setFormat(qf)

    const token = new URLSearchParams(window.location.hash.slice(1)).get('r')
    if (token) {
      void decodeShare(token).then((shared) => {
        if (!shared) return
        openResult(shared)
        if (shared.format === 'blocks' || shared.robot) setRobot(shared.robot ?? DEFAULT_ROBOT)
        setFormat(shared.format === 'python' && !shared.program ? 'python-free' : shared.format)
        showToast(t.sharedResult)
      })
    }

    fetch('/api/generate')
      .then((r) => r.json())
      .then((d: { configured?: boolean }) => setAiReady(Boolean(d.configured)))
      .catch(() => setAiReady(null))
  }, [openResult, showToast, t.sharedResult])

  // Loading messages advance while the request is in flight.
  useEffect(() => {
    if (status !== 'loading') return
    setLoadingStep(0)
    const a = setTimeout(() => setLoadingStep(1), 1400)
    const b = setTimeout(() => setLoadingStep(2), 4200)
    return () => {
      clearTimeout(a)
      clearTimeout(b)
    }
  }, [status])

  const chooseFormat = (f: Format) => {
    setFormat(f)
    saveFormat(f)
  }

  const updateRobot = (patch: Partial<RobotProfile>) => {
    setRobot((prev) => {
      const next = parseRobot({ ...prev, ...patch })
      saveRobot(next)
      return next
    })
  }

  async function generate(mode: 'new' | 'refine') {
    const text = (mode === 'refine' ? refineText : prompt).trim()
    const where = mode === 'refine' ? 'result' : 'composer'
    if (text.length < 2 || text.length > PROMPT_MAX) {
      setError({ code: text.length < 2 ? 'bad_request' : 'prompt_too_long', where })
      if (mode === 'new') textareaRef.current?.focus()
      return
    }

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    const requestFormat: Format = mode === 'refine' && result ? (result.format === 'blocks' ? 'blocks' : result.program ? 'python' : 'python-free') : format
    const previous =
      mode === 'refine' && result ? (result.format === 'blocks' || result.program ? { program: result.program } : { code: result.code }) : undefined

    setStatus('loading')
    setPendingFormat(requestFormat)
    setError(null)
    if (window.matchMedia('(max-width: 1023px)').matches) {
      requestAnimationFrame(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    }

    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, format: requestFormat, lang, robot, previous }),
        signal: controller.signal,
      })
      const data = (await res.json().catch(() => ({ ok: false, error: 'ai_failed' }))) as GenerateResponse
      if (!data.ok) {
        setError({ code: data.error, retryAfter: data.retryAfter, where })
        setStatus(result ? 'done' : 'error')
        return
      }
      const next: StudioResult =
        data.format === 'blocks'
          ? { format: 'blocks', title: data.title, description: data.description, program: data.program, python: data.python, robot, warnings: data.warnings }
          : {
              format: 'python',
              title: data.title,
              description: data.description,
              code: data.code,
              program: data.program,
              robot: data.program ? robot : undefined,
              warnings: data.warnings,
            }
      openResult(next)
      setAnnounce(next.title)
      const fullPrompt = mode === 'refine' ? `${lastPrompt} → ${text}` : text
      setLastPrompt(fullPrompt)
      if (mode === 'refine') setRefineText('')
      setHistory((h) => {
        const updated = addToHistory(h, fullPrompt, next)
        saveHistory(updated)
        return updated
      })
      if (window.location.hash) clearShareHash()
    } catch (e) {
      if ((e as Error).name === 'AbortError') return
      setError({ code: 'network', where })
      setStatus(result ? 'done' : 'error')
    }
  }

  function clearShareHash() {
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
  }

  async function download() {
    if (!result) return
    try {
      const name = projectName.trim() || result.title
      // JSZip is only needed here, so it is loaded on the first download.
      const { createLlsp3 } = await import('@/lib/spike/llsp3')
      const blob = await createLlsp3(
        name,
        result.format === 'blocks' ? { format: 'blocks', program: result.program, robot: result.robot } : { format: 'python', code: result.code },
      )
      saveFile(blob, `${fileSafe(name)}.llsp3`)
    } catch {
      setError({ code: 'file', where: 'result' })
    }
  }

  const code = result ? (result.format === 'blocks' ? result.python : result.code) : ''

  useEffect(() => {
    setMentorProgram(code || null)
    return () => setMentorProgram(null)
  }, [code])

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(code)
      showToast(t.result.copied)
    } catch {
      setError({ code: 'file', where: 'result' })
    }
  }

  function downloadPy() {
    const name = projectName.trim() || result?.title || 'RoboEasy'
    saveFile(new Blob([code], { type: 'text/x-python;charset=utf-8' }), `${fileSafe(name)}.py`)
  }

  async function share() {
    if (!result) return
    try {
      const token = await encodeShare(result)
      const url = `${window.location.origin}/${lang}/sandbox#r=${token}`
      await navigator.clipboard.writeText(url)
      showToast(t.result.shared)
    } catch {
      setError({ code: 'file', where: 'result' })
    }
  }

  function reset() {
    abortRef.current?.abort()
    setResult(null)
    setStatus('idle')
    setError(null)
    setPrompt('')
    setRefineText('')
    clearShareHash()
    textareaRef.current?.focus()
  }

  const errorText = error ? fill(t.errors[error.code], { max: PROMPT_MAX, s: error.retryAfter ?? 30 }) : ''
  const loadingSteps = pendingFormat === 'blocks' ? t.loadingBlocks : t.loadingPython
  const promptOver = prompt.length > PROMPT_MAX
  const examples = format === 'python-free' ? t.examplesPython : t.examplesBlocks
  const robotSummary = fill(t.robot.summary, {
    L: robot.leftMotor,
    R: robot.rightMotor,
    D: robot.distanceSensor,
    C: robot.colorSensor,
    F: robot.forceSensor,
  })

  const portSelect = (key: 'leftMotor' | 'rightMotor' | 'distanceSensor' | 'colorSensor' | 'forceSensor', label: string) => (
    <label>
      {label}
      <select className="select" value={robot[key]} onChange={(e) => updateRobot({ [key]: e.target.value as Port })}>
        {PORTS.map((p) => (
          <option key={p} value={p}>
            {p}
          </option>
        ))}
      </select>
    </label>
  )

  return (
    <div className="container studio">
      {/* ── Composer ── */}
      <div className="studio-col">
        <section className="card panel" aria-labelledby="composer-title">
          <div className="studio-head">
            <h1 id="composer-title" className="panel-title">
              {t.composerTitle}
            </h1>
            {aiReady !== null && (
              <span className="ai-pill" data-state={aiReady ? 'on' : 'off'}>
                <i aria-hidden="true" />
                {aiReady ? t.aiOnline : t.aiOffline}
              </span>
            )}
          </div>

          <div className="segmented" role="group" aria-label={t.formatLabel}>
            <button type="button" aria-pressed={format === 'blocks'} onClick={() => chooseFormat('blocks')}>
              <strong>
                <Blocks size={17} aria-hidden="true" />
                {t.blocks}
              </strong>
              <span>{t.blocksHint}</span>
            </button>
            <button type="button" aria-pressed={format !== 'blocks'} onClick={() => chooseFormat(format === 'python-free' ? 'python-free' : 'python')}>
              <strong>
                <Code2 size={17} aria-hidden="true" />
                {t.python}
              </strong>
              <span>{t.pythonHint}</span>
            </button>
          </div>
          {format !== 'blocks' && (
            <label className="check-row">
              <input type="checkbox" checked={format === 'python-free'} onChange={(e) => chooseFormat(e.target.checked ? 'python-free' : 'python')} />
              <span>
                <strong>{t.freePython}</strong>
                <small>{t.freePythonHint}</small>
              </span>
            </label>
          )}

          <label className="field-label" htmlFor="prompt">
            {t.promptLabel}
          </label>
          <div className="textarea-wrap">
            <textarea
              id="prompt"
              ref={textareaRef}
              className="textarea"
              value={prompt}
              placeholder={t.placeholder}
              maxLength={PROMPT_MAX + 200}
              aria-describedby="prompt-meta"
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                  e.preventDefault()
                  void generate('new')
                }
              }}
            />
            <div className="textarea-meta" id="prompt-meta">
              <span>{t.shortcut}</span>
              <span data-over={promptOver}>
                {prompt.length}/{PROMPT_MAX}
              </span>
            </div>
          </div>

          <div className="idea-list" aria-label={t.ideas}>
            {examples.map((ex) => (
              <button
                key={ex}
                type="button"
                className="chip"
                onClick={() => {
                  setPrompt(ex)
                  textareaRef.current?.focus()
                }}
              >
                {ex}
              </button>
            ))}
          </div>

          <details className="robot-settings">
            <summary>
              <CircleDot size={18} aria-hidden="true" />
              <span className="summary-text">
                <strong>{t.robot.title}</strong>
                <small>{robotSummary}</small>
              </span>
              <ChevronDown size={18} className="chev" aria-hidden="true" />
            </summary>
            <div className="robot-grid">
              {portSelect('leftMotor', t.robot.left)}
              {portSelect('rightMotor', t.robot.right)}
              {portSelect('distanceSensor', t.robot.distance)}
              {portSelect('colorSensor', t.robot.color)}
              {portSelect('forceSensor', t.robot.force)}
              <label>
                {t.robot.wheel}
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={20}
                  max={200}
                  step={1}
                  value={robot.wheelDiameterMm}
                  onChange={(e) => updateRobot({ wheelDiameterMm: Number(e.target.value) })}
                />
              </label>
              <label>
                {t.robot.track}
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={40}
                  max={400}
                  step={1}
                  value={robot.trackWidthMm}
                  onChange={(e) => updateRobot({ trackWidthMm: Number(e.target.value) })}
                />
              </label>
              <label>
                {t.robot.distanceFactor}
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={2}
                  step={0.001}
                  value={robot.distanceFactor}
                  onChange={(e) => updateRobot({ distanceFactor: Number(e.target.value) })}
                />
              </label>
              <label>
                {t.robot.turnFactor}
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={2}
                  step={0.001}
                  value={robot.turnFactor}
                  onChange={(e) => updateRobot({ turnFactor: Number(e.target.value) })}
                />
              </label>
              <div className="robot-foot">
                <span>{t.robot.hint}</span>
                <button type="button" className={buttonVariants({ variant: 'ghost', size: 'sm' })} onClick={() => updateRobot(DEFAULT_ROBOT)}>
                  <RotateCcw size={15} aria-hidden="true" />
                  {t.robot.reset}
                </button>
              </div>
            </div>
          </details>

          <div className="generate-row">
            <button
              type="button"
              className={buttonVariants({ variant: 'primary', size: 'lg', block: true })}
              onClick={() => void generate('new')}
              disabled={status === 'loading'}
            >
              {status === 'loading' ? <Loader2 size={18} className="spin" aria-hidden="true" /> : <Sparkles size={18} aria-hidden="true" />}
              {status === 'loading' ? t.generating : t.generate}
            </button>
          </div>

          {error?.where === 'composer' && status !== 'loading' && (
            <p className="alert" role="alert">
              <AlertTriangle size={18} aria-hidden="true" />
              <span>{errorText}</span>
            </p>
          )}
        </section>

        <section className="card panel" aria-labelledby="history-title">
          <div className="studio-head">
            <h2 id="history-title" className="panel-title" style={{ fontSize: '1.0625rem' }}>
              <History size={18} aria-hidden="true" />
              {t.history.title}
            </h2>
            {history.length > 0 && (
              <button
                type="button"
                className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                onClick={() => {
                  setHistory([])
                  saveHistory([])
                }}
              >
                <Trash2 size={15} aria-hidden="true" />
                {t.history.clear}
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p style={{ margin: 0, color: 'var(--text-3)' }}>{t.history.empty}</p>
          ) : (
            <ul className="history-list">
              {history.map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="history-item"
                    onClick={() => {
                      openResult(item.result)
                      setLastPrompt(item.prompt)
                      if (item.result.format === 'blocks' || item.result.robot) setRobot(item.result.robot ?? DEFAULT_ROBOT)
                      resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }}
                  >
                    <span className="history-icon" aria-hidden="true">
                      {item.result.format === 'blocks' ? <Blocks size={16} /> : <Code2 size={16} />}
                    </span>
                    <span className="meta">
                      <strong>{item.result.title}</strong>
                      <small>
                        {new Date(item.createdAt).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </small>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ── Result ── */}
      <p className="sr-only" role="status" aria-live="polite">
        {status === 'loading' ? loadingSteps[loadingStep] : announce}
      </p>
      <section ref={resultRef} className="card panel result" aria-busy={status === 'loading'} aria-label={t.heading}>
        {status === 'loading' ? (
          <div className="result-empty result-loading">
            <div>
              <div className="grid w-56 gap-2" aria-hidden="true">
                <Skeleton className="h-8 w-2/3 bg-(--blk-events)/50" />
                <Skeleton className="h-8 w-5/6 bg-(--blk-move)/40" />
                <Skeleton className="ml-6 h-8 w-1/2 bg-(--blk-motor)/40" />
                <Skeleton className="h-8 w-3/4 bg-(--blk-sound)/40" />
              </div>
              <ol className="loading-steps">
                {loadingSteps.map((s, i) => (
                  <li key={s} data-state={i < loadingStep ? 'done' : i === loadingStep ? 'active' : 'todo'}>
                    {i < loadingStep ? (
                      <Check size={16} aria-hidden="true" />
                    ) : i === loadingStep ? (
                      <Loader2 size={16} className="spin" aria-hidden="true" />
                    ) : (
                      <CircleDot size={16} aria-hidden="true" />
                    )}
                    {s}
                  </li>
                ))}
              </ol>
            </div>
          </div>
        ) : result ? (
          <ResultView
            lang={lang}
            result={result}
            t={t}
            labels={labels}
            view={view}
            setView={setView}
            projectName={projectName}
            setProjectName={setProjectName}
            onDownload={download}
            onCopy={copyCode}
            onDownloadPy={downloadPy}
            onShare={share}
            onReset={reset}
            refineText={refineText}
            setRefineText={setRefineText}
            onRefine={() => void generate('refine')}
            error={error?.where === 'result' ? errorText : ''}
          />
        ) : (
          <>
            <EmptyState className="result-empty-state" icon={<Sparkles aria-hidden="true" />} title={t.empty.title} description={t.empty.text}>
              <ul className="tips">
                {t.empty.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </EmptyState>
            <RobotPanel lang={lang} className="mt-4" />
          </>
        )}
      </section>
    </div>
  )
}

function pluralForm(lang: Locale, n: number, forms: Dictionary['studio']['result']['blocksCount']) {
  const rule = new Intl.PluralRules(lang).select(n)
  return rule in forms ? forms[rule as keyof typeof forms] : forms.other
}

interface ResultViewProps {
  lang: Locale
  result: StudioResult
  t: Dictionary['studio']
  labels: Dictionary['blocks']
  view: 'blocks' | 'python'
  setView: (v: 'blocks' | 'python') => void
  projectName: string
  setProjectName: (v: string) => void
  onDownload: () => void
  onCopy: () => void
  onDownloadPy: () => void
  onShare: () => void
  onReset: () => void
  refineText: string
  setRefineText: (v: string) => void
  onRefine: () => void
  error: string
}

function ResultView(p: ResultViewProps) {
  const { result, t } = p
  const isBlocks = result.format === 'blocks'
  const program = result.program
  const hasProgram = program !== undefined
  const tab = hasProgram ? p.view : 'python'
  const code = result.format === 'blocks' ? result.python : result.code
  const tabs = (['blocks', 'python'] as const).filter(() => hasProgram)
  const ordered = isBlocks ? tabs : [...tabs].reverse()

  return (
    <div>
      <div className="result-head">
        <div style={{ minWidth: 0 }}>
          <h2>{result.title}</h2>
          {result.description && <p className="result-desc">{result.description}</p>}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
          <Badge>
            {isBlocks ? <Blocks aria-hidden="true" /> : <Code2 aria-hidden="true" />}
            {isBlocks && program
              ? `${countSteps(program.steps)} ${pluralForm(p.lang, countSteps(program.steps), t.result.blocksCount)}`
              : hasProgram
                ? t.python
                : t.freePython}
          </Badge>
          <button type="button" className={buttonVariants({ variant: 'ghost', size: 'sm' })} onClick={p.onReset}>
            <RotateCcw size={15} aria-hidden="true" />
            {t.result.newProgram}
          </button>
        </div>
      </div>

      {result.warnings.length > 0 && (
        <div className="alert alert-warn" role="note">
          <AlertTriangle size={18} aria-hidden="true" />
          <div>
            {t.result.warnings}
            <ul>
              {result.warnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {program ? (
        <Tabs value={tab} onValueChange={(v) => p.setView(v === 'python' ? 'python' : 'blocks')} className="result-tabs">
          <TabsList aria-label={t.formatLabel}>
            {ordered.map((k) => (
              <TabsTrigger key={k} value={k}>
                {k === 'blocks' ? t.result.blocksTab : t.result.pythonTab}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="blocks">
            {!isBlocks && <p className="tab-note">{t.result.blocksOfPython}</p>}
            <div className="canvas">
              <BlockStack program={program} labels={p.labels} robot={result.robot} animate />
            </div>
          </TabsContent>
          <TabsContent value="python">
            {isBlocks && <p className="tab-note">{t.result.pythonOfBlocks}</p>}
            <CodeView code={code} label="Python" />
          </TabsContent>
        </Tabs>
      ) : (
        <div style={{ marginTop: 18 }}>
          <CodeView code={code} label="Python" />
        </div>
      )}

      <RobotPanel lang={p.lang} className="mt-4">
        <SendToRobot lang={p.lang} code={code} size="md" />
      </RobotPanel>

      <div className="toolbar">
        <label className="name-field">
          {t.result.projectName}
          <input className="input" value={p.projectName} maxLength={40} onChange={(e) => p.setProjectName(e.target.value)} />
        </label>
        <button type="button" className={buttonVariants({ variant: 'primary' })} onClick={p.onDownload}>
          <FileDown size={18} aria-hidden="true" />
          {t.result.download}
        </button>
        <button type="button" className={buttonVariants()} onClick={p.onCopy}>
          <Copy size={17} aria-hidden="true" />
          {t.result.copy}
        </button>
        <button type="button" className={buttonVariants()} onClick={p.onDownloadPy}>
          <FileCode2 size={17} aria-hidden="true" />
          {t.result.downloadPy}
        </button>
        <button type="button" className={buttonVariants()} onClick={p.onShare}>
          <Link2 size={17} aria-hidden="true" />
          {t.result.share}
        </button>
      </div>

      <form
        className="refine"
        onSubmit={(e) => {
          e.preventDefault()
          p.onRefine()
        }}
      >
        <label className="field-label" htmlFor="refine">
          {t.result.refineLabel}
        </label>
        <input id="refine" className="input" value={p.refineText} placeholder={t.result.refinePlaceholder} onChange={(e) => p.setRefineText(e.target.value)} />
        <button type="submit" className={buttonVariants()}>
          <Wand2 size={17} aria-hidden="true" />
          {t.result.refine}
        </button>
      </form>
      {p.error && (
        <p className="alert" role="alert">
          <AlertTriangle size={18} aria-hidden="true" />
          <span>{p.error}</span>
        </p>
      )}

      <details className="howto">
        <summary>
          <Play size={16} aria-hidden="true" />
          {t.howTo.title}
        </summary>
        <ol>
          {t.howTo.steps.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ol>
        <p className="safety">{t.howTo.safety}</p>
      </details>
    </div>
  )
}
