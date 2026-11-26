/**
 * Course content schema. Lessons are data (content/learn/**.json): a new
 * lesson needs no code. Hierarchy: track → unit → lesson → steps.
 * Every text exists in kk, ru and en.
 */

import { z } from 'zod'

import { STEP_OPS, parseProgram } from '../dsl/schema'
import type { ProgramFunction, Step } from '../dsl/types'
import { fieldSchema } from '../sim/field'
import { ROBO_ILLUSTRATIONS } from './illustration-names'
import { SKILLS } from './skills'

export const LANGS = ['ru', 'kk', 'en'] as const
export const localized = z.object({ ru: z.string().min(1), kk: z.string().min(1), en: z.string().min(1) })
export type Localized = z.infer<typeof localized>

export { SKILLS, type Skill } from './skills'

/** Built-in illustrations (components/learn/illustrations.tsx) — our own drawings, no LEGO artwork. */
export const ILLUSTRATIONS = [
  'robot-parts',
  'hub',
  'motor',
  'sensors',
  'app-steps',
  'units',
  'turn',
  'sequence',
  'speed',
  'debug',
  'square',
  // "AI from zero" (components/learn/ai-illustrations.tsx)
  'ai-rules',
  'ai-data',
  'ai-guess',
  'ai-text',
  'ai-media',
  'ai-choose',
  'ai-prompt',
  'ai-check',
  'ai-honest',
  'ai-vibe',
  'ai-game',
  'ai-steps',
  'ai-study',
  'ai-idea',
  'ai-deepfake',
  'ai-gesture',
  'ai-color',
  'ai-few',
  // Robotics tracks (components/learn/robo-illustrations.tsx)
  ...ROBO_ILLUSTRATIONS,
] as const

/** Names used by "call" anywhere in raw (not yet validated) steps. */
function rawCalls(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.flatMap(rawCalls)
  if (typeof raw !== 'object' || raw === null) return []
  const o = raw as Record<string, unknown>
  const own = o.op === 'call' && typeof o.name === 'string' ? [o.name] : []
  return [...own, ...rawCalls(o.steps), ...rawCalls(o.then), ...rawCalls(o.else)]
}

/**
 * DSL steps validated exactly like programs from the AI. Calls of "My Blocks"
 * are checked against the step's own functions in the lesson refinement below.
 */
export const dslSteps = z.array(z.unknown()).transform((raw, ctx): Step[] => {
  // An empty editor is a valid start; programs from the AI need at least one step, lessons do not.
  if (raw.length === 0) return []
  const stubs = [...new Set(rawCalls(raw))].map((name) => ({ name, steps: [{ op: 'wait', seconds: 0 }] }))
  // An own block may use variables the main program sets: give them a value here, drop it after.
  const unset = rawVariables(raw).filter((name) => !rawAssigned(raw).includes(name))
  const pre = unset.map((name) => ({ op: 'set_var', name, expr: { num: 0 } }))
  const r = parseProgram({ title: 'lesson', description: '', steps: [...pre, ...raw], ...(stubs.length ? { functions: stubs } : {}) })
  if (!r.ok) {
    ctx.addIssue({ code: 'custom', message: `invalid DSL steps: ${r.error}` })
    return z.NEVER
  }
  return r.value.steps.slice(pre.length)
})

/** Variable names read anywhere in raw steps ({var}, var conditions, change/write). */
function rawVariables(raw: unknown): string[] {
  if (Array.isArray(raw)) return [...new Set(raw.flatMap(rawVariables))]
  if (typeof raw !== 'object' || raw === null) return []
  const o = raw as Record<string, unknown>
  const own: string[] = []
  if (typeof o.var === 'string') own.push(o.var)
  if (o.sensor === 'var' && typeof o.name === 'string') own.push(o.name)
  if ((o.op === 'change_var' || o.op === 'write_var') && typeof o.name === 'string') own.push(o.name)
  return [...new Set([...own, ...Object.values(o).flatMap(rawVariables)])]
}

function rawAssigned(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.flatMap(rawAssigned)
  if (typeof raw !== 'object' || raw === null) return []
  const o = raw as Record<string, unknown>
  return [...(o.op === 'set_var' && typeof o.name === 'string' ? [o.name] : []), ...rawAssigned(o.steps), ...rawAssigned(o.then), ...rawAssigned(o.else)]
}

