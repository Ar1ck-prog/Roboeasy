/**
 * XP and coins, computed from the event log like everything else.
 *
 * Earning: lessons, first-try answers, review, challenges, real robots,
 * achievements, days with the daily goal met, daily quests (and the chest
 * for all three) and practice games. Spending: `purchase` events in the
 * garage. Upgrades bought earlier boost what is earned later:
 *
 * - motor: more coins, processor: more XP (lessons, review, challenges, games);
 * - magnet: daily quest coins ×2;
 * - battery: more streak freezes (see streakInfo).
 *
 * The garage checks the balance before a purchase is recorded. Once bought,
 * an item stays bought: if a later change lowers past earnings (a new daily
 * goal or time zone re-counts old days), the shortfall becomes a debt that
 * new coins pay off first (`balance` below zero, `coins` shows 0).
 */

import { CHEST, QUEST_XP, questStatus } from './quests'
import { BUFFS, type UpgradeLine, canBuyTier, itemByKey, itemKey, priceOf } from './shop'
import type { GameId, LearnEvent, LearnState } from './state'
import { DEFAULT_GOAL, MAX_FREEZES, dayKeyer, goalProgress } from './streak'
import { xpForEvent } from './xp'

export const COIN_RULES = {
  /** Welcome coins: enough for a first look in the garage. */
  start: 50,
  lesson: 10,
  project: 15,
  firstTry: 1,
  review: 6,
  realRobot: 10,
  challenge: 30,
  achievement: 15,
  goalDay: 5,
} as const

export const GAME_RULES = {
  /** Levels (maze, puzzle): the first clear and each new star. */
  levelClear: 8,
  star: 4,
  starXp: 2,
  /** Rounds (memory, blitz) that pay per game and day. */
  paidRounds: 3,
  blitzCoinsMax: 15,
  blitzXpMax: 10,
} as const

export type CreditSource = 'start' | 'lesson' | 'step' | 'review' | 'robot' | 'challenge' | 'achievement' | 'goal' | 'quest' | 'chest' | 'game'

interface Credit {
  at: number
  coins: number
  xp: number
  source: CreditSource
  /** Motor and processor apply. */
  boost: boolean
}

interface Owned {
  key: string
  at: number
  line?: UpgradeLine
  tier?: number
}

export interface Ledger {
  xp: number
  /** What can be spent now (never below zero). */
  coins: number
  /** Earned minus spent; below zero is a debt (see the note at the top). */
  balance: number
  earned: number
  spent: number
  /** Bought item keys (`hat:cap`, `upgrade:motor-1`). */
  owned: Set<string>
  tiers: Record<UpgradeLine, number>
  maxFreezes: number
}

const LINES: UpgradeLine[] = ['motor', 'cpu', 'battery', 'sensor', 'magnet']

/** Coins and XP of one game round, given the learner's earlier rounds. */
function gameCredit(
  e: Extract<LearnEvent, { kind: 'game_done' }>,
  best: Map<string, number>,
  paid: Map<string, number>,
  day: string,
): { coins: number; xp: number } {
  if (e.game === 'maze' || e.game === 'puzzle') {
    const key = `${e.game}:${e.level}`
    const before = best.get(key) ?? 0
    if (e.stars <= before) return { coins: 0, xp: 0 }
    best.set(key, e.stars)
    return { coins: (before === 0 ? GAME_RULES.levelClear : 0) + GAME_RULES.star * (e.stars - before), xp: GAME_RULES.starXp * (e.stars - before) }
  }
  const key = `${e.game}:${day}`
  const n = paid.get(key) ?? 0
  if (n >= GAME_RULES.paidRounds) return { coins: 0, xp: 0 }
  paid.set(key, n + 1)
  if (e.game === 'memory') return { coins: 6 + 2 * e.stars, xp: 2 + e.stars }
  return { coins: Math.min(GAME_RULES.blitzCoinsMax, e.score), xp: Math.min(GAME_RULES.blitzXpMax, Math.ceil(e.score / 2)) }
}

