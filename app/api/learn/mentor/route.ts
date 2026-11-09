import type { NextRequest } from 'next/server'

import { parseProgram } from '@/lib/dsl/schema'
import { CHAT_ATTEMPT_MS, askGemini, createGemini } from '@/lib/gemini'
import { readLesson } from '@/lib/learn/content'
import {
  MENTOR_JSON_SCHEMA,
  MENTOR_LIMITS,
  type MentorResponse,
  mentorRequestSchema,
  mentorSystemPrompt,
  mentorUserMessage,
  sanitizeHint,
} from '@/lib/learn/mentor'
import { limitRequester } from '@/lib/rate-limit'

export const maxDuration = 30

const MAX_BODY_BYTES = 24_000
const DAY_MS = 24 * 60 * 60 * 1000

function reply(body: MentorResponse, status = 200) {
  return Response.json(body, { status })
}

export async function POST(req: NextRequest) {
  const text = await req.text()
  if (text.length > MAX_BODY_BYTES) return reply({ ok: false, error: 'bad_request' }, 413)
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    return reply({ ok: false, error: 'bad_request' }, 400)
  }
  const parsed = mentorRequestSchema.safeParse(raw)
  if (!parsed.success) return reply({ ok: false, error: 'bad_request' }, 400)
  const body = parsed.data
  const lesson = readLesson(body.lessonId)
  const step = lesson?.steps.find((s) => s.id === body.stepId)
  if (!lesson || !step) return reply({ ok: false, error: 'bad_request' }, 400)

  const authored = 'hints' in step ? step.hints : []
  const lessonHint = (): MentorResponse | null => {
    const h = authored[Math.min(body.level, authored.length) - 1]
    return h ? { ok: true, hint: h[body.lang], source: 'lesson' } : null
  }

  const minute = await limitRequester(req.headers, 'mentor:m', MENTOR_LIMITS.perMinute, 60_000)
  if (!minute.ok) return reply({ ok: false, error: 'rate_limited', retryAfter: minute.retryAfterSeconds }, 429)
  const day = await limitRequester(req.headers, 'mentor:d', MENTOR_LIMITS.perDay, DAY_MS)
  if (!day.ok) return reply(lessonHint() ?? { ok: false, error: 'daily_limit' }, lessonHint() ? 200 : 429)

  const ai = createGemini('mentor')
  if (!ai) return reply(lessonHint() ?? { ok: false, error: 'bad_request' })

  const program = body.program.length
    ? parseProgram({ title: 'p', description: '', steps: body.program })
    : { ok: true as const, value: { title: 'p', description: '', steps: [] } }
  const steps = program.ok ? program.value.steps : []
  const reference = 'reference' in step ? step.reference : undefined
  try {
    const signal = AbortSignal.any([req.signal, AbortSignal.timeout(25_000)])
    const answer = await askGemini(ai, {
      task: 'mentor',
      // The first hint is a leading question; later ones need a closer look at the program.
      tier: body.level === 1 && !body.question ? 'light' : 'main',
      system: mentorSystemPrompt(body.lang),
      contents: mentorUserMessage(lesson, body, steps),
      schema: MENTOR_JSON_SCHEMA,
      signal,
      attemptMs: CHAT_ATTEMPT_MS,
    })
    const hint = typeof answer.hint === 'string' ? sanitizeHint(answer.hint, reference) : null
    // Moderation log without personal data: lesson, step, level and length only.
    console.info(
      `[mentor] ${lesson.id}/${step.id} level=${body.level} q=${body.question ? body.question.length : 0} offTopic=${answer.offTopic === true} ok=${hint !== null}`,
    )
    if (!hint) return reply(lessonHint() ?? { ok: false, error: 'bad_request' })
    return reply({ ok: true, hint, source: 'ai', remaining: day.remaining })
  } catch (error) {
    console.error('[mentor] failed:', error instanceof Error ? error.message : error)
    return reply(lessonHint() ?? { ok: false, error: 'bad_request' })
  }
}
