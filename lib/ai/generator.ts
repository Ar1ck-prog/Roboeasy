/**
 * The generator pipeline: Gemini chooses DSL commands (or says the task is
 * impossible), and our code validates, compiles and test-drives the result in
 * the simulator. A rejected answer goes back to the model with the reason, up
 * to three attempts, and an empty result never reaches the learner silently.
 */

import type { GoogleGenAI } from '@google/genai'

import type { Format } from '@/lib/api-types'
import type { CachedResult } from '@/lib/ai/cache'
import { recordFailure } from '@/lib/ai/failures'
import { tierForPrompt } from '@/lib/ai/route-task'
import { buildProject } from '@/lib/dsl/compile-blocks'
import { checkPython, cleanPython, programToPython } from '@/lib/dsl/compile-python'
import { PROGRAM_JSON_SCHEMA, PYTHON_JSON_SCHEMA, findEmptyBlocks, parseProgram, parsePythonAnswer } from '@/lib/dsl/schema'
import { type Program, type RobotProfile, conditionsOf, programSteps, usesOp } from '@/lib/dsl/types'
import { askGemini, retryMessage } from '@/lib/gemini'
import type { SimField } from '@/lib/sim/field'
import { simulate } from '@/lib/sim/interpreter'
import { type Lang, dslSystemPrompt, freePythonSystemPrompt, userMessage } from '@/lib/spike/prompts'

export const MAX_ATTEMPTS = 3
const ATTEMPT_MS = 20_000
const CLEAN_MAX = 300

export interface GenerationInput {
  prompt: string
  format: Format
  lang: Lang
  robot: RobotProfile
  previous?: { kind: 'program' | 'code'; value: string }
}

export interface GenerationContext {
  ai: GoogleGenAI
  signal: AbortSignal
  /** Ask one model only (the eval script: nothing else is tried after a quota error). */
  singleModel?: boolean
  onAttempt?: (model: string) => void
}

export class GenerationError extends Error {
  constructor(readonly code: 'empty_program') {
    super(code)
  }
}

const clean = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, CLEAN_MAX) : '')

function readUnsupported(answer: Record<string, unknown>): CachedResult | null {
  if (answer.unsupported !== true) return null
  return { kind: 'unsupported', reason: clean(answer.reason), suggestion: clean(answer.suggestion) }
}

/** A room large enough that only a program that never ends can reach the walls. */
const TEST_FIELD: SimField = {
  width: 20_000,
  height: 20_000,
  start: { x: 10_000, y: 10_000, heading: 90 },
  border: true,
  lines: [],
  zones: [],
  walls: [],
} as unknown as SimField

/** Words that mean the robot itself has to go somewhere, in ru, kk and en. */
const ASKS_FOR_MOTION =
  /езж|едь|проед|ехат|двиг|вперёд|вперед|назад|поверн|разверн|круг|дуг|квадрат|восьм|спирал|жүр|бұрыл|алға|артқа|шеңбер|шаршы|drive|move|forward|backward|turn|circle|arc|square/i

/** Runs a finished program in the simulator; returns what is wrong with it, for the model. */
export function checkBySimulation(program: Program, robot: RobotProfile, prompt: string): string | null {
  // With sensors the result depends on the room, which the simulator does not know here.
  if (conditionsOf(programSteps(program)).some((c) => c.sensor !== 'var')) return null
  const sim = simulate(program.steps, TEST_FIELD, { robot, functions: program.functions })
  if (sim.timedOut) return null
  if (sim.collisions > 0) return 'In the simulator the robot drove into a wall of a 20 m room: the distances are far too long.'
  const headings = sim.trace.map((p) => p.heading)
  const turned = Math.max(...headings) - Math.min(...headings)
  const usesAttachment = usesOp(programSteps(program), (s) => s.op === 'motor_run' || s.op === 'motor_start' || s.op === 'motor_to_position')
  if (ASKS_FOR_MOTION.test(prompt) && !usesAttachment && sim.distanceTravelled < 5 && turned < 2)
    return 'The task is about moving, but in the simulator the robot did not move. Add the driving commands.'
  return null
}

