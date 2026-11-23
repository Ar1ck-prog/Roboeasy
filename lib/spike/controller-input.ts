export const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type Port = (typeof PORTS)[number]
export type Speeds = readonly number[]
export const STOPPED: Speeds = [0, 0, 0, 0, 0, 0]

export const ROLES = ['left', 'right', 'gripper', 'lift', 'extra1', 'extra2'] as const
export type Role = (typeof ROLES)[number]
export type Motor = { port: Port | ''; reversed: boolean }
export type Assignments = Record<Role, Motor>
// On a mirrored chassis the right motor must spin the opposite way for straight travel.
export const INITIAL_MOTORS = Object.fromEntries(ROLES.map((role) => [role, { port: '', reversed: role === 'right' }])) as Assignments
export const DRIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
export type Axes = { x: number; y: number }
export const CENTER: Axes = { x: 0, y: 0 }
export type DriveLimits = { drive: number; turn: number }
export const DEFAULT_DRIVE_LIMITS: DriveLimits = { drive: 50, turn: 20 }
const DEAD_ZONE = 0.12

export function keyboardAxes(keys: ReadonlySet<string>): Axes {
  return {
    x: Number(keys.has('KeyD')) - Number(keys.has('KeyA')),
    y: Number(keys.has('KeyW')) - Number(keys.has('KeyS')),
  }
}

export function joystickAxes(x: number, y: number) {
  const distance = Math.hypot(x, y)
  if (distance <= DEAD_ZONE) return { position: CENTER, drive: CENTER }
  const position = { x: x / Math.max(1, distance), y: y / Math.max(1, distance) }
  const strength = (Math.min(distance, 1) - DEAD_ZONE) / (1 - DEAD_ZONE)
  return { position, drive: { x: x * strength / distance, y: y * strength / distance } }
}

export function motorSpeeds(motors: Assignments, axes: Axes, limits: DriveLimits, held: Iterable<{ role: Role; direction: 1 | -1 }>): Speeds {
  const speeds = [...STOPPED]
  const set = ({ port, reversed }: Motor, speed: number) => {
    if (port) speeds[PORTS.indexOf(port)] = Math.round(speed) * (reversed ? -1 : 1) || 0
  }
  if (motors.left.port && motors.right.port && motors.left.port !== motors.right.port) {
    const drive = axes.y * limits.drive
    const turn = axes.x * limits.turn
    const left = drive + turn
    const right = drive - turn
    // Keep the steering ratio on a diagonal without exceeding the larger speed setting.
    const limit = Math.max(1, limits.drive, limits.turn)
    const scale = Math.max(1, Math.abs(left) / limit, Math.abs(right) / limit)
    set(motors.left, left / scale)
    set(motors.right, right / scale)
  }
  const forward = new Set<Role>()
  const reverse = new Set<Role>()
  for (const { role, direction } of held) (direction === 1 ? forward : reverse).add(role)
  for (const role of ROLES.slice(2)) set(motors[role], 100 * (Number(forward.has(role)) - Number(reverse.has(role))))
  return speeds
}
