import { ApiError } from '@google/genai'
import type { NextRequest } from 'next/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { summarizeUsage } from '@/lib/ai/usage-summary'
import { cacheKey, normalizePrompt } from '@/lib/ai/cache'
import { tierForPrompt } from '@/lib/ai/route-task'
import { DEFAULT_ROBOT } from '@/lib/dsl/types'
import { LOCAL_EXAMPLES } from '@/lib/dsl/examples'
import { parseProgram } from '@/lib/dsl/schema'
import { GeminiError, askGemini, geminiKey, modelsFor, quotaWait, resetGeminiCooldowns, secondsToPacificMidnight } from '@/lib/gemini'
import { hitLimit, limitRequester, rateLimit } from '@/lib/rate-limit'

// Gemini is replaced at the SDK: the real routes, retries and cache logic all run.
const sdk = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('@google/genai', async (original) => {
  const real = await original<typeof import('@google/genai')>()
  return {
    ...real,
    GoogleGenAI: class {
      models = { generateContent: sdk.generate }
    },
  }
})

// A tiny stand-in for the service-role client.
const db = vi.hoisted(() => ({
  cache: new Map<string, Record<string, unknown>>(),
  usage: [] as Record<string, unknown>[],
  limitAnswer: null as null | { allowed: boolean; remaining: number; retry_after: number },
  rpcFails: false,
  enabled: false,
}))
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => {
    if (!db.enabled) return null
    return {
      from: (table: string) => {
        if (table === 'ai_usage')
          return {
            insert: async (row: Record<string, unknown>) => {
              db.usage.push(row)
              return { error: null }
            },
          }
        const query = {
          wanted: '' as string,
          select: () => query,
          eq: (column: string, value: string) => {
            if (column === 'key') query.wanted = value
            return query
          },
          gt: () => query,
          maybeSingle: async () => ({ data: db.cache.get(query.wanted) ?? null, error: null }),
          upsert: async (row: { key: string }) => {
            db.cache.set(row.key, row)
            return { error: null }
          },
        }
        return query
      },
      rpc: async () => (db.rpcFails ? { data: null, error: { message: 'down' } } : { data: db.limitAnswer ? [db.limitAnswer] : [], error: null }),
    }
  },
}))

const ai = () => ({ models: { generateContent: sdk.generate } }) as never
const signal = () => new AbortController().signal
const ask = (tier: 'main' | 'light' = 'main', extra = {}) =>
  askGemini(ai(), { task: 'generate', tier, system: 's', contents: 'c', schema: {}, signal: signal(), ...extra })
const json = (value: unknown) => ({ text: JSON.stringify(value) })
const SQUARE = { title: 'Квадрат', description: 'Едет', steps: [{ op: 'move', direction: 'forward', value: 10, unit: 'cm' }] }

async function post(body: unknown) {
  const { POST } = await import('@/app/api/generate/route')
  const req = new Request('http://test/api/generate', {
    method: 'POST',
    headers: { 'x-rb-device': 'test-device-1', 'x-forwarded-for': `10.0.0.${Math.floor(Math.random() * 250)}` },
    body: JSON.stringify(body),
  })
  const res = await POST(req as unknown as NextRequest)
  return { status: res.status, data: await res.json() }
}

beforeEach(() => {
  sdk.generate.mockReset()
  resetGeminiCooldowns()
  db.cache.clear()
  db.usage.length = 0
  db.limitAnswer = null
  db.rpcFails = false
  db.enabled = false
  vi.stubEnv('GEMINI_API_KEY', 'site-key')
  vi.stubEnv('GEMINI_API_KEY_DEV', '')
  vi.stubEnv('GEMINI_MENTOR_API_KEY', '')
  vi.stubEnv('GEMINI_MODEL', '')
  vi.stubEnv('GEMINI_MODEL_MAIN', 'model-main')
  vi.stubEnv('GEMINI_MODEL_LIGHT', 'model-light')
  vi.stubEnv('GEMINI_MODEL_FALLBACKS', '')
})

afterEach(() => vi.unstubAllEnvs())

describe('which key', () => {
  it('uses the demo key outside production when there is one', () => {
    vi.stubEnv('NODE_ENV', 'development')
    vi.stubEnv('GEMINI_API_KEY_DEV', 'demo-key')
    expect(geminiKey()).toBe('demo-key')
    expect(geminiKey('mentor')).toBe('demo-key')
  })

  it('never uses the demo key in production', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GEMINI_API_KEY_DEV', 'demo-key')
    expect(geminiKey()).toBe('site-key')
  })

  it('takes the working key when there is no demo key, and the mentor key for the mentor', () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('GEMINI_MENTOR_API_KEY', 'mentor-key')
    expect(geminiKey()).toBe('site-key')
    expect(geminiKey('mentor')).toBe('mentor-key')
  })
})

