/**
 * The learner's state: a profile and an append-only event log, kept in this
 * browser until accounts exist. Everything else (XP, streak, skills,
 * achievements) is computed from the events, so replays are idempotent:
 * an event id that already exists is ignored.
 */

// zod/mini: this module runs in every learner page; the full zod build is several times larger.
import * as z from 'zod/mini'

import { SKILLS } from './skills'

export const AGE_RANGES = ['under-10', '10-12', '13-15', '16-plus'] as const
export const LEARNING_PATHS = ['wedo', 'spike'] as const
export type LearningPathChoice = (typeof LEARNING_PATHS)[number]
export const GAMES = ['maze', 'puzzle', 'memory', 'blitz'] as const
export type GameId = (typeof GAMES)[number]

export const DEFAULT_COSMETICS = { color: 'sun', sticker: 'none', wheels: 'classic', sound: 'beep', hat: 'none', eyes: 'round' }
export type AgeRange = (typeof AGE_RANGES)[number]

export const profileSchema = z.object({
  nickname: z.string().check(z.trim(), z.minLength(1), z.maxLength(24)),
  ageRange: z.enum(AGE_RANGES),
  timezone: z.string().check(z.minLength(1)),
  /** Daily goal: number of lessons, or minutes of practice. */
  goal: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('lessons'), n: z.union([z.literal(1), z.literal(2)]) }),
    z.object({ kind: z.literal('minutes'), n: z.literal(15) }),
  ]),
  skipWeekends: z._default(z.boolean(), false),
  reminders: z._default(z.object({ enabled: z.boolean(), time: z.string().check(z.regex(/^\d{2}:\d{2}$/)) }), { enabled: false, time: '18:00' }),
  cosmetics: z._default(
    z.object({
      color: z._default(z.string(), 'sun'),
      sticker: z._default(z.string(), 'none'),
      wheels: z._default(z.string(), 'classic'),
      sound: z._default(z.string(), 'beep'),
      hat: z._default(z.string(), 'none'),
      eyes: z._default(z.string(), 'round'),
    }),
    DEFAULT_COSMETICS,
  ),
  /** The learner's robot buddy: which robot and its name (lib/learn/shop.ts). */
  buddy: z._default(z.object({ model: z._default(z.string(), 'rover'), name: z._default(z.string().check(z.maxLength(16)), '') }), {
    model: 'rover',
    name: '',
  }),
  /** Grown-up confirmed for under-16 learners (see docs/privacy.md). */
  parentConsent: z._default(z.boolean(), false),
  createdAt: z.number(),
  /** Anonymous id for A/B buckets and, later, linking to an account. */
  anonId: z.string().check(z.minLength(8)),
  tour: z._default(z.boolean(), false),
  /** The chosen path: LEGO WeDo 2.0 first (then SPIKE Prime), or straight to SPIKE Prime; null until chosen. */
  learningPath: z._default(z.nullable(z.enum(LEARNING_PATHS)), null),
})
export type Profile = z.infer<typeof profileSchema>

const skill = z.enum(SKILLS)

