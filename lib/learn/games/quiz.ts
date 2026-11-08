/**
 * Questions for Blitz and the cards for Term pairs: glossary terms,
 * single-answer quiz questions from the lessons and small number problems
 * about robots. Pure functions with a seeded random, so tests can replay.
 */

import type { IconName } from '@/components/ui/anim-icon'
import { GLOSSARY } from '../glossary'

type Lang = 'ru' | 'kk' | 'en'
type L = { ru: string; kk: string; en: string }

export interface BlitzQuestion {
  key: string
  prompt: string
  options: string[]
  correct: number
}

/** A lesson quiz with one right option (passed from the server page). */
export interface LessonChoice {
  key: string
  question: L
  options: L[]
  correct: number
}

export function random(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13
    s ^= s >>> 17
    s ^= s << 5
    return (s >>> 0) / 4294967296
  }
}

export function shuffle<T>(items: T[], rnd: () => number): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

const MATH: Record<Lang, { wheel: string; speed: string; turns: string; unitCm: string; unitS: string; unitDeg: string }> = {
  ru: {
    wheel: 'Колесо за один оборот проезжает {c} см. Сколько проедет робот за {n} оборота?',
    speed: 'Робот едет {v} см в секунду. За сколько секунд он проедет {d} см?',
    turns: 'Робот повернул {n} раза по {a}°. На сколько градусов он повернулся всего?',
    unitCm: 'см',
    unitS: 'с',
    unitDeg: '°',
  },
  kk: {
    wheel: 'Дөңгелек бір айналымда {c} см жүреді. Робот {n} айналымда қанша жүреді?',
    speed: 'Робот секундына {v} см жүреді. {d} см-ді неше секундта жүреді?',
    turns: 'Робот {n} рет {a}°-қа бұрылды. Барлығы неше градусқа бұрылды?',
    unitCm: 'см',
    unitS: 'с',
    unitDeg: '°',
  },
  en: {
    wheel: 'A wheel travels {c} cm per rotation. How far does the robot go in {n} rotations?',
    speed: 'A robot drives {v} cm per second. How many seconds does it take to drive {d} cm?',
    turns: 'A robot turned {n} times by {a}°. How many degrees did it turn in total?',
    unitCm: 'cm',
    unitS: 's',
    unitDeg: '°',
  },
}

const fill = (s: string, v: Record<string, number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(v[k]))

function numberOptions(answer: number, unit: string, rnd: () => number): { options: string[]; correct: number } {
  const wrong = new Set<number>()
  const deltas = [-2, -1, 1, 2, 3].map((d) => d * Math.max(1, Math.round(answer / 4)))
  for (const d of shuffle(deltas, rnd)) {
    if (wrong.size === 3) break
    const v = answer + d
    if (v > 0 && v !== answer) wrong.add(v)
  }
  const values = shuffle([answer, ...wrong], rnd)
  return { options: values.map((v) => `${v} ${unit}`), correct: values.indexOf(answer) }
}

function mathQuestion(lang: Lang, rnd: () => number, i: number): BlitzQuestion {
  const m = MATH[lang]
  const kind = Math.floor(rnd() * 3)
  if (kind === 0) {
    const c = [10, 15, 20, 25][Math.floor(rnd() * 4)]
    const n = 2 + Math.floor(rnd() * 3)
    return { key: `math-${i}`, prompt: fill(m.wheel, { c, n }), ...numberOptions(c * n, m.unitCm, rnd) }
  }
  if (kind === 1) {
    const v = [5, 10, 20][Math.floor(rnd() * 3)]
    const t = 2 + Math.floor(rnd() * 5)
    return { key: `math-${i}`, prompt: fill(m.speed, { v, d: v * t }), ...numberOptions(t, m.unitS, rnd) }
  }
  const a = [45, 90][Math.floor(rnd() * 2)]
  const n = 2 + Math.floor(rnd() * 3)
  return { key: `math-${i}`, prompt: fill(m.turns, { n, a }), ...numberOptions(a * n, m.unitDeg, rnd) }
}

const WHAT_IS: Record<Lang, string> = { ru: 'Что это: «{d}»?', kk: 'Бұл не: «{d}»?', en: 'What is it: “{d}”?' }

function termQuestion(lang: Lang, rnd: () => number): BlitzQuestion {
  const [right, ...others] = shuffle(GLOSSARY, rnd)
  const values = shuffle([right, ...others.slice(0, 3)], rnd)
  return {
    key: `term-${right.id}`,
    prompt: WHAT_IS[lang].replace('{d}', right.short[lang]),
    options: values.map((t) => t.term[lang]),
    correct: values.indexOf(right),
  }
}

/** A mixed stream of questions: terms, lesson quizzes and numbers. */
export function blitzQuestions(lang: Lang, seed: number, lessons: LessonChoice[], count = 40): BlitzQuestion[] {
  const rnd = random(seed)
  const pool = shuffle(lessons, rnd)
  const out: BlitzQuestion[] = []
  for (let i = 0; i < count; i++) {
    const r = rnd()
    if (r < 0.3 && pool.length) {
      const q = pool[i % pool.length]
      const order = shuffle(
        q.options.map((_, k) => k),
        rnd,
      )
      out.push({ key: `${q.key}-${i}`, prompt: q.question[lang], options: order.map((k) => q.options[k][lang]), correct: order.indexOf(q.correct) })
    } else if (r < 0.65) out.push({ ...termQuestion(lang, rnd), key: `term-${i}` })
    else out.push(mathQuestion(lang, rnd, i))
  }
  return out
}

export const BLITZ_SECONDS = 60

export function blitzStars(score: number): number {
  return score >= 14 ? 3 : score >= 9 ? 2 : score >= 4 ? 1 : 0
}

export interface MemoryCard {
  key: string
  pair: string
  face: 'term' | 'short'
  text: string
  icon: IconName | null
}

/** Six glossary terms: a card with the term and one with its short meaning. */
export function memoryDeck(lang: Lang, seed: number, pairs = 6): MemoryCard[] {
  const rnd = random(seed)
  const terms = shuffle(GLOSSARY, rnd).slice(0, pairs)
  const cards = terms.flatMap((t): MemoryCard[] => [
    { key: `${t.id}-t`, pair: t.id, face: 'term', text: t.term[lang], icon: t.icon },
    { key: `${t.id}-s`, pair: t.id, face: 'short', text: t.short[lang], icon: null },
  ])
  return shuffle(cards, rnd)
}

/** Stars by the number of tries (two cards turned = one try). */
export function memoryStars(tries: number, pairs = 6): number {
  return tries <= pairs + 3 ? 3 : tries <= pairs + 7 ? 2 : 1
}
