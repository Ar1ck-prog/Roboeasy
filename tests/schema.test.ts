import { describe, expect, it } from 'vitest'

import { PROGRAM_JSON_SCHEMA, PYTHON_JSON_SCHEMA, STEP_OPS, parseProgram, parseRobot } from '../lib/dsl/schema'
import { DEFAULT_ROBOT, toMatrixText } from '../lib/dsl/types'
import { EVERY_FUNCTIONS, EVERY_OP, EVERY_STEP, valid } from './helpers'

const program = (steps: unknown[]) => ({ title: 't', description: '', steps })
const error = (raw: unknown) => {
  const r = parseProgram(raw)
  expect(r.ok, 'expected a validation error').toBe(false)
  return r.ok ? '' : r.error
}

describe('parseProgram', () => {
  it('accepts every command unchanged', () => {
    expect(valid({ title: 'All', description: 'Every command', steps: EVERY_STEP, functions: EVERY_FUNCTIONS }).steps).toEqual(EVERY_STEP)
    expect([...EVERY_OP].sort()).toEqual([...STEP_OPS].sort())
  })

  it('fills omitted sensor ports from the robot profile', () => {
    const raw = program([{ op: 'wait_until', condition: { sensor: 'distance', comparator: '<', value: 10, unit: 'cm' } }])
    expect(valid(raw).steps[0]).toEqual({ op: 'wait_until', condition: { sensor: 'distance', port: 'C', comparator: '<', value: 10, unit: 'cm' } })
    const custom = valid(raw, { ...DEFAULT_ROBOT, distanceSensor: 'F' }).steps[0]
    expect(custom.op === 'wait_until' && custom.condition.sensor === 'distance' && custom.condition.port).toBe('F')
  })

  it('clamps numbers into safe ranges instead of failing', () => {
    const p = valid({
      title: '  x  ',
      description: '',
      steps: [
        { op: 'move', direction: 'back', value: 99999, unit: 'cm' },
        { op: 'move', direction: 'forward', value: 99999, unit: 'seconds' },
        { op: 'set_speed', speed: 250 },
        { op: 'motor_run', port: 'C', direction: 'clockwise', value: -3, unit: 'rotations' },
        { op: 'motor_to_position', port: 'C', position: 400, direction: 'shortest' },
        { op: 'beep', note: 10, seconds: 0.01234 },
      ],
    })
    expect(p.title).toBe('x')
    expect(p.steps).toEqual([
      { op: 'move', direction: 'back', value: 500, unit: 'cm' },
      { op: 'move', direction: 'forward', value: 60, unit: 'seconds' },
      { op: 'set_speed', speed: 100 },
      { op: 'motor_run', port: 'C', direction: 'clockwise', value: 0.05, unit: 'rotations' },
      { op: 'motor_to_position', port: 'C', position: 359, direction: 'shortest' },
      { op: 'beep', note: 36, seconds: 0.05 },
    ])
  })

  it('rejects wrong structure with an error the retry prompt can use', () => {
    expect(error(program([{ op: 'launch_rocket' }]))).toMatch(/steps\[0\]\.op/)
    expect(error(program([{ op: 'move', direction: 'backward', value: 1, unit: 'cm' }]))).toMatch(/"forward"\|"back"/)
    expect(error(program([{ op: 'set_speed', speed: '50' }]))).toMatch(/speed/)
    expect(error(program([{ op: 'wait_until', condition: { sensor: 'lidar' } }]))).toMatch(/condition/)
    expect(error(program([{ op: 'show_image', image: 'Arrow Up' }]))).toMatch(/image/)
    expect(error(program([{ op: 'set_movement_motors', left: 'A', right: 'A' }]))).toMatch(/different ports/)
    expect(error(program([]))).toMatch(/at least one step/)
    error({ steps: [{ op: 'stop_move' }] })
  })

  it('limits nesting depth and total size', () => {
    let deep: unknown = { op: 'beep', note: 60, seconds: 0.1 }
    for (let i = 0; i < 3; i++) deep = { op: 'forever', steps: [deep] }
    valid(program([deep]))
    error(program([{ op: 'forever', steps: [deep] }]))
    expect(error(program(Array.from({ length: 61 }, () => ({ op: 'stop_move' }))))).toMatch(/too many steps/)
  })

  it('drops steps after "forever" (a cap block in Scratch)', () => {
    const p = valid(program([{ op: 'forever', steps: [{ op: 'stop_move' }] }, { op: 'stop_move' }]))
    expect(p.steps.map((s) => s.op)).toEqual(['forever'])
  })

  it('transliterates display text for the 5x5 matrix', () => {
    expect(toMatrixText('Привет, Қазақстан!')).toBe('Privet, Qazaqstan!')
    expect(toMatrixText('Hi 🤖')).toBe('Hi')
    expect(error(program([{ op: 'write', text: '🤖' }]))).toMatch(/Latin/)
  })
})

describe('parseRobot', () => {
  it('fixes bad values field by field', () => {
    expect(parseRobot({ leftMotor: 'e', rightMotor: 'F', wheelDiameterMm: 999, trackWidthMm: 'x', turnFactor: 1.23456 })).toEqual({
      ...DEFAULT_ROBOT,
      leftMotor: 'E',
      rightMotor: 'F',
      wheelDiameterMm: 200,
      turnFactor: 1.235,
    })
    expect(parseRobot('junk')).toEqual(DEFAULT_ROBOT)
  })

  it('migrates v1 profiles that stored wheel sizes in cm', () => {
    expect(parseRobot({ leftMotor: 'C', wheelDiameter: 8.8, trackWidth: 15 })).toMatchObject({ leftMotor: 'C', wheelDiameterMm: 88, trackWidthMm: 150 })
  })

  it('keeps valid attachments and drops broken ones', () => {
    const r = parseRobot({
      attachments: [{ port: 'c', kind: 'lift', name: '  Big arm ' }, { port: 'Z', kind: 'arm' }, 'junk', { port: 'D', kind: 'rocket', name: 'x' }],
    })
    expect(r.attachments).toEqual([
      { port: 'C', kind: 'lift', name: 'Big arm' },
      { port: 'D', kind: 'other', name: 'x' },
    ])
  })
})

describe('Gemini response schemas', () => {
  it('list every command and stay compact', () => {
    const step = (PROGRAM_JSON_SCHEMA.$defs as Record<string, { properties: { op: { enum: string[] } } }>).Step
    expect([...step.properties.op.enum].sort()).toEqual([...STEP_OPS, 'define'].sort())
    expect(JSON.stringify(PROGRAM_JSON_SCHEMA).length).toBeLessThan(4000)
    expect(PYTHON_JSON_SCHEMA.required).toEqual(['unsupported'])
    expect(Object.keys(PYTHON_JSON_SCHEMA.properties as object)).toEqual(['unsupported', 'reason', 'suggestion', 'title', 'description', 'code'])
  })
})
