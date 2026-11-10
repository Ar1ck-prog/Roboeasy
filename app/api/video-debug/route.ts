import type { NextRequest } from 'next/server'

import { GeminiError, askGemini, createGemini } from '@/lib/gemini'
import { limitRequester } from '@/lib/rate-limit'
import { VIDEO_JSON_SCHEMA, VIDEO_LIMITS, type VideoResponse, cleanVideoText, videoRequestSchema, videoSystemPrompt, videoUserText } from '@/lib/video/debug'

export const maxDuration = 60

const DAY_MS = 24 * 60 * 60 * 1000

function reply(body: VideoResponse, status = 200) {
  return Response.json(body, { status })
}

/**
 * The stills exist only in this request: they are held in memory, sent to
 * Gemini and dropped with it. Nothing is written to disk or to the database.
 */
export async function POST(req: NextRequest) {
  const text = await req.text()
  if (text.length > VIDEO_LIMITS.bodyChars) return reply({ ok: false, error: 'bad_request' }, 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return reply({ ok: false, error: 'bad_request' }, 400)
  }
  const parsed = videoRequestSchema.safeParse(raw)
  if (!parsed.success) return reply({ ok: false, error: 'bad_request' }, 400)
  const body = parsed.data

  const day = await limitRequester(req.headers, 'video', VIDEO_LIMITS.perDay, DAY_MS)
  if (!day.ok) return reply({ ok: false, error: 'daily_limit', retryAfter: day.retryAfterSeconds }, 429)

  const ai = createGemini()
  if (!ai) return reply({ ok: false, error: 'unavailable' }, 503)

  try {
    const answer = await askGemini(ai, {
      task: 'video',
      tier: 'main',
      system: videoSystemPrompt(body.lang),
      contents: [
        { role: 'user', parts: [{ text: videoUserText(body) }, ...body.frames.map((f) => ({ inlineData: { mimeType: 'image/jpeg', data: f.data } }))] },
      ],
      schema: VIDEO_JSON_SCHEMA,
      signal: AbortSignal.any([req.signal, AbortSignal.timeout(50_000)]),
    })
    if (answer.isRobotVideo !== true) return reply({ ok: false, error: 'not_robot' }, 422)
    const [observed, question, hint] = [cleanVideoText(answer.observed), cleanVideoText(answer.question), cleanVideoText(answer.hint)]
    if (!question) return reply({ ok: false, error: 'unavailable' }, 502)
    return reply({ ok: true, observed, question, hint, remaining: day.remaining })
  } catch (error) {
    console.error('[video-debug] failed:', error instanceof Error ? error.message : error)
    if (error instanceof GeminiError && error.kind === 'busy') return reply({ ok: false, error: 'resting', retryAfter: error.retryAfter }, 503)
    return reply({ ok: false, error: 'unavailable' }, 502)
  }
}