/** Everything that can be wrong with a program the model returned, as a message for the model. */
function problemsOf(answer: Record<string, unknown>, input: GenerationInput): { program: Program } | { problem: string } {
  const parsed = parseProgram(answer, input.robot)
  if (!parsed.ok) return { problem: parsed.error }
  const program = parsed.value
  const empty = [...findEmptyBlocks(program.steps), ...(program.functions ?? []).flatMap((f) => findEmptyBlocks(f.steps, `functions.${f.name}`))]
  if (empty.length) return { problem: `${empty.join('; ')}. Put the commands inside.` }
  try {
    buildProject(program, input.robot)
    const issues = checkPython(programToPython(program, input.robot))
    if (issues.length) return { problem: issues.join('; ') }
  } catch (error) {
    return { problem: `The program does not compile: ${error instanceof Error ? error.message : 'unknown error'}` }
  }
  const simulated = checkBySimulation(program, input.robot, input.prompt)
  return simulated ? { problem: simulated } : { program }
}

async function generateProgram(input: GenerationInput, ctx: GenerationContext): Promise<CachedResult> {
  const system = dslSystemPrompt(input.robot, input.lang)
  const message = userMessage(input.prompt, input.previous)
  const firstTier = tierForPrompt(input.prompt, Boolean(input.previous))
  let contents = message
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const answer = await askGemini(ctx.ai, {
      task: 'generate',
      tier: attempt === 1 ? firstTier : 'main',
      system,
      contents,
      schema: PROGRAM_JSON_SCHEMA,
      signal: ctx.signal,
      attemptMs: ATTEMPT_MS,
      singleModel: ctx.singleModel,
      onAttempt: ctx.onAttempt,
    })
    const unsupported = readUnsupported(answer)
    if (unsupported) return unsupported
    const result = problemsOf(answer, input)
    if ('program' in result) return { kind: 'program', title: result.program.title, description: result.program.description, program: result.program }
    console.warn(`[generate] attempt ${attempt} rejected:`, result.problem)
    await recordFailure({ prompt: input.prompt, lang: input.lang, mode: input.format, answer, error: result.problem, attempt })
    contents = retryMessage(message, result.problem)
  }
  throw new GenerationError('empty_program')
}

/** Free Python mode: the AI writes the code, we check that it can run on the hub. */
async function generateFreePython(input: GenerationInput, ctx: GenerationContext): Promise<CachedResult> {
  const system = freePythonSystemPrompt(input.robot, input.lang)
  const message = userMessage(input.prompt, input.previous)
  let contents = message
  let best: Extract<CachedResult, { kind: 'python' }> | null = null
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const answer = await askGemini(ctx.ai, {
      task: 'generate',
      system,
      contents,
      schema: PYTHON_JSON_SCHEMA,
      signal: ctx.signal,
      attemptMs: ATTEMPT_MS,
      singleModel: ctx.singleModel,
      onAttempt: ctx.onAttempt,
    })
    const unsupported = readUnsupported(answer)
    if (unsupported) return unsupported
    const parsed = parsePythonAnswer(answer)
    const code = parsed.ok ? cleanPython(parsed.value.code) : ''
    const issues = parsed.ok ? checkPython(code) : []
    if (parsed.ok && issues.length === 0) return { kind: 'python', ...parsed.value, code, warnings: [] }
    if (parsed.ok && (!best || issues.length < best.warnings.length)) best = { kind: 'python', ...parsed.value, code, warnings: issues }
    const problem = parsed.ok ? issues.join('; ') : parsed.error
    await recordFailure({ prompt: input.prompt, lang: input.lang, mode: input.format, answer, error: problem, attempt })
    contents = retryMessage(message, problem)
  }
  if (best) return best
  throw new GenerationError('empty_program')
}

export function runGeneration(input: GenerationInput, ctx: GenerationContext): Promise<CachedResult> {
  return input.format === 'python-free' ? generateFreePython(input, ctx) : generateProgram(input, ctx)
}
