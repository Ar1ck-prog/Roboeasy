/**
 * Where the learner is on the path, computed from the event log:
 * which lessons are done, which one is next, which tracks are open,
 * how strong each skill is and which skills are due for review.
 *
 * Unlock rules (docs/curriculum.md):
 * - lessons in a track go one after another; a planned ("todo") lesson
 *   does not block the ones after it;
 * - a track opens when its prerequisite tracks are finished, or when any of
 *   its lessons is done (placement test, "I already know this" test).
 *
 * Learning paths (the learner picks one, see effectiveLearningPath):
 * - 'wedo': WeDo 2.0 tracks open along their own prerequisites; every SPIKE
 *   track stays closed until all ready WeDo lessons are done (lessons done
 *   earlier stay done and can be replayed, nothing new opens);
 * - 'spike' and null (not chosen yet): SPIKE exactly as before, WeDo tracks
 *   are open as an optional extra and block nothing;
 * - 'general' tracks (AI from zero) follow their own rules on any path.
 */

import type { Course, Skill, TrackFamily } from './schema'
import type { LearnState } from './state'

type Track = Course['tracks'][number]
export type LessonState = 'done' | 'current' | 'open' | 'locked' | 'soon'
export type LearningPath = 'wedo' | 'spike' | null

export function trackLessons(track: Track) {
  return track.units.flatMap((unit) => unit.lessons.map((ref) => ({ ref, unit })))
}

function familyOf(track: Track): TrackFamily {
  return track.family ?? 'spike'
}

/** All ready lessons done (a track with no ready lessons yet counts as finished for unlocking). */
export function trackComplete(done: Set<string>, track: Track): boolean {
  return trackLessons(track).every(({ ref }) => ref.status !== 'ready' || done.has(ref.id))
}

export function trackHasContent(track: Track): boolean {
  return trackLessons(track).some(({ ref }) => ref.status === 'ready')
}

/** Every ready lesson of every WeDo track is done (true when the course has no WeDo lessons). */
export function wedoComplete(done: Set<string>, course: Course): boolean {
  return course.tracks.filter((t) => familyOf(t) === 'wedo').every((t) => trackComplete(done, t))
}

/** Done and ready lessons over all WeDo tracks (for the "opens after WeDo" bar). */
export function wedoProgress(done: Set<string>, course: Course): { done: number; ready: number } {
  const refs = course.tracks.filter((t) => familyOf(t) === 'wedo').flatMap((t) => trackLessons(t).filter(({ ref }) => ref.status === 'ready'))
  return { done: refs.filter(({ ref }) => done.has(ref.id)).length, ready: refs.length }
}

/** A SPIKE track closed because the learner is on the WeDo path and has not finished it. */
export function spikeLockedByWedo(done: Set<string>, track: Track, course: Course, path: LearningPath): boolean {
  return path === 'wedo' && familyOf(track) === 'spike' && !wedoComplete(done, course)
}

export function trackUnlocked(done: Set<string>, track: Track, course: Course, path: LearningPath = null): boolean {
  if (spikeLockedByWedo(done, track, course, path)) return false
  // Off the WeDo path, WeDo is an optional extra: always open.
  if (familyOf(track) === 'wedo' && path !== 'wedo') return true
  if (trackLessons(track).some(({ ref }) => done.has(ref.id))) return true
  return track.prerequisites.every((id) => {
    const pre = course.tracks.find((t) => t.id === id)
    return !pre || trackComplete(done, pre)
  })
}

export function lessonStates(done: Set<string>, track: Track, course: Course, path: LearningPath = null): Map<string, LessonState> {
  const unlocked = trackUnlocked(done, track, course, path)
  const states = new Map<string, LessonState>()
  let previousDone = true
  let currentGiven = false
  for (const { ref } of trackLessons(track)) {
    if (done.has(ref.id)) {
      states.set(ref.id, 'done')
      previousDone = true
      continue
    }
    if (ref.status !== 'ready') {
      states.set(ref.id, 'soon')
      continue
    }
    if (!unlocked || !previousDone) states.set(ref.id, 'locked')
    else if (!currentGiven) {
      states.set(ref.id, 'current')
      currentGiven = true
    } else states.set(ref.id, 'open')
    previousDone = false
  }
  return states
}

