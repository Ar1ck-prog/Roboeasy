import { describe, expect, it } from 'vitest'

import { COIN_RULES, GAME_RULES, credits, ledger, paidRoundsLeft } from '@/lib/learn/economy'
import { GLOSSARY } from '@/lib/learn/glossary'
import { MAZE_LEVELS, blockCount, expand, mazeStars, parseMaze, parseSolution, runMaze, shortestMoves } from '@/lib/learn/games/maze'
import { PUZZLES, firstMistake, shuffledOrder } from '@/lib/learn/games/puzzle'
import { blitzQuestions, memoryDeck, memoryStars } from '@/lib/learn/games/quiz'
import { CHEST, QUESTS, QUEST_XP, questStatus, questsFor } from '@/lib/learn/quests'
import { SHOP, UPGRADES, itemKey, priceOf } from '@/lib/learn/shop'
import { SOURCES } from '@/lib/learn/sources'
import { DEFAULT_COSMETICS, EMPTY_STATE, type LearnState, type NewEvent, type Profile, appendEvents } from '@/lib/learn/state'
import { streakInfo } from '@/lib/learn/streak'
import { XP_RULES } from '@/lib/learn/xp'

const T0 = Date.parse('2026-10-20T06:00:00Z') // 11:00 in Almaty
const HOUR = 3600_000
const profile: Profile = {
  nickname: 'Robo',
  ageRange: '13-15',
  timezone: 'Asia/Almaty',
  goal: { kind: 'lessons', n: 2 },
  skipWeekends: false,
  reminders: { enabled: false, time: '18:00' },
  cosmetics: DEFAULT_COSMETICS,
  buddy: { model: 'rover', name: '' },
  parentConsent: true,
  createdAt: T0 - HOUR,
  anonId: 'anon-12345678',
  tour: false,
  learningPath: null,
}
const withProfile = (events: NewEvent[]): LearnState => appendEvents({ ...EMPTY_STATE, profile }, events)
let n = 0
const lesson = (at: number, project = false): NewEvent => ({ kind: 'lesson_done', lesson: `l${n++}`, track: 'start', unit: 'u', project, seconds: 60, at })
const buy = (item: string, at: number): NewEvent => ({ kind: 'purchase', item, at })
const game = (g: 'maze' | 'puzzle' | 'memory' | 'blitz', level: number, stars: number, score: number, at: number): NewEvent => ({
  kind: 'game_done',
  game: g,
  level,
  stars,
  score,
  at,
  id: `g${n++}`,
})