/** Everything earned, with the moment it was earned (before upgrades). */
export function credits(state: LearnState): Credit[] {
  const out: Credit[] = []
  const goal = state.profile?.goal ?? DEFAULT_GOAL
  const keyOf = dayKeyer(state.profile?.timezone ?? 'UTC')
  if (state.profile) out.push({ at: state.profile.createdAt, coins: COIN_RULES.start, xp: 0, source: 'start', boost: false })

  const seen = new Set<string>()
  const best = new Map<string, number>()
  const paid = new Map<string, number>()
  const byDay = new Map<string, LearnEvent[]>()
  for (const e of state.events) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    const day = keyOf(e.at)
    let list = byDay.get(day)
    if (!list) byDay.set(day, (list = []))
    list.push(e)
    const xp = xpForEvent(e)
    switch (e.kind) {
      case 'lesson_done':
        out.push({ at: e.at, coins: COIN_RULES.lesson + (e.project ? COIN_RULES.project : 0), xp, source: 'lesson', boost: true })
        break
      case 'step_done':
        if (xp > 0) out.push({ at: e.at, coins: COIN_RULES.firstTry, xp, source: 'step', boost: true })
        break
      case 'review_done':
        out.push({ at: e.at, coins: COIN_RULES.review, xp, source: 'review', boost: true })
        break
      case 'real_robot':
        out.push({ at: e.at, coins: COIN_RULES.realRobot, xp, source: 'robot', boost: true })
        break
      case 'challenge_done':
        out.push({ at: e.at, coins: COIN_RULES.challenge, xp, source: 'challenge', boost: true })
        break
      case 'achievement':
        out.push({ at: e.at, coins: COIN_RULES.achievement, xp: 0, source: 'achievement', boost: false })
        break
      case 'game_done': {
        const g = gameCredit(e, best, paid, day)
        if (g.coins || g.xp) out.push({ at: e.at, ...g, source: 'game', boost: true })
        break
      }
    }
  }

  // Days: the daily goal and the daily quests (they need the learner's goal and time zone, so a profile).
  if (!state.profile) return out
  for (const [day, events] of byDay) {
    const at = events[events.length - 1].at
    let lessons = 0
    let seconds = 0
    for (const e of events) {
      if (e.kind === 'lesson_done' || e.kind === 'review_done') lessons++
      if (e.kind === 'time') seconds += e.seconds
    }
    if (goalProgress(goal, { lessons, seconds }) >= 1) out.push({ at, coins: COIN_RULES.goalDay, xp: 0, source: 'goal', boost: false })
    const quests = questStatus(day, events)
    for (const q of quests) if (q.done) out.push({ at, coins: q.quest.coins, xp: QUEST_XP, source: 'quest', boost: false })
    if (quests.every((q) => q.done)) out.push({ at, coins: CHEST.coins, xp: CHEST.xp, source: 'chest', boost: false })
  }
  return out
}

function tierAt(owned: Owned[], line: UpgradeLine, at: number): number {
  let tier = 0
  for (const o of owned) if (o.line === line && o.at <= at && (o.tier ?? 0) > tier) tier = o.tier ?? 0
  return tier
}

function coinsOf(c: Credit, owned: Owned[]): number {
  let mult = 1
  if (c.boost) mult += BUFFS.motor[tierAt(owned, 'motor', c.at)]
  if (c.source === 'quest') mult *= BUFFS.magnet[tierAt(owned, 'magnet', c.at)]
  return Math.round(c.coins * mult)
}

function xpOf(c: Credit, owned: Owned[]): number {
  return c.boost ? Math.round(c.xp * (1 + BUFFS.cpu[tierAt(owned, 'cpu', c.at)])) : c.xp
}

export function ledger(state: LearnState): Ledger {
  const list = credits(state)
  const owned: Owned[] = []
  const keys = new Set<string>()
  let spent = 0
  const seen = new Set<string>()
  for (const e of state.events) {
    if (e.kind !== 'purchase' || seen.has(e.id)) continue
    seen.add(e.id)
    const item = itemByKey(e.item)
    const price = item ? priceOf(item) : null
    if (!item || price === null || keys.has(itemKey(item)) || !canBuyTier(item, keys)) continue
    spent += price
    keys.add(itemKey(item))
    owned.push({ key: itemKey(item), at: e.at, line: item.upgrade?.line, tier: item.upgrade?.tier })
  }
  const earned = list.reduce((sum, c) => sum + coinsOf(c, owned), 0)
  const xp = list.reduce((sum, c) => sum + xpOf(c, owned), 0)
  const tiers = Object.fromEntries(LINES.map((l) => [l, tierAt(owned, l, Infinity)])) as Record<UpgradeLine, number>
  const balance = earned - spent
  return { xp, coins: Math.max(0, balance), balance, earned, spent, owned: keys, tiers, maxFreezes: MAX_FREEZES + BUFFS.battery[tiers.battery] }
}

export function totalXp(state: LearnState): number {
  return ledger(state).xp
}

/** Which game rounds still pay today (memory, blitz). */
export function paidRoundsLeft(state: LearnState, game: GameId, now = Date.now()): number {
  if (game === 'maze' || game === 'puzzle') return Infinity
  const keyOf = dayKeyer(state.profile?.timezone ?? 'UTC')
  const today = keyOf(now)
  const n = state.events.filter((e) => e.kind === 'game_done' && e.game === game && keyOf(e.at) === today).length
  return Math.max(0, GAME_RULES.paidRounds - n)
}

/** Best stars per level of a level game. */
export function bestStars(state: LearnState, game: 'maze' | 'puzzle'): Map<number, number> {
  const best = new Map<number, number>()
  for (const e of state.events) if (e.kind === 'game_done' && e.game === game) best.set(e.level, Math.max(best.get(e.level) ?? 0, e.stars))
  return best
}
