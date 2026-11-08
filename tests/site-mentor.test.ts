import { describe, expect, it } from 'vitest'

import { PROGRAM_JSON_SCHEMA, findEmptyBlocks, parseProgram } from '@/lib/dsl/schema'
import type { Step } from '@/lib/dsl/types'
import { COURSE } from '@/lib/learn/course'
import { readLesson, readyLessonIds } from '@/lib/learn/content'
import { COIN_RULES } from '@/lib/learn/economy'
import { GLOSSARY } from '@/lib/learn/glossary'
import { sanitizeAnswer, siteKnowledge, siteMentorRequestSchema, siteMentorSystemPrompt, siteMentorUserMessage } from '@/lib/learn/site-mentor'

const valid = { lang: 'ru', page: '/ru/sandbox', messages: [{ from: 'me', text: 'Как подключить робота?' }] }

describe('site mentor knowledge', () => {
  it('is built from the real course, glossary and coin rules', () => {
    const k = siteKnowledge('ru')
    const track = COURSE.tracks[0]
    expect(k).toContain(track.title.ru)
    expect(k).toContain(track.units[0].title.ru)
    expect(k).toContain(GLOSSARY[0].text.ru)
    expect(k).toContain(`${COIN_RULES.lesson} for a lesson`)
    expect(siteKnowledge('en')).toContain(track.title.en)
  })

  it('never contains lesson solutions', () => {
    const k = siteKnowledge('ru')
    expect(k).not.toContain('"op"')
    for (const id of readyLessonIds()) {
      for (const step of readLesson(id)?.steps ?? []) {
        if ('reference' in step && step.reference) expect(k).not.toContain(JSON.stringify(step.reference))
      }
    }
  })

  it('keeps the safety rules in every language', () => {
    for (const lang of ['ru', 'kk', 'en'] as const) {
      const p = siteMentorSystemPrompt(lang)
      expect(p).toMatch(/never the complete solution/)
      expect(p).toMatch(/personal information/)
      expect(p).toMatch(/adult they trust/)
      expect(p).toMatch(/offTopic/)
    }
  })

  it('passes the sandbox program as data', () => {
    const msg = siteMentorUserMessage(siteMentorRequestSchema.parse({ ...valid, program: 'print(1)' }))
    expect(msg).toContain('programOpenInSandbox')
    expect(msg).toContain('print(1)')
  })
})

describe('site mentor requests', () => {
  it('accepts a normal question', () => {
    expect(siteMentorRequestSchema.safeParse(valid).success).toBe(true)
  })

  it.each([
    ['a long question', { messages: [{ from: 'me', text: 'x'.repeat(301) }] }],
    ['an empty question', { messages: [{ from: 'me', text: '   ' }] }],
    ['a conversation ending with the mentor', { messages: [{ from: 'mentor', text: 'hi' }] }],
    ['too much history', { messages: Array.from({ length: 9 }, () => ({ from: 'me', text: 'q' })) }],
    ['a page that is not a path', { page: 'https://example.com' }],
    ['an unknown language', { lang: 'de' }],
    ['a huge program', { program: 'x'.repeat(6001) }],
  ])('rejects %s', (_name, patch) => {
    expect(siteMentorRequestSchema.safeParse({ ...valid, ...patch }).success).toBe(false)
  })
})

describe('sanitizing answers', () => {
  it('removes links and keeps the text', () => {
    expect(sanitizeAnswer('Смотри https://evil.example/a тут и www.evil.example.')).toBe('Смотри тут и')
  })

  it('cuts long answers at a sentence', () => {
    const long = `${'Короткое предложение. '.repeat(100)}`
    const out = sanitizeAnswer(long)!
    expect(out.length).toBeLessThanOrEqual(900)
    expect(out.endsWith('.')).toBe(true)
  })

  it('refuses an empty answer or a pasted program', () => {
    expect(sanitizeAnswer('   ')).toBeNull()
    expect(sanitizeAnswer('{"op": "move"}')).toBeNull()
  })
})

describe('generated programs', () => {
  const forward: Step = { op: 'move', direction: 'forward', value: 10, unit: 'cm' }

  it('finds loops with nothing inside, at any depth', () => {
    expect(findEmptyBlocks([{ op: 'repeat', times: 4, steps: [] }])).toEqual(['steps[0] ("repeat") has no steps inside'])
    expect(findEmptyBlocks([forward, { op: 'repeat', times: 2, steps: [{ op: 'forever', steps: [] }] }])).toEqual([
      'steps[1].steps[0] ("forever") has no steps inside',
    ])
    expect(findEmptyBlocks([{ op: 'if', condition: { sensor: 'button', button: 'left', state: 'pressed' }, then: [] }])).toHaveLength(1)
  })

  it('accepts filled loops and an "if" without "else"', () => {
    expect(findEmptyBlocks([forward, { op: 'repeat', times: 4, steps: [forward] }])).toEqual([])
    expect(findEmptyBlocks([{ op: 'if', condition: { sensor: 'button', button: 'left', state: 'pressed' }, then: [forward] }])).toEqual([])
  })

  it('still lets a learner keep a half-built loop', () => {
    expect(parseProgram({ title: 'p', description: '', steps: [{ op: 'repeat', times: 2, steps: [] }] }).ok).toBe(true)
  })

  it('tells the model that loop bodies cannot be empty', () => {
    const step = (PROGRAM_JSON_SCHEMA.$defs as Record<string, { properties: Record<string, { minItems?: number }> }>).Step.properties
    expect(step.steps.minItems).toBe(1)
    expect(step.then.minItems).toBe(1)
    expect(step.else.minItems).toBeUndefined()
  })

  it('fills in a beep the AI left without note or length', () => {
    const r = parseProgram({ title: 'p', description: '', steps: [{ op: 'beep' }, { op: 'beep', note: 60 }] })
    expect(r.ok && r.value.steps).toEqual([
      { op: 'beep', note: 72, seconds: 0.2 },
      { op: 'beep', note: 60, seconds: 0.2 },
    ])
  })
})
