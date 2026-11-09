import { describe, expect, it } from 'vitest'

import { parseProgram } from '@/lib/dsl/schema'
import { programToPython } from '@/lib/dsl/compile-python'
import { checkPython } from '@/lib/dsl/compile-python'
import { parseField } from '@/lib/sim/field'
import { simulate } from '@/lib/sim/interpreter'
import { type Point, type Pose, fitPrimitives, resample, simplify, toleranceFor, traceRoute } from '@/lib/route/trace'

const START: Pose = { x: 500, y: 500, heading: 0 }
const FIELD = parseField({ width: 5000, height: 5000, start: { x: 500, y: 500, heading: 0 }, border: false })

/** A small, repeatable wobble, like a hand. */
const wobble = (points: Point[], amount = 2): Point[] => points.map((p, i) => ({ x: p.x + Math.sin(i * 2.3) * amount, y: p.y + Math.cos(i * 1.7) * amount }))

function polyline(corners: Point[], step = 8): Point[] {
  const out: Point[] = []
  for (let i = 1; i < corners.length; i++) {
    const a = corners[i - 1]
    const b = corners[i]
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / step)
    for (let k = 0; k < n; k++) out.push({ x: a.x + ((b.x - a.x) * k) / n, y: a.y + ((b.y - a.y) * k) / n })
  }
  out.push(corners[corners.length - 1])
  return out
}

/** Counterclockwise when `turns` is positive. Starts at (cx + r, cy), going up. */
function circle(cx: number, cy: number, r: number, turns = 1, phase = 0, n = 240): Point[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = phase + (2 * Math.PI * turns * i) / n
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }
  })
}

const square = polyline([
  { x: 500, y: 500 },
  { x: 900, y: 500 },
  { x: 900, y: 900 },
  { x: 500, y: 900 },
  { x: 500, y: 500 },
])
const counts = (r: { primitives: { kind: string }[] }) => ({
  line: r.primitives.filter((p) => p.kind === 'line').length,
  arc: r.primitives.filter((p) => p.kind === 'arc').length,
})

function runs(raw: Point[], precision = 60) {
  const route = traceRoute(raw, START, precision)
  if (!route) throw new Error('no route')
  const parsed = parseProgram({ title: 'r', description: '', steps: route.steps })
  if (!parsed.ok) throw new Error(parsed.error)
  return { route, sim: simulate(parsed.value.steps, FIELD), program: parsed.value }
}

const minDistanceTo = (trace: Point[], p: Point) => Math.min(...trace.map((q) => Math.hypot(q.x - p.x, q.y - p.y)))

describe('simplify (Ramer–Douglas–Peucker)', () => {
  it('reduces a straight line to its two ends', () => {
    expect(
      simplify(
        polyline([
          { x: 0, y: 0 },
          { x: 500, y: 0 },
        ]),
        2,
      ),
    ).toHaveLength(2)
  })
  it('keeps real corners', () => {
    expect(simplify(square, 5).length).toBe(5)
  })
})

describe('square', () => {
  it('is four straight sides with right angles', () => {
    const { route } = runs(wobble(square))
    expect(counts(route)).toEqual({ line: 4, arc: 0 })
    // The hand's wobble can add a tiny turn at the very start; the corners are what counts.
    const turns = route.steps.filter((s) => s.op === 'turn' && s.degrees > 10)
    expect(turns).toHaveLength(3)
    for (const t of turns) if (t.op === 'turn') expect(Math.abs(t.degrees - 90)).toBeLessThanOrEqual(6)
  })

  it('the simulated robot passes every corner and comes back', () => {
    const { sim } = runs(wobble(square))
    for (const corner of [
      { x: 900, y: 500 },
      { x: 900, y: 900 },
      { x: 500, y: 900 },
    ])
      expect(minDistanceTo(sim.trace, corner)).toBeLessThan(30)
    expect(Math.hypot(sim.final.x - 500, sim.final.y - 500)).toBeLessThan(30)
  })
})

describe('circle', () => {
  const round = circle(500, 800, 300, 1, -Math.PI / 2) // starts at (500, 500), going right

  it('is one arc of a full turn with the right radius', () => {
    const { route } = runs(wobble(round))
    expect(counts(route)).toEqual({ line: 0, arc: 1 })
    const arc = route.steps.find((s) => s.op === 'arc')
    if (arc?.op !== 'arc') throw new Error('no arc')
    expect(arc.direction).toBe('left')
    expect(arc.degrees).toBeGreaterThan(340)
    expect(Math.abs(arc.radius - 30)).toBeLessThan(2)
  })

  it('the simulated robot drives around the same centre', () => {
    const { sim } = runs(wobble(round))
    for (const p of sim.trace.filter((_, i) => i % 40 === 0)) expect(Math.abs(Math.hypot(p.x - 500, p.y - 800) - 300)).toBeLessThan(25)
  })
})

