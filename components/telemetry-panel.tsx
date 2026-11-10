'use client'

import { type PointerEvent, useEffect, useState } from 'react'
import { Download, Save, Trash2 } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { type Locale, fill } from '@/lib/i18n/config'
import { getRobotLinkText } from '@/lib/i18n/robot-link'
import { useHub } from '@/lib/spike/ble'
import {
  type TelemetryRecord,
  type TelemetrySample,
  deleteRecord,
  loadRecords,
  saveRecord,
  setTelemetryEnabled,
  telemetryCsv,
  telemetryEnabled,
} from '@/lib/spike/telemetry'

const WINDOW_MS = 30_000
const W = 300
const H = 90

const COLOR_SWATCH: Record<number, string> = {
  0: '#1b1b1b',
  1: '#a24bd1',
  3: '#1f5fd6',
  4: '#3ec1f3',
  5: '#2ec4b6',
  6: '#27a844',
  7: '#ffd500',
  8: '#ff8a00',
  9: '#e02020',
  10: '#ffffff',
}

interface Series {
  name: string
  color: string
  values: (number | null)[]
}

/** Line pieces in SVG coordinates; a missing reading breaks the line. */
function paths(values: (number | null)[], times: number[], x0: number, xSpan: number, y0: number, ySpan: number): string {
  let d = ''
  let open = false
  values.forEach((v, i) => {
    if (v === null) {
      open = false
      return
    }
    const x = ((times[i] - x0) / xSpan) * W
    const y = H - ((v - y0) / ySpan) * (H - 8) - 4
    d += `${open ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`
    open = true
  })
  return d
}

