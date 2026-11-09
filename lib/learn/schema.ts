/**
 * Course content schema. Lessons are data (content/learn/**.json): a new
 * lesson needs no code. Hierarchy: track → unit → lesson → steps.
 * Every text exists in kk, ru and en.
 */

import { z } from 'zod'

import { STEP_OPS, parseProgram } from '../dsl/schema'
import type { Step } from '../dsl/types'
import { fieldSchema } from '../sim/field'
import { SKILLS } from './skills'

export const LANGS = ['ru', 'kk', 'en'] as const
export const localized = z.object({ ru: z.string().min(1), kk: z.string().min(1), en: z.string().min(1) })
export type Localized = z.infer<typeof localized>

export { SKILLS, type Skill } from './skills'

/** Built-in illustrations (components/learn/illustrations.tsx) — our own drawings, no LEGO artwork. */
export const ILLUSTRATIONS = ['robot-parts', 'hub', 'motor', 'sensors', 'app-steps', 'units', 'turn', 'sequence', 'speed', 'debug', 'square'] as const

/** DSL steps validated exactly like programs from the AI. */
export const dslSteps = z.array(z.unknown()).transform((raw, ctx): Step[] => {
  // An empty editor is a valid start; programs from the AI need at least one step, lessons do not.
  if (raw.length === 0) return []
  const r = parseProgram({ title: 'lesson', description: '', steps: raw })
  if (!r.ok) {
    ctx.addIssue({ code: 'custom', message: `invalid DSL steps: ${r.error}` })
    return z.NEVER
  }
  return r.value.steps
})

const op = z.enum(STEP_OPS)
const sensor = z.enum(['distance', 'color', 'reflection', 'force', 'button'])

// ── Automatic checks (lib/learn/checks.ts) ──────────────────────────────

export const checkSchema = z.discriminatedUnion('type', [
  /** The robot finished inside a target zone. */
  z.object({ type: z.literal('finishInZone'), zone: z.string() }),
  /** The robot's centre passed through these points (in order by default). */
  z.object({ type: z.literal('passPoints'), points: z.array(z.string()).min(1), ordered: z.boolean().default(true) }),
  z.object({ type: z.literal('noCollision') }),
  z.object({ type: z.literal('timeLimit'), seconds: z.number().positive() }),
  /** The program uses a block at least `min` times (e.g. a loop). */
  z.object({ type: z.literal('usesOp'), op, min: z.number().int().positive().default(1) }),
  z.object({ type: z.literal('maxBlocks'), max: z.number().int().positive() }),
  z.object({ type: z.literal('usesSensor'), sensor }),
  z.object({ type: z.literal('displayed'), image: z.string().optional() }),
  z.object({ type: z.literal('beeped'), min: z.number().int().positive().default(1) }),
  z.object({ type: z.literal('motorTurned'), port: z.enum(['A', 'B', 'C', 'D', 'E', 'F']), degrees: z.number(), tolerance: z.number().positive().default(5) }),
  z.object({ type: z.literal('heading'), degrees: z.number(), tolerance: z.number().positive().default(5) }),
  /** A pause of at least `seconds` while the robot stands in the zone. */
  z.object({ type: z.literal('waitInZone'), zone: z.string(), seconds: z.number().positive() }),
  /** Stopped in front of a wall, closer than `maxMm`, without touching it. */
  z.object({ type: z.literal('stopBeforeWall'), maxMm: z.number().positive() }),
  z.object({ type: z.literal('moved'), minMm: z.number().positive() }),
])
export type Check = z.infer<typeof checkSchema>

// ── Steps ───────────────────────────────────────────────────────────────

const base = { id: z.string().regex(/^[a-z0-9-]+$/) }

const theory = z.object({
  ...base,
  type: z.literal('theory'),
  title: localized,
  /** Short text (≈ 120 words). Paragraphs are separated by a blank line; **bold** is allowed. */
  body: localized,
  illustration: z.enum(ILLUSTRATIONS).optional(),
  /** An example program shown as blocks. */
  example: dslSteps.optional(),
})

const quizBase = { ...base, type: z.literal('quiz'), question: localized, explanation: localized, skill: z.enum(SKILLS).optional() }
const quiz = z.discriminatedUnion('kind', [
  z.object({ ...quizBase, kind: z.literal('choice'), options: z.array(localized).min(2).max(6), correct: z.array(z.number().int().nonnegative()).min(1) }),
  /** Put in order: `items` are listed in the correct order and shuffled on screen. */
  z.object({ ...quizBase, kind: z.literal('order'), items: z.array(localized).min(3).max(6) }),
  z.object({ ...quizBase, kind: z.literal('match'), pairs: z.array(z.object({ left: localized, right: localized })).min(2).max(5) }),
  z.object({ ...quizBase, kind: z.literal('number'), answer: z.number(), tolerance: z.number().nonnegative().default(0), unit: localized.optional() }),
])

const codeBase = {
  ...base,
  title: localized,
  task: localized,
  field: fieldSchema,
  /** Blocks available in the editor. */
  toolbox: z.array(op).min(1),
  /** Program the editor starts with (for "debug": the program with the mistake). */
  start: dslSteps.default([]),
  checks: z.array(checkSchema).min(1),
  /** Hints from gentle to concrete (the AI mentor adds its own on top). */
  hints: z.array(localized).min(1).max(3),
  /** A correct solution: used by tests and for "fewer blocks than us" achievements. Never sent to the browser. */
  reference: dslSteps.optional(),
  skill: z.enum(SKILLS).optional(),
}

