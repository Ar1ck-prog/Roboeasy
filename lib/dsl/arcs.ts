/**
 * Geometry of curved driving. The AI only says "arc, radius, angle"; every
 * number the robot gets is computed here from the wheel track:
 * v_in / v_out = (R - B/2) / (R + B/2), where R is the radius of the path of
 * the robot's middle and B is the distance between the wheels.
 */

import type { RobotProfile } from './types'

export interface ArcPlan {
  /** Inner wheel speed as a fraction of the outer wheel, exact. Negative: the inner wheel runs backwards. */
  ratio: number
  /** Distance of the outer wheel at that ratio, cm (Python uses exact wheel speeds). */
  outerCm: number
  /** SPIKE steering for word blocks, signed: positive turns right. Blocks only take whole numbers. */
  steering: number
  /** Distance of the outer wheel at that whole-number steering, so that a circle still closes. */
  steeringOuterCm: number
}

const round = (n: number, decimals: number) => Math.round(n * 10 ** decimals) / 10 ** decimals

export function arcPlan(direction: 'left' | 'right', radiusCm: number, degrees: number, robot: RobotProfile): ArcPlan {
  const track = robot.trackWidthMm / 10
  const radius = Math.max(0, radiusCm)
  const ratio = (radius - track / 2) / (radius + track / 2)
  const magnitude = Math.max(1, Math.min(100, Math.round(50 * (1 - ratio))))
  const turned = (degrees * Math.PI) / 180
  return {
    ratio: round(ratio, 3),
    outerCm: round(turned * (radius + track / 2), 2),
    steering: direction === 'right' ? magnitude : -magnitude,
    steeringOuterCm: round((turned * track * 50) / magnitude, 2),
  }
}

/** Different left and right speeds (%) as the steering and speed of a SPIKE word block. Positive steering: left wheel is the outer one. */
export function tankAsSteering(left: number, right: number): { steering: number; speed: number } {
  // On a tie the wheel going forward is the outer one, so the speed stays positive.
  const leftOuter = Math.abs(left) > Math.abs(right) || (Math.abs(left) === Math.abs(right) && left >= right)
  const outer = leftOuter ? left : right
  const inner = leftOuter ? right : left
  const magnitude = outer === 0 ? 0 : Math.round(50 * (1 - inner / outer))
  return { steering: leftOuter ? magnitude : -magnitude, speed: outer }
}
