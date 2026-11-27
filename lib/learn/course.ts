/**
 * The course map, bundled for the browser too (no file system access here,
 * unlike content.ts). Not parsed at runtime, to keep zod out of the page
 * bundles: tests/content.test.ts checks that the file matches courseSchema
 * exactly (all defaults written out).
 */

import courseJson from '../../content/learn/course.json'
import type { Course, TrackFamily } from './schema'

export const COURSE = courseJson as Course

export type Track = Course['tracks'][number]

export function findTrack(id: string): Track | undefined {
  return COURSE.tracks.find((t) => t.id === id)
}

/** Tracks of one kit family, in course order. */
export function tracksOf(family: TrackFamily, course: Course = COURSE): Track[] {
  return course.tracks.filter((t) => (t.family ?? 'spike') === family)
}

/** The family of a track ('spike' for unknown ids, like the schema default). */
export function trackFamily(trackId: string, course: Course = COURSE): TrackFamily {
  return course.tracks.find((t) => t.id === trackId)?.family ?? 'spike'
}

export function findLessonRef(id: string): { track: Track; unit: Track['units'][number]; ref: Track['units'][number]['lessons'][number] } | null {
  for (const track of COURSE.tracks)
    for (const unit of track.units) {
      const ref = unit.lessons.find((l) => l.id === id)
      if (ref) return { track, unit, ref }
    }
  return null
}
