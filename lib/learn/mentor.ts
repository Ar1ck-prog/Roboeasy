/**
 * The AI mentor for lessons: graded hints, never the full solution, short,
 * in the interface language, and only about robotics and the lesson.
 */

import { z } from 'zod'

import type { Step } from '../dsl/types'
import type { Lesson } from './schema'

export type Lang = 'ru' | 'kk' | 'en'
const LANG_NAME: Record<Lang, string> = { ru: 'Russian', kk: 'Kazakh', en: 'English' }

export const MENTOR_LIMITS = { perMinute: 6, perDay: 30, question: 300 } as const

export const mentorRequestSchema = z.object({
  lessonId: z.string().regex(/^[a-z0-9-]+$/),
  stepId: z.string().regex(/^[a-z0-9-]+$/),
  lang: z.enum(['ru', 'kk', 'en']),
  level: z.number().int().min(1).max(3),
  question: z.string().max(MENTOR_LIMITS.question).optional(),
  program: z.array(z.unknown()).max(80).default([]),
  failed: z.array(z.string().max(200)).max(12).default([]),
})
export type MentorRequest = z.infer<typeof mentorRequestSchema>

export type MentorResponse =
  | { ok: true; hint: string; source: 'ai' | 'lesson'; remaining?: number }
  | { ok: false; error: 'bad_request' | 'rate_limited' | 'daily_limit'; retryAfter?: number }

export const MENTOR_JSON_SCHEMA = {
  type: 'object',
  properties: { hint: { type: 'string' }, offTopic: { type: 'boolean' } },
  required: ['hint', 'offTopic'],
}

export function mentorSystemPrompt(lang: Lang): string {
  return `You are a friendly robotics mentor for children aged 9-16 learning LEGO SPIKE Prime programming with word blocks in RoboEasy.

Hard rules:
- NEVER give the full solution or a complete program. At most one block or one value, and only at hint level 3.
- Answer in ${LANG_NAME[lang]}, in 1-3 short sentences (max 300 characters), simple words a 10-year-old understands, no jargon, no emoji.
- Only talk about this lesson, robots, sensors, motors and programming. If the question is about anything else, kindly bring the learner back to the lesson and set "offTopic": true.
- Be warm and encouraging; never shame. No personal questions, no links, no contact details.
- If the learner shares personal information (a real name, address, phone, school, photos), do not repeat it; gently say it is better not to share that here, then return to the lesson.
- Hint levels: 1 = a guiding question that makes the learner think; 2 = what to look at (a block, a number, the order); 3 = a concrete small fragment (one block with its value).
- The lesson's own correct solution is given for your understanding only. Do not reveal it as a whole.

Return JSON {"hint": string, "offTopic": boolean}.`
}

export function mentorUserMessage(lesson: Lesson, req: MentorRequest, program: Step[]): string {
  const step = lesson.steps.find((s) => s.id === req.stepId)
  const ctx: Record<string, unknown> = {
    lessonGoal: lesson.goal[req.lang],
    hintLevel: req.level,
    learnerQuestion: req.question ?? null,
    learnerProgram: program,
    failedChecks: req.failed,
  }
  if (step && (step.type === 'code' || step.type === 'debug' || step.type === 'project')) {
    ctx.task = step.task[req.lang]
    ctx.availableBlocks = step.toolbox
    ctx.lessonHints = step.hints.map((h) => h[req.lang])
    ctx.solutionForMentorOnly = step.reference ?? null
    ctx.field = {
      widthMm: step.field.width,
      heightMm: step.field.height,
      start: step.field.start,
      zones: step.field.zones.map((z) => ({ id: z.id, x: z.x, y: z.y, w: z.w, h: z.h })),
      points: step.field.points,
      walls: step.field.walls,
    }
  } else if (step) {
    ctx.step = step.type
  }
  return `Coordinates are millimetres, the grid on screen is 10 cm per square. Context:\n${JSON.stringify(ctx)}`
}

/** Last line of defence: a hint must be short and must not paste a whole program. */
export function sanitizeHint(text: string, reference: Step[] | undefined): string | null {
  const hint = text.replace(/\s+/g, ' ').trim()
  if (!hint || hint.length > 400) return null
  if (/[{}[\]]|"op"\s*:/.test(hint)) return null
  if (reference && reference.length >= 3) {
    // Mentions of every value of the solution in order look like a dictated solution.
    const values = reference.map((s) => ('value' in s ? s.value : 'degrees' in s ? s.degrees : null)).filter((v): v is number => v !== null)
    if (values.length >= 3 && values.every((v) => hint.includes(String(v)))) return null
  }
  return hint
}
