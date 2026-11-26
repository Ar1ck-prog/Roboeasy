/** UI strings of the WeDo 2.0 part: blocks, editor, simulator, lesson steps and the path picker. Short words for 6–9 year olds. */

import type { MotionEvent, TiltState, WedoCategory, WedoColor, WedoOp } from '@/lib/wedo/types'

import type { Locale } from './config'

export interface WedoText {
  blocks: Record<WedoOp, string>
  /** Screen-reader names; {n} is the block's number, {v} its value. */
  aria: Record<WedoOp, string>
  colors: Record<WedoColor, string>
  tilt: Record<TiltState, string>
  motion: Record<MotionEvent, string>
  dir: { this: string; that: string }
  categories: Record<WedoCategory, string>
  editor: {
    start: string
    palette: string
    program: string
    left: string
    right: string
    remove: string
    reset: string
    clear: string
    less: string
    more: string
    forever: string
    times: string
    empty: string
    inside: string
    outside: string
    full: string
    params: string
    seconds: string
    power: string
    sound: string
    text: string
    number: string
    block: string
    readOnly: string
  }
  sim: {
    run: string
    pause: string
    reset: string
    speed: string
    hub: string
    screen: string
    sound: string
    handNear: string
    handFar: string
    hand: string
    tilt: string
    live: string
    liveHint: string
    crash: string
    level: string
    turns: string
    distance: string
    scene: string
  }
  step: {
    run: string
    check: string
    hint: string
    hintOf: string
    tabs: { task: string; code: string; robot: string }
    passed: string
    almost: string
    readAloud: string
    stopReading: string
    blocksCount: string
    shorter: string
    predictWatch: string
    predictPick: string
    predictRight: string
    predictWrong: string
    predictReplay: string
  }
  picker: {
    title: string
    lead: string
    wedoTitle: string
    wedoText: string
    spikeTitle: string
    spikeText: string
    startHere: string
    note: string
    choose: string
    chosen: string
  }
}

