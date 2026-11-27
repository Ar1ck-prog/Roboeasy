import { describe, expect, it } from 'vitest'

import { runWedoChecks } from '@/lib/wedo/checks'
import {
  DEFAULT_POWER,
  FAR_MM,
  GATE_RATIO,
  LEVEL_MM,
  MAX_TIME,
  MOTOR_RPM_PER_POWER,
  NEAR_MM,
  ROVER_LENGTH,
  ROVER_MM_S_PER_POWER,
  WedoRunner,
  frameAt,
  outputsAt,
  simulateWedo,
} from '@/lib/wedo/sim'
import type { WedoScene, WedoStep } from '@/lib/wedo/types'

const rover: WedoScene = { model: 'rover', length: 1500, start: 100, zones: [{ id: 'flag', from: 600, to: 800 }], obstacles: [] }
const spinner: WedoScene = { model: 'spinner', ratio: 1 }
const lift: WedoScene = { model: 'lift', levels: 3, mmPerTurn: 6 }
const gate: WedoScene = { model: 'gate', sensor: 'motion' }

describe('WeDo simulator', () => {
  it('is deterministic: two runs give the same result', () => {
    const program: WedoStep[] = [
      { op: 'light', color: 'green' },
      { op: 'repeat', times: 3, steps: [{ op: 'motor_on_for', seconds: 0.5 }, { op: 'sound', sound: 2 }] },
    ]
    expect(simulateWedo(program, rover)).toEqual(simulateWedo(program, rover))
  })

  it('drives the rover by time and power (25 mm/s per power unit)', () => {
    const at = (power: number, seconds: number) =>
      simulateWedo([{ op: 'motor_power', power }, { op: 'motor_on_for', seconds }], rover).end.x
    expect(at(DEFAULT_POWER, 2)).toBeCloseTo(100 + ROVER_MM_S_PER_POWER * DEFAULT_POWER * 2, 0)
    expect(at(8, 3)).toBeGreaterThan(at(8, 2))
    expect(at(10, 2)).toBeGreaterThan(at(5, 2))
    expect(at(0, 2)).toBe(100)
  })

  it('drives back with "that way" and returns home', () => {
    const r = simulateWedo(
      [
        { op: 'motor_on_for', seconds: 2 },
        { op: 'motor_direction', dir: 'that' },
        { op: 'motor_on_for', seconds: 2 },
      ],
      rover,
    )
    expect(r.end.x).toBeCloseTo(100, 0)
    expect(r.end.maxAway).toBeGreaterThan(300)
  })

  it('stops at walls and obstacles and reports the crash', () => {
    const scene: WedoScene = { ...rover, obstacles: [{ id: 'wall', at: 500 }] }
    const r = simulateWedo([{ op: 'motor_on_for', seconds: 5 }], scene)
    expect(r.end.x).toBeCloseTo(500 - ROVER_LENGTH / 2, 3)
    expect(r.end.crashed).toBe(true)
    expect(r.events.filter((e) => e.kind === 'crash')).toHaveLength(1)
  })

  it('motion sensor on the rover sees an obstacle: near at 100 mm, far beyond 150 mm', () => {
    const scene: WedoScene = { ...rover, sensor: 'motion', obstacles: [{ id: 'wall', at: 900 }] }
    const r = simulateWedo([{ op: 'motor_on' }, { op: 'wait_motion', event: 'near' }, { op: 'motor_off' }], scene)
    const gap = 900 - (r.end.x + ROVER_LENGTH / 2)
    expect(gap).toBeLessThanOrEqual(NEAR_MM)
    expect(gap).toBeGreaterThan(NEAR_MM - 5)
    expect(r.end.crashed).toBe(false)
    expect(r.events.some((e) => e.kind === 'sensor' && e.state === 'near')).toBe(true)
    expect(FAR_MM).toBeGreaterThan(NEAR_MM)
  })

  it('turns the spinner by power and gear ratio', () => {
    const turns = (ratio: number, power = 8) =>
      simulateWedo([{ op: 'motor_power', power }, { op: 'motor_on_for', seconds: 2 }], { model: 'spinner', ratio }).end.spinTurns.this
    expect(turns(1)).toBeCloseTo((MOTOR_RPM_PER_POWER * 8 * 2) / 60, 1)
    expect(turns(3)).toBeCloseTo(turns(1) * 3, 1)
    expect(turns(1, 4)).toBeCloseTo(turns(1) / 2, 1)
    const back = simulateWedo([{ op: 'motor_direction', dir: 'that' }, { op: 'motor_on_for', seconds: 1 }], spinner)
    expect(back.end.spinTurns.that).toBeGreaterThan(0)
    expect(back.end.angle).toBeLessThan(0)
  })

  it('the crane hook stops hard at the top and the bottom', () => {
    const up = simulateWedo([{ op: 'motor_on_for', seconds: 10 }, { op: 'motor_on_for', seconds: 10 }], lift)
    expect(up.end.height).toBe(3 * LEVEL_MM)
    const down = simulateWedo([{ op: 'motor_direction', dir: 'that' }, { op: 'motor_on_for', seconds: 3 }], lift)
    expect(down.end.height).toBe(0)
  })

  it('the barrier arm stops at 0 and 90 degrees', () => {
    const open = simulateWedo([{ op: 'motor_on_for', seconds: 5 }], gate)
    expect(open.end.gate).toBe(90)
    const speed = MOTOR_RPM_PER_POWER * DEFAULT_POWER * 6 * GATE_RATIO
    const half = simulateWedo([{ op: 'motor_on_for', seconds: 45 / speed }], gate)
    expect(half.end.gate).toBeGreaterThan(40)
    expect(half.end.gate).toBeLessThan(50)
    expect(simulateWedo([{ op: 'motor_direction', dir: 'that' }, { op: 'motor_on_for', seconds: 1 }], gate).end.gate).toBe(0)
  })

  it('stops "repeat forever" at the time limit', () => {
    const r = simulateWedo([{ op: 'repeat', times: 'forever', steps: [{ op: 'light', color: 'red' }, { op: 'light', color: 'blue' }] }], spinner)
    expect(r.end.t).toBeCloseTo(MAX_TIME, 5)
    expect(r.end.timedOut).toBe(true)
    expect(r.end.finished).toBe(false)
  })

  it('a motor left on keeps going after the program ends until something stops it', () => {
    const r = simulateWedo([{ op: 'motor_on' }], { ...rover, length: 1000 })
    expect(r.end.crashed).toBe(true)
    expect(r.end.t).toBeLessThan(MAX_TIME)
  })

  it('delivers scripted tilt and motion events on time', () => {
    const tilt: WedoScene = { model: 'spinner', ratio: 1, sensor: 'tilt' }
    const r = simulateWedo([{ op: 'wait_tilt', state: 'up' }, { op: 'light', color: 'green' }], tilt, { scenario: [{ at: 1.5, tilt: 'up' }] })
    const green = r.events.find((e) => e.kind === 'light')!
    expect(green.t).toBeCloseTo(1.5, 5)
    const g = simulateWedo([{ op: 'wait_motion', event: 'near' }, { op: 'motor_on_for', seconds: 1.5 }], gate, { scenario: [{ at: 2, motion: 'near' }] })
    expect(g.events.find((e) => e.kind === 'motor')!.t).toBeCloseTo(2, 5)
    expect(g.end.gate).toBe(90)
  })

  it('a shake is short, then the tilt sensor is flat again', () => {
    const tilt: WedoScene = { model: 'spinner', ratio: 1, sensor: 'tilt' }
    const r = simulateWedo([{ op: 'wait', seconds: 2 }], tilt, { scenario: [{ at: 0.5, tilt: 'shake' }] })
    expect(frameAt(r.trace, 0.6).tilt).toBe('shake')
    expect(frameAt(r.trace, 1.5).tilt).toBe('flat')
  })

  it('takes live sensor input in the step-by-step runner', () => {
    const runner = new WedoRunner([{ op: 'wait_motion', event: 'near' }, { op: 'sound', sound: 3 }], gate)
    for (let i = 0; i < 50; i++) runner.tick()
    expect(runner.events.some((e) => e.kind === 'sound')).toBe(false)
    runner.tick({ motion: 'near' })
    expect(runner.events.some((e) => e.kind === 'sound')).toBe(true)
  })

  it('reports outputs and the running block at a moment', () => {
    const r = simulateWedo([{ op: 'light', color: 'red' }, { op: 'wait', seconds: 1 }, { op: 'display', kind: 'text', value: 'HI' }], spinner)
    expect(outputsAt(r.events, 0.5)).toMatchObject({ light: 'red', display: null, step: '1' })
    expect(outputsAt(r.events, 2)).toMatchObject({ display: 'HI' })
  })
})

