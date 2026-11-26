import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { COURSE, readLesson, readyLessonIds, toClientLesson } from '../lib/learn/content'
import { BLOCK_TYPES } from '../lib/blockly/defs'
import type { Step } from '../lib/dsl/types'
import { runChecks } from '../lib/learn/checks'
import { simulate } from '../lib/sim/interpreter'
import { WEDO_STEP_TYPES } from '../lib/learn/schema'
import { runWedoChecks } from '../lib/wedo/checks'
import { type WedoStep, WEDO_LIMITS, wedoBlocks } from '../lib/wedo/types'

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
  it('has 14 tracks (4 WeDo 2.0 + 10 more) with unique ids and known prerequisites', () => {
    expect(COURSE.tracks).toHaveLength(14)
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

  it('never sends reference solutions to the browser', () => {
    expect(JSON.stringify(toClientLesson(lesson))).not.toContain('"reference"')
  })
})

// ── LEGO WeDo 2.0 lessons ───────────────────────────────────────────────

const familyOf = (trackId: string) => COURSE.tracks.find((t) => t.id === trackId)?.family

describe('WeDo and SPIKE stay apart', () => {
  it('every track has a family; WeDo tracks come first and lean only on WeDo', () => {
    for (const t of COURSE.tracks) expect(['spike', 'wedo', 'general'], t.id).toContain(t.family)
    const ids = COURSE.tracks.map((t) => t.id)
    const wedo = COURSE.tracks.filter((t) => t.family === 'wedo')
    for (const t of wedo) {
      expect(ids.indexOf(t.id), `${t.id} before start`).toBeLessThan(ids.indexOf('start'))
      for (const p of t.prerequisites) expect(familyOf(p), `${t.id} → ${p}`).toBe('wedo')
    }
  })

  it('WeDo code never imports the SPIKE DSL, Blockly, simulator or compilers', () => {
    const roots = ['lib/wedo', 'components/wedo'].map((d) => path.join(__dirname, '..', d)).filter((d) => fs.existsSync(d))
    const forbidden = /from\s+['"][^'"]*(lib\/dsl|lib\/blockly|lib\/sim\/interpreter|lib\/spike|\.\.\/dsl|\.\.\/blockly|\.\.\/sim\/)/
    for (const root of roots)
      for (const file of fs.readdirSync(root)) {
        const src = fs.readFileSync(path.join(root, file), 'utf8')
        expect(forbidden.test(src), `${root}/${file}`).toBe(false)
      }
  })
})

/** Words in a text (for the "short sentences for under-10s" rule). */
const words = (s: string) => s.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length

describe.each(files.filter((f) => f.startsWith('wedo-')))('WeDo lesson %s', (file) => {
  const lesson = readLesson(file.replace('.json', ''))!

  it('lives in a WeDo track and uses only WeDo-friendly step types', () => {
    expect(familyOf(lesson.track)).toBe('wedo')
    for (const s of lesson.steps) {
      expect(WEDO_STEP_TYPES as readonly string[], `${s.id}: ${s.type}`).toContain(s.type)
      if (s.type === 'real_robot') expect(s.program, `${s.id}: no SPIKE .llsp3 in WeDo`).toBeUndefined()
    }
  })

  it('fits learners under 10: 3–7 minutes, 3–6 steps, short theory, simple quizzes, something to do', () => {
    expect(lesson.minutes).toBeGreaterThanOrEqual(3)
    expect(lesson.minutes).toBeLessThanOrEqual(7)
    expect(lesson.steps.length).toBeGreaterThanOrEqual(3)
    expect(lesson.steps.length).toBeLessThanOrEqual(6)
    for (const s of lesson.steps) {
      if (s.type === 'theory') expect(words(s.body.ru), `${s.id}: theory too long`).toBeLessThanOrEqual(60)
      if (s.type === 'quiz') {
        expect(['choice', 'match', 'order'], `${s.id}: ${s.kind}`).toContain(s.kind)
        if (s.kind === 'choice') expect(s.options.length, s.id).toBeLessThanOrEqual(3)
      }
    }
    const handsOn = lesson.steps.some((s) => s.type === 'wedo_code' || s.type === 'wedo_predict' || s.type === 'widget' || s.type === 'quiz')
    expect(handsOn).toBe(true)
  })

  it('reference solutions pass every check; debug starters fail; palettes cover the programs', () => {
    for (const step of lesson.steps) {
      if (step.type !== 'wedo_code') continue
      const report = runWedoChecks(step.reference, step.scene, step.checks, 'ru', step.scenario)
      expect(report.results.filter((r) => !r.ok).map((r) => `${step.id}: ${r.type} ${r.message}`)).toEqual([])
      const starter = runWedoChecks(step.start, step.scene, step.checks, 'ru', step.scenario).ok
      if (step.mode === 'debug') {
        expect(step.start.length, `${step.id}: a debug task starts with a program`).toBeGreaterThan(0)
        expect(starter, `${step.id} starter must fail`).toBe(false)
      }
      if (step.mode !== 'debug' && step.start.length) expect(starter, `${step.id} starter already passes`).toBe(false)
      const ops = new Set<string>()
      const walk = (l: WedoStep[]): void => l.forEach((s) => (ops.add(s.op), s.op === 'repeat' && walk(s.steps)))
      walk(step.reference)
      walk(step.start)
      for (const op of ops) expect(step.palette, `${step.id}: ${op} missing from the palette`).toContain(op)
      expect(wedoBlocks(step.reference)).toBeLessThanOrEqual(WEDO_LIMITS.maxBlocks)
    }
  })

  it('predictions: the simulation confirms the correct answer and rules out the others', () => {
    for (const step of lesson.steps) {
      if (step.type !== 'wedo_predict') continue
      step.options.forEach((o, i) => {
        const ok = runWedoChecks(step.program, step.scene, o.expect, 'ru', step.scenario).ok
        expect(ok, `${step.id} option ${i}`).toBe(i === step.correct)
      })
    }
  })
})

describe('SPIKE lessons', () => {
  it('never use WeDo steps', () => {
    for (const file of files.filter((f) => !f.startsWith('wedo-'))) {
      const lesson = readLesson(file.replace('.json', ''))!
      expect(familyOf(lesson.track), file).not.toBe('wedo')
      for (const s of lesson.steps) expect(s.type.startsWith('wedo_'), `${file}/${s.id}`).toBe(false)
    }
  })
})
