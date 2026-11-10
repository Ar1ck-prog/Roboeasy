import fs from 'node:fs'
import path from 'node:path'

import type { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GenerationError, MAX_ATTEMPTS, checkBySimulation, runGeneration } from '@/lib/ai/generator'
import { scrubPrompt } from '@/lib/ai/failures'
import { arcPlan, tankAsSteering } from '@/lib/dsl/arcs'
import { type ScratchBlock, buildProject } from '@/lib/dsl/compile-blocks'
import { checkPython, programToPython } from '@/lib/dsl/compile-python'
import { parseProgram } from '@/lib/dsl/schema'
import { DEFAULT_ROBOT, type Program, type Step } from '@/lib/dsl/types'
import { resetGeminiCooldowns } from '@/lib/gemini'
import { parseField } from '@/lib/sim/field'
import { simulate } from '@/lib/sim/interpreter'

import { type EvalTask, parseLimit, pickTasks } from '../scripts/eval-generator'

const sdk = vi.hoisted(() => ({ generate: vi.fn() }))
vi.mock('@google/genai', async (original) => {
  const real = await original<typeof import('@google/genai')>()
  return {
    ...real,
    GoogleGenAI: class {
      models = { generateContent: sdk.generate }
    },
  }
})

const failures = vi.hoisted(() => [] as Record<string, unknown>[])
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: () => ({
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (table === 'generation_failures') failures.push(row)
        return { error: null }
      },
      select: () => ({ eq: () => ({ eq: () => ({ gt: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }) }),
      upsert: async () => ({ error: null }),
    }),
    rpc: async () => ({ data: [{ allowed: true, remaining: 5, retry_after: 0 }], error: null }),
  }),
}))

const ai = { models: { generateContent: sdk.generate } } as never
const json = (v: unknown) => ({ text: JSON.stringify(v) })
const input = (prompt: string, format: 'blocks' | 'python' | 'python-free' = 'blocks') => ({ prompt, format, lang: 'ru' as const, robot: DEFAULT_ROBOT })
const run = (prompt: string, format?: 'blocks' | 'python' | 'python-free') => runGeneration(input(prompt, format), { ai, signal: new AbortController().signal })
const circle = { unsupported: false, title: 'Круг', description: 'Едет', steps: [{ op: 'circle', direction: 'right', radius: 20 }] }
const open = parseField({ width: 5000, height: 5000, start: { x: 2500, y: 2500, heading: 0 } })

beforeEach(() => {
  sdk.generate.mockReset()
  failures.length = 0
  resetGeminiCooldowns()
  vi.stubEnv('GEMINI_API_KEY', 'k')
  vi.stubEnv('GEMINI_MODEL_MAIN', 'main')
  vi.stubEnv('GEMINI_MODEL_LIGHT', 'light')
})

describe('the bug from the school defence', () => {
  // A steer without distance is what the model used to return for circles.
  const brokenCircle = { unsupported: false, title: 'Круг', description: '', steps: [{ op: 'steer', steering: 22 }] }

  it('used to end in an error after two rejected answers: now the third try and the circle command fix it', async () => {
    sdk.generate.mockResolvedValueOnce(json(brokenCircle)).mockResolvedValueOnce(json(brokenCircle)).mockResolvedValueOnce(json(circle))
    const result = await run('езжай по кругу')
    expect(result).toMatchObject({ kind: 'program', title: 'Круг' })
    expect(sdk.generate).toHaveBeenCalledTimes(3)
  })

  it.each(['езжай по кругу', 'проедь круг радиусом 30 см', 'drive in a circle', 'шеңбер бойымен жүр'])('"%s" gives blocks and Python', async (prompt) => {
    sdk.generate.mockResolvedValue(json(circle))
    const result = await run(prompt)
    if (result.kind !== 'program') throw new Error(result.kind)
    expect(programToPython(result.program)).toContain('move_tank_for_degrees')
    expect(JSON.stringify(buildProject(result.program))).toContain('flippermove_steer')
  })
})

