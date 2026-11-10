/**
 * "Draw a route": turns a hand-drawn line into straight pieces and arcs, then
 * into DSL commands. No AI is involved: the geometry is all computed here.
 *
 * Units are field millimetres, y up, angles counterclockwise, like the simulator.
 * The commands are planned from the pose the robot will really be in after the
 * previous command, so small rounding errors do not add up along the route.
 */

import type { Step } from '@/lib/dsl/types'
import { LIMITS } from '@/lib/dsl/types'

export interface Point {
  x: number
  y: number
}

export type Primitive =
  | { kind: 'line'; from: Point; to: Point }
  /** `sweep` in radians: positive is counterclockwise (a left turn). */
  | { kind: 'arc'; from: Point; to: Point; center: Point; radius: number; sweep: number }

export interface Pose extends Point {
  /** Degrees, counterclockwise from +x. */
  heading: number
}

export interface TracedRoute {
  primitives: Primitive[]
  steps: Step[]
  /** Tolerance actually used, mm (it grows when a route would need too many commands). */
  tolerance: number
}

const RESAMPLE_MM = 12
const MIN_ARC_RADIUS_MM = 30
const MAX_ARC_RADIUS_MM = 3000
const MIN_ARC_SWEEP = (35 * Math.PI) / 180
const MIN_MOVE_MM = 5
const MIN_TURN_DEG = 2
/** The robot does not stand on the drawn line: farther than this it drives there first. */
const MAX_GAP_MM = 30
/** Beyond this sweep the chord is too short to work out a radius from. */
const NEARLY_FULL_TURN = (300 * Math.PI) / 180

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const toDeg = (r: number) => (r * 180) / Math.PI
const toRad = (d: number) => (d * Math.PI) / 180
const normalize = (deg: number) => ((((deg + 180) % 360) + 360) % 360) - 180

function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = dx * dx + dy * dy
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** Ramer–Douglas–Peucker: indices of the fewest points that stay within `epsilon` of the line. */
function keptIndices(points: Point[], epsilon: number, from = 0, to = points.length - 1): number[] {
  if (to - from < 2) return to > from ? [from, to] : [from]
  let worst = -1
  let worstDist = 0
  for (let i = from + 1; i < to; i++) {
    const d = distToSegment(points[i], points[from], points[to])
    if (d > worstDist) {
      worstDist = d
      worst = i
    }
  }
  if (worstDist <= epsilon) return [from, to]
  return [...keptIndices(points, epsilon, from, worst).slice(0, -1), ...keptIndices(points, epsilon, worst, to)]
}

export function simplify(points: Point[], epsilon: number): Point[] {
  return keptIndices(points, epsilon).map((i) => points[i])
}

/** Evenly spaced points along the line, so fitting does not depend on how fast it was drawn. */
export function resample(points: Point[], step = RESAMPLE_MM): Point[] {
  if (points.length < 2) return [...points]
  const out = [points[0]]
  let carried = 0
  for (let i = 1; i < points.length; i++) {
    let a = points[i - 1]
    const b = points[i]
    let left = dist(a, b)
    while (carried + left >= step) {
      const k = (step - carried) / left
      a = { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }
      out.push(a)
      left = dist(a, b)
      carried = 0
    }
    carried += left
  }
  const last = points[points.length - 1]
  if (dist(out[out.length - 1], last) > step / 4) out.push(last)
  return out
}

/** Light smoothing takes out the tremor of a hand; the two ends stay where they are. */
function smooth(points: Point[]): Point[] {
  return points.map((p, i) => {
    if (i < 2 || i > points.length - 3) return p
    const near = points.slice(i - 2, i + 3)
    return { x: near.reduce((s, q) => s + q.x, 0) / 5, y: near.reduce((s, q) => s + q.y, 0) / 5 }
  })
}

function fitsLine(points: Point[], from: number, to: number, tolerance: number): boolean {
  for (let i = from + 1; i < to; i++) if (distToSegment(points[i], points[from], points[to]) > tolerance) return false
  return true
}

