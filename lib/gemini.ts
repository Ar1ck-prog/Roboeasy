/**
 * The one place the server talks to Gemini (generator, mentors, FLL plans,
 * video): key and model choice, JSON answers constrained by a JSON Schema,
 * per-attempt timeouts, quota cooldowns, usage counting and error mapping.
 *
 * Model names live in the environment (GEMINI_MODEL_MAIN, GEMINI_MODEL_LIGHT,
 * optional GEMINI_MODEL_FALLBACKS), never in the code. Server-only.
 */

import { ApiError, type ContentListUnion, GoogleGenAI } from '@google/genai'

import { type AiKind, recordUsage } from '@/lib/ai/usage'

const ATTEMPT_TIMEOUT_MS = 40_000
/** Short answers: one stuck model must not use up the time of the fallbacks. */
export const CHAT_ATTEMPT_MS = 8_000
const DEFAULT_RETRY_S = 60

export type ModelTier = 'main' | 'light'
export type KeyPurpose = 'default' | 'mentor'

/** `busy`: overload, quota or timeout (try later). `failed`: the model could not produce valid output. */
export class GeminiError extends Error {
  constructor(
    readonly kind: 'busy' | 'failed',
    /** Seconds until it is worth trying again (quota and overload only). */
    readonly retryAfter?: number,
  ) {
    super(`gemini ${kind}`)
  }
}

const usable = (key: string | undefined): key is string => Boolean(key && key !== 'YOUR_API_KEY_HERE')

/**
 * Outside production the demo key is used when it exists, so development never
 * spends the site's quota. The mentor may have its own key in production.
 */
export function geminiKey(purpose: KeyPurpose = 'default'): string | null {
  const dev = process.env.GEMINI_API_KEY_DEV
  if (process.env.NODE_ENV !== 'production' && usable(dev)) return dev
  const mentor = process.env.GEMINI_MENTOR_API_KEY
  if (purpose === 'mentor' && usable(mentor)) return mentor
  const key = process.env.GEMINI_API_KEY
  return usable(key) ? key : null
}

const fromEnv = (name: string) => process.env[name]?.trim() || null

/** GEMINI_MODEL is the old name of GEMINI_MODEL_MAIN. */
export const mainModel = () => fromEnv('GEMINI_MODEL_MAIN') ?? fromEnv('GEMINI_MODEL')
export const lightModel = () => fromEnv('GEMINI_MODEL_LIGHT') ?? mainModel()

/** Models to try, in order: the tier's model, then the main one, then the fallbacks. */
export function modelsFor(tier: ModelTier): string[] {
  const fallbacks = (fromEnv('GEMINI_MODEL_FALLBACKS') ?? '')
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
  return [...new Set([tier === 'light' ? lightModel() : mainModel(), mainModel(), ...fallbacks])].filter((m): m is string => Boolean(m))
}

export function geminiConfigured(): boolean {
  return geminiKey() !== null && mainModel() !== null
}

export function createGemini(purpose: KeyPurpose = 'default'): GoogleGenAI | null {
  const key = geminiKey(purpose)
  return key && mainModel() ? new GoogleGenAI({ apiKey: key }) : null
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null
  } catch {
    return null
  }
}

/** The free quota for a day ends at midnight Pacific time. */
export function secondsToPacificMidnight(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Los_Angeles', hour12: false, hour: 'numeric', minute: 'numeric', second: 'numeric' }).formatToParts(now)
  const part = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  return 86_400 - ((part('hour') % 24) * 3600 + part('minute') * 60 + part('second'))
}

/** How long a model that answered 429 should be left alone, in seconds. */
export function quotaWait(message: string, now = new Date()): number {
  if (/per.?day/i.test(message)) return secondsToPacificMidnight(now)
  const delay = /retryDelay\\?"?\s*:\s*\\?"(\d+(?:\.\d+)?)s/.exec(message)
  return delay ? Math.max(1, Math.ceil(Number(delay[1]))) : DEFAULT_RETRY_S
}

/** Models that are out of quota, until when (ms). Asking them again would only waste time. */
const cooldowns = new Map<string, number>()

export function resetGeminiCooldowns() {
  cooldowns.clear()
}

export interface AskOptions {
  /** What the request is for, in the usage statistics. */
  task: AiKind
  system: string
  contents: ContentListUnion
  schema: Record<string, unknown>
  signal: AbortSignal
  tier?: ModelTier
  attemptMs?: number
  temperature?: number
  /** Try one model only: nothing else is asked after a quota error (the eval script). */
  singleModel?: boolean
  /** Called before every real request to Gemini; each one counts against the quota. */
  onAttempt?: (model: string) => void
}

/** Asks Gemini for a JSON object matching `schema`, moving to the next model when one is unavailable. */
export async function askGemini(ai: GoogleGenAI, options: AskOptions): Promise<Record<string, unknown>> {
  const { task, system, contents, schema, signal, tier = 'main', attemptMs = ATTEMPT_TIMEOUT_MS, temperature = 0.2 } = options
  const models = modelsFor(tier)
  if (options.singleModel) models.splice(1)
  if (!models.length) throw new GeminiError('failed')

  let busy = false
  let wait: number | undefined
  const noteWait = (seconds: number) => (wait = wait === undefined ? seconds : Math.min(wait, seconds))

  for (const model of models) {
    const until = cooldowns.get(model) ?? 0
    if (until > Date.now()) {
      busy = true
      noteWait(Math.ceil((until - Date.now()) / 1000))
      continue
    }
    options.onAttempt?.(model)
    try {
      const res = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: system,
          temperature,
          responseMimeType: 'application/json',
          responseJsonSchema: schema,
          abortSignal: AbortSignal.any([signal, AbortSignal.timeout(attemptMs)]),
        },
      })
      const parsed = parseJsonObject(res.text ?? '')
      if (parsed) {
        void recordUsage({ kind: task, model, ok: true })
        return parsed
      }
      console.error(`[gemini] ${model} returned invalid JSON`)
      void recordUsage({ kind: task, model, ok: false, error: 'invalid' })
      // A light model gets one more try on the main one; the main model's answer is final.
      if (model === mainModel()) break
    } catch (error) {
      if (signal.aborted) throw error
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[gemini] ${model} failed:`, message)
      if (error instanceof ApiError && error.status === 400) {
        void recordUsage({ kind: task, model, ok: false, error: 'other' })
        break // invalid requests fail the same way on every model
      }
      if (error instanceof ApiError && error.status === 429) {
        const seconds = quotaWait(message)
        cooldowns.set(model, Date.now() + seconds * 1000)
        noteWait(seconds)
        busy = true
        void recordUsage({ kind: task, model, ok: false, error: 'quota' })
      } else if (!(error instanceof ApiError) || [500, 503, 504].includes(error.status)) {
        busy = true
        noteWait(DEFAULT_RETRY_S)
        void recordUsage({ kind: task, model, ok: false, error: error instanceof ApiError ? 'overload' : 'timeout' })
      } else {
        void recordUsage({ kind: task, model, ok: false, error: 'other' })
      }
    }
  }
  throw new GeminiError(busy ? 'busy' : 'failed', busy ? (wait ?? DEFAULT_RETRY_S) : undefined)
}

/** Asks the model again once, with the validation error, if the first answer is invalid. */
export function retryMessage(message: string, problems: string): string {
  return `${message}\n\nYour previous answer was rejected:\n${problems}\nReturn the complete corrected JSON object.`
}
