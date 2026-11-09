import fs from 'node:fs'
import path from 'node:path'

import { ApiError } from '@google/genai'
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { resetGeminiCooldowns } from '@/lib/gemini'
import { cleanVideoText, videoRequestSchema, videoSystemPrompt } from '@/lib/video/debug'

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

const usage = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('@/lib/ai/usage', () => ({
  recordUsage: async (row: Record<string, unknown>) => {
    usage.push(row)
  },
}))
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => null }))

const JPEG = '/9j/AAAA'
const good = {
  lang: 'ru',
  expected: 'Повернуть на 90 градусов',
  program: 'await turn(90, speed)',
  frames: [
    { t: 0, data: JPEG },
    { t: 0.5, data: JPEG },
  ],
}
const answer = {
  isRobotVideo: true,
  observed: 'Робот повернул примерно на 70 градусов.',
  question: 'Как думаешь, что влияет на угол поворота?',
  hint: 'Посмотри на настройку колеи.',
}

async function post(body: unknown, device = `device-${Math.random().toString(36).slice(2, 12)}`) {
  const { POST } = await import('@/app/api/video-debug/route')
  const res = await POST(
    new Request('http://t/api/video-debug', {
      method: 'POST',
      headers: { 'x-rb-device': device, 'x-forwarded-for': `10.9.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  )
  return { status: res.status, data: await res.json() }
}

beforeEach(() => {
  sdk.generate.mockReset()
  usage.length = 0
  resetGeminiCooldowns()
  vi.stubEnv('GEMINI_API_KEY', 'k')
  vi.stubEnv('GEMINI_MODEL_MAIN', 'model-main')
  vi.stubEnv('GEMINI_MODEL_LIGHT', 'model-light')
})

describe('video debug', () => {
  it('sends the stills to the main model and answers with a question first', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify(answer) })
    const { data } = await post(good)
    expect(data).toMatchObject({ ok: true, question: answer.question, hint: answer.hint, observed: answer.observed })
    const call = sdk.generate.mock.calls[0][0]
    expect(call.model).toBe('model-main')
    expect(call.contents[0].parts.filter((p: { inlineData?: unknown }) => p.inlineData)).toHaveLength(2)
  })

  it('allows three videos a day per device', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify(answer) })
    const device = `limit-${Math.random().toString(36).slice(2, 10)}`
    for (let i = 0; i < 3; i++) expect((await post(good, device)).data.ok).toBe(true)
    const fourth = await post(good, device)
    expect(fourth.status).toBe(429)
    expect(fourth.data.error).toBe('daily_limit')
    expect(sdk.generate).toHaveBeenCalledTimes(3)
  })

  it('an invalid request does not use up the day or the quota', async () => {
    const device = `bad-${Math.random().toString(36).slice(2, 10)}`
    for (let i = 0; i < 5; i++) expect((await post({ ...good, frames: [{ t: 0, data: 'not-a-jpeg' }] }, device)).status).toBe(400)
    expect(sdk.generate).not.toHaveBeenCalled()
  })

  it('rejects too many stills and an empty expectation', () => {
    expect(videoRequestSchema.safeParse({ ...good, frames: Array.from({ length: 31 }, () => ({ t: 0, data: JPEG })) }).success).toBe(false)
    expect(videoRequestSchema.safeParse({ ...good, expected: ' ' }).success).toBe(false)
  })

  it('says so when the video shows no robot', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify({ isRobotVideo: false }) })
    const { status, data } = await post(good)
    expect(status).toBe(422)
    expect(data.error).toBe('not_robot')
  })

  it('reports a quota error as resting, with minutes to wait', async () => {
    sdk.generate.mockRejectedValue(new ApiError({ message: '{"retryDelay":"120s"}', status: 429 }))
    expect((await post(good)).data).toMatchObject({ ok: false, error: 'resting', retryAfter: 120 })
  })

  it('removes code, links and emoji from the answer', () => {
    expect(cleanVideoText('Смотри ```turn(90)``` тут https://x.y ок 🤖')).toBe('Смотри тут ок')
    expect(cleanVideoText(5)).toBe('')
  })

  it('counts the request without keeping any of its content', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify(answer) })
    await post(good)
    expect(usage).toEqual([{ kind: 'video', model: 'model-main', ok: true }])
  })

  it('never stores the stills: the route has no file or database writes', () => {
    const source = fs.readFileSync(path.resolve('app/api/video-debug/route.ts'), 'utf8')
    expect(source).not.toMatch(/node:fs|writeFile|\.from\(|supabaseAdmin/)
  })

  it('the prompt forbids giving the solution and talking about people', () => {
    const prompt = videoSystemPrompt('ru')
    expect(prompt).toContain('Never give the solution')
    expect(prompt).toContain('Say nothing about people')
    expect(prompt).toContain('Russian')
  })
})
