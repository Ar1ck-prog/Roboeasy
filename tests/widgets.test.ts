import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { readLesson } from '../lib/learn/content'
import {
  GAIN_RANGES,
  GEAR_TEETH,
  LEVER,
  type RegulatorMode,
  WHEELS,
  braceSolved,
  gearsSolved,
  leverSolved,
  regulatorSolved,
  runRegulator,
  scatterSolved,
  strategySolved,
  SWEEP_SPACING,
  sweepPlan,
  sweepSolved,
  wheelSolved,
} from '../lib/learn/widgets'

const range = ([a, b, s]: readonly [number, number, number]) => {
  const out: number[] = []
  for (let v = a; v <= b + 1e-9; v += s) out.push(Math.round(v * 100) / 100)
  return out
}

/** Every combination of the regulator sliders a learner can set. */
function regulatorGrid(mode: RegulatorMode) {
  const kps = mode === 'onoff' ? range(GAIN_RANGES.strength) : range(GAIN_RANGES.kp)
  const kds = mode === 'pd' || mode === 'pid' ? range(GAIN_RANGES.kd) : [0]
  const kis = mode === 'pid' ? range(GAIN_RANGES.ki) : [0]
  return kps.flatMap((kp) => kds.flatMap((kd) => kis.map((ki) => ({ kp, kd, ki }))))
}

describe('widget maths', () => {
  it('regulators: every task is solvable, but not by every setting', () => {
    for (const mode of ['onoff', 'p', 'pd', 'pid'] as const) {
      const grid = regulatorGrid(mode)
      const solved = grid.filter((g) => regulatorSolved(mode, runRegulator(mode, g))).length
      expect(solved, mode).toBeGreaterThan(0)
      expect(solved, mode).toBeLessThan(grid.length * 0.6)
    }
  })

  it('PD really needs D and PID really needs I', () => {
    const pOnly = range(GAIN_RANGES.kp).filter((kp) => regulatorSolved('pd', runRegulator('pd', { kp, kd: 0, ki: 0 }))).length
    expect(pOnly).toBeLessThanOrEqual(1)
    const noI = regulatorGrid('pd').filter((g) => regulatorSolved('pid', runRegulator('pid', { ...g, ki: 0 }))).length
    expect(noI).toBe(0)
  })

  it('starting slider values do not solve the regulator tasks', () => {
    expect(regulatorSolved('onoff', runRegulator('onoff', { kp: 90, kd: 0, ki: 0 }))).toBe(false)
    for (const mode of ['p', 'pd', 'pid'] as const) expect(regulatorSolved(mode, runRegulator(mode, { kp: 0.2, kd: 0, ki: 0 })), mode).toBe(false)
  })

  it('lever: only a fulcrum that lifts and still lifts high enough works', () => {
    const ok = Array.from({ length: LEVER.length - 1 }, (_, i) => i + 1).filter(leverSolved)
    expect(ok).toEqual([2])
    expect(leverSolved(5)).toBe(false)
  })

  it('brace: a diagonal is needed', () => {
    expect(braceSolved([])).toBe(false)
    expect(braceSolved(['middle'])).toBe(false)
    expect(braceSolved(['diag2'])).toBe(true)
  })
})

const DIR = path.join(__dirname, '..', 'content', 'learn', 'lessons')
const widgetSteps = fs
  .readdirSync(DIR)
  .flatMap((f) => readLesson(f.replace('.json', ''))!.steps.map((s) => ({ lesson: f, step: s })))
  .filter(({ step }) => step.type === 'widget')

describe.each(widgetSteps.map(({ lesson, step }) => [`${lesson} ${step.id}`, step] as const))('widget %s', (_, step) => {
  it('can be solved and is not solved at the start', () => {
    if (step.type !== 'widget') return
    switch (step.widget) {
      case 'gears': {
        const pairs = GEAR_TEETH.flatMap((a) => GEAR_TEETH.map((b) => [a, b] as const))
        expect(pairs.some(([a, b]) => gearsSolved(step.goal, step.ratio, a, b))).toBe(true)
        expect(gearsSolved(step.goal, step.ratio, GEAR_TEETH[2], GEAR_TEETH[2])).toBe(false)
        break
      }
      case 'wheel': {
        const rots = range([0, 10, 0.05])
        expect(WHEELS.some((d) => rots.some((r) => wheelSolved(step.targetCm, step.toleranceCm, d, r)))).toBe(true)
        expect(wheelSolved(step.targetCm, step.toleranceCm, WHEELS[0], 1)).toBe(false)
        break
      }
      case 'scatter': {
        const options = range([20, 100, 10]).flatMap((speed) => [true, false].map((gyro) => scatterSolved(step.distanceCm, speed, gyro)))
        expect(options.some(Boolean)).toBe(true)
        expect(scatterSolved(step.distanceCm, 80, false)).toBe(false)
        break
      }
      case 'strategy': {
        const n = step.missions.length
        const subsets = Array.from({ length: 2 ** n }, (_, mask) => step.missions.map((_, i) => i).filter((i) => mask & (1 << i)))
        expect(subsets.some((p) => strategySolved(step.missions, p, step.seconds, step.target))).toBe(true)
        expect(strategySolved(step.missions, step.missions.map((_, i) => i), step.seconds, step.target)).toBe(false)
        break
      }
      case 'sweep': {
        const spacings = range(SWEEP_SPACING)
        expect(spacings.filter((sp) => sweepSolved(sp, step.sensorCm))).toEqual([step.sensorCm])
        expect(sweepSolved(30, step.sensorCm)).toBe(false)
        expect(sweepPlan(100, 60, step.sensorCm * 2, step.sensorCm).coverage).toBeLessThan(1)
        expect(sweepPlan(100, 60, step.sensorCm, step.sensorCm).coverage).toBe(1)
        break
      }
      default:
        break
    }
  })
})