describe('coins', () => {
  it('starts with welcome coins once there is a profile', () => {
    expect(ledger(EMPTY_STATE).coins).toBe(0)
    expect(ledger(withProfile([])).coins).toBe(COIN_RULES.start)
  })

  it('pays for lessons and projects, and the balance is the sum of credits', () => {
    const s = withProfile([lesson(T0), lesson(T0 + 5 * 86400_000, true)])
    const c = credits(s)
    expect(c.filter((x) => x.source === 'lesson').map((x) => x.coins)).toEqual([COIN_RULES.lesson, COIN_RULES.lesson + COIN_RULES.project])
    expect(ledger(s).coins).toBe(c.reduce((sum, x) => sum + x.coins, 0))
  })

  it('subtracts purchases and ignores unknown items', () => {
    const s = withProfile([buy('hat:antenna', T0), buy('hat:nonexistent', T0 + 2), buy('model:rover', T0 + 3)])
    const l = ledger(s)
    expect(l.owned).toEqual(new Set(['hat:antenna']))
    expect(l.coins).toBe(COIN_RULES.start - 40)
  })

  it('keeps bought items when a profile change lowers past earnings (a debt, coins never below zero)', () => {
    const events = [lesson(T0), lesson(T0 + HOUR), buy('hat:cap', T0 + 2 * HOUR)]
    const before = ledger(withProfile(events))
    expect(before.owned.has('hat:cap')).toBe(true)
    // A harder daily goal re-counts the old day: its goal coins go away.
    const harder = ledger(appendEvents({ ...EMPTY_STATE, profile: { ...profile, goal: { kind: 'minutes', n: 15 } } }, events))
    expect(harder.owned.has('hat:cap')).toBe(true)
    expect(harder.balance).toBeLessThan(before.balance)
    expect(harder.coins).toBe(Math.max(0, harder.balance))
  })

  it('a purchase counts once, and upgrade tiers need the tier before', () => {
    const rich = Array.from({ length: 40 }, (_, i) => lesson(T0 + i * 86400_000))
    const s = withProfile([
      ...rich,
      buy('upgrade:motor-2', T0 + 50 * 86400_000),
      buy('upgrade:motor-1', T0 + 51 * 86400_000),
      buy('upgrade:motor-1', T0 + 52 * 86400_000),
    ])
    const l = ledger(s)
    expect([...l.owned]).toEqual(['upgrade:motor-1'])
    expect(l.tiers.motor).toBe(1)
  })

  it('the motor boosts coins earned after it was bought, not before', () => {
    const base = Array.from({ length: 12 }, (_, i) => lesson(T0 + i * 86400_000))
    const later = lesson(T0 + 21 * 86400_000)
    const without = ledger(withProfile([...base, later]))
    const withMotor = ledger(withProfile([...base, buy('upgrade:motor-1', T0 + 20 * 86400_000), later]))
    expect(withMotor.coins - without.coins).toBe(-80 + Math.round(COIN_RULES.lesson * 1.1) - COIN_RULES.lesson)
  })

  it('the processor boosts XP after the purchase', () => {
    const base = Array.from({ length: 12 }, (_, i) => lesson(T0 + i * 86400_000))
    const later = lesson(T0 + 21 * 86400_000)
    const without = ledger(withProfile([...base, later]))
    const withCpu = ledger(withProfile([...base, buy('upgrade:cpu-1', T0 + 20 * 86400_000), later]))
    expect(withCpu.xp - without.xp).toBe(Math.round(XP_RULES.lesson * 1.1) - XP_RULES.lesson)
  })

  it('the battery raises the streak freeze cap', () => {
    const base = Array.from({ length: 20 }, (_, i) => lesson(T0 + i * 86400_000))
    const l = ledger(withProfile([...base, buy('upgrade:battery-1', T0 + 30 * 86400_000)]))
    expect(l.maxFreezes).toBe(3)
    expect(streakInfo(withProfile(base), T0 + 21 * 86400_000, 3).freezes).toBeLessThanOrEqual(3)
  })

  it('pays for a day with the daily goal met', () => {
    const one = ledger(withProfile([lesson(T0)])).coins
    const two = ledger(withProfile([lesson(T0), lesson(T0 + HOUR)])).coins
    expect(two - one).toBeGreaterThanOrEqual(COIN_RULES.lesson + COIN_RULES.goalDay)
  })

  it('every shop item has a known kind, and upgrades have prices', () => {
    expect(new Set(SHOP.map(itemKey)).size).toBe(SHOP.length)
    for (const u of UPGRADES) expect(priceOf(u)).toBeGreaterThan(0)
  })
})

describe('daily quests', () => {
  it('are three different quests, the same for a date', () => {
    for (const day of ['2026-10-20', '2026-10-21', '2026-12-31', '2027-01-01']) {
      const q = questsFor(day)
      expect(q).toHaveLength(3)
      expect(new Set(q.map((x) => x.id)).size).toBe(3)
      expect(questsFor(day)).toEqual(q)
    }
  })

  it('reward coins, XP and the chest when all three are done', () => {
    const day = '2026-10-20'
    const all: NewEvent[] = [
      lesson(T0),
      ...Array.from({ length: 3 }, (_, i): NewEvent => ({ kind: 'step_done', lesson: 'x', step: `s${i}`, stepType: 'quiz', firstTry: true, hints: 0, at: T0 })),
      { kind: 'time', seconds: 900, at: T0 },
      game('maze', 1, 3, 4, T0),
      game('puzzle', 1, 3, 4, T0),
      game('memory', 0, 3, 8, T0),
      game('blitz', 0, 3, 12, T0),
    ]
    const s = withProfile(all)
    const status = questStatus(day, s.events)
    expect(status.every((q) => q.done)).toBe(true)
    const c = credits(s)
    const quests = c.filter((x) => x.source === 'quest')
    expect(quests.map((x) => x.coins).sort()).toEqual(
      questsFor(day)
        .map((q) => QUESTS[q.id].coins)
        .sort(),
    )
    expect(quests.every((x) => x.xp === QUEST_XP)).toBe(true)
    expect(c.filter((x) => x.source === 'chest')).toEqual([expect.objectContaining({ coins: CHEST.coins, xp: CHEST.xp })])
  })
})

