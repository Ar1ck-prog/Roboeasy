import type { Locale } from './config'

const ru = {
  title: 'Практика с роботом',
  intro: 'Напиши программу, продиктуй задание или запиши проезд SPIKE Prime. Готовую программу можно открыть и проверить на поле BIOGLOW.',
  manual: 'Введи или вставь свой код SPIKE App 3.',
  voice: 'Скажи, что должен сделать робот, и отредактируй текст перед генерацией.',
  record: 'Записать маршрут',
  route: 'Проведи робота один раз и сохрани программу в слот хаба.',
  tabs: { sandbox: 'Песочница', voice: 'Голос', controller: 'Контроллер', simulator: 'Симулятор FLL' },
}

const kk: typeof ru = {
  title: 'Роботпен тәжірибе',
  intro: 'Бағдарлама жаз, тапсырманы дауыстап айт немесе SPIKE Prime роботын жүргізіп, маршрутты жаз. Дайын бағдарламаны BIOGLOW алаңында ашып, тексеруге болады.',
  manual: 'SPIKE App 3 кодыңды енгіз немесе қой.',
  voice: 'Робот не істеуі керек екенін айт та, бағдарлама жасамас бұрын мәтінді өңде.',
  record: 'Маршрутты жазу',
  route: 'Роботты бір рет жүргіз де, бағдарламаны хаб ұясына сақта.',
  tabs: { sandbox: 'Құмсалғыш', voice: 'Дауыс', controller: 'Контроллер', simulator: 'FLL симуляторы' },
}

const en: typeof ru = {
  title: 'Robot practice',
  intro: 'Write a program, dictate an assignment, or record a drive with SPIKE Prime. Open the finished program on the BIOGLOW field to try it.',
  manual: 'Type or paste your own SPIKE App 3 code.',
  voice: 'Say what the robot should do and edit the text before generating a program.',
  record: 'Record a route',
  route: 'Drive the robot once and save the program to a hub slot.',
  tabs: { sandbox: 'Sandbox', voice: 'Voice', controller: 'Controller', simulator: 'FLL simulator' },
}

export const getRobotPracticeText = (lang: Locale) => ({ ru, kk, en })[lang]
