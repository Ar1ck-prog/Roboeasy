/** Copy of the site-wide mentor. Kazakh needs a review by a native speaker before launch. */

import type { Locale } from './config'

const ru = {
  title: 'Наставник',
  open: 'Открыть чат с наставником',
  close: 'Закрыть чат',
  hello: 'Привет! Я наставник RoboEasy. Спроси про уроки, игры, робота, код или про то, как тут всё устроено.',
  suggestions: ['С чего мне начать?', 'Как подключить робота?', 'Как заработать монеты?'],
  placeholder: 'Напиши вопрос…',
  send: 'Отправить',
  thinking: 'Наставник думает…',
  note: 'Отвечает ИИ, он может ошибаться. Не пиши имя, адрес и телефон.',
  errors: {
    rate_limited: 'Слишком много вопросов подряд. Подожди минутку и спроси снова.',
    daily_limit: 'На сегодня вопросы закончились. Возвращайся завтра!',
    unavailable: 'Наставник сейчас занят. Попробуй ещё раз через минуту.',
    resting: 'ИИ отдыхает, попробуй через {m} мин.',
    bad_request: 'Не получилось отправить вопрос. Попробуй написать его короче.',
    offline: 'Нет связи с сервером. Проверь интернет и попробуй снова.',
  },
}

export type SiteMentorText = typeof ru

const kk: SiteMentorText = {
  title: 'Тәлімгер',
  open: 'Тәлімгермен чатты ашу',
  close: 'Чатты жабу',
  hello: 'Сәлем! Мен RoboEasy тәлімгерімін. Сабақтар, ойындар, робот, код немесе сайттың қалай жұмыс істейтіні туралы сұра.',
  suggestions: ['Неден бастаймын?', 'Роботты қалай қосамын?', 'Монетаны қалай табамын?'],
  placeholder: 'Сұрағыңды жаз…',
  send: 'Жіберу',
  thinking: 'Тәлімгер ойланып жатыр…',
  note: 'Жасанды интеллект жауап береді, ол қателесуі мүмкін. Атыңды, мекенжайыңды және телефоныңды жазба.',
  errors: {
    rate_limited: 'Сұрақтар тым көп. Бір минут күтіп, қайта сұра.',
    daily_limit: 'Бүгінгі сұрақтар бітті. Ертең қайта кел!',
    unavailable: 'Тәлімгер қазір бос емес. Бір минуттан кейін қайталап көр.',
    // TODO: проверить перевод
    resting: 'ЖИ демалып жатыр, {m} минуттан кейін қайталап көр.',
    bad_request: 'Сұрақты жіберу мүмкін болмады. Қысқарақ жазып көр.',
    offline: 'Сервермен байланыс жоқ. Интернетті тексеріп, қайталап көр.',
  },
}

const en: SiteMentorText = {
  title: 'Mentor',
  open: 'Open the mentor chat',
  close: 'Close the chat',
  hello: 'Hi! I am the RoboEasy mentor. Ask about lessons, games, your robot, code or how things work here.',
  suggestions: ['Where do I start?', 'How do I connect my robot?', 'How do I earn coins?'],
  placeholder: 'Type a question…',
  send: 'Send',
  thinking: 'The mentor is thinking…',
  note: 'Answers come from an AI and can be wrong. Do not write your name, address or phone number.',
  errors: {
    rate_limited: 'Too many questions in a row. Wait a minute and ask again.',
    daily_limit: 'That is all the questions for today. Come back tomorrow!',
    unavailable: 'The mentor is busy right now. Try again in a minute.',
    resting: 'The AI is resting, try again in {m} min.',
    bad_request: 'Could not send that question. Try writing it shorter.',
    offline: 'No connection to the server. Check the internet and try again.',
  },
}

const TEXT: Record<Locale, SiteMentorText> = { ru, kk, en }

export function getSiteMentorText(lang: Locale): SiteMentorText {
  return TEXT[lang]
}
