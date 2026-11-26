import { describe, expect, it } from 'vitest'

import { DEFAULT_COSMETICS, EMPTY_STATE, type LearnState, type NewEvent, type Profile, appendEvents } from '@/lib/learn/state'
import { addDays, challengeIndex, dayKey, isWeekend, isoWeek, streakInfo } from '@/lib/learn/streak'

const profile = (over: Partial<Profile> = {}): Profile => ({
  nickname: 'Robo',
  ageRange: '13-15',
  timezone: 'Asia/Almaty',
  goal: { kind: 'lessons', n: 1 },
  skipWeekends: false,
  reminders: { enabled: false, time: '18:00' },
  cosmetics: DEFAULT_COSMETICS,
  buddy: { model: 'rover', name: '' },
  parentConsent: true,
  createdAt: 0,
  anonId: 'anon-12345678',
  tour: false,
  learningPath: null,
  ...over,
})

/** A lesson finished at a local time in Almaty (UTC+5). */
const at = (local: string, offsetHours = 5) => Date.parse(`${local}Z`) - offsetHours * 3600_000
let n = 0
const lesson = (time: number): NewEvent => ({ kind: 'lesson_done', lesson: `l${n++}`, track: 'start', unit: 'u', project: false, seconds: 60, at: time })

function withLessons(times: number[], p: Partial<Profile> = {}): LearnState {
  return appendEvents({ ...EMPTY_STATE, profile: profile(p) }, times.map(lesson))
}

describe('days in the learner time zone', () => {
  it('puts 23:30 and 00:30 local time on different days', () => {
    expect(dayKey(at('2026-10-20T23:30:00'), 'Asia/Almaty')).toBe('2026-10-20')
    expect(dayKey(at('2026-10-21T00:30:00'), 'Asia/Almaty')).toBe('2026-10-21')
  })

  it('uses the zone, not UTC: 02:00 in Almaty is still the previous day in UTC', () => {
    const t = at('2026-10-21T02:00:00')
    expect(dayKey(t, 'Asia/Almaty')).toBe('2026-10-21')
    expect(dayKey(t, 'UTC')).toBe('2026-10-20')
  })

  it('falls back to UTC for an unknown zone', () => {
    expect(dayKey(Date.parse('2026-10-21T10:00:00Z'), 'Mars/Olympus')).toBe('2026-10-21')
  })

  it('walks dates and weekdays', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29')
    expect(isWeekend('2026-10-24')).toBe(true) // Saturday
    expect(isWeekend('2026-10-26')).toBe(false) // Monday
  })

  it('numbers ISO weeks and picks a challenge per week', () => {
    expect(isoWeek('2026-10-26')).toBe('2026-W44')
    expect(isoWeek('2027-01-01')).toBe('2026-W53')
    expect(challengeIndex('2026-W44', 6)).toBe(challengeIndex('2026-W44', 6))
    expect(challengeIndex('2026-W44', 6)).not.toBe(challengeIndex('2026-W45', 6))
    expect(challengeIndex('bad', 6)).toBe(0)
  })
})

describe('streak', () => {
  it('counts days in a row and keeps today open', () => {
    const s = withLessons([at('2026-10-20T10:00:00'), at('2026-10-21T10:00:00'), at('2026-10-22T10:00:00')])
    const morningNext = streakInfo(s, at('2026-10-23T08:00:00'))
    expect(morningNext.current).toBe(3)
    expect(morningNext.today.met).toBe(false)
    expect(morningNext.days.get('2026-10-23')).toBe('today')
  })

  it('resets after a missed day without freezes', () => {
    const s = withLessons([at('2026-10-20T10:00:00'), at('2026-10-21T10:00:00'), at('2026-10-23T10:00:00')])
    const info = streakInfo(s, at('2026-10-23T12:00:00'))
    expect(info.current).toBe(1)
    expect(info.best).toBe(2)
    expect(info.days.get('2026-10-22')).toBe('missed')
  })

  it('a lesson just before local midnight counts for that day', () => {
    const s = withLessons([at('2026-10-20T23:59:00'), at('2026-10-21T00:01:00')])
    expect(streakInfo(s, at('2026-10-21T12:00:00')).current).toBe(2)
    // The same moments seen in UTC are one day.
    expect(streakInfo({ ...s, profile: profile({ timezone: 'UTC' }) }, at('2026-10-21T12:00:00')).current).toBe(1)
  })

  it('earns a freeze every 7 days and spends it on a missed day', () => {
    const days = Array.from({ length: 7 }, (_, i) => at(`2026-10-${String(1 + i).padStart(2, '0')}T10:00:00`))
    const s = withLessons([...days, at('2026-10-09T10:00:00')]) // 8th is missed
    const info = streakInfo(s, at('2026-10-09T12:00:00'))
    expect(info.days.get('2026-10-08')).toBe('frozen')
    expect(info.current).toBe(8)
    expect(info.freezes).toBe(0)
  })

  it('keeps at most 2 freezes', () => {
    const days = Array.from({ length: 28 }, (_, i) => at(addDays('2026-09-01', i) + 'T10:00:00'))
    expect(streakInfo(withLessons(days), at('2026-09-28T12:00:00')).freezes).toBe(2)
  })

  it('skips weekends when asked, and counts them when the goal is met', () => {
    // Fri 23, (Sat 24, Sun 25 nothing), Mon 26
    const times = [at('2026-10-22T10:00:00'), at('2026-10-23T10:00:00'), at('2026-10-26T10:00:00')]
    expect(streakInfo(withLessons(times), at('2026-10-26T12:00:00')).current).toBe(1)
    const rest = streakInfo(withLessons(times, { skipWeekends: true }), at('2026-10-26T12:00:00'))
    expect(rest.current).toBe(3)
    expect(rest.days.get('2026-10-24')).toBe('rest')
    const withSaturday = withLessons([...times, at('2026-10-24T10:00:00')], { skipWeekends: true })
    expect(streakInfo(withSaturday, at('2026-10-26T12:00:00')).current).toBe(4)
  })

  it('supports the 2-lesson and 15-minute goals', () => {
    const one = withLessons([at('2026-10-20T10:00:00')], { goal: { kind: 'lessons', n: 2 } })
    expect(streakInfo(one, at('2026-10-20T12:00:00')).today).toMatchObject({ met: false, progress: 0.5 })
    const minutes = appendEvents({ ...EMPTY_STATE, profile: profile({ goal: { kind: 'minutes', n: 15 } }) }, [
      { kind: 'time', seconds: 600, at: at('2026-10-20T10:00:00') },
      { kind: 'time', seconds: 300, at: at('2026-10-20T11:00:00') },
    ])
    expect(streakInfo(minutes, at('2026-10-20T12:00:00')).today).toMatchObject({ met: true, minutes: 15 })
  })

  it('is empty for a new learner', () => {
    expect(streakInfo(EMPTY_STATE, Date.parse('2026-10-20T10:00:00Z'))).toMatchObject({ current: 0, best: 0, freezes: 0 })
  })
})