export interface TrackProgress {
  done: number
  ready: number
  total: number
  unlocked: boolean
  complete: boolean
}

export function trackProgress(done: Set<string>, track: Track, course: Course, path: LearningPath = null): TrackProgress {
  const lessons = trackLessons(track)
  const ready = lessons.filter(({ ref }) => ref.status === 'ready')
  return {
    done: lessons.filter(({ ref }) => done.has(ref.id)).length,
    ready: ready.length,
    total: lessons.length,
    unlocked: trackUnlocked(done, track, course, path),
    complete: ready.length > 0 && trackComplete(done, track),
  }
}

/** Tracks in the order the path walks them: WeDo first on the WeDo path, WeDo last otherwise. */
export function pathOrder(course: Course, path: LearningPath): Track[] {
  const wedo = course.tracks.filter((t) => familyOf(t) === 'wedo')
  const rest = course.tracks.filter((t) => familyOf(t) !== 'wedo')
  return path === 'wedo' ? [...wedo, ...rest] : [...rest, ...wedo]
}

/** The lesson to continue with: the first current lesson in path order. */
export function nextLesson(
  done: Set<string>,
  course: Course,
  path: LearningPath = null,
): { track: Track; id: string; title: Track['units'][number]['lessons'][number]['title'] } | null {
  for (const track of pathOrder(course, path)) {
    const states = lessonStates(done, track, course, path)
    for (const { ref } of trackLessons(track)) if (states.get(ref.id) === 'current') return { track, id: ref.id, title: ref.title }
  }
  return null
}

/** The lesson to open from a track's card: its first current lesson, or null when there is none. */
export function trackNextLesson(done: Set<string>, track: Track, course: Course, path: LearningPath = null): string | null {
  const states = lessonStates(done, track, course, path)
  for (const { ref } of trackLessons(track)) if (states.get(ref.id) === 'current') return ref.id
  return null
}

/**
 * The learner's path: the one they picked, or 'spike' for learners who did a
 * SPIKE lesson before paths existed (so nobody meets new locks), or null
 * when nothing is chosen yet.
 */
export function effectiveLearningPath(state: Pick<LearnState, 'profile' | 'events'>, course: Course): LearningPath {
  const chosen = state.profile?.learningPath ?? null
  if (chosen) return chosen
  const spikeLessons = new Set(course.tracks.filter((t) => familyOf(t) === 'spike').flatMap((t) => trackLessons(t).map(({ ref }) => ref.id)))
  const didSpike = state.events.some(
    (e) => (e.kind === 'lesson_done' && spikeLessons.has(e.lesson)) || (e.kind === 'known' && e.lessons.some((l) => spikeLessons.has(l))),
  )
  return didSpike ? 'spike' : null
}

/** The SPIKE placement test is offered unless the learner is still on the WeDo part of the WeDo path. */
export function placementAvailable(done: Set<string>, course: Course, path: LearningPath): boolean {
  return path !== 'wedo' || wedoComplete(done, course)
}

// ── Skills ──────────────────────────────────────────────────────────────

