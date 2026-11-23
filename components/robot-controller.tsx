'use client'

import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react'
import { Bluetooth, Gamepad2, Square, Wrench } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import type { ControllerText } from '@/lib/i18n/controller'
import { useHydrated } from '@/lib/learn/store'
import { HubError, useBluetoothAvailable } from '@/lib/spike/ble'
import {
  CENTER, DRIVE_KEYS, INITIAL_MOTORS, PORTS, ROLES, joystickAxes, keyboardAxes, motorSpeeds,
  type Axes, type Motor, type Port, type Role,
} from '@/lib/spike/controller-input'
import { connectController, type ControllerLink } from '@/lib/spike/controller-link'
import { SLOT_COUNT } from '@/lib/spike/ble-protocol'

type Status = 'idle' | 'connecting' | 'ready' | 'lost' | 'closing'
type Problem = 'cancelled' | 'denied' | 'failed' | 'unsupported' | 'busy'
type Hold = { role: Role; direction: 1 | -1 }
const AUX_ROLES = ['gripper', 'lift', 'extra1', 'extra2'] as const
const editControl = 'input, select, textarea, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="combobox"]'
const fieldStyle = 'min-h-11 min-w-0 rounded-(--radius-sm) border-(length:--stroke-thin) border-outline bg-background px-2.5 font-bold text-foreground'
const sectionTitle = 'flex items-center gap-2 font-display text-xl font-extrabold'

function connectionProblem(error: unknown): Problem {
  if (error instanceof HubError && (error.message === 'unsupported' || error.message === 'busy')) return error.message
  if (error instanceof Error) {
    if (error.name === 'NotFoundError') return 'cancelled'
    if (['SecurityError', 'NotAllowedError'].includes(error.name)) return 'denied'
  }
  return 'failed'
}

