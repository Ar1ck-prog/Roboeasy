/**
 * zod schemas for everything that crosses a trust boundary: the AI's JSON,
 * programs sent back by the client (refine, history, share links) and the
 * robot settings.
 *
 * AI output policy: the structure is strict (unknown ops, wrong types or
 * enum values, too deep nesting → validation error, the route retries once
 * with the error text), while numbers are clamped into safe ranges instead
 * of failing, because a retry costs 5–10 s.
 *
 * Gemini also gets a JSON Schema (`responseJsonSchema`). The exact per-op
 * schema is too complex for Gemini (it rejects it with 400 from 3 nesting
 * levels on), so the model receives a compact recursive schema built from the
 * same enum values, and zod does the exact validation.
 */

import { z } from 'zod'

import {
  type Attachment,
  type Condition,
  type Program,
  type RobotProfile,
  type Step,
  ATTACHMENT_KINDS,
  DEFAULT_ROBOT,
  IMAGES,
  LIGHT_COLORS,
  LIMITS,
  PORTS,
  SENSOR_COLORS,
  countSteps,
  toMatrixText,
} from './types'

const keys = <T extends Record<string, unknown>>(o: T) => Object.keys(o) as [keyof T & string, ...(keyof T & string)[]]

// Shared enums: used by the zod validators and by the Gemini schema below.
const port = z.enum(PORTS)
const comparator = z.enum(['<', '>', '='])
const moveDirection = z.enum(['forward', 'back'])
const turnDirection = z.enum(['left', 'right'])
const startDirection = z.enum(['forward', 'back', 'left', 'right'])
const motorDirection = z.enum(['clockwise', 'counterclockwise'])
const positionDirection = z.enum(['shortest', 'clockwise', 'counterclockwise'])
const moveUnit = z.enum(['cm', 'inches', 'rotations', 'degrees', 'seconds'])
const motorUnit = z.enum(['rotations', 'degrees', 'seconds'])
const distanceUnit = z.enum(['cm', 'inches', '%'])
const sensorColor = z.enum(keys(SENSOR_COLORS))
const lightColor = z.enum(keys(LIGHT_COLORS))
const imageName = z.enum(keys(IMAGES))
const forceState = z.enum(['pressed', 'released', 'hardpressed'])
const hubButton = z.enum(['left', 'right'])
const buttonState = z.enum(['pressed', 'released'])

/** A number kept in [min, max]: out-of-range values are clamped, not rejected. */
const num = (min: number, max: number, decimals = 2) => {
  const f = 10 ** decimals
  return z.number().transform((v) => Math.min(max, Math.max(min, Math.round(v * f) / f)))
}

/** Allowed value range per unit for driving and single motors. */
const MOVE_RANGE = { cm: [0.5, 500], inches: [0.2, 200], rotations: [0.05, 50], degrees: [5, 18000], seconds: [0.1, 60] } as const
const MOTOR_RANGE = { rotations: [0.05, 50], degrees: [1, 18000], seconds: [0.1, 60] } as const
const clampTo = (v: number, [min, max]: readonly [number, number]) => Math.min(max, Math.max(min, Math.round(v * 100) / 100))

const cleanText = (max: number) =>
  z.string().transform((s) =>
    s
      .replace(/[\u0000-\u001f\u007f]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, max),
  )

function conditionSchema(robot: RobotProfile): z.ZodType<Condition> {
  return z.discriminatedUnion('sensor', [
    z.object({ sensor: z.literal('distance'), port: port.default(robot.distanceSensor), comparator, value: num(0, 200, 1), unit: distanceUnit }),
    z.object({ sensor: z.literal('color'), port: port.default(robot.colorSensor), color: sensorColor }),
    z.object({ sensor: z.literal('reflection'), port: port.default(robot.colorSensor), comparator, value: num(0, 100, 0) }),
    z.object({ sensor: z.literal('force'), port: port.default(robot.forceSensor), state: forceState }),
    z.object({ sensor: z.literal('button'), button: hubButton, state: buttonState }),
  ])
}