/** Skill groups for the radar (8 axes are readable on a phone). */
export const SKILL_GROUPS = [
  { id: 'basics', skills: ['robot-basics'], title: { ru: 'Основы', kk: 'Негіздер', en: 'Basics' } },
  { id: 'motion', skills: ['motion', 'turns'], title: { ru: 'Движение', kk: 'Қозғалыс', en: 'Motion' } },
  { id: 'algorithms', skills: ['sequence', 'loops', 'conditions', 'variables', 'functions'], title: { ru: 'Алгоритмы', kk: 'Алгоритмдер', en: 'Algorithms' } },
  { id: 'sensors', skills: ['sensor-color', 'sensor-distance', 'sensor-force', 'gyro', 'line-follow'], title: { ru: 'Датчики', kk: 'Датчиктер', en: 'Sensors' } },
  { id: 'precision', skills: ['control', 'calibration'], title: { ru: 'Точность', kk: 'Дәлдік', en: 'Precision' } },
  { id: 'building', skills: ['parts', 'structures', 'gears', 'mechanisms'], title: { ru: 'Конструирование', kk: 'Құрастыру', en: 'Building' } },
  { id: 'code', skills: ['python'], title: { ru: 'Код', kk: 'Код', en: 'Code' } },
  { id: 'team', skills: ['strategy', 'teamwork'], title: { ru: 'Команда', kk: 'Команда', en: 'Team' } },
] as const satisfies readonly { id: string; skills: readonly Skill[]; title: Record<'ru' | 'kk' | 'en', string> }[]

/** Share of the course's lessons per skill group that are done (0…1). */
export function skillRadar(done: Set<string>, course: Course): { id: string; title: (typeof SKILL_GROUPS)[number]['title']; value: number; done: number; total: number }[] {
  const lessons = course.tracks.flatMap((t) => trackLessons(t).map(({ ref }) => ref))
  return SKILL_GROUPS.map((g) => {
    const tagged = lessons.filter((l) => l.skills.some((s) => (g.skills as readonly Skill[]).includes(s)))
    const d = tagged.filter((l) => done.has(l.id)).length
    return { id: g.id, title: g.title, value: tagged.length ? d / tagged.length : 0, done: d, total: tagged.length }
  })
}

// ── Spaced review (Leitner boxes) ───────────────────────────────────────

/** Days until a skill in box n is due again. */
export const REVIEW_INTERVALS = [0, 1, 2, 4, 7, 14] as const
const DAY = 24 * 60 * 60 * 1000

export interface SkillMemory {
  box: number
  last: number
  due: number
}

/**
 * Box per skill: a lesson finished without mistakes puts its skills in box 2,
 * with mistakes in box 1 (skills passed in a test: box 2); a good review (≥ 80 %) moves up a box, a weak one
 * back to box 1.
 */
export function skillMemory(state: LearnState, course: Course): Map<Skill, SkillMemory> {
  const skillsOf = new Map(course.tracks.flatMap((t) => trackLessons(t).map(({ ref }) => [ref.id, ref.skills] as const)))
  const mistakes = new Set(state.events.filter((e) => e.kind === 'mistake').map((e) => (e.kind === 'mistake' ? e.lesson : '')))
  const mem = new Map<Skill, SkillMemory>()
  const put = (skill: Skill, box: number, at: number) => mem.set(skill, { box, last: at, due: at + REVIEW_INTERVALS[box] * DAY })
  for (const e of state.events) {
    if (e.kind === 'lesson_done')
      for (const s of skillsOf.get(e.lesson) ?? []) {
        const prev = mem.get(s)
        put(s, Math.max(prev?.box ?? 0, mistakes.has(e.lesson) ? 1 : 2), e.at)
      }
    // Lessons marked as known (tests) come back for a check in two days.
    if (e.kind === 'known') for (const sk of e.skills) if (!mem.has(sk)) put(sk, 2, e.at)
    if (e.kind === 'review_done') {
      const good = e.total > 0 && e.correct / e.total >= 0.8
      for (const s of e.skills) {
        const prev = mem.get(s)
        put(s, good ? Math.min(REVIEW_INTERVALS.length - 1, (prev?.box ?? 1) + 1) : 1, e.at)
      }
    }
  }
  return mem
}

export function dueSkills(state: LearnState, course: Course, now = Date.now()): Skill[] {
  return [...skillMemory(state, course).entries()]
    .filter(([, m]) => m.due <= now)
    .sort((a, b) => a[1].box - b[1].box || a[1].due - b[1].due)
    .map(([s]) => s)
}

