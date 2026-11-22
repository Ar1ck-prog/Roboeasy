/**
 * Automatic checks of code tasks: the program is run in the simulator and
 * the result is compared with the lesson's goals. The learner sees what
 * worked, what did not, and a hint — never a penalty.
 */

import { type ProgramFunction, type Step, countSteps, imagePixels } from '../dsl/types'
import type { SimField } from '../sim/field'
import { DISTANCE_RANGE_MM, type SimResult, simulate } from '../sim/interpreter'
import { fill } from '../i18n/config'
import type { Check, Localized } from './schema'

export type Lang = 'ru' | 'kk' | 'en'

export interface CheckResult {
  type: Check['type']
  ok: boolean
  /** What the learner sees, in their language. */
  message: string
  /** A nudge for a failed check. */
  hint?: string
}

export interface CheckReport {
  ok: boolean
  results: CheckResult[]
  sim: SimResult
  blocks: number
}

type Texts = Record<Check['type'], { ok: string; fail: string; hint: string }>

const TEXT: Record<Lang, Texts> = {
  ru: {
    finishInZone: { ok: 'Робот финишировал в зоне «{zone}».', fail: 'Робот остановился не в зоне «{zone}».', hint: 'Сравни: сколько ехать до зоны и сколько едет робот?' },
    passPoints: { ok: 'Робот проехал через все точки.', fail: 'Робот пропустил точку «{point}».', hint: 'Проследи путь по шагам: где робот сворачивает не туда?' },
    noCollision: { ok: 'Ни одного столкновения.', fail: 'Робот врезался в стену.', hint: 'Уменьши расстояние или поверни раньше.' },
    timeLimit: { ok: 'Уложился во время: {time} с.', fail: 'Слишком долго: {time} с, нужно не больше {limit} с.', hint: 'Попробуй увеличить скорость.' },
    usesOp: { ok: 'Использован нужный блок.', fail: 'В программе нет нужного блока: «{op}».', hint: 'Загляни в палитру блоков: какой блок подходит для этого?' },
    maxBlocks: { ok: 'Коротко: {n} блоков.', fail: 'Слишком много блоков: {n}, нужно не больше {max}.', hint: 'Какие блоки повторяются? Их можно объединить.' },
    usesSensor: { ok: 'Робот использует датчик.', fail: 'Робот не использует датчик.', hint: 'Нужен блок, который ждёт сигнала от датчика.' },
    displayed: { ok: 'На экране хаба есть картинка.', fail: 'На экране хаба нет нужной картинки или числа.', hint: 'Добавь блок «показать».' },
    beeped: { ok: 'Робот подал сигнал.', fail: 'Робот не подал сигнал.', hint: 'Добавь блок «сигнал».' },
    motorTurned: { ok: 'Мотор {port} повернулся на {deg}°.', fail: 'Мотор {port} повернулся на {deg}°, а нужно {target}°.', hint: 'Один оборот — это 360°.' },
    heading: { ok: 'Робот смотрит в нужную сторону.', fail: 'Робот смотрит не туда: {deg}° вместо {target}°.', hint: 'Проверь направление и угол поворота.' },
    waitInZone: { ok: 'Робот подождал в зоне «{zone}».', fail: 'Робот не подождал {s} с в зоне «{zone}».', hint: 'Где в программе пауза? Робот должен стоять в зоне.' },
    stopBeforeWall: { ok: 'Робот остановился в {cm} см от стены.', fail: 'Робот остановился не перед стеной (нужно ближе {max} см и не касаясь).', hint: 'Пусть робот ждёт, пока датчик расстояния не увидит стену близко.' },
    moved: { ok: 'Робот поехал.', fail: 'Робот почти не сдвинулся.', hint: 'Добавь блок движения.' },
  },
  kk: {
    finishInZone: { ok: 'Робот «{zone}» аймағында мәреге жетті.', fail: 'Робот «{zone}» аймағында тоқтамады.', hint: 'Салыстыр: аймаққа дейін қанша жүру керек, ал робот қанша жүреді?' },
    passPoints: { ok: 'Робот барлық нүктелерден өтті.', fail: 'Робот «{point}» нүктесін өткізіп алды.', hint: 'Жолды қадам бойынша қара: робот қай жерде басқа жаққа бұрылады?' },
    noCollision: { ok: 'Бірде-бір соқтығысу жоқ.', fail: 'Робот қабырғаға соғылды.', hint: 'Қашықтықты азайт немесе ертерек бұрыл.' },
    timeLimit: { ok: 'Уақытқа сыйды: {time} с.', fail: 'Тым ұзақ: {time} с, {limit} с-тан аспауы керек.', hint: 'Жылдамдықты арттырып көр.' },
    usesOp: { ok: 'Керекті блок қолданылды.', fail: 'Бағдарламада керекті блок жоқ: «{op}».', hint: 'Блоктар палитрасына қара: бұған қай блок сай келеді?' },
    maxBlocks: { ok: 'Қысқа: {n} блок.', fail: 'Блоктар тым көп: {n}, {max}-тан аспауы керек.', hint: 'Қай блоктар қайталанады? Оларды біріктіруге болады.' },
    usesSensor: { ok: 'Робот датчикті қолданады.', fail: 'Робот датчикті қолданбайды.', hint: 'Датчиктің белгісін күтетін блок керек.' },
    displayed: { ok: 'Хаб экранында сурет бар.', fail: 'Хаб экранында керекті сурет немесе сан жоқ.', hint: '«Көрсету» блогын қос.' },
    beeped: { ok: 'Робот дыбыс берді.', fail: 'Робот дыбыс бермеді.', hint: '«Дыбыс» блогын қос.' },
    motorTurned: { ok: '{port} моторы {deg}° бұрылды.', fail: '{port} моторы {deg}° бұрылды, ал {target}° керек.', hint: 'Бір айналым — 360°.' },
    heading: { ok: 'Робот керекті жаққа қарап тұр.', fail: 'Робот басқа жаққа қарап тұр: {target}° орнына {deg}°.', hint: 'Бұрылыс бағыты мен бұрышын тексер.' },
    waitInZone: { ok: 'Робот «{zone}» аймағында күтті.', fail: 'Робот «{zone}» аймағында {s} с күтпеді.', hint: 'Бағдарламада үзіліс қай жерде? Робот аймақта тұруы керек.' },
    stopBeforeWall: { ok: 'Робот қабырғадан {cm} см жерде тоқтады.', fail: 'Робот қабырғаның алдында тоқтамады ({max} см-ден жақын және тимей тоқтау керек).', hint: 'Қашықтық датчигі қабырғаны жақын көргенше робот күтсін.' },
    moved: { ok: 'Робот жүрді.', fail: 'Робот орнынан қозғалмады дерлік.', hint: 'Қозғалыс блогын қос.' },
  },
  en: {
    finishInZone: { ok: 'The robot finished in the “{zone}” zone.', fail: 'The robot did not stop in the “{zone}” zone.', hint: 'Compare: how far is the zone, and how far does the robot drive?' },
    passPoints: { ok: 'The robot passed through every point.', fail: 'The robot missed point “{point}”.', hint: 'Follow the path step by step: where does the robot turn the wrong way?' },
    noCollision: { ok: 'No collisions.', fail: 'The robot hit a wall.', hint: 'Drive a shorter distance or turn earlier.' },
    timeLimit: { ok: 'In time: {time} s.', fail: 'Too slow: {time} s, the limit is {limit} s.', hint: 'Try a higher speed.' },
    usesOp: { ok: 'The right block is used.', fail: 'The program is missing a block: “{op}”.', hint: 'Look through the block palette: which block fits here?' },
    maxBlocks: { ok: 'Short: {n} blocks.', fail: 'Too many blocks: {n}, use at most {max}.', hint: 'Which blocks repeat? They can be combined.' },
    usesSensor: { ok: 'The robot uses a sensor.', fail: 'The robot does not use a sensor.', hint: 'You need a block that waits for a sensor.' },
    displayed: { ok: 'The hub shows a picture.', fail: 'The hub does not show the right picture or number.', hint: 'Add a “show” block.' },
    beeped: { ok: 'The robot beeped.', fail: 'The robot did not beep.', hint: 'Add a “beep” block.' },
    motorTurned: { ok: 'Motor {port} turned {deg}°.', fail: 'Motor {port} turned {deg}°, but it should be {target}°.', hint: 'One rotation is 360°.' },
    heading: { ok: 'The robot faces the right way.', fail: 'The robot faces {deg}° instead of {target}°.', hint: 'Check the turn direction and angle.' },
    waitInZone: { ok: 'The robot waited in the “{zone}” zone.', fail: 'The robot did not wait {s} s in the “{zone}” zone.', hint: 'Where is the pause in your program? The robot should be standing in the zone.' },
    stopBeforeWall: { ok: 'The robot stopped {cm} cm from the wall.', fail: 'The robot did not stop in front of the wall (closer than {max} cm, without touching it).', hint: 'Let the robot wait until the distance sensor sees the wall close by.' },
    moved: { ok: 'The robot moved.', fail: 'The robot hardly moved.', hint: 'Add a movement block.' },
  },
}