/** Steps allowed at nesting level `depth` (1 = top level); containers stop at LIMITS.maxDepth. */
function stepSchema(depth: number, condition: z.ZodType<Condition>): z.ZodType<Step> {
  const leaf = [
    z
      .object({ op: z.literal('move'), direction: moveDirection, value: z.number(), unit: moveUnit })
      .transform((s) => ({ ...s, value: clampTo(s.value, MOVE_RANGE[s.unit]) })),
    z.object({ op: z.literal('turn'), direction: turnDirection, degrees: num(1, 3600, 0) }),
    z.object({ op: z.literal('reset_yaw') }),
    z.object({ op: z.literal('set_movement_motors'), left: port, right: port }).refine((s) => s.left !== s.right, {
      message: 'left and right drive motors must be on different ports',
    }),
    z
      .object({ op: z.literal('steer'), steering: num(-100, 100, 0), value: z.number(), unit: moveUnit })
      .transform((s) => ({ ...s, value: clampTo(s.value, MOVE_RANGE[s.unit]) })),
    z.object({ op: z.literal('start_move'), direction: startDirection }),
    z.object({ op: z.literal('start_steer'), steering: num(-100, 100, 0) }),
    z.object({ op: z.literal('stop_move') }),
    z.object({ op: z.literal('set_speed'), speed: num(5, 100, 0) }),
    z
      .object({ op: z.literal('motor_run'), port, direction: motorDirection, value: z.number(), unit: motorUnit })
      .transform((s) => ({ ...s, value: clampTo(s.value, MOTOR_RANGE[s.unit]) })),
    z.object({ op: z.literal('motor_start'), port, direction: motorDirection }),
    z.object({ op: z.literal('motor_stop'), port }),
    z.object({ op: z.literal('motor_speed'), port, speed: num(5, 100, 0) }),
    z.object({ op: z.literal('motor_to_position'), port, position: num(0, 359, 0), direction: positionDirection }),
    z.object({
      op: z.literal('show_image'),
      image: z.union([imageName, z.string().regex(/^[0-9]{25}$/, 'image must be a known name or 25 digits 0-9')]),
      seconds: num(0.1, 60).optional(),
    }),
    z.object({
      op: z.literal('write'),
      text: z
        .string()
        .transform((t) => toMatrixText(t).slice(0, LIMITS.maxText))
        .pipe(z.string().min(1, 'text must contain Latin letters or digits')),
    }),
    z.object({ op: z.literal('clear_display') }),
    // The AI often leaves these out when the request is just "beep".
    z.object({ op: z.literal('beep'), note: num(36, 96, 0).default(72), seconds: num(0.05, 10).default(0.2) }),
    z.object({ op: z.literal('button_light'), color: lightColor }),
    z.object({ op: z.literal('wait'), seconds: num(0.05, 300) }),
    z.object({ op: z.literal('wait_until'), condition }),
  ] as const

  if (depth >= LIMITS.maxDepth) return z.discriminatedUnion('op', leaf)

  const child = z.array(stepSchema(depth + 1, condition))
  return z.discriminatedUnion('op', [
    ...leaf,
    z.object({ op: z.literal('repeat'), times: num(1, 100, 0), steps: child }),
    z.object({ op: z.literal('forever'), steps: child }),
    z.object({ op: z.literal('repeat_until'), condition, steps: child }),
    z
      .object({ op: z.literal('if'), condition, then: child, else: child.optional() })
      .transform(({ else: otherwise, ...s }) => (otherwise?.length ? { ...s, else: otherwise } : s)),
  ])
}

/** "forever" is a cap block in Scratch: nothing can follow it in the same stack. */
function truncateAfterForever(steps: Step[]): Step[] {
  const i = steps.findIndex((s) => s.op === 'forever')
  const kept = i === -1 ? steps : steps.slice(0, i + 1)
  return kept.map((s) => {
    switch (s.op) {
      case 'repeat':
      case 'forever':
      case 'repeat_until':
        return { ...s, steps: truncateAfterForever(s.steps) }
      case 'if':
        return s.else ? { ...s, then: truncateAfterForever(s.then), else: truncateAfterForever(s.else) } : { ...s, then: truncateAfterForever(s.then) }
      default:
        return s
    }
  })
}