/** Least-squares circle (Kåsa); null when the points are practically on a line. */
function fitCircle(points: Point[]): { center: Point; radius: number } | null {
  const n = points.length
  const mx = points.reduce((s, p) => s + p.x, 0) / n
  const my = points.reduce((s, p) => s + p.y, 0) / n
  let suu = 0
  let svv = 0
  let suv = 0
  let suuu = 0
  let svvv = 0
  let suvv = 0
  let svuu = 0
  for (const p of points) {
    const u = p.x - mx
    const v = p.y - my
    suu += u * u
    svv += v * v
    suv += u * v
    suuu += u * u * u
    svvv += v * v * v
    suvv += u * v * v
    svuu += v * u * u
  }
  const det = suu * svv - suv * suv
  if (Math.abs(det) < 1e-6) return null
  const a = (suuu + suvv) / 2
  const b = (svvv + svuu) / 2
  const uc = (a * svv - b * suv) / det
  const vc = (b * suu - a * suv) / det
  return { center: { x: mx + uc, y: my + vc }, radius: Math.sqrt(uc * uc + vc * vc + (suu + svv) / n) }
}

/** The arc through these points, if they really lie on one and turn one way. */
function arcOver(points: Point[], from: number, to: number, tolerance: number): Extract<Primitive, { kind: 'arc' }> | null {
  if (to - from < 4) return null
  const part = points.slice(from, to + 1)
  const circle = fitCircle(part)
  if (!circle || circle.radius < MIN_ARC_RADIUS_MM || circle.radius > MAX_ARC_RADIUS_MM) return null
  if (part.some((p) => Math.abs(dist(p, circle.center) - circle.radius) > tolerance)) return null
  let sweep = 0
  let backwards = 0
  let forwards = 0
  let previous = Math.atan2(part[0].y - circle.center.y, part[0].x - circle.center.x)
  for (let i = 1; i < part.length; i++) {
    const angle = Math.atan2(part[i].y - circle.center.y, part[i].x - circle.center.x)
    let delta = angle - previous
    if (delta > Math.PI) delta -= 2 * Math.PI
    if (delta < -Math.PI) delta += 2 * Math.PI
    sweep += delta
    if (delta >= 0) forwards += delta
    else backwards -= delta
    previous = angle
  }
  // A drawn arc goes one way; a line going back and forth over a circle does not.
  if (Math.min(forwards, backwards) > toRad(12)) return null
  if (Math.abs(sweep) < MIN_ARC_SWEEP) return null
  return { kind: 'arc', from: part[0], to: part[part.length - 1], center: circle.center, radius: circle.radius, sweep }
}

/** Points of an arc that has not yet turned far enough to count: the longest such arc there can be. */
const ARC_SEARCH_POINTS = Math.ceil((MAX_ARC_RADIUS_MM * MIN_ARC_SWEEP) / RESAMPLE_MM) + 8

/** A short stretch of arc is hard to fit on a shaky line, so the search carries on past a few misses. */
const ARC_MISSES = 24

/** Furthest end of an arc starting at `from`: a run of misses after a fit ends the search. */
function furthestArc(points: Point[], from: number, tolerance: number): number {
  const last = points.length - 1
  let best = -1
  let misses = 0
  for (let to = from + 4; to <= last; to++) {
    if (arcOver(points, from, to, tolerance)) {
      best = to
      misses = 0
    } else if (best !== -1 ? ++misses > ARC_MISSES : to - from > ARC_SEARCH_POINTS) break
  }
  return best
}

/** Covers the line with straight pieces and arcs, always taking the longest one that fits. */
export function fitPrimitives(points: Point[], tolerance: number): Primitive[] {
  const out: Primitive[] = []
  const last = points.length - 1
  // Straight pieces end at real corners, not wherever the tolerance happens to run out.
  const corners = keptIndices(points, tolerance)
  let from = 0
  while (from < last) {
    const reachable = corners.filter((c) => c > from && fitsLine(points, from, c, tolerance))
    const lineEnd = reachable.length ? Math.max(...reachable) : Math.min(from + 1, last)
    const arcEnd = furthestArc(points, from, tolerance)
    // An arc must clearly beat a straight piece; otherwise a gentle bow turns into needless curves.
    if (arcEnd !== -1 && arcEnd - from > (lineEnd - from) * 1.3) {
      out.push(arcOver(points, from, arcEnd, tolerance) as Primitive)
      from = arcEnd
    } else {
      out.push({ kind: 'line', from: points[from], to: points[lineEnd] })
      from = lineEnd
    }
  }
  // The last few points after a curve are the end of the same stroke, not a piece of their own.
  const tail = out[out.length - 1]
  if (out.length > 1 && tail.kind === 'line' && dist(tail.from, tail.to) < MAX_GAP_MM) out.pop()
  return out
}

