/**
 * Course content loader. The course map is bundled (the path map needs it
 * in the browser); lesson files are read on the server at build time, so
 * adding a lesson is adding a JSON file plus its entry in course.json.
 */

import fs from 'node:fs'
import path from 'node:path'

import { programBlocks } from './checks'
import { COURSE, findLessonRef } from './course'
import { type Lesson, lessonSchema } from './schema'

export { COURSE, findLessonRef }

const LESSONS_DIR = path.join(process.cwd(), 'content', 'learn', 'lessons')

export function readyLessonIds(): string[] {
  return COURSE.tracks.flatMap((t) => t.units.flatMap((u) => u.lessons.filter((l) => l.status === 'ready').map((l) => l.id)))
}

const cache = new Map<string, Lesson>()

/** Reads and validates a lesson file (throws on invalid content). */
export function readLesson(id: string): Lesson | null {
  if (!/^[a-z0-9-]+$/.test(id)) return null
  const hit = cache.get(id)
  if (hit) return hit
  const file = path.join(LESSONS_DIR, `${id}.json`)
  if (!fs.existsSync(file)) return null
  const lesson = lessonSchema.parse(JSON.parse(fs.readFileSync(file, 'utf8')))
  cache.set(id, lesson)
  return lesson
}

/** What the browser gets: no reference solutions, only their size. */
export type ClientLesson = Omit<Lesson, 'steps'> & { steps: ClientStep[] }
export type ClientStep = Lesson['steps'][number] extends infer S
  ? S extends { reference?: unknown }
    ? Omit<S, 'reference' | 'referenceFunctions'> & { referenceBlocks?: number }
    : S
  : never

export function toClientLesson(lesson: Lesson): ClientLesson {
  return {
    ...lesson,
    steps: lesson.steps.map((s) => {
      if (s.type === 'code' || s.type === 'debug' || s.type === 'project') {
        const { reference, referenceFunctions, ...rest } = s
        return { ...rest, referenceBlocks: reference ? programBlocks(reference, referenceFunctions) : undefined }
      }
      return s
    }) as ClientStep[],
  }
}

// ── Practice items: quiz and predict steps reused by tests and review ──

export interface PracticeItem {
  /** `${lesson}/${step}` */
  key: string
  lesson: string
  skills: Lesson['skills']
  step: Extract<Lesson['steps'][number], { type: 'quiz' | 'predict' }>
}

export function practiceItems(lessonIds: string[] = readyLessonIds()): PracticeItem[] {
  return lessonIds.flatMap((id) => {
    const lesson = readLesson(id)
    if (!lesson) return []
    return lesson.steps.flatMap((step) =>
      step.type === 'quiz' || step.type === 'predict' ? [{ key: `${id}/${step.id}`, lesson: id, skills: step.skill ? [step.skill] : lesson.skills, step }] : [],
    )
  })
}

/** Up to `max` items spread evenly over the list (the same every time). */
export function spread<T>(items: T[], max: number): T[] {
  if (items.length <= max) return items
  return Array.from({ length: max }, (_, i) => items[Math.floor((i * items.length) / max)])
}