export function RobotController({ t }: { t: ControllerText }) {
  const hydrated = useHydrated()
  const available = useBluetoothAvailable()
  const [status, setStatus] = useState<Status>('idle')
  const [problem, setProblem] = useState<Problem | null>(null)
  const [hub, setHub] = useState({ name: '', firmware: '' })
  const [slot, setSlot] = useState('')
  const [detected, setDetected] = useState<Port[]>([])
  const [motors, setMotors] = useState(INITIAL_MOTORS)
  const [position, setPosition] = useState<Axes>(CENTER)
  const [pressed, setPressed] = useState<Hold[]>([])

  const currentMotors = useRef(motors)
  const link = useRef<ControllerLink | null>(null)
  const attempt = useRef<AbortController | null>(null)
  const keys = useRef(new Set<string>())
  const joystick = useRef<{ id: number; axes: Axes } | null>(null)
  const holds = useRef(new Map<number | string, Hold>())
  const driveReady = !!motors.left.port && !!motors.right.port
  const canInput = useRef(false)

  const update = useCallback(() => {
    if (!canInput.current) return
    const axes = joystick.current?.axes ?? keyboardAxes(keys.current)
    link.current?.update(motorSpeeds(currentMotors.current, axes, holds.current.values()))
  }, [])

  const reset = useCallback((render = true, sendStop = true) => {
    keys.current.clear()
    joystick.current = null
    holds.current.clear()
    if (render) {
      setPosition(CENTER)
      setPressed([])
    }
    if (sendStop) void link.current?.stop()
  }, [])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (!canInput.current || joystick.current || !DRIVE_KEYS.includes(event.code) || event.ctrlKey || event.metaKey || event.altKey) return
      if (event.target instanceof Element && event.target.closest(editControl)) return
      const { left, right } = currentMotors.current
      if (!left.port || !right.port) return
      event.preventDefault()
      if (event.repeat || keys.current.has(event.code)) return
      keys.current.add(event.code)
      update()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (keys.current.delete(event.code)) update()
    }
    const focusIn = (event: FocusEvent) => {
      if (keys.current.size && event.target instanceof Element && event.target.closest(editControl)) {
        keys.current.clear()
        update()
      }
    }
    const stop = () => reset()
    const visibility = () => { if (document.hidden) stop() }
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
    setHub({ name: '', firmware: '' })
    setDetected([])
    setStatus('connecting')
    try {
      const result = await connectController(Number(slot), {
        onDevices: (ports) => {
          if (!pending.signal.aborted) setDetected((last) => last.join() === ports.join() ? last : ports)
        },
        onLost: () => {
          if (pending.signal.aborted) return
          link.current = null
          canInput.current = false
          reset()
          setDetected([])
          setStatus('lost')
        },
      }, pending.signal)
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
        setStatus('idle')
      }
    } finally {
      if (attempt.current === pending) attempt.current = null
    }
  }

  async function disconnect() {
    const connection = link.current
    if (!connection || !canInput.current) return
    canInput.current = false
    reset(true, false)
    setStatus('closing')
    await connection.disconnect()
    if (link.current !== connection) return
    link.current = null
    setHub({ name: '', firmware: '' })
    setDetected([])
    setStatus('idle')
  }

  function assign(role: Role, change: Partial<Motor>) {
    if (!canInput.current) return
    const previous = currentMotors.current
    if (change.port && ROLES.some((other) => role !== other && previous[other].port === change.port)) return
    reset()
    const next = { ...previous, [role]: { ...previous[role], ...change } }
    currentMotors.current = next
    setMotors(next)
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
    if (motor) holds.current.set(id, motor)
    else if (!holds.current.delete(id)) return
    setPressed([...holds.current.values()])
    update()
  }

  const ready = status === 'ready'
  const connected = ready || status === 'closing'
  const aux = AUX_ROLES.filter((role) => !!motors[role].port)

  return (
    <div className="container mx-auto max-w-5xl space-y-5 py-6 pb-24 sm:py-10 sm:pb-24">
      <div className="space-y-2">
        <h1 className="font-display text-3xl font-extrabold sm:text-5xl">{t.title}</h1>
        <p className="text-muted-foreground">{t.intro}</p>
      </div>

      <Card className="gap-4 p-4 sm:p-6" aria-labelledby="hub-heading">
        <h2 id="hub-heading" className={sectionTitle}><Bluetooth className="size-5" aria-hidden="true" />{t.connection}</h2>
        {!connected && (
          <div className="grid items-center gap-2 sm:grid-cols-[auto_1fr] sm:gap-4">
            <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
              {t.slot}
              <select className={fieldStyle} value={slot} disabled={!available || status === 'connecting'} aria-describedby="controller-slot-note" onChange={(event) => setSlot(event.target.value)}>
                <option value="">—</option>
                {Array.from({ length: SLOT_COUNT }, (_, index) => <option key={index} value={index}>{index}</option>)}
              </select>
            </label>
            <p id="controller-slot-note" className="text-sm text-muted-foreground">{t.slotNote}</p>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {connected ? (
            <Button onClick={() => void disconnect()} disabled={!ready}>{t.disconnect}</Button>
          ) : (
            <Button variant="primary" onClick={() => void connect()} disabled={!available || !slot || status === 'connecting'} aria-describedby="controller-slot-note">
              {t.connect}
            </Button>
          )}
          <p role="status" className="min-w-0 break-words text-sm font-bold">
            {t[status]}{hub.name && ` · ${hub.name} · ${t.firmware} ${hub.firmware}`}
          </p>
        </div>
        {hydrated && !available && <p className="text-sm text-muted-foreground">{t.browser}</p>}
        {problem && <p role="alert" className="text-sm text-foreground">{t[problem]}</p>}
      </Card>

      {connected && (
        <>
          <Card className="gap-3 p-4 sm:p-6" aria-labelledby="motor-heading">
            <h2 id="motor-heading" className={sectionTitle}><Wrench className="size-5" aria-hidden="true" />{t.settings}</h2>
            <p className="text-sm text-muted-foreground">{detected.length ? `${t.found} ${detected.join(', ')}.` : t.manual}</p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3">
              {ROLES.map((role) => (
                <div key={role} className="min-w-0 space-y-1.5 text-sm font-bold">
                  <label className="grid gap-1">
                    {t.roles[role]}
                    <select className={fieldStyle} value={motors[role].port} disabled={!ready} onChange={(event) => assign(role, { port: event.target.value as Motor['port'] })}>
                      <option value="">{t.none}</option>
                      {PORTS.map((port) => <option key={port} value={port} disabled={ROLES.some((other) => other !== role && motors[other].port === port)}>{port}</option>)}
                    </select>
                  </label>
                  <label className="flex min-h-9 items-center gap-2">
                    <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={motors[role].reversed}
                      aria-label={`${t.reverse} · ${t.roles[role]}`} disabled={!ready || !motors[role].port} onChange={(event) => assign(role, { reversed: event.target.checked })} />
                    {t.reverse}
                  </label>
                </div>
              ))}
            </div>
          </Card>

          <Card className="gap-3 p-4 sm:p-6" aria-labelledby="drive-heading">
            <h2 id="drive-heading" className={sectionTitle}><Gamepad2 className="size-5" aria-hidden="true" />{t.use}</h2>
            {!driveReady && <p className="text-sm text-muted-foreground">{t.setupDrive}</p>}
            <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-start gap-3 sm:gap-6">
              <div className="sticky top-[calc(var(--header-h)+1rem)] grid justify-items-center gap-2">
                <div
                  role="img" aria-label={t.joystick} aria-disabled={!ready || !driveReady}
                  className="relative aspect-square w-full max-w-44 touch-none select-none rounded-full border-(length:--stroke) border-outline bg-surface-2 aria-disabled:opacity-50"
                  onPointerDown={startJoystick} onPointerMove={moveJoystick} onPointerUp={releaseJoystick}
                  onPointerCancel={releaseJoystick} onLostPointerCapture={releaseJoystick} onContextMenu={(event) => event.preventDefault()}
                >
                  <div aria-hidden="true" className="pointer-events-none absolute inset-[14%] rounded-full border border-dashed border-outline opacity-45" />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute top-1/2 left-1/2 size-[29%] rounded-full border-(length:--stroke) border-outline bg-primary shadow-(--shadow-hard-sm)"
                    style={{ left: `${50 + 34 * position.x}%`, top: `${50 - 34 * position.y}%`, transform: 'translate(-50%, -50%)' }}
                  />
                </div>
                <p className="hidden text-center text-sm font-bold [@media(pointer:fine)]:block">{t.keys}</p>
              </div>
              {aux.length > 0 && (
                <div className="min-w-0 space-y-2">
                  <p className="text-sm text-muted-foreground">{t.hold}</p>
                  <div className="grid gap-3 md:grid-cols-2">
                    {aux.map((role) => (
                      <fieldset key={role} className="min-w-0 space-y-1.5">
                        <legend className="text-sm font-bold">{t.roles[role]} · {motors[role].port}</legend>
                        <div className="grid gap-1.5 sm:grid-cols-2">
                          {([1, -1] as const).map((direction) => {
                            const key = `${role}:${direction}`
                            const active = pressed.some((value) => value.role === role && value.direction === direction)
                            return (
                              <Button
                                key={direction} size="sm" variant={active ? 'primary' : 'secondary'} disabled={!ready}
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
            </div>
          </Card>

          <Button variant="danger" size="lg" onClick={() => reset()}
            className="fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] left-4 z-50 bg-danger-bg md:bottom-6 md:left-6">
            <Square aria-hidden="true" fill="currentColor" />{t.stop}
          </Button>
        </>
      )}
    </div>
  )
}
