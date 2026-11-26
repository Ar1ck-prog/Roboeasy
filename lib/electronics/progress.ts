/**
 * The lab's progress in this browser: finished missions and the work
 * (circuit and code) of each mission and of the free build. Storage can be
 * unavailable (private mode, blocked site data), so every access is guarded.
 */

import type { CircuitDoc } from './board'

const KEY = 'roboeasy:electronics:v1'

export interface LabProgress {
  done: string[]
  work: Record<string, { code: string; doc: CircuitDoc }>
}

const EMPTY: LabProgress = { done: [], work: {} }

export function loadProgress(): LabProgress {
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return EMPTY
    const parsed = JSON.parse(raw) as Partial<LabProgress>
    return {
      done: Array.isArray(parsed.done) ? parsed.done.filter((x): x is string => typeof x === 'string') : [],
      work: parsed.work && typeof parsed.work === 'object' ? parsed.work : {},
    }
  } catch {
    return EMPTY
  }
}

export function saveProgress(update: (p: LabProgress) => LabProgress) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(update(loadProgress())))
  } catch {
    // Nothing to do: the lab keeps working, it just will not remember.
  }
}
