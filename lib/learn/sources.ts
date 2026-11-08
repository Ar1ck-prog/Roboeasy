/**
 * External resources for learning on your own (library page). Only
 * well-known, long-lived sites; none of them is affiliated with RoboEasy.
 */

import type { IconName } from '@/components/ui/anim-icon'

type L = { ru: string; kk: string; en: string }

export interface Source {
  id: string
  url: string
  icon: IconName
  title: string
  text: L
  /** The site is in English only. */
  english: boolean
}

export const SOURCES: Source[] = [
  {
    id: 'lego-education',
    url: 'https://education.lego.com/',
    icon: 'brick',
    title: 'LEGO® Education',
    text: {
      ru: 'Официальный сайт наборов SPIKE™ Prime: уроки, инструкции по сборке и приложение.',
      kk: 'SPIKE™ Prime жиынтықтарының ресми сайты: сабақтар, құрастыру нұсқаулары және қосымша.',
      en: 'The official site of the SPIKE™ Prime sets: lessons, building instructions and the app.',
    },
    english: false,
  },
  {
    id: 'spike-app',
    url: 'https://spike.legoeducation.com/',
    icon: 'laptop',
    title: 'SPIKE™ App',
    text: {
      ru: 'Приложение SPIKE в браузере: программы блоками и на Python для настоящего хаба.',
      kk: 'Браузердегі SPIKE қосымшасы: нағыз хабқа арналған блоктық және Python бағдарламалар.',
      en: 'The SPIKE app in the browser: block and Python programs for a real hub.',
    },
    english: false,
  },
  {
    id: 'prime-lessons',
    url: 'https://primelessons.org/',
    icon: 'books',
    title: 'Prime Lessons',
    text: {
      ru: 'Бесплатные уроки по SPIKE Prime от начального уровня до соревнований.',
      kk: 'SPIKE Prime бойынша бастапқы деңгейден жарыстарға дейінгі тегін сабақтар.',
      en: 'Free SPIKE Prime lessons from beginner to competition level.',
    },
    english: true,
  },
  {
    id: 'fll',
    url: 'https://www.firstlegoleague.org/',
    icon: 'trophy',
    title: 'FIRST® LEGO® League',
    text: {
      ru: 'Международные соревнования по робототехнике для школьников: сезоны, правила, команды.',
      kk: 'Оқушыларға арналған халықаралық робототехника жарыстары: маусымдар, ережелер, командалар.',
      en: 'The international robotics competition for students: seasons, rules and teams.',
    },
    english: true,
  },
  {
    id: 'pybricks',
    url: 'https://pybricks.com/',
    icon: 'snake',
    title: 'Pybricks',
    text: {
      ru: 'Python для хабов LEGO для тех, кто готов к коду посложнее.',
      kk: 'Күрделірек кодқа дайындарға арналған LEGO хабтарына Python.',
      en: 'Python for LEGO hubs, for when you are ready for more advanced code.',
    },
    english: true,
  },
  {
    id: 'python-tutorial',
    url: 'https://docs.python.org/3/tutorial/',
    icon: 'openbook',
    title: 'Python Tutorial',
    text: {
      ru: 'Официальный учебник Python: переменные, циклы, условия, функции.',
      kk: 'Python-ның ресми оқулығы: айнымалылар, циклдер, шарттар, функциялар.',
      en: 'The official Python tutorial: variables, loops, conditions, functions.',
    },
    english: true,
  },
  {
    id: 'scratch',
    url: 'https://scratch.mit.edu/',
    icon: 'cat',
    title: 'Scratch',
    text: {
      ru: 'Блочное программирование игр и анимаций — отличная тренировка логики.',
      kk: 'Ойындар мен анимацияларды блоктармен бағдарламалау — логиканы жақсы жаттықтырады.',
      en: 'Block programming of games and animations: great logic practice.',
    },
    english: false,
  },
  {
    id: 'code-org',
    url: 'https://code.org/',
    icon: 'puzzle',
    title: 'Code.org',
    text: {
      ru: 'Курсы и головоломки по программированию для любого возраста.',
      kk: 'Кез келген жасқа арналған бағдарламалау курстары мен жұмбақтары.',
      en: 'Programming courses and puzzles for any age.',
    },
    english: false,
  },
]
