/**
 * Copy of the FLL field simulator (/[lang]/compete/simulator): our own
 * top-down simulator on the season field, with the mat picture the team
 * uploads (shared with the FLL coach). Kazakh needs a review by a native
 * speaker before launch.
 */

import type { Locale } from './config'

const ru = {
  eyebrow: 'Соревнования · симулятор',
  title: 'Симулятор поля FLL',
  lead: 'Поле BIOGLOW (сезон 2026/27): собери заезд из миссий или блоков, запусти робота на поле, засекай матч 2:30 и считай очки по правилам сезона.',
  promo: { title: 'Симулятор поля BIOGLOW', text: 'Запусти заезды на поле, засеки матч 2:30 и посчитай очки по правилам сезона.', cta: 'Открыть симулятор' },
  // Mat picture
  matTitle: 'Картинка поля',
  matUpload: 'Загрузить мат',
  matNone: 'Сейчас поле нарисовано схемой. Загрузи картинку мата — она появится и здесь, и в FLL-тренере.',
  matHas: 'Картинка мата загружена — она общая с FLL-тренером.',
  // Toolbar
  training: 'Тренировка',
  match: 'Матч',
  startMatch: 'Старт 2:30',
  newMatch: 'Новый матч',
  timeUp: 'Время вышло! Матч окончен.',
  speed: 'Скорость',
  base: 'База',
  toStart: 'На старт',
  // Program
  program: 'Программа',
  fromMissions: 'Из миссий',
  blocks: 'Блоки',
  python: 'Python',
  missionsHint: 'Отметь миссии по порядку — заезд построится сам: подъезд, действие и возврат в базу.',
  noMissions: 'Выбери хотя бы одну миссию.',
  steps: 'Команд: {n}',
  run: 'Запустить',
  stop: 'Стоп',
  interrupt: 'Прервать',
  interruptHint: 'Прерывание вне базы стоит один жетон точности.',
  download: 'Скачать .llsp3',
  copy: 'Скопировать',
  copied: 'Скопировано',
  // Field
  field: 'Поле FLL BIOGLOW',
  driveHint: 'Нажми на поле и рули: WASD или стрелки — езда, Shift — медленно. Робота можно перетащить мышью, колесо мыши поворачивает.',
  robot: 'Робот',
  running: 'Робот выполняет программу',
  outOfTime: 'Матч не идёт: нажми «Старт 2:30» или переключись на тренировку.',
  // Score
  score: 'Протокол очков',
  scoreHint: 'Отмечай, что получилось на поле, — очки считаются по правилам сезона.',
  resetField: 'Сбросить поле',
  yes: 'Да',
  no: 'Нет',
  noEquipment: 'Модель не должна касаться робота в конце матча',
  total: 'Итого',
  final: 'Итог матча',
  // Footer
  toPlanner: 'Спланировать заезды в FLL-тренере',
  credit:
    'Миссии, очки и раскладка поля внесены по 3D-симулятору fll-bioglow-sim и правилам сезона BIOGLOW; сверяйся с официальным Robot Game Rulebook. Картинка мата хранится только в твоём браузере.',
}

export type SimulatorText = typeof ru

