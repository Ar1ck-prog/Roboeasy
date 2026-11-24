import { describe, expect, it } from 'vitest'

import { STOPPED } from '../lib/spike/controller-input'
import { addFrame, finishTake, recordedPorts, routeToPython, type Frame } from '../lib/spike/controller-recording'

const fwd = [50, -50, 0, 0, 0, 0]
const turn = [20, 20, 0, 0, 0, 0]

function record(...changes: [number, number[]][]) {
  const frames: Frame[] = []
  for (const [t, s] of changes) addFrame(frames, t, s)
  return frames
}

describe('controller recording', () => {
  it('drops repeated speeds and cuts the idle start', () => {
    const frames = record([0, [...STOPPED]], [400, fwd], [500, fwd], [1400, turn], [1900, [...STOPPED]])
    expect(frames).toHaveLength(4)
    const take = finishTake(frames)!
    expect(take.frames.map((f) => f.t)).toEqual([0, 1000, 1500])
    expect(take.duration).toBe(1500)
  })

  it('does not export a take without a confirmed final stop', () => {
    expect(finishTake(record([0, fwd]))).toBeNull()
  })

  it('keeps nothing when the robot never moved', () => {
    expect(finishTake(record([0, [...STOPPED]]))).toBeNull()
  })

  it('exports signed velocities, pauses, concurrent motors and the full time to the final acknowledgement', () => {
    const withAttachment = [20, 20, 0, -100, 0, 0]
    const take = finishTake(record(
      [0, [...STOPPED]], [200, fwd], [275, fwd], [700, [...STOPPED]], [1020, turn],
      [1100, withAttachment], [1300, [...STOPPED]],
    ))!
    expect(take.duration).toBe(1100)
    expect(recordedPorts(take)).toEqual(['A', 'B', 'D'])
    const code = routeToPython(take)
    const body = code.split('async def main():\n    try:\n')[1].split('    finally:')[0].trimEnd()
    expect(body.split('\n')).toEqual([
      '        drive(port.A, 250)',
      '        drive(port.B, -250)',
      '        await runloop.sleep_ms(500)',
      '        motor.stop(port.A)',
      '        motor.stop(port.B)',
      '        await runloop.sleep_ms(320)',
      '        drive(port.A, 100)',
      '        drive(port.B, 100)',
      '        await runloop.sleep_ms(80)',
      '        drive(port.D, -500)',
      '        await runloop.sleep_ms(200)',
      '        motor.stop(port.A)',
      '        motor.stop(port.B)',
      '        motor.stop(port.D)',
    ])
    expect(code).toContain('runloop.run(main())')
  })
})
