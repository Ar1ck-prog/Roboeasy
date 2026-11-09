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
  type Expr,
  type Program,
  type ProgramFunction,
  type RobotProfile,
  type Step,
  ATTACHMENT_KINDS,
  DEFAULT_ROBOT,
  IMAGES,
  LIGHT_COLORS,
  LIMITS,
  PORTS,
  RESERVED_NAMES,
  SENSOR_COLORS,
  countSteps,
  programSteps,
  toMatrixText,
  variablesOf,
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
const gyroAxis = z.enum(['yaw', 'pitch', 'roll'])

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

/** Names of variables and of the program's own blocks: they become Python names. */
const identifier = z
  .string()
  .regex(/^[A-Za-z_][A-Za-z0-9_]{0,19}$/, 'use a short Latin name: letters, digits and _')
  .refine((n) => !RESERVED_NAMES.has(n), { message: 'this name is reserved, choose another one' })

const MAX_EXPR_DEPTH = 3

function exprSchema(depth = 1): z.ZodType<Expr> {
  const value = z.object({ num: num(-100_000, 100_000) })
  const variable = z.object({ var: identifier })
  if (depth >= MAX_EXPR_DEPTH) return z.union([value, variable])
  return z.union([
    value,
    variable,
    z
      .object({ op: z.enum(['+', '-', '*', '/']), a: exprSchema(depth + 1), b: exprSchema(depth + 1) })
      .refine((e) => !(e.op === '/' && 'num' in e.b && e.b.num === 0), { message: 'cannot divide by zero' }),
  ])
}

function conditionSchema(robot: RobotProfile): z.ZodType<Condition> {
  return z.discriminatedUnion('sensor', [
    z.object({ sensor: z.literal('distance'), port: port.default(robot.distanceSensor), comparator, value: num(0, 200, 1), unit: distanceUnit }),
    z.object({ sensor: z.literal('color'), port: port.default(robot.colorSensor), color: sensorColor }),
    z.object({ sensor: z.literal('reflection'), port: port.default(robot.colorSensor), comparator, value: num(0, 100, 0) }),
    z.object({ sensor: z.literal('force'), port: port.default(robot.forceSensor), state: forceState }),
    z.object({ sensor: z.literal('button'), button: hubButton, state: buttonState }),
    z.object({ sensor: z.literal('gyro'), axis: gyroAxis.default('yaw'), comparator, value: num(-180, 180, 0) }),
    z.object({ sensor: z.literal('var'), name: identifier, comparator, value: num(-100_000, 100_000) }),
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
    z.object({ op: z.literal('arc'), direction: turnDirection, radius: num(0, 300, 1), degrees: num(1, 3600, 0) }),
    z.object({ op: z.literal('circle'), direction: turnDirection, radius: num(0, 300, 1), turns: num(0.25, 20).default(1) }),
    z
      .object({ op: z.literal('tank'), leftSpeed: num(-100, 100, 0), rightSpeed: num(-100, 100, 0), value: z.number(), unit: moveUnit })
      .refine((s) => s.leftSpeed !== 0 || s.rightSpeed !== 0, { message: 'at least one motor must have a speed' })
      .transform((s) => ({ ...s, value: clampTo(s.value, MOVE_RANGE[s.unit]) })),
    z.object({ op: z.literal('move_expr'), direction: moveDirection, expr: exprSchema(), unit: moveUnit }),
    z.object({ op: z.literal('set_var'), name: identifier, expr: exprSchema() }),
    z.object({ op: z.literal('change_var'), name: identifier, expr: exprSchema() }),
    z.object({ op: z.literal('write_var'), name: identifier }),
    z.object({ op: z.literal('call'), name: identifier }),
  ] as const

  if (depth >= LIMITS.maxDepth) return z.discriminatedUnion('op', leaf)

  const child = z.array(stepSchema(depth + 1, condition))
  return z.discriminatedUnion('op', [
    ...leaf,
    z.object({ op: z.literal('repeat'), times: num(1, 100, 0), steps: child }),
    z.object({ op: z.literal('forever'), steps: child }),
    z.object({ op: z.literal('repeat_until'), condition, steps: child }),
    z.object({ op: z.literal('while'), condition, steps: child }),
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
      case 'while':
        return { ...s, steps: truncateAfterForever(s.steps) }
      case 'if':
        return s.else ? { ...s, then: truncateAfterForever(s.then), else: truncateAfterForever(s.else) } : { ...s, then: truncateAfterForever(s.then) }
      default:
        return s
    }
  })
}

/** Names of the program's own blocks that each block calls. */
function callsIn(steps: Step[]): string[] {
  return steps.flatMap((s) => (s.op === 'call' ? [s.name] : childListsOf(s).flatMap(callsIn)))
}

const childListsOf = (s: Step): Step[][] => ('steps' in s ? [s.steps] : s.op === 'if' ? [s.then, ...(s.else ? [s.else] : [])] : [])

/** A cycle of calls never ends and would overflow the hub: returns one block of such a cycle. */
function findRecursion(functions: ProgramFunction[]): string | null {
  const calls = new Map(functions.map((f) => [f.name, callsIn(f.steps)]))
  const visiting = new Set<string>()
  const done = new Set<string>()
  const visit = (name: string): string | null => {
    if (visiting.has(name)) return name
    if (done.has(name)) return null
    visiting.add(name)
    for (const next of calls.get(name) ?? []) {
      const found = visit(next)
      if (found) return found
    }
    visiting.delete(name)
    done.add(name)
    return null
  }
  for (const f of functions) {
    const found = visit(f.name)
    if (found) return found
  }
  return null
}

