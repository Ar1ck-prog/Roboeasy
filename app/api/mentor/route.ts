import type { NextRequest } from 'next/server'

import { CHAT_ATTEMPT_MS, askGemini, createMentorGemini } from '@/lib/gemini'
import { clientKey, rateLimit } from '@/lib/rate-limit'
import {
  SITE_MENTOR_JSON_SCHEMA,
  SITE_MENTOR_LIMITS,
  type SiteMentorResponse,
  sanitizeAnswer,
  siteMentorRequestSchema,
  siteMentorSystemPrompt,
  siteMentorUserMessage,
} from '@/lib/learn/site-mentor'

export const maxDuration = 30

const MAX_BODY_CHARS = 20_000
const DAY_MS = 24 * 60 * 60 * 1000

function reply(body: SiteMentorResponse, status = 200) {
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
  const parsed = siteMentorRequestSchema.safeParse(raw)
  if (!parsed.success) return reply({ ok: false, error: 'bad_request' }, 400)

  const who = clientKey(req.headers)
  const minute = rateLimit(`site-mentor:m:${who}`, SITE_MENTOR_LIMITS.perMinute, 60_000)
  if (!minute.ok) return reply({ ok: false, error: 'rate_limited', retryAfter: minute.retryAfterSeconds }, 429)
  const day = rateLimit(`site-mentor:d:${who}`, SITE_MENTOR_LIMITS.perDay, DAY_MS)
  if (!day.ok) return reply({ ok: false, error: 'daily_limit' }, 429)

  const ai = createMentorGemini()
  if (!ai) return reply({ ok: false, error: 'unavailable' }, 503)

  const body = parsed.data
  try {
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(25_000)])
    const result = await askGemini(ai, siteMentorSystemPrompt(body.lang), siteMentorUserMessage(body), SITE_MENTOR_JSON_SCHEMA, signal, CHAT_ATTEMPT_MS)
    const answer = typeof result.answer === 'string' ? sanitizeAnswer(result.answer) : null
    // Moderation log without personal data: lengths and the off-topic flag only.
    const last = body.messages[body.messages.length - 1]
    console.info(`[site-mentor] q=${last.text.length} offTopic=${result.offTopic === true} ok=${answer !== null}`)
    if (!answer) return reply({ ok: false, error: 'unavailable' }, 502)
    return reply({ ok: true, answer, remaining: day.remaining })
  } catch (error) {
    console.error('[site-mentor] failed:', error instanceof Error ? error.message : error)
    return reply({ ok: false, error: 'unavailable' }, 502)
  }
}
