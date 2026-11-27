/**
 * zod schemas of WeDo 2.0 programs, scenes, scenarios and checks. Numbers
 * are clamped into the ranges of the real blocks instead of rejected, so a
 * program from the editor or a lesson file is always runnable; the shape
 * itself is strict (unknown blocks and fields are rejected).
 */

import { z } from 'zod'

import { MOTION_EVENTS, TILT_STATES, WEDO_COLORS, WEDO_LIMITS, WEDO_OPS, type WedoScene, type WedoStep, wedoBlocks } from './types'

const localized = z.object({ ru: z.string().min(1), kk: z.string().min(1), en: z.string().min(1) })

const clamp = (min: number, max: number, step = 0) =>
  z
    .number()
    .refine(Number.isFinite, 'not a number')
    .transform((v) => {
      const c = Math.min(max, Math.max(min, v))
      return step ? Math.round(c / step) * step : c
    })
    .transform((v) => Math.round(v * 10) / 10)

const seconds = clamp(WEDO_LIMITS.seconds.min, WEDO_LIMITS.seconds.max, 0.1)
const int = (min: number, max: number) => clamp(min, max, 1)

const leaf = z.discriminatedUnion('op', [
  z.strictObject({ op: z.literal('motor_on_for'), seconds }),
  z.strictObject({ op: z.literal('motor_on') }),
  z.strictObject({ op: z.literal('motor_off') }),
  z.strictObject({ op: z.literal('motor_power'), power: int(WEDO_LIMITS.power.min, WEDO_LIMITS.power.max) }),
  z.strictObject({ op: z.literal('motor_direction'), dir: z.enum(['this', 'that']) }),
  z.strictObject({ op: z.literal('light'), color: z.enum(WEDO_COLORS) }),
  z.strictObject({ op: z.literal('sound'), sound: int(WEDO_LIMITS.sound.min, WEDO_LIMITS.sound.max) }),
  z.strictObject({
    op: z.literal('display'),
    kind: z.enum(['text', 'number']),
    value: z
      .union([z.string(), z.number()])
      .transform((v) => String(v).slice(0, WEDO_LIMITS.displayChars))
      .pipe(z.string().min(1)),
  }),
  z.strictObject({ op: z.literal('wait'), seconds }),
  z.strictObject({ op: z.literal('wait_motion'), event: z.enum(MOTION_EVENTS) }),
  z.strictObject({ op: z.literal('wait_tilt'), state: z.enum(TILT_STATES) }),
])

const times = z.union([z.literal('forever'), int(WEDO_LIMITS.times.min, WEDO_LIMITS.times.max)])
/** Repeats nest at most twice: a repeat inside a repeat holds plain blocks only. */
const innerRepeat = z.strictObject({ op: z.literal('repeat'), times, steps: z.array(leaf) })
const outerRepeat = z.strictObject({ op: z.literal('repeat'), times, steps: z.array(z.union([leaf, innerRepeat])) })

export const wedoProgramSchema = z
  .array(z.union([leaf, outerRepeat]))
  .transform((steps) => steps as WedoStep[])
  .refine((steps) => wedoBlocks(steps) <= WEDO_LIMITS.maxBlocks, `at most ${WEDO_LIMITS.maxBlocks} blocks`)

export type ParseResult = { ok: true; value: WedoStep[] } | { ok: false; error: string }

/** Validates a program (lesson file, editor, saved state). */
export function parseWedoProgram(raw: unknown): ParseResult {
  const r = wedoProgramSchema.safeParse(raw)
  if (r.success) return { ok: true, value: r.data }
  return { ok: false, error: r.error.issues.map((i) => `${i.path.join('.') || 'program'}: ${i.message}`).join('; ') }
}

// ── Scenes and scenarios ────────────────────────────────────────────────

const id = z.string().regex(/^[a-z0-9-]+$/)
const sensor = z.enum(['motion', 'tilt'])

export const wedoSceneSchema = z
  .discriminatedUnion('model', [
    z.strictObject({
      model: z.literal('rover'),
      length: z.number().min(600).max(3000),
      start: z.number().nonnegative(),
      sensor: sensor.optional(),
      zones: z.array(z.strictObject({ id, from: z.number().nonnegative(), to: z.number().positive(), label: localized.optional() })).max(5),
      obstacles: z.array(z.strictObject({ id, at: z.number().positive(), label: localized.optional() })).max(3),
    }),
    z.strictObject({ model: z.literal('spinner'), ratio: z.number().min(0.1).max(5), sensor: sensor.optional() }),
    z.strictObject({ model: z.literal('lift'), levels: z.number().int().min(1).max(4), mmPerTurn: z.number().min(1).max(20), sensor: sensor.optional() }),
    z.strictObject({ model: z.literal('gate'), sensor: z.literal('motion') }),
  ])
  .superRefine((s, ctx) => {
    if (s.model !== 'rover') return
    for (const zn of s.zones) if (zn.from >= zn.to || zn.to > s.length) ctx.addIssue({ code: 'custom', message: `zone ${zn.id} is outside the track` })
    for (const o of s.obstacles) if (o.at > s.length) ctx.addIssue({ code: 'custom', message: `obstacle ${o.id} is outside the track` })
  })
  .transform((s) => s as WedoScene)

