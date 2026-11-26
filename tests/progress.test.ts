import { describe, expect, it } from 'vitest'

import { ACHIEVEMENTS, earnedAchievements, newAchievements } from '@/lib/learn/achievements'
import { CHALLENGES } from '@/lib/learn/challenge'
import { runChecks } from '@/lib/learn/checks'
import { COURSE, practiceItems, readLesson, spread } from '@/lib/learn/content'
import { PLACEMENT, PLACEMENT_ITEMS, placementResult } from '@/lib/learn/placement'
import { SHOP, isUnlocked } from '@/lib/learn/shop'
import { dueSkills, lessonStates, nextLesson, skillMemory, skillRadar, trackProgress, trackUnlocked } from '@/lib/learn/progress'
import { EMPTY_STATE, type NewEvent, appendEvents, completedLessons } from '@/lib/learn/state'

const DAY = 86400_000
const track = (id: string) => COURSE.tracks.find((t) => t.id === id)!
const done = (...ids: string[]) => new Set(ids)
const lessonDone = (id: string, at: number, trackId = 'start'): NewEvent => ({
  kind: 'lesson_done',
  lesson: id,
  track: trackId,
  unit: 'u',
  project: false,
  seconds: 60,
  at,
})

describe('unlocking', () => {
  it('starts with the first lesson of Start and nothing else', () => {
    const states = lessonStates(done(), track('start'), COURSE)
    expect(states.get('start-01')).toBe('current')
    expect(states.get('start-02')).toBe('locked')
    expect(trackUnlocked(done(), track('blocks'), COURSE)).toBe(false)
    expect(nextLesson(done(), COURSE)?.id).toBe('start-01')
  })

  it('opens lessons one by one', () => {
    const states = lessonStates(done('start-01'), track('start'), COURSE)
    expect(states.get('start-01')).toBe('done')
    expect(states.get('start-02')).toBe('current')
    expect(states.get('start-03')).toBe('locked')
  })

  it('opens the next track when the prerequisites are finished', () => {
    const start = track('start').units.flatMap((u) => u.lessons.map((l) => l.id))
    expect(trackUnlocked(done(...start), track('blocks'), COURSE)).toBe(true)
    expect(nextLesson(done(...start), COURSE)?.id).toBe('blocks-01')
    expect(trackProgress(done(...start), track('start'), COURSE)).toMatchObject({ complete: true, done: 8, ready: 8 })
  })

  it('opens a track early when one of its lessons is known (test)', () => {
    expect(trackUnlocked(done('blocks-01'), track('blocks'), COURSE)).toBe(true)
  })

  it('shows planned lessons as "soon" without blocking', () => {
    // Every lesson is written now; a copy of the course with a planned unit checks the rule.
    const planned = structuredClone(COURSE)
    const build = planned.tracks.find((t) => t.id === 'build')!
    build.units[0].lessons.forEach((l) => (l.status = 'todo'))
    const states = lessonStates(done(...track('start').units.flatMap((u) => u.lessons.map((l) => l.id))), build, planned)
    expect(build.units[0].lessons.every((l) => states.get(l.id) === 'soon')).toBe(true)
    expect(states.get(build.units[1].lessons[0].id)).toBe('current')
  })

  it('suggests the virtual main path (Blocks) right after Start, before the kit-heavy Build track', () => {
    const ids = COURSE.tracks.map((t) => t.id)
    expect(ids.indexOf('blocks')).toBeLessThan(ids.indexOf('build'))
  })

  it('has content for every planned lesson', () => {
    expect(COURSE.tracks.flatMap((t) => t.units.flatMap((u) => u.lessons)).filter((l) => l.status !== 'ready')).toEqual([])
  })

  it('counts "known" lessons as done', () => {
    const s = appendEvents(EMPTY_STATE, [{ kind: 'known', lessons: ['start-01', 'start-02'], skills: ['robot-basics'], source: 'unit' }])
    expect(lessonStates(completedLessons(s), track('start'), COURSE).get('start-03')).toBe('current')
  })
})

