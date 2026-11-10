/**
 * Copy of the home page ("Learn robotics from scratch"); live at
 * /[lang] since the first tracks shipped (the AI generator's page moved to
 * /[lang]/ai). Kazakh needs a review by a native speaker before launch.
 */

import type { SimDemoCopy } from '@/components/landing/sim-demo'

import type { Locale } from './config'

export type TrackKey = 'start' | 'build' | 'blocks' | 'sensors' | 'navigation' | 'python' | 'mechanisms' | 'fll' | 'ai'

export interface LearnLandingCopy {
  hero: {
    badge: string
    title: string
    accent: string
    sub: string
    cta: string
    ctaTest: string
    chips: string[]
    path: string[]
    station: string
    stats: { streak: string; coins: string; level: string; quest: string }
  }
  buddy: {
    eyebrow: string
    title: string
    text: string
    points: { title: string; text: string }[]
    shop: { title: string; items: { name: string; effect: string; price: number }[] }
  }
  games: { eyebrow: string; title: string; lead: string; items: { title: string; text: string }[]; quests: string }
  how: { eyebrow: string; title: string; steps: { title: string; text: string }[] }
  tracks: {
    eyebrow: string
    title: string
    lead: string
    noKit: string
    partKit: string
    items: Record<TrackKey, { title: string; text: string; time: string }>
  }
  virtual: { eyebrow: string; title: string; text: string; points: string[]; demo: SimDemoCopy }
  stats: { value: string; label: string }[]
  motivation: { eyebrow: string; title: string; items: { title: string; text: string }[]; note: string }
  mentor: { eyebrow: string; title: string; text: string; levels: string[]; question: string; answer: string }
  compete: { eyebrow: string; title: string; text: string; cta: string; sim: string }
  self: { eyebrow: string; title: string; items: { title: string; text: string }[]; parents: { title: string; items: string[] } }
  faq: { title: string; items: { q: string; a: string }[] }
  final: { title: string; text: string; cta: string }
}