/** Block names for messages ("missing a … block"). */
const OP_NAMES: Record<Lang, Partial<Record<Step['op'], string>>> = {
  ru: { repeat: 'повторить', forever: 'повторять всегда', repeat_until: 'повторять, пока не', if: 'если', wait_until: 'ждать, пока', move: 'ехать', turn: 'развернуться', wait: 'ждать', beep: 'сигнал', show_image: 'показать', set_speed: 'скорость движения', start_move: 'начать движение', stop_move: 'остановить движение', motor_run: 'мотор', call: 'выполнить блок', set_var: 'задать переменную', change_var: 'изменить переменную', write_var: 'показать переменную', while: 'повторять, пока', reset_yaw: 'сбросить угол', motor_to_position: 'мотор в позицию', arc: 'ехать по дуге' },
  kk: { repeat: 'қайталау', forever: 'әрдайым қайталау', repeat_until: 'дейін қайталау', if: 'егер', wait_until: 'күту, дейін', move: 'жүру', turn: 'бұрылу', wait: 'күту', beep: 'дыбыс', show_image: 'көрсету', set_speed: 'қозғалыс жылдамдығы', start_move: 'қозғалысты бастау', stop_move: 'қозғалысты тоқтату', motor_run: 'мотор', call: 'блокты орындау', set_var: 'айнымалыны орнату', change_var: 'айнымалыны өзгерту', write_var: 'айнымалыны көрсету', while: 'әзірге қайталау', reset_yaw: 'бұрышты нөлдеу', motor_to_position: 'мотор позицияға', arc: 'доғамен жүру' },
  en: { repeat: 'repeat', forever: 'forever', repeat_until: 'repeat until', if: 'if', wait_until: 'wait until', move: 'move', turn: 'turn', wait: 'wait', beep: 'beep', show_image: 'show', set_speed: 'set movement speed', start_move: 'start moving', stop_move: 'stop moving', motor_run: 'motor', call: 'run block', set_var: 'set variable', change_var: 'change variable', write_var: 'show variable', while: 'repeat while', reset_yaw: 'reset yaw', motor_to_position: 'motor to position', arc: 'drive an arc' },
}

