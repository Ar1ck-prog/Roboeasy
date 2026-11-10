/**
 * The class's "before and after" report, from the rows the teacher can read.
 * Only nicknames appear. Before and after are compared on the learners who
 * took both tests, otherwise a change in who was present looks like progress.
 */

export interface ReportInput {
  taskCount: number
  members: { id: string; nickname: string; lessons_done: number }[]
  tests: { member_id: string; kind: 'pre' | 'post'; score: number; total: number }[]
  tasks: { member_id: string; task_id: string; passed: boolean; hints: number }[]
  surveys: { member_id: string; clarity: number }[]
  attendance: { member_id: string; day: string }[]
}

export interface ReportRow {
  nickname: string
  /** Percent correct, null when the test was not taken. */
  pre: number | null
  post: number | null
  tasksPassed: number
  tasksNoHint: number
  clarity: number | null
  daysPresent: number
  lessons: number
}

export interface ClassReport {
  rows: ReportRow[]
  taskCount: number
  /** Days on which anyone in the class was present. */
  classDays: number
  summary: {
    learners: number
    /** Learners with both tests; the before/after averages use only them. */
    paired: number
    preAverage: number | null
    postAverage: number | null
    /** Share of passed tasks solved without a hint, percent. */
    noHintShare: number | null
    clarityAverage: number | null
    attendanceShare: number | null
    lessonsAverage: number | null
  }
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)
const round1 = (n: number | null) => (n === null ? null : Math.round(n * 10) / 10)

export function buildReport(input: ReportInput): ClassReport {
  const percent = (id: string, kind: 'pre' | 'post') => {
    const t = input.tests.find((x) => x.member_id === id && x.kind === kind)
    return t && t.total > 0 ? Math.round((t.score / t.total) * 100) : null
  }
  const classDays = new Set(input.attendance.map((a) => a.day)).size

  const rows: ReportRow[] = input.members.map((m) => {
    const passed = input.tasks.filter((t) => t.member_id === m.id && t.passed)
    return {
      nickname: m.nickname,
      pre: percent(m.id, 'pre'),
      post: percent(m.id, 'post'),
      tasksPassed: passed.length,
      tasksNoHint: passed.filter((t) => t.hints === 0).length,
      clarity: input.surveys.find((s) => s.member_id === m.id)?.clarity ?? null,
      daysPresent: new Set(input.attendance.filter((a) => a.member_id === m.id).map((a) => a.day)).size,
      lessons: m.lessons_done,
    }
  })
  rows.sort((a, b) => a.nickname.localeCompare(b.nickname))

  const paired = rows.filter((r): r is ReportRow & { pre: number; post: number } => r.pre !== null && r.post !== null)
  const totalPassed = rows.reduce((n, r) => n + r.tasksPassed, 0)
  const summary = {
    learners: rows.length,
    paired: paired.length,
    preAverage: round1(average(paired.map((r) => r.pre))),
    postAverage: round1(average(paired.map((r) => r.post))),
    noHintShare: totalPassed ? round1((rows.reduce((n, r) => n + r.tasksNoHint, 0) / totalPassed) * 100) : null,
    clarityAverage: round1(average(rows.flatMap((r) => (r.clarity === null ? [] : [r.clarity])))),
    attendanceShare: classDays && rows.length ? round1(average(rows.map((r) => (r.daysPresent / classDays) * 100))) : null,
    lessonsAverage: rows.length ? round1(average(rows.map((r) => r.lessons))) : null,
  }
  return { rows, taskCount: input.taskCount, classDays, summary }
}

export interface ReportLabels {
  nickname: string
  pre: string
  post: string
  tasksPassed: string
  tasksNoHint: string
  clarity: string
  daysPresent: string
  lessons: string
  learners: string
  paired: string
  preAverage: string
  postAverage: string
  noHintShare: string
  clarityAverage: string
  attendanceShare: string
  lessonsAverage: string
  summary: string
  students: string
}

export type Cell = string | number | null

export function reportTable(report: ClassReport, t: ReportLabels): Cell[][] {
  return [
    [t.nickname, t.pre, t.post, t.tasksPassed, t.tasksNoHint, t.clarity, t.daysPresent, t.lessons],
    ...report.rows.map((r) => [r.nickname, r.pre, r.post, r.tasksPassed, r.tasksNoHint, r.clarity, r.daysPresent, r.lessons]),
  ]
}

export function summaryTable(report: ClassReport, t: ReportLabels): Cell[][] {
  const s = report.summary
  return [
    [t.learners, s.learners],
    [t.paired, s.paired],
    [t.preAverage, s.preAverage],
    [t.postAverage, s.postAverage],
    [t.noHintShare, s.noHintShare],
    [t.clarityAverage, s.clarityAverage],
    [t.attendanceShare, s.attendanceShare],
    [t.lessonsAverage, s.lessonsAverage],
  ]
}

/** A cell starting with these is run as a formula by spreadsheet programs. */
const FORMULA_START = /^[=+\-@\t\r]/

function csvCell(value: Cell): string {
  if (value === null) return ''
  if (typeof value === 'number') return String(value)
  const safe = FORMULA_START.test(value) ? `'${value}` : value
  return /[;"\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Semicolons and a byte-order mark: what Excel in ru/kk locales opens correctly. */
export function toCsv(rows: Cell[][]): string {
  return `﻿${rows.map((r) => r.map(csvCell).join(';')).join('\r\n')}\r\n`
}

const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function columnName(i: number): string {
  let n = i
  let out = ''
  do {
    out = String.fromCharCode(65 + (n % 26)) + out
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return out
}

function sheetXml(rows: Cell[][]): string {
  const body = rows
    .map((row, r) => {
      const cells = row
        .map((value, c) => {
          const ref = `${columnName(c)}${r + 1}`
          if (value === null) return ''
          if (typeof value === 'number') return `<c r="${ref}"><v>${value}</v></c>`
          return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xml(value)}</t></is></c>`
        })
        .join('')
      return `<row r="${r + 1}">${cells}</row>`
    })
    .join('')
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`
}

/** A minimal .xlsx: JSZip is already in the project, so no spreadsheet library is needed. */
export async function toXlsx(sheets: { name: string; rows: Cell[][] }[]): Promise<Blob> {
  const { default: JSZip } = await import('jszip')
  const zip = new JSZip()
  const overrides = sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join('')
  zip.file(
    '[Content_Types].xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}</Types>`,
  )
  zip.file(
    '_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>',
  )
  zip.file(
    'xl/workbook.xml',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheets
      .map((s, i) => `<sheet name="${xml(s.name.slice(0, 31))}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
      .join('')}</sheets></workbook>`,
  )
  zip.file(
    'xl/_rels/workbook.xml.rels',
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets
      .map(
        (_, i) =>
          `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
      )
      .join('')}</Relationships>`,
  )
  sheets.forEach((s, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(s.rows)))
  return zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
}
