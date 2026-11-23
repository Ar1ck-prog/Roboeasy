export const PORTS = ['A', 'B', 'C', 'D', 'E', 'F'] as const
export type Port = (typeof PORTS)[number]
export type Speeds = readonly number[]
export const STOPPED: Speeds = [0, 0, 0, 0, 0, 0]

export const ROLES = ['left', 'right', 'gripper', 'lift', 'extra1', 'extra2'] as const
export type Role = (typeof ROLES)[number]
export type Motor = { port: Port | ''; reversed: boolean }
export type Assignments = Record<Role, Motor>
export const INITIAL_MOTORS = Object.fromEntries(ROLES.map((role) => [role, { port: '', reversed: false }])) as Assignments
export const DRIVE_KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD']
export type Axes = { x: number; y: number }
export const CENTER: Axes = { x: 0, y: 0 }
const DEAD_ZONE = 0.12
const KEYBOARD_TURN = 0.1

export function keyboardAxes(keys: ReadonlySet<string>): Axes {
  return {
    x: (Number(keys.has('KeyD')) - Number(keys.has('KeyA'))) * KEYBOARD_TURN,
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

export function motorSpeeds(motors: Assignments, axes: Axes, held: Iterable<{ role: Role; direction: 1 | -1 }>): Speeds {
  const speeds = [...STOPPED]
  const set = ({ port, reversed }: Motor, speed: number) => {
    if (port) speeds[PORTS.indexOf(port)] = Math.round(100 * speed) * (reversed ? -1 : 1) || 0
  }
  if (motors.left.port && motors.right.port && motors.left.port !== motors.right.port) {
    // At full steering while moving, slow the inside wheel. With no throttle, turn in place.
    const { x, y } = axes
    const turn = x * (1 - Math.abs(y) / 2)
    const scale = Math.max(1, Math.abs(y + turn), Math.abs(y - turn))
    set(motors.left, (y + turn) / scale)
    set(motors.right, (y - turn) / scale)
  }
  const forward = new Set<Role>()
  const reverse = new Set<Role>()
  for (const { role, direction } of held) (direction === 1 ? forward : reverse).add(role)
  for (const role of ROLES.slice(2)) set(motors[role], Number(forward.has(role)) - Number(reverse.has(role)))
  return speeds
}
