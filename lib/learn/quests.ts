/**
 * Daily quests: three small tasks a day, the same for everyone on that date
 * (picked from the date, so nothing is stored). One is about lessons, one is
 * a game, one is extra. Progress is counted from that day's events in the
 * learner's time zone; rewards are added in lib/learn/economy.ts.
 */

import type { IconName } from '@/components/ui/anim-icon'
import type { LearnEvent } from './state'

type L = { ru: string; kk: string; en: string }

export type QuestId = 'lesson' | 'first-try' | 'minutes' | 'maze' | 'puzzle' | 'memory' | 'blitz' | 'games'

export interface QuestDef {
  id: QuestId
  icon: IconName
  target: number
  coins: number
  title: L
  /** Where to go to do it (path under /[lang]). */
  href: string
}

export const QUEST_XP = 5
export const CHEST = { coins: 25, xp: 10 } as const

export const QUESTS: Record<QuestId, QuestDef> = {
  lesson: {
    id: 'lesson',
    icon: 'book',
    target: 1,
    coins: 20,
    href: '/path',
    title: { ru: 'Пройди урок или повторение', kk: 'Сабақ не қайталау өт', en: 'Finish a lesson or a review' },
  },
  'first-try': {
    id: 'first-try',
    icon: 'target',
    target: 3,
    coins: 15,
    href: '/path',
    title: { ru: 'Ответь верно с первой попытки 3 раза', kk: 'Бірінші әрекеттен 3 рет дұрыс жауап бер', en: 'Get 3 answers right on the first try' },
  },
  minutes: {
    id: 'minutes',
    icon: 'stopwatch',
    target: 10,
    coins: 15,
    href: '/play',
    title: { ru: 'Позанимайся 10 минут', kk: '10 минут жаттық', en: 'Practise for 10 minutes' },
  },
  maze: {
    id: 'maze',
    icon: 'compass',
    target: 1,
    coins: 15,
    href: '/play/maze',
    title: { ru: 'Пройди уровень лабиринта', kk: 'Лабиринт деңгейін өт', en: 'Clear a maze level' },
  },
  puzzle: {
    id: 'puzzle',
    icon: 'puzzle',
    target: 1,
    coins: 15,
    href: '/play/puzzle',
    title: { ru: 'Собери программу из кусочков', kk: 'Бөліктерден бағдарлама құрастыр', en: 'Put a program together' },
  },
  memory: {
    id: 'memory',
    icon: 'cards',
    target: 1,
    coins: 10,
    href: '/play/memory',
    title: { ru: 'Сыграй в «Пары терминов»', kk: '«Терминдер жұбын» ойна', en: 'Play Term pairs' },
  },
  blitz: {
    id: 'blitz',
    icon: 'lightning',
    target: 8,
    coins: 20,
    href: '/play/blitz',
    title: { ru: 'Набери 8 очков в «Блице»', kk: '«Блицте» 8 ұпай жина', en: 'Score 8 in Blitz' },
  },
  games: { id: 'games', icon: 'gamepad', target: 3, coins: 20, href: '/play', title: { ru: 'Сыграй 3 игры', kk: '3 ойын ойна', en: 'Play 3 games' } },
}

const LEARN: QuestId[] = ['lesson', 'first-try', 'lesson', 'minutes']
const GAME: QuestId[] = ['maze', 'puzzle', 'memory', 'blitz']
const EXTRA: QuestId[] = ['games', 'first-try', 'minutes', 'blitz', 'maze']

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}

/** The three quests of a day (YYYY-MM-DD), always different from each other. */
export function questsFor(day: string): QuestDef[] {
  const h = hash(day)
  const a = LEARN[h % LEARN.length]
  const b = GAME[(h >>> 8) % GAME.length]
  const rest = EXTRA.filter((q) => q !== a && q !== b)
  const c = rest[(h >>> 16) % rest.length]
  return [QUESTS[a], QUESTS[b], QUESTS[c]]
}

/** Progress of a quest from the events of that day. */
export function questProgress(id: QuestId, dayEvents: LearnEvent[]): number {
  let n = 0
  for (const e of dayEvents) {
    switch (id) {
      case 'lesson':
        // Reviews count too, so the quest stays doable when every ready lesson is done.
        if (e.kind === 'lesson_done' || e.kind === 'review_done') n++
        break
      case 'first-try':
        if (e.kind === 'step_done' && e.firstTry && e.hints === 0 && e.stepType !== 'theory' && e.stepType !== 'build') n++
        if (e.kind === 'review_done') n += e.correct
        break
      case 'minutes':
        if (e.kind === 'time') n += e.seconds / 60
        break
      case 'games':
        if (e.kind === 'game_done') n++
        break
      case 'blitz':
        if (e.kind === 'game_done' && e.game === 'blitz') n = Math.max(n, e.score)
        break
      default:
        if (e.kind === 'game_done' && e.game === id && e.stars > 0) n++
    }
  }
  return Math.floor(n)
}

export interface QuestStatus {
  quest: QuestDef
  progress: number
  done: boolean
}

export function questStatus(day: string, dayEvents: LearnEvent[]): QuestStatus[] {
  return questsFor(day).map((quest) => {
    const progress = Math.min(quest.target, questProgress(quest.id, dayEvents))
    return { quest, progress, done: progress >= quest.target }
  })
}
