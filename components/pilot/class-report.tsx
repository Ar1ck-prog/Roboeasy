'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, FileDown, FileSpreadsheet, Trash2 } from 'lucide-react'

import { useCloudModule, useCloudUser } from '@/components/learn/use-cloud'
import { buttonVariants } from '@/components/ui/button'
import { Card, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { type Locale, fill } from '@/lib/i18n/config'
import type { PilotText } from '@/lib/i18n/pilot'
import { type ClassData, classData, removeMember } from '@/lib/pilot/client'
import { type ClassReport, type ReportRow, buildReport, reportTable, summaryTable, toCsv, toXlsx } from '@/lib/pilot/report'

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

const COLORS = { before: 'var(--chart-before)', after: 'var(--chart-after)' }

function Legend({ t }: { t: PilotText['report'] }) {
  return (
    <div className="flex gap-4 text-sm text-muted-foreground">
      {(['before', 'after'] as const).map((k) => (
        <span key={k} className="inline-flex items-center gap-1.5">
          <i className="inline-block size-3 rounded-[3px]" style={{ background: COLORS[k] }} aria-hidden="true" />
          {t[k]}
        </span>
      ))}
    </div>
  )
}

/** One horizontal bar on a 0–100 scale, with its value written next to it. */
function Bar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="grid grid-cols-[4.5rem_1fr_3.5rem] items-center gap-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="h-6 border-l border-border-strong">
        <div
          className="group relative h-full rounded-r-[4px]"
          style={{ width: `${value}%`, background: color }}
          tabIndex={0}
          role="img"
          aria-label={`${label}: ${value}%`}
        >
          <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border-strong bg-card px-2 py-1 text-xs text-foreground group-hover:block group-focus:block">
            {label}: {value}%
          </span>
        </div>
      </div>
      <span className="text-right text-sm font-bold tabular-nums">{value}%</span>
    </div>
  )
}

/** Each learner's two scores on one line: the gap is what the eye reads. */
function LearnerDots({ rows, t }: { rows: (ReportRow & { pre: number; post: number })[]; t: PilotText['report'] }) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {rows.map((r) => {
        const [low, high] = r.pre <= r.post ? [r.pre, r.post] : [r.post, r.pre]
        return (
          <li key={r.nickname} className="grid grid-cols-[6rem_1fr_3.5rem] items-center gap-2">
            <span className="truncate text-sm font-bold">{r.nickname}</span>
            <div className="group relative h-7" tabIndex={0} role="img" aria-label={`${r.nickname}: ${t.before} ${r.pre}%, ${t.after} ${r.post}%`}>
              <div className="absolute inset-x-0 top-1/2 h-px bg-border" />
              <div className="absolute top-1/2 h-0.5 -translate-y-1/2 bg-border-strong" style={{ left: `${low}%`, width: `${high - low}%` }} />
              {(['before', 'after'] as const).map((k) => (
                <i
                  key={k}
                  className="absolute top-1/2 block size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-card"
                  style={{ left: `${k === 'before' ? r.pre : r.post}%`, background: COLORS[k] }}
                />
              ))}
              <span className="pointer-events-none absolute bottom-full left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border-strong bg-card px-2 py-1 text-xs group-hover:block group-focus:block">
                {t.before} {r.pre}% · {t.after} {r.post}%
              </span>
            </div>
            <span className="text-right text-sm tabular-nums">
              {r.post - r.pre > 0 ? '+' : ''}
              {r.post - r.pre}
            </span>
          </li>
        )
      })}
      <li className="grid grid-cols-[6rem_1fr_3.5rem] gap-2 text-xs text-muted-foreground" aria-hidden="true">
        <span />
        <span className="flex justify-between">
          <span>0</span>
          <span>100%</span>
        </span>
      </li>
    </ul>
  )
}

function fileName(name: string, ext: string) {
  return `${name.replace(/[^\p{L}\p{N}_-]+/gu, '_').slice(0, 40) || 'report'}.${ext}`
}