const roundCm = (mm: number) => Math.round(mm) / 10

function turnSteps(pose: Pose, target: number): Step[] {
  const delta = Math.round(normalize(target - pose.heading))
  if (Math.abs(delta) < MIN_TURN_DEG) return []
  pose.heading += delta
  return [{ op: 'turn', direction: delta > 0 ? 'left' : 'right', degrees: Math.abs(delta) }]
}

/** Commands that drive these pieces from `start`. The drawn line is reached from wherever the robot stands. */
export function primitivesToSteps(primitives: Primitive[], start: Pose): Step[] {
  const pose: Pose = { ...start }
  const steps: Step[] = []
  const lineTo = (to: Point) => {
    const length = dist(pose, to)
    if (length < MIN_MOVE_MM) return
    steps.push(...turnSteps(pose, toDeg(Math.atan2(to.y - pose.y, to.x - pose.x))))
    const moved = roundCm(length) * 10
    steps.push({ op: 'move', direction: 'forward', value: moved / 10, unit: 'cm' })
    pose.x += Math.cos(toRad(pose.heading)) * moved
    pose.y += Math.sin(toRad(pose.heading)) * moved
  }

  for (const p of primitives) {
    if (dist(pose, p.from) > MAX_GAP_MM) lineTo(p.from)
    if (p.kind === 'line') {
      lineTo(p.to)
      continue
    }
    const left = p.sweep > 0
    const size = Math.abs(p.sweep)
    let radius = p.radius
    let tangent: number
    if (size > NEARLY_FULL_TURN) {
      // A nearly closed circle: start along its tangent at the point where the robot stands.
      const outward = toDeg(Math.atan2(pose.y - p.center.y, pose.x - p.center.x))
      tangent = outward + (left ? 90 : -90)
    } else {
      // Through the real position and the end of the arc, so that it arrives exactly there.
      const chord = dist(pose, p.to)
      radius = chord / (2 * Math.sin(size / 2))
      tangent = toDeg(Math.atan2(p.to.y - pose.y, p.to.x - pose.x)) - toDeg(p.sweep) / 2
    }
    steps.push(...turnSteps(pose, tangent))
    const degrees = Math.round(toDeg(size))
    const radiusCm = roundCm(radius)
    steps.push({ op: 'arc', direction: left ? 'left' : 'right', radius: radiusCm, degrees })
    // Where that arc really ends.
    const signed = toRad(left ? degrees : -degrees)
    const center = {
      x: pose.x + radiusCm * 10 * Math.cos(toRad(pose.heading + (left ? 90 : -90))),
      y: pose.y + radiusCm * 10 * Math.sin(toRad(pose.heading + (left ? 90 : -90))),
    }
    const dx = pose.x - center.x
    const dy = pose.y - center.y
    pose.x = center.x + dx * Math.cos(signed) - dy * Math.sin(signed)
    pose.y = center.y + dx * Math.sin(signed) + dy * Math.cos(signed)
    pose.heading += toDeg(signed)
  }
  return steps
}

/** Slider 0–100 (0: fewest commands, 100: closest to the drawing) → tolerance in millimetres. */
export function toleranceFor(precision: number): number {
  const p = Math.max(0, Math.min(100, precision)) / 100
  return Math.round((40 - 36 * p) * 10) / 10
}

/** From raw pointer points to commands. Returns null when the line is too short to be a route. */
export function traceRoute(raw: Point[], start: Pose, precision: number): TracedRoute | null {
  const points = smooth(resample(raw))
  if (points.length < 2 || points.every((p) => dist(p, points[0]) < 20)) return null
  let tolerance = toleranceFor(precision)
  for (;;) {
    const primitives = fitPrimitives(points, tolerance)
    const steps = primitivesToSteps(primitives, start)
    if (steps.length <= LIMITS.maxSteps) return { primitives, steps, tolerance }
    tolerance *= 1.25
  }
}
