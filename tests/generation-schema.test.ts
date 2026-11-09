import { describe, expect, it } from 'vitest'

import { PROGRAM_JSON_SCHEMA, parseProgram } from '@/lib/dsl/schema'
import { DEFAULT_ROBOT } from '@/lib/dsl/types'
import { simulate } from '@/lib/sim/interpreter'
import { parseField } from '@/lib/sim/field'
import { circleStep, dslSystemPrompt } from '@/lib/spike/prompts'

type Props = Record<string, { properties: Record<string, unknown> }>
const defs = PROGRAM_JSON_SCHEMA.$defs as Props
const prompt = dslSystemPrompt(DEFAULT_ROBOT, 'ru')

/** Field names of every one-line JSON template in the prompt, in the order they are written. */
function templates(startKey: string, schema: string[]): string[][] {
  return prompt
    .split('\n')
    .filter((l) => l.startsWith(`{"${startKey}"`))
    .map((l) => [...l.matchAll(/"([a-z_]+)":/gi)].map((m) => m[1]).filter((k) => schema.includes(k)))
}

describe('order of fields for the model', () => {
  // Gemini fills a schema's fields in order: a field listed before one the prompt writes first can never be filled.
  it.each([
    ['op', Object.keys(defs.Step.properties)],
    ['sensor', Object.keys(defs.Condition.properties)],
  ])('every "%s" template follows the schema order', (key, order) => {
    const lines = templates(key, order)
    expect(lines.length).toBeGreaterThan(key === 'op' ? 20 : 3)
    for (const fields of lines) {
      const at = fields.map((f) => order.indexOf(f))
      expect(at, fields.join(',')).toEqual([...at].sort((a, b) => a - b))
    }
  })
})

describe('circles', () => {
  const open = parseField({ width: 4000, height: 4000, start: { x: 2000, y: 2000, heading: 0 } })

  it.each([20, 40, 50, 100])('a %i cm circle comes back to the start', (d) => {
    const step = circleStep(d, DEFAULT_ROBOT)
    expect(parseProgram({ title: 'c', description: '', steps: [step] }).ok).toBe(true)
    const r = simulate([step], open)
    expect(Math.hypot(r.final.x - 2000, r.final.y - 2000)).toBeLessThan(12)
    // Halfway round it is one diameter away, measured at the middle of the robot.
    const far = Math.max(...r.trace.map((p) => Math.hypot(p.x - 2000, p.y - 2000)))
    expect(far).toBeGreaterThan(d * 10 * 0.95)
    expect(far).toBeLessThan(d * 10 * 1.05)
  })

  it('turns the other way with negative steering', () => {
    const step = circleStep(40, DEFAULT_ROBOT)
    const r = simulate([{ ...step, steering: -step.steering }], open)
    expect(Math.max(...r.trace.map((p) => p.y))).toBeGreaterThan(2100)
  })

  it('shows the model a worked circle for this robot', () => {
    expect(prompt).toContain(JSON.stringify(circleStep(40, DEFAULT_ROBOT)))
  })
})
