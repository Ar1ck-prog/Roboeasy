/** Copy of video debugging. */

import type { Locale } from './config'

const ru = {
  tab: 'Видео-отладка',
  title: 'Видео-отладка',
  lead: 'Сними, как робот едет (до 15 секунд), и наставник подскажет, где искать ошибку. Решение он не напишет: додумать надо самому.',
  privacy: 'Снимай только робота, без людей. Само видео остаётся на устройстве: на сервер уходят несколько маленьких кадров, а после ответа они удаляются. Кадры анализирует ИИ Google Gemini.',
  choose: 'Выбрать или снять видео',
  ready: 'Видео подготовлено: кадров {n}',
  program: 'Какую программу запускал робот',
  noPrograms: 'Сначала создай программу во вкладке «Текст и ИИ».',
  expected: 'Что должен был сделать робот',
  expectedHint: 'Например: повернуть ровно на 90 градусов',
  send: 'Спросить наставника',
  sending: 'Наставник смотрит видео…',
  limit: 'Не больше 3 видео в день.',
  answerTitle: 'Наставник заметил',
  showHint: 'Показать подсказку',
  remaining: 'Осталось видео на сегодня: {n}',
  errors: {
    too_long: 'Видео длиннее 15 секунд. Сними покороче.',
    unreadable: 'Не получилось прочитать это видео. Попробуй другой файл.',
    bad_request: 'Не получилось отправить видео. Проверь, что заполнены все поля.',
    daily_limit: 'На сегодня видео закончились. Возвращайся завтра.',
    rate_limited: 'Слишком много запросов. Подожди немного.',
    resting: 'ИИ отдыхает, попробуй через {m} мин.',
    unavailable: 'Наставник сейчас не может посмотреть видео. Попробуй позже.',
    not_robot: 'На этом видео не видно робота. Сними его ещё раз.',
    offline: 'Нет связи с сервером. Проверь интернет и попробуй снова.',
  },
}

export type VideoText = typeof ru

// TODO: проверить перевод
const kk: VideoText = {
  tab: 'Бейне-түзету',
  title: 'Бейне-түзету',
  lead: 'Робот қалай жүретінін түсір (15 секундқа дейін), тәлімгер қатені қайдан іздеу керегін айтады. Шешімін жазбайды: оны өзің табасың.',
  privacy: 'Тек роботты түсір, адамдарсыз. Бейненің өзі құрылғыда қалады: серверге бірнеше кішкентай кадр жіберіледі, жауаптан кейін олар өшіріледі. Кадрларды Google Gemini ЖИ талдайды.',
  choose: 'Бейнені таңдау немесе түсіру',
  ready: 'Бейне дайын: {n} кадр',
  program: 'Робот қай бағдарламаны орындады',
  noPrograms: 'Алдымен «Мәтін және ЖИ» қойындысында бағдарлама жаса.',
  expected: 'Робот не істеуі керек еді',
  expectedHint: 'Мысалы: дәл 90 градусқа бұрылу',
  send: 'Тәлімгерден сұрау',
  sending: 'Тәлімгер бейнені көріп жатыр…',
  limit: 'Күніне 3 бейнеден артық емес.',
  answerTitle: 'Тәлімгер байқады',
  showHint: 'Кеңесті көрсету',
  remaining: 'Бүгінге қалған бейне: {n}',
  errors: {
    too_long: 'Бейне 15 секундтан ұзын. Қысқарақ түсір.',
    unreadable: 'Бұл бейнені оқу мүмкін болмады. Басқа файлды байқап көр.',
    bad_request: 'Бейнені жіберу мүмкін болмады. Барлық өрістің толтырылғанын тексер.',
    daily_limit: 'Бүгінгі бейнелер бітті. Ертең қайта кел.',
    rate_limited: 'Сұрау тым көп. Біраз күт.',
    resting: 'ЖИ демалып жатыр, {m} минуттан кейін қайталап көр.',
    unavailable: 'Тәлімгер қазір бейнені көре алмайды. Кейінірек байқап көр.',
    not_robot: 'Бұл бейнеде робот көрінбейді. Қайта түсір.',
    offline: 'Сервермен байланыс жоқ. Интернетті тексеріп, қайталап көр.',
  },
}

const en: VideoText = {
  tab: 'Video debug',
  title: 'Video debug',
  lead: 'Film your robot driving (up to 15 seconds) and the mentor will point out where to look for the mistake. It will not write the solution: that part is yours.',
  privacy: 'Film only the robot, with no people in view. The video itself stays on your device: a few small stills go to the server and are deleted after the answer. The stills are analysed by Google Gemini AI.',
  choose: 'Choose or film a video',
  ready: 'Video ready: {n} stills',
  program: 'Which program was the robot running',
  noPrograms: 'First create a program in the “Text and AI” tab.',
  expected: 'What should the robot have done',
  expectedHint: 'For example: turn exactly 90 degrees',
  send: 'Ask the mentor',
  sending: 'The mentor is watching…',
  limit: 'At most 3 videos a day.',
  answerTitle: 'The mentor noticed',
  showHint: 'Show a hint',
  remaining: 'Videos left today: {n}',
  errors: {
    too_long: 'The video is longer than 15 seconds. Film a shorter one.',
    unreadable: 'Could not read this video. Try another file.',
    bad_request: 'Could not send the video. Check that every field is filled in.',
    daily_limit: 'That is all the videos for today. Come back tomorrow.',
    rate_limited: 'Too many requests. Wait a little.',
    resting: 'The AI is resting, try again in {m} min.',
    unavailable: 'The mentor cannot watch the video right now. Try later.',
    not_robot: 'There is no robot in this video. Film it again.',
    offline: 'No connection to the server. Check the internet and try again.',
  },
}

const TEXT: Record<Locale, VideoText> = { ru, kk, en }

export const getVideoText = (lang: Locale): VideoText => TEXT[lang]
