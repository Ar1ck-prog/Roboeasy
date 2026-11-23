/**
 * The robot profile saved by the studio (lib/studio-state.ts), read without zod so lesson and
 * draw pages stay light. Programs sent to a real hub use these motor ports and calibration:
 * with the defaults only robots driving on A and B would move.
 */

import { DEFAULT_ROBOT, PORTS, type Port, type RobotProfile } from './dsl/types'

const KEY = 'roboeasy.robot'
const isPort = (v: unknown): v is Port => typeof v === 'string' && (PORTS as readonly string[]).includes(v)
const positive = (v: unknown, fallback: number, max: number) => (typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= max ? v : fallback)

export function savedRobot(): RobotProfile {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { version?: number; profile?: Partial<RobotProfile> } | null
    const p = saved?.version === 2 ? saved.profile : null
    if (!p || typeof p !== 'object') return DEFAULT_ROBOT
    const left = isPort(p.leftMotor) ? p.leftMotor : DEFAULT_ROBOT.leftMotor
    const right = isPort(p.rightMotor) && p.rightMotor !== left ? p.rightMotor : left === DEFAULT_ROBOT.rightMotor ? DEFAULT_ROBOT.leftMotor : DEFAULT_ROBOT.rightMotor
    return {
      ...DEFAULT_ROBOT,
      leftMotor: left,
      rightMotor: right,
      distanceSensor: isPort(p.distanceSensor) ? p.distanceSensor : DEFAULT_ROBOT.distanceSensor,
      colorSensor: isPort(p.colorSensor) ? p.colorSensor : DEFAULT_ROBOT.colorSensor,
      forceSensor: isPort(p.forceSensor) ? p.forceSensor : DEFAULT_ROBOT.forceSensor,
      wheelDiameterMm: positive(p.wheelDiameterMm, DEFAULT_ROBOT.wheelDiameterMm, 200),
      trackWidthMm: positive(p.trackWidthMm, DEFAULT_ROBOT.trackWidthMm, 400),
      distanceFactor: positive(p.distanceFactor, 1, 3),
      turnFactor: positive(p.turnFactor, 1, 3),
    }
  } catch {
    return DEFAULT_ROBOT
  }
}

/** Saves new drive ports into the studio's profile (other settings stay as they are). */
export function saveDrivePorts(leftMotor: Port, rightMotor: Port): RobotProfile {
  const next = { ...savedRobot(), leftMotor, rightMotor }
  try {
    // Keep everything else the studio stored (attachments and all), only the two ports change.
    const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { version?: number; profile?: Record<string, unknown> } | null
    const base = saved?.version === 2 && saved.profile && typeof saved.profile === 'object' ? saved.profile : DEFAULT_ROBOT
    localStorage.setItem(KEY, JSON.stringify({ version: 2, profile: { ...base, leftMotor, rightMotor } }))
  } catch {}
  return next
}