export function ClassReportView({ lang, t, classId, taskCount }: { lang: Locale; t: PilotText; classId: string; taskCount: number }) {
  const mod = useCloudModule()
  const user = useCloudUser(mod)
  const [data, setData] = useState<ClassData | null | undefined>(undefined)

  const load = useCallback(async () => {
    try {
      setData(await classData(classId))
    } catch {
      setData(null)
    }
  }, [classId])

  useEffect(() => {
    if (user === null) setData(null)
    if (user) void load()
  }, [user, load])

  const back = (
    <Link href={`/${lang}/teacher`} className={buttonVariants({ variant: 'ghost', size: 'sm', className: 'justify-self-start' })}>
      <ArrowLeft aria-hidden="true" />
      {t.teacher.back}
    </Link>
  )

  if (data === undefined) return <Skeleton className="container my-10 h-96" />
  if (data === null)
    return (
      <div className="container grid gap-4 py-10">
        {back}
        <p className="alert alert-warn m-0">{t.teacher.notFound}</p>
      </div>
    )

  const report: ClassReport = buildReport({ ...data, taskCount })
  const r = t.report
  const s = report.summary
  const summary = summaryTable(report, r.labels)
  const table = reportTable(report, r.labels)
  const pairs = report.rows.filter((row): row is ReportRow & { pre: number; post: number } => row.pre !== null && row.post !== null)
  const remove = async (nickname: string) => {
    const member = data.members.find((m) => m.nickname === nickname)
    if (!member || !window.confirm(fill(r.removeConfirm, { name: nickname }))) return
    await removeMember(member.id)
    await load()
  }

  return (
    <div className="container grid grid-cols-[minmax(0,1fr)] gap-6 py-10">
      {back}
      <header className="grid gap-2">
        <h1 className="m-0 text-4xl">{fill(r.title, { name: data.name })}</h1>
        <p className="m-0 text-muted-foreground">
          {fill(r.note, { n: s.paired, all: s.learners })} {fill(r.days, { n: report.classDays })}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={buttonVariants({ variant: 'primary', size: 'sm' })}
          onClick={async () =>
            saveFile(
              await toXlsx([
                { name: r.labels.summary, rows: summary },
                { name: r.labels.students, rows: table },
              ]),
              fileName(data.name, 'xlsx'),
            )
          }
        >
          <FileSpreadsheet aria-hidden="true" />
          {r.xlsx}
        </button>
        <button
          type="button"
          className={buttonVariants({ size: 'sm' })}
          onClick={() => saveFile(new Blob([toCsv([...summary, [], ...table])], { type: 'text/csv;charset=utf-8' }), fileName(data.name, 'csv'))}
        >
          <FileDown aria-hidden="true" />
          {r.csv}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {summary.slice(4).map(([label, value]) => (
          <Card key={String(label)} className="gap-1">
            <p className="m-0 text-sm text-muted-foreground">{label}</p>
            <p className="m-0 font-display text-3xl font-bold tabular-nums">{value ?? '—'}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="gap-3">
          <CardTitle>{r.chartAverage}</CardTitle>
          {s.preAverage === null || s.postAverage === null ? (
            <p className="m-0 text-muted-foreground">{r.noPairs}</p>
          ) : (
            <>
              <Legend t={r} />
              <div className="grid gap-2" data-testid="chart-average">
                <Bar label={r.before} value={s.preAverage} color={COLORS.before} />
                <Bar label={r.after} value={s.postAverage} color={COLORS.after} />
              </div>
              <p className="m-0 font-bold">
                {fill(r.change, { d: `${s.postAverage - s.preAverage > 0 ? '+' : ''}${Math.round((s.postAverage - s.preAverage) * 10) / 10}` })}
              </p>
            </>
          )}
        </Card>
        <Card className="gap-3">
          <CardTitle>{r.chartLearners}</CardTitle>
          {pairs.length === 0 ? (
            <p className="m-0 text-muted-foreground">{r.noPairs}</p>
          ) : (
            <>
              <Legend t={r} />
              <LearnerDots rows={pairs} t={r} />
            </>
          )}
        </Card>
      </div>

      <Card className="gap-3">
        <CardTitle>{r.labels.students}</CardTitle>
        {report.rows.length === 0 ? (
          <p className="m-0 text-muted-foreground">{fill(r.empty, { code: '' })}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm" data-testid="report-table">
              <thead>
                <tr className="border-b-(length:--stroke-thin) border-outline">
                  {(table[0] as string[]).map((h) => (
                    <th key={h} className="py-2 pr-4">
                      {h}
                    </th>
                  ))}
                  <th aria-hidden="true" />
                </tr>
              </thead>
              <tbody>
                {table.slice(1).map((row) => (
                  <tr key={String(row[0])} className="border-b border-dashed border-border-strong">
                    {row.map((cell, i) => (
                      <td key={i} className={i === 0 ? 'py-2 pr-4 font-bold' : 'py-2 pr-4 tabular-nums'}>
                        {cell ?? '—'}
                      </td>
                    ))}
                    <td className="py-1">
                      <button
                        type="button"
                        className={buttonVariants({ variant: 'ghost', size: 'sm' })}
                        aria-label={`${r.remove}: ${row[0]}`}
                        onClick={() => void remove(String(row[0]))}
                      >
                        <Trash2 aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