function Chart({ title, unit, times, series, noData }: { title: string; unit: string; times: number[]; series: Series[]; noData: string }) {
  const [hover, setHover] = useState<number | null>(null)
  const all = series.flatMap((s) => s.values).filter((v): v is number => v !== null)
  if (!all.length)
    return (
      <div className="grid gap-1">
        <p className="m-0 text-sm font-bold">{title}</p>
        <p className="m-0 text-xs text-muted-foreground">{noData}</p>
      </div>
    )
  const low = Math.min(...all)
  const high = Math.max(...all)
  const ySpan = high - low || 1
  const x0 = times[0]
  const xSpan = times[times.length - 1] - x0 || 1

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const box = e.currentTarget.getBoundingClientRect()
    const at = x0 + ((e.clientX - box.left) / box.width) * xSpan
    let best = 0
    times.forEach((t, i) => {
      if (Math.abs(t - at) < Math.abs(times[best] - at)) best = i
    })
    setHover(best)
  }

  const shown = hover ?? times.length - 1
  return (
    <div className="grid gap-1">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <p className="m-0 text-sm font-bold">{title}</p>
        <p className="m-0 flex gap-2 text-xs tabular-nums text-muted-foreground">
          <span>{(times[shown] / 1000).toFixed(1)} s</span>
          {series.map((s) => (
            <span key={s.name} className="inline-flex items-center gap-1">
              {series.length > 1 && <i className="inline-block size-2.5 rounded-[2px]" style={{ background: s.color }} aria-hidden="true" />}
              {series.length > 1 ? `${s.name}: ` : ''}
              {s.values[shown] ?? '—'} {unit}
            </span>
          ))}
        </p>
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="block h-20 w-full touch-none rounded-(--radius-sm) bg-surface-2"
        role="img"
        aria-label={title}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        {series.map((s) => (
          <path
            key={s.name}
            d={paths(s.values, times, x0, xSpan, low, ySpan)}
            fill="none"
            stroke={s.color}
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
        {hover !== null && (
          <line
            x1={((times[hover] - x0) / xSpan) * W}
            x2={((times[hover] - x0) / xSpan) * W}
            y1={0}
            y2={H}
            stroke="var(--text-3)"
            strokeWidth={1}
            vectorEffect="non-scaling-stroke"
          />
        )}
      </svg>
      <p className="m-0 flex justify-between text-[11px] tabular-nums text-muted-foreground">
        <span>
          {low} … {high} {unit}
        </span>
      </p>
    </div>
  )
}

function ColorStrip({ title, samples, noData }: { title: string; samples: TelemetrySample[]; noData: string }) {
  const known = samples.some((s) => s.color !== null && s.color >= 0)
  return (
    <div className="grid gap-1">
      <p className="m-0 text-sm font-bold">{title}</p>
      {known ? (
        <div className="flex h-6 overflow-hidden rounded-(--radius-sm) bg-surface-2" data-testid="telemetry-colors" aria-hidden="true">
          {samples.map((s, i) => (
            <i key={i} className="block h-full flex-1" style={{ background: s.color !== null ? (COLOR_SWATCH[s.color] ?? 'transparent') : 'transparent' }} />
          ))}
        </div>
      ) : (
        <p className="m-0 text-xs text-muted-foreground">{noData}</p>
      )}
    </div>
  )
}

function download(samples: TelemetrySample[], at: number) {
  const url = URL.createObjectURL(new Blob([telemetryCsv(samples)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `robot-${new Date(at).toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function TelemetryPanel({ lang }: { lang: Locale }) {
  const t = getRobotLinkText(lang).telemetry
  const hub = useHub()
  const [enabled, setEnabled] = useState(false)
  const [records, setRecords] = useState<TelemetryRecord[]>([])

  useEffect(() => {
    setEnabled(telemetryEnabled())
    setRecords(loadRecords())
  }, [])

  const newest = hub.telemetry[hub.telemetry.length - 1]?.t ?? 0
  const samples = hub.telemetry.filter((s) => s.t >= newest - WINDOW_MS)
  const times = samples.map((s) => s.t)

  return (
    <div className="grid gap-3" data-testid="telemetry">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked)
            setTelemetryEnabled(e.target.checked)
          }}
        />
        <span>
          <strong>{t.toggle}</strong>
          <small className="block text-muted-foreground">{t.hint}</small>
        </span>
      </label>

      {samples.length > 1 && (
        <div className="grid gap-4 md:grid-cols-2">
          <Chart
            title={t.distance}
            unit={t.cm}
            times={times}
            noData={t.noData}
            series={[{ name: t.distance, color: 'var(--link)', values: samples.map((s) => s.dist) }]}
          />
          <Chart title={t.yaw} unit="°" times={times} noData={t.noData} series={[{ name: t.yaw, color: 'var(--link)', values: samples.map((s) => s.yaw) }]} />
          <Chart
            title={t.motors}
            unit={t.degS}
            times={times}
            noData={t.noData}
            series={[
              { name: t.left, color: 'var(--chart-before)', values: samples.map((s) => s.ml) },
              { name: t.right, color: 'var(--chart-after)', values: samples.map((s) => s.mr) },
            ]}
          />
          <ColorStrip title={t.color} samples={samples} noData={t.noData} />
        </div>
      )}

      {hub.telemetry.length > 1 && (
        <button type="button" className={buttonVariants({ size: 'sm', className: 'justify-self-start' })} onClick={() => setRecords(saveRecord(hub.telemetry))}>
          <Save aria-hidden="true" />
          {t.save}
        </button>
      )}

      {records.length > 0 && (
        <div className="grid gap-1">
          <p className="m-0 text-sm font-bold">{t.records}</p>
          <p className="m-0 text-xs text-muted-foreground">{t.localOnly}</p>
          <ul className="m-0 grid list-none gap-1 p-0">
            {records.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center gap-2 text-sm">
                <span className="tabular-nums">{new Date(r.at).toLocaleString(lang === 'en' ? 'en-GB' : 'ru-RU')}</span>
                <span className="text-muted-foreground">{fill(t.samples, { n: r.samples.length })}</span>
                <button type="button" className={buttonVariants({ size: 'sm', variant: 'ghost' })} onClick={() => download(r.samples, r.at)}>
                  <Download aria-hidden="true" />
                  CSV
                </button>
                <button
                  type="button"
                  className={buttonVariants({ size: 'sm', variant: 'ghost' })}
                  aria-label={t.remove}
                  onClick={() => setRecords(deleteRecord(r.id))}
                >
                  <Trash2 aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
