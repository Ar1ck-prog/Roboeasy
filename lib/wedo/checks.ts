/**
 * Automatic checks of WeDo tasks: the program runs in the WeDo simulator
 * with the lesson's scenario and the result is compared with the goals.
 * Short, kind messages; never a penalty.
 */

import { fill } from '../i18n/config'
import { getWedoText } from '../i18n/wedo'
import type { WedoCheck, WedoScenario } from './schema'
import { inZone, levelHeight, zoneLabel } from './scenes'
import { ROVER_LENGTH, type WedoEvent, type WedoResult, simulateWedo } from './sim'
import { type WedoScene, type WedoStep, opCount, wedoBlocks } from './types'

export type Lang = 'ru' | 'kk' | 'en'

export interface WedoCheckResult {
  type: WedoCheck['type']
  ok: boolean
  message: string
  hint?: string
}

export interface WedoCheckReport {
  ok: boolean
  results: WedoCheckResult[]
  sim: WedoResult
  blocks: number
}

/** Scenario events move this much later in the second run of reaction checks, s. */
export const REACTION_SHIFT = 1.7

type Texts = Record<WedoCheck['type'], { ok: string; fail: string; hint: string }>

const TEXT: Record<Lang, Texts> = {
  ru: {
    motorRan: { ok: 'Мотор крутился.', fail: 'Мотор крутился мало или не в ту сторону.', hint: 'Нужно больше секунд? Или другое направление?' },
    motorTime: { ok: 'Мотор крутился {s} с.', fail: 'Мотор крутился {s} с, а нужно {target} с.', hint: 'Посчитай секунды во всех блоках мотора.' },
    roverInZone: { ok: 'Вжик остановился у цели «{zone}».', fail: 'Почти! Вжик остановился не у цели «{zone}».', hint: 'Вжик не доехал? Дай больше секунд. Проехал? Дай меньше.' },
    passZones: { ok: 'Вжик побывал везде, где нужно.', fail: 'Вжик не заехал в «{zone}».', hint: 'Проследи путь Вжика по шагам.' },
    stopBeforeObstacle: { ok: 'Вжик остановился прямо перед препятствием.', fail: 'Вжик остановился далеко или врезался.', hint: 'Пусть Вжик ждёт, когда датчик скажет «близко».' },
    noCrash: { ok: 'Вжик ни во что не врезался.', fail: 'Бум! Вжик врезался.', hint: 'Остановись раньше: меньше секунд или жди датчик.' },
    returnedToStart: { ok: 'Вжик вернулся домой.', fail: 'Вжик не вернулся на старт.', hint: 'Назад нужно ехать столько же, сколько вперёд.' },
    spinnerTurns: { ok: 'Вертушка сделала {n} об.', fail: 'Вертушка сделала {n} об., а нужно {target}.', hint: 'Пусть мотор крутится дольше или сильнее.' },
    liftAt: { ok: 'Крюк на уровне {level}.', fail: 'Крюк остановился не на уровне {level}.', hint: 'Подбери секунды: выше или ниже нужно?' },
    reactsTo: { ok: 'Робот отвечает датчику.', fail: 'Робот не ответил датчику вовремя.', hint: 'Поставь блок «ждать датчик» перед действием.' },
    light: { ok: 'Лампа горела: {color}.', fail: 'Лампа не горела цветом «{color}».', hint: 'Добавь блок лампы и выбери цвет.' },
    sound: { ok: 'Звуков: {n}.', fail: 'Звуков: {n}, а нужно {min}.', hint: 'Добавь блок звука.' },
    displayed: { ok: 'На экране было «{text}».', fail: 'На экране не было «{text}».', hint: 'Добавь блок экрана и напиши нужное.' },
    usesBlock: { ok: 'Блок «{op}» есть.', fail: 'Нужен блок «{op}».', hint: 'Найди этот блок внизу и нажми на него.' },
    maxBlocks: { ok: 'Коротко: {n} блоков.', fail: 'Блоков {n}, а можно не больше {max}.', hint: 'Какие блоки повторяются? Подойдёт блок «Повторять».' },
  },
  kk: {
    motorRan: { ok: 'Мотор айналды.', fail: 'Мотор аз айналды немесе басқа жаққа айналды.', hint: 'Көбірек секунд керек пе? Әлде басқа бағыт па?' },
    motorTime: { ok: 'Мотор {s} с айналды.', fail: 'Мотор {s} с айналды, ал {target} с керек.', hint: 'Мотордың барлық блоктарындағы секундтарды сана.' },
    roverInZone: { ok: 'Вжик «{zone}» нысанасында тоқтады.', fail: 'Аз қалды! Вжик «{zone}» нысанасында тоқтамады.', hint: 'Жетпеді ме? Көбірек секунд бер. Асып кетті ме? Азырақ бер.' },
    passZones: { ok: 'Вжик керекті жердің бәрінде болды.', fail: 'Вжик «{zone}» жеріне кірмеді.', hint: 'Вжиктің жолын қадам бойынша қара.' },
    stopBeforeObstacle: { ok: 'Вжик кедергінің дәл алдында тоқтады.', fail: 'Вжик алыста тоқтады немесе соғылды.', hint: 'Вжик датчик «жақын» дегенше күтсін.' },
    noCrash: { ok: 'Вжик ешнәрсеге соғылмады.', fail: 'Гүрс! Вжик соғылды.', hint: 'Ертерек тоқта: секундты азайт немесе датчикті күт.' },
    returnedToStart: { ok: 'Вжик үйіне қайтты.', fail: 'Вжик бастауға қайтпады.', hint: 'Артқа алға қанша жүрсе, сонша жүру керек.' },
    spinnerTurns: { ok: 'Айналғыш {n} айн. жасады.', fail: 'Айналғыш {n} айн. жасады, ал {target} керек.', hint: 'Мотор ұзағырақ немесе күштірек айналсын.' },
    liftAt: { ok: 'Ілгек {level}-деңгейде.', fail: 'Ілгек {level}-деңгейде тоқтамады.', hint: 'Секундты таңда: жоғары ма, төмен бе?' },
    reactsTo: { ok: 'Робот датчикке жауап береді.', fail: 'Робот датчикке уақытында жауап бермеді.', hint: 'Әрекеттің алдына «датчикті күту» блогын қой.' },
    light: { ok: 'Шам жанды: {color}.', fail: 'Шам «{color}» түспен жанбады.', hint: 'Шам блогын қосып, түсін таңда.' },
    sound: { ok: 'Дыбыстар: {n}.', fail: 'Дыбыстар: {n}, ал {min} керек.', hint: 'Дыбыс блогын қос.' },
    displayed: { ok: 'Экранда «{text}» болды.', fail: 'Экранда «{text}» болмады.', hint: 'Экран блогын қосып, керек сөзді жаз.' },
    usesBlock: { ok: '«{op}» блогы бар.', fail: '«{op}» блогы керек.', hint: 'Бұл блокты төменнен тауып, басып көр.' },
    maxBlocks: { ok: 'Қысқа: {n} блок.', fail: 'Блоктар {n}, ал {max}-тан аспауы керек.', hint: 'Қай блоктар қайталанады? «Қайталау» блогы келеді.' },
  },
  en: {
    motorRan: { ok: 'The motor turned.', fail: 'The motor turned too little or the wrong way.', hint: 'More seconds? Or the other direction?' },
    motorTime: { ok: 'The motor ran {s} s.', fail: 'The motor ran {s} s, but it should be {target} s.', hint: 'Add up the seconds in all the motor blocks.' },
    roverInZone: { ok: 'Zip stopped at “{zone}”.', fail: 'Almost! Zip did not stop at “{zone}”.', hint: 'Too short? Give more seconds. Too far? Give fewer.' },
    passZones: { ok: 'Zip visited every place.', fail: 'Zip missed “{zone}”.', hint: 'Follow Zip’s trip step by step.' },
    stopBeforeObstacle: { ok: 'Zip stopped right in front of it.', fail: 'Zip stopped too far away or hit it.', hint: 'Let Zip wait until the sensor says “near”.' },
    noCrash: { ok: 'Zip did not hit anything.', fail: 'Bump! Zip hit something.', hint: 'Stop sooner: fewer seconds, or wait for the sensor.' },
    returnedToStart: { ok: 'Zip came back home.', fail: 'Zip did not come back to the start.', hint: 'Drive back as long as you drove forward.' },
    spinnerTurns: { ok: 'The spinner made {n} turns.', fail: 'The spinner made {n} turns, but it needs {target}.', hint: 'Let the motor run longer or stronger.' },
    liftAt: { ok: 'The hook is at level {level}.', fail: 'The hook did not stop at level {level}.', hint: 'Change the seconds: higher or lower?' },
    reactsTo: { ok: 'The robot answers the sensor.', fail: 'The robot did not answer the sensor in time.', hint: 'Put a “wait for sensor” block before the action.' },
    light: { ok: 'The light was {color}.', fail: 'The light was never {color}.', hint: 'Add a light block and pick the colour.' },
    sound: { ok: 'Sounds: {n}.', fail: 'Sounds: {n}, but it needs {min}.', hint: 'Add a sound block.' },
    displayed: { ok: 'The screen showed “{text}”.', fail: 'The screen never showed “{text}”.', hint: 'Add a screen block and type it.' },
    usesBlock: { ok: 'The “{op}” block is there.', fail: 'You need the “{op}” block.', hint: 'Find it below and tap it.' },
    maxBlocks: { ok: 'Short: {n} blocks.', fail: '{n} blocks, but at most {max}.', hint: 'Which blocks repeat? Try the Repeat block.' },
  },
}

