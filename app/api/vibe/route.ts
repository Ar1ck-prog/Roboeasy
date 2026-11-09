import type { NextRequest } from 'next/server'

import { VIBE_JSON_SCHEMA, VIBE_LIMITS, type VibeResponse, checkVibeHtml, vibeRequestSchema, vibeSystemPrompt, vibeUserMessage } from '@/lib/ai-school/vibe'
import { GeminiError, askGemini, createGemini, retryMessage } from '@/lib/gemini'
import { limitRequester } from '@/lib/rate-limit'

export const maxDuration = 60

const MAX_BODY_CHARS = 20_000
const DAY_MS = 24 * 60 * 60 * 1000

function reply(body: VibeResponse, status = 200) {
  return Response.json(body, { status })
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  if (text.length > MAX_BODY_CHARS) return reply({ ok: false, error: 'bad_request' }, 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return reply({ ok: false, error: 'bad_request' }, 400)
  }
  const parsed = vibeRequestSchema.safeParse(raw)
  if (!parsed.success) return reply({ ok: false, error: 'bad_request' }, 400)
  const body = parsed.data

  const minute = await limitRequester(req.headers, 'vibe:m', VIBE_LIMITS.perMinute, 60_000)
  if (!minute.ok) return reply({ ok: false, error: 'rate_limited', retryAfter: minute.retryAfterSeconds }, 429)
  const day = await limitRequester(req.headers, 'vibe:d', VIBE_LIMITS.perDay, DAY_MS)
  if (!day.ok) return reply({ ok: false, error: 'daily_limit', retryAfter: day.retryAfterSeconds }, 429)

  const ai = createGemini()
  if (!ai) return reply({ ok: false, error: 'unavailable' }, 503)

  const system = vibeSystemPrompt(body.lang)
  const message = vibeUserMessage(body)
  const ask = (contents: string) =>
    askGemini(ai, {
      task: 'vibe',
      tier: 'main',
      system,
      contents,
      schema: VIBE_JSON_SCHEMA,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(50_000)]),
    })
  try {
    let answer = await ask(message)
    if (answer.unsafe === true) return reply({ ok: false, error: 'refused' }, 422)
    let problem = typeof answer.html === 'string' ? checkVibeHtml(answer.html) : 'there is no html'
    if (problem) {
      answer = await ask(retryMessage(message, `The page was rejected: ${problem}. It must be self-contained, with no network and no storage.`))
      if (answer.unsafe === true) return reply({ ok: false, error: 'refused' }, 422)
      problem = typeof answer.html === 'string' ? checkVibeHtml(answer.html) : 'there is no html'
    }
    if (problem) return reply({ ok: false, error: 'unavailable' }, 502)
    return reply({ ok: true, title: typeof answer.title === 'string' ? answer.title.slice(0, 60) : '', html: answer.html as string, remaining: day.remaining })
  } catch (error) {
    console.error('[vibe] failed:', error instanceof Error ? error.message : error)
    if (error instanceof GeminiError && error.kind === 'busy') return reply({ ok: false, error: 'resting', retryAfter: error.retryAfter }, 503)
    return reply({ ok: false, error: 'unavailable' }, 502)
  }
}