describe('figure eight', () => {
  // One loop to the left, then one to the right, meeting at the start.
  const eight = [...circle(500, 800, 250, 1, -Math.PI / 2), ...circle(500, 200, 300, -1, Math.PI / 2).slice(1)]
  const trimmed = [...circle(500, 800, 300, 1, -Math.PI / 2), ...circle(500, 200, 300, -1, Math.PI / 2).slice(1)]

  it('is two arcs turning opposite ways', () => {
    void eight
    const { route } = runs(wobble(trimmed))
    expect(counts(route).arc).toBe(2)
    const arcs = route.steps.filter((s) => s.op === 'arc')
    if (arcs[0].op !== 'arc' || arcs[1].op !== 'arc') throw new Error('not arcs')
    expect(arcs[0].direction).toBe('left')
    expect(arcs[1].direction).toBe('right')
  })
})

describe('zigzag', () => {
  const zigzag = polyline([
    { x: 500, y: 500 },
    { x: 800, y: 700 },
    { x: 1100, y: 500 },
    { x: 1400, y: 700 },
    { x: 1700, y: 500 },
  ])

  it('is straight pieces with turns alternating left and right', () => {
    const { route } = runs(wobble(zigzag))
    expect(counts(route)).toEqual({ line: 4, arc: 0 })
    const directions = route.steps.flatMap((s) => (s.op === 'turn' ? [s.direction] : []))
    expect(directions.slice(1)).toEqual(['right', 'left', 'right'])
  })

  it('the simulated robot reaches every peak', () => {
    const { sim } = runs(wobble(zigzag))
    for (const p of [
      { x: 800, y: 700 },
      { x: 1100, y: 500 },
      { x: 1400, y: 700 },
      { x: 1700, y: 500 },
    ])
      expect(minDistanceTo(sim.trace, p)).toBeLessThan(30)
  })
})

describe('precision slider and limits', () => {
  // A wavy line: the more exact the route, the more pieces it needs.
  const wavy = Array.from({ length: 300 }, (_, i) => ({ x: 500 + i * 6, y: 700 + Math.sin(i / 12) * 90 }))

  it('more precision never gives fewer commands', () => {
    const rough = traceRoute(wavy, START, 0)
    const fine = traceRoute(wavy, START, 100)
    expect(fine!.steps.length).toBeGreaterThan(rough!.steps.length)
    expect(toleranceFor(0)).toBeGreaterThan(toleranceFor(100))
  })

  it('stays within the limit of commands on a very long scribble', () => {
    const scribble = Array.from({ length: 3000 }, (_, i) => ({ x: 500 + 300 * Math.sin(i / 7) + i / 2, y: 900 + 300 * Math.cos(i / 11) }))
    expect(traceRoute(scribble, START, 100)!.steps.length).toBeLessThanOrEqual(60)
  })

  it('ignores a tap or a dot', () => {
    expect(traceRoute([{ x: 500, y: 500 }], START, 50)).toBeNull()
    expect(
      traceRoute(
        [
          { x: 500, y: 500 },
          { x: 503, y: 502 },
          { x: 501, y: 501 },
        ],
        START,
        50,
      ),
    ).toBeNull()
  })

  it('a line drawn away from the robot starts with driving to it', () => {
    const away = polyline([
      { x: 900, y: 500 },
      { x: 900, y: 900 },
    ])
    const { sim } = runs(away)
    expect(minDistanceTo(sim.trace, { x: 900, y: 500 })).toBeLessThan(15)
    expect(minDistanceTo(sim.trace, { x: 900, y: 900 })).toBeLessThan(15)
  })

  it('does not depend on how fast the line was drawn', () => {
    const sparse = polyline(
      [
        { x: 0, y: 0 },
        { x: 400, y: 0 },
      ],
      40,
    )
    expect(fitPrimitives(resample(sparse), 8)).toHaveLength(1)
  })

  it('the commands compile to valid Python', () => {
    const { program } = runs(wobble(circle(500, 800, 300, 1, -Math.PI / 2)))
    expect(checkPython(programToPython(program))).toEqual([])
  })
})
