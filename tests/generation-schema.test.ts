import { describe, expect, it } from 'vitest'

import { PROGRAM_JSON_SCHEMA, parseProgram } from '@/lib/dsl/schema'
import { DEFAULT_ROBOT } from '@/lib/dsl/types'
import { simulate } from '@/lib/sim/interpreter'
import { parseField } from '@/lib/sim/field'
import { PROMPT_EXAMPLES, dslSystemPrompt } from '@/lib/spike/prompts'

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

describe('expressions written as text', () => {
  const steps = (expr: unknown) => [
    { op: 'set_var', name: 'side', expr: 1 === 1 ? { num: 1 } : 0 },
    { op: 'set_var', name: 'x', expr },
  ]
  const read = (expr: unknown) => {
    const r = parseProgram({ title: 't', description: '', steps: steps(expr) })
    return r.ok && r.value.steps[1].op === 'set_var' ? r.value.steps[1].expr : null
  }

  it.each([
    ['10', { num: 10 }],
    ['-3', { num: -3 }],
    ['side', { var: 'side' }],
    ['side + 5', { op: '+', a: { var: 'side' }, b: { num: 5 } }],
    ['side*2', { op: '*', a: { var: 'side' }, b: { num: 2 } }],
    ['1 + side * 2', { op: '+', a: { num: 1 }, b: { op: '*', a: { var: 'side' }, b: { num: 2 } } }],
    ['(1 + side) * 2', { op: '*', a: { op: '+', a: { num: 1 }, b: { var: 'side' } }, b: { num: 2 } }],
  ])('reads "%s"', (text, expected) => {
    expect(read(text)).toEqual(expected)
  })

  it.each(['', '1 +', 'side side', '(1', '5 $ 2', '4 / 0', 'speed + 1'])('rejects "%s"', (text) => {
    expect(read(text)).toBeNull()
  })

  it('still reads the structured form', () => {
    expect(read({ op: '-', a: { var: 'side' }, b: { num: 1 } })).toEqual({ op: '-', a: { var: 'side' }, b: { num: 1 } })
  })
})

describe('blocks of your own', () => {
  it('a "define" step becomes a block, and calls to it work', () => {
    const r = parseProgram({
      title: 't',
      description: '',
      steps: [
        { op: 'define', name: 'hop', steps: [{ op: 'move', direction: 'forward', value: 5, unit: 'cm' }] },
        { op: 'call', name: 'hop' },
      ],
    })
    expect(r.ok && r.value).toEqual({
      title: 't',
      description: '',
      steps: [{ op: 'call', name: 'hop' }],
      functions: [{ name: 'hop', steps: [{ op: 'move', direction: 'forward', value: 5, unit: 'cm' }] }],
    })
  })

  it('a "define" inside a loop is an error for the model', () => {
    expect(
      parseProgram({ title: 't', description: '', steps: [{ op: 'repeat', times: 2, steps: [{ op: 'define', name: 'x', steps: [{ op: 'stop_move' }] }] }] }).ok,
    ).toBe(false)
  })
})

describe('schema complexity', () => {
  // Gemini answers 400 INVALID_ARGUMENT to a schema it finds too complex; mocks cannot show that.
  const text = JSON.stringify(PROGRAM_JSON_SCHEMA)

  it('has no separate list of blocks: Gemini rejected it', () => {
    expect(Object.keys(PROGRAM_JSON_SCHEMA.properties as object)).toEqual(['unsupported', 'reason', 'suggestion', 'title', 'description', 'steps'])
  })

  it('has no numeric ranges, which were what pushed it over the limit', () => {
    expect(text).not.toMatch(/"minimum"|"maximum"/)
  })

  it('keeps expressions as text: a nested object made Gemini reject the schema', () => {
    const defs = PROGRAM_JSON_SCHEMA.$defs as Record<string, { properties: Record<string, unknown> }>
    expect(defs.Expr).toBeUndefined()
    expect(defs.Step.properties.expr).toEqual({ type: 'string' })
  })
})

describe('circles', () => {
  const open = parseField({ width: 4000, height: 4000, start: { x: 2000, y: 2000, heading: 0 } })

  it.each([10, 20, 25, 50])('a circle of radius %i cm comes back to the start', (radius) => {
    const step = { op: 'circle', direction: 'right', radius, turns: 1 } as const
    expect(parseProgram({ title: 'c', description: '', steps: [step] }).ok).toBe(true)
    const r = simulate([step], open)
    expect(Math.hypot(r.final.x - 2000, r.final.y - 2000)).toBeLessThan(12)
    // Halfway round it is one diameter away, measured at the middle of the robot.
    const far = Math.max(...r.trace.map((p) => Math.hypot(p.x - 2000, p.y - 2000)))
    expect(far).toBeGreaterThan(radius * 20 * 0.93)
    expect(far).toBeLessThan(radius * 20 * 1.07)
  })

  it('turns the other way when asked to go left', () => {
    const r = simulate([{ op: 'circle', direction: 'left', radius: 20, turns: 1 }], open)
    expect(Math.max(...r.trace.map((p) => p.y))).toBeGreaterThan(2100)
  })
})

describe('examples shown to the model', () => {
  const feasible = PROMPT_EXAMPLES.filter((e) => e.answer.unsupported === false)

  it('there are enough of them, with honest refusals, in all three languages', () => {
    expect(PROMPT_EXAMPLES.length).toBeGreaterThanOrEqual(15)
    expect(PROMPT_EXAMPLES.filter((e) => e.answer.unsupported === true).length).toBeGreaterThanOrEqual(2)
    expect(PROMPT_EXAMPLES.some((e) => /[әғқңөұүһі]/i.test(e.request))).toBe(true)
    expect(PROMPT_EXAMPLES.some((e) => /^[\x20-\x7e]+$/.test(e.request))).toBe(true)
  })

  it.each(feasible.map((e) => [e.request, e] as const))('"%s" is a valid program', (_, example) => {
    const parsed = parseProgram(example.answer)
    expect(parsed.ok ? '' : parsed.error).toBe('')
  })

  it('never asks the model to compute wheel speeds', () => {
    expect(prompt).not.toMatch(/round\(100/)
    expect(prompt).toContain('never calculate wheel speeds')
  })
})
