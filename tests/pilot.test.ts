import fs from 'node:fs'
import path from 'node:path'

import JSZip from 'jszip'
import { describe, expect, it } from 'vitest'

import { runChecks } from '@/lib/learn/checks'
import { PILOT_QUESTIONS, PILOT_TASKS, QUESTION_COUNT, TASK_COUNT, clientPilotTasks, clientQuestions } from '@/lib/pilot/content'
import { type Cell, type ReportInput, buildReport, toCsv, toXlsx } from '@/lib/pilot/report'
import { getPilotText } from '@/lib/i18n/pilot'

describe('pilot content', () => {
  it('has 20 questions and 5 tasks', () => {
    expect(PILOT_QUESTIONS).toHaveLength(QUESTION_COUNT)
    expect(PILOT_TASKS).toHaveLength(TASK_COUNT)
  })

  it('does not always put the right answer in the same place', () => {
    const counts = [0, 1, 2, 3].map((i) => PILOT_QUESTIONS.filter((q) => q.correct === i).length)
    for (const c of counts) expect(c).toBeGreaterThanOrEqual(3)
  })

  it('never sends the answers or solutions to the browser', () => {
    expect(JSON.stringify(clientQuestions())).not.toContain('"correct"')
    expect(JSON.stringify(clientPilotTasks())).not.toContain('"reference"')
  })

  it('the answer key in the database matches the questions', () => {
    const sql = fs.readFileSync(path.resolve('supabase/migrations/20261109020000_classes_pilot.sql'), 'utf8')
    for (const q of PILOT_QUESTIONS) expect(sql, q.id).toContain(`('${q.id}', ${q.correct})`)
  })

  it.each(PILOT_TASKS.map((t) => [t.id, t] as const))('%s: the reference solution passes every check, and an empty program does not', (_, task) => {
    const label = (id: string) => id
    expect(runChecks(task.reference, task.field, task.checks, 'ru', label).results.filter((r) => !r.ok)).toEqual([])
    expect(runChecks([], task.field, task.checks, 'ru', label).ok).toBe(false)
  })

  it('tasks use only blocks from their own toolbox', () => {
    for (const task of PILOT_TASKS) {
      const used = new Set<string>()
      const walk = (steps: typeof task.reference) => steps.forEach((s) => (used.add(s.op), 'steps' in s && walk(s.steps)))
      walk(task.reference)
      expect(
        [...used].filter((op) => !(task.toolbox as string[]).includes(op)),
        task.id,
      ).toEqual([])
    }
  })

  it('texts exist in every language', () => {
    const keys = (o: unknown, at = ''): string[] =>
      typeof o === 'object' && o && !Array.isArray(o) ? Object.entries(o).flatMap(([k, v]) => keys(v, `${at}.${k}`)) : [at]
    expect(keys(getPilotText('kk'))).toEqual(keys(getPilotText('ru')))
    expect(keys(getPilotText('en'))).toEqual(keys(getPilotText('ru')))
  })
})

const input = (over: Partial<ReportInput> = {}): ReportInput => ({
  taskCount: 5,
  members: [
    { id: 'a', nickname: 'Альфа', lessons_done: 4 },
    { id: 'b', nickname: 'Бета', lessons_done: 2 },
    { id: 'c', nickname: 'Гамма', lessons_done: 0 },
  ],
  tests: [
    { member_id: 'a', kind: 'pre', score: 10, total: 20 },
    { member_id: 'a', kind: 'post', score: 18, total: 20 },
    { member_id: 'b', kind: 'pre', score: 8, total: 20 },
    { member_id: 'b', kind: 'post', score: 12, total: 20 },
    { member_id: 'c', kind: 'pre', score: 2, total: 20 },
  ],
  tasks: [
    { member_id: 'a', task_id: 't1', passed: true, hints: 0 },
    { member_id: 'a', task_id: 't2', passed: true, hints: 2 },
    { member_id: 'b', task_id: 't1', passed: true, hints: 0 },
    { member_id: 'b', task_id: 't2', passed: false, hints: 1 },
  ],
  surveys: [
    { member_id: 'a', clarity: 5 },
    { member_id: 'b', clarity: 4 },
  ],
  attendance: [
    { member_id: 'a', day: '2026-11-01' },
    { member_id: 'a', day: '2026-11-02' },
    { member_id: 'b', day: '2026-11-01' },
  ],
  ...over,
})

describe('report', () => {
  it('compares before and after only on learners who took both tests', () => {
    const { summary } = buildReport(input())
    expect(summary.learners).toBe(3)
    expect(summary.paired).toBe(2)
    // (50 + 40) / 2 and (90 + 60) / 2: Гамма took only the first test.
    expect(summary.preAverage).toBe(45)
    expect(summary.postAverage).toBe(75)
  })

  it('counts tasks without a hint among passed tasks only', () => {
    expect(buildReport(input()).summary.noHintShare).toBeCloseTo(66.7, 1)
  })

  it('computes clarity, attendance and lessons', () => {
    const r = buildReport(input())
    expect(r.classDays).toBe(2)
    expect(r.summary.clarityAverage).toBe(4.5)
    // 100 %, 50 %, 0 %
    expect(r.summary.attendanceShare).toBe(50)
    expect(r.summary.lessonsAverage).toBe(2)
  })

  it('shows dashes rather than zeros when nothing is known', () => {
    const { summary } = buildReport({ taskCount: 5, members: [], tests: [], tasks: [], surveys: [], attendance: [] })
    expect(summary).toMatchObject({ learners: 0, preAverage: null, postAverage: null, noHintShare: null, clarityAverage: null, attendanceShare: null })
  })

  it('contains nicknames only', () => {
    expect(Object.keys(buildReport(input()).rows[0]).sort()).toEqual([
      'clarity',
      'daysPresent',
      'lessons',
      'nickname',
      'post',
      'pre',
      'tasksNoHint',
      'tasksPassed',
    ])
  })
})

describe('exports', () => {
  const rows: Cell[][] = [
    ['Ник', 'Балл'],
    ['Альфа', 90],
    ['=HYPERLINK("x")', null],
    ['a;b"c', 1],
  ]

  it('CSV opens in Excel and cannot run formulas', () => {
    const csv = toCsv(rows)
    expect(csv.charCodeAt(0)).toBe(0xfeff)
    expect(csv).toContain('Альфа;90')
    expect(csv).toContain(`"'=HYPERLINK(""x"")";`)
    expect(csv).toContain('"a;b""c";1')
  })

  it('XLSX is a valid package with text kept as text', async () => {
    const blob = await toXlsx([{ name: 'Ученики', rows }])
    const zip = await JSZip.loadAsync(await blob.arrayBuffer())
    expect(Object.keys(zip.files)).toEqual(
      expect.arrayContaining(['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/worksheets/sheet1.xml']),
    )
    const sheet = await zip.file('xl/worksheets/sheet1.xml')!.async('string')
    expect(sheet).toContain('<c r="A2" t="inlineStr"><is><t xml:space="preserve">Альфа</t></is></c>')
    expect(sheet).toContain('<c r="B2"><v>90</v></c>')
    expect(sheet).toContain('=HYPERLINK(&quot;x&quot;)')
    expect(sheet).not.toContain('<f>')
    expect(await zip.file('xl/workbook.xml')!.async('string')).toContain('name="Ученики"')
  })
})
