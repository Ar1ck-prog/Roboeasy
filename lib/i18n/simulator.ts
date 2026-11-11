/**
 * Copy of the FLL field simulator page (/[lang]/compete/simulator): the BIOGLOW
 * 3D simulator (fll-simulator/, built into public/fll-sim and shown in a frame),
 * and its card on the competitions page. Kazakh needs a review by a native
 * speaker before launch.
 */

import type { Locale } from './config'

const ru = {
  promo: { title: 'Симулятор поля BIOGLOW', text: 'Запусти заезды на поле, засеки матч 2:30 и посчитай очки по правилам сезона.', cta: 'Открыть симулятор' },
  toPlanner: 'Спланировать заезды в FLL-тренере',
  three: {
    eyebrow: 'Соревнования · симулятор',
    title: 'Симулятор поля FLL',
    lead: 'Поле BIOGLOW (сезон 2026/27) в 3D с физикой: управляй роботом вручную, пиши код на Python, собирай насадки в конструкторе и проверяй заезды на время — как на настоящем матче.',
    badges: ['3D и физика', 'Код на Python', 'Матч 2:30', 'Конструктор робота'],
    newTab: 'В новой вкладке',
    fullscreen: 'На весь экран',
    reload: 'Перезагрузить',
    loading: 'Симулятор загружается…',
    loadingHint: 'Загружаем 3D-поле, физику и Python — первый раз это может занять до минуты.',
    slow: 'Долго грузится? Попробуй перезагрузить или открой симулятор в новой вкладке.',
    frame: '3D-симулятор поля FLL BIOGLOW',
    phone: 'На телефоне рули экранным пультом в углу поля, а поле крути пальцем. Код и протокол очков — ниже под полем.',
    howTitle: 'Как пользоваться',
    how: [
      { title: 'Двигай робота', text: 'Перетащи робота мышью, колесо мыши или Q/E поворачивают. Кнопка «На старт» вернёт его в базу.' },
      { title: 'Ручное управление', text: 'Щёлкни по полю: WASD или стрелки — езда, R/F — рука C, T/G — мотор D, Shift — медленно.' },
      { title: 'Код и матч', text: 'Кнопка «Код» открывает программу на Python, есть примеры. Режим «Матч 2:30» — отсчёт времени и протокол очков.' },
      { title: 'Камера и скорость', text: 'Смотри сверху, из базы или из-за робота; ускоряй и замедляй симуляцию от ¼× до 4×.' },
    ],
    tip: 'Сначала спланируй заезды в FLL-тренере, потом проверь их в симуляторе.',
  },
}

export type SimulatorText = typeof ru

const kk: SimulatorText = {
  promo: {
    title: 'BIOGLOW алаңының симуляторы',
    text: 'Заездерді алаңда іске қос, 2:30 матчты өлше және маусым ережесі бойынша ұпай сана.',
    cta: 'Симуляторды ашу',
  },
  toPlanner: 'Заездерді FLL-жаттықтырушыда жоспарлау',
  three: {
    eyebrow: 'Жарыстар · симулятор',
    title: 'FLL алаңының симуляторы',
    lead: 'BIOGLOW алаңы (2026/27 маусымы) 3D және физикамен: роботты қолмен басқар, Python-да код жаз, конструкторда саптамалар құрастыр және заездерді уақытқа тексер — нағыз матчтағыдай.',
    badges: ['3D және физика', 'Python-дағы код', 'Матч 2:30', 'Робот конструкторы'],
    newTab: 'Жаңа қойындыда',
    fullscreen: 'Толық экран',
    reload: 'Қайта жүктеу',
    loading: 'Симулятор жүктелуде…',
    loadingHint: '3D-алаң, физика және Python жүктелуде — алғашқы рет бір минутқа дейін созылуы мүмкін.',
    slow: 'Ұзақ жүктеліп жатыр ма? Қайта жүктеп көр немесе симуляторды жаңа қойындыда аш.',
    frame: 'FLL BIOGLOW алаңының 3D-симуляторы',
    phone: 'Телефонда алаң бұрышындағы экрандық пультпен басқар, ал алаңды саусақпен айналдыр. Код пен ұпай хаттамасы — алаңның астында.',
    howTitle: 'Қалай қолдану керек',
    how: [
      { title: 'Роботты жылжыт', text: 'Роботты тінтуірмен сүйре, тінтуір дөңгелегі не Q/E бұрады. «Стартқа» батырмасы оны базаға қайтарады.' },
      { title: 'Қолмен басқару', text: 'Алаңды бас: WASD немесе бағыттауыштар — жүру, R/F — C қолы, T/G — D моторы, Shift — баяу.' },
      { title: 'Код және матч', text: '«Код» батырмасы Python-дағы бағдарламаны ашады, мысалдар бар. «Матч 2:30» режимі — кері санақ және ұпай хаттамасы.' },
      { title: 'Камера және жылдамдық', text: 'Жоғарыдан, базадан немесе роботтың артынан қара; симуляцияны ¼×-тен 4×-ке дейін жылдамдат не баяулат.' },
    ],
    tip: 'Алдымен заездерді FLL-жаттықтырушыда жоспарла, содан кейін симуляторда тексер.',
  },
}

const en: SimulatorText = {
  promo: {
    title: 'BIOGLOW field simulator',
    text: 'Run your missions on the field, time a 2:30 match and score it by the season rules.',
    cta: 'Open the simulator',
  },
  toPlanner: 'Plan runs in the FLL coach',
  three: {
    eyebrow: 'Competitions · simulator',
    title: 'FLL field simulator',
    lead: 'The BIOGLOW field (2026/27 season) in 3D with physics: drive the robot by hand, write Python code, build attachments and time your runs like in a real match.',
    badges: ['3D and physics', 'Python code', '2:30 match', 'Robot builder'],
    newTab: 'In a new tab',
    fullscreen: 'Full screen',
    reload: 'Reload',
    loading: 'Loading the simulator…',
    loadingHint: 'Loading the 3D field, physics and Python; the first time can take up to a minute.',
    slow: 'Taking long? Try reloading, or open the simulator in a new tab.',
    frame: '3D simulator of the FLL BIOGLOW field',
    phone: 'On a phone, drive with the on-screen pad in the corner of the field and turn the field with a finger. The code and the score sheet are below the field.',
    howTitle: 'How to use it',
    how: [
      { title: 'Move the robot', text: 'Drag the robot with the mouse; the wheel or Q/E turns it. “To start” puts it back in base.' },
      { title: 'Drive by hand', text: 'Click the field: WASD or arrows drive, R/F move arm C, T/G motor D, Shift is slow.' },
      { title: 'Code and match', text: 'The Code button opens the Python program, with examples. “Match 2:30” runs the clock and the score sheet.' },
      { title: 'Camera and speed', text: 'Watch from above, from base or behind the robot; run the simulation from ¼× to 4×.' },
    ],
    tip: 'Plan your runs in the FLL coach first, then try them in the simulator.',
  },
}

const TEXTS: Record<Locale, SimulatorText> = { ru, kk, en }

export function getSimulatorText(lang: Locale): SimulatorText {
  return TEXTS[lang]
}

/** The built 3D simulator (fll-simulator -> public/fll-sim). */
export const FLL_SIM_SRC = '/fll-sim/index.html'