const kk: SimulatorText = {
  eyebrow: 'Жарыстар · симулятор',
  title: 'FLL алаңының симуляторы',
  lead: 'BIOGLOW алаңы (2026/27 маусымы): миссиялардан не блоктардан заезд құрастыр, роботты алаңда іске қос, 2:30 матчты өлше және маусым ережесі бойынша ұпай сана.',
  promo: {
    title: 'BIOGLOW алаңының симуляторы',
    text: 'Заездерді алаңда іске қос, 2:30 матчты өлше және маусым ережесі бойынша ұпай сана.',
    cta: 'Симуляторды ашу',
  },
  matTitle: 'Алаң суреті',
  matUpload: 'Матты жүктеу',
  matNone: 'Қазір алаң сызба түрінде. Мат суретін жүкте — ол осында да, FLL-жаттықтырушыда да пайда болады.',
  matHas: 'Мат суреті жүктелді — ол FLL-жаттықтырушымен ортақ.',
  training: 'Жаттығу',
  match: 'Матч',
  startMatch: 'Старт 2:30',
  newMatch: 'Жаңа матч',
  timeUp: 'Уақыт бітті! Матч аяқталды.',
  speed: 'Жылдамдық',
  base: 'База',
  toStart: 'Стартқа',
  program: 'Бағдарлама',
  fromMissions: 'Миссиялардан',
  blocks: 'Блоктар',
  python: 'Python',
  missionsHint: 'Миссияларды ретімен белгіле — заезд өзі құрылады: жақындау, әрекет және базаға оралу.',
  noMissions: 'Кемінде бір миссияны таңда.',
  steps: 'Командалар: {n}',
  run: 'Іске қосу',
  stop: 'Тоқтату',
  interrupt: 'Үзу',
  interruptHint: 'Базадан тыс үзу бір дәлдік жетонын алады.',
  download: '.llsp3 жүктеу',
  copy: 'Көшіру',
  copied: 'Көшірілді',
  field: 'FLL BIOGLOW алаңы',
  driveHint: 'Алаңды басып, басқар: WASD не бағыттауыштар — жүру, Shift — баяу. Роботты тінтуірмен сүйреуге болады, тінтуір дөңгелегі бұрады.',
  robot: 'Робот',
  running: 'Робот бағдарламаны орындап жатыр',
  outOfTime: 'Матч жүріп жатқан жоқ: «Старт 2:30» бас немесе жаттығуға ауыс.',
  score: 'Ұпай хаттамасы',
  scoreHint: 'Алаңда не шыққанын белгіле — ұпай маусым ережесі бойынша есептеледі.',
  resetField: 'Алаңды қалпына келтіру',
  yes: 'Иә',
  no: 'Жоқ',
  noEquipment: 'Матч соңында модель роботқа тимеуі керек',
  total: 'Барлығы',
  final: 'Матч қорытындысы',
  toPlanner: 'Заездерді FLL-жаттықтырушыда жоспарлау',
  credit:
    'Миссиялар, ұпайлар мен алаң орналасуы fll-bioglow-sim 3D-симуляторы мен BIOGLOW маусымының ережелері бойынша енгізілген; ресми Robot Game Rulebook-пен салыстыр. Мат суреті тек сенің браузеріңде сақталады.',
}

const en: SimulatorText = {
  eyebrow: 'Competitions · simulator',
  title: 'FLL field simulator',
  lead: 'The BIOGLOW field (2026/27 season): build a run from missions or blocks, drive the robot on the field, time a 2:30 match and score it by the season rules.',
  promo: {
    title: 'BIOGLOW field simulator',
    text: 'Run your missions on the field, time a 2:30 match and score it by the season rules.',
    cta: 'Open the simulator',
  },
  matTitle: 'Field picture',
  matUpload: 'Upload the mat',
  matNone: 'The field is drawn as a diagram. Upload a picture of the mat: it shows up here and in the FLL coach.',
  matHas: 'Mat picture loaded; it is shared with the FLL coach.',
  training: 'Training',
  match: 'Match',
  startMatch: 'Start 2:30',
  newMatch: 'New match',
  timeUp: 'Time’s up! The match is over.',
  speed: 'Speed',
  base: 'Base',
  toStart: 'To start',
  program: 'Program',
  fromMissions: 'From missions',
  blocks: 'Blocks',
  python: 'Python',
  missionsHint: 'Tick missions in order and the run builds itself: approach, action and back to base.',
  noMissions: 'Pick at least one mission.',
  steps: 'Commands: {n}',
  run: 'Run',
  stop: 'Stop',
  interrupt: 'Interrupt',
  interruptHint: 'Interrupting outside the base costs one precision token.',
  download: 'Download .llsp3',
  copy: 'Copy',
  copied: 'Copied',
  field: 'FLL BIOGLOW field',
  driveHint: 'Click the field and drive: WASD or arrows, Shift is slow. Drag the robot with the mouse; the wheel turns it.',
  robot: 'Robot',
  running: 'The robot is running the program',
  outOfTime: 'No match running: press “Start 2:30” or switch to training.',
  score: 'Score sheet',
  scoreHint: 'Mark what happened on the field; points follow the season rules.',
  resetField: 'Reset field',
  yes: 'Yes',
  no: 'No',
  noEquipment: 'The model must not touch the robot at the end of the match',
  total: 'Total',
  final: 'Match result',
  toPlanner: 'Plan runs in the FLL coach',
  credit:
    'Missions, points and the field layout follow the fll-bioglow-sim 3D simulator and the BIOGLOW season rules; check the official Robot Game Rulebook. The mat picture stays in your browser.',
}

const TEXTS: Record<Locale, SimulatorText> = { ru, kk, en }

export function getSimulatorText(lang: Locale): SimulatorText {
  return TEXTS[lang]
}
