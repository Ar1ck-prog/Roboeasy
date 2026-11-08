/** Copy of the Bluetooth link to a real robot. Kazakh needs a review by a native speaker before launch. */

import type { Locale } from './config'

const ru = {
  title: 'Настоящий робот',
  lead: 'Подключи хаб SPIKE Prime по Bluetooth и запускай программы прямо отсюда.',
  connect: 'Подключить робота',
  connecting: 'Подключаюсь…',
  disconnect: 'Отключить',
  connected: 'Подключён',
  firmware: 'Прошивка {v}',
  battery: 'Заряд: {n}%',
  slot: 'Слот на хабе',
  slotHint: 'Программа заменит то, что уже лежит в этом слоте.',
  send: 'На робота',
  sendConnect: 'Подключить и запустить',
  uploading: 'Загружаю… {n}%',
  running: 'Робот выполняет программу',
  stop: 'Остановить робота',
  console: 'Сообщения робота',
  sensors: 'Датчики и моторы',
  motor: 'Мотор {port}: {v}°',
  force: 'Сила {port}: {v}',
  color: 'Цвет {port}',
  distance: 'Расстояние {port}: {v} мм',
  noObject: 'Расстояние {port}: нет предмета',
  howTo: 'Нужен хаб с прошивкой SPIKE App 3: включи его и проверь, что Bluetooth на нём включён.',
  unsupported: 'Этот браузер не умеет подключаться по Bluetooth. Открой сайт в Chrome или Edge на компьютере или Android, а здесь скачай файл .llsp3.',
  problems: {
    connect: 'Не получилось подключиться. Проверь, что хаб включён и на нём прошивка SPIKE App 3, и попробуй ещё раз.',
    upload: 'Программа не загрузилась. Попробуй ещё раз.',
    start: 'Программа загрузилась, но не запустилась. Запусти её кнопкой на хабе или попробуй ещё раз.',
    lost: 'Связь с роботом потеряна. Подключи его снова.',
  },
}

export type RobotLinkText = typeof ru

const kk: RobotLinkText = {
  title: 'Нағыз робот',
  lead: 'SPIKE Prime хабын Bluetooth арқылы қосып, бағдарламаларды осы жерден іске қос.',
  connect: 'Роботты қосу',
  connecting: 'Қосылуда…',
  disconnect: 'Ажырату',
  connected: 'Қосылған',
  firmware: 'Микробағдарлама {v}',
  battery: 'Заряд: {n}%',
  slot: 'Хабтағы слот',
  slotHint: 'Бағдарлама осы слоттағы бағдарламаның орнына жазылады.',
  send: 'Роботқа',
  sendConnect: 'Қосу және іске қосу',
  uploading: 'Жүктелуде… {n}%',
  running: 'Робот бағдарламаны орындап жатыр',
  stop: 'Роботты тоқтату',
  console: 'Робот хабарламалары',
  sensors: 'Датчиктер мен моторлар',
  motor: '{port} моторы: {v}°',
  force: '{port} күші: {v}',
  color: '{port} түсі',
  distance: '{port} қашықтығы: {v} мм',
  noObject: '{port} қашықтығы: зат жоқ',
  howTo: 'SPIKE App 3 микробағдарламасы бар хаб керек: оны қосып, Bluetooth қосулы екенін тексер.',
  unsupported: 'Бұл браузер Bluetooth арқылы қосыла алмайды. Сайтты компьютердегі немесе Android-тағы Chrome не Edge-те аш, ал мұнда .llsp3 файлын жүктеп ал.',
  problems: {
    connect: 'Қосылу мүмкін болмады. Хаб қосулы екенін және онда SPIKE App 3 микробағдарламасы барын тексеріп, қайта байқап көр.',
    upload: 'Бағдарлама жүктелмеді. Қайта байқап көр.',
    start: 'Бағдарлама жүктелді, бірақ іске қосылмады. Оны хабтағы батырмамен іске қос немесе қайта байқап көр.',
    lost: 'Роботпен байланыс үзілді. Оны қайта қос.',
  },
}

const en: RobotLinkText = {
  title: 'Real robot',
  lead: 'Connect a SPIKE Prime hub over Bluetooth and run programs right from here.',
  connect: 'Connect the robot',
  connecting: 'Connecting…',
  disconnect: 'Disconnect',
  connected: 'Connected',
  firmware: 'Firmware {v}',
  battery: 'Battery: {n}%',
  slot: 'Slot on the hub',
  slotHint: 'The program replaces whatever is in this slot.',
  send: 'Run on robot',
  sendConnect: 'Connect and run',
  uploading: 'Uploading… {n}%',
  running: 'The robot is running the program',
  stop: 'Stop the robot',
  console: 'Messages from the robot',
  sensors: 'Sensors and motors',
  motor: 'Motor {port}: {v}°',
  force: 'Force {port}: {v}',
  color: 'Colour {port}',
  distance: 'Distance {port}: {v} mm',
  noObject: 'Distance {port}: nothing there',
  howTo: 'You need a hub with the SPIKE App 3 firmware: turn it on and check that its Bluetooth is on.',
  unsupported: 'This browser cannot connect over Bluetooth. Open the site in Chrome or Edge on a computer or Android, or download the .llsp3 file here.',
  problems: {
    connect: 'Could not connect. Check that the hub is on and has the SPIKE App 3 firmware, then try again.',
    upload: 'The program did not upload. Please try again.',
    start: 'The program uploaded but did not start. Start it with the button on the hub or try again.',
    lost: 'The connection to the robot was lost. Connect it again.',
  },
}

const TEXTS: Record<Locale, RobotLinkText> = { ru, kk, en }

export function getRobotLinkText(lang: Locale): RobotLinkText {
  return TEXTS[lang]
}
