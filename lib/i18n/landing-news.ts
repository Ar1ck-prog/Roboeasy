/** Copy of the "What's new in 2.0" block on the home page. Kazakh needs a review by a native speaker. */

import type { Locale } from './config'

export interface LandingNewsCopy {
  eyebrow: string
  title: string
  lead: string
  gen: { title: string; text: string; cta: string; bubble: string }
  draw: { title: string; text: string; cta: string }
  telemetry: { title: string; text: string; cta: string; label: string }
  video: { title: string; text: string; cta: string; bubble: string }
  ai: { title: string; text: string; cta: string; go: string; stop: string }
  teacher: { title: string; text: string; cta: string; chart: string; before: string; after: string; sample: string }
  extras: { title: string; items: string[] }
}

const ru: LandingNewsCopy = {
  eyebrow: 'Новое в RoboEasy 2.0',
  title: 'ИИ, рисунки, телеметрия и кабинет учителя',
  lead: 'Всё работает прямо в браузере, на трёх языках и с настоящим роботом по Bluetooth.',
  gen: {
    title: 'Генератор понимает круги и дуги',
    text: 'Напиши «езжай по кругу»: ИИ выберет команды, а углы и скорости колёс посчитает наш код. Невыполнимое он честно объяснит.',
    cta: 'Открыть песочницу',
    bubble: '«езжай по кругу»',
  },
  draw: {
    title: 'Нарисуй маршрут',
    text: 'Проведи линию пальцем: сайт превратит её в отрезки и дуги, проверит в симуляторе и отправит роботу.',
    cta: 'Нарисовать',
  },
  telemetry: {
    title: 'Живая телеметрия',
    text: 'Пока робот едет, графики показывают расстояние, цвет, угол гироскопа и скорость моторов. Запись сохраняется в CSV.',
    cta: 'Подключить робота',
    label: 'расстояние, см',
  },
  video: {
    title: 'Видео-отладка',
    text: 'Сними заезд, и наставник заметит, где робот ошибся, и задаст наводящий вопрос. Решение найдёшь сам.',
    cta: 'Попробовать',
    bubble: 'Поворот ≈ 70° вместо 90°. Почему?',
  },
  ai: {
    title: 'ИИ с нуля',
    text: '18 уроков: как учится нейросеть, промпты, вайбкодинг и дипфейки. Обучи модель жестам, и робот поедет по ладони.',
    cta: 'К урокам',
    go: 'ехать',
    stop: 'стоп',
  },
  teacher: {
    title: 'Кабинет учителя',
    text: 'Класс по коду без почты и телефона, входной и итоговый тест, отчёт «до и после» с графиками и выгрузкой в Excel.',
    cta: 'Открыть кабинет',
    chart: 'Средний балл теста',
    before: 'До',
    after: 'После',
    sample: 'Пример отчёта',
  },
  extras: {
    title: 'И ещё',
    items: [
      'Запуск программы на роботе прямо с сайта',
      'Вопрос наставнику голосом, ответ вслух',
      'Удобно на телефоне, ставится как приложение',
      'ИИ отдыхает? Есть готовые программы без него',
    ],
  },
}

