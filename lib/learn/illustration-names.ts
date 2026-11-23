/**
 * Animated drawings of the robotics tracks (components/learn/robo-illustrations.tsx).
 * No zod here: the schema and the browser both import it.
 */
export const ROBO_ILLUSTRATIONS = [
  // Build
  'r-beams',
  'r-pins',
  'r-connectors',
  'r-wheels',
  'r-triangle',
  'r-double-beam',
  'r-break',
  'r-gears',
  'r-ratio',
  'r-worm',
  'r-chassis',
  'r-wheel-distance',
  // Blocks
  'r-loop',
  'r-forever',
  'r-until',
  'r-dance',
  'r-if',
  'r-if-else',
  'r-wait-until',
  'r-variable',
  'r-counter',
  'r-myblock',
  // Sensors
  'r-color',
  'r-reflection',
  'r-distance',
  'r-force',
  'r-gyro',
  'r-tilt',
  'r-line',
  'r-crossing',
  // Navigation
  'r-slip',
  'r-scatter',
  'r-calibrate',
  'r-p-control',
  'r-pid',
  'r-coordinates',
  // Python
  'r-python',
  'r-await',
  'r-indent',
  // Mechanisms
  'r-gripper',
  'r-lift',
  'r-lever',
  'r-pusher',
  'r-swap',
  // FLL
  'r-fll-parts',
  'r-fll-table',
  'r-strategy',
  'r-team',
  'r-notebook',
  'r-judging',
  // Autonomous robots
  'r-maze',
  'r-search',
  'r-rescue',
  'r-sort',
  'r-state',
  'r-mars',
] as const
export type RoboIllustration = (typeof ROBO_ILLUSTRATIONS)[number]