function programSchema(robot: RobotProfile): z.ZodType<Program> {
  return z
    .object({
      title: cleanText(LIMITS.maxTitle).transform((t) => t || 'RoboEasy'),
      description: cleanText(LIMITS.maxDescription),
      steps: z.array(stepSchema(1, conditionSchema(robot))).min(1, 'the program needs at least one step'),
    })
    .superRefine((p, ctx) => {
      const n = countSteps(p.steps)
      if (n > LIMITS.maxSteps) ctx.addIssue({ code: 'custom', path: ['steps'], message: `too many steps (${n}); use at most ${LIMITS.maxSteps}` })
    })
    .transform((p) => ({ ...p, steps: truncateAfterForever(p.steps) }))
}

export type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string }

function toResult<T>(parsed: z.ZodSafeParseResult<T>): ParseResult<T> {
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: z.prettifyError(parsed.error).slice(0, 1500) }
}

/**
 * Loops and "if" with nothing inside, as a message for the model. Learners may
 * legitimately have these half-built, so only generated programs are checked.
 */
export function findEmptyBlocks(steps: Step[], path = 'steps'): string[] {
  return steps.flatMap((s, i) => {
    const at = `${path}[${i}]`
    if (s.op === 'repeat' || s.op === 'forever' || s.op === 'repeat_until')
      return s.steps.length ? findEmptyBlocks(s.steps, `${at}.steps`) : [`${at} ("${s.op}") has no steps inside`]
    if (s.op === 'if')
      return s.then.length
        ? [...findEmptyBlocks(s.then, `${at}.then`), ...findEmptyBlocks(s.else ?? [], `${at}.else`)]
        : [`${at} ("if") has no steps in "then"`]
    return []
  })
}

/** Validates a block program (from the AI or the client). Sensor ports default to the robot config. */
export function parseProgram(raw: unknown, robot: RobotProfile = DEFAULT_ROBOT): ParseResult<Program> {
  return toResult(programSchema(robot).safeParse(raw))
}

// ---------------------------------------------------------------------------
// Python mode
// ---------------------------------------------------------------------------

export interface PythonAnswer {
  title: string
  description: string
  code: string
}

const pythonSchema: z.ZodType<PythonAnswer> = z.object({
  title: cleanText(LIMITS.maxTitle).transform((t) => t || 'RoboEasy'),
  description: cleanText(LIMITS.maxDescription),
  code: z.string().min(10, 'code is empty'),
})

export function parsePythonAnswer(raw: unknown): ParseResult<PythonAnswer> {
  return toResult(pythonSchema.safeParse(raw))
}

// ---------------------------------------------------------------------------
// Robot settings (user input: forgiving, every field falls back to a default)
// ---------------------------------------------------------------------------

const portOr = (fallback: (typeof PORTS)[number]) => z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), port).catch(fallback)
const numOr = (fallback: number, min: number, max: number, decimals = 1) => {
  const f = 10 ** decimals
  return z
    .number()
    .transform((v) => Math.min(max, Math.max(min, Math.round(v * f) / f)))
    .catch(fallback)
}

const attachmentSchema: z.ZodType<Attachment> = z.object({
  port: z.preprocess((v) => (typeof v === 'string' ? v.trim().toUpperCase() : v), port),
  kind: z.enum(ATTACHMENT_KINDS).catch('other'),
  name: cleanText(30),
})

/** Profiles saved before v2 stored wheel sizes in cm (`wheelDiameter`, `trackWidth`). */
function migrateLegacyRobot(raw: unknown): unknown {
  if (typeof raw !== 'object' || raw === null) return raw
  const r = raw as Record<string, unknown>
  const cmToMm = (v: unknown) => (typeof v === 'number' ? v * 10 : v)
  return {
    ...r,
    wheelDiameterMm: r.wheelDiameterMm ?? cmToMm(r.wheelDiameter),
    trackWidthMm: r.trackWidthMm ?? cmToMm(r.trackWidth),
  }
}