describe('pipeline', () => {
  it('sends the reason back to the model', async () => {
    sdk.generate.mockResolvedValueOnce(json({ unsupported: false, title: 't', description: '', steps: [{ op: 'fly' }] })).mockResolvedValueOnce(json(circle))
    await run('езжай по кругу')
    const second = sdk.generate.mock.calls[1][0]
    expect(second.contents).toContain('Your previous answer was rejected')
    expect(second.model).toBe('main')
  })

  it('stops after three attempts, says so and logs each one', async () => {
    sdk.generate.mockResolvedValue(json({ unsupported: false, title: 't', description: '', steps: [] }))
    await expect(run('езжай вперёд')).rejects.toBeInstanceOf(GenerationError)
    expect(sdk.generate).toHaveBeenCalledTimes(MAX_ATTEMPTS)
    expect(failures.map((f) => f.attempt)).toEqual([1, 2, 3])
  })

  it('an empty loop is a rejected answer', async () => {
    sdk.generate
      .mockResolvedValueOnce(json({ unsupported: false, title: 't', description: '', steps: [{ op: 'repeat', times: 4, steps: [] }] }))
      .mockResolvedValueOnce(json(circle))
    expect((await run('квадрат')).kind).toBe('program')
    expect(sdk.generate.mock.calls[1][0].contents).toContain('no steps inside')
  })

  it('returns an honest refusal without any retries', async () => {
    sdk.generate.mockResolvedValue(json({ unsupported: true, reason: 'Нет крыльев', suggestion: 'Проедь вперёд' }))
    await expect(run('Полети')).resolves.toEqual({ kind: 'unsupported', reason: 'Нет крыльев', suggestion: 'Проедь вперёд' })
    expect(sdk.generate).toHaveBeenCalledTimes(1)
  })

  it('free Python can refuse too', async () => {
    sdk.generate.mockResolvedValue(json({ unsupported: true, reason: 'Нет камеры', suggestion: 'Улыбнись' }))
    expect((await run('сфотографируй', 'python-free')).kind).toBe('unsupported')
  })

  it('the route shows a refusal with its reason, and never an empty success', async () => {
    const { POST } = await import('@/app/api/generate/route')
    sdk.generate.mockResolvedValue(json({ unsupported: true, reason: 'Нет крыльев', suggestion: 'Проедь вперёд' }))
    const res = await POST(
      new Request('http://t/api/generate', {
        method: 'POST',
        headers: { 'x-rb-device': 'route-device' },
        body: JSON.stringify({ prompt: 'Полети', format: 'blocks', lang: 'ru' }),
      }) as unknown as NextRequest,
    )
    await expect(res.json()).resolves.toEqual({ ok: false, error: 'unsupported', reason: 'Нет крыльев', suggestion: 'Проедь вперёд' })
  })

  it('removes contact details from logged requests', () => {
    expect(scrubPrompt('напиши на vasya@mail.ru или +7 701 123 45 67 и https://x.y/z')).toBe('напиши на [email] или [number] и [link]')
  })
})

describe('test drive in the simulator', () => {
  const program = (steps: Step[]): Program => ({ title: 't', description: '', steps })

  it('rejects a program that stands still when the task is about moving', () => {
    expect(checkBySimulation(program([{ op: 'beep', note: 60, seconds: 0.1 }]), DEFAULT_ROBOT, 'Езжай вперёд')).toMatch(/did not move/)
  })

  it('accepts standing still when the task does not ask for movement', () => {
    expect(checkBySimulation(program([{ op: 'beep', note: 60, seconds: 0.1 }]), DEFAULT_ROBOT, 'Сыграй ноту')).toBeNull()
  })

  it('a turn on the spot counts as moving', () => {
    expect(checkBySimulation(program([{ op: 'turn', direction: 'right', degrees: 90 }]), DEFAULT_ROBOT, 'Поверни направо')).toBeNull()
  })

  it('does not judge programs that depend on sensors', () => {
    expect(
      checkBySimulation(program([{ op: 'wait_until', condition: { sensor: 'force', port: 'E', state: 'pressed' } }]), DEFAULT_ROBOT, 'Езжай вперёд'),
    ).toBeNull()
  })
})

