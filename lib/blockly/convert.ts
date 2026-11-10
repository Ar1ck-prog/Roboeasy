/**
 * DSL ⇄ Blockly workspace JSON (the format of
 * Blockly.serialization.workspaces.save/load). Pure functions: the editor
 * converts on every change, and tests run without a browser.
 */

import { parseProgram } from '../dsl/schema'
import type { Condition, Step } from '../dsl/types'
import { BLOCK_TYPES } from './defs'

export interface BlockState {
  type: string
  id?: string
  x?: number
  y?: number
  fields?: Record<string, string | number>
  inputs?: Record<string, { block?: BlockState }>
  next?: { block?: BlockState }
}

export interface WorkspaceState {
  blocks?: { languageVersion: number; blocks: BlockState[] }
}

const T = BLOCK_TYPES

// ── DSL → blocks ────────────────────────────────────────────────────────

function conditionBlock(c: Condition): BlockState {
  switch (c.sensor) {
    case 'distance':
      return { type: T.cond_distance, fields: { PORT: c.port, CMP: c.comparator, VALUE: c.value, UNIT: c.unit } }
    case 'color':
      return { type: T.cond_color, fields: { PORT: c.port, COLOR: c.color } }
    case 'reflection':
      return { type: T.cond_reflection, fields: { PORT: c.port, CMP: c.comparator, VALUE: c.value } }
    case 'force':
      return { type: T.cond_force, fields: { PORT: c.port, STATE: c.state } }
    case 'button':
      return { type: T.cond_button, fields: { BUTTON: c.button, STATE: c.state } }
    // The lesson editor has no blocks for these: only generated programs use them.
    case 'gyro':
    case 'var':
      return { type: T.cond_button, fields: { BUTTON: 'left', STATE: 'pressed' } }
  }
}

function chain(steps: Step[]): BlockState | undefined {
  let head: BlockState | undefined
  let tail: BlockState | undefined
  for (const s of steps) {
    const b = stepBlock(s)
    if (!b) continue
    if (!head) head = b
    if (tail) tail.next = { block: b }
    tail = b
  }
  return head
}

const body = (steps: Step[]) => {
  const block = chain(steps)
  return block ? { block } : {}
}

function stepBlock(s: Step): BlockState | null {
  switch (s.op) {
    case 'move':
      return { type: T.move, fields: { DIR: s.direction, VALUE: s.value, UNIT: s.unit } }
    case 'turn':
      return { type: T.turn, fields: { DIR: s.direction, VALUE: s.degrees } }
    case 'steer':
      return { type: T.steer, fields: { STEER: s.steering, VALUE: s.value, UNIT: s.unit } }
    case 'start_move':
      return { type: T.start_move, fields: { DIR: s.direction } }
    case 'start_steer':
      return { type: T.start_steer, fields: { STEER: s.steering } }
    case 'stop_move':
      return { type: T.stop_move }
    case 'set_speed':
      return { type: T.set_speed, fields: { VALUE: s.speed } }
    case 'reset_yaw':
      return { type: T.reset_yaw }
    case 'set_movement_motors':
      return { type: T.set_movement_motors, fields: { LEFT: s.left, RIGHT: s.right } }
    case 'motor_run':
      return { type: T.motor_run, fields: { PORT: s.port, DIR: s.direction, VALUE: s.value, UNIT: s.unit } }
    case 'motor_start':
      return { type: T.motor_start, fields: { PORT: s.port, DIR: s.direction } }
    case 'motor_stop':
      return { type: T.motor_stop, fields: { PORT: s.port } }
    case 'motor_speed':
      return { type: T.motor_speed, fields: { PORT: s.port, VALUE: s.speed } }
    case 'motor_to_position':
      return { type: T.motor_to_position, fields: { PORT: s.port, VALUE: s.position, DIR: s.direction } }
    case 'show_image':
      return s.seconds ? { type: T.show_image_timed, fields: { IMAGE: s.image, VALUE: s.seconds } } : { type: T.show_image, fields: { IMAGE: s.image } }
    case 'write':
      return { type: T.write, fields: { TEXT: s.text } }
    case 'clear_display':
      return { type: T.clear_display }
    case 'beep':
      return { type: T.beep, fields: { NOTE: s.note, VALUE: s.seconds } }
    case 'button_light':
      return { type: T.button_light, fields: { COLOR: s.color } }
    case 'wait':
      return { type: T.wait, fields: { VALUE: s.seconds } }
    case 'wait_until':
      return { type: T.wait_until, inputs: { COND: { block: conditionBlock(s.condition) } } }
    case 'repeat':
      return { type: T.repeat, fields: { VALUE: s.times }, inputs: { DO: body(s.steps) } }
    case 'forever':
      return { type: T.forever, inputs: { DO: body(s.steps) } }
    case 'repeat_until':
      return { type: T.repeat_until, inputs: { COND: { block: conditionBlock(s.condition) }, DO: body(s.steps) } }
    case 'if':
      return s.else
        ? { type: T.if_else, inputs: { COND: { block: conditionBlock(s.condition) }, THEN: body(s.then), ELSE: body(s.else) } }
        : { type: T.if, inputs: { COND: { block: conditionBlock(s.condition) }, THEN: body(s.then) } }
    // Generated programs only; lessons do not offer these blocks.
    default:
      return null
  }
}

