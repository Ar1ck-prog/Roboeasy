/**
 * Every code task can really be solved in the lesson editor: the reference solution, built
 * block by block, survives the Blockly round trip, fits the fields' limits and dropdowns
 * (Blockly silently clamps a number outside them), and then passes the lesson's checks.
 */
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { type BlockState, stateToSteps, stepsToState } from '../lib/blockly/convert'
import { blockDefs, toolboxBlocks } from '../lib/blockly/defs'
import { ru } from '../lib/i18n/ru'
import { runChecks } from '../lib/learn/checks'
import { readLesson } from '../lib/learn/content'

const DEFS = new Map(blockDefs(ru.blocks, 'ru').map((d) => [d.type, d]))

/** Every block in a workspace, nested ones included. */
function blocksOf(state: ReturnType<typeof stepsToState>): BlockState[] {
  const out: BlockState[] = []
  const walk = (b: BlockState | undefined) => {
    if (!b) return
    out.push(b)
    for (const input of Object.values(b.inputs ?? {})) walk(input.block)
    walk(b.next?.block)
  }
  for (const b of state.blocks?.blocks ?? []) walk(b)
  return out
}

/** Problems with a block's field values against its definition (ranges, dropdown options). */
function fieldProblems(b: BlockState): string[] {
  const def = DEFS.get(b.type)
  if (!def) return [`no block definition for ${b.type}`]
  const args = [...(def.args0 ?? []), ...(def.args1 ?? []), ...(def.args2 ?? [])]
  const problems: string[] = []
  for (const [name, value] of Object.entries(b.fields ?? {})) {
    const arg = args.find((a) => 'name' in a && a.name === name)
    if (!arg) problems.push(`${b.type}.${name}: no such field`)
    else if (arg.type === 'field_number') {
      const v = Number(value)
      if ((arg.min !== undefined && v < arg.min) || (arg.max !== undefined && v > arg.max)) problems.push(`${b.type}.${name}=${v} outside ${arg.min}…${arg.max}`)
    } else if (arg.type === 'field_dropdown' && !arg.options.some(([, v]) => v === String(value))) problems.push(`${b.type}.${name}=${value} not in the dropdown`)
  }
  return problems
}

const DIR = path.join(__dirname, '..', 'content', 'learn', 'lessons')
const steps = fs
  .readdirSync(DIR)
  .flatMap((f) => readLesson(f.replace('.json', ''))!.steps.map((step) => ({ lesson: f.replace('.json', ''), step })))
  .flatMap(({ lesson, step }) => (step.type === 'code' || step.type === 'debug' || step.type === 'project' ? [{ name: `${lesson}/${step.id}`, step }] : []))

describe.each(steps.map(({ name, step }) => [name, step] as const))('editor %s', (_, step) => {
  it('the reference can be built with the offered blocks, round-trips and passes', () => {
    const state = stepsToState(step.reference!, step.referenceFunctions)
    const blocks = blocksOf(state)
    const palette = new Set(toolboxBlocks(step.toolbox))
    for (const b of blocks) if (b.type !== 're_start') expect(palette, `block ${b.type} is not in the palette`).toContain(b.type)
    expect(blocks.flatMap(fieldProblems)).toEqual([])
    const back = stateToSteps(state)
    expect(back.problem).toBeUndefined()
    expect(back.steps).toEqual(step.reference)
    const report = runChecks(back.steps, step.field, step.checks, 'ru', undefined, back.functions)
    expect(report.results.filter((r) => !r.ok).map((r) => r.message)).toEqual([])
  })

  it('the starting program loads into the editor unchanged', () => {
    const state = stepsToState(step.start, step.startFunctions)
    expect(blocksOf(state).flatMap(fieldProblems)).toEqual([])
    expect(stateToSteps(state).steps).toEqual(step.start)
  })
})