describe('which model', () => {
  it('sends simple requests to the light model and complex ones to the main one', () => {
    expect(tierForPrompt('Проедь вперёд 20 см', false)).toBe('light')
    expect(tierForPrompt('Езжай вперёд и поверни направо', false)).toBe('light')
    expect(tierForPrompt('drive forward', false)).toBe('light')
    expect(tierForPrompt('Проедь квадрат', false)).toBe('main')
    expect(tierForPrompt('Если стена близко, остановись', false)).toBe('main')
    expect(tierForPrompt('forward, then left, then right, then beep', false)).toBe('main')
    expect(tierForPrompt('Проедь вперёд', true)).toBe('main')
    expect(tierForPrompt('я'.repeat(100), false)).toBe('main')
  })

  it('reads the names from the environment and stays off without them', () => {
    expect(modelsFor('light')).toEqual(['model-light', 'model-main'])
    expect(modelsFor('main')).toEqual(['model-main'])
    vi.stubEnv('GEMINI_MODEL_MAIN', '')
    vi.stubEnv('GEMINI_MODEL_LIGHT', '')
    expect(modelsFor('main')).toEqual([])
  })

  it('gives an invalid light answer one more try on the main model', async () => {
    sdk.generate.mockResolvedValueOnce({ text: 'not json' }).mockResolvedValueOnce(json({ fine: true }))
    await expect(ask('light')).resolves.toEqual({ fine: true })
    expect(sdk.generate.mock.calls.map((c) => c[0].model)).toEqual(['model-light', 'model-main'])
  })

  it('does not ask again after an invalid answer from the main model', async () => {
    sdk.generate.mockResolvedValue({ text: 'not json' })
    await expect(ask('main')).rejects.toMatchObject({ kind: 'failed' })
    expect(sdk.generate).toHaveBeenCalledTimes(1)
  })

  it('counts every real attempt', async () => {
    const seen: string[] = []
    sdk.generate.mockResolvedValueOnce({ text: 'nope' }).mockResolvedValueOnce(json({}))
    await ask('light', { onAttempt: (m: string) => seen.push(m) })
    expect(seen).toEqual(['model-light', 'model-main'])
  })
})

describe('when Gemini says no', () => {
  const quota = (message = 'quota') => new ApiError({ message, status: 429 })

  it('leaves a model alone after 429 instead of asking again', async () => {
    sdk.generate.mockRejectedValue(quota('{"retryDelay":"37s"}'))
    await expect(ask('main')).rejects.toMatchObject({ kind: 'busy', retryAfter: 37 })
    await expect(ask('main')).rejects.toBeInstanceOf(GeminiError)
    expect(sdk.generate).toHaveBeenCalledTimes(1)
  })

  it('moves on to a model that still has quota', async () => {
    vi.stubEnv('GEMINI_MODEL_FALLBACKS', 'model-spare')
    sdk.generate.mockRejectedValueOnce(quota()).mockResolvedValueOnce(json({ ok: 1 }))
    await expect(ask('main')).resolves.toEqual({ ok: 1 })
  })

  it('stops at one model when asked to', async () => {
    vi.stubEnv('GEMINI_MODEL_FALLBACKS', 'model-spare')
    sdk.generate.mockRejectedValue(quota())
    await expect(ask('main', { singleModel: true })).rejects.toMatchObject({ kind: 'busy' })
    expect(sdk.generate).toHaveBeenCalledTimes(1)
  })

  it('knows the daily quota ends at midnight Pacific', () => {
    const now = new Date('2026-11-09T20:00:00Z') // 12:00 in Los Angeles
    expect(secondsToPacificMidnight(now)).toBe(12 * 3600)
    expect(quotaWait('Quota exceeded: GenerateRequestsPerDayPerProject', now)).toBe(12 * 3600)
    expect(quotaWait('nothing useful', now)).toBe(60)
  })

  it('shows the route as resting, with minutes to wait', async () => {
    sdk.generate.mockRejectedValue(quota('{"retryDelay":"120s"}'))
    const { status, data } = await post({ prompt: 'Проедь квадрат', format: 'blocks', lang: 'ru' })
    expect(status).toBe(503)
    expect(data).toMatchObject({ ok: false, error: 'ai_busy', retryAfter: 120 })
  })

  it('every local example is a valid program and compiles', async () => {
    const { programToPython } = await import('@/lib/dsl/compile-python')
    for (const ex of LOCAL_EXAMPLES) {
      const parsed = parseProgram({ title: ex.title.ru, description: ex.description.ru, steps: ex.steps })
      expect(parsed.ok, ex.id).toBe(true)
      if (parsed.ok) expect(programToPython(parsed.value)).toContain('runloop.run(main())')
      expect(ex.title.kk && ex.title.en && ex.description.kk && ex.description.en).toBeTruthy()
    }
  })
})