/** Workspace with a start block followed by the program. */
export function stepsToState(steps: Step[]): WorkspaceState {
  const start: BlockState = { type: T.start, x: 24, y: 24 }
  const next = chain(steps)
  if (next) start.next = { block: next }
  return { blocks: { languageVersion: 0, blocks: [start] } }
}

// ── Blocks → DSL ────────────────────────────────────────────────────────

const str = (b: BlockState, name: string) => String(b.fields?.[name] ?? '')
const n = (b: BlockState, name: string) => Number(b.fields?.[name] ?? 0)

function readCondition(b: BlockState | undefined): Condition | null {
  if (!b) return null
  switch (b.type) {
    case T.cond_distance:
      return { sensor: 'distance', port: str(b, 'PORT'), comparator: str(b, 'CMP'), value: n(b, 'VALUE'), unit: str(b, 'UNIT') } as Condition
    case T.cond_color:
      return { sensor: 'color', port: str(b, 'PORT'), color: str(b, 'COLOR') } as Condition
    case T.cond_reflection:
      return { sensor: 'reflection', port: str(b, 'PORT'), comparator: str(b, 'CMP'), value: n(b, 'VALUE') } as Condition
    case T.cond_force:
      return { sensor: 'force', port: str(b, 'PORT'), state: str(b, 'STATE') } as Condition
    case T.cond_button:
      return { sensor: 'button', button: str(b, 'BUTTON'), state: str(b, 'STATE') } as Condition
    default:
      return null
  }
}

export interface ReadResult {
  steps: Step[]
  /** Step path ("2.0", "1.then.0") → block id, for highlighting while running. */
  ids: Record<string, string>
  /** Blocks not attached under the start block (they do not run). */
  detached: number
  /** Blocks with an empty condition slot. */
  missingConditions: number
}

