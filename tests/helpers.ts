import { createRequire } from 'node:module'
import { expect } from 'vitest'

import type { ScratchBlock, ScratchProject } from '../lib/dsl/compile-blocks'
import { parseProgram } from '../lib/dsl/schema'
import { DEFAULT_ROBOT, type Program, type RobotProfile, type Step, type ProgramFunction } from '../lib/dsl/types'

const require = createRequire(import.meta.url)
// The same validator the SPIKE App runs on scratch.sb3 when a project is opened.
const scratchParser: (input: string, isSprite: boolean, cb: (err: unknown) => void) => void = require('scratch-parser')

export function validateSb3(project: unknown): Promise<void> {
  return new Promise((resolve, reject) =>
    scratchParser(JSON.stringify(project), false, (err) => (err ? reject(new Error(JSON.stringify(err).slice(0, 2000))) : resolve())),
  )
}

export function spriteBlocks(project: ScratchProject): Record<string, ScratchBlock> {
  return (project.targets[1] as { blocks: Record<string, ScratchBlock> }).blocks
}

/** Every reference between blocks must point at an existing block with a matching parent. */
export function expectLinked(blocks: Record<string, ScratchBlock>) {
  for (const [id, b] of Object.entries(blocks)) {
    if (b.next) {
      expect(blocks[b.next], `next of ${b.opcode}`).toBeDefined()
      expect(blocks[b.next].parent, `${blocks[b.next].opcode} points back to ${b.opcode}`).toBe(id)
    }
    if (b.parent) expect(blocks[b.parent], `parent of ${b.opcode}`).toBeDefined()
    for (const [name, input] of Object.entries(b.inputs)) {
      for (const ref of input.slice(1)) {
        if (typeof ref !== 'string') continue
        expect(blocks[ref], `${b.opcode}.${name}`).toBeDefined()
        expect(blocks[ref].parent, `${blocks[ref].opcode} is a child of ${b.opcode}`).toBe(id)
      }
    }
    // The prototype of a custom block is a standard Scratch shadow without fields.
    if (b.shadow && b.opcode !== 'procedures_prototype') expect(Object.keys(b.fields)).toEqual([`field_${b.opcode}`])
  }
  const tops = Object.values(blocks).filter((b) => b.topLevel)
  expect(tops.filter((b) => b.opcode !== 'procedures_definition').map((b) => b.opcode)).toEqual(['flipperevents_whenProgramStarts'])
}

/** Parses a program that must be valid. */
export function valid(raw: unknown, robot: RobotProfile = DEFAULT_ROBOT): Program {
  const r = parseProgram(raw, robot)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

/** One example of every command and every condition. */
export const EVERY_STEP: Step[] = [
  { op: 'set_speed', speed: 30 },
  { op: 'set_movement_motors', left: 'E', right: 'F' },
  { op: 'move', direction: 'back', value: 2, unit: 'seconds' },
  { op: 'move', direction: 'forward', value: 3, unit: 'inches' },
  { op: 'reset_yaw' },
  { op: 'turn', direction: 'left', degrees: 180 },
  { op: 'steer', steering: -40, value: 1.5, unit: 'rotations' },
  { op: 'start_move', direction: 'right' },
  { op: 'start_steer', steering: 25 },
  { op: 'stop_move' },
  { op: 'motor_speed', port: 'C', speed: 60 },
  { op: 'motor_run', port: 'C', direction: 'clockwise', value: 1, unit: 'seconds' },
  { op: 'motor_to_position', port: 'C', position: 90, direction: 'shortest' },
  { op: 'motor_start', port: 'D', direction: 'counterclockwise' },
  { op: 'motor_stop', port: 'D' },
  { op: 'show_image', image: 'heart' },
  { op: 'show_image', image: '9000009000009000009000009', seconds: 1 },
  { op: 'write', text: 'Go!' },
  { op: 'clear_display' },
  { op: 'beep', note: 60, seconds: 0.2 },
  { op: 'button_light', color: 'orange' },
  { op: 'wait', seconds: 0.5 },
  { op: 'wait_until', condition: { sensor: 'force', port: 'E', state: 'hardpressed' } },
  { op: 'repeat_until', condition: { sensor: 'button', button: 'right', state: 'pressed' }, steps: [{ op: 'beep', note: 72, seconds: 0.1 }] },
  {
    op: 'if',
    condition: { sensor: 'reflection', port: 'D', comparator: '>', value: 60 },
    then: [{ op: 'start_steer', steering: 30 }],
    else: [{ op: 'start_steer', steering: -30 }],
  },
  { op: 'if', condition: { sensor: 'distance', port: 'C', comparator: '=', value: 50, unit: '%' }, then: [] },
  { op: 'repeat', times: 2, steps: [{ op: 'wait_until', condition: { sensor: 'color', port: 'D', color: 'none' } }] },
  { op: 'arc', direction: 'left', radius: 25, degrees: 90 },
  { op: 'circle', direction: 'right', radius: 20, turns: 1 },
  { op: 'tank', leftSpeed: 30, rightSpeed: 60, value: 2, unit: 'seconds' },
  { op: 'set_var', name: 'side', expr: { num: 5 } },
  { op: 'change_var', name: 'side', expr: { op: '+', a: { var: 'side' }, b: { num: 1 } } },
  { op: 'move_expr', direction: 'back', expr: { var: 'side' }, unit: 'cm' },
  { op: 'write_var', name: 'side' },
  { op: 'while', condition: { sensor: 'gyro', axis: 'yaw', comparator: '<', value: 10 }, steps: [{ op: 'wait', seconds: 0.1 }] },
  { op: 'if', condition: { sensor: 'var', name: 'side', comparator: '>', value: 3 }, then: [{ op: 'stop_move' }] },
  { op: 'call', name: 'helper' },
  { op: 'forever', steps: [{ op: 'wait_until', condition: { sensor: 'force', port: 'E', state: 'released' } }] },
]

export const EVERY_FUNCTIONS: ProgramFunction[] = [{ name: 'helper', steps: [{ op: 'stop_move' }] }]

/** Commands only generated programs use: the lesson editor has no blocks for them. */
const GENERATED_ONLY: ReadonlySet<Step['op']> = new Set(['arc', 'circle', 'tank', 'set_var', 'change_var', 'move_expr', 'write_var', 'while', 'call'])
export const LESSON_STEPS: Step[] = EVERY_STEP.filter((s) => !GENERATED_ONLY.has(s.op) && !(s.op === 'if' && s.condition.sensor === 'var'))

export const EVERY_OP: Step['op'][] = [...new Set(EVERY_STEP.map((s) => s.op))]