describe('skills', () => {
  it('lists every lesson ref skill as in the lesson file', () => {
    for (const t of COURSE.tracks)
      for (const u of t.units) for (const l of u.lessons) if (l.status === 'ready') expect(l.skills, l.id).toEqual(readLesson(l.id)!.skills)
  })

  it('fills the radar as lessons get done', () => {
    const before = skillRadar(done(), COURSE)
    const after = skillRadar(done('start-01', 'start-02'), COURSE)
    expect(before.every((g) => g.value === 0)).toBe(true)
    expect(after.find((g) => g.id === 'basics')!.value).toBeGreaterThan(0)
    expect(after).toHaveLength(8)
  })

  it('schedules review: mistakes come back sooner, good reviews later', () => {
    const t0 = Date.parse('2026-10-01T10:00:00Z')
    const s = appendEvents(EMPTY_STATE, [lessonDone('start-02', t0), { kind: 'mistake', lesson: 'start-06', step: 'x', at: t0 }, lessonDone('start-06', t0)])
    const mem = skillMemory(s, COURSE)
    expect(mem.get('robot-basics')!.box).toBe(2)
    expect(mem.get('motion')!.box).toBe(1)
    expect(dueSkills(s, COURSE, t0 + DAY)).toEqual(expect.arrayContaining(['motion', 'sequence']))
    expect(dueSkills(s, COURSE, t0 + DAY)).not.toContain('robot-basics')
    const reviewed = appendEvents(s, [{ kind: 'review_done', skills: ['motion'], correct: 5, total: 5, at: t0 + DAY }])
    expect(skillMemory(reviewed, COURSE).get('motion')!.box).toBe(2)
    expect(dueSkills(reviewed, COURSE, t0 + 2 * DAY)).not.toContain('motion')
    const weak = appendEvents(s, [{ kind: 'review_done', skills: ['robot-basics'], correct: 1, total: 4, at: t0 + 2 * DAY }])
    expect(skillMemory(weak, COURSE).get('robot-basics')!.box).toBe(1)
  })
})

describe('placement and practice items', () => {
  const keys = new Set(practiceItems().map((i) => i.key))

  it('uses questions that exist, 8–12 of them', () => {
    expect(PLACEMENT_ITEMS.length).toBeGreaterThanOrEqual(8)
    expect(PLACEMENT_ITEMS.length).toBeLessThanOrEqual(12)
    for (const k of PLACEMENT_ITEMS) expect(keys.has(k), k).toBe(true)
  })

  it('passes levels in order and allows one mistake per level', () => {
    const [l1, l2, l3] = PLACEMENT
    expect(placementResult(new Set()).passed).toHaveLength(0)
    expect(placementResult(new Set(l1.items.slice(1))).lessons).toEqual(l1.lessons)
    // Level 3 right but level 2 wrong: only level 1 counts.
    expect(placementResult(new Set([...l1.items, ...l3.items])).passed.map((l) => l.id)).toEqual([l1.id])
    expect(placementResult(new Set(PLACEMENT_ITEMS)).passed).toHaveLength(3)
    expect(placementResult(new Set([...l1.items, ...l2.items])).skills).toEqual(expect.arrayContaining(['robot-basics', 'motion', 'turns']))
  })

  it('spreads a long list evenly', () => {
    expect(spread([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5)).toEqual([1, 3, 5, 7, 9])
    expect(spread([1, 2], 5)).toEqual([1, 2])
  })
})

describe('weekly challenges', () => {
  it.each(CHALLENGES.map((c) => [c.id, c] as const))('%s: the reference passes and an empty program does not', (_, c) => {
    expect(runChecks(c.reference, c.field, c.checks, 'ru').ok).toBe(true)
    expect(runChecks(c.start, c.field, c.checks, 'ru').ok).toBe(false)
    for (const step of c.reference) expect(c.toolbox).toContain(step.op)
  })
})

describe('achievements', () => {
  it('earns visible and hidden ones from events, once', () => {
    const t0 = Date.parse('2026-10-01T10:00:00Z')
    let s = appendEvents(EMPTY_STATE, [lessonDone('start-01', t0)])
    expect(newAchievements(s, COURSE, t0)).toEqual(['first-lesson'])
    s = appendEvents(s, [{ kind: 'achievement', achievement: 'first-lesson', at: t0 }])
    expect(newAchievements(s, COURSE, t0)).toEqual([])
    s = appendEvents(s, [lessonDone('start-02', t0 + 9 * DAY)])
    expect(earnedAchievements(s, COURSE, t0 + 9 * DAY)).toContain('comeback')
    s = appendEvents(s, [{ kind: 'step_done', lesson: 'blocks-01', step: 'zigzag', stepType: 'code', firstTry: true, hints: 0, blocks: 3, referenceBlocks: 5 }])
    expect(earnedAchievements(s, COURSE)).toContain('shorter')
  })

  it('has hidden ones and unique ids', () => {
    expect(ACHIEVEMENTS.some((a) => a.hidden)).toBe(true)
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length)
  })

  it('unlocks shop items only through existing achievements, levels or coins', () => {
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id))
    for (const c of SHOP) if (c.unlock && 'achievement' in c.unlock) expect(ids.has(c.unlock.achievement), c.id).toBe(true)
    const leaf = SHOP.find((c) => c.id === 'leaf')!
    expect(isUnlocked(leaf, 0, new Set(), new Set())).toBe(false)
    expect(isUnlocked(leaf, 1, new Set(), new Set())).toBe(true)
    const cap = SHOP.find((c) => c.kind === 'hat' && c.id === 'cap')!
    expect(isUnlocked(cap, 9, new Set(), new Set())).toBe(false)
    expect(isUnlocked(cap, 0, new Set(), new Set(['hat:cap']))).toBe(true)
  })
})

