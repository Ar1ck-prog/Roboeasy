import type { GoogleGenAI } from '@google/genai'
import type { NextRequest } from 'next/server'

import { type Format, type GenerateErrorCode, type GenerateResponse, PROMPT_MAX } from '@/lib/api-types'
import { checkPython, cleanPython, programToPython } from '@/lib/dsl/compile-python'
import { PROGRAM_JSON_SCHEMA, PYTHON_JSON_SCHEMA, findEmptyBlocks, parseProgram, parsePythonAnswer, parseRobot } from '@/lib/dsl/schema'
import type { RobotProfile } from '@/lib/dsl/types'
import { GeminiError, askGemini, createGemini, geminiConfigured, retryMessage } from '@/lib/gemini'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import { type Lang, dslSystemPrompt, freePythonSystemPrompt, userMessage } from '@/lib/spike/prompts'

export const maxDuration = 60

/** Stay under maxDuration so the client gets a proper error instead of a platform timeout. */
const TOTAL_TIMEOUT_MS = 55_000
/** One stuck model must leave time for the fallbacks and for a corrected answer. */
const GENERATE_ATTEMPT_MS = 20_000
const MAX_BODY_BYTES = 64_000
const RATE_LIMIT = { requests: 10, windowMs: 60_000 }
const LANGS: readonly Lang[] = ['ru', 'kk', 'en']

interface ParsedRequest {
  prompt: string
  format: Format
  lang: Lang
  robot: RobotProfile
  previous?: { kind: 'program' | 'code'; value: string }
}

class GenerationError extends Error {
  constructor(readonly code: GenerateErrorCode) {
    super(code)
  }
}

function reply(body: GenerateResponse, status = 200, headers?: HeadersInit) {
  return Response.json(body, { status, headers })
}

function fail(error: GenerateErrorCode, status: number, retryAfter?: number) {
  return reply({ ok: false, error, retryAfter }, status, retryAfter ? { 'Retry-After': String(retryAfter) } : undefined)
}

function parseRequest(body: unknown): ParsedRequest | { error: GenerateErrorCode } {
  if (typeof body !== 'object' || body === null) return { error: 'bad_request' }
  const b = body as Record<string, unknown>
  const prompt = typeof b.prompt === 'string' ? b.prompt.trim() : ''
  if (prompt.length < 2) return { error: 'bad_request' }
  if (prompt.length > PROMPT_MAX) return { error: 'prompt_too_long' }
  const format: Format = b.format === 'python' || b.format === 'python-free' ? b.format : 'blocks'
  const lang = LANGS.includes(b.lang as Lang) ? (b.lang as Lang) : 'ru'
  const robot = parseRobot(b.robot)

  let previous: ParsedRequest['previous']
  const prev = typeof b.previous === 'object' && b.previous !== null ? (b.previous as Record<string, unknown>) : null
  if (prev && format !== 'python-free' && prev.program) {
    const program = parseProgram(prev.program, robot)
    if (program.ok) previous = { kind: 'program', value: JSON.stringify(program.value) }
  } else if (prev && format === 'python-free' && typeof prev.code === 'string' && prev.code.trim()) {
    previous = { kind: 'code', value: prev.code.slice(0, 12_000) }
  }
  return { prompt, format, lang, robot, previous }
}

/** DSL modes: the AI writes commands, our compilers produce blocks and Python. */
async function generateProgram(ai: GoogleGenAI, req: ParsedRequest, signal: AbortSignal): Promise<GenerateResponse> {
  const system = dslSystemPrompt(req.robot, req.lang)
  const message = userMessage(req.prompt, req.previous)
  const ask = async (text: string) => {
    const result = parseProgram(await askGemini(ai, system, text, PROGRAM_JSON_SCHEMA, signal, GENERATE_ATTEMPT_MS), req.robot)
    if (!result.ok) return result
    const empty = findEmptyBlocks(result.value.steps)
    return empty.length ? { ok: false as const, error: `${empty.join('; ')}. Put the commands inside.` } : result
  }
  let parsed = await ask(message)
  if (!parsed.ok) {
    console.warn('[generate] invalid program, retrying:', parsed.error)
    parsed = await ask(retryMessage(message, parsed.error))
  }
  if (!parsed.ok) {
    console.error('[generate] invalid program after retry:', parsed.error)
    throw new GenerationError('empty_program')
  }
  const program = parsed.value
  const python = programToPython(program, req.robot)
  const common = { ok: true as const, title: program.title, description: program.description, program, warnings: [] }
  return req.format === 'python' ? { ...common, format: 'python', code: python } : { ...common, format: 'blocks', python }
}

/** Free Python mode: the AI writes the code, we validate it. */
async function generateFreePython(ai: GoogleGenAI, req: ParsedRequest, signal: AbortSignal): Promise<GenerateResponse> {
  const system = freePythonSystemPrompt(req.robot, req.lang)
  const message = userMessage(req.prompt, req.previous)

  const attempt = async (text: string) => {
    const parsed = parsePythonAnswer(await askGemini(ai, system, text, PYTHON_JSON_SCHEMA, signal, GENERATE_ATTEMPT_MS))
    if (!parsed.ok) return { answer: null, problems: parsed.error, issues: [] as string[] }
    const answer = { ...parsed.value, code: cleanPython(parsed.value.code) }
    const issues = checkPython(answer.code)
    return { answer, problems: issues.join('; '), issues }
  }

  let best = await attempt(message)
  if (!best.answer || best.issues.length) {
    const retry = await attempt(retryMessage(message, best.problems))
    if (retry.answer && (!best.answer || retry.issues.length < best.issues.length)) best = retry
  }
  if (!best.answer) {
    console.error('[generate] invalid Python answer after retry:', best.problems)
    throw new GenerationError('empty_program')
  }
  return { ok: true, format: 'python', ...best.answer, warnings: best.issues }
}

/** Lets the UI show whether the AI is configured without exposing anything else. */
export function GET() {
  return Response.json({ configured: geminiConfigured() })
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return fail('bad_request', 413)
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return fail('bad_request', 400)
  }
  const parsed = parseRequest(body)
  if ('error' in parsed) return fail(parsed.error, 400)

  const limit = rateLimit(clientKey(req.headers), RATE_LIMIT.requests, RATE_LIMIT.windowMs)
  if (!limit.ok) return fail('rate_limited', 429, limit.retryAfterSeconds)

  const ai = createGemini()
  if (!ai) return fail('not_configured', 503)

  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS)
  const signal = AbortSignal.any([req.signal, deadline])
  try {
    const result = parsed.format === 'python-free' ? await generateFreePython(ai, parsed, signal) : await generateProgram(ai, parsed, signal)
    return reply(result)
  } catch (error) {
    if (error instanceof GenerationError) return fail(error.code, 502)
    if (error instanceof GeminiError) return fail(error.kind === 'busy' ? 'ai_busy' : 'ai_failed', error.kind === 'busy' ? 503 : 502)
    if (deadline.aborted) return fail('ai_busy', 504)
    if (req.signal.aborted) return fail('ai_failed', 499)
    console.error('[generate] unexpected error:', error)
    return fail('ai_failed', 500)
  }
}
