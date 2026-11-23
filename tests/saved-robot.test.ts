import { afterEach, describe, expect, it } from 'vitest'

import { DEFAULT_ROBOT } from '../lib/dsl/types'
import { savedRobot } from '../lib/saved-robot'

const store = new Map<string, string>()
;(globalThis as { localStorage?: unknown }).localStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => store.set(k, v),
}

describe('saved robot for real-hub programs', () => {
  afterEach(() => store.clear())

  it('uses the studio profile, so motors on C and D drive too', () => {
    store.set('roboeasy.robot', JSON.stringify({ version: 2, profile: { ...DEFAULT_ROBOT, leftMotor: 'C', rightMotor: 'D', wheelDiameterMm: 88 } }))
    expect(savedRobot()).toMatchObject({ leftMotor: 'C', rightMotor: 'D', wheelDiameterMm: 88 })
  })

  it('falls back to the defaults on missing or broken data', () => {
    expect(savedRobot()).toEqual(DEFAULT_ROBOT)
    store.set('roboeasy.robot', '{nonsense')
    expect(savedRobot()).toEqual(DEFAULT_ROBOT)
    store.set('roboeasy.robot', JSON.stringify({ version: 2, profile: { leftMotor: 'Z', rightMotor: 'Z', wheelDiameterMm: -5 } }))
    expect(savedRobot()).toMatchObject({ leftMotor: 'A', rightMotor: 'B', wheelDiameterMm: 56 })
  })
})