describe('answer order', () => {
  it('does not show the right answer in the same place every time', async () => {
    const { shuffled } = await import('@/components/learn/steps/quiz-step')
    const positions = practiceItems().flatMap(({ step }) => {
      if (step.type === 'quiz' && step.kind === 'choice')
        return [
          shuffled(
            step.options.map((_, i) => i),
            `${step.id}:options`,
            true,
          ).indexOf(step.correct[0]),
        ]
      if (step.type === 'predict')
        return [
          shuffled(
            step.options.map((_, i) => i),
            `${step.id}:options`,
            true,
          ).indexOf(step.correct),
        ]
      return []
    })
    const first = positions.filter((p) => p === 0).length
    expect(first / positions.length).toBeLessThan(0.6)
  })

  it('schedules skills of known lessons for a check', () => {
    const t0 = Date.parse('2026-10-01T10:00:00Z')
    const s = appendEvents(EMPTY_STATE, [{ kind: 'known', lessons: ['start-01'], skills: ['robot-basics'], source: 'placement', at: t0 }])
    expect(dueSkills(s, COURSE, t0 + DAY)).toEqual([])
    expect(dueSkills(s, COURSE, t0 + 2 * DAY)).toEqual(['robot-basics'])
  })
})

describe('analytics and flags', () => {
  it('builds the lesson funnel and stuck points across learners', async () => {
    const { lessonFunnels, stuckPoints } = await import('@/lib/learn/analytics')
    const a = appendEvents(EMPTY_STATE, [
      { kind: 'lesson_start', lesson: 'start-01' },
      { kind: 'mistake', lesson: 'start-01', step: 'first-program' },
      { kind: 'mistake', lesson: 'start-01', step: 'first-program' },
      { kind: 'step_done', lesson: 'start-01', step: 'first-program', stepType: 'code', firstTry: false, hints: 1 },
      lessonDone('start-01', 1),
    ]).events
    const b = appendEvents(EMPTY_STATE, [{ kind: 'lesson_start', lesson: 'start-01' }]).events
    const [f] = lessonFunnels([a, b])
    expect(f).toMatchObject({ lesson: 'start-01', started: 2, finished: 1, medianSeconds: 60 })
    expect(stuckPoints([f])[0]).toMatchObject({ step: 'first-program', mistakesPerLearner: 2 })
  })

  it('keeps a learner in the same A/B variant and honours overrides', async () => {
    const { variantFor } = await import('@/lib/flags')
    expect(variantFor('path-cta', 'anon_1')).toBe(variantFor('path-cta', 'anon_1'))
    expect(variantFor('path-cta', null)).toBe('continue')
    expect(variantFor('path-cta', 'anon_1', 'path-cta:lesson-name')).toBe('lesson-name')
    const seen = new Set(Array.from({ length: 40 }, (_, i) => variantFor('auto-hint', `anon_${i}`)))
    expect(seen.size).toBe(2)
  })
})

