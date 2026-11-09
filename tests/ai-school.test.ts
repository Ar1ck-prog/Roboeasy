import { ApiError } from '@google/genai'
import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { KnnModel, pixelsToVector } from '@/lib/ai-school/knn'
import { SAMPLE_GAME, checkVibeHtml, sandboxedDocument, vibeRequestSchema, vibeSystemPrompt } from '@/lib/ai-school/vibe'
import { getAiSchoolText } from '@/lib/i18n/ai-school'
import { resetGeminiCooldowns } from '@/lib/gemini'
import { COURSE, readLesson } from '@/lib/learn/content'

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
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: () => null }))

const PAGE = '<!doctype html><html><head></head><body><canvas id="c"></canvas><script>var a=1</script></body></html>'

async function post(body: unknown, device = `d-${Math.random().toString(36).slice(2, 12)}`) {
  const { POST } = await import('@/app/api/vibe/route')
  const res = await POST(
    new Request('http://t/api/vibe', {
      method: 'POST',
      headers: { 'x-rb-device': device, 'x-forwarded-for': `10.7.${Math.floor(Math.random() * 250)}.1` },
      body: JSON.stringify(body),
    }) as unknown as NextRequest,
  )
  return { status: res.status, data: await res.json() }
}

beforeEach(() => {
  sdk.generate.mockReset()
  resetGeminiCooldowns()
  vi.stubEnv('GEMINI_API_KEY', 'k')
  vi.stubEnv('GEMINI_MODEL_MAIN', 'm')
  vi.stubEnv('GEMINI_MODEL_LIGHT', 'l')
})

describe('the section', () => {
  const track = COURSE.tracks.find((t) => t.id === 'ai-basics')!

  it('has six modules of 3 to 5 ready lessons', () => {
    expect(track.units).toHaveLength(6)
    for (const unit of track.units) {
      expect(unit.lessons.length).toBeGreaterThanOrEqual(3)
      expect(unit.lessons.length).toBeLessThanOrEqual(5)
      for (const ref of unit.lessons) expect(ref.status).toBe('ready')
    }
  })

  it('every lesson has an automatic check', () => {
    for (const unit of track.units)
      for (const ref of unit.lessons) {
        const lesson = readLesson(ref.id)!
        expect(
          lesson.steps.some((s) => s.type === 'quiz' || s.type === 'widget'),
          ref.id,
        ).toBe(true)
      }
  })

  it('the practical module has the gesture, colour and few-examples tasks, and vibe coding exists', () => {
    const widgets = track.units.flatMap((u) => u.lessons).flatMap((ref) => readLesson(ref.id)!.steps.flatMap((s) => (s.type === 'widget' ? [s.widget] : [])))
    expect(widgets.sort()).toEqual(['color', 'few-examples', 'gesture', 'vibe'])
  })

  it('texts exist in every language', () => {
    const keys = (o: unknown, at = ''): string[] => (typeof o === 'object' && o ? Object.entries(o).flatMap(([k, v]) => keys(v, `${at}.${k}`)) : [at])
    expect(keys(getAiSchoolText('kk'))).toEqual(keys(getAiSchoolText('ru')))
    expect(keys(getAiSchoolText('en'))).toEqual(keys(getAiSchoolText('ru')))
  })
})

describe('in-browser model', () => {
  const pattern = (bright: boolean, noise = 0) => Array.from({ length: 64 }, (_, i) => (i % 8 < 4 === bright ? 200 : 40) + Math.sin(i * 3.1) * noise)

  it('waits until it has two classes', () => {
    const m = new KnnModel<'a' | 'b'>()
    m.add('a', pattern(true))
    expect(m.predict(pattern(true))).toBeNull()
  })

  it('tells apart what it was taught', () => {
    const m = new KnnModel<'a' | 'b'>()
    for (let n = 0; n < 20; n++) {
      m.add('a', pattern(true, n))
      m.add('b', pattern(false, n))
    }
    expect(m.predict(pattern(true, 5))).toMatchObject({ label: 'a' })
    expect(m.predict(pattern(false, 5))).toMatchObject({ label: 'b' })
    expect(m.predict(pattern(false, 5))!.confidence).toBeGreaterThan(0.9)
  })

  it('is unsure on something between its examples', () => {
    const m = new KnnModel<'a' | 'b'>()
    m.add('a', pattern(true))
    m.add('b', pattern(false))
    const between = pattern(true).map((v, i) => v + pattern(false)[i] + Math.cos(i) * 4)
    expect(m.predict(between)!.confidence).toBeLessThan(0.75)
  })

  it('counts examples and reads brightness from pixels', () => {
    const m = new KnnModel<'a'>()
    m.add('a', [1, 2])
    expect(m.count('a')).toBe(1)
    expect(pixelsToVector(new Uint8ClampedArray([255, 255, 255, 255, 0, 0, 0, 255]))).toEqual([255, 0])
  })
})

