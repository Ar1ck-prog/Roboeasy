import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { COURSE, readLesson, readyLessonIds, toClientLesson } from '../lib/learn/content'
import { runChecks } from '../lib/learn/checks'
import { simulate } from '../lib/sim/interpreter'

/** 24 points evenly spaced along the path, to compare whole routes. */
function resample(trace: { x: number; y: number }[], n = 24) {
  const d = [0]
  for (let i = 1; i < trace.length; i++) d.push(d[i - 1] + Math.hypot(trace[i].x - trace[i - 1].x, trace[i].y - trace[i - 1].y))
  const total = d[d.length - 1] || 1
  return Array.from({ length: n }, (_, k) => {
    const target = (total * k) / (n - 1)
    const i = Math.max(1, d.findIndex((v) => v >= target))
    const a = trace[i - 1] ?? trace[0]
    const b = trace[i] ?? a
    const t = (target - d[i - 1]) / ((d[i] - d[i - 1]) || 1)
    return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
  })
}

const DIR = path.join(__dirname, '..', 'content', 'learn', 'lessons')
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json'))

describe('course map', () => {
  it('has 9 tracks with unique ids and known prerequisites', () => {
    expect(COURSE.tracks).toHaveLength(9)
    const ids = COURSE.tracks.flatMap((t) => [t.id, ...t.units.map((u) => u.id), ...t.units.flatMap((u) => u.lessons.map((l) => l.id))])
    expect(new Set(ids).size).toBe(ids.length)
    const tracks = new Set(COURSE.tracks.map((t) => t.id))
    for (const t of COURSE.tracks) for (const p of t.prerequisites) expect(tracks).toContain(p)
  })

  it('every ready lesson has a file and every file is a ready lesson', () => {
    expect(files.map((f) => f.replace('.json', '')).sort()).toEqual(readyLessonIds().sort())
  })

  it('every unit ends with at most one project and the Start track is complete', () => {
    const start = COURSE.tracks.find((t) => t.id === 'start')!
    expect(start.units.flatMap((u) => u.lessons).every((l) => l.status === 'ready')).toBe(true)
  })
})

describe.each(files)('lesson %s', (file) => {
  const lesson = readLesson(file.replace('.json', ''))!

  it('is valid and placed in the right track and unit', () => {
    expect(lesson).not.toBeNull()
    const track = COURSE.tracks.find((t) => t.id === lesson.track)!
    expect(track.units.find((u) => u.id === lesson.unit)!.lessons.some((l) => l.id === lesson.id)).toBe(true)
  })

  it('reference solutions pass all checks; debug starters fail', () => {
    for (const step of lesson.steps) {
      if (step.type !== 'code' && step.type !== 'debug' && step.type !== 'project') continue
      expect(step.reference, `${step.id} needs a reference`).toBeDefined()
      const report = runChecks(step.reference!, step.field, step.checks, 'ru')
      expect(report.results.filter((r) => !r.ok).map((r) => `${step.id}: ${r.message}`)).toEqual([])
      if (step.type === 'debug') expect(runChecks(step.start, step.field, step.checks, 'ru').ok, `${step.id} starter must fail`).toBe(false)
      if (step.type === 'code' && step.start.length) expect(runChecks(step.start, step.field, step.checks, 'ru').ok, `${step.id} starter already passes`).toBe(false)
      // Toolbox covers the reference solution.
      const ops = new Set<string>()
      const walk = (l: typeof step.reference) => l!.forEach((s) => (ops.add(s.op), 'steps' in s && walk(s.steps)))
      walk(step.reference)
      for (const op of ops) expect(step.toolbox, `${step.id}: ${op} missing from toolbox`).toContain(op)
    }
  })

  it('predictions: the correct option behaves like the program, the others differ', () => {
    for (const step of lesson.steps) {
      if (step.type !== 'predict') continue
      const real = resample(simulate(step.program, step.field).trace)
      step.options.forEach((o, i) => {
        const path = resample(simulate(o.steps, step.field).trace)
        const same = real.every((p, k) => Math.hypot(p.x - path[k].x, p.y - path[k].y) < 5)
        expect(same, `${step.id} option ${i}`).toBe(i === step.correct)
      })
    }
  })

  it('never sends reference solutions to the browser', () => {
    expect(JSON.stringify(toClientLesson(lesson))).not.toContain('"reference"')
  })
})
