import { describe, expect, it } from 'vitest'

import { type ScratchBlock, buildProject } from '../lib/dsl/compile-blocks'
import { DEFAULT_ROBOT, type Step } from '../lib/dsl/types'
import { EVERY_FUNCTIONS, EVERY_STEP, expectLinked, spriteBlocks, validateSb3, valid } from './helpers'

const build = (steps: Step[], robot = DEFAULT_ROBOT) => spriteBlocks(buildProject(valid({ title: 't', description: '', steps }, robot), robot))

/** Opcodes of a stack, following `next` from the block `first`. */
function chain(blocks: Record<string, ScratchBlock>, first: string | null): string[] {
  const ops: string[] = []
  for (let id = first; id; id = blocks[id].next) ops.push(blocks[id].opcode)
  return ops
}

const hat = (blocks: Record<string, ScratchBlock>) => Object.keys(blocks).find((id) => blocks[id].topLevel) ?? null
const byOp = (blocks: Record<string, ScratchBlock>, op: string) => Object.entries(blocks).filter(([, b]) => b.opcode === op)
const ref = (input: ScratchBlock['inputs'][string]) => (typeof input[1] === 'string' ? input[1] : null)
const field = (blocks: Record<string, ScratchBlock>, shadowId: string | null) => {
  const b = shadowId ? blocks[shadowId] : undefined
  return b ? b.fields[`field_${b.opcode}`][0] : undefined
}

describe('compile-blocks', () => {
  it('compiles every command into a schema-valid, correctly linked project', async () => {
    const project = buildProject(valid({ title: 'All', description: '', steps: EVERY_STEP, functions: EVERY_FUNCTIONS }))
    await validateSb3(project)
    expectLinked(spriteBlocks(project))
    expect(project.extensions).toEqual(['flipperevents', 'flipperlight', 'flippermotor', 'flippermove', 'flippersensors', 'flippersound'])
    expect((project.targets[1] as { sounds: unknown[] }).sounds).toEqual([])
  })

  it('links nested repeat and if/else with SUBSTACK, SUBSTACK2, parent and next', () => {
    const blocks = build([
      {
        op: 'repeat',
        times: 2,
        steps: [
          { op: 'move', direction: 'forward', value: 10, unit: 'cm' },
          {
            op: 'if',
            condition: { sensor: 'color', port: 'D', color: 'red' },
            then: [{ op: 'beep', note: 60, seconds: 0.2 }],
            else: [{ op: 'stop_move' }],
          },
        ],
      },
      { op: 'write', text: 'OK' },
    ])
    expectLinked(blocks)
    expect(chain(blocks, hat(blocks))).toEqual([
      'flipperevents_whenProgramStarts',
      'flippermove_setMovementPair',
      'control_repeat',
      'flipperlight_lightDisplayText',
    ])

    const [[repeatId, repeat]] = byOp(blocks, 'control_repeat')
    expect(repeat.inputs.TIMES).toEqual([1, [6, '2']])
    const inner = ref(repeat.inputs.SUBSTACK)
    expect(blocks[inner ?? ''].parent).toBe(repeatId)
    expect(chain(blocks, inner)).toEqual(['flippermove_move', 'control_if_else'])

    const [[ifId, ifElse]] = byOp(blocks, 'control_if_else')
    expect(ifElse.next).toBeNull()
    expect(blocks[ref(ifElse.inputs.CONDITION) ?? ''].opcode).toBe('flippersensors_isColor')
    expect(chain(blocks, ref(ifElse.inputs.SUBSTACK))).toEqual(['flippersound_beepForTime'])
    expect(chain(blocks, ref(ifElse.inputs.SUBSTACK2))).toEqual(['flippermove_stopMove'])
    expect(blocks[ref(ifElse.inputs.SUBSTACK2) ?? ''].parent).toBe(ifId)
  })

  it('turns by gyro: reset yaw, spin, wait until |yaw| > angle, stop — in steps of at most 90°', () => {
    const blocks = build([{ op: 'turn', direction: 'right', degrees: 180 }])
    const oneStep = ['flippersensors_resetYaw', 'flippermove_startSteer', 'control_wait_until', 'flippermove_stopMove']
    expect(chain(blocks, hat(blocks)).slice(2)).toEqual([...oneStep, ...oneStep])

    const [, start] = byOp(blocks, 'flippermove_startSteer')[0]
    expect(field(blocks, ref(start.inputs.STEERING))).toBe('100')

    const [, wait] = byOp(blocks, 'control_wait_until')[0]
    const gt = blocks[ref(wait.inputs.CONDITION) ?? '']
    expect(gt.opcode).toBe('operator_gt')
    expect(gt.inputs.OPERAND2).toEqual([1, [10, '90']])
    const abs = blocks[gt.inputs.OPERAND1[1] as string]
    expect(abs.opcode).toBe('operator_mathop')
    expect(abs.fields.OPERATOR).toEqual(['abs', null])
    const yaw = blocks[abs.inputs.NUM[1] as string]
    expect(yaw.opcode).toBe('flippersensors_orientationAxis')
    expect(yaw.fields.AXIS).toEqual(['yaw', null])
  })

  it('applies the turn calibration to gyro targets', () => {
    const blocks = build([{ op: 'turn', direction: 'left', degrees: 90 }], { ...DEFAULT_ROBOT, turnFactor: 1.1 })
    const targets = byOp(blocks, 'operator_gt').map(([, b]) => (b.inputs.OPERAND2[1] as [number, string])[1])
    expect(targets).toEqual(['90', '9'])
    const [, start] = byOp(blocks, 'flippermove_startSteer')[0]
    expect(field(blocks, ref(start.inputs.STEERING))).toBe('-100')
  })

  it('sets the distance per rotation only for non-standard wheels or calibration', () => {
    const distance = (robot = DEFAULT_ROBOT) => byOp(build([{ op: 'move', direction: 'forward', value: 10, unit: 'cm' }], robot), 'flippermove_setDistance')
    expect(distance()).toHaveLength(0)
    const [[, calibrated]] = distance({ ...DEFAULT_ROBOT, distanceFactor: 1.1 })
    expect(calibrated.inputs.DISTANCE).toEqual([1, [4, '16']])
    expect(distance({ ...DEFAULT_ROBOT, wheelDiameterMm: 88 })).toHaveLength(1)
  })

  it('uses SPIKE fields for motor positions and movement motors', () => {
    const blocks = build([
      { op: 'set_movement_motors', left: 'E', right: 'F' },
      { op: 'motor_to_position', port: 'C', position: 90, direction: 'counterclockwise' },
    ])
    const [, pos] = byOp(blocks, 'flippermotor_motorGoDirectionToPosition')[0]
    expect(field(blocks, ref(pos.inputs.PORT))).toBe('C')
    expect(blocks[ref(pos.inputs.POSITION) ?? ''].opcode).toBe('flippermotor_custom-angle')
    expect(field(blocks, ref(pos.inputs.POSITION))).toBe('90')
    expect(pos.fields.DIRECTION).toEqual(['counterclockwise', null])
    const pairs = byOp(blocks, 'flippermove_setMovementPair').map(([, b]) => field(blocks, ref(b.inputs.PAIR)))
    expect(pairs).toEqual(['AB', 'EF'])
  })

  it('produces deterministic block ids', () => {
    const steps: Step[] = [{ op: 'beep', note: 60, seconds: 0.2 }]
    expect(Object.keys(build(steps))).toEqual(Object.keys(build(steps)))
  })
})
