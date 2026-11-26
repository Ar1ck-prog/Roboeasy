import { describe, expect, it } from 'vitest'

import { parseWedoProgram, wedoCheckIssues, wedoCheckSchema, wedoSceneSchema } from '@/lib/wedo/schema'
import { WEDO_LIMITS, type WedoStep, defaultStep, opCount, repeatDepth, wedoBlocks, WEDO_OPS } from '@/lib/wedo/types'

const ok = (raw: unknown): WedoStep[] => {
  const r = parseWedoProgram(raw)
  if (!r.ok) throw new Error(r.error)
  return r.value
}

describe('WeDo program schema', () => {
  it('clamps numbers into the ranges of the real blocks', () => {
    expect(
      ok([
        { op: 'motor_on_for', seconds: 99 },
        { op: 'motor_on_for', seconds: 0 },
        { op: 'motor_power', power: 15 },
        { op: 'motor_power', power: -3 },
        { op: 'sound', sound: 0 },
        { op: 'wait', seconds: 1.234 },
        { op: 'repeat', times: 50, steps: [] },
        { op: 'repeat', times: 1, steps: [] },
        { op: 'display', kind: 'text', value: 'ABCDEFGHIJKLMNOP' },
      ]),
    ).toEqual([
      { op: 'motor_on_for', seconds: 10 },
      { op: 'motor_on_for', seconds: 0.1 },
      { op: 'motor_power', power: 10 },
      { op: 'motor_power', power: 0 },
      { op: 'sound', sound: 1 },
      { op: 'wait', seconds: 1.2 },
      { op: 'repeat', times: 10, steps: [] },
      { op: 'repeat', times: 2, steps: [] },
      { op: 'display', kind: 'text', value: 'ABCDEFGHIJKL' },
    ])
    expect(ok([{ op: 'display', kind: 'number', value: 3 }])).toEqual([{ op: 'display', kind: 'number', value: '3' }])
  })

  it('rejects unknown blocks and fields', () => {
    expect(parseWedoProgram([{ op: 'fly' }]).ok).toBe(false)
    expect(parseWedoProgram([{ op: 'move', direction: 'forward', value: 10, unit: 'cm' }]).ok).toBe(false)
    expect(parseWedoProgram([{ op: 'motor_on', speed: 5 }]).ok).toBe(false)
    expect(parseWedoProgram([{ op: 'light', color: 'purple' }]).ok).toBe(false)
    expect(parseWedoProgram([{ op: 'wait_tilt', state: 'sideways' }]).ok).toBe(false)
    expect(parseWedoProgram('motor').ok).toBe(false)
  })

  it('allows at most 20 blocks', () => {
    const many = Array.from({ length: WEDO_LIMITS.maxBlocks }, () => ({ op: 'motor_off' }))
    expect(parseWedoProgram(many).ok).toBe(true)
    expect(parseWedoProgram([...many, { op: 'motor_off' }]).ok).toBe(false)
    expect(parseWedoProgram([{ op: 'repeat', times: 2, steps: many }]).ok).toBe(false)
  })

  it('nests repeats at most twice', () => {
    const inner = { op: 'repeat', times: 2, steps: [{ op: 'sound', sound: 1 }] }
    expect(parseWedoProgram([{ op: 'repeat', times: 'forever', steps: [inner] }]).ok).toBe(true)
    expect(parseWedoProgram([{ op: 'repeat', times: 2, steps: [{ op: 'repeat', times: 2, steps: [inner] }] }]).ok).toBe(false)
  })

  it('counts blocks, uses and depth', () => {
    const p = ok([{ op: 'repeat', times: 3, steps: [{ op: 'light', color: 'red' }, { op: 'repeat', times: 2, steps: [{ op: 'light', color: 'off' }] }] }])
    expect(wedoBlocks(p)).toBe(4)
    expect(opCount(p, 'light')).toBe(2)
    expect(opCount(p, 'repeat')).toBe(2)
    expect(repeatDepth(p)).toBe(2)
  })

  it('every block has valid defaults', () => {
    for (const op of WEDO_OPS) expect(parseWedoProgram([defaultStep(op)]).ok, op).toBe(true)
  })
})

describe('WeDo scenes and checks', () => {
  it('rejects zones outside the track', () => {
    expect(wedoSceneSchema.safeParse({ model: 'rover', length: 1000, start: 100, zones: [{ id: 'a', from: 900, to: 1200 }], obstacles: [] }).success).toBe(false)
    expect(wedoSceneSchema.safeParse({ model: 'rover', length: 1000, start: 100, zones: [{ id: 'a', from: 500, to: 600 }], obstacles: [] }).success).toBe(true)
    expect(wedoSceneSchema.safeParse({ model: 'boat' }).success).toBe(false)
  })

  it('finds checks that do not fit the scene', () => {
    const rover = wedoSceneSchema.parse({ model: 'rover', length: 1000, start: 100, zones: [{ id: 'a', from: 500, to: 600 }], obstacles: [] })
    const lift = wedoSceneSchema.parse({ model: 'lift', levels: 2, mmPerTurn: 6 })
    const c = (raw: unknown) => wedoCheckSchema.parse(raw)
    expect(wedoCheckIssues(rover, [c({ type: 'roverInZone', zone: 'a' })], undefined)).toEqual([])
    expect(wedoCheckIssues(rover, [c({ type: 'roverInZone', zone: 'b' })], undefined)).toEqual(['unknown zone b'])
    expect(wedoCheckIssues(lift, [c({ type: 'liftAt', level: 3 })], undefined)).toEqual(['unknown level 3'])
    expect(wedoCheckIssues(lift, [c({ type: 'spinnerTurns', minTurns: 1 })], undefined)).toEqual(['spinnerTurns needs a spinner scene'])
    expect(wedoCheckIssues(lift, [c({ type: 'reactsTo', sensor: 'tilt', action: 'light' })], undefined).length).toBe(2)
  })
})
