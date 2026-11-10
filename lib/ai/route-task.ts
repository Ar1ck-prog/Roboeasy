/**
 * Which model a generation goes to. A short request for one or two simple
 * actions goes to the light model; anything with sensors, loops or a shape
 * made of several parts goes to the main one.
 */

import type { ModelTier } from '@/lib/gemini'

const SHORT_PROMPT = 70
const MAX_SIMPLE_ACTIONS = 2

/** Word stems that mean logic or a multi-part shape, in ru, kk and en. */
const COMPLEX =
  /датчик|сенсор|пока\b|если|когда|цикл|повтор|раз\b|всегда|бесконеч|лини|стен|препятств|цвет|квадрат|треугольн|восьм|спирал|зигзаг|змейк|сортир|функц|перемен|шарш|үшбұрыш|сегіз|сызық|қабырға|кедерг|түс|егер|қайтала|әрқашан|sensor|while|until|if\b|when\b|loop|repeat|times\b|forever|line\b|wall|obstacle|colou?r|square|triangle|figure|eight|spiral|zigzag|sort|function|variable/i

/** Words that join separate actions: "go forward, then turn and beep". */
const JOINERS = /,|;|\bзатем\b|\bпотом\b|\bи\b|\bдан кейін\b|\bсосын\b|\bжәне\b|\bthen\b|\band\b|\bafter\b/gi

export function tierForPrompt(prompt: string, refining: boolean): ModelTier {
  // Changing an existing program means reading and rewriting all of it.
  if (refining || prompt.length > SHORT_PROMPT || COMPLEX.test(prompt)) return 'main'
  return (prompt.match(JOINERS)?.length ?? 0) + 1 <= MAX_SIMPLE_ACTIONS ? 'light' : 'main'
}
