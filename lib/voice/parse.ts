/**
 * Spoken robot commands → program steps, without AI: "проедь вперёд на 30 сантиметров и
 * поверни направо" becomes move 30 cm + turn right 90°. Russian, Kazakh and English work
 * whatever the page language is (speech recognisers mix them up anyway). Numbers may come
 * as digits or words ("тридцать пять", "отыз бес", "thirty five").
 */

import type { Step } from '@/lib/dsl/types'

export type VoicePart = { text: string; steps: Step[] }
export type VoiceResult = {
  /** Recognised pieces of the phrase, in order. */
  parts: VoicePart[]
  /** Pieces that are not robot commands. */
  unknown: string[]
  /** "стоп" anywhere: stop the robot instead of running anything. */
  stop: boolean
  steps: Step[]
}

const DEFAULT_CM = 20
const DEFAULT_DEGREES = 90

// ── Numbers in words ──────────────────────────────────────────────────────

const UNITS: Record<string, number> = {
  ноль: 0,
  один: 1,
  одна: 1,
  одну: 1,
  одно: 1,
  два: 2,
  две: 2,
  три: 3,
  четыре: 4,
  пять: 5,
  шесть: 6,
  семь: 7,
  восемь: 8,
  девять: 9,
  десять: 10,
  одиннадцать: 11,
  двенадцать: 12,
  тринадцать: 13,
  четырнадцать: 14,
  пятнадцать: 15,
  шестнадцать: 16,
  семнадцать: 17,
  восемнадцать: 18,
  девятнадцать: 19,
  полтора: 1.5,
  полторы: 1.5,
  zero: 0,
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  eleven: 11,
  twelve: 12,
  thirteen: 13,
  fourteen: 14,
  fifteen: 15,
  sixteen: 16,
  seventeen: 17,
  eighteen: 18,
  nineteen: 19,
  half: 0.5,
  нөл: 0,
  бір: 1,
  бир: 1,
  екі: 2,
  еки: 2,
  үш: 3,
  уш: 3,
  төрт: 4,
  торт: 4,
  бес: 5,
  алты: 6,
  жеті: 7,
  жети: 7,
  сегіз: 8,
  сегиз: 8,
  тоғыз: 9,
  тогыз: 9,
  он: 10,
}
const TENS: Record<string, number> = {
  двадцать: 20,
  тридцать: 30,
  сорок: 40,
  пятьдесят: 50,
  шестьдесят: 60,
  семьдесят: 70,
  восемьдесят: 80,
  девяносто: 90,
  twenty: 20,
  thirty: 30,
  forty: 40,
  fifty: 50,
  sixty: 60,
  seventy: 70,
  eighty: 80,
  ninety: 90,
  жиырма: 20,
  отыз: 30,
  қырық: 40,
  кырык: 40,
  елу: 50,
  алпыс: 60,
  жетпіс: 70,
  жетпис: 70,
  сексен: 80,
  тоқсан: 90,
  токсан: 90,
}
const HUNDREDS: Record<string, number> = { сто: 100, двести: 200, триста: 300, hundred: 100, жүз: 100, жуз: 100 }

/** Replaces runs of number words with digits: "сто двадцать пять" → "125". */
function wordsToDigits(words: string[]): string[] {
  const out: string[] = []
  let value: number | null = null
  const flush = () => {
    if (value !== null) out.push(String(value))
    value = null
  }
  for (const w of words) {
    if (w in HUNDREDS) {
      // "one hundred", "екі жүз": a multiplier after a unit, otherwise a hundred on its own.
      value = value !== null && value < 10 ? value * 100 : (value ?? 0) + HUNDREDS[w]
    } else if (w in TENS) {
      if (value !== null && value % 100 !== 0) flush()
      value = (value ?? 0) + TENS[w]
    } else if (w in UNITS) {
      if (value !== null && value % 10 !== 0) flush()
      value = (value ?? 0) + UNITS[w]
    } else {
      flush()
      out.push(w)
    }
  }
  flush()
  return out
}

// ── Phrase → clauses ──────────────────────────────────────────────────────

/** Words that join commands: "вперёд и направо", "then", "сосын". */
const JOINERS = new Set(['и', 'потом', 'затем', 'а', 'and', 'then', 'next', 'сосын', 'кейін', 'кейин', 'және', 'жане', 'содан'])
const JOIN_PHRASES = [/после этого/g, /после чего/g, /а потом/g, /and then/g, /after that/g, /содан кейін/g, /одан кейін/g]

