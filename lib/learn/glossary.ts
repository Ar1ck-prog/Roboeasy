/**
 * The robotics glossary: the library page, "Term pairs" and Blitz use it.
 * General terms only; facts about SPIKE Prime hardware stay in the lessons.
 * Kazakh needs a review by a native speaker before launch.
 */

import type { IconName } from '@/components/ui/anim-icon'

type L = { ru: string; kk: string; en: string }

export interface Term {
  id: string
  icon: IconName
  term: L
  /** Up to ~40 characters: fits a memory card. */
  short: L
  /** One or two sentences for the library. */
  text: L
}

export const GLOSSARY: Term[] = [
  {
    id: 'robot',
    icon: 'robot',
    term: { ru: 'Робот', kk: 'Робот', en: 'Robot' },
    short: { ru: 'Чувствует, думает и действует', kk: 'Сезеді, ойлайды, әрекет етеді', en: 'Senses, thinks and acts' },
    text: {
      ru: 'Машина, которая получает данные от датчиков, решает по программе, что делать, и действует моторами.',
      kk: 'Датчиктерден дерек алып, бағдарлама бойынша не істеу керегін шешетін және моторлармен әрекет ететін машина.',
      en: 'A machine that reads its sensors, decides what to do by a program and acts with its motors.',
    },
  },
  {
    id: 'hub',
    icon: 'brain',
    term: { ru: 'Хаб', kk: 'Хаб', en: 'Hub' },
    short: { ru: 'Мозг робота с портами', kk: 'Порттары бар робот миы', en: 'The robot’s brain with ports' },
    text: {
      ru: 'Главный блок робота: в нём батарея и программа, к его портам подключают моторы и датчики.',
      kk: 'Роботтың басты блогы: ішінде батарея мен бағдарлама бар, порттарына моторлар мен датчиктер қосылады.',
      en: 'The main unit: it holds the battery and the program, and motors and sensors plug into its ports.',
    },
  },
  {
    id: 'motor',
    icon: 'gear',
    term: { ru: 'Мотор', kk: 'Мотор', en: 'Motor' },
    short: { ru: 'Крутит колёса и механизмы', kk: 'Дөңгелектер мен механизмдерді айналдырады', en: 'Turns wheels and mechanisms' },
    text: {
      ru: 'Превращает электричество в вращение. Можно задать скорость, угол или число оборотов.',
      kk: 'Электрді айналымға айналдырады. Жылдамдықты, бұрышты немесе айналым санын беруге болады.',
      en: 'Turns electricity into rotation. You can set its speed, an angle or a number of rotations.',
    },
  },
  {
    id: 'sensor',
    icon: 'eye',
    term: { ru: 'Датчик', kk: 'Датчик', en: 'Sensor' },
    short: { ru: 'Органы чувств робота', kk: 'Роботтың сезім мүшелері', en: 'The robot’s senses' },
    text: {
      ru: 'Измеряет что-то вокруг — цвет, расстояние, нажатие, наклон — и сообщает программе.',
      kk: 'Айналадағы бір нәрсені — түсті, қашықтықты, басуды, еңісті — өлшеп, бағдарламаға хабарлайды.',
      en: 'Measures something around the robot (colour, distance, a press, a tilt) and tells the program.',
    },
  },
  {
    id: 'color-sensor',
    icon: 'palette',
    term: { ru: 'Датчик цвета', kk: 'Түс датчигі', en: 'Colour sensor' },
    short: { ru: 'Видит цвет и яркость под собой', kk: 'Астындағы түс пен жарықты көреді', en: 'Sees colour and brightness' },
    text: {
      ru: 'Смотрит на поверхность и узнаёт цвет или яркость. С ним робот ездит по линии.',
      kk: 'Бетке қарап, түсті немесе жарықтықты анықтайды. Онымен робот сызық бойымен жүреді.',
      en: 'Looks at the surface and tells its colour or brightness. It lets a robot follow a line.',
    },
  },
  {
    id: 'distance-sensor',
    icon: 'ruler',
    term: { ru: 'Датчик расстояния', kk: 'Қашықтық датчигі', en: 'Distance sensor' },
    short: { ru: 'Меряет, далеко ли препятствие', kk: 'Кедергіге дейінгі қашықтықты өлшейді', en: 'Measures how far things are' },
    text: {
      ru: 'Посылает невидимый сигнал и ловит отражение, чтобы узнать расстояние до предмета.',
      kk: 'Көрінбейтін сигнал жіберіп, шағылысын ұстап, затқа дейінгі қашықтықты біледі.',
      en: 'Sends an invisible signal and catches the echo to find the distance to an object.',
    },
  },
  {
    id: 'force-sensor',
    icon: 'finger',
    term: { ru: 'Датчик силы', kk: 'Күш датчигі', en: 'Force sensor' },
    short: { ru: 'Чувствует нажатие', kk: 'Басуды сезеді', en: 'Feels a press' },
    text: {
      ru: 'Кнопка, которая знает, нажата ли она и насколько сильно. Подходит для бампера.',
      kk: 'Басылғанын және қаншалықты қатты басылғанын білетін түйме. Бампер үшін жарайды.',
      en: 'A button that knows whether and how hard it is pressed. Good for a bumper.',
    },
  },
  {
    id: 'gyro',
    icon: 'compass',
    term: { ru: 'Гироскоп', kk: 'Гироскоп', en: 'Gyro sensor' },
    short: { ru: 'Знает, на сколько робот повернул', kk: 'Роботтың қаншаға бұрылғанын біледі', en: 'Knows how far it has turned' },
    text: {
      ru: 'Измеряет повороты и наклоны. С ним повороты получаются точными.',
      kk: 'Бұрылыстар мен еңістерді өлшейді. Онымен бұрылыстар дәл шығады.',
      en: 'Measures turns and tilts. It makes turns precise.',
    },
  },
  {
    id: 'program',
    icon: 'scroll',
    term: { ru: 'Программа', kk: 'Бағдарлама', en: 'Program' },
    short: { ru: 'Команды, которые выполняет робот', kk: 'Робот орындайтын командалар', en: 'Commands the robot follows' },
    text: {
      ru: 'Список команд для робота, записанный блоками или кодом.',
      kk: 'Блоктармен немесе кодпен жазылған робот командаларының тізімі.',
      en: 'A list of commands for the robot, written in blocks or code.',
    },
  },
  {
    id: 'algorithm',
    icon: 'map',
    term: { ru: 'Алгоритм', kk: 'Алгоритм', en: 'Algorithm' },
    short: { ru: 'План решения по шагам', kk: 'Қадамдық шешім жоспары', en: 'A step-by-step plan' },
    text: {
      ru: 'Точный порядок шагов, который приводит к цели. Программа — это алгоритм для робота.',
      kk: 'Мақсатқа жеткізетін қадамдардың нақты реті. Бағдарлама — робот үшін алгоритм.',
      en: 'An exact order of steps that reaches a goal. A program is an algorithm for a robot.',
    },
  },
  {
    id: 'sequence',
    icon: 'arrow',
    term: { ru: 'Последовательность', kk: 'Реттілік', en: 'Sequence' },
    short: { ru: 'Команды по очереди, сверху вниз', kk: 'Командалар кезекпен, жоғарыдан төмен', en: 'Commands in order, top to bottom' },
    text: {
      ru: 'Команды выполняются одна за другой в том порядке, в каком записаны.',
      kk: 'Командалар жазылған ретпен бірінен соң бірі орындалады.',
      en: 'Commands run one after another in the order they are written.',
    },
  },
  {
    id: 'loop',
    icon: 'loop',
    term: { ru: 'Цикл', kk: 'Цикл', en: 'Loop' },
    short: { ru: 'Повторяет команды', kk: 'Командаларды қайталайды', en: 'Repeats commands' },
    text: {
      ru: 'Повторяет блоки внутри несколько раз или пока выполняется условие. Делает программу короче.',
      kk: 'Ішіндегі блоктарды бірнеше рет немесе шарт орындалғанша қайталайды. Бағдарламаны қысқартады.',
      en: 'Repeats the blocks inside a number of times or while a condition holds. It makes programs shorter.',
    },
  },
  {
    id: 'condition',
    icon: 'shuffle',
    term: { ru: 'Условие', kk: 'Шарт', en: 'Condition' },
    short: { ru: 'Если… то… иначе…', kk: 'Егер… онда… әйтпесе…', en: 'If… then… else…' },
    text: {
      ru: 'Проверка, от которой зависит, какие команды выполнит робот: если датчик видит чёрное — поверни.',
      kk: 'Робот қандай командаларды орындайтыны соған байланысты тексеру: датчик қараны көрсе — бұрыл.',
      en: 'A check that decides which commands run: if the sensor sees black, turn.',
    },
  },
  {
    id: 'variable',
    icon: 'box',
    term: { ru: 'Переменная', kk: 'Айнымалы', en: 'Variable' },
    short: { ru: 'Коробка для числа с именем', kk: 'Аты бар сан қорабы', en: 'A named box for a value' },
    text: {
      ru: 'Именованное место в памяти, где программа хранит число или текст, например счётчик кругов.',
      kk: 'Бағдарлама сан не мәтін сақтайтын аты бар жад орны, мысалы, айналым санағышы.',
      en: 'A named place in memory where the program keeps a number or text, like a lap counter.',
    },
  },
  {
    id: 'event',
    icon: 'traffic',
    term: { ru: 'Событие', kk: 'Оқиға', en: 'Event' },
    short: { ru: 'То, что запускает программу', kk: 'Бағдарламаны іске қосатын нәрсе', en: 'What starts a script' },
    text: {
      ru: 'Например «программа запущена» или «нажата кнопка». Блоки под событием выполняются, когда оно случилось.',
      kk: 'Мысалы, «бағдарлама іске қосылды» немесе «түйме басылды». Оқиға болғанда астындағы блоктар орындалады.',
      en: 'Like “program started” or “button pressed”. The blocks under it run when it happens.',
    },
  },
  {
    id: 'my-block',
    icon: 'brick',
    term: { ru: 'Свой блок', kk: 'Өз блогың', en: 'My Block' },
    short: { ru: 'Новый блок из нескольких', kk: 'Бірнеше блоктан жаңа блок', en: 'A new block made of others' },
    text: {
      ru: 'Несколько блоков под одним именем. В Python это функция.',
      kk: 'Бір атаудағы бірнеше блок. Python-да бұл функция.',
      en: 'Several blocks under one name. In Python it is a function.',
    },
  },
  {
    id: 'debug',
    icon: 'bug',
    term: { ru: 'Отладка', kk: 'Жөндеу', en: 'Debugging' },
    short: { ru: 'Поиск и исправление ошибок', kk: 'Қателерді іздеу және түзеу', en: 'Finding and fixing bugs' },
    text: {
      ru: 'Запускаешь, смотришь, что пошло не так, меняешь одну вещь и проверяешь снова.',
      kk: 'Іске қосасың, не дұрыс болмағанын көресің, бір нәрсені өзгертіп, қайта тексересің.',
      en: 'Run it, see what went wrong, change one thing and test again.',
    },
  },
  {
    id: 'calibration',
    icon: 'slider',
    term: { ru: 'Калибровка', kk: 'Калибрлеу', en: 'Calibration' },
    short: { ru: 'Настройка по реальным замерам', kk: 'Нақты өлшемдер бойынша баптау', en: 'Tuning by real measurements' },
    text: {
      ru: 'Подгонка чисел в программе под твоего робота и поле: например, сколько градусов нужно на поворот.',
      kk: 'Бағдарламадағы сандарды роботың мен алаңға сай келтіру: мысалы, бұрылысқа неше градус керек.',
      en: 'Adjusting the numbers for your robot and field, like how many degrees a turn takes.',
    },
  },
  {
    id: 'gear',
    icon: 'nut',
    term: { ru: 'Шестерня', kk: 'Тісті доңғалақ', en: 'Gear' },
    short: { ru: 'Колесо с зубьями', kk: 'Тістері бар доңғалақ', en: 'A wheel with teeth' },
    text: {
      ru: 'Передаёт вращение другой шестерне. Маленькая крутит большую — медленнее, но сильнее.',
      kk: 'Айналымды басқа тісті доңғалаққа береді. Кішісі үлкенін айналдырса — баяу, бірақ күштірек.',
      en: 'Passes rotation to another gear. A small one turning a big one is slower but stronger.',
    },
  },
  {
    id: 'axle',
    icon: 'pin',
    term: { ru: 'Ось', kk: 'Ось', en: 'Axle' },
    short: { ru: 'Стержень, на котором крутится колесо', kk: 'Дөңгелек айналатын білік', en: 'A rod a wheel turns on' },
    text: {
      ru: 'Крестообразный стержень: передаёт вращение от мотора колесу или шестерне.',
      kk: 'Айқыш пішінді білік: айналымды мотордан дөңгелекке не тісті доңғалаққа береді.',
      en: 'A cross-shaped rod that carries rotation from a motor to a wheel or gear.',
    },
  },
  {
    id: 'port',
    icon: 'plug',
    term: { ru: 'Порт', kk: 'Порт', en: 'Port' },
    short: { ru: 'Разъём для мотора или датчика', kk: 'Мотор не датчик ұясы', en: 'A socket for a motor or sensor' },
    text: {
      ru: 'Место на хабе, куда подключают провод. В программе порт указывают буквой.',
      kk: 'Хабтағы сым қосылатын орын. Бағдарламада порт әріппен көрсетіледі.',
      en: 'A socket on the hub for a cable. Programs name ports with a letter.',
    },
  },
  {
    id: 'simulator',
    icon: 'monitor',
    term: { ru: 'Симулятор', kk: 'Симулятор', en: 'Simulator' },
    short: { ru: 'Виртуальный робот на экране', kk: 'Экрандағы виртуалды робот', en: 'A virtual robot on screen' },
    text: {
      ru: 'Программа, которая показывает, как поедет робот, без настоящего набора.',
      kk: 'Нағыз жиынтықсыз робот қалай жүретінін көрсететін бағдарлама.',
      en: 'A program that shows how a robot would drive without a real kit.',
    },
  },
  {
    id: 'python',
    icon: 'snake',
    term: { ru: 'Python', kk: 'Python', en: 'Python' },
    short: { ru: 'Язык программирования текстом', kk: 'Мәтінмен бағдарламалау тілі', en: 'A text programming language' },
    text: {
      ru: 'Популярный язык, где команды пишут словами. Те же идеи, что и в блоках: циклы, условия, переменные.',
      kk: 'Командалар сөзбен жазылатын танымал тіл. Блоктардағыдай идеялар: циклдер, шарттар, айнымалылар.',
      en: 'A popular language where commands are written as text. Same ideas as blocks: loops, conditions, variables.',
    },
  },
  {
    id: 'controller',
    icon: 'chart',
    term: { ru: 'Регулятор', kk: 'Реттегіш', en: 'Controller' },
    short: { ru: 'Сам исправляет отклонение', kk: 'Ауытқуды өзі түзетеді', en: 'Corrects errors by itself' },
    text: {
      ru: 'Часть программы, которая всё время сравнивает «как есть» и «как надо» и подруливает. Так робот плавно едет по линии.',
      kk: 'Бағдарламаның «қалай бар» мен «қалай керекті» үнемі салыстырып, түзететін бөлігі. Солай робот сызықпен бір қалыпты жүреді.',
      en: 'Part of a program that keeps comparing “what is” with “what should be” and steers. It makes line following smooth.',
    },
  },
]