const inRect = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number }) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h
const angleDiff = (a: number, b: number) => Math.abs((((a - b) % 360) + 540) % 360 - 180)

/** Distance from the robot's front to the wall straight ahead at the end, mm. */
function frontGap(sim: SimResult, field: SimField): number | null {
  const RAD = Math.PI / 180
  const d = { x: Math.cos(sim.final.heading * RAD), y: Math.sin(sim.final.heading * RAD) }
  const o = { x: sim.final.x + d.x * 85, y: sim.final.y + d.y * 85 }
  let best = Infinity
  const rects = field.border ? [...field.walls, { x: 0, y: 0, w: field.width, h: field.height }] : field.walls
  for (const r of rects) {
    const edges: [number, number, number, number][] = [
      [r.x, r.y, r.x + r.w, r.y],
      [r.x + r.w, r.y, r.x + r.w, r.y + r.h],
      [r.x + r.w, r.y + r.h, r.x, r.y + r.h],
      [r.x, r.y + r.h, r.x, r.y],
    ]
    for (const [ax, ay, bx, by] of edges) {
      const ex = bx - ax
      const ey = by - ay
      const den = d.x * ey - d.y * ex
      if (Math.abs(den) < 1e-9) continue
      const t = ((ax - o.x) * ey - (ay - o.y) * ex) / den
      const u = ((ax - o.x) * d.y - (ay - o.y) * d.x) / den
      if (t >= 0 && u >= 0 && u <= 1) best = Math.min(best, t)
    }
  }
  return best <= DISTANCE_RANGE_MM ? best : null
}

/** Blocks in the program, own blocks included (their hat counts as one). */
export function programBlocks(steps: Step[], functions: ProgramFunction[] = []): number {
  return countSteps(steps) + functions.reduce((n, f) => n + 1 + countSteps(f.steps), 0)
}