export function normalize(text: string): string {
  let s = text.toLowerCase().replace(/ё/g, 'е')
  s = s.replace(/(\d),(\d)/g, '$1.$2')
  for (const re of JOIN_PHRASES) s = s.replace(re, ',')
  s = s.replace(/°/g, ' градусов ').replace(/(\d)(см|cm|м|m|с|s)(?=\s|$|[,.;!?])/g, '$1 $2')
  return s
    .replace(/[-–—]/g, ' ')
    .replace(/[^\p{L}\p{N}.,;!?\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function clauses(text: string): string[] {
  const out: string[][] = [[]]
  for (const raw of normalize(text).split(' ')) {
    const end = /[,;!?]$|(?<!\d)\.$/.test(raw)
    const word = raw.replace(/[,;!?]+$/, '').replace(/(?<!\d)\.$/, '')
    if (JOINERS.has(word)) out.push([])
    else if (word) out[out.length - 1].push(word)
    if (end) out.push([])
  }
  return out.filter((c) => c.length).map((c) => wordsToDigits(c).join(' '))
}

// ── One clause → steps ────────────────────────────────────────────────────

const has = (s: string, re: RegExp) => re.test(s)
const W = (stems: string) => new RegExp(`(?:^|\\s)(?:${stems})`, 'u')

const FORWARD = W('вперед|прям|езжай|едь|поезжай|forward|ahead|straight|go|drive|алға|алга|тура')
const BACK = W('назад|обратно|back|backward|reverse|артқа|артка|кері ж')
const RIGHT = W('направо|вправо|right|оңға|онга')
const LEFT = W('налево|влево|left|солға|солга')
const AROUND = W('разверн|разворот|around|u turn|кері бұрыл|кери бурыл')
const TURN = W('поверн|поворот|turn|rotate|бұрыл|бурыл')
const STOP = W('стоп|стой|останов|хватит|замри|stop|halt|freeze|тоқта|токта')
const SPEED = W('скорост|speed|жылдамдық|жылдамдык')
const FAST = W('быстр|faster|fast|жылдам|тез')
const SLOW = W('медлен|тише|slow|баяу|ақырын|акырын')
const BEEP = W('пискни|пикни|бип|сигнал|гудок|погуди|посигналь|beep|honk|дыбыс')
const WAIT = W('подожд|жди|ждать|пауза|wait|pause|күт|кут')
const SMILE = W('улыб|смайл|smile|happy|күл|кул')
const HEART = W('сердц|сердечк|heart|жүрек|журек')
const SQUARE = W('квадрат|square|шаршы')
const CIRCLE = W('круг|кругом|circle|шеңбер|шенбер|дөңгелен')
const DANCE = W('танц|спляш|dance|биле')

const NUMBER = /(?:^|\s)(\d+(?:\.\d+)?)(?=\s|$)/
const CM = W('см|сантиметр|santimet|cm|centimet|centimetr')
/** A whole word: short units like "м" must not match the start of other words. */
const WORD = (words: string) => new RegExp(`(?:^|\\s)(?:${words})(?=\\s|$)`, 'u')
const either = (a: RegExp, b: RegExp) => new RegExp(`${a.source}|${b.source}`, 'u')
const METER = either(WORD('м|m'), W('метр|meter|metre'))
const SECONDS = either(WORD('с|s|sec'), W('сек|second'))
const ROTATIONS = W('оборот|rotation|revolution|айналым|айналым')
const DEGREES = W('градус|degree|deg')

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, Math.round(v * 10) / 10))

function number(s: string): number | null {
  const m = NUMBER.exec(s)
  return m ? Number(m[1]) : null
}

/** A distance in a clause: "30 см", "полметра" → move value and unit. */
function distance(s: string, n: number | null): { value: number; unit: 'cm' | 'seconds' | 'rotations' } {
  if (n !== null && has(s, SECONDS) && !has(s, CM)) return { value: clamp(n, 0.1, 20), unit: 'seconds' }
  if (n !== null && has(s, ROTATIONS)) return { value: clamp(n, 0.1, 20), unit: 'rotations' }
  if (has(s, W('полметра|half a meter|half a metre'))) return { value: 50, unit: 'cm' }
  if (n !== null && has(s, METER) && !has(s, CM)) return { value: clamp(n * 100, 1, 300), unit: 'cm' }
  return { value: clamp(n ?? DEFAULT_CM, 1, 300), unit: 'cm' }
}

function turnDegrees(s: string, n: number | null): number {
  if (n !== null && (has(s, DEGREES) || !has(s, CM))) return clamp(n, 1, 720)
  return DEFAULT_DEGREES
}

function clauseSteps(s: string): Step[] | null {
  const n = number(s)
  if (has(s, SQUARE)) {
    const side = clamp(n ?? 30, 5, 100)
    return [
      {
        op: 'repeat',
        times: 4,
        steps: [
          { op: 'move', direction: 'forward', value: side, unit: 'cm' },
          { op: 'turn', direction: has(s, LEFT) ? 'left' : 'right', degrees: 90 },
        ],
      },
    ]
  }
  if (has(s, CIRCLE)) return [{ op: 'circle', direction: has(s, LEFT) ? 'left' : 'right', radius: clamp(n ?? 20, 5, 60), turns: 1 }]
  if (has(s, DANCE)) {
    return [
      { op: 'show_image', image: 'heart' },
      { op: 'turn', direction: 'left', degrees: 30 },
      { op: 'turn', direction: 'right', degrees: 60 },
      { op: 'turn', direction: 'left', degrees: 30 },
      { op: 'beep', note: 72, seconds: 0.2 },
      { op: 'beep', note: 76, seconds: 0.2 },
    ]
  }
  if (has(s, SPEED) && n !== null) return [{ op: 'set_speed', speed: clamp(n, 10, 100) }]
  if (has(s, FAST) && !has(s, FORWARD) && !has(s, BACK)) return [{ op: 'set_speed', speed: 90 }]
  if (has(s, SLOW) && !has(s, FORWARD) && !has(s, BACK)) return [{ op: 'set_speed', speed: 30 }]
  if (has(s, BEEP)) return [{ op: 'beep', note: 72, seconds: 0.3 }]
  if (has(s, SMILE)) return [{ op: 'show_image', image: 'smile', seconds: 1 }]
  if (has(s, HEART)) return [{ op: 'show_image', image: 'heart', seconds: 1 }]
  if (has(s, AROUND)) return [{ op: 'turn', direction: has(s, LEFT) ? 'left' : 'right', degrees: 180 }]

  const steps: Step[] = []
  // "быстро вперёд": the speed goes first.
  if (has(s, FAST)) steps.push({ op: 'set_speed', speed: 90 })
  else if (has(s, SLOW)) steps.push({ op: 'set_speed', speed: 30 })
  const side = has(s, RIGHT) ? 'right' : has(s, LEFT) ? 'left' : null
  if (side && (has(s, TURN) || !(has(s, FORWARD) || has(s, BACK)))) {
    steps.push({ op: 'turn', direction: side, degrees: turnDegrees(s, n) })
    return steps
  }
  if (has(s, FORWARD) || has(s, BACK)) {
    steps.push({ op: 'move', direction: has(s, BACK) ? 'back' : 'forward', ...distance(s, n) })
    return steps
  }
  if (has(s, WAIT)) return [{ op: 'wait', seconds: clamp(n ?? 1, 0.1, 10) }]
  // "ещё 20 сантиметров" with no direction: forward.
  if (n !== null && (has(s, CM) || has(s, METER))) return [{ op: 'move', direction: 'forward', ...distance(s, n) }]
  return steps.length ? steps : null
}

export function parseVoice(text: string): VoiceResult {
  const result: VoiceResult = { parts: [], unknown: [], stop: false, steps: [] }
  for (const clause of clauses(text)) {
    if (has(clause, STOP)) {
      result.stop = true
      continue
    }
    const steps = clauseSteps(clause)
    if (steps) result.parts.push({ text: clause, steps })
    else result.unknown.push(clause)
  }
  result.steps = result.parts.flatMap((p) => p.steps)
  return result
}

/** Language of the browser's speech recogniser for the page language. */
export const SPEECH_LANG = { ru: 'ru-RU', kk: 'kk-KZ', en: 'en-US' } as const
