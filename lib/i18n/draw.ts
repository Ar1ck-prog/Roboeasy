/** Copy of the "draw a route" mode and the sandbox's mode switch. */

import type { Locale } from './config'

const ru = {
  tabs: { label: 'Режим песочницы', ai: 'Текст и ИИ', draw: 'Нарисуй маршрут' },
  title: 'Нарисуй маршрут',
  lead: 'Проведи линию мышкой или пальцем. Робот начинает с жёлтого квадрата, одна клетка — 10 см. ИИ тут не нужен: углы и расстояния считает сайт.',
  fieldLabel: 'Поле для рисования маршрута',
  precision: 'Точность',
  fewer: 'Меньше команд',
  closer: 'Ближе к рисунку',
  drive: 'Проехать в симуляторе',
  clear: 'Стереть',
  hitWall: 'Робот упёрся в край поля. Нарисуй маршрут подальше от края.',
  empty: 'Здесь появится программа, когда ты нарисуешь маршрут.',
  resultLabel: 'Программа маршрута',
  commands: 'Команд в программе: {n}',
  viewLabel: 'Вид программы',
  blocks: 'Блоки',
  driveFirst: 'Совет: сначала проедь маршрут в симуляторе — так видно, куда поедет робот.',
  ports: 'Моторы движения: левый {left}, правый {right}. Другие порты задаются в студии, в настройках робота.',
  programTitle: 'Мой маршрут',
}

export type DrawText = typeof ru

// TODO: проверить перевод
const kk: DrawText = {
  tabs: { label: 'Құмсалғыш режимі', ai: 'Мәтін және ЖИ', draw: 'Маршрут сыз' },
  title: 'Маршрут сыз',
  lead: 'Тінтуірмен немесе саусақпен сызық сыз. Робот сары шаршыдан басталады, бір тор — 10 см. Мұнда ЖИ керек емес: бұрыштар мен қашықтықты сайт есептейді.',
  fieldLabel: 'Маршрут сызатын алаң',
  precision: 'Дәлдік',
  fewer: 'Команда азырақ',
  closer: 'Суретке жақынырақ',
  drive: 'Симуляторда жүріп өту',
  clear: 'Өшіру',
  hitWall: 'Робот алаңның шетіне тірелді. Маршрутты шетінен алысырақ сыз.',
  empty: 'Маршрут сызғанда бағдарлама осында шығады.',
  resultLabel: 'Маршрут бағдарламасы',
  commands: 'Бағдарламадағы команда саны: {n}',
  viewLabel: 'Бағдарлама түрі',
  blocks: 'Блоктар',
  driveFirst: 'Кеңес: алдымен маршрутты симуляторда жүріп өт — робот қайда жүретіні көрінеді.',
  ports: 'Қозғалыс моторлары: сол {left}, оң {right}. Басқа порттар студияда, робот баптауларында беріледі.',
  programTitle: 'Менің маршрутым',
}

const en: DrawText = {
  tabs: { label: 'Sandbox mode', ai: 'Text and AI', draw: 'Draw a route' },
  title: 'Draw a route',
  lead: 'Draw a line with the mouse or your finger. The robot starts at the yellow square, one grid square is 10 cm. No AI here: the site works out the angles and distances.',
  fieldLabel: 'Field for drawing a route',
  precision: 'Precision',
  fewer: 'Fewer commands',
  closer: 'Closer to the drawing',
  drive: 'Drive in the simulator',
  clear: 'Erase',
  hitWall: 'The robot hit the edge of the field. Draw the route further from the edge.',
  empty: 'Your program will appear here once you draw a route.',
  resultLabel: 'Route program',
  commands: 'Commands in the program: {n}',
  viewLabel: 'Program view',
  blocks: 'Blocks',
  driveFirst: 'Tip: drive the route in the simulator first to see where the robot will go.',
  ports: 'Drive motors: left {left}, right {right}. Other ports are set in the studio, in the robot settings.',
  programTitle: 'My route',
}

const TEXT: Record<Locale, DrawText> = { ru, kk, en }

export const getDrawText = (lang: Locale): DrawText => TEXT[lang]
