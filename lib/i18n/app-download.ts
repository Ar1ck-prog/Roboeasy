import type { Locale } from './config'

/** The Android package served from public/download (built from the site with Bubblewrap, see docs/android-app.md). */
export const APK = { href: '/download/roboeasy.apk', version: '1.0.0', sizeMb: 1.1 }

const ru = {
  eyebrow: 'Приложение',
  heroLink: 'Скачать приложение',
  title: 'RoboEasy на телефоне и компьютере',
  lead: 'Иконка на рабочем столе, своё окно без адресной строки и тот же прогресс, что на сайте. Bluetooth к хабу и голосовое управление работают и в приложении.',
  android: {
    title: 'Android',
    text: 'Скачай APK и установи, как обычное приложение.',
    button: 'Скачать APK',
    meta: 'Версия {v} · {mb} МБ',
    steps: ['Скачай файл и открой его', 'Разреши установку из браузера, если телефон спросит', 'Нажми «Установить» и открой RoboEasy'],
    note: 'Нужен Chrome: приложение работает на его движке.',
  },
  desktop: {
    title: 'Компьютер',
    text: 'Windows, macOS, Linux и Chromebook: установка прямо из браузера, без файлов.',
    button: 'Установить на компьютер',
    installed: 'Уже установлено',
    manual: 'В Chrome или Edge нажми значок «Установить» справа в адресной строке (монитор со стрелкой) или меню ⋮ → «Установить RoboEasy».',
    done: 'RoboEasy установлен: ищи его в меню «Пуск» или на рабочем столе.',
  },
  ios: {
    title: 'iPhone и iPad',
    text: 'Открой сайт в Safari → «Поделиться» → «На экран „Домой“».',
  },
}

const kk: typeof ru = {
  eyebrow: 'Қолданба',
  heroLink: 'Қолданбаны жүктеу',
  title: 'RoboEasy телефонда және компьютерде',
  lead: 'Жұмыс үстеліндегі белгіше, мекенжай жолағы жоқ жеке терезе және сайттағыдай прогресс. Хабқа Bluetooth пен дауыспен басқару қолданбада да жұмыс істейді.',
  android: {
    title: 'Android',
    text: 'APK-ны жүктеп, кәдімгі қолданба сияқты орнат.',
    button: 'APK жүктеу',
    meta: 'Нұсқа {v} · {mb} МБ',
    steps: ['Файлды жүктеп, аш', 'Телефон сұраса, браузерден орнатуға рұқсат бер', '«Орнату» түймесін басып, RoboEasy-ді аш'],
    note: 'Chrome керек: қолданба соның қозғалтқышында жұмыс істейді.',
  },
  desktop: {
    title: 'Компьютер',
    text: 'Windows, macOS, Linux және Chromebook: файлсыз, тікелей браузерден орнату.',
    button: 'Компьютерге орнату',
    installed: 'Орнатылған',
    manual: 'Chrome немесе Edge-те мекенжай жолағының оң жағындағы «Орнату» белгішесін бас немесе ⋮ мәзірі → «RoboEasy орнату».',
    done: 'RoboEasy орнатылды: оны «Бастау» мәзірінен немесе жұмыс үстелінен ізде.',
  },
  ios: {
    title: 'iPhone және iPad',
    text: 'Сайтты Safari-де аш → «Бөлісу» → «Басты экранға».',
  },
}

const en: typeof ru = {
  eyebrow: 'App',
  heroLink: 'Get the app',
  title: 'RoboEasy on your phone and computer',
  lead: 'An icon on your home screen, its own window without the address bar and the same progress as on the site. Bluetooth to the hub and voice control work in the app too.',
  android: {
    title: 'Android',
    text: 'Download the APK and install it like any other app.',
    button: 'Download APK',
    meta: 'Version {v} · {mb} MB',
    steps: ['Download the file and open it', 'Allow installs from the browser if the phone asks', 'Tap “Install” and open RoboEasy'],
    note: 'Needs Chrome: the app runs on its engine.',
  },
  desktop: {
    title: 'Computer',
    text: 'Windows, macOS, Linux and Chromebook: install straight from the browser, no files.',
    button: 'Install on this computer',
    installed: 'Already installed',
    manual: 'In Chrome or Edge, click the “Install” icon on the right of the address bar (a monitor with an arrow) or menu ⋮ → “Install RoboEasy”.',
    done: 'RoboEasy is installed: find it in the Start menu or on the desktop.',
  },
  ios: {
    title: 'iPhone and iPad',
    text: 'Open the site in Safari → “Share” → “Add to Home Screen”.',
  },
}

export type AppDownloadText = typeof ru
export const getAppDownloadText = (lang: Locale): AppDownloadText => ({ ru, kk, en })[lang]