// TODO: проверить перевод
const kk: LandingNewsCopy = {
  eyebrow: 'RoboEasy 2.0-дегі жаңалықтар',
  title: 'ЖИ, суреттер, телеметрия және мұғалім кабинеті',
  lead: 'Бәрі браузерде, үш тілде және Bluetooth арқылы нағыз роботпен жұмыс істейді.',
  gen: {
    title: 'Генератор шеңбер мен доғаны түсінеді',
    text: '«Шеңбер бойымен жүр» деп жаз: ЖИ командаларды таңдайды, ал бұрыштар мен доңғалақ жылдамдығын біздің код есептейді. Орындалмайтынын адал түсіндіреді.',
    cta: 'Құмсалғышты ашу',
    bubble: '«шеңбер бойымен жүр»',
  },
  draw: {
    title: 'Маршрут сыз',
    text: 'Саусақпен сызық сыз: сайт оны кесінділер мен доғаларға айналдырып, симуляторда тексереді және роботқа жібереді.',
    cta: 'Сызу',
  },
  telemetry: {
    title: 'Тірі телеметрия',
    text: 'Робот жүріп бара жатқанда графиктер қашықтықты, түсті, гироскоп бұрышын және мотор жылдамдығын көрсетеді. Жазба CSV-ге сақталады.',
    cta: 'Роботты қосу',
    label: 'қашықтық, см',
  },
  video: {
    title: 'Бейне-түзету',
    text: 'Жүрісті түсір, тәлімгер робот қай жерде қателескенін байқап, бағыттаушы сұрақ қояды. Шешімін өзің табасың.',
    cta: 'Байқап көру',
    bubble: 'Бұрылу 90° орнына ≈ 70°. Неге?',
  },
  ai: {
    title: 'ЖИ нөлден',
    text: '18 сабақ: нейрожелі қалай үйренеді, промпттар, вайбкодинг және дипфейктер. Модельді ымға үйрет, сонда робот алақаныңмен жүреді.',
    cta: 'Сабақтарға',
    go: 'жүру',
    stop: 'тоқта',
  },
  teacher: {
    title: 'Мұғалім кабинеті',
    text: 'Поштасыз және телефонсыз кодпен сынып, кіріс және қорытынды тест, графиктері бар «дейін мен кейін» есебі және Excel-ге жүктеу.',
    cta: 'Кабинетті ашу',
    chart: 'Тесттің орташа балы',
    before: 'Дейін',
    after: 'Кейін',
    sample: 'Есеп үлгісі',
  },
  extras: {
    title: 'Тағы да',
    items: [
      'Бағдарламаны роботта тікелей сайттан іске қосу',
      'Тәлімгерге дауыспен сұрақ, жауап дауыстап',
      'Телефонда ыңғайлы, қолданба ретінде орнатылады',
      'ЖИ демалып жатыр ма? Онсыз дайын бағдарламалар бар',
    ],
  },
}

const en: LandingNewsCopy = {
  eyebrow: 'New in RoboEasy 2.0',
  title: 'AI, drawings, telemetry and a teacher’s room',
  lead: 'It all runs in the browser, in three languages, and with a real robot over Bluetooth.',
  gen: {
    title: 'The generator knows circles and arcs',
    text: 'Type “drive in a circle”: the AI picks the commands and our code works out the angles and wheel speeds. It honestly explains what the robot cannot do.',
    cta: 'Open the sandbox',
    bubble: '“drive in a circle”',
  },
  draw: {
    title: 'Draw a route',
    text: 'Draw a line with your finger: the site turns it into straight pieces and arcs, tests it in the simulator and sends it to the robot.',
    cta: 'Draw',
  },
  telemetry: {
    title: 'Live telemetry',
    text: 'While the robot drives, charts show distance, colour, gyro angle and motor speed. Recordings save as CSV.',
    cta: 'Connect a robot',
    label: 'distance, cm',
  },
  video: {
    title: 'Video debugging',
    text: 'Film a run and the mentor spots where the robot went wrong and asks a leading question. You find the fix yourself.',
    cta: 'Try it',
    bubble: 'Turned ≈ 70° instead of 90°. Why?',
  },
  ai: {
    title: 'AI from zero',
    text: '18 lessons: how neural networks learn, prompts, vibe coding and deepfakes. Teach a model gestures and the robot drives on your palm.',
    cta: 'To the lessons',
    go: 'go',
    stop: 'stop',
  },
  teacher: {
    title: 'Teacher’s room',
    text: 'A class with a code and no email or phone, entry and final tests, a before-and-after report with charts and Excel export.',
    cta: 'Open the room',
    chart: 'Average test score',
    before: 'Before',
    after: 'After',
    sample: 'Sample report',
  },
  extras: {
    title: 'And more',
    items: [
      'Run a program on the robot right from the site',
      'Ask the mentor by voice, hear the answer',
      'Comfortable on phones, installs like an app',
      'AI resting? Ready programs work without it',
    ],
  },
}

const TEXT: Record<Locale, LandingNewsCopy> = { ru, kk, en }

export const getLandingNews = (lang: Locale): LandingNewsCopy => TEXT[lang]