describe('cache', () => {
  const key = (prompt: string, over = {}) => cacheKey({ prompt, format: 'blocks', lang: 'ru', robot: DEFAULT_ROBOT, ...over })

  it('ignores case and extra spaces', () => {
    expect(normalizePrompt('  Езжай   ПО\tкругу ')).toBe('езжай по кругу')
    expect(key('Езжай  по КРУГУ')).toBe(key('езжай по кругу'))
  })

  it('depends on the mode, the robot and the DSL version', () => {
    expect(key('круг')).not.toBe(key('круг', { format: 'python' }))
    expect(key('круг')).not.toBe(key('круг', { robot: { ...DEFAULT_ROBOT, trackWidthMm: 150 } }))
    expect(cacheKey({ prompt: 'круг', format: 'blocks', lang: 'ru', robot: DEFAULT_ROBOT }, 1)).not.toBe(
      cacheKey({ prompt: 'круг', format: 'blocks', lang: 'ru', robot: DEFAULT_ROBOT }, 2),
    )
  })

  it('answers the second identical request without Gemini', async () => {
    db.enabled = true
    sdk.generate.mockResolvedValue(json(SQUARE))
    const first = await post({ prompt: 'Проедь вперёд', format: 'blocks', lang: 'ru' })
    const second = await post({ prompt: '  проедь   ВПЕРЁД ', format: 'blocks', lang: 'ru' })
    expect(first.data.ok).toBe(true)
    expect(second.data).toEqual(first.data)
    expect(sdk.generate).toHaveBeenCalledTimes(1)
    expect(db.usage.filter((u) => u.cached)).toHaveLength(1)
  })

  it('does not cache a change to an existing program', async () => {
    db.enabled = true
    sdk.generate.mockResolvedValue(json(SQUARE))
    const body = { prompt: 'быстрее', format: 'blocks', lang: 'ru', previous: { program: SQUARE } }
    await post(body)
    await post(body)
    expect(sdk.generate).toHaveBeenCalledTimes(2)
    expect(db.cache.size).toBe(0)
  })

  it('keeps no request text in the usage counters', async () => {
    db.enabled = true
    sdk.generate.mockResolvedValue(json(SQUARE))
    await post({ prompt: 'секретный запрос ребёнка', format: 'blocks', lang: 'ru' })
    await vi.waitFor(() => expect(db.usage.length).toBeGreaterThan(0))
    expect(JSON.stringify(db.usage)).not.toContain('секретный')
    expect(Object.keys(db.usage[0]).sort()).toEqual(['cached', 'error', 'kind', 'model', 'ok'])
  })
})

describe('rate limits', () => {
  const headers = (device?: string, ip = '10.1.1.1') => new Headers({ 'x-forwarded-for': ip, ...(device ? { 'x-rb-device': device } : {}) })

  it('uses the shared counter when the database answers', async () => {
    db.enabled = true
    db.limitAnswer = { allowed: false, remaining: 0, retry_after: 42 }
    await expect(hitLimit('k', 5, 60_000)).resolves.toEqual({ ok: false, retryAfterSeconds: 42, remaining: 0 })
  })

  it('falls back to memory when the database is down', async () => {
    db.enabled = true
    db.rpcFails = true
    const key = `fallback-${Math.random()}`
    expect((await hitLimit(key, 1, 60_000)).ok).toBe(true)
    expect((await hitLimit(key, 1, 60_000)).ok).toBe(false)
  })

  it('counts devices separately behind one address', async () => {
    const ip = `10.2.2.${Math.floor(Math.random() * 250)}`
    expect((await limitRequester(headers('device-aaaa', ip), 'scope', 1, 60_000)).ok).toBe(true)
    expect((await limitRequester(headers('device-aaaa', ip), 'scope', 1, 60_000)).ok).toBe(false)
    expect((await limitRequester(headers('device-bbbb', ip), 'scope', 1, 60_000)).ok).toBe(true)
  })

  it('new invented device ids do not get around the address limit', async () => {
    const ip = `10.3.3.${Math.floor(Math.random() * 250)}`
    let allowed = 0
    for (let i = 0; i < 40; i++) if ((await limitRequester(headers(`invented-${i}`, ip), 'scope2', 1, 60_000)).ok) allowed++
    expect(allowed).toBe(15)
  })

  it('a request without a device id gets the strict limit', async () => {
    const ip = `10.4.4.${Math.floor(Math.random() * 250)}`
    expect((await limitRequester(headers(undefined, ip), 'scope3', 1, 60_000)).ok).toBe(true)
    expect((await limitRequester(headers(undefined, ip), 'scope3', 1, 60_000)).ok).toBe(false)
  })

  it('the in-memory limiter still works alone', () => {
    const key = `solo-${Math.random()}`
    expect(rateLimit(key, 1, 1000, 0).ok).toBe(true)
    expect(rateLimit(key, 1, 1000, 10).ok).toBe(false)
    expect(rateLimit(key, 1, 1000, 2000).ok).toBe(true)
  })
})

describe('usage summary', () => {
  it('adds up requests, cache hits and errors', () => {
    const s = summarizeUsage([
      { kind: 'generate', model: 'm1', cached: false, ok: true, error: null },
      { kind: 'generate', model: null, cached: true, ok: true, error: null },
      { kind: 'mentor', model: 'm2', cached: false, ok: false, error: 'quota' },
    ])
    expect(s).toMatchObject({ requests: 2, cached: 1, failed: 1 })
    expect(s.byKind[0]).toEqual({ name: 'generate', requests: 1, cached: 1, failed: 0 })
    expect(s.errors).toEqual([{ name: 'quota', count: 1 }])
  })
})
