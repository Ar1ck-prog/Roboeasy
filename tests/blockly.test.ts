import { describe, expect, it } from 'vitest'

import { stateToSteps, stepsToState } from '../lib/blockly/convert'
import { BLOCK_TYPES, blockDefs, toolboxBlocks } from '../lib/blockly/defs'
import type { Step } from '../lib/dsl/types'
import { en } from '../lib/i18n/en'
import { kk } from '../lib/i18n/kk'
import { ru } from '../lib/i18n/ru'
import { LESSON_STEPS } from './helpers'

describe('blockly definitions', () => {
  it('has a block for every type, with %n matching the args in all languages', () => {
    for (const [lang, dict] of [['ru', ru], ['kk', kk], ['en', en]] as const) {
      const defs = blockDefs(dict.blocks, lang)
      const types = new Set(defs.map((d) => d.type))
      for (const t of Object.values(BLOCK_TYPES)) expect(types, `${lang}: ${t}`).toContain(t)
      for (const d of defs) {
        const refs = [...d.message0.matchAll(/%(\d+)/g)].map((m) => Number(m[1]))
        expect(refs.length, `${lang} ${d.type}: ${d.message0}`).toBe(d.args0?.length ?? 0)
        expect(d.message0).not.toMatch(/\{[A-Z]+\}/)
      }
    }
  })

  it('builds a lesson palette with condition blocks only when needed', () => {
    expect(toolboxBlocks(['move', 'turn'])).toEqual([BLOCK_TYPES.move, BLOCK_TYPES.turn])
    expect(toolboxBlocks(['wait_until'])).toContain(BLOCK_TYPES.cond_distance)
    expect(toolboxBlocks(['if'])).toEqual(expect.arrayContaining([BLOCK_TYPES.if, BLOCK_TYPES.if_else]))
  })
})

describe('DSL ⇄ blocks', () => {
  it('round-trips every command', () => {
    const steps = LESSON_STEPS as Step[]
    const back = stateToSteps(stepsToState(steps))
    expect(back.steps).toEqual(steps)
    expect(back.detached).toBe(0)
  })

  it('maps step paths to block ids, ignores detached blocks and empty conditions', () => {
    const state = stepsToState([
      { op: 'move', direction: 'forward', value: 10, unit: 'cm' },
      { op: 'repeat', times: 2, steps: [{ op: 'turn', direction: 'left', degrees: 90 }] },
    ])
    // Give the blocks ids like Blockly does.
    let n = 0
    const tag = (b: NonNullable<NonNullable<typeof state.blocks>['blocks'][number]> | undefined): void => {
      if (!b) return
      b.id = `b${n++}`
      tag(b.next?.block)
      Object.values(b.inputs ?? {}).forEach((i) => tag(i.block))
    }
    state.blocks!.blocks.forEach(tag)
    state.blocks!.blocks.push({ type: BLOCK_TYPES.beep, fields: { NOTE: 60, VALUE: 1 }, x: 300, y: 300 })
    state.blocks!.blocks[0].next!.block!.next!.block!.next = { block: { type: BLOCK_TYPES.wait_until, id: 'w' } }
    const r = stateToSteps(state)
    expect(r.steps.map((s) => s.op)).toEqual(['move', 'repeat'])
    expect(r.ids['0']).toBe('b1')
    expect(r.ids['1.0']).toBeDefined()
    expect(r.detached).toBe(1)
    expect(r.missingConditions).toBe(1)
  })

  it('returns an empty program without a start block', () => {
    expect(stateToSteps({}).steps).toEqual([])
  })
})
