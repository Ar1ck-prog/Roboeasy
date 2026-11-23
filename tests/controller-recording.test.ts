import { describe, expect, it } from 'vitest'

import { STOPPED } from '../lib/spike/controller-input'
import { addFrame, finishTake, MAX_TAKE_MS, speedsAt, type Frame } from '../lib/spike/controller-recording'

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
    const take = finishTake(frames, 2500)!
    expect(take.frames.map((f) => f.t)).toEqual([0, 1000, 1500])
    expect(take.duration).toBe(1500)
  })

  it('stops a take that ended while still moving', () => {
    const take = finishTake(record([0, fwd]), 800)!
    expect(take.duration).toBe(800)
    expect(take.frames.at(-1)!.speeds).toEqual(STOPPED)
  })

  it('keeps nothing when the robot never moved', () => {
    expect(finishTake(record([0, [...STOPPED]]), 3000)).toBeNull()
  })

  it('replays forwards as recorded', () => {
    const take = finishTake(record([0, fwd], [1000, turn], [1500, [...STOPPED]]), 1500)!
    expect(speedsAt(take, 0)).toEqual(fwd)
    expect(speedsAt(take, 999)).toEqual(fwd)
    expect(speedsAt(take, 1000)).toEqual(turn)
    expect(speedsAt(take, 1500)).toEqual(STOPPED)
  })

  it('replays backwards: last move first, every speed reversed', () => {
    const take = finishTake(record([0, fwd], [1000, turn], [1500, [...STOPPED]]), 1500)!
    expect(speedsAt(take, 0, true)).toEqual([-20, -20, 0, 0, 0, 0])
    expect(speedsAt(take, 499, true)).toEqual([-20, -20, 0, 0, 0, 0])
    expect(speedsAt(take, 500, true)).toEqual([-50, 50, 0, 0, 0, 0])
    expect(speedsAt(take, 1500, true)).toEqual(STOPPED)
  })

  it('never records past the limit', () => {
    const take = finishTake(record([0, fwd]), MAX_TAKE_MS * 2)!
    expect(take.duration).toBe(MAX_TAKE_MS)
  })
})