describe('vibe coding', () => {
  it('accepts a self-contained page and the sample game', () => {
    expect(checkVibeHtml(PAGE)).toBeNull()
    expect(checkVibeHtml(SAMPLE_GAME)).toBeNull()
  })

  it.each([
    ['external script', '<html><script src="x.js"></script></html>'],
    ['a link', '<html><body><a href="https://x.y">x</a></body></html>'],
    ['network', '<html><script>fetch("/a")</script></html>'],
    ['storage', '<html><script>localStorage.x=1</script></html>'],
    ['the parent page', '<html><script>window.parent.x=1</script></html>'],
    ['a form', '<html><body><form></form><div>aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa</div></body></html>'],
  ])('rejects %s', (_, html) => {
    expect(checkVibeHtml(html.padEnd(60, ' '))).not.toBeNull()
  })

  it('the frame blocks every load', () => {
    expect(sandboxedDocument(PAGE)).toContain("default-src 'none'")
    expect(sandboxedDocument('<div>hi</div>')).toContain('Content-Security-Policy')
  })

  it('limits the length of a request', () => {
    expect(vibeRequestSchema.safeParse({ lang: 'ru', prompt: 'я'.repeat(401) }).success).toBe(false)
  })

  it('the prompt refuses unsafe requests and forbids the network', () => {
    const p = vibeSystemPrompt('ru')
    expect(p).toContain('"unsafe": true')
    expect(p).toContain('no network')
  })

  it('builds a page', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify({ unsafe: false, title: 'Игра', html: PAGE }) })
    await expect(post({ lang: 'ru', prompt: 'игра про круг' })).resolves.toMatchObject({ data: { ok: true, html: PAGE } })
  })

  it('refuses when the model says it is unsafe', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify({ unsafe: true }) })
    await expect(post({ lang: 'ru', prompt: 'что-то плохое' })).resolves.toMatchObject({ status: 422, data: { error: 'refused' } })
  })

  it('asks once more about a page that breaks the rules, then gives up', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify({ unsafe: false, html: '<html><script>fetch("/x")</script></html>'.padEnd(60, ' ') }) })
    await expect(post({ lang: 'ru', prompt: 'игра' })).resolves.toMatchObject({ status: 502 })
    expect(sdk.generate).toHaveBeenCalledTimes(2)
  })

  it('stops after the daily limit', async () => {
    sdk.generate.mockResolvedValue({ text: JSON.stringify({ unsafe: false, html: PAGE }) })
    const device = `limit-${Math.random().toString(36).slice(2, 10)}`
    const { POST } = await import('@/app/api/vibe/route')
    const call = (min: number) =>
      POST(
        new Request('http://t/api/vibe', {
          method: 'POST',
          headers: { 'x-rb-device': device, 'x-forwarded-for': `10.8.8.${min}` },
          body: JSON.stringify({ lang: 'ru', prompt: 'игра про круг' }),
        }) as unknown as NextRequest,
      )
    let status = 200
    for (let i = 0; i < 8 && status === 200; i++) status = (await call(i)).status
    expect(status).toBe(429)
  })

  it('reports a quota error as resting', async () => {
    sdk.generate.mockRejectedValue(new ApiError({ message: 'x', status: 429 }))
    await expect(post({ lang: 'ru', prompt: 'игра' })).resolves.toMatchObject({ data: { error: 'resting' } })
  })
})