const ru: WedoText = {
  blocks: {
    motor_on_for: 'Мотор на время',
    motor_on: 'Мотор включить',
    motor_off: 'Мотор выключить',
    motor_power: 'Мощность',
    motor_direction: 'Направление',
    light: 'Лампа',
    sound: 'Звук',
    display: 'Экран',
    wait: 'Ждать',
    wait_motion: 'Ждать датчик движения',
    wait_tilt: 'Ждать наклон',
    repeat: 'Повторять',
  },
  aria: {
    motor_on_for: 'Блок {n}: мотор включить на {v} с',
    motor_on: 'Блок {n}: мотор включить',
    motor_off: 'Блок {n}: мотор выключить',
    motor_power: 'Блок {n}: мощность мотора {v}',
    motor_direction: 'Блок {n}: направление {v}',
    light: 'Блок {n}: лампа, цвет {v}',
    sound: 'Блок {n}: звук номер {v}',
    display: 'Блок {n}: показать на экране {v}',
    wait: 'Блок {n}: ждать {v} с',
    wait_motion: 'Блок {n}: ждать, датчик движения: {v}',
    wait_tilt: 'Блок {n}: ждать наклон {v}',
    repeat: 'Блок {n}: повторять {v}',
  },
  colors: {
    off: 'выключена',
    pink: 'розовый',
    violet: 'фиолетовый',
    blue: 'синий',
    azure: 'голубой',
    teal: 'бирюзовый',
    green: 'зелёный',
    yellow: 'жёлтый',
    orange: 'оранжевый',
    red: 'красный',
    white: 'белый',
  },
  tilt: { up: 'вверх', down: 'вниз', left: 'влево', right: 'вправо', flat: 'ровно', shake: 'потрясти' },
  motion: { near: 'близко', far: 'далеко', change: 'изменилось' },
  dir: { this: 'в эту сторону', that: 'в ту сторону' },
  categories: { motor: 'Мотор', look: 'Свет и звук', wait: 'Ждать и датчики', flow: 'Повтор' },
  editor: {
    start: 'Старт',
    palette: 'Блоки',
    program: 'Программа',
    left: 'Влево',
    right: 'Вправо',
    remove: 'Удалить',
    reset: 'Сначала',
    clear: 'Очистить',
    less: 'Меньше',
    more: 'Больше',
    forever: 'всегда',
    times: '{n} раз',
    empty: 'Нажми на блок внизу, и он встанет после «Старта».',
    inside: 'Новые блоки встанут внутрь повтора.',
    outside: 'Выйти из повтора',
    full: 'Больше блоков поставить нельзя.',
    params: 'Настройка блока',
    seconds: '{n} с',
    power: 'Мощность {n}',
    sound: 'Звук {n}',
    text: 'Текст',
    number: 'Число',
    block: 'Блок {n}',
    readOnly: 'Эту программу можно только смотреть.',
  },
  sim: {
    run: 'Запустить',
    pause: 'Пауза',
    reset: 'Сначала',
    speed: 'Скорость',
    hub: 'Смартхаб',
    screen: 'Экран планшета',
    sound: 'Звук',
    handNear: 'Рука близко',
    handFar: 'Рука далеко',
    hand: 'Датчик движения',
    tilt: 'Датчик наклона',
    live: 'Попробуй сам',
    liveHint: 'Запусти программу и нажимай кнопки датчика.',
    crash: 'Бум! Вжик врезался.',
    level: 'Уровень {n}',
    turns: '{n} об.',
    distance: '{n} см',
    scene: 'Сцена робота',
  },
  step: {
    run: 'Запустить',
    check: 'Проверить',
    hint: 'Подсказка',
    hintOf: 'Подсказка {n} из {total}',
    tabs: { task: 'Задание', code: 'Программа', robot: 'Робот' },
    passed: 'Всё получилось!',
    almost: 'Почти! Давай поправим.',
    readAloud: 'Прочитать вслух',
    stopReading: 'Остановить чтение',
    blocksCount: 'Блоков: {n}',
    shorter: 'Ого! Твоя программа короче нашей.',
    predictWatch: 'Посмотри программу. Что сделает робот?',
    predictPick: 'Выбери ответ',
    predictRight: 'Верно! Смотри, как это было.',
    predictWrong: 'Не совсем. Посмотри, что сделал робот.',
    predictReplay: 'Показать ещё раз',
  },
  picker: {
    title: 'С чего начнём?',
    lead: 'Выбери свой набор. Потом можно поменять в профиле.',
    wedoTitle: 'LEGO WeDo 2.0',
    wedoText: 'Для ребят 6–9 лет. Собери первого робота и научи его двигаться, светиться и чувствовать. Отсюда начинают.',
    spikeTitle: 'LEGO SPIKE Prime',
    spikeText: 'Для ребят от 9 лет. Настоящий робот-машина, датчики, Python и соревнования.',
    startHere: 'Начни здесь',
    note: 'Выбрал WeDo? Сначала пройдёшь все уроки WeDo, потом откроется SPIKE Prime.',
    choose: 'Выбрать',
    chosen: 'Выбрано',
  },
}