const code = z.object({ ...codeBase, type: z.literal('code') })
const debug = z.object({ ...codeBase, type: z.literal('debug') })
const project = z.object({ ...codeBase, type: z.literal('project') })

/** Weekly challenges (content/learn/challenges.json): code tasks outside lessons; a reference is required. */
export const challengeFileSchema = z.object({ challenges: z.array(code.extend({ reference: dslSteps })).min(1) })

const predict = z.object({
  ...base,
  type: z.literal('predict'),
  title: localized,
  question: localized,
  field: fieldSchema,
  /** The program the learner reads. */
  program: dslSteps,
  /** Candidate programs whose simulated paths are drawn as answers; one equals `program`. */
  options: z.array(z.object({ label: localized, steps: dslSteps })).min(2).max(4),
  correct: z.number().int().nonnegative(),
  explanation: localized,
  skill: z.enum(SKILLS).optional(),
})

const realRobot = z.object({
  ...base,
  type: z.literal('real_robot'),
  title: localized,
  task: localized,
  checklist: z.array(localized).min(1).max(6),
  /** A program to download as .llsp3 for the task. */
  program: dslSteps.optional(),
})

const build = z.object({
  ...base,
  type: z.literal('build'),
  title: localized,
  intro: localized,
  /** LDraw model id once the 3D instructions exist (TODO: LDraw viewer). */
  model: z.string().optional(),
  instructions: z.array(z.object({ text: localized, illustration: z.enum(ILLUSTRATIONS).optional() })).min(1),
})

/** An interactive task with its own automatic check (components/learn/steps/widget-step.tsx). */
const widget = z.object({
  ...base,
  type: z.literal('widget'),
  widget: z.enum(['vibe', 'gesture', 'color', 'few-examples']),
  title: localized,
  task: localized,
})

export const stepSchema = z.union([theory, quiz, code, debug, project, predict, realRobot, build, widget])
export type LessonStep = z.infer<typeof stepSchema>
export type StepType = LessonStep['type']
export type CodeStep = Extract<LessonStep, { type: 'code' | 'debug' | 'project' }>
export type QuizStep = Extract<LessonStep, { type: 'quiz' }>
export type PredictStep = Extract<LessonStep, { type: 'predict' }>

export const lessonSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    track: z.string(),
    unit: z.string(),
    title: localized,
    /** "Today you will teach the robot…" */
    goal: localized,
    /** "Now you can…" */
    summary: localized,
    minutes: z.number().int().min(3).max(15),
    skills: z.array(z.enum(SKILLS)).min(1),
    /** Needs a real SPIKE Prime kit (otherwise everything runs in the simulator). */
    kit: z.boolean().default(false),
    steps: z.array(stepSchema).min(3).max(8),
  })
  .superRefine((lesson, ctx) => {
    const ids = lesson.steps.map((s) => s.id)
    const dupe = ids.find((id, i) => ids.indexOf(id) !== i)
    if (dupe) ctx.addIssue({ code: 'custom', message: `duplicate step id ${dupe}` })
    lesson.steps.forEach((s, i) => {
      if (s.type === 'predict' && s.correct >= s.options.length) ctx.addIssue({ code: 'custom', path: ['steps', i, 'correct'], message: 'correct option out of range' })
      if (s.type === 'quiz' && s.kind === 'choice' && s.correct.some((c) => c >= s.options.length)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'correct'], message: 'correct option out of range' })
      if (s.type === 'code' || s.type === 'debug' || s.type === 'project') {
        const zoneIds = new Set(s.field.zones.map((z) => z.id))
        const pointIds = new Set(s.field.points.map((p) => p.id))
        for (const c of s.checks) {
          if ((c.type === 'finishInZone' || c.type === 'waitInZone') && !zoneIds.has(c.zone)) ctx.addIssue({ code: 'custom', path: ['steps', i], message: `unknown zone ${c.zone}` })
          if (c.type === 'passPoints') for (const p of c.points) if (!pointIds.has(p)) ctx.addIssue({ code: 'custom', path: ['steps', i], message: `unknown point ${p}` })
        }
      }
    })
  })
export type Lesson = z.infer<typeof lessonSchema>

// ── Course map (content/learn/course.json) ──────────────────────────────

const lessonRef = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  title: localized,
  /** Same as the lesson file's skills (checked in tests); planned lessons get their unit's skills. */
  skills: z.array(z.enum(SKILLS)).min(1),
  /** "ready" lessons have a content file; "todo" are planned. */
  status: z.enum(['ready', 'todo']),
  project: z.boolean().default(false),
  kit: z.boolean().default(false),
})

export const courseSchema = z.object({
  tracks: z.array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      title: localized,
      description: localized,
      icon: z.string(),
      color: z.string(),
      /** Recommended earlier tracks (can be skipped with a check test). */
      prerequisites: z.array(z.string()).default([]),
      units: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]+$/), title: localized, lessons: z.array(lessonRef).min(1) })).min(1),
    }),
  ),
})
export type Course = z.infer<typeof courseSchema>
export type CourseTrack = Course['tracks'][number]
export type CourseUnit = CourseTrack['units'][number]
export type LessonRef = CourseUnit['lessons'][number]