const ru: LearnLandingCopy = {
  hero: {
    badge: 'Для LEGO® Education SPIKE™ Prime',
    title: 'Научись робототехнике',
    accent: 'с нуля',
    sub: 'Учись сам, в своём темпе: короткие уроки, виртуальный робот, игры и задания дня. Выбери робота-напарника и прокачивай его за XP и монеты.',
    cta: 'Начать бесплатно',
    ctaTest: 'Я уже умею — пройти тест',
    chips: ['Можно без набора', '5–10 минут в день', 'Қазақша · Русский · English'],
    path: ['Что такое робот', 'Хаб — мозг робота', 'Моторы', 'Датчики', 'Первая поездка'],
    station: 'Старт',
    stats: { streak: '5 дней подряд', coins: '+20 монет', level: 'Уровень 3', quest: 'Задание дня выполнено' },
  },
  buddy: {
    eyebrow: 'Твой робот',
    title: 'Выбери напарника и прокачай его',
    text: 'При входе выбираешь робота — ровер, танк, болид или паука — и даёшь ему имя. Он растёт вместе с тобой: за уроки, серии и игры ты получаешь XP и монеты.',
    points: [
      {
        title: 'Улучшения с бонусами',
        text: 'Мотор даёт больше монет, процессор — больше XP, аккумулятор — лишнюю заморозку серии, сенсоры — подсказки в играх.',
      },
      { title: 'Аксессуары и стиль', text: 'Кепка, корона, наушники, визор, краска и наклейки. Ещё два робота — андроид и дрон — открываются в гараже.' },
      { title: 'Монеты только за учёбу', text: 'Ничего не продаётся за деньги: всё зарабатывается уроками, заданиями и практикой.' },
    ],
    shop: {
      title: 'Гараж',
      items: [
        { name: 'Мотор II', effect: '+20% монет', price: 180 },
        { name: 'Процессор I', effect: '+10% XP', price: 100 },
        { name: 'Корона', effect: 'стиль', price: 350 },
      ],
    },
  },
  games: {
    eyebrow: 'Практика',
    title: 'Игры, которые учат',
    lead: 'Закрепляй темы в играх — каждая приносит XP и монеты, а лучшие результаты сохраняются.',
    items: [
      { title: 'Лабиринт робота', text: 'Команды и циклы: собери кристаллы и доедь до финиша.' },
      { title: 'Собери программу', text: 'Расставь строки программы в правильном порядке.' },
      { title: 'Пары терминов', text: 'Найди пары «термин — значение».' },
      { title: 'Блиц', text: 'Минута вопросов: термины, уроки и задачки.' },
    ],
    quests: 'Каждый день — три новых задания и сундук за все три.',
  },
  how: {
    eyebrow: 'Как это устроено',
    title: 'Немного теории — и сразу к делу',
    steps: [
      { title: 'Узнай', text: 'Короткое объяснение с картинкой: одна идея за раз, понятными словами.' },
      { title: 'Сделай', text: 'Собери программу из блоков или напиши код и запусти виртуального робота.' },
      { title: 'Проверь', text: 'Задание проверяется само. Не вышло — подсказка и новая попытка, без штрафа.' },
    ],
  },
  tracks: {
    eyebrow: 'Обучение',
    title: '9 треков от первой программы до соревнований и ИИ',
    lead: 'Идёшь по шагам: каждый трек открывает следующий. Если уже что-то умеешь — пройди тест и начни с нужного места.',
    noKit: 'без набора',
    partKit: 'часть с набором',
    items: {
      start: { title: 'Старт', text: 'Что такое робот, хаб, моторы и датчики. Первая программа.', time: '1 ч' },
      build: { title: 'Сборка', text: 'Детали, прочные конструкции, шестерни. Базовая тележка.', time: '2,5 ч' },
      blocks: { title: 'Программирование блоками', text: 'Последовательность, циклы, условия, переменные, свои блоки.', time: '3,5 ч' },
      sensors: { title: 'Датчики', text: 'Цвет, расстояние, касание, гироскоп. Езда по линии.', time: '2,5 ч' },
      navigation: { title: 'Навигация и точность', text: 'Калибровка, точные повороты, регуляторы без страха.', time: '2 ч' },
      python: { title: 'Python', text: 'Те же задачи в коде: блоки и Python рядом.', time: '2 ч' },
      mechanisms: { title: 'Механизмы и насадки', text: 'Захват, подъёмник, толкатель. Насадка под задачу.', time: '1,5 ч' },
      fll: { title: 'Соревнования FLL', text: 'Стратегия заездов, работа в команде, защита робота.', time: '2 ч' },
      ai: { title: 'ИИ с нуля', text: 'Как учится ИИ, промпты, вайбкодинг. Обучи модель жестам и цветам для робота.', time: '2 ч' },
    },
  },
  virtual: {
    eyebrow: 'Без набора',
    title: 'Виртуальный робот всегда под рукой',
    text: 'Основной путь проходится в симуляторе: робот ездит по полю, видит линии и стены, а задания проверяются автоматически. Есть набор SPIKE Prime? Задания на настоящем роботе дают бонус.',
    points: ['Поле с линиями, стенами и зонами', 'Датчики цвета, расстояния, силы и гироскоп', 'Скачай программу и запусти на своём роботе'],
    demo: {
      title: 'Программа робота на поле',
      run: 'Запустить',
      again: 'Ещё раз',
      done: 'Задание выполнено!',
      start: 'Старт',
      finish: 'Финиш',
      blocks: ['Когда программа запущена', 'Едь вперёд 30 см', 'Поверни направо 90°', 'Едь вперёд 50 см', 'Поверни направо 90°', 'Едь вперёд 30 см'],
    },
  },
  stats: [
    { value: '9', label: 'треков: от нуля до соревнований и ИИ' },
    { value: '4', label: 'обучающие игры и задания дня' },
    { value: '6', label: 'роботов-напарников' },
    { value: '3', label: 'языка: қазақша, русский, English' },
  ],
  motivation: {
    eyebrow: 'Мотивация',
    title: 'Каждый день немного — и результат заметен',
    items: [
      { title: 'Серии', text: 'Дни подряд с выполненной целью. Заморозки спасают, если пропустил день.' },
      { title: 'Опыт и уровни', text: '10 уровней от «Новичка» до «Мастера роботов» — за уроки, игры и задания.' },
      { title: 'Достижения', text: 'Бейджи за первую программу, первый датчик, собранного робота и секретные решения.' },
    ],
    note: 'Без давления: если сбился — просто начнёшь заново, рекорд сохранится.',
  },
  mentor: {
    eyebrow: 'ИИ-наставник',
    title: 'Подсказывает, а не решает за тебя',
    text: 'Застрял? Наставник видит задание и твою программу и помогает по ступенькам — чтобы до ответа ты дошёл сам.',
    levels: ['Наводящий вопрос', 'На что обратить внимание', 'Небольшой фрагмент'],
    question: 'Почему робот не доезжает до финиша?',
    answer: 'Посмотри на блок «ехать». Сколько сантиметров до финиша на поле, а сколько едет робот?',
  },
  compete: {
    eyebrow: 'Соревнования',
    title: 'До уровня FIRST LEGO League',
    text: 'В последнем треке — стратегия заездов, насадки, работа в команде и защита робота. FLL-тренер поможет спланировать сезон.',
    cta: 'Открыть FLL-тренер',
    sim: 'Симулятор поля',
  },
  self: {
    eyebrow: 'Самостоятельно',
    title: 'Учись сам — без класса и расписания',
    items: [
      { title: 'Свой темп', text: 'Занимайся когда удобно: 5–10 минут в день достаточно. Тест на входе подскажет, с чего начать.' },
      { title: 'Подсказки вместо учителя', text: 'Задания проверяются сами, а ИИ-наставник подсказывает по шагам.' },
      { title: 'Справочник и источники', text: 'Словарь терминов простыми словами и подборка полезных сайтов для учёбы дальше.' },
    ],
    parents: {
      title: 'Родителям',
      items: ['Минимум данных: только никнейм', 'Нет чата между пользователями', 'ИИ отвечает только про учёбу', 'Никаких покупок: монеты только за учёбу'],
    },
  },
  faq: {
    title: 'Частые вопросы',
    items: [
      { q: 'Нужен ли набор LEGO?', a: 'Нет. Основной путь проходится на виртуальном роботе. Набор SPIKE Prime нужен для бонусных заданий и сборки.' },
      { q: 'С какого возраста?', a: 'Уроки рассчитаны на 9–16 лет, но подходят и взрослым новичкам.' },
      { q: 'Это бесплатно?', a: 'Да, учиться можно бесплатно и без регистрации. Монеты в игре не продаются — их зарабатывают учёбой.' },
      { q: 'Нужен ли учитель?', a: 'Нет. Всё устроено для самостоятельной учёбы: задания проверяются сами, а наставник подсказывает.' },
      { q: 'Я уже программирую. Начинать с нуля?', a: 'Нет — пройди тест на входе, и мы подскажем, с какого урока начать.' },
      { q: 'Это официальный продукт LEGO?', a: 'Нет. RoboEasy — независимый проект и не связан с LEGO Group и FIRST.' },
    ],
  },
  final: { title: 'Первая программа — через 5 минут', text: 'Начни с трека «Старт»: виртуальный робот уже ждёт.', cta: 'Начать бесплатно' },
}