export const eventSchema = z.discriminatedUnion('kind', [
  /** A step finished. `firstTry`: solved without failed checks or hints. `program`: the solution of a code step. */
  z.object({
    id: z.string(),
    at: z.number(),
    kind: z.literal('step_done'),
    lesson: z.string(),
    step: z.string(),
    stepType: z.string(),
    firstTry: z.boolean(),
    hints: z.int().check(z.nonnegative()),
    blocks: z.optional(z.number()),
    referenceBlocks: z.optional(z.number()),
    skill: z.optional(skill),
    program: z.optional(z.array(z.unknown())),
  }),
  /** A failed check or a wrong answer (feeds review and the "where students get stuck" stats). */
  z.object({ id: z.string(), at: z.number(), kind: z.literal('mistake'), lesson: z.string(), step: z.string(), skill: z.optional(skill) }),
  z.object({
    id: z.string(),
    at: z.number(),
    kind: z.literal('lesson_done'),
    lesson: z.string(),
    track: z.string(),
    unit: z.string(),
    project: z.boolean(),
    seconds: z.number().check(z.nonnegative()),
  }),
  z.object({ id: z.string(), at: z.number(), kind: z.literal('real_robot'), lesson: z.string(), step: z.string() }),
  /** Active practice time (for the "15 minutes a day" goal). */
  z.object({ id: z.string(), at: z.number(), kind: z.literal('time'), seconds: z.number().check(z.nonnegative()) }),
  /** A lesson was opened and started (lesson funnel: started → steps → finished). */
  z.object({ id: z.string(), at: z.number(), kind: z.literal('lesson_start'), lesson: z.string() }),
  /** Lessons and units marked as known (placement or "I know this" test). */
  z.object({
    id: z.string(),
    at: z.number(),
    kind: z.literal('known'),
    lessons: z.array(z.string()),
    skills: z.array(skill),
    source: z.optional(z.enum(['placement', 'unit'])),
  }),
  z.object({ id: z.string(), at: z.number(), kind: z.literal('review_done'), skills: z.array(skill), correct: z.int(), total: z.int() }),
  z.object({ id: z.string(), at: z.number(), kind: z.literal('challenge_done'), week: z.string(), challenge: z.optional(z.string()) }),
  z.object({ id: z.string(), at: z.number(), kind: z.literal('certificate'), track: z.string(), code: z.string() }),
  z.object({ id: z.string(), at: z.number(), kind: z.literal('achievement'), achievement: z.string() }),
  /** A round of a practice game (lib/learn/games). `level` is 0 for games without levels. */
  z.object({
    id: z.string(),
    at: z.number(),
    kind: z.literal('game_done'),
    game: z.enum(GAMES),
    level: z.int().check(z.nonnegative()),
    stars: z.int().check(z.gte(0), z.lte(3)),
    score: z.int().check(z.nonnegative()),
  }),
  /** Bought in the garage with coins (lib/learn/economy.ts checks the balance). */
  z.object({ id: z.string(), at: z.number(), kind: z.literal('purchase'), item: z.string().check(z.minLength(1), z.maxLength(40)) }),
])
export type LearnEvent = z.infer<typeof eventSchema>
export type EventKind = LearnEvent['kind']

export const stateSchema = z.object({
  version: z.literal(1),
  profile: z.nullable(profileSchema),
  events: z.array(eventSchema),
})
export type LearnState = z.infer<typeof stateSchema>

export const EMPTY_STATE: LearnState = { version: 1, profile: null, events: [] }

/** Distributes Omit over the union, so each event kind keeps its own fields. */
export type NewEvent = LearnEvent extends infer E ? (E extends LearnEvent ? Omit<E, 'id' | 'at'> & { id?: string; at?: number } : never) : never

export function randomId(prefix = 'e'): string {
  const bytes = new Uint8Array(8)
  globalThis.crypto.getRandomValues(bytes)
  return `${prefix}_${Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')}`
}

/**
 * Stable ids make the "earn once" events idempotent: completing a lesson
 * twice is still one `lesson_done`.
 */
export function eventId(e: NewEvent): string {
  switch (e.kind) {
    case 'step_done':
      return `step:${e.lesson}:${e.step}`
    case 'lesson_done':
      return `lesson:${e.lesson}`
    case 'real_robot':
      return `robot:${e.lesson}:${e.step}`
    case 'challenge_done':
      return `challenge:${e.week}`
    case 'certificate':
      return `cert:${e.track}`
    case 'achievement':
      return `ach:${e.achievement}`
    case 'purchase':
      return `buy:${e.item}`
    default:
      return randomId(e.kind)
  }
}

/** Appends events; ids that already exist are ignored (idempotent). */
export function appendEvents(state: LearnState, events: NewEvent[], now = Date.now()): LearnState {
  const seen = new Set(state.events.map((e) => e.id))
  const added: LearnEvent[] = []
  for (const e of events) {
    const id = e.id ?? eventId(e)
    if (seen.has(id)) continue
    seen.add(id)
    added.push({ ...e, id, at: e.at ?? now } as LearnEvent)
  }
  return added.length ? { ...state, events: [...state.events, ...added] } : state
}

export function parseState(raw: unknown): LearnState {
  const r = stateSchema.safeParse(raw)
  return r.success ? r.data : EMPTY_STATE
}

export function completedLessons(state: LearnState): Set<string> {
  const done = new Set<string>()
  for (const e of state.events) {
    if (e.kind === 'lesson_done') done.add(e.lesson)
    if (e.kind === 'known') e.lessons.forEach((l) => done.add(l))
  }
  return done
}

export function doneSteps(state: LearnState, lesson: string): Set<string> {
  return new Set(state.events.filter((e) => e.kind === 'step_done' && e.lesson === lesson).map((e) => (e.kind === 'step_done' ? e.step : '')))
}