describe('WeDo checks', () => {
  it('a reaction must follow the sensor, not a timer', () => {
    const checks = [{ type: 'reactsTo' as const, sensor: 'motion' as const, state: 'near' as const, action: 'motorStart' as const, withinSeconds: 1, times: 1 }]
    const scenario = [{ at: 2, motion: 'near' as const }]
    const real = runWedoChecks([{ op: 'wait_motion', event: 'near' }, { op: 'motor_on_for', seconds: 1 }], gate, checks, 'ru', scenario)
    const timer = runWedoChecks([{ op: 'wait', seconds: 2 }, { op: 'motor_on_for', seconds: 1 }], gate, checks, 'ru', scenario)
    expect(real.ok).toBe(true)
    expect(timer.ok).toBe(false)
  })

  it('a sound played all the time is not a reaction', () => {
    const checks = [{ type: 'reactsTo' as const, sensor: 'motion' as const, state: 'near' as const, action: 'sound' as const, withinSeconds: 1, times: 1 }]
    const r = runWedoChecks([{ op: 'repeat', times: 'forever', steps: [{ op: 'sound', sound: 1 }] }], gate, checks, 'ru', [{ at: 2, motion: 'near' }])
    expect(r.ok).toBe(false)
  })

  it('zones, crash and blocks give kind messages in every language', () => {
    for (const lang of ['ru', 'kk', 'en'] as const) {
      const r = runWedoChecks([{ op: 'motor_on_for', seconds: 1 }], rover, [{ type: 'roverInZone', zone: 'flag' }, { type: 'maxBlocks', max: 3 }], lang)
      expect(r.results[0].ok).toBe(false)
      expect(r.results[0].message.length).toBeGreaterThan(5)
      expect(r.results[0].hint).toBeTruthy()
      expect(r.results[1].ok).toBe(true)
    }
    const ok = runWedoChecks([{ op: 'motor_on_for', seconds: 3 }], rover, [{ type: 'roverInZone', zone: 'flag' }], 'ru')
    expect(ok.ok).toBe(true)
  })
})