const kk: WedoText = {
  blocks: {
    motor_on_for: 'Мотор уақытқа',
    motor_on: 'Моторды қосу',
    motor_off: 'Моторды өшіру',
    motor_power: 'Қуат',
    motor_direction: 'Бағыт',
    light: 'Шам',
    sound: 'Дыбыс',
    display: 'Экран',
    wait: 'Күту',
    wait_motion: 'Қозғалыс датчигін күту',
    wait_tilt: 'Еңкеюді күту',
    repeat: 'Қайталау',
  },
  aria: {
    motor_on_for: '{n}-блок: моторды {v} с қосу',
    motor_on: '{n}-блок: моторды қосу',
    motor_off: '{n}-блок: моторды өшіру',
    motor_power: '{n}-блок: мотор қуаты {v}',
    motor_direction: '{n}-блок: бағыт {v}',
    light: '{n}-блок: шам, түсі {v}',
    sound: '{n}-блок: {v}-дыбыс',
    display: '{n}-блок: экранға {v} шығару',
    wait: '{n}-блок: {v} с күту',
    wait_motion: '{n}-блок: күту, қозғалыс датчигі: {v}',
    wait_tilt: '{n}-блок: {v} еңкеюді күту',
    repeat: '{n}-блок: {v} қайталау',
  },
  colors: {
    off: 'сөніп тұр',
    pink: 'қызғылт',
    violet: 'күлгін',
    blue: 'көк',
    azure: 'ашық көк',
    teal: 'көгілдір-жасыл',
    green: 'жасыл',
    yellow: 'сары',
    orange: 'қызғылт сары',
    red: 'қызыл',
    white: 'ақ',
  },
  tilt: { up: 'жоғары', down: 'төмен', left: 'солға', right: 'оңға', flat: 'түзу', shake: 'сілку' },
  motion: { near: 'жақын', far: 'алыс', change: 'өзгерді' },
  dir: { this: 'осы жаққа', that: 'ана жаққа' },
  categories: { motor: 'Мотор', look: 'Жарық пен дыбыс', wait: 'Күту және датчиктер', flow: 'Қайталау' },
  editor: {
    start: 'Бастау',
    palette: 'Блоктар',
    program: 'Бағдарлама',
    left: 'Солға',
    right: 'Оңға',
    remove: 'Өшіру',
    reset: 'Басынан',
    clear: 'Тазалау',
    less: 'Азырақ',
    more: 'Көбірек',
    forever: 'әрдайым',
    times: '{n} рет',
    empty: 'Төмендегі блокты бас, ол «Бастаудан» кейін тұрады.',
    inside: 'Жаңа блоктар қайталаудың ішіне тұрады.',
    outside: 'Қайталаудан шығу',
    full: 'Бұдан көп блок қоюға болмайды.',
    params: 'Блокты баптау',
    seconds: '{n} с',
    power: 'Қуат {n}',
    sound: 'Дыбыс {n}',
    text: 'Мәтін',
    number: 'Сан',
    block: '{n}-блок',
    readOnly: 'Бұл бағдарламаны тек қарауға болады.',
  },
  sim: {
    run: 'Іске қосу',
    pause: 'Үзіліс',
    reset: 'Басынан',
    speed: 'Жылдамдық',
    hub: 'Смартхаб',
    screen: 'Планшет экраны',
    sound: 'Дыбыс',
    handNear: 'Қол жақын',
    handFar: 'Қол алыс',
    hand: 'Қозғалыс датчигі',
    tilt: 'Еңкею датчигі',
    live: 'Өзің байқап көр',
    liveHint: 'Бағдарламаны іске қос та, датчик түймелерін бас.',
    crash: 'Гүрс! Вжик соғылып қалды.',
    level: '{n}-деңгей',
    turns: '{n} айн.',
    distance: '{n} см',
    scene: 'Робот сахнасы',
  },
  step: {
    run: 'Іске қосу',
    check: 'Тексеру',
    hint: 'Көмек',
    hintOf: '{total} көмектің {n}-сі',
    tabs: { task: 'Тапсырма', code: 'Бағдарлама', robot: 'Робот' },
    passed: 'Бәрі шықты!',
    almost: 'Аз қалды! Түзетейік.',
    readAloud: 'Дауыстап оқу',
    stopReading: 'Оқуды тоқтату',
    blocksCount: 'Блоктар: {n}',
    shorter: 'Тамаша! Сенің бағдарламаң біздікінен қысқа.',
    predictWatch: 'Бағдарламаны қара. Робот не істейді?',
    predictPick: 'Жауапты таңда',
    predictRight: 'Дұрыс! Қалай болғанын қара.',
    predictWrong: 'Толық емес. Робот не істегенін қара.',
    predictReplay: 'Тағы көрсету',
  },
  picker: {
    title: 'Неден бастаймыз?',
    lead: 'Өз жинағыңды таңда. Кейін профильде ауыстыруға болады.',
    wedoTitle: 'LEGO WeDo 2.0',
    wedoText: '6–9 жастағы балаларға. Алғашқы роботыңды құрастырып, оны қозғалуға, жарқырауға және сезуге үйрет. Осыдан бастайды.',
    spikeTitle: 'LEGO SPIKE Prime',
    spikeText: '9 жастан бастап. Нағыз робот-машина, датчиктер, Python және жарыстар.',
    startHere: 'Осыдан баста',
    note: 'WeDo таңдадың ба? Алдымен WeDo сабақтарының бәрін өтесің, содан кейін SPIKE Prime ашылады.',
    choose: 'Таңдау',
    chosen: 'Таңдалды',
  },
}