/** Reads the program under the start block. Unknown or incomplete blocks are skipped. */
export function stateToSteps(state: WorkspaceState): ReadResult {
  const top = state.blocks?.blocks ?? []
  const ids: Record<string, string> = {}
  let missingConditions = 0
  const start = top.find((b) => b.type === T.start)
  const countTree = (b: BlockState | undefined): number => {
    if (!b) return 0
    let c = 1 + countTree(b.next?.block)
    for (const input of Object.values(b.inputs ?? {})) c += countTree(input.block)
    return c
  }
  const detached = top.filter((b) => b !== start).reduce((sum, b) => sum + countTree(b), 0)

  const readChain = (first: BlockState | undefined, path: string): Step[] => {
    const out: Step[] = []
    for (let b = first; b; b = b.next?.block) {
      const here = path ? `${path}.${out.length}` : String(out.length)
      const step = readBlock(b, here)
      if (!step) continue
      if (b.id) ids[here] = b.id
      out.push(step)
    }
    return out
  }

  const needCondition = (b: BlockState): Condition | null => {
    const c = readCondition(b.inputs?.COND?.block)
    if (!c) missingConditions++
    return c
  }

  const readBlock = (b: BlockState, path: string): Step | null => {
    switch (b.type) {
      case T.move:
        return { op: 'move', direction: str(b, 'DIR'), value: n(b, 'VALUE'), unit: str(b, 'UNIT') } as Step
      case T.turn:
        return { op: 'turn', direction: str(b, 'DIR'), degrees: n(b, 'VALUE') } as Step
      case T.steer:
        return { op: 'steer', steering: n(b, 'STEER'), value: n(b, 'VALUE'), unit: str(b, 'UNIT') } as Step
      case T.start_move:
        return { op: 'start_move', direction: str(b, 'DIR') } as Step
      case T.start_steer:
        return { op: 'start_steer', steering: n(b, 'STEER') }
      case T.stop_move:
        return { op: 'stop_move' }
      case T.set_speed:
        return { op: 'set_speed', speed: n(b, 'VALUE') }
      case T.reset_yaw:
        return { op: 'reset_yaw' }
      case T.set_movement_motors:
        return { op: 'set_movement_motors', left: str(b, 'LEFT'), right: str(b, 'RIGHT') } as Step
      case T.motor_run:
        return { op: 'motor_run', port: str(b, 'PORT'), direction: str(b, 'DIR'), value: n(b, 'VALUE'), unit: str(b, 'UNIT') } as Step
      case T.motor_start:
        return { op: 'motor_start', port: str(b, 'PORT'), direction: str(b, 'DIR') } as Step
      case T.motor_stop:
        return { op: 'motor_stop', port: str(b, 'PORT') } as Step
      case T.motor_speed:
        return { op: 'motor_speed', port: str(b, 'PORT'), speed: n(b, 'VALUE') } as Step
      case T.motor_to_position:
        return { op: 'motor_to_position', port: str(b, 'PORT'), position: n(b, 'VALUE'), direction: str(b, 'DIR') } as Step
      case T.show_image:
        return { op: 'show_image', image: str(b, 'IMAGE') }
      case T.show_image_timed:
        return { op: 'show_image', image: str(b, 'IMAGE'), seconds: n(b, 'VALUE') }
      case T.write:
        return { op: 'write', text: str(b, 'TEXT') }
      case T.clear_display:
        return { op: 'clear_display' }
      case T.beep:
        return { op: 'beep', note: n(b, 'NOTE'), seconds: n(b, 'VALUE') }
      case T.button_light:
        return { op: 'button_light', color: str(b, 'COLOR') } as Step
      case T.wait:
        return { op: 'wait', seconds: n(b, 'VALUE') }
      case T.wait_until: {
        const c = needCondition(b)
        return c ? { op: 'wait_until', condition: c } : null
      }
      case T.repeat:
        return { op: 'repeat', times: n(b, 'VALUE'), steps: readChain(b.inputs?.DO?.block, path) }
      case T.forever:
        return { op: 'forever', steps: readChain(b.inputs?.DO?.block, path) }
      case T.repeat_until: {
        const c = needCondition(b)
        return c ? { op: 'repeat_until', condition: c, steps: readChain(b.inputs?.DO?.block, path) } : null
      }
      case T.if:
      case T.if_else: {
        const c = needCondition(b)
        if (!c) return null
        const then = readChain(b.inputs?.THEN?.block, `${path}.then`)
        return b.type === T.if_else ? { op: 'if', condition: c, then, else: readChain(b.inputs?.ELSE?.block, `${path}.else`) } : { op: 'if', condition: c, then }
      }
      default:
        return null
    }
  }

  const raw = readChain(start?.next?.block, '')
  // Same validation as any program: values are clamped, structure is checked.
  const parsed = parseProgram({ title: 'blocks', description: '', steps: raw })
  return { steps: parsed.ok ? parsed.value.steps : raw, ids, detached, missingConditions }
}
