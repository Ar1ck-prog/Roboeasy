'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Bluetooth, Check, Gamepad2, Square, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ControllerText } from '@/lib/i18n/controller'
import { useHydrated } from '@/lib/learn/store'
import { HubConnectionError, HubError, useBluetoothAvailable } from '@/lib/spike/ble'
import {
  CENTER,
  DEFAULT_DRIVE_LIMITS,
  DRIVE_KEYS,
  INITIAL_MOTORS,
  PORTS,
  ROLES,
  STOPPED,
  joystickAxes,
  keyboardAxes,
  motorSpeeds,
  type Axes,
  type DriveLimits,
  type Motor,
  type Port,
  type Role,
  type Speeds,
} from '@/lib/spike/controller-input'
import { connectController, type ControllerLink } from '@/lib/spike/controller-link'
import { SLOT_COUNT } from '@/lib/spike/ble-protocol'
import { cn } from '@/lib/utils'

type Status = 'idle' | 'connecting' | 'ready' | 'recovering' | 'lost' | 'closing'
type Problem = 'cancelled' | 'denied' | 'failed' | 'unsupported' | 'busy' | 'motorError' | 'commandDelay' | HubConnectionError['stage']
type Hold = { role: Role; direction: 1 | -1 }
function motorAvailable(port: Motor['port'], ports: readonly Port[] | null) {
  return !!port && !!ports?.includes(port)
}
const AUX_ROLES = ['gripper', 'lift', 'extra1', 'extra2'] as const
const editControl = 'input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]'
const fieldStyle = 'min-h-11 min-w-0 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-background px-2.5 font-bold text-foreground'
const sectionTitle = 'flex items-center gap-2 font-display text-xl font-extrabold'

function connectionProblem(error: unknown): Problem {
  if (error instanceof HubConnectionError) {
    const cause = error.cause
    if (error.stage === 'select' && cause instanceof Error) {
      if (cause.name === 'NotFoundError' && /cancel/i.test(cause.message)) return 'cancelled'
      if (['SecurityError', 'NotAllowedError'].includes(cause.name) || /permission|policy|blocked/i.test(cause.message)) return 'denied'
    }
    return error.stage
  }
  if (error instanceof HubError && (error.message === 'unsupported' || error.message === 'busy')) return error.message
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return 'cancelled'
    if (['SecurityError', 'NotAllowedError'].includes(error.name)) return 'denied'
  }
  return 'failed'
}

function SpeedField({ label, value, disabled, onCommit }: {
  label: string
  value: number
  disabled: boolean
  onCommit: (speed: number) => void
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <label className="grid min-w-0 gap-1 self-start text-sm font-bold">
      {label}
      <span className="flex items-center gap-2">
        <input type="number" min={0} max={100} step={1} inputMode="numeric"
          className={`${fieldStyle} w-full tabular-nums`} value={draft ?? value} disabled={disabled} aria-describedby="drive-speed-hint"
          onChange={(event) => setDraft(event.currentTarget.value)}
          onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
          onBlur={() => {
            const parsed = Number(draft)
            if (draft?.trim() && Number.isFinite(parsed)) onCommit(Math.min(100, Math.max(0, Math.round(parsed))))
            setDraft(null)
          }} />
        <span aria-hidden="true">%</span>
      </span>
    </label>
  )
}

