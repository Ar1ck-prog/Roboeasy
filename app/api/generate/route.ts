import type { NextRequest } from 'next/server'

import { type Format, type GenerateErrorCode, type GenerateResponse, PROMPT_MAX } from '@/lib/api-types'
import { programToPython } from '@/lib/dsl/compile-python'
import { parseProgram, parseRobot } from '@/lib/dsl/schema'
import type { RobotProfile } from '@/lib/dsl/types'
import { type CachedResult, cacheKey, readCache, writeCache } from '@/lib/ai/cache'
import { GenerationError, runGeneration } from '@/lib/ai/generator'
import { recordUsage } from '@/lib/ai/usage'
import { GeminiError, createGemini, geminiConfigured } from '@/lib/gemini'
import { limitRequester } from '@/lib/rate-limit'
import type { Lang } from '@/lib/spike/prompts'

export const maxDuration = 60

/** Stay under maxDuration so the client gets a proper error instead of a platform timeout. */
const TOTAL_TIMEOUT_MS = 55_000
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

/** Blocks and Python are compiled here, for new and for cached programs alike. */
function toResponse(result: CachedResult, req: ParsedRequest): GenerateResponse {
  if (result.kind === 'unsupported') return { ok: false, error: 'unsupported', reason: result.reason, suggestion: result.suggestion }
  if (result.kind === 'python')
    return { ok: true, format: 'python', title: result.title, description: result.description, code: result.code, warnings: result.warnings }
  const python = programToPython(result.program, req.robot)
  const common = { ok: true as const, title: result.title, description: result.description, program: result.program, warnings: [] }
  return req.format === 'python' ? { ...common, format: 'python', code: python } : { ...common, format: 'blocks', python }
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

  const limit = await limitRequester(req.headers, 'generate', RATE_LIMIT.requests, RATE_LIMIT.windowMs)
  if (!limit.ok) return fail('rate_limited', 429, limit.retryAfterSeconds)

  // A change to an existing program depends on that program, so it is never cached.
  const key = parsed.previous ? null : cacheKey(parsed)
  if (key) {
    const hit = await readCache(key)
    if (hit) {
      void recordUsage({ kind: 'generate', cached: true, ok: true })
      return reply(toResponse(hit, parsed))
    }
  }

  const ai = createGemini()
  if (!ai) return fail('not_configured', 503)

  const deadline = AbortSignal.timeout(TOTAL_TIMEOUT_MS)
  const signal = AbortSignal.any([req.signal, deadline])
  try {
    const result = await runGeneration(parsed, { ai, signal })
    if (key) await writeCache(key, parsed.format, result)
    return reply(toResponse(result, parsed))
  } catch (error) {
    if (error instanceof GenerationError) return fail(error.code, 502)
    if (error instanceof GeminiError) return error.kind === 'busy' ? fail('ai_busy', 503, error.retryAfter) : fail('ai_failed', 502)
    if (deadline.aborted) return fail('ai_busy', 504)
    if (req.signal.aborted) return fail('ai_failed', 499)
    console.error('[generate] unexpected error:', error)
    return fail('ai_failed', 500)
  }
}
