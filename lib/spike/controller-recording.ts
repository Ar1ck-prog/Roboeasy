/**
 * A manual drive recorded in the controller: what every port was told and when. It can be
 * replayed as it was, or backwards with every speed reversed — the robot then retraces the
 * path to where the recording started (as far as wheel slip allows).
 */

import { STOPPED, type Speeds } from './controller-input'

export type Frame = { t: number; speeds: Speeds }
export type Take = { frames: Frame[]; duration: number }

/** Recordings stop by themselves after a minute: a replay longer than that is never wanted. */
export const MAX_TAKE_MS = 60_000

const same = (a: Speeds, b: Speeds) => a.length === b.length && a.every((v, i) => v === b[i])

/** Adds a change at `t` ms; repeats of the same speeds are dropped. */
export function addFrame(frames: Frame[], t: number, speeds: Speeds) {
  const last = frames.at(-1)
  if (last && same(last.speeds, speeds)) return
  const at = Math.max(0, Math.min(MAX_TAKE_MS, Math.round(t)))
  if (last && last.t === at) last.speeds = [...speeds]
  else frames.push({ t: at, speeds: [...speeds] })
}

/** Closes a recording at `t` ms. Null when nothing ever moved (no point keeping it). */
export function finishTake(frames: Frame[], t: number): Take | null {
  if (!frames.some((f) => f.speeds.some(Boolean))) return null
  // Leading idle time is cut: the replay starts with the first move.
  const start = frames.find((f) => f.speeds.some(Boolean))!.t
  const moved = frames.filter((f) => f.t >= start).map((f) => ({ t: f.t - start, speeds: f.speeds }))
  const end = Math.min(MAX_TAKE_MS, Math.round(t)) - start
  const last = moved.at(-1)!
  const duration = Math.max(end, last.t + (last.speeds.some(Boolean) ? 1 : 0))
  if (last.speeds.some(Boolean)) moved.push({ t: duration, speeds: STOPPED })
  return { frames: moved, duration: moved.at(-1)!.t }
}

/** Speeds at `t` ms into the replay; backwards plays the take from its end with reversed speeds. */
export function speedsAt(take: Take, t: number, backwards = false): Speeds {
  if (t >= take.duration || t < 0) return STOPPED
  if (!backwards) {
    let current: Speeds = STOPPED
    for (const f of take.frames) {
      if (f.t > t) break
      current = f.speeds
    }
    return current
  }
  // Moment `t` backwards is the interval just before `duration - t` forwards.
  const at = take.duration - t
  let current: Speeds = STOPPED
  for (const f of take.frames) {
    if (f.t >= at) break
    current = f.speeds
  }
  return current.map((v) => (v ? -v : 0))
}