const EPS = 1e-6

/** When each action happened: motor starts and stops are changes of the motor state, not every motor event. */
function actionTimes(events: WedoEvent[], action: Extract<WedoCheck, { type: 'reactsTo' }>['action'], color?: string): number[] {
  const out: number[] = []
  let on = false
  for (const e of events) {
    if (e.kind === 'motor') {
      const running = e.on && e.power > 0
      if (action === 'motorStart' && running && !on) out.push(e.t)
      if (action === 'motorStop' && !running && on) out.push(e.t)
      on = running
    }
    if (action === 'light' && e.kind === 'light' && (color ? e.color === color : e.color !== 'off')) out.push(e.t)
    if (action === 'sound' && e.kind === 'sound') out.push(e.t)
  }
  return out
}

/** Sensor events the program answered: the action follows within the window and did not already happen just before. */
export function reactionCount(sim: WedoResult, c: Extract<WedoCheck, { type: 'reactsTo' }>): number {
  const actions = actionTimes(sim.events, c.action, c.color)
  const triggers = sim.events.filter((e) => e.kind === 'sensor' && e.sensor === c.sensor && (c.state === undefined || e.state === c.state))
  return triggers.filter((e) => {
    const after = actions.some((t) => t >= e.t - EPS && t <= e.t + c.withinSeconds + EPS)
    const before = actions.some((t) => t >= e.t - c.withinSeconds - EPS && t < e.t - 0.005)
    return after && !before
  }).length
}