describe('games: rewards', () => {
  it('maze levels pay for the first clear and for new stars only', () => {
    const one = credits(withProfile([game('maze', 1, 1, 9, T0)])).filter((c) => c.source === 'game')
    expect(one[0]).toMatchObject({ coins: GAME_RULES.levelClear + GAME_RULES.star, xp: GAME_RULES.starXp })
    const more = credits(withProfile([game('maze', 1, 1, 9, T0), game('maze', 1, 1, 9, T0 + 1), game('maze', 1, 3, 4, T0 + 2)])).filter(
      (c) => c.source === 'game',
    )
    expect(more.map((c) => c.coins)).toEqual([GAME_RULES.levelClear + GAME_RULES.star, 2 * GAME_RULES.star])
  })

  it('memory and blitz pay for a few rounds a day', () => {
    const rounds = Array.from({ length: 5 }, (_, i) => game('blitz', 0, 2, 10, T0 + i))
    const s = withProfile(rounds)
    expect(credits(s).filter((c) => c.source === 'game')).toHaveLength(GAME_RULES.paidRounds)
    expect(paidRoundsLeft(s, 'blitz', T0 + 10)).toBe(0)
    expect(paidRoundsLeft(s, 'memory', T0 + 10)).toBe(GAME_RULES.paidRounds)
    expect(paidRoundsLeft(s, 'blitz', T0 + 86400_000)).toBe(GAME_RULES.paidRounds)
  })
})

describe('maze', () => {
  it('every level is solvable and our solution wins with the par', () => {
    for (const level of MAZE_LEVELS) {
      const maze = parseMaze(level.rows)
      const tokens = parseSolution(level.solution)
      expect(runMaze(maze, tokens).outcome, `level ${level.id}`).toBe('win')
      expect(blockCount(tokens), `level ${level.id}`).toBe(level.par)
      expect(mazeStars(level, tokens)).toBe(3)
      const plain = shortestMoves(maze)
      expect(plain, `level ${level.id}`).not.toBeNull()
      expect(runMaze(maze, plain!).outcome).toBe('win')
    }
  })

  it('expands loops, including nested ones, and rejects open loops', () => {
    expect(expand(['x2', 'F', 'x3', 'L', 'end', 'end'])).toEqual(['F', 'L', 'L', 'L', 'F', 'L', 'L', 'L'])
    expect(expand(['x2', 'F'])).toBeNull()
    expect(expand(['end'])).toBeNull()
  })

  it('stops at walls and checks gems and the finish', () => {
    const maze = parseMaze(MAZE_LEVELS[3].rows)
    expect(runMaze(maze, ['L', 'F']).outcome).toBe('crash')
    expect(runMaze(maze, ['F']).outcome).toBe('short')
    expect(runMaze(parseMaze(['#####', '#>*G#', '#####']), ['R', 'R', 'F']).outcome).toBe('crash')
    expect(runMaze(parseMaze(['######', '#>.*G#', '######']), ['F', 'F', 'F']).outcome).toBe('win')
    expect(runMaze(parseMaze(['######', '#*>.G#', '######']), ['F', 'F']).outcome).toBe('gems')
  })
})

describe('program puzzles', () => {
  it('accept the right order and point at the first wrong line', () => {
    for (const level of PUZZLES) {
      const right = level.lines.map((_, i) => i)
      expect(firstMistake(level, right, 'ru')).toBe(-1)
      const order = shuffledOrder(level.lines.length, level.id * 7 + 3)
      expect(order).not.toEqual(right)
      expect([...order].sort((a, b) => a - b)).toEqual(right)
    }
    const square = PUZZLES[1]
    expect(firstMistake(square, [0, 1, 3, 2], 'en')).toBe(2)
  })
})

describe('blitz and term pairs', () => {
  it('blitz questions always contain the right answer', () => {
    const qs = blitzQuestions(
      'ru',
      42,
      [
        {
          key: 'q',
          question: { ru: 'Q', kk: 'Q', en: 'Q' },
          options: [
            { ru: 'a', kk: 'a', en: 'a' },
            { ru: 'b', kk: 'b', en: 'b' },
          ],
          correct: 1,
        },
      ],
      50,
    )
    expect(qs).toHaveLength(50)
    for (const q of qs) {
      expect(q.correct).toBeGreaterThanOrEqual(0)
      expect(q.correct).toBeLessThan(q.options.length)
      expect(new Set(q.options).size).toBe(q.options.length)
    }
    expect(blitzQuestions('kk', 42, [], 10)).toEqual(blitzQuestions('kk', 42, [], 10))
  })

  it('memory decks have two cards per term', () => {
    const deck = memoryDeck('en', 7, 6)
    expect(deck).toHaveLength(12)
    expect(new Set(deck.map((c) => c.pair)).size).toBe(6)
    expect(memoryStars(6)).toBe(3)
    expect(memoryStars(20)).toBe(1)
  })

  it('glossary and sources are complete', () => {
    expect(new Set(GLOSSARY.map((g) => g.id)).size).toBe(GLOSSARY.length)
    for (const g of GLOSSARY) for (const lang of ['ru', 'kk', 'en'] as const) expect(g.short[lang].length, `${g.id} ${lang}`).toBeLessThanOrEqual(42)
    for (const s of SOURCES) expect(s.url).toMatch(/^https:\/\//)
  })
})