const en: WedoText = {
  blocks: {
    motor_on_for: 'Motor for time',
    motor_on: 'Motor on',
    motor_off: 'Motor off',
    motor_power: 'Power',
    motor_direction: 'Direction',
    light: 'Light',
    sound: 'Sound',
    display: 'Screen',
    wait: 'Wait',
    wait_motion: 'Wait for motion sensor',
    wait_tilt: 'Wait for tilt',
    repeat: 'Repeat',
  },
  aria: {
    motor_on_for: 'Block {n}: motor on for {v} s',
    motor_on: 'Block {n}: motor on',
    motor_off: 'Block {n}: motor off',
    motor_power: 'Block {n}: motor power {v}',
    motor_direction: 'Block {n}: direction {v}',
    light: 'Block {n}: light, colour {v}',
    sound: 'Block {n}: sound number {v}',
    display: 'Block {n}: show on screen {v}',
    wait: 'Block {n}: wait {v} s',
    wait_motion: 'Block {n}: wait, motion sensor: {v}',
    wait_tilt: 'Block {n}: wait for tilt {v}',
    repeat: 'Block {n}: repeat {v}',
  },
  colors: {
    off: 'off',
    pink: 'pink',
    violet: 'violet',
    blue: 'blue',
    azure: 'light blue',
    teal: 'teal',
    green: 'green',
    yellow: 'yellow',
    orange: 'orange',
    red: 'red',
    white: 'white',
  },
  tilt: { up: 'up', down: 'down', left: 'left', right: 'right', flat: 'flat', shake: 'shake' },
  motion: { near: 'near', far: 'far', change: 'changed' },
  dir: { this: 'this way', that: 'that way' },
  categories: { motor: 'Motor', look: 'Light and sound', wait: 'Wait and sensors', flow: 'Repeat' },
  editor: {
    start: 'Start',
    palette: 'Blocks',
    program: 'Program',
    left: 'Left',
    right: 'Right',
    remove: 'Remove',
    reset: 'Start over',
    clear: 'Clear',
    less: 'Less',
    more: 'More',
    forever: 'forever',
    times: '{n} times',
    empty: 'Tap a block below and it goes after Start.',
    inside: 'New blocks go inside the repeat.',
    outside: 'Leave the repeat',
    full: 'No room for more blocks.',
    params: 'Block settings',
    seconds: '{n} s',
    power: 'Power {n}',
    sound: 'Sound {n}',
    text: 'Text',
    number: 'Number',
    block: 'Block {n}',
    readOnly: 'You can only look at this program.',
  },
  sim: {
    run: 'Run',
    pause: 'Pause',
    reset: 'Start over',
    speed: 'Speed',
    hub: 'Smarthub',
    screen: 'Tablet screen',
    sound: 'Sound',
    handNear: 'Hand near',
    handFar: 'Hand far',
    hand: 'Motion sensor',
    tilt: 'Tilt sensor',
    live: 'Try it yourself',
    liveHint: 'Run the program and press the sensor buttons.',
    crash: 'Bump! Zip hit something.',
    level: 'Level {n}',
    turns: '{n} turns',
    distance: '{n} cm',
    scene: 'Robot scene',
  },
  step: {
    run: 'Run',
    check: 'Check',
    hint: 'Hint',
    hintOf: 'Hint {n} of {total}',
    tabs: { task: 'Task', code: 'Program', robot: 'Robot' },
    passed: 'You did it!',
    almost: 'Almost! Let us fix it.',
    readAloud: 'Read aloud',
    stopReading: 'Stop reading',
    blocksCount: 'Blocks: {n}',
    shorter: 'Wow! Your program is shorter than ours.',
    predictWatch: 'Look at the program. What will the robot do?',
    predictPick: 'Pick an answer',
    predictRight: 'Right! See how it went.',
    predictWrong: 'Not quite. See what the robot did.',
    predictReplay: 'Show again',
  },
  picker: {
    title: 'Where do we start?',
    lead: 'Pick your kit. You can change it later in your profile.',
    wedoTitle: 'LEGO WeDo 2.0',
    wedoText: 'For kids aged 6–9. Build your first robot and teach it to move, light up and feel. This is where you start.',
    spikeTitle: 'LEGO SPIKE Prime',
    spikeText: 'For kids from 9. A real robot car, sensors, Python and competitions.',
    startHere: 'Start here',
    note: 'Picked WeDo? You will do all the WeDo lessons first, then SPIKE Prime opens.',
    choose: 'Choose',
    chosen: 'Chosen',
  },
}

const TEXTS: Record<Locale, WedoText> = { ru, kk, en }

export function getWedoText(lang: Locale): WedoText {
  return TEXTS[lang]
}