function shifted(scenario: WedoScenario, by: number): WedoScenario {
  return scenario.map((e) => ({ ...e, at: Math.min(30, e.at + by) }))
}

export function runWedoChecks(steps: WedoStep[], scene: WedoScene, checks: WedoCheck[], lang: Lang, scenario: WedoScenario = []): WedoCheckReport {
  const sim = simulateWedo(steps, scene, { scenario })
  const needsLate = checks.some((c) => c.type === 'reactsTo')
  const late = needsLate ? simulateWedo(steps, scene, { scenario: shifted(scenario, REACTION_SHIFT) }) : null
  const T = TEXT[lang]
  const words = getWedoText(lang)
  const { end, events, trace } = sim
  const blocks = wedoBlocks(steps)
  const front = end.x + ROVER_LENGTH / 2

  const results = checks.map((c): WedoCheckResult => {
    const say = (ok: boolean, vars: Record<string, string | number> = {}): WedoCheckResult => ({
      type: c.type,
      ok,
      message: fill(ok ? T[c.type].ok : T[c.type].fail, vars),
      hint: ok ? undefined : T[c.type].hint,
    })
    switch (c.type) {
      case 'motorRan': {
        const s = c.direction ? end.motorSeconds[c.direction] : end.motorSeconds.this + end.motorSeconds.that
        return say(s >= (c.minSeconds ?? 0.05) - 0.02)
      }
      case 'motorTime': {
        const s = end.motorSeconds.this + end.motorSeconds.that
        return say(Math.abs(s - c.seconds) <= c.tolerance + EPS, { s: Math.round(s * 10) / 10, target: c.seconds })
      }
      case 'roverInZone':
        return say(inZone(scene, c.zone, end.x), { zone: zoneLabel(scene, c.zone, lang) })
      case 'passZones': {
        const entered: string[] = []
        const ids = scene.model === 'rover' ? scene.zones.map((z) => z.id) : []
        let inside = new Set<string>()
        for (const f of trace) {
          const now = new Set(ids.filter((id) => inZone(scene, id, f.x)))
          for (const id of now) if (!inside.has(id)) entered.push(id)
          inside = now
        }
        let missing: string | undefined
        if (c.ordered) {
          let k = 0
          for (const id of entered) if (id === c.zones[k]) k++
          missing = c.zones[k]
        } else missing = c.zones.find((z) => !entered.includes(z))
        return say(missing === undefined, { zone: missing ? zoneLabel(scene, missing, lang) : '' })
      }
      case 'stopBeforeObstacle': {
        const ahead = scene.model === 'rover' ? scene.obstacles.filter((o) => o.at >= front - 1).map((o) => o.at - front) : []
        const d = ahead.length ? Math.min(...ahead) : Infinity
        return say(!end.crashed && d <= c.maxMm && d >= 0)
      }
      case 'noCrash':
        return say(!end.crashed)
      case 'returnedToStart': {
        const start = scene.model === 'rover' ? scene.start : 0
        return say(Math.abs(end.x - start) <= c.toleranceMm && end.maxAway >= 150)
      }
      case 'spinnerTurns': {
        const n = c.direction ? end.spinTurns[c.direction] : end.spinTurns.this + end.spinTurns.that
        return say(n >= c.minTurns - 0.05, { n: Math.round(n * 10) / 10, target: c.minTurns })
      }
      case 'liftAt':
        return say(Math.abs(end.height - levelHeight(c.level)) <= c.toleranceMm, { level: c.level })
      case 'reactsTo': {
        const ok = reactionCount(sim, c) >= c.times && reactionCount(late!, c) >= c.times
        return say(ok)
      }
      case 'light':
        return say(
          events.some((e) => e.kind === 'light' && e.color === c.color),
          { color: words.colors[c.color] },
        )
      case 'sound': {
        const n = events.filter((e) => e.kind === 'sound').length
        return say(n >= c.min, { n, min: c.min })
      }
      case 'displayed': {
        const want = c.text.trim().toUpperCase()
        return say(
          events.some((e) => e.kind === 'display' && e.value.trim().toUpperCase() === want),
          { text: c.text },
        )
      }
      case 'usesBlock':
        return say(opCount(steps, c.op) >= c.min, { op: words.blocks[c.op] })
      case 'maxBlocks':
        return say(blocks <= c.max, { n: blocks, max: c.max })
    }
  })

  return { ok: results.every((r) => r.ok), results, sim, blocks }
}