/** "My Blocks" of a program: a name and its steps. */
export const dslFunctions = z
  .array(z.object({ name: z.string().regex(/^[A-Za-z_][A-Za-z0-9_]{0,19}$/), steps: dslSteps }))
  .min(1)
  .max(6)

/** Steps and own blocks must be valid together: every call has its block, no recursion. */
function programIssue(steps: Step[], functions: ProgramFunction[] | undefined): string | null {
  if (!steps.length && !functions?.length) return null
  const r = parseProgram({ title: 'lesson', description: '', steps: steps.length ? steps : [{ op: 'wait', seconds: 0 }], functions })
  return r.ok ? null : r.error
}

const op = z.enum(STEP_OPS)
const sensor = z.enum(['distance', 'color', 'reflection', 'force', 'button', 'gyro'])

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
  /** Something on the hub screen: a named image, or this exact text (e.g. a counter). */
  z.object({ type: z.literal('displayed'), image: z.string().optional(), text: z.string().optional() }),
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
  /** An example in Python (the Python track), shown highlighted next to the text. */
  code: z.string().min(1).max(1200).optional(),
})

const quizBase = { ...base, type: z.literal('quiz'), question: localized, explanation: localized, skill: z.enum(SKILLS).optional() }
const quiz = z.discriminatedUnion('kind', [
  z.object({ ...quizBase, kind: z.literal('choice'), options: z.array(localized).min(2).max(6), correct: z.array(z.number().int().nonnegative()).min(1) }),
  /** Put in order: `items` are listed in the correct order and shuffled on screen. */
  z.object({ ...quizBase, kind: z.literal('order'), items: z.array(localized).min(3).max(6) }),
  z.object({
    ...quizBase,
    kind: z.literal('match'),
    pairs: z
      .array(z.object({ left: localized, right: localized }))
      .min(2)
      .max(5),
  }),
  z.object({ ...quizBase, kind: z.literal('number'), answer: z.number(), tolerance: z.number().nonnegative().default(0), unit: localized.optional() }),
  /** Fill the gaps in code: `code` marks gap i as [[i]]; each gap takes one of its options. */
  z.object({
    ...quizBase,
    kind: z.literal('fill'),
    code: z.string().min(1).max(800),
    blanks: z
      .array(z.object({ options: z.array(z.string().min(1)).min(2).max(5), correct: z.number().int().nonnegative() }))
      .min(1)
      .max(4),
  }),
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
  /** "My Blocks" the starting program already has. */
  startFunctions: dslFunctions.optional(),
  checks: z.array(checkSchema).min(1),
  /** Hints from gentle to concrete (the AI mentor adds its own on top). */
  hints: z.array(localized).min(1).max(3),
  /** A correct solution: used by tests and for "fewer blocks than us" achievements. Never sent to the browser. */
  reference: dslSteps.optional(),
  /** "My Blocks" of the reference solution (never sent to the browser either). */
  referenceFunctions: dslFunctions.optional(),
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
  options: z
    .array(z.object({ label: localized, steps: dslSteps }))
    .min(2)
    .max(4),
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

/**
 * An interactive task with its own automatic check (components/learn/steps/widget-step.tsx,
 * robotics ones in robo-widgets.tsx). Robotics widgets take their numbers from the lesson.
 */
const widgetBase = { ...base, type: z.literal('widget'), title: localized, task: localized }
const mission = z.object({ name: localized, points: z.number().int().positive(), seconds: z.number().int().positive() })
const widget = z.discriminatedUnion('widget', [
  z.object({ ...widgetBase, widget: z.enum(['vibe', 'gesture', 'color', 'few-examples']) }),
  /** Pick the driving and the driven gear so the output turns `ratio` times slower or faster. */
  z.object({ ...widgetBase, widget: z.literal('gears'), goal: z.enum(['slower', 'faster']), ratio: z.number().positive() }),
  /** Pick a wheel and a number of rotations so the robot drives `targetCm`. */
  z.object({ ...widgetBase, widget: z.literal('wheel'), targetCm: z.number().positive(), toleranceCm: z.number().positive().default(1) }),
  /** Tune a regulator until the robot settles on the line smoothly. */
  z.object({ ...widgetBase, widget: z.literal('pid'), mode: z.enum(['onoff', 'p', 'pd', 'pid']) }),
  /** Five runs with real-world error: choose speed and gyro so every run lands in the target. */
  z.object({ ...widgetBase, widget: z.literal('scatter'), distanceCm: z.number().positive() }),
  /** Choose missions for one match: at least `target` points within `seconds`. */
  z.object({
    ...widgetBase,
    widget: z.literal('strategy'),
    seconds: z.number().int().positive(),
    target: z.number().int().positive(),
    missions: z.array(mission).min(3).max(8),
  }),
  /** Move the fulcrum so the motor can lift the load. */
  z.object({ ...widgetBase, widget: z.literal('lever') }),
  /** Brace a frame with beams so it stops wobbling when pushed. */
  z.object({ ...widgetBase, widget: z.literal('brace') }),
  /** Pick the lane spacing of a zigzag search so the sensor sees everything without wasted lanes. */
  z.object({ ...widgetBase, widget: z.literal('sweep'), sensorCm: z.number().int().positive().multipleOf(5) }),
])
export type WidgetKind = z.infer<typeof widget>['widget']

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
      if (s.type === 'predict' && s.correct >= s.options.length)
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'correct'], message: 'correct option out of range' })
      if (s.type === 'quiz' && s.kind === 'choice' && s.correct.some((c) => c >= s.options.length))
        ctx.addIssue({ code: 'custom', path: ['steps', i, 'correct'], message: 'correct option out of range' })
      if (s.type === 'quiz' && s.kind === 'fill')
        s.blanks.forEach((b, j) => {
          if (b.correct >= b.options.length) ctx.addIssue({ code: 'custom', path: ['steps', i, 'blanks', j], message: 'correct option out of range' })
          if (!s.code.includes(`[[${j}]]`)) ctx.addIssue({ code: 'custom', path: ['steps', i, 'code'], message: `gap [[${j}]] missing from the code` })
        })
      if (s.type === 'widget' && s.widget === 'strategy') {
        // Best points within the time limit (0/1 knapsack over seconds).
        const best = new Array<number>(s.seconds + 1).fill(0)
        for (const m of s.missions) for (let t = s.seconds; t >= m.seconds; t--) best[t] = Math.max(best[t], best[t - m.seconds] + m.points)
        if (best[s.seconds] < s.target) ctx.addIssue({ code: 'custom', path: ['steps', i], message: 'strategy target is unreachable in time' })
      }
      if (s.type === 'code' || s.type === 'debug' || s.type === 'project') {
        for (const [what, steps, fns] of [
          ['start', s.start, s.startFunctions],
          ['reference', s.reference ?? [], s.referenceFunctions],
        ] as const) {
          const problem = programIssue(steps, fns)
          if (problem) ctx.addIssue({ code: 'custom', path: ['steps', i, what], message: problem })
        }
        const zoneIds = new Set(s.field.zones.map((z) => z.id))
        const pointIds = new Set(s.field.points.map((p) => p.id))
        for (const c of s.checks) {
          if ((c.type === 'finishInZone' || c.type === 'waitInZone') && !zoneIds.has(c.zone))
            ctx.addIssue({ code: 'custom', path: ['steps', i], message: `unknown zone ${c.zone}` })
          if (c.type === 'passPoints')
            for (const p of c.points) if (!pointIds.has(p)) ctx.addIssue({ code: 'custom', path: ['steps', i], message: `unknown point ${p}` })
        }
      }
    })
  })
export type Lesson = z.infer<typeof lessonSchema>

// ── Course map (content/learn/course.json) ──────────────────────────────

export const TRACK_FAMILIES = ['spike', 'wedo', 'general'] as const
export type TrackFamily = (typeof TRACK_FAMILIES)[number]

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
      /** Which kit the track teaches: LEGO SPIKE Prime, LEGO WeDo 2.0, or none (e.g. "AI from zero"). */
      family: z.enum(TRACK_FAMILIES).default('spike'),
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
