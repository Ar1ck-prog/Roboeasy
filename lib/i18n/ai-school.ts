/** Copy of the interactive steps in the "AI from zero" section. */

import type { Locale } from './config'

const ru = {
  nav: 'ИИ с нуля',
  done: 'Готово! Можно идти дальше.',
  vibe: {
    describe: 'Опиши игру или страничку',
    change: 'Что изменить',
    placeholder: 'Например: круг убегает от курсора, за каждый клик +1 очко',
    build: 'Собрать',
    apply: 'Изменить',
    building: 'ИИ собирает…',
    note: 'Запросов в день: не больше 5. Игра работает в закрытой рамке и не выходит в интернет.',
    frame: 'Твоя игра',
    sample: 'Открыть готовую игру',
    errors: {
      bad_request: 'Не получилось отправить. Опиши игру чуть подробнее.',
      daily_limit: 'На сегодня запросы закончились. Возвращайся завтра.',
      rate_limited: 'Слишком быстро. Подожди минутку.',
      resting: 'ИИ отдыхает, попробуй через {m} мин.',
      unavailable: 'ИИ сейчас недоступен. Открой готовую игру.',
      refused: 'Такое здесь не получится. Придумай другую игру.',
    },
  },
  gesture: {
    privacy: 'Кадры с камеры остаются на этом устройстве и никуда не отправляются.',
    camera: 'Включить камеру',
    palm: 'Ладонь',
    fist: 'Кулак',
    add: 'Запомнить: {name}',
    hint: 'Держи кнопку и показывай жест, немного двигая рукой. Нужно по 20 примеров.',
    fewHint: 'Дай всего по 1–3 примера. Потом показывай разные жесты и смотри, как модель путается.',
    confidence: 'Уверенность: {n}%',
    drive: 'Управлять роботом: ладонь — ехать, кулак — стоп',
    denied: 'Камера недоступна. Разреши доступ в браузере или пропусти задание.',
    skip: 'Нет камеры, пропустить',
  },
  color: {
    swatches: 'Образцы цвета',
    swatch: 'Образец {name}',
    read: 'Считать с датчика',
    red: 'Красный',
    blue: 'Синий',
    teach: 'Это: {name}',
    hint: 'Выбери образец и скажи, какой это цвет. Нужно по 3 примера каждого.',
    test: 'Модель обучена. Выбирай образцы и смотри, что она скажет. Осталось проверок: {n}',
    result: 'Модель думает: {name} ({n}%)',
    sort: 'Сортировать роботом: мотор F толкает вправо или влево',
  },
}

export type AiSchoolText = typeof ru

// TODO: проверить перевод
const kk: AiSchoolText = {
  nav: 'ЖИ нөлден',
  done: 'Дайын! Әрі қарай жүруге болады.',
  vibe: {
    describe: 'Ойынды не бетті сипатта',
    change: 'Нені өзгерту керек',
    placeholder: 'Мысалы: шеңбер курсордан қашады, әр басу +1 ұпай',
    build: 'Құрастыру',
    apply: 'Өзгерту',
    building: 'ЖИ құрастырып жатыр…',
    note: 'Күніне 5 сұраудан артық емес. Ойын жабық жақтауда жұмыс істейді және интернетке шықпайды.',
    frame: 'Сенің ойының',
    sample: 'Дайын ойынды ашу',
    errors: {
      bad_request: 'Жіберу мүмкін болмады. Ойынды толығырақ сипатта.',
      daily_limit: 'Бүгінгі сұраулар бітті. Ертең қайта кел.',
      rate_limited: 'Тым жылдам. Бір минут күт.',
      resting: 'ЖИ демалып жатыр, {m} минуттан кейін қайталап көр.',
      unavailable: 'ЖИ қазір қолжетімсіз. Дайын ойынды аш.',
      refused: 'Мұндай мұнда болмайды. Басқа ойын ойлап тап.',
    },
  },
  gesture: {
    privacy: 'Камера кадрлары осы құрылғыда қалады және ешқайда жіберілмейді.',
    camera: 'Камераны қосу',
    palm: 'Алақан',
    fist: 'Жұдырық',
    add: 'Есте сақта: {name}',
    hint: 'Батырманы басып тұрып, қолыңды сәл қозғап ымды көрсет. 20 мысалдан керек.',
    fewHint: '1–3 мысал ғана бер. Содан кейін әртүрлі ым көрсетіп, модельдің шатасуын қара.',
    confidence: 'Сенімділік: {n}%',
    drive: 'Роботты басқару: алақан — жүру, жұдырық — тоқта',
    denied: 'Камера қолжетімсіз. Браузерде рұқсат бер немесе тапсырманы өткізіп жібер.',
    skip: 'Камера жоқ, өткізіп жіберу',
  },
  color: {
    swatches: 'Түс үлгілері',
    swatch: '{name} үлгісі',
    read: 'Датчиктен оқу',
    red: 'Қызыл',
    blue: 'Көк',
    teach: 'Бұл: {name}',
    hint: 'Үлгіні таңдап, қай түс екенін айт. Әрқайсысынан 3 мысал керек.',
    test: 'Модель үйретілді. Үлгілерді таңдап, не айтатынын қара. Қалған тексеру: {n}',
    result: 'Модель ойлайды: {name} ({n}%)',
    sort: 'Роботпен сұрыптау: F моторы оңға не солға итереді',
  },
}

const en: AiSchoolText = {
  nav: 'AI from zero',
  done: 'Done! You can move on.',
  vibe: {
    describe: 'Describe a game or a page',
    change: 'What should change',
    placeholder: 'For example: a circle runs from the cursor, +1 point per click',
    build: 'Build',
    apply: 'Change',
    building: 'The AI is building…',
    note: 'At most 5 requests a day. The game runs in a closed frame with no internet access.',
    frame: 'Your game',
    sample: 'Open a ready game',
    errors: {
      bad_request: 'Could not send that. Describe the game in a bit more detail.',
      daily_limit: 'That is all for today. Come back tomorrow.',
      rate_limited: 'Too fast. Wait a minute.',
      resting: 'The AI is resting, try again in {m} min.',
      unavailable: 'The AI is not available right now. Open a ready game.',
      refused: 'That will not work here. Think of another game.',
    },
  },
  gesture: {
    privacy: 'Camera frames stay on this device and are not sent anywhere.',
    camera: 'Turn on the camera',
    palm: 'Palm',
    fist: 'Fist',
    add: 'Remember: {name}',
    hint: 'Hold the button and show the gesture, moving your hand a little. You need 20 examples each.',
    fewHint: 'Give only 1–3 examples each. Then show different gestures and watch the model get confused.',
    confidence: 'Confidence: {n}%',
    drive: 'Drive the robot: palm to go, fist to stop',
    denied: 'The camera is not available. Allow it in the browser or skip this task.',
    skip: 'No camera, skip',
  },
  color: {
    swatches: 'Colour samples',
    swatch: 'Sample {name}',
    read: 'Read the sensor',
    red: 'Red',
    blue: 'Blue',
    teach: 'This is: {name}',
    hint: 'Pick a sample and say which colour it is. You need 3 examples of each.',
    test: 'The model is trained. Pick samples and see what it says. Checks left: {n}',
    result: 'The model thinks: {name} ({n}%)',
    sort: 'Sort with the robot: motor F pushes right or left',
  },
}

const TEXT: Record<Locale, AiSchoolText> = { ru, kk, en }

export const getAiSchoolText = (lang: Locale): AiSchoolText => TEXT[lang]
