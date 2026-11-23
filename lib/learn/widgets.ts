/**
 * The maths behind the robotics widgets (components/learn/steps/robo-widgets.tsx):
 * pure functions, so tests can prove every task is solvable and not trivial.
 * Simple teaching models, not exact physics.
 */

// ── Gears ───────────────────────────────────────────────────────────────

/** Gear sizes (teeth) offered in the widget. */
export const GEAR_TEETH = [8, 12, 16, 20, 24, 36, 40] as const

/** How many times slower the driven gear turns (below 1: faster). */
export function gearRatio(driver: number, driven: number): number {
  return driven / driver
}

export function gearsSolved(goal: 'slower' | 'faster', ratio: number, driver: number, driven: number): boolean {
  const r = gearRatio(driver, driven)
  return Math.abs((goal === 'slower' ? r : 1 / r) - ratio) < 0.01
}

// ── Wheel and distance ──────────────────────────────────────────────────

/** Wheel diameters in mm. */
export const WHEELS = [56, 88] as const

/** Distance in cm for a wheel of `diameterMm` turning `rotations` times. */
export function wheelDistanceCm(diameterMm: number, rotations: number): number {
  return (Math.PI * diameterMm * rotations) / 10
}

export function wheelSolved(targetCm: number, toleranceCm: number, diameterMm: number, rotations: number): boolean {
  return Math.abs(wheelDistanceCm(diameterMm, rotations) - targetCm) <= toleranceCm
}

// ── Regulators (line following / driving straight) ─────────────────────

export type RegulatorMode = 'onoff' | 'p' | 'pd' | 'pid'
export interface Gains {
  /** On/off: steering strength 0–100 %. P/PD/PID: proportional gain. */
  kp: number
  kd: number
  ki: number
}
export interface RegulatorRun {
  /** Offset from the line, mm, every 50 ms. */
  path: number[]
  dt: number
  overshoot: number
  /** First time after which the offset stays within the band; null = never. */
  settle: number | null
  finalError: number
  /** Largest swing during the last 2 s. */
  wobble: number
}

export const REGULATOR = {
  speedMmS: 200,
  startOffsetMm: 60,
  seconds: 8,
  /** The steering follows the command with this lag (motors and sensor are not instant). */
  lagS: 0.25,
  maxSteerDeg: 60,
  /** One wheel slightly weaker: a constant pull to one side (PID task only). */
  driftDeg: 15,
  bandMm: 3,
} as const

/** Ranges of the sliders. */
export const GAIN_RANGES = { kp: [0, 3, 0.05], kd: [0, 1.5, 0.05], ki: [0, 2, 0.05], strength: [5, 100, 5] } as const

export function runRegulator(mode: RegulatorMode, g: Gains): RegulatorRun {
  const R = REGULATOR
  const dt = 0.05
  const sub = 10
  const h = dt / sub
  const drift = mode === 'pid' ? R.driftDeg : 0
  let y = R.startOffsetMm
  let theta = 0
  let integral = 0
  let prevErr = -y
  const path = [y]
  for (let i = 0; i < R.seconds / dt; i++) {
    const e = -y
    integral = Math.max(-200, Math.min(200, integral + e * dt))
    const de = (e - prevErr) / dt
    prevErr = e
    let target: number
    if (mode === 'onoff') target = (Math.sign(e) || 1) * (g.kp / 100) * R.maxSteerDeg
    else target = g.kp * e + (mode === 'pd' || mode === 'pid' ? g.kd * de : 0) + (mode === 'pid' ? g.ki * integral : 0)
    target = Math.max(-R.maxSteerDeg, Math.min(R.maxSteerDeg, target))
    for (let k = 0; k < sub; k++) {
      theta += ((target - theta) / R.lagS) * h
      y += R.speedMmS * Math.sin(((theta + drift) * Math.PI) / 180) * h
    }
    path.push(y)
  }
  const overshoot = Math.max(0, ...path.map((v) => -v))
  let settle: number | null = null
  for (let i = path.length - 1; i >= 0; i--) {
    if (Math.abs(path[i]) > R.bandMm) {
      settle = i === path.length - 1 ? null : (i + 1) * dt
      break
    }
    if (i === 0) settle = 0
  }
  const tail = path.slice(-Math.round(2 / dt))
  return { path, dt, overshoot, settle, finalError: Math.abs(path[path.length - 1]), wobble: Math.max(...tail) - Math.min(...tail) }
}

