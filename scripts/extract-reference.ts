/**
 * Lists the blocks used in reference .llsp3 files (exported from the LEGO
 * SPIKE App into ./reference) and checks our compiler against them.
 *
 *   npm run reference
 *
 * Prints: every opcode found with an example of its inputs/fields, the
 * differences with our compiled blocks, and which of our blocks still have no
 * reference export.
 */

import path from 'node:path'

import { STEP_OPS } from '../lib/dsl/schema'
import type { Program, Step } from '../lib/dsl/types'
import { compareShapes, ourShapes, referenceFiles, referenceShapes } from './reference-lib'

/** One command of every kind, so the compiler emits every opcode it can. */
const ALL_COMMANDS: Step[] = [
  { op: 'set_speed', speed: 30 },
  { op: 'set_movement_motors', left: 'A', right: 'B' },
  { op: 'move', direction: 'forward', value: 10, unit: 'cm' },
  { op: 'turn', direction: 'right', degrees: 90 },
  { op: 'reset_yaw' },
  { op: 'steer', steering: 30, value: 1, unit: 'rotations' },
  { op: 'start_move', direction: 'back' },
  { op: 'start_steer', steering: -30 },
  { op: 'stop_move' },
  { op: 'motor_run', port: 'C', direction: 'clockwise', value: 90, unit: 'degrees' },
  { op: 'motor_start', port: 'C', direction: 'counterclockwise' },
  { op: 'motor_stop', port: 'C' },
  { op: 'motor_speed', port: 'C', speed: 50 },
  { op: 'motor_to_position', port: 'C', position: 0, direction: 'shortest' },
  { op: 'show_image', image: 'smile' },
  { op: 'show_image', image: 'heart', seconds: 1 },
  { op: 'write', text: 'Hi' },
  { op: 'clear_display' },
  { op: 'beep', note: 60, seconds: 0.2 },
  { op: 'button_light', color: 'green' },
  { op: 'wait', seconds: 1 },
  { op: 'wait_until', condition: { sensor: 'distance', port: 'C', comparator: '<', value: 10, unit: 'cm' } },
  { op: 'wait_until', condition: { sensor: 'force', port: 'E', state: 'pressed' } },
  { op: 'wait_until', condition: { sensor: 'button', button: 'left', state: 'pressed' } },
  { op: 'repeat', times: 2, steps: [{ op: 'stop_move' }] },
  { op: 'repeat_until', condition: { sensor: 'reflection', port: 'D', comparator: '<', value: 50 }, steps: [{ op: 'stop_move' }] },
  { op: 'if', condition: { sensor: 'color', port: 'D', color: 'red' }, then: [{ op: 'stop_move' }] },
  { op: 'if', condition: { sensor: 'color', port: 'D', color: 'red' }, then: [{ op: 'stop_move' }], else: [{ op: 'stop_move' }] },
  { op: 'arc', direction: 'right', radius: 25, degrees: 90 },
  { op: 'circle', direction: 'left', radius: 20, turns: 1 },
  { op: 'tank', leftSpeed: 30, rightSpeed: 60, value: 2, unit: 'seconds' },
  { op: 'set_var', name: 'side', expr: { op: '+', a: { num: 1 }, b: { num: 2 } } },
  { op: 'change_var', name: 'side', expr: { op: '*', a: { var: 'side' }, b: { num: 2 } } },
  { op: 'move_expr', direction: 'forward', expr: { op: '-', a: { var: 'side' }, b: { num: 1 } }, unit: 'cm' },
  { op: 'write_var', name: 'side' },
  { op: 'while', condition: { sensor: 'gyro', axis: 'yaw', comparator: '<', value: 90 }, steps: [{ op: 'stop_move' }] },
  { op: 'if', condition: { sensor: 'var', name: 'side', comparator: '=', value: 3 }, then: [{ op: 'call', name: 'helper' }] },
  { op: 'forever', steps: [{ op: 'stop_move' }] },
]

export const ALL_COMMANDS_PROGRAM: Program = { title: 'All', description: '', steps: ALL_COMMANDS, functions: [{ name: 'helper', steps: [{ op: 'stop_move' }] }] }

async function main() {
  const files = referenceFiles()
  const covered = new Set(ALL_COMMANDS.map((s) => s.op))
  const missingOps = STEP_OPS.filter((op) => !covered.has(op))
  if (missingOps.length) console.warn(`ALL_COMMANDS misses: ${missingOps.join(', ')}`)

  const ours = ourShapes(ALL_COMMANDS_PROGRAM)
  if (!files.length) {
    console.log(`No .llsp3 files in ${path.relative(process.cwd(), path.resolve('reference')) || 'reference'}/.`)
    console.log('Export from the SPIKE App (word blocks) a project that uses these blocks and put it there:\n')
    for (const op of [...ours.keys()].sort()) console.log(`  ${op}`)
    return
  }

  console.log(`Reference files (${files.length}): ${files.map((f) => path.basename(f)).join(', ')}\n`)
  const refs = await referenceShapes(files)

  console.log('== Blocks found in the references ==')
  for (const shape of [...refs.values()].sort((a, b) => a.opcode.localeCompare(b.opcode))) {
    const inputs = Object.entries(shape.inputs).map(([k, v]) => `${k}=${v}`).join(', ')
    const fields = shape.example.fields ? JSON.stringify(shape.example.fields) : '{}'
    console.log(`${shape.opcode}\n    inputs: ${inputs || '—'}\n    fields: ${fields}`)
  }

  console.log('\n== Our blocks vs references ==')
  const missing: string[] = []
  let problems = 0
  for (const [op, shape] of [...ours.entries()].sort()) {
    const ref = refs.get(op)
    if (!ref) {
      missing.push(op)
      continue
    }
    const issues = compareShapes(shape, ref)
    problems += issues.length
    console.log(issues.length ? `✖ ${op}\n    ${issues.join('\n    ')}` : `✔ ${op}`)
  }
  if (missing.length) {
    console.log('\n== No reference yet — export a SPIKE project that uses: ==')
    for (const op of missing) console.log(`  ${op}`)
  }
  console.log(`\n${ours.size - missing.length}/${ours.size} blocks checked, ${problems} differences, ${missing.length} without reference.`)
  if (problems) process.exitCode = 1
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename ?? '')) void main()
