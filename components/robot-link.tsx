'use client'

import { Bluetooth, BluetoothOff, Loader2, Play, Square, Unplug } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { type Locale, fill } from '@/lib/i18n/config'
import { type RobotLinkText, getRobotLinkText } from '@/lib/i18n/robot-link'
import { connectHub, disconnectHub, runOnHub, setHubSlot, stopHub, useBluetoothAvailable, useHub } from '@/lib/spike/ble'
import { type DeviceUpdate, SLOT_COUNT } from '@/lib/spike/ble-protocol'
import { cn } from '@/lib/utils'

function deviceText(d: DeviceUpdate, t: RobotLinkText): string {
  if (d.kind === 'motor') return fill(t.motor, { port: d.port, v: d.position })
  if (d.kind === 'force') return fill(t.force, { port: d.port, v: d.value })
  if (d.kind === 'distance') return d.mm < 0 ? fill(t.noObject, { port: d.port }) : fill(t.distance, { port: d.port, v: d.mm })
  if (d.kind === 'color') return fill(t.color, { port: d.port })
  return ''
}

/** Connection to a real hub over Bluetooth: status, battery, slot, live sensors and the robot's console. */
export function RobotPanel({ lang, className }: { lang: Locale; className?: string }) {
  const t = getRobotLinkText(lang)
  const available = useBluetoothAvailable()
  const hub = useHub()
  const linked = hub.status !== 'idle' && hub.status !== 'connecting'
  const devices = Object.entries(hub.devices)

  return (
    <section
      className={cn('grid gap-3 rounded-(--radius-md) border-(length:--stroke-thin) border-outline bg-card p-4', className)}
      aria-label={t.title}
      data-testid="robot-panel"
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 className="m-0 flex items-center gap-2 text-lg">
          {available ? (
            <Bluetooth className="size-5 text-link" aria-hidden="true" />
          ) : (
            <BluetoothOff className="size-5 text-muted-foreground" aria-hidden="true" />
          )}
          {t.title}
        </h3>
        {linked && (
          <p className="m-0 flex flex-wrap items-center gap-x-3 text-sm font-bold" role="status">
            <span className="text-success">
              ● {t.connected}: {hub.name}
            </span>
            {hub.battery !== null && <span>{fill(t.battery, { n: hub.battery })}</span>}
            <span className="font-normal text-muted-foreground">{fill(t.firmware, { v: hub.firmware })}</span>
          </p>
        )}
        {available &&
          (linked ? (
            <button
              type="button"
              className={buttonVariants({ size: 'sm', variant: 'ghost', className: 'ml-auto' })}
              onClick={disconnectHub}
              disabled={hub.status === 'uploading'}
            >
              <Unplug aria-hidden="true" />
              {t.disconnect}
            </button>
          ) : (
            <button
              type="button"
              className={buttonVariants({ size: 'sm', className: 'ml-auto' })}
              onClick={() => void connectHub()}
              disabled={hub.status === 'connecting'}
            >
              {hub.status === 'connecting' ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Bluetooth aria-hidden="true" />}
              {hub.status === 'connecting' ? t.connecting : t.connect}
            </button>
          ))}
      </div>

      {!available && <p className="m-0 text-sm text-muted-foreground">{t.unsupported}</p>}
      {available && !linked && (
        <p className="m-0 text-sm text-muted-foreground">
          {t.lead} {t.howTo}
        </p>
      )}
      {available && (
        <label className="flex flex-wrap items-center gap-2 text-sm font-bold">
          {t.slot}
          <select className="select w-20" value={hub.slot} onChange={(e) => setHubSlot(Number(e.target.value))} disabled={hub.status === 'uploading'}>
            {Array.from({ length: SLOT_COUNT }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
          <span className="font-normal text-muted-foreground">{t.slotHint}</span>
        </label>
      )}
      {hub.status === 'running' && (
        <p className="m-0 text-sm font-bold text-link" role="status">
          ▶ {t.running}
        </p>
      )}
      {hub.problem && (
        <p className="alert alert-warn m-0" role="alert">
          {t.problems[hub.problem]}
        </p>
      )}
      {devices.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t.sensors}>
          {devices.map(([key, d]) => (
            <li
              key={key}
              className="inline-flex items-center gap-1.5 rounded-full border-(length:--stroke-thin) border-outline bg-surface-2 px-2.5 py-0.5 text-xs font-bold tabular-nums"
            >
              {d.kind === 'color' && (
                <span
                  className="size-3 rounded-full border border-outline"
                  style={{ background: `rgb(${d.rgb.map((c) => Math.min(255, Math.round(c / 4))).join(' ')})` }}
                  aria-hidden="true"
                />
              )}
              {deviceText(d, t)}
            </li>
          ))}
        </ul>
      )}
      {hub.console.length > 0 && (
        <div className="grid gap-1">
          <p className="m-0 text-sm font-bold">{t.console}</p>
          <pre className="m-0 max-h-40 overflow-auto rounded-(--radius-sm) bg-[#101626] p-3 font-mono text-xs text-[#e6f1ff]" data-testid="robot-console">
            {hub.console.join('\n')}
          </pre>
        </div>
      )}
    </section>
  )
}

/**
 * Sends a program to the hub and starts it, connecting first if needed.
 * `code` is SPIKE App 3 Python; a function is called only on click.
 */
export function SendToRobot({ lang, code, disabled, className }: { lang: Locale; code: string | (() => string); disabled?: boolean; className?: string }) {
  const t = getRobotLinkText(lang)
  const available = useBluetoothAvailable()
  const hub = useHub()
  if (!available) return null
  const linked = hub.status !== 'idle' && hub.status !== 'connecting'
  const busy = hub.status === 'uploading' || hub.status === 'connecting'
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-2', className)}>
      <button
        type="button"
        className={buttonVariants({ size: 'sm', variant: 'primary' })}
        disabled={busy || disabled}
        onClick={() => void runOnHub(typeof code === 'function' ? code() : code)}
      >
        {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : linked ? <Play aria-hidden="true" /> : <Bluetooth aria-hidden="true" />}
        {hub.status === 'uploading' ? fill(t.uploading, { n: Math.round(hub.progress * 100) }) : linked ? t.send : t.sendConnect}
      </button>
      {hub.status === 'running' && (
        <button type="button" className={buttonVariants({ size: 'sm', variant: 'danger' })} onClick={() => void stopHub()}>
          <Square aria-hidden="true" />
          {t.stop}
        </button>
      )}
    </span>
  )
}
