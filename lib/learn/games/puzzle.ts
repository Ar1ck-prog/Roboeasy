/**
 * "Put the program together": the lines of a program are shuffled; tap them
 * in the right order. Lines with the same text are interchangeable, so the
 * answer is checked by text. Programs are written in plain words (and one
 * in Python-like pseudocode), not in a real robot API.
 */

import type { IconName } from '@/components/ui/anim-icon'

type L = { ru: string; kk: string; en: string }

export interface PuzzleLine {
  text: L
  indent: number
}

export interface PuzzleLevel {
  id: number
  icon: IconName
  title: L
  goal: L
  /** In the right order. */
  lines: PuzzleLine[]
}

const ln = (indent: number, ru: string, kk: string, en: string): PuzzleLine => ({ indent, text: { ru, kk, en } })
const START = ln(0, 'Когда программа запущена', 'Бағдарлама іске қосылғанда', 'When the program starts')

export const PUZZLES: PuzzleLevel[] = [
  {
    id: 1,
    icon: 'flag',
    title: { ru: 'До финиша', kk: 'Мәреге дейін', en: 'To the finish' },
    goal: {
      ru: 'Доехать до финиша в 40 см и посигналить, когда приехал.',
      kk: '40 см жердегі мәреге жетіп, келгенде дабыл бер.',
      en: 'Drive 40 cm to the finish and beep when you arrive.',
    },
    lines: [
      START,
      ln(0, 'Едь вперёд 40 см', '40 см алға жүр', 'Drive forward 40 cm'),
      ln(0, 'Остановись', 'Тоқта', 'Stop'),
      ln(0, 'Сыграй звук «бип»', '«Бип» дыбысын ойнат', 'Play the “beep” sound'),
    ],
  },
  {
    id: 2,
    icon: 'square',
    title: { ru: 'Квадрат', kk: 'Шаршы', en: 'Square' },
    goal: {
      ru: 'Проехать квадрат со стороной 20 см, используя цикл.',
      kk: 'Циклді қолданып, қабырғасы 20 см шаршы бойымен жүр.',
      en: 'Drive a 20 cm square using a loop.',
    },
    lines: [
      START,
      ln(0, 'Повторяй 4 раза:', '4 рет қайтала:', 'Repeat 4 times:'),
      ln(1, 'Едь вперёд 20 см', '20 см алға жүр', 'Drive forward 20 cm'),
      ln(1, 'Повернись направо на 90°', 'Оңға 90° бұрыл', 'Turn right 90°'),
    ],
  },
  {
    id: 3,
    icon: 'brick',
    title: { ru: 'Стоп у стены', kk: 'Қабырға алдында тоқта', en: 'Stop at the wall' },
    goal: {
      ru: 'Ехать вперёд, пока стена не ближе 10 см, остановиться и улыбнуться.',
      kk: 'Қабырға 10 см-ден жақын болғанша алға жүр, тоқтап, күлімде.',
      en: 'Drive until the wall is closer than 10 cm, then stop and smile.',
    },
    lines: [
      START,
      ln(0, 'Включи моторы вперёд', 'Моторларды алға қос', 'Start the motors forward'),
      ln(0, 'Жди, пока расстояние < 10 см', 'Қашықтық < 10 см болғанша күт', 'Wait until distance < 10 cm'),
      ln(0, 'Останови моторы', 'Моторларды тоқтат', 'Stop the motors'),
      ln(0, 'Покажи смайлик', 'Смайлик көрсет', 'Show a smiley'),
    ],
  },
  {
    id: 4,
    icon: 'traffic',
    title: { ru: 'Светофор', kk: 'Бағдаршам', en: 'Traffic light' },
    goal: {
      ru: 'Ждать зелёный, потом проехать 30 см и сыграть мелодию победы.',
      kk: 'Жасылды күтіп, 30 см жүріп, жеңіс әуенін ойнат.',
      en: 'Wait for green, drive 30 cm, then play a victory tune.',
    },
    lines: [
      START,
      ln(0, 'Покажи красный свет', 'Қызыл жарық көрсет', 'Show a red light'),
      ln(0, 'Жди, пока датчик увидит зелёный', 'Датчик жасылды көргенше күт', 'Wait until the sensor sees green'),
      ln(0, 'Едь вперёд 30 см', '30 см алға жүр', 'Drive forward 30 cm'),
      ln(0, 'Сыграй мелодию победы', 'Жеңіс әуенін ойнат', 'Play a victory tune'),
    ],
  },
  {
    id: 5,
    icon: 'arm',
    title: { ru: 'Захват кубика', kk: 'Текшені ұстау', en: 'Grab a cube' },
    goal: {
      ru: 'Открыть захват, подъехать к кубику, схватить и отвезти назад.',
      kk: 'Қармағышты ашып, текшеге жақында, ұстап, кері алып кел.',
      en: 'Open the grabber, drive to the cube, grab it and bring it back.',
    },
    lines: [
      START,
      ln(0, 'Открой захват', 'Қармағышты аш', 'Open the grabber'),
      ln(0, 'Едь вперёд 15 см', '15 см алға жүр', 'Drive forward 15 cm'),
      ln(0, 'Закрой захват', 'Қармағышты жап', 'Close the grabber'),
      ln(0, 'Едь назад 15 см', '15 см артқа жүр', 'Drive back 15 cm'),
    ],
  },
  {
    id: 6,
    icon: 'shuffle',
    title: { ru: 'По линии', kk: 'Сызық бойымен', en: 'Follow the line' },
    goal: {
      ru: 'Всё время ехать по краю чёрной линии: на чёрном подворачивать влево, иначе — вправо.',
      kk: 'Қара сызықтың шетімен үнемі жүр: қарада солға, әйтпесе оңға бұрыл.',
      en: 'Keep following the edge of a black line: on black steer left, otherwise right.',
    },
    lines: [
      START,
      ln(0, 'Повторяй всегда:', 'Әрқашан қайтала:', 'Repeat forever:'),
      ln(1, 'Если датчик видит чёрный:', 'Егер датчик қараны көрсе:', 'If the sensor sees black:'),
      ln(2, 'Подверни влево', 'Солға бұрыл', 'Steer left'),
      ln(1, 'Иначе:', 'Әйтпесе:', 'Otherwise:'),
      ln(2, 'Подверни вправо', 'Оңға бұрыл', 'Steer right'),
    ],
  },
  {
    id: 7,
    icon: 'numbers',
    title: { ru: 'Счётчик кругов', kk: 'Айналым санағышы', en: 'Lap counter' },
    goal: {
      ru: 'Проехать 3 круга и показать, сколько кругов проехал.',
      kk: '3 айналым жүріп, қанша айналым жүргеніңді көрсет.',
      en: 'Drive 3 laps and show how many laps you drove.',
    },
    lines: [
      START,
      ln(0, 'Задай «круги» = 0', '«Айналымдар» = 0 деп қой', 'Set “laps” to 0'),
      ln(0, 'Повторяй 3 раза:', '3 рет қайтала:', 'Repeat 3 times:'),
      ln(1, 'Проедь круг', 'Бір айналым жүр', 'Drive a lap'),
      ln(1, 'Увеличь «круги» на 1', '«Айналымдарды» 1-ге арттыр', 'Change “laps” by 1'),
      ln(0, 'Покажи «круги» на экране', '«Айналымдарды» экранда көрсет', 'Show “laps” on the screen'),
    ],
  },
  {
    id: 8,
    icon: 'snake',
    title: { ru: 'Квадрат на Python', kk: 'Python-дағы шаршы', en: 'A square in Python' },
    goal: {
      ru: 'Тот же квадрат, но в псевдокоде Python: цикл for и отступы.',
      kk: 'Сол шаршы, бірақ Python псевдокодында: for циклі және шегіністер.',
      en: 'The same square in Python-like pseudocode: a for loop and indentation.',
    },
    lines: [
      ln(0, 'for i in range(4):', 'for i in range(4):', 'for i in range(4):'),
      ln(1, 'move(20)', 'move(20)', 'move(20)'),
      ln(1, 'turn_right(90)', 'turn_right(90)', 'turn_right(90)'),
      ln(0, "print('Готово!')", "print('Дайын!')", "print('Done!')"),
    ],
  },
]

/** Stars by mistakes (wrong checks). */
export function puzzleStars(mistakes: number): number {
  return mistakes === 0 ? 3 : mistakes === 1 ? 2 : 1
}

/** A deterministic shuffle that is never the answer itself (when the lines differ). */
export function shuffledOrder(n: number, seed: number): number[] {
  const order = Array.from({ length: n }, (_, i) => i)
  let s = seed * 9301 + 49297
  for (let i = n - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280
    const j = Math.floor((s / 233280) * (i + 1))
    ;[order[i], order[j]] = [order[j], order[i]]
  }
  if (order.every((v, i) => v === i) && n > 1) order.push(order.shift()!)
  return order
}

/** Index of the first misplaced line, or -1 when the program is right. */
export function firstMistake(level: PuzzleLevel, picked: number[], lang: keyof L): number {
  for (let i = 0; i < level.lines.length; i++) {
    const want = level.lines[i]
    const got = picked[i] === undefined ? undefined : level.lines[picked[i]]
    if (!got || got.text[lang] !== want.text[lang] || got.indent !== want.indent) return i
  }
  return -1
}