export function RobotController({ t }: { t: ControllerText }) {
  const hydrated = useHydrated()
  const available = useBluetoothAvailable()
  const [status, setStatus] = useState<Status>('idle')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [diagnostic, setDiagnostic] = useState('')
  const [hub, setHub] = useState({ name: '', firmware: '' })
  const [slot, setSlot] = useState('')
  const [detected, setDetected] = useState<Port[] | null>(null)
  const [motors, setMotors] = useState(INITIAL_MOTORS)
  const [limits, setLimits] = useState(DEFAULT_DRIVE_LIMITS)
  const [position, setPosition] = useState<Axes>(CENTER)
  const [pressed, setPressed] = useState<Hold[]>([])
  // Only for display: what the hub is told right now (per port) and which drive keys are held.
  const [output, setOutput] = useState<Speeds>(STOPPED)
  const [keysHeld, setKeysHeld] = useState<string[]>([])

  const currentMotors = useRef(motors)
  const currentLimits = useRef(limits)
  const detectedRef = useRef<Port[] | null>(null)
  const link = useRef<ControllerLink | null>(null)
  const attempt = useRef<AbortController | null>(null)
  const keys = useRef(new Set<string>())
  const joystick = useRef<{ id: number; axes: Axes } | null>(null)
  const holds = useRef(new Map<number | string, Hold>())
  const driveReady = motorAvailable(motors.left.port, detected) && motorAvailable(motors.right.port, detected)
  const canInput = useRef(false)

  const update = useCallback(() => {
    if (!canInput.current) return
    const motors = currentMotors.current
    const ports = detectedRef.current
    const canDrive = motorAvailable(motors.left.port, ports) && motorAvailable(motors.right.port, ports)
    const axes = canDrive ? (joystick.current?.axes ?? keyboardAxes(keys.current)) : CENTER
    const active = [...holds.current.values()].filter(({ role }) => motorAvailable(motors[role].port, ports))
    const speeds = motorSpeeds(motors, axes, currentLimits.current, active)
    link.current?.update(speeds)
    setOutput(speeds)
  }, [])

  const reset = useCallback((render = true, sendStop = true) => {
    keys.current.clear()
    joystick.current = null
    holds.current.clear()
    if (render) {
      setPosition(CENTER)
      setPressed([])
      setOutput(STOPPED)
      setKeysHeld([])
    }
    if (sendStop) void link.current?.stop()
  }, [])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!canInput.current || joystick.current || !DRIVE_KEYS.includes(event.code) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest(editControl)) return
      const { left, right } = currentMotors.current
      if (!motorAvailable(left.port, detectedRef.current) || !motorAvailable(right.port, detectedRef.current)) return
      event.preventDefault()
      if (event.repeat || keys.current.has(event.code)) return
      keys.current.add(event.code)
      setKeysHeld([...keys.current])
      update()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (!keys.current.delete(event.code)) return
      setKeysHeld([...keys.current])
      update()
    }
    const focusIn = (event: FocusEvent) => {
      if (keys.current.size && event.target instanceof Element && event.target.closest(editControl)) {
        keys.current.clear()
        setKeysHeld([])
        update()
      }
    }
    const stop = () => reset()
    const visibility = () => {
      if (document.hidden) stop()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('blur', stop)
    window.addEventListener('pagehide', stop)
    document.addEventListener('visibilitychange', visibility)
    document.addEventListener('focusin', focusIn)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('blur', stop)
      window.removeEventListener('pagehide', stop)
      document.removeEventListener('visibilitychange', visibility)
      document.removeEventListener('focusin', focusIn)
      canInput.current = false
      attempt.current?.abort()
      const connection = link.current
      link.current = null
      reset(false, false)
      void connection?.disconnect()
    }
  }, [reset, update])

  async function connect() {
    if (!available || !slot || attempt.current || link.current) return
    const pending = new AbortController()
    attempt.current = pending
    setProblem(null)
    setDiagnostic('')
    setHub({ name: '', firmware: '' })
    detectedRef.current = null
    setDetected(null)
    setStatus('connecting')
    try {
      const result = await connectController(
        Number(slot),
        {
          onDevices: (ports) => {
            if (pending.signal.aborted || detectedRef.current?.join() === ports.join()) return
            const previous = detectedRef.current
            detectedRef.current = ports
            if (
              canInput.current &&
              ROLES.some((role) => {
                const port = currentMotors.current[role].port
                return motorAvailable(port, previous) && !motorAvailable(port, ports)
              })
            )
              reset()
            setDetected(ports)
          },
          onLost: (reason) => {
            if (pending.signal.aborted) return
            link.current = null
            canInput.current = false
            reset()
            detectedRef.current = null
            setDetected(null)
            if (reason) setDiagnostic((current) => (current ? `${reason} · ${current}` : reason))
            setStatus('lost')
          },
          onPaused: (issue, detail) => {
            canInput.current = false
            reset(true, false)
            setProblem(issue)
            setDiagnostic(detail)
            setStatus('recovering')
          },
          onResumed: () => {
            canInput.current = true
            setStatus('ready')
          },
        },
        pending.signal,
      )
      if (pending.signal.aborted) {
        result.link.close()
        return
      }
      link.current = result.link
      canInput.current = true
      setHub({ name: result.name, firmware: result.firmware })
      setStatus('ready')
    } catch (error) {
      if (!pending.signal.aborted) {
        setProblem(connectionProblem(error))
        if (error instanceof HubConnectionError) setDiagnostic(error.diagnostic)
        setStatus('idle')
      }
    } finally {
      if (attempt.current === pending) attempt.current = null
    }
  }

  async function disconnect() {
    const connection = link.current
    if (!connection || status === 'closing') return
    canInput.current = false
    reset(true, false)
    setStatus('closing')
    await connection.disconnect()
    if (link.current !== connection) return
    link.current = null
    setHub({ name: '', firmware: '' })
    detectedRef.current = null
    setDetected(null)
    setStatus('idle')
  }

  function assign(role: Role, change: Partial<Motor>) {
    if (attempt.current || (link.current && !canInput.current)) return
    const previous = currentMotors.current
    if (change.port && detectedRef.current && !motorAvailable(change.port, detectedRef.current)) return
    if (change.port && ROLES.some((other) => role !== other && previous[other].port === change.port)) return
    if (canInput.current) {
      reset()
      setProblem(null)
      setDiagnostic('')
    }
    const next = { ...previous, [role]: { ...previous[role], ...change } }
    currentMotors.current = next
    setMotors(next)
  }

  function changeSpeed(kind: keyof DriveLimits, speed: number) {
    const previous = currentLimits.current
    if (attempt.current || (link.current && !canInput.current) || previous[kind] === speed) return
    if (canInput.current) reset()
    const next = { ...previous, [kind]: speed }
    currentLimits.current = next
    setLimits(next)
  }

  function moveJoystick(event: PointerEvent<HTMLDivElement>) {
    if (joystick.current?.id !== event.pointerId) return
    const { x, y, width, height } = event.currentTarget.getBoundingClientRect()
    const reach = Math.min(width, height) * 0.35
    const axes = joystickAxes((event.clientX - x - width / 2) / reach, (y + height / 2 - event.clientY) / reach)
    joystick.current.axes = axes.drive
    setPosition(axes.position)
    update()
  }

  function startJoystick(event: PointerEvent<HTMLDivElement>) {
    if (event.button !== 0 || !canInput.current || !driveReady || joystick.current) return
    event.currentTarget.setPointerCapture(event.pointerId)
    keys.current.clear()
    setKeysHeld([])
    joystick.current = { id: event.pointerId, axes: CENTER }
    moveJoystick(event)
  }

  function releaseJoystick(event: PointerEvent<HTMLDivElement>) {
    if (joystick.current?.id !== event.pointerId) return
    joystick.current = null
    setPosition(CENTER)
    update()
  }

  function hold(id: number | string, motor?: Hold) {
    if (!canInput.current) return
    if (motor && !motorAvailable(currentMotors.current[motor.role].port, detectedRef.current)) return
    if (motor) holds.current.set(id, motor)
    else if (!holds.current.delete(id)) return
    setPressed([...holds.current.values()])
    update()
  }

  const ready = status === 'ready'
  const connected = ready || status === 'recovering' || status === 'closing'
  const setupLocked = !hydrated || status === 'connecting' || status === 'recovering' || status === 'closing'
  const aux = AUX_ROLES.filter((role) => !!motors[role].port)
  const motorSummary = detected === null ? (connected ? t.checkingMotors : t.manual) : detected.length ? `${t.found} ${detected.join(', ')}.` : t.noMotors

  // 1 connect, 2 assign the drive motors, 3 drive.
  const step = !connected ? 0 : driveReady ? 2 : 1
  const roleOf = (port: Port) => ROLES.find((role) => motors[role].port === port)
  const keycap = (code: string, label: string) => (
    <kbd
      className={cn(
        'grid size-9 place-items-center rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-card font-display text-sm font-extrabold shadow-(--shadow-press) transition-colors',
        keysHeld.includes(code) && 'translate-y-0.5 bg-primary text-primary-foreground shadow-none',
      )}
    >
      {label}
    </kbd>
  )

  function motorField(role: Role) {
    const assignedPort = motors[role].port
    const missing = !!assignedPort && detected !== null && !motorAvailable(assignedPort, detected)
    return (
      <div key={role} className="min-w-0 space-y-1.5 text-sm font-bold">
        <label className="grid gap-1">
          {t.roles[role]}
          <select className={fieldStyle} value={assignedPort} disabled={setupLocked} aria-invalid={missing}
            aria-describedby={missing ? `motor-missing-${role}` : undefined} onChange={(event) => assign(role, { port: event.target.value as Motor['port'] })}>
            <option value="">{t.none}</option>
            {PORTS.map((port) => <option key={port} value={port} disabled={(detected !== null && !detected.includes(port)) || ROLES.some((other) => other !== role && motors[other].port === port)}>{port}</option>)}
          </select>
        </label>
        {missing && <p id={`motor-missing-${role}`} className="font-medium text-destructive">{t.missingMotor.replace('{port}', assignedPort)}</p>}
        <label className="flex min-h-9 items-center gap-2">
          <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={motors[role].reversed}
            aria-label={`${t.reverse} · ${t.roles[role]}`} disabled={setupLocked || !assignedPort} onChange={(event) => assign(role, { reversed: event.target.checked })} />
          {t.reverse}
        </label>
      </div>
    )
  }

  const settingsCard = (
    <Card className="gap-3 p-4 sm:p-6" aria-labelledby="motor-heading">
      <h2 id="motor-heading" className={sectionTitle}>
        <Wrench className="size-5" aria-hidden="true" />
        {t.settings}
      </h2>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {motorSummary}
      </p>
      <div className={cn('grid grid-cols-2 gap-x-3 gap-y-3 md:grid-cols-4', connected && 'lg:grid-cols-2')}>
        {motorField('left')}
        {motorField('right')}
        <SpeedField label={t.driveSpeed} value={limits.drive} disabled={setupLocked} onCommit={(value) => changeSpeed('drive', value)} />
        <SpeedField label={t.turnSpeed} value={limits.turn} disabled={setupLocked} onCommit={(value) => changeSpeed('turn', value)} />
      </div>
      <p id="drive-speed-hint" className="text-sm text-muted-foreground">{t.speedHint}</p>
      <details className="border-t border-outline/20">
        <summary className="min-h-11 cursor-pointer rounded py-2.5 font-bold">{t.attachments}</summary>
        <p className="mb-3 text-sm text-muted-foreground">{t.attachmentsHint}</p>
        <div className={cn('grid grid-cols-2 gap-x-3 gap-y-4 md:grid-cols-4', connected && 'lg:grid-cols-2')}>{AUX_ROLES.map(motorField)}</div>
      </details>
    </Card>
  )

  const connectionCard = (
    <Card className="gap-4 p-4 sm:p-6" aria-labelledby="hub-heading">
      <h2 id="hub-heading" className={sectionTitle}>
        <Bluetooth className="size-5" aria-hidden="true" />
        {t.connection}
      </h2>
      {!connected && (
        <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr] sm:gap-4">
          <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
            {t.slot}
            <select
              className={fieldStyle}
              value={slot}
              disabled={!available || status === 'connecting'}
              aria-describedby="controller-slot-note"
              onChange={(event) => setSlot(event.target.value)}
            >
              <option value="">—</option>
              {Array.from({ length: SLOT_COUNT }, (_, index) => (
                <option key={index} value={index}>
                  {index}
                </option>
              ))}
            </select>
          </label>
          <p id="controller-slot-note" className="text-sm text-muted-foreground">
            {t.slotNote}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        {connected ? (
          <Button onClick={() => void disconnect()} disabled={status === 'closing'}>
            {t.disconnect}
          </Button>
        ) : (
          <Button
            variant="primary"
            onClick={() => void connect()}
            disabled={!available || !slot || status === 'connecting'}
            aria-describedby="controller-slot-note"
          >
            {t.connect}
          </Button>
        )}
        <p role="status" className="flex min-w-0 items-center gap-2 break-words text-sm font-bold">
          <span
            aria-hidden="true"
            className={cn(
              'size-2.5 shrink-0 rounded-full',
              ready ? 'bg-success' : status === 'lost' ? 'bg-destructive' : connected || status === 'connecting' ? 'animate-pulse bg-primary' : 'bg-outline/30',
            )}
          />
          {t[status]}
          {hub.name && ` · ${hub.name} · ${t.firmware} ${hub.firmware}`}
        </p>
      </div>
      {hydrated && !available && <p className="text-sm text-muted-foreground">{t.browser}</p>}
      {(problem || diagnostic) && (
        <div role="alert" className="space-y-2 rounded-(--radius-sm) bg-danger-bg p-3 text-sm text-foreground">
          {problem && <p>{t[problem]}</p>}
          {diagnostic && <pre className="whitespace-pre-wrap break-words text-xs">{diagnostic}</pre>}
        </div>
      )}
    </Card>
  )

  return (
    <div className="container mx-auto max-w-5xl space-y-5 py-6 pb-24 sm:py-10 sm:pb-24">
      <div className="space-y-3">
        <h1 className="font-display text-3xl font-extrabold sm:text-5xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
        {/* On a phone the done and later steps shrink to their number: only the current one is spelled out. */}
        <ol className="m-0 flex list-none gap-2 p-0 sm:grid sm:grid-cols-3">
          {t.steps.map((text, i) => (
            <li
              key={i}
              aria-current={i === step ? 'step' : undefined}
              className={cn(
                'flex min-w-0 items-center gap-2.5 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline px-3 py-2 text-sm font-bold',
                i === step ? 'flex-1' : 'max-sm:flex-none max-sm:px-2',
                i < step ? 'bg-(--ok-bg) text-success' : i === step ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground',
              )}
            >
              <span
                aria-hidden="true"
                className="grid size-6 shrink-0 place-items-center rounded-full border-(length:--stroke-thin) border-outline bg-card font-display text-xs text-foreground"
              >
                {i < step ? <Check className="size-3.5" /> : i + 1}
              </span>
              <span className={cn(i !== step && 'max-sm:sr-only')}>{text}</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Once connected the controls come first: on a phone the joystick is right under the steps,
          on a wide screen they stay in view (sticky) next to the settings. */}
      <div className={cn('grid gap-5', connected && 'lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:items-start')}>
        {connected && (
          <Card className="gap-4 p-4 sm:p-6 lg:sticky lg:top-[calc(var(--header-h)+1rem)]" aria-labelledby="drive-heading" tabIndex={0}>
            <h2 id="drive-heading" className={sectionTitle}>
              <Gamepad2 className="size-5" aria-hidden="true" />
              {t.use}
            </h2>
            {!driveReady && <p className="text-sm text-muted-foreground">{t.setupDrive}</p>}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 sm:gap-6">
              <div className="grid justify-items-center gap-3">
                <div
                  role="img"
                  aria-label={t.joystick}
                  aria-disabled={!ready || !driveReady}
                  className="relative aspect-square w-full max-w-52 touch-none select-none rounded-full border-(length:--stroke) border-outline bg-[radial-gradient(circle,var(--card)_0%,var(--surface-2)_72%)] shadow-(--shadow-hard-sm) aria-disabled:opacity-50"
                  onPointerDown={startJoystick}
                  onPointerMove={moveJoystick}
                  onPointerUp={releaseJoystick}
                  onPointerCancel={releaseJoystick}
                  onLostPointerCapture={releaseJoystick}
                  onContextMenu={(event) => event.preventDefault()}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-[14%] rounded-full border border-dashed border-outline opacity-45" />
                  <ArrowUp aria-hidden="true" className="pointer-events-none absolute top-[3%] left-1/2 size-4 -translate-x-1/2 opacity-50" />
                  <ArrowDown aria-hidden="true" className="pointer-events-none absolute bottom-[3%] left-1/2 size-4 -translate-x-1/2 opacity-50" />
                  <ArrowLeft aria-hidden="true" className="pointer-events-none absolute top-1/2 left-[3%] size-4 -translate-y-1/2 opacity-50" />
                  <ArrowRight aria-hidden="true" className="pointer-events-none absolute top-1/2 right-[3%] size-4 -translate-y-1/2 opacity-50" />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-1/2 size-[29%] rounded-full border-(length:--stroke) border-outline bg-primary shadow-(--shadow-hard-sm)"
                    style={{ left: `${50 + 34 * position.x}%`, top: `${50 - 34 * position.y}%`, transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <div aria-hidden="true" className="hidden justify-items-center gap-1 [@media(pointer:fine)]:grid">
                  {keycap('KeyW', 'W')}
                  <div className="flex gap-1">
                    {keycap('KeyA', 'A')}
                    {keycap('KeyS', 'S')}
                    {keycap('KeyD', 'D')}
                  </div>
                </div>
                <p className="hidden text-center text-sm font-bold [@media(pointer:fine)]:block">{t.keys.replace('{drive}', String(limits.drive)).replace('{turn}', String(limits.turn))}</p>
              </div>
              <div className="min-w-0 space-y-4">
                {aux.length > 0 && (
                  <div className="min-w-0 space-y-2">
                    <p className="text-sm text-muted-foreground">{t.hold}</p>
                    <div className="grid gap-3">
                      {aux.map((role) => (
                        <fieldset key={role} className="min-w-0 space-y-1.5">
                          <legend className="text-sm font-bold">
                            {t.roles[role]} · {motors[role].port}
                          </legend>
                          <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-2">
                            {([1, -1] as const).map((direction) => {
                              const key = `${role}:${direction}`
                              const active = pressed.some((value) => value.role === role && value.direction === direction)
                              return (
                                <Button
                                  key={direction}
                                  size="sm"
                                  variant={active ? 'primary' : 'secondary'}
                                  disabled={!ready || !motorAvailable(motors[role].port, detected)}
                                  className="min-h-11 min-w-0 touch-none whitespace-normal px-2 text-sm"
                                  onPointerDown={(event) => {
                                    if (event.button !== 0) return
                                    event.currentTarget.setPointerCapture(event.pointerId)
                                    hold(event.pointerId, { role, direction })
                                  }}
                                  onPointerUp={(event) => hold(event.pointerId)}
                                  onPointerCancel={(event) => hold(event.pointerId)}
                                  onLostPointerCapture={(event) => hold(event.pointerId)}
                                  onContextMenu={(event) => event.preventDefault()}
                                  onKeyDown={(event) => {
                                    if (event.key !== ' ' && event.key !== 'Enter') return
                                    event.preventDefault()
                                    if (!event.repeat) hold(key, { role, direction })
                                  }}
                                  onKeyUp={(event) => {
                                    if (event.key === ' ' || event.key === 'Enter') hold(key)
                                  }}
                                  onBlur={() => hold(key)}
                                >
                                  {direction === 1 ? t.positive[role] : t.negative[role]}
                                </Button>
                              )
                            })}
                          </div>
                        </fieldset>
                      ))}
                    </div>
                  </div>
                )}
                {/* What every port is told right now: shows that a key or the stick really reaches the robot. */}
                <div className="space-y-1.5" aria-hidden="true">
                  <p className="text-sm font-bold">{t.output}</p>
                  <ul className="m-0 grid list-none gap-1 p-0">
                    {PORTS.map((port, i) => {
                      const role = roleOf(port)
                      const value = output[i] ?? 0
                      return (
                        <li
                          key={port}
                          className={cn('grid grid-cols-[1.25rem_minmax(0,1fr)_3rem] items-center gap-2 text-xs font-bold', !role && 'opacity-45')}
                        >
                          <span className="font-display">{port}</span>
                          <span className="relative h-3 overflow-hidden rounded-full border-(length:--stroke-thin) border-outline bg-surface-2">
                            <span className="absolute inset-y-0 left-1/2 w-px bg-outline/40" />
                            <span
                              className={cn(
                                'absolute inset-y-0 transition-[width,left] duration-100 motion-reduce:transition-none',
                                value >= 0 ? 'bg-success' : 'bg-destructive',
                              )}
                              style={{ left: value >= 0 ? '50%' : `${50 + value / 2}%`, width: `${Math.abs(value) / 2}%` }}
                            />
                          </span>
                          <span className="truncate text-right font-mono">{role ? `${value > 0 ? '+' : ''}${value}%` : t.free}</span>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              </div>
            </div>
          </Card>
        )}
        <div className="grid min-w-0 gap-5">
          {connectionCard}
          {settingsCard}
        </div>
      </div>

      {connected && (
        <Button
          variant="danger"
          size="lg"
          onClick={() => reset()}
          className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-50 bg-danger-bg md:bottom-6 md:left-6"
        >
          <Square aria-hidden="true" fill="currentColor" />
          {t.stop}
        </Button>
      )}
    </div>
  )
}
