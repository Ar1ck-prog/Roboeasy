/**
 * Pure edits of a WeDo program for the icon editor. A block is addressed by
 * its path: "2" is the third block, "2.0" the first block inside it (a repeat).
 * Every edit returns a new program and never breaks the limits (20 blocks,
 * repeats nested at most twice).
 */

import { WEDO_LIMITS, type WedoOp, type WedoStep, defaultStep, wedoBlocks } from './types'

export type Path = string

const parse = (path: Path) => path.split('.').map(Number)
const join = (idx: number[]) => idx.join('.')

export function getAt(steps: WedoStep[], path: Path): WedoStep | undefined {
  let list = steps
  let found: WedoStep | undefined
  for (const i of parse(path)) {
    found = list[i]
    if (!found) return undefined
    list = found.op === 'repeat' ? found.steps : []
  }
  return found
}

/** How deep a block sits: 0 at the top level, 1 inside a repeat, 2 inside a repeat in a repeat. */
export function depthOf(path: Path): number {
  return parse(path).length - 1
}

/** Replaces the list that holds `path` (the top level or a repeat's steps). */
function withParent(steps: WedoStep[], path: Path, edit: (list: WedoStep[], index: number) => WedoStep[]): WedoStep[] {
  const idx = parse(path)
  const go = (list: WedoStep[], level: number): WedoStep[] => {
    const i = idx[level]
    if (level === idx.length - 1) return edit(list, i)
    return list.map((s, k) => (k === i && s.op === 'repeat' ? { ...s, steps: go(s.steps, level + 1) } : s))
  }
  return go(steps, 0)
}

export function updateAt(steps: WedoStep[], path: Path, next: WedoStep): WedoStep[] {
  return withParent(steps, path, (list, i) => list.map((s, k) => (k === i ? next : s)))
}

export function removeAt(steps: WedoStep[], path: Path): WedoStep[] {
  return withParent(steps, path, (list, i) => list.filter((_, k) => k !== i))
}

/** Moves a block one place left (-1) or right (+1) inside its own list; returns the new path. */
export function moveAt(steps: WedoStep[], path: Path, by: -1 | 1): { steps: WedoStep[]; path: Path } {
  const idx = parse(path)
  const i = idx[idx.length - 1]
  let moved = false
  const next = withParent(steps, path, (list, k) => {
    const j = k + by
    if (j < 0 || j >= list.length) return list
    moved = true
    const copy = [...list]
    ;[copy[k], copy[j]] = [copy[j], copy[k]]
    return copy
  })
  return moved ? { steps: next, path: join([...idx.slice(0, -1), i + by]) } : { steps, path }
}

/** Can a new block of this kind go in here? (`into`: a repeat's path, or null for the top level.) */
export function canAdd(steps: WedoStep[], op: WedoOp, into: Path | null): boolean {
  if (wedoBlocks(steps) >= WEDO_LIMITS.maxBlocks) return false
  if (into === null) return true
  const target = getAt(steps, into)
  if (!target || target.op !== 'repeat') return false
  return !(op === 'repeat' && depthOf(into) + 1 >= WEDO_LIMITS.maxDepth)
}

/** Adds a block at the end of the program, or at the end of the repeat `into`; returns the new block's path. */
export function addBlock(steps: WedoStep[], op: WedoOp, into: Path | null): { steps: WedoStep[]; path: Path } | null {
  if (!canAdd(steps, op, into)) return null
  const block = defaultStep(op)
  if (into === null) return { steps: [...steps, block], path: String(steps.length) }
  const target = getAt(steps, into) as Extract<WedoStep, { op: 'repeat' }>
  return { steps: updateAt(steps, into, { ...target, steps: [...target.steps, block] }), path: `${into}.${target.steps.length}` }
}

/** Every block path in reading order (left to right, into repeats). */
export function allPaths(steps: WedoStep[], prefix = ''): Path[] {
  return steps.flatMap((s, i) => {
    const p = prefix ? `${prefix}.${i}` : String(i)
    return s.op === 'repeat' ? [p, ...allPaths(s.steps, p)] : [p]
  })
}
