/**
 * Copy of the 3D FLL field simulator page (/[lang]/compete/simulator). The
 * simulator itself is an external project shown in a frame; RoboEasy does
 * not change it. Kazakh needs a review by a native speaker before launch.
 */

import type { Locale } from './config'

const ru = {
  eyebrow: 'Соревнования · 3D',
  title: '3D-симулятор поля FLL',
  lead: 'Поле BIOGLOW (сезон 2026/27) в 3D с физикой: пиши код робота на Python, собирай насадки и проверяй заезды на время — как на настоящем матче.',
  badges: ['3D и физика', 'Код на Python', 'Матч 2:30', 'Конструктор робота'],
  open: 'Открыть симулятор',
  newTab: 'В новой вкладке',
  fullscreen: 'На весь экран',
  reload: 'Перезагрузить',
  loading: 'Симулятор загружается…',
  loadingHint: 'Первый запуск может занять до минуты: сервер симулятора просыпается.',
  slow: 'Долго грузится? Откройте симулятор в новой вкладке — там он работает быстрее и полностью.',
  frame: '3D-симулятор поля FLL BIOGLOW',
  phone: 'Симулятор рассчитан на компьютер: нужны клавиатура и мышь. На телефоне удобнее открыть его в новой вкладке.',
  howTitle: 'Как пользоваться',
  how: [
    { title: 'Двигай робота', text: 'Перетащи робота мышью, колесо мыши поворачивает. Кнопка «На старт» вернёт его в базу.' },
    { title: 'Ручное управление', text: 'Щёлкни по полю: WASD или стрелки — езда, R/F — рука C, T/G — мотор D, Shift — медленно.' },
    { title: 'Код и матч', text: 'Во вкладке «Код» пиши программу на Python или возьми пример. Режим «Матч» — отсчёт 2:30 и протокол очков.' },
    { title: 'Камера и скорость', text: 'Смотри сверху, из базы или из-за робота; ускоряй и замедляй симуляцию от ¼× до 4×.' },
  ],
  tip: 'Сначала спланируй заезды в FLL-тренере, потом проверь их в симуляторе.',
  toPlanner: 'К FLL-тренеру',
  credit:
    'Симулятор — независимый проект, он не сделан и не изменяется RoboEasy. Поле и миссии — по версии авторов симулятора; сверяйся с официальными правилами сезона.',
  promo: { title: '3D-симулятор поля BIOGLOW', text: 'Проверь заезды на 3D-поле с физикой, кодом на Python и таймером матча.', cta: 'Открыть симулятор' },
}

export type SimulatorText = typeof ru

const kk: SimulatorText = {
  eyebrow: 'Жарыстар · 3D',
  title: 'FLL алаңының 3D-симуляторы',
  lead: 'BIOGLOW алаңы (2026/27 маусымы) 3D және физикамен: роботтың кодын Python-да жаз, саптамалар құрастыр және заездерді уақытқа тексер — нағыз матчтағыдай.',
  badges: ['3D және физика', 'Python-дағы код', 'Матч 2:30', 'Робот конструкторы'],
  open: 'Симуляторды ашу',
  newTab: 'Жаңа қойындыда',
  fullscreen: 'Толық экран',
  reload: 'Қайта жүктеу',
  loading: 'Симулятор жүктелуде…',
  loadingHint: 'Алғашқы іске қосу бір минутқа дейін созылуы мүмкін: симулятор сервері оянып жатыр.',
  slow: 'Ұзақ жүктеліп жатыр ма? Симуляторды жаңа қойындыда ашыңыз — онда ол жылдамырақ және толық жұмыс істейді.',
  frame: 'FLL BIOGLOW алаңының 3D-симуляторы',
  phone: 'Симулятор компьютерге арналған: пернетақта мен тінтуір керек. Телефонда оны жаңа қойындыда ашқан ыңғайлы.',
  howTitle: 'Қалай қолдану керек',
  how: [
    { title: 'Роботты жылжыт', text: 'Роботты тінтуірмен сүйре, тінтуір дөңгелегі бұрады. «Стартқа» батырмасы оны базаға қайтарады.' },
    { title: 'Қолмен басқару', text: 'Алаңды бас: WASD немесе бағыттауыштар — жүру, R/F — C қолы, T/G — D моторы, Shift — баяу.' },
    { title: 'Код және матч', text: '«Код» қойындысында Python-да бағдарлама жаз немесе мысал ал. «Матч» режимі — 2:30 кері санақ және ұпай хаттамасы.' },
    { title: 'Камера және жылдамдық', text: 'Жоғарыдан, базадан немесе роботтың артынан қара; симуляцияны ¼×-тен 4×-ке дейін жылдамдат не баяулат.' },
  ],
  tip: 'Алдымен заездерді FLL-жаттықтырушыда жоспарла, содан кейін симуляторда тексер.',
  toPlanner: 'FLL-жаттықтырушыға',
  credit:
    'Симулятор — тәуелсіз жоба, оны RoboEasy жасамаған және өзгертпейді. Алаң мен миссиялар — симулятор авторларының нұсқасы бойынша; маусымның ресми ережелерімен салыстыр.',
  promo: { title: 'BIOGLOW алаңының 3D-симуляторы', text: 'Заездерді физикасы, Python коды және матч таймері бар 3D-алаңда тексер.', cta: 'Симуляторды ашу' },
}

const en: SimulatorText = {
  eyebrow: 'Competitions · 3D',
  title: '3D FLL field simulator',
  lead: 'The BIOGLOW field (2026/27 season) in 3D with physics: write the robot’s code in Python, build attachments and time your runs like in a real match.',
  badges: ['3D and physics', 'Python code', '2:30 match', 'Robot builder'],
  open: 'Open the simulator',
  newTab: 'In a new tab',
  fullscreen: 'Full screen',
  reload: 'Reload',
  loading: 'Loading the simulator…',
  loadingHint: 'The first start can take up to a minute while the simulator’s server wakes up.',
  slow: 'Taking long? Open the simulator in a new tab: it runs faster and with every feature there.',
  frame: '3D simulator of the FLL BIOGLOW field',
  phone: 'The simulator is made for a computer with a keyboard and mouse. On a phone, open it in a new tab.',
  howTitle: 'How to use it',
  how: [
    { title: 'Move the robot', text: 'Drag the robot with the mouse; the wheel turns it. “To start” puts it back in base.' },
    { title: 'Drive by hand', text: 'Click the field: WASD or arrows drive, R/F move arm C, T/G motor D, Shift is slow.' },
    { title: 'Code and match', text: 'Write a Python program in the Code tab or pick an example. Match mode runs the 2:30 clock and the score log.' },
    { title: 'Camera and speed', text: 'Watch from above, from base or behind the robot; run the simulation from ¼× to 4×.' },
  ],
  tip: 'Plan your runs in the FLL coach first, then try them in the simulator.',
  toPlanner: 'To the FLL coach',
  credit:
    'The simulator is an independent project, not made or changed by RoboEasy. The field and missions follow its authors’ version; check the official season rules.',
  promo: { title: '3D BIOGLOW field simulator', text: 'Try your runs on a 3D field with physics, Python code and a match timer.', cta: 'Open the simulator' },
}

const TEXTS: Record<Locale, SimulatorText> = { ru, kk, en }

export function getSimulatorText(lang: Locale): SimulatorText {
  return TEXTS[lang]
}

/** Where the simulator lives (override with NEXT_PUBLIC_FLL_SIM_URL). */
export const FLL_SIM_URL = process.env.NEXT_PUBLIC_FLL_SIM_URL || 'https://fll-bioglow-sim.onrender.com/'