/** Runs the program (with its own blocks, if any) and evaluates every check. */
export function runChecks(
  steps: Step[],
  field: SimField,
  checks: Check[],
  lang: Lang,
  zoneLabel: (id: string) => string = (id) => id,
  functions: ProgramFunction[] = [],
): CheckReport {
  const sim = simulate(steps, field, { functions })
  const T = TEXT[lang]
  const blocks = programBlocks(steps, functions)
  const results = checks.map((c): CheckResult => {
    const say = (ok: boolean, vars: Record<string, string | number> = {}): CheckResult => ({
      type: c.type,
      ok,
      message: fill(ok ? T[c.type].ok : T[c.type].fail, vars),
      hint: ok ? undefined : T[c.type].hint,
    })
    switch (c.type) {
      case 'finishInZone': {
        const zone = field.zones.find((z) => z.id === c.zone)
        return say(!!zone && inRect(sim.final, zone), { zone: zoneLabel(c.zone) })
      }
      case 'passPoints': {
        let from = 0
        for (const id of c.points) {
          const p = field.points.find((q) => q.id === id)
          if (!p) return say(false, { point: id })
          const near = (t: { x: number; y: number }) => Math.hypot(t.x - p.x, t.y - p.y) <= p.r
          const idx = c.ordered ? sim.trace.findIndex((t, i) => i >= from && near(t)) : sim.trace.findIndex(near)
          if (idx < 0) return say(false, { point: p.label ? p.label[lang] : id })
          if (c.ordered) from = idx
        }
        return say(true)
      }
      case 'noCollision':
        return say(sim.collisions === 0)
      case 'timeLimit': {
        const time = Math.round(sim.final.t * 10) / 10
        return say(!sim.timedOut && sim.final.t <= c.seconds + 1e-6, { time, limit: c.seconds })
      }
      case 'usesOp': {
        let n = 0
        const walk = (list: Step[]) => {
          for (const s of list) {
            if (s.op === c.op) n++
            if ('steps' in s) walk(s.steps)
            if (s.op === 'if') {
              walk(s.then)
              if (s.else) walk(s.else)
            }
          }
        }
        walk(steps)
        for (const f of functions) walk(f.steps)
        return say(n >= c.min, { op: OP_NAMES[lang][c.op] ?? c.op })
      }
      case 'maxBlocks':
        return say(blocks <= c.max, { n: blocks, max: c.max })
      case 'usesSensor':
        return say(sim.sensorsUsed.includes(c.sensor))
      case 'displayed': {
        const want = c.image ? imagePixels(c.image) : null
        const shown = sim.events.some(
          (e) => e.kind === 'display' && (c.text !== undefined ? e.text === c.text : want ? e.pixels === want : e.pixels !== null || !!e.text),
        )
        return say(shown, { text: c.text ?? '' })
      }
      case 'beeped':
        return say(sim.events.filter((e) => e.kind === 'beep').length >= c.min)
      case 'motorTurned': {
        const deg = Math.round(Math.abs(sim.motorAngles[c.port] ?? 0))
        return say(Math.abs(deg - Math.abs(c.degrees)) <= c.tolerance, { port: c.port, deg, target: Math.abs(c.degrees) })
      }
      case 'heading': {
        const deg = Math.round(sim.final.heading)
        return say(angleDiff(sim.final.heading, c.degrees) <= c.tolerance, { deg, target: c.degrees })
      }
      case 'waitInZone': {
        const zone = field.zones.find((z) => z.id === c.zone)
        const ok = !!zone && sim.events.some((e) => e.kind === 'wait' && e.seconds >= c.seconds - 1e-6 && inRect(e, zone))
        return say(ok, { zone: zoneLabel(c.zone), s: c.seconds })
      }
      case 'stopBeforeWall': {
        const gap = frontGap(sim, field)
        const ok = sim.collisions === 0 && gap !== null && gap <= c.maxMm
        return say(ok, { cm: gap === null ? '—' : Math.round(gap / 10), max: Math.round(c.maxMm / 10) })
      }
      case 'moved':
        return say(sim.distanceTravelled >= c.minMm)
    }
  })
  return { ok: results.every((r) => r.ok), results, sim, blocks }
}

export function localize(text: Localized, lang: Lang): string {
  return text[lang]
}