export const scenarioSchema = z
  .array(z.union([z.strictObject({ at: z.number().min(0).max(30), motion: z.enum(['near', 'far']) }), z.strictObject({ at: z.number().min(0).max(30), tilt: z.enum(TILT_STATES) })]))
  .max(10)

// ── Checks (lib/wedo/checks.ts) ─────────────────────────────────────────

export const REACT_ACTIONS = ['motorStart', 'motorStop', 'light', 'sound'] as const

export const wedoCheckSchema = z.discriminatedUnion('type', [
  /** The motor ran (in `direction`, for at least `minSeconds` in total). */
  z.strictObject({ type: z.literal('motorRan'), direction: z.enum(['this', 'that']).optional(), minSeconds: z.number().positive().optional() }),
  /** The motor ran `seconds` in total, give or take `tolerance`. */
  z.strictObject({ type: z.literal('motorTime'), seconds: z.number().positive(), tolerance: z.number().positive().default(0.3) }),
  z.strictObject({ type: z.literal('roverInZone'), zone: id }),
  z.strictObject({ type: z.literal('passZones'), zones: z.array(id).min(1), ordered: z.boolean().default(true) }),
  /** Stopped in front of an obstacle, closer than `maxMm`, without touching it. */
  z.strictObject({ type: z.literal('stopBeforeObstacle'), maxMm: z.number().positive().default(100) }),
  z.strictObject({ type: z.literal('noCrash') }),
  z.strictObject({ type: z.literal('returnedToStart'), toleranceMm: z.number().positive().default(50) }),
  z.strictObject({ type: z.literal('spinnerTurns'), minTurns: z.number().positive(), direction: z.enum(['this', 'that']).optional() }),
  z.strictObject({ type: z.literal('liftAt'), level: z.number().int().nonnegative(), toleranceMm: z.number().positive().default(15) }),
  /**
   * After the sensor event (`state`, or any change) something happens within
   * `withinSeconds`, for `times` events of the scenario. Checked twice, the
   * second time with the scenario shifted later, so only a real reaction passes.
   */
  z.strictObject({
    type: z.literal('reactsTo'),
    sensor,
    state: z.union([z.enum(['near', 'far']), z.enum(TILT_STATES)]).optional(),
    action: z.enum(REACT_ACTIONS),
    color: z.enum(WEDO_COLORS).optional(),
    withinSeconds: z.number().positive().default(1),
    times: z.number().int().positive().default(1),
  }),
  z.strictObject({ type: z.literal('light'), color: z.enum(WEDO_COLORS) }),
  z.strictObject({ type: z.literal('sound'), min: z.number().int().positive().default(1) }),
  /** The screen showed this text; a localized text accepts the word in any of the three languages. */
  z.strictObject({
    type: z.literal('displayed'),
    text: z.union([
      z.string().min(1).max(WEDO_LIMITS.displayChars),
      z.object({
        ru: z.string().min(1).max(WEDO_LIMITS.displayChars),
        kk: z.string().min(1).max(WEDO_LIMITS.displayChars),
        en: z.string().min(1).max(WEDO_LIMITS.displayChars),
      }),
    ]),
  }),
  z.strictObject({ type: z.literal('usesBlock'), op: z.enum(WEDO_OPS), min: z.number().int().positive().default(1) }),
  z.strictObject({ type: z.literal('maxBlocks'), max: z.number().int().positive() }),
])
export type WedoCheck = z.infer<typeof wedoCheckSchema>
export type WedoScenario = z.infer<typeof scenarioSchema>

/** Checks that make no sense for the scene (unknown zones and levels, rover checks on a crane…). */
export function wedoCheckIssues(scene: WedoScene, checks: WedoCheck[], scenario: WedoScenario | undefined): string[] {
  const issues: string[] = []
  const zoneIds = new Set(scene.model === 'rover' ? scene.zones.map((z) => z.id) : [])
  const need = (model: WedoScene['model'], what: string) => scene.model !== model && issues.push(`${what} needs a ${model} scene`)
  for (const c of checks) {
    if (c.type === 'roverInZone' || c.type === 'passZones') {
      need('rover', c.type)
      for (const z of c.type === 'roverInZone' ? [c.zone] : c.zones) if (!zoneIds.has(z)) issues.push(`unknown zone ${z}`)
    }
    if (c.type === 'stopBeforeObstacle') {
      need('rover', c.type)
      if (scene.model === 'rover' && !scene.obstacles.length) issues.push('stopBeforeObstacle without obstacles')
    }
    if (c.type === 'returnedToStart' || c.type === 'noCrash') need('rover', c.type)
    if (c.type === 'spinnerTurns') need('spinner', c.type)
    if (c.type === 'liftAt') {
      need('lift', c.type)
      if (scene.model === 'lift' && c.level > scene.levels) issues.push(`unknown level ${c.level}`)
    }
    if (c.type === 'reactsTo') {
      if (scene.sensor !== c.sensor) issues.push(`reactsTo ${c.sensor} without that sensor in the scene`)
      const scripted = (scenario ?? []).filter((e) => (c.sensor === 'motion' ? 'motion' in e : 'tilt' in e))
      if (!scripted.length) issues.push(`reactsTo ${c.sensor} needs scenario events`)
    }
  }
  return issues
}