function checkProgram(p: Program, ctx: z.RefinementCtx) {
  const issue = (message: string) => ctx.addIssue({ code: 'custom', path: ['steps'], message })
  const all = programSteps(p)
  const n = countSteps(all)
  if (n > LIMITS.maxSteps) issue(`too many steps (${n}); use at most ${LIMITS.maxSteps}`)

  const functions = p.functions ?? []
  const defined = new Set(functions.map((f) => f.name))
  if (defined.size !== functions.length) issue("two of the program's blocks have the same name")
  if (functions.length > LIMITS.maxFunctions) issue(`too many blocks of your own; use at most ${LIMITS.maxFunctions}`)
  for (const name of callsIn(all)) if (!defined.has(name)) issue(`"call" uses "${name}", but no block with that name is in "functions"`)
  const cycle = findRecursion(functions)
  if (cycle) issue(`block "${cycle}" calls itself, directly or through another block; blocks must not call themselves`)

  const variables = variablesOf(all)
  if (variables.length > LIMITS.maxVariables) issue(`too many variables; use at most ${LIMITS.maxVariables}`)
  const assigned = new Set<string>()
  const walk = (list: Step[]) => {
    for (const s of list) {
      if (s.op === 'set_var') assigned.add(s.name)
      childListsOf(s).forEach(walk)
    }
  }
  walk(all)
  for (const name of variables) if (!assigned.has(name)) issue(`variable "${name}" is used, but no "set_var" gives it a value`)
  for (const name of variables) if (defined.has(name)) issue(`"${name}" is both a variable and a block; use different names`)
}

function programSchema(robot: RobotProfile): z.ZodType<Program> {
  const steps = z.array(stepSchema(1, conditionSchema(robot)))
  return z
    .object({
      title: cleanText(LIMITS.maxTitle).transform((t) => t || 'RoboEasy'),
      description: cleanText(LIMITS.maxDescription),
      functions: z.array(z.object({ name: identifier, steps: steps.min(1, 'a block of your own needs at least one step') })).optional(),
      steps: steps.min(1, 'the program needs at least one step'),
    })
    .superRefine(checkProgram)
    .transform(({ functions, ...p }) => ({
      ...p,
      steps: truncateAfterForever(p.steps),
      ...(functions?.length ? { functions: functions.map((f) => ({ ...f, steps: truncateAfterForever(f.steps) })) } : {}),
    }))
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
    if (s.op === 'repeat' || s.op === 'forever' || s.op === 'repeat_until' || s.op === 'while')
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
  'arc',
  'circle',
  'tank',
  'move_expr',
  'while',
  'set_var',
  'change_var',
  'write_var',
  'call',
] as const satisfies readonly Step['op'][]
const stepList: JsonSchema = { type: 'array', items: { $ref: '#/$defs/Step' } }
/** Loops and "if": without minItems the model often closes them empty. */
const bodyList: JsonSchema = { ...stepList, minItems: 1 }

/**
 * Compact schema: one Step object with `op` plus every field any op may use.
 * The model writes fields strictly in this order and cannot go back, so the
 * order must fit the examples in the system prompt (checked in tests).
 * Which fields belong to which op is described in the system prompt and
 * checked by `parseProgram`.
 */
export const PROGRAM_JSON_SCHEMA: JsonSchema = {
  type: 'object',
  properties: {
    // First, so that the model decides whether the task is possible before writing anything.
    unsupported: { type: 'boolean' },
    reason: { type: 'string' },
    suggestion: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    functions: {
      type: 'array',
      items: { type: 'object', properties: { name: { type: 'string' }, steps: bodyList }, required: ['name', 'steps'] },
    },
    steps: stepList,
  },
  required: ['unsupported'],
  $defs: {
    Expr: {
      type: 'object',
      properties: {
        var: { type: 'string' },
        num: { type: 'number' },
        op: { type: 'string', enum: ['+', '-', '*', '/'] },
        a: { $ref: '#/$defs/Expr' },
        b: { $ref: '#/$defs/Expr' },
      },
    },
    Condition: {
      type: 'object',
      properties: {
        sensor: { type: 'string', enum: ['distance', 'color', 'reflection', 'force', 'button', 'gyro', 'var'] },
        port: enumOf(port),
        axis: enumOf(gyroAxis),
        name: { type: 'string' },
        comparator: enumOf(comparator),
        value: { type: 'number' },
        unit: enumOf(distanceUnit),
        color: enumOf(sensorColor),
        button: enumOf(hubButton),
        state: enumOf(forceState, buttonState),
      },
      required: ['sensor'],
    },
    Step: {
      type: 'object',
      properties: {
        op: { type: 'string', enum: [...STEP_OPS] },
        name: { type: 'string' },
        port: enumOf(port),
        left: enumOf(port),
        right: enumOf(port),
        leftSpeed: range(-100, 100),
        rightSpeed: range(-100, 100),
        position: range(0, 359),
        direction: enumOf(startDirection, positionDirection),
        radius: range(0, 300),
        degrees: range(1, 3600),
        turns: range(0.25, 20),
        steering: range(-100, 100),
        value: { type: 'number' },
        expr: { $ref: '#/$defs/Expr' },
        unit: enumOf(moveUnit),
        speed: range(5, 100),
        image: { type: 'string' },
        text: { type: 'string' },
        note: range(36, 96),
        seconds: { type: 'number' },
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
    unsupported: { type: 'boolean' },
    reason: { type: 'string' },
    suggestion: { type: 'string' },
    title: { type: 'string' },
    description: { type: 'string' },
    code: { type: 'string' },
  },
  required: ['unsupported'],
}