const en: LearnLandingCopy = {
  hero: {
    badge: 'For LEGO® Education SPIKE™ Prime',
    title: 'Learn robotics',
    accent: 'from scratch',
    sub: 'Learn on your own, at your pace: short lessons, a virtual robot, games and daily quests. Pick a robot buddy and upgrade it with XP and coins.',
    cta: 'Start for free',
    ctaTest: 'I already know some — take the test',
    chips: ['No kit needed', '5–10 minutes a day', 'Қазақша · Русский · English'],
    path: ['What is a robot', 'The hub — the brain', 'Motors', 'Sensors', 'First drive'],
    station: 'Start',
    stats: { streak: '5 days in a row', coins: '+20 coins', level: 'Level 3', quest: 'Daily quest done' },
  },
  buddy: {
    eyebrow: 'Your robot',
    title: 'Pick a buddy and upgrade it',
    text: 'When you start, you pick a robot (rover, tank, racer or spider) and name it. It grows with you: lessons, streaks and games earn XP and coins.',
    points: [
      {
        title: 'Upgrades with boosts',
        text: 'The motor earns more coins, the processor more XP, the battery an extra streak freeze, sensors give game hints.',
      },
      {
        title: 'Accessories and style',
        text: 'Cap, crown, headphones, visor, paint and stickers. Two more robots, an android and a drone, open in the garage.',
      },
      { title: 'Coins only for learning', text: 'Nothing is sold for money: everything is earned with lessons, quests and practice.' },
    ],
    shop: {
      title: 'Garage',
      items: [
        { name: 'Motor II', effect: '+20% coins', price: 180 },
        { name: 'Processor I', effect: '+10% XP', price: 100 },
        { name: 'Crown', effect: 'style', price: 350 },
      ],
    },
  },
  games: {
    eyebrow: 'Practice',
    title: 'Games that teach',
    lead: 'Practise topics in games: each one earns XP and coins, and your best results are saved.',
    items: [
      { title: 'Robot maze', text: 'Commands and loops: collect gems and reach the finish.' },
      { title: 'Build the program', text: 'Put the lines of a program in the right order.' },
      { title: 'Term pairs', text: 'Match each term with its meaning.' },
      { title: 'Blitz', text: 'A minute of questions: terms, lessons and puzzles.' },
    ],
    quests: 'Three new quests every day, and a chest for all three.',
  },
  how: {
    eyebrow: 'How it works',
    title: 'A little theory, then straight to practice',
    steps: [
      { title: 'Learn', text: 'A short explanation with a picture: one idea at a time, in plain words.' },
      { title: 'Do', text: 'Build a program from blocks or write code and run the virtual robot.' },
      { title: 'Check', text: 'The task checks itself. Not there yet? Get a hint and try again, no penalty.' },
    ],
  },
  tracks: {
    eyebrow: 'Learning',
    title: '9 tracks from the first program to competitions and AI',
    lead: 'Go step by step: each track opens the next one. Already know some? Take the test and start in the right place.',
    noKit: 'no kit needed',
    partKit: 'partly with a kit',
    items: {
      start: { title: 'Start', text: 'What a robot is: hub, motors and sensors. Your first program.', time: '1 h' },
      build: { title: 'Building', text: 'Parts, strong structures, gears. A basic driving base.', time: '2.5 h' },
      blocks: { title: 'Block programming', text: 'Sequences, loops, conditions, variables, My Blocks.', time: '3.5 h' },
      sensors: { title: 'Sensors', text: 'Colour, distance, touch, gyro. Line following.', time: '2.5 h' },
      navigation: { title: 'Navigation and accuracy', text: 'Calibration, precise turns, controllers without fear.', time: '2 h' },
      python: { title: 'Python', text: 'The same tasks in code: blocks and Python side by side.', time: '2 h' },
      mechanisms: { title: 'Mechanisms and attachments', text: 'Grabber, lift, pusher. An attachment for the task.', time: '1.5 h' },
      fll: { title: 'FLL competitions', text: 'Run strategy, teamwork, presenting your robot.', time: '2 h' },
      ai: { title: 'AI from zero', text: 'How AI learns, prompts, vibe coding. Teach a model gestures and colours for the robot.', time: '2 h' },
    },
  },
  virtual: {
    eyebrow: 'No kit needed',
    title: 'A virtual robot is always at hand',
    text: 'The main path runs in the simulator: the robot drives on a field, sees lines and walls, and tasks are checked automatically. Have a SPIKE Prime kit? Tasks on the real robot give a bonus.',
    points: ['A field with lines, walls and zones', 'Colour, distance and force sensors and a gyro', 'Download the program and run it on your robot'],
    demo: {
      title: 'A robot program on the field',
      run: 'Run',
      again: 'Run again',
      done: 'Task complete!',
      start: 'Start',
      finish: 'Finish',
      blocks: ['When the program starts', 'Drive forward 30 cm', 'Turn right 90°', 'Drive forward 50 cm', 'Turn right 90°', 'Drive forward 30 cm'],
    },
  },
  stats: [
    { value: '9', label: 'tracks: from zero to competitions and AI' },
    { value: '4', label: 'learning games and daily quests' },
    { value: '6', label: 'robot buddies' },
    { value: '3', label: 'languages: қазақша, русский, English' },
  ],
  motivation: {
    eyebrow: 'Motivation',
    title: 'A little every day adds up',
    items: [
      { title: 'Streaks', text: 'Days in a row with your goal done. Freezes save the streak if you miss a day.' },
      { title: 'XP and levels', text: '10 levels from “Beginner” to “Robot master”, for lessons, games and quests.' },
      { title: 'Achievements', text: 'Badges for your first program, first sensor, first robot built and secret solutions.' },
    ],
    note: 'No pressure: if you miss, you simply start again, and your record stays.',
  },
  mentor: {
    eyebrow: 'AI mentor',
    title: 'Gives hints, not answers',
    text: 'Stuck? The mentor sees the task and your program and helps step by step, so you reach the answer yourself.',
    levels: ['A guiding question', 'What to look at', 'A small piece of code'],
    question: 'Why doesn’t the robot reach the finish?',
    answer: 'Look at the “move” block. How many centimetres is the finish on the field, and how far does the robot drive?',
  },
  compete: {
    eyebrow: 'Competitions',
    title: 'All the way to FIRST LEGO League',
    text: 'The last track covers run strategy, attachments, teamwork and presenting your robot. The FLL coach helps plan the season.',
    cta: 'Open the FLL coach',
    sim: 'Field simulator',
  },
  self: {
    eyebrow: 'On your own',
    title: 'Learn by yourself — no class, no schedule',
    items: [
      { title: 'Your pace', text: 'Learn whenever it suits you: 5–10 minutes a day is enough. A placement test shows where to start.' },
      { title: 'Hints instead of a teacher', text: 'Tasks check themselves, and the AI mentor gives step-by-step hints.' },
      { title: 'Library and resources', text: 'A glossary in plain words and a list of useful sites to keep learning.' },
    ],
    parents: {
      title: 'Parents',
      items: ['Minimal data: just a nickname', 'No chat between users', 'The AI only talks about learning', 'No purchases: coins are earned by learning'],
    },
  },
  faq: {
    title: 'Questions',
    items: [
      { q: 'Do I need a LEGO kit?', a: 'No. The main path runs on a virtual robot. A SPIKE Prime kit is used for bonus tasks and building.' },
      { q: 'What age is it for?', a: 'Lessons are made for ages 9–16, and adult beginners are welcome too.' },
      { q: 'Is it free?', a: 'Yes, you can learn for free and without signing up. Coins are never sold; they are earned by learning.' },
      { q: 'Do I need a teacher?', a: 'No. Everything is made for learning on your own: tasks check themselves and the mentor gives hints.' },
      { q: 'I already code. Do I start from zero?', a: 'No — take the placement test and we’ll suggest where to start.' },
      { q: 'Is this an official LEGO product?', a: 'No. RoboEasy is an independent project, not affiliated with the LEGO Group or FIRST.' },
    ],
  },
  final: { title: 'Your first program in 5 minutes', text: 'Start with the “Start” track: the virtual robot is waiting.', cta: 'Start for free' },
}

