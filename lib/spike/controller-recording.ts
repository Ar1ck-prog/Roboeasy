import { PORTS, STOPPED, type Port, type Speeds } from './controller-input'
import { ACCELERATION, MAX_VELOCITY } from './controller-program'

export type Frame = { t: number; speeds: Speeds }
export type Take = { frames: Frame[]; duration: number }

/** The controller requests a final neutral frame when this time elapses. */
export const MAX_TAKE_MS = 60_000

const same = (a: Speeds, b: Speeds) => a.length === b.length && a.every((v, i) => v === b[i])

/** Adds a change at `t` ms; repeats of the same speeds are dropped. */
export function addFrame(frames: Frame[], t: number, speeds: Speeds) {
  const last = frames.at(-1)
  if (last && same(last.speeds, speeds)) return
  const at = Math.max(0, Math.round(t))
  if (last && last.t === at) last.speeds = [...speeds]
  else frames.push({ t: at, speeds: [...speeds] })
}

/** Only export a complete route from its first movement to its last confirmed stop. */
export function finishTake(frames: Frame[]): Take | null {
  const first = frames.findIndex((frame) => frame.speeds.some(Boolean))
  const last = frames.at(-1)
  if (first === -1 || !last || last.speeds.some(Boolean)) return null
  const start = frames[first].t
  if (last.t <= start) return null
  return { frames: frames.slice(first).map(({ t, speeds }) => ({ t: t - start, speeds })), duration: last.t - start }
}

export function recordedPorts(take: Take): Port[] {
  return PORTS.filter((_, index) => take.frames.some(({ speeds }) => speeds[index]))
}

/** SPIKE App 3 and FLL both provide motor.run, motor.stop and runloop.sleep_ms. */
export function routeToPython(take: Take): string {
  const lines = [
    'from hub import port', 'import motor', 'import runloop', '',
    'def drive(p, velocity):',
    '    try:',
    `        motor.run(p, velocity, acceleration=${ACCELERATION})`,
    '    except TypeError:',
    '        motor.run(p, velocity)',
    '', 'async def main():', '    try:',
  ]
  let previous: Frame = { t: 0, speeds: STOPPED }
  for (const frame of take.frames) {
    const ms = frame.t - previous.t
    if (ms > 0) lines.push(`        await runloop.sleep_ms(${ms})`)
    PORTS.forEach((port, index) => {
      const speed = frame.speeds[index]
      if (speed === previous.speeds[index]) return
      lines.push(speed ? `        drive(port.${port}, ${speed * MAX_VELOCITY / 100})` : `        motor.stop(port.${port})`)
    })
    previous = frame
  }
  lines.push('    finally:')
  for (const port of recordedPorts(take)) {
    lines.push('        try:', `            motor.stop(port.${port})`, '        except Exception:', '            pass')
  }
  return [...lines, '', 'runloop.run(main())', ''].join('\n')
}