describe('arc geometry', () => {
  it('uses v_in / v_out = (R - B/2) / (R + B/2)', () => {
    // B = 11.2 cm, R = 20 cm
    expect(arcPlan('right', 20, 360, DEFAULT_ROBOT).ratio).toBeCloseTo(14.4 / 25.6, 2)
  })

  it('computes the outer wheel distance', () => {
    expect(arcPlan('left', 20, 360, DEFAULT_ROBOT).outerCm).toBeCloseTo(2 * Math.PI * 25.6, 1)
  })

  it('a radius of zero spins on the spot, half the track pivots on one wheel', () => {
    expect(Math.abs(arcPlan('right', 0, 90, DEFAULT_ROBOT).steering)).toBe(100)
    expect(arcPlan('right', 5.6, 90, DEFAULT_ROBOT).ratio).toBe(0)
  })

  it('positive steering turns right, negative left', () => {
    expect(arcPlan('right', 20, 90, DEFAULT_ROBOT).steering).toBeGreaterThan(0)
    expect(arcPlan('left', 20, 90, DEFAULT_ROBOT).steering).toBeLessThan(0)
  })

  it.each([
    [30, 60, -25],
    [60, 30, 25],
    [50, 50, 0],
    [-40, 40, -100],
    [-60, -30, 25],
  ])('tank %i/%i is steering %i', (l, r, steering) => {
    expect(tankAsSteering(l, r).steering).toBe(steering)
  })

  it('an arc turns the robot by its angle in the simulator', () => {
    const r = simulate([{ op: 'arc', direction: 'left', radius: 25, degrees: 90 }], open)
    expect(r.final.heading).toBeGreaterThan(85)
    expect(r.final.heading).toBeLessThan(95)
  })
})

describe('new commands', () => {
  const blocksOf = (p: Program) => (buildProject(p).targets[1].blocks ?? {}) as Record<string, ScratchBlock>
  const opcodes = (p: Program) => Object.values(blocksOf(p)).map((b) => b.opcode)
  const parse = (raw: object) => parseProgram({ title: 't', description: '', ...raw })

  it('variables and arithmetic work in the simulator', () => {
    const steps: Step[] = [
      { op: 'set_var', name: 'side', expr: { num: 10 } },
      { op: 'change_var', name: 'side', expr: { op: '*', a: { var: 'side' }, b: { num: 2 } } },
      { op: 'move_expr', direction: 'forward', expr: { var: 'side' }, unit: 'cm' },
    ]
    expect(simulate(steps, open).final.x).toBeCloseTo(2800, 0)
  })

  it('variables become blocks and a Python name', () => {
    const p: Program = {
      title: 't',
      description: '',
      steps: [
        { op: 'set_var', name: 'n', expr: { num: 1 } },
        { op: 'change_var', name: 'n', expr: { op: '+', a: { var: 'n' }, b: { num: 2 } } },
        { op: 'write_var', name: 'n' },
      ],
    }
    const project = buildProject(p)
    expect(Object.values(project.targets[0].variables as object)).toEqual([['n', 0]])
    expect(opcodes(p)).toEqual(expect.arrayContaining(['data_setvariableto', 'data_changevariableby', 'operator_add', 'flipperlight_lightDisplayText']))
    const py = programToPython(p)
    expect(py).toContain('n = 0')
    expect(py).toContain('n += (n + 2)')
    expect(py).toContain('await light_matrix.write(str(n))')
  })

  it('a block of your own is a definition and a call', () => {
    const p: Program = {
      title: 't',
      description: '',
      functions: [
        {
          name: 'dance',
          steps: [
            { op: 'set_speed', speed: 30 },
            { op: 'turn', direction: 'left', degrees: 90 },
          ],
        },
      ],
      steps: [{ op: 'call', name: 'dance' }],
    }
    const all = blocksOf(p)
    const definition = Object.values(all).find((b) => b.opcode === 'procedures_definition')!
    expect(definition.topLevel).toBe(true)
    expect(all[(definition.inputs.custom_block as [1, string])[1]].mutation?.proccode).toBe('dance')
    expect(Object.values(all).find((b) => b.opcode === 'procedures_call')?.mutation?.proccode).toBe('dance')
    const py = programToPython(p)
    expect(py).toContain('async def dance():')
    expect(py).toContain('nonlocal speed')
    expect(py).toContain('await dance()')
    expect(simulate(p.steps, open, { functions: p.functions }).final.heading).toBeCloseTo(90, 0)
  })

  it('"while" is "repeat until not" in blocks', () => {
    const p: Program = {
      title: 't',
      description: '',
      steps: [{ op: 'while', condition: { sensor: 'gyro', axis: 'yaw', comparator: '<', value: 90 }, steps: [{ op: 'wait', seconds: 0.1 }] }],
    }
    expect(opcodes(p)).toEqual(expect.arrayContaining(['control_repeat_until', 'operator_not', 'operator_lt', 'flippersensors_orientationAxis']))
    expect(programToPython(p)).toContain('while -motion_sensor.tilt_angles()[0] / 10 < 90:')
  })

  it('"tank" keeps the movement speed for what follows', () => {
    const p: Program = {
      title: 't',
      description: '',
      steps: [
        { op: 'set_speed', speed: 30 },
        { op: 'tank', leftSpeed: 60, rightSpeed: 20, value: 1, unit: 'seconds' },
      ],
    }
    const speeds = Object.values(blocksOf(p))
      .filter((b) => b.opcode === 'flippermove_movementSpeed')
      .map((b) => (b.inputs.SPEED as [1, [number, string]])[1][1])
    expect(speeds).toEqual(['30', '60', '30'])
    expect(programToPython(p)).toContain('move_tank_for_time(motor_pair.PAIR_1, 600, 200, 1000)')
  })

  it.each([
    ['an unknown variable', { steps: [{ op: 'write_var', name: 'x' }] }, /no "set_var"/],
    ['a reserved name', { steps: [{ op: 'set_var', name: 'speed', expr: { num: 1 } }] }, /reserved/],
    ['a Cyrillic name', { steps: [{ op: 'set_var', name: 'сторона', expr: { num: 1 } }] }, /Latin/],
    ['an unknown block', { steps: [{ op: 'call', name: 'nope' }] }, /no block/],
    ['division by zero', { steps: [{ op: 'set_var', name: 'x', expr: { op: '/', a: { num: 1 }, b: { num: 0 } } }] }, /divide/],
    ['a block that calls itself', { functions: [{ name: 'a', steps: [{ op: 'call', name: 'a' }] }], steps: [{ op: 'call', name: 'a' }] }, /calls itself/],
    [
      'two blocks calling each other',
      {
        functions: [
          { name: 'a', steps: [{ op: 'call', name: 'b' }] },
          { name: 'b', steps: [{ op: 'call', name: 'a' }] },
        ],
        steps: [{ op: 'call', name: 'a' }],
      },
      /calls itself/,
    ],
    ['a stopped tank', { steps: [{ op: 'tank', leftSpeed: 0, rightSpeed: 0, value: 1, unit: 'seconds' }] }, /speed/],
  ])('rejects %s, with a message for the model', (_, raw, message) => {
    const parsed = parse(raw)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.error).toMatch(message)
  })
})

