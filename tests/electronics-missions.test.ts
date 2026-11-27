import { describe, expect, it } from 'vitest'

import type { CircuitDoc, PartProps } from '@/lib/electronics/board'
import { MISSION_IDS, type MissionId, createChecker, getMission } from '@/lib/electronics/missions'
import { Simulation } from '@/lib/electronics/sim'

/** What the learner does on the bench during the run: at time t (ms), set props of a part. */
type Action = { t: number; part: string; props: PartProps }

const ACTIONS: Partial<Record<MissionId, Action[]>> = {
  alarm: [
    { t: 300, part: 'm1', props: { motion: true } },
    { t: 900, part: 'm1', props: { motion: false } },
  ],
  thermo: [{ t: 1200, part: 't1', props: { temp: 31 } }],
  button: [
    { t: 300, part: 'b1', props: { pressed: true } },
    { t: 700, part: 'b1', props: { pressed: false } },
  ],
  dimmer: [0, 0.2, 0.4, 0.6, 0.8, 1].map((pos, i) => ({ t: 200 + i * 200, part: 'p1', props: { pos } })),
  radar: [
    { t: 100, part: 'u1', props: { distance: 12 } },
    { t: 1200, part: 'u1', props: { distance: 55 } },
  ],
  night: [
    { t: 200, part: 'q1', props: { light: 0.1 } },
    { t: 800, part: 'q1', props: { light: 0.9 } },
  ],
}

const DURATION: Partial<Record<MissionId, number>> = { blink: 6000, traffic: 17000, servo: 4000, melody: 3000, radar: 2400, rgb: 3000, thermo: 2500 }

function play(id: MissionId, which: 'solution' | 'starter') {
  const mission = getMission(id)
  let doc: CircuitDoc = structuredClone(mission[which].doc)
  const sim = new Simulation(mission[which].code, doc)
  const check = createChecker(id)
  const actions = [...(ACTIONS[id] ?? [])]
  let goals: boolean[] = []
  for (let t = 0; t < (DURATION[id] ?? 2000); t += 20) {
    while (actions.length && actions[0].t <= t) {
      const a = actions.shift()!
      doc = { ...doc, parts: doc.parts.map((p) => (p.id === a.part ? { ...p, props: { ...p.props, ...a.props } } : p)) }
      sim.board.setDoc(doc)
    }
    const frame = sim.step(20)
    goals = check({ frame, doc, serial: sim.board.serialOut })
  }
  return { goals, sim }
}

describe('lab missions', () => {
  for (const id of MISSION_IDS) {
    it(`${id}: the reference solution meets every goal`, () => {
      const { goals, sim } = play(id, 'solution')
      expect(sim.status.kind).toBe('running')
      expect(goals.length).toBeGreaterThan(0)
      expect(goals).toEqual(goals.map(() => true))
    })

    it(`${id}: the empty starter meets none`, () => {
      const { goals } = play(id, 'starter')
      expect(goals.some(Boolean)).toBe(false)
    })
  }
})
