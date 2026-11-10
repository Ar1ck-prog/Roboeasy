/** Skills taught by the course (docs/curriculum.md). No zod here: the browser imports it. */

export const SKILLS = [
  'robot-basics',
  'sequence',
  'motion',
  'turns',
  'loops',
  'conditions',
  'variables',
  'functions',
  'sensor-color',
  'sensor-distance',
  'sensor-force',
  'gyro',
  'line-follow',
  'control',
  'calibration',
  'parts',
  'structures',
  'gears',
  'mechanisms',
  'python',
  'strategy',
  'teamwork',
  'ai-literacy',
] as const
export type Skill = (typeof SKILLS)[number]
