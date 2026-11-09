/**
 * Ready programs that work without the AI: shown when it is resting or not
 * connected. They go through the same compilers as generated programs.
 */

import type { Lang } from '@/lib/spike/prompts'

import type { Program, Step } from './types'

export interface LocalExample {
  id: string
  title: Record<Lang, string>
  description: Record<Lang, string>
  steps: Step[]
}

// TODO: проверить перевод (kk)
export const LOCAL_EXAMPLES: readonly LocalExample[] = [
  {
    id: 'smile',
    title: { ru: 'Вперёд и улыбка', kk: 'Алға және күлкі', en: 'Forward and smile' },
    description: { ru: 'Робот проезжает 20 см, поворачивает направо и улыбается.', kk: 'Робот 20 см жүріп, оңға бұрылады да, күледі.', en: 'The robot drives 20 cm, turns right and smiles.' },
    steps: [
      { op: 'move', direction: 'forward', value: 20, unit: 'cm' },
      { op: 'turn', direction: 'right', degrees: 90 },
      { op: 'show_image', image: 'smile', seconds: 2 },
    ],
  },
  {
    id: 'square',
    title: { ru: 'Квадрат', kk: 'Шаршы', en: 'Square' },
    description: { ru: 'Робот едет по квадрату со стороной 30 см.', kk: 'Робот қабырғасы 30 см шаршымен жүреді.', en: 'The robot drives along a square with 30 cm sides.' },
    steps: [
      {
        op: 'repeat',
        times: 4,
        steps: [
          { op: 'move', direction: 'forward', value: 30, unit: 'cm' },
          { op: 'turn', direction: 'right', degrees: 90 },
        ],
      },
    ],
  },
  {
    id: 'circle',
    title: { ru: 'Круг', kk: 'Шеңбер', en: 'Circle' },
    description: { ru: 'Робот проезжает полный круг, плавно поворачивая.', kk: 'Робот бірқалыпты бұрылып, толық шеңбер жасайды.', en: 'The robot drives one full circle, turning smoothly.' },
    steps: [{ op: 'steer', steering: 22, value: 160, unit: 'cm' }],
  },
  {
    id: 'wall',
    title: { ru: 'Стоп у стены', kk: 'Қабырға алдында тоқта', en: 'Stop at the wall' },
    description: { ru: 'Робот едет, пока стена не окажется ближе 10 см, и пищит.', kk: 'Робот қабырға 10 см-ге жақындағанша жүріп, дыбыс шығарады.', en: 'The robot drives until the wall is closer than 10 cm, then beeps.' },
    steps: [
      { op: 'set_speed', speed: 40 },
      { op: 'start_move', direction: 'forward' },
      { op: 'wait_until', condition: { sensor: 'distance', port: 'C', comparator: '<', value: 10, unit: 'cm' } },
      { op: 'stop_move' },
      { op: 'beep', note: 72, seconds: 0.3 },
    ],
  },
  {
    id: 'line',
    title: { ru: 'Езда по линии', kk: 'Сызықпен жүру', en: 'Line following' },
    description: { ru: 'Робот держится края чёрной линии датчиком цвета.', kk: 'Робот түс датчигімен қара сызықтың шетін бойлайды.', en: 'The robot follows the edge of a black line with the color sensor.' },
    steps: [
      { op: 'set_speed', speed: 30 },
      {
        op: 'forever',
        steps: [
          {
            op: 'if',
            condition: { sensor: 'reflection', port: 'D', comparator: '<', value: 50 },
            then: [{ op: 'start_steer', steering: -30 }],
            else: [{ op: 'start_steer', steering: 30 }],
          },
        ],
      },
    ],
  },
  {
    id: 'song',
    title: { ru: 'Сердце и мелодия', kk: 'Жүрек пен әуен', en: 'Heart and tune' },
    description: { ru: 'Робот показывает сердечко и играет три ноты.', kk: 'Робот жүрек көрсетіп, үш нота ойнайды.', en: 'The robot shows a heart and plays three notes.' },
    steps: [
      { op: 'show_image', image: 'heart' },
      { op: 'beep', note: 60, seconds: 0.3 },
      { op: 'beep', note: 64, seconds: 0.3 },
      { op: 'beep', note: 67, seconds: 0.5 },
    ],
  },
]

export function exampleProgram(example: LocalExample, lang: Lang): Program {
  return { title: example.title[lang], description: example.description[lang], steps: example.steps }
}
