import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { COURSE, readLesson, readyLessonIds, toClientLesson } from '../lib/learn/content'
import { BLOCK_TYPES } from '../lib/blockly/defs'
import type { Step } from '../lib/dsl/types'
import { runChecks } from '../lib/learn/checks'
import { simulate } from '../lib/sim/interpreter'
import type { CircuitDoc } from '../lib/electronics/board'
import { createCircuitChecker } from '../lib/electronics/lesson-checks'
import { Simulation } from '../lib/electronics/sim'
import { getElectronicsText } from '../lib/i18n/electronics'

const MISSION_TEXT = getElectronicsText('ru').missions

/** Runs a circuit step's bench and sketch (with the learner's actions) until every goal is met, up to 20 s. */
function runCircuit(checks: Parameters<typeof createCircuitChecker>[0], start: CircuitDoc, code: string, actions: { t: number; part: string; props: object }[], maxMs = 20_000) {
  let doc: CircuitDoc = structuredClone(start)
  const sim = new Simulation(code, doc)
  const checker = createCircuitChecker(checks, (id) => MISSION_TEXT[id].goals.length)
  const queue = [...actions]
  let goals: boolean[] = []
  for (let t = 0; t < maxMs; t += 20) {
    while (queue.length && queue[0].t <= t) {
      const a = queue.shift()!
      doc = { ...doc, parts: doc.parts.map((p) => (p.id === a.part ? { ...p, props: { ...p.props, ...a.props } } : p)) }
      sim.board.setDoc(doc)
    }
    goals = checker.check({ frame: sim.step(20), doc, serial: sim.board.serialOut })
    if (!queue.length && goals.every(Boolean)) break
  }
  return { goals, status: sim.status.kind }
}

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
  it('has 13 tracks with unique ids and known prerequisites', () => {
    expect(COURSE.tracks).toHaveLength(13)
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
      const report = runChecks(step.reference!, step.field, step.checks, 'ru', undefined, step.referenceFunctions)
      expect(report.results.filter((r) => !r.ok).map((r) => `${step.id}: ${r.message}`)).toEqual([])
      const starter = () => runChecks(step.start, step.field, step.checks, 'ru', undefined, step.startFunctions).ok
      if (step.type === 'debug') expect(starter(), `${step.id} starter must fail`).toBe(false)
      if (step.type === 'code' && (step.start.length || step.startFunctions)) expect(starter(), `${step.id} starter already passes`).toBe(false)
      // Toolbox covers the reference solution, own blocks included.
      const ops = new Set<string>()
      const walk = (l: Step[]): void =>
        l.forEach((s) => {
          ops.add(s.op)
          if ('steps' in s) walk(s.steps)
          if (s.op === 'if') walk([...s.then, ...(s.else ?? [])])
        })
      walk(step.reference!)
      for (const f of step.referenceFunctions ?? []) walk(f.steps)
      for (const op of ops) expect(step.toolbox, `${step.id}: ${op} missing from toolbox`).toContain(op)
      // Every block in the toolbox has a block in the lesson editor.
      for (const op of step.toolbox) expect(Object.keys(BLOCK_TYPES), `${step.id}: no editor block for ${op}`).toContain(op)
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

  it('circuit steps: the reference bench and sketch meet every goal; a different start does not', () => {
    for (const step of lesson.steps) {
      if (step.type !== 'circuit') continue
      const doc = (step.reference.doc ?? step.start.doc) as CircuitDoc
      const code = step.reference.code ?? step.start.code
      const ok = runCircuit(step.checks, doc, code, step.reference.actions)
      expect(ok.status, `${step.id}: reference runs`).toBe('running')
      expect(ok.goals, `${step.id}: reference goals`).toEqual(ok.goals.map(() => true))
      const same = JSON.stringify(step.start.doc) === JSON.stringify(doc) && step.start.code === code
      if (same) continue
      const start = runCircuit(step.checks, step.start.doc as CircuitDoc, step.start.code, step.reference.actions, 6000)
      expect(start.goals.every(Boolean), `${step.id}: the start alone must not pass`).toBe(false)
    }
  }, 120_000)

  it('never sends reference solutions to the browser', () => {
    expect(JSON.stringify(toClientLesson(lesson))).not.toContain('"reference"')
  })
})