describe('bundled data without runtime parsing', () => {
  it('course.json matches the schema exactly (defaults written out)', async () => {
    const { courseSchema } = await import('@/lib/learn/schema')
    const raw = (await import('@/content/learn/course.json')).default
    expect(courseSchema.parse(raw)).toEqual(raw)
  })

  it('state schema (zod/mini) fills defaults and rejects bad data', async () => {
    const { profileSchema } = await import('@/lib/learn/state')
    const p = profileSchema.parse({
      nickname: '  Robo  ',
      ageRange: '10-12',
      timezone: 'UTC',
      goal: { kind: 'lessons', n: 1 },
      createdAt: 1,
      anonId: 'anon_12345678',
    })
    expect(p).toMatchObject({
      nickname: 'Robo',
      skipWeekends: false,
      parentConsent: false,
      reminders: { enabled: false },
      cosmetics: { color: 'sun', hat: 'none', eyes: 'round' },
      buddy: { model: 'rover', name: '' },
    })
    expect(profileSchema.safeParse({ ...p, goal: { kind: 'lessons', n: 3 } }).success).toBe(false)
    expect(profileSchema.safeParse({ ...p, nickname: 'x'.repeat(30) }).success).toBe(false)
  })
})

describe('learning paths: WeDo 2.0 before SPIKE Prime', async () => {
  const { effectiveLearningPath, pathOrder, placementAvailable, spikeLockedByWedo, wedoComplete, wedoProgress } = await import('@/lib/learn/progress')
  type C = typeof COURSE
  const ref = (id: string) => ({ id, title: { ru: id, kk: id, en: id }, skills: ['motion' as const], status: 'ready' as const, project: false, kit: false })
  const wedoTrack = (id: string, lessons: string[], prerequisites: string[]): C['tracks'][number] => ({
    id,
    title: { ru: id, kk: id, en: id },
    description: { ru: id, kk: id, en: id },
    icon: 'Smile',
    color: 'var(--wedo-accent)',
    family: 'wedo',
    prerequisites,
    units: [{ id: `${id}-u`, title: { ru: id, kk: id, en: id }, lessons: lessons.map(ref) }],
  })
  // A course with two small WeDo tracks in front, whatever WeDo content the real course has.
  const course: C = {
    tracks: [wedoTrack('tw-a', ['tw-1', 'tw-2'], []), wedoTrack('tw-b', ['tw-3'], ['tw-a']), ...COURSE.tracks.filter((t) => t.family !== 'wedo')],
  }
  const t = (id: string) => course.tracks.find((x) => x.id === id)!
  const allWedo = ['tw-1', 'tw-2', 'tw-3']

  it('gives every track a family; WeDo prerequisites stay inside WeDo', () => {
    for (const tr of COURSE.tracks) expect(['spike', 'wedo', 'general'], tr.id).toContain(tr.family)
    expect(COURSE.tracks.find((x) => x.id === 'ai-basics')!.family).toBe('general')
    const wedo = new Set(COURSE.tracks.filter((x) => x.family === 'wedo').map((x) => x.id))
    for (const tr of COURSE.tracks.filter((x) => x.family === 'wedo')) for (const p of tr.prerequisites) expect(wedo.has(p), `${tr.id} → ${p}`).toBe(true)
  })

  it('WeDo path: WeDo opens along its own prerequisites, SPIKE stays closed', () => {
    expect(trackUnlocked(done(), t('tw-a'), course, 'wedo')).toBe(true)
    expect(trackUnlocked(done(), t('tw-b'), course, 'wedo')).toBe(false)
    expect(trackUnlocked(done('tw-1', 'tw-2'), t('tw-b'), course, 'wedo')).toBe(true)
    for (const id of ['start', 'blocks', 'build']) expect(trackUnlocked(done('tw-1', 'tw-2'), t(id), course, 'wedo'), id).toBe(false)
    expect(lessonStates(done(), t('start'), course, 'wedo').get('start-01')).toBe('locked')
    expect(nextLesson(done(), course, 'wedo')?.id).toBe('tw-1')
    expect(nextLesson(done('tw-1'), course, 'wedo')?.id).toBe('tw-2')
    expect(placementAvailable(done(), course, 'wedo')).toBe(false)
    expect(wedoProgress(done('tw-1'), course)).toEqual({ done: 1, ready: 3 })
  })

  it('WeDo path: SPIKE lessons done earlier stay done, but nothing new opens until WeDo is finished', () => {
    const states = lessonStates(done('start-01'), t('start'), course, 'wedo')
    expect(states.get('start-01')).toBe('done')
    expect(states.get('start-02')).toBe('locked')
    expect(spikeLockedByWedo(done('start-01'), t('start'), course, 'wedo')).toBe(true)
  })

  it('WeDo path: finishing every WeDo lesson opens Start and then SPIKE as usual', () => {
    expect(wedoComplete(done(...allWedo), course)).toBe(true)
    expect(trackUnlocked(done(...allWedo), t('start'), course, 'wedo')).toBe(true)
    expect(trackUnlocked(done(...allWedo), t('blocks'), course, 'wedo')).toBe(false)
    expect(nextLesson(done(...allWedo), course, 'wedo')?.id).toBe('start-01')
    expect(placementAvailable(done(...allWedo), course, 'wedo')).toBe(true)
  })

  it('SPIKE path (and no path yet) works exactly as before; WeDo is open and optional', () => {
    for (const path of ['spike', null] as const) {
      expect(nextLesson(done(), course, path)?.id).toBe('start-01')
      expect(trackUnlocked(done(), t('blocks'), course, path)).toBe(false)
      expect(trackUnlocked(done(), t('tw-b'), course, path)).toBe(true)
      expect(lessonStates(done(), t('start'), course, path).get('start-01')).toBe('current')
      expect(placementAvailable(done(), course, path)).toBe(true)
    }
    expect(pathOrder(course, 'spike').at(-1)!.family).toBe('wedo')
    expect(pathOrder(course, 'wedo')[0].family).toBe('wedo')
  })

  it('AI from zero is open on every path', () => {
    for (const path of ['wedo', 'spike', null] as const) expect(trackUnlocked(done(), t('ai-basics'), course, path), String(path)).toBe(true)
  })

  it('effective path: the choice wins; SPIKE progress without a choice means "spike"; otherwise nothing yet', () => {
    const profile = { learningPath: null } as unknown as NonNullable<typeof EMPTY_STATE.profile>
    expect(effectiveLearningPath(EMPTY_STATE, course)).toBe(null)
    const old = appendEvents({ ...EMPTY_STATE, profile }, [lessonDone('start-01', 1)])
    expect(effectiveLearningPath(old, course)).toBe('spike')
    const known = appendEvents({ ...EMPTY_STATE, profile }, [{ kind: 'known', lessons: ['blocks-01'], skills: ['sequence'], source: 'placement' }])
    expect(effectiveLearningPath(known, course)).toBe('spike')
    const wedoOnly = appendEvents({ ...EMPTY_STATE, profile }, [lessonDone('tw-1', 1, 'tw-a')])
    expect(effectiveLearningPath(wedoOnly, course)).toBe(null)
    const chosen = { ...old, profile: { ...profile, learningPath: 'wedo' as const } }
    expect(effectiveLearningPath(chosen, course)).toBe('wedo')
  })
})
