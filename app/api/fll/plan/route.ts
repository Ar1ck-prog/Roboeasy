import type { NextRequest } from 'next/server'

import { parseRobot } from '@/lib/dsl/schema'
import { askGemini, createGemini, retryMessage } from '@/lib/gemini'
import { type Lang, MAX_SELECTED, type PlanNotice, type PlanResponse, fallbackPlan, parsePlan, planJsonSchema, planSystemPrompt, planUserMessage } from '@/lib/fll/plan'
import { safeParseSeason } from '@/lib/fll/season'
import { getSeason } from '@/lib/fll/seasons'
import { limitRequester } from '@/lib/rate-limit'

export const maxDuration = 60

const TOTAL_TIMEOUT_MS = 55_000
/** Room for an editor draft of a season sent along with the request. */
const MAX_BODY_BYTES = 256_000
const MAX_DRAFT_MISSIONS = 80
const RATE_LIMIT = { requests: 6, windowMs: 60_000 }

function reply(body: PlanResponse, status = 200) {
  return Response.json(body, { status })
}

export async function POST(req: NextRequest) {
  if (Number(req.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) return reply({ ok: false, error: 'bad_request' }, 413)
  let body: Record<string, unknown>
  try {
    const text = await req.text()
    if (text.length > MAX_BODY_BYTES) return reply({ ok: false, error: 'bad_request' }, 413)
    const raw: unknown = JSON.parse(text)
    if (typeof raw !== 'object' || raw === null) throw new Error('not an object')
    body = raw as Record<string, unknown>
  } catch {
    return reply({ ok: false, error: 'bad_request' }, 400)
  }

  // A draft from the field editor (not yet in data/seasons) or a shipped season.
  let season = typeof body.seasonId === 'string' ? getSeason(body.seasonId) : null
  if (body.season !== undefined) {
    const draft = safeParseSeason(body.season)
    season = draft.ok && draft.season.missions.length <= MAX_DRAFT_MISSIONS ? draft.season : null
  }
  const lang: Lang = body.lang === 'kk' || body.lang === 'en' ? body.lang : 'ru'
  const known = new Set(season?.missions.map((m) => m.id))
  const missionIds = Array.isArray(body.missionIds) ? [...new Set(body.missionIds.filter((id): id is string => typeof id === 'string' && known.has(id)))] : []
  if (!season || !missionIds.length || missionIds.length > MAX_SELECTED) return reply({ ok: false, error: 'bad_request' }, 400)
  if (!season.launchAreas.length) return reply({ ok: false, error: 'season_incomplete' }, 422)
  const robot = parseRobot(body.robot)

  const limit = await limitRequester(req.headers, 'fll', RATE_LIMIT.requests, RATE_LIMIT.windowMs)
  if (!limit.ok) return reply({ ok: false, error: 'rate_limited', retryAfter: limit.retryAfterSeconds }, 429)

  const fallback = (notice: PlanNotice) => reply({ ok: true, plan: fallbackPlan(season, missionIds, robot, lang), source: 'fallback', notice })

  const ai = createGemini()
  if (!ai) return fallback('not_configured')

  const signal = AbortSignal.any([req.signal, AbortSignal.timeout(TOTAL_TIMEOUT_MS)])
  const system = planSystemPrompt(lang)
  const message = planUserMessage(season, missionIds, robot, lang)
  const schema = planJsonSchema(season, missionIds)
  try {
    const ask = (contents: string) => askGemini(ai, { task: 'fll_plan', system, contents, schema, signal })
    let parsed = parsePlan(await ask(message), season, missionIds)
    if (!parsed.ok) {
      console.warn('[fll] invalid plan, retrying:', parsed.error)
      parsed = parsePlan(await ask(retryMessage(message, parsed.error)), season, missionIds)
    }
    if (!parsed.ok) {
      console.error('[fll] invalid plan after retry:', parsed.error)
      return fallback('ai_failed')
    }
    return reply({ ok: true, plan: parsed.plan, source: 'ai' })
  } catch (error) {
    console.error('[fll] plan failed:', error instanceof Error ? error.message : error)
    return fallback('ai_busy')
  }
}
