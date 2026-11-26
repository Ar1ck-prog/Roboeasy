import { describe, expect, it } from 'vitest'

import { sanitizeHint } from '@/lib/learn/mentor'
import { EMPTY_STATE, type NewEvent, appendEvents, completedLessons, parseState } from '@/lib/learn/state'
import { totalXp } from '@/lib/learn/economy'
import { XP_RULES, levelFor } from '@/lib/learn/xp'

const lesson = (id: string, project = false): NewEvent => ({ kind: 'lesson_done', lesson: id, track: 'start', unit: 'u1', project, seconds: 120 })
const step = (id: string, firstTry: boolean, hints = 0, stepType = 'code'): NewEvent => ({
  kind: 'step_done',
  lesson: 'start-01',
  step: id,
  stepType,
  firstTry,
  hints,
})

describe('event log', () => {
  it('ignores repeated "earn once" events', () => {
    let s = appendEvents(EMPTY_STATE, [lesson('start-01')], 1)
    s = appendEvents(s, [lesson('start-01')], 2)
    expect(s.events).toHaveLength(1)
    expect(s.events[0].at).toBe(1)
  })

  it('returns the same object when nothing is added', () => {
    const s = appendEvents(EMPTY_STATE, [lesson('start-01')])
    expect(appendEvents(s, [lesson('start-01')])).toBe(s)
  })

  it('keeps every mistake (random ids)', () => {
    const m: NewEvent = { kind: 'mistake', lesson: 'start-01', step: 's4' }
    const s = appendEvents(EMPTY_STATE, [m, m, m])
    expect(s.events).toHaveLength(3)
  })

  it('treats "known" lessons as completed', () => {
    const s = appendEvents(EMPTY_STATE, [{ kind: 'known', lessons: ['start-01', 'start-02'], skills: [] }])
    expect([...completedLessons(s)]).toEqual(['start-01', 'start-02'])
  })

  it('falls back to an empty state on broken storage', () => {
    expect(parseState({ version: 2 })).toEqual(EMPTY_STATE)
    expect(parseState('nonsense')).toEqual(EMPTY_STATE)
  })
})

describe('XP', () => {
  it('is idempotent: replaying a lesson gives nothing', () => {
    const once = appendEvents(EMPTY_STATE, [step('s4', true), lesson('start-01')])
    const twice = appendEvents(once, [step('s4', true), lesson('start-01')])
    expect(totalXp(once)).toBe(XP_RULES.lesson + XP_RULES.firstTry)
    expect(totalXp(twice)).toBe(totalXp(once))
  })

  it('counts duplicate ids once even if they slip into storage', () => {
    const s = appendEvents(EMPTY_STATE, [lesson('start-01')])
    expect(totalXp({ ...s, events: [...s.events, ...s.events] })).toBe(XP_RULES.lesson)
  })

  it('gives the first-try bonus only without hints, and not for theory', () => {
    const s = appendEvents(EMPTY_STATE, [step('a', true, 1), step('b', false), step('c', true, 0, 'theory'), step('d', true, 0, 'predict')])
    expect(totalXp(s)).toBe(XP_RULES.firstTry)
  })

  it('adds the project bonus', () => {
    expect(totalXp(appendEvents(EMPTY_STATE, [lesson('start-08', true)]))).toBe(XP_RULES.lesson + XP_RULES.project)
  })

  it('maps XP to levels', () => {
    expect(levelFor(0)).toMatchObject({ index: 0, from: 0, to: 100, progress: 0 })
    expect(levelFor(175)).toMatchObject({ index: 1, progress: 0.5 })
    expect(levelFor(5000)).toMatchObject({ index: 9, to: null, progress: 1 })
  })
})

describe('mentor hints', () => {
  const reference = [
    { op: 'move', direction: 'forward', value: 30, unit: 'cm' },
    { op: 'turn', direction: 'right', degrees: 90 },
    { op: 'move', direction: 'forward', value: 45, unit: 'cm' },
  ] as Parameters<typeof sanitizeHint>[1]

  it('passes a short hint', () => {
    expect(sanitizeHint('  Посмотри, сколько клеток до финиша.  ', reference)).toBe('Посмотри, сколько клеток до финиша.')
  })

  it('rejects code and dictated solutions', () => {
    expect(sanitizeHint('{"op":"move"}', reference)).toBeNull()
    expect(sanitizeHint('Едь 30, поверни на 90, потом 45.', reference)).toBeNull()
    expect(sanitizeHint('x'.repeat(401), reference)).toBeNull()
    expect(sanitizeHint('   ', reference)).toBeNull()
  })
})

describe('learning path in the profile', () => {
  const base = {
    nickname: 'Robo',
    ageRange: 'under-10',
    timezone: 'Asia/Almaty',
    goal: { kind: 'lessons', n: 1 },
    createdAt: 1,
    anonId: 'anon_12345678',
  }

  it('reads an old saved state without learningPath as "not chosen"', () => {
    const s = parseState({ version: 1, profile: base, events: [] })
    expect(s.profile).not.toBeNull()
    expect(s.profile!.learningPath).toBeNull()
  })

  it('keeps a chosen path and rejects unknown ones', () => {
    expect(parseState({ version: 1, profile: { ...base, learningPath: 'wedo' }, events: [] }).profile!.learningPath).toBe('wedo')
    expect(parseState({ version: 1, profile: { ...base, learningPath: 'ev3' }, events: [] })).toEqual(EMPTY_STATE)
  })

  it('survives the trip to the cloud profile row and back (settings jsonb, no migration)', async () => {
    const { fromRow, toRow } = await import('@/lib/learn/cloud')
    for (const learningPath of ['wedo', 'spike', null] as const) {
      const profile = parseState({ version: 1, profile: { ...base, learningPath }, events: [] }).profile!
      const row = toRow('00000000-0000-0000-0000-000000000001', profile)
      expect(row.settings.learningPath).toBe(learningPath)
      const back = fromRow(row)!
      expect({ ...back, createdAt: profile.createdAt }).toEqual(profile)
    }
    // Rows written before paths existed come back as "not chosen".
    const row = toRow('00000000-0000-0000-0000-000000000001', parseState({ version: 1, profile: base, events: [] }).profile!)
    delete row.settings.learningPath
    expect(fromRow(row)!.learningPath).toBeNull()
  })
})
