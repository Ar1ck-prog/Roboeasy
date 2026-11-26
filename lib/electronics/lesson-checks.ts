/**
 * Checks of the "circuit" lesson steps: they watch the running simulation
 * frame by frame and keep a goal met once it has been reached (a warning
 * that breaks a goal, such as a burnt LED, holds it back for the whole run).
 */

import type { CircuitCheck } from '../learn/schema'
import { type CheckInput, createChecker } from './missions'

const ON = 0.5
const OFF = 0.1

/** One line of the goal list: a check kind with its numbers, or a mission's goal. */
export type GoalLabel = { key: CircuitCheck['type'] | 'missionGoal'; params: Record<string, string | number>; builtin?: boolean }

export interface CircuitChecker {
  labels: GoalLabel[]
  check: (input: CheckInput) => boolean[]
}

function edgeCounter() {
  let last: boolean | null = null
  let since = 0
  let changes = 0
  const periods: { on: boolean; ms: number }[] = []
  return {
    feed(on: boolean, t: number) {
      if (last === null) {
        last = on
        since = t
        return
      }
      if (on === last) return
      periods.push({ on: last, ms: t - since })
      last = on
      since = t
      changes++
    },
    get changes() {
      return changes
    },
    periods,
  }
}

const leds = (input: CheckInput, color?: string) => input.doc.parts.filter((p) => p.type === 'led' && (!color || p.props.color === color))
const anyLit = (input: CheckInput, color?: string) => leds(input, color).some((p) => (input.frame.leds[p.id] ?? 0) >= ON)

/** Numbers printed on complete lines of the serial monitor. */
function printedNumbers(serial: string): number[] {
  const lines = serial.split(/\r?\n/).slice(0, -1)
  return lines.flatMap((l) => (l.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number))
}

export function createCircuitChecker(checks: CircuitCheck[], missionGoals: (id: string) => number = () => 2): CircuitChecker {
  const labels: GoalLabel[] = []
  const parts: ((input: CheckInput) => boolean[])[] = []

  for (const c of checks) {
    switch (c.type) {
      case 'ledLit': {
        let lit = false
        labels.push({ key: c.type, params: { color: c.color ?? '' } })
        parts.push((i) => [(lit = lit || anyLit(i, c.color))])
        break
      }
      case 'ledMaxMa': {
        // Met once an LED has lit within the limit; taken back for the run if any LED goes over it.
        let over = false
        let seen = false
        labels.push({ key: c.type, params: { ma: c.ma } })
        parts.push((i) => {
          const lit = leds(i).filter((p) => (i.frame.leds[p.id] ?? 0) >= ON)
          if (lit.some((p) => (i.frame.ledMa[p.id] ?? 0) > c.ma) || i.frame.burned.length) over = true
          seen = seen || lit.length > 0
          return [seen && !over]
        })
        break
      }
      case 'noBurned': {
        let burned = false
        let seen = false
        labels.push({ key: c.type, params: {} })
        parts.push((i) => {
          if (i.frame.burned.length) burned = true
          seen = seen || anyLit(i)
          return [seen && !burned]
        })
        break
      }
      case 'blinks': {
        const e = edgeCounter()
        labels.push({ key: c.type, params: { min: c.min }, builtin: c.builtin })
        parts.push((i) => {
          e.feed(c.builtin ? i.frame.builtin >= ON : anyLit(i), i.frame.t)
          return [e.changes >= c.min]
        })
        break
      }
      case 'blinkPeriod': {
        const e = edgeCounter()
        labels.push({ key: c.type, params: { s: Math.round(c.ms / 100) / 10 }, builtin: c.builtin })
        parts.push((i) => {
          e.feed(c.builtin ? i.frame.builtin >= ON : anyLit(i), i.frame.t)
          const ok = e.periods.filter((p) => Math.abs(p.ms - c.ms) <= c.ms * 0.3)
          return [ok.some((p) => p.on) && ok.some((p) => !p.on)]
        })
        break
      }
      case 'buttonLed': {
        let worked = false
        labels.push({ key: 'buttonLed', params: { phase: 'press' } }, { key: 'buttonLed', params: { phase: 'release' } })
        const met = [false, false]
        parts.push((i) => {
          const pressed = i.doc.parts.some((p) => p.type === 'button' && p.props.pressed)
          const off = leds(i).every((p) => (i.frame.leds[p.id] ?? 0) < OFF)
          if (pressed && anyLit(i)) {
            worked = true
            met[0] = true
          }
          if (worked && !pressed && off) met[1] = true
          return [...met]
        })
        break
      }
      case 'ledLevels': {
        const levels = new Set<number>()
        labels.push({ key: c.type, params: { min: c.min } })
        parts.push((i) => {
          const led = leds(i)[0]
          if (led) levels.add(Math.round((i.frame.leds[led.id] ?? 0) * 5))
          return [levels.size >= c.min]
        })
        break
      }
      case 'serialLines': {
        const re = c.pattern ? new RegExp(c.pattern, 'iu') : null
        labels.push({ key: c.type, params: { min: c.min } })
        parts.push((i) => {
          const lines = i.serial.split(/\r?\n/).slice(0, -1)
          return [lines.filter((l) => l.trim() && (!re || re.test(l))).length >= c.min]
        })
        break
      }
      case 'serialNumbers': {
        labels.push({ key: c.type, params: { min: c.min, atLeast: c.atLeast ?? '' } })
        parts.push((i) => {
          const nums = printedNumbers(i.serial)
          return [new Set(nums).size >= c.min && (c.atLeast === undefined || nums.some((n) => n >= c.atLeast!))]
        })
        break
      }
      case 'fault': {
        let seen = false
        labels.push({ key: c.type, params: { code: c.code } })
        parts.push((i) => {
          if (i.frame.faults.some((f) => f.code === c.code)) seen = true
          return [seen]
        })
        break
      }
      case 'mission': {
        const n = missionGoals(c.id)
        for (let k = 0; k < n; k++) labels.push({ key: 'missionGoal', params: { id: c.id, index: k } })
        const checker = createChecker(c.id)
        parts.push((i) => checker(i))
        break
      }
    }
  }

  // Each check keeps its own state: met goals stay met unless a later problem takes them back.
  return { labels, check: (input) => parts.flatMap((p) => p(input)) }
}