/** What each task asks for (shown to the learner as goals). */
export const REGULATOR_GOALS: Record<RegulatorMode, { settle: number; overshoot: number; wobble?: number }> = {
  /** On/off can only wobble: get to the line and keep the zigzag small. */
  onoff: { settle: Infinity, overshoot: Infinity, wobble: 10 },
  p: { settle: 3, overshoot: 8 },
  pd: { settle: 1.3, overshoot: 2 },
  pid: { settle: 4, overshoot: 12 },
}

/** On/off must reach the line (closer than 10 mm) this fast. */
export const ONOFF_REACH_S = 2.5

export function regulatorSolved(mode: RegulatorMode, run: RegulatorRun): boolean {
  const goal = REGULATOR_GOALS[mode]
  if (mode === 'onoff') {
    const reached = run.path.findIndex((v) => Math.abs(v) < 10)
    return reached >= 0 && reached * run.dt <= ONOFF_REACH_S && run.wobble <= (goal.wobble ?? Infinity)
  }
  return run.settle !== null && run.settle <= goal.settle && run.overshoot <= goal.overshoot
}

// ── Repeatability ───────────────────────────────────────────────────────

/** Fixed "random" errors of the five runs (standard normal values), so the widget is the same every time. */
const NOISE: [number, number][] = [
  [0.4, -0.9],
  [-1.2, 0.5],
  [0.9, 1.3],
  [-0.3, -1.6],
  [1.5, 0.2],
]

/** Where each of five runs stops, cm: x along the drive, y sideways. */
export function scatterRuns(distanceCm: number, speed: number, gyro: boolean): { x: number; y: number }[] {
  const distSigma = 0.003 + speed * 0.0003
  const headSigma = (gyro ? 0.25 : 0.6 + speed * 0.02) * (Math.PI / 180)
  return NOISE.map(([a, b]) => {
    const d = distanceCm * (1 + a * distSigma)
    const th = b * headSigma
    return { x: d * Math.cos(th), y: d * Math.sin(th) }
  })
}

export const SCATTER_TARGET_CM = 2.5

export function scatterSolved(distanceCm: number, speed: number, gyro: boolean): boolean {
  return scatterRuns(distanceCm, speed, gyro).every((p) => Math.hypot(p.x - distanceCm, p.y) <= SCATTER_TARGET_CM)
}

// ── Strategy ────────────────────────────────────────────────────────────

export function strategyTotals(missions: { points: number; seconds: number }[], picked: number[]) {
  return picked.reduce((t, i) => ({ points: t.points + missions[i].points, seconds: t.seconds + missions[i].seconds }), { points: 0, seconds: 0 })
}

export function strategySolved(missions: { points: number; seconds: number }[], picked: number[], seconds: number, target: number): boolean {
  const t = strategyTotals(missions, picked)
  return t.seconds <= seconds && t.points >= target
}

// ── Lever ───────────────────────────────────────────────────────────────

/** A beam of 10 hole spaces: load at hole 0, motor at hole 10, fulcrum at 1–9. */
export const LEVER = { length: 10, load: 3, motor: 1, minLift: 2 } as const

/** Can the motor lift the load, and how high (in relative units)? */
export function leverState(fulcrum: number): { lifts: boolean; height: number } {
  const L = LEVER
  return { lifts: L.load * fulcrum <= L.motor * (L.length - fulcrum), height: fulcrum }
}

export function leverSolved(fulcrum: number): boolean {
  const s = leverState(fulcrum)
  return s.lifts && s.height >= LEVER.minLift
}

// ── Bracing ─────────────────────────────────────────────────────────────

export type Brace = 'diag1' | 'diag2' | 'middle'

/** A square frame stops wobbling once a diagonal makes triangles. */
export function braceSolved(braces: Brace[]): boolean {
  return braces.includes('diag1') || braces.includes('diag2')
}

// ── Search pattern ("lawnmower") ────────────────────────────────────────

/** Lane spacing offered by the slider, cm. */
export const SWEEP_SPACING = [5, 40, 5] as const

/** A zigzag search over an area: how many lanes, how much of the area the sensor sees, path length. */
export function sweepPlan(areaW: number, areaH: number, spacing: number, sensorCm: number): { lanes: number; coverage: number; pathCm: number } {
  const lanes = Math.max(1, Math.ceil(areaH / spacing))
  const coverage = Math.min(1, (lanes * Math.min(sensorCm, spacing)) / areaH, sensorCm / spacing)
  return { lanes, coverage, pathCm: lanes * areaW + (lanes - 1) * spacing }
}

/** Solved: the whole area is seen and no lane is wasted (spacing equals the sensor width). */
export function sweepSolved(spacing: number, sensorCm: number): boolean {
  return spacing <= sensorCm && spacing > sensorCm - SWEEP_SPACING[2]
}