const kk: LearnLandingCopy = {
  hero: {
    badge: 'LEGO® Education SPIKE™ Prime үшін',
    title: 'Робототехниканы',
    accent: 'нөлден үйрен',
    sub: 'Өз бетіңше, өз қарқыныңмен оқы: қысқа сабақтар, виртуалды робот, ойындар және күн тапсырмалары. Робот-серік таңдап, оны XP мен тиынға жетілдір.',
    cta: 'Тегін бастау',
    ctaTest: 'Мен білемін — тест тапсыру',
    chips: ['Жиынтықсыз да болады', 'Күніне 5–10 минут', 'Қазақша · Русский · English'],
    path: ['Робот деген не', 'Хаб — роботтың миы', 'Моторлар', 'Датчиктер', 'Алғашқы сапар'],
    station: 'Бастау',
    stats: { streak: 'Қатарынан 5 күн', coins: '+20 тиын', level: '3-деңгей', quest: 'Күн тапсырмасы орындалды' },
  },
  buddy: {
    eyebrow: 'Сенің роботың',
    title: 'Серік таңдап, оны жетілдір',
    text: 'Кіргенде роботты — ровер, танк, болид немесе өрмекшіні — таңдап, оған ат бересің. Ол сенімен бірге өседі: сабақтар, сериялар мен ойындар үшін XP мен тиын аласың.',
    points: [
      {
        title: 'Бонусы бар жақсартулар',
        text: 'Мотор көбірек тиын, процессор көбірек XP, аккумулятор серияға қосымша мұздату, сенсорлар ойындарда кеңес береді.',
      },
      { title: 'Аксессуарлар мен стиль', text: 'Кепка, тәж, құлаққап, визор, бояу және жапсырмалар. Тағы екі робот — андроид пен дрон — гаражда ашылады.' },
      { title: 'Тиын тек оқу үшін', text: 'Ештеңе ақшаға сатылмайды: бәрі сабақтармен, тапсырмалармен және жаттығумен табылады.' },
    ],
    shop: {
      title: 'Гараж',
      items: [
        { name: 'Мотор II', effect: '+20% тиын', price: 180 },
        { name: 'Процессор I', effect: '+10% XP', price: 100 },
        { name: 'Тәж', effect: 'стиль', price: 350 },
      ],
    },
  },
  games: {
    eyebrow: 'Жаттығу',
    title: 'Үйрететін ойындар',
    lead: 'Тақырыптарды ойында бекіт: әрқайсысы XP мен тиын әкеледі, ал үздік нәтижелер сақталады.',
    items: [
      { title: 'Робот лабиринті', text: 'Командалар мен циклдер: кристалдарды жинап, мәреге жет.' },
      { title: 'Бағдарламаны құрастыр', text: 'Бағдарлама жолдарын дұрыс ретпен қой.' },
      { title: 'Терминдер жұбы', text: '«Термин — мағына» жұптарын тап.' },
      { title: 'Блиц', text: 'Бір минут сұрақ: терминдер, сабақтар және есептер.' },
    ],
    quests: 'Күн сайын — үш жаңа тапсырма және үшеуі үшін сандық.',
  },
  how: {
    eyebrow: 'Қалай жұмыс істейді',
    title: 'Аздаған теория — және бірден іске',
    steps: [
      { title: 'Біл', text: 'Суреті бар қысқа түсіндірме: бір уақытта бір идея, түсінікті сөздермен.' },
      { title: 'Жаса', text: 'Блоктардан бағдарлама құрастыр немесе код жазып, виртуалды роботты іске қос.' },
      { title: 'Тексер', text: 'Тапсырма өзі тексеріледі. Шықпаса — кеңес және жаңа әрекет, айыпсыз.' },
    ],
  },
  tracks: {
    eyebrow: 'Оқу',
    title: 'Алғашқы бағдарламадан жарыстар мен ЖИ-ге дейін 9 трек',
    lead: 'Қадам бойынша жүресің: әр трек келесісін ашады. Бірдеңе білсең — тест тапсырып, керекті жерден баста.',
    noKit: 'жиынтықсыз',
    partKit: 'бір бөлігі жиынтықпен',
    items: {
      start: { title: 'Бастау', text: 'Робот, хаб, моторлар және датчиктер. Алғашқы бағдарлама.', time: '1 сағ' },
      build: { title: 'Құрастыру', text: 'Бөлшектер, берік құрылымдар, тісті доңғалақтар. Негізгі арба.', time: '2,5 сағ' },
      blocks: { title: 'Блоктармен бағдарламалау', text: 'Реттілік, циклдер, шарттар, айнымалылар, өз блоктарың.', time: '3,5 сағ' },
      sensors: { title: 'Датчиктер', text: 'Түс, қашықтық, жанасу, гироскоп. Сызық бойымен жүру.', time: '2,5 сағ' },
      navigation: { title: 'Навигация және дәлдік', text: 'Калибрлеу, дәл бұрылыстар, қорықпай реттегіштер.', time: '2 сағ' },
      python: { title: 'Python', text: 'Сол тапсырмалар кодта: блоктар мен Python қатар.', time: '2 сағ' },
      mechanisms: { title: 'Механизмдер мен саптамалар', text: 'Қармағыш, көтергіш, итергіш. Тапсырмаға саптама.', time: '1,5 сағ' },
      fll: { title: 'FLL жарыстары', text: 'Заездер стратегиясы, командалық жұмыс, роботты қорғау.', time: '2 сағ' },
      // TODO: проверить перевод
      ai: { title: 'ЖИ нөлден', text: 'ЖИ қалай үйренеді, промпттар, вайбкодинг. Модельді роботқа арналған ым мен түске үйрет.', time: '2 сағ' },
    },
  },
  virtual: {
    eyebrow: 'Жиынтықсыз',
    title: 'Виртуалды робот әрдайым қасыңда',
    text: 'Негізгі жол симуляторда өтеді: робот алаңда жүреді, сызықтар мен қабырғаларды көреді, ал тапсырмалар автоматты түрде тексеріледі. SPIKE Prime жиынтығың бар ма? Нағыз роботтағы тапсырмалар бонус береді.',
    points: ['Сызықтары, қабырғалары мен аймақтары бар алаң', 'Түс, қашықтық, күш датчиктері және гироскоп', 'Бағдарламаны жүктеп, өз роботыңда іске қос'],
    demo: {
      title: 'Алаңдағы робот бағдарламасы',
      run: 'Іске қосу',
      again: 'Тағы бір рет',
      done: 'Тапсырма орындалды!',
      start: 'Старт',
      finish: 'Мәре',
      blocks: ['Бағдарлама іске қосылғанда', '30 см алға жүр', 'Оңға 90° бұрыл', '50 см алға жүр', 'Оңға 90° бұрыл', '30 см алға жүр'],
    },
  },
  stats: [
    { value: '9', label: 'трек: нөлден жарыстар мен ЖИ-ге дейін' },
    { value: '4', label: 'оқу ойындары және күн тапсырмалары' },
    { value: '6', label: 'робот-серік' },
    { value: '3', label: 'тіл: қазақша, русский, English' },
  ],
  motivation: {
    eyebrow: 'Мотивация',
    title: 'Күн сайын аздап — нәтиже байқалады',
    items: [
      { title: 'Стриктер', text: 'Мақсат орындалған қатарынан күндер. Күн өткізіп алсаң, мұздату құтқарады.' },
      { title: 'Тәжірибе мен деңгейлер', text: '«Жаңадан бастаушыдан» «Роботтар шеберіне» дейін 10 деңгей — сабақтар, ойындар мен тапсырмалар үшін.' },
      { title: 'Жетістіктер', text: 'Алғашқы бағдарлама, алғашқы датчик, құрастырылған робот және құпия шешімдер үшін белгілер.' },
    ],
    note: 'Қысымсыз: тоқтап қалсаң — қайта бастайсың, рекордың сақталады.',
  },
  mentor: {
    eyebrow: 'ЖИ-тәлімгер',
    title: 'Сен үшін шешпейді, кеңес береді',
    text: 'Тығырыққа тірелдің бе? Тәлімгер тапсырма мен бағдарламаңды көріп, сатылап көмектеседі — жауапқа өзің жетуің үшін.',
    levels: ['Бағыттаушы сұрақ', 'Неге назар аудару керек', 'Шағын үзінді'],
    question: 'Неге робот мәреге жетпейді?',
    answer: '«Жүру» блогына қара. Алаңда мәреге дейін неше сантиметр, ал робот қанша жүреді?',
  },
  compete: {
    eyebrow: 'Жарыстар',
    title: 'FIRST LEGO League деңгейіне дейін',
    text: 'Соңғы тректе — заездер стратегиясы, саптамалар, командалық жұмыс және роботты қорғау. FLL-жаттықтырушы маусымды жоспарлауға көмектеседі.',
    cta: 'FLL-жаттықтырушыны ашу',
    sim: 'Алаң симуляторы',
  },
  self: {
    eyebrow: 'Өз бетіңше',
    title: 'Өзің оқы — сыныпсыз және кестесіз',
    items: [
      { title: 'Өз қарқының', text: 'Ыңғайлы кезде оқы: күніне 5–10 минут жеткілікті. Кіру тесті неден бастау керегін айтады.' },
      { title: 'Мұғалімнің орнына кеңестер', text: 'Тапсырмалар өзі тексеріледі, ал ЖИ-тәлімгер қадамдап кеңес береді.' },
      { title: 'Анықтамалық және көздер', text: 'Қарапайым сөздермен терминдер сөздігі және әрі қарай оқуға пайдалы сайттар.' },
    ],
    parents: {
      title: 'Ата-аналарға',
      items: ['Ең аз дерек: тек лақап ат', 'Пайдаланушылар арасында чат жоқ', 'ЖИ тек оқу туралы жауап береді', 'Сатып алу жоқ: тиын тек оқу үшін'],
    },
  },
  faq: {
    title: 'Жиі қойылатын сұрақтар',
    items: [
      { q: 'LEGO жиынтығы керек пе?', a: 'Жоқ. Негізгі жол виртуалды роботта өтеді. SPIKE Prime жиынтығы бонус тапсырмалар мен құрастыру үшін керек.' },
      { q: 'Нешеден бастап?', a: 'Сабақтар 9–16 жасқа арналған, бірақ ересек жаңадан бастаушыларға да жарайды.' },
      { q: 'Бұл тегін бе?', a: 'Иә, тегін және тіркелусіз оқуға болады. Тиын сатылмайды — оны оқумен табады.' },
      { q: 'Мұғалім керек пе?', a: 'Жоқ. Бәрі өз бетіңше оқуға арналған: тапсырмалар өзі тексеріледі, ал тәлімгер кеңес береді.' },
      { q: 'Мен бағдарламалай аламын. Нөлден бастау керек пе?', a: 'Жоқ — кіру тестін тапсыр, біз қай сабақтан бастау керегін айтамыз.' },
      { q: 'Бұл LEGO-ның ресми өнімі ме?', a: 'Жоқ. RoboEasy — тәуелсіз жоба, LEGO Group және FIRST-пен байланысы жоқ.' },
    ],
  },
  final: { title: 'Алғашқы бағдарлама — 5 минутта', text: '«Бастау» трегінен баста: виртуалды робот күтіп тұр.', cta: 'Тегін бастау' },
}

const COPY: Record<Locale, LearnLandingCopy> = { ru, kk, en }

export function getLearnLanding(lang: Locale): LearnLandingCopy {
  return COPY[lang]
}