const robotSchema: z.ZodType<RobotProfile> = z
  .preprocess(
    migrateLegacyRobot,
    z.object({
      leftMotor: portOr(DEFAULT_ROBOT.leftMotor),
      rightMotor: portOr(DEFAULT_ROBOT.rightMotor),
      distanceSensor: portOr(DEFAULT_ROBOT.distanceSensor),
      colorSensor: portOr(DEFAULT_ROBOT.colorSensor),
      forceSensor: portOr(DEFAULT_ROBOT.forceSensor),
      wheelDiameterMm: numOr(DEFAULT_ROBOT.wheelDiameterMm, 20, 200),
      trackWidthMm: numOr(DEFAULT_ROBOT.trackWidthMm, 40, 400),
      distanceFactor: numOr(1, 0.5, 2, 3),
      turnFactor: numOr(1, 0.5, 2, 3),
      attachments: z
        .array(z.unknown())
        .transform((list) =>
          list.slice(0, 6).flatMap((a) => {
            const parsed = attachmentSchema.safeParse(a)
            return parsed.success ? [parsed.data] : []
          }),
        )
        .catch([]),
    }),
  )
  .catch(DEFAULT_ROBOT)

export function parseRobot(raw: unknown): RobotProfile {
  return robotSchema.parse(raw ?? {})
}

// ---------------------------------------------------------------------------
// JSON Schemas for Gemini (`responseJsonSchema`)
// ---------------------------------------------------------------------------

type JsonSchema = Record<string, unknown>

const enumOf = (...schemas: { options: readonly string[] }[]): JsonSchema => ({
  type: 'string',
  enum: [...new Set(schemas.flatMap((s) => s.options))],
})
const range = (minimum: number, maximum: number): JsonSchema => ({ type: 'number', minimum, maximum })
export const STEP_OPS = [
  'move',
  'turn',
  'reset_yaw',
  'set_movement_motors',
  'steer',
  'start_move',
  'start_steer',
  'stop_move',
  'set_speed',
  'motor_run',
  'motor_start',
  'motor_stop',
  'motor_speed',
  'motor_to_position',
  'show_image',
  'write',
  'clear_display',
  'beep',
  'button_light',
  'wait',
  'wait_until',
  'repeat',
  'forever',
  'repeat_until',
  'if',
] as const satisfies readonly Step['op'][]
const stepList: JsonSchema = { type: 'array', items: { $ref: '#/$defs/Step' } }
/** Loops and "if": without minItems the model often closes them empty. */
const bodyList: JsonSchema = { ...stepList, minItems: 1 }

/**
 * Compact schema: one Step object with `op` plus every field any op may use.
 * Which fields belong to which op is described in the system prompt and
 * checked by `parseProgram`.
 */
export const PROGRAM_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    steps: stepList,
  },
  required: ['title', 'description', 'steps'],
  $defs: {
    Condition: {
      type: 'object',
      properties: {
        sensor: { type: 'string', enum: ['distance', 'color', 'reflection', 'force', 'button'] },
        port: enumOf(port),
        comparator: enumOf(comparator),
        value: { type: 'number' },
        unit: enumOf(distanceUnit),
        color: enumOf(sensorColor),
        state: enumOf(forceState, buttonState),
        button: enumOf(hubButton),
      },
      required: ['sensor'],
    },
    Step: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: [...STEP_OPS] },
        direction: enumOf(startDirection, positionDirection),
        value: { type: 'number' },
        unit: enumOf(moveUnit),
        degrees: range(1, 3600),
        steering: range(-100, 100),
        speed: range(5, 100),
        port: enumOf(port),
        left: enumOf(port),
        right: enumOf(port),
        position: range(0, 359),
        text: { type: 'string' },
        image: { type: 'string' },
        seconds: { type: 'number' },
        note: range(36, 96),
        color: enumOf(lightColor),
        times: range(1, 100),
        condition: { $ref: '#/$defs/Condition' },
        steps: bodyList,
        then: bodyList,
        else: stepList,
      },
      required: ['op'],
    },
  },
}

export const PYTHON_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    description: { type: 'string' },
    code: { type: 'string' },
  },
  required: ['title', 'description', 'code'],
}