describe('eval set', () => {
  const { tasks } = JSON.parse(fs.readFileSync(path.resolve('eval/generator-tasks.json'), 'utf8')) as { tasks: EvalTask[] }
  const feasible = tasks.filter((t) => t.feasible)

  it('is large enough and covers every language and category', () => {
    expect(tasks.length).toBeGreaterThanOrEqual(65)
    expect(tasks.filter((t) => !t.feasible).length).toBeGreaterThanOrEqual(5)
    expect(new Set(tasks.map((t) => t.lang))).toEqual(new Set(['ru', 'kk', 'en']))
    expect(new Set(feasible.map((t) => t.category))).toEqual(new Set(['motion', 'arcs', 'loops', 'sensors', 'attachments', 'combined']))
    expect(new Set(tasks.map((t) => t.id)).size).toBe(tasks.length)
  })

  it.each(feasible.map((t) => [t.id, t] as const))('%s: the reference compiles and runs', (_, task) => {
    const parsed = parseProgram(task.reference, DEFAULT_ROBOT)
    expect(parsed.ok ? '' : parsed.error).toBe('')
    if (!parsed.ok) return
    expect(checkPython(programToPython(parsed.value))).toEqual([])
    expect(Object.keys(buildProject(parsed.value).targets[1].blocks as object).length).toBeGreaterThan(1)
    expect(checkBySimulation(parsed.value, DEFAULT_ROBOT, task.prompt)).toBeNull()
  })

  it('requires a limit and takes tasks from every category first', () => {
    expect(parseLimit([])).toBeNull()
    expect(parseLimit(['--limit', '0'])).toBeNull()
    expect(parseLimit(['--limit', '10'])).toBe(10)
    expect(new Set(pickTasks(tasks, 7).map((t) => t.category)).size).toBe(7)
    expect(pickTasks(tasks, 7)).toHaveLength(7)
  })
})
